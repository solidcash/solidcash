/**
 * phase-boundary extract: writer-group selection + describeValueChunkWrites
 * (phase-boundary extract from StatefulContract.ts).
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  computeCollectionHash,
  type AbiFunction,
  type Artifact,
  type EntryAccessAbi,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import {
  decodeEntryCommitment,
} from './SortedList.js';
import {
  permitsLegacyNamedValueChunkFallback,
  legacyPlannedChunkableValueWriteCollection,
  valueChunkWriteResourceIdentity,
  type ExternalCallUtxoGroup,
  type ValueChunkWriteDescriptor,
} from './StatefulTransactionBuilder.js';
import { legacyIsPublishJobEventName } from './legacy-job-event-helpers.js';

/** Minimal runtime ABI narrowing used by writer/chunkable selection. */
type MessageBusRuntimeAbiFunction = AbiFunction & {
  messageBusActiveWriteCollections?: readonly string[];
  messageBusActiveEntryRecipes?: ReadonlyMap<number, readonly {
    rowIndex: number;
    access: EntryAccessAbi;
    args: FunctionArgument[];
    inputs: AbiFunction['inputs'];
  }[]>;
  messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
};

export function logicalExternalCallFunction(group: ExternalCallUtxoGroup): AbiFunction | undefined {
  const artifact = group.logicalArtifact
    ?? group.logicalContract?.inner?.artifact
    ?? group.externalContract?.inner?.artifact;
  const name = group.logicalFunctionName ?? group.functionName;
  return (artifact?.abi as readonly AbiFunction[] | undefined)?.find((candidate) => candidate.name === name);
}

/** The exact ABI body carried by a physical participant. Compiler routes outrank source-level names because
 * overloads and shared participants can execute a different body than the logical call which introduced them. */
export function physicalExternalCallFunction(group: ExternalCallUtxoGroup): AbiFunction | undefined {
  return group.compilerRoute?.abiFunction
    ?? (group.externalContract?.inner?.artifact.abi as readonly AbiFunction[] | undefined)
      ?.find((candidate) => candidate.name === group.functionName);
}

export function hasPublishedEntryEffects(group: ExternalCallUtxoGroup): boolean {
  return physicalExternalCallFunction(group)?.entryAccesses !== undefined;
}

/** Select the single compiler-described participant which owns a computed state-writing call. A modern effect
 * list is authoritative and ambiguity fails closed. Source names remain only for artifacts with no effect list. */
export function computedStateWriterGroupIndex(
  groups: readonly ExternalCallUtxoGroup[], candidateIndices: readonly number[],
  ownerConvention?: 'legacy-unroll' | 'kernel-row-loop',
): number | undefined {
  const described = candidateIndices.filter((index) => hasPublishedEntryEffects(groups[index]));
  const writers = described.filter((index) => {
    const abi = physicalExternalCallFunction(groups[index]);
    return abi?.writesState === true
      && abi.entryAccesses?.some((access) => access.operations.includes('write')) === true;
  });
  if (writers.length === 1) return writers[0];
  if (described.length > 0) return undefined;
  if (!permitsLegacyNamedValueChunkFallback(
    candidateIndices.map((index) => groups[index]), ownerConvention,
  )) {
    return undefined;
  }
  // Compatibility only for artifacts predating compiler-published entry effects.
  return candidateIndices.find((index) => {
    const name = groups[index]?.compilerRoute?.abiFunction.name ?? groups[index]?.functionName;
    return name === 'transferFrom' || name === 'transfer' || name === 'approve';
  });
}

/** Select one physical chunkable-array writer by its published collection effects. */
export function chunkableWriterGroupIndex(
  groups: readonly ExternalCallUtxoGroup[],
  ownerConvention?: 'legacy-unroll' | 'kernel-row-loop',
): number {
  const candidates = groups.flatMap((group, index) => {
    const abi = physicalExternalCallFunction(group);
    return abi && writesChunkableValue(group, abi) ? [index] : [];
  });
  if (candidates.length === 1) return candidates[0];
  if (groups.some(hasPublishedEntryEffects)) return -1;
  if (!permitsLegacyNamedValueChunkFallback(groups, ownerConvention)) return -1;
  const plannedLegacyCandidates = groups.flatMap((group, index) => (
    legacyPlannedChunkableValueWriteCollection(group) === undefined ? [] : [index]
  ));
  if (plannedLegacyCandidates.length === 1) return plannedLegacyCandidates[0];
  if (plannedLegacyCandidates.length > 1) return -1;
  // Compatibility only for artifacts predating compiler-published entry effects.
  // legacy JobEvent name adapter: last-resort name match stays behind permitsLegacyNamedValueChunkFallback above.
  return groups.findIndex((group) => legacyIsPublishJobEventName(group.functionName));
}

