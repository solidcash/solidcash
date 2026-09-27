/**
 * phase-boundary extract: Compose phase-boundary extract — result-dependent argument propagation.
 */

import { hexToBin } from '@bitauth/libauth';
import type { FunctionArgument } from '../Argument.js';
import { decodeAuthenticatedProducerResultVector } from '../stateful/StatefulContract.js';
import {
  rebuildPreparedInvocation,
  semanticJson,
  type CallDescriptor,
  type PreparedAtomicMessageBusCall,
} from './compose-prepared-invocation.js';
import { deriveCompiledGraphPlan } from './worklist.js';

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;
type PlannedInvocation = CompiledGraphPlan['invocations'][number];

export interface ResultPropagationContext {
  plan: CompiledGraphPlan;
  descriptors: readonly CallDescriptor[];
  returning: readonly PlannedInvocation[];
}

export function hasResultDependentAncestor(
  ctx: Pick<ResultPropagationContext, 'plan' | 'descriptors'>,
  invocationIndex: number,
): boolean {

  let parent = ctx.plan.invocations[invocationIndex]?.parent;
  while (parent !== null && parent !== undefined) {
    if (ctx.descriptors[parent]?.resolveArgsFromResults !== undefined) return true;
    parent = ctx.plan.invocations[parent]?.parent;
  }
  return false;
}

export function decodeResultsByParent(
  ctx: ResultPropagationContext,
  results: Readonly<Record<number, string>>,
): Map<number, Map<number, FunctionArgument>> {
  const resultsByParent = new Map<number, Map<number, FunctionArgument>>();
  for (const invocation of ctx.returning) {
    if (invocation.parent === null || invocation.consumerCallsiteId === undefined) continue;
    const resultHex = results[invocation.index];
    if (resultHex === undefined) continue;
    const artifact = ctx.plan.participants[invocation.callee].artifact;
    const decoded = decodeAuthenticatedProducerResultVector(
      hexToBin(resultHex), invocation.resultTypes,
      artifact.structs ?? artifact.stateLayout?.structs,
      invocation.resultEncoding === 'evm-abi-v1', artifact.enums,
    );
    const value = decoded === undefined
      ? undefined
      : (decoded.length === 1 ? decoded[0] : decoded) as FunctionArgument;
    if (value === undefined) continue;
    const siblings = resultsByParent.get(invocation.parent) ?? new Map<number, FunctionArgument>();
    if (siblings.has(invocation.consumerCallsiteId)) {
      throw new Error(
        `Atomic graph has duplicate authenticated producer lane ${invocation.parent}:${invocation.consumerCallsiteId}.`,
      );
    }
    siblings.set(invocation.consumerCallsiteId, value);
    resultsByParent.set(invocation.parent, siblings);
  }
  return resultsByParent;
}

export function propagateResultDependentArguments(
  ctx: ResultPropagationContext,
  results: Readonly<Record<number, string>>,
): { propagated: boolean; calls: PreparedAtomicMessageBusCall[] } {
  const resultsByParent = decodeResultsByParent(ctx, results);
  let propagated = false;
  const resolvedArguments: Array<readonly FunctionArgument[]> = [];
  ctx.descriptors.forEach((descriptor, index) => {
    const invocation = ctx.plan.invocations[index];
    const siblingResults = invocation.parent === null
      ? undefined : resultsByParent.get(invocation.parent);
    // Descriptors are in depth-first source order. A changed producer argument must reach every
    // descendant before rebuilding the graph, including void/raw calls with no returning siblings.
    const parentArgs = invocation.parent === null ? undefined : resolvedArguments[invocation.parent];
    const parentChanged = parentArgs !== undefined
      && semanticJson(parentArgs) !== semanticJson(ctx.descriptors[invocation.parent!].args);
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_RESULT_PROPAGATION === '1') {
      console.error('atomic-result-descriptor', JSON.stringify({
        invocation: index,
        functionName: descriptor.functionName,
        callee: ctx.plan.participants[invocation.callee]?.artifact.contractName,
        parent: invocation.parent,
        consumerCallsiteId: invocation.consumerCallsiteId,
        nodeCallsiteId: descriptor.callsiteId,
        sourceCallsiteId: descriptor.sourceCallsiteId,
        sourceLogicalIndex: descriptor.sourceLogicalIndex,
        batchLogicalIndex: descriptor.batchLogicalIndex,
        hasResolver: descriptor.resolveArgsFromResults !== undefined,
        siblingCallsites: siblingResults === undefined ? null : [...siblingResults.keys()],
      }));
    }
    const resolved = siblingResults || parentChanged
      ? descriptor.resolveArgsFromResults?.(siblingResults ?? new Map(), parentArgs) : undefined;
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_RESULT_PROPAGATION === '1' && siblingResults
      && descriptor.resolveArgsFromResults) {
      console.error('atomic-result-argument-resolution', JSON.stringify({
        invocation: index,
        functionName: descriptor.functionName,
        callsites: [...siblingResults.keys()],
        resolved: resolved !== undefined,
        changed: resolved !== undefined
          && semanticJson(resolved) !== semanticJson(descriptor.args),
      }));
    }
    if (resolved && semanticJson(resolved) !== semanticJson(descriptor.args)) {
      propagated = true;
    }
    resolvedArguments.push(resolved ?? descriptor.args);
  });
  // A changed row can alter a terminal collection value produced by a later sibling even when that later
  // sibling's own public arguments are unchanged. Refresh all capable rows against the now-complete shared
  // producer-path argument epoch, in source order, after argument propagation has been decided.
  const refreshValueProductions = propagated;
  const calls = ctx.descriptors.map((descriptor, index) => {
    const call = rebuildPreparedInvocation(
      descriptor, resolvedArguments[index], results[index], { refreshValueProductions },
    );
    const childResults = resultsByParent.get(index);
    if (childResults && descriptor.resolveValueChunkProductionsFromResults) {
      const productions = descriptor.resolveValueChunkProductionsFromResults(resolvedArguments[index], childResults);
      if (semanticJson(productions) !== semanticJson(descriptor.valueChunkProductions ?? [])) propagated = true;
      call.valueChunkProductions = productions;
    }
    return call;
  });
  return { propagated, calls };
}
