import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { createTxVerifier } from '@mem-cash/validation';
import { compileStringMulti } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';

/**
 * Residual (security-audit-2026-10-16, "Open", "Direct call that leaves its arguments to the callee"). A direct call
 * naming fewer arguments than its method declares, `IDeposit(a).deposit()` for `deposit(int v)`, cannot compute the
 * digest of its call record (`namesCallRecordArguments`): a void call reads no record (`emitVoidCallRecordRead`
 * returns early) and a returning call reads its record without comparing the digest. Through a single-function
 * interface it checks no selector either (`needsSelectorVerification` needs two methods), so nothing binds the method
 * the co-spent callee runs. Through a multi-function interface the caller's selector check binds it.
 *
 * The caller has an entry per callee method: `oneA` calls A and `oneB` calls B, each through a single-function
 * interface, and `twoA`, `twoB` do the same through one interface naming both. The SDK builds the honest spend of
 * each from the same coins. The spliced spend is B's honest spend with the caller's unlocking taken from A's: the
 * caller runs the entry naming A while the callee runs B and pins B's record. Every other byte is B's honest spend,
 * so only the caller's checks can refuse it. (A standalone build of B spliced into A's spend, as in
 * AuditSingleInterfaceMethodBinding, is refused by the callee itself since fix B: its standalone run expects no
 * record of its category, and A's record is one.) mem-cash BCH_2026_05, mocknet only.
 */

interface Shape {
  name: string;
  source: string;
  a: string;
  b: string;
  calleeState: Record<string, bigint>;
  callerState: Record<string, bigint>;
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
}`,
  a: 'deposit',
  b: 'withdraw',
  calleeState: { balance: 10n },
  callerState: { calls: 0n },
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
}`,
  a: 'take',
  b: 'peek',
  calleeState: { counter: 5n },
  callerState: { last: 0n },
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

const compiled = new Map<string, any>();
const artifactsOf = (shape: Shape): any => {
  if (!compiled.has(shape.name)) compiled.set(shape.name, compileStringMulti(shape.source));
  return compiled.get(shape.name);
};

const ofCategory = (output: any, category: string): boolean => output?.token !== undefined
  && [category, binToHex(hexToBin(category).reverse())].includes(binToHex(output.token.category));
const master = (spend: Spend, category: string): number => spend.sourceOutputs.findIndex((output: any) => (
  ofCategory(output, category) && output.token.nft?.capability === 'minting'));
const firstPush = (unlocking: Uint8Array): string => binToHex(
  (decodeAuthenticationInstructions(unlocking)[0] as { data?: Uint8Array }).data ?? Uint8Array.of(),
);
const selector = (d: Deployed, name: string): string => binToHex(
  hexToBin(d.arts.Callee.abi.find((entry: any) => entry.name === name).selector),
);

async function deploy(shape: Shape): Promise<Deployed> {
  const provider = createTestProvider();
  const arts = artifactsOf(shape);
  const calleeBase = new Contract(arts.Callee, [], { provider });
  const { categoryId: calleeCat } = await setupStatefulUtxos(
    provider, calleeBase, arts.Callee.stateLayout!, shape.calleeState, { saltContract: true },
  );
  const callerBase = new Contract(arts.Caller, [], { provider });
  const { categoryId: callerCat } = await setupStatefulUtxos(
    provider, callerBase, arts.Caller.stateLayout!, shape.callerState, { saltContract: true },
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

/** The honest spend of the caller's `entry`, its callee co-spent running `method(3)`. */
async function spend(d: Deployed, entry: string, method: string): Promise<Spend> {
  const call = await d.caller[entry](d.calleeAddr).withExternalCall(d.callee, method, [3n]).build();
  return { tx: call.buildLibauthTransaction(), sourceOutputs: generateLibauthSourceOutputs(call.inputs) };
}

/** `b` with the caller's unlocking from `a`: the caller runs a's entry beside the callee's run of b's method. */
function splice(a: Spend, b: Spend, callerCat: string): Spend {
  const inputs = b.tx.inputs.map((input: any, index: number) => (ofCategory(b.sourceOutputs[index], callerCat)
    ? { ...input, unlockingBytecode: a.tx.inputs[index].unlockingBytecode } : input));
  return { tx: { ...b.tx, inputs }, sourceOutputs: b.sourceOutputs };
}

/** Both spends take the same coins and leave the caller the same outputs; the callee runs A in `a`, B in `b`. */
function expectOnlyTheMethodDiffers(d: Deployed, shape: Shape, a: Spend, b: Spend): void {
  const outpoint = (input: any): string => `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`;
  expect(b.tx.inputs.map(outpoint)).toEqual(a.tx.inputs.map(outpoint));
  const callerOutputs = (s: Spend): string[] => s.tx.outputs.filter((output: any) => ofCategory(output, d.callerCat))
    .map((output: any) => `${binToHex(output.lockingBytecode)}:${output.valueSatoshis}:`
      + `${output.token.nft?.capability}:${binToHex(output.token.nft?.commitment ?? Uint8Array.of())}`);
  expect(callerOutputs(a).length).toBeGreaterThan(0);
  expect(callerOutputs(b)).toEqual(callerOutputs(a));
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

describe('a call that leaves its arguments to the callee binds the method it names (VM)', () => {
  for (const shape of SHAPES) {
    describe(`${shape.name}: ${shape.a}() beside ${shape.b}(int v)`, () => {
      it('settles the honest call through a single-function interface, and the other method\'s', async () => {
        const d = await deploy(shape);
        const a = await spend(d, 'oneA', shape.a);
        const b = await spend(d, 'oneB', shape.b);
        expectOnlyTheMethodDiffers(d, shape, a, b);
        expect(runVm(a)).toEqual({ success: true });
        expect(runVm(b)).toEqual({ success: true });
      }, 300_000);

      // OPEN: through a single-function interface an args-left call checks no selector and no record digest, so the
      // spliced spend SETTLES on today's code while the caller takes B's run for A's (for `void`, a withdrawal for a
      // deposit; for `returning`, a free read for a paid one). it.fails keeps the file green and turns red once a fix
      // binds the method; drop `.fails` then.
      it.fails('refuses a co-spent callee running another method of the same arity (single-function)', async () => {
        const d = await deploy(shape);
        const a = await spend(d, 'oneA', shape.a);
        const r = runVm(splice(a, await spend(d, 'oneB', shape.b), d.callerCat));
        expect(r.success).toBe(false);
        expectScriptRejection(r.error ?? '', master(a, d.callerCat));
      }, 300_000);

      it('refuses it through a multi-function interface, at the caller', async () => {
        const d = await deploy(shape);
        const a = await spend(d, 'twoA', shape.a);
        const b = await spend(d, 'twoB', shape.b);
        expectOnlyTheMethodDiffers(d, shape, a, b);
        expect(runVm(a)).toEqual({ success: true });
        expect(runVm(b)).toEqual({ success: true });
        const r = runVm(splice(a, b, d.callerCat));
        expect(r.success).toBe(false);
        expectScriptRejection(r.error ?? '', master(a, d.callerCat));
      }, 300_000);
    });
  }
});
