/**
 * phase-boundary extract: SC _createBuilder extract — nested-compose SafeERC20 + shared-prior capture.
 */

import type { AbiFunction, Artifact, ExternalCallAbi } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';

export type PrepareCreateBuilderNestedComposeSharedWriterResult = {
  sharedLogicalArtifact: Artifact;
  sharedPhysicalFunction: AbiFunction | undefined;
  preserveFirstConditionalWriter: boolean;
  sharedPriorFunctionName: string | undefined;
  sharedPriorFunctionArgs: FunctionArgument[] | undefined;
  sharedPriorAtomicNodeIndex: number | undefined;
  sharedPriorAtomicNode: any;
};

/**
 * Resolve SafeERC20 mutually-exclusive writer preservation and capture the
 * shared-prior logical call before retargeting one physical callee group.
 * Mutates `externalCallUtxoGroups[sharedGroupIndex]` when the incoming writer wins.
 */
export function prepareCreateBuilderNestedComposeSharedWriter(
  params: {
    nested: ExternalCallAbi;
    proxyCallee: any | undefined;
    callee: any;
    sharedGroupIndex: number;
    childWritesState: boolean;
    logicalSelector: string | undefined;
    childFunctionName: string;
    childFunctionArgs: FunctionArgument[];
    resolvedRawFunctionName: string | undefined;
    externalCallUtxoGroups: ExternalCallUtxoGroup[];
    latestPreparedAtomicNodeByPhysicalGroup: Map<number, number>;
    preparedAtomicNodes: readonly unknown[] | undefined;
  },
): PrepareCreateBuilderNestedComposeSharedWriterResult {
  const {
    nested, proxyCallee, callee, sharedGroupIndex, childWritesState, logicalSelector,
    childFunctionName, childFunctionArgs, resolvedRawFunctionName,
    externalCallUtxoGroups, latestPreparedAtomicNodeByPhysicalGroup, preparedAtomicNodes,
  } = params;

  const sharedLogicalArtifact = proxyCallee?.implementation.inner.artifact
    ?? callee.inner.artifact;
  const sharedPhysicalFunction = sharedGroupIndex < 0 ? undefined
    : (sharedLogicalArtifact.abi as readonly AbiFunction[]).find(
      (candidate) => candidate.name === externalCallUtxoGroups[sharedGroupIndex].functionName,
    );
  // Mutually-exclusive SafeERC20 fallback calls advertise several conditional writes to the same
  // token master. Without a compiler-owned batch route, one physical co-spend can execute only one
  // handler. Preserve the first active writer; replacing it with the final fallback makes the caller
  // read the first branch's return channel while the token executes different arguments.
  const preserveFirstConditionalWriter = sharedGroupIndex >= 0
    && nested.occurrence === 'conditional'
    && childWritesState
    // Conditional alternatives are one fallback family only when they select the same handler.
    // A later conditional call to another state-writing function is a new transition and must replace
    // the shared physical block; otherwise the transaction executes the earlier method with stale args.
    && logicalSelector !== undefined
    && sharedPhysicalFunction?.selector === logicalSelector
    && sharedPhysicalFunction.writesState === true
    && !externalCallUtxoGroups[sharedGroupIndex].compilerRoute;
  if (sharedGroupIndex >= 0
    && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_RETURN_SNAPSHOT === '1') {
    console.error('shared-writer-choice', JSON.stringify({
      sharedGroupIndex,
      primaryFunction: externalCallUtxoGroups[sharedGroupIndex].functionName,
      incomingFunction: childFunctionName,
      occurrence: nested.occurrence,
      childWritesState,
      logicalSelector,
      primarySelector: sharedPhysicalFunction?.selector,
      primaryWritesState: sharedPhysicalFunction?.writesState,
      preserveFirstConditionalWriter,
    }));
  }
  // Capture the immediately preceding logical call before one physical callee group is retargeted.
  // If both calls push to the same mapping-array entry, the prior push becomes compiler-authored
  // leading input for the final handler body rather than disappearing with the replaced arguments.
  const sharedPriorFunctionName = sharedGroupIndex >= 0
    ? externalCallUtxoGroups[sharedGroupIndex].functionName : undefined;
  const sharedPriorFunctionArgs = sharedGroupIndex >= 0
    ? externalCallUtxoGroups[sharedGroupIndex].functionArgs : undefined;
  const sharedPriorAtomicNodeIndex = sharedGroupIndex >= 0
    ? latestPreparedAtomicNodeByPhysicalGroup.get(sharedGroupIndex) : undefined;
  const sharedPriorAtomicNode = sharedPriorAtomicNodeIndex === undefined
    ? undefined : preparedAtomicNodes?.[sharedPriorAtomicNodeIndex];
  if (sharedGroupIndex >= 0) {
    if (childWritesState && !preserveFirstConditionalWriter) {
      const primary = externalCallUtxoGroups[sharedGroupIndex];
      primary.functionName = childFunctionName;
      primary.functionArgs = childFunctionArgs;
      primary.logicalFunctionName = resolvedRawFunctionName ?? nested.functionName;
      primary.callMode = nested.callMode;
    }
  }

  return {
    sharedLogicalArtifact,
    sharedPhysicalFunction,
    preserveFirstConditionalWriter,
    sharedPriorFunctionName,
    sharedPriorFunctionArgs,
    sharedPriorAtomicNodeIndex,
    sharedPriorAtomicNode,
  };
}
