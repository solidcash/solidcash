/**
 * phase-boundary extract: SC _createBuilder extract — relocate pred-out bases after token minting swaps
 * and repack appended return-tail indexes.
 */

import type { AbiFunction } from '@solidcash/utils';
import type { UnlockableUtxo } from '../interfaces.js';
import { legacyLiveValueChunkBandWidth } from './early-value-chunk-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import type { MessageBusRuntimeAbiFunction } from './sc-batch-raw.js';
import { mintingSwapShift } from './value-chunk-band-helpers.js';
import {
  groupOwnsInBlockReturnEvent,
  isCompilerDescribedMintingBandWriter,
  valueChunkBandWidth,
} from './value-chunk-geometry.js';
import {
  inheritWriterBatchPlan,
  isWriterBatchWitnessName,
  materializedPredOutBase,
} from './writer-event-delegate-layout.js';
import {
  chunkableWriterGroupIndex,
  physicalExternalCallFunction,
} from './writer-group-selection.js';

export type RelocateCreateBuilderPredOutBasesResult = {
  relocatedPredOutBase: Map<number, number>;
  swappedTokenGroups: Set<number>;
  nestedMasterIndices: number[];
  physicalReturnIndexForGroup: Map<number, number>;
};

/**
 * After nested bases are planned, swap minting token blocks off the value-chunk
 * band, rebase pred-out witnesses, and repack non-in-block return tail indexes.
 * Mutates matching `externalCallUtxoGroups[*].relocatedPredOutBase`.
 */
