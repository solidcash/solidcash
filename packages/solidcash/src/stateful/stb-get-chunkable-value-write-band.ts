/**
 * phase-boundary extract: STB public-surface extract — getChunkableValueWriteBand live publish band.
 */

import type { AbiFunction } from '@solidcash/utils';
import { peekBuildId } from './buildSequence.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import type { UnlockableUtxo } from '../interfaces.js';
import {
  legacyIsPublishJobEventName,
  legacyNamedJobEventCollectionFallback,
} from './legacy-planning-heuristics.js';
import {
  computeChunkableValueWriteBand,
  shouldKeepPersistAtLayoutBase,
} from './early-value-chunk-helpers.js';
import { persistValueChunkBase } from './persist-predecessor-layout.js';
import {
  isCompilerDescribedMintingBandWriter,
  liveChunkWidthForGroup,
  liveChunkableValueBandWidth,
} from './value-chunk-geometry.js';
import {
  isEmptyValueChunkCommitment,
  persistedJobEventsWidth,
  type DerivedChunkOutputObservation,
} from './value-chunk-persist.js';
import { groupChunkableValueWriteCollections } from './chunkable-value-write-selection.js';
import type {
  ChunkableValueWriteExecution,
  ChunkableValueWriteGroups,
} from './stb-chunkable-write-planning.js';

export interface GetChunkableValueWriteBandHost {
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly derivedChunkOutputs: ReadonlyMap<number, DerivedChunkOutputObservation>;
  readonly allInputs: readonly UnlockableUtxo[];
  readonly forcedChunkableValueWriteBandStart?: number;
  readonly mintingOutputSwap?: { from: number; width: number; categoryId: string };
  chunkableValueWriteExecution(): ChunkableValueWriteExecution | undefined;
  chunkableValueWriteGroups(): ChunkableValueWriteGroups;
  getLowLevelCallMasterInputIndex(index: number): number;
  findMintingInputIndex(categoryId: string): number;
  getLoopEntryCommitments(collection: string): readonly string[];
  chunkableValueWriteCategory(): string | undefined;
  persistedChunkableValueWriteState(): { width?: number } | undefined;
  isPersistedChunkableValueWriteReady(): boolean;
  isInitialChunkableValueWrite(): boolean;
  chunkableValueWriteInputIndex(): number;
  entryScaledPreserveRange(): { start: number; endExclusive: number } | undefined;
}

