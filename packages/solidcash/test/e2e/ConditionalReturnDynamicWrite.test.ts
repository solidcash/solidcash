import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeTransaction, hash256, hexToBin,
} from '@bitauth/libauth';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { compileString } from '../direct-compile.js';

// A dynamic write after a returning external call is placed after that call's return event. A conditional call
// whose branch is not taken publishes no event (its return index is -1), so the run is anchored on the last
// call that did publish, or follows the caller's own block when none did.
const HANDLER = `pragma solidcash >=0.8.0;
contract RetHandler() { bigint counter;
  function inc(uint256 v) returns (uint256) {
    this.counter = this.counter + int(v); require(int(v) >= 0); return uint256(this.counter); } }`;

const ONE_CALL = `pragma solidcash >=0.8.0;
interface IR { function inc(uint256 v) returns (uint256); }
contract OneCall() { int[] a; address target; bigint last;
  function fire(uint256 v, bool call) {
    if (call) { this.last = int(IR(target).inc(v)); }
    this.a.push(int(v));
    require(int(v) >= 0);
  } }`;

const TWO_CALLS = `pragma solidcash >=0.8.0;
interface IR { function inc(uint256 v) returns (uint256); }
contract TwoCalls() { int[] a; address first; address second; bigint last;
  function fire(uint256 v, bool call) {
    if (call) { this.last = int(IR(first).inc(v)); }
    if (call) { this.last = this.last + int(IR(second).inc(v)); }
    this.a.push(int(v));
    require(int(v) >= 0);
  } }`;

// The second call only checks its result, so the caller's state is the same whether or not it is made.
const FIRST_OR_BOTH = `pragma solidcash >=0.8.0;
interface IR { function inc(uint256 v) returns (uint256); }
contract FirstOrBoth() { int[] a; address first; address second; bigint last;
  function fire(uint256 v, bool callFirst, bool callSecond) {
    if (callFirst) { this.last = int(IR(first).inc(v)); }
    if (callSecond) { require(IR(second).inc(v) > 0); }
    this.a.push(int(v));
    require(int(v) >= 0);
  } }`;

type Sent = { hex: string; send: (hex: string) => Promise<string> };

// Builds and verifies the call without broadcasting it, so the transaction can be replayed with its chunk moved.
const capture = async (provider: any, call: () => Promise<unknown>): Promise<Sent> => {
  const send = provider.sendRawTransaction.bind(provider);
  let hex = '';
  provider.sendRawTransaction = async (raw: string): Promise<string> => {
    hex = raw;
    return binToHex(hash256(hexToBin(raw)).reverse());
  };
  try {
    await call();
  } finally {
    provider.sendRawTransaction = send;
  }
  expect(hex).not.toBe('');
  return { hex, send };
};

// The caller's chunk sits one output earlier than the change output that ends the transaction. Swapping the two
// moves only the chunk off the coordinate the caller's covenant computes; every other output stays in place.
const refusesMovedChunk = async ({ hex, send }: Sent, chunkIndex: number): Promise<void> => {
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  expect(tx.outputs[chunkIndex].token?.nft?.capability).toBe('mutable');
  expect(tx.outputs[chunkIndex + 1].token).toBeUndefined();
  [tx.outputs[chunkIndex], tx.outputs[chunkIndex + 1]] = [tx.outputs[chunkIndex + 1], tx.outputs[chunkIndex]];
  await expect(send(binToHex(encodeTransaction(tx)))).rejects.toThrow(/input index 0/);
  await expect(send(hex)).resolves.toBeTypeOf('string');
};

