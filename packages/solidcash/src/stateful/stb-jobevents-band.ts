/**
 * phase-boundary extract: STB class-body extract — materialize / ensure-live / pack-suffix / persist
 * JobEvents (value-chunk) band placement.
 */

import { binToHex } from '@bitauth/libauth';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import { shouldUseLegacyPersistDigestLockForValueChunks } from './delegate-event-jobevent-helpers.js';
import { applyRedeemLockToChunks, chunksFromValue } from './early-value-chunk-helpers.js';
import { movePostOpReturnBeforeJobsSuffix } from './mutable-output-reassert.js';
import {
  packJobsAgainstOpReturn,
  writerBlockOccupancyEnd,
} from './persist-predecessor-layout.js';
import { stripSurplusValueChunkLocks } from './scid-minting-return-layout.js';
import {
  hasChunkableValueWriteMetadata,
  chunkableValueWriteCategory,
  permitsLegacyNamedValueChunkFallbackForGroups,
  persistedValueChunkCategory,
  shouldRematerializePersistUpdateForHost,
  shouldStampPersistUpdateDigestLockForHost,
  valueChunkWriteCategorySelection,
} from './stb-chunkable-write-planning.js';
import type { ScaledPreserveEmitHost } from './stb-scaled-preserve-emit.js';
import {
  fillJobEventsBandHoles,
  placeValueChunksOnBand,
  preferChunkCommitment,
} from './value-chunk-band-helpers.js';
import {
  groupOwnsInBlockReturnEvent,
  liveJobEventsBandWidth,
  selectTokenBandRepairOwner,
} from './value-chunk-geometry.js';
import {
  coherentAuthenticatedValueChunkRun,
  commitStagedValueChunkWrite,
  firstUsableValueChunkRun,
  isEmptyValueChunkCommitment,
  latestPersisted,
  persistUpdateRedeemLock,
  persistedJobEventsLock,
  persistedJobEventsWidth,
  rememberJobEventsLock,
  rememberJobEventsUnlockRecipe,
  rememberJobEventsValue,
  selectObservedValueChunkRun,
  settlement,
  stagedValueChunkWrite,
  valueChunkWriteIdentity,
  type AuthenticatedValueChunk,
  type DerivedChunkOutputObservation,
  type ValueChunkWriteDescriptor,
  type ValueChunkWriteStagingSession,
} from './value-chunk-persist.js';

export interface JobEventsBandHost extends ScaledPreserveEmitHost {
  readonly categoryId: string;
  readonly allInputs: UnlockableUtxo[];
  readonly mintingOutputSwap?: { from: number; width: number; categoryId: string };
  /** Mutable recovered-output cache — band materialization rewrites provisional chunk pins. */
  derivedChunkOutputs: Map<number, DerivedChunkOutputObservation>;
  readonly jobEventsRedeemLock?: Uint8Array;
  readonly delegateDynamicChunksAtSuffix: boolean;
  persistedJobEventsChunks: Array<{ commitment: string; lockingBytecode: Uint8Array; categoryId?: string }>;
  valueChunkWriteStagingSession?: ValueChunkWriteStagingSession;
  applyDerivedValueChunks(builder: TransactionBuilder): boolean | void;
  applyDerivedEntryOutputs(builder: TransactionBuilder): void;
  hasStagedValueChunkOutputs(): boolean;
  rememberJobEventsChunks(
    categoryId: string,
    chunks: ReadonlyArray<{ commitment: string; lockingBytecode: Uint8Array; categoryId?: string }>,
  ): void;
  stagedValueChunkWrite(categoryId?: string): Uint8Array | undefined;
  persistValueChunkLock(categoryId?: string, value?: Uint8Array): Uint8Array | undefined;
  persistedValueChunkWrite(categoryId?: string): ValueChunkWriteDescriptor | null | undefined;
  persistedValueChunkValue(categoryId?: string): Uint8Array | undefined;
  persistUpdateDigestLock(categoryId?: string): Uint8Array | undefined;
  getValueChunkVars(): Array<{
    id: string;
    collection: string;
    lockingBytecode: Uint8Array;
    slot?: Uint8Array;
  }>;
  getValueChunkRawCommitments(id: string): string[];
  dynamicChunkOutputCount(): number;
  reassertInBlockWriterReturns(builder: TransactionBuilder): void;
}

