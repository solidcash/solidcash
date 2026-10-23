/* eslint-disable @typescript-eslint/no-loop-func */
import {
  type StateLayout,
  parseEntryCommitment,
  getDefaultStateValue,
  encodePushdataValue,
  type EventDefinitionAbi,
  type StateValue,
  type FunctionBlockLayout,
  type AbiFunction,
  type BlockSlotKind,
  attachDecodedAccessors,
  type Artifact,
  encodeChunkableValueTail,
  EVENT_CHUNK_BYTES,
  isAuxiliaryBlockSlot,
  sha256,
} from '@solidcash/utils';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import { binToHex, binsAreEqual, hexToBin, isHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { encodeTransaction } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import { buildSidecarRedeem, sidecarLockingBytecode, scriptToBytecode } from '@solidcash/utils';
import { TransactionBuilder, type TransactionBuilderOptions } from '../TransactionBuilder.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../utils.js';
import type { LibauthOutput, Output, ReceiptEvent } from '../interfaces.js';
import { onMockNetworkProviderReset } from '../network/mock-reset.js';
import { clearCollectionValueRecords } from './ValueChunkPersistence.js';
import { assertFinalizedTransactionCovenants } from '../message-bus/preflight.js';
import { parseEventCommitment } from './StateReader.js';
import { eventContinuationLockingBytecode, joinEventContinuations } from './event-chunks.js';
import { type Utxo, type UnlockableUtxo, type TransactionDetails, isContractUnlocker, type Unlocker } from '../interfaces.js';
import { callRecordDigest, callRecordHashesResult, parseCallRecord } from './call-record.js';
import { BALANCED_SLOT_SATOSHIS } from './balancedBlocks.js';
import { isScidIdentityCommitment } from './logical-identity.js';
import { sameIndexScidIdentityInputIndices } from './same-index-scid.js';

/** Select a continuation lock without allowing compatibility state to override a live covenant pin. */
export function selectValueChunkRedeemLock(parts: {
  computed?: Uint8Array;
  covenantObserved?: Uint8Array;
  compatibility?: Uint8Array;
  cached?: Uint8Array;
}): Uint8Array | undefined {
  return parts.computed ?? parts.covenantObserved ?? parts.compatibility ?? parts.cached;
}

/** Resolve a CREATE anchor from physical inputs; a category cannot nominate two logical senders. */
export function findScidAnchorInputIndex(inputs: readonly Pick<Utxo, 'token'>[], categoryId: string): number {
  let found = -1;
  for (let index = 0; index < inputs.length; index += 1) {
    const token = inputs[index].token;
    if (token?.category.toLowerCase() !== categoryId.toLowerCase()
      || token.nft?.capability !== 'none'
      || !isScidIdentityCommitment(token.nft.commitment)) continue;
    if (found >= 0) throw new Error(`Ambiguous CREATE identity anchors for category ${categoryId}.`);
    found = index;
  }
  return found;
}

/** Convert a participant-local continuation coordinate into its aggregate transaction coordinate. */
export function absoluteComposedValueChunkOutputBase(outputBase: number, blockBase: number): number {
  return outputBase < 0 ? outputBase : outputBase + blockBase;
}
import { decodeEntryCommitment, encodeEntryCommitment } from './SortedList.js';
import { planKernelEntryJournalOutputLayout, type KernelEntryJournalOutputLayoutPlan } from './KernelEntryJournal.js';
import { resolveExternalResultEncoding } from './solidityAbi.js';
import { encodeExternalReturnValue } from './external-return-encoding.js';
import { buildKeccakComputeSidecar, extractKeccakPreimageFromTrace } from '../keccak/keccakComputeSidecar.js';
import { legacyGroupLooksLikePublishJobEvent } from './legacy-planning-heuristics.js';
export {
  collectionValuePhysicalBindings,
  planCompilerTrailingResources,
} from './compiler-trailing-resources.js';


export {
  type InBlockReturnGroup,
  groupOwnsInBlockReturnEvent,
  logicalReturnGroupIndex,
  type PhysicalReturnGroup,
  type MaterializedReturnEvent,
  type ExternalCallReturnCoordinate,
  parseExternalCallReturnCoordinate,
  type MaterializedReturnGroup,
  selectMaterializedTailReturnEvents,
  isMintingBandTokenWriter,
  isMintingBandSwapFunction,
  isCompilerDescribedMintingBandWriter,
  shouldRestorePersistedContinuationInputs,
  canonicalWriterReturnCommitment,
  shouldReplaceReturnEventCommitment,
  isAllZeroCommitment,
  tokenWriterReturnIndex,
  shouldRetainMintingOutputSwap,
  liveChunkSlotsByOwner,
  liveChunkWidthForGroup,
  physicalParticipantWidth,
  materializedParticipantWidth,
  participantSpanOverlapsLane,
  collidingParticipantGroupIndex,
  type TokenBandRepairOwnerSelection,
  selectTokenBandRepairOwner,
  proxyValueChunkPadCount,
  participantRelocationExtraFunders,
  valueChunkBandWidth,
  valueChunkBandWidthForContinuationClaims,
  continuationOutputBaseBeforeSuffix,
  selectValueChunkOutputBase,
  viewTailOccupancyCap,
  type ViewTailPackOptions,
  clampViewTailPlacement,
  liveChunkableValueBandWidth,
  scaledInputPreserveExclusiveEnd,
  scaledEventOutputIndex,
} from './value-chunk-geometry.js';
// A type-only import: the erased export is absent when this module is resolved from source (the `examples` script
// runs under tsx against the root tsconfig paths), so importing it as a value breaks that path while it builds.
import type { CompilerTokenWriterGroup } from './value-chunk-geometry.js';
export type { CompilerTokenWriterGroup };
import {
  groupOwnsInBlockReturnEvent,
  logicalReturnGroupIndex,
  selectMaterializedTailReturnEvents,
  isCompilerDescribedMintingBandWriter,
  shouldReplaceReturnEventCommitment,
  isAllZeroCommitment,
  continuationOutputBaseBeforeSuffix,
  type ViewTailPackOptions,
} from './value-chunk-geometry.js';

export {
  ValueChunkWriteStagingSession,
  CompositionSettlementSession,
  getCompositionSettlementSession,
  createCompositionSettlementSession,
  runWithCompositionSettlementSession,
  settlement,
  type AuthenticatedValueChunk,
  selectObservedValueChunkRun,
  persistedJobEventsWidth,
  rememberJobEventsUnlockRecipe,
  persistedJobEventsUnlockRecipe,
  persistValueChunkLock,
  legacyJobEventsPersistValueChunkLock,
  stageJobEventsValue,
  rememberJobEventsValue,
  persistedJobEventsValue,
  rememberJobEventsLock,
  persistedCompatibilityValueChunkLock,
  type ValueChunkWriteDescriptor,
  type DerivedChunkOutputObservation,
  type LateValueSuffixInsertion,
  permitsHeuristicValueChunkRunRelocation,
  materializedValueChunkAbsoluteStart,
  sameDerivedChunkOutputObservation,
  valueChunkWriteResourceIdentity,
  stageValueChunkWrite,
  stagedValueChunkWrite,
  isValueChunkWriteReady,
  type ValueChunkWriteCategorySelection,
  type ValueChunkResourceSelection,
  selectValueChunkResource,
  selectValueChunkWriteCategory,
  isInitialValueChunkWrite,
  persistedValueChunkReadiness,
  shouldRematerializeDescribedValueChunkWrite,
  resolveValueChunkWriteCategory,
  rememberValueChunkUnlockRecipe,
  commitStagedValueChunkWrite,
  persistedValueChunkWriteState,
  selectPersistedValueChunkWrite,
  persistUpdateRedeemLock,
  isPersistedJobEventsReady,
  isPersistedCompatibilityValueChunkReady,
  markPersistedCompatibilityValueChunkReady,
  readyPersistedCompatibilityValueChunkWidth,
  valueChunkIndexFromCommitment,
  isEmptyValueChunkCommitment,
  latestPersisted,
  valueChunkWriteIdentity,
  valueChunkCountFor,
  coherentAuthenticatedValueChunkRun,
  firstUsableValueChunkRun,
} from './value-chunk-persist.js';
import {
  ValueChunkWriteStagingSession,
  settlement,
  type AuthenticatedValueChunk,
  selectObservedValueChunkRun,
  persistValueChunkLock,
  legacyJobEventsPersistValueChunkLock,
  persistedJobEventsValue,
  type ValueChunkWriteDescriptor,
  type DerivedChunkOutputObservation,
  type LateValueSuffixInsertion,
  valueChunkWriteResourceIdentity,
  stagedValueChunkWrite,
  isValueChunkWriteReady,
  type ValueChunkWriteCategorySelection,
  persistedValueChunkWriteState,
  selectPersistedValueChunkWrite,
  persistUpdateRedeemLock,
  valueChunkCountFor,
  coherentAuthenticatedValueChunkRun,
} from './value-chunk-persist.js';


export {
  decodeVmScriptNumber,
  legacyLiveValueChunkBandWidth,
  legacyComputePublishValueChunkBand,
  legacyFillValueChunkBandHoles,
  legacyPersistedValueChunkWidth,
  legacyPersistedValueChunkValue,
  legacyPersistedValueChunkLock,
  legacyPersistedValueChunkUnlockRecipe,
  legacyRememberValueChunkValue,
  legacyRememberValueChunkLock,
  legacyRememberValueChunkUnlockRecipe,
  legacyStageValueChunkValue,
  legacyIsPersistedValueChunkReady,
  stateVariableForUpdateKey,
  stateUpdatesTouchNft,
  tokenWriterOccupiedDests,
  persistAndTokenWriterOccupancy,
  findDisposableValueChunkOutputBase,
  computeChunkableValueWriteBand,
  boundedDerivationIterations,
  shouldGrowSpeculativeChunkRegion,
  seedChunksFromPersistedValue,
  applyRedeemLockToChunks,
  p2sh32LockFromValueRoot,
  selectHashedValueForChunkPin,
  extractIdentityScanValueChunkPin,
  chunksFromValue,
  chunksFromJobEventsValue,
  shouldKeepPersistAtLayoutBase,
} from './early-value-chunk-helpers.js';
import {
  decodeVmScriptNumber,
  stateVariableForUpdateKey,
  stateUpdatesTouchNft,
  seedChunksFromPersistedValue,
} from './early-value-chunk-helpers.js';

export {
  isPersistValueChunkCommitment,
  persistValueChunkBase,
  persistPredecessorPlaceCount,
  persistUpdatePredecessorDests,
  syncBuilderInputsFromAllInputs,
  persistPredecessorRank,
  orderPersistPredecessorCandidates,
  persistPredecessorWantedRank,
  assignPersistPredecessors,
  persistOccupantDisplaceable,
  writerBlockOccupancyEnd,
  packMutableValueChunkRunAgainstSeparator,
  relocateChangeAfterOccupancy,
} from './persist-predecessor-layout.js';

export {
  isP2sh32LockScript,
  isViewReturnTailOutput,
  isDisposableAlignmentPad,
  placeValueChunksOnBand,
  selectExpectedP2sh32OutputLock,
  selectValueChunkCommitmentObservations,
  fillValueChunkBandHoles,
  isOverwritableValueChunkOccupant,
  mintingSwapShift,
  expectedFromOtcEqualVerify,
  preferChunkCommitment,
  type ValueChunkTraceObservation,
} from './value-chunk-band-helpers.js';
import { isViewReturnTailOutput } from './value-chunk-band-helpers.js';

export {
  cloneToken,
  commitmentHexOf,
  outputMatchesLock,
} from './stb-output-utils.js';
import { cloneToken, commitmentHexOf } from './stb-output-utils.js';

export {
  chooseMintingSwapShift,
  chooseParticipantRelocationShift,
  gatherContiguousPlainFunders,
  lastCollidingMutableWriterIndex,
  findViewTailDestinations,
  assignPhysicalReturnIndices,
  returnWitnessOutputIndices,
  packTailReturnPlacements,
  assignedTailEnd,
} from './physical-return-layout.js';

export {
  isPredOutReusableHole,
  reassertBatchPredecessorOutputsAtDeclaredSlots,
  isOpReturnLockingBytecode,
  redirectViewTailOffOpReturn,
  moveTrailingOutputsBeforeValueChunkSuffix,
  moveLateOutputsBeforeReverseSuffix,
  hasEquivalentMutableNftOutput,
  stripRelocatedMutableDuplicates,
  isInsertBandDustToken,
  reassertNoneCapFunderTwins,
  reassertReadOnlyMutableOneToOnes,
  reassertDeclaredMutableSlotLock,
  clearMutableCollectionOutputsOutsideAuthoritativeRun,
} from './mutable-output-reassert.js';
import {
  isOpReturnLockingBytecode,
  clearMutableCollectionOutputsOutsideAuthoritativeRun,
} from './mutable-output-reassert.js';

export {
  isOutsideTokenWriterBlock,
  stripSurplusInvalidCollectionLockOutputs,
  stripInvalidCollectionLockOutputs,
  selectBalancedEntryOutputIdentity,
  stripSurplusEmptyCollectionEntries,
} from './collection-lock-strip.js';

export {
  SLOT_HEX,
  isSortedEntryHeadCommitment,
  isDataNftIndexCommitment,
  isSortedEntryNodeCommitment,
  synthesizePredNewCommitment,
} from './sorted-entry-commitment.js';

export {
  permitsLegacyNamedValueChunkFallback,
  permitsLegacyValueChunkEventReconstruction,
  permitsLegacyDelegateEventRepair,
  groupChunkableValueWriteCollections,
  groupChunkableValueWriteCollection,
  claimedChunkableValueWriteCollection,
  claimedChunkableValueWriteResource,
  groupChunkableValueWriteResource,
  groupWritesSingleChunkableValueCollection,
  groupChunkableArrayWriteCollection,
  groupWritesSingleChunkableArrayCollection,
  groupDeclaredAbiFunction,
  groupOwnsLinearSortedBatch,
  groupChunkableValueWriteIdentity,
  sameChunkableValueWriteResource,
  legacyPlannedChunkableValueWriteCollection,
  selectChunkableValueWriteExecution,
  type ChunkableValueWriteGroup,
  type ChunkableValueWriteResource,
} from './chunkable-value-write-selection.js';
import { groupChunkableValueWriteResource } from './chunkable-value-write-selection.js';

import {
  chunkableValueWriteAbi,
  chunkableValueWriteExecution,
  chunkableValueWriteGroups,
  hasChunkableValueWriteMetadata,
  isInitialChunkableValueWrite,
  isInitialChunkableValueWriteForDigest,
  isPersistedChunkableValueWriteReady,
  chunkableValueWriteCategory,
  selectedPersistedValueChunkCategory,
  permitsLegacyNamedValueChunkFallbackForGroups,
  persistDigestCategories,
  persistedValueChunkCategory,
  persistedChunkableValueWriteState,
  shouldRematerializePersistUpdateForHost,
  shouldStampPersistUpdateDigestLockForHost,
  valueChunkWriteCategorySelection,
  type ChunkableWritePlanningHost,
  type ChunkableValueWriteExecution,
  type ChunkableValueWriteGroups,
} from './stb-chunkable-write-planning.js';
import {
  chunkableValueWriteInputIndex,
  emitDestinationIndices,
  entryScaledPreserveRange,
  hasMintingBandTokenWriter as hasMintingBandTokenWriterForHost,
  reassertScaledPreserveOneToOnes,
  scaledEmitOutputIndex,
  scaledPreserveRanges,
  scidReservedIndices,
  tokenWriterOccupancyForHost,
  type ScaledPreserveEmitHost,
} from './stb-scaled-preserve-emit.js';
import {
  cachedEntryOutputOwnsLock,
  externalEntryLockingBytecode,
  fillSwappedTokenEntryHoles,
  placeValueChunkPredecessorInputs,
  swapMintingOffValueChunkBand,
  type MintingSwapPredecessorHost,
} from './stb-minting-swap-predecessors.js';
export { cachedEntryOutputOwnsLock, physicalEntryAccessForSlot } from './stb-minting-swap-predecessors.js';
import {
  reassertFixedStateOutputs,
  reassertNestedMintingMasters,
  reassertNestedSameIndexMutables,
  stripSurplusEmptyCollectionEntriesForHost,
  type NestedOutputReassertHost,
} from './stb-nested-output-reassert.js';
import {
  ensureDistinctJobEventNfts,
  reassertDelegateImplEvents,
  type DelegateImplEventReassertHost,
} from './stb-delegate-impl-event-reassert.js';
import {
  restoreSwappedTokenFunderSlots,
  synthesizeTransferFromEventCommitments,
  type TokenWriterEventRepairHost,
} from './stb-token-writer-event-repair.js';
import {
  bindWriterReturnWitness,
  reassertInBlockWriterReturns,
  type InBlockWriterReturnHost,
} from './stb-inblock-writer-returns.js';
import {
  declaredMutableEntrySlotIndices,
  declaredMutableEntrySlots,
  restoreDeclaredMutableEntrySlots,
  type DeclaredMutableEntryHost,
} from './stb-declared-mutable-entries.js';
import {
  vacateViewTailsFromJobEventsBand,
  writeViewTailsAfterWriterOccupancy,
  type ViewTailOccupancyHost,
} from './stb-view-tail-occupancy.js';
import { reassertNestedEmitEvents, type NestedEmitEventsHost } from './stb-nested-emit-events.js';
import {
  reassertPersistedValueChunkOneToOnes,
  type PersistedValueChunkOneToOneHost,
} from './stb-persisted-value-chunk-onetoone.js';
import { placeTailReturnAfterSwappedTokenBlock, type PlaceTailReturnHost } from './stb-place-tail-return.js';
import { ensureAuthenticatedViewReturns, type AuthenticatedViewReturnHost } from './stb-authenticated-view-returns.js';
import {
  refreshMasterUnlocker,
  syncBuilderUnlockers,
  syncRefreshedCarrierMasters,
  type RefreshedUnlockerSyncHost,
} from './stb-refreshed-unlocker-sync.js';
import {
  rebindCategoryEntryUnlockers as rebindCategoryEntryUnlockersForHost,
  reconcileMaterializedDataNftUnlockers,
  reconcileMaterializedEntryNftUnlockers,
  reconcileMaterializedInputWitnesses,
  type MaterializedNftUnlockerReconcileHost,
} from './stb-materialized-nft-unlocker-reconcile.js';
import {
  reassertMaterializedBatchPredecessorOutputs,
  reconcileMaterializedPredOutWitnesses,
  type MaterializedPredOutReconcileHost,
} from './stb-materialized-predout-reconcile.js';
import {
  reconcileMaterializedReturnWitnesses,
  type MaterializedReturnWitnessReconcileHost,
} from './stb-materialized-return-witness-reconcile.js';
import { repackViewTailsAfterMaterialization, type RepackViewTailsHost } from './stb-repack-view-tails.js';
import { stripSurplusLinearBatchEntryClones, type StripSurplusLinearBatchHost } from './stb-strip-surplus-linear-batch.js';
import { reassertTokenInsertNewLocks, type TokenInsertNewLocksHost } from './stb-token-insert-new-locks.js';
import {
  enforceDeclaredCollectionOutputCardinality,
  type DeclaredCollectionCardinalityHost,
} from './stb-declared-collection-cardinality.js';
import { reassertMintingOneToOne, type MintingOneToOneHost } from './stb-minting-one-to-one.js';
import {
  rebindLateValueSuffixAfterInsertion,
  reconcileMaterializedValueChunkWitnesses,
  type LateValueSuffixRebindHost,
} from './stb-late-value-suffix-rebind.js';
import {
  ensureLiveValueChunkBand,
  materializeValueChunkBand,
  packReverseIndexedValueChunkSuffix,
  persistPlacedValueChunkBand,
  type ValueChunkBandHost,
} from './stb-value-chunk-band.js';
import {
  delegateLoopEntryVars,
  loopEntryTransitionSatoshis,
  reassertDelegateLoopEntries,
  returnOutputIdxFromUnlocker,
  unmaterializedReturnEventCompact,
  type DelegateLoopEntriesHost,
} from './stb-delegate-loop-entries.js';
import { assertConvergedFinalTransaction, type ConvergedFinalTransactionHost } from './stb-converged-final-transaction.js';
import {
  applyDerivedValueChunks,
  relocateCollidingDerivedValueChunkRuns,
  stripSurplusDerivedValueChunkLocks,
  type DerivedValueChunkApplyHost,
} from './stb-derived-value-chunk-apply.js';
import {
  finalizeReverseSuffixValueChunkLayout,
  reassertReverseSuffixDynamicChunks,
  reassertStagedValueChunkOutputs,
  type ReverseSuffixValueChunkHost,
} from './stb-reverse-suffix-value-chunks.js';
import { logCovenantFailureTrace, type CovenantFailureTraceHost } from './stb-covenant-failure-trace.js';
import {
  repairComputedChunkOutput,
  type ComputedChunkRepairResult,
  type RepairComputedChunkOutputHost,
} from './stb-repair-computed-chunk-output.js';
import { buildInputs, insertBandPadDemand, type BuildInputsHost } from './stb-build-inputs.js';
import {
  applyLearnedWriterEvents,
  learnFinalizedDelegateEvents,
  type ApplyLearnedWriterEventsHost,
} from './stb-apply-learned-writer-events.js';
import {
  stripEmptyDuplicateEntryLocks,
  type StripEmptyDuplicateEntryLocksHost,
} from './stb-strip-empty-duplicate-entry-locks.js';
import {
  seedOptimisticScalarWrites as seedOptimisticScalarWritesImpl,
  type SeedOptimisticScalarWritesHost,
} from './stb-seed-optimistic-scalar-writes.js';
import {
  bindMaterializedValueChunkWitnesses as bindMaterializedValueChunkWitnessesImpl,
  type BindMaterializedValueChunkWitnessesHost,
} from './stb-bind-materialized-value-chunk-witnesses.js';
import {
  setDerivedChunkOutput as setDerivedChunkOutputImpl,
  type SetDerivedChunkOutputHost,
} from './stb-set-derived-chunk-output.js';
import {
  restoreBuilderReturnOutputParams as restoreBuilderReturnOutputParamsImpl,
  type RestoreBuilderReturnOutputParamsHost,
} from './stb-restore-builder-return-output-params.js';
import { type ReassertSendPostLayoutMaterializationHost } from './stb-reassert-send-post-layout-materialization.js';
import { type ValidateSendFeeCapsAndBytesHost } from './stb-validate-send-fee-caps-and-bytes.js';
import { type CreateSendFinalLayoutReassertHost } from './stb-create-send-final-layout-reassert.js';
import { type ConvergeAndSerializeFinalTransactionHost } from './stb-converge-and-serialize-final-transaction.js';
import {
  assembleConstructorInputs as assembleConstructorInputsImpl,
  type AssembleConstructorInputsHost,
} from './stb-assemble-constructor-inputs.js';
import { type AppendEarlyDelegateOutputsHost } from './stb-append-early-delegate-outputs.js';
import {
  runSendPhase3FinalRebuild as runSendPhase3FinalRebuildImpl,
  type RunSendPhase3FinalRebuildHost,
} from './stb-run-send-phase3-final-rebuild.js';
import { runBuildEarlyFront as runBuildEarlyFrontImpl, type RunBuildEarlyFrontHost } from './stb-run-build-early-front.js';
import {
  createSendTiming,
  runSendPhase4ThroughSubmit as runSendPhase4ThroughSubmitImpl,
  type RunSendPhase4ThroughSubmitHost,
} from './stb-run-send-phase4-through-submit.js';
import {
  runBuildMidLateThroughTail as runBuildMidLateThroughTailImpl,
  type RunBuildMidLateThroughTailHost,
} from './stb-run-build-mid-late-through-tail.js';
import {
  getChunkableValueWriteBand as getChunkableValueWriteBandImpl,
  type GetChunkableValueWriteBandHost,
} from './stb-get-chunkable-value-write-band.js';
import {
  ensurePersistedValueChunkInputs as ensurePersistedValueChunkInputsImpl,
  type EnsurePersistedValueChunkInputsHost,
} from './stb-ensure-persisted-value-chunk-inputs.js';
import {
  applyDeferredEcrecoverArgument,
  resolveDeferredEcrecoverArgument as resolveDeferredEcrecoverArgumentImpl,
  type ResolveDeferredEcrecoverArgumentHost,
} from './stb-resolve-deferred-ecrecover-argument.js';
import { setFunderUtxos as setFunderUtxosImpl, type SetFunderUtxosHost } from './stb-set-funder-utxos.js';
import {
  getLoopEntryOutputIndex as getLoopEntryOutputIndexImpl,
  type GetLoopEntryOutputIndexHost,
} from './stb-get-loop-entry-output-index.js';
import { measureAndFundCovenantFee, type MeasureAndFundCovenantFeeHost } from './stb-measure-and-fund-covenant-fee.js';
import { type ReassertSendFinalBuilderHost } from './stb-reassert-send-final-builder.js';
import { type PlaceSendChangeAndSidecarHost } from './stb-place-send-change-and-sidecar.js';
import { type ReassertSendFinalConservationHost } from './stb-reassert-send-final-conservation.js';
import { type ReassertSendAfterViewRepackHost } from './stb-reassert-send-after-view-repack.js';
import { type PatchRelocatedDelegateOutputBasesHost } from './stb-patch-relocated-delegate-output-bases.js';
import { type ReassertBuildConservationRepairsHost } from './stb-reassert-build-conservation-repairs.js';
import { type FinalizeBuildValueChunkBandAndViewsHost } from './stb-finalize-build-value-chunk-band-and-views.js';
import { type ReassertSendFinalLayoutHost } from './stb-reassert-send-final-layout.js';
import { type MaterializeOwnerEventNftOutputsHost } from './stb-materialize-owner-event-nft-outputs.js';
import {
  type MaterializeOwnerEntriesContainersTransfersHost,
} from './stb-materialize-owner-entries-containers-transfers.js';
import { type MaterializeExternalCallOutputsHost } from './stb-materialize-external-call-outputs.js';
import { type MaterializeOwnerFrontOutputsHost } from './stb-materialize-owner-front-outputs.js';
import { type AppendDelegateOutputHelpersHost } from './stb-append-delegate-output-helpers.js';
import { type SubmitFinalTransactionHost } from './stb-submit-final-transaction.js';
import { type FinalizeBuildStampHost } from './stb-finalize-build-stamp.js';
import { type RegisterStatefulInputsHost } from './stb-register-stateful-inputs.js';
import { type MaterializeTrailingFrameAndPendingHost } from './stb-materialize-trailing-frame-and-pending.js';
export {
  physicalBalancedTrailingOutputCount,
  shouldReassertLegacyDelegateLoopEntries,
  shouldAppendUnsegmentedLoopEntries,
} from './stb-materialize-trailing-frame-and-pending.js';
export { argumentsForPhysicalAbiFrame } from './route-expression-key.js';
import { type CreateBuildDebugStagesHost } from './stb-create-build-debug-stages.js';
import { type CreateBuildSessionPreludeHost } from './stb-create-build-session-prelude.js';
import {
  ownStatePreservedOnUntakenConditionalDelegate, type SeedOwnerCurrentStateHost,
} from './stb-seed-owner-current-state.js';
import { runSendDiscoveryProbe } from './stb-run-send-discovery-probe.js';
import { type MaterializeReturnEventOutputsHost } from './stb-materialize-return-event-outputs.js';
import { type MaterializeLowLevelCallOutputsHost } from './stb-materialize-low-level-call-outputs.js';
import { type MaterializeTrailingIterationEntriesHost } from './stb-materialize-trailing-iteration-entries.js';
import { type MaterializeRuntimeLoopTrailingHost } from './stb-materialize-runtime-loop-trailing.js';
import { type MaterializeValueAndDynamicChunksHost } from './stb-materialize-value-and-dynamic-chunks.js';
import { type FinalizeBuildDerivedSuffixHost } from './stb-finalize-build-derived-suffix.js';
import { type RepairNestedCalleeOutputsHost } from './stb-repair-nested-callee-outputs.js';

export {
  jobEventsEntryOneToOneIndices,
  collectionEntryOneToOneIndices,
  reassertTokenInsertNewLock,
  reassertTokenInsertCommitments,
  linearSortedBatchEntryBands,
  linearSortedBatchValueArgument,
  linearSortedBatchPlannedLockCounts,
  entryInsertLockRepairs,
  reassertDescribedEntryInsertLocks,
  reorderLinearBatchProofSuccessor,
  type EntryInsertLockRepair,
  type LinearSortedBatchEntryBand,
} from './token-insert-linear-batch.js';

export {
  stripSurplusValueChunkLocks,
  reassertScidIdentityOutputs,
  stripSurplusMintingOutputs,
  shouldInsertMintingMaster,
  placeMintingMasterPreservingTail,
  matchMaterializedReturnOutputs,
  shouldOverwriteForSameIndexTwin,
  type MaterializedReturnExpectation,
} from './scid-minting-return-layout.js';

export {
  isJobEventEmitCommitment,
  entryCommitmentLacksValue,
  resolveRestoredBalancesEntryCommitment,
  nextAlignmentPadIndex,
  placeSameIndexTwin,
  placeInsertNewAt,
  shouldDisplaceForNestedEvent,
  isOverwritableEmitOccupant,
  emitDestCollidesPreservedInput,
  chunkableWriterEventOutputIndex,
  publishJobEventOutputIndex,
  isCreatedJobEventCommitment,
  relocateJobEventEmitToDest,
  type SameIndexTwinOptions,
} from './same-index-twin-emit.js';


export {
  SCID_COMMIT_PREFIX,
  isMaterializedImmutableNftOutput,
  isDelegateEventNftOutput,
  lockingHexOf,
  demoteUnclaimedDelegateEventClones,
  relocateDelegateEventNftToDest,
  resolveNamedEventValues,
  jobEventTypeOf,
  jobEventFieldEmpty,
  stampEmptyJobEventTimestamp,
  isWithdrawShapedJobEvent,
  shouldRematerializePersistUpdate,
  isInsertShapedJobEvent,
  shouldStampPersistUpdateDigestLock,
  shouldUseLegacyPersistDigestLockForValueChunks,
  isIntegerType,
  scalarTypeKey,
  canEncodeScalarStateValue,
  permutations,
  fieldNameMatchesArg,
  evalSimpleIntegerSource,
  paramToStateValue,
  persistUpdateDigestLock,
  legacyJobEventsPersistUpdateDigestLock,
  persistUpdateDestLock,
  isEmptyPayloadJobEvent,
  jobEventTimestampOf,
  encodeEmptyJobEventEmitCommitment,
  encodeJobEventEmitCommitment,
  isLearnedEventEmitCommitment,
  isAuthenticatedEventRepairCommitment,
  demoteUnclaimedConditionalEventOutput,
  isEmptySameCategoryNoneCap,
  type DelegateEventClaim,
} from './delegate-event-jobevent-helpers.js';
import {
  canEncodeScalarStateValue,
  evalSimpleIntegerSource,
  persistUpdateDigestLock,
  legacyJobEventsPersistUpdateDigestLock,
  demoteUnclaimedConditionalEventOutput,
} from './delegate-event-jobevent-helpers.js';

export {
  placeChunkableWriterEventOutput,
  placePublishJobEventOutput,
  groupLayoutBlockSize,
  selectDelegateExecutionLayout,
  physicalDelegateSlotOffset,
  pinExactSortedBatchEntry,
  skipCompilerOwnedInBlockCollectionStrip,
  assignBalancedOutputAtOffset,
  groupLayoutTrailingBase,
  blockOutputOwnsSlotKind,
  blockOutputOwnsFixedDataNft,
  fixedDataNftOwnerInParticipantBlocks,
  materializedPredOutBase,
  syncDeclaredBatchPredOutWitnesses,
  predOutBaseAfterOccupancy,
  resolveAbsolutePredOut,
  isWriterBatchWitnessName,
  inheritWriterBatchWitnesses,
  inheritWriterBatchPlan,
  constrainOwnCategoryImmutableOutputs,
  remapInsertPredOuts,
  type DelegateExecutionLayoutGroup,
  type PromotableWriterBatchPlan,
} from './writer-event-delegate-layout.js';
import {
  fixedDataNftOwnerInParticipantBlocks,
  constrainOwnCategoryImmutableOutputs,
} from './writer-event-delegate-layout.js';

export {
  flattenLlcGroupInputs,
  sameOutpoint,
  lowLevelCallBlockLayout,
  hasMaterializedLowLevelCallBlock,
  materializedLowLevelCallBlockAtMaster,
  repairMaterializedLowLevelCallBlocks,
  type EntryNftInfo,
  type TransferData,
  type EventEmitData,
  type TokenContainerInfo,
  type TokenContainerTransferData,
  type TokenContainerTransferNftData,
  type RuntimeLoopTransferOutput,
  type ExternalCallUtxoGroup,
} from './external-call-utxo-group.js';
import {
  type EntryNftInfo,
  type TransferData,
  type EventEmitData,
  type TokenContainerInfo,
  type TokenContainerTransferData,
  type TokenContainerTransferNftData,
  type RuntimeLoopTransferOutput,
  type ExternalCallUtxoGroup,
} from './external-call-utxo-group.js';

export {
  ownsCapturedValueChunkOutputBase,
  refreshCapturedValueChunkOutputBase,
  assignValueChunkOutputBaseFromResolve,
  selectProtectedLoopEntryCollections,
  selectExternalEventProbeInput,
  selectCompilerWriterEvent,
  externalCallEventDestinations,
  lowLevelCallImmutableEventDestinations,
  groupEventSignatures,
  lowLevelCallStateOwnerCategory,
  selectBuilderValueChunkOutputBase,
  transportedContinuationLocalBase,
  rebaseValueChunkWriteDescriptors,
  type ProtectedLoopEntryCollectionSelection,
  type CompilerWriterEventCandidate,
  type CompilerWriterEventSelection,
  type ParticipantImmutableEventDestination,
  type StatefulTransactionOptions,
} from './value-chunk-base-writer-select.js';
import {
  lowLevelCallImmutableEventDestinations,
  selectBuilderValueChunkOutputBase,
  type StatefulTransactionOptions,
} from './value-chunk-base-writer-select.js';

/**
 * A transaction builder that wraps TransactionBuilder with the stateful
 * contract input/output convention:
 * - Input 0 (at activeInputIndex): master contract UTXO with minting NFT
 * - Input 1..N: data NFT UTXOs carrying state commitments
 * - Corresponding outputs preserve locking bytecode, token category, and NFT capability
 */
export class StatefulTransactionBuilder {
  private builderOptions: TransactionBuilderOptions;
  private _checkMinRelayFee: boolean;
  private _minRelayFeePerKb: bigint;
  private _maximumFeeSatoshis?: bigint;
  private strictVmPreflight = false;
  private resultDependentArgumentRefresher?: (builder: TransactionBuilder) => boolean;
  private masterUnlockerRefresher?: (builder?: TransactionBuilder) => Unlocker;
  private allInputs: UnlockableUtxo[];
  // External-library side-car UTXO, co-spent as the LAST input so the covenant's library loader can read
  // it (via OP_INPUTBYTECODE) during both auto-derivation probes and the final tx. Set by _applyOverrides.
  private sidecarUtxo?: UnlockableUtxo;
  private stateLayout: StateLayout;
  private masterUtxo: UnlockableUtxo;
  private messageBusProbeMasterVout?: number;
  private dataNftUtxos: UnlockableUtxo[];
  private categoryId: string;
  private requiredNftIndices: readonly number[];
  private stateUpdates: Map<
  string, StateValue
  > = new Map();

  /** Data-NFT coordinates explicitly asserted through the public `.setState()` call API. */
  private explicitStateOverrideNftIndices: Set<number> = new Set();
  private lastOptimisticPermutationCount: number = 1;

  // Exact data-NFT commitments learned from covenant traces. Parsing and rebuilding a commitment can lose
  // compiler-only dynamic length registers, so auto-derivation retains the authenticated bytes verbatim.
  private stateRawCommitments: Map<number, string> = new Map();

  private pendingOutputs: Array<{
    to: string | Uint8Array; amount: bigint; token?: Utxo['token'];
  }> = [];

  // The outputs among `pendingOutputs` that create an absent token container for a first deposit, by category.
  private createdTokenContainerOutputs: Map<string, { to: Uint8Array; amount: bigint; token: Utxo['token'] }> =
    new Map();

  private entryNfts: EntryNftInfo[];
  private entryUpdates: Map<
  number, StateValue
  > = new Map();

  private entryDeletes: Set<number> = new Set();
  private entryNftLockingBytecodes: Map<string, Uint8Array>;
  private eventDefinitions: readonly EventDefinitionAbi[];
  private eventNftLockingBytecodes: Map<string, Uint8Array>;
  private pendingTransfers: TransferData[] = [];
  private pendingEventEmits: EventEmitData[] = [];
  private detachedEventReceipts: Array<{ eventSignature: string; commitment: string }> = [];
  private tokenContainers: TokenContainerInfo[];
  private tokenContainerLockingBytecodes: Map<string, Uint8Array>;
  private satoshiContainerUtxo?: UnlockableUtxo;
  private satoshiContainerLockingBytecode?: Uint8Array;
  private containerDepositAmount: bigint = 0n;
  private pendingTokenContainerDeposits: Map<string, bigint> = new Map();
  private pendingTokenContainerTransfers: TokenContainerTransferData[] = [];
  private pendingTokenContainerTransferNfts: TokenContainerTransferNftData[] = [];
  private tokenContainerTransferInsertionCounter = 0;
  private readOnlyDataNftUtxos: UnlockableUtxo[];
  private blockhashCoSpendUtxos: UnlockableUtxo[];
  private blockInfoCoSpendUtxos: UnlockableUtxo[] = [];
  private delegateBlockInfoOracle = false;
  private blockhashCoSpendSlotOrdinals?: number[];
  private keccakComputeCoSpendUtxos: UnlockableUtxo[];
  private keccakComputeCommitments: string[];
  private delegateComputeResources: boolean;
  private deferredKeccakCompute?: {
    salt: Uint8Array;
    legacy: boolean;
    preimages: Array<Uint8Array | null>;
  };

  private deferredEcrecoverCompute?: {
    salt: Uint8Array;
    argBlobs: Array<Uint8Array | null>;
    evmKeccakPreimageIndices: number[];
  };

  private ecrecoverComputeCoSpendUtxos: UnlockableUtxo[];
  private ecrecoverComputeRecreates: Output[];
  private externalOutStateUtxoGroups: ExternalCallUtxoGroup[];
  private externalCallUtxoGroups: ExternalCallUtxoGroup[];
  private lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
  private activeDelegateGroupIndex?: number;
  private lowLevelCallRawInputs: UnlockableUtxo[];
  private delegateEntriesAfterLowLevel: boolean;
  private delegateDynamicChunksAtSuffix: boolean;
  /** Latched on first build() so first publish cannot reassert after persist becomes ready mid-send. */
  private emitReassertAllowed: boolean | undefined;
  private delegatedValueChunkPad: number;
  private mintingOutputSwap?: { from: number; width: number; categoryId: string };
  private viewTailRepackAttempted = false;
  private delegateReturnEventAfterEvents: boolean;
  private lowLevelCallInputBase?: number;
  private compilerRouteDelegateBlock: boolean;
  private preserveBlockLayoutWidth: boolean;
  private loopEntriesBeforeDynamicChunks: boolean;
  private iterationEntryInputs: UnlockableUtxo[];
  private iterationEntriesPlacedAtDelegateBase = false;
  private insertLoopPredecessorInputs: UnlockableUtxo[];
  private keccakLoopSideCars: UnlockableUtxo[];
  private keccakLoopRecreates: Output[];
  private get keccakLoopPrecedesTrailingUser(): boolean {
    return (this.masterUtxo?.unlocker as { abiFunction?: { keccakLoopPrecedesTrailingUser?: boolean } })
      ?.abiFunction?.keccakLoopPrecedesTrailingUser === true;
  }

  private get keccakLoopFollowsTrailingUser(): boolean {
    return !this.keccakLoopPrecedesTrailingUser && this.insertLoopPredecessorInputs.length > 0;
  }

  private get keccakSideCarsFollowBlock(): boolean {
    const abiFunction = (this.masterUtxo?.unlocker as {
      abiFunction?: { keccakChainReads?: boolean; keccakLoopReads?: boolean };
    })?.abiFunction;
    return this.keccakLoopSideCars.length > 0
      && (abiFunction?.keccakChainReads === true || abiFunction?.keccakLoopReads === true);
  }

  private blockLayout?: FunctionBlockLayout;
  private messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
  readonly valueChunkWriteStagingSession: ValueChunkWriteStagingSession;
  private logicalIdentityUtxo?: UnlockableUtxo;
  private externalIdentityAnchorUtxos: UnlockableUtxo[] = [];
  private childDeploymentInputs = new Map<number, UnlockableUtxo>();
  private childDeploymentOutputs = new Map<number, readonly Output[]>();
  funderUtxos: UnlockableUtxo[];
  private embeddedFunderUtxos: UnlockableUtxo[];
  private relocationFunderUtxos: UnlockableUtxo[] = [];
  private insertBandPadUtxos: UnlockableUtxo[] = [];
  private funderChangeAddress?: Uint8Array;

  private externalCallStateUpdates: Map<
  string, Map<string, StateValue>
  > = new Map(); // categoryId -> (varName -> value)

  // Exact external data-NFT commitments learned from the callee covenant. Like
  // stateRawCommitments, these retain compiler-only registers which cannot be
  // reconstructed losslessly from the source-level state value map.
  private externalCallStateRawCommitments: Map<string, Map<number, string>> = new Map();

  // Cross-contract callee (B) vmap sorted-entry outputs, derived from B's VM trace (docs/deferrals.md #1).
  // categoryId -> (B block-slot position si -> commitment hex). The external-call output loop mints B's updated
  // (or predecessor P') entry at that slot; a NEW insert node rides the trailing region below.
  private externalCallEntryOutputs: Map<string, Map<number, string>> = new Map();
  /** Physical output index -> derived entry commitment. The VM pin names this index; block-slot walk can drift. */
  private externalCallEntryOutputsByIndex: Map<number, {
    categoryId: string; commitment: string; lockingBytecodeHex?: string;
  }> = new Map();

  // Trailing NEW entry nodes minted for a cross-contract callee INSERT (per group: address lbc + commitment hex),
  // placed right after the group's block (B's covenant mints the NEW at masterInputIndex + blockSize).
  private externalCallEntryInserts: Array<{
    categoryId: string; to: Uint8Array; commitment: string;
    ownerGroupIndex?: number; targetSlot?: string; active?: boolean;
  }> = [];

  private pendingReturnEventOutputs: Array<{
    categoryId: string; commitment: Uint8Array; identity: string; provisional?: boolean;
  }> = [];

  /** Physical output positions from the most recent build, keyed by logical return identity. */
  private builtReturnEventOutputIndices = new Map<string, number>();
  /**
   * Authenticated view-return commitments captured at place time. Pending return
   * events may be cleared before the final stamp, but unlock witnesses still
   * need these values on non-OP_RETURN pads.
   */
  private authenticatedViewReturnByGroup = new Map<number, { categoryId: string; commitment: string }>();

  private entryRawCommitments: Map<number, string> = new Map(); // slotIndex -> hex commitment (from auto-derivation)
  private pinnedEntrySlots: Set<number> = new Set(); // slots whose commitment is known exactly (never re-derive)
  private requiredEntryOutputSlots: Set<number> = new Set(); // slots the spending route reads at a fixed coordinate
  private dynamicChunkVars: Array<{
    name: string; type: string; lockingBytecode: Uint8Array; delegate?: boolean; delegateSuffix?: boolean;
  }> = [];

  private dynamicChunkInputs: UnlockableUtxo[] = [];
  private trailingDisposalInputs: UnlockableUtxo[] = [];
  // varName -> ordered chunk commitments (hex) from auto-derivation; length determines chunk output count.
  private chunkRawCommitments: Map<string, string[]> = new Map();
  private loopEntryVars: Array<{
    collection: string; lockingBytecode: Uint8Array; categoryId?: string; delegate?: boolean; chunkable?: boolean;
  }> = [];

  // collection -> ordered loop entry commitments (hex) from auto-derivation; length = entry output count.
  private loopEntryCommitments: Map<string, string[]> = new Map();
  private requiredLoopEntryCounts: Map<string, number> = new Map();

  private runtimeLoopEventOutputs: Array<{
    eventSignature: string; lockingBytecode: Uint8Array; categoryId?: string; commitment: string;
    rowIndex: number; chunked?: true; continuation?: true;
  }> = [];

  private runtimeLoopTransferOutputs: RuntimeLoopTransferOutput[] = [];
  private runtimeLoopTrailingSegments: NonNullable<StatefulTransactionOptions['runtimeLoopTrailingSegments']> = [];
  private kernelJournalSettlementOutputPlan: NonNullable<StatefulTransactionOptions['kernelJournalSettlementOutputPlan']> = [];
  private kernelJournalEagerOutputPlan: NonNullable<StatefulTransactionOptions['kernelJournalEagerOutputPlan']> = [];

  // P5b: collections whose loop-entry (NEW) commitment is known EXACTLY (a chunkable-value insert) and must NOT be
  // re-derived from the trace - the value-chunk pin adds OP_OUTPUTTOKENCOMMITMENT calls that the loop-entry
  // extractor would otherwise read as NEW nodes. Pinned like pinEntrySlot pins a fixed entry slot.
  private pinnedLoopEntries: Set<string> = new Set();
  // Routed batch TARGET nodes the planner publishes with their key and successor link only: the route's handler
  // builds the value (no reproducible parameter), so its tail is completed later from the value the covenant
  // authenticates for that exact entry.
  private pendingEntryValueTails = new Map<string, {
    slotIndex: number; collection: string; slot: Uint8Array; seed: string; next: Uint8Array; chunkable: boolean;
  }>();

  // P5b: unpinned same-category 0x01 value-chunk outputs (LONG sorted-mapping values). Trailing, not covenant-
  // managed - the entry stores sha256(value) and the read verifies the reassembled witness, so these need no
  // on-chain pinning. Commitments are known exactly (buildChunkCommitment) so they never enter auto-derivation.
  private valueChunkOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: Utxo['token'] }> = [];
  private valueChunkOutputsLock?: Uint8Array;

  /** Route value chunks the derivation recovered, keyed by ABSOLUTE output index. Builder-level, not per-group:
   * the covenant that pins them is probed as one group but addresses an output in ANOTHER group's block (its
   * base is the proxy master), so the placing group and the owning group are different. */
  private derivedChunkOutputs = new Map<number, DerivedChunkOutputObservation>();
  /** Survives probe rebuilds that drop `derivedChunkOutputs` before send(). */
  private pendingValueChunkPredecessors: UnlockableUtxo[] = [];
  private persistedJobEventsChunks: Array<{
    commitment: string; lockingBytecode: Uint8Array; categoryId?: string;
  }> = [];

  /** Last VM-pinned locking bytecode for the selected chunkable-value continuation band. */
  private valueChunkRedeemLock?: Uint8Array;
  /** A selected writer's persisted continuation band starts after its emitted event output. */
  private forcedChunkableValueWriteBandStart?: number;
  /** True while building one balanced participant of an atomic composition (its blocks are concatenated). */
  private composedParticipant = false;
  private composedBlockBase?: number;
  /** Monotonic signal for structural growth discovered while probing dynamic output regions. */
  private dynamicLayoutRevision = 0;

  setValueChunkRedeemLock(lock: Uint8Array): this {
    if (lock.length === 35 && lock[0] === 0xaa && lock[1] === 0x20 && lock[34] === 0x87) {
      this.valueChunkRedeemLock = lock;
    }
    return this;
  }

  getValueChunkRedeemLock(): Uint8Array | undefined {
    return this.valueChunkRedeemLock;
  }

  /** @deprecated Historical name; use setValueChunkRedeemLock. */
  setJobEventsRedeemLock(lock: Uint8Array): this {
    return this.setValueChunkRedeemLock(lock);
  }

  /** @deprecated Historical name; use getValueChunkRedeemLock. */
  getJobEventsRedeemLock(): Uint8Array | undefined {
    return this.getValueChunkRedeemLock();
  }

  private lateValueChunkOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: Utxo['token'] }> = [];
  // P5b (computed values): collections whose value chunks are DERIVED from the trace (the SDK has no value param to
  // build them). The covenant pins them, so their commitments come from auto-derivation like dynamicChunkVars.
  private valueChunkVars: Map<string, {
    collection: string; lockingBytecode: Uint8Array; slot?: Uint8Array;
  }> = new Map();

  /** Compiler-authenticated writes executed by this root frame rather than by a nested call group. */
  private directValueChunkWriteDescriptors = new Map<string, ValueChunkWriteDescriptor>();
  private valueChunkRawCommitments: Map<string, string[]> = new Map(); // run id -> ordered chunk commitments (hex)
  private eventRawCommitments: Map<number, string> = new Map(); // emitIndex -> hex commitment (from auto-derivation)
  private pendingEventPlaceholders: Array<{ eventSignature: string; emitIndex: number }> = [];
  /** Covenant-authenticated event outputs keyed by their physical coordinate. */
  private authenticatedEventOutputs = new Map<number, Output>();
  /** Exact OUTPUTBYTECODE/EQUALVERIFY observations which remain authoritative during conservation replay. */
  private authenticatedOutputLockingBytecodes = new Map<number, Uint8Array>();

  constructor(options: StatefulTransactionOptions) {
    this.valueChunkWriteStagingSession = options.valueChunkWriteStagingSession
      ?? settlement().valueChunkWriteStaging;
    this._applyConstructorCoreOptions(options);
    this._applyConstructorParticipantOptions(options);
    assembleConstructorInputsImpl(
      this._assembleConstructorInputsHost(),
      options.requiredNftIndices,
    );
  }

  private _applyConstructorCoreOptions(options: StatefulTransactionOptions): void {
    this.builderOptions = options;
    this._checkMinRelayFee = options.checkMinRelayFee ?? true;
    this._minRelayFeePerKb = options.minRelayFeePerKb ?? 1000n;
    this.stateLayout = options.stateLayout;
    this.masterUtxo = options.masterUtxo;
    this.dataNftUtxos = options.dataNftUtxos;
    this.categoryId = options.categoryId;
    this.readOnlyDataNftUtxos = options.readOnlyDataNftUtxos ?? [];
    this.blockhashCoSpendUtxos = options.blockhashCoSpendUtxos ?? [];
    this.blockInfoCoSpendUtxos = options.blockInfoCoSpendUtxos ?? [];
    this.delegateBlockInfoOracle = options.delegateBlockInfoOracle ?? false;
    this.blockhashCoSpendSlotOrdinals = options.blockhashCoSpendSlotOrdinals;
    this.keccakComputeCoSpendUtxos = options.keccakComputeCoSpendUtxos ?? [];
    this.keccakComputeCommitments = options.keccakComputeCommitments ?? [];
    this.delegateComputeResources = options.delegateComputeResources ?? false;
    this.deferredKeccakCompute = options.deferredKeccakCompute === undefined ? undefined : {
      salt: Uint8Array.from(options.deferredKeccakCompute.salt),
      legacy: options.deferredKeccakCompute.legacy,
      preimages: options.deferredKeccakCompute.preimages.map((preimage) => (
        preimage === null ? null : Uint8Array.from(preimage)
      )),
    };
    this.deferredEcrecoverCompute = options.deferredEcrecoverCompute === undefined ? undefined : {
      salt: Uint8Array.from(options.deferredEcrecoverCompute.salt),
      argBlobs: options.deferredEcrecoverCompute.argBlobs.map((argBlob) => (
        argBlob === null ? null : Uint8Array.from(argBlob)
      )),
      evmKeccakPreimageIndices: [...options.deferredEcrecoverCompute.evmKeccakPreimageIndices],
    };
    this.ecrecoverComputeCoSpendUtxos = options.ecrecoverComputeCoSpendUtxos ?? [];
    this.ecrecoverComputeRecreates = options.ecrecoverComputeRecreates ?? [];
    this.externalOutStateUtxoGroups = options.externalOutStateUtxoGroups ?? [];
    this.externalCallUtxoGroups = options.externalCallUtxoGroups ?? [];
    this.lowLevelCallUtxoGroups = options.lowLevelCallUtxoGroups ?? [];
    this.activeDelegateGroupIndex = options.activeDelegateGroupIndex;
    this.lowLevelCallRawInputs = options.lowLevelCallRawInputs ?? [];
    this.delegateEntriesAfterLowLevel = options.delegateEntriesAfterLowLevel ?? false;
    this.delegateDynamicChunksAtSuffix = options.delegateDynamicChunksAtSuffix ?? false;
    this.delegatedValueChunkPad = options.delegatedValueChunkPad ?? 0;
    this.delegateReturnEventAfterEvents = options.delegateReturnEventAfterEvents ?? false;
    this.lowLevelCallInputBase = options.lowLevelCallInputBase;
    this.compilerRouteDelegateBlock = options.compilerRouteDelegateBlock ?? false;
    this.preserveBlockLayoutWidth = options.preserveBlockLayoutWidth ?? false;
    this.loopEntriesBeforeDynamicChunks = options.loopEntriesBeforeDynamicChunks === true
      || (options.runtimeLoopEventOutputs?.length ?? 0) > 0
      || (options.runtimeLoopTransferOutputs?.length ?? 0) > 0;
  }

  private _applyConstructorParticipantOptions(options: StatefulTransactionOptions): void {
    this.entryNfts = options.entryNfts ?? [];
    this.entryNftLockingBytecodes = options.entryNftLockingBytecodes ?? new Map();
    this.dynamicChunkVars = options.dynamicChunkVars ?? [];
    this.dynamicChunkInputs = options.dynamicChunkInputs ?? [];
    this.trailingDisposalInputs = options.trailingDisposalInputs ?? [];
    this.loopEntryVars = options.loopEntryVars ?? [];
    this.runtimeLoopEventOutputs = (options.runtimeLoopEventOutputs ?? []).map((output) => ({
      ...output,
      commitment: output.commitment ?? '',
    }));
    this.runtimeLoopTransferOutputs = (options.runtimeLoopTransferOutputs ?? []).map((output) => ({
      ...output, lockingBytecode: Uint8Array.from(output.lockingBytecode), amount: output.amount,
      ...(output.commitment && { commitment: Uint8Array.from(output.commitment) }),
    }));
    this.runtimeLoopTrailingSegments = options.runtimeLoopTrailingSegments?.map((segment) => ({ ...segment })) ?? [];
    this.kernelJournalSettlementOutputPlan = options.kernelJournalSettlementOutputPlan
      ?.map((entry) => ({ ...entry })) ?? [];
    this.kernelJournalEagerOutputPlan = options.kernelJournalEagerOutputPlan
      ?.map((entry) => ({ ...entry })) ?? [];
    this.eventDefinitions = options.eventDefinitions ?? [];
    this.eventNftLockingBytecodes = options.eventNftLockingBytecodes ?? new Map();
    this.tokenContainers = options.tokenContainers ?? [];
    this.tokenContainerLockingBytecodes = options.tokenContainerLockingBytecodes ?? new Map();
    this.satoshiContainerUtxo = options.satoshiContainerUtxo;
    this.satoshiContainerLockingBytecode = options.satoshiContainerLockingBytecode;
    this.iterationEntryInputs = options.iterationEntryInputs ?? [];
    this.insertLoopPredecessorInputs = options.insertLoopPredecessorInputs ?? [];
    this.keccakLoopSideCars = options.keccakLoopSideCars ?? [];
    this.keccakLoopRecreates = options.keccakLoopRecreates ?? [];
    this._maximumFeeSatoshis = options.maximumFeeSatoshis;
    this.blockLayout = options.blockLayout;
    this.messageBusConvention = options.messageBusConvention;
    this.composedParticipant = options.composedParticipant === true;
    this.composedBlockBase = options.composedBlockBase;
    this.funderUtxos = options.funderUtxos ?? [];
    this.embeddedFunderUtxos = options.embeddedFunderUtxos ?? [];
    this.logicalIdentityUtxo = options.logicalIdentityUtxo;
    this.externalIdentityAnchorUtxos = options.externalIdentityAnchorUtxos ?? [];
  }

  /** @internal Mark an impossible-output-index master used only by atomic VM derivation probes. */
  _setMessageBusProbeMasterVout(realVout: number): void {
    this.messageBusProbeMasterVout = realVout;
  }

  /** @internal Restore the real spend before a atomic participant block leaves SDK construction. */
  _restoreMessageBusProbeMasterOutpoint(): void {
    if (this.messageBusProbeMasterVout === undefined) return;
    this.masterUtxo.vout = this.messageBusProbeMasterVout;
    this.messageBusProbeMasterVout = undefined;
  }

  /** @internal Rebind later callee arguments after an authenticated return channel converges. */
  _setResultDependentArgumentRefresher(
    refresher: (builder: TransactionBuilder) => boolean,
  ): void {
    this.resultDependentArgumentRefresher = refresher;
  }

  /** @internal Rebuild a root unlocker whose hidden witnesses depend on the final materialized input order. */
  _setMasterUnlockerRefresher(refresher: (builder?: TransactionBuilder) => Unlocker): void {
    this.masterUnlockerRefresher = refresher;
    this._refreshInputs();
  }

  /** @internal Replace the caller unlocker after tail identity-anchor indices become known. */
  _setMasterUnlocker(unlocker: Unlocker): void {
    this.masterUtxo = { ...this.masterUtxo, unlocker };
    this._refreshInputs();
  }

  /** Require the fully funded and signed transaction to pass the artifact's
   * BCH VM before any network submission. Used for concrete recursive calls,
   * whose resource usage depends on runtime arguments. */
  enableStrictVmPreflight(): this {
    this.strictVmPreflight = true;
    return this;
  }

  /** Materialize one compiler-published child genesis frame at its row/site slot. */
  setChildDeployment(
    slotOffset: number, genesisInput: UnlockableUtxo, outputs: readonly Output[],
  ): this {
    if (genesisInput.vout !== 0 || genesisInput.token) {
      throw new Error(`Child deployment slot ${slotOffset} requires a token-free vout-0 genesis input`);
    }
    this.childDeploymentInputs.set(slotOffset, genesisInput);
    this.childDeploymentOutputs.set(slotOffset, outputs.map((output) => ({ ...output })));
    this._refreshInputs();
    return this;
  }

  /** Build allInputs following block layout when funders are available. */
  private _buildInputs(
    entryInputs: UnlockableUtxo[],
    tokenContainerInputs: UnlockableUtxo[],
    satoshiContainerInputs: UnlockableUtxo[],
    externalOutStateInputs: UnlockableUtxo[],
    externalCallInputs: UnlockableUtxo[],
    lowLevelCallInputs: UnlockableUtxo[],
  ): UnlockableUtxo[] {
    return buildInputs(
      this._buildInputsHost(),
      entryInputs,
      tokenContainerInputs,
      satoshiContainerInputs,
      externalOutStateInputs,
      externalCallInputs,
      lowLevelCallInputs,
    );
  }

  /**
   * Compute the minimum fee in satoshis for a transaction of the given byte size.
   * Converts minRelayFeePerKb to a per-byte rate with a floor of 1 sat/byte,
   * matching the ceiling-division formula used by BCHN / mem-cash.
   */
  private computeMinFee(txSizeBytes: bigint): bigint {
    // Ceiling division: ceil(feePerKb * size / 1000)
    // When feePerKb / 1000 rounds to 0 (e.g. feePerKb < 1000), enforce at least 1 sat/byte.
    const feePerByte = this._minRelayFeePerKb >= 1000n
      ? (this._minRelayFeePerKb + 999n) / 1000n   // ceiling division
      : 1n;                                        // floor: at least 1 sat/byte
    return feePerByte * txSizeBytes;
  }

  /** Pad outputs up to `index`. Prefer the same-index funder input so a token-group
   * swap (22-25 ↔ 26-29) does not insert extra OP_TRUE slots and raise TXOUTPUTCOUNT.
   * Token-bearing insert-band pads (none-cap dust at INPUTINDEX+3/+5) must keep their
   * token: a bare OP_TRUE here makes OUTPUTTOKENCATEGORY empty and OP_SPLIT 32 fails. */
  private _padOutputsToIndex(builder: TransactionBuilder, index: number): void {
    // A consumed storage input (a written value's old chunk, a reclaimed continuation chunk) is not copied: its
    // replacement goes in the trailing band, and a copy here is a second chunk the covenant's count refuses.
    const consumed = new Set([...this.dynamicChunkInputs, ...this.trailingDisposalInputs]
      .map((utxo) => `${utxo.txid.toLowerCase()}:${utxo.vout}`));
    while (builder.outputs.length < index) {
      const occupant = this.allInputs[builder.outputs.length];
      if (occupant?.unlocker && !consumed.has(`${occupant.txid.toLowerCase()}:${occupant.vout}`)) {
        builder.addOutput({
          to: occupant.unlocker.generateLockingBytecode(),
          amount: occupant.satoshis,
          ...(occupant.token ? { token: cloneToken(occupant.token) } : {}),
        });
      } else {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
      }
    }
  }

  /** Set the change address for funder excess (returned after fee deduction). */
  setFunderChangeAddress(address: Uint8Array): void {
    this.funderChangeAddress = address;
  }

  /** All explicit funding inputs, including those whose physical positions are owned by nested block layouts. */
  private _accountingFunderUtxos(): UnlockableUtxo[] {
    const unique = new Map<string, UnlockableUtxo>();
    for (const funder of [...this.funderUtxos, ...this.embeddedFunderUtxos]) {
      unique.set(`${funder.txid.toLowerCase()}:${funder.vout}`, funder);
    }
    return [...unique.values()];
  }

  /** Absolute input index of the minting master for `categoryId`, or -1. */
  findMintingInputIndex(categoryId: string): number {
    return this.allInputs.findIndex((input) =>
      input.token?.category === categoryId && input.token?.nft?.capability === 'minting');
  }

  /** Absolute position of an already-selected input, matched only by immutable outpoint identity. */
  findInputIndexByOutpoint(input: Pick<Utxo, 'txid' | 'vout'>): number {
    return this.allInputs.findIndex((candidate) => candidate.txid.toLowerCase() === input.txid.toLowerCase()
      && candidate.vout === input.vout);
  }

  getAssembledInputCount(): number {
    return this.allInputs.length;
  }

  /** Collection entry lock next to the jobEvents band (not the value-chunk redeem). */
  entryLockNearJobEventsBand(): Uint8Array | undefined {
    const band = this.getChunkableValueWriteBand();
    const chunkLock = this.valueChunkRedeemLock;
    const chunkHex = chunkLock ? binToHex(chunkLock) : '';
    const prefer = band ? [band.start - 1, band.start - 2, band.start] : [];
    for (const index of prefer) {
      const input = this.allInputs[index];
      if (!input?.token || input.token.nft?.capability !== 'mutable') continue;
      if (!('unlocker' in input) || !input.unlocker) continue;
      const lock = input.unlocker.generateLockingBytecode();
      if (lock.length === 35 && lock[0] === 0xaa && binToHex(lock) !== chunkHex) return lock;
    }
    for (const input of this.allInputs) {
      if (!input?.token || input.token.nft?.capability !== 'mutable') continue;
      if (!('unlocker' in input) || !input.unlocker) continue;
      const lock = input.unlocker.generateLockingBytecode();
      if (lock.length === 35 && lock[0] === 0xaa && binToHex(lock) !== chunkHex) return lock;
    }
    return undefined;
  }

  rememberJobEventsChunks(
    categoryId: string,
    chunks: ReadonlyArray<{ commitment: string; lockingBytecode: Uint8Array; categoryId?: string }>,
  ): void {
    const next = selectObservedValueChunkRun(
      settlement().persistedJobEventsByCategory.get(categoryId) ?? this.persistedJobEventsChunks,
      chunks,
    );
    if (next.length === 0) return;
    this.persistedJobEventsChunks = next;
    settlement().persistedJobEventsByCategory.set(categoryId, next);
  }

  /** Retain a VM-authenticated computed-value run across probe/final participant builder instances. */
  rememberObservedValueChunks(
    categoryId: string,
    collection: string,
    chunks: ReadonlyArray<AuthenticatedValueChunk>,
  ): void {
    const key = `${categoryId.toLowerCase()}:${collection}`;
    const next = selectObservedValueChunkRun(settlement().observedValueChunksByCollection.get(key) ?? [], chunks);
    if (next.length > 0) settlement().observedValueChunksByCollection.set(key, next);
  }

  /** Retrieve one coherent VM-authenticated run for an exact compiler-described collection. */
  getObservedValueChunks(categoryId: string, collection: string): ReadonlyArray<AuthenticatedValueChunk> {
    return coherentAuthenticatedValueChunkRun(
      settlement().observedValueChunksByCollection.get(`${categoryId.toLowerCase()}:${collection}`) ?? [],
    );
  }

  static clearPersistedJobEvents(categoryId?: string): void {
    settlement().clear(categoryId);
  }

  private _isInitialChunkableValueWrite(): boolean {
    return isInitialChunkableValueWrite(this._chunkableWritePlanningHost());
  }

  /** Persist UPDATE rematerialize only for empty-address dest, never INSERT/whitelist dest. */
  private _shouldRematerializePersistUpdate(): boolean {
    return shouldRematerializePersistUpdateForHost(this._chunkableWritePlanningHost());
  }

  private _isInitialChunkableValueWriteForDigest(): boolean {
    return isInitialChunkableValueWriteForDigest(this._chunkableWritePlanningHost());
  }

  /** Persisted continuation state for this exact collection and key. */
  private _persistedChunkableValueWriteState(): ReturnType<typeof persistedValueChunkWriteState> {
    return persistedChunkableValueWriteState(this._chunkableWritePlanningHost());
  }

  /** Exact descriptor readiness, with global readiness retained only for old descriptor-free plans. */
  private _isPersistedChunkableValueWriteReady(): boolean {
    return isPersistedChunkableValueWriteReady(this._chunkableWritePlanningHost());
  }

  private _shouldStampPersistUpdateDigestLock(): boolean {
    return shouldStampPersistUpdateDigestLockForHost(this._chunkableWritePlanningHost());
  }

  /** Every delegate `INPUTINDEX*scale-k` 1:1 preservation window. */
  private _scaledPreserveRanges(): Array<{ start: number; endExclusive: number }> {
    return scaledPreserveRanges(this._scaledPreserveEmitHost());
  }

  /** Restore 1:1 on the executing impl's INPUTINDEX*scale-k window after other writers. */
  private _reassertScaledPreserveOneToOnes(builder: TransactionBuilder): void {
    reassertScaledPreserveOneToOnes(this._scaledPreserveEmitHost(), builder);
  }

  /** One physical executor for the active chunkable array write. Duplicate logical rows collapse by input. */
  private _scaledPreserveEmitHost(): ScaledPreserveEmitHost {
    return {
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      messageBusConvention: this.messageBusConvention,
      composedParticipant: this.composedParticipant,
      getLowLevelCallMasterInputIndex: (index) => this.getLowLevelCallMasterInputIndex(index),
      getExternalCallMasterInputIndex: (index) => this.getExternalCallMasterInputIndex(index),
      allInputs: this.allInputs,
      blockLayout: this.blockLayout,
      runtimeLoopEventOutputs: this.runtimeLoopEventOutputs,
      authenticatedOutputLockingBytecodes: this.authenticatedOutputLockingBytecodes,
      mintingOutputSwap: this.mintingOutputSwap,
      delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
      getChunkableValueWriteBand: () => this.getChunkableValueWriteBand(),
      getExternalCallOutputBase: (groupIndex) => this.getExternalCallOutputBase(groupIndex),
      getRuntimeLoopEventOutputIndex: (index) => this.getRuntimeLoopEventOutputIndex(index),
      findMintingInputIndex: (categoryId) => this.findMintingInputIndex(categoryId),
      dynamicChunkOutputCount: () => this._dynamicChunkOutputCount(),
    };
  }


  private _mintingSwapPredecessorHost(): MintingSwapPredecessorHost {
    const scaled = this._scaledPreserveEmitHost();
    return {
      ...scaled,
      allInputs: this.allInputs,
      funderUtxos: this.funderUtxos,
      pendingValueChunkPredecessors: this.pendingValueChunkPredecessors,
      preserveBlockLayoutWidth: this.preserveBlockLayoutWidth,
      compilerRouteDelegateBlock: this.compilerRouteDelegateBlock,
      entryNfts: this.entryNfts,
      externalCallEntryOutputs: this.externalCallEntryOutputs,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      getMintingOutputSwap: () => this.mintingOutputSwap,
      setMintingOutputSwap: (swap) => { this.mintingOutputSwap = swap; },
      getRelocationFunderUtxos: () => this.relocationFunderUtxos,
      setRelocationFunderUtxos: (next) => { this.relocationFunderUtxos = next; },
    };
  }


  private _nestedOutputReassertHost(): NestedOutputReassertHost {
    return {
      allInputs: this.allInputs,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      externalOutStateUtxoGroups: this.externalOutStateUtxoGroups,
      messageBusConvention: this.messageBusConvention,
      delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
      mintingOutputSwap: this.mintingOutputSwap,
      pendingReturnEventOutputs: this.pendingReturnEventOutputs,
      preserveBlockLayoutWidth: this.preserveBlockLayoutWidth,
      pinnedEntrySlots: this.pinnedEntrySlots,
      requiredEntryOutputSlots: this.requiredEntryOutputSlots,
      loopEntryVars: this.loopEntryVars,
      blockLayout: this.blockLayout,
      stateLayout: this.stateLayout,
      categoryId: this.categoryId,
      dataNftUtxos: this.dataNftUtxos,
      requiredNftIndices: this.requiredNftIndices,
      stateRawCommitments: this.stateRawCommitments,
      stateUpdates: this.stateUpdates,
      preserveOwnState: this._preserveOwnStateOnUntakenDelegateEdge(),
      externalCallStateRawCommitments: this.externalCallStateRawCommitments,
      externalCallStateUpdates: this.externalCallStateUpdates,
      builderOptions: this.builderOptions,
      dynamicChunkOutputCount: () => this._dynamicChunkOutputCount(),
      findMintingInputIndex: (categoryId) => this.findMintingInputIndex(categoryId),
      getExternalCallMasterInputIndex: (index) => this.getExternalCallMasterInputIndex(index),
      getLowLevelCallMasterInputIndex: (index) => this.getLowLevelCallMasterInputIndex(index),
      getRequiredLoopEntryCount: (collection) => this.getRequiredLoopEntryCount(collection),
      getLoopEntryCommitments: (collection) => this.getLoopEntryCommitments(collection),
    };
  }


  private _delegateImplEventReassertHost(): DelegateImplEventReassertHost {
    return {
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      categoryId: this.categoryId,
      detachedEventReceipts: this.detachedEventReceipts,
      builderOptions: this.builderOptions,
      messageBusConvention: this.messageBusConvention,
      composedParticipant: this.composedParticipant,
      getLowLevelCallMasterInputIndex: (index) => this.getLowLevelCallMasterInputIndex(index),
      getExternalCallMasterInputIndex: (index) => this.getExternalCallMasterInputIndex(index),
      registerDetachedEvent: (eventDef, lockingBytecode) => {
        this.registerDetachedEvent(eventDef, lockingBytecode);
      },
    };
  }


  private _tokenWriterEventRepairHost(): TokenWriterEventRepairHost {
    return {
      allInputs: this.allInputs,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      findMintingInputIndex: (categoryId) => this.findMintingInputIndex(categoryId),
      getExternalCallMasterInputIndex: (index) => this.getExternalCallMasterInputIndex(index),
    };
  }


  private _inBlockWriterReturnHost(): InBlockWriterReturnHost {
    return {
      allInputs: this.allInputs,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      pendingReturnEventOutputs: this.pendingReturnEventOutputs,
      findMintingInputIndex: (categoryId) => this.findMintingInputIndex(categoryId),
      getChunkableValueWriteBand: () => this.getChunkableValueWriteBand(),
      tokenWriterOccupancy: (tokenMaster, outputs) => this.tokenWriterOccupancy(tokenMaster, outputs),
      syncBuilderUnlockers: (builder) => { this._syncBuilderUnlockers(builder); },
      callRecordDigest: (identity) => this.callRecordDigestFor(identity),
    };
  }


  private _declaredMutableEntryHost(): DeclaredMutableEntryHost {
    return {
      allInputs: this.allInputs,
      masterUtxo: this.masterUtxo,
      blockLayout: this.blockLayout,
      categoryId: this.categoryId,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      getExternalCallOutputBase: (groupIndex) => this.getExternalCallOutputBase(groupIndex),
      getLowLevelCallMasterInputIndex: (index) => this.getLowLevelCallMasterInputIndex(index),
      findMintingInputIndex: (categoryId) => this.findMintingInputIndex(categoryId),
      externalEntryLockingBytecode: (group, slot) => this._externalEntryLockingBytecode(group, slot),
    };
  }


  private _viewTailOccupancyHost(): ViewTailOccupancyHost {
    return {
      allInputs: this.allInputs,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      messageBusConvention: this.messageBusConvention,
      delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
      derivedChunkOutputs: this.derivedChunkOutputs,
      builtReturnEventOutputIndices: this.builtReturnEventOutputIndices,
      getChunkableValueWriteBand: () => this.getChunkableValueWriteBand(),
      findMintingInputIndex: (categoryId) => this.findMintingInputIndex(categoryId),
      dynamicChunkOutputCount: () => this._dynamicChunkOutputCount(),
      tailReturnEventOutputs: () => this.tailReturnEventOutputs(),
      declaredMutableEntrySlotIndices: () => this._declaredMutableEntrySlotIndices(),
      restoreDeclaredMutableEntrySlots: (builder) => {
        this._restoreDeclaredMutableEntrySlots(builder);
      },
      reassertInBlockWriterReturns: (builder) => {
        this._reassertInBlockWriterReturns(builder);
      },
      applyDerivedValueChunks: (builder) => {
        this._applyDerivedValueChunks(builder);
      },
    };
  }


  private _nestedEmitEventsHost(): NestedEmitEventsHost {
    return {
      ...this._scaledPreserveEmitHost(),
      categoryId: this.categoryId,
      pendingValueChunkPredecessors: this.pendingValueChunkPredecessors,
      forcedChunkableValueWriteBandStart: this.forcedChunkableValueWriteBandStart,
      detachedEventReceipts: this.detachedEventReceipts,
      builderOptions: this.builderOptions,
      ensureDistinctJobEventNfts: (builder) => {
        this._ensureDistinctJobEventNfts(builder);
      },
      materializeValueChunkBand: (builder) => {
        this._materializeValueChunkBand(builder);
      },
      placeValueChunkPredecessorInputs: (extras) => {
        this._placeValueChunkPredecessorInputs(extras);
      },
      reassertPersistedValueChunkOneToOnes: (builder, emitDest) => {
        this._reassertPersistedValueChunkOneToOnes(builder, emitDest);
      },
    };
  }


  private _persistedValueChunkOneToOneHost(): PersistedValueChunkOneToOneHost {
    return {
      ...this._scaledPreserveEmitHost(),
      compilerRouteDelegateBlock: this.compilerRouteDelegateBlock,
      preserveBlockLayoutWidth: this.preserveBlockLayoutWidth,
      pendingValueChunkPredecessors: this.pendingValueChunkPredecessors,
      valueChunkRedeemLock: this.valueChunkRedeemLock,
      hasMintingBandTokenWriter: () => this.hasMintingBandTokenWriter(),
      declaredExternalOutputSlotOwner: (outputIndex) => this._declaredExternalOutputSlotOwner(outputIndex),
      persistUpdateDigestLock: (categoryId) => this._persistUpdateDigestLock(categoryId),
      persistValueChunkLock: (categoryId, value) => this._persistValueChunkLock(categoryId, value),
      persistedValueChunkValue: (categoryId) => this._persistedValueChunkValue(categoryId),
      persistedValueChunkWrite: (categoryId) => this._persistedValueChunkWrite(categoryId),
      stagedValueChunkWrite: (categoryId) => this._stagedValueChunkWrite(categoryId),
    };
  }


  private _placeTailReturnHost(): PlaceTailReturnHost {
    return {
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      mintingOutputSwap: this.mintingOutputSwap,
      messageBusConvention: this.messageBusConvention,
      delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
      builtReturnEventOutputIndices: this.builtReturnEventOutputIndices,
      authenticatedViewReturnByGroup: this.authenticatedViewReturnByGroup,
      valueChunkOutputs: this.valueChunkOutputs,
      findMintingInputIndex: (categoryId) => this.findMintingInputIndex(categoryId),
      getChunkableValueWriteBand: () => this.getChunkableValueWriteBand(),
      dynamicChunkOutputCount: () => this._dynamicChunkOutputCount(),
      tailReturnEventOutputs: () => this.tailReturnEventOutputs(),
      viewTailPackOptions: (suffixStart) => this.viewTailPackOptions(suffixStart),
      declaredMutableEntrySlotIndices: () => this._declaredMutableEntrySlotIndices(),
      writeViewTailsAfterWriterOccupancy: (builder, returnOutputRefs) => {
        this._writeViewTailsAfterWriterOccupancy(builder, returnOutputRefs);
      },
      restoreDeclaredMutableEntrySlots: (builder) => {
        this._restoreDeclaredMutableEntrySlots(builder);
      },
      reassertInBlockWriterReturns: (builder) => {
        this._reassertInBlockWriterReturns(builder);
      },
      callRecordDigest: (identity: string) => this.callRecordDigestFor(identity),
    };
  }


  private _authenticatedViewReturnHost(): AuthenticatedViewReturnHost {
    return {
      allInputs: this.allInputs,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      authenticatedViewReturnByGroup: this.authenticatedViewReturnByGroup,
      builtReturnEventOutputIndices: this.builtReturnEventOutputIndices,
      categoryId: this.categoryId,
      delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
      dynamicChunkVars: this.dynamicChunkVars,
      blockLayout: this.blockLayout,
      tailReturnEventOutputs: () => this.tailReturnEventOutputs(),
      getDynamicChunkVars: () => this.getDynamicChunkVars(),
      dynamicChunkOutputCount: () => this._dynamicChunkOutputCount(),
      syncRefreshedCarrierMasters: (builder, carriers) => {
        this._syncRefreshedCarrierMasters(builder, carriers);
      },
      callRecordDigest: (identity: string) => this.callRecordDigestFor(identity),
    };
  }


  private _refreshedUnlockerSyncHost(): RefreshedUnlockerSyncHost {
    const self = this;
    return {
      coordinateBase: this.getComposedBlockBase(),
      allInputs: this.allInputs,
      get masterUtxo() { return self.masterUtxo; },
      set masterUtxo(next) { self.masterUtxo = next; },
      get masterUnlockerRefresher() { return self.masterUnlockerRefresher; },
    };
  }


  private _materializedNftUnlockerReconcileHost(): MaterializedNftUnlockerReconcileHost {
    return {
      allInputs: this.allInputs,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      iterationEntryInputs: this.iterationEntryInputs,
      entryNfts: this.entryNfts,
      findMintingInputIndex: (categoryId) => this.findMintingInputIndex(categoryId),
      syncBuilderUnlockers: (builder) => { this._syncBuilderUnlockers(builder); },
      syncRefreshedCarrierMasters: (builder, carriers) => {
        this._syncRefreshedCarrierMasters(builder, carriers);
      },
    };
  }


  private _materializedPredOutReconcileHost(): MaterializedPredOutReconcileHost {
    return {
      allInputs: this.allInputs,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      syncRefreshedCarrierMasters: (builder, carriers) => {
        this._syncRefreshedCarrierMasters(builder, carriers);
      },
      getLoopEntryOutputBase: () => this.getLoopEntryOutputBase(),
      getCallerTrailingBandEnd: () => this.getCallerTrailingBandEnd(),
    };
  }


  private _materializedReturnWitnessReconcileHost(): MaterializedReturnWitnessReconcileHost {
    return {
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      pendingReturnEventOutputs: this.pendingReturnEventOutputs,
      getBuiltExternalCallReturnEventOutputIndex: (groupIdx) => (
        this.getBuiltExternalCallReturnEventOutputIndex(groupIdx)
      ),
      syncRefreshedCarrierMasters: (builder, carriers) => {
        this._syncRefreshedCarrierMasters(builder, carriers);
      },
      callRecordDigest: (identity: string) => this.callRecordDigestFor(identity),
    };
  }


  private _repackViewTailsHost(): RepackViewTailsHost {
    return {
      allInputs: this.allInputs,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      messageBusConvention: this.messageBusConvention,
      delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
      derivedChunkOutputs: this.derivedChunkOutputs,
      findMintingInputIndex: (categoryId) => this.findMintingInputIndex(categoryId),
      getChunkableValueWriteBand: () => this.getChunkableValueWriteBand(),
      dynamicChunkOutputCount: () => this._dynamicChunkOutputCount(),
      viewTailPackOptions: (suffixStart) => this.viewTailPackOptions(suffixStart),
      syncBuilderUnlockers: (builder) => { this._syncBuilderUnlockers(builder); },
    };
  }


  private _stripSurplusLinearBatchHost(): StripSurplusLinearBatchHost {
    return {
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      externalCallEntryInserts: this.externalCallEntryInserts,
      findMintingInputIndex: (categoryId) => this.findMintingInputIndex(categoryId),
    };
  }


  private _tokenInsertNewLocksHost(): TokenInsertNewLocksHost {
    return {
      allInputs: this.allInputs,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      entryRawCommitments: this.entryRawCommitments,
      externalCallEntryOutputs: this.externalCallEntryOutputs,
      findMintingInputIndex: (categoryId) => this.findMintingInputIndex(categoryId),
    };
  }


  private _declaredCollectionCardinalityHost(): DeclaredCollectionCardinalityHost {
    return {
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      externalCallEntryOutputsByIndex: this.externalCallEntryOutputsByIndex,
      findMintingInputIndex: (categoryId) => this.findMintingInputIndex(categoryId),
    };
  }


  private _mintingOneToOneHost(): MintingOneToOneHost {
    return {
      allInputs: this.allInputs,
      tokenContainers: this.tokenContainers,
    };
  }


  private _lateValueSuffixRebindHost(): LateValueSuffixRebindHost {
    const self = this;
    return {
      get derivedChunkOutputs() { return self.derivedChunkOutputs; },
      set derivedChunkOutputs(next) { self.derivedChunkOutputs = next; },
      get externalCallEntryOutputsByIndex() { return self.externalCallEntryOutputsByIndex; },
      set externalCallEntryOutputsByIndex(next) { self.externalCallEntryOutputsByIndex = next; },
      get builtReturnEventOutputIndices() { return self.builtReturnEventOutputIndices; },
      set builtReturnEventOutputIndices(next) { self.builtReturnEventOutputIndices = next; },
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      categoryId: this.categoryId,
      getBuiltExternalCallReturnEventOutputIndex: (groupIdx) => (
        this.getBuiltExternalCallReturnEventOutputIndex(groupIdx)
      ),
      syncRefreshedCarrierMasters: (builder, carriers) => {
        this._syncRefreshedCarrierMasters(builder, carriers);
      },
    };
  }


  private _registerStatefulInputsHost(): RegisterStatefulInputsHost {
    return {
      locktimeOverride: this.locktimeOverride,
      allInputs: this.allInputs,
      masterUtxo: this.masterUtxo,
      dataNftUtxos: this.dataNftUtxos,
      readOnlyDataNftUtxos: this.readOnlyDataNftUtxos,
      blockhashCoSpendUtxos: this.blockhashCoSpendUtxos,
      keccakComputeCoSpendUtxos: this.keccakComputeCoSpendUtxos,
      keccakLoopSideCars: this.keccakLoopSideCars,
      ecrecoverComputeCoSpendUtxos: this.ecrecoverComputeCoSpendUtxos,
      iterationEntryInputs: this.iterationEntryInputs,
      insertLoopPredecessorInputs: this.insertLoopPredecessorInputs,
      dynamicChunkInputs: this.dynamicChunkInputs,
      trailingDisposalInputs: this.trailingDisposalInputs,
      externalOutStateUtxoGroups: this.externalOutStateUtxoGroups,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      lowLevelCallRawInputs: this.lowLevelCallRawInputs,
      funderUtxos: this.funderUtxos,
      entryNfts: this.entryNfts,
      tokenContainers: this.tokenContainers,
      satoshiContainerUtxo: this.satoshiContainerUtxo,
      externalIdentityAnchorUtxos: this.externalIdentityAnchorUtxos,
      logicalIdentityUtxo: this.logicalIdentityUtxo,
      sidecarUtxo: this.sidecarUtxo,
    };
  }

  private _materializeOwnerFrontOutputsHost(): MaterializeOwnerFrontOutputsHost {
    return {
      masterUtxo: this.masterUtxo,
      requiredNftIndices: this.requiredNftIndices,
      dataNftUtxos: this.dataNftUtxos,
      stateRawCommitments: this.stateRawCommitments,
      stateLayout: this.stateLayout,
      builderOptions: this.builderOptions,
      categoryId: this.categoryId,
      readOnlyDataNftUtxos: this.readOnlyDataNftUtxos,
      delegateComputeResources: this.delegateComputeResources,
      compilerRouteDelegateBlock: this.compilerRouteDelegateBlock,
      blockhashCoSpendUtxos: this.blockhashCoSpendUtxos,
      blockInfoCoSpendUtxos: this.blockInfoCoSpendUtxos,
      delegateBlockInfoOracle: this.delegateBlockInfoOracle,
      blockhashCoSpendSlotOrdinals: this.blockhashCoSpendSlotOrdinals,
      keccakComputeCoSpendUtxos: this.keccakComputeCoSpendUtxos,
      keccakComputeCommitments: this.keccakComputeCommitments,
      preserveBlockLayoutWidth: this.preserveBlockLayoutWidth,
      blockLayout: this.blockLayout,
      ecrecoverComputeRecreates: this.ecrecoverComputeRecreates,
      externalOutStateUtxoGroups: this.externalOutStateUtxoGroups,
      externalCallStateUpdates: this.externalCallStateUpdates,
      externalCallStateRawCommitments: this.externalCallStateRawCommitments,
      iterationEntryInputs: this.iterationEntryInputs,
      iterationChunksPrecedeCallees: this.iterationChunksPrecedeCallees(),
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
    };
  }

  private _appendDelegateOutputHelpersHost(): AppendDelegateOutputHelpersHost {
    return {
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      derivedChunkOutputs: this.derivedChunkOutputs,
      externalCallEntryOutputsByIndex: this.externalCallEntryOutputsByIndex,
      externalCallEntryOutputs: this.externalCallEntryOutputs,
      delegateComputeResources: this.delegateComputeResources,
      compilerRouteDelegateBlock: this.compilerRouteDelegateBlock,
      blockInfoCoSpendUtxos: this.delegateBlockInfoOracle ? this.blockInfoCoSpendUtxos : [],
      keccakComputeCoSpendUtxos: this.keccakComputeCoSpendUtxos,
      keccakComputeCommitments: this.keccakComputeCommitments,
      categoryId: this.categoryId,
      ecrecoverComputeRecreates: this.ecrecoverComputeRecreates,
      pendingTransfers: this.pendingTransfers,
      activeDelegateGroupIndex: this.activeDelegateGroupIndex,
      blockLayout: this.blockLayout,
      iterationEntryInputs: this.iterationEntryInputs,
      externalCallEntryInserts: this.externalCallEntryInserts,
      loopEntryCommitments: this.loopEntryCommitments,
      getLowLevelCallMasterInputIndex: (groupIndex) => this.getLowLevelCallMasterInputIndex(groupIndex),
      delegateLoopEntryVars: () => this._delegateLoopEntryVars(),
      unmaterializedReturnEventCompact: (layout, unlocker) => (
        this._unmaterializedReturnEventCompact(layout, unlocker)
      ),
      getLoopEntryOutputBase: () => this.getLoopEntryOutputBase(),
      loopEntryTransitionSatoshis: (variable, commitment) => (
        this._loopEntryTransitionSatoshis(variable, commitment)
      ),
      setIterationEntriesPlacedAtDelegateBase: (value) => {
        this.iterationEntriesPlacedAtDelegateBase = value;
      },
    };
  }

  private _materializeExternalCallOutputsHost(): MaterializeExternalCallOutputsHost {
    return {
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      externalCallStateUpdates: this.externalCallStateUpdates,
      externalCallStateRawCommitments: this.externalCallStateRawCommitments,
      externalCallEntryInserts: this.externalCallEntryInserts,
      externalCallEntryOutputs: this.externalCallEntryOutputs,
      allInputs: this.allInputs,
      entryNfts: this.entryNfts,
      entryRawCommitments: this.entryRawCommitments,
      derivedChunkOutputs: this.derivedChunkOutputs,
      pendingReturnEventOutputs: this.pendingReturnEventOutputs,
      categoryId: this.categoryId,
      builderOptions: this.builderOptions,
      messageBusConvention: this.messageBusConvention,
      delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
      delegateEntriesAfterLowLevel: this.delegateEntriesAfterLowLevel,
      delegateReturnEventAfterEvents: this.delegateReturnEventAfterEvents,
      mintingOutputSwap: this.mintingOutputSwap,
      insertLoopPredecessorInputs: this.insertLoopPredecessorInputs,
      getExternalCallMasterInputIndex: (groupIndex) => this.getExternalCallMasterInputIndex(groupIndex),
      getExternalCallOutputBase: (groupIndex) => this.getExternalCallOutputBase(groupIndex),
      padOutputsToIndex: (b, index) => this._padOutputsToIndex(b, index),
      externalEntryLockingBytecode: (group, slot) => this._externalEntryLockingBytecode(group, slot),
      tailReturnEventOutputs: () => this.tailReturnEventOutputs(),
      callRecordDigest: (identity) => this.callRecordDigestFor(identity),
    };
  }

  private _finalizeBuildStampHost(): FinalizeBuildStampHost {
    return {
      categoryId: this.categoryId,
      rootStateContract: isContractUnlocker(this.masterUtxo.unlocker) ? this.masterUtxo.unlocker.contract : undefined,
      composedParticipant: this.composedParticipant,
      allInputs: this.allInputs,
      entryNfts: this.entryNfts,
      entryDeletes: this.entryDeletes,
      blockLayout: this.blockLayout,
      pendingOutputs: this.pendingOutputs,
      externalIdentityAnchorUtxos: this.externalIdentityAnchorUtxos,
      logicalIdentityUtxo: this.logicalIdentityUtxo,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      funderUtxos: this.funderUtxos,
      valueChunkOutputs: this.valueChunkOutputs,
      lateValueChunkOutputs: this.lateValueChunkOutputs,
      delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
      compilerRouteDelegateBlock: this.compilerRouteDelegateBlock,
      delegateEntriesAfterLowLevel: this.delegateEntriesAfterLowLevel,
      authenticatedViewReturnByGroup: this.authenticatedViewReturnByGroup,
      applyDerivedValueChunks: (b) => { this._applyDerivedValueChunks(b); },
      reassertStagedValueChunkOutputs: (b) => { this._reassertStagedValueChunkOutputs(b); },
      stripSurplusDerivedValueChunkLocks: (b) => { this._stripSurplusDerivedValueChunkLocks(b); },
      stripEmptyDuplicateEntryLocks: (b) => { this._stripEmptyDuplicateEntryLocks(b); },
      syncBuilderUnlockers: (b) => { this._syncBuilderUnlockers(b); },
      syncRefreshedCarrierMasters: (b, carriers) => { this._syncRefreshedCarrierMasters(b, carriers); },
      dynamicChunkOutputCount: () => this._dynamicChunkOutputCount(),
      ensureAuthenticatedViewReturns: (b) => this._ensureAuthenticatedViewReturns(b),
      reconcileMaterializedReturnWitnesses: (b) => this._reconcileMaterializedReturnWitnesses(b),
    };
  }

  private _materializeRuntimeLoopTrailingHost(): MaterializeRuntimeLoopTrailingHost {
    return {
      categoryId: this.categoryId,
      runtimeLoopTrailingSegments: this.runtimeLoopTrailingSegments,
      runtimeLoopEventOutputs: this.runtimeLoopEventOutputs,
      runtimeLoopTransferOutputs: this.runtimeLoopTransferOutputs,
      loopEntryCommitments: this.loopEntryCommitments,
      keccakLoopRecreates: this.keccakLoopRecreates,
      keccakLoopFollowsTrailingUser: this.keccakLoopFollowsTrailingUser,
      kernelJournalSettlementOutputPlan: this.kernelJournalSettlementOutputPlan,
      kernelJournalEagerOutputPlan: this.kernelJournalEagerOutputPlan,
      loopEntriesBeforeDynamicChunks: this.loopEntriesBeforeDynamicChunks,
      delegateEntriesAfterLowLevel: this.delegateEntriesAfterLowLevel,
      compilerRouteDelegateBlock: this.compilerRouteDelegateBlock,
      trailingLoopEntryVars: () => this._trailingLoopEntryVars(),
      delegateLoopEntryVars: () => this._delegateLoopEntryVars(),
      validateKernelJournalSettlementOutputPlan: () => {
        this.validateKernelJournalSettlementOutputPlan();
      },
      kernelJournalOutputLayout: () => this.kernelJournalOutputLayout(),
      trailingLoopEntryOutputCount: () => this._trailingLoopEntryOutputCount(),
      loopEntryTransitionSatoshis: (variable, commitment) => (
        this._loopEntryTransitionSatoshis(variable, commitment)
      ),
      getRequiredLoopEntryCount: (collection) => this.getRequiredLoopEntryCount(collection),
      getLoopEntryOutputBase: () => this.getLoopEntryOutputBase(),
    };
  }

  private _materializeValueAndDynamicChunksHost(): MaterializeValueAndDynamicChunksHost {
    return {
      categoryId: this.categoryId,
      valueChunkOutputs: this.valueChunkOutputs,
      derivedChunkOutputs: this.derivedChunkOutputs,
      dynamicChunkVars: this.dynamicChunkVars,
      dynamicChunkInputs: this.dynamicChunkInputs,
      allInputs: this.allInputs,
      chunkRawCommitments: this.chunkRawCommitments,
      blockLayout: this.blockLayout,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      lowLevelCallRawInputs: this.lowLevelCallRawInputs,
      iterationEntryInputs: this.iterationEntryInputs,
      pendingOutputs: this.pendingOutputs,
      externalIdentityAnchorUtxos: this.externalIdentityAnchorUtxos,
      logicalIdentityUtxo: this.logicalIdentityUtxo,
      delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
      runtimeLoopOrComposed: this.getComposedBlockBase() > 0 || this.runtimeLoopTrailingSegments.length > 0
        || this.runtimeLoopEventOutputs.length > 0 || this.runtimeLoopTransferOutputs.length > 0,
      masterUnlocker: () => this.masterUtxo.unlocker,
      getChunkableValueWriteBand: () => this.getChunkableValueWriteBand(),
      getValueChunkVars: () => this.getValueChunkVars(),
      valueChunkRawCommitments: this.valueChunkRawCommitments,
      padOutputsToIndex: (b, outputIndex) => { this._padOutputsToIndex(b, outputIndex); },
      getChunkOutputBase: () => this.getChunkOutputBase(),
      loopEntryOutputCount: () => this._loopEntryOutputCount(),
      valueChunkOutputCount: () => this._valueChunkOutputCount(),
      tailReturnEventOutputs: () => this.tailReturnEventOutputs(),
    };
  }

  private _materializeTrailingFrameAndPendingHost(): MaterializeTrailingFrameAndPendingHost {
    return {
      runtimeLoopTrailingSegments: this.runtimeLoopTrailingSegments,
      loopEntriesBeforeDynamicChunks: this.loopEntriesBeforeDynamicChunks,
      delegateEntriesAfterLowLevel: this.delegateEntriesAfterLowLevel,
      loopEntryCommitments: this.loopEntryCommitments,
      categoryId: this.categoryId,
      blockLayout: this.blockLayout,
      iterationEntryInputs: this.iterationEntryInputs,
      runtimeLoopEventOutputs: this.runtimeLoopEventOutputs,
      runtimeLoopTransferOutputs: this.runtimeLoopTransferOutputs,
      valueChunkOutputs: this.valueChunkOutputs,
      valueChunkRawCommitments: this.valueChunkRawCommitments,
      loopEntryVars: this.loopEntryVars,
      compilerRouteDelegateBlock: this.compilerRouteDelegateBlock,
      composedParticipant: this.composedParticipant,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      pendingOutputs: this.pendingOutputs,
      trailingLoopEntryVars: () => this._trailingLoopEntryVars(),
      loopEntryTransitionSatoshis: (variable, commitment) => (
        this._loopEntryTransitionSatoshis(variable, commitment)
      ),
      dynamicChunkOutputCount: () => this._dynamicChunkOutputCount(),
      trailingLoopEntryOutputCount: () => this._trailingLoopEntryOutputCount(),
      getValueChunkVars: () => this.getValueChunkVars(),
    };
  }

  private _materializeOwnerEntriesContainersTransfersHost(): MaterializeOwnerEntriesContainersTransfersHost {
    return {
      blockLayout: this.blockLayout,
      categoryId: this.categoryId,
      stateLayout: this.stateLayout,
      entryNfts: this.entryNfts,
      entryDeletes: this.entryDeletes,
      entryUpdates: this.entryUpdates,
      entryRawCommitments: this.entryRawCommitments,
      entryNftLockingBytecodes: this.entryNftLockingBytecodes,
      satoshiContainerUtxo: this.satoshiContainerUtxo,
      satoshiContainerLockingBytecode: this.satoshiContainerLockingBytecode,
      tokenContainers: this.tokenContainers,
      tokenContainerLockingBytecodes: this.tokenContainerLockingBytecodes,
      pendingTransfers: this.pendingTransfers,
      pendingTokenContainerTransfers: this.pendingTokenContainerTransfers,
      pendingTokenContainerTransferNfts: this.pendingTokenContainerTransferNfts,
      pendingTokenContainerDeposits: this.pendingTokenContainerDeposits,
      runtimeLoopTransferOutputs: this.runtimeLoopTransferOutputs,
      containerDepositAmount: this.containerDepositAmount,
      entryPlaceholderFillThreshold: () => this.entryPlaceholderFillThreshold(),
      isTokenContainerDrained: (categoryId) => this.isTokenContainerDrained(categoryId),
    };
  }

  private _finalizeBuildDerivedSuffixHost(): FinalizeBuildDerivedSuffixHost {
    return {
      lateValueChunkOutputs: this.lateValueChunkOutputs,
      sidecarUtxo: this.sidecarUtxo,
      delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
      mintingOutputSwap: this.mintingOutputSwap,
      dynamicChunkVars: this.dynamicChunkVars,
      allInputs: this.allInputs,
      derivedChunkOutputs: this.derivedChunkOutputs,
      externalCallEntryOutputsByIndex: this.externalCallEntryOutputsByIndex,
      dynamicChunkOutputCount: () => this._dynamicChunkOutputCount(),
      fillSwappedTokenEntryHoles: (b) => { this._fillSwappedTokenEntryHoles(b); },
      applyDerivedValueChunks: (b) => { this._applyDerivedValueChunks(b); },
      applyDerivedEntryOutputs: (b) => { this._applyDerivedEntryOutputs(b); },
      constrainParticipantImmutableOutputs: (b) => {
        this._constrainParticipantImmutableOutputs(b);
      },
      restoreSwappedTokenFunderSlots: (b) => { this._restoreSwappedTokenFunderSlots(b); },
      reassertReverseSuffixDynamicChunks: (b) => {
        this._reassertReverseSuffixDynamicChunks(b);
      },
    };
  }

  private _reassertBuildConservationRepairsHost(): ReassertBuildConservationRepairsHost {
    return {
      allInputs: this.allInputs,
      tagEmptyP2sh32ImmutablesAsScid: (b) => { this._tagEmptyP2sh32ImmutablesAsScid(b); },
      ensureOpTrueReturnWitnessesAreImmutable: (b) => {
        this._ensureOpTrueReturnWitnessesAreImmutable(b);
      },
      reassertDelegateLoopEntries: (b) => { this._reassertDelegateLoopEntries(b); },
      reassertNestedMintingMasters: (b) => { this._reassertNestedMintingMasters(b); },
      stripSurplusEmptyCollectionEntries: (b) => {
        this._stripSurplusEmptyCollectionEntries(b);
      },
      reassertNestedSameIndexMutables: (b) => { this._reassertNestedSameIndexMutables(b); },
      applyDerivedEntryOutputs: (b) => { this._applyDerivedEntryOutputs(b); },
      reassertFixedStateOutputs: (b) => { this._reassertFixedStateOutputs(b); },
      reassertNestedEmitEvents: (b) => { this._reassertNestedEmitEvents(b); },
      reassertDelegateImplEvents: (b) => { this._reassertDelegateImplEvents(b); },
      reassertMintingOneToOne: (b) => { this._reassertMintingOneToOne(b); },
      reassertTokenInsertNewLocks: (b) => { this._reassertTokenInsertNewLocks(b); },
      scidReservedIndices: (outputCount) => this._scidReservedIndices(outputCount),
      isPersistedChunkableValueWriteReady: () => this._isPersistedChunkableValueWriteReady(),
      packReverseIndexedValueChunkSuffix: (b) => { this._packReverseIndexedValueChunkSuffix(b); },
    };
  }

  private _materializeTrailingIterationEntriesHost(): MaterializeTrailingIterationEntriesHost {
    return {
      blockLayout: this.blockLayout,
      iterationEntryInputs: this.iterationEntryInputs,
      dynamicChunkVars: this.dynamicChunkVars,
      loopEntriesBeforeDynamicChunks: this.loopEntriesBeforeDynamicChunks,
      runtimeLoopEventOutputs: this.runtimeLoopEventOutputs,
      runtimeLoopTransferOutputs: this.runtimeLoopTransferOutputs,
      valueChunkOutputs: this.valueChunkOutputs,
      valueChunkVars: this.valueChunkVars,
      iterationEntriesPlacedAtDelegateBase: this.iterationEntriesPlacedAtDelegateBase,
      categoryId: this.categoryId,
      getChunkOutputBase: () => this.getChunkOutputBase(),
      trailingLoopEntryOutputCount: () => this._trailingLoopEntryOutputCount(),
      getLoopEntryOutputBase: () => this.getLoopEntryOutputBase(),
      trailingLoopEntryVars: () => this._trailingLoopEntryVars(),
      getRuntimeLoopEventOutputBase: () => this.getRuntimeLoopEventOutputBase(),
      getRuntimeLoopTransferOutputIndex: (index) => this.getRuntimeLoopTransferOutputIndex(index),
      getValueChunkOutputBase: () => this.getValueChunkOutputBase(),
    };
  }

  private _patchRelocatedDelegateOutputBasesHost(): PatchRelocatedDelegateOutputBasesHost {
    return {
      delegateEntriesAfterLowLevel: this.delegateEntriesAfterLowLevel,
      compilerRouteDelegateBlock: this.compilerRouteDelegateBlock,
      blockLayout: this.blockLayout,
      requiredNftIndices: this.requiredNftIndices,
      readOnlyDataNftUtxos: this.readOnlyDataNftUtxos,
      blockhashCoSpendUtxos: this.blockhashCoSpendUtxos,
      keccakComputeCoSpendUtxos: this.keccakComputeCoSpendUtxos,
      ecrecoverComputeCoSpendUtxos: this.ecrecoverComputeCoSpendUtxos,
      iterationEntryInputs: this.iterationEntryInputs,
      externalOutStateUtxoGroups: this.externalOutStateUtxoGroups,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      externalCallEntryInserts: this.externalCallEntryInserts,
      getLowLevelCallMasterInputIndex: (groupIndex) => this.getLowLevelCallMasterInputIndex(groupIndex),
    };
  }

  private _submitFinalTransactionHost(): SubmitFinalTransactionHost {
    return {
      dynamicChunkVars: this.dynamicChunkVars,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      allInputs: this.allInputs,
      externalCallEntryOutputsByIndex: this.externalCallEntryOutputsByIndex,
      logicalIdentityUtxo: this.logicalIdentityUtxo,
      externalIdentityAnchorUtxos: this.externalIdentityAnchorUtxos,
      builderOptions: this.builderOptions,
      getChunkableValueWriteBand: () => this.getChunkableValueWriteBand(),
      getLowLevelCallMasterInputIndex: (index) => this.getLowLevelCallMasterInputIndex(index),
      logCovenantFailureTrace: (b, reason) => { this._logCovenantFailureTrace(b, reason); },
      persistPlacedValueChunkBand: (b, txid) => { this._persistPlacedValueChunkBand(b, txid); },
      decodeEmittedEvents: (outputs) => this.decodeEmittedEvents(outputs),
    };
  }

  private _createBuildSessionPreludeHost(): CreateBuildSessionPreludeHost {
    return {
      allInputs: this.allInputs,
      builderOptions: this.builderOptions,
      maximumFeeSatoshis: this._maximumFeeSatoshis,
      entryDeletes: this.entryDeletes,
      dynamicChunkInputs: this.dynamicChunkInputs,
      trailingDisposalInputs: this.trailingDisposalInputs,
      dynamicChunkVars: this.dynamicChunkVars,
      loopEntryVars: this.loopEntryVars,
      pendingTokenContainerTransferNfts: this.pendingTokenContainerTransferNfts,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
    };
  }

  private _createBuildDebugStagesHost(): CreateBuildDebugStagesHost {
    return {
      categoryId: this.categoryId,
      blockLayout: this.blockLayout,
      pendingReturnEventOutputs: this.pendingReturnEventOutputs,
      allInputs: this.allInputs,
      loopEntryVars: this.loopEntryVars,
    };
  }

  private _seedOwnerCurrentStateHost(): SeedOwnerCurrentStateHost {
    return {
      requiredNftIndices: this.requiredNftIndices,
      dataNftUtxos: this.dataNftUtxos,
      stateLayout: this.stateLayout,
      stateUpdates: this.stateUpdates,
      preserveOwnState: this._preserveOwnStateOnUntakenDelegateEdge(),
    };
  }

  /**
   * A delegatecall handler skips its own state covenant for the whole body; the compiler freezes its own data
   * NFTs on every path that did not reach a conditional delegate edge. When every published edge guard
   * evaluates false for this call's arguments, no state write is authorized, so the requested updates must not
   * be materialized. Read from the same unlocker the executor will present.
   */
  private _preserveOwnStateOnUntakenDelegateEdge(): boolean {
    const unlocker = this.masterUtxo.unlocker;
    return isContractUnlocker(unlocker)
      && ownStatePreservedOnUntakenConditionalDelegate(unlocker.abiFunction, unlocker.params);
  }

  private _materializeOwnerEventNftOutputsHost(): MaterializeOwnerEventNftOutputsHost {
    return {
      pendingEventEmits: this.pendingEventEmits,
      eventDefinitions: this.eventDefinitions,
      stateLayout: this.stateLayout,
      pendingEventPlaceholders: this.pendingEventPlaceholders,
      eventRawCommitments: this.eventRawCommitments,
      blockLayout: this.blockLayout,
      categoryId: this.categoryId,
      eventNftLockingBytecodes: this.eventNftLockingBytecodes,
    };
  }

  private _materializeReturnEventOutputsHost(
    addReturnOutput: MaterializeReturnEventOutputsHost['addReturnOutput'],
  ): MaterializeReturnEventOutputsHost {
    return {
      allInputs: this.allInputs,
      blockLayout: this.blockLayout,
      categoryId: this.categoryId,
      plannedReturnOutputIndex: this.plannedReturnOutputIndex,
      delegateEntriesAfterLowLevel: this.delegateEntriesAfterLowLevel,
      pendingReturnEventOutputs: this.pendingReturnEventOutputs,
      keccakSideCarsFollowBlock: this.keccakSideCarsFollowBlock,
      builtReturnEventOutputIndices: this.builtReturnEventOutputIndices,
      tailReturnEventOutputs: () => this.tailReturnEventOutputs(),
      addReturnOutput,
      callRecordDigest: (identity) => this.callRecordDigestFor(identity),
    };
  }

  private _materializeLowLevelCallOutputsHost(): MaterializeLowLevelCallOutputsHost {
    return {
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      lowLevelCallRawInputs: this.lowLevelCallRawInputs,
      blockLayout: this.blockLayout,
      delegateEntriesAfterLowLevel: this.delegateEntriesAfterLowLevel,
      compilerRouteDelegateBlock: this.compilerRouteDelegateBlock,
      externalCallStateUpdates: this.externalCallStateUpdates,
      externalCallStateRawCommitments: this.externalCallStateRawCommitments,
      childDeploymentOutputs: this.childDeploymentOutputs,
      builderOptions: this.builderOptions,
    };
  }

  private _measureAndFundCovenantFeeHost(): MeasureAndFundCovenantFeeHost {
    const self = this;
    return {
      get allInputs() { return self.allInputs; },
      set allInputs(value) { self.allInputs = value; },
      get funderUtxos() { return self.funderUtxos; },
      set funderUtxos(value) { self.funderUtxos = value; },
      get funderChangeAddress() { return self.funderChangeAddress; },
      set funderChangeAddress(value) { self.funderChangeAddress = value; },
      sidecarUtxo: this.sidecarUtxo,
      lateValueChunkOutputs: this.lateValueChunkOutputs,
      checkMinRelayFee: this._checkMinRelayFee,
      accountingFunderUtxos: () => this._accountingFunderUtxos(),
      computeMinFee: (size) => this.computeMinFee(size),
    };
  }

  private _placeSendChangeAndSidecarHost(): PlaceSendChangeAndSidecarHost {
    return {
      funderChangeAddress: this.funderChangeAddress,
      sidecarUtxo: this.sidecarUtxo,
      lateValueChunkOutputs: this.lateValueChunkOutputs,
      delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
      accountingFunderUtxos: () => this._accountingFunderUtxos(),
      dynamicChunkOutputCount: () => this._dynamicChunkOutputCount(),
      insertBeforeLateValueSuffix: (builder, output, options) => (
        this.insertBeforeLateValueSuffix(builder, output, options)
      ),
    };
  }

  private _reassertSendFinalConservationHost(
    rebalanceFunderSurplus: () => void,
  ): ReassertSendFinalConservationHost {
    return {
      iterationEntryInputs: this.iterationEntryInputs,
      applyLearnedWriterEvents: (b) => { this._applyLearnedWriterEvents(b); },
      reassertAuthenticatedEventOutputs: (b) => { this._reassertAuthenticatedEventOutputs(b); },
      clearUnclaimedConditionalEventSlots: (b) => { this._clearUnclaimedConditionalEventSlots(b); },
      stripSurplusDerivedValueChunkLocks: (b) => { this._stripSurplusDerivedValueChunkLocks(b); },
      reassertMintingOneToOne: (b) => { this._reassertMintingOneToOne(b); },
      scidReservedIndices: (n) => this._scidReservedIndices(n),
      reassertInBlockWriterReturns: (b) => { this._reassertInBlockWriterReturns(b); },
      rebalanceFunderSurplus: () => { rebalanceFunderSurplus(); },
    };
  }

  private _runBuildMidLateThroughTailHost(): RunBuildMidLateThroughTailHost {
    return {
      midCascadeHost: (addReturnOutput) => ({
        ownerEntriesHost: this._materializeOwnerEntriesContainersTransfersHost(),
        ownerEventHost: this._materializeOwnerEventNftOutputsHost(),
        returnEventHost: this._materializeReturnEventOutputsHost(addReturnOutput),
        llcOutputsHost: this._materializeLowLevelCallOutputsHost(),
        trailingIterationHost: this._materializeTrailingIterationEntriesHost(),
        runtimeLoopHost: this._materializeRuntimeLoopTrailingHost(),
        keccakLoopRecreates: this.keccakLoopRecreates,
        keccakLoopFollowsTrailingUser: this.keccakLoopFollowsTrailingUser,
      }),
      lateChunkFrameHost: () => ({
        delegateEntriesAfterLowLevel: this.delegateEntriesAfterLowLevel,
        delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
        valueDynamicHost: this._materializeValueAndDynamicChunksHost(),
        trailingFrameHost: this._materializeTrailingFrameAndPendingHost(),
        nestedCalleeHost: this._repairNestedCalleeOutputsHost(),
      }),
      finalizeBuildDerivedSuffixHost: () => this._finalizeBuildDerivedSuffixHost(),
      reassertBuildConservationRepairsHost: () => this._reassertBuildConservationRepairsHost(),
      finalizeBuildValueChunkBandAndViewsHost: () => this._finalizeBuildValueChunkBandAndViewsHost(),
      finalizeBuildStampHost: () => this._finalizeBuildStampHost(),
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
    };
  }

  private _runSendPhase4ThroughSubmitHost(): RunSendPhase4ThroughSubmitHost {
    return {
      convergeAndSerializeFinalTransactionHost: () => this._convergeAndSerializeFinalTransactionHost(),
      validateSendFeeCapsAndBytesHost: () => this._validateSendFeeCapsAndBytesHost(),
      submitFinalTransactionHost: () => this._submitFinalTransactionHost(),
    };
  }

  private _runBuildEarlyFrontHost(): RunBuildEarlyFrontHost {
    return {
      createBuildSessionPreludeHost: () => this._createBuildSessionPreludeHost(),
      patchRelocatedDelegateOutputBasesHost: () => this._patchRelocatedDelegateOutputBasesHost(),
      createBuildDebugStagesHost: () => this._createBuildDebugStagesHost(),
      registerStatefulInputsHost: () => this._registerStatefulInputsHost(),
      seedOwnerCurrentStateHost: () => this._seedOwnerCurrentStateHost(),
      materializeOwnerFrontOutputsHost: () => this._materializeOwnerFrontOutputsHost(),
      appendDelegateOutputHelpersHost: () => this._appendDelegateOutputHelpersHost(),
      appendEarlyDelegateOutputsHost: () => this._appendEarlyDelegateOutputsHost(),
      materializeExternalCallOutputsHost: () => this._materializeExternalCallOutputsHost(),
    };
  }

  private _runSendPhase3FinalRebuildHost(): RunSendPhase3FinalRebuildHost {
    return {
      strictVmPreflight: this.strictVmPreflight,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      build: () => this.build(),
      reassertSendFinalBuilderHost: () => this._reassertSendFinalBuilderHost(),
      placeSendChangeAndSidecarHost: () => this._placeSendChangeAndSidecarHost(),
      reassertSendAfterViewRepackHost: () => this._reassertSendAfterViewRepackHost(),
      createSendFinalLayoutReassertHost: () => this._createSendFinalLayoutReassertHost(),
      reassertSendPostLayoutMaterializationHost: () => this._reassertSendPostLayoutMaterializationHost(),
      strictRecursiveVmPreflight: (builder) => { this._strictRecursiveVmPreflight(builder); },
      repackViewTailsAfterMaterialization: (builder) => this._repackViewTailsAfterMaterialization(builder),
      getBuiltExternalCallReturnEventOutputIndex: (index) => (
        this.getBuiltExternalCallReturnEventOutputIndex(index)
      ),
    };
  }

  private _appendEarlyDelegateOutputsHost(): AppendEarlyDelegateOutputsHost {
    return {
      delegateEntriesAfterLowLevel: this.delegateEntriesAfterLowLevel,
      delegateReturnEventAfterEvents: this.delegateReturnEventAfterEvents,
      plannedReturnOutputIndex: this.plannedReturnOutputIndex,
      categoryId: this.categoryId,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      pendingReturnEventOutputs: this.pendingReturnEventOutputs,
      callRecordDigest: (identity) => this.callRecordDigestFor(identity),
    };
  }

  private _assembleConstructorInputsHost(): AssembleConstructorInputsHost {
    const self = this;
    return {
      get stateLayout() { return self.stateLayout; },
      get externalOutStateUtxoGroups() { return self.externalOutStateUtxoGroups; },
      get externalCallUtxoGroups() { return self.externalCallUtxoGroups; },
      get lowLevelCallUtxoGroups() { return self.lowLevelCallUtxoGroups; },
      get entryNfts() { return self.entryNfts; },
      get tokenContainers() { return self.tokenContainers; },
      get satoshiContainerUtxo() { return self.satoshiContainerUtxo; },
      get externalIdentityAnchorUtxos() { return self.externalIdentityAnchorUtxos; },
      get logicalIdentityUtxo() { return self.logicalIdentityUtxo; },
      get pendingValueChunkPredecessors() { return self.pendingValueChunkPredecessors; },
      get blockLayout() { return self.blockLayout; },
      get preserveBlockLayoutWidth() { return self.preserveBlockLayoutWidth; },
      get compilerRouteDelegateBlock() { return self.compilerRouteDelegateBlock; },
      get requiredNftIndices() { return self.requiredNftIndices; },
      set requiredNftIndices(next) { self.requiredNftIndices = next; },
      get allInputs() { return self.allInputs; },
      set allInputs(next) { self.allInputs = next; },
      buildInputs: (entryInputs, tokenContainerInputs, satoshiContainerInputs,
        externalOutStateInputs, externalCallInputs, lowLevelCallInputs) => (
        self._buildInputs(
          entryInputs, tokenContainerInputs, satoshiContainerInputs,
          externalOutStateInputs, externalCallInputs, lowLevelCallInputs,
        )
      ),
      swapMintingOffValueChunkBand: () => { self._swapMintingOffValueChunkBand(); },
      placeValueChunkPredecessorInputs: (extras) => {
        self._placeValueChunkPredecessorInputs([...extras]);
      },
    };
  }

  private _convergeAndSerializeFinalTransactionHost(): ConvergeAndSerializeFinalTransactionHost {
    return {
      allInputs: this.allInputs,
      funderChangeAddress: this.funderChangeAddress,
      checkMinRelayFee: this._checkMinRelayFee,
      pendingReturnEventOutputs: this.pendingReturnEventOutputs,
      builtReturnEventOutputIndices: this.builtReturnEventOutputIndices,
      computeMinFee: (size) => this.computeMinFee(size),
      assertConvergedFinalTransaction: (builder, reassertFinalLayout, finalizeFeeBeforeValidation) => (
        this._assertConvergedFinalTransaction(builder, reassertFinalLayout, finalizeFeeBeforeValidation)
      ),
    };
  }

  private _createSendFinalLayoutReassertHost(): CreateSendFinalLayoutReassertHost {
    return {
      funderChangeAddress: this.funderChangeAddress,
      insertBeforeLateValueSuffix: (builder, output, options) => (
        this.insertBeforeLateValueSuffix(builder, output, options)
      ),
      buildConservationHost: (rebalanceFunderSurplus) => (
        this._reassertSendFinalConservationHost(rebalanceFunderSurplus)
      ),
      buildFinalLayoutHost: (reassertFinalConservation) => (
        this._reassertSendFinalLayoutHost(reassertFinalConservation)
      ),
    };
  }

  private _reassertSendPostLayoutMaterializationHost(): ReassertSendPostLayoutMaterializationHost {
    return {
      placeTailReturnAfterSwappedTokenBlock: (builder) => {
        this._placeTailReturnAfterSwappedTokenBlock(builder);
      },
      ensureAuthenticatedViewReturns: (builder) => {
        this._ensureAuthenticatedViewReturns(builder);
      },
      reconcileMaterializedReturnWitnesses: (builder) => {
        this._reconcileMaterializedReturnWitnesses(builder);
      },
      ensureDistinctJobEventNfts: (builder) => {
        this._ensureDistinctJobEventNfts(builder);
      },
      finalizeReverseSuffixValueChunkLayout: (builder) => {
        this._finalizeReverseSuffixValueChunkLayout(builder);
      },
      enforceDeclaredCollectionOutputCardinality: (builder) => {
        this._enforceDeclaredCollectionOutputCardinality(builder);
      },
      syncBuilderUnlockers: (builder) => { this._syncBuilderUnlockers(builder); },
    };
  }

  private _validateSendFeeCapsAndBytesHost(): ValidateSendFeeCapsAndBytesHost {
    return {
      funderUtxos: this.funderUtxos,
      embeddedFunderUtxos: this.embeddedFunderUtxos,
      funderChangeAddress: this.funderChangeAddress,
      maximumFeeSatoshis: this._maximumFeeSatoshis,
    };
  }

  private _repairNestedCalleeOutputsHost(): RepairNestedCalleeOutputsHost {
    return {
      externalIdentityAnchorUtxos: this.externalIdentityAnchorUtxos,
      loopEntryVars: this.loopEntryVars,
      loopEntryCommitments: this.loopEntryCommitments,
      categoryId: this.categoryId,
      pendingOutputs: this.pendingOutputs,
      blockLayout: this.blockLayout,
      logicalIdentityUtxo: this.logicalIdentityUtxo,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      allInputs: this.allInputs,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      compilerRouteDelegateBlock: this.compilerRouteDelegateBlock,
      messageBusConvention: this.messageBusConvention,
      builderOptions: this.builderOptions,
      derivedChunkOutputs: this.derivedChunkOutputs,
      delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
      loopEntryTransitionSatoshis: (variable, commitment) => (
        this._loopEntryTransitionSatoshis(variable, commitment)
      ),
      delegateLoopEntryVars: () => this._delegateLoopEntryVars(),
      getLoopEntryOutputBase: () => this.getLoopEntryOutputBase(),
      getChunkOutputBase: () => this.getChunkOutputBase(),
      getLowLevelCallMasterInputIndex: (index) => this.getLowLevelCallMasterInputIndex(index),
      getExternalCallMasterInputIndex: (index) => this.getExternalCallMasterInputIndex(index),
      chunkableValueWriteInputIndex: () => this._chunkableValueWriteInputIndex(),
      shouldRematerializePersistUpdate: () => this._shouldRematerializePersistUpdate(),
      getExternalCallEntryOutput: (categoryId, blockSlot) => (
        this.getExternalCallEntryOutput(categoryId, blockSlot)
      ),
      getChunkableValueWriteBand: () => this.getChunkableValueWriteBand(),
      applyDerivedValueChunks: (b) => { this._applyDerivedValueChunks(b); },
    };
  }

  private _finalizeBuildValueChunkBandAndViewsHost(): FinalizeBuildValueChunkBandAndViewsHost {
    const self = this;
    return {
      allInputs: this.allInputs,
      valueChunkOutputs: this.valueChunkOutputs,
      valueChunkRedeemLock: this.valueChunkRedeemLock,
      preserveBlockLayoutWidth: this.preserveBlockLayoutWidth,
      pinnedEntrySlots: this.pinnedEntrySlots,
      requiredEntryOutputSlots: this.requiredEntryOutputSlots,
      get viewTailRepackAttempted() { return self.viewTailRepackAttempted; },
      set viewTailRepackAttempted(value) { self.viewTailRepackAttempted = value; },
      builtReturnEventOutputIndices: this.builtReturnEventOutputIndices,
      getChunkableValueWriteBand: () => this.getChunkableValueWriteBand(),
      chunkableValueWriteCategory: () => this._chunkableValueWriteCategory(),
      hasStagedValueChunkOutputs: () => this.hasStagedValueChunkOutputs(),
      permitsLegacyNamedValueChunkFallback: () => this._permitsLegacyNamedValueChunkFallback(),
      stripSurplusDerivedValueChunkLocks: (b) => { this._stripSurplusDerivedValueChunkLocks(b); },
      repackViewTailsAfterMaterialization: (b) => this._repackViewTailsAfterMaterialization(b),
      refreshInputs: () => { this._refreshInputs(); },
      reassertStagedValueChunkOutputs: (b) => { this._reassertStagedValueChunkOutputs(b); },
      materializeValueChunkBand: (b) => { this._materializeValueChunkBand(b); },
      placeTailReturnAfterSwappedTokenBlock: (b, refs) => {
        this._placeTailReturnAfterSwappedTokenBlock(b, refs);
      },
      ensureAuthenticatedViewReturns: (b) => { this._ensureAuthenticatedViewReturns(b); },
      reassertScaledPreserveOneToOnes: (b) => { this._reassertScaledPreserveOneToOnes(b); },
      reassertNestedEmitEvents: (b) => { this._reassertNestedEmitEvents(b); },
      reassertDelegateImplEvents: (b) => { this._reassertDelegateImplEvents(b); },
      isPersistedChunkableValueWriteReady: () => this._isPersistedChunkableValueWriteReady(),
      reassertPersistedValueChunkOneToOnes: (b, emitDest) => {
        this._reassertPersistedValueChunkOneToOnes(b, emitDest);
      },
      scaledEmitOutputIndex: (outputCount) => this._scaledEmitOutputIndex(outputCount),
      reassertMintingOneToOne: (b) => { this._reassertMintingOneToOne(b); },
      reassertFixedStateOutputs: (b) => { this._reassertFixedStateOutputs(b); },
      relocateCollidingDerivedValueChunkRuns: (b) => {
        this._relocateCollidingDerivedValueChunkRuns(b);
      },
      reconcileMaterializedInputWitnesses: (b) => {
        this._reconcileMaterializedInputWitnesses(b);
      },
      reconcileMaterializedPredOutWitnesses: (b) => {
        this._reconcileMaterializedPredOutWitnesses(b);
      },
      reconcileMaterializedReturnWitnesses: (b) => {
        this._reconcileMaterializedReturnWitnesses(b);
      },
    };
  }

  private _valueChunkBandHost(): ValueChunkBandHost {
    const self = this;
    return {
      ...this._scaledPreserveEmitHost(),
      categoryId: this.categoryId,
      allInputs: this.allInputs,
      mintingOutputSwap: this.mintingOutputSwap,
      derivedChunkOutputs: this.derivedChunkOutputs,
      valueChunkRedeemLock: this.valueChunkRedeemLock,
      delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
      get persistedJobEventsChunks() { return self.persistedJobEventsChunks; },
      set persistedJobEventsChunks(next) { self.persistedJobEventsChunks = next; },
      valueChunkWriteStagingSession: this.valueChunkWriteStagingSession,
      applyDerivedValueChunks: (builder) => this._applyDerivedValueChunks(builder),
      applyDerivedEntryOutputs: (builder) => { this._applyDerivedEntryOutputs(builder); },
      hasStagedValueChunkOutputs: () => this.hasStagedValueChunkOutputs(),
      rememberJobEventsChunks: (categoryId, chunks) => {
        this.rememberJobEventsChunks(categoryId, chunks);
      },
      stagedValueChunkWrite: (categoryId) => this._stagedValueChunkWrite(categoryId),
      persistValueChunkLock: (categoryId, value) => this._persistValueChunkLock(categoryId, value),
      persistedValueChunkWrite: (categoryId) => this._persistedValueChunkWrite(categoryId),
      persistedValueChunkValue: (categoryId) => this._persistedValueChunkValue(categoryId),
      persistUpdateDigestLock: (categoryId) => this._persistUpdateDigestLock(categoryId),
      getValueChunkVars: () => this.getValueChunkVars(),
      getValueChunkRawCommitments: (id) => this.getValueChunkRawCommitments(id),
      dynamicChunkOutputCount: () => this._dynamicChunkOutputCount(),
      reassertInBlockWriterReturns: (builder) => {
        this._reassertInBlockWriterReturns(builder);
      },
    };
  }

  private _delegateLoopEntriesHost(): DelegateLoopEntriesHost {
    return {
      loopEntryVars: this.loopEntryVars,
      categoryId: this.categoryId,
      insertLoopPredecessorInputs: this.insertLoopPredecessorInputs,
      blockLayout: this.blockLayout,
      plannedReturnOutputIndex: this.plannedReturnOutputIndex,
      activeDelegateGroupIndex: this.activeDelegateGroupIndex,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      allInputs: this.allInputs,
      dynamicChunkInputs: this.dynamicChunkInputs,
      trailingDisposalInputs: this.trailingDisposalInputs,
      compilerRouteDelegateBlock: this.compilerRouteDelegateBlock,
      iterationEntryInputs: this.iterationEntryInputs,
      loopEntryCommitments: this.loopEntryCommitments,
      getLoopEntryOutputBase: () => this.getLoopEntryOutputBase(),
    };
  }

  private _reassertSendFinalBuilderHost(): ReassertSendFinalBuilderHost {
    return {
      allInputs: this.allInputs,
      syncBuilderUnlockers: (builder) => { this._syncBuilderUnlockers(builder); },
      clearUnclaimedConditionalEventSlots: (builder) => {
        this._clearUnclaimedConditionalEventSlots(builder);
      },
      scidReservedIndices: (outputCount) => this._scidReservedIndices(outputCount),
      reassertNestedEmitEvents: (builder) => { this._reassertNestedEmitEvents(builder); },
      reassertDelegateImplEvents: (builder) => { this._reassertDelegateImplEvents(builder); },
      materializeValueChunkBand: (builder) => { this._materializeValueChunkBand(builder); },
      placeTailReturnAfterSwappedTokenBlock: (builder) => {
        this._placeTailReturnAfterSwappedTokenBlock(builder);
      },
      ensureAuthenticatedViewReturns: (builder) => {
        this._ensureAuthenticatedViewReturns(builder);
      },
      reassertScaledPreserveOneToOnes: (builder) => {
        this._reassertScaledPreserveOneToOnes(builder);
      },
      isPersistedChunkableValueWriteReady: () => this._isPersistedChunkableValueWriteReady(),
      reassertPersistedValueChunkOneToOnes: (builder, emitDest) => {
        this._reassertPersistedValueChunkOneToOnes(builder, emitDest);
      },
      scaledEmitOutputIndex: (outputCount) => this._scaledEmitOutputIndex(outputCount),
      reassertMintingOneToOne: (builder) => { this._reassertMintingOneToOne(builder); },
      reassertFixedStateOutputs: (builder) => { this._reassertFixedStateOutputs(builder); },
      restoreSwappedTokenFunderSlots: (builder) => {
        this._restoreSwappedTokenFunderSlots(builder);
      },
    };
  }

  private _reassertSendAfterViewRepackHost(): ReassertSendAfterViewRepackHost {
    return {
      allInputs: this.allInputs,
      refreshInputs: () => { this._refreshInputs(); },
      syncBuilderUnlockers: (builder) => { this._syncBuilderUnlockers(builder); },
      applyDerivedValueChunks: (builder) => { this._applyDerivedValueChunks(builder); },
      materializeValueChunkBand: (builder) => { this._materializeValueChunkBand(builder); },
      ensureLiveValueChunkBand: (builder) => { this._ensureLiveValueChunkBand(builder); },
      placeTailReturnAfterSwappedTokenBlock: (builder) => {
        this._placeTailReturnAfterSwappedTokenBlock(builder);
      },
      ensureAuthenticatedViewReturns: (builder) => {
        this._ensureAuthenticatedViewReturns(builder);
      },
      isPersistedChunkableValueWriteReady: () => this._isPersistedChunkableValueWriteReady(),
      reassertPersistedValueChunkOneToOnes: (builder, emitDest) => {
        this._reassertPersistedValueChunkOneToOnes(builder, emitDest);
      },
      scaledEmitOutputIndex: (outputCount) => this._scaledEmitOutputIndex(outputCount),
      reassertDelegateImplEvents: (builder) => { this._reassertDelegateImplEvents(builder); },
      reassertNestedEmitEvents: (builder) => { this._reassertNestedEmitEvents(builder); },
      reassertScaledPreserveOneToOnes: (builder) => {
        this._reassertScaledPreserveOneToOnes(builder);
      },
      reassertFixedStateOutputs: (builder) => { this._reassertFixedStateOutputs(builder); },
      restoreDeclaredMutableEntrySlots: (builder) => {
        this._restoreDeclaredMutableEntrySlots(builder);
      },
      clearSupersededDelegateDynamicCollectionOutputs: (builder) => {
        this._clearSupersededDelegateDynamicCollectionOutputs(builder);
      },
      compilerOwnedTrailingEntryOutputIndices: () => this._compilerOwnedTrailingEntryOutputIndices(),
      ensureDistinctJobEventNfts: (builder) => { this._ensureDistinctJobEventNfts(builder); },
    };
  }

  private _reassertSendFinalLayoutHost(
    reassertFinalConservation: () => void,
  ): Omit<ReassertSendFinalLayoutHost, 'rebalanceFunderSurplus'> {
    return {
      reconcileMaterializedValueChunkWitnesses: (b) => {
        this._reconcileMaterializedValueChunkWitnesses(b);
      },
      reconcileMaterializedInputWitnesses: (b) => {
        this._reconcileMaterializedInputWitnesses(b);
      },
      reconcileMaterializedPredOutWitnesses: (b) => {
        this._reconcileMaterializedPredOutWitnesses(b);
      },
      reassertMaterializedBatchPredecessorOutputs: (b) => {
        this._reassertMaterializedBatchPredecessorOutputs(b);
      },
      reassertFinalConservation: () => { reassertFinalConservation(); },
      reconcileMaterializedReturnWitnesses: (b) => {
        this._reconcileMaterializedReturnWitnesses(b);
      },
      constrainParticipantImmutableOutputs: (b) => {
        this._constrainParticipantImmutableOutputs(b);
      },
      applyDerivedValueChunks: (b) => { this._applyDerivedValueChunks(b); },
      reassertStagedValueChunkOutputs: (b) => { this._reassertStagedValueChunkOutputs(b); },
      stripEmptyDuplicateEntryLocks: (b) => { this._stripEmptyDuplicateEntryLocks(b); },
      reassertTokenInsertNewLocks: (b) => { this._reassertTokenInsertNewLocks(b); },
      stripSurplusLinearBatchEntryClones: (b) => {
        this._stripSurplusLinearBatchEntryClones(b);
      },
      ensureDistinctJobEventNfts: (b) => { this._ensureDistinctJobEventNfts(b); },
      applyDerivedEntryOutputs: (b) => { this._applyDerivedEntryOutputs(b); },
      finalizeReverseSuffixValueChunkLayout: (b) => { this._finalizeReverseSuffixValueChunkLayout(b); },
      enforceDeclaredCollectionOutputCardinality: (b) => {
        this._enforceDeclaredCollectionOutputCardinality(b);
      },
      learnFinalizedDelegateEvents: (b) => this._learnFinalizedDelegateEvents(b),
      relocateCollidingDerivedValueChunkRuns: (b) => {
        this._relocateCollidingDerivedValueChunkRuns(b);
      },
      bindMaterializedValueChunkWitnesses: (b) => {
        this.bindMaterializedValueChunkWitnesses(b);
      },
      syncBuilderUnlockers: (b) => { this._syncBuilderUnlockers(b); },
    };
  }

  private _convergedFinalTransactionHost(): ConvergedFinalTransactionHost {
    return {
      masterUtxo: this.masterUtxo,
      categoryId: this.categoryId,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      allInputs: this.allInputs,
      externalCallEntryInserts: this.externalCallEntryInserts,
      resultDependentArgumentRefresher: this.resultDependentArgumentRefresher,
      findMintingInputIndex: (categoryId) => this.findMintingInputIndex(categoryId),
      repairComputedChunkOutput: (builder, inputIndex) => this._repairComputedChunkOutput(builder, inputIndex),
      compilerOwnedTrailingEntryOutputIndices: () => this._compilerOwnedTrailingEntryOutputIndices(),
      restoreDeclaredMutableEntrySlots: (builder) => {
        this._restoreDeclaredMutableEntrySlots(builder);
      },
      clearSupersededDelegateDynamicCollectionOutputs: (builder) => {
        this._clearSupersededDelegateDynamicCollectionOutputs(builder);
      },
      clearUnclaimedConditionalEventSlots: (builder) => {
        this._clearUnclaimedConditionalEventSlots(builder);
      },
      syncRefreshedCarrierMasters: (builder, carriers) => {
        this._syncRefreshedCarrierMasters(builder, carriers);
      },
      logCovenantFailureTrace: (builder, message) => {
        this._logCovenantFailureTrace(builder, message);
      },
    };
  }

  private _derivedValueChunkApplyHost(): DerivedValueChunkApplyHost {
    return {
      derivedChunkOutputs: this.derivedChunkOutputs,
      allInputs: this.allInputs,
      categoryId: this.categoryId,
      delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      messageBusConvention: this.messageBusConvention,
      mintingOutputSwap: this.mintingOutputSwap,
      getChunkableValueWriteBand: () => this.getChunkableValueWriteBand(),
      findMintingInputIndex: (categoryId) => this.findMintingInputIndex(categoryId),
      getExternalCallMasterInputIndex: (groupIndex) => this.getExternalCallMasterInputIndex(groupIndex),
      getLowLevelCallMasterInputIndex: (llcIndex) => this.getLowLevelCallMasterInputIndex(llcIndex),
      isFixedParticipantDataNftOutput: (outputIndex, categoryId) => (
        this._isFixedParticipantDataNftOutput(outputIndex, categoryId)
      ),
      syncRefreshedCarrierMasters: (builder, carriers) => {
        this._syncRefreshedCarrierMasters(builder, carriers);
      },
    };
  }

  private _reverseSuffixValueChunkHost(): ReverseSuffixValueChunkHost {
    return {
      valueChunkOutputs: this.valueChunkOutputs,
      allInputs: this.allInputs,
      categoryId: this.categoryId,
      delegateDynamicChunksAtSuffix: this.delegateDynamicChunksAtSuffix,
      dynamicChunkVars: this.dynamicChunkVars,
      chunkRawCommitments: this.chunkRawCommitments,
      derivedChunkOutputs: this.derivedChunkOutputs,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      blockLayout: this.blockLayout,
      getChunkableValueWriteBand: () => this.getChunkableValueWriteBand(),
      setChunkRawCommitments: (name, commitments) => {
        this.setChunkRawCommitments(name, commitments);
      },
      dynamicChunkOutputCount: () => this._dynamicChunkOutputCount(),
      padOutputsToIndex: (builder, index) => {
        this._padOutputsToIndex(builder, index);
      },
    };
  }

  private _covenantFailureTraceHost(): CovenantFailureTraceHost {
    return {
      masterUtxo: this.masterUtxo,
      categoryId: this.categoryId,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      externalIdentityAnchorUtxos: this.externalIdentityAnchorUtxos,
      builderOptions: this.builderOptions,
    };
  }

  private _repairComputedChunkOutputHost(): RepairComputedChunkOutputHost {
    return {
      authenticatedEventOutputs: this.authenticatedEventOutputs,
      authenticatedOutputLockingBytecodes: this.authenticatedOutputLockingBytecodes,
      allInputs: this.allInputs,
      builderOptions: this.builderOptions,
      categoryId: this.categoryId,
      dataNftUtxos: this.dataNftUtxos,
      dynamicChunkVars: this.dynamicChunkVars,
      explicitStateOverrideNftIndices: this.explicitStateOverrideNftIndices,
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      externalOutStateUtxoGroups: this.externalOutStateUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      pendingReturnEventOutputs: this.pendingReturnEventOutputs,
      readOnlyDataNftUtxos: this.readOnlyDataNftUtxos,
      findMintingInputIndex: (categoryId) => this.findMintingInputIndex(categoryId),
      getExternalCallMasterInputIndex: (groupIndex) => this.getExternalCallMasterInputIndex(groupIndex),
      getLowLevelCallMasterInputIndex: (llcIndex) => this.getLowLevelCallMasterInputIndex(llcIndex),
      rootStateNftIndexAt: (outputIndex, categoryId) => this._rootStateNftIndexAt(outputIndex, categoryId),
      setRootStateRawCommitmentAt: (outputIndex, categoryId, commitmentHex) => (
        this._setRootStateRawCommitmentAt(outputIndex, categoryId, commitmentHex)
      ),
      setExternalCallStateRawCommitmentAt: (outputIndex, categoryId, commitmentHex) => (
        this._setExternalCallStateRawCommitmentAt(outputIndex, categoryId, commitmentHex)
      ),
      setDerivedChunkOutput: (outputIndex, chunk) => this.setDerivedChunkOutput(outputIndex, chunk),
      setExternalCallEntryOutputAt: (outputIndex, categoryId, commitmentHex) => (
        this.setExternalCallEntryOutputAt(outputIndex, categoryId, commitmentHex)
      ),
      setReturnEventOutput: (categoryId, commitment, identity, provisional) => (
        this.setReturnEventOutput(categoryId, commitment, identity, provisional)
      ),
      syncRefreshedCarrierMasters: (builder, carriers) => {
        this._syncRefreshedCarrierMasters(builder, carriers);
      },
    };
  }

  private _buildInputsHost(): BuildInputsHost {
    const self = this;
    return {
      get masterUtxo() { return self.masterUtxo; },
      get categoryId() { return self.categoryId; },
      get blockLayout() { return self.blockLayout; },
      get builderOptions() { return self.builderOptions; },
      get funderUtxos() { return self.funderUtxos; },
      get insertBandPadUtxos() { return self.insertBandPadUtxos; },
      get dataNftUtxos() { return self.dataNftUtxos; },
      get readOnlyDataNftUtxos() { return self.readOnlyDataNftUtxos; },
      get blockhashCoSpendUtxos() { return self.blockhashCoSpendUtxos; },
      get blockInfoCoSpendUtxos() { return self.blockInfoCoSpendUtxos; },
      get blockhashCoSpendSlotOrdinals() { return self.blockhashCoSpendSlotOrdinals; },
      get keccakComputeCoSpendUtxos() { return self.keccakComputeCoSpendUtxos; },
      get keccakLoopSideCars() { return self.keccakLoopSideCars; },
      get keccakLoopPrecedesTrailingUser() {
        return (self.masterUtxo?.unlocker as { abiFunction?: { keccakLoopPrecedesTrailingUser?: boolean } })
          ?.abiFunction?.keccakLoopPrecedesTrailingUser === true;
      },
      get ecrecoverComputeCoSpendUtxos() { return self.ecrecoverComputeCoSpendUtxos; },
      get lowLevelCallRawInputs() { return self.lowLevelCallRawInputs; },
      get iterationEntryInputs() { return self.iterationEntryInputs; },
      get insertLoopPredecessorInputs() { return self.insertLoopPredecessorInputs; },
      get dynamicChunkInputs() { return self.dynamicChunkInputs; },
      get trailingDisposalInputs() { return self.trailingDisposalInputs; },
      get externalCallUtxoGroups() { return self.externalCallUtxoGroups; },
      get lowLevelCallUtxoGroups() { return self.lowLevelCallUtxoGroups; },
      get entryNfts() { return self.entryNfts; },
      get childDeploymentInputs() { return self.childDeploymentInputs; },
      get loopEntryCommitments() { return self.loopEntryCommitments; },
      get activeDelegateGroupIndex() { return self.activeDelegateGroupIndex; },
      set activeDelegateGroupIndex(value) { self.activeDelegateGroupIndex = value; },
      get delegateEntriesAfterLowLevel() { return self.delegateEntriesAfterLowLevel; },
      get delegatedValueChunkPad() { return self.delegatedValueChunkPad; },
      get lowLevelCallInputBase() { return self.lowLevelCallInputBase; },
      get compilerRouteDelegateBlock() { return self.compilerRouteDelegateBlock; },
      get preserveBlockLayoutWidth() { return self.preserveBlockLayoutWidth; },
      get externalIdentityAnchorUtxos() { return self.externalIdentityAnchorUtxos; },
      get logicalIdentityUtxo() { return self.logicalIdentityUtxo; },
      get loopEntriesBeforeDynamicChunks() { return self.loopEntriesBeforeDynamicChunks; },
      trailingLoopEntryOutputCount: () => this._trailingLoopEntryOutputCount(),
      dynamicChunkOutputCount: () => this._dynamicChunkOutputCount(),
      delegateLoopEntryVars: () => this._delegateLoopEntryVars(),
    };
  }

  private _chunkableWritePlanningHost(): ChunkableWritePlanningHost {
    return this._scaledPreserveEmitHost();
  }

  private _chunkableValueWriteExecution(): ChunkableValueWriteExecution | undefined {
    return chunkableValueWriteExecution(this._chunkableWritePlanningHost());
  }

  private _hasChunkableValueWriteMetadata(): boolean {
    return hasChunkableValueWriteMetadata(this._chunkableWritePlanningHost());
  }

  private _permitsLegacyNamedValueChunkFallback(): boolean {
    return permitsLegacyNamedValueChunkFallbackForGroups(this._chunkableWritePlanningHost());
  }

  /** Physical/logical group views of the one compiler-described chunkable-value writer. */
  private _chunkableValueWriteGroups(): ChunkableValueWriteGroups {
    return chunkableValueWriteGroups(this._chunkableWritePlanningHost());
  }

  private _chunkableValueWriteAbi(): AbiFunction | undefined {
    return chunkableValueWriteAbi(this._chunkableWritePlanningHost());
  }

  /** The input that actually evaluates publishJobEvent (`OP_INPUTINDEX`). */
  getPublishJobEventInputIndex(): number {
    return this._chunkableValueWriteInputIndex();
  }

  /** The physical executor for the active compiler-described chunkable-value write. */
  getChunkableValueWriteInputIndex(): number {
    return this._chunkableValueWriteInputIndex();
  }

  isInitialChunkableValueWrite(): boolean {
    return this._isInitialChunkableValueWrite();
  }

  private _persistDigestCategories(): string[] {
    return persistDigestCategories(this._chunkableWritePlanningHost());
  }

  hasMintingBandTokenWriter(): boolean {
    return hasMintingBandTokenWriterForHost(this._scaledPreserveEmitHost());
  }

  tokenWriterOccupancy(
    tokenMaster: number,
    outputs?: ReadonlyArray<{ token?: { nft?: { commitment?: string } } }>,
  ): Set<number> {
    return tokenWriterOccupancyForHost(this._scaledPreserveEmitHost(), tokenMaster, outputs);
  }

  /** The input that actually evaluates publishJobEvent (`OP_INPUTINDEX`). */
  private _chunkableValueWriteInputIndex(): number {
    return chunkableValueWriteInputIndex(this._scaledPreserveEmitHost());
  }

  /** publishJobEvent emit is implementation-relative (`INPUTINDEX + event.offset`). */
  private _scaledEmitOutputIndex(outputCount: number): number | undefined {
    return scaledEmitOutputIndex(this._scaledPreserveEmitHost(), outputCount);
  }

  /** Event dests that scaled 1:1 must not restore as tokenless P2PKH pads. */
  private _emitDestinationIndices(): number[] {
    return emitDestinationIndices(this._scaledPreserveEmitHost());
  }

  /** The value-chunk band uses the executing implementation window, not a nested participant's. */
  private _entryScaledPreserveRange(): { start: number; endExclusive: number } | undefined {
    return entryScaledPreserveRange(this._scaledPreserveEmitHost());
  }

  /** Impl blocks, jobEvents band (and the INPUTINDEX+4 trailing write), writer returns. */
  private _scidReservedIndices(outputCount = this.allInputs.length): Set<number> {
    return scidReservedIndices(this._scaledPreserveEmitHost(), outputCount);
  }

  viewTailPackOptions(suffixStart?: number): ViewTailPackOptions {
    return {
      reservedIndices: sameIndexScidIdentityInputIndices(this.allInputs),
      band: this.getChunkableValueWriteBand(),
      // Input and output counts are independent once return witnesses, computed
      // outputs, and suffix sidecars are materialized. Only enforce a suffix
      // boundary when the caller derived it from an actual output layout.
      suffixStart,
      tokenWriterPresent: this.externalCallUtxoGroups.some((group) =>
        isCompilerDescribedMintingBandWriter(group, true, this.messageBusConvention)),
    };
  }

  /**
   * Live publishJobEvent value-chunk band (`impl + blockSize` for `nNew` slots).
   * Occupancy, view tails, and FakeToken rotation all share this range.
   */
  private _getChunkableValueWriteBandHost(): GetChunkableValueWriteBandHost {
    return {
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      messageBusConvention: this.messageBusConvention,
      derivedChunkOutputs: this.derivedChunkOutputs,
      allInputs: this.allInputs,
      composedParticipant: this.composedParticipant,
      forcedChunkableValueWriteBandStart: this.forcedChunkableValueWriteBandStart,
      mintingOutputSwap: this.mintingOutputSwap,
      chunkableValueWriteExecution: () => this._chunkableValueWriteExecution(),
      chunkableValueWriteGroups: () => this._chunkableValueWriteGroups(),
      getLowLevelCallMasterInputIndex: (index) => this.getLowLevelCallMasterInputIndex(index),
      findMintingInputIndex: (categoryId) => this.findMintingInputIndex(categoryId),
      getLoopEntryCommitments: (collection) => this.getLoopEntryCommitments(collection),
      chunkableValueWriteCategory: () => this._chunkableValueWriteCategory(),
      persistedChunkableValueWriteState: () => this._persistedChunkableValueWriteState(),
      isPersistedChunkableValueWriteReady: () => this._isPersistedChunkableValueWriteReady(),
      isInitialChunkableValueWrite: () => this._isInitialChunkableValueWrite(),
      chunkableValueWriteInputIndex: () => this._chunkableValueWriteInputIndex(),
      entryScaledPreserveRange: () => this._entryScaledPreserveRange(),
    };
  }

  getChunkableValueWriteBand(): { start: number; end: number; nNew: number } | undefined {
    return getChunkableValueWriteBandImpl(this._getChunkableValueWriteBandHost());
  }

  /** @deprecated Compatibility name for callers predating compiler-described chunkable writes. */
  getPublishJobEventsBand(): { start: number; end: number; nNew: number } | undefined {
    return this.getChunkableValueWriteBand();
  }

  /** Grow the selected chunkable writer's continuation width. */
  bumpChunkableValueWriteWidth(nNew: number): boolean {
    if (nNew <= 0) return false;
    let changed = false;
    const structural = this._chunkableValueWriteExecution();
    const selected = structural === undefined ? undefined : this._chunkableValueWriteGroups();
    const structuralGroups = selected === undefined ? [] : [
      ...selected.externalIndices.map((index) => this.externalCallUtxoGroups[index]),
      ...(selected.lowLevel ? [selected.lowLevel] : []),
    ];
    const groups = structuralGroups.length > 0
      ? structuralGroups
      : this._hasChunkableValueWriteMetadata()
        ? []
        : !this._permitsLegacyNamedValueChunkFallback()
          ? []
          : [
            ...this.externalCallUtxoGroups.filter((group) =>
              legacyGroupLooksLikePublishJobEvent(group)),
            ...this.lowLevelCallUtxoGroups.filter((group) =>
              legacyGroupLooksLikePublishJobEvent(group)),
          ];
    for (const group of groups) {
      const next = Math.max(group.valueChunkOutputCount ?? 0, nNew);
      if (next !== group.valueChunkOutputCount) {
        group.valueChunkOutputCount = next;
        changed = true;
      }
    }
    if (changed) this.dynamicLayoutRevision += 1;
    return changed;
  }

  /** @deprecated Compatibility name for callers predating compiler-described chunkable writes. */
  bumpPublishJobEventsWidth(nNew: number): boolean {
    return this.bumpChunkableValueWriteWidth(nNew);
  }

  /** @internal Snapshot to detect when a VM probe discovers wider transaction geometry. */
  getDynamicLayoutRevision(): number {
    return this.dynamicLayoutRevision;
  }

  /** Move a participant block off a compiler-owned dynamic-output band without changing existing order. */
  private _swapMintingOffValueChunkBand(): void {
    swapMintingOffValueChunkBand(this._mintingSwapPredecessorHost());
  }

  private _chunkableValueWriteCategory(): string | undefined {
    return chunkableValueWriteCategory(this._chunkableWritePlanningHost());
  }

  private _valueChunkWriteCategorySelection(): ValueChunkWriteCategorySelection {
    return valueChunkWriteCategorySelection(this._chunkableWritePlanningHost());
  }

  /** Persist chunks are proxy-category; the LLC master is the impl minting category. */
  private _persistedValueChunkCategory(): string | undefined {
    return persistedValueChunkCategory(this._chunkableWritePlanningHost());
  }

  /** @internal Selected writer's append owner; never inferred from unrelated cached predecessors. */
  getSelectedPersistedValueChunkCategory(): string | undefined {
    return selectedPersistedValueChunkCategory(this._chunkableWritePlanningHost());
  }

  /** An extra-transfer swap can park funders on the value-chunk band; put predecessor chunks back. */
  private _placeValueChunkPredecessorInputs(extras: UnlockableUtxo[] = []): void {
    placeValueChunkPredecessorInputs(this._mintingSwapPredecessorHost(), extras);
  }

  /**
   * After extraTransfer, persist predecessors are often missing from `allInputs`.
   * Fetch the last successful value-chunk spends and pin them on the live band.
   */
  private _ensurePersistedValueChunkInputsHost(): EnsurePersistedValueChunkInputsHost {
    return {
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      messageBusConvention: this.messageBusConvention,
      builderOptions: this.builderOptions,
      allInputs: this.allInputs,
      setPendingValueChunkPredecessors: (extras) => {
        this.pendingValueChunkPredecessors = extras;
      },
      getChunkableValueWriteBand: () => this.getChunkableValueWriteBand(),
      persistedValueChunkCategory: () => this._persistedValueChunkCategory(),
      chunkableValueWriteCategory: () => this._chunkableValueWriteCategory(),
      isInitialChunkableValueWrite: () => this._isInitialChunkableValueWrite(),
      isPersistedChunkableValueWriteReady: () => this._isPersistedChunkableValueWriteReady(),
      persistedValueChunkWrite: (categoryId) => this._persistedValueChunkWrite(categoryId),
      hasChunkableValueWriteMetadata: () => this._hasChunkableValueWriteMetadata(),
      permitsLegacyNamedValueChunkFallback: () => this._permitsLegacyNamedValueChunkFallback(),
      chunkableValueWriteGroups: () => this._chunkableValueWriteGroups(),
      findMintingInputIndex: (categoryId) => this.findMintingInputIndex(categoryId),
      placeValueChunkPredecessorInputs: (extras) => {
        this._placeValueChunkPredecessorInputs(extras);
      },
    };
  }

  async ensurePersistedValueChunkInputs(): Promise<void> {
    return ensurePersistedValueChunkInputsImpl(this._ensurePersistedValueChunkInputsHost());
  }

  /** @deprecated Historical name for descriptor-free continuation restoration. */
  async ensurePersistedJobEventsInputs(): Promise<void> {
    return this.ensurePersistedValueChunkInputs();
  }

  /**
   * After the 4-wide swap, conditional entry slots whose blockInputs were funders
   * emit as P2PKH. FakeToken.transferFrom then reads master+4 (output 30) as a
   * pred-out/entry and fails GTE on an empty token category. Re-fill those holes
   * with same-category mutable placeholders so derivation can reveal the commitment.
   */
  private _fillSwappedTokenEntryHoles(builder: TransactionBuilder): void {
    fillSwappedTokenEntryHoles(this._mintingSwapPredecessorHost(), builder);
  }

  /**
   * Construct an external entry slot's covenant from compiler metadata. Balanced composition can place an
   * unrelated participant or funder in an output-only entry position; its unlocker is therefore not a safe
   * source for the output locking bytecode. The collection signature and owning category define the lock.
   */
  private _externalEntryLockingBytecode(
    group: ExternalCallUtxoGroup,
    slot: FunctionBlockLayout['slots'][number],
  ): Uint8Array | undefined {
    return externalEntryLockingBytecode(group, slot);
  }

  /** Resolve the participant whose compiler layout owns a fixed external-call output coordinate. */
  private _declaredExternalOutputSlotOwner(outputIndex: number): {
    categoryId: string;
    groupIndex: number;
    group: ExternalCallUtxoGroup;
    slot: FunctionBlockLayout['slots'][number];
  } | undefined {
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined) continue;
      const layout = group.blockLayout ?? group.compilerRoute?.abiFunction?.blockLayout;
      if (!layout) continue;
      const base = this.getExternalCallOutputBase(groupIndex);
      const slot = layout.slots.find((candidate) => base + candidate.offset === outputIndex);
      if (slot) return { categoryId: group.categoryId, groupIndex, group, slot };
    }
    return undefined;
  }

  /** Keep participant event/return NFTs inside the coordinates admitted by their compiler layout. */
  private _constrainParticipantImmutableOutputs(builder: TransactionBuilder): void {
    const allowedByCategory = new Map<string, Set<number>>();
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined || !group.categoryId) continue;
      const layout = group.blockLayout ?? group.compilerRoute?.abiFunction?.blockLayout;
      if (!layout) continue;
      let master = this.findMintingInputIndex(group.categoryId);
      if (master < 0) master = this.getExternalCallMasterInputIndex(groupIndex);
      if (master < 0) continue;
      const allowed = allowedByCategory.get(group.categoryId) ?? new Set<number>();
      for (const slot of layout.slots) {
        if (slot.kind === 'event' || slot.kind === 'eventChunk' || slot.kind === 'returnEvent') {
          allowed.add(master + slot.offset);
        }
      }
      for (const offset of group.streamedEventPlan?.outputs.keys() ?? []) allowed.add(master + offset);
      allowedByCategory.set(group.categoryId, allowed);
    }
    for (const claim of lowLevelCallImmutableEventDestinations(
      this.lowLevelCallUtxoGroups,
      this.externalCallUtxoGroups,
      (groupIndex) => this.getLowLevelCallMasterInputIndex(groupIndex),
    )) {
      const allowed = allowedByCategory.get(claim.categoryId) ?? new Set<number>();
      allowed.add(claim.destination);
      allowedByCategory.set(claim.categoryId, allowed);
    }
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (!group.categoryId || !groupOwnsInBlockReturnEvent(this.externalCallUtxoGroups, groupIndex)) continue;
      const placed = group.plannedReturnOutputIndex ?? group.returnOutputIndex;
      if (placed === undefined) continue;
      const allowed = allowedByCategory.get(group.categoryId) ?? new Set<number>();
      allowed.add(placed);
      allowedByCategory.set(group.categoryId, allowed);
    }
    for (const [categoryId, allowed] of allowedByCategory) {
      constrainOwnCategoryImmutableOutputs(builder.outputs, categoryId, allowed);
    }
  }

  /**
   * A relocated token writer can leave exact mutable block copies in the funder cells immediately after its
   * fixed block. Those cells are not sorted-batch predecessor outputs: their corresponding inputs are plain
   * funders, and retaining the copies makes the writer's address-cardinality covenant count the same entry
   * twice. Restore only plain-input cells whose token shape exactly duplicates an output in the fixed block.
   */
  private _restoreSwappedTokenFunderSlots(builder: TransactionBuilder): void {
    restoreSwappedTokenFunderSlots(this._tokenWriterEventRepairHost(), builder);
  }

  /**
   * transferFrom probes often fail on entry pins before event commitments appear on-stack.
   * Synthesize Approval/Transfer from the known call args + post-debit allowance output.
   */
  private _synthesizeTransferFromEventCommitments(
    builder: TransactionBuilder,
    group: ExternalCallUtxoGroup,
    master: number,
  ): NonNullable<ExternalCallUtxoGroup['eventOutputs']> | undefined {
    return synthesizeTransferFromEventCommitments(
      this._tokenWriterEventRepairHost(), builder, group, master,
    );
  }

  /** Re-materialize conditional writer events learned from the covenant trace after block reconstruction. */
  private _applyLearnedWriterEventsHost(): ApplyLearnedWriterEventsHost {
    return {
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      provider: this.builderOptions.provider,
      detachedEventReceipts: this.detachedEventReceipts,
      registerDetachedEvent: (eventDef, lockingBytecode) => {
        this.registerDetachedEvent(eventDef, lockingBytecode);
      },
      findMintingInputIndex: (categoryId) => this.findMintingInputIndex(categoryId),
      getExternalCallMasterInputIndex: (groupIndex) => this.getExternalCallMasterInputIndex(groupIndex),
    };
  }

  private _learnFinalizedDelegateEvents(builder: TransactionBuilder): boolean {
    return learnFinalizedDelegateEvents(this._applyLearnedWriterEventsHost(), builder);
  }

  private _applyLearnedWriterEvents(builder: TransactionBuilder): void {
    applyLearnedWriterEvents(this._applyLearnedWriterEventsHost(), builder);
  }

  /** Reapply exact event observations after provisional carrier caches. */
  private _reassertAuthenticatedEventOutputs(builder: TransactionBuilder): void {
    for (const [outputIndex, authenticated] of this.authenticatedEventOutputs) {
      // Physical minting lineage is input-owned and must be resolved by layout,
      // not silently replaced by an output-only event claim.
      if (builder.outputs[outputIndex]?.token?.nft?.capability === 'minting') continue;
      builder.outputs[outputIndex] = {
        ...authenticated,
        to: authenticated.to instanceof Uint8Array ? authenticated.to.slice() : authenticated.to,
        token: cloneToken(authenticated.token),
      };
    }
  }

  /** Unclaimed conditional event slots must be neutral in both token and locking-bytecode namespaces. */
  private _clearUnclaimedConditionalEventSlots(builder: TransactionBuilder): void {
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined) continue;
      let master = this.findMintingInputIndex(group.categoryId);
      if (master < 0) master = this.getExternalCallMasterInputIndex(groupIndex);
      if (master < 0 || !group.blockLayout) continue;
      let eventOrdinal = 0;
      for (const slot of group.blockLayout.slots) {
        if (slot.kind !== 'event') continue;
        const learned = group.eventOutputs?.[eventOrdinal];
        eventOrdinal += 1;
        if (slot.conditional !== true) continue;
        const learnedCommit = String(learned?.commitment ?? '');
        // `SCID` marks an empty message-bus identity carrier; it is not evidence that a conditional event was
        // emitted. Generic route-event discovery can echo that provisional marker into `eventOutputs`, so treat
        // it as unresolved and restore the compiler-owned coordinate to a neutral output.
        const learnedIsDummy = learnedCommit === '' || /^(00)+$/.test(learnedCommit)
          || learnedCommit.toLowerCase() === '53434944';
        if (learned && !learnedIsDummy) continue;
        const existing = builder.outputs[master + slot.offset];
        if (!existing) continue;
        demoteUnclaimedConditionalEventOutput(existing, group.categoryId);
      }
    }
  }

  /**
   * Empty-commitment own-category P2SH32 immutables are message-bus auth carriers.
   * The event pin's empty-commitment skip `DUP`s the zero-amount bool (output 0/1)
   * instead of `j`, so a true empty carrier is still treated as a serialized event.
   * Prefix `SCID` so the disjoint-identity check excludes them. Do not touch OP_TRUE
   * return witnesses (`51`) or any nonempty commitment.
   */
  /**
   * Cross-call return witnesses are OP_TRUE + none-cap. A later unmatched-mutable
   * clone can overwrite that slot as mutable, and the callee's OUTPUTTOKENCATEGORY
   * SPLIT-32 leftover check then refuses the 0x01 capability byte.
   */
  private _ensureOpTrueReturnWitnessesAreImmutable(builder: TransactionBuilder): void {
    const returnKeys = new Set(
      this.pendingReturnEventOutputs.map((event) =>
        `${event.categoryId}:${binToHex(event.commitment)}`),
    );
    const returnCategories = new Set(
      this.pendingReturnEventOutputs.map((event) => event.categoryId),
    );
    for (const output of builder.outputs) {
      if (output.token?.nft?.capability !== 'mutable') continue;
      const lock = output.to instanceof Uint8Array
        ? output.to
        : output.to !== undefined ? addressToLockScript(output.to) : undefined;
      if (!lock || lock.length !== 1 || lock[0] !== 0x51) continue;
      const category = output.token.category;
      const commitment = String(output.token.nft.commitment ?? '');
      const isReturn = returnKeys.has(`${category}:${commitment}`)
        || (returnCategories.has(category)
          && category !== this.mintingOutputSwap?.categoryId
          && (commitment === '51' || commitment === '00' || commitment.startsWith('09')));
      if (!isReturn) continue;
      output.token = {
        ...output.token,
        amount: 0n,
        nft: { capability: 'none', commitment },
      };
    }
  }

  private _tagEmptyP2sh32ImmutablesAsScid(builder: TransactionBuilder): void {
    const eventDests = new Set(this._emitDestinationIndices());
    for (const [index, output] of builder.outputs.entries()) {
      if (eventDests.has(index)) continue;
      if (output.token?.nft?.capability !== 'none') continue;
      const raw = output.token.nft.commitment;
      const empty = raw === undefined || raw === null || String(raw) === '';
      if (!empty) continue;
      const lock = output.to instanceof Uint8Array
        ? output.to
        : addressToLockScript(output.to);
      if (lock.length < 2 || lock[0] !== 0xaa || lock[1] !== 0x20) continue;
      output.token = {
        ...output.token,
        nft: { capability: 'none', commitment: '53434944' },
      };
    }
  }

  /**
   * After the 4-wide minting swap, FakeToken's 8-slot occupies 26-33. Tail return
   * witnesses are packed at master+blockSize (34). A same-index funder pad there
   * makes updateJobPost's first OUTPUTTOKENCOMMITMENT/SPLIT-1 see an empty item.
   * Swap that hole with the next non-token none-cap event so TXOUTPUTCOUNT stays put.
   */
  /**
   * Routed proxy groups emit an OP_TRUE spacer at their sequential slot. The
   * minting UTXO must still be recreated at INPUTINDEX. Insert it there and drop
   * one later P2PKH/OP_TRUE pad so view tails and the value-chunk suffix do not move.
   */
  private _reassertNestedMintingMasters(builder: TransactionBuilder): void {
    reassertNestedMintingMasters(this._nestedOutputReassertHost(), builder);
  }

  /** Drop leftover empty-value entry placeholders that share a live collection lock. */
  /** Drop leftover empty-value entry placeholders that share a live collection lock. */
  private _stripSurplusEmptyCollectionEntries(builder: TransactionBuilder): void {
    stripSurplusEmptyCollectionEntriesForHost(this._nestedOutputReassertHost(), builder);
  }

  /** Reassert each planned sorted-entry INSERT at the compiler-advertised predecessor and NEW coordinates. */
  /** Reassert each planned sorted-entry INSERT at the compiler-advertised predecessor and NEW coordinates. */
  private _reassertNestedSameIndexMutables(builder: TransactionBuilder): void {
    reassertNestedSameIndexMutables(this._nestedOutputReassertHost(), builder);
  }

  /**
   * Recreate every participant's fixed data-NFT state at the coordinate authenticated by its input outpoint.
   * Later entry/event/tail materializers can temporarily occupy those coordinates, but fixed state retains
   * structural ownership. Derive commitments from the owner's layout and updates; commitment bytes are opaque
   * state, so neither ownership nor preservation may depend on application-specific prefixes.
   */
  private _reassertFixedStateOutputs(builder: TransactionBuilder): void {
    reassertFixedStateOutputs(this._nestedOutputReassertHost(), builder);
  }

  /**
   * Reassert the chunkable writer's compiler-owned event coordinate after occupancy repairs.
   * Older artifacts without write metadata retain their historical event reconstruction below.
   */
  private _reassertNestedEmitEvents(builder: TransactionBuilder): void {
    reassertNestedEmitEvents(this._nestedEmitEventsHost(), builder);
  }

  private _ensureDistinctJobEventNfts(_builder: TransactionBuilder): void {
    ensureDistinctJobEventNfts(this._delegateImplEventReassertHost(), _builder);
  }

  /**
   * Implementation emit verification is `OP_INPUTINDEX + event.offset`. Move a
   * parked VersionChanged / Paused NFT from the proxy event band onto that dest.
   */
  private _reassertDelegateImplEvents(builder: TransactionBuilder): void {
    reassertDelegateImplEvents(this._delegateImplEventReassertHost(), builder);
  }

  /** Persist UPDATE predecessors are mutable value-chunks, not data-NFT twins. */
  private _reassertPersistedValueChunkOneToOnes(builder: TransactionBuilder, emitDest: number): void {
    reassertPersistedValueChunkOneToOnes(this._persistedValueChunkOneToOneHost(), builder, emitDest);
  }

  /** Read `__internal__returnOutputIdx` from one unlocker, or undefined when absent. */
  private _returnOutputIdxFromUnlocker(unlocker: {
    abiFunction?: { inputs?: ReadonlyArray<{ name: string }> };
    params?: readonly unknown[];
  } | undefined): number | undefined {
    return returnOutputIdxFromUnlocker(unlocker);
  }

  /**
   * When returnOutputIdx < 0, the compiler compacts trailing outputs by one into the
   * reserved returnEvent coordinate (GenerateTargetTraversal.emitTrailingWriteOutputBase).
   * Prefer the unlocker that owns `layout`, not a sibling's return index.
   */
  private _unmaterializedReturnEventCompact(
    layout?: { trailingBase?: number; slots?: ReadonlyArray<{ kind: string }> },
    ownerUnlocker?: {
      abiFunction?: { inputs?: ReadonlyArray<{ name: string }> };
      params?: readonly unknown[];
    },
  ): number {
    return unmaterializedReturnEventCompact(this._delegateLoopEntriesHost(), layout, ownerUnlocker);
  }

  /** Restore planned delegate loop commitments at their compiler-owned coordinates without shifting later rows. */
  private _reassertDelegateLoopEntries(builder: TransactionBuilder): void {
    reassertDelegateLoopEntries(this._delegateLoopEntriesHost(), builder);
  }

  /**
   * View tails are OP_TRUE + none-cap return NFTs. Token-swap placement already
   * parks them after FakeToken; without a swap, jobEvents mutables still occupy
   * the first planned tail slots. Write the pending views after that writer band
   * and leave collection/value-chunk coordinates unmoved.
   */
  private _writeViewTailsAfterWriterOccupancy(
    builder: TransactionBuilder,
    returnOutputRefs?: Map<string, Output>,
  ): void {
    writeViewTailsAfterWriterOccupancy(this._viewTailOccupancyHost(), builder, returnOutputRefs);
  }

  /**
   * index (3-wide band → output 31). Restore the witnessed return without
   * shifting later view tails: swap with a disposable pad after occupancy.
   */
  private _reassertInBlockWriterReturns(builder: TransactionBuilder): void {
    reassertInBlockWriterReturns(this._inBlockWriterReturnHost(), builder);
  }

  /**
   * Keep the unlocking witnesses and the materialized return output on one coordinate.
   * Input assembly can relocate a token block after the caller first encoded its
   * return index; refresh every exact carrier of that logical writer without moving
   * unrelated view returns which merely share the same physical token group.
   */
  private _bindWriterReturnWitness(
    writerGroupIndex: number,
    outputIndex: number,
    builder: TransactionBuilder,
  ): void {
    bindWriterReturnWitness(this._inBlockWriterReturnHost(), writerGroupIndex, outputIndex, builder);
  }

  /** Compiler-declared entries preserve input/output coordinates one-to-one. */
  private _declaredMutableEntrySlots(): Array<{ outputIndex: number; inputIndex: number }> {
    return declaredMutableEntrySlots(this._declaredMutableEntryHost());
  }

  private _declaredMutableEntrySlotIndices(): number[] {
    return declaredMutableEntrySlotIndices(this._declaredMutableEntryHost());
  }

  /** Output-only collection coordinates which duplicate cleanup must not reclaim while they are provisional. */
  private _compilerOwnedTrailingEntryOutputIndices(): Set<number> {
    const indices = new Set<number>();
    // A local sorted-map insert owns its trailing predecessor/NEW lane even while
    // its provisional commitment matches the fixed entry output. Duplicate
    // cleanup must not replace that lane with OP_TRUE before VM derivation has
    // authenticated the final commitment.
    for (const variable of this._trailingLoopEntryVars()) {
      const count = (this.loopEntryCommitments.get(variable.collection) ?? []).length;
      for (let ordinal = 0; ordinal < count; ordinal += 1) {
        indices.add(this.getLoopEntryOutputIndex(variable.collection, ordinal));
      }
    }
    const add = (base: number, group: ExternalCallUtxoGroup): void => {
      if (base < 0) return;
      for (const planned of group.plannedEntryInserts ?? []) {
        if (planned.outputBlockSlot >= 0) indices.add(base + planned.outputBlockSlot);
      }
      for (const predecessor of group.batchPredecessorOutputs ?? []) {
        if (predecessor.outputBlockSlot >= 0) indices.add(base + predecessor.outputBlockSlot);
      }
    };
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined || group.delegateCallGroupIndex !== undefined) continue;
      add(this.getExternalCallOutputBase(groupIndex), group);
    }
    return indices;
  }

  /** Restore compiler-declared entry ownership after output-only materializers. */
  private _restoreDeclaredMutableEntrySlots(builder: TransactionBuilder): void {
    restoreDeclaredMutableEntrySlots(this._declaredMutableEntryHost(), builder);
  }

  /** Remove superseded collection chunks when a delegate owns the complete replacement suffix. */
  private _clearSupersededDelegateDynamicCollectionOutputs(builder: TransactionBuilder): void {
    if (!this.delegateDynamicChunksAtSuffix) return;
    const replacementCount = this._dynamicChunkOutputCount();
    if (replacementCount === 0) return;
    const suffixStart = builder.outputs.length - replacementCount - 1;
    if (suffixStart < 0) return;
    const authoritative = new Set<number>();
    for (let offset = 0; offset < replacementCount; offset++) authoritative.add(suffixStart + offset);
    const cleared = clearMutableCollectionOutputsOutsideAuthoritativeRun(
      builder.outputs, authoritative,
    );
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_CHUNK_GEOM === '1') {
      const authoritativeLocks = new Set([...authoritative].flatMap((index) => {
        const lock = builder.outputs[index]?.to;
        return lock instanceof Uint8Array ? [binToHex(lock)] : [];
      }));
      console.error('delegate-dynamic-dedup', {
        replacementCount,
        suffixStart,
        outputCount: builder.outputs.length,
        cleared,
        candidates: builder.outputs.flatMap((output, index) => {
          const lock = output?.to;
          if (!(lock instanceof Uint8Array)
            || !authoritativeLocks.has(binToHex(lock))
            || output.token?.nft?.capability !== 'mutable') return [];
          const commitment = commitmentHexOf(output.token.nft.commitment);
          return [{
            index,
            authoritative: authoritative.has(index),
            category: output.token.category,
            commitment: commitment.slice(0, 32),
            commitmentBytes: commitment.length / 2,
          }];
        }),
      });
    }
  }

  private _vacateViewTailsFromJobEventsBand(builder: TransactionBuilder): void {
    vacateViewTailsFromJobEventsBand(this._viewTailOccupancyHost(), builder);
  }

  private _placeTailReturnAfterSwappedTokenBlock(
    builder: TransactionBuilder,
    returnOutputRefs?: Map<string, Output>,
  ): void {
    placeTailReturnAfterSwappedTokenBlock(this._placeTailReturnHost(), builder, returnOutputRefs);
  }

  private _ensureAuthenticatedViewReturns(builder: TransactionBuilder): boolean {
    return ensureAuthenticatedViewReturns(this._authenticatedViewReturnHost(), builder);
  }

  /**
   * @internal Re-run input assembly after a co-spent group's unlocker was replaced post-construction. The
   * identity-anchor witness can only be filled once the built input positions exist, so the delegate master that
   * carries it is re-created after this builder assembled its inputs.
   */
  _refreshInputs(): void {
    this.setFunderUtxos(this.funderUtxos);
    this._refreshMasterUnlocker();
  }

  private _refreshMasterUnlocker(builder?: TransactionBuilder): void {
    refreshMasterUnlocker(this._refreshedUnlockerSyncHost(), builder);
  }

  /** Replace one deferred keccak batch member and rebuild its ordinary compute side-car in place. */
  private rebuildDeferredKeccakPreimage(callIndex: number, preimage: Uint8Array): boolean {
    const deferred = this.deferredKeccakCompute;
    if (!deferred || callIndex < 0 || callIndex >= deferred.preimages.length) return false;
    const previous = deferred.preimages[callIndex];
    if (previous !== null && binToHex(previous) === binToHex(preimage)) return false;
    deferred.preimages[callIndex] = Uint8Array.from(preimage);

    const batchIndex = deferred.legacy ? callIndex : Math.floor(callIndex / 3);
    const batchStart = deferred.legacy ? batchIndex : batchIndex * 3;
    const batchWidth = deferred.legacy ? 1 : Math.min(3, deferred.preimages.length - batchStart);
    const batchPreimages = deferred.preimages.slice(batchStart, batchStart + batchWidth)
      .map((member) => member ?? new Uint8Array());
    const sidecar = this.keccakComputeCoSpendUtxos[batchIndex];
    if (!sidecar) return false;
    const rebuilt = buildKeccakComputeSidecar(
      deferred.legacy ? batchPreimages[0] : batchPreimages,
      deferred.salt,
      sidecar,
      true,
      deferred.legacy,
    );
    this.keccakComputeCoSpendUtxos[batchIndex] = { ...sidecar, unlocker: rebuilt.unlocker };
    this.keccakComputeCommitments[batchIndex] = binToHex(rebuilt.commitment);
    this._refreshInputs();
    return true;
  }

  /**
   * Bind compiler-published compute recipes after their graph operands have been observed. The indices are
   * logical builtin-call ordinals, not physical side-car offsets (three keccak calls may share one NFT).
   * A missing recipe member remains unresolved and cannot pass the ordinary composition gate.
   */
  applyDeferredComputeRecipes(
    keccakPreimages: readonly (Uint8Array | null)[],
    ecrecoverArguments: readonly (Uint8Array | null)[],
  ): boolean {
    const keccak = this.deferredKeccakCompute?.preimages ?? [];
    const recovery = this.deferredEcrecoverCompute?.argBlobs ?? [];
    if (keccakPreimages.length !== keccak.length || ecrecoverArguments.length !== recovery.length) {
      throw new Error('messageBus: compute recipe cardinality disagrees with selected side-car calls');
    }
    let changed = false;
    keccakPreimages.forEach((preimage, callIndex) => {
      if (preimage !== null) {
        changed = this.rebuildDeferredKeccakPreimage(callIndex, preimage) || changed;
      }
    });
    ecrecoverArguments.forEach((argument, callIndex) => {
      if (argument !== null) {
        changed = applyDeferredEcrecoverArgument(
          this._resolveDeferredEcrecoverArgumentHost(), callIndex, argument,
        ) || changed;
      }
    });
    return changed;
  }

  /**
   * Learn one complex keccak preimage from the complete routed execution trace. Direct calls resolve these with
   * a small isolated probe, but a delegate implementation can depend on authenticated proxy state and nested
   * return channels which exist only in the final transaction. The compiler's call-ordinal marker identifies the
   * logical call even when nested hashes execute inner-to-outer.
   */
  resolveDeferredKeccakPreimage(trace: unknown[], inputBase = 0): boolean {
    const deferred = this.deferredKeccakCompute;
    if (!deferred || !deferred.preimages.some((preimage) => preimage === null)) return false;
    const debug = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_KECCAK_DERIVE === '1';
    const firstSidecar = this.keccakComputeCoSpendUtxos[0];
    if (!firstSidecar) return false;
    const localBase = this.allInputs.findIndex((input) => (
      input.txid.toLowerCase() === firstSidecar.txid.toLowerCase() && input.vout === firstSidecar.vout
    ));
    if (localBase < 0) return false;
    const base = inputBase + localBase;

    let learned: { callIndex: number; preimage: Uint8Array };
    try {
      learned = extractKeccakPreimageFromTrace(
        trace, base, deferred.preimages.length, this.keccakComputeCoSpendUtxos.length,
      );
    } catch (error) {
      if (debug) console.error('deferred-keccak-extract-miss', {
        base,
        calls: deferred.preimages.length,
        sidecars: this.keccakComputeCoSpendUtxos.length,
        error: error instanceof Error ? error.message : String(error),
        reads: trace.flatMap((raw) => {
          const step = raw as {
            ip?: number; stack?: Uint8Array[]; instructions?: Array<{ opcode?: number }>;
            controlStack?: unknown[];
          };
          if (step.controlStack?.some((condition) => condition === false)
            || step.instructions?.[step.ip ?? -1]?.opcode !== 0xca
            || !step.stack || step.stack.length < 2) return [];
          const top = step.stack.length - 1;
          return [{
            ip: step.ip,
            index: Number(decodeVmScriptNumber(step.stack[top])),
            marker: step.stack.length >= 3 ? Number(decodeVmScriptNumber(step.stack[top - 1])) : undefined,
            argumentBytes: step.stack.length >= 3 ? step.stack[top - 2].length : step.stack[top - 1].length,
            argument: binToHex(step.stack[step.stack.length >= 3 ? top - 2 : top - 1]).slice(0, 80),
          }];
        }),
      });
      return false;
    }
    if (!this.rebuildDeferredKeccakPreimage(learned.callIndex, learned.preimage)) return false;
    const batchIndex = deferred.legacy ? learned.callIndex : Math.floor(learned.callIndex / 3);
    if (debug) console.error('deferred-keccak-learned', {
      base,
      callIndex: learned.callIndex,
      batchIndex,
      preimageBytes: learned.preimage.length,
      preimage: binToHex(learned.preimage),
      resolved: deferred.preimages.map((preimage) => preimage === null ? null : binToHex(preimage)),
      commitment: this.keccakComputeCommitments[batchIndex],
    });
    return true;
  }

  /**
   * How much deferred-compute work is still unlearned, for diagnostics: a stall record that only says "no
   * progress" cannot distinguish "nothing was ever learned" from "almost everything was learned and one member
   * stayed unresolved", and those have different causes.
   */
  getDeferredComputeRemainingForDiagnostics(): {
    keccakUnresolved: number; keccakTotal: number;
    ecrecoverUnresolved: number; ecrecoverTotal: number;
  } {
    const keccak = this.deferredKeccakCompute?.preimages ?? [];
    const ecrecover = this.deferredEcrecoverCompute?.argBlobs ?? [];
    return {
      keccakUnresolved: keccak.filter((preimage) => preimage === null).length,
      keccakTotal: keccak.length,
      ecrecoverUnresolved: ecrecover.filter((blob) => blob === null).length,
      ecrecoverTotal: ecrecover.length,
    };
  }

  hasUnresolvedDeferredKeccakPreimages(): boolean {
    return this.deferredKeccakCompute?.preimages.some((preimage) => preimage === null) === true;
  }

  /**
   * Learn one computed ecrecover (hash,v,r,s) blob from the complete execution trace. A transitive helper exposes
   * the 97-byte blob immediately below its recovery-A input index at OP_INPUTBYTECODE; matching the actual A UTXO
   * position avoids confusing ordinary calldata or keccak reads. Rebuilding one pair advances nested execution
   * deterministically, so the derivation loop repeats until every placeholder is gone.
   */
  private _resolveDeferredEcrecoverArgumentHost(): ResolveDeferredEcrecoverArgumentHost {
    return {
      deferredEcrecoverCompute: this.deferredEcrecoverCompute,
      allInputs: this.allInputs,
      ecrecoverComputeCoSpendUtxos: this.ecrecoverComputeCoSpendUtxos,
      ecrecoverComputeRecreates: this.ecrecoverComputeRecreates,
      rebuildDeferredKeccakPreimage: (callIndex, preimage) => (
        this.rebuildDeferredKeccakPreimage(callIndex, preimage)
      ),
      refreshInputs: () => {
        this._refreshInputs();
      },
    };
  }

  resolveDeferredEcrecoverArgument(trace: unknown[], inputBase = 0): boolean {
    return resolveDeferredEcrecoverArgumentImpl(
      this._resolveDeferredEcrecoverArgumentHost(),
      trace,
      inputBase,
    );
  }

  hasUnresolvedDeferredEcrecoverArguments(): boolean {
    return this.deferredEcrecoverCompute?.argBlobs.some((argBlob) => argBlob === null) === true;
  }

  private _setFunderUtxosHost(): SetFunderUtxosHost {
    const self = this;
    return {
      get funderUtxos() { return self.funderUtxos; },
      set funderUtxos(value) { self.funderUtxos = value; },
      get allInputs() { return self.allInputs; },
      set allInputs(value) { self.allInputs = value; },
      get entryNfts() { return self.entryNfts; },
      get tokenContainers() { return self.tokenContainers; },
      get satoshiContainerUtxo() { return self.satoshiContainerUtxo; },
      get externalOutStateUtxoGroups() { return self.externalOutStateUtxoGroups; },
      get externalCallUtxoGroups() { return self.externalCallUtxoGroups; },
      get lowLevelCallUtxoGroups() { return self.lowLevelCallUtxoGroups; },
      get blockLayout() { return self.blockLayout; },
      get preserveBlockLayoutWidth() { return self.preserveBlockLayoutWidth; },
      get compilerRouteDelegateBlock() { return self.compilerRouteDelegateBlock; },
      get externalIdentityAnchorUtxos() { return self.externalIdentityAnchorUtxos; },
      get logicalIdentityUtxo() { return self.logicalIdentityUtxo; },
      get pendingValueChunkPredecessors() { return self.pendingValueChunkPredecessors; },
      buildInputs: (
        entryInputs, tokenContainerInputs, satoshiContainerInputs,
        externalOutStateInputs, externalCallInputs, lowLevelCallInputs,
      ) => self._buildInputs(
        entryInputs, tokenContainerInputs, satoshiContainerInputs,
        externalOutStateInputs, externalCallInputs, lowLevelCallInputs,
      ),
      swapMintingOffValueChunkBand: () => {
        self._swapMintingOffValueChunkBand();
      },
      placeValueChunkPredecessorInputs: (extras) => {
        self._placeValueChunkPredecessorInputs([...extras]);
      },
    };
  }

  setFunderUtxos(funders: UnlockableUtxo[]): void {
    setFunderUtxosImpl(this._setFunderUtxosHost(), funders);
  }

  /** Keep async-planned disposable inputs out of layout until a dynamic band actually needs them. */
  setRelocationFunderUtxos(funders: UnlockableUtxo[]): void {
    this.relocationFunderUtxos = [...funders];
  }

  /** Neutral pads the legacy delegate insert band can take; see `insertBandPadDemand`. */
  setInsertBandPadUtxos(pads: UnlockableUtxo[]): void {
    this.insertBandPadUtxos = [...pads];
  }

  /** How many neutral pads the legacy delegate insert band may take from `setInsertBandPadUtxos`. */
  insertBandPadDemand(): number {
    return insertBandPadDemand(this._buildInputsHost());
  }

  /**
   * Guess scalar NFT output state before the first VM probe.
   *
   * Unique-typed ABI arguments are assigned onto unique-typed state fields; leftover integer fields are
   * incremented by 1. The guess is only a candidate: a faithful probe still has to accept the transaction,
   * and a mismatch falls back to the existing extract-and-reprobe loop.
   */
  getOptimisticPermutationCount(): number {
    return this.lastOptimisticPermutationCount;
  }

  clearOptimisticScalarWrites(): void {
    this.stateUpdates.clear();
  }

  private _seedOptimisticScalarWritesHost(): SeedOptimisticScalarWritesHost {
    const self = this;
    return {
      get lastOptimisticPermutationCount(): number {
        return self.lastOptimisticPermutationCount;
      },
      set lastOptimisticPermutationCount(value: number) {
        self.lastOptimisticPermutationCount = value;
      },
      get stateUpdates() {
        return self.stateUpdates;
      },
      get stateRawCommitments() {
        return self.stateRawCommitments;
      },
      get masterUtxo() {
        return self.masterUtxo;
      },
      get stateLayout() {
        return self.stateLayout;
      },
      get requiredNftIndices() {
        return self.requiredNftIndices;
      },
      get dataNftUtxos() {
        return self.dataNftUtxos;
      },
      get messageBusConvention() {
        return self.messageBusConvention;
      },
      setState: (fieldName, value) => {
        self.setState(fieldName, value);
      },
    };
  }

  seedOptimisticScalarWrites(permutationIndex: number = 0): boolean {
    return seedOptimisticScalarWritesImpl(this._seedOptimisticScalarWritesHost(), permutationIndex);
  }

  /**
   * Seed an unsorted (legacy) fixed-size array's element writes whose ABI valueSource is a compile-time integer.
   * Sorted (vmap) writes, mappings and DS-5 arrays alike, use native slot||next||value commitments and must not
   * go through setEntry.
   */
  seedOptimisticArrayElementWrites(): boolean {
    if (this.entryUpdates.size > 0) return false;
    if (!isContractUnlocker(this.masterUtxo.unlocker)) return false;
    const { abiFunction } = this.masterUtxo.unlocker;
    const accesses = abiFunction.entryAccesses ?? [];
    if (accesses.length === 0) return false;
    let seeded = false;
    for (let slotIndex = 0; slotIndex < accesses.length; slotIndex += 1) {
      const access = accesses[slotIndex];
      if (!access.operations.includes('write') || access.operations.includes('delete')) continue;
      const collection = this.stateLayout.collections?.find((candidate) => candidate.name === access.collection);
      if (collection === undefined || collection.kind !== 'array' || collection.sorted) continue;
      const valueType = collection.valueType ?? collection.elementType ?? 'int';
      const entryDelta = access.valueSource?.match(/^binop:([+-])\(entry,lit:(-?[0-9]+)\)$/);
      let value: bigint | undefined;
      if (entryDelta) {
        let current = 0n;
        const nft = this.entryNfts.find((entry) => entry.slotIndex === slotIndex);
        const commitment = nft?.exists ? nft.utxo?.token?.nft?.commitment : undefined;
        if (commitment) {
          try {
            const parsed = parseEntryCommitment(commitment, collection.keyType ?? 'bigint', valueType);
            if (typeof parsed.value === 'bigint') current = parsed.value;
          } catch {
            current = 0n;
          }
        }
        const delta = BigInt(entryDelta[2]);
        value = entryDelta[1] === '-' ? current - delta : current + delta;
      } else if (!access.operations.includes('read')) {
        value = evalSimpleIntegerSource(access.valueSource);
      }
      if (value === undefined || !canEncodeScalarStateValue(value, valueType)) continue;
      this.setEntry(slotIndex, value);
      seeded = true;
    }
    return seeded;
  }

  /**
   * Set a state variable to a new value.
   */
  /** A write already placed on this builder, including an optimistic first-probe seed. */
  stateUpdate(name: string): StateValue | undefined {
    return this.stateUpdates.get(name);
  }

  setState(
    name: string,
    value: StateValue,
    explicitOverride = false,
  ): this {
    const variable = stateVariableForUpdateKey(this.stateLayout, name);
    if (!variable) {
      throw new Error(`Unknown state variable: ${name}`);
    }
    if (explicitOverride) this.explicitStateOverrideNftIndices.add(variable.nftIndex);
    this.stateRawCommitments.delete(variable.nftIndex);
    this.stateUpdates.set(name, value);
    return this;
  }

  setStateRawCommitment(nftIndex: number, commitment: string): this {
    this.stateRawCommitments.set(nftIndex, commitment);
    return this;
  }

  /**
   * Set a state variable on an external call's output.
   */
  setExternalCallState(
    categoryId: string,
    name: string,
    value: StateValue,
  ): this {
    let updates = this.externalCallStateUpdates.get(categoryId);
    if (!updates) {
      updates = new Map();
      this.externalCallStateUpdates.set(categoryId, updates);
    }
    updates.set(name, value);
    // A caller changing an override after derivation invalidates the exact
    // commitment previously authenticated for that participant.
    const group = this.externalCallUtxoGroups.find((candidate) => candidate.categoryId === categoryId);
    const nftIndex = group && stateVariableForUpdateKey(group.stateLayout, name)?.nftIndex;
    if (nftIndex !== undefined) this.externalCallStateRawCommitments.get(categoryId)?.delete(nftIndex);
    return this;
  }

  /** B's vmap sorted-entry output at its block-slot position (commitment from B's VM trace). docs/deferrals.md #1. */
  setExternalCallEntryOutput(categoryId: string, blockSlot: number, commitmentHex: string): boolean {
    let m = this.externalCallEntryOutputs.get(categoryId);
    if (!m) { m = new Map(); this.externalCallEntryOutputs.set(categoryId, m); }
    if (m.get(blockSlot) === commitmentHex) return false;
    m.set(blockSlot, commitmentHex);
    return true;
  }

  private _participantDataNftOwner(
    outputIndex: number,
    categoryId: string,
  ): { kind: 'external' | 'lowLevel'; groupIndex: number; nftIndex: number } | undefined {
    const externalGroups = this.externalCallUtxoGroups.flatMap((group, groupIndex) => (
      group.sharedGroupIndex === undefined ? [{ group, groupIndex }] : []
    ));
    const external = fixedDataNftOwnerInParticipantBlocks(outputIndex, categoryId, externalGroups.map(
      ({ group, groupIndex }) => ({
        categoryId: group.categoryId,
        blockBase: this.getExternalCallOutputBase(groupIndex),
        blockLayout: group.blockLayout,
        dataNftCount: group.dataNftUtxos.length,
        requiredDataNftIndices: group.requiredDataNftIndices,
      }),
    ));
    if (external) return {
      kind: 'external',
      groupIndex: externalGroups[external.participantIndex].groupIndex,
      nftIndex: external.nftIndex,
    };
    const lowLevel = fixedDataNftOwnerInParticipantBlocks(outputIndex, categoryId,
      this.lowLevelCallUtxoGroups.map((group, groupIndex) => ({
        categoryId: group.categoryId,
        blockBase: this.getLowLevelCallMasterInputIndex(groupIndex),
        blockLayout: group.blockLayout,
        dataNftCount: group.dataNftUtxos.length,
        requiredDataNftIndices: group.requiredDataNftIndices,
      })));
    if (lowLevel) return {
      kind: 'lowLevel', groupIndex: lowLevel.participantIndex, nftIndex: lowLevel.nftIndex,
    };
    return undefined;
  }

  private _isFixedParticipantDataNftOutput(outputIndex: number, categoryId: string): boolean {
    return this._participantDataNftOwner(outputIndex, categoryId) !== undefined;
  }

  private _rootStateNftIndexAt(outputIndex: number, categoryId: string): number | undefined {
    if (categoryId !== this.categoryId) return undefined;
    // build() emits the root master followed by required data NFTs in this order, independent of any later
    // balanced participant blocks.
    return this.requiredNftIndices[outputIndex - 1];
  }

  private _setRootStateRawCommitmentAt(
    outputIndex: number,
    categoryId: string,
    commitmentHex: string,
  ): boolean {
    const nftIndex = this._rootStateNftIndexAt(outputIndex, categoryId);
    if (nftIndex === undefined) return false;
    this.stateRawCommitments.set(nftIndex, commitmentHex);
    return true;
  }

  private _setExternalCallStateRawCommitmentAt(
    outputIndex: number,
    categoryId: string,
    commitmentHex: string,
  ): boolean {
    const owner = this._participantDataNftOwner(outputIndex, categoryId);
    if (!owner || owner.kind !== 'external') return false;
    const group = this.externalCallUtxoGroups[owner.groupIndex];
    if (group && stateUpdatesTouchNft(
      group.stateLayout,
      this.externalCallStateUpdates.get(categoryId),
      owner.nftIndex,
    )) {
      this.externalCallStateRawCommitments.get(categoryId)?.delete(owner.nftIndex);
      return false;
    }
    let byNft = this.externalCallStateRawCommitments.get(categoryId);
    if (!byNft) {
      byNft = new Map();
      this.externalCallStateRawCommitments.set(categoryId, byNft);
    }
    if (byNft.get(owner.nftIndex) !== commitmentHex) byNft.set(owner.nftIndex, commitmentHex);
    return true;
  }

  clearExternalCallEntryOutputAt(outputIndex: number): boolean {
    return this.externalCallEntryOutputsByIndex.delete(outputIndex);
  }

  setExternalCallEntryOutputAt(outputIndex: number, categoryId: string, commitmentHex: string): boolean {
    if (commitmentHex.length < 128 || /^0+$/.test(commitmentHex)) return false;
    if (this._rootStateNftIndexAt(outputIndex, categoryId) !== undefined) return false;
    if (this._isFixedParticipantDataNftOutput(outputIndex, categoryId)) return false;
    // Refuse absolute pins before a known minting master (post two: FakeToken balances @12).
    const mintingMaster = this.findMintingInputIndex(categoryId);
    if (mintingMaster >= 0 && outputIndex < mintingMaster) return false;
    let declaredSlot = false;
    let entryOwned = false;
    let lockingBytecodeHex: string | undefined;
    const considerGroup = (
      group: ExternalCallUtxoGroup,
      blockBase: number,
    ): void => {
      if (group.categoryId !== categoryId || !group.blockLayout) return;
      const relative = outputIndex - blockBase;
      const slot = group.blockLayout.slots[relative]
        ?? group.blockLayout.slots.find((candidate) => candidate.offset === relative);
      if (!slot) return;
      declaredSlot = true;
      if (slot.kind === 'entry') {
        entryOwned = true;
        const lock = externalEntryLockingBytecode(group, slot);
        if (lock) lockingBytecodeHex = binToHex(lock);
      }
    };
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined) continue;
      considerGroup(group, this.getExternalCallOutputBase(groupIndex));
    }
    // Nested delegated participants live in lowLevelCallUtxoGroups too. Without this check, a stale absolute pin
    // can be accepted and later replayed over a fixed state slot.
    for (const [groupIndex, group] of this.lowLevelCallUtxoGroups.entries()) {
      const blockBase = this.getLowLevelCallMasterInputIndex(groupIndex);
      if (blockBase < 0) continue;
      considerGroup(group, blockBase);
    }
    // Commitment traces cover data NFTs, events, and entries. Only a declared entry slot may enter this cache;
    // otherwise a later rebuild can replay an entry-shaped value over fixed participant state. Coordinates after
    // every fixed block remain valid: dynamic loop entries and INSERT nodes are intentionally trailing outputs.
    if (declaredSlot && !entryOwned) return false;
    const previous = this.externalCallEntryOutputsByIndex.get(outputIndex);
    if (previous?.commitment === commitmentHex && previous.categoryId === categoryId
      && previous.lockingBytecodeHex === lockingBytecodeHex) return false;
    // A later empty extract must not wipe a real entry node. Allow a shorter P'
    // (zero slot, non-zero next) to replace a stale NEW that was pinned too early.
    if (previous && previous.commitment.length >= 128 && !/^0+$/.test(previous.commitment)
      && commitmentHex.length < previous.commitment.length) {
      const slotHex = commitmentHex.slice(0, 64);
      const nextHex = commitmentHex.slice(64, 128);
      const isPredPin = /^0+$/.test(slotHex) && nextHex.length === 64 && !/^0+$/.test(nextHex);
      if (!isPredPin) return false;
    }
    this.externalCallEntryOutputsByIndex.set(outputIndex, {
      categoryId, commitment: commitmentHex, lockingBytecodeHex,
    });
    return true;
  }

  private _applyDerivedEntryOutputs(builder: TransactionBuilder): void {
    for (const [outputIndex, placed] of [...this.externalCallEntryOutputsByIndex.entries()]) {
      const existing = builder.outputs[outputIndex];
      if (!existing?.token?.nft || existing.token.nft.capability !== 'mutable') continue;
      // Absolute entry observations are owned by one exact state category. Geometry can move between probes;
      // never replay an old participant's entry-shaped commitment over another participant's mutable output.
      if (existing.token.category !== undefined
        && existing.token.category.toLowerCase() !== placed.categoryId.toLowerCase()) {
        this.externalCallEntryOutputsByIndex.delete(outputIndex);
        continue;
      }
      // Output geometry can change after a trace was cached. Re-check ownership
      // at replay time so an old dynamic coordinate cannot overwrite fixed state.
      if (this._isFixedParticipantDataNftOutput(
        outputIndex, existing.token.category ?? placed.categoryId,
      )) {
        this.externalCallEntryOutputsByIndex.delete(outputIndex);
        continue;
      }
      if (placed.lockingBytecodeHex && !cachedEntryOutputOwnsLock(
        placed.lockingBytecodeHex, existing.to instanceof Uint8Array
          ? existing.to : addressToLockScript(existing.to),
      )) {
        this.externalCallEntryOutputsByIndex.delete(outputIndex);
        continue;
      }
      builder.outputs[outputIndex] = {
        to: existing.to,
        amount: existing.amount,
        token: {
          amount: existing.token.amount ?? 0n,
          category: existing.token.category ?? placed.categoryId,
          nft: { capability: 'mutable', commitment: placed.commitment },
        },
      };
    }
  }

  getExternalCallEntryOutput(categoryId: string, blockSlot: number): string | undefined {
    return this.externalCallEntryOutputs.get(categoryId)?.get(blockSlot);
  }

  /**
   * Rebind write-path entry NFT unlockers of `categoryId` to `masterInputIndex`.
   * Entry inputs may live outside their owner's fixed participant block, so a
   * blockInputs-only pass cannot update every co-spend after final relocation.
   */
  rebindCategoryEntryUnlockers(
    categoryId: string,
    rebind: (current: UnlockableUtxo) => Unlocker | undefined,
  ): void {
    rebindCategoryEntryUnlockersForHost(this._materializedNftUnlockerReconcileHost(), categoryId, rebind);
  }

  /** A trailing NEW entry node for a cross-contract callee INSERT (minted after B's block). Returns its handle. */
  addExternalCallEntryInsert(categoryId: string, to: Uint8Array, commitmentHex: string): number {
    return this.externalCallEntryInserts.push({ categoryId, to, commitment: commitmentHex, active: true }) - 1;
  }

  /** Give one physical sorted-entry insertion a stable handle across derivation passes. */
  ensureExternalCallEntryInsert(
    ownerGroupIndex: number,
    categoryId: string,
    to: Uint8Array,
    targetSlot: string,
    commitmentHex: string,
  ): number {
    const owner = this.externalCallUtxoGroups[ownerGroupIndex];
    if (!Number.isSafeInteger(ownerGroupIndex) || ownerGroupIndex < 0
      || owner?.sharedGroupIndex !== undefined || owner?.categoryId !== categoryId) {
      throw new Error('External entry insert has an invalid physical owner');
    }
    if (!/^[0-9a-f]{64}$/i.test(targetSlot)) {
      throw new Error('External entry insert requires an exact target slot');
    }
    const canonicalSlot = targetSlot.toLowerCase();
    const existingHandle = this.externalCallEntryInserts.findIndex((insert) => (
      insert.ownerGroupIndex === ownerGroupIndex
      && insert.categoryId === categoryId
      && insert.targetSlot === canonicalSlot
      && binsAreEqual(insert.to, to)
    ));
    if (existingHandle >= 0) {
      const insert = this.externalCallEntryInserts[existingHandle];
      if (!insert.active) {
        insert.commitment = commitmentHex;
        insert.active = true;
      }
      return existingHandle;
    }
    return this.externalCallEntryInserts.push({
      ownerGroupIndex, categoryId, to: to.slice(), targetSlot: canonicalSlot,
      commitment: commitmentHex, active: true,
    }) - 1;
  }

  /** Replace a trailing NEW node's commitment (the placeholder set for the 2nd-pass probe). */
  setExternalCallEntryInsertCommitment(handle: number, commitmentHex: string): this {
    if (this.externalCallEntryInserts[handle]) this.externalCallEntryInserts[handle].commitment = commitmentHex;
    return this;
  }

  /** Drop a trailing NEW node placeholder (the write turned out to be an UPDATE, not an INSERT). */
  removeExternalCallEntryInsert(handle: number): this {
    if (this.externalCallEntryInserts[handle]) {
      this.externalCallEntryInserts[handle].commitment = '';
      this.externalCallEntryInserts[handle].active = false;
    }
    return this;
  }

  /**
   * Set an entry NFT value by slot index.
   */
  setEntry(
    slotIndex: number,
    value: StateValue,
  ): this {
    this.entryUpdates.set(slotIndex, value);
    return this;
  }

  /**
   * Mark an entry NFT for deletion by slot index.
   */
  deleteEntry(slotIndex: number): this {
    this.entryDeletes.add(slotIndex);
    return this;
  }

  // Whether this entry slot is only conditionally active (a delete/write inside an if/else branch). Such a slot's
  // presence in the output depends on the taken branch, so it must not be unconditionally deleted from the layout.
  isEntrySlotConditional(slotIndex: number): boolean {
    return this.blockLayout?.slots.some(
      (s) => s.kind === 'entry' && s.slotIndex === slotIndex && s.conditional,
    ) ?? false;
  }

  /** Exact pre-state commitment for an occupied entry slot, if this call co-spends one. */
  getExistingEntryCommitment(slotIndex: number): string | undefined {
    const entry = this.entryNfts.find((candidate) => candidate.slotIndex === slotIndex);
    return entry?.exists ? entry.utxo?.token?.nft?.commitment : undefined;
  }

  /**
   * Add a transfer output (plain BCH, no tokens).
   */
  addTransfer(lockingBytecode: Uint8Array, amount: bigint): this {
    if (amount <= 0n) {
      throw new Error('Transfer amount must be positive');
    }
    this.pendingTransfers.push({ lockingBytecode, amount });
    return this;
  }

  /** @internal Materialize one compiler-reserved transfer ordinal without collapsing inactive row slots. */
  setTransfer(outputSlot: number, lockingBytecode: Uint8Array, amount: bigint): this {
    if (!Number.isSafeInteger(outputSlot) || outputSlot < 0) {
      throw new Error('Transfer output slot must be a non-negative safe integer');
    }
    if (amount <= 0n || amount > 0xffff_ffff_ffff_ffffn) {
      throw new Error('Transfer amount must be positive and fit uint64');
    }
    while (this.pendingTransfers.length <= outputSlot) {
      this.pendingTransfers.push({ lockingBytecode: new Uint8Array(), amount: 0n });
    }
    if (this.pendingTransfers[outputSlot].lockingBytecode.length > 0) {
      throw new Error(`Transfer output slot ${outputSlot} is already materialized`);
    }
    this.pendingTransfers[outputSlot] = { lockingBytecode, amount };
    return this;
  }

  /** @internal Add a compiler-derived balanced transfer slot. A Solidity `call{value: 0}` still authenticates
   * its fixed output coordinate, so VM derivation may legitimately recover zero even though the public transfer
   * API rejects non-positive user payments. */
  _addDerivedTransfer(lockingBytecode: Uint8Array, amount: bigint): this {
    if (amount < 0n) throw new Error('Derived transfer amount must not be negative');
    this.pendingTransfers.push({ lockingBytecode, amount });
    return this;
  }

  /**
   * Add a token container transfer output (fungible tokens from a token container).
   */
  addTokenContainerTransfer(
    tokenContainerCategoryId: string, lockingBytecode: Uint8Array, amount: bigint, outputSlot?: number,
  ): this {
    if (amount <= 0n) {
      throw new Error('Token container transfer amount must be positive');
    }
    const insertionOrder = outputSlot ?? this.tokenContainerTransferInsertionCounter;
    this.pendingTokenContainerTransfers.push({
      tokenContainerCategoryId, lockingBytecode, amount,
      insertionOrder,
    });
    this.tokenContainerTransferInsertionCounter = Math.max(
      this.tokenContainerTransferInsertionCounter, insertionOrder + 1,
    );
    return this;
  }

  clearTokenContainerDeposits(): this {
    this.pendingTokenContainerDeposits.clear();
    for (const output of this.createdTokenContainerOutputs.values()) {
      this.pendingOutputs.splice(this.pendingOutputs.indexOf(output), 1);
    }
    this.createdTokenContainerOutputs.clear();
    return this;
  }

  addTokenContainerDeposit(tokenContainerCategoryId: string, amount: bigint): this {
    if (amount <= 0n) throw new Error('Token container deposit amount must be positive');
    const prior = this.pendingTokenContainerDeposits.get(tokenContainerCategoryId) ?? 0n;
    this.pendingTokenContainerDeposits.set(tokenContainerCategoryId, prior + amount);
    // A first deposit creates the container after the block. Its slot keeps a tokenless placeholder, since a funder
    // holds the slot's input; the covenant reads the container's amount wherever it sits.
    const container = this.tokenContainers.find((info) => info.tokenContainerCategoryId === tokenContainerCategoryId);
    const lockingBytecode = this.tokenContainerLockingBytecodes.get(tokenContainerCategoryId);
    if (container !== undefined && !container.exists && lockingBytecode !== undefined) {
      const created = {
        to: lockingBytecode,
        amount: 1200n,
        token: { category: tokenContainerCategoryId, amount: prior + amount },
      };
      const previous = this.createdTokenContainerOutputs.get(tokenContainerCategoryId);
      if (previous === undefined) this.pendingOutputs.push(created);
      else this.pendingOutputs.splice(this.pendingOutputs.indexOf(previous), 1, created);
      this.createdTokenContainerOutputs.set(tokenContainerCategoryId, created);
    }
    return this;
  }

  /**
   * Add a token container transferNft output (NFT with explicit commitment and capability).
   */
  addTokenContainerTransferNft(
    tokenContainerCategoryId: string,
    lockingBytecode: Uint8Array,
    commitment: Uint8Array,
    capability: 'none' | 'mutable' | 'minting',
    outputSlot?: number,
  ): this {
    const insertionOrder = outputSlot ?? this.tokenContainerTransferInsertionCounter;
    this.pendingTokenContainerTransferNfts.push({
      tokenContainerCategoryId, lockingBytecode, commitment, capability,
      insertionOrder,
    });
    this.tokenContainerTransferInsertionCounter = Math.max(
      this.tokenContainerTransferInsertionCounter, insertionOrder + 1,
    );
    return this;
  }

  /**
   * Set the deposit amount to add to the satoshi container balance.
   * Used by payable functions that receive sats into the container (positive msg.value).
   */
  setContainerDepositAmount(amount: bigint): this {
    this.containerDepositAmount = amount;
    return this;
  }

  /**
   * Get the current deposit amount.
   */
  getContainerDepositAmount(): bigint {
    return this.containerDepositAmount;
  }

  /**
   * Clear all pending satoshi transfers (used when replacing auto-derived with user overrides).
   */
  clearTransfers(): this {
    this.pendingTransfers = [];
    return this;
  }

  /**
   * Clear all pending token container FT transfers.
   */
  clearTokenContainerTransfers(): this {
    this.pendingTokenContainerTransfers = [];
    this.tokenContainerTransferInsertionCounter = this.pendingTokenContainerTransferNfts.reduce(
      (next, transfer) => Math.max(next, transfer.insertionOrder + 1), 0,
    );
    return this;
  }

  /**
   * Clear all pending token container NFT transfers.
   */
  clearTokenContainerTransferNfts(): this {
    this.pendingTokenContainerTransferNfts = [];
    this.tokenContainerTransferInsertionCounter = this.pendingTokenContainerTransfers.reduce(
      (next, transfer) => Math.max(next, transfer.insertionOrder + 1), 0,
    );
    return this;
  }

  /**
   * Emit an event with the given arguments.
   * Event NFT outputs are added in build() after entry NFT outputs.
   *
   * @param eventNameOrSignature - Event name (if unambiguous) or full signature e.g. "Transfer(pubkey,int)".
   */
  emitEvent(eventNameOrSignature: string, ...args: EventEmitData['args']): this {
    const eventSignature = this.resolveEventSignature(eventNameOrSignature);
    const eventDef = this.eventDefinitions.find((e) => e.signature === eventSignature);
    this.pendingEventEmits.push({ eventName: eventDef!.name, eventSignature, args });
    return this;
  }

  /** Append a compatibility event after every covenant-positioned output (e.g. an inherited internal emit). */
  emitDetachedEvent(eventNameOrSignature: string, ...args: EventEmitData['args']): this {
    const eventSignature = this.resolveEventSignature(eventNameOrSignature);
    const eventDef = this.eventDefinitions.find((e) => e.signature === eventSignature)!;
    const encodedParts = eventDef.parameters.map((parameter, i) => {
      let value = args[i];
      if (typeof value === 'string') {
        if (parameter.type === 'string') value = new TextEncoder().encode(value);
        else if (parameter.type === 'address' && value.includes(':')) value = addressToLockScript(value);
        else if (parameter.type === 'address' && /^(0x)?0*$/i.test(value)) value = new Uint8Array(0);
        else if (parameter.type === 'address' && /^0x[0-9a-fA-F]*$/.test(value)) value = hexToBin(value.slice(2));
        else if (isHex(value)) value = hexToBin(value);
        else throw new Error(`Invalid event argument at index ${i}: expected a hex string, got '${value}'`);
      }
      return encodePushdataValue(value, parameter.type, this.stateLayout.structs);
    });
    const commitment = new Uint8Array(encodedParts.reduce((sum, part) => sum + part.length, 0));
    let cursor = 0;
    for (const part of encodedParts) { commitment.set(part, cursor); cursor += part.length; }
    this.detachedEventReceipts.push({ eventSignature, commitment: binToHex(commitment) });
    return this;
  }

  registerDetachedEvent(definition: EventDefinitionAbi, lockingBytecode: Uint8Array): this {
    if (!this.eventDefinitions.some((event) => event.signature === definition.signature)) {
      this.eventDefinitions = [...this.eventDefinitions, definition];
    }
    this.eventNftLockingBytecodes.set(definition.signature, lockingBytecode);
    return this;
  }

  private resolveEventSignature(eventNameOrSignature: string): string {
    if (eventNameOrSignature.includes('(')) {
      const match = this.eventDefinitions.find((e) => e.signature === eventNameOrSignature);
      if (!match) throw new Error(`Unknown event signature: ${eventNameOrSignature}`);
      return match.signature;
    }
    const matches = this.eventDefinitions.filter((e) => e.name === eventNameOrSignature);
    if (matches.length === 0) throw new Error(`Unknown event: ${eventNameOrSignature}`);
    if (matches.length > 1) {
      throw new Error(
        `Ambiguous event name '${eventNameOrSignature}', use full signature: ${matches.map((m) => m.signature).join(', ')}`,
      );
    }
    return matches[0].signature;
  }

  /**
   * Add an additional output to the transaction.
   * These outputs are buffered and appended after master + data NFT + entry NFT outputs in build().
   *
   * @throws Error if attempting to create a minting NFT of this contract's category,
   * which would violate the on-chain minting NFT uniqueness check.
   */
  addOutput(output: { to: string | Uint8Array; amount: bigint; token?: Utxo['token'] }): this {
    if (output.token?.category === this.categoryId) {
      throw new Error(
        'Cannot create additional token outputs of this category in a stateful transaction. '
        + 'Token outputs for this category are managed by the covenant system.',
      );
    }
    this.pendingOutputs.push(output);
    return this;
  }

  /**
   * P5b: buffer an unpinned same-category value-chunk output (a LONG sorted-mapping value's persisted chunk).
   * Unlike addOutput, this permits the contract's own category: value chunks are 0x01 mutable NFTs the vmap write
   * covenant tolerates (no total-output bound; minting uniqueness counts only 0x02; C3 skipped for entry access).
   * They are materialized trailing (after dynamic chunks / loop entries) with their commitment fixed, so the
   * auto-derivation never sees them. Soundness is by the entry's stored sha256(value), verified on read.
   */
  setDerivedChunkOutput(
    outputIndex: number, chunk: DerivedChunkOutputObservation,
  ): boolean {
    return setDerivedChunkOutputImpl(this._setDerivedChunkOutputHost(), outputIndex, chunk);
  }

  /**
   * The trailing-band coordinates both sides use: the compiler's fixed base (`blockLayout.blockSize`), the
   * published `trailingBase` when the artifact carries one, and the SDK's own chunk base after reserved prefixes.
   * A disagreement here is the band-base mismatch that makes a covenant walk runtime-effect records.
   */
  getTrailingBandCoordinatesForDiagnostics(): {
    blockSize?: number; trailingBase?: number; chunkBase?: number; eventBase?: number;
    events: number; transfers: number; loopEntries: number; runtimeEvents: number;
    eventSlots: number[]; writerCandidates: string[];
    band?: { start: number; end: number; nNew: number };
  } {
    const eventIndex = (offset: number): number => {
      try {
        return this.getRuntimeLoopEventOutputIndex(offset);
      } catch {
        return -1;
      }
    };
    const band = this.getChunkableValueWriteBand();
    return {
      ...(this.blockLayout?.blockSize !== undefined ? { blockSize: this.blockLayout.blockSize } : {}),
      ...(this.blockLayout?.trailingBase !== undefined
        ? { trailingBase: this.blockLayout.trailingBase } : {}),
      chunkBase: this.getChunkOutputBase(),
      eventBase: this.getEventOutputBase(),
      // Every family that claims a coordinate inside the trailing run, so the overlap can be laid out directly.
      events: this.runtimeLoopEventOutputs.length,
      transfers: this.runtimeLoopTransferOutputs.length,
      loopEntries: this._trailingLoopEntryOutputCount(),
      runtimeEvents: this.runtimeLoopTrailingSegments.length,
      eventSlots: this.runtimeLoopEventOutputs.map((_event, index) => eventIndex(index)),
      // The writer selector bails out both when NO group yields a chunkable resource and when MORE THAN ONE does
      // (`executions.size !== 1`), which have completely different fixes. Report the candidate identities so the
      // two cases are distinguishable from the record alone.
      writerCandidates: [
        ...this.lowLevelCallUtxoGroups.map((group, index) => ({
          group, inputIndex: this.getLowLevelCallMasterInputIndex(index), kind: `llc#${index}`,
        })),
        ...this.externalCallUtxoGroups.map((group, index) => ({
          group, inputIndex: this.getExternalCallMasterInputIndex(index), kind: `ext#${index}`,
        })),
      ].flatMap(({ group, inputIndex, kind }) => {
        if (inputIndex < 0) return [];
        const resource = groupChunkableValueWriteResource(group as never);
        if (resource === undefined) return [];
        return [`${kind}@${inputIndex}:${resource.collection}`
          + `${resource.resourceIdentity ? `/${resource.resourceIdentity}` : ''}`];
      }),
      ...(band ? { band: { start: band.start, end: band.end, nNew: band.nNew } } : {}),
    };
  }

  /** Block-layout slots as built, for diagnostics that attribute aggregate coordinates to their owner. */
  getBlockLayoutSlotsForDiagnostics(): Array<{ offset: number; kind: string; slotIndex?: number }> {
    return (this.blockLayout?.slots ?? []).map((slot) => ({
      offset: slot.offset,
      kind: String(slot.kind),
      ...(slot.slotIndex !== undefined ? { slotIndex: slot.slotIndex } : {}),
    }));
  }

  getDerivedChunkOutputs(): ReadonlyMap<number, DerivedChunkOutputObservation> {
    return this.derivedChunkOutputs;
  }

  /** Materialize authenticated computed value chunks needed by a projected read before final send convergence. */
  materializeProjectedComputedValueChunks(): TransactionBuilder {
    const writerInputs = new Set<number>();
    for (const [groupIndex, group] of this.externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex === undefined) writerInputs.add(this.getExternalCallMasterInputIndex(groupIndex));
    }
    for (const [groupIndex, group] of this.lowLevelCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex === undefined) writerInputs.add(this.getLowLevelCallMasterInputIndex(groupIndex));
    }
    writerInputs.delete(-1);
    let builder = this.build();
    for (let pass = 0; pass < 3; pass += 1) {
      let changed = false;
      for (const inputIndex of writerInputs) {
        changed = this._repairComputedChunkOutput(builder, inputIndex).changed || changed;
      }
      if (!changed) break;
      builder = this.build();
    }
    return builder;
  }

  /** Drop a stale fixed pin (e.g. prior probe entryIndex before layout settled). */
  clearDerivedChunkOutput(outputIndex: number): boolean {
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_RESOURCE_PARTS === '1') {
      const observation = this.derivedChunkOutputs.get(outputIndex);
      if (observation?.resourceIdentity !== undefined) {
        console.error('derived-resource-part-cleared', {
          outputIndex,
          resourceIdentity: observation.resourceIdentity,
          resourcePart: observation.resourcePart,
          semanticKind: observation.semanticKind,
        });
      }
    }
    return this.derivedChunkOutputs.delete(outputIndex);
  }

  /**
   * Place persist/compose jobEvents chunks before the first VM probe so
   * updateJobPost does not spend the 64-iteration budget rediscovering v.
   */
  seedPersistedJobEventsBand(): number {
    if (!this._shouldRematerializePersistUpdate()) return 0;
    const band = this.getChunkableValueWriteBand();
    if (!band) return 0;
    const categoryId = this._chunkableValueWriteCategory();
    const value = this._persistedValueChunkValue(categoryId);
    const persistedWrite = this._persistedValueChunkWrite(categoryId);
    const lock = persistUpdateRedeemLock(
      categoryId, this.valueChunkRedeemLock, persistedWrite,
      !this._hasChunkableValueWriteMetadata() && this._permitsLegacyNamedValueChunkFallback(),
    );
    if (!value || !lock) return 0;
    if (this.bumpChunkableValueWriteWidth(valueChunkCountFor(value))) this._refreshInputs();
    const live = this.getChunkableValueWriteBand() ?? band;
    return seedChunksFromPersistedValue(
      (outputIndex, chunk) => this.setDerivedChunkOutput(outputIndex, {
        ...chunk,
        semanticKind: 'valueChunk',
      }),
      live.start,
      value,
      lock,
      categoryId,
    );
  }

  addValueChunkOutput(output: { to: string | Uint8Array; amount: bigint; token?: Utxo['token'] }): this {
    this.valueChunkOutputs.push(output);
    return this;
  }

  /**
   * Identity-scan pins name a redeem lock, not a slot. Replace any previously staged
   * outputs for that lock so derivation iterations do not duplicate the run.
   */
  stageValueChunkOutputs(
    lockingBytecode: Uint8Array,
    outputs: Array<{ to: string | Uint8Array; amount: bigint; token?: Utxo['token'] }>,
  ): this {
    const sameDestination = (left: string | Uint8Array, right: string | Uint8Array): boolean => (
      typeof left === 'string' || typeof right === 'string'
        ? typeof left === 'string' && typeof right === 'string' && left === right
        : binToHex(left) === binToHex(right)
    );
    const sameToken = (left: Utxo['token'] | undefined, right: Utxo['token'] | undefined): boolean => (
      left === right || (!!left && !!right
        && left.category?.toLowerCase() === right.category?.toLowerCase()
        && (left.amount ?? 0n) === (right.amount ?? 0n)
        && left.nft?.capability === right.nft?.capability
        && String(left.nft?.commitment ?? '').toLowerCase()
          === String(right.nft?.commitment ?? '').toLowerCase())
    );
    const identical = this.valueChunkOutputsLock !== undefined
      && binToHex(this.valueChunkOutputsLock) === binToHex(lockingBytecode)
      && this.valueChunkOutputs.length === outputs.length
      && outputs.every((output, index) => {
        const existing = this.valueChunkOutputs[index];
        return existing !== undefined
          && sameDestination(existing.to, output.to)
          && existing.amount === output.amount
          && sameToken(existing.token, output.token);
      });
    if (identical) return this;
    // A valueWitness update changes sha256(value) and therefore the chunk P2SH32.
    // Drop every previously staged run so stale locks cannot dilute the identity scan.
    this.valueChunkOutputs = [...outputs];
    this.valueChunkOutputsLock = Uint8Array.from(lockingBytecode);
    this.dynamicLayoutRevision += 1;
    return this;
  }

  hasStagedValueChunkOutputs(): boolean {
    return this.valueChunkOutputs.length > 0;
  }

  /**
   * Identity-scan staging appends trailing redeem-lock NFTs. Later band/surplus passes can
   * convert those copies into OP_TRUE when the persist band collides with another participant.
   * Re-append any missing staged locks so the kernel count pin still observes them.
   */
  /**
   * A provisional empty-root NEW EntryNft can remain alongside the learned commitment at
   * another index with the same collection lock. The covenant's first lock match then
   * EQUALVERIFYs the empty commitment. Demote empty duplicates to OP_TRUE pads.
   */
  private _stripEmptyDuplicateEntryLocksHost(): StripEmptyDuplicateEntryLocksHost {
    return {
      derivedChunkOutputs: this.derivedChunkOutputs,
    };
  }

  private _stripEmptyDuplicateEntryLocks(builder: TransactionBuilder): number {
    return stripEmptyDuplicateEntryLocks(this._stripEmptyDuplicateEntryLocksHost(), builder);
  }

  private _reassertStagedValueChunkOutputs(builder: TransactionBuilder): number {
    return reassertStagedValueChunkOutputs(this._reverseSuffixValueChunkHost(), builder);
  }

  /**
   * Runtime-loop value chunks occupy the region immediately before one terminal suffix output. The builder
   * guarantees that suffix is either the required external-library sidecar recreation or a zero-value OP_RETURN
   * anchor, and inserts fee change before this region.
   */
  addLateValueChunkOutput(output: { to: string | Uint8Array; amount: bigint; token?: Utxo['token'] }): this {
    this.lateValueChunkOutputs.push(output);
    return this;
  }

  /**
   * Write recovered value-chunk pins onto `builder`. A long UPDATE changes sha256(value)
   * and therefore the chunk P2SH32; same-index recreation of the previous digest must not
   * survive. Returns whether any output changed.
   */
  /**
   * Final send() only: repair reverse-indexed value chunks after late appends.
   * Probe builds keep the append-time order so derivation does not thrash.
   */
  private _finalizeReverseSuffixValueChunkLayout(builder: TransactionBuilder): number {
    return finalizeReverseSuffixValueChunkLayout(this._reverseSuffixValueChunkHost(), builder);
  }

  /**
   * Pin reverse-suffix dynamic-array chunks at TXOUTPUTCOUNT-1-nNew.
   * Empty-whitelist posts were leaving chunk0/chunk1 swapped or missing on that window after
   * late layout growth, so final preflight EQUALVERIFYd the wrong commitment then the wrong lock.
   *
   * When `stripSurplus` is set (final send layout only), demote earlier same-lock mutable copies
   * left behind by late value-chunk appends so TXOUTPUTCOUNT-1-nNew is the unique chunk window.
   * Do not enable during probe builds — stripping there thrash-hangs derivation.
   */
  private _reassertReverseSuffixDynamicChunks(
    builder: TransactionBuilder,
    options?: { stripSurplus?: boolean },
  ): number {
    return reassertReverseSuffixDynamicChunks(this._reverseSuffixValueChunkHost(), builder, options);
  }

  private _applyDerivedValueChunks(builder: TransactionBuilder): boolean {
    return applyDerivedValueChunks(this._derivedValueChunkApplyHost(), builder);
  }

  /**
   * Final state/resource preservation can legitimately reclaim a provisional continuation coordinate. Move only
   * compiler-derived, self-describing runs, and only into token-free balanced slots; fixed pins remain immovable.
   */
  private _relocateCollidingDerivedValueChunkRuns(builder: TransactionBuilder): boolean {
    return relocateCollidingDerivedValueChunkRuns(this._derivedValueChunkApplyHost(), builder);
  }

  /**
   * Enforce the cardinality of each authenticated, contiguous value-chunk run.
   * Late state/preservation materializers can replay a predecessor outside the
   * derived run after its first cleanup. The compiler counts outputs by redeem
   * lock, so even an exact duplicate at an unowned coordinate is observable.
   */
  private _stripSurplusDerivedValueChunkLocks(builder: TransactionBuilder): number {
    return stripSurplusDerivedValueChunkLocks(this._derivedValueChunkApplyHost(), builder);
  }

  /**
   * Last writer on the view-only path: place the selected writer's value chunks
   * after its implementation window, leaving view tails and minting masters alone.
   */
  private _materializeValueChunkBand(builder: TransactionBuilder): void {
    materializeValueChunkBand(this._valueChunkBandHost(), builder);
  }

  private _ensureLiveValueChunkBand(builder: TransactionBuilder): void {
    ensureLiveValueChunkBand(this._valueChunkBandHost(), builder);
  }

  private _packReverseIndexedValueChunkSuffix(builder: TransactionBuilder): void {
    packReverseIndexedValueChunkSuffix(this._valueChunkBandHost(), builder);
  }

  /**
   * Successful chunkable writes must seed persistence even when derivation
   * never failed (the extract-on-fail path never ran). The next UPDATE uses
   * persistWidth to drop insertShift so chunks stay at impl+blockSize.
   */
  private _persistPlacedValueChunkBand(builder: TransactionBuilder, txid?: string): void {
    persistPlacedValueChunkBand(this._valueChunkBandHost(), builder, txid);
  }

  /**
   * Rebase absolute output coordinates when a final, non-covenant output is inserted before the
   * authenticated suffix. Reverse-indexed suffix checks remain valid after the insertion, but composed
   * continuation writers can also receive an absolute `__internal__valueChunkOutputBase` witness. Keep the
   * recovered-output cache and every carrier of that witness aligned with the shifted physical outputs.
   *
   * This is intentionally separate from probe-only suffix insertions: derivation adds a temporary remainder
   * to an ephemeral builder and must not advance persistent coordinates on every probe iteration.
   */
  private _rebindLateValueSuffixAfterInsertion(builder: TransactionBuilder, insertAt: number): void {
    rebindLateValueSuffixAfterInsertion(this._lateValueSuffixRebindHost(), builder, insertAt);
  }

  /**
   * Rebind an absolute continuation witness when a participant-owned output is materialized after the route
   * probe selected its append coordinate. The continuation itself is self-describing: a contiguous run of
   * mutable P2SH32 outputs in the participant category, with uint16-le indices 0..n-1. Only search forward from
   * the authenticated provisional base, so an older chunk run cannot be mistaken for the new write.
   */
  private _reconcileMaterializedValueChunkWitnesses(builder: TransactionBuilder): boolean {
    return reconcileMaterializedValueChunkWitnesses(this._lateValueSuffixRebindHost(), builder);
  }

  /**
   * Bind compiler-owned continuation witnesses after every output in an isolated composition block has been
   * materialized. Graph routes can represent several logical calls with one low-level carrier, so discovery is
   * based on ABI/state-layout metadata and the self-describing output run rather than a source function name.
   * @internal
   */
  private _bindMaterializedValueChunkWitnessesHost(): BindMaterializedValueChunkWitnessesHost {
    return {
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      categoryId: this.categoryId,
      derivedChunkOutputs: this.derivedChunkOutputs,
      allInputs: this.allInputs,
      messageBusConvention: this.messageBusConvention,
      syncRefreshedCarrierMasters: (builder, carriers) => {
        this._syncRefreshedCarrierMasters(builder, carriers);
      },
    };
  }

  private _setDerivedChunkOutputHost(): SetDerivedChunkOutputHost {
    return {
      categoryId: this.categoryId,
      allInputs: this.allInputs,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      derivedChunkOutputs: this.derivedChunkOutputs,
      messageBusConvention: this.messageBusConvention,
      valueChunkWriteCategorySelection: () => this._valueChunkWriteCategorySelection(),
      getLowLevelCallMasterInputIndex: (groupIndex) => this.getLowLevelCallMasterInputIndex(groupIndex),
      rememberJobEventsChunks: (categoryId, chunks) => {
        this.rememberJobEventsChunks(categoryId, chunks);
      },
    };
  }

  private _restoreBuilderReturnOutputParamsHost(): RestoreBuilderReturnOutputParamsHost {
    const self = this;
    return {
      externalCallUtxoGroups: this.externalCallUtxoGroups,
      lowLevelCallUtxoGroups: this.lowLevelCallUtxoGroups,
      messageBusConvention: this.messageBusConvention,
      get builtReturnEventOutputIndices() {
        return self.builtReturnEventOutputIndices;
      },
      set builtReturnEventOutputIndices(next) {
        self.builtReturnEventOutputIndices = next;
      },
      get derivedChunkOutputs() {
        return self.derivedChunkOutputs;
      },
      set derivedChunkOutputs(next) {
        self.derivedChunkOutputs = next;
      },
      setDerivedChunkOutput: (outputIndex, chunk) => self.setDerivedChunkOutput(outputIndex, chunk),
    };
  }

  bindMaterializedValueChunkWitnesses(builder: TransactionBuilder, coordinateBase = 0): boolean {
    return bindMaterializedValueChunkWitnessesImpl(
      this._bindMaterializedValueChunkWitnessesHost(),
      builder,
      coordinateBase,
    );
  }

  /** Insert a non-covenant output before the authenticated [late chunks][terminal suffix] region. */
  insertBeforeLateValueSuffix(
    builder: TransactionBuilder,
    output: Output,
    options: {
      rebindAbsoluteWitnesses?: boolean;
      /** Shift only return-output unlocker indices (probe-safe; no chunk-base compounding). */
      rebindReturnWitnessesOnly?: boolean;
    } = {},
  ): LateValueSuffixInsertion {
    const delegateDynamicCount = this.delegateDynamicChunksAtSuffix ? this._dynamicChunkOutputCount() : 0;
    const authenticatedSuffixCount = delegateDynamicCount + this.lateValueChunkOutputs.length;
    if (authenticatedSuffixCount === 0) {
      const insertAt = builder.outputs.length;
      builder.addOutput(output);
      return { insertAt, shiftedAbsoluteWitnesses: false };
    }
    const insertAt = continuationOutputBaseBeforeSuffix(
      builder.outputs.length,
      authenticatedSuffixCount,
      this._continuationProtectedOutputPrefix(),
    );
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_PAD_HOLE === '1') {
      const before6 = builder.outputs[6];
      console.error('insert-before-suffix', {
        insertAt,
        length: builder.outputs.length,
        authenticatedSuffixCount,
        before6: {
          hasToken: !!before6?.token,
          cap: before6?.token?.nft?.capability,
          lock: before6?.to instanceof Uint8Array ? binToHex(before6.to).slice(0, 16) : String(before6?.to ?? ''),
        },
      });
    }
    builder.outputs.splice(insertAt, 0, output);
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_PAD_HOLE === '1' && insertAt <= 6) {
      console.error('insert-shifted-slot6', {
        insertAt,
        after6: {
          hasToken: !!builder.outputs[6]?.token,
          cap: builder.outputs[6]?.token?.nft?.capability,
          lock: builder.outputs[6]?.to instanceof Uint8Array
            ? binToHex(builder.outputs[6]!.to as Uint8Array).slice(0, 16)
            : String(builder.outputs[6]?.to ?? ''),
        },
      });
    }
    let shiftedAbsoluteWitnesses = false;
    if (options.rebindAbsoluteWitnesses) {
      this._rebindLateValueSuffixAfterInsertion(builder, insertAt);
      shiftedAbsoluteWitnesses = true;
    } else if (options.rebindReturnWitnessesOnly) {
      let maxReturnIdx = -1;
      for (const input of builder.inputs) {
        const unlocker = input.unlocker as {
          abiFunction?: { inputs?: Array<{ name: string }> };
          params?: unknown[];
        } | undefined;
        if (!unlocker?.abiFunction?.inputs || !unlocker.params) continue;
        for (let argIndex = 0; argIndex < unlocker.abiFunction.inputs.length; argIndex += 1) {
          const name = unlocker.abiFunction.inputs[argIndex]?.name;
          if (!name || !/ReturnOutputIdx/i.test(name)) continue;
          const raw = unlocker.params[argIndex];
          const index = typeof raw === 'bigint' ? Number(raw)
            : typeof raw === 'number' ? raw : -1;
          if (index > maxReturnIdx) maxReturnIdx = index;
        }
      }
      // Splice is required so reverse-indexed value chunks stay correct; rebind view-return
      // Idx when the insert would otherwise park them on the dummy/separator.
      if (maxReturnIdx >= insertAt) {
        this._rebindReturnWitnessesAfterInsertion(builder, insertAt);
        shiftedAbsoluteWitnesses = true;
      }
    }
    return { insertAt, shiftedAbsoluteWitnesses };
  }

  /**
   * Probe-safe: shift unlocker ReturnOutputIdx + valueChunkOutputBase via syncEncodedArgsFromParams,
   * and bump in-memory group/chunk maps for extract during this probe.
   */
  private _rebindReturnWitnessesAfterInsertion(builder: TransactionBuilder, insertAt: number): void {
    const shiftIndexMap = <T>(values: Map<number, T>): Map<number, T> => new Map(
      [...values.entries()].map(([index, value]) => [index >= insertAt ? index + 1 : index, value]),
    );
    this.derivedChunkOutputs = shiftIndexMap(this.derivedChunkOutputs);
    this.builtReturnEventOutputIndices = new Map(
      [...this.builtReturnEventOutputIndices.entries()].map(([identity, index]) => [
        identity, index >= insertAt ? index + 1 : index,
      ]),
    );
    for (const group of [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups]) {
      if (group.returnOutputIndex !== undefined && group.returnOutputIndex >= insertAt) {
        group.returnOutputIndex += 1;
      }
      if (group.valueChunkOutputBase !== undefined && group.valueChunkOutputBase >= insertAt) {
        group.valueChunkOutputBase += 1;
        if (group.internalArgs
          && group.internalArgNames?.includes('__internal__valueChunkOutputBase')) {
          group.internalArgs = {
            ...group.internalArgs,
            __internal__valueChunkOutputBase: BigInt(group.valueChunkOutputBase),
          };
        }
      }
    }
    this.evacuateReturnIndicesOffOpReturn(builder, {
      insertAt,
      shiftAllAbsoluteOutputIndices: true,
    });
  }

  /**
   * Snapshot unlocker absolute index params + group/chunk maps so probe-local rebind
   * cannot compound across derivation iterations.
   */
  snapshotBuilderReturnOutputParams(builder: TransactionBuilder): {
    unlockerParams: Array<{ inputIndex: number; argIndex: number; value: unknown }>;
    groupReturns: Array<{
      index: number;
      ret?: number;
      planned?: number;
      valueChunkOutputBase?: number;
      valueChunkArg?: unknown;
    }>;
    built: Array<[string, number]>;
    derivedChunkOutputs: Array<[number, unknown]>;
  } {
    const unlockerParams: Array<{ inputIndex: number; argIndex: number; value: unknown }> = [];
    for (let inputIndex = 0; inputIndex < builder.inputs.length; inputIndex += 1) {
      const unlocker = builder.inputs[inputIndex]?.unlocker as {
        abiFunction?: { inputs?: Array<{ name: string }> };
        params?: unknown[];
      } | undefined;
      if (!unlocker?.abiFunction?.inputs || !unlocker.params) continue;
      for (let argIndex = 0; argIndex < unlocker.abiFunction.inputs.length; argIndex += 1) {
        const name = unlocker.abiFunction.inputs[argIndex]?.name;
        if (!name) continue;
        if (!(/ReturnOutputIdx/i.test(name) || /valueChunkOutputBase/i.test(name)
          || /OutputBase/i.test(name) || /PredOut/i.test(name))) {
          continue;
        }
        unlockerParams.push({ inputIndex, argIndex, value: unlocker.params[argIndex] });
      }
    }
    return {
      unlockerParams,
      built: [...this.builtReturnEventOutputIndices.entries()],
      derivedChunkOutputs: [...this.derivedChunkOutputs.entries()],
      groupReturns: [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups].map((group, index) => ({
        index,
        ret: group.returnOutputIndex,
        planned: 'plannedReturnOutputIndex' in group ? group.plannedReturnOutputIndex : undefined,
        valueChunkOutputBase: group.valueChunkOutputBase,
        valueChunkArg: group.internalArgs?.__internal__valueChunkOutputBase,
      })),
    };
  }

  /** Restore unlocker params + group/chunk maps from snapshot. */
  restoreBuilderReturnOutputParams(
    builder: TransactionBuilder,
    snapshot: ReturnType<StatefulTransactionBuilder['snapshotBuilderReturnOutputParams']>,
    insertion?: LateValueSuffixInsertion,
  ): void {
    restoreBuilderReturnOutputParamsImpl(
      this._restoreBuilderReturnOutputParamsHost(),
      builder,
      snapshot,
      insertion,
    );
  }

  /**
   * Probe-local: if a ReturnOutputIdx on this builder's unlockers names OP_RETURN (or was
   * shifted by a late-suffix insert onto the separator), bump the param to the next pad and
   * re-encode via syncEncodedArgsFromParams. Does not mutate persistent carrier state.
   */
  evacuateReturnIndicesOffOpReturn(
    builder: TransactionBuilder,
    options: { insertAt?: number; shiftAllAbsoluteOutputIndices?: boolean } = {},
  ): boolean {
    let changed = false;
    const lockAt = (index: number): Uint8Array | string | undefined => {
      const to = builder.outputs[index]?.to;
      return to instanceof Uint8Array || typeof to === 'string' ? to : undefined;
    };
    const nextHost = (start: number): number => {
      let host = start;
      while (host >= builder.outputs.length) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 800n });
      }
      while (isOpReturnLockingBytecode(lockAt(host))) {
        host += 1;
        while (host >= builder.outputs.length) {
          builder.addOutput({ to: Uint8Array.of(0x51), amount: 800n });
        }
      }
      return host;
    };
    const isAbsoluteOutputIndexName = (name: string): boolean => (
      /ReturnOutputIdx/i.test(name)
      || /valueChunkOutputBase/i.test(name)
      || /OutputBase/i.test(name)
      || /PredOut/i.test(name)
    );
    for (const input of builder.inputs) {
      const unlocker = input.unlocker as {
        abiFunction?: { inputs?: Array<{ name: string }> };
        params?: unknown[];
        syncEncodedArgsFromParams?: (onlyIndices?: readonly number[]) => void;
      } | undefined;
      if (!unlocker?.abiFunction?.inputs || !unlocker.params) continue;
      const changedArgIndices: number[] = [];
      for (let argIndex = 0; argIndex < unlocker.abiFunction.inputs.length; argIndex += 1) {
        const name = unlocker.abiFunction.inputs[argIndex]?.name;
        if (!name) continue;
        const raw: unknown = unlocker.params[argIndex];
        const original: number = typeof raw === 'bigint' ? Number(raw)
          : typeof raw === 'number' ? raw : -1;
        if (original < 0) continue;
        let index: number = original;
        if (/ReturnOutputIdx/i.test(name)) {
          if (original >= builder.outputs.length) continue;
          if (isOpReturnLockingBytecode(lockAt(index))) {
            index = nextHost(index);
          } else if (
            options.insertAt !== undefined
            && original >= options.insertAt
            && !isViewReturnTailOutput(builder.outputs[original])
            && original + 1 < builder.outputs.length
            && isViewReturnTailOutput(builder.outputs[original + 1])
          ) {
            index = original + 1;
          } else if (options.insertAt !== undefined && original >= options.insertAt) {
            index = original + 1;
          } else {
            continue;
          }
        } else if (
          options.shiftAllAbsoluteOutputIndices
          && options.insertAt !== undefined
          && isAbsoluteOutputIndexName(name)
          && original >= options.insertAt
        ) {
          index = original + 1;
        } else {
          continue;
        }
        if (index === original) continue;
        if (unlocker.params[argIndex] !== BigInt(index)) {
          unlocker.params[argIndex] = BigInt(index);
          changedArgIndices.push(argIndex);
        }
      }
      if (changedArgIndices.length === 0) continue;
      unlocker.syncEncodedArgsFromParams?.(changedArgIndices);
      changed = true;
    }
    return changed;
  }

  /** Absolute append coordinate which preserves any reverse-indexed output suffix. */
  getContinuationOutputBase(builder: TransactionBuilder): number {
    const delegateDynamicCount = this.delegateDynamicChunksAtSuffix ? this._dynamicChunkOutputCount() : 0;
    return continuationOutputBaseBeforeSuffix(
      builder.outputs.length,
      delegateDynamicCount + this.lateValueChunkOutputs.length,
      this._continuationProtectedOutputPrefix(),
    );
  }

  /**
   * First output coordinate after fixed-layout resources which must retain their published absolute indices.
   * Sorted mapping batches can place authenticated predecessor/NEW nodes immediately after `blockSize`; using
   * only the fixed block width lets a probe remainder split that trailing entry band and stale every predOut
   * witness. The loop-entry planner is the authority for both the band's base and its concrete width. Protect
   * every physically materialized entry: delegate-owned entries are excluded from the root's trailing ownership
   * count, but they still occupy this builder's output frame and retain absolute predOut coordinates.
   */
  private _continuationProtectedOutputPrefix(): number {
    const fixedBlockEnd = this.blockLayout?.blockSize ?? 0;
    const materializedEntries = this._loopEntryOutputCount();
    if (materializedEntries === 0) return fixedBlockEnd;
    return Math.max(fixedBlockEnd, this.getLoopEntryOutputBase() + materializedEntries);
  }

  /** Pin a collection's loop-entry (NEW) commitment as known-exactly, so auto-derivation skips re-deriving it. */
  pinLoopEntry(collection: string): this {
    this.pinnedLoopEntries.add(collection);
    return this;
  }

  /** Whether a collection's loop-entry (NEW) commitment is pinned (injected exactly, not trace-derived). */
  isLoopEntryPinned(collection: string): boolean {
    return this.pinnedLoopEntries.has(collection);
  }

  /**
   * Register a routed batch TARGET node whose VALUE the planner cannot reproduce: the route row builds it inside
   * its handler, so the node is published with its key and successor link only. Registration is keyed by the entry
   * that owns the node, so completion never depends on the lane's physical coordinate.
   */
  registerPendingEntryValueTail(params: {
    slotIndex: number; collection: string; slot: Uint8Array; seed: string; next: Uint8Array; chunkable: boolean;
  }): this {
    this.pendingEntryValueTails.set(`${params.collection}|${binToHex(params.slot)}`, { ...params });
    return this;
  }

  /**
   * Finish a registered TARGET node from the value its own write authenticated. Only a commitment still equal to
   * the published seed is rewritten, so a node another derivation already replaced is never clobbered. Returns
   * whether any published commitment changed (the caller must then re-probe).
   *
   * Only the PUBLISHED loop-entry lane is completed. An in-block entry placeholder names the same node but is also
   * the coordinate the entry covenant's own output checks read; rewriting it from here moved a later upgrade
   * transaction's participant block one slot past its published span (measured), while the lane the route actually
   * verifies is the trailing one. The entry coordinate keeps its seed and stays available to the generic
   * entry-commitment derivation.
   */
  completePendingEntryValueTail(collection: string, slot: Uint8Array, value: Uint8Array): boolean {
    const pending = this.pendingEntryValueTails.get(`${collection}|${binToHex(slot)}`);
    if (!pending) return false;
    const commitment = binToHex(encodeEntryCommitment(
      pending.slot, pending.next, pending.chunkable ? encodeChunkableValueTail(value) : value,
    ));
    if (commitment === pending.seed) return false;
    let changed = false;
    const entries = this.loopEntryCommitments.get(collection) ?? [];
    const lane = entries.indexOf(pending.seed);
    if (lane >= 0) {
      this.loopEntryCommitments.set(collection, entries.map((entry, index) =>
        (index === lane ? commitment : entry)));
      changed = true;
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_PENDING_VALUE_TAIL === '1') {
      console.error('pending-value-tail-complete', JSON.stringify({
        collection, slot: binToHex(slot).slice(0, 16), valueBytes: value.length, chunkable: pending.chunkable,
        seed: pending.seed.slice(0, 40), commitment: commitment.slice(0, 40), changed, lane,
        commitmentBytes: commitment.length / 2, tail: commitment.slice(-72),
        inputs: this.allInputs.length,
      }));
    }
    return changed;
  }

  /** Complete an existing chunkable entry update from the value authenticated by its continuation covenant. */
  completeExistingEntryValueTail(
    collection: string, slot: Uint8Array, value: Uint8Array, slotIndex?: number,
  ): boolean {
    for (const entry of this.entryNfts) {
      if (slotIndex !== undefined && entry.slotIndex !== slotIndex) continue;
      if (!entry.exists || entry.collection !== collection || !entry.utxo?.token?.nft) continue;
      const priorHex = this.entryRawCommitments.get(entry.slotIndex)
        ?? entry.utxo.token.nft.commitment;
      if (!priorHex) continue;
      let prior: ReturnType<typeof decodeEntryCommitment>;
      try {
        prior = decodeEntryCommitment(hexToBin(priorHex));
      } catch {
        continue;
      }
      if (!binsAreEqual(prior.slot, slot)) continue;
      const commitment = binToHex(encodeEntryCommitment(
        prior.slot, prior.nextKey, encodeChunkableValueTail(value),
      ));
      if (commitment === priorHex) return false;
      this.entryRawCommitments.set(entry.slotIndex, commitment);
      this.pinnedEntrySlots.add(entry.slotIndex);
      return true;
    }
    return false;
  }

  /** Register a collection whose value chunks are DERIVED from the trace (computed value, no direct param). */
  registerValueChunkVar(
    collection: string, lockingBytecode: Uint8Array, id = collection, slot?: Uint8Array,
  ): this {
    this.valueChunkVars.set(id, { collection, lockingBytecode, ...(slot && { slot }) });
    return this;
  }

  setValueChunkLockingBytecode(id: string, lockingBytecode: Uint8Array): this {
    const value = this.valueChunkVars.get(id);
    if (!value) throw new Error(`value chunk run not registered: ${id}`);
    this.valueChunkVars.set(id, { ...value, lockingBytecode });
    return this;
  }

  getValueChunkVars(): Array<{
    id: string; collection: string; lockingBytecode: Uint8Array; slot?: Uint8Array;
  }> {
    return [...this.valueChunkVars.entries()].map(([id, value]) => ({ id, ...value }));
  }

  /** Publish a compiler-authenticated root-frame write to complete-graph value discovery. */
  registerValueChunkWriteDescriptor(write: ValueChunkWriteDescriptor): this {
    const identity = valueChunkWriteResourceIdentity(write);
    const prior = this.directValueChunkWriteDescriptors.get(identity);
    if (prior !== undefined && (prior.collection !== write.collection
      || prior.collectionSignature !== write.collectionSignature
      || prior.entryAccessSlot !== write.entryAccessSlot || prior.routeSlot !== write.routeSlot
      || prior.operation !== write.operation || prior.outputBase !== write.outputBase
      || prior.outputCount !== write.outputCount)) {
      throw new Error(`Conflicting root value-chunk write descriptor for '${identity}'.`);
    }
    if (prior === undefined) this.directValueChunkWriteDescriptors.set(identity, { ...write });
    return this;
  }

  /** Compiler-authored value-chunk resources carried by this concrete call graph. */
  getValueChunkWriteDescriptors(): readonly ValueChunkWriteDescriptor[] {
    const blockBase = this.getComposedBlockBase();
    const writes = [
      ...[...this.directValueChunkWriteDescriptors.values()]
        .map((write) => ({ write, blockSize: this.blockLayout?.blockSize })),
      ...[...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups]
        .flatMap((group) => (group.valueChunkWrites ?? [])
          .map((write) => ({ write, blockSize: group.blockLayout?.blockSize }))),
    ];
    return writes.map(({ write, blockSize }) => {
      const localOutputBase = blockBase > 0 && blockSize !== undefined
        && write.outputBase >= blockBase && write.outputBase < blockBase + blockSize
        ? selectBuilderValueChunkOutputBase(write.outputBase, write.outputBase, blockBase)
        : write.outputBase;
      return {
        ...write,
        outputBase: absoluteComposedValueChunkOutputBase(localOutputBase, blockBase),
      };
    });
  }

  setValueChunkRawCommitments(id: string, commitments: string[]): this {
    this.valueChunkRawCommitments.set(id, commitments);
    return this;
  }

  getValueChunkRawCommitments(id: string): string[] {
    return this.valueChunkRawCommitments.get(id) ?? [];
  }

  /**
   * Absolute base of this participant's balanced block. Composed participants materialize continuation chunks at
   * block-local coordinates, while the composed value-chunk claims and the covenant argument name the absolute
   * coordinate in the concatenated transaction.
   */
  getComposedBlockBase(): number {
    return this.composedParticipant ? this.composedBlockBase ?? 0 : 0;
  }

  /** Output index where value chunks begin: after the block, dynamic chunks, and loop-entry (NEW) outputs. */
  getValueChunkOutputBase(): number {
    if (this.delegateEntriesAfterLowLevel) {
      return this.getLoopEntryOutputBase() + this._loopEntryOutputCount();
    }
    let base = this.getChunkOutputBase();
    for (const dv of this.dynamicChunkVars) base += (this.chunkRawCommitments.get(dv.name) ?? []).length;
    if (!this.loopEntriesBeforeDynamicChunks) {
      base += this._trailingLoopEntryOutputCount();
    }
    return base;
  }

  /**
   * Build and finalize the transaction, creating data NFT outputs with updated commitments.
   */
  /**
   * Set a return event output for a cross-contract call.
   */
  /**
   * Publish already-known view / loop return commitments so the first `build()` has the
   * same tail occupancy the covenants will read. Derivation used to install these only
   * after transfer probes, so `idx0` named a hole and `meceTags` width never existed.
   */
  seedPrecomputedReturnEvents(
    returning: ReadonlyArray<{ hasReturnValues?: boolean } | undefined> = [],
  ): this {
    const typedArrayPlaceholder = (group: ExternalCallUtxoGroup): Uint8Array | undefined => {
      const artifact = group.logicalArtifact ?? group.externalContract.inner.artifact as Artifact;
      const functionName = group.logicalFunctionName ?? group.functionName;
      const abi = artifact.abi.find((candidate) => candidate.name === functionName);
      const output = abi?.outputs?.length === 1 ? abi.outputs[0] : undefined;
      if (!output || !/\[\d+\]$/.test(output.type)) return undefined;
      try {
        return encodeExternalReturnValue(
          getDefaultStateValue(output.type, artifact.structs ?? artifact.stateLayout?.structs),
          output.type, artifact.structs ?? artifact.stateLayout?.structs,
          resolveExternalResultEncoding(abi?.resultEncoding, artifact, [output.type],
            `function '${functionName}' result`) === 'evm-abi-v1', artifact.enums,
        );
      } catch {
        return undefined;
      }
    };
    const initialized = new Set<number>();
    for (const [groupIdx, group] of this.externalCallUtxoGroups.entries()) {
      const returns = returning[groupIdx]?.hasReturnValues === true
        || group.precomputedReturnCommitment !== undefined
        || (group.loopReturnCommitments?.length ?? 0) > 0;
      if (!returns) continue;
      const physicalGroupIdx = group.sharedGroupIndex ?? groupIdx;
      if (initialized.has(physicalGroupIdx)) continue;
      initialized.add(physicalGroupIdx);
      const family = this.externalCallUtxoGroups
        .map((candidate, candidateIdx) => ({ candidate, candidateIdx }))
        .filter(({ candidate, candidateIdx }) => (
          (candidate.sharedGroupIndex ?? candidateIdx) === physicalGroupIdx
          && (returning[candidateIdx]?.hasReturnValues === true
            || candidate.precomputedReturnCommitment !== undefined
            || (candidate.loopReturnCommitments?.length ?? 0) > 0)
        ));
      const physical = this.externalCallUtxoGroups[physicalGroupIdx];
      const complete = family.every(({ candidate }) => candidate.precomputedReturnCommitment !== undefined);
      const fallback = physical.precomputedReturnCommitment
        ?? typedArrayPlaceholder(physical) ?? new Uint8Array([0]);
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_RETURN === '1') {
        console.error('seed-precomputed-returns', {
          groupIdx,
          physicalGroupIdx,
          fn: group.functionName,
          logical: group.logicalFunctionName,
          loopWidth: group.loopReturnCommitments?.length,
          family: family.map(({ candidate, candidateIdx }) => ({
            candidateIdx,
            fn: candidate.functionName,
            logical: candidate.logicalFunctionName,
            loopWidth: candidate.loopReturnCommitments?.length,
            parts: (candidate.loopReturnCommitments?.length
              ? candidate.loopReturnCommitments
              : [candidate.precomputedReturnCommitment ?? typedArrayPlaceholder(candidate) ?? fallback]
            ).map((part) => ({
              bytes: part.length,
              hasDigital: binToHex(part).includes('44494749'),
              head: binToHex(part).slice(0, 16),
            })),
          })),
        });
      }
      for (const { candidate, candidateIdx } of family) {
        const parts = candidate.loopReturnCommitments?.length
          ? candidate.loopReturnCommitments
          : [candidate.precomputedReturnCommitment ?? typedArrayPlaceholder(candidate) ?? fallback];
        for (const [partIndex, part] of parts.entries()) {
          this.setReturnEventOutput(
            physical.categoryId,
            part,
            `external-call:${candidateIdx}:${partIndex}`,
            candidate.precomputedReturnCommitment === undefined
              && !(candidate.loopReturnCommitments?.length),
          );
        }
      }
      if (!complete) {
        const fused = physical.fusedReturnGroupIndex ?? family.at(-1)?.candidateIdx ?? physicalGroupIdx;
        this.setReturnEventOutput(physical.categoryId, fallback, `external-call:${fused}`, true);
      }
    }
    return this;
  }

  /** Builder-local output coordinate for the active emitReturn / staticCall materialization, when known. */
  private plannedReturnOutputIndex = -1;

  setPlannedReturnOutputIndex(index: number): this {
    if (Number.isInteger(index) && index >= 0) this.plannedReturnOutputIndex = index;
    return this;
  }

  /**
   * The digest of the call a direct return record answers, by the record's identity: an external call's group, or
   * this builder's own call. None for a routed call, whose route binds its result.
   */
  callRecordDigestFor(identity: string): Uint8Array | undefined {
    const external = /^external-call:(\d+)(?::\d+)?$/.exec(identity);
    if (external) {
      // A group's own logical call: a group sharing another's callee input names a call of its own, and an
      // identical readonly alias names the same call as the group it shares.
      const group = this.externalCallUtxoGroups[Number(external[1])];
      if (!group || group.compilerRoute) return undefined;
      return this.groupCallRecordDigest(group);
    }
    if (identity !== this.categoryId) return undefined;
    const unlocker = this.masterUtxo.unlocker;
    if (isContractUnlocker(unlocker) && unlocker.abiFunction.callRecord === true) {
      const artifact = unlocker.contract.artifact as Artifact;
      return callRecordDigest(unlocker.abiFunction, unlocker.params, {
        structs: artifact.structs ?? artifact.stateLayout?.structs, enums: artifact.enums,
      });
    }
    // A proxy entry forwards its call: the implementation it delegates to runs that call on this state, and its
    // record answers it.
    for (const group of this.lowLevelCallUtxoGroups) {
      if (group.callMode !== 'delegatecall' || group.compilerRoute) continue;
      const digest = this.groupCallRecordDigest(group);
      if (digest !== undefined) return digest;
    }
    return undefined;
  }

  /** The digest of the call a callee group runs, when its function settles a call record. */
  private groupCallRecordDigest(group: ExternalCallUtxoGroup): Uint8Array | undefined {
    const artifact = (group.logicalArtifact ?? group.externalContract?.inner?.artifact) as Artifact | undefined;
    const functionName = group.logicalFunctionName ?? group.functionName;
    const abiFunction = artifact?.abi.find((entry) => entry.name === functionName);
    if (!artifact || abiFunction?.callRecord !== true) return undefined;
    return callRecordDigest(abiFunction, group.logicalFunctionArgs ?? group.functionArgs, {
      structs: artifact.structs ?? artifact.stateLayout?.structs, enums: artifact.enums,
    });
  }

  /**
   * The raw result behind a direct call's record that a callee's covenant pinned, for the record's identity (this
   * builder's own call when omitted): its inline bytes, or the preimage of its hash taken where `trace` hashed it.
   * Anything else is returned as given.
   */
  rawOfReturnRecord(
    identity: string | undefined, commitment: Uint8Array, trace?: readonly AuthenticationProgramStateCommon[],
  ): Uint8Array {
    const digest = this.callRecordDigestFor(identity ?? this.categoryId);
    if (digest === undefined) return commitment;
    const record = parseCallRecord(commitment);
    if (record === undefined) return commitment;
    if (binToHex(record.digest) !== binToHex(digest)) {
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_RETURN === '1') {
        console.error('call-record-digest-mismatch', { identity, record: binToHex(record.digest), sdk: binToHex(digest) });
      }
      return commitment;
    }
    if (record.raw !== undefined) return record.raw;
    // A probe trace keeps only its introspection states; the result stays on their stacks until its record forms.
    const hash = binToHex(record.hash!);
    const seen = new Set<Uint8Array>();
    for (let at = (trace?.length ?? 0) - 1; at >= 0; at -= 1) {
      for (const item of trace![at]!.stack) {
        if (seen.has(item) || !callRecordHashesResult(item)) continue;
        seen.add(item);
        if (binToHex(sha256(item)) === hash) return item.slice();
      }
    }
    return commitment;
  }

  setReturnEventOutput(
    categoryId: string, commitment: Uint8Array, identity = categoryId, provisional = false,
    trace?: readonly AuthenticationProgramStateCommon[],
  ): this {
    // eslint-disable-next-line no-param-reassign
    commitment = this.rawOfReturnRecord(identity, commitment, trace);
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_FAILURE_RING === '1') {
      console.error('set-return-event-output', {
        identity, categoryId, commitment: binToHex(commitment),
      });
    }
    // A contract may be called more than once in one composed transaction.
    // Category identifies the token; identity identifies the call/return slot.
    const existing = this.pendingReturnEventOutputs.findIndex((r) => r.identity === identity);
    if (existing >= 0) {
      const previous = this.pendingReturnEventOutputs[existing];
      if (!shouldReplaceReturnEventCommitment(previous.provisional, provisional)) {
        return this;
      }
      // Keep an authenticated non-zero result over a later authenticated empty/all-zero write.
      // Failed probes otherwise erase soft-read / precomputed view returns (including rolled
      // meceTags(tags_[i]) string commitments) so nested requires observe length 0 / meceCount 0.
      if (previous.provisional === false && provisional === false
        && previous.commitment.length > 0 && !isAllZeroCommitment(previous.commitment)
        && (commitment.length === 0 || isAllZeroCommitment(commitment))) {
        return this;
      }
      this.pendingReturnEventOutputs[existing] = { categoryId, commitment, identity, provisional };
    } else {
      this.pendingReturnEventOutputs.push({ categoryId, commitment, identity, provisional });
    }
    // `external-call:N` and `external-call:N:0` are aliases for the first physical return part. Precomputed
    // seeding intentionally creates the numbered form before a participant probe can authenticate the whole-call
    // form. Keep an already-present counterpart synchronized once either alias becomes non-provisional, otherwise
    // in-block materialization can select the older provisional value simply because it was inserted first.
    if (!provisional) {
      const whole = /^external-call:(\d+)$/.exec(identity);
      const numbered = /^external-call:(\d+):0$/.exec(identity);
      const alias = whole ? `${identity}:0` : numbered ? `external-call:${numbered[1]}` : undefined;
      const aliasIndex = alias === undefined
        ? -1 : this.pendingReturnEventOutputs.findIndex((event) => event.identity === alias);
      if (aliasIndex >= 0) {
        if (shouldReplaceReturnEventCommitment(
          this.pendingReturnEventOutputs[aliasIndex].provisional,
          false,
        )) {
          this.pendingReturnEventOutputs[aliasIndex] = {
            categoryId, commitment, identity: alias!, provisional: false,
          };
        }
      }
    }
    return this;
  }

  /** Debug/derivation snapshot of pending return events without exposing mutable builder state. */
  getReturnEventOutputs(): ReadonlyArray<Readonly<{
    categoryId: string; commitment: Uint8Array; identity: string; provisional?: boolean;
  }>> {
    return this.pendingReturnEventOutputs.map((event) => ({
      ...event, commitment: event.commitment.slice(),
    }));
  }

  /** Physical output index recorded by the most recent build for a logical return identity. */
  getBuiltReturnEventOutputIndex(identity: string): number {
    return this.builtReturnEventOutputIndices.get(identity)
      ?? this.builtReturnEventOutputIndices.get(`${identity}:0`)
      ?? -1;
  }

  /** Physical output index recorded by the most recent build for an external-call group's first return. */
  getBuiltExternalCallReturnEventOutputIndex(groupIdx: number): number {
    const group = this.externalCallUtxoGroups[groupIdx];
    if (group && this.isInBlockReturnEventGroup(groupIdx)) {
      const physical = this.externalCallUtxoGroups[group.sharedGroupIndex ?? groupIdx];
      const offset = physical?.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent')?.offset;
      const master = this.findMintingInputIndex(physical.categoryId);
      if (master >= 0 && offset !== undefined) return master + offset;
    }
    const identity = `external-call:${this.returnRecordGroupIndex(groupIdx) === groupIdx
      || this.externalCallUtxoGroups[groupIdx]?.readonlyReturnSelector === undefined
      ? groupIdx : this.returnRecordGroupIndex(groupIdx)}`;
    if (this.isInBlockReturnEventGroup(groupIdx)) {
      return this.builtReturnEventOutputIndices.get(identity)
        ?? this.builtReturnEventOutputIndices.get(`${identity}:0`)
        ?? -1;
    }
    return this.builtReturnEventOutputIndices.get(`${identity}:0`)
      ?? this.builtReturnEventOutputIndices.get(identity)
      ?? -1;
  }

  /**
   * Remove all pending return event outputs (used before re-populating with derived values).
   */
  clearReturnEventOutputs(): this {
    this.pendingReturnEventOutputs = [];
    this.plannedReturnOutputIndex = -1;
    return this;
  }

  /**
   * Set a raw entry NFT commitment by slot index (from auto-derivation).
   */
  setEntryRawCommitment(slotIndex: number, commitment: string): this {
    if (!Number.isInteger(slotIndex) || slotIndex < 0) {
      throw new Error(`Invalid slot index ${slotIndex}: must be a non-negative integer`);
    }
    if (!/^([0-9a-f]{2})*$/i.test(commitment)) {
      throw new Error(`Invalid hex string for entry raw commitment at slot ${slotIndex}`);
    }
    this.entryRawCommitments.set(slotIndex, commitment);
    return this;
  }

  /** The raw entry NFT commitment currently planned for a slot's output, if any. */
  getEntryRawCommitment(slotIndex: number): string | undefined {
    return this.entryRawCommitments.get(slotIndex);
  }

  /** Mark an entry slot's commitment as known exactly (injected), so auto-derivation must not re-derive it. */
  pinEntrySlot(slotIndex: number): this { this.pinnedEntrySlots.add(slotIndex); return this; }

  /** Whether slot's commitment was pinned via pinEntrySlot (auto-derivation should skip it). */
  isEntrySlotPinned(slotIndex: number): boolean { return this.pinnedEntrySlots.has(slotIndex); }

  /**
   * Mark an entry slot whose output the spending route reads at a fixed block coordinate, so derivation must
   * never delete it. A sorted-batch lane is verified positionally against its own block offset, and the lane's
   * published batch witness - not the trace - says whether the lane is active: an active lane whose commitment
   * the probe never observed still owes the covenant its entry output.
   */
  requireEntryOutputSlot(slotIndex: number): this {
    if (!Number.isInteger(slotIndex) || slotIndex < 0) {
      throw new Error(`Invalid slot index ${slotIndex}: must be a non-negative integer`);
    }
    this.requiredEntryOutputSlots.add(slotIndex);
    return this;
  }

  /** Whether the spending route reads this entry slot's output at a fixed block coordinate. */
  isEntryOutputSlotRequired(slotIndex: number): boolean {
    return this.requiredEntryOutputSlots.has(slotIndex);
  }

  /**
   * Set the ordered chunk commitments for a dynamic-storage var (from auto-derivation). The number of
   * commitments determines how many trailing chunk NFT outputs are created.
   */
  setChunkRawCommitments(varName: string, commitments: string[]): this {
    const priorCount = (this.chunkRawCommitments.get(varName) ?? []).length;
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_CHUNK_GROW === '1'
      && (commitments.length >= 8 || (this.chunkRawCommitments.get(varName)?.length ?? 0) >= 8)) {
      const prev = this.chunkRawCommitments.get(varName)?.length ?? 0;
      console.error('chunk-grow', {
        varName,
        prev,
        next: commitments.length,
        unresolved: commitments.filter((c) => c === '00').length,
        sample: commitments.slice(0, 3).map((c) => c.slice(0, 24)),
        stack: new Error('chunk-grow').stack?.split('\n').slice(1, 8),
      });
    }
    this.chunkRawCommitments.set(varName, commitments);
    // A larger run needs balanced input slots before any following callee. Its output width is learned during
    // derivation, after initial input assembly, so rebuild the physical input order and its index witnesses.
    if (commitments.length !== priorCount && this.allInputs.length > 0
      && this.dynamicChunkInputs.length > 0 && this.externalCallUtxoGroups.length > 0
      && !this.compilerRouteDelegateBlock && !this.delegateEntriesAfterLowLevel) {
      this._refreshInputs();
    }
    return this;
  }

  getDynamicChunkVars(): Array<{
    name: string; type: string; lockingBytecode: Uint8Array; delegate?: boolean; delegateSuffix?: boolean;
  }> {
    return this.dynamicChunkVars;
  }

  getChunkRawCommitments(varName: string): string[] {
    return this.chunkRawCommitments.get(varName) ?? [];
  }

  /**
   * Output index where chunk NFTs begin: the block-layout blockSize (chunks are trailing outputs at
   * OP_INPUTINDEX + blockSize + i, matching the dynamic-write covenant). Falls back to the computed
   * trailing position when no block layout is present.
   */
  getChunkOutputBase(): number {
    // New write chunks come AFTER the preserved iteration-entry outputs (read-only co-spent chunks /
    // collection-iter entries), which occupy [blockSize, blockSize+count) to match their input indices.
    let base = this.blockLayout?.trailingBase
      ?? this.blockLayout?.blockSize
      ?? this.getEventOutputBase() + this.getEventOutputCount();
    // blockSize reserves the returnEvent slot, but an ordinary plain send compacts it. Runtime loop effects are
    // different: their authenticated trailing indices begin after the complete fixed block, so they keep the
    // inactive slot and the padding pass below materializes it before the effect stream.
    const hasReturnEventSlot = this.blockLayout?.slots.some((s) => s.kind === 'returnEvent') ?? false;
    if (this.blockLayout?.trailingBase === undefined
      && hasReturnEventSlot && this.pendingReturnEventOutputs.length === 0
      && this.runtimeLoopEventOutputs.length === 0 && this.runtimeLoopTransferOutputs.length === 0) base -= 1;
    // build() preserves low-level-call UTXOs before the trailing dynamic region.
    // Delegate bytecode likewise anchors trailing storage after its own co-spent
    // implementation block rather than overlapping that block's outputs.
    const lowLevelCallOutputCount = this.compilerRouteDelegateBlock
      ? 0
      : this.blockLayout?.slots.some((slot) => slot.kind === 'lowLevelCall')
        ? 0
        : this.lowLevelCallUtxoGroups.reduce(
          (sum, g) => sum + 1 + g.dataNftUtxos.length, 0,
        ) + this.lowLevelCallRawInputs.length;
    // External call blocks and their tail return events are emitted before local dynamic chunks, but they are
    // outside this function's blockLayout. Include their physical span so trace extraction observes the same
    // output indices that the compiler's dynamic-write covenant verifies.
    const externalCallOutputCount = this.externalCallUtxoGroups.reduce((sum, group) => {
      if (group.sharedGroupIndex !== undefined) return sum;
      return sum + (group.blockInputs?.length ?? 1 + group.dataNftUtxos.length);
    }, 0);
    const externalReturnOutputCount = this.tailReturnEventOutputs()
      .filter((returnEvent) => returnEvent.categoryId !== this.categoryId).length;
    // Old dynamic-storage chunks and the sorted-batch loop-alignment funder are co-spent BEFORE the nested
    // callee blocks (buildInputs places them between the owner block and the participants). They shift every
    // participant one coordinate right, so the trailing band must count them; otherwise the caller's loop-entry
    // base lands on the last participant output (MasterChef.deposit: poolInfo old chunk + userInfo alignment
    // funder push the LP block from offset 7 to 9, and userInfo HEAD then collides with the LP balances P').
    // Without external participants these resources sit directly at the ordinary trailing base, so they must
    // not be double-counted.
    const preCalleeDynamicChunkCount = externalCallOutputCount > 0 ? this.dynamicChunkInputs.length : 0;
    const loopAlignmentFunderCount = externalCallOutputCount > 0 && this.loopEntriesBeforeDynamicChunks
      ? Math.max(0, this._trailingLoopEntryOutputCount() - this.insertLoopPredecessorInputs.length)
      : 0;
    // Identity anchors are recreated AFTER the local dynamic-chunk run (repairNestedCalleeOutputs), so they do
    // not contribute to the coordinate where the trailing band begins.
    const trailingBase = base + externalCallOutputCount + externalReturnOutputCount
      + lowLevelCallOutputCount + this.iterationEntryInputs.length
      + preCalleeDynamicChunkCount + loopAlignmentFunderCount;
    if (this.delegateEntriesAfterLowLevel) {
      // Delegate-only loop entries are appended after the caller's reserved trailing block. They must not move
      // the caller's dynamic-chunk base into that delegate suffix; only local loop entries precede local chunks.
      return trailingBase + this._trailingLoopEntryOutputCount() + this._valueChunkOutputCount()
        + this.pendingOutputs.length;
    }
    // Compiler model: local dynamic-array chunks verify before chunkable
    // mapping-value continuations. Do not add nested jobEvents width here — that band is
    // shifted past this base in getChunkableValueWriteBand instead.
    return trailingBase
      + (!this.keccakLoopFollowsTrailingUser ? this.keccakLoopRecreates.length : 0)
      + (this.loopEntriesBeforeDynamicChunks ? this._trailingLoopEntryOutputCount() : 0)
      + this.runtimeLoopEventOutputs.length
      + this.runtimeLoopTransferOutputs.length;
  }

  private _dynamicChunkOutputCount(): number {
    if (this.delegateDynamicChunksAtSuffix) {
      const recovered = [...this.derivedChunkOutputs.values()].filter((chunk) =>
        (chunk.categoryId ?? this.categoryId) === this.categoryId);
      if (recovered.length > 0) return recovered.length;
    }
    let n = 0;
    for (const dv of this.dynamicChunkVars) n += (this.chunkRawCommitments.get(dv.name) ?? []).length;
    return n;
  }

  private _valueChunkOutputCount(): number {
    return this.valueChunkOutputs.length
      + [...this.valueChunkRawCommitments.values()].reduce((sum, commitments) => sum + commitments.length, 0);
  }

  /** First output occupied by the ordered runtime-loop event family. */
  getRuntimeLoopEventOutputBase(): number {
    if (this.runtimeLoopTrailingSegments.length > 0 && this.runtimeLoopEventOutputs.length > 0) {
      return this.getRuntimeLoopEventOutputIndex(0);
    }
    return this.getChunkOutputBase() - this.runtimeLoopTransferOutputs.length
      - this.runtimeLoopEventOutputs.length;
  }

  getRuntimeLoopEventOutputIndex(eventIndex: number): number {
    if (!Number.isSafeInteger(eventIndex) || eventIndex < 0 || eventIndex >= this.runtimeLoopEventOutputs.length) {
      throw new Error(`Invalid runtime loop event index ${eventIndex}`);
    }
    if (this.runtimeLoopTrailingSegments.length === 0) {
      return this.getChunkOutputBase() - this.runtimeLoopTransferOutputs.length
        - this.runtimeLoopEventOutputs.length + eventIndex;
    }
    if (this.kernelJournalSettlementOutputPlan.length > 0 || this.kernelJournalEagerOutputPlan.length > 0) {
      return this.getKernelJournalTrailingEffectOutputIndex('events', eventIndex);
    }
    let physical = this.getChunkOutputBase()
      - this._trailingLoopEntryOutputCount() - this.runtimeLoopEventOutputs.length
      - this.runtimeLoopTransferOutputs.length + this._runtimeLoopUnsegmentedEntryPrefixCount();
    let resolved: number | undefined;
    for (const segment of this.runtimeLoopTrailingSegments) {
      if (segment.kind === 'events'
        && eventIndex >= segment.offset && eventIndex < segment.offset + segment.count) {
        if (resolved !== undefined) {
          throw new Error(`Runtime loop event ${eventIndex} has multiple output locations`);
        }
        resolved = physical + eventIndex - segment.offset;
      }
      physical += segment.count;
    }
    if (resolved !== undefined) return resolved;
    throw new Error(`Runtime loop event ${eventIndex} is missing from the trailing segment plan`);
  }

  getRuntimeLoopTransferOutputIndex(transferIndex: number): number {
    if (!Number.isSafeInteger(transferIndex) || transferIndex < 0
      || transferIndex >= this.runtimeLoopTransferOutputs.length) {
      throw new Error(`Invalid runtime loop transfer index ${transferIndex}`);
    }
    if (this.runtimeLoopTrailingSegments.length === 0) {
      return this.getChunkOutputBase() - this.runtimeLoopTransferOutputs.length + transferIndex;
    }
    if (this.kernelJournalSettlementOutputPlan.length > 0 || this.kernelJournalEagerOutputPlan.length > 0) {
      return this.getKernelJournalTrailingEffectOutputIndex('transfers', transferIndex);
    }
    let physical = this.getChunkOutputBase()
      - this._trailingLoopEntryOutputCount() - this.runtimeLoopEventOutputs.length
      - this.runtimeLoopTransferOutputs.length + this._runtimeLoopUnsegmentedEntryPrefixCount();
    let resolved: number | undefined;
    for (const segment of this.runtimeLoopTrailingSegments) {
      if (segment.kind === 'transfers'
        && transferIndex >= segment.offset && transferIndex < segment.offset + segment.count) {
        if (resolved !== undefined) {
          throw new Error(`Runtime loop transfer ${transferIndex} has multiple output locations`);
        }
        resolved = physical + transferIndex - segment.offset;
      }
      physical += segment.count;
    }
    if (resolved !== undefined) return resolved;
    throw new Error(`Runtime loop transfer ${transferIndex} is missing from the trailing segment plan`);
  }

  getRuntimeLoopTransferOutputs(): ReadonlyArray<RuntimeLoopTransferOutput> {
    return this.runtimeLoopTransferOutputs;
  }

  setRuntimeLoopTransferOutput(index: number, lockingBytecode: Uint8Array, amount: bigint): this {
    if (!Number.isInteger(index) || index < 0 || index >= this.runtimeLoopTransferOutputs.length) {
      throw new Error(`Invalid runtime loop transfer index ${index}`);
    }
    if (amount < 0n) throw new Error('Derived runtime loop transfer amount must not be negative');
    this.runtimeLoopTransferOutputs[index] = {
      ...this.runtimeLoopTransferOutputs[index], lockingBytecode: Uint8Array.from(lockingBytecode), amount,
    };
    return this;
  }

  setRuntimeLoopNftTransferOutput(
    index: number,
    lockingBytecode: Uint8Array,
    commitment: Uint8Array,
    capability: 'none' | 'mutable' | 'minting',
  ): this {
    if (!Number.isInteger(index) || index < 0 || index >= this.runtimeLoopTransferOutputs.length) {
      throw new Error(`Invalid runtime loop NFT transfer index ${index}`);
    }
    if (this.runtimeLoopTransferOutputs[index].kind !== 'nft') {
      throw new Error(`Runtime loop transfer ${index} is not an NFT transfer`);
    }
    this.runtimeLoopTransferOutputs[index] = {
      ...this.runtimeLoopTransferOutputs[index],
      lockingBytecode: Uint8Array.from(lockingBytecode),
      commitment: Uint8Array.from(commitment),
      capability,
      amount: 0n,
    };
    return this;
  }

  getRuntimeLoopEventOutputs(): ReadonlyArray<{
    eventSignature: string; lockingBytecode: Uint8Array; categoryId?: string; commitment: string;
    rowIndex: number; chunked?: true; continuation?: true;
  }> {
    return this.runtimeLoopEventOutputs;
  }

  /**
   * Replace the planned records of the chunked row whose stream starts at output `base` with the ordered records
   * its effect verifier read there (`extractRuntimeEffectStreamRuns`). A record at a head lock the row planned
   * starts an event; any other continues the event before it. Returns whether the plan changed.
   */
  applyRuntimeLoopEventStream(
    base: number, records: readonly { commitment: string; lockingBytecode: Uint8Array }[],
  ): boolean {
    const outputs = this.runtimeLoopEventOutputs;
    let first = -1;
    try {
      first = outputs.findIndex((_output, index) => this.getRuntimeLoopEventOutputIndex(index) === base);
    } catch {
      return false;
    }
    if (first < 0 || records.length === 0) return false;
    const { rowIndex } = outputs[first];
    let end = first;
    while (end < outputs.length && outputs[end].rowIndex === rowIndex) end += 1;
    const planned = outputs.slice(first, end);
    if (!planned.every((output) => output.chunked)) return false;
    const heads = new Map(planned.filter((output) => !output.continuation)
      .map((output) => [binToHex(output.lockingBytecode), output]));
    const learned: typeof outputs = [];
    for (const record of records) {
      const head = heads.get(binToHex(record.lockingBytecode));
      const previous = learned.at(-1);
      if (head !== undefined) {
        learned.push({
          eventSignature: head.eventSignature, lockingBytecode: head.lockingBytecode,
          ...(head.categoryId !== undefined && { categoryId: head.categoryId }),
          commitment: record.commitment, rowIndex, chunked: true,
        });
      } else if (previous !== undefined) {
        learned.push({
          eventSignature: previous.eventSignature, lockingBytecode: Uint8Array.from(record.lockingBytecode),
          ...(previous.categoryId !== undefined && { categoryId: previous.categoryId }),
          commitment: record.commitment, rowIndex, chunked: true, continuation: true,
        });
      } else {
        return false;
      }
    }
    if (learned.length === planned.length && learned.every((output, index) =>
      output.commitment === planned[index].commitment
      && binToHex(output.lockingBytecode) === binToHex(planned[index].lockingBytecode))) return false;
    const segments = this.runtimeLoopTrailingSegments;
    const own = segments.find((segment) => segment.kind === 'events'
      && segment.offset === first && segment.count === planned.length);
    if (segments.length > 0 && own === undefined) return false;
    const delta = learned.length - planned.length;
    for (const segment of segments) {
      if (segment !== own && segment.kind === 'events' && segment.offset >= end) segment.offset += delta;
    }
    if (own !== undefined) own.count = learned.length;
    outputs.splice(first, planned.length, ...learned);
    return true;
  }

  setRuntimeLoopEventRawCommitment(index: number, commitment: string): this {
    if (!Number.isInteger(index) || index < 0 || index >= this.runtimeLoopEventOutputs.length) {
      throw new Error(`Invalid runtime loop event index ${index}`);
    }
    if (!/^([0-9a-f]{2})*$/i.test(commitment)) {
      throw new Error(`Invalid hex string for runtime loop event ${index}`);
    }
    this.runtimeLoopEventOutputs[index].commitment = commitment;
    return this;
  }

  getLoopEntryVars(): Array<{
    collection: string; lockingBytecode: Uint8Array; categoryId?: string; delegate?: boolean; chunkable?: boolean;
  }> {
    return this.loopEntryVars;
  }

  getLoopEntryCommitments(collection: string): string[] {
    return this.loopEntryCommitments.get(collection) ?? [];
  }

  /** Whether the compiler published source-row ownership for this collection's runtime trailing outputs. */
  hasRuntimeLoopEntrySegments(collection: string): boolean {
    return this.runtimeLoopTrailingSegments.some((segment) =>
      segment.kind === 'entries' && segment.collection === collection && segment.count > 0);
  }

  /** Resolve a collection-local commitment offset through the authenticated trailing segment plan. */
  private _getLoopEntryOutputIndexHost(): GetLoopEntryOutputIndexHost {
    return {
      kernelJournalSettlementOutputPlan: this.kernelJournalSettlementOutputPlan,
      kernelJournalEagerOutputPlan: this.kernelJournalEagerOutputPlan,
      runtimeLoopTrailingSegments: this.runtimeLoopTrailingSegments,
      loopEntryCommitments: this.loopEntryCommitments,
      validateKernelJournalSettlementOutputPlan: () => {
        this.validateKernelJournalSettlementOutputPlan();
      },
      kernelJournalOutputLayout: () => this.kernelJournalOutputLayout(),
      getLoopEntryOutputBase: () => this.getLoopEntryOutputBase(),
      trailingLoopEntryVars: () => this._trailingLoopEntryVars(),
    };
  }

  getLoopEntryOutputIndex(collection: string, commitmentIndex: number): number {
    return getLoopEntryOutputIndexImpl(
      this._getLoopEntryOutputIndexHost(),
      collection,
      commitmentIndex,
    );
  }

  setLoopEntryLockingBytecode(collection: string, lockingBytecode: Uint8Array): this {
    const variable = this.loopEntryVars.find((candidate) => candidate.collection === collection);
    if (!variable) throw new Error(`loop entry collection not registered: ${collection}`);
    variable.lockingBytecode = lockingBytecode;
    return this;
  }

  /**
   * Set the ordered entry commitments for a loop mapping write (from auto-derivation). The number of commitments
   * determines how many trailing entry NFT outputs are created (the runtime iteration count N).
   */
  setLoopEntryCommitments(collection: string, commitments: string[]): this {
    const required = this.requiredLoopEntryCounts.get(collection);
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_LOOP_ENTRY_LIFECYCLE === '1') {
      console.error('loop-entry-set', JSON.stringify({
        collection,
        requested: commitments.length,
        required,
        pinned: this.pinnedLoopEntries.has(collection),
        previous: (this.loopEntryCommitments.get(collection) ?? []).length,
        ...(commitments.length === 0 && {
          stack: (new Error().stack ?? '').split('\n').slice(1, 7).map((line) => line.trim()),
        }),
      }));
    }
    this.loopEntryCommitments.set(collection, required === undefined ? commitments : Array.from(
      { length: required }, (_, index) => commitments[index] ?? '00',
    ));
    return this;
  }

  requireLoopEntryCount(collection: string, count: number): this {
    this.requiredLoopEntryCounts.set(collection, count);
    const existing = this.loopEntryCommitments.get(collection);
    if (existing) {
      this.loopEntryCommitments.set(collection, Array.from(
        { length: count }, (_, index) => existing[index] ?? '00',
      ));
    }
    return this;
  }

  getRequiredLoopEntryCount(collection: string): number {
    return this.requiredLoopEntryCounts.get(collection) ?? 0;
  }

  private _loopEntryOutputCount(): number {
    let n = 0;
    for (const lv of this.loopEntryVars) n += (this.loopEntryCommitments.get(lv.collection) ?? []).length;
    return n;
  }

  /** Runtime mapping entries physically owned by this builder's balanced trailing frame. */
  private _trailingLoopEntryVars(): typeof this.loopEntryVars {
    return this.loopEntryVars.filter((variable) => (
      (variable.categoryId === undefined || variable.categoryId === this.categoryId)
      // Legacy delegates own a transaction suffix outside the caller's block. A compiler-routed delegate instead
      // executes against the authenticated participant owner, so its resources belong to that participant's frame.
      && (variable.delegate !== true || this.compilerRouteDelegateBlock)
    ));
  }

  private _trailingLoopEntryOutputCount(): number {
    let n = 0;
    for (const lv of this._trailingLoopEntryVars()) {
      n += (this.loopEntryCommitments.get(lv.collection) ?? []).length;
    }
    return n;
  }

  /** Number of mapping-entry outputs owned by this builder's balanced trailing frame. */
  getTrailingLoopEntryOutputCount(): number {
    return this._trailingLoopEntryOutputCount();
  }

  /**
   * First output index past this frame's own trailing band (loop entries, dynamic/value chunks, identity
   * anchors, runtime effects). A nested callee's trailing predecessor must resolve at or after this
   * coordinate: the caller materializes its own trailing resources first, so a callee whose PredOut names a
   * coordinate inside that band reads the caller's entry instead of its own.
   */
  getCallerTrailingBandEnd(): number {
    let end = this.getChunkOutputBase();
    end += this._dynamicChunkOutputCount();
    end += this._valueChunkOutputCount();
    end += this.externalIdentityAnchorUtxos.length + (this.logicalIdentityUtxo ? 1 : 0);
    end += this.runtimeLoopEventOutputs.length + this.runtimeLoopTransferOutputs.length;
    end += this.keccakLoopRecreates.length;
    return end;
  }

  /**
   * The SDK derives this plan, but its coordinates must still be canonical before they decide output placement.
   * The route final flush independently authenticates each selected record against the resulting output.
   */
  private validateKernelJournalSettlementOutputPlan(): void {
    this.kernelJournalOutputLayout();
  }

  /** Compose the explicit eager prefix and deferred dense band without deriving either from commitment order. */
  private kernelJournalOutputLayout(): KernelEntryJournalOutputLayoutPlan {
    return planKernelEntryJournalOutputLayout(
      this.kernelJournalEagerOutputPlan,
      this.kernelJournalSettlementOutputPlan,
    );
  }

  /** Runtime effects retain source order, but always follow the complete `E + D` journal entry band. */
  private getKernelJournalTrailingEffectOutputIndex(
    kind: 'events' | 'transfers', effectIndex: number,
  ): number {
    const layout = this.kernelJournalOutputLayout();
    let physical = this.getLoopEntryOutputBase() + layout.finalOutputCursorDelta;
    let resolved: number | undefined;
    for (const segment of this.runtimeLoopTrailingSegments) {
      if (segment.kind === 'entries') continue;
      if (segment.kind === kind
        && effectIndex >= segment.offset && effectIndex < segment.offset + segment.count) {
        if (resolved !== undefined) {
          throw new Error(`Runtime loop ${kind} output ${effectIndex} has multiple output locations`);
        }
        resolved = physical + effectIndex - segment.offset;
      }
      physical += segment.count;
    }
    if (resolved === undefined) {
      throw new Error(`Runtime loop ${kind} output ${effectIndex} is missing from the trailing segment plan`);
    }
    return resolved;
  }

  /** Entry outputs preceding the source-ordered segment stream, including same-collection fixed prefixes. */
  private _runtimeLoopUnsegmentedEntryPrefixCount(): number {
    const firstSegmentOffsets = new Map<string, number>();
    for (const segment of this.runtimeLoopTrailingSegments) {
      if (segment.kind !== 'entries') continue;
      const prior = firstSegmentOffsets.get(segment.collection);
      if (prior === undefined || segment.offset < prior) firstSegmentOffsets.set(segment.collection, segment.offset);
    }
    return this._trailingLoopEntryVars().reduce((count, variable) => {
      const commitments = this.loopEntryCommitments.get(variable.collection) ?? [];
      return count + (firstSegmentOffsets.get(variable.collection) ?? commitments.length);
    }, 0);
  }

  private _delegateLoopEntryVars(): typeof this.loopEntryVars {
    return delegateLoopEntryVars(this._delegateLoopEntriesHost()) as typeof this.loopEntryVars;
  }

  /**
   * A runtime mapping loop emits both recreations (an UPDATE or re-pointed predecessor P') and genuinely new
   * entries through the same trailing commitment list. Match recreations by their authenticated entry slot and
   * covenant address so they retain the consumed NFT's satoshis; only NEW entries should be funded at dust.
   */
  private _loopEntryTransitionSatoshis(
    variable: (typeof this.loopEntryVars)[number], commitment: string,
  ): bigint | undefined {
    return loopEntryTransitionSatoshis(this._delegateLoopEntriesHost(), variable, commitment);
  }


  /**
   * Output index where loop entry NFTs begin. They share the trailing region with dynamic chunks (mutually
   * exclusive in a given function by construction), placed after any chunk outputs. A compiler-routed delegate
   * executes against its authenticated participant owner, so its loop entries remain inside that owner's declared
   * trailing region; the `delegate` marker selects token ownership, not a transaction-suffix placement policy.
   */
  getLoopEntryOutputBase(): number {
    if (this.loopEntriesBeforeDynamicChunks) {
      if (this.runtimeLoopTrailingSegments.length > 0) {
        return this.getChunkOutputBase()
          - this._trailingLoopEntryOutputCount() - this.runtimeLoopEventOutputs.length
          - this.runtimeLoopTransferOutputs.length;
      }
      // Legacy direct loops co-spend their predecessor before a nested callee. The compiler verifies the
      // predecessor recreation at that input's output coordinate; the later callee block must not move it.
      // An old chunk of a dynamic array this call writes, co-spent ahead of the predecessor, compacts that
      // coordinate by one: the array's replacement run is published at the suffix, after the entries, so the
      // covenant's output base (emitTrailingWriteOutputBase) counts it on the input side only.
      const inputIndexOf = (utxo: UnlockableUtxo): number => this.allInputs.findIndex((input) => (
        input.txid.toLowerCase() === utxo.txid.toLowerCase() && input.vout === utxo.vout));
      const predecessorIndices = this.insertLoopPredecessorInputs.map(inputIndexOf).filter((index) => index >= 0);
      if (predecessorIndices.length > 0) {
        const firstPredecessor = Math.min(...predecessorIndices);
        const writtenChunksBefore = this.dynamicChunkInputs.filter((chunk) => {
          const index = inputIndexOf(chunk);
          return index >= 0 && index < firstPredecessor;
        }).length;
        // The predecessor input keeps the returnEvent funder pad, but a plain returning call materializes no
        // output there: the covenant compacts its output base by one (emitTrailingWriteOutputBase). The entry
        // recreations occupy those compacted coordinates, matching the delegate path's mapPredToCompactedOutput.
        const returnEventOffset = this.blockLayout?.slots
          .find((slot) => slot.kind === 'returnEvent')?.offset;
        const compact = this._unmaterializedReturnEventCompact(this.blockLayout);
        const base = firstPredecessor - writtenChunksBefore;
        return compact > 0 && base > (returnEventOffset ?? 0) ? base - compact : base;
      }
      return this.getRuntimeLoopEventOutputBase() - this._trailingLoopEntryOutputCount();
    }
    if (this.delegateEntriesAfterLowLevel) {
      return this.getChunkOutputBase() - this.pendingOutputs.length
        - this._valueChunkOutputCount() - this._loopEntryOutputCount();
    }
    return this.getChunkOutputBase() + this._dynamicChunkOutputCount();
  }

  /**
   * Set a raw event NFT commitment by emit index (from auto-derivation).
   */
  setEventRawCommitment(emitIndex: number, commitment: string): this {
    if (!Number.isInteger(emitIndex) || emitIndex < 0) {
      throw new Error(`Invalid emit index ${emitIndex}: must be a non-negative integer`);
    }
    if (!/^([0-9a-f]{2})*$/i.test(commitment)) {
      throw new Error(`Invalid hex string for event raw commitment at emit index ${emitIndex}`);
    }
    this.eventRawCommitments.set(emitIndex, commitment);
    return this;
  }

  /** The raw event payload learned so far for an emit index, if any. */
  getEventRawCommitment(emitIndex: number): string | undefined {
    return this.eventRawCommitments.get(emitIndex);
  }

  /** Payload bytes one event NFT commitment carries for this contract (its commitment limit). */
  getEventChunkBytes(): number {
    return this.stateLayout.commitmentLimit ?? EVENT_CHUNK_BYTES;
  }

  /**
   * Add an event placeholder for probe transactions (empty commitment).
   */
  addEventPlaceholder(eventSignature: string, emitIndex: number): this {
    this.pendingEventPlaceholders.push({ eventSignature, emitIndex });
    return this;
  }

  /**
   * Set the maximum fee in satoshis for the transaction.
   */
  setMaximumFeeSatoshis(maxFee: bigint): void {
    this._maximumFeeSatoshis = maxFee;
  }

  /**
   * Get the master input index for an external outState group.
   */
  getExternalOutStateMasterInputIndex(groupIdx: number): number {
    let base = 1 + this.dataNftUtxos.length + this.frontRegionAuxiliaryWidth();
    for (let i = 0; i < groupIdx; i++) {
      base += 1 + this.externalOutStateUtxoGroups[i].dataNftUtxos.length
        + (this.externalOutStateUtxoGroups[i].blockhashCoSpendUtxos?.length ?? 0)
        + (this.externalOutStateUtxoGroups[i].keccakInputs?.length ?? 0);
    }
    return base;
  }

  /**
   * Get the output index where outState group's master NFT output starts.
   */
  getExternalOutStateOutputBase(groupIdx: number): number {
    let base = 1 + this.requiredNftIndices.length + this.frontRegionAuxiliaryWidth();
    for (let i = 0; i < groupIdx; i++) {
      base += 1 + this.externalOutStateUtxoGroups[i].dataNftUtxos.length
        + (this.externalOutStateUtxoGroups[i].blockhashCoSpendUtxos?.length ?? 0)
        + (this.externalOutStateUtxoGroups[i].keccakInputs?.length ?? 0);
    }
    return base;
  }

  /**
   * Get the master input index for an external call group.
   */
  /**
   * Absolute input index of a co-spent callee identity anchor, by its position in the anchor band. Resolved from
   * the materialized input list rather than reconstructed from band widths: the anchors are appended last, after
   * every layout-driven band, so only the built ordering is authoritative.
   */
  getIdentityAnchorInputIndex(anchorIdx: number): number {
    const anchor = this.externalIdentityAnchorUtxos[anchorIdx];
    if (!anchor) return -1;
    return this.allInputs.findIndex((input) => input !== undefined
      && input.txid === anchor.txid && input.vout === anchor.vout);
  }

  /** Locate one co-spent immutable CREATE identity by its authenticated token category. */
  getIdentityAnchorInputIndexByCategory(categoryId: string): number {
    return findScidAnchorInputIndex(this.allInputs, categoryId);
  }

  /**
   * The assembled input index of a callee group's own recorded master UTXO, or -1 when that UTXO was never placed.
   * Unlike `getExternalCallMasterInputIndex` this never reconstructs a coordinate from band widths, so callers can
   * tell an authoritative materialized coordinate from a dense estimate.
   */
  findMaterializedMasterInput(groupIdx: number): number {
    const master = this.externalCallUtxoGroups[groupIdx]?.masterUtxo;
    if (master === undefined) return -1;
    return this.allInputs.findIndex((input) => input !== undefined
      && input.txid === master.txid && input.vout === master.vout);
  }

  getExternalCallMasterInputIndex(groupIdx: number): number {
    // Resolve an already-positioned master directly. This is authoritative for
    // delegate graphs, where implementation bands are interleaved with nested
    // callees and cannot be reconstructed from dense resource counts.
    const master = this.externalCallUtxoGroups[groupIdx]?.masterUtxo;
    const found = master && this.allInputs.findIndex((input) => input.txid === master.txid
      && input.vout === master.vout);
    if (found !== undefined && found >= 0) return found;
    let base = 1 + this.dataNftUtxos.length + this.frontRegionAuxiliaryWidth();
    // Skip outState inputs
    for (const g of this.externalOutStateUtxoGroups) {
      base += 1 + g.dataNftUtxos.length + (g.blockhashCoSpendUtxos?.length ?? 0)
        + (g.keccakInputs?.length ?? 0);
    }
    // A chunk run co-spent BEFORE the callees (see iterationChunksPrecedeCallees) shifts them by its count.
    if (this.iterationChunksPrecedeCallees()) base += this.iterationEntryInputs.length;
    for (let i = 0; i < groupIdx; i++) {
      const g = this.externalCallUtxoGroups[i];
      base += (g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length)
        + (g.ordinaryDynamicChunkInputs?.length ?? 0);
    }
    return base;
  }

  /**
   * Whether the assembled frame co-spends the read-only chunk run (`iterationEntryInputs`) BEFORE the
   * external-call callee blocks. The legacy order does, and so does a block whose own trailing slots carry the
   * run; dense placement otherwise keeps the caller's complete block first and appends the callee blocks ahead
   * of the run (see buildInputs). Everything planned around the callees must follow the frame actually built:
   * each read-only chunk's covenant pins output == input, and each callee re-creates its master at its own
   * input index, so a chunk copy planned on the wrong side of the callees is overwritten by them.
   */
  iterationChunksPrecedeCallees(): boolean {
    if (this.iterationEntryInputs.length === 0 || this.externalCallUtxoGroups.length === 0) return false;
    const inputIndexOf = (utxo: { txid: string; vout: number } | undefined): number => (utxo === undefined
      ? -1
      : this.allInputs.findIndex((input) => input !== undefined
        && input.txid.toLowerCase() === utxo.txid.toLowerCase() && input.vout === utxo.vout));
    const chunkInputs = this.iterationEntryInputs.map(inputIndexOf).filter((index) => index >= 0);
    const calleeInputs = this.externalCallUtxoGroups
      .filter((group) => group.sharedGroupIndex === undefined)
      .map((group) => inputIndexOf(group.masterUtxo))
      .filter((index) => index >= 0);
    // Nothing placed on one side yet: keep the legacy reading, the order every pre-dense frame used.
    if (chunkInputs.length === 0 || calleeInputs.length === 0) return true;
    return Math.min(...chunkInputs) < Math.min(...calleeInputs);
  }

  /**
   * Get the output index where external call group's master NFT output starts.
   * Output layout: master(1) + A's dataNfts + A's readOnlyNfts + preceding groups' (1+dataNfts).
   */
  getExternalCallOutputBase(groupIdx: number): number {
    const requested = this.externalCallUtxoGroups[groupIdx];
    if (requested?.sharedGroupIndex !== undefined) groupIdx = requested.sharedGroupIndex;
    const physical = this.externalCallUtxoGroups[groupIdx];
    if (physical?.blockLayout) {
      // build() pads a full participant block up to its physical master-input coordinate. Return/event/state
      // derivation must address that same output coordinate; the dense resource-count formula below can be one
      // or more slots earlier when routed delegate/identity bands exist only on the input side.
      const aligned = this.getExternalCallMasterInputIndex(groupIdx);
      if (aligned >= 0) return aligned;
    }
    let base = 1 + this.requiredNftIndices.length + this.frontRegionAuxiliaryWidth();
    // Skip outState outputs
    for (const g of this.externalOutStateUtxoGroups) {
      base += 1 + g.dataNftUtxos.length + (g.blockhashCoSpendUtxos?.length ?? 0)
        + (g.keccakInputs?.length ?? 0);
    }
    // The read array's chunk preservation outputs precede the callee outputs only when its inputs precede the
    // callees (see build()), shifting them by the chunk count.
    if (this.iterationChunksPrecedeCallees()) base += this.iterationEntryInputs.length;
    const associatedDelegates = new Set(this.externalCallUtxoGroups
      .map((group) => group.delegateCallGroupIndex)
      .filter((index): index is number => index !== undefined));
    if (this.delegateEntriesAfterLowLevel) {
      base += this.pendingReturnEventOutputs.filter((r) => r.categoryId === this.categoryId).length;
      this.lowLevelCallUtxoGroups.forEach((group, index) => {
        if (group.callMode === 'delegatecall' && !associatedDelegates.has(index)) {
          base += 1 + group.dataNftUtxos.length;
        }
      });
    }
    for (let i = 0; i < groupIdx; i++) {
      const g = this.externalCallUtxoGroups[i];
      if (g.sharedGroupIndex !== undefined) continue;
      // Use full block size when available
      base += g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length;
      // A proxied participant's implementation output follows that participant block in both the legacy and
      // compiler-route layouts. Compiler routes move the implementation INPUT into a leading band, but their
      // outputs remain interleaved; omitting it makes every later participant output base one slot too low.
      if (g.delegateCallGroupIndex !== undefined && !g.delegateEmbeddedInBlock) {
        const delegate = this.lowLevelCallUtxoGroups[g.delegateCallGroupIndex];
        if (delegate?.callMode === 'delegatecall') base += 1 + delegate.dataNftUtxos.length;
      }
    }
    return base;
  }

  /**
   * Get the master input index for a low-level call group.
   */
  getLowLevelCallUtxoGroups(): readonly ExternalCallUtxoGroup[] {
    return this.lowLevelCallUtxoGroups;
  }

  getExternalCallUtxoGroups(): readonly ExternalCallUtxoGroup[] {
    return this.externalCallUtxoGroups;
  }

  /** Exact active persisted continuation; null means compiler metadata was present but ambiguous/hostile. */
  private _persistedValueChunkWrite(categoryId?: string): ValueChunkWriteDescriptor | null | undefined {
    const writes = [...this.externalCallUtxoGroups, ...this.lowLevelCallUtxoGroups]
      .flatMap((group) => group.valueChunkWrites ?? [])
      .filter((write) => categoryId === undefined || write.categoryId === categoryId);
    if (writes.length === 0) return undefined;
    return selectPersistedValueChunkWrite(
      writes, categoryId, this.valueChunkWriteStagingSession,
    ) ?? null;
  }

  /** Executing contract's 35-byte locking bytecode, when this builder can bind a value chunk to it. */
  ownerMasterLock(): Uint8Array | undefined {
    const lock = this.masterUtxo?.lockingBytecode;
    return lock?.length === 35 ? lock : undefined;
  }

  /** The top-level contract's token category: the physical state owner a direct delegatecall writes into. */
  get rootCategoryId(): string {
    return this.categoryId;
  }

  /** Resolve an exact collection lock, retaining schema inference only for descriptor-free legacy plans. */
  private _persistValueChunkLock(
    categoryId?: string, value?: Uint8Array,
  ): Uint8Array | undefined {
    const write = this._persistedValueChunkWrite(categoryId);
    const owner = (write?.categoryId ?? categoryId)?.toLowerCase();
    const masterLock = this.ownerMasterLock();
    if (!masterLock) return undefined;
    if (owner && owner !== this.categoryId.toLowerCase()) return undefined;
    const exact = persistValueChunkLock(categoryId, value, write, masterLock);
    if (exact || write !== undefined) return exact;
    if (this._hasChunkableValueWriteMetadata() || !this._permitsLegacyNamedValueChunkFallback()) {
      return undefined;
    }
    return legacyJobEventsPersistValueChunkLock(categoryId, value, masterLock);
  }

  /** Exact staged value, with category-wide storage retained only for descriptor-free legacy plans. */
  private _stagedValueChunkWrite(categoryId?: string): Uint8Array | undefined {
    const selection = this._valueChunkWriteCategorySelection();
    if (selection.status === 'exact') {
      if (categoryId !== undefined
        && selection.write.categoryId.toLowerCase() !== categoryId.toLowerCase()) return undefined;
      return stagedValueChunkWrite(selection.write, this.valueChunkWriteStagingSession);
    }
    if (selection.status === 'ambiguous' || this._hasChunkableValueWriteMetadata()
      || !this._permitsLegacyNamedValueChunkFallback()) return undefined;
    // Descriptor-free compatibility storage still needs a selected owner; insertion order is not authority.
    return categoryId ? settlement().stagedJobEventsValues.get(categoryId) : undefined;
  }

  /** Exact committed value, with category-wide storage retained only for descriptor-free legacy plans. */
  private _persistedValueChunkValue(categoryId?: string): Uint8Array | undefined {
    const selection = this._valueChunkWriteCategorySelection();
    if (selection.status === 'exact') {
      if (categoryId !== undefined
        && selection.write.categoryId.toLowerCase() !== categoryId.toLowerCase()) return undefined;
      return isValueChunkWriteReady(selection.write)
        ? persistedValueChunkWriteState(selection.write)?.value : undefined;
    }
    if (selection.status === 'ambiguous' || this._hasChunkableValueWriteMetadata()
      || !this._permitsLegacyNamedValueChunkFallback()) return undefined;
    return categoryId ? persistedJobEventsValue(categoryId) : undefined;
  }

  /** Exact descriptor path, with the historical schema available only to descriptor-free legacy plans. */
  private _persistUpdateDigestLock(categoryId?: string): Uint8Array | undefined {
    const write = this._persistedValueChunkWrite(categoryId);
    if (write) return persistUpdateDigestLock(categoryId, this._persistDigestCategories(), write);
    if (write === null || this._hasChunkableValueWriteMetadata()
      || !this._permitsLegacyNamedValueChunkFallback()) return undefined;
    return legacyJobEventsPersistUpdateDigestLock(categoryId);
  }

  getLowLevelCallMasterInputIndex(groupIdx: number): number {
    const target = this.lowLevelCallUtxoGroups[groupIdx]?.masterUtxo;
    if (target) {
      const exact = this.allInputs.findIndex((input) => input?.txid.toLowerCase() === target.txid.toLowerCase()
        && input.vout === target.vout);
      if (exact >= 0) return exact;
    }
    if (this.lowLevelCallInputBase !== undefined) {
      let positionedBase = this.lowLevelCallInputBase;
      for (let i = 0; i < groupIdx; i++) {
        positionedBase += 1 + this.lowLevelCallUtxoGroups[i].dataNftUtxos.length;
      }
      return positionedBase;
    }
    let base = 1 + this.dataNftUtxos.length + this.frontRegionAuxiliaryWidth();
    // Skip outState inputs
    for (const g of this.externalOutStateUtxoGroups) {
      base += 1 + g.dataNftUtxos.length + (g.blockhashCoSpendUtxos?.length ?? 0)
        + (g.keccakInputs?.length ?? 0);
    }
    // Skip external call inputs (use full block size when available)
    for (const g of this.externalCallUtxoGroups) {
      base += (g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length)
        + (g.ordinaryDynamicChunkInputs?.length ?? 0);
    }
    // Skip the main block's output-only funder inputs (event/transfer): they sit inside the proxy block,
    // before the low-level call inputs. A delegatecall'd impl that emits events reserves such slots here.
    for (const s of this.blockLayout?.slots ?? []) {
      if (s.kind === 'event' || s.kind === 'eventChunk' || s.kind === 'transfer' || s.kind === 'tcTransfer'
        || (s.kind === 'entry' && !this.delegateEntriesAfterLowLevel)) base += 1;
    }
    // Skip preceding low-level call groups
    for (let i = 0; i < groupIdx; i++) {
      base += 1 + this.lowLevelCallUtxoGroups[i].dataNftUtxos.length;
    }
    return base;
  }

  /**
   * Build and finalize the transaction, creating data NFT outputs with updated commitments.
   * This method is idempotent - each call creates a fresh TransactionBuilder.
   */
  /**
   * Configure the external-library side-car UTXO to co-spend (appended as the last input by build()).
   * blob = the library script; salt = the contract's token category (branded) or zero (shared). Must be
   * called before auto-derivation so the derivation probes include the side-car.
   */
  setSidecar(utxo: Utxo, blob: Uint8Array, salt: Uint8Array): void {
    const redeem = buildSidecarRedeem(blob, salt);
    const lock = sidecarLockingBytecode(blob, salt);
    this.sidecarUtxo = {
      ...utxo,
      unlocker: {
        generateUnlockingBytecode: () => scriptToBytecode([redeem]),
        generateLockingBytecode: () => lock,
      },
    };
  }

  /** Optional nLocktime for the final tx, e.g. the block.* freshness `require(tx.time >= number)`. */
  locktimeOverride?: number;

  setLocktime(locktime: number): this {
    this.locktimeOverride = locktime;
    return this;
  }

  addInput(utxo: Utxo, unlocker: Unlocker): this {
    const already = this.allInputs.some((input) => input.txid === utxo.txid && input.vout === utxo.vout);
    if (!already) this.allInputs.push({ ...utxo, unlocker });
    return this;
  }

  build(): TransactionBuilder {
    if (this.emitReassertAllowed === undefined) {
      this.emitReassertAllowed = this._isPersistedChunkableValueWriteReady()
        && !this._isInitialChunkableValueWrite();
    }
    this.builtReturnEventOutputIndices.clear();
    const early = runBuildEarlyFrontImpl(this._runBuildEarlyFrontHost());
    const result = runBuildMidLateThroughTailImpl(
      this._runBuildMidLateThroughTailHost(),
      early,
    );
    if (result === 'rebuild') {
      return this.build();
    }
    return result;
  }

  /**
   * JobEvents occupancy is only final after the first materialization. If planned
   * view-tail witnesses still name a mutable collection slot, pack them after that
   * band and refresh unlockers for one rematerialize. Does not move the value-chunk suffix.
   */
  private _repackViewTailsAfterMaterialization(builder: TransactionBuilder): boolean {
    return repackViewTailsAfterMaterialization(this._repackViewTailsHost(), builder);
  }

  /** Copy refreshed unlockers onto an already-materialized TransactionBuilder. */
  private _syncBuilderUnlockers(builder: TransactionBuilder): void {
    syncBuilderUnlockers(this._refreshedUnlockerSyncHost(), builder);
  }

  /** Mirror refreshed carrier masters into both the flattened and materialized input lists. */
  private _syncRefreshedCarrierMasters(
    builder: TransactionBuilder,
    carriers: Iterable<ExternalCallUtxoGroup>,
  ): void {
    syncRefreshedCarrierMasters(this._refreshedUnlockerSyncHost(), builder, carriers);
  }

  /** Rebind each participant data-NFT covenant to its master in the final physical input order. */
  /** Rebind each participant data-NFT covenant to its master in the final physical input order. */
  private _reconcileMaterializedDataNftUnlockers(builder: TransactionBuilder): boolean {
    return reconcileMaterializedDataNftUnlockers(this._materializedNftUnlockerReconcileHost(), builder);
  }

  /** Rebind write-path entry covenants to their state owner's final physical minting-master input. */
  /** Rebind write-path entry covenants to their state owner's final physical minting-master input. */
  private _reconcileMaterializedEntryNftUnlockers(builder: TransactionBuilder): boolean {
    return reconcileMaterializedEntryNftUnlockers(this._materializedNftUnlockerReconcileHost(), builder);
  }

  /** Rebind hidden callee-master arguments from the final physical input order. */
  /** Rebind hidden callee-master arguments from the final physical input order. */
  private _reconcileMaterializedInputWitnesses(builder: TransactionBuilder): boolean {
    return reconcileMaterializedInputWitnesses(this._materializedNftUnlockerReconcileHost(), builder);
  }

  /** Rebase absolute predecessor-output witnesses from each participant's final physical master coordinate. */
  /** Rebase absolute predecessor-output witnesses from each participant's final physical master coordinate. */
  private _reconcileMaterializedPredOutWitnesses(builder: TransactionBuilder): boolean {
    return reconcileMaterializedPredOutWitnesses(this._materializedPredOutReconcileHost(), builder);
  }

  /** Reconcile materialized predecessor outputs with the same final physical masters as their witnesses. */
  /** Reconcile materialized predecessor outputs with the same final physical masters as their witnesses. */
  private _reassertMaterializedBatchPredecessorOutputs(builder: TransactionBuilder): boolean {
    return reassertMaterializedBatchPredecessorOutputs(this._materializedPredOutReconcileHost(), builder);
  }

  /** Rebind return-index arguments after every output owner has materialized. */
  /** Rebind return-index arguments after every output owner has materialized. */
  private _reconcileMaterializedReturnWitnesses(builder: TransactionBuilder): boolean {
    return reconcileMaterializedReturnWitnesses(this._materializedReturnWitnessReconcileHost(), builder);
  }

  /** Linear in-block sorted batches expect exactly their compiler-owned entry nodes. Trailing clones which reuse
   * those locks (misdetected P' nextKey changes) break output cardinality. */
  /** Linear in-block sorted batches expect exactly their compiler-owned entry nodes. Trailing clones which reuse
   * those locks (misdetected P' nextKey changes) break output cardinality. */
  private _stripSurplusLinearBatchEntryClones(builder: TransactionBuilder): void {
    stripSurplusLinearBatchEntryClones(this._stripSurplusLinearBatchHost(), builder);
  }

  /** Reassert compiler-described sorted-batch INSERT and UPDATE entry geometry without shifting output tails. */
  private _reassertTokenInsertNewLocks(builder: TransactionBuilder): void {
    reassertTokenInsertNewLocks(this._tokenInsertNewLocksHost(), builder);
  }

  /**
   * Enforce the cardinality of a compiler-declared collection write after all
   * output materializers have run. Absolute trace pins are provisional: once
   * one is proven to be outside the declared NEW/UPDATE/predecessor coordinates,
   * discard it together with the surplus output so a later fixed-point pass
   * cannot replay the same clone.
   */
  private _enforceDeclaredCollectionOutputCardinality(builder: TransactionBuilder): void {
    enforceDeclaredCollectionOutputCardinality(this._declaredCollectionCardinalityHost(), builder);
  }

  /**
   * Minting inputs are 1:1. Token-container spend checks
   * OUTPUTVALUE/AMOUNT >= UTXOVALUE/AMOUNT at INPUTINDEX; a dust-sized
   * duplicate minting at that index fails FakeToken.transferFrom.
   */
  private _reassertMintingOneToOne(builder: TransactionBuilder): void {
    reassertMintingOneToOne(this._mintingOneToOneHost(), builder);
  }

  /**
   * True when dense placement will put a container UTXO at the published satoshi slot.
   * Funder accounting must not also reserve a neutral input for that same slot.
   */
  hasLoadedSatoshiContainer(): boolean {
    return this.satoshiContainerUtxo !== undefined;
  }

  /**
   * Check if the satoshi container is fully drained (all satoshis transferred out).
   */
  isSatoshiContainerDrained(): boolean {
    if (!this.satoshiContainerUtxo) return false;
    const total = this.pendingTransfers
      .filter((t) => t.lockingBytecode.length > 0)
      .reduce((sum, t) => sum + t.amount, 0n)
      + this.runtimeLoopTransferOutputs
        .filter((transfer) => (transfer.kind ?? 'bch') === 'bch')
        .reduce((sum, transfer) => sum + transfer.amount, 0n);
    return total >= this.satoshiContainerUtxo.satoshis + this.containerDepositAmount;
  }

  /**
   * Check if a token container is fully drained (all FTs transferred + NFT transferred if present).
   */
  isTokenContainerDrained(categoryId: string): boolean {
    const container = this.tokenContainers.find((c) => c.tokenContainerCategoryId === categoryId);
    if (!container?.exists || !container?.utxo) return false;
    const ftTransferred = this.pendingTokenContainerTransfers
      .filter((t) => t.tokenContainerCategoryId === categoryId)
      .reduce((sum, t) => sum + t.amount, 0n)
      + this.runtimeLoopTransferOutputs
        .filter((transfer) => transfer.kind === 'token'
          && transfer.tokenContainerCategoryId === categoryId)
        .reduce((sum, transfer) => sum + transfer.amount, 0n);
    const nftTransferred = this.pendingTokenContainerTransferNfts
      .some((t) => t.tokenContainerCategoryId === categoryId)
      || this.runtimeLoopTransferOutputs.some((transfer) => transfer.kind === 'nft'
        && transfer.tokenContainerCategoryId === categoryId);
    const inputFt = container.utxo.token?.amount ?? 0n;
    if (ftTransferred > inputFt) {
      throw new Error(
        `Total fungible token transfer amount (${ftTransferred}) `
        + `exceeds token container balance (${inputFt}) `
        + `for category ${categoryId}`,
      );
    }
    // A minting NFT mints the sent NFT and stays, so its container never drains.
    const nft = container.utxo.token?.nft;
    return (inputFt - ftTransferred === 0n) && (nft === undefined || (nftTransferred && nft.capability !== 'minting'));
  }

  /**
   * Get the bitmask of token container output flags (which slots have outputs).
   * Slots with drained containers have bit = 0.
   */
  getTokenContainerOutputFlags(): bigint {
    let flags = 0n;
    for (const container of this.tokenContainers) {
      if (container.exists && container.utxo
        && !this.isTokenContainerDrained(container.tokenContainerCategoryId)) {
        flags |= 1n << BigInt(container.tokenContainerSlotIndex);
      }
    }
    return flags;
  }

  /** Get the list of token container infos (for drain detection). */
  getEntryNftInfos(): readonly EntryNftInfo[] {
    return this.entryNfts;
  }

  getTokenContainerInfos(): readonly TokenContainerInfo[] {
    return this.tokenContainers;
  }

  /**
   * Compute the output index where entry NFT outputs start.
   */
  getEntryOutputBase(): number {
    const layoutOffset = this.getBlockSlotOffset('entry', 0);
    if (layoutOffset !== undefined) return layoutOffset;

    const masterOutputCount = 1;
    const dataNftOutputCount = this.requiredNftIndices.length;
    const frontAuxiliaryOutputCount = this.frontRegionAuxiliaryWidth();
    const outStateOutputCount = this.externalOutStateUtxoGroups.reduce(
      (sum, g) => sum + 1 + g.dataNftUtxos.length + (g.blockhashCoSpendUtxos?.length ?? 0)
        + (g.keccakInputs?.length ?? 0), 0,
    );
    const externalCallOutputCount = this.externalCallUtxoGroups.reduce(
      (sum, g) => (g.blockInputs ? sum + g.blockInputs.length : sum + 1 + g.dataNftUtxos.length), 0,
    );
    // A direct delegate is preserved before the proxy-owned entry band (see build()). Its implementation
    // master/data outputs therefore shift the physical entry indices even though they are not part of the
    // proxy forwarder's block layout. Delegates associated with an external group are emitted with that group
    // later and have already been counted above.
    const associatedDelegates = new Set(this.externalCallUtxoGroups
      .map((group) => group.delegateCallGroupIndex)
      .filter((index): index is number => index !== undefined));
    const leadingDelegateOutputCount = this.delegateEntriesAfterLowLevel
      ? this.lowLevelCallUtxoGroups.reduce((sum, group, index) => (
        group.callMode === 'delegatecall' && !associatedDelegates.has(index)
          ? sum + 1 + group.dataNftUtxos.length : sum
      ), 0) + (this.delegateReturnEventAfterEvents ? 0 : this.pendingReturnEventOutputs
        .filter((returnEvent) => returnEvent.categoryId === this.categoryId).length)
      : 0;
    // When a dynamic-array read is co-spent before the callees, build() emits the read chunks' preservation
    // outputs BEFORE the callee outputs (loopChunkBeforeCallees), so everything downstream of the entries
    // (transfers, events, RETURN events - this is the chain root they all build on) shifts by the chunk
    // count. A run placed after the callees, or without external calls, trails instead (no shift). Must match
    // the witness-side formula in StatefulContract (returnEventOutputBase counts iterationEntryInputs).
    const chunkBeforeCalleeCount = this.iterationChunksPrecedeCallees() ? this.iterationEntryInputs.length : 0;
    // Low-level call outputs are now AFTER entries/SC/TCs/transfers/events (matching block layout)
    return masterOutputCount + dataNftOutputCount + frontAuxiliaryOutputCount + outStateOutputCount
      + externalCallOutputCount + chunkBeforeCalleeCount + leadingDelegateOutputCount;
  }

  /**
   * The entry-slot index of each entry NFT output, in output order (matches the build() output loop:
   * non-deleted entries sorted by slotIndex). Output at getEntryOutputBase()+k belongs to slot [k].
   * Lets the derivation map an extracted commitment back to its slot by output index (robust to write
   * order and to read-only slots that emit no commitment check).
   */
  getEntryOutputSlotOrder(): number[] {
    // Must mirror build()'s entry-output emission exactly: a real output per non-deleted slot, plus a
    // position-holding placeholder for each deleted slot below the fill threshold. The derivation maps a
    // commitment at output offset O to slotOrder[O - entryOutputBase]; placeholders carry no commitment, so
    // they just occupy a position and are never looked up.
    const sorted = [...this.entryNfts].sort((a, b) => a.slotIndex - b.slotIndex);
    const fillThreshold = this.entryPlaceholderFillThreshold();
    const order: number[] = [];
    for (const e of sorted) {
      if (!this.entryDeletes.has(e.slotIndex) || e.slotIndex < fillThreshold) order.push(e.slotIndex);
    }
    return order;
  }

  // The slotIndex below which a skipped (deleted/funded) entry slot needs a placeholder output. Normally the
  // last real entry output; but when a trailing output (a dynamic chunk write, or a post-entry block-layout
  // slot) sits past the entry region, the whole region must be occupied so that trailing output lands at its
  // fixed offset - so fill through the last entry slot.
  private entryPlaceholderFillThreshold(): number {
    const sorted = [...this.entryNfts].sort((a, b) => a.slotIndex - b.slotIndex);
    if (sorted.length === 0) return -1;
    if (this.hasPostEntryOutput()) return sorted[sorted.length - 1].slotIndex + 1;
    let lastRealSlotIndex = -1;
    for (const e of sorted) if (!this.entryDeletes.has(e.slotIndex)) lastRealSlotIndex = e.slotIndex;
    return lastRealSlotIndex;
  }

  private hasPostEntryOutput(): boolean {
    if (this.dynamicChunkVars.length > 0) return true;
    if (this.loopEntryVars.length > 0) return true;
    if (!this.blockLayout) return false;
    const entryOffsets = this.blockLayout.slots.filter((s) => s.kind === 'entry').map((s) => s.offset);
    if (entryOffsets.length === 0) return false;
    const maxEntry = Math.max(...entryOffsets);
    return this.blockLayout.slots.some((s) => s.offset > maxEntry);
  }

  /**
   * Number of front-region auxiliary co-spend slots the owner block reserves, in the compiler's canonical band
   * order. Derived from the block layout when available so a future band reorder is reflected automatically;
   * manual builders without a layout use the dense active co-spend counts. Delegate `lowLevelCall` is excluded
   * because the legacy assembly keeps it outside this band, and a delegated block-info oracle is excluded
   * because its recreate rides the implementation band instead of the owner band.
   */
  private frontRegionAuxiliaryWidth(): number {
    if (this.blockLayout) {
      return this.blockLayout.slots.filter((slot) => slot.kind !== 'lowLevelCall'
        && (slot.kind !== 'blockInfoOracle' || !this.delegateBlockInfoOracle)
        && isAuxiliaryBlockSlot(slot)).length;
    }
    return this.readOnlyDataNftUtxos.length + this.blockhashCoSpendUtxos.length
      + (this.delegateBlockInfoOracle ? 0 : this.blockInfoCoSpendUtxos.length)
      + this.keccakComputeCoSpendUtxos.length + this.ecrecoverComputeCoSpendUtxos.length;
  }

  /**
   * Look up a block-layout offset for a given slot kind and optional slotIndex.
   * Returns `undefined` when no block layout is available or the slot is not found.
   */
  private getBlockSlotOffset(kind: BlockSlotKind, slotIndex?: number): number | undefined {
    if (!this.blockLayout) return undefined;
    const slot = this.blockLayout.slots.find(
      (s) => s.kind === kind && (slotIndex === undefined || s.slotIndex === slotIndex),
    );
    return slot?.offset;
  }

  /**
   * Compute the output index where token container preservation outputs start.
   * Token containers now come before output-only slots (transfers, tcTransfers, events)
   * so that input-bearing slots are contiguous and match blockLayout offsets.
   */
  getTokenContainerOutputBase(): number {
    const layoutOffset = this.getBlockSlotOffset('tokenContainer', 0);
    if (layoutOffset !== undefined) return layoutOffset;

    const entryNftOutputCount = this.entryNfts
      .filter((e) => !this.entryDeletes.has(e.slotIndex))
      .length;
    const satoshiContainerOutputCount = this.satoshiContainerUtxo ? 1 : 0;
    return this.getEntryOutputBase()
      + entryNftOutputCount + satoshiContainerOutputCount;
  }

  getTransferOutputBase(): number {
    const layoutOffset = this.getBlockSlotOffset('transfer', 0);
    if (layoutOffset !== undefined) return layoutOffset;

    const containerSlots = this.tokenContainers.filter(
      (d) => d.exists && d.utxo,
    ).length;
    const loopReturnWidth = this.externalCallUtxoGroups.reduce((sum, group, idx) => {
      if (this.isInBlockReturnEventGroup(idx)) return sum;
      if (group.returnOutputIndex === undefined) return sum;
      return sum + Math.max(0, (group.loopReturnCommitments?.length ?? 1) - 1);
    }, 0);
    return this.getTokenContainerOutputBase() + containerSlots + loopReturnWidth;
  }

  /**
   * Compute the output index where token container transfer outputs start.
   */
  getTokenContainerTransferOutputBase(): number {
    const layoutOffset = this.getBlockSlotOffset('tcTransfer', 0);
    if (layoutOffset !== undefined) return layoutOffset;

    const activeTransfers = this.pendingTransfers.filter((t) => t.lockingBytecode.length > 0).length;
    return this.getTransferOutputBase() + activeTransfers;
  }

  /**
   * Compute the output index where event NFT outputs start.
   */
  getEventOutputBase(): number {
    const layoutOffset = this.getBlockSlotOffset('event', 0);
    if (layoutOffset !== undefined) return layoutOffset;

    return this.getTokenContainerTransferOutputBase()
      + this.pendingTokenContainerTransfers.length
      + this.pendingTokenContainerTransferNfts.length;
  }

  /**
   * Compute the output index where return event outputs start.
   */
  getReturnEventOutputBase(): number {
    if (this.delegateEntriesAfterLowLevel) {
      let base = 1 + this.requiredNftIndices.length + this.frontRegionAuxiliaryWidth();
      for (const g of this.externalOutStateUtxoGroups) {
        base += 1 + g.dataNftUtxos.length + (g.blockhashCoSpendUtxos?.length ?? 0)
          + (g.keccakInputs?.length ?? 0);
      }
      base += this.iterationEntryInputs.length;
      for (const g of this.externalCallUtxoGroups) {
        base += g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length;
      }
      base += this.pendingReturnEventOutputs.filter((r) => r.categoryId === this.categoryId).length;
      for (const g of this.lowLevelCallUtxoGroups.filter((candidate) => candidate.callMode === 'delegatecall')) {
        base += 1 + g.dataNftUtxos.length;
      }
      return base;
    }
    const layoutOffset = this.getBlockSlotOffset('returnEvent');
    if (layoutOffset !== undefined) return layoutOffset;
    return this.getEventOutputBase() + this.getEventOutputCount();
  }

  /**
   * X13: a callee whose FULL block was assembled publishes a returnEvent slot inside that block, and the block
   * carries a paired funding input there, so its return-event NFT belongs at that slot - not appended after the
   * whole participant region. A callee without a full block (a transitive A->B->C leaf) keeps the appended tail.
   *
   * A later write fused onto the same physical master (FakeToken.approve after balanceOf) owns that slot.
   * The view callsite must keep the tail, where its precomputed pushdata already lives; sharing the writer's
   * 1-byte success flag (`0x01`) makes INT_DECODE SPLIT 1 on an empty remainder.
   */
  private isInBlockReturnEventGroup(groupIdx: number): boolean {
    return groupOwnsInBlockReturnEvent(this.externalCallUtxoGroups, groupIdx);
  }

  /** Return events that are NOT emitted inside a callee block, in emission order. */
  /**
   * The group whose record answers group `groupIdx`'s read: a readonly alias reads the record of the physical call
   * it shares (one callee run leaves one record); any other group its own logical return group.
   */
  private returnRecordGroupIndex(groupIdx: number): number {
    const group = this.externalCallUtxoGroups[groupIdx];
    const shared = group?.sharedGroupIndex === undefined ? undefined : this.externalCallUtxoGroups[group.sharedGroupIndex];
    if (group?.readonlyReturnSelector !== undefined && !group.compilerRoute && group.sharedGroupIndex !== groupIdx
      && shared?.readonlyReturnSelector === group.readonlyReturnSelector) return group.sharedGroupIndex!;
    return logicalReturnGroupIndex(this.externalCallUtxoGroups, groupIdx);
  }

  private tailReturnEventOutputs(): Array<{
    categoryId: string; commitment: Uint8Array; identity: string; provisional?: boolean;
  }> {
    const groupIdxOf = (identity: string): number => {
      const match = /^external-call:(\d+)/.exec(identity);
      return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
    };
    const tail = selectMaterializedTailReturnEvents(
      this.externalCallUtxoGroups,
      this.pendingReturnEventOutputs,
    ).filter((re) => {
      const idx = groupIdxOf(re.identity);
      return idx === Number.MAX_SAFE_INTEGER || this.returnRecordGroupIndex(idx) === idx
        || this.externalCallUtxoGroups[idx]?.readonlyReturnSelector === undefined;
    });
    const proxyRank = (idx: number): number => (
      this.externalCallUtxoGroups[idx]?.functionName === '__forward' ? 0 : 1
    );
    return tail.sort((left, right) => {
      const leftIdx = groupIdxOf(left.identity);
      const rightIdx = groupIdxOf(right.identity);
      return proxyRank(leftIdx) - proxyRank(rightIdx) || leftIdx - rightIdx;
    });
  }

  /**
   * X13: the output index carrying external-call group `groupIdx`'s return-event NFT - its own block slot when the
   * callee carries a full block, otherwise its rank in the appended tail band.
   */
  getExternalCallReturnEventOutputIndex(groupIdx: number): number {
    const group = this.externalCallUtxoGroups[groupIdx];
    if (!group) return -1;
    // A shared participant owns no layout of its own - both the block layout and the minting input belong to the
    // physical group it aliases, so read them there.
    const physical = this.externalCallUtxoGroups[group.sharedGroupIndex ?? groupIdx];
    const offset = physical?.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent')?.offset;
    if (this.isInBlockReturnEventGroup(groupIdx) && offset !== undefined) {
      const master = this.findMintingInputIndex(physical.categoryId);
      if (master >= 0) return master + offset;
      return this.getExternalCallOutputBase(groupIdx) + offset;
    }
    const returnIdentity = `external-call:${this.returnRecordGroupIndex(groupIdx)}`;
    const tailOrder = this.tailReturnEventOutputs().findIndex((re) => re.identity === returnIdentity);
    return tailOrder < 0 ? -1 : this.getReturnEventOutputBase() + tailOrder;
  }

  /** Raw long-return value retained for a caller's hash-checked ABI preimage witness. */
  getExternalCallReturnPreimage(groupIdx: number): Uint8Array | undefined {
    const group = this.externalCallUtxoGroups[groupIdx];
    if (!group) return undefined;
    const identity = `external-call:${this.returnRecordGroupIndex(groupIdx)}`;
    const exact = this.pendingReturnEventOutputs.find((event) => event.identity === identity);
    const first = this.pendingReturnEventOutputs.find((event) => event.identity === `${identity}:0`);
    const event = exact?.provisional && first ? first : exact ?? first;
    return event?.commitment ?? group.precomputedReturnCommitment;
  }

  /**
   * Count the actual number of event NFT outputs that build() will create.
   * This mirrors the merge logic in build(): manual emits fill dense indices,
   * placeholders (with optional raw commitments) fill by emitIndex, and
   * only non-null entries produce actual outputs.
   */
  private getEventOutputCount(): number {
    // Replicate the sparse array merge from build()
    const occupied = new Set<number>();

    // Manual emitEvent() calls occupy indices 0..n-1
    for (let i = 0; i < this.pendingEventEmits.length; i++) {
      occupied.add(i);
    }

    // Placeholders occupy their emitIndex (if not already taken by manual emits)
    for (const placeholder of this.pendingEventPlaceholders) {
      occupied.add(placeholder.emitIndex);
    }

    return occupied.size;
  }

  /**
   * Compute the input index of the satoshi container.
   * The satoshi container is placed after token containers in the input ordering.
   */
  getSatoshiContainerInputIndex(): number {
    const layoutOffset = this.getBlockSlotOffset('satoshiContainer');
    if (layoutOffset !== undefined) return layoutOffset;

    const masterInputCount = 1;
    const dataNftInputCount = this.dataNftUtxos.length;
    const frontAuxiliaryInputCount = this.frontRegionAuxiliaryWidth();
    const outStateInputCount = this.externalOutStateUtxoGroups.reduce(
      (sum, g) => sum + 1 + g.dataNftUtxos.length + (g.blockhashCoSpendUtxos?.length ?? 0)
        + (g.keccakInputs?.length ?? 0), 0,
    );
    const externalCallInputCount = this.externalCallUtxoGroups.reduce(
      (sum, g) => sum + (g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length)
        + (g.ordinaryDynamicChunkInputs?.length ?? 0), 0,
    );
    const lowLevelCallInputCount = this.lowLevelCallUtxoGroups.reduce(
      (sum, g) => sum + 1 + g.dataNftUtxos.length, 0,
    ) + this.lowLevelCallRawInputs.length;
    const entryInputCount = this.entryNfts.filter((e) => e.exists && e.utxo).length;
    const iterationEntryInputCount = this.iterationEntryInputs.length;
    const tokenContainerInputCount = this.tokenContainers.filter((d) => d.exists && d.utxo).length;
    return masterInputCount + dataNftInputCount + frontAuxiliaryInputCount + outStateInputCount
      + externalCallInputCount + lowLevelCallInputCount + entryInputCount + iterationEntryInputCount
      + tokenContainerInputCount;
  }

  /**
   * Compute the output index of the satoshi container preservation output.
   * The satoshi container output is placed after entries, before transfers.
   */
  getSatoshiContainerOutputIndex(): number {
    // With OP_RETURN placeholders for drained containers, the output always
    // exists at the block layout position (even when drained).
    const layoutOffset = this.getBlockSlotOffset('satoshiContainer');
    if (layoutOffset !== undefined) return layoutOffset;
    // The satoshi container output is at getTokenContainerOutputBase() - 1
    return this.getTokenContainerOutputBase() - 1;
  }

  /**
   * Compute the total number of outputs in the transaction.
   */
  private getTotalOutputCount(): number {
    const eventOutputCount = this.getEventOutputCount();
    const lowLevelCallOutputCount = this.lowLevelCallUtxoGroups.reduce(
      (sum, g) => sum + 1 + g.dataNftUtxos.length, 0,
    ) + this.lowLevelCallRawInputs.length;
    const iterationEntryOutputCount = this.iterationEntryInputs.length;
    // Include potential funder change output (added last in build())
    const changeOutputCount = (this.funderChangeAddress && this._accountingFunderUtxos().length > 0) ? 1 : 0;
    // X13: in-block return events are already counted inside each callee's block output span.
    return this.getEventOutputBase() + eventOutputCount
      + this.tailReturnEventOutputs().length
      + lowLevelCallOutputCount
      + this._dynamicChunkOutputCount()
      + this.runtimeLoopEventOutputs.length
      + this.runtimeLoopTransferOutputs.length
      + iterationEntryOutputCount
      + this.pendingOutputs.length
      + this.lateValueChunkOutputs.length
      + (this.lateValueChunkOutputs.length > 0 ? 1 : 0)
      + changeOutputCount;
  }

  /**
   * Build the covenant transaction without funding or broadcasting.
   * Returns the logically balanced transaction with all covenant inputs/outputs
   * and empty unlocking bytecodes on any unsigned inputs.
   *
   * The caller is responsible for:
   * 1. Adding fee funding input(s) to cover the transaction fee
   * 2. Adding a change output for excess funding
   * 3. Signing all inputs (covenant inputs already have unlocking bytecodes)
   * 4. Broadcasting the final transaction
   */
  async buildUnsigned(): Promise<{
    transaction: Uint8Array;
    sourceOutputs: LibauthOutput[];
    inputCount: number;
    covenantSize: number;
  }> {
    const covenantBuilder = this.build();
    const covenantTx = covenantBuilder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(covenantBuilder.inputs);
    const encoded = encodeTransaction(covenantTx);

    return {
      transaction: encoded,
      sourceOutputs,
      inputCount: covenantTx.inputs.length,
      covenantSize: encoded.byteLength,
    };
  }

  /**
   * On a covenant script failure, log an accurate op-level VM trace of the submitted tx. Runs the 2026 VM
   * (the one mocknet uses) so it executes the optimised subroutine bytecode the source-map debug can't track,
   * pinpointing the exact failing opcode + stack. Finds the failing input (named in the error, else scanned)
   * and prints a window of ops ending at the failure. Best-effort: the caller swallows any error here.
   */
  private _logCovenantFailureTrace(builder: TransactionBuilder, reason: string): void {
    logCovenantFailureTrace(this._covenantFailureTraceHost(), builder, reason);
  }

  /**
   * Recover a computed C2 value-chunk output from the failing covenant itself. Transitive routed calls can be
   * represented only as low-level groups, so their masters are not visited by StatefulContract's external-call
   * derivation loop. The chunk verifier nevertheless has the complete authenticated output on its stack before
   * OP_OUTPUTBYTECODE: [.., commitment, outputIndex, lockingBytecode, outputIndex].
   */
  private _repairComputedChunkOutput(
    builder: TransactionBuilder, inputIndex: number,
  ): ComputedChunkRepairResult {
    return repairComputedChunkOutput(this._repairComputedChunkOutputHost(), builder, inputIndex);
  }

  private _strictRecursiveVmPreflight(builder: TransactionBuilder): void {
    const transaction = builder.buildLibauthTransaction(true);
    // X121: read the provider's limits. Unlike the tracer above this THROWS, so it decides ACCEPT/REJECT, and
    // a bare VM here decides against a configuration the provider may not be running.
    //
    // VERSION-DEPENDENT, and the pin is `@mem-cash/validation` 0.0.10 - the version
    // `packages/solidcash/package.json` declares (`^0.0.10`, which for a 0.0.x range means exactly 0.0.10)
    // and `yarn.lock` resolves. At 0.0.8 and later `TxVerifierConfig.consensus` exists and the overrides
    // reach the decider, so this factory AGREES with it on every shape measured, while a bare VM diverges in
    // BOTH directions: it accepts what the provider refuses under a strict profile (P2PKH and recursion at
    // `operationCostBudgetPerByte: 150`) and refuses what the provider accepts under the relaxed default
    // (`decrement(24)`). The first of those is the fail-open direction, which is why this is not left bare.
    //
    // At 0.0.7 the field does not exist and the overrides are silently dropped, which inverts every one of those
    // verdicts. `X121StrictPreflightDecision` asserts the installed version first so a stale tree fails with
    // that as the reason instead of six opaque assertion failures.
    //
    // `standard` is deliberately left at the factory default of `true` rather than tracked to the provider's
    // `policy.enforceDust`. Standard is the stricter regime, so this keeps the residual error fail-closed. No
    // shape was found where the two regimes give different VERDICTS, so tracking it is not known to be needed.
    // X198. ASK `stateSuccess`, NOT `state.error`. libauth defines `success(state)` as "return `state.error` if
    // there is one, otherwise refuse an empty stack or a non-truthy top item", and `createVirtualMachine` hands
    // that same function to `vm.verify` - so `stateSuccess` IS the VM's verification predicate and `state.error`
    // is only its first branch. The gap matters here because the compiler DELETES the final `require`'s
    // OP_VERIFY when the stack is shallow, so a failing final require leaves a falsy top and raises nothing.
    // The old `if (state.error)` was also a truthiness test where `!== undefined` is meant.
    //
    // Scope: this path is opt-in and default-off, and no hostile was constructed against it. The repair is
    // inferred from field semantics that WERE measured, on the sibling decider in `message-bus/preflight.ts`.
    try {
      assertFinalizedTransactionCovenants(builder, transaction);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(reason.replace(/^messageBus: BCH-2026 preflight failed at /, ''));
    }
  }

  /** Converge authenticated computed outputs against the exact transaction shape submitted to the provider. */
  private _assertConvergedFinalTransaction(
    builder: TransactionBuilder,
    afterRepairs?: () => void,
    beforeValidation?: (
      transaction: ReturnType<TransactionBuilder['buildLibauthTransaction']>,
    ) => boolean,
  ): ReturnType<TransactionBuilder['buildLibauthTransaction']> {
    return assertConvergedFinalTransaction(
      this._convergedFinalTransactionHost(), builder, afterRepairs, beforeValidation,
    );
  }

  async send(): Promise<TransactionDetails> {
    const provider = this.builderOptions.provider;
    if (!provider) {
      throw new Error('No network provider available');
    }
    const sendTiming = createSendTiming();

    // -- Phase 1: build the covenant transaction (logic only, no fee) --
    const discovery = runSendDiscoveryProbe(
      this.build(),
      provider,
      () => this.build(),
      sendTiming,
    );
    const covenantBuilder = discovery.covenantBuilder;
    void discovery.discoveryProbeFailure;

    // -- Phase 2: measure shape -> compute fee -> fund --
    // The phase-3 final-layout reassert republishes a batch predecessor output past the measured frame,
    // so measuring the pre-reassert shape sizes the funder without the sats that extra output needs. Apply
    // the same predecessor materialization to the measured builder first, so the deficit it exposes is
    // included in the funder. A transaction that gains no predecessor output measures the same shape as
    // before and keeps its current fee.
    this._reassertMaterializedBatchPredecessorOutputs(covenantBuilder);
    const { neededFee, dustMinimum: DUST_MINIMUM } = await measureAndFundCovenantFee(
      this._measureAndFundCovenantFeeHost(), covenantBuilder, provider,
    );
    sendTiming('fee-measured');

    // -- Phase 3: rebuild with fee funder + change output, then send --
    const {
      finalBuilder,
      serializedAccountingFunders,
      reassertFinalLayout,
    } = runSendPhase3FinalRebuildImpl(
      this._runSendPhase3FinalRebuildHost(),
      neededFee,
      DUST_MINIMUM,
      sendTiming,
    );

    // -- Phase 4–5: converge/serialize/fee-bytes then submit --
    return runSendPhase4ThroughSubmitImpl(
      this._runSendPhase4ThroughSubmitHost(),
      finalBuilder,
      serializedAccountingFunders,
      reassertFinalLayout,
      provider,
      neededFee,
      sendTiming,
    );
  }

  /**
   * Decode the event NFT outputs this transaction created into ethers-v5-style receipt events. An output is an
   * event log iff its locking bytecode matches one of the event NFT addresses; its commitment is decoded against
   * that event's ABI. Outputs are scanned in vout order, so `events[0]` is the first-emitted event.
   */
  private decodeEmittedEvents(outputs: readonly LibauthOutput[]): ReceiptEvent[] {
    if (this.eventDefinitions.length === 0
      || (this.eventNftLockingBytecodes.size === 0 && this.runtimeLoopEventOutputs.length === 0
        && this.detachedEventReceipts.length === 0)) return [];
    const sigByLbc = new Map<string, string>();
    for (const [sig, lbc] of this.eventNftLockingBytecodes) sigByLbc.set(binToHex(lbc), sig);
    for (const event of this.runtimeLoopEventOutputs) {
      if (!event.continuation) sigByLbc.set(binToHex(event.lockingBytecode), event.eventSignature);
    }
    const structCandidates: Array<Artifact['structs'] | undefined> = [
      this.stateLayout.structs,
      ...this.externalCallUtxoGroups.map((group) => group.logicalArtifact?.structs
        ?? group.externalContract?.inner?.artifact?.structs),
      ...this.lowLevelCallUtxoGroups.map((group) => group.logicalArtifact?.structs
        ?? group.externalContract?.inner?.artifact?.structs),
    ];
    const parseNamed = (
      commitmentHex: string,
      eventDef: EventDefinitionAbi,
    ): Record<string, StateValue> | undefined => {
      for (const structs of structCandidates) {
        try {
          return parseEventCommitment(commitmentHex, eventDef, structs);
        } catch { /* try next struct map */ }
      }
      return undefined;
    };
    const events: ReceiptEvent[] = [];
    const commitmentOf = (out: LibauthOutput | undefined): string | undefined => {
      const commitment = out?.token?.nft?.commitment;
      if (commitment === undefined) return undefined;
      return typeof commitment === 'string' ? commitment : binToHex(commitment);
    };
    for (const [index, out] of outputs.entries()) {
      const head = commitmentOf(out);
      if (head === undefined) continue;
      const sig = sigByLbc.get(binToHex(out.lockingBytecode));
      if (sig === undefined) continue;
      const eventDef = this.eventDefinitions.find((e) => e.signature === sig);
      if (!eventDef) continue;
      // A wide event continues in the outputs right after it, at its continuation covenant.
      const continuation = binToHex(eventContinuationLockingBytecode(this.categoryId, sig, eventDef.anonymous === true));
      const commitmentHex = joinEventContinuations(head, (offset) => {
        const next = outputs[index + offset];
        return next !== undefined && binToHex(next.lockingBytecode) === continuation ? commitmentOf(next) : undefined;
      });
      const named = parseNamed(commitmentHex, eventDef);
      if (!named) continue;
      events.push({
        event: eventDef.name, eventSignature: eventDef.signature,
        args: buildReceiptEventArgs(eventDef, named),
      });
    }
    for (const detached of this.detachedEventReceipts) {
      const eventDef = this.eventDefinitions.find((event) => event.signature === detached.eventSignature);
      if (!eventDef) continue;
      const named = parseNamed(detached.commitment, eventDef);
      if (!named) continue;
      events.push({
        event: eventDef.name,
        eventSignature: eventDef.signature,
        args: buildReceiptEventArgs(eventDef, named),
      });
    }
    return events;
  }
}

onMockNetworkProviderReset(() => {
  StatefulTransactionBuilder.clearPersistedJobEvents();
  clearCollectionValueRecords();
});

/**
 * Build an ethers-v5 `event.args`: decoded params by name (`.args.pair`), plus non-enumerable numeric indices
 * (`.args[0]`, array-like Result parity) and a `toObject()` returning a plain named copy. Non-enumerable extras
 * keep Object.keys / spread / chai deep-equal to just the named fields.
 */
function buildReceiptEventArgs(
  eventDef: EventDefinitionAbi,
  named: Record<string, StateValue>,
): Record<string, unknown> {
  // Attach .toObject()/.toArray() to any struct/array param value so `event.args.someStruct.toObject()` works,
  // matching the getState()/queryFilter boundaries.
  for (const p of eventDef.parameters) attachDecodedAccessors(named[p.name]);
  const args: Record<string, unknown> = { ...named };
  eventDef.parameters.forEach((p, i) => {
    Object.defineProperty(args, String(i), { value: named[p.name], enumerable: false, writable: true, configurable: true });
  });
  Object.defineProperty(args, 'toObject', {
    value: (): Record<string, StateValue> => ({ ...named }), enumerable: false, writable: true, configurable: true,
  });
  return args;
}
