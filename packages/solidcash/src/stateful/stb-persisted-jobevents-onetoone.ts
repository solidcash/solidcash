/**
 * phase-boundary extract: STB class-body extract — persist UPDATE JobEvents / value-chunk 1:1 reassert.
 */

import { encodeChunkableValueTail } from '@solidcash/utils';
import { binToHex } from '@bitauth/libauth';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo } from '../interfaces.js';
import {
  isMaterializedImmutableNftOutput,
  persistUpdateDestLock,
} from './delegate-event-jobevent-helpers.js';
import { chunksFromValue, shouldKeepPersistAtLayoutBase } from './early-value-chunk-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  persistUpdatePredecessorDests,
  isPersistValueChunkCommitment,
  persistValueChunkBase,
} from './persist-predecessor-layout.js';
import { keyToSlot, encodeEntryCommitment } from './SortedList.js';
import { isDataNftIndexCommitment } from './sorted-entry-commitment.js';
import { externalEntryLockingBytecode } from './stb-minting-swap-predecessors.js';
import {
  chunkableValueWriteInputIndex,
  emitDestinationIndices,
  type ScaledPreserveEmitHost,
} from './stb-scaled-preserve-emit.js';
import { cloneToken } from './stb-output-utils.js';
import {
  hasChunkableValueWriteMetadata,
  isInitialChunkableValueWrite,
  isPersistedChunkableValueWriteReady,
  chunkableValueWriteCategory,
  permitsLegacyNamedValueChunkFallbackForGroups,
  persistedValueChunkCategory,
  shouldRematerializePersistUpdateForHost,
  shouldStampPersistUpdateDigestLockForHost,
} from './stb-chunkable-write-planning.js';
import {
  persistedCompatibilityValueChunkLock,
  persistUpdateRedeemLock,
  valueChunkIndexFromCommitment,
  type ValueChunkWriteDescriptor,
} from './value-chunk-persist.js';
import type { FunctionBlockLayout } from '@solidcash/utils';

export interface PersistedJobEventsOneToOneHost extends ScaledPreserveEmitHost {
  readonly compilerRouteDelegateBlock: boolean;
  readonly preserveBlockLayoutWidth: boolean;
  readonly pendingJobEventsPredecessors: readonly UnlockableUtxo[];
  readonly valueChunkRedeemLock?: Uint8Array;
  hasMintingBandTokenWriter(): boolean;
  declaredExternalOutputSlotOwner(outputIndex: number): {
    categoryId: string;
    groupIndex: number;
    group: ExternalCallUtxoGroup;
    slot: FunctionBlockLayout['slots'][number];
  } | undefined;
  persistUpdateDigestLock(categoryId?: string): Uint8Array | undefined;
  persistValueChunkLock(categoryId?: string, value?: Uint8Array): Uint8Array | undefined;
  persistedValueChunkValue(categoryId?: string): Uint8Array | undefined;
  persistedValueChunkWrite(categoryId?: string): ValueChunkWriteDescriptor | null | undefined;
  stagedValueChunkWrite(categoryId?: string): Uint8Array | undefined;
}

