/**
 * phase-boundary extract: STB class-body extract — nested minting-master / surplus-entry strip /
 * same-index mutable INSERT reassert / fixed-state output reassert.
 * Free functions over NestedOutputReassertHost.
 */

import {
  buildPushdataCommitment,
  parsePushdataCommitment,
  type AbiFunction,
  type FunctionBlockLayout,
  type StateLayout,
  type StateValue,
} from '@solidcash/utils';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo } from '../interfaces.js';
import { groupChunkableValueWriteCollections } from './chunkable-value-write-selection.js';
import { stripSurplusEmptyCollectionEntries } from './collection-lock-strip.js';
import { stateUpdatesTouchNft } from './early-value-chunk-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { packTailReturnPlacements } from './physical-return-layout.js';
import { sameIndexScidIdentityInputIndices } from './same-index-scid.js';
import {
  placeInsertNewAt,
  placeSameIndexTwin,
} from './same-index-twin-emit.js';
import { placeMintingMasterPreservingTail } from './scid-minting-return-layout.js';
import {
  isDataNftIndexCommitment,
  isSortedEntryHeadCommitment,
  isSortedEntryNodeCommitment,
  SLOT_HEX,
  synthesizePredNewCommitment,
} from './sorted-entry-commitment.js';
import { cloneToken, outputMatchesLock } from './stb-output-utils.js';
import { selectProtectedLoopEntryCollections } from './value-chunk-base-writer-select.js';
import { skipCompilerOwnedInBlockCollectionStrip } from './writer-event-delegate-layout.js';

export type NestedReassertLoopEntryVar = {
  collection: string;
  lockingBytecode: Uint8Array;
  categoryId?: string;
  delegate?: boolean;
  chunkable?: boolean;
};

export type NestedReassertPendingReturnEvent = {
  categoryId: string;
  commitment: Uint8Array;
  identity: string;
  provisional?: boolean;
};

export interface NestedOutputReassertHost {
  readonly allInputs: readonly UnlockableUtxo[];
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly externalOutStateUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
  readonly delegateDynamicChunksAtSuffix: boolean;
  readonly mintingOutputSwap?: { from: number; width: number; categoryId: string };
  readonly pendingReturnEventOutputs: readonly NestedReassertPendingReturnEvent[];
  readonly preserveBlockLayoutWidth: boolean;
  readonly pinnedEntrySlots: ReadonlySet<number>;
  /** The executing frame's own block layout. */
  readonly blockLayout?: FunctionBlockLayout;
  readonly requiredEntryOutputSlots: ReadonlySet<number>;
  readonly loopEntryVars: readonly NestedReassertLoopEntryVar[];
  readonly stateLayout: StateLayout;
  readonly categoryId: string;
  readonly dataNftUtxos: readonly UnlockableUtxo[];
  readonly requiredNftIndices: readonly number[];
  readonly stateRawCommitments: ReadonlyMap<number, string>;
  readonly stateUpdates: ReadonlyMap<string, StateValue>;
  /**
   * The executing handler's own state is frozen by the covenant on this call: its only delegate edges are
   * conditional and every published guard evaluates false. The requested root-state updates are then
   * unauthorized and the fixed-state reassert must keep the input commitments.
   */
  readonly preserveOwnState?: boolean;
  readonly externalCallStateRawCommitments: ReadonlyMap<string, ReadonlyMap<number, string>>;
  readonly externalCallStateUpdates: ReadonlyMap<string, ReadonlyMap<string, StateValue>>;
  readonly builderOptions: {
    provider: { consensusLimits?: { maximumNftCommitmentBytes?: number } };
  };
  dynamicChunkOutputCount(): number;
  findMintingInputIndex(categoryId: string): number;
  getExternalCallMasterInputIndex(index: number): number;
  getLowLevelCallMasterInputIndex(index: number): number;
  getRequiredLoopEntryCount(collection: string): number;
  getLoopEntryCommitments(collection: string): readonly string[];
}