/** Pack jobs-suffix mutables against the OP_RETURN trailer after the JobEvents band. */
export function packJobsSuffix(
  host: JobEventsBandHost,
  builder: TransactionBuilder,
): void {
  const band = host.getChunkableValueWriteBand();
  const tailStart = band ? band.end + 1 : 0;
  const chunkHex = host.jobEventsRedeemLock ? binToHex(host.jobEventsRedeemLock) : '';
  let jobsLock: Uint8Array | undefined;
  for (let index = builder.outputs.length - 1; index >= tailStart; index--) {
    const lock = builder.outputs[index]?.to instanceof Uint8Array
      ? builder.outputs[index]!.to as Uint8Array : undefined;
    if (!lock || lock.length !== 35 || lock[0] !== 0xaa) continue;
    if (chunkHex && binToHex(lock) === chunkHex) continue;
    if (builder.outputs[index]?.token?.nft?.capability !== 'mutable') continue;
    jobsLock = lock;
    break;
  }
  if (jobsLock) packJobsAgainstOpReturn(builder.outputs, jobsLock, tailStart);
  if (host.delegateDynamicChunksAtSuffix) {
    movePostOpReturnBeforeJobsSuffix(builder.outputs, jobsLock);
  }
}

/**
 * Last writer on the view-only path: put publishJobEvent value chunks at
 * impl+trailingBase. Leaves view tails (16/17) and minting masters alone.
 */
