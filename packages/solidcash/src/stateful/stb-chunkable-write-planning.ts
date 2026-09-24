/**
 * phase-boundary extract: STB class-body extract — chunkable value-write planning helpers.
 * Free functions over ChunkableWritePlanningHost (StatefulTransactionBuilder satisfies).
 */

import type { AbiFunction } from '@solidcash/utils';
import {
  permitsLegacyNamedValueChunkFallback,
  sameChunkableValueWriteResource,
  selectChunkableValueWriteExecution,
} from './chunkable-value-write-selection.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  legacyGroupLooksLikePublishJobEvent,
  legacyIsPublishJobEventName,
} from './legacy-planning-heuristics.js';
import {
  isInsertShapedJobEvent,
  shouldRematerializePersistUpdate,
  shouldStampPersistUpdateDigestLock,
} from './delegate-event-jobevent-helpers.js';
import {
  isInitialValueChunkWrite,
  isPersistedJobEventsReady,
  isValueChunkWriteReady,
  persistedJobEventsWidth,
  persistedValueChunkReadiness,
  persistedValueChunkWriteState,
  selectValueChunkWriteCategory,
  settlement,
  shouldRematerializeDescribedValueChunkWrite,
  type ValueChunkWriteCategorySelection,
} from './value-chunk-persist.js';

export interface ChunkableWritePlanningHost {
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
  readonly composedParticipant: boolean;
  getLowLevelCallMasterInputIndex(index: number): number;
  getExternalCallMasterInputIndex(index: number): number;
}

export type ChunkableValueWriteExecution = {
  inputIndex: number; abiFunction: AbiFunction; collection: string;
  resourceIdentity?: string; resourceOwnerIdentity?: string;
};

export type ChunkableValueWriteGroups = {
  external?: ExternalCallUtxoGroup; externalIndex: number;
  externalIndices: number[];
  lowLevel?: ExternalCallUtxoGroup; lowLevelIndex: number;
};

export function hasChunkableValueWriteMetadata(host: ChunkableWritePlanningHost): boolean {
  return [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]
    .some((group) => (group.valueChunkWrites?.length ?? 0) > 0);
}

export function permitsLegacyNamedValueChunkFallbackForGroups(host: ChunkableWritePlanningHost): boolean {
  return permitsLegacyNamedValueChunkFallback([
    ...host.externalCallUtxoGroups,
    ...host.lowLevelCallUtxoGroups,
  ], host.messageBusConvention);
}

export function chunkableValueWriteExecution(
  host: ChunkableWritePlanningHost,
): ChunkableValueWriteExecution | undefined {
  return selectChunkableValueWriteExecution([
    ...host.lowLevelCallUtxoGroups.map((group, index) => ({
      group, inputIndex: host.getLowLevelCallMasterInputIndex(index),
    })),
    ...host.externalCallUtxoGroups.flatMap((group, index) => (
      // A delegated logical group is represented by its implementation executor above.
      group.delegateCallGroupIndex === undefined ? [{
        group, inputIndex: host.getExternalCallMasterInputIndex(index),
      }] : []
    )),
  ], { allowCompilerDescribed: host.composedParticipant === true });
}