/** Persist UPDATE predecessors are mutable value-chunks, not data-NFT twins. */
export function reassertPersistedJobEventsOneToOnes(
  host: PersistedJobEventsOneToOneHost,
  builder: TransactionBuilder,
  emitDest: number,
): void {
  // A compiler-owned delegate route assigns every physical output in its balanced block. Legacy
  // persistence recovery infers ownership from input shape and cached collection state, so it must
  // never rewrite those declared outputs. Any required predecessor or value-chunk recreation is
  // represented by the route's entry/chunk slots and handled by their ordinary materializers.
  if (host.compilerRouteDelegateBlock || host.preserveBlockLayoutWidth) return;
  const eventDestinations = new Set(emitDestinationIndices(host));
  if (emitDest >= 0) eventDestinations.add(emitDest);
  const destCategory = emitDest >= 0 && builder.outputs[emitDest]?.token?.category
    ? String(builder.outputs[emitDest]!.token!.category)
    : chunkableValueWriteCategory(host);
  const categoryId = destCategory ?? chunkableValueWriteCategory(host);
  const persistLockCategory = persistedValueChunkCategory(host) ?? categoryId;
  const persistLock = (persistLockCategory ? persistedCompatibilityValueChunkLock(persistLockCategory) : undefined)
    ?? host.valueChunkRedeemLock;
  const replayCategories = new Set([categoryId, persistLockCategory].filter(
    (candidate): candidate is string => candidate !== undefined,
  ));
  const persistDests = new Set(persistUpdatePredecessorDests({
    implIndex: chunkableValueWriteInputIndex(host),
    persistUpdate: isPersistedChunkableValueWriteReady(host)
      && !isInitialChunkableValueWrite(host),
    keepAtLayout: shouldKeepPersistAtLayoutBase({
      persistReady: isPersistedChunkableValueWriteReady(host),
      firstPublish: isInitialChunkableValueWrite(host),
      layoutDestOccupiedByMintingWriter: host.hasMintingBandTokenWriter(),
    }),
    bandStart: host.getChunkableValueWriteBand()?.start ?? -1,
    nNew: host.getChunkableValueWriteBand()?.nNew ?? 0,
  }));
  const persistRecipeLock = host.persistUpdateDigestLock(
    persistedValueChunkCategory(host) ?? categoryId,
  );
  for (const [index, input] of host.allInputs.entries()) {
    const commit = String(input?.token?.nft?.commitment ?? '');
    const persistShaped = commit.length >= 64 && !isDataNftIndexCommitment(commit);
    // Compiler event slots and mutable-input conservation are independent layout owners. Once an event slot is
    // materially populated, a late conservation pass cannot infer ownership from the same-index input and replace
    // it. Empty/zero/SCID placeholders remain available so persistence can still fill genuinely vacant slots.
    if (eventDestinations.has(index)
      && isMaterializedImmutableNftOutput(builder.outputs[index])) continue;
    if (index === emitDest && !persistShaped) continue;
    if (input?.token?.nft?.capability !== 'mutable') continue;
    const declaredOwner = host.declaredExternalOutputSlotOwner(index);
    // Physical input padding is not output ownership. A balanced participant can use a foreign mutable UTXO
    // as the funding/input occupant of a compiler-declared slot; the participant's layout and category still
    // own the corresponding output. Conservation passes must not replay that occupant across the boundary.
    if (declaredOwner) {
      if (!replayCategories.has(declaredOwner.categoryId)) continue;
      const declaredLock = declaredOwner.slot.kind === 'entry'
        ? externalEntryLockingBytecode(declaredOwner.group, declaredOwner.slot)
        : undefined;
      const inputLock = input.unlocker?.generateLockingBytecode();
      const inputOwnsSlot = declaredOwner.categoryId === input.token.category
        && (declaredLock === undefined || (inputLock !== undefined
          && declaredLock.length === inputLock.length
          && declaredLock.every((byte, offset) => byte === inputLock[offset])));
      if (!inputOwnsSlot) continue;
    }
    const liveBand = host.getChunkableValueWriteBand();
    // An UPDATE can deliberately place an old predecessor input at the same
    // coordinate as the new value's chunk 0. The predecessor still
    // authorizes the spend, but its one-to-one recreation must not replace
    // the newly authenticated chunk (whose root-addressed lock changed). The
    // live band is the layout authority; derivation caches can be cleared or
    // re-keyed by a later participant repair without vacating that band.
    if (liveBand && index >= liveBand.start && index <= liveBand.end) continue;
    const chunk0Dest = persistValueChunkBase(chunkableValueWriteInputIndex(host), 5);
    const forceChunk0 = index === chunk0Dest
      && !isInitialChunkableValueWrite(host)
      && isPersistValueChunkCommitment(commit);
    if ((persistRecipeLock && persistDests.has(index) && !isInitialChunkableValueWrite(host))
      || forceChunk0) {
      const existing = builder.outputs[index];
      if ((existing?.token?.nft?.capability === 'mutable'
        && (existing.token.category === input.token?.category
          || isPersistValueChunkCommitment(commit)))
        || forceChunk0) {
        const persistCat = persistedValueChunkCategory(host) ?? input.token?.category ?? categoryId;
        const persistValue = host.stagedValueChunkWrite(persistCat)
          ?? host.persistedValueChunkValue(persistCat);
        const destOffset = [...persistDests].sort((left, right) => left - right).indexOf(index);
        const inputLock = input.unlocker?.generateLockingBytecode();
        const publishCategory = chunkableValueWriteCategory(host);
        const inputCategory = input.token?.category ?? persistCat;
        const persistVLock = host.persistValueChunkLock(publishCategory, persistValue)
          ?? host.persistValueChunkLock(persistLockCategory, persistValue)
          ?? host.persistValueChunkLock(inputCategory, persistValue)
          ?? persistLock;
        const destLock = index === chunk0Dest
          ? (persistVLock ?? persistLock)
          : persistUpdateDestLock({
            destOffset,
            entryLock: persistRecipeLock,
            persistLock: persistVLock,
            inputLock: inputLock && inputLock.length === 35 && inputLock[0] === 0xaa
              ? inputLock : undefined,
          });
        const persistChunks = persistValue
          ? chunksFromValue(persistValue, {
            lockingBytecode: destLock ?? persistRecipeLock,
            write: host.persistedValueChunkWrite(persistCat),
            categoryId: persistCat,
          }) : [];
        // The entry carries the same authenticated chunkable-value header as every sorted mapping:
        // len4 || root32 || head28 for a long value. Continuations stay uint16-le value chunks.
        const persistChunk = destOffset === 0 && persistValue
          ? {
            commitment: binToHex(encodeEntryCommitment(
              keyToSlot(new Uint8Array()),
              new Uint8Array(32),
              encodeChunkableValueTail(persistValue),
            )),
          }
          : (destOffset > 0 ? persistChunks[destOffset - 1] : undefined);
        const existingLock = existing?.to instanceof Uint8Array ? existing.to : undefined;
        const nextCommit = persistChunk?.commitment ?? existing?.token?.nft?.commitment
          ?? input.token?.nft?.commitment;
        const nextLock = destLock ?? persistRecipeLock;
        if (nextLock && (!existingLock || binToHex(existingLock) !== binToHex(nextLock)
          || String(existing?.token?.nft?.commitment ?? '') !== String(nextCommit ?? ''))) {
          const baseToken = existing?.token ?? input.token;
          builder.outputs[index] = {
            to: nextLock,
            amount: existing?.amount ?? input.satoshis,
            token: persistChunk && baseToken
              ? {
                ...cloneToken(baseToken),
                nft: { capability: 'mutable', commitment: persistChunk.commitment },
              }
              : baseToken,
          };
        }

        continue;
      }
    }
    const sameCategory = !!categoryId && input.token?.category === categoryId;
    if (!sameCategory && !persistShaped) continue;
    const predecessor = host.pendingJobEventsPredecessors.find((candidate) =>
      candidate.txid === input.txid && candidate.vout === input.vout);
    const digestCategory = input.token?.category ?? categoryId;
    const persistedWrite = host.persistedValueChunkWrite(digestCategory);
    const digestLock = persistUpdateRedeemLock(
      digestCategory, host.valueChunkRedeemLock, persistedWrite,
      !hasChunkableValueWriteMetadata(host) && permitsLegacyNamedValueChunkFallbackForGroups(host),
    );
    const chunkIndex = valueChunkIndexFromCommitment(commit);
    // Only long persisted event chunks (created head / continuations).
    // Short data-NFT heads for other resources must keep their own lock.
    const isPersistValueChunk = chunkIndex !== undefined
      && commit.length >= 24
      && (sameCategory || persistShaped);
    const rematerialize = shouldRematerializePersistUpdateForHost(host);
    const stampDigest = shouldStampPersistUpdateDigestLockForHost(host);
    const band = host.getChunkableValueWriteBand();
    const inWriteBand = !!band && index >= band.start && index <= band.end;
    // INSERT / whitelist must not restamp persist `v` onto dest. UPDATE
    // dest-18 persist EQUALVERIFYs the Created-digest lock even when the
    // live band starts at dest 20.
    if (isPersistValueChunk && inWriteBand && !rematerialize && !stampDigest) continue;
    const recipeLock = stampDigest
      ? host.persistUpdateDigestLock(
        persistedValueChunkCategory(host) ?? input.token?.category ?? categoryId,
      )
      : persistRecipeLock;
    const lock = ((persistDests.has(index) && persistRecipeLock)
      || (isPersistValueChunk && ((rematerialize && digestLock) || recipeLock)))
      ? (persistRecipeLock ?? recipeLock ?? digestLock)
      : ((('unlocker' in input && input.unlocker)
        ? input.unlocker.generateLockingBytecode()
        : undefined)
        ?? predecessor?.unlocker?.generateLockingBytecode()
        ?? persistLock);
    if (!lock || lock.length !== 35 || lock[0] !== 0xaa) continue;
    const persistValue = isPersistValueChunk && rematerialize
      ? host.persistedValueChunkValue(input.token?.category ?? categoryId)
      : undefined;
    const persistChunk = persistValue && chunkIndex !== undefined
      ? chunksFromValue(persistValue, {
        lockingBytecode: lock,
        categoryId: input.token?.category,
      })[chunkIndex]
      : undefined;
    const token = persistChunk
      ? {
        ...cloneToken(input.token),
        nft: { capability: 'mutable' as const, commitment: persistChunk.commitment },
      }
      : cloneToken(input.token);
    const existing = builder.outputs[index];
    const existingLock = existing?.to instanceof Uint8Array ? existing.to : undefined;
    const missingTwin = !existing?.token
      || existing.token.category !== input.token?.category
      || existing.token.nft?.capability !== 'mutable';
    const lockChanged = existingLock !== undefined && binToHex(existingLock) !== binToHex(lock);
    const commitChanged = persistChunk !== undefined
      && String(existing?.token?.nft?.commitment ?? '') !== persistChunk.commitment;
    if (!missingTwin && !lockChanged && !commitChanged) continue;
    builder.outputs[index] = {
      to: lock,
      amount: input.satoshis,
      token,
    };
  }
}
