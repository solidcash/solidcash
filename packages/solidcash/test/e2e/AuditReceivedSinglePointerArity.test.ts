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
 * Residual (security-audit-2026-10-16): the received function-pointer TABLE arity hole was fixed for the loop
 * path (emitArrayExternalCallLoop). A SINGLE received pointer - held as a STORAGE field or received as a
 * PARAMETER and called once, NOT a table/loop - takes the other codegen path (emitExternalCallVerification's
 * `slot.fnPtrCall` selector branch). Its selector is a run-time witness too, so a stored/passed selector may name
 * a callee method of HIGHER arity than the pointer type. The single-call path verified only the selector, never
 * the push count, so the extra argument(s) of a wider method were spender-controlled while the caller advanced
 * its own state (directCallArgumentBinding returns undefined for a runtime selector, so no argument is bound).
 *
 * Attacker model (as the table case): build the honest single call with the callee co-spent as the declared
 * 1-arg `inc`, then SPLICE the real 2-arg `incWide` unlocking - a witness an attacker controls - onto that input.
 * The stored/passed selector is incWide's, so the caller's selector check passes. After the fix, the single-call
 * path pins the co-spent unlocking to exactly the pointer type's arity (+ redeem, selector split off first),
 * refusing it. mem-cash BCH_2026_05, mocknet only.
 *
 * Value sub-case (same arity, different VALUE): the arity pin caps the push COUNT, not the argument VALUES. A
 * single received pointer's co-spent arguments were unbound (directCallArgumentBinding returns undefined for a
 * run-time selector), so the EXACT-arity method ran on spender-chosen values while the caller advanced its own
 * state. Attacker model: build the honest `inc(v)` co-spend, then SPLICE an `inc(v')` unlocking (v' != v) onto it.
 * After the value fix the caller OP_EQUALVERIFYs each declared-arity argument against the co-spent push, refusing
 * v' != v; the honest value still settles.
 */

// A callee with a 1-arg method (inc) and a 2-arg method (incWide). Neither writes counter, so the callee's
// data-NFT output is identical for both methods and the spliced unlocking stays structurally valid.
const HANDLER = `pragma solidcash >=0.8.0;
interface IH { public bigint counter; function inc(uint256 v); function incWide(uint256 a, uint256 b); }
contract Handler() is IH {
  bigint counter;
  function inc(uint256 v) { require(int(v) >= 0 && this.counter >= 0); }
  function incWide(uint256 a, uint256 b) { require(int(a) >= 0 && int(b) >= 0 && this.counter >= 0); }
}`;

// A SINGLE received pointer held in STORAGE (address `stored` + companion `bytes4 __fnsel_stored`), element type
// function(uint256) external. `save` installs a received value so the var flattens to the pair; `run` reads the
// pair and calls it once (the single-call co-spend path). The pair is seeded directly, `save` need not be sent.
const STORE = `pragma solidcash >=0.8.0;
contract Store() {
  function(uint256) external stored;
  bigint bumps;
  function save(function(uint256) external y) { this.stored = y; this.bumps = this.bumps + 1; }
  function run(uint256 v) { stored(v); this.bumps = this.bumps + 1; }
}`;

// A SINGLE received pointer taken as a PARAMETER (split to address + bytes4 selector) and called once.
const PARAM = `pragma solidcash >=0.8.0;
contract Param() {
  bigint bumps;
  function fireWith(function(uint256) external cb, uint256 v) { cb(v); this.bumps = this.bumps + 1; }
}`;

type Provider = ReturnType<typeof createTestProvider>;
const verifier = createTxVerifier({ vmVersion: 'BCH_2026_05', standard: true, skipFeePolicy: true });
const sel = (name: string): Uint8Array =>
  hexToBin(compileString(HANDLER).abi.find((e: any) => e.name === name)!.selector!);

async function handler(provider: Provider): Promise<{ addr: string; sc: any }> {
  const art = compileString(HANDLER);
  const base = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, base, art.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  return { addr: base.withCategory(hexToBin(categoryId)).lockingBytecode,
    sc: StatefulContract.withCategory(base, categoryId) as any };
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
  const hex = binToHex(encodeTransaction(tx));
  const sourceOutputs = generateLibauthSourceOutputs(call.inputs);
  const lt = Number(tx.locktime);
  const chain = lt < 500000000
    ? { height: lt + 1, medianTimePast: 1700000000 } : { height: 133700, medianTimePast: lt + 1 };
  const result = verifier.verify(hex, sourceOutputs, chain);
  return { success: result.success, error: result.success ? undefined : (result.debugMessage ?? result.error) };
}

/** Splice the callee input's honest `inc` unlocking with the co-spent callee's real `incWide(a, b)` unlocking. */
function splice(call: any, handlerSc: any, a: bigint, b: bigint): Promise<any> {
  return (async (): Promise<any> => {
    const target = selectorInput(call, sel('inc'));
    const wide = await handlerSc.incWide(a, b).build();
    const wideTx = wide.buildLibauthTransaction();
    const wideUnlocking = wideTx.inputs[selectorInput(wide, sel('incWide'))].unlockingBytecode as Uint8Array;
    const original = call.inputs[target].unlocker;
    call.inputs[target].unlocker = {
      generateLockingBytecode: (): Uint8Array => original.generateLockingBytecode(),
      generateUnlockingBytecode: (): Uint8Array => wideUnlocking,
    };
    return call;
  })();
}

/** Splice the callee input's honest `inc(v)` unlocking with a co-spent callee's real `inc(vPrime)` unlocking. */
function spliceInc(call: any, handlerSc: any, vPrime: bigint): Promise<any> {
  return (async (): Promise<any> => {
    const target = selectorInput(call, sel('inc'));
    const other = await handlerSc.inc(vPrime).build();
    const otherTx = other.buildLibauthTransaction();
    const otherUnlocking = otherTx.inputs[selectorInput(other, sel('inc'))].unlockingBytecode as Uint8Array;
    const original = call.inputs[target].unlocker;
    call.inputs[target].unlocker = {
      generateLockingBytecode: (): Uint8Array => original.generateLockingBytecode(),
      generateUnlockingBytecode: (): Uint8Array => otherUnlocking,
    };
    return call;
  })();
}

describe('a single received STORAGE pointer whose runtime selector names a higher-arity callee (VM)', () => {
  async function store(provider: Provider, storedSel: string, hAddr: string): Promise<any> {
    const art = compileString(STORE);
    const base = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, base, art.stateLayout!,
      { stored: hexToBin(hAddr), __fnsel_stored: sel(storedSel), bumps: 0n }, { saltContract: true },
    );
    return StatefulContract.withCategory(base, categoryId) as any;
  }

  it('refuses a co-spent callee running a higher-arity method (incWide) through the stored pointer', async () => {
    const provider = createTestProvider();
    const h = await handler(provider);
    const sc = await store(provider, 'incWide', h.addr);
    const run = await sc.run(3n).withExternalCall(h.sc, 'inc', [3n]).build();
    const r = runVm(await splice(run, h.sc, 3n, 10n));
    expect(r.success).toBe(false);
    expect(r.error ?? '').toMatch(/OP_VERIFY|OP_EQUALVERIFY|OP_NUMEQUALVERIFY|failed/i);
  }, 300_000);

  it('still settles an honest 1-arg call through the stored pointer', async () => {
    const provider = createTestProvider();
    const h = await handler(provider);
    const sc = await store(provider, 'inc', h.addr);
    const run = await sc.run(3n).withExternalCall(h.sc, 'inc', [3n]).build();
    const r = runVm(run);
    expect(r.error ?? 'ok').not.toContain('OP_VERIFY');
    expect(r.success).toBe(true);
  }, 300_000);

  it('refuses an exact-arity co-spend carrying a different argument value through the stored pointer', async () => {
    const provider = createTestProvider();
    const h = await handler(provider);
    const sc = await store(provider, 'inc', h.addr);
    const run = await sc.run(3n).withExternalCall(h.sc, 'inc', [3n]).build();
    const r = runVm(await spliceInc(run, h.sc, 10n));
    expect(r.success).toBe(false);
    expect(r.error ?? '').toMatch(/OP_VERIFY|OP_EQUALVERIFY|OP_NUMEQUALVERIFY|failed/i);
  }, 300_000);
});

