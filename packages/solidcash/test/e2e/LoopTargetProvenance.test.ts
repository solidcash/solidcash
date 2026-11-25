import { describe, it, expect } from 'vitest';
import {
  bigIntToVmNumber, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, flattenBinArray, hash256,
  hexToBin,
} from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createTestProvider, verifyTransaction, createFeeFunder } from '../test-util.js';
import { standInToken, standInVoidRecord, trivialCallee } from '../trivial-callee.js';
import { alicePkh } from '../fixture/vars.js';

// A loop's per-iteration callee is read from a witness, since a loop-local receiver cannot reach the epilogue. Only a
// target the caller chooses and computes with keccak256 (a CREATE2 address no lock equals) may be replaced by that
// witness; any other target keeps its on-chain value, which the witness must equal
// (packages/solidc/docs/array-external-calls.md).
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

// Two trivial callees that run `swap(1)`: the contract's own, and one more `OP_NOP` the spender might pick. Each loop
// iteration reads its callee's void record at the loop's record base plus its index, which the spends lay out for the
// stand-ins (standInVoidRecord) on carriers of the category whose minting token each callee coin holds.
const CALLEE = trivialCallee([1n], swapSelector());
/** The void record a callee settles for `swap(1)` read by input 0. */
const swapRecord = (): ReturnType<typeof standInVoidRecord> => standInVoidRecord(swapSelector(), [1n]);
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
    contract.unlock.go(1n, encodePushdataValue([callee, callee], 'address[]'), 1n, 4n) as never);
  builder.addInput({ txid: '01'.repeat(32), vout: 0, satoshis: 1500n, token: standInToken() }, unlocker(callee));
  builder.addInput({ txid: '02'.repeat(32), vout: 0, satoshis: 1500n, token: standInToken() }, unlocker(callee));
  builder.addInput(funder.utxo, funder.unlocker);
  builder.addOutput({ to: contract.address, amount: 100000n });
  builder.addOutput({ to: callee, amount: 1500n, token: standInToken() });
  builder.addOutput({ to: callee, amount: 1500n, token: standInToken() });
  builder.addOutput({ to: OP_TRUE, amount: 5000n });
  builder.addOutput(swapRecord());
  builder.addOutput(swapRecord());
  return builder;
}

