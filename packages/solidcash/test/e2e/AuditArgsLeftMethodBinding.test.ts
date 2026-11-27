import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions, encodeDataPush, encodeTransaction,
  hexToBin,
} from '@bitauth/libauth';
import { createTxVerifier } from '@mem-cash/validation';
import { encodePushdataValue } from '@solidcash/utils';
import { encodeFunctionArgument } from '../../src/Argument.js';
import { compileStringMulti } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';

/**
 * A direct call naming fewer arguments than its method declares, `IDeposit(a).deposit()` for `deposit(int v)`, takes
 * each argument it leaves to the callee that the callee's record digests as a witness (`__internal__callArgument`),
 * which the SDK fills from the callee's arguments, and digests it with the ones it names. Its record then binds the
 * method and every argument as for a call naming them (fix B's `digest || 0x01` when void, D50's when returning): a
 * returning call compares the digest, and a void call reads the record, through a multi-function interface in place
 * of its selector check. Before, such a call digested nothing, so through a single-function interface nothing bound
 * the method its callee ran (security-audit-2026-10-16, "Direct call that leaves its arguments to the callee").
 *
 * The caller has an entry per callee method: `oneA` calls A and `oneB` calls B, each through a single-function
 * interface, `twoA` and `twoB` do the same through one interface naming both, and `Named` passes the argument. The SDK
 * builds the honest spend of each from the same coins. The spliced spend is B's honest spend with the caller's
 * unlocking and its own outputs (its state and, for a named call, the F1 edge committing to its call) taken from A's:
 * the caller runs the entry naming A while the callee runs B and pins B's record. Each party's bytes are those of the
 * spend it ran, so only the caller's checks of the callee can refuse it. (A standalone build of B spliced into A's
 * spend, as in AuditSingleInterfaceMethodBinding, is refused by the callee itself since fix B: its standalone run
 * expects no record of its category, and A's record is one.) mem-cash BCH_2026_05, mocknet only.
 */

interface Shape {
  name: string;
  source: string;
  a: string;
  b: string;
  calleeState: Record<string, bigint>;
  callerState: Record<string, bigint>;
  // A returning call keeps its selector check through a multi-function interface; a void one reads its record instead.
  keepsSelector: boolean;
  // The single-function interfaces naming A and B.
  ifaceA: string;
  ifaceB: string;
}

