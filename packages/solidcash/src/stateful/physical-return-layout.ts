/**
 * phase-boundary extract: Physical return / view-tail / relocation layout helpers.
 * (phase-boundary extract from StatefulTransactionBuilder.ts).
 */

import { binToHex } from '@bitauth/libauth';
import { isScidIdentityCommitment } from './logical-identity.js';
import {
  clampViewTailPlacement,
  groupOwnsInBlockReturnEvent,
  logicalReturnGroupIndex,
  physicalParticipantWidth,
  tokenWriterReturnIndex,
  type PhysicalReturnGroup,
  type ViewTailPackOptions,
} from './value-chunk-geometry.js';
import {
  isDisposableAlignmentPad,
  isViewReturnTailOutput,
} from './value-chunk-band-helpers.js';

/**
 * Rotate FakeToken only when enough trailing funders exist to clear the
 * jobEvents band. An undersized 4-wide fallback leaves the minting master
 * on a value-chunk slot (timeout refund: output 24).
 */
export function chooseMintingSwapShift(availableFunders: number, minShift: number): number {
  if (minShift <= 0 || availableFunders < minShift) return 0;
  // Prefer the historical 4-wide rotate when the band is narrower so
  // transferFrom publishJobPost stays off jobEvents. Never go below minShift.
  const preferred = Math.max(minShift, 4);
  return availableFunders >= preferred ? preferred : minShift;
}

/**
 * Choose a relocation only after reserving every output-only slot in the moved participant.
 * The funders used to shift the token-bearing prefix cannot also balance its trailing slots.
 */
export function chooseParticipantRelocationShift(
  availableFunders: number,
  minShift: number,
  trailingSlots: number,
): number {
  return chooseMintingSwapShift(
    Math.max(0, availableFunders - Math.max(0, trailingSlots)),
    minShift,
  );
}

/** Gather already-serialized plain funders next to a block so it can rotate without growing the input list. */
export function gatherContiguousPlainFunders<T extends {
  txid: string;
  vout: number;
  token?: unknown;
  unlocker?: { generateLockingBytecode?: () => Uint8Array };
}>(
  inputs: T[],
  funderOutpoints: ReadonlySet<string>,
  insertionIndex: number,
  required: number,
): number {
  const isDisposableFunder = (candidate: T): boolean => {
    if (candidate.token) return false;
    if (funderOutpoints.has(`${candidate.txid}:${candidate.vout}`)) return true;
    const lock = candidate.unlocker?.generateLockingBytecode?.();
    // Tests and callers without unlocker metadata retain the legacy plain-input
    // behavior. Materialized covenant inputs do publish their lock and are only
    // movable when they are standard P2PKH or OP_TRUE funding cells.
    if (!lock) return true;
    if (lock.length === 1 && lock[0] === 0x51) return true;
    return lock.length === 25
      && lock[0] === 0x76 && lock[1] === 0xa9 && lock[2] === 0x14
      && lock[23] === 0x88 && lock[24] === 0xac;
  };
  let available = 0;
  while (insertionIndex + available < inputs.length
    && isDisposableFunder(inputs[insertionIndex + available])) {
    available += 1;
  }
  while (available < required) {
    const source = inputs.findLastIndex((candidate, index) => (
      index >= insertionIndex + available
      && !candidate.token
      && funderOutpoints.has(`${candidate.txid}:${candidate.vout}`)
    ));
    if (source < 0) break;
    const [funder] = inputs.splice(source, 1);
    inputs.splice(insertionIndex + available, 0, funder);
    available += 1;
  }
  return available;
}

/**
 * Last mutable p2sh32 writer that sits on a planned view-tail index, extended
 * through the contiguous collection band (jobEvents). Token-free pads and the
 * trailing jobs suffix (separated by a pad or OP_RETURN) are not included.
 */
export function lastCollidingMutableWriterIndex(
  outputs: ReadonlyArray<{
    to?: Uint8Array | string;
    token?: { nft?: { capability?: string } };
  }>,
  plannedTailIndices: ReadonlyArray<number>,
): number {
  let last = -1;
  for (const index of plannedTailIndices) {
    if (index < 0 || index >= outputs.length) continue;
    const output = outputs[index];
    if (!output || isViewReturnTailOutput(output)) continue;
    if (output.token?.nft?.capability === 'mutable') last = Math.max(last, index);
  }
  if (last < 0) return -1;
  for (let index = last + 1; index < outputs.length; index++) {
    const output = outputs[index];
    const lock = output?.to instanceof Uint8Array ? output.to : undefined;
    if (output?.token?.nft?.capability !== 'mutable') break;
    if (!lock || lock.length !== 35 || lock[0] !== 0xaa || lock[1] !== 0x20) break;
    last = index;
  }
  return last;
}