export function chunkableValueWriteGroups(host: ChunkableWritePlanningHost): ChunkableValueWriteGroups {
  const structural = chunkableValueWriteExecution(host);
  if (structural) {
    const lowLevelIndex = host.lowLevelCallUtxoGroups.findIndex((group, index) => (
      host.getLowLevelCallMasterInputIndex(index) === structural.inputIndex
      && sameChunkableValueWriteResource(structural, group)
    ));
    const delegatedTopology = lowLevelIndex < 0 ? [] : host.externalCallUtxoGroups
      .map((group, index) => ({ group, index }))
      .filter(({ group }) => group.delegateCallGroupIndex === lowLevelIndex);
    const delegatedCandidates = delegatedTopology.filter(({ group }) => (
      group.valueChunkProducerClaims !== undefined
      || group.valueChunkStateOwner !== undefined
      || (group.valueChunkWrites?.length ?? 0) > 0
    ));
    // Every compiler-described logical view of one physical delegate executor must authenticate the same
    // resource under the same state owner. Silently dropping a disagreeing alias makes the selected width and
    // ownership depend on enumeration order when two proxies share one implementation.
    if (lowLevelIndex >= 0 && delegatedCandidates.some(({ group }) => (
      !sameChunkableValueWriteResource(structural, group)
    ))) {
      return { externalIndex: -1, externalIndices: [], lowLevelIndex: -1 };
    }
    const externalIndices = host.externalCallUtxoGroups.flatMap((group, index) => {
      if (!sameChunkableValueWriteResource(structural, group)) return [];
      if (lowLevelIndex >= 0) {
        return group.delegateCallGroupIndex === lowLevelIndex ? [index] : [];
      }
      return group.delegateCallGroupIndex === undefined
        && host.getExternalCallMasterInputIndex(index) === structural.inputIndex ? [index] : [];
    });
    const externalIndex = externalIndices.find((index) => (
      host.externalCallUtxoGroups[index].sharedGroupIndex === undefined
    )) ?? externalIndices[0] ?? -1;
    return {
      external: externalIndex >= 0 ? host.externalCallUtxoGroups[externalIndex] : undefined,
      externalIndex,
      externalIndices,
      lowLevel: lowLevelIndex >= 0 ? host.lowLevelCallUtxoGroups[lowLevelIndex] : undefined,
      lowLevelIndex,
    };
  }
  if (hasChunkableValueWriteMetadata(host)) {
    return { externalIndex: -1, externalIndices: [], lowLevelIndex: -1 };
  }
  // Compatibility only for plans predating compiler-authored valueChunkWrites.
  if (!permitsLegacyNamedValueChunkFallbackForGroups(host)) {
    return { externalIndex: -1, externalIndices: [], lowLevelIndex: -1 };
  }
  // Legacy adapter only: name match stays behind permitsLegacyNamedValueChunkFallback.
  const externalIndex = host.externalCallUtxoGroups.findIndex((group) =>
    legacyIsPublishJobEventName(group.functionName ?? group.logicalFunctionName));
  const lowLevelIndex = host.lowLevelCallUtxoGroups.findIndex((group) =>
    legacyIsPublishJobEventName(group.functionName));
  return {
    external: externalIndex >= 0 ? host.externalCallUtxoGroups[externalIndex] : undefined,
    externalIndex,
    externalIndices: externalIndex >= 0 ? [externalIndex] : [],
    lowLevel: lowLevelIndex >= 0 ? host.lowLevelCallUtxoGroups[lowLevelIndex] : undefined,
    lowLevelIndex,
  };
}

export function chunkableValueWriteAbi(host: ChunkableWritePlanningHost): AbiFunction | undefined {
  const structural = chunkableValueWriteExecution(host);
  if (structural) return structural.abiFunction;
  if (hasChunkableValueWriteMetadata(host)) return undefined;
  // Compatibility only for artifacts predating chunkable collection/write metadata.
  if (!permitsLegacyNamedValueChunkFallbackForGroups(host)) return undefined;
  for (const group of [...host.lowLevelCallUtxoGroups, ...host.externalCallUtxoGroups]) {
    const abi = (group.externalContract?.inner?.artifact?.abi ?? []) as AbiFunction[];
    const fromAbi = abi.find((fn) => legacyIsPublishJobEventName(fn.name));
    if (fromAbi) return fromAbi;
    const routed = group.compilerRoute?.abiFunction;
    if (legacyIsPublishJobEventName(routed?.name)) return routed;
  }
  return undefined;
}

export function valueChunkWriteCategorySelection(
  host: ChunkableWritePlanningHost,
): ValueChunkWriteCategorySelection {
  const writes = [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]
    .flatMap((group) => group.valueChunkWrites ?? []);
  return selectValueChunkWriteCategory(writes);
}