/**
 * A shared physical participant can execute one state transition while surrounding logical views publish their
 * returns in separate tail outputs. A view after a write must read the projected output state, but only the final
 * read in a dependency chain can be recovered from the participant's final outputs. Earlier reads remain honest
 * pre-state probes; a read between two writes needs a compiler-owned route which preserves that intermediate state.
 */
export function projectedExternalReturnCandidates(
  groups: readonly ExternalCallUtxoGroup[],
): Array<{ groupIndex: number; abiFunction: AbiFunction }> {
  const functions = groups.map(logicalExternalCallFunction);
  const writtenCollections = functions.map((abiFunction) => new Set(
    (abiFunction?.entryAccesses ?? [])
      .filter((access) => access.operations.some((operation) => operation !== 'read'))
      .map((access) => access.collection),
  ));
  const candidates: Array<{ groupIndex: number; abiFunction: AbiFunction }> = [];
  for (const [groupIndex, group] of groups.entries()) {
    const abiFunction = functions[groupIndex];
    if (!abiFunction || abiFunction.writesState !== false || abiFunction.outputs?.length !== 1
      || group.precomputedReturnCommitment === undefined
      || (abiFunction.externalCalls?.length ?? 0) > 0
      || (abiFunction.lowLevelCalls?.length ?? 0) > 0
      || (abiFunction.libraryDelegateCalls?.length ?? 0) > 0
      || (abiFunction.dynamicReads?.length ?? 0) > 0) continue;
    const readCollections = new Set(
      (abiFunction.entryAccesses ?? [])
        .filter((access) => access.operations.length > 0
          && access.operations.every((operation) => operation === 'read'))
        .map((access) => access.collection),
    );
    if (readCollections.size === 0) continue;
    if ([...readCollections].some((name) => group.stateLayout.collections?.some((collection) => (
      (collection.name === name || collection.signature === name) && collection.chunkableValue === true
    )))) continue;
    const overlaps = (index: number): boolean => groups[index].categoryId === group.categoryId
      && [...readCollections].some((collection) => writtenCollections[index].has(collection));
    const hasPriorWrite = groups.some((_candidate, index) => index < groupIndex && overlaps(index));
    const hasLaterWrite = groups.some((_candidate, index) => index > groupIndex && overlaps(index));
    if (hasPriorWrite && !hasLaterWrite) candidates.push({ groupIndex, abiFunction });
  }
  return candidates;
}

export function writesChunkableValue(
  group: ExternalCallUtxoGroup,
  abiFunction: AbiFunction,
): boolean {
  return chunkableValueWriteCollections(group, abiFunction).length > 0;
}

