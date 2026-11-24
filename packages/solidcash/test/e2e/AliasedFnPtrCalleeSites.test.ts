import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { callRecordDigest } from '../../src/stateful/call-record.js';
import { createFeeFunder, createTestProvider, verifyTransaction } from '../test-util.js';
import { trivialCallee } from '../trivial-callee.js';

/**
 * A function-pointer external call resolves its co-spent callee by a spender-supplied witness input index. That index
 * was not compared with the fixed-offset inputs of a function that also loops over targets, so a pointer whose target
 * equals one of the loop's targets could name the loop's callee input: one callee run would serve both the loop
 * iteration and the pointer call (the "two call sites on one callee run" family, residual over function pointers).
 */

// A loop over a parameter address array, then a single call through a received function pointer.
const LOOP_THEN_PTR = `pragma solidcash >=0.8.0;
interface IFoo { function m(int x) external; }
contract C {
  function run(address[] ts, function(int) external p, int x) {
    for (uint i = 0; i < ts.length; i++) { IFoo(ts[i]).m(x); }
    p(x);
  }
}`;

// A pointer's call reads its callee's void record, `digest || 01`, by the digest of the selector the pointer holds,
// its reader and its argument. The spends lay it out for the stand-in callee: an `OP_TRUE` carrier of the category
// whose minting token each callee coin holds, and ahead of the argument the stand-in pushes the record's output and
// the reader, input 0, as a record-sound callee does.
const category = 'ab'.repeat(32);
const minting = { category, amount: 0n, nft: { capability: 'minting' as const, commitment: '' } };
type RecordToken = { category: string; amount: bigint; nft: { capability: 'none'; commitment: string } };
const recordOf = (selector: Uint8Array): RecordToken => {
  const digest = callRecordDigest({ inputs: [{ name: 'x', type: 'int' }], selector: binToHex(selector) }, [7n],
    { namesReader: true }, 0, 0)!;
  return { category, amount: 0n, nft: { capability: 'none', commitment: `${binToHex(digest)}01` } };
};

describe('a loop over targets followed by a pointer call', () => {
  const SEL = hexToBin('00000000');
  const OP_TRUE = hexToBin('51');
  /** A single-method stand-in: the pointer's record output, the reader 0 and the argument 7. */
  const calleeFor = (carrier: number): ReturnType<typeof trivialCallee> => trivialCallee([7n, 0n, BigInt(carrier)]);
  const T = calleeFor(0).lock;

  /**
   * `C().run([T], p, 7)` with the loop's callee input at `base` and the pointer resolved to `T` at witness index
   * `ptrIdx`. `callees` are co-spent from input 1 on, each re-created as the output at its own index.
   */
  async function spend(base: bigint, ptrIdx: bigint, callees: Uint8Array[]): Promise<TransactionBuilder> {
    const provider = createTestProvider();
    const contract = new Contract(compileString(LOOP_THEN_PTR), [], { provider });
    const funder = await createFeeFunder(provider, 10000n);
    const builder = new TransactionBuilder({ provider });
    const carrier = callees.length + 2;
    const callee = calleeFor(carrier);
    builder.addInput({ txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n }, contract.unlock.run(
      encodePushdataValue([T], 'address[]'), T, SEL, 7n, base, SEL, ptrIdx, -1n, BigInt(carrier),
    ) as never);
    callees.forEach((lock, at) => builder.addInput({
      txid: `0${at + 1}`.repeat(32), vout: 0, satoshis: 1500n, token: minting,
    }, {
      generateLockingBytecode: (): Uint8Array => lock,
      generateUnlockingBytecode: (): Uint8Array => callee.unlocking,
    } as never));
    builder.addInput(funder.utxo, funder.unlocker);
    builder.addOutput({ to: contract.address, amount: 100000n });
    for (const lock of callees) builder.addOutput({ to: lock, amount: 1500n, token: minting });
    builder.addOutput({ to: OP_TRUE, amount: 6000n });
    builder.addOutput({ to: OP_TRUE, amount: 1000n, token: recordOf(SEL) });
    return builder;
  }

  it('runs the loop iteration and the pointer call on one callee input each', async () => {
    // Loop callee at input 1 (base 1), pointer callee at input 2: two co-spent runs of T.
    verifyTransaction(await spend(1n, 2n, [T, T]));
  });

  it('refuses a pointer call that names the loop iteration\'s callee input', async () => {
    // The loop's callee (input 1) and the pointer (ptrIdx 1) are one input, so one run of T would serve both.
    const forged = await spend(1n, 1n, [T]);
    expect(() => verifyTransaction(forged)).toThrow();
  });
});

