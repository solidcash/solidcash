/**
 * phase-boundary extract: kernel value-chunk resource lane / entry-collection helpers
 * (phase-boundary extract from StatefulContract.ts).
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  selectValueChunkWriteCategory,
  type ValueChunkWriteDescriptor,
} from './value-chunk-persist.js';

/**
 * Resolve ordered authenticated storage-resource lanes for continuation placement.
 *
 * Repeated callsites for one resource collapse; incomplete slots fail closed. Distinct resources are
 * preserved in first-seen order so each can receive its own trailing band under the scalar band[0]
 * witness plus ordered continuation claims.
 */
export function resolveKernelValueChunkResourceLanes(
  runs: readonly { collection: string; slot?: Uint8Array }[],
): string[] {
  if (runs.some((run) => run.slot?.length !== 32)) {
    throw new Error(
      'Kernel chunkable-value output placement requires one exact compiler-published resource lane.',
    );
  }
  const lanes: string[] = [];
  const seen = new Set<string>();
  for (const run of runs) {
    const lane = `${run.collection}:${binToHex(run.slot!)}`;
    if (seen.has(lane)) continue;
    seen.add(lane);
    lanes.push(lane);
  }
  if (lanes.length === 0) {
    throw new Error(
      'Kernel chunkable-value output placement requires one exact compiler-published resource lane.',
    );
  }
  return lanes;
}

/** Resolve the one authenticated storage resource addressable by the scalar continuation-base witness. */
export function resolveKernelValueChunkResourceLane(
  runs: readonly { collection: string; slot?: Uint8Array }[],
): string {
  const lanes = resolveKernelValueChunkResourceLanes(runs);
  if (lanes.length !== 1) {
    throw new Error(
      'Kernel chunkable-value output placement requires one exact compiler-published resource lane.',
    );
  }
  return lanes[0]!;
}

/**
 * Resolve the one collection whose entry covenant owns a chunkable-value write.
 *
 * Kernel routes must publish an unambiguous resource identity. A category alone
 * is insufficient: two mappings on the same contract category have different
 * entry covenants. Descriptor-free legacy artifacts may retain their historical
 * fallback, but it is never reachable from a kernel route.
 */
export function resolveChunkableEntryCollection(parts: {
  writes: readonly ValueChunkWriteDescriptor[];
  categoryId: string;
  publishedCollections: readonly string[];
  convention?: 'legacy-unroll' | 'kernel-row-loop';
  legacyFallback?: string;
}): string | undefined {
  const selection = selectValueChunkWriteCategory(parts.writes.filter((write) => (
    write.categoryId.toLowerCase() === parts.categoryId.toLowerCase()
  )));
  if (selection.status === 'exact') return selection.write.collectionSignature;

  const published = [...new Set(parts.publishedCollections)];
  if (selection.status === 'absent' && published.length === 1) return published[0];
  if (parts.convention === 'kernel-row-loop') {
    throw new Error(
      'Kernel chunkable-value entry placement requires one exact compiler-published collection identity.',
    );
  }
  if (selection.status === 'absent' && published.length > 1) {
    throw new Error('Legacy chunkable-value entry placement has ambiguous compiler-published collections.');
  }
  return selection.status === 'absent' ? parts.legacyFallback : undefined;
}

/** Resolve a compiler entry-access lane to its transaction-block offset. */
export function resolvePublishedEntryBlockOffset(
  blockLayout: {
    slots: readonly { kind: string; offset: number; slotIndex?: number }[];
  } | undefined,
  physicalEntrySlot?: number,
): number | undefined {
  const exact = blockLayout?.slots.find((slot) => (
    slot.kind === 'entry' && (physicalEntrySlot === undefined
      || slot.slotIndex === physicalEntrySlot || slot.offset === physicalEntrySlot)
  ));
  return exact?.offset ?? blockLayout?.slots.find((slot) => slot.kind === 'entry')?.offset;
}
