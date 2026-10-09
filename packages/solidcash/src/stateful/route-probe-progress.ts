/**
 * phase-boundary extract: progressive route-probe progress helpers
 * (phase-boundary extract from StatefulContract.ts).
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  valueChunkWriteResourceIdentity,
  type ValueChunkWriteDescriptor,
} from './value-chunk-persist.js';

export type RouteProbeObservation = {
  identity: string;
  fingerprint: string;
};

export type RouteProbeObservationHistory = Map<string, string>;

/** A resource fingerprint excludes relocatable physical geometry. */
export function routeValueRunFingerprint(chunks: readonly {
  outputIndex: number; commitment: string; lockingBytecode: Uint8Array;
}[]): string {
  const ordered = [...chunks].sort((left, right) => left.outputIndex - right.outputIndex);
  const base = ordered[0]?.outputIndex ?? 0;
  if (ordered.some((chunk, index) => chunk.outputIndex !== base + index)) {
    throw new Error('Route value-run materialization must occupy one contiguous output band.');
  }
  return ordered.map((chunk) => [
    chunk.outputIndex - base, chunk.commitment, binToHex(chunk.lockingBytecode),
  ].join(':')).join('|');
}

/**
 * Record probe facts by their compiler-authenticated resource, independently of physical builder mutations.
 * Physical output indices can move while earlier participant slots hydrate, so callers fingerprint value runs
 * relative to their base. Different semantic bytes for one kernel resource remain an SDK/compiler disagreement.
 */
export function recordRouteProbeObservation(
  observations: RouteProbeObservationHistory,
  observation: RouteProbeObservation,
  convention?: 'legacy-unroll' | 'kernel-row-loop',
): 'new' | 'same' | 'changed' {
  const previous = observations.get(observation.identity);
  if (previous === undefined) {
    observations.set(observation.identity, observation.fingerprint);
    return 'new';
  }
  if (previous === observation.fingerprint) return 'same';
  if (convention === 'kernel-row-loop') {
    throw new Error(
      `Kernel route probe produced unstable materialization for ${observation.identity}.`,
    );
  }
  observations.set(observation.identity, observation.fingerprint);
  return 'changed';
}

/** Static convergence budget: each entry may reveal its address and commitment; each value resource its pin/run. */
export function progressiveRouteProbePassLimit(
  entrySlotCount: number,
  writes: readonly ValueChunkWriteDescriptor[],
): number {
  const resources = new Set(writes.map(valueChunkWriteResourceIdentity));
  return Math.max(1, 2 * entrySlotCount + 2 * Math.max(1, resources.size) + 1);
}

/**
 * Count only entry coordinates reachable from the participant currently being probed. An unrelated participant
 * cannot reveal a fact in this trace and therefore must not enlarge this participant's convergence budget.
 */
export function routeProbeRepairableEntryCoordinateCount(
  group: {
    categoryId: string;
    masterUtxo: { txid: string; vout: number };
    blockLayout?: { slots: readonly { kind: string; offset: number }[] };
  },
  embeddedDelegate?: {
    categoryId: string;
    masterUtxo: { txid: string; vout: number };
    blockLayout?: { slots: readonly { kind: string; offset: number }[] };
  },
): number {
  const coordinates = new Set<string>();
  for (const carrier of [group, embeddedDelegate]) {
    if (!carrier?.blockLayout) continue;
    const owner = [
      carrier.categoryId.toLowerCase(),
      carrier.masterUtxo.txid.toLowerCase(),
      carrier.masterUtxo.vout,
    ].join(':');
    for (const slot of carrier.blockLayout.slots) {
      if (slot.kind === 'entry') coordinates.add(`${owner}:${slot.offset}`);
    }
  }
  return coordinates.size;
}

export function permitsRouteValueChunkDerivation(
  convention: 'legacy-unroll' | 'kernel-row-loop' | undefined,
  writes: readonly ValueChunkWriteDescriptor[],
): boolean {
  return convention !== 'kernel-row-loop' || writes.length > 0;
}

export function routeProbeEntrySlotOffsetForOutput(
  outputIndex: number,
  layouts: Array<{ base: number; slots?: Array<{ kind: string; offset?: number }> }>,
): number | undefined {
  for (const { base, slots } of layouts) {
    if (!slots || base < 0) continue;
    const relative = outputIndex - base;
    const atIndex = slots[relative];
    if (atIndex?.kind === 'entry') return atIndex.offset ?? relative;
    const byOffset = slots.find((slot) => slot.kind === 'entry' && slot.offset === relative);
    if (byOffset) return byOffset.offset ?? relative;
  }
  return undefined;
}
