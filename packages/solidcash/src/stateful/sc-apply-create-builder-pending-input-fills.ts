/**
 * phase-boundary extract: SC _createBuilder extract — post-funders pending input fills
 * (dynamic-chunk / nested-anchor / minting-master / delegate / token-call).
 * Returns applyMintingMasterFills + refreshNestedIdentityAnchorWitnesses for
 * later derivation-loop reuse.
 */

import type { AbiFunction } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import type { MessageBusRuntimeAbiFunction } from './sc-batch-raw.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import {
  groupOwnsInBlockReturnEvent,
  isCompilerDescribedMintingBandWriter,
  tokenWriterReturnIndex,
} from './value-chunk-geometry.js';
import {
  groupLayoutTrailingBase,
  inheritWriterBatchPlan,
  inheritWriterBatchWitnesses,
  isWriterBatchWitnessName,
  materializedPredOutBase,
  remapInsertPredOuts,
  writerBatchPlanMatchesPhysicalCarrier,
} from './writer-event-delegate-layout.js';
import { physicalExternalCallFunction } from './writer-group-selection.js';

export type ApplyCreateBuilderPendingInputFillsResult = {
  applyMintingMasterFills: () => boolean;
  refreshNestedIdentityAnchorWitnesses: () => boolean;
};

/**
 * Resolve deferred input-index witnesses after funders are installed, then run
 * the initial fill passes. Escapes the minting/nested-anchor helpers for the
 * derivation loop.
 */
