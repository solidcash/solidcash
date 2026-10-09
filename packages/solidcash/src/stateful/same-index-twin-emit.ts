/**
 * phase-boundary extract: Same-index twin / insert-new placement + job-event emit relocate helpers.
 * (phase-boundary extract from StatefulTransactionBuilder.ts).
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import { encodeEntryCommitment, isEmptyValueEntryCommitment } from './SortedList.js';
import {
  SLOT_HEX,
  isDataNftIndexCommitment,
} from './sorted-entry-commitment.js';
import {
  commitmentHexOf,
  outputMatchesLock,
} from './stb-output-utils.js';
import {
  isDisposableAlignmentPad,
  isViewReturnTailOutput,
} from './value-chunk-band-helpers.js';
import { shouldOverwriteForSameIndexTwin } from './scid-minting-return-layout.js';

/**
 * True when a sorted-entry commitment has no usable value tail.
 * Nested `planBatchUpsert` seeds often use slot||next only (64 bytes) so the derivation probe can fill the
 * value; those seeds must not win over a post-debit UPDATE during trailing-PredOut 1:1 lock repair.
 */
export function entryCommitmentLacksValue(commitment: string | undefined): boolean {
  if (!commitment) return true;
  const hex = commitment.toLowerCase();
  if (hex.length <= SLOT_HEX * 2) return true;
  if (isEmptyValueEntryCommitment(hex)) return true;
  return hex.slice(SLOT_HEX * 2).replace(/0/g, '') === '';
}

/**
 * Pick the commitment for a balances entry whose output lock was overwritten by another collection
 * (FakeToken transferFrom: allowances lands on balances[from] at +4). Prefer a value-bearing planned /
 * pinned / same-slot node; when the nested batch only published an empty seed, debit the co-spent
 * input value by `amount` and keep the planned next-key topology when present.
 */
export function resolveRestoredBalancesEntryCommitment(parts: {
  planned?: string;
  pinned?: string;
  inputCommitment?: string;
  amount?: bigint;
  sameSlotCommitments?: readonly string[];
}): string | undefined {
  const inputHex = String(parts.inputCommitment ?? '').toLowerCase();
  const inSlot = inputHex.length >= SLOT_HEX ? inputHex.slice(0, SLOT_HEX) : '';
  const candidates = [parts.planned, parts.pinned, ...(parts.sameSlotCommitments ?? [])]
    .map((commitment) => String(commitment ?? '').toLowerCase())
    .filter((commitment) => commitment.length > 0);
  for (const commitment of candidates) {
    if (entryCommitmentLacksValue(commitment)) continue;
    if (inSlot && !commitment.startsWith(inSlot)) continue;
    return commitment;
  }
  if (inSlot.length === SLOT_HEX && parts.amount !== undefined && inputHex.length > SLOT_HEX * 2) {
    const inputValue = vmNumberToBigInt(hexToBin(inputHex.slice(SLOT_HEX * 2)), { requireMinimalEncoding: false });
    if (typeof inputValue === 'bigint' && inputValue >= parts.amount) {
      const plannedHex = String(parts.planned ?? '').toLowerCase();
      const nextHex = plannedHex.length >= SLOT_HEX * 2
        ? plannedHex.slice(SLOT_HEX, SLOT_HEX * 2)
        : inputHex.slice(SLOT_HEX, SLOT_HEX * 2);
      return binToHex(encodeEntryCommitment(
        hexToBin(inSlot),
        hexToBin(nextHex.padEnd(SLOT_HEX, '0').slice(0, SLOT_HEX)),
        bigIntToVmNumber(inputValue - parts.amount),
      ));
    }
  }
  // Last resort: a value-bearing same-slot node even when the input slot prefix was unavailable.
  for (const commitment of parts.sameSlotCommitments ?? []) {
    const hex = String(commitment ?? '').toLowerCase();
    if (!entryCommitmentLacksValue(hex)) return hex;
  }
  return undefined;
}

export type SameIndexTwinOptions = {
  tailStart: number;
  suffixStart: number;
  /** Leave these indexes for INSERT NEW / other reserved band members. */
  reservedIndexes?: readonly number[];
  /** Skip pads that still sit inside these collection locks (jobEvents, etc.). */
  skipLocks?: readonly Uint8Array[];
};

