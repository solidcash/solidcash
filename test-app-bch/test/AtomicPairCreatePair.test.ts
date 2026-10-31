import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import hre from "hardhat";
import { binToHex, hash160, hexToBin, lockingBytecodeToCashAddress } from "@bitauth/libauth";
import { framedValidator } from "@solidcash/solidc/runtime";
import { bytesEqual, validatorAddress, type Artifact, type FunctionSplitBundle } from "@solidcash/utils";
import { framedCall, framedDeploy } from "@solidcash/solidcash/framed";
import { stateRecordLockingBytecode } from "@solidcash/solidcash/dist/framed/deploy/records.js";
import { deployMaster } from "@solidcash/solidcash/dist/framed/deploy/material.js";
import { MasterPoolDeployment } from "@solidcash/solidcash/dist/framed/deploy/pool.js";
import { childGenesisOutputCount } from "@solidcash/solidcash/dist/framed/deploy/genesis-outputs.js";
import { resolveMasterPoolSize } from "@solidcash/solidcash/dist/framed/deploy/pool.js";
import { deployStatefulContract } from "@solidcash/solidcash/dist/stateful/sc-deploy.js";
import { bindProviderBlockOracle } from "@solidcash/solidcash/dist/framed/call/block-oracle.js";

/**
 * `UniswapV2Factory.createPair` run atomically on BCH, from the shipped factory and pair source
 * (docs/framed/CREATE2_IDENTITY.md).
 *
 * The creation mints the pair's genesis in the caller's transaction, and the factory's `initialize` call on the new
 * pair is folded into that genesis: the child's frames cannot run in the transaction that mints its masters.
 */

const ARTIFACTS = path.resolve(__dirname, "../artifacts/solidcash");
const artifactOf = (name: string): Artifact =>
  JSON.parse(readFileSync(path.join(ARTIFACTS, `${name}.json`), "utf8")) as Artifact;
const bundleOf = (name: string): FunctionSplitBundle =>
  JSON.parse(readFileSync(path.join(ARTIFACTS, `${name}.func.json`), "utf8")) as FunctionSplitBundle;
const VALIDATOR = framedValidator.buildValidatorProgram();

describe("UniswapV2Factory.createPair", () => {
  it("creates and initializes the pair in one caller-funded transaction", async () => {
    const connection = await hre.network.create();
    const provider = (connection as unknown as { provider: any }).provider;
    const signer = await connection.ethers.getSigner(0);
    const callerLock = (signer as unknown as { getLockingBytecode(): Uint8Array }).getLockingBytecode();
    const callerAddress = (() => {
      const encoded = lockingBytecodeToCashAddress({ bytecode: callerLock, prefix: "bchtest" });
      if (typeof encoded === "string") throw new Error(encoded);
      return encoded.address;
    })();
    const funder = signer.unlockP2PKH() as never;
    const funding = { txid: "70".repeat(32), vout: 0, satoshis: 2_000_000n };
    await provider.addUtxo(callerAddress, funding);

    const factory = { artifact: artifactOf("UniswapV2Factory"), bundle: bundleOf("UniswapV2Factory") };
    const pair = { artifact: artifactOf("UniswapV2Pair"), bundle: bundleOf("UniswapV2Pair") };
    expect((factory.artifact.composition as any)?.creates?.[0]?.foldedCall?.functionName).toBe("initialize");
    expect(factory.artifact.abi.find((entry) => entry.name === "createPair")?.externalCalls?.length ?? 0).toBe(0);

    bindProviderBlockOracle(provider, pair.artifact);
    for (const shard of [...pair.bundle.shards, ...pair.bundle.internalCuts]) {
      bindProviderBlockOracle(provider, shard.artifact);
    }
    const childLocks = MasterPoolDeployment.createFunctionSplit({
      bundle: pair.bundle, category: new Uint8Array(32).fill(7), validatorProgram: VALIDATOR,
      size: { masters: 1, validators: 1 },
    }).getEntryLocks();
    expect(childLocks.length).toBe(23);

    const childPool = resolveMasterPoolSize();
    const { categoryId } = await deployStatefulContract(factory.artifact, [callerLock], {
      provider, fundingUtxo: funding, funder, changeAddress: callerAddress,
      threadCount: 1, validatorCount: 1, functionSplit: factory.bundle, childLocks,
      childOutputCount: childGenesisOutputCount({
        artifact: pair.artifact, category: new Uint8Array(32).fill(9), validatorProgram: VALIDATOR,
        provider, split: pair.bundle, pool: childPool, ownerLock: callerLock,
        initializer: { functionName: "initialize", args: [
          Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x31), 0x87]),
          Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x32), 0x87]),
        ] },
      }),
    } as never);
    framedDeploy.registerFramedCreatedChild(provider, "UniswapV2Pair", pair.artifact, pair.bundle);

    const tokenA = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x31), 0x87]);
    const tokenB = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x32), 0x87]);
    const caller = { txid: "71".repeat(32), vout: 0, satoshis: 20_000_000n };
    await provider.addUtxo(callerAddress, caller);
    const split = framedDeploy.functionSplitFor(provider, categoryId) ?? factory.bundle;
    const result = await framedCall.callFramedEntry({
      provider, artifact: factory.artifact, categoryId, functionName: "createPair",
      args: [tokenA, tokenB],
      callerUtxo: caller, callerLockingBytecode: callerLock, funder, split,
      validatorProgram: VALIDATOR, publish: false,
    } as never);
    const refused = result.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? "refused"}`).join("; ");
    expect(result.accepted, refused).toBe(true);

    const category = Uint8Array.from(Buffer.from(caller.txid, "hex"));
    const address = validatorAddress(category, VALIDATOR);
    expect(binToHex(result.values[0] as Uint8Array)).toBe(binToHex(hash160(address)));
    const ofCategory = result.transaction.outputs.filter((output) => output.token !== undefined
      && binToHex(output.token.category) === binToHex(category));
    for (const shard of pair.bundle.shards) {
      const lock = deployMaster(shard.artifact, category, VALIDATOR).lockingBytecode;
      expect(ofCategory.some((output) => bytesEqual(output.lockingBytecode, lock)
        && output.token!.nft?.capability === "minting"), `master of ${shard.function}`).toBe(true);
    }
    const recordLock = stateRecordLockingBytecode(binToHex(category));
    const records = ofCategory.filter((output) => bytesEqual(output.lockingBytecode, recordLock));
    const commitments = records.map((record) => {
      const commitment = record.token?.nft?.commitment;
      return typeof commitment === "string" ? commitment : binToHex((commitment ?? new Uint8Array()) as Uint8Array);
    }).join("");
    const lock = (value: Uint8Array): string => binToHex(value);
    expect(commitments).toContain(lock(tokenA));
    expect(commitments).toContain(lock(tokenB));
    // The constructor stored the creator its `msg.sender` names: the factory's own addrV.
    const creatorAddress = deployMaster(factory.artifact, hexToBin(categoryId), VALIDATOR).address;
    expect(commitments).toContain(binToHex(creatorAddress));

    const widths = result.transaction.inputs.map((input) => input.unlockingBytecode.length);
    expect(Math.max(...widths)).toBeLessThan(10_000);
  }, 600_000);
});
