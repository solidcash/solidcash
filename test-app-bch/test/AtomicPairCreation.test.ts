import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import hre from "hardhat";
import { binToHex, hash160, lockingBytecodeToCashAddress } from "@bitauth/libauth";
import { framedValidator } from "@solidcash/solidc/runtime";
import { bytesEqual, validatorAddress, type Artifact, type FunctionSplitBundle } from "@solidcash/utils";
import { framedCall, framedDeploy } from "@solidcash/solidcash/framed";
import { stateRecordLockingBytecode } from "@solidcash/solidcash/dist/framed/deploy/records.js";
import { deployMaster } from "@solidcash/solidcash/dist/framed/deploy/material.js";
import { MasterPoolDeployment } from "@solidcash/solidcash/dist/framed/deploy/pool.js";
import {
  childCollectionHashes, childGenesisOutputCount,
} from "@solidcash/solidcash/dist/framed/deploy/genesis-outputs.js";
import { deployStatefulContract } from "@solidcash/solidcash/dist/stateful/sc-deploy.js";
import { bindProviderBlockOracle } from "@solidcash/solidcash/dist/framed/call/block-oracle.js";

/**
 * The SushiSwap pair created with CREATE2 in its creator's own transaction (docs/framed/CREATE2_IDENTITY.md).
 *
 * The pair has 23 entries and 3 internal helpers, so the creator's allow-list names every one of them: the caller-funded transaction mints every shard master at its deployment lock, the validator at `addrV(K)`,
 * the authhead and the pair's records, and the creator refuses any other output of the category. `createPair`'s
 * `initialize` call is a frame of the child, which runs in a later transaction; `registerPair` initializes the pair
 * the app deploys until the deploy-then-call fold lands.
 */

const ARTIFACTS = path.resolve(__dirname, "../artifacts/solidcash");
const artifactOf = (name: string): Artifact =>
  JSON.parse(readFileSync(path.join(ARTIFACTS, `${name}.json`), "utf8")) as Artifact;
const bundleOf = (name: string): FunctionSplitBundle =>
  JSON.parse(readFileSync(path.join(ARTIFACTS, `${name}.func.json`), "utf8")) as FunctionSplitBundle;

const VALIDATOR = framedValidator.buildValidatorProgram();

describe("the pair created with create2", () => {
  it("mints its genesis in the caller's transaction, at addrV(K)", async () => {
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
    const funding = { txid: "50".repeat(32), vout: 0, satoshis: 2_000_000n };
    await provider.addUtxo(callerAddress, funding);

    const pair = { artifact: artifactOf("UniswapV2Pair"), bundle: bundleOf("UniswapV2Pair") };
    const creator = { artifact: artifactOf("AtomicPairCreator"), bundle: bundleOf("AtomicPairCreator") };
    const pool = { masters: 1, validators: 1 };
    bindProviderBlockOracle(provider, pair.artifact);
    for (const shard of [...pair.bundle.shards, ...pair.bundle.internalCuts]) {
      bindProviderBlockOracle(provider, shard.artifact);
    }
    const childLocks = MasterPoolDeployment.createFunctionSplit({
      bundle: pair.bundle, category: new Uint8Array(32).fill(7), validatorProgram: VALIDATOR, size: pool,
    }).getEntryLocks();
    expect(childLocks.length).toBe(23);

    const { categoryId } = await deployStatefulContract(creator.artifact, [], {
      provider, fundingUtxo: funding, funder, changeAddress: callerAddress,
      threadCount: 1, validatorCount: 1, functionSplit: creator.bundle, childLocks,
      childCollections: childCollectionHashes(pair.artifact),
      childOutputCount: childGenesisOutputCount({
        artifact: pair.artifact, category: new Uint8Array(32).fill(9), validatorProgram: VALIDATOR,
        provider, split: pair.bundle, pool, ownerLock: callerLock,
      }),
    } as never);

    const caller = { txid: "51".repeat(32), vout: 0, satoshis: 9_000_000n };
    await provider.addUtxo(callerAddress, caller);
    const split = framedDeploy.functionSplitFor(provider, categoryId) ?? creator.bundle;
    const result = await framedCall.callFramedEntry({
      provider, artifact: creator.artifact, categoryId, functionName: "make",
      args: [new Uint8Array(20).fill(1), new Uint8Array(20).fill(2)],
      callerUtxo: caller, callerLockingBytecode: callerLock, funder, split,
      validatorProgram: VALIDATOR, publish: false,
      creates: { artifact: pair.artifact, split: pair.bundle, pool },
    } as never);
    const refused = result.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? "refused"}`).join("; ");
    expect(result.accepted, refused).toBe(true);

    // (a) `create2` returns `addrV(K)` of the caller's coin.
    const category = Uint8Array.from(Buffer.from(caller.txid, "hex"));
    const address = validatorAddress(category, VALIDATOR);
    expect(binToHex(result.values[0] as Uint8Array)).toBe(binToHex(hash160(address)));

    // (b) The genesis carries a master at each of the pair's 26 entry locks, the validator and the records.
    const ofCategory = result.transaction.outputs.filter((output) => output.token !== undefined
      && binToHex(output.token.category) === binToHex(category));
    for (const shard of pair.bundle.shards) {
      const lock = deployMaster(shard.artifact, category, VALIDATOR).lockingBytecode;
      expect(ofCategory.some((output) => bytesEqual(output.lockingBytecode, lock)
        && output.token!.nft?.capability === "minting"), `master of ${shard.function}`).toBe(true);
    }
    expect(ofCategory.some((output) => bytesEqual(output.lockingBytecode, address)
      && output.token!.nft?.capability === "mutable"), "validator at addrV(K)").toBe(true);
    expect(ofCategory.some((output) => bytesEqual(
      output.lockingBytecode, stateRecordLockingBytecode(binToHex(category)),
    ) && output.token!.nft?.capability === "mutable"), "state record").toBe(true);

    // (c) The creator fits one input: the widest unlocking bytecode stays under the production 10,000-byte cap.
    const widths = result.transaction.inputs.map((input) => input.unlockingBytecode.length);
    expect(Math.max(...widths)).toBeLessThan(10_000);
  }, 600_000);
});
