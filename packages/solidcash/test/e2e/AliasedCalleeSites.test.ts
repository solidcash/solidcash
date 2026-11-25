import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeAuthenticationInstructions,
  encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { compileString, compileStringMulti } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import {
  createFeeFunder, createTestProvider, expectScriptRejection, setupStatefulUtxos, verifyTransaction,
} from '../test-util.js';
import { standInToken, standInVoidRecord, trivialCallee } from '../trivial-callee.js';
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

// The loop's callee for iteration i sits at base + i, the call after it at base + 1. Each iteration and the call after
// the loop read their callee's void record, `digest || 0x01`, which the spend lays out for the stand-in callees: an
// `OP_TRUE` carrier of the category whose minting token each callee's coin holds.
const LOOP_THEN_CALL = `pragma solidcash >=0.8.0;
interface IFoo { function m(int x) external; function n() external; }
contract C(address a) {
  function run(address[] ts, int x) {
    for (uint i = 0; i < ts.length; i++) { IFoo(ts[i]).m(x); }
    IFoo(a).m(x);
  }
}`;

describe('a loop over targets followed by a call', () => {
  // Two stand-in callees running m(7): the call's own (A) and one more the loop may name (X).
  const M = hexToBin(compileString(`pragma solidcash >=0.8.0;
    contract D() { bigint c; function m(int x) { this.c = this.c + x; } function n() { this.c = this.c + 1; } }`)
    .abi.find((entry) => entry.name === 'm')!.selector!);
  const callee = trivialCallee([7n], M);
  const A = callee.lock;
  const X = Uint8Array.of(...callee.lock, 0x61);
  const OP_TRUE = hexToBin('51');

  /**
   * `C(A).run(loop, 7)` with `callees` co-spent from input 1 on, each coin holding the stand-in token; the loop's
   * records, then the call's, follow the change.
   */
  async function spend(loop: Uint8Array[], callees: Uint8Array[]): Promise<TransactionBuilder> {
    const provider = createTestProvider();
    const contract = new Contract(compileString(LOOP_THEN_CALL), [A], { provider });
    const funder = await createFeeFunder(provider, 10000n);
    const builder = new TransactionBuilder({ provider });
    const records = BigInt(callees.length + 2);
    builder.addInput({ txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n }, contract.unlock.run(
      encodePushdataValue(loop, 'address[]'), 7n, 1n, -1n, records, records + BigInt(loop.length),
    ) as never);
    callees.forEach((lock, at) => builder.addInput({
      txid: `0${at + 1}`.repeat(32), vout: 0, satoshis: 1500n, token: standInToken(),
    }, {
      generateLockingBytecode: (): Uint8Array => lock,
      generateUnlockingBytecode: (): Uint8Array => callee.unlocking,
    } as never));
    builder.addInput(funder.utxo, funder.unlocker);
    builder.addOutput({ to: contract.address, amount: 100000n });
    for (const lock of callees) builder.addOutput({ to: lock, amount: 1500n, token: standInToken() });
    builder.addOutput({ to: OP_TRUE, amount: 3000n });
    for (let record = 0; record <= loop.length; record += 1) builder.addOutput(standInVoidRecord(M, [7n]));
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
  const M = hexToBin(compileString(`pragma solidcash >=0.8.0;
    contract D() { bigint c; function m(int x) { this.c = this.c + x; } function n() { this.c = this.c + 1; } }`)
    .abi.find((entry) => entry.name === 'm')!.selector!);

  /** Each iteration reads its callee's void record at the return base plus the index its target reads. */
  async function spend(which: bigint[], callees: Uint8Array[]): Promise<TransactionBuilder> {
    const provider = createTestProvider();
    const contract = new Contract(compileString(PICKED), [], { provider });
    const funder = await createFeeFunder(provider, 10000n);
    const builder = new TransactionBuilder({ provider });
    builder.addInput({ txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n }, contract.unlock.run(
      encodePushdataValue([A, A], 'address[]'), encodePushdataValue(which, 'uint256[]'), 7n, 1n,
      BigInt(callees.length + 2),
    ) as never);
    callees.forEach((lock, at) => builder.addInput({
      txid: `0${at + 1}`.repeat(32), vout: 0, satoshis: 1500n, token: standInToken(),
    }, {
      generateLockingBytecode: (): Uint8Array => lock,
      generateUnlockingBytecode: (): Uint8Array => callee.unlocking,
    } as never));
    builder.addInput(funder.utxo, funder.unlocker);
    builder.addOutput({ to: contract.address, amount: 100000n });
    for (const lock of callees) builder.addOutput({ to: lock, amount: 1500n, token: standInToken() });
    builder.addOutput({ to: OP_TRUE, amount: 5000n });
    builder.addOutput(standInVoidRecord(M, [7n]));
    builder.addOutput(standInVoidRecord(M, [7n]));
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

  it('refuses a body that skips an element or stops before the last', async () => {
    // Every element's callee runs after the loop, so an element the body does not call would still run.
    const { publisher, subscribers } = await deployed();
    await expect(publisher.notifySome([1n], 10n, alicePub, new SignatureTemplate(alicePriv)).send()).rejects.toThrow();
    await expect(publisher.notifySome([0n], 10n, alicePub, new SignatureTemplate(alicePriv)).send()).rejects.toThrow();
    expect((await publisher.getState()).count).toBe(0n);
    for (const subscriber of subscribers) expect((await subscriber.getState()).received).toBe(0n);
  }, 300_000);
});

// A table of received pointers binds each call's arguments against the run of the element it calls.
const TALLY = `pragma solidcash >=0.8.0;
interface IT { public bigint calls; function hit(uint256 v); function other(uint256 v); }
contract Tally() is IT {
  bigint calls;
  function hit(uint256 v) { require(int(v) >= 0); this.calls = this.calls + 1; }
  function other(uint256 v) { require(int(v) >= 0); this.calls = this.calls + 2; }
}`;

const VARYING_TABLE = `pragma solidcash >=0.8.0;
interface IT { public bigint calls; function hit(uint256 v); function other(uint256 v); }
contract VaryingTable() {
  function(uint256) external[] fns;
  bigint bumps;
  function reg(address a, address b, pubkey pk, sig s) {
    require(checkSig(s, pk)); this.fns.push(IT(a).hit); this.fns.push(IT(b).other); this.bumps = this.bumps + 1;
  }
  function fireN(uint256 n, uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    for (uint256 i = 0; i < n; i = i + 1) { fns[i](v); }
    this.bumps = this.bumps + 1;
  }
}`;

describe('a call through a table of pointers', () => {
  async function tallies(provider: Provider): Promise<{ hit: Uint8Array; entries: { lock: string; sc: any }[] }> {
    const tally = compileString(TALLY);
    const entries: { lock: string; sc: any }[] = [];
    for (let at = 0; at < 2; at++) {
      const base = new Contract(tally, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, base, tally.stateLayout!, { calls: 0n }, { saltContract: true },
      );
      entries.push({ lock: base.withCategory(hexToBin(categoryId)).lockingBytecode,
        sc: StatefulContract.withCategory(base, categoryId) });
    }
    return { hit: hexToBin(tally.abi.find((entry) => entry.name === 'hit')!.selector!), entries };
  }

  /**
   * `fireN(2, 10)` built honestly, then with its first callee running on 5 where the call names 10: a callee's
   * unlocking ends `<v> <redeem>` and the table's `<v> <n> <redeem>`.
   */
  async function forgeFirstArgument(provider: Provider, table: any): Promise<{ honest: string; outcome: string }> {
    const send = provider.sendRawTransaction.bind(provider);
    let honest = '';
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      honest = hex;
      throw new Error('capture-only');
    };
    await expect(table.fireN(2n, 10n, alicePub, new SignatureTemplate(alicePriv)).send())
      .rejects.toThrow('capture-only');
    (provider as any).sendRawTransaction = send;
    const tx = decodeTransactionUnsafe(hexToBin(honest));
    const pushes = tx.inputs.map((input) => decodeAuthenticationInstructions(input.unlockingBytecode));
    const caller = pushes.findIndex((p) => p.at(-3)?.opcode === 0x5a && p.at(-2)?.opcode === 0x52);
    const callee = pushes.findIndex((p, at) => at !== caller && p.at(-2)?.opcode === 0x5a);
    expect(caller).toBeGreaterThanOrEqual(0);
    expect(callee).toBeGreaterThanOrEqual(0);
    pushes[callee]![pushes[callee]!.length - 2] = { opcode: 0x55 } as never;
    tx.inputs[callee]!.unlockingBytecode = encodeAuthenticationInstructions(pushes[callee]!);
    const outcome = await provider.sendRawTransaction(binToHex(encodeTransaction(tx)))
      .then(() => 'ACCEPTED').catch((e: Error) => e.message);
    expectScriptRejection(outcome, caller);
    return { honest, outcome };
  }

  it('refuses a received pointer\'s callee run on another argument', async () => {
    const provider = createTestProvider();
    const { hit, entries } = await tallies(provider);
    const artifact = compileString(TABLE);
    const base = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, { fns: [], __fnsel_fns: [], bumps: 0n }, { saltContract: true },
    );
    const table = StatefulContract.withCategory(base, categoryId) as any;
    for (const entry of entries) {
      await table.reg(hexToBin(entry.lock), hit, alicePub, new SignatureTemplate(alicePriv)).send();
    }
    const pointer = artifact.abi.find((entry) => entry.name === 'fireN')!.externalCalls![0]!.interfaceName;
    table.registerExternalArray(pointer, entries.map((entry) => entry.sc), ['hit', 'hit']);
    const { honest } = await forgeFirstArgument(provider, table);
    await provider.sendRawTransaction(honest);
    for (const entry of entries) expect((await entry.sc.getState()).calls).toBe(1n);
  }, 300_000);

  it('stores the selector of the overload of the table\'s type', async () => {
    // `hit(uint256, uint256)` declared first: the table holds hit(uint256), its type's overload, and binds it.
    const provider = createTestProvider();
    const { entries } = await tallies(provider);
    const hit = 'function hit(uint256 v);';
    const source = VARYING_TABLE.replace(hit, `function hit(uint256 v, uint256 w); ${hit}`);
    expect(source).not.toBe(VARYING_TABLE);
    const artifact = compileString(source);
    const base = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, { fns: [], __fnsel_fns: [], bumps: 0n }, { saltContract: true },
    );
    const table = StatefulContract.withCategory(base, categoryId) as any;
    await table.reg(hexToBin(entries[0]!.lock), hexToBin(entries[1]!.lock), alicePub,
      new SignatureTemplate(alicePriv)).send();
    table.registerExternalArray('IT', entries.map((entry) => entry.sc), ['hit', 'other']);
    const { honest } = await forgeFirstArgument(provider, table);
    await provider.sendRawTransaction(honest);
    expect((await entries[0]!.sc.getState()).calls).toBe(1n);
    expect((await entries[1]!.sc.getState()).calls).toBe(2n);
  }, 300_000);

  it('takes an interface\'s override as its parent\'s method, and refuses an overloaded selector', () => {
    const override = VARYING_TABLE.replace(
      'interface IT { public bigint calls; function hit(uint256 v); function other(uint256 v); }',
      'interface IBase { function hit(uint256 v); function other(uint256 v); }\n'
        + 'interface IT is IBase { public bigint calls; function hit(uint256 v); }',
    );
    expect(override).not.toBe(VARYING_TABLE);
    expect(() => compileString(override)).not.toThrow();
    const selector = `pragma solidcash >=0.8.0;
interface IT { function hit(uint256 v, uint256 w); function hit(uint256 v); }
contract S() { function s() { require(bytes4(IT.hit.selector) != 0x00000000); } }`;
    expect(() => compileString(selector)).toThrow(/is overloaded: its selector does not name one method/);
    // A contract's internal overload is no method another contract calls.
    const internal = `pragma solidcash >=0.8.0;
contract Tally() {
  bigint c;
  function m(uint256 v, uint256 w) public { this.c = this.c + 1; require(v + w >= 0); }
  function m(uint256 v) internal { require(v >= 0); }
}
contract T() {
  function(uint256) external[] fns;
  function reg(address a) { this.fns.push(Tally(a).m); }
  function fire(uint256 v) { for (uint256 i = 0; i < fns.length; i = i + 1) { fns[i](v); } }
}`;
    expect(() => compileString(internal)).toThrow(/does not name one method of the table's type/);
  });

  it('refuses a varying-method table\'s callee run on another argument', async () => {
    const provider = createTestProvider();
    const { entries } = await tallies(provider);
    const artifact = compileString(VARYING_TABLE);
    const base = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, { fns: [], __fnsel_fns: [], bumps: 0n }, { saltContract: true },
    );
    const table = StatefulContract.withCategory(base, categoryId) as any;
    await table.reg(hexToBin(entries[0]!.lock), hexToBin(entries[1]!.lock), alicePub,
      new SignatureTemplate(alicePriv)).send();
    table.registerExternalArray('IT', entries.map((entry) => entry.sc), ['hit', 'other']);
    const { honest } = await forgeFirstArgument(provider, table);
    await provider.sendRawTransaction(honest);
    expect((await entries[0]!.sc.getState()).calls).toBe(1n);
    expect((await entries[1]!.sc.getState()).calls).toBe(2n);
  }, 300_000);
});