const SHAPES: Shape[] = [{
  name: 'void',
  // B has A's arity and the opposite effect.
  source: `pragma solidcash >=0.8.0;
interface IDeposit { function deposit(int v); }
interface IWithdraw { function withdraw(int v); }
interface IVault { function deposit(int v); function withdraw(int v); }
contract Callee() {
  int balance;
  function deposit(int v) { require(v > 0); this.balance = this.balance + v; }
  function withdraw(int v) { require(v > 0); this.balance = this.balance - v; }
}
contract Caller() {
  int calls;
  function oneA(address a) { IDeposit(a).deposit(); this.calls = this.calls + 1; }
  function oneB(address a) { IWithdraw(a).withdraw(); this.calls = this.calls + 1; }
  function twoA(address a) { IVault(a).deposit(); this.calls = this.calls + 1; }
  function twoB(address a) { IVault(a).withdraw(); this.calls = this.calls + 1; }
}
contract Named() {
  int calls;
  function oneA(address a, int v) { IDeposit(a).deposit(v); this.calls = this.calls + 1; }
  function oneB(address a, int v) { IWithdraw(a).withdraw(v); this.calls = this.calls + 1; }
}
contract Looper() {
  int calls;
  function oneA(address[] ts) { for (uint i = 0; i < ts.length; i++) { IDeposit(ts[i]).deposit(); } this.calls = 1; }
  function oneB(address[] ts) { for (uint i = 0; i < ts.length; i++) { IWithdraw(ts[i]).withdraw(); } this.calls = 1; }
}
contract StateLooper() {
  address[] ts;
  int calls;
  function reg(address t) { this.ts.push(t); }
  function oneA() { for (uint i = 0; i < ts.length; i++) { IDeposit(ts[i]).deposit(); } this.calls = 1; }
  function oneB() { for (uint i = 0; i < ts.length; i++) { IWithdraw(ts[i]).withdraw(); } this.calls = 1; }
}`,
  a: 'deposit',
  b: 'withdraw',
  calleeState: { balance: 10n },
  callerState: { calls: 0n },
  keepsSelector: false,
  ifaceA: 'IDeposit',
  ifaceB: 'IWithdraw',
}, {
  name: 'returning',
  // B returns what A returns, without adding v to the counter.
  source: `pragma solidcash >=0.8.0;
interface ITake { function take(int v) returns (int); }
interface IPeek { function peek(int v) returns (int); }
interface IBook { function take(int v) returns (int); function peek(int v) returns (int); }
contract Callee() {
  int counter;
  function take(int v) returns (int) { require(v > 0); int old = this.counter; this.counter = old + v; return old; }
  function peek(int v) returns (int) { require(v > 0); return this.counter; }
}
contract Caller() {
  int last;
  function oneA(address a) { int r = ITake(a).take(); this.last = r; }
  function oneB(address a) { int r = IPeek(a).peek(); this.last = r; }
  function twoA(address a) { int r = IBook(a).take(); this.last = r; }
  function twoB(address a) { int r = IBook(a).peek(); this.last = r; }
}
contract Named() {
  int last;
  function oneA(address a, int v) { int r = ITake(a).take(v); this.last = r; }
  function oneB(address a, int v) { int r = IPeek(a).peek(v); this.last = r; }
}
contract Looper() {
  int last;
  function oneA(address[] ts) { for (uint i = 0; i < ts.length; i++) { int r = ITake(ts[i]).take(); this.last = r; } }
  function oneB(address[] ts) { for (uint i = 0; i < ts.length; i++) { int r = IPeek(ts[i]).peek(); this.last = r; } }
}
contract StateLooper() {
  address[] ts;
  int last;
  function reg(address t) { this.ts.push(t); }
  function oneA() { for (uint i = 0; i < ts.length; i++) { int r = ITake(ts[i]).take(); this.last = r; } }
  function oneB() { for (uint i = 0; i < ts.length; i++) { int r = IPeek(ts[i]).peek(); this.last = r; } }
}`,
  a: 'take',
  b: 'peek',
  calleeState: { counter: 5n },
  callerState: { last: 0n },
  keepsSelector: true,
  ifaceA: 'ITake',
  ifaceB: 'IPeek',
}];

interface Deployed {
  arts: any;
  caller: any;
  callee: any;
  calleeAddr: Uint8Array;
  callerCat: string;
  calleeCat: string;
}

interface Spend { tx: any; sourceOutputs: any[] }

const verifier = createTxVerifier({ vmVersion: 'BCH_2026_05', standard: true, skipFeePolicy: true });

/** The compile options of the caller and of the callee. */
interface Convention { name: string; caller: object; callee: object }
const DIRECT: Convention = { name: 'direct', caller: {}, callee: {} };

const compiled = new Map<string, any>();
const artifactsOf = (shape: Shape, options: object = {}): any => {
  const key = `${shape.name}:${JSON.stringify(options)}`;
  if (!compiled.has(key)) compiled.set(key, compileStringMulti(shape.source, options));
  return compiled.get(key);
};

const ofCategory = (output: any, category: string): boolean => output?.token !== undefined
  && [category, binToHex(hexToBin(category).reverse())].includes(binToHex(output.token.category));
const master = (run: Spend, category: string): number => run.sourceOutputs.findIndex((output: any) => (
  ofCategory(output, category) && output.token.nft?.capability === 'minting'));
