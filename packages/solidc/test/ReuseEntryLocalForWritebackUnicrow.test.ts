import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileFileMulti } from '../src/compileFile.js';
import { effectiveAccelerationContractsRoot } from './effectiveacceleration-corpus.js';

/**
 * Current-tree invariant check on the REAL Unicrow `refund` (the corpus source the marketplace symlink
 * `.marketplace/contracts/unicrow/Unicrow.sol` resolves to). `refund` is the read-modify-writeback idiom:
 *
 *   Escrow memory escrow = escrows[escrowId];
 *   escrow.split[WHO_BUYER] = 10000; ... escrow.consensus[WHO_BUYER] = abs8(...) + 1; ...
 *   escrows[escrowId].split = escrow.split; escrows[escrowId].consensus = escrow.consensus;
 *   escrows[escrowId].claimed = 1;
 *
 * ReuseEntryLocalForWriteback re-targets the whole-struct write-back at the already-taken `escrow` local instead of
 * the fresh `__mefw` snapshot CoalesceMappingEntryFieldWrites would otherwise re-read the entry into. On the
 * current tree this test does NOT pin an absolute byte count (that drifted with block-layout-v2); it verifies the
 * invariant directly: disabling the pass strictly enlarges the handler body and the total artifact, because the
 * pass elides the redundant entry re-read.
 *
 * Criterion 5's literal `~339 B (5683 -> 5344)` magnitude is reproduced from pinned inputs by
 * `ReuseEntryLocalForWritebackUnicrowRepro.test.ts`; the byte-identity and fail-closed reduction on a synthetic
 * source is locked by `ReuseEntryLocalForWriteback.test.ts`.
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
    // The pass must strictly shrink the handler body (it elides one entry re-read); a zero/negative delta would
    // mean the pass stopped firing or grew code elsewhere.
    expect(withoutBytes).toBeGreaterThan(withBytes);
    // The refund route is cloned by the kernel, so the total artifact must shrink too.
    expect(withoutPass.bytecode.length).toBeGreaterThan(withPass.bytecode.length);
  });
});
