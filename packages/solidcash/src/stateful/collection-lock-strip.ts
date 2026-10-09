/**
 * phase-boundary extract: Token-writer / collection-lock strip helpers.
 * (phase-boundary extract from StatefulTransactionBuilder.ts).
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import { isEmptyValueEntryCommitment } from './SortedList.js';
import {
  SLOT_HEX,
  isSortedEntryHeadCommitment,
} from './sorted-entry-commitment.js';

/** Token-free OP_TRUE or P2PKH pads used only to keep TXOUTPUTCOUNT aligned. */
/**
 * Same-collection empty-value placeholders (128-byte slot||next||64-zero) inflate
 * insert-loop output counts when a provisional empty node remains beside the
 * authenticated predecessor and new node. Convert extras to token-free pads
 * in place so unrelated assigned output coordinates do not move.
 *
 * `plannedCount` is required. Without it this must not guess: initialize and
 * other collection operations can also emit mixed empty and real mutables.
 */
/**
 * True when `index` is outside a token writer's minting block and trailing PredOut slots.
 * Used to refuse 1:1 restore of token balances onto pre-block participant pads.
 */
export function isOutsideTokenWriterBlock(
  index: number,
  master: number,
  blockSize: number,
  predecessorSlots: ReadonlyArray<number> = [],
): boolean {
  if (master < 0 || blockSize <= 0) return false;
  if (index >= master && index < master + blockSize) return false;
  for (const slot of predecessorSlots) {
    if (master + slot === index) return false;
  }
  return true;
}

/**
 * Covenant collection-address scans count every OUTPUTBYTECODE match, independent of token category.
 * A balanced placeholder which combines a collection lock with a foreign token identity therefore inflates the
 * count. `keepIndices` identifies the compiler-planned coordinates when valid-looking duplicate nodes exist.
 */
export function stripSurplusInvalidCollectionLockOutputs(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { category?: string; nft?: { capability?: string; commitment?: Uint8Array | string } };
  }>,
  collectionLock: Uint8Array,
  categoryId: string,
  plannedCount: number,
  keepIndices?: ReadonlySet<number>,
  strippedIndices?: Set<number>,
): number {
  if (plannedCount <= 0 || collectionLock.length === 0 || !categoryId) return 0;
  const matches: Array<{ index: number; valid: boolean; kept: boolean }> = [];
  for (const [index, output] of outputs.entries()) {
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    if (!lock || lock.length !== collectionLock.length) continue;
    if (!lock.every((byte, offset) => byte === collectionLock[offset])) continue;
    const commit = String(output.token?.nft?.commitment ?? '');
    const valid = output.token?.category === categoryId
      && output.token.nft?.capability === 'mutable'
      && commit.length >= SLOT_HEX * 2;
    matches.push({
      index,
      valid,
      kept: keepIndices !== undefined && keepIndices.has(index),
    });
  }
  const surplus = matches.length - plannedCount;
  if (surplus <= 0) return 0;
  // Prefer: (1) invalid pads, (2) valid-looking duplicates outside the keep set.
  // Never strip an index in keepIndices — those are the repaired NEW/UPDATE/P' coordinates.
  // When keepIndices is omitted, only strip invalid pads — never demote valid NEW/UPDATE/P'
  // just because plannedCount under-counted (post1 regression: stripped NEW to OP_TRUE).
  const stripOrder = keepIndices === undefined
    ? matches.filter((match) => !match.valid)
    : [
      ...matches.filter((match) => !match.valid && !match.kept),
      ...matches.filter((match) => match.valid && !match.kept),
    ];
  let stripped = 0;
  for (const match of stripOrder) {
    if (stripped >= surplus) break;
    outputs[match.index] = {
      to: Uint8Array.of(0x51),
      amount: outputs[match.index]?.amount && outputs[match.index]!.amount! > 0n
        ? outputs[match.index]!.amount
        : 1000n,
    };
    strippedIndices?.add(match.index);
    stripped += 1;
  }
  return stripped;
}

/**
 * Remove outputs whose locking bytecode claims a compiler-declared collection but whose token tuple cannot belong
 * to that collection. This is independent of exact cardinality: no valid balanced-layout output may combine one
 * owner's collection lock with another owner's category, capability, or malformed entry commitment.
 */
