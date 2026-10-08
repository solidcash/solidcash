/**
 * phase-boundary extract: Persist-predecessor placement + writer-block occupancy / OP_RETURN packing.
 * (phase-boundary extract from StatefulTransactionBuilder.ts).
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import { valueChunkIndexFromCommitment } from './value-chunk-persist.js';
import {
  groupOwnsInBlockReturnEvent,
  type PhysicalReturnGroup,
} from './value-chunk-geometry.js';

/** uint16-le chunk index. Values >= 32 are entry/value blobs, not occupancy slots. */
export function isPersistValueChunkCommitment(commitment: string): boolean {
  const hex = String(commitment ?? '').toLowerCase();
  if (!hex || hex.length < 8 || hex.startsWith('53434944')) return false;
  if (hex.startsWith('e3b0c442')) return true;
  const chunkIndex = valueChunkIndexFromCommitment(hex);
  return chunkIndex !== undefined && hex.length >= 24;
}

/** Dynamic predecessor inputs begin after the participant's fixed compiler block. */
export function persistValueChunkBase(implIndex: number, blockSize = 5): number {
  if (implIndex < 0) return -1;
  return implIndex + blockSize;
}

/** Place at most the live nNew persist predecessors; extras inflate closeJob 3→4. */
export function persistPredecessorPlaceCount(nNew: number, candidateCount: number, persistUpdate: boolean): number {
  if (nNew <= 0) return 0;
  return persistUpdate ? nNew : Math.max(nNew, candidateCount);
}

/** Keep persisted dynamic predecessors on the live trailing run. */
export function persistUpdatePredecessorDests(parts: {
  implIndex: number;
  persistUpdate: boolean;
  keepAtLayout: boolean;
  bandStart: number;
  nNew: number;
}): number[] {
  if (parts.nNew <= 0 || parts.bandStart < 0) return [];
  const layout = persistValueChunkBase(parts.implIndex, 5);
  const start = parts.persistUpdate && parts.keepAtLayout && layout >= 0
    ? Math.min(layout, parts.bandStart)
    : parts.bandStart;
  return Array.from({ length: parts.nNew }, (_, offset) => start + offset);
}

/** Persist UPDATE dests own the layout; FakeToken minting there is displaced, not skipped. */
/** After `_refreshInputs`, send must evaluate the same occupancy as derive. */
export function syncBuilderInputsFromAllInputs<T>(builderInputs: readonly T[], allInputs: readonly T[]): T[] {
  const extra = Math.max(0, builderInputs.length - allInputs.length);
  return [...allInputs, ...builderInputs.slice(allInputs.length, allInputs.length + extra)];
}

/** The empty-root predecessor leads; indexed chunks follow in chunk order. */
export function persistPredecessorRank(commitment: string): number {
  const hex = String(commitment ?? '').toLowerCase();
  if (hex.startsWith('e3b0c442')) return hex.length >= 128 ? 0 : 1;
  const chunkIndex = valueChunkIndexFromCommitment(hex);
  if (chunkIndex !== undefined) return 10 + chunkIndex;
  return 1000;
}

export function orderPersistPredecessorCandidates<T extends {
  token?: { nft?: { commitment?: string } };
}>(candidates: readonly T[], persistUpdate: boolean): T[] {
  const ordered = [...candidates];
  ordered.sort((left, right) => {
    const leftCommit = String(left.token?.nft?.commitment ?? '');
    const rightCommit = String(right.token?.nft?.commitment ?? '');
    if (persistUpdate) {
      const rankDelta = persistPredecessorRank(leftCommit) - persistPredecessorRank(rightCommit);
      if (rankDelta !== 0) return rankDelta;
    }
    return leftCommit.localeCompare(rightCommit);
  });
  return ordered;
}

/** Rank destinations in the trailing run: empty-root first, then indexed chunks. */
export function persistPredecessorWantedRank(dest: number, implIndex: number): number {
  if (implIndex < 0) return 1000;
  const base = persistValueChunkBase(implIndex, 5);
  if (dest === base) return 0;
  if (dest > base) return 9 + (dest - base);
  return 1000;
}