const firstPush = (unlocking: Uint8Array): string => binToHex(
  (decodeAuthenticationInstructions(unlocking)[0] as { data?: Uint8Array }).data ?? Uint8Array.of(),
);
const selector = (d: Deployed, name: string): string => binToHex(
  hexToBin(d.arts.Callee.abi.find((entry: any) => entry.name === name).selector),
);
/** The names of the hidden inputs of the caller's `entry` matching `pattern`. */
const hidden = (d: Deployed, caller: string, entry: string, pattern: RegExp): string[] => d.arts[caller].abi
  .find((fn: any) => fn.name === entry).inputs.map((input: any) => input.name as string)
  .filter((name: string) => pattern.test(name));
const LEFT_ARGUMENT = /^__internal__callArgument\d+_\d+$/;
const SELECTOR = /^__internal__externalCallSelector\d*$/;
/** An F1 edge carrier (`OP_1 OP_NOP`): a named call's own output, committing to the call it makes. */
const isEdge = (output: any): boolean => binToHex(output.lockingBytecode) === '5161';

async function deploy(
  shape: Shape, caller = 'Caller', convention = DIRECT, callerState: Record<string, unknown> = shape.callerState,
): Promise<Deployed> {
  const provider = createTestProvider();
  const arts = { ...artifactsOf(shape, convention.caller), Callee: artifactsOf(shape, convention.callee).Callee };
  const calleeBase = new Contract(arts.Callee, [], { provider });
  const { categoryId: calleeCat } = await setupStatefulUtxos(
    provider, calleeBase, arts.Callee.stateLayout!, shape.calleeState, { saltContract: true },
  );
  const callerBase = new Contract(arts[caller], [], { provider });
  const { categoryId: callerCat } = await setupStatefulUtxos(
    provider, callerBase, arts[caller].stateLayout!, callerState, { saltContract: true },
  );
  return {
    arts,
    caller: StatefulContract.withCategory(callerBase, callerCat),
    callee: StatefulContract.withCategory(calleeBase, calleeCat),
    calleeAddr: hexToBin(calleeBase.withCategory(hexToBin(calleeCat)).lockingBytecode),
    callerCat,
    calleeCat,
  };
}

/** The honest spend of the caller's `entry` (given 3 when `named`), its callee co-spent running `method(3)`. */
async function spend(d: Deployed, entry: string, method: string, named = false): Promise<Spend> {
  const args = named ? [d.calleeAddr, 3n] : [d.calleeAddr];
  const call = await d.caller[entry](...args).withExternalCall(d.callee, method, [3n]).build();
  return { tx: call.buildLibauthTransaction(), sourceOutputs: generateLibauthSourceOutputs(call.inputs) };
}

/**
 * The honest spend of a looper's `entry` over one target, the callee, which runs `method(3)` as its one turn: the
 * looper lists the callee for the loop's interface and names the turn's arguments, which the call leaves to it.
 */
async function loopSpend(d: Deployed, entry: string, iface: string, method: string): Promise<Spend> {
  d.caller.registerExternalArray(iface, [d.callee], [method]);
  const call = await d.caller[entry]([d.calleeAddr]).withExternalCall(d.callee, method, [3n]).build();
  return { tx: call.buildLibauthTransaction(), sourceOutputs: generateLibauthSourceOutputs(call.inputs) };
}

/** A looper over a state array of targets, which holds the callee as its one element. */
async function deployStateLooper(shape: Shape): Promise<Deployed> {
  const d = await deploy(shape, 'StateLooper', DIRECT, { ...shape.callerState, ts: [] });
  await d.caller.reg(d.calleeAddr).send();
  return d;
}

/** The honest spend of a state looper's `entry`, its element's callee running `method(3)`, named by the looper. */
async function stateLoopSpend(d: Deployed, entry: string, iface: string, method: string): Promise<Spend> {
  d.caller.registerExternalArray(iface, [d.callee], [method]);
  const call = await d.caller[entry]().withExternalCall(d.callee, method, [3n]).build();
  return { tx: call.buildLibauthTransaction(), sourceOutputs: generateLibauthSourceOutputs(call.inputs) };
}

