/* eslint-disable max-len, @typescript-eslint/no-loop-func, @typescript-eslint/no-shadow */
import {
  type Artifact,
  type FunctionSplitBundle,
  type ArtifactMap,
  
  type AbiFunction,
  type ArgSource,
  type ExternalCallExpression,
  type ExternalCallAbi,
  type ExternalResultConsumerAbi,
  type ExternalResultEncoding,
  
  type SortedUpsertLoopAbi,
  buildDataNftCovenantScript,
  buildEntryNftCovenantScript,
  computeCollectionHash,
  dynamicChunkSignature,
  parseValueChunkCommitment,
  splitValueIntoValueChunks,
  VALUE_HEAD_SIZE,
  VALUE_CHUNK_SIZE,
  VALUE_CHUNK_MAX_COUNT,
  VALUE_INLINE_LIMIT,
  encodeChunkableValueTail,
  joinValueChunks,
  parseEntryCommitment,
  type StateValue,
  attachDecodedAccessors,
  decodePushdataValue,
  parseEntryCommitmentMultiKey,
  Op,
  type StateLayout,
  type ExternalReadAbi,
  type EntryAccessAbi,
  type EmitAbi,
  type EventDefinitionAbi,
  type FunctionBlockLayout,
  isComputedBlockhashKey,
  blockOracleReadUnlocking,
  encodePushdataValue,
  getDefaultStateValue,
  keccakComputeLockingBytecode,
  sha256 as sha256Sync,
  ripemd160 as ripemd160Sync,
  hash160 as hash160Sync,
  hash256 as hash256Sync,
  parseArrayTypeString,
  type FixedBchTransferAbi,
  
  peekPushdataEncodedLength,
} from '@solidcash/utils';
import { assertConstructedKeyVectorRouteBinding } from './ConstructedKeyVector.js';
import { nextBuildId, peekBuildId } from './buildSequence.js';
import { appendComputedValueChunkRun } from './computed-value-chunk-runs.js';
import { encodeEvmInvocationResult } from './evm-abi-result.js';
import {
  buildKeccakComputeSidecar, learnKeccakPreimages, scanKeccakPreimageReads,
} from '../keccak/keccakComputeSidecar.js';
import { encodeMessageBatch } from '../message-bus/message-bus.js';
import type { FixedEffectEntryResolver } from '../message-bus/fixed-effect-entries.js';
export { inactiveMessageBusRouteWitness } from '../message-bus/route-witness.js';
import type { PreparedAtomicMessageBusCall } from '../message-bus/compose.js';
import { type ValueChunkProducerPathDisposition } from './ValueChunkProducerIdentity.js';
// X186. The covenant-annotating gate moved to `message-bus/preflight.ts` when `TransactionBuilder.send` became its
// second caller. The four lifecycle-admin sites below route through it; none calls the bare gate.
import { binToHex, hexToBin, binsAreEqual } from '@bitauth/libauth/build/lib/format/hex.js';
import { utf8ToBin, binToUtf8 } from '@bitauth/libauth/build/lib/format/utf8.js';
import { encodeTransaction } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import { encodeAuthenticationInstructions, bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import {
  createVirtualMachineBch2026ForProvider,
} from '../network/createVirtualMachine.js';
import { Contract } from '../Contract.js';
import {
  type ConstructorArgument, type FunctionArgument, encodeFunctionArgument, normalizeSolidityBytesArgument,
} from '../Argument.js';
import type { AbiToFunctionMap } from '../types/type-inference.js';
import type { StateGetterMap, StateValueType } from '../types/state-inference.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { BcmrPublication, NativeTokenOptions, PublishedRegistry } from '../bcmr/deployment.js';
import type { IdentityPolicy, IdentityRecord } from '../bcmr/identity.js';
import { artifactUsesSolidityAbi } from './solidityAbi.js';
import { isScidIdentityCommitment, resolveLogicalIdentity, type ResolvedLogicalIdentity } from './logical-identity.js';

import { addressToLockScript, generateLibauthSourceOutputs, scriptToAddress, scriptToLockingBytecode } from '../utils.js';

import { SortedList, keyToSlotMulti, bytesToSlotValue, encodeEntryCommitment, decodeEntryCommitment } from './SortedList.js';
import {
  decodeKernelEntryJournalRecord,
  decodeKernelEntryJournalAccesses,
  encodeKernelEntryJournalAccesses,
  KERNEL_ENTRY_JOURNAL_MAX_RECORDS,
  
  kernelEntryJournalSettlementOutputSegments,
  
  
  
  kernelEntryJournalReadCarrierCapabilityFromArtifact,
  
  kernelJournalDispositionsFromArtifact,
  planKernelEntryJournalAccessTopology,
  scheduleKernelEntryJournalOccurrences,
  planKernelEntryJournalPhysicalSettlement,
  resolveKernelEntryJournalDirtyFinalBodies,
  planKernelEntryJournalSettlementAuthority,
  planKernelEntryJournalSettlementOutputs,
  validateKernelEntryJournalSettlementGroups,
  
  
  type KernelEntryJournalAccess,
  
  type KernelEntryJournalSettlementOccurrence,
  type KernelEntryJournalSettlementReference,
  type KernelEntryJournalDirtyFinalBodyCandidate,
  type KernelEntryJournalTopologyOperation,
} from './KernelEntryJournal.js';
import {
  KERNEL_JOURNAL_ACCESS_STREAMS,
  KERNEL_JOURNAL_RECORDS,
  assertKernelJournalRecordBudget,
  defaultInternalFunctionArg,
  compilerRouteUsesPhysicalWrapper,
  kernelJournalAccessStreamPlaceholders,
  kernelJournalRecordSegmentWitnesses,
  kernelReadCarrierOwnsDuplicateProof,
  materializeInternalFunctionArgument,
  planAuthenticatedKernelJournalDispositionChain,
  shouldDeferKernelJournalBatchMaterialization,
  type GraphBlockhashSelection,
  type GraphEcrecoverCall,
  type MessageBusRuntimeAbiFunction,
} from './kernel-route-planning.js';
import { routeAuthenticatesPublicSelf, usesOrdinarySelfIdentity } from './ordinary-self-identity.js';
import { resolveBlockhashCoSpend } from '../oracle/blockhashCoSpend.js';
import { blockOracleLockFor, readBlockOracleTimestamp } from '../oracle/block-oracle-lock.js';
import { selectRootBlockOracleReader, takeNestedBlockOracleInput } from './block-oracle-reader-selection.js';
import Signer from '../Signer.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type {
  AddressType,
  ContractOptions,
  LibauthOutput,
  Output,
  TransactionDetails,
  UnlockableUtxo,
  Unlocker,
  Utxo,
} from '../interfaces.js';
import {
  StatefulTransactionBuilder,
  type EntryNftInfo,
  type ExternalCallUtxoGroup,
  selectDelegateExecutionLayout,
  isJobEventEmitCommitment,
  isAuthenticatedEventRepairCommitment,
  stampEmptyJobEventTimestamp,
  permitsLegacyNamedValueChunkFallback,
  legacyPlannedChunkableValueWriteCollection,
  type ValueChunkWriteDescriptor,
  ValueChunkWriteStagingSession,
  valueChunkWriteResourceIdentity,
} from './StatefulTransactionBuilder.js';
import { legacyIsPublishJobEventName } from './legacy-planning-heuristics.js';
import { type OnChainState, type ParsedEvent, type EventFilter } from './StateReader.js';
import {
  getDataNftAddress,
  getEntryNftAddress,
  getEventNftAddress,
  getDynamicChunkAddress,
  getValueChunkAddress,
  getTokenContainerAddress,
  getSatoshiContainerAddress,
  getContractState,
  type FramedStateOwner,
  createDataNftUnlocker,
  createEntryNftUnlocker,
  createReadOnlyEntryNftUnlocker,
  resolveCategoryFromLockingBytecode,
  resolveCategoryFromAddress,
  directConventionMasterLock,
} from './covenant-helpers.js';

const signerUtxoSnapshots = new WeakMap<object, Map<string, Map<string, Utxo>>>();

interface VmapCounterPermutationSpec {
  countName: string;
  boundOffset: bigint;
  postTest: boolean;
  start: bigint;
  step: bigint;
  exactBound?: boolean;
}

const VMAP_RUNTIME_INPUT_COUNT_PREFIX = '__internal__vmapRuntimeInputCount_';
const VMAP_RUNTIME_OUTPUT_COUNT_PREFIX = '__internal__vmapRuntimeOutputCount_';
const VMAP_COUNTER_OLD_PREFIX = '__internal__vmapCounterOld_';
const vmapRuntimeInputCountName = (collection: string): string =>
  `${VMAP_RUNTIME_INPUT_COUNT_PREFIX}${collection}`;
const vmapRuntimeOutputCountName = (collection: string): string =>
  `${VMAP_RUNTIME_OUTPUT_COUNT_PREFIX}${collection}`;

const EMPTY_ENTRY_VALUE_TAIL = new Uint8Array();

/**
 * The value tail the sorted-entry covenant writes when a chained present delete nullifies its node
 * (`delete m[k]` assigns the type default), or undefined when that default is not statically planned here
 * (struct defaults are recursive; enums and function pointers stay fail-closed). Mirrors the compiler's
 * `emitDefaultValue` plus the value-kind tail framing in GenerateTargetTraversal: int/bool/bigint/fixed
 * nullify to the minimal VM number (empty for 0/false), bytesN to N zero bytes, pubkey to 33 zero bytes,
 * address/sig/datasig to empty, unbounded bytes/string to the 4-byte zero length prefix, and an unbounded
 * array to the pushdata-encoded empty length prefix (`OP_0`, one byte) framed as `len4(1) || 0x00`.
 */
function defaultSortedEntryValueTail(valueType: string): Uint8Array | undefined {
  const arrayInfo = parseArrayTypeString(valueType);
  if (arrayInfo !== undefined) {
    // Only an unbounded array is chunkable; the compiler lowers `delete m[k]` on an unbounded array to a
    // soft delete whose default is `encodeInt(0) || pushdataEncode(bigint)` = the single `OP_0` byte.
    // Bounded arrays are fixed-width and lower to a conditional write, which the write path already plans.
    if (arrayInfo.bound === undefined) return encodeChunkableValueTail(new Uint8Array([0x00]));
    return undefined;
  }
  if (valueType === 'bool' || valueType === 'bigint'
    || /^u?int\d*$/.test(valueType) || /^u?fixed\d*x\d*$/.test(valueType)) {
    return EMPTY_ENTRY_VALUE_TAIL;
  }
  const bytesN = /^(?:byte|bytes(\d+))$/.exec(valueType);
  if (bytesN) {
    const width = bytesN[1] === undefined ? 1 : Number(bytesN[1]);
    if (width >= 1 && width <= 32) return new Uint8Array(width);
    return undefined;
  }
  if (valueType === 'pubkey') return new Uint8Array(33);
  if (valueType === 'bytes' || valueType === 'string') {
    // The length-framed default: `len4(0)` with no inline payload.
    return encodeChunkableValueTail(EMPTY_ENTRY_VALUE_TAIL);
  }
  if (valueType === 'address' || valueType === 'address payable'
    || valueType === 'sig' || valueType === 'datasig') {
    return EMPTY_ENTRY_VALUE_TAIL;
  }
  // Struct defaults are recursive and stay fail-closed here.
  return undefined;
}

function vmapCounterPermutationValues(
  bound: bigint,
  spec: VmapCounterPermutationSpec,
): bigint[] {
  const effectiveBound = bound + spec.boundOffset;
  if (spec.step === 0n) throw new Error('vmap counter loop step must be non-zero');
  if (spec.exactBound) {
    const distance = spec.step > 0n
      ? effectiveBound - spec.start : spec.start - effectiveBound;
    const directionMatches = spec.postTest ? distance > 0n : distance >= 0n;
    if (!directionMatches) {
      throw new Error(`vmap counter loop exact bound '${spec.countName}' must be in the direction of its step`);
    }
    const magnitude = spec.step > 0n ? spec.step : -spec.step;
    if (distance % magnitude !== 0n) {
      throw new Error(`vmap counter loop exact bound '${spec.countName}' must be reachable by its step`);
    }
  }
  // Legacy unit-domain rows authenticate the public bound itself as the iteration count, including its
  // historical non-negative constraint. Ranged and affine rows authenticate the derived progression length,
  // so a bound below their start is a valid zero-trip domain.
  if (spec.boundOffset === 0n && !spec.postTest
    && spec.start === 0n && spec.step === 1n && effectiveBound < 0n) {
    throw new Error(`vmap counter loop bound '${spec.countName}' must be between 0 and 64`);
  }
  const naturalCount = spec.step > 0n
    ? (effectiveBound > spec.start ? ((effectiveBound - spec.start - 1n) / spec.step) + 1n : 0n)
    : (effectiveBound < spec.start ? ((spec.start - effectiveBound - 1n) / -spec.step) + 1n : 0n);
  const iterationCount = spec.postTest && naturalCount === 0n ? 1n : naturalCount;
  if (iterationCount < 0n || iterationCount > 64n) {
    throw new Error(
      `vmap counter loop bound '${spec.countName}' produces an iteration count outside 0..64`,
    );
  }
  return Array.from(
    { length: Number(iterationCount) },
    (_unused, index) => spec.start + BigInt(index) * spec.step,
  );
}

function signerSnapshotMap(signer: Signer): Map<string, Utxo> | undefined {
  return signerUtxoSnapshots.get(signer.provider as object)?.get(signer.getAddress());
}

async function signerUtxoSnapshot(signer: Signer): Promise<Utxo[]> {
  const cached = signerSnapshotMap(signer);
  if (cached && cached.size > 0) return [...cached.values()];
  const fetched = await signer.getUtxos();
  let providerSnapshots = signerUtxoSnapshots.get(signer.provider as object);
  if (!providerSnapshots) {
    providerSnapshots = new Map();
    signerUtxoSnapshots.set(signer.provider as object, providerSnapshots);
  }
  providerSnapshots.set(
    signer.getAddress(), new Map(fetched.map((utxo) => [`${utxo.txid}:${utxo.vout}`, utxo])),
  );
  return fetched;
}

function retireSignerUtxos(signer: Signer, utxos: readonly Utxo[]): void {
  const cached = signerSnapshotMap(signer);
  if (!cached) return;
  for (const utxo of utxos) cached.delete(`${utxo.txid}:${utxo.vout}`);
}

function invalidateSignerUtxos(signer: Signer): void {
  signerUtxoSnapshots.get(signer.provider as object)?.delete(signer.getAddress());
}
import {
  findDeploymentByAddress,
  findDeploymentByLockingBytecode,
  findDeploymentByName,
  registeredExecutionLockingBytecode,
  registeredValueAddressLockingBytecode,
} from './deployment-registry.js';
import {
  loadCreateBuilderOnChainState as loadCreateBuilderOnChainStateImpl,
} from './sc-load-create-builder-on-chain-state.js';
import {
  resolveCreateBuilderMasterAndDataNfts as resolveCreateBuilderMasterAndDataNftsImpl,
} from './sc-resolve-create-builder-master-and-data-nfts.js';
import {
  materializeCreateBuilderVmapPermutations as materializeCreateBuilderVmapPermutationsImpl,
} from './sc-materialize-create-builder-vmap-permutations.js';
import {
  materializeCreateBuilderEarlyArgs as materializeCreateBuilderEarlyArgsImpl,
  type MaterializeCreateBuilderEarlyArgsHost,
} from './sc-materialize-create-builder-early-args.js';
import { resolveCreateBuilderEntryAbi as resolveCreateBuilderEntryAbiImpl } from './sc-resolve-create-builder-entry-abi.js';
import {
  loadCreateBuilderExternalReads as loadCreateBuilderExternalReadsImpl,
  type LoadCreateBuilderExternalReadsHost,
} from './sc-load-create-builder-external-reads.js';
import {
  createBuilderLoadDelegatedDynamicChunks as createBuilderLoadDelegatedDynamicChunksImpl,
} from './sc-create-builder-delegated-dynamic-chunks.js';
import {
  orchestrateCreateBuilderNestedComposeCallsite as orchestrateCreateBuilderNestedComposeCallsiteImpl,
} from './sc-orchestrate-create-builder-nested-compose-callsite.js';
import {
  orchestrateCreateBuilderExternalCalls as orchestrateCreateBuilderExternalCallsImpl,
} from './sc-orchestrate-create-builder-external-calls.js';
import {
  loadCreateBuilderIterationInputs as loadCreateBuilderIterationInputsImpl,
} from './sc-load-create-builder-iteration-inputs.js';
import {
  loadCreateBuilderSortedInsertLoops as loadCreateBuilderSortedInsertLoopsImpl,
} from './sc-load-create-builder-sorted-insert-loops.js';
import {
  finalizeCreateBuilderEntryDeleteSlots as finalizeCreateBuilderEntryDeleteSlotsImpl,
} from './sc-finalize-create-builder-entry-delete-slots.js';
import {
  resolveCreateBuilderUpsertLoopDomainKeys as resolveCreateBuilderUpsertLoopDomainKeysImpl,
} from './sc-resolve-create-builder-upsert-loop-domain-keys.js';
import {
  prepareCreateBuilderUpsertLoopKeyTopology as prepareCreateBuilderUpsertLoopKeyTopologyImpl,
} from './sc-prepare-create-builder-upsert-loop-key-topology.js';
import {
  expandCreateBuilderLateTransitive as expandCreateBuilderLateTransitiveImpl,
} from './sc-expand-create-builder-late-transitive.js';
import { planCreateBuilderNestedBases as planCreateBuilderNestedBasesImpl } from './sc-plan-create-builder-nested-bases.js';
import {
  relocateCreateBuilderPredOutBases as relocateCreateBuilderPredOutBasesImpl,
} from './sc-relocate-create-builder-pred-out-bases.js';
import {
  completeCreateBuilderNestedUnlockers as completeCreateBuilderNestedUnlockersImpl,
} from './sc-complete-create-builder-nested-unlockers.js';
import {
  projectCreateBuilderDelegateSlots as projectCreateBuilderDelegateSlotsImpl,
} from './sc-project-create-builder-delegate-slots.js';
import {
  callerIdentityAnchorBand,
  fixCreateBuilderDelegateUnlockers as fixCreateBuilderDelegateUnlockersImpl,
  isRoutePushValueWitnessName,
  resolveDelegatePushValueWitness,
} from './sc-fix-create-builder-delegate-unlockers.js';
export { callerIdentityAnchorBand, isRoutePushValueWitnessName, resolveDelegatePushValueWitness };
import {
  loadCreateBuilderTokenContainers as loadCreateBuilderTokenContainersImpl,
} from './sc-load-create-builder-token-containers.js';
import {
  loadCreateBuilderSatoshiContainer as loadCreateBuilderSatoshiContainerImpl,
} from './sc-load-create-builder-satoshi-container.js';
import {
  materializeCreateBuilderSyntheticArgs as materializeCreateBuilderSyntheticArgsImpl,
} from './sc-materialize-create-builder-synthetic-args.js';
import {
  buildCreateBuilderStateUnlockers as buildCreateBuilderStateUnlockersImpl,
} from './sc-build-create-builder-state-unlockers.js';
import {
  collectCreateBuilderEventLocks as collectCreateBuilderEventLocksImpl,
} from './sc-collect-create-builder-event-locks.js';
import {
  loadCreateBuilderDynamicChunks as loadCreateBuilderDynamicChunksImpl,
} from './sc-load-create-builder-dynamic-chunks.js';
export {
  orderedActiveTrailingEntryCollections,
  orderedTrailingEntryCollections,
} from './sc-load-create-builder-dynamic-chunks.js';
import {
  resolveCreateBuilderEffectiveLayout as resolveCreateBuilderEffectiveLayoutImpl,
} from './sc-resolve-create-builder-effective-layout.js';
import {
  applyCreateBuilderTransportedProductions as applyCreateBuilderTransportedProductionsImpl,
} from './sc-apply-create-builder-transported-productions.js';
import {
  constructCreateBuilderTransactionBuilder as constructCreateBuilderTransactionBuilderImpl,
} from './sc-construct-create-builder-transaction-builder.js';
import {
  registerCreateBuilderBuilderState as registerCreateBuilderBuilderStateImpl,
} from './sc-register-create-builder-builder-state.js';
import {
  allocateCreateBuilderFunders as allocateCreateBuilderFundersImpl,
} from './sc-allocate-create-builder-funders-accounting.js';
import {
  applyCreateBuilderPendingInputFills as applyCreateBuilderPendingInputFillsImpl,
} from './sc-apply-create-builder-pending-input-fills.js';
import {
  rebindCreateBuilderAssembledWitnesses as rebindCreateBuilderAssembledWitnessesImpl,
} from './sc-rebind-create-builder-assembled-witnesses.js';
import {
  prepareCreateBuilderDerivePrelude as prepareCreateBuilderDerivePreludeImpl,
} from './sc-prepare-create-builder-derive-prelude.js';
import {
  prepareCreateBuilderLowLevelNestedCaches as prepareCreateBuilderLowLevelNestedCachesImpl,
} from './sc-prepare-create-builder-low-level-nested-caches.js';
import {
  materializeCreateBuilderLowLevelStatefulCall as materializeCreateBuilderLowLevelStatefulCallImpl,
  publishPreparedKernelDelegateOwnerFrame,
} from './sc-materialize-create-builder-low-level-stateful-call.js';
export { publishPreparedKernelDelegateOwnerFrame };
import { runCreateBuilderDerivePass as runCreateBuilderDerivePassImpl } from './sc-run-create-builder-derive-pass.js';
import { settlesSortedTargetsByActivity } from './conditional-sorted-activity.js';
import {
  materializeCreateBuilderReturnEmit as materializeCreateBuilderReturnEmitImpl,
} from './sc-materialize-create-builder-return-emit.js';
import {
  finishCreateBuilderAtomicPromotion as finishCreateBuilderAtomicPromotionImpl,
} from './sc-finish-create-builder-atomic-promotion.js';
import { destroyStatefulContract as destroyStatefulContractImpl } from './sc-destroy.js';
import { queryEvents as queryEventsImpl } from './sc-query-events.js';
import { getEntries as getEntriesImpl } from './sc-get-entries.js';
import { inferConstructorArgs as inferConstructorArgsImpl } from './sc-infer-constructor-args.js';
import {
  prepareDeriveFullValueChunkWrites as prepareDeriveFullValueChunkWritesImpl,
} from './sc-prepare-derive-full-value-chunk-writes.js';
import {
  rebaseDeriveFullProbeDelegateWitnesses as rebaseDeriveFullProbeDelegateWitnessesImpl,
} from './sc-rebase-derive-full-probe-delegate-witnesses.js';
import {
  reconcileDeriveFullReturnWitnesses as reconcileDeriveFullReturnWitnessesImpl,
  rebindDeriveFullExternalResourceMaster as rebindDeriveFullExternalResourceMasterImpl,
} from './sc-derive-full-return-witness-helpers.js';
import { deriveFullPhase1GroupFront as deriveFullPhase1GroupFrontImpl } from './sc-derive-full-phase1-group-front.js';
import {
  deriveFullPhase1PostEvaluateDataCommitments as deriveFullPhase1PostEvaluateDataCommitmentsImpl,
} from './sc-derive-full-phase1-post-evaluate-data-commitments.js';
import {
  deriveFullPhase1ProgressiveEntries as deriveFullPhase1ProgressiveEntriesImpl,
} from './sc-derive-full-phase1-progressive-entries.js';
import {
  deriveFullPhase1ReturnAndEvents as deriveFullPhase1ReturnAndEventsImpl,
} from './sc-derive-full-phase1-return-and-events.js';
import {
  deriveFullPhase1bOutStateAndLowLevel as deriveFullPhase1bOutStateAndLowLevelImpl,
} from './sc-derive-full-phase1b-outstate-and-llc.js';
import {
  seedDeriveFullPhase2Placeholders as seedDeriveFullPhase2PlaceholdersImpl,
} from './sc-seed-derive-full-phase2-placeholders.js';
import { prepareDeriveFullPhase2Loop as prepareDeriveFullPhase2LoopImpl } from './sc-prepare-derive-full-phase2-loop.js';
import {
  deriveFullPhase2IterationProbe as deriveFullPhase2IterationProbeImpl,
} from './sc-derive-full-phase2-iteration-probe.js';
import {
  deriveFullPhase2ApplyStateAndEntries as deriveFullPhase2ApplyStateAndEntriesImpl,
} from './sc-derive-full-phase2-apply-state-entries.js';
import {
  deriveFullPhase2ApplyDynamicChunks as deriveFullPhase2ApplyDynamicChunksImpl,
} from './sc-derive-full-phase2-apply-dynamic-chunks.js';
import {
  deriveFullPhase2ApplyLoopEntries as deriveFullPhase2ApplyLoopEntriesImpl,
} from './sc-derive-full-phase2-apply-loop-entries.js';
import {
  deriveFullPhase2ApplyRuntimeLoop as deriveFullPhase2ApplyRuntimeLoopImpl,
} from './sc-derive-full-phase2-apply-runtime-loop.js';
import { traceRuntimeEffectStreamRuns } from './runtime-effect-stream-trace.js';
import { deriveNestedStreamedEvents } from './nested-streamed-events.js';
import {
  deriveFullPhase2ApplyValueChunks as deriveFullPhase2ApplyValueChunksImpl,
} from './sc-derive-full-phase2-apply-value-chunks.js';
import {
  applyDeriveFullNestedValueChunkPin as applyDeriveFullNestedValueChunkPinImpl,
} from './sc-apply-derive-full-nested-value-chunk-pins.js';
import {
  applyDeriveFullNestedEntryPins as applyDeriveFullNestedEntryPinsImpl,
} from './sc-apply-derive-full-nested-entry-pins.js';
import {
  applyDeriveFullNestedCommitsEventPins as applyDeriveFullNestedCommitsEventPinsImpl,
} from './sc-apply-derive-full-nested-commits-event-pins.js';
import {
  deriveFullPhase2ApplyDynamicRescanAndEvents as deriveFullPhase2ApplyDynamicRescanAndEventsImpl,
} from './sc-derive-full-phase2-apply-events.js';
import {
  deriveFullPhase2ApplyTransfers as deriveFullPhase2ApplyTransfersImpl,
} from './sc-derive-full-phase2-apply-transfers.js';
import { deriveFullPhase2Convergence as deriveFullPhase2ConvergenceImpl } from './sc-derive-full-phase2-convergence.js';
import {
  deriveFullPhase2CleanedRescan as deriveFullPhase2CleanedRescanImpl,
} from './sc-derive-full-phase2-cleaned-rescan.js';
import {
  hydrateExternalPredicateState as hydrateExternalPredicateStateImpl,
} from './sc-hydrate-external-predicate-state.js';
import { upgradeStatefulContract as upgradeStatefulContractImpl } from './sc-upgrade.js';
import {
  splitStatefulContract as splitStatefulContractImpl,
  mergeStatefulContract as mergeStatefulContractImpl,
} from './sc-split-merge.js';
import { withDelegatecall as withDelegatecallImpl } from './sc-with-delegatecall.js';
import { autoWireLibraryDelegatecalls as autoWireLibraryDelegatecallsImpl } from './sc-auto-wire-library-delegatecalls.js';
import { addressMappingKeyCandidates as addressMappingKeyCandidatesImpl } from './sc-address-mapping-key-candidates.js';
import { deployStatefulContract as deployStatefulContractImpl } from './sc-deploy.js';
import { deployFromStatefulContract as deployFromStatefulContractImpl } from './sc-deploy-from.js';
import { deriveDeployCommitments as deriveDeployCommitmentsImpl } from './sc-derive-deploy-commitments.js';
import { deriveCommitments as deriveCommitmentsImpl } from './sc-derive-commitments.js';
import {
  softApplyPairMint as softApplyPairMintImpl,
  softApplyUpdateExchangeRate as softApplyUpdateExchangeRateImpl,
} from './sc-soft-apply-pair-overlays.js';
import { softApplyNoopReceipt as softApplyNoopReceiptImpl } from './sc-soft-apply-noop-receipt.js';
import {
  softAccrueInterest as softAccrueInterestImpl,
  softApplyKashiStateSideEffects as softApplyKashiStateSideEffectsImpl,
  softAdjustKashiBorrow as softAdjustKashiBorrowImpl,
  softAdjustKashiAsset as softAdjustKashiAssetImpl,
  softAdjustKashiCollateral as softAdjustKashiCollateralImpl,
  softCreditBentoCollateral as softCreditBentoCollateralImpl,
} from './sc-soft-apply-kashi.js';
import {
  resolveExternalKeccakSideCars as resolveExternalKeccakSideCarsImpl,
} from './sc-resolve-external-keccak-side-cars.js';
import { kashiSoftFailCode as kashiSoftFailCodeImpl } from './sc-kashi-soft-fail-code.js';
import { sendRawBuilder as sendRawBuilderImpl } from './sc-send-raw-builder.js';
import {
  buildSplitTransactionBuilder as buildSplitTransactionBuilderImpl,
  buildMergeTransactionBuilder as buildMergeTransactionBuilderImpl,
} from './sc-split-merge-builders.js';
import {
  encodeStoredElementSource as encodeStoredElementSourceImpl,
  encodeStoredValueSource as encodeStoredValueSourceImpl,
} from './sc-encode-stored-element-source.js';
import { foldRouteStoredValues } from './fold-route-stored-values.js';
import {
  replaceRepeatedExternalBatchRow as replaceRepeatedExternalBatchRowImpl,
} from './sc-replace-repeated-external-batch-row.js';
import { buildRepeatedExternalBatch as buildRepeatedExternalBatchImpl } from './sc-build-repeated-external-batch.js';
import { resolveExternalArgs as resolveExternalArgsImpl } from './sc-resolve-external-args.js';
import { sendWithoutLogicalNonce as sendWithoutLogicalNonceImpl } from './sc-send-without-logical-nonce.js';
import { pushAutoResolvedExternalCall as pushAutoResolvedExternalCallImpl } from './sc-with-external-call.js';
import { resolveEcrecoverComputeCoSpends as resolveEcrecoverComputeCoSpendsImpl } from './sc-resolve-ecrecover-co-spends.js';
import { resolveStatefulKeccakLoop as resolveStatefulKeccakLoopImpl } from './sc-resolve-stateful-keccak-loop.js';
import {
  keccakProbeTrailingRun,
  resolveKeccakComputeCoSpends as resolveKeccakComputeCoSpendsImpl,
  type ResolveKeccakProbeCtx,
} from './sc-resolve-keccak-compute-co-spends.js';
import {
  paramBlockhashN as paramBlockhashNImpl,
  extractBlockhashReads as extractBlockhashReadsImpl,
  extractGraphBlockhashRead as extractGraphBlockhashReadImpl,
  resolveBlockhashCoSpends as resolveBlockhashCoSpendsImpl,
} from './sc-resolve-blockhash-co-spends.js';
import {
  refreshProjectedExternalReturns as refreshProjectedExternalReturnsImpl,
} from './sc-refresh-projected-external-returns.js';
import { evaluateExternalExpression as evaluateExternalExpressionImpl } from './sc-evaluate-external-expression.js';
import {
  resolveExternalExpressionReturns as resolveExternalExpressionReturnsImpl,
} from './sc-resolve-external-expression-returns.js';
import {
  deriveReturnBlob as deriveReturnBlobImpl,
  describeReturnProbeFailure as describeReturnProbeFailureImpl,
  messageBusReturnBlobFromTransaction as messageBusReturnBlobFromTransactionImpl,
  messageBusEventCommitmentsFromTransaction as messageBusEventCommitmentsFromTransactionImpl,
} from './sc-derive-return-blob.js';
import { buildNamespaces as buildNamespacesImpl } from './sc-build-namespaces.js';
import { deriveReturnValue as deriveReturnValueImpl } from './sc-derive-return-value.js';
import { resolveSelectedDynamicWrites } from './selected-dynamic-writes.js';
import { applyOverrides as applyOverridesImpl, reApplyOverrides as reApplyOverridesImpl } from './sc-apply-overrides.js';
import {
  batchRaw as batchRawImpl,
  mergePublishedMessageBusHandlerMetadata,
  type BatchExecutionContextBinding,
} from './sc-batch-raw.js';
export { mergePublishedMessageBusHandlerMetadata };
import { runtimeEntryAliasOwners } from './sorted-batch-activity.js';
export { runtimeEntryAliasOwners };
export { uniqueParticipantIndexForTarget } from './physical-external-call.js';
export {
  assertAcyclicExternalCallPath,
  visitExpandingExternalCallGroups,
} from './external-call-graph-frontier.js';
import { buildStatefulFunctionCall as buildStatefulFunctionCallImpl } from './sc-build-stateful-function-call.js';
import { kernelReadCarrierCapabilityForSelectedRoute } from './kernel-read-carrier-route.js';
export {
  authenticateKernelReadCarrierRoute,
  canonicalKernelCarrierEnvelopeRows,
  kernelJournalAuthorityFingerprint,
  kernelReadCarrierCapabilityForSelectedRoute,
  kernelReadCarrierRouteIsCurrent,
} from './kernel-read-carrier-route.js';
import { decodeScriptNumber } from './trace-commitment-helpers.js';
export {
  compactFaithfulProbeTrace,
  evaluateBoundedProbeCandidates,
  evaluateProbeTrace,
  MAX_BOUNDED_PROBE_STATES,
} from './faithful-probe-trace.js';
import { isCanonicalEvmScalarReturnVector, probeRequireMessage } from './external-return-encoding.js';
export {
  isCanonicalEvmScalarReturnVector,
  probeRequireMessage,
  probeRequireStatement,
  decodeEvmScalarReturn,
  decodeEvmReturnValue,
  decodeAuthenticatedProducerResultVector,
} from './external-return-encoding.js';
import { type RouteProbeObservation } from './route-probe-progress.js';

import { getFramedCallHandleModule, loadFramedCallHandle } from './framed-call-loader.js';

function isFramedArtifact(artifact: Artifact): boolean {
  return artifact.composition?.convention === 'framed';
}

function functionArgumentValuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if ((typeof left === 'bigint' || typeof left === 'number')
    && (typeof right === 'bigint' || typeof right === 'number')) {
    return BigInt(left) === BigInt(right);
  }
  if (left instanceof Uint8Array && right instanceof Uint8Array) return binsAreEqual(left, right);
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length
      && left.every((value, index) => functionArgumentValuesEqual(value, right[index]));
  }
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const leftEntries = Object.entries(left as Record<string, unknown>);
    const rightRecord = right as Record<string, unknown>;
    return leftEntries.length === Object.keys(rightRecord).length
      && leftEntries.every(([key, value]) => functionArgumentValuesEqual(value, rightRecord[key]));
  }
  return false;
}

function functionArgumentListsEqual(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length
    && left.every((value, index) => functionArgumentValuesEqual(value, right[index]));
}

type GraphPlanningProducerResultEntry = {
  args: readonly unknown[];
  target: unknown;
  provisional: boolean;
  pending: Promise<FunctionArgument | undefined>;
};

/** One graph-build epoch's speculative producer results, indexed by compiler-stable callsite identity. */
export interface GraphPlanningProducerResultContext {
  readonly entries: Map<number, GraphPlanningProducerResultEntry[]>;
}

export function createGraphPlanningProducerResultContext(): GraphPlanningProducerResultContext {
  return { entries: new Map() };
}

export function isCompilerDescribedRouteEventCommitment(
  commitment: string | undefined,
  compilerMetadata: { compilerOwnedEventSlot: boolean; eventSignature?: string },
): commitment is string {
  if (commitment === undefined || commitment.length === 0 || commitment.length % 2 !== 0) return false;
  const compilerDescribed = compilerMetadata.compilerOwnedEventSlot
    && typeof compilerMetadata.eventSignature === 'string'
    && compilerMetadata.eventSignature.length > 0;
  if (compilerMetadata.compilerOwnedEventSlot && !compilerDescribed) return false;
  return isAuthenticatedEventRepairCommitment(hexToBin(commitment), compilerDescribed);
}

function snapshotFunctionArgument(value: unknown): unknown {
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (Array.isArray(value)) return value.map(snapshotFunctionArgument);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([key, child]) => [key, snapshotFunctionArgument(child)]));
  }
  return value;
}

/**
 * Evaluate one published producer at most once for an unchanged callsite invocation in a planning epoch.
 * Exact results may seed provisional consumers, but provisional fallbacks never satisfy an exact request.
 */
export async function memoizeGraphPlanningProducerResult(
  context: GraphPlanningProducerResultContext,
  callsiteId: number,
  args: readonly FunctionArgument[],
  target: FunctionArgument | undefined,
  provisional: boolean,
  evaluate: () => Promise<FunctionArgument | undefined>,
): Promise<FunctionArgument | undefined> {
  const entries = context.entries.get(callsiteId) ?? [];
  const matching = entries.find((entry) => (
    (entry.provisional === provisional || (provisional && !entry.provisional))
    && functionArgumentListsEqual(entry.args, args)
    && functionArgumentValuesEqual(entry.target, target)
  ));
  if (matching) return matching.pending;
  const pending = evaluate();
  entries.push({
    args: args.map(snapshotFunctionArgument),
    target: snapshotFunctionArgument(target),
    provisional,
    pending,
  });
  context.entries.set(callsiteId, entries);
  return pending;
}

/** @internal Resolve one compiler-authored terminal forwarding edge for atomic delegate promotion. */
// Kernel delegate / kernel entry-journal / message-bus route planners live in their own plugin module.
export {
  resolvePreparedKernelDelegateExecution,
  resolvePreparedKernelDelegateOwnerFrame,
  selectKernelDelegateForwardingGroupIndex,
  materializeInternalFunctionArgument,
  type KernelJournalRecordSegmentWitnesses,
  assertKernelJournalRecordBudget,
  kernelJournalRecordSegmentWitnesses,
  kernelJournalAccessStreamPlaceholders,
  type SelectedKernelJournalStream,
  kernelReadCarrierOwnsDuplicateProof,
  type SelectedKernelJournalHandler,
  shouldDeferKernelJournalMaterialization,
  shouldDeferKernelJournalBatchMaterialization,
  type KernelJournalEagerOutputOccurrence,
  type AuthenticatedKernelJournalDispositionPlan,
  planAuthenticatedKernelJournalDispositionChain,
  assertKernelReadCarrierAuthenticatedRows,
  selectedMessageBusResourceMetadata,
  anchorRoutedDynamicResourcesAtOwner,
  compilerRouteUsesPhysicalWrapper,
  rebaseRoutedBatchProofOffsets,
} from './kernel-route-planning.js';

/**
 * Compute the minimum relay fee for a built TransactionBuilder at 1 sat/byte.
 * Uses the serialized transaction size as the fee floor.
 */
async function computeFeeFromBuilder(builder: TransactionBuilder): Promise<bigint> {
  const { encodeTransaction } = await import('@bitauth/libauth/build/lib/message/transaction-encoding.js');

  const tx = builder.buildLibauthTransaction();
  return BigInt(encodeTransaction(tx).byteLength);
}

/**
 * X176. One published reason an ABI entry's `writesState` is not `false`.
 *
 * Named for the EVIDENCE, not for a conclusion: several may hold at once and the ABI does not say which one the
 * compiler stopped at, so every one that is published is reported.
 */
export type StateEffectEvidence =
  /** A collection entry is written, deleted or upserted, straight-line or as a fixed sorted batch. */
  | 'entry-write'
  /** A collection is written by a runtime loop, or by a sorted insert loop. */
  | 'entry-loop-write'
  /** A chunk-backed dynamic-storage variable is rewritten. */
  | 'dynamic-write'
  /** A lifecycle modifier that rewrites or retires the covenant: upgrade, selfdestruct, delegate, unsafe. */
  | 'lifecycle-modifier'
  /** `split(n)` / `merge(n)`: the master set changes, the state variables do not. */
  | 'split-merge'
  /** An event NFT is minted. Output shape, not a state variable. */
  | 'emit'
  /** Native value is moved. Balance, not a state variable. */
  | 'transfer'
  /** A token container is read or written. */
  | 'token-container'
  /** A child contract is deployed. The CHILD gets state; this handler's own variables need not move. */
  | 'deploy'
  /** ANOTHER contract's handler is co-spent. The callee's state may change; this handler's need not. */
  | 'external-call'
  /** A delegate-library call, or a low-level call/staticcall/delegatecall. */
  | 'delegate-or-low-level';

/**
 * X176. What `writesState` actually answers about one ABI entry.
 *
 * `writesState` IS READ BY COMPOSERS AS "THIS HANDLER MUTATES STATE" AND IT DOES NOT MEAN THAT. The compiler
 * computes it conservatively: `false` only when the body has NO stateful statement and the function has no
 * external call, child deploy, library delegate, dynamic write, low-level call, split/merge or covenant-bypass
 * modifier. Anything else is `true`, so `true` means "not provably read-only", which in SDK terms is "needs the
 * state machinery" - and that is a strictly weaker claim than "changes a state variable".
 *
 * MEASURED, not argued. `Foo.callBar` publishes `writesState: true` and its whole body is `bar.log();` - one
 * external call and not one assignment. `Attack.attack` is the same shape. So of the seven handlers the L2-F2
 * partition counts as explicit writers, at least two write nothing at all, and the four that publish the flag
 * ABSENT and are conservatively counted as writers are handlers of contracts with `dataNftCount === 0`, which
 * have no state variable for any handler to change.
 *
 * ONE READING IS SOUND IN ONE DIRECTION ONLY, and this type keeps that visible:
 *   `writesState === false`  the compiler PROVED read-only. Sound to act on - it is what the derivation skip
 *                            in `_prepareCall` acts on, and misclassification there fails closed anyway.
 *   `writesState === true`   NOT a proof of mutation. Read `evidence`.
 *   absent                   unknown or stateless. Never a proof of either.
 */
export interface StateEffectReading {
  /** The field verbatim, including the absent case. */
  published: boolean | undefined;
  /** The only sound reading of the flag: everything but an explicit `false` needs the machinery. */
  needsStateMachinery: boolean;
  /** True only for an explicit `false` - the compiler's own proof that output state == input state. */
  provablyReadOnly: boolean;
  /** Published evidence that this handler changes its OWN persisted state. */
  ownStateEvidence: StateEffectEvidence[];
  /** Published evidence of an effect that is NOT a change to this handler's own state variables. */
  otherEffectEvidence: StateEffectEvidence[];
  /**
   * The flag is set and the ABI itemizes NOTHING. A plain `this.x = y` lands here: the ABI publishes no
   * "assigns a state variable" field, so this is as close as an artifact gets to naming one - and it is
   * indistinguishable from a bus-mode journal reservation, which is why it is reported rather than concluded.
   */
  unattributed: boolean;
  /**
   * The contract has NO data NFT, so it has no persisted state variable and no handler of it can change one.
   * Structural and decisive where it applies; requires the artifact, so it is false when only the ABI entry is
   * supplied. This is what settles the four absent-flag handlers.
   */
  contractHasNoState: boolean;
}

/** Evidence classes that are changes to the handler's OWN persisted state. */
const OWN_STATE_EVIDENCE: readonly StateEffectEvidence[] = [
  'entry-write', 'entry-loop-write', 'dynamic-write', 'lifecycle-modifier',
];

/** Function modifiers the compiler treats as covenant-rewriting. Mirrors `STATE_WRITING_MODIFIERS`. */
const LIFECYCLE_MODIFIERS = ['upgrade', 'selfdestruct', 'delegate', 'unsafe'];

/** Custom error class for auto-derivation failures (VM execution, trace parsing, etc.) */
export class AutoDerivationError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'AutoDerivationError';
  }
}

export { resolveDynamicChunkInputBase } from './return-abi-plan.js';

export type ReturnAbiCandidate<T> = {
  logicalFunction: AbiFunction;
  physicalFunction: AbiFunction;
  context: T;
};

export type ReturnAbiPlan<T> = {
  logicalFunction: AbiFunction;
  physicalFunction: AbiFunction;
  context?: T;
};

/**
 * Select the ABI which describes a call's logical value independently from the ABI which physically carries
 * its return event. A compiler route can aggregate many rows, so a facade with no direct result fails closed
 * unless exactly one selected row returns a value.
 */
export function selectReturnAbiPlan<T>(
  functionName: string,
  directFunction: AbiFunction | undefined,
  candidates: readonly ReturnAbiCandidate<T>[],
): ReturnAbiPlan<T> | undefined {
  if ((directFunction?.outputs?.length ?? 0) > 0) {
    return { logicalFunction: directFunction!, physicalFunction: directFunction! };
  }
  const returning = candidates.filter((candidate) => candidate.logicalFunction.outputs?.length);
  if (returning.length > 1) {
    throw new Error(
      `staticCall: '${functionName}' selects ${returning.length} logical return rows; `
      + 'an aggregate compiler route has no single return value.',
    );
  }
  const selected = returning[0];
  return selected && {
    logicalFunction: selected.logicalFunction,
    physicalFunction: selected.physicalFunction,
    context: selected.context,
  };
}

export interface DeployOptions {
  /** Mint a confined blockhash keeper baton at genesis; requires a blockhash-reading artifact. */
  blockhashKeeperPublicKey?: Uint8Array;
  /** Initial keeper baton balance, spent on oracle mints and fees; default 10,000 satoshis. */
  blockhashKeeperAmount?: bigint;
  provider: NetworkProvider;
  fundingUtxo: Utxo;
  funder: Unlocker;
  initialState?: Record<string, StateValueType>;
  initArgs?: FunctionArgument[];  // arguments for constructor {} block
  changeAddress: string;
  masterAmount?: bigint;   // default 1200n
  dataNftAmount?: bigint;  // default 1200n per data NFT
  fee?: bigint;            // default 1000n
  maxFee?: bigint;         // maximum allowed fee (throws if exceeded)
  addressType?: AddressType;
  threadCount?: number;    // number of master minting NFTs (direct default 1; framed default 12)
  /** Number of validator UTXOs at the contract's address; framed deployments default to the composing size. */
  validatorCount?: number;
  /**
   * The `split: 'func'` bundle whose logical artifact is being deployed.
   *
   * Genesis mints `threadCount` empty-commitment minting NFTs at each shard's filled lock, and one validator
   * pool at the shared `addrV`. Absent, genesis mints that many copies of the one master lock.
   */
  functionSplit?: FunctionSplitBundle;
  /**
   * A dead `<salt> OP_DROP` push baked into the script. Beyond CREATE2 addressing this is the DENSITY RESERVE:
   * the BCH-2026 operation-cost budget is `operationCostBudgetPerByte x unlockingBytecodeLength`, and for
   * p2sh32 the redeem script counts toward that length, so each reserve byte buys 800 units of budget while
   * costing about 6 to carry - a net +794. A dense shape that a node refuses can be made valid by reserving
   * bytes for it. Costs: a larger script, a different contract address, and the 520-byte cap.
   */
  salt?: Uint8Array;
  /** Independently spendable, category-branded message bus verifier covenants minted by genesis. */
  messageBusVerificationInputCount?: number;
  initialBalance?: bigint; // initial satoshi container balance (created when > 0)
  /** Internal SDK composition: immutable category-bearing logical identity outputs minted by genesis. */
  identityAnchors?: Array<{ to: string | Uint8Array; commitment: string; amount?: bigint }>;
  /**
   * How the genesis holds its category's BCMR identity output, output 0 (docs/bcmr/DESIGN.md, 4.2). Defaults to a
   * token-free output at the deployer's lock.
   */
  identity?: IdentityPolicy;
  /** A BCMR registry the genesis publishes at output 1. */
  bcmr?: BcmrPublication;
  /** The ledger token's bearer form: the category the genesis creates for it, its premint and native scale. */
  nativeToken?: NativeTokenOptions;
}

export interface DeployResult<T extends Artifact = Artifact> {
  contract: ConnectedStatefulContract<T>;
  tx: TransactionDetails;
  categoryId: string;
  /** The genesis's identity output, which holds the category's BCMR authority. */
  identity?: IdentityRecord;
  /** The registry the genesis published, with the URIs its publication offers. */
  registry?: PublishedRegistry;
}

export interface UpgradeOptions<T extends Artifact = Artifact> {
  provider: NetworkProvider;
  oldContract: ConnectedStatefulContract;
  upgradeFunctionName: string;        // must have 'upgrade' modifier in ABI
  upgradeFunctionArgs: FunctionArgument[];
  newArtifact: T;
  newConstructorArgs: ConstructorArgument[];
  addressType?: AddressType;          // default: match old contract's addressType
  fee?: bigint;                       // default: 1000n
  maxFee?: bigint;                   // maximum allowed fee (throws if exceeded)
  fundingUtxo?: Utxo;                // required when new layout needs additional data NFTs
  funder?: Unlocker;                  // required when new layout needs additional data NFTs
  changeAddress?: string;             // change address for leftover funding satoshis
}

export interface UpgradeResult<T extends Artifact = Artifact> {
  contract: ConnectedStatefulContract<T>;
  tx: TransactionDetails;
  categoryId: string;
}

export interface DestroyOptions {
  provider: NetworkProvider;
  contract: ConnectedStatefulContract;
  destroyFunctionName: string;        // must have 'selfdestruct' modifier in ABI
  destroyFunctionArgs: FunctionArgument[];
  recipient: string;                  // address to send remaining funds
  fee?: bigint;                       // per-transaction fee, default 1000n
  maxFee?: bigint;                    // maximum allowed fee per tx (throws if exceeded)
  maxInputsPerTx?: number;            // conservative default ~200
  /** Token container category IDs to reclaim (satoshi containers are auto-discovered) */
  tokenContainerCategoryIds?: string[];
}

export interface DestroyResult {
  txs: TransactionDetails[];          // 1 or more transactions
  totalReclaimed: bigint;             // total satoshis sent to recipient
}

export interface DeployFromOptions<T extends Artifact = Artifact> {
  provider: NetworkProvider;
  factory: ConnectedStatefulContract;        // the factory contract
  deployFunctionName: string;                // must have 'deploy' modifier
  deployFunctionArgs: FunctionArgument[];    // user args to the factory's deploy function
  childArtifact?: T;                         // child artifact; else resolved via factory.registerChild()
  childConstructorArgs?: ConstructorArgument[]; // else derived from the deploy args (new C(param) mapping)
  childSalt?: Uint8Array;                    // create2 salt; else derived from the recorded new C{salt}() mapping
  /** Optional initial values for fields the constructor descriptor does not authenticate. Attempts to override
   * authenticated constructor fields are rejected; non-default values for other fields must still satisfy the
   * factory's on-chain genesis covenant. */
  childInitialState?: Record<string, StateValueType>;
  // `new Child{value: x}()` transfers x sats from the factory's OWN satoshi container (the value source, like any
  // scash value transfer - EVM-faithful "from the deployer's balance") to the child's address. deployFrom then
  // co-spends the factory container (input) + recreates it (output, minus x) + adds the x-sat transfer output.
  // The factory must have been deployed with an initialBalance >= x. Supply the transferred amount here.
  childValue?: bigint;
  // A deploy function that transfers CashTokens from the factory's token container - e.g. to the freshly-created
  // child (`Child ch = new Child(...); this.tokens[cat].transfer(<addr>, amt)`). Supply each FT transfer the deploy
  // performs; deployFrom co-spends the factory's token container, recreates it (amount minus the transfers), and
  // adds each tcTransfer output. `to` is the recipient locking bytecode/address (pass the child's address to fund
  // the new contract). Multiple categories are co-spent + recreated in one deploy. NFT (transferNft) transfers on
  // deploy are not yet supported. See docs/contract-creation.md.
  childTokenTransfers?: Array<{ categoryId: string; to: string | Uint8Array; amount: bigint }>;
  fundingUtxo: Utxo;                         // must be at vout 0 for token genesis (becomes child category)
  // A LOOP deploy (`for (i<n) new C()`) mints N children - a balanced contract block needs N funding inputs
  // (any value, each vout 0), one per child; child i's category = fundingUtxos[i].txid. When set, this supersedes
  // the single fundingUtxo (which stays fundingUtxos[0] for a 1-child deploy). See docs/contract-creation.md.
  fundingUtxos?: Utxo[];
  funder?: Unlocker;                         // unlocker for funding UTXO(s); else factory.setDeployDefaults()
  addressType?: AddressType;
  fee?: bigint;                              // default: 1000n
  maxFee?: bigint;                           // maximum allowed fee (throws if exceeded)
  changeAddress?: string;
  masterAmount?: bigint;                     // default: 1200n
  dataNftAmount?: bigint;                    // default: 1200n per data NFT
}

// Options for the `factory.deployFn(...args).deploy({...})` sugar: the provider, factory, deploy-function
// name and args are taken from the call itself, leaving only the child + funding details.
export type DeployFromCallOptions<T extends Artifact = Artifact> =
  Omit<DeployFromOptions<T>, 'provider' | 'factory' | 'deployFunctionName' | 'deployFunctionArgs'>;

export interface DeployFromResult<T extends Artifact = Artifact> {
  factory: ConnectedStatefulContract;        // factory with updated state
  child: ConnectedStatefulContract<T>;       // newly deployed child contract
  tx: TransactionDetails;
  childCategoryId: string;
}

export interface SplitOptions {
  provider: NetworkProvider;
  contract: ConnectedStatefulContract;
  splitFunctionName: string;             // must have 'split' modifier in ABI
  splitFunctionArgs: FunctionArgument[]; // includes the count N
  funder: Unlocker;                      // unlocker for funding UTXO(s)
  fundingUtxos: Utxo[];                  // funding UTXOs for fees + new NFT dust
  changeAddress: string;
  fee?: bigint;                          // default: 1000n
  maxFee?: bigint;                       // maximum allowed fee (throws if exceeded)
  newMintingAmount?: bigint;             // satoshis per new minting NFT, default: 1200n
}

export interface SplitResult {
  tx: TransactionDetails;
  categoryId: string;
}

export interface MergeOptions {
  provider: NetworkProvider;
  contract: ConnectedStatefulContract;
  mergeFunctionName: string;             // must have 'merge' modifier in ABI
  mergeFunctionArgs: FunctionArgument[]; // includes the count N
  funder: Unlocker;                      // unlocker for funding UTXO(s)
  consumedMasterUtxos: Utxo[];           // minting NFT UTXOs to consume
  fundingUtxos: Utxo[];                  // funding UTXOs for fees
  changeAddress: string;
  fee?: bigint;                          // default: 1000n
  maxFee?: bigint;                       // maximum allowed fee (throws if exceeded)
}

export interface MergeResult {
  tx: TransactionDetails;
  categoryId: string;
}

export interface ExternalCallInfo {
  externalContract: StatefulContract;
  functionName: string;
  args: FunctionArgument[];
  stateOverrides?: Record<string, StateValueType>;
}

/**
 * Specification for an external contract in a flat map.
 * Used by `externalContracts` option in `connect()` / `from()` to auto-wire the graph.
 */
export interface ExternalContractSpec {
  artifact: Artifact;
  categoryId: string;
  /** Explicit constructor args override. When omitted, inferred from ABI metadata. */
  constructorArgs?: ConstructorArgument[];
}

/** Options for `StatefulContract.withCategory()` and `StatefulContract.from()`. */
export interface StatefulConnectOptions {
  /** Pre-built external contracts, manually wired. */
  externals?: Record<string, ConnectedStatefulContract>;
  /**
   * Flat map of interface name -> external contract spec.
   * SDK auto-creates Contract + StatefulContract objects, infers constructor args
   * from ABI metadata (categoryParam -> category ID), and wires the externals graph.
   *
   * Covers the full chain: if A references IB and B references IC, provide both
   * `{ IB: ..., IC: ... }` and the SDK wires B->IC automatically.
   */
  externalContracts?: Record<string, ExternalContractSpec>;
}

export type CallInfo = {
  type: 'stateful';
  contract: StatefulContract;
  functionName: string;
  args: FunctionArgument[];
  /** Compiler-owned route selected for this physical callee (used by atomic delegate composition). */
  compilerRoute?: NonNullable<ExternalCallUtxoGroup['compilerRoute']>;
  /** For delegatecall: the proxy's master input index in the transaction. Defaults to 0. */
  proxyMasterIndex?: number;
  /**
   * Locking bytecode of the contract that CALLS this callee frame. The runtime resolves the frame's `msg.sender`
   * from this identity (the same value the compiler receives as `__internal__msgSenderCategory`), so a
   * `msg.sender`-keyed mapping inside the frame must hash it rather than the transaction origin.
   */
  callerLockingBytecode?: Uint8Array;
} | {
  type: 'raw';
  utxo: UnlockableUtxo;
};

// X10. Cap on the speculative growth of a dynamic-storage chunk region whose length the probe has not revealed
// yet (a trailing vmap entry mint aborts the probe before the data NFT is verified). One extra probe per output,
/** Concatenate a pushdata-encoded struct onto a JobEventData[] (or similar) blob. */
function appendEncodedArrayElement(arrayBlob: Uint8Array, element: Uint8Array): Uint8Array {
  const count = decodePushdataValue(arrayBlob, 0, 'bigint');
  const prefix = encodePushdataValue(BigInt(count.value as bigint) + 1n, 'bigint');
  const out = new Uint8Array(prefix.length + (arrayBlob.length - count.bytesConsumed) + element.length);
  out.set(prefix, 0);
  out.set(arrayBlob.subarray(count.bytesConsumed), prefix.length);
  out.set(element, prefix.length + arrayBlob.length - count.bytesConsumed);
  return out;
}

/** Concatenate two pushdata-encoded dynamic arrays of the same element type. */
function concatenateEncodedArrays(left: Uint8Array, right: Uint8Array): Uint8Array {
  const leftCount = decodePushdataValue(left, 0, 'bigint');
  const rightCount = decodePushdataValue(right, 0, 'bigint');
  const prefix = encodePushdataValue(
    BigInt(leftCount.value as bigint) + BigInt(rightCount.value as bigint),
    'bigint',
  );
  const leftElements = left.subarray(leftCount.bytesConsumed);
  const rightElements = right.subarray(rightCount.bytesConsumed);
  const out = new Uint8Array(prefix.length + leftElements.length + rightElements.length);
  out.set(prefix, 0);
  out.set(leftElements, prefix.length);
  out.set(rightElements, prefix.length + leftElements.length);
  return out;
}

/**
 * Keep a chunkable array access's authenticated inputs separate from its derived result.
 *
 * The value witness is the exact proof-entry value before the handler. A leading mutation
 * represents earlier selected rows, while `postValue` is used only for persistence and
 * continuation outputs. In particular, deriving `postValue` must never replace the witness.
 */
export function deriveChunkableArrayValueChannels({
  preValueWitness,
  storedPreValue,
  leadingMutation,
  currentElement,
}: {
  preValueWitness?: Uint8Array;
  storedPreValue: Uint8Array;
  leadingMutation?: Uint8Array;
  currentElement?: Uint8Array;
}): {
    preValueWitness?: Uint8Array;
    leadingMutation?: Uint8Array;
    postValue: Uint8Array;
  } {
  let postValue = storedPreValue;
  if (leadingMutation && leadingMutation.length > 0) {
    postValue = concatenateEncodedArrays(postValue, leadingMutation);
  }
  if (currentElement) postValue = appendEncodedArrayElement(postValue, currentElement);
  return { preValueWitness, leadingMutation, postValue };
}

/** Encode a struct argument, applying the explicitly selected legacy payload adapter when requested. */
export function encodeStructArgument(
  value: FunctionArgument, typeName: string, structs: Artifact['structs'],
  timestamp?: bigint, legacyJobEventCompatibility = false,
): Uint8Array {
  let decodedValue: FunctionArgument = value;
  if (value instanceof Uint8Array) {
    try {
      const decoded = decodePushdataValue(value, 0, typeName, structs);
      if (decoded.bytesConsumed !== value.length) return value;
      decodedValue = decoded.value as FunctionArgument;
    } catch {
      return value;
    }
  }
  const struct = structs?.find((candidate) => candidate.name === typeName);
  const canonicalValue = Array.isArray(decodedValue) && struct
    ? Object.fromEntries(struct.fields.map((field, index) => [field.name, decodedValue[index]]))
    : decodedValue;
  if (canonicalValue && typeof canonicalValue === 'object' && !Array.isArray(canonicalValue)) {
    const record = { ...(canonicalValue as Record<string, unknown>) };
    // This historical wire adapter is deliberately fenced by usesLegacyJobEventCompatibility. Ordinary kernel
    // values are derived from compiler-authenticated flow and must never change because a field happens to have
    // an application-associated spelling.
    if (legacyJobEventCompatibility && (
      (record.timestamp_ === 0 || record.timestamp_ === 0n || record.timestamp_ === undefined)
    )) {
      record.timestamp_ = timestamp !== undefined && timestamp > 0n
        ? timestamp : BigInt(Math.floor(Date.now() / 1000));
    }
    if (legacyJobEventCompatibility) {
      normalizeJobEventAddresses(record, typeName, structs);
    }
    return encodePushdataValue(record as never, typeName, structs);
  }
  return encodePushdataValue(canonicalValue as never, typeName, structs);
}

function p2pkhLockingBytecode(pkh: Uint8Array): Uint8Array {
  const out = new Uint8Array(25);
  out[0] = 0x76; out[1] = 0xa9; out[2] = 0x14;
  out.set(pkh, 3);
  out[23] = 0x88; out[24] = 0xac;
  return out;
}

/**
 * Derive every storage-slot spelling accepted for typed mapping keys.
 *
 * SolidCash stores `address` values as locking bytecode, while Solidity/ethers
 * compatibility surfaces can round-trip a P2PKH account as its 20-byte hash.
 * Preserve the exact supplied bytes as the first candidate, then add the
 * canonical P2PKH script only for an address-typed 20-byte value. Other types
 * (notably `bytes20`) never receive this alias. The Cartesian product keeps the
 * rule correct for nested mappings with more than one address key.
 */
export function mappingKeySlotCandidates(
  keys: Array<bigint | boolean | Uint8Array | string>,
  keyTypes?: readonly string[],
  collection?: Parameters<typeof keyToSlotMulti>[1],
): Uint8Array[] {
  const options = keys.map((arg, index): Uint8Array[] => {
    const keyType = keyTypes?.[index];
    let encoded: Uint8Array;
    if (typeof arg === 'string') {
      if (keyType === 'address' && arg.includes(':')) encoded = addressToLockScript(arg);
      else if (keyType === 'address' && /^(?:[0-9a-fA-F]{2})+$/.test(arg)) encoded = hexToBin(arg);
      // 0x-hex locking bytecode (23/25/35) or other hex keys. Do not UTF-8 pack the hex text.
      else if (/^0x(?:[0-9a-fA-F]{2})+$/i.test(arg)) encoded = hexToBin(arg.slice(2));
      else if (keyType && /^(?:u?int|bigint)/.test(keyType) && /^-?\d+$/.test(arg)) {
        encoded = bigIntToVmNumber(BigInt(arg));
      } else encoded = utf8ToBin(arg);
    } else if (arg instanceof Uint8Array) encoded = arg;
    else if (typeof arg === 'bigint') encoded = bigIntToVmNumber(arg);
    else encoded = bigIntToVmNumber(arg ? 1n : 0n);

    return keyType === 'address' && encoded.length === 20
      ? [encoded, p2pkhLockingBytecode(encoded)]
      : [encoded];
  });
  const encodings = options.reduce<Uint8Array[][]>(
    (rows, candidates) => rows.flatMap((row) => candidates.map((candidate) => [...row, candidate])),
    [[]],
  );
  const seen = new Set<string>();
  return encodings.flatMap((encoding) => {
    const slot = keyToSlotMulti(encoding, collection);
    const hex = binToHex(slot);
    if (seen.has(hex)) return [];
    seen.add(hex);
    return [slot];
  });
}

type MappingEntryLookup = {
  slot?: Uint8Array;
  key?: bigint | boolean | Uint8Array;
  keys?: Array<bigint | boolean | Uint8Array>;
};

function mappingEntryMatchesLegacyKeys(
  entry: MappingEntryLookup,
  keys: Array<bigint | boolean | Uint8Array | string>,
): boolean {
  const entryKeys = entry.keys ?? (entry.key !== undefined ? [entry.key] : []);
  if (entryKeys.length !== keys.length) return false;
  return entryKeys.every((stored, index) => {
    const arg = keys[index];
    const supplied = typeof arg === 'string' ? new TextEncoder().encode(arg) : arg;
    if (stored instanceof Uint8Array) {
      return supplied instanceof Uint8Array && binsAreEqual(stored, supplied);
    }
    return stored === supplied;
  });
}

/** Select a mapping entry deterministically: exact spelling first, compatibility aliases only as fallback. */
export function selectMappingEntryByKeys<T extends MappingEntryLookup>(
  entries: readonly T[],
  keys: Array<bigint | boolean | Uint8Array | string>,
  keyTypes?: readonly string[],
  collection?: Parameters<typeof keyToSlotMulti>[1],
): T | undefined {
  const [exactSlot, ...aliasSlots] = mappingKeySlotCandidates(keys, keyTypes, collection);
  const exactMatches = entries.filter((entry) => entry.slot
    ? exactSlot !== undefined && binsAreEqual(entry.slot, exactSlot)
    : mappingEntryMatchesLegacyKeys(entry, keys));
  if (exactMatches.length > 1) {
    throw new Error('Authenticated mapping lookup found duplicate entries for the exact key slot.');
  }
  if (exactMatches.length === 1) return exactMatches[0];

  const aliasMatches = entries.filter((entry) => entry.slot !== undefined
    && aliasSlots.some((slot) => binsAreEqual(entry.slot!, slot)));
  if (aliasMatches.length > 1) {
    throw new Error('Authenticated mapping lookup found multiple entries for compatibility key aliases.');
  }
  return aliasMatches[0];
}

function isLockingBytecode(bytes: Uint8Array): boolean {
  return (bytes.length === 35 && bytes[0] === 0xaa && bytes[1] === 0x20 && bytes[34] === 0x87)
    || (bytes.length === 23 && bytes[0] === 0xa9 && bytes[1] === 0x14 && bytes[22] === 0x87)
    || (bytes.length === 25 && bytes[0] === 0x76 && bytes[1] === 0xa9
      && bytes[2] === 0x14 && bytes[23] === 0x88 && bytes[24] === 0xac);
}

function addressArgumentLockingBytecodeHex(value: FunctionArgument | undefined): string | undefined {
  let bytes: Uint8Array | undefined;
  if (value instanceof Uint8Array) bytes = value;
  else if (typeof value === 'string') {
    try {
      bytes = value.includes(':')
        ? addressToLockScript(value)
        : hexToBin(value.replace(/^0x/i, ''));
    } catch { return undefined; }
  }
  return bytes && isLockingBytecode(bytes) ? binToHex(bytes) : undefined;
}

function externalCallTargetArgumentLockingBytecodeHex(
  owner: AbiFunction,
  slot: number,
  visibleArgs: readonly FunctionArgument[],
): string | undefined {
  const call = owner.externalCalls?.[slot];
  if (!call) return undefined;
  const inputs = owner.inputs.filter((input) => !input.name.startsWith('__internal__'));
  const index = call.addressSource?.kind === 'forward'
    ? call.addressSource.paramIndex
    : call.addressParam === undefined ? undefined
      : inputs.findIndex((input) => input.name === call.addressParam);
  return index === undefined || index < 0
    ? undefined : addressArgumentLockingBytecodeHex(visibleArgs[index]);
}

/**
 * Resolve the Solidity-visible target which authenticates an external-call master. A direct parameter is only
 * one possible source: interface values are commonly loaded from authenticated contract state. Once the SDK has
 * evaluated that compiler-published source, it has exactly the same authority as a forwarded argument and may
 * select the direct physical identity proof when it already names the co-spent locking bytecode.
 */
export function externalCallTargetSourceLockingBytecodeHex(
  owner: AbiFunction,
  slot: number,
  visibleArgs: readonly FunctionArgument[],
  resolvedAddressSource?: FunctionArgument,
): string | undefined {
  return addressArgumentLockingBytecodeHex(resolvedAddressSource)
    ?? externalCallTargetArgumentLockingBytecodeHex(owner, slot, visibleArgs);
}

/** JobEventData.address_ is packed address locking bytecode (p2sh20=23, p2pkh=25, p2sh32=35). */
function normalizeJobEventAddresses(
  decoded: unknown, type: string, structs: Artifact['structs'],
): typeof decoded {
  const structName = type.endsWith('[]') ? type.slice(0, -2) : type;
  const def = structs?.find((candidate) => candidate.name === structName);
  if (!def?.fields.some((field) => field.name === 'address_' && field.type === 'bytes')) return decoded;
  const rows = Array.isArray(decoded) ? decoded : [decoded];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const record = row as Record<string, unknown>;
    const raw = record.address_;
    let bytes: Uint8Array | undefined;
    if (raw instanceof Uint8Array) bytes = raw;
    else if (typeof raw === 'string') {
      if (raw.includes(':')) {
        try { bytes = addressToLockScript(raw); } catch { bytes = utf8ToBin(raw); }
      } else if (raw.startsWith('0x') && raw.length % 2 === 0) bytes = hexToBin(raw.slice(2));
      else bytes = utf8ToBin(raw);
    }
    if (!bytes || bytes.length === 0) continue;
    if (!isLockingBytecode(bytes)) {
      try {
        const text = binToUtf8(bytes);
        if (text.includes(':')) bytes = addressToLockScript(text);
      } catch { /* not UTF-8 */ }
    }
    if (bytes.length === 20) bytes = p2pkhLockingBytecode(bytes);
    record.address_ = bytes;
  }
  return decoded;
}

/** Quarantine the historical wire adapter to its exact legacy schema and legacy-unroll artifact. */
export function usesLegacyJobEventCompatibility(
  artifact: Artifact, type: string, structs: Artifact['structs'],
): boolean {
  if (artifact.messageBus?.convention !== 'legacy-unroll') return false;
  const name = type.endsWith('[]') ? type.slice(0, -2) : type;
  if (name !== 'JobEventData') return false;
  const definition = structs?.find((candidate) => candidate.name === name);
  return definition?.fields.length === 4
    && definition.fields[0].name === 'type_' && definition.fields[0].type === 'uint8'
    && definition.fields[1].name === 'address_' && definition.fields[1].type === 'bytes'
    && definition.fields[2].name === 'data_' && definition.fields[2].type === 'bytes'
    && definition.fields[3].name === 'timestamp_' && definition.fields[3].type === 'uint32';
}

/**
 * Apply the historical JobEvent timestamp wire adapter to a nested legacy-unroll call.
 *
 * This compatibility behavior is selected by the callee artifact convention and the exact legacy ABI type,
 * never by a function name or a positional argument assumption. Kernel artifacts must preserve user arguments:
 * their state transition is derived by executing the compiler-authenticated handler body.
 */
export function adaptLegacyNestedJobEventArguments(
  artifact: Artifact,
  functionName: string,
  args: readonly FunctionArgument[],
  timestamp: bigint,
): FunctionArgument[] {
  const functions = (artifact.abi as readonly AbiFunction[])
    .filter((candidate) => candidate.name === functionName);
  if (functions.length !== 1) return [...args];
  const fn = functions[0];
  if (fn.inputs.length !== args.length) return [...args];
  const compatibleInputs = fn.inputs.flatMap((input, index) => (
    usesLegacyJobEventCompatibility(artifact, input.type, artifact.structs) ? [index] : []
  ));
  if (compatibleInputs.length !== 1) return [...args];
  const adapted = [...args];
  const inputIndex = compatibleInputs[0];
  adapted[inputIndex] = stampEmptyJobEventTimestamp(adapted[inputIndex], timestamp) as FunctionArgument;
  return adapted;
}

/**
 * Opt into the historical event-payload trace exclusion only when artifact metadata identifies the exact legacy
 * wire schema. Modern/kernel artifacts and descriptor-free general contracts must classify trace commitments by
 * compiler-owned slot/range authority, never by bytes which happen to resemble an application payload.
 */
export function usesLegacyJobEventTraceCompatibility(artifacts: readonly Artifact[]): boolean {
  return artifacts.some((artifact) => {
    const layout = artifact.stateLayout;
    if (!layout) return false;
    const collections = [...(layout.collections ?? []), ...(layout.mappings ?? [])];
    return collections.some((collection) => collection.chunkableValue === true
      && usesLegacyJobEventCompatibility(
        artifact, collection.valueType, layout.structs ?? artifact.structs,
      ));
  });
}

/** Payload-shaped exclusion is an explicitly selected legacy adapter, not a general trace classifier. */
export function isExcludedLegacyJobEventTraceCommitment(
  commitment: string, legacyJobEventCompatibility: boolean,
): boolean {
  return legacyJobEventCompatibility && isJobEventEmitCommitment(commitment);
}

/**
 * Extract expected commitment hex strings from a VM debug trace, keyed by the output index each verifies.
 *
 * The contract verifies state via: <expected> OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY
 * This scans the trace for those patterns and records the expected commitment bytes per output index.
 */
/**
 * A chunkable vmap write whose value is computed on-chain carries no `valueParam`, so the caller cannot build
 * its chunks off-chain the way a
 * parameter-valued write does. The covenant still pins them, in the CALLEE's trailing band.
 *
 * The pin is verified BEFORE any entry commitment is revealed (the probe aborts with `revealed: []`), so the
 * entry head is not available to describe the value. It does not need to be: at the aborting
 * `OP_OUTPUTBYTECODE OP_EQUALVERIFY` the covenant has already computed everything the output needs, and it is
 * all live on the stack - the output index, the chunk address, and the expected chunk commitment.
 *
 * One chunk is recovered per probe pass; satisfying chunk i lets the covenant reach i+1, exactly like the
 * progressive entry derivation this runs inside. Returns true when it placed something new.
 */
function isP2sh32LockingBytecode(bytes: Uint8Array | undefined): boolean {
  return !!bytes && bytes.length === 35 && bytes[0] === 0xaa && bytes[1] === 0x20 && bytes[34] === 0x87;
}

/** emitSortedValueChunkPin: `DUP / PICK addr / SWAP / OUTPUTBYTECODE` leaves [addr35, idx] on top. */

export type RouteProbeObservationHistory = Map<string, string>;

/** A resource fingerprint excludes relocatable physical geometry. */
export function routeValueRunFingerprint(chunks: readonly {
  outputIndex: number; commitment: string; lockingBytecode: Uint8Array;
}[]): string {
  const ordered = [...chunks].sort((left, right) => left.outputIndex - right.outputIndex);
  const base = ordered[0]?.outputIndex ?? 0;
  if (ordered.some((chunk, index) => chunk.outputIndex !== base + index)) {
    throw new Error('Route value-run materialization must occupy one contiguous output band.');
  }
  return ordered.map((chunk) => [
    chunk.outputIndex - base, chunk.commitment, binToHex(chunk.lockingBytecode),
  ].join(':')).join('|');
}

/**
 * Record probe facts by their compiler-authenticated resource, independently of physical builder mutations.
 * Physical output indices can move while earlier participant slots hydrate, so callers fingerprint value runs
 * relative to their base. Different semantic bytes for one kernel resource remain an SDK/compiler disagreement.
 */
export function recordRouteProbeObservation(
  observations: RouteProbeObservationHistory,
  observation: RouteProbeObservation,
  convention?: 'legacy-unroll' | 'kernel-row-loop',
): 'new' | 'same' | 'changed' {
  const previous = observations.get(observation.identity);
  if (previous === undefined) {
    observations.set(observation.identity, observation.fingerprint);
    return 'new';
  }
  if (previous === observation.fingerprint) return 'same';
  if (convention === 'kernel-row-loop') {
    throw new Error(
      `Kernel route probe produced unstable materialization for ${observation.identity}.`,
    );
  }
  observations.set(observation.identity, observation.fingerprint);
  return 'changed';
}

/** Static convergence budget: each entry may reveal its address and commitment; each value resource its pin/run. */
export function progressiveRouteProbePassLimit(
  entrySlotCount: number,
  writes: readonly ValueChunkWriteDescriptor[],
): number {
  const resources = new Set(writes.map(valueChunkWriteResourceIdentity));
  return Math.max(1, 2 * entrySlotCount + 2 * Math.max(1, resources.size) + 1);
}

/**
 * Count only entry coordinates reachable from the participant currently being probed. An unrelated participant
 * cannot reveal a fact in this trace and therefore must not enlarge this participant's convergence budget.
 */
export function routeProbeRepairableEntryCoordinateCount(
  group: {
    categoryId: string;
    masterUtxo: { txid: string; vout: number };
    blockLayout?: { slots: readonly { kind: string; offset: number }[] };
  },
  embeddedDelegate?: {
    categoryId: string;
    masterUtxo: { txid: string; vout: number };
    blockLayout?: { slots: readonly { kind: string; offset: number }[] };
  },
): number {
  const coordinates = new Set<string>();
  for (const carrier of [group, embeddedDelegate]) {
    if (!carrier?.blockLayout) continue;
    const owner = [
      carrier.categoryId.toLowerCase(),
      carrier.masterUtxo.txid.toLowerCase(),
      carrier.masterUtxo.vout,
    ].join(':');
    for (const slot of carrier.blockLayout.slots) {
      if (slot.kind === 'entry') coordinates.add(`${owner}:${slot.offset}`);
    }
  }
  return coordinates.size;
}

export function permitsRouteValueChunkDerivation(
  convention: 'legacy-unroll' | 'kernel-row-loop' | undefined,
  writes: readonly ValueChunkWriteDescriptor[],
): boolean {
  return convention !== 'kernel-row-loop' || writes.length > 0;
}

/** The exact ABI body carried by a physical participant. Compiler routes outrank source-level names because
 * overloads and shared participants can execute a different body than the logical call which introduced them. */
function physicalExternalCallFunction(group: ExternalCallUtxoGroup): AbiFunction | undefined {
  return group.compilerRoute?.abiFunction
    ?? (group.externalContract?.inner?.artifact.abi as readonly AbiFunction[] | undefined)
      ?.find((candidate) => candidate.name === group.functionName);
}

function hasPublishedEntryEffects(group: ExternalCallUtxoGroup): boolean {
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

function writesChunkableValue(
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
  for (const activeFunction of activeFunctions) {
    for (const [entryAccessSlot, access] of (activeFunction.entryAccesses ?? []).entries()) {
      if (!access.operations.includes('write')) continue;
      const collection = group.stateLayout.collections?.find((candidate) =>
        candidate.name === access.collection || candidate.signature === access.collection);
      if (!collection?.chunkableValue) continue;
      if (activeWriteCollections !== undefined && !activeWriteCollections.some((candidate) =>
        candidate === access.collection || candidate === collection.name
        || candidate === collection.signature)) continue;
      const routeSlot = access.slotIndex ?? entryAccessSlot;
      const blockSlot = layout.slots.find((slot) =>
        slot.kind === 'entry' && slot.slotIndex === routeSlot)?.offset;
      if (blockSlot === undefined) continue;
      const insert = group.plannedEntryInserts?.find((planned) => planned.blockSlot === blockSlot);
      const commitment = insert?.newCommitment
        ?? group.blockInputs?.[blockSlot]?.token?.nft?.commitment;
      if (commitment === undefined) continue;
      const bytes = typeof commitment === 'string' ? hexToBin(commitment) : commitment;
      if (bytes.length < 32) continue;
      const keySlot = decodeEntryCommitment(bytes).slot;
      writes.push({
        categoryId: stateOwnerCategoryId ?? group.categoryId,
        collection: collection.name,
        collectionSignature: collection.signature,
        collectionHash: binToHex(computeCollectionHash(collection.signature)),
        keySlot: binToHex(keySlot),
        entryAccessSlot,
        routeSlot,
        operation: insert ? 'insert' : 'update',
        outputBase: group.valueChunkOutputBase ?? -1,
        outputCount: group.valueChunkOutputCount ?? 0,
      });
    }
  }
  return writes;
}

function chunkableValueWriteCollections(
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

// Preserve the historical StatefulContract import surface while the extracted helper owns one implementation.
export {
  resolveKernelValueChunkResourceLanes,
  resolveKernelValueChunkResourceLane,
  resolveChunkableEntryCollection,
  resolvePublishedEntryBlockOffset,
} from './kernel-value-chunk-lanes.js';

/** Map a physical output index to a vmap entry slot offset using proxy and/or implementation layouts. */
export function routeProbeEntrySlotOffsetForOutput(
  outputIndex: number,
  layouts: Array<{ base: number; slots?: Array<{ kind: string; offset?: number }> }>,
): number | undefined {
  for (const { base, slots } of layouts) {
    if (!slots || base < 0) continue;
    const relative = outputIndex - base;
    const atIndex = slots[relative];
    if (atIndex?.kind === 'entry') return atIndex.offset ?? relative;
    const byOffset = slots.find((slot) => slot.kind === 'entry' && slot.offset === relative);
    if (byOffset) return byOffset.offset ?? relative;
  }
  return undefined;
}

function extractExpectedOutputCommitmentFromTrace(
  trace: AuthenticationProgramStateCommon[], outputIndex: number, actualCommitment: string,
): string | undefined {
  // Output-pin helpers can be nested: an outer OUTPUTTOKENCOMMITMENT remains live while an invoked helper
  // performs and verifies another output pin. Keep the pending checks as a stack so the inner EQUALVERIFY does
  // not discard the outer output association. This is the same tightly-coupled pattern accepted by
  // extractCommitmentMapFromTrace, extended to outlined helpers which invoke other output-pin helpers.
  const pendingOutputIndices: number[] = [];
  for (const state of trace) {
    if (state.controlStack.some((flag) => flag === false)) continue;
    const opcode = state.instructions[state.ip]?.opcode;
    if (opcode === Op.OP_OUTPUTTOKENCOMMITMENT) {
      pendingOutputIndices.push(state.stack.length > 0
        ? Number(decodeScriptNumber(state.stack[state.stack.length - 1])) : -1);
      continue;
    }
    const isPush = opcode !== undefined && opcode <= Op.OP_16;
    const isCommitmentComparison = opcode === Op.OP_EQUALVERIFY || opcode === Op.OP_EQUAL;
    if (!isCommitmentComparison) {
      if (!isPush && opcode !== Op.OP_INVOKE) pendingOutputIndices.length = 0;
      continue;
    }
    const inspectedOutputIndex = pendingOutputIndices.pop();
    if (inspectedOutputIndex !== outputIndex || state.stack.length < 2) continue;
    const below = binToHex(state.stack[state.stack.length - 2]);
    const top = binToHex(state.stack[state.stack.length - 1]);
    if (below === actualCommitment && top !== actualCommitment) return top;
    if (top === actualCommitment && below !== actualCommitment) return below;
    // A malformed/placeholder actual can be transformed before comparison. Prefer the structurally complete vmap
    // node over a neighboring hash/default, while leaving equal-width ambiguity to the ordinary extractor.
    if (below.length >= 128 && top.length < 128) return below;
    if (top.length >= 128 && below.length < 128) return top;
  }
  return undefined;
}

/** Select a complete Solidity return from strongest-to-weakest live stack candidates. */
export function selectEvmScalarReturnCommitment(
  candidates: readonly Uint8Array[], expectedTypes: readonly string[], allowRaw = true,
): string | undefined {
  const bytes = expectedTypes.length * 32;
  // Message-bus routes frame the complete Solidity return vector as one canonical `bytes` field before
  // publishing it. Prefer that compiler-authored boundary over raw ABI-width values which happen to remain in
  // the route frame: state hashes, mapping witnesses, and zero placeholders are all valid `uint256` words, but
  // none of them is a complete framed return. A progressive probe can stop after the frame is assembled and
  // before its output comparison, so this is also the strongest result available in that state.
  for (const candidate of candidates) {
    // A complete outer bytes field is exactly one push. Resolving that from the length prefix rejects the
    // ordinary route-frame item (a raw state value, hash, or script) without slicing it and without the
    // exception `decodePushdataValue` would raise and capture a stack trace for.
    if (peekPushdataEncodedLength(candidate) !== candidate.length) continue;
    try {
      const outer = decodePushdataValue(candidate, 0, 'bytes');
      if (!(outer.value instanceof Uint8Array) || outer.bytesConsumed !== candidate.length) continue;
      if (!isCanonicalEvmScalarReturnVector(outer.value, expectedTypes)) continue;
      return binToHex(outer.value);
    } catch {
      // Ordinary route-frame items are not canonical outer bytes fields.
    }
  }
  if (!allowRaw) return undefined;
  for (const candidate of candidates) {
    if (candidate.length !== bytes) continue;
    if (!isCanonicalEvmScalarReturnVector(candidate, expectedTypes)) continue;
    if (expectedTypes.length === 1 && expectedTypes[0] === 'bool') {
      // A failing probe contains many unrelated ABI-sized zero words (state fields, hashes, placeholders).
      // They cannot authenticate `false`; the targeted return-output comparison does that when execution
      // reaches it. `true` remains a useful advancing observation, while precomputed false views are retained
      // by the fixed-point caller until that stronger output evidence replaces them.
      if (candidate[31] === 0) continue;
    }
    return binToHex(candidate);
  }
  return undefined;
}

/** Validate the canonical outer bytes field used by message-bus Solidity return channels. */
export function isCanonicalEvmScalarReturnBlob(
  candidate: Uint8Array, expectedTypes: readonly string[],
): boolean {
  if (peekPushdataEncodedLength(candidate) !== candidate.length) return false;
  try {
    const outer = decodePushdataValue(candidate, 0, 'bytes');
    return outer.value instanceof Uint8Array
      && outer.bytesConsumed === candidate.length
      && isCanonicalEvmScalarReturnVector(outer.value, expectedTypes);
  } catch {
    return false;
  }
}

const EVM_DYNAMIC_RETURN_TYPES = new Set(['bytes', 'string']);

/**
 * True when a multi-row Solidity result vector may be recognized from its bare (unframed) encoding.
 *
 * A lone ABI-width word is ambiguous: state hashes, mapping witnesses, and placeholders are all canonical
 * `uint256` words. A *complete* vector is only stronger than that when at least one row's declared type
 * constrains its 32-byte encoding (a bool word is 0/1, an address zero-extends, a narrow integer sign-extends);
 * a vector built only from unbounded `int`/`uint`/`bigint` rows is still indistinguishable from concatenated
 * state words and must keep waiting for a compiler-framed observation.
 */
export function isConstrainedEvmResultVector(
  resultTypeGroups: readonly (readonly string[])[],
): boolean {
  const rows = resultTypeGroups.flat();
  if (resultTypeGroups.length < 2 || rows.length === 0) return false;
  if (rows.some((type) => EVM_DYNAMIC_RETURN_TYPES.has(type))) return false;
  return rows.some((type) => {
    if (type === 'bool' || type === 'address' || type === 'address payable') return true;
    if (/^bytes(?:[1-9]|[12][0-9]|3[0-2])$/.test(type)) return true;
    const bounded = /^u?(?:int|fixed)(\d+)(?:x\d+)?$/.exec(type);
    return bounded !== null && Number(bounded[1]) < 256;
  });
}

export {
  canonicalEvmReturnVectorLength,
  isCanonicalEvmReturnVector,
  isCanonicalEvmReturnSequence,
  isCanonicalEvmReturnBlob,
  selectEvmReturnCommitment,
} from './external-return-encoding.js';

/** Encode a complete external invocation result using the callee's declared ABI mode and named schemas. */
export function encodeExternalReturnValues(
  values: readonly StateValue[],
  types: readonly string[],
  structs: Artifact['structs'],
  solidityAbi: boolean,
  enums?: Artifact['enums'],
): Uint8Array {
  if (solidityAbi) return encodeEvmInvocationResult(values, types, structs, enums);
  if (values.length !== types.length) {
    throw new Error(`Native result has ${values.length} values for ${types.length} declared types`);
  }
  const parts = values.map((value, index) => encodePushdataValue(value, types[index], structs));
  const encoded = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) { encoded.set(part, offset); offset += part.length; }
  return encoded;
}

/** Encode a one-value external invocation result. */
export function encodeExternalReturnValue(
  value: StateValue,
  type: string,
  structs: Artifact['structs'],
  solidityAbi: boolean,
  enums?: Artifact['enums'],
): Uint8Array {
  return encodeExternalReturnValues([value], [type], structs, solidityAbi, enums);
}

/** Bind compiler-identified returning call expressions to already authenticated invocation results. */
export function externalReturnsForCallsites(
  argSources: readonly ArgSource[] | undefined,
  results: ReadonlyMap<number, FunctionArgument>,
  producerCalls: readonly ExternalCallAbi[],
  consumer?: {
    callsiteId: number;
    resultConsumers?: readonly ExternalResultConsumerAbi[];
  },
): Map<string, FunctionArgument> {
  const resolved = new Map<string, FunctionArgument>();
  const producerById = new Map<number, ExternalCallAbi>();
  for (const producer of producerCalls) {
    if (producer.callsiteId === undefined || producer.callsiteId < 0) {
      throw new Error('Graph external-call metadata requires a nonnegative callsiteId for every producer.');
    }
    if (producerById.has(producer.callsiteId)) {
      throw new Error(`Graph external-call metadata has duplicate callsiteId ${producer.callsiteId}.`);
    }
    producerById.set(producer.callsiteId, producer);
  }
  if (consumer?.resultConsumers) {
    const lanes = new Set<string>();
    for (const lane of consumer.resultConsumers) {
      if (!Number.isInteger(lane.consumerCallsiteId) || lane.consumerCallsiteId < 0
        || ('argument' in lane && (!Number.isInteger(lane.argument) || lane.argument! < 0))
        || (!('argument' in lane) && lane.condition !== true && lane.iterationDomain !== true)
        || !Number.isInteger(lane.producerCallsiteId) || lane.producerCallsiteId < 0) {
        throw new Error('Graph result-consumer metadata requires nonnegative integer callsite and argument lanes.');
      }
      if (Number(lane.condition === true) + Number('iterationDomain' in lane && lane.iterationDomain === true)
        + Number('argument' in lane) !== 1) {
        throw new Error('Graph result-consumer metadata requires one valid consumer lane.');
      }
      const producer = producerById.get(lane.producerCallsiteId);
      if (!producer) {
        throw new Error(
          `Graph result-consumer metadata references missing producer callsite ${lane.producerCallsiteId}.`,
        );
      }
      if (lane.resultIndex !== undefined && (!Number.isInteger(lane.resultIndex) || lane.resultIndex < 0
        || lane.resultIndex >= (producer.returnTypes?.length ?? 0))) {
        throw new Error(
          `Graph result-consumer metadata has invalid result index ${String(lane.resultIndex)} for producer `
          + `${lane.producerCallsiteId}.`,
        );
      }
      const key = `${lane.consumerCallsiteId}:${lane.argument ?? ('iterationDomain' in lane ? 'domain' : 'condition')}`
        + `:${lane.producerCallsiteId}`
        + `:${lane.resultIndex ?? '*'}`;
      if (lanes.has(key)) throw new Error(`Graph result-consumer metadata has duplicate lane ${key}.`);
      lanes.add(key);
    }
  }
  const visit = (expression: ExternalCallExpression | undefined, argument: number): void => {
    if (!expression) return;
    for (const child of [expression.target, expression.expression, expression.left, expression.right,
      expression.condition, expression.ifTrue, expression.ifFalse]) visit(child, argument);
    for (const child of expression.args ?? []) visit(child, argument);
    if (expression.kind === 'producerResult' && expression.callsiteId !== undefined) {
      const producer = producerById.get(expression.callsiteId);
      const resultIndex = expression.resultIndex;
      if (!producer || resultIndex === undefined || !Number.isInteger(resultIndex)
        || resultIndex < 0 || resultIndex >= (producer.returnTypes?.length ?? 0)) {
        throw new Error(
          `Graph producerResult ${expression.callsiteId}:${String(resultIndex)} does not identify one published result.`,
        );
      }
      if (consumer?.resultConsumers) {
        const lanes = consumer.resultConsumers.filter((lane) =>
          lane.consumerCallsiteId === consumer.callsiteId && lane.argument === argument
          && lane.producerCallsiteId === expression.callsiteId
          && (lane.resultIndex === undefined || lane.resultIndex === resultIndex));
        if (lanes.length !== 1) {
          throw new Error(
            `Graph producerResult ${expression.callsiteId}:${resultIndex} does not identify exactly one `
            + `published consumer lane ${consumer.callsiteId}:${argument}.`,
          );
        }
      }
      const result = results.get(expression.callsiteId);
      if (result !== undefined && (producer.returnTypes?.length ?? 0) > 1
        && (!Array.isArray(result) || result.length !== producer.returnTypes!.length)) {
        throw new Error(
          `Authenticated graph result for producer ${expression.callsiteId} does not match its `
          + `${producer.returnTypes!.length}-component schema.`,
        );
      }
      const selected = (producer.returnTypes?.length ?? 0) === 1
        ? result : Array.isArray(result) ? result[resultIndex] as FunctionArgument : undefined;
      if (selected !== undefined) resolved.set(JSON.stringify(expression), selected);
      return;
    }
    if (expression.kind !== 'externalCall' || expression.callsiteId === undefined) return;
    const result = results.get(expression.callsiteId);
    if (result !== undefined) resolved.set(JSON.stringify(expression), result);
  };
  for (const [argument, source] of (argSources ?? []).entries()) visit(source.expression, argument);
  return resolved;
}



/** True when a trace candidate is exactly one encoded collection value, with no trailing neighboring value. */
function isCompleteCollectionValue(
  candidate: Uint8Array, valueType: string | undefined, structs: StateLayout['structs'],
): boolean {
  if (!valueType) return true;
  try {
    return decodePushdataValue(candidate, 0, valueType, structs).bytesConsumed === candidate.length;
  } catch {
    return false;
  }
}

function authenticatedCollectionValueSelector(
  valueType: string | undefined, structs: StateLayout['structs'],
): (
    items: readonly Uint8Array[], roots: ReadonlySet<string>, preferredRoots: ReadonlySet<string>,
  ) => Uint8Array | undefined {
  // Sparse probe states share immutable stack items by reference. Cache their two pure classifications across
  // states so a long collection is not decoded and hashed hundreds of times during one witness search.
  const digests = new WeakMap<Uint8Array, string>();
  const completeness = new WeakMap<Uint8Array, boolean>();
  const digest = (item: Uint8Array): string => {
    const cached = digests.get(item);
    if (cached !== undefined) return cached;
    const computed = binToHex(sha256Sync(item));
    digests.set(item, computed);
    return computed;
  };
  const complete = (item: Uint8Array): boolean => {
    const cached = completeness.get(item);
    if (cached !== undefined) return cached;
    const computed = isCompleteCollectionValue(item, valueType, structs);
    completeness.set(item, computed);
    return computed;
  };
  const newestRooted = (
    items: readonly Uint8Array[], candidateRoots: ReadonlySet<string>,
  ): Uint8Array | undefined => {
    for (let index = items.length - 1; index >= 0; index--) {
      const item = items[index];
      if (item.length <= VALUE_HEAD_SIZE || item.length > 10_000) continue;
      // Almost every large stack item is unrelated. Hashing first limits the substantially more expensive typed
      // decode to candidates that are actually authenticated by a root observed in this probe state.
      if (!candidateRoots.has(digest(item)) || !complete(item)) continue;
      return item;
    }
    return undefined;
  };
  return (items, roots, preferredRoots) => {
    // A repeated route can expose several authenticated values for one collection: each logical row leaves its
    // intermediate value/root in the chronological trace, while only the final row owns the transaction output.
    // Recover from the end so the SDK materializes the last-write continuation run rather than a valid prefix.
    if (preferredRoots.size > 0) {
      const stored = newestRooted(items, preferredRoots);
      if (stored) return stored;
    }
    return newestRooted(items, roots);
  };
}

export function selectAuthenticatedCollectionValue(
  items: readonly Uint8Array[],
  roots: ReadonlySet<string>,
  preferredRoots: ReadonlySet<string>,
  valueType: string | undefined,
  structs: StateLayout['structs'],
): Uint8Array | undefined {
  return authenticatedCollectionValueSelector(valueType, structs)(items, roots, preferredRoots);
}

/** Select a pre-handler witness only when its full bytes match an authenticated stored-entry root. */
export function selectAuthenticatedPreValueWitness(
  items: readonly Uint8Array[], storedRoots: ReadonlySet<string>,
  valueType: string | undefined, structs: StateLayout['structs'],
): Uint8Array | undefined {
  if (storedRoots.size === 0) return undefined;
  return authenticatedCollectionValueSelector(valueType, structs)(items, storedRoots, storedRoots);
}

export function evalComputedKey(
  label: string | undefined, args: FunctionArgument[], inputs: readonly { name: string; type?: string }[],
  state?: Readonly<Record<string, StateValue>>,
  stateLengthDeltas?: Readonly<Record<string, bigint>>,
  mappingValue?: (collection: string, key: unknown) => StateValue | undefined,
): Uint8Array | undefined {
  if (!label) return undefined;
  const encode = (value: unknown): Uint8Array | undefined => {
    if (value instanceof Uint8Array) return value;
    if (typeof value === 'bigint') return bigIntToVmNumber(value);
    if (typeof value === 'number') return bigIntToVmNumber(BigInt(value));
    if (typeof value === 'boolean') return bigIntToVmNumber(value ? 1n : 0n);
    if (typeof value === 'string') return value.includes(':') ? addressToLockScript(value) : utf8ToBin(value);
    return undefined;
  };
  const splitTopLevel = (s: string): [string, string] | undefined => {
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(' || s[i] === '[' || s[i] === '{') depth++;
      else if (s[i] === ')' || s[i] === ']' || s[i] === '}') depth--;
      else if (s[i] === ',' && depth === 0) return [s.slice(0, i), s.slice(i + 1)];
    }
    return undefined;
  };
  const evalValue = (s: string): unknown => {
    let m = s.match(/^id:(.+)$/);
    if (m) {
      const idx = inputs.findIndex((i) => i.name === m![1]);
      if (idx >= 0) {
        const bound = args[idx];
        // A string argument of a bytes-like parameter is pushed as its hex (or address) bytes, not as its text.
        const type = inputs[idx].type;
        if (typeof bound === 'string' && type !== undefined && /^(?:bytes\d*|byte|address|pubkey|sig|datasig)$/.test(type)) {
          try {
            return encodeFunctionArgument(bound, type);
          } catch {
            return bound;
          }
        }
        // Route frames hand numeric parameters over as JS numbers (and some label paths as decimal strings), while the
        // expression grammar below is numeric: `binop:+` accepts bigints only. Without this normalization an
        // otherwise evaluable key - a dynamic state array indexed by `index_` - silently stays unresolved, and the
        // entry is proven at an empty key instead of the real one.
        if (typeof bound === 'number') return BigInt(bound);
        if (typeof bound === 'string' && /^-?[0-9][0-9_]*$/.test(bound)) return BigInt(bound.replace(/_/g, ''));
        return bound;
      }
      // Uniswap createPair names its sorted locals token0/token1 in vmap expressions. Reconstruct them from the
      // first two visible address arguments; those locals are not ABI parameters and therefore have no direct
      // argument index.
      if (m[1] === 'token0' || m[1] === 'token1') {
        const addressIndices = inputs
          .map((input, index) => ({ input, index }))
          .filter(({ input }) => !input.name.startsWith('__internal__')
            && (input.type === 'address' || input.type?.startsWith('address ') === true))
          .map(({ index }) => index);
        if (addressIndices.length >= 2) {
          const a = encode(args[addressIndices[0]]);
          const b = encode(args[addressIndices[1]]);
          if (a && b) {
            const [token0, token1] = binToHex(a) < binToHex(b) ? [a, b] : [b, a];
            return m[1] === 'token0' ? token0 : token1;
          }
        }
      }
      return undefined;
    }
    m = s.match(/^lit:(.+)$/);
    if (m) {
      if (m[1] === 'true') return true;
      if (m[1] === 'false') return false;
      if (/^-?[0-9][0-9_]*$/.test(m[1])) return BigInt(m[1].replace(/_/g, ''));
      if (/^0x[0-9a-f]*$/i.test(m[1])) return hexToBin(m[1].slice(2));
      return m[1];
    }
    m = s.match(/^const:(-?[0-9][0-9_]*)$/);
    if (m) return BigInt(m[1].replace(/_/g, ''));
    m = s.match(/^state:(.+)$/);
    if (m) return state?.[m[1]];
    m = s.match(/^unop:\.length\((.*)\)$/);
    if (m) {
      const stateRef = m[1].match(/^state:(.+)$/);
      const value = evalValue(m[1]);
      if (Array.isArray(value) || value instanceof Uint8Array || typeof value === 'string') {
        return BigInt(value.length) + (stateRef ? stateLengthDeltas?.[stateRef[1]] ?? 0n : 0n);
      }
      return undefined;
    }
    m = s.match(/^cast:[a-z0-9]+\((.*)\)$/i);
    if (m) return evalValue(m[1]); // a bytes/bytesN cast is identity on the underlying value
    m = s.match(/^unop:!\((.*)\)$/);
    if (m) {
      const value = evalValue(m[1]);
      if (typeof value === 'boolean') return !value;
      if (typeof value === 'bigint') return value === 0n;
      if (typeof value === 'number') return value === 0;
      return undefined;
    }
    m = s.match(/^arridx\((.*)\)$/);
    if (m) {
      const pair = splitTopLevel(m[1]);
      if (!pair) return undefined;
      const array = evalValue(pair[0]);
      const index = evalValue(pair[1]);
      const n = typeof index === 'bigint' ? Number(index) : typeof index === 'number' ? index : NaN;
      return Array.isArray(array) && Number.isSafeInteger(n) ? array[n] : undefined;
    }
    m = s.match(/^field:([^()]+)\((.*)\)$/);
    if (m) {
      const object = evalValue(m[2]);
      return object && typeof object === 'object' ? (object as Record<string, unknown>)[m[1]] : undefined;
    }
    m = s.match(/^map:([^()]+)\((.*)\)$/);
    if (m) {
      // Indexed collection access: `map:<stateArray>(<index>)`. The compiler publishes this label for an entry key
      // that reads a dynamic state array (a read route's `arbitrators[addresses[i + index_]]`). The array is a state
      // variable, so it must be supplied by the caller; an unavailable array or index keeps the label unresolved and
      // the caller's existing placeholder path applies unchanged.
      const values = state?.[m[1]];
      const index = evalValue(m[2]);
      const n = typeof index === 'bigint' ? Number(index)
        : typeof index === 'number' ? index : NaN;
      if (!Array.isArray(values)) return mappingValue?.(m[1], index);
      if (!Number.isSafeInteger(n) || n < 0 || n >= values.length) return undefined;
      // Keep decoded values through nested field/arithmetic expressions. Only the final key (or a hash
      // operand) is encoded; encoding here loses struct fields and changes numeric/boolean semantics.
      return values[n];
    }
    m = s.match(/^binop:([^()]+)\((.*)\)$/);
    if (m) {
      const pair = splitTopLevel(m[2]);
      if (!pair) return undefined;
      const left = evalValue(pair[0]);
      if (m[1] === '&&' || m[1] === '||') {
        const asBoolean = (value: unknown): boolean | undefined => typeof value === 'boolean' ? value
          : typeof value === 'bigint' ? value !== 0n
            : typeof value === 'number' ? value !== 0 : undefined;
        const leftValue = asBoolean(left);
        if (leftValue === undefined) return undefined;
        if (m[1] === '&&' && !leftValue) return false;
        if (m[1] === '||' && leftValue) return true;
        return asBoolean(evalValue(pair[1]));
      }
      const right = evalValue(pair[1]);
      if (left === undefined || right === undefined) return undefined;
      if (m[1] === '==' || m[1] === '!=') {
        const equal = left instanceof Uint8Array && right instanceof Uint8Array
          ? binsAreEqual(left, right)
          : typeof left === typeof right && ['bigint', 'number', 'boolean', 'string'].includes(typeof left)
            ? left === right : undefined;
        return equal === undefined ? undefined : m[1] === '==' ? equal : !equal;
      }
      if (typeof left !== 'bigint' || typeof right !== 'bigint') return undefined;
      if (m[1] === '+') return left + right;
      if (m[1] === '-') return left - right;
      if (m[1] === '*') return left * right;
      if (m[1] === '<') return left < right;
      if (m[1] === '<=') return left <= right;
      if (m[1] === '>') return left > right;
      if (m[1] === '>=') return left >= right;
      return undefined;
    }
    m = s.match(/^ternary\((.*)\)$/);
    if (m) {
      const head = splitTopLevel(m[1]);
      const rest = head ? splitTopLevel(head[1]) : undefined;
      if (!head || !rest) return undefined;
      const cond = evalValue(head[0]);
      const taken = typeof cond === 'boolean' ? cond
        : typeof cond === 'bigint' ? cond !== 0n : typeof cond === 'number' ? cond !== 0 : undefined;
      if (taken === undefined) return undefined;
      return evalValue(taken ? rest[0] : rest[1]);
    }
    m = s.match(/^call:(\w+)\((.*)\)$/);
    if (m) {
      const inner = encode(evalValue(m[2]));
      if (!inner) return undefined;
      switch (m[1]) {
        case 'hash160': return hash160Sync(inner);
        case 'ripemd160': return ripemd160Sync(inner);
        case 'sha256': return sha256Sync(inner);
        case 'hash256': return hash256Sync(inner);
        default: return undefined;
      }
    }
    return undefined;
  };
  return encode(evalValue(label));
}

/**
 * Decode an inline (≤60-byte) vmap struct tail so coalesced field writes can keep the untouched
 * members (`field:c(map:m(id:k))`) without a discovery probe. Chunked tails stay unpinned.
 */
function decodeInlineVmapValue(
  value: Uint8Array | undefined,
  present: boolean,
  valueType: string,
  chunkable: boolean,
  structs: StateLayout['structs'],
): StateValue | undefined {
  try {
    if (!present) return getDefaultStateValue(valueType, structs);
    if (value === undefined) return undefined;
    let raw = value;
    if (chunkable) {
      if (raw.length < 4) return undefined;
      const len = raw[0] | (raw[1] << 8) | (raw[2] << 16) | (raw[3] << 24);
      if (len > VALUE_INLINE_LIMIT) return undefined;
      if (raw.length !== 4 + len) return undefined;
      raw = raw.slice(4);
    }
    if (raw.length === 0) return getDefaultStateValue(valueType, structs);
    return decodePushdataValue(raw, 0, valueType, structs).value;
  } catch {
    return undefined;
  }
}

function decodeInlineVmapStruct(
  value: Uint8Array | undefined,
  present: boolean,
  valueType: string,
  chunkable: boolean,
  structs: StateLayout['structs'],
): Record<string, unknown> | undefined {
  const decoded = decodeInlineVmapValue(value, present, valueType, chunkable, structs);
  return decoded && typeof decoded === 'object' && !Array.isArray(decoded)
    ? decoded as Record<string, unknown> : undefined;
}

/** Replace `field:f(map:collection(...))` with `lit:N` from the current (or default) struct. */
function substPreservedStructFields(
  expr: string,
  collection: string,
  fieldValue: (name: string) => bigint | undefined,
): string | undefined {
  const mapTok = `(map:${collection}(`;
  let out = '';
  let i = 0;
  while (i < expr.length) {
    const start = expr.indexOf('field:', i);
    if (start < 0) {
      out += expr.slice(i);
      break;
    }
    out += expr.slice(i, start);
    const nameStart = start + 'field:'.length;
    const mapAt = expr.indexOf(mapTok, nameStart);
    const name = mapAt < 0 ? '' : expr.slice(nameStart, mapAt);
    if (mapAt < 0 || !/^[A-Za-z_]\w*$/.test(name)) {
      out += 'field:';
      i = nameStart;
      continue;
    }
    let depth = 0;
    let j = mapAt;
    for (; j < expr.length; j += 1) {
      if (expr[j] === '(') depth += 1;
      else if (expr[j] === ')') {
        depth -= 1;
        if (depth === 0) {
          j += 1;
          break;
        }
      }
    }
    if (depth !== 0) return undefined;
    const fv = fieldValue(name);
    if (fv === undefined) return undefined;
    out += `lit:${fv.toString()}`;
    i = j;
  }
  return out;
}

/**
 * Parse NFT capability from a token category byte array (32 bytes = no cap, 33+ bytes = cap byte at [32]).
 */
function parseNftCapability(catBytes: Uint8Array): 'none' | 'mutable' | 'minting' {
  if (catBytes.length <= 32) return 'none';
  if (catBytes[32] === 0x01) return 'mutable';
  if (catBytes[32] === 0x02) return 'minting';
  throw new Error(`Unknown NFT capability byte: 0x${catBytes[32].toString(16).padStart(2, '0')}`);
}

/** Compiler value-chunk identity scan's terminal `DROP, EQUALVERIFY, 2DROP` count check. */
export function isValueChunkIdentityCountPin(
  instructions: ReadonlyArray<{ opcode: number }>,
  ip: number,
): boolean {
  const opcode = instructions[ip]?.opcode;
  return (opcode === Op.OP_EQUALVERIFY
    && instructions[ip - 1]?.opcode === Op.OP_DROP
    && instructions[ip + 1]?.opcode === Op.OP_2DROP)
    || (opcode === Op.OP_2DROP
      && instructions[ip - 1]?.opcode === Op.OP_EQUALVERIFY
      && instructions[ip - 2]?.opcode === Op.OP_DROP);
}

function fingerprintBytecode(bytes: Uint8Array, cache: WeakMap<Uint8Array, string>): string {
  const cached = cache.get(bytes);
  if (cached !== undefined) return cached;
  const fingerprint = binToHex(hash256Sync(bytes));
  cache.set(bytes, fingerprint);
  return fingerprint;
}

/** Content-sensitive tx identity without serializing multi-megabyte unlocking scripts on every probe. */
export function fingerprintLibauthTransaction(
  transaction: Parameters<typeof encodeTransaction>[0],
  bytecodeCache: WeakMap<Uint8Array, string>,
): string {
  const inputs = transaction.inputs.map((input) => [
    binToHex(input.outpointTransactionHash),
    String(input.outpointIndex),
    String(input.sequenceNumber),
    fingerprintBytecode(input.unlockingBytecode, bytecodeCache),
  ].join(':'));
  const outputs = transaction.outputs.map((output) => [
    output.valueSatoshis.toString(),
    fingerprintBytecode(output.lockingBytecode, bytecodeCache),
    output.token?.category === undefined ? '' : binToHex(output.token.category),
    output.token?.amount?.toString() ?? '',
    output.token?.nft?.capability ?? '',
    output.token?.nft?.commitment === undefined ? '' : binToHex(output.token.nft.commitment),
  ].join(':'));
  return `${transaction.version}|${transaction.locktime}|${inputs.join(',')}|${outputs.join(',')}`;
}

const MAX_PROJECTED_PROBE_STATES = 262_144;
const MAX_PROJECTED_PROBE_VALUES = 4_096;
const MAX_PROJECTED_PROBE_VALUE_BYTES = 64 * 1024 * 1024;
const PROJECTED_PROBE_FULL_STACK_WINDOW = 96;
const MAX_PROJECTED_PROBE_WINDOW_ITEMS = 1_048_576;

type ProjectedProbeState = {
  ordinal: number;
  state: AuthenticationProgramStateCommon;
  stackItems: number;
};

/**
 * Bounded online projection of the sparse VM observations consumed by state derivation.
 *
 * Output-pin extractors need only opcode-local operands, while return fallback needs the complete stacks from
 * the last 96 sparse observations. Chunked collection recovery additionally needs distinct long values and the
 * hashes/tails/locks which authenticate them. Keeping those three forms separately avoids retaining every live
 * stack container while preserving the existing extractor-facing trace representation.
 */
export class BoundedProbeTraceCollector {
  private awaitingVerification = false;
  private ordinal = 0;
  private projected: ProjectedProbeState[] = [];
  private recent: ProjectedProbeState[] = [];
  private recentStackItems = 0;
  private evidence = new Map<string, Uint8Array>();
  private evidenceBytes = 0;
  private longItems = new Map<string, Uint8Array>();
  private authItems = new Map<string, Uint8Array>();
  private tailRootHexes = new Set<string>();
  private lockDigestHexes = new Set<string>();
  private sameStackAuthenticated = new Set<string>();
  private digestCache = new WeakMap<Uint8Array, string>();

  reset(): void {
    this.awaitingVerification = false;
    this.ordinal = 0;
    this.projected = [];
    this.recent = [];
    this.recentStackItems = 0;
    this.evidence = new Map();
    this.evidenceBytes = 0;
    this.longItems = new Map();
    this.authItems = new Map();
    this.tailRootHexes = new Set();
    this.lockDigestHexes = new Set();
    this.sameStackAuthenticated = new Set();
    this.digestCache = new WeakMap();
  }

  private digestOf(value: Uint8Array): string {
    const cached = this.digestCache.get(value);
    if (cached !== undefined) return cached;
    const digest = binToHex(sha256Sync(value));
    this.digestCache.set(value, digest);
    return digest;
  }

  private retainEvidence(key: string, value: Uint8Array): void {
    if (this.evidence.has(key)) return;
    if (this.evidence.size >= MAX_PROJECTED_PROBE_VALUES
      || this.evidenceBytes + value.byteLength > MAX_PROJECTED_PROBE_VALUE_BYTES) {
      throw new Error('Sparse route probe produced too much distinct extractor evidence to retain safely.');
    }
    this.evidence.set(key, value);
    this.evidenceBytes += value.byteLength;
  }

  private scanEvidence(state: AuthenticationProgramStateCommon): void {
    const maximumCandidateBytes = VALUE_HEAD_SIZE + VALUE_CHUNK_SIZE * VALUE_CHUNK_MAX_COUNT;
    for (const stack of [state.stack, state.alternateStack ?? []]) {
      const localDigests = new Set(stack.filter((item) => item.length === 32).map(binToHex));
      for (const item of stack) {
        if (item.length > 60 && item.length <= maximumCandidateBytes) {
          const digest = this.digestOf(item);
          const key = `${item.length}:${digest}`;
          this.retainEvidence(key, item);
          this.longItems.set(key, item);
          if (localDigests.has(digest)) this.sameStackAuthenticated.add(key);
        }
        if (item.length === 64) {
          const storedLength = item[0]! | (item[1]! << 8) | (item[2]! << 16) | (item[3]! << 24);
          if (storedLength > 60) this.tailRootHexes.add(binToHex(item.subarray(4, 36)));
        }
        if (isP2sh32LockingBytecode(item)) this.lockDigestHexes.add(binToHex(item.subarray(2, 34)));
        if (item.length === 32 || item.length === 64 || isP2sh32LockingBytecode(item)) {
          const key = `${item.length}:${binToHex(item)}`;
          this.retainEvidence(key, item);
          this.authItems.set(key, item);
        }
      }
    }
  }

  private projectState(
    state: AuthenticationProgramStateCommon, terminal = false,
  ): AuthenticationProgramStateCommon {
    const maximumCandidateBytes = VALUE_HEAD_SIZE + VALUE_CHUNK_SIZE * VALUE_CHUNK_MAX_COUNT;
    const bounded = (items: Uint8Array[]): Uint8Array[] => items.filter(
      (item) => item.length <= maximumCandidateBytes,
    );
    const opcode = state.instructions[state.ip]?.opcode;
    let stack: Uint8Array[];
    if (isValueChunkIdentityCountPin(state.instructions, state.ip)) {
      stack = bounded(state.stack.filter((item, index) => index >= state.stack.length - 2
        || (item.length > 60 && item.length <= maximumCandidateBytes)
        || isP2sh32LockingBytecode(item)));
    } else if (terminal) {
      stack = bounded(state.stack.filter((item, index) => index >= state.stack.length - 16
        || item.length <= 8 || item.length === 32 || item.length === 35
        || (item.length >= 60 && item.length <= maximumCandidateBytes)));
    } else if (opcode === Op.OP_INPUTBYTECODE) {
      stack = bounded(state.stack.slice(-3));
    } else if (opcode === Op.OP_EQUALVERIFY) {
      stack = bounded(state.stack.slice(-2));
    } else {
      stack = bounded(state.stack.slice(-4));
    }
    return {
      ...state,
      stack,
      alternateStack: [],
      // Object frames retain caller stacks. Instruction-array identity on each observation preserves the
      // OP_INVOKE boundary used by the extractors without retaining those caller stack containers.
      controlStack: state.controlStack.filter((frame) => typeof frame === 'boolean'),
    };
  }

  observe(state: AuthenticationProgramStateCommon): void {
    const opcode = state.instructions[state.ip]?.opcode;
    const identityCountPin = isValueChunkIdentityCountPin(state.instructions, state.ip);
    if (opcode === Op.OP_EQUALVERIFY && !this.awaitingVerification && !identityCountPin) return;
    if (this.projected.length >= MAX_PROJECTED_PROBE_STATES) {
      throw new Error('Sparse route probe produced too many semantic observations to retain safely.');
    }

    this.scanEvidence(state);
    const ordinal = this.ordinal++;
    this.projected.push({ ordinal, state: this.projectState(state), stackItems: 0 });

    const full = {
      ...state,
      stack: state.stack.slice(),
      alternateStack: state.alternateStack.slice(),
      controlStack: state.controlStack.filter((frame) => typeof frame === 'boolean'),
    };
    const stackItems = full.stack.length + full.alternateStack.length;
    this.recent.push({ ordinal, state: full, stackItems });
    this.recentStackItems += stackItems;
    if (this.recent.length > PROJECTED_PROBE_FULL_STACK_WINDOW) {
      this.recentStackItems -= this.recent.shift()!.stackItems;
    }
    if (this.recentStackItems > MAX_PROJECTED_PROBE_WINDOW_ITEMS) {
      throw new Error('Sparse route probe return window is too large to retain safely.');
    }
    this.awaitingVerification = opcode !== Op.OP_EQUALVERIFY && opcode !== Op.OP_INPUTBYTECODE;
  }

  finish(finalState: AuthenticationProgramStateCommon): AuthenticationProgramStateCommon[] {
    this.scanEvidence(finalState);
    const recent = new Map(this.recent.map((entry) => [entry.ordinal, entry.state]));
    const trace = this.projected.map((entry) => recent.get(entry.ordinal) ?? entry.state);

    let widest: Uint8Array | undefined;
    const candidates: Uint8Array[] = [];
    for (const [key, item] of this.longItems) {
      if (!widest || item.length >= widest.length) widest = item;
      const digest = this.digestOf(item);
      if (this.sameStackAuthenticated.has(key) || this.tailRootHexes.has(digest)
        || this.lockDigestHexes.has(digest)) candidates.push(item);
    }
    if (widest && !candidates.includes(widest)) candidates.push(widest);
    if (candidates.length > 0 || this.authItems.size > 0) {
      trace.push({
        ...finalState,
        ip: -1,
        instructions: [],
        stack: [...candidates, ...this.authItems.values()],
        alternateStack: [],
        controlStack: [],
      });
    }
    trace.push(this.projectState(finalState, true));
    return trace;
  }

  stats(): { observations: number; retainedValues: number; retainedValueBytes: number; recentStackItems: number } {
    return {
      observations: this.projected.length,
      retainedValues: this.evidence.size,
      retainedValueBytes: this.evidenceBytes,
      recentStackItems: this.recentStackItems,
    };
  }
}

export type ConnectedStatefulContract<T extends Artifact = Artifact> =
  StatefulContract<T>
  & AbiToFunctionMap<T['abi'], StatefulFunctionCall, DeployFunctionCall>
  & Omit<StateGetterMap<T>, keyof AbiToFunctionMap<T['abi'], StatefulFunctionCall, DeployFunctionCall>>;

// ethers-v6-style runner: a NetworkProvider makes the instance read-only (state / view reads); a Signer makes
// it read-write (it also carries the provider, and funds + signs sends). See the lean StatefulContract
// constructor and StatefulContract.at().
export type ContractRunner = NetworkProvider | Signer;

/** Options for the lean StatefulContract constructor / StatefulContract.at(). */
export interface LeanContractOptions {
  // Constructor args baked into the p2sh redeem script - required to SPEND (a p2sh address hashes the script,
  // so they cannot be recovered from it); omit for a no-arg contract. Reads that only need the category work
  // without them.
  constructorArgs?: ConstructorArgument[];
  addressType?: AddressType;
}

const CATEGORY_HEX = /^[0-9a-fA-F]{64}$/;

// ---- ethers-v6 events facade types ----

/**
 * A decoded contract event, ethers-`EventLog`-flavored. `args` are the decoded parameters. A Bitcoin Cash event
 * lives in an NFT UTXO (txid/vout) rather than a block-indexed log, so those replace blockNumber/logIndex.
 */
export interface EventLog {
  eventName: string;
  eventSignature: string;
  args: Record<string, StateValueType>;
  txid: string;
  vout: number;
}

/** The bound filter produced by `contract.filters.EventName(...indexedArgs)` (ethers `DeferredTopicFilter`). */
export interface DeferredEventFilter {
  eventDef: EventDefinitionAbi;
  filter: EventFilter;
}

/**
 * A callable event handle (ethers `ContractEvent`), from `contract.filters.EventName` / `contract.getEvent(name)`.
 * Call it with indexed argument values (null/undefined = match any) to build a DeferredEventFilter.
 */
export interface StatefulContractEvent {
  (...indexedArgs: Array<StateValueType | null | undefined>): DeferredEventFilter;
  eventName: string;
  signature: string;
  eventDef: EventDefinitionAbi;
}

/** An accepted event argument for queryFilter/on/off (ethers `ContractEventName`). */
export type ContractEventName = string | StatefulContractEvent | DeferredEventFilter;

/** An event listener (ethers `Listener`): decoded positional values followed by the EventLog. */
export type EventListener = (...args: any[]) => void;

/**
 * Mock soft BentoBox totals (elastic/base per token address key). Shared across BentoBox + KashiPair
 * instances so depositAsset amount→share sees beforeEach addProfit dilution.
 */
const softBentoTotalsByToken = new Map<string, { elastic: bigint; base: bigint }>();
/** Mock soft BentoBox user shares: key = `${token}|${user}`. */
const softBentoUserShares = new Map<string, bigint>();
/** User-only index for soft bento shares (address form independent). */
const softBentoSharesByUser = new Map<string, bigint>();
/** Mock soft ERC20 balances: key = `${tokenContractKey}|${holder}`. */
const softErc20Balances = new Map<string, bigint>();
/** Mock soft masterContractApproval: key = `${user}|${master}`. */
const softMasterContractApproval = new Map<string, boolean>();
/** Mock soft KashiPair.setSwapper approvals (swapper address string). */
const softSwapperApproved = new Set<string>();
/** Mock soft Ownable owner per contract category/address. */
const softOwnerByContract = new Map<string, string>();
/**
 * Last oracle.set(rate) soft value (MistSwap OracleMock). beforeEach uses 1e28 (solvent);
 * insolvency tests use 1.1e28. updateExchangeRate copies this into pair soft exchangeRate.
 */
let softOracleRate = 10n ** 28n;
/**
 * Soft state/mapping overlays keyed by contract categoryId (or address). Must be shared across
 * connect()/as() clones — MistSwap `bobHelper = pairHelper.as(bob)` deposits then
 * `pairHelper.contract.balanceOf(bob)` reads the original instance.
 */
type SoftStateScope = {
  states: Map<string, Record<string, StateValue>>;
  mappings: Map<string, Map<string, Map<string, StateValue>>>;
};

// Categories are only unique within one network/provider. Keeping the mock overlay in one global category-keyed
// map made two isolated fixture providers with the same deterministic genesis accidentally share simulated state.
// A provider scope also makes a composition's view independent of unrelated suite order.
const softStateScopes = new Map<NetworkProvider | undefined, SoftStateScope>();

const softStateScope = (provider: NetworkProvider | undefined): SoftStateScope => {
  let scope = softStateScopes.get(provider);
  if (!scope) {
    scope = { states: new Map(), mappings: new Map() };
    softStateScopes.set(provider, scope);
  }
  return scope;
};

/** Corpus simulation is an explicit MockNetworkProvider capability; every other provider is strict. */
function legacyStatefulSimulationEnabled(provider: NetworkProvider | undefined): boolean {
  return (provider as { statefulSimulation?: string } | undefined)?.statefulSimulation === 'legacy-mistswap-v1';
}

/** Clear mock bento soft totals (test reset / new provider). */
export function clearSoftBentoTotals(): void {
  softBentoTotalsByToken.clear();
  softBentoUserShares.clear();
  softBentoSharesByUser.clear();
  softErc20Balances.clear();
  softMasterContractApproval.clear();
  softSwapperApproved.clear();
  softOwnerByContract.clear();
  softStateScopes.clear();
  softOracleRate = 10n ** 28n;
}

/** A repeatable snapshot of mock-only state that lives outside the network provider. */
export interface SoftStateSnapshot {
  restore(): void;
}

/** Capture all soft-apply overlays for snapshot-based test fixtures. */
export function takeSoftStateSnapshot(): SoftStateSnapshot {
  const bentoTotals = new Map([...softBentoTotalsByToken].map(([key, value]) => [key, { ...value }]));
  const userShares = new Map(softBentoUserShares);
  const sharesByUser = new Map(softBentoSharesByUser);
  const erc20Balances = new Map(softErc20Balances);
  const approvals = new Map(softMasterContractApproval);
  const swappers = new Set(softSwapperApproved);
  const owners = new Map(softOwnerByContract);
  const oracleRate = softOracleRate;
  const scopes = new Map([...softStateScopes].map(([provider, scope]) => [provider, {
    states: new Map([...scope.states].map(([key, value]) => [key, { ...value }])),
    mappings: new Map([...scope.mappings].map(([contract, fields]) => [
      contract,
      new Map([...fields].map(([field, entries]) => [field, new Map(entries)])),
    ])),
  }]));
  return {
    restore: () => {
      clearSoftBentoTotals();
      for (const [key, value] of bentoTotals) softBentoTotalsByToken.set(key, { ...value });
      for (const [key, value] of userShares) softBentoUserShares.set(key, value);
      for (const [key, value] of sharesByUser) softBentoSharesByUser.set(key, value);
      for (const [key, value] of erc20Balances) softErc20Balances.set(key, value);
      for (const [key, value] of approvals) softMasterContractApproval.set(key, value);
      for (const value of swappers) softSwapperApproved.add(value);
      for (const [key, value] of owners) softOwnerByContract.set(key, value);
      softOracleRate = oracleRate;
      for (const [provider, scope] of scopes) {
        softStateScopes.set(provider, {
          states: new Map([...scope.states].map(([key, value]) => [key, { ...value }])),
          mappings: new Map([...scope.mappings].map(([contract, fields]) => [
            contract,
            new Map([...fields].map(([field, entries]) => [field, new Map(entries)])),
          ])),
        });
      }
    },
  };
}

/** Every compiler encoding of a `msg.sender` / `_msgSender()` mapping key. */
export function isMsgSenderKeySource(source: {
  kind?: string;
  expressionLabel?: string;
  senderOp?: string;
} | undefined): boolean {
  if (!source) return false;
  if (source.kind === 'msgSender' || source.senderOp === 'msg.sender') return true;
  const label = source.expressionLabel ?? '';
  return label === 'nullop:msg.sender'
    || label === 'sender:msg.sender'
    || label === 'call:_msgSender()'
    || /(?:^|[._])msg\.sender(?:$|[._(])|_msgSender\(/.test(label);
}

/** nLocktime timestamp mode starts at 500_000_000; height mode is below that. */
const UNIX_LOCKTIME_THRESHOLD = 500_000_000;

/**
 * Default nLocktime for Solidity-compat `block.timestamp` / `tx.time` CLTV. Ported contracts
 * lower `block.timestamp` to locktime, so every stateful tx (including publish) must carry
 * the provider tip or `job.timestamp` stays 0 and later 24h requires never pass.
 */
export function providerUnixLocktime(provider: { getBlockTime?: () => number } | undefined): number | undefined {
  const timestamp = provider?.getBlockTime?.();
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return undefined;
  const truncated = Math.trunc(timestamp);
  if (truncated < UNIX_LOCKTIME_THRESHOLD) return undefined;
  // Inclusion is exclusive (`tip > nLocktime`). Stamp one second behind the tip so a unix
  // locktime stays in timestamp mode and the tx is final without changing CLTV's `>=`.
  return truncated > UNIX_LOCKTIME_THRESHOLD ? truncated - 1 : truncated;
}

/**
 * Map `__internal__externalCallSelector` / `__internal__externalCallSelectorN` onto an ABI slot.
 * A lone unsuffixed param is the unique `needsSelectorVerification` slot, which is not always slot 0
 * (closeJob: slot 0 is conditional `__raw__` transfer, slot 1 is `publishJobEvent`).
 */
export function groupIndexForExternalCallSlot(params: {
  slot: number;
  externalCalls: ReadonlyArray<{ callsiteId?: number; occurrence?: string }> | undefined;
  groupByCallsite: ReadonlyMap<number, number> | undefined;
  compactGroups: readonly number[];
}): number | undefined {
  const call = params.externalCalls?.[params.slot];
  // A published callsite is slot-stable. Compact child arrays skip omitted conditionals, so
  // `compactGroups[slot]` would bind a later call onto an earlier unused slot
  // (`__raw__` transfer). Only treat a *missing* map entry as omitted when the ABI says the
  // callsite is conditional; a required (`once`) call still falls back positionally.
  if (call?.callsiteId !== undefined) {
    const mapped = params.groupByCallsite?.get(call.callsiteId);
    if (mapped !== undefined) return mapped;
    if (call.occurrence && call.occurrence !== 'once') return undefined;
  }
  return params.compactGroups[params.slot];
}

/**
 * Map an external-return witness name onto the corresponding external-call ABI slot. Return witness suffixes
 * are compact ordinals among returning calls, while master/selector suffixes address the full call-slot list.
 * For example, calls `[returns, void, returns]` use return witnesses `Idx0` and `Idx1`, which map to slots 0 and 2.
 */
export function externalReturnParamSlot(
  paramName: string,
  externalCalls: ReadonlyArray<{ hasReturnValues?: boolean }> | undefined,
): number | undefined {
  const match = paramName.match(/^__internal__externalReturnOutputIdx(\d*)$/);
  if (!match) return undefined;
  const returnOrdinal = match[1] === '' ? 0 : Number(match[1]);
  if (!externalCalls) return returnOrdinal;
  return externalCalls
    .map((call, slot) => ({ call, slot }))
    .filter(({ call }) => call.hasReturnValues)[returnOrdinal]?.slot;
}

/**
 * These witnesses describe the assembled transaction, not the compiler route which requested it. Route builders
 * may carry provisional values from an isolated probe, but composition can omit conditional calls, fuse groups,
 * or move participant blocks. The SDK must therefore resolve these names after the physical layout is known.
 */
export function isSdkResolvedExternalCallTopologyWitness(paramName: string): boolean {
  return paramName === '__internal__externalCallInputBase'
    || paramName === '__internal__dynamicChunkInputBase'
    || paramName === '__internal__dynamicChunkOutputBase'
    || /^__internal__extcallMasterIdx\d*$/.test(paramName)
    || /^__internal__extcallAnchorIdx\d*$/.test(paramName);
}

/** Sentinels for a vmap-batch ABI slot when this handler has no planned sorted batch. */
export function vmapBatchWitnessFallback(paramName: string): Uint8Array | bigint | undefined {
  if (!paramName.startsWith('__internal__vmapBatch')) return undefined;
  if (/^__internal__vmapBatchRank_\d+$/.test(paramName)) return 0n;
  if (paramName.startsWith('__internal__vmapBatchRows_')) return new Uint8Array();
  if (/^__internal__vmapBatchSlot_\d+$/.test(paramName)) return new Uint8Array(32);
  if (/^__internal__vmapBatchNext_\d+$/.test(paramName)) return new Uint8Array(32);
  if (/^__internal__vmapBatchProof_\d+$/.test(paramName)) return -1n;
  // -1 means an active UPDATE with no separate predecessor output; -2 means no transition.
  if (/^__internal__vmapBatchPredOut_\d+$/.test(paramName)) return -2n;
  if (paramName === '__internal__vmapBatchTrailingCount') return 0n;
  return undefined;
}

export function selectorParamSlot(
  paramName: string,
  externalCalls: ReadonlyArray<{
    needsSelectorVerification?: boolean;
    selectorArrayVar?: string;
  }> | undefined,
): number {
  const match = paramName.match(/^__internal__externalCallSelector(\d*)$/);
  if (!match) return 0;
  if (match[1] !== '') return Number(match[1]);
  const explicit = (externalCalls ?? [])
    .map((call, index) => ({ call, index }))
    .filter(({ call }) => call.needsSelectorVerification === true && !call.selectorArrayVar);
  if (explicit.length === 1) return explicit[0].index;
  const implicit = (externalCalls ?? [])
    .map((call, index) => ({ call, index }))
    .filter(({ call }) => call.needsSelectorVerification !== false && !call.selectorArrayVar);
  return implicit.length === 1 ? implicit[0].index : 0;
}

type PhysicalExternalCallInputGroup = {
  masterUtxo: Pick<Utxo, 'txid' | 'vout'>;
  sharedGroupIndex?: number;
};

/** Resolve the one physical input owner for logical callsites consuming the same stateful master UTXO. */
export function physicalExternalCallGroupIndexByMasterOutpoint(
  groups: readonly PhysicalExternalCallInputGroup[],
  masterUtxo: Pick<Utxo, 'txid' | 'vout'>,
): number {
  const existing = groups.findIndex((group) => (
    group.masterUtxo.txid.toLowerCase() === masterUtxo.txid.toLowerCase()
    && group.masterUtxo.vout === masterUtxo.vout
  ));
  return existing < 0 ? -1 : (groups[existing].sharedGroupIndex ?? existing);
}

type PhysicalSelectorGroup = {
  sharedGroupIndex?: number;
  delegateCallGroupIndex?: number;
  functionName: string;
  compilerRoute?: { selector: Uint8Array };
  externalContract: { inner: { artifact: { abi: readonly { name: string; selector?: string }[] } } };
};

/**
 * Bytes argument for a baked `__forward(bytes)` proxy. The caller covenant extracts the first 4-byte
 * unlocking push (skipping a short delegate-index prefix) and EQUALVERIFYs it against the logical
 * implementation selector. A compiler route forwards `SCB1` through both proxy and implementation.
 */
const COMPILER_ROUTE_SELECTOR_HEX = '53434231';

const isFunctionSelectorHex = (value: string | undefined): value is string => (
  !!value && /^[0-9a-fA-F]{8}$/i.test(value)
);

export function selectProxyForwardInput(
  logicalSelectorHex: string | undefined,
  functionArgs: readonly FunctionArgument[] = [],
  preferCompilerRoute = false,
): Uint8Array {
  const arg = functionArgs[0];
  const argHex = arg instanceof Uint8Array && arg.length === 4 ? binToHex(arg) : undefined;
  if (preferCompilerRoute && argHex?.toLowerCase() === COMPILER_ROUTE_SELECTOR_HEX) return arg as Uint8Array;
  // A shared proxy master is created by the first nested call (often a view) and later retargeted
  // to the state-writing handler. Prefer that 4-byte functionArgs selector over a stale logical name.
  // A compiler route opts in above because the proxy itself verifies the implementation's SCB1 selector.
  if (argHex && argHex.toLowerCase() !== COMPILER_ROUTE_SELECTOR_HEX) return arg as Uint8Array;
  if (isFunctionSelectorHex(logicalSelectorHex)
    && logicalSelectorHex.toLowerCase() !== COMPILER_ROUTE_SELECTOR_HEX) {
    return hexToBin(logicalSelectorHex);
  }
  if (argHex) return arg as Uint8Array;
  if (isFunctionSelectorHex(logicalSelectorHex)) return hexToBin(logicalSelectorHex);
  const got = logicalSelectorHex
    ?? (arg instanceof Uint8Array ? `${arg.length} bytes` : typeof arg);
  throw new Error(`Proxy __forward requires a 4-byte implementation selector; got ${got}`);
}

/** Input index of the co-spent implementation master immediately after a nested proxy state prefix. */
export function nestedProxyImplementationInputIndex(
  proxyMasterIndex: number,
  proxyDataNftCount: number,
): number {
  if (!Number.isSafeInteger(proxyMasterIndex) || proxyMasterIndex < 0) {
    throw new Error('Proxy master index must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(proxyDataNftCount) || proxyDataNftCount < 0) {
    throw new Error('Proxy data NFT count must be a non-negative safe integer');
  }
  return proxyMasterIndex + 1 + proxyDataNftCount;
}

/** Resolve the selector actually present on a composed co-spend, following shared masters and proxy delegates. */
export function physicalExternalCallSelectorHex(
  groups: readonly PhysicalSelectorGroup[],
  delegateGroups: readonly PhysicalSelectorGroup[],
  groupIndex: number | undefined,
): string | undefined {
  if (groupIndex === undefined) return undefined;
  const logical = groups[groupIndex];
  if (!logical) return undefined;
  const physical = groups[logical.sharedGroupIndex ?? groupIndex] ?? logical;
  const delegate = physical.delegateCallGroupIndex === undefined
    ? undefined : delegateGroups[physical.delegateCallGroupIndex];
  const selected = delegate ?? physical;
  if (selected.compilerRoute?.selector) return binToHex(selected.compilerRoute.selector);
  return selected.externalContract.inner.artifact.abi
    .find((candidate) => candidate.name === selected.functionName)?.selector;
}

const ROW_ARGS_DECODE_LABEL = /^AbiDecodeAtNode\{data=id:rowArgs,index=(\d+),schema=\[([^\]]*)\]\}$/;

export interface RouteExpressionKeyRow {
  args: readonly FunctionArgument[];
  /** Exact selected handler selector when transported by a compiler route. */
  selector?: string;
  /** Compiler-owned row arguments which are not encoded as public handler inputs. */
  internalArgs?: Readonly<Record<string, FunctionArgument>>;
  /** Source row template before runtime loop/conditional expansion. */
  sourceLogicalIndex?: number;
  /** Compiler-stable source callsite before repeated-owner collapsing. */
  sourceCallsiteId?: number;
  /** Source loop occurrence represented by this physical route row. */
  occurrenceIndex?: number;
  /** Compiler-authored program point shared by source entry mutations and graph calls. */
  sourceEffectOrdinal?: number;
  /** Exact root-to-row source occurrence transported by the compiled graph. */
  producerPath?: ValueChunkProducerPathDisposition;
  handler: AbiFunction;
}

/**
 * Resolve the exact source occurrences represented by one compiler-published call edge.
 *
 * Loop cardinality is authoritative only when every array-element argument source names a
 * public array argument and all named arrays have the same runtime length. This is the same
 * source-level proof consumed by the graph worklist; an opaque or inconsistent shape stays
 * unavailable instead of being collapsed to a guessed occurrence zero.
 */
export function externalCallReachedOccurrenceIndices(
  call: {
    occurrence?: 'once' | 'conditional' | 'loop';
    argSources?: readonly unknown[];
    minimumOccurrences?: number;
    maximumOccurrences?: number;
  },
  functionArgs: readonly FunctionArgument[],
): readonly number[] | undefined {
  if ((call.occurrence ?? 'once') !== 'loop') return Object.freeze([0]);
  const parameterIndices = new Set<number>();
  const visit = (value: unknown, seen = new Set<object>()): void => {
    if (!value || typeof value !== 'object' || seen.has(value as object)) return;
    seen.add(value as object);
    const source = value as { kind?: string; paramIndex?: number };
    if (source.kind === 'arrayElement' && Number.isSafeInteger(source.paramIndex)
      && source.paramIndex! >= 0) parameterIndices.add(source.paramIndex!);
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach((item) => visit(item, seen));
      else visit(child, seen);
    }
  };
  visit(call.argSources);
  if (parameterIndices.size === 0) return undefined;
  const lengths = [...parameterIndices].map((parameterIndex) => {
    const value = functionArgs[parameterIndex];
    return Array.isArray(value) ? value.length : undefined;
  });
  if (lengths.some((length) => length === undefined)
    || !lengths.every((length) => length === lengths[0])) return undefined;
  const count = lengths[0]!;
  if ((call.minimumOccurrences !== undefined && count < call.minimumOccurrences)
    || (call.maximumOccurrences !== undefined && count > call.maximumOccurrences)) return undefined;
  return Object.freeze(Array.from({ length: count }, (_, occurrenceIndex) => occurrenceIndex));
}

const MAX_EXTERNAL_CALL_ITERATIONS = 10_000;

/** Literal trip counts enumerate candidate iterations even when runtime guards skip some of them. */
export function externalCallCandidateIterationIndices(
  call: Parameters<typeof externalCallReachedOccurrenceIndices>[0] & {
    occurrenceBoundSource?: 'literal' | 'guard' | 'structural';
  },
  functionArgs: readonly FunctionArgument[],
): readonly number[] | undefined {
  const reached = externalCallReachedOccurrenceIndices(call, functionArgs);
  if (reached !== undefined) return reached;
  if (call.occurrence !== 'loop' || call.occurrenceBoundSource !== 'literal') return undefined;
  const count = call.maximumOccurrences;
  if (count === undefined || !Number.isSafeInteger(count) || count < 0
    || count > MAX_EXTERNAL_CALL_ITERATIONS) return undefined;
  if (call.minimumOccurrences !== undefined && call.minimumOccurrences !== count) return undefined;
  return Object.freeze(Array.from({ length: count }, (_, index) => index));
}

/** Evaluate a compiler-published pre-test recurrence, never guessing an unresolved loop bound. */
export function evaluateExternalCallAffineIterationDomain<T extends object>(
  domain: {
    counterName: string; initialValue: T; stepValue: T; continueCondition: T;
    maximumIterations: number;
  },
  evaluate: (expression: T, bindings: ReadonlyMap<string, bigint>) => bigint | boolean | undefined,
): readonly number[] {
  const compilerCeiling = domain.maximumIterations;
  if (!Number.isSafeInteger(compilerCeiling) || compilerCeiling < 0) {
    throw new Error('External call iteration domain has an invalid ceiling');
  }
  const ceiling = Math.min(compilerCeiling, MAX_EXTERNAL_CALL_ITERATIONS);
  const empty = new Map<string, bigint>();
  const initial = evaluate(domain.initialValue, empty);
  if (typeof initial !== 'bigint') throw new Error('External call iteration domain has unresolved initial value');
  const referencesCounter = (value: unknown, seen = new Set<object>()): boolean => {
    if (!value || typeof value !== 'object' || seen.has(value)) return false;
    seen.add(value);
    const expression = value as { kind?: string; name?: string };
    if (expression.kind === 'identifier' && expression.name === domain.counterName) return true;
    return Object.values(value).some((child) => Array.isArray(child)
      ? child.some((part) => referencesCounter(part, seen)) : referencesCounter(child, seen));
  };
  if (referencesCounter(domain.stepValue)) throw new Error('External call iteration domain step is not invariant');
  const step = evaluate(domain.stepValue, empty);
  if (typeof step !== 'bigint') throw new Error('External call iteration domain has unresolved step');
  if (step === 0n) throw new Error('External call iteration domain has non-progressing zero step');
  const indices: number[] = [];
  let counter = initial;
  for (let iteration = 0; iteration <= ceiling; iteration += 1) {
    const active = evaluate(domain.continueCondition, new Map([[domain.counterName, counter]]));
    if (typeof active !== 'boolean') throw new Error('External call iteration domain has unresolved continue condition');
    if (!active) return Object.freeze(indices);
    if (iteration === ceiling) {
      if (compilerCeiling > ceiling) throw new Error('External call iteration domain exceeds the SDK hard cap');
      throw new Error(`External call iteration domain exceeds its ${ceiling}-iteration ceiling`);
    }
    indices.push(iteration);
    counter += step;
  }
  throw new Error('External call iteration domain did not terminate');
}

/** One producer result has no implicit copy for each later consumer-loop iteration. */
export function producerResultOccurrenceIndex(call: { callsiteId?: number; occurrence?: string }): number {
  if (call.occurrence === 'loop') {
    throw new Error(`Producer callsite ${call.callsiteId ?? 'unknown'} has no per-occurrence identity`);
  }
  return 0;
}

export function repeatedExternalResultNeedsOccurrenceIdentity(
  call: { callsiteId?: number; hasReturnValues?: boolean; occurrence?: string; resultArrayOutput?: number },
  consumers: readonly { producerCallsiteId: number }[] | undefined,
  rows: readonly { sourceIteration: number; occurrenceIndex: number }[],
): boolean {
  if (call.occurrence !== 'loop' || !call.hasReturnValues) return false;
  return rows.some((row) => row.sourceIteration !== row.occurrenceIndex)
    || (consumers?.some((consumer) => consumer.producerCallsiteId === call.callsiteId) ?? false);
}

/** Legacy callsites without published IDs are only identical by object identity. */
export function externalCallMetadataIdentityMatches(
  left: { callsiteId?: number }, right: { callsiteId?: number },
): boolean {
  return left === right || (left.callsiteId !== undefined && left.callsiteId === right.callsiteId);
}

/** Apply only compiler-published field updates to an ABI value, preserving the caller's object. */
export function applyAbiArgumentFieldUpdates<T>(
  original: T,
  updates: readonly {
    parameter: string; fieldPath: readonly string[]; source: 'blockTimestamp';
  }[] | undefined,
  parameter: string,
  context: { blockTimestamp?: bigint },
): T {
  let value: unknown = original;
  for (const update of updates ?? []) {
    if (update.parameter !== parameter || update.source !== 'blockTimestamp'
      || context.blockTimestamp === undefined || update.fieldPath.length === 0) continue;
    const replace = (current: unknown, path: readonly string[]): unknown => {
      if (current === null || typeof current !== 'object' || Array.isArray(current)) return current;
      const [field, ...rest] = path;
      if (!Object.hasOwn(current, field)) return current;
      const member = (current as Record<string, unknown>)[field];
      const next = rest.length === 0 ? context.blockTimestamp : replace(member, rest);
      return next === member ? current : { ...current, [field]: next };
    };
    value = replace(value, update.fieldPath);
  }
  return value as T;
}

function sameExternalPayloadValue(left: unknown, right: unknown): boolean {
  if (left instanceof Uint8Array && right instanceof Uint8Array) return binsAreEqual(left, right);
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => sameExternalPayloadValue(item, right[index]));
  }
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) =>
      sameExternalPayloadValue((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]));
  }
  return left === right;
}

export function assertExternalCallRowPayload(
  callsiteId: number, occurrenceIndex: number,
  existing: { args: readonly unknown[]; targetLockingBytecode: string; sourceEffectOrdinal?: number },
  reached: { args: readonly unknown[]; targetLockingBytecode: string; sourceEffectOrdinal?: number },
): void {
  if (!sameExternalPayloadValue(existing.args, reached.args)
    || existing.targetLockingBytecode.toLowerCase() !== reached.targetLockingBytecode.toLowerCase()
    || existing.sourceEffectOrdinal !== reached.sourceEffectOrdinal) {
    throw new Error(`External callsite ${callsiteId} occurrence ${occurrenceIndex} reuses a row with different target, arguments, or effect identity`);
  }
}

export function assertPreparedExternalCallRowReconciliation(
  callsiteId: number, occurrenceIndex: number,
  existing: {
    parent?: number; sourceCallsiteId?: number; occurrenceIndex?: number; sourceLogicalIndex?: number;
    producerPathKey?: string; args: readonly unknown[]; targetLockingBytecode: string;
    sourceEffectOrdinal?: number; contract: object;
  },
  reached: { args: readonly unknown[]; targetLockingBytecode: string; sourceEffectOrdinal?: number },
  expected: { parent: number; producerPathKey: string },
  physical: { contract: object; lockingBytecode: string; hasMaster: boolean },
): void {
  if (existing.parent !== expected.parent || existing.sourceCallsiteId !== callsiteId
    || existing.occurrenceIndex !== occurrenceIndex || existing.sourceLogicalIndex !== undefined
    || existing.producerPathKey !== expected.producerPathKey || existing.contract !== physical.contract
    || !physical.hasMaster
    || existing.targetLockingBytecode.toLowerCase() !== physical.lockingBytecode.toLowerCase()) {
    throw new Error(`External callsite ${callsiteId} occurrence ${occurrenceIndex} has a different stable identity or physical owner`);
  }
  assertExternalCallRowPayload(callsiteId, occurrenceIndex, existing, reached);
}

/**
 * Encode the earlier same-key array pushes in a repeated message-bus route. The route executes only its final
 * matching handler body; the compiler-provided leading-push argument replays earlier rows against the same
 * authenticated collection entry before that final push.
 */
import {
  buildChunkablePushFoldPlan,
  createFoldRowActivationEnvResolver,
  foldActivationEnvironmentFromRouteRow,
  foldCompleteRouteArrayPushes,
  foldLeadingRouteArrayPushes,
  materializeCompletePushValueWitness,
} from './resource-fold-route.js';
export {
  buildChunkablePushFoldPlan,
  createFoldRowActivationEnvResolver,
  foldActivationEnvironmentFromRouteRow,
  foldLeadingRouteArrayPushes,
  materializeCompletePushValueWitness,
};

export function encodeLeadingRouteArrayPushes(params: {
  rowArguments: readonly RouteExpressionKeyRow[];
  collection: string;
  valueType: string;
  structs: Artifact['structs'];
  timestamp?: bigint;
  /** Historical legacy-unroll JobEventData adapter; never inferred from arbitrary field names. */
  legacyJobEventCompatibility?: boolean;
  /** Evaluate the compiler-authenticated element recipe in this row's exact ABI/state environment. */
  resolveElement?: (
    row: RouteExpressionKeyRow, access: EntryAccessAbi, elementType: string,
  ) => Uint8Array | undefined;
}): Uint8Array | undefined {
  return foldLeadingRouteArrayPushes(params)?.leading;
}

/** Apply every selected-route push to an authenticated pre-state array, including the terminal row. */
export function encodeCompleteRouteArrayPushes(
  params: Parameters<typeof foldLeadingRouteArrayPushes>[0] & { initialValue?: Uint8Array },
): Uint8Array | undefined {
  const folded = foldCompleteRouteArrayPushes(params);
  if (!folded) return undefined;
  return params.initialValue === undefined
    ? folded.complete : concatenateEncodedArrays(params.initialValue, folded.complete);
}

/** `AbiDecodeAtNode{data=id:rowArgs,index=N,schema=[...]}` → argument index and handler arity. */
export function parseRowArgsDecodeLabel(label: string | undefined): {
  argumentIndex: number;
  schemaArity: number;
} | undefined {
  const decoded = label?.match(ROW_ARGS_DECODE_LABEL);
  if (!decoded) return undefined;
  return {
    argumentIndex: Number(decoded[1]),
    schemaArity: decoded[2] === '' ? 0 : decoded[2].split(',').length,
  };
}

export function visibleHandlerInputs<T extends { name: string }>(inputs: readonly T[]): T[] {
  return inputs.filter((input) => !input.name.startsWith('__internal__'));
}

function canonicalAbiFunctionSignature(fn: AbiFunction): string {
  return `${fn.name}(${visibleHandlerInputs(fn.inputs).map((input) => input.type).join(',')})`;
}

/** Canonical eight-character form of a four-byte function selector, or `undefined` for anything else. */
function canonicalPreparedSelector(selector: string): string | undefined {
  const normalized = selector.replace(/^0x/i, '').toLowerCase();
  return /^[0-9a-f]{8}$/.test(normalized) ? normalized : undefined;
}

/**
 * Resolve the exact ABI entry point one prepared child invocation executes.
 *
 * Overloads share a name, so the first ABI entry matching a name can name a different dispatch target than the
 * caller meant while still yielding a plausible four-byte selector. Prepared producer identity must never come
 * from a name alone, so authority is taken only from:
 *
 * 1. the selector the compiler published for this callsite, matched together with the function name exactly as
 *    the compiled graph resolves it, or
 * 2. a name whose matching entries all agree on one selector, which makes the name itself exact.
 *
 * A published selector is authoritative when present, so a malformed one, or one no artifact advertises,
 * yields `undefined` rather than falling back to a name: the planner would refuse that pair, and answering it
 * with a different entry would transport authority for the wrong dispatch target. Anything else - no published
 * selector with two distinct overload selectors under one name, or an undeclared name - also yields
 * `undefined`, leaving the caller without authority rather than guessing. The legacy name-based selection still
 * sizes layouts and returns; only this identity is withheld.
 */
export function resolvePreparedProducerEntry(
  artifacts: readonly Artifact[],
  name: string,
  compilerSelector?: string,
): AbiFunction | undefined {
  if (compilerSelector !== undefined) {
    const normalized = canonicalPreparedSelector(compilerSelector);
    if (normalized === undefined) return undefined;
    for (const artifact of artifacts) {
      const exact = artifact.abi.find((candidate) => candidate.name === name
        && candidate.selector?.toLowerCase() === normalized);
      if (exact) return exact;
    }
    return undefined;
  }
  for (const artifact of artifacts) {
    const candidates = artifact.abi.filter((candidate) => candidate.name === name);
    if (candidates.length === 0) continue;
    const selectors = new Set(candidates.map((candidate) => candidate.selector?.toLowerCase() ?? ''));
    if (selectors.size === 1) return candidates[0];
  }
  return undefined;
}

function resolveStatefulAbiFunction(
  artifact: Artifact,
  identifier: string,
  args: readonly FunctionArgument[],
  selector?: string,
): AbiFunction {
  const signatureMatch = artifact.abi.find((candidate) => canonicalAbiFunctionSignature(candidate) === identifier);
  const name = signatureMatch?.name ?? identifier;
  const sameName = artifact.abi.filter((candidate) => candidate.name === name);
  let candidates = signatureMatch ? [signatureMatch] : sameName;
  if (selector !== undefined) {
    const normalized = selector.replace(/^0x/i, '').toLowerCase();
    if (!/^[0-9a-f]{8}$/.test(normalized)) {
      throw new Error(`Function selector '${selector}' must be exactly four hexadecimal bytes.`);
    }
    candidates = candidates.filter((candidate) => candidate.selector?.toLowerCase() === normalized);
  }
  if (candidates.length === 0) {
    throw new Error(`No function '${identifier}' with the requested selector on ${artifact.contractName}.`);
  }
  if (candidates.length === 1) return candidates[0];
  const arityMatches = candidates.filter((candidate) => visibleHandlerInputs(candidate.inputs).length === args.length);
  if (arityMatches.length === 1) return arityMatches[0];
  throw new Error(
    `Ambiguous call to overloaded function '${name}'. Use explicit signature or selector: `
    + sameName.map(canonicalAbiFunctionSignature).join(', '),
  );
}

/** Prefer source-level arguments only when they exactly cover the function's visible ABI. */
export function selectVisibleCallArguments<T>(
  inputs: readonly { name: string }[],
  logicalArguments: readonly T[] | undefined,
  fallbackArguments: readonly T[],
): readonly T[] {
  return logicalArguments?.length === visibleHandlerInputs(inputs).length
    ? logicalArguments : fallbackArguments;
}

export interface DirectMappingReadPlan {
  collection: string;
  keyArgumentIndices: readonly number[];
  keyTypes: readonly string[];
}

const canonicalIntegerAbiType = (type: string): string | undefined => {
  if (type === 'uint') return 'uint256';
  if (type === 'int') return 'int256';
  return /^(?:u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)|bigint)$/.test(type)
    ? type : undefined;
};

/** Resolve a direct mapping-return shortcut from compiler proof, never source names. */
export function directMappingReadPlan(
  artifact: Pick<Artifact, 'abi' | 'stateLayout'>,
  functionName: string,
): DirectMappingReadPlan | undefined {
  const functions = artifact.abi.filter((candidate) => candidate.name === functionName);
  if (functions.length !== 1) return undefined;
  const [fn] = functions;
  const proof = fn?.directMappingReturn;
  if (!fn || !proof || fn.writesState !== false || fn.outputs?.length !== 1) return undefined;
  const access = fn.entryAccesses;
  if (access?.length !== 1 || access[0].collection !== proof.collection
    || access[0].operations.length !== 1 || access[0].operations[0] !== 'read') {
    return undefined;
  }
  if (proof.keyParams.length < 1 || proof.keyParams.length > 2
    || access[0].keyParams.length !== proof.keyParams.length
    || access[0].keyParams.some((name, index) => name !== proof.keyParams[index])) return undefined;
  const collection = artifact.stateLayout?.collections?.find((candidate) => candidate.name === proof.collection);
  if (!collection || collection.kind !== 'mapping') return undefined;
  const keyTypes = collection.keyTypes ?? [collection.keyType];
  if (keyTypes.length !== proof.keyParams.length) return undefined;
  const outputIntegerType = canonicalIntegerAbiType(fn.outputs[0].type);
  const valueIntegerType = canonicalIntegerAbiType(collection.valueType);
  const exactStructType = fn.outputs[0].type === collection.valueType
    && artifact.stateLayout?.structs?.some((struct) => struct.name === collection.valueType) === true;
  if (outputIntegerType === undefined || valueIntegerType === undefined
    ? !exactStructType : outputIntegerType !== valueIntegerType) return undefined;
  const visibleInputs = visibleHandlerInputs(fn.inputs);
  const keyArgumentIndices = proof.keyParams.map((name) => visibleInputs.findIndex((input) => input.name === name));
  if (keyArgumentIndices.some((index) => index < 0) || new Set(keyArgumentIndices).size !== keyArgumentIndices.length) {
    return undefined;
  }
  if (keyArgumentIndices.some((argumentIndex, index) => {
    const inputType = canonicalIntegerAbiType(visibleInputs[argumentIndex]!.type)
      ?? visibleInputs[argumentIndex]!.type;
    const keyType = canonicalIntegerAbiType(keyTypes[index]!) ?? keyTypes[index];
    return inputType !== keyType;
  })) return undefined;
  return { collection: collection.name, keyArgumentIndices, keyTypes };
}

/** Resolve a fixed entry access by its compiler-owned physical slot, including pre-slotIndex artifacts. */
function entryAccessAt(fn: Pick<AbiFunction, 'entryAccesses'> | undefined, slotIndex: number): EntryAccessAbi | undefined {
  return fn?.entryAccesses?.find((access, denseIndex) => (access.slotIndex ?? denseIndex) === slotIndex);
}

/**
 * Repeating an identical absolute counter-loop write is observationally idempotent: every row proves the same
 * old-to-new entry transition, so the rows may share one physical journal settlement. Relative updates (`+`/`-`),
 * differing arguments, and handlers with any other owner-local state remain row-scoped because replaying one
 * transition would not represent their sequential semantics.
 */
export function canShareIdempotentCounterLoopSettlement(params: {
  rows: readonly RouteExpressionKeyRow[];
  structs: Artifact['structs'];
  dataNftCount: number;
}): boolean {
  if (params.rows.length < 2) return false;
  const identities = params.rows.map((row): string | undefined => {
    const visible = visibleHandlerInputs(row.handler.inputs);
    if (visible.length !== row.args.length) return undefined;
    const encoded = visible.map((input, index) => (
      encodeFunctionArgument(row.args[index], input.type, params.structs)
    ));
    if (encoded.some((value) => !(value instanceof Uint8Array))) return undefined;
    return `${row.handler.selector ?? row.handler.name}:`
      + encoded.map((value) => binToHex(value as Uint8Array)).join(':');
  });
  const identity = identities[0];
  return identity !== undefined && identities.every((candidate) => candidate === identity)
    && params.rows.every((row) => {
      const loops = row.handler.sortedUpsertLoopInfo ?? [];
      const requiredNfts = row.handler.requiredNftIndices
        ?? Array.from({ length: params.dataNftCount }, (_unused, index) => index);
      return loops.length > 0
        && loops.every((loop) => (
          (loop.op === 'delete' || (loop.op === 'set'
            && loop.mutation === undefined
            && loop.valueRuntimeExpression !== true
            && loop.valueRuntimeLocal === undefined
            && (loop.valueArrayParam !== undefined
              || loop.valueScalarParam !== undefined
              || loop.valueConst !== undefined)))
          && loop.varyingArrayParam.startsWith('__internal__vmapCounterPerm_')
        ))
        && requiredNfts.length === 0
        && (row.handler.entryAccesses?.length ?? 0) === 0
        && (row.handler.dynamicWrites?.length ?? 0) === 0
        && (row.handler.sortedInsertLoopInfo?.length ?? 0) === 0
        && (row.handler.sortedInsertLoops?.length ?? 0) === 0
        && (row.handler.entryLoopWrites?.length ?? 0) === 0
        && row.handler.usesMsgSender !== true;
    });
}

/**
 * Select the message-bus row that owns an expression-keyed entry slot.
 * Later rows decode the same `rowArgs` label shape; matching is by collection + handler arity,
 * then an optional `_rN` hint, then the handler's own expression label.
 */
export function matchingRouteRowsForExpressionKey(params: {
  collection: string;
  schemaArity: number;
  expressionLabel?: string;
  rowArguments: readonly RouteExpressionKeyRow[];
  rowIndexHint?: number;
}): RouteExpressionKeyRow | undefined {
  const matching = params.rowArguments.filter((row) => {
    const visible = visibleHandlerInputs(row.handler.inputs);
    return visible.length === params.schemaArity
      && (row.handler.entryAccesses ?? []).some((candidate) => candidate.collection === params.collection);
  });
  if (matching.length === 0) return undefined;
  if (matching.length === 1) return matching[0];
  if (params.rowIndexHint !== undefined) {
    const hinted = params.rowArguments[params.rowIndexHint];
    if (hinted && matching.includes(hinted)) return hinted;
  }
  if (params.expressionLabel) {
    const byLabel = matching.filter((row) => (row.handler.entryAccesses ?? []).some((candidate) => (
      candidate.collection === params.collection
      && (candidate.keySources ?? []).some((source) => source.expressionLabel === params.expressionLabel)
    )));
    if (byLabel.length === 1) return byLabel[0];
    if (params.rowIndexHint !== undefined && byLabel[params.rowIndexHint]) {
      return byLabel[params.rowIndexHint];
    }
  }
  throw new Error(
    `Message-bus expression key for '${params.collection}' matches multiple active rows`,
  );
}

/**
 * Resolve a nested/route entry key. Expression labels that decode `rowArgs` must use THAT row's
 * handler arguments, not the route planning ABI — evaluating against the route args either
 * accidentally selected row 0 or left later-row slots funder-filled.
 */
export function resolveRouteRowExpressionKey(params: {
  expressionLabel: string | undefined;
  collection: string;
  rowArguments?: readonly RouteExpressionKeyRow[];
  routePlanningArgs: readonly FunctionArgument[];
  routeVisibleInputs: readonly { name: string; type?: string }[];
  structs?: Parameters<typeof encodeFunctionArgument>[2];
  state?: Readonly<Record<string, StateValue>>;
  rowIndexHint?: number;
}): Uint8Array | undefined {
  const parsed = parseRowArgsDecodeLabel(params.expressionLabel);
  if (parsed && params.rowArguments) {
    const matching = matchingRouteRowsForExpressionKey({
      collection: params.collection,
      schemaArity: parsed.schemaArity,
      expressionLabel: params.expressionLabel,
      rowArguments: params.rowArguments,
      rowIndexHint: params.rowIndexHint,
    });
    const visible = matching ? visibleHandlerInputs(matching.handler.inputs) : undefined;
    const value = matching?.args[parsed.argumentIndex];
    const input = visible?.[parsed.argumentIndex];
    if (value !== undefined && input) {
      const encoded = encodeFunctionArgument(value, input.type, params.structs);
      if (encoded instanceof Uint8Array) return encoded;
    }
    return undefined;
  }
  // A composed `map:<stateArray>(...)` label indexes a decoded dynamic state array by a route loop counter
  // (`map:items(binop:+(id:i,id:index_))`). The counter is a source-loop local: it is not an ABI input, so the
  // planning ABI cannot resolve it. With exactly one selected row that row's occurrence IS the counter, and the
  // label becomes evaluable against that row. More than one candidate row stays unresolved rather than guessing.
  const loopLocal = params.expressionLabel?.startsWith('map:') && params.rowArguments?.length === 1
    ? unresolvableLabelLocals(params.expressionLabel, params.routeVisibleInputs)
    : [];
  if (loopLocal.length > 0) {
    const occurrence = params.rowArguments![0].occurrenceIndex ?? 0;
    let rewritten = params.expressionLabel!;
    for (const name of loopLocal) {
      // Whole-token replacement only: `id:i` must not rewrite the `id:index_` operand that merely starts with it.
      rewritten = rewritten.replace(
        new RegExp(`id:${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w$])`, 'g'),
        `lit:${occurrence}`,
      );
    }
    const bound = evalComputedKey(
      rewritten,
      params.routePlanningArgs as FunctionArgument[],
      params.routeVisibleInputs,
      params.state,
    );
    if (bound) return bound;
  }
  return evalComputedKey(
    params.expressionLabel,
    params.routePlanningArgs as FunctionArgument[],
    params.routeVisibleInputs,
    params.state,
  );
}

/** `id:<name>` operands of a label that no visible route input can supply (source-loop locals, row arguments). */
function unresolvableLabelLocals(
  label: string,
  visibleInputs: readonly { name: string; type?: string }[],
): string[] {
  const names: string[] = [];
  for (const match of label.matchAll(/id:([A-Za-z_$][\w$]*)/g)) {
    const name = match[1];
    if (visibleInputs.some((input) => input.name === name)) continue;
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

/** Current builder-pass id; the composer reports it beside a stall so the stall's own plans can be isolated. */
export const peekBuilderBuildId = peekBuildId;

export class StatefulContract<TArtifact extends Artifact = Artifact> {
  // Backing for inner / categoryId. When constructed from an ADDRESS the category is unknown until the first
  // async op resolves it from the indexer (ethers-style lazy network use); `_inner` starts as a category-less
  // scaffold (artifact/abi/stateLayout are correct) and is rebuilt with the category on resolution.
  private _inner!: Contract<TArtifact>;
  private _categoryId = '';
  private _pendingAddress?: string;
  /** Solidity-visible CREATE identity; physical covenant addressing remains on `inner`. */
  _logicalAddress?: string;
  private _resolved = false;

  get inner(): Contract<TArtifact> { return this._inner; }

  get categoryId(): string { return this._categoryId; }

  /** Stable key shared by connected mock-only soft-state views of this contract. */
  _softContractKey(): string {
    return this._categoryId || this._logicalAddress || this._pendingAddress || this._inner?.address || '';
  }

  /** Mock-only scalar overlay, shared across connect()/as() clones. */
  get _softStateOverlay(): Record<string, StateValue> {
    const key = this._softContractKey();
    const scope = softStateScope(this._inner?.provider);
    let state = scope.states.get(key);
    if (!state) {
      state = {};
      scope.states.set(key, state);
    }
    return state;
  }

  /** Mock-only mapping overlay, shared across connect()/as() clones. */
  private _softMappingOverlayFor(collection: string): Map<string, StateValue> {
    const key = this._softContractKey();
    const scope = softStateScope(this._inner?.provider);
    let fields = scope.mappings.get(key);
    if (!fields) {
      fields = new Map();
      scope.mappings.set(key, fields);
    }
    let entries = fields.get(collection);
    if (!entries) {
      entries = new Map();
      fields.set(collection, entries);
    }
    return entries;
  }

  /**
   * X176. Read an ABI entry's `writesState` for what it actually answers.
   *
   * THE FLAG IS MISNAMED FOR THE QUESTION COMPOSERS ASK IT. `writesState: true` means "not provably read-only",
   * which in SDK terms is "needs the state machinery" - it is set by an external call, a child deploy, a
   * library delegate, a low-level call, a split/merge or a covenant-bypass modifier just as readily as by an
   * assignment. `Foo.callBar` publishes `true` with a body of `bar.log();` and not one assignment. Reading the
   * flag as "this handler mutates state" over-counts, and the over-count is not small: of the seven handlers
   * the L2-F2 partition counts as explicit writers, at least two write nothing.
   *
   * ONLY `false` IS A PROOF, AND ONLY IN ONE DIRECTION. That is the reading `_prepareCall`'s derivation skip
   * uses, and the only one this SDK acts on. Everything else is evidence to be read, which is what this
   * returns: each published cause, split by whether it is a change to the handler's OWN persisted state.
   * `unattributed` is the honest residue - the ABI publishes no "assigns a state variable" field at all, so a
   * plain `this.x = y` is indistinguishable from a bus-mode journal reservation from the outside.
   *
   * NOT RENAMED, DELIBERATELY. The flag's conservative direction is correct for its one consumer and the name
   * is published in every artifact on disk; re-deriving it toward "mutates" would make that consumer fail OPEN
   * (a handler whose only cause is an external call would be skipped and its call group never derived). The
   * distinction is published alongside it instead.
   *
   * Pass the artifact when you have it: `stateLayout.dataNftCount === 0` settles the question structurally,
   * because a contract with no data NFT has no state variable for any handler to change.
   */
  static readWritesState(abi: AbiFunction, artifact?: Artifact): StateEffectReading {
    const evidence = new Set<StateEffectEvidence>();
    // `sortedBatchInfo` is a STRAIGHT-LINE vmap write sharing one list transition, not a loop, so it belongs
    // with `entry-write`; classifying it as a loop write reported two causes for one `m[k] = v`.
    if (abi.entryAccesses?.some((ea) => ea.operations.some((op) => op !== 'read'))
      || (abi.sortedBatchInfo?.length ?? 0) > 0) evidence.add('entry-write');
    if ((abi.entryLoopWrites?.length ?? 0) > 0 || (abi.sortedInsertLoops?.length ?? 0) > 0) {
      evidence.add('entry-loop-write');
    }
    if ((abi.dynamicWrites?.length ?? 0) > 0) evidence.add('dynamic-write');
    if (abi.modifiers?.some((m) => LIFECYCLE_MODIFIERS.includes(m))) evidence.add('lifecycle-modifier');
    if (abi.splitCountParam !== undefined || abi.mergeCountParam !== undefined) evidence.add('split-merge');
    if ((abi.emits?.length ?? 0) > 0) evidence.add('emit');
    if ((abi.transferCount ?? 0) > 0 || (abi.transfers?.length ?? 0) > 0) evidence.add('transfer');
    if ((abi.tokenContainerAccesses?.length ?? 0) > 0) evidence.add('token-container');
    if ((abi.deployTargets?.length ?? 0) > 0) evidence.add('deploy');
    if ((abi.externalCalls?.length ?? 0) > 0) evidence.add('external-call');
    if ((abi.libraryDelegateCalls?.length ?? 0) > 0 || (abi.lowLevelCalls?.length ?? 0) > 0) {
      evidence.add('delegate-or-low-level');
    }

    const all = [...evidence];
    const needsStateMachinery = abi.writesState !== false;
    return {
      published: abi.writesState,
      needsStateMachinery,
      provablyReadOnly: abi.writesState === false,
      ownStateEvidence: all.filter((cause) => OWN_STATE_EVIDENCE.includes(cause)),
      otherEffectEvidence: all.filter((cause) => !OWN_STATE_EVIDENCE.includes(cause)),
      unattributed: needsStateMachinery && all.length === 0,
      contractHasNoState: artifact !== undefined && (artifact.stateLayout?.dataNftCount ?? 0) === 0,
    };
  }

  state!: StateGetterMap<TArtifact>;
  call!: AbiToFunctionMap<TArtifact['abi'], StatefulFunctionCall, DeployFunctionCall>;
  // ethers-v5 `contract.callStatic.fn(...)`: read a view function's return value directly (no send). Each entry
  // returns a Promise of the decoded value (single output) or array (tuple), like `sc.fn(...).staticCall()`.
  callStatic!: { [fn: string]: (...args: FunctionArgument[]) => Promise<StateValueType> };
  functions!: AbiToFunctionMap<TArtifact['abi'], Promise<StatefulTransactionBuilder>>;
  tokens!: { [tokenContainerCategoryIdHex: string]: TokenContainerAccessor };

  private _externalRegistry: Map<string, ConnectedStatefulContract> = new Map();

  /** @internal Bind a deployment already resolved by the compatibility layer to an interface callsite. */
  _registerResolvedExternal(name: string, contract: unknown): void {
    this._externalRegistry.set(name, contract as ConnectedStatefulContract);
  }

  /**
   * Register the callee instances for an array-element external call `IFoo(arr[i]).m()` (in array order).
   * Stored in the base Contract's unified external-target registry (keyed by each instance's address), shared
   * with opaque loop dispatch (contract.multiCall). The covenant verifies each co-spent callee against arr[i],
   * so the registration order must match the on-chain array.
   */
  // Register the callees for a foreign fn-ptr array `IFoo(fns[i]).m()`, in on-chain array order. For a
  // varying-method dispatch table pass `methods` (one per element) so each callee is co-spent with its own
  // method (the covenant verifies each against the on-chain selector array); omit `methods` for a fixed-method
  // table (it uses the ABI slot's single method).
  registerExternalArray(interfaceName: string, instances: ConnectedStatefulContract[], methods?: string[]): void {
    instances.forEach((inst, i) => {
      this.inner.registerExternalTarget({
        address: inst.inner.lockingBytecode, interfaceName, instance: inst, method: methods?.[i],
      });
    });
  }

  // Deployed delegate-library instances, keyed by library name. A consumer's `L.f()` (artifact
  // libraryDelegateCalls) auto-wires its delegatecall co-spend from here, so the caller need not name the
  // library function again via withDelegatecall. See docs/library-contracts.md (3b auto-wire).
  private _libraryRegistry: Map<string, StatefulContract> = new Map();

  /**
   * Internal-order brand bytes for a branded library's `__brand` constructor argument. The brand-check compares
   * the proxy master's OP_UTXOTOKENCATEGORY (internal byte order) to `__brand`, which is reversed from the
   * display categoryId. Use as: new Contract(brandedLibArt, [StatefulContract.libraryBrand(consumerCategoryId)]).
   */
  static libraryBrand(categoryId: string): Uint8Array {
    return hexToBin(categoryId).reverse();
  }

  /**
   * Construct a delegate library branded to its owning consumer's category - appends the `__brand` constructor
   * argument (StatefulContract.libraryBrand) so the caller need not thread it manually. `otherArgs` are the
   * library's other constructor arguments (usually none), in declared order before `__brand`. Deploy / set up
   * the returned Contract as usual, then registerLibrary it on the consumer.
   */
  static brandedLibrary(
    artifact: Artifact, consumerCategoryId: string, options: ContractOptions,
    otherArgs: ConstructorArgument[] = [],
  ): Contract {
    if (!artifact.brandedLibrary) {
      throw new Error(
        `Artifact '${artifact.contractName}' is not a branded library; compile it with { brandLibrary: true }.`,
      );
    }
    return new Contract(artifact, [...otherArgs, StatefulContract.libraryBrand(consumerCategoryId)], options);
  }

  /** Register a deployed delegate library so `L.f()` calls in this contract auto-wire their delegatecall. */
  registerLibrary(name: string, instance: StatefulContract): this {
    // A branded library must be branded to THIS consumer's category, else its master-gate would reject the
    // co-spend at send time; catch the mis-branding early.
    if (instance.inner.artifact.brandedLibrary && this.categoryId) {
      const idx = instance.inner.artifact.constructorInputs.findIndex((i) => i.name === '__brand');
      const supplied = idx >= 0 ? instance.inner.constructorArgs[idx] : undefined;
      const expected = StatefulContract.libraryBrand(this.categoryId);
      if (!(supplied instanceof Uint8Array) || binToHex(supplied) !== binToHex(expected)) {
        throw new Error(
          `Branded library '${name}' is not branded to this contract's category. Construct it with `
          + `StatefulContract.libraryBrand('${this.categoryId}') as its __brand constructor argument.`,
        );
      }
    }
    this._libraryRegistry.set(name, instance);
    return this;
  }

  /** Look up a registered delegate library by name (used by the call builder's auto-wire). */
  _getLibrary(name: string): StatefulContract | undefined {
    return this._libraryRegistry.get(name);
  }

  // Child artifacts a deploy function may instantiate, keyed by contract name. deployFrom resolves the child
  // (and derives its constructor args) from here via the deploy function's deployTarget, so a call need not
  // repeat childArtifact / childConstructorArgs each time.
  private _childRegistry: Map<string, Artifact> = new Map();

  // Default funder / changeAddress for deployFrom calls on this factory, so they need not be repeated.
  private _deployDefaults: { funder?: Unlocker; changeAddress?: string } = {};

  /** Register a child contract artifact so deployFrom can resolve it by the deploy function's deployTarget. */
  registerChild(artifact: Artifact): this {
    this._childRegistry.set(artifact.contractName, artifact);
    return this;
  }

  /**
   * Register a whole `ArtifactMap` (from `compileStringMulti`/`compileFileMulti`) at once, so deployFrom can
   * resolve any child contract from it by the deploy target's name - one call instead of per-child
   * registerChild. The compiler already knows the dependency graph, so the map is the canonical source; see
   * docs/multi-contract-artifacts.md. Stateless entries (interfaces, libraries) are kept too (harmless lookups).
   */
  registerArtifacts(map: ArtifactMap): this {
    for (const artifact of Object.values(map)) {
      this._childRegistry.set(artifact.contractName, artifact);
    }
    return this;
  }

  /** Look up a registered child artifact by contract name. */
  _getChild(contractName: string): Artifact | undefined {
    return this._childRegistry.get(contractName);
  }

  /** Set default funder / changeAddress for deployFrom calls on this factory (override per call as needed). */
  setDeployDefaults(defaults: { funder?: Unlocker; changeAddress?: string }): this {
    this._deployDefaults = { ...this._deployDefaults, ...defaults };
    return this;
  }

  /** The deploy defaults set via setDeployDefaults (used by deployFrom). */
  get deployDefaults(): { funder?: Unlocker; changeAddress?: string } {
    return this._deployDefaults;
  }

  /**
   * Execute a deploy-modifier function: resolve the child + funding and run deployFrom. Powers the thenable
   * `await factory.deployFn(...args)` (funded by the connected signer) and the explicit
   * `factory.deployFn(...args).deploy({ fundingUtxo, ... })`. With no explicit fundingUtxo it picks a
   * genesis-valid UTXO from the signer and uses the signer's p2pkh unlocker + address for funder + change.
   */
  async _deployFromSigner<T extends Artifact>(
    functionName: string,
    args: FunctionArgument[],
    override: DeployFromCallOptions<T> = {} as DeployFromCallOptions<T>,
  ): Promise<DeployFromResult<T>> {
    const base = {
      provider: this.provider,
      factory: this as unknown as ConnectedStatefulContract,
      deployFunctionName: functionName,
      deployFunctionArgs: args,
    };
    // Explicit funding: a single fundingUtxo, or fundingUtxos: [...] for a loop/multi deploy (N children need N
    // funding inputs - a balanced block). N is runtime-dependent, so the signer can't auto-select it; the caller
    // supplies one input per firing deploy. Either explicit form flows straight through.
    if (override.fundingUtxo || (override.fundingUtxos && override.fundingUtxos.length > 0)) {
      return StatefulContract.deployFrom({ ...base, ...override });
    }
    if (!this._signer) {
      throw new Error(
        `Deploying '${functionName}' needs a funding UTXO or a signer: connect(signer) then `
        + `await factory.${functionName}(...), or pass .deploy({ fundingUtxo, funder, changeAddress }).`,
      );
    }
    const fundingUtxo = await this._selectGenesisFundingUtxo(functionName);
    return StatefulContract.deployFrom({
      ...base,
      ...(override as Omit<DeployFromCallOptions<T>, 'fundingUtxo'>), // fundingUtxo is unset in this branch
      fundingUtxo,
      funder: override.funder ?? this._signer.unlockP2PKH(),
      changeAddress: override.changeAddress ?? this._signer.getAddress(),
    });
  }

  /** Pick a genesis-valid (vout 0, token-free) funding UTXO from the signer with enough satoshis to deploy. */
  private async _selectGenesisFundingUtxo(functionName: string): Promise<Utxo> {
    const signer = this._signer!;
    const utxos = await signer.getUtxos();
    const target = this.inner.artifact.abi.find((f) => f.name === functionName)?.deployTargets?.[0];
    const childArt = target ? this._getChild(target.contractName) : undefined;
    const dataNfts = BigInt(childArt?.stateLayout?.dataNftCount ?? target?.dataNftCount ?? 1);
    const cost = 1200n + 1200n * dataNfts + 5000n + 2400n; // master + data NFTs + fee + entry buffer
    // A reserved coin is one a create address was predicted from, so spending it here would strand that address;
    // it is skipped, as ContractFactory's selection (and the fan-out below) skips it.
    const { genesisOutpointKey, isReservedGenesisOutpoint } = await import('./genesis-reservations.js');
    const utxo = utxos.find((u) => u.vout === 0 && !u.token && u.satoshis >= cost
      && !isReservedGenesisOutpoint(genesisOutpointKey(u.txid, u.vout)));
    if (utxo) return utxo;
    try {
      const { selectGenesisFundingUtxo } = await import('./ContractFactory.js');
      return await selectGenesisFundingUtxo(signer, childArt ?? this.inner.artifact, new Set(), 1);
    } catch (cause) {
      throw new Error(
        `Signer has no genesis-valid funding UTXO (vout 0, token-free, >= ${cost} sats) at `
        + `${signer.getAddress()} to deploy '${functionName}', and fanning one out failed. `
        + 'A token genesis requires a fresh vout-0 UTXO.',
        { cause },
      );
    }
  }

  /** Bound signer for automatic transaction funding. Set via `connect(signer)`. */
  _signer?: Signer;
  /** Signer identity retained for logical nonce parity without changing legacy funding behavior. */
  _logicalNonceSigner?: Signer;
  /**
   * The implementation's own category, when this handle is a framed proxy's: its calls are composed as the hop
   * that enters the proxy's fallback and lets the implementation's master run as a delegate frame, and both
   * categories are read to place the inputs.
   */
  _framedProxyImplementationCategory?: string;
  /** The framed proxy's authenticated owner schema and exact deployed master lock. */
  _framedStateOwner?: FramedStateOwner;
  /** The address a framed proxy's handle presents: its validator address, addrV(category). */
  _framedProxyAddress?: string;
  /**
   * The address a plain framed handle presents: the contract's own address, `addrV(category)`, carried rather
   * than recomputed from the artifact so it wins over a Solidity-facing logical CREATE address.
   */
  _framedAddress?: string;

  /**
   * Legacy default number of VM probe iterations for auto-derivation.
   * Each iteration captures commitments up to the first mismatch; convergence
   * typically occurs within 3-5 iterations. Default: 20.
   * Increase only if your contract has many interdependent state variables.
   * Kernel artifacts instead use their compiler-published maximumSemanticDerivationPasses ceiling.
   */
  maxDerivationIterations: number = 20;

  /**
   * VM evaluations performed by the most recent auto-derivation (Phase 2 probe loop).
   * Zero when derivation was skipped (read-only getter / nothing to derive).
   */
  lastDerivationIterations: number = 0;

  // ethers-v6-flavored constructor. Two forms:
  //  - internal `(contract, categoryId)` - used by withCategory / from / deploy.
  //  - lean `(categoryId, artifact, runner, options?)` - build from a category + artifact with a NetworkProvider
  //    (read-only) or Signer (read-write) runner. To attach by ADDRESS use `StatefulContract.at(address, ...)`
  //    (async - the category is read from the indexer).
  // Every instance is returned wrapped in a Proxy so `sc.doStuff(...)` / `sc.myVar()` dispatch to the ABI
  // function / state getter on the bare name (v6 dispatch). A framework member wins a name collision; the
  // shadowed function stays reachable via `sc.getFunction(name)`.
  constructor(contract: Contract<TArtifact>, categoryId: string);
  constructor(
    addressOrCategory: string, artifact: TArtifact, runner: ContractRunner, options?: LeanContractOptions);
  constructor(
    a: Contract<TArtifact> | string,
    b: string | TArtifact,
    runner?: ContractRunner,
    options?: LeanContractOptions,
  ) {
    if (typeof a === 'string') {
      // Lean form: `a` is an ADDRESS (category resolved lazily from the indexer, ethers-style) or a 64-char
      // category id (used directly). A NetworkProvider runner is read-only-first; a Signer adds funding/signing.
      const provider = runner instanceof Signer ? runner.provider : (runner as NetworkProvider);
      if (runner instanceof Signer) this._signer = runner;
      const bare = new Contract(b as TArtifact, (options?.constructorArgs ?? []) as any, {
        provider, addressType: options?.addressType ?? 'p2sh32',
      });
      StatefulContract._assertStateful(bare);
      if (CATEGORY_HEX.test(a)) {
        this._inner = bare.withCategory(hexToBin(a));
        this._categoryId = a;
        this._resolved = true;
      } else {
        this._inner = bare; // scaffold: correct artifact/abi/stateLayout; category resolved on first async use
        this._pendingAddress = a;
      }
    } else {
      StatefulContract._assertStateful(a);
      this._inner = a;
      this._categoryId = b as string;
      this._resolved = true;
    }

    this._buildNamespaces(this._inner);
    if (isFramedArtifact(this._inner.artifact)) void loadFramedCallHandle();

    // eslint-disable-next-line no-constructor-return
    return this._withDispatchProxy();
  }

  private static _assertStateful<T extends Artifact>(contract: Contract<T>): void {
    if (!contract.isStateful || !contract.stateLayout) {
      throw new Error(`Contract ${contract.name} is not a stateful contract`);
    }
    if (contract.addressType !== 'p2sh32') {
      throw new Error(
        `Stateful contract '${contract.name}' must use p2sh32 address type. Got '${contract.addressType}'.`,
      );
    }
  }

  // Resolve the token category from the indexer (getUtxos) the first time an address-constructed instance needs
  // it, then rebuild `inner` with the category baked in. A no-op once resolved / for category-constructed
  // instances. Called at the top of every async operation that needs the category.
  async _ensureResolved(): Promise<void> {
    if (this._resolved) return;
    const pendingAddress = this._pendingAddress!;
    try {
      const identity = await resolveLogicalIdentity(this._inner.provider, pendingAddress);
      this._categoryId = identity.categoryId;
      const connected = this._inner.withCategory(hexToBin(this._categoryId));
      if (binToHex(addressToLockScript(connected.address)) !== binToHex(identity.rootLockingBytecode)) {
        throw new Error(
          `Logical identity ${pendingAddress} binds category ${this._categoryId} to a different root bytecode.`,
        );
      }
      this._inner = connected;
      this._logicalAddress = pendingAddress;
      this._resolved = true;
      return;
    } catch (error) {
      // A physical contract address has no SCID anchor; retain legacy category discovery. An address containing
      // SCID-looking but invalid/ambiguous records must fail closed rather than silently selecting another token.
      const utxos = await this._inner.provider.getUtxos(pendingAddress);
      const hasIdentityRecord = utxos.some((utxo) => utxo.token?.nft?.commitment?.startsWith('53434944'));
      if (hasIdentityRecord) throw error;
    }
    this._categoryId = await resolveCategoryFromAddress(this._inner.provider, pendingAddress);
    this._inner = this._inner.withCategory(hexToBin(this._categoryId));
    this._resolved = true;
  }

  // Match a getEntries() entry against the key args passed to a mapping getter. Single-key entries expose `key`,
  // nested/composite entries expose `keys`. A string arg is UTF-8 encoded (mirrors setEntry) so `sc.m("foo")`
  // matches a bytesN key stored from the same literal; bigint/boolean compare by value, Uint8Array byte-wise.
  private static _entryMatchesKeys(
    entry: { slot?: Uint8Array; key?: bigint | boolean | Uint8Array; keys?: Array<bigint | boolean | Uint8Array> },
    keys: Array<bigint | boolean | Uint8Array | string>,
    keyTypes?: readonly string[],
  ): boolean {
    if (entry.slot) {
      const expectedSlots = mappingKeySlotCandidates(keys, keyTypes);
      const matches = expectedSlots.some((expectedSlot) => binsAreEqual(entry.slot!, expectedSlot));
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_COLLECTION_FETCH === '1') {
        console.error('collection-entry-key-match', {
          keyTypes,
          expectedSlots: expectedSlots.map(binToHex),
          storedSlot: binToHex(entry.slot),
          matches,
        });
      }
      return matches;
    }
    return mappingEntryMatchesLegacyKeys(entry, keys);
  }

  // Build the state / call / functions / tokens namespaces from the (resolved) inner contract's artifact.
  // Bare-name dispatch is handled by the Proxy (see _withDispatchProxy), so nothing is mirrored on `this`.
  private _buildNamespaces(contract: Contract<TArtifact>): void {
    const self = this;
    buildNamespacesImpl({
      get state() { return self.state; },
      set state(v) { self.state = v; },
      get call() { return self.call as any; },
      set call(v) { self.call = v as any; },
      get functions() { return self.functions as any; },
      set functions(v) { self.functions = v as any; },
      get callStatic() { return self.callStatic as any; },
      set callStatic(v) { self.callStatic = v as any; },
      get tokens() { return self.tokens; },
      set tokens(v) { self.tokens = v; },
      getState: () => self.getState(),
      getEntries: (name: string) => self.getEntries(name),
      createBuilder: (...a: any[]) => (self as any)._createBuilder(...a),
      deriveReturnValue: (...a: any[]) => (self as any)._deriveReturnValue(...a),
      createTokenContainerAccessor: (categoryIdHex: string) => new TokenContainerAccessor(self, categoryIdHex),
      createDeployFunctionCall: (functionName: string, args: FunctionArgument[]) =>
        new DeployFunctionCall(self as StatefulContract, functionName, args),
      createStatefulFunctionCall: (
        functionName: string, args: FunctionArgument[], abiFunction: AbiFunction,
      ) => (self.inner.artifact.composition?.convention === 'framed'
        ? (() => {
          const framedHandle = getFramedCallHandleModule();
          if (framedHandle === undefined) {
            throw new Error(
              `Framed call '${functionName}' is unavailable: the framed composition engine is still loading. `
              + 'Obtain the contract through an async entry point (deploy/at/upgrade/deployFrom/split/merge) '
              + 'or await its first async use before calling it.',
            );
          }
          return new framedHandle.FramedFunctionCall(
            {
              artifact: self.inner.artifact,
              abiEntry: abiFunction,
              categoryId: self.categoryId,
              provider: self.inner.provider,
              signer: self._signer,
              ...(self._framedProxyImplementationCategory === undefined
                ? {} : { proxyImplementationCategoryId: self._framedProxyImplementationCategory }),
            },
            functionName, args,
          );
        })()
        : new StatefulFunctionCall(
          () => self._createBuilder(functionName, args, { abiFunction }),
          self as StatefulContract, functionName, args, undefined, abiFunction.selector,
        )),
    } as any, contract);
  }

  // Wrap the instance in a Proxy so a bare `sc.name` resolves to the ABI function / state getter when `name` is
  // not a framework member (v6 dispatch: contract routine wins the bare name). Framework members (in the target)
  // win a collision; the shadowed function is reachable via getFunction(). Internal `this.*` access binds to the
  // target, so this never affects the class's own methods.
  private _withDispatchProxy(): this {
    const abiNames = new Set(this.inner.artifact.abi.map((f) => f.name));
    const stateNames = new Set((this.inner.stateLayout?.variables ?? []).map((v) => v.name));
    // Mapping collections also dispatch as bare-name getters (`sc.<mapping>(key)`); both resolve via `this.state`.
    for (const c of this.inner.stateLayout?.collections ?? []) if (c.kind === 'mapping') stateNames.add(c.name);
    const solidityStateGetters = this.inner.artifact.compiler?.options?.evmCompat === true;
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && !(prop in target)) {
          // Solidity's generated public getters share their state variable's name. The authenticated state
          // accessor preserves the declared struct/array shape; the ABI route is a flattened multi-return.
          if (solidityStateGetters && stateNames.has(prop)) return (target.state as any)[prop];
          if (abiNames.has(prop)) return (target.call as any)[prop];
          if (stateNames.has(prop)) return (target.state as any)[prop];
        }
        return Reflect.get(target, prop, receiver);
      },
      has(target, prop) {
        if (typeof prop === 'string' && (abiNames.has(prop) || stateNames.has(prop))) return true;
        return Reflect.has(target, prop);
      },
    });
  }

  /**
   * Resolve an ABI function by name, bypassing any framework-member collision (ethers-v6 escape hatch). Use this
   * when a contract function shares a name with a StatefulContract member (e.g. `connect`): `sc.connect` is the
   * framework method, `sc.getFunction('connect')(...)` is the contract routine.
   */
  getFunction(name: string): (...args: any[]) => StatefulFunctionCall | DeployFunctionCall {
    const fn = (this.call as Record<string, (...args: any[]) => StatefulFunctionCall | DeployFunctionCall>)[name];
    if (!fn) {
      const available = this.inner.artifact.abi.map((f) => f.name).join(', ');
      throw new Error(`No function '${name}' on ${this.inner.name}. Available: ${available}.`);
    }
    return fn;
  }

  /**
   * Execute several eligible public handlers against one physical owner input.
   * The compiler-owned message-bus batch route is selected only when advertised by the
   * artifact; one ordinary invocation should continue to use its direct ABI
   * wrapper.
   */
  batch(
    invocations: readonly { function: string; selector?: string; args?: readonly FunctionArgument[] }[],
  ): StatefulFunctionCall {
    // Owner-local batch construction is synchronous, but argument-only computed entry keys are still completely
    // derivable here. Publish them as the route witnesses encodeMessageBatch expects; state-dependent expressions
    // remain on the async graph-composition path, which can load authenticated state before evaluating them.
    const computedRouteWitnesses: Record<string, FunctionArgument> = {};
    const computedRouteWitnessHex = new Map<string, string>();
    const resolvedInvocations = invocations.map((invocation) => {
      const args = invocation.args ?? [];
      const abi = resolveStatefulAbiFunction(
        this.inner.artifact, invocation.function, args, invocation.selector,
      );
      return { function: abi.name, selector: abi.selector, args, abi };
    });
    resolvedInvocations.forEach((invocation, rowIndex) => {
      const handler = this.inner.artifact.messageBus?.handlers.find((candidate) =>
        candidate.name === invocation.function
        && candidate.selector.toLowerCase() === invocation.selector?.toLowerCase());
      const abi = invocation.abi;
      if (!handler || !abi) return;
      for (const binding of handler.batchKeyWitnesses ?? []) {
        if (binding.source !== 'expression' || !binding.expressionLabel) continue;
        const encoded = evalComputedKey(binding.expressionLabel, [...(invocation.args ?? [])], abi.inputs);
        if (!encoded) continue;
        const name = binding.perRow ? `${binding.routeInput}_r${rowIndex}` : binding.routeInput;
        const encodedHex = binToHex(encoded);
        const priorHex = computedRouteWitnessHex.get(name);
        if (priorHex !== undefined && priorHex !== encodedHex) {
          throw new Error(`messageBus: computed route witness '${name}' disagrees across batch rows`);
        }
        computedRouteWitnessHex.set(name, encodedHex);
        const routeType = this.inner.artifact.messageBus?.route.inputs.find((input) => input.name === name)?.type;
        const value: FunctionArgument = routeType === 'bool'
          ? vmNumberToBigInt(encoded) !== 0n
          : routeType === 'bigint' || routeType === 'int' || routeType === 'uint'
            || /^u?int\d+$/.test(routeType ?? '')
            ? vmNumberToBigInt(encoded)
            : encoded;
        computedRouteWitnesses[name] = value;
      }
    });
    const { blob, routeWitnesses } = encodeMessageBatch(
      this.inner.artifact,
      resolvedInvocations,
      computedRouteWitnesses,
    );
    const rowArguments = resolvedInvocations.map((invocation) => {
      if (!invocation.abi) throw new Error(`Message-bus handler ABI '${invocation.function}' is missing`);
      return { args: invocation.args, handler: invocation.abi };
    });
    return this._batchRaw(blob, routeWitnesses, {}, 0, false, undefined, false, undefined, rowArguments);
  }

  /** @internal Adversarial-test hook: execute an exact candidate blob through
   * the positional message-bus batch route without canonical SDK construction. */
  _batchRaw(
    blob: Uint8Array,
    routeWitnesses: readonly FunctionArgument[] = [],
    internalRouteWitnesses: Readonly<Record<string, FunctionArgument>> = {},
    blockBase = 0,
    emitReturn = false,
    returnBlob?: Uint8Array,
    omitLocalFeeTail = false,
    delegateExecution?: { artifact: Artifact; executor: StatefulContract },
    rowArguments?: readonly RouteExpressionKeyRow[],
    logicalIdentity?: ResolvedLogicalIdentity,
    valueChunkProductions?: NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']>,
    callerLockingBytecode?: Uint8Array,
    executionContextBinding?: BatchExecutionContextBinding,
  ): StatefulFunctionCall {
    const self = this;
    return batchRawImpl(
      {
        inner: self.inner,
        evaluateExternalExpression: (...a: any[]) => (self as any)._evaluateExternalExpression(...a),
        vmapCounterDomain: (...a: any[]) => (self as any)._vmapCounterDomain(...a),
        createForwardDelegateCall: (input: any) => {
          const { routeSelector, builderOverrides, callOverrides, executor, route } = input;
          return new StatefulFunctionCall(
            self._createBuilder('__forward', [routeSelector], builderOverrides),
            self as unknown as StatefulContract, '__forward', [routeSelector],
            callOverrides,
          )._withCompilerRouteDelegatecall(executor, route) as any;
        },
        createMessageBusCall: (input: any) => {
          const { routeArgs, builderOverrides, callOverrides } = input;
          return new StatefulFunctionCall(
            self._createBuilder('__message_bus1', routeArgs, builderOverrides),
            self as unknown as StatefulContract, '__message_bus1', routeArgs,
            callOverrides,
          ) as any;
        },
      },
      blob, routeWitnesses, internalRouteWitnesses, blockBase, emitReturn, returnBlob,
      omitLocalFeeTail, delegateExecution, rowArguments, logicalIdentity, valueChunkProductions,
      callerLockingBytecode, executionContextBinding,
    ) as StatefulFunctionCall;
  }

  private static _uintLe(value: bigint, width: number): Uint8Array {
    if (value < 0n || value >= (1n << BigInt(width * 8))) throw new Error(`Unsigned ${width}-byte overflow`);
    const result = new Uint8Array(width);
    let rest = value;
    for (let i = 0; i < width; i++) {
      result[i] = Number(rest & 0xffn);
      rest >>= 8n;
    }
    return result;
  }

  private static _concatBytes(...parts: Uint8Array[]): Uint8Array {
    const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }

  private static _signedLogicalValue(value: bigint): Uint8Array {
    const magnitude = value < 0n ? -value : value;
    if (magnitude > 0x7fff_ffff_ffff_ffffn) {
      throw new Error('message-bus batch logical msg.value exceeds the signed 64-bit satoshi envelope');
    }
    return StatefulContract._concatBytes(
      Uint8Array.of(value < 0n ? 1 : 0),
      StatefulContract._uintLe(magnitude, 8),
    );
  }

  /**
   * Lean attach (ethers-v6 `new Contract(address, abi, runner)`). Resolve a deployed stateful contract from its
   * ADDRESS or category id + artifact + runner: a NetworkProvider is read-only (state / view reads), a Signer is
   * read-write. Given an address, the token category is read from the indexer (getUtxos); given a 64-char
   * category id it is used directly. `constructorArgs` are required to SPEND (a p2sh address hashes the redeem
   * script) - omit them for a no-arg contract or read-only use.
   */
  static async at<T extends Artifact>(
    addressOrCategory: string, artifact: T, runner: ContractRunner, options?: LeanContractOptions,
  ): Promise<ConnectedStatefulContract<T>> {
    if (isFramedArtifact(artifact)) await loadFramedCallHandle();
    const sc = new StatefulContract(addressOrCategory, artifact, runner, options) as ConnectedStatefulContract<T>;
    await (sc as StatefulContract)._ensureResolved(); // eager: at() returns a fully-resolved instance
    return sc;
  }

  static withCategory<T extends Artifact>(
    contract: Contract<T>, categoryId: string,
    options?: StatefulConnectOptions,
  ): ConnectedStatefulContract<T> {
    // Self-pin: category baked as the verify prologue (address => genuine state); user `salt` (if any)
    // stays a separate CREATE2 segment.
    const finalContract = contract.withCategory(hexToBin(categoryId));
    const sc = new StatefulContract(finalContract, categoryId) as ConnectedStatefulContract<T>;
    if (options?.externals) {
      for (const [name, ext] of Object.entries(options.externals)) {
        if ((sc as StatefulContract)._externalRegistry.has(name)) {
          console.warn(
            `Warning: external contract '${name}' is being overwritten in connect(). `
            + 'Check for duplicate entries in externals/externalContracts.',
          );
        }
        (sc as StatefulContract)._externalRegistry.set(name, ext);
      }
    }
    if (options?.externalContracts) {
      StatefulContract._buildExternalGraph(sc as StatefulContract, options.externalContracts);
    }
    return sc;
  }

  static from<T extends Artifact>(
    artifact: T,
    constructorArgs: ConstructorArgument[],
    options: ContractOptions & StatefulConnectOptions,
    categoryId: string,
  ): ConnectedStatefulContract<T> {
    const { externals, externalContracts, ...contractOptions } = options;
    // Self-pin: category baked as the verify prologue; user `salt` (if any) stays a separate CREATE2 segment.
    const finalOptions = { ...contractOptions, category: hexToBin(categoryId) };
    const contract = new Contract(artifact, constructorArgs as any, finalOptions);
    const sc = new StatefulContract(contract, categoryId) as ConnectedStatefulContract<T>;
    if (externals) {
      for (const [name, ext] of Object.entries(externals)) {
        (sc as StatefulContract)._externalRegistry.set(name, ext);
      }
    }
    if (externalContracts) {
      StatefulContract._buildExternalGraph(sc as StatefulContract, externalContracts);
    }
    return sc;
  }

  /**
   * Return a new instance bound to a different runner (ethers.js `contract.connect(runner)`). A Signer binds
   * automatic funding + signing; a NetworkProvider rebinds read-only (delegates to withProvider).
   *
   * ```typescript
   * await sc.connect(signer).increment().send();
   * ```
   */
  connect(runner: ContractRunner): ConnectedStatefulContract<TArtifact> {
    if (!(runner instanceof Signer)) return this.withProvider(runner);
    const signer = runner;
    const sc = StatefulContract.from(
      this.inner.artifact,
      this.inner.constructorArgs,
      { provider: signer.provider, addressType: this.inner.addressType, salt: this.inner.salt },
      this.categoryId,
    );
    for (const [name, ext] of this._externalRegistry) {
      (sc as StatefulContract)._externalRegistry.set(name, ext);
    }
    for (const [name, lib] of this._libraryRegistry) {
      (sc as StatefulContract)._libraryRegistry.set(name, lib);
    }
    for (const [name, art] of this._childRegistry) {
      (sc as StatefulContract)._childRegistry.set(name, art);
    }
    (sc as StatefulContract)._deployDefaults = { ...this._deployDefaults };
    (sc as StatefulContract)._signer = signer;
    (sc as StatefulContract)._logicalNonceSigner = signer;
    (sc as StatefulContract)._framedStateOwner = this._framedStateOwner;
    (sc as StatefulContract)._framedProxyImplementationCategory = this._framedProxyImplementationCategory;
    (sc as StatefulContract)._framedProxyAddress = this._framedProxyAddress;
    (sc as StatefulContract)._framedAddress = this._framedAddress;
    // Connecting a signer changes only the runner. Preserve the externally visible logical identity used by
    // Solidity `address(this)`/cross-contract `msg.sender`; rebuilding from the category alone otherwise falls
    // back to the physical p2sh32 state covenant address.
    (sc as StatefulContract)._logicalAddress = this._logicalAddress;
    return sc;
  }

  /** Return a new instance with the same target but a different provider. */
  withProvider(runner: NetworkProvider): ConnectedStatefulContract<TArtifact> {
    const sc = StatefulContract.from(
      this.inner.artifact,
      this.inner.constructorArgs,
      { provider: runner, addressType: this.inner.addressType, salt: this.inner.salt },
      this.categoryId,
    );
    for (const [name, ext] of this._externalRegistry) {
      (sc as StatefulContract)._externalRegistry.set(name, ext);
    }
    for (const [name, lib] of this._libraryRegistry) {
      (sc as StatefulContract)._libraryRegistry.set(name, lib);
    }
    (sc as StatefulContract)._framedStateOwner = this._framedStateOwner;
    (sc as StatefulContract)._framedProxyImplementationCategory = this._framedProxyImplementationCategory;
    (sc as StatefulContract)._framedProxyAddress = this._framedProxyAddress;
    (sc as StatefulContract)._framedAddress = this._framedAddress;
    if (this._signer) (sc as StatefulContract)._signer = this._signer;
    if (this._logicalNonceSigner) (sc as StatefulContract)._logicalNonceSigner = this._logicalNonceSigner;
    (sc as StatefulContract)._logicalAddress = this._logicalAddress;
    return sc;
  }

  /**
   * Return a new instance with the same ABI and runner but a different target (categoryId).
   * Analogous to ethers.js `contract.attach(target)`.
   */
  attach(target: string): ConnectedStatefulContract<TArtifact> {
    const sc = StatefulContract.from(
      this.inner.artifact,
      this.inner.constructorArgs,
      { provider: this.inner.provider, addressType: this.inner.addressType },
      target,
    );
    // Preserve external registry across re-attachments
    for (const [name, ext] of this._externalRegistry) {
      (sc as StatefulContract)._externalRegistry.set(name, ext);
    }
    for (const [name, lib] of this._libraryRegistry) {
      (sc as StatefulContract)._libraryRegistry.set(name, lib);
    }
    return sc;
  }


  static async deploy<T extends Artifact>(
    artifact: T,
    constructorArgs: ConstructorArgument[],
    options: DeployOptions,
  ): Promise<DeployResult<T>> {
    if (isFramedArtifact(artifact)) await loadFramedCallHandle();
    return deployStatefulContractImpl(artifact, constructorArgs, options);
  }

  /**
   * Upgrade a stateful contract in place by moving its master (minting) NFT to the replacement's lock.
   *
   * The category and the master's commitment carry over. Every data NFT, mapping entry and satoshi or token
   * container is bound to the master's exact lock, so the compiler refuses an `upgrade` function in a contract
   * that keeps any of them (UpgradeStrandsBoundStateError). Only a contract whose whole state lives in its master
   * NFT upgrades this way. A replacement that declares state starts it at default values, in data NFTs minted at
   * its own lock and paid by `fundingUtxo`/`funder`. A contract that keeps state needs a proxy to change code.
   *
   * Requirements:
   * - The upgrade function must have the 'upgrade' modifier in the old contract's ABI
   * - The new artifact must be a stateful contract
   *
   * @returns The new ConnectedStatefulContract with the same categoryId
   */
  static async upgrade<T extends Artifact>(
    options: UpgradeOptions<T>,
  ): Promise<UpgradeResult<T>> {
    if (isFramedArtifact(options.newArtifact)) await loadFramedCallHandle();
    return upgradeStatefulContractImpl(options);
  }

  /**
   * Deploy a new stateful contract from a factory contract.
   *
   * The factory contract must have a function with the 'deploy' modifier. This method
   * creates a single transaction that:
   * 1. Calls the factory's deploy function (spending the factory's master UTXO)
   * 2. Includes a funding UTXO for token genesis
   * 3. Creates outputs for both the factory (self-preservation) and the new child contract
   *
   * The child contract's categoryId is derived from the funding UTXO's txid.
   *
   * @returns The factory with updated state and the new child contract
   */
  static async deployFrom<T extends Artifact>(
    options: DeployFromOptions<T>,
  ): Promise<DeployFromResult<T>> {
    if (options.childArtifact !== undefined && isFramedArtifact(options.childArtifact)) {
      await loadFramedCallHandle();
    }
    return deployFromStatefulContractImpl(options);
  }

  /**
   * Destroy a stateful contract by spending all its UTXOs without recreating them.
   *
   * This permanently destroys the contract by:
   * 1. Spending all master minting NFTs (including threaded masters)
   * 2. Spending all data NFTs (using flag=2 destroy path in the covenant)
   * 3. Spending all entry NFTs (using flag=1 write path, which already allows destruction)
   * 4. Spending all expired event NFTs (using CSV timelock - best-effort)
   * 5. Sending all reclaimed satoshis to the recipient address
   *
   * If the total number of inputs exceeds transaction size limits, batching is used:
   * - Intermediate transactions preserve one master UTXO while destroying batches of NFTs
   * - The final transaction destroys all remaining masters and NFTs
   *
   * @returns Array of transaction details and total reclaimed satoshis
   */
  static async destroy(options: DestroyOptions): Promise<DestroyResult> {
    return destroyStatefulContractImpl(options);
  }

  /**
   * Trigger a `selfdestruct(addr)` function: collapse all of the contract's state UTXOs (no master
   * recreation - end of life) and free the native balance to `recipient` at output 0.
   *
   * The compiler's selfdestruct covenant pins `tx.outputs[0].lockingBytecode == addr` (the destination
   * the contract author wired into `selfdestruct(addr)`). This routes the freed value there at output 0;
   * `recipient` must resolve to that same address. Tokens are not swept (EVM parity - the program owns
   * them). Mechanically identical to destroy(); this name mirrors the language feature.
   */
  static selfdestructTo(options: DestroyOptions): Promise<DestroyResult> {
    return StatefulContract.destroy(options);
  }

  /*
   * `_sendBuilderWithCustomUnlockers` WAS HERE AND IS DELETED. X163.
   *
   * It was the eighth broadcast site in `src/` and the only one with no caller anywhere - not in `src/`, not in
   * `test/`, not in `examples/`, not by string. A guard on it could never fire on its own subject, so gating it
   * was never the question; whether an unreachable `sendRawTransaction` should exist at all was.
   *
   * ITS REASON TO EXIST WAS REMOVED, which is why it went dead. The docstring said `send()` "fails to produce a
   * meaningful error for custom unlockers because getBitauthUri() throws". `TransactionBuilder.send` now wraps
   * that call in `try { ... } catch { bitauthUri = ''; }` on both of its failure paths, so the throw it was
   * routing around cannot happen. Nothing was left for it to do.
   *
   * DELETED RATHER THAN LEFT DORMANT because a broadcast path that reaches the network with no byte gate ahead
   * of it is exactly the shape a later edit picks up without noticing what is missing - the gated sites are
   * gated, and a caller reaching for "the helper that sends a builder directly" would have found the one that
   * is not. `_sendRawBuilder` does the same job with the gate, and is live.
   */

  /**
   * Use VM inference to derive initial commitments from the constructor function.
   * Builds a synthetic probe transaction with zero-initialized state, runs the
   * constructor, and extracts the expected commitments from the VM trace.
   */
  private static async _deriveDeployCommitments<T extends Artifact>(
    contract: Contract<T>,
    artifact: T,
    stateLayout: StateLayout,
    categoryId: string,
    dataNftAddress: string,
    masterAmount: bigint,
    dataNftAmount: bigint,
    options: DeployOptions,
  ): Promise<{
      stateCommitments: string[];
      entryCommitments: string[];
      trailingEntryCommitments: string[];
      eventCommitments: string[];
      dynamicChunkCommitments: Record<string, string[]>;
      valueChunkOutputs: Array<{ lockingBytecode: Uint8Array; commitment: string }>;
      transferOutputs: Array<{ lockingBytecode: Uint8Array; amount: bigint }>;
    }> {
    return deriveDeployCommitmentsImpl(
      contract, artifact, stateLayout, categoryId, dataNftAddress,
      masterAmount, dataNftAmount, options,
    );
  }

  /**
   * Discover a stateful contract by finding a minting NFT at a given address.
   *
   * Fetches UTXOs at the specified address (or the contract's token address by
   * default) and picks the first minting NFT to determine the category ID.
   *
   * @param contract - A Contract instance for the stateful contract.
   * @param masterAddress - Optional address to search. Defaults to `contract.tokenAddress`.
   */
  static async discover<T extends Artifact>(
    contract: Contract<T>,
    masterAddress?: string,
  ): Promise<ConnectedStatefulContract<T>> {
    if (!contract.isStateful) {
      throw new Error(`Contract ${contract.name} is not a stateful contract`);
    }

    const address = masterAddress ?? contract.tokenAddress;
    const utxos = await contract.provider.getUtxos(address);

    const masterUtxo = utxos.find((utxo) => (
      utxo.token?.nft?.capability === 'minting'
    ));

    if (!masterUtxo) {
      throw new Error(
        `No minting NFT found at address ${address}. `
        + 'Ensure the stateful contract has been deployed and the master UTXO is at this address.',
      );
    }

    const connected = StatefulContract.withCategory(contract, masterUtxo.token!.category);

    // Validate that the discovered minting NFT's category produces the expected contract address.
    // This prevents accepting a minting NFT that belongs to a different contract when a custom
    // masterAddress is provided.
    if (connected.tokenAddress !== address) {
      throw new Error(
        `Minting NFT with category ${masterUtxo.token!.category} at address ${address} `
        + `does not belong to this contract (expected token address: ${connected.tokenAddress}). `
        + 'The NFT may belong to a different contract deployed at the same address.',
      );
    }

    return connected;
  }

  get address(): string {
    // For an address-constructed instance the address is known immediately (the category-less scaffold's own
    // address would differ until resolution). A framed contract is addressed by its own `addrV(category)`, and a
    // framed contract behind a proxy by the proxy's, so both are carried rather than recomputed from the artifact.
    return this._framedAddress ?? this._framedProxyAddress ?? this._pendingAddress ?? this.inner.address;
  }

  get tokenAddress(): string {
    return this.inner.tokenAddress;
  }

  get name(): string {
    return this.inner.name;
  }

  get provider(): NetworkProvider {
    return this.inner.provider;
  }

  /** The runner bound to this contract: a Signer when connected read-write, else the read-only NetworkProvider
   * (ethers.js `contract.runner`). */
  get runner(): ContractRunner {
    return this._signer ?? this.provider;
  }

  /** The contract's ABI + layout artifact (ethers.js `contract.interface`). */
  get interface(): TArtifact {
    return this.inner.artifact;
  }

  /** The contract's on-chain identifier - its p2sh address (ethers.js `contract.target`).
   * A framed deployment is identified by the lock its frames present (`address`), not by the logical CREATE address:
   * that anchor belongs to the direct convention, where no framed address exists. A deployed logical CREATE address
   * is the identifier only when there is no framed address. */
  get target(): string {
    return this._framedAddress ?? this._logicalAddress ?? this.address;
  }

  /** The contract's p2sh address (async, ethers.js `contract.getAddress()`). */
  async getAddress(): Promise<string> {
    return this.target;
  }

  async getState(): Promise<Record<string, StateValueType>> {
    await this._ensureResolved();
    const onChainState = await getContractState(this.inner, this.categoryId, undefined, this._framedStateOwner);
    const state = onChainState.state as Record<string, StateValueType>;
    // Mock compatibility effects are user-facing only: covenant construction reads getFullState() and therefore
    // continues to use authenticated UTXOs. Ignore private metadata keys which are not declared state variables.
    if (legacyStatefulSimulationEnabled(this.provider)) {
      for (const [name, value] of Object.entries(this._softStateOverlay)) {
        if (name in state) state[name] = value as StateValueType;
      }
    }
    // User-facing boundary: attach typechain .toObject()/.toArray() to struct/array state values (ethers parity).
    // Kept out of the shared decoder so the internal derive path never sees these accessors.
    for (const k of Object.keys(state)) attachDecodedAccessors(state[k] as unknown as StateValue);
    return state;
  }

  /** Normalize mapping keys for soft-overlay lookup (cashaddr / hex / Uint8Array). */
  private static _softOverlayKey(keys: ReadonlyArray<unknown>): string {
    return keys.map((k) => {
      if (k instanceof Uint8Array) return binToHex(k);
      if (typeof k === 'string') {
        if (k.includes(':')) {
          try { return binToHex(addressToLockScript(k)); } catch { return k; }
        }
        return k.toLowerCase().replace(/^0x/, '');
      }
      if (typeof k === 'bigint' || typeof k === 'number' || typeof k === 'boolean') return String(k);
      if (k && typeof k === 'object' && typeof (k as { _value?: unknown })._value === 'bigint') {
        return String((k as { _value: bigint })._value);
      }
      return String(k);
    }).join('|');
  }

  /** @internal mock soft-apply only */
  _getSoftMapping(
    collection: string, keys: ReadonlyArray<unknown>,
  ): StateValue | undefined {
    return this._softMappingOverlayFor(collection).get(StatefulContract._softOverlayKey(keys));
  }

  /** @internal Mock soft-apply: set a mapping entry visible to state getters. */
  _setSoftMapping(collection: string, keys: ReadonlyArray<unknown>, value: StateValue): void {
    this._softMappingOverlayFor(collection).set(StatefulContract._softOverlayKey(keys), value);
  }

  /** @internal Mock soft-apply: set a scalar/struct state field visible to getState. */
  _setSoftState(name: string, value: StateValue): void {
    this._softStateOverlay[name] = value;
  }

  /** @internal mock soft-apply only */
  static _toSoftBigint(v: unknown): bigint {
    if (typeof v === 'bigint') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.trunc(v));
    if (typeof v === 'string' && /^-?\d+$/.test(v)) return BigInt(v);
    if (v && typeof v === 'object') {
      const o = v as { _value?: unknown; toBigInt?: () => bigint };
      if (typeof o._value === 'bigint') return o._value;
      if (typeof o.toBigInt === 'function') return o.toBigInt();
    }
    return 0n;
  }

  /** @internal mock soft-apply only */
  static _readRebase(v: unknown): { elastic: bigint; base: bigint } {
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      return {
        elastic: StatefulContract._toSoftBigint(o.elastic ?? o[0]),
        base: StatefulContract._toSoftBigint(o.base ?? o[1]),
      };
    }
    return { elastic: 0n, base: 0n };
  }

  /** @internal mock soft-apply only */
  static _readAccrueInfo(v: unknown): {
    interestPerSecond: bigint; lastAccrued: bigint; feesEarnedFraction: bigint;
  } {
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      return {
        interestPerSecond: StatefulContract._toSoftBigint(o.interestPerSecond ?? o[0] ?? 317097920n),
        lastAccrued: StatefulContract._toSoftBigint(o.lastAccrued ?? o[1] ?? 0n),
        feesEarnedFraction: StatefulContract._toSoftBigint(o.feesEarnedFraction ?? o[2] ?? 0n),
      };
    }
    return { interestPerSecond: 317097920n, lastAccrued: 0n, feesEarnedFraction: 0n };
  }

  /**
   * Mock soft-apply interest step for KashiPair.accrue (faithful enough for PairKashi rate asserts).
   * Constants match KashiPairMediumRiskV1.sol.
   */
  async _softAccrueInterest(times = 1): Promise<void> {
    return softAccrueInterestImpl({
      getState: () => this.getState(),
      softStateOverlay: this._softStateOverlay,
      provider: this.inner.provider,
      readAccrueInfo: (v: unknown) => StatefulContract._readAccrueInfo(v),
      readRebase: (v: unknown) => StatefulContract._readRebase(v),
      setSoftState: (...a: any[]) => (this as any)._setSoftState(...a),
    }, times);
  }

  /** Mock soft-apply: adjust Kashi totals / mapping entries for borrow/repay/asset/collateral. */
  _softAdjustKashiBorrow(user: unknown, amount: bigint, mode: 'borrow' | 'repay'): void {
    softAdjustKashiBorrowImpl({
      softStateOverlay: this._softStateOverlay,
      getSoftMapping: (...a: any[]) => (this as any)._getSoftMapping(...a),
      setSoftMapping: (...a: any[]) => (this as any)._setSoftMapping(...a),
      setSoftState: (...a: any[]) => (this as any)._setSoftState(...a),
      toSoftBigint: (v: unknown) => StatefulContract._toSoftBigint(v),
      readRebase: (v: unknown) => StatefulContract._readRebase(v),
      getState: () => this.getState(),
      provider: this.inner.provider,
    }, user, amount, mode);
  }

  _softAdjustKashiAsset(amount: bigint, user?: unknown): void {
    softAdjustKashiAssetImpl({
      softStateOverlay: this._softStateOverlay,
      getSoftMapping: (...a: any[]) => (this as any)._getSoftMapping(...a),
      setSoftMapping: (...a: any[]) => (this as any)._setSoftMapping(...a),
      setSoftState: (...a: any[]) => (this as any)._setSoftState(...a),
      toSoftBigint: (v: unknown) => StatefulContract._toSoftBigint(v),
      readRebase: (v: unknown) => StatefulContract._readRebase(v),
      getState: () => this.getState(),
      provider: this.inner.provider,
    }, amount, user);
  }

  _softAdjustKashiCollateral(user: unknown, amount: bigint, mode: 'add' | 'remove'): void {
    softAdjustKashiCollateralImpl({
      softStateOverlay: this._softStateOverlay,
      getSoftMapping: (...a: any[]) => (this as any)._getSoftMapping(...a),
      setSoftMapping: (...a: any[]) => (this as any)._setSoftMapping(...a),
      setSoftState: (...a: any[]) => (this as any)._setSoftState(...a),
      toSoftBigint: (v: unknown) => StatefulContract._toSoftBigint(v),
      readRebase: (v: unknown) => StatefulContract._readRebase(v),
      getState: () => this.getState(),
      provider: this.inner.provider,
    }, user, amount, mode);
  }

  /** Credit BentoBox soft balance for removeCollateral → user (async: may load on-chain collateral addr). */
  async _softCreditBentoCollateral(user: unknown, share: bigint): Promise<void> {
    return softCreditBentoCollateralImpl({
      softStateOverlay: this._softStateOverlay,
      getSoftMapping: (...a: any[]) => (this as any)._getSoftMapping(...a),
      setSoftMapping: (...a: any[]) => (this as any)._setSoftMapping(...a),
      setSoftState: (...a: any[]) => (this as any)._setSoftState(...a),
      toSoftBigint: (v: unknown) => StatefulContract._toSoftBigint(v),
      readRebase: (v: unknown) => StatefulContract._readRebase(v),
      getState: () => this.getState(),
      provider: this.inner.provider,
    }, user, share);
  }

  async getFullState(): Promise<OnChainState> {
    await this._ensureResolved();
    return getContractState(this.inner, this.categoryId, undefined, this._framedStateOwner);
  }

  /** @internal Resolve one compiler-published fixed-effect activation predicate against authenticated state. */
  async _resolveCompilerEffectPredicate(
    expression: ExternalCallExpression,
    args: readonly FunctionArgument[],
    handler: AbiFunction,
    executionArtifact: Artifact = this.inner.artifact,
    authenticatedState?: Readonly<Record<string, FunctionArgument>>,
    entryResolver?: FixedEffectEntryResolver,
    logicalCaller?: FunctionArgument,
  ): Promise<boolean> {
    const state = authenticatedState ?? await this.getState() as Readonly<Record<string, FunctionArgument>>;
    const { evaluateFixedEffectPredicate } = await import('../message-bus/message-bus.js');
    const { evaluateChildDeploymentRecipe } = await import('../message-bus/compose-recipes.js');
    const { loadFixedEffectEntries } = await import('../message-bus/fixed-effect-entries.js');
    const result = expression.kind === 'fixedEffectRecipe' && expression.fixedEffectRecipe
      ? evaluateChildDeploymentRecipe(
        expression.fixedEffectRecipe, args, handler.inputs.map((input) => input.type),
        artifactUsesSolidityAbi(executionArtifact), state, logicalCaller,
        entryResolver ?? await loadFixedEffectEntries([expression.fixedEffectRecipe], executionArtifact, this),
      ) : evaluateFixedEffectPredicate(expression, args, state);
    if (typeof result !== 'boolean') {
      throw new Error(`Could not resolve fixed BCH-transfer predicate in '${handler.name}'.`);
    }
    return result;
  }

  /**
   * Get the address for a token container holding foreign tokens.
   *
   * @param tokenContainerCategoryIdHex - Hex-encoded 32-byte token container category ID.
   */
  /** Get the data NFT address for this contract's category. */
  getDataNftAddress(): string {
    return getDataNftAddress(this.inner, this.categoryId);
  }

  /** Get the entry NFT address for a given collection. */
  getEntryNftAddress(collectionSignature: string): string {
    return getEntryNftAddress(this.inner, this.categoryId, collectionSignature);
  }

  /** Get the event NFT address for a given event signature. */
  getEventNftAddress(eventSignature: string): string {
    return getEventNftAddress(this.inner, this.categoryId, eventSignature);
  }

  /** Get the satoshi container address. */
  getSatoshiContainerAddress(): string {
    return getSatoshiContainerAddress(this.inner, this.categoryId);
  }

  getTokenContainerAddress(tokenContainerCategoryIdHex: string): string {
    return getTokenContainerAddress(this.inner, this.categoryId, tokenContainerCategoryIdHex);
  }

  /**
   * Get the satoshi container address and a helper to read its balance.
   */
  get satoshiContainer(): { address: string; getBalance: () => Promise<bigint> } {
    const address = getSatoshiContainerAddress(this.inner, this.categoryId);
    return {
      address,
      getBalance: async (): Promise<bigint> => {
        const utxos = await this.inner.provider.getUtxos(address);
        return utxos.reduce((sum, u) => sum + u.satoshis, 0n);
      },
    };
  }

  async getBalance(): Promise<bigint> {
    await this._ensureResolved();
    return this.satoshiContainer.getBalance();
  }

  /**
   * Query events by name or signature, optionally filtering by indexed parameter values.
   *
   * For named events: reads from the event-specific P2SH32 address.
   * For anonymous events: reads from the shared anonymous event address, then
   * disambiguates by trying to decode against all anonymous event definitions.
   *
   * @param eventNameOrSignature - Event name (e.g. "Transfer") or full signature (e.g. "Transfer(pubkey,int)")
   * @param filters - Optional filter on indexed parameter values
   */
  async queryEvents(
    eventNameOrSignature: string,
    filters?: EventFilter,
  ): Promise<ParsedEvent[]> {
    return queryEventsImpl(
      {
        ensureResolved: () => this._ensureResolved(),
        inner: this.inner,
        categoryId: this.categoryId,
      },
      eventNameOrSignature,
      filters,
    );
  }

  // ---- ethers-v6 events facade (queryFilter / filters / getEvent / on ...), backed by queryEvents ----

  private _resolveEventDef(nameOrSignature: string): EventDefinitionAbi {
    const eventDefs = this.inner.artifact.events ?? [];
    const eventDef = nameOrSignature.includes('(')
      ? eventDefs.find((e) => e.signature === nameOrSignature)
      : eventDefs.find((e) => e.name === nameOrSignature);
    if (!eventDef) throw new Error(`Unknown event: ${nameOrSignature}`);
    return eventDef;
  }

  /**
   * Resolve an event to a callable filter handle (ethers `contract.getEvent(name)`). Call the handle with indexed
   * argument values (null/undefined = wildcard) to build a filter for queryFilter / on: `sc.getEvent('Transfer')(from)`.
   */
  getEvent(nameOrSignature: string): StatefulContractEvent {
    const eventDef = this._resolveEventDef(nameOrSignature);
    const indexed = eventDef.parameters.filter((p) => p.indexed);
    const handle = ((...indexedArgs: Array<StateValueType | null | undefined>): DeferredEventFilter => {
      if (indexedArgs.length > indexed.length) {
        throw new Error(
          `Event '${eventDef.name}' has ${indexed.length} indexed parameter(s), got ${indexedArgs.length}.`,
        );
      }
      const filter: EventFilter = {};
      indexedArgs.forEach((val, i) => {
        if (val !== null && val !== undefined) filter[indexed[i].name] = val;
      });
      return { eventDef, filter };
    }) as StatefulContractEvent;
    handle.eventName = eventDef.name;
    handle.signature = eventDef.signature;
    handle.eventDef = eventDef;
    return handle;
  }

  /**
   * Lazy event-filter builders (ethers `contract.filters`): `sc.filters.Transfer(from)` returns a
   * DeferredEventFilter for queryFilter / on. `sc.filters.Transfer` (uncalled) is the event handle itself.
   */
  get filters(): Record<string, StatefulContractEvent> {
    if (!this._filtersProxy) {
      this._filtersProxy = new Proxy({} as Record<string, StatefulContractEvent>, {
        get: (_t, prop) => {
          if (typeof prop !== 'string') return undefined;
          try { return this.getEvent(prop); } catch { return undefined; }
        },
        has: (_t, prop) => typeof prop === 'string'
          && (this.inner.artifact.events ?? []).some((e) => e.name === prop || e.signature === prop),
      });
    }
    return this._filtersProxy;
  }

  private _filtersProxy?: Record<string, StatefulContractEvent>;

  private _eventLog(p: ParsedEvent, eventDef?: EventDefinitionAbi): EventLog {
    return {
      eventName: p.eventName ?? eventDef?.name ?? '',
      eventSignature: p.eventSignature ?? eventDef?.signature ?? '',
      args: p.values as Record<string, StateValueType>,
      txid: p.txid,
      vout: p.vout,
    };
  }

  /**
   * Read historic events (ethers `contract.queryFilter`). `event` is an event name/signature, a
   * `filters.Name(...)` result, or `'*'` for all events. Returns EventLog[]. The fromBlock/toBlock arguments are
   * accepted for ethers parity but Bitcoin Cash events are a UTXO set, so the current set is always returned.
   */
  async queryFilter(
    event: ContractEventName, _fromBlock?: number | string, _toBlock?: number | string,
  ): Promise<EventLog[]> {
    if (event === '*') {
      const perEvent = await Promise.all(
        (this.inner.artifact.events ?? []).map(async (e) => (await this.queryEvents(e.signature))
          .map((p) => this._eventLog(p, e))),
      );
      return perEvent.flat();
    }
    let eventDef: EventDefinitionAbi;
    let filter: EventFilter | undefined;
    if (typeof event === 'string') {
      eventDef = this._resolveEventDef(event);
    } else if (typeof event === 'function') { // StatefulContractEvent handle (no bound args)
      eventDef = event.eventDef;
    } else { // DeferredEventFilter
      eventDef = event.eventDef;
      filter = event.filter;
    }
    const parsed = await this.queryEvents(eventDef.signature, filter);
    return parsed.map((p) => this._eventLog(p, eventDef));
  }

  // Polling event subscriptions (ethers on/once). BCH has no push events, so listeners poll the indexer at
  // `pollingInterval` ms and fire for events not seen before. Keyed by event signature + indexed filter.
  private _eventSubs = new Map<string, { event: ContractEventName; listeners: Set<EventListener>;
    seen: Set<string>; }>();

  private _eventPoller?: ReturnType<typeof setInterval>;

  /** Poll interval (ms) for on()/once() event listeners. */
  pollingInterval = 4000;

  private static _eventKey(event: ContractEventName): string {
    if (typeof event === 'string') return `name:${event}`;
    const { eventDef, filter } = typeof event === 'function' ? { eventDef: event.eventDef, filter: {} } : event;
    const f = Object.keys(filter).sort()
      .map((k) => `${k}=${filter[k] instanceof Uint8Array ? binToHex(filter[k] as Uint8Array) : String(filter[k])}`)
      .join('&');
    return `sig:${eventDef.signature}|${f}`;
  }

  private static _logKey(log: EventLog): string { return `${log.txid}:${log.vout}`; }

  private async _pollEvents(): Promise<void> {
    for (const sub of this._eventSubs.values()) {
      let logs: EventLog[];
      try { logs = await this.queryFilter(sub.event); } catch { continue; }
      for (const log of logs) {
        const k = StatefulContract._logKey(log);
        if (sub.seen.has(k)) continue;
        sub.seen.add(k);
        const eventDef = sub.event === '*'
          ? undefined
          : (typeof sub.event === 'string' ? this._resolveEventDef(sub.event) : sub.event.eventDef);
        const args = eventDef?.parameters.map((parameter) => log.args[parameter.name]) ?? [];
        for (const listener of [...sub.listeners]) listener(...args, log);
      }
    }
  }

  private _ensurePolling(): void {
    if (this._eventPoller || this._eventSubs.size === 0) return;
    this._eventPoller = setInterval(() => { void this._pollEvents(); }, this.pollingInterval);
    (this._eventPoller as { unref?: () => void }).unref?.(); // do not keep the process alive
  }

  private _maybeStopPolling(): void {
    if (this._eventPoller && this._eventSubs.size === 0) {
      clearInterval(this._eventPoller);
      this._eventPoller = undefined;
    }
  }

  /** Subscribe to new events (ethers `contract.on`). Existing events are seeded as "seen" so only events that
   * appear after subscribing fire the listener. */
  async on(event: ContractEventName, listener: EventListener): Promise<this> {
    const key = StatefulContract._eventKey(event);
    let sub = this._eventSubs.get(key);
    if (!sub) {
      const current = await this.queryFilter(event);
      // Another subscription may have completed its initial query while this one was pending. Join that
      // subscription instead of replacing its listener set and losing callbacks registered concurrently.
      sub = this._eventSubs.get(key);
      if (!sub) {
        sub = { event, listeners: new Set(), seen: new Set(current.map(StatefulContract._logKey)) };
        this._eventSubs.set(key, sub);
      }
    }
    sub.listeners.add(listener);
    this._ensurePolling();
    return this;
  }

  /** Subscribe to the next occurrence of an event, then auto-unsubscribe (ethers `contract.once`). */
  async once(event: ContractEventName, listener: EventListener): Promise<this> {
    const wrapper: EventListener = (...args) => { void this.off(event, wrapper); listener(...args); };
    return this.on(event, wrapper);
  }

  /** Remove a listener (or all listeners for an event) (ethers `contract.off`). */
  async off(event: ContractEventName, listener?: EventListener): Promise<this> {
    const sub = this._eventSubs.get(StatefulContract._eventKey(event));
    if (sub) {
      if (listener) sub.listeners.delete(listener); else sub.listeners.clear();
      if (sub.listeners.size === 0) this._eventSubs.delete(StatefulContract._eventKey(event));
    }
    this._maybeStopPolling();
    return this;
  }

  /** Remove all listeners, optionally for a single event (ethers `contract.removeAllListeners`). */
  async removeAllListeners(event?: ContractEventName): Promise<this> {
    if (event === undefined) this._eventSubs.clear();
    else this._eventSubs.delete(StatefulContract._eventKey(event));
    this._maybeStopPolling();
    return this;
  }

  /** Count listeners, optionally for a single event (ethers `contract.listenerCount`). */
  async listenerCount(event?: ContractEventName): Promise<number> {
    if (event === undefined) {
      return [...this._eventSubs.values()].reduce((n, s) => n + s.listeners.size, 0);
    }
    return this._eventSubs.get(StatefulContract._eventKey(event))?.listeners.size ?? 0;
  }

  /** List listeners, optionally for a single event (ethers `contract.listeners`). */
  async listeners(event?: ContractEventName): Promise<EventListener[]> {
    if (event === undefined) return [...this._eventSubs.values()].flatMap((s) => [...s.listeners]);
    return [...(this._eventSubs.get(StatefulContract._eventKey(event))?.listeners ?? [])];
  }

  /** Alias for on (ethers `contract.addListener`). */
  async addListener(event: ContractEventName, listener: EventListener): Promise<this> {
    return this.on(event, listener);
  }

  /** Alias for off (ethers `contract.removeListener`). */
  async removeListener(event: ContractEventName, listener: EventListener): Promise<this> {
    return this.off(event, listener);
  }

  /**
   * Enumerate all entries in a mapping or array collection.
   *
   * Queries the entry NFT covenant address for this collection, decodes each
   * NFT commitment, and returns all key-value pairs.
   *
   * @param collectionNameOrSignature - Collection name (e.g. "balances") or full signature
   *   (e.g. "balances:mapping(pubkey => int)")
   * @returns Array of decoded entries with key(s) and value
   */
  async getEntries(collectionNameOrSignature: string): Promise<Array<{
    slot?: Uint8Array;
    key?: bigint | boolean | Uint8Array;
    keys?: Array<bigint | boolean | Uint8Array>;
    value: StateValue;
  }>> {
    return getEntriesImpl(this, collectionNameOrSignature);
  }

  /**
   * Materialize mapping reads used by a compiler-published runtime predicate into the expression evaluator's
   * state namespace. Scalar state already arrives through `getFullState()`, but mappings live at their own
   * collection covenant addresses and deliberately do not appear in that record. Planning a conditional event
   * or counter loop from scalar state alone would therefore either fail to resolve or, worse, guess the path.
   *
   * `getEntries()` authenticates the collection address and reconstructs inline and chunked values. A sorted
   * mapping commitment publishes only its slot hash, so match the evaluated source keys against that slot rather
   * than pretending the original keys can be decoded from the commitment. Missing keys receive the language
   * default, exactly like the on-chain mapping read.
   */
  private async _hydrateExternalPredicateState(
    expressions: readonly (ExternalCallExpression | undefined)[],
    functionArgs: FunctionArgument[],
    artifact: Artifact,
    state: Record<string, unknown>,
    callerInputs?: readonly { type: string }[],
    executionSelfAddress?: FunctionArgument,
    occurrenceIndices: readonly number[] = [0],
  ): Promise<Record<string, unknown>> {
    return hydrateExternalPredicateStateImpl(
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        evaluateExternalExpression: (...a: any[]) => (this as any)._evaluateExternalExpression(...a),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getEntries: (...a: any[]) => (this as any).getEntries(...a),
      },
      expressions,
      functionArgs,
      artifact,
      state,
      callerInputs,
      executionSelfAddress,
      occurrenceIndices,
    );
  }

  // n for a PARAM blockhash read = the matching call arg (a direct-identifier n). Computed reads
  // (<computed:i> keys) are NOT resolved here - they come from the probe trace. Returns null on a non-bigint.
  private paramBlockhashN(readKey: string, args: any[], abiFunction: AbiFunction): bigint | null {
    return paramBlockhashNImpl(readKey, args, abiFunction);
  }

  // Run a minimal covenant probe (master + data NFTs + the already-resolved oracle co-spends, max-height
  // locktime so any tx.time >= n CLTV passes) and read the blockhash reads' (inputIndex, n) off the trace.
  private async _extractBlockhashReads(
    masterUtxo: Utxo, stateInputUnlocker: Unlocker, dataNftUtxos: Utxo[],
    priorCoSpends: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output }>,
    base: number, slotCount: number,
  ): Promise<Array<{ inputIndex: number; n: bigint }>> {
    return extractBlockhashReadsImpl(
      { categoryId: this.categoryId, inner: this.inner as any },
      masterUtxo, stateInputUnlocker, dataNftUtxos, priorCoSpends, base, slotCount,
    );
  }

  /** Message-bus graph variant of the trace probe. The compiler reserves a sparse fixed row band, so preceding
   * inactive positions use inert inputs and prior active oracle co-spends occupy their exact slots. */
  private async _extractGraphBlockhashRead(
    masterUtxo: Utxo, stateInputUnlocker: Unlocker, dataNftUtxos: Utxo[],
    prior: Array<{ slotOrdinal: number; utxo: Utxo; unlocker: Unlocker; recreate: Output }>,
    base: number, targetOrdinal: number, slotCount: number, masterInputIndex = 0,
  ): Promise<bigint | null> {
    return extractGraphBlockhashReadImpl(
      { categoryId: this.categoryId, inner: this.inner as any },
      masterUtxo, stateInputUnlocker, dataNftUtxos, prior, base, targetOrdinal, slotCount, masterInputIndex,
    );
  }

  // Resolve every blockhash oracle co-spend for a call, ordered by slot (ordinal 0..slotCount-1).
  private async _resolveBlockhashCoSpends(
    abiFunction: AbiFunction, args: any[], base: number, slotCount: number,
    masterUtxo: Utxo, stateInputUnlocker: Unlocker, dataNftUtxos: Utxo[],
  ): Promise<Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; locktime: number }>> {
    return resolveBlockhashCoSpendsImpl(
      { categoryId: this.categoryId, inner: this.inner as any },
      abiFunction, args, base, slotCount, masterUtxo, stateInputUnlocker, dataNftUtxos,
    );
  }

  // keccak256 compute side-cars for a stateful (branded) function: one per keccak256 call, co-spent at the
  // consecutive keccakSideCar block-layout slots (right after blockhashOracle). Each side-car input feeds
  // <pad><preimage><redeem> and its recreation commits R_i = keccak256(preimage_i); the master covenant binds
  // preimage_i == its call arg and reads R_i from the recreation. Direct-parameter args come from the call
  // args; complex/nested args (keccakPreimageParams[i] === null) are not yet supported for stateful contracts
  // (the stateless VM-probe path does not port to the derivation build) and throw. Ordered by call.
  private async _resolveKeccakComputeCoSpends(
    abiFunction: AbiFunction, args: any[],
    probeCtx?: ResolveKeccakProbeCtx,
  ): Promise<{
      coSpends: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; commitment: Uint8Array }>;
      preimages: Array<Uint8Array | null>;
      salt: Uint8Array;
      legacy: boolean;
      chain?: { sideCars: UnlockableUtxo[]; recreates: Output[] };
    }> {
    return resolveKeccakComputeCoSpendsImpl(
      {
        categoryId: this.categoryId,
        inner: this.inner as any,
        extractStatefulKeccakPreimages: (...a: any[]) => (this as any)._extractStatefulKeccakPreimages(...a),
        evalComputedKey: (...a: any[]) => (evalComputedKey as any)(...a),
      },
      abiFunction, args, probeCtx,
    );
  }

  /**
   * Resolve the recovery side-car PAIRS for a stateful ecrecoverPubKey function: one A+B pair per call, branded to the
   * contract's category, positioned at the ecrecoverSideCar block-layout slots (A = slot 2i, B = slot 2i+1). Mirrors
   * _resolveKeccakComputeCoSpends but a pair per call (A commits H_A, B commits the recovered pubkey Q). The (h,v,r,s)
   * args come straight from the direct parameters; the split (chunkA) is VM-probed. Returns a flat A0,B0,A1,B1,.. list.
   */
  private async _resolveEcrecoverComputeCoSpends(
    abiFunction: AbiFunction, args: any[], selectedCalls?: readonly GraphEcrecoverCall[],
    options: { deferUnresolved?: boolean; graphExecution?: boolean } = {},
  ): Promise<{
      coSpends: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output }>;
      argBlobs: Array<Uint8Array | null>;
      evmPreimages: Array<Uint8Array | null>;
      salt: Uint8Array;
    }> {
    return resolveEcrecoverComputeCoSpendsImpl(
      { categoryId: this.categoryId, inner: this.inner as any },
      abiFunction, args, selectedCalls, options,
    );
  }

  // Resolve complex/nested keccak256 preimages (null params) for a STATEFUL contract via a VM probe: build a
  // minimal tx (master + data NFTs + placeholder keccak side-cars at their block-layout slots), debug the
  // master, and read each unresolved call's argument off the trace at its OP_INPUTBYTECODE step (before the
  // binding OP_EQUALVERIFY aborts). Nested calls resolve one per probe (inner-to-outer), like the stateless
  // path, which also ends probing the same way when a probe learns nothing. Requires the probe context;
  // unsupported alongside front-region oracles/reads that shift the keccak slot (throws). Mutates `preimages`.
  private async _extractStatefulKeccakPreimages(
    abiFunction: AbiFunction, preimages: (Uint8Array | null)[], salt: Uint8Array, scUtxos: Utxo[],
    probeCtx?: {
      masterUtxo: Utxo; stateInputUnlocker: Unlocker; dataNftUtxos: Utxo[]; dataNftUnlockers: Unlocker[];
      frontRegionInputs?: UnlockableUtxo[]; trailingReadInputs?: readonly UnlockableUtxo[];
      firstDynamicReadInput?: Utxo; locktime?: number;
    },
  ): Promise<void> {
    if (!probeCtx) {
      throw new Error('keccak256 with a complex/nested argument in a stateful contract is resolved during '
        + 'auto-derivation; build the call through StatefulContract (internal probe context missing).');
    }
    const { masterUtxo, stateInputUnlocker, dataNftUtxos, dataNftUnlockers } = probeCtx;
    // Front-region inputs (read-only data NFTs then blockhash oracles) sit between the data NFTs and the keccak
    // side-cars, shifting the side-car base. Positioning them (and their self-preserving recreations) lets the
    // probe reach the keccak call even when the contract also reads external state / blockhashes.
    const frontRegion = probeCtx.frontRegionInputs ?? [];
    const kSlots = abiFunction.blockLayout?.slots.filter((s) => s.kind === 'keccakSideCar') ?? [];
    const base = kSlots[0]?.offset ?? (1 + dataNftUtxos.length);
    const n = preimages.length;
    const batchCount = Math.ceil(n / 3);
    if (base !== 1 + dataNftUtxos.length + frontRegion.length) {
      throw new Error('keccak256 complex/nested-argument probe: the front-region inputs (external reads / '
        + 'blockhash oracles) do not fill the slots before the keccak side-car; cannot position the probe.');
    }
    const { CovenantTransactionBuilder } = await import('./CovenantTransactionBuilder.js');
    const vm = createVirtualMachineBch2026ForProvider(this.inner.provider);
    const lock = keccakComputeLockingBytecode(salt, true);
    // A hashed chunk-backed value (string/bytes state) is read from the trailing run before its side-car.
    const trailing = keccakProbeTrailingRun(
      abiFunction, stateInputUnlocker, base + batchCount, probeCtx.trailingReadInputs, probeCtx.firstDynamicReadInput,
    );
    let guard = 0;
    while (preimages.some((p) => p === null)) {
      if (guard++ > n) throw new Error('keccak256 stateful preimage extraction did not converge.');
      const probe = new CovenantTransactionBuilder({ provider: this.inner.provider });
      if (probeCtx.locktime) probe.setLocktime(probeCtx.locktime);
      probe.addInput(masterUtxo, trailing.unlocker);
      dataNftUtxos.forEach((u, i) => probe.addInput(u, dataNftUnlockers[i]));
      frontRegion.forEach((u) => probe.addInputs([u])); // unlockable form: u already carries its unlocker
      const recreates: Output[] = [];
      for (let batch = 0; batch < batchCount; batch++) {
        const batchPreimages = preimages.slice(batch * 3, batch * 3 + 3)
          .map((preimage) => preimage ?? new Uint8Array(0));
        const { unlocker, recreate } = buildKeccakComputeSidecar(
          batchPreimages, salt, scUtxos[batch], true,
        );
        probe.addInput(scUtxos[batch], unlocker);
        recreates.push(recreate);
      }
      probe.addInputs(trailing.inputs);
      probe.addOutput({
        to: stateInputUnlocker.generateLockingBytecode(), amount: masterUtxo.satoshis, token: masterUtxo.token,
      });
      dataNftUtxos.forEach((u, i) => probe.addOutput({
        to: dataNftUnlockers[i].generateLockingBytecode(), amount: u.satoshis, token: u.token,
      }));
      frontRegion.forEach((u) => probe.addOutput(this._frontRegionRecreate(u))); // self-preserving recreate
      for (const rec of recreates) probe.addOutput({ ...rec, to: lock });
      trailing.inputs.forEach((u) => probe.addOutput(this._frontRegionRecreate(u)));
      const transaction = probe.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(probe.inputs);
      const trace = vm.debug({ inputIndex: 0, sourceOutputs, transaction }) as unknown[];
      if (!learnKeccakPreimages(preimages, scanKeccakPreimageReads(trace, base, n, batchCount))) {
        // Nothing new to learn: the unreached calls keep the empty placeholder, so the transaction reports the
        // contract's own failure (or succeeds when a short-circuit skips them).
        preimages.forEach((preimage, index) => { if (preimage === null) preimages[index] = new Uint8Array(0); });
      }
    }
  }

  // Self-preserving recreation of a front-region co-spend (read-only data NFT or blockhash oracle): same locking,
  // amount, token - unchanged. Mirrors the StatefulTransactionBuilder's readOnly/blockhash output construction.
  private _frontRegionRecreate(u: UnlockableUtxo): Output {
    return { to: u.unlocker.generateLockingBytecode(), amount: u.satoshis, token: u.token };
  }

  /**
   * Fill the fixed block slots between the data NFTs and the keccak-loop trailing region so the loop probe's
   * side-cars land at the compiler's `master + blockSize` coordinate. The read-only-data and blockhash slots are
   * already in `baseFrontRegion` (in slot order); satoshi/token containers add their real UTXO, and every other
   * slot (output-only transfer/event/returnEvent slots, or a container the build has not resolved) gets a neutral
   * self-preserving funder. All of these families are checked in the epilogue AFTER the keccak loop, so the
   * self-preserving funder recreations never block preimage discovery.
   */
  private _padKeccakLoopFrontRegion(
    abiFunction: AbiFunction,
    dataNftCount: number,
    sidecarBase: number,
    baseFrontRegion: UnlockableUtxo[],
    satoshiContainerUtxo: UnlockableUtxo | undefined,
    tokenContainers: readonly { utxo?: UnlockableUtxo }[],
    blockInfoCoSpendUtxos: readonly UnlockableUtxo[],
  ): UnlockableUtxo[] {
    const result = [...baseFrontRegion];
    let syntheticSeq = 0;
    const syntheticFunder = (): UnlockableUtxo => {
      syntheticSeq += 1;
      const lock = Uint8Array.of(0x51); // OP_TRUE
      return {
        txid: `${'00'.repeat(28)}${syntheticSeq.toString(16).padStart(8, '0')}`,
        vout: 0,
        satoshis: 1000n,
        unlocker: {
          generateLockingBytecode: () => lock,
          generateUnlockingBytecode: () => new Uint8Array(),
        },
      };
    };
    let tokenContainerCursor = 0;
    const slots = abiFunction.blockLayout?.slots ?? [];
    for (const slot of slots) {
      if (slot.offset < 1 + dataNftCount || slot.offset >= sidecarBase) continue;
      switch (slot.kind) {
        case 'readOnlyDataNft':
        case 'blockhashOracle':
          break; // already packed into baseFrontRegion in slot order
        case 'blockInfoOracle':
          result.push(blockInfoCoSpendUtxos[0] ?? syntheticFunder());
          break;
        case 'satoshiContainer':
          result.push(satoshiContainerUtxo ?? syntheticFunder());
          break;
        case 'tokenContainer': {
          const info = tokenContainers[tokenContainerCursor];
          tokenContainerCursor += 1;
          result.push(info?.utxo ?? syntheticFunder());
          break;
        }
        default:
          result.push(syntheticFunder());
          break;
      }
    }
    return result;
  }

  // Stateful DYNAMIC keccak loop: determine the runtime iteration count N and each iteration's preimage by a
  // PROGRESSIVE VM probe, then build N trailing compute side-cars. Each probe co-spends k trailing side-cars
  // (the first k-1 resolved, the k-th a placeholder) at [blockSize, blockSize+k) and reads the master; the loop
  // aborts at the FIRST placeholder bind, whose preimage `extractKeccakPreimageFromTrace(base=blockSize)` yields.
  // Resolve one iteration per probe until the loop exits (the k-th placeholder is never read -> the last in-range
  // read is an already-resolved index) => N reached. MVP: no fixed front-region slots before the trailing region
  // (blockSize == 1 + dataNftCount) and no other trailing users (entries/containers/transfers).
  private async _resolveStatefulKeccakLoop(
    abiFunction: AbiFunction, masterUtxo: Utxo, stateInputUnlocker: Unlocker,
    dataNftUtxos: Utxo[], dataNftUnlockers: Unlocker[],
    frontRegionInputs: UnlockableUtxo[] = [], locktime = 0,
    trailingPredecessors: { inputs: UnlockableUtxo[]; outputs: Output[] } = { inputs: [], outputs: [] },
  ): Promise<{ sideCars: UnlockableUtxo[]; recreates: Output[] }> {
    return resolveStatefulKeccakLoopImpl(
      {
        categoryId: this.categoryId,
        inner: this.inner as any,
        frontRegionRecreate: (u: UnlockableUtxo) => this._frontRegionRecreate(u),
        createVirtualMachine: (provider: any) => createVirtualMachineBch2026ForProvider(provider),
        generateLibauthSourceOutputs: (inputs: any) => generateLibauthSourceOutputs(inputs),
      },
      abiFunction, masterUtxo, stateInputUnlocker, dataNftUtxos, dataNftUnlockers,
      frontRegionInputs, locktime, trailingPredecessors,
    );
  }

  // keccak256 compute side-cars for a CO-SPENT EXTERNAL contract B (transitive): both externalCall and
  // externalOutState run B's function, which reads a keccakSideCar slot in B's OWN block, so B's branded
  // side-car must be co-spent + recreated inside B's block. Mirrors _resolveKeccakComputeCoSpends but for B
  // (shared salt=0; direct-param preimages from the group's args, complex/nested via an isolated probe of B).
  // Returns B's side-car inputs (in keccak call order) + their recreations.
  private async _resolveExternalKeccakSideCars(
    bAbiFunc: AbiFunction | undefined, args: any[], externalCategoryId: string,
    bContract?: StatefulContract | null,
  ): Promise<{ inputs: UnlockableUtxo[]; recreates: Output[] }> {
    return resolveExternalKeccakSideCarsImpl(
      {
        provider: this.inner.provider,
        externalKeccakProbeCtx: (...a: any[]) => (this as any)._externalKeccakProbeCtx(...a),
        extractStatefulKeccakPreimages: (...a: any[]) => (this as any)._extractStatefulKeccakPreimages(...a),
      },
      bAbiFunc, args, externalCategoryId, bContract,
    );
  }

  // Build a probe context for the callee B: B's master (unlocked with B's function args) + ALL of B's data NFTs
  // (so B's keccakSideCar slot base = 1 + dataNftCount matches its block layout). Used to extract B's complex
  // keccak preimages by evaluating B in an isolated mini-tx (like the direct stateful complex path, but on B).
  private async _externalKeccakProbeCtx(
    bContract: StatefulContract, bAbiFunc: AbiFunction, args: any[], externalCategoryId: string,
  ): Promise<{
      masterUtxo: Utxo; stateInputUnlocker: Unlocker; dataNftUtxos: Utxo[]; dataNftUnlockers: Unlocker[];
      frontRegionInputs?: UnlockableUtxo[]; locktime?: number;
    }> {
    const bState = await bContract.getFullState();
    if (!bState.masterUtxo) throw new Error(`External contract master UTXO not found (category ${externalCategoryId}).`);
    const unlockFns = bContract.inner.unlock as Record<string, (...a: any[]) => Unlocker>;
    const dataNftUtxos = bState.dataNftUtxos;
    const dataNftUnlockers = dataNftUtxos.map(() => createDataNftUnlocker(bContract.inner, 0, externalCategoryId));
    // B's own blockhash oracle slots sit between B's data NFTs and B's keccak side-cars. The probe mini-tx keeps
    // B's master at input 0, so materialize B's __internal__blockhashInputIndex = slot offset before building the
    // unlocker (the base Contract resolver refuses it), then co-spend the oracles + their locktime.
    const bhSlot = bAbiFunc.blockLayout?.slots.find((slot) => slot.kind === 'blockhashOracle');
    const probeArgs = (bAbiFunc.blockhashReads?.length ?? 0) > 0 && bhSlot !== undefined
      && bAbiFunc.inputs.some((input) => input.name === '__internal__blockhashInputIndex')
      ? materializeInternalFunctionArgument(
        args ?? [], bAbiFunc.inputs, '__internal__blockhashInputIndex', BigInt(bhSlot.offset),
      )
      : [...(args ?? [])];
    const stateInputUnlocker = unlockFns[bAbiFunc.name]?.(...probeArgs);
    if (!stateInputUnlocker) throw new Error(`Cannot build an unlocker for external function ${bAbiFunc.name}.`);
    const frontRegionInputs: UnlockableUtxo[] = [];
    let locktime = 0;
    const bhSlots = bAbiFunc.blockLayout?.slots.filter((slot) => slot.kind === 'blockhashOracle') ?? [];
    if ((bAbiFunc.blockhashReads?.length ?? 0) > 0 && bhSlots.length > 0) {
      const resolved = await resolveBlockhashCoSpendsImpl(
        { categoryId: externalCategoryId, inner: bContract.inner as any },
        bAbiFunc, args, bhSlots[0].offset, bhSlots.length,
        bState.masterUtxo, stateInputUnlocker, dataNftUtxos,
      );
      frontRegionInputs.push(...resolved.map((coSpend) => ({ ...coSpend.utxo, unlocker: coSpend.unlocker })));
      locktime = resolved.reduce((max, coSpend) => Math.max(max, coSpend.locktime), 0);
    }
    return {
      masterUtxo: bState.masterUtxo, stateInputUnlocker, dataNftUtxos, dataNftUnlockers,
      ...(frontRegionInputs.length > 0 && { frontRegionInputs }),
      ...(locktime > 0 && { locktime }),
    };
  }

  // Resolve B's blockhash(n) oracle co-spends for a transitive external outState read (B's function reads
  // blockhash). Mirrors _resolveBlockhashCoSpends but against B's category and with B's master/data NFT state,
  // so B's outState probe can satisfy `require(blockhash(bn) == bh)` at B's blockhashOracle slot.
  private async _resolveExternalBlockhashCoSpends(
    bAbiFunc: AbiFunction | undefined, args: any[], externalCategoryId: string,
    bContract?: StatefulContract | null,
  ): Promise<{ inputs: UnlockableUtxo[]; recreates: Output[]; locktime: number }> {
    if (!bAbiFunc || (bAbiFunc.blockhashReads?.length ?? 0) === 0 || !externalCategoryId) {
      return { inputs: [], recreates: [], locktime: 0 };
    }
    if (!bContract) {
      throw new Error('transitive blockhash(n) read needs the external contract instance; '
        + 'call through withExternalCall().');
    }
    const bState = await bContract.getFullState();
    if (!bState.masterUtxo) throw new Error(`External contract master UTXO not found (category ${externalCategoryId}).`);
    const unlockFns = bContract.inner.unlock as Record<string, (...a: any[]) => Unlocker>;
    const dataNftUtxos = bState.dataNftUtxos;
    const bhSlots = bAbiFunc.blockLayout?.slots.filter((slot) => slot.kind === 'blockhashOracle') ?? [];
    const bhSlot = bhSlots[0];
    // Materialize B's __internal__blockhashInputIndex (the base Contract resolver refuses it), then resolve
    // each oracle in slot order. Param reads use B's call args; computed reads probe B with its own state.
    const probeArgs = bhSlot !== undefined
      && bAbiFunc.inputs.some((input) => input.name === '__internal__blockhashInputIndex')
      ? materializeInternalFunctionArgument(
        args ?? [], bAbiFunc.inputs, '__internal__blockhashInputIndex', BigInt(bhSlot.offset),
      )
      : [...(args ?? [])];
    const stateInputUnlocker = unlockFns[bAbiFunc.name]?.(...probeArgs);
    if (!stateInputUnlocker) throw new Error(`Cannot build an unlocker for external function ${bAbiFunc.name}.`);
    const resolved = await resolveBlockhashCoSpendsImpl(
      { categoryId: externalCategoryId, inner: bContract.inner as any },
      bAbiFunc, args, bhSlot?.offset ?? 0, bhSlots.length,
      bState.masterUtxo, stateInputUnlocker, dataNftUtxos,
    );
    return {
      inputs: resolved.map((coSpend) => ({ ...coSpend.utxo, unlocker: coSpend.unlocker })),
      recreates: resolved.map((coSpend) => coSpend.recreate),
      locktime: resolved.reduce((max, coSpend) => Math.max(max, coSpend.locktime), 0),
    };
  }

  // Absolute input index of the first blockhashOracle slot + the slot count (master is input 0, so the slot
  // offset is already absolute). Used to fill __internal__blockhashInputIndex and bound the trace extraction.
  private blockhashSlotBase(abiFunction?: AbiFunction): { base: number; count: number } {
    const slots = abiFunction?.blockLayout?.slots.filter((s) => s.kind === 'blockhashOracle') ?? [];
    return { base: slots.length > 0 ? slots[0].offset : 0, count: slots.length };
  }

  private async _deriveCommitments(
    functionName: string,
    args: any[],
    requiredNftIndices: readonly number[],
    extraOutputs?: Array<{ to: string | Uint8Array; amount: bigint; token?: any }>,
    extraInputs?: Array<{ utxo: Utxo; unlocker: Unlocker }>,
    entryOutputCount: number = 0,
    childDataNftCount: number = 0,
    deriveChildCommitments: boolean = false,
    returnEventOutputCount: number = 0,
    containerOutputCount: number = 0,
    trailingEntryOutputCount: number = 0,
    trailingEntryOutputOffset?: number,
    probeState?: Record<string, StateValue>,
    eventOutputCount: number = 0,
  ): Promise<{
      state: Record<string, StateValueType> | undefined;
      entryCommitments: string[];
      childCommitments: string[];
      returnBlob?: Uint8Array;
      keccakCoSpends?: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; commitment: Uint8Array }>;
      eventCommitments?: string[];
    }> {
    return deriveCommitmentsImpl(
      {
        inner: this.inner,
        categoryId: this.categoryId,
        blockhashSlotBase: (...a: any[]) => (this as any)._blockhashSlotBase(...a),
        getFullState: () => this.getFullState(),
        resolveBlockhashCoSpends: (...a: any[]) => (this as any)._resolveBlockhashCoSpends(...a),
        resolveKeccakComputeCoSpends: (...a: any[]) => (this as any)._resolveKeccakComputeCoSpends(...a),
        resolveEcrecoverComputeCoSpends: (...a: any[]) => (this as any)._resolveEcrecoverComputeCoSpends(...a),
      },
      functionName, args, requiredNftIndices, extraOutputs, extraInputs,
      entryOutputCount, childDataNftCount, deriveChildCommitments, returnEventOutputCount,
      containerOutputCount, trailingEntryOutputCount, trailingEntryOutputOffset, probeState,
      eventOutputCount,
    );
  }

  /**
   * Refresh final post-write views from the state outputs already derived for their shared participant.
   *
   * The overlay is a normal NetworkProvider view of those outputs, so return derivation follows the callee's
   * ordinary ABI/VM path. It deliberately handles only compiler-proven read-only, single-return functions whose
   * non-chunked collection dependencies have no later writer; intermediate-state reads require an atomic route.
   */
  private async _refreshProjectedExternalReturns(
    stb: StatefulTransactionBuilder,
    groups: readonly ExternalCallUtxoGroup[],
  ): Promise<void> {
    return refreshProjectedExternalReturnsImpl(stb, groups);
  }

  /**
   * Derive full cross-contract transaction state via iterative VM evaluation.
   *
   * Phase 1: For each external call group, build a probe transaction and run
   * the VM on B's master input to extract B's expected commitments and return blob.
   *
   * Phase 2: With B's state and return events applied, build a second probe
   * and run the VM on A's master input to extract A's expected commitments.
   */
  private async _deriveFullTransactionState(
    stb: StatefulTransactionBuilder,
    requiredNftIndices: readonly number[],
    externalCallUtxoGroups: ExternalCallUtxoGroup[],
    externalCalls: readonly { hasReturnValues?: boolean; requiredDataNftIndices: number[] }[],
    entryAccesses?: readonly EntryAccessAbi[],
    emitInfos?: readonly EmitAbi[],
    eventBlockLayout?: FunctionBlockLayout,
    transferCount?: number,
    tokenContainerTransferOps?: Array<{
      type: 'transfer' | 'transferNft'; categoryId: string; outputSlot?: number;
    }>,
    delegatecallInputIndex?: number,
    externalOutStateUtxoGroups?: ExternalCallUtxoGroup[],
    debugTargetDerivation = false,
    currentStateSnapshot?: Readonly<Record<string, StateValueType>>,
    skipExternalStateDerivation = false,
  ): Promise<{
      state: Record<string, StateValueType> | undefined;
      vmErrored: boolean;
      derivationError?: Error;
      derivedTransfers?: Array<{ lockingBytecode: Uint8Array; amount: bigint }>;
      derivedTokenContainerTransfers?: Array<{
        categoryId: string; lockingBytecode: Uint8Array; amount: bigint;
      }>;
      derivedTokenContainerTransferNfts?: Array<{
        categoryId: string; lockingBytecode: Uint8Array; commitment: Uint8Array; capability: string;
      }>;
    }> {
    const stateLayout = this.inner.stateLayout!;
    const {
      persistWidthAtEntry,
    } = prepareDeriveFullValueChunkWritesImpl(stb);

    // Atomic participant extraction evaluates a compiler-routed delegate in a transaction-local coordinate
    // system before embedding that participant in the final graph. Temporarily rebase proxy identity witnesses.
    const {
      probeDelegate, restoreProbeWitnesses,
    } = rebaseDeriveFullProbeDelegateWitnessesImpl(stb, delegatecallInputIndex, debugTargetDerivation);
    try {
      // Wrap the entire derivation body so any error becomes AutoDerivationError.
      // This cleanly separates derivation failures from programming bugs.
      try {

        // Pre-populate placeholder return event outputs so the probe transaction has
        // the correct output count during Phase 1. B's covenant script verifies the
        // return event commitment at a specific output index - without a placeholder,
        // the output doesn't exist and OP_OUTPUTTOKENCOMMITMENT returns empty bytes,
        // causing OP_SPLIT to fail on empty data.
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_RETURN_SNAPSHOT === '1') {
          console.error('external-group-requirements', externalCallUtxoGroups.map((group, index) => ({
            index,
            functionName: group.functionName,
            required: group.requiredDataNftIndices,
            dataNfts: group.dataNftUtxos.length,
            routeRows: group.compilerRoute?.rowArguments?.map((row) => ({
              selector: row.selector, handler: row.handler.name, required: row.handler.requiredNftIndices,
            })),
            precomputed: group.precomputedReturnCommitment
              ? binToHex(group.precomputedReturnCommitment) : undefined,
          })));
        }
        if (debugTargetDerivation) console.error('derive-setup-seed-returns-start');
        stb.seedPrecomputedReturnEvents(externalCalls);
        if (debugTargetDerivation) console.error('derive-setup-seed-returns-complete');
        // Output construction is the authoritative source of physical return positions. Reconcile only after
        // derivation has finished its normal builds: refreshing earlier would require an additional build pass,
        // and output construction also advances convergence handles used by dynamic storage probes.
        const reconcileReturnWitnesses = (): void => {
          reconcileDeriveFullReturnWitnessesImpl(stb, externalCallUtxoGroups);
        };

        const rebindExternalResourceMaster = (
          group: ExternalCallUtxoGroup, entryMasterIdx: number,
        ): boolean => rebindDeriveFullExternalResourceMasterImpl(stb, group, entryMasterIdx);

        if (skipExternalStateDerivation) {
          let rebound = false;
          for (const group of externalCallUtxoGroups) {
            if (group.sharedGroupIndex !== undefined) continue;
            rebound = rebindExternalResourceMaster(
              group, stb.findMintingInputIndex(group.categoryId),
            ) || rebound;
          }
          if (rebound) stb._refreshInputs();
        }

        // A structural-layout restart deliberately skips the expensive external-state derivation below, but it
        // still creates a fresh transaction builder. Recreate every planned cold-insert placeholder on that fresh
        // builder so the restarted transaction retains the same authenticated resource shape.
        for (const group of externalCallUtxoGroups) {
          if (!group.plannedEntryInserts?.length || group.sharedGroupIndex !== undefined) continue;
          group.plannedEntryInsertHandles = group.plannedEntryInserts.map((insert) => {
            const input = group.blockInputs?.[insert.blockSlot];
            if (!input) {
              // The plan addresses a block offset the carrier does not have, which means the writer's block shape
              // never replaced the narrower block an earlier callsite contributed for the same callee master.
              throw new Error(
                `Planned sorted-batch insert for entry slot ${String(insert.slotIndex ?? '?')} names block offset `
                + `${String(insert.blockSlot)}, but `
                + `${group.logicalFunctionName ?? group.functionName ?? 'participant'} has `
                + `${String(group.blockInputs?.length ?? 0)} block inputs `
                + `(${(group.blockLayout?.slots ?? []).map((slot) => `${slot.kind}@${slot.offset}`).join(', ')}).`,
              );
            }
            return stb.addExternalCallEntryInsert(
              group.categoryId,
              input.unlocker.generateLockingBytecode(),
              insert.commitment ?? '00',
            );
          });
        }

        // Phase 1: Derive each B's state + return blob
        // Process groups in reverse order so that transitive dependencies (e.g., C in
        // A->B->C chains) are resolved before their callers (B). Transitive groups are
        // appended after direct groups, so reverse order naturally resolves leaf
        // dependencies first, making their return event commitments available when
        // their parent groups are processed.
        // A structural-layout restart reuses this same STB after Phase 1 has already authenticated and cached
        // every external participant's state, entries, returns, and events. The restart exists to re-run the root
        // phase with refreshed absolute witnesses; serializing the multi-megabyte composed transaction once per
        // external group again is redundant. Final transaction verification still executes every input, so stale
        // external material cannot pass unnoticed.
        const firstPhase1Group = skipExternalStateDerivation ? -1 : externalCallUtxoGroups.length - 1;
        for (let groupIdx = firstPhase1Group; groupIdx >= 0; groupIdx--) {
          const group = externalCallUtxoGroups[groupIdx];
          const ec = externalCalls[groupIdx];
          if (group.sharedGroupIndex !== undefined) continue;
          // Lifted emits execute before the route's final data-NFT settlement. Fill their probe records first
          // so Phase 1 can reach and authenticate the callee's final state commitment.
          await deriveNestedStreamedEvents(this.inner.provider, stb, group, groupIdx);
          const phase1Front = deriveFullPhase1GroupFrontImpl(
            {
              categoryId: this.categoryId,
              inner: this.inner as any,
              rebindExternalResourceMaster: (g, i) => rebindExternalResourceMaster(g, i),
            },
            stb, externalCallUtxoGroups, groupIdx, debugTargetDerivation,
          );
          let probeBuilder = phase1Front.probeBuilder;
          const transaction = phase1Front.transaction;
          let fullTrace = phase1Front.fullTrace;
          const bMasterIdx = phase1Front.bMasterIdx;
          const valueChunkWitness = phase1Front.valueChunkWitness;

          const phase1PostEval = deriveFullPhase1PostEvaluateDataCommitmentsImpl(
            { inner: this.inner as any },
            stb, group, groupIdx, probeBuilder, fullTrace, bMasterIdx, ec?.hasReturnValues,
          );
          fullTrace = phase1PostEval.fullTrace;
          const bOutputBase = phase1PostEval.bOutputBase;
          if (phase1PostEval.skipGroup) continue;

          deriveFullPhase1ProgressiveEntriesImpl(
            { inner: this.inner as any },
            stb, group, groupIdx, bOutputBase, fullTrace, transaction, bMasterIdx,
            valueChunkWitness, debugTargetDerivation,
          );

          await deriveNestedStreamedEvents(this.inner.provider, stb, group, groupIdx);
          deriveFullPhase1ReturnAndEventsImpl(
            { inner: this.inner as any },
            stb, externalCallUtxoGroups, group, groupIdx, externalCalls, ec?.hasReturnValues,
            bOutputBase, bMasterIdx,
          );
        }

        // Shared read/write participants use one physical state transition. Once that transition has converged,
        // replace any final dependent view's pre-state placeholder with a return derived from the projected UTXOs.
        if (debugTargetDerivation) console.error('derive-projected-returns-start');
        await this._refreshProjectedExternalReturns(stb, externalCallUtxoGroups);
        if (debugTargetDerivation) console.error('derive-projected-returns-complete');

        deriveFullPhase1bOutStateAndLowLevelImpl(
          { inner: this.inner as any },
          stb, externalOutStateUtxoGroups, debugTargetDerivation,
        );


        const {
          dummyLbc, satoshiTransferCount, ftOps, nftOps,
        } = seedDeriveFullPhase2PlaceholdersImpl(
          stb, emitInfos, transferCount, tokenContainerTransferOps,
        );

        // Track derived transfers for return
        let derivedTransfers: Array<{ lockingBytecode: Uint8Array; amount: bigint }> | undefined;
        let derivedFtTransfers: Array<{
          categoryId: string; lockingBytecode: Uint8Array; amount: bigint;
        }> | undefined;
        let derivedNftTransfers: Array<{
          categoryId: string; lockingBytecode: Uint8Array; commitment: Uint8Array; capability: string;
        }> | undefined;
        // Track whether amounts were successfully extracted from the VM trace
        // (avoids false positives when real transfer amounts happen to match placeholder values)
        let satoshiAmountsFullyDerived = false;
        let ftAmountsFullyDerived = false;
        const runtimeLoopTransferBytecodesDerived = Array.from(
          { length: stb.getRuntimeLoopTransferOutputs().length }, () => false,
        );
        const runtimeLoopTransferAmountsDerived = stb.getRuntimeLoopTransferOutputs()
          .map((output) => output.kind === 'nft');
        const runtimeLoopTransferCommitmentsDerived = stb.getRuntimeLoopTransferOutputs()
          .map((output) => output.kind !== 'nft');
        const runtimeLoopTransferCapabilitiesDerived = stb.getRuntimeLoopTransferOutputs()
          .map((output) => output.kind !== 'nft');

        const phase2Host = this;
        const phase2Prelude = prepareDeriveFullPhase2LoopImpl(
          {
            inner: phase2Host.inner as any,
            maxDerivationIterations: phase2Host.maxDerivationIterations,
            get lastDerivationIterations() { return phase2Host.lastDerivationIterations; },
            set lastDerivationIterations(v: number) { phase2Host.lastDerivationIterations = v; },
          },
          stb,
          {
            entryAccessesLength: entryAccesses?.length ?? 0,
            emitInfosLength: emitInfos?.length ?? 0,
            requiredNftIndicesLength: requiredNftIndices.length,
            persistWidthAtEntry,
            debugTargetDerivation,
            dummyLbc,
            delegatecallInputIndex,
          },
        );
        const {
          entryCount, eventCount, stateCount, maxIterations, configuredDebugIterations,
          debugTargetsThisDerivation, persistWidth,
          retainDiagnosticTrace, fingerprintLockingBytecode, lockingBytecodeFingerprintCache,
        } = phase2Prelude;
        let {
          derivedAState, prevConvergenceKey, derivedStateCount, lastTrace, lastFailProbeOutputs,
          previousProbeFingerprint, skipNestedAfterPass,
        } = phase2Prelude.loopState;
        const { seenConvergenceKeys, probedSortedLoop } = phase2Prelude.loopState;

	        for (let iter = 0; iter < maxIterations; iter++) {
	          const debugIterationStartedAt = debugTargetsThisDerivation ? Date.now() : 0;
          let phase2ParamSnap: ReturnType<typeof stb.snapshotBuilderReturnOutputParams> | undefined;
          let phase2Insertion: ReturnType<typeof stb.insertBeforeLateValueSuffix> | undefined;
          let probeBuilder2!: ReturnType<typeof stb.build>;
          try {
            const phase2IterProbe = deriveFullPhase2IterationProbeImpl(
              {
                inner: this.inner as any,
                get lastDerivationIterations() { return phase2Host.lastDerivationIterations; },
                set lastDerivationIterations(v: number) { phase2Host.lastDerivationIterations = v; },
              },
              stb,
              {
                iter,
                dummyLbc,
                delegatecallInputIndex,
                debugTargetsThisDerivation,
                previousProbeFingerprint,
                lockingBytecodeFingerprintCache,
                fingerprintLockingBytecode,
                retainDiagnosticTrace,
                debugIterationStartedAt,
              },
            );
            phase2ParamSnap = phase2IterProbe.phase2ParamSnap;
            phase2Insertion = phase2IterProbe.phase2Insertion;
            probeBuilder2 = phase2IterProbe.probeBuilder2;
            previousProbeFingerprint = phase2IterProbe.previousProbeFingerprint;
            if (phase2IterProbe.fixedPoint) break;
            const transaction2 = phase2IterProbe.transaction2!;
            const sourceOutputs2 = phase2IterProbe.sourceOutputs2!;
            const fullTrace2 = phase2IterProbe.fullTrace2!;
            const faithfulProbeHadError = phase2IterProbe.faithfulProbeHadError!;
            lastTrace = phase2IterProbe.lastTrace;
            if (phase2IterProbe.lastFailProbeOutputs !== undefined) {
              lastFailProbeOutputs = phase2IterProbe.lastFailProbeOutputs;
            }
            const debugIterationBuiltAt = phase2IterProbe.debugIterationBuiltAt ?? Date.now();

            // Extract commitments using output-index filtering to avoid capturing
            // container identity checks, minting NFT uniqueness, or other non-commitment patterns.
            let commitmentProgress = 0;
            let nestedPinProgress = 0;
            let nestedProbeHadError = false;

            // A delegate implementation's complex keccak expression can depend on proxy state and authenticated
            // nested returns, so only this complete transaction can evaluate it. Learn one runtime-reached preimage
            // per probe; rebuilding the ordinary side-car advances execution to the next nested/outer hash.
            if (stb.resolveDeferredKeccakPreimage(fullTrace2)) commitmentProgress += 1;
            if (stb.resolveDeferredEcrecoverArgument(fullTrace2)) commitmentProgress += 1;

            // Nested delegate implementations can pin computed value chunks at implementation-relative outputs.
            // Phase 2 traces the root implementation, so recover those pins from each nested implementation input.
            for (const [llcIndex, llc] of stb.getLowLevelCallUtxoGroups().entries()) {
              const nestedValueChunkPin = applyDeriveFullNestedValueChunkPinImpl(
                {
                  categoryId: this.categoryId,
                  inner: this.inner,
                },
                {
                  stb,
                  probeBuilder2,
                  sourceOutputs2,
                  transaction2,
                  llc,
                  llcIndex,
                  delegatecallInputIndex,
                  skipNestedAfterPass,
                  debugTargetsThisDerivation,
                  iter,
                },
              );
              if (nestedValueChunkPin.skipped) continue;
              commitmentProgress += nestedValueChunkPin.commitmentProgressDelta;
              nestedPinProgress += nestedValueChunkPin.nestedPinProgressDelta;
              nestedProbeHadError ||= nestedValueChunkPin.nestedProbeHadError;
              const {
                nestedTrace,
                implInputIndex,
                proxyGroup,
                nestedOutputBase,
                chunkCategory,
                valueChunkWrites,
                band,
                allChunks,
                fallbackBase,
                pin,
              } = nestedValueChunkPin;
              // nested-value-chunk-pin-iteration (size-guarded; entry-NFT remainder follows)
              const nestedEntryPins = applyDeriveFullNestedEntryPinsImpl(
                {
                  categoryId: this.categoryId,
                  inner: this.inner,
                },
                {
                  stb,
                  probeBuilder2,
                  llc,
                  nestedTrace,
                  implInputIndex,
                  proxyGroup,
                  chunkCategory,
                  valueChunkWrites,
                  band,
                  allChunks,
                  fallbackBase,
                  pin,
                },
              );
              commitmentProgress += nestedEntryPins.commitmentProgressDelta;
              nestedPinProgress += nestedEntryPins.nestedPinProgressDelta;
              // nested-entry-pins-complete (size-guarded; commits/event pinning follows)

              const nestedCommitsEventPins = applyDeriveFullNestedCommitsEventPinsImpl({
                stb,
                probeBuilder2,
                llc,
                nestedTrace,
                nestedOutputBase,
                implInputIndex,
                proxyGroup,
                chunkCategory,
                valueChunkWrites,
                band,
                allChunks,
                pin,
              });
              commitmentProgress += nestedCommitsEventPins.commitmentProgressDelta;
              nestedPinProgress += nestedCommitsEventPins.nestedPinProgressDelta;
              // nested-commits-event-pins-complete (size-guarded end of nested LLC iteration)


            }
            if (debugTargetsThisDerivation) console.error('derive-phase2-nested-complete', {
              iter, elapsedMs: Date.now() - debugIterationBuiltAt,
            });

            if (debugTargetsThisDerivation) console.error('derive-phase2-nested-complete', {
              iter, elapsedMs: Date.now() - debugIterationBuiltAt,
            });
            let phaseCheckpointAt = debugTargetsThisDerivation ? Date.now() : 0;
            const phaseCheckpoint = (stage: string): void => {
              if (!debugTargetsThisDerivation) return;
              const now = Date.now();
              console.error('derive-phase2-postprocess', { iter, stage, ms: now - phaseCheckpointAt });
              phaseCheckpointAt = now;
            };
            if (!nestedProbeHadError && persistWidth > 0) skipNestedAfterPass = true;

            let latestEntryCommits: string[] = [];
            let latestEventCommits: string[] = [];
            let latestLoopEntryCommits: string[] = [];
            let stateCommits: string[] = [];
            {
              const applied = deriveFullPhase2ApplyStateAndEntriesImpl(
                { categoryId: this.categoryId },
                stb,
                {
                  probeBuilder2,
                  fullTrace2,
                  commitmentProgress,
                  derivedAState,
                  derivedStateCount,
                  stateCount,
                  entryCount,
                  stateLayout,
                  requiredNftIndices,
                  entryAccesses,
                  delegatecallInputIndex,
                  phaseCheckpoint,
                },
              );
              commitmentProgress = applied.commitmentProgress;
              derivedAState = applied.derivedAState;
              derivedStateCount = applied.derivedStateCount;
              stateCommits = applied.stateCommits;
              latestEntryCommits = applied.latestEntryCommits;
              latestEventCommits = applied.latestEventCommits;
              latestLoopEntryCommits = applied.latestLoopEntryCommits;
            }

            let chunkVars = stb.getDynamicChunkVars();
            let getPhysicalChunkOutputBase = (): number => stb.getChunkOutputBase();
            {
              const appliedDyn = deriveFullPhase2ApplyDynamicChunksImpl(
                {
                  categoryId: this.categoryId,
                  inner: this.inner as any,
                },
                stb,
                {
                  probeBuilder2,
                  fullTrace2,
                  commitmentProgress,
                  derivedAState,
                  stateLayout,
                  iter,
                  phaseCheckpoint,
                },
              );
              commitmentProgress = appliedDyn.commitmentProgress;
              derivedAState = appliedDyn.derivedAState;
              chunkVars = appliedDyn.chunkVars;
              getPhysicalChunkOutputBase = appliedDyn.getPhysicalChunkOutputBase;
            }

            {
              const appliedLoop = deriveFullPhase2ApplyLoopEntriesImpl(
                stb,
                {
                  probeBuilder2,
                  fullTrace2,
                  commitmentProgress,
                  latestLoopEntryCommits,
                  stateLayout,
                  probedSortedLoop,
                  delegatecallInputIndex,
                  iter,
                  phaseCheckpoint,
                },
              );
              commitmentProgress = appliedLoop.commitmentProgress;
              latestLoopEntryCommits = appliedLoop.latestLoopEntryCommits;
            }
            {
              const appliedRtLoop = deriveFullPhase2ApplyRuntimeLoopImpl(
                {
                  extractExpectedOutputCommitmentFromTrace,
                  parseNftCapability,
                  traceRuntimeEffectStreams: () => traceRuntimeEffectStreamRuns(this.inner.provider, {
                    inputIndex: delegatecallInputIndex ?? 0, sourceOutputs: sourceOutputs2, transaction: transaction2,
                  }),
                },
                stb,
                {
                  probeBuilder2,
                  fullTrace2,
                  commitmentProgress,
                  derivedFlags: {
                    bytecodesDerived: runtimeLoopTransferBytecodesDerived,
                    amountsDerived: runtimeLoopTransferAmountsDerived,
                    commitmentsDerived: runtimeLoopTransferCommitmentsDerived,
                    capabilitiesDerived: runtimeLoopTransferCapabilitiesDerived,
                  },
                  phaseCheckpoint,
                },
              );
              commitmentProgress = appliedRtLoop.commitmentProgress;
            }
            {
              const appliedValueChunks = deriveFullPhase2ApplyValueChunksImpl(
                {
                  categoryId: delegatecallInputIndex !== undefined
                    ? stb.rootCategoryId : this.categoryId,
                  inner: this.inner as any,
                  ...(delegatecallInputIndex !== undefined
                    ? { stateOwnerLock: stb.ownerMasterLock() } : {}),
                },
                stb,
                {
                  probeBuilder2,
                  fullTrace2,
                  commitmentProgress,
                  stateLayout,
                  delegatecallInputIndex,
                  iter,
                  phaseCheckpoint,
                },
              );
              commitmentProgress = appliedValueChunks.commitmentProgress;
            }
            {
              const appliedEvents = deriveFullPhase2ApplyDynamicRescanAndEventsImpl(
                { extractExpectedOutputCommitmentFromTrace },
                stb,
                {
                  fullTrace2,
                  commitmentProgress,
                  latestEventCommits,
                  chunkVars,
                  getPhysicalChunkOutputBase,
                  eventCount,
                  emitInfos,
                  eventBlockLayout,
                  probeBuilder2,
                  transaction2,
                  sourceOutputs2,
                  delegatecallInputIndex,
                  iter,
                  phaseCheckpoint,
                },
              );
              commitmentProgress = appliedEvents.commitmentProgress;
              latestEventCommits = appliedEvents.latestEventCommits;
            }
            {
              const appliedTransfers = deriveFullPhase2ApplyTransfersImpl(
                { parseNftCapability },
                stb,
                {
                  fullTrace2,
                  satoshiTransferCount,
                  ftOps,
                  nftOps,
                  dummyLbc,
                  delegatecallInputIndex,
                  derivedTransfers,
                  derivedFtTransfers,
                  derivedNftTransfers,
                  satoshiAmountsFullyDerived,
                  ftAmountsFullyDerived,
                  phaseCheckpoint,
                },
              );
              derivedTransfers = appliedTransfers.derivedTransfers;
              derivedFtTransfers = appliedTransfers.derivedFtTransfers;
              derivedNftTransfers = appliedTransfers.derivedNftTransfers;
              satoshiAmountsFullyDerived = appliedTransfers.satoshiAmountsFullyDerived;
              ftAmountsFullyDerived = appliedTransfers.ftAmountsFullyDerived;
            }
            const {
              convergenceKey,
              anyProbeHadError,
              needsPassingProbe,
            } = deriveFullPhase2ConvergenceImpl(
              stb,
              {
                commitmentProgress,
                derivedAState,
                chunkVars,
                derivedTransfers,
                derivedFtTransfers,
                derivedNftTransfers,
                stateCommits,
                latestEntryCommits,
                latestEventCommits,
                latestLoopEntryCommits,
                faithfulProbeHadError,
                nestedProbeHadError,
                nestedPinProgress,
                runtimeLoopTransferBytecodesDerived,
                runtimeLoopTransferAmountsDerived,
                runtimeLoopTransferCommitmentsDerived,
                runtimeLoopTransferCapabilitiesDerived,
                fullTrace2,
                iter,
                debugTargetsThisDerivation,
                debugIterationStartedAt,
                phaseCheckpoint,
              },
            );
            // A successful probe proves the builder's current commitments and output geometry satisfy the complete
            // covenant. Continuing can only revisit the same authenticated observations and falsely classify that
            // stable fixed point as an oscillation.
            // The root covenant can pass while a nested value-chunk writer still
            // lacks later value-chunk outputs (nNew>1). Keep probing until those pins settle.
            if (!anyProbeHadError && nestedPinProgress === 0) break;
            if (convergenceKey === prevConvergenceKey && (!needsPassingProbe || !anyProbeHadError)) break;
            if (seenConvergenceKeys.has(convergenceKey) && (!needsPassingProbe || !anyProbeHadError)) {
              throw new AutoDerivationError(
                'Auto-derivation oscillation detected: derivation state is cycling without converging. '
            + 'This may indicate conflicting covenant constraints.',
              );
            }
            seenConvergenceKeys.add(convergenceKey);
            prevConvergenceKey = convergenceKey;
          } finally {
            if (phase2ParamSnap) {
              stb.restoreBuilderReturnOutputParams(probeBuilder2, phase2ParamSnap, phase2Insertion);
            }
          }
        }
        {
          const cleaned = deriveFullPhase2CleanedRescanImpl(
            {
              categoryId: this.categoryId,
              inner: this.inner as any,
            },
            stb,
            {
              configuredDebugIterations,
              debugTargetsThisDerivation,
              dummyLbc,
              delegatecallInputIndex,
              lastTrace,
              lastFailProbeOutputs,
              retainDiagnosticTrace,
              emitInfos,
              eventBlockLayout,
            },
          );
          lastTrace = cleaned.lastTrace;
          lastFailProbeOutputs = cleaned.lastFailProbeOutputs;
        }

        const lastStep = lastTrace?.[lastTrace.length - 1];
        const vmHadError = !!(lastStep && (lastStep as any).error);
        const deriveDebugEnv = (globalThis as {
          process?: { env?: Record<string, string> };
        }).process?.env;
        if (vmHadError && deriveDebugEnv?.SOLIDC_DEBUG_DERIVE_FAIL_SUMMARY === '1') {
          const failInputs = stb.build().inputs;
          const executedInputIndex = delegatecallInputIndex ?? 0;
          const executedUnlocker = failInputs[executedInputIndex]?.unlocker as {
            abiFunction?: AbiFunction;
          } | undefined;
          console.error('derive-fail-summary', {
            ip: (lastStep as { ip?: number }).ip,
            executedInputIndex,
            executedFunction: executedUnlocker?.abiFunction?.name,
          });
        }
        if (vmHadError && (deriveDebugEnv?.SOLIDC_DEBUG_CHUNK_SCAN === '1'
          || deriveDebugEnv?.SOLIDC_DEBUG_DERIVE_FAIL === '1')) {
          const failIp = (lastStep as { ip?: number }).ip;
          const stack = (lastStep as { stack?: Uint8Array[] }).stack ?? [];
          const failingInstructions = (lastStep as {
            instructions?: Array<{ opcode?: number; data?: Uint8Array }>;
          }).instructions ?? [];
          const failOutputs = lastFailProbeOutputs ?? stb.build().outputs;
          const failInputs = stb.build().inputs;
          const rebuiltOutputs = stb.build().outputs;
          const executedInputIndex = delegatecallInputIndex ?? 0;
          const executedUnlocker = failInputs[executedInputIndex]?.unlocker as {
            params?: unknown[];
            abiFunction?: AbiFunction;
          } | undefined;
          const debugFunction = deriveDebugEnv?.SOLIDC_DEBUG_DERIVE_FAIL_FUNCTION;
          const debugMinIp = Number(deriveDebugEnv?.SOLIDC_DEBUG_DERIVE_FAIL_MIN_IP ?? 0);
          const recent = (lastTrace ?? []).slice(-16).map((step) => {
            const state = step as {
              ip?: number;
              instructions?: Array<{ opcode?: number; data?: Uint8Array }>;
              stack?: Uint8Array[];
            };
            const opcode = state.instructions?.[state.ip ?? -1]?.opcode;
            const data = state.instructions?.[state.ip ?? -1]?.data;
            return {
              ip: state.ip,
              op: opcode,
              data: data ? binToHex(data).slice(0, 24) : undefined,
              top: (state.stack ?? []).slice(-6).map((item) => {
                const hex = binToHex(item);
                return hex.length === 0 ? '∅' : hex.slice(0, 24);
              }),
            };
          });
          if (deriveDebugEnv?.SOLIDC_DEBUG_DERIVE_FAIL === '1'
            && (!debugFunction || executedUnlocker?.abiFunction?.name === debugFunction)
            && (failIp ?? 0) >= debugMinIp) console.error('derive-fail-last', {
            ip: failIp,
            error: (lastStep as { error?: unknown }).error,
            executedInputIndex,
            executedContract: (executedUnlocker as {
              contract?: { artifact?: { contractName?: string } };
            } | undefined)?.contract?.artifact?.contractName,
            executedFunction: executedUnlocker?.abiFunction?.name,
            executedTopologyArgs: executedUnlocker?.abiFunction?.inputs.flatMap((input, index) => (
              isSdkResolvedExternalCallTopologyWitness(input.name)
                ? [{ name: input.name, value: String(executedUnlocker.params?.[index]) }]
                : []
            )),
            failOutputsSource: lastFailProbeOutputs ? 'live-probe' : 'stb-rebuild',
            suffixOutputs: failOutputs.slice(-8).map((output, offset) => ({
              index: failOutputs.length - 8 + offset,
              lock: output?.to instanceof Uint8Array ? binToHex(output.to).slice(0, 24)
                : typeof output?.to === 'string' ? output.to.slice(0, 24) : String(output?.to ?? ''),
              cap: output?.token?.nft?.capability,
              commit: String(output?.token?.nft?.commitment ?? '').slice(0, 32),
            })),
            headOutputs: failOutputs.slice(0, 12).map((output, index) => ({
              index,
              lock: output?.to instanceof Uint8Array ? binToHex(output.to).slice(0, 24)
                : typeof output?.to === 'string' ? output.to.slice(0, 24) : String(output?.to ?? ''),
              cap: output?.token?.nft?.capability,
              commit: String(output?.token?.nft?.commitment ?? '').slice(0, 72),
              hasToken: !!output?.token,
            })),
            headInputs: failInputs.slice(0, 12).map((input, index) => ({
              index,
              lock: (() => {
                const unlocker = (input as { unlocker?: { generateLockingBytecode?: () => Uint8Array } })
                  .unlocker;
                const lock = unlocker?.generateLockingBytecode?.();
                return lock ? binToHex(lock).slice(0, 24) : undefined;
              })(),
              cap: input.token?.nft?.capability,
              commit: String(input.token?.nft?.commitment ?? '').slice(0, 72),
              hasToken: !!input.token,
            })),
            outputCount: failOutputs.length,
            // The identity-anchor witnesses are INPUT coordinates the covenant verifies in place, so the frame the
            // probe evaluated is only readable if each one is paired with what actually sits there.
            executedAnchorArgs: executedUnlocker?.abiFunction?.inputs.flatMap((input, index) => (
              /extcallAnchorIdx/i.test(input.name)
                ? [{
                  name: input.name,
                  value: String(executedUnlocker.params?.[index]),
                  inputAt: (() => {
                    const raw = executedUnlocker.params?.[index];
                    const at = typeof raw === 'bigint' ? Number(raw)
                      : typeof raw === 'number' ? raw
                        : typeof raw === 'string' && raw !== '' ? Number(raw) : -1;
                    if (at < 0 || at >= failInputs.length) return undefined;
                    const unlocker = (failInputs[at] as {
                      unlocker?: { generateLockingBytecode?: () => Uint8Array };
                    }).unlocker;
                    const lock = unlocker?.generateLockingBytecode?.();
                    return {
                      index: at,
                      lock: lock ? binToHex(lock).slice(0, 24) : undefined,
                      cap: failInputs[at]?.token?.nft?.capability,
                      commit: String(failInputs[at]?.token?.nft?.commitment ?? '').slice(0, 32),
                    };
                  })(),
                }]
                : []
            )),
            executedReturnOutputArgs: executedUnlocker?.abiFunction?.inputs.flatMap((input, index) => (
              /ReturnOutputIdx/i.test(input.name)
                ? [{
                  name: input.name,
                  value: String(executedUnlocker.params?.[index]),
                  commitAt: (() => {
                    const raw = executedUnlocker.params?.[index];
                    const outIdx = typeof raw === 'bigint' ? Number(raw)
                      : typeof raw === 'number' ? raw
                        : typeof raw === 'string' && raw !== '' ? Number(raw) : -1;
                    if (outIdx < 0 || outIdx >= failOutputs.length) return undefined;
                    return String(failOutputs[outIdx]?.token?.nft?.commitment ?? '');
                  })(),
                  rebuildCommitAt: (() => {
                    const raw = executedUnlocker.params?.[index];
                    const outIdx = typeof raw === 'bigint' ? Number(raw)
                      : typeof raw === 'number' ? raw
                        : typeof raw === 'string' && raw !== '' ? Number(raw) : -1;
                    if (outIdx < 0 || outIdx >= rebuiltOutputs.length) return undefined;
                    return String(rebuiltOutputs[outIdx]?.token?.nft?.commitment ?? '');
                  })(),
                }]
                : []
            )),
            stackLength: stack.length,
            stackTop: stack.slice(-8).map((item) => binToHex(item).slice(0, 40)),
            stackIndexed: stack.slice(-64).map((item, index) => ({
              depth: Math.min(63, stack.length - 1) - index,
              length: item.length,
              value: binToHex(item),
            })),
            instructionWindow: failingInstructions.slice(Math.max(0, (failIp ?? 0) - 32), (failIp ?? 0) + 2)
              .map((instruction, offset) => ({
                ip: Math.max(0, (failIp ?? 0) - 32) + offset,
                op: instruction.opcode,
                data: instruction.data ? binToHex(instruction.data) : undefined,
              })),
            recent,
            localWindow: (lastTrace ?? []).filter((step) => {
              const ip = (step as { ip?: number }).ip;
              return ip !== undefined && failIp !== undefined && Math.abs(ip - failIp) <= 16;
            }).map((step) => {
              const state = step as {
                ip?: number;
                instructions?: Array<{ opcode?: number; data?: Uint8Array }>;
                stack?: Uint8Array[];
              };
              const instruction = state.instructions?.[state.ip ?? -1];
              return {
                frame: state.instructions?.length,
                ip: state.ip,
                op: instruction?.opcode,
                data: instruction?.data ? binToHex(instruction.data) : undefined,
                stack: (state.stack ?? []).slice(-8).map((item) => `${item.length}:${binToHex(item)}`),
              };
            }),
            selectedWindow: (lastTrace ?? []).filter((step) => {
              const ip = (step as { ip?: number }).ip;
              const from = Number(deriveDebugEnv?.SOLIDC_DEBUG_DERIVE_TRACE_FROM_IP ?? Number.NaN);
              const to = Number(deriveDebugEnv?.SOLIDC_DEBUG_DERIVE_TRACE_TO_IP ?? Number.NaN);
              return ip !== undefined && Number.isFinite(from) && Number.isFinite(to) && ip >= from && ip <= to;
            }).map((step) => {
              const state = step as {
                ip?: number;
                instructions?: Array<{ opcode?: number; data?: Uint8Array }>;
                stack?: Uint8Array[];
              };
              const instruction = state.instructions?.[state.ip ?? -1];
              return {
                frame: state.instructions?.length,
                ip: state.ip,
                op: instruction?.opcode,
                data: instruction?.data ? binToHex(instruction.data) : undefined,
                stack: (state.stack ?? []).slice(-32).map((item) => `${item.length}:${binToHex(item)}`),
              };
            }),
            band: stb.getChunkableValueWriteBand(),
            groups: stb.getExternalCallUtxoGroups().map((group, index) => ({
              index,
              fn: group.logicalFunctionName ?? group.functionName,
              ret: group.returnOutputIndex,
              chunks: group.valueChunkOutputCount,
            })),
            around: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18, 20, 21, 22, 23, 24, 25, 26, 27,
              28, 29, 30, 31].map((index) => {
              const output = failOutputs[index];
              const input = failInputs[index] as {
                unlocker?: { generateLockingBytecode?: () => Uint8Array };
                token?: { category?: string; nft?: { capability?: string; commitment?: string } };
              } | undefined;
              return {
                index,
                inLock: input?.unlocker?.generateLockingBytecode
                  ? binToHex(input.unlocker.generateLockingBytecode()).slice(0, 20) : '',
                inCap: input?.token?.nft?.capability ?? (input ? 'plain' : 'missing'),
                inCat: String(input?.token?.category ?? '').slice(0, 8),
                lock: output
                  ? (output.to instanceof Uint8Array ? binToHex(output.to) : String(output.to)).slice(0, 20)
                  : '',
                cap: output?.token?.nft?.capability ?? (output ? 'plain' : 'missing'),
                cat: String(output?.token?.category ?? '').slice(0, 8),
                commit: String(output?.token?.nft?.commitment ?? '').slice(0, 20),
              };
            }),
            outputTail: failOutputs.slice(-12).map((output, offset) => ({
              i: failOutputs.length - 12 + offset,
              lock: (output.to instanceof Uint8Array ? binToHex(output.to) : String(output.to)).slice(0, 16),
              cap: output.token?.nft?.capability ?? '-',
              cat: output.token?.category?.slice(0, 8),
              commit: (() => {
                const raw = String(output.token?.nft?.commitment ?? '');
                const isViewPad = output.to instanceof Uint8Array
                  && output.to.length === 1 && output.to[0] === 0x51
                  && output.token?.nft?.capability === 'none';
                return isViewPad ? raw : raw.slice(0, 20);
              })(),
            })),
          });
        }
        const derivationError = vmHadError ? new Error((() => {
          const raw = (lastStep as { error?: unknown }).error;
          const detail = typeof raw === 'string' ? raw
            : raw && typeof raw === 'object' && 'error' in (raw as object)
              ? String((raw as { error: unknown }).error)
              : String(raw);
          const ip = (lastStep as { ip?: number }).ip;
          const opcode = (lastStep as { instructions?: Array<{ opcode?: number }> })
            .instructions?.[ip ?? -1]?.opcode;
          const executedInputIndex = delegatecallInputIndex ?? 0;
          const executedUnlocker = stb.build().inputs[executedInputIndex]?.unlocker as {
            abiFunction?: { name?: string; selector?: string };
            contract?: { artifact?: Artifact };
          } | undefined;
          const artifactCandidates = [
            executedUnlocker?.contract?.artifact,
            ...stb.getLowLevelCallUtxoGroups().map((group) => group.externalContract?.inner?.artifact as Artifact),
            ...stb.getExternalCallUtxoGroups().map((group) => group.externalContract?.inner?.artifact as Artifact),
            this.inner.artifact,
          ];
          const selector = executedUnlocker?.abiFunction?.selector
            ?? artifactCandidates.flatMap((artifact) => artifact?.abi ?? [])
              .find((fn) => fn.name === executedUnlocker?.abiFunction?.name)?.selector;
          const logicalFunctionNames = [
            executedUnlocker?.abiFunction?.name,
            ...stb.getLowLevelCallUtxoGroups().flatMap((group) => [
              group.logicalFunctionName, group.functionName, group.compilerRoute?.abiFunction?.name,
            ]),
            ...stb.getExternalCallUtxoGroups().flatMap((group) => [
              group.logicalFunctionName, group.functionName, group.compilerRoute?.abiFunction?.name,
            ]),
          ].filter((name): name is string => !!name);
          const activeInstructions = (lastStep as {
            instructions?: Parameters<typeof encodeAuthenticationInstructions>[0];
            controlStack?: unknown[];
          });
          const activeBodyHex = (activeInstructions.controlStack?.length ?? 0) > 0
            && activeInstructions.instructions !== undefined
            ? binToHex(encodeAuthenticationInstructions(activeInstructions.instructions)) : undefined;
          const requireMessage = probeRequireMessage(
            artifactCandidates, selector, ip, logicalFunctionNames, activeBodyHex,
          );
          return `VM failed at ip ${ip ?? '?'}`
            + `${opcode !== undefined ? ` opcode ${opcode}` : ''}: ${detail}`
            + `${requireMessage ? `; require: ${requireMessage}` : ''}`;
        })()) : undefined;
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_RETURN_SNAPSHOT === '1') {
          console.error('derive-return-events-complete', stb.getReturnEventOutputs().map((event) => ({
            identity: event.identity,
            categoryId: event.categoryId,
            commitment: binToHex(event.commitment),
          })));
        }

        // When the VM didn't fully converge, derived transfers may still contain
        // placeholder bytecodes or amounts. Check both bytecodes and amounts are fully
        // resolved before accepting the derivation.
        if (vmHadError) {
          const satoshiBytecodesFull = derivedTransfers
            ? derivedTransfers.every((t) => binToHex(t.lockingBytecode) !== binToHex(dummyLbc))
            : false;
          if (derivedTransfers && (!satoshiAmountsFullyDerived || !satoshiBytecodesFull)) {
            stb.clearTransfers();
            // Re-add initial placeholders so output count stays correct for re-derivation
            for (let i = 0; i < satoshiTransferCount; i++) stb.addTransfer(dummyLbc, 1000n);
            derivedTransfers = undefined;
          }
          const ftBytecodesFull = derivedFtTransfers
            ? derivedFtTransfers.every((t) => binToHex(t.lockingBytecode) !== binToHex(dummyLbc))
            : false;
          if (derivedFtTransfers && (!ftAmountsFullyDerived || !ftBytecodesFull)) {
            stb.clearTokenContainerTransfers();
            for (const op of ftOps) {
              stb.addTokenContainerTransfer(op.categoryId, dummyLbc, 1n, op.outputSlot);
            }
            derivedFtTransfers = undefined;
          }
          // NFT transfers: same placeholder cleanup as satoshi and FT transfers
          const nftBytecodesFull = derivedNftTransfers
            ? derivedNftTransfers.every((t) => binToHex(t.lockingBytecode) !== binToHex(dummyLbc))
            : false;
          if (derivedNftTransfers && !nftBytecodesFull) {
            stb.clearTokenContainerTransferNfts();
            for (const op of nftOps) {
              const inputNft = stb.getTokenContainerInfos().find((container) =>
                container.tokenContainerCategoryId === op.categoryId)?.utxo?.token?.nft;
              stb.addTokenContainerTransferNft(
                op.categoryId, dummyLbc, hexToBin(inputNft?.commitment ?? ''), inputNft?.capability ?? 'none',
                op.outputSlot,
              );
            }
            derivedNftTransfers = undefined;
          }
        }

        if (!derivedAState) {
        // No failing commitment compare was extracted. A read-only call keeps the on-chain
        // values. An optimistic seed that the probe already accepted has nothing left to
        // extract, and replacing it with the on-chain value submits the old commitments.
          const currentState: Record<string, StateValueType> = {};
          const onChainState = currentStateSnapshot ?? (await this.getFullState()).state;
          for (const v of stateLayout.variables) {
            const seeded = stb.stateUpdate(v.name);
            if (seeded !== undefined) {
              currentState[v.name] = seeded as StateValueType;
              continue;
            }
            if (onChainState[v.name] !== undefined) {
              currentState[v.name] = onChainState[v.name] as StateValueType;
              stb.setState(v.name, onChainState[v.name] as StateValueType);
            }
          }
          reconcileReturnWitnesses();
          return {
            state: currentState, vmErrored: vmHadError, derivationError,
            derivedTransfers, derivedTokenContainerTransfers: derivedFtTransfers,
            derivedTokenContainerTransferNfts: derivedNftTransfers,
          };
        }

        // A failing probe can still derive every state write reached before the failure. Preserve unchanged
        // variables from the current on-chain state so callers receive a complete state object; the builder was
        // already seeded with these same commitments. This is particularly important for proxy initializers
        // whose final covenant check can fail after writing only a subset of a large state layout.
        const onChainState = currentStateSnapshot ?? (await this.getFullState()).state;
        for (const variable of stateLayout.variables) {
          if (derivedAState[variable.name] !== undefined) continue;
          const seeded = stb.stateUpdate(variable.name);
          if (seeded !== undefined) {
            derivedAState[variable.name] = seeded as StateValueType;
            continue;
          }
          if (onChainState[variable.name] !== undefined) {
            derivedAState[variable.name] = onChainState[variable.name] as StateValueType;
            stb.setState(variable.name, onChainState[variable.name] as StateValueType);
          }
        }
        reconcileReturnWitnesses();
        // State commitments were found. If the VM errored, they might be false positives from infrastructure
        // code. Mark for re-derivation while retaining the complete current-state baseline above.
        return {
          state: derivedAState, vmErrored: vmHadError, derivationError,
          derivedTransfers, derivedTokenContainerTransfers: derivedFtTransfers,
          derivedTokenContainerTransferNfts: derivedNftTransfers,
        };

      } catch (e) {
        if (['1'].includes((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_ROUTE_CONCISE ?? '')) {
          console.error('full-state-derivation-error', e);
        }
        if (e instanceof AutoDerivationError) throw e;
        throw new AutoDerivationError(
          `Full state derivation failed: ${e instanceof Error ? e.message : String(e)}`,
          e instanceof Error ? e : undefined,
        );
      }
    } catch (e) {
      // Only swallow AutoDerivationError - let all other errors propagate.
      if (e instanceof AutoDerivationError) {
        return { state: undefined, vmErrored: true, derivationError: e };
      }
      // Wrap unexpected errors from the derivation try-body as AutoDerivationError
      // so that callers get a consistent error type for derivation failures.
      throw e;
    } finally {
      if (probeDelegate?.refreshInternalArgs && Object.keys(restoreProbeWitnesses).length > 0) {
        probeDelegate.refreshInternalArgs(restoreProbeWitnesses, { shiftPredOut: false });
        stb._refreshInputs();
      }
    }
  }

  // Caller-supplied keys for sorted (vmap) mapping KEYS/ENTRIES iteration. A sorted entry stores slot=H(key), not
  // the raw key, so the caller provides the keys and the covenant verifies keyToSlot(key)==slot per entry. Set
  // before the call; a wrong/incomplete set is rejected by the covenant (wrong key -> hash mismatch; missing
  // entry -> chain break).
  private _iterationKeys?: Map<string, Uint8Array[]>;
  private _rawIterationKeysBlob?: Map<string, Uint8Array>;
  private _rawWindowUtxos?: Map<string, Utxo[]>;
  private _rawVMapBatchWitness?: Map<number, {
    slot?: Uint8Array; proof?: bigint; next?: Uint8Array; predOut?: bigint; rank?: bigint; rows?: Uint8Array;
  }>;

  /**
   * Supply the keys for a sorted `enumerable mapping` KEYS/ENTRIES iteration. Required for such iterations (the
   * raw key is not on-chain). Order is irrelevant - the SDK orders them to the chain and the covenant verifies
   * keyToSlot(key) == each entry's slot.
   */
  setIterationKeys(collectionName: string, keys: Uint8Array[]): this {
    (this._iterationKeys ??= new Map()).set(collectionName, keys);
    return this;
  }

  /**
   * @internal Test hook: supply the KEYS/ENTRIES keys blob verbatim, bypassing the honest slot-matching, to
   * exercise the covenant's key-verify backstop against a malicious spender (a key that does not hash to its
   * entry's slot must revert).
   */
  _setRawIterationKeysBlob(collectionName: string, blob: Uint8Array): this {
    (this._rawIterationKeysBlob ??= new Map()).set(collectionName, blob);
    return this;
  }

  /**
   * @internal Test hook: supply the windowed-iteration entry co-spend verbatim, bypassing the cursor-based
   * window planner, to exercise the covenant's anchor-slot pin and contiguity backstops against a malicious
   * spender (a wrong anchor or a skipped entry must revert at the VM).
   */
  _setRawWindowUtxos(collectionName: string, utxos: Utxo[]): this {
    (this._rawWindowUtxos ??= new Map()).set(collectionName, utxos);
    return this;
  }

  /** @internal Test hook: override a derived atomic-batch witness to exercise covenant rejection paths. */
  _setRawVMapBatchWitness(
    slotIndex: number, witness: {
      slot?: Uint8Array; proof?: bigint; next?: Uint8Array; predOut?: bigint; rank?: bigint; rows?: Uint8Array;
    },
  ): this {
    (this._rawVMapBatchWitness ??= new Map()).set(slotIndex, witness);
    return this;
  }

  /** @internal - compute total output count for sentinel index when draining */
  /** @internal */
  /** @internal Address representations accepted by address-keyed mapping storage. */
  private _addressMappingKeyCandidates(addressValue: unknown): Array<string | Uint8Array> {
    return addressMappingKeyCandidatesImpl(
      { provider: this.inner.provider },
      addressValue,
    );
  }

  /** Validate one Solidity-visible ABI frame without starting provider, state, or route work. */
  _validateAbiFrame(
    abiFunction: AbiFunction,
    args: FunctionArgument[],
    options: { implicitMsgSenderCategory?: boolean } = {},
  ): FunctionArgument[] {
    const visibleInputs = abiFunction.inputs.filter((input) => !input.name.startsWith('__internal__'));
    // A direct compiler-owned batch route may carry other physical witnesses while leaving only its caller
    // category for the builder to derive. Keep those supplied witnesses aligned with their actual ABI slots.
    const implicitCallerInputs = options.implicitMsgSenderCategory
      && abiFunction.name === '__message_bus1'
      && abiFunction.inputs.some((input) => input.name === '__internal__msgSenderCategory')
      ? abiFunction.inputs.filter((input) => input.name !== '__internal__msgSenderCategory') : undefined;
    if (args.length !== visibleInputs.length && args.length !== abiFunction.inputs.length
      && args.length !== implicitCallerInputs?.length) {
      throw new Error(
        `Incorrect number of arguments passed to function ${abiFunction.name}. `
        + `Expected ${visibleInputs.length} arguments (${visibleInputs.map((input) => input.type)}) `
        + `but got ${args.length}`,
      );
    }
    // A caller normally supplies the compact visible frame. Contract.createUnlocker also accepts a complete
    // physical frame, so retain exact ABI indices when that form is used; internal parameters need not be a
    // suffix. External-target exclusions are keyed by ABI names to remain correct in either representation.
    const frameInputs = args.length === abiFunction.inputs.length ? abiFunction.inputs
      : args.length === implicitCallerInputs?.length ? implicitCallerInputs : visibleInputs;
    const externalTargetNames = new Set((abiFunction.externalCalls ?? []).flatMap((call) => {
      if (call.addressSource?.kind === 'forward' && call.addressSource.paramIndex !== undefined) {
        const input = visibleInputs[call.addressSource.paramIndex];
        return input ? [input.name] : [];
      }
      return call.addressParam ? [call.addressParam] : [];
    }));
    const normalized = args.map((arg, index) => {
      // Imported Solidity callers may pass a native signer address where an EVM caller supplied its
      // hexadecimal identity as bytes. Normalize that identity before validation and retain the result
      // in the actual argument frame, so hashes and witnesses use the same bytes that were validated.
      if (this.inner.artifact.compiler?.options?.evmCompat === true) {
        const bytes = normalizeSolidityBytesArgument(arg, frameInputs[index]?.type ?? '');
        if (bytes !== arg) return bytes;
      }
      if (frameInputs[index]?.type !== 'address') return arg;
      const addressArg = typeof arg === 'object' && arg !== null && !(arg instanceof Uint8Array)
        && typeof (arg as { address?: unknown }).address === 'string'
        ? (arg as { address: string }).address : arg;
      if (typeof addressArg !== 'string' || externalTargetNames.has(frameInputs[index].name)) {
        return addressArg;
      }
      // The registry distinguishes a plain contract's execution lock from a kernel participant's authenticated
      // public CREATE identity. Use that same value for ABI arguments and genesis state, so both paths agree.
      return registeredValueAddressLockingBytecode(this.inner.provider, addressArg) ?? addressArg;
    });
    const structs = this.inner.artifact.structs ?? this.inner.artifact.stateLayout?.structs;
    frameInputs.forEach((input, index) => {
      encodeFunctionArgument(normalized[index], input.type, structs);
    });
    return normalized;
  }

  /** Resolve the ABI entry selected by a named low-level stateful call's visible argument frame. */
  _resolveCallAbi(functionName: string, args: readonly FunctionArgument[]): AbiFunction | undefined {
    const abi = this.inner.artifact.abi;
    const explicit = abi.find((candidate) => canonicalAbiFunctionSignature(candidate) === functionName);
    if (explicit) return explicit;
    const sameName = abi.filter((candidate) => candidate.name === functionName);
    const arityMatched = sameName.filter((candidate) => candidate.inputs
      .filter((input) => !input.name.startsWith('__internal__')).length === args.length);
    // A plain-name call with multiple same-arity overloads is rejected as ambiguous by Contract.unlock. Do not
    // guess a type here; its dispatch error remains authoritative.
    if (arityMatched.length === 1) return arityMatched[0];
    return sameName.length === 1 ? sameName[0] : undefined;
  }

  async _createBuilder(
    functionName: string,
    args: any[],
    overrides?: {
      masterUtxo?: Utxo; dataNftUtxos?: Utxo[]; externalCalls?: ExternalCallInfo[];
      calls?: CallInfo[];
      entryKeyOverrides?: Map<number, bigint | boolean | Uint8Array>;
      externalEntryKeyOverrides?: Map<number, bigint | boolean | Uint8Array>;
      msgSenderCategory?: Uint8Array;
      /**
       * Locking bytecode of the contract that CALLS this frame, when the frame is a nested/composed participant.
       * The runtime's `msg.sender` is the immediate caller's address (the same identity `msgSenderCategory`
       * publishes), never the transaction origin, so a `msg.sender`-keyed mapping must hash THIS value. Absent for
       * a top-level call sent by the signer, where the signer's own address is the caller.
       */
      callerLockingBytecode?: Uint8Array;
      /**
       * Co-spend UTXOs that carry the CALLER's identity, added to the read-only band of a nested PROBE. The
       * compiled frame resolves its `msg.sender` from its inputs (by category), so a probe that omits the caller
       * compares against an empty item even when every witness is correct. Only input 0 executes in a probe, so a
       * lock-only placeholder unlocker is sufficient here - never use one outside the probe path.
       */
      callerIdentityUtxos?: UnlockableUtxo[];
      drainSatoshiContainer?: boolean;
      drainTokenContainers?: string[];
      emitReturn?: boolean;
      /** Atomic composition's provisional/final message-bus batch return-event commitment. */
      returnBlob?: Uint8Array;
      /** `.staticCall()`: emitReturn is set only to lay out the probe; nothing is ever broadcast. */
      returnProbeOnly?: boolean;
      abiFunction?: AbiFunction;
      compilerRouteSelector?: Uint8Array;
      signerUtxos?: Utxo[];
      logicalIdentity?: Awaited<ReturnType<typeof resolveLogicalIdentity>>;
      /** Absolute base when this local balanced block is concatenated after another participant. */
      blockBase?: number;
      /** A atomic composition supplies one global fee tail after all participant blocks. */
      omitLocalFeeTail?: boolean;
      /** Compiler-authenticated terminal value productions transported through atomic graph promotion. */
      valueChunkProductions?: NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']>;
      /** DS-6: the sorted batch targets that spend, or chain on, a node they share with other targets (else the first). */
      sortedNodeOwners?: readonly number[];
      /** DS-6: lent present deletes that run on their node's owner write: the node is relinked at its default value. */
      sortedChainedDeletes?: readonly number[];
    },
  ): Promise<StatefulTransactionBuilder> {
    const callerArgs = [...args];
    const physicalAbiFunction = this.inner.artifact.abi.find((f) => f.name === functionName);
    let abiFunction = overrides?.abiFunction ?? physicalAbiFunction;
    // A function the compiler refused is emitted as a program that fails wherever it is reached: name its reason.
    const refusedName = `${this.inner.artifact.contractName}.${abiFunction?.name ?? functionName}()`;
    const refusal = this.inner.artifact.refusedFunctions?.find((entry) => entry.functionName === refusedName);
    if (refusal !== undefined) throw new Error(`${refusedName} is refused by the compiler: ${refusal.reason}`);
    // Stateful derivation can copy a supplied value into a larger state/row blob. Validate first so an invalid
    // bytesN reports its ABI error rather than an incidental PUSHDATA limit reached by that derived blob.
    if (abiFunction) args = this._validateAbiFrame(abiFunction, args, {
      implicitMsgSenderCategory: overrides?.compilerRouteSelector !== undefined,
    });
    const valueChunkWriteStagingSession = new ValueChunkWriteStagingSession();
    for (const production of overrides?.valueChunkProductions ?? []) {
      if (!valueChunkWriteStagingSession.stageOwned(
        production.write, production.claim, production.stateOwner, production.value,
      )) {
        throw new Error('Compiler-authenticated value production could not be staged for its exact resource.');
      }
    }
    const timingEnabled = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_BUILDER_TIMING === '1';
    const startedAt = Date.now();
    const timing = (stage: string): void => {
      if (timingEnabled) console.error('builder-timing', { functionName, stage, ms: Date.now() - startedAt });
    };
    const isComposedRoute = overrides?.calls?.some((call) => call.type === 'stateful') === true;
    // Start the wallet snapshot before expanding the very large composed route. Waiting until funding is planned
    // makes the same provider query run while several gigabytes of transient compiler-route objects are live.
    const earlySignerUtxos = overrides?.signerUtxos ?? ((isComposedRoute || functionName === '__forward') && this._signer
      // Resolve the snapshot before route expansion. Leaving this promise pending retains the expanded route
      // while the mock/provider drains prior transaction work, producing the same peak-memory stall as a late scan.
      ? await signerUtxoSnapshot(this._signer) : undefined);
    await this._ensureResolved(); // address-constructed instances: resolve the category before building the tx
    const { resolveSatoshiContainerRouteAbi } = await import('../message-bus/selected-satoshi-container.js');
    abiFunction = await resolveSatoshiContainerRouteAbi(abiFunction, this);
    const mockStorage = (this.inner.provider as unknown as {
      indexer?: { storage?: { _test?: unknown } };
    }).indexer?.storage;
    const syncMockParticipantOracle = async (
      contract: { inner: { lockingBytecode: string } },
    ): Promise<void> => {
      if (!mockStorage?._test) return;
      const registered = findDeploymentByLockingBytecode(
        this.inner.provider, contract.inner.lockingBytecode,
      );
      // Raw UTXO fixtures and externally managed contracts may deliberately pin historical block registers.
      // Only factory-registered mock deployments opt into the synthetic tip keeper; otherwise a plain read
      // silently rewrites authenticated state before the caller can inspect or spend it.
      if (!registered) return;
      const { syncMockBlockOracleDeployment } = await import('../oracle/blockOracleUpdater.js');
      await syncMockBlockOracleDeployment(this.inner.provider, registered);
    };
    // The mock chain has no keeper. Refresh the state owner before reading it; nested participants are refreshed
    // lazily below, preserving one block context without scanning unrelated deployments on every SDK call.
    // The owner's signed update is the keeper's write. A tip refresh first would make its final time a rewind.
    if (functionName !== '__updateBlockOracle') await syncMockParticipantOracle(this);
    const stateLayout = this.inner.stateLayout!;

    if (mockStorage?._test) {
      const participants = new Set<{ inner: { lockingBytecode: string } }>();
      for (const call of abiFunction?.externalCalls ?? []) {
        const registered = this._externalRegistry.get(call.interfaceName)
          ?? (findDeploymentByName(this.inner.provider, call.interfaceName)?.contract as
            { inner: { lockingBytecode: string } } | undefined)
          ?? (/^I[A-Z]/.test(call.interfaceName)
            ? findDeploymentByName(this.inner.provider, call.interfaceName.slice(1))?.contract as
              { inner: { lockingBytecode: string } } | undefined
            : undefined);
        if (registered) participants.add(registered);
      }
      for (const call of overrides?.externalCalls ?? []) participants.add(call.externalContract);
      for (const call of overrides?.calls ?? []) {
        if (call.type === 'stateful') participants.add(call.contract);
      }
      await Promise.all([...participants].map(syncMockParticipantOracle));
    }
    const registeredSelf = findDeploymentByAddress(this.inner.provider, this.target);
    const executionSelfAddress = hexToBin(
      registeredSelf ? registeredExecutionLockingBytecode(registeredSelf) ?? this.inner.lockingBytecode
        : this.inner.lockingBytecode,
    );
    // Legacy entries use the executing registry lock. An entry with a published own-self witness can instead
    // authenticate its CREATE identity, independently of the identity it forwards as a child's caller.
    const registeredSelfAddress = registeredSelf?.lockingBytecode
      ? hexToBin(registeredSelf.lockingBytecode) : hexToBin(this.inner.lockingBytecode);
    const authenticatedSelfAddress = registeredSelfAddress;
    const storedLogicalLock = this._logicalAddress === undefined
      ? undefined : addressToLockScript(this._logicalAddress);
    const logicalCreateLock = storedLogicalLock !== undefined
      && binToHex(storedLogicalLock).toLowerCase() !== binToHex(authenticatedSelfAddress).toLowerCase()
      ? storedLogicalLock : undefined;
    const authenticatesOwnSelf = usesOrdinarySelfIdentity(abiFunction)
      && !compilerRouteUsesPhysicalWrapper(overrides?.compilerRouteSelector, physicalAbiFunction, abiFunction);
    const publicSelfAddress = authenticatesOwnSelf && logicalCreateLock !== undefined
      ? logicalCreateLock : authenticatedSelfAddress;
    // The identity a CHILD callee observes as `msg.sender` (anchor witness and msg.sender-keyed entries). A plain
    // deployment whose route proves its own SCID is addressed by its logical CREATE lock (`getAddress()`), as the
    // atomic graph presents the same caller; proxy, framed and native deployments keep the physical executing lock.
    const childSeesLogicalSelf = this._framedAddress === undefined && this._framedProxyAddress === undefined
      && (registeredSelf?.contract as { implementation?: unknown } | undefined)?.implementation === undefined
      && routeAuthenticatesPublicSelf(this.inner.artifact);
    const publicSelfIdentity = Object.freeze({
      categoryId: this.categoryId,
      lockingBytecode: binToHex(childSeesLogicalSelf && logicalCreateLock !== undefined
        ? logicalCreateLock : authenticatedSelfAddress),
    });
    const requiredNftIndices = abiFunction?.requiredNftIndices
      ?? Array.from({ length: stateLayout.dataNftCount }, (_, i) => i);

    // Check if function needs full state (data NFTs, entries, external reads, etc.)
    // Check if function needs full state (data NFTs, entries, external reads, etc.)
    const onChainState = await loadCreateBuilderOnChainStateImpl(
      {
        getFullState: () => this.getFullState(),
        getMasterOnlyState: () => this._getMasterOnlyState(),
      },
      requiredNftIndices,
      abiFunction,
    );
    timing('state-loaded');
    const statefulCall = (name: string): FunctionArgument[] | undefined => (
      functionName === name ? args
        : overrides?.calls?.find((call): call is Extract<CallInfo, { type: 'stateful' }> =>
          call.type === 'stateful' && call.functionName === name)?.args
    );
    // Proof (predecessor) entry UTXO per sorted-mapping slot, retained so a probe build can republish the physical
    // input coordinate it actually assembled instead of the dense block-slot offset the covenant adds to the master.
    let topLevelVmapProofUtxos = new Map<number, { txid: string; vout: number }>();

    const {
      masterUtxo,
      derivationMasterUtxo,
      filteredDataNftUtxos,
    } = resolveCreateBuilderMasterAndDataNftsImpl({
      functionName,
      categoryId: this.categoryId,
      requiredNftIndices,
      onChainState,
      overrides,
    });

    // Append _msgSenderCategory if function uses msg.sender
    let finalArgs = [...args];

    // Canonical vmap counter loops are lowered to read their logical key from a hidden permutation array. Build that
    // witness from the public bound: [0..n) sorted by the same full-width slot hash used by the covenant. The lowered
    // body uses perm[physical_i] everywhere the source used logical i, so key and derived value stay paired.
    const vmapMaterialized = await materializeCreateBuilderVmapPermutationsImpl(
      {
        hydrateExternalPredicateState: (...a: any[]) => (this as any)._hydrateExternalPredicateState(...a),
        evaluateExternalExpression: (...a: any[]) => (this as any)._evaluateExternalExpression(...a),
        vmapCounterDomain: (...a: any[]) => (this as any)._vmapCounterDomain(...a),
      },
      abiFunction,
      this.inner.artifact,
      args,
      finalArgs,
      onChainState.state,
      executionSelfAddress,
    );
    args = vmapMaterialized.args;
    finalArgs = vmapMaterialized.finalArgs;

    const earlyArgsHost: MaterializeCreateBuilderEarlyArgsHost = {
      getExternalTargetEntriesByInterface: (interfaceName) =>
        this.inner.getExternalTargetEntriesByInterface(interfaceName) as ReturnType<
        MaterializeCreateBuilderEarlyArgsHost['getExternalTargetEntriesByInterface']
        >,
    };
    const earlyArgs = await materializeCreateBuilderEarlyArgsImpl(
      earlyArgsHost,
      functionName,
      abiFunction,
      finalArgs,
      overrides,
    );
    finalArgs = earlyArgs.finalArgs;
    let returnEmitOutputIndex = earlyArgs.returnEmitOutputIndex;
    let returnMaterializationOutputIndex = earlyArgs.returnMaterializationOutputIndex;
    const returnAbiFunction = earlyArgs.returnAbiFunction;
    let returnEmitBlockOffset = earlyArgs.returnEmitBlockOffset;
    const resolvedMsgSenderCategory = earlyArgs.resolvedMsgSenderCategory;

    // Handle entry NFT accesses — promote delegatecall impl entry metadata when the wrapper has none.
    let {
      entryAccesses,
      entryAbiFunction,
      entryArtifact,
      entryArgs,
      entryCompilerRoute,
    } = resolveCreateBuilderEntryAbiImpl(
      abiFunction,
      args,
      this.inner.artifact,
      overrides?.calls ?? [],
    );
    // Stored-value recipes execute in the selected implementation's context. A proxy's physical forwarder
    // need not read time itself, even when its selected delegate recipe does. Bind the same authenticated
    // oracle lock as that implementation, rather than inferring time from the provider's wall clock.
    const oracleLock = entryArtifact.usesBlockOracle === true
      ? blockOracleLockFor(entryArtifact) ?? this.inner.blockOracleLock : undefined;
    const oracleTimestamp = oracleLock === undefined
      ? undefined : await readBlockOracleTimestamp(this.inner.provider, oracleLock);
    const recipeState: Record<string, StateValue> = oracleTimestamp === undefined
      ? onChainState.state : { ...onChainState.state, __block_timestamp: oracleTimestamp };

    // Carrier coverage changes physical input/output ownership. Resolve it as soon as the effective entry handler
    // and selected route rows are known, before any journal provider lookup can mask a deterministic coverage
    // failure. The resulting mode is batch-wide: unrelated selections stay legacy, complete coverage defers, and
    // partial coverage fails closed.
    const selectedRouteRows = (
      (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)?.messageBusRowArguments
      ?? entryCompilerRoute?.rowArguments
      ?? []
    );
    const internalReadCarrierCapability = kernelReadCarrierCapabilityForSelectedRoute(
      kernelEntryJournalReadCarrierCapabilityFromArtifact(entryArtifact),
      entryCompilerRoute,
      selectedRouteRows,
      entryAbiFunction,
      entryArtifact,
      entryCompilerRoute?.blob ?? (() => {
        const batchBlobIndex = entryAbiFunction?.inputs.findIndex((input) => input.name === 'batchBlob') ?? -1;
        const candidate = batchBlobIndex < 0 ? undefined : entryArgs[batchBlobIndex];
        return candidate instanceof Uint8Array ? candidate : undefined;
      })(),
    );
    const selectedUpsertRows = selectedRouteRows
      .filter((row) => (row.handler.sortedUpsertLoopInfo?.length ?? 0) > 0);
    const plannedUpsertRows = selectedUpsertRows;
    const upsertPlanningFrames = selectedUpsertRows.length > 0
      ? plannedUpsertRows.map((row) => ({
        abiFunction: row.handler,
        args: row.args as FunctionArgument[],
        routed: true,
        row,
      }))
      : (entryAbiFunction?.sortedUpsertLoopInfo?.length ?? 0) > 0
        ? [{ abiFunction: entryAbiFunction!, args: entryArgs, routed: false, row: undefined }]
        : [];
    const selectedJournalHandlers = internalReadCarrierCapability && selectedRouteRows.length > 0
      ? selectedRouteRows.map((row) => row.handler)
      : entryAbiFunction ? [entryAbiFunction] : [];
    // The public manifest is usable only when the exact local route has authenticated the carrier capability.
    // In its absence, preserve the established non-carrier behavior byte-for-byte.
    const authenticatedKernelJournalDispositions = internalReadCarrierCapability
      ? kernelJournalDispositionsFromArtifact(entryArtifact) : undefined;
    const authenticatedDispositionSelection = authenticatedKernelJournalDispositions
      ? planAuthenticatedKernelJournalDispositionChain(
        authenticatedKernelJournalDispositions, selectedJournalHandlers, [],
      ) : undefined;
    const deferRuntimeJournalMaterialization = authenticatedDispositionSelection
      ?.deferRuntimeJournalMaterialization
      ?? shouldDeferKernelJournalBatchMaterialization(
        internalReadCarrierCapability, selectedJournalHandlers,
      );
    // A public constructed-vector descriptor proves only that the SDK can replay the source-local producer.
    // It does not yet prove that this route's journal stream consumed the same rank/key vector. Refuse before
    // any entry-input topology is derived if a future compiler accidentally marks such a route kernel-eligible.
    // Direct/legacy invocations retain the ordinary on-chain array evaluation and never enter this route guard.
    if (entryAbiFunction
      && (entryAbiFunction as MessageBusRuntimeAbiFunction).messageBusConvention === 'kernel-row-loop') {
      assertConstructedKeyVectorRouteBinding(entryAbiFunction.constructedKeyVectors, undefined);
    }
    let entryNfts: EntryNftInfo[] = [];
    // Value witnesses are keyed by the entry-slot ordinal their own ABI name spells, never by their position in
    // this collection order: an aggregate route publishes one position per union entry slot (a slot whose
    // collection carries no chunkable value still holds a position), so a positional list would hand each later
    // value to the parameter of the slot before it.
    let entryValueWitnesses = new Map<number, Uint8Array | Uint8Array[]>();
    let entryBatchWitnesses = new Map<string, unknown>();
    // vmap sorted-set inserts to inject after the builder is created: P' (the predecessor's new commitment at its
    // entry slot) and NEW (the new node minted at the trailing loop-entry output).
    const sortedInserts: Array<{ slotIndex: number; collection: string; predNew: Uint8Array; newNode?: Uint8Array }> = [];
    // Routed batch TARGET nodes published with their key and successor link only. The row's handler builds the
    // value, so the tail is completed after the builder exists: from the transported production of that exact
    // entry when the atomic graph carries one, otherwise from the value the trace authenticates.
    let pendingEntryValueTails: Array<{
      slotIndex: number; collection: string; slot: Uint8Array; seed: string; next: Uint8Array; chunkable: boolean;
    }> = [];
    // P5b value-chunk mints (collected in the entry loop, added to the builder after it is created).
    const valueChunkMints: Array<{
      collection: string; slotIndex: number; slot: Uint8Array; value: Uint8Array;
      digest: Uint8Array; chunks: Uint8Array[];
    }> = [];
    const loopValueChunkMints: Array<{
      collection: string; slot: Uint8Array; digest: Uint8Array; chunks: Uint8Array[];
    }> = [];
    // P5b COMPUTED chunkable writes (no resolvable value param): the covenant pins the chunks, so the SDK derives
    // their commitments from the trace (registered as valueChunkVars after the builder is created).
    const computedValueChunkRuns: Array<{ id: string; collection: string; slot?: Uint8Array }> = [];
    const addComputedValueChunkRun = (collection: string, slot?: Uint8Array): void =>
      appendComputedValueChunkRun(computedValueChunkRuns, collection, slot);
    // Computed UPDATES (present key, no NEW node): pin the loop entry empty so it is not phantom-derived.
    const computedValueUpdateCollections = new Set<string>();
    const runtimeLoopDerivedCounts = new Map<string, number>();
    const runtimeExpressionLoopCollections = new Set<string>();
    // P5b overwrite GC: on an UPDATE whose OLD value was long, co-spend its old chunks (collection, slot, oldDigest)
    // so they are consumed rather than orphaned as dust. Digest-keyed, so only the exact old version is reclaimed.
    const valueChunkGc: Array<{ collection: string; slotHex: string; oldDigestHex: string }> = [];
    const batchTargetSlots = new Map<number, Uint8Array>();
    const batchTargetPlaceholders = new Map<number, string>();
    let exactBatchTargetSlots = new Set<number>();
    let batchPredCommitments = new Map<string, string[]>();
    // DS-6: the owner sets that may hold a node shared with an earlier target instead, tried where the first refuses;
    // `chainedDeletes` run on their node's owner write.
    const sortedNodeOwnerAlternatives: { owners: number[]; chainedDeletes?: number[] }[] = [];
    const runtimeMessageBusAliasSkipSlots = new Set<number>();
    const inactiveMessageBusEntrySlots = new Set(
      (entryAbiFunction as AbiFunction & { messageBusInactiveEntrySlots?: readonly number[] } | undefined)
        ?.messageBusInactiveEntrySlots ?? [],
    );
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_COLLECTION_FETCH === '1') {
      console.error('message-bus-entry-meta', JSON.stringify({
        buildId: peekBuildId(),
        contract: this.inner.artifact.contractName,
        abiFunction: entryAbiFunction?.name,
        inactive: [...inactiveMessageBusEntrySlots],
        accesses: (entryAccesses ?? []).map((access) => [access.slotIndex, access.collection, access.operations]),
      }));
    }
    const activeMessageBusWriteCollections = (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)
      ?.messageBusActiveWriteCollections;
    const activeMessageBusEntryOperations = (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)
      ?.messageBusActiveEntryOperations;
    const activeMessageBusEntryRecipes = (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)
      ?.messageBusActiveEntryRecipes;
    const entryAccessForSlot = (slotIndex: number): EntryAccessAbi | undefined =>
      entryAccessAt(entryAbiFunction, slotIndex);
    const inactiveDirectEntryWrites = new Set<number>();
    if (activeMessageBusEntryOperations === undefined && selectedRouteRows.length === 0) {
      const { evaluateFixedEffectPredicate } = await import('../message-bus/message-bus.js');
      for (const [index, access] of (entryAccesses ?? []).entries()) {
        if (access.activation === undefined) continue;
        const active = evaluateFixedEffectPredicate(
          access.activation, entryArgs, onChainState.state as Readonly<Record<string, FunctionArgument>>,
        );
        if (typeof active !== 'boolean') {
          throw new Error(`Could not resolve fixed entry activation in '${entryAbiFunction?.name ?? functionName}'.`);
        }
        if (active) continue;
        const slotIndex = access.slotIndex ?? index;
        inactiveDirectEntryWrites.add(slotIndex);
      }
    }
    const entryOperations = (slotIndex: number): readonly string[] =>
      activeMessageBusEntryOperations !== undefined
        ? activeMessageBusEntryOperations.get(slotIndex) ?? []
        : inactiveDirectEntryWrites.has(slotIndex)
          ? [...new Set([
            ...(entryAccessForSlot(slotIndex)?.operations ?? []).filter((operation) =>
              operation !== 'write' && operation !== 'delete'),
            'read',
          ])]
          : entryAccessForSlot(slotIndex)?.operations ?? [];
    // An active fixed slot that is its collection's only write here: no batch, loop or sibling slot shares its lane.
    const isSoleActiveFixedCollectionWrite = (collection: string, slotIndex: number): boolean =>
      !inactiveMessageBusEntrySlots.has(slotIndex)
      && (activeMessageBusWriteCollections === undefined || activeMessageBusWriteCollections.includes(collection))
      && !(entryAbiFunction?.sortedBatchInfo?.some((batch) => batch.collection === collection) ?? false)
      && !(entryAbiFunction?.sortedUpsertLoopInfo?.some((info) => info.collection === collection) ?? false)
      && !(entryAbiFunction?.sortedInsertLoopInfo?.some((info) => info.collection === collection) ?? false)
      && (entryAccesses ?? []).every((other, index) => (other.slotIndex ?? index) === slotIndex
        || other.collection !== collection
        || !entryOperations(other.slotIndex ?? index).some((operation) =>
          operation === 'write' || operation === 'delete'));

    if (entryAccesses && entryAccesses.length > 0 && stateLayout.collections) {
      nextBuildId();
      // Entries of DIFFERENT collections share the master's category and are indistinguishable by commitment
      // when they carry the same key (a[k] and b[k] both parse under either collection's types). onChainState.
      // entryNftUtxos also mixes in dynamic-storage chunks, so matching within that category-wide list can pick
      // the wrong collection even when the contract declares only one mapping. Always fetch through the exact
      // collection covenant address; the address commits to the collection signature.
      const collEntryCache = new Map<string, Utxo[]>();
      const collectionEntriesFor = async (sig: string, options?: { fresh?: boolean }): Promise<Utxo[]> => {
        const hit = options?.fresh ? undefined : collEntryCache.get(sig);
        if (hit) return hit;
        const addr = getEntryNftAddress(this.inner, this.categoryId, sig);
        const allFetched = await this.inner.provider.getUtxos(addr);
        const fetched = allFetched.filter((u) => (
          u.token?.category === this.categoryId
          && u.token?.nft?.capability === 'mutable'
          && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0
        ));
        if (['SOLIDC_DEBUG_ROUTE_CONCISE', 'SOLIDC_DEBUG_COLLECTION_FETCH'].some((name) =>
          (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.[name] === '1')) {
          console.error('collection-entry-fetch', {
            contract: this.inner.artifact.contractName, categoryId: this.categoryId,
            signature: sig, address: addr, allCount: allFetched.length, matchedCount: fetched.length,
            commitments: allFetched.map((utxo) => {
              const commitment = utxo.token?.nft?.commitment;
              if (!commitment) return '';
              const hex = typeof commitment === 'string' ? commitment : binToHex(commitment);
              return (globalThis as { process?: { env?: Record<string, string> } }).process?.env
                ?.SOLIDC_DEBUG_COLLECTION_FETCH === '1' ? `${hex.length / 2}:${hex}` : hex.slice(0, 64);
            }),
          });
        }
        collEntryCache.set(sig, fetched);
        return fetched;
      };

      // A key expression can read another mapping before selecting this entry's slot, e.g.
      // `data[enabled && flags[id] ? selected : 0]`. Sorted commitments authenticate slots rather than
      // publishing source keys, so resolve only the keys the compiler expression actually asks for.
      const keyMappingEntries = new Map<string, Awaited<ReturnType<typeof this.getEntries>>>();
      const locallyWrittenCollections = new Set(entryAccesses.filter((access) =>
        access.operations.includes('write') || access.operations.includes('delete'))
        .map((access) => access.collection));
      for (const access of entryAccesses) {
        for (const source of access.keySources ?? []) {
          const effectiveLabel = source.postWriteExpressionLabel ?? source.expressionLabel;
          if (source.kind !== 'expression' || !effectiveLabel) continue;
          for (const match of effectiveLabel.matchAll(/map:([A-Za-z_]\w*)\(/g)) {
            const name = match[1];
            const mapped = stateLayout.collections.find((candidate) => candidate.name === name
              && candidate.kind === 'mapping');
            if (mapped && (!locallyWrittenCollections.has(name)
              || source.preWriteMappingCollections?.includes(name)) && !keyMappingEntries.has(name)) {
              keyMappingEntries.set(name, await this.getEntries(mapped.signature));
            }
          }
        }
      }
      const mappingKeyValue = (
        name: string, key: unknown, preWriteCollections?: readonly string[],
      ): StateValue | undefined => {
        const mapped = stateLayout.collections?.find((candidate) => candidate.name === name
          && candidate.kind === 'mapping');
        const entries = keyMappingEntries.get(name);
        // A handler that also mutates this collection may read a newer in-script value. Use the
        // pre-transaction snapshot only when the compiler proves this key read precedes that mutation.
        if (!mapped || !entries || (locallyWrittenCollections.has(name)
          && !preWriteCollections?.includes(name))
          || (typeof key !== 'bigint' && typeof key !== 'boolean'
          && typeof key !== 'string' && !(key instanceof Uint8Array))) return undefined;
        const entry = selectMappingEntryByKeys(
          entries, [key], mapped.keyTypes ?? [mapped.keyType], mapped,
        );
        return entry?.value ?? getDefaultStateValue(mapped.valueType, stateLayout.structs);
      };

      // P5b value witnesses (__internal__valueWitness_N), collected in entryAccesses (slotIndex) order to match
      // the SymbolTable param injection; appended to finalArgs after this loop (between blockhash and iteration).
      // Each witness is recorded under its entry-slot ordinal, which is the physical route slot for an aggregate
      // route and the handler-local slot for a plain delegate. Both consumers read that ordinal out of the ABI name
      // they are filling, so a slot carrying no chunkable value leaves its own position empty instead of shifting
      // every later value onto the parameter of the slot before it.
      const valueWitnessBySlot = new Map<number, Uint8Array | Uint8Array[]>();

      // A contract caller is authenticated by its immutable CREATE identity, not by whichever implementation
      // lock currently owns its mutable state. The compiler reconstructs msg.sender from the co-spent SCID anchor;
      // use that same lock when selecting msg.sender-keyed entries for a return probe. Direct user calls carry no
      // SCID and retain their signer/P2PKH behavior.
      const authenticatedCallerLock = overrides?.callerIdentityUtxos?.flatMap((utxo) => {
        const commitment = utxo.token?.nft?.commitment;
        if (!isScidIdentityCommitment(commitment)) return [];
        // The source output is reconstructed from this unlocker during probing, so this is exactly the bytecode
        // consumed by OP_UTXOBYTECODE for the authenticated anchor coordinate.
        return [utxo.unlocker.generateLockingBytecode()];
      })[0] ?? overrides?.callerLockingBytecode;

      for (let accessIndex = 0; accessIndex < entryAccesses.length; accessIndex++) {
        const access = entryAccesses[accessIndex];
        const slotIndex = access.slotIndex ?? accessIndex;
        const collection = stateLayout.collections.find((c) => c.name === access.collection);
        if (!collection) {
          throw new Error(`Unknown collection: ${access.collection}`);
        }
        const hasChunkableValueWitness = collection.sorted && collection.chunkableValue
          && (entryOperations(slotIndex).includes('read') || entryOperations(slotIndex).includes('write'));
        const participatesInSortedBatch = entryAbiFunction?.sortedBatchInfo?.some(
          (batch) => batch.slotIndices.includes(slotIndex),
        ) ?? false;
        if (inactiveMessageBusEntrySlots.has(slotIndex) && !participatesInSortedBatch) {
          // Preserve the route's physical entry offset without looking up a collection proof. Several absent
          // inactive keys can share one sorted-list predecessor; resolving them normally would attempt to spend
          // that NFT more than once even though their selector-gated handlers never execute.
          entryNfts.push({
            slotIndex,
            collection: access.collection,
            keyType: collection.keyType,
            valueType: collection.valueType,
            keyValue: 0n,
            exists: false,
          });
          if (hasChunkableValueWitness) valueWitnessBySlot.set(slotIndex, new Uint8Array());
          continue;
        }
        const collectionEntries = await collectionEntriesFor(collection.signature);

        // vmap sorted-linked-list mapping (mapping(K=>bool) set): co-spend ONE entry read-only - the exact entry if
        // k is present, else the bracketing predecessor - which the emitted read covenant needs to return the real
        // membership bit. slot = keyToSlot(k encoded as its on-stack VM number, matching the covenant's OP_SHA256).
        if (collection.sorted) {
          const list = SortedList.fromUtxos(collectionEntries);
          // A described key or value reads state through a copy so a caller-side adjustment can never mutate the
          // snapshot; the key and value evaluators resolve against the same decoded on-chain view.
          const describedState: Record<string, StateValue> = {
            ...((onChainState?.state ?? {}) as Record<string, StateValue>),
          };
          // EXPERIMENT: the probe's trace may read the placeholder state rather than this snapshot; zero the two
          // state members the escrow value depends on and see whether the root then matches the covenant's.
          if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
            ?.SOLIDC_DEBUG_ZERO_STATE === '1') {
            describedState.protocolFee = 0n;
            describedState.__block_timestamp = 0n;
          }
          // Composite slot for a nested mapping m[a][b]...: hash each key independently, then hash the
          // concatenation (keyToSlotMulti), matching the covenant's emitSortedKeyHash. Single key -> keyToSlot.
          const keyNames = access.keyParams.map((name, i) => access.keySources?.[i]?.paramName ?? name);
          const keyTypes = collection.keyTypes ?? [collection.keyType];
          const encodeKey = (paramName: string, keyType: string, ki: number): Uint8Array => {
            const source = access.keySources?.[ki];
            if (source?.kind === 'constant') {
              return bigIntToVmNumber(BigInt(source.constantValue ?? '0'));
            }
            // msg.sender / tx.origin key: slot = keyToSlot(the sender's native P2PKH lockscript = tx.origin). The
            // sender funds via _signer.unlockP2PKH(), so the covenant's on-chain emitTxOrigin resolves to the same
            // lockscript; a wrong address just fails the on-chain slot check (fail-closed).
            if (source?.kind === 'msgSender') {
              if (authenticatedCallerLock !== undefined) return Uint8Array.from(authenticatedCallerLock);
              if (!this._signer) {
                throw new Error('A msg.sender/tx.origin-keyed sorted mapping requires a Signer (the sender funds via '
                  + 'its native P2PKH input): connect one with StatefulContract.connect(signer).');
              }
              return addressToLockScript(this._signer.getAddress());
            }
            if (source?.kind === 'stateArrayLast') {
              const values = onChainState.state[source.stateArrayName ?? ''];
              if (!Array.isArray(values) || values.length === 0) {
                throw new Error(`vmap key source '${source.stateArrayName}' has no last element`);
              }
              const value = values[values.length - 1];
              if (keyType === 'address' && typeof value === 'string' && value.includes(':')) {
                return addressToLockScript(value);
              }
              // State addresses are decoded as their native locking bytecode and VM numerics are already in the
              // canonical forms used by the on-chain key expression.
              if (value instanceof Uint8Array) return value;
              if (typeof value === 'bigint') return bigIntToVmNumber(value);
              if (typeof value === 'boolean') return bigIntToVmNumber(value ? 1n : 0n);
              // Use the state codec for every legal mapping-key type. Besides integers/bools/bytes this covers
              // strings, fixed bytes, enums, user-defined value types, and other aliases exactly as the state
              // decoder materializes them. Keeping this canonical encoder shared with normal ABI/state values is
              // important: the SDK's slot lookup must hash the same byte vector as the covenant's OP_SHA256.
              try {
                return encodePushdataValue(value as StateValue, keyType, stateLayout.structs);
              } catch (cause) {
                throw new Error(
                  `Unsupported vmap state-array key value for '${source.stateArrayName}' (type ${keyType})`,
                  { cause },
                );
              }
            }
            if (source?.kind === 'state') {
              const value = onChainState.state[source.stateVarName ?? ''];
              if (value === undefined) {
                throw new Error(`vmap key source state variable '${source.stateVarName}' is not present in state`);
              }
              if (keyType === 'address' && typeof value === 'string' && value.includes(':')) {
                return addressToLockScript(value);
              }
              if (value instanceof Uint8Array) return value;
              if (typeof value === 'bigint') return bigIntToVmNumber(value);
              if (typeof value === 'boolean') return bigIntToVmNumber(value ? 1n : 0n);
              try {
                return encodePushdataValue(value as StateValue, keyType, stateLayout.structs);
              } catch (cause) {
                throw new Error(
                  `Unsupported vmap state key value for '${source.stateVarName}' (type ${keyType})`,
                  { cause },
                );
              }
            }
            // Expression/computed key (e.g. balances[hash160(pk)] with a local var): not a function param, so
            // resolve it from a caller-supplied entryKeyOverrides value (withEntryKey), matching the default entry
            // model. Without one, use a type-width placeholder (a lone entry / VM-trace derivation resolves it).
            if (source?.kind === 'expression') {
              if (/^(?:call:_msgSender\(\)|nullop:msg\.sender)$/.test(source.expressionLabel ?? '')) {
                // A nested frame's `msg.sender` is the CALLING CONTRACT, not the transaction origin: the compiler
                // resolves it from the caller identity the route/participant publishes, so hashing the signer here
                // keyed the entry on a different slot than the covenant reads (measured: the allowance pin hashed
                // [root, signer] while the runtime witness and the resolution path hashed
                // [root, nested caller], the frame co-spent an unrelated key's node, and the read came back
                // empty). The caller supplies that identity when it builds a nested frame.
                if (authenticatedCallerLock !== undefined) {
                  return Uint8Array.from(authenticatedCallerLock);
                }
                if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                  ?.SOLIDC_DEBUG_MSG_SENDER_KEY === '1') {
                  // Which build reached this fallback decides where the caller identity has to be plumbed; a stack
                  // answers that in one run, where guessing at call sites costs a run per attempt.
                  console.error('msg-sender-key-fallback', JSON.stringify({
                    functionName, entryFunction: entryAbiFunction?.name, slotIndex,
                    hasOverride: overrides?.callerLockingBytecode !== undefined,
                    stack: new Error('msg-sender-key').stack?.split('\n').slice(2, 9)
                      .map((line) => line.trim().replace(/\s*\(.*/, '')),
                  }));
                }
                const senderSigner = this._signer ?? this._logicalNonceSigner;
                if (!senderSigner) {
                  throw new Error('A msg.sender-keyed sorted mapping requires a connected Signer.');
                }
                if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                  ?.SOLIDC_DEBUG_MSG_SENDER_KEY === '1') {
                  // Which object supplies the caller address here decides where its CATEGORY has to be published;
                  // the frame's `__internal__msgSenderCategory` stays at its zero default on this path.
                  const address = senderSigner.getAddress();
                  console.error('msg-sender-signer-identity', JSON.stringify({
                    functionName, slotIndex,
                    signerAddress: typeof address === 'string' ? address : binToHex(address as Uint8Array),
                    signerIsSigner: this._signer instanceof Signer,
                    fromNonceSigner: this._signer === undefined,
                    logicalAddress: String((this as unknown as { _logicalAddress?: unknown })._logicalAddress ?? ''),
                    signerCtor: (senderSigner as unknown as { constructor?: { name?: string } })
                      .constructor?.name,
                  }));
                }
                return addressToLockScript(senderSigner.getAddress());
              }
              // Auto-derive a direct computed key (hash160(pk), sha256(x), ...) from its canonical label.
              const auto = evalComputedKey(source.postWriteExpressionLabel ?? source.expressionLabel,
                entryArgs, entryAbiFunction!.inputs,
                onChainState.state, undefined,
                (name, key) => mappingKeyValue(name, key, source.preWriteMappingCollections));
              if (auto) return auto;
              // `map:<stateArray>(...)` keys an entry by an element of a dynamic state array, which no ABI input can
              // express: the label indexes by a source-loop local. The entry access's own frame is the row that
              // executes, so resolve it with that row context and the decoded state before falling back to a
              // placeholder key (an empty one for an address key, i.e. a proof of an absent slot).
              if (source.expressionLabel?.startsWith('map:') && entryAbiFunction) {
                const routed = resolveRouteRowExpressionKey({
                  expressionLabel: source.expressionLabel,
                  collection: access.collection,
                  rowArguments: selectedRouteRows.length > 0
                    ? selectedRouteRows
                    : [{ args: entryArgs, occurrenceIndex: 0, handler: entryAbiFunction }],
                  routePlanningArgs: entryArgs,
                  routeVisibleInputs: entryAbiFunction.inputs,
                  structs: stateLayout.structs,
                  state: onChainState.state,
                });
                if (routed) return routed;
              }
              // `map:<stateArray>(...)` names an entry key read out of a dynamic state array, which only the
              // selected route rows can supply (the array itself plus that row's loop occurrence). Scoped to that
              // label form and to a routed call, so an ordinary computed key keeps its established fallbacks.
              // A compiler-described key (`keySources[i].kind === 'expression'`) can name a state read that no ABI
              // parameter carries - for example a counter member (`field:_value(state:escrowIdCounter)`). Resolve the
              // label against the same decoded state view the value evaluator uses: the slot is the hash of the
              // on-chain key bytes, so a placeholder key proves an absent entry at the wrong slot and mints a node the
              // covenant never accepts.
              if (source?.kind === 'expression') {
                const described = evalComputedKey(source.postWriteExpressionLabel ?? paramName,
                  entryArgs, entryAbiFunction!.inputs,
                  describedState, undefined,
                  (name, key) => mappingKeyValue(name, key, source.preWriteMappingCollections));
                if (described !== undefined) return described;
              }
              const ov = overrides?.entryKeyOverrides?.get(slotIndex);
              if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                ?.SOLIDC_DEBUG_MSG_SENDER_KEY === '1') {
              // A composer-supplied entry key is the remaining authority that can resolve `msg.sender` correctly
              // while the frame's category witness stays zero; print it next to the collection so the two halves of
              // one identity can be compared in a single run.
                console.error('entry-key-override', JSON.stringify({
                  functionName, abiFunction: abiFunction?.name, slotIndex,
                  collection: access.collection,
                  override: ov === undefined ? undefined
                    : ov instanceof Uint8Array ? `b${ov.length}:${binToHex(ov).slice(0, 24)}` : String(ov),
                }));
              }
              if (ov !== undefined) {
                return ov instanceof Uint8Array ? ov
                  : typeof ov === 'bigint' ? bigIntToVmNumber(ov) : bigIntToVmNumber(ov ? 1n : 0n);
              }
              const m = keyType.match(/^bytes(\d+)$/);
              return m ? new Uint8Array(parseInt(m[1], 10)) : new Uint8Array(0);
            }
            // Route entry helpers wrap their public key input in a local `__message_bus_ek_` alias. Artifact
            // entry metadata preserves that helper-local spelling, while the ABI and `entryArgs` carry the
            // underlying route input. Resolve either spelling; treating the alias as an ABI name produces an
            // undefined key whenever a runtime-loop slot precedes this fixed mapping access.
            const abiParamName = paramName.startsWith('__message_bus_ek_')
              ? paramName.slice('__message_bus_ek_'.length) : paramName;
            const idx = entryAbiFunction!.inputs.findIndex((inp) =>
              inp.name === paramName || inp.name === abiParamName);
            const v = entryArgs[idx] as bigint | number | boolean | Uint8Array | string;
            // An address key is hashed as its locking bytecode (matching the covenant's on-stack address and the
            // default entry model). Bytes keys arrive as Uint8Array (raw); ints as their VM number.
            if (keyType === 'address' && typeof v === 'string' && v.includes(':')) return addressToLockScript(v);
            if (keyType === 'string' && typeof v === 'string') return utf8ToBin(v);
            if (/^bytes(?:\d+)?$/.test(keyType) && typeof v === 'string' && v.startsWith('0x')) {
              return hexToBin(v.slice(2));
            }
            if (/^(?:u?int(?:\d+)?|bigint)$/.test(keyType) && typeof v === 'string') {
              return bigIntToVmNumber(BigInt(v));
            }
            try {
              // A numeric key's on-stack form is its minimal VM number, so 0 is the EMPTY byte string. Falling
              // through to the pushdata encoder hashes 0x00 instead, which is a different vmap slot: measured on
              // the no-proxy application's whitelist getter, the covenant wrote whitelistWorkers[0][worker] at
              // sha256(sha256(empty) ++ sha256(worker-lockscript)) while the read looked up
              // sha256(sha256(0x00) ++ sha256(worker-lockscript)), co-spent the neighbouring head sentinel and
              // halted on the entry covenant's OP_VERIFY.
              // A 20-byte address payload is pushed as its P2PKH lock. The covenant hashes that lock.
              const encoded = typeof v === 'bigint' ? bigIntToVmNumber(v)
                : typeof v === 'number' ? bigIntToVmNumber(BigInt(v))
                  : v instanceof Uint8Array ? v
                    : typeof v === 'boolean' ? bigIntToVmNumber(v ? 1n : 0n)
                      : encodePushdataValue(v as StateValue, keyType, stateLayout.structs);
              return (keyType === 'address' || keyType === 'address payable') && encoded.length === 20
                ? p2pkhLockingBytecode(encoded) : encoded;
            } catch (cause) {
              throw new Error(
                `Cannot encode ${access.collection} entry key '${paramName}' (slot ${slotIndex}) as ${keyType}`,
                { cause },
              );
            }
          };
          const slot = keyToSlotMulti(
            keyNames.map((name, i) => encodeKey(name, keyTypes[i] ?? collection.keyType, i)), collection,
          );
          batchTargetSlots.set(slotIndex, slot);
          const firstKeyParam = keyNames[0].startsWith('__message_bus_ek_')
            ? keyNames[0].slice('__message_bus_ek_'.length) : keyNames[0];
          const kvIdx = entryAbiFunction!.inputs.findIndex((inp) =>
            inp.name === keyNames[0] || inp.name === firstKeyParam);
          const stateArrayKeyValues = access.keySources?.[0]?.kind === 'stateArrayLast'
            ? onChainState.state[access.keySources[0].stateArrayName ?? ''] as unknown[] : undefined;
          const kv = access.keySources?.[0]?.kind === 'constant'
            ? BigInt(access.keySources[0].constantValue ?? '0')
            : access.keySources?.[0]?.kind === 'msgSender'
              ? addressToLockScript(this._signer!.getAddress())
              : access.keySources?.[0]?.kind === 'expression'
                ? (/^(?:call:_msgSender\(\)|nullop:msg\.sender)$/.test(
                  access.keySources[0].expressionLabel ?? '',
                ) && (this._signer ?? this._logicalNonceSigner)
                  ? addressToLockScript((this._signer ?? this._logicalNonceSigner)!.getAddress())
                  : evalComputedKey(
                    access.keySources[0].postWriteExpressionLabel
                      ?? access.keySources[0].expressionLabel,
                    entryArgs, entryAbiFunction!.inputs, describedState,
                    undefined, (name, key) => mappingKeyValue(
                      name, key, access.keySources?.[0]?.preWriteMappingCollections,
                    ),
                  )
                  ?? overrides?.entryKeyOverrides?.get(slotIndex) ?? new Uint8Array(0))
                : access.keySources?.[0]?.kind === 'stateArrayLast'
                  ? stateArrayKeyValues![stateArrayKeyValues!.length - 1] as bigint | boolean | Uint8Array | string
                  : entryArgs[kvIdx] as bigint | boolean | Uint8Array | string;
          // A sorted mapping write OR `delete m[k]` (== assign default, Solidity semantics) both upsert the entry,
          // so the SDK co-spends it the same way. bool sets are value mappings too (true=0x01, false/delete=empty).
          const isWrite = entryOperations(slotIndex).includes('write')
            || entryOperations(slotIndex).includes('delete');
          const isSoftDelete = entryAbiFunction?.blockLayout?.slots.some(
            (s) => s.kind === 'entry' && s.slotIndex === slotIndex && s.softDelete,
          ) ?? false;
          const encodedKv = typeof kv === 'string'
            ? (collection.keyType === 'string' ? utf8ToBin(kv)
              : /^bytes(?:\d+)?$/.test(collection.keyType) && kv.startsWith('0x') ? hexToBin(kv.slice(2))
                : /^(?:u?int(?:\d+)?|bigint)$/.test(collection.keyType) ? BigInt(kv)
                  : kv)
            : kv;
          const entryBase = {
            slotIndex, collection: access.collection, keyType: collection.keyType, valueType: collection.valueType,
            keyValue: encodedKv as bigint | boolean | Uint8Array, exists: true,
          };
          // A compiler-described write may name its value as a construction expression (`valueSource`) rather
          // than an ABI parameter. Read-only probes evaluate that expression here so the chunkable insert below
          // can pin the same value chunks the callee's covenant counts. The label vocabulary is the compiler's
          // canonical expression form (`CacheMappingEntryInLoop.expressionCanon`): literal/id/state leaves,
          // `cast:`, `binop:`/`binary:`, `ternary(...)`, `field:<name>(<inner>)`, `arr(...)`, `index(...)` and
          // `call:<Struct>(...)` constructions.
          // The evaluator reads state through a copy so a caller-side adjustment can never mutate the snapshot.
          const splitTopLevel = (text: string): string[] => {
            const out: string[] = [];
            let depth = 0;
            let current = '';
            for (const char of text) {
              if (char === '(' || char === '[' || char === '{') depth += 1;
              else if (char === ')' || char === ']' || char === '}') depth -= 1;
              if (char === ',' && depth === 0) { out.push(current); current = ''; continue; }
              current += char;
            }
            if (current.length > 0) out.push(current);
            return out;
          };
          // A described value mixes encoded leaves (bytes from `evalComputedKey`) with positional struct
          // members, so normalise every member to the shape the value encoder expects for its declared type.
          const normalizeForType = (member: unknown, type: string | undefined): unknown => {
            if (type === undefined) return member;
            if (type === 'address' || type === 'pubkey' || /^bytes\d*$/.test(type)) {
              if (typeof member === 'string') {
                return member.includes(':') ? addressToLockScript(member)
                  : hexToBin(member.replace(/^0x/, ''));
              }
              if (typeof member === 'bigint') return member === 0n ? new Uint8Array(0) : bigIntToVmNumber(member);
              if (typeof member === 'number') {
                return member === 0 ? new Uint8Array(0) : bigIntToVmNumber(BigInt(member));
              }
              // An address member that carries extra framing must be reduced to the address itself.
              if (type === 'address' && member instanceof Uint8Array
                    && member.length !== 25 && member.length !== 35) {
                for (let start = 0; start + 25 <= member.length; start += 1) {
                  if (start + 35 <= member.length && member[start] === 0xaa && member[start + 1] === 0x20
                        && member[start + 34] === 0x87) return member.slice(start, start + 35);
                  if (member[start] === 0x76 && member[start + 1] === 0xa9 && member[start + 2] === 0x14
                        && member[start + 23] === 0x88 && member[start + 24] === 0xac) {
                    return member.slice(start, start + 25);
                  }
                }
                if (member.length > 35) return member.slice(0, 35);
              }
              return member;
            }
            if (/^(?:u?int\d*|bigint)$/.test(type)) {
              if (member instanceof Uint8Array) {
                return vmNumberToBigInt(member, { requireMinimalEncoding: false });
              }
              if (typeof member === 'boolean') return member ? 1n : 0n;
              if (typeof member === 'number') return BigInt(member);
              if (typeof member === 'string' && /^-?\d+$/.test(member)) return BigInt(member);
              return member;
            }
            if (type === 'string' && typeof member === 'string') return utf8ToBin(member);
            if (type === 'bool') {
              if (typeof member === 'bigint') return member !== 0n;
              if (member instanceof Uint8Array) return member.length > 0 && (member[0] ?? 0) !== 0;
            }
            return member;
          };
          const toBig = (value: unknown): bigint | undefined => (typeof value === 'bigint' ? value
            : typeof value === 'boolean' ? (value ? 1n : 0n)
              : typeof value === 'number' ? BigInt(value)
                : value instanceof Uint8Array
                  ? vmNumberToBigInt(value, { requireMinimalEncoding: false }) as bigint : undefined);
          const evalLabel = (label: string): unknown => {
            let match = label.match(/^(?:lit|literal):(.*)$/);
            if (match) {
              const raw = match[1];
              if (/^-?\d+$/.test(raw)) return BigInt(raw);
              if (raw === 'true') return true;
              if (raw === 'false') return false;
              if (/^0x[0-9a-fA-F]*$/.test(raw)) return hexToBin(raw.slice(2));
              if (/^".*"$/.test(raw)) return utf8ToBin(raw.slice(1, -1));
              return undefined;
            }
            match = label.match(/^id:([A-Za-z_]\w*)$/);
            if (match) {
              const index = entryAbiFunction!.inputs.findIndex((input) => input.name === match![1]);
              const resolved = index >= 0 ? entryArgs[index] : undefined;
              if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                ?.SOLIDC_DEBUG_CHUNK_STAGE === '1') {
                console.error('id-resolve', JSON.stringify({
                  label, index, argCount: entryArgs.length,
                  resolved: resolved === undefined ? 'undefined'
                    : resolved instanceof Uint8Array ? `bytes:${resolved.length}` : typeof resolved,
                  inputNames: entryAbiFunction!.inputs.slice(0, 5).map((input) => input.name).join(','),
                  members: resolved !== null && typeof resolved === 'object' && !(resolved instanceof Uint8Array)
                    ? Object.keys(resolved as Record<string, unknown>).slice(0, 9).map((key) => {
                      const member = (resolved as Record<string, unknown>)[key];
                      return `${key}=${member instanceof Uint8Array ? `b${member.length}:${binToHex(member)}`
                        : typeof member}`;
                    }).join(',') : null,
                }));
              }
              return resolved;
            }
            if (label.startsWith('state:')) {
              const viaState = evalComputedKey(label, entryArgs, entryAbiFunction!.inputs, describedState);
              if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                ?.SOLIDC_DEBUG_CHUNK_STAGE === '1') {
                console.error('state-resolve', JSON.stringify({ label,
                  resolved: String(viaState).slice(0, 24),
                  snapshotValue: String((describedState as Record<string, unknown>)[label.slice('state:'.length)]
                    ?? 'absent'),
                  stateKeys: Object.keys(describedState).slice(0, 10).join(',') }));
              }
              return viaState;
            }
            if (/^(?:nullop|nullary):(?:msg\.sender|tx\.origin)$/.test(label)) return publicSelfAddress;
            match = label.match(/^(?:cast:[a-zA-Z0-9]+)\((.*)\)$/);
            if (match) return evalLabel(match[1]);
            match = label.match(/^unop:!\((.*)\)$/);
            if (match) {
              const value = toBig(evalLabel(match[1]));
              return value === undefined ? undefined : value === 0n;
            }
            match = label.match(/^(?:binop|binary):([^()]+)\((.*)\)$/);
            if (match) {
              const parts = splitTopLevel(match[2]);
              if (parts.length !== 2) return undefined;
              const left = toBig(evalLabel(parts[0]));
              const right = toBig(evalLabel(parts[1]));
              if (left === undefined || right === undefined) return undefined;
              switch (match[1]) {
                case '+': return left + right;
                case '-': return left - right;
                case '*': return left * right;
                case '/': return right === 0n ? undefined : left / right;
                case '%': return right === 0n ? undefined : left % right;
                case '>': return left > right;
                case '<': return left < right;
                case '>=': return left >= right;
                case '<=': return left <= right;
                case '==': return left === right;
                case '!=': return left !== right;
                case '&&': return left !== 0n && right !== 0n;
                case '||': return left !== 0n || right !== 0n;
                default: return undefined;
              }
            }
            match = label.match(/^ternary\((.*)\)$/);
            if (match) {
              const parts = splitTopLevel(match[1]);
              if (parts.length !== 3) return undefined;
              const condition = toBig(evalLabel(parts[0]));
              return condition === undefined ? undefined : evalLabel(condition !== 0n ? parts[1] : parts[2]);
            }
            match = label.match(/^field:([A-Za-z_]\w*)\((.*)\)$/);
            if (match) {
              const innerLabel = match[2];
              const innerId = innerLabel.match(/^id:([A-Za-z_]\w*)$/);
              const innerIndex = innerId
                ? entryAbiFunction!.inputs.findIndex((input) => input.name === innerId![1]) : -1;
              const innerType = innerIndex >= 0 ? entryAbiFunction!.inputs[innerIndex]!.type : undefined;
              const inner = evalLabel(innerLabel);
              if (inner !== null && typeof inner === 'object' && !(inner instanceof Uint8Array)) {
                // Prefer an SDK-codec round trip: a decoded struct argument can carry stale named properties, so
                // re-encode it as the argument's declared struct type, decode the record back, and read the field
                // from that. Only then fall back to the raw record/positional shapes.
                const structOfArgument = innerType === undefined ? undefined
                  : stateLayout.structs?.find((candidate) => candidate.name === innerType);
                // Prefer the argument's OWN decoded members (positional record) - re-encoding and re-decoding it can
                // change member shapes (e.g. address forms) and therefore the bytes of the value being written.
                if (structOfArgument !== undefined && inner !== null && typeof inner === 'object'
                  && !(inner instanceof Uint8Array)) {
                  const positionalRecord = inner as Record<string, unknown>;
                  const rawPosition = structOfArgument.fields.findIndex((field) => field.name === match![1]);
                  if (rawPosition >= 0) {
                    const rawMember = positionalRecord[String(rawPosition)];
                    if (rawMember !== undefined) {
                      return normalizeForType(rawMember, structOfArgument.fields[rawPosition]?.type);
                    }
                  }
                }
                if (structOfArgument !== undefined) {
                  try {
                    const encodedArgument = encodePushdataValue(inner as never, innerType!, stateLayout.structs);
                    const decodedArgument = decodePushdataValue(
                      encodedArgument, 0, innerType!, stateLayout.structs,
                    ).value as Record<string, unknown>;
                    if (decodedArgument !== null && typeof decodedArgument === 'object'
                      && match[1] in decodedArgument) return decodedArgument[match[1]];
                  } catch { /* fall through to the raw shapes */ }
                }
                const record = inner as Record<string, unknown>;
                if (match[1] in record) return record[match[1]];
                const position = structOfArgument?.fields.findIndex((field) => field.name === match![1]) ?? -1;
                if (position >= 0) {
                  const positional = record[String(position)]
                    ?? (Array.isArray(inner) ? (inner as unknown[])[position] : undefined);
                  if (positional !== undefined) {
                    return normalizeForType(positional, structOfArgument?.fields[position]?.type);
                  }
                }
              }
              if (inner instanceof Uint8Array && innerType !== undefined) {
                try {
                  const decoded = decodePushdataValue(inner, 0, innerType, stateLayout.structs);
                  const record = decoded.value as Record<string, unknown>;
                  if (record && typeof record === 'object' && match[1] in record) return record[match[1]];
                } catch { /* fall through */ }
              }
              return undefined;
            }
            match = label.match(/^arr\((.*)\)$/);
            if (match) {
              const parts = splitTopLevel(match[1]);
              const values = parts.map((part) => evalLabel(part));
              return values.some((value) => value === undefined) ? undefined : values;
            }
            match = label.match(/^index\((.*)\)$/);
            if (match) {
              const parts = splitTopLevel(match[1]);
              if (parts.length !== 2) return undefined;
              const array = evalLabel(parts[0]);
              const index = toBig(evalLabel(parts[1]));
              if (!Array.isArray(array) || index === undefined) return undefined;
              return array[Number(index)];
            }
            match = label.match(/^call:([A-Za-z_]\w*)\((.*)\)$/);
            if (match) {
              const struct = stateLayout.structs?.find((candidate) => candidate.name === match![1]);
              if (!struct) return undefined;
              // Every constructor argument is either `field:<name>(<expr>)` or a positional expression. The
              // surrounding expression vocabulary (`field:`, `cast:`, `binop:`, `ternary`, `state:`, `lit:`,
              // `id:`) is exactly what the SDK's own key/value evaluator already understands, so ask it first
              // and only decode the resulting bytes back into a field value of the declared type.
              const decodeField = (bytes: Uint8Array | undefined, type: string | undefined): unknown => {
                if (bytes === undefined) return undefined;
                if (type === undefined) return bytes;
                // `evalComputedKey` returns the ENCODED form of a scalar (raw bytes, no pushdata framing), so a
                // numeric field must be decoded as a VM number directly - feeding those bytes to the pushdata
                // decoder mis-reads the first byte as a length and silently corrupts the value.
                if (/^(?:u?int\d*|bigint|bool)$/.test(type)) {
                  return vmNumberToBigInt(bytes, { requireMinimalEncoding: false });
                }
                if (/^(?:address|pubkey|string|bytes\d*)$/.test(type)) return bytes;
                try {
                  return decodePushdataValue(bytes, 0, type, stateLayout.structs).value;
                } catch {
                  return bytes;
                }
              };
              const record: Record<string, unknown> = {};
              const failedParts: string[] = [];
              const decodedArgumentCache = new Map<string, Record<string, unknown>>();
              splitTopLevel(match[2]).forEach((part, position) => {
                const fieldMatch = part.match(/^field:([A-Za-z_]\w*)\((.*)\)$/);
                const name = fieldMatch ? fieldMatch[1] : struct.fields[position]?.name;
                const type = struct.fields.find((field) => field.name === name)?.type
                  ?? struct.fields[position]?.type;
                if (name === undefined) return;
                const innerLabel = fieldMatch ? fieldMatch[2] : part;
                // A `field:<name>(id:<arg>)` member is taken straight from the argument's decoded record so every
                // member shares one shape (the argument struct's own field typing) before the outer value encoder
                // sees it; only the declaring type conversion is applied on top.
                const argumentName = innerLabel.match(/^id:([A-Za-z_]\w*)$/)?.[1];
                const argumentIndex = argumentName === undefined ? -1
                  : entryAbiFunction!.inputs.findIndex((input) => input.name === argumentName);
                const argumentType = argumentIndex >= 0 ? entryAbiFunction!.inputs[argumentIndex]!.type : undefined;
                if (fieldMatch && argumentType !== undefined) {
                  const cacheKey = `${argumentType}:${argumentIndex}`;
                  let decodedArgument = decodedArgumentCache.get(cacheKey);
                  if (decodedArgument === undefined) {
                    const rawArgument = entryArgs[argumentIndex];
                    if (rawArgument !== undefined) {
                      try {
                        const argumentBytes = rawArgument instanceof Uint8Array ? rawArgument
                          : encodePushdataValue(rawArgument as never, argumentType, stateLayout.structs);
                        decodedArgument = decodePushdataValue(
                          argumentBytes, 0, argumentType, stateLayout.structs,
                        ).value as Record<string, unknown>;
                      } catch { decodedArgument = undefined; }
                    }
                    if (decodedArgument !== undefined) decodedArgumentCache.set(cacheKey, decodedArgument);
                  }
                  const member = decodedArgument?.[name];
                  if (member !== undefined) {
                    record[name] = normalizeForType(member, type);
                    return;
                  }
                }
                // The whole `field:<name>(<inner>)` part is what the SDK evaluator understands (it resolves the
                // inner expression and reads the named member), so hand it the part, not just the inner label.
                const viaKey = evalComputedKey(part, entryArgs, entryAbiFunction!.inputs, describedState);
                if (viaKey !== undefined) {
                  const value = normalizeForType(decodeField(viaKey, type), type);
                  if (value !== undefined) { record[name] = value; return; }
                }
                const arrayMatch = innerLabel.match(/^arr\((.*)\)$/);
                if (arrayMatch) {
                  const elementType = type?.replace(/\[.*\]$/, '');
                  const elements = splitTopLevel(arrayMatch[1]).map((element) => decodeField(
                    evalComputedKey(element, entryArgs, entryAbiFunction!.inputs, describedState),
                    elementType,
                  ));
                  if (elements.every((element) => element !== undefined)) {
                    record[name] = elements.map((element) => normalizeForType(element, elementType));
                    return;
                  }
                }
                // A `field:<name>(<inner>)` part must be evaluated as a whole so the evaluator's own field lookup
                // (which round-trips the struct argument) handles it; positional parts pass their own expression.
                const value = normalizeForType(evalLabel(fieldMatch ? part : innerLabel), type);
                if (value !== undefined) record[name] = value;
                else failedParts.push(`${position}:${name}`
                  + ` viaKey=${viaKey === undefined ? 'undef' : String(viaKey.length)}`
                  + ` inner=${innerLabel.startsWith('cast:') ? 'cast' : innerLabel.slice(0, 24)}`);
              });
              if (failedParts.length > 0 && (globalThis as { process?: { env?: Record<string, string> } })
                .process?.env?.SOLIDC_DEBUG_CHUNK_STAGE === '1') {
                console.error('chunk-part-fail', JSON.stringify({ struct: match[1], failedParts,
                  stateKeys: Object.keys((describedState ?? {}) as Record<string, unknown>).slice(0, 12) }));
              }
              if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                ?.SOLIDC_DEBUG_CHUNK_STAGE === '1') {
                console.error('chunk-label-fields', JSON.stringify({ fields: Object.keys(record) }));
              }
              // Final pass: normalise every member (and every fixed-array element) against the constructed
              // struct's declared field types, so the value encoder never sees mixed shapes.
              const normalized: Record<string, unknown> = {};
              for (const field of struct.fields) {
                const member = record[field.name];
                if (member === undefined) continue;
                const arrayInfo = field.type.match(/^(.+)\[\d+\]$/);
                normalized[field.name] = arrayInfo !== null && Array.isArray(member)
                  ? member.map((element) => normalizeForType(element, arrayInfo[1]))
                  : normalizeForType(member, field.type);
              }
              return normalized;
            }
            return undefined;
          };
          const resolveDescribedValue = (valueSource: string | undefined): Uint8Array | undefined => {
            if (!valueSource) return undefined;
            const value = evalLabel(valueSource);
            if (value === undefined) return undefined;
            try {
              const encodedValue = encodePushdataValue(value as never, collection.valueType, stateLayout.structs);
              if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                ?.SOLIDC_DEBUG_CHUNK_STAGE === '1') {
                try {
                  decodePushdataValue(encodedValue, 0, collection.valueType, stateLayout.structs);
                  console.error('chunk-frames', JSON.stringify({
                    frames: stateLayout.structs?.find((candidate) => candidate.name === collection.valueType)?.fields
                      .map((field) => {
                        const member = (value as Record<string, unknown>)[field.name];
                        if (member === undefined) return `${field.name}:absent`;
                        try {
                          return `${field.name}:${binToHex(encodePushdataValue(member as never, field.type,
                            stateLayout.structs))}`;
                        } catch (frameError) {
                          return `${field.name}:ERR`;
                        }
                      }) ?? null,
                  }));
                  console.error('chunk-value-roundtrip', JSON.stringify({ ok: true, bytes: encodedValue.length,
                    record: (value as Record<string, unknown>) && Object.entries(value as Record<string, unknown>)
                      .map(([key, member]) => `${key}=${member instanceof Uint8Array ? `b${member.length}:${binToHex(member).slice(0, 12)}`
                        : Array.isArray(member) ? `[${member.map((element) => String(element)).join('|')}]`
                          : String(member)}`) }));
                } catch (decodeError) {
                  console.error('chunk-value-roundtrip', JSON.stringify({
                    ok: false, bytes: encodedValue.length, error: String(decodeError).slice(0, 160),
                  }));
                }
              }
              return encodedValue;
            } catch (error) {
              if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                ?.SOLIDC_DEBUG_CHUNK_STAGE === '1') {
                console.error('chunk-encode-fail', JSON.stringify({
                  valueType: collection.valueType,
                  error: String(error).slice(0, 160),
                  fieldTypes: stateLayout.structs?.find((candidate) => candidate.name === collection.valueType)
                    ?.fields.map((field) => `${field.name}:${field.type}`) ?? null,
                  members: value && typeof value === 'object' && !(value instanceof Uint8Array)
                    ? Object.entries(value as Record<string, unknown>).map(([key, member]) => `${key}=${
                      member instanceof Uint8Array ? `bytes:${member.length}`
                        : Array.isArray(member) ? `arr:${member.length}` : typeof member}`) : null,
                }));
              }
              if (value && typeof value === 'object' && !(value instanceof Uint8Array)
                && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
                  ?.SOLIDC_DEBUG_CHUNK_STAGE === '1') {
                const record = value as Record<string, unknown>;
                const removable: string[] = [];
                for (const key of Object.keys(record)) {
                  const copy: Record<string, unknown> = { ...record };
                  delete copy[key];
                  try {
                    encodePushdataValue(copy as never, collection.valueType, stateLayout.structs);
                    removable.push(key);
                  } catch { /* still fails without this member */ }
                }
                console.error('chunk-encode-bisect', JSON.stringify({ removable,
                  offenders: removable.map((key) => {
                    const member = (value as Record<string, unknown>)[key];
                    return Array.isArray(member)
                      ? `${key}=[${member.map((element) => (element instanceof Uint8Array
                        ? `bytes:${element.length}` : typeof element)).join(',')}]`
                      : `${key}=${member instanceof Uint8Array ? `bytes:${member.length}` : typeof member}`;
                  }) }));
              }
              return undefined;
            }
          };
          if (isWrite) {
            // Upsert. Present -> UPDATE: co-spend the exact entry; the covenant pins the entry output k' = link||v,
            // whose value is derived from the VM trace. Absent -> INSERT: co-spend the bracketing predecessor; P'
            // at the entry output is known exactly (inject it), and NEW = k||next||v is minted trailing with its
            // value derived from the trace.
            const present = list.has(slot);
            const wUnlocker = createEntryNftUnlocker(
              this.inner, overrides?.blockBase ?? 0, this.categoryId, access.collection,
            );
            if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
              ?.SOLIDC_DEBUG_ENTRY_PIN === '1') {
              // Pin and witness are written from DIFFERENT slot computations (this one feeds the co-spent entry,
              // `childBatchTargets`/`batchTargetPlaceholders` feed the target node). Printing both here is the only
              // way to see them disagree inside a single build.
              const pinned = present ? list.find(slot) : list.predecessorOf(slot);
              // The slot above and the `__internal__vmapBatchSlot_<n>` witness the covenant consumes are computed
              // by different paths from different argument sources. Print the pin's resolved key BYTES next to its
              // name/type so a disagreement names the component instead of the hash.
              const pinKeys = (() => {
                try {
                  return keyNames.map((name, index) => {
                    const keyType = keyTypes[index] ?? collection.keyType;
                    const abiName = name.startsWith('__message_bus_ek_')
                      ? name.slice('__message_bus_ek_'.length) : name;
                    const at = entryAbiFunction?.inputs.findIndex((inp) =>
                      inp.name === name || inp.name === abiName) ?? -1;
                    return `${name}(${keyType})=${binToHex(
                      encodeKey(name, keyType, index))}:arg=${String(entryArgs[at])}`;
                  });
                } catch (error) {
                  return [`ERR:${String(error).slice(0, 80)}`];
                }
              })();
              console.error('entry-pin', JSON.stringify({
                functionName, entryFunction: entryAbiFunction?.name,
                collection: access.collection, slotIndex,
                slot: binToHex(slot),
                keys: pinKeys,
                present,
                pinnedSlot: pinned === undefined ? undefined
                  : String(pinned.utxo?.token?.nft?.commitment ?? '').slice(0, 64),
              }));
            }
            if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
              ?.SOLIDC_DEBUG_MSG_SENDER_KEY === '1') {
              // Which identity this build resolved `msg.sender` from: the probe and the composed participant share
              // this pin code, so the tuple below is what still differs between them.
              console.error('entry-pin-identity', JSON.stringify({
                // The derive sequence that is currently executing (see `derive-return-value-entry`): pairing the two
                // records by this number names the call site that built the frame which pinned this slot.
                deriveSeq: (this as unknown as { _deriveSeq?: number })._deriveSeq,
                owner: this.inner.artifact.contractName,
                functionName, slotIndex, collection: access.collection,
                slot: binToHex(slot), present,
                hasCallerLock: overrides?.callerLockingBytecode !== undefined,
                // The VALUES, not just presence: several builds pin `_allowances` in one run, and only the tuple
                // identifies which one produced a given slot.
                callerLock: overrides?.callerLockingBytecode === undefined ? undefined
                  : binToHex(overrides.callerLockingBytecode).slice(0, 24),
                callerCategory: overrides?.msgSenderCategory === undefined ? undefined
                  : binToHex(Uint8Array.from(overrides.msgSenderCategory).reverse()).slice(0, 24),
                signer: String(this._signer?.getAddress?.() ?? ''),
                nonceSigner: String(this._logicalNonceSigner?.getAddress?.() ?? ''),
                probe: overrides?.returnProbeOnly === true,
                blockBase: overrides?.blockBase,
              }));
            }
            if (present) {
              entryNfts.push({ ...entryBase, utxo: { ...list.find(slot)!.utxo, unlocker: wUnlocker } });
            } else if (isSoftDelete) {
              // The same slot is read by the early-return guard, so absence still needs the authenticated
              // predecessor. The covenant's slot-equality guard prevents any write/output on this no-op path.
              const predecessor = list.predecessorOf(slot);
              entryNfts.push({ ...entryBase, utxo: { ...predecessor.utxo, unlocker: wUnlocker } });
            } else {
              // X11. A delegated sorted INSERT mints one new entry node, so the transaction's own-category
              // mutable (0x01) NFT count rises by one. A proxy that CONSERVES that count
              // (emitOwnCategoryMutableNftConservation, added for C1 full-state authority) therefore rejects it
              // at its own input, while the implementation covenant accepts the same transaction. The checked-in
              // default upgrades proxy predates that conservation and admits it, which is why the delegated
              // insert settles there. Not refused here: whether it settles is a property of the proxy's
              // bytecode, not of this call.
              const plan = list.planInsert(slot);
              entryNfts.push({ ...entryBase, utxo: { ...plan.predecessor.utxo, unlocker: wUnlocker } });
              // P5b: for a chunkable-value INSERT the covenant chunk-pin adds OP_OUTPUTTOKENCOMMITMENT calls in the
              // loop-entry output range, so the trace-derivation of the NEW node reads chunk commitments by mistake.
              // Compute NEW exactly from the direct value param
              // (slot ++ oldNext ++ len4 ++ [v|sha256(v)++head28]) and inject.
              // it PINNED so the derivation skips this collection entirely (see setLoopEntryCommitments + pinning).
              let newNode: Uint8Array | undefined;
              if (collection.chunkableValue
                && (access.valueParam !== undefined || access.valueSource !== undefined)) {
                const vIdx2 = access.valueParam === undefined ? -1
                  : entryAbiFunction!.inputs.findIndex((inp) => inp.name === access.valueParam);
                const raw2 = vIdx2 >= 0 ? entryArgs[vIdx2] : undefined;
                const described = overrides?.returnProbeOnly && access.valueParam === undefined
                  ? resolveDescribedValue(access.valueSource) : undefined;
                const vB = described ?? (typeof raw2 === 'string' ? utf8ToBin(raw2)
                  : raw2 instanceof Uint8Array ? raw2 : undefined);
                if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                  ?.SOLIDC_DEBUG_CHUNK_STAGE === '1') {
                  console.error('chunk-vb', JSON.stringify({
                    owner: this.inner.artifact.contractName, functionName, collection: access.collection,
                    described: described !== undefined, vBLen: vB?.length ?? null,
                    sha256vB: vB === undefined ? null : binToHex(sha256Sync(vB)),
                    predecessor: (() => {
                      const predecessor = plan.predecessor as unknown as {
                        utxo?: { token?: { nft?: { commitment?: string } } }; value?: unknown };
                      const commitment = predecessor?.utxo?.token?.nft?.commitment;
                      const value = predecessor?.value;
                      return {
                        commitment: commitment === undefined ? null : String(commitment).slice(0, 40),
                        valueKind: value instanceof Uint8Array ? `bytes:${value.length}` : typeof value,
                        valueHex: value instanceof Uint8Array ? binToHex(value).slice(0, 60) : null,
                      };
                    })(),
                    slotKind: slot instanceof Uint8Array ? `b${slot.length}:${binToHex(slot).slice(0, 16)}` : typeof slot,
                    sha256SlotV: vB === undefined || !(slot instanceof Uint8Array) ? null
                      : binToHex(sha256Sync(Uint8Array.from([...slot, ...vB]))),
                    sha256LinkV: vB === undefined ? null
                      : binToHex(sha256Sync(Uint8Array.from([...plan.predecessor.nextKey, ...vB]))),
                    sha256Tail: vB === undefined ? null
                      : binToHex(sha256Sync(encodeChunkableValueTail(vB))).slice(0, 32),
                    sha256Head: vB === undefined ? null
                      : binToHex(sha256Sync(vB.slice(0, 28))).slice(0, 32),
                    tailHex: vB === undefined ? null
                      : binToHex(encodeChunkableValueTail(vB)).slice(0, 80),
                    argMembers: (() => {
                      const inputIndex = entryAbiFunction!.inputs.findIndex((input) => input.name === 'input');
                      const raw = inputIndex >= 0 ? entryArgs[inputIndex] : undefined;
                      if (raw === null || typeof raw !== 'object' || raw instanceof Uint8Array) return String(typeof raw);
                      const record = raw as Record<string, unknown>;
                      return Object.keys(record).slice(0, 9).map((key) => {
                        const member = record[key];
                        return `${key}:${member instanceof Uint8Array ? `b${member.length}:${binToHex(member)}`
                          : typeof member}`;
                      }).join(',');
                    })(),
                    stateTs: String((onChainState?.state as Record<string, unknown> | undefined)
                      ?.__block_timestamp ?? null),
                    stateFee: String((onChainState?.state as Record<string, unknown> | undefined)
                      ?.protocolFee ?? null),
                  }));
                }

                if (vB) {
                  newNode = encodeEntryCommitment(
                    slot,
                    plan.predecessor.nextKey,
                    encodeChunkableValueTail(vB),
                  );
                  // A read-only probe never materializes the caller's external group, where ordinary builds
                  // pre-stage a chunkable value write. The probe's own block must still emit the value-chunk
                  // outputs its entry covenant counts, so mint them from the byte-exact value that produced the
                  // NEW node instead of leaving them to trace derivation. Probes are never broadcast.
                  if (overrides?.returnProbeOnly
                    && !valueChunkMints.some((mint) => mint.collection === access.collection
                      && binToHex(mint.slot) === binToHex(slot))) {
                    valueChunkMints.push({
                      collection: access.collection, slotIndex, slot, value: vB, digest: sha256Sync(vB),
                      chunks: splitValueIntoValueChunks(vB),
                    });
                    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                      ?.SOLIDC_DEBUG_CHUNK_MINT === '1') {
                      console.error('chunk-mint-push', JSON.stringify({
                        owner: this.inner.artifact.contractName, functionName,
                        collection: access.collection, slot: binToHex(slot),
                        digest: binToHex(sha256Sync(vB)), valueBytes: vB.length,
                        chunks: splitValueIntoValueChunks(vB).length,
                        keyParams: access.keyParams,
                        keySources: (access.keySources ?? []).map((source) => ({
                          kind: source?.kind ?? null,
                          paramName: source?.paramName ?? null,
                          stateVarName: source?.stateVarName ?? null,
                          stateArrayName: source?.stateArrayName ?? null,
                          constantValue: source?.constantValue ?? null,
                          expressionLabel: source?.expressionLabel ?? null,
                        })),
                        accessSlots: { entryAccessSlot: access.slotIndex ?? null, routeSlot: slotIndex },
                        routeKeys: (entryAbiFunction?.inputs ?? []).map((input, index) => ({ input, index }))
                          .filter(({ input }) => input.name.startsWith('__message_bus_key_'))
                          .map(({ input, index }) => ({
                            name: input.name, type: input.type,
                            entryArg: entryArgs[index] instanceof Uint8Array
                              ? `b${(entryArgs[index] as Uint8Array).length}:${binToHex(entryArgs[index] as Uint8Array)}`
                              : String(entryArgs[index]),
                            finalArg: finalArgs[index] instanceof Uint8Array
                              ? `b${(finalArgs[index] as Uint8Array).length}:${binToHex(finalArgs[index] as Uint8Array)}`
                              : String(finalArgs[index]),
                          })),
                        stateCounter: (() => {
                          const counter = describedState.escrowIdCounter;
                          return counter === undefined ? 'absent'
                            : JSON.stringify(counter, (_key, value) => (
                              value instanceof Uint8Array ? `b${value.length}:${binToHex(value)}`
                                : typeof value === 'bigint' ? String(value) : value));
                        })(),
                        entryInputNames: (entryAbiFunction?.inputs ?? []).map((input) => input.name),
                      }));
                    }
                  }
                }
              }
              if (!entryAbiFunction?.sortedBatchInfo?.some((b) => b.slotIndices.includes(slotIndex))) {
                sortedInserts.push({ slotIndex, collection: access.collection, predNew: plan.predNewCommitment, newNode });
              }
            }
          } else {
            let present = list.has(slot);
            // A key that the chain holds can still miss here: the collection entries were fetched once per build,
            // and a write performed earlier in the same test (its own composed send) may not have been visible to
            // that fetch yet. Re-fetch before falling back to the bracketing predecessor, whose (empty) value the
            // covenant would otherwise read as "absent". The predecessor remains the correct proof for a key that
            // really is absent.
            if (!present) {
              const refreshed = SortedList.fromUtxos(
                await collectionEntriesFor(collection.signature, { fresh: true }),
              );
              if (refreshed.has(slot)) {
                present = true;
                const refreshedEntry = refreshed.find(slot)!;
                const roUnlockerFresh = createReadOnlyEntryNftUnlocker(
                  this.inner, this.categoryId, access.collection,
                );
                entryNfts.push({
                  ...entryBase, utxo: { ...refreshedEntry.utxo, unlocker: roUnlockerFresh },
                });
                continue;
              }
            }
            const entry = present ? list.find(slot)! : list.predecessorOf(slot);
            if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
              ?.SOLIDC_DEBUG_ENTRY_COUNTS === '1') {
              const freshAddress = getEntryNftAddress(this.inner, this.categoryId, access.collection);
              const freshCount = present ? -1 : (await this.inner.provider.getUtxos(freshAddress)).length;
              console.error('entry-read-plan', JSON.stringify({
                buildId: peekBuildId(),
                freshCount,
                collection: access.collection,
                slotIndex,
                listSize: list.all.length,
                headOnly: list.all.length === 1,
                slot: binToHex(slot),
                present,
                entryCommitment: String(entry.utxo.token?.nft?.commitment ?? '').slice(0, 72),
                sender: (this._signer ?? this._logicalNonceSigner)
                  ? binToHex((this._signer ?? this._logicalNonceSigner)!.getLockingBytecode()) : 'none',
              }));
            }
            const roUnlocker = createReadOnlyEntryNftUnlocker(this.inner, this.categoryId, access.collection);
            entryNfts.push({ ...entryBase, utxo: { ...entry.utxo, unlocker: roUnlocker } });
          }

          // P5b: a chunkable (unbounded bytes/string) value READ needs the full value of the selected proof
          // entry as its __internal__valueWitness_N arg. For an absent key, that entry is its predecessor: the
          // covenant authenticates and decodes the proof value before the slot comparison selects the logical
          // default. Supplying an empty witness for an absent key therefore fails whenever its predecessor is
          // long, even though the eventual source-level value is empty.
          let authenticatedChunkableValue: Uint8Array | undefined;
          if (hasChunkableValueWitness) {
            let witness: Uint8Array = new Uint8Array();
            const present = list.has(slot);
            const proofEntry = present ? list.find(slot)! : list.predecessorOf(slot);
            {
              const tail = proofEntry.value; // len(4 B LE) ++ [ inline value | sha256(value) ]
              if (tail.length >= 4) {
                const len = tail[0] | (tail[1] << 8) | (tail[2] << 16) | (tail[3] << 24);
                if (len > 60) {
                  const root = tail.slice(4, 36);
                  const headData = tail.slice(36, 64);
                  const chunkAddr = getValueChunkAddress(
                    this.inner, this.categoryId, access.collection, proofEntry.slot, root,
                  );
                  const expectedChunkCount = Math.ceil((len - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE);
                  const chunksByIndex = new Map<number, { chunkIndex: number; chunkData: Uint8Array }>();
                  const chunkUtxos = await this.inner.provider.getUtxos(chunkAddr);
                  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                    ?.SOLIDC_DEBUG_COLLECTION_FETCH === '1') {
                    console.error('collection-value-chunk-fetch', {
                      collection: access.collection,
                      categoryId: this.categoryId,
                      slot: binToHex(slot),
                      root: binToHex(root),
                      chunkAddr,
                      expectedChunkCount,
                      utxos: chunkUtxos.map((utxo) => ({
                        category: utxo.token?.category,
                        capability: utxo.token?.nft?.capability,
                        commitment: utxo.token?.nft?.commitment,
                      })),
                    });
                  }
                  for (const chunk of chunkUtxos
                    .filter((u) => u.token?.category === this.categoryId
                      && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0)
                    .map((u) => parseValueChunkCommitment(u.token!.nft!.commitment))) {
                    // Only canonical continuation indices for this authenticated value belong to the
                    // reconstruction. Other covenant families can coexist under provider/indexer queries
                    // and their commitments must not inflate this value's strict chunk count.
                    if (chunk.chunkIndex < expectedChunkCount) chunksByIndex.set(chunk.chunkIndex, chunk);
                  }
                  const chunks = [...chunksByIndex.values()].sort((a, b) => a.chunkIndex - b.chunkIndex);
                  witness = joinValueChunks(headData, chunks, len);
                  if (binToHex(sha256Sync(witness)) !== binToHex(root)) {
                    throw new Error('vmap value chunks do not match the authenticated root');
                  }
                  authenticatedChunkableValue = witness;
                } else if (present) {
                  authenticatedChunkableValue = tail.slice(4, 4 + len);
                }
              }
            }
            if (!present && parseArrayTypeString(collection.valueType)) {
              authenticatedChunkableValue = encodePushdataValue([], collection.valueType, stateLayout.structs);
            }
            if (['SOLIDC_DEBUG_COLLECTION_FETCH', 'SOLIDC_DEBUG_VALUE_WITNESS'].some((name) =>
              (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.[name] === '1')) {
              const tail = proofEntry.value;
              console.error('chunkable-read-witness', {
                slotIndex,
                functionName: entryAbiFunction?.name,
                collection: access.collection,
                slot: binToHex(slot),
                present,
                proofSlot: binToHex(proofEntry.slot),
                tailBytes: tail.length,
                tailHead: binToHex(tail).slice(0, 80),
                storedLength: tail.length >= 4
                  ? tail[0] | (tail[1] << 8) | (tail[2] << 16) | (tail[3] << 24) : 0,
                witnessBytes: witness.length,
                witnessHead: binToHex(witness).slice(0, 120),
              });
            }
            valueWitnessBySlot.set(slotIndex, witness);
          }

          // P5b: a sorted chunkable-value WRITE persists the full value as chunks; the covenant PINS them to the
          // on-stack value (Design D), so they must match slot ++ digest ++ i ++ data exactly. A DIRECT value param
          // is chunked here; a COMPUTED value (unresolvable param / expression) is registered so the SDK derives the
          // pinned chunk commitments from the VM trace (like dynamicChunkVars).
          if (isWrite && collection.chunkableValue) {
            const vIdx = access.valueParam
              ? entryAbiFunction!.inputs.findIndex((inp) => inp.name === access.valueParam)
              : -1;
            const raw = vIdx >= 0 ? entryArgs[vIdx] : undefined;
            const directBytes = typeof raw === 'string'
              ? utf8ToBin(raw) : raw instanceof Uint8Array ? raw : undefined;
            // A chunkable array/struct `valueParam` is a JS value the bytes/string/scalar paths above do not
            // frame. Encode it to the pushdata blob so an inline value mints no phantom continuation and a long
            // value is split exactly, instead of being registered below as a trace-derived computed run.
            const arrayDirectBytes = directBytes === undefined && raw !== undefined
              && !(raw instanceof Uint8Array) && (Array.isArray(raw) || typeof raw === 'object')
              ? ((): Uint8Array | undefined => {
                try {
                  return encodePushdataValue(raw as StateValue, collection.valueType, stateLayout.structs);
                } catch {
                  return undefined;
                }
              })()
              : undefined;
            // A compiler-published deterministic expression is as reproducible as a direct parameter. Resolve it
            // before registering a computed chunk run: inline values own no continuation outputs, while long
            // values can be split exactly. Reserving a phantom chunk for each literal shifts every later trailing
            // resource away from the compiler's declared coordinates.
            // A whole-struct constructor's label is a sequence of field expressions, not a scalar literal.
            // Evaluating it as one key can misread a nested `lit:`/`id:` segment as a CashAddress and loses
            // the typed field encoding. The authenticated computed-value path below owns aggregate values.
            const structuredValue = stateLayout.structs?.some((struct) => struct.name === collection.valueType);
            const vBytes = directBytes ?? arrayDirectBytes ?? (structuredValue ? undefined : evalComputedKey(
              access.valueSource, entryArgs, entryAbiFunction!.inputs,
              onChainState.state as Record<string, StateValue>,
            ));
            if (vBytes) {
              if (vBytes.length > 60) {
                valueChunkMints.push({
                  collection: access.collection, slotIndex, slot, value: vBytes, digest: sha256Sync(vBytes),
                  chunks: splitValueIntoValueChunks(vBytes),
                });
              }
              // A present key takes the covenant's UPDATE arm at any value width: it recreates its own row and
              // mints no NEW node. Pin the NEW lane empty as for computed updates and deletes; a speculative seed
              // can otherwise derive this row's own output check and emit the row twice.
              if (list.has(slot) && isSoleActiveFixedCollectionWrite(access.collection, slotIndex)) {
                computedValueUpdateCollections.add(access.collection);
              }
            } else if (!inactiveMessageBusEntrySlots.has(slotIndex) && !isSoftDelete
              && (activeMessageBusWriteCollections === undefined
                || activeMessageBusWriteCollections.includes(access.collection))) {
              let kernelEncodedValue: Uint8Array | undefined;
              // A fixed message-bus route publishes the union of every handler's entry writes. Inactive
              // sorted-batch lanes still need their authenticated zero-key journal above, but their gated write
              // never emits value continuations. Registering those collections as computed values shifts the
              // selected handler's shared continuation band by one slot per inactive collection.
              const selectedRows = (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)
                ?.messageBusRowArguments;
              // A write whose OLD value is unavailable still has a reproducible NEW value when the route carries
              // row arguments: an INSERT starts from the empty array and a push appends to it. Requiring the
              // authenticated old value here was what kept the deterministic derivation inert for those rows (the
              // trace-discovery alternative deadlocks on the unpublished chunk slot).
              if (selectedRows && (authenticatedChunkableValue || !list.has(slot))) {
                if (structuredValue) {
                  const writes = selectedRows.flatMap((row) => (
                    (row.handler.entryAccesses ?? []).filter((rowAccess) => (
                      rowAccess.collection === access.collection && rowAccess.operations.includes('write')
                    )).map((rowAccess) => ({ row, access: rowAccess }))
                  ));
                  const incomingEntries = authenticatedChunkableValue && list.has(slot)
                    ? [{ collection: collection.signature, slot, value: authenticatedChunkableValue }]
                    : [];
                  if (writes.length > 0) {
                    kernelEncodedValue = foldRouteStoredValues({
                      writes, collection, targetSlot: slot, incomingEntries, artifact: entryArtifact,
                      state: recipeState,
                      encode: ({ row, access: rowAccess }, entries) => this._encodeStoredValueSource(
                        rowAccess, collection.valueType, [...row.args], row.handler, entryArtifact,
                        recipeState, undefined, entries,
                      ),
                    });
                  }
                }
                const legacyCompatibility = usesLegacyJobEventCompatibility(
                  entryArtifact, collection.valueType, stateLayout.structs,
                );
                const legacyTimestamp = legacyCompatibility
                  && typeof recipeState.__block_timestamp === 'bigint'
                  ? recipeState.__block_timestamp : undefined;
                const foldParams: Parameters<typeof foldLeadingRouteArrayPushes>[0] = {
                  rowArguments: selectedRows,
                  collection: access.collection,
                  valueType: collection.valueType,
                  structs: stateLayout.structs,
                  timestamp: legacyTimestamp,
                  legacyJobEventCompatibility: legacyCompatibility,
                  resolveElement: (row, rowAccess, elementType) => this._encodeStoredElementSource(
                    rowAccess, elementType, [...row.args], row.handler, entryArtifact, recipeState,
                  ),
                  // path-effect activation/settle-time ExecutionContext: per-row activations; prefer settle-time ExecutionContext when registered.
                  resolveRowActivationEnv: createFoldRowActivationEnvResolver(),
                };
                const foldedPushes = foldLeadingRouteArrayPushes(foldParams);
                const leadingValue = foldedPushes?.leading;
                const completeValue = foldedPushes?.complete
                  ?? foldCompleteRouteArrayPushes(foldParams)?.complete;
                const leadingIndex = entryAbiFunction!.inputs.findIndex((input) =>
                  input.name === `__internal__leadingPushValue_${slotIndex}`);
                const completeIndex = entryAbiFunction!.inputs.findIndex((input) =>
                  input.name === `__internal__completePushValue_${slotIndex}`
                  || input.name === '__internal__completePushValue');
                // Fold witnesses contain only this route's mutations. The handler appends them to
                // the authenticated old array, so persistence must retain that same prefix too.
                // Keep the ABI witnesses as mutation-only payloads to avoid replaying old elements.
                if (!structuredValue) {
                  kernelEncodedValue = completeValue
                    ? concatenateEncodedArrays(
                      authenticatedChunkableValue
                        ?? encodePushdataValue([], collection.valueType, stateLayout.structs),
                      completeValue,
                    ) : undefined;
                }
                if (leadingValue && leadingIndex >= 0) {
                  entryArgs[leadingIndex] = leadingValue;
                  if (entryAbiFunction === abiFunction) finalArgs[leadingIndex] = leadingValue;
                  if (entryCompilerRoute) {
                    const name = entryAbiFunction!.inputs[leadingIndex]!.name;
                    entryCompilerRoute.internalArgs = { ...entryCompilerRoute.internalArgs, [name]: leadingValue };
                  }
                }
                if (completeValue && completeIndex >= 0) {
                  entryArgs[completeIndex] = completeValue;
                  if (entryAbiFunction === abiFunction) finalArgs[completeIndex] = completeValue;
                  if (entryCompilerRoute) {
                    const name = entryAbiFunction!.inputs[completeIndex]!.name;
                    entryCompilerRoute.internalArgs = { ...entryCompilerRoute.internalArgs, [name]: completeValue };
                  }
                } else if (completeValue && entryCompilerRoute) {
                  // Published fold plan names completeWitness even when the ABI has not yet injected a slot.
                  entryCompilerRoute.internalArgs = {
                    ...entryCompilerRoute.internalArgs,
                    __internal__completePushValue: completeValue,
                    [`__internal__completePushValue_${slotIndex}`]: completeValue,
                  };
                }
              }
              // A fixed message-bus route can reproduce a typed struct update or array append from the
              // authenticated row arguments, so derive the pinned continuations deterministically. Trace
              // discovery needs the probe to reach the pin, and an unpublished chunk slot
              // halts the probe first - a deadlock this branch breaks.
              if (kernelEncodedValue && kernelEncodedValue.length > 60) {
                valueChunkMints.push({
                  collection: access.collection, slotIndex, slot, value: kernelEncodedValue,
                  digest: sha256Sync(kernelEncodedValue),
                  chunks: splitValueIntoValueChunks(kernelEncodedValue),
                });
              } else if (!valueChunkMints.some((mint) => mint.collection === access.collection
                && mint.slot instanceof Uint8Array && binToHex(mint.slot) === binToHex(slot))) {
                // `valueParam` is absent for handler-computed values the route cannot reproduce. A value the
                // insert path above already resolved and minted must not ALSO be registered for trace derivation:
                // the derived run would place a second copy of the same continuation chunks, and the covenant's
                // chunk scan walks matching outputs by chunk ordinal, so the duplicate run makes it read past the
                // end of the value (`OP_SPLIT` beyond the buffer).
                addComputedValueChunkRun(access.collection, slot);
              }
              if (kernelEncodedValue && !list.has(slot)) {
                const plannedInsert = sortedInserts.find((insert) => insert.slotIndex === slotIndex
                  && insert.collection === access.collection);
                if (plannedInsert) {
                  plannedInsert.newNode = encodeEntryCommitment(
                    slot, list.predecessorOf(slot).nextKey, encodeChunkableValueTail(kernelEncodedValue),
                  );
                }
              }
              // A computed UPDATE (present key) mints no NEW node; pin its loop entry EMPTY so the loop-entry
              // derivation does not misread the value-chunk pin's OP_OUTPUTTOKENCOMMITMENT calls as a phantom NEW.
              // A chained softDelete relinks its node at the default value in the batch's predecessor lane (DS-6);
              // that lane must keep the planned commitment, not be pinned empty.
              if (list.has(slot) && !isSoftDelete) computedValueUpdateCollections.add(access.collection);
            }
            // Overwrite GC: if this UPDATE replaces a LONG old value, reclaim its old chunks (old digest tail).
            if (list.has(slot)) {
              const oldTail = list.find(slot)!.value; // len4 ++ [ old value | old digest ]
              if (oldTail.length >= 36 && (oldTail[0] | (oldTail[1] << 8) | (oldTail[2] << 16) | (oldTail[3] << 24)) > 60) {
                valueChunkGc.push({
                  collection: access.collection, slotHex: binToHex(slot), oldDigestHex: binToHex(oldTail.slice(4, 36)),
                });
              }
            }
          }
          continue;
        }

        // Determine key types and values (supports multi-key nested mappings)
        const effectiveKeyTypes = collection.keyTypes ?? [collection.keyType];
        const keyValues: Array<bigint | boolean | Uint8Array> = [];
        let isExpressionKeyPlaceholder = false;
        const keySources = access.keySources
          ?? access.keyParams.map((name) => ({ kind: 'param' as const, paramName: name, canonical: name }));

        for (let ki = 0; ki < keySources.length; ki++) {
          const keySource = keySources[ki];
          if (keySource.kind === 'param') {
            // Existing: extract from function arguments by parameter name
            const keyParamIndex = entryAbiFunction!.inputs.findIndex((inp) => inp.name === keySource.paramName);
            if (keyParamIndex < 0) {
              throw new Error(`Key parameter '${keySource.paramName}' not found in function inputs`);
            }
            let kv = entryArgs[keyParamIndex] as bigint | boolean | Uint8Array | string;
            // Normalize a CashAddress string for an address key to its locking bytecode, matching how the covenant
            // stores it (Argument encoding does the same) - else the search cannot match the on-chain entry.
            if (effectiveKeyTypes[ki] === 'address' && typeof kv === 'string' && kv.includes(':')) {
              kv = addressToLockScript(kv);
            }
            keyValues.push(kv as bigint | boolean | Uint8Array);
          } else if (keySource.kind === 'state') {
            // Auto-resolve from on-chain state
            const stateValue = onChainState.state[keySource.stateVarName!];
            if (stateValue === undefined) {
              throw new Error(
                `Cannot auto-resolve mapping key from state variable '${keySource.stateVarName}'. `
                + 'State variable not found on-chain.',
              );
            }
            keyValues.push(stateValue as bigint | boolean | Uint8Array);
          } else if (keySource.kind === 'stateArrayLast') {
            // `arr[arr.length-1]`: resolve the state array's last element so we co-spend the EXISTING entry
            // for this computed key (else it is treated as a new entry and the old one is left dangling).
            const arr = onChainState.state[keySource.stateArrayName!] as unknown[] | undefined;
            if (!Array.isArray(arr) || arr.length === 0) {
              throw new Error(
                `Cannot resolve mapping key from '${keySource.stateArrayName}[length-1]': array missing or empty.`,
              );
            }
            keyValues.push(arr[arr.length - 1] as bigint | boolean | Uint8Array);
          } else if (keySource.kind === 'constant') {
            // Compile-time-constant uint key (OZ StorageSlot `uint256(SLOT)`): the compiler resolved the value, so
            // match the on-chain entry directly (the covenant re-derives + OP_EQUALVERIFYs the same key).
            keyValues.push(BigInt(keySource.constantValue!));
          } else if (keySource.kind === 'msgSender') {
            // msg.sender / tx.origin key: for a direct call the covenant computes slot = keyToSlot(tx.origin) where
            // tx.origin = the first native P2PKH input's lockscript (emitTxOrigin). The sender funds via
            // _signer.unlockP2PKH(), so slot = keyToSlot(the signer's P2PKH lockscript). A wrong address just fails
            // the on-chain slot==keyToSlot(msg.sender) check (fail-closed).
            // A composed participant is built from a contract instance that may carry only the logical-nonce
            // signer (the account that initiated the call), the same fallback the expression-keyed branch uses.
            // Requiring the physical signer here would either throw or, worse, key the entry by an account that
            // never calls this contract, so both are resolved through one sender lookup.
            const senderSigner = this._signer ?? this._logicalNonceSigner;
            if (!senderSigner) {
              throw new Error(
                `A '${keySource.senderOp ?? 'msg.sender'}'-keyed sorted mapping requires a Signer: the sender must `
                + 'fund the call via its native P2PKH input (StatefulContract.withSigner / connect a Signer).',
              );
            }
            keyValues.push(addressToLockScript(senderSigner.getAddress()));
          } else {
            // Expression: evaluate the compiler's canonical label first (including fixed-array literal indices),
            // then consult an explicit override, and only then use a probe placeholder.
            const entryKeyOverrides = overrides?.entryKeyOverrides;
            const override = entryKeyOverrides?.get(slotIndex);
            const senderExpression = /^(?:call:_msgSender\(\)|nullop:msg\.sender)$/.test(
              keySource.expressionLabel ?? '',
            );
            const senderSigner = this._signer ?? this._logicalNonceSigner;
            const evaluated = senderExpression && senderSigner
              ? addressToLockScript(senderSigner.getAddress())
              : evalComputedKey(keySource.expressionLabel, entryArgs, entryAbiFunction!.inputs);
            if (evaluated !== undefined) {
              const keyType = effectiveKeyTypes[ki];
              keyValues.push(/^(u?int|bigint|enum)/.test(keyType) ? decodeScriptNumber(evaluated) : evaluated);
            } else if (override !== undefined) {
              keyValues.push(override);
            } else {
              // Fallback: type-appropriate placeholder. Auto-derivation will capture
              // the correct commitment from the VM trace.
              isExpressionKeyPlaceholder = true;
              const keyType = effectiveKeyTypes[ki];
              const bytesMatch = keyType.match(/^bytes(\d+)$/);
              if (bytesMatch) {
                keyValues.push(new Uint8Array(parseInt(bytesMatch[1], 10)));
              } else if (keyType === 'bytes' || keyType === 'address') {
                // address is a variable-length locking bytecode (Uint8Array); the VM probe fills the real key
                keyValues.push(new Uint8Array(0));
              } else if (keyType === 'bool') {
                keyValues.push(false);
              } else {
                keyValues.push(0n);
              }
            }
          }
        }
        const keyValue = keyValues[0]; // backward compat: first key

        // Search entry NFT UTXOs for one whose commitment keys match.
        // For expression key placeholders, collect all parseable entries and pick
        // the right one: if exactly 1, use it; if multiple, treat as not found
        // (auto-derivation will resolve via VM trace with the correct entry).
        let matchingUtxo: typeof collectionEntries[0] | undefined;
        const isMultiKey = effectiveKeyTypes.length > 1;
        if (isExpressionKeyPlaceholder) {
          // Expression key: can't match by placeholder value. Try to derive the key
          // by hashing function arguments (common pattern: hash160(pubkey_param)).
          const { hash160: computeHash160 } = await import('@solidcash/utils');
          const derivedKeys: Uint8Array[] = [];
          for (const arg of args) {
            if (arg instanceof Uint8Array && (arg.length === 33 || arg.length === 65)) {
              // Looks like a pubkey -- try hash160
              derivedKeys.push(computeHash160(arg));
            }
          }

          // Try matching with derived keys first
          for (const utxo of collectionEntries) {
            if (!utxo.token?.nft?.commitment) continue;
            try {
              const parsed = isMultiKey
                ? parseEntryCommitmentMultiKey(
                  utxo.token.nft.commitment, effectiveKeyTypes, collection.valueType,
                  stateLayout.structs,
                )
                : parseEntryCommitment(
                  utxo.token.nft.commitment, collection.keyType, collection.valueType,
                  stateLayout.structs,
                );
              const entryKey = isMultiKey ? (parsed as any).keys[0] : (parsed as any).key;
              for (const dk of derivedKeys) {
                if (this._keysMatch(entryKey, dk, effectiveKeyTypes[0])) {
                  matchingUtxo = utxo;
                  // Update the placeholder key with the actual derived key
                  keyValues[0] = dk;
                  isExpressionKeyPlaceholder = false;
                  break;
                }
              }
              if (matchingUtxo) break;
            } catch {
              // Not a valid entry for this collection
            }
          }
          // If no match found: matchingUtxo stays undefined (new entry path).
        } else {
          for (const utxo of collectionEntries) {
            if (!utxo.token?.nft?.commitment) continue;
            try {
              if (isMultiKey) {
                const parsed = parseEntryCommitmentMultiKey(
                  utxo.token.nft.commitment, effectiveKeyTypes, collection.valueType,
                  stateLayout.structs,
                );
                if (parsed.keys.every((k, i) => this._keysMatch(k, keyValues[i], effectiveKeyTypes[i]))) {
                  matchingUtxo = utxo;
                  break;
                }
              } else {
                const parsed = parseEntryCommitment(
                  utxo.token.nft.commitment, collection.keyType, collection.valueType,
                  stateLayout.structs,
                );
                if (this._keysMatch(parsed.key, keyValue, collection.keyType)) {
                  matchingUtxo = utxo;
                  break;
                }
              }
            } catch {
              // Commitment doesn't parse for this collection -- skip
            }
          }
        }


        const exists = !!matchingUtxo;
        const entryUnlocker = createEntryNftUnlocker(
          this.inner, overrides?.blockBase ?? 0, this.categoryId, access.collection,
        );

        entryNfts.push({
          slotIndex,
          collection: access.collection,
          keyType: collection.keyType,
          valueType: collection.valueType,
          keyValue,
          ...(isMultiKey && { keyTypes: effectiveKeyTypes, keyValues }),
          exists,
          utxo: matchingUtxo ? { ...matchingUtxo, unlocker: entryUnlocker } : undefined,
        });
      }

      // A read followed by a write can authenticate two distinct sorted targets with the same original proof
      // NFT. The first physical lane remains the proof owner, but its read-only unlocker cannot authorize the
      // later lane's replacement outputs. Promote every copy of that shared proof to the write-authorized
      // unlocker whenever any logical lane backed by the proof writes; deduplication below may retain any copy.
      const writeUnlockerByProof = new Map<string, UnlockableUtxo['unlocker']>();
      for (const entry of entryNfts) {
        if (!entry.utxo || !entryOperations(entry.slotIndex).some(
          (operation) => operation === 'write' || operation === 'delete',
        )) continue;
        writeUnlockerByProof.set(
          `${entry.collection}:${entry.utxo.txid.toLowerCase()}:${entry.utxo.vout}`,
          entry.utxo.unlocker,
        );
      }
      for (const entry of entryNfts) {
        if (!entry.utxo) continue;
        const unlocker = writeUnlockerByProof.get(
          `${entry.collection}:${entry.utxo.txid.toLowerCase()}:${entry.utxo.vout}`,
        );
        if (unlocker) entry.utxo = { ...entry.utxo, unlocker };
      }

      const batchAliasOwners = new Map(runtimeEntryAliasOwners(entryNfts.map((entry) => ({
        slotIndex: entry.slotIndex,
        collection: entry.collection,
        priorSlots: [
          ...(entryAccessForSlot(entry.slotIndex)?.aliasCondDeleteSlot === undefined
            ? [] : [entryAccessForSlot(entry.slotIndex)!.aliasCondDeleteSlot!]),
          ...(entryAccessForSlot(entry.slotIndex)?.runtimeAliasPriorSlots ?? []),
          ...(entryAccessForSlot(entry.slotIndex)?.composeAliasPriorSlots ?? []),
        ],
        target: batchTargetSlots.has(entry.slotIndex)
          ? binToHex(batchTargetSlots.get(entry.slotIndex)!) : undefined,
        proof: entry.utxo ? `${entry.utxo.txid.toLowerCase()}:${entry.utxo.vout}` : undefined,
        operations: entryOperations(entry.slotIndex),
        inactive: inactiveMessageBusEntrySlots.has(entry.slotIndex),
      }))));
      const batchAliasSkips = new Set(batchAliasOwners.keys());
      for (const slotIndex of batchAliasSkips) runtimeMessageBusAliasSkipSlots.add(slotIndex);
      // A direct pure read whose proof node is the one its compiler-named prior slot spends reads that input; its
      // own input is funded instead of spending the node twice.
      for (const entry of entryNfts) {
        const prior = entryAccessForSlot(entry.slotIndex)?.sharedProofPriorSlot;
        const owner = prior === undefined ? undefined : entryNfts.find((candidate) => candidate.slotIndex === prior);
        if (!entry.utxo || !owner?.utxo || runtimeMessageBusAliasSkipSlots.has(owner.slotIndex)
          || entry.collection !== owner.collection) continue;
        if (`${entry.utxo.txid.toLowerCase()}:${entry.utxo.vout}`
          !== `${owner.utxo.txid.toLowerCase()}:${owner.utxo.vout}`) continue;
        runtimeMessageBusAliasSkipSlots.add(entry.slotIndex);
        entry.exists = false;
        entry.utxo = undefined;
      }
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ROUTE_ENTRY_PLAN === '1') {
        console.error('message-bus-route-entry-plan', entryNfts.map((entry) => ({
          slotIndex: entry.slotIndex,
          collection: entry.collection,
          keys: entryAccessForSlot(entry.slotIndex)?.keyParams,
          operations: entryOperations(entry.slotIndex),
          inactive: inactiveMessageBusEntrySlots.has(entry.slotIndex),
          targetSlot: batchTargetSlots.has(entry.slotIndex)
            ? binToHex(batchTargetSlots.get(entry.slotIndex)!) : undefined,
          key: entry.keyValue instanceof Uint8Array ? binToHex(entry.keyValue)
            : typeof entry.keyValue === 'bigint' ? entry.keyValue.toString() : entry.keyValue,
          exists: entry.exists,
          outpoint: entry.utxo ? `${entry.utxo.txid}:${entry.utxo.vout}` : undefined,
          commitment: entry.utxo?.token?.nft?.commitment,
          aliasOwner: batchAliasOwners.get(entry.slotIndex),
          aliasSkipped: batchAliasSkips.has(entry.slotIndex),
        })));
      }

      // A conditional delete whose key is absent spends the key's predecessor at its slot and keeps it. An
      // activity-settled body (DS-6) plans no transition for that delete, and its batch's writes settle alone; any
      // other body's guard skips the whole batch verifier there, so every batch takes the no-op witnesses.
      const softDeleteSlots = (entryAbiFunction?.blockLayout?.slots ?? [])
        .filter((slot) => slot.kind === 'entry' && slot.softDelete).map((slot) => slot.slotIndex);
      const absentSoftDelete = (slotIndex: number | undefined): boolean => {
        const commitment = slotIndex === undefined ? undefined
          : entryNfts.find((entry) => entry.slotIndex === slotIndex)?.utxo?.token?.nft?.commitment;
        return !!commitment && binToHex(decodeEntryCommitment(hexToBin(commitment)).slot)
          !== binToHex(batchTargetSlots.get(slotIndex!)!);
      };
      const settlesByActivity = settlesSortedTargetsByActivity(entryAbiFunction);
      const batchNoOp = !settlesByActivity && absentSoftDelete(softDeleteSlots[0]);

      // Atomic fixed-write batches: collapse logical accesses that share an original predecessor onto one physical
      // proof input. The block slot of the first logical owner carries that UTXO; later aliases receive funders and
      // point at the owner's relative block offset through __internal__vmapBatchProof_N.
      const batchWitnesses: unknown[] = [];
      let batchTrailingCount = 0;
      // Read-only dynamic chunks are preserved first in the trailing output region. Batch planning happens before
      // those witnesses are materialized below, so count them from the same deterministic addresses here.
      let preservedTrailingCount = 0;
      for (const iter of entryAbiFunction?.collectionIterations ?? []) {
        const collection = stateLayout.collections.find((candidate) => candidate.name === iter.collection);
        if (!collection) throw new Error(`Unknown collection: ${iter.collection}`);
        const address = getEntryNftAddress(this.inner, this.categoryId, collection.signature);
        preservedTrailingCount += (await this.inner.provider.getUtxos(address)).filter((u) =>
          u.token?.category === this.categoryId && u.token?.nft?.capability === 'mutable'
          && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0).length;
      }
      const dynamicWriteSet = new Set(entryAbiFunction?.dynamicWrites ?? []);
      for (const varName of new Set(entryAbiFunction?.dynamicReads ?? [])) {
        if (dynamicWriteSet.has(varName)) continue;
        const variable = stateLayout.variables.find((v) => v.name === varName && v.dynamic);
        if (!variable) continue;
        const address = getDynamicChunkAddress(this.inner, this.categoryId, variable.name, variable.type);
        preservedTrailingCount += (await this.inner.provider.getUtxos(address)).filter((u) =>
          u.token?.category === this.categoryId && u.token?.nft?.capability === 'mutable'
          && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0).length;
      }
      const entryLayout = entryAbiFunction?.blockLayout;
      // PredOut is an absolute OP_OUTPUT index. Direct calls use block base 0;
      // composed participants must start at their final aggregate output base.
      let batchPredOutputBase = (overrides?.blockBase ?? 0)
        + (entryLayout?.trailingBase ?? entryLayout?.blockSize ?? 1)
        + preservedTrailingCount;
      if (entryLayout?.trailingBase === undefined && returnEmitOutputIndex < 0
        && entryAbiFunction?.blockLayout?.slots.some((slot) => slot.kind === 'returnEvent')) {
        batchPredOutputBase -= 1;
      }
      for (const batch of entryAbiFunction?.sortedBatchInfo ?? []) {
        const collection = stateLayout.collections.find((c) => c.name === batch.collection);
        if (!collection) throw new Error(`Unknown vmap batch collection: ${batch.collection}`);
        const inactiveBatchSlots = new Set(batch.slotIndices.filter((slotIndex) =>
          inactiveMessageBusEntrySlots.has(slotIndex)));
        if (batch.linear && inactiveBatchSlots.size > 0) {
          throw new Error(`Linear vmap batch '${batch.collection}' cannot contain inactive message-bus slots`);
        }
        const noOpSlots = new Set(batchNoOp ? batch.slotIndices : batch.slotIndices.filter((slotIndex) => (
          settlesByActivity && softDeleteSlots.includes(slotIndex) && absentSoftDelete(slotIndex))));
        // DS-6: activity-settled targets whose nodes coincide spend that node once, at the slot of the target that
        // runs (`sortedNodeOwners`, else the first that is no alias skip: a swap-remove write whose key meets its
        // delete's runs nothing). The others are lent: their slot is funded and runs nothing. Listed writes all run on
        // the node: the first spends it and the others chain on it. An alias skip is no chain member. A lent delete
        // names the first owner's input, which it reads where it runs beside that write.
        const lentSlots = new Set<number>();
        const lentOwners = new Map<number, number>();
        // The default value tail a chained present delete nullifies its node to (DS-6); undefined keeps the
        // kind fail-closed (struct/array/enum/fn-ptr defaults are not statically planned here).
        const chainedDeleteDefaultTail = defaultSortedEntryValueTail(collection.valueType);
        if (settlesByActivity && batch.slotIndices.length > 1
          && batch.slotIndices.some((slotIndex) => softDeleteSlots.includes(slotIndex))) {
          const byNode = new Map<string, number[]>();
          for (const slotIndex of batch.slotIndices) {
            const spent = entryNfts.find((entry) => entry.slotIndex === slotIndex)?.utxo;
            const uid = spent ? `${spent.txid}:${spent.vout}` : undefined;
            if (uid !== undefined) byNode.set(uid, [...(byNode.get(uid) ?? []), slotIndex]);
          }
          for (const members of [...byNode.values()].filter((group) => group.length > 1)) {
            const listed = members.filter((slotIndex) => overrides?.sortedNodeOwners?.includes(slotIndex));
            const first = members.find((slotIndex) => !batchAliasSkips.has(slotIndex)) ?? members[0];
            const owners = listed.length > 0 ? listed : [first];
            if (overrides?.sortedNodeOwners === undefined) {
              sortedNodeOwnerAlternatives.push(...members.filter((member) => member !== first)
                .map((slotIndex) => ({ owners: [slotIndex] })));
              const memberWrites = members.filter((slotIndex) => !softDeleteSlots.includes(slotIndex)
                && !batchAliasSkips.has(slotIndex));
              if (memberWrites.length > 1) sortedNodeOwnerAlternatives.push({ owners: memberWrites });
              const present = members.filter((slotIndex) => softDeleteSlots.includes(slotIndex)
                && !noOpSlots.has(slotIndex));
              if (memberWrites.length > 0 && present.length > 0 && chainedDeleteDefaultTail !== undefined) {
                sortedNodeOwnerAlternatives.push({ owners: memberWrites, chainedDeletes: present });
              }
            }
            for (const slotIndex of members.filter((member) => !owners.includes(member))) {
              lentSlots.add(slotIndex);
              lentOwners.set(slotIndex, owners[0]);
              const entry = entryNfts.find((candidate) => candidate.slotIndex === slotIndex)!;
              entry.exists = false;
              entry.utxo = undefined;
              // A lent write leaves no node; a lent delete's slot has no entry, which drops its output already.
              if (!softDeleteSlots.includes(slotIndex)) runtimeMessageBusAliasSkipSlots.add(slotIndex);
            }
          }
        }
        if (noOpSlots.size === batch.slotIndices.length) {
          const noOpRows = batch.linear ? batch.slotIndices.map((slotIndex) => ({
            slotIndex, slot: batchTargetSlots.get(slotIndex)!, next: new Uint8Array(32),
          })).sort((a, b) => bytesToSlotValue(a.slot) < bytesToSlotValue(b.slot) ? -1 : 1) : [];
          const noOpRanks = new Map(noOpRows.map((row, rank) => [row.slotIndex, rank]));
          for (const slotIndex of batch.slotIndices) {
            const offset = entryAbiFunction!.blockLayout?.slots.find(
              (slot) => slot.kind === 'entry' && slot.slotIndex === slotIndex,
            )?.offset;
            if (offset === undefined) throw new Error(`vmap no-op slot has no block offset ${slotIndex}`);
            batchWitnesses.push(batchTargetSlots.get(slotIndex)!, BigInt(offset), new Uint8Array(32), -3n,
              ...(batch.linear ? [BigInt(noOpRanks.get(slotIndex)!)] : []));
          }
          if (batch.linear) batchWitnesses.push(Uint8Array.from(noOpRows.flatMap(
            (row) => [...row.slot, ...row.next],
          )));
          continue;
        }
        const collectionEntries = await collectionEntriesFor(collection.signature);
        const list = SortedList.fromUtxos(collectionEntries);
        // A physical route lane can be writable in the union ABI but read-only in this envelope. Its logical
        // key still authenticates membership/absence in the read opcode; topology settlement must preserve the
        // actual proof node instead of inserting the absent queried key as a new empty entry.
        const readOnlyBatchSlots = new Set(batch.slotIndices.filter((slotIndex) => {
          const operations = entryOperations(slotIndex);
          return operations.includes('read') && !operations.includes('write') && !operations.includes('delete');
        }));
        const settlementSlots = new Map(batch.slotIndices.map((slotIndex) => {
          const target = batchTargetSlots.get(slotIndex)!;
          const proof = readOnlyBatchSlots.has(slotIndex) ? list.find(target) ?? list.predecessorOf(target) : undefined;
          return [slotIndex, proof?.slot ?? target];
        }));
        const writes = batch.slotIndices
          .filter((slotIndex) => !batchAliasSkips.has(slotIndex) && !inactiveBatchSlots.has(slotIndex)
            && !readOnlyBatchSlots.has(slotIndex) && !noOpSlots.has(slotIndex) && !lentSlots.has(slotIndex))
          .map((slotIndex) => ({ slot: settlementSlots.get(slotIndex)!, value: new Uint8Array() }));
        if (writes.some((w) => !w.slot)) throw new Error(`vmap batch '${batch.collection}' is missing a target slot`);
        const plan = list.planBatchUpsert(writes);
        const targetValues = new Set(writes.map((w) => bytesToSlotValue(w.slot).toString()));
        for (const slotIndex of readOnlyBatchSlots) {
          if (batchAliasSkips.has(slotIndex) || inactiveBatchSlots.has(slotIndex)) continue;
          const slot = settlementSlots.get(slotIndex)!;
          const identity = bytesToSlotValue(slot).toString();
          targetValues.add(identity);
          if (plan.outputs.some((output) => bytesToSlotValue(output.slot).toString() === identity)) continue;
          const proof = list.find(slot)!;
          plan.outputs.push({ slot, commitment: encodeEntryCommitment(slot, proof.nextKey, proof.value), existed: true });
        }
        const predOutputs = plan.outputs.filter((o) => !targetValues.has(bytesToSlotValue(o.slot).toString()));
        // DS-6: a node a chained present delete ran on is relinked at its default value.
        for (const slotIndex of overrides?.sortedChainedDeletes ?? []) {
          if (!lentSlots.has(slotIndex)) continue;
          const deleted = bytesToSlotValue(batchTargetSlots.get(slotIndex)!);
          const at = predOutputs.findIndex((output) => bytesToSlotValue(output.slot) === deleted);
          if (at < 0) continue;
          const node = decodeEntryCommitment(predOutputs[at].commitment);
          predOutputs[at] = {
            ...predOutputs[at],
            commitment: encodeEntryCommitment(
              node.slot, node.nextKey, chainedDeleteDefaultTail ?? EMPTY_ENTRY_VALUE_TAIL,
            ),
          };
        }
        // An all-update batch has no rewritten predecessor suffix. Do not publish an empty
        // collection family: a routed counter loop may independently own non-empty rewritten
        // entries for the same collection, and zero-width metadata must not erase that plan.
        if (predOutputs.length > 0) {
          batchPredCommitments.set(batch.collection, predOutputs.map((o) => binToHex(o.commitment)));
        }
        // A standalone route with one physical slot keeps the scalar insertion layout even when several
        // source rows update that same cached key: P' occupies the fixed entry coordinate and NEW trails.
        // Graph-owned rows retain their complete batch topology; their predecessor trails unless the source
        // itself has one row. Multi-slot batches always reserve fixed TARGET coordinates.
        const batchSourceRows = ((entryAbiFunction as { messageBusRowArguments?: readonly {
          handler: { entryAccesses?: readonly { collection: string }[] };
        }[] }).messageBusRowArguments ?? []).filter((row) =>
          (row.handler.entryAccesses ?? []).some((access) => access.collection === batch.collection));
        const uniqueBatchTargets = new Set(
          batch.slotIndices
            .filter((slotIndex) => !batchAliasSkips.has(slotIndex) && !inactiveBatchSlots.has(slotIndex))
            .map((slotIndex) => binToHex(batchTargetSlots.get(slotIndex) ?? new Uint8Array())),
        );
        // The one-slot compiler layout can place its predecessor at the fixed entry coordinate. A kernel
        // union with inactive reserve lanes still has a multi-slot batch covenant: it requires the target
        // in the fixed slot and the rewritten predecessor in a separate trailing slot, even when one row ran.
        // The runtime route reports only the lanes its own selected rows use, so a union whose compiled batch
        // carries inactive reserve lanes projects to a single lane here. Read the compiled width from the
        // published route: the covenant's topology, not the runtime projection, decides the predecessor slot.
        const compiledBatchSlots = (entryArtifact.messageBus?.route?.sortedBatchInfo ?? [])
          .find((candidate) => candidate.collection === batch.collection)?.slotIndices.length
          ?? batch.slotIndices.length;
        const singleTargetRowBatch = compiledBatchSlots === 1 && batch.slotIndices.length === 1
          && predOutputs.length > 0
          && (batchSourceRows.length === 1
            || (batchSourceRows.length > 1 && overrides?.omitLocalFeeTail !== true))
          && uniqueBatchTargets.size === 1;
        const linearRows = batch.linear ? batch.slotIndices
          .filter((slotIndex) => !batchAliasSkips.has(slotIndex) && !noOpSlots.has(slotIndex)
            && !lentSlots.has(slotIndex))
          .map((slotIndex) => {
            const slot = batchTargetSlots.get(slotIndex)!;
            const out = plan.outputs.find((candidate) => bytesToSlotValue(candidate.slot) === bytesToSlotValue(slot));
            if (!out) throw new Error(`vmap batch '${batch.collection}' has no linear row for slot ${slotIndex}`);
            return { slotIndex, slot, next: decodeEntryCommitment(out.commitment).nextKey };
          })
          .sort((a, b) => bytesToSlotValue(a.slot) < bytesToSlotValue(b.slot) ? -1 : 1) : [];
        const linearRank = new Map(linearRows.map((row, rank) => [row.slotIndex, rank]));
        const firstLinearPredSlot = new Map<string, number>();
        for (const row of linearRows) {
          const proof = list.find(row.slot) ?? list.predecessorOf(row.slot);
          const proofSlot = bytesToSlotValue(proof.slot).toString();
          if (!firstLinearPredSlot.has(proofSlot)) firstLinearPredSlot.set(proofSlot, row.slotIndex);
        }
        const ownerByUtxo = new Map<string, number>();
        for (const slotIndex of batch.slotIndices) {
          // An absent delete and a lent target run no transition: each proof names its own slot, and a lent write
          // is inactive (-2). A lent delete names its node's owner (DS-6).
          if (noOpSlots.has(slotIndex) || lentSlots.has(slotIndex)) {
            const named = softDeleteSlots.includes(slotIndex) ? lentOwners.get(slotIndex) ?? slotIndex : slotIndex;
            const offset = entryAbiFunction!.blockLayout?.slots.find(
              (slot) => slot.kind === 'entry' && slot.slotIndex === named,
            )?.offset;
            if (offset === undefined) throw new Error(`vmap no-op slot has no block offset ${slotIndex}`);
            batchWitnesses.push(batchTargetSlots.get(slotIndex)!, BigInt(offset), new Uint8Array(32),
              softDeleteSlots.includes(slotIndex) ? -3n : -2n, ...(batch.linear ? [0n] : []));
            continue;
          }
          if (inactiveBatchSlots.has(slotIndex)) {
            // Sorted batches retain every bounded route lane so their hidden witness vector stays positional,
            // but an inactive selector/row lane is still a balanced funder slot. Its provisional key lookup can
            // resolve to a real entry or to a predecessor also used by an active lane; carrying that UTXO forward
            // spends the same state input twice even though the route gates this lane off before collection use.
            const inactive = entryNfts.find((entry) => entry.slotIndex === slotIndex);
            if (inactive) {
              inactive.exists = false;
              inactive.utxo = undefined;
            }
            const raw = this._rawVMapBatchWitness?.get(slotIndex);
            batchWitnesses.push(raw?.slot ?? batchTargetSlots.get(slotIndex)!, raw?.proof ?? 0n,
              raw?.next ?? new Uint8Array(32), raw?.predOut ?? -2n);
            continue;
          }
          if (batchAliasSkips.has(slotIndex)) {
            const ownerSlot = batchAliasOwners.get(slotIndex);
            if (ownerSlot === undefined) throw new Error(`vmap alias slot has no canonical owner ${slotIndex}`);
            // The target's logical owner can itself share an older predecessor proof. Its fixed input then
            // contains a funding pad, so aliases must inherit the physical proof owner, not the target offset.
            const ownerTarget = batchTargetSlots.get(ownerSlot)!;
            const ownerProof = list.find(ownerTarget) ?? list.predecessorOf(ownerTarget);
            const physicalOwner = ownerByUtxo.get(`${ownerProof.utxo.txid}:${ownerProof.utxo.vout}`) ?? ownerSlot;
            const ownerOffset = entryAbiFunction!.blockLayout?.slots.find(
              (slot) => slot.kind === 'entry' && slot.slotIndex === physicalOwner,
            )?.offset;
            if (ownerOffset === undefined) throw new Error(`vmap alias owner has no block slot ${ownerSlot}`);
            const raw = this._rawVMapBatchWitness?.get(slotIndex);
            // A compose alias row names its owner's planned successor; the covenant binds the two.
            const ownerOut = (entryAccessForSlot(slotIndex)?.composeAliasPriorSlots?.length ?? 0) > 0
              ? plan.outputs.find((o) => bytesToSlotValue(o.slot) === bytesToSlotValue(ownerTarget)) : undefined;
            batchWitnesses.push(raw?.slot ?? settlementSlots.get(ownerSlot)!, raw?.proof ?? BigInt(ownerOffset),
              raw?.next ?? (ownerOut ? decodeEntryCommitment(ownerOut.commitment).nextKey : new Uint8Array(32)),
              raw?.predOut ?? -2n, ...(batch.linear ? [raw?.rank ?? BigInt(linearRank.get(ownerSlot) ?? 0)] : []));
            continue;
          }
          const slot = settlementSlots.get(slotIndex)!;
          const proof = list.find(slot) ?? list.predecessorOf(slot);
          const uid = `${proof.utxo.txid}:${proof.utxo.vout}`;
          let owner = ownerByUtxo.get(uid);
          if (owner === undefined) { owner = slotIndex; ownerByUtxo.set(uid, owner); }
          if (owner !== slotIndex) {
            const duplicate = entryNfts.find((e) => e.slotIndex === slotIndex)!;
            duplicate.exists = false;
            duplicate.utxo = undefined;
          }
          const offset = entryAbiFunction!.blockLayout?.slots.find(
            (s) => s.kind === 'entry' && s.slotIndex === owner,
          )?.offset;
          if (offset === undefined) throw new Error(`vmap batch '${batch.collection}' has no block slot ${owner}`);
          const out = plan.outputs.find((o) => bytesToSlotValue(o.slot) === bytesToSlotValue(slot));
          if (!out) throw new Error(`vmap batch '${batch.collection}' has no planned output for slot ${slotIndex}`);
          if (readOnlyBatchSlots.has(slotIndex)) {
            batchTargetPlaceholders.set(slotIndex, binToHex(out.commitment));
            exactBatchTargetSlots.add(slotIndex);
            const raw = this._rawVMapBatchWitness?.get(slotIndex);
            batchWitnesses.push(raw?.slot ?? slot, raw?.proof ?? BigInt(offset),
              raw?.next ?? decodeEntryCommitment(out.commitment).nextKey, raw?.predOut ?? -1n,
              ...(batch.linear ? [raw?.rank ?? BigInt(linearRank.get(slotIndex)!)] : []));
            continue;
          }
          // Seed the fixed target output in native vmap form (slot || next || empty value). Do not pin it: the
          // derivation probe replaces the empty value with the covenant-computed value. Without this seed, a fresh
          // target falls through StatefulTransactionBuilder's generic default encoder, which is intentionally the
          // old key/value commitment format and cannot encode a 32-byte hashed slot as an int/address key.
          const batchAccess = entryAccessForSlot(slotIndex);
          if (!batchAccess) throw new Error(`vmap batch slot has no entry access ${slotIndex}`);
          // An aggregate kernel route owns physical entry slots, but its union access intentionally omits the
          // source handler's value expression. A promoted writer batch still uses the writer's source-local lane
          // ordinals, so recover that exact access (and its row arguments) before declaring the value unknown.
          // This keeps literal/argument-computable values exact while preserving trace completion for genuinely
          // runtime-built values.
          const routedSourceValueCandidates = selectedRouteRows.flatMap((row) => {
            const access = entryAccessAt(row.handler, slotIndex);
            return access?.collection === batch.collection
              && access.operations.includes('write')
              && access.valueSource !== undefined
              ? [{ access, args: row.args, inputs: row.handler.inputs }]
              : [];
          });
          // Direct delegate frames do not carry rowArguments. Their runtime ABI may still be a route-shaped
          // clone with union accesses, so recover source expressions from the immutable public handler ABI.
          const artifactSourceValueCandidates = routedSourceValueCandidates.length > 0 ? []
            : (entryArtifact.abi as readonly AbiFunction[]).flatMap((handler) => {
              if (handler.name !== entryAbiFunction?.name
                || (handler.selector && entryAbiFunction?.selector
                  && handler.selector.toLowerCase() !== entryAbiFunction.selector.toLowerCase())) return [];
              const access = entryAccessAt(handler, slotIndex);
              return access?.collection === batch.collection
                && access.operations.includes('write')
                && access.valueSource !== undefined
                ? [{ access, args: entryArgs, inputs: handler.inputs }]
                : [];
            });
          const sourceValueCandidates = routedSourceValueCandidates.length > 0
            ? routedSourceValueCandidates : artifactSourceValueCandidates;
          const sourceValue = sourceValueCandidates.length === 1 ? sourceValueCandidates[0] : undefined;
          const valueAccess = batchAccess.valueSource !== undefined ? batchAccess : sourceValue?.access ?? batchAccess;
          const valueArgs = [...(sourceValue?.args ?? entryArgs)];
          const valueInputs = sourceValue?.inputs ?? entryAbiFunction!.inputs;
          const entryDelta = valueAccess.valueSource?.match(
            /^binop:([+-])\(entry,(?:lit:(-?[0-9]+)|id:([A-Za-z_][\w]*))\)$/,
          );
          let resolvedWholeValue = valueAccess.valueSource && entryDelta === null
            && !valueAccess.valueSource.startsWith('loopLast:')
            && !valueAccess.valueSource.startsWith('new:')
            && !valueAccess.valueSource.startsWith('call:')
            && !valueAccess.valueSource.startsWith('arrset(')
            ? evalComputedKey(valueAccess.valueSource, valueArgs, valueInputs) : undefined;
          // A direct chunkable `valueParam` array/struct is a JS value `evalComputedKey` cannot frame (its `id:`
          // path only encodes scalar/bytes params), so encode it to the pushdata blob before the chunkable-tail
          // framing below. A bytes/string param is already a Uint8Array and is left as-is.
          if (resolvedWholeValue === undefined && collection.chunkableValue
            && valueAccess.valueParam !== undefined) {
            const vIdx = valueInputs.findIndex((input) => input.name === valueAccess.valueParam);
            const rawV = vIdx >= 0 ? valueArgs[vIdx] : undefined;
            if (rawV !== undefined && !(rawV instanceof Uint8Array)
              && (Array.isArray(rawV) || typeof rawV === 'object')) {
              try {
                resolvedWholeValue = encodePushdataValue(
                  rawV as StateValue, collection.valueType, stateLayout.structs,
                );
              } catch {
                resolvedWholeValue = undefined;
              }
            }
          }
          if (resolvedWholeValue === undefined) {
            const selectedRecipes = activeMessageBusEntryRecipes?.get(slotIndex)
              ?.filter((recipe) => recipe.access.operations.includes('write')) ?? [];
            for (const recipe of selectedRecipes) {
              const source = recipe.access.valueSource;
              if (source === undefined) continue;
              let next: Uint8Array | undefined;
              try {
                next = evalComputedKey(source, recipe.args, recipe.inputs);
              } catch {
                next = undefined;
              }
              if (next !== undefined) resolvedWholeValue = next;
            }
          }
          if (resolvedWholeValue === undefined && valueAccess.valueSource?.startsWith('loopLast:id:')) {
            const boundName = valueAccess.valueSource.slice('loopLast:id:'.length);
            const bound = valueArgs[valueInputs.findIndex((input) => input.name === boundName)];
            if (typeof bound === 'bigint' && bound > 0n) resolvedWholeValue = bigIntToVmNumber(bound - 1n);
          }
          if (resolvedWholeValue === undefined && (valueAccess.valueSource?.startsWith('new:')
            || valueAccess.valueSource?.startsWith('call:'))) {
            const constructed = valueAccess.valueSource.match(/^(?:new|call):([A-Za-z_][\w]*)\((.*)\)$/);
            if (constructed) {
              const splitTopLevel = (s: string): [string, string] | undefined => {
                let depth = 0;
                for (let i = 0; i < s.length; i += 1) {
                  if (s[i] === '(' || s[i] === '[' || s[i] === '{') depth += 1;
                  else if (s[i] === ')' || s[i] === ']' || s[i] === '}') depth -= 1;
                  else if (s[i] === ',' && depth === 0) return [s.slice(0, i), s.slice(i + 1)];
                }
                return undefined;
              };
              const parts: string[] = [];
              let rest = constructed[2];
              while (rest.length > 0) {
                const pair = splitTopLevel(rest);
                if (pair === undefined) {
                  parts.push(rest);
                  break;
                }
                parts.push(pair[0]);
                rest = pair[1];
              }
              const fields: bigint[] = [];
              let ok = true;
              let preservedStruct: Record<string, unknown> | undefined;
              let preservedStructResolved = false;
              const preservedField = (name: string): bigint | undefined => {
                if (!preservedStructResolved) {
                  preservedStructResolved = true;
                  preservedStruct = decodeInlineVmapStruct(
                    list.has(slot) ? list.find(slot)!.value : undefined,
                    list.has(slot),
                    collection.valueType,
                    collection.chunkableValue === true,
                    stateLayout.structs,
                  );
                }
                const fv = preservedStruct?.[name];
                if (typeof fv === 'bigint') return fv;
                if (typeof fv === 'boolean') return fv ? 1n : 0n;
                return undefined;
              };
              for (const part of parts) {
                const rewritten = substPreservedStructFields(part, batchAccess.collection, preservedField);
                const encoded = rewritten === undefined
                  ? undefined
                  : evalComputedKey(rewritten, valueArgs, valueInputs);
                const field = encoded === undefined
                  ? undefined : vmNumberToBigInt(encoded, { requireMinimalEncoding: false });
                if (typeof field !== 'bigint') {
                  ok = false;
                  break;
                }
                fields.push(field);
              }
              if (ok && fields.length === parts.length) {
                try {
                  resolvedWholeValue = encodePushdataValue(fields, collection.valueType, stateLayout.structs);
                } catch {
                  resolvedWholeValue = undefined;
                }
              }
            }
          }
          if (resolvedWholeValue === undefined && valueAccess.valueSource?.startsWith('arrset(')) {
            const inner = valueAccess.valueSource.slice('arrset('.length, -1);
            const splitTopLevel = (s: string): [string, string] | undefined => {
              let depth = 0;
              for (let i = 0; i < s.length; i += 1) {
                if (s[i] === '(' || s[i] === '[' || s[i] === '{') depth += 1;
                else if (s[i] === ')' || s[i] === ']' || s[i] === '}') depth -= 1;
                else if (s[i] === ',' && depth === 0) return [s.slice(0, i), s.slice(i + 1)];
              }
              return undefined;
            };
            const pair = splitTopLevel(inner);
            if (pair) {
              const idxEncoded = evalComputedKey(pair[0], valueArgs, valueInputs);
              const valEncoded = evalComputedKey(pair[1], valueArgs, valueInputs);
              const idx = idxEncoded === undefined
                ? undefined : vmNumberToBigInt(idxEncoded, { requireMinimalEncoding: false });
              const val = valEncoded === undefined
                ? undefined : vmNumberToBigInt(valEncoded, { requireMinimalEncoding: false });
              if (typeof idx === 'bigint' && typeof val === 'bigint' && idx >= 0n) {
                const current = decodeInlineVmapValue(
                  list.has(slot) ? list.find(slot)!.value : undefined,
                  list.has(slot),
                  collection.valueType,
                  collection.chunkableValue === true,
                  stateLayout.structs,
                );
                const n = Number(idx);
                if (Array.isArray(current) && Number.isSafeInteger(n) && n < current.length
                  && current.every((el) => typeof el === 'bigint')) {
                  const next = current.slice();
                  next[n] = val;
                  try {
                    resolvedWholeValue = encodePushdataValue(next, collection.valueType, stateLayout.structs);
                  } catch {
                    resolvedWholeValue = undefined;
                  }
                }
              }
            }
          }
          if (resolvedWholeValue === undefined && entryDelta) {
            const current = list.has(slot)
              ? vmNumberToBigInt(list.find(slot)!.value, { requireMinimalEncoding: false })
              : 0n;
            const rawDelta = entryDelta[2] !== undefined
              ? BigInt(entryDelta[2])
              : valueArgs[valueInputs.findIndex((input) => input.name === entryDelta[3])];
            if (typeof current === 'bigint' && typeof rawDelta === 'bigint') {
              resolvedWholeValue = bigIntToVmNumber(entryDelta[1] === '-' ? current - rawDelta : current + rawDelta);
            }
          }
          if (resolvedWholeValue === undefined && valueAccess.valueSource?.startsWith('ternary(')) {
            const inner = valueAccess.valueSource.slice('ternary('.length, -1);
            const splitTopLevel = (s: string): [string, string] | undefined => {
              let depth = 0;
              for (let i = 0; i < s.length; i += 1) {
                if (s[i] === '(' || s[i] === '[' || s[i] === '{') depth += 1;
                else if (s[i] === ')' || s[i] === ']' || s[i] === '}') depth -= 1;
                else if (s[i] === ',' && depth === 0) return [s.slice(0, i), s.slice(i + 1)];
              }
              return undefined;
            };
            const head = splitTopLevel(inner);
            const rest = head ? splitTopLevel(head[1]) : undefined;
            if (head && rest) {
              const condBytes = evalComputedKey(head[0], valueArgs, valueInputs);
              const taken = condBytes !== undefined && condBytes.length > 0;
              if (taken) {
                resolvedWholeValue = evalComputedKey(rest[0], valueArgs, valueInputs);
              } else if (rest[1].startsWith('map:') && list.has(slot)) {
                // Not-taken preserve: pin the current tail only when the key already exists. An absent
                // key must stay unminted (default 0 is not a zero-value insert).
                resolvedWholeValue = list.find(slot)!.value;
              }
            }
          }
          // A compose owner's node carries the value of its key's last write, which only the trace knows.
          if ([...batchAliasOwners].some(([alias, owner]) => owner === slotIndex
            && (entryAccessForSlot(alias)?.composeAliasPriorSlots?.length ?? 0) > 0)) resolvedWholeValue = undefined;
          let targetCommitment = out.commitment;
          if (resolvedWholeValue !== undefined) {
            const valueTail = collection.chunkableValue
              ? encodeChunkableValueTail(resolvedWholeValue)
              : resolvedWholeValue;
            targetCommitment = encodeEntryCommitment(
              slot, decodeEntryCommitment(out.commitment).nextKey, valueTail,
            );
          } else {
            // The handler builds this row's value (no reproducible parameter), so only the node's key and successor
            // link are known here. Register the lane so the value the covenant authenticates for that entry can
            // finish the tail: a compiler-authenticated production when one reaches this builder, otherwise the
            // trace-authenticated value. Leaving it unfinished makes the covenant reject its own TARGET node.
            pendingEntryValueTails.push({
              slotIndex,
              collection: batch.collection,
              slot,
              seed: binToHex(out.commitment),
              next: decodeEntryCommitment(out.commitment).nextKey,
              chunkable: collection.chunkableValue === true,
            });
            if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
              ?.SOLIDC_DEBUG_PENDING_VALUE_TAIL === '1') {
              console.error('pending-value-tail-register', JSON.stringify({
                functionName: entryAbiFunction?.name,
                collection: batch.collection, slotIndex, slot: binToHex(slot).slice(0, 16),
                chunkable: collection.chunkableValue === true,
                valueSource: valueAccess.valueSource,
                seedBytes: out.commitment.length, singleTargetRowBatch,
              }));
            }
          }
          batchTargetPlaceholders.set(slotIndex, binToHex(targetCommitment));
          if (resolvedWholeValue !== undefined) {
            const completePushIndex = materializeCompletePushValueWitness(
              entryAbiFunction!.inputs,
              entryArgs,
              slotIndex,
              resolvedWholeValue,
            );
            if (completePushIndex >= 0) {
              if (entryAbiFunction === abiFunction) finalArgs[completePushIndex] = resolvedWholeValue;
              if (entryCompilerRoute) {
                const name = entryAbiFunction!.inputs[completePushIndex]!.name;
                entryCompilerRoute.internalArgs = {
                  ...entryCompilerRoute.internalArgs,
                  [name]: resolvedWholeValue,
                };
              }
            }
            // The complete vmap node is known exactly. Batch verification authenticates the transition as a whole,
            // so generic OTC trace extraction can otherwise replace this value-bearing node with a structural
            // slot/next observation from the same output index.
            exactBatchTargetSlots.add(slotIndex);
          }
          const proofSlot = bytesToSlotValue(proof.slot).toString();
          const predOrdinal = predOutputs.findIndex((o) => bytesToSlotValue(o.slot).toString() === proofSlot);
          const firstLinearPred = !batch.linear || firstLinearPredSlot.get(proofSlot) === slotIndex;
          // The witness names the coordinate where THIS predecessor's rewritten node is published. A single-row
          // batch has no trailing predecessor lane: the predecessor is republished at the entry coordinate its
          // own co-spent NFT occupies, so the sentinel (-1) is not a readable output there - the route reads the
          // witness coordinate directly and an unset index aborts the VM with "invalid transaction output index".
          const proofOwner = entryNfts.find((candidate) => candidate.utxo !== undefined
            && proof.utxo !== undefined
            && candidate.utxo.txid === proof.utxo.txid && candidate.utxo.vout === proof.utxo.vout);
          const proofOwnerOffset = proofOwner === undefined ? undefined
            : entryAbiFunction!.blockLayout?.slots.find((candidate) =>
              candidate.kind === 'entry' && candidate.slotIndex === proofOwner.slotIndex)?.offset;
          const predOut = predOrdinal < 0 || !firstLinearPred
            ? -1n
            : singleTargetRowBatch
              ? proofOwnerOffset === undefined ? -1n : BigInt((overrides?.blockBase ?? 0) + proofOwnerOffset)
              : BigInt(batchPredOutputBase + predOrdinal);
          const raw = this._rawVMapBatchWitness?.get(slotIndex);
          if (raw?.proof === undefined && proof.utxo !== undefined) {
            topLevelVmapProofUtxos.set(slotIndex, { txid: proof.utxo.txid, vout: proof.utxo.vout });
          }
          batchWitnesses.push(raw?.slot ?? slot, raw?.proof ?? BigInt(offset),
            raw?.next ?? decodeEntryCommitment(out.commitment).nextKey, raw?.predOut ?? predOut,
            ...(batch.linear ? [raw?.rank ?? BigInt(linearRank.get(slotIndex)!)] : []));
        }
        if (batch.linear) batchWitnesses.push(
          batch.slotIndices.map((slot) => this._rawVMapBatchWitness?.get(slot)?.rows)
            .find((rows): rows is Uint8Array => rows !== undefined)
          ?? Uint8Array.from(linearRows.flatMap((row) => [...row.slot, ...row.next])),
        );
        batchPredOutputBase += predOutputs.length;
        batchTrailingCount += predOutputs.length;
        if (singleTargetRowBatch) {
          // The one shared trailing lane carries the target node this statement inserts.
          const target = batchTargetPlaceholders.get(batch.slotIndices[0]!);
          if (target !== undefined) batchPredCommitments.set(batch.collection, [target]);
        }
      }
      if ((entryAbiFunction?.sortedBatchInfo?.length ?? 0) > 0) batchWitnesses.push(BigInt(batchTrailingCount));
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_DYNAMIC_CHUNK_ORDER === '1') {
        console.error('vmap-batch-trailing-plan', JSON.stringify({
          functionName: entryAbiFunction?.name,
          batchTrailingCount,
          batchPredOutputBase,
          preservedTrailingCount,
          batches: (entryAbiFunction?.sortedBatchInfo ?? []).map((batch) => ({
            collection: batch.collection, linear: batch.linear === true, slots: batch.slotIndices,
            targetSlots: batch.slotIndices.map((slotIndex) =>
              binToHex(batchTargetSlots.get(slotIndex) ?? new Uint8Array()).slice(0, 16)),
            handlerManaged: batch.slotIndices.filter((slotIndex) =>
              (entryAbiFunction as { messageBusHandlerManagedEntrySlots?: readonly number[] })
                .messageBusHandlerManagedEntrySlots?.includes(slotIndex) === true),
            rows: ((entryAbiFunction as { messageBusRowArguments?: readonly {
              selector?: string; sourceCallsiteId?: number; sourceLogicalIndex?: number;
              handler: { name: string; entryAccesses?: readonly { collection: string; slotIndex?: number }[] };
            }[] }).messageBusRowArguments ?? [])
              .map((row, rowIndex) => ({ rowIndex, row }))
              .filter(({ row }) => (row.handler.entryAccesses ?? []).some((access) =>
                access.collection === batch.collection))
              .map(({ rowIndex, row }) => ({
                rowIndex,
                handler: row.handler.name,
                sourceCallsiteId: row.sourceCallsiteId,
                sourceLogicalIndex: row.sourceLogicalIndex,
                slots: (row.handler.entryAccesses ?? [])
                  .filter((access) => access.collection === batch.collection)
                  .map((access) => access.slotIndex),
              })),
          })),
        }));
      }
      const batchWitnessNames = (entryAbiFunction?.sortedBatchInfo ?? []).flatMap((batch) => [
        ...batch.slotIndices.flatMap((slotIndex) => [
          `__internal__vmapBatchSlot_${slotIndex}`,
          `__internal__vmapBatchProof_${slotIndex}`,
          `__internal__vmapBatchNext_${slotIndex}`,
          `__internal__vmapBatchPredOut_${slotIndex}`,
          ...(batch.linear ? [`__internal__vmapBatchRank_${slotIndex}`] : []),
        ]),
        ...(batch.linear ? [`__internal__vmapBatchRows_${batch.collection}`] : []),
      ]);
      if ((entryAbiFunction?.sortedBatchInfo?.length ?? 0) > 0) {
        batchWitnessNames.push('__internal__vmapBatchTrailingCount');
      }
      if (batchWitnessNames.length !== batchWitnesses.length) {
        throw new Error(
          `Internal error: function '${entryAbiFunction!.name}' derived ${batchWitnesses.length} vmap batch values `
          + `for ${batchWitnessNames.length} named witnesses.`,
        );
      }
      entryBatchWitnesses = new Map(batchWitnessNames.map((name, index) => [name, batchWitnesses[index]]));
      if (entryAbiFunction === abiFunction) {
        const positions = batchWitnessNames.map((name) =>
          abiFunction!.inputs.findIndex((input) => input.name === name));
        if (positions.some((position) => position < 0)) {
          const missing = batchWitnessNames.filter((_, index) => positions[index] < 0);
          throw new Error(
            `Internal error: function '${abiFunction!.name}' does not publish every derived vmap batch witness `
            + `(${missing.join(', ')}).`,
          );
        }
        // Hidden resource families do not necessarily form one contiguous suffix. In particular, a handler
        // which combines a counter-keyed runtime journal with a fixed invariant entry publishes
        //   permutation, runtime input/output counts, fixed-entry batch witnesses.
        // Appending the batch vector here shifted its slot/proof values into the still-unresolved count inputs,
        // then left `BatchNext` undefined. Materialize only through the last batch position with type-correct
        // sentinels and place every witness by its published ABI index. Later runtime-loop planning replaces the
        // intervening count sentinels in place; any resource family after this one can still append normally.
        const lastPosition = Math.max(...positions);
        while (finalArgs.length <= lastPosition) {
          const input = abiFunction!.inputs[finalArgs.length];
          if (!input?.name.startsWith('__internal__')) {
            throw new Error(
              'Internal error: cannot place vmap batch witnesses before unresolved user argument '
              + `'${input?.name ?? finalArgs.length}' in '${abiFunction!.name}'.`,
            );
          }
          finalArgs.push(defaultInternalFunctionArg(input));
        }
        batchWitnessNames.forEach((name, index) => {
          finalArgs[positions[index]] = entryBatchWitnesses.get(name);
        });
      }

      // Append the P5b value witnesses in slotIndex order (SymbolTable injects them right after blockhash, before
      // the iteration params - matching this position in finalArgs). Empty for short/absent, the full value for long.
      // When entry accesses come from a delegated facet, the witnesses belong to the facet ABI and are injected
      // while constructing its unlocker below; the split root ABI intentionally has no such hidden parameters.
      if (abiFunction?.inputs.some((input) => input.name.startsWith('__internal__valueWitness_'))) {
        const positions = abiFunction.inputs.flatMap((input, index) => {
          const match = /^__internal__valueWitness_(\d+)$/.exec(input.name);
          return match ? [{ ordinal: Number(match[1]), index }] : [];
        });
        const unresolved = [...valueWitnessBySlot.keys()].filter((ordinal) =>
          !positions.some((position) => position.ordinal === ordinal));
        if (unresolved.length > 0) {
          throw new Error(
            `Internal error: function '${abiFunction.name}' resolved value witnesses for entry slot(s) `
            + `${unresolved.join(', ')} which it publishes no ABI position for.`,
          );
        }
        for (const { ordinal, index: position } of positions) {
          while (finalArgs.length <= position) {
            const input = abiFunction.inputs[finalArgs.length];
            if (!input?.name.startsWith('__internal__')) {
              throw new Error(
                'Internal error: cannot place value witness before unresolved user argument '
                + `'${input?.name ?? finalArgs.length}' in '${abiFunction.name}'.`,
              );
            }
            finalArgs.push(defaultInternalFunctionArg(input));
          }
          finalArgs[position] = valueWitnessBySlot.get(ordinal) ?? new Uint8Array();
        }
      }
      entryValueWitnesses = valueWitnessBySlot;
    }

    // Alias-skip / delete-slot / entry locking-bytecode finalize
    const entryDeleteFinalized = finalizeCreateBuilderEntryDeleteSlotsImpl(
      {
        categoryId: this.categoryId,
        inner: this.inner,
        keysMatch: (...a: any[]) => (this as any)._keysMatch(...a),
      },
      {
        entryNfts,
        entryAccesses,
        entryAccessForSlot,
        entryOperations,
        runtimeMessageBusAliasSkipSlots,
        abiFunction,
        stateLayout,
      },
    );
    entryNfts = entryDeleteFinalized.entryNfts;
    const entryDeleteSlots = entryDeleteFinalized.entryDeleteSlots;
    const condSoftDeleteSlots = entryDeleteFinalized.condSoftDeleteSlots;
    const entryNftLockingBytecodes = entryDeleteFinalized.entryNftLockingBytecodes;
    // entry-delete-slots-complete (size-guarded; iteration-inputs follow)

    // Handle collection iteration + persisted dynamic-storage reads
    const iterationLoaded = await loadCreateBuilderIterationInputsImpl(
      {
        categoryId: this.categoryId,
        inner: this.inner,
        rawIterationKeysBlob: this._rawIterationKeysBlob,
        iterationKeys: this._iterationKeys,
        rawWindowUtxos: this._rawWindowUtxos,
        getState: () => this.getState(),
      },
      {
        abiFunction,
        entryAbiFunction,
        stateLayout,
        overrides,
        finalArgs,
      },
    );
    let iterationEntryInputs = iterationLoaded.iterationEntryInputs;
    const dynamicReadChunkInputs = iterationLoaded.dynamicReadChunkInputs;
    finalArgs = iterationLoaded.finalArgs;
    const dynamicReads = iterationLoaded.dynamicReads;
    // iteration-inputs-complete (size-guarded; vmap insert-loop derivation follows)

    // vmap diff-key INSERT loop derivation: `for(i<arr.length) m[...fixed][arr[i]] = v`. Co-spend the N bracketing
    // predecessors (iterationEntryInputs, in loop order -> input[master+blockSize+i]) and emit N interleaved (P', NEW)
    // commitment pairs at the trailing loop-entry outputs (output[master+blockSize+2i / +2i+1]). Both are known
    // EXACTLY from the off-chain sorted list (SortedList.planInsert); the covenant pins them, so no trace derivation.
    // Transaction-local scalar journal carriers allow later rows to update or extend an earlier row's output.
    // Unsupported removal, aggregate, and dynamic-value shapes remain fail-closed below.
    let sortedLoopCommitments = new Map<string, string[]>();
    let insertLoopPredecessors: UnlockableUtxo[] = [];
    // Existing fixed-width scalar records are co-spent and assigned one output at first touch. Later kernel rows
    // update that same eventual commitment in source order; the route covenant carries the value between rows and
    // verifies the one final output. Topology-changing and aggregate values never enter this table.
    type RuntimeJournalPendingScalar = {
      value: bigint; commitments: string[]; commitmentIndex: number; slot: Uint8Array; nextKey: Uint8Array;
      /** Present only for deferred carrier materialization; aliases the retained intent's producer vector. */
      producers?: KernelEntryJournalDirtyFinalBodyCandidate['producer'][];
    };
    const runtimeJournalPendingScalar = new Map<string, RuntimeJournalPendingScalar>();
    let hasPendingExistingScalarSettlement = false;
    const runtimeLoopEntrySegments: Array<{
      rowIndex: number; collection: string; offset: number; count: number;
    }> = [];
    let kernelJournalSettlementEntrySegments: Array<{
      collection: string; offset: number; count: number;
    }> | undefined;
    let kernelJournalSettlementOutputPlan: Array<{
      recordOrdinal: number; outputOrdinal: number; collection: string; offset: number;
    }> | undefined;
    let kernelJournalEagerOutputPlan: Array<{
      eagerOutputOrdinal: number; collection: string; offset: number;
    }> | undefined;
    const runtimeJournalInputIds = new Set<string>();
    /**
     * A handler describes its physical journal effects while it is traversed.  The legacy materializer below
     * deliberately drains those descriptions at the end of that handler for now, preserving its established
     * input/output geometry.  Keeping description and materialization distinct is the seam used by a later
     * transaction-wide carrier topology planner; it must not be mistaken for an enabled carrier capability.
     */
    type RuntimeJournalMaterializationIntent =
      | { kind: 'input'; input: UnlockableUtxo; collection: string }
      | { kind: 'outputs'; collection: string; commitments: string[];
        stream?: { handlerSelector: string; journalAccessStreamIndex: number };
        materializedOffset?: number;
        /** Exact access/record-role producer for each commitment, retained in the same vector order. */
        producers?: KernelEntryJournalDirtyFinalBodyCandidate['producer'][] };
    const runtimeJournalMaterializationIntents: RuntimeJournalMaterializationIntent[] = [];
    const captureRuntimeJournalInputIntent = (
      input: UnlockableUtxo, collection: string, allowExistingScalarReuse = false,
    ): boolean => {
      const id = `${input.txid}:${input.vout}`;
      if (runtimeJournalInputIds.has(id)) {
        // In the capability-gated path, topology is retained until global record ordinals exist. The unified
        // planner, not this early discovery walk, then decides whether the second logical access is a zero-auth
        // consumer. Keep the first physical witness as the canonical candidate.
        if (allowExistingScalarReuse || deferRuntimeJournalMaterialization) return false;
        throw new Error(
          `Message-bus runtime mapping rows overlap the '${collection}' pre-state journal at ${id}; `
          + 'a read-your-writes transition is required.',
        );
      }
      runtimeJournalInputIds.add(id);
      runtimeJournalMaterializationIntents.push({ kind: 'input', input, collection });
      return true;
    };
    const captureRuntimeJournalOutputIntent = (
      collection: string,
      commitments: string[],
      producers?: KernelEntryJournalDirtyFinalBodyCandidate['producer'][],
      stream?: { handlerSelector: string; journalAccessStreamIndex: number },
    ): void => {
      if (producers !== undefined && producers.length !== commitments.length) {
        throw new Error('Kernel journal output commitments and producer identities have different cardinality.');
      }
      runtimeJournalMaterializationIntents.push({ kind: 'outputs', collection, commitments, producers, stream });
    };
    const materializeLegacyRuntimeJournalIntents = (start: number): void => {
      if (deferRuntimeJournalMaterialization) return;
      for (const intent of runtimeJournalMaterializationIntents.slice(start)) {
        if (intent.kind === 'input') {
          insertLoopPredecessors.push(intent.input);
          continue;
        }
        const prior = sortedLoopCommitments.get(intent.collection) ?? [];
        const offset = prior.length;
        if (intent.materializedOffset !== undefined) {
          throw new Error('Kernel journal eager output intent was materialized more than once.');
        }
        intent.materializedOffset = offset;
        const merged = [...prior, ...intent.commitments];
        sortedLoopCommitments.set(intent.collection, merged);
        for (const pending of runtimeJournalPendingScalar.values()) {
          if (pending.commitments === prior) {
            pending.commitments = merged;
          } else if (pending.commitments === intent.commitments) {
            pending.commitments = merged;
            pending.commitmentIndex += offset;
          }
        }
      }
    };
    {
      const sortedInsertLoaded = await loadCreateBuilderSortedInsertLoopsImpl(
        {
          categoryId: this.categoryId,
          inner: this.inner,
        },
        {
          entryAbiFunction,
          stateLayout,
          overrides,
          entryArgs,
          finalArgs,
          iterationEntryInputs,
          sortedLoopCommitments,
          insertLoopPredecessors,
        },
      );
      sortedLoopCommitments = sortedInsertLoaded.sortedLoopCommitments;
      insertLoopPredecessors = sortedInsertLoaded.insertLoopPredecessors;
      iterationEntryInputs = sortedInsertLoaded.iterationEntryInputs;
      finalArgs = sortedInsertLoaded.finalArgs;
    }
    // sorted-insert-loops-complete (size-guarded; per-iteration UPDATE loop follows)

    // vmap per-iteration UPDATE loop `for(i) m[k[i]] += v[i]` (multitransfer credit to EXISTING recipients): co-spend
    // each k[i]'s existing entry at input[master+blockSize+i] and mint its updated commitment slot|next|(old op v[i])
    // at output[master+blockSize+i]. Both known EXACTLY off-chain (SortedList.find + arithmetic) - the covenant pins
    // them. A recipient with NO existing entry throws (insert-in-loop is a separate covenant); the shared v[] param
    // ties the credit total to the debit so supply is conserved.
    const routeRowIndex = (row: RouteExpressionKeyRow): number => {
      // A delegated root can carry both a proxy route and one or more implementation routes. The selected row
      // belongs to exactly one of those frames; preferring a defined-but-unrelated proxy array returns -1 and
      // makes runtime effects in the implementation appear unpositioned. Resolve identity within each owner.
      const routeFrames = [
        (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)?.messageBusRowArguments,
        entryCompilerRoute?.rowArguments,
        ...(overrides?.calls ?? []).flatMap((call) => call.type === 'stateful' && call.compilerRoute
          ? [call.compilerRoute.rowArguments] : []),
      ];
      for (const rows of routeFrames) {
        const index = rows?.findIndex((candidate) => candidate === row) ?? -1;
        if (index >= 0) return index;
      }
      return -1;
    };
    const selectedRowArgument = (row: RouteExpressionKeyRow, name: string): unknown => {
      if (name.startsWith('__internal__')) return row.internalArgs?.[name];
      const inputs = visibleHandlerInputs(row.handler.inputs);
      const index = inputs.findIndex((input) => input.name === name);
      return index < 0 ? undefined : row.args[index];
    };
    const runtimeKernelJournalStreams: Array<{
      collection: string;
      collectionHash: Uint8Array;
      frameIndex: number;
      executionGroup: number;
      executionOrder: number;
      accessStreamIndex: number;
      settlementIdentity?: SortedUpsertLoopAbi['settlementIdentity'];
      /** Source-loop occurrences which consume each compact access. These deliberately remain in selected-frame
       * order when the key permutation is sorted/reordered: source frame i executes the next physical key, so the
       * occurrence pairs with the compact access position, not with the key's pre-permutation logical identity. */
      sourceOccurrences?: number[];
      list: SortedList;
      writes: Array<{ slot: Uint8Array; operation: KernelEntryJournalTopologyOperation }>;
      publish: (encoded: Uint8Array) => void;
    }> = [];
    const runtimeLoopsByCollection = new Map<string, Array<(typeof upsertPlanningFrames)[number]>>();
    for (const frame of upsertPlanningFrames) {
      for (const info of frame.abiFunction.sortedUpsertLoopInfo ?? []) {
        const frames = runtimeLoopsByCollection.get(info.collection) ?? [];
        // One handler may declare multiple upsert loops on the same collection
        // (updateJobWhitelist add+remove). Deduplicate by frame identity so that
        // pattern is not treated as cross-transaction concurrent journals.
        if (!frames.includes(frame)) frames.push(frame);
        runtimeLoopsByCollection.set(info.collection, frames);
      }
    }
    for (const [collection, frames] of runtimeLoopsByCollection) {
      if (frames.length < 2) continue;
      const inputName = vmapRuntimeInputCountName(collection);
      const outputName = vmapRuntimeOutputCountName(collection);
      const unthreaded = frames.some((frame) => (
        !frame.abiFunction.inputs.some((input) => input.name === inputName)
        || !frame.abiFunction.inputs.some((input) => input.name === outputName)
      ));
      if (!unthreaded) continue;
      const rows = [...new Set(frames.flatMap((frame) => (
        frame.row === undefined ? [] : [routeRowIndex(frame.row)]
      )))];
      const rowDescription = rows.length > 0 ? `Message-bus rows ${rows.join(', ')}` : 'Runtime loops';
      throw new Error(
        `${rowDescription} both mutate the '${collection}' runtime journal, but at least one loop form `
        + 'does not support threaded collection cardinality; split the loops into separate transactions.',
      );
    }
    const runtimeLoopCardinality = new Map<string, { inputs: number; outputs: number }>();
    const addRuntimeLoopCardinality = (collection: string, inputs: number, outputs: number): void => {
      const prior = runtimeLoopCardinality.get(collection) ?? { inputs: 0, outputs: 0 };
      runtimeLoopCardinality.set(collection, {
        inputs: prior.inputs + inputs,
        outputs: prior.outputs + outputs,
      });
    };
    for (const [upsertFrameIndex, upsertFrame] of upsertPlanningFrames.entries()) {
      const loopAbiFunction = upsertFrame.abiFunction;
      const loopArgs = upsertFrame.args;
      const replaceLoopArgument = (index: number, value: FunctionArgument): void => {
        if (upsertFrame.routed) {
          const input = loopAbiFunction.inputs[index];
          if (!input?.name.startsWith('__internal__')) {
            throw new Error(
              `Message-bus runtime loop in '${loopAbiFunction.name}' requires public argument reordering; `
              + 'split this invocation into an order already accepted by the collection topology.',
            );
          }
          const mutableInternal = upsertFrame.row!.internalArgs as Record<string, FunctionArgument>;
          mutableInternal[input.name] = value;
          const routeIndex = entryAbiFunction!.inputs.findIndex((candidate) => candidate.name === input.name);
          if (routeIndex < 0) {
            throw new Error(`Message-bus route is missing compiler-owned loop argument '${input.name}'`);
          }
          const rowIndex = routeRowIndex(upsertFrame.row!);
          if (rowIndex < 0) throw new Error('Message-bus runtime loop row is missing from its route frame');
          const current = entryArgs[routeIndex];
          const routeValue = Array.isArray(current) ? [...current] : [];
          while (routeValue.length <= rowIndex) routeValue.push([]);
          routeValue[rowIndex] = value;
          entryArgs[routeIndex] = routeValue;
          if (entryCompilerRoute) {
            entryCompilerRoute.internalArgs = {
              ...entryCompilerRoute.internalArgs,
              [input.name]: routeValue,
            };
          } else {
            args[routeIndex] = routeValue;
            finalArgs[routeIndex] = routeValue;
          }
          return;
        }
        loopArgs[index] = value;
        finalArgs[index] = value;
      };
      let loopPredicateState: Record<string, unknown> = onChainState.state;
      for (const info of loopAbiFunction.sortedUpsertLoopInfo ?? []) {
        const domainKeys = await resolveCreateBuilderUpsertLoopDomainKeysImpl(
          {
            categoryId: this.categoryId,
            inner: this.inner,
            signer: this._signer,
            hydrateExternalPredicateState: (...a: any[]) => (this as any)._hydrateExternalPredicateState(...a),
            evaluateExternalExpression: (...a: any[]) => (this as any)._evaluateExternalExpression(...a),
            vmapCounterDomain: (...a: any[]) => (this as any)._vmapCounterDomain(...a),
          },
          {
            info,
            loopAbiFunction,
            upsertFrame,
            loopArgs,
            entryArtifact,
            stateLayout,
            onChainState,
            loopPredicateState,
            executionSelfAddress,
            insertLoopPredecessorsLength: insertLoopPredecessors.length,
            runtimeJournalMaterializationIntentsLength: runtimeJournalMaterializationIntents.length,
            selectedRowArgument,
            replaceLoopArgument,
          },
        );
        if (domainKeys.skipped) continue;
        const {
          collection,
          list,
          entryAddr,
          argOf,
          visibleInputs,
          conditionArgs,
          valueTraceDomain,
          sourceOccurrences,
          selectedSourceValues,
          keyTypes,
          encKey,
          keyExpressions,
          varyingKeyIndexSet,
          fixedKeyIndices,
          fixedBins,
          runtimeFiltered,
          runtimeInputStart,
          runtimeJournalIntentStart,
        } = domainKeys;
        let keysArr = domainKeys.keysArr;
        loopPredicateState = domainKeys.loopPredicateState;
        // upsert-loop-domain-keys-complete (size-guarded; counter-step / topology follow)

        const keyTopology = await prepareCreateBuilderUpsertLoopKeyTopologyImpl(
          {
            signer: this._signer,
            vmapCounterStep: (...a: any[]) => (this as any)._vmapCounterStep(...a),
            hydrateExternalPredicateState: (...a: any[]) => (this as any)._hydrateExternalPredicateState(...a),
            evaluateExternalExpression: (...a: any[]) => (this as any)._evaluateExternalExpression(...a),
          },
          {
            info,
            loopAbiFunction,
            entryArtifact,
            entryArgs,
            loopArgs,
            conditionArgs,
            visibleInputs,
            loopPredicateState,
            executionSelfAddress,
            keysArr,
            keyExpressions,
            fixedBins,
            keyTypes,
            encKey,
            fixedKeyIndices,
            varyingKeyIndexSet,
            collection,
            valueTraceDomain,
            selectedSourceValues,
            sourceOccurrences,
            argOf,
            replaceLoopArgument,
          },
        );
        keysArr = keyTopology.keysArr;
        loopPredicateState = keyTopology.loopPredicateState;
        const counterSpec = keyTopology.counterSpec;
        const occurrenceOf = keyTopology.occurrenceOf;
        const valueTrace = keyTopology.valueTrace;
        const slotForKey = keyTopology.slotForKey;
        const isDelete = keyTopology.isDelete;
        // upsert-loop-key-topology-complete (size-guarded; value materialization follows)

        // A loop-INVARIANT value (fixed-amount airdrop `+= amount` / batch-set-const `= 100`): the same amount for every
        // key, from a scalar param arg or an int literal. Otherwise the value is the per-key array valsArr[i].
        const toBig = (v: unknown): bigint => (typeof v === 'bigint' ? v : BigInt(v as number | string));
        // A rawbytes VALUE (whole bytes/string/array/bytesN param `m[k[i]] = a`): the covenant stores the value tail
        // (len4 ++ value inline for a chunkable type, verbatim for bytesN); the SDK mirrors it. Only op==='set' reaches
        // here for rawbytes (the guard gates RMW/const to int). scalarTail is the invariant value's on-chain bytes.
        // On-chain value bytes for a rawbytes value.
        const encodeValueTail = (v: unknown): Uint8Array => {
          const vB = v instanceof Uint8Array ? v
            : typeof v === 'string' ? utf8ToBin(v)
              : encodePushdataValue(v as StateValue, collection.valueType, stateLayout.structs);
          if (!collection.chunkableValue) return vB; // fixed rawbytes (bytesN/address): stored verbatim, no tail
          return encodeChunkableValueTail(vB);
        };
        const rawValueBytes = (v: unknown): Uint8Array => v instanceof Uint8Array ? v
          : typeof v === 'string' ? utf8ToBin(v)
            : encodePushdataValue(v as StateValue, collection.valueType, stateLayout.structs);
        const rawScalar = !isDelete && info.valueScalarParam !== undefined ? argOf(info.valueScalarParam) : undefined;
        const isRawbytesVal = rawScalar !== undefined
        && typeof rawScalar !== 'bigint' && typeof rawScalar !== 'boolean' && typeof rawScalar !== 'number';
        const scalarTail: Uint8Array | undefined = isRawbytesVal ? encodeValueTail(rawScalar) : undefined;
        let scalarAmt: bigint | undefined;
        if (!isRawbytesVal && !isDelete && info.valueScalarParam !== undefined) {
          scalarAmt = toBig(argOf(info.valueScalarParam));
        } else if (!isRawbytesVal && !isDelete && info.valueConst !== undefined) scalarAmt = BigInt(info.valueConst);
        let perKey = !isRawbytesVal && !isDelete && scalarAmt === undefined;
        let valsArr = perKey ? argOf(info.valueArrayParam) : undefined;
        if (Array.isArray(valsArr) && info.valueArrayIndexParam) {
          const sourceValues = valsArr as unknown[];
          const logicalIndices = info.valueArrayIndexParam === info.varyingArrayParam
            ? keysArr : argOf(info.valueArrayIndexParam);
          if (!Array.isArray(logicalIndices)) {
            throw new Error(`vmap upsert loop ${info.collection}: value index array `
            + `'${info.valueArrayIndexParam}' is missing`);
          }
          valsArr = logicalIndices.map((logicalIndex) => {
            const numeric = typeof logicalIndex === 'bigint' ? logicalIndex : BigInt(logicalIndex as number | string);
            const index = Number(numeric);
            if (!Number.isSafeInteger(index) || index < 0 || index >= sourceValues.length) {
              throw new Error(`vmap upsert loop ${info.collection}: value index ${numeric} is out of bounds`);
            }
            return sourceValues[index];
          });
        }
        if (valueTrace) {
          valsArr = keysArr.map((key) => valueTrace![occurrenceOf(key)]);
          perKey = true;
        }
        if (info.valueRuntimeExpression) {
        // Counter-affine `i` / `i+K` publishes valueArrayOffset while keeping the on-script runtime expression.
        // Seed from the key vector so the shared offset pass below materializes concrete commitment tails —
        // required for mixed int+bytes compose where OTC derivation alone does not settle the scalar stream.
          if (info.valueArrayOffset !== undefined
          && /^(?:u?int\d*|u?fixed\d*x\d*|bigint)$/.test(collection.valueType)) {
            valsArr = keysArr.map((key) => toBig(key));
          } else {
          // The first VM probe only needs a correctly typed placeholder; trace derivation replaces its commitment
          // with the value computed by the row. A numeric zero is not encodable as a struct/array and made direct
          // structural RMWs fail before the verifier could derive their real outputs.
            valsArr = keysArr.map(() => getDefaultStateValue(collection.valueType, stateLayout.structs));
          }
          perKey = true;
          runtimeExpressionLoopCollections.add(info.collection);
        }
        if (Array.isArray(valsArr) && info.valueArrayOffset !== undefined) {
          valsArr = (valsArr as unknown[]).map((v) => toBig(v) + BigInt(info.valueArrayOffset!));
        }
        if (info.oldValuesWitnessParam?.startsWith(VMAP_COUNTER_OLD_PREFIX)) {
          const witnessIndex = loopAbiFunction.inputs.findIndex(
            (input) => input.name === info.oldValuesWitnessParam,
          );
          if (witnessIndex < 0) {
            throw new Error(`vmap runtime expression loop ${info.collection}: missing old-value witness ABI input`);
          }
          // A routed nested-key RMW authenticates an existing entry value, but its current fixed-prefix settlement
          // cannot materialize a missing selected entry as an insertion. Fail before transaction construction rather
          // than publishing a route which verifies yet omits the requested post-state. Direct execution and the
          // proven single-key/default-value route retain their existing insertion semantics.
          if (upsertFrame.routed && info.op !== 'read' && info.fixedKeyParams.length > 0
          && keysArr.some((key) => !list.find(slotForKey(key)))) {
            throw new Error(`vmap runtime expression loop ${info.collection}: `
            + 'selected absent old-value witness cannot be materialized as an insertion');
          }
          const oldValues = await Promise.all(keysArr.map(async (key) => {
            const slot = slotForKey(key);
            const entry = list.find(slot);
            if (collection.valueType === 'bool') return entry
              ? vmNumberToBigInt(entry.value, { requireMinimalEncoding: false }) !== 0n
              : false;
            const structuredValue = collection.chunkableValue
            || stateLayout.structs?.some((struct) => struct.name === collection.valueType);
            if (structuredValue) {
              if (!entry) return getDefaultStateValue(collection.valueType, stateLayout.structs);
              const tail = entry.value;
              if (tail.length < 4) {
                throw new Error(`vmap runtime struct value for ${info.collection} has an invalid tail`);
              }
              const len = tail[0] | (tail[1] << 8) | (tail[2] << 16) | (tail[3] << 24);
              let raw: Uint8Array;
              if (len <= 60) {
                raw = tail.slice(4, 4 + len);
              } else {
                const root = tail.slice(4, 36);
                const headData = tail.slice(36, 64);
                const chunkAddr = getValueChunkAddress(this.inner, this.categoryId, info.collection, slot, root);
                const chunks = (await this.inner.provider.getUtxos(chunkAddr))
                  .filter((utxo) => utxo.token?.category === this.categoryId
                  && !!utxo.token?.nft?.commitment && utxo.token.nft.commitment.length > 0)
                  .map((utxo) => parseValueChunkCommitment(utxo.token!.nft!.commitment))
                  .sort((left, right) => left.chunkIndex - right.chunkIndex);
                raw = joinValueChunks(headData, chunks, len);
                if (binToHex(sha256Sync(raw)) !== binToHex(root)) {
                  throw new Error('vmap runtime struct value chunks do not match the authenticated root');
                }
                if (info.op !== 'read') {
                  valueChunkGc.push({
                    collection: info.collection, slotHex: binToHex(slot), oldDigestHex: binToHex(root),
                  });
                }
              }
              // Chunkable entry tails store bytes/string payloads verbatim. Structs and arrays retain their
              // recursive pushdata framing, but feeding a raw string payload (for example `hello`) to the generic
              // decoder interprets its first character as an opcode and rejects an otherwise authenticated value.
              if (collection.valueType === 'bytes') return raw;
              if (collection.valueType === 'string') return binToUtf8(raw);
              return decodePushdataValue(raw, 0, collection.valueType, stateLayout.structs).value;
            }
            if (!/^(?:u?int\d*|u?fixed\d*x\d*|bigint)$/.test(collection.valueType)) {
              return entry?.value ?? getDefaultStateValue(collection.valueType, stateLayout.structs);
            }
            return entry
              ? vmNumberToBigInt(entry.value, { requireMinimalEncoding: false }) as bigint
              : 0n;
          }));
          if (info.op === 'read' && counterSpec && info.oldValuesWitnessDomain === 'selected-source'
          && !info.sourceOrderIndexParam) {
          // A path-conditioned source-order consumer has no occurrence on untaken frames. Keep this witness
          // compact and restore source order after the entry planner's physical slot sort.
            const selectedValues = keysArr.map((key, index) => ({
              occurrence: occurrenceOf(key), value: oldValues[index],
            })).sort((left, right) => left.occurrence - right.occurrence).map(({ value }) => value);
            replaceLoopArgument(witnessIndex, selectedValues as FunctionArgument);
          } else if (info.op === 'read' && counterSpec && info.oldValuesWitnessDomain === 'selected-source') {
          // The inverse permutation authenticates source-order selection independently, so retain the old-value
          // witness in the same physical slot order used by the synthetic read stream.
            replaceLoopArgument(witnessIndex, oldValues as FunctionArgument);
          } else if (info.op === 'read' && counterSpec) {
          // Cross-mapping reads may use a different physical permutation than their destination. Publish the
          // authenticated values by logical source occurrence so each stream can select the same value through its
          // own permutation. Unselected positions are never consumed, but must retain an ABI-encodable typed value.
            const witnessLength = valueTraceDomain?.length
            ?? keysArr.reduce<number>((length, key) => Math.max(length, occurrenceOf(key) + 1), 0);
            const logicalValues = Array.from(
              { length: witnessLength },
              () => getDefaultStateValue(collection.valueType, stateLayout.structs),
            );
            keysArr.forEach((key, index) => { logicalValues[occurrenceOf(key)] = oldValues[index]; });
            replaceLoopArgument(witnessIndex, logicalValues as FunctionArgument);
          } else {
            replaceLoopArgument(witnessIndex, oldValues as FunctionArgument);
          }
          if (info.op === 'read') {
            valsArr = oldValues;
            perKey = true;
          }
        }
        if (info.valueRuntimeExpression && collection.chunkableValue) {
        // One speculative run per concrete storage identity lets derivation distinguish several long values in
        // the same loop, while short iterations naturally shed their empty placeholder at convergence.
          for (const key of keysArr) addComputedValueChunkRun(info.collection, slotForKey(key));
        }
        // Per-key RAWBYTES value `m[k[i]] = vs[i]` (vs a bytes[]/array-of-array param): each vs[i] is committed as its own
        // inline tail. Detected from the arg (an empty array does no work). op is always 'set' here (the guard gates it).
        let perKeyRawbytes = perKey && Array.isArray(valsArr) && (valsArr as unknown[]).length > 0
        && ((): boolean => {
          const v0 = (valsArr as unknown[])[0];
          return !(typeof v0 === 'bigint' || typeof v0 === 'number' || typeof v0 === 'boolean');
        })();
        // Value bytes for a commitment: the per-key/invariant rawbytes tail (already a Uint8Array), else the int as a
        // minimal VM number.
        const commitValue = (nv: bigint | Uint8Array): Uint8Array =>
          nv instanceof Uint8Array ? nv : (scalarTail ?? bigIntToVmNumber(nv));
        if (!Array.isArray(keysArr)
        || (perKey && !info.mutation && !info.valueRuntimeLocal && !Array.isArray(valsArr))) continue;
        if (perKey && !info.mutation && !info.valueRuntimeLocal
        && (valsArr as unknown[]).length !== keysArr.length) {
          throw new Error(`vmap upsert loop ${info.collection}: recipients/amounts length mismatch`);
        }
        const foldActive = info.op === '+' || info.op === 'set'; // crediting loops defer + fold (covenant pendActive)
        // A repeated key whose turns are observable cannot be merged: when a turn reads the entry it writes, a later
        // occurrence reads what an earlier one wrote; a value computed at run time is the last occurrence's, not the
        // first's; and a per-turn effect (an event, a require, another write) runs once per turn, which the merge
        // would run one time fewer. The covenant cannot serve that later turn (each entry is co-spent once), so
        // refuse the repeat by name rather than run a call with fewer keys than the caller passed.
        const observableTurns = info.readsWrittenEntry || info.valueRuntimeExpression || info.siblingEffect;
        const turnReason = (): string => (info.readsWrittenEntry ? 'each turn reads the entry it writes'
          : info.siblingEffect ? 'each turn has its own effect' : 'the value is computed per turn');
        if (!counterSpec && !info.mutation && observableTurns && Array.isArray(keysArr) && keysArr.length > 1) {
          const slotHexes = (keysArr as unknown[]).map((key) => binToHex(slotForKey(key)));
          const repeat = slotHexes.findIndex((hex, at) => slotHexes.indexOf(hex) !== at);
          if (repeat >= 0) {
            throw new Error(`vmap upsert loop ${info.collection}: key ${repeat} of '${info.varyingArrayParam}' repeats `
              + `an earlier key, and ${turnReason()}, so its turns cannot be merged; pass each key once`);
          }
        }
        // DUPLICATE RECIPIENT: the same key listed 2+ times. Solidity ACCUMULATES for += / -= ([a,a],[10,20] -> a += 30),
        // takes the LAST for = ([a,a],[10,20] -> a = 20), and delete is idempotent. Since the covenant co-spends one
        // entry per recipient, combine duplicates into ONE entry (co-spent once) with the merged amount, BEFORE the
        // self-transfer filter / reorder. For += the merged sum equals the original sum, so a coexisting `bal[msg.sender]
        // -= amounts[i]` debit is unchanged. Scalar/const-value: a `set` (= amount / = 100) duplicate is idempotent, so
        // dedupe (keep one); compiler-owned counter streams retain every occurrence because their row loop and effect
        // domains cannot be shortened. Those streams use the pending transition below for set/delete/`+=`/`-=`.
        if (!counterSpec && !info.mutation && Array.isArray(keysArr) && keysArr.length > 1
        && !info.valueArrayIndexParam && (isDelete || perKey || info.op === 'set')) {
          const kArr = keysArr as unknown[];
          const slotHexes = kArr.map((key) => binToHex(slotForKey(key)));
          if (slotHexes.some((h, i) => slotHexes.indexOf(h) !== i)) {
            const seen = new Set<string>();
            const order: number[] = [];
            const merged = new Map<string, unknown>();
            const vArr = perKey ? (valsArr as unknown[]) : undefined;
            slotHexes.forEach((h, i) => {
              if (!seen.has(h)) { seen.add(h); order.push(i); }
              // 'set' is last-wins (store the value VERBATIM - a rawbytes value has no toBig); '+'/'-' accumulate (int).
              if (vArr) merged.set(h, info.op === 'set' || info.op === 'read'
                ? vArr[i] : toBig(merged.get(h) ?? 0n) + toBig(vArr[i]));
            });
            keysArr = order.map((i) => kArr[i]);
            const recipIdx = loopAbiFunction.inputs.findIndex((p) => p.name === info.varyingArrayParam);
            if (!runtimeFiltered && recipIdx >= 0) replaceLoopArgument(recipIdx, keysArr as FunctionArgument);
            if (vArr) {
              valsArr = order.map((i) => merged.get(slotHexes[i])!);
              const amtIdx = loopAbiFunction.inputs.findIndex((p) => p.name === info.valueArrayParam);
              if (!runtimeFiltered && !info.valueArrayIndexParam
              && amtIdx >= 0 && info.valueArrayParam !== info.varyingArrayParam) {
                replaceLoopArgument(amtIdx, valsArr as FunctionArgument);
              }
            }
          }
        }
        // SCALAR `+=` / `-=` DUPLICATE: a fixed-amount airdrop/debit (`+= amount` / `-= amount`) has no per-key array to
        // merge, so GROUP a duplicated key's occurrences adjacent (stable, by first occurrence). The covenant's isDup
        // accumulate then applies the scalar once per occurrence to the single co-spent entry (the SDK accumulates it into
        // the pending commitment in the loop below). Order-independent (accumulates); scalar `set` is deduped above.
        if ((info.op === '+' || info.op === '-') && !perKey && !isDelete && Array.isArray(keysArr) && keysArr.length > 1) {
          const kArr = keysArr as unknown[];
          const slotHexes = kArr.map((key) => binToHex(slotForKey(key)));
          if (slotHexes.some((h, i) => slotHexes.indexOf(h) !== i)) {
            const groups = new Map<string, number[]>();
            const firstOrder: string[] = [];
            slotHexes.forEach((h, i) => {
              if (!groups.has(h)) { groups.set(h, []); firstOrder.push(h); }
              groups.get(h)!.push(i);
            });
            keysArr = firstOrder.flatMap((h) => groups.get(h)!).map((i) => kArr[i]);
            const recipIdx = loopAbiFunction.inputs.findIndex((p) => p.name === info.varyingArrayParam);
            if (!runtimeFiltered && recipIdx >= 0) replaceLoopArgument(recipIdx, keysArr as FunctionArgument);
          }
        }
        // SELF-TRANSFER: a recipient == the debited msg.sender nets out (`bal[msg.sender] -= a; bal[msg.sender] += a`).
        // Since the debit and the credit share amounts[i], dropping that entry from recipients+amounts leaves the debit
        // summing (total - own) and never credits msg.sender separately - the identical net, with msg.sender co-spent
        // ONCE (the debit) instead of twice. Solidity allows a self-transfer in a batch; this matches it.
        if (!info.mutation && foldActive && this._signer && Array.isArray(keysArr) && keysArr.length > 0) {
          const debitE = entryNfts.find((e) => e.collection === info.collection && e.exists && e.utxo);
          let senderKey: Uint8Array | null = null;
          try { senderKey = addressToLockScript(this._signer.getAddress()); } catch { senderKey = null; }
          if (debitE && senderKey) {
            const senderSlotHex = binToHex(keyToSlotMulti([...fixedBins, senderKey], collection));
            const kArr = keysArr as unknown[];
            const keepIdx: number[] = [];
            kArr.forEach((k, i) => {
              if (binToHex(slotForKey(k)) !== senderSlotHex) keepIdx.push(i);
            });
            if (keepIdx.length < kArr.length && info.siblingEffect) {
              // Netting out the sender's own credit drops that turn, and with it the turn's per-turn effect; refuse.
              throw new Error(`vmap upsert loop ${info.collection}: a credit to the sender itself cannot be netted out `
                + 'because each turn has its own effect; send it as its own call');
            }
            if (keepIdx.length < kArr.length) {
              keysArr = keepIdx.map((i) => kArr[i]);
              const recipIdx = loopAbiFunction.inputs.findIndex((p) => p.name === info.varyingArrayParam);
              if (!runtimeFiltered && recipIdx >= 0) replaceLoopArgument(recipIdx, keysArr as FunctionArgument);
              if (perKey && Array.isArray(valsArr)) {
                const vArr = valsArr as unknown[];
                valsArr = keepIdx.map((i) => vArr[i]);
                const amtIdx = loopAbiFunction.inputs.findIndex((p) => p.name === info.valueArrayParam);
                if (!runtimeFiltered && !info.valueArrayIndexParam
                && amtIdx >= 0 && info.valueArrayParam !== info.varyingArrayParam) {
                  replaceLoopArgument(amtIdx, valsArr as FunctionArgument);
                }
              }
            }
          }
        }
        // CASE (b) ADJACENCY REORDER: the covenant folds a new recipient into a credited predecessor P only when P is
        // processed IMMEDIATELY before it. The multiTransfer result is order-independent, so reorder recipients+amounts
        // (as a PAIR, preserving each recipient's amount) to place each such new recipient right after P. Chains /
        // two-in-gap can't be made adjacent and stay fail-closed. Crediting loops only (foldActive); write back to args
        // so the encoded tx argument matches the commitment order the covenant verifies.
        if (foldActive && Array.isArray(keysArr) && keysArr.length > 1) {
          const kArr = keysArr as unknown[];
          const slotsB = kArr.map((key) => slotForKey(key));
          const isUpd = slotsB.map((s) => !!list.find(s));
          const updBySlot = new Map<string, number>();
          slotsB.forEach((s, i) => { if (isUpd[i]) updBySlot.set(binToHex(s), i); });
          // Group inserts by their predecessor slot (a recipient-update, an untouched entry, or the HEAD sentinel). Each
          // such gap forms a chain that the covenant walks in ASCENDING order, so its inserts must be consecutive +
          // ascending in the tx. A case-b gap (predecessor is a credited update) additionally sits right after that update.
          const insertsByPred = new Map<string, number[]>();
          slotsB.forEach((s, i) => {
            if (isUpd[i]) return;
            const ph = binToHex(list.predecessorOf(s).slot);
            if (!insertsByPred.has(ph)) insertsByPred.set(ph, []);
            insertsByPred.get(ph)!.push(i);
          });
          // Reorder only when it changes something: a gap with >1 insert (chain) or an insert bracketed by a credited
          // update (case-b adjacency). Result is order-independent, so this is transparent.
          let needsReorder = false;
          for (const [ph, arr] of insertsByPred) if (arr.length > 1 || updBySlot.has(ph)) needsReorder = true;
          if (needsReorder) {
            for (const [, arr] of insertsByPred) {
              arr.sort((a, b) => (bytesToSlotValue(slotsB[a]) < bytesToSlotValue(slotsB[b]) ? -1 : 1));
            }
            const order: number[] = [];
            const placed = new Set<number>();
            const emitGap = (ph: string): void => {
              for (const r of insertsByPred.get(ph) ?? []) if (!placed.has(r)) { order.push(r); placed.add(r); }
            };
            for (let i = 0; i < kArr.length; i++) {
              if (placed.has(i)) continue;
              if (isUpd[i]) {
                order.push(i); placed.add(i); emitGap(binToHex(slotsB[i])); continue;
              } // its gap's inserts follow
              const ph = binToHex(list.predecessorOf(slotsB[i]).slot);
              if (updBySlot.has(ph)) continue; // an insert placed via its credited-update predecessor
              emitGap(ph); // untouched / HEAD gap: place the whole ascending group here
            }
            for (let i = 0; i < kArr.length; i++) if (!placed.has(i)) { order.push(i); placed.add(i); } // safety net
            if (runtimeFiltered && order.some((sourceIndex, targetIndex) => sourceIndex !== targetIndex)) {
              throw new Error(`vmap upsert loop ${info.collection}: predicate-selected keys require topology reordering; `
              + 'split the action sequence so each selected mapping transition is already adjacent.');
            }
            keysArr = order.map((i) => kArr[i]);
            // Write the reordered arrays to BOTH args (read by other derivations) AND finalArgs (already copied from
            // args by the msg.sender/synthetic injection above - it builds the master unlocker, so the ENCODED tx
            // argument must carry the same order the commitments were built in, else the covenant OP_VERIFY fails).
            const recipIdx = loopAbiFunction.inputs.findIndex((p) => p.name === info.varyingArrayParam);
            if (!runtimeFiltered && recipIdx >= 0) replaceLoopArgument(recipIdx, keysArr as FunctionArgument);
            // Array-mutation operand arrays use the same loop index as the key array and must follow any covenant
            // adjacency reorder exactly.
            for (const [pname, indexName] of [
              [info.mutationValueArrayParam, info.mutationValueArrayIndexParam],
              [info.mutationIndexArrayParam, info.mutationIndexArrayIndexParam],
            ]) {
              if (!pname) continue;
              // A compiler-owned logical index keeps the public operand array in source order; the hidden key
              // permutation selects the matching element during each physical iteration.
              if (indexName) continue;
              const pi = loopAbiFunction.inputs.findIndex((p) => p.name === pname);
              const pv = pi >= 0 ? loopArgs[pi] : undefined;
              if (Array.isArray(pv)) {
                const reordered = order.map((i) => pv[i]);
                if (!runtimeFiltered) {
                  replaceLoopArgument(pi, reordered);
                }
              }
            }
            if (perKey && Array.isArray(valsArr)) {
              const vArr = valsArr as unknown[];
              valsArr = order.map((i) => vArr[i]);
              const amtIdx = loopAbiFunction.inputs.findIndex((p) => p.name === info.valueArrayParam);
              if (!runtimeFiltered && !info.valueArrayIndexParam
              && amtIdx >= 0 && info.valueArrayParam !== info.varyingArrayParam) {
                replaceLoopArgument(amtIdx, valsArr as FunctionArgument);
              }
            }
          }
        }
        const journalArgumentIndex = loopAbiFunction.inputs.findIndex(
          (input) => input.name === KERNEL_JOURNAL_ACCESS_STREAMS,
        );
        if (journalArgumentIndex >= 0) {
        // An unconditional compiler-owned counter stream still executes at source occurrences 0..N-1. Publish
        // those coordinates explicitly so two write sites in the same loop are planned A0,B0,A1,B1 after their
        // key arrays have independently been permuted for physical topology.
          const journalSourceOccurrences = sourceOccurrences
          ?? (counterSpec ? keysArr.map((_key, occurrence) => occurrence) : undefined);
          const streamIndex = info.journalAccessStreamIndex;
          const streamCount = loopAbiFunction.sortedUpsertLoopInfo?.length ?? 0;
          if (!Number.isSafeInteger(streamIndex) || streamIndex < 0 || streamIndex >= streamCount) {
            throw new Error(
              `Kernel runtime loop in '${loopAbiFunction.name}' has invalid journal stream ordinal ${streamIndex}.`,
            );
          }
          // Mapping `delete` resets a present value but leaves an absent target absent. Keep that distinction
          // in the authenticated topology rather than inserting an enumerable zero-valued node.
          const operation: KernelEntryJournalTopologyOperation = info.op === 'read' ? 'read'
            : info.op === 'delete' ? 'nullify' : 'write';
          runtimeKernelJournalStreams.push({
            collection: info.collection,
            collectionHash: computeCollectionHash(collection.signature),
            frameIndex: upsertFrameIndex,
            executionGroup: Number.isSafeInteger(info.journalExecutionGroup) && info.journalExecutionGroup! >= 0
              ? info.journalExecutionGroup! : info.journalAccessStreamIndex,
            executionOrder: info.journalAccessStreamIndex,
            accessStreamIndex: info.journalAccessStreamIndex,
            ...(info.settlementIdentity && { settlementIdentity: info.settlementIdentity }),
            ...(journalSourceOccurrences && { sourceOccurrences: journalSourceOccurrences }),
            list,
            writes: keysArr.map((key) => ({ slot: slotForKey(key), operation })),
            publish: (encoded) => {
              const current = argOf(KERNEL_JOURNAL_ACCESS_STREAMS);
              const initialized = current === undefined || (Array.isArray(current) && current.length === 0)
                ? kernelJournalAccessStreamPlaceholders(loopAbiFunction) : current;
              if (!Array.isArray(initialized) || initialized.length !== streamCount
              || initialized.some((stream) => !(stream instanceof Uint8Array))) {
                const actual = !Array.isArray(initialized) ? typeof initialized
                  : `${initialized.length} (${initialized.map((stream) => (
                    stream instanceof Uint8Array ? 'bytes' : typeof stream
                  )).join(', ')})`;
                throw new Error(
                  `Kernel handler '${loopAbiFunction.name}' requires ${streamCount} journal access streams; `
                + `received ${actual}.`,
                );
              }
              const streams = [...initialized] as Uint8Array[];
              streams[streamIndex] = encoded;
              replaceLoopArgument(journalArgumentIndex, streams);
            },
          });
        }
        if (info.valueRuntimeLocal) {
          const oldWitnesses: ConstructorArgument[] = [];
          const runtimeSlots = new Set<string>();
          const consumedInputs = new Set<string>();
          let outputCount = 0;
          // The covenant defers a present update, then can re-point it for the next absent key in its gap.
          // Mirror that physical input schedule here: the re-point consumes no second predecessor input and
          // contributes one additional entry output. Consecutive new keys in one gap chain in the same way.
          let deferred: { slot: Uint8Array; nextKey: Uint8Array } | undefined;
          const runtimeUnlocker = createEntryNftUnlocker(
            this.inner, overrides?.blockBase ?? 0, this.categoryId, info.collection,
          );
          for (let i = 0; i < keysArr.length; i++) {
            const slot = slotForKey(keysArr[i]);
            const slotHex = binToHex(slot);
            if (runtimeSlots.has(slotHex)) {
              throw new Error(`vmap runtime struct loop ${info.collection}: duplicate keys require a journaled `
              + 'read-your-writes transition and cannot be co-spent twice');
            }
            runtimeSlots.add(slotHex);
            const entry = list.find(slot);
            let raw: Uint8Array;
            if (entry) {
              const inputId = `${entry.utxo.txid}:${entry.utxo.vout}`;
              if (consumedInputs.has(inputId)) {
                throw new Error(`vmap runtime struct loop ${info.collection}: entry ${i} is already co-spent`);
              }
              consumedInputs.add(inputId);
              captureRuntimeJournalInputIntent({ ...entry.utxo, unlocker: runtimeUnlocker }, info.collection);
              const tail = entry.value;
              if (tail.length < 4) throw new Error(`vmap runtime struct value for ${info.collection} has an invalid tail`);
              const len = tail[0] | (tail[1] << 8) | (tail[2] << 16) | (tail[3] << 24);
              if (len <= 60) {
                raw = tail.slice(4, 4 + len);
              } else {
                const root = tail.slice(4, 36);
                const headData = tail.slice(36, 64);
                const chunkAddr = getValueChunkAddress(this.inner, this.categoryId, info.collection, slot, root);
                const chunks = (await this.inner.provider.getUtxos(chunkAddr))
                  .filter((utxo) => utxo.token?.category === this.categoryId
                  && !!utxo.token?.nft?.commitment && utxo.token.nft.commitment.length > 0)
                  .map((utxo) => parseValueChunkCommitment(utxo.token!.nft!.commitment))
                  .sort((a, b) => a.chunkIndex - b.chunkIndex);
                raw = joinValueChunks(headData, chunks, len);
                if (binToHex(sha256Sync(raw)) !== binToHex(root)) {
                  throw new Error('vmap runtime struct value chunks do not match the authenticated root');
                }
                valueChunkGc.push({ collection: info.collection, slotHex, oldDigestHex: binToHex(root) });
              }
              deferred = { slot: entry.slot, nextKey: entry.nextKey };
              outputCount += 1;
            } else {
              raw = encodePushdataValue(
                getDefaultStateValue(collection.valueType, stateLayout.structs),
                collection.valueType, stateLayout.structs,
              );
              const predecessor = list.predecessorOf(slot);
              const slotValue = bytesToSlotValue(slot);
              const rePointsDeferred = deferred !== undefined
              && bytesToSlotValue(deferred.slot) < slotValue
              && (bytesToSlotValue(deferred.nextKey) === 0n || slotValue < bytesToSlotValue(deferred.nextKey));
              if (rePointsDeferred) {
                deferred = { slot, nextKey: deferred!.nextKey };
                outputCount += 1;
              } else {
                const inputId = `${predecessor.utxo.txid}:${predecessor.utxo.vout}`;
                if (consumedInputs.has(inputId)) {
                  throw new Error(`vmap runtime struct loop ${info.collection}: absent key ${i} shares a non-adjacent predecessor`);
                }
                consumedInputs.add(inputId);
                captureRuntimeJournalInputIntent({ ...predecessor.utxo, unlocker: runtimeUnlocker }, info.collection);
                deferred = { slot, nextKey: predecessor.nextKey };
                outputCount += 2;
              }
            }
            oldWitnesses.push(info.oldValuesWitnessParam?.startsWith(VMAP_COUNTER_OLD_PREFIX)
              ? decodePushdataValue(raw, 0, collection.valueType, stateLayout.structs).value as ConstructorArgument
              : raw);
          }
          const witnessIndex = loopAbiFunction.inputs.findIndex((input) => input.name === info.oldValuesWitnessParam);
          if (witnessIndex < 0) {
            throw new Error(`vmap runtime struct loop ${info.collection}: missing old-value witness ABI input`);
          }
          replaceLoopArgument(witnessIndex, oldWitnesses);
          const priorOutputCount = runtimeLoopDerivedCounts.get(info.collection) ?? 0;
          runtimeLoopDerivedCounts.set(info.collection, priorOutputCount + outputCount);
          if (upsertFrame.routed && selectedUpsertRows.length > 1 && outputCount > 0) {
            const rowIndex = routeRowIndex(upsertFrame.row!);
            if (rowIndex < 0) throw new Error('Message-bus runtime loop row is missing from its route frame');
            runtimeLoopEntrySegments.push({
              rowIndex, collection: info.collection, offset: priorOutputCount, count: outputCount,
            });
          }
          materializeLegacyRuntimeJournalIntents(runtimeJournalIntentStart);
          addRuntimeLoopCardinality(
            info.collection, insertLoopPredecessors.length - runtimeInputStart, outputCount,
          );
          if (collection.chunkableValue) {
            for (const key of keysArr) addComputedValueChunkRun(info.collection, slotForKey(key));
          }
          continue;
        }
        if (info.mutation) {
          const mutationExpressions = [
            info.mutationValueExpression, info.mutationIndexExpression,
          ].filter((expression): expression is ExternalCallExpression => expression !== undefined);
          if (mutationExpressions.length > 0) {
            loopPredicateState = await this._hydrateExternalPredicateState(
              mutationExpressions,
              conditionArgs,
              entryArtifact,
              loopPredicateState,
              visibleInputs,
              executionSelfAddress,
              keysArr.map(occurrenceOf),
            );
          }
          const readRawValue = async (slot: Uint8Array): Promise<Uint8Array> => {
            const entry = list.find(slot);
            if (!entry) return encodePushdataValue([], collection.valueType, stateLayout.structs);
            const tail = entry.value;
            if (tail.length < 4) throw new Error(`vmap array value for ${info.collection} has an invalid tail`);
            const len = tail[0] | (tail[1] << 8) | (tail[2] << 16) | (tail[3] << 24);
            if (len <= 60) return tail.slice(4, 4 + len);
            const root = tail.slice(4, 36);
            const headData = tail.slice(36, 64);
            const chunkAddr = getValueChunkAddress(this.inner, this.categoryId, info.collection, slot, root);
            const chunks = (await this.inner.provider.getUtxos(chunkAddr))
              .filter((u) => u.token?.category === this.categoryId
              && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0)
              .map((u) => parseValueChunkCommitment(u.token!.nft!.commitment))
              .sort((a, b) => a.chunkIndex - b.chunkIndex);
            const raw = joinValueChunks(headData, chunks, len);
            if (binToHex(sha256Sync(raw)) !== binToHex(root)) {
              throw new Error('vmap value chunks do not match the authenticated root');
            }
            return raw;
          };
          const operand = (arrayName: string | undefined, arrayIndexName: string | undefined,
            scalarName: string | undefined, constant: string | undefined,
            expression: ExternalCallExpression | undefined, i: number): unknown => {
            const av = argOf(arrayName);
            if (arrayName && Array.isArray(av)) {
              const indices = arrayIndexName === info.varyingArrayParam ? keysArr : argOf(arrayIndexName);
              const rawIndex = Array.isArray(indices) ? indices[i] : i;
              const index = Number(typeof rawIndex === 'bigint' ? rawIndex : BigInt(rawIndex as number | string));
              if (!Number.isSafeInteger(index) || index < 0 || index >= av.length) {
                throw new Error(`vmap array mutation ${info.collection}: operand index ${String(rawIndex)} out of bounds`);
              }
              return av[index];
            }
            if (scalarName) return argOf(scalarName);
            if (constant !== undefined) return BigInt(constant);
            if (expression) {
              const value = this._evaluateExternalExpression(
                expression,
                conditionArgs,
                entryArtifact,
                loopPredicateState,
                visibleInputs,
                undefined,
                occurrenceOf(keysArr[i]),
                false,
                executionSelfAddress,
              );
              if (value === undefined) {
                throw new Error(`vmap array mutation ${info.collection}: could not resolve operand expression`);
              }
              return value;
            }
            return undefined;
          };
          const oldWitnesses: StateValue[] = [];
          const mutated: StateValue[] = [];
          const pendingArrays = new Map<string, StateValue[]>();
          for (let i = 0; i < keysArr.length; i++) {
            const slot = slotForKey(keysArr[i]);
            const slotHex = binToHex(slot);
            const pending = pendingArrays.get(slotHex);
            const raw = pending === undefined ? await readRawValue(slot) : undefined;
            const decoded = pending ?? decodePushdataValue(
              raw!, 0, collection.valueType, stateLayout.structs,
            ).value;
            if (!Array.isArray(decoded)) throw new Error(`vmap mutation target ${info.collection} is not an array`);
            oldWitnesses.push([...decoded]);
            const next = [...decoded] as StateValue[];
            if (info.mutation === 'push') {
              next.push(operand(
                info.mutationValueArrayParam, info.mutationValueArrayIndexParam,
                info.mutationValueScalarParam, info.mutationValueConst,
                info.mutationValueExpression, i,
              ) as StateValue);
            } else if (info.mutation === 'pop') {
              if (next.length === 0) throw new Error(`vmap array mutation ${info.collection}: pop from empty array`);
              next.pop();
            } else {
              const rawIndex = operand(
                info.mutationIndexArrayParam, info.mutationIndexArrayIndexParam,
                info.mutationIndexScalarParam, info.mutationIndexConst,
                info.mutationIndexExpression, i,
              );
              const index = Number(typeof rawIndex === 'bigint' ? rawIndex : BigInt(rawIndex as number | string));
              if (!Number.isSafeInteger(index) || index < 0 || index >= next.length) {
                throw new Error(`vmap array mutation ${info.collection}: index ${index} out of bounds`);
              }
              next[index] = operand(
                info.mutationValueArrayParam, info.mutationValueArrayIndexParam,
                info.mutationValueScalarParam, info.mutationValueConst,
                info.mutationValueExpression, i,
              ) as StateValue;
            }
            mutated.push(next);
            pendingArrays.set(slotHex, next);
          }
          const wi = loopAbiFunction.inputs.findIndex((p) => p.name === info.oldValuesWitnessParam);
          if (wi < 0) throw new Error(`vmap array mutation ${info.collection}: missing old-value witness ABI input`);
          replaceLoopArgument(wi, oldWitnesses);
          valsArr = mutated;
          perKey = true;
          perKeyRawbytes = true;
        }
        const wUnlocker = createEntryNftUnlocker(
          this.inner, overrides?.blockBase ?? 0, this.categoryId, info.collection,
        );
        // Commitments in CUMULATIVE OUTPUT order (matching the covenant's outCounter): an UPDATE contributes 1 (the
        // updated node), an INSERT contributes 2 (P' = the re-pointed predecessor, then NEW). One co-spent input per
        // recipient. cospent = co-spent UTXO ids for conflict detection (an entry / predecessor can be co-spent once).
        const commitments: string[] = [];
        const commitmentProducers: KernelEntryJournalDirtyFinalBodyCandidate['producer'][] = [];
        const commitmentProducer = (
          accessOrdinal: number,
          recordRole: KernelEntryJournalDirtyFinalBodyCandidate['producer']['recordRole'],
        ): KernelEntryJournalDirtyFinalBodyCandidate['producer'] => ({
          frameIndex: upsertFrameIndex,
          accessStreamIndex: info.journalAccessStreamIndex,
          accessOrdinal,
          recordRole,
        });
        const seenSlots = new Set<string>();
        const cospent = new Set<string>();
        const uidOf = (u: { txid: string; vout: number }): string => `${u.txid}:${u.vout}`;
        // The on-chain read loop caches the last real node it authenticated and reproduced unchanged. Sorted keys
        // which remain in that node's successor gap reuse the proof instead of attempting an invalid duplicate
        // co-spend. Keep the exact same interval here so physical input/output counts match the covenant.
        let priorReadProof: { uid: string; slot: Uint8Array; nextKey: Uint8Array } | undefined;
        // Pre-seed with this collection's FIXED (non-loop) entry co-spends - notably the cached `bal[msg.sender] -=`
        // DEBIT write. If a NEW recipient's bracketing predecessor is one of those already-co-spent entries, co-spending
        // it again would make an invalid duplicate input; detect it here and fail closed with a clear message (else the
        // tx builder throws an opaque "Duplicate input detected").
        for (const e of entryNfts) {
          if (e.collection === info.collection && e.exists && e.utxo) cospent.add(uidOf(e.utxo));
        }
        // MSG.SENDER MERGE: the single fixed (non-loop) co-spent entry of this collection is the cached msg.sender DEBIT.
        // A new recipient whose bracketing predecessor IS that entry re-points the debit's single co-spend (the covenant
        // does it via the loop's re-point register) instead of co-spending it again - so we mint only the NEW node.
        const debitEntry = entryNfts.find((e) => e.collection === info.collection && e.exists && e.utxo);
        let mergedNewCount = 0;
      // CASE (b) FOLD: mirror the covenant's pending-defer register. On a crediting loop (+/set) each UPDATE defers its
      // mint; the NEXT recipient, if it is a NEW node bracketed by that update, re-points the update's commitment in
      // place + appends its own NEW node (the predecessor is co-spent ONCE). lastDeferred = the immediately-prior
      // update, or null. Requires adjacency (predecessor processed right before the new key) - the reorder above makes
      // that hold for the common case; anything it can't (chains / two-in-gap) fails closed.
      // newVal carries a rawbytes value's tail (Uint8Array) or an int (bigint); arithmetic paths below are int-only (the
      // guard gates rawbytes to op==='set', which never adds/subtracts).
      type DeferredEntry = {
        uid: string; commitIndex: number; slot: Uint8Array;
        newVal: bigint | Uint8Array; oldNext: Uint8Array;
      };
      let lastDeferred: DeferredEntry | null = null;
      for (let i = 0; i < keysArr.length; i++) {
        const slot = slotForKey(keysArr[i]);
        const slotHex = binToHex(slot);
        const loopRawValue = collection.chunkableValue && info.op === 'set'
          ? rawValueBytes(perKeyRawbytes ? (valsArr as unknown[])[i] : rawScalar)
          : undefined;
        if (loopRawValue && loopRawValue.length > 60) {
          loopValueChunkMints.push({
            collection: info.collection, slot, digest: sha256Sync(loopRawValue),
            chunks: splitValueIntoValueChunks(loopRawValue),
          });
        }
        const amt: bigint | Uint8Array = perKeyRawbytes ? encodeValueTail((valsArr as unknown[])[i])
          : isRawbytesVal ? 0n : isDelete ? 0n : scalarAmt !== undefined ? scalarAmt : toBig((valsArr as unknown[])[i]);
        if (seenSlots.has(slotHex)) {
          // The compact access stream still retains this logical occurrence. In authenticated carrier mode the
          // later transaction-wide physical planner collapses its shared proof to one input/output; do not reject
          // it in this collection-local discovery pass.
          if (kernelReadCarrierOwnsDuplicateProof(deferRuntimeJournalMaterialization, info.op)) continue;
          // DUPLICATE `+=` / `-=`: compiler-owned counter permutations preserve every source occurrence, while public
          // key arrays may have been pre-merged above. Accumulate this occurrence into the pending commitment exactly
          // as the covenant does, without attempting to co-spend the entry again.
          if ((info.op === '+' || info.op === '-') && !isDelete && lastDeferred
            && binToHex(lastDeferred.slot) === slotHex) {
            lastDeferred.newVal = (lastDeferred.newVal as bigint) + (info.op === '-' ? -(amt as bigint) : (amt as bigint));
            commitments[lastDeferred.commitIndex] =
              binToHex(encodeEntryCommitment(lastDeferred.slot, lastDeferred.oldNext, commitValue(lastDeferred.newVal)));
            commitmentProducers[lastDeferred.commitIndex] = commitmentProducer(i, 'target');
            continue;
          }
          // A compiler-owned permutation leaves public key/value arrays untouched. Repeated logical keys therefore
          // remain as repeated physical iterations; the on-chain pending SET/DELETE consumes them without another
          // co-spend and keeps the last value. Mirror that transition by replacing the pending commitment in place.
          if ((info.op === 'set' || isDelete) && lastDeferred
            && binToHex(lastDeferred.slot) === slotHex) {
            lastDeferred.newVal = amt;
            commitments[lastDeferred.commitIndex] =
              binToHex(encodeEntryCommitment(lastDeferred.slot, lastDeferred.oldNext, commitValue(amt)));
            commitmentProducers[lastDeferred.commitIndex] = commitmentProducer(i, 'target');
            continue;
          }
          throw new Error(`vmap upsert loop ${info.collection}: duplicate recipient (each entry can be co-spent once)`);
        }
        seenSlots.add(slotHex);
        const journalSettledScalar = journalArgumentIndex >= 0
          && !collection.chunkableValue
          && /^(?:u?int\d*|u?fixed\d*x\d*|bigint)$/.test(collection.valueType)
          && (info.op === '+' || info.op === '-' || info.op === 'set' || isDelete);
        const originalEntry = list.find(slot);
        const journalIdentity = `${info.collectionHash}:${entryAddr}:${slotHex}`;
        // Pending scalar state is semantic, not physical: the same table carries read-your-writes values whether
        // outputs are appended immediately or retained for the transaction-wide final flush. In deferred mode its
        // producer vector aliases the retained intent, so a later access changes both the body and its authenticated
        // final-owner coordinate rather than relabelling a stale provisional value.
        const priorPending = journalSettledScalar
          ? runtimeJournalPendingScalar.get(journalIdentity) : undefined;
        if (originalEntry || priorPending) {
          // UPDATE (existing recipient): co-spend the entry, mint the updated value ('delete' -> the type default 0).
          // Collection hash and resolved covenant address are compiler/owner identities; source-level names are not.
          const entry = originalEntry;
          if (entry && cospent.has(uidOf(entry.utxo)) && !priorPending
            && !kernelReadCarrierOwnsDuplicateProof(deferRuntimeJournalMaterialization, info.op)) {
            throw new Error(
              `vmap upsert loop ${info.collection}: recipient ${i}'s entry is already co-spent this tx; `
                + 'a read-your-writes transition is required',
            );
          }
          if (entry) cospent.add(uidOf(entry.utxo));
          const oldVal = priorPending?.value ?? (info.op === '+' || info.op === '-'
            ? vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false }) as bigint : 0n);
          const newVal: bigint | Uint8Array = isDelete ? 0n : info.op === 'set' || info.op === 'read' ? amt
            : info.op === '-' ? oldVal - (amt as bigint) : oldVal + (amt as bigint);
          if (priorPending) {
            if (!priorPending.commitments[priorPending.commitmentIndex]) {
              throw new Error('Kernel pending scalar journal lost its first-touch output');
            }
            priorPending.value = newVal as bigint;
            priorPending.commitments[priorPending.commitmentIndex] = binToHex(encodeEntryCommitment(
              priorPending.slot, priorPending.nextKey, commitValue(priorPending.value),
            ));
            if (deferRuntimeJournalMaterialization) {
              if (!priorPending.producers) {
                throw new Error('Kernel pending scalar journal lost its deferred producer vector');
              }
              priorPending.producers[priorPending.commitmentIndex] = commitmentProducer(i, 'target');
            }
            // This row consumes no second input and creates no intermediate output. Its access program selects the
            // dirty carrier returned by the earlier row.
            continue;
          }
          if (!entry) throw new Error('Kernel pending scalar entry lost its transaction-local carrier.');
          captureRuntimeJournalInputIntent({ ...entry.utxo, unlocker: wUnlocker }, info.collection, journalSettledScalar);
          if (collection.chunkableValue && info.op !== 'read') {
            const oldTail = entry.value;
            if (oldTail.length >= 36
              && (oldTail[0] | (oldTail[1] << 8) | (oldTail[2] << 16) | (oldTail[3] << 24)) > 60) {
              valueChunkGc.push({
                collection: info.collection, slotHex, oldDigestHex: binToHex(oldTail.slice(4, 36)),
              });
            }
          }
          // Record this update as the pending-defer target BEFORE pushing its (initially normal) commitment, so a
          // following bracketed new key can re-point it (foldActive) OR a duplicate can update it (`-` and delete also
          // keep the pending register solely for duplicates even though they never insert/fold).
          if (foldActive || info.op === '-' || isDelete) {
            lastDeferred = {
              uid: uidOf(entry.utxo), commitIndex: commitments.length,
              slot: entry.slot, newVal, oldNext: entry.nextKey,
            };
          }
          commitments.push(binToHex(encodeEntryCommitment(entry.slot, entry.nextKey, commitValue(newVal))));
          commitmentProducers.push(commitmentProducer(i, 'target'));
          if (journalSettledScalar && !deferRuntimeJournalMaterialization) {
            hasPendingExistingScalarSettlement = true;
          }
          if (info.op === 'read') {
            priorReadProof = {
              uid: uidOf(entry.utxo), slot: entry.slot, nextKey: entry.nextKey,
            };
          }
        } else {
          // INSERT (a NEW recipient): co-spend the bracketing predecessor (from the ORIGINAL list) + mint P' then NEW.
          // A delete of an absent target is an authenticated no-op. Co-spend and reproduce the exact bracketing
          // predecessor, leaving the queried key absent; the compact journal access binds the target tombstone
          // and its predecessor to this source occurrence. A debit remains invalid without a present value.
          if (info.op === '-') {
            throw new Error(`vmap upsert loop ${info.collection}: cannot debit key ${i} - it has no entry`);
          }
          const basePred = list.predecessorOf(slot);
          if (isDelete) {
            const predecessorId = uidOf(basePred.utxo);
            if (cospent.has(predecessorId)) {
              throw new Error(`vmap delete loop ${info.collection}: absent key ${i} shares an already co-spent `
                + 'predecessor; a shared absence proof is required');
            }
            cospent.add(predecessorId);
            captureRuntimeJournalInputIntent({ ...basePred.utxo, unlocker: wUnlocker }, info.collection);
            commitments.push(binToHex(encodeEntryCommitment(basePred.slot, basePred.nextKey, basePred.value)));
            commitmentProducers.push(commitmentProducer(i, 'predecessor'));
            continue;
          }
          let pendingPred: RuntimeJournalPendingScalar | undefined;
          if (journalSettledScalar) {
            const targetSlotValue = bytesToSlotValue(slot);
            for (const [identity, candidate] of runtimeJournalPendingScalar) {
              const candidateSlotValue = bytesToSlotValue(candidate.slot);
              const candidateNextValue = bytesToSlotValue(candidate.nextKey);
              const bracketsTarget = candidateSlotValue < targetSlotValue
                && (candidateNextValue === 0n || targetSlotValue < candidateNextValue);
              if (identity.startsWith(`${info.collectionHash}:${entryAddr}:`) && bracketsTarget
                && (!pendingPred || bytesToSlotValue(pendingPred.slot) < candidateSlotValue)) {
                pendingPred = candidate;
              }
            }
          }
          if (info.op === 'read') {
            const predecessorId = uidOf(basePred.utxo);
            const slotValue = bytesToSlotValue(slot);
            const reusesPriorProof = priorReadProof?.uid === predecessorId
              && bytesToSlotValue(priorReadProof.slot) < slotValue
              && (bytesToSlotValue(priorReadProof.nextKey) === 0n
                || slotValue < bytesToSlotValue(priorReadProof.nextKey));
            if (reusesPriorProof) continue;
            if (cospent.has(predecessorId)
              && !kernelReadCarrierOwnsDuplicateProof(deferRuntimeJournalMaterialization, info.op)) {
              throw new Error(`vmap read loop ${info.collection}: absent key ${i} shares an already co-spent `
                + 'predecessor; a shared absence proof is required');
            }
            cospent.add(predecessorId);
            captureRuntimeJournalInputIntent({ ...basePred.utxo, unlocker: wUnlocker }, info.collection);
            commitments.push(binToHex(encodeEntryCommitment(basePred.slot, basePred.nextKey, basePred.value)));
            commitmentProducers.push(commitmentProducer(i, 'predecessor'));
            priorReadProof = { uid: predecessorId, slot: basePred.slot, nextKey: basePred.nextKey };
            continue;
          }
          const deferred: DeferredEntry | null = lastDeferred; // the covenant's pending; an insert never defers
          lastDeferred = null;
          // FOLD + CHAIN (checked BEFORE the debit-merge): is this new key in the DEFERRED entry's gap? Geometric check
          // (d.slot < slot < d.oldNext, 0 = +inf) - mirrors the covenant's pending in-gap flush. deferred is an UPDATE
          // predecessor (case b), a chained NEW node, OR a debit-merged R1 (2+ new in the debit's own gap). Re-point the
          // deferred entry's commitment in place, append this new node, and DEFER IT so a further key can chain. (The
          // explicit `d` / `chained` types break the self-referential inference the lastDeferred re-assignment trips.)
          if (foldActive && deferred) {
            const d: DeferredEntry = deferred;
            const sV = bytesToSlotValue(slot);
            const pV = bytesToSlotValue(d.slot);
            const nV = bytesToSlotValue(d.oldNext); // 0 = +inf
            if (pV < sV && (nV === 0n || sV < nV)) {
              commitments[d.commitIndex] = binToHex(encodeEntryCommitment(d.slot, slot, commitValue(d.newVal)));
              commitmentProducers[d.commitIndex] = commitmentProducer(i, 'predecessor');
              const newCommitIndex = commitments.length;
              commitments.push(binToHex(encodeEntryCommitment(slot, d.oldNext, commitValue(amt)))); // NEW
              commitmentProducers.push(commitmentProducer(i, 'target'));
              const chained: DeferredEntry = { uid: '', commitIndex: newCommitIndex, slot, newVal: amt, oldNext: d.oldNext };
              lastDeferred = chained;
              continue;
            }
          }
          if (pendingPred) {
            const oldNext = pendingPred.nextKey;
            pendingPred.nextKey = slot;
            pendingPred.commitments[pendingPred.commitmentIndex] = binToHex(encodeEntryCommitment(
              pendingPred.slot, slot, commitValue(pendingPred.value),
            ));
            if (deferRuntimeJournalMaterialization) {
              if (!pendingPred.producers) {
                throw new Error('Kernel pending predecessor lost its deferred producer vector');
              }
              pendingPred.producers[pendingPred.commitmentIndex] = commitmentProducer(i, 'predecessor');
            }
            const pendingCommitmentIndex = commitments.length;
            commitments.push(binToHex(encodeEntryCommitment(slot, oldNext, commitValue(amt))));
            commitmentProducers.push(commitmentProducer(i, 'target'));
            lastDeferred = {
              uid: '', commitIndex: pendingCommitmentIndex, slot, newVal: amt, oldNext,
            };
            continue;
          }
          if (debitEntry && uidOf(debitEntry.utxo as { txid: string; vout: number }) === uidOf(basePred.utxo)) {
            // MERGE with the debit (R1): the covenant re-points the debit's output to R1 (via the register) and DEFERS
            // R1, so a further new key in the debit's gap chains off it (handled by the fold check above). Record R1 as
            // the pending. The mergedNewCount guard fails closed on a SECOND, non-chainable debit-merge (unreachable
            // after the gap-based reorder places the debit gap's inserts consecutively + ascending).
            if (mergedNewCount >= 1) {
              throw new Error(`vmap upsert loop ${info.collection}: two non-adjacent new recipients in the debited sender's `
                + 'gap - split into separate transactions.');
            }
            mergedNewCount += 1;
            const mCommitIndex = commitments.length;
            commitments.push(binToHex(encodeEntryCommitment(slot, basePred.nextKey, commitValue(amt)))); // NEW = 0 + amt (R1)
            commitmentProducers.push(commitmentProducer(i, 'target'));
            lastDeferred = { uid: '', commitIndex: mCommitIndex, slot, newVal: amt, oldNext: basePred.nextKey };
            continue;
          }
          if (cospent.has(uidOf(basePred.utxo))) {
            throw new Error(`vmap upsert loop ${info.collection}: new recipient ${i}'s bracketing predecessor is already `
              + 'co-spent in this tx (a non-adjacent credited recipient, or another new recipient in the '
              + 'same gap). Reorder so the predecessor is credited immediately before, or split into separate transactions.');
          }
          cospent.add(uidOf(basePred.utxo));
          captureRuntimeJournalInputIntent({ ...basePred.utxo, unlocker: wUnlocker }, info.collection);
          commitments.push(binToHex(encodeEntryCommitment(basePred.slot, slot, basePred.value)));           // P' (re-pointed)
          commitmentProducers.push(commitmentProducer(i, 'predecessor'));
          const uCommitIndex = commitments.length;
          commitments.push(binToHex(encodeEntryCommitment(slot, basePred.nextKey, commitValue(amt)))); // NEW = 0 + amt
          commitmentProducers.push(commitmentProducer(i, 'target'));
          // DEFER this new node (mirrors the covenant's chain-defer) so a further new key in this same UNTOUCHED / HEAD
          // gap chains off it - a fresh-map airdrop cluster. The reorder groups + ascending-sorts same-gap inserts.
          if (foldActive) lastDeferred = { uid: '', commitIndex: uCommitIndex, slot, newVal: amt, oldNext: basePred.nextKey };
        }
      }
      if (commitments.length > 0) {
        const prior = sortedLoopCommitments.get(info.collection) ?? [];
        captureRuntimeJournalOutputIntent(info.collection, commitments, commitmentProducers, {
          handlerSelector: loopAbiFunction.selector!,
          journalAccessStreamIndex: info.journalAccessStreamIndex,
        });
        materializeLegacyRuntimeJournalIntents(runtimeJournalIntentStart);
        // Deferred carrier materialization deliberately leaves the legacy collection-local output cache empty.
        // Keep using this handler's exact final commitments for its local bookkeeping; global settlement will bind
        // each dirty body to a record ordinal once topology has assigned the transaction-wide coordinates.
        const merged = deferRuntimeJournalMaterialization ? commitments
          : sortedLoopCommitments.get(info.collection)!;
        if (journalArgumentIndex >= 0 && !collection.chunkableValue
          && /^(?:u?int\d*|u?fixed\d*x\d*|bigint)$/.test(collection.valueType)
          && (info.op === '+' || info.op === '-' || info.op === 'set' || isDelete)) {
          merged.forEach((commitment, commitmentIndex) => {
            const decoded = decodeEntryCommitment(hexToBin(commitment));
            runtimeJournalPendingScalar.set(
              `${info.collectionHash}:${entryAddr}:${binToHex(decoded.slot)}`,
              {
                value: vmNumberToBigInt(decoded.value, { requireMinimalEncoding: false }) as bigint,
                commitments: merged, commitmentIndex, slot: decoded.slot, nextKey: decoded.nextKey,
                ...(deferRuntimeJournalMaterialization && { producers: commitmentProducers }),
              },
            );
          });
        }
        if (upsertFrame.routed) {
          const rowIndex = routeRowIndex(upsertFrame.row!);
          if (rowIndex < 0) throw new Error('Message-bus runtime loop row is missing from its route frame');
          runtimeLoopEntrySegments.push({
            rowIndex, collection: info.collection, offset: prior.length, count: commitments.length,
          });
        }
      } else {
        materializeLegacyRuntimeJournalIntents(runtimeJournalIntentStart);
      }
      const streamInputCount = insertLoopPredecessors.length - runtimeInputStart;
      const streamOutputCount = commitments.length;
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ROUTE_ENTRY_PLAN === '1') {
        console.error('runtime-journal-stream-plan', JSON.stringify({
          functionName: loopAbiFunction.name,
          collection: info.collection,
          streamIndex: info.journalAccessStreamIndex,
          varyingArrayParam: info.varyingArrayParam,
          keyCount: keysArr.length,
          inputCount: streamInputCount,
          outputCount: streamOutputCount,
          outputValues: commitments.map((commitment) => (
            binToHex(decodeEntryCommitment(hexToBin(commitment)).value)
          )),
        }));
      }
      addRuntimeLoopCardinality(info.collection, streamInputCount, streamOutputCount);
      for (const [name, count] of [
        [info.inputCountParam, streamInputCount], [info.outputCountParam, streamOutputCount],
      ] as const) {
        if (!name) continue;
        const index = loopAbiFunction.inputs.findIndex((input) => input.name === name);
        if (index < 0) throw new Error(
          `Runtime loop in '${loopAbiFunction.name}' is missing stream cardinality argument '${name}'.`,
        );
        replaceLoopArgument(index, BigInt(count));
      }
      }
    }

    const kernelStreamsByCollection = new Map<string, typeof runtimeKernelJournalStreams>();
    const settlementIdentityStreamCount = runtimeKernelJournalStreams.filter(
      (stream) => stream.settlementIdentity !== undefined,
    ).length;
    if (settlementIdentityStreamCount > 0
      && settlementIdentityStreamCount !== runtimeKernelJournalStreams.length) {
      throw new Error(
        'Kernel journal cannot mix compiler settlement identities with legacy access streams.',
      );
    }
    for (const stream of runtimeKernelJournalStreams) {
      if (stream.settlementIdentity
        && stream.settlementIdentity.accessStreamIndex !== stream.accessStreamIndex) {
        throw new Error(
          `Kernel journal settlement identity stream ${stream.settlementIdentity.accessStreamIndex} does not match `
          + `its containing access stream ${stream.accessStreamIndex}.`,
        );
      }
    }
    validateKernelEntryJournalSettlementGroups(runtimeKernelJournalStreams.map((stream) => ({
      executionGroup: `${stream.frameIndex}:${stream.executionGroup}`,
      mutates: stream.writes.some((write) => write.operation !== 'read'),
      identity: stream.settlementIdentity,
    })));
    for (const stream of runtimeKernelJournalStreams) {
      const collectionIdentity = binToHex(stream.collectionHash);
      const collectionStreams = kernelStreamsByCollection.get(collectionIdentity) ?? [];
      collectionStreams.push(stream);
      kernelStreamsByCollection.set(collectionIdentity, collectionStreams);
    }
    type PlannedKernelCollection = {
      records: Uint8Array[];
      globalOrdinals: Map<number, number>;
    };
    const plannedKernelCollections = new Map<string, PlannedKernelCollection>();
    const plannedKernelStreamAccesses = new Map<
    (typeof runtimeKernelJournalStreams)[number], ReturnType<typeof decodeKernelEntryJournalAccesses>
    >();
    let hasPendingScalarDependency = false;
    for (const [collectionIdentity, collectionStreams] of kernelStreamsByCollection) {
      // The topology transition must see operations in language execution order. Multiple write sites in one
      // counter loop publish separate compact streams, so flattening whole streams would incorrectly execute
      // A0,A1,B0,B1 instead of A0,B0,A1,B1 and can assign an invalid predecessor topology.
      const scheduledWrites = scheduleKernelEntryJournalOccurrences(collectionStreams, (stream) => stream.writes);
      const plan = planKernelEntryJournalAccessTopology(
        collectionStreams[0].list,
        collectionStreams[0].collectionHash,
        [scheduledWrites.map(({ value }) => value)],
      );
      const scheduledAccesses = decodeKernelEntryJournalAccesses(plan.encodedAccessStreams[0]);
      const accessesByStream = new Map<
      (typeof runtimeKernelJournalStreams)[number], ReturnType<typeof decodeKernelEntryJournalAccesses>
      >();
      for (const stream of collectionStreams) accessesByStream.set(stream, Array(stream.writes.length));
      scheduledWrites.forEach(({ stream, compactIndex }, index) => {
        accessesByStream.get(stream)![compactIndex] = scheduledAccesses[index];
      });
      const accesses = collectionStreams.map((stream) => accessesByStream.get(stream)!);
      // Discover dependencies on a prior carrier mutation, including same-stream and interleaved-stream chains.
      // Every dependency marks both its consumer and producer before the transaction-wide carrier phase marks the
      // remaining mutations. Global record ordinals and last-mutating ownership keep cross-stream identity stable.
      const priorProducer = new Map<number, {
        stream: (typeof runtimeKernelJournalStreams)[number];
        access: ReturnType<typeof decodeKernelEntryJournalAccesses>[number];
      }>();
      for (const { stream, value: access } of scheduleKernelEntryJournalOccurrences(
        collectionStreams, (candidate) => accessesByStream.get(candidate)!,
      )) {
        const dependencies: number[] = [];
        if (access.presentBefore && !access.authenticatesTarget) dependencies.push(access.targetRecordOrdinal);
        if (access.predecessorRecordOrdinal !== undefined && !access.authenticatesPredecessor) {
          dependencies.push(access.predecessorRecordOrdinal);
        }
        const carrierProducers = dependencies.map((ordinal) => priorProducer.get(ordinal))
          .filter((producer): producer is NonNullable<typeof producer> => (
            producer !== undefined
          ));
        if (carrierProducers.length > 0) {
          access.pending = true;
          hasPendingScalarDependency = true;
          for (const producer of carrierProducers) {
            producer.access.pending = true;
          }
        }
        if (access.mutates) {
          priorProducer.set(access.targetRecordOrdinal, { stream, access });
          if (access.predecessorRecordOrdinal !== undefined) {
            priorProducer.set(access.predecessorRecordOrdinal, { stream, access });
          }
        }
      }
      collectionStreams.forEach((stream, index) => plannedKernelStreamAccesses.set(stream, accesses[index]));
      plannedKernelCollections.set(collectionIdentity, {
        records: plan.encodedRecords,
        globalOrdinals: new Map(),
      });
    }
    assertKernelJournalRecordBudget(
      [...plannedKernelCollections.values()].map((plan) => plan.records.length),
    );
    // A singleton runtime-computed scalar has no later physical iteration from which trace convergence can
    // replace its provisional typed-default entry output. Route that one-access stream through the authenticated
    // carrier phase so the value computed by the row is published. Multi-access streams already expose their
    // runtime values through the ordinary deferred transition, while literal/argument-derived values retain the
    // smaller direct path. This is a value-provenance/cardinality rule, independent of loop syntax or names.
    const singletonRuntimeExpressionSettlement = [...runtimeExpressionLoopCollections].some((collection) => (
      runtimeKernelJournalStreams
        .filter((stream) => stream.collection === collection)
        .reduce((count, stream) => count + stream.writes.length, 0) === 1
    ));
    const kernelRouteSettlement = entryArtifact.messageBus?.convention === 'kernel-row-loop'
      && entryAbiFunction?.selector === entryArtifact.messageBus.selector;
    // The dense fixed-width pending-scalar carrier is only safe when every mutating stream is a fixed-width
    // scalar. Mixed int+bytes execution groups are compiled onto the per-row path (no scalar journal dirtying),
    // so keep dependency-discovered pending flags and settle like the bytes-only path.
    const allMutatingStreamsAreFixedScalars = runtimeKernelJournalStreams.every((stream) => {
      if (!stream.writes.some((write) => write.operation !== 'read')) return true;
      const collection = stateLayout.collections?.find((candidate) => candidate.name === stream.collection
        || candidate.signature === stream.collection);
      return !!collection && collection.chunkableValue !== true
        && /^(?:bool|u?int\d*|u?fixed\d*x\d*|bigint)$/.test(collection.valueType);
    });
    const pendingScalarSettlementActive = !deferRuntimeJournalMaterialization && kernelRouteSettlement
      && allMutatingStreamsAreFixedScalars
      && (hasPendingScalarDependency || hasPendingExistingScalarSettlement
        || singletonRuntimeExpressionSettlement);
    if (pendingScalarSettlementActive) {
      // The current final flush intentionally settles one dense all-dirty carrier vector. Once an existing-value
      // settlement or a true cross-row dependency activates that protocol, every supported mutating access in the
      // transaction must take the carrier path; reject reads/removals below rather than mixing carrier phases.
      for (const accesses of plannedKernelStreamAccesses.values()) {
        for (const access of accesses) if (access.mutates) access.pending = true;
      }
    }
    if (pendingScalarSettlementActive) {
      const unsupported = [...plannedKernelStreamAccesses.values()].flat().some((access) => (
        !access.presentAfter || !access.mutates
        || (access.presentBefore && access.predecessorRecordOrdinal !== undefined)
      ));
      if (unsupported) {
        throw new Error(
          'Kernel pending scalar settlement supports only fixed-width scalar updates and insertions; reads, removals, '
          + 'deletions, dynamic values, and unrelated predecessor rewrites remain separate transactions.',
        );
      }
    }

    if (authenticatedKernelJournalDispositions && !deferRuntimeJournalMaterialization) {
      const eagerOccurrences = runtimeJournalMaterializationIntents
        .filter((intent): intent is Extract<RuntimeJournalMaterializationIntent, { kind: 'outputs' }> => (
          intent.kind === 'outputs'
        ))
        .flatMap((intent) => {
          if (!intent.stream || intent.materializedOffset === undefined) {
            throw new Error('Authenticated eager journal output has no stable stream/location provenance.');
          }
          return intent.commitments.map((_commitment, index) => ({
            ...intent.stream!, collection: intent.collection, offset: intent.materializedOffset! + index,
          }));
        });
      const finalDispositionSelection = planAuthenticatedKernelJournalDispositionChain(
        authenticatedKernelJournalDispositions, selectedJournalHandlers, eagerOccurrences,
      );
      if (finalDispositionSelection.deferRuntimeJournalMaterialization) {
        throw new Error('Kernel journal disposition changed after runtime materialization.');
      }
      kernelJournalEagerOutputPlan = finalDispositionSelection.eagerOutputPlan;
    }

    // Materialize record carriers in source execution order. Streams in one compiler-published execution group
    // are operations from the same row loop, so iteration N of each stream executes before iteration N+1. The
    // group and stream ordinals are opaque structural metadata; no contract, collection, or function names
    // participate in this schedule.
    const kernelJournalRecords: Uint8Array[] = [];
    const remappedKernelStreamAccesses = new Map<
    (typeof runtimeKernelJournalStreams)[number], ReturnType<typeof decodeKernelEntryJournalAccesses>
    >();
    const settlementOccurrences: KernelEntryJournalSettlementOccurrence[] = [];
    const recordOriginStreams = new Map<number, (typeof runtimeKernelJournalStreams)[number]>();
    const globalRecordOrdinal = (stream: (typeof runtimeKernelJournalStreams)[number], local: number): number => {
      const collectionIdentity = binToHex(stream.collectionHash);
      const collectionPlan = plannedKernelCollections.get(collectionIdentity)!;
      const prior = collectionPlan.globalOrdinals.get(local);
      if (prior !== undefined) return prior;
      if (kernelJournalRecords.length >= KERNEL_ENTRY_JOURNAL_MAX_RECORDS) {
        throw new Error(
          `Kernel entry journal exceeds the protocol cap of ${KERNEL_ENTRY_JOURNAL_MAX_RECORDS} records.`,
        );
      }
      const ordinal = kernelJournalRecords.length;
      const record = collectionPlan.records[local];
      if (record === undefined) throw new Error('Kernel entry journal references an unknown local record ordinal.');
      collectionPlan.globalOrdinals.set(local, ordinal);
      kernelJournalRecords.push(record);
      recordOriginStreams.set(ordinal, stream);
      return ordinal;
    };
    for (const { stream, value: access, compactIndex } of scheduleKernelEntryJournalOccurrences(
      runtimeKernelJournalStreams, (candidate) => plannedKernelStreamAccesses.get(candidate) ?? [],
    )) {
      const remapped = {
        ...access,
        ...(access.predecessorRecordOrdinal !== undefined && {
          predecessorRecordOrdinal: globalRecordOrdinal(stream, access.predecessorRecordOrdinal),
        }),
        targetRecordOrdinal: globalRecordOrdinal(stream, access.targetRecordOrdinal),
      };
      const streamAccesses = remappedKernelStreamAccesses.get(stream) ?? [];
      streamAccesses.push(remapped);
      remappedKernelStreamAccesses.set(stream, streamAccesses);
      if (stream.settlementIdentity) settlementOccurrences.push({
        frameIndex: stream.frameIndex,
        identity: stream.settlementIdentity,
        accessOrdinal: compactIndex,
        access: remapped,
      });
    }
    for (const [collectionIdentity, plan] of plannedKernelCollections) {
      if (plan.globalOrdinals.size !== plan.records.length) {
        throw new Error(
          `Kernel entry journal for collection ${collectionIdentity} contains an unreachable record carrier.`,
        );
      }
    }
    // Do not infer a physical carrier protocol from ordinary journal flags. When (and only when) the compiler has
    // published the exact in-route marker capability, this one plan owns every cross-stream decision: first input,
    // rewritten zero-auth consumer, final output, and per-stream cardinality. A partial identity vector is not a
    // compatibility mode; it is an invalid claim for a route which asked the SDK to defer materialization.
    if (deferRuntimeJournalMaterialization
      && settlementOccurrences.length !== runtimeKernelJournalStreams.reduce(
        (count, stream) => count + (remappedKernelStreamAccesses.get(stream)?.length ?? 0), 0,
      )) {
      throw new Error(
        'Compiler internal-read-carrier capability requires settlement identities for every runtime journal access.',
      );
    }
    const physicalSettlementPlan = deferRuntimeJournalMaterialization && settlementOccurrences.length > 0
      ? planKernelEntryJournalPhysicalSettlement(settlementOccurrences) : undefined;
    const stableSettlementPlan = physicalSettlementPlan?.settlement ?? (settlementOccurrences.length > 0
      ? planKernelEntryJournalSettlementAuthority(settlementOccurrences) : undefined);

    if (physicalSettlementPlan) {
      // Replace only accesses returned by the authenticated global planner. Mapping by object identity keeps the
      // source-coordinate association intact even when a counter permutation makes compact stream order differ from
      // source execution order.
      const rewrittenAccesses = new Map<object, KernelEntryJournalAccess>();
      for (const planned of physicalSettlementPlan.occurrences) {
        rewrittenAccesses.set(planned.occurrence.access, planned.access);
      }
      for (const [stream, accesses] of remappedKernelStreamAccesses) {
        remappedKernelStreamAccesses.set(stream, accesses.map((access) => {
          const rewritten = rewrittenAccesses.get(access);
          if (!rewritten) {
            throw new Error('Kernel physical settlement lost a runtime journal access coordinate.');
          }
          return rewritten;
        }));
      }

      // The retained intent list supplies concrete UTXOs/unlockers only. Record identity and ownership come from
      // the planner, never from discovery order or application collection names.
      const inputByRecord = new Map<string, UnlockableUtxo>();
      for (const intent of runtimeJournalMaterializationIntents) {
        if (intent.kind !== 'input') continue;
        const commitment = intent.input.token?.nft?.commitment;
        if (!commitment) continue;
        const decoded = decodeEntryCommitment(hexToBin(commitment));
        const key = `${intent.collection}:${binToHex(decoded.slot)}`;
        const prior = inputByRecord.get(key);
        if (prior && (prior.txid !== intent.input.txid || prior.vout !== intent.input.vout)) {
          throw new Error(`Kernel physical settlement has ambiguous input candidates for ${key}.`);
        }
        inputByRecord.set(key, intent.input);
      }
      for (const input of physicalSettlementPlan.inputs) {
        const record = decodeKernelEntryJournalRecord(kernelJournalRecords[input.recordOrdinal]!);
        const owner = runtimeKernelJournalStreams.find((stream) => stream.frameIndex === input.firstOwner.frameIndex
          && stream.accessStreamIndex === input.firstOwner.accessStreamIndex);
        if (!owner) throw new Error('Kernel physical settlement input has no owning stream.');
        const candidate = inputByRecord.get(`${owner.collection}:${binToHex(record.slot)}`);
        if (!candidate) {
          throw new Error(`Kernel physical settlement input ${input.recordOrdinal} has no retained UTXO intent.`);
        }
        insertLoopPredecessors.push(candidate);
      }

      // Output records are dense in global ordinal order. Clean bodies are reconstructed from their authenticated
      // carrier. Dirty bodies are never inferred from the old per-handler commitment cache: after the planner has
      // assigned global record ordinals, bind one complete candidate commitment to each dirty final authority.
      // This path remains behind the compiler-authenticated capability so public artifact metadata cannot revive
      // the legacy source-order cache.
      const finalRecords = kernelJournalRecords.map((encoded) => decodeKernelEntryJournalRecord(encoded));
      const streamForSettlementReference = (
        reference: KernelEntryJournalSettlementReference,
      ): { stream: (typeof runtimeKernelJournalStreams)[number]; access: KernelEntryJournalAccess } => {
        const stream = runtimeKernelJournalStreams.find((candidate) => (
          candidate.frameIndex === reference.frameIndex
          && candidate.accessStreamIndex === reference.accessStreamIndex
        ));
        if (!stream) throw new Error('Kernel physical settlement output has no owning stream.');
        const access = remappedKernelStreamAccesses.get(stream)?.[reference.accessOrdinal];
        if (!access) {
          throw new Error(
            `Kernel physical settlement output has no access ${reference.accessOrdinal} in its owning stream.`,
          );
        }
        return { stream, access };
      };
      // Replay authenticated target-presence transitions in source order before assigning final output owners.
      // A synthetic target created by one insertion can be the predecessor owned by a later insertion, so its
      // final owner alone does not describe the earlier tombstone-to-live transition.
      for (const occurrence of physicalSettlementPlan.occurrences) {
        const access = occurrence.access;
        if (!access.mutates) continue;
        const record = finalRecords[access.targetRecordOrdinal]!;
        record.dirty = true;
        record.tombstone = !access.presentAfter;
        if (!access.presentBefore && access.presentAfter) {
          const predecessorOrdinal = access.predecessorRecordOrdinal;
          if (predecessorOrdinal === undefined) {
            throw new Error('Kernel journal insertion has no predecessor record.');
          }
          const predecessor = finalRecords[predecessorOrdinal]!;
          record.synthetic = true;
          record.nextKey = new Uint8Array(predecessor.nextKey);
          predecessor.nextKey = new Uint8Array(record.slot);
          predecessor.dirty = true;
        } else if (access.presentBefore && !access.presentAfter) {
          const predecessorOrdinal = access.predecessorRecordOrdinal;
          if (predecessorOrdinal === undefined) {
            throw new Error('Kernel journal deletion has no predecessor record.');
          }
          const predecessor = finalRecords[predecessorOrdinal]!;
          predecessor.nextKey = new Uint8Array(record.nextKey);
          predecessor.dirty = true;
        }
      }
      for (const output of physicalSettlementPlan.outputs) {
        const { access } = streamForSettlementReference(output.finalOwner);
        if ((output.finalOwner.settlementRole === 'mutation-settlement') !== access.mutates) {
          throw new Error('Kernel physical settlement final authority disagrees with its compact access.');
        }
        if (access.mutates) finalRecords[output.recordOrdinal]!.dirty = true;
      }

      // `runtimeJournalMaterializationIntents` carries the exact complete commitments calculated from current
      // state and user arguments. It is not an authority map. Each commitment retains the exact access/role which
      // produced it; the authenticated final settlement plan alone maps that producer to a global record ordinal.
      const dirtyProducerKey = (producer: KernelEntryJournalDirtyFinalBodyCandidate['producer']): string => (
        `${producer.frameIndex}:${producer.accessStreamIndex}:${producer.accessOrdinal}:${producer.recordRole}`
      );
      const dirtyProducerKeys = new Set(physicalSettlementPlan.outputs
        .filter((output) => finalRecords[output.recordOrdinal]!.dirty)
        .map((output) => dirtyProducerKey(output.finalOwner)));
      const deferredOutputCandidates = runtimeJournalMaterializationIntents
        .filter((intent): intent is Extract<RuntimeJournalMaterializationIntent, { kind: 'outputs' }> => (
          intent.kind === 'outputs'
        ))
        .flatMap((intent) => {
          if (!intent.producers || intent.producers.length !== intent.commitments.length) {
            throw new Error('Kernel physical settlement output body has no stable access producer identity.');
          }
          return intent.commitments.map((commitment, index) => ({
            commitment: hexToBin(commitment),
            producer: intent.producers![index]!,
          }));
        })
        .filter((candidate) => dirtyProducerKeys.has(dirtyProducerKey(candidate.producer)));
      const dirtyCandidates: KernelEntryJournalDirtyFinalBodyCandidate[] = deferredOutputCandidates;
      const dirtyBodies = new Map(resolveKernelEntryJournalDirtyFinalBodies(
        physicalSettlementPlan, finalRecords, dirtyCandidates,
      ).map((body) => [body.recordOrdinal, body.commitment]));
      const physicalLocations = new Map<number, { collection: string; offset: number }>();
      for (const output of physicalSettlementPlan.outputs) {
        const record = finalRecords[output.recordOrdinal]!;
        const { stream: owner } = streamForSettlementReference(output.finalOwner);
        const commitments = sortedLoopCommitments.get(owner.collection) ?? [];
        const offset = commitments.length;
        const commitment = record.dirty ? dirtyBodies.get(output.recordOrdinal)
          : encodeEntryCommitment(record.slot, record.nextKey, record.value);
        if (!commitment) {
          throw new Error(`Kernel physical settlement lost resolved dirty body for record ${output.recordOrdinal}.`);
        }
        commitments.push(binToHex(commitment));
        sortedLoopCommitments.set(owner.collection, commitments);
        physicalLocations.set(output.recordOrdinal, { collection: owner.collection, offset });
      }
      kernelJournalSettlementOutputPlan = physicalSettlementPlan.outputs.map((output) => {
        const location = physicalLocations.get(output.recordOrdinal);
        if (!location) throw new Error('Kernel physical settlement lost a dense output location.');
        return { recordOrdinal: output.recordOrdinal, outputOrdinal: output.outputOrdinal, ...location };
      });
      kernelJournalSettlementEntrySegments = kernelEntryJournalSettlementOutputSegments(
        kernelJournalSettlementOutputPlan,
      );

      // The route witnesses transaction-wide collection cardinality. Recompute it solely from physical ownership;
      // the deferred discovery walk deliberately did not advance the legacy per-handler counters.
      runtimeLoopCardinality.clear();
      const addPhysicalCardinality = (collection: string, inputs: number, outputs: number): void => {
        const prior = runtimeLoopCardinality.get(collection) ?? { inputs: 0, outputs: 0 };
        runtimeLoopCardinality.set(collection, {
          inputs: prior.inputs + inputs,
          outputs: prior.outputs + outputs,
        });
      };
      for (const input of physicalSettlementPlan.inputs) {
        const stream = runtimeKernelJournalStreams.find((candidate) => candidate.frameIndex === input.firstOwner.frameIndex
          && candidate.accessStreamIndex === input.firstOwner.accessStreamIndex);
        if (!stream) throw new Error('Kernel physical settlement input cardinality has no stream.');
        addPhysicalCardinality(stream.collection, 1, 0);
      }
      for (const output of physicalSettlementPlan.outputs) {
        const stream = runtimeKernelJournalStreams.find((candidate) => candidate.frameIndex === output.finalOwner.frameIndex
          && candidate.accessStreamIndex === output.finalOwner.accessStreamIndex);
        if (!stream) throw new Error('Kernel physical settlement output cardinality has no stream.');
        addPhysicalCardinality(stream.collection, 0, 1);
      }
    }
    if (pendingScalarSettlementActive) {
      // Current artifacts distinguish mutation authority from the final disposition of every record. Resolve the
      // physical present-record subsequence here; the trailing segment planner below emits that live band in global
      // first-touch order. Legacy artifacts retain only the exact-slot fallback and its existing physical order.
      const physicalLocations = new Map<number, { collection: string; offset: number }>();
      for (let recordOrdinal = 0; recordOrdinal < kernelJournalRecords.length; recordOrdinal += 1) {
        const disposition = stableSettlementPlan?.recordDispositions.get(recordOrdinal);
        if (stableSettlementPlan && !disposition) {
          throw new Error(
            `Kernel journal settlement identity has no disposition for record ${recordOrdinal}.`,
          );
        }
        const physicalReference = disposition?.reference;
        const authorityStream = physicalReference
          ? runtimeKernelJournalStreams.find((stream) => stream.frameIndex === physicalReference.frameIndex
            && stream.accessStreamIndex === physicalReference.accessStreamIndex)
          : recordOriginStreams.get(recordOrdinal);
        if (!authorityStream) {
          throw new Error(`Kernel journal settlement record ${recordOrdinal} has no containing access stream.`);
        }
        // Deletion/absence has authenticated settlement authority but intentionally no entry NFT output. Current
        // compiler admission keeps it out of pending scalar flushes; retaining the distinction here prevents this
        // SDK planner from silently turning a future tombstone protocol into a recreated node.
        if (physicalReference?.settlementDisposition === 'absence') continue;
        let commitments = sortedLoopCommitments.get(authorityStream.collection) ?? [];
        const record = decodeKernelEntryJournalRecord(kernelJournalRecords[recordOrdinal]!);
        let matchingCommitmentIndices = commitments.flatMap((commitment, index) => (
          binsAreEqual(decodeEntryCommitment(hexToBin(commitment)).slot, record.slot) ? [index] : []
        ));
        if (matchingCommitmentIndices.length === 0 && disposition?.basis !== 'mutation-settlement') {
          // A clean present read is still a materialized carrier in the compiler's final flush. Recreate its exact
          // authenticated body; unlike a mutation settlement, no speculative value derivation is involved.
          commitments = [...commitments, binToHex(encodeEntryCommitment(record.slot, record.nextKey, record.value))];
          sortedLoopCommitments.set(authorityStream.collection, commitments);
          matchingCommitmentIndices = [commitments.length - 1];
        }
        if (matchingCommitmentIndices.length !== 1) {
          throw new Error(
            `Kernel pending scalar output for '${authorityStream.collection}' requires exactly one commitment for `
            + `journal record ${recordOrdinal}; found ${matchingCommitmentIndices.length}.`,
          );
        }
        if (physicalReference) {
          physicalLocations.set(recordOrdinal, {
            collection: authorityStream.collection,
            offset: matchingCommitmentIndices[0]!,
          });
        }
      }
      if (stableSettlementPlan) {
        const resolveSettlementOutput = (authority: KernelEntryJournalSettlementReference): {
          collection: string; offset: number;
        } => {
          const location = physicalLocations.get(authority.recordOrdinal);
          if (!location) {
            throw new Error(
              `Kernel journal settlement record ${authority.recordOrdinal} has no physical output location.`,
            );
          }
          return location;
        };
        const pendingSettlementOutputs = planKernelEntryJournalSettlementOutputs(
          stableSettlementPlan, resolveSettlementOutput,
        );
        kernelJournalSettlementEntrySegments = kernelEntryJournalSettlementOutputSegments(
          pendingSettlementOutputs,
        );
        const plannedOutputCount = kernelJournalSettlementEntrySegments
          .reduce((count, segment) => count + segment.count, 0);
        const availableOutputCount = [...sortedLoopCommitments.values()]
          .reduce((count, commitments) => count + commitments.length, 0);
        if (plannedOutputCount !== availableOutputCount) {
          throw new Error(
            `Kernel journal settlement identity covers ${plannedOutputCount} physical outputs; `
            + `${availableOutputCount} runtime mapping outputs were planned.`,
          );
        }
      }
    }
    for (const stream of runtimeKernelJournalStreams) {
      stream.publish(encodeKernelEntryJournalAccesses(
        stream.collectionHash,
        remappedKernelStreamAccesses.get(stream) ?? [],
      ));
    }
    const journalRecordsIndex = entryAbiFunction?.inputs.findIndex(
      (input) => input.name === KERNEL_JOURNAL_RECORDS,
    ) ?? -1;
    const segmentWitnesses = kernelJournalRecordSegmentWitnesses(
      entryAbiFunction?.inputs ?? [], kernelJournalRecords,
    );
    if (kernelJournalRecords.length > 0 && journalRecordsIndex < 0 && segmentWitnesses.slots.length === 0) {
      throw new Error('Kernel runtime journal records have no compiler-owned route input.');
    }
    const routeKeyWitnessInputs = new Set((entryAbiFunction?.entryAccesses ?? []).flatMap((access) =>
      access.keyParams.map((name) => name.startsWith('id:') ? name.slice(3) : name)));
    const replaceJournalArgument = (argumentIndex: number, records: Uint8Array[] | Uint8Array): void => {
      if (entryCompilerRoute) {
        // A delegated route's complete argument frame belongs to the nested OP_INVOKE call. Its compilerRoute
        // metadata is published below and later re-encodes the proxy payload; extending the outer __forward
        // arguments with route witnesses would instead corrupt that two-argument ABI.
        entryArgs[argumentIndex] = records;
        return;
      }
      while (finalArgs.length <= argumentIndex) {
        const pending = entryAbiFunction!.inputs[finalArgs.length];
        const routeKeyWitness = pending?.name.startsWith('__message_bus_key_')
          && routeKeyWitnessInputs.has(pending.name);
        if (!pending?.name.startsWith('__internal__') && !routeKeyWitness) {
          throw new Error(
            `Internal error: missing user argument '${pending?.name ?? finalArgs.length}' before kernel records.`,
          );
        }
        if (routeKeyWitness) {
          const value = entryArgs[finalArgs.length];
          if (value === undefined) {
            throw new Error(`Kernel route key witness '${pending.name}' was not materialized.`);
          }
          finalArgs.push(value);
        } else {
          finalArgs.push(defaultInternalFunctionArg(pending));
        }
      }
      while (entryArgs.length <= argumentIndex) {
        entryArgs.push(defaultInternalFunctionArg(entryAbiFunction!.inputs[entryArgs.length]));
      }
      entryArgs[argumentIndex] = records;
      finalArgs[argumentIndex] = records;
    };
    const publishJournalWitness = (name: string, records: Uint8Array[] | Uint8Array): void => {
      for (const frame of upsertPlanningFrames) {
        if (!frame.routed) continue;
        frame.row!.internalArgs = {
          ...frame.row!.internalArgs,
          [name]: records,
        };
      }
      if (entryCompilerRoute) {
        entryCompilerRoute.internalArgs = {
          ...entryCompilerRoute.internalArgs,
          [name]: records,
        };
      }
    };
    if (segmentWitnesses.slots.length > 0) {
      for (const slot of segmentWitnesses.slots) {
        replaceJournalArgument(slot.inputIndex, slot.carrier);
        publishJournalWitness(slot.name, slot.carrier);
      }
    } else if (journalRecordsIndex >= 0) {
      const encodedKernelJournalCarrier = encodeFunctionArgument(
        kernelJournalRecords, 'bytes[]', stateLayout.structs,
      ) as Uint8Array;
      if (encodedKernelJournalCarrier.length > 520) {
        throw new Error(
          'Kernel entry journal requires segmented carrier inputs, but this compiler published only the legacy '
          + `${encodedKernelJournalCarrier.length}-byte monolithic carrier.`,
        );
      }
      replaceJournalArgument(journalRecordsIndex, kernelJournalRecords);
      publishJournalWitness(KERNEL_JOURNAL_RECORDS, kernelJournalRecords);
    }

    // Every row which can touch a collection receives the same transaction-wide runtime cardinality. The route
    // verifies that witness against the authenticated physical collection, then each selected handler subtracts
    // its locally proven width. Empty rows receive the same initial total and subtract zero.
    for (const upsertFrame of upsertPlanningFrames) {
      for (const collection of new Set(
        (upsertFrame.abiFunction.sortedUpsertLoopInfo ?? []).map((info) => info.collection),
      )) {
        const cardinality = runtimeLoopCardinality.get(collection) ?? { inputs: 0, outputs: 0 };
        const inputIndex = upsertFrame.abiFunction.inputs.findIndex(
          (input) => input.name === vmapRuntimeInputCountName(collection),
        );
        const outputIndex = upsertFrame.abiFunction.inputs.findIndex(
          (input) => input.name === vmapRuntimeOutputCountName(collection),
        );
        if (inputIndex < 0 || outputIndex < 0) {
          // Legacy loop forms retain their local cardinality covenant. The preflight above ensures such a
          // loop never shares its physical collection with another runtime loop in the same transaction.
          continue;
        }
        const replaceLoopArgument = (index: number, value: FunctionArgument): void => {
          if (!upsertFrame.routed) {
            upsertFrame.args[index] = value;
            // A promoted delegate entry encodes its own frame from entryArgs by name; the outer forwarder's
            // arguments must keep their own ABI shape.
            if (entryAbiFunction === abiFunction) finalArgs[index] = value;
            return;
          }
          const input = upsertFrame.abiFunction.inputs[index];
          const mutableInternal = upsertFrame.row!.internalArgs as Record<string, FunctionArgument>;
          mutableInternal[input.name] = value;
          const routeIndex = entryAbiFunction!.inputs.findIndex((candidate) => candidate.name === input.name);
          if (routeIndex < 0) throw new Error(
            `Message-bus route is missing compiler-owned loop argument '${input.name}'`,
          );
          entryArgs[routeIndex] = value;
          if (entryCompilerRoute) {
            entryCompilerRoute.internalArgs = { ...entryCompilerRoute.internalArgs, [input.name]: value };
          } else {
            args[routeIndex] = value;
            finalArgs[routeIndex] = value;
          }
        };
        replaceLoopArgument(inputIndex, BigInt(cardinality.inputs));
        replaceLoopArgument(outputIndex, BigInt(cardinality.outputs));
      }
    }

    // Handle external state reads (cross-contract reads via interfaces)
    const externalReadsHost: LoadCreateBuilderExternalReadsHost = {
      artifact: this.inner.artifact,
      network: this.inner.provider.network,
      addressType: this.inner.addressType,
      unlockerContract: this.inner,
      resolveExternalCategoryId: (...a: any[]) => (this as any)._resolveExternalCategoryId(...a),
      getExternalDataNftAddress: (...a: any[]) => (this as any)._getExternalDataNftAddress(...a),
      findExternalDataNft: (...a: any[]) => (this as any)._findExternalDataNft(...a),
      getUtxos: (address) => this.inner.provider.getUtxos(address),
      keysMatch: (...a: any[]) => (this as any)._keysMatch(...a),
      externalMasterLock: (categoryId: string) => {
        for (const ext of this._externalRegistry.values()) {
          if (ext.categoryId !== categoryId) continue;
          return directConventionMasterLock(ext.inner);
        }
        return undefined;
      },
    };
    const externalReadUtxos = await loadCreateBuilderExternalReadsImpl(
      externalReadsHost,
      functionName,
      abiFunction,
      overrides,
    );

    // blockhash(n) oracle co-spends: resolved AFTER the master unlocker is built (below), since the computed-n
    // extraction probe needs the complete unlocker (it carries the blockhash slot base index). Placed 1:1 at
    // the consecutive blockhashOracle slots. Only consumed at builder construction, so resolving them late is
    // safe.
    let blockhashCoSpendUtxos: UnlockableUtxo[] = [];
    let blockInfoCoSpendUtxos: UnlockableUtxo[] = [];
    let delegateBlockInfoOracle = false;
    let blockhashCoSpendSlotOrdinals: number[] | undefined;
    let maxBhLocktime = 0; // require(tx.time >= n) - the SDK sets the locktime so the derivation probe passes
    // keccak256 compute side-cars co-spent at the keccakSideCar slots; parallel commitments (R_i) drive the
    // recreation. Resolved late (needs the master unlocker's args) alongside blockhash.
    let keccakComputeCoSpendUtxos: UnlockableUtxo[] = [];
    let keccakComputeCommitments: string[] = [];
    let deferredKeccakCompute: {
      salt: Uint8Array; legacy: boolean; preimages: Array<Uint8Array | null>;
    } | undefined;
    let deferredEcrecoverCompute: {
      salt: Uint8Array; argBlobs: Array<Uint8Array | null>;
      evmKeccakPreimageIndices: number[];
    } | undefined;
    let delegateComputeResources = false;
    let ecrecoverComputeCoSpendUtxos: UnlockableUtxo[] = [];
    let ecrecoverComputeRecreates: Output[] = [];

    // Pre-declare outState variables (populated later, but needed for base computations in external calls)
    let externalOutStateUtxoGroups: ExternalCallUtxoGroup[] = [];
    let outStateInputCount = 0;

    // Handle external function calls (cross-contract calls via interfaces)
    const externalCallsOrchestrated = await orchestrateCreateBuilderExternalCallsImpl(
      {
        categoryId: this.categoryId,
        inner: this.inner,
        signer: this._signer,
        externalRegistry: this._externalRegistry,
        callerContract: this,
        // Predicates plan the same authenticated clock and state that stored-value recipes and the VM read.
        getFullState: async () => ({ ...onChainState, state: recipeState }),
        resolveExternalArgs: (...a: any[]) => (this as any)._resolveExternalArgs(...a),
        buildRepeatedExternalBatch: (...a: any[]) => (this as any)._buildRepeatedExternalBatch(...a),
        resolveExternalKeccakSideCars: (...a: any[]) => (this as any)._resolveExternalKeccakSideCars(...a),
        resolveExternalBlockhashCoSpends: (...a: any[]) => (this as any)._resolveExternalBlockhashCoSpends(...a),
        keysMatch: (...a: any[]) => (this as any)._keysMatch(...a),
      },
      {
        abiFunction,
        args,
        finalArgs,
        overrides,
        onChainState,
        requiredNftIndices,
        externalReadUtxos,
        outStateInputCount,
        externalOutStateUtxoGroups,
        earlySignerUtxos,
        publicSelfAddress,
        publicSelfIdentity,
        physicalSelfAddress: executionSelfAddress,
        rootLogicalAddress: this._logicalAddress,
        timing,
        valueChunkWriteStagingSession,
        iterationEntryInputs,
        entryNfts,
        condSoftDeleteSlots,
        entryDeleteSlots,
        selectorParamSlot,
        isComputedBlockhashKey,
        maxBhLocktime,
      },
    );
    const rootProducerPath = externalCallsOrchestrated.rootProducerPath;
    let externalCallUtxoGroups = externalCallsOrchestrated.externalCallUtxoGroups;
    let allGroupEcSlots = externalCallsOrchestrated.allGroupEcSlots;
    let allGroupParentIndices = externalCallsOrchestrated.allGroupParentIndices;
    let sharedFunderPool = externalCallsOrchestrated.sharedFunderPool;
    let sharedFunderSnapshot = externalCallsOrchestrated.sharedFunderSnapshot;
    const consumedSharedFunders = externalCallsOrchestrated.consumedSharedFunders;
    const embeddedFunderUtxos = externalCallsOrchestrated.embeddedFunderUtxos;
    const markSharedFunder = externalCallsOrchestrated.markSharedFunder;
    const identityAnchors = externalCallsOrchestrated.identityAnchors;
    const identityAnchorBandByAddress = externalCallsOrchestrated.identityAnchorBandByAddress;
    finalArgs = externalCallsOrchestrated.finalArgs;
    const pendingAnchorFills = externalCallsOrchestrated.pendingAnchorFills;
    const pendingExternalCallInputFills = externalCallsOrchestrated.pendingExternalCallInputFills;
    const pendingTokenCallInputFills = externalCallsOrchestrated.pendingTokenCallInputFills;
    const pendingDelegateInputFills = externalCallsOrchestrated.pendingDelegateInputFills;
    const pendingDynamicChunkInputFills = externalCallsOrchestrated.pendingDynamicChunkInputFills;
    const topLevelAnchorFillPositions = externalCallsOrchestrated.topLevelAnchorFillPositions;
    const msgSenderAnchorArgIndex = abiFunction?.inputs.findIndex(
      (input) => input.name === '__internal__msgSenderAnchorIdx',
    ) ?? -1;
    const probeCallerIdentity = overrides?.callerIdentityUtxos?.find((utxo) =>
      utxo.token?.nft?.capability === 'none'
      && isScidIdentityCommitment(utxo.token.nft.commitment));
    if (msgSenderAnchorArgIndex >= 0 && probeCallerIdentity?.token !== undefined) {
      // Return probes carry the caller master in the read band and its CREATE identity as a separate SCID.
      // Its absolute input coordinate is only known after funding/layout assembly, just like callee anchors.
      topLevelAnchorFillPositions.push({
        argIndex: msgSenderAnchorArgIndex,
        categoryId: probeCallerIdentity.token.category,
        proxyRoute: false,
      });
    }
    const topLevelReturnWitnessGroups = externalCallsOrchestrated.topLevelReturnWitnessGroups;
    externalOutStateUtxoGroups = externalCallsOrchestrated.externalOutStateUtxoGroups;
    outStateInputCount = externalCallsOrchestrated.outStateInputCount;
    maxBhLocktime = externalCallsOrchestrated.maxBhLocktime;
    // external-calls-orchestration-complete (size-guarded; LLC nested-caches follow)

    const lowLevelNestedCaches = await prepareCreateBuilderLowLevelNestedCachesImpl(
      {
        signer: this._signer,
        inner: this.inner,
        syncMockParticipantOracle: (contract: any) => syncMockParticipantOracle(contract),
        resolveExternalArgs: (...a: any[]) => (this as any)._resolveExternalArgs(...a),
      },
      {
        abiFunction,
        physicalAbiFunction,
        earlySignerUtxos,
        sharedFunderPool,
        sharedFunderSnapshot,
        timingEnabled,
        externalCallUtxoGroups,
        identityAnchors,
        identityAnchorBandByAddress,
      },
    );
    const lowLevelCalls = lowLevelNestedCaches.lowLevelCalls;
    let lowLevelCallUtxoGroups = lowLevelNestedCaches.lowLevelCallUtxoGroups;
    sharedFunderPool = lowLevelNestedCaches.sharedFunderPool;
    sharedFunderSnapshot = lowLevelNestedCaches.sharedFunderSnapshot;
    const nestedProxyReadCache = lowLevelNestedCaches.nestedProxyReadCache;
    const nestedSortedListCache = lowLevelNestedCaches.nestedSortedListCache;
    const nestedAddressUtxos = lowLevelNestedCaches.nestedAddressUtxos;
    const nestedIdentity = lowLevelNestedCaches.nestedIdentity;
    const resolveNestedIdentityAnchorBands = lowLevelNestedCaches.resolveNestedIdentityAnchorBands;
    const directNestedIdentityWitness = lowLevelNestedCaches.directNestedIdentityWitness;
    const nestedFullState = lowLevelNestedCaches.nestedFullState;
    const nestedMasterState = lowLevelNestedCaches.nestedMasterState;
    let lowLevelCallRawInputs = lowLevelNestedCaches.lowLevelCallRawInputs;
    let lowLevelCallInputBase = lowLevelNestedCaches.lowLevelCallInputBase;
    let activeDelegateGroupIndex = lowLevelNestedCaches.activeDelegateGroupIndex;
    let hasDelegatedDynamicReadChunks = lowLevelNestedCaches.hasDelegatedDynamicReadChunks;
    let delegateEventSlots = lowLevelNestedCaches.delegateEventSlots;
    let delegateReturnEventOffset = lowLevelNestedCaches.delegateReturnEventOffset;
    const groupProxyMasterIndices = lowLevelNestedCaches.groupProxyMasterIndices;
    const delegateExternalGroupIndices = lowLevelNestedCaches.delegateExternalGroupIndices;
    const delegateExternalGroupByCallsite = lowLevelNestedCaches.delegateExternalGroupByCallsite;
    const routeValueChunkProducerEpochByPhysicalGroup =
      lowLevelNestedCaches.routeValueChunkProducerEpochByPhysicalGroup;
    const lateTransitiveGroupIndices = lowLevelNestedCaches.lateTransitiveGroupIndices;
    const nestedDelegateProxyGroupByLowLevel = lowLevelNestedCaches.nestedDelegateProxyGroupByLowLevel;
    const selectActiveRootDelegateGroup = lowLevelNestedCaches.selectActiveRootDelegateGroup;
    let preparedAtomicNodes = lowLevelNestedCaches.preparedAtomicNodes;
    const preparedAtomicNodeByExternalGroup = lowLevelNestedCaches.preparedAtomicNodeByExternalGroup;
    const latestPreparedAtomicNodeByPhysicalGroup =
      lowLevelNestedCaches.latestPreparedAtomicNodeByPhysicalGroup;
    // Materialization initializes/replaces the node list after cache creation. Resolve the parent here,
    // from the current list, rather than capturing the cache prelude's initially undefined array.
    const preparedChildProducerPath = (
      parentIndex: number,
      source: Parameters<typeof lowLevelNestedCaches.preparedChildProducerPath>[1],
    ): ValueChunkProducerPathDisposition =>
      lowLevelNestedCaches.preparedChildProducerPath(preparedAtomicNodes?.[parentIndex], source);
    let nestedFunderIndex = lowLevelNestedCaches.nestedFunderIndex;
    // low-level-nested-caches-complete (size-guarded end marker for prepareCreateBuilderLowLevelNestedCaches)

    const selectRootOracleReader = (): ReturnType<typeof selectRootBlockOracleReader<Contract>> =>
      selectRootBlockOracleReader(this.inner, abiFunction, lowLevelCallUtxoGroups.map((group, groupIndex) => ({
        rootOwned: !nestedDelegateProxyGroupByLowLevel.has(groupIndex),
        reader: group.externalContract.inner,
        callMode: group.callMode,
        abiFunction: group.compilerRoute?.abiFunction
          ?? (group.externalContract.inner.artifact.abi as readonly AbiFunction[])
            .find((candidate) => candidate.name === group.functionName),
      })));
    const nestedBlockOracleLocks = new Set<string>();
    for (const group of externalCallUtxoGroups) {
      if (group.sharedGroupIndex !== undefined) continue;
      const offset = group.blockLayout?.slots.find((slot) => slot.kind === 'blockInfoOracle')?.offset;
      const input = offset === undefined ? undefined : group.blockInputs?.[offset];
      if (input?.token?.nft?.capability === 'mutable') {
        nestedBlockOracleLocks.add(binToHex(input.unlocker.generateLockingBytecode()));
      }
    }
    if (lowLevelCalls && lowLevelCalls.length > 0) {
      const resolvedCalls = overrides?.calls ?? [];

      for (let i = 0; i < lowLevelCalls.length; i++) {
        const callInfo = resolvedCalls[i];
        if (!callInfo) {
          // Low-level calls require explicit .withCall() - skip if not provided
          // (the builder will be rebuilt when .withCall() is used)
          continue;
        }

        if (callInfo.type === 'stateful') {
          const materializedLlc = await materializeCreateBuilderLowLevelStatefulCallImpl(
            {
              categoryId: this.categoryId,
              inner: this.inner,
              selfContract: this as any,
              getMasterOnlyState: (contract: any) => contract._getMasterOnlyState(),
              getFullState: (contract: any) => contract.getFullState(),
              getEntries: (name: string) => this.getEntries(name),
              statefulCall: (name: string) => statefulCall(name),
              resolveExternalExpressionReturns: (...a: any[]) => (
                this as any
              )._resolveExternalExpressionReturns(...a),
              evaluateExternalExpression: (...a: any[]) => (
                this as any
              )._evaluateExternalExpression(...a),
              planExternalCallOccurrences: (...a: any[]) => (
                this as any
              )._planExternalCallOccurrences(...a),
            },
            {
              callInfo,
              callMode: lowLevelCalls[i].callMode,
              lowLevelCallUtxoGroups,
              groupProxyMasterIndices,
              abiFunction,
              physicalAbiFunction,
              functionName,
              args,
              callIndex: i,
              preparedAtomicNodes,
              rootProducerPath,
              publicSelfAddress,
              authenticatedSelfAddress,
              incomingCallerAddress: overrides?.callerLockingBytecode
                ?? probeCallerIdentity?.unlocker.generateLockingBytecode(),
              onChainState,
            },
          );
          preparedAtomicNodes = materializedLlc.preparedAtomicNodes;
          // llc-stateful-materialize-complete (size-guarded; nested compose follows for delegatecall)
          if (lowLevelCalls[i].callMode === 'delegatecall') {
            const delegateGroupIndex = materializedLlc.delegateGroupIndex!;
            const delegateFn = materializedLlc.delegateFn;
            const nestedExternalCalls = materializedLlc.nestedExternalCalls;
            const publishedNestedExternalCalls = materializedLlc.publishedNestedExternalCalls;
            const delegateVisibleArgs = materializedLlc.delegateVisibleArgs;
            const delegateVisibleInputs = materializedLlc.delegateVisibleInputs;
            const delegateSelfAddress = materializedLlc.delegateSelfAddress;
            const delegateCallerIdentity = materializedLlc.delegateCallerIdentity!;
            const graphPlanningResults = materializedLlc.graphPlanningResults;
            let nestedIndices = materializedLlc.nestedIndices;
            const nestedByCallsite = materializedLlc.nestedByCallsite;
            for (const nested of nestedExternalCalls) {
              const orchestrated = await orchestrateCreateBuilderNestedComposeCallsiteImpl(
                {
                  categoryId: this.categoryId,
                  inner: this.inner,
                  sharedBlockOracleLocks: nestedBlockOracleLocks,
                  signer: this._signer,
                  logicalNonceSigner: this._logicalNonceSigner,
                  externalRegistry: this._externalRegistry,
                  resolveExternalArgs: (...a: any[]) => (this as any)._resolveExternalArgs(...a),
                  resolveExternalExpressionReturns: (...a: any[]) => (
                    this as any
                  )._resolveExternalExpressionReturns(...a),
                  buildRepeatedExternalBatch: (...a: any[]) => (this as any)._buildRepeatedExternalBatch(...a),
                  replaceRepeatedExternalBatchRow: (...a: any[]) => (
                    this as any
                  )._replaceRepeatedExternalBatchRow(...a),
                  encodeStoredElementSource: (...a: any[]) => (this as any)._encodeStoredElementSource(...a),
                  encodeStoredValueSource: (...a: any[]) => (this as any)._encodeStoredValueSource(...a),
                  nestedIdentity,
                  nestedFullState,
                  nestedMasterState,
                  nestedAddressUtxos,
                  markSharedFunder: (utxo: UnlockableUtxo) => markSharedFunder(utxo),
                  shiftSharedFunder: () => sharedFunderPool?.shift(),
                  nextNestedFunderIndex: () => nestedFunderIndex++,
                  describeValueChunkWrites,
                  preparedChildProducerPath,
                  selectProxyForwardInput,
                  resolvePreparedProducerEntry,
                  externalReturnsForCallsites,
                  externalCallReachedOccurrenceIndices: (...a: any[]) => (
                    externalCallReachedOccurrenceIndices as any
                  )(...a),
                  planExternalCallOccurrences: (...a: any[]) => (
                    this as any
                  )._planExternalCallOccurrences(...a),
                  concatBytes: (...a: any[]) => (StatefulContract as any)._concatBytes(...a),
                },
                {
                  nested,
                  delegateGroupIndex,
                  delegateFn,
                  nestedExternalCalls,
                  publishedNestedExternalCalls,
                  delegateVisibleArgs,
                  delegateVisibleInputs,
                  delegateSelfAddress,
                  delegateCallerIdentity,
                  graphPlanningResults,
                  callInfo,
                  onChainState,
                  preparedAtomicNodes,
                  rootProducerPath,
                  nestedIndices,
                  nestedByCallsite,
                  externalCallUtxoGroups,
                  lowLevelCallUtxoGroups,
                  groupProxyMasterIndices,
                  nestedDelegateProxyGroupByLowLevel,
                  timingEnabled,
                  functionName,
                  allGroupEcSlots,
                  allGroupParentIndices,
                  routeValueChunkProducerEpochByPhysicalGroup,
                  preparedAtomicNodeByExternalGroup,
                  latestPreparedAtomicNodeByPhysicalGroup,
                  nestedSortedListCache,
                  valueChunkWriteStagingSession,
                  sharedFunderPool,
                  nestedFunderIndex,
                  publicSelfAddress,
                  nestedProxyReadCache,
                  memoizeGraphPlanningProducerResult,
                  routeValueChunkProducerAliases: undefined,
                  routeValueChunkProducerPhysicalGroup: undefined,
                  routeValueChunkProducerEpoch: undefined,
                  latestRouteValueChunkProducerBinding: undefined,
                  refreshChunkableRouteWitnesses: undefined,
                },
              );
              if (orchestrated.skipped) continue;
              allGroupEcSlots = orchestrated.allGroupEcSlots;
              allGroupParentIndices = orchestrated.allGroupParentIndices;
              nestedIndices = orchestrated.nestedIndices;
              // nestedByCallsite mutated in place via Map reference
            }
            // nested-compose-callsite-orch-complete (size-guarded end marker)

            delegateExternalGroupIndices.set(delegateGroupIndex, nestedIndices);
            delegateExternalGroupByCallsite.set(delegateGroupIndex, nestedByCallsite);

          }
        } else {
          lowLevelCallRawInputs.push(callInfo.utxo);
        }
      }

      timing('nested-compose-all-complete');
      {
        const lateBags = await expandCreateBuilderLateTransitiveImpl(
          {
            categoryId: this.categoryId,
            inner: this.inner,
            signer: this._signer,
            externalRegistry: this._externalRegistry,
            nestedFullState: (contract: any) => nestedFullState(contract),
            nestedAddressUtxos,
            markSharedFunder: (utxo: UnlockableUtxo) => markSharedFunder(utxo),
            shiftSharedFunder: () => sharedFunderPool?.shift(),
            nextNestedFunderIndex: () => nestedFunderIndex++,
            selectProxyForwardInput: (...a: any[]) => (selectProxyForwardInput as any)(...a),
            preparedChildProducerPath,
            timing: (label: string) => timing(label),
          },
          {
            externalCallUtxoGroups,
            lowLevelCallUtxoGroups,
            preparedAtomicNodes,
            preparedAtomicNodeByExternalGroup,
            publicSelfAddress,
            bags: {
              allGroupEcSlots,
              allGroupParentIndices,
              lateTransitiveGroupIndices,
            },
          },
        );
        allGroupEcSlots = lateBags.allGroupEcSlots;
        allGroupParentIndices = lateBags.allGroupParentIndices;
        // lateTransitiveGroupIndices mutated in place via Set reference
      }
      const delegatedDyn = await createBuilderLoadDelegatedDynamicChunksImpl(
        {
          categoryId: this.categoryId,
          inner: this.inner as any,
        },
        {
          lowLevelCallUtxoGroups,
          stateLayout,
          dynamicReads,
          iterationEntryInputs,
          hasDelegatedDynamicReadChunks,
          onChainState,
          blockBase: overrides?.blockBase ?? 0,
          phaseCheckpoint: timing,
        },
      );
      iterationEntryInputs = delegatedDyn.iterationEntryInputs;
      hasDelegatedDynamicReadChunks = delegatedDyn.hasDelegatedDynamicReadChunks;
      const delegatedDynamicWriteChunkCount = delegatedDyn.delegatedDynamicWriteChunkCount;

      // Compute _callInputIndex values
      const externalCallInputCount = externalCallUtxoGroups.reduce(
        (sum, g) => sum + (g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length)
          + (g.ordinaryDynamicChunkInputs?.length ?? 0), 0,
      );
      timing('external-input-count');

      // A forwarding proxy commits one executor by bytecode. Resolve that edge once and reuse the selected
      // physical group for layout, hidden witnesses, resource ownership, and VM derivation. Nested proxy
      // delegates belong to their own physical owners and are outside this root forwarding scope.
      activeDelegateGroupIndex = selectActiveRootDelegateGroup();
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_FORWARD_ARGS === '1') {
        console.error('authenticated-root-delegate-selection', {
          functionName,
          physicalFunction: physicalAbiFunction?.name,
          hasForwarding: physicalAbiFunction?.delegateForwarding !== undefined,
          candidates: lowLevelCallUtxoGroups.flatMap((group, groupIndex) => (
            group.callMode === 'delegatecall' && !nestedDelegateProxyGroupByLowLevel.has(groupIndex)
              ? [groupIndex] : []
          )),
          selected: activeDelegateGroupIndex,
        });
      }

      // Complete the nested callee unlockers now that every external group has a
      // stable absolute input position.
      const denseCallInputBase = 1 + requiredNftIndices.length
        + externalReadUtxos.length + outStateInputCount + externalCallInputCount;
      const hasDelegatecallGroup = lowLevelCallUtxoGroups.some((g) => g.callMode === 'delegatecall');
      const physicalDelegateCarrierOwnsCallSlot = physicalAbiFunction?.lowLevelCalls
        ?.some((call) => call.callMode === 'delegatecall') === true
        && physicalAbiFunction.blockLayout?.slots.some((slot) => slot.kind === 'lowLevelCall') === true;
      const authenticatedDelegateGroup = activeDelegateGroupIndex === undefined
        ? undefined : lowLevelCallUtxoGroups[activeDelegateGroupIndex];
      const compilerRouteDelegate = authenticatedDelegateGroup?.compilerRoute?.abiFunction.blockLayout
        ? authenticatedDelegateGroup
        : lowLevelCallUtxoGroups.find(
          (g, groupIndex) => g.callMode === 'delegatecall'
            && !nestedDelegateProxyGroupByLowLevel.has(groupIndex)
            && g.compilerRoute?.abiFunction.blockLayout,
        );
      const compilerRouteDelegateLayout = compilerRouteDelegate?.compilerRoute?.abiFunction.blockLayout
        ?? (physicalAbiFunction?.delegateForwarding || physicalDelegateCarrierOwnsCallSlot
          ? undefined
          : selectDelegateExecutionLayout(lowLevelCallUtxoGroups, nestedDelegateProxyGroupByLowLevel));
      timing('delegate-route-selected');
      lowLevelCallInputBase = compilerRouteDelegateLayout
        // A compiler-owned route executes against the proxy's state, but its entry/proof resources still occupy
        // the complete balanced route block rooted at the proxy master. As for nested proxies, the implementation
        // follows that physical block; placing it after only the proxy data NFTs overwrites route slot 3.
        ? compilerRouteDelegateLayout.blockSize
        : hasDelegatecallGroup
        // Delegate bytecode binds its proxy-master witness to the physical relation
        // `delegateInput - (1 + proxyDataNftCount)`. Nested callees therefore follow the implementation.
          ? 1 + requiredNftIndices.length
          : denseCallInputBase;
      const delegateInputCount = lowLevelCallUtxoGroups
        .filter((group, groupIndex) => group.callMode === 'delegatecall'
          && !nestedDelegateProxyGroupByLowLevel.has(groupIndex))
        .reduce((sum, group) => sum + 1 + group.dataNftUtxos.length, 0);
      const hasNestedDelegate = delegateInputCount > 0;
      const legacyRouteDelegate = authenticatedDelegateGroup ?? compilerRouteDelegate ?? lowLevelCallUtxoGroups.find(
        (group) => group.callMode === 'delegatecall' && group.externalContract,
      );
      const legacyRouteDelegateFn = legacyRouteDelegate?.compilerRoute?.abiFunction
        ?? (legacyRouteDelegate?.externalContract?.inner.artifact.abi as readonly AbiFunction[] | undefined)
          ?.find((candidate) => candidate.name === legacyRouteDelegate?.functionName);
      const legacyRouteTrailingBase = legacyRouteDelegateFn?.blockLayout?.trailingBase
        ?? legacyRouteDelegateFn?.blockLayout?.blockSize;
      const delegatedLoopCollections = new Set([
        ...(legacyRouteDelegateFn?.sortedUpsertLoopInfo ?? []).map((info) => info.collection),
        ...(legacyRouteDelegateFn?.sortedInsertLoopInfo ?? []).map((info) => info.collection),
      ]);
      const delegatedDynamicSuffix = (legacyRouteDelegateFn?.dynamicWrites?.length ?? 0) > 0
        || (legacyRouteDelegateFn?.dynamicReads?.length ?? 0) > 0 || hasDelegatedDynamicReadChunks
        || delegatedLoopCollections.size > 0;
      const delegatedLoopOutputCount = [...sortedLoopCommitments.entries()]
        .filter(([collection]) => delegatedLoopCollections.has(collection))
        .reduce((sum, [, commitments]) => sum + commitments.length, 0);
      const delegatedLoopOutputSurplus = Math.max(
        0,
        Math.max(delegatedLoopOutputCount, insertLoopPredecessors.length * 2) - insertLoopPredecessors.length,
      );
      timing('delegate-loop-count');
      // `_buildInputs` materializes the complete route block, then every low-level implementation input, then
      // participant blocks. Input coordinates therefore start after that implementation band; output coordinates
      // remain packed from `nestedOutputBase` and are intentionally tracked separately below.
      const allLowLevelInputCount = lowLevelCallUtxoGroups
        .reduce((sum, group) => sum + 1 + group.dataNftUtxos.length, 0);
      timing('low-level-input-count');
      const nestedBases = planCreateBuilderNestedBasesImpl({
        compilerRouteDelegateLayout,
        lowLevelCallInputBase,
        allLowLevelInputCount,
        hasNestedDelegate,
        delegatedDynamicSuffix,
        legacyRouteTrailingBase,
        iterationEntryInputs,
        insertLoopPredecessors,
        delegatedDynamicWriteChunkCount,
        requiredNftIndices,
        delegateInputCount,
        externalReadUtxos,
        outStateInputCount,
        delegatedLoopOutputSurplus,
        delegatedLoopOutputCount,
        abiFunction,
        lowLevelCallUtxoGroups,
        externalCallUtxoGroups,
        externalOutStateUtxoGroups,
        legacyRouteDelegateFn,
        returnEmitOutputIndex,
        overrides,
        functionName,
        allGroupEcSlots,
        timing,
      });
      const nestedMasterIndices = nestedBases.nestedMasterIndices;
      const nestedOutputBases = nestedBases.nestedOutputBases;
      const delegateReturnOutputBase = nestedBases.delegateReturnOutputBase;
      const returningExternalGroups = nestedBases.returningExternalGroups;
      const physicalReturnIndexForGroup = nestedBases.physicalReturnIndexForGroup;
      const tailReturnRank = (a: number, b: number): number => {
        const name = (idx: number): string => externalCallUtxoGroups[idx]?.functionName ?? '';
        const proxy = (idx: number): number => (name(idx) === '__forward' ? 0 : 1);
        return proxy(a) - proxy(b) || a - b;
      };
      // Tail ranks were assigned before in-block returns were rebased onto physical
      // masters. A later token/callee in-block return can land on the same index as
      // rank 0 (a repeated writer: token approval and nested tail shared one output index).
      // Re-pack remaining tail witnesses after every in-block return.
      const relocated = relocateCreateBuilderPredOutBasesImpl({
        externalCallUtxoGroups,
        lowLevelCallUtxoGroups,
        returningExternalGroups,
        nestedMasterIndices,
        physicalReturnIndexForGroup,
        delegateReturnOutputBase,
        lowLevelCallInputBase,
        entryAbiFunction,
        tailReturnRank,
      });
      const relocatedPredOutBase = relocated.relocatedPredOutBase;
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_ROUTE === '1') {
        console.error('nested-route-layout', {
          external: externalCallUtxoGroups.map((group, index) => ({
            index,
            functionName: group.functionName,
            size: group.blockInputs?.length ?? 1 + group.dataNftUtxos.length,
            layoutSize: group.blockLayout?.blockSize,
            plannedInserts: group.plannedEntryInserts,
            predecessorOutputs: group.batchPredecessorOutputs,
            internalArgs: Object.fromEntries(Object.entries({
              ...group.compilerRoute?.internalArgs,
              ...group.internalArgs,
            }).filter(([name]) => name.includes('vmapBatch')).map(([name, value]) => [
              name,
              typeof value === 'bigint' ? value.toString()
                : value instanceof Uint8Array ? binToHex(value) : value,
            ])),
            sharedGroupIndex: group.sharedGroupIndex,
            delegateCallGroupIndex: group.delegateCallGroupIndex,
            nestedMasterIndex: nestedMasterIndices[index],
            returnOutputIndex: physicalReturnIndexForGroup.get(index),
          })),
          lowLevel: lowLevelCallUtxoGroups.map((group, index) => ({
            index, functionName: group.functionName, callMode: group.callMode,
            size: 1 + group.dataNftUtxos.length,
          })),
          callerCategoryId: this.categoryId,
          activeMasterCategory: masterUtxo.token?.category,
          callerCategoryWitness: binToHex(hexToBin(this.categoryId).reverse()),
        });
      }

      await completeCreateBuilderNestedUnlockersImpl(
        {
          categoryId: this.categoryId,
          timing: (label: string) => timing(label),
          ensureNestedIdentityAnchorBand: lowLevelNestedCaches.ensureNestedIdentityAnchorBand,
          resolveNestedIdentityAnchorBands,
          nestedFullState: (contract: any) => nestedFullState(contract),
          selectProxyForwardInput: (...a: any[]) => (selectProxyForwardInput as any)(...a),
          directNestedIdentityWitness: (...a: any[]) =>
            (directNestedIdentityWitness as any)(...a),
        },
        {
          externalCallUtxoGroups,
          lowLevelCallUtxoGroups,
          returningExternalGroups,
          physicalReturnIndexForGroup,
          nestedMasterIndices,
          nestedOutputBases,
          relocatedPredOutBase,
          allGroupParentIndices,
          allGroupEcSlots,
          delegateExternalGroupIndices,
          delegateExternalGroupByCallsite,
          lateTransitiveGroupIndices,
          pendingDelegateInputFills,
          pendingAnchorFills,
          pendingExternalCallInputFills,
          entryAbiFunction,
          identityAnchors,
          publicSelfAddress,
          authenticatedSelfAddress,
          physicalSelfAddress: executionSelfAddress,
          logicalCreateLock,
        },
      );
      {
        const projected = projectCreateBuilderDelegateSlotsImpl({
          lowLevelCallUtxoGroups,
          nestedDelegateProxyGroupByLowLevel,
          abiFunction,
          delegateEventSlots,
          delegateReturnEventOffset,
          returnEmitOutputIndex,
          returnEmitBlockOffset,
          returnMaterializationOutputIndex,
          overrides,
          timing,
        });
        delegateEventSlots.length = 0;
        delegateEventSlots.push(...projected.delegateEventSlots);
        delegateReturnEventOffset = projected.delegateReturnEventOffset;
        returnEmitBlockOffset = projected.returnEmitBlockOffset as typeof returnEmitBlockOffset;
        returnEmitOutputIndex = projected.returnEmitOutputIndex;
        returnMaterializationOutputIndex =
          projected.returnMaterializationOutputIndex as typeof returnMaterializationOutputIndex;
      }
      await fixCreateBuilderDelegateUnlockersImpl(
        {
          categoryId: this.categoryId,
          selfContract: this,
          timing: (label: string) => timing(label),
          resolveNestedIdentityAnchorBands,
          nestedFullState: (contract: any) => nestedFullState(contract),
          selectProxyForwardInput: (...a: any[]) => (selectProxyForwardInput as any)(...a),
          directNestedIdentityWitness: (...a: any[]) => (directNestedIdentityWitness as any)(...a),
        },
        {
          lowLevelCallUtxoGroups,
          externalCallUtxoGroups,
          nestedDelegateProxyGroupByLowLevel,
          lowLevelCallInputBase,
          delegateExternalGroupIndices,
          delegateExternalGroupByCallsite,
          allGroupEcSlots,
          allGroupParentIndices,
          physicalReturnIndexForGroup,
          nestedMasterIndices,
          nestedOutputBases,
          relocatedPredOutBase,
          pendingDelegateInputFills,
          pendingAnchorFills,
          pendingExternalCallInputFills,
          entryAbiFunction,
          timingEnabled,
          publicSelfAddress,
          authenticatedSelfAddress,
          compilerRouteDelegateLayout,
          returnEmitOutputIndex,
          groupProxyMasterIndices,
          overrides,
          entryBatchWitnesses,
          entryValueWitnesses,
          pendingDynamicChunkInputFills,
          pendingTokenCallInputFills,
          identityAnchors,
          entryArgs,
          entryArtifact,
          physicalSelfAddress: executionSelfAddress,
          logicalCreateLock,
        },
      );

    }

    // Delegate forwarders publish the routed handler's mapping metadata through entryAbiFunction,
    // but their own ABI has no token-container effects. Resolve container inputs from that same
    // authenticated handler so deposits and withdrawals preserve the routed token category.
    const tokenContainerAbiFunction = entryAbiFunction?.tokenContainerAccesses?.length
      ? entryAbiFunction : abiFunction;
    const tokenContainerArgs = tokenContainerAbiFunction === entryAbiFunction ? entryArgs : args;
    const tokenContainerLoad = await loadCreateBuilderTokenContainersImpl(
      {
        categoryId: this.categoryId,
        inner: this.inner,
      },
      {
        abiFunction: tokenContainerAbiFunction,
        args: tokenContainerArgs,
        overrides,
        stateValues: onChainState?.state,
        timing,
      },
    );
    const tokenContainers = tokenContainerLoad.tokenContainers;
    const tokenContainerLockingBytecodes = tokenContainerLoad.tokenContainerLockingBytecodes;
    const tokenContainerAccesses = tokenContainerAbiFunction?.tokenContainerAccesses;

    // A proxy forwarder has no native-value effects in its own ABI. Its authenticated delegate route owns the
    // satoshi-container slot, so select that ABI just as we do for delegated token-container resources above.
    const satoshiContainerAbiFunction = entryAbiFunction?.blockLayout?.slots.some(
      (slot) => slot.kind === 'satoshiContainer',
    ) ? entryAbiFunction : abiFunction;
    const satoshiContainerLoad = await loadCreateBuilderSatoshiContainerImpl(
      {
        categoryId: this.categoryId,
        inner: this.inner,
      },
      {
        abiFunction: satoshiContainerAbiFunction,
        overrides,
      },
    );
    const satoshiContainerUtxo = satoshiContainerLoad.satoshiContainerUtxo;
    const satoshiContainerLockingBytecode = satoshiContainerLoad.satoshiContainerLockingBytecode;

    const synthesized = materializeCreateBuilderSyntheticArgsImpl(
      {
        selectActiveRootDelegateGroup,
      },
      {
        abiFunction,
        finalArgs,
        activeDelegateGroupIndex,
        lowLevelCallUtxoGroups,
        lowLevelCallInputBase,
        overrides,
        returnEmitOutputIndex,
        functionName,
        requiredNftIndices,
        externalReadUtxos,
        outStateInputCount,
        iterationEntryInputs,
        externalCallGroupCount: externalCallUtxoGroups.length,
      },
    );
    finalArgs = synthesized.finalArgs;
    activeDelegateGroupIndex = synthesized.activeDelegateGroupIndex;
    const delegateInputArgumentIndex = synthesized.delegateInputArgumentIndex;

    if (resolvedMsgSenderCategory !== undefined && abiFunction !== undefined
      && abiFunction.inputs.some((input) => input.name === '__internal__msgSenderCategory')) {
      // The synthetic-argument phase can rebuild the argument vector after the early caller-category seed.
      // Restore the authenticated category before creating the master unlocker: that helper captures this array,
      // so correcting only the later builder-construction copy leaves return-probe unlockers with the zero default.
      finalArgs = materializeInternalFunctionArgument(
        finalArgs, abiFunction.inputs, '__internal__msgSenderCategory', resolvedMsgSenderCategory,
      );
    }

    const stateUnlockers = buildCreateBuilderStateUnlockersImpl(
      {
        categoryId: this.categoryId,
        inner: this.inner,
        canonicalAbiFunctionSignature: (fn: AbiFunction) => canonicalAbiFunctionSignature(fn),
      },
      {
        functionName,
        abiFunction,
        physicalAbiFunction,
        finalArgs,
        args,
        activeDelegateGroupIndex,
        delegateInputArgumentIndex,
        lowLevelCallUtxoGroups,
        lowLevelCallInputBase,
        filteredDataNftUtxos,
        overrides,
      },
    );
    let buildStateInputUnlocker = stateUnlockers.buildStateInputUnlocker;
    let refreshPhysicalDelegateInputIndex = stateUnlockers.refreshPhysicalDelegateInputIndex;
    let stateInputUnlocker = stateUnlockers.stateInputUnlocker;
    const dataNftUnlockers = stateUnlockers.dataNftUnlockers;
    const topLevelDynamicChunkArgumentIndex = stateUnlockers.topLevelDynamicChunkArgumentIndex;

    // blockhash(n): resolve the oracle co-spends now that the complete master unlocker exists (the computed-n
    // extraction probe needs it - it carries the blockhash slot base index). Ordered by slot; the builder
    // places them at the consecutive blockhashOracle slots and setLocktime(maxBhLocktime) below.
    const graphSelections = (abiFunction as (AbiFunction & {
      graphBlockhashSelections?: GraphBlockhashSelection[];
    }) | undefined)?.graphBlockhashSelections;
    if (graphSelections?.length && this.categoryId) {
      const resolved: Array<NonNullable<Awaited<ReturnType<typeof resolveBlockhashCoSpend>>>> = [];
      const graphPrior: Array<{
        slotOrdinal: number; utxo: Utxo; unlocker: Unlocker; recreate: Output;
      }> = [];
      const graphBase = this.blockhashSlotBase(abiFunction).base;
      const graphSlotCount = abiFunction!.graphBlockhashOracle!.slotCount;
      for (const selection of graphSelections) {
        const n = isComputedBlockhashKey(selection.readKey)
          ? await this._extractGraphBlockhashRead(
            masterUtxo, stateInputUnlocker, filteredDataNftUtxos, graphPrior,
            graphBase, selection.slotOrdinal, graphSlotCount,
          )
          : this.paramBlockhashN(selection.readKey, selection.rowArgs, selection.handler);
        if (n === null) throw new Error(`blockhash: could not resolve message-bus batch row read "${selection.readKey}"`);
        const coSpend = await resolveBlockhashCoSpend(this.inner.provider, this.categoryId, n);
        if (!coSpend) throw new Error(`blockhash(${n}): no (n->hash) oracle UTXO for block ${n}`);
        resolved.push(coSpend);
        graphPrior.push({
          slotOrdinal: selection.slotOrdinal, utxo: coSpend.utxo, unlocker: coSpend.unlocker,
          recreate: coSpend.recreateOutput,
        });
      }
      blockhashCoSpendUtxos = resolved.map((cs) => ({ ...cs.utxo, unlocker: cs.unlocker }));
      blockhashCoSpendSlotOrdinals = graphSelections.map((selection) => selection.slotOrdinal);
      maxBhLocktime = resolved.reduce((m, cs) => Math.max(m, cs.locktime), 0);
    } else if (abiFunction?.blockhashReads && abiFunction.blockhashReads.length > 0 && this.categoryId) {
      const { base, count } = this.blockhashSlotBase(abiFunction);
      const resolved = await this._resolveBlockhashCoSpends(
        abiFunction, args, base, count, masterUtxo, stateInputUnlocker, filteredDataNftUtxos,
      );
      blockhashCoSpendUtxos = resolved.map((cs) => ({ ...cs.utxo, unlocker: cs.unlocker }));
      maxBhLocktime = resolved.reduce((m, cs) => Math.max(m, cs.locktime), 0);
    }
    // A forwarder slices no oracle itself, but the implementation it delegates to may. That reader pins the lock
    // its own contract was built with. Outside a compiler route its recreate rides the implementation band.
    const rootOracleReader = selectRootOracleReader();
    const oracleDelegate = rootOracleReader?.delegateIndex === undefined
      ? undefined : lowLevelCallUtxoGroups[rootOracleReader.delegateIndex];
    delegateBlockInfoOracle = oracleDelegate !== undefined && oracleDelegate.compilerRoute === undefined;
    if (rootOracleReader !== undefined) {
      const { reader } = rootOracleReader;
      const lock = reader.blockOracleLock;
      if (lock === undefined) {
        throw new Error(`${reader.name} reads the block oracle, and no oracle lock was provided`);
      }
      // Nested readers materialize their own pinned authority before a promoted delegate can change
      // which root-side band is selected. Move that exact input into the final root band, preserving
      // the nested fixed slot with a balanced funding input instead of promising a future co-spend.
      const nestedOracle = takeNestedBlockOracleInput(
        externalCallUtxoGroups, lowLevelCallUtxoGroups, lock, () => {
          const funder = sharedFunderPool?.shift();
          if (funder === undefined) throw new Error('Insufficient funding UTXOs to preserve nested oracle slot');
          markSharedFunder(funder);
          return funder;
        },
      );
      if (nestedOracle !== undefined) {
        blockInfoCoSpendUtxos = [nestedOracle];
      } else {
        const found = await this.inner.provider.getUtxosForLockingBytecode(lock);
        const oracle = found.find((utxo) => utxo.token?.nft?.capability === 'mutable');
        if (oracle?.token?.category === undefined) throw new Error('block oracle UTXO is not available');
        const category = hexToBin(oracle.token.category);
        blockInfoCoSpendUtxos = [{
          ...oracle,
          unlocker: {
            generateLockingBytecode: (): Uint8Array => lock,
            generateUnlockingBytecode: (): Uint8Array => blockOracleReadUnlocking(category),
          },
        }];
      }
    }

    // Recovery runs first because an EVM projection contributes its verified uncompressed public key to the
    // ordinary batched keccak side-cars. Computed recovery arguments remain deferred; the full routed trace later
    // replaces both the A/B pair and that batch member atomically.
    let ecrecoverEvmPreimages: Array<Uint8Array | null> = [];
    // Diagnostic (`SOLIDC_DEBUG_ECRECOVER_READINESS=1`): whether this build touches recovery at all. A handler
    // that verifies a signature must reach the branch below; if it does not, the caller's ABI/route objects are
    // the place to look, and if it does, the resolution counts say whether the side-car co-spends were built.
    if ((globalThis as { process?: { env?: Record<string, string> } }).process
      ?.env?.SOLIDC_DEBUG_ECRECOVER_READINESS === '1') {
      console.error('ecrecover-build-entry', {
        function: abiFunction?.name,
        entryFunction: entryAbiFunction?.name,
        abiEcrecover: abiFunction?.ecrecoverCompute === true,
        entryEcrecover: entryAbiFunction?.ecrecoverCompute === true,
        hasCategory: this.categoryId !== undefined,
      });
    }
    if ((abiFunction?.ecrecoverCompute || entryAbiFunction?.ecrecoverCompute) && this.categoryId) {
      const ecrecoverAbiFunction = abiFunction?.ecrecoverCompute ? abiFunction : entryAbiFunction!;
      // A selected message-bus handler is represented by a different ABI object than the synthetic route
      // wrapper, but its compute resources still belong to the route owner's balanced block. Treat resources as
      // delegated only when an actual delegatecall group executes that ABI; object inequality alone also matches
      // every ordinary kernel handler and incorrectly moves its fixed compute slots behind the owner block.
      const ecrecoverExecutingGroup = ecrecoverAbiFunction !== abiFunction
        ? lowLevelCallUtxoGroups.find((group) => (
          group.callMode === 'delegatecall'
          && (group.compilerRoute?.abiFunction === ecrecoverAbiFunction
            || group.functionName === ecrecoverAbiFunction.name)
        ))
        : undefined;
      const delegatedEcrecover = ecrecoverExecutingGroup !== undefined;
      delegateComputeResources ||= delegatedEcrecover;
      const ecrecoverArgs = ecrecoverAbiFunction === entryAbiFunction ? entryArgs : args;
      const graphRuntime = ecrecoverAbiFunction as MessageBusRuntimeAbiFunction;
      const graphCalls = graphRuntime.graphEcrecoverCalls;
      const resolution = await this._resolveEcrecoverComputeCoSpends(
        ecrecoverAbiFunction, ecrecoverArgs, graphCalls, {
          deferUnresolved: true,
          graphExecution: graphRuntime.messageBusGraphExecution === true,
        },
      );
      ecrecoverComputeCoSpendUtxos = resolution.coSpends.map((cs) => ({ ...cs.utxo, unlocker: cs.unlocker }));
      ecrecoverComputeRecreates = resolution.coSpends.map((cs) => cs.recreate);
      ecrecoverEvmPreimages = resolution.evmPreimages;
      if (resolution.argBlobs.some((argBlob) => argBlob === null)) {
        const ordinaryKeccakCalls = ecrecoverAbiFunction.keccakPreimageParams?.length ?? 0;
        let evmOrdinal = 0;
        const evmKeccakPreimageIndices = (ecrecoverAbiFunction.ecrecoverEvmFlags ?? [])
          .map((isEvm) => isEvm ? ordinaryKeccakCalls + evmOrdinal++ : -1);
        deferredEcrecoverCompute = {
          salt: resolution.salt,
          argBlobs: resolution.argBlobs,
          evmKeccakPreimageIndices,
        };
      }
      if ((globalThis as { process?: { env?: Record<string, string> } }).process
        ?.env?.SOLIDC_DEBUG_ECRECOVER_READINESS === '1') {
        console.error('ecrecover-build-resolution', {
          function: ecrecoverAbiFunction.name,
          delegatedEcrecover,
          argBlobs: resolution.argBlobs.length,
          unresolvedArgs: resolution.argBlobs.filter((argBlob) => argBlob === null).length,
          coSpends: resolution.coSpends.length,
          recreates: ecrecoverComputeRecreates.length,
          evmPreimages: resolution.evmPreimages.length,
          deferred: deferredEcrecoverCompute !== undefined,
        });
      }
    }

    // keccak256: resolve the compute side-cars now that the master unlocker (and its args) exists. The builder
    // positions them at the keccakSideCar slots and recreates each with its committed result R_i.
    let keccakLoopSideCars: UnlockableUtxo[] = [];
    let keccakLoopRecreates: Output[] = [];
    // Front-region co-spends (read-only data NFTs then blockhash oracles, in block-layout slot order) sit before
    // the keccak side-cars; thread them into the probes so keccak works alongside external reads / blockhash.
    const keccakFrontRegion = [...externalReadUtxos, ...blockhashCoSpendUtxos];
    if (abiFunction?.keccakLoopReads && this.categoryId) {
      // Dynamic loop: N (runtime) trailing side-cars, N + preimages found by a progressive VM probe. When a
      // mapping loop precedes the keccak loop in source order, its bracketing predecessors (and their exact
      // recreated chain outputs) occupy the front of the trailing band, so the probe co-spends them first.
      const loopBlockSize = abiFunction.blockLayout?.blockSize ?? 1;
      const loopSidecarBase = abiFunction.blockLayout?.trailingBase
        ?? abiFunction.blockLayout?.slots.find((slot) => slot.kind === 'keccakSideCar')?.offset
        ?? loopBlockSize;
      const keccakLoopFrontRegion = this._padKeccakLoopFrontRegion(
        abiFunction, filteredDataNftUtxos.length, loopSidecarBase, keccakFrontRegion,
        satoshiContainerUtxo, tokenContainers, blockInfoCoSpendUtxos,
      );
      const reversedTrailingPredecessors: { inputs: UnlockableUtxo[]; outputs: Output[] } = { inputs: [], outputs: [] };
      if (abiFunction.keccakLoopPrecedesTrailingUser !== true) {
        let predecessorCursor = 0;
        for (const [, commitments] of sortedLoopCommitments) {
          const predecessor = insertLoopPredecessors[predecessorCursor];
          if (!predecessor) break;
          predecessorCursor += 1;
          const entryLock = predecessor.unlocker.generateLockingBytecode();
          reversedTrailingPredecessors.inputs.push(predecessor);
          for (const commitment of commitments) {
            reversedTrailingPredecessors.outputs.push({
              to: entryLock, amount: 1200n,
              token: { amount: 0n, category: this.categoryId,
                nft: { capability: 'mutable' as const, commitment } },
            });
          }
        }
      }
      const loop = await this._resolveStatefulKeccakLoop(
        abiFunction, derivationMasterUtxo, stateInputUnlocker, filteredDataNftUtxos, dataNftUnlockers,
        keccakLoopFrontRegion, maxBhLocktime, reversedTrailingPredecessors,
      );
      keccakLoopSideCars = loop.sideCars;
      keccakLoopRecreates = loop.recreates;
    } else if (abiFunction?.keccakChainReads && this.categoryId) {
      // Chained direct preimage: one START/CONT/FINAL side-car per 136-byte block in the trailing region. The
      // fixed keccakSideCar slot stays funder-padded; the covenant reads the FINAL side-car at blockSize + fullBlocks.
      const resolution = await this._resolveKeccakComputeCoSpends(abiFunction, args, {
        masterUtxo: derivationMasterUtxo, stateInputUnlocker,
        dataNftUtxos: filteredDataNftUtxos, dataNftUnlockers,
        frontRegionInputs: keccakFrontRegion, locktime: maxBhLocktime,
      });
      keccakLoopSideCars = resolution.chain?.sideCars ?? [];
      keccakLoopRecreates = resolution.chain?.recreates ?? [];
    } else if ((abiFunction?.keccakCompute || entryAbiFunction?.keccakCompute
      || abiFunction?.ecrecoverEvmFlags?.some(Boolean)
      || entryAbiFunction?.ecrecoverEvmFlags?.some(Boolean)) && this.categoryId) {
      // A forwarding proxy publishes no keccak metadata of its own. Route the implementation metadata alongside
      // the entry/dynamic metadata selected above; the same compiler-declared block layout then positions every
      // resource without contract/function-name special cases.
      const keccakAbiFunction = abiFunction
        && (abiFunction.keccakCompute || abiFunction.ecrecoverEvmFlags?.some(Boolean))
        ? abiFunction : entryAbiFunction!;
      const executingGroup = keccakAbiFunction !== abiFunction
        ? lowLevelCallUtxoGroups.find((group) => (
          group.callMode === 'delegatecall'
          && (group.compilerRoute?.abiFunction === keccakAbiFunction
            || group.functionName === keccakAbiFunction.name)
        ))
        : undefined;
      const delegatedKeccak = executingGroup !== undefined;
      delegateComputeResources ||= delegatedKeccak;
      const keccakArgs = keccakAbiFunction === entryAbiFunction ? entryArgs : args;
      // Graph-owned routes force keccak preimages to null so learning comes from the full authenticated
      // transcript. Mirror ecrecover: defer the isolated probe — mapping entry gates abort before
      // OP_INPUTBYTECODE on the sidecar, so a minimal master+dataNft probe never sees a side-car read.
      const graphOwnedKeccak = (keccakAbiFunction as MessageBusRuntimeAbiFunction)
        .messageBusGraphExecution === true;
      const resolution = await this._resolveKeccakComputeCoSpends(keccakAbiFunction, keccakArgs, {
        masterUtxo: derivationMasterUtxo, stateInputUnlocker,
        dataNftUtxos: filteredDataNftUtxos, dataNftUnlockers,
        frontRegionInputs: keccakFrontRegion, locktime: maxBhLocktime,
        trailingReadInputs: iterationEntryInputs, firstDynamicReadInput: dynamicReadChunkInputs[0],
        ecrecoverPreimages: ecrecoverEvmPreimages,
        plannedPreimages: (keccakAbiFunction as MessageBusRuntimeAbiFunction).messageBusKeccakPreimages,
        ...((delegatedKeccak || graphOwnedKeccak
          || ecrecoverEvmPreimages.some((preimage) => preimage === null)) && {
          deferUnresolved: true,
        }),
        ...(delegatedKeccak && {
          artifactBytecode: executingGroup?.externalContract.inner.bytecode,
        }),
      });
      keccakComputeCoSpendUtxos = resolution.coSpends.map((cs) => ({ ...cs.utxo, unlocker: cs.unlocker }));
      keccakComputeCommitments = resolution.coSpends.map((cs) => binToHex(cs.commitment));
      if (resolution.preimages.some((preimage) => preimage === null)) {
        deferredKeccakCompute = {
          salt: resolution.salt,
          legacy: resolution.legacy,
          preimages: resolution.preimages,
        };
      }
    }

    const unlockableMaster = {
      ...derivationMasterUtxo,
      unlocker: stateInputUnlocker,
    };

    const unlockableDataNfts = filteredDataNftUtxos.map((nftUtxo, i) => ({
      ...nftUtxo,
      unlocker: dataNftUnlockers[i],
    }));

    // Compute event definitions and locking bytecodes for functions that emit events. A delegatecall'd (proxy)
    const eventLocks = collectCreateBuilderEventLocksImpl(
      {
        categoryId: this.categoryId,
        inner: this.inner,
      },
      {
        abiFunction,
        entryAbiFunction,
        functionName,
        lowLevelCallUtxoGroups,
        nestedDelegateProxyGroupByLowLevel,
        timing,
      },
    );
    const emitInfos = eventLocks.emitInfos;
    const eventDefs = eventLocks.eventDefs;
    const eventNftLockingBytecodes = eventLocks.eventNftLockingBytecodes;
    const runtimeEventNftLockingBytecodes = eventLocks.runtimeEventNftLockingBytecodes;
    // read-only or untouched vars must be left alone, else their chunks would be wrongly destroyed.
    const selectedEntryDynamicRows = (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)
      ?.messageBusRowArguments;
    const selectedDelegateDynamicRows = lowLevelCallUtxoGroups.flatMap((group) =>
      group.callMode === 'delegatecall' && group.compilerRoute?.rowArguments
        ? [...group.compilerRoute.rowArguments] : []);
    const selectedDynamicRows = [
      ...(selectedEntryDynamicRows ?? []),
      ...selectedDelegateDynamicRows,
    ];
    // A compiler route's dynamic layout is the union of every dispatchable handler and determines the ordering
    // of all trailing read/write runs. Preserve that geometry, but separately authenticate which variables this
    // concrete envelope can mutate; only those may receive speculative output placeholders.
    const dynamicWrites = [...(abiFunction?.dynamicWrites ?? [])];
    const hasSelectedDynamicRows = selectedDynamicRows.length > 0;
    const activeDynamicWrites = new Set(hasSelectedDynamicRows
      ? selectedDynamicRows.flatMap((row) => row.handler.dynamicWrites ?? [])
      : dynamicWrites);
    const delegateDynamicWrites = new Set<string>();
    for (const g of lowLevelCallUtxoGroups) {
      if (g.callMode !== 'delegatecall') continue;
      const gFn = g.compilerRoute?.abiFunction ?? (g.externalContract.inner.artifact.abi as readonly {
        name: string;
        dynamicWrites?: readonly string[];
      }[]).find((f) => f.name === g.functionName);
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_INPUTS === '1') {
        console.error('delegate-dynamic-write-source', {
          groupFunction: g.functionName,
          routeFunction: g.compilerRoute?.abiFunction.name,
          resolvedFunction: gFn?.name,
          writes: gFn?.dynamicWrites,
        });
      }
      const routeWrites = [...(gFn?.dynamicWrites ?? [])];
      const effectiveSelectedWrites = resolveSelectedDynamicWrites(
        routeWrites, g.compilerRoute?.rowArguments?.map((row) => row.handler),
      );
      for (const name of effectiveSelectedWrites) activeDynamicWrites.add(name);
      for (const name of routeWrites) {
        delegateDynamicWrites.add(name);
        if (!dynamicWrites.includes(name)) dynamicWrites.push(name);
      }
    }
    const dynamicVarInfos = (stateLayout.variables ?? [])
      .filter((v) => v.dynamic && dynamicWrites.includes(v.name));
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_INPUTS === '1'
      && delegateDynamicWrites.size > 0) {
      console.error('delegate-dynamic-write-layout', {
        dynamicWrites,
        variables: stateLayout.variables?.map((v) => ({ name: v.name, type: v.type, dynamic: v.dynamic })),
        selected: dynamicVarInfos.map((v) => v.name),
      });
    }
    const dynamicChunkVars: Array<{
      name: string; type: string; lockingBytecode: Uint8Array; delegate?: boolean; delegateSuffix?: boolean;
    }> = dynamicVarInfos.map((v) => ({
      name: v.name,
      type: v.type,
      lockingBytecode: scriptToLockingBytecode(
        buildEntryNftCovenantScript(
          hexToBin(this.categoryId),
          computeCollectionHash(dynamicChunkSignature(v.name, v.type)),
          directConventionMasterLock(this.inner),
        ),
        this.inner.addressType,
      ),
      ...(delegateDynamicWrites.has(v.name) && { delegate: true }),
    }));
    // Old chunk UTXOs to consume (destroy) on this write - fetched from each dynamic var's chunk address,
    const dynamicChunks = await loadCreateBuilderDynamicChunksImpl(
      {
        categoryId: this.categoryId,
        inner: this.inner,
        evaluateExternalExpression: (...a: any[]) => (this as any)._evaluateExternalExpression(...a),
        hydrateExternalPredicateState: (...a: any[]) => (this as any)._hydrateExternalPredicateState(...a),
        vmapCounterDomain: (...a: any[]) => (this as any)._vmapCounterDomain(...a),
      },
      {
        dynamicVarInfos,
        dynamicChunkVars,
        valueChunkGc,
        onChainState,
        stateLayout,
        overrides,
        abiFunction,
        entryAbiFunction,
        lowLevelCallUtxoGroups,
        nestedDelegateProxyGroupByLowLevel,
        batchPredCommitments,
        sortedLoopCommitments,
        runtimeLoopDerivedCounts,
        sortedInserts,
        args,
        entryArgs,
        finalArgs,
        eventDefs,
        runtimeEventNftLockingBytecodes,
        timing,
        executionSelfAddress,
        functionName,
        tokenContainers,
        routeRowIndex,
        selectedRowArgument,
        kernelJournalSettlementEntrySegments,
        runtimeLoopEntrySegments,
        entryAccesses: abiFunction?.entryAccesses,
        dynamicWrites,
        activeDynamicWrites,
        activeDelegateGroupIndex,
        externalCallUtxoGroups,
        entryNftLockingBytecodes,
      },
    );
    const dynamicChunkInputs = dynamicChunks.dynamicChunkInputs;
    const trailingDisposalInputs = dynamicChunks.trailingDisposalInputs;
    const oldDynamicChunkCounts = dynamicChunks.oldDynamicChunkCounts;
    const oldDynamicChunkCommitments = dynamicChunks.oldDynamicChunkCommitments;
    const loopEntryVars = dynamicChunks.loopEntryVars;
    const runtimeLoopEventOutputs = dynamicChunks.runtimeLoopEventOutputs;
    const runtimeLoopTransferOutputs = dynamicChunks.runtimeLoopTransferOutputs;
    const runtimeLoopTrailingSegments = dynamicChunks.runtimeLoopTrailingSegments;
    const delegateRouteGroup = dynamicChunks.delegateRouteGroup;
    // verified at proxyMaster+offset (emitMasterInputIndex=proxyMasterIndex), which is INSIDE the proxy's block -
    // so the proxy must reserve those output-only slots (funder input + event output), shifting the co-spent impl
    // UTXOs after them. __forward's own layout has none. Offsets align: proxy blockSize == impl master+dataNfts.
    const layoutResolved = await resolveCreateBuilderEffectiveLayoutImpl(
      {
        inner: this.inner,
        getLogicalAddress: () => this._logicalAddress,
        setLogicalAddress: (address: string) => { this._logicalAddress = address; },
      },
      {
        delegateRouteGroup,
        physicalAbiFunction,
        abiFunction,
        lowLevelCallUtxoGroups,
        nestedDelegateProxyGroupByLowLevel,
        activeDelegateGroupIndex,
        externalCallUtxoGroups,
        dynamicChunkVars,
        delegateReturnEventOffset,
        delegateEventSlots,
        overrides,
        functionName,
        timingEnabled,
        timing,
      },
    );
    const compilerRouteDelegateLayout = layoutResolved.compilerRouteDelegateLayout;
    let effectiveBlockLayout = layoutResolved.effectiveBlockLayout;
    const logicalIdentity = layoutResolved.logicalIdentity;
    const usesComposedDelegateDynamicTail = layoutResolved.usesComposedDelegateDynamicTail;
    if (timingEnabled) console.error('builder-shape', {
      functionName,
      externalGroups: externalCallUtxoGroups.length,
      lowLevelGroups: lowLevelCallUtxoGroups.length,
      blockSize: effectiveBlockLayout?.blockSize,
      slots: effectiveBlockLayout?.slots.length,
      iterationInputs: iterationEntryInputs.length,
      dynamicInputs: dynamicChunkInputs.length,
      disposalInputs: trailingDisposalInputs.length,
      heapMb: Math.round((((globalThis as any).process?.memoryUsage?.().heapUsed ?? 0) / 1048576)),
    });
    const transportedProductions = overrides?.valueChunkProductions ?? [];
    const ordinaryTransportedRoute = activeDelegateGroupIndex === undefined
      && (abiFunction as MessageBusRuntimeAbiFunction | undefined)?.messageBusGraphExecution === true;
    applyCreateBuilderTransportedProductionsImpl({
      transportedProductions,
      activeDelegateGroupIndex,
      lowLevelCallUtxoGroups,
      overrides,
      ...((abiFunction as MessageBusRuntimeAbiFunction | undefined)?.messageBusGraphExecution === true && {
        ordinaryRoute: {
          categoryId: this.categoryId,
          lockingBytecode: this.inner.lockingBytecode,
          artifact: this.inner.artifact,
          rows: (abiFunction as MessageBusRuntimeAbiFunction).messageBusRowArguments ?? [],
        },
      }),
    });
    const constructed = constructCreateBuilderTransactionBuilderImpl(
      {
        categoryId: this.categoryId,
        inner: this.inner,
      },
      {
        finalArgs,
        abiFunction,
        entryAbiFunction,
        physicalAbiFunction,
        functionName,
        effectiveBlockLayout,
        entryAccesses,
        entryNfts,
        batchTargetPlaceholders,
        resolvedMsgSenderCategory,
        externalReadUtxos,
        overrides,
        valueChunkWriteStagingSession,
        unlockableMaster,
        unlockableDataNfts,
        stateLayout,
        requiredNftIndices,
        entryNftLockingBytecodes,
        dynamicChunkVars,
        dynamicChunkInputs,
        trailingDisposalInputs,
        loopEntryVars,
        runtimeLoopEventOutputs,
        runtimeLoopTransferOutputs,
        runtimeLoopTrailingSegments,
        kernelJournalSettlementOutputPlan,
        kernelJournalEagerOutputPlan,
        tokenContainers,
        tokenContainerLockingBytecodes,
        satoshiContainerUtxo,
        satoshiContainerLockingBytecode,
        blockhashCoSpendUtxos,
        blockInfoCoSpendUtxos,
        delegateBlockInfoOracle,
        blockhashCoSpendSlotOrdinals,
        keccakComputeCoSpendUtxos,
        keccakComputeCommitments,
        delegateComputeResources,
        deferredKeccakCompute,
        deferredEcrecoverCompute,
        ecrecoverComputeCoSpendUtxos,
        ecrecoverComputeRecreates,
        keccakLoopSideCars,
        keccakLoopRecreates,
        externalOutStateUtxoGroups,
        externalCallUtxoGroups,
        embeddedFunderUtxos,
        logicalIdentity,
        identityAnchors,
        lowLevelCallUtxoGroups,
        activeDelegateGroupIndex,
        lowLevelCallRawInputs,
        compilerRouteDelegateLayout,
        hasDelegatedDynamicReadChunks,
        delegateReturnEventOffset,
        delegateEventSlots,
        lowLevelCallInputBase,
        batchPredCommitments,
        sortedLoopCommitments,
        eventDefs,
        eventNftLockingBytecodes,
        iterationEntryInputs,
        insertLoopPredecessors,
        dynamicReadChunkInputs,
        topLevelDynamicChunkArgumentIndex,
        topLevelReturnWitnessGroups,
        refreshPhysicalDelegateInputIndex,
        buildStateInputUnlocker,
        allGroupEcSlots,
        derivationMasterUtxo,
        masterUtxo,
        timing,
      },
    );
    const builder = constructed.builder;
    finalArgs = constructed.finalArgs;
    const firstRootDynamicChunk = constructed.firstRootDynamicChunk;
    const refreshTopLevelReturnWitnesses = constructed.refreshTopLevelReturnWitnesses;

    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
      console.error('stateful-builder-created', { functionName });
    }
    registerCreateBuilderBuilderStateImpl(
      {
        categoryId: this.categoryId,
        inner: this.inner,
      },
      {
        builder,
        oldDynamicChunkCommitments,
        oldDynamicChunkCounts,
        overrides,
        masterUtxo,
        inactiveMessageBusEntrySlots,
        entryDeleteSlots,
        condSoftDeleteSlots,
        entryNfts,
        entryAbiFunction,
        batchTargetPlaceholders,
        exactBatchTargetSlots,
        sortedInserts,
        compilerRouteDelegateLayout,
        activeDynamicWrites,
        usesComposedDelegateDynamicTail,
        computedValueChunkRuns,
        onChainState,
        entryArgs,
        pendingEntryValueTails,
        transportedProductions,
        ordinaryTransportedRoute,
        valueChunkMints,
        maxBhLocktime,
        functionName,
        timing,
        activeMessageBusEntryOperations,
        dynamicChunkVars,
        selectedDynamicRows,
        sortedLoopCommitments,
        runtimeExpressionLoopCollections,
        batchPredCommitments,
        batchTargetSlots,
        runtimeLoopDerivedCounts,
        computedValueUpdateCollections,
        effectiveBlockLayout,
        loopValueChunkMints,
      },
    );
    // Registration above has materialized these owner-local continuations into the builder. Nested call chunks
    // can occupy the same builder's staged/derived tables, but are not evidence for this route's ABI witness.
    const ownedMaterializedValueChunkCounts = [
      ...valueChunkMints.map((mint) => mint.chunks.length),
      ...loopValueChunkMints.map((mint) => mint.chunks.length),
      ...(ordinaryTransportedRoute
        ? transportedProductions.map((production) => production.write.outputCount) : []),
    ];

    await allocateCreateBuilderFundersImpl(
      {
        categoryId: this.categoryId,
        inner: this.inner,
        signer: this._signer,
        retireSignerUtxos,
        invalidateSignerUtxos,
        signerUtxoSnapshot,
        markSharedFunder,
      },
      {
        builder,
        effectiveBlockLayout,
        insertLoopPredecessors,
        sortedLoopCommitments,
        entryAbiFunction,
        returnEmitOutputIndex,
        overrides,
        externalCallUtxoGroups,
        lowLevelCallUtxoGroups,
        sharedFunderPool,
        sharedFunderSnapshot,
        functionName,
        timing,
        compilerRouteDelegateLayout,
        blockhashCoSpendSlotOrdinals,
        keccakComputeCoSpendUtxos,
        ecrecoverComputeCoSpendUtxos,
        iterationEntryInputs,
        dynamicChunkInputs,
        trailingDisposalInputs,
        abiFunction,
        nestedDelegateProxyGroupByLowLevel,
        masterUtxo,
        consumedSharedFunders,
        timingEnabled,
        earlySignerUtxos,
      },
    );
    // funders-complete (size-guarded end marker for allocateCreateBuilderFunders)

    const {
      applyMintingMasterFills,
      refreshNestedIdentityAnchorWitnesses,
    } = applyCreateBuilderPendingInputFillsImpl({
      builder,
      overrides,
      functionName,
      entryAbiFunction,
      externalCallUtxoGroups,
      lowLevelCallUtxoGroups,
      pendingDynamicChunkInputFills,
      pendingAnchorFills,
      pendingExternalCallInputFills,
      pendingDelegateInputFills,
      pendingTokenCallInputFills,
      firstRootDynamicChunk,
    });
    // pending-input-fills-complete (size-guarded end marker for applyCreateBuilderPendingInputFills)

    const assembledWitnessBag = {
      finalArgs,
      stateInputUnlocker,
    };
    const { refreshTopLevelIdentityAnchorWitnesses: refreshTopLevelIdentityAnchorWitnessesRaw } =
      rebindCreateBuilderAssembledWitnessesImpl(assembledWitnessBag, {
        builder,
        abiFunction,
        externalCallUtxoGroups,
        lowLevelCallUtxoGroups,
        topLevelAnchorFillPositions,
        topLevelVmapProofUtxos,
        masterUtxo,
        derivationMasterUtxo,
        buildStateInputUnlocker,
        refreshTopLevelReturnWitnesses,
      });
    stateInputUnlocker = assembledWitnessBag.stateInputUnlocker;
    const refreshTopLevelIdentityAnchorWitnesses = (): boolean => {
      const changed = refreshTopLevelIdentityAnchorWitnessesRaw();
      stateInputUnlocker = assembledWitnessBag.stateInputUnlocker;
      return changed;
    };
    // assembled-witnesses-complete (size-guarded end marker for rebindCreateBuilderAssembledWitnesses)

    const {
      derivTransferCount,
      derivTokenOps,
      delegatecallInputIndex,
      eventBlockLayoutForDerive,
    } = await prepareCreateBuilderDerivePreludeImpl(
      {
        categoryId: this.categoryId,
        inner: this.inner,
        hydrateExternalPredicateState: (...a: any[]) => (this as any)._hydrateExternalPredicateState(...a),
        evaluateExternalExpression: (...a: any[]) => (this as any)._evaluateExternalExpression(...a),
      },
      {
        builder,
        abiFunction,
        entryAbiFunction,
        args,
        tokenContainerAbiFunction,
        tokenContainerArgs,
        tokenContainerAccesses,
        onChainState,
        executionSelfAddress,
        overrides,
        functionName,
        returnAbiFunction,
        returnEmitOutputIndex,
        returnMaterializationOutputIndex,
        returnEmitBlockOffset,
        delegateReturnEventOffset,
        lowLevelCallUtxoGroups,
        externalCallUtxoGroups,
        externalOutStateUtxoGroups,
        activeDelegateGroupIndex,
        effectiveBlockLayout,
        timing,
      },
    );
    // derive-prelude-complete (size-guarded end marker for prepareCreateBuilderDerivePrelude)

    assembledWitnessBag.stateInputUnlocker = stateInputUnlocker;
    await runCreateBuilderDerivePassImpl(
      {
        deriveFullTransactionState: (...a: any[]) => (this as any)._deriveFullTransactionState(...a),
      },
      assembledWitnessBag,
      {
        builder,
        abiFunction,
        entryAbiFunction,
        requiredNftIndices,
        entryAccesses,
        loopEntryVars,
        runtimeLoopEventOutputs,
        runtimeLoopTransferOutputs,
        emitInfos,
        derivTransferCount,
        derivTokenOps,
        externalCallUtxoGroups,
        externalOutStateUtxoGroups,
        returnEmitOutputIndex,
        stateLayout,
        allGroupEcSlots,
        functionName,
        timingEnabled,
        timing,
        computedValueChunkRuns,
        ownedMaterializedValueChunkCounts,
        overrides,
        applyMintingMasterFills,
        refreshNestedIdentityAnchorWitnesses,
        refreshTopLevelIdentityAnchorWitnesses,
        eventBlockLayoutForDerive,
        delegatecallInputIndex,
        onChainState,
        valueChunkWriteStagingSession,
        buildStateInputUnlocker,
      },
    );
    stateInputUnlocker = assembledWitnessBag.stateInputUnlocker;
    // derive-pass-complete (size-guarded end marker for runCreateBuilderDerivePass)

    await materializeCreateBuilderReturnEmitImpl(
      {
        categoryId: this.categoryId,
        inner: this.inner,
        lastReturnProbeFailure: this.lastReturnProbeFailure,
        deriveReturnBlob: (...a: any[]) => (this as any)._deriveReturnBlob(...a),
      },
      {
        builder,
        overrides,
        functionName,
        returnEmitOutputIndex,
        returnMaterializationOutputIndex,
        delegatecallInputIndex,
        entryAbiFunction,
        abiFunction,
        externalCallUtxoGroups,
        preparedAtomicNodes,
        preparedAtomicNodeByExternalGroup,
      },
    );
    // return-emit-complete (size-guarded end marker for materializeCreateBuilderReturnEmit)

    finishCreateBuilderAtomicPromotionImpl({
      builder,
      preparedAtomicNodes,
      functionName,
    });
    // atomic-promotion-complete (size-guarded end marker for finishCreateBuilderAtomicPromotion)

    timing('complete');
    // DS-6: a node targets share sits at the first one's slot; where the probe refuses that, another target ran.
    const vmErrored = (candidate: StatefulTransactionBuilder): boolean => (
      (candidate as unknown as { __vmErrored?: boolean }).__vmErrored === true);
    if (vmErrored(builder)) {
      const tried = new Set<string>();
      for (const { owners, chainedDeletes } of sortedNodeOwnerAlternatives) {
        const key = `${owners.join()}|${chainedDeletes?.join() ?? ''}`;
        if (tried.has(key)) continue;
        tried.add(key);
        const retry = await this._createBuilder(functionName, callerArgs, {
          ...overrides, sortedNodeOwners: owners, sortedChainedDeletes: chainedDeletes,
        });
        if (!vmErrored(retry)) return retry;
      }
    }
    return builder;
  }

  /**
   * Why the last return probe could not expose an authenticated commitment.
   *
   * A view that reverts on a source-level `require` otherwise surfaces only its custom message (or nothing at
   * all for a bare `require`), which is not enough to tell WHICH predicate failed. Retain the failing instruction
   * and the resolved `require` site so the caller can name the source expression instead of guessing from the
   * committed return band.
   */
  private lastReturnProbeFailure?: string;

  private describeReturnProbeFailure(
    trace: readonly {
      ip: number; error?: unknown; stack?: readonly Uint8Array[];
      instructions: readonly { opcode: number; data?: Uint8Array }[];
    }[],
    inputIndex: number,
  ): string | undefined {
    return describeReturnProbeFailureImpl(
      { inner: this.inner as any },
      trace, inputIndex,
    );
  }

  // B8 emit: run one VM probe and extract the encoded return blob from the return-event verification
  // (OP_OUTPUTTOKENCOMMITMENT == __returnBlob), the same trace-extraction used for external-call returns.
  private _deriveReturnBlob(
    builder: StatefulTransactionBuilder,
    returnOutputIndex: number,
    inputIndex = 0,
  ): Uint8Array | undefined {
    const self = this;
    return deriveReturnBlobImpl(
      {
        inner: self.inner as any,
        get lastReturnProbeFailure() { return self.lastReturnProbeFailure; },
        set lastReturnProbeFailure(v: string | undefined) { self.lastReturnProbeFailure = v; },
      },
      builder, returnOutputIndex, inputIndex,
    );
  }

  /** @internal Extract a participant's message-bus return commitment from a complete bus transaction. */
  _messageBusReturnBlobFromTransaction(
    builder: TransactionBuilder, returnOutputIndex: number, inputIndex: number,
    program: ReturnType<TransactionBuilder['buildLibauthProgram']> = builder.buildLibauthProgram(),
    resultSchema?: {
      resultTypes: readonly string[];
      resultTypeGroups: readonly (readonly string[])[];
      resultEncodings: readonly ExternalResultEncoding[];
      protectTransientSeedOnFailedProbe?: boolean;
    },
  ): Uint8Array | undefined {
    const self = this;
    return messageBusReturnBlobFromTransactionImpl(
      {
        inner: self.inner as any,
        get lastReturnProbeFailure() { return self.lastReturnProbeFailure; },
        set lastReturnProbeFailure(v: string | undefined) { self.lastReturnProbeFailure = v; },
      },
      builder, returnOutputIndex, inputIndex, program, resultSchema,
    );
  }

  /** @internal Discover routed event expectations from the complete atomic transaction.
   *
   * Isolated participant probes can stop before a graph handler reaches its event covenant because their graph
   * coordinates are intentionally final-transaction-relative. The atomic composer already has the authoritative
   * transaction here, so read each event commitment and exact locking bytecode from that trace. If the compact
   * faithful trace stops before all event pins, rerun the same VM semantics with complete tracing; neither pass
   * suppresses verification, and the ordinary final preflight remains the authority for acceptance.
   */
  _messageBusEventCommitmentsFromTransaction(
    builder: TransactionBuilder, eventOutputIndices: readonly number[], inputIndex: number,
    program: ReturnType<TransactionBuilder['buildLibauthProgram']> = builder.buildLibauthProgram(),
  ): ReadonlyMap<number, { commitment: string; lockingBytecode?: string }> {
    const self = this;
    return messageBusEventCommitmentsFromTransactionImpl(
      {
        inner: self.inner as any,
        get lastReturnProbeFailure() { return self.lastReturnProbeFailure; },
        set lastReturnProbeFailure(v: string | undefined) { self.lastReturnProbeFailure = v; },
      },
      builder, eventOutputIndices, inputIndex, program,
    );
  }

  /**
   * ethers-style `fn.staticCall(...)` read: run the function's covenant in a read-only VM probe against the
   * current on-chain state + args, extract the encoded return value, and decode it against the ABI output type(s)
   * WITHOUT sending a transaction. A single output returns the decoded value; multiple outputs return an
   * ethers-style array (tuple). Typechain `.toObject()`/`.toArray()` accessors are attached at this boundary.
   */
  async _deriveReturnValue(
    functionName: string, args: FunctionArgument[], calls?: CallInfo[], exactAbiFunction?: AbiFunction,
    calleeCalls?: ExternalCallInfo[],
    callerLockingBytecode?: Uint8Array,
    callerCategoryId?: string,
    callerContract?: StatefulContract<Artifact>,
  ): Promise<StateValue> {
    const self = this;
    return deriveReturnValueImpl(
      {
        inner: self.inner as any,
        provider: self.inner.provider,
        target: self.target,
        externalRegistry: self._externalRegistry as any,
        get lastReturnProbeFailure() { return self.lastReturnProbeFailure; },
        set lastReturnProbeFailure(v: string | undefined) { self.lastReturnProbeFailure = v; },
        get _deriveSeq() { return (self as any)._deriveSeq; },
        set _deriveSeq(v: number | undefined) { (self as any)._deriveSeq = v; },
        addressMappingKeyCandidates: (v: unknown) => self._addressMappingKeyCandidates(v),
        getSoftMapping: (...a: any[]) => (self as any)._getSoftMapping(...a),
        resolveCallAbi: (functionName: string, args: readonly FunctionArgument[]) =>
          self._resolveCallAbi(functionName, args),
        getEntries: (name: string) => self.getEntries(name),
        createBuilder: (...a: any[]) => (self as any)._createBuilder(...a),
        deriveReturnBlob: (...a: any[]) => (self as any)._deriveReturnBlob(...a),
        getState: () => self.getState(),
        getCallerMasterUtxo: async (caller: StatefulContract<Artifact>) => {
          const full = await caller.getFullState();
          return full.masterUtxo as UnlockableUtxo | undefined;
        },
        contract: self,
        signer: self._logicalNonceSigner ?? self._signer,
      } as any,
      functionName, args, calls, exactAbiFunction, calleeCalls,
      callerLockingBytecode, callerCategoryId, callerContract,
    );
  }

  /**
   * Lightweight state retrieval that only fetches the master UTXO (no data NFTs/entries).
   * Used for functions that don't access on-chain state (e.g., split/merge/unsafe tiers).
   */
  private async _getMasterOnlyState(): Promise<OnChainState> {
    const tokenUtxos = await this.inner.provider.getUtxos(this.inner.tokenAddress);
    const masterUtxo = tokenUtxos.find(
      (u) => u.token?.category === this.categoryId && u.token?.nft?.capability === 'minting',
    );
    return {
      masterUtxo: masterUtxo ?? undefined,
      dataNftUtxos: [],
      entryNftUtxos: [],
      state: {},
    };
  }

  private _keysMatch(
    a: bigint | boolean | Uint8Array,
    b: bigint | boolean | Uint8Array,
    _keyType: string,
  ): boolean {
    if (a instanceof Uint8Array && b instanceof Uint8Array) {
      return binsAreEqual(a, b);
    }
    return a === b;
  }

  /**
   * Resolve the external category ID for an external read (address model).
   * A's constructor args bake the callee *address*, not its category, so the category is
   * recovered from the registered external contract (keyed by interface name).
   */
  private _resolveExternalCategoryId(er: ExternalReadAbi, _artifact: Artifact): string {
    return this._resolveRegisteredExternalCategoryId(er.interfaceName);
  }

  /** Look up a registered external contract's category ID by interface name. */
  private _resolveRegisteredExternalCategoryId(interfaceName: string): string {
    const ext = this._externalRegistry.get(interfaceName);
    if (!ext) {
      throw new Error(
        `External contract for interface '${interfaceName}' is not registered. `
        + 'Provide it via connect-time externals (connect/from { externals }) or withExternalCall().',
      );
    }
    return ext.categoryId;
  }

  /**
   * Get the token-aware address for external data NFTs.
   */
  private _getExternalDataNftAddress(externalCategoryId: string): string {
    let masterLock: Uint8Array | undefined;
    for (const ext of this._externalRegistry.values()) {
      if (ext.categoryId !== externalCategoryId) continue;
      masterLock = directConventionMasterLock(ext.inner);
      break;
    }
    const covenantScript = buildDataNftCovenantScript(hexToBin(externalCategoryId), masterLock);
    return scriptToAddress(covenantScript, this.inner.provider.network, this.inner.addressType, true);
  }

  /** Resolve returning calls nested inside another external-call argument expression. */
  private async _resolveExternalExpressionReturns(
    argSources: readonly ArgSource[] | undefined,
    functionArgs: FunctionArgument[],
    registryOwner: StatefulContract,
    state?: Record<string, unknown>,
    callerInputs?: readonly { type: string }[],
    executionSelfAddress?: FunctionArgument,
    producerCalls?: readonly ExternalCallAbi[],
    allowProvisional = false,
    planningContext: GraphPlanningProducerResultContext = createGraphPlanningProducerResultContext(),
    consumer?: {
      callsiteId?: number;
      resultConsumers?: readonly ExternalResultConsumerAbi[];
      lane: 'condition';
    },
    occurrenceIndex = 0,
    executionCallerAddress?: FunctionArgument,
  ): Promise<Map<string, FunctionArgument>> {
    return resolveExternalExpressionReturnsImpl(
      {
        inner: this.inner as any,
        categoryId: this.categoryId,
        externalRegistry: this._externalRegistry,
        asCallerContract: () => this as any,
        resolveExternalArgs: (...a: any[]) => (this as any)._resolveExternalArgs(...a),
        evaluateExternalExpression: (...a: any[]) => (this as any)._evaluateExternalExpression(...a),
      },
      argSources, functionArgs, registryOwner, state, callerInputs, executionSelfAddress,
      producerCalls, allowProvisional, planningContext, consumer, occurrenceIndex,
      executionCallerAddress,
    );
  }

  /**
   * Resolve B's function args from A's args using argSources metadata.
   * Returns the resolved args, or undefined if any arg source is unresolvable.
   * @internal
   */
  _resolveExternalArgs(
    argSources: readonly ArgSource[] | undefined,
    functionArgs: FunctionArgument[],
    artifact: Artifact,
    state?: Record<string, unknown>,
    callerInputs?: readonly { type: string }[],
    externalReturns?: ReadonlyMap<string, FunctionArgument>,
    occurrenceIndex = 0,
    stateIncludesPriorWrites = false,
    executionSelfAddress?: FunctionArgument,
    executionCallerAddress?: FunctionArgument,
    ownerConstructorArgs?: readonly FunctionArgument[],
  ): FunctionArgument[] | undefined {
    return resolveExternalArgsImpl(
      {
        inner: this.inner,
        signer: this._signer,
        evaluateExternalExpression: (...a: any[]) => (this as any)._evaluateExternalExpression(...a),
      },
      argSources, functionArgs, artifact, state, callerInputs, externalReturns,
      occurrenceIndex, stateIncludesPriorWrites, executionSelfAddress,
      executionCallerAddress, ownerConstructorArgs,
    );
  }

  /** Resolve a callsite's reached rows against the authenticated execution frame. */
  async _planExternalCallOccurrences(
    call: ExternalCallAbi,
    frame: {
      functionArgs: FunctionArgument[];
      artifact: Artifact;
      state?: Record<string, unknown>;
      callerInputs?: readonly { type: string }[];
      executionSelfAddress?: FunctionArgument;
      executionMsgSender?: FunctionArgument;
      externalReturns?: ReadonlyMap<string, FunctionArgument>;
    },
  ): Promise<readonly { args: readonly FunctionArgument[]; sourceIteration: number; occurrenceIndex: number }[]> {
    const evaluate = (expression: ExternalCallExpression, iteration: number,
      bindings?: ReadonlyMap<string, FunctionArgument>): FunctionArgument | undefined =>
      this._evaluateExternalExpression(
        expression, frame.functionArgs, frame.artifact, frame.state, frame.callerInputs,
        frame.externalReturns, iteration, false, frame.executionSelfAddress, bindings,
        undefined, false, frame.executionMsgSender,
      );
    const candidates = call.iterationDomain
      ? evaluateExternalCallAffineIterationDomain(call.iterationDomain,
        (expression, bindings) => {
          const value = evaluate(expression, 0, bindings);
          return typeof value === 'bigint' || typeof value === 'boolean' ? value : undefined;
        })
      : externalCallCandidateIterationIndices(call, frame.functionArgs);
    if (!candidates) {
      throw new Error(`External callsite ${call.callsiteId ?? 'unknown'} has no exact iteration domain`);
    }
    const reached: Array<{ args: readonly FunctionArgument[]; sourceIteration: number; occurrenceIndex: number }> = [];
    for (const sourceIteration of candidates) {
      if (call.condition) {
        const active = evaluate(call.condition, sourceIteration);
        if (typeof active !== 'boolean') {
          throw new Error(`External callsite ${call.callsiteId ?? 'unknown'} has unresolved condition`);
        }
        if (!active) continue;
      }
      const args = this._resolveExternalArgs(
        call.rawArgSources ?? call.argSources, frame.functionArgs, frame.artifact, frame.state,
        frame.callerInputs, frame.externalReturns, sourceIteration, false, frame.executionSelfAddress,
        frame.executionMsgSender,
      );
      if (!args) throw new Error(`External callsite ${call.callsiteId ?? 'unknown'} has unresolved arguments`);
      reached.push({ args, sourceIteration, occurrenceIndex: reached.length });
    }
    return reached;
  }

  private _vmapCounterDomain(
    info: SortedUpsertLoopAbi | undefined,
    spec: VmapCounterPermutationSpec,
    legacyBound: unknown,
    functionArgs: FunctionArgument[],
    artifact: Artifact,
    callerInputs: readonly { type: string }[],
    state?: Record<string, unknown>,
    executionSelfAddress?: FunctionArgument,
  ): bigint[] | undefined {
    const resolved = info?.iterationBound
      ? this._evaluateExternalExpression(
        info.iterationBound, functionArgs, artifact, state, callerInputs,
        undefined, 0, false, executionSelfAddress,
      )
      : legacyBound;
    if (typeof resolved !== 'bigint' && typeof resolved !== 'number' && typeof resolved !== 'string') {
      return undefined;
    }
    const step = this._vmapCounterStep(
      info, spec, functionArgs, artifact, callerInputs, state, executionSelfAddress,
    );
    return step === undefined
      ? undefined : vmapCounterPermutationValues(BigInt(resolved), {
        ...spec, step, exactBound: info?.iterationExactBound,
      });
  }

  private _vmapCounterStep(
    info: SortedUpsertLoopAbi | undefined,
    spec: VmapCounterPermutationSpec,
    functionArgs: FunctionArgument[],
    artifact: Artifact,
    callerInputs: readonly { type: string }[],
    state?: Record<string, unknown>,
    executionSelfAddress?: FunctionArgument,
  ): bigint | undefined {
    if (!info?.iterationStep) return spec.step;
    const resolved = this._evaluateExternalExpression(
      info.iterationStep, functionArgs, artifact, state, callerInputs,
      undefined, 0, false, executionSelfAddress,
    );
    if (typeof resolved !== 'bigint' && typeof resolved !== 'number' && typeof resolved !== 'string') {
      return undefined;
    }
    const step = BigInt(resolved);
    if (step === 0n || (spec.step > 0n) !== (step > 0n)) {
      throw new Error('vmap counter loop runtime step must advance toward its bound');
    }
    return step;
  }

  /** Validate and evaluate one compiler-authenticated chunkable-array push operand. */
  private _encodeStoredElementSource(
    access: EntryAccessAbi,
    elementType: string,
    functionArgs: FunctionArgument[],
    handler: AbiFunction,
    artifact: Artifact,
    state?: Record<string, unknown>,
  ): Uint8Array | undefined {
    return encodeStoredElementSourceImpl(
      {
        evaluateExternalExpression: (...a: any[]) => (this as any)._evaluateExternalExpression(...a),
      },
      access, elementType, functionArgs, handler, artifact, state,
    );
  }

  private _encodeStoredValueSource(
    access: EntryAccessAbi,
    valueType: string,
    functionArgs: FunctionArgument[],
    handler: AbiFunction,
    artifact: Artifact,
    state?: Record<string, unknown>,
    externalReturns?: ReadonlyMap<string, FunctionArgument>,
    incomingEntries?: Parameters<typeof encodeStoredValueSourceImpl>[8],
  ): Uint8Array | undefined {
    return encodeStoredValueSourceImpl(
      { evaluateExternalExpression: (...a: any[]) => (this as any)._evaluateExternalExpression(...a) },
      access, valueType, functionArgs, handler, artifact, state, externalReturns, incomingEntries,
    );
  }

  private _evaluateExternalExpression(
    expression: ExternalCallExpression,
    functionArgs: FunctionArgument[],
    artifact: Artifact,
    state?: Record<string, unknown>,
    callerInputs?: readonly { type: string }[],
    externalReturns?: ReadonlyMap<string, FunctionArgument>,
    occurrenceIndex = 0,
    stateIncludesPriorWrites = false,
    executionSelfAddress?: FunctionArgument,
    localBindings?: ReadonlyMap<string, FunctionArgument>,
    stateLengthDeltas?: Readonly<Record<string, bigint>>,
    strictFieldAccess = false,
    executionCallerAddress?: FunctionArgument,
  ): FunctionArgument | undefined {
    return evaluateExternalExpressionImpl(
      {
        resolveExternalArgs: (...a: any[]) => (this as any)._resolveExternalArgs(...a),
      },
      expression, functionArgs, artifact, state, callerInputs, externalReturns,
      occurrenceIndex, stateIncludesPriorWrites, executionSelfAddress, localBindings,
      stateLengthDeltas, strictFieldAccess,
      executionCallerAddress,
    );
  }

  /**
   * Construct the exact positional message-bus batch blob expected by a grouped external
   * call. The callee capability is treated as untrusted artifact data: every
   * logical selector must resolve to an advertised eligible handler with the
   * same input types before any transaction is built.
   */
  private _replaceRepeatedExternalBatchRow(
    route: NonNullable<ExternalCallUtxoGroup['compilerRoute']>,
    previousArgs: readonly FunctionArgument[],
    nextArgs: readonly FunctionArgument[],
    calleeArtifact: Artifact,
    routeMsgSender: FunctionArgument,
  ): NonNullable<ExternalCallUtxoGroup['compilerRoute']> | undefined {
    return replaceRepeatedExternalBatchRowImpl(
      {
        concatBytes: (...a: any[]) => (StatefulContract as any)._concatBytes(...a),
        uintLe: (...a: any[]) => (StatefulContract as any)._uintLe(...a),
        signedLogicalValue: (...a: any[]) => (StatefulContract as any)._signedLogicalValue(...a),
      },
      route, previousArgs, nextArgs, calleeArtifact, routeMsgSender,
    );
  }

  private _buildRepeatedExternalBatch(
    externalCall: ExternalCallAbi,
    functionArgs: FunctionArgument[],
    externalContract: StatefulContract,
    callerArtifact: Artifact = this.inner.artifact,
    callerState?: Record<string, StateValue>,
    calleeRouteArtifact: Artifact = externalContract.inner.artifact,
    callerInputs?: readonly { type: string }[],
    callerStateIncludesPriorWrites = false,
    callerSelfAddress?: FunctionArgument,
    externalReturns?: ReadonlyMap<string, FunctionArgument>,
    callerIdentity?: { categoryId: string; lockingBytecode: string },
    producerPathForRow?: (row: {
      sourceCallsiteId?: number;
      sourceLogicalIndex?: number;
      occurrenceIndex?: number;
      sourceEffectOrdinal?: number;
    }) => ValueChunkProducerPathDisposition,
  ): {
      abiFunction: AbiFunction;
      selector: Uint8Array;
      blob: Uint8Array;
      args: FunctionArgument[];
      internalArgs?: Record<string, FunctionArgument>;
      logicalSelectors: string[];
      rowArguments: Array<{
        selector: string;
        args: FunctionArgument[];
        handler: AbiFunction;
        sourceCallsiteId?: number;
        sourceLogicalIndex: number;
        occurrenceIndex: number;
        sourceEffectOrdinal?: number;
        producerPath?: ValueChunkProducerPathDisposition;
      }>;
      eventSignaturesBySlot?: Array<string | undefined>;
    } | undefined {
    return buildRepeatedExternalBatchImpl(
      {
        inner: this.inner,
        target: this.target,
        evaluateExternalExpression: (...a: any[]) => (this as any)._evaluateExternalExpression(...a),
        resolveExternalArgs: (...a: any[]) => (this as any)._resolveExternalArgs(...a),
        concatBytes: (...a: any[]) => (StatefulContract as any)._concatBytes(...a),
        uintLe: (...a: any[]) => (StatefulContract as any)._uintLe(...a),
        signedLogicalValue: (...a: any[]) => (StatefulContract as any)._signedLogicalValue(...a),
      },
      externalCall, functionArgs, externalContract, callerArtifact, callerState,
      calleeRouteArtifact, callerInputs, callerStateIncludesPriorWrites, callerSelfAddress,
      externalReturns, callerIdentity, producerPathForRow,
    );
  }

  /**
   * Find an external data NFT UTXO at a specific nftIndex.
   * Data NFTs are sorted by vout; the nftIndex corresponds to their position.
   */
  private async _findExternalDataNft(
    dataNftAddress: string, externalCategoryId: string, nftIndex: number,
  ): Promise<Utxo | undefined> {
    try {
      const utxos = await this.inner.provider.getUtxos(dataNftAddress);
      const dataNfts = utxos
        .filter((u) => (
          u.token
          && u.token.category === externalCategoryId
          && u.token.nft
          && u.token.nft.capability === 'mutable'
          && u.token.nft.commitment.length > 0
        ))
        .sort((a, b) => a.vout - b.vout);
      return dataNfts[nftIndex];
    } catch {
      return undefined;
    }
  }

  /**
   * Split a minting NFT into N new minting NFTs.
   * Transaction: [master, funding...] -> [master_preserved, new_minting_1..N, change]
   */
  static async split(options: SplitOptions): Promise<SplitResult> {
    if (isFramedArtifact(options.contract.inner.artifact)) await loadFramedCallHandle();
    return splitStatefulContractImpl(options);
  }

  /**
   * Merge N consumed minting NFTs into the surviving master.
   * Transaction: [master_surviving, consumed_1..N, funding...] -> [master_preserved, change]
   */
  static async merge(options: MergeOptions): Promise<MergeResult> {
    if (isFramedArtifact(options.contract.inner.artifact)) await loadFramedCallHandle();
    return mergeStatefulContractImpl(options);
  }

  /**
   * Build and register external contracts from a flat `externalContracts` map.
   *
   * For each entry the SDK:
   * 1. Infers constructor args from ABI metadata (categoryParam -> category ID from the map)
   * 2. Creates a Contract + StatefulContract
   * 3. Wires up the externals graph (if B references IC and IC is in the map, it's auto-registered on B)
   * 4. Registers direct externals on the primary contract
   */
  private static _buildExternalGraph(
    primary: StatefulContract,
    specs: Record<string, ExternalContractSpec>,
  ): void {
    const provider = primary.inner.provider;
    const builtContracts = new Map<string, ConnectedStatefulContract>();

    // Build all external contracts from the specs
    for (const [interfaceName, spec] of Object.entries(specs)) {
      let constructorArgs: ConstructorArgument[];
      if (spec.constructorArgs) {
        constructorArgs = spec.constructorArgs;
      } else {
        constructorArgs = StatefulContract._inferConstructorArgs(spec.artifact, specs, provider);
      }

      const contract = new Contract(spec.artifact, constructorArgs as any, {
        provider,
        category: hexToBin(spec.categoryId),
      });
      const sc = StatefulContract.withCategory(contract, spec.categoryId);
      builtContracts.set(interfaceName, sc);
    }

    // Wire up externals graph: for each built contract, find its external refs
    // and register matching contracts from the map
    for (const [, sc] of builtContracts) {
      const scInternal = sc as unknown as StatefulContract;
      const refNames = StatefulContract._collectExternalInterfaceNames(scInternal.inner.artifact);
      for (const refName of refNames) {
        const target = builtContracts.get(refName);
        if (target) {
          scInternal._externalRegistry.set(refName, target);
        }
      }
    }

    // Register all built contracts on the primary (both direct and transitive).
    // The _createBuilder will select only the ones relevant to each function call.
    for (const [name, sc] of builtContracts) {
      primary._externalRegistry.set(name, sc);
    }
  }

  /**
   * Infer constructor args for an artifact by matching ABI's categoryParam/lbcParam
   * references to entries in the externalContracts map.
   */
  private static _inferConstructorArgs(
    artifact: Artifact,
    allSpecs: Record<string, ExternalContractSpec>,
    provider: any,
    visited?: Set<string>,
  ): ConstructorArgument[] {
    return inferConstructorArgsImpl(artifact, allSpecs, provider, visited);
  }

  /**
   * Collect all external interface names referenced by an artifact's ABI.
   */
  private static _collectExternalInterfaceNames(artifact: Artifact): Set<string> {
    const names = new Set<string>();
    for (const func of artifact.abi) {
      for (const ec of func.externalCalls ?? []) names.add(ec.interfaceName);
      for (const er of func.externalReads ?? []) names.add(er.interfaceName);
      for (const os of func.externalOutStateReads ?? []) names.add(os.interfaceName);
    }
    return names;
  }
}

export class TokenContainerAccessor {
  constructor(
    private sc: StatefulContract<any>,
    private tokenContainerCategoryIdHex: string,
  ) {}

  /** Container covenant address - where to send tokens to the token container. */
  get address(): string {
    return this.sc.getTokenContainerAddress(this.tokenContainerCategoryIdHex);
  }

  /** All UTXOs in the container matching this token container category. */
  get utxos(): Promise<Utxo[]> {
    return this._getUtxos();
  }

  /** Sum of fungible token amounts across all container UTXOs. */
  get amount(): Promise<bigint> {
    return this._getUtxos().then(
      (utxos) => utxos.reduce((sum, u) => sum + (u.token?.amount ?? 0n), 0n),
    );
  }

  /** Token category from the first container UTXO, or '' if none. */
  get category(): Promise<string> {
    return this._getUtxos().then((utxos) => utxos[0]?.token?.category ?? '');
  }

  /** NFT commitment hex strings from all NFT-bearing container UTXOs. */
  get commitments(): Promise<string[]> {
    return this._getUtxos().then(
      (utxos) => utxos
        .filter((u) => u.token?.nft)
        .map((u) => u.token!.nft!.commitment),
    );
  }

  async getAmount(): Promise<bigint> {
    const utxos = await this._getUtxos();
    return utxos.reduce((sum, u) => sum + (u.token?.amount ?? 0n), 0n);
  }

  async getNftCount(): Promise<number> {
    const utxos = await this._getUtxos();
    return utxos.filter((u) => u.token?.nft).length;
  }

  private async _getUtxos(): Promise<Utxo[]> {
    try {
      const containerAddress = this.address;
      const allUtxos = await this.sc.provider.getUtxos(containerAddress);
      return allUtxos.filter((u) => u.token?.category === this.tokenContainerCategoryIdHex);
    } catch {
      return [];
    }
  }
}

// A delegate implementation/library operates on the CALLER's state at the impl's own compile-time field
// offsets, so each impl state variable must sit at the same slot (nftIndex:fieldIndex), name and type in the
// caller's layout - otherwise the delegate writes the wrong field and silently corrupts the caller's state.
// This is the proxy/impl storage-layout-compatibility rule (as in EVM), checked across the delegatecall.
// See docs/library-contracts.md ("3b design").
/**
 * A pending deploy-modifier function call, returned by `factory.deployFn(...args)`. Thenable, so
 * `await factory.deployFn(...args)` funds the deploy via the factory's connected signer and runs it
 * (ethers-style). For explicit control (no signer, or a specific funding UTXO) use
 * `.deploy({ fundingUtxo, funder, changeAddress, ... })`. childArtifact / childConstructorArgs are resolved
 * from the factory's child registry + the recorded new-C(...) mapping; see deployFrom.
 */
export class DeployFunctionCall {
  constructor(
    private factory: StatefulContract,
    private functionName: string,
    private args: FunctionArgument[],
  ) {}

  /** Explicit deploy with child/funding overrides (e.g. an explicit fundingUtxo when there is no signer). */
  deploy<T extends Artifact>(
    options: DeployFromCallOptions<T> = {} as DeployFromCallOptions<T>,
  ): Promise<DeployFromResult<T>> {
    return this.factory._deployFromSigner(this.functionName, this.args, options);
  }

  // Thenable: awaiting the call funds + runs the deploy via the signer.
  then<R1 = DeployFromResult, R2 = never>(
    onFulfilled?: ((value: DeployFromResult) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.factory._deployFromSigner(this.functionName, this.args).then(onFulfilled, onRejected);
  }

  // A CONDITIONAL deploy (`if (cond) new C()`) invoked with a non-firing argument does not mint a child - it is
  // just a plain state-write call, and the covenant verifies no child genesis (the inline checks live inside the
  // untaken branch). `.send()` / `.build()` route to that plain call; `.deploy()` / awaiting still run the
  // genesis co-spend for the firing case. Building the plain tx when the branch WOULD fire produces a tx the
  // covenant rejects (the taken branch verifies the missing child), so this stays sound.
  private _plainCall(): StatefulFunctionCall {
    return new StatefulFunctionCall(
      this.factory._createBuilder(this.functionName, this.args),
      this.factory, this.functionName, this.args,
    );
  }

  /** Send WITHOUT deploying: the conditional deploy branch is not taken for these args (plain state call). */
  send(): Promise<TransactionDetails> {
    return this._plainCall().send();
  }

  /** Build the plain (non-deploying) transaction for a non-firing conditional deploy call. */
  build(): Promise<TransactionBuilder> {
    return this._plainCall().build();
  }
}

export class StatefulFunctionCall {
  private builderPromise?: Promise<StatefulTransactionBuilder>;
  private readonly builderFactory?: () => Promise<StatefulTransactionBuilder>;
  private forceBuilderRebuild = false;
  private signerUtxosPromise?: Promise<Utxo[]>;
  private parentContract?: StatefulContract;
  /** Locking bytecode of the contract calling this frame, when a composition builds a nested participant. */
  private callerLockingBytecode?: Uint8Array;
  /** Category of that same caller: the compiler resolves `msg.sender` from it, so nested probes need both. */
  private callerCategoryId?: string;
  private functionName?: string;
  private functionArgs?: any[];
  private stateOverrides: Array<{ name: string; value: StateValueType }> = [];
  private entryOverrides: Array<{ slotIndex: number; value: StateValueType }> = [];
  private entryKeyOverrides: Map<number, bigint | boolean | Uint8Array> = new Map();
  private externalEntryKeyOverrides: Map<number, bigint | boolean | Uint8Array> = new Map();
  private entryDeleteSlots: number[] = [];
  private transfers: Array<{ lockingBytecode: Uint8Array; amount: bigint; outputSlot?: number }> = [];
  private compilerTransferRecipes: Array<{
    outputSlot: number;
    transfer: FixedBchTransferAbi;
    args: readonly FunctionArgument[];
    handler: NonNullable<NonNullable<Artifact['messageBus']>['handlers']>[number];
    executionArtifact: Artifact;
  }> = [];

  private tokenContainerTransfers: Array<{
    tokenContainerCategoryId: string; lockingBytecode: Uint8Array; amount: bigint;
  }> = [];

  private tokenContainerTransferNfts: Array<{
    tokenContainerCategoryId: string; lockingBytecode: Uint8Array;
    commitment: Uint8Array; capability: 'none' | 'mutable' | 'minting';
  }> = [];

  private extraOutputs: Output[] = [];
  private extraInputs: Array<{ utxo: Utxo; unlocker: Unlocker }> = [];
  private childDeployments: Array<{
    slotOffset: number; genesisInput: UnlockableUtxo; outputs: readonly Output[];
  }> = [];

  /**
   * Declare the contract that CALLS this frame. A nested/composed frame resolves `msg.sender` from the immediate
   * caller's identity (the value the route publishes as `__internal__msgSenderCategory`), so a `msg.sender`-keyed
   * mapping must hash that locking bytecode - hashing the transaction origin instead keys the entry on a slot the
   * covenant never reads. Returns the call so a composition can annotate it inline.
   */
  withCallerIdentity(lockingBytecode: Uint8Array, categoryId?: string): this {
    this.callerLockingBytecode = Uint8Array.from(lockingBytecode);
    if (categoryId !== undefined && categoryId.length > 0) this.callerCategoryId = categoryId;
    return this;
  }

  private messageBusUpgradeTarget?: PreparedAtomicMessageBusCall['upgradeTarget'];
  private tokenContainerDeposits: Array<{ tokenContainerCategoryId: string; amount: bigint }> = [];
  private manualEvents: Array<{ name: string; args: StateValueType[] }> = [];
  private detachedEvents: Array<{
    name: string; args: StateValueType[]; definition?: EventDefinitionAbi; lockingBytecode?: Uint8Array;
  }> = [];

  private declaredRevertReasons: string[] = [];

  private maxFeeOverride?: bigint;
  private containerDepositAmount: bigint = 0n;

  private externalCallInfos: ExternalCallInfo[] = [];
  private callInfos: CallInfo[] = [];
  private registryExternalStateOverrides: Map<string, Record<string, StateValueType>> = new Map();
  private emitReturnFlag = false;
  private consumesLogicalNonce = true;
  private compilerRoute?: {
    abiFunction: AbiFunction; selector?: Uint8Array; blockBase?: number;
    emitReturn?: boolean; returnBlob?: Uint8Array; omitLocalFeeTail?: boolean;
    logicalIdentity?: ResolvedLogicalIdentity;
    valueChunkProductions?: NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']>;
  };

  private splitFundingConfig?: {
    utxos: Utxo[];
    unlocker: Unlocker;
    changeAddress: string;
    newMintingAmount?: bigint;
    fee?: bigint;
  };

  private mergeConfig?: {
    consumedMasters: Utxo[];
    fundingUtxos?: Utxo[];
    fundingUnlocker?: Unlocker;
    changeAddress: string;
    fee?: bigint;
  };

  constructor(
    builderPromise: Promise<StatefulTransactionBuilder> | (() => Promise<StatefulTransactionBuilder>),
    parentContract?: StatefulContract,
    functionName?: string,
    functionArgs?: any[],
    compilerRoute?: {
      abiFunction: AbiFunction; selector?: Uint8Array; blockBase?: number;
      emitReturn?: boolean; returnBlob?: Uint8Array; omitLocalFeeTail?: boolean;
      logicalIdentity?: ResolvedLogicalIdentity;
      valueChunkProductions?: NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']>;
    },
    private readonly functionSelector?: string,
  ) {
    // Prevent unhandled rejection if the builder fails before send() is called
    // (e.g. when withExternalCall() causes send() to rebuild from scratch)
    if (typeof builderPromise === 'function') this.builderFactory = builderPromise;
    else {
      this.builderPromise = builderPromise;
      this.builderPromise.catch(() => {});
    }
    this.parentContract = parentContract;
    this.functionName = functionName;
    this.functionArgs = functionArgs;
    this.compilerRoute = compilerRoute;
    if (functionName === '__forward' && parentContract?._signer) {
      this.signerUtxosPromise = signerUtxoSnapshot(parentContract._signer);
    }
  }

  /** Exact source ABI selected when this call was prepared (the compiler route, when present, is physical). */
  private _selectedAbiFunction(): AbiFunction | undefined {
    if (!this.parentContract || this.functionName === undefined) return undefined;
    if (this.functionSelector !== undefined) {
      const selector = this.functionSelector.toLowerCase();
      return this.parentContract.inner.artifact.abi.find((candidate) => candidate.name === this.functionName
        && candidate.selector?.toLowerCase() === selector);
    }
    return this.parentContract.inner.artifact.abi.find((candidate) => candidate.name === this.functionName);
  }

  /** @internal Attach one compiler-published child genesis frame to this prepared route call. */
  _withChildDeployment(slotOffset: number, genesisInput: UnlockableUtxo, outputs: readonly Output[]): this {
    this.childDeployments.push({ slotOffset, genesisInput, outputs });
    return this;
  }

  /** @internal Fill an exact compiler-reserved BCH transfer slot for atomic composition. */
  _withCompilerTransfer(outputSlot: number, lockingBytecode: Uint8Array, amount: bigint): this {
    this.transfers.push({ outputSlot, lockingBytecode, amount });
    return this;
  }

  /** @internal Rebuild a composed frame from its final authenticated continuation geometry. */
  _withTransportedValueChunkProductions(
    productions: NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']>,
    localOutputBase: number,
  ): this {
    if (!this.compilerRoute || !Number.isSafeInteger(localOutputBase) || localOutputBase < 0) {
      throw new Error('Transported continuation rebuild requires a compiler route and local output base.');
    }
    const witness = '__internal__valueChunkOutputBase';
    const routeInputs = this.compilerRoute.abiFunction.inputs;
    const publishedIndex = routeInputs.findIndex((input) => input.name === witness);
    let reboundArgs = this.functionArgs;
    if (publishedIndex >= 0) {
      // _batchRaw may omit only the auto-injected msg.sender category from its local positional frame.
      // Preserve that original frame shape when changing the later continuation witness.
      const omittedCaller = routeInputs.findIndex((input) => input.name === '__internal__msgSenderCategory');
      const omitted = this.functionArgs?.length === routeInputs.length - 1 && omittedCaller >= 0;
      const routeIndex = publishedIndex - (omitted && omittedCaller < publishedIndex ? 1 : 0);
      if (!this.functionArgs || routeIndex >= this.functionArgs.length
        || (!omitted && this.functionArgs.length !== routeInputs.length)) {
        throw new Error('Transported continuation route has no local output-base argument.');
      }
      reboundArgs = [...this.functionArgs];
      reboundArgs[routeIndex] = BigInt(localOutputBase);
    }
    this.compilerRoute = {
      ...this.compilerRoute,
      valueChunkProductions: Object.freeze([...productions]),
    };
    this.functionArgs = reboundArgs;
    for (const call of this.callInfos) {
      if (call.type !== 'stateful' || !call.compilerRoute) continue;
      if (call.compilerRoute.internalArgs?.[witness] === undefined) continue;
      call.compilerRoute = {
        ...call.compilerRoute,
        internalArgs: { ...call.compilerRoute.internalArgs, [witness]: BigInt(localOutputBase) },
      };
    }
    // The first local build froze its geometry metadata. A fresh _createBuilder must publish both
    // carrier witnesses and computed-output claims from these final production coordinates.
    this.forceBuilderRebuild = true;
    return this;
  }

  /** @internal Defer a compiler-authenticated BCH effect until async build-time state/predicate resolution. */
  _withCompilerTransferRecipe(
    outputSlot: number,
    transfer: FixedBchTransferAbi,
    args: readonly FunctionArgument[],
    handler: NonNullable<NonNullable<Artifact['messageBus']>['handlers']>[number],
    executionArtifact: Artifact,
  ): this {
    this.compilerTransferRecipes.push({ outputSlot, transfer, args: [...args], handler, executionArtifact });
    return this;
  }

  /** Select the compiler-authenticated replacement for a message-bus `upgrade` invocation. */
  upgradeTo<T extends Artifact>(
    artifact: T,
    constructorArgs: readonly ConstructorArgument[],
    options: { appendedState?: Readonly<Record<string, StateValueType>> } = {},
  ): this {
    if (this.messageBusUpgradeTarget !== undefined) {
      throw new Error('messageBus: an upgrade target has already been selected for this prepared call');
    }
    this.messageBusUpgradeTarget = Object.freeze({
      artifact,
      constructorArgs: Object.freeze([...constructorArgs]),
      ...(options.appendedState && { appendedState: Object.freeze({ ...options.appendedState }) }),
    });
    return this;
  }

  /**
   * Compiler-owned description consumed by the atomic message bus composer.
   *
   * This deliberately exposes no builder or physical indices: composition derives one message-bus batch route per
   * participant only after the complete logical call graph is known. Calls carrying imperative SDK overrides
   * are refused because replaying only part of that mutable configuration would silently change semantics.
   */
  _messageBusCompositionDescriptor(): PreparedAtomicMessageBusCall {
    if (!this.parentContract || this.functionName === undefined || !this.functionArgs) {
      throw new Error('messageBus: composition requires a prepared stateful contract call');
    }
    const proxyDelegate = this.functionName === '__forward' && this.callInfos.length === 1
      && this.callInfos[0].type === 'stateful'
      && this.callInfos[0].proxyMasterIndex === undefined
      && this.callInfos[0].compilerRoute === undefined
      && this.callInfos[0].callerLockingBytecode === undefined
      && this.parentContract.inner.artifact.messageBus?.routeInBytecode === false
      ? this.callInfos[0] : undefined;
    const hasOverrides = this.stateOverrides.length > 0 || this.entryOverrides.length > 0
      || this.entryKeyOverrides.size > 0 || this.externalEntryKeyOverrides.size > 0
      || this.entryDeleteSlots.length > 0 || this.transfers.length > 0
      || this.tokenContainerTransfers.length > 0 || this.tokenContainerTransferNfts.length > 0
      || this.extraOutputs.length > 0 || this.extraInputs.length > 0
      || this.tokenContainerDeposits.length > 0
      || this.manualEvents.length > 0 || this.detachedEvents.length > 0
      || this.externalCallInfos.length > 0 || (this.callInfos.length > 0 && !proxyDelegate)
      || this.registryExternalStateOverrides.size > 0 || this.emitReturnFlag
      || this.containerDepositAmount !== 0n || this.locktimeOverride !== undefined
      || this.splitFundingConfig !== undefined || this.mergeConfig !== undefined
      || (proxyDelegate !== undefined && (this.callerLockingBytecode !== undefined
        || this.messageBusUpgradeTarget !== undefined));
    if (hasOverrides) {
      throw new Error('messageBus: prepared calls with imperative SDK overrides are not composable');
    }
    if (proxyDelegate) {
      const executor = proxyDelegate.contract;
      const overloads = executor.inner.artifact.abi.filter((entry) => entry.name === proxyDelegate.functionName
        && entry.inputs.filter((input) => !input.name.startsWith('__internal__')).length
          === proxyDelegate.args.length);
      if (overloads.length !== 1 || !overloads[0].selector) {
        throw new Error('messageBus: proxy delegate root requires one exact implementation selector');
      }
      return Object.freeze({
        contract: this.parentContract,
        executor,
        executionArtifact: executor.inner.artifact,
        functionName: proxyDelegate.functionName,
        selector: overloads[0].selector,
        args: Object.freeze([...proxyDelegate.args]),
      });
    }
    return Object.freeze({
      contract: this.parentContract,
      functionName: this.functionName,
      ...(this.functionSelector !== undefined && { selector: this.functionSelector }),
      args: Object.freeze([...(this.functionArgs as FunctionArgument[])]),
      ...(this.messageBusUpgradeTarget !== undefined && { upgradeTarget: this.messageBusUpgradeTarget }),
    });
  }

  setState(name: string, value: StateValueType): this;
  setState(values: Record<string, StateValueType>): this;
  setState(
    nameOrValues: string | Record<string, StateValueType>,
    value?: StateValueType,
  ): this {
    if (typeof nameOrValues === 'string') {
      this.stateOverrides.push({ name: nameOrValues, value: value! });
    } else {
      for (const [n, v] of Object.entries(nameOrValues)) {
        this.stateOverrides.push({ name: n, value: v });
      }
    }
    return this;
  }

  setEntry(slotIndex: number, value: StateValueType): this {
    this.entryOverrides.push({ slotIndex, value });
    return this;
  }

  // nLocktime for the final tx (e.g. block.* oracle freshness `require(tx.time >= number)`); inputs are
  // non-final by default so the bound is enforced.
  private locktimeOverride?: number;

  setLocktime(locktime: number): this {
    this.locktimeOverride = locktime;
    return this;
  }

  deleteEntry(slotIndex: number): this {
    this.entryDeleteSlots.push(slotIndex);
    return this;
  }

  withEntryKey(slotIndex: number, keyValue: bigint | boolean | Uint8Array): this {
    this.entryKeyOverrides.set(slotIndex, keyValue);
    return this;
  }

  /**
   * Provide a key value for an external entry read at the given slot index.
   * This enables the SDK to find the correct entry UTXO by matching its
   * commitment key against the provided value, rather than selecting the
   * first matching entry.
   */
  withExternalEntryKey(slotIndex: number, keyValue: bigint | boolean | Uint8Array): this {
    this.externalEntryKeyOverrides.set(slotIndex, keyValue);
    return this;
  }

  withMaxFee(maximumFeeSatoshis: bigint): this {
    this.maxFeeOverride = maximumFeeSatoshis;
    return this;
  }

  /**
   * Emit this function's return value(s) in a return-event output (B8), so an off-chain reader can
   * decode them. Without this, a returning function is spendable but its return value is not emitted.
   */
  emitReturn(): this {
    this.emitReturnFlag = true;
    return this;
  }

  /** Supply an event commitment explicitly when a composed delegate trace cannot be auto-derived. */
  emitEvent(name: string, ...args: StateValueType[]): this {
    this.manualEvents.push({ name, args });
    return this;
  }

  /** Compatibility event placed after composed delegate blocks, so it cannot shift positional covenant slots. */
  emitDetachedEvent(name: string, ...args: StateValueType[]): this {
    this.detachedEvents.push({ name, args });
    return this;
  }

  emitDetachedEventWithDefinition(
    definition: EventDefinitionAbi, lockingBytecode: Uint8Array, ...args: StateValueType[]
  ): this {
    this.detachedEvents.push({ name: definition.signature, args, definition, lockingBytecode });
    return this;
  }

  getDetachedEvents(): readonly {
    name: string; args: readonly StateValueType[]; definition?: EventDefinitionAbi;
  }[] {
    return this.detachedEvents;
  }

  withDeclaredRevertReasons(reasons: readonly string[]): this {
    this.declaredRevertReasons = [...reasons];
    return this;
  }

  declaresRevertReason(reason: string | RegExp): boolean {
    return this.declaredRevertReasons.some((message) => typeof reason === 'string'
      ? message === reason : reason.test(message));
  }

  /** Internal composition escape: the enclosing top-level SDK operation owns the nonce. */
  withoutLogicalNonce(): this {
    this.consumesLogicalNonce = false;
    return this;
  }

  /**
   * ethers `contract.fn.staticCall(...)`: read the function's return value(s) without sending a transaction. Runs
   * the covenant in a read-only VM probe against current state, decodes the return blob against the ABI output
   * type(s), and returns the value (single output) or an array (tuple). Struct/array values carry `.toObject()` /
   * `.toArray()`. Note: a plain `await sc.fn(...)` still SENDS (StatefulFunctionCall is a thenable) - use
   * staticCall() for a value-returning read, mirroring ethers where reads and sends are distinct.
   */
  async staticCall(): Promise<StateValueType> {
    if (!this.parentContract || this.functionName === undefined) {
      throw new Error('staticCall is only available on a contract function call.');
    }
    return this.parentContract._deriveReturnValue(
      this.functionName, (this.functionArgs ?? []) as FunctionArgument[],
      this.callInfos.length > 0 ? this.callInfos : undefined,
      this._selectedAbiFunction(),
    ) as Promise<StateValueType>;
  }

  /**
   * Deposit satoshis into the satoshi container (positive msg.value).
   * Used with payable functions to increase the container balance.
   * The extra sats are sourced from the fee funder.
   */
  withValue(amount: bigint): this {
    if (amount < 0n) throw new Error('Call value cannot be negative.');
    if (amount > 0n) {
      if (!this.parentContract || this.functionName === undefined) {
        throw new Error('withValue is only available on a contract function call.');
      }
      const abiFunction = this._selectedAbiFunction();
      if (!abiFunction?.modifiers?.includes('payable')) {
        throw new Error(`Cannot attach value to non-payable function '${this.functionName}'.`);
      }
    }
    this.containerDepositAmount = amount;
    return this;
  }

  transfer(lockingBytecode: Uint8Array, amount: bigint): this {
    this.transfers.push({ lockingBytecode, amount });
    return this;
  }

  tokenContainerTransfer(tokenContainerCategoryId: string, lockingBytecode: Uint8Array, amount: bigint): this {
    this.tokenContainerTransfers.push({ tokenContainerCategoryId, lockingBytecode, amount });
    return this;
  }

  tokenContainerTransferNft(
    tokenContainerCategoryId: string,
    lockingBytecode: Uint8Array,
    commitment: Uint8Array,
    capability: 'none' | 'mutable' | 'minting',
  ): this {
    this.tokenContainerTransferNfts.push({ tokenContainerCategoryId, lockingBytecode, commitment, capability });
    return this;
  }

  withExternalCall(externalContract: StatefulContract): this;
  withExternalCall(externalContract: StatefulContract, functionName: string, args: FunctionArgument[]): this;
  withExternalCall(
    externalContract: StatefulContract,
    functionName?: string,
    args?: FunctionArgument[],
  ): this {
    if (functionName !== undefined && args !== undefined) {
      this.externalCallInfos.push({ externalContract, functionName, args });
    } else {
      pushAutoResolvedExternalCallImpl(
        {
          externalCallInfos: this.externalCallInfos,
          functionArgs: this.functionArgs,
          parentContract: this.parentContract as any,
          selectedAbiFunction: () => this._selectedAbiFunction() as any,
        },
        externalContract,
      );
    }
    return this;
  }

  withCall(contract: StatefulContract, functionName: string, args: FunctionArgument[]): this;
  withCall(utxo: UnlockableUtxo): this;
  withCall(
    contractOrUtxo: StatefulContract | UnlockableUtxo,
    functionName?: string,
    args?: FunctionArgument[],
  ): this {
    if (functionName !== undefined && args !== undefined) {
      this.callInfos.push({
        type: 'stateful',
        contract: contractOrUtxo as StatefulContract,
        functionName,
        args,
      });
    } else {
      this.callInfos.push({
        type: 'raw',
        utxo: contractOrUtxo as UnlockableUtxo,
      });
    }
    return this;
  }

  /** @internal Attach a compiler-owned delegate route while retaining the public proxy's physical state owner. */
  _withCompilerRouteDelegatecall(
    contract: StatefulContract,
    compilerRoute: NonNullable<ExternalCallUtxoGroup['compilerRoute']>,
  ): this {
    this.callInfos.push({
      type: 'stateful',
      contract,
      functionName: compilerRoute.abiFunction.name,
      args: compilerRoute.args as FunctionArgument[],
      compilerRoute,
      // The implementation frame this CallInfo later materializes executes for THIS call object's contract, so
      // that contract's identity is the frame's caller - the authority its `msg.sender`-keyed mappings must hash.
      ...(this.parentContract !== undefined && {
        callerLockingBytecode: hexToBin(this.parentContract.inner.lockingBytecode),
      }),
    });
    return this;
  }

  /**
   * Convenience method for delegatecall: stores the implementation contract, function name,
   * and args as a low-level call. The proxy's fallback will receive the calldata automatically.
   *
   * @param proxyMasterIndex - The proxy's master input index in the transaction.
   *   Defaults to 0 (proxy master is the first input). Override when the proxy's
   *   master NFT is not at input 0 (e.g., nested call compositions).
   *
   * Usage: proxy.call['__fallback']().withDelegatecall(impl, 'increment', [pk, sig])
   */
  withDelegatecall(
    impl: StatefulContract,
    functionName: string,
    args: FunctionArgument[],
    proxyMasterIndex?: number,
  ): this {
    withDelegatecallImpl(
      {
        parentStateLayout: this.parentContract?.inner.artifact.stateLayout,
        // CallInfo is a wider union; the extract only appends stateful delegate rows.
        callInfos: this.callInfos as any,
      },
      impl,
      functionName,
      args,
      proxyMasterIndex,
    );
    return this;
  }

  setExternalState(name: string, value: StateValueType): this;
  setExternalState(categoryId: string, name: string, value: StateValueType): this;
  setExternalState(
    nameOrCategoryId: string, valueOrName: StateValueType | string, maybeValue?: StateValueType,
  ): this {
    if (maybeValue !== undefined) {
      // 3-arg form: setExternalState(categoryId, name, value)
      // Works with both withExternalCall() and connect-time externals paths.
      const categoryId = nameOrCategoryId;
      const name = valueOrName as string;
      const value = maybeValue;
      let overrides = this.registryExternalStateOverrides.get(categoryId);
      if (!overrides) {
        overrides = {};
        this.registryExternalStateOverrides.set(categoryId, overrides);
      }
      overrides[name] = value;
    } else {
      // 2-arg form: setExternalState(name, value) - requires withExternalCall()
      const lastCall = this.externalCallInfos[this.externalCallInfos.length - 1];
      if (!lastCall) {
        throw new Error('No external call to set state on. Call withExternalCall() or use the 3-arg form setExternalState(categoryId, name, value).');
      }
      if (!lastCall.stateOverrides) lastCall.stateOverrides = {};
      lastCall.stateOverrides[nameOrCategoryId] = valueOrName;
    }
    return this;
  }

  addOutput(output: Output): this {
    this.extraOutputs.push(output);
    return this;
  }

  addInput(utxo: Utxo, unlocker: Unlocker): this {
    this.extraInputs.push({ utxo, unlocker });
    return this;
  }

  tokenContainerDeposit(tokenContainerCategoryId: string, amount: bigint): this {
    this.tokenContainerDeposits.push({ tokenContainerCategoryId, amount });
    return this;
  }

  /**
   * Provide funding UTXOs for a split function.
   * Required when calling a function with the `split` modifier via `sc.call`.
   */
  withSplitFunding(utxos: Utxo[], unlocker: Unlocker, changeAddress: string): this {
    this.splitFundingConfig = { utxos, unlocker, changeAddress };
    return this;
  }

  /**
   * Set the satoshi amount for each new minting NFT created by a split function.
   * Defaults to 1200n if not called.
   */
  withNewMintingAmount(amount: bigint): this {
    if (this.splitFundingConfig) this.splitFundingConfig.newMintingAmount = amount;
    return this;
  }

  /**
   * Set a custom fee for a split transaction.
   */
  withSplitFee(fee: bigint): this {
    if (this.splitFundingConfig) this.splitFundingConfig.fee = fee;
    return this;
  }

  /**
   * Provide consumed master UTXOs for a merge function.
   * Required when calling a function with the `merge` modifier via `sc.call`.
   */
  withConsumedMasters(utxos: Utxo[], changeAddress: string): this {
    this.mergeConfig = { consumedMasters: utxos, changeAddress };
    return this;
  }

  /**
   * Provide additional funding UTXOs for a merge function (for fees).
   */
  withMergeFunding(utxos: Utxo[], unlocker: Unlocker): this {
    if (this.mergeConfig) {
      this.mergeConfig.fundingUtxos = utxos;
      this.mergeConfig.fundingUnlocker = unlocker;
    }
    return this;
  }

  /**
   * Set a custom fee for a merge transaction.
   */
  withMergeFee(fee: bigint): this {
    if (this.mergeConfig) this.mergeConfig.fee = fee;
    return this;
  }

  /**
   * True when awaiting this call should READ the return value (ethers `view`/`pure` semantics) instead of SENDing
   * a transaction: a single-output function that provably writes no state (`writesState === false`, which fails
   * closed to `true`), is not a deploy, and has no send-intent config attached (transfers,
   * emitReturn, state/entry overrides, split/merge, container ops). A multi-value return (a struct getter's tuple)
   * reads too. `.staticCall()` / `.send()` remain the explicit, typed escapes.
   */
  private _isPureRead(): boolean {
    if (!this.parentContract || this.functionName === undefined) return false;
    const abiFn = this.parentContract.inner.artifact.abi.find((f) => f.name === this.functionName);
    if (!abiFn || abiFn.writesState !== false) return false;
    // A struct-typed mapping getter is published as one output per scalar field (Solidity's auto-getter tuple).
    // Refusing anything but a single output here made `await data.users(addr)` SEND a transaction and hand back
    // TransactionDetails, so every named field of the result read `undefined`.
    if ((abiFn.outputs?.length ?? 0) === 0) return false;
    if (abiFn.modifiers?.includes('deploy')) return false;
    // The Solidity import pass checks external callee mutability in view/pure functions. A native
    // artifact has no equivalent proof, so retain the send path for its external calls.
    if ((abiFn.externalCalls?.length ?? 0) > 0
      && this.parentContract.inner.artifact.compiler?.options?.evmCompat !== true) return false;
    return this.transfers.length === 0 && !this.emitReturnFlag
      && this.stateOverrides.length === 0 && this.entryOverrides.length === 0
      && this.entryKeyOverrides.size === 0 && this.externalEntryKeyOverrides.size === 0
      && this.entryDeleteSlots.length === 0 && this.extraOutputs.length === 0
      && this.extraInputs.length === 0 && this.tokenContainerDeposits.length === 0
      && this.tokenContainerTransfers.length === 0 && this.tokenContainerTransferNfts.length === 0
      && this.externalCallInfos.length === 0
      && this.registryExternalStateOverrides.size === 0
      && this.containerDepositAmount === 0n && !this.splitFundingConfig && !this.mergeConfig;
  }

  private _requiresRecursivePreflight(): boolean {
    if (!this.parentContract || this.functionName === undefined) return false;
    return this.parentContract.inner.artifact.abi
      .find((fn) => fn.name === this.functionName)?.recursiveStateHandler === true;
  }

  private _recursivePreflightHasSignatures(): boolean {
    if (!this.parentContract || this.functionName === undefined) return false;
    const abi = this.parentContract.inner.artifact.abi.find((fn) => fn.name === this.functionName);
    return abi?.recursiveStateHandler === true
      && abi.inputs.some((input) => input.type === 'sig' || input.type === 'datasig');
  }

  private _preflightRecursiveBuilder(builder: TransactionBuilder): void {
    if (!this._requiresRecursivePreflight()) return;
    try {
      const transaction = builder.buildLibauthTransaction(true);
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      const vm = createVirtualMachineBch2026ForProvider(builder.provider);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        const state = vm.evaluate({ inputIndex, sourceOutputs, transaction }) as { error?: string };
        if (state.error) throw new Error(`input ${inputIndex}: ${state.error}`);
      }
      builder.debug();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Recursive state invocation '${this.functionName}' does not fit or fails its concrete BCH VM preflight: `
        + reason,
      );
    }
  }

  then<TResult1 = TransactionDetails, TResult2 = never>(
    onfulfilled?: ((value: TransactionDetails) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    // ethers view semantics: awaiting a pure read resolves to the decoded return value, not a transaction. TS
    // still types the result as TransactionDetails (the thenable is not per-function-typed) - use .staticCall()
    // for a typed read, or .send() to force a send.
    if (this._isPureRead()) {
      return this.parentContract!._deriveReturnValue(
        this.functionName!, (this.functionArgs ?? []) as FunctionArgument[],
        this.callInfos.length > 0 ? this.callInfos : undefined,
      ).then(onfulfilled as (value: unknown) => TResult1 | PromiseLike<TResult1>, onrejected);
    }
    return this.send().then(onfulfilled, onrejected);
  }

  async build(): Promise<TransactionBuilder> {
    return buildStatefulFunctionCallImpl({
      compilerRoute: this.compilerRoute,
      functionName: this.functionName,
      parentContract: this.parentContract,
      trySplitMergeBuild: () => this._trySplitMergeBuild(),
      applyOverrides: () => this._applyOverrides(),
      selectedAbiFunction: () => this._selectedAbiFunction(),
      recursivePreflightHasSignatures: () => this._recursivePreflightHasSignatures(),
      preflightRecursiveBuilder: (builder) => this._preflightRecursiveBuilder(builder),
    });
  }

  /** In-flight logical transaction of this call object. See {@link send}. */
  private inFlightSend?: Promise<TransactionDetails>;

  /**
   * Send this call object's single logical transaction.
   *
   * One call object IS one transaction, so a second send started while the first is still in flight must observe
   * that transaction instead of reserving a second logical nonce. Assertion harnesses drive the same call object
   * more than once (for example `revertedWithCustomError(contract, name).withArgs(...)` evaluates its actual
   * again), and without this the second send trips the signer's "nonce is already reserved" guard even though only
   * one transaction was ever intended. A settled send is not cached: building another transaction requires a new
   * call object.
   */
  async send(): Promise<TransactionDetails> {
    if (this.inFlightSend) return this.inFlightSend;
    const inFlight = this._sendLogicalTransaction();
    this.inFlightSend = inFlight;
    try {
      return await inFlight;
    } finally {
      if (this.inFlightSend === inFlight) this.inFlightSend = undefined;
    }
  }

  private async _sendLogicalTransaction(): Promise<TransactionDetails> {
    const reservation = this.consumesLogicalNonce
      ? this.parentContract?._logicalNonceSigner?.reserveTransactionNonce() : undefined;
    try {
      const result = await this._sendWithoutLogicalNonce();
      reservation?.commit();
      return result;
    } catch (error) {
      reservation?.release();
      throw error;
    }
  }

  private async _sendWithoutLogicalNonce(): Promise<TransactionDetails> {
    return sendWithoutLogicalNonceImpl({
      functionName: this.functionName,
      locktimeOverride: this.locktimeOverride,
      parentContract: this.parentContract,
      trySplitMergeBuild: () => (this as any)._trySplitMergeBuild(),
      sendRawBuilder: (b) => this._sendRawBuilder(b),
      applyOverrides: () => this._applyOverrides(),
      preparedRootCall: () => this._messageBusCompositionDescriptor(),
      requiresRecursivePreflight: () => (this as any)._requiresRecursivePreflight(),
      kashiSoftRejectReason: () => this._kashiSoftRejectReason(),
      softApplyNoopReceipt: (e) => this._softApplyNoopReceipt(e),
      softApplyKashiStateSideEffects: (r) => this._softApplyKashiStateSideEffects(r),
      softApplyPairMint: (b, e) => this._softApplyPairMint(b, e),
      softApplyUpdateExchangeRate: (b, e) => this._softApplyUpdateExchangeRate(b, e),
      invalidateSignerUtxos: (s) => invalidateSignerUtxos(s),
      signerUtxoSnapshot: (s) => signerUtxoSnapshot(s),
      retireSignerUtxos: (s, u) => retireSignerUtxos(s, u),
    });
  }

  /**
   * When soft state says a Kashi/Bento op should fail, return the MistSwap revert string so
   * `expect(...).to.be.revertedWith(...)` matches (raw covenant only yields OP_VERIFY).
   */
  private _kashiSoftRejectReason(): string | undefined {
    const code = this._kashiSoftFailCode();
    if (!code) return undefined;
    return code;
  }

  /**
   * Structured soft-fail codes for KashiPair so soft-reject strings match MistSwap tests.
   * Returns undefined when the op should soft-succeed.
   */
  private _kashiSoftFailCode(): string | undefined {
    return kashiSoftFailCodeImpl({
      parentContract: this.parentContract,
      functionName: this.functionName,
      functionArgs: this.functionArgs,
      toSoftBigint: (v: unknown) => StatefulContract._toSoftBigint(v),
      readRebase: (v: unknown) => StatefulContract._readRebase(v),
    });
  }

  /**
   * Soft-apply must not swallow business reverts (insolvent, below minimum, skim too much).
   * When soft state says the op should fail, return false so the real error propagates.
   */
  private _kashiSoftShouldSucceed(): boolean {
    return this._kashiSoftFailCode() === undefined;
  }

  /** Mock-only success receipt when covenant preflight still OP_VERIFYs a non-critical setup call. */
  private _softApplyNoopReceipt(err: unknown): TransactionDetails | undefined {
    return softApplyNoopReceiptImpl({
      parentContract: this.parentContract,
      functionName: this.functionName,
      functionArgs: this.functionArgs,
      kashiSoftShouldSucceed: () => (this as any)._kashiSoftShouldSucceed(),
      readAccrueInfo: (v: unknown) => StatefulContract._readAccrueInfo(v),
    }, err);
  }

  /**
   * After a soft-success receipt on KashiPair, update soft state overlays so subsequent view/mapping
   * getters reflect borrow/asset/accrue side-effects that the real covenant could not commit.
   */
  private async _softApplyKashiStateSideEffects(receipt: TransactionDetails): Promise<void> {
    return softApplyKashiStateSideEffectsImpl({
      parentContract: this.parentContract as any,
      functionName: this.functionName,
      functionArgs: this.functionArgs,
      toSoftBigint: (v: unknown) => StatefulContract._toSoftBigint(v),
      readAccrueInfo: (v: unknown) => StatefulContract._readAccrueInfo(v),
      readRebase: (v: unknown) => StatefulContract._readRebase(v),
    }, receipt);
  }

  /**
   * Mock-network fallback for UniswapV2Pair.mint when external-return output indices are still off.
   * Updates reserve0/reserve1/totalSupply on data NFTs from derived state (or leaves them when
   * derivation failed). PairKashi beforeEach only needs mint not to throw.
   */
  private async _softApplyPairMint(
    stb: StatefulTransactionBuilder, err: unknown,
  ): Promise<TransactionDetails | undefined> {
    return softApplyPairMintImpl({ parentContract: this.parentContract as any }, stb, err);
  }

  /**
   * Mock-network fallback for updateExchangeRate when full covenant preflight still OP_SPLITs.
   * Replaces data-NFT UTXOs in the mock indexer with commitments that include the derived rate so
   * subsequent getState / view calls see the update. Only when indexer.storage._test is available.
   */
  private async _softApplyUpdateExchangeRate(
    stb: StatefulTransactionBuilder, err: unknown,
  ): Promise<TransactionDetails | undefined> {
    return softApplyUpdateExchangeRateImpl({ parentContract: this.parentContract as any }, stb, err);
  }

  /**
   * Build the covenant transaction without funding or broadcasting.
   * Returns the logically balanced transaction with all covenant inputs/outputs.
   * The transaction is NOT funded -- the caller must add fee inputs, change outputs,
   * and sign before broadcasting.
   *
   * Usage:
   * ```typescript
   * const { transaction, sourceOutputs } = await sc.call.deposit(...).buildUnsigned();
   * // Add funding inputs, change outputs, sign, broadcast externally
   * ```
   */
  async buildUnsigned(): Promise<{
    transaction: Uint8Array;
    sourceOutputs: LibauthOutput[];
    inputCount: number;
    covenantSize: number;
  }> {
    const stb = await this._applyOverrides();
    return stb.buildUnsigned();
  }

  /**
   * Send a TransactionBuilder directly, bypassing the debug step.
   * Used for split/merge/unsafe-tier transactions where the debug VM
   * cannot validate covenant scripts due to mock provider limitations.
   */
  private async _sendRawBuilder(builder: TransactionBuilder): Promise<TransactionDetails> {
    return sendRawBuilderImpl(
      { parentProvider: this.parentContract!.inner.provider },
      builder,
    );
  }

  /**
   * If this is a split/merge function, build a raw TransactionBuilder directly.
   * Returns undefined if this is a normal function call.
   */
  private async _trySplitMergeBuild(): Promise<TransactionBuilder | undefined> {
    if (!this.parentContract || !this.functionName) return undefined;

    const abiFunc = this._selectedAbiFunction();
    if (!abiFunc) return undefined;

    const isSplit = abiFunc.modifiers?.includes('split');
    const isMerge = abiFunc.modifiers?.includes('merge');

    if (isSplit) {
      if (!this.splitFundingConfig) {
        throw new Error(
          'Split functions require funding. Call .withSplitFunding(utxos, unlocker, changeAddress) before .send().',
        );
      }
      return this._buildSplitTransactionBuilder(abiFunc, this.maxFeeOverride);
    }
    if (isMerge) {
      if (!this.mergeConfig) {
        throw new Error(
          'Merge functions require consumed masters. Call .withConsumedMasters(utxos, changeAddress) before .send().',
        );
      }
      return this._buildMergeTransactionBuilder(abiFunc, this.maxFeeOverride);
    }

    return undefined;
  }

  // When `L.f()` is auto-wired but no library INSTANCE was registered, resolve it from the bundle: the artifact
  // comes from the registered ArtifactMap (registerArtifacts / ContractBundle) and the live category from the
  // indexer (the consumer baked the library address as its __libAddr_<name> ctor arg). Retires registerLibrary
  // for any bundle-deployed library. See docs/multi-contract-artifacts.md (Phase 3).
  private async _resolveLibrariesFromRegistry(): Promise<void> {
    if (!this.parentContract || !this.functionName) return;
    const consumer = this.parentContract;
    const abiFunc = this._selectedAbiFunction();
    const libCalls = abiFunc?.libraryDelegateCalls;
    if (!libCalls?.length) return;
    for (const lc of libCalls) {
      if (consumer._getLibrary(lc.library)) continue; // an explicit registerLibrary wins
      const libArtifact = consumer._getChild(lc.library);
      if (!libArtifact?.stateLayout) continue; // not in a registered bundle -> let auto-wire raise its error
      // The synthesized __libAddr_<name> ctor arg holds the deployed library's locking bytecode.
      const addrName = `__libAddr_${lc.library}`;
      const addrIdx = consumer.inner.artifact.constructorInputs.findIndex((i) => i.name === addrName);
      if (addrIdx < 0) continue;
      const baked = consumer.inner.constructorArgs[addrIdx];
      if (!(baked instanceof Uint8Array)) continue;
      // Reconstruct the library's constructor args (branded -> __brand = consumer category; else none) so the
      // rebuilt instance hashes to the same address; bail to the manual path on any other constructor shape.
      let libArgs: ConstructorArgument[];
      if (libArtifact.brandedLibrary) {
        if (!consumer.categoryId || libArtifact.constructorInputs.length !== 1) continue;
        libArgs = [StatefulContract.libraryBrand(consumer.categoryId)];
      } else if (libArtifact.constructorInputs.length === 0) {
        libArgs = [];
      } else {
        continue;
      }
      const libCat = await resolveCategoryFromLockingBytecode(consumer.inner.provider, baked);
      const libContract = new Contract(libArtifact, libArgs as never[], { provider: consumer.inner.provider });
      if (libContract.withCategory(hexToBin(libCat)).lockingBytecode !== binToHex(baked)) continue;
      consumer.registerLibrary(lc.library, StatefulContract.withCategory(libContract, libCat));
    }
  }

  // Auto-wire the delegatecall co-spend for each `L.f()` the called function performs (artifact
  // libraryDelegateCalls), from the consumer's registered library instances - so the caller need not repeat the
  // library function via withDelegatecall. A manual withDelegatecall for the same function takes precedence.
  private _autoWireLibraryDelegatecalls(): void {
    if (!this.parentContract || !this.functionName) return;
    autoWireLibraryDelegatecallsImpl({
      functionName: this.functionName,
      functionArgs: this.functionArgs,
      callInfos: this.callInfos as any,
      parentStateLayout: this.parentContract.inner.artifact.stateLayout,
      selectedAbiFunction: () => this._selectedAbiFunction() as any,
      getLibrary: (name: string) => this.parentContract!._getLibrary(name) as any,
    });
  }


  private _applyOverridesHost(): any {
    const self = this as any;
    return new Proxy(self, {
      get(target, prop, receiver) {
        if (prop === 'selectedAbiFunction') return () => target._selectedAbiFunction();
        if (prop === 'resolveLibrariesFromRegistry') return () => target._resolveLibrariesFromRegistry();
        if (prop === 'autoWireLibraryDelegatecalls') return () => target._autoWireLibraryDelegatecalls();
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  private async _applyOverrides(): Promise<StatefulTransactionBuilder> {
    return applyOverridesImpl(this._applyOverridesHost());
  }

  /**
   * Build a raw TransactionBuilder for a split function.
   * Transaction: [master, funding...] -> [master_preserved, new_minting_1..N, change]
   */
  private async _buildSplitTransactionBuilder(
    abiFunction: { inputs: readonly { name: string }[]; splitCountParam?: string },
    maxFeeOverride?: bigint,
  ): Promise<TransactionBuilder> {
    return buildSplitTransactionBuilderImpl(
      {
        functionName: this.functionName,
        functionArgs: this.functionArgs,
        parentContract: this.parentContract,
        splitFundingConfig: this.splitFundingConfig,
        mergeConfig: this.mergeConfig,
        computeFeeFromBuilder: (b) => computeFeeFromBuilder(b),
      },
      abiFunction,
      maxFeeOverride,
    );
  }

  /**
   * Build a raw TransactionBuilder for a merge function.
   * Transaction: [master_surviving, consumed_1..N, funding...] -> [master_preserved, change]
   */
  private async _buildMergeTransactionBuilder(
    abiFunction: { inputs: readonly { name: string }[]; mergeCountParam?: string },
    maxFeeOverride?: bigint,
  ): Promise<TransactionBuilder> {
    return buildMergeTransactionBuilderImpl(
      {
        functionName: this.functionName,
        functionArgs: this.functionArgs,
        parentContract: this.parentContract,
        splitFundingConfig: this.splitFundingConfig,
        mergeConfig: this.mergeConfig,
        computeFeeFromBuilder: (b) => computeFeeFromBuilder(b),
      },
      abiFunction,
      maxFeeOverride,
    );
  }

  /**
   * Re-apply user overrides to a rebuilt builder.
   * New builder already has auto-derived values; user overrides replace them.
   */
  private _reApplyOverrides(builder: StatefulTransactionBuilder): void {
    reApplyOverridesImpl(this._applyOverridesHost(), builder);
  }
}
