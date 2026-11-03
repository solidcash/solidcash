import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import hre from "hardhat";
import { binToHex, hexToBin, lockingBytecodeToCashAddress } from "@bitauth/libauth";
import { framedValidator } from "@solidcash/solidc/runtime";
import {
  buildPushdataCommitment, bytesEqual, encodePushdataValue, parsePushdataCommitment, sha256,
  type Artifact, type FunctionSplitBundle, type StateLayout,
} from "@solidcash/utils";
import { framedCall, framedDeploy } from "@solidcash/solidcash/framed";
import { createVirtualMachineBch2026ForProvider } from "@solidcash/solidcash/dist/network/createVirtualMachine.js";
import {
  entryRecordLockingBytecode, stateRecordLockingBytecode,
} from "@solidcash/solidcash/dist/framed/deploy/records.js";
import { encodeEntryCommitment } from "@solidcash/solidcash/dist/stateful/SortedList.js";
import { deployStatefulContract } from "@solidcash/solidcash/dist/stateful/sc-deploy.js";
import { PAIR_POOL, pairCreation } from "./pair-creation.js";

/**
 * `UniswapV2Factory.createPair` composed by a hostile composer (docs/framed/CREATE2_IDENTITY.md, "The genesis replay").
 *
 * Whoever composes a creating transaction lays down the pair's genesis, and anyone may create a pair. The shipped
 * factory requires the outputs of the pair's category to be exactly the genesis its folded `new` and `initialize`
 * produce, so this plans an honest creation of the shipped pair, rewrites its outputs the way a composer could, and asks
 * the machine for the factory's verdict on each rewrite. The composer also rewrites the folded-state `OP_RETURN`,
 * which the earlier category check compared with, and keeps the number of outputs of the pair's category the earlier
 * check counted where the attack allows.
 */

const ARTIFACTS = path.resolve(__dirname, "../artifacts/solidcash");
const artifactOf = (name: string): Artifact =>
  JSON.parse(readFileSync(path.join(ARTIFACTS, `${name}.json`), "utf8")) as Artifact;
const bundleOf = (name: string): FunctionSplitBundle =>
  JSON.parse(readFileSync(path.join(ARTIFACTS, `${name}.func.json`), "utf8")) as FunctionSplitBundle;
const lockOf = (fill: number): Uint8Array => Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(fill), 0x87]);

type Transaction = Awaited<ReturnType<typeof framedCall.callFramedEntry>>["transaction"];
type TxOutput = Transaction["outputs"][number];

const ofCategory = (output: TxOutput, category: Uint8Array): boolean =>
  output.token !== undefined && bytesEqual(output.token.category, category);
const commitmentOf = (output: TxOutput): Uint8Array => output.token?.nft?.commitment ?? new Uint8Array();
const withCommitment = (output: TxOutput, commitment: Uint8Array): TxOutput => ({
  ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment } },
});

/** `outputs` with the folded-state `OP_RETURN` restated over its outputs of `category`, as the SDK computes it. */
function withDigest(outputs: TxOutput[], category: Uint8Array): TxOutput[] {
  const parts = outputs.filter((output) => ofCategory(output, category))
    .map((output) => sha256(Uint8Array.from([...output.lockingBytecode, ...commitmentOf(output)])));
  const digest = sha256(Uint8Array.from(parts.flatMap((part) => [...part])));
  return outputs.map((output) => output.lockingBytecode.length === 34 && output.lockingBytecode[0] === 0x6a
    && output.lockingBytecode[1] === 0x20 && output.token === undefined
    ? { ...output, lockingBytecode: Uint8Array.from([0x6a, 0x20, ...digest]) }
    : output);
}

/** `outputs` with `field` of the pair's state forged to `value`, its record re-encoded as the SDK encodes it. */
function forged(outputs: TxOutput[], categoryId: string, layout: StateLayout, field: string, value: unknown): TxOutput[] {
  const recordLock = stateRecordLockingBytecode(categoryId);
  const records = outputs.map((output, index) => ({ output, index }))
    .filter(({ output }) => bytesEqual(output.lockingBytecode, recordLock));
  for (const [nftIndex, { output, index }] of records.entries()) {
    const values = parsePushdataCommitment(binToHex(commitmentOf(output)), layout, nftIndex);
    if (!(field in values)) continue;
    const rewritten = [...outputs];
    rewritten[index] = withCommitment(output, hexToBin(
      buildPushdataCommitment(layout, { ...values, [field]: value } as never, nftIndex),
    ));
    return rewritten;
  }
  throw new Error(`no record of the pair holds ${field}`);
}

