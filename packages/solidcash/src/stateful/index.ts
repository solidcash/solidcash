import { Artifact } from '@solidcash/utils';
import { Contract } from '../Contract.js';
import {
  StatefulContract as StatefulContractClass,
  type ConnectedStatefulContract as ConnectedStatefulContractType,
  type ContractRunner as ContractRunnerType,
  type LeanContractOptions as LeanContractOptionsType,
} from './StatefulContract.js';

// `new StatefulContract(...)` returns the ABI-typed connected instance (the runtime is a Proxy providing exactly
// that surface). A class constructor otherwise yields the bare class type, so strip the generated construct
// signatures (mapped type over the statics) and re-declare the lean + legacy forms as returning the connected
// type. See docs/stateful-contract-sdk.md.
type StatefulContractCtor =
  { [K in keyof typeof StatefulContractClass]: (typeof StatefulContractClass)[K] }
  & {
    new <T extends Artifact>(
      categoryId: string, artifact: T, runner: ContractRunnerType, options?: LeanContractOptionsType,
    ): ConnectedStatefulContractType<T>;
    new <T extends Artifact>(contract: Contract<T>, categoryId: string): ConnectedStatefulContractType<T>;
  };
export const StatefulContract = StatefulContractClass as unknown as StatefulContractCtor;
export type StatefulContract<T extends Artifact = Artifact> = ConnectedStatefulContractType<T>;
export {
  clearSoftBentoTotals,
  takeSoftStateSnapshot,
  providerUnixLocktime,
  selectorParamSlot,
  groupIndexForExternalCallSlot,
  externalReturnParamSlot,
  isSdkResolvedExternalCallTopologyWitness,
  parseRowArgsDecodeLabel,
  visibleHandlerInputs,
  matchingRouteRowsForExpressionKey,
  resolveRouteRowExpressionKey,
  kernelJournalAccessStreamPlaceholders,
  kernelJournalRecordSegmentWitnesses,
  type KernelJournalRecordSegmentWitnesses,
  type RouteExpressionKeyRow,
  type SoftStateSnapshot,
} from './StatefulContract.js';
export {
  RUNTIME_LOOP_EVENT_ITERATION_LIMIT,
  runtimeLoopEventIterationValues,
  runtimeLoopEventRepeatSource,
  type RuntimeLoopDomainEvaluator,
  type RuntimeLoopEventRepeatSource,
} from './runtime-loop-event-domain.js';

