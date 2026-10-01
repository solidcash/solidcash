import { binToHex, bigIntToVmNumber, hexToBin, utf8ToBin, vmNumberToBigInt } from '@bitauth/libauth';
import {
  sha256 as sha256Sync, VALUE_HEAD_SIZE, VALUE_CHUNK_SIZE, VALUE_CHUNK_MAX_COUNT,
  type Artifact, type EntryAccessAbi,
} from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  adaptLegacyNestedJobEventArguments,
  vmapBatchWitnessFallback,
} from '../../src/stateful/StatefulContract.js';
import { encodeEntryCommitment } from '../../src/stateful/SortedList.js';
import {
  assignPhysicalReturnIndices,
  assignedTailEnd,
  returnWitnessOutputIndices,
  selectMaterializedTailReturnEvents,
  lastCollidingMutableWriterIndex,
  findViewTailDestinations,
  valueChunkBandWidth,
  continuationOutputBaseBeforeSuffix,
  selectValueChunkOutputBase,
  selectExternalEventProbeInput,
  hasMaterializedLowLevelCallBlock,
  materializedLowLevelCallBlockAtMaster,
  repairMaterializedLowLevelCallBlocks,
  findDisposableValueChunkOutputBase,
  mintingSwapShift,
  chooseMintingSwapShift,
  isEmptyValueChunkCommitment,
  predOutBaseAfterOccupancy,
  materializedPredOutBase,
  matchMaterializedReturnOutputs,
  collidingParticipantGroupIndex,
  physicalParticipantWidth,
  materializedParticipantWidth,
  participantSpanOverlapsLane,
  gatherContiguousPlainFunders,
  groupLayoutBlockSize,
  groupLayoutTrailingBase,
  selectDelegateExecutionLayout,
  physicalDelegateSlotOffset,
  pinExactSortedBatchEntry,
  skipCompilerOwnedInBlockCollectionStrip,
  groupOwnsLinearSortedBatch,
  assignBalancedOutputAtOffset,
  blockOutputOwnsSlotKind,
  blockOutputOwnsFixedDataNft,
  fixedDataNftOwnerInParticipantBlocks,
  groupOwnsInBlockReturnEvent,
  constrainOwnCategoryImmutableOutputs,
  inheritWriterBatchWitnesses,
  inheritWriterBatchPlan,
  isPredOutReusableHole,
  reassertBatchPredecessorOutputsAtDeclaredSlots,
  remapInsertPredOuts,
  resolveAbsolutePredOut,
  syncDeclaredBatchPredOutWitnesses,
  stripSurplusInvalidCollectionLockOutputs,
  stripInvalidCollectionLockOutputs,
  selectBalancedEntryOutputIdentity,
  isOutsideTokenWriterBlock,
  logicalReturnGroupIndex,
  packTailReturnPlacements,
  shouldDisplaceForNestedEvent,
  isOverwritableEmitOccupant,
  chunkableWriterEventOutputIndex,
  publishJobEventOutputIndex,
  placeChunkableWriterEventOutput,
  placePublishJobEventOutput,
  isJobEventEmitCommitment,
  isLearnedEventEmitCommitment,
  isCreatedJobEventCommitment,
  relocateJobEventEmitToDest,
  relocateDelegateEventNftToDest,
  isDelegateEventNftOutput,
  isMaterializedImmutableNftOutput,
  resolveNamedEventValues,
  emitDestCollidesPreservedInput,
  encodeEmptyJobEventEmitCommitment,
  encodeJobEventEmitCommitment,
  stampEmptyJobEventTimestamp,
  jobEventTypeOf,
  shouldRetainMintingOutputSwap,
  isMintingBandTokenWriter,
  isMintingBandSwapFunction,
  shouldRestorePersistedContinuationInputs,
  tokenWriterReturnIndex,
  canonicalWriterReturnCommitment,
  shouldReplaceReturnEventCommitment,
  hasEquivalentMutableNftOutput,
  stripRelocatedMutableDuplicates,
  reassertReadOnlyMutableOneToOnes,
  tokenWriterOccupiedDests,
  persistAndTokenWriterOccupancy,
  participantRelocationExtraFunders,
  chooseParticipantRelocationShift,
  proxyValueChunkPadCount,
  liveChunkSlotsByOwner,
  liveChunkWidthForGroup,
  legacyComputePublishValueChunkBand,
  scaledInputPreserveExclusiveEnd,
  scaledEventOutputIndex,
  selectValueChunkRedeemLock,
  legacyLiveValueChunkBandWidth,
  selectObservedValueChunkRun,
  legacyPersistedValueChunkWidth,
  selectHashedValueForChunkPin,
  chunksFromJobEventsValue,
  p2sh32LockFromValueRoot,
  applyRedeemLockToChunks,
  preferChunkCommitment,
  expectedFromOtcEqualVerify,
  viewTailOccupancyCap,
  clampViewTailPlacement,
  placeValueChunksOnBand,
  legacyFillValueChunkBandHoles,
  writerBlockOccupancyEnd,
  relocateChangeAfterOccupancy,
  packJobsAgainstOpReturn,
  moveLateOutputsBeforeReverseSuffix,
  valueChunkIndexFromCommitment,
  isPersistValueChunkCommitment,
  persistValueChunkBase,
  shouldKeepPersistAtLayoutBase,
  persistPredecessorPlaceCount,
  persistUpdatePredecessorDests,
  persistOccupantDisplaceable,
  persistPredecessorRank,
  persistPredecessorWantedRank,
  orderPersistPredecessorCandidates,
  assignPersistPredecessors,
  syncBuilderInputsFromAllInputs,
  boundedDerivationIterations,
  shouldGrowSpeculativeChunkRegion,
  seedChunksFromPersistedValue,
  legacyIsPersistedValueChunkReady,
  isOverwritableValueChunkOccupant,
  isDisposableAlignmentPad,
  placeMintingMasterPreservingTail,
  shouldInsertMintingMaster,
  stripSurplusMintingOutputs,
  reassertTokenInsertNewLock,
  reassertTokenInsertCommitments,
  reassertDescribedEntryInsertLocks,
  entryInsertLockRepairs,
  linearSortedBatchEntryBands,
  linearSortedBatchPlannedLockCounts,
  linearSortedBatchValueArgument,
  reorderLinearBatchProofSuccessor,
  stripSurplusEmptyCollectionEntries,
  stripSurplusValueChunkLocks,
  reassertScidIdentityOutputs,
  selectExpectedP2sh32OutputLock,
  persistUpdateRedeemLock,
  persistUpdateDigestLock,
  legacyJobEventsPersistUpdateDigestLock,
  legacyJobEventsPersistValueChunkLock,
  persistUpdateDestLock,
  persistValueChunkLock,
  isWithdrawShapedJobEvent,
  isInsertShapedJobEvent,
  shouldRematerializePersistUpdate,
  shouldStampPersistUpdateDigestLock,
  shouldUseLegacyPersistDigestLockForValueChunks,
  legacyRememberValueChunkLock,
  legacyRememberValueChunkValue,
  rememberValueChunkUnlockRecipe,
  legacyPersistedValueChunkLock,
  persistedValueChunkWriteState,
  selectPersistedValueChunkWrite,
  selectValueChunkWriteCategory,
  isInitialValueChunkWrite,
  persistedValueChunkReadiness,
  shouldRematerializeDescribedValueChunkWrite,
  resolveValueChunkWriteCategory,
  selectCompilerWriterEvent,
  selectTokenBandRepairOwner,
  selectProtectedLoopEntryCollections,
  isCompilerDescribedMintingBandWriter,
  StatefulTransactionBuilder,
  groupChunkableValueWriteCollection,
  claimedChunkableValueWriteCollection,
  groupWritesSingleChunkableValueCollection,
  groupChunkableArrayWriteCollection,
  groupWritesSingleChunkableArrayCollection,
  selectChunkableValueWriteExecution,
  valueChunkWriteResourceIdentity,
  legacyPlannedChunkableValueWriteCollection,
  permitsLegacyNamedValueChunkFallback,
  permitsLegacyValueChunkEventReconstruction,
  permitsLegacyDelegateEventRepair,
  placeSameIndexTwin,
  placeInsertNewAt,
  shouldOverwriteForSameIndexTwin,
  synthesizePredNewCommitment,
  entryCommitmentLacksValue,
  resolveRestoredBalancesEntryCommitment,
  isSortedEntryHeadCommitment,
  isSortedEntryNodeCommitment,
  isDataNftIndexCommitment,
  type PhysicalReturnGroup,
} from '../../src/stateful/StatefulTransactionBuilder.js';
import { getValueChunkLockingBytecode } from '../../src/stateful/covenant-helpers.js';
import {
  describeValueChunkWrites, resolveChunkableEntryCollection,
} from '../../src/stateful/StatefulContract.js';

describe('delegate-only physical slot projection', () => {
  const layout = {
    blockSize: 3,
    slots: [
      { kind: 'master' as const, offset: 0 },
      { kind: 'dataNft' as const, offset: 1 },
      { kind: 'event' as const, offset: 2 },
    ],
  };

  it('removes proxy-resident data slots only for delegate-only execution', () => {
    expect(physicalDelegateSlotOffset(layout, 2, true)).toBe(1);
    expect(physicalDelegateSlotOffset(layout, 2, false)).toBe(2);
  });
});

describe('external event probe input', () => {
  it('uses delegate geometry across alpha-renaming and ignores a decoy legacy name', () => {
    const renamedDelegate = { functionName: 'recordNotice', delegateCallGroupIndex: 3 };
    const legacyNamedOrdinary = { functionName: 'publishJobEvent' };

    expect(selectExternalEventProbeInput(renamedDelegate, 17, 9)).toBe(17);
    expect(selectExternalEventProbeInput(legacyNamedOrdinary, -1, 9)).toBe(9);
  });
});

describe('materialized low-level-call block identity', () => {
  const makeGroup = (functionName: string, txid: string, vout = 0) => ({
    categoryId: 'ab'.repeat(32),
    functionName,
    masterUtxo: { txid, vout },
    blockInputs: [
      { txid, vout },
      { txid: `${txid.slice(0, -2)}01`, vout: 1 },
      { txid: `${txid.slice(0, -2)}02`, vout: 2 },
    ],
    blockLayout: {
      blockSize: 3,
      slots: [
        { kind: 'master', offset: 0 },
        { kind: 'entry', offset: 1, slotIndex: 0 },
        { kind: 'event', offset: 2, slotIndex: 0 },
      ],
    },
  }) as unknown as import('../../src/stateful/StatefulTransactionBuilder.js').ExternalCallUtxoGroup;

  it('selects contiguous block repair by layout and master outpoint across alpha-renaming', () => {
    const historicalName = makeGroup('publishJobEvent', 'aa'.repeat(32));
    const renamed = makeGroup('appendNotice', 'bb'.repeat(32), 4);
    expect(hasMaterializedLowLevelCallBlock(historicalName)).toBe(true);
    expect(hasMaterializedLowLevelCallBlock(renamed)).toBe(true);
    expect(materializedLowLevelCallBlockAtMaster(
      [historicalName, renamed], { txid: 'BB'.repeat(32), vout: 4 },
    )).toBe(renamed);
  });

  it('does not grant layout authority from a historical function name or ambiguous outpoint', () => {
    const nameOnly = {
      ...makeGroup('publishJobEvent', 'cc'.repeat(32)), blockInputs: undefined,
    } as unknown as import('../../src/stateful/StatefulTransactionBuilder.js').ExternalCallUtxoGroup;
    expect(hasMaterializedLowLevelCallBlock(nameOnly)).toBe(false);
    const first = makeGroup('appendNotice', 'dd'.repeat(32));
    const duplicate = makeGroup('appendAudit', 'dd'.repeat(32));
    expect(materializedLowLevelCallBlockAtMaster(
      [first, duplicate], { txid: 'dd'.repeat(32), vout: 0 },
    )).toBeUndefined();
  });

  it('repairs a renamed dense block by permutation without changing the input multiset', () => {
    const renamed = makeGroup('appendNotice', 'ee'.repeat(32), 5);
    const [master, entry, event] = renamed.blockInputs!;
    const unrelated = { txid: 'ff'.repeat(32), vout: 9 };
    const inputs = [master, unrelated, event, entry] as Array<{ txid: string; vout: number }>;
    const before = inputs.map((input) => `${input.txid.toLowerCase()}:${input.vout}`).sort();
    expect(repairMaterializedLowLevelCallBlocks(inputs as never, [renamed])).toBe(1);
    expect(inputs.slice(0, 3)).toEqual([master, entry, event]);
    expect(inputs.map((input) => `${input.txid.toLowerCase()}:${input.vout}`).sort()).toEqual(before);
    expect(inputs).toHaveLength(4);
    expect(repairMaterializedLowLevelCallBlocks(inputs as never, [renamed])).toBe(0);
  });

  it('refuses sparse and specialized blocks handled by other materializers', () => {
    const sparse = makeGroup('appendNotice', '12'.repeat(32));
    sparse.blockInputs = sparse.blockInputs!.slice(0, 2);
    expect(hasMaterializedLowLevelCallBlock(sparse)).toBe(false);
    const transfer = makeGroup('publishJobEvent', '34'.repeat(32));
    transfer.blockLayout = {
      blockSize: 3,
      slots: [
        { kind: 'master', offset: 0 },
        { kind: 'transfer', offset: 1, slotIndex: 0 },
        { kind: 'event', offset: 2, slotIndex: 0 },
      ],
    };
    expect(hasMaterializedLowLevelCallBlock(transfer)).toBe(false);
  });

  it('skips shared companion claims without changing order', () => {
    const first = makeGroup('appendNotice', '56'.repeat(32));
    const second = makeGroup('appendAudit', '78'.repeat(32));
    second.blockInputs![1] = first.blockInputs![1];
    const inputs = [
      first.blockInputs![0], second.blockInputs![2], first.blockInputs![2], first.blockInputs![1],
      second.blockInputs![0], second.blockInputs![1],
    ] as Array<{ txid: string; vout: number }>;
    const before = [...inputs];
    expect(repairMaterializedLowLevelCallBlocks(inputs as never, [first, second])).toBe(0);
    expect(inputs).toEqual(before);
  });

  it('skips overlapping destination ranges owned by two otherwise disjoint blocks', () => {
    const first = makeGroup('appendNotice', '9a'.repeat(32));
    const second = makeGroup('appendAudit', 'bc'.repeat(32));
    const inputs = [
      first.blockInputs![0], second.blockInputs![0], first.blockInputs![1],
      second.blockInputs![1], first.blockInputs![2], second.blockInputs![2],
    ] as Array<{ txid: string; vout: number }>;
    const before = [...inputs];
    expect(repairMaterializedLowLevelCallBlocks(inputs as never, [first, second])).toBe(0);
    expect(inputs).toEqual(before);
  });
});

