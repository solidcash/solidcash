/**
 * The derivation-path gate: run the shapes that broke on the FAITHFUL path against a real-limits provider.
 *
 * WHY THIS FILE EXISTS. `relaxedConsensus` and `useSparseProbe` are both selected by
 * `(provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000`. Electrum, regtest, FullStack and Bitcoin
 * RPC publish no `consensusLimits`, so they always take the faithful full-trace path; `MockNetworkProvider`
 * publishes 1,000,000, so the whole mocknet suite takes the sparse/observer path. The two are different
 * algorithms, and ten e2e tests once passed on the sparse one while failing on the faithful one - a defect on
 * the branch every live network takes, invisible to a green mocknet run. Fixed in `2b05b292` by feeding both
 * branches the same trace shape.
 *
 * WHY NOT JUST FLIP THE MOCK DEFAULT. Measured and rejected, twice:
 *  - `maximumInputBytes` is CONFLATED. It also feeds `maximumBytecodeLength` and
 *    `maximumStandardUnlockingBytecodeLength`, so lowering it to select the faithful path also tightens the
 *    script-size limit and breaks size tests that have nothing to do with derivation.
 *  - Forcing the gates directly, with limits untouched, works but costs minutes: one nested struct-array file
 *    alone goes from about 10 s to 161 s, because the faithful path retains every VM step.
 * So the suite keeps its sparse default for speed, and THIS file is the standing coverage that the faithful
 * path - the one production uses - still derives these shapes correctly. It is deliberately small.
 *
 * The provider here publishes the REAL BCH-2026 limits, which is what a live network enforces, so the gate is
 * `maximumInputBytes: 10_000` and the faithful branch is selected exactly as it is off-chain.
 */
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/stateful/index.js';
import MockNetworkProvider, { MOCK_CONSENSUS_LIMITS } from '../../src/network/MockNetworkProvider.js';
import type { Signer } from '../../src/index.js';

/** A provider on the FAITHFUL derivation path: real `maximumInputBytes`, everything else left alone. */
const faithfulProvider = (): MockNetworkProvider => new MockNetworkProvider({
  consensusLimits: { ...MOCK_CONSENSUS_LIMITS, maximumInputBytes: 10_000 },
});

async function faithfulSigner(provider: MockNetworkProvider): Promise<Signer> {
  const [signer] = await provider.getSigners(1, { fundingUtxos: 1, satoshis: 1_000_000n });
  return signer;
}

// A dynamic chunked write: the shape whose commitments the probe has to discover, and the one that failed on
// the faithful path with a bare OP_VERIFY before 2b05b292.
const CHUNKED = `pragma solidcash ^0.14.0;
contract C() {
  bytes a;
  bytes b;
  function setA(bytes v) { this.a = v; }
  function setB(bytes v) { this.b = v; }
}`;

// Over the real operation-cost budget at any script length: the loop's cost grows with `n` while the budget its
// script buys stays fixed. (The five-dispatch ten-element fn-ptr table this title used fits since the October
// hardening lengthened the covenant, as BehaviorParityPins records.)
const OVER_BUDGET_LOOP = `contract C {
  function spin(int n) public returns (bool) {
    int acc = 0;
    for (int i = 0; i < n; i++) { acc = acc + i; }
    require(acc >= 0);
    return true;
  }
}`;

// A whole-array assign, the X171 family.
const ARRAY_ASSIGN = `pragma solidcash ^0.14.0;
contract C() {
  bigint[] xs;
  function assign() { this.xs = [1, 2, 3]; }
  function chk(bigint e) { require(this.xs[1] == e); }
}`;

describe('the faithful derivation path (what every live network takes)', () => {
  it('selects the faithful branch, which the rest of the suite never exercises', () => {
    const provider = faithfulProvider();
    // The gate itself, asserted rather than assumed: at the real limit the predicate is false, so
    // `relaxedConsensus` and `useSparseProbe` are both off and the full-trace path is taken.
    expect((provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000).toBe(false);
    // And the default provider does the opposite, which is the split this file stands guard over.
    expect((new MockNetworkProvider().consensusLimits?.maximumInputBytes ?? 10_000) > 10_000).toBe(true);
  });

  it('reports an operation-cost refusal raised inside the probe instead of swallowing it', async () => {
    // The probe's `try/catch` is best-effort for a reason - the signature is not final at probe time, so a
    // `require(checkSig(...))` can fail there and still be fine in the finished transaction. A consensus-limit
    // refusal is not that: the final transaction does at least as much work against a budget its own unlocking
    // length buys. Swallowed, the fn-ptr shape this title used ground on from an unresolved shape and reported an
    // unrelated failure 141 s later. It must name the density refusal, and quickly.
    const provider = faithfulProvider();
    const artifact = compileString(OVER_BUDGET_LOOP, { forceStateful: true });
    const sc = await getContractFactory(artifact, await faithfulSigner(provider)).deploy() as any;
    const started = Date.now();
    // 100,000 iterations cost far more than the largest budget a 10,000-byte input buys (about 8M units).
    await expect(sc.spin(100_000n)).rejects.toThrow(/operation-cost budget exceeded while probing|operation cost density/);
    expect(Date.now() - started).toBeLessThan(30_000);
  });

  it('derives dynamic chunked writes on the faithful path', async () => {
    const provider = faithfulProvider();
    const artifact = compileString(CHUNKED, { forceStateful: true, chunkedArrays: true });
    const sc = await getContractFactory(artifact, await faithfulSigner(provider)).deploy() as any;
    await expect(sc.setA(new Uint8Array(40).fill(1))).resolves.toBeDefined();
    await expect(sc.setB(new Uint8Array(40).fill(2))).resolves.toBeDefined();
  });

  it('derives a whole-array assign on the faithful path, and the covenant still refuses a wrong read', async () => {
    const provider = faithfulProvider();
    const artifact = compileString(ARRAY_ASSIGN, { forceStateful: true });
    const sc = await getContractFactory(artifact, await faithfulSigner(provider)).deploy() as any;
    await expect(sc.assign()).resolves.toBeDefined();
    await expect(sc.chk(2n)).resolves.toBeDefined();
    // Fail-closed on the same path: derivation being correct must not mean the covenant stopped checking.
    await expect(sc.chk(99n)).rejects.toThrow();
  });
});