describe('loop targets a contract fixes', () => {
  it('binds a loop-local receiver over the contract\'s own addresses to them', async () => {
    const go = compileString(FIXED).abi.find((entry) => entry.name === 'go')!;
    // The loop's call reads each iteration's void record at the record base, in place of its selector check.
    expect(go.inputs.map((input) => input.name)).toEqual([
      '__internal__externalCallInputBase', '__internal__loopTargets0', '__internal__loopTargetStride0',
      '__internal__externalReturnOutputIdx',
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
      const funder = await createFeeFunder(provider, 10000n);
      const builder = new TransactionBuilder({ provider });
      // The first loop's record at output 5, the second loop's two at outputs 6 and 7.
      builder.addInput({ txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n },
        contract.unlock.go(encodePushdataValue([TARGET], 'address[]'), 1n, encodePushdataValue([TARGET], 'address[]'), 1n,
          encodePushdataValue([second, second], 'address[]'), 1n, 5n, 6n) as never);
      const locks = [TARGET, second, second];
      locks.forEach((lock, at) => builder.addInput({
        txid: `0${at + 1}`.repeat(32), vout: 0, satoshis: 1500n, token: standInToken(),
      }, unlocker(lock)));
      builder.addInput(funder.utxo, funder.unlocker);
      builder.addOutput({ to: contract.address, amount: 100000n });
      for (const lock of locks) builder.addOutput({ to: lock, amount: 1500n, token: standInToken() });
      builder.addOutput({ to: OP_TRUE, amount: 4000n });
      locks.forEach(() => builder.addOutput(swapRecord()));
      return builder;
    };
    for (const first of ['pair', 'other']) {
      verifyTransaction(await run(twoLoops(first), TARGET));
      const forged = await run(twoLoops(first), OTHER);
      expect(() => verifyTransaction(forged), first).toThrow();
    }
  });

  it('keeps view witnesses for a keccak256 callee the caller chooses and runs a fixed callee\'s views as calls', () => {
    const body = (target: string): string => `pragma solidcash >=0.8.0;
${IFACE}
library L { function pairFor(address x, address y) internal pure returns (address) {
  return address(uint160(uint256(keccak256(abi.encodePacked(x, y))))); } }
contract Views(address a, address b) {
  bigint total;
  function sum(address[] chosen) public {
    address[2] memory own = [a, b];
    bigint acc = 0;
    for (bigint i = 0; i < 2; i = i + 1) { IPair p = IPair(${target}); acc = acc + p.r0() + p.r1(); }
    this.total = acc;
  }
}`;
    const inputs = (target: string): string[] => compileString(body(target),
      { suppressWarnings: true }).abi.find((entry) => entry.name === 'sum')!.inputs.map((i) => i.name);
    // A target the caller chooses through a keccak256 computation: no lock equals it, so the callee is a witness and
    // any answer the view witnesses give, a callee the spender names could return as well. A plain element such as
    // `chosen[i]` names a callee whose answers the contract can read, and the compile refuses several calls through it.
    expect(inputs('L.pairFor(chosen[i], chosen[i + 1])').filter((name) => name.startsWith('__internal__viewReturn')))
      .toHaveLength(2);
    // The contract's own addresses: each view is a call on that callee, which runs once per spend, so a direct
    // compile refuses the pair and a default one leaves it to the message bus.
    expect(() => compileString(body('own[i]'), { suppressWarnings: true }))
      .toThrow(/REPEATED_CALL_UNSUPPORTED.*repeats calls to the same state owner \(IPair\.r0 -> IPair\.r1\)/);
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
    extra: Record<string, unknown> = {},
  ): Promise<TransactionBuilder> {
    const provider = createTestProvider();
    const artifact = compileString(source);
    const contract = new Contract(artifact, ctor, { provider });
    const go = artifact.abi.find((entry) => entry.name === 'go')!;
    // Loop k reads its iterations' records from its own base, after the change, in loop order.
    const recordBase = (loop: number): bigint => BigInt(callees.length + 2
      + witnesses.slice(0, loop).reduce((count, targets) => count + targets.length, 0));
    const args = go.inputs.map((input) => {
      if (input.name === 'chosen') return encodePushdataValue(chosen, 'address[]');
      if (input.name === '__internal__externalCallInputBase') return 1n;
      const witness = /^__internal__loopTargets(\d+)$/.exec(input.name);
      if (witness) return encodePushdataValue(witnesses[Number(witness[1])]!, 'address[]');
      if (input.name.startsWith('__internal__loopTargetStride')) return 1n;
      const records = /^__internal__externalReturnOutputIdx(\d*)$/.exec(input.name);
      if (records) return recordBase(Number(records[1] || 0));
      if (input.name in extra) return extra[input.name];
      throw new Error(`no value for ${input.name}`);
    });
    const funder = await createFeeFunder(provider, 10000n);
    const builder = new TransactionBuilder({ provider });
    builder.addInput({ txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n }, (contract.unlock.go as any)(...args));
    callees.forEach((lock, at) => builder.addInput({
      txid: `0${at + 1}`.repeat(32), vout: 0, satoshis: 1500n, token: standInToken(),
    }, unlocker(lock)));
    builder.addInput(funder.utxo, funder.unlocker);
    builder.addOutput({ to: contract.address, amount: 100000n });
    for (const lock of callees) builder.addOutput({ to: lock, amount: 1500n, token: standInToken() });
    builder.addOutput({ to: OP_TRUE, amount: 5000n });
    witnesses.flat().forEach(() => builder.addOutput(swapRecord()));
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

  it('checks an inlined helper\'s array parameter that the helper reassigns', async () => {
    const source = `pragma solidcash >=0.8.0;
${IFACE}
contract H(address a) {
  function callAt(address[] memory path, address[] memory fb, uint i) internal {
    if (path.length == 0) path = fb;
    IPair pair = IPair(path[i]);
    pair.swap(1);
  }
  function go(address[] chosen) {
    address[1] memory own = [a];
    for (uint i = 0; i < 1; i++) { callAt(chosen, own, i); }
  }
}`;
    // chosen is empty, so the helper calls the contract's own `a`.
    verifyTransaction(await spendGo(source, [A], [], [[A]], [A]));
    const forged = await spendGo(source, [A], [], [[X]], [X]);
    expect(() => verifyTransaction(forged)).toThrow();
  });

  it('calls a deleted local as deleted, not the element it was declared with', async () => {
    const source = `pragma solidcash >=0.8.0;
${IFACE}
contract D() {
  function go(address[] chosen, bool c) {
    for (uint i = 0; i < chosen.length; i++) { address p = chosen[i]; if (c) delete p; IPair(p).swap(1); }
  }
}`;
    verifyTransaction(await spendGo(source, [], [X], [[X]], [X], { c: false }));
    const forged = await spendGo(source, [], [X], [[X]], [X], { c: true });
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

describe('a plain parameter element held in a loop local, on the production profile', () => {
  // The element passes the contract's registry check; the local holding it is the call's target. Its witness used to
  // stand for the callee unchecked, so a spender could name the trusted element and co-spend another contract. Only a
  // keccak256 target keeps that witness now: this one is checked against the element where the call runs.
  const GATE = `pragma solidcash >=0.8.0;
${IFACE}
contract Gate(address trusted) {
  function go(address[] chosen) {
    for (uint i = 0; i < chosen.length; i++) {
      require(chosen[i] == trusted);
      IPair pair = IPair(chosen[i]);
      pair.swap(1);
    }
  }
}`;

  /**
   * A stand-in callee running `swap(1)` behind P2SH32, so that spending it is standard: its unlocking pushes the
   * selector and the argument, then its redeem, which drops them and succeeds. The redeem opens with `OP_NOP`, as
   * trivialCallee's does: a caller refuses a redeem that opens with `OP_DROP`, which reads as dropping a budget pad.
   * `variant` adds `OP_NOP`s to its end, which gives the same callee another lock.
   */
  const standardCallee = (variant: number): { lock: Uint8Array; unlocking: Uint8Array } => {
    const pushes = [swapSelector(), bigIntToVmNumber(1n)];
    const redeem = Uint8Array.from([
      0x61, ...pushes.map(() => 0x75), 0x51, ...new Array<number>(variant).fill(0x61),
    ]);
    return {
      lock: encodeLockingBytecodeP2sh32(hash256(redeem)),
      unlocking: flattenBinArray([...pushes.map((push) => encodeDataPush(push)), encodeDataPush(redeem)]),
    };
  };
  const TRUSTED = standardCallee(0);
  const OTHER_CALLEE = standardCallee(1);

  /** `go(chosen)` on `Gate(TRUSTED)` whose witness names `witness` and whose co-spent callee is `callee`. */
  async function spendGate(
    chosen: Uint8Array, witness: Uint8Array, callee: { lock: Uint8Array; unlocking: Uint8Array },
  ): Promise<TransactionBuilder> {
    const provider = createTestProvider();
    const artifact = compileString(GATE);
    const contract = new Contract(artifact, [TRUSTED.lock], { provider });
    const go = artifact.abi.find((entry) => entry.name === 'go')!;
    const args = go.inputs.map((input) => {
      if (input.name === 'chosen') return encodePushdataValue([chosen], 'address[]');
      if (input.name === '__internal__externalCallInputBase') return 1n;
      if (input.name === '__internal__loopTargets0') return encodePushdataValue([witness], 'address[]');
      if (input.name === '__internal__loopTargetStride0') return 1n;
      if (input.name === '__internal__externalReturnOutputIdx') return 3n;
      throw new Error(`no value for ${input.name}`);
    });
    const funder = await createFeeFunder(provider, 10000n);
    const builder = new TransactionBuilder({ provider });
    builder.addInput({ txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n }, (contract.unlock.go as any)(...args));
    builder.addInput({ txid: '01'.repeat(32), vout: 0, satoshis: 1500n, token: standInToken() }, {
      generateLockingBytecode: (): Uint8Array => callee.lock,
      generateUnlockingBytecode: (): Uint8Array => callee.unlocking,
    } as never);
    builder.addInput(funder.utxo, funder.unlocker);
    builder.addOutput({ to: contract.address, amount: 100000n });
    builder.addOutput({ to: callee.lock, amount: 1500n, token: standInToken() });
    builder.addOutput({ to: encodeLockingBytecodeP2pkh(alicePkh), amount: 6000n });
    builder.addOutput(swapRecord());
    return builder;
  }

  /** The BCH 2026 machine of a production-profile provider, standard rules included: true, or why it refuses. */
  function productionVerdict(builder: TransactionBuilder): true | string {
    const vm = createVirtualMachineBch2026ForProvider(new MockNetworkProvider({ profile: 'production' }));
    return vm.verify({
      transaction: builder.buildLibauthTransaction(), sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
    } as never) as true | string;
  }

  it('refuses a co-spent callee other than the element and runs the honest callee', async () => {
    const go = compileString(GATE).abi.find((entry) => entry.name === 'go')!;
    expect(go.inputs.map((input) => input.name)).toEqual([
      'chosen', '__internal__externalCallInputBase', '__internal__loopTargets0', '__internal__loopTargetStride0',
      '__internal__externalReturnOutputIdx',
    ]);
    expect(productionVerdict(await spendGate(TRUSTED.lock, TRUSTED.lock, TRUSTED))).toBe(true);
    // The trusted element passes the registry check while the witness and the co-spend name another contract.
    expect(productionVerdict(await spendGate(TRUSTED.lock, OTHER_CALLEE.lock, OTHER_CALLEE)))
      .toMatch(/error in evaluating input index 0: /);
    // The witness names the element and only the co-spent callee differs.
    expect(productionVerdict(await spendGate(TRUSTED.lock, TRUSTED.lock, OTHER_CALLEE)))
      .toMatch(/error in evaluating input index 0: /);
    // The registry check itself refuses an element it does not hold.
    expect(productionVerdict(await spendGate(OTHER_CALLEE.lock, OTHER_CALLEE.lock, OTHER_CALLEE)))
      .toMatch(/error in evaluating input index 0: /);
  });
});