/**
 * Routed proxy groups emit an OP_TRUE spacer at their sequential slot. The
 * minting UTXO must still be recreated at INPUTINDEX. Insert it there and drop
 * one later P2PKH/OP_TRUE pad so view tails and the value-chunk suffix do not move.
 */
export function reassertNestedMintingMasters(
  host: NestedOutputReassertHost,
  builder: TransactionBuilder,
): void {
  const suffixChunkCount = host.delegateDynamicChunksAtSuffix ? host.dynamicChunkOutputCount() : 0;
  const suffixStart = builder.outputs.length - suffixChunkCount - (suffixChunkCount > 0 ? 1 : 0);
  const tailStart = host.pendingReturnEventOutputs.length > 0
    ? Math.min(
      ...[...packTailReturnPlacements(
        host.externalCallUtxoGroups,
        (categoryId) => host.findMintingInputIndex(categoryId),
        host.pendingReturnEventOutputs,
        host.mintingOutputSwap?.categoryId ?? '',
        -1,
        { reservedIndices: sameIndexScidIdentityInputIndices(host.allInputs) },
      ).values()],
      Number.POSITIVE_INFINITY,
    )
    : suffixStart;
  const seen = new Set<string>();
  for (const group of host.externalCallUtxoGroups) {
    if (group.sharedGroupIndex !== undefined || !group.categoryId || seen.has(group.categoryId)) continue;
    seen.add(group.categoryId);
    const master = host.findMintingInputIndex(group.categoryId);
    if (master < 0) continue;
    const mintingInput = host.allInputs[master];
    if (!mintingInput?.token || mintingInput.token.nft?.capability !== 'minting') continue;
    if (!('unlocker' in mintingInput) || !mintingInput.unlocker) continue;
    const blockWidth = 1 + (group.dataNftUtxos?.length
      ?? group.requiredDataNftIndices?.length ?? 0);
    const minting = {
      to: mintingInput.unlocker.generateLockingBytecode(),
      amount: mintingInput.satoshis,
      token: cloneToken(mintingInput.token),
    };
    placeMintingMasterPreservingTail(builder.outputs, master, minting, {
      blockWidth,
      tailStart: Number.isFinite(tailStart) ? tailStart : suffixStart,
      suffixStart,
    });
  }
}