// A table of fixed-method pointers lowers to an address array, whose callees run once each after the loop.
const COUNTER = `pragma solidcash >=0.8.0;
interface ICounter { public bigint counter; function increment(uint256 v); }
contract Counter() is ICounter {
  bigint counter;
  function increment(uint256 v) { this.counter = this.counter + int(v); require(int(v) >= 0); }
}`;
const FIXED_TABLE = `pragma solidcash >=0.8.0;
interface ICounter { public bigint counter; function increment(uint256 v); }
contract FixedTable() {
  function(uint256) external[] fns;
  bigint bumps;
  function register(address a, pubkey pk, sig s) {
    require(checkSig(s, pk)); this.fns.push(ICounter(a).increment); this.bumps = this.bumps + 1;
  }
  function fireN(uint256 n, uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    for (uint256 i = 0; i < n; i = i + 1) { fns[i](v); }
    this.bumps = this.bumps + 1;
  }
  function replaceFirst(address a, uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    fns[0] = ICounter(a).increment;
    for (uint256 i = 0; i < fns.length; i = i + 1) { fns[i](v); }
    this.bumps = this.bumps + 1;
  }
}`;

describe('a loop over a table of fixed-method pointers', () => {
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
  async function deployed(): Promise<{
    base: Contract; categoryId: string; table: any; counters: { sc: any; lock: string }[];
  }> {
    const provider = createTestProvider();
    const counter = compileString(COUNTER);
    const counters: { sc: any; lock: string }[] = [];
    for (const start of [5n, 20n, 100n]) {
      const c = new Contract(counter, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, c, counter.stateLayout!, { counter: start }, { saltContract: true },
      );
      counters.push({ sc: StatefulContract.withCategory(c, categoryId),
        lock: c.withCategory(hexToBin(categoryId)).lockingBytecode });
    }
    const artifact = compileString(FIXED_TABLE);
    const base = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, { fns: [], bumps: 0n }, { saltContract: true },
    );
    const table = StatefulContract.withCategory(base, categoryId) as any;
    for (const entry of counters.slice(0, 2)) await table.register(hexToBin(entry.lock), alicePub, sig()).send();
    return { base, categoryId, table, counters };
  }

  it('runs every pointer once, and refuses a loop that stops before the last', async () => {
    const { table, counters } = await deployed();
    table.registerExternalArray('ICounter', counters.slice(0, 2).map((entry) => entry.sc));
    await expect(table.fireN(1n, 3n, alicePub, sig()).send()).rejects.toThrow();
    expect((await counters[1]!.sc.getState()).counter).toBe(20n);
    await table.fireN(2n, 3n, alicePub, sig()).send();
    expect((await counters[0]!.sc.getState()).counter).toBe(8n);
    expect((await counters[1]!.sc.getState()).counter).toBe(23n);
  }, 300_000);

  it('runs the pointer a write before the loop put in place, not the one it replaced', async () => {
    const { base, categoryId, table, counters } = await deployed();
    const [c0, c1, c2] = counters as [{ sc: any; lock: string }, { sc: any; lock: string }, { sc: any; lock: string }];
    // The loop calls c2 and c1: a spend running the replaced c0 instead is refused.
    table.registerExternalArray('ICounter', [c0.sc, c1.sc]);
    await expect(table.replaceFirst(hexToBin(c2.lock), 3n, alicePub, sig()).send()).rejects.toThrow();
    const fresh = StatefulContract.withCategory(base, categoryId) as any;
    fresh.registerExternalArray('ICounter', [c2.sc, c1.sc]);
    await fresh.replaceFirst(hexToBin(c2.lock), 3n, alicePub, sig()).send();
    expect((await c0.sc.getState()).counter).toBe(5n);
    expect((await c1.sc.getState()).counter).toBe(23n);
    expect((await c2.sc.getState()).counter).toBe(103n);
  }, 300_000);

  it('counts a collection loop around the calls, and a pointer call, as places that write the array', () => {
    const contract = (decl: string, fn: string): string => `pragma solidcash >=0.8.0;
interface IL { public bigint heard; function hear(uint256 v); }
contract C() {
  address[] listeners;
  ${decl}
  function add(address a) { this.listeners.push(a); }
  ${fn}
}`;
    const insideCollection = contract('enumerable mapping(bytes20 => int) m;', `
  function go(address a, uint256 n, uint256 v) {
    for (bytes20 k in this.m) { for (uint256 i = 0; i < n; i = i + 1) { IL(listeners[i]).hear(v); } listeners[0] = a; }
  }`);
    const pointerBefore = contract('function(address) internal op;', `function setOp() { op = _push; }
  function _push(address a) internal { this.listeners.push(a); }
  function go(address a, uint256 v) {
    op(a);
    for (uint256 i = 0; i < listeners.length; i = i + 1) { IL(listeners[i]).hear(v); }
    this.listeners.push(a);
  }`);
    for (const source of [insideCollection, pointerBefore]) {
      expect(() => compileString(source, {})).toThrow(/LOOP_ARRAY_WRITTEN_AROUND_CALLS/);
    }
    // An overload of the writer's name hides no writer.
    const hiddenWriter = contract('function(address) internal op;', `function setOp() { op = _t; }
  function _t(address a) internal { _set(a); }
  function _set(address a) internal { this.listeners[0] = a; }
  function _set(address a, address b) internal { require(a != b); }
  function go(address a, uint256 v) {
    op(a);
    for (uint256 i = 0; i < listeners.length; i = i + 1) { IL(listeners[i]).hear(v); }
    _set(a);
  }`);
    expect(() => compileString(hiddenWriter, {})).toThrow(/LOOP_ARRAY_WRITTEN_AROUND_CALLS/);
  });

  it('refuses a table element whose method does not take the table\'s parameters', () => {
    const misfit = VARYING_TABLE.replace('function other(uint256 v);', 'function other(uint256 v, uint256 w);');
    expect(misfit).not.toBe(VARYING_TABLE);
    expect(() => compileString(misfit)).toThrow(/does not name one method of the table's type/);
  });

  it('refuses a loop over an array its function writes inside that loop', () => {
    const source = FIXED_TABLE.replace(
      'fns[0] = ICounter(a).increment;\n    for (uint256 i = 0; i < fns.length; i = i + 1) { fns[i](v); }',
      'for (uint256 i = 0; i < fns.length; i = i + 1) { fns[i](v); fns[i] = ICounter(a).increment; }',
    );
    expect(source).not.toBe(FIXED_TABLE);
    expect(() => compileString(source)).toThrow(/LOOP_ARRAY_WRITTEN_AROUND_CALLS/);
  });
});