/** First alignment pad after reserved collection indexes, before view tails / value chunks. */
export function nextAlignmentPadIndex<T extends {
  to?: Uint8Array | string;
  token?: unknown;
}>(
  outputs: T[],
  start: number,
  options: SameIndexTwinOptions,
  twinLock?: Uint8Array,
  twinCategory?: string,
): number {
  const reserved = new Set(options.reservedIndexes ?? []);
  const parkTo = Math.min(options.tailStart, options.suffixStart);
  for (let dest = start; dest < parkTo && dest < outputs.length; dest++) {
    if (reserved.has(dest)) continue;
    const candidate = outputs[dest];
    const candidateLock = candidate?.to instanceof Uint8Array ? candidate.to : undefined;
    if (twinLock && candidate?.token && (candidate.token as { nft?: { capability?: string }; category?: string })
      .nft?.capability === 'mutable'
      && (candidate.token as { category?: string }).category === twinCategory
      && candidateLock
      && candidateLock.length === twinLock.length
      && candidateLock.every((byte, offset) => byte === twinLock[offset])) {
      continue;
    }
    if ((options.skipLocks ?? []).some((lock) => outputMatchesLock(candidate, lock)
      && (candidate as { token?: { nft?: { capability?: string } } }).token?.nft?.capability === 'mutable')) {
      continue;
    }
    if (isDisposableAlignmentPad(candidate)) return dest;
  }
  return -1;
}

export function placeSameIndexTwin<T extends {
  to?: Uint8Array | string;
  token?: { category?: string; nft?: { capability?: string; commitment?: Uint8Array | string } };
}>(
  outputs: T[],
  index: number,
  twin: T,
  options: SameIndexTwinOptions,
): boolean {
  const twinLock = twin.to instanceof Uint8Array ? twin.to : undefined;
  const twinCategory = twin.token?.category ?? '';
  const twinCommitment = commitmentHexOf(twin.token?.nft?.commitment as Uint8Array | string | undefined);
  if (!twinLock || !shouldOverwriteForSameIndexTwin(
    outputs[index], twinLock, twinCategory, twinCommitment,
  )) {
    return false;
  }
  const occupant = outputs[index];
  const occupantLock = occupant?.to instanceof Uint8Array ? occupant.to : undefined;
  const sameLock = !!occupantLock
    && occupantLock.length === twinLock.length
    && occupantLock.every((byte, offset) => byte === twinLock[offset])
    && occupant?.token?.nft?.capability === 'mutable'
    && occupant.token.category === twinCategory;
  if (sameLock) {
    outputs[index] = twin;
    return true;
  }
  outputs[index] = twin;
  if (!occupant || isDisposableAlignmentPad(occupant)) return true;
  const dest = nextAlignmentPadIndex(outputs, index + 1, options, twinLock, twinCategory);
  if (dest >= 0) outputs[dest] = occupant;
  return true;
}

export function placeInsertNewAt<T extends {
  to?: Uint8Array | string;
  amount?: bigint;
  token?: { category?: string; nft?: { capability?: string; commitment?: Uint8Array | string } };
}>(
  outputs: T[],
  newIndex: number,
  newNode: T,
  options: SameIndexTwinOptions,
): number {
  if (newIndex >= outputs.length) return -1;
  const occupant = outputs[newIndex];
  const occupantCommit = commitmentHexOf(occupant?.token?.nft?.commitment as Uint8Array | string | undefined);
  if (occupant?.token?.nft?.capability === 'minting' || isDataNftIndexCommitment(occupantCommit)) {
    return -1;
  }
  const newLock = newNode.to instanceof Uint8Array ? newNode.to : undefined;
  if (newLock && outputMatchesLock(occupant, newLock)
    && occupant?.token?.nft?.capability === 'mutable') {
    outputs[newIndex] = newNode;
    return newIndex;
  }
  const dest = nextAlignmentPadIndex(
    outputs, newIndex, { ...options, reservedIndexes: options.reservedIndexes },
    newLock, newNode.token?.category,
  );
  outputs[newIndex] = newNode;
  if (occupant && !isDisposableAlignmentPad(occupant) && dest >= 0 && dest !== newIndex) {
    outputs[dest] = occupant;
  }
  return newIndex;
}

export function shouldDisplaceForNestedEvent(
  existing: {
    to?: Uint8Array | string;
    token?: { category?: string; nft?: { capability?: string; commitment?: Uint8Array | string } };
  } | undefined,
  eventCategoryId: string,
): boolean {
  if (!existing?.token || existing.token.nft?.capability !== 'none' || !existing.token.category) {
    return false;
  }
  if (existing.token.category !== eventCategoryId) return true;
  const commitment = String(existing.token.nft.commitment ?? '').toLowerCase();
  if (commitment.startsWith('5343494401')) return true;
  return isViewReturnTailOutput(existing);
}

/** Pads, SCID carriers, and short data-NFT clones (`0057000000`) at the emit dest. */
export function isOverwritableEmitOccupant(output?: {
  to?: Uint8Array | string;
  token?: { nft?: { capability?: string; commitment?: Uint8Array | string } };
}, options?: { consumedMutableOk?: boolean }): boolean {
  if (!output || isDisposableAlignmentPad(output) || !output.token) return true;
  if (output.token.nft?.capability === 'minting') return false;
  const commit = String(output.token.nft?.commitment ?? '');
  if (commit.startsWith('53434944') || commit.length <= 16) return true;
  // A compiler-owned event slot may replace a mutable predecessor only when the
  // caller has established that the write consumes it. Unrelated conservation
  // twins remain owners of their materialized output.
  return options?.consumedMutableOk === true
    && output.token.nft?.capability === 'mutable'
    && commit.length >= 24;
}