export function stripSurplusEmptyCollectionEntriesForHost(
  host: NestedOutputReassertHost,
  builder: TransactionBuilder,
): void {
  // A compiler-owned balanced block already placed every in-block vmap node at a layout offset. The
  // leftover-HEAD strip is for 1:1 P'+NEW inserts; applying it here converts the other seeded keys to
  // OP_TRUE and fails the batch EQUALVERIFY.
  if (skipCompilerOwnedInBlockCollectionStrip({
    preserveBlockLayoutWidth: host.preserveBlockLayoutWidth,
    pinnedEntryCount: host.pinnedEntrySlots.size,
    requiredEntryCount: host.requiredEntryOutputSlots.size,
  })) return;
  const activeGroups = [
    ...host.externalCallUtxoGroups,
    ...host.lowLevelCallUtxoGroups,
  ];
  // A direct fixed sorted batch owns a target at its declared entry slot plus a trailing predecessor. Its
  // trailing count alone is not the collection's complete output width. Runtime upsert loops have no fixed
  // entry slot, so their existing surplus/fail-closed handling must continue to run.
  if (activeGroups.length === 0 && host.blockLayout?.slots.some((slot) => slot.kind === 'entry')) return;
  const groupCollections = activeGroups.map(groupChunkableValueWriteCollections);
  if (groupCollections.some((collections) => collections.length > 1)) return;
  const selectedCollections = new Set(groupCollections.flat());
  for (const variable of host.loopEntryVars) {
    const collection = host.stateLayout.collections?.find((candidate) => (
      candidate.name === variable.collection || candidate.signature === variable.collection
    ));
    if (variable.chunkable === true && collection?.chunkableValue === true
      && collection.valueType.endsWith('[]')) selectedCollections.add(collection.name);
  }
  // Several active chunkable array writers can own different locks and widths. Until each run is tied to its
  // compiler-published collection identity, selecting among them would be heuristic.
  if (selectedCollections.size !== 1) return;
  const [selectedCollection] = selectedCollections;
  const selectedLayoutCollection = host.stateLayout.collections?.find((candidate) => (
    candidate.name === selectedCollection || candidate.signature === selectedCollection
  ));
  const plannedByLock = new Map<string, { lock: Uint8Array; planned: number }>();
  const remember = (lock: Uint8Array, planned: number): void => {
    if (lock.length === 0 || planned <= 0) return;
    const key = binToHex(lock);
    const existing = plannedByLock.get(key);
    plannedByLock.set(key, { lock, planned: Math.max(existing?.planned ?? 0, planned) });
  };
  for (const variable of host.loopEntryVars) {
    if (variable.collection !== selectedCollection
      && variable.collection !== selectedLayoutCollection?.signature) continue;
    const required = host.getRequiredLoopEntryCount(variable.collection);
    const materialized = host.getLoopEntryCommitments(variable.collection).length;
    // Both counts are compiler/planner-owned. With neither, the exact physical width is unknown and this
    // cleanup must leave every output untouched.
    remember(variable.lockingBytecode, required > 0 ? required : materialized);
  }
  // A direct frame's own entry slots sit at their block offsets, where its covenant verifies each node (a batch
  // insert's new node included). They are not lanes of the planned width, so they neither count against it nor
  // read as leftovers; counting them strips the trailing predecessor, a relinked head that looks empty.
  const fixedIndices = new Set<number>();
  const master = host.findMintingInputIndex(host.categoryId);
  if (activeGroups.length === 0 && host.messageBusConvention === undefined && master >= 0) {
    for (const slot of host.blockLayout?.slots ?? []) {
      if (slot.kind === 'entry') fixedIndices.add(master + slot.offset);
    }
  }
  for (const { lock, planned } of plannedByLock.values()) {
    stripSurplusEmptyCollectionEntries(builder.outputs, lock, planned, fixedIndices);
  }
}

/** True when the callee settles this planned insert through its sorted batch transition. */
function settlesInsertAsBatch(group: ExternalCallUtxoGroup, slotIndex: number | undefined): boolean {
  const abi = group.compilerRoute?.abiFunction
    ?? (group.externalContract?.inner?.artifact?.abi as readonly AbiFunction[] | undefined)
      ?.find((candidate) => candidate.name === group.functionName);
  return abi?.sortedBatchInfo?.some((batch) => slotIndex === undefined || batch.slotIndices.includes(slotIndex))
    ?? false;
}

