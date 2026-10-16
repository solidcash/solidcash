import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileFileMulti } from '../src/compileFile.js';
import { effectiveAccelerationContractsRoot } from './effectiveacceleration-corpus.js';

/**
 * Criterion 5's size measurement on the REAL Unicrow `refund` (the tracked corpus source the marketplace symlink
 * `.marketplace/contracts/unicrow/Unicrow.sol` resolves to). `refund` is the read-modify-writeback idiom:
 *
 *   Escrow memory escrow = escrows[escrowId];
 *   escrow.split[WHO_BUYER] = 10000; ... escrow.consensus[WHO_BUYER] = abs8(...) + 1; ...
 *   escrows[escrowId].split = escrow.split; escrows[escrowId].consensus = escrow.consensus;
 *   escrows[escrowId].claimed = 1;
 *
 * ReuseEntryLocalForWriteback re-targets the whole-struct write-back at the already-taken `escrow` local instead of
 * the fresh `__mefw` snapshot CoalesceMappingEntryFieldWrites would otherwise re-read the entry into. The observable
 * is the `refund` handler-body byte delta: without the pass the fold re-reads the entry (2065 B), with it the local
 * supplies the carried-over fields (1957 B). The exact figure is pinned so bytecode drift from other passes is a
 * deliberate re-pin, not a silent regression; it also must remain strictly positive (a missed optimization).
 *
 * The plan's `~339 B (5683 -> 5344)` figure is the SAME optimization as July 2026: it elides one full entry re-read,
 * whose absolute cost block-layout-v2 and later codegen shrank ~3x. The deviation is recorded in plan.md's
 * "## Deviations"; this test pins the current magnitudes, not the stale absolute figure.
 */
const contractsRoot = effectiveAccelerationContractsRoot();

const OPTIONS = {
  evmCompat: true,
  ecrecover: 'p2pkh',
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
  messageBus: true,
  messageBusKernel: true,
  messageBusGraphContext: true,
  maximumInputBytes: 10_000_000,
  commitmentLimit: 10_000_000,
  __artifactCache: false,
  compileDeclarations: ['Unicrow'],
} as const;

const bodyBytes = (artifact: { functionBodies?: Record<string, string> }, selector: string): number => {
  const body = artifact.functionBodies?.[selector];
  return typeof body === 'string' ? body.length / 2 : 0;
};

describe.skipIf(contractsRoot === undefined)('ReuseEntryLocalForWriteback on the real Unicrow refund', () => {
  it('shrinks the refund handler body by reusing the escrow local (no fresh entry re-read)', () => {
    const source = path.join(contractsRoot!, 'unicrow', 'Unicrow.sol');
    const withPass = compileFileMulti(source, OPTIONS).Unicrow;
    const withoutPass = compileFileMulti(source, { ...OPTIONS, reuseEntryLocalForWriteback: false }).Unicrow;
    const refund = withPass.abi.find((entry) => entry.name === 'refund');
    expect(refund).toBeDefined();
    const withBytes = bodyBytes(withPass, refund!.selector);
    const withoutBytes = bodyBytes(withoutPass, refund!.selector);
    expect(withoutBytes - withBytes).toBe(108);
    expect(withoutBytes).toBeGreaterThan(withBytes);
    // The refund route is cloned by the kernel, so the total artifact also shrinks; pin both magnitudes.
    expect((withoutPass.bytecode.length - withPass.bytecode.length) / 2).toBe(241);
  });
});