// A void call on a state-array element binds the arguments it names against that element's callee run.
const NOTIFIER = `pragma solidcash >=0.8.0;
interface IListener { public bigint heard; function hear(uint256 value, uint256 tag); }
contract Notifier() {
  address[] listeners;
  int count;
  function setListeners(address a, address b, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    this.listeners = [a, b];
  }
  function notifyAll(uint256 value, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    for (uint256 i = 0; i < listeners.length; i = i + 1) { IListener(listeners[i]).hear(value, 7); }
    this.count = this.count + 1;
  }
}`;
const LISTENER = `pragma solidcash >=0.8.0;
contract Listener() {
  bigint heard;
  function hear(uint256 value, uint256 tag) {
    require(int(value) >= 0 && int(tag) >= 0);
    this.heard = this.heard + 1;
  }
}`;

describe('a void call on a state-array element', () => {
  /** Deploys `notifier`'s loop over two listeners, and refuses its first listener's run of hear(5, 7). */
  async function refusesForgedListener(notifierSource: string, listenerSource = LISTENER): Promise<void> {
    const provider = createTestProvider();
    const art = compileString(listenerSource);
    const listeners: { lock: string; sc: StatefulContract<any> }[] = [];
    for (let at = 0; at < 2; at++) {
      const base = new Contract(art, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, base, art.stateLayout!, { heard: 0n }, { saltContract: true },
      );
      listeners.push({ lock: base.withCategory(hexToBin(categoryId)).lockingBytecode,
        sc: StatefulContract.withCategory(base, categoryId) });
    }
    const notifierArt = compileString(notifierSource);
    const base = new Contract(notifierArt, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, base, notifierArt.stateLayout!, { listeners: [], count: 0n }, { saltContract: true },
    );
    const notifier = StatefulContract.withCategory(base, categoryId) as any;
    await notifier.setListeners(hexToBin(listeners[0]!.lock), hexToBin(listeners[1]!.lock), alicePub,
      new SignatureTemplate(alicePriv)).send();
    notifier.registerExternalArray('IListener', listeners.map((listener) => listener.sc));

    const send = provider.sendRawTransaction.bind(provider);
    let honest = '';
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      honest = hex;
      throw new Error('capture-only');
    };
    await expect(notifier.notifyAll(10n, alicePub, new SignatureTemplate(alicePriv)).send())
      .rejects.toThrow('capture-only');
    (provider as any).sendRawTransaction = send;

    // A listener's unlocking ends `<tag> <value> <redeem>`: the first one runs hear(5, 7) where the call names 10.
    const tx = decodeTransactionUnsafe(hexToBin(honest));
    const pushes = tx.inputs.map((input) => decodeAuthenticationInstructions(input.unlockingBytecode));
    const listener = pushes.findIndex((p) => p.at(-3)?.opcode === 0x57 && p.at(-2)?.opcode === 0x5a);
    const caller = pushes.findIndex((p) => (p.at(-3) as { data?: Uint8Array } | undefined)?.data?.length === 33);
    expect(listener).toBeGreaterThan(0);
    expect(caller).toBeGreaterThanOrEqual(0);
    pushes[listener]![pushes[listener]!.length - 2] = { opcode: 0x55 } as never;
    tx.inputs[listener]!.unlockingBytecode = encodeAuthenticationInstructions(pushes[listener]!);
    const outcome = await provider.sendRawTransaction(binToHex(encodeTransaction(tx)))
      .then(() => 'ACCEPTED').catch((e: Error) => e.message);
    // The caller reads its element's record, the digest of hear(10, 7) and its reader, in place of checking the
    // listener's pushes: the record it reads is the honest one, so the run of hear(5, 7) is refused at the listener,
    // whose own record would name that call. A record rewritten to name it answers no call the caller makes.
    expect(caller).toBeLessThan(listener);
    expectScriptRejection(outcome, listener);

    await provider.sendRawTransaction(honest);
    for (const entry of listeners) expect((await entry.sc.getState()).heard).toBe(1n);
    expect((await notifier.getState()).count).toBe(1n);
  }

  it('refuses an element\'s callee run on another argument', async () => {
    await refusesForgedListener(NOTIFIER);
  }, 300_000);

  it('binds the overload the call\'s argument count selects', async () => {
    // `hear(bytes)` declared first: the call still runs hear(uint256, uint256) and binds its arguments. An interface
    // of two functions checks its callee's selector, so this listener has two as well.
    const hear = 'function hear(uint256 value, uint256 tag);';
    const overloaded = NOTIFIER.replace(hear, `function hear(bytes b); ${hear}`);
    expect(overloaded).not.toBe(NOTIFIER);
    const listener = LISTENER.replace('this.heard = this.heard + 1;\n  }',
      'this.heard = this.heard + 1;\n  }\n  function ping() { require(this.heard >= 0); }');
    expect(listener).not.toBe(LISTENER);
    await refusesForgedListener(overloaded, listener);
  }, 300_000);

  it('refuses a call that does not select one overload by its argument count', () => {
    const hear = 'function hear(uint256 value, uint256 tag);';
    const ambiguous = NOTIFIER.replace(hear, `function hear(bytes b, uint256 t); ${hear}`);
    expect(ambiguous).not.toBe(NOTIFIER);
    expect(() => compileString(ambiguous)).toThrow(/has no single overload taking 2 argument/);
  });
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
