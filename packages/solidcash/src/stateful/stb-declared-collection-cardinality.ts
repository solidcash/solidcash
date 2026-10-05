/**
 * phase-boundary extract: STB class-body extract — enforce compiler-declared collection write cardinality
 * after output materializers, discarding provisional absolute trace pins that fall
 * outside declared NEW/UPDATE/predecessor coordinates.
 */

import { binToHex } from '@bitauth/libauth';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import {
  stripInvalidCollectionLockOutputs,
  stripSurplusInvalidCollectionLockOutputs,
} from './collection-lock-strip.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { externalEntryLockingBytecode } from './stb-minting-swap-predecessors.js';
import { entryInsertLockRepairs } from './token-insert-linear-batch.js';

export interface DeclaredCollectionCardinalityHost {
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  /** Mutable absolute entry-output pins — surplus clones are deleted from this map. */
  externalCallEntryOutputsByIndex: Map<number, { categoryId: string; commitment: string }>;
  findMintingInputIndex(categoryId: string): number;
}

/**
 * Enforce the cardinality of a compiler-declared collection write after all
 * output materializers have run. Absolute trace pins are provisional: once
 * one is proven to be outside the declared NEW/UPDATE/predecessor coordinates,
 * discard it together with the surplus output so a later fixed-point pass
 * cannot replay the same clone.
 */
export function enforceDeclaredCollectionOutputCardinality(
  host: DeclaredCollectionCardinalityHost,
  builder: TransactionBuilder,
): void {
  const visited = new Set<string>();
  for (const group of [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]) {
    if (!group.categoryId) continue;
    const master = host.findMintingInputIndex(group.categoryId);
    if (master < 0) continue;
    const layout = group.compilerRoute?.abiFunction?.blockLayout ?? group.blockLayout;
    for (const slot of layout?.slots ?? []) {
      if (slot.kind !== 'entry') continue;
      const collectionLock = externalEntryLockingBytecode(group, slot)
        ?? group.batchEntryLockingBytecodes?.get(slot.offset);
      if (!collectionLock) continue;
      const identity = `${group.categoryId}:${binToHex(collectionLock)}`;
      if (visited.has(identity)) continue;
      visited.add(identity);
      const strippedIndices = new Set<number>();
      stripInvalidCollectionLockOutputs(
        builder.outputs, collectionLock, group.categoryId, strippedIndices,
      );
      for (const index of strippedIndices) host.externalCallEntryOutputsByIndex.delete(index);
    }
    if ((group.batchPredecessorOutputs?.length ?? 0) === 0) continue;
    for (const repair of entryInsertLockRepairs(group)) {
      const collectionLock = group.batchPredecessorOutputs![0]?.lockingBytecode;
      if (!collectionLock) continue;
      const keepIndices = new Set<number>([
        ...group.batchPredecessorOutputs!.map(({ outputBlockSlot }) => master + outputBlockSlot),
        master + repair.predecessorOffset,
        ...repair.candidateInsertedOffsets.map((offset) => master + offset),
      ]);
      const strippedIndices = new Set<number>();
      const plannedCount = group.batchPredecessorOutputs!.length
        + 1 + repair.candidateInsertedOffsets.length;
      stripSurplusInvalidCollectionLockOutputs(
        builder.outputs,
        collectionLock,
        group.categoryId,
        plannedCount,
        keepIndices,
        strippedIndices,
      );
      if (strippedIndices.size > 0
        && (globalThis as { process?: { env?: Record<string, string> } }).process
          ?.env?.SOLIDC_DEBUG_COLLECTION_CARDINALITY === '1') {
        console.error('collection-cardinality-strip', {
          categoryId: group.categoryId,
          master,
          plannedCount,
          keepIndices: [...keepIndices],
          strippedIndices: [...strippedIndices],
        });
      }
      for (const index of strippedIndices) {
        host.externalCallEntryOutputsByIndex.delete(index);
      }
    }
  }
}