describe('dynamic write after a conditional returning call', () => {
  const deploy = async (provider: any, source: string, state: Record<string, unknown>): Promise<any> => {
    const artifact = compileString(source);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, state, { saltContract: true },
    );
    const bound = contract.withCategory(hexToBin(categoryId));
    return {
      sc: StatefulContract.withCategory(contract, categoryId),
      addr: hexToBin(bound.lockingBytecode),
      bound,
      categoryId,
    };
  };

  it('one call: settles when it runs and when it is skipped, and refuses a moved chunk either way', async () => {
    const provider = createTestProvider();
    const handler = await deploy(provider, HANDLER, { counter: 40n });
    const caller = await deploy(provider, ONE_CALL, { a: [], target: handler.addr, last: 0n });

    // Runs: master, data x2, callee master, callee data, return event, chunk, change. D49 gives the unbounded
    // `a` array a data NFT of its own, beside the scalar record.
    const ran = await capture(provider, () => caller.sc.fire(2n, true).withExternalCall(handler.sc, 'inc', [2n]).send());
    await refusesMovedChunk(ran, 6);
    expect((await caller.sc.getState()).last).toBe(42n);
    expect((await caller.sc.getState()).a).toEqual([2n]);

    // Skipped: master, data x2, chunk, change. The anchoring call's return index is -1.
    const skipped = await capture(provider, () => caller.sc.fire(3n, false).send());
    await refusesMovedChunk(skipped, 3);
    expect((await caller.sc.getState()).a).toEqual([2n, 3n]);
    expect((await caller.sc.getState()).last).toBe(42n);
    expect((await handler.sc.getState()).counter).toBe(42n);
  });

  // The SDK co-spends a function's calls together or not at all, so the transaction in which the last returning
  // call is skipped while an earlier one runs is assembled here from the one in which both run: the second
  // callee's inputs, outputs and return event are removed and the caller states that call as not made.
  it('two calls: anchors on the earlier call when only the last one is skipped', async () => {
    const provider = createTestProvider();
    const first = await deploy(provider, HANDLER, { counter: 40n });
    const second = await deploy(provider, HANDLER, { counter: 100n });
    const caller = await deploy(provider, FIRST_OR_BOTH, {
      a: [], first: first.addr, second: second.addr, last: 0n,
    });
    const both = await capture(provider, () => caller.sc.fire(2n, true, true)
      .withExternalCall(first.sc, 'inc', [2n])
      .withExternalCall(second.sc, 'inc', [2n]).send());

    const tx = decodeTransactionUnsafe(hexToBin(both.hex));
    const ofCategory = (category: string) => (output: (typeof tx.outputs)[number]): boolean =>
      output.token !== undefined && [category, binToHex(hexToBin(category).reverse())]
        .includes(binToHex(output.token.category));
    // A P2SH32 input's locking bytecode is the hash of the redeem script its unlocking bytecode ends with.
    const lockOf = (input: (typeof tx.inputs)[number]): string => {
      const instructions = decodeAuthenticationInstructions(input.unlockingBytecode);
      const redeem = (instructions[instructions.length - 1] as { data?: Uint8Array }).data ?? new Uint8Array();
      return `aa20${binToHex(hash256(redeem))}87`;
    };
    const secondLocks = new Set([binToHex(second.addr), ...tx.outputs
      .filter((output) => ofCategory(second.categoryId)(output) && binToHex(output.lockingBytecode) !== '51')
      .map((output) => binToHex(output.lockingBytecode))]);
    const keptInputs = tx.inputs.filter((input) => !secondLocks.has(lockOf(input)));
    const keptOutputs = tx.outputs.filter((output) => !ofCategory(second.categoryId)(output));
    expect(tx.inputs.length - keptInputs.length).toBe(2);
    expect(tx.outputs.length - keptOutputs.length).toBe(3);
    tx.inputs = keptInputs;
    tx.outputs = keptOutputs;

    // The first callee keeps its block and its return event; the chunk now follows that event.
    const firstMaster = tx.inputs.findIndex((input) => lockOf(input) === binToHex(first.addr));
    const firstReturn = tx.outputs.findIndex((output) => ofCategory(first.categoryId)(output)
      && binToHex(output.lockingBytecode) === '51');
    expect([firstMaster, firstReturn]).toEqual([3, 5]);
    // The second call is stated as not made, and the chunk run follows the first call's return event.
    const witnesses: Record<string, bigint> = {
      __internal__externalCallInputBase: 2n,
      __internal__extcallMasterIdx0: BigInt(firstMaster),
      __internal__extcallMasterIdx1: -1n,
      __internal__extcallAnchorIdx0: -1n,
      __internal__extcallAnchorIdx1: -1n,
      __internal__externalReturnOutputIdx0: BigInt(firstReturn),
      __internal__externalReturnOutputIdx1: -1n,
      __internal__dynamicChunkOutputBase: BigInt(firstReturn + 1),
    };
    const fire = caller.bound.artifact.abi.find((entry: { name: string }) => entry.name === 'fire');
    const internal = fire.inputs.slice(3).map(({ name }: { name: string }) => {
      if (!(name in witnesses)) throw new Error(`no witness planned for ${name}`);
      return witnesses[name];
    });
    const unlocker = caller.bound.unlock.fire(2n, true, false, ...internal);
    tx.inputs[0].unlockingBytecode = unlocker.generateUnlockingBytecode({
      transaction: tx, sourceOutputs: [], inputIndex: 0,
    });
    const partial = binToHex(encodeTransaction(tx));
    await refusesMovedChunk({ hex: partial, send: both.send }, firstReturn + 1);
    expect((await caller.sc.getState()).last).toBe(42n);
    expect((await caller.sc.getState()).a).toEqual([2n]);
    expect((await first.sc.getState()).counter).toBe(42n);
    expect((await second.sc.getState()).counter).toBe(100n);
  });

  it('two calls: settles when both run and when both are skipped, and refuses a moved chunk either way', async () => {
    const provider = createTestProvider();
    const first = await deploy(provider, HANDLER, { counter: 40n });
    const second = await deploy(provider, HANDLER, { counter: 100n });
    const caller = await deploy(provider, TWO_CALLS, {
      a: [], first: first.addr, second: second.addr, last: 0n,
    });

    // Both run: the caller's master and two data NFTs, two callee blocks, two return events, then the chunk.
    const ran = await capture(provider, () => caller.sc.fire(2n, true)
      .withExternalCall(first.sc, 'inc', [2n])
      .withExternalCall(second.sc, 'inc', [2n]).send());
    await refusesMovedChunk(ran, 9);
    expect((await caller.sc.getState()).last).toBe(42n + 102n);
    expect((await caller.sc.getState()).a).toEqual([2n]);

    // Both skipped: every return index is -1, so the run follows the caller's own block.
    const skipped = await capture(provider, () => caller.sc.fire(3n, false).send());
    await refusesMovedChunk(skipped, 3);
    expect((await caller.sc.getState()).a).toEqual([2n, 3n]);
    expect((await first.sc.getState()).counter).toBe(42n);
    expect((await second.sc.getState()).counter).toBe(102n);
  });
});
