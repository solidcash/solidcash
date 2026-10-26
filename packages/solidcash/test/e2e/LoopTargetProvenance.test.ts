import { describe, it, expect } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { createTestProvider, verifyTransaction, createFeeFunder } from '../test-util.js';
import { trivialCallee } from '../trivial-callee.js';

// A loop's per-iteration callee is read from a witness, since a loop-local receiver cannot reach the epilogue. Only a
// target the caller chooses (an element of a parameter) may be replaced by that witness; one the contract fixes keeps
// its on-chain value, which the witness must equal (packages/solidc/docs/array-external-calls.md).
const IFACE = 'interface IPair { function r0() external view returns (bigint); function r1() external view returns'
  + ' (bigint); function swap(int a) external; }';
const FIXED = `pragma solidcash >=0.8.0;
${IFACE}
contract Fixed(address a, address b) {
  function go() {
    address[2] memory ps = [a, b];
    for (uint i = 0; i < 2; i++) { IPair pair = IPair(ps[i]); pair.swap(1); }
  }
}`;

const OP_TRUE = hexToBin('51');

const swapSelector = (): Uint8Array => {
  const pair = compileString('pragma solidcash >=0.8.0;\ncontract P() { function swap(int a) { require(a >= 0); } '
    + 'function r0() { require(true); } }');
  return hexToBin(pair.abi.find((entry) => entry.name === 'swap')!.selector!);
};

// Two trivial callees that run `swap(1)`: the contract's own, and one more `OP_NOP` the spender might pick.
const CALLEE = trivialCallee([1n], swapSelector());
const TARGET = CALLEE.lock;
const OTHER = Uint8Array.of(...CALLEE.lock, 0x61);

function unlocker(lock: Uint8Array): never {
  return {
    generateLockingBytecode: (): Uint8Array => lock,
    generateUnlockingBytecode: (): Uint8Array => CALLEE.unlocking,
  } as never;
}

/** `Fixed(TARGET, TARGET).go()` whose loop-target witness and co-spent callees name `callee`. */
async function spend(callee: Uint8Array): Promise<TransactionBuilder> {
  const provider = createTestProvider();
  const artifact = compileString(FIXED);
  const contract = new Contract(artifact, [TARGET, TARGET], { provider });
  const funder = await createFeeFunder(provider, 10000n);
  const builder = new TransactionBuilder({ provider });
  builder.addInput({ txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n },
    contract.unlock.go(1n, encodePushdataValue([callee, callee], 'address[]'), swapSelector()) as never);
  builder.addInput({ txid: '01'.repeat(32), vout: 0, satoshis: 1500n }, unlocker(callee));
  builder.addInput({ txid: '02'.repeat(32), vout: 0, satoshis: 1500n }, unlocker(callee));
  builder.addInput(funder.utxo, funder.unlocker);
  builder.addOutput({ to: contract.address, amount: 100000n });
  builder.addOutput({ to: callee, amount: 1500n });
  builder.addOutput({ to: callee, amount: 1500n });
  builder.addOutput({ to: OP_TRUE, amount: 7000n });
  return builder;
}

describe('loop targets a contract fixes', () => {
  it('binds a loop-local receiver over the contract\'s own addresses to them', async () => {
    const go = compileString(FIXED).abi.find((entry) => entry.name === 'go')!;
    expect(go.inputs.map((input) => input.name)).toEqual([
      '__internal__externalCallInputBase', '__internal__loopTargets0', '__internal__externalCallSelector',
    ]);
    verifyTransaction(await spend(TARGET));
    // The same spend through callees the spender picked: the witness no longer equals the contract's address.
    const forged = await spend(OTHER);
    expect(() => verifyTransaction(forged)).toThrow();
  });

  it('binds the contract\'s own loop when an earlier loop declared a receiver of the same name', async () => {
    // The receiver `pair` is declared again for the second loop; only that declaration says whose callees it runs.
    const twoLoops = (first: string): string => `pragma solidcash >=0.8.0;
${IFACE}
contract Fixed(address a, address b) {
  function go(address[] chosen) {
    for (uint i = 0; i < chosen.length; i++) { IPair ${first} = IPair(chosen[i]); ${first}.swap(1); }
    address[2] memory ps = [a, b];
    for (uint i = 0; i < 2; i++) { IPair pair = IPair(ps[i]); pair.swap(1); }
  }
}`;
    const run = async (source: string, second: Uint8Array): Promise<TransactionBuilder> => {
      const provider = createTestProvider();
      const contract = new Contract(compileString(source), [TARGET, TARGET], { provider });
      const selector = swapSelector();
      const funder = await createFeeFunder(provider, 10000n);
      const builder = new TransactionBuilder({ provider });
      builder.addInput({ txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n },
        contract.unlock.go(encodePushdataValue([TARGET], 'address[]'), 1n, encodePushdataValue([TARGET], 'address[]'),
          encodePushdataValue([second, second], 'address[]'), selector, selector) as never);
      const locks = [TARGET, second, second];
      locks.forEach((lock, at) => builder.addInput({ txid: `0${at + 1}`.repeat(32), vout: 0, satoshis: 1500n },
        unlocker(lock)));
      builder.addInput(funder.utxo, funder.unlocker);
      builder.addOutput({ to: contract.address, amount: 100000n });
      for (const lock of locks) builder.addOutput({ to: lock, amount: 1500n });
      builder.addOutput({ to: OP_TRUE, amount: 7000n });
      return builder;
    };
    for (const first of ['pair', 'other']) {
      verifyTransaction(await run(twoLoops(first), TARGET));
      const forged = await run(twoLoops(first), OTHER);
      expect(() => verifyTransaction(forged), first).toThrow();
    }
  });

  it('keeps view witnesses for a callee the caller chooses and runs a fixed callee\'s views as calls', () => {
    const body = (target: string): string => `pragma solidcash >=0.8.0;
${IFACE}
contract Views(address a, address b) {
  bigint total;
  function sum(address[] chosen) public {
    address[2] memory own = [a, b];
    bigint acc = 0;
    for (bigint i = 0; i < 2; i = i + 1) { IPair p = IPair(${target}); acc = acc + p.r0() + p.r1(); }
    this.total = acc;
  }
}`;
    const inputs = (target: string, messageBus?: boolean): string[] => compileString(body(target),
      { messageBus, suppressWarnings: true }).abi.find((entry) => entry.name === 'sum')!.inputs.map((i) => i.name);
    // Caller-chosen targets: any value the witness gives, a callee the caller passes could return as well.
    expect(inputs('chosen[i]').filter((name) => name.startsWith('__internal__viewReturn'))).toHaveLength(2);
    // The contract's own addresses: each view is a call on that callee, which runs once per spend, so a direct
    // compile refuses the pair and a default one leaves it to the message bus.
    expect(() => compileString(body('own[i]'), { messageBus: false, suppressWarnings: true }))
      .toThrow(/MESSAGE_BUS_REQUIRED.*repeats calls to the same state owner \(IPair\.r0 -> IPair\.r1\)/);
    expect(inputs('own[i]', undefined).some((name) => name.startsWith('__internal__viewReturn'))).toBe(false);
  });
});

