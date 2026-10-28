import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { createTxVerifier } from '@mem-cash/validation';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';

/**
 * Residual (security-audit-2026-10-16, "Open", first bullet): a caller that calls through a SINGLE-FUNCTION
 * interface sets needsSelectorVerification = false (SymbolTableTraversal: calleeFns.length > 1), so it never
 * checks the co-spent callee's selector. When the real co-spent callee is a contract with MORE methods than the
 * interface names, its multi-method unlocking carries a 4-byte selector prefix the caller never verifies. The
 * argument binding pins only the TRAILING pushes before the redeem, so a DIFFERENT method (same trailing arg) or a
 * WIDER method (extra leading args spender-chosen) can run while the caller advances its own state believing the
 * named method ran. mem-cash BCH_2026_05, mocknet only.
 *
 * Attacker model (as the received-pointer case): build the honest single call with the callee co-spent as the
 * declared 1-arg method, then SPLICE a different co-spent method's unlocking (its own 4-byte selector) onto that
 * input. The caller never checks the selector, so pre-fix the spliced method settles. After a sound fix the
 * co-spent selector is bound to the named method, refusing the wrong method; the honest method still settles.
 */

// A callee with three methods (so its dispatcher adds a 4-byte selector prefix). Neither method writes counter, so
// the callee's data-NFT output is identical for all of them and a spliced unlocking stays structurally valid.
const CALLEE = `pragma solidcash >=0.8.0;
contract Callee() {
  bigint counter;
  function declared(uint256 v) { require(int(v) >= 0 && this.counter >= 0); }
  function other(uint256 v) { require(int(v) >= 0 && this.counter >= 0); }
  function wide(uint256 a, uint256 b) { require(int(a) >= 0 && int(b) >= 0 && this.counter >= 0); }
}`;

// A caller that calls through a SINGLE-FUNCTION interface (names only `declared`) and advances its own state.
const CALLER = `pragma solidcash >=0.8.0;
interface ISingle { function declared(uint256 v); }
contract Caller() {
  bigint bumps;
  function run(address a, uint256 v) { ISingle(a).declared(v); this.bumps = this.bumps + 1; }
}`;

type Provider = ReturnType<typeof createTestProvider>;
const verifier = createTxVerifier({ vmVersion: 'BCH_2026_05', standard: true, skipFeePolicy: true });
const sel = (name: string): Uint8Array =>
  hexToBin(compileString(CALLEE).abi.find((e: any) => e.name === name)!.selector!);

async function callee(provider: Provider): Promise<{ addr: string; sc: any }> {
  const art = compileString(CALLEE);
  const base = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, base, art.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  return { addr: base.withCategory(hexToBin(categoryId)).lockingBytecode,
    sc: StatefulContract.withCategory(base, categoryId) as any };
}

async function caller(provider: Provider): Promise<any> {
  const art = compileString(CALLER);
  const base = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, base, art.stateLayout!, { bumps: 0n }, { saltContract: true },
  );
  return StatefulContract.withCategory(base, categoryId) as any;
}

/** The index of the input in `builder` whose unlocking's first push is a 4-byte value equal to `s`. */
function selectorInput(builder: any, s: Uint8Array): number {
  const tx = builder.buildLibauthTransaction();
  for (let i = 0; i < tx.inputs.length; i++) {
    const first = decodeAuthenticationInstructions(tx.inputs[i].unlockingBytecode)[0] as { data?: Uint8Array };
    if (first?.data && first.data.length === 4 && binToHex(first.data) === binToHex(s)) return i;
  }
  throw new Error('selector input not found');
}

