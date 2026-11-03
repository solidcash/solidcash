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
import {
  childCollectionHashes, childGenesisOutputCount,
} from "@solidcash/solidcash/dist/framed/deploy/genesis-outputs.js";
import { resolveMasterPoolSize } from "@solidcash/solidcash/dist/framed/deploy/pool.js";
import { deployStatefulContract } from "@solidcash/solidcash/dist/stateful/sc-deploy.js";
import { PAIR_POOL, pairCreation } from "./pair-creation.js";

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

    const childLocks = MasterPoolDeployment.createFunctionSplit({
      bundle: pair.bundle, category: new Uint8Array(32).fill(7), validatorProgram: VALIDATOR,
      size: PAIR_POOL,
    }).getEntryLocks();
    expect(childLocks.length).toBe(26);

    const childPool = resolveMasterPoolSize(PAIR_POOL);
    const { categoryId } = await deployStatefulContract(factory.artifact, [callerLock], {
      provider, fundingUtxo: funding, funder, changeAddress: callerAddress,
      threadCount: 1, validatorCount: 1, functionSplit: factory.bundle, childLocks,
      childCollections: childCollectionHashes(pair.artifact),
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
    // A non-palindromic txid: a category whose byte order is not its own reverse, so a re-encoded broadcast cannot
    // pass by accident.
    const caller = { txid: `${"71".repeat(31)}72`, vout: 0, satoshis: 20_000_000n };
    await provider.addUtxo(callerAddress, caller);
    const split = framedDeploy.functionSplitFor(provider, categoryId) ?? factory.bundle;
    const result = await framedCall.callFramedEntry({
      provider, artifact: factory.artifact, categoryId, functionName: "createPair",
      args: [tokenA, tokenB],
      callerUtxo: caller, callerLockingBytecode: callerLock, funder, split,
      validatorProgram: VALIDATOR, publish: false,
      creates: pairCreation(factory.artifact, pair, tokenA, tokenB),
    } as never);
    const refused = result.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? "refused"}`).join("; ");
    expect(result.accepted, refused).toBe(true);

    const category = Uint8Array.from(Buffer.from(caller.txid, "hex"));
    const address = validatorAddress(category, VALIDATOR);
    expect(binToHex(result.values[0] as Uint8Array)).toBe(binToHex(hash160(address)));
    const ofCategory = result.transaction.outputs.filter((output) => output.token !== undefined
      && binToHex(output.token.category) === binToHex(category));
    // The shard artifacts are deployment-prepared (each presents its entry's lock), so the genesis locks come from
    // the same function split the child is deployed with rather than from the unprepared shard artifacts.
    const childDeployment = MasterPoolDeployment.createFunctionSplit({
      bundle: pair.bundle, category, validatorProgram: VALIDATOR, size: resolveMasterPoolSize(PAIR_POOL),
    });
    for (const lock of childDeployment.getEntryLocks()) {
      expect(ofCategory.some((output) => bytesEqual(output.lockingBytecode, lock)
        && output.token!.nft?.capability === "minting"), `master at ${binToHex(lock)}`).toBe(true);
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

    // A composer that supplies an arbitrary commitment for a pair record is refused: the record output's digest no
    // longer matches the one the folded state committed to (and the category-output count is one too many).
    const tamperedCaller = { txid: `${"73".repeat(31)}74`, vout: 0, satoshis: 20_000_000n };
    await provider.addUtxo(callerAddress, tamperedCaller);
    const tampered = await framedCall.callFramedEntry({
      provider, artifact: factory.artifact, categoryId, functionName: "createPair",
      args: [Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x41), 0x87]),
        Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x42), 0x87])],
      callerUtxo: tamperedCaller, callerLockingBytecode: callerLock, funder, split,
      validatorProgram: VALIDATOR, publish: false,
      creates: pairCreation(factory.artifact, pair,
        Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x41), 0x87]),
        Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x42), 0x87])),
      extraOutputs: [{
        to: stateRecordLockingBytecode(binToHex(hexToBin(tamperedCaller.txid))), amount: 1200n,
        token: { category: tamperedCaller.txid, amount: 0n, nft: { capability: "mutable", commitment: "ff" } },
      }],
    } as never);
    expect(tampered.accepted).toBe(false);
  }, 600_000);
});