/** `run` with the caller's witness list `list` carrying one element past its calls: the list's bytes twice. */
function withExtraListElement(run: Spend, callerCat: string, list: Uint8Array): Spend {
  const at = master(run, callerCat);
  const instructions = decodeAuthenticationInstructions(run.tx.inputs[at].unlockingBytecode) as any[];
  const pushes = instructions.flatMap((instruction, index) => (instruction.data !== undefined
    && binToHex(instruction.data) === binToHex(list) ? [index] : []));
  expect(pushes).toHaveLength(1);
  const longer = decodeAuthenticationInstructions(encodeDataPush(Uint8Array.of(...list, ...list)))[0];
  const unlockingBytecode = encodeAuthenticationInstructions(instructions.map((instruction, index) => (
    index === pushes[0] ? longer : instruction)));
  const inputs = run.tx.inputs.map((input: any, index: number) => (index === at ? { ...input, unlockingBytecode }
    : input));
  return { tx: { ...run.tx, inputs }, sourceOutputs: run.sourceOutputs };
}

/** `b` with the caller's unlocking and own outputs from `a`: the caller runs a's entry, the callee b's method. */
function splice(a: Spend, b: Spend, callerCat: string): Spend {
  const inputs = b.tx.inputs.map((input: any, index: number) => (ofCategory(b.sourceOutputs[index], callerCat)
    ? { ...input, unlockingBytecode: a.tx.inputs[index].unlockingBytecode } : input));
  const outputs = b.tx.outputs.map((output: any, index: number) => (ofCategory(output, callerCat)
    ? a.tx.outputs[index] : output));
  return { tx: { ...b.tx, inputs, outputs }, sourceOutputs: b.sourceOutputs };
}

/**
 * Both spends take the same coins and give the caller its outputs at the same places, equal but for a named call's
 * edge; the callee runs A in `a` and B in `b`.
 */
function expectOnlyTheMethodDiffers(d: Deployed, shape: Shape, a: Spend, b: Spend): void {
  const outpoint = (input: any): string => `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`;
  expect(b.tx.inputs.map(outpoint)).toEqual(a.tx.inputs.map(outpoint));
  const own = (s: Spend): number[] => s.tx.outputs.flatMap((output: any, index: number) => (
    ofCategory(output, d.callerCat) ? [index] : []));
  expect(b.tx.outputs.length).toBe(a.tx.outputs.length);
  expect(own(a).length).toBeGreaterThan(0);
  expect(own(b)).toEqual(own(a));
  const state = (s: Spend): string[] => own(s).map((index) => s.tx.outputs[index])
    .filter((output: any) => !isEdge(output))
    .map((output: any) => `${binToHex(output.lockingBytecode)}:${output.valueSatoshis}:`
      + `${output.token.nft?.capability}:${binToHex(output.token.nft?.commitment ?? Uint8Array.of())}`);
  expect(state(a).length).toBeGreaterThan(0);
  expect(state(b)).toEqual(state(a));
  const callee = master(a, d.calleeCat);
  expect(callee).toBeGreaterThanOrEqual(0);
  expect(firstPush(a.tx.inputs[callee].unlockingBytecode)).toBe(selector(d, shape.a));
  expect(firstPush(b.tx.inputs[callee].unlockingBytecode)).toBe(selector(d, shape.b));
}

/** Run the mem-cash VM over a spend under a chain state past its locktime. */
function runVm({ tx, sourceOutputs }: Spend): { success: boolean; error?: string } {
  // A plain anyone-can-spend funder covers any dust build() leaves unfunded, so the VM reaches the covenants.
  const funded = {
    ...tx,
    inputs: [...tx.inputs, {
      outpointTransactionHash: hexToBin('11'.repeat(32)), outpointIndex: 0,
      sequenceNumber: 0xffffffff, unlockingBytecode: Uint8Array.of(),
    }],
  };
  const outputs = [...sourceOutputs, { lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1_000_000n }];
  const lt = Number(tx.locktime);
  const chain = lt < 500000000
    ? { height: lt + 1, medianTimePast: 1700000000 } : { height: 133700, medianTimePast: lt + 1 };
  const result = verifier.verify(binToHex(encodeTransaction(funded)), outputs, chain);
  return result.success ? { success: true }
    : { success: false, error: [result.error, result.debugMessage].filter(Boolean).join(': ') };
}

