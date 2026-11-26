
import type { AbiFunction, ExternalCallAbi } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { SortedList } from './SortedList.js';
import {
  resolveCreateBuilderNestedComposeCallee as resolveCreateBuilderNestedComposeCalleeImpl,
} from './sc-resolve-create-builder-nested-compose-callee.js';
import {
  planCreateBuilderNestedComposeRoute as planCreateBuilderNestedComposeRouteImpl,
} from './sc-plan-create-builder-nested-compose-route.js';
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
  routeValueChunkProducerAliases: any;
  routeValueChunkProducerPhysicalGroup: any;
  routeValueChunkProducerEpoch: any;
  latestRouteValueChunkProducerBinding: any;
  refreshChunkableRouteWitnesses: any;
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
    graphPlanningResults: any;
    callInfo: any;
    onChainState: any;
    preparedAtomicNodes: any[] | undefined;
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
    routeValueChunkProducerEpochByPhysicalGroup: WeakMap<any, number>;
    latestPreparedAtomicNodeByPhysicalGroup: Map<number, number>;
    nestedSortedListCache: Map<string, any>;
    valueChunkWriteStagingSession: any;
    sharedFunderPool: UnlockableUtxo[] | undefined;
    [key: string]: any;
  },
): Promise<OrchestrateCreateBuilderNestedComposeCallsiteResult> {
  const {
    nested, delegateGroupIndex, delegateFn, publishedNestedExternalCalls,
    delegateVisibleArgs, delegateVisibleInputs, delegateSelfAddress,
    delegateCallerIdentity, graphPlanningResults, callInfo, onChainState,
    preparedAtomicNodes, rootProducerPath, externalCallUtxoGroups,
    lowLevelCallUtxoGroups, groupProxyMasterIndices, nestedDelegateProxyGroupByLowLevel,
    timingEnabled, functionName, routeValueChunkProducerEpochByPhysicalGroup,
    latestPreparedAtomicNodeByPhysicalGroup,
    nestedSortedListCache, valueChunkWriteStagingSession,
    publicSelfAddress, nestedProxyReadCache, memoizeGraphPlanningProducerResult,
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
      preparedAtomicNodes,
      graphPlanningResults,
    },
  );
  if (nestedCalleeResolved.skip) {
    return {
      skipped: true,
      allGroupEcSlots,
      allGroupParentIndices,
      routeValueChunkProducerAliases: params.routeValueChunkProducerAliases,
      routeValueChunkProducerPhysicalGroup: params.routeValueChunkProducerPhysicalGroup,
      routeValueChunkProducerEpoch: params.routeValueChunkProducerEpoch,
      latestRouteValueChunkProducerBinding: params.latestRouteValueChunkProducerBinding,
      refreshChunkableRouteWitnesses: params.refreshChunkableRouteWitnesses,
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
    graphNestedArgs,
    graphExpressionReturns,
  } = nestedCalleeResolved;
  const proxyCallee = resolvedProxyCallee as undefined | {
    proxy: any;
    implementation: any;
    forward: (name: string, args: FunctionArgument[]) => any;
  };
  const callee = resolvedCallee as any;
  const plannedRoute = await planCreateBuilderNestedComposeRouteImpl(
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
      graphNestedArgs,
      graphExpressionReturns,
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
  let childState = plannedRoute.childState;
  const childLayout = plannedRoute.childLayout;
  const childRequired = plannedRoute.childRequired;
  const childData = plannedRoute.childData;
  const childExternalGroupIndex = plannedRoute.childExternalGroupIndex;
  const childFunctionName = plannedRoute.childFunctionName;
  const childFunctionArgs = plannedRoute.childFunctionArgs;
  const delegateCallGroupIndex = plannedRoute.delegateCallGroupIndex;
  const sharedPriorDelegateFunctionName = plannedRoute.sharedPriorDelegateFunctionName;
  const sharedPriorDelegateFunctionArgs = plannedRoute.sharedPriorDelegateFunctionArgs;
  let childWritesState = plannedRoute.childWritesState;
  const proxyImplementationState = plannedRoute.proxyImplementationState;
  const sharedGroupIndex = plannedRoute.sharedGroupIndex;
  const proxyTargetFn = plannedRoute.proxyTargetFn;
  let selectedFn = plannedRoute.selectedFn as AbiFunction | undefined;
  const producerSelector = plannedRoute.producerSelector;
  const directInvocationRows = plannedRoute.directInvocationRows;
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
      memoizeGraphPlanningProducerResult,
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
      graphPlanningResults,
      publicSelfAddress,
      childFunctionName,
      childFunctionArgs,
      callInfoContract: callInfo.contract,
      onChainState,
      delegateSelfAddress,
      nestedProxyReadCache,
    },
  );
  let precomputedReturnCommitment = precomputedReturns.precomputedReturnCommitment;
  const loopReturnCommitments = precomputedReturns.loopReturnCommitments;
  const resolveLoopReturnCommitment = precomputedReturns.resolveLoopReturnCommitment;
  const resolveLoopReturnValue = precomputedReturns.resolveLoopReturnValue;
  const resolveLoopFunctionArgs = precomputedReturns.resolveLoopFunctionArgs;
  const {
    sharedLogicalArtifact,
    preserveFirstConditionalWriter,
    sharedPriorFunctionName,
    sharedPriorFunctionArgs,
    sharedPriorAtomicNode: sharedPriorAtomicNodeRaw,
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
    latestPreparedAtomicNodeByPhysicalGroup,
    preparedAtomicNodes,
  });
  const sharedPriorAtomicNode = sharedPriorAtomicNodeRaw as any | undefined;
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
  let routeValueChunkProducerAliases: ExternalCallUtxoGroup[] = [];
  let routeValueChunkProducerPhysicalGroup: ExternalCallUtxoGroup | undefined;
  let routeValueChunkProducerEpoch: number | undefined;
  let latestRouteValueChunkProducerBinding: {
    claims: readonly any[];
    stateOwner: { categoryId: string; lockingBytecode: string };
  } | undefined;
  const publishRouteValueChunkProducerBinding = (
    binding: typeof latestRouteValueChunkProducerBinding,
  ): void => {
    latestRouteValueChunkProducerBinding = binding;
    if (routeValueChunkProducerPhysicalGroup && routeValueChunkProducerEpoch !== undefined
  && routeValueChunkProducerEpochByPhysicalGroup.get(
    routeValueChunkProducerPhysicalGroup,
  ) !== routeValueChunkProducerEpoch) return;
    for (const alias of routeValueChunkProducerAliases) {
      alias.valueChunkProducerClaims = binding?.claims;
      alias.valueChunkStateOwner = binding?.stateOwner;
    }
  };
  let refreshChunkableRouteWitnesses: ((
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
        routeValueChunkProducerAliases,
        routeValueChunkProducerPhysicalGroup,
        routeValueChunkProducerEpoch,
        refreshChunkableRouteWitnesses,
      },
      publishRouteValueChunkProducerBinding,
      nestedSortedListCache,
      nestedAddressUtxos,
      delegateCallerIdentity,
      sharedPriorAtomicNode,
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
  routeValueChunkProducerAliases = assembledSlots.bags.routeValueChunkProducerAliases;
  routeValueChunkProducerPhysicalGroup = assembledSlots.bags.routeValueChunkProducerPhysicalGroup;
  routeValueChunkProducerEpoch = assembledSlots.bags.routeValueChunkProducerEpoch;
  // Slot assembly publishes through the callback above. That closure owns the latest binding;
  // copying a pre-assembly bag snapshot back here would discard the freshly derived productions.
  refreshChunkableRouteWitnesses = assembledSlots.bags.refreshChunkableRouteWitnesses;
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
    precomputedReturnCommitment,
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
        graphNestedArgs,
        proxyCallee,
        callee,
        publishRouteValueChunkProducerBinding,
        latestRouteValueChunkProducerBinding,
        routeValueChunkProducerEpochByPhysicalGroup,
        preparedAtomicNodes,
        latestPreparedAtomicNodeByPhysicalGroup,
        externalCallUtxoGroups,
        lowLevelCallUtxoGroups,
        delegateGroupIndex,
        timingEnabled,
        bags: {
          routeValueChunkProducerAliases,
          routeValueChunkProducerPhysicalGroup,
          routeValueChunkProducerEpoch,
          allGroupEcSlots,
          allGroupParentIndices,
        },
        resolvedRawFunctionName,
        producerSelector,
      },
    );
    routeValueChunkProducerAliases = finished.routeValueChunkProducerAliases;
    routeValueChunkProducerPhysicalGroup = finished.routeValueChunkProducerPhysicalGroup;
    routeValueChunkProducerEpoch = finished.routeValueChunkProducerEpoch;
    allGroupEcSlots = finished.allGroupEcSlots;
    allGroupParentIndices = finished.allGroupParentIndices;
  }
  return {
    skipped: false,
    allGroupEcSlots,
    allGroupParentIndices,
    routeValueChunkProducerAliases,
    routeValueChunkProducerPhysicalGroup,
    routeValueChunkProducerEpoch,
    latestRouteValueChunkProducerBinding,
    refreshChunkableRouteWitnesses,
    nestedIndices,
    nestedByCallsite,
  };
}