/** Run the mem-cash VM over the built single call under a chain state past its anti-malleability locktime. */
function runVm(call: any): { success: boolean; error?: string } {
  const tx = call.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(call.inputs);
  // F1: the caller pins its call edge as an appended output; a plain anyone-can-spend funder past every block
  // covers that dust (build() leaves it unfunded) so the VM reaches the covenant, not a value-balance stop.
  tx.inputs.push({
    outpointTransactionHash: hexToBin('11'.repeat(32)), outpointIndex: 0,
    sequenceNumber: 0xffffffff, unlockingBytecode: Uint8Array.of(),
  });
  sourceOutputs.push({ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1_000_000n });
  const hex = binToHex(encodeTransaction(tx));
  const lt = Number(tx.locktime);
  const chain = lt < 500000000
    ? { height: lt + 1, medianTimePast: 1700000000 } : { height: 133700, medianTimePast: lt + 1 };
  const result = verifier.verify(hex, sourceOutputs, chain);
  return { success: result.success, error: result.success ? undefined : (result.debugMessage ?? result.error) };
}

/** Splice the callee input's honest `declared` unlocking with a co-spent callee's real `<method>(...)` unlocking. */
function splice(call: any, calleeSc: any, method: string, args: bigint[]): Promise<any> {
  return (async (): Promise<any> => {
    const target = selectorInput(call, sel('declared'));
    const built = await calleeSc[method](...args).build();
    const builtTx = built.buildLibauthTransaction();
    const unlocking = builtTx.inputs[selectorInput(built, sel(method))].unlockingBytecode as Uint8Array;
    const original = call.inputs[target].unlocker;
    call.inputs[target].unlocker = {
      generateLockingBytecode: (): Uint8Array => original.generateLockingBytecode(),
      generateUnlockingBytecode: (): Uint8Array => unlocking,
    };
    return call;
  })();
}

describe('a single-function-interface void call to a multi-method callee binds the method (VM)', () => {
  it('still settles the honest declared method co-spend', async () => {
    const provider = createTestProvider();
    const h = await callee(provider);
    const sc = await caller(provider);
    const run = await sc.run(hexToBin(h.addr), 3n).withExternalCall(h.sc, 'declared', [3n]).build();
    const r = runVm(run);
    expect(r.error ?? 'ok').not.toContain('OP_VERIFY');
    expect(r.success).toBe(true);
  }, 300_000);

  // FIXED (approach B, callee-attested void call record `digest || 0x01`): the caller names only `declared` through a
  // single-function interface, so it verifies no co-spent selector. Before the fix a co-spend running a DIFFERENT
  // same-arity method (`other`, whose trailing argument agrees with the bound value) SETTLED while the caller advanced
  // its state. Now the callee attests the method it ran as a void call record and the caller binds the co-spent method
  // to it, so the wrong-method co-spend is REFUSED while the honest `declared` co-spend still settles.
  it('refuses a co-spent callee running a DIFFERENT same-arity method (other)', async () => {
    const provider = createTestProvider();
    const h = await callee(provider);
    const sc = await caller(provider);
    const run = await sc.run(hexToBin(h.addr), 3n).withExternalCall(h.sc, 'declared', [3n]).build();
    const r = runVm(await splice(run, h.sc, 'other', [3n]));
    expect(r.success).toBe(false);
    expect(r.error ?? '').toMatch(/OP_VERIFY|OP_EQUALVERIFY|OP_NUMEQUALVERIFY|failed/i);
  }, 300_000);

  // A WIDER method (`wide`, two arguments) is refused pre-fix: its extra leading push shifts the co-spent unlocking
  // enough for the existing argument-count binding to reject it. Same-arity method confusion (above) is the
  // residual hole the argument binding does not cover.
  it('refuses a co-spent callee running a WIDER method (wide) whose extra leading arg is spender-chosen', async () => {
    const provider = createTestProvider();
    const h = await callee(provider);
    const sc = await caller(provider);
    const run = await sc.run(hexToBin(h.addr), 3n).withExternalCall(h.sc, 'declared', [3n]).build();
    // wide(a, b): the trailing push b = 3n agrees with the caller's bound argument; a = 10n is attacker-chosen.
    const r = runVm(await splice(run, h.sc, 'wide', [10n, 3n]));
    expect(r.success).toBe(false);
    expect(r.error ?? '').toMatch(/OP_VERIFY|OP_EQUALVERIFY|OP_NUMEQUALVERIFY|failed/i);
  }, 300_000);
});