/** The VM refuses the spend by a script failure at input `index`. */
function expectRefusedAt(result: { success: boolean; error?: string }, index: number): void {
  expect(result.success).toBe(false);
  expect(result.error ?? '').toContain('mandatory-script-verify-flag-failed');
  expect(result.error ?? '').toContain(`error in evaluating input index ${index}:`);
}

describe('the method a direct call names, against a callee running another of the same arity (VM)', () => {
  for (const shape of SHAPES) {
    describe(`${shape.name}: ${shape.a} beside ${shape.b}(int v)`, () => {
      it(`settles the honest ${shape.a}() through a single-function interface, and ${shape.b}()`, async () => {
        const d = await deploy(shape);
        // The argument the call leaves to its callee is the caller's witness, which the SDK fills.
        expect(hidden(d, 'Caller', 'oneA', LEFT_ARGUMENT)).toEqual(['__internal__callArgument0_0']);
        const a = await spend(d, 'oneA', shape.a);
        const b = await spend(d, 'oneB', shape.b);
        expectOnlyTheMethodDiffers(d, shape, a, b);
        expect(runVm(a)).toEqual({ success: true });
        expect(runVm(b)).toEqual({ success: true });
      }, 300_000);

      // Without the witness the call checked no selector and no record digest here, and this spliced spend settled
      // while the caller took B's run for A's (for `void`, a withdrawal for a deposit; for `returning`, a free read for
      // a paid one). The caller now digests A's call, which B's record does not match.
      it(`refuses ${shape.a}() co-spent with ${shape.b} at the caller (single-function interface)`, async () => {
        const d = await deploy(shape);
        const a = await spend(d, 'oneA', shape.a);
        const r = runVm(splice(a, await spend(d, 'oneB', shape.b), d.callerCat));
        expectRefusedAt(r, master(a, d.callerCat));
      }, 300_000);

      it(`refuses ${shape.a}() co-spent with ${shape.b} at the caller (multi-function interface)`, async () => {
        const d = await deploy(shape);
        expect(hidden(d, 'Caller', 'twoA', LEFT_ARGUMENT)).toEqual(['__internal__callArgument0_0']);
        expect(hidden(d, 'Caller', 'twoA', SELECTOR).length > 0).toBe(shape.keepsSelector);
        const a = await spend(d, 'twoA', shape.a);
        const b = await spend(d, 'twoB', shape.b);
        expectOnlyTheMethodDiffers(d, shape, a, b);
        expect(runVm(a)).toEqual({ success: true });
        expect(runVm(b)).toEqual({ success: true });
        expectRefusedAt(runVm(splice(a, b, d.callerCat)), master(a, d.callerCat));
      }, 300_000);

      // Fix B (void) and D50 (returning): the caller reads the callee's record by the digest of the call it names, so
      // B's record, digested under B's selector, fails that comparison at the caller's input.
      it(`refuses ${shape.a}(v) co-spent with ${shape.b} at the caller (single-function, named)`, async () => {
        const d = await deploy(shape, 'Named');
        const a = await spend(d, 'oneA', shape.a, true);
        const b = await spend(d, 'oneB', shape.b, true);
        expectOnlyTheMethodDiffers(d, shape, a, b);
        expect(runVm(a)).toEqual({ success: true });
        expect(runVm(b)).toEqual({ success: true });
        expectRefusedAt(runVm(splice(a, b, d.callerCat)), master(a, d.callerCat));
      }, 300_000);
    });
  }
});