export function applyCreateBuilderPendingInputFills(params: {
  builder: StatefulTransactionBuilder;
  overrides: any;
  functionName: string;
  entryAbiFunction: AbiFunction | undefined;
  externalCallUtxoGroups: ExternalCallUtxoGroup[];
  lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
  pendingDynamicChunkInputFills: readonly any[];
  pendingAnchorFills: readonly any[];
  pendingExternalCallInputFills: readonly any[];
  pendingDelegateInputFills: readonly any[];
  pendingTokenCallInputFills: readonly any[];
  firstRootDynamicChunk: any;
  [key: string]: any;
}): ApplyCreateBuilderPendingInputFillsResult {
  const {
    builder,
    overrides,
    functionName,
    entryAbiFunction,
    externalCallUtxoGroups,
    lowLevelCallUtxoGroups,
    pendingDynamicChunkInputFills,
    pendingAnchorFills,
    pendingExternalCallInputFills,
    pendingDelegateInputFills,
    pendingTokenCallInputFills,
    firstRootDynamicChunk,
  } = params;

  // Dynamic-storage input coordinates are physical transaction facts. Resolve them only after the builder has
  // assembled and funded every band, using the exact selected outpoint rather than a category/lock scan or the
  // implementation's maximum block width.
  const applyDynamicChunkInputFills = (): boolean => {
    let changed = false;
    for (const fill of pendingDynamicChunkInputFills) {
      if (!fill.group.refreshInternalArgs) continue;
      const target = fill.target ?? (fill.root ? firstRootDynamicChunk : undefined);
      const inputIndex = target === undefined ? -1 : builder.findInputIndexByOutpoint(target);
      if (target !== undefined && inputIndex < 0) {
        throw new Error('Selected dynamic-storage chunk input is absent from the finalized transaction');
      }
      const next = BigInt(inputIndex < 0 ? -1 : (overrides?.blockBase ?? 0) + inputIndex);
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_DYNAMIC_CHUNK_ORDER === '1') {
        console.error('dynamic-chunk-input-base', JSON.stringify({
          functionName,
          blockBase: overrides?.blockBase ?? 0,
          root: fill.root,
          target: target === undefined ? undefined : `${target.txid.slice(0, 12)}:${target.vout}`,
          inputIndex,
          next: next.toString(),
        }));
      }
      if (fill.group.internalArgs?.__internal__dynamicChunkInputBase === next) continue;
      fill.group.refreshInternalArgs({ __internal__dynamicChunkInputBase: next });
      changed = true;
    }
    return changed;
  };
  if (pendingDynamicChunkInputFills.length > 0 && applyDynamicChunkInputFills()) builder._refreshInputs();

  // Fill the deferred logical-identity anchor witnesses. The anchors are appended after every layout-driven
  // band, so their absolute input indices exist only once the builder has assembled its inputs; re-create the
  // carrying master unlocker with the real indices and re-run assembly so the input list carries it.
  const refreshNestedIdentityAnchorWitnesses = (): boolean => {
    let changed = false;
    for (const fill of pendingAnchorFills) {
      let fillChanged = false;
      const updates: Record<string, FunctionArgument> = {};
      for (const position of fill.positions) {
        const next = BigInt(position.categoryId === undefined
          ? builder.getIdentityAnchorInputIndex(position.band)
          : builder.getIdentityAnchorInputIndexByCategory(position.categoryId))
        + (position.proxyRoute ? 1_000_000n : 0n);
        if (fill.encodedArgs[position.argIndex] === next) continue;
        fill.encodedArgs[position.argIndex] = next;
        updates[position.name] = next;
        fillChanged = true;
      }
      if (!fillChanged) continue;
      if (fill.group.refreshInternalArgs) {
        fill.group.refreshInternalArgs(updates);
      } else {
        fill.group.masterUtxo = {
          ...(fill.group.masterUtxo as UnlockableUtxo),
          unlocker: fill.group.externalContract.inner.unlock[fill.functionName]!(...fill.encodedArgs as never[]),
        };
      }
      changed = true;
    }
    if (changed) builder._refreshInputs();
    return changed;
  };
  refreshNestedIdentityAnchorWitnesses();
  const applyMintingMasterFills = (): boolean => {
    let changed = false;
    for (const fill of pendingExternalCallInputFills) {
      if (!fill.group.refreshInternalArgs) continue;
      const updates: Record<string, FunctionArgument> = {};
      for (const position of fill.positions) {
        const inputIndex = builder.findMintingInputIndex(position.categoryId);
        if (inputIndex < 0) {
          throw new Error(`External call master input not found for category ${position.categoryId}`);
        }
        const next = BigInt(inputIndex);
        if (fill.group.internalArgs?.[position.name] === next) continue;
        updates[position.name] = next;
      }
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
        console.error('external-call-input-fill', fill.positions.map((position: any) => ({
          name: position.name,
          categoryId: position.categoryId.slice(0, 16),
          minting: builder.findMintingInputIndex(position.categoryId),
        })));
      }
      if (Object.keys(updates).length === 0) continue;
      fill.group.refreshInternalArgs(updates);
      changed = true;
    }
    for (const [groupIdx, group] of externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined) continue;
      if (!isCompilerDescribedMintingBandWriter(
        group, true,
        (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)?.messageBusConvention,
      )) continue;
      const master = builder.findMintingInputIndex(group.categoryId);
      if (master < 0) continue;
      const band = builder.getChunkableValueWriteBand();
      const tokenReturn = tokenWriterReturnIndex(
        master, group.blockLayout, band,
        builder.tokenWriterOccupancy(master, builder.build().outputs),
      );
      if (group.returnOutputIndex !== tokenReturn) {
        group.returnOutputIndex = tokenReturn;
        group.refreshInternalArgs?.({ __internal__returnOutputIdx: BigInt(tokenReturn) });
        changed = true;
      }
      const writerIdx = groupOwnsInBlockReturnEvent(externalCallUtxoGroups, groupIdx)
        ? groupIdx
        : externalCallUtxoGroups.findIndex((candidate, index) =>
          (candidate.sharedGroupIndex ?? index) === groupIdx
        && groupOwnsInBlockReturnEvent(externalCallUtxoGroups, index));
      for (const carrier of [...externalCallUtxoGroups, ...lowLevelCallUtxoGroups]) {
        if (!carrier.returnWitnessGroups || !carrier.refreshInternalArgs) continue;
        const updates: Record<string, FunctionArgument> = {};
        for (const [name, witnessGroup] of Object.entries(carrier.returnWitnessGroups)) {
          if (witnessGroup !== groupIdx && witnessGroup !== writerIdx) continue;
          if (carrier.internalArgs?.[name] === BigInt(tokenReturn)) continue;
          updates[name] = BigInt(tokenReturn);
        }
        if (Object.keys(updates).length === 0) continue;
        carrier.refreshInternalArgs(updates);
        changed = true;
      }
    }
    return changed;
  };
  if (pendingExternalCallInputFills.length > 0 && applyMintingMasterFills()) builder._refreshInputs();
  const applyDelegateInputFills = (): boolean => {
    let changed = false;
    for (const fill of pendingDelegateInputFills) {
      if (!fill.group.refreshInternalArgs) continue;
      const inputIndex = builder.findMintingInputIndex(fill.categoryId);
      if (inputIndex < 0) continue;
      const next = BigInt(inputIndex);
      if (fill.group.internalArgs?.[fill.name] === next) continue;
      fill.group.refreshInternalArgs({ [fill.name]: next });
      changed = true;
    }
    return changed;
  };
  if (pendingDelegateInputFills.length > 0 && applyDelegateInputFills()) builder._refreshInputs();
  if (pendingTokenCallInputFills.length > 0) {
    for (const fill of pendingTokenCallInputFills) {
      const tokenIndex = builder.findMintingInputIndex(fill.categoryId);
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_CHUNK_SCAN === '1') {
        console.error('token-call-input-fill', {
          tokenIndex,
          categoryId: fill.categoryId.slice(0, 16),
          positions: fill.positions,
          before: fill.positions.map((position: any) => String(fill.encodedArgs[position])),
          hasRefresh: !!fill.group.refreshInternalArgs,
          hasTokenGroup: !!fill.tokenGroup,
          hasTokenRefresh: !!fill.tokenGroup?.refreshInternalArgs,
          tokenFn: fill.tokenGroup?.functionName,
          returnPositions: fill.returnPositions,
          tokenReturn: fill.tokenGroup
            ? tokenIndex + ((fill.tokenGroup.blockLayout?.slots.find((slot: any) => slot.kind === 'returnEvent')
              ?.offset) ?? 7)
            : undefined,
        });
      }
      if (tokenIndex < 0 || !fill.group.refreshInternalArgs) continue;
      for (const position of fill.positions) fill.encodedArgs[position] = BigInt(tokenIndex);
      const fillBand = builder.getChunkableValueWriteBand();
      const tokenReturn = tokenWriterReturnIndex(
        tokenIndex, fill.tokenGroup?.blockLayout, fillBand,
        builder.tokenWriterOccupancy(tokenIndex, builder.build().outputs),
      );
      if (fill.tokenGroup) fill.tokenGroup.returnOutputIndex = tokenReturn;
      const returnArgs = fill.returnPositions
        .map((position: any) => ({ position, value: Number(fill.encodedArgs[position]) }))
        .filter((entry: any) => Number.isFinite(entry.value) && entry.value >= tokenIndex)
        .sort((left: any, right: any) => left.value - right.value);
      // A balanced token block can extend beyond its in-block return slot with authenticated predecessor
      // recreations. The other contracts' appended returns begin after the complete physical block, not
      // immediately after that return slot (where they would point at the predecessor NFT).
      const tokenPhysicalEnd = tokenIndex + Math.max(
        fill.tokenGroup?.blockLayout?.blockSize ?? 0,
        fill.tokenGroup?.blockInputs?.length ?? 0,
      );
      let nextReturn = Math.max(tokenReturn + 1, tokenPhysicalEnd);
      for (const entry of returnArgs) {
        fill.encodedArgs[entry.position] = BigInt(nextReturn);
        const widthIndex = fill.returnPositions.indexOf(entry.position);
        nextReturn += fill.returnWidths[widthIndex] ?? 1;
      }
      fill.group.refreshInternalArgs({});
      const tokenUpdates: Record<string, FunctionArgument> = {
        __internal__returnOutputIdx: BigInt(tokenReturn),
      };
      const tokenTrailingBase = fill.tokenGroup
        ? groupLayoutTrailingBase(fill.tokenGroup) : 8;
      if (fill.tokenGroup) {
        const tokenMaster = builder.findMintingInputIndex(fill.tokenGroup.categoryId);
        const physicalIdx = externalCallUtxoGroups.indexOf(fill.tokenGroup);
        const writers = externalCallUtxoGroups.filter((candidate, index) =>
          (candidate.sharedGroupIndex ?? index) === physicalIdx
        && ((candidate.batchPredecessorOutputs?.length ?? 0) > 0
          || (candidate.plannedEntryInserts?.length ?? 0) > 0
          || Object.entries({ ...candidate.compilerRoute?.internalArgs, ...candidate.internalArgs })
            .some(([name]) => isWriterBatchWitnessName(name))));
        for (const writer of writers) {
          if (!writerBatchPlanMatchesPhysicalCarrier(fill.tokenGroup, writer)) continue;
          inheritWriterBatchPlan(fill.tokenGroup, writer);
        }
        const hasPred = (fill.tokenGroup.batchPredecessorOutputs?.length ?? 0) > 0
        || Object.entries({
          ...fill.tokenGroup.internalArgs,
          ...fill.tokenGroup.compilerRoute?.internalArgs,
        }).some(([name, value]) => /^__internal__vmapBatchPredOut_\d+$/.test(name)
          && typeof value === 'bigint' && value >= 0n);
        if (hasPred && tokenMaster >= 0) {
          fill.tokenGroup.relocatedPredOutBase = materializedPredOutBase(
            fill.tokenGroup,
            tokenMaster,
          );
        }
      }
      if (fill.tokenGroup?.relocatedPredOutBase !== undefined) {
      // INSERT P' sits at the participant's first live trailing slot. View tails are packed after that
      // band; do not push PredOut past them (that lands on a SCID / OP_TRUE).
        const predBase = fill.tokenGroup.relocatedPredOutBase;
        const tokenFn = fill.tokenGroup.compilerRoute?.abiFunction
        ?? (fill.tokenGroup.externalContract.inner.artifact.abi as readonly AbiFunction[])
          .find((fn) => fn.name === fill.tokenGroup!.functionName
            || fn.name === fill.tokenGroup!.logicalFunctionName);
        const insertBudget = Math.max(1, fill.tokenGroup.batchPredecessorOutputs?.length ?? 0);
        const physicalIdx = externalCallUtxoGroups.indexOf(fill.tokenGroup);
        const writerGroup = externalCallUtxoGroups.find((candidate, index) =>
          (candidate.sharedGroupIndex ?? index) === physicalIdx
        && (candidate.batchPredecessorOutputs?.length ?? 0) > 0);
        const writerFn = writerGroup ? physicalExternalCallFunction(writerGroup) : tokenFn;
        const predOuts = ((writerFn ?? tokenFn)?.inputs ?? [])
          .filter((input: any) => /^__internal__vmapBatchPredOut_\d+$/.test(input.name))
          .flatMap((input: any) => {
            const current = writerGroup?.internalArgs?.[input.name]
            ?? writerGroup?.compilerRoute?.internalArgs?.[input.name]
            ?? fill.tokenGroup?.internalArgs?.[input.name]
            ?? fill.tokenGroup?.compilerRoute?.internalArgs?.[input.name];
            return typeof current === 'bigint' ? [{ name: input.name, value: current }] : [];
          });
        const remapped = remapInsertPredOuts(
          predOuts,
          BigInt(predBase),
          insertBudget,
          BigInt(tokenTrailingBase),
        );
        Object.assign(tokenUpdates, remapped);
        fill.tokenGroup.internalArgs = {
          ...fill.tokenGroup.internalArgs,
          ...remapped,
        };
        if (fill.tokenGroup.compilerRoute) {
          fill.tokenGroup.compilerRoute = {
            ...fill.tokenGroup.compilerRoute,
            internalArgs: inheritWriterBatchWitnesses(
              fill.tokenGroup.compilerRoute.internalArgs,
              remapped,
            ),
          };
        }
      }
      fill.tokenGroup?.refreshInternalArgs?.(tokenUpdates);
    }
    builder._refreshInputs();
  }
  return {
    applyMintingMasterFills,
    refreshNestedIdentityAnchorWitnesses,
  };
}