export function reassertNestedSameIndexMutables(
  host: NestedOutputReassertHost,
  builder: TransactionBuilder,
): void {
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1') {
    for (const [groupIndex, group] of host.externalCallUtxoGroups.entries()) {
      if (!group.plannedEntryInserts?.length) continue;
      console.error('planned-entry-inserts', JSON.stringify({
        groupIndex,
        functionName: group.functionName ?? group.logicalFunctionName,
        categoryId: group.categoryId?.slice(0, 8),
        master: host.getExternalCallMasterInputIndex(groupIndex),
        inserts: group.plannedEntryInserts.map((insert) => ({
          blockSlot: insert.blockSlot,
          outputBlockSlot: insert.outputBlockSlot,
          commitment: insert.commitment?.slice(0, 16),
          newCommitment: insert.newCommitment?.slice(0, 16),
        })),
      }));
    }
  }
  // A compiler-owned linear batch already placed every in-block node. The P'+NEW leftover-HEAD wipe
  // (plannedCount 2) would keep only the proof and trailing P' and convert the other keys to OP_TRUE.
  if (skipCompilerOwnedInBlockCollectionStrip({
    preserveBlockLayoutWidth: host.preserveBlockLayoutWidth,
    pinnedEntryCount: host.pinnedEntrySlots.size,
    requiredEntryCount: host.requiredEntryOutputSlots.size,
  })) return;
  const plannedInsertByPredecessor = new Map<number, {
    outputIndex: number; commitment?: string; newCommitment?: string;
  }>();
  const isCompilerOwnedBatchInsert = (
    group: ExternalCallUtxoGroup,
    insert: NonNullable<ExternalCallUtxoGroup['plannedEntryInserts']>[number],
  ): boolean => {
    if (insert.slotIndex === undefined) return false;
    const predOut = `__internal__vmapBatchPredOut_${insert.slotIndex}`;
    const proof = `__internal__vmapBatchProof_${insert.slotIndex}`;
    const slot = `__internal__vmapBatchSlot_${insert.slotIndex}`;
    const args = { ...group.compilerRoute?.internalArgs, ...group.internalArgs };
    // The shared-proof follower has PredOut=-1 and therefore no relative output
    // argument, but its NEW still belongs to the compiler's fixed batch slot.
    return group.relativeOutputInternalArgs?.includes(predOut) === true
      || (proof in args && slot in args && predOut in args);
  };
  for (const [groupIndex, group] of host.externalCallUtxoGroups.entries()) {
    if (group.sharedGroupIndex !== undefined) continue;
    const base = host.getExternalCallMasterInputIndex(groupIndex);
    for (const insert of group.plannedEntryInserts ?? []) {
      // A callee that settles the write as a sorted batch keeps the new node at its entry slot and the relinked
      // predecessor at the planned trailing coordinate (outputBlockSlot), where materialization placed both. The
      // twin below is the scalar layout, the predecessor recreated in place, and here would lose the relinked
      // predecessor. The callee's ABI or the compiler's fixed batch-slot witnesses identify such an insert.
      if (settlesInsertAsBatch(group, insert.slotIndex) || isCompilerOwnedBatchInsert(group, insert)) continue;
      plannedInsertByPredecessor.set(base + insert.blockSlot, {
        outputIndex: base + insert.outputBlockSlot,
        commitment: insert.commitment,
        newCommitment: insert.newCommitment,
      });
    }
  }
  for (const [groupIndex, group] of host.lowLevelCallUtxoGroups.entries()) {
    const base = host.getLowLevelCallMasterInputIndex(groupIndex);
    for (const insert of group.plannedEntryInserts ?? []) {
      if (isCompilerOwnedBatchInsert(group, insert)) continue;
      plannedInsertByPredecessor.set(base + insert.blockSlot, {
        outputIndex: base + insert.outputBlockSlot,
        commitment: insert.commitment,
        newCommitment: insert.newCommitment,
      });
    }
  }
  const nestedCategories = new Set(
    [
      ...host.externalCallUtxoGroups.map((group) => group.categoryId),
      ...host.lowLevelCallUtxoGroups.map((group) => group.categoryId),
    ].filter((id): id is string => !!id),
  );
  const suffixChunkCount = host.delegateDynamicChunksAtSuffix ? host.dynamicChunkOutputCount() : 0;
  const suffixStart = builder.outputs.length - suffixChunkCount - (suffixChunkCount > 0 ? 1 : 0);
  const tailStart = host.pendingReturnEventOutputs.length > 0
    ? Math.min(
      ...[...packTailReturnPlacements(
        host.externalCallUtxoGroups,
        (categoryId) => host.findMintingInputIndex(categoryId),
        host.pendingReturnEventOutputs,
        host.mintingOutputSwap?.categoryId ?? '',
        -1,
        { reservedIndices: sameIndexScidIdentityInputIndices(host.allInputs) },
      ).values()],
      Number.POSITIVE_INFINITY,
    )
    : suffixStart;
  const protectedCollections = selectProtectedLoopEntryCollections([
    ...host.externalCallUtxoGroups,
    ...host.lowLevelCallUtxoGroups,
  ], host.messageBusConvention);
  const protectedNames = new Set(protectedCollections.collections);
  for (let index = 0; index < host.allInputs.length; index++) {
    const plannedInsert = plannedInsertByPredecessor.get(index);
    if (!plannedInsert) continue;
    const input = host.allInputs[index];
    const category = input.token?.category;
    if (!category || input.token?.nft?.capability !== 'mutable' || !nestedCategories.has(category)) {
      continue;
    }
    if (!('unlocker' in input) || !input.unlocker) continue;
    const twinLock = input.unlocker.generateLockingBytecode();
    const commitHex = (value: Uint8Array | string | undefined): string => {
      if (value instanceof Uint8Array) return binToHex(value);
      return value ?? '';
    };
    const inputCommit = commitHex(input.token?.nft?.commitment as Uint8Array | string | undefined);
    if (isDataNftIndexCommitment(inputCommit)) continue;
    if (!isSortedEntryHeadCommitment(inputCommit)) continue;
    let predNewIndex = -1;
    let newSlot = '';
    for (let later = index + 1; later < builder.outputs.length; later++) {
      const output = builder.outputs[later];
      const lock = output.to instanceof Uint8Array ? output.to : undefined;
      if (!lock || lock.length !== twinLock.length) continue;
      if (!lock.every((byte, offset) => byte === twinLock[offset])) continue;
      if (output.token?.category !== category || output.token?.nft?.capability !== 'mutable') continue;
      const commit = commitHex(output.token.nft?.commitment as Uint8Array | string | undefined);
      if (commit === '' || commit === inputCommit) continue;
      const slot = (inputCommit.padEnd(SLOT_HEX, '0').slice(0, SLOT_HEX) || '0'.repeat(SLOT_HEX)).toLowerCase();
      if (commit.toLowerCase().startsWith(slot) && commit.length > SLOT_HEX) {
        predNewIndex = later;
        newSlot = commit.slice(SLOT_HEX, SLOT_HEX * 2);
        break;
      }
      if (newSlot === '' && isSortedEntryNodeCommitment(commit)) {
        newSlot = commit.slice(0, SLOT_HEX);
      }
    }
    const twinToken = cloneToken(input.token);
    if (twinToken.nft && newSlot) {
      // Predecessor co-spend output is P' = pred.slot||Hk||pred.value.
      // NEW = Hk||pred.next||value lands at outputBlockSlot (reservedNew).
      const currentPred = builder.outputs[index];
      const currentPredCommitment = commitHex(
        currentPred?.token?.nft?.commitment as Uint8Array | string | undefined,
      );
      const plannedPred = plannedInsert.commitment
        ?? synthesizePredNewCommitment(inputCommit, plannedInsert.newCommitment ?? newSlot);
      const plannedPredSlot = plannedPred.slice(0, SLOT_HEX);
      const currentIsMaterializedPred = currentPred?.token?.category === category
        && currentPred.token.nft?.capability === 'mutable'
        && currentPredCommitment.toLowerCase().startsWith(plannedPredSlot.toLowerCase())
        && currentPredCommitment.length > SLOT_HEX
        && currentPredCommitment.slice(SLOT_HEX, SLOT_HEX * 2).toLowerCase() === newSlot.toLowerCase();
      twinToken.nft = {
        ...twinToken.nft,
        commitment: currentIsMaterializedPred ? currentPredCommitment : plannedPred,
      };
    }
    const existing = builder.outputs[index];
    const existingLock = existing?.to instanceof Uint8Array ? existing.to : undefined;
    const sameLockMutable = !!existingLock
      && existingLock.length === twinLock.length
      && existingLock.every((byte, offset) => byte === twinLock[offset])
      && existing?.token?.nft?.capability === 'mutable'
      && existing.token.category === category;
    // Without a NEW slot there is no P' to apply. Leave a derived same-lock
    // occupant alone; only displace events/pads onto the input index.
    if (!newSlot && sameLockMutable) continue;
    const twin = {
      to: twinLock,
      amount: input.satoshis,
      token: twinToken,
    };
    const skipLocks: Uint8Array[] = [];
    for (const variable of host.loopEntryVars) {
      const protectedByMetadata = protectedCollections.status === 'ambiguous'
        || protectedNames.has(variable.collection);
      if (protectedByMetadata && variable.lockingBytecode.length > 0) {
        skipLocks.push(variable.lockingBytecode);
      }
    }
    for (const output of builder.outputs) {
      const lock = output.to instanceof Uint8Array ? output.to : undefined;
      if (!lock || lock.length !== 35 || lock[0] !== 0xaa) continue;
      if (output.token?.nft?.capability !== 'mutable') continue;
      const raw = output.token.nft?.commitment as Uint8Array | string | undefined;
      const hex = raw instanceof Uint8Array ? binToHex(raw) : (raw ?? '');
      if (hex.toLowerCase().includes('437265617465') || hex.toLowerCase().includes('57686974656c697374')) {
        skipLocks.push(lock);
      }
    }
    // NEW must not land on the co-spent predecessor index (that slot is P').
    let reservedNew = plannedInsert.outputIndex;
    if (reservedNew === index) {
      reservedNew = index + 2;
      while (reservedNew < builder.outputs.length
        && builder.outputs[reservedNew]?.token?.nft?.capability === 'minting') {
        reservedNew += 1;
      }
    }
    const twinOptions = {
      tailStart: Number.isFinite(tailStart) ? tailStart : suffixStart,
      suffixStart,
      reservedIndexes: [reservedNew],
      skipLocks,
    };
    if (!placeSameIndexTwin(builder.outputs, index, twin, twinOptions)) continue;
    if (newSlot) {
      placeInsertNewAt(builder.outputs, reservedNew, {
        to: twinLock,
        amount: 1200n,
        token: {
          amount: 0n,
          category,
          nft: {
            capability: 'mutable',
            commitment: plannedInsert.newCommitment
              ?? `${newSlot}${'00'.repeat(SLOT_HEX / 2)}`,
          },
        },
      }, twinOptions);
    }
    if (predNewIndex >= 0 && predNewIndex !== index && predNewIndex !== reservedNew) {
      builder.outputs[predNewIndex] = { to: Uint8Array.of(0x51), amount: 1000n };
    }
    // INSERT is P'+NEW. A leftover empty HEAD clone at an earlier index
    // makes emitVerifyChunkUtxoCount see 3 vs expected 2.
    stripSurplusEmptyCollectionEntries(builder.outputs, twinLock, 2);
    for (let earlier = 0; earlier < index; earlier++) {
      const leftover = builder.outputs[earlier];
      if (!outputMatchesLock(leftover, twinLock)) continue;
      if (leftover.token?.nft?.capability !== 'mutable') continue;
      const leftoverCommit = commitHex(leftover.token.nft?.commitment as Uint8Array | string | undefined);
      if (!isSortedEntryHeadCommitment(leftoverCommit) && leftoverCommit.replace(/^0+/, '') !== '') {
        continue;
      }
      builder.outputs[earlier] = { to: Uint8Array.of(0x51), amount: 1000n };
    }
  }
}