export function materializeJobEventsBand(
  host: JobEventsBandHost,
  builder: TransactionBuilder,
): void {
  const band = host.getChunkableValueWriteBand();
  if (host.messageBusConvention === 'kernel-row-loop'
    && [...host.derivedChunkOutputs.values()].some((chunk) => chunk.resourceIdentity !== undefined)) {
    host.applyDerivedValueChunks(builder);
    return;
  }
  // Identity-scan chunks are already appended via stageValueChunkOutputs. Do not re-place them
  // onto a persist band that sits on another participant's minting master (FakeToken).
  if (!permitsLegacyNamedValueChunkFallbackForGroups(host) && host.hasStagedValueChunkOutputs() && band) {
    const at = host.allInputs[band.start];
    if (at?.token?.nft?.capability === 'minting') {
      const publishCat = chunkableValueWriteCategory(host);
      // Missing publishCat must still refuse: otherwise FakeToken's minting slot becomes the band.
      if (!publishCat || at.token.category?.toLowerCase() !== publishCat.toLowerCase()) {
        return;
      }
    }
  }
  const repairOwner = selectTokenBandRepairOwner(
    host.externalCallUtxoGroups,
    (groupCategoryId) => host.findMintingInputIndex(groupCategoryId),
    band,
    host.messageBusConvention,
  );
  const tokenWriterPresent = repairOwner.status !== 'absent'
    || host.mintingOutputSwap !== undefined;
  // A compiler-described participant already owns this physical band. Rewriting its 1:1 outputs is unsound;
  // ambiguity is likewise a refusal, never permission to choose the first source-level handler.
  if (tokenWriterPresent) return;
  if (!band) return;
  const categoryId = chunkableValueWriteCategory(host);
  const fromDerived = [...host.derivedChunkOutputs.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, chunk]) => chunk)
    .filter((chunk) => !chunk.fixedIndex && chunk.lockingBytecode.length === 35
      && chunk.commitment.length >= 3 && chunk.commitment !== '00');
  const derivedOwnerCategory = coherentAuthenticatedValueChunkRun(fromDerived)[0]?.categoryId;
  const stateOwnerCategory = derivedOwnerCategory
    ?? persistedValueChunkCategory(host)
    ?? categoryId;
  if (fromDerived.length > 0 && stateOwnerCategory) {
    host.rememberJobEventsChunks(stateOwnerCategory, fromDerived);
  }
  const rematerialize = shouldRematerializePersistUpdateForHost(host);
  const stagedValue = host.stagedValueChunkWrite(stateOwnerCategory)
    ?? host.stagedValueChunkWrite(categoryId);
  const stagedLock = host.persistValueChunkLock(stateOwnerCategory, stagedValue)
    ?? host.persistValueChunkLock(categoryId, stagedValue);
  const fromStaged = stagedValue
    ? chunksFromValue(stagedValue, {
      lockingBytecode: stagedLock,
      write: host.persistedValueChunkWrite(stateOwnerCategory),
      categoryId: stateOwnerCategory,
    })
    : [];
  const persistedValue = rematerialize
    ? (host.persistedValueChunkValue(stateOwnerCategory)
      ?? host.persistedValueChunkValue(categoryId))
    : undefined;
  const fromValue = persistedValue
    ? chunksFromValue(persistedValue, {
      lockingBytecode: host.persistValueChunkLock(stateOwnerCategory, persistedValue),
      write: host.persistedValueChunkWrite(stateOwnerCategory),
      categoryId: stateOwnerCategory,
    })
    : [];
  const persistChunks = rematerialize
    ? (host.persistedJobEventsChunks.length > 0
      ? host.persistedJobEventsChunks
      : (stateOwnerCategory
        ? settlement().persistedJobEventsByCategory.get(stateOwnerCategory) ?? [] : []))
    : [];
  // VM-observed chunks carry the exact root-addressed locking bytecode. A staged value can reconstruct
  // commitments, but without its collection/slot recipe it cannot authoritatively reconstruct the lock.
  // Keep the observed run atomic rather than allowing a guessed staged lock to replace its identity.
  const observed = selectObservedValueChunkRun(fromStaged, fromDerived);
  const source = rematerialize
    ? firstUsableValueChunkRun(observed, fromValue, persistChunks)
    : observed;
  const seen = new Set<string>();
  const chunks: Array<{ commitment: string; lockingBytecode: Uint8Array; categoryId?: string }> = [];
  for (const chunk of [...source].reverse()) {
    if (seen.has(chunk.commitment)) continue;
    seen.add(chunk.commitment);
    chunks.unshift(chunk);
  }
  chunks.sort((left, right) => {
    const leftIndex = Number.parseInt(left.commitment.slice(0, 2), 16)
      + 256 * Number.parseInt(left.commitment.slice(2, 4) || '00', 16);
    const rightIndex = Number.parseInt(right.commitment.slice(0, 2), 16)
      + 256 * Number.parseInt(right.commitment.slice(2, 4) || '00', 16);
    return leftIndex - rightIndex;
  });
  if (chunks.length === 0) {
    for (const { id, lockingBytecode } of host.getValueChunkVars()) {
      if (lockingBytecode.length !== 35 || lockingBytecode[0] !== 0xaa || lockingBytecode[1] !== 0x20) {
        continue;
      }
      for (const commitment of host.getValueChunkRawCommitments(id)) {
        if (!commitment || commitment === '00') continue;
        chunks.push({ commitment, lockingBytecode, categoryId: stateOwnerCategory ?? host.categoryId });
      }
    }
  }
  if (chunks.length === 0) return;
  // Never grow past the planned write: a longer Created extract (4) on a
  // first post (nNew=2) hung derivation. Fill only up to planned nNew so
  // history (5 of 6) still gets a continuation at slot 25.
  const liveBand = { start: band.start, nNew: band.nNew };
  const previousDerived = new Map(host.derivedChunkOutputs);
  for (const [index, chunk] of previousDerived) {
    if (!chunk.fixedIndex) host.derivedChunkOutputs.delete(index);
  }
  for (const [offset, chunk] of chunks.entries()) {
    const index = liveBand.start + offset;
    const prior = previousDerived.get(index);
    // A compiler-authenticated absolute pin owns its coordinate. The band chunks here are provisional: they
    // carry the pre-update value's P2SH32, so overwriting a fixed pin whose address comes from the post-update
    // value root leaves the covenant EQUALVERIFYing sha256(post-update value) against the pre-update address.
    if (prior?.fixedIndex === true
      && binToHex(prior.lockingBytecode) !== binToHex(chunk.lockingBytecode)) continue;
    const commitment = preferChunkCommitment(prior?.commitment, chunk.commitment);
    host.derivedChunkOutputs.set(index, {
      ...chunk,
      commitment,
      categoryId: stateOwnerCategory ?? chunk.categoryId ?? prior?.categoryId,
    });
  }
  const liveEnd = liveBand.start + liveBand.nNew - 1;
  for (const [index, prior] of previousDerived) {
    if (prior.fixedIndex) continue;
    if (index < liveBand.start || index > liveEnd) continue;
    if (host.derivedChunkOutputs.has(index)) continue;
    if (isEmptyValueChunkCommitment(prior.commitment) || prior.commitment === '00') continue;
    if (binToHex(prior.lockingBytecode) !== binToHex(chunks[0].lockingBytecode)) continue;
    host.derivedChunkOutputs.set(index, prior);
  }
  const reserved = new Set<number>();
  for (const [index, input] of host.allInputs.entries()) {
    if (input.token?.nft?.capability === 'minting') reserved.add(index);
  }
  for (const [index, group] of host.externalCallUtxoGroups.entries()) {
    if (groupOwnsInBlockReturnEvent(host.externalCallUtxoGroups, index)) continue;
    const tail = group.returnOutputIndex ?? group.plannedReturnOutputIndex;
    if (tail !== undefined && tail < liveBand.start) reserved.add(tail);
  }
  const stampDigest = shouldStampPersistUpdateDigestLockForHost(host);
  const persistTokenCategory = stateOwnerCategory;
  const recipeLock = stampDigest
    ? host.persistUpdateDigestLock(persistTokenCategory)
    : undefined;
  const redeemLock = chunks[0]?.lockingBytecode
    ?? recipeLock
    ?? host.jobEventsRedeemLock
    ?? (stateOwnerCategory ? persistedJobEventsLock(stateOwnerCategory) : undefined);
  const placed = applyRedeemLockToChunks(
    [...host.derivedChunkOutputs.entries()]
      .filter(([index]) => index >= liveBand.start && index <= liveEnd)
      .sort(([left], [right]) => left - right)
      .map(([, chunk]) => ({
        ...chunk,
        categoryId: stateOwnerCategory ?? chunk.categoryId,
      })),
    redeemLock ?? new Uint8Array(),
  );
  const occupancyEnd = writerBlockOccupancyEnd(
    host.externalCallUtxoGroups,
    (groupCategoryId) => host.findMintingInputIndex(groupCategoryId),
  );
  const opReturnAt = builder.outputs.findIndex((output, index) => (
    index >= liveBand.start
    && output.to instanceof Uint8Array
    && output.to.length === 1
    && output.to[0] === 0x6a
  ));
  const jobsCount = host.delegateDynamicChunksAtSuffix ? host.dynamicChunkOutputCount() : 0;
  const suffixStart = opReturnAt >= 0
    ? Math.min(opReturnAt, builder.outputs.length - jobsCount - (jobsCount > 0 ? 1 : 0))
    : builder.outputs.length - jobsCount - (jobsCount > 0 ? 1 : 0);
  placeValueChunksOnBand(builder.outputs, liveBand, placed, reserved, occupancyEnd, suffixStart);
  fillJobEventsBandHoles(builder.outputs, liveBand, {
    lockingBytecode: placed[0].lockingBytecode,
    categoryId: placed[0].categoryId ?? stateOwnerCategory,
  }, reserved, suffixStart, occupancyEnd);
  host.applyDerivedValueChunks(builder);
  const liveLock = placed[0].lockingBytecode;
  if (permitsLegacyNamedValueChunkFallbackForGroups(host)) {
    stripSurplusValueChunkLocks(builder.outputs, liveBand, liveLock, host.allInputs);
  }
}