export function assignPersistPredecessors<T extends {
  token?: { nft?: { commitment?: string } };
}>(
  dests: readonly number[],
  candidates: readonly T[],
  implIndex: number,
  persistUpdate: boolean,
): Array<{ dest: number; candidate: T }> {
  if (!persistUpdate) {
    return dests.flatMap((dest, offset) => (
      candidates[offset] ? [{ dest, candidate: candidates[offset] }] : []
    ));
  }
  const remaining = [...candidates];
  const assigned: Array<{ dest: number; candidate: T }> = [];
  for (const dest of dests) {
    if (remaining.length === 0) break;
    const wanted = persistPredecessorWantedRank(dest, implIndex);
    let best = 0;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index++) {
      const rank = persistPredecessorRank(String(remaining[index]?.token?.nft?.commitment ?? ''));
      const delta = Math.abs(rank - wanted);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = index;
      }
    }
    assigned.push({ dest, candidate: remaining.splice(best, 1)[0] });
  }
  return assigned;
}

/** Persist UPDATE dests own the layout; FakeToken minting and persist chunks there are displaced. */
export function persistOccupantDisplaceable(parts: {
  occupantIsPad: boolean;
  persistUpdate: boolean;
  keepAtLayout: boolean;
  occupantCapability?: string;
  occupantCommitment?: string;
}): boolean {
  if (parts.occupantIsPad) return true;
  if (!(parts.persistUpdate && parts.keepAtLayout)) return false;
  if (parts.occupantCapability === 'minting') return true;
  return isPersistValueChunkCommitment(parts.occupantCommitment ?? '');
}

/**
 * First index after a token writer's physical block (master+blockSize) and
 * any in-block return slot. Change relocated out of the jobEvents band must
 * insert here — splicing at the first token-free pad (often 29) shifts the
 * FakeToken return at master+7 off its witnessed index.
 */
export function writerBlockOccupancyEnd(
  groups: ReadonlyArray<PhysicalReturnGroup>,
  findMintingInputIndex: (categoryId: string) => number,
): number {
  let end = -1;
  for (const [groupIdx, group] of groups.entries()) {
    if (group.sharedGroupIndex !== undefined) continue;
    const master = findMintingInputIndex(group.categoryId);
    if (master < 0) continue;
    const blockSize = group.blockLayout?.blockSize ?? 0;
    if (blockSize > 0) end = Math.max(end, master + blockSize);
    if (!groupOwnsInBlockReturnEvent(groups, groupIdx)) continue;
    const returnSlot = group.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent');
    if (returnSlot !== undefined) end = Math.max(end, master + returnSlot.offset + 1);
  }
  return end;
}

/** Insert a relocated change output after the jobEvents band and reserved writer occupancy. */
/**
 * Keep [mutable value chunks][OP_RETURN] contiguous. SCIDs and token-free pads that
 * landed inside that suffix are moved in front so TXOUTPUTCOUNT-1-nNew
 * still names the first value chunk.
 */
export function packMutableValueChunkRunAgainstSeparator<T extends {
  to?: Uint8Array | string;
  token?: { nft?: { capability?: string; commitment?: string } };
}>(
  outputs: T[],
  suffixLock: Uint8Array,
  tailStart: number,
): number {
  if (suffixLock.length !== 35 || suffixLock[0] !== 0xaa) return 0;
  const wanted = binToHex(suffixLock);
  const opReturn = outputs.findIndex((output, index) => {
    if (index < tailStart) return false;
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    return !!lock && lock.length === 1 && lock[0] === 0x6a;
  });
  if (opReturn < 0 || opReturn <= tailStart) return 0;
  const chunks: T[] = [];
  const displaced: T[] = [];
  for (let index = tailStart; index < opReturn; index++) {
    const output = outputs[index];
    const lock = output?.to instanceof Uint8Array ? output.to : undefined;
    const isChunk = !!lock && lock.length === 35 && binToHex(lock) === wanted
      && output?.token?.nft?.capability === 'mutable';
    if (isChunk) chunks.push(output);
    else displaced.push(output);
  }
  if (chunks.length === 0) return 0;
  const packed = [...displaced, ...chunks];
  for (let offset = 0; offset < packed.length; offset++) {
    outputs[tailStart + offset] = packed[offset];
  }
  return chunks.length;
}

export function relocateChangeAfterOccupancy<T extends { token?: unknown }>(
  outputs: T[],
  change: T,
  bandEnd: number,
  occupancyEnd = -1,
  suffixStart?: number,
): number {
  const limit = suffixStart ?? outputs.length;
  let insertAt = Math.max(bandEnd, occupancyEnd, 0);
  if (insertAt > limit) insertAt = limit;
  while (insertAt < limit && outputs[insertAt]?.token) insertAt += 1;
  if (insertAt > limit) insertAt = limit;
  outputs.splice(insertAt, 0, change);
  return insertAt;
}