/** Live chunkable-value continuation band (`impl + blockSize` for `nNew` slots). */
export function getChunkableValueWriteBand(
  host: GetChunkableValueWriteBandHost,
): { start: number; end: number; nNew: number } | undefined {
  const structural = host.chunkableValueWriteExecution();
  const selected = host.chunkableValueWriteGroups();
  const publishLlcIndex = selected.lowLevelIndex;
  const publishExternalIndex = selected.externalIndex;
  const publishExternal = selected.external;
  if (publishLlcIndex < 0 && !publishExternal) return undefined;
  const publishFn = structural?.abiFunction ?? (publishLlcIndex >= 0
    ? host.lowLevelCallUtxoGroups[publishLlcIndex].externalContract?.inner.artifact.abi
      .find((fn: { name: string }) => legacyIsPublishJobEventName(fn.name))
    : publishExternal?.blockLayout);
  const publishBlockSize = (publishFn as AbiFunction | undefined)?.blockLayout?.blockSize
    ?? publishExternal?.blockLayout?.blockSize
    ?? 5;
  // A delegate implementation can be the executing verifier even when the
  // state-owning proxy master sits earlier. Include both structural bases;
  // the later verifier base is the first safe continuation coordinate.
  const bases: number[] = [];
  if (publishLlcIndex >= 0) {
    const master = host.getLowLevelCallMasterInputIndex(publishLlcIndex);
    if (master >= 0) bases.push(master + publishBlockSize);
  }
  if (publishExternal?.categoryId) {
    const master = host.findMintingInputIndex(publishExternal.categoryId);
    if (master >= 0) {
      bases.push(master + (publishExternal.blockLayout?.blockSize ?? publishBlockSize));
    }
  }
  for (const [llcIndex, group] of host.lowLevelCallUtxoGroups.entries()) {
    if (group.callMode !== 'delegatecall') continue;
    const impl = host.getLowLevelCallMasterInputIndex(llcIndex);
    if (impl < 0) continue;
    const blockSize = group.blockLayout?.blockSize ?? publishBlockSize;
    bases.push(impl + blockSize);
  }
  const plannedWidth = Math.max(
    0,
    liveChunkWidthForGroup(host.externalCallUtxoGroups, publishExternalIndex),
    ...selected.externalIndices.map((index) => liveChunkWidthForGroup(host.externalCallUtxoGroups, index)),
    ...(publishLlcIndex >= 0
      ? [host.lowLevelCallUtxoGroups[publishLlcIndex].valueChunkOutputCount ?? 0]
      : []),
  );
  const selectedGroups = [
    ...(publishLlcIndex >= 0 ? [host.lowLevelCallUtxoGroups[publishLlcIndex]] : []),
    ...(publishExternal ? [publishExternal] : []),
  ];
  const publishedCollections = [...new Set(selectedGroups.flatMap(groupChunkableValueWriteCollections))];
  if (!structural && publishedCollections.length > 1) {
    throw new Error('Ambiguous compiler-published chunkable-value band collections');
  }
  const activeCollection = structural?.collection ?? publishedCollections[0]
    ?? legacyNamedJobEventCollectionFallback(selectedGroups);
  const valueChunkEntryCount = activeCollection === undefined ? 0 : new Set(
    host.getLoopEntryCommitments(activeCollection)
      .filter((commitment) => !isEmptyValueChunkCommitment(commitment)),
  ).size;
  const publishCategory = host.chunkableValueWriteCategory();
  const exactPersisted = host.persistedChunkableValueWriteState();
  const persistWidth = host.isPersistedChunkableValueWriteReady() && !host.isInitialChunkableValueWrite()
    ? exactPersisted?.width ?? persistedJobEventsWidth(publishCategory) : 0;
  const plannedInserts = Math.max(
    0,
    ...(publishExternal?.plannedEntryInserts?.length !== undefined
      ? [publishExternal.plannedEntryInserts.length] : []),
    ...(publishLlcIndex >= 0
      ? [host.lowLevelCallUtxoGroups[publishLlcIndex].plannedEntryInserts?.length ?? 0]
      : []),
  );
  const insertShift = persistWidth > 0 ? 0
    : (plannedInserts > 0 || valueChunkEntryCount === 0 ? 1 : 0);
  // The selected writer's event output is executor+event.offset. The value-chunk band is
  // executor+blockSize; keep both coordinates in the layout so it cannot land on a
  // persisted predecessor and violate mutable-token conservation.
  if (persistWidth > 0) {
    const emitImpl = host.chunkableValueWriteInputIndex();
    const emitOffset = (publishFn as AbiFunction | undefined)?.blockLayout?.slots
      .find((slot) => slot.kind === 'event')?.offset ?? 4;
    if (emitImpl >= 0) bases.push(emitImpl + emitOffset + 1);
  }
  const layoutStart = bases.length > 0 ? Math.max(...bases) + insertShift : undefined;
  const forcedStart = host.forcedChunkableValueWriteBandStart;
  const publishImpl = host.chunkableValueWriteInputIndex();
  const tokenWriter = host.externalCallUtxoGroups.find((group) =>
    isCompilerDescribedMintingBandWriter(group, true));
  const tokenMaster = tokenWriter?.categoryId
    ? host.findMintingInputIndex(tokenWriter.categoryId) : -1;
  const keepAtLayout = shouldKeepPersistAtLayoutBase({
    persistReady: host.isPersistedChunkableValueWriteReady(),
    firstPublish: host.isInitialChunkableValueWrite(),
    layoutDestOccupiedByMintingWriter: tokenMaster >= 0 || host.mintingOutputSwap !== undefined,
  });
  const layoutDest = persistValueChunkBase(publishImpl, publishBlockSize);
  // Persist UPDATE + FakeToken on dest 20: keep persist at dest 20 and swap
  // FakeToken after dest+nNew. Whitelist pads keep the dest-25 slide.
  const preserveEndExclusive = keepAtLayout
    ? -1
    : (host.isPersistedChunkableValueWriteReady() && !host.isInitialChunkableValueWrite()
      ? (host.entryScaledPreserveRange()?.endExclusive ?? -1)
      : -1);
  const forcedLayoutStart = keepAtLayout && layoutDest >= 0 ? layoutDest : undefined;
  let derivedWidth = 0;
  if (layoutStart !== undefined) {
    while (host.derivedChunkOutputs.has(layoutStart + derivedWidth)) derivedWidth += 1;
  }
  let start = forcedLayoutStart ?? layoutStart;
  // Never park the selected writer's continuation band on another participant's minting master.
  // View-tail packing and surplus strips key off band.end and would rewrite that block.
  const publishCategoryLower = publishCategory?.toLowerCase();
  if (start !== undefined && start >= 0) {
    const at = host.allInputs[start];
    if (at?.token?.nft?.capability === 'minting') {
      const foreign = !publishCategoryLower
        || at.token.category?.toLowerCase() !== publishCategoryLower;
      if (foreign) {
        const foreignGroup = host.externalCallUtxoGroups.find((group) => (
          group.categoryId?.toLowerCase() === at.token?.category?.toLowerCase()
          && group.sharedGroupIndex === undefined
        ));
        const foreignWidth = foreignGroup?.blockLayout?.blockSize
          ?? 1 + (foreignGroup?.dataNftUtxos.length ?? 0) + 2;
        start = start + Math.max(foreignWidth, 8);
      }
    }
  }
  const probeShift = Number((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_CHUNK_SHIFT ?? '0');
  const band = computeChunkableValueWriteBand({
    start: start === undefined ? undefined : start + (Number.isFinite(probeShift) ? probeShift : 0),
    preserveEndExclusive: Math.max(preserveEndExclusive, forcedStart ?? -1),
    plannedWidth,
    entryChunkCount: valueChunkEntryCount,
    liveWidth: liveChunkableValueBandWidth({ plannedWidth, persistWidth, derivedWidth }),
  });
  if (probeShift !== 0 && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ENTRY_COUNTS === '1') {
    console.error('chunk-band-probe', JSON.stringify({
      buildId: peekBuildId(), shift: probeShift, start, band,
    }));
  }
  return band;
}
