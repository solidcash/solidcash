/**
 * phase-boundary extract: STB class-body extract — demote surplus trailing linear-batch entry clones
 * and drop matching insert placeholders after UPDATE-only materialization.
 */

import type { AbiFunction } from '@solidcash/utils';
import { binToHex } from '@bitauth/libauth';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { BALANCED_SLOT_SATOSHIS } from './balancedBlocks.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  linearSortedBatchEntryBands,
  linearSortedBatchPlannedLockCounts,
} from './token-insert-linear-batch.js';

export type ExternalCallEntryInsertPlaceholder = {
  categoryId: string;
  to: Uint8Array;
  commitment: string;
};

export interface StripSurplusLinearBatchHost {
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  /** Mutable trailing NEW-entry placeholders — callers rewrite cleared slots in place. */
  externalCallEntryInserts: ExternalCallEntryInsertPlaceholder[];
  findMintingInputIndex(categoryId: string): number;
}

/** Linear in-block sorted batches expect exactly their compiler-owned entry nodes. Trailing clones which reuse
 * those locks (misdetected P' nextKey changes) break output cardinality. */
export function stripSurplusLinearBatchEntryClones(
  host: StripSurplusLinearBatchHost,
  builder: TransactionBuilder,
): void {
  for (const group of host.externalCallUtxoGroups) {
    if (group.sharedGroupIndex !== undefined || !group.categoryId) continue;
    const fnName = group.logicalFunctionName ?? group.functionName;
    const trailingCountRaw = group.internalArgs?.__internal__vmapBatchTrailingCount
      ?? group.compilerRoute?.internalArgs?.__internal__vmapBatchTrailingCount;
    const trailingCount = typeof trailingCountRaw === 'bigint' ? Number(trailingCountRaw)
      : typeof trailingCountRaw === 'number' ? trailingCountRaw
        : typeof trailingCountRaw === 'string' && trailingCountRaw !== ''
          ? Number(trailingCountRaw) : -1;
    const master = host.findMintingInputIndex(group.categoryId);
    if (master < 0) continue;
    const blockEnd = master + (group.blockLayout?.blockSize ?? 8);
    // INSERT cardinality strip lives in `_reassertTokenInsertNewLocks` (sameLockUpdates
    // plannedCount). Running it again here while master/output-base still drift caused
    // strip↔materialize thrash on post two jobs (5GB hang). Pure UPDATE only below.
    if (trailingCount !== 0) continue;
    const abiFn = group.compilerRoute?.abiFunction
      ?? (group.externalContract?.inner?.artifact?.abi as AbiFunction[] | undefined)
        ?.find((candidate) => candidate.name === fnName);
    const linearBands = linearSortedBatchEntryBands(group);
    if (!abiFn || linearBands.length === 0) continue;
    const plannedByLock = linearSortedBatchPlannedLockCounts(
      builder.outputs, master, group.categoryId, group,
    );
    for (const [lockHex, planned] of plannedByLock) {
      const matches: number[] = [];
      for (let index = 0; index < builder.outputs.length; index++) {
        const out = builder.outputs[index];
        if (out?.token?.category !== group.categoryId) continue;
        if (!(out.to instanceof Uint8Array) || binToHex(out.to) !== lockHex) continue;
        if (out.token.nft?.capability !== 'mutable') continue;
        matches.push(index);
      }
      const surplus = matches.length - planned;
      if (surplus <= 0) continue;
      // Demote the highest-index clones first (trailing), never in-block layout slots.
      const toDemote = matches.filter((index) => index >= blockEnd).slice(-surplus);
      for (const index of toDemote) {
        const out = builder.outputs[index];
        if (!out) continue;
        out.to = Uint8Array.of(0x51);
        out.amount = BALANCED_SLOT_SATOSHIS;
        delete out.token;
      }
    }
    // Drop matching trailing insert placeholders so later builds do not recreate them.
    for (let handle = 0; handle < host.externalCallEntryInserts.length; handle++) {
      const insert = host.externalCallEntryInserts[handle];
      if (!insert || insert.categoryId !== group.categoryId || insert.commitment === '') continue;
      if (group.plannedEntryInsertHandles?.includes(handle)) continue;
      host.externalCallEntryInserts[handle] = {
        categoryId: '', to: new Uint8Array(), commitment: '',
      };
    }
  }
}
