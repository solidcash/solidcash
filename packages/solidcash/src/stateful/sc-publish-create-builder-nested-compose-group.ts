/**
 * phase-boundary extract: SC _createBuilder extract — publish nested-compose external-call group.
 */

import type { AbiFunction, ExternalCallAbi } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import type { OnChainState } from './StateReader.js';

export type PublishCreateBuilderNestedComposeGroupParams = {
  nested: ExternalCallAbi;
  proxyCallee: any | undefined;
  callee: any;
  childLayout: any;
  childState: OnChainState & { masterUtxo: NonNullable<OnChainState['masterUtxo']> };
  childData: UnlockableUtxo[];
  childRequired: number[];
  childFunctionName: string;
  childFunctionArgs: FunctionArgument[];
  nestedArgs: FunctionArgument[];
  resolvedRawFunctionName: string | undefined;
  childCompilerRoute: any | undefined;
  childCompilerInternalArgs: Record<string, FunctionArgument>;
  childValueWitnesses: Map<number, Uint8Array>;
  childRelativeOutputInternalArgs: string[];
  childBlockInputs: UnlockableUtxo[] | undefined;
  childPlannedEntryInserts: Array<{
    blockSlot: number; outputBlockSlot: number;
    commitment?: string; newCommitment?: string;
  }>;
  childBatchPredecessorOutputs: Array<{
    outputBlockSlot: number; lockingBytecode: Uint8Array; commitment: string;
  }>;
  childBatchEntryLockingBytecodes: Map<number, Uint8Array>;
  childBatchEntryCommitments: Map<number, string>;
  childDynamicChunkResources: Array<{
    blockSlot: number; name: string; type: string; write: boolean;
  }>;
  selectedLayout: any;
  sharedGroupIndex: number;
  delegateCallGroupIndex: number | undefined;
  childExternalGroupIndex: number;
  childValueChunkSlots: number;
  precomputedReturnCommitment: Uint8Array | undefined;
  loopReturnCommitments: Uint8Array[] | undefined;
  resolveLoopReturnCommitment: ((occurrenceIndex: number) => Promise<Uint8Array>) | undefined;
  resolveLoopReturnValue: ((occurrenceIndex: number) => Promise<any>) | undefined;
  resolveLoopFunctionArgs: ((occurrenceIndex: number) => any[] | undefined) | undefined;
  refreshChunkableRouteWitnesses: ((...args: any[]) => any) | undefined;
  delegateCallerIdentity: unknown;
  externalCallUtxoGroups: ExternalCallUtxoGroup[];
  lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
};

/**
 * Merge chunkable-value witnesses into shared/delegate internal args and push the
 * nested-compose physical (or shared logical) external-call group.
 */
