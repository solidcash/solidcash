
import type { AbiFunction, ExternalCallAbi } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { SortedList } from './SortedList.js';
import {
  resolveCreateBuilderNestedComposeCallee as resolveCreateBuilderNestedComposeCalleeImpl,
} from './sc-resolve-create-builder-nested-compose-callee.js';
import {
  planCreateBuilderNestedComposeCall as planCreateBuilderNestedComposeCallImpl,
} from './sc-plan-create-builder-nested-compose-call.js';
import {
  precomputeCreateBuilderNestedComposeReturns as precomputeCreateBuilderNestedComposeReturnsImpl,
} from './sc-precompute-create-builder-nested-compose-returns.js';
import {
  prepareCreateBuilderNestedComposeSharedWriter as prepareCreateBuilderNestedComposeSharedWriterImpl,
} from './sc-prepare-create-builder-nested-compose-layout.js';
import {
  assembleCreateBuilderNestedComposeSlots as assembleCreateBuilderNestedComposeSlotsImpl,
} from './sc-assemble-create-builder-nested-compose-slots.js';
import {
  publishCreateBuilderNestedComposeGroup as publishCreateBuilderNestedComposeGroupImpl,
} from './sc-publish-create-builder-nested-compose-group.js';
import {
  finishCreateBuilderNestedCompose as finishCreateBuilderNestedComposeImpl,
} from './sc-finish-create-builder-nested-compose.js';

export type OrchestrateCreateBuilderNestedComposeCallsiteHost = {
  readonly categoryId: string;
  readonly sharedBlockOraclePools: Set<string>;
  readonly inner: any;
  readonly signer: any;
  readonly logicalNonceSigner: any;
  readonly externalRegistry: Map<string, any>;
  resolveExternalArgs: (...args: any[]) => any;
  resolveExternalExpressionReturns: (...args: any[]) => Promise<any>;
  encodeStoredElementSource: (...args: any[]) => any;
  encodeStoredValueSource: (...args: any[]) => any;
  nestedIdentity: (address: string) => Promise<any>;
  nestedFullState: (contract: any) => Promise<any>;
  nestedMasterState: (contract: any) => Promise<any>;
  nestedAddressUtxos: (address: string) => Promise<any>;
  markSharedFunder: (utxo: UnlockableUtxo) => void;
  shiftSharedFunder: () => UnlockableUtxo | undefined;
  nextNestedFunderIndex: () => number;
  describeValueChunkWrites: (...args: any[]) => any;
  selectProxyForwardInput: (...args: any[]) => any;
  resolvePreparedProducerEntry: (...args: any[]) => any;
  externalCallReachedOccurrenceIndices: (...args: any[]) => any;
  planExternalCallOccurrences: (...args: any[]) => Promise<any>;
  [key: string]: any;
};

export type OrchestrateCreateBuilderNestedComposeCallsiteResult = {
  skipped: boolean;
  allGroupEcSlots: any[];
  allGroupParentIndices: any[];
  childValueChunkProducerAliases: any;
  childValueChunkProducerPhysicalGroup: any;
  childValueChunkProducerEpoch: any;
  latestChildValueChunkProducerBinding: any;
  refreshChunkableChildWitnesses: any;
  nestedIndices: number[];
  nestedByCallsite: Map<number, number>;
};

/**
 * Run one nested external callsite through the nested-compose Impl chain.
 * Mutates externalCallUtxoGroups / lowLevelCallUtxoGroups via those Impls.
 */