describe('generic persisted value-chunk write identity', () => {
  const categoryId = 'ab'.repeat(32);
  const slot = new Uint8Array(32).fill(7);
  const signature = 'notices:mapping(int => Notice[])';
  const makeGroup = (
    name: string, collectionSignature = signature, insert = false, valueType = 'Notice[]',
  ): import('../../src/stateful/StatefulTransactionBuilder.js').ExternalCallUtxoGroup => {
    const collectionName = collectionSignature.slice(0, collectionSignature.indexOf(':'));
    const collection = {
      name: collectionName, signature: collectionSignature, kind: 'mapping' as const,
      keyType: 'int', valueType, chunkableValue: true,
    };
    const fn = {
      name, inputs: [], outputs: [], entryAccesses: [{
        slotIndex: 0, collection: collectionName, keyParams: ['id'], operations: ['write'],
      }],
      blockLayout: {
        blockSize: 2,
        slots: [{ kind: 'master' as const, offset: 0 }, { kind: 'entry' as const, offset: 1, slotIndex: 0 }],
      },
    };
    const commitment = encodeEntryCommitment(slot, new Uint8Array(32));
    return {
      categoryId,
      stateLayout: { variables: [], collections: [collection] },
      masterUtxo: {}, dataNftUtxos: [], requiredDataNftIndices: [],
      functionName: name, functionArgs: [],
      externalContract: { inner: { artifact: { abi: [fn] } } },
      blockInputs: [{}, { token: { nft: { commitment } } }],
      blockLayout: fn.blockLayout,
      valueChunkOutputBase: 4,
      valueChunkOutputCount: 3,
      ...(insert && { plannedEntryInserts: [{
        blockSlot: 1, outputBlockSlot: 2, newCommitment: binToHex(commitment),
      }] }),
    } as unknown as import('../../src/stateful/StatefulTransactionBuilder.js').ExternalCallUtxoGroup;
  };

  it('describes scalar bytes/string and array continuations from the same collection effect metadata', () => {
    for (const valueType of ['bytes', 'string', 'Notice[]']) {
      const collection = valueType === 'Notice[]' ? 'notices' : `scalar${valueType}`;
      const candidateGroup = makeGroup(
        `write${valueType}`, `${collection}:mapping(int => ${valueType})`, false, valueType,
      );
      const [descriptor] = describeValueChunkWrites(candidateGroup);
      expect(descriptor).toMatchObject({
        collection,
        collectionSignature: `${collection}:mapping(int => ${valueType})`,
        keySlot: binToHex(slot),
        operation: 'update',
      });
      expect(groupChunkableValueWriteCollection(candidateGroup)).toBe(collection);
      expect(groupWritesSingleChunkableValueCollection(candidateGroup)).toBe(true);
    }

    // The compatibility exports preserve the established array result while new callers use the general API.
    const array = makeGroup('appendNotice');
    expect(groupChunkableArrayWriteCollection(array)).toBe('notices');
    expect(groupWritesSingleChunkableArrayCollection(array)).toBe(true);
  });

  it('confines application-name recovery to pre-kernel artifacts', () => {
    const legacyNamed = { functionName: 'publishJobEvent' };
    const renamedLegacy = { functionName: 'appendNotice' };
    expect(permitsLegacyNamedValueChunkFallback([legacyNamed, renamedLegacy])).toBe(true);

    const kernelArtifact = {
      messageBus: { convention: 'kernel-row-loop' },
    } as unknown as Artifact;
    expect(permitsLegacyNamedValueChunkFallback([
      { ...legacyNamed, logicalArtifact: kernelArtifact },
    ])).toBe(false);
    expect(permitsLegacyNamedValueChunkFallback([
      { ...renamedLegacy, logicalArtifact: kernelArtifact },
    ])).toBe(false);

    // The active route owns the compatibility decision. A kernel owner must not recover historical names merely
    // because all of its nested participants are old or publish no convention themselves.
    expect(permitsLegacyNamedValueChunkFallback([legacyNamed], 'kernel-row-loop')).toBe(false);
    expect(permitsLegacyNamedValueChunkFallback([renamedLegacy], 'kernel-row-loop')).toBe(false);
    expect(permitsLegacyNamedValueChunkFallback([legacyNamed], 'legacy-unroll')).toBe(true);
  });

  it('reconstructs descriptor-free events only for legacy plans, ignoring a named kernel decoy', () => {
    const legacyRenamed = { functionName: 'appendNotice' };
    const kernelArtifact = {
      messageBus: { convention: 'kernel-row-loop' },
    } as unknown as Artifact;
    const kernelNamedDecoy = { functionName: 'publishJobEvent', logicalArtifact: kernelArtifact };

    expect(permitsLegacyValueChunkEventReconstruction([legacyRenamed], false)).toBe(true);
    expect(permitsLegacyValueChunkEventReconstruction([legacyRenamed], true)).toBe(false);
    expect(permitsLegacyValueChunkEventReconstruction([legacyRenamed, kernelNamedDecoy], false)).toBe(false);
    // A kernel route can legitimately compose an older descriptor-free child. The active owner convention is
    // authoritative: neither the historical name nor the child's missing convention may re-enable reconstruction.
    expect(permitsLegacyValueChunkEventReconstruction(
      [{ functionName: 'publishJobEvent' }], false, 'kernel-row-loop',
    )).toBe(false);
  });

  it('keeps nested delegate event repair legacy-only across misleading names', () => {
    const legacyNamed = { functionName: 'publishJobEvent' };
    const legacyRenamed = { functionName: 'appendNotice' };
    const kernelArtifact = {
      messageBus: { convention: 'kernel-row-loop' },
    } as unknown as Artifact;
    const kernelNamedDecoy = { functionName: 'publishJobEvent', logicalArtifact: kernelArtifact };

    expect(permitsLegacyDelegateEventRepair([legacyNamed, legacyRenamed], false)).toBe(true);
    expect(permitsLegacyDelegateEventRepair([legacyNamed], true)).toBe(false);
    expect(permitsLegacyDelegateEventRepair([legacyRenamed, kernelNamedDecoy], false)).toBe(false);
    expect(permitsLegacyDelegateEventRepair(
      [{ functionName: 'publishJobEvent' }], false, 'kernel-row-loop',
    )).toBe(false);
  });

  it('selects a renamed physical value writer from metadata and rejects a named decoy', () => {
    const renamed = makeGroup('appendNotice');
    const decoy = {
      ...makeGroup('publishJobEvent'),
      stateLayout: { variables: [], collections: [] },
    };
    expect(selectChunkableValueWriteExecution([
      { group: renamed, inputIndex: 17 },
      { group: decoy, inputIndex: 9 },
    ])).toMatchObject({
      inputIndex: 17, collection: 'notices', abiFunction: { name: 'appendNotice' },
    });
  });

  it('selects a delegated writer from one authenticated resource before entry geometry materializes', () => {
    const carrier = makeGroup('relayRecord');
    const [write] = describeValueChunkWrites(carrier);
    const owner = {
      categoryId,
      lockingBytecode: `aa20${'51'.repeat(32)}87`,
    };
    const claim = {
      resourceIdentity: valueChunkWriteResourceIdentity(write),
      producer: {
        version: 1 as const,
        stateOwner: owner,
        sourcePath: [{
          sourceEffectDomainId: '91'.repeat(32),
          sourceCallsiteId: 4,
          occurrenceIndex: 0,
          sourceEffectOrdinal: 2,
        }],
        mutationEffectDomainId: '92'.repeat(32),
        mutationSourceEffectOrdinal: 3,
      },
    };
    const kernelArtifact = {
      ...carrier.externalContract.inner.artifact,
      abi: carrier.externalContract.inner.artifact.abi.map((fn: { name: string }) => ({
        ...fn, name: 'applyRecord',
      })),
      messageBus: { convention: 'kernel-row-loop' as const },
    };
    const executor = {
      ...carrier,
      functionName: 'applyRecord',
      logicalFunctionName: 'applyRecord',
      logicalArtifact: kernelArtifact,
      externalContract: { inner: { artifact: kernelArtifact } },
      valueChunkWrites: [],
      valueChunkProducerClaims: [claim],
      valueChunkStateOwner: owner,
      valueChunkOutputCount: undefined,
      callMode: 'delegatecall' as const,
    };

    expect(claimedChunkableValueWriteCollection(executor)).toBe('notices');
    expect(selectChunkableValueWriteExecution([
      { group: executor, inputIndex: 11 },
    ])).toMatchObject({
      inputIndex: 11, collection: 'notices', abiFunction: { name: 'applyRecord' },
    });

    const otherOwner = { ...owner, lockingBytecode: `aa20${'52'.repeat(32)}87` };
    const otherOwnerExecutor = {
      ...executor,
      valueChunkStateOwner: otherOwner,
      valueChunkProducerClaims: [{
        ...claim,
        producer: { ...claim.producer, stateOwner: otherOwner },
      }],
    };
    expect(claimedChunkableValueWriteCollection(otherOwnerExecutor)).toBe('notices');
    expect(selectChunkableValueWriteExecution([
      { group: executor, inputIndex: 11 },
      { group: otherOwnerExecutor, inputIndex: 11 },
    ])).toBeUndefined();

    expect(claimedChunkableValueWriteCollection({
      ...executor,
      valueChunkProducerClaims: [{
        ...claim,
        resourceIdentity: `${categoryId}:${'00'.repeat(20)}:${'42'.repeat(32)}`,
      }],
    })).toBeUndefined();
    expect(claimedChunkableValueWriteCollection({
      ...executor,
      valueChunkStateOwner: { ...owner, categoryId: '32'.repeat(32) },
    })).toBeUndefined();
  });

  it('recovers an alpha-renamed legacy writer from exact planned continuation geometry', () => {
    const structuralLegacy = (functionName: string, collectionName: string) => {
      const collection = {
        name: collectionName,
        signature: `${collectionName}:mapping(int => Notice[])`,
        kind: 'mapping' as const,
        keyType: 'int',
        valueType: 'Notice[]',
        chunkableValue: true,
      };
      const handler = {
        name: functionName,
        inputs: [{ name: '__internal__valueChunkOutputBase', type: 'int' }],
        writesState: true,
        blockLayout: {
          blockSize: 2,
          slots: [
            { kind: 'master' as const, offset: 0 },
            { kind: 'entry' as const, offset: 1, slotIndex: 0 },
          ],
        },
      };
      return {
        functionName,
        stateLayout: { variables: [], collections: [collection] },
        logicalArtifact: {
          abi: [handler],
          stateLayout: { variables: [], collections: [collection] },
          messageBus: { convention: 'legacy-unroll' },
        } as unknown as Artifact,
        valueChunkOutputBase: 12,
        valueChunkOutputCount: 2,
      };
    };
    const historicallyNamed = structuralLegacy('publishJobEvent', 'jobEvents');
    const alphaRenamed = structuralLegacy('appendNotice', 'notices');
    expect(legacyPlannedChunkableValueWriteCollection(historicallyNamed)).toBe('jobEvents');
    expect(legacyPlannedChunkableValueWriteCollection(alphaRenamed)).toBe('notices');

    const ambiguous = structuralLegacy('appendNotice', 'notices');
    ambiguous.stateLayout.collections.push({
      ...ambiguous.stateLayout.collections[0],
      name: 'history', signature: 'history:mapping(int => Notice[])',
    });
    expect(legacyPlannedChunkableValueWriteCollection(ambiguous)).toBeUndefined();

    const kernel = structuralLegacy('publishJobEvent', 'jobEvents');
    kernel.logicalArtifact.messageBus = { convention: 'kernel-row-loop' } as Artifact['messageBus'];
    expect(legacyPlannedChunkableValueWriteCollection(kernel)).toBeUndefined();

    const noWidth = structuralLegacy('appendNotice', 'notices');
    noWidth.valueChunkOutputCount = 0;
    expect(legacyPlannedChunkableValueWriteCollection(noWidth)).toBeUndefined();
    delete noWidth.valueChunkOutputCount;
    (noWidth as typeof noWidth & { derivedTrailingOutputs: Map<number, unknown> })
      .derivedTrailingOutputs = new Map([[7, { unrelated: true }]]);
    expect(legacyPlannedChunkableValueWriteCollection(noWidth)).toBeUndefined();

    const noWitness = structuralLegacy('appendNotice', 'notices');
    noWitness.logicalArtifact.abi[0].inputs = [];
    expect(legacyPlannedChunkableValueWriteCollection(noWitness)).toBeUndefined();

    const overloaded = structuralLegacy('appendNotice', 'notices');
    overloaded.logicalArtifact.abi.push({
      ...overloaded.logicalArtifact.abi[0],
      selector: '01020304',
      inputs: [
        { name: 'key', type: 'int' },
        { name: '__internal__valueChunkOutputBase', type: 'int' },
      ],
    });
    expect(legacyPlannedChunkableValueWriteCollection(overloaded)).toBeUndefined();

    const mixedConvention = structuralLegacy('appendNotice', 'notices');
    mixedConvention.externalContract = { inner: { artifact: {
      ...mixedConvention.logicalArtifact,
      messageBus: { convention: 'kernel-row-loop' },
    } as Artifact } };
    expect(legacyPlannedChunkableValueWriteCollection(mixedConvention)).toBeUndefined();

    const driftedLayout = structuralLegacy('appendNotice', 'notices');
    driftedLayout.externalContract = { inner: { artifact: {
      ...driftedLayout.logicalArtifact,
      stateLayout: {
        ...driftedLayout.logicalArtifact.stateLayout,
        collections: [{
          ...driftedLayout.logicalArtifact.stateLayout!.collections![0],
          name: 'otherNotices',
        }],
      },
    } as Artifact } };
    expect(legacyPlannedChunkableValueWriteCollection(driftedLayout)).toBeUndefined();
  });

  it('uses the routed writer layout and collection even when its artifact contains a legacy-named decoy', () => {
    const renamed = makeGroup('appendNotice');
    const routeHandler = {
      ...renamed.externalContract.inner.artifact.abi[0],
      name: 'routeAppendNotice',
      blockLayout: {
        blockSize: 7,
        slots: [
          { kind: 'master' as const, offset: 0 },
          { kind: 'entry' as const, offset: 1, slotIndex: 0 },
          { kind: 'event' as const, offset: 6, slotIndex: 0 },
        ],
      },
    };
    const namedDecoy = {
      ...renamed.externalContract.inner.artifact.abi[0],
      name: 'publishJobEvent',
      entryAccesses: [],
      blockLayout: { blockSize: 2, slots: [{ kind: 'master' as const, offset: 0 }] },
    };
    const routed = {
      ...renamed,
      compilerRoute: { abiFunction: routeHandler },
      externalContract: { inner: { artifact: {
        ...renamed.externalContract.inner.artifact,
        abi: [namedDecoy, renamed.externalContract.inner.artifact.abi[0]],
      } } },
    };

    expect(selectChunkableValueWriteExecution([
      { group: routed, inputIndex: 17 },
    ])).toMatchObject({
      inputIndex: 17,
      collection: 'notices',
      abiFunction: { name: 'routeAppendNotice', blockLayout: { blockSize: 7 } },
    });
  });

  it('selects publish ownership by renamed resource identity and collapses duplicate route views', () => {
    const [renamed] = describeValueChunkWrites(makeGroup('appendNotice'));
    expect(selectValueChunkWriteCategory([renamed])).toEqual({
      status: 'exact', categoryId, write: renamed,
    });
    expect(selectValueChunkWriteCategory([renamed, { ...renamed }])).toEqual({
      status: 'exact', categoryId, write: { ...renamed },
    });
    expect(selectValueChunkWriteCategory([])).toEqual({ status: 'absent' });
  });

  it('resolves chunkable entry ownership from exact metadata and fails closed for kernel ambiguity', () => {
    const [renamed] = describeValueChunkWrites(makeGroup('appendNotice'));
    expect(resolveChunkableEntryCollection({
      writes: [renamed],
      categoryId,
      publishedCollections: ['decoy'],
      convention: 'kernel-row-loop',
    })).toBe(signature);
    expect(resolveChunkableEntryCollection({
      writes: [],
      categoryId,
      publishedCollections: ['records'],
      convention: 'kernel-row-loop',
    })).toBe('records');
    expect(() => resolveChunkableEntryCollection({
      writes: [],
      categoryId,
      publishedCollections: ['records', 'audit'],
      convention: 'kernel-row-loop',
      legacyFallback: 'historical',
    })).toThrow(/requires one exact compiler-published collection identity/);
    expect(() => resolveChunkableEntryCollection({
      writes: [],
      categoryId,
      publishedCollections: [],
      convention: 'kernel-row-loop',
      legacyFallback: 'historical',
    })).toThrow(/requires one exact compiler-published collection identity/);
    expect(resolveChunkableEntryCollection({
      writes: [],
      categoryId,
      publishedCollections: [],
      convention: 'legacy-unroll',
      legacyFallback: 'historical',
    })).toBe('historical');
  });

  it('treats several well-formed keys in one collection as a multi-resource seed, not persist-band ownership', () => {
    const [first] = describeValueChunkWrites(makeGroup('initialize', signature, true));
    const second = {
      ...first, keySlot: 'cd'.repeat(32), entryAccessSlot: 1, routeSlot: 1, operation: 'insert' as const,
    };
    const selection = selectValueChunkWriteCategory([first, second]);
    expect(selection).toMatchObject({ status: 'multi' });
    expect(isInitialValueChunkWrite(selection)).toBe(true);
    expect(persistedValueChunkReadiness({
      selection,
      hasWriteMetadata: true,
      permitsLegacyFallback: false,
      descriptorReady: false,
      legacyReady: true,
    })).toBe(false);
    expect(shouldRematerializeDescribedValueChunkWrite({
      selection, persisted: true, plannedInserts: 0,
    })).toBeUndefined();
  });

  it('scopes persisted readiness to a renamed resource and rejects cross-builder legacy leakage', () => {
    const [renamed] = describeValueChunkWrites(makeGroup('appendNotice'));
    const exact = selectValueChunkWriteCategory([renamed]);
    expect(persistedValueChunkReadiness({
      selection: exact,
      hasWriteMetadata: true,
      permitsLegacyFallback: false,
      descriptorReady: false,
      legacyReady: true,
    })).toBe(false);
    expect(persistedValueChunkReadiness({
      selection: exact,
      hasWriteMetadata: true,
      permitsLegacyFallback: false,
      descriptorReady: true,
      legacyReady: false,
    })).toBe(true);
    expect(persistedValueChunkReadiness({
      selection: { status: 'absent' },
      hasWriteMetadata: false,
      permitsLegacyFallback: false,
      descriptorReady: false,
      legacyReady: true,
    })).toBe(false);
    expect(persistedValueChunkReadiness({
      selection: { status: 'absent' },
      hasWriteMetadata: false,
      permitsLegacyFallback: true,
      descriptorReady: false,
      legacyReady: true,
    })).toBe(true);
    expect(() => persistedValueChunkReadiness({
      selection: { status: 'absent' },
      hasWriteMetadata: true,
      permitsLegacyFallback: false,
      descriptorReady: false,
      legacyReady: true,
    })).toThrow(/did not produce one exact resource descriptor/);
    expect(() => persistedValueChunkReadiness({
      selection: { status: 'ambiguous' },
      hasWriteMetadata: true,
      permitsLegacyFallback: false,
      descriptorReady: false,
      legacyReady: true,
    })).toThrow(/Ambiguous compiler-described value-chunk write identity/);
  });

  it('distinguishes multiple valid resources from malformed compiler identity', () => {
    const [renamed] = describeValueChunkWrites(makeGroup('appendNotice'));
    const [independent] = describeValueChunkWrites(makeGroup(
      'appendAudit', 'audit:mapping(int => Notice[])',
    ));
    expect(independent.categoryId).toBe(renamed.categoryId);
    expect(selectValueChunkWriteCategory([renamed, independent])).toEqual({
      status: 'multi', writes: [renamed, independent],
    });
    expect(selectValueChunkWriteCategory([
      { ...renamed, collectionHash: '00'.repeat(32) },
    ])).toEqual({ status: 'ambiguous' });
  });

  it('binds missing chunk categories to exact renamed write identity', () => {
    const [renamed] = describeValueChunkWrites(makeGroup('appendNotice'));
    const exact = selectValueChunkWriteCategory([renamed]);
    expect(resolveValueChunkWriteCategory(exact, undefined, 'cd'.repeat(32))).toBe(categoryId);
    expect(resolveValueChunkWriteCategory(exact, 'cd'.repeat(32), categoryId)).toBeUndefined();
    expect(resolveValueChunkWriteCategory({ status: 'ambiguous' }, undefined, categoryId)).toBeUndefined();
    expect(resolveValueChunkWriteCategory({ status: 'ambiguous' }, categoryId, categoryId)).toBeUndefined();
    expect(resolveValueChunkWriteCategory({ status: 'absent' }, undefined, categoryId)).toBe(categoryId);
    expect(resolveValueChunkWriteCategory({ status: 'absent' }, 'ef'.repeat(32), categoryId))
      .toBe('ef'.repeat(32));
  });

  it('selects token-band repair ownership by physical compiler layout, independent of handler name', () => {
    const participant = {
      categoryId, functionName: 'settleNotice', blockLayout: {
        blockSize: 5, slots: [{ kind: 'master', offset: 0 }, { kind: 'entry', offset: 1 }],
      },
    } as unknown as import('../../src/stateful/StatefulTransactionBuilder.js').PhysicalReturnGroup;
    expect(selectTokenBandRepairOwner(
      [participant], (candidate) => candidate === categoryId ? 12 : -1, { start: 14, end: 17 },
    )).toEqual({ status: 'exact', groupIndex: 0, categoryId, masterIndex: 12 });
    expect(selectTokenBandRepairOwner(
      [participant], () => 12, { start: 20, end: 22 },
    )).toEqual({ status: 'absent' });
  });

  it('fails closed when independent participants both claim token-band repair ownership', () => {
    const otherCategory = 'cd'.repeat(32);
    const participant = (id: string, name: string) => ({
      categoryId: id, functionName: name, blockLayout: {
        blockSize: 5, slots: [{ kind: 'master', offset: 0 }, { kind: 'entry', offset: 1 }],
      },
    }) as unknown as import('../../src/stateful/StatefulTransactionBuilder.js').PhysicalReturnGroup;
    expect(selectTokenBandRepairOwner(
      [participant(categoryId, 'settleNotice'), participant(otherCategory, 'settleAudit')],
      (candidate) => candidate === categoryId ? 12 : 13,
      { start: 14, end: 17 },
    )).toEqual({ status: 'ambiguous' });
  });

  it('selects a renamed writer event from compiler route metadata and collapses duplicate views', () => {
    const eventOutput = {
      eventSignature: 'NoticeAppended(int,bytes)',
      commitment: '01aa',
      lockingBytecode: Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32), 0x87),
    };
    const candidate = {
      categoryId,
      blockLayout: {
        blockSize: 3,
        slots: [{ kind: 'master', offset: 0 }, { kind: 'event', offset: 2, slotIndex: 0 }],
      },
      compilerRoute: {
        abiFunction: {
          name: 'appendNotice', inputs: [], emits: [{
            eventName: 'NoticeAppended', eventSignature: eventOutput.eventSignature, emitIndex: 0,
          }],
          blockLayout: {
            blockSize: 3,
            slots: [{ kind: 'master', offset: 0 }, { kind: 'event', offset: 2, slotIndex: 0 }],
          },
        },
        eventSignaturesBySlot: [eventOutput.eventSignature],
      },
      eventOutputs: [eventOutput],
    } as unknown as import('../../src/stateful/StatefulTransactionBuilder.js').ExternalCallUtxoGroup;
    expect(selectCompilerWriterEvent([candidate, { ...candidate }])).toMatchObject({
      status: 'exact', categoryId, slotOffset: 2,
      eventSignature: 'NoticeAppended(int,bytes)', eventOutput,
    });
  });

  it('fails closed on conflicting writer event slots, declarations, or observations', () => {
    const base = {
      categoryId,
      blockLayout: {
        blockSize: 3,
        slots: [{ kind: 'master', offset: 0 }, { kind: 'event', offset: 2, slotIndex: 0 }],
      },
      compilerRoute: {
        abiFunction: { name: 'appendNotice', inputs: [], blockLayout: {
          blockSize: 3,
          slots: [{ kind: 'master', offset: 0 }, { kind: 'event', offset: 2, slotIndex: 0 }],
        } },
        eventSignaturesBySlot: ['NoticeAppended(int,bytes)'],
      },
    } as unknown as import('../../src/stateful/StatefulTransactionBuilder.js').ExternalCallUtxoGroup;
    expect(selectCompilerWriterEvent([
      base,
      { ...base, compilerRoute: {
        ...base.compilerRoute, eventSignaturesBySlot: ['AuditAppended(int,bytes)'],
      } },
    ])).toEqual({ status: 'ambiguous' });
    expect(selectCompilerWriterEvent([{
      ...base,
      eventOutputs: [{
        eventSignature: 'AuditAppended(int,bytes)', commitment: '01bb',
        lockingBytecode: Uint8Array.of(0x51),
      }],
    }])).toEqual({ status: 'ambiguous' });
  });

  it('fails closed when independent chunkable writers claim different physical inputs', () => {
    expect(selectChunkableValueWriteExecution([
      { group: makeGroup('appendNotice'), inputIndex: 17 },
      { group: makeGroup('appendAudit'), inputIndex: 23 },
    ])).toBeUndefined();
  });

  it('fails closed when one physical input ambiguously claims independent collections', () => {
    expect(selectChunkableValueWriteExecution([
      { group: makeGroup('appendNotice'), inputIndex: 17 },
      { group: makeGroup('appendAudit', 'audit:mapping(int => Notice[])'), inputIndex: 17 },
    ])).toBeUndefined();
  });

  it('authenticates an alpha-renamed update and rejects a same-category decoy collection', () => {
    StatefulTransactionBuilder.clearPersistedJobEvents();
    const value = new Uint8Array(100).fill(9);
    const [renamed] = describeValueChunkWrites(makeGroup('appendNotice'));
    legacyRememberValueChunkValue(categoryId, value);
    legacyRememberValueChunkLock(categoryId, getValueChunkLockingBytecode(
      categoryId, renamed.collection, slot, sha256Sync(value),
    ));
    expect(renamed).toMatchObject({
      collectionSignature: signature, keySlot: binToHex(slot), operation: 'update',
      outputBase: 4, outputCount: 3,
    });
    const exact = persistedValueChunkWriteState(renamed);
    expect(exact?.width).toBeGreaterThan(0);
    expect(exact?.value).toEqual(value);
    expect(exact?.recipe).toMatchObject({
      collection: renamed.collection, categoryId, slot, root: sha256Sync(value),
    });
    expect(binToHex(persistUpdateRedeemLock(categoryId, undefined, renamed)!))
      .toBe(binToHex(getValueChunkLockingBytecode(categoryId, renamed.collection, slot, sha256Sync(value))));
    expect(rememberValueChunkUnlockRecipe(renamed, value, exact?.lockingBytecode)).toBe(true);
    expect(binToHex(persistValueChunkLock(categoryId, value, renamed)!)).toBe(
      binToHex(getValueChunkLockingBytecode(categoryId, renamed.collection, slot, sha256Sync(value))),
    );
    const digestLock = persistUpdateDigestLock(categoryId, [], renamed);
    expect(digestLock?.length).toBe(35);
    expect(binToHex(digestLock!)).not.toBe(binToHex(legacyJobEventsPersistUpdateDigestLock(categoryId)!));
    expect(persistUpdateDigestLock(categoryId)).toBeUndefined();
    const otherLock = getValueChunkLockingBytecode(
      categoryId, 'other', slot, sha256Sync(value),
    );
    expect(binToHex(persistUpdateRedeemLock(categoryId, otherLock, renamed)!))
      .not.toBe(binToHex(otherLock));

    const [decoy] = describeValueChunkWrites(makeGroup('publishJobEvent', 'other:mapping(int => Notice[])'));
    expect(persistedValueChunkWriteState(decoy)).toBeUndefined();
    expect(rememberValueChunkUnlockRecipe(decoy, value, exact?.lockingBytecode)).toBe(false);
    expect(persistValueChunkLock(categoryId, value, decoy)).not.toEqual(exact?.lockingBytecode);
    const malformedDescriptor = { ...renamed, collectionHash: '00'.repeat(32) };
    expect(persistValueChunkLock(categoryId, value, malformedDescriptor)).toBeUndefined();
    expect(persistUpdateDigestLock(categoryId, [], malformedDescriptor)).toBeUndefined();
    expect(persistValueChunkLock(categoryId, value, null)).toBeUndefined();
    expect(persistUpdateRedeemLock(categoryId, exact?.lockingBytecode, null)).toBeUndefined();
    expect(persistUpdateDigestLock(categoryId, [], null)).toBeUndefined();
    expect(selectPersistedValueChunkWrite([decoy], categoryId)).toBeUndefined();
    expect(selectPersistedValueChunkWrite([decoy, renamed], categoryId)).toEqual(renamed);
    // The route and logical group may both describe one physical write; identity de-duplication keeps it exact.
    expect(selectPersistedValueChunkWrite([renamed, { ...renamed }], categoryId)).toEqual(renamed);
    StatefulTransactionBuilder.clearPersistedJobEvents();
  });

  it('keeps persisted resources separate by collection hash and key slot within one category', () => {
    StatefulTransactionBuilder.clearPersistedJobEvents();
    const [first] = describeValueChunkWrites(makeGroup('appendNotice'));
    const alternateSignature = 'audit:mapping(int => Notice[])';
    const [secondBase] = describeValueChunkWrites(makeGroup('appendAudit', alternateSignature));
    const second = { ...secondBase, keySlot: '09'.repeat(32) };
    const firstValue = new Uint8Array(100).fill(0x31);
    const secondValue = new Uint8Array(120).fill(0x52);
    const firstLock = getValueChunkLockingBytecode(
      categoryId, first.collection, hexToBin(first.keySlot), sha256Sync(firstValue),
    );
    const secondLock = getValueChunkLockingBytecode(
      categoryId, second.collection, hexToBin(second.keySlot), sha256Sync(secondValue),
    );

    legacyRememberValueChunkValue(categoryId, firstValue);
    legacyRememberValueChunkLock(categoryId, firstLock);
    expect(persistedValueChunkWriteState(first)?.value).toEqual(firstValue);

    // A later observation for another resource in the same token category must not evict the first identity.
    legacyRememberValueChunkValue(categoryId, secondValue);
    legacyRememberValueChunkLock(categoryId, secondLock);
    expect(persistedValueChunkWriteState(second)?.value).toEqual(secondValue);
    expect(persistedValueChunkWriteState(first)?.value).toEqual(firstValue);

    // Nor may a name-shaped decoy borrow either exact cache entry.
    const decoy = { ...second, keySlot: '0a'.repeat(32) };
    expect(persistedValueChunkWriteState(decoy)).toBeUndefined();
    StatefulTransactionBuilder.clearPersistedJobEvents();
  });

  it('protects renamed active collection locks and ignores a legacy-named decoy', () => {
    const renamed = makeGroup('appendNotice');
    renamed.valueChunkWrites = describeValueChunkWrites(renamed);
    const decoy = {
      ...makeGroup('publishJobEvent'),
      stateLayout: { variables: [], collections: [] },
      valueChunkWrites: [],
    };
    const selected = selectProtectedLoopEntryCollections([renamed, decoy]);
    expect(selected.status).toBe('exact');
    expect(selected.collections).toContain('notices');
    expect(selected.collections).toContain(signature);
    expect(selected.collections).not.toContain('jobEvents');

    const planned = makeGroup('createNotice', signature, true);
    expect(selectProtectedLoopEntryCollections([planned])).toMatchObject({
      status: 'exact', collections: ['notices'],
    });
    expect(selectProtectedLoopEntryCollections([])).toEqual({
      status: 'absent', collections: ['jobEvents'],
    });
    const kernelArtifact = {
      messageBus: { convention: 'kernel-row-loop' },
    } as unknown as Artifact;
    expect(selectProtectedLoopEntryCollections([{
      functionName: 'publishJobEvent', logicalArtifact: kernelArtifact,
    }])).toEqual({ status: 'absent', collections: [] });
    // A partially populated compiler-route group may not carry a nested artifact from which to infer the
    // convention. The active owner is still authoritative and must keep historical application-name recovery
    // disabled for a kernel row loop.
    const compilerRouteOnly = {
      functionName: 'publishJobEvent', compilerRoute: {},
    };
    expect(selectProtectedLoopEntryCollections(
      [compilerRouteOnly], 'kernel-row-loop',
    )).toEqual({ status: 'absent', collections: [] });
    expect(selectProtectedLoopEntryCollections(
      [compilerRouteOnly], 'legacy-unroll',
    )).toEqual({ status: 'absent', collections: ['jobEvents'] });

    const [malformed] = renamed.valueChunkWrites;
    expect(selectProtectedLoopEntryCollections([{
      ...renamed,
      valueChunkWrites: [{ ...malformed, collectionHash: '00'.repeat(32) }],
    }]).status).toBe('ambiguous');
  });

  it('publishes insert identity separately from an update', () => {
    expect(describeValueChunkWrites(makeGroup('createNotice', signature, true))[0])
      .toMatchObject({ operation: 'insert', entryAccessSlot: 0, routeSlot: 0 });
  });

  it('derives first-write semantics from renamed descriptors and ignores legacy-name decoys', () => {
    const [renamedInsert] = describeValueChunkWrites(makeGroup('createNotice', signature, true));
    const [namedDecoyUpdate] = describeValueChunkWrites(makeGroup('publishJobPost'));

    expect(isInitialValueChunkWrite(
      selectValueChunkWriteCategory([renamedInsert]), false,
    )).toBe(true);
    expect(isInitialValueChunkWrite(
      selectValueChunkWriteCategory([namedDecoyUpdate]), true,
    )).toBe(false);
    expect(isInitialValueChunkWrite({ status: 'absent' }, true)).toBe(true);
  });

  it('distinguishes independent keys from conflicting views of one resource', () => {
    const [update] = describeValueChunkWrites(makeGroup('appendNotice'));
    const distinctKey = { ...update, keySlot: '09'.repeat(32) };
    expect(selectValueChunkWriteCategory([update, distinctKey])).toEqual({
      status: 'multi', writes: [update, distinctKey],
    });
    expect(isInitialValueChunkWrite(
      selectValueChunkWriteCategory([update, distinctKey]), true,
    )).toBe(false);

    expect(selectValueChunkWriteCategory([
      update, { ...update, operation: 'insert' },
    ])).toEqual({ status: 'ambiguous' });
  });

  it('rematerializes only an exact persisted update without competing INSERT destinations', () => {
    const [update] = describeValueChunkWrites(makeGroup('appendNotice'));
    const [insert] = describeValueChunkWrites(makeGroup('createNotice', signature, true));
    const updateSelection = selectValueChunkWriteCategory([update]);

    expect(shouldRematerializeDescribedValueChunkWrite({
      selection: updateSelection, persisted: true, plannedInserts: 0,
    })).toBe(true);
    expect(shouldRematerializeDescribedValueChunkWrite({
      selection: updateSelection, persisted: true, plannedInserts: 1,
    })).toBe(false);
    expect(shouldRematerializeDescribedValueChunkWrite({
      selection: selectValueChunkWriteCategory([insert]), persisted: true, plannedInserts: 0,
    })).toBe(false);
    expect(shouldRematerializeDescribedValueChunkWrite({
      selection: { status: 'absent' }, persisted: true, plannedInserts: 0,
    })).toBeUndefined();
  });

  it('refuses a category-free choice between two authenticated persisted resources', () => {
    StatefulTransactionBuilder.clearPersistedJobEvents();
    const [first] = describeValueChunkWrites(makeGroup('appendNotice'));
    const firstValue = new Uint8Array(100).fill(3);
    legacyRememberValueChunkValue(first.categoryId, firstValue);
    legacyRememberValueChunkLock(first.categoryId, getValueChunkLockingBytecode(
      first.categoryId, first.collection, slot, sha256Sync(firstValue),
    ));

    const secondCategory = 'cd'.repeat(32);
    const second = { ...first, categoryId: secondCategory };
    const secondValue = new Uint8Array(100).fill(4);
    legacyRememberValueChunkValue(secondCategory, secondValue);
    legacyRememberValueChunkLock(secondCategory, getValueChunkLockingBytecode(
      secondCategory, second.collection, slot, sha256Sync(secondValue),
    ));

    expect(selectPersistedValueChunkWrite([first, second])).toBeUndefined();
    expect(selectPersistedValueChunkWrite([first, second], secondCategory)).toEqual(second);
    expect(persistedValueChunkWriteState(second)?.value).toEqual(secondValue);
    StatefulTransactionBuilder.clearPersistedJobEvents();
  });

  it('ties insert mode to the matching route slot in a multi-collection writer', () => {
    const primary = makeGroup('writeBoth');
    const otherSlot = new Uint8Array(32).fill(8);
    const otherSignature = 'audit:mapping(int => Notice[])';
    const otherCommitment = encodeEntryCommitment(otherSlot, new Uint8Array(32));
    primary.stateLayout.collections!.push({
      name: 'audit', signature: otherSignature, kind: 'mapping', keyType: 'int',
      valueType: 'Notice[]', chunkableValue: true,
    });
    const fn = primary.externalContract.inner.artifact.abi[0];
    fn.entryAccesses.push({
      slotIndex: 1, collection: 'audit', keyParams: ['id'], operations: ['write'],
    });
    fn.blockLayout.blockSize = 3;
    fn.blockLayout.slots.push({ kind: 'entry', offset: 2, slotIndex: 1 });
    primary.blockInputs!.push({ token: { nft: { commitment: otherCommitment } } } as never);
    primary.plannedEntryInserts = [{
      blockSlot: 2, outputBlockSlot: 3, newCommitment: binToHex(otherCommitment),
    }];

    expect(describeValueChunkWrites(primary).map((write) => ({
      collection: write.collection, keySlot: write.keySlot, operation: write.operation,
    }))).toEqual([
      { collection: 'notices', keySlot: binToHex(slot), operation: 'update' },
      { collection: 'audit', keySlot: binToHex(otherSlot), operation: 'insert' },
    ]);
  });
});

const returnSlot = { kind: 'returnEvent' as const, offset: 7 };
const tokenLayout = { blockSize: 8, slots: [{ kind: 'master' as const, offset: 0 }, returnSlot] };
const proxyLayout = { blockSize: 10, slots: [{ kind: 'master' as const, offset: 0 }] };
const transferFromContract = {
  inner: { artifact: { abi: [{ name: 'transferFrom', writesState: true, outputs: [{ type: 'bool' }] }] } },
};

function group(partial: Partial<PhysicalReturnGroup> & Pick<PhysicalReturnGroup, 'categoryId'>): PhysicalReturnGroup {
  return {
    returnEventInBlock: false,
    ...partial,
  };
}

