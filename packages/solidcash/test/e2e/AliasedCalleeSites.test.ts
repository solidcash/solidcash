import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { compileString, compileStringMulti } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos, verifyTransaction } from '../test-util.js';
import { trivialCallee } from '../trivial-callee.js';

/**
 * Two calls on different targets each claim their own callee input. Their targets are equal when the spender passes
 * one address twice, and each call's identity check binds its input only to its own target, so both calls accepted
 * one run of that callee: the caller counted two deposits for one.
 */

const SOURCE = `
interface ISink { function put(int x) external; }
contract Sink {
  int last;
  int runs;
  function put(int x) public { this.last = x; this.runs = this.runs + 1; }
}
contract Pair {
  int count;
  function both(address a, address b, int x) public {
    ISink(a).put(x);
    ISink(b).put(x);
    this.count = this.count + 2;
  }
}`;

type Provider = ReturnType<typeof createTestProvider>;

async function sink(provider: Provider, artifact: any): Promise<{ sc: StatefulContract<any>; address: Uint8Array }> {
  const base = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, base, artifact.stateLayout!, { last: 0n, runs: 0n }, { saltContract: true },
  );
  return {
    sc: StatefulContract.withCategory(base, categoryId),
    address: hexToBin(base.withCategory(hexToBin(categoryId)).lockingBytecode),
  };
}

async function deploy(): Promise<{ provider: Provider; pair: any; one: any; two: any }> {
  const provider = createTestProvider();
  const artifacts = compileStringMulti(SOURCE);
  const one = await sink(provider, artifacts.Sink);
  const two = await sink(provider, artifacts.Sink);
  const base = new Contract(artifacts.Pair, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, base, artifacts.Pair.stateLayout!, { count: 0n }, { saltContract: true },
  );
  return { provider, pair: StatefulContract.withCategory(base, categoryId), one, two };
}

describe('calls on different targets', () => {
  it('run on two callees, one input each', async () => {
    const { pair, one, two } = await deploy();
    await pair.both(one.address, two.address, 5n)
      .withExternalCall(one.sc, 'put', [5n]).withExternalCall(two.sc, 'put', [5n]).send();
    expect((await pair.getState()).count).toBe(2n);
    expect((await one.sc.getState()).runs).toBe(1n);
    expect((await two.sc.getState()).runs).toBe(1n);
  }, 300_000);

  it('refuse one callee run serving both when the spender passes one address twice', async () => {
    const { pair, one } = await deploy();
    // The SDK lays the one callee's master once and names it for both calls.
    await expect(pair.both(one.address, one.address, 5n)
      .withExternalCall(one.sc, 'put', [5n]).withExternalCall(one.sc, 'put', [5n]).send())
      .rejects.toThrow(/(preflight failed at input 0|VM failed at ip \d+ opcode \d+): Program failed an OP_VERIFY/);
    expect((await pair.getState()).count).toBe(0n);
    expect((await one.sc.getState()).runs).toBe(0n);
  }, 300_000);
});

// The loop's callee for iteration i sits at base + i, the call after it at base + 1.
const LOOP_THEN_CALL = `pragma solidcash >=0.8.0;
interface IFoo { function m(int x) external; }
contract C(address a) {
  function run(address[] ts, int x) {
    for (uint i = 0; i < ts.length; i++) { IFoo(ts[i]).m(x); }
    IFoo(a).m(x);
  }
}`;

describe('a loop over targets followed by a call', () => {
  // Two stand-in callees running m(7): the call's own (A) and one more the loop may name (X).
  const callee = trivialCallee([7n]);
  const A = callee.lock;
  const X = Uint8Array.of(...callee.lock, 0x61);
  const OP_TRUE = hexToBin('51');

  /** `C(A).run(loop, 7)` with `callees` co-spent from input 1 on. */
  async function spend(loop: Uint8Array[], callees: Uint8Array[]): Promise<TransactionBuilder> {
    const provider = createTestProvider();
    const contract = new Contract(compileString(LOOP_THEN_CALL), [A], { provider });
    const funder = await createFeeFunder(provider, 10000n);
    const builder = new TransactionBuilder({ provider });
    builder.addInput({ txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n },
      contract.unlock.run(encodePushdataValue(loop, 'address[]'), 7n, 1n, -1n) as never);
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

  it('runs one iteration, then the call on its own callee', async () => {
    verifyTransaction(await spend([X], [X, A]));
  });

  it('refuses a second iteration that takes the input of the call after the loop', async () => {
    // Iteration 1 and the call both name input 2, so one run of A would serve both.
    const forged = await spend([X, A], [X, A]);
    expect(() => verifyTransaction(forged)).toThrow();
  });
});