export {
  StatefulTransactionBuilder,
  ValueChunkWriteStagingSession,
  type EntryNftInfo,
  type TransferData,
  type EventEmitData,
  type TokenContainerInfo,
  type TokenContainerTransferData,
  type TokenContainerTransferNftData,
  type ExternalCallUtxoGroup,
  type StatefulTransactionOptions,
  type ValueChunkWriteDescriptor,
} from './StatefulTransactionBuilder.js';
export {
  canonicalValueChunkProducerIdentity,
  canonicalValueChunkProducerPathContext,
  createValueChunkProducerArgumentEpoch,
  advanceValueChunkProducerArgumentEpoch,
  valueChunkProducerArgumentsInEpoch,
  appendValueChunkProducerSourceSite,
  deriveValueChunkProducerChildPath,
  canonicalValueChunkProducerResourceIdentity,
  canonicalValueChunkProducerResourceClaim,
  bindValueChunkProducerClaimAliases,
  selectSingletonValueChunkProducer,
  terminalValueChunkProducerClaim,
  valueChunkProducerClaimFromRouteRow,
  valueChunkEffectDomainId,
  type ValueChunkProducerIdentity,
  type ValueChunkProducerClaimCarrier,
  type ValueChunkProducerResourceClaim,
  type ValueChunkProducerSourceSite,
  type ValueChunkProducerRouteRowCoordinates,
  type ValueChunkProducerMutationRow,
  type ValueChunkProducerPathContext,
  type ValueChunkProducerPathDisposition,
  type ValueChunkProducerArgumentEpoch,
  type SingletonValueChunkProducerSelection,
} from './ValueChunkProducerIdentity.js';
export {
  ContractBundle, resolveCategoryFromAddress, resolveCategoryFromLockingBytecode, type ContractBundleOptions,
} from './ContractBundle.js';
export {
  SplitContractBundle, SplitContract,
  type SplitDeployOptions, type SplitDeploymentRecord,
} from './SplitContractBundle.js';
export {
  ContractFactory, getContractFactory, deployContract, selectGenesisFundingUtxo,
  type DeployContractOptions, type DeployedContract,
} from './ContractFactory.js';
export {
  deriveLogicalCreateAddress, deriveLogicalAddressFromSeed,
  encodeLogicalIdentityCommitment, decodeLogicalIdentityCommitment,
  encodeLogicalFacetCommitment, decodeLogicalFacetCommitment,
  buildLogicalIdentityCommitment, resolveLogicalIdentity, resolveLogicalIdentityFromAddresses,
  resolveLogicalIdentityByCategory, requireMsgSenderIdentity, isZeroMsgSenderCategory,
  resolveSplitLogicalIdentity,
  createLogicalIdentityUnlocker, isScidIdentityCommitment,
  logicalIdentityAddressVariants, sameLogicalIdentityAddress, logicalIdentityBandKey,
  type LogicalIdentityCommitment, type ResolvedLogicalIdentity, type ResolvedSplitLogicalIdentity,
} from './logical-identity.js';
export {
  upgrades, deployProxy, upgradeProxy, ProxyContract, mockProxyDensityReserveBytes,
  type DeployProxyOptions, type UpgradeProxyOptions, type ProxyInitialState,
} from './upgrades.js';
export {
  StatefulFunctionCall,
  DeployFunctionCall,
  TokenContainerAccessor,
  type ConnectedStatefulContract,
  type DeployOptions,
  type DeployResult,
  type UpgradeOptions,
  type UpgradeResult,
  type DeployFromOptions,
  type DeployFromResult,
  type DestroyOptions,
  type DestroyResult,
  type ExternalCallInfo,
  type ExternalContractSpec,
  type StatefulConnectOptions,
  type CallInfo,
  type ContractRunner,
  type LeanContractOptions,
  type EventLog,
  type DeferredEventFilter,
  type StatefulContractEvent,
  type ContractEventName,
  type EventListener,
} from './StatefulContract.js';
export {
  StateReader, type OnChainState, type ParsedEvent, type EventFilter,
  parseEventCommitment, tryParseEventCommitment,
  readEventsFromChain, readEventsFiltered,
  readAnonymousEventsFromChain, valuesEqual,
} from './StateReader.js';
export { ThreadManager, ThreadHandle, type SplitOptions, type MergeOptions } from './ThreadManager.js';
export { resolveDeployReads, type DeployReadResolveOptions } from './resolveDeployReads.js';
export {
  SortedList, getCachedSortedList, keyToSlot, keyToSlotMulti, keyToSlotValue, slotValueToBytes, bytesToSlotValue,
  encodeEntryCommitment, decodeEntryCommitment, isEmptyValueEntryCommitment, headSentinelCommitment,
  type SortedEntry, type NonMembershipPlan, type MembershipPlan, type InsertPlan, type DeletePlan, type UpdatePlan,
  type BatchUpsertPlan, type JournaledUpsert, type JournaledMutationRecord, type JournaledMutationAccess,
  type JournaledMutationPlan, type JournaledMutationResult,
} from './SortedList.js';
export {
  KERNEL_ENTRY_JOURNAL_TAG, KERNEL_ENTRY_JOURNAL_ACCESS_TAG,
  KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES, KERNEL_ENTRY_JOURNAL_MAX_ACCESSES,
  KERNEL_ENTRY_JOURNAL_MAX_RECORDS, KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS,
  KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT,
  KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX,
  encodeKernelEntryJournalRecord, encodeKernelEntryJournalRecords, decodeKernelEntryJournalRecord,
  validateKernelEntryJournalTransportRecords,
  segmentKernelEntryJournalRecords, kernelEntryJournalRecordPosition,
  kernelEntryJournalRecordSegmentName, kernelEntryJournalRecordSegmentIndex,
  validateKernelEntryJournalRecordSegments, validateKernelEntryJournalRecordSegmentSlots,
  encodeKernelEntryJournalAccesses, decodeKernelEntryJournalAccesses,
  planKernelEntryJournalStreams, planKernelEntryJournalAccessTopology,
  planKernelEntryJournalSettlementAuthority, planKernelEntryJournalSettlementOutputSegments,
  planKernelEntryJournalPhysicalSettlement, planKernelEntryJournalOutputLayout,
  kernelJournalDispositionsFromArtifact,
  resolveKernelEntryJournalDirtyFinalBodies,
  scheduleKernelEntryJournalOccurrences,
  validateKernelEntryJournalSettlementGroups,
  type KernelEntryJournalRecord, type KernelEntryJournalStreamPlan,
  type KernelEntryJournalRecordPosition, type KernelEntryJournalSegmentValidationOptions,
  type KernelEntryJournalTopologyOperation, type KernelEntryJournalAccessTopologyPlan,
  type KernelEntryJournalSettlementOccurrence, type KernelEntryJournalSettlementReference,
  type KernelEntryJournalSettlementPlan,
  type KernelEntryJournalPhysicalSettlementPlan,
  type KernelEntryJournalPhysicalSettlementOccurrence,
  type KernelEntryJournalPhysicalSettlementInput,
  type KernelEntryJournalPhysicalSettlementOutput,
  type KernelEntryJournalPhysicalSettlementStreamAccounting,
  type KernelEntryJournalDirtyFinalBodyProducer,
  type KernelEntryJournalDirtyFinalBodyCandidate,
  type KernelEntryJournalDirtyFinalBodyResolution,
  type KernelEntryJournalEagerOutputPlanEntry,
  type KernelEntryJournalOutputLayoutEntry,
  type KernelEntryJournalOutputLayoutPlan,
  type KernelEntryJournalSettlementOutputSegment,
  type KernelEntryJournalSettlementStream,
  type KernelEntryJournalExecutionStream, type KernelEntryJournalScheduledOccurrence,
} from './KernelEntryJournal.js';
export {
  bindKernelLifecycleTransaction, planKernelLifecycleTopology,
  type BoundKernelLifecycleTransaction, type KernelLifecycleTransactionFrame,
  type KernelLifecycleTransactionPoint, type ResolvedKernelLifecycleSpan, type ResolvedKernelLifecycleTopology,
} from './KernelLifecycleTopology.js';
export {
  planKernelDelegateForwarding, resolveKernelDelegateExecution, resolveKernelDelegatePromotion,
  type KernelDelegateExecutionTarget, type KernelDelegateForwardingFrame, type KernelDelegateForwardingMetadata,
  type KernelDelegatePromotionInput,
  type ResolvedKernelDelegateForwarding, type ResolvedKernelDelegateExecution,
} from './KernelDelegateForwarding.js';
export {
  registerDeployment, findDeploymentByName, findDeploymentByAddress, findDeploymentByLockingBytecode,
  findDeploymentImplementing, clearDeployments, takeDeploymentRegistrySnapshot,
  type RegisteredDeployment, type DeploymentRegistrySnapshot,
} from './deployment-registry.js';
export {
  getDataNftAddress,
  getMessageBusVerifierAddress,
  getMessageBusVerifierLockingBytecode,
  getDataNftLockingBytecode,
  getEntryNftLockingBytecode,
  getEntryNftAddress,
  getValueChunkAddress,
  getValueChunkLockingBytecode,
  getEventNftAddress,
  getAnonymousEventNftAddress,
  getTokenContainerAddress,
  getSatoshiContainerAddress,
  getContractState,
  createDataNftUnlocker,
  createMessageBusVerifierUnlocker,
  createDestroyDataNftUnlocker,
  createReadOnlyDataNftUnlocker,
  createEntryNftUnlocker,
  createReadOnlyEntryNftUnlocker,
  createValueChunkUnlocker,
  createEventNftUnlocker,
  createAnonymousEventNftUnlocker,
  createTokenContainerUnlocker,
  createSatoshiContainerUnlocker,
  createCovenantContractUnlocker,
  validateCategoryId,
  resolveCollectionSignature,
  resolveEventSignature,
} from './covenant-helpers.js';
export {
  preflightBalancedBlockAssembly,
  deriveBalancedAssemblyFromInputs,
  assertCompleteLocalBlock,
  participantRegionEnd,
  BALANCED_SLOT_SATOSHIS,
  BALANCED_EVENT_SLOT_CEILING,
  OUTPUT_ONLY_BLOCK_SLOT_KINDS,
  EVENT_BLOCK_SLOT_KINDS,
  type BalancedAssembly,
  type BalancedAssemblyOptions,
  type BalancedAssemblyView,
  type BalancedBlockPlacement,
} from './balancedBlocks.js';
