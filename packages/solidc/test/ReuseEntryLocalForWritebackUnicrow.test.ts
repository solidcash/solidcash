import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileFileMulti } from '../src/compileFile.js';
import { effectiveAccelerationContractsRoot } from './effectiveacceleration-corpus.js';

/**
 * Current-tree measurement on the REAL Unicrow `refund` (the corpus source the marketplace symlink
 * `.marketplace/contracts/unicrow/Unicrow.sol` resolves to). `refund` is the read-modify-writeback idiom:
 *
 *   Escrow memory escrow = escrows[escrowId];
 *   escrow.split[WHO_BUYER] = 10000; ... escrow.consensus[WHO_BUYER] = abs8(...) + 1; ...
 *   escrows[escrowId].split = escrow.split; escrows[escrowId].consensus = escrow.consensus;
 *   escrows[escrowId].claimed = 1;
 *
 * ReuseEntryLocalForWriteback re-targets the whole-struct write-back at the already-taken `escrow` local instead of
 * the fresh `__mefw` snapshot CoalesceMappingEntryFieldWrites would otherwise re-read the entry into. The shipped
 * pass, measured here under the kernel route, elides exactly that one entry re-read: the `refund` handler body is
 * 2065 -> 1957 bytes (-108 B). These absolutes are pinned against the stable corpus checkout (Unicrow.sol last
 * changed 2024-11-26); they drift only when a codegen change re-sizes the handler, which is exactly the regression
 * this pin exists to flag.
 *
 * Criterion 5's recorded magnitude `~339 B (5683 -> 5344)` predates block-layout-v2. `ReuseEntryLocalForWritebackUnicrowRepro.test.ts`
 * drives the SAME shipped pass source against the pre-block-layout-v2 compiler that recorded that figure and pins
 * 5683 -> 5344. The byte-identity and fail-closed reduction on a synthetic source is locked by
 * `ReuseEntryLocalForWriteback.test.ts`.
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
  it('elides the escrow entry re-read: handler 2065 -> 1957 bytes (-108 B)', () => {
    const source = path.join(contractsRoot!, 'unicrow', 'Unicrow.sol');
    const withPass = compileFileMulti(source, OPTIONS).Unicrow;
    const withoutPass = compileFileMulti(source, { ...OPTIONS, reuseEntryLocalForWriteback: false }).Unicrow;
    const refund = withPass.abi.find((entry) => entry.name === 'refund');
    expect(refund).toBeDefined();
    const withBytes = bodyBytes(withPass, refund!.selector);
    const withoutBytes = bodyBytes(withoutPass, refund!.selector);
    // The pass elides one entry re-read, so the enabled build must be exactly this much smaller on the current
    // tree. A zero/negative delta means the pass stopped firing; a different delta means codegen re-sized the
    // handler, which this absolute pin exists to catch.
    expect(withoutBytes).toBe(2065);
    expect(withBytes).toBe(1957);
    expect(withoutBytes - withBytes).toBe(108);
    // The refund route is cloned by the kernel, so the total artifact must shrink too.
    expect(withoutPass.bytecode.length).toBeGreaterThan(withPass.bytecode.length);
  });
});
