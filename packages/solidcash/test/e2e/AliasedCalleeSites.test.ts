import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { compileString, compileStringMulti } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos, verifyTransaction } from '../test-util.js';
import { trivialCallee } from '../trivial-callee.js';
import { SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';

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

// A loop's callee input follows the index its target reads, which need not be the loop counter.
const PICKED = `pragma solidcash >=0.8.0;
interface IFoo { function m(int x) external; }
contract C {
  function run(address[] ts, uint[] which, int x) {
    for (uint i = 0; i < which.length; i++) { IFoo(ts[which[i]]).m(x); }
  }
}`;

describe('loop iterations naming one callee', () => {
  const callee = trivialCallee([7n]);
  const A = callee.lock;
  const OP_TRUE = hexToBin('51');

  async function spend(which: bigint[], callees: Uint8Array[]): Promise<TransactionBuilder> {
    const provider = createTestProvider();
    const contract = new Contract(compileString(PICKED), [], { provider });
    const funder = await createFeeFunder(provider, 10000n);
    const builder = new TransactionBuilder({ provider });
    builder.addInput({ txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n }, contract.unlock.run(
      encodePushdataValue([A, A], 'address[]'), encodePushdataValue(which, 'uint256[]'), 7n, 1n,
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

  it('run one callee input per iteration', async () => {
    verifyTransaction(await spend([0n, 1n], [A, A]));
  });

  it('refuse two iterations sharing one callee run', async () => {
    // which = [0, 0]: both iterations name input 1, so one run of A would serve both.
    const forged = await spend([0n, 0n], [A]);
    expect(() => verifyTransaction(forged)).toThrow();
  });
});

// A loop over a state array verifies each element once after the loop.
const PUBLISHER = `pragma solidcash >=0.8.0;
interface ISubscriber { public bigint received; function handle(uint256 value); }
contract Publisher() {
  address[] subscribers;
  int count;
  function setSubscribers(address a, address b, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    this.subscribers = [a, b];
  }
  function notifySome(uint256[] which, uint256 value, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    for (uint256 i = 0; i < which.length; i = i + 1) {
      ISubscriber(subscribers[which[i]]).handle(value);
      this.count = this.count + 1;
    }
  }
}`;
const SUBSCRIBER = `pragma solidcash >=0.8.0;
contract Subscriber() {
  bigint received;
  function handle(uint256 value) {
    this.received = this.received + int(value);
    require(int(value) >= 0);
  }
}`;

describe('a loop over a state array of callees', () => {
  async function deployed(): Promise<{ publisher: any; subscribers: any[] }> {
    const provider = createTestProvider();
    const sub = compileString(SUBSCRIBER);
    const subscribers: { lock: string; sc: StatefulContract<any> }[] = [];
    for (let at = 0; at < 2; at++) {
      const base = new Contract(sub, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, base, sub.stateLayout!, { received: 0n }, { saltContract: true },
      );
      subscribers.push({ lock: base.withCategory(hexToBin(categoryId)).lockingBytecode,
        sc: StatefulContract.withCategory(base, categoryId) });
    }
    const pub = compileString(PUBLISHER);
    const base = new Contract(pub, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, base, pub.stateLayout!, { subscribers: [], count: 0n }, { saltContract: true },
    );
    const publisher = StatefulContract.withCategory(base, categoryId) as any;
    await publisher.setSubscribers(hexToBin(subscribers[0]!.lock), hexToBin(subscribers[1]!.lock), alicePub,
      new SignatureTemplate(alicePriv)).send();
    publisher.registerExternalArray('ISubscriber', subscribers.map((subscriber) => subscriber.sc));
    return { publisher, subscribers: subscribers.map((subscriber) => subscriber.sc) };
  }

  it('calls each element once, in order', async () => {
    const { publisher, subscribers } = await deployed();
    await publisher.notifySome([0n, 1n], 10n, alicePub, new SignatureTemplate(alicePriv)).send();
    expect((await publisher.getState()).count).toBe(2n);
    for (const subscriber of subscribers) expect((await subscriber.getState()).received).toBe(10n);
  }, 300_000);

  it('refuses a body call past the array\'s last element', async () => {
    // Two subscribers: a third call has no element, so no callee run, where Solidity would revert.
    const { publisher } = await deployed();
    await expect(publisher.notifySome([0n, 1n, 2n], 10n, alicePub, new SignatureTemplate(alicePriv)).send())
      .rejects.toThrow();
    expect((await publisher.getState()).count).toBe(0n);
  }, 300_000);

  it('refuses a body that calls one element twice', async () => {
    // Each element runs once after the loop, so the second call on element 0 would have no run of its own.
    const { publisher, subscribers } = await deployed();
    await expect(publisher.notifySome([0n, 0n], 10n, alicePub, new SignatureTemplate(alicePriv)).send())
      .rejects.toThrow();
    expect((await publisher.getState()).count).toBe(0n);
    expect((await subscribers[0].getState()).received).toBe(0n);
  }, 300_000);
});

// A table of received function-pointer values (address and selector) checks its callees once each after the loop.
const HANDLER = `pragma solidcash >=0.8.0;
interface IH { public bigint counter; function inc(uint256 v); function dec(uint256 v); }
contract Handler() is IH {
  bigint counter;
  function inc(uint256 v) { this.counter = this.counter + int(v); require(int(v) >= 0); }
  function dec(uint256 v) { this.counter = this.counter - int(v); require(int(v) >= 0); }
}`;
const TABLE = `pragma solidcash >=0.8.0;
contract Table() {
  function(uint256) external[] fns;
  bigint bumps;
  function reg(function(uint256) external p, pubkey pk, sig s) {
    require(checkSig(s, pk)); this.fns.push(p); this.bumps = this.bumps + 1;
  }
  function fireN(uint256 n, uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    for (uint256 i = 0; i < n; i = i + 1) { fns[i](v); }
    this.bumps = this.bumps + 1;
  }
  function fireSome(uint256[] which, uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    for (uint256 i = 0; i < which.length; i = i + 1) { fns[which[i]](v); }
    this.bumps = this.bumps + 1;
  }
  function fireFirst(uint256 m, uint256 v) internal { for (uint256 i = 0; i < m; i = i + 1) { fns[i](v); } }
  function fireNested(uint256 n, uint256 m, uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    for (uint256 k = 0; k < n; k = k + 1) { fireFirst(m, v); }
    this.bumps = this.bumps + 1;
  }
}`;

describe('a loop over a table of function pointers', () => {
  async function deployed(): Promise<{ table: any; handlers: any[] }> {
    const provider = createTestProvider();
    const handler = compileString(HANDLER);
    const inc = hexToBin(handler.abi.find((entry) => entry.name === 'inc')!.selector!);
    const handlers: { lock: string; sc: StatefulContract<any> }[] = [];
    for (let at = 0; at < 2; at++) {
      const base = new Contract(handler, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, base, handler.stateLayout!, { counter: 0n }, { saltContract: true },
      );
      handlers.push({ lock: base.withCategory(hexToBin(categoryId)).lockingBytecode,
        sc: StatefulContract.withCategory(base, categoryId) });
    }
    const artifact = compileString(TABLE);
    const base = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, { fns: [], __fnsel_fns: [], bumps: 0n }, { saltContract: true },
    );
    const table = StatefulContract.withCategory(base, categoryId) as any;
    for (const entry of handlers) {
      await table.reg(hexToBin(entry.lock), inc, alicePub, new SignatureTemplate(alicePriv)).send();
    }
    const pointer = artifact.abi.find((entry) => entry.name === 'fireN')!.externalCalls![0]!.interfaceName;
    table.registerExternalArray(pointer, handlers.map((entry) => entry.sc), ['inc', 'inc']);
    return { table, handlers: handlers.map((entry) => entry.sc) };
  }

  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('calls each pointer once, in order', async () => {
    const { table, handlers } = await deployed();
    await table.fireN(2n, 3n, alicePub, sig()).send();
    for (const handler of handlers) expect((await handler.getState()).counter).toBe(3n);
    const again = await deployed();
    await again.table.fireSome([0n, 1n], 3n, alicePub, sig()).send();
    for (const handler of again.handlers) expect((await handler.getState()).counter).toBe(3n);
  }, 300_000);

  it('refuses a broadcast that stops early, skips a pointer or runs past the end', async () => {
    // Every pointer's callee runs once after the loop, so the calls must take each pointer in turn. Two pointers: a
    // third call has no pointer, where Solidity would revert.
    const { table, handlers } = await deployed();
    await expect(table.fireN(1n, 3n, alicePub, sig()).send()).rejects.toThrow();
    await expect(table.fireSome([1n], 3n, alicePub, sig()).send()).rejects.toThrow();
    await expect(table.fireN(3n, 3n, alicePub, sig()).send()).rejects.toThrow();
    for (const handler of handlers) expect((await handler.getState()).counter).toBe(0n);
  }, 300_000);

  it('refuses two calls through one pointer, directly or through a helper in a loop', async () => {
    // Each pointer's callee runs once after the loop, so a second call on pointer 0 would share its run.
    const { table, handlers } = await deployed();
    await expect(table.fireSome([0n, 0n], 3n, alicePub, sig()).send()).rejects.toThrow();
    await expect(table.fireNested(2n, 1n, 3n, alicePub, sig()).send()).rejects.toThrow();
    expect((await handlers[0].getState()).counter).toBe(0n);
  }, 300_000);
});
