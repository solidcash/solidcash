import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reproduceUnicrow339 } from './repro/reproduce-unicrow-339.mjs';

/**
 * Criterion 5's literal magnitude, reproduced from pinned inputs rather than re-measured on the drifted tree.
 *
 * The July-2026 figure `5683 -> 5344` (-339 B) is only true on the compiler revision that recorded it
 * (f74707345, before block-layout-v2 and the later codegen shrank the handler baseline ~3x). This test re-runs
 * the pinned reproduction (see test/repro/reproduce-unicrow-339.mts): it builds that revision in a throwaway
 * worktree, applies the July-shaped ReuseEntryLocalForWriteback port, and compiles the corpus Unicrow `refund`
 * twice. The corpus source itself is stable (Unicrow.sol last changed 2024-11-26).
 *
 * Gated on the corpus checkout exactly like the current-tree size test, so environments without the sibling
 * EffectiveAcceleration repo skip it.
 */
const CORPUS = '/Code/effectiveacceleration.ai/contract/contracts/unicrow/Unicrow.sol';

describe.skipIf(!fs.existsSync(CORPUS))('Unicrow refund -339 B reproduction', () => {
  it('reproduces 5683 -> 5344 on the pinned pre-block-layout-v2 compiler', () => {
    const result = reproduceUnicrow339();
    expect(result.without).toBe(5683);
    expect(result.withPass).toBe(5344);
    expect(result.delta).toBe(339);
  }, 600_000);
});