/**
 * Send-time: size the jobEvents band to the live extracted/persisted nNew and
 * place every continuation, including when transferFrom skipped materialize.
 * Minting 1:1s stay reserved.
 */
export function ensureLiveJobEventsBand(
  host: JobEventsBandHost,
  builder: TransactionBuilder,
): void {
  const band = host.getChunkableValueWriteBand();
  if (!band) return;
  if (!permitsLegacyNamedValueChunkFallbackForGroups(host) && host.hasStagedValueChunkOutputs()) {
    const at = host.allInputs[band.start];
    if (at?.token?.nft?.capability === 'minting') {
      const publishCat = chunkableValueWriteCategory(host);
      if (!publishCat || at.token.category?.toLowerCase() !== publishCat.toLowerCase()) {
        return;
      }
    }
  }
  const categoryId = chunkableValueWriteCategory(host);
  const fromDerived = [...host.derivedChunkOutputs.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, chunk]) => chunk)
    .filter((chunk) => !chunk.fixedIndex && chunk.lockingBytecode.length === 35
      && chunk.commitment.length >= 3 && chunk.commitment !== '00');
  const derivedOwnerCategory = coherentAuthenticatedValueChunkRun(fromDerived)[0]?.categoryId;
  const persistTokenCategory = derivedOwnerCategory
    ?? persistedValueChunkCategory(host)
    ?? categoryId;
  const persistDigestLock = shouldUseLegacyPersistDigestLockForValueChunks({
    hasWriteMetadata: hasChunkableValueWriteMetadata(host),
    permitsLegacyFallback: permitsLegacyNamedValueChunkFallbackForGroups(host),
    stampPersistUpdate: shouldStampPersistUpdateDigestLockForHost(host),
  })
    ? host.persistUpdateDigestLock(persistTokenCategory)
    : (shouldRematerializePersistUpdateForHost(host)
      ? persistUpdateRedeemLock(
        persistTokenCategory, host.jobEventsRedeemLock,
        host.persistedValueChunkWrite(persistTokenCategory),
      )
      : undefined);
  const stagedValue = host.stagedValueChunkWrite(categoryId)
    ?? host.stagedValueChunkWrite(persistTokenCategory);
  const persistValue = stagedValue
    ?? host.persistedValueChunkValue(persistTokenCategory);
  const publishCategory = chunkableValueWriteCategory(host);
  const persistVLock = host.persistValueChunkLock(persistTokenCategory, persistValue)
    ?? host.persistValueChunkLock(publishCategory, persistValue);

  const redeemLock = persistVLock
    ?? persistDigestLock
    ?? host.jobEventsRedeemLock
    ?? (categoryId ? persistedJobEventsLock(categoryId) : undefined);
  const persistedValue = shouldRematerializePersistUpdateForHost(host)
    ? (host.persistedValueChunkValue(persistTokenCategory)
      ?? host.persistedValueChunkValue(categoryId))
    : undefined;
  const fromValue = persistedValue
    ? chunksFromValue(persistedValue, {
      lockingBytecode: redeemLock,
      write: host.persistedValueChunkWrite(persistTokenCategory),
      categoryId: persistTokenCategory,
    })
    : [];
  const fromStaged = stagedValue
    ? chunksFromValue(stagedValue, {
      lockingBytecode: redeemLock,
      write: host.persistedValueChunkWrite(persistTokenCategory),
      categoryId: persistTokenCategory,
    })
    : [];
  const observed = selectObservedValueChunkRun(fromStaged, fromDerived);
  const source = shouldRematerializePersistUpdateForHost(host)
    ? firstUsableValueChunkRun(observed, fromValue)
    : observed;
  const lockCounts = new Map<string, { lock: Uint8Array; n: number }>();
  for (let index = band.start; index < band.start + Math.max(band.nNew, 8); index++) {
    const lock = builder.outputs[index]?.to;
    if (!(lock instanceof Uint8Array) || lock.length !== 35 || lock[0] !== 0xaa) continue;
    const key = binToHex(lock);
    lockCounts.set(key, { lock, n: (lockCounts.get(key)?.n ?? 0) + 1 });
  }
  let dominant: Uint8Array | undefined;
  let dominantCount = 0;
  for (const value of lockCounts.values()) {
    if (value.n > dominantCount) {
      dominant = value.lock;
      dominantCount = value.n;
    }
  }
  const siblingLock = source[0]?.lockingBytecode
    ?? persistDigestLock
    ?? dominant
    ?? redeemLock
    ?? fromDerived[0]?.lockingBytecode;
  if (!siblingLock || siblingLock.length !== 35) return;
  const persistWidth = categoryId ? persistedJobEventsWidth(categoryId) : 0;
  const liveN = liveJobEventsBandWidth({
    plannedWidth: band.nNew,
    persistWidth,
    derivedWidth: source.length,
  });
  // Dominant lock count can include a leftover probe slot (output 25). The
  // covenant EQUALVERIFYs nNew from v; extra same-lock outputs fail. Grow
  // only from extracted/persisted width, then strip the rest.
  const liveBand = { start: band.start, nNew: Math.max(band.nNew, liveN, 1) };
  const reserved = new Set<number>();
  for (const [index, input] of host.allInputs.entries()) {
    if (input.token?.nft?.capability === 'minting') reserved.add(index);
  }
  const occupancyEnd = writerBlockOccupancyEnd(
    host.externalCallUtxoGroups,
    (groupCategoryId) => host.findMintingInputIndex(groupCategoryId),
  );
  const jobsCount = host.delegateDynamicChunksAtSuffix ? host.dynamicChunkOutputCount() : 0;
  const suffixStart = builder.outputs.length - jobsCount - (jobsCount > 0 ? 1 : 0);
  placeValueChunksOnBand(builder.outputs, liveBand, applyRedeemLockToChunks(
    source.map((chunk) => ({
      ...chunk,
      lockingBytecode: siblingLock,
      categoryId: persistTokenCategory ?? chunk.categoryId,
    })),
    siblingLock,
  ), reserved, occupancyEnd, suffixStart);
  fillJobEventsBandHoles(builder.outputs, liveBand, {
    lockingBytecode: siblingLock,
    categoryId: persistTokenCategory ?? source[0]?.categoryId,
  }, reserved, suffixStart, occupancyEnd);
  if (permitsLegacyNamedValueChunkFallbackForGroups(host)) {
    stripSurplusValueChunkLocks(builder.outputs, liveBand, siblingLock, host.allInputs);
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_PAD_HOLE === '1' && builder.outputs[6] && !builder.outputs[6]?.token) {
    console.error('pad-hole-at-6', {
      lock: builder.outputs[6]?.to instanceof Uint8Array
        ? binToHex(builder.outputs[6]!.to as Uint8Array).slice(0, 20)
        : builder.outputs[6]?.to,
      nearby: builder.outputs.slice(4, 10).map((output, offset) => ({
        index: 4 + offset,
        cap: output?.token?.nft?.capability,
        lock: output?.to instanceof Uint8Array ? binToHex(output.to).slice(0, 16) : String(output?.to ?? '').slice(0, 16),
      })),
    });
  }
  packJobsSuffix(host, builder);
  host.applyDerivedEntryOutputs(builder);
  host.reassertInBlockWriterReturns(builder);
}