describe('a single received PARAMETER pointer whose runtime selector names a higher-arity callee (VM)', () => {
  async function param(provider: Provider): Promise<any> {
    const art = compileString(PARAM);
    const base = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, base, art.stateLayout!, { bumps: 0n }, { saltContract: true },
    );
    return StatefulContract.withCategory(base, categoryId) as any;
  }

  it('refuses a co-spent callee running a higher-arity method (incWide) through the passed pointer', async () => {
    const provider = createTestProvider();
    const h = await handler(provider);
    const sc = await param(provider);
    const fire = await sc.fireWith(hexToBin(h.addr), sel('incWide'), 3n)
      .withExternalCall(h.sc, 'inc', [3n]).build();
    const r = runVm(await splice(fire, h.sc, 3n, 10n));
    expect(r.success).toBe(false);
    expect(r.error ?? '').toMatch(/OP_VERIFY|OP_EQUALVERIFY|OP_NUMEQUALVERIFY|failed/i);
  }, 300_000);

  it('still settles an honest 1-arg call through the passed pointer', async () => {
    const provider = createTestProvider();
    const h = await handler(provider);
    const sc = await param(provider);
    const fire = await sc.fireWith(hexToBin(h.addr), sel('inc'), 3n)
      .withExternalCall(h.sc, 'inc', [3n]).build();
    const r = runVm(fire);
    expect(r.error ?? 'ok').not.toContain('OP_VERIFY');
    expect(r.success).toBe(true);
  }, 300_000);

  it('refuses an exact-arity co-spend carrying a different argument value through the passed pointer', async () => {
    const provider = createTestProvider();
    const h = await handler(provider);
    const sc = await param(provider);
    const fire = await sc.fireWith(hexToBin(h.addr), sel('inc'), 3n)
      .withExternalCall(h.sc, 'inc', [3n]).build();
    const r = runVm(await spliceInc(fire, h.sc, 10n));
    expect(r.success).toBe(false);
    expect(r.error ?? '').toMatch(/OP_VERIFY|OP_EQUALVERIFY|OP_NUMEQUALVERIFY|failed/i);
  }, 300_000);
});