/**
 * Recreate every participant's fixed data-NFT state at the coordinate authenticated by its input outpoint.
 * Later entry/event/tail materializers can temporarily occupy those coordinates, but fixed state retains
 * structural ownership. Derive commitments from the owner's layout and updates; commitment bytes are opaque
 * state, so neither ownership nor preservation may depend on application-specific prefixes.
 */
export function reassertFixedStateOutputs(
  host: NestedOutputReassertHost,
  builder: TransactionBuilder,
): void {
  type FixedStateOwner = {
    categoryId: string;
    stateLayout: StateLayout;
    dataNftUtxos: readonly UnlockableUtxo[];
    requiredDataNftIndices: readonly number[];
    rawCommitments: ReadonlyMap<number, string>;
    updates?: ReadonlyMap<string, StateValue>;
    preserveUntouched: boolean;
  };
  const groupOwner = (group: ExternalCallUtxoGroup): FixedStateOwner => ({
    categoryId: group.categoryId,
    stateLayout: group.stateLayout,
    dataNftUtxos: group.dataNftUtxos,
    requiredDataNftIndices: group.requiredDataNftIndices,
    rawCommitments: host.externalCallStateRawCommitments.get(group.categoryId) ?? new Map(),
    updates: host.externalCallStateUpdates.get(group.categoryId),
    // Static/delegate implementation state is not written by the logical call; preserving its exact bytes is
    // both cheaper and avoids rebuilding compiler-owned registers which are intentionally absent from the ABI.
    preserveUntouched: true,
  });
  const owners: FixedStateOwner[] = [{
    categoryId: host.categoryId,
    stateLayout: host.stateLayout,
    dataNftUtxos: host.dataNftUtxos,
    requiredDataNftIndices: host.requiredNftIndices,
    rawCommitments: host.stateRawCommitments,
    updates: host.preserveOwnState === true ? new Map() : host.stateUpdates,
    // Mirror build(): the active participant's complete state is rebuilt after applying direct updates.
    preserveUntouched: false,
  }];
  owners.push(...host.externalOutStateUtxoGroups.map(groupOwner));
  owners.push(...host.externalCallUtxoGroups
    .filter((group) => group.sharedGroupIndex === undefined)
    .map(groupOwner));
  owners.push(...host.lowLevelCallUtxoGroups.map(groupOwner));

  const seenOutpoints = new Set<string>();
  for (const owner of owners) {
    const currentState: Record<string, StateValue> = {};
    for (const [ordinal, nftIndex] of owner.requiredDataNftIndices.entries()) {
      const commitment = owner.dataNftUtxos[ordinal]?.token?.nft?.commitment;
      if (!commitment) continue;
      Object.assign(currentState, parsePushdataCommitment(commitment, owner.stateLayout, nftIndex));
    }
    for (const [name, value] of owner.updates ?? []) currentState[name] = value;
    for (const [ordinal, nftUtxo] of owner.dataNftUtxos.entries()) {
      const outpoint = `${nftUtxo.txid.toLowerCase()}:${nftUtxo.vout}`;
      if (seenOutpoints.has(outpoint)) continue;
      seenOutpoints.add(outpoint);
      const inputIndex = host.allInputs.findIndex((input) => (
        input.txid.toLowerCase() === nftUtxo.txid.toLowerCase() && input.vout === nftUtxo.vout
      ));
      if (inputIndex < 0) continue;
      const input = host.allInputs[inputIndex];
      if (!('unlocker' in input) || !input.unlocker || !input.token?.nft) continue;
      const nftIndex = owner.requiredDataNftIndices[ordinal];
      if (nftIndex === undefined) continue;
      const inputCommitment = input.token.nft.commitment;
      const hasUpdate = stateUpdatesTouchNft(owner.stateLayout, owner.updates, nftIndex);
      const exactCommitment = hasUpdate ? undefined : owner.rawCommitments.get(nftIndex);
      const commitment = exactCommitment
        ?? (owner.preserveUntouched && !hasUpdate && inputCommitment
          ? inputCommitment
          : buildPushdataCommitment(
            owner.stateLayout,
            currentState,
            nftIndex,
            host.builderOptions.provider.consensusLimits?.maximumNftCommitmentBytes,
          ));
      builder.outputs[inputIndex] = {
        to: input.unlocker.generateLockingBytecode(),
        amount: input.satoshis,
        token: {
          amount: input.token.amount ?? 0n,
          category: owner.categoryId,
          nft: { capability: input.token.nft.capability, commitment },
        },
      };
    }
  }
}
