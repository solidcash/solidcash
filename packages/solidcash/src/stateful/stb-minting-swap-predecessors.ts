/**
 * phase-boundary extract: STB class-body extract — minting-band swap, JobEvents predecessor placement,
 * swapped token-entry hole fill, and external entry locking bytecode.
 * Free functions over MintingSwapPredecessorHost (extends ScaledPreserveEmitHost).
 */

import type { AbiFunction, Artifact, EntryAccessAbi, FunctionBlockLayout } from '@solidcash/utils';
import { buildEntryNftCovenantScript, computeCollectionHash } from '@solidcash/utils';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo } from '../interfaces.js';
import { addressToLockScript, scriptToLockingBytecode } from '../utils.js';
import { createDataNftUnlocker } from './covenant-helpers.js';
import type { EntryNftInfo, ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { shouldKeepPersistAtLayoutBase } from './early-value-chunk-helpers.js';
import {
  assignPersistPredecessors,
  orderPersistPredecessorCandidates,
  persistOccupantDisplaceable,
  persistPredecessorPlaceCount,
  persistUpdatePredecessorDests,
} from './persist-predecessor-layout.js';
import {
  chooseParticipantRelocationShift,
  gatherContiguousPlainFunders,
} from './physical-return-layout.js';
import {
  chunkableValueWriteExecution,
  hasChunkableValueWriteMetadata,
  isInitialChunkableValueWrite,
  isPersistedChunkableValueWriteReady,
  chunkableValueWriteCategory,
  persistedValueChunkCategory,
} from './stb-chunkable-write-planning.js';
import {
  chunkableValueWriteInputIndex,
  hasMintingBandTokenWriter as hasMintingBandTokenWriterForHost,
  type ScaledPreserveEmitHost,
} from './stb-scaled-preserve-emit.js';
import { settlement, valueChunkIndexFromCommitment } from './value-chunk-persist.js';
import {
  collidingParticipantGroupIndex,
  materializedParticipantWidth,
  participantSpanOverlapsLane,
  shouldRetainMintingOutputSwap,
} from './value-chunk-geometry.js';

export interface MintingSwapPredecessorHost extends Omit<
ScaledPreserveEmitHost,
'allInputs' | 'mintingOutputSwap' | 'externalCallUtxoGroups'
> {
  readonly allInputs: UnlockableUtxo[];
  funderUtxos: UnlockableUtxo[];
  pendingValueChunkPredecessors: UnlockableUtxo[];
  readonly preserveBlockLayoutWidth: boolean;
  readonly compilerRouteDelegateBlock: boolean;
  readonly entryNfts: readonly EntryNftInfo[];
  readonly externalCallEntryOutputs: ReadonlyMap<string, ReadonlyMap<number, string>>;
  /** Mutable groups — callers may rewrite `dataNftUtxos` after relocation. */
  readonly externalCallUtxoGroups: ExternalCallUtxoGroup[];
  getMintingOutputSwap(): { from: number; width: number; categoryId: string } | undefined;
  setMintingOutputSwap(swap: { from: number; width: number; categoryId: string } | undefined): void;
  getRelocationFunderUtxos(): UnlockableUtxo[];
  setRelocationFunderUtxos(next: UnlockableUtxo[]): void;
}

/** Route slot indices are physical; a selected handler's local ordinal is only a legacy fallback. */
export function physicalEntryAccessForSlot(
  route: Pick<AbiFunction, 'entryAccesses'> | undefined,
  handlers: readonly Pick<AbiFunction, 'entryAccesses'>[],
  slotIndex: number,
): EntryAccessAbi | undefined {
  const atSlot = (fn: Pick<AbiFunction, 'entryAccesses'>): EntryAccessAbi | undefined =>
    fn.entryAccesses?.find((access, denseIndex) => access !== undefined
      && (access.slotIndex ?? denseIndex) === slotIndex);
  if (route?.entryAccesses !== undefined) return atSlot(route);
  return handlers.map(atSlot).find((access) => access !== undefined);
}

/** A learned commitment belongs to the exact collection covenant lock, not just its output coordinate. */
export function cachedEntryOutputOwnsLock(
  cachedLockingBytecodeHex: string,
  currentLockingBytecode: Uint8Array,
): boolean {
  return cachedLockingBytecodeHex.toLowerCase() === binToHex(currentLockingBytecode).toLowerCase();
}

/**
 * Construct an external entry slot's covenant from compiler metadata. Balanced composition can place an
 * unrelated participant or funder in an output-only entry position; its unlocker is therefore not a safe
 * source for the output locking bytecode. The collection signature and owning category define the lock.
 */
export function externalEntryLockingBytecode(
  group: ExternalCallUtxoGroup,
  slot: FunctionBlockLayout['slots'][number],
): Uint8Array | undefined {
  if (slot.kind !== 'entry') return undefined;
  const artifacts = [group.logicalArtifact, group.externalContract?.inner?.artifact]
    .filter((artifact, index, all): artifact is Artifact => artifact !== undefined
      && all.indexOf(artifact) === index);
  const functionNames = new Set([
    group.logicalFunctionName,
    group.functionName,
  ].filter((name): name is string => name !== undefined));
  const abiFunctions = artifacts.flatMap((artifact) => (artifact.abi as readonly AbiFunction[])
    .filter((candidate) => functionNames.has(candidate.name)));
  const entryAccess = physicalEntryAccessForSlot(
    group.compilerRoute?.abiFunction, abiFunctions, slot.slotIndex ?? 0,
  );
  const collections = [group.stateLayout, ...artifacts.map((artifact) => artifact.stateLayout)]
    .flatMap((layout) => layout?.collections ?? [])
    .filter((collection, index, all) => all.findIndex((candidate) => (
      candidate.signature === collection.signature
    )) === index);
  const collection = entryAccess
    ? collections.find((candidate) => candidate.name === entryAccess.collection
      || candidate.signature === entryAccess.collection)
    // Interface artifacts can omit implementation entry-access metadata. A state layout with exactly one
    // collection still identifies an entry slot without ambiguity; refuse to guess when several exist.
    : group.compilerRoute?.abiFunction?.entryAccesses === undefined && collections.length === 1
      ? collections[0] : undefined;
  return collection?.signature ? scriptToLockingBytecode(
    buildEntryNftCovenantScript(
      hexToBin(group.categoryId), computeCollectionHash(collection.signature),
    ),
    group.logicalContract?.inner?.addressType
      ?? group.externalContract?.inner?.addressType
      ?? 'p2sh32',
  ) : undefined;
}

/** An extra-transfer swap can park funders on the value-chunk band; put predecessor chunks back. */
export function placeValueChunkPredecessorInputs(
  host: MintingSwapPredecessorHost,
  extras: UnlockableUtxo[] = [],
): void {
  // A compiler-published balanced block is a complete ownership map. Legacy persistence recovery infers
  // destinations from cached input shape, so applying it after fixed-width assembly can replace a declared
  // route slot with an unrelated resource. Compiler routes must receive every live/disposal input through the
  // ordinary builder options and leave the materialized block immutable.
  if (host.preserveBlockLayoutWidth || host.compilerRouteDelegateBlock
    || host.blockLayout?.trailingCapacity !== undefined) return;
  const band = host.getChunkableValueWriteBand();
  if (!band) return;
  const categoryId = chunkableValueWriteCategory(host);
  const persistUpdate = isPersistedChunkableValueWriteReady(host)
    && !isInitialChunkableValueWrite(host);
  const persistCategory = persistUpdate
    ? (persistedValueChunkCategory(host) ?? categoryId) : categoryId;
  const persistLock = (persistCategory ? settlement().persistedJobEventsLocks.get(persistCategory) : undefined)
    ?? (categoryId ? settlement().persistedJobEventsLocks.get(categoryId) : undefined);
  const persistHex = persistLock ? binToHex(persistLock) : '';
  const candidates: UnlockableUtxo[] = [];
  const seen = new Set<string>();
  const consider = (input: UnlockableUtxo | undefined, fromPersistExtras = false): void => {
    if (!input?.token?.nft || input.token.nft.capability !== 'mutable' || !input.unlocker) return;
    const key = `${input.txid}:${input.vout}`;
    if (seen.has(key)) return;
    const lock = input.unlocker.generateLockingBytecode();
    if (lock.length !== 35 || lock[0] !== 0xaa) return;
    const commitment = String(input.token.nft.commitment ?? '');
    // Continuation NFTs are unambiguously indexed by their uint16 prefix. A sorted-map entry may share the
    // category and even the same P2SH32 family, but its commitment begins with the 32-byte key slot instead.
    if (valueChunkIndexFromCommitment(commitment) === undefined) return;
    const sameLock = persistHex !== '' && binToHex(lock) === persistHex;
    // Category and commitment shape do not identify a resource covenant. Entry NFTs and value-chunk NFTs
    // intentionally share both, so accepting either as a substitute can move a fixed entry proof out of its
    // compiler-declared input slot. Locally discovered candidates must match the authenticated redeem-script
    // identity; explicitly fetched candidates were already checked against that identity by their caller.
    if (!fromPersistExtras && !sameLock) return;
    seen.add(key);
    candidates.push(input);
  };
  for (const extra of extras) consider(extra, true);
  for (const input of host.allInputs) consider(input);
  if (persistUpdate) {
    const describedCollection = chunkableValueWriteExecution(host)?.collection;
    for (const info of host.entryNfts) {
      if (!info.exists || !info.utxo) continue;
      if (describedCollection !== undefined) {
        if (info.collection !== describedCollection) continue;
      } else if (hasChunkableValueWriteMetadata(host) || persistHex === '') {
        // With no descriptor, admit only an already authenticated persisted continuation lock.
        // The candidate's exact lock and commitment are checked by consider() below.
        continue;
      }
      consider(info.utxo);
    }
  }
  const ordered = orderPersistPredecessorCandidates(candidates, persistUpdate);
  candidates.length = 0;
  candidates.push(...ordered);
  const needed = persistPredecessorPlaceCount(band.nNew, candidates.length, persistUpdate);
  const keepAtLayout = shouldKeepPersistAtLayoutBase({
    persistReady: persistUpdate,
    firstPublish: isInitialChunkableValueWrite(host),
    layoutDestOccupiedByMintingWriter: hasMintingBandTokenWriterForHost(host),
  });
  const dests = persistUpdatePredecessorDests({
    implIndex: chunkableValueWriteInputIndex(host),
    persistUpdate,
    keepAtLayout,
    bandStart: band.start,
    nNew: needed,
  });
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_OCCUPANCY === '1') {
    const dest18 = host.allInputs[18];
    console.error('persist-place-occupancy', {
      persistUpdate,
      keepAtLayout,
      persistReady: isPersistedChunkableValueWriteReady(host),
      firstPublish: isInitialChunkableValueWrite(host),
      hasTokenWriter: hasMintingBandTokenWriterForHost(host),
      impl: chunkableValueWriteInputIndex(host),
      band,
      dests,
      dest18cap: dest18?.token?.nft?.capability ?? 'plain',
      dest18cat: dest18?.token?.category?.slice(0, 16),
      dest18commit: String(dest18?.token?.nft?.commitment ?? '').slice(0, 16),
    });
  }
  const placements = assignPersistPredecessors(
    dests, candidates, chunkableValueWriteInputIndex(host), persistUpdate,
  );
  for (const { dest, candidate: wanted } of placements) {
    if (dest < 0 || dest >= host.allInputs.length) continue;
    const occupant = host.allInputs[dest];
    const occupantLock = occupant && 'unlocker' in occupant && occupant.unlocker
      ? occupant.unlocker.generateLockingBytecode() : undefined;
    const occupantIsPad = !occupant?.token
      || (!!occupantLock && occupantLock.length === 25 && occupantLock[0] === 0x76)
      || (!!occupantLock && occupantLock.length === 1 && occupantLock[0] === 0x51);
    const already = host.allInputs.findIndex((input) =>
      input?.txid === wanted.txid && input.vout === wanted.vout);
    if (already === dest) continue;
    if (!persistOccupantDisplaceable({
      occupantIsPad,
      persistUpdate,
      keepAtLayout,
      occupantCapability: occupant?.token?.nft?.capability,
      occupantCommitment: occupant?.token?.nft?.commitment,
    })) continue;
    if (already >= 0) {
      const displaced = host.allInputs[dest];
      host.allInputs[dest] = host.allInputs[already];
      host.allInputs[already] = displaced;
      continue;
    }
    const displaced = host.allInputs[dest];
    host.allInputs[dest] = wanted;
    if (!displaced) continue;
    let parked = false;
    for (let index = band.end + 1; index < host.allInputs.length; index++) {
      if (host.allInputs[index]?.token) continue;
      host.allInputs[index] = displaced;
      parked = true;
      break;
    }
    if (!parked) {
      for (let index = host.allInputs.length - 1; index > band.end; index--) {
        if (host.allInputs[index]?.token) continue;
        host.allInputs[index] = displaced;
        parked = true;
        break;
      }
    }
  }
}

