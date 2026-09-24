/**
 * phase-boundary extract: STB send-phase extract — Phase-1 discovery debug probe + post-discovery rebuild.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';

export type DiscoveryProbeProvider = {
  consensusLimits?: { maximumInputBytes?: number };
};

/**
 * Best-effort `debug()` discovery against the initial covenant build. Density-limit failures
 * throw immediately; other probe errors are logged and retained for later refusal context.
 * Always rebuilds afterward so fee measurement sees probe-discovered outputs.
 */
export function runSendDiscoveryProbe(
  covenantBuilder: TransactionBuilder,
  provider: DiscoveryProbeProvider,
  rebuild: () => TransactionBuilder,
  sendTiming: (stage: string) => void,
): { covenantBuilder: TransactionBuilder; discoveryProbeFailure?: string } {
  sendTiming('initial-build');
  // Production-sized covenants are cheap enough to debug eagerly, which provides useful source-mapped
  // diagnostics before submission. A relaxed mock provider may intentionally admit scripts hundreds of
  // kilobytes long; retaining every VM step for those scripts can take minutes and gigabytes of memory.
  const relaxedConsensus = (provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000;
  // Retained so a later covenant refusal can say WHY. This probe is best-effort, but the rebuild below depends
  // on what it discovers, so when it fails the transaction can be assembled from an unresolved shape and the
  // preflight then refuses it with a bare OP_VERIFY that names no cause.
  let discoveryProbeFailure: string | undefined;
  if (!relaxedConsensus) {
    try { covenantBuilder.debug(); } catch (_e) {
      if (typeof _e === 'object' && _e) {
        discoveryProbeFailure = (_e as Error).message;
        // Consensus-limit refusals cannot be repaired by the final signature and must not be swallowed as a
        // best-effort discovery failure. Fail immediately with the actionable density-reserve guidance.
        if (/exceed the operation cost density limit/.test(discoveryProbeFailure)) {
          throw new Error(
            'BCH-2026 operation-cost budget exceeded while probing the covenant, so the transaction cannot '
            + 'be built. The budget is operationCostBudgetPerByte x unlockingBytecodeLength, and for p2sh32 '
            + 'the redeem script counts toward that length, so reserving script bytes (Contract `salt`) '
            + `raises it. Probe reported: ${discoveryProbeFailure}`,
            { cause: _e },
          );
        }
        console.debug('STB debug() best-effort error:', discoveryProbeFailure);
      }
    }
  }

  // The debug probe can discover commitments and output counts for dynamic vmap inserts/chunks. Rebuild before
  // measuring and funding so the fee calculation sees the converged covenant shape rather than the smaller
  // pre-probe transaction. Otherwise a newly learned entry output is added only by the final build, leaving its
  // dust value unfunded (for example: 2400 sats in, 3600 sats out for the first mapping insertion).
  const rebuilt = rebuild();
  sendTiming('post-discovery-build');
  return { covenantBuilder: rebuilt, discoveryProbeFailure };
}