export function relocateCreateBuilderPredOutBases(params: {
  externalCallUtxoGroups: ExternalCallUtxoGroup[];
  lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  returningExternalGroups: readonly number[];
  nestedMasterIndices: number[];
  physicalReturnIndexForGroup: Map<number, number>;
  delegateReturnOutputBase: number;
  lowLevelCallInputBase: number;
  entryAbiFunction: AbiFunction | undefined;
  tailReturnRank: (a: number, b: number) => number;
}): RelocateCreateBuilderPredOutBasesResult {
  const {
    externalCallUtxoGroups, lowLevelCallUtxoGroups, returningExternalGroups,
    nestedMasterIndices, physicalReturnIndexForGroup, delegateReturnOutputBase,
    lowLevelCallInputBase, entryAbiFunction, tailReturnRank,
  } = params;

  const relocatedPredOutBase = new Map<number, number>();
  const swappedTokenGroups = new Set<number>();
  {
    let tailOccupied = delegateReturnOutputBase - 1;
    for (const groupIdx of returningExternalGroups) {
      if (!groupOwnsInBlockReturnEvent(externalCallUtxoGroups, groupIdx)) {
        continue;
      }
      const placed = physicalReturnIndexForGroup.get(groupIdx);
      if (placed !== undefined) tailOccupied = Math.max(tailOccupied, placed);
    }
    // A transferFrom minting block that sits on publishJobEvent's value-chunk
    // band is swapped 4-wide to start+width. Its in-block return then occupies
    // postSwapMaster+blockSize-1 (33). Tail witnesses baked against the
    // pre-swap master (29) would still start at 33 and collide with that return.
    const publishLlcIndex = chunkableWriterGroupIndex(
      lowLevelCallUtxoGroups,
      (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)?.messageBusConvention,
    );
    if (publishLlcIndex >= 0) {
      const publishLlc = lowLevelCallUtxoGroups[publishLlcIndex];
      const publishFn = physicalExternalCallFunction(publishLlc);
      let publishImpl = lowLevelCallInputBase;
      for (let index = 0; index < publishLlcIndex; index++) {
        publishImpl += 1 + lowLevelCallUtxoGroups[index].dataNftUtxos.length;
      }
      const chunkBase = publishImpl + (publishFn?.blockLayout?.blockSize ?? 5);
      for (const [groupIdx, group] of externalCallUtxoGroups.entries()) {
        if (group.sharedGroupIndex !== undefined) continue;
        if (!isCompilerDescribedMintingBandWriter(
          group, true,
          (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)?.messageBusConvention,
        )) continue;
        const tokenName = group.functionName ?? group.compilerRoute?.abiFunction.name;
        const start = nestedMasterIndices[groupIdx];
        if (start === undefined || start < 0) continue;
        let tokenWidth = 0;
        const tokenInputs = group.blockInputs ?? [group.masterUtxo as UnlockableUtxo, ...group.dataNftUtxos];
        for (const input of tokenInputs) {
          if (input?.token?.category === group.categoryId && input.token.nft) tokenWidth += 1;
          else if (tokenWidth > 0) break;
        }
        if (tokenWidth === 0) continue;
        const plannedWidth = Math.max(
          0,
          ...externalCallUtxoGroups.map((candidate) => candidate.valueChunkOutputCount ?? 0),
          ...lowLevelCallUtxoGroups.map((candidate) => candidate.valueChunkOutputCount ?? 0),
        );
        // Match getChunkableValueWriteBand / liveJobEventsBandWidth: plannedWidth 2 must stay
        // nNew 2. valueChunkBandWidth's default minimum 3 made whitelist publish report
        // plannedWidth 2 / nNew 3 while the live band was only 2 wide.
        const liveWidth = legacyLiveValueChunkBandWidth({ plannedWidth });
        const nNew = liveWidth > 0
          ? liveWidth
          : valueChunkBandWidth({ minimum: 1, planned: plannedWidth });
        let bandEnd = chunkBase + nNew;
        // Planner chunkBase can sit nNew slots before the real jobEvents
        // outputs (impl 15 vs chunks at 20). The token then lands on the
        // first jobEvents output (start === chunkBase+nNew).
        if (start === bandEnd) bandEnd += nNew;
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
          console.error('token-swap-band', {
            functionName: tokenName, start, chunkBase, plannedWidth, nNew, bandEnd,
            inBand: start >= chunkBase && start < bandEnd,
          });
        }
        if (start < chunkBase || start >= bandEnd) continue;
        // Same K-rotate as `_swapMintingOffValueChunkBand`: at least 4, at least
        // the live jobEvents overlap. A fixed +3 left start=24 outside a 5-wide band.
        const swapWidth = Math.max(mintingSwapShift(start, chunkBase, nNew), bandEnd - start);
        const postMaster = start + swapWidth;
        // PredOut is encoded as relative + nestedMaster. If we only rebase the
        // return witness (33) and leave nestedMaster at the pre-swap 22, the
        // later return-index refresh sees delta 0 and INSERT pred-outs stay at
        // 22+rel (output 34, an MD tail) instead of 26+rel.
        nestedMasterIndices[groupIdx] = postMaster;
        swappedTokenGroups.add(groupIdx);
        const returnSlot = group.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent');
        const postReturn = postMaster + (returnSlot?.offset ?? (group.blockLayout?.blockSize ?? 8) - 1);
        physicalReturnIndexForGroup.set(groupIdx, postReturn);
        tailOccupied = Math.max(tailOccupied, postReturn);
      }
    }
    let nextTail = tailOccupied + 1;
    for (const groupIdx of [...returningExternalGroups].sort(tailReturnRank)) {
      const child = externalCallUtxoGroups[groupIdx];
      if (groupOwnsInBlockReturnEvent(externalCallUtxoGroups, groupIdx)) {
        continue;
      }
      const width = Math.max(1, child.loopReturnCommitments?.length ?? 1);
      physicalReturnIndexForGroup.set(groupIdx, nextTail);
      nextTail += width;
    }
    for (const groupIdx of swappedTokenGroups) {
      const group = externalCallUtxoGroups[groupIdx];
      const writers = externalCallUtxoGroups.filter((candidate, index) =>
        (candidate.sharedGroupIndex ?? index) === groupIdx
        && ((candidate.batchPredecessorOutputs?.length ?? 0) > 0
          || (candidate.plannedEntryInserts?.length ?? 0) > 0
          || Object.entries({ ...candidate.compilerRoute?.internalArgs, ...candidate.internalArgs })
            .some(([name]) => isWriterBatchWitnessName(name))));
      for (const writer of writers) inheritWriterBatchPlan(group, writer);
      if ((group?.batchPredecessorOutputs?.length ?? 0) === 0) continue;
      const postMaster = nestedMasterIndices[groupIdx];
      if (postMaster === undefined) continue;
      // Return-tail positions are provisional here and are repacked after the physical blocks. Rebase the
      // covenant witness from the batch planner's materialized slot, not from those temporary positions.
      const predBase = materializedPredOutBase(group, postMaster);
      relocatedPredOutBase.set(groupIdx, predBase);
      group.relocatedPredOutBase = predBase;
    }
  }

  return {
    relocatedPredOutBase,
    swappedTokenGroups,
    nestedMasterIndices,
    physicalReturnIndexForGroup,
  };
}