/** Move a participant block off a compiler-owned dynamic-output band without changing existing order. */
export function swapMintingOffValueChunkBand(host: MintingSwapPredecessorHost): void {
  const band = host.getChunkableValueWriteBand();
  if (!band) return;
  const collisionIndex = collidingParticipantGroupIndex(
    host.externalCallUtxoGroups,
    (categoryId) => host.findMintingInputIndex(categoryId),
    band,
    host.messageBusConvention,
  );
  const tokenGroup = collisionIndex >= 0
    ? host.externalCallUtxoGroups[collisionIndex]
    : undefined;
  if (!tokenGroup?.categoryId) return;
  const previousSwap = host.getMintingOutputSwap();
  const start = host.findMintingInputIndex(tokenGroup.categoryId);
  if (start < 0) { host.setMintingOutputSwap(undefined); return; }
  const { start: jobEventsStart, nNew } = band;
  const persistUpdate = isPersistedChunkableValueWriteReady(host)
    && !isInitialChunkableValueWrite(host);
  const keepAtLayout = shouldKeepPersistAtLayoutBase({
    persistReady: persistUpdate,
    firstPublish: isInitialChunkableValueWrite(host),
    layoutDestOccupiedByMintingWriter: hasMintingBandTokenWriterForHost(host),
  });
  const persistDests = persistUpdatePredecessorDests({
    implIndex: chunkableValueWriteInputIndex(host),
    persistUpdate,
    keepAtLayout,
    bandStart: jobEventsStart,
    nNew,
  });
  const persistStart = persistDests[0] ?? jobEventsStart;
  const persistEndExclusive = persistDests.length > 0
    ? persistDests[persistDests.length - 1] + 1 : jobEventsStart;
  const chunkBase = keepAtLayout && persistStart >= 0
    ? Math.min(jobEventsStart, persistStart) : jobEventsStart;
  const plannedWidth = nNew;
  const bandEnd = Math.max(band.end + 1, persistEndExclusive);
  // Count the full consecutive token run (master + data + existing entries).
  // A band-limited width of 1 tries to swap the minting NFT with the data NFT
  // and aborts, leaving minting on a chunk slot so derived chunks are missing.
  // A same-size swap of all 5 tokens lands the master at 27 and breaks the
  // known-good return at 33. Rotate K funders from *after* the token run
  // in front of it so the run stays consecutive and the master clears the
  // chunk band (K=4 → start 22 becomes master 26).
  let tokenWidth = 0;
  while (start + tokenWidth < host.allInputs.length
    && host.allInputs[start + tokenWidth]?.token?.category === tokenGroup.categoryId
    && host.allInputs[start + tokenWidth]?.token?.nft) {
    tokenWidth += 1;
  }
  const participantWidth = materializedParticipantWidth(tokenGroup, start, band);
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
    console.error('minting-swap-band', {
      chunkBase, jobEventsStart, bandEnd, start, tokenWidth, participantWidth, plannedWidth, nNew,
      inBand: participantSpanOverlapsLane(start, participantWidth, {
        start: chunkBase, endExclusive: bandEnd,
      }),
    });
  }
  if (!participantSpanOverlapsLane(start, participantWidth, {
    start: chunkBase, endExclusive: bandEnd,
  })) {
    // Probe builds reuse `allInputs`. Once the first pass rotates this token block, the next pass sees the
    // already-correct master and must retain the relocation metadata so output materialization still
    // places view tails. Exact `from+width` is too brittle: a later 2-wide shift (26→28) would drop
    // the flag, skip tail placement, and compact `meceTags` onto `arbitratorRegistered`.
    if (shouldRetainMintingOutputSwap(start, chunkBase, nNew, previousSwap, tokenGroup.categoryId)) {
      placeValueChunkPredecessorInputs(host, host.pendingValueChunkPredecessors);
      return;
    }
    host.setMintingOutputSwap(undefined);
    placeValueChunkPredecessorInputs(host, host.pendingValueChunkPredecessors);
    return;
  }
  host.setMintingOutputSwap(undefined);
  if (tokenWidth === 0) return;
  const fullMinShift = Math.max(1, bandEnd - start);
  const relocationPool = [...host.funderUtxos, ...host.getRelocationFunderUtxos()];
  const funderOutpoints = new Set(relocationPool.map((funder) => `${funder.txid}:${funder.vout}`));
  const promoteRelocationFunder = (funder: UnlockableUtxo): void => {
    const key = `${funder.txid}:${funder.vout}`;
    if (!host.funderUtxos.some((candidate) => `${candidate.txid}:${candidate.vout}` === key)) {
      host.funderUtxos.push(funder);
    }
    host.setRelocationFunderUtxos(host.getRelocationFunderUtxos().filter(
      (candidate) => `${candidate.txid}:${candidate.vout}` !== key,
    ));
  };
  const preferredShift = Math.max(fullMinShift, 4);
  const prospectiveWidth = materializedParticipantWidth(
    tokenGroup,
    start + preferredShift,
    band,
  );
  const trailingSlots = Math.max(0, prospectiveWidth - tokenWidth);
  const preferredCapacity = preferredShift + trailingSlots;
  let availableFunders = gatherContiguousPlainFunders(
    host.allInputs, funderOutpoints, start + tokenWidth, preferredCapacity,
  );
  if (availableFunders < preferredCapacity) {
    const inUse = new Set(host.allInputs.map((input) => `${input.txid}:${input.vout}`));
    for (const funder of relocationPool) {
      if (availableFunders >= preferredCapacity) break;
      const key = `${funder.txid}:${funder.vout}`;
      if (inUse.has(key)) continue;
      host.allInputs.splice(start + tokenWidth + availableFunders, 0, funder);
      promoteRelocationFunder(funder);
      inUse.add(key);
      availableFunders += 1;
    }
  }
  const minShift = fullMinShift;
  const shift = chooseParticipantRelocationShift(availableFunders, minShift, trailingSlots);
  if (shift === 0) return;
  const tokenBlock = host.allInputs.slice(start, start + tokenWidth);
  const funderBlock = host.allInputs.slice(start + tokenWidth, start + tokenWidth + shift);
  host.allInputs.splice(start, tokenWidth + shift, ...funderBlock, ...tokenBlock);
  host.setMintingOutputSwap({ from: start, width: shift, categoryId: tokenGroup.categoryId });
  placeValueChunkPredecessorInputs(host, host.pendingValueChunkPredecessors);
  const newMaster = host.findMintingInputIndex(tokenGroup.categoryId);
  if (newMaster < 0) return;
  // Sparse blocks still own their output-only coordinates. Keep later
  // participants out of those slots by filling the remainder with already
  // serialized funding inputs (or unused real funders as a last resort).
  let reservedTrailing = gatherContiguousPlainFunders(
    host.allInputs, funderOutpoints, newMaster + tokenWidth, trailingSlots,
  );
  if (reservedTrailing < trailingSlots) {
    const inUse = new Set(host.allInputs.map((input) => `${input.txid}:${input.vout}`));
    for (const funder of relocationPool) {
      if (reservedTrailing >= trailingSlots) break;
      const key = `${funder.txid}:${funder.vout}`;
      if (inUse.has(key)) continue;
      host.allInputs.splice(newMaster + tokenWidth + reservedTrailing, 0, funder);
      promoteRelocationFunder(funder);
      inUse.add(key);
      reservedTrailing += 1;
    }
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
    console.error('minting-swap-reserved-span', {
      newMaster,
      tokenWidth,
      trailingSlots,
      reservedTrailing,
      blockSize: tokenGroup.blockLayout?.blockSize,
      returnEventInBlock: tokenGroup.returnEventInBlock,
      returnOffset: tokenGroup.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent')?.offset,
      band,
    });
  }
  tokenGroup.dataNftUtxos = tokenGroup.dataNftUtxos.map((utxo) => ({
    ...utxo,
    unlocker: createDataNftUnlocker(tokenGroup.externalContract.inner, newMaster, tokenGroup.categoryId),
  }));
  for (const nft of tokenGroup.dataNftUtxos) {
    const inputIndex = host.allInputs.findIndex((input) =>
      input.txid.toLowerCase() === nft.txid.toLowerCase() && input.vout === nft.vout);
    if (inputIndex >= 0) host.allInputs[inputIndex] = nft;
  }
}

