import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
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

describe('a loop over targets followed by a pointer call', () => {
  const callee = trivialCallee([7n]);
  const T = callee.lock;
  const SEL = hexToBin('00000000');
  const OP_TRUE = hexToBin('51');

  /**
   * `C().run([T], p, 7)` with the loop's callee input at `base` and the pointer resolved to `T` at witness index
   * `ptrIdx`. `callees` are co-spent from input 1 on, each re-created as the output at its own index.
   */
  async function spend(base: bigint, ptrIdx: bigint, callees: Uint8Array[]): Promise<TransactionBuilder> {
    const provider = createTestProvider();
    const contract = new Contract(compileString(LOOP_THEN_PTR), [], { provider });
    const funder = await createFeeFunder(provider, 10000n);
    const builder = new TransactionBuilder({ provider });
    builder.addInput({ txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n }, contract.unlock.run(
      encodePushdataValue([T], 'address[]'), T, SEL, 7n, base, SEL, ptrIdx, -1n,
    ) as never);
    callees.forEach((lock, at) => builder.addInput({ txid: `0${at + 1}`.repeat(32), vout: 0, satoshis: 1500n }, {
      generateLockingBytecode: (): Uint8Array => lock,
      generateUnlockingBytecode: (): Uint8Array => callee.unlocking,
    } as never));
    builder.addInput(funder.utxo, funder.unlocker);
    builder.addOutput({ to: contract.address, amount: 100000n });
    for (const lock of callees) builder.addOutput({ to: lock, amount: 1500n });
    builder.addOutput({ to: OP_TRUE, amount: 7000n });
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
const LOOP_FIXED_PTR = `pragma solidcash >=0.8.0;
interface IFoo { function m(int x) external; }
contract C(address a) {
  function run(address[] ts, function(int) external p, int x) {
    for (uint i = 0; i < ts.length; i++) { IFoo(ts[i]).m(x); }
    IFoo(a).m(x);
    p(x);
  }
}`;

describe('a loop, a fixed call, then a pointer call', () => {
  const callee = trivialCallee([7n]);
  const A = callee.lock;                                  // the fixed call's target (constructor arg a)
  const X = Uint8Array.of(...callee.lock, 0x61);          // a distinct loop target
  const P = Uint8Array.of(...callee.lock, 0x61, 0x61);    // a distinct honest pointer target
  const SEL = hexToBin('00000000');
  const OP_TRUE = hexToBin('51');

  /** `C(A).run([X], p, 7)`: loop callee at base, fixed call at base+1, pointer resolved to `pTarget` at `ptrIdx`. */
  async function spend(pTarget: Uint8Array, ptrIdx: bigint, callees: Uint8Array[]): Promise<TransactionBuilder> {
    const provider = createTestProvider();
    const contract = new Contract(compileString(LOOP_FIXED_PTR), [A], { provider });
    const funder = await createFeeFunder(provider, 10000n);
    const builder = new TransactionBuilder({ provider });
    builder.addInput({ txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n }, contract.unlock.run(
      encodePushdataValue([X], 'address[]'), pTarget, SEL, 7n, 1n, SEL, ptrIdx, -1n, -1n,
    ) as never);
    callees.forEach((lock, at) => builder.addInput({ txid: `0${at + 1}`.repeat(32), vout: 0, satoshis: 1500n }, {
      generateLockingBytecode: (): Uint8Array => lock,
      generateUnlockingBytecode: (): Uint8Array => callee.unlocking,
    } as never));
    builder.addInput(funder.utxo, funder.unlocker);
    builder.addOutput({ to: contract.address, amount: 100000n });
    for (const lock of callees) builder.addOutput({ to: lock, amount: 1500n });
    builder.addOutput({ to: OP_TRUE, amount: 7000n });
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