/**
 * Slots that can host OP_TRUE none-cap view tails without stealing jobEvents,
 * jobs suffix chunks, or SCID identity. Prefers existing view tails and
 * token-free OP_TRUE / P2PKH alignment pads.
 */
export function findViewTailDestinations(
  outputs: ReadonlyArray<{
    to?: Uint8Array | string;
    token?: { nft?: { capability?: string; commitment?: Uint8Array | string } };
  }>,
  count: number,
  options: { suffixStart: number; reserved?: ReadonlySet<number>; preferBefore?: number },
): number[] {
  if (count <= 0) return [];
  const reserved = options.reserved ?? new Set<number>();
  const usable = (index: number): boolean => {
    if (index < 0 || index >= options.suffixStart || reserved.has(index)) return false;
    const output = outputs[index];
    if (!output) return false;
    if (isScidIdentityCommitment(output.token?.nft?.commitment)) return false;
    if (output.token?.nft?.capability === 'mutable') return false;
    if (isViewReturnTailOutput(output)) return true;
    return isDisposableAlignmentPad(output);
  };
  const dest: number[] = [];
  const start = options.preferBefore ?? options.suffixStart;
  for (let index = start - 1; index >= 0 && dest.length < count; index--) {
    if (usable(index)) dest.unshift(index);
  }
  return dest;
}

export function assignPhysicalReturnIndices(
  groups: ReadonlyArray<PhysicalReturnGroup>,
  findMintingInputIndex: (categoryId: string) => number,
  extraOccupied = -1,
  packOptions?: ViewTailPackOptions,
): Map<number, number> {
  const assigned = new Map<number, number>();
  let occupied = extraOccupied;
  for (const [groupIdx, group] of groups.entries()) {
    if (group.sharedGroupIndex !== undefined) continue;
    const master = findMintingInputIndex(group.categoryId);
    if (master < 0) continue;
    const layoutSize = group.blockLayout?.blockSize
      ?? group.compilerRoute?.abiFunction?.blockLayout?.blockSize
      ?? 0;
    const trailingPred = (group.batchPredecessorOutputs ?? [])
      .filter((pred) => pred.outputBlockSlot >= layoutSize).length;
    const physicalWidth = physicalParticipantWidth(group);
    const physicalEnd = master + physicalWidth + trailingPred - 1;
    occupied = Math.max(occupied, physicalEnd);
  }
  for (const [groupIdx, group] of groups.entries()) {
    if (!groupOwnsInBlockReturnEvent(groups, groupIdx)) continue;
    const physical = groups[group.sharedGroupIndex ?? groupIdx];
    const master = findMintingInputIndex(physical.categoryId);
    if (master < 0) continue;
    const returnSlot = physical.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent');
    if (!returnSlot) continue;
    const returnIndex = tokenWriterReturnIndex(master, physical.blockLayout, packOptions?.band);
    assigned.set(groupIdx, returnIndex);
    occupied = Math.max(occupied, returnIndex);
  }
  const tailRank = (left: number, right: number): number => {
    const name = (idx: number): string => groups[idx]?.functionName ?? '';
    const proxy = (idx: number): number => (name(idx) === '__forward' ? 0 : 1);
    return proxy(left) - proxy(right) || left - right;
  };
  const tails = groups
    .map((_, idx) => idx)
    .filter((idx) => groups[idx].returnOutputIndex !== undefined && !assigned.has(idx));
  const loopWidth = (idx: number): number => Math.max(1, groups[idx].loopReturnCommitments?.length ?? 1);
  const collision = tails.some((idx) => (groups[idx].returnOutputIndex ?? -1) <= occupied);
  const needsWidth = tails.some((idx) => loopWidth(idx) > 1);
  if (collision || needsWidth) {
    let nextTail = occupied + 1;
    if (!collision) {
      const planned = tails.map((idx) => groups[idx].returnOutputIndex as number);
      if (planned.length > 0) nextTail = Math.min(...planned);
    }
    for (const groupIdx of [...tails].sort(tailRank)) {
      const planned = groups[groupIdx].plannedReturnOutputIndex
        ?? groups[groupIdx].returnOutputIndex ?? nextTail;
      const packed = nextTail;
      const placed = clampViewTailPlacement({
        planned,
        packed,
        band: packOptions?.band,
        suffixStart: packOptions?.suffixStart,
        tokenWriterPresent: packOptions?.tokenWriterPresent,
      });
      assigned.set(groupIdx, placed);
      nextTail = placed + loopWidth(groupIdx);
    }
  } else {
    let nextTail = -1;
    for (const groupIdx of [...tails].sort(tailRank)) {
      const current = groups[groupIdx].returnOutputIndex as number;
      const planned = groups[groupIdx].plannedReturnOutputIndex ?? current;
      const placed = clampViewTailPlacement({
        planned,
        packed: nextTail >= 0 ? nextTail : current,
        band: packOptions?.band,
        suffixStart: packOptions?.suffixStart,
        tokenWriterPresent: packOptions?.tokenWriterPresent,
      });
      assigned.set(groupIdx, placed);
      nextTail = placed + loopWidth(groupIdx);
    }
  }
  return assigned;
}

