/**
 * phase-boundary extract: SC _createBuilder extract — one LLC stateful iteration front:
 * load target state/data NFTs, push lowLevelCallUtxoGroups entry, and when
 * delegatecall prepare promotion + filtered nestedExternalCalls for compose.
 */

import { binToHex } from '@bitauth/libauth';
import type { AbiFunction, ExternalCallAbi } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo } from '../interfaces.js';
import { createDataNftUnlocker } from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { createGraphPlanningProducerResultContext } from './graph-planning-producer-result.js';
import {
  resolvePreparedKernelDelegateExecution,
  resolvePreparedKernelDelegateOwnerFrame,
} from './KernelDelegateForwarding.js';
import { hydrateExternalPredicateState } from './sc-hydrate-external-predicate-state.js';
import type { ValueChunkProducerPathDisposition } from './ValueChunkProducerIdentity.js';

export type MaterializeCreateBuilderLowLevelStatefulCallHost = {
  readonly categoryId: string;
  readonly inner: any;
  readonly selfContract: any;
  getMasterOnlyState: (contract: any) => Promise<any>;
  getFullState: (contract: any) => Promise<any>;
  getEntries: (name: string) => Promise<any>;
  statefulCall: (name: string) => FunctionArgument[] | undefined;
  resolveExternalExpressionReturns: (...args: any[]) => Promise<any>;
  evaluateExternalExpression: (...args: any[]) => any;
};

export type MaterializeCreateBuilderLowLevelStatefulCallResult = {
  delegateGroupIndex: number | undefined;
  delegateFn: AbiFunction | undefined;
  nestedExternalCalls: ExternalCallAbi[];
  publishedNestedExternalCalls: ExternalCallAbi[];
  delegateVisibleArgs: FunctionArgument[];
  delegateVisibleInputs: { name: string }[];
  delegateSelfAddress: Uint8Array;
  delegateCallerIdentity: { categoryId: string; lockingBytecode: string } | undefined;
  graphPlanningResults: ReturnType<typeof createGraphPlanningProducerResultContext>;
  preparedAtomicNodes: any[] | undefined;
  nestedIndices: number[];
  nestedByCallsite: Map<number, number>;
};

/** Preserve the selector-authenticated logical frame separately from the physical delegatecall payload. */
export function publishPreparedKernelDelegateOwnerFrame(
  group: Pick<ExternalCallUtxoGroup, 'logicalFunctionName' | 'logicalFunctionArgs'>,
  frame: { abiFunction: Pick<AbiFunction, 'name'>; args: readonly FunctionArgument[] },
): void {
  group.logicalFunctionName = frame.abiFunction.name;
  group.logicalFunctionArgs = [...frame.args];
}

/**
 * Materialize one stateful LLC into lowLevelCallUtxoGroups. For delegatecall,
 * optionally promote the kernel forwarding frame and filter active nested
 * external calls. Host continues with nested-compose for each nested call.
 */
