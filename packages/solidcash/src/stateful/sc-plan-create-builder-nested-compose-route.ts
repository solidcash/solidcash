/**
 * phase-boundary extract: SC _createBuilder extract — nested-compose route plan + state/NFT + selectedFn.
 */

import type { AbiFunction, ExternalCallAbi, StateLayout } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo } from '../interfaces.js';
import { createDataNftUnlocker } from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { resolveStatefulAbiFunction } from './stateful-abi-resolve.js';
import type { OnChainState } from './StateReader.js';
import type { RouteExpressionKeyRow } from './route-expression-key.js';
import {
  deriveValueChunkProducerChildPath,
  type ValueChunkProducerPathDisposition,
} from './ValueChunkProducerIdentity.js';

export type PlanCreateBuilderNestedComposeRouteHost = {
  resolveExternalArgs: (...args: any[]) => FunctionArgument[] | undefined;
  selectProxyForwardInput: (...args: any[]) => FunctionArgument;
  resolvePreparedProducerEntry: (...args: any[]) => { selector?: string } | undefined;
  externalCallReachedOccurrenceIndices: (...args: any[]) => readonly number[] | undefined;
  planExternalCallOccurrences: (...args: any[]) => Promise<readonly {
    args: readonly FunctionArgument[]; sourceIteration: number; occurrenceIndex: number;
  }[]>;
  nestedFullState: (contract: any) => Promise<OnChainState>;
  nestedMasterState: (contract: any) => Promise<OnChainState>;
  readonly timingEnabled: boolean;
};

export type PlanCreateBuilderNestedComposeRouteResult = {
  childState: OnChainState & { masterUtxo: NonNullable<OnChainState['masterUtxo']> };
  childLayout: StateLayout;
  nestedAbiFn: AbiFunction | undefined;
  childRequired: number[];
  childData: UnlockableUtxo[];
  childExternalGroupIndex: number;
  childFunctionName: string;
  childFunctionArgs: FunctionArgument[];
  delegateCallGroupIndex: number | undefined;
  sharedPriorDelegateFunctionName: string | undefined;
  sharedPriorDelegateFunctionArgs: FunctionArgument[] | undefined;
  childWritesState: boolean;
  proxyImplementationState: OnChainState | undefined;
  sharedGroupIndex: number;
  proxyTargetFn: AbiFunction | undefined;
  selectedFn: AbiFunction | undefined;
  producerSelector: string | undefined;
  producerPathForDirectOccurrence: (occurrenceIndex: number) => ValueChunkProducerPathDisposition;
  directInvocationRows: readonly RouteExpressionKeyRow[] | undefined;
};

/**
 * Plan the nested-compose route, load callee/proxy state and data NFTs,
 * select the physical handler, and build direct-invocation producer rows.
 * Mutates nestedIndices / nestedByCallsite / lowLevelCallUtxoGroups bags in place.
 */
