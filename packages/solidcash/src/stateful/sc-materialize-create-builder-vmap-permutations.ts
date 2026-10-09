/**
 * phase-boundary extract: SC _createBuilder extract — materialize hidden vmap-counter permutation witnesses.
 */

import { bigIntToVmNumber } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import {
  type AbiFunction,
  type Artifact,
  type SortedUpsertLoopAbi,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { defaultInternalFunctionArg } from './kernel-journal-helpers.js';
import {
  vmapCounterPermutationSpec,
  type VmapCounterPermutationSpec,
} from './sc-batch-raw.js';
import { bytesToSlotValue, keyToSlotMulti } from './SortedList.js';
import { visibleHandlerInputs } from './route-expression-key.js';

export interface MaterializeCreateBuilderVmapPermutationsHost {
  hydrateExternalPredicateState(...args: any[]): Promise<Record<string, unknown>>;
  evaluateExternalExpression(...args: any[]): unknown;
  vmapCounterDomain(
    domainInfo: SortedUpsertLoopAbi | undefined,
    permutationSpec: VmapCounterPermutationSpec,
    countArg: unknown,
    visibleArgs: FunctionArgument[],
    artifact: Artifact,
    visibleInputs: ReturnType<typeof visibleHandlerInputs>,
    predicateState: Record<string, unknown>,
    executionSelfAddress: FunctionArgument | undefined,
  ): bigint[] | undefined | null;
}

export interface MaterializeCreateBuilderVmapPermutationsResult {
  args: FunctionArgument[];
  finalArgs: FunctionArgument[];
  directPredicateState: Record<string, unknown>;
}

/**
 * Fill `__internal__vmapCounterPerm_*` hidden args from the public loop bound, applying
 * optional runtime predicates and sorting by the covenant's full-width slot hash.
 */
export async function materializeCreateBuilderVmapPermutations(
  host: MaterializeCreateBuilderVmapPermutationsHost,
  abiFunction: AbiFunction | undefined,
  artifact: Artifact,
  args: FunctionArgument[],
  finalArgs: FunctionArgument[],
  initialPredicateState: Record<string, unknown>,
  executionSelfAddress: FunctionArgument | undefined,
): Promise<MaterializeCreateBuilderVmapPermutationsResult> {
  let directPredicateState = initialPredicateState;
  const nextArgs = [...args];
  let nextFinalArgs = [...finalArgs];

  for (const input of abiFunction?.inputs ?? []) {
    const permutationSpec = vmapCounterPermutationSpec(input.name);
    if (!permutationSpec) continue;
    const hiddenIdx = abiFunction!.inputs.findIndex((p) => p.name === input.name);
    // A compiler route derives this row-owned witness before entering the ordinary builder. It is already in
    // the complete route argument frame, so do not look for the source bound on the wrapper ABI (`n` lives in
    // the authenticated row blob, not as a route parameter).
    if (Array.isArray(nextArgs[hiddenIdx])) continue;
    const loopInfo = abiFunction?.sortedUpsertLoopInfo?.find((info) => info.varyingArrayParam === input.name);
    const eventLoop = abiFunction?.runtimeLoopEvents?.find((loop) => loop.permutationParam === input.name);
    const domainInfo = loopInfo ?? (eventLoop?.iterationBound
      ? { iterationBound: eventLoop.iterationBound } as SortedUpsertLoopAbi : undefined);
    const countIdx = abiFunction!.inputs.findIndex((p) => p.name === permutationSpec.countName);
    if (countIdx < 0 && !domainInfo?.iterationBound) {
      throw new Error(`vmap counter loop bound '${permutationSpec.countName}' must be a public argument`);
    }
    const visibleInputs = visibleHandlerInputs(abiFunction!.inputs);
    const visibleArgs = visibleInputs.map((visibleInput) => {
      const index = abiFunction!.inputs.findIndex((candidate) => candidate.name === visibleInput.name);
      return nextArgs[index];
    }) as FunctionArgument[];
    if (loopInfo?.condition) {
      directPredicateState = await host.hydrateExternalPredicateState(
        [loopInfo.condition],
        visibleArgs,
        artifact,
        directPredicateState,
        visibleInputs,
        executionSelfAddress,
      );
    }
    const active = loopInfo?.condition ? host.evaluateExternalExpression(
      loopInfo.condition,
      visibleArgs,
      artifact,
      directPredicateState,
      visibleInputs,
      undefined,
      0,
      false,
      executionSelfAddress,
    ) : true;
    if (typeof active !== 'boolean') {
      throw new Error(`Could not resolve runtime loop predicate for '${abiFunction!.name}'.`);
    }
    const candidateDomain = active ? host.vmapCounterDomain(
      domainInfo,
      permutationSpec,
      countIdx < 0 ? undefined : nextArgs[countIdx],
      visibleArgs,
      artifact,
      visibleInputs,
      directPredicateState,
      executionSelfAddress,
    ) : [];
    if (!candidateDomain) {
      throw new Error(`Could not resolve runtime loop bound for '${abiFunction!.name}'.`);
    }
    if (active && loopInfo?.iterationCondition) {
      directPredicateState = await host.hydrateExternalPredicateState(
        [loopInfo.iterationCondition, loopInfo.iterationBreakCondition],
        visibleArgs,
        artifact,
        directPredicateState,
        visibleInputs,
        executionSelfAddress,
        candidateDomain.map((_value, index) => index),
      );
    }
    const perm: bigint[] = [];
    if (active) for (let occurrenceIndex = 0; occurrenceIndex < candidateDomain.length; occurrenceIndex += 1) {
      const selected = loopInfo?.iterationCondition ? host.evaluateExternalExpression(
        loopInfo.iterationCondition,
        visibleArgs,
        artifact,
        directPredicateState,
        visibleInputs,
        undefined,
        occurrenceIndex,
        false,
        executionSelfAddress,
      ) : true;
      const breaking = loopInfo?.iterationBreakCondition ? host.evaluateExternalExpression(
        loopInfo.iterationBreakCondition,
        visibleArgs,
        artifact,
        directPredicateState,
        visibleInputs,
        undefined,
        occurrenceIndex,
        false,
        executionSelfAddress,
      ) : false;
      if (typeof selected !== 'boolean') {
        throw new Error(`Could not resolve runtime loop iteration predicate for '${abiFunction!.name}'.`);
      }
      if (typeof breaking !== 'boolean') {
        throw new Error(`Could not resolve runtime loop break predicate for '${abiFunction!.name}'.`);
      }
      if (selected) perm.push(candidateDomain[occurrenceIndex]);
      if (breaking) break;
    }
    perm.sort((a, b) => {
      const av = bytesToSlotValue(keyToSlotMulti([bigIntToVmNumber(a)]));
      const bv = bytesToSlotValue(keyToSlotMulti([bigIntToVmNumber(b)]));
      return av < bv ? -1 : av > bv ? 1 : 0;
    });
    nextArgs[hiddenIdx] = perm;
    while (nextFinalArgs.length <= hiddenIdx) {
      const pending = abiFunction!.inputs[nextFinalArgs.length];
      if (!pending?.name.startsWith('__internal__')) {
        throw new Error(
          `Internal error: missing user argument '${pending?.name ?? nextFinalArgs.length}' before vmap loop witnesses.`,
        );
      }
      nextFinalArgs.push(defaultInternalFunctionArg(pending));
    }
    nextFinalArgs[hiddenIdx] = perm;
  }

  return {
    args: nextArgs,
    finalArgs: nextFinalArgs,
    directPredicateState,
  };
}