export function publishCreateBuilderNestedComposeGroup(
  params: PublishCreateBuilderNestedComposeGroupParams,
): void {
  const {
    nested, proxyCallee, callee, childLayout, childState, childData, childRequired,
    childFunctionName, childFunctionArgs, nestedArgs, resolvedRawFunctionName,
    childCompilerRoute, childCompilerInternalArgs, childValueWitnesses,
    childRelativeOutputInternalArgs, childBlockInputs, childPlannedEntryInserts,
    childBatchPredecessorOutputs, childBatchEntryLockingBytecodes,
    childBatchEntryCommitments, childDynamicChunkResources, selectedLayout,
    sharedGroupIndex, delegateCallGroupIndex,
    childValueChunkSlots, precomputedReturnCommitment, loopReturnCommitments,
    resolveLoopReturnCommitment, resolveLoopReturnValue, resolveLoopFunctionArgs, refreshChunkableRouteWitnesses,
    delegateCallerIdentity, externalCallUtxoGroups, lowLevelCallUtxoGroups,
  } = params;

  // Publish the callee's chunkable-value witnesses alongside the vmap batch witnesses; the delegate
  // arg fill reads them by name. Emitted unconditionally - a route may read a chunkable value
  // without carrying any sorted-batch WRITE.
  const childValueWitnessArgs: Record<string, FunctionArgument> = {};
  for (const [routeSlot, payload] of childValueWitnesses) {
    const name = `__internal__valueWitness_${routeSlot}`;
    childCompilerInternalArgs[name] = payload;
    childValueWitnessArgs[name] = payload;
  }
  const sharedPrimary = sharedGroupIndex >= 0
    ? externalCallUtxoGroups[sharedGroupIndex] : undefined;
  const sharedDelegate = delegateCallGroupIndex !== undefined
    ? lowLevelCallUtxoGroups[delegateCallGroupIndex] : undefined;
  // A read-only row can be discovered after the state-writing row which owns the one physical
  // participant. Its authenticated long-value witness still belongs to that physical route. Keep
  // these additive, per-route-slot arguments when later rows reuse the group; otherwise the route
  // receives the empty caller-side fallback and silently decodes the mapped value as zero.
  if (sharedPrimary && Object.keys(childValueWitnessArgs).length > 0) {
    sharedPrimary.internalArgs = {
      ...sharedPrimary.internalArgs,
      ...childValueWitnessArgs,
    };
    if (sharedPrimary.compilerRoute) {
      sharedPrimary.compilerRoute = {
        ...sharedPrimary.compilerRoute,
        internalArgs: {
          ...sharedPrimary.compilerRoute.internalArgs,
          ...childValueWitnessArgs,
        },
      };
    }
  }
  for (const [name, value] of Object.entries({
    ...sharedDelegate?.internalArgs,
    ...sharedPrimary?.internalArgs,
  })) {
    if (name.startsWith('__internal__leadingPushValue_')
      && value instanceof Uint8Array && value.length > 0
      && childCompilerInternalArgs[name] === undefined) {
      childCompilerInternalArgs[name] = value;
    }
  }
  const childHasInternalArgs = Object.keys(childCompilerInternalArgs).length > 0;
  if (delegateCallGroupIndex !== undefined && childHasInternalArgs) {
    const delegate = lowLevelCallUtxoGroups[delegateCallGroupIndex];
    delegate.internalArgs = { ...delegate.internalArgs, ...childCompilerInternalArgs };
    const delegateRoute = delegate.compilerRoute ?? childCompilerRoute;
    if (delegateRoute) {
      const previous = (delegateRoute as { internalArgs?: Record<string, FunctionArgument> })
        .internalArgs;
      delegate.compilerRoute = {
        ...delegateRoute,
        internalArgs: { ...previous, ...childCompilerInternalArgs },
      };
    }
  }
  externalCallUtxoGroups.push({
    categoryId: callee.categoryId,
    stateLayout: childLayout,
    masterUtxo: childState.masterUtxo,
    dataNftUtxos: childData,
    requiredDataNftIndices: childRequired,
    functionName: childFunctionName,
    functionArgs: childFunctionArgs,
    externalContract: callee,
    callerIdentity: delegateCallerIdentity,
    logicalFunctionName: resolvedRawFunctionName ?? nested.functionName,
    logicalFunctionArgs: nestedArgs,
    logicalContract: callee,
    logicalArtifact: proxyCallee?.implementation.inner.artifact ?? callee.inner.artifact,
    ...(childCompilerRoute && { compilerRoute: {
      ...childCompilerRoute,
      ...(childHasInternalArgs && {
        internalArgs: childCompilerInternalArgs,
      }),
    } }),
    // Ordinary nested callees (no compiler route) still own SDK-derived hidden witnesses. Preserve
    // them on the physical group so its unlocker can fill vmap batches and value witnesses later.
    ...(childHasInternalArgs && { internalArgs: childCompilerInternalArgs }),
    ...(delegateCallGroupIndex !== undefined && { delegateCallGroupIndex }),
    ...(nested.callMode && { callMode: nested.callMode }),
    ...(childBlockInputs && {
      blockInputs: proxyCallee
        ? [childState.masterUtxo as UnlockableUtxo, ...childData]
        : childBlockInputs,
      blockLayout: proxyCallee
        ? (callee.inner.artifact.abi as readonly AbiFunction[])
          .find((fn: any) => fn.name === childFunctionName)?.blockLayout
        : selectedLayout,
      ...((proxyCallee
        ? (callee.inner.artifact.abi as readonly AbiFunction[])
          .find((fn: any) => fn.name === childFunctionName)?.blockLayout
        : selectedLayout)?.slots.some((slot: any) => slot.kind === 'returnEvent')
        && { returnEventInBlock: true }),
    }),
    ...(!proxyCallee && childPlannedEntryInserts.length > 0 && {
      plannedEntryInserts: childPlannedEntryInserts,
    }),
    ...(!proxyCallee && childBatchPredecessorOutputs.length > 0 && {
      batchPredecessorOutputs: childBatchPredecessorOutputs,
    }),
    ...(!proxyCallee && childBatchEntryLockingBytecodes.size > 0 && {
      batchEntryLockingBytecodes: childBatchEntryLockingBytecodes,
    }),
    ...(!proxyCallee && childBatchEntryCommitments.size > 0 && {
      batchEntryCommitments: childBatchEntryCommitments,
    }),
    ...(!proxyCallee && childDynamicChunkResources.length > 0 && {
      dynamicChunkResources: childDynamicChunkResources,
    }),
    ...(childRelativeOutputInternalArgs.length > 0 && {
      relativeOutputInternalArgs: childRelativeOutputInternalArgs,
    }),
    ...(sharedGroupIndex >= 0 && {
      sharedGroupIndex,
      blockInputs: [] as UnlockableUtxo[],
    }),
    ...(precomputedReturnCommitment && { precomputedReturnCommitment }),
    ...(loopReturnCommitments && { loopReturnCommitments }),
    ...(nested.resultArrayOutput !== undefined && {
      loopResultArrayOutput: nested.resultArrayOutput,
    }),
    ...(nested.maximumOccurrences !== undefined && {
      loopMaximumOccurrences: nested.maximumOccurrences,
    }),
    ...(resolveLoopReturnCommitment && { resolveLoopReturnCommitment }),
    ...(resolveLoopReturnValue && { resolveLoopReturnValue }),
    ...(resolveLoopFunctionArgs && { resolveLoopFunctionArgs }),
    ...(childValueChunkSlots > 0 && { valueChunkOutputCount: childValueChunkSlots }),
    ...(refreshChunkableRouteWitnesses && {
      refreshRouteDerivedArguments: refreshChunkableRouteWitnesses,
    }),
  });
  // Publish the exact continuation resource before constructing the transaction builder. Waiting for
  // VM derivation is too late: output-band planning already treats compiler collection effects as
  // authoritative and must not fall back to a category-wide or source-name guess.
}