export async function orchestrateCreateBuilderNestedComposeCallsite(
  host: OrchestrateCreateBuilderNestedComposeCallsiteHost,
  params: {
    nested: ExternalCallAbi;
    delegateGroupIndex: number;
    delegateFn: AbiFunction | undefined;
    nestedExternalCalls: ExternalCallAbi[];
    publishedNestedExternalCalls: ExternalCallAbi[];
    delegateVisibleArgs: FunctionArgument[];
    delegateVisibleInputs: readonly { name: string }[];
    delegateSelfAddress: Uint8Array;
    delegateCallerIdentity: { categoryId: string; lockingBytecode: string };
    callPlanningResults: any;
    callInfo: any;
    onChainState: any;
    preparedCallNodes: any[] | undefined;
    rootProducerPath: any;
    nestedIndices: number[];
    nestedByCallsite: Map<number, number>;
    externalCallUtxoGroups: ExternalCallUtxoGroup[];
    lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
    groupProxyMasterIndices: number[];
    nestedDelegateProxyGroupByLowLevel: Map<number, number>;
    timingEnabled: boolean;
    functionName: string;
    allGroupEcSlots: any[];
    allGroupParentIndices: any[];
    valueChunkProducerEpochByPhysicalGroup: WeakMap<any, number>;
    preparedCallNodeByExternalGroup: Map<number, number>;
    latestPreparedCallNodeByPhysicalGroup: Map<number, number>;
    nestedSortedListCache: Map<string, any>;
    valueChunkWriteStagingSession: any;
    sharedFunderPool: UnlockableUtxo[] | undefined;
    [key: string]: any;
  },
): Promise<OrchestrateCreateBuilderNestedComposeCallsiteResult> {
  const {
    nested, delegateGroupIndex, delegateFn, publishedNestedExternalCalls,
    delegateVisibleArgs, delegateVisibleInputs, delegateSelfAddress,
    delegateCallerIdentity, callPlanningResults, callInfo, onChainState,
    preparedCallNodes, rootProducerPath, externalCallUtxoGroups,
    lowLevelCallUtxoGroups, groupProxyMasterIndices, nestedDelegateProxyGroupByLowLevel,
    timingEnabled, functionName, valueChunkProducerEpochByPhysicalGroup,
    preparedCallNodeByExternalGroup, latestPreparedCallNodeByPhysicalGroup,
    nestedSortedListCache, valueChunkWriteStagingSession,
    publicSelfAddress, nestedProxyReadCache,
  } = params;
  let nestedIndices = params.nestedIndices;
  let nestedByCallsite = params.nestedByCallsite;
  let allGroupEcSlots = params.allGroupEcSlots;
  let allGroupParentIndices = params.allGroupParentIndices;
  const nestedIdentity = host.nestedIdentity;
  const nestedFullState = host.nestedFullState;
  const nestedMasterState = host.nestedMasterState;
  const nestedAddressUtxos = host.nestedAddressUtxos;
  const selectProxyForwardInput = host.selectProxyForwardInput;
  const resolvePreparedProducerEntry = host.resolvePreparedProducerEntry;
  const externalCallReachedOccurrenceIndices = host.externalCallReachedOccurrenceIndices;
  const describeValueChunkWrites = host.describeValueChunkWrites;
  const concatBytes = host.concatBytes ?? ((...a: any[]) => a[0]);

  if (timingEnabled) console.error('nested-callsite-start', {
    callsiteId: nested.callsiteId, interfaceName: nested.interfaceName, functionName: nested.functionName,
  });
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_TRACE_CONCISE === '1') {
    console.error('nested-compose-start', {
      delegateGroupIndex, interfaceName: nested.interfaceName,
      functionName: nested.functionName, callsiteId: nested.callsiteId,
    });
  }
  const nestedCalleeResolved = await resolveCreateBuilderNestedComposeCalleeImpl(
    {
      resolveExternalArgs: (...a: any[]) => host.resolveExternalArgs(...a),
      resolveExternalExpressionReturns: (...a: any[]) => host.resolveExternalExpressionReturns(...a),
      nestedIdentity,
      callerRegistryValues: () => host.externalRegistry.values(),
      callerRegistryGet: (interfaceName: string) => host.externalRegistry.get(interfaceName),
      calleeRegistryValues: (contract) => contract._externalRegistry.values(),
      calleeRegistryGet: (contract, interfaceName) => contract._externalRegistry.get(interfaceName),
      provider: host.inner.provider,
    },
    {
      nested,
      delegateVisibleArgs,
      delegateVisibleInputs,
      delegateFn,
      callInfoContract: callInfo.contract as any,
      onChainState,
      delegateSelfAddress,
      publishedNestedExternalCalls,
      preparedCallNodes,
      callPlanningResults,
    },
  );
  if (nestedCalleeResolved.skip) {
    return {
      skipped: true,
      allGroupEcSlots,
      allGroupParentIndices,
      childValueChunkProducerAliases: params.childValueChunkProducerAliases,
      childValueChunkProducerPhysicalGroup: params.childValueChunkProducerPhysicalGroup,
      childValueChunkProducerEpoch: params.childValueChunkProducerEpoch,
      latestChildValueChunkProducerBinding: params.latestChildValueChunkProducerBinding,
      refreshChunkableChildWitnesses: params.refreshChunkableChildWitnesses,
      nestedIndices,
      nestedByCallsite,
    };
  }
  const {
    nestedSources,
    proxyCallee: resolvedProxyCallee,
    callee: resolvedCallee,
    resolvedRawFunctionName,
    nestedArgs,
    callTreeNestedArgs,
    callTreeExpressionReturns,
  } = nestedCalleeResolved;
  const proxyCallee = resolvedProxyCallee as undefined | {
    proxy: any;
    implementation: any;
    forward: (name: string, args: FunctionArgument[]) => any;
  };
  const callee = resolvedCallee as any;
  const plannedCall = await planCreateBuilderNestedComposeCallImpl(
    {
      resolveExternalArgs: (...a: any[]) => host.resolveExternalArgs(...a),
      selectProxyForwardInput,
      resolvePreparedProducerEntry,
      externalCallReachedOccurrenceIndices: (...a: any[]) => (
        externalCallReachedOccurrenceIndices as (...args: any[]) => readonly number[] | undefined
      )(...a) as number[] | undefined,
      planExternalCallOccurrences: (...a: any[]) => host.planExternalCallOccurrences(...a),
      nestedFullState,
      nestedMasterState,
      timingEnabled,
    },
    {
      nested,
      nestedSources,
      delegateVisibleArgs,
      delegateVisibleInputs,
      delegateFn,
      onChainState,
      delegateSelfAddress,
      proxyCallee,
      callee,
      nestedArgs,
      callTreeNestedArgs,
      callTreeExpressionReturns,
      resolvedRawFunctionName,
      delegateCallerIdentity,
      rootProducerPath,
      nestedIndices,
      nestedByCallsite,
      externalCallUtxoGroups,
      lowLevelCallUtxoGroups,
      groupProxyMasterIndices,
      nestedDelegateProxyGroupByLowLevel,
      callInfoContract: callInfo.contract,
    },
  );
  let childState = plannedCall.childState;
  const childLayout = plannedCall.childLayout;
  const childRequired = plannedCall.childRequired;
  const childData = plannedCall.childData;
  const childExternalGroupIndex = plannedCall.childExternalGroupIndex;
  const childFunctionName = plannedCall.childFunctionName;
  const childFunctionArgs = plannedCall.childFunctionArgs;
  const delegateCallGroupIndex = plannedCall.delegateCallGroupIndex;
  const sharedPriorDelegateFunctionName = plannedCall.sharedPriorDelegateFunctionName;
  const sharedPriorDelegateFunctionArgs = plannedCall.sharedPriorDelegateFunctionArgs;
  let childWritesState = plannedCall.childWritesState;
  const proxyImplementationState = plannedCall.proxyImplementationState;
  const sharedGroupIndex = plannedCall.sharedGroupIndex;
  const proxyTargetFn = plannedCall.proxyTargetFn;
  let selectedFn = plannedCall.selectedFn as AbiFunction | undefined;
  const producerSelector = plannedCall.producerSelector;
  const directInvocationRows = plannedCall.directInvocationRows;
  const logicalSelector = proxyTargetFn?.selector ?? selectedFn?.selector;
  if (!proxyCallee) {
    childWritesState ||= selectedFn?.writesState === true;
  }
  if (proxyCallee && delegateCallGroupIndex !== undefined
&& childWritesState) {
    const primaryDelegate = lowLevelCallUtxoGroups[delegateCallGroupIndex];
    primaryDelegate.functionName = nested.functionName;
    primaryDelegate.functionArgs = nestedArgs;
  }
  const precomputedReturns = await precomputeCreateBuilderNestedComposeReturnsImpl(
    {
      categoryId: host.categoryId,
      concatBytes: (...a: any[]) => concatBytes(...a),
      deriveReturnValue: (...a: any[]) => (callee as any)._deriveReturnValue(...a),
      resolveExternalArgs: (...a: any[]) => host.resolveExternalArgs(...a),
    },
    {
      nested,
      proxyCallee,
      callee,
      selectedFn,
      proxyTargetFn,
      nestedArgs,
      nestedSources,
      delegateVisibleArgs,
      delegateVisibleInputs,
      childWritesState,
      callPlanningResults,
      publicSelfAddress,
      childFunctionName,
      childFunctionArgs,
      callInfoContract: callInfo.contract,
      onChainState,
      delegateSelfAddress,
      nestedProxyReadCache,
    },
  );
  const loopReturnCommitments = precomputedReturns.loopReturnCommitments;
  const resolveLoopReturnCommitment = precomputedReturns.resolveLoopReturnCommitment;
  const resolveLoopReturnValue = precomputedReturns.resolveLoopReturnValue;
  const resolveLoopFunctionArgs = precomputedReturns.resolveLoopFunctionArgs;
  const {
    sharedLogicalArtifact,
    preserveFirstConditionalWriter,
    sharedPriorFunctionName,
    sharedPriorFunctionArgs,
    sharedPriorCallNode: sharedPriorCallNodeRaw,
  } = prepareCreateBuilderNestedComposeSharedWriterImpl({
    nested,
    proxyCallee,
    callee,
    sharedGroupIndex,
    childWritesState,
    logicalSelector,
    childFunctionName,
    childFunctionArgs,
    resolvedRawFunctionName,
    externalCallUtxoGroups,
    latestPreparedCallNodeByPhysicalGroup,
    preparedCallNodes,
  });
  const sharedPriorCallNode = sharedPriorCallNodeRaw as any | undefined;
  let childBlockInputs: UnlockableUtxo[] | undefined;
  const childCompilerInternalArgs: Record<string, FunctionArgument> = {};
  /** Rebuilt chunk payloads for the callee's chunkable vmap values, by route entry slot. */
  const childValueWitnesses = new Map<number, Uint8Array>();
  /** Full current values for chunkable route entries, including inline values. */
  const childStoredValues = new Map<number, Uint8Array>();
  let childValueChunkSlots = 0;
  const childBatchTargets = new Map<number, Uint8Array>();
  const childBatchLists = new Map<string, SortedList>();
  const childBatchPredecessorOutputs: Array<{
    outputBlockSlot: number; lockingBytecode: Uint8Array; commitment: string;
  }> = [];
  const childDynamicChunkResources: Array<{
    blockSlot: number; name: string; type: string; write: boolean;
  }> = [];
  // Active batch targets can share one predecessor proof. Only one physical input may spend that
  // proof; later target slots are funder-balanced but still mint distinct collection outputs.
  const childBatchEntryLockingBytecodes = new Map<number, Uint8Array>();
  // Post-state entry commitments keyed by block offset (same key space as locking bytecodes).
  const childBatchEntryCommitments = new Map<number, string>();
  const childPlannedEntryInserts: Array<{
    blockSlot: number; outputBlockSlot: number;
    commitment?: string; newCommitment?: string;
  }> = [];
  const selectedLayout = selectedFn?.blockLayout;
  const routePlanningArgs = proxyTargetFn ? nestedArgs : childFunctionArgs;
  let childValueChunkProducerAliases: ExternalCallUtxoGroup[] = [];
  let childValueChunkProducerPhysicalGroup: ExternalCallUtxoGroup | undefined;
  let childValueChunkProducerEpoch: number | undefined;
  let latestChildValueChunkProducerBinding: {
    claims: readonly any[];
    stateOwner: { categoryId: string; lockingBytecode: string };
  } | undefined;
  const publishChildValueChunkProducerBinding = (
    binding: typeof latestChildValueChunkProducerBinding,
  ): void => {
    latestChildValueChunkProducerBinding = binding;
    if (childValueChunkProducerPhysicalGroup && childValueChunkProducerEpoch !== undefined
  && valueChunkProducerEpochByPhysicalGroup.get(
    childValueChunkProducerPhysicalGroup,
  ) !== childValueChunkProducerEpoch) return;
    for (const alias of childValueChunkProducerAliases) {
      alias.valueChunkProducerClaims = binding?.claims;
      alias.valueChunkStateOwner = binding?.stateOwner;
    }
  };
  let refreshChunkableChildWitnesses: ((
    rowArguments: readonly any[] | undefined,
    finalVisibleArgs: readonly FunctionArgument[],
    stagingSession?: any,
  ) => { internalArgs: Record<string, FunctionArgument>; payloadBytes: number }) | undefined;
  if (timingEnabled) console.error('nested-callsite-layout', {
    callsiteId: nested.callsiteId, sharedGroupIndex, childWritesState,
    selected: selectedFn?.name, blockSize: selectedLayout?.blockSize,
    slots: selectedLayout?.slots.length, trailingBase: selectedLayout?.trailingBase,
    trailingCapacity: selectedLayout?.trailingCapacity,
  });
  const assembledSlots = await assembleCreateBuilderNestedComposeSlotsImpl(
    {
      inner: host.inner,
      sharedBlockOraclePools: host.sharedBlockOraclePools,
      signer: host.signer,
      logicalNonceSigner: host.logicalNonceSigner,
      encodeStoredElementSource: (...a: any[]) => host.encodeStoredElementSource(...a),
      encodeStoredValueSource: (...a: any[]) => host.encodeStoredValueSource(...a),
      shiftSharedFunder: () => host.shiftSharedFunder(),
      markSharedFunder: (utxo: UnlockableUtxo) => host.markSharedFunder(utxo),
      nextNestedFunderIndex: () => host.nextNestedFunderIndex(),
      describeValueChunkWrites,
    },
    {
      nested,
      selectedFn,
      selectedLayout,
      sharedGroupIndex,
      childWritesState,
      preserveFirstConditionalWriter,
      proxyCallee,
      callee,
      childState,
      childData,
      childRequired,
      childLayout,
      childFunctionName,
      childFunctionArgs,
      nestedArgs,
      routePlanningArgs,
      proxyImplementationState,
      delegateCallGroupIndex,
      childExternalGroupIndex,
      externalCallUtxoGroups,
      lowLevelCallUtxoGroups,
      timingEnabled,
      bags: {
        childBlockInputs,
        childCompilerInternalArgs,
        childValueWitnesses,
        childStoredValues,
        childValueChunkSlots,
        childBatchTargets,
        childBatchLists,
        childBatchPredecessorOutputs,
        childDynamicChunkResources,
        childBatchEntryLockingBytecodes,
        childBatchEntryCommitments,
        childPlannedEntryInserts,
        childValueChunkProducerAliases,
        childValueChunkProducerPhysicalGroup,
        childValueChunkProducerEpoch,
        refreshChunkableChildWitnesses,
      },
      publishChildValueChunkProducerBinding,
      nestedSortedListCache,
      nestedAddressUtxos,
      delegateCallerIdentity,
      sharedPriorCallNode,
      sharedPriorFunctionName,
      sharedPriorFunctionArgs,
      sharedPriorDelegateFunctionName,
      sharedPriorDelegateFunctionArgs,
      sharedLogicalArtifact,
      directInvocationRows,
      valueChunkWriteStagingSession,
      functionName,
    },
  );
  childBlockInputs = assembledSlots.bags.childBlockInputs;
  childValueChunkSlots = assembledSlots.bags.childValueChunkSlots;
  childValueChunkProducerAliases = assembledSlots.bags.childValueChunkProducerAliases;
  childValueChunkProducerPhysicalGroup = assembledSlots.bags.childValueChunkProducerPhysicalGroup;
  childValueChunkProducerEpoch = assembledSlots.bags.childValueChunkProducerEpoch;
  // Slot assembly publishes through the callback above. That closure owns the latest binding;
  // copying a pre-assembly bag snapshot back here would discard the freshly derived productions.
  refreshChunkableChildWitnesses = assembledSlots.bags.refreshChunkableChildWitnesses;
  const childRelativeOutputInternalArgs = assembledSlots.childRelativeOutputInternalArgs;
  publishCreateBuilderNestedComposeGroupImpl({
    nested,
    proxyCallee,
    callee,
    childLayout,
    childState,
    childData,
    childRequired,
    childFunctionName,
    childFunctionArgs,
    nestedArgs,
    resolvedRawFunctionName,
    childCompilerInternalArgs,
    childValueWitnesses,
    childRelativeOutputInternalArgs,
    childBlockInputs,
    childPlannedEntryInserts,
    childBatchPredecessorOutputs,
    childBatchEntryLockingBytecodes,
    childBatchEntryCommitments,
    childDynamicChunkResources,
    selectedLayout,
    sharedGroupIndex,
    delegateCallGroupIndex,
    childExternalGroupIndex,
    childValueChunkSlots,
    loopReturnCommitments,
    resolveLoopReturnCommitment,
    resolveLoopReturnValue,
    resolveLoopFunctionArgs,
    delegateCallerIdentity,
    externalCallUtxoGroups,
    lowLevelCallUtxoGroups,
  });
  // F1: the delegated implementation pins this call's edge, in its state owner's category.
  const published = externalCallUtxoGroups[childExternalGroupIndex];
  if (published !== undefined && delegateFn?.externalCalls?.includes(nested)) {
    published.edgeDelegateGroupIndex = delegateGroupIndex;
    published.edgeEcSlot = delegateFn.externalCalls.indexOf(nested);
  }
  {
    const finished = finishCreateBuilderNestedComposeImpl(
      {
        describeValueChunkWrites,
        preparedChildProducerPath: (...a: any[]) => (host.preparedChildProducerPath as any)(...a),
      },
      {
        nested,
        selectedFn,
        sharedGroupIndex,
        delegateCallGroupIndex,
        childExternalGroupIndex,
        childCompilerInternalArgs,
        childFunctionName,
        directInvocationRows,
        callTreeNestedArgs,
        proxyCallee,
        callee,
        publishChildValueChunkProducerBinding,
        latestChildValueChunkProducerBinding,
        valueChunkProducerEpochByPhysicalGroup,
        preparedCallNodes,
        preparedCallNodeByExternalGroup,
        latestPreparedCallNodeByPhysicalGroup,
        externalCallUtxoGroups,
        lowLevelCallUtxoGroups,
        delegateGroupIndex,
        timingEnabled,
        bags: {
          childValueChunkProducerAliases,
          childValueChunkProducerPhysicalGroup,
          childValueChunkProducerEpoch,
          allGroupEcSlots,
          allGroupParentIndices,
        },
        resolvedRawFunctionName,
        producerSelector,
      },
    );
    childValueChunkProducerAliases = finished.childValueChunkProducerAliases;
    childValueChunkProducerPhysicalGroup = finished.childValueChunkProducerPhysicalGroup;
    childValueChunkProducerEpoch = finished.childValueChunkProducerEpoch;
    allGroupEcSlots = finished.allGroupEcSlots;
    allGroupParentIndices = finished.allGroupParentIndices;
  }
  return {
    skipped: false,
    allGroupEcSlots,
    allGroupParentIndices,
    childValueChunkProducerAliases,
    childValueChunkProducerPhysicalGroup,
    childValueChunkProducerEpoch,
    latestChildValueChunkProducerBinding,
    refreshChunkableChildWitnesses,
    nestedIndices,
    nestedByCallsite,
  };
}
