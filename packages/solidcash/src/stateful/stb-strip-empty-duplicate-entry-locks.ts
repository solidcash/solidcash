/**
 * phase-boundary extract: STB class-body extract — copy learned NEW commitments onto empty duplicate pinned entry locks.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';

export interface DerivedChunkOutputObservationLike {
  fixedIndex?: boolean;
  lockingBytecode: Uint8Array;
}

export interface StripEmptyDuplicateEntryLocksHost {
  readonly derivedChunkOutputs: ReadonlyMap<number, DerivedChunkOutputObservationLike>;
}

/**
 * For locks pinned via fixedIndex derivation (publishJobEvent NEW), when multiple mutable outputs share
 * the lock and at least one has a learned NEW commitment, copy that commitment onto empty siblings.
 */
export function stripEmptyDuplicateEntryLocks(
  host: StripEmptyDuplicateEntryLocksHost,
  builder: TransactionBuilder,
): number {
  // Only demote empties for locks we explicitly pinned via fixedIndex derivation
  // (publishJobEvent NEW). Initialize/meceTags also share collection locks and must
  // not lose provisional siblings.
  const pinnedLocks = new Set(
    [...host.derivedChunkOutputs.values()]
      .filter((chunk) => chunk.fixedIndex && chunk.lockingBytecode.length === 35)
      .map((chunk) => binToHex(chunk.lockingBytecode)),
  );
  if (pinnedLocks.size === 0) return 0;
  // keyToSlot(vm(0)) === sha256("") — a real jobId=0 slot, not an "empty" sibling.
  const byLock = new Map<string, number[]>();
  for (const [index, output] of builder.outputs.entries()) {
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    if (!lock || lock.length !== 35 || lock[0] !== 0xaa) continue;
    if (output.token?.nft?.capability !== 'mutable') continue;
    const lockHex = binToHex(lock);
    if (!pinnedLocks.has(lockHex)) continue;
    const group = byLock.get(lockHex) ?? [];
    group.push(index);
    byLock.set(lockHex, group);
  }
  let stripped = 0;
  for (const indices of byLock.values()) {
    if (indices.length < 2) continue;
    const learned = indices.filter((index) => {
      const commitment = String(builder.outputs[index]?.token?.nft?.commitment ?? '').toLowerCase();
      // HEAD (slot 0) is not a learned NEW; jobId=0 (emptyRoot prefix) is a valid learned row.
      return commitment.length >= 128
        && !commitment.startsWith('0'.repeat(64));
    });
    if (learned.length === 0) continue;
    const source = builder.outputs[learned[0]]!;
    for (const index of indices) {
      if (learned.includes(index)) continue;
      const commitment = String(builder.outputs[index]?.token?.nft?.commitment ?? '').toLowerCase();
      // HEAD/P' legitimately starts with a zero slot and may have a nonzero
      // successor (and value). Only an actually blank seed can be filled.
      const empty = commitment.length === 0
        || commitment === '00'
        || /^0+$/.test(commitment);
      if (!empty) continue;
      // Copy the learned NEW commitment onto empty siblings. Demoting them to
      // OP_TRUE leaves the covenant's introspected index (often the lower one)
      // without a token commitment.
      builder.outputs[index] = {
        to: source.to,
        amount: source.amount ?? 1200n,
        token: source.token ? {
          amount: source.token.amount ?? 0n,
          category: source.token.category!,
          nft: {
            capability: 'mutable',
            commitment: String(source.token.nft?.commitment ?? ''),
          },
        } : undefined,
      };
      stripped += 1;
    }
  }
  return stripped;
}