describe('loop targets held by locals and written arrays', () => {
  // Stand-in callees running swap(1): A the contract's own, F its fallback, X one the spender picks.
  const A = TARGET;
  const F = Uint8Array.of(...TARGET, 0x61, 0x61);
  const X = OTHER;

  /** `go(chosen)` of `source` built from `args` by input name, with `callees` co-spent from input 1 on. */
  async function spendGo(
    source: string, ctor: Uint8Array[], chosen: Uint8Array[], witnesses: Uint8Array[][], callees: Uint8Array[],
  ): Promise<TransactionBuilder> {
    const provider = createTestProvider();
    const artifact = compileString(source);
    const contract = new Contract(artifact, ctor, { provider });
    const selector = swapSelector();
    const go = artifact.abi.find((entry) => entry.name === 'go')!;
    const args = go.inputs.map((input) => {
      if (input.name === 'chosen') return encodePushdataValue(chosen, 'address[]');
      if (input.name === '__internal__externalCallInputBase') return 1n;
      const witness = /^__internal__loopTargets(\d+)$/.exec(input.name);
      if (witness) return encodePushdataValue(witnesses[Number(witness[1])]!, 'address[]');
      if (input.name.startsWith('__internal__externalCallSelector')) return selector;
      throw new Error(`no value for ${input.name}`);
    });
    const funder = await createFeeFunder(provider, 10000n);
    const builder = new TransactionBuilder({ provider });
    builder.addInput({ txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n }, (contract.unlock.go as any)(...args));
    callees.forEach((lock, at) => builder.addInput({ txid: `0${at + 1}`.repeat(32), vout: 0, satoshis: 1500n },
      unlocker(lock)));
    builder.addInput(funder.utxo, funder.unlocker);
    builder.addOutput({ to: contract.address, amount: 100000n });
    for (const lock of callees) builder.addOutput({ to: lock, amount: 1500n });
    builder.addOutput({ to: OP_TRUE, amount: 7000n });
    return builder;
  }

  it('checks a reassigned local, not the element it was declared with', async () => {
    const source = `pragma solidcash >=0.8.0;
${IFACE}
contract R(address allowed, address fallbackPair) {
  function go(address[] chosen) {
    for (uint i = 0; i < chosen.length; i++) {
      address p = chosen[i];
      if (p != allowed) { p = fallbackPair; }
      IPair(p).swap(1);
    }
  }
}`;
    // chosen = [X] is not the allowed pair, so the call runs on the fallback.
    verifyTransaction(await spendGo(source, [A, F], [X], [[F]], [F]));
    const forged = await spendGo(source, [A, F], [X], [[X]], [X]);
    expect(() => verifyTransaction(forged)).toThrow();
  });

  it('gives two loops\' locals of one name their own targets', async () => {
    const source = `pragma solidcash >=0.8.0;
${IFACE}
contract T(address a) {
  function go(address[] chosen) {
    for (uint i = 0; i < chosen.length; i++) { address p = chosen[i]; IPair(p).swap(1); }
    address[1] memory own = [a];
    for (uint i = 0; i < 1; i++) { address p = own[i]; IPair(p).swap(1); }
  }
}`;
    verifyTransaction(await spendGo(source, [A], [X], [[X], [A]], [X, A]));
    // The second loop's callee is the contract's own `a`, whatever the first loop's caller-chosen element.
    const forged = await spendGo(source, [A], [X], [[X], [X]], [X, X]);
    expect(() => verifyTransaction(forged)).toThrow();
  });

  it('checks a parameter array the body writes against its written element', async () => {
    const source = `pragma solidcash >=0.8.0;
${IFACE}
contract W(address a) {
  function go(address[] chosen) {
    chosen[0] = a;
    for (uint i = 0; i < chosen.length; i++) { IPair pair = IPair(chosen[i]); pair.swap(1); }
  }
}`;
    verifyTransaction(await spendGo(source, [A], [X], [[A]], [A]));
    const forged = await spendGo(source, [A], [X], [[X]], [X]);
    expect(() => verifyTransaction(forged)).toThrow();
  });
});