describe('the method an args-left call names, made once per turn of a loop over targets (VM)', () => {
  for (const shape of SHAPES) {
    describe(`${shape.name}: ${shape.a} beside ${shape.b}(int v)`, () => {
      it(`settles the honest loop of ${shape.a}() through a single-function interface, and of ${shape.b}()`, async () => {
        const d = await deploy(shape, 'Looper');
        // The argument each turn's call leaves is an element of a witness list the SDK fills from the turn's callee.
        expect(hidden(d, 'Looper', 'oneA', /^__internal__callArgumentList\d+_\d+$/))
          .toEqual(['__internal__callArgumentList0_0']);
        const a = await loopSpend(d, 'oneA', shape.ifaceA, shape.a);
        const b = await loopSpend(d, 'oneB', shape.ifaceB, shape.b);
        expectOnlyTheMethodDiffers(d, shape, a, b);
        expect(runVm(a)).toEqual({ success: true });
        expect(runVm(b)).toEqual({ success: true });
      }, 300_000);

      it(`refuses a turn's callee running ${shape.b} for the ${shape.a}() the loop names, at the caller`, async () => {
        const d = await deploy(shape, 'Looper');
        const a = await loopSpend(d, 'oneA', shape.ifaceA, shape.a);
        const b = await loopSpend(d, 'oneB', shape.ifaceB, shape.b);
        expectRefusedAt(runVm(splice(a, b, d.callerCat)), master(a, d.callerCat));
      }, 300_000);
    });
  }
});

describe('the method an args-left call names, on each element of a state array of targets (VM)', () => {
  for (const shape of SHAPES) {
    describe(`${shape.name}: ${shape.a} beside ${shape.b}(int v)`, () => {
      it(`settles the honest loop of ${shape.a}() over a state array, and of ${shape.b}()`, async () => {
        const d = await deployStateLooper(shape);
        // The argument each element's call leaves is an element of a witness list, as over a parameter array.
        expect(hidden(d, 'StateLooper', 'oneA', /^__internal__callArgumentList\d+_\d+$/))
          .toEqual(['__internal__callArgumentList0_0']);
        const a = await stateLoopSpend(d, 'oneA', shape.ifaceA, shape.a);
        const b = await stateLoopSpend(d, 'oneB', shape.ifaceB, shape.b);
        expectOnlyTheMethodDiffers(d, shape, a, b);
        expect(runVm(a)).toEqual({ success: true });
        expect(runVm(b)).toEqual({ success: true });
      }, 300_000);

      it(`refuses an element's callee running ${shape.b} for the ${shape.a}() the loop names, at the caller`, async () => {
        const d = await deployStateLooper(shape);
        const a = await stateLoopSpend(d, 'oneA', shape.ifaceA, shape.a);
        const b = await stateLoopSpend(d, 'oneB', shape.ifaceB, shape.b);
        expectRefusedAt(runVm(splice(a, b, d.callerCat)), master(a, d.callerCat));
      }, 300_000);
    });
  }
});

describe('a witness list of the arguments a loop leaves, carrying one element past its calls (VM)', () => {
  // A list is spent to its end: a byte past the last call's element binds nothing, so a third party could add one to
  // change the transaction's id. The honest list holds the one call's argument 3, as the SDK frames it.
  const shape = SHAPES[0]!;
  const list = encodePushdataValue(encodeFunctionArgument(3n, 'int') as Uint8Array, 'bytes');
  it('refuses it over a parameter array, at the caller', async () => {
    const d = await deploy(shape, 'Looper');
    const a = await loopSpend(d, 'oneA', shape.ifaceA, shape.a);
    expect(runVm(a)).toEqual({ success: true });
    expectRefusedAt(runVm(withExtraListElement(a, d.callerCat, list)), master(a, d.callerCat));
  }, 300_000);

  it('refuses it over a state array, at the caller', async () => {
    const d = await deployStateLooper(shape);
    const a = await stateLoopSpend(d, 'oneA', shape.ifaceA, shape.a);
    expect(runVm(a)).toEqual({ success: true });
    expectRefusedAt(runVm(withExtraListElement(a, d.callerCat, list)), master(a, d.callerCat));
  }, 300_000);
});