export async function planCreateBuilderNestedComposeRoute(
  host: PlanCreateBuilderNestedComposeRouteHost,
  params: {
    nested: ExternalCallAbi;
    nestedSources: readonly any[] | undefined;
    delegateVisibleArgs: readonly FunctionArgument[];
    delegateVisibleInputs: readonly { name: string }[];
    delegateFn: AbiFunction | undefined;
    callInfoContract: any;
    onChainState: { state: Record<string, unknown> };
    delegateSelfAddress: FunctionArgument;
    proxyCallee: any | undefined;
    callee: any;
    nestedArgs: FunctionArgument[];
    graphNestedArgs: FunctionArgument[];
    graphExpressionReturns: Map<string, FunctionArgument> | undefined;
    resolvedRawFunctionName: string | undefined;
    delegateCallerIdentity: unknown;
    rootProducerPath: ValueChunkProducerPathDisposition;
    nestedIndices: number[];
    nestedByCallsite: Map<string | number, number>;
    externalCallUtxoGroups: ExternalCallUtxoGroup[];
    lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
    groupProxyMasterIndices: number[];
    nestedDelegateProxyGroupByLowLevel: Map<number, number>;
  },
): Promise<PlanCreateBuilderNestedComposeRouteResult> {
  const {
    nested, nestedSources, delegateVisibleArgs, delegateVisibleInputs, delegateFn,
    callInfoContract, onChainState, delegateSelfAddress,
    proxyCallee, callee, nestedArgs, graphNestedArgs,
    graphExpressionReturns, resolvedRawFunctionName,
    rootProducerPath, nestedIndices, nestedByCallsite, externalCallUtxoGroups,
    lowLevelCallUtxoGroups, groupProxyMasterIndices, nestedDelegateProxyGroupByLowLevel,
  } = params;
  const timingEnabled = host.timingEnabled;

  const childState = await host.nestedFullState(callee);
  if (timingEnabled) console.error('nested-callsite-state-loaded', { callsiteId: nested.callsiteId });
  if (!childState.masterUtxo) {
    throw new Error(
      `External contract master UTXO not found for ${nested.interfaceName} `
    + `(category ${callee.categoryId})`,
    );
  }
  const childLayout = callee.inner.stateLayout!;
  // An explicitly empty requirement means the callee does not touch
  // fixed state. Expanding it to every data NFT corrupts the callee's
  // block offsets (notably ERC20 mapping-only functions).
  const concreteNestedArtifact = proxyCallee?.implementation.inner.artifact
  ?? callee.inner.artifact;
  const nestedAbiFn = resolveStatefulAbiFunction(
    concreteNestedArtifact,
    resolvedRawFunctionName ?? nested.functionName,
    nestedArgs,
  );
  // Interface metadata describes the statically known upper shape. Once the actual deployment and
  // overload are authenticated, its concrete footprint is exact and must win (including an explicit
  // empty list); otherwise interface-only NFT indices can invent missing balanced slots.
  let childRequired = [...(
    nestedAbiFn?.requiredNftIndices
  ?? nested.requiredDataNftIndices
  ?? []
  )];
  let childData: UnlockableUtxo[] = childRequired.map((nftIndex) => {
    const utxo = childState.dataNftUtxos[nftIndex];
    if (!utxo) {
      throw new Error(
        `External data NFT at index ${nftIndex} not found for ${nested.interfaceName}`,
      );
    }
    return {
      ...utxo,
      unlocker: createDataNftUnlocker(callee.inner, 0, callee.categoryId),
    };
  });
  const childExternalGroupIndex = externalCallUtxoGroups.length;
  nestedIndices.push(childExternalGroupIndex);
  if (nested.callsiteId !== undefined) {
    nestedByCallsite.set(nested.callsiteId, childExternalGroupIndex);
  }
  let childFunctionName = resolvedRawFunctionName ?? nested.functionName;
  let childFunctionArgs = nestedArgs;
  let delegateCallGroupIndex: number | undefined;
  let sharedPriorDelegateFunctionName: string | undefined;
  let sharedPriorDelegateFunctionArgs: FunctionArgument[] | undefined;
  let childWritesState = false;
  let proxyImplementationState: OnChainState | undefined;
  if (proxyCallee) {
    const targetFn = (proxyCallee.implementation.inner.artifact.abi as readonly AbiFunction[])
      .find((f) => f.name === nested.functionName);
    if (!targetFn?.selector) {
      throw new Error(
        `Proxy implementation function '${nested.functionName}' has no selector.`,
      );
    }
    // The built-in single-function proxy has no dispatcher: its first
    // unlocking push is the forwarded implementation selector, which
    // also satisfies the caller's selector pin.
    childFunctionName = '__forward';
    childFunctionArgs = [host.selectProxyForwardInput(targetFn.selector)];
    childWritesState = targetFn.writesState === true;
    if (childWritesState) {
    // The forwarding proxy self-preserves its complete grafted state block even when the selected
    // implementation entry touches only events or a subset of fields.
      childRequired = Array.from(
        { length: childLayout.dataNftCount ?? 0 }, (_, nftIndex) => nftIndex,
      );
      childData = childRequired.map((nftIndex) => {
        const utxo = childState.dataNftUtxos[nftIndex];
        if (!utxo) {
          throw new Error(
            `Proxy data NFT at index ${nftIndex} not found for ${nested.interfaceName}`,
          );
        }
        return {
          ...utxo,
          unlocker: createDataNftUnlocker(callee.inner, 0, callee.categoryId),
        };
      });
    }

    const implementationState = proxyCallee.implementation.inner.artifact.delegateOnly
      ? await host.nestedMasterState(proxyCallee.implementation)
      : await host.nestedFullState(proxyCallee.implementation);
    if (timingEnabled) console.error('nested-callsite-implementation-state-loaded', {
      callsiteId: nested.callsiteId,
    });
    proxyImplementationState = implementationState;
    if (!implementationState.masterUtxo) {
      throw new Error(
        `Proxy implementation master UTXO not found for ${nested.interfaceName}.`,
      );
    }
    const existingDelegateIndex = lowLevelCallUtxoGroups.findIndex((group) => (
      group.callMode === 'delegatecall'
    && group.categoryId === proxyCallee.implementation.categoryId
    ));
    delegateCallGroupIndex = existingDelegateIndex >= 0
      ? existingDelegateIndex : lowLevelCallUtxoGroups.length;
    if (existingDelegateIndex >= 0) {
      sharedPriorDelegateFunctionName = lowLevelCallUtxoGroups[existingDelegateIndex].functionName;
      sharedPriorDelegateFunctionArgs = lowLevelCallUtxoGroups[existingDelegateIndex].functionArgs;
    }
    if (!nestedDelegateProxyGroupByLowLevel.has(delegateCallGroupIndex)) {
      nestedDelegateProxyGroupByLowLevel.set(delegateCallGroupIndex, childExternalGroupIndex);
    }
    if (existingDelegateIndex < 0) {
      lowLevelCallUtxoGroups.push({
        categoryId: proxyCallee.implementation.categoryId,
        stateLayout: proxyCallee.implementation.inner.stateLayout!,
        masterUtxo: implementationState.masterUtxo,
        dataNftUtxos: [],
        requiredDataNftIndices: [],
        functionName: nested.functionName,
        functionArgs: nestedArgs,
        externalContract: proxyCallee.implementation,
        callMode: 'delegatecall',
      });
      groupProxyMasterIndices.push(0);
    }
  }
  const sharedGroupIndex = externalCallUtxoGroups.findIndex(
    (group) => group.categoryId === callee.categoryId,
  );
  const proxyTargetFn = proxyCallee
    ? (proxyCallee.implementation.inner.artifact.abi as readonly AbiFunction[])
      .find((fn) => fn.name === nested.functionName)
    : undefined;
  const selectedFn = proxyTargetFn
  ?? (callee.inner.artifact.abi as readonly AbiFunction[])
    .find((fn) => fn.name === childFunctionName);
  // Producer identity is only as exact as the entry point behind it. `selectedFn` above is a legacy
  // name match kept for layout and return typing; under an overloaded callee it can name a different
  // dispatch target than this callsite, so it never authorizes a value-chunk producer path. An
  // ordinary interface edge publishes no framedsite selector, so an overloaded name fails closed
  // here until the compiler publishes the selector it already resolves and bakes into the covenant.
  const producerSelector = host.resolvePreparedProducerEntry(
    proxyCallee
      ? [proxyCallee.implementation.inner.artifact, callee.inner.artifact]
      : [callee.inner.artifact],
    selectedFn?.name ?? resolvedRawFunctionName ?? nested.functionName,
    nested.rawSelector,
  )?.selector;
  const producerPathForDirectOccurrence = (
    occurrenceIndex: number,
  ): ValueChunkProducerPathDisposition => deriveValueChunkProducerChildPath({
    parent: rootProducerPath,
    // This loop walks calls published by the co-spent delegate implementation, whose executable
    // locking bytecode and selected ABI selector are already fixed.
    parentExecutionLockingBytecode: callInfoContract.inner.lockingBytecode,
    parentSelector: delegateFn?.selector,
    sourceCallsiteId: nested.callsiteId,
    occurrenceIndex,
    sourceEffectOrdinal: nested.sourceEffectOrdinal,
  });
  const affineOccurrences = nested.iterationDomain
    ? await host.planExternalCallOccurrences(nested, {
      functionArgs: delegateVisibleArgs,
      artifact: callInfoContract.inner.artifact,
      state: onChainState.state,
      callerInputs: delegateVisibleInputs,
      executionSelfAddress: delegateSelfAddress,
      externalReturns: graphExpressionReturns,
    }) : undefined;
  const directOccurrenceIndices = affineOccurrences === undefined
    ? host.externalCallReachedOccurrenceIndices(nested, delegateVisibleArgs)
    : affineOccurrences.map((row) => row.sourceIteration);
  const directInvocationRows: readonly RouteExpressionKeyRow[] | undefined =
  selectedFn && producerSelector
    ? directOccurrenceIndices?.map((occurrenceIndex, rowIndex): RouteExpressionKeyRow => {
      const occurrenceArgs = affineOccurrences?.[rowIndex]?.args ?? (occurrenceIndex === 0
        ? graphNestedArgs
        : host.resolveExternalArgs(
          nestedSources,
          delegateVisibleArgs,
          callInfoContract.inner.artifact,
          onChainState.state,
          delegateVisibleInputs,
          graphExpressionReturns,
          occurrenceIndex,
          false,
          delegateSelfAddress,
        ));
      if (!occurrenceArgs) {
        throw new Error(
          `Delegate external callsite ${nested.callsiteId ?? 'unknown'} occurrence `
          + `${occurrenceIndex} has arguments that cannot be resolved by the SDK.`,
        );
      }
      return {
        args: [...occurrenceArgs],
        handler: selectedFn,
        selector: producerSelector,
        sourceCallsiteId: nested.callsiteId,
        occurrenceIndex: affineOccurrences?.[rowIndex]?.occurrenceIndex ?? occurrenceIndex,
        sourceEffectOrdinal: nested.sourceEffectOrdinal,
        producerPath: producerPathForDirectOccurrence(
          affineOccurrences?.[rowIndex]?.occurrenceIndex ?? occurrenceIndex,
        ),
      };
    })
    : undefined;
  if (!proxyCallee && selectedFn?.blockLayout) {
  // The caller records requirements against the source interface. A concrete deployment can have
  // additional fixed state which its generated epilogue authenticates even when that interface
  // declares no state (IERC20 is the common case). The selected concrete block layout is the
  // physical transaction contract, so it must win over an explicitly empty caller-side footprint.
    childRequired = [...new Set(
      selectedFn.blockLayout.slots
        .filter((slot: any) => slot.kind === 'dataNft' && slot.nftIndex !== undefined)
        .map((slot: any) => slot.nftIndex as number),
    )] as number[];
    childData = childRequired.map((nftIndex) => {
      const utxo = childState.dataNftUtxos[nftIndex];
      if (!utxo) {
        throw new Error(
          `External data NFT at index ${nftIndex} not found for ${nested.interfaceName}`,
        );
      }
      return {
        ...utxo,
        unlocker: createDataNftUnlocker(callee.inner, 0, callee.categoryId),
      };
    });
  }

  return {
    childState: childState as OnChainState & { masterUtxo: NonNullable<OnChainState['masterUtxo']> },
    childLayout,
    nestedAbiFn,
    childRequired,
    childData,
    childExternalGroupIndex,
    childFunctionName,
    childFunctionArgs,
    delegateCallGroupIndex,
    sharedPriorDelegateFunctionName,
    sharedPriorDelegateFunctionArgs,
    childWritesState,
    proxyImplementationState,
    sharedGroupIndex,
    proxyTargetFn,
    selectedFn,
    producerSelector,
    producerPathForDirectOccurrence,
    directInvocationRows,
  };
}
