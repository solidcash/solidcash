import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { asmToBytecode } from '@solidcash/utils';
import { compileFileMulti } from '../src/compileFile.js';
import { effectiveAccelerationContractsRoot } from './effectiveacceleration-corpus.js';

/**
 * Current-tree integration check on the REAL Unicrow corpus (the marketplace symlink
 * `.marketplace/contracts/unicrow/Unicrow.sol` resolves to). Two handlers carry the read-modify-writeback idiom:
 *
 *   Escrow memory escrow = escrows[escrowId];
 *   escrow.split[WHO_BUYER] = 10000; ... escrow.consensus[WHO_BUYER] = abs8(...) + 1; ...
 *   escrows[escrowId].split = escrow.split; escrows[escrowId].consensus = escrow.consensus;
 *   escrows[escrowId].claimed = 1;
 *
 * `refund` folds a 3-field run and `release` folds its single `consensus` write-back (via the kernel's early
 * `__mefw` coalesce). ReuseEntryLocalForWriteback re-targets each whole-struct write-back at the already-taken
 * `escrow` local, eliding exactly one entry re-read per run. This test verifies BOTH the baseline-independent
 * invariant (handlers and artifact strictly shrink) and the delivered bytecode reduction, measured in BYTES via
 * `asmToBytecode` (the artifact's `.bytecode` is an ASM string, so its `.length` is characters, not bytes).
 *
 * Measured on this tree (kernel route): refund handler 2065 -> 1957 (-108 bytes), release handler 1304 -> 1189
 * (-115 bytes), total artifact 74811 -> 74573 bytes (-238 bytes). The July deferral note recorded -339 bytes for
 * the refund handler alone on the pre-block-layout-v2 baseline (5683-byte handler); block-layout-v2 and later
 * codegen shrank the handlers, so the same elisions now total 238 bytes. Structural correctness
 * (elidedReads === 1, byte-identity, fail-closed) is locked by ReuseEntryLocalForWritebackRewrite.test.ts and
 * ReuseEntryLocalForWriteback.test.ts.
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

const artifactBytes = (artifact: { bytecode: string }): number => asmToBytecode(artifact.bytecode).length;

describe.skipIf(contractsRoot === undefined)('ReuseEntryLocalForWriteback on the real Unicrow refund', () => {
  it('delivers the bytecode reduction: handler shrinks and the artifact drops at least 200 bytes', () => {
    const source = path.join(contractsRoot!, 'unicrow', 'Unicrow.sol');
    const withPass = compileFileMulti(source, OPTIONS).Unicrow;
    const withoutPass = compileFileMulti(source, { ...OPTIONS, reuseEntryLocalForWriteback: false }).Unicrow;
    const refund = withPass.abi.find((entry) => entry.name === 'refund');
    expect(refund).toBeDefined();
    const withBytes = bodyBytes(withPass, refund!.selector);
    const withoutBytes = bodyBytes(withoutPass, refund!.selector);
    // Baseline-independent invariant: the pass elides one entry re-read, so the enabled build is strictly smaller.
    expect(withoutBytes).toBeGreaterThan(withBytes);
    // Delivered bytecode reduction, measured in real bytes: the pass must shrink the whole artifact by a
    // meaningful floor. On this tree it is 238 bytes (refund -108, release -115, plus route deltas); the July
    // deferral note's -339 B was the refund handler alone on the larger pre-block-layout-v2 baseline.
    expect(artifactBytes(withoutPass) - artifactBytes(withPass)).toBeGreaterThanOrEqual(200);
  });
});