export function jobEventsPublishCategory(host: ChunkableWritePlanningHost): string | undefined {
  const selection = valueChunkWriteCategorySelection(host);
  if (selection.status === 'exact') return selection.categoryId;
  if (selection.status !== 'absent') return undefined;
  const selected = chunkableValueWriteGroups(host);
  const categories = new Set([selected.external?.categoryId, selected.lowLevel?.categoryId]
    .filter((category): category is string => category !== undefined));
  return categories.size === 1 ? [...categories][0] : undefined;
}

export function isInitialChunkableValueWrite(host: ChunkableWritePlanningHost): boolean {
  const selection = valueChunkWriteCategorySelection(host);
  if (selection.status !== 'absent') return isInitialValueChunkWrite(selection);
  if (hasChunkableValueWriteMetadata(host)) {
    throw new Error('Chunkable value write metadata did not produce one exact resource descriptor');
  }
  if (!permitsLegacyNamedValueChunkFallbackForGroups(host)) return false;
  // Compatibility only for plans predating compiler/planner value-chunk descriptors.
  const legacyNamedInitial = host.lowLevelCallUtxoGroups.some(
    (group) => group.functionName === 'publishJobPost',
  )
    || host.externalCallUtxoGroups.some((group) =>
      (group.functionName ?? group.logicalFunctionName) === 'publishJobPost');
  return isInitialValueChunkWrite(selection, legacyNamedInitial);
}

export function shouldRematerializePersistUpdateForHost(host: ChunkableWritePlanningHost): boolean {
  const plannedInserts = Math.max(
    0,
    ...host.externalCallUtxoGroups.map((group) => group.plannedEntryInserts?.length ?? 0),
    ...host.lowLevelCallUtxoGroups.map((group) => group.plannedEntryInserts?.length ?? 0),
  );
  const selection = valueChunkWriteCategorySelection(host);
  const described = shouldRematerializeDescribedValueChunkWrite({
    selection,
    persisted: selection.status === 'exact'
      && persistedValueChunkWriteState(selection.write) !== undefined,
    plannedInserts,
  });
  // A write can update its chunked collection while this transaction also
  // inserts another entry. Those INSERT destinations own the contested
  // output geometry, so cached continuations must not be rematerialized.
  if (described !== undefined) return described;
  if (hasChunkableValueWriteMetadata(host)) {
    throw new Error('Chunkable value write metadata did not produce one exact resource descriptor');
  }
  if (!permitsLegacyNamedValueChunkFallbackForGroups(host)) return false;
  // Compatibility only for plans predating compiler/planner value-chunk descriptors.
  for (const group of [...host.lowLevelCallUtxoGroups, ...host.externalCallUtxoGroups]) {
    const names = [group.logicalFunctionName, group.functionName, group.compilerRoute?.abiFunction?.name];
    if (!names.some((n) => legacyIsPublishJobEventName(n))) continue;
    const event = (group.logicalFunctionArgs ?? group.functionArgs)?.[1];
    if (shouldRematerializePersistUpdate({
      persistReady: isPersistedJobEventsReady(),
      initialWrite: isInitialChunkableValueWrite(host),
      event,
      plannedInserts,
    })) return true;
  }
  return false;
}

export function isInitialChunkableValueWriteForDigest(host: ChunkableWritePlanningHost): boolean {
  const selection = valueChunkWriteCategorySelection(host);
  if (selection.status !== 'absent') return isInitialValueChunkWrite(selection);
  if (hasChunkableValueWriteMetadata(host)) {
    throw new Error('Chunkable value write metadata did not produce one exact resource descriptor');
  }
  if (!permitsLegacyNamedValueChunkFallbackForGroups(host)) return false;
  // Compatibility only for plans predating compiler/planner value-chunk descriptors.
  if (isInitialChunkableValueWrite(host)) return true;
  const plannedInserts = Math.max(
    0,
    ...host.externalCallUtxoGroups.map((group) => group.plannedEntryInserts?.length ?? 0),
    ...host.lowLevelCallUtxoGroups.map((group) => group.plannedEntryInserts?.length ?? 0),
  );
  if (plannedInserts > 0) return true;
  for (const group of [...host.lowLevelCallUtxoGroups, ...host.externalCallUtxoGroups]) {
    const names = [group.logicalFunctionName, group.functionName, group.compilerRoute?.abiFunction?.name];
    if (!names.some((n) => legacyIsPublishJobEventName(n))) continue;
    const event = (group.logicalFunctionArgs ?? group.functionArgs)?.[1];
    if (isInsertShapedJobEvent(event)) return true;
  }
  return false;
}