/**
 * After the 4-wide swap, conditional entry slots whose blockInputs were funders
 * emit as P2PKH. FakeToken.transferFrom then reads master+4 (output 30) as a
 * pred-out/entry and fails GTE on an empty token category. Re-fill those holes
 * with same-category mutable placeholders so derivation can reveal the commitment.
 */
export function fillSwappedTokenEntryHoles(
  host: MintingSwapPredecessorHost,
  builder: TransactionBuilder,
): void {
  const mintingSwap = host.getMintingOutputSwap();
  if (!mintingSwap) return;
  const master = host.findMintingInputIndex(mintingSwap.categoryId);
  if (master < 0) return;
  const tokenGroup = host.externalCallUtxoGroups.find((group) =>
    group.categoryId === mintingSwap.categoryId && group.sharedGroupIndex === undefined);
  if (!tokenGroup?.blockLayout) return;
  const sibling = builder.outputs.slice(master, master + tokenGroup.blockLayout.blockSize).find((output) =>
    output.token?.category === tokenGroup.categoryId && output.token.nft?.capability === 'mutable');
  const siblingLock = sibling?.to instanceof Uint8Array
    ? sibling.to
    : sibling?.to !== undefined ? addressToLockScript(sibling.to) : Uint8Array.of(0x51);
  for (const slot of tokenGroup.blockLayout.slots) {
    if (slot.kind !== 'entry') continue;
    const index = master + slot.offset;
    const existing = builder.outputs[index];
    if (existing?.token?.category === tokenGroup.categoryId) continue;
    const derived = host.externalCallEntryOutputs.get(tokenGroup.categoryId)?.get(slot.offset);
    const usedCommits = new Set(
      builder.outputs
        .filter((output) => output.token?.category === tokenGroup.categoryId
          && output.token.nft?.capability === 'mutable')
        .map((output) => String(output.token?.nft?.commitment ?? '')),
    );
    const unusedInput = host.allInputs.find((input) =>
      input.token?.category === tokenGroup.categoryId
      && input.token.nft?.capability === 'mutable'
      && !usedCommits.has(String(input.token.nft.commitment ?? '')));
    const lock = externalEntryLockingBytecode(tokenGroup, slot)
      ?? tokenGroup.batchEntryLockingBytecodes?.get(slot.offset)
      ?? (unusedInput && 'unlocker' in unusedInput && unusedInput.unlocker
        ? unusedInput.unlocker.generateLockingBytecode()
        : siblingLock);
    builder.outputs[index] = {
      to: lock,
      amount: unusedInput?.satoshis ?? 1000n,
      token: {
        amount: 0n,
        category: tokenGroup.categoryId,
        nft: {
          capability: 'mutable',
          commitment: derived
            ?? unusedInput?.token?.nft?.commitment
            ?? '00'.repeat(128),
        },
      },
    };
  }
  for (const slot of tokenGroup.blockLayout.slots) {
    if (slot.kind !== 'event') continue;
    const index = master + slot.offset;
    const existing = builder.outputs[index];
    const commit = String(existing?.token?.nft?.commitment ?? '');
    if (existing?.token?.category !== tokenGroup.categoryId) continue;
    if (existing.token.nft?.capability !== 'none') continue;
    if (commit !== '' && !/^0+$/.test(commit)) continue;
    builder.outputs[index] = {
      ...existing,
      token: {
        amount: 0n,
        category: tokenGroup.categoryId,
        nft: { capability: 'none', commitment: '' },
      },
    };
  }
}