/** INPUTINDEX+4 must not replace a minting/mutable 1:1 occupant (MD uniqueness / data NFT). */
export function emitDestCollidesPreservedInput(input?: {
  token?: { nft?: { capability?: string } };
}): boolean {
  const capability = input?.token?.nft?.capability;
  return capability === 'minting' || capability === 'mutable';
}

/** Absolute output coordinate for an event emitted by a physical chunkable-value writer. */
export function chunkableWriterEventOutputIndex(implIndex: number, eventOffset = 4): number {
  return implIndex < 0 ? -1 : implIndex + eventOffset;
}

/** @deprecated Use {@link chunkableWriterEventOutputIndex}. */
export function publishJobEventOutputIndex(implIndex: number, eventOffset = 4): number {
  return chunkableWriterEventOutputIndex(implIndex, eventOffset);
}

/** Created JobEvent CAT (`005e19…` / `5e19…`). */
export function isCreatedJobEventCommitment(commitment: string): boolean {
  const hex = commitment.toLowerCase();
  return hex.startsWith('005e') || hex.startsWith('5e19');
}

/**
 * JobEvent dest is `INPUTINDEX + event.offset` of the executing publishJobEvent.
 * Occupancy may park Created later (dest 26); move it onto the executing dest
 * and clear the stray so uniqueness WITHIN[4,5) sees dest 22, not dest 26.
 */
export function relocateJobEventEmitToDest(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { amount?: bigint; category?: string; nft?: { capability?: string; commitment?: string } };
  }>,
  dest: number,
  options?: { consumedMutableOk?: boolean; preferCreated?: boolean },
): boolean {
  if (dest < 0) return false;
  while (outputs.length <= dest) {
    outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
  }
  const destCommit = String(outputs[dest]?.token?.nft?.commitment ?? '');
  if (outputs[dest]?.token?.nft?.capability === 'none' && isJobEventEmitCommitment(destCommit)) {
    // Keep distinct JobEvent NFTs (Created + WhitelistedWorkerAdded in one publish).
    // Only collapse exact commitment clones so receipt/queryFilter still sees every emit.
    for (let index = 0; index < outputs.length; index++) {
      if (index === dest) continue;
      const other = outputs[index];
      if (other?.token?.nft?.capability !== 'none') continue;
      const otherCommit = String(other.token?.nft?.commitment ?? '');
      if (!isJobEventEmitCommitment(otherCommit)) continue;
      if (otherCommit.toLowerCase() !== destCommit.toLowerCase()) continue;
      outputs[index] = { to: Uint8Array.of(0x51), amount: 1000n };
    }
    return true;
  }
  // First publish parks Created at dest 26; later updates must not steal persist.
  if (options?.preferCreated === false) return false;
  let source = -1;
  for (let index = 0; index < outputs.length; index++) {
    if (index === dest) continue;
    const other = outputs[index];
    if (other?.token?.nft?.capability !== 'none') continue;
    const commit = String(other.token?.nft?.commitment ?? '');
    if (!isCreatedJobEventCommitment(commit)) continue;
    source = index;
    break;
  }
  if (source < 0) return false;
  const occupant = outputs[dest];
  if (occupant && !isOverwritableEmitOccupant(occupant, {
    consumedMutableOk: options?.consumedMutableOk,
  })) {
    return false;
  }
  const moved = outputs[source];
  outputs[dest] = moved;
  outputs[source] = { to: Uint8Array.of(0x51), amount: 1000n };
  return true;
}

/** JobEvent NFT commitment: 00||struct (005e19… / 005f19… / 0023aa20…) not a value-chunk 00||120B. */
export function isJobEventEmitCommitment(commitment: string): boolean {
  const hex = commitment.toLowerCase();
  if (hex.startsWith('53434944')) return false;
  // CollateralWithdrawn (type 16 / OP_16). Timestamp-stamped rows are longer
  // than Closed leftovers (`0057000000`) and must not share that classifier.
  if (hex.startsWith('0060') && hex.length >= 10 && hex.length <= 48) return true;
  if (hex.length < 20 || hex.length > 160) return false;
  // OP_1..OP_16 after jobId 0 covers Created (5e), Whitelisted (5f), Closed (57), …
  if (/^00(5[1-9a-f]|60)/.test(hex)) return true;
  if (hex.startsWith('5e19') || hex.startsWith('5f19')) return true;
  return hex.startsWith('0019') || hex.startsWith('0023') || hex.startsWith('00aa20');
}