export function stripInvalidCollectionLockOutputs(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { category?: string; nft?: { capability?: string; commitment?: Uint8Array | string } };
  }>,
  collectionLock: Uint8Array,
  categoryId: string,
  strippedIndices?: Set<number>,
): number {
  if (collectionLock.length === 0 || categoryId === '') return 0;
  let stripped = 0;
  for (const [index, output] of outputs.entries()) {
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    if (!lock || lock.length !== collectionLock.length
      || !lock.every((byte, offset) => byte === collectionLock[offset])) continue;
    const commitment = String(output.token?.nft?.commitment ?? '');
    const valid = output.token?.category === categoryId
      && output.token.nft?.capability === 'mutable'
      && commitment.length >= SLOT_HEX * 2;
    if (valid) continue;
    outputs[index] = {
      to: Uint8Array.of(0x51),
      amount: output.amount && output.amount > 0n ? output.amount : 1000n,
    };
    strippedIndices?.add(index);
    stripped += 1;
  }
  return stripped;
}

export type BalancedEntryOutputIdentity = {
  lockingBytecode: Uint8Array;
  categoryId: string;
  commitment: string;
  preservesEmbeddedEntry: boolean;
};

/** Select one complete entry identity; fields from distinct resource owners are never combined. */
export function selectBalancedEntryOutputIdentity(parts: {
  plannedCommitment?: string;
  declaredLockingBytecode: Uint8Array;
  declaredCategoryId: string;
  embeddedCommitment?: string;
  inputLockingBytecode: Uint8Array;
  inputCategoryId?: string;
}): BalancedEntryOutputIdentity | undefined {
  if (parts.plannedCommitment !== undefined) return {
    lockingBytecode: parts.declaredLockingBytecode,
    categoryId: parts.declaredCategoryId,
    commitment: parts.plannedCommitment,
    preservesEmbeddedEntry: false,
  };
  if (parts.embeddedCommitment === undefined || !parts.inputCategoryId) return undefined;
  return {
    lockingBytecode: parts.inputLockingBytecode,
    categoryId: parts.inputCategoryId,
    commitment: parts.embeddedCommitment,
    preservesEmbeddedEntry: true,
  };
}

export function stripSurplusEmptyCollectionEntries(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { nft?: { capability?: string; commitment?: Uint8Array | string } };
  }>,
  collectionLock: Uint8Array,
  plannedCount = 0,
  /** Outputs a frame's layout places, which are neither planned lanes nor leftovers. */
  fixedIndices: ReadonlySet<number> = new Set(),
): number {
  if (plannedCount <= 0 || collectionLock.length === 0) return 0;
  const matches: number[] = [];
  const empties: number[] = [];
  for (const [index, output] of outputs.entries()) {
    if (fixedIndices.has(index)) continue;
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    if (!lock || lock.length !== collectionLock.length) continue;
    if (!lock.every((byte, offset) => byte === collectionLock[offset])) continue;
    if (output.token?.nft?.capability !== 'mutable') continue;
    matches.push(index);
    const commitment = output.token.nft?.commitment ?? '';
    const bytes = typeof commitment === 'string'
      ? (commitment.length === 0 ? new Uint8Array() : hexToBin(commitment))
      : commitment;
    let emptyTail = false;
    try {
      emptyTail = isEmptyValueEntryCommitment(commitment);
    } catch { /* non-hex placeholder */ }
    const hex = binToHex(bytes);
    const allZero = bytes.length > 0 && bytes.every((byte) => byte === 0);
    // Only slot-0 / all-zero leftovers. A real INSERT NEW can be e3b0c442||next||empty
    // (empty-value collection); treating that as surplus deletes the covenant's node.
    const leftoverHash = hex.startsWith('e3b0c442') && (
      bytes.length < 64
      || (bytes.length === 64 && bytes.subarray(32).every((byte) => byte === 0))
    );
    const missing = bytes.length === 0;
    if (missing || allZero || leftoverHash || (emptyTail && isSortedEntryHeadCommitment(hex))) {
      empties.push(index);
    }
  }
  if (empties.length === 0 || empties.length === matches.length) return 0;
  const surplus = Math.max(0, matches.length - plannedCount);
  if (surplus === 0) return 0;
  const toStrip = empties.slice(0, surplus);
  let stripped = 0;
  for (const index of toStrip) {
    outputs[index] = { to: Uint8Array.of(0x51), amount: 1000n };
    stripped += 1;
  }
  return stripped;
}
