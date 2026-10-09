/**
 * phase-boundary extract: STB public-surface extract — setDerivedChunkOutput observation reconcile/pin.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { UnlockableUtxo } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { preferChunkCommitment } from './value-chunk-band-helpers.js';
import {
  isEmptyValueChunkCommitment,
  resolveValueChunkWriteCategory,
  sameDerivedChunkOutputObservation,
  valueChunkIndexFromCommitment,
  valueChunkWriteResourceIdentity,
  type DerivedChunkOutputObservation,
  type ValueChunkWriteCategorySelection,
} from './value-chunk-persist.js';

export interface SetDerivedChunkOutputHost {
  readonly categoryId: string;
  readonly allInputs: readonly UnlockableUtxo[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly derivedChunkOutputs: Map<number, DerivedChunkOutputObservation>;
  readonly messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
  valueChunkWriteCategorySelection(): ValueChunkWriteCategorySelection;
  getLowLevelCallMasterInputIndex(groupIndex: number): number;
  rememberJobEventsChunks(
    categoryId: string,
    chunks: ReadonlyArray<{ commitment: string; lockingBytecode: Uint8Array; categoryId?: string }>,
  ): void;
}

/**
 * Reconcile a probe/compiler observation into derivedChunkOutputs: resolve category, refuse minting/
 * delegate false pins, relocate same resource-part, prefer authenticated commitments, and remember
 * non-kernel jobEvents chunk runs.
 */