/**
 * Successful publishJobEvent writes must seed persist even when derivation
 * never failed (the extract-on-fail path never ran). The next UPDATE uses
 * persistWidth to drop insertShift so chunks stay at impl+blockSize.
 */
export function persistPlacedJobEventsBand(
  host: JobEventsBandHost,
  builder: TransactionBuilder,
  txid?: string,
): void {
  const band = host.getChunkableValueWriteBand();
  if (!band) return;
  const categoryId = chunkableValueWriteCategory(host);
  if (!categoryId) return;
  const liveLocks = new Map<string, { lock: Uint8Array; n: number }>();
  for (let index = band.start; index <= band.end; index++) {
    const output = builder.outputs[index];
    const lock = output?.to instanceof Uint8Array ? output.to : undefined;
    if (!lock || lock.length !== 35 || lock[0] !== 0xaa) continue;
    if (output?.token?.nft?.capability !== 'mutable') continue;
    const key = binToHex(lock);
    liveLocks.set(key, { lock, n: (liveLocks.get(key)?.n ?? 0) + 1 });
  }
  let liveLock: Uint8Array | undefined;
  let liveCount = 0;
  for (const value of liveLocks.values()) {
    if (value.n > liveCount) {
      liveLock = value.lock;
      liveCount = value.n;
    }
  }
  const redeemLock = liveLock ?? host.jobEventsRedeemLock ?? persistedJobEventsLock(categoryId);
  const chunks: AuthenticatedValueChunk[] = [];
  const spends: Array<{
    txid: string;
    vout: number;
    satoshis: bigint;
    token: NonNullable<Utxo['token']>;
    lockingBytecode: Uint8Array;
  }> = [];
  for (let index = band.start; index <= band.end; index++) {
    const output = builder.outputs[index];
    const lock = output?.to instanceof Uint8Array ? output.to : undefined;
    const commitment = String(output?.token?.nft?.commitment ?? '');
    if (!lock || lock.length !== 35 || lock[0] !== 0xaa) continue;
    if (output?.token?.nft?.capability !== 'mutable') continue;
    if (commitment.length < 3 || commitment === '00' || isEmptyValueChunkCommitment(commitment)) continue;
    if (redeemLock && binToHex(lock) !== binToHex(redeemLock)) continue;
    chunks.push({
      commitment,
      lockingBytecode: lock,
      categoryId: output.token?.category ?? categoryId,
    });
    if ((commitment.startsWith('00004cb4') || commitment.includes('4372656174'))
      && !settlement().createdDigestLocks.has(output.token?.category ?? categoryId)) {
      const persistCat = output.token?.category ?? categoryId;
      settlement().persistedJobEventsLocks.set(persistCat, lock);
      settlement().createdDigestLocks.add(persistCat);
    }
    if (txid && output.token) {
      spends.push({
        txid,
        vout: index,
        satoshis: output.amount,
        token: output.token,
        lockingBytecode: lock,
      });
    }
  }
  if (chunks.length === 0) return;
  host.rememberJobEventsChunks(categoryId, chunks);
  const selection = valueChunkWriteCategorySelection(host);
  if (selection.status === 'exact') {
    if (spends.length > 0) {
      settlement().persistedValueChunkSpends.set(valueChunkWriteIdentity(selection.write), spends);
    }
    const staged = stagedValueChunkWrite(selection.write, host.valueChunkWriteStagingSession);
    const authenticatedLock = redeemLock ?? chunks[0]?.lockingBytecode;
    if (staged && authenticatedLock) {
      commitStagedValueChunkWrite(
        selection.write, authenticatedLock, host.valueChunkWriteStagingSession,
      );
    }
    host.valueChunkWriteStagingSession?.delete(selection.write);
  } else if (selection.status === 'absent' && !hasChunkableValueWriteMetadata(host)
    && permitsLegacyNamedValueChunkFallbackForGroups(host)) {
    // Compatibility only for descriptor-free artifacts.
    if (spends.length > 0) settlement().persistedJobEventsSpends.set(categoryId, spends);
    const staged = settlement().stagedJobEventsValues.get(categoryId)
      ?? latestPersisted(settlement().stagedJobEventsValues, categoryId);
    if (redeemLock) rememberJobEventsLock(categoryId, redeemLock);
    else if (chunks[0]) rememberJobEventsLock(categoryId, chunks[0].lockingBytecode);
    if (staged) {
      rememberJobEventsValue(categoryId, staged);
      for (const otherId of settlement().stagedJobEventsValues.keys()) rememberJobEventsValue(otherId, staged);
    }
    rememberJobEventsUnlockRecipe(categoryId);
    if (settlement().persistedJobEventsValues.size > 0) {
      for (const otherId of settlement().persistedJobEventsValues.keys()) rememberJobEventsUnlockRecipe(otherId);
    }
    settlement().stagedJobEventsValues.delete(categoryId);
    settlement().persistedJobEventsSendReady = true;
  }
}