export async function materializeCreateBuilderLowLevelStatefulCall(
  host: MaterializeCreateBuilderLowLevelStatefulCallHost,
  params: {
    callInfo: any;
    callMode: string;
    lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
    groupProxyMasterIndices: number[];
    abiFunction: AbiFunction | undefined;
    physicalAbiFunction: AbiFunction | undefined;
    functionName: string;
    args: readonly any[];
    callIndex: number;
    preparedAtomicNodes: any[] | undefined;
    rootProducerPath: ValueChunkProducerPathDisposition;
    publicSelfAddress: Uint8Array;
    authenticatedSelfAddress: Uint8Array;
    incomingCallerAddress?: Uint8Array;
    onChainState: any;
    [key: string]: any;
  },
): Promise<MaterializeCreateBuilderLowLevelStatefulCallResult> {
  const {
    callInfo, callMode, lowLevelCallUtxoGroups, groupProxyMasterIndices,
    abiFunction, physicalAbiFunction, functionName, args, callIndex,
    rootProducerPath, publicSelfAddress, authenticatedSelfAddress, onChainState,
    incomingCallerAddress,
  } = params;
  let preparedAtomicNodes = params.preparedAtomicNodes;

  const compilerDelegateRoute = callInfo.compilerRoute !== undefined;
  const bState = callInfo.contract.inner.artifact.delegateOnly || compilerDelegateRoute
    ? await host.getMasterOnlyState(callInfo.contract)
    : await host.getFullState(callInfo.contract);
  const bStateLayout = callInfo.contract.inner.stateLayout!;
  const bCategoryId = callInfo.contract.categoryId;

  if (!bState.masterUtxo) {
    throw new Error(
      `Low-level call target master UTXO not found (category ${bCategoryId})`,
    );
  }

  // Include all data NFTs
  const bRequiredNftIndices = callInfo.contract.inner.artifact.delegateOnly || compilerDelegateRoute
    ? []
    : Array.from({ length: bStateLayout.dataNftCount }, (_, idx) => idx);
  const bDataNfts: UnlockableUtxo[] = [];
  for (const nftIndex of bRequiredNftIndices) {
    const dataNftUtxo = bState.dataNftUtxos[nftIndex];
    if (!dataNftUtxo) {
      throw new Error(
        `Low-level call target data NFT at index ${nftIndex} not found (category ${bCategoryId})`,
      );
    }
    bDataNfts.push({
      ...dataNftUtxo,
      unlocker: createDataNftUnlocker(callInfo.contract.inner, 0, bCategoryId),
    });
  }

  lowLevelCallUtxoGroups.push({
    categoryId: bCategoryId,
    stateLayout: bStateLayout,
    masterUtxo: bState.masterUtxo,
    dataNftUtxos: bDataNfts,
    requiredDataNftIndices: bRequiredNftIndices,
    functionName: callInfo.compilerRoute?.abiFunction.name ?? callInfo.functionName,
    functionArgs: callInfo.compilerRoute?.args ?? callInfo.args,
    externalContract: callInfo.contract,
    callMode,
    ...(callInfo.compilerRoute && { compilerRoute: callInfo.compilerRoute }),
    ...((callInfo.compilerRoute?.abiFunction.blockLayout
    ?? (callInfo.contract.inner.artifact.abi as readonly AbiFunction[])
      .find((fn) => fn.name === callInfo.functionName)?.blockLayout)
    && {
      blockLayout: callInfo.compilerRoute?.abiFunction.blockLayout
        ?? (callInfo.contract.inner.artifact.abi as readonly AbiFunction[])
          .find((fn) => fn.name === callInfo.functionName)?.blockLayout,
    }),
  });
  groupProxyMasterIndices.push(callInfo.proxyMasterIndex ?? 0);

  if (callMode !== 'delegatecall') {
    return {
      delegateGroupIndex: undefined,
      delegateFn: undefined,
      nestedExternalCalls: [],
      publishedNestedExternalCalls: [],
      delegateVisibleArgs: [],
      delegateVisibleInputs: [],
      delegateSelfAddress: new Uint8Array(),
      delegateCallerIdentity: undefined,
      graphPlanningResults: createGraphPlanningProducerResultContext(),
      preparedAtomicNodes,
      nestedIndices: [],
      nestedByCallsite: new Map(),
    };
  }

  const delegateGroupIndex = lowLevelCallUtxoGroups.length - 1;
  const delegateAbi = callInfo.contract.inner.artifact.abi as readonly AbiFunction[];
  let delegateFn = callInfo.compilerRoute?.abiFunction
  ?? delegateAbi.find((f) => f.name === callInfo.functionName);
  let promotedDelegateOwnerFrame: ReturnType<
  typeof resolvePreparedKernelDelegateOwnerFrame
  > | undefined;
  const nestedIndices: number[] = [];
  const nestedByCallsite = new Map<number, number>();
  if (!preparedAtomicNodes && abiFunction) {
  // A compiler-published forwarding frame is the complete semantic criterion: one unconditional,
  // terminal delegatecall of an untouched bytes parameter to an address-committed target. Resolve
  // that payload back to the exact eligible implementation row. Generated-proxy and user-authored
  // forwarding functions therefore take the same path, independent of their source-level names.
    let promoted: ReturnType<typeof resolvePreparedKernelDelegateExecution>;
    try {
      promoted = resolvePreparedKernelDelegateExecution({
        proxyFunction: abiFunction,
        callIndex,
        proxyParameters: args,
        proxyConstructorArgs: host.inner.encodedConstructorArgs,
        proxyLockingBytecode: host.inner.lockingBytecode,
        stateCategory: host.categoryId,
        implementationArtifact: callInfo.contract.inner.artifact,
        implementationLockingBytecode: callInfo.contract.inner.lockingBytecode,
        requestedFunctionName: callInfo.functionName,
        requestedArgs: callInfo.args,
      });
    } catch (error) {
    // Promotion is optional. A stale, widened, or mismatched frame retains the ordinary direct
    // delegate transaction, whose proxy and implementation covenants remain authoritative.
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_FORWARD_ARGS === '1') {
        console.error('kernel-delegate-promotion-refused', {
          functionName, requestedFunctionName: callInfo.functionName,
          reason: error instanceof Error ? error.message : String(error),
          payload: args[physicalAbiFunction?.delegateForwarding?.payloadInput ?? -1]
          instanceof Uint8Array
            ? binToHex(args[physicalAbiFunction!.delegateForwarding!.payloadInput] as Uint8Array)
            : undefined,
        });
      }
    }
    if (promoted) {
      promotedDelegateOwnerFrame = resolvePreparedKernelDelegateOwnerFrame({
        execution: promoted,
        implementationAbi: delegateAbi,
      });
      publishPreparedKernelDelegateOwnerFrame(
        lowLevelCallUtxoGroups[delegateGroupIndex]!, promotedDelegateOwnerFrame,
      );
      delegateFn = promotedDelegateOwnerFrame.abiFunction;
      preparedAtomicNodes = [{
        contract: host.selfContract,
        functionName: promoted.functionName,
        selector: promoted.selector,
        args: promoted.args,
        executionArtifact: callInfo.contract.inner.artifact,
        executor: callInfo.contract,
        parent: null,
        producerPath: rootProducerPath,
        active: true,
      }];
    }
  }
  const publishedNestedExternalCalls: ExternalCallAbi[] = [...(delegateFn?.externalCalls ?? [])];
  // Nested argSources.paramIndex is the logical Solidity function's visible parameter
  // list (a dynamic-array argument can be third). A compiler-owned route stores [blob, ...witnesses]
  // on the LLC, so reading callInfo.args[3] is not the tags array.
  const delegateVisibleCount = (delegateFn?.inputs ?? []).filter(
    (input: any) => !input.name.startsWith('__internal__'),
  ).length;
  const delegateVisibleArgs = ((): FunctionArgument[] => {
    if (promotedDelegateOwnerFrame) return promotedDelegateOwnerFrame.args;
    const named = delegateFn?.name ? host.statefulCall(delegateFn.name) : undefined;
    const candidates: Array<FunctionArgument[] | undefined> = [
      functionName === delegateFn?.name ? args : undefined,
      named,
      callInfo.args,
      callInfo.compilerRoute?.args,
    ];
    for (const candidate of candidates) {
      if (candidate && candidate.length === delegateVisibleCount) return candidate;
    }
    const arrayIndex = publishedNestedExternalCalls
      .flatMap((nestedCall) => nestedCall.argSources ?? nestedCall.rawArgSources ?? [])
      .find((source) => source.kind === 'arrayElement')?.paramIndex;
    for (const candidate of candidates) {
      if (arrayIndex !== undefined && candidate && Array.isArray(candidate[arrayIndex])) {
        return candidate;
      }
    }
    return callInfo.args;
  })();
  const delegateVisibleInputs = (delegateFn?.inputs ?? []).filter(
    (input: any) => !input.name.startsWith('__internal__'),
  );
  // One compiler function owns one stable callsite namespace. Share producer work across its predicate,
  // argument, graph-seeding, and return-carrier passes for this build epoch.
  const graphPlanningResults = createGraphPlanningProducerResultContext();
  // The implementation input authenticates code execution, but Solidity-visible calls execute in the
  // proxy/state-owner context. New graph routes authenticate the same public CREATE identity for address(this)
  // and the outgoing caller. Older routes retain their physical self projection. Storage and executor identities
  // remain separately pinned by the delegate block.
  const delegateSelfAddress = callInfo.contract.inner.artifact.messageBus?.route.inputs.some(
    (input: { name: string }) => input.name === '__internal__graphSelfIdentityInput',
  ) ? authenticatedSelfAddress : publicSelfAddress;
  const delegateCallerIdentity = Object.freeze({
    categoryId: host.categoryId,
    // The outgoing caller is exactly the state-owner identity used for address(this). A legacy delegate
    // without a public-self witness uses the physical proxy; an authenticated CREATE route uses its SCID.
    lockingBytecode: binToHex(delegateSelfAddress),
  });
  const nestedExternalCalls: ExternalCallAbi[] = [];
  for (const nested of publishedNestedExternalCalls) {
    // A failed source require is a necessary-condition proof that no outgoing call was reached. Resolve
    // collection reads from the authenticated owner state before looking up the callee's resources. Unknown
    // predicates retain the call; only an exact false can omit it. Loops need per-iteration proof instead.
    if (nested.occurrence !== 'loop' && nested.preCallRequires?.length) {
      const guardState = await hydrateExternalPredicateState({
        evaluateExternalExpression: (...values: any[]) => host.evaluateExternalExpression(
          ...values, undefined, undefined, false, incomingCallerAddress,
        ),
        getEntries: host.getEntries,
      }, nested.preCallRequires, delegateVisibleArgs, callInfo.contract.inner.artifact,
      onChainState.state, delegateVisibleInputs, delegateSelfAddress);
      const rejected = nested.preCallRequires.some((guard) => host.evaluateExternalExpression(
        guard, delegateVisibleArgs, callInfo.contract.inner.artifact, guardState,
        delegateVisibleInputs, undefined, 0, false, delegateSelfAddress,
        undefined, undefined, false, incomingCallerAddress,
      ) === false);
      if (rejected) continue;
    }
    if (!nested.condition) {
    // Older artifacts and control-flow shapes not yet expressible by ExternalCallExpression retain
    // the existing covenant-driven occurrence handling. Never infer inactivity from a missing guard.
      nestedExternalCalls.push(nested);
      continue;
    }
    const conditionReturns = await host.resolveExternalExpressionReturns(
      [{ kind: 'expression', expression: nested.condition }],
      delegateVisibleArgs,
      callInfo.contract,
      onChainState.state,
      delegateVisibleInputs,
      delegateSelfAddress,
      publishedNestedExternalCalls,
      false,
      graphPlanningResults,
      {
        callsiteId: nested.callsiteId,
        resultConsumers: delegateFn?.resultConsumers,
        lane: 'condition',
      },
    );
    const active = host.evaluateExternalExpression(
      nested.condition,
      delegateVisibleArgs,
      callInfo.contract.inner.artifact,
      onChainState.state,
      delegateVisibleInputs,
      conditionReturns,
      0,
      false,
      delegateSelfAddress,
    );
    if (typeof active !== 'boolean') {
      throw new Error(
        'Could not resolve runtime predicate for conditional external call '
      + `${nested.interfaceName}.${nested.functionName} at callsite ${nested.callsiteId ?? 'unknown'}.`,
      );
    }
    if (active) nestedExternalCalls.push(nested);
  }
  return {
    delegateGroupIndex,
    delegateFn,
    nestedExternalCalls,
    publishedNestedExternalCalls,
    delegateVisibleArgs,
    delegateVisibleInputs,
    delegateSelfAddress,
    delegateCallerIdentity,
    graphPlanningResults,
    preparedAtomicNodes,
    nestedIndices,
    nestedByCallsite,
  };
}
