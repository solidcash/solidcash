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
 * Residual (security-audit-2026-10-16 Open): a received function pointer's selector is a run-time value, so the
 * method it names at the callee may declare MORE parameters than the pointer table's element type. Before the fix,
 * the direct-build caller bound only the declared count of arguments (the last pushes before the redeem) and
 * admitted a higher-arity method's extra pushes (emitDirectCallArgumentPushes requires `pushes >= count + 1`),
 * leaving the extra parameter spender-controlled.
 *
 * The SDK will not AUTO-build such a co-spend (it derives the co-spend args from the call site's arity and validates
 * them against the method's arity, StatefulContract.ts:6788), so this exercises the covenant directly: build the
 * DIRECT fireN(1, v) with the callee co-spent as the 1-arg `inc` (buildable), then splice the co-spent callee's real
 * `incWide(a, b)` (2-arg) unlocking - a witness an attacker controls - onto that input. The table's stored selector
 * is incWide's (via reg), so the caller's selector check passes. After the fix, emitArrayExternalCallLoop pins the
 * co-spent callee's unlocking to exactly the table-type arity (+ redeem, + optional selector push), refusing it.
 */

// A callee with the table's 1-arg method (inc) and a 2-arg method (incWide). Neither writes state, so the callee's
// data-NFT output is identical for both methods (no output surgery needed for the splice).
const HANDLER2 = `pragma solidcash >=0.8.0;
interface IH2 { public bigint counter; function inc(uint256 v); function incWide(uint256 a, uint256 b); }
contract Handler2() is IH2 {
  bigint counter;
  function inc(uint256 v) { require(int(v) >= 0 && this.counter >= 0); }
  function incWide(uint256 a, uint256 b) { require(int(a) >= 0 && int(b) >= 0 && this.counter >= 0); }
}`;

// A table of RECEIVED function pointers (address + runtime selector), element type function(uint256) external.
const TABLE = `pragma solidcash >=0.8.0;
contract Table() {
  function(uint256) external[] fns;
  bigint bumps;
  function reg(function(uint256) external p) { this.fns.push(p); this.bumps = this.bumps + 1; }
  function fireN(uint256 n, uint256 v) {
    for (uint256 i = 0; i < n; i = i + 1) { fns[i](v); }
    this.bumps = this.bumps + 1;
  }
}`;

type Provider = ReturnType<typeof createTestProvider>;
const verifier = createTxVerifier({ vmVersion: 'BCH_2026_05', standard: true, skipFeePolicy: true });
const sel = (name: string): Uint8Array =>
  hexToBin(compileString(HANDLER2).abi.find((e: any) => e.name === name)!.selector!);

async function handler(provider: Provider): Promise<{ lock: string; sc: any }> {
  const art = compileString(HANDLER2);
  const base = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, base, art.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  return { lock: base.withCategory(hexToBin(categoryId)).lockingBytecode,
    sc: StatefulContract.withCategory(base, categoryId) as any };
}

async function table(provider: Provider): Promise<{ sc: any; pointer: string }> {
  const artifact = compileString(TABLE);
  const base = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, base, artifact.stateLayout!, { fns: [], __fnsel_fns: [], bumps: 0n }, { saltContract: true },
  );
  const pointer = artifact.abi.find((e: any) => e.name === 'fireN')!.externalCalls![0]!.interfaceName;
  return { sc: StatefulContract.withCategory(base, categoryId) as any, pointer };
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

/** Run the mem-cash VM over the built fireN(1, v) under a chain state past its anti-malleability locktime. */
function runVm(fireN: any): { success: boolean; error?: string } {
  const tx = fireN.buildLibauthTransaction();
  const hex = binToHex(encodeTransaction(tx));
  const sourceOutputs = generateLibauthSourceOutputs(fireN.inputs);
  const lt = Number(tx.locktime);
  const chain = lt < 500000000
    ? { height: lt + 1, medianTimePast: 1700000000 } : { height: 133700, medianTimePast: lt + 1 };
  const result = verifier.verify(hex, sourceOutputs, chain);
  return { success: result.success, error: result.success ? undefined : (result.debugMessage ?? result.error) };
}

describe('a received pointer whose runtime selector names a higher-arity callee method (VM)', () => {
  /** Build the direct fireN(1, v) with the stored selector `storeSel`; optionally splice the callee to incWide(a,b). */
  async function build(storeSel: string, v: bigint, splice?: { a: bigint; b: bigint }): Promise<any> {
    const provider = createTestProvider();
    const bb = await handler(provider);
    const t = await table(provider);
    await t.sc.reg(hexToBin(bb.lock), sel(storeSel)).send();

    t.sc.registerExternalArray(t.pointer, [bb.sc], ['inc']);
    const fireN = await t.sc.fireN(1n, v).build();
    if (!splice) return fireN;

    const target = selectorInput(fireN, sel('inc'));
    const std = await bb.sc.incWide(splice.a, splice.b).build();
    const stdTx = std.buildLibauthTransaction();
    const incWideUnlocking = stdTx.inputs[selectorInput(std, sel('incWide'))].unlockingBytecode as Uint8Array;
    const original = fireN.inputs[target].unlocker;
    fireN.inputs[target].unlocker = {
      generateLockingBytecode: (): Uint8Array => original.generateLockingBytecode(),
      generateUnlockingBytecode: (): Uint8Array => incWideUnlocking,
    };
    return fireN;
  }

  it('refuses a co-spent callee running a higher-arity method (incWide) through the table', async () => {
    // Stored selector is incWide's; the callee is spliced to run incWide(3, 10). Post-fix the caller refuses it
    // because the co-spent unlocking has an extra argument push the table's arity-1 type never declared.
    const r = runVm(await build('incWide', 3n, { a: 3n, b: 10n }));
    expect(r.success).toBe(false);
    expect(r.error ?? '').toMatch(/OP_VERIFY|OP_EQUALVERIFY|failed/i);
  }, 300_000);

  it('still settles an honest 1-arg call through the table', async () => {
    // Stored selector is inc's and the co-spent callee runs inc(3): the arity matches, so the fix admits it.
    const r = runVm(await build('inc', 3n));
    expect(r.error ?? 'ok').not.toContain('OP_VERIFY');
    expect(r.success).toBe(true);
  }, 300_000);
});