describe("UniswapV2Factory.createPair from a hostile composer", () => {
  it("refuses every forged pair genesis and accepts the honest one", async () => {
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
    await provider.addUtxo(callerAddress, { txid: "80".repeat(32), vout: 0, satoshis: 2_000_000n });

    const factory = { artifact: artifactOf("UniswapV2Factory"), bundle: bundleOf("UniswapV2Factory") };
    const pair = { artifact: artifactOf("UniswapV2Pair"), bundle: bundleOf("UniswapV2Pair") };
    const constants = framedDeploy.framedChildConstants({
      artifact: pair.artifact, split: pair.bundle, provider, pool: PAIR_POOL,
    });
    const { categoryId: factoryCategory } = await deployStatefulContract(factory.artifact, [callerLock], {
      provider, fundingUtxo: { txid: "80".repeat(32), vout: 0, satoshis: 2_000_000n }, funder,
      changeAddress: callerAddress, threadCount: 1, validatorCount: 1, functionSplit: factory.bundle,
      childLocks: constants.childLocks, childPool: constants.childPool, childCollections: constants.childCollections,
    } as never);

    const tokenA = lockOf(0x31);
    const tokenB = lockOf(0x32);
    const attacker = lockOf(0x66);
    const caller = { txid: `${"81".repeat(31)}82`, vout: 0, satoshis: 20_000_000n };
    await provider.addUtxo(callerAddress, caller);
    const result = await framedCall.callFramedEntry({
      provider, artifact: factory.artifact, categoryId: factoryCategory, functionName: "createPair",
      args: [tokenA, tokenB], callerUtxo: caller, callerLockingBytecode: callerLock, funder,
      split: framedDeploy.functionSplitFor(provider, factoryCategory) ?? factory.bundle,
      validatorProgram: framedValidator.buildValidatorProgram(), publish: false,
      creates: pairCreation(factory.artifact, pair, tokenA, tokenB),
    } as never);
    const refused = result.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? "refused"}`).join("; ");
    expect(result.accepted, refused).toBe(true);

    const category = hexToBin(caller.txid);
    const categoryId = caller.txid;
    const layout = pair.artifact.stateLayout!;
    const master = result.verdicts.find((verdict) => verdict.id === "master")!;
    const machine = createVirtualMachineBch2026ForProvider(provider);
    const factoryAccepts = (outputs: TxOutput[], inputs = result.transaction.inputs): boolean => machine.stateSuccess(
      machine.evaluate({
        inputIndex: master.index, sourceOutputs: result.sourceOutputs,
        transaction: { ...result.transaction, inputs, outputs: withDigest(outputs, category) },
      } as never),
    ) === true;
    const outputs = (): TxOutput[] => result.transaction.outputs.map((output) => ({ ...output }));
    const countOfK = (rewritten: TxOutput[]): number => rewritten.filter((output) => ofCategory(output, category)).length;

    // The honest genesis, with any output of no category of the pair's added.
    expect(factoryAccepts(outputs())).toBe(true);
    expect(factoryAccepts([...outputs(), { lockingBytecode: callerLock, valueSatoshis: 5_000n }])).toBe(true);

    // Forged state: another token, unbacked LP supply, another factory, a pair locked forever, a fee checkpoint.
    for (const [field, value] of [
      ["token0", attacker], ["token1", tokenA], ["totalSupply", 1_000_000n], ["factory", attacker],
      ["unlocked", 0n], ["kLast", 7n], ["reserve0", 1n],
    ] as const) {
      expect(factoryAccepts(forged(outputs(), categoryId, layout, field, value)), field).toBe(false);
    }

    // A spare master swapped for an LP-balance node at balanceOf's lock, its head relinked to the node: as many
    // outputs of the pair's category as before, each at a lock the pair's genesis names.
    const signature = layout.collections!.find((collection) => collection.name === "balanceOf")!.signature!;
    const balanceLock = entryRecordLockingBytecode(categoryId, signature);
    const swapped = outputs();
    const masterAt = swapped.findIndex((output) => ofCategory(output, category)
      && output.token!.nft?.capability === "minting");
    const masterOutput = swapped[masterAt]!;
    swapped.splice(masterAt, 1);
    const headAt = swapped.findIndex((output) => bytesEqual(output.lockingBytecode, balanceLock));
    const slot = new Uint8Array(32).fill(0x42);
    const head = swapped[headAt]!;
    swapped[headAt] = withCommitment(head, encodeEntryCommitment(new Uint8Array(32), slot, new Uint8Array(64)));
    swapped.push(withCommitment({ ...head },
      encodeEntryCommitment(slot, new Uint8Array(32), encodePushdataValue(10n ** 30n, "uint256"))));
    expect(countOfK(swapped)).toBe(countOfK(outputs()));
    expect(factoryAccepts(swapped)).toBe(false);

    // The validator dropped, a master doubled, a master dropped, and the authhead naming the composer.
    const validator = (output: TxOutput): boolean => ofCategory(output, category)
      && output.token!.nft?.capability === "mutable" && commitmentOf(output).length === 0;
    expect(outputs().filter(validator)).toHaveLength(PAIR_POOL.validators);
    expect(factoryAccepts(outputs().filter((output) => !validator(output)))).toBe(false);
    const doubled = outputs();
    doubled.splice(masterAt, 0, { ...masterOutput });
    expect(factoryAccepts(doubled)).toBe(false);
    expect(factoryAccepts(outputs().filter((_output, index) => index !== masterAt))).toBe(false);
    const authheadAt = outputs().findIndex((output) => ofCategory(output, category)
      && bytesEqual(commitmentOf(output), callerLock));
    const owned = outputs();
    owned[authheadAt] = withCommitment(owned[authheadAt]!, attacker);
    expect(factoryAccepts(owned)).toBe(false);

    // The honest outputs from a coin that is not output 0 of its transaction: its txid may be a category an earlier
    // genesis minted to the composer, so the pair's category would not be the creation's alone.
    const originAt = result.transaction.inputs.findIndex((input) => bytesEqual(input.outpointTransactionHash, category)
      || bytesEqual(Uint8Array.from(input.outpointTransactionHash).reverse(), category));
    expect(result.transaction.inputs[originAt]!.outpointIndex).toBe(0);
    expect(factoryAccepts(outputs(), result.transaction.inputs.map((input, index) => (index === originAt
      ? { ...input, outpointIndex: 1 } : input)))).toBe(false);
  }, 600_000);
});