describe('assignPhysicalReturnIndices', () => {
  it('retains an output index through deterministic P2SH32 reconstruction', () => {
    const current = hexToBin(`aa20${'11'.repeat(32)}87`);
    const expected = hexToBin(`aa20${'22'.repeat(32)}87`);
    expect(selectExpectedP2sh32OutputLock(current, current, expected)).toEqual(expected);
    expect(selectExpectedP2sh32OutputLock(current, expected, current)).toEqual(expected);
    expect(selectExpectedP2sh32OutputLock(current, expected, Uint8Array.of(0x51))).toBeUndefined();
  });

  it('relocates a misplaced SCID without reclaiming its authenticated output coordinate', () => {
    const compilerOwnedLock = hexToBin(`aa20${'11'.repeat(32)}87`);
    const identityLock = hexToBin(`aa20${'22'.repeat(32)}87`);
    const commitment = `5343494401${'00'.repeat(20)}`;
    const outputs = [
      {
        to: compilerOwnedLock,
        amount: 1200n,
        token: {
          category: 'aa',
          amount: 0n,
          nft: { capability: 'none' as const, commitment },
        },
      },
      { to: Uint8Array.of(0x51), amount: 1000n },
    ];
    const inputs = [{
      satoshis: 1200n,
      token: {
        category: 'aa',
        amount: 0n,
        nft: { capability: 'none' as const, commitment },
      },
      unlocker: { generateLockingBytecode: () => identityLock },
    }];

    expect(reassertScidIdentityOutputs(outputs, inputs, new Set([0]))).toBe(1);
    expect(outputs[0]).toEqual({ to: compilerOwnedLock, amount: 1200n });
    expect(outputs[1]).toEqual({
      to: identityLock,
      amount: 1200n,
      token: {
        category: 'aa',
        amount: 0n,
        nft: { capability: 'none', commitment },
      },
    });
  });

  it('distinguishes fixed entry outputs from other mutable participant slots', () => {
    const layout = {
      blockSize: 4,
      slots: [
        { kind: 'master' as const, offset: 0 },
        { kind: 'dataNft' as const, offset: 1 },
        { kind: 'entry' as const, offset: 2 },
        { kind: 'returnEvent' as const, offset: 3 },
      ],
    };

    expect(blockOutputOwnsSlotKind(12, 10, layout, 'entry')).toBe(true);
    expect(blockOutputOwnsSlotKind(11, 10, layout, 'entry')).toBe(false);
    expect(blockOutputOwnsSlotKind(13, 10, layout, 'entry')).toBe(false);
  });

  it('protects exact and legacy fixed data-NFT outputs from dynamic replay', () => {
    const sparse = {
      blockSize: 8,
      slots: [
        { kind: 'master' as const, offset: 0 },
        { kind: 'dataNft' as const, offset: 1 },
        { kind: 'entry' as const, offset: 2 },
        { kind: 'dataNft' as const, offset: 4 },
      ],
    };
    expect(blockOutputOwnsFixedDataNft(11, 10, sparse, 2)).toBe(true);
    expect(blockOutputOwnsFixedDataNft(12, 10, sparse, 2)).toBe(false);
    expect(blockOutputOwnsFixedDataNft(14, 10, sparse, 2)).toBe(true);
    expect(blockOutputOwnsFixedDataNft(21, 20, undefined, 2)).toBe(true);
    expect(blockOutputOwnsFixedDataNft(22, 20, undefined, 2)).toBe(true);
    expect(blockOutputOwnsFixedDataNft(23, 20, undefined, 2)).toBe(false);

    const participants = [{
      categoryId: 'AaBb', blockBase: 10, blockLayout: sparse,
      dataNftCount: 2, requiredDataNftIndices: [3, 7],
    }, {
      categoryId: 'delegated-owner', blockBase: 20, blockLayout: undefined,
      dataNftCount: 2, requiredDataNftIndices: [4, 9],
    }];
    expect(fixedDataNftOwnerInParticipantBlocks(14, 'aAbB', participants))
      .toEqual({ participantIndex: 0, nftIndex: 7 });
    expect(fixedDataNftOwnerInParticipantBlocks(22, 'delegated-owner', participants))
      .toEqual({ participantIndex: 1, nftIndex: 9 });
    expect(fixedDataNftOwnerInParticipantBlocks(12, 'aabb', participants)).toBeUndefined();
    expect(fixedDataNftOwnerInParticipantBlocks(14, 'other-owner', participants)).toBeUndefined();
  });

  it('reserves every output in assigned scalar and loop return witnesses', () => {
    const groups: PhysicalReturnGroup[] = [
      group({ categoryId: 'alpha', returnOutputIndex: 20 }),
      group({
        categoryId: 'beta',
        returnOutputIndex: 21,
        loopReturnCommitments: { length: 3 } as Uint8Array[],
      }),
      group({ categoryId: 'gamma' }),
    ];

    expect([...returnWitnessOutputIndices(groups)]).toEqual([20, 21, 22, 23]);
  });

  it('keeps planned tails when they already sit after every participant block', () => {
    const groups: PhysicalReturnGroup[] = [
      group({
        categoryId: 'md',
        functionName: '__forward',
        returnOutputIndex: 30,
        blockLayout: proxyLayout,
        blockInputs: { length: 10 },
      }),
      group({
        categoryId: 'ft',
        functionName: 'transferFrom',
        returnEventInBlock: true,
        returnOutputIndex: 29,
        blockLayout: tokenLayout,
        blockInputs: { length: 8 },
        externalContract: transferFromContract,
      }),
    ];
    const assigned = assignPhysicalReturnIndices(groups, (categoryId) => (
      categoryId === 'md' ? 13 : categoryId === 'ft' ? 22 : -1
    ));
    expect(assigned.get(1)).toBe(29);
    expect(assigned.get(0)).toBe(30);
  });

  it('rebases in-block returns and colliding tails after a minting-band rotate', () => {
    const groups: PhysicalReturnGroup[] = [
      group({
        categoryId: 'md',
        functionName: '__forward',
        returnOutputIndex: 30,
        blockLayout: proxyLayout,
        blockInputs: { length: 10 },
      }),
      group({
        categoryId: 'md',
        functionName: '__forward',
        sharedGroupIndex: 0,
        returnOutputIndex: 31,
      }),
      group({
        categoryId: 'ft',
        functionName: 'transferFrom',
        returnEventInBlock: true,
        returnOutputIndex: 29,
        blockLayout: tokenLayout,
        blockInputs: { length: 8 },
        externalContract: transferFromContract,
      }),
      group({
        categoryId: 'ft',
        functionName: 'approve',
        sharedGroupIndex: 2,
        returnOutputIndex: 32,
      }),
    ];
    const assigned = assignPhysicalReturnIndices(groups, (categoryId) => (
      categoryId === 'md' ? 13 : categoryId === 'ft' ? 26 : -1
    ));
    expect(assigned.get(2)).toBe(33);
    expect(assigned.get(0)).toBe(34);
    expect(assigned.get(1)).toBe(35);
    expect(assigned.get(3)).toBe(36);
  });

  it('gives a writing physical group the in-block slot even when a later call is fused', () => {
    const writerAbi = { name: 'transferFrom', writesState: true, outputs: [{ type: 'bool' }] };
    const viewAbi = { name: 'balanceOf', writesState: false, outputs: [{ type: 'uint256' }] };
    const writing = [
      group({
        categoryId: 'ft',
        functionName: 'transferFrom',
        returnEventInBlock: true,
        fusedReturnGroupIndex: 1,
        blockLayout: tokenLayout,
        externalContract: { inner: { artifact: { abi: [writerAbi] } } },
      }),
      group({
        categoryId: 'ft',
        functionName: 'approve',
        sharedGroupIndex: 0,
        fusedReturnGroupIndex: 1,
        externalContract: { inner: { artifact: { abi: [{ name: 'approve', writesState: true }] } } },
      }),
    ];
    expect(groupOwnsInBlockReturnEvent(writing, 0)).toBe(true);
    expect(groupOwnsInBlockReturnEvent(writing, 1)).toBe(true);
    const viewing = [
      group({
        categoryId: 'ft',
        functionName: 'balanceOf',
        returnEventInBlock: true,
        fusedReturnGroupIndex: 1,
        blockLayout: tokenLayout,
        externalContract: { inner: { artifact: { abi: [viewAbi] } } },
      }),
      group({
        categoryId: 'ft',
        functionName: 'approve',
        sharedGroupIndex: 0,
        fusedReturnGroupIndex: 1,
        externalContract: { inner: { artifact: { abi: [{ name: 'approve', writesState: true }] } } },
      }),
    ];
    expect(groupOwnsInBlockReturnEvent(viewing, 0)).toBe(false);
    expect(groupOwnsInBlockReturnEvent(viewing, 1)).toBe(true);
  });

  it('materializes rolled loop returns even when pending return events were cleared', () => {
    const digital = utf8ToBin('DIGITAL_VIDEO');
    const empty = new Uint8Array(0);
    const groups = [
      {
        ...group({
          categoryId: 'md',
          functionName: 'publishJobEvent',
          logicalFunctionName: 'publishJobEvent',
          externalContract: {
            inner: {
              artifact: {
                abi: [
                  { name: 'meceTags', writesState: false },
                  { name: 'publishJobEvent', writesState: true },
                ],
              },
            },
          },
        }),
        loopReturnCommitments: [digital, empty],
      },
    ];
    // Pending cleared after seed — requiring candidates previously dropped the meceTags band.
    const selected = selectMaterializedTailReturnEvents(groups, []);
    expect(selected).toHaveLength(2);
    expect(selected[0]?.identity).toBe('external-call:0:0');
    expect(selected[1]?.identity).toBe('external-call:0:1');
    expect(binToHex(selected[0]!.commitment)).toBe(binToHex(digital));
    expect(binToHex(selected[1]!.commitment)).toBe(binToHex(empty));
  });

  it('keeps a multi-part tail anchored at its authenticated part-zero return index', () => {
    const first = Uint8Array.of(0x11);
    const second = Uint8Array.of(0x22);
    const returnGroup = group({
      categoryId: 'reader',
      functionName: 'readEach',
      logicalFunctionName: 'readEach',
      returnOutputIndex: 12,
      loopReturnCommitments: [first, second],
      externalContract: {
        inner: { artifact: { abi: [{ name: 'readEach', writesState: false }] } },
      },
    });
    const groups = [returnGroup];

    const materialized = selectMaterializedTailReturnEvents(groups, []);
    expect(materialized.map(({ identity }) => identity)).toEqual([
      'external-call:0:0', 'external-call:0:1',
    ]);
    const placements = packTailReturnPlacements(groups, () => -1, materialized, 'other');

    expect(returnGroup.returnOutputIndex).toBe(12);
    expect(placements.get('external-call:0:0')).toBe(12);
    expect(placements.get('external-call:0:1')).toBe(13);
    expect([...returnWitnessOutputIndices(groups)]).toEqual([12, 13]);
  });

  it('refuses in-block ownership when a fused writer still carries multi-width meceTags returns', () => {
    // publishJobPost: meceTags(tags_[i]) seeds the MarketplaceData group, then publishJobEvent fuses onto
    // the same master and overwrites functionName. The rolled loop commitments must still force tail
    // placement — otherwise base+1 reads an empty hole and meceCount stays 0.
    const mdLayout = {
      blockSize: 3,
      slots: [
        { kind: 'master' as const, offset: 0 },
        { kind: 'entry' as const, offset: 1, slotIndex: 0 },
        { kind: 'returnEvent' as const, offset: 2 },
      ],
    };
    const groups = [
      group({
        categoryId: 'md',
        functionName: 'publishJobEvent',
        logicalFunctionName: 'publishJobEvent',
        returnEventInBlock: true,
        blockLayout: mdLayout,
        loopReturnCommitments: { length: 2 },
        returnOutputIndex: 34,
        externalContract: {
          inner: {
            artifact: {
              abi: [
                { name: 'meceTags', writesState: false, outputs: [{ type: 'string' }] },
                { name: 'publishJobEvent', writesState: true },
              ],
            },
          },
        },
      }),
      group({
        categoryId: 'md',
        functionName: 'userRegistered',
        logicalFunctionName: 'userRegistered',
        sharedGroupIndex: 0,
        returnOutputIndex: 35,
        externalContract: {
          inner: { artifact: { abi: [{ name: 'userRegistered', writesState: false, outputs: [{ type: 'bool' }] }] } },
        },
      }),
    ];
    expect(groupOwnsInBlockReturnEvent(groups, 0)).toBe(false);
    const assigned = assignPhysicalReturnIndices(groups, () => -1);
    expect(assigned.get(0)).toBe(34);
    expect(assigned.get(1)).toBe(36);
    groups[0].returnOutputIndex = assigned.get(0);
    groups[1].returnOutputIndex = assigned.get(1);
    expect(returnWitnessOutputIndices(groups)).toEqual(new Set([34, 35, 36]));
  });

  it('refuses in-block ownership when the fused shared group carries a multi-part loop return', () => {
    const layout = {
      blockSize: 2,
      slots: [
        { kind: 'master' as const, offset: 0 },
        { kind: 'returnEvent' as const, offset: 1 },
      ],
    };
    const groups = [
      group({
        categoryId: 'shared',
        functionName: 'mutate',
        logicalFunctionName: 'mutate',
        returnEventInBlock: true,
        fusedReturnGroupIndex: 1,
        blockLayout: layout,
        externalContract: {
          inner: { artifact: { abi: [{ name: 'mutate', writesState: true }] } },
        },
      }),
      group({
        categoryId: 'shared',
        functionName: 'readEach',
        logicalFunctionName: 'readEach',
        sharedGroupIndex: 0,
        returnOutputIndex: 8,
        loopReturnCommitments: { length: 2 },
        externalContract: {
          inner: { artifact: { abi: [{ name: 'readEach', writesState: false }] } },
        },
      }),
    ];

    expect(groupOwnsInBlockReturnEvent(groups, 0)).toBe(false);
    expect(groupOwnsInBlockReturnEvent(groups, 1)).toBe(false);
    const placements = packTailReturnPlacements(groups, () => 0, [
      { identity: 'external-call:1:0', categoryId: 'shared' },
      { identity: 'external-call:1:1', categoryId: 'shared' },
    ], 'other');
    expect(placements.get('external-call:1:0')).toBe(8);
    expect(placements.get('external-call:1:1')).toBe(9);
    expect(returnWitnessOutputIndices(groups)).toEqual(new Set([8, 9]));
  });

  it('reserves loop-return width so a second meceTags slot is not the next occupant', () => {
    const groups: PhysicalReturnGroup[] = [
      group({
        categoryId: 'md',
        functionName: 'meceTags',
        logicalFunctionName: 'meceTags',
        returnOutputIndex: 34,
        loopReturnCommitments: { length: 2 },
        externalContract: { inner: { artifact: { abi: [{ name: 'meceTags', writesState: false }] } } },
      }),
      group({
        categoryId: 'md',
        functionName: 'userRegistered',
        logicalFunctionName: 'userRegistered',
        returnOutputIndex: 35,
        externalContract: { inner: { artifact: { abi: [{ name: 'userRegistered', writesState: false }] } } },
      }),
    ];
    const assigned = assignPhysicalReturnIndices(groups, () => -1);
    expect(assigned.get(0)).toBe(34);
    expect(assigned.get(1)).toBe(36);
  });

  it('keeps view tails after a token block even when blockInputs is shorter than blockSize', () => {
    const groups: PhysicalReturnGroup[] = [
      group({
        categoryId: 'ft',
        functionName: 'transferFrom',
        returnEventInBlock: true,
        returnOutputIndex: 29,
        blockLayout: tokenLayout,
        blockInputs: { length: 6 },
        externalContract: transferFromContract,
      }),
      group({
        categoryId: 'md',
        functionName: 'arbitratorRegistered',
        logicalFunctionName: 'arbitratorRegistered',
        returnOutputIndex: 30,
        externalContract: {
          inner: { artifact: { abi: [{ name: 'arbitratorRegistered', writesState: false }] } },
        },
      }),
    ];
    const assigned = assignPhysicalReturnIndices(groups, (categoryId) => (
      categoryId === 'ft' ? 26 : -1
    ));
    expect(assigned.get(0)).toBe(33);
    expect(assigned.get(1)).toBe(34);
  });

  it('counts a sparse participant master and its data NFTs without optional block metadata', () => {
    const groups: PhysicalReturnGroup[] = [
      group({
        categoryId: 'view',
        returnOutputIndex: 36,
      }),
      group({
        categoryId: 'late-participant',
        dataNftUtxos: { length: 1 },
      }),
    ];

    const assigned = assignPhysicalReturnIndices(groups, (categoryId) => (
      categoryId === 'late-participant' ? 36 : -1
    ));

    expect(assigned.get(0)).toBe(38);
  });

  it('rebinds stale return witnesses from final output content without moving valid witnesses', () => {
    const tail = (category: string, commitment: string) => ({
      to: Uint8Array.of(0x51),
      token: { category, nft: { capability: 'none' as const, commitment } },
    });
    const outputs = Array.from({ length: 50 }, () => ({ to: Uint8Array.of(0x51) }));
    outputs[34] = tail('state', '01');
    outputs[35] = tail('state', '02');
    outputs[36] = {
      to: new Uint8Array(35),
      token: { category: 'identity', nft: { capability: 'none' as const, commitment: '53434944' } },
    };
    outputs[38] = tail('token', '00');
    outputs[47] = tail('state', '64');
    outputs[48] = tail('token', '00');
    outputs[49] = tail('token', '00');

    const assigned = matchMaterializedReturnOutputs(outputs, [
      { groupIndex: 0, categoryId: 'state', commitment: '01', currentIndex: 34 },
      { groupIndex: 1, categoryId: 'state', commitment: '02', currentIndex: 35 },
      { groupIndex: 6, categoryId: 'state', commitment: '64', currentIndex: 36 },
      { groupIndex: 9, categoryId: 'token', commitment: '00', currentIndex: 37 },
      { groupIndex: 10, categoryId: 'token', commitment: '00', currentIndex: 38 },
    ]);

    expect([...assigned]).toEqual([
      [0, 34], [1, 35], [10, 38], [6, 47], [9, 48],
    ]);
  });

  it('finds a participant block colliding with a dynamic-output band by layout rather than function name', () => {
    const groups: PhysicalReturnGroup[] = [
      group({
        categoryId: 'state-owner',
        blockLayout: { blockSize: 8, slots: [] },
        valueChunkOutputCount: 2,
      }),
      group({
        categoryId: 'independent-writer',
        functionName: 'arbitraryWriter',
        blockLayout: { blockSize: 5, slots: [] },
      }),
    ];

    expect(collidingParticipantGroupIndex(
      groups,
      (categoryId) => categoryId === 'state-owner' ? 12 : 20,
      { start: 20, end: 21 },
    )).toBe(1);
  });

  it('keeps whitelist publish band collision on the natural FakeToken start, not the slid public band', () => {
    // publishJobPost + whitelistWorkers: plannedWidth 2. Sliding the public band past FakeToken
    // (15 → 23) hid the collision from minting swap and left empty chunks at 23-24.
    const groups: PhysicalReturnGroup[] = [
      group({
        categoryId: 'marketplace-data',
        functionName: 'publishJobEvent',
        blockLayout: { blockSize: 5, slots: [] },
        valueChunkOutputCount: 2,
      }),
      group({
        categoryId: 'fake-token',
        functionName: 'transferFrom',
        blockLayout: { blockSize: 8, slots: [] },
      }),
    ];
    const findMinting = (categoryId: string): number => (
      categoryId === 'marketplace-data' ? 6 : 15
    );
    const plannedWidth = 2;
    expect(legacyLiveValueChunkBandWidth({ plannedWidth })).toBe(2);
    expect(valueChunkBandWidth({ planned: plannedWidth })).toBe(3);
    expect(valueChunkBandWidth({ minimum: 1, planned: plannedWidth })).toBe(2);
    const natural = legacyComputePublishValueChunkBand({
      start: 15, plannedWidth, liveWidth: legacyLiveValueChunkBandWidth({ plannedWidth }),
    });
    expect(natural).toEqual({ start: 15, end: 16, nNew: 2 });
    expect(collidingParticipantGroupIndex(groups, findMinting, natural!)).toBe(1);
    const slid = legacyComputePublishValueChunkBand({
      start: 15 + 8, plannedWidth, liveWidth: legacyLiveValueChunkBandWidth({ plannedWidth }),
    });
    expect(slid).toEqual({ start: 23, end: 24, nNew: 2 });
    expect(collidingParticipantGroupIndex(groups, findMinting, slid!)).toBe(-1);
  });

  it('reserves output-only slots when a physical block has fewer token inputs than coordinates', () => {
    expect(physicalParticipantWidth(group({
      categoryId: 'sparse-writer',
      dataNftUtxos: { length: 1 },
      blockInputs: { length: 2 },
      blockLayout: {
        blockSize: 3,
        slots: [{ kind: 'returnEvent', offset: 3 }],
      },
    }))).toBe(4);
  });

  it('detects a lane collision in output-only participant coordinates', () => {
    expect(participantSpanOverlapsLane(18, 9, { start: 26, endExclusive: 28 })).toBe(true);
    expect(participantSpanOverlapsLane(18, 5, { start: 26, endExclusive: 28 })).toBe(false);
    expect(participantSpanOverlapsLane(28, 9, { start: 26, endExclusive: 28 })).toBe(false);
  });

  it('includes an in-block return slid past a dynamic output band in materialized width', () => {
    expect(materializedParticipantWidth(group({
      categoryId: 'writer',
      returnEventInBlock: true,
      blockLayout: {
        blockSize: 3,
        slots: [{ kind: 'returnEvent', offset: 2 }],
      },
    }), 24, { start: 20, end: 26 })).toBe(4);
  });

  it('gathers serialized tail funders next to a colliding block without adding inputs', () => {
    const input = (txid: string, token = false) => ({
      txid, vout: 0, ...(token ? { token: {} } : {}),
    });
    const inputs = [
      input('writer-master', true), input('writer-data', true), input('funder-a'),
      input('later-master', true), input('funder-b'), input('funder-c'),
    ];
    const funders = new Set(['funder-a:0', 'funder-b:0', 'funder-c:0']);

    expect(gatherContiguousPlainFunders(inputs, funders, 2, 3)).toBe(3);
    expect(inputs).toHaveLength(6);
    expect(inputs.slice(2, 5).map(({ txid }) => txid)).toEqual([
      'funder-a', 'funder-c', 'funder-b',
    ]);
    expect(inputs[5].txid).toBe('later-master');
  });

  it('does not use a token-free P2SH covenant input as output-only block funding', () => {
    const input = (txid: string, lock: Uint8Array, token = false) => ({
      txid,
      vout: 0,
      ...(token ? { token: {} } : {}),
      unlocker: { generateLockingBytecode: () => lock },
    });
    const p2sh = new Uint8Array([0xaa, 0x20, ...new Uint8Array(32), 0x87]);
    const p2pkh = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20), 0x88, 0xac]);
    const inputs = [
      input('writer-master', p2sh, true),
      input('covenant-participant', p2sh),
      input('funder-a', p2pkh),
      input('funder-b', p2pkh),
    ];

    expect(gatherContiguousPlainFunders(
      inputs,
      new Set(['funder-a:0', 'funder-b:0']),
      1,
      2,
    )).toBe(2);
    expect(inputs.slice(1, 3).map(({ txid }) => txid)).toEqual(['funder-b', 'funder-a']);
    expect(inputs[3].txid).toBe('covenant-participant');
  });

  it('gives a shared physical group the in-block slot when functionName writes state', () => {
    const groups: PhysicalReturnGroup[] = [
      group({
        categoryId: 'ft',
        functionName: 'transferFrom',
        logicalFunctionName: 'balanceOf',
        returnEventInBlock: true,
        fusedReturnGroupIndex: 0,
        blockLayout: tokenLayout,
        externalContract: {
          inner: {
            artifact: {
              abi: [
                { name: 'balanceOf', writesState: false, outputs: [{ type: 'uint256' }] },
                { name: 'transferFrom', writesState: true, outputs: [{ type: 'bool' }] },
              ],
            },
          },
        },
      }),
    ];
    expect(groupOwnsInBlockReturnEvent(groups, 0)).toBe(true);
    expect(logicalReturnGroupIndex(groups, 0)).toBe(0);
  });

  it('gives a standalone proxy-dispatched view its declared in-block slot', () => {
    const groups: PhysicalReturnGroup[] = [
      group({
        categoryId: 'state-holder',
        functionName: '__forward',
        logicalFunctionName: 'readFlag',
        returnEventInBlock: true,
        blockLayout: tokenLayout,
        externalContract: {
          inner: {
            artifact: {
              abi: [
                { name: '__forward', writesState: true },
                { name: 'readFlag', writesState: false, outputs: [{ type: 'bool' }] },
              ],
            },
          },
        },
      }),
    ];
    expect(groupOwnsInBlockReturnEvent(groups, 0)).toBe(true);
    expect(assignPhysicalReturnIndices(groups, (categoryId) => (
      categoryId === 'state-holder' ? 4 : -1
    )).get(0)).toBe(11);
  });

  it('packs view tails after a writer in-block slot past master+blockSize', () => {
    const groups: PhysicalReturnGroup[] = [
      group({
        categoryId: 'md',
        functionName: '__forward',
        logicalFunctionName: 'arbitratorRegistered',
        returnOutputIndex: 34,
        externalContract: {
          inner: { artifact: { abi: [{ name: 'arbitratorRegistered', writesState: false }] } },
        },
      }),
      group({
        categoryId: 'md',
        functionName: '__forward',
        logicalFunctionName: 'meceTags',
        returnOutputIndex: 35,
        loopReturnCommitments: { length: 2 },
        externalContract: {
          inner: { artifact: { abi: [{ name: 'meceTags', writesState: false }] } },
        },
      }),
      group({
        categoryId: 'ft',
        functionName: 'transferFrom',
        returnEventInBlock: true,
        returnOutputIndex: 33,
        blockLayout: tokenLayout,
        blockInputs: { length: 8 },
        externalContract: transferFromContract,
      }),
      group({
        categoryId: 'md',
        functionName: '__forward',
        logicalFunctionName: 'userRegistered',
        returnOutputIndex: 36,
        externalContract: {
          inner: { artifact: { abi: [{ name: 'userRegistered', writesState: false }] } },
        },
      }),
    ];
    const findMinting = (categoryId: string): number => (categoryId === 'ft' ? 26 : -1);
    const assigned = assignPhysicalReturnIndices(groups, findMinting);
    expect(assigned.get(2)).toBe(33);
    expect(assigned.get(0)).toBe(34);
    expect(assigned.get(1)).toBe(35);
    expect(assigned.get(3)).toBe(37);
    const packed = packTailReturnPlacements(groups, findMinting, [
      { identity: 'external-call:0:0', categoryId: 'md' },
      { identity: 'external-call:1:0', categoryId: 'md' },
      { identity: 'external-call:1:1', categoryId: 'md' },
      { identity: 'external-call:3:0', categoryId: 'md' },
      { identity: 'external-call:2:0', categoryId: 'ft' },
    ], 'ft');
    expect(packed.get('external-call:0:0')).toBe(34);
    expect(packed.get('external-call:1:0')).toBe(35);
    expect(packed.get('external-call:1:1')).toBe(36);
    expect(packed.get('external-call:3:0')).toBe(37);
    expect(packed.has('external-call:2:0')).toBe(false);
  });

  it('keeps trailing INSERT predecessors inside the token occupancy so view tails start after P\'', () => {
    const groups: PhysicalReturnGroup[] = [
      group({
        categoryId: 'md',
        functionName: '__forward',
        logicalFunctionName: 'arbitratorRegistered',
        returnOutputIndex: 34,
        externalContract: {
          inner: { artifact: { abi: [{ name: 'arbitratorRegistered', writesState: false }] } },
        },
      }),
      group({
        categoryId: 'ft',
        functionName: 'transferFrom',
        returnEventInBlock: true,
        returnOutputIndex: 33,
        blockLayout: tokenLayout,
        blockInputs: { length: 8 },
        batchPredecessorOutputs: [{ outputBlockSlot: 8 }],
        externalContract: transferFromContract,
      }),
    ];
    const findMinting = (categoryId: string): number => (categoryId === 'ft' ? 26 : -1);
    const assigned = assignPhysicalReturnIndices(groups, findMinting);
    expect(assigned.get(1)).toBe(33);
    expect(assigned.get(0)).toBe(35);
    const packed = packTailReturnPlacements(groups, findMinting, [
      { identity: 'external-call:0:0', categoryId: 'md' },
    ], 'ft');
    expect(packed.get('external-call:0:0')).toBe(35);
    expect(assignedTailEnd(groups, assigned)).toBe(35);
  });

  it('slides PredOut after view tails that occupy master+blockSize', () => {
    expect(predOutBaseAfterOccupancy({
      master: 25, blockSize: 8, jobEventsEnd: 24, viewTailStart: 33, viewTailEnd: 34,
    })).toBe(35);
    expect(predOutBaseAfterOccupancy({
      master: 26, blockSize: 8, jobEventsEnd: 23, viewTailStart: 34, viewTailEnd: 35,
    })).toBe(36);
    expect(predOutBaseAfterOccupancy({
      master: 26, blockSize: 8, viewTailStart: 30, viewTailEnd: 31,
    })).toBe(34);
    expect(predOutBaseAfterOccupancy({ master: 26, blockSize: 8 })).toBe(34);
  });

  it('resolves INSERT PredOut onto master+blockSize instead of a 1:1 entry slot', () => {
    expect(resolveAbsolutePredOut(4n, 26, 8)).toBe(34n);
    expect(resolveAbsolutePredOut(8n, 26, 8)).toBe(34n);
    expect(resolveAbsolutePredOut(9n, 26, 8)).toBe(35n);
    expect(resolveAbsolutePredOut(4n, 26, 8, 34)).toBe(34n);
    expect(resolveAbsolutePredOut(8n, 26, 8, 34)).toBe(34n);
    expect(resolveAbsolutePredOut(34n, 26, 8, 34)).toBe(34n);
    expect(resolveAbsolutePredOut(-1n, 26, 8, 34)).toBe(-1n);
    expect(resolveAbsolutePredOut(-2n, 26, 8)).toBe(-2n);
  });

  it('syncs drifted PredOut witnesses onto master + declared batch predecessor slots', () => {
    // post job 1: unlocker PredOut=28 while P' was reasserted at master+8=27.
    let relocated = 28;
    const refreshed: Record<string, bigint>[] = [];
    const updates = syncDeclaredBatchPredOutWitnesses({
      masterIndex: 19,
      batchPredecessorOutputs: [{ outputBlockSlot: 8 }],
      internalArgs: {
        __internal__vmapBatchPredOut_0: 28n,
        __internal__vmapBatchPredOut_1: -1n,
        __internal__vmapBatchPredOut_2: -1n,
      },
      refreshInternalArgs: (next) => {
        refreshed.push(next as Record<string, bigint>);
      },
      setRelocatedPredOutBase: (absolute) => {
        relocated = absolute;
      },
    });
    expect(updates).toEqual({ __internal__vmapBatchPredOut_0: 27n });
    expect(refreshed).toEqual([{ __internal__vmapBatchPredOut_0: 27n }]);
    expect(relocated).toBe(27);
  });

  it('places batch PredOut only at master + declared slot', () => {
    const balancesLock = hexToBin(`aa20${'99'.repeat(32)}87`);
    const allowancesLock = hexToBin(`aa20${'88'.repeat(32)}87`);
    const predCommit = `${'00'.repeat(32)}${'2e'.repeat(32)}`;
    const updateCommit = `${'e2'.repeat(32)}${'00'.repeat(32)}0000907b984f02ca30`;
    const outputs = Array.from({ length: 40 }, () => ({
      to: Uint8Array.of(0x51), amount: 1000n,
    }));
    const predecessors = [{
      outputBlockSlot: 8,
      lockingBytecode: balancesLock,
      commitment: predCommit,
    }];
    // Drifted master=4 would land P' at 12 — callers must gate on minting master.
    expect(reassertBatchPredecessorOutputsAtDeclaredSlots(outputs, 4, 'ft', predecessors)).toBe(1);
    expect(binToHex(outputs[12].to as Uint8Array)).toBe(binToHex(balancesLock));
    expect(reassertBatchPredecessorOutputsAtDeclaredSlots(outputs, 22, 'ft', predecessors)).toBe(1);
    expect(binToHex(outputs[30].to as Uint8Array)).toBe(binToHex(balancesLock));
    // Foreign-collection displace must not park the UPDATE before the minting master.
    outputs[12] = { to: Uint8Array.of(0x51), amount: 1000n };
    outputs[26] = {
      to: balancesLock,
      amount: 1200n,
      token: { category: 'ft', nft: { capability: 'mutable' as const, commitment: updateCommit } },
    };
    expect(reassertBatchPredecessorOutputsAtDeclaredSlots(outputs, 22, 'ft', [{
      outputBlockSlot: 4,
      lockingBytecode: allowancesLock,
      commitment: predCommit,
    }])).toBe(1);
    expect(outputs[12].to).toEqual(Uint8Array.of(0x51));
    expect(binToHex(outputs[26].to as Uint8Array)).toBe(binToHex(allowancesLock));
    // Displaced balances UPDATE lands after master, not at @12.
    const displaced = outputs.findIndex((output, index) => (
      index > 22 && output.to instanceof Uint8Array
      && binToHex(output.to) === binToHex(balancesLock)
      && String(output.token?.nft?.commitment ?? '').startsWith('e2')
    ));
    expect(displaced).toBeGreaterThan(22);
  });

  it('strips invalid surplus collection locks that inflate OUTPUTBYTECODE cardinality', () => {
    // post job 1: expected 3 balances nodes; a Marketplace pad reused the balances lock with `010000`.
    const balancesLock = hexToBin(`aa20${'99'.repeat(32)}87`);
    const validCommit = `${'2e'.repeat(32)}${'21'.repeat(32)}000010632d5ec76b05`;
    const fromUpdate = `${'e2'.repeat(32)}${'00'.repeat(32)}0000907b984f02ca30`;
    const predCommit = `${'00'.repeat(32)}${'2e'.repeat(32)}`;
    const outputs = Array.from({ length: 32 }, () => ({
      to: Uint8Array.of(0x51), amount: 1000n,
    }));
    const place = (index: number, commitment: string, category = 'ft'): void => {
      outputs[index] = {
        to: balancesLock,
        amount: 1200n,
        token: { category, nft: { capability: 'mutable' as const, commitment } },
      };
    };
    place(21, validCommit);
    place(23, fromUpdate);
    place(27, predCommit);
    place(28, '010000', 'marketplace');
    expect(stripSurplusInvalidCollectionLockOutputs(outputs, balancesLock, 'ft', 3)).toBe(1);
    expect(outputs[28].to).toEqual(Uint8Array.of(0x51));
    expect(outputs[28].token).toBeUndefined();
    expect(binToHex(outputs[21].to as Uint8Array)).toBe(binToHex(balancesLock));
    expect(binToHex(outputs[27].to as Uint8Array)).toBe(binToHex(balancesLock));
    expect(stripSurplusInvalidCollectionLockOutputs(outputs, balancesLock, 'ft', 3)).toBe(0);
    // Without keepIndices, never demote valid nodes even when plannedCount is too low.
    expect(stripSurplusInvalidCollectionLockOutputs(outputs, balancesLock, 'ft', 1)).toBe(0);
    expect(binToHex(outputs[21].to as Uint8Array)).toBe(binToHex(balancesLock));
    // Whitelist-shaped post two: a valid-looking duplicate UPDATE lands before the FakeToken block.
    place(12, fromUpdate);
    place(28, '010000', 'marketplace');
    const keep = new Set([21, 23, 27]);
    expect(stripSurplusInvalidCollectionLockOutputs(outputs, balancesLock, 'ft', 3, keep)).toBe(2);
    expect(outputs[12].to).toEqual(Uint8Array.of(0x51));
    expect(outputs[28].to).toEqual(Uint8Array.of(0x51));
    expect(binToHex(outputs[21].to as Uint8Array)).toBe(binToHex(balancesLock));
    expect(binToHex(outputs[23].to as Uint8Array)).toBe(binToHex(balancesLock));
    expect(binToHex(outputs[27].to as Uint8Array)).toBe(binToHex(balancesLock));
    // Inflated plannedCount (foreign entry candidates counted) must not leave the pre-block clone.
    place(12, fromUpdate);
    expect(stripSurplusInvalidCollectionLockOutputs(outputs, balancesLock, 'ft', 3, keep)).toBe(1);
    expect(outputs[12].to).toEqual(Uint8Array.of(0x51));
    // Pre-block pad @12 is outside FakeToken master@22 block; 1:1 restore must refuse it.
    expect(isOutsideTokenWriterBlock(12, 22, 8, [8])).toBe(true);
    expect(isOutsideTokenWriterBlock(24, 22, 8, [8])).toBe(false);
    expect(isOutsideTokenWriterBlock(26, 22, 8, [8])).toBe(false);
    expect(isOutsideTokenWriterBlock(30, 22, 8, [8])).toBe(false);
  });

  it('keeps balanced collection-entry identity fields from one declared owner', () => {
    const declaredLock = hexToBin(`aa20${'44'.repeat(32)}87`);
    const localLock = hexToBin(`aa20${'55'.repeat(32)}87`);
    const planned = selectBalancedEntryOutputIdentity({
      plannedCommitment: '11'.repeat(64),
      declaredLockingBytecode: declaredLock,
      declaredCategoryId: 'owner',
      embeddedCommitment: '010000',
      inputLockingBytecode: localLock,
      inputCategoryId: 'local',
    });
    expect(planned).toEqual({
      lockingBytecode: declaredLock,
      categoryId: 'owner',
      commitment: '11'.repeat(64),
      preservesEmbeddedEntry: false,
    });

    const preserved = selectBalancedEntryOutputIdentity({
      declaredLockingBytecode: declaredLock,
      declaredCategoryId: 'owner',
      embeddedCommitment: '22'.repeat(64),
      inputLockingBytecode: localLock,
      inputCategoryId: 'local',
    });
    expect(preserved).toEqual({
      lockingBytecode: localLock,
      categoryId: 'local',
      commitment: '22'.repeat(64),
      preservesEmbeddedEntry: true,
    });
  });

  it('removes malformed occupants of a declared collection lock without needing an insert predecessor', () => {
    const lock = hexToBin(`aa20${'66'.repeat(32)}87`);
    const validCommitment = `${'10'.repeat(32)}${'20'.repeat(32)}`;
    const outputs = [
      {
        to: lock,
        amount: 1200n,
        token: { category: 'owner', nft: { capability: 'mutable' as const, commitment: validCommitment } },
      },
      {
        to: lock,
        amount: 1200n,
        token: { category: 'foreign', nft: { capability: 'mutable' as const, commitment: '010000' } },
      },
    ];
    const stripped = new Set<number>();
    expect(stripInvalidCollectionLockOutputs(outputs, lock, 'owner', stripped)).toBe(1);
    expect(stripped).toEqual(new Set([1]));
    expect(binToHex(outputs[0].to as Uint8Array)).toBe(binToHex(lock));
    expect(outputs[1]).toEqual({ to: Uint8Array.of(0x51), amount: 1200n });
    expect(stripInvalidCollectionLockOutputs(outputs, lock, 'owner')).toBe(0);
  });

  it('uses the batch planner output slot instead of provisional return-tail occupancy', () => {
    expect(materializedPredOutBase({
      blockLayout: { blockSize: 8 },
      batchPredecessorOutputs: [{ outputBlockSlot: 8 }],
    }, 26)).toBe(34);
    expect(materializedPredOutBase({
      blockLayout: { blockSize: 8 },
      batchPredecessorOutputs: [{ outputBlockSlot: 10 }, { outputBlockSlot: 11 }],
    }, 26)).toBe(36);
    expect(materializedPredOutBase({ blockLayout: { blockSize: 8 } }, 26)).toBe(34);
    expect(materializedPredOutBase({
      blockLayout: { blockSize: 16, trailingBase: 6 },
      batchPredecessorOutputs: [{ outputBlockSlot: 6 }],
    }, 0)).toBe(6);
  });

  it('strips extra own-category none-cap tails outside event and return slots', () => {
    const outputs = [
      { token: { category: 'ft', nft: { capability: 'minting', commitment: '' } } },
      { to: Uint8Array.of(0x51), token: { category: 'ft', nft: { capability: 'none', commitment: '51' } } },
      { to: Uint8Array.of(0x51), token: { category: 'ft', nft: { capability: 'none', commitment: '0d0c' } } },
      { to: Uint8Array.of(0x51), token: { category: 'md', nft: { capability: 'none', commitment: '51' } } },
      { token: { category: 'ft', nft: { capability: 'mutable', commitment: 'aa' } } },
    ];
    expect(constrainOwnCategoryImmutableOutputs(outputs, 'ft', new Set([1]))).toBe(0);
    expect(outputs[1].token?.nft?.capability).toBe('none');
    expect(outputs[2].token?.nft?.capability).toBe('none');
    expect(outputs[3].token?.category).toBe('md');
    expect(outputs[4].token?.nft?.capability).toBe('mutable');
    const eventLike = [
      { to: new Uint8Array([0xaa, 0x20]), token: { category: 'ft', nft: { capability: 'none', commitment: 'abcd' } } },
      { to: new Uint8Array([0xaa, 0x20]), token: { category: 'ft', nft: { capability: 'none', commitment: '534349440100' } } },
    ];
    expect(constrainOwnCategoryImmutableOutputs(eventLike, 'ft', new Set())).toBe(1);
    expect(eventLike[0].token).toBeUndefined();
    expect(eventLike[1].token?.nft?.commitment).toBe('534349440100');
  });

  it('rebases a proxy-delegated initializer PredOut from the impl master, not minting+implSize', () => {
    expect(resolveAbsolutePredOut(14n, 3, 14)).toBe(17n);
    expect(resolveAbsolutePredOut(14n, 3, 14, 14)).toBe(17n);
    expect(resolveAbsolutePredOut(17n, 3, 14, 14)).toBe(17n);
    expect(resolveAbsolutePredOut(15n, 3, 14)).toBe(18n);
    expect(groupLayoutBlockSize({
      compilerRoute: { abiFunction: { blockLayout: { blockSize: 14 } } },
    })).toBe(14);
    expect(groupLayoutBlockSize({
      blockLayout: { blockSize: 14 },
    })).toBe(14);
    expect(groupLayoutBlockSize({})).toBe(8);
    expect(groupLayoutTrailingBase({
      compilerRoute: { abiFunction: { blockLayout: { blockSize: 163, trailingBase: 99 } } },
    })).toBe(99);
    expect(resolveAbsolutePredOut(99n, 244, 99)).toBe(343n);
  });

  it('uses ABI blockLayout for a proxy delegate that has no kernel compilerRoute', () => {
    const initializeLayout = {
      blockSize: 14,
      slots: [
        { kind: 'master' as const, offset: 0 },
        { kind: 'dataNft' as const, offset: 1, nftIndex: 0 },
        { kind: 'dataNft' as const, offset: 2, nftIndex: 1 },
        { kind: 'entry' as const, offset: 3, slotIndex: 0, conditional: true },
        { kind: 'event' as const, offset: 11, slotIndex: 0, conditional: true },
      ],
    };
    expect(selectDelegateExecutionLayout([
      { callMode: 'delegatecall', blockLayout: initializeLayout },
    ])).toEqual(initializeLayout);
    expect(selectDelegateExecutionLayout([
      { callMode: 'call', blockLayout: initializeLayout },
      { callMode: 'delegatecall' },
    ])).toBeUndefined();
    expect(selectDelegateExecutionLayout([
      { callMode: 'delegatecall', compilerRoute: { abiFunction: { blockLayout: initializeLayout } } },
    ])).toEqual(initializeLayout);
    expect(selectDelegateExecutionLayout(
      [{ callMode: 'delegatecall', blockLayout: initializeLayout }],
      new Set([0]),
    )).toBeUndefined();
  });

  it('pins exact linear sorted-batch keys even when the layout slot is conditional', () => {
    expect(pinExactSortedBatchEntry({
      exact: true, conditionalLayoutSlot: true, linearSortedBatch: true,
    })).toBe(true);
    expect(pinExactSortedBatchEntry({
      exact: false, conditionalLayoutSlot: true, linearSortedBatch: true,
    })).toBe(true);
    expect(pinExactSortedBatchEntry({
      exact: true, conditionalLayoutSlot: true, linearSortedBatch: false,
    })).toBe(false);
    expect(pinExactSortedBatchEntry({
      exact: true, conditionalLayoutSlot: false, linearSortedBatch: false,
    })).toBe(true);
    expect(pinExactSortedBatchEntry({
      exact: false, conditionalLayoutSlot: true, linearSortedBatch: false,
    })).toBe(false);
  });

  it('does not treat a kernel linear string-mapping batch as a continuation writer', () => {
    const meceTags = {
      name: 'meceTags',
      signature: 'meceTags:mapping(string => string)',
      keyType: 'string',
      valueType: 'string',
      chunkableValue: true,
    };
    const initialize = {
      functionName: 'initialize',
      logicalFunctionName: 'initialize',
      stateLayout: { variables: [], dataNftCount: 0, commitmentLimit: 128, collections: [meceTags] },
      logicalArtifact: {
        messageBus: { convention: 'kernel-row-loop' as const },
        abi: [{
          name: 'initialize',
          inputs: [],
          entryAccesses: [{ collection: 'meceTags', keyParams: ['key'], operations: ['write'] as Array<'write'> }],
          sortedBatchInfo: [{
            collection: 'meceTags',
            slotIndices: [0, 1, 2, 3, 4, 5, 6, 7],
            linear: true,
          }],
        }],
      },
      compilerRoute: {
        abiFunction: {
          name: 'initialize',
          inputs: [],
          entryAccesses: [{ collection: 'meceTags', keyParams: ['key'], operations: ['write'] as Array<'write'> }],
          sortedBatchInfo: [{
            collection: 'meceTags',
            slotIndices: [0, 1, 2, 3, 4, 5, 6, 7],
            linear: true,
          }],
        },
      },
    };
    expect(groupChunkableValueWriteCollection(initialize)).toBe('meceTags');
    expect(groupOwnsLinearSortedBatch(initialize)).toBe(true);
    expect(selectChunkableValueWriteExecution([{ group: initialize, inputIndex: 3 }])).toBeUndefined();
    const registerUser = {
      functionName: 'registerUser',
      logicalFunctionName: 'registerUser',
      stateLayout: {
        variables: [], dataNftCount: 0, commitmentLimit: 128,
        collections: [{
          name: 'users',
          signature: 'users:mapping(address => User)',
          keyType: 'address',
          valueType: 'User',
          chunkableValue: true,
        }],
      },
      logicalArtifact: {
        messageBus: { convention: 'kernel-row-loop' as const },
        abi: [{
          name: 'registerUser',
          inputs: [{ name: '__internal__vmapBatchTrailingCount', type: 'bigint' }],
          entryAccesses: [{
            collection: 'users', keyParams: ['sender:msg.sender'], operations: ['read', 'write'] as Array<'read' | 'write'>,
          }],
          entryLoopWrites: ['users'],
        }],
      },
      compilerRoute: {
        abiFunction: {
          name: 'registerUser',
          inputs: [{ name: '__internal__vmapBatchTrailingCount', type: 'bigint' }],
          entryAccesses: [{
            collection: 'users', keyParams: ['sender:msg.sender'], operations: ['read', 'write'] as Array<'read' | 'write'>,
          }],
          entryLoopWrites: ['users'],
        },
      },
    };
    expect(groupChunkableValueWriteCollection(registerUser)).toBe('users');
    expect(groupOwnsLinearSortedBatch(registerUser)).toBe(false);
    expect(selectChunkableValueWriteExecution([{ group: registerUser, inputIndex: 3 }])).toBeUndefined();
    expect(skipCompilerOwnedInBlockCollectionStrip({
      preserveBlockLayoutWidth: true, pinnedEntryCount: 8,
    })).toBe(true);
    expect(skipCompilerOwnedInBlockCollectionStrip({
      preserveBlockLayoutWidth: true, pinnedEntryCount: 0,
    })).toBe(false);
  });

  it('falls back to nested-callee sentinels for a vmap-batch slot with no planned batch', () => {
    expect(vmapBatchWitnessFallback('__internal__vmapBatchTrailingCount')).toBe(0n);
    expect(vmapBatchWitnessFallback('__internal__vmapBatchProof_0')).toBe(-1n);
    expect(vmapBatchWitnessFallback('__internal__vmapBatchPredOut_0')).toBe(-1n);
    expect(vmapBatchWitnessFallback('__internal__vmapBatchRank_0')).toBe(0n);
    expect(vmapBatchWitnessFallback('__internal__vmapBatchSlot_0')).toEqual(new Uint8Array(32));
    expect(vmapBatchWitnessFallback('__internal__vmapBatchNext_0')).toEqual(new Uint8Array(32));
    expect(vmapBatchWitnessFallback('__internal__vmapBatchRows_users')).toEqual(new Uint8Array());
    expect(vmapBatchWitnessFallback('__internal__proxyMasterIndex')).toBeUndefined();
  });

  it('overwrites a balanced-block pad at a layout offset instead of appending past it', () => {
    const pad = { to: Uint8Array.of(0x51), amount: 1000n };
    const outputs = Array.from({ length: 17 }, () => pad);
    const minted = {
      to: Uint8Array.from([0xaa, 0x20]),
      amount: 1200n,
      token: { amount: 0n, category: 'ab', nft: { capability: 'mutable' as const, commitment: '01' } },
    };
    assignBalancedOutputAtOffset(outputs, 7, minted);
    expect(outputs).toHaveLength(17);
    expect(outputs[7]).toBe(minted);
    expect(outputs[6]).toBe(pad);
    expect(outputs[8]).toBe(pad);
    assignBalancedOutputAtOffset(outputs, 17, minted);
    expect(outputs).toHaveLength(18);
    expect(outputs[17]).toBe(minted);
    expect(() => assignBalancedOutputAtOffset(outputs, 20, minted)).toThrow(/past the current length/);
  });

  it('lets a fused writer overwrite view leftover PredOuts', () => {
    const inherited = inheritWriterBatchWitnesses(
      {
        __internal__vmapBatchPredOut_0: 4n,
        __internal__vmapBatchPredOut_1: 4n,
        __internal__vmapBatchPredOut_2: 4n,
        __internal__returnOutputIdx: 33n,
      },
      {
        __internal__vmapBatchPredOut_0: 8n,
        __internal__vmapBatchPredOut_1: -1n,
        __internal__vmapBatchPredOut_2: -1n,
        __internal__vmapBatchTrailingCount: 1n,
      },
    );
    expect(inherited.__internal__vmapBatchPredOut_0).toBe(8n);
    expect(inherited.__internal__vmapBatchPredOut_1).toBe(-1n);
    expect(inherited.__internal__vmapBatchPredOut_2).toBe(-1n);
    expect(inherited.__internal__vmapBatchTrailingCount).toBe(1n);
    expect(inherited.__internal__returnOutputIdx).toBe(33n);
  });

  it('promotes a fused writer batch plan onto the physical read carrier', () => {
    const predecessor = { outputBlockSlot: 8 };
    const plannedInsert = { blockSlot: 6, outputBlockSlot: 9 };
    const entryLock = new Uint8Array([0xaa, 0x20]);
    const carrier = {
      internalArgs: {
        __internal__vmapBatchPredOut_0: -1n,
        __internal__returnOutputIdx: 33n,
      },
      compilerRoute: {
        internalArgs: { __internal__vmapBatchSlot_0: new Uint8Array(32) as bigint | Uint8Array },
      },
      plannedEntryInserts: [] as Array<{ blockSlot: number; outputBlockSlot: number }>,
      plannedEntryInsertHandles: [] as number[],
      relativeOutputInternalArgs: [] as string[],
      batchPredecessorOutputs: [] as Array<{ outputBlockSlot: number }>,
      batchEntryLockingBytecodes: new Map<number, Uint8Array>(),
      batchEntryCommitments: new Map<number, string>(),
    };
    const writer = {
      internalArgs: {
        __internal__vmapBatchPredOut_0: 8n,
        __internal__vmapBatchTrailingCount: 1n,
      },
      compilerRoute: {
        internalArgs: { __internal__vmapBatchNext_0: new Uint8Array([1]) as bigint | Uint8Array },
      },
      plannedEntryInserts: [plannedInsert],
      plannedEntryInsertHandles: [17],
      relativeOutputInternalArgs: ['__internal__vmapBatchPredOut_0'],
      batchPredecessorOutputs: [predecessor],
      batchEntryLockingBytecodes: new Map([[6, entryLock]]),
      batchEntryCommitments: new Map([[6, '01']]),
    };

    expect(inheritWriterBatchPlan<
    bigint | Uint8Array,
    { outputBlockSlot: number },
    { blockSlot: number; outputBlockSlot: number }
    >(carrier, writer)).toBe(true);
    expect(carrier.plannedEntryInserts).toBe(writer.plannedEntryInserts);
    expect(carrier.plannedEntryInsertHandles).toBe(writer.plannedEntryInsertHandles);
    expect(carrier.relativeOutputInternalArgs).toEqual(writer.relativeOutputInternalArgs);
    expect(carrier.batchPredecessorOutputs).toEqual(writer.batchPredecessorOutputs);
    expect(carrier.batchEntryLockingBytecodes).toEqual(writer.batchEntryLockingBytecodes);
    expect(carrier.batchEntryCommitments).toEqual(writer.batchEntryCommitments);
    expect(carrier.internalArgs).toMatchObject({
      __internal__vmapBatchPredOut_0: 8n,
      __internal__vmapBatchTrailingCount: 1n,
      __internal__returnOutputIdx: 33n,
      __internal__vmapBatchNext_0: new Uint8Array([1]),
    });
    expect(carrier.compilerRoute.internalArgs).toMatchObject({
      __internal__vmapBatchPredOut_0: 8n,
      __internal__vmapBatchTrailingCount: 1n,
      __internal__vmapBatchNext_0: new Uint8Array([1]),
    });
  });

  it('rejects mixing distinct writer batch plans on one physical carrier', () => {
    const carrier = {
      plannedEntryInserts: [{ blockSlot: 2, outputBlockSlot: 8 }],
      batchPredecessorOutputs: [{ outputBlockSlot: 8 }],
    };
    const writer = {
      plannedEntryInserts: [{ blockSlot: 3, outputBlockSlot: 9 }],
      batchPredecessorOutputs: [{ outputBlockSlot: 9 }],
    };
    expect(() => inheritWriterBatchPlan(carrier, writer)).toThrow(/conflicting sorted-batch/);
  });

  it('relocates only the planned INSERT PredOut and keeps leftover UPDATE sentinels', () => {
    expect(remapInsertPredOuts([
      { name: '__internal__vmapBatchPredOut_0', value: 8n },
      { name: '__internal__vmapBatchPredOut_1', value: 4n },
      { name: '__internal__vmapBatchPredOut_2', value: 4n },
    ], 34n, 1, 8n)).toEqual({
      __internal__vmapBatchPredOut_0: 34n,
      __internal__vmapBatchPredOut_1: -1n,
      __internal__vmapBatchPredOut_2: -1n,
    });
    expect(remapInsertPredOuts([
      { name: '__internal__vmapBatchPredOut_0', value: -1n },
      { name: '__internal__vmapBatchPredOut_2', value: 8n },
    ], 34n, 1, 8n)).toEqual({
      __internal__vmapBatchPredOut_2: 34n,
    });
  });

  it('treats OP_TRUE view-true tails as PredOut holes', () => {
    expect(isPredOutReusableHole({
      to: Uint8Array.of(0x51),
      token: { nft: { capability: 'none', commitment: '51' } },
    })).toBe(true);
    expect(isPredOutReusableHole({
      to: Uint8Array.of(0x51),
      token: { nft: { capability: 'none', commitment: '' } },
    })).toBe(true);
    expect(isPredOutReusableHole({
      to: new Uint8Array(35),
      token: { nft: { capability: 'mutable', commitment: '9c63' } },
    })).toBe(false);
  });

  it('moves a sorted-batch predecessor clone to its compiler-declared output slot', () => {
    const lock = new Uint8Array([0xaa, 0x20, 0x87]);
    const predecessor = {
      to: lock,
      amount: 1200n,
      token: {
        amount: 0n,
        category: 'token',
        nft: { capability: 'mutable' as const, commitment: 'abcd' },
      },
    };
    const outputs = Array.from({ length: 12 }, () => ({
      to: Uint8Array.of(0x51),
      amount: 1000n,
    }));
    outputs[8] = {
      to: Uint8Array.of(0x51),
      amount: 800n,
      token: {
        amount: 0n,
        category: 'token',
        nft: { capability: 'none' as const, commitment: '01' },
      },
    };
    outputs[9] = predecessor;

    expect(reassertBatchPredecessorOutputsAtDeclaredSlots(outputs, 0, 'token', [{
      outputBlockSlot: 8,
      lockingBytecode: lock,
      commitment: 'abcd',
    }])).toBe(1);
    expect(outputs[8]).toBe(predecessor);
    expect(outputs[9].token).toBeUndefined();
    expect(outputs[9].to).toEqual(Uint8Array.of(0x51));
  });

  it('materializes a predecessor over its same-owner empty entry placeholder', () => {
    const lock = new Uint8Array([0xaa, 0x20, 0x87]);
    const outputs = Array.from({ length: 9 }, () => ({
      to: Uint8Array.of(0x51),
      amount: 1000n,
    }));
    outputs[8] = {
      to: lock,
      amount: 900n,
      token: {
        amount: 0n,
        category: 'token',
        nft: { capability: 'mutable' as const, commitment: '00'.repeat(64) },
      },
    };

    expect(reassertBatchPredecessorOutputsAtDeclaredSlots(outputs, 0, 'token', [{
      outputBlockSlot: 8,
      lockingBytecode: lock,
      commitment: 'abcd',
    }])).toBe(1);
    expect(outputs[8]).toEqual({
      to: lock,
      amount: 900n,
      token: {
        amount: 0n,
        category: 'token',
        nft: { capability: 'mutable', commitment: 'abcd' },
      },
    });
  });

  it('does not overwrite an unrelated mutable output at a predecessor coordinate', () => {
    const lock = new Uint8Array([0xaa, 0x20, 0x87]);
    const occupant = {
      to: lock,
      amount: 900n,
      token: {
        amount: 0n,
        category: 'token',
        nft: { capability: 'mutable' as const, commitment: '1234' },
      },
    };
    const outputs = Array.from({ length: 9 }, () => ({
      to: Uint8Array.of(0x51),
      amount: 1000n,
    }));
    outputs[8] = occupant;

    expect(reassertBatchPredecessorOutputsAtDeclaredSlots(outputs, 0, 'token', [{
      outputBlockSlot: 8,
      lockingBytecode: lock,
      commitment: 'abcd',
    }])).toBe(0);
    expect(outputs[8]).toBe(occupant);
  });

  it('displaces a same-category foreign-collection lock at a planned predecessor slot', () => {
    // FakeToken.transferFrom: balances P' (predOut) vs allowances share categoryId.
    // Occupancy can leave the allowances entry lock on the balances PredOut coordinate.
    const balancesLock = hexToBin(`aa20${'11'.repeat(32)}87`);
    const allowancesLock = hexToBin(`aa20${'22'.repeat(32)}87`);
    const outputs = Array.from({ length: 30 }, () => ({
      to: Uint8Array.of(0x51),
      amount: 1000n,
    }));
    const foreignOccupant = {
      to: allowancesLock,
      amount: 1200n,
      token: {
        amount: 0n,
        category: 'token',
        nft: { capability: 'mutable' as const, commitment: 'aa'.repeat(64) },
      },
    };
    outputs[28] = foreignOccupant;

    expect(reassertBatchPredecessorOutputsAtDeclaredSlots(outputs, 19, 'token', [{
      outputBlockSlot: 9, // absolute 28 when master=19
      lockingBytecode: balancesLock,
      commitment: 'bb'.repeat(64),
    }])).toBe(1);
    expect(binToHex(outputs[28].to as Uint8Array)).toBe(binToHex(balancesLock));
    expect(outputs[28].token?.nft?.commitment).toBe('bb'.repeat(64));
    const displaced = outputs.find((output, index) => (
      index !== 28
      && output.to instanceof Uint8Array
      && binToHex(output.to) === binToHex(allowancesLock)
    ));
    expect(displaced?.token?.nft?.commitment).toBe('aa'.repeat(64));
  });

  it('restores an authoritative planned predecessor over its provisional same-owner node', () => {
    const lock = new Uint8Array([0xaa, 0x20, 0x87]);
    const outputs = Array.from({ length: 9 }, () => ({
      to: Uint8Array.of(0x51),
      amount: 1000n,
    }));
    outputs[8] = {
      to: lock,
      amount: 900n,
      token: {
        amount: 0n,
        category: 'token',
        nft: { capability: 'mutable' as const, commitment: '1234' },
      },
    };

    expect(reassertBatchPredecessorOutputsAtDeclaredSlots(outputs, 0, 'token', [{
      outputBlockSlot: 8,
      lockingBytecode: lock,
      commitment: 'abcd',
    }], true)).toBe(1);
    expect(outputs[8].token?.nft?.commitment).toBe('abcd');
  });

  it('does not pack a view tail onto the writer slot after a 22→26 rotate', () => {
    const groups: PhysicalReturnGroup[] = [
      group({
        categoryId: 'md',
        functionName: '__forward',
        logicalFunctionName: 'arbitratorRegistered',
        returnOutputIndex: 30,
        externalContract: {
          inner: { artifact: { abi: [{ name: 'arbitratorRegistered', writesState: false }] } },
        },
      }),
      group({
        categoryId: 'ft',
        functionName: 'transferFrom',
        returnEventInBlock: true,
        returnOutputIndex: 29,
        blockLayout: tokenLayout,
        blockInputs: { length: 10 },
        externalContract: transferFromContract,
      }),
    ];
    const findMinting = (categoryId: string): number => (categoryId === 'ft' ? 26 : -1);
    const assigned = assignPhysicalReturnIndices(groups, findMinting);
    expect(assigned.get(1)).toBe(33);
    expect(assigned.get(0)).toBe(36);
    const packed = packTailReturnPlacements(groups, findMinting, [
      { identity: 'external-call:0:0', categoryId: 'md' },
    ], 'ft');
    expect(packed.get('external-call:0:0')).toBe(36);
  });

  it('places loop parts on their assigned slots even when pending order is not width-major', () => {
    const groups: PhysicalReturnGroup[] = [
      group({
        categoryId: 'md',
        functionName: '__forward',
        logicalFunctionName: 'meceTags',
        returnOutputIndex: 36,
        loopReturnCommitments: { length: 2 },
        externalContract: {
          inner: { artifact: { abi: [{ name: 'meceTags', writesState: false }] } },
        },
      }),
      group({
        categoryId: 'md',
        functionName: '__forward',
        logicalFunctionName: 'userRegistered',
        returnOutputIndex: 37,
        externalContract: {
          inner: { artifact: { abi: [{ name: 'userRegistered', writesState: false }] } },
        },
      }),
    ];
    const packed = packTailReturnPlacements(groups, () => -1, [
      { identity: 'external-call:0:0', categoryId: 'md' },
      { identity: 'external-call:1:0', categoryId: 'md' },
      { identity: 'external-call:0:1', categoryId: 'md' },
    ], 'ft');
    expect(packed.get('external-call:0:0')).toBe(36);
    expect(packed.get('external-call:0:1')).toBe(37);
    expect(packed.get('external-call:1:0')).toBe(38);
  });

  it('packs view tails after a jobEvents mutable band without a token swap', () => {
    const jobEventsLock = new Uint8Array(35);
    jobEventsLock[0] = 0xaa;
    jobEventsLock[1] = 0x20;
    jobEventsLock[34] = 0x87;
    const jobsLock = new Uint8Array(35);
    jobsLock[0] = 0xaa;
    jobsLock[1] = 0x20;
    jobsLock[34] = 0x87;
    jobsLock[2] = 0x11;
    const outputs = Array.from({ length: 29 }, (_, index) => (
      index >= 20 && index <= 23
        ? { to: jobEventsLock, token: { nft: { capability: 'mutable' as const, commitment: '437265617465' } } }
        : index >= 26 && index <= 27
          ? { to: jobsLock, token: { nft: { capability: 'mutable' as const, commitment: '00' } } }
          : { to: Uint8Array.of(0x51), amount: 1000n }
    ));
    expect(lastCollidingMutableWriterIndex(outputs, [20, 21])).toBe(23);
    expect(lastCollidingMutableWriterIndex(outputs, [34, 35])).toBe(-1);
    const groups: PhysicalReturnGroup[] = [
      group({
        categoryId: 'md',
        functionName: '__forward',
        logicalFunctionName: 'arbitratorRegistered',
        returnOutputIndex: 20,
        externalContract: {
          inner: { artifact: { abi: [{ name: 'arbitratorRegistered', writesState: false }] } },
        },
      }),
      group({
        categoryId: 'md',
        functionName: '__forward',
        logicalFunctionName: 'meceTags',
        returnOutputIndex: 21,
        externalContract: {
          inner: { artifact: { abi: [{ name: 'meceTags', writesState: false }] } },
        },
      }),
    ];
    const assigned = assignPhysicalReturnIndices(groups, () => -1, 23);
    expect(assigned.get(0)).toBe(24);
    expect(assigned.get(1)).toBe(25);
    const packed = packTailReturnPlacements(groups, () => -1, [
      { identity: 'external-call:0:0', categoryId: 'md' },
      { identity: 'external-call:1:0', categoryId: 'md' },
    ], '', 23);
    expect(packed.get('external-call:0:0')).toBe(24);
    expect(packed.get('external-call:1:0')).toBe(25);
  });

  it('computes the publishJobEvent band from impl + live nNew, not planned view tails', () => {
    const lock = new Uint8Array(35);
    lock[0] = 0xaa; lock[1] = 0x20; lock[34] = 0x87;
    const outputs = Array.from({ length: 27 }, (_, index) => (
      index === 16 || index === 17
        ? { to: Uint8Array.of(0x51), token: { nft: { capability: 'none' as const, commitment: '51' } } }
        : { to: Uint8Array.of(0x76, 0xa9), amount: 1000n }
    ));
    expect(placeValueChunksOnBand(outputs, { start: 20, nNew: 6 }, [
      { commitment: '0001aa', lockingBytecode: lock, categoryId: 'md' },
      { commitment: '0101bb', lockingBytecode: lock, categoryId: 'md' },
    ], new Set([16, 17]))).toBe(2);
    expect(outputs[16]?.token?.nft?.commitment).toBe('51');
    expect(outputs[17]?.token?.nft?.commitment).toBe('51');
    expect(outputs[20]?.token?.nft?.commitment).toBe('0001aa');
    expect(outputs[21]?.token?.nft?.commitment).toBe('0101bb');
    expect(clampViewTailPlacement({
      planned: 29, packed: 26, band: { start: 20, end: 25 }, suffixStart: 26,
    })).toBe(16);
    expect(clampViewTailPlacement({
      planned: 16, packed: 26, band: { start: 20, end: 25 }, suffixStart: 26,
    })).toBe(16);
    expect(clampViewTailPlacement({
      planned: 17, packed: 27, band: { start: 20, end: 25 }, suffixStart: 26,
    })).toBe(17);
    expect(clampViewTailPlacement({
      planned: 16, packed: 26, band: { start: 20, end: 25 }, suffixStart: 26,
      tokenWriterPresent: true,
    })).toBe(16);
    expect(clampViewTailPlacement({
      planned: 36, packed: 36, tokenWriterPresent: true,
    })).toBe(36);
    expect(clampViewTailPlacement({
      planned: 20, packed: 26, band: { start: 20, end: 25 }, suffixStart: 26,
    })).toBe(16);
    const historyTails: PhysicalReturnGroup[] = [
      group({
        categoryId: 'md',
        functionName: 'arbitratorRegistered',
        returnOutputIndex: 16,
        blockLayout: { blockSize: 5, slots: [{ kind: 'master' as const, offset: 0 }] },
        blockInputs: { length: 11 },
        externalContract: {
          inner: { artifact: { abi: [{ name: 'arbitratorRegistered', writesState: false }] } },
        },
      }),
      group({
        categoryId: 'md',
        functionName: 'meceTags',
        returnOutputIndex: 17,
        externalContract: {
          inner: { artifact: { abi: [{ name: 'meceTags', writesState: false }] } },
        },
      }),
      group({
        categoryId: 'md',
        functionName: 'publishJobEvent',
        sharedGroupIndex: 0,
        valueChunkOutputCount: 6,
        blockInputs: { length: 11 },
      }),
    ];
    const kept = assignPhysicalReturnIndices(
      historyTails,
      (categoryId) => (categoryId === 'md' ? 12 : -1),
      -1,
      { band: { start: 20, end: 25 }, suffixStart: 26, tokenWriterPresent: false },
    );
    expect(kept.get(0)).toBe(16);
    expect(kept.get(1)).toBe(17);
    historyTails[0].returnOutputIndex = 26;
    historyTails[0].plannedReturnOutputIndex = 16;
    historyTails[1].returnOutputIndex = 27;
    historyTails[1].plannedReturnOutputIndex = 17;
    const keptAgain = assignPhysicalReturnIndices(
      historyTails,
      (categoryId) => (categoryId === 'md' ? 12 : -1),
      -1,
      { band: { start: 20, end: 25 }, suffixStart: 26, tokenWriterPresent: false },
    );
    expect(keptAgain.get(0)).toBe(16);
    expect(keptAgain.get(1)).toBe(17);
    historyTails[0].returnOutputIndex = 26;
    historyTails[0].plannedReturnOutputIndex = 29;
    historyTails[1].returnOutputIndex = 27;
    historyTails[1].plannedReturnOutputIndex = 30;
    const fromTokenPark = assignPhysicalReturnIndices(
      historyTails,
      (categoryId) => (categoryId === 'md' ? 12 : -1),
      -1,
      { band: { start: 20, end: 25 }, suffixStart: 26, tokenWriterPresent: false },
    );
    expect(fromTokenPark.get(0)).toBe(16);
    expect(fromTokenPark.get(1)).toBe(17);
    expect(viewTailOccupancyCap([17, 19], { start: 20, end: 25 })).toBe(-1);
    expect(viewTailOccupancyCap([20, 21], { start: 20, end: 25 })).toBe(25);
    expect(viewTailOccupancyCap([17, 20], { start: 20, end: 22 })).toBe(22);
    expect(viewTailOccupancyCap([17, 19])).toBe(-1);
    expect(legacyComputePublishValueChunkBand({ implIndex: -1, plannedWidth: 6 })).toBeUndefined();
    expect(scaledInputPreserveExclusiveEnd(5, 5)).toBe(25);
    expect(scaledEventOutputIndex(5, 5)).toBe(24);
    expect(chunkableWriterEventOutputIndex(15, 4)).toBe(19);
    expect(chunkableWriterEventOutputIndex(17)).toBe(21);
    expect(chunkableWriterEventOutputIndex(18)).toBe(22);
    expect(publishJobEventOutputIndex(18)).toBe(chunkableWriterEventOutputIndex(18));
    expect(isJobEventEmitCommitment(
      '005e1976a91447d9fe52d462741f418e9dd5efaa6ae7e7adb60088ac0000',
    )).toBe(true);
    expect(isJobEventEmitCommitment('00004cb42000437265617465')).toBe(false);
    expect(jobEventTypeOf([16, '', '', 0])).toBe(16);
    expect(jobEventTypeOf({ type_: 7n, address_: '', data_: '', timestamp_: 0n })).toBe(7);
    expect(encodeEmptyJobEventEmitCommitment(0, [7, '', '', 0])).toBe('0057000000');
    expect(encodeEmptyJobEventEmitCommitment(0n, [16n, new Uint8Array(), new Uint8Array(), 0n]))
      .toBe('0060000000');
    expect(isJobEventEmitCommitment('0057000000')).toBe(false);
    expect(isJobEventEmitCommitment('0060000000')).toBe(true);
    expect(emitDestCollidesPreservedInput({ token: { nft: { capability: 'minting' } } })).toBe(true);
    expect(emitDestCollidesPreservedInput({ token: { nft: { capability: 'mutable' } } })).toBe(true);
    expect(emitDestCollidesPreservedInput({ token: { nft: { capability: 'none' } } })).toBe(false);
    const mintingDest = Array.from({ length: 22 }, () => ({ to: Uint8Array.of(0x51), amount: 1000n }));
    mintingDest[14] = {
      to: Uint8Array.from([0xaa]),
      amount: 1200n,
      token: { amount: 0n, category: 'ee64', nft: { capability: 'none', commitment: '5343494401' } },
    };
    expect(placeChunkableWriterEventOutput(mintingDest, 14, {
      to: Uint8Array.from([0xaa, 0x21]),
      amount: 1200n,
      token: { amount: 0n, category: 'ee64', nft: { capability: 'none', commitment: '0060000000' } },
    }, { destInput: { token: { nft: { capability: 'minting' } } } })).toBe(false);
    expect(mintingDest[14]?.token?.nft?.commitment).toBe('5343494401');
    expect(isOverwritableEmitOccupant({
      token: { nft: { capability: 'mutable', commitment: '0057000000' } },
    })).toBe(true);
    expect(isOverwritableEmitOccupant({
      token: { nft: { capability: 'minting', commitment: '' } },
    })).toBe(false);
    expect(isMaterializedImmutableNftOutput({
      token: { nft: { capability: 'none', commitment: '005e1976a91447d9fe52d462' } },
    })).toBe(true);
    expect(isMaterializedImmutableNftOutput({
      token: { nft: { capability: 'none', commitment: hexToBin('005e1976a91447d9fe52d462') } },
    })).toBe(true);
    expect(isMaterializedImmutableNftOutput({
      token: { nft: { capability: 'none', commitment: '00'.repeat(32) } },
    })).toBe(false);
    expect(isMaterializedImmutableNftOutput({
      token: { nft: { capability: 'none', commitment: '5343494401' } },
    })).toBe(false);
    expect(isMaterializedImmutableNftOutput({
      token: { nft: { capability: 'mutable', commitment: '005e1976a91447d9fe52d462' } },
    })).toBe(false);
    const mintingOutputs: Array<{
      to?: Uint8Array; amount?: bigint;
      token?: { amount?: bigint; category?: string; nft?: { capability?: string; commitment?: string } };
    }> = [{
      to: Uint8Array.from([0xaa]),
      amount: 1200n,
      token: { amount: 0n, category: 'ee64', nft: { capability: 'minting', commitment: '' } },
    }];
    expect(placePublishJobEventOutput(mintingOutputs, 0, {
      to: Uint8Array.from([0xab]),
      amount: 1200n,
      token: { amount: 0n, category: 'ee64', nft: { capability: 'none', commitment: '005e1976a91447d9fe52d462' } },
    })).toBe(false);
    expect(mintingOutputs[0]?.token?.nft?.capability).toBe('minting');
    const emitOutputs: Array<{
      to?: Uint8Array; amount?: bigint;
      token?: { amount?: bigint; category?: string; nft?: { capability?: string; commitment?: string } };
    }> = Array.from({ length: 22 }, () => ({ to: Uint8Array.of(0x51), amount: 1000n }));
    emitOutputs[19] = {
      to: Uint8Array.from([0xaa, 0x20]),
      amount: 1200n,
      token: { amount: 0n, category: 'ee64', nft: { capability: 'mutable', commitment: '0057000000' } },
    };
    emitOutputs[20] = {
      to: Uint8Array.from([0xaa, 0x20]),
      amount: 1200n,
      token: { amount: 0n, category: 'ee64', nft: { capability: 'mutable', commitment: '0057000000' } },
    };
    const eventLock = Uint8Array.from([0xaa, 0x21]);
    expect(placePublishJobEventOutput(emitOutputs, 19, {
      to: eventLock,
      amount: 1200n,
      token: { amount: 0n, category: 'ee64', nft: { capability: 'none', commitment: '005e1976a91447d9fe52d462' } },
    }, { clearClonedStub: true })).toBe(true);
    expect(emitOutputs[19]?.token?.nft?.capability).toBe('none');
    expect(emitOutputs[19]?.token?.nft?.commitment).toBe('005e1976a91447d9fe52d462');
    expect(emitOutputs[20]?.token).toBeUndefined();
    const consumedPredecessor = [{
      to: Uint8Array.from([0xaa, 0x20]),
      amount: 1200n,
      token: {
        amount: 0n,
        category: 'ee64',
        nft: { capability: 'mutable', commitment: '11'.repeat(64) },
      },
    }];
    expect(placePublishJobEventOutput(consumedPredecessor, 0, {
      to: eventLock,
      amount: 1200n,
      token: { amount: 0n, category: 'ee64', nft: { capability: 'none', commitment: '005e1976a91447d9fe52d462' } },
    }, {
      consumedMutableOk: true,
      destInput: { token: { nft: { capability: 'mutable' } } },
    })).toBe(true);
    expect(consumedPredecessor[0]?.token?.nft?.capability).toBe('none');
    emitOutputs[21] = {
      to: Uint8Array.from([0xaa, 0x22]),
      amount: 1200n,
      token: {
        amount: 0n,
        category: 'ee64',
        nft: { capability: 'none', commitment: '005e1976a91447d9fe52d462741f418e9dd5efaa6ae7e7adb60088ac0000' },
      },
    };
    expect(placePublishJobEventOutput(emitOutputs, 19, {
      to: eventLock,
      amount: 1200n,
      token: { amount: 0n, category: 'ee64', nft: { capability: 'none', commitment: '005e1976a91447d9fe52d462' } },
    })).toBe(true);
    expect(emitOutputs[21]?.token?.nft?.commitment)
      .toBe('005e1976a91447d9fe52d462741f418e9dd5efaa6ae7e7adb60088ac0000');
    const emptyDest = Array.from({ length: 22 }, () => ({ to: Uint8Array.of(0x51), amount: 1000n }));
    emptyDest[21] = {
      to: Uint8Array.from([0xaa, 0x20, 0x7b]),
      amount: 1200n,
      token: { amount: 0n, category: 'ee643a16', nft: { capability: 'none', commitment: '' } },
    };
    expect(placePublishJobEventOutput(emptyDest, 21, {
      to: eventLock,
      amount: 1200n,
      token: { amount: 0n, category: 'ee643a16', nft: { capability: 'none', commitment: '' } },
    }, { refuseEmpty: true })).toBe(false);
    expect(emptyDest[21]?.token).toBeUndefined();
    const scidDest = Array.from({ length: 22 }, () => ({ to: Uint8Array.of(0x51), amount: 1000n }));
    scidDest[19] = {
      to: Uint8Array.from([0xaa, 0x20]),
      amount: 1200n,
      token: {
        amount: 0n,
        category: 'ee643a16',
        nft: { capability: 'none', commitment: '53434944010400000000000000' },
      },
    };
    expect(placePublishJobEventOutput(scidDest, 19, {
      to: eventLock,
      amount: 1200n,
      token: { amount: 0n, category: 'ee643a16', nft: { capability: 'none', commitment: '0060000000' } },
    }, { refuseEmpty: true })).toBe(true);
    expect(scidDest[19]?.token?.nft?.commitment).toBe('0060000000');
    expect(isJobEventEmitCommitment('')).toBe(false);
    expect(isJobEventEmitCommitment('00')).toBe(false);
    expect(isCreatedJobEventCommitment(
      '005e1976a91447d9fe52d462741f418e9dd5efaa6ae7e7adb60088ac0000',
    )).toBe(true);
    expect(isCreatedJobEventCommitment('005f1976a91471782e8159265ed94bd35b8e699c08f53a6f38c688ac0000')).toBe(false);
    const parked = Array.from({ length: 28 }, () => ({ to: Uint8Array.of(0x51), amount: 1000n }));
    parked[26] = {
      to: Uint8Array.from([0xaa, 0x20]),
      amount: 1200n,
      token: {
        amount: 0n,
        category: 'ee643a16',
        nft: { capability: 'none', commitment: '005e1976a91447d9fe52d462741f418e9dd5efaa6ae7e7adb60088ac0000' },
      },
    };
    parked[22] = {
      to: Uint8Array.from([0xaa, 0x20]),
      amount: 1200n,
      token: {
        amount: 0n,
        category: 'ee643a16',
        nft: { capability: 'mutable', commitment: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
      },
    };
    expect(relocateJobEventEmitToDest(parked, 22, { consumedMutableOk: true })).toBe(true);
    const versionEvent = {
      to: Uint8Array.from([0xaa, 0x20, 0x11]),
      amount: 1200n,
      token: {
        amount: 0n,
        category: 'b2b2b2b2',
        nft: { capability: 'none' as const, commitment: '0119' },
      },
    };
    const versionParked: Array<{
      to?: Uint8Array; amount?: bigint;
      token?: { amount?: bigint; category?: string; nft?: { capability?: string; commitment?: string } };
    }> = [
      { to: Uint8Array.of(0x51), amount: 1000n },
      { to: Uint8Array.of(0x51), amount: 1000n },
      { to: Uint8Array.of(0x51), amount: 1000n },
      versionEvent,
      {
        to: Uint8Array.of(0x51),
        amount: 800n,
        token: { amount: 0n, category: 'b2b2b2b2', nft: { capability: 'none', commitment: '5343494401000000' } },
      },
    ];
    expect(isDelegateEventNftOutput(versionEvent)).toBe(true);
    expect(isDelegateEventNftOutput(versionParked[4])).toBe(false);
    expect(relocateDelegateEventNftToDest(versionParked, 6, Uint8Array.from([0xaa, 0x20, 0x11]))).toBe(true);
    expect(versionParked[6]?.token?.nft?.commitment).toBe('0119');
    expect(versionParked[3]?.token).toBeUndefined();
    const jobEvent = {
      to: Uint8Array.from([0xbb, 0x20, 0x22]),
      amount: 1200n,
      token: {
        amount: 0n,
        category: 'c3c3c3c3',
        nft: { capability: 'none' as const, commitment: '00' + '11'.repeat(20) },
      },
    };
    const mixed = [
      { to: Uint8Array.of(0x51), amount: 1000n },
      jobEvent,
      versionEvent,
    ];
    expect(relocateDelegateEventNftToDest(mixed, 5, Uint8Array.from([0xaa, 0x20, 0x11]))).toBe(true);
    expect(mixed[5]?.token?.nft?.commitment).toBe('0119');
    expect(mixed[1]?.token?.nft?.commitment).toBe(jobEvent.token.nft.commitment);
    expect(resolveNamedEventValues(
      [{ name: 'treasuryAddress' }],
      [{ name: 'treasuryAddress_' }],
      ['0x0000000000000000000000000000000000000000'],
    )).toEqual(['0x0000000000000000000000000000000000000000']);
    expect(resolveNamedEventValues(
      [{ name: 'arbitrator' }, { name: 'name' }, { name: 'fee' }],
      [{ name: 'name' }, { name: 'fee' }],
      ['Alice', 100n],
    )).toBeUndefined();
    expect(parked[22]?.token?.nft?.commitment).toBe(
      '005e1976a91447d9fe52d462741f418e9dd5efaa6ae7e7adb60088ac0000',
    );
    expect(parked[26]?.token).toBeUndefined();
    expect(isLearnedEventEmitCommitment('51')).toBe(true);
    expect(isLearnedEventEmitCommitment('01')).toBe(true);
    expect(isLearnedEventEmitCommitment('53434944')).toBe(false);
    expect(isLearnedEventEmitCommitment('')).toBe(false);
    expect(isLearnedEventEmitCommitment('00')).toBe(false);
    expect(isLearnedEventEmitCommitment(
      '23aa20083560b686fab28b272d2ba1f04128f0af805ff4a827d666730629ff090e6b6887',
    )).toBe(true);
    expect(scaledEventOutputIndex(-1, 5)).toBe(-1);
    expect(scaledInputPreserveExclusiveEnd(-1, 5)).toBe(-1);
    expect(legacyComputePublishValueChunkBand({
      start: 20, plannedWidth: 3, preserveEndExclusive: 25,
    })).toEqual({ start: 25, end: 27, nNew: 3 });
    expect(legacyComputePublishValueChunkBand({
      start: Math.max(20, 21 + 1), plannedWidth: 2,
    })).toEqual({ start: 22, end: 23, nNew: 2 });
    expect(legacyComputePublishValueChunkBand({
      start: 20, plannedWidth: 3,
    })).toEqual({ start: 20, end: 22, nNew: 3 });
    expect(legacyComputePublishValueChunkBand({
      implIndex: 15, blockSize: 5, plannedWidth: 3,
    })).toEqual({ start: 20, end: 22, nNew: 3 });
    expect(legacyComputePublishValueChunkBand({
      implIndex: 15, blockSize: 5, plannedWidth: 6, derivedIndices: [20, 21, 22, 23, 24],
    })).toEqual({ start: 20, end: 24, nNew: 5 });
    expect(legacyComputePublishValueChunkBand({
      implIndex: 15, blockSize: 5, plannedWidth: 6, liveWidth: 5,
    })).toEqual({ start: 20, end: 24, nNew: 5 });
    const created = [
      { commitment: '00004c', lockingBytecode: lock },
      { commitment: '010000', lockingBytecode: lock },
    ];
    const updated = [
      ...created,
      { commitment: '020047', lockingBytecode: lock },
    ];
    expect(selectObservedValueChunkRun(created, updated)).toEqual(updated);
    expect(selectObservedValueChunkRun(updated, created)).toEqual(created);
    expect(selectObservedValueChunkRun(updated, [{
      commitment: '00', lockingBytecode: lock,
    }])).toEqual(updated);
    const nextLock = new Uint8Array(lock);
    nextLock[2] = 0x44;
    const shortenedObservation = [
      { commitment: '00004c', lockingBytecode: nextLock },
      { commitment: '010000', lockingBytecode: nextLock },
      // A stale suffix from the prior root is not a coherent run by itself.
      { commitment: '020047', lockingBytecode: lock },
    ];
    expect(selectObservedValueChunkRun(updated, shortenedObservation)).toEqual(
      shortenedObservation.slice(0, 2),
    );
    const holeOutputs = Array.from({ length: 26 }, () => (
      { to: Uint8Array.of(0x76, 0xa9), amount: 1000n }
    ));
    placeValueChunksOnBand(holeOutputs, { start: 20, nNew: 6 }, [
      { commitment: '00004c', lockingBytecode: lock, categoryId: 'md' },
      { commitment: '010000', lockingBytecode: lock, categoryId: 'md' },
      { commitment: '020047', lockingBytecode: lock, categoryId: 'md' },
      { commitment: '030002', lockingBytecode: lock, categoryId: 'md' },
      { commitment: '0400bc', lockingBytecode: lock, categoryId: 'md' },
    ]);
    expect(holeOutputs[25]?.token).toBeUndefined();
    expect(legacyFillValueChunkBandHoles(holeOutputs, { start: 20, nNew: 6 }, {
      lockingBytecode: lock, categoryId: 'md',
    }, new Set(), 28)).toBe(1);
    expect(holeOutputs[25]?.token?.nft?.capability).toBe('mutable');
    expect(holeOutputs[25]?.to).toBe(lock);
    expect(legacyFillValueChunkBandHoles(holeOutputs, { start: 20, nNew: 16 }, {
      lockingBytecode: lock, categoryId: 'md',
    }, new Set(), 26)).toBe(0);
    const changeOutputs = Array.from({ length: 29 }, (_, index) => (
      index === 25
        ? { to: Uint8Array.of(0x76, 0xa9), amount: 500_000n }
        : index === 28
          ? { to: Uint8Array.of(0x6a), amount: 0n }
          : { to: Uint8Array.of(0x51), amount: 1000n }
    ));
    expect(legacyFillValueChunkBandHoles(changeOutputs, { start: 20, nNew: 6 }, {
      lockingBytecode: lock, categoryId: 'md',
    }, new Set(), 28)).toBe(6);
    const writerGroups: PhysicalReturnGroup[] = [
      group({
        categoryId: 'ft',
        functionName: 'transferFrom',
        returnEventInBlock: true,
        blockLayout: tokenLayout,
        externalContract: transferFromContract,
      }),
    ];
    expect(writerBlockOccupancyEnd(writerGroups, (categoryId) => (categoryId === 'ft' ? 24 : -1))).toBe(32);
    const threeWide = Array.from({ length: 36 }, (_, index) => {
      if (index >= 21 && index <= 23) return { to: Uint8Array.of(0x76, 0xa9), amount: 200_000n };
      if (index >= 24 && index <= 28) {
        return {
          to: new Uint8Array(35),
          token: { category: 'ft', nft: { capability: 'mutable' as const, commitment: '00' } },
        };
      }
      if (index === 31) {
        return {
          to: Uint8Array.of(0x51),
          token: { category: 'ft', nft: { capability: 'none' as const, commitment: '01' } },
        };
      }
      if (index === 30) {
        const p2sh = new Uint8Array(35);
        p2sh[0] = 0xaa; p2sh[1] = 0x20; p2sh[34] = 0x87;
        p2sh[2] = 0x93;
        return { to: p2sh, amount: 1000n };
      }
      return { to: Uint8Array.of(0x51), amount: 1000n };
    });
    const occupancyEnd = writerBlockOccupancyEnd(
      writerGroups, (categoryId) => (categoryId === 'ft' ? 24 : -1),
    );
    placeValueChunksOnBand(threeWide, { start: 21, nNew: 3 }, [
      { commitment: '00004c', lockingBytecode: lock, categoryId: 'md' },
      { commitment: '010000', lockingBytecode: lock, categoryId: 'md' },
      { commitment: '020047', lockingBytecode: lock, categoryId: 'md' },
    ], new Set(), occupancyEnd);
    expect(threeWide[31]?.to).toEqual(Uint8Array.of(0x51));
    expect(threeWide[31]?.token?.category).toBe('ft');
    expect(relocateChangeAfterOccupancy(
      [{ token: { nft: { capability: 'mutable' } } }, { to: Uint8Array.of(0x51) }],
      { to: Uint8Array.of(0x76, 0xa9), amount: 1n },
      0,
      1,
    )).toBe(1);
    expect(relocateChangeAfterOccupancy(
      [
        { token: { nft: { capability: 'mutable' } } },
        { token: { nft: { capability: 'mutable' } } },
        { to: Uint8Array.of(0x6a), amount: 0n },
      ],
      { to: Uint8Array.of(0x76, 0xa9), amount: 1n },
      0,
      -1,
      1,
    )).toBe(1);
    const jobsLock = new Uint8Array(35);
    jobsLock[0] = 0xaa; jobsLock[1] = 0x20; jobsLock[34] = 0x87; jobsLock[2] = 0x5f;
    const suffix = [
      { to: jobsLock, token: { nft: { capability: 'mutable' as const, commitment: '00aa' } } },
      { to: Uint8Array.of(0x76, 0xa9), amount: 1000n },
      { to: jobsLock, token: { nft: { capability: 'mutable' as const, commitment: '01bb' } } },
      { to: Uint8Array.of(0x6a), amount: 0n },
    ];
    expect(packJobsAgainstOpReturn(suffix, jobsLock, 0)).toBe(2);
    expect(suffix[1]?.token?.nft?.commitment).toBe('00aa');
    expect(suffix[2]?.token?.nft?.commitment).toBe('01bb');
    expect(suffix[3]?.to).toEqual(Uint8Array.of(0x6a));
    // Late value-chunks after jobs: lift the early jobs run against OP_RETURN so
    // TXOUTPUTCOUNT-1-nNew matches the reverse-suffix covenant (post two jobs).
    const lateAfterJobs = [
      { to: jobsLock, token: { nft: { capability: 'mutable' as const, commitment: '00aa' } } },
      { to: jobsLock, token: { nft: { capability: 'mutable' as const, commitment: '01bb' } } },
      { to: Uint8Array.of(0xaa, 0x20), token: { nft: { capability: 'mutable' as const, commitment: 'late' }, category: 'ff' } },
      { to: Uint8Array.of(0x6a), amount: 0n },
    ];
    expect(moveLateOutputsBeforeReverseSuffix(lateAfterJobs, jobsLock, 2)).toBe(2);
    expect(lateAfterJobs[1]?.token?.nft?.commitment).toBe('00aa');
    expect(lateAfterJobs[2]?.token?.nft?.commitment).toBe('01bb');
    expect(lateAfterJobs[3]?.to).toEqual(Uint8Array.of(0x6a));
    // Reverse-suffix orphans: mid-layout duplicate jobs locks must be stripped so
    // TXOUTPUTCOUNT-1-nNew stays unique after late growth reorders the trailer.
    const orphaned = [
      { to: jobsLock, token: { nft: { capability: 'mutable' as const, commitment: 'dead' } }, amount: 1200n },
      { to: Uint8Array.of(0x76, 0xa9), amount: 1000n },
      { to: jobsLock, token: { nft: { capability: 'mutable' as const, commitment: '00aa' } }, amount: 1200n },
      { to: jobsLock, token: { nft: { capability: 'mutable' as const, commitment: '01bb' } }, amount: 1200n },
      { to: Uint8Array.of(0x6a), amount: 0n },
    ];
    expect(stripSurplusValueChunkLocks(orphaned, { start: 2, nNew: 2 }, jobsLock)).toBe(1);
    expect(orphaned[0]?.to).toEqual(Uint8Array.of(0x51));
    expect(orphaned[2]?.token?.nft?.commitment).toBe('00aa');
    expect(orphaned[3]?.token?.nft?.commitment).toBe('01bb');
    expect(legacyIsPersistedValueChunkReady()).toBe(false);
    expect(boundedDerivationIterations({
      defaultIterations: 20, persistWidth: 3, hasLoopOrChunkVars: true,
    })).toBe(8);
    expect(boundedDerivationIterations({
      defaultIterations: 20, persistWidth: 0, hasLoopOrChunkVars: true,
    })).toBe(64);
    expect(boundedDerivationIterations({
      defaultIterations: 20, persistWidth: 0, hasLoopOrChunkVars: false,
    })).toBe(20);
    const speculativeGrowth = {
      commitmentProgress: 0,
      hasDerivedState: false,
      chunkVariableCount: 1,
      loopEntryVariableCount: 1,
      outputVerificationMismatchObserved: true,
      totalRegionWidth: 1,
      maximumRegionWidth: 32,
      allCommitmentsArePlaceholders: true,
    };
    expect(shouldGrowSpeculativeChunkRegion(speculativeGrowth)).toBe(true);
    expect(shouldGrowSpeculativeChunkRegion({
      ...speculativeGrowth,
      outputVerificationMismatchObserved: false,
    })).toBe(false);
    expect(shouldGrowSpeculativeChunkRegion({
      ...speculativeGrowth,
      commitmentProgress: 1,
    })).toBe(false);
    expect(shouldGrowSpeculativeChunkRegion({
      ...speculativeGrowth,
      reverseIndexedChunkSuffix: true,
    })).toBe(false);
    const seeded = new Map<number, { commitment: string }>();
    const persistValue = new Uint8Array(VALUE_HEAD_SIZE + VALUE_CHUNK_SIZE + 4);
    persistValue.fill(7, VALUE_HEAD_SIZE);
    expect(seedChunksFromPersistedValue(
      (index, chunk) => { seeded.set(index, chunk); return true; },
      20,
      persistValue,
      lock,
      'md',
    )).toBe(2);
    expect(seeded.get(20)?.commitment.startsWith('00')).toBe(true);
    expect(seeded.get(21)?.commitment.startsWith('01')).toBe(true);
    expect(valueChunkIndexFromCommitment('00004cb42000')).toBe(0);
    expect(valueChunkIndexFromCommitment('0200475522ee')).toBe(2);
    expect(valueChunkIndexFromCommitment('0053004c7009')).toBeUndefined();
    expect(changeOutputs[25]?.token?.nft?.capability).toBe('mutable');
    expect(changeOutputs.some((output) => (
      !output.token && (output.amount ?? 0n) >= 499_000n
    ))).toBe(true);
    expect(legacyLiveValueChunkBandWidth({ plannedWidth: 2, persistWidth: 3 })).toBe(3);
    expect(legacyLiveValueChunkBandWidth({
      plannedWidth: 2, persistWidth: 5, derivedWidth: 3,
    })).toBe(3);
    const observedLock = Uint8Array.of(0xaa, 0x20, 0x01, 0x87);
    const compatibilityLock = Uint8Array.of(0xaa, 0x20, 0x02, 0x87);
    expect(selectValueChunkRedeemLock({
      covenantObserved: observedLock, compatibility: compatibilityLock,
    })).toBe(observedLock);
    expect(legacyComputePublishValueChunkBand({
      implIndex: 18, blockSize: 5, plannedWidth: 2, insertShift: 1,
    })).toEqual({ start: 24, end: 25, nNew: 2 });
    expect(legacyComputePublishValueChunkBand({
      implIndex: 18, blockSize: 5, plannedWidth: 2, liveWidth: 3,
    })).toEqual({ start: 23, end: 25, nNew: 3 });
    expect(legacyComputePublishValueChunkBand({
      implIndex: 15, blockSize: 5, plannedWidth: 5, liveWidth: 0,
    })).toEqual({ start: 20, end: 24, nNew: 5 });
    expect(legacyPersistedValueChunkWidth('missing')).toBe(0);
    expect(legacyComputePublishValueChunkBand({
      implIndex: 15, blockSize: 5, jobEventsCount: 4,
    })).toEqual({ start: 20, end: 23, nNew: 4 });
    const viewTail = {
      to: Uint8Array.of(0x51),
      token: { nft: { capability: 'none' as const, commitment: '51' } },
    };
    expect(isOverwritableValueChunkOccupant(viewTail)).toBe(true);
    expect(isOverwritableValueChunkOccupant({ to: Uint8Array.of(0x76, 0xa9) })).toBe(true);
    expect(isOverwritableValueChunkOccupant({
      to: new Uint8Array(35),
      token: { nft: { capability: 'none', commitment: '534349440105' } },
    })).toBe(false);
  });

  it('strips extra value-chunk locks past the planned nNew band', () => {
    const lock = new Uint8Array(35);
    lock[0] = 0xaa; lock[1] = 0x20; lock[34] = 0x87;
    const outputs = [
      { to: lock, token: { nft: { capability: 'mutable' as const } } },
      { to: lock, token: { nft: { capability: 'mutable' as const } } },
      { to: lock, token: { nft: { capability: 'mutable' as const } } },
    ];
    expect(stripSurplusValueChunkLocks(outputs, { start: 0, nNew: 2 }, lock)).toBe(1);
    expect(outputs[0].to).toBe(lock);
    expect(outputs[1].to).toBe(lock);
    expect(outputs[2].to).toEqual(Uint8Array.of(0x51));
  });

  it('does not strip a consumed persist predecessor outside the write band', () => {
    const lock = new Uint8Array(35);
    lock[0] = 0xaa; lock[1] = 0x20; lock[34] = 0x87;
    const outputs = [
      { to: lock, token: { nft: { capability: 'mutable' as const } } },
      { to: lock, token: { nft: { capability: 'mutable' as const } } },
      { to: lock, token: { nft: { capability: 'mutable' as const } } },
    ];
    const consumed = [
      { token: { nft: { capability: 'mutable' as const } }, unlocker: { generateLockingBytecode: () => lock } },
      undefined,
      undefined,
    ];
    expect(stripSurplusValueChunkLocks(outputs, { start: 1, nNew: 2 }, lock, consumed)).toBe(0);
    expect(outputs[0].to).toBe(lock);
    expect(outputs[0].token?.nft?.capability).toBe('mutable');
  });

  it('keeps UPDATE rematerialization on the session/persist Created digest lock', () => {
    const persistLock = new Uint8Array(35);
    persistLock[0] = 0xaa; persistLock[1] = 0x20; persistLock[34] = 0x87;
    persistLock[2] = 0x57;
    const sessionLock = new Uint8Array(35);
    sessionLock[0] = 0xaa; sessionLock[1] = 0x20; sessionLock[34] = 0x87;
    sessionLock[2] = 0xeb;
    legacyRememberValueChunkLock('ee643a16', persistLock);
    expect(binToHex(persistUpdateRedeemLock('ee643a16', sessionLock)!)).toBe(binToHex(sessionLock));
    expect(binToHex(persistUpdateRedeemLock('ee643a16')!)).toBe(binToHex(persistLock));
    const stamped = applyRedeemLockToChunks(
      [{ lockingBytecode: p2sh32LockFromValueRoot(sha256Sync(new Uint8Array(80).fill(0x43))) }],
      persistUpdateRedeemLock('ee643a16', sessionLock)!,
    );
    expect(binToHex(stamped[0].lockingBytecode)).toBe(binToHex(sessionLock));
    expect(binToHex(legacyPersistedValueChunkLock('ee643a16')!)).toBe(binToHex(persistLock));
    StatefulTransactionBuilder.clearPersistedJobEvents();
  });

  it('rematerializes persist UPDATE only for empty-address dest, not Created or Whitelisted', () => {
    expect(isWithdrawShapedJobEvent([16, '', '', 0])).toBe(true);
    expect(isWithdrawShapedJobEvent([7, '', '', 0])).toBe(true);
    expect(isWithdrawShapedJobEvent([0, '76a914', '', 0])).toBe(false);
    expect(isWithdrawShapedJobEvent({ type_: 15, address_: '76a914', data_: '', timestamp_: 0 })).toBe(false);
    expect(shouldRematerializePersistUpdate({
      persistReady: true, initialWrite: false, event: [16, '', '', 0],
    })).toBe(true);
    expect(shouldRematerializePersistUpdate({
      persistReady: true, initialWrite: true, event: [16, '', '', 0],
    })).toBe(false);
    expect(shouldRematerializePersistUpdate({
      persistReady: true, initialWrite: false, event: [0, '76a914', '', 0],
    })).toBe(false);
    expect(shouldRematerializePersistUpdate({
      persistReady: true, initialWrite: false, event: [16, '', '', 0], plannedInserts: 1,
    })).toBe(false);
    expect(isPersistValueChunkCommitment(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85500000000',
    )).toBe(true);
    expect(isPersistValueChunkCommitment(
      '00004cb420004372656174652061206d61726b6574706c616365',
    )).toBe(true);
    expect(isPersistValueChunkCommitment('0023aa20083560b686fab28b')).toBe(false);
    expect(isPersistValueChunkCommitment('0000000000')).toBe(false);
    expect(persistValueChunkBase(15)).toBe(20);
    expect(persistValueChunkBase(18, 5)).toBe(23);
    expect(persistValueChunkBase(-1)).toBe(-1);
    expect(shouldKeepPersistAtLayoutBase({
      persistReady: true, firstPublish: false, layoutDestOccupiedByMintingWriter: true,
    })).toBe(true);
    expect(shouldKeepPersistAtLayoutBase({
      persistReady: true, firstPublish: false, layoutDestOccupiedByMintingWriter: false,
    })).toBe(false);
    expect(shouldKeepPersistAtLayoutBase({ persistReady: true, firstPublish: true })).toBe(false);
    expect(shouldKeepPersistAtLayoutBase({ persistReady: false, firstPublish: false })).toBe(false);
    expect(persistPredecessorPlaceCount(3, 5, true)).toBe(3);
    expect(persistPredecessorPlaceCount(2, 5, false)).toBe(5);
    expect(persistPredecessorPlaceCount(0, 2, true)).toBe(0);
    expect(persistUpdatePredecessorDests({
      implIndex: 15, persistUpdate: true, keepAtLayout: true, bandStart: 20, nNew: 3,
    })).toEqual([20, 21, 22]);
    expect(persistUpdatePredecessorDests({
      implIndex: 15, persistUpdate: true, keepAtLayout: false, bandStart: 25, nNew: 2,
    })).toEqual([25, 26]);
    expect(persistUpdatePredecessorDests({
      implIndex: 15, persistUpdate: false, keepAtLayout: false, bandStart: 20, nNew: 2,
    })).toEqual([20, 21]);
    expect(persistOccupantDisplaceable({
      occupantIsPad: true, persistUpdate: true, keepAtLayout: true, occupantCapability: 'minting',
    })).toBe(true);
    expect(persistOccupantDisplaceable({
      occupantIsPad: false, persistUpdate: true, keepAtLayout: true, occupantCapability: 'minting',
    })).toBe(true);
    expect(persistOccupantDisplaceable({
      occupantIsPad: false, persistUpdate: true, keepAtLayout: false, occupantCapability: 'minting',
    })).toBe(false);
    expect(persistOccupantDisplaceable({
      occupantIsPad: false, persistUpdate: false, keepAtLayout: true, occupantCapability: 'minting',
    })).toBe(false);
    expect(persistOccupantDisplaceable({
      occupantIsPad: false,
      persistUpdate: true,
      keepAtLayout: true,
      occupantCapability: 'mutable',
      occupantCommitment: '00004cb420004372656174652061206d61726b6574706c616365',
    })).toBe(true);
    expect(persistOccupantDisplaceable({
      occupantIsPad: false,
      persistUpdate: true,
      keepAtLayout: false,
      occupantCapability: 'mutable',
      occupantCommitment: '00004cb420004372656174652061206d61726b6574706c616365',
    })).toBe(false);
    expect(persistPredecessorRank(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85500000000',
    )).toBeLessThan(persistPredecessorRank('00004cb420004372656174652061206d61726b6574706c616365'));
    expect(orderPersistPredecessorCandidates([
      { token: { nft: { commitment: '00004cb420004372656174652061206d61726b6574706c616365' } } },
      { token: { nft: { commitment: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85500000000' } } },
      { token: { nft: { commitment: '01004cb4' } } },
    ], true).map((item) => String(item.token?.nft?.commitment ?? '').slice(0, 8))).toEqual([
      'e3b0c442', '00004cb4', '01004cb4',
    ]);
    expect(orderPersistPredecessorCandidates([
      { token: { nft: { commitment: 'e3b0c44298fc1c14' } } },
      { token: { nft: { commitment: '00004cb4' } } },
    ], false).map((item) => String(item.token?.nft?.commitment ?? '').slice(0, 8))).toEqual([
      '00004cb4', 'e3b0c442',
    ]);
    expect(persistPredecessorWantedRank(20, 15)).toBe(0);
    expect(persistPredecessorWantedRank(21, 15)).toBe(10);
    expect(persistPredecessorWantedRank(22, 15)).toBe(11);
    expect(assignPersistPredecessors(
      [20, 21, 22],
      [
        { token: { nft: { commitment: '00004cb42000437265617465' } } },
        { token: { nft: { commitment: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85500000000' } } },
        { token: { nft: { commitment: '0100000000000000' } } },
      ],
      15,
      true,
    ).map((item) => `${item.dest}:${String(item.candidate.token?.nft?.commitment ?? '').slice(0, 8)}`)).toEqual([
      '20:e3b0c442', '21:00004cb4', '22:01000000',
    ]);
    expect(syncBuilderInputsFromAllInputs(
      [{ id: 'ft' }, { id: 'pad' }, { id: 'sidecar' }],
      [{ id: 'persist' }, { id: 'ft' }],
    )).toEqual([{ id: 'persist' }, { id: 'ft' }, { id: 'sidecar' }]);
    expect(isInsertShapedJobEvent([0, '76a914', '', 0])).toBe(true);
    expect(isInsertShapedJobEvent([14, '76a914', '', 0])).toBe(true);
    expect(isInsertShapedJobEvent([3, '', 'data', 0])).toBe(false);
    expect(shouldStampPersistUpdateDigestLock({
      persistReady: true, persistWidth: 3, firstPublishInsert: false,
    })).toBe(true);
    expect(shouldStampPersistUpdateDigestLock({
      persistReady: true, persistWidth: 3, firstPublishInsert: true,
    })).toBe(false);
    expect(shouldStampPersistUpdateDigestLock({
      persistReady: true, persistWidth: 0, firstPublishInsert: false,
    })).toBe(false);
    expect(shouldUseLegacyPersistDigestLockForValueChunks({
      hasWriteMetadata: false, permitsLegacyFallback: true, stampPersistUpdate: true,
    })).toBe(true);
    expect(shouldUseLegacyPersistDigestLockForValueChunks({
      hasWriteMetadata: true, permitsLegacyFallback: true, stampPersistUpdate: true,
    })).toBe(false);
    expect(shouldUseLegacyPersistDigestLockForValueChunks({
      hasWriteMetadata: false, permitsLegacyFallback: false, stampPersistUpdate: true,
    })).toBe(false);
    expect(persistUpdateDigestLock('missing-category')).toBeUndefined();
    expect(persistUpdateDigestLock(
      'ee643a1671fbbe5333480fe40ff0fa72b65b6df0818805a2209586e991ca0af0',
    )).toBeUndefined();
    expect(binToHex(legacyJobEventsPersistUpdateDigestLock(
      'ee643a1671fbbe5333480fe40ff0fa72b65b6df0818805a2209586e991ca0af0',
    ) ?? new Uint8Array())).toBe(
      'aa2047362c5b4a0c597c12b75c90f68f6933b2e86c63eb6ce7ed46e083407361b7b587',
    );
    const entryLock = hexToBin('aa2047362c5b4a0c597c12b75c90f68f6933b2e86c63eb6ce7ed46e083407361b7b587');
    const persistVLock = hexToBin('aa20a8ff6e94d0a3199b8457333ae32c3f788fb420b10695af6f27e92a793e8af34987');
    expect(binToHex(persistUpdateDestLock({ destOffset: 0, entryLock, persistLock: persistVLock }) ?? new Uint8Array()))
      .toBe(binToHex(entryLock));
    expect(binToHex(persistUpdateDestLock({ destOffset: 2, entryLock, persistLock: persistVLock }) ?? new Uint8Array()))
      .toBe(binToHex(persistVLock));
    const dummyDigestLock = hexToBin('aa20890e27f0da5beec909520167c19723057491ec6170503a2420c6061544694c5b87');
    expect(binToHex(persistUpdateDestLock({
      destOffset: 2, entryLock, persistLock: persistVLock, inputLock: dummyDigestLock,
    }) ?? new Uint8Array())).toBe(binToHex(persistVLock));
    const persistV = utf8ToBin('Create a marketplace in solidity');
    const computedPersistLock = legacyJobEventsPersistValueChunkLock(
      'ee643a1671fbbe5333480fe40ff0fa72b65b6df0818805a2209586e991ca0af0',
      persistV,
    );
    expect(computedPersistLock?.length).toBe(35);
    expect(binToHex(computedPersistLock ?? new Uint8Array()).startsWith('aa20')).toBe(true);
    expect(binToHex(computedPersistLock ?? new Uint8Array())).not.toBe(
      binToHex(p2sh32LockFromValueRoot(sha256Sync(persistV))),
    );
    expect(isJobEventEmitCommitment('005f1976a91471782e8159265ed94bd35b8e699c08f53a6f38c688ac0000')).toBe(true);
    expect(isOverwritableEmitOccupant({
      token: { nft: { capability: 'mutable', commitment: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' } },
    })).toBe(false);
    expect(isOverwritableEmitOccupant({
      token: { nft: { capability: 'mutable', commitment: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' } },
    }, { consumedMutableOk: true })).toBe(true);
  });

  it('encodes CollateralWithdrawn with the stamped timestamp the impl EQUALVERIFYs', () => {
    const stamped = stampEmptyJobEventTimestamp([16, '', '', 0], 0x65574ce0n);
    const hex = encodeEmptyJobEventEmitCommitment(0, stamped);
    expect(hex).toBeDefined();
    expect(hex!.startsWith('00600000')).toBe(true);
    expect(hex).not.toBe('0060000000');
    expect(hex!.length).toBeGreaterThan(10);
    const viaStruct = encodeJobEventEmitCommitment(0, stamped);
    expect(viaStruct === hex || (viaStruct?.startsWith('0060') && viaStruct !== '0060000000')).toBe(true);
  });

  it('quarantines nested timestamp adaptation to the exact legacy ABI schema', () => {
    const artifact = (convention: 'legacy-unroll' | 'kernel-row-loop', renamed = false) => ({
      contractName: 'Archive',
      abi: [{
        name: 'appendNotice',
        inputs: [
          { name: 'item', type: renamed ? 'Notice' : 'JobEventData' },
          { name: 'id', type: 'uint256' },
        ],
      }],
      structs: [{
        name: renamed ? 'Notice' : 'JobEventData',
        fields: renamed
          ? [
            { name: 'kind', type: 'uint8' },
            { name: 'recipient', type: 'bytes' },
            { name: 'payload', type: 'bytes' },
            { name: 'observedAt', type: 'uint32' },
          ]
          : [
            { name: 'type_', type: 'uint8' },
            { name: 'address_', type: 'bytes' },
            { name: 'data_', type: 'bytes' },
            { name: 'timestamp_', type: 'uint32' },
          ],
      }],
      messageBus: { convention },
    }) as unknown as Artifact;
    const original = [16, '', '', 0] as const;
    const timestamp = 0x65574ce0n;

    // Function spelling and argument position provide no authority; only the explicitly legacy schema adapts.
    expect(adaptLegacyNestedJobEventArguments(
      artifact('legacy-unroll'), 'appendNotice', [original, 7n], timestamp,
    )[0]).toEqual([16, '', '', timestamp]);
    expect(adaptLegacyNestedJobEventArguments(
      artifact('kernel-row-loop'), 'appendNotice', [original, 7n], timestamp,
    )[0]).toBe(original);
    expect(adaptLegacyNestedJobEventArguments(
      artifact('legacy-unroll', true), 'appendNotice', [original, 7n], timestamp,
    )[0]).toBe(original);
  });

  it('selects the post-append value whose sha256 is the chunk pin, not the Created witness', () => {
    const created = new Uint8Array(200).fill(0x43);
    const updated = new Uint8Array(700).fill(0x55);
    const pinLock = p2sh32LockFromValueRoot(sha256Sync(updated));
    const createdRoot = sha256Sync(created);
    const selected = selectHashedValueForChunkPin(
      [
        [created, createdRoot],
        [updated, pinLock],
      ],
      pinLock,
    );
    expect(selected?.value).toBe(updated);
    expect(binToHex(selected!.lockingBytecode)).toBe(binToHex(pinLock));
    const chunks = chunksFromJobEventsValue(selected!.value, selected!.lockingBytecode, 'md');
    expect(chunks.length).toBe(6);
    expect(chunks[5].commitment.startsWith('05')).toBe(true);
    expect(chunks[5].commitment).not.toBe('050000');
    const redeemPin = new Uint8Array(35);
    redeemPin[0] = 0xaa; redeemPin[1] = 0x20; redeemPin[34] = 0x87;
    redeemPin.set(sha256Sync(utf8ToBin('redeem-not-value-root')), 2);
    const byWidth = selectHashedValueForChunkPin(
      [[created, createdRoot], [updated]],
      redeemPin,
      6,
    );
    expect(byWidth?.value).toBe(updated);
    expect(chunksFromJobEventsValue(byWidth!.value).length).toBe(6);
    expect(isEmptyValueChunkCommitment('050000000000000000000000')).toBe(true);
    expect(preferChunkCommitment('050000000000000000000000', '0500475522ee138ae5')).toBe('0500475522ee138ae5');
    expect(preferChunkCommitment('0500475522ee138ae5', '050000000000000000000000')).toBe('0500475522ee138ae5');
    const actual = hexToBin('050000');
    const expected = hexToBin('0500475522ee138ae5');
    expect(binToHex(expectedFromOtcEqualVerify(expected, actual, binToHex(actual)))).toBe('0500475522ee138ae5');
    expect(binToHex(expectedFromOtcEqualVerify(actual, expected, binToHex(actual)))).toBe('0500475522ee138ae5');
    const stamped = applyRedeemLockToChunks(chunks, redeemPin);
    expect(stamped.every((chunk) => binToHex(chunk.lockingBytecode) === binToHex(redeemPin))).toBe(true);
  });

  it('ignores oversized value-chunk extractor decoys before hashing or width selection', () => {
    const oversized = new Uint8Array(
      VALUE_HEAD_SIZE + VALUE_CHUNK_SIZE * VALUE_CHUNK_MAX_COUNT + 1,
    ).fill(0x5a);
    const pinLock = p2sh32LockFromValueRoot(sha256Sync(oversized));

    expect(selectHashedValueForChunkPin([[oversized]], pinLock, 1)).toBeUndefined();
  });

  it('keeps an observed value-chunk run atomic when a staged run has the same commitments', () => {
    const stagedLock = p2sh32LockFromValueRoot(sha256Sync(utf8ToBin('staged guess')));
    const observedLock = p2sh32LockFromValueRoot(sha256Sync(utf8ToBin('authenticated pin')));
    const commitments = ['000061', '010062'];
    const staged = commitments.map((commitment) => ({ commitment, lockingBytecode: stagedLock }));
    const observed = commitments.map((commitment) => ({ commitment, lockingBytecode: observedLock }));

    const selected = selectObservedValueChunkRun(staged, observed);

    expect(selected.map((chunk) => chunk.commitment)).toEqual(commitments);
    expect(selected.every((chunk) => binToHex(chunk.lockingBytecode) === binToHex(observedLock))).toBe(true);
  });

  it('uses the live jobEvents width so a 5-wide band still rotates FakeToken', () => {
    expect(valueChunkBandWidth({})).toBe(3);
    expect(valueChunkBandWidth({ planned: 5 })).toBe(5);
    expect(valueChunkBandWidth({ derivedEnd: 24, chunkBase: 20 })).toBe(5);
    expect(valueChunkBandWidth({ planned: 4, derivedEnd: 24, chunkBase: 20 })).toBe(5);
    const chunkBase = 20;
    const start = 24;
    const nNew = valueChunkBandWidth({ planned: 5 });
    expect(start >= chunkBase && start < chunkBase + nNew).toBe(true);
    expect(mintingSwapShift(start, chunkBase, nNew)).toBe(4);
    expect(start + mintingSwapShift(start, chunkBase, nNew)).toBe(28);
  });

  it('places append-only continuations before an authenticated reverse suffix', () => {
    expect(continuationOutputBaseBeforeSuffix(25, 0)).toBe(25);
    // One authenticated output and its terminal anchor occupy [23, 25).
    expect(continuationOutputBaseBeforeSuffix(25, 1)).toBe(23);
    expect(continuationOutputBaseBeforeSuffix(25, 6)).toBe(18);
  });

  it('reuses a planner-owned value-chunk band before allocating an append-only run', () => {
    expect(selectValueChunkOutputBase({
      plannedBandStart: 17,
      usesPlannedBand: true,
      fallbackBase: 21,
    })).toBe(17);
    expect(selectValueChunkOutputBase({
      plannedBandStart: 17,
      usesPlannedBand: false,
      fallbackBase: 21,
    })).toBe(21);
  });

  it('relocates a continuation only into a contiguous token-free alignment range', () => {
    const outputs = [
      { to: Uint8Array.of(0x51), amount: 1000n },
      { to: Uint8Array.of(0x51), amount: 1000n },
      { to: Uint8Array.of(0x51), amount: 1000n },
    ];
    const inputs = [
      {},
      { token: { category: 'aa', amount: 0n, nft: { capability: 'mutable' as const, commitment: '00' } } },
      {},
    ];

    expect(findDisposableValueChunkOutputBase(outputs, inputs, 2)).toBeUndefined();
    expect(findDisposableValueChunkOutputBase(outputs, [{}, {}, {}], 2)).toBe(1);
    expect(findDisposableValueChunkOutputBase(outputs, [{}, {}, {}], 2, new Set([2]))).toBe(0);
  });

  it('does not treat OP_TRUE none-cap view tails as colliding writers', () => {
    const outputs = [
      { to: Uint8Array.of(0x51), token: { nft: { capability: 'none' as const, commitment: '51' } } },
      { to: Uint8Array.of(0x51), token: { nft: { capability: 'none' as const, commitment: '0d44' } } },
    ];
    expect(lastCollidingMutableWriterIndex(outputs, [0, 1])).toBe(-1);
  });

  it('prefers early OP_TRUE pads over the jobEvents band and SCID', () => {
    const jobEventsLock = new Uint8Array(35);
    jobEventsLock[0] = 0xaa;
    jobEventsLock[1] = 0x20;
    jobEventsLock[34] = 0x87;
    const outputs = Array.from({ length: 29 }, (_, index) => {
      if (index === 10 || index === 11) return { to: Uint8Array.of(0x51), amount: 1000n };
      if (index >= 20 && index <= 23) {
        return { to: jobEventsLock, token: { nft: { capability: 'mutable' as const, commitment: '437265617465' } } };
      }
      if (index === 24) {
        return {
          to: jobEventsLock,
          token: { nft: { capability: 'none' as const, commitment: '534349440104000000000000' } },
        };
      }
      if (index >= 26 && index <= 27) {
        return { to: jobEventsLock, token: { nft: { capability: 'mutable' as const, commitment: '00' } } };
      }
      return { to: Uint8Array.of(0x51), amount: 1000n };
    });
    expect(findViewTailDestinations(outputs, 2, {
      suffixStart: 26,
      reserved: new Set([12, 13, 14, 15, 16, 17, 18, 19]),
      preferBefore: 20,
    })).toEqual([10, 11]);
    outputs[20] = { to: Uint8Array.of(0x51), token: { nft: { capability: 'none', commitment: '51' } } };
    outputs[21] = { to: Uint8Array.of(0x51), token: { nft: { capability: 'none', commitment: '0d44' } } };
    expect(findViewTailDestinations(outputs, 2, {
      suffixStart: 26,
      reserved: new Set([12, 13, 14, 15, 16, 17, 18, 19, 20, 21]),
      preferBefore: 23,
    })).toEqual([10, 11]);
  });

  it('puts PredOut after the assigned tail band, not on master+blockSize+2', () => {
    const groups: PhysicalReturnGroup[] = [
      group({
        categoryId: 'md',
        functionName: '__forward',
        logicalFunctionName: 'arbitratorRegistered',
        returnOutputIndex: 30,
        externalContract: {
          inner: { artifact: { abi: [{ name: 'arbitratorRegistered', writesState: false }] } },
        },
      }),
      group({
        categoryId: 'md',
        functionName: '__forward',
        logicalFunctionName: 'userRegistered',
        returnOutputIndex: 31,
        externalContract: {
          inner: { artifact: { abi: [{ name: 'userRegistered', writesState: false }] } },
        },
      }),
      group({
        categoryId: 'ft',
        functionName: 'transferFrom',
        returnEventInBlock: true,
        returnOutputIndex: 29,
        blockLayout: tokenLayout,
        blockInputs: { length: 10 },
        externalContract: transferFromContract,
      }),
    ];
    const findMinting = (categoryId: string): number => (categoryId === 'ft' ? 26 : -1);
    const assigned = assignPhysicalReturnIndices(groups, findMinting);
    expect(assigned.get(2)).toBe(33);
    expect(assigned.get(0)).toBe(36);
    expect(assigned.get(1)).toBe(37);
    expect(assignedTailEnd(groups, assigned)).toBe(37);
    expect(26 + 8 + 2).toBe(36);
    expect(assignedTailEnd(groups, assigned) + 1).toBe(38);
    expect(assigned.get(0)).not.toBe(assignedTailEnd(groups, assigned) + 1);
  });

  it('displaces same-category OP_TRUE view tails instead of treating them as event holes', () => {
    const viewTail = {
      to: Uint8Array.of(0x51),
      token: { category: 'md', nft: { capability: 'none' as const, commitment: '51' } },
    };
    const meceTail = {
      to: Uint8Array.of(0x51),
      token: { category: 'md', nft: { capability: 'none' as const, commitment: '0d4449474954414c5f564944454f' } },
    };
    const identity = {
      to: new Uint8Array(35),
      token: { category: 'md', nft: { capability: 'none' as const, commitment: '5343494401050000' } },
    };
    const otherCategory = {
      to: new Uint8Array(35),
      token: { category: 'v1', nft: { capability: 'none' as const, commitment: '53434944' } },
    };
    expect(shouldDisplaceForNestedEvent(viewTail, 'md')).toBe(true);
    expect(shouldDisplaceForNestedEvent(meceTail, 'md')).toBe(true);
    expect(shouldDisplaceForNestedEvent(identity, 'md')).toBe(true);
    expect(shouldDisplaceForNestedEvent(otherCategory, 'md')).toBe(true);
    expect(shouldDisplaceForNestedEvent({
      to: new Uint8Array(35),
      token: { category: 'md', nft: { capability: 'none' as const, commitment: 'aabb' } },
    }, 'md')).toBe(false);
  });

  it('folds shared jobEvents nNew onto the physical owner group', () => {
    const groups = [
      { functionName: '__forward', valueChunkOutputCount: 0 },
      { functionName: 'publishJobEvent', sharedGroupIndex: 0, valueChunkOutputCount: 8 },
      { functionName: 'transferFrom', valueChunkOutputCount: 3 },
      { functionName: 'unrelatedWrite', valueChunkOutputCount: 12 },
    ];
    const byOwner = liveChunkSlotsByOwner(groups);
    expect(byOwner.get(0)).toBe(8);
    expect(byOwner.has(1)).toBe(false);
    expect(byOwner.has(2)).toBe(false);
    expect(byOwner.get(3)).toBe(12);
    expect(liveChunkWidthForGroup(groups, 1)).toBe(8);
    expect(liveChunkWidthForGroup(groups, 3)).toBe(12);
    expect(liveChunkWidthForGroup(groups, -1)).toBe(0);
  });

  it('does not let legacy child names alter kernel value-chunk ownership', () => {
    const groups = [
      { functionName: 'transferFrom', valueChunkOutputCount: 3 },
      { functionName: 'moveUnits', valueChunkOutputCount: 5 },
    ];
    // Descriptor-free legacy plans retain their historical token-writer exclusion.
    expect(liveChunkSlotsByOwner(groups).has(0)).toBe(false);
    // A kernel owner requires compiler descriptors, so both otherwise identical children are treated uniformly.
    expect([...liveChunkSlotsByOwner(groups, 'kernel-row-loop').entries()]).toEqual([[0, 3], [1, 5]]);
    expect(liveChunkWidthForGroup(groups, 0, 'kernel-row-loop')).toBe(3);
  });

  it('reserves proxy pads so FakeToken starts after the live jobEvents band', () => {
    expect(proxyValueChunkPadCount({ insertBase: 5, chunkSlots: 6, prefixLength: 4 })).toBe(7);
    expect(proxyValueChunkPadCount({ insertBase: 5, chunkSlots: 2, prefixLength: 4 })).toBe(3);
    expect(proxyValueChunkPadCount({ insertBase: 5, chunkSlots: 0, prefixLength: 4 })).toBe(1);
    expect(proxyValueChunkPadCount({ insertBase: 5, chunkSlots: 1, prefixLength: 8 })).toBe(0);
  });

  it('reserves the shift and complete post-relocation participant span', () => {
    expect(participantRelocationExtraFunders({
      active: true, requiredShift: 2, participantPadding: 3,
    })).toBe(5);
    expect(participantRelocationExtraFunders({
      active: true, requiredShift: 0, participantPadding: 3,
    })).toBe(3);
    expect(participantRelocationExtraFunders({
      active: false, requiredShift: 6, participantPadding: 3,
    })).toBe(0);
  });

  it('does not undersize a minting swap below the live jobEvents band', () => {
    expect(chooseMintingSwapShift(4, 1)).toBe(4);
    expect(chooseMintingSwapShift(5, 5)).toBe(5);
    expect(chooseMintingSwapShift(6, 5)).toBe(5);
    expect(chooseMintingSwapShift(4, 6)).toBe(0);
    expect(chooseParticipantRelocationShift(4, 1, 4)).toBe(0);
    expect(chooseParticipantRelocationShift(8, 1, 4)).toBe(4);
    expect(chooseParticipantRelocationShift(6, 2, 4)).toBe(2);
    expect(isEmptyValueChunkCommitment('050000000000000000000000')).toBe(true);
    expect(isEmptyValueChunkCommitment('00004cb42000437265617465')).toBe(false);
  });

  it('canonicalizes writer bool returns according to their declared ABI framing', () => {
    expect(canonicalWriterReturnCommitment({
      pendingHex: '00', writesState: true, evmBool: true, returnsBool: true,
    })).toBe(`${'00'.repeat(31)}01`);
    expect(canonicalWriterReturnCommitment({
      pendingHex: '00', writesState: true, evmBool: false, returnsBool: true,
    })).toBe('51');
    expect(canonicalWriterReturnCommitment({
      pendingHex: '', writesState: true, evmBool: false, returnsBool: true,
    })).toBe('51');
    expect(canonicalWriterReturnCommitment({
      pendingHex: '01', writesState: true, evmBool: false, returnsBool: true,
    })).toBe('51');
    expect(canonicalWriterReturnCommitment({
      pendingHex: `${'00'.repeat(32)}`, writesState: true, evmBool: true, returnsBool: true,
    })).toBe(`${'00'.repeat(31)}01`);
    expect(canonicalWriterReturnCommitment({
      pendingHex: `${'00'.repeat(31)}00`, writesState: false, evmBool: true, returnsBool: true,
    })).toBe(`${'00'.repeat(31)}00`);
    expect(canonicalWriterReturnCommitment({
      pendingHex: `${'00'.repeat(31)}01`, writesState: true, evmBool: true, returnsBool: true,
    })).toBe(`${'00'.repeat(31)}01`);
  });

  it('keeps legacy payload heuristics out of generic event placement', () => {
    const eventLock = Uint8Array.of(0xaa, 0x21);
    const legacyShapedCommitment = '005e1976a91447d9fe52d462741f418e9dd5efaa6ae7e7adb60088ac0000';
    const foreignCategoryOutputs = [{
      to: Uint8Array.of(0xaa, 0x20),
      amount: 1200n,
      token: {
        amount: 0n,
        category: 'foreign',
        nft: { capability: 'none', commitment: legacyShapedCommitment },
      },
    }];

    expect(placeChunkableWriterEventOutput(foreignCategoryOutputs, 0, {
      to: eventLock,
      amount: 1200n,
      token: {
        amount: 0n,
        category: 'owner',
        nft: { capability: 'none', commitment: legacyShapedCommitment },
      },
    })).toBe(false);
    expect(foreignCategoryOutputs[0]?.token?.category).toBe('foreign');
    expect(foreignCategoryOutputs[0]?.to).toEqual(Uint8Array.of(0xaa, 0x20));

    const siblingOutputs = [{
      to: Uint8Array.of(0xaa, 0x20),
      amount: 1200n,
      token: {
        amount: 0n,
        category: 'owner',
        nft: { capability: 'mutable', commitment: '11'.repeat(32) },
      },
    }, {
      to: Uint8Array.of(0xaa, 0x22),
      amount: 1200n,
      token: {
        amount: 0n,
        category: 'owner',
        nft: { capability: 'none', commitment: legacyShapedCommitment },
      },
    }];

    expect(placeChunkableWriterEventOutput(siblingOutputs, 0, {
      to: eventLock,
      amount: 1200n,
      token: {
        amount: 0n,
        category: 'owner',
        nft: { capability: 'none', commitment: legacyShapedCommitment },
      },
    }, { consumedMutableOk: true })).toBe(true);
    expect(siblingOutputs[1]?.token?.nft?.commitment).toBe(legacyShapedCommitment);
  });

  it('ranks return observations by authentication, not commitment byte length', () => {
    expect(shouldReplaceReturnEventCommitment(true, false)).toBe(true);
    expect(shouldReplaceReturnEventCommitment(false, true)).toBe(false);
    expect(shouldReplaceReturnEventCommitment(false, false)).toBe(true);
    expect(shouldReplaceReturnEventCommitment(true, true)).toBe(true);
  });

  it('recognizes only exact mutable NFT duplicates when reclaiming a return slot', () => {
    const lock = Uint8Array.of(0xaa, 0x20, 0x01, 0x87);
    const otherLock = Uint8Array.of(0xaa, 0x20, 0x02, 0x87);
    const outputs = [
      { to: lock, token: { category: 'owner', nft: { capability: 'mutable', commitment: 'abcd' } } },
      { to: lock.slice(), token: { category: 'owner', nft: { capability: 'mutable', commitment: 'abcd' } } },
      { to: lock, token: { category: 'owner', nft: { capability: 'mutable', commitment: 'abce' } } },
      { to: otherLock, token: { category: 'owner', nft: { capability: 'mutable', commitment: 'abcd' } } },
    ];
    expect(hasEquivalentMutableNftOutput(outputs, 0)).toBe(true);
    expect(hasEquivalentMutableNftOutput(outputs, 2)).toBe(false);
    expect(hasEquivalentMutableNftOutput(outputs, 3)).toBe(false);
    expect(stripRelocatedMutableDuplicates(outputs, [{
      token: { category: 'owner', nft: { capability: 'mutable' } },
      unlocker: { generateLockingBytecode: () => lock },
    }], 1)).toBe(1);
    expect(outputs[1].token).toBeUndefined();
    expect(outputs[2].token?.nft?.commitment).toBe('abce');
    expect(outputs[3].token?.nft?.commitment).toBe('abcd');
  });

  it('removes relocated mutable copies before their canonical coordinate without merging canonical inputs', () => {
    const lock = Uint8Array.of(0xaa, 0x20, 0x01, 0x87);
    const token = { category: 'owner', nft: { capability: 'mutable', commitment: 'abcd' } };
    const outputs = [
      { to: lock.slice(), amount: 1000n, token },
      { to: lock.slice(), amount: 1000n, token },
      { to: lock.slice(), amount: 1000n, token },
    ];
    const inputs = [
      { token: { category: 'other', nft: { capability: 'mutable' } },
        unlocker: { generateLockingBytecode: () => lock } },
      { token: { category: 'owner', nft: { capability: 'mutable' } },
        unlocker: { generateLockingBytecode: () => lock } },
      { token: { category: 'owner', nft: { capability: 'mutable' } },
        unlocker: { generateLockingBytecode: () => lock } },
    ];

    expect(stripRelocatedMutableDuplicates(outputs, inputs, 0)).toBe(1);
    expect(outputs[0].token).toBeUndefined();
    expect(outputs[1].token?.nft?.commitment).toBe('abcd');
    expect(outputs[2].token?.nft?.commitment).toBe('abcd');
  });

  it('preserves compiler-owned trailing entry outputs while their commitments are provisional', () => {
    const lock = Uint8Array.of(0xaa, 0x20, 0x01, 0x87);
    const token = { category: 'owner', nft: { capability: 'mutable', commitment: 'abcd' } };
    const outputs = [
      { to: lock.slice(), amount: 1000n, token },
      { to: lock.slice(), amount: 1000n, token },
    ];
    const inputs = [{
      token: { category: 'owner', nft: { capability: 'mutable' } },
      unlocker: { generateLockingBytecode: () => lock },
    }];

    expect(stripRelocatedMutableDuplicates(outputs, inputs, 0, new Set([1]))).toBe(0);
    expect(outputs[1].token?.nft?.commitment).toBe('abcd');
  });

  it('restores read-only mutable twins to their authenticated input coordinates', () => {
    const lock = Uint8Array.of(0xaa, 0x20, 0x01, 0x87);
    const first = {
      txid: '11'.repeat(32), vout: 0, satoshis: 1200n,
      token: { amount: 0n, category: 'owner', nft: { capability: 'mutable' as const, commitment: '00aa' } },
      unlocker: { generateLockingBytecode: () => lock },
    };
    const second = {
      txid: '22'.repeat(32), vout: 1, satoshis: 1200n,
      token: { amount: 0n, category: 'owner', nft: { capability: 'mutable' as const, commitment: '01bb' } },
      unlocker: { generateLockingBytecode: () => lock },
    };
    const outputs = [
      { to: Uint8Array.of(0x51), amount: 1000n },
      { to: Uint8Array.of(0x51), amount: 1000n },
      { to: lock, amount: 1200n, token: second.token },
    ];

    expect(reassertReadOnlyMutableOneToOnes(outputs, [first, second], [first, second])).toBe(2);
    expect(outputs[0].token?.nft?.commitment).toBe('00aa');
    expect(outputs[1].token?.nft?.commitment).toBe('01bb');
    expect(outputs[2].token).toBeUndefined();
  });

  it('does not overwrite a conflicting owned output without a relocated twin', () => {
    const lock = Uint8Array.of(0xaa, 0x20, 0x01, 0x87);
    const input = {
      txid: '33'.repeat(32), vout: 0, satoshis: 1200n,
      token: { amount: 0n, category: 'owner', nft: { capability: 'mutable' as const, commitment: '00aa' } },
      unlocker: { generateLockingBytecode: () => lock },
    };
    const output = {
      to: Uint8Array.of(0xaa, 0x20, 0x02, 0x87), amount: 1200n,
      token: { amount: 0n, category: 'other', nft: { capability: 'mutable' as const, commitment: 'beef' } },
    };
    const outputs = [output];

    expect(reassertReadOnlyMutableOneToOnes(outputs, [input], [input])).toBe(0);
    expect(outputs[0]).toBe(output);
  });

  it('places the extraTransfer return at the post-rotate minting master', () => {
    expect(tokenWriterReturnIndex(27, {
      blockSize: 8,
      slots: [{ kind: 'returnEvent', offset: 5 }],
    })).toBe(32);
    expect(tokenWriterReturnIndex(24, { blockSize: 8 })).toBe(31);
    expect(tokenWriterReturnIndex(20, {
      blockSize: 8,
      slots: [{ kind: 'returnEvent', offset: 7 }],
    }, { start: 25, end: 27 })).toBe(28);
    expect(tokenWriterReturnIndex(20, {
      blockSize: 8,
      slots: [{ kind: 'returnEvent', offset: 7 }],
    }, { start: 29, end: 31 })).toBe(27);
    expect(tokenWriterReturnIndex(24, { blockSize: 8 }, { start: 20, end: 22 }, new Set([31, 32, 33]))).toBe(31);
    expect(tokenWriterReturnIndex(
      24, { blockSize: 8 }, { start: 20, end: 22 },
      tokenWriterOccupiedDests({ persistDests: [18, 19, 20], tokenMaster: 24, reserveIdentityDests: true }),
    )).toBe(31);
    expect(tokenWriterReturnIndex(
      24, { blockSize: 8 }, { start: 20, end: 22 },
      tokenWriterOccupiedDests({ persistDests: [18, 19, 20], tokenMaster: 24 }),
    )).toBe(31);
    expect(tokenWriterReturnIndex(
      24, { blockSize: 8 }, undefined,
      persistAndTokenWriterOccupancy({
        persistReady: true, firstPublish: true, hasTokenWriter: true,
        implIndex: 15, band: { start: 20, end: 21, nNew: 2 }, tokenMaster: 24,
      }),
    )).toBe(31);
    expect(tokenWriterReturnIndex(
      24, { blockSize: 8 }, { start: 20, end: 22 },
      persistAndTokenWriterOccupancy({
        persistReady: true, firstPublish: false, hasTokenWriter: true,
        implIndex: 15, band: { start: 20, end: 22, nNew: 3 }, tokenMaster: 24,
      }),
    )).toBe(31);
    expect([...tokenWriterOccupiedDests({
      band: { start: 20, end: 22 },
      persistDests: [18, 19, 20],
      outputs: Array.from({ length: 34 }, (_u, index) => (
        index === 31
          ? { token: { nft: { commitment: '5343494401070000' } } }
          : {}
      )),
    })].sort((left, right) => left - right)).toEqual([18, 19, 20, 21, 22, 31]);
  });

  it('treats transfer as the same minting-band occupant as transferFrom', () => {
    expect(isMintingBandTokenWriter('transferFrom')).toBe(true);
    expect(isMintingBandTokenWriter('transfer')).toBe(true);
    expect(isMintingBandTokenWriter('approve')).toBe(true);
    expect(isMintingBandSwapFunction('transferFrom')).toBe(true);
    expect(isMintingBandSwapFunction('transfer')).toBe(true);
    expect(isMintingBandSwapFunction('approve')).toBe(false);
    expect(isMintingBandTokenWriter('publishJobEvent')).toBe(false);
    expect(isMintingBandTokenWriter(undefined)).toBe(false);
  });

  it('classifies minting-band writers by compiler effects, not ERC source names', () => {
    const write = (collection: string): EntryAccessAbi => ({
      collection, keyParams: ['key'], operations: ['read', 'write'],
    });
    const described = (name: string, writes: number) => ({
      functionName: name,
      compilerRoute: { abiFunction: {
        name,
        inputs: [],
        outputs: [{ type: 'bool' }],
        writesState: true,
        entryAccesses: Array.from({ length: writes }, (_unused, index) => write(`ledger${index}`)),
      } },
    });

    expect(isCompilerDescribedMintingBandWriter(described('moveUnits', 2))).toBe(true);
    expect(isCompilerDescribedMintingBandWriter(described('moveUnits', 2), true)).toBe(true);
    expect(isCompilerDescribedMintingBandWriter(described('setPermit', 1))).toBe(true);
    expect(isCompilerDescribedMintingBandWriter(described('setPermit', 1), true)).toBe(false);
    expect(isCompilerDescribedMintingBandWriter(described('transfer', 2), true)).toBe(true);
    expect(isCompilerDescribedMintingBandWriter(described('transferFrom', 3), true)).toBe(true);
    expect(isCompilerDescribedMintingBandWriter(described('approve', 2), true)).toBe(true);
    expect(isCompilerDescribedMintingBandWriter(described('approve', 1), true)).toBe(false);

    // A familiar ERC name with an explicit effect-free descriptor cannot claim writer geometry.
    expect(isCompilerDescribedMintingBandWriter(described('transferFrom', 0))).toBe(false);
    expect(isCompilerDescribedMintingBandWriter(described('approve', 0))).toBe(false);

    // Old artifacts without effect metadata retain their compatibility classification.
    expect(isCompilerDescribedMintingBandWriter({ functionName: 'transferFrom' }, true)).toBe(true);
  });

  it('does not classify descriptor-free kernel participants by transfer-like source names', () => {
    const kernelArtifact = {
      abi: [], messageBus: { convention: 'kernel-row-loop' },
    } as unknown as Artifact;
    const kernelGroup = (name: string): { functionName: string; logicalArtifact: Artifact } => ({
      functionName: name, logicalArtifact: kernelArtifact,
    });

    for (const name of ['moveUnits', 'transfer', 'transferFrom', 'approve']) {
      expect(isCompilerDescribedMintingBandWriter(kernelGroup(name))).toBe(false);
      expect(isCompilerDescribedMintingBandWriter(kernelGroup(name), true)).toBe(false);
    }
    // The kernel owner also dominates descriptor-free legacy children, whose own artifacts cannot advertise the
    // active route convention. Familiar source names must not manufacture token-writer geometry in that case.
    expect(isCompilerDescribedMintingBandWriter(
      { functionName: 'transferFrom' }, true, 'kernel-row-loop',
    )).toBe(false);
  });

  it('restores persisted continuations from transaction structure, independent of caller names', () => {
    const liveCollision = {
      initialWrite: false,
      mintingBandWriter: true,
      persisted: true,
      hasBand: true,
      hasCategory: true,
    };
    expect(shouldRestorePersistedContinuationInputs(liveCollision)).toBe(true);
    expect(shouldRestorePersistedContinuationInputs({
      ...liveCollision, initialWrite: true,
    })).toBe(false);
    expect(shouldRestorePersistedContinuationInputs({
      ...liveCollision, mintingBandWriter: false,
    })).toBe(false);
    expect(shouldRestorePersistedContinuationInputs({
      ...liveCollision, persisted: false,
    })).toBe(false);
    expect(shouldRestorePersistedContinuationInputs({
      ...liveCollision, hasBand: false,
    })).toBe(false);
    expect(shouldRestorePersistedContinuationInputs({
      ...liveCollision, hasCategory: false,
    })).toBe(false);
  });

  it('retains minting relocation after the master moves past from+width', () => {
    const previous = { from: 22, width: 4, categoryId: 'ft' };
    expect(shouldRetainMintingOutputSwap(26, 10, 3, previous, 'ft')).toBe(true);
    expect(shouldRetainMintingOutputSwap(28, 10, 3, previous, 'ft')).toBe(true);
    expect(shouldRetainMintingOutputSwap(9, 10, 3, previous, 'ft')).toBe(false);
    expect(shouldRetainMintingOutputSwap(28, 10, 3, previous, 'md')).toBe(false);
    expect(shouldRetainMintingOutputSwap(28, 10, 3, undefined, 'ft')).toBe(false);
  });

  it('inserts a nested minting master and drops a later P2PKH pad so tails stay put', () => {
    const p2pkh = new Uint8Array(25);
    p2pkh[0] = 0x76; p2pkh[1] = 0xa9; p2pkh[2] = 0x14; p2pkh[23] = 0x88; p2pkh[24] = 0xac;
    const outputs = [
      { to: Uint8Array.of(0x51), token: { category: 'v1', nft: { capability: 'mutable' as const } } },
      { to: new Uint8Array(35), token: { category: 'md', nft: { capability: 'mutable' as const } } },
      { to: new Uint8Array(35), token: { category: 'md', nft: { capability: 'mutable' as const } } },
      { to: p2pkh },
      { to: Uint8Array.of(0x51), token: { category: 'md', nft: { capability: 'none' as const } } },
      { to: new Uint8Array(35), token: { category: 'v1', nft: { capability: 'mutable' as const } } },
    ];
    const minting = {
      to: new Uint8Array(35),
      token: { category: 'md', nft: { capability: 'minting' as const } },
    };
    expect(isDisposableAlignmentPad(outputs[3])).toBe(true);
    expect(placeMintingMasterPreservingTail(outputs, 1, minting, {
      blockWidth: 3, tailStart: 4, suffixStart: 5,
    })).toBe(true);
    expect(outputs[1].token?.nft?.capability).toBe('minting');
    expect(outputs[2].token?.nft?.capability).toBe('mutable');
    expect(outputs[3].token?.nft?.capability).toBe('mutable');
    expect(outputs[4].token?.nft?.capability).toBe('none');
    expect(outputs).toHaveLength(6);
  });

  it('converts leftover minting clones to pads when the master already occupies INPUTINDEX', () => {
    const lock = new Uint8Array(35);
    lock[0] = 0xaa; lock[1] = 0x20; lock[34] = 0x87;
    const minting = { category: 'ft', nft: { capability: 'minting' as const } };
    const outputs = [
      { to: Uint8Array.of(0x51), amount: 1000n },
      { to: lock, amount: 1200n, token: minting },
      { to: lock, amount: 8000n, token: minting },
    ];
    const inputs = [
      {},
      { token: { category: 'p2pkh' } },
      { token: minting },
    ];
    expect(stripSurplusMintingOutputs(outputs, inputs, 'ft', 2)).toBe(1);
    expect(outputs[1].token).toBeUndefined();
    expect(outputs[2].token?.nft?.capability).toBe('minting');
    expect(outputs).toHaveLength(3);
  });

  it('refreshes satoshis and token amount on an existing same-category minting occupant', () => {
    const lock = new Uint8Array(35);
    lock[0] = 0xaa; lock[1] = 0x20; lock[34] = 0x87;
    const outputs = [
      { to: lock, amount: 1200n, token: { category: 'ft', amount: 0n, nft: { capability: 'minting' as const } } },
      { to: Uint8Array.of(0x51), amount: 1000n },
    ];
    const minting = {
      to: lock,
      amount: 8000n,
      token: { category: 'ft', amount: 1n, nft: { capability: 'minting' as const } },
    };
    expect(placeMintingMasterPreservingTail(outputs, 0, minting, {
      blockWidth: 1, tailStart: 2, suffixStart: 2,
    })).toBe(false);
    expect(outputs).toHaveLength(2);
    expect(outputs[0].amount).toBe(8000n);
    expect(outputs[0].token?.amount).toBe(1n);
  });

  it('does not insert a minting master onto a P2PKH hole or a foreign minting occupant', () => {
    const p2pkh = new Uint8Array(25);
    p2pkh[0] = 0x76; p2pkh[1] = 0xa9; p2pkh[2] = 0x14; p2pkh[23] = 0x88; p2pkh[24] = 0xac;
    expect(shouldInsertMintingMaster({ to: p2pkh }, 'md')).toBe(false);
    expect(shouldInsertMintingMaster({
      to: new Uint8Array(35),
      token: { category: 'ft', nft: { capability: 'minting' } },
    }, 'md')).toBe(false);
    expect(shouldInsertMintingMaster({
      to: new Uint8Array(35),
      token: { category: 'md', nft: { capability: 'mutable' } },
    }, 'md')).toBe(true);
    expect(shouldInsertMintingMaster({ to: Uint8Array.of(0x51) }, 'md')).toBe(true);
  });

  it('converts leftover empty collection placeholders to pads without moving neighbors', () => {
    const lock = new Uint8Array(35);
    lock[0] = 0xaa; lock[1] = 0x20; lock[34] = 0x87;
    const placeholder = 'e3b0c442' + '00'.repeat(60);
    const firstValue = '31'.repeat(37);
    const secondValue = '92'.repeat(21);
    const outputs = [
      { to: lock, token: { nft: { capability: 'mutable' as const, commitment: placeholder } } },
      { to: lock, token: { nft: { capability: 'mutable' as const, commitment: firstValue } } },
      { to: lock, token: { nft: { capability: 'mutable' as const, commitment: secondValue } } },
      { to: Uint8Array.of(0x51), token: { nft: { capability: 'none' as const, commitment: '51' } } },
    ];
    expect(stripSurplusEmptyCollectionEntries(outputs, lock, 2)).toBe(1);
    expect(outputs[0].token).toBeUndefined();
    expect(outputs[0].amount).toBe(1000n);
    expect(outputs[1].token?.nft?.commitment).toBe(firstValue);
    expect(outputs[2].token?.nft?.commitment).toBe(secondValue);
    expect(outputs[3].token?.nft?.commitment).toBe('51');
  });

  it('strips a 32-byte empty hash without depending on neighboring payload bytes', () => {
    const lock = new Uint8Array(35);
    lock[0] = 0xaa; lock[1] = 0x20; lock[34] = 0x87;
    const outputs = [
      { to: lock, token: { nft: { capability: 'mutable' as const, commitment: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' } } },
      { to: lock, token: { nft: { capability: 'mutable' as const, commitment: 'b7'.repeat(61) } } },
      { to: lock, token: { nft: { capability: 'mutable' as const, commitment: '4d'.repeat(9) } } },
    ];
    expect(stripSurplusEmptyCollectionEntries(outputs, lock, 2)).toBe(1);
    expect(outputs[0].token).toBeUndefined();
    expect(outputs[1].token?.nft?.commitment).toBe('b7'.repeat(61));
    expect(outputs[2].token?.nft?.commitment).toBe('4d'.repeat(9));
  });

  it('does not strip mixed empty+real entries without a planned count', () => {
    const lock = new Uint8Array(35);
    lock[0] = 0xaa; lock[1] = 0x20; lock[34] = 0x87;
    const outputs = [
      { to: lock, token: { nft: { capability: 'mutable' as const, commitment: 'e3b0c442' + '00'.repeat(60) } } },
      { to: lock, token: { nft: { capability: 'mutable' as const, commitment: '0100' + '22'.repeat(20) } } },
    ];
    expect(stripSurplusEmptyCollectionEntries(outputs, lock)).toBe(0);
    expect(outputs[0].token?.nft?.commitment.startsWith('e3b0c442')).toBe(true);
  });

  it('keeps a linear sorted-batch of in-block nodes when planned count includes every key', () => {
    const lock = new Uint8Array(35);
    lock[0] = 0xaa; lock[1] = 0x20; lock[34] = 0x87;
    const node = (commitment: string) => ({
      to: lock, token: { nft: { capability: 'mutable' as const, commitment } },
    });
    const outputs = [
      node('41' + 'ab'.repeat(63)),
      ...Array.from({ length: 7 }, () => node('00'.repeat(64))),
      node('00'.repeat(32) + 'cd'.repeat(32)),
    ];
    expect(stripSurplusEmptyCollectionEntries(outputs, lock, 9)).toBe(0);
    expect(outputs.filter((output) => output.token?.nft?.capability === 'mutable')).toHaveLength(9);
    expect(stripSurplusEmptyCollectionEntries(outputs, lock, 1)).toBe(7);
    expect(outputs.filter((output) => output.token?.nft?.capability === 'mutable')).toHaveLength(2);
  });

  it('leaves a frame\'s own entry slot outputs out of the planned lane width', () => {
    const lock = new Uint8Array(35);
    lock[0] = 0xaa; lock[1] = 0x20; lock[34] = 0x87;
    const distinct = (length: number, seed: number): string => Array.from({ length },
      (_unused, index) => ((seed + index * 37) & 0xff).toString(16).padStart(2, '0')).join('');
    type Node = { to: Uint8Array; token?: { nft: { capability: 'mutable'; commitment: string } } };
    const node = (commitment: string): Node => ({ to: lock, token: { nft: { capability: 'mutable', commitment } } });
    // A direct batch insert: the new node at its block slot, then the trailing predecessor, a head relinked to it.
    const slot = distinct(32, 0x1d);
    const relinkedHead = '00'.repeat(32) + slot + '00'.repeat(64);
    const outputs = [node(slot + '00'.repeat(32) + distinct(38, 0x52)), node(relinkedHead)];
    expect(stripSurplusEmptyCollectionEntries(outputs, lock, 1, new Set([0]))).toBe(0);
    expect(outputs[1].token?.nft?.commitment).toBe(relinkedHead);
    // Counted as a lane, the block slot's node pushes the relinked head past the width, which strips it.
    expect(stripSurplusEmptyCollectionEntries(outputs, lock, 1)).toBe(1);
    expect(outputs[1].token).toBeUndefined();
  });

  it('classifies sorted-list HEAD vs node vs data-NFT tags', () => {
    expect(isSortedEntryHeadCommitment('')).toBe(true);
    expect(isSortedEntryHeadCommitment('00'.repeat(32))).toBe(true);
    expect(isSortedEntryNodeCommitment('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')).toBe(true);
    expect(isSortedEntryNodeCommitment('0023aa2005e29c954b394605')).toBe(false);
    expect(isSortedEntryNodeCommitment('5123aa20fbedc53c00ad9e1f')).toBe(false);
    expect(isDataNftIndexCommitment('0023aa20083560b686fab28b272d2ba1f04128f0af805ff4a827d666730629ff')).toBe(true);
    expect(isDataNftIndexCommitment('5121000000000000000000000000000000000000000000000000000000000000000000')).toBe(true);
    expect(isDataNftIndexCommitment('00'.repeat(32))).toBe(false);
  });

  it('synthesizes a 64-byte empty-value P\' from HEAD slot 0 and the NEW slot', () => {
    const head = '00'.repeat(32);
    const next = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const dumpedNew = next + '00'.repeat(96);
    const expected = binToHex(encodeEntryCommitment(new Uint8Array(32), hexToBin(next)));
    expect(expected).toBe(head + next);
    expect(expected).toHaveLength(128);
    expect(synthesizePredNewCommitment('', next)).toBe(expected);
    expect(synthesizePredNewCommitment(head, next)).toBe(expected);
    expect(synthesizePredNewCommitment('00'.repeat(128), dumpedNew)).toBe(expected);
    expect(synthesizePredNewCommitment(head, next).length).toBe(128);
  });

  it('repairs the whitelist publishJobPost occupancy band without moving tails or jobs', () => {
    const headLock = hexToBin('aa2047362c5b4a0c597c12b75c90f68f6933b2e86c63eb6ce7ed46e083407361b7b587');
    const jobEventsLock = hexToBin('aa20890e27f0da5beec909520167c19723057491ec6170503a2420c6061544694c5b87');
    const eventLock = hexToBin('aa207bfacc17406829dd9ccc78306f099dc6905493f8c1d567e8c832bc8c1a05723b87');
    const jobsLock = hexToBin('aa205fb1eb39120f78f4bfce4deca3c658feca264d8df382e6ebb9310a9fcec0162887');
    const p2pkh = hexToBin('76a91471782e8159265ed94bd35b8e699c08f53a6f38c688ac');
    const md = 'ee643a1671fbbe53';
    const newSlot = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const dumpedNew = newSlot + '00'.repeat(96);
    const emptyHead = '00'.repeat(128);
    const expectedPPrime = binToHex(encodeEntryCommitment(new Uint8Array(32), hexToBin(newSlot)));
    const created = '00004cb42000437265617465' + '11'.repeat(20);
    const whitelist = '010000000000000000000000' + '22'.repeat(10);
    const pad = (): { to: Uint8Array; amount: bigint } => ({ to: Uint8Array.of(0x51), amount: 1000n });
    const outputs: Array<{
      to: Uint8Array;
      amount?: bigint;
      token?: { category?: string; nft?: { capability?: string; commitment?: string } };
    }> = Array.from({ length: 47 }, pad);

    outputs[20] = { to: p2pkh, amount: 1000n };
    outputs[21] = {
      to: eventLock,
      token: { category: md, nft: { capability: 'none', commitment: '005e1976a91447d9fe52d462' } },
    };
    outputs[22] = {
      to: headLock,
      token: { category: md, nft: { capability: 'mutable', commitment: dumpedNew } },
    };
    outputs[23] = {
      to: jobEventsLock,
      token: { category: md, nft: { capability: 'mutable', commitment: newSlot } },
    };
    outputs[24] = {
      to: jobEventsLock,
      token: { category: md, nft: { capability: 'mutable', commitment: created } },
    };
    outputs[25] = {
      to: jobEventsLock,
      token: { category: md, nft: { capability: 'mutable', commitment: whitelist } },
    };
    outputs[27] = {
      to: eventLock,
      token: { category: md, nft: { capability: 'none', commitment: 'parked-event' } },
    };
    outputs[38] = { to: Uint8Array.of(0x51), token: { category: md, nft: { capability: 'none', commitment: 'tail38' } } };
    outputs[39] = { to: Uint8Array.of(0x51), token: { category: md, nft: { capability: 'none', commitment: 'tail39' } } };
    outputs[40] = { to: Uint8Array.of(0x51), token: { category: md, nft: { capability: 'none', commitment: 'tail40' } } };
    outputs[45] = { to: jobsLock, token: { category: 'jobs', nft: { capability: 'mutable', commitment: 'job0' } } };
    outputs[46] = { to: jobsLock, token: { category: 'jobs', nft: { capability: 'mutable', commitment: 'job1' } } };

    const predNew = synthesizePredNewCommitment(emptyHead, dumpedNew);
    expect(predNew).toBe(expectedPPrime);
    expect(predNew).toBe('00'.repeat(32) + newSlot);
    expect(isSortedEntryNodeCommitment(dumpedNew)).toBe(true);
    expect(isSortedEntryHeadCommitment(emptyHead)).toBe(true);
    expect(shouldOverwriteForSameIndexTwin(outputs[21], headLock, md, predNew)).toBe(true);
    expect(placeSameIndexTwin(outputs, 21, {
      to: headLock,
      amount: 1000n,
      token: { category: md, nft: { capability: 'mutable', commitment: predNew } },
    }, {
      tailStart: 38,
      suffixStart: 45,
      reservedIndexes: [23],
      skipLocks: [jobEventsLock],
    })).toBe(true);
    expect(stripSurplusEmptyCollectionEntries(outputs, jobEventsLock, 2)).toBe(1);
    const newNode = outputs[22];
    expect(placeInsertNewAt(outputs, 23, newNode, {
      tailStart: 38,
      suffixStart: 45,
      skipLocks: [jobEventsLock],
    })).toBe(23);
    outputs[22] = { to: Uint8Array.of(0x51), amount: 1000n };
    outputs[20] = {
      to: headLock,
      token: { category: md, nft: { capability: 'mutable', commitment: emptyHead } },
    };
    expect(stripSurplusEmptyCollectionEntries(outputs, headLock, 2)).toBe(1);

    const jobEventMutables = outputs.filter((output) => (
      output.to.length === jobEventsLock.length
      && output.to.every((byte, offset) => byte === jobEventsLock[offset])
      && output.token?.nft?.capability === 'mutable'
    ));
    expect(jobEventMutables).toHaveLength(2);
    expect(outputs[21].to).toEqual(headLock);
    expect(outputs[21].token?.nft?.commitment).toBe(expectedPPrime);
    expect(outputs[21].token?.nft?.commitment).toHaveLength(128);
    expect(outputs[23].to).toEqual(headLock);
    expect(outputs[23].token?.nft?.commitment).toBe(dumpedNew);
    expect(outputs[20].token).toBeUndefined();
    expect(outputs).toHaveLength(47);
    expect(outputs[26].token?.nft?.commitment).toBe('005e1976a91447d9fe52d462');
    expect(outputs[27].token?.nft?.commitment).toBe('parked-event');
    expect(outputs[38].token?.nft?.commitment).toBe('tail38');
    expect(outputs[39].token?.nft?.commitment).toBe('tail39');
    expect(outputs[40].token?.nft?.commitment).toBe('tail40');
    expect(outputs[45].token?.nft?.commitment).toBe('job0');
    expect(outputs[46].token?.nft?.commitment).toBe('job1');
  });

  it('updates a stale same-lock predecessor to the 64-byte P\' without splicing', () => {
    const lock = new Uint8Array(35);
    lock[0] = 0xaa; lock[1] = 0x20; lock[34] = 0x87;
    const next = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const predNew = synthesizePredNewCommitment('', next);
    const outputs = [
      { to: lock, token: { category: 'md', nft: { capability: 'mutable' as const, commitment: '00'.repeat(32) } } },
      { to: lock, token: { category: 'md', nft: { capability: 'mutable' as const, commitment: next } } },
    ];
    expect(shouldOverwriteForSameIndexTwin(outputs[0], lock, 'md', predNew)).toBe(true);
    expect(placeSameIndexTwin(outputs, 0, {
      to: lock,
      token: { category: 'md', nft: { capability: 'mutable' as const, commitment: predNew } },
    }, { tailStart: 2, suffixStart: 2 })).toBe(true);
    expect(outputs).toHaveLength(2);
    expect(outputs[0].token?.nft?.commitment).toBe(predNew);
    expect(outputs[0].token?.nft?.commitment).toHaveLength(128);
    expect(outputs[1].token?.nft?.commitment).toBe(next);
  });

  it('overwrites a nested event at the input index and parks it on a later pad', () => {
    const collection = new Uint8Array(35);
    collection[0] = 0xaa; collection[1] = 0x20; collection[34] = 0x87;
    const eventLock = new Uint8Array(35);
    eventLock[0] = 0xaa; eventLock[1] = 0x20; eventLock[2] = 0x7b;
    const outputs = [
      { to: Uint8Array.of(0x51) },
      { to: eventLock, token: { category: 'md', nft: { capability: 'none' as const } } },
      { to: Uint8Array.of(0x51) },
      { to: Uint8Array.of(0x51), token: { category: 'md', nft: { capability: 'none' as const, commitment: '51' } } },
    ];
    const twin = {
      to: collection,
      token: { category: 'md', nft: { capability: 'mutable' as const } },
    };
    expect(shouldOverwriteForSameIndexTwin(outputs[1], collection, 'md')).toBe(true);
    expect(placeSameIndexTwin(outputs, 1, twin, { tailStart: 3, suffixStart: 4 })).toBe(true);
    expect(outputs[1].token?.nft?.capability).toBe('mutable');
    expect(outputs[2].token?.nft?.capability).toBe('none');
    expect(outputs[3].token?.nft?.commitment).toBe('51');
  });

  it('detects one active chunkable array writer independently of function and collection names', () => {
    expect(groupWritesSingleChunkableArrayCollection({
      functionName: 'append', logicalFunctionName: 'append',
    })).toBe(false);
    const groupFor = (
      functionName: string,
      collectionName: string,
    ): Parameters<typeof groupChunkableArrayWriteCollection>[0] => ({
      functionName: '__forward',
      logicalFunctionName: functionName,
      stateLayout: {
        variables: [], dataNftCount: 0, commitmentLimit: 128,
        collections: [{
          name: collectionName,
          signature: `${collectionName}:mapping(int => bytes[])`,
          kind: 'mapping' as const,
          keyType: 'int256',
          valueType: 'bytes[]',
          chunkableValue: true,
        }],
      },
      compilerRoute: {
        abiFunction: { name: '__route', inputs: [] },
        rowArguments: [{
          handler: {
            name: functionName,
            inputs: [],
            entryAccesses: [{
              collection: collectionName, keyParams: ['key'], operations: ['write'],
            }],
          },
        }],
      },
    });
    expect(groupChunkableArrayWriteCollection(groupFor('append', 'records'))).toBe('records');
    expect(groupChunkableArrayWriteCollection(groupFor('store', 'segments'))).toBe('segments');
    expect(groupWritesSingleChunkableArrayCollection(groupFor('store', 'segments'))).toBe(true);
    const signatureAddressed = groupFor('replace', 'payloads');
    signatureAddressed.compilerRoute!.rowArguments![0].handler.entryAccesses![0].collection =
      signatureAddressed.stateLayout!.collections![0].signature;
    expect(groupChunkableArrayWriteCollection(signatureAddressed)).toBe('payloads');
  });

  it('honors active route writes and refuses ambiguous chunkable array collections', () => {
    const stateLayout = {
      variables: [], dataNftCount: 0, commitmentLimit: 128,
      collections: ['first', 'second'].map((name) => ({
        name,
        signature: `${name}:mapping(int => bytes[])`,
        kind: 'mapping' as const,
        keyType: 'int256',
        valueType: 'bytes[]',
        chunkableValue: true,
      })),
    };
    const handler = {
      name: 'writeBoth',
      inputs: [],
      entryAccesses: ['first', 'second'].map((collection) => ({
        collection, keyParams: ['key'], operations: ['write'],
      })),
    };
    const ambiguous = {
      functionName: '__forward', stateLayout,
      compilerRoute: { abiFunction: { name: '__route', inputs: [] }, rowArguments: [{ handler }] },
    };
    expect(groupChunkableArrayWriteCollection(ambiguous)).toBeUndefined();
    expect(groupWritesSingleChunkableArrayCollection(ambiguous)).toBe(false);

    const selected = {
      ...ambiguous,
      compilerRoute: {
        ...ambiguous.compilerRoute,
        abiFunction: {
          name: '__route', inputs: [], messageBusActiveWriteCollections: ['second'],
        },
      },
    };
    expect(groupChunkableArrayWriteCollection(selected)).toBe('second');
  });

  it('rewrites transferFrom NEW at master+4 to the P\' collection lock', () => {
    const pred = hexToBin('aa20791c538fb2fe539b54c73708c74489fa6c9366f2c0d631713c72f98ccff61c8787');
    const other = hexToBin('aa208d7630fa347b05be1ef9a44b957ebc24877930faf9713d510ed43bce44ce97dd87');
    const outputs = [
      { to: Uint8Array.of(0x51), token: { category: 'ft', nft: { capability: 'minting' as const } } },
      { to: Uint8Array.of(0x51), token: { category: 'ft', nft: { capability: 'mutable' as const } } },
      { to: pred, token: { category: 'ft', nft: { capability: 'mutable' as const, commitment: 'e2' } } },
      { to: other, token: { category: 'ft', nft: { capability: 'mutable' as const, commitment: '6e' } } },
      { to: other, token: { category: 'ft', nft: { capability: 'mutable' as const, commitment: '72' } } },
    ];
    expect(reassertTokenInsertNewLock(outputs, 0, 'ft')).toBe(true);
    expect(binToHex(outputs[4].to as Uint8Array)).toBe(binToHex(pred));
    expect(outputs[4].token?.nft?.commitment).toBe('72');
    expect(reassertTokenInsertNewLock(outputs, 0, 'ft')).toBe(false);
  });

  it('restores a 1:1 balances entry output overwritten by an allowances lock', () => {
    const balancesLock = hexToBin(`aa20${'99'.repeat(32)}87`);
    const allowancesLock = hexToBin(`aa20${'b8'.repeat(32)}87`);
    const fromSlot = 'e2'.repeat(32);
    const fromUpdate = `${fromSlot}${'21'.repeat(32)}000010632d5ec76b05`;
    const outputs = Array.from({ length: 8 }, () => ({
      to: Uint8Array.of(0x51), amount: 1000n,
    }));
    outputs[2] = {
      to: balancesLock,
      amount: 1200n,
      token: { amount: 0n, category: 'ft', nft: { capability: 'mutable' as const, commitment: `${'2e'.repeat(32)}00` } },
    };
    outputs[4] = {
      to: allowancesLock,
      amount: 1200n,
      token: { amount: 0n, category: 'ft', nft: { capability: 'mutable' as const, commitment: 'aa'.repeat(64) } },
    };
    // A same-slot balances update exists elsewhere (displaced).
    outputs[6] = {
      to: balancesLock,
      amount: 1200n,
      token: { amount: 0n, category: 'ft', nft: { capability: 'mutable' as const, commitment: fromUpdate } },
    };
    const inputs = Array.from({ length: 8 }, () => ({
      satoshis: 1200n,
      token: undefined as undefined | { category: string; nft: { capability: string; commitment: string } },
      unlocker: { generateLockingBytecode: () => Uint8Array.of(0x51) },
    }));
    inputs[4] = {
      satoshis: 1200n,
      token: { category: 'ft', nft: { capability: 'mutable', commitment: `${fromSlot}${'00'.repeat(40)}` } },
      unlocker: { generateLockingBytecode: () => balancesLock },
    };
    // Use the exported helper path through reassertBatchPredecessor + manual 1:1 expectation:
    // after repair, slot +4 must carry balances lock and the same-slot update commitment.
    expect(binToHex(outputs[4].to as Uint8Array)).toBe(binToHex(allowancesLock));
    // Simulate the trailing-mode 1:1 restore body.
    const inLock = inputs[4].unlocker.generateLockingBytecode();
    const inSlot = String(inputs[4].token?.nft.commitment ?? '').slice(0, 64);
    const sameSlot = outputs.find((candidate, index) => (
      index !== 4
      && candidate.to instanceof Uint8Array
      && binToHex(candidate.to) === binToHex(balancesLock)
      && String(candidate.token?.nft?.commitment ?? '').startsWith(inSlot)
    ));
    outputs[4] = {
      to: inLock,
      amount: 1200n,
      token: {
        amount: 0n,
        category: 'ft',
        nft: { capability: 'mutable', commitment: String(sameSlot?.token?.nft?.commitment ?? '') },
      },
    };
    expect(binToHex(outputs[4].to as Uint8Array)).toBe(binToHex(balancesLock));
    expect(outputs[4].token?.nft?.commitment).toBe(fromUpdate);
  });

  it('rejects empty nested batch seeds and debits the co-spent balances input', () => {
    // post job 1 FakeToken@19: nested planBatchUpsert publishes slot||next only for balances[from].
    // Repair must not stamp that empty seed after allowances overwrite +4.
    const fromSlot = 'e2a4aac2498e0a62d7a3936482584bb94059e33c96b7090c81338243b335d559';
    const emptyPlanned = `${fromSlot}${'00'.repeat(32)}`;
    const inputValue = 1_000_000n;
    const amount = 100n;
    const inputCommitment = binToHex(encodeEntryCommitment(
      hexToBin(fromSlot),
      new Uint8Array(32),
      bigIntToVmNumber(inputValue),
    ));
    expect(entryCommitmentLacksValue(emptyPlanned)).toBe(true);
    expect(entryCommitmentLacksValue(inputCommitment)).toBe(false);
    const restored = resolveRestoredBalancesEntryCommitment({
      planned: emptyPlanned,
      inputCommitment,
      amount,
    });
    expect(restored).toBeDefined();
    expect(entryCommitmentLacksValue(restored)).toBe(false);
    expect(restored!.startsWith(fromSlot)).toBe(true);
    expect(restored!.slice(64, 128)).toBe('00'.repeat(32));
    expect(vmNumberToBigInt(hexToBin(restored!.slice(128)), { requireMinimalEncoding: false }))
      .toBe(inputValue - amount);
    // Value-bearing planned still wins over debit.
    const plannedUpdate = binToHex(encodeEntryCommitment(
      hexToBin(fromSlot), hexToBin('21'.repeat(32)), bigIntToVmNumber(inputValue - amount),
    ));
    expect(resolveRestoredBalancesEntryCommitment({
      planned: plannedUpdate,
      inputCommitment,
      amount: 1n,
    })).toBe(plannedUpdate);

    // Marketplace posts encode transfer value as a VM-number Uint8Array (100e18), not a bigint.
    const vmAmount = bigIntToVmNumber(amount);
    expect(typeof vmAmount === 'object').toBe(true);
    const fromVm = resolveRestoredBalancesEntryCommitment({
      planned: emptyPlanned,
      inputCommitment,
      amount: vmNumberToBigInt(vmAmount, { requireMinimalEncoding: false }),
    });
    expect(fromVm).toBe(restored);
  });

  it('rewrites a trailing balances PredOut lock when allowances occupies the absolute slot', () => {
    // post job 1: master=19, balances P' at +2; builder PredOut_0 is block-relative 8 (abs 27),
    // while some unlocker dumps show absolute 28 — accept both encodings in the repair path.
    const balancesLock = hexToBin(`aa20${'99'.repeat(32)}87`);
    const allowancesLock = hexToBin(`aa20${'b8'.repeat(32)}87`);
    const master = 19;
    const outputs = Array.from({ length: 30 }, () => ({
      to: Uint8Array.of(0x51), amount: 1000n,
    }));
    outputs[master + 2] = {
      to: balancesLock,
      amount: 1200n,
      token: { amount: 0n, category: 'ft', nft: { capability: 'mutable' as const, commitment: 'e2' } },
    };
    outputs[master + 8] = {
      to: allowancesLock,
      amount: 1200n,
      token: { amount: 0n, category: 'ft', nft: { capability: 'mutable' as const, commitment: 'p1' } },
    };
    expect(reassertTokenInsertNewLock(outputs, master, 'ft', 2, 8)).toBe(true);
    expect(binToHex(outputs[master + 8].to as Uint8Array)).toBe(binToHex(balancesLock));
    expect(outputs[master + 8].token?.nft?.commitment).toBe('p1');
    // Absolute encoding (master+relative) also works.
    outputs[master + 8] = {
      to: allowancesLock,
      amount: 1200n,
      token: { amount: 0n, category: 'ft', nft: { capability: 'mutable' as const, commitment: 'p2' } },
    };
    expect(reassertTokenInsertNewLock(outputs, master, 'ft', 2, (master + 8) - master)).toBe(true);
  });

  it('moves a misplaced NEW commitment off the predecessor output onto master+4', () => {
    const lock = new Uint8Array(35);
    lock[0] = 0xaa; lock[1] = 0x20; lock[34] = 0x87;
    const predSlot = 'e2a4aac2498e0a62d7a3936482584bb94059e33c96b7090c81338243b335d559';
    const newSlot = '3b62bcf186d4c341a5f84ec6ab02bf8edb91e8e560718815bccb608e4449a877';
    const inputCommit = `${predSlot}${'00'.repeat(32)}0000a0dec5adc93536`;
    const misplacedNew = `${newSlot}${'00'.repeat(32)}000010632d5ec76b05`;
    const inputs = [
      { token: { category: 'ft', nft: { capability: 'minting' as const, commitment: '' } } },
      {},
      {
        token: { category: 'ft', nft: { capability: 'mutable' as const, commitment: inputCommit } },
        unlocker: { generateLockingBytecode: () => lock },
      },
    ];
    const outputs = [
      { to: Uint8Array.of(0x51), token: { category: 'ft', nft: { capability: 'minting' as const } } },
      { to: Uint8Array.of(0x51) },
      { to: lock, token: { category: 'ft', nft: { capability: 'mutable' as const, commitment: misplacedNew } } },
      { to: Uint8Array.of(0x51) },
      { to: Uint8Array.of(0x51), token: { category: 'other', nft: { capability: 'mutable' as const, commitment: 'aa' } } },
    ];
    expect(reassertTokenInsertCommitments(outputs, inputs, 0, 'ft')).toBe(true);
    expect(outputs[2].token?.nft?.commitment?.startsWith(predSlot)).toBe(true);
    expect(outputs[2].token?.nft?.commitment?.slice(64, 128)).toBe(newSlot);
    expect(outputs[4].token?.nft?.commitment).toBe(misplacedNew);
    expect(binToHex(outputs[4].to as Uint8Array)).toBe(binToHex(lock));
    expect(reassertTokenInsertCommitments(outputs, inputs, 0, 'ft')).toBe(false);
  });

  it('derives insert-lock repair offsets from renamed compiler descriptors', () => {
    const routed = {
      functionName: 'moveUnitsFrom',
      compilerRoute: { abiFunction: {
        name: 'routeMoveUnitsFrom',
        inputs: [],
        writesState: true,
        entryAccesses: [{
          collection: 'ledger:mapping(bytes20 => int)',
          keyParams: ['owner'],
          operations: ['read', 'write'] as Array<'read' | 'write'>,
        }, {
          collection: 'ledger:mapping(bytes20 => int)',
          keyParams: ['recipient'],
          operations: ['write'] as Array<'write'>,
        }, {
          collection: 'permits:mapping(bytes20 => int)',
          keyParams: ['spender'],
          operations: ['write'] as Array<'write'>,
        }],
        blockLayout: {
          blockSize: 8,
          slots: [
            { kind: 'master' as const, offset: 0 },
            { kind: 'entry' as const, offset: 3, slotIndex: 0 },
            { kind: 'entry' as const, offset: 5, slotIndex: 1 },
            { kind: 'entry' as const, offset: 7, slotIndex: 2 },
          ],
        },
      } },
      plannedEntryInserts: [{
        blockSlot: 3, outputBlockSlot: 8, newCommitment: 'ab'.repeat(32) + '00'.repeat(32),
      }],
    };
    expect(entryInsertLockRepairs(routed)).toEqual([{
      collection: 'ledger:mapping(bytes20 => int)',
      predecessorOffset: 3,
      candidateInsertedOffsets: [5, 7],
      insertedSlot: 'ab'.repeat(32),
    }]);
    const predecessorLock = hexToBin(`aa20${'11'.repeat(32)}87`);
    const wrongLock = hexToBin(`aa20${'22'.repeat(32)}87`);
    const outputs: Parameters<typeof reassertDescribedEntryInsertLocks>[0] = Array.from(
      { length: 8 }, () => ({ to: Uint8Array.of(0x51) }),
    );
    outputs[3] = {
      to: predecessorLock,
      token: { category: 'ft', nft: { capability: 'mutable', commitment: 'cd'.repeat(64) } },
    };
    outputs[5] = {
      to: wrongLock,
      token: { category: 'ft', nft: { capability: 'mutable', commitment: 'ef'.repeat(64) } },
    };
    outputs[7] = {
      to: wrongLock,
      token: { category: 'ft', nft: { capability: 'mutable', commitment: 'ab'.repeat(64) } },
    };
    expect(reassertDescribedEntryInsertLocks(outputs, 0, 'ft', routed)).toBe(1);
    expect(outputs[5].to).toEqual(wrongLock);
    expect(outputs[7].to).toEqual(predecessorLock);

    // Published effect metadata makes a familiar name powerless when no planned INSERT exists.
    expect(entryInsertLockRepairs({
      ...routed,
      functionName: 'transferFrom',
      compilerRoute: { abiFunction: {
        ...routed.compilerRoute.abiFunction,
        name: 'transferFrom',
        entryAccesses: [],
      } },
      plannedEntryInserts: [],
    })).toEqual([]);
    expect(entryInsertLockRepairs({
      ...routed,
      functionName: 'transferFrom',
      plannedEntryInserts: [{
        blockSlot: 2, outputBlockSlot: 8, newCommitment: 'ab'.repeat(64),
      }],
    })).toEqual([]);

    // Only an explicitly legacy-unroll descriptor-free artifact retains the historical coordinates.
    expect(entryInsertLockRepairs({
      functionName: 'transferFrom',
      logicalArtifact: { messageBus: { convention: 'legacy-unroll' } } as unknown as Artifact,
    })).toEqual([{
      collection: '', predecessorOffset: 2, candidateInsertedOffsets: [4], insertedSlot: '',
    }]);
    expect(entryInsertLockRepairs({ functionName: 'transferFrom' })).toEqual([]);
    expect(entryInsertLockRepairs({
      functionName: 'transferFrom',
      logicalArtifact: { messageBus: { convention: 'kernel-row-loop' } } as unknown as Artifact,
    })).toEqual([]);

    // A renamed linear batch publishes the two entry accesses which share one sorted collection. No source
    // spelling or positional value argument participates in selecting its repair geometry.
    const linear = {
      functionName: 'moveUnitsFrom',
      logicalFunctionArgs: [9n, 'alice', 'bob'],
      compilerRoute: { abiFunction: {
        name: 'moveUnitsFrom',
        inputs: [
          { name: 'quantity', type: 'uint256' },
          { name: 'source', type: 'address' },
          { name: 'destination', type: 'address' },
        ],
        writesState: true,
        entryAccesses: [
          {
            collection: 'ledger', keyParams: ['destination'], operations: ['read', 'write'],
            valueSource: 'binop:+(entry,id:quantity)',
          },
          { collection: 'permits', keyParams: ['source'], operations: ['read', 'write'] },
          {
            collection: 'ledger', keyParams: ['source'], operations: ['read', 'write'],
            valueSource: 'binop:-(entry,id:quantity)',
          },
        ],
        sortedBatchInfo: [{ collection: 'ledger', slotIndices: [0, 2], linear: true }],
        blockLayout: {
          blockSize: 8,
          slots: [
            { kind: 'master' as const, offset: 0 },
            { kind: 'dataNft' as const, offset: 1, nftIndex: 0 },
            { kind: 'entry' as const, offset: 2, slotIndex: 0 },
            { kind: 'entry' as const, offset: 3, slotIndex: 1 },
            { kind: 'entry' as const, offset: 4, slotIndex: 2 },
          ],
        },
      } },
      plannedEntryInserts: [],
    };
    expect(linearSortedBatchEntryBands(linear)).toEqual([{
      collection: 'ledger', offsets: [2, 4],
    }]);
    expect(linearSortedBatchValueArgument(linear, 'ledger')).toBe(9n);
    expect(entryInsertLockRepairs(linear)).toEqual([{
      collection: 'ledger',
      predecessorOffset: 2,
      candidateInsertedOffsets: [4],
      insertedSlot: '',
    }]);
    const ledgerLock = hexToBin(`aa20${'41'.repeat(32)}87`);
    const permitLock = hexToBin(`aa20${'52'.repeat(32)}87`);
    const batchOutputs = Array.from({ length: 5 }, () => ({ to: Uint8Array.of(0x51) }));
    batchOutputs[2] = { to: ledgerLock, token: { category: 'token' } } as never;
    batchOutputs[3] = { to: permitLock, token: { category: 'token' } } as never;
    batchOutputs[4] = { to: ledgerLock, token: { category: 'token' } } as never;
    expect([...linearSortedBatchPlannedLockCounts(batchOutputs, 0, 'token', linear)])
      .toEqual([[binToHex(ledgerLock), 2]]);

    // A familiar application name without compiler batch authority remains inert.
    const decoy = {
      ...linear,
      functionName: 'transferFrom',
      compilerRoute: { abiFunction: {
        ...linear.compilerRoute.abiFunction, name: 'transferFrom', sortedBatchInfo: undefined,
      } },
    };
    expect(linearSortedBatchEntryBands(decoy)).toEqual([]);
    expect(linearSortedBatchPlannedLockCounts(batchOutputs, 0, 'token', decoy).size).toBe(0);

    // Even one tempting numeric non-key argument is not a mutation value without compiler-authenticated
    // valueSource provenance for the selected collection.
    const unrelatedNumericDecoy = {
      ...linear,
      functionName: 'transferFrom',
      compilerRoute: { abiFunction: {
        ...linear.compilerRoute.abiFunction,
        name: 'transferFrom',
        entryAccesses: linear.compilerRoute.abiFunction.entryAccesses.map((access) => ({
          ...access, valueSource: undefined,
        })),
      } },
    };
    expect(linearSortedBatchEntryBands(unrelatedNumericDecoy)).toHaveLength(1);
    expect(linearSortedBatchValueArgument(unrelatedNumericDecoy, 'ledger')).toBeUndefined();
  });

  it('reorders a linear proof successor at descriptor-owned nonstandard offsets', () => {
    const category = 'token';
    const lock = hexToBin(`aa20${'63'.repeat(32)}87`);
    const proofSlot = '71'.repeat(32);
    const successorSlot = '82'.repeat(32);
    const tailSlot = '93'.repeat(32);
    const predecessor = `${proofSlot}${successorSlot}01`;
    const successor = `${successorSlot}${tailSlot}02`;
    const master = 2;
    const outputs = Array.from({ length: 12 }, () => ({ to: Uint8Array.of(0x51) })) as Parameters<
      typeof reorderLinearBatchProofSuccessor
    >[0];
    outputs[master + 3] = {
      to: lock, amount: 1300n,
      token: { category, nft: { capability: 'mutable', commitment: predecessor } },
    };
    outputs[master + 7] = {
      to: Uint8Array.of(0x51), amount: 1400n,
      token: { category, nft: { capability: 'mutable', commitment: successor } },
    };
    const inputs = Array.from({ length: 12 }, () => ({})) as Parameters<
      typeof reorderLinearBatchProofSuccessor
    >[1];
    inputs[master + 5] = { token: { nft: { commitment: `${proofSlot}${tailSlot}03` } } };
    const repair = {
      collection: 'ledger', predecessorOffset: 3, candidateInsertedOffsets: [7],
      proofInputOffset: 5, insertedSlot: '',
    };
    const ambiguousOutputs = outputs.map((output) => ({
      ...output,
      ...(output.token && { token: { ...output.token, nft: { ...output.token.nft } } }),
    }));
    ambiguousOutputs[master + 9] = {
      to: lock, amount: 1500n,
      token: {
        category, nft: { capability: 'mutable', commitment: `${successorSlot}${'a4'.repeat(32)}04` },
      },
    };
    expect(reorderLinearBatchProofSuccessor(ambiguousOutputs, inputs, master, category, {
      ...repair, candidateInsertedOffsets: [7, 9],
    })).toBe(false);
    expect(ambiguousOutputs[master + 3].token?.nft?.commitment).toBe(predecessor);
    expect(reorderLinearBatchProofSuccessor(outputs, inputs, master, category, repair)).toBe(true);
    expect(outputs[master + 3].token?.nft?.commitment).toBe(successor);
    expect(outputs[master + 7].token?.nft?.commitment).toBe(predecessor);
    expect(outputs[master + 3].to).toEqual(lock);
    expect(outputs[master + 7].to).toEqual(lock);
    expect(reorderLinearBatchProofSuccessor(outputs, inputs, master, category, repair)).toBe(false);
  });
});