export function persistedChunkableValueWriteState(
  host: ChunkableWritePlanningHost,
): ReturnType<typeof persistedValueChunkWriteState> {
  const selection = valueChunkWriteCategorySelection(host);
  if (selection.status === 'ambiguous') isInitialValueChunkWrite(selection);
  if (selection.status === 'exact') {
    return selection.write.operation === 'update' && isValueChunkWriteReady(selection.write)
      ? persistedValueChunkWriteState(selection.write) : undefined;
  }
  if (selection.status === 'multi') return undefined;
  if (hasChunkableValueWriteMetadata(host)) {
    throw new Error('Chunkable value write metadata did not produce one exact resource descriptor');
  }
  return undefined;
}

export function isPersistedChunkableValueWriteReady(host: ChunkableWritePlanningHost): boolean {
  const selection = valueChunkWriteCategorySelection(host);
  return persistedValueChunkReadiness({
    selection,
    hasWriteMetadata: hasChunkableValueWriteMetadata(host),
    permitsLegacyFallback: permitsLegacyNamedValueChunkFallbackForGroups(host),
    descriptorReady: selection.status === 'exact'
      && persistedChunkableValueWriteState(host) !== undefined,
    legacyReady: isPersistedJobEventsReady(),
  });
}

export function persistJobEventsTokenCategory(host: ChunkableWritePlanningHost): string | undefined {
  const selection = valueChunkWriteCategorySelection(host);
  if (selection.status === 'exact') return selection.categoryId;
  if (selection.status !== 'absent') return undefined;
  const selected = chunkableValueWriteGroups(host);
  const selectedCategories = new Set([selected.external?.categoryId, selected.lowLevel?.categoryId]
    .filter((category): category is string => category !== undefined));
  if (hasChunkableValueWriteMetadata(host)) {
    return selectedCategories.size === 1 ? [...selectedCategories][0] : undefined;
  }
  if (!permitsLegacyNamedValueChunkFallbackForGroups(host)) return undefined;
  // Compatibility only for artifacts/plans predating compiler-authored valueChunkWrites.
  const impl = host.lowLevelCallUtxoGroups.find((group) =>
    legacyGroupLooksLikePublishJobEvent(group))?.categoryId;
  for (const categoryId of settlement().persistedJobEventsLocks.keys()) {
    if (categoryId && categoryId !== impl) return categoryId;
  }
  for (const categoryId of settlement().persistedJobEventsRecipes.keys()) {
    if (categoryId && categoryId !== impl) return categoryId;
  }
  return jobEventsPublishCategory(host);
}

export function shouldStampPersistUpdateDigestLockForHost(host: ChunkableWritePlanningHost): boolean {
  const categoryId = persistJobEventsTokenCategory(host);
  const exactPersisted = persistedChunkableValueWriteState(host);
  return shouldStampPersistUpdateDigestLock({
    persistReady: exactPersisted !== undefined || isPersistedChunkableValueWriteReady(host),
    persistWidth: exactPersisted?.width
      ?? (categoryId ? persistedJobEventsWidth(categoryId) : persistedJobEventsWidth()),
    firstPublishInsert: isInitialChunkableValueWriteForDigest(host),
  });
}

export function persistDigestCategories(host: ChunkableWritePlanningHost): string[] {
  const cats: string[] = [];
  const push = (value?: string): void => {
    if (value && !cats.includes(value)) cats.push(value);
  };
  push(jobEventsPublishCategory(host));
  push(persistJobEventsTokenCategory(host));
  for (const group of [...host.lowLevelCallUtxoGroups, ...host.externalCallUtxoGroups]) {
    push(group.categoryId);
  }
  return cats;
}

