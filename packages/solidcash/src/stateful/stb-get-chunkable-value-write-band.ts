/**
 * phase-boundary extract: STB public-surface extract — getChunkableValueWriteBand live publish band.
 */

import type { AbiFunction } from '@solidcash/utils';
import { peekBuildId } from './buildSequence.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import type { UnlockableUtxo } from '../interfaces.js';
import { legacyIsPublishJobEventName } from './legacy-planning-heuristics.js';
import {
  computePublishJobEventsBand,
  shouldKeepPersistAtLayoutBase,
} from './early-value-chunk-helpers.js';
import { persistValueChunkBase } from './persist-predecessor-layout.js';
import {
  isCompilerDescribedMintingBandWriter,
  liveChunkWidthForGroup,
  liveJobEventsBandWidth,
} from './value-chunk-geometry.js';
import {
  isEmptyValueChunkCommitment,
  persistedJobEventsWidth,
  type DerivedChunkOutputObservation,
} from './value-chunk-persist.js';
import { groupChunkableValueWriteCollection } from './chunkable-value-write-selection.js';
import type {
  ChunkableValueWriteExecution,
  ChunkableValueWriteGroups,
} from './stb-chunkable-write-planning.js';

export interface GetChunkableValueWriteBandHost {
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
  readonly derivedChunkOutputs: ReadonlyMap<number, DerivedChunkOutputObservation>;
  readonly allInputs: readonly UnlockableUtxo[];
  readonly composedParticipant: boolean;
  readonly forcedJobEventsBandStart?: number;
  readonly mintingOutputSwap?: { from: number; width: number; categoryId: string };
  chunkableValueWriteExecution(): ChunkableValueWriteExecution | undefined;
  chunkableValueWriteGroups(): ChunkableValueWriteGroups;
  getLowLevelCallMasterInputIndex(index: number): number;
  findMintingInputIndex(categoryId: string): number;
  getLoopEntryCommitments(collection: string): readonly string[];
  jobEventsPublishCategory(): string | undefined;
  persistedChunkableValueWriteState(): { width?: number } | undefined;
  isPersistedChunkableValueWriteReady(): boolean;
  isInitialChunkableValueWrite(): boolean;
  chunkableValueWriteInputIndex(): number;
  entryScaledPreserveRange(): { start: number; endExclusive: number } | undefined;
}

/**
 * Live publishJobEvent value-chunk band (`impl + blockSize` for `nNew` slots).
 * Occupancy, view tails, and FakeToken rotation all share this range.
 */
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
    ? (host.lowLevelCallUtxoGroups[publishLlcIndex].compilerRoute?.abiFunction
      ?? host.lowLevelCallUtxoGroups[publishLlcIndex].externalContract?.inner.artifact.abi
        .find((fn: { name: string }) => legacyIsPublishJobEventName(fn.name)))
    : publishExternal?.compilerRoute?.abiFunction
      ?? publishExternal?.blockLayout
      ?? undefined);
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
    const blockSize = group.compilerRoute?.abiFunction?.blockLayout?.blockSize
      ?? group.blockLayout?.blockSize
      ?? publishBlockSize;
    bases.push(impl + blockSize);
  }
  const plannedWidth = Math.max(
    0,
    liveChunkWidthForGroup(
      host.externalCallUtxoGroups, publishExternalIndex, host.messageBusConvention,
    ),
    ...selected.externalIndices.map((index) => liveChunkWidthForGroup(
      host.externalCallUtxoGroups, index, host.messageBusConvention,
    )),
    ...(publishLlcIndex >= 0
      ? [host.lowLevelCallUtxoGroups[publishLlcIndex].valueChunkOutputCount ?? 0]
      : []),
  );
  const activeCollection = structural?.collection ?? groupChunkableValueWriteCollection(
    publishLlcIndex >= 0
      ? host.lowLevelCallUtxoGroups[publishLlcIndex]
      : publishExternal as ExternalCallUtxoGroup,
  ) ?? 'jobEvents';
  const jobEventsCount = [...new Set(
    host.getLoopEntryCommitments(activeCollection)
      .filter((commitment) => !isEmptyValueChunkCommitment(commitment)),
  )].length;
  const publishCategory = host.jobEventsPublishCategory();
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
    : (plannedInserts > 0 || jobEventsCount === 0 ? 1 : 0);
  // Persist dest is INPUTINDEX+event.offset of the executing publishJobEvent.
  // The value-chunk band is impl+blockSize. If those disagree, dest can land
  // on a persist predecessor (output 20/21) and mutable conservation fails.
  if (persistWidth > 0) {
    const emitImpl = host.chunkableValueWriteInputIndex();
    const emitOffset = (publishFn as AbiFunction | undefined)?.blockLayout?.slots
      .find((slot) => slot.kind === 'event')?.offset ?? 4;
    if (emitImpl >= 0) bases.push(emitImpl + emitOffset + 1);
  }
  const layoutStart = bases.length > 0 ? Math.max(...bases) + insertShift : undefined;
  const forcedStart = host.forcedJobEventsBandStart;
  const publishImpl = host.chunkableValueWriteInputIndex();
  const tokenWriter = host.externalCallUtxoGroups.find((group) =>
    isCompilerDescribedMintingBandWriter(group, true, host.messageBusConvention));
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
  // Live covenant nNew (extracted/persisted v) wins over a short compose plan
  // so the missing continuation (first post slot 25) is reserved. Persist is
  // cleared on deploy, so a prior test's Created extract cannot inflate this.
  // A composed participant's continuation outputs are its compiler-declared trailing slots: the composer
  // publishes the ABSOLUTE coordinate for the covenant argument, while this isolated participant builder must
  // materialize them at the block-local offset. The legacy `impl + blockSize` base names a coordinate outside
  // the local block as soon as a delegate executes inside the participant, because `impl` is already an index
  // inside this block - adding a whole block overruns it and pads the block up to the aggregate coordinate.
  const composedTrailing = host.composedParticipant
    ? ((publishFn as AbiFunction | undefined)?.blockLayout?.slots ?? [])
      .filter((slot) => slot.kind === 'trailing')
      .map((slot) => slot.offset)
    : [];
  const composedContinuationWidth = Math.max(
    1,
    publishLlcIndex >= 0
      ? host.lowLevelCallUtxoGroups[publishLlcIndex].valueChunkOutputCount ?? 0 : 0,
    publishExternal?.valueChunkOutputCount ?? 0,
    plannedWidth,
  );
  const composedBase = composedTrailing.length > 0
    ? composedTrailing[Math.max(0, composedTrailing.length - composedContinuationWidth)]
    : undefined;
  let start = composedBase ?? forcedLayoutStart ?? layoutStart;
  // Never park the jobEvents band on another participant's minting master (FakeToken).
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
  const band = computePublishJobEventsBand({
    start: start === undefined ? undefined : start + (Number.isFinite(probeShift) ? probeShift : 0),
    preserveEndExclusive: Math.max(preserveEndExclusive, forcedStart ?? -1),
    plannedWidth,
    jobEventsCount,
    liveWidth: liveJobEventsBandWidth({ plannedWidth, persistWidth, derivedWidth }),
  });
  if (probeShift !== 0 && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ENTRY_COUNTS === '1') {
    console.error('chunk-band-probe', JSON.stringify({
      buildId: peekBuildId(), shift: probeShift, start, band,
      composedTrailing: composedTrailing.slice(0, 4), composedContinuationWidth,
    }));
  }
  return band;
}
