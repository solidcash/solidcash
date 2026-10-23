/**
 * phase-boundary extract: SC _createBuilder extract — one nested-compose callsite orchestration
 * under a delegate LLC (callee resolve → route plan → returns → shared-writer →
 * slots → publish → finish). Host keeps the for-loop and group-index bookkeeping.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
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
import {
  canonicalValueChunkProducerPathContext,
} from './ValueChunkProducerIdentity.js';
import { settlement } from './value-chunk-persist.js';

export type OrchestrateCreateBuilderNestedComposeCallsiteHost = {
  readonly categoryId: string;
  readonly sharedBlockOracleLocks: Set<string>;
  readonly inner: any;
  readonly signer: any;
  readonly logicalNonceSigner: any;
  readonly externalRegistry: Map<string, any>;
  resolveExternalArgs: (...args: any[]) => any;
  resolveExternalExpressionReturns: (...args: any[]) => Promise<any>;
  buildRepeatedExternalBatch: (...args: any[]) => any;
  replaceRepeatedExternalBatchRow: (...args: any[]) => any;
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
  preparedChildProducerPath: (...args: any[]) => any;
  selectProxyForwardInput: (...args: any[]) => any;
  resolvePreparedProducerEntry: (...args: any[]) => any;
  externalReturnsForCallsites: (...args: any[]) => any;
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
    preparedAtomicNodeByExternalGroup: Map<number, number>;
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
    preparedAtomicNodeByExternalGroup, latestPreparedAtomicNodeByPhysicalGroup,
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
  const preparedChildProducerPath = host.preparedChildProducerPath;
  const selectProxyForwardInput = host.selectProxyForwardInput;
  const resolvePreparedProducerEntry = host.resolvePreparedProducerEntry;
  const externalReturnsForCallsites = host.externalReturnsForCallsites;
  const externalCallReachedOccurrenceIndices = host.externalCallReachedOccurrenceIndices;
  const describeValueChunkWrites = host.describeValueChunkWrites;
  const concatBytes = host.concatBytes ?? ((...a: any[]) => a[0]);

  // Path-effect activation/settle-time ExecutionContext: registrations under this
  // nested-compose callsite inherit a distinct nestedScopeId until it returns.
  let pushedExecutionContextScope: number | undefined;
  try {
    const lifecycle = settlement().executionContexts;
    if (lifecycle.getPhase() !== 'settled') {
      pushedExecutionContextScope = lifecycle.pushNestedScope();
    }
  } catch {
    pushedExecutionContextScope = undefined;
  }
  const releaseExecutionContextScope = (): void => {
    if (pushedExecutionContextScope === undefined) return;
    try {
      const lifecycle = settlement().executionContexts;
      if (lifecycle.getPhase() !== 'settled'
        && lifecycle.currentNestedScope() === pushedExecutionContextScope) {
        lifecycle.popNestedScope();
      }
    } catch {
      // Session may already be settled or scope already popped.
    }
  };

  try {

    if (timingEnabled) console.error('nested-callsite-start', {
      callsiteId: nested.callsiteId, interfaceName: nested.interfaceName, functionName: nested.functionName,
    });
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
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
      resolvedTargetLockingBytecode,
      proxyCallee: resolvedProxyCallee,
      callee: resolvedCallee,
      resolvedRawFunctionName,
      nestedArgs,
      graphNestedArgs,
      needsExpressionReturns,
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
        buildRepeatedExternalBatch: (...a: any[]) => host.buildRepeatedExternalBatch(...a),
        resolveExternalArgs: (...a: any[]) => host.resolveExternalArgs(...a),
        externalReturnsForCallsites,
        selectProxyForwardInput,
        resolvePreparedProducerEntry,
        externalCallReachedOccurrenceIndices: (...a: any[]) => (
          externalCallReachedOccurrenceIndices as (...args: any[]) => readonly number[] | undefined
        )(...a) as number[] | undefined,
        planExternalCallOccurrences: (...a: any[]) => host.planExternalCallOccurrences(...a),
        nestedFullState,
        nestedMasterState,
        preparedChildProducerPath,
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
        publishedNestedExternalCalls,
        preparedAtomicNodes,
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
    const calleeRouteArtifact = plannedRoute.calleeRouteArtifact;
    const resolveGraphNestedReturns = plannedRoute.resolveGraphNestedReturns;
    const resolveGraphNestedArgs = plannedRoute.resolveGraphNestedArgs;
    const childCompilerRoute = plannedRoute.childCompilerRoute as ReturnType<
    any['_buildRepeatedExternalBatch']
    > | undefined;
    const replanChildRoute = plannedRoute.replanChildRoute as undefined | ((
      resolved: { externalReturns: ReadonlyMap<string, FunctionArgument> },
    ) => any);
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
    // A compiler route created by an earlier logical call owns the callee's one physical UTXO block
    // and executes every selector in its batch blob. Solidity lowering still publishes the individual
    // callsites (including mutually-exclusive SafeERC20 approve branches), so they arrive here too.
    // Represent those as shared logical groups only; planning their ordinary handler layouts again
    // would require a second master and, for an absent vmap key, invent a trailing insert slot that the
    // direct handler deliberately does not have.
    const logicalSelector = proxyTargetFn?.selector ?? selectedFn?.selector;
    const sharedCompilerRouteCoversCall = sharedGroupIndex >= 0
  && logicalSelector !== undefined
  && externalCallUtxoGroups[sharedGroupIndex].compilerRoute
    ?.logicalSelectors.includes(logicalSelector) === true;
    if (childCompilerRoute
  && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ROUTE === '1') {
      console.error('nested-route-visible-args', selectedFn?.inputs
        .filter((input) => !input.name.startsWith('__internal__'))
        .map((input, index) => ({
          name: input.name,
          value: childFunctionArgs[index] instanceof Uint8Array
            ? binToHex(childFunctionArgs[index] as Uint8Array)
            : String(childFunctionArgs[index]),
        })));
    }
    if (!proxyCallee && !sharedCompilerRouteCoversCall) {
      childWritesState ||= selectedFn?.writesState === true;
    }
    if (sharedCompilerRouteCoversCall) childWritesState = false;
    if (proxyCallee && delegateCallGroupIndex !== undefined
  && childWritesState && !childCompilerRoute) {
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
        childCompilerRoute,
        childWritesState,
        sharedCompilerRouteCoversCall,
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
    const routePlanningArgs = childCompilerRoute?.args
  ?? (proxyTargetFn ? nestedArgs : childFunctionArgs);
    let routeValueChunkProducerAliases: ExternalCallUtxoGroup[] = [];
    let routeValueChunkProducerPhysicalGroup: ExternalCallUtxoGroup | undefined;
    let routeValueChunkProducerEpoch: number | undefined;
    let latestRouteValueChunkProducerBinding: {
      claims: readonly any[];
      stateOwner: { categoryId: string; lockingBytecode: string };
      productions: NonNullable<any['valueChunkProductions']>;
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
    const valueChunkProductionsForPath = (
      producerPath: any | undefined,
    ): NonNullable<any['valueChunkProductions']> => {
      const producerPathKey = producerPath?.status === 'complete'
        ? canonicalValueChunkProducerPathContext(producerPath.context) : undefined;
      if (!producerPathKey) return [];
      return latestRouteValueChunkProducerBinding?.productions.filter(
        (production: any) => canonicalValueChunkProducerPathContext({
          version: 1, sourcePath: production.claim.producer.sourcePath,
        }) === producerPathKey,
      ) ?? [];
    };
    let refreshChunkableRouteWitnesses: ((
      rowArguments: readonly any[] | undefined,
      finalVisibleArgs: readonly FunctionArgument[],
      stagingSession?: any,
      resultUpdate?: { producerPath: any; results: ReadonlyMap<number, FunctionArgument> },
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
        sharedBlockOracleLocks: host.sharedBlockOracleLocks,
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
        childCompilerRoute,
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
        valueChunkProductionsForPath,
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
      childCompilerRoute,
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
      refreshChunkableRouteWitnesses,
      delegateCallerIdentity,
      externalCallUtxoGroups,
      lowLevelCallUtxoGroups,
    });
    {
      const finished = finishCreateBuilderNestedComposeImpl(
        {
          resolveExternalArgs: (...a: any[]) => host.resolveExternalArgs(...a),
          buildRepeatedExternalBatch: (...a: any[]) =>
            host.buildRepeatedExternalBatch(...a),
          replaceRepeatedExternalBatchRow: (...a: any[]) =>
            host.replaceRepeatedExternalBatchRow(...a),
          describeValueChunkWrites,
          preparedChildProducerPath,
        },
        {
          nested,
          selectedFn,
          sharedGroupIndex,
          delegateCallGroupIndex,
          childExternalGroupIndex,
          childCompilerRoute,
          childCompilerInternalArgs,
          childFunctionName,
          nestedArgs,
          nestedSources,
          needsExpressionReturns,
          directInvocationRows,
          replanChildRoute,
          resolveGraphNestedReturns,
          resolveGraphNestedArgs,
          graphNestedArgs,
          delegateVisibleArgs,
          delegateVisibleInputs,
          callInfoContract: callInfo.contract,
          onChainState,
          publishedNestedExternalCalls,
          proxyCallee,
          callee,
          refreshChunkableRouteWitnesses,
          valueChunkProductionsForPath,
          publishRouteValueChunkProducerBinding,
          latestRouteValueChunkProducerBinding,
          routeValueChunkProducerEpochByPhysicalGroup,
          preparedAtomicNodes,
          preparedAtomicNodeByExternalGroup,
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
          delegateSelfAddress,
          resolvedTargetLockingBytecode,
          resolvedRawFunctionName,
          producerSelector,
          delegateFn,
          calleeRouteArtifact,
          delegateCallerIdentity,
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
  } finally {
    releaseExecutionContextScope();
  }
}