export function setDerivedChunkOutput(
  host: SetDerivedChunkOutputHost,
  outputIndex: number,
  chunk: DerivedChunkOutputObservation,
): boolean {
  // Probe observations identify physical bytes, not the full collection
  // resource. Always reconcile their claimed category with the compiler's
  // collection hash + key-slot identity. Descriptor-free legacy plans keep
  // their historical category/default selection in the resolver.
  // Fixed layout pins (entry NFT NEW slots) are not value-chunk resources. Do not let an
  // ambiguous/multi value-chunk selection fail-closed and drop the EntryNft lock.
  const resourceSelection = host.valueChunkWriteCategorySelection();
  const resolvedCategoryId = chunk.fixedIndex && chunk.categoryId
    ? chunk.categoryId
    : resolveValueChunkWriteCategory(
      resourceSelection, chunk.categoryId, host.categoryId,
    );
  if (!resolvedCategoryId) return false;
  const semanticKind = chunk.semanticKind
    ?? (chunk.resourceIdentity !== undefined ? 'valueChunk' : undefined);
  if (semanticKind === 'entryPin'
    && (chunk.resourceIdentity !== undefined || chunk.resourcePart !== undefined)) {
    throw new Error('An entry-output observation cannot claim value-chunk resource ownership.');
  }
  const describedResource = semanticKind === 'valueChunk' && resourceSelection.status === 'exact'
    && resourceSelection.categoryId.toLowerCase() === resolvedCategoryId.toLowerCase()
    ? valueChunkWriteResourceIdentity(resourceSelection.write) : undefined;
  const describedChunkIndex = semanticKind === 'valueChunk'
    ? valueChunkIndexFromCommitment(chunk.commitment) : undefined;
  const ownedChunk: DerivedChunkOutputObservation = {
    ...chunk,
    categoryId: resolvedCategoryId,
    semanticKind,
    resourceIdentity: chunk.resourceIdentity ?? describedResource,
    resourcePart: chunk.resourcePart ?? (describedResource
      ? describedChunkIndex !== undefined
        ? `chunk:${describedChunkIndex}`
        : chunk.fixedIndex ? `fixed:${chunk.commitment.slice(0, 64).toLowerCase()}` : undefined
      : undefined),
  };
  const valueChunkPin = chunk.lockingBytecode.length === 35
    && chunk.lockingBytecode[0] === 0xaa && chunk.lockingBytecode[1] === 0x20
    && chunk.lockingBytecode[34] === 0x87
    && chunk.commitment.length >= 3 && chunk.commitment.length <= 256;
  // A chunk-shaped delegate body also contains INPUTINDEX OUTPUTBYTECODE self-preservation.
  // Never let a false pin replace an implementation minting NFT or a data-NFT occupant.
  // A real value-chunk pin (P2SH32 + uint16||data) must still win: publishJobEvent
  // UPDATE reuses the previous digest's input indexes (20-22) with a new address.
  if (!valueChunkPin) {
    const occupant = host.allInputs[outputIndex];
    if (occupant?.token?.nft?.capability === 'minting') return false;
    for (const [llcIndex, llc] of host.lowLevelCallUtxoGroups.entries()) {
      if (llc.callMode !== 'delegatecall') continue;
      if (host.getLowLevelCallMasterInputIndex(llcIndex) === outputIndex) return false;
    }
  }
  const existing = host.derivedChunkOutputs.get(outputIndex);
  // A provisional entry repair must not consume a compiler-authenticated continuation coordinate. The exact
  // value observation may replace an older entry-shaped placeholder once the covenant reveals ownership.
  if (semanticKind === 'entryPin' && existing?.semanticKind === 'valueChunk') return false;
  let relocated = false;
  if (ownedChunk.resourceIdentity !== undefined && ownedChunk.resourcePart !== undefined) {
    for (const [priorIndex, prior] of host.derivedChunkOutputs) {
      if (priorIndex === outputIndex || prior.resourceIdentity !== ownedChunk.resourceIdentity
        || prior.resourcePart !== ownedChunk.resourcePart) continue;
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_RESOURCE_PARTS === '1') {
        console.error('derived-resource-part-relocated', {
          resourceIdentity: ownedChunk.resourceIdentity,
          resourcePart: ownedChunk.resourcePart,
          from: priorIndex,
          to: outputIndex,
          commitment: ownedChunk.commitment.slice(0, 20),
          semanticKind,
        });
      }
      host.derivedChunkOutputs.delete(priorIndex);
      relocated = true;
    }
  }
  if (sameDerivedChunkOutputObservation(existing, ownedChunk)) return relocated;
  // Sorted-entry pins (slot32||next32||value…) must accept a later valueTail fill-in.
  // Value-chunk pins also use fixedIndex at the publish band; a full 126-byte payload is
  // 256 hex chars and must NOT take the entry-pin path (uint16 index < 32).
  const valueChunkIndex = describedChunkIndex;
  const isValueChunkCommitment = valueChunkPin && valueChunkIndex !== undefined;
  const isEntryPin = ownedChunk.fixedIndex === true
    && !isValueChunkCommitment
    && ownedChunk.commitment.length >= 128;
  if (isEntryPin) {
    const existingLen = existing?.commitment.length ?? 0;
    if (existing && existingLen > ownedChunk.commitment.length
      && existing.fixedIndex === true
      && existing.commitment.length >= 128
      && binToHex(existing.lockingBytecode) === binToHex(ownedChunk.lockingBytecode)) {
      // Allow P' (zero slot, non-zero next) to replace a stale longer NEW.
      const slotHex = ownedChunk.commitment.slice(0, 64);
      const nextHex = ownedChunk.commitment.slice(64, 128);
      const isPredPin = /^0+$/.test(slotHex) && nextHex.length === 64 && !/^0+$/.test(nextHex);
      if (!isPredPin) return false;
    }
    host.derivedChunkOutputs.set(outputIndex, ownedChunk);
    return true;
  }
  // A provisional observation (persisted-value seed, append-time placement) carries the pre-update digest's
  // P2SH32. It must never displace a compiler-authenticated absolute pin for the same coordinate: when the value
  // tail is byte-identical the commitment comparison below sees no difference and the stale address would
  // survive while the covenant EQUALVERIFYs the address of sha256(post-update value).
  if (existing?.fixedIndex === true && ownedChunk.fixedIndex !== true
    && binToHex(existing.lockingBytecode) !== binToHex(ownedChunk.lockingBytecode)) return false;
  const kept = preferChunkCommitment(existing?.commitment, ownedChunk.commitment);
  if (existing && kept === existing.commitment && kept !== ownedChunk.commitment) return false;
  host.derivedChunkOutputs.set(outputIndex, !existing || kept === ownedChunk.commitment
    ? { ...ownedChunk, commitment: kept }
    : existing);
  if (!ownedChunk.fixedIndex && valueChunkPin && ownedChunk.commitment.length >= 3
    && ownedChunk.commitment !== '00' && !isEmptyValueChunkCommitment(ownedChunk.commitment)) {
    const categoryId = resolvedCategoryId;
    if (host.messageBusConvention !== 'kernel-row-loop' || ownedChunk.resourceIdentity === undefined) {
      host.rememberJobEventsChunks(categoryId, [
        ...host.derivedChunkOutputs.values(),
      ].filter((entry) => (entry.categoryId ?? host.categoryId) === categoryId
        && entry.commitment.length >= 3
        && entry.commitment !== '00'
        && !isEmptyValueChunkCommitment(entry.commitment)));
    }
  }
  return true;
}