/** Every physical output occupied by an assigned external-call return witness. */
export function returnWitnessOutputIndices(
  groups: ReadonlyArray<PhysicalReturnGroup>,
): Set<number> {
  const reserved = new Set<number>();
  for (const [groupIdx, group] of groups.entries()) {
    const start = group.returnOutputIndex;
    if (start === undefined || start < 0) continue;
    const width = groupOwnsInBlockReturnEvent(groups, groupIdx)
      ? 1
      : Math.max(1, group.loopReturnCommitments?.length ?? 1);
    for (let offset = 0; offset < width; offset++) reserved.add(start + offset);
  }
  return reserved;
}

/**
 * Map each pending tail-return identity onto the output index `assignPhysicalReturnIndices`
 * already bound the caller to. Writer in-block slots are never used, even when
 * `master+blockSize` sits inside a wider rotated token block.
 */
export function packTailReturnPlacements(
  groups: ReadonlyArray<PhysicalReturnGroup>,
  findMintingInputIndex: (categoryId: string) => number,
  pending: ReadonlyArray<{ identity: string; categoryId: string }>,
  swapCategoryId: string,
  extraOccupied = -1,
  packOptions?: ViewTailPackOptions,
): Map<string, number> {
  const assigned = assignPhysicalReturnIndices(
    groups, findMintingInputIndex, extraOccupied, packOptions,
  );
  const inBlockIdentities = new Set<string>();
  const inBlockSlots = new Set<number>();
  for (const [groupIdx, returnIndex] of assigned) {
    if (!groupOwnsInBlockReturnEvent(groups, groupIdx)) continue;
    const group = groups[groupIdx];
    inBlockIdentities.add(`external-call:${group.fusedReturnGroupIndex ?? groupIdx}`);
    inBlockSlots.add(returnIndex);
  }
  const groupIdxOf = (identity: string): number => {
    const match = /^external-call:(\d+)/.exec(identity);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  };
  const partOf = (identity: string): number => {
    const match = /^external-call:\d+:(\d+)$/.exec(identity);
    return match ? Number(match[1]) : 0;
  };
  const placements = new Map<string, number>();
  for (const event of pending) {
    // Keep the swapped token's in-block writer on its return slot. View callsites
    // on that same category (`balanceOf`) still need their assigned tail.
    if ([...inBlockIdentities].some((identity) =>
      event.identity === identity || event.identity.startsWith(`${identity}:`))) continue;
    const groupIdx = groupIdxOf(event.identity);
    const start = assigned.get(groupIdx);
    if (start === undefined) continue;
    const outputIndex = start + partOf(event.identity);
    if (inBlockSlots.has(outputIndex)) continue;
    placements.set(event.identity, outputIndex);
  }
  return placements;
}

/** Last output index occupied by assigned in-block returns or view/loop tails. */
export function assignedTailEnd(
  groups: ReadonlyArray<PhysicalReturnGroup>,
  assigned: ReadonlyMap<number, number>,
): number {
  let end = -1;
  for (const [groupIdx, returnIndex] of assigned) {
    const width = groupOwnsInBlockReturnEvent(groups, groupIdx)
      ? 1
      : Math.max(1, groups[groupIdx].loopReturnCommitments?.length ?? 1);
    end = Math.max(end, returnIndex + width - 1);
  }
  return end;
}