/** Build exact continuation identities from compiler entry metadata and the planner's authenticated entry input. */
export function describeValueChunkWrites(
  group: ExternalCallUtxoGroup,
  /**
   * Category of the physical state owner this group's writes land in. A delegate executes the implementation's
   * code against the proxy's state, so the entry NFT and its value chunks live under the proxy's category while
   * `group.categoryId` names the executor's own deployment. Staging and retrieval key the same resource by this
   * category, so they must agree on the owner's, never the executor's.
   */
  stateOwnerCategoryId?: string,
): ValueChunkWriteDescriptor[] {
  const artifact = group.externalContract?.inner?.artifact as Artifact | undefined;
  const abiFunction = group.compilerRoute?.abiFunction
    ?? artifact?.abi.find((candidate) => candidate.name === group.functionName);
  if (!abiFunction) return [];
  const layout = abiFunction.blockLayout ?? group.blockLayout;
  if (!layout) return [];
  const activeFunctions = group.compilerRoute?.abiFunction === abiFunction
    && (group.compilerRoute.rowArguments?.length ?? 0) > 0
    ? group.compilerRoute.rowArguments!.map((row) => row.handler)
    : [abiFunction];
  const activeWriteCollections = (abiFunction as MessageBusRuntimeAbiFunction)
    .messageBusActiveWriteCollections;
  const writes: ValueChunkWriteDescriptor[] = [];
  const appendWrite = (access: EntryAccessAbi, entryAccessSlot: number, routeSlot: number): void => {
    if (!access.operations.includes('write')) return;
    const collection = group.stateLayout.collections?.find((candidate) =>
      candidate.name === access.collection || candidate.signature === access.collection);
    if (!collection?.chunkableValue) return;
    if (activeWriteCollections !== undefined && !activeWriteCollections.some((candidate) =>
      candidate === access.collection || candidate === collection.name
        || candidate === collection.signature)) return;
    const blockSlot = layout.slots.find((slot) =>
      slot.kind === 'entry' && slot.slotIndex === routeSlot)?.offset;
    if (blockSlot === undefined) return;
    const insert = group.plannedEntryInserts?.find((planned) => planned.blockSlot === blockSlot);
    const commitment = insert?.newCommitment
        ?? group.blockInputs?.[blockSlot]?.token?.nft?.commitment;
    const bytes = commitment === undefined ? undefined
      : typeof commitment === 'string' ? hexToBin(commitment) : commitment;
    const categoryId = (stateOwnerCategoryId ?? group.categoryId).toLowerCase();
    const collectionHash = binToHex(computeCollectionHash(collection.signature));
    const claimedKeySlots = [...new Set((group.valueChunkProducerClaims ?? []).flatMap((claim) => {
      const [claimCategoryId, claimCollectionHash, claimKeySlot, ...extra] = claim.resourceIdentity.split(':');
      return extra.length === 0
          && claimCategoryId === categoryId
          && claimCollectionHash === collectionHash
          && /^[0-9a-f]{64}$/.test(claimKeySlot ?? '')
        ? [claimKeySlot!] : [];
    }))];
    const publishedSlot = group.compilerRoute?.internalArgs?.[`__internal__vmapBatchSlot_${routeSlot}`]
        ?? group.internalArgs?.[`__internal__vmapBatchSlot_${routeSlot}`];
    const keySlot = bytes !== undefined && bytes.length >= 32
      ? decodeEntryCommitment(bytes).slot
      : claimedKeySlots.length === 1 ? hexToBin(claimedKeySlots[0]!)
        : publishedSlot instanceof Uint8Array && publishedSlot.length === 32
            && publishedSlot.some((byte) => byte !== 0)
          ? publishedSlot : undefined;
    if (keySlot === undefined) return;
    const write: ValueChunkWriteDescriptor = {
      categoryId,
      collection: collection.name,
      collectionSignature: collection.signature,
      collectionHash,
      keySlot: binToHex(keySlot),
      entryAccessSlot,
      routeSlot,
      operation: insert ? 'insert' : 'update',
      outputBase: group.valueChunkOutputBase ?? -1,
      outputCount: group.valueChunkOutputCount ?? 0,
    };
    const identity = valueChunkWriteResourceIdentity(write);
    if (!writes.some((candidate) => valueChunkWriteResourceIdentity(candidate) === identity)) {
      writes.push(write);
    }
  };
  const activeRecipes = (abiFunction as MessageBusRuntimeAbiFunction).messageBusActiveEntryRecipes;
  if (activeRecipes !== undefined && activeRecipes.size > 0) {
    for (const [routeSlot, recipes] of activeRecipes) {
      for (const recipe of recipes) {
        appendWrite(recipe.access, recipe.access.slotIndex ?? 0, routeSlot);
      }
    }
  } else {
    for (const activeFunction of activeFunctions) {
      for (const [entryAccessSlot, access] of (activeFunction.entryAccesses ?? []).entries()) {
        appendWrite(access, entryAccessSlot, access.slotIndex ?? entryAccessSlot);
      }
    }
  }
  return writes;
}

export function chunkableValueWriteCollections(
  group: ExternalCallUtxoGroup,
  abiFunction: AbiFunction,
): string[] {
  const activeWriteCollections = (abiFunction as MessageBusRuntimeAbiFunction)
    .messageBusActiveWriteCollections;
  const activeFunctions = group.compilerRoute?.abiFunction === abiFunction
    && (group.compilerRoute.rowArguments?.length ?? 0) > 0
    ? group.compilerRoute.rowArguments!.map((row) => row.handler)
    : [abiFunction];
  return [...new Set(activeFunctions.flatMap((activeFunction) => (
    activeFunction.entryAccesses ?? []
  ).flatMap((access) => {
    if (!access.operations.includes('write')
      || (activeWriteCollections !== undefined
        && !activeWriteCollections.includes(access.collection))) return [];
    const collection = group.stateLayout.collections?.find((candidate) =>
      candidate.name === access.collection || candidate.signature === access.collection);
    return access.chunkableArrayValue === true || collection?.chunkableValue === true
      ? [access.collection] : [];
  })))];
}