// A loop over targets, then a fixed call on a constructor address, then a single pointer call: the pointer's witness
// must also differ from the fixed call's fixed-offset input (the fixed call keeps no witness in a loop function).
// The loop's call checks its selector; the fixed call and the pointer's read their callee's void records, which the
// spend lays out for the stand-in callees.
const LOOP_FIXED_PTR = `pragma solidcash >=0.8.0;
interface IFoo { function m(int x) external; function n() external; }
contract C(address a) {
  function run(address[] ts, function(int) external p, int x) {
    for (uint i = 0; i < ts.length; i++) { IFoo(ts[i]).m(x); }
    IFoo(a).m(x);
    p(x);
  }
}`;

describe('a loop, a fixed call, then a pointer call', () => {
  const M = hexToBin(compileString(`pragma solidcash >=0.8.0;
    contract D() { bigint c; function m(int x) { this.c = this.c + x; } function n() { this.c = this.c + 1; } }`)
    .abi.find((entry) => entry.name === 'm')!.selector!);
  /** A two-method stand-in: the selector M, the pointer's record output, the reader 0 and the argument 7. */
  const calleeFor = (carrier: number): ReturnType<typeof trivialCallee> => trivialCallee([7n, 0n, BigInt(carrier)], M);
  const A = calleeFor(0).lock;                            // the fixed call's target (constructor arg a)
  const X = Uint8Array.of(...A, 0x61);                    // a distinct loop target
  const P = Uint8Array.of(...A, 0x61, 0x61);              // a distinct honest pointer target
  const OP_TRUE = hexToBin('51');

  /** `C(A).run([X], p, 7)`: loop callee at base, fixed call at base+1, pointer resolved to `pTarget` at `ptrIdx`. */
  async function spend(pTarget: Uint8Array, ptrIdx: bigint, callees: Uint8Array[]): Promise<TransactionBuilder> {
    const provider = createTestProvider();
    const contract = new Contract(compileString(LOOP_FIXED_PTR), [A], { provider });
    const funder = await createFeeFunder(provider, 10000n);
    const builder = new TransactionBuilder({ provider });
    // The fixed call's record, then the pointer's, after the callees' outputs and the change.
    const carrier = callees.length + 2;
    const callee = calleeFor(carrier + 1);
    builder.addInput({ txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n }, contract.unlock.run(
      encodePushdataValue([X], 'address[]'), pTarget, M, 7n, 1n, M, M, ptrIdx, -1n, -1n, BigInt(carrier),
      BigInt(carrier + 1),
    ) as never);
    callees.forEach((lock, at) => builder.addInput({
      txid: `0${at + 1}`.repeat(32), vout: 0, satoshis: 1500n, token: minting,
    }, {
      generateLockingBytecode: (): Uint8Array => lock,
      generateUnlockingBytecode: (): Uint8Array => callee.unlocking,
    } as never));
    builder.addInput(funder.utxo, funder.unlocker);
    builder.addOutput({ to: contract.address, amount: 100000n });
    for (const lock of callees) builder.addOutput({ to: lock, amount: 1500n, token: minting });
    builder.addOutput({ to: OP_TRUE, amount: 5000n });
    builder.addOutput({ to: OP_TRUE, amount: 1000n, token: recordOf(M) });
    builder.addOutput({ to: OP_TRUE, amount: 1000n, token: recordOf(M) });
    return builder;
  }

  it('runs the loop, the fixed call and the pointer call on one callee input each', async () => {
    // Loop callee X at input 1, fixed callee A at input 2, pointer callee P at input 3.
    verifyTransaction(await spend(P, 3n, [X, A, P]));
  });

  it('refuses a pointer call that names the fixed call\'s callee input', async () => {
    // The pointer resolves to A (the fixed call's target) and names input 2 (base+1), the fixed call's own input, so
    // one run of A would serve both. The loop is at input 1, so the loop/pointer check does not catch this.
    const forged = await spend(A, 2n, [X, A]);
    expect(() => verifyTransaction(forged)).toThrow();
  });
});
