/**
 * phase-boundary extract: Compose phase-boundary extract — validate prepared-call selector/args against the compiled plan.
 */

import { hexToBin } from '@bitauth/libauth';
import type { FunctionArgument } from '../Argument.js';
import {
  encodeMessageBatch, preparedCallMatchesPlanInvocation,
} from './message-bus.js';
import { graphInvocationCallerIdentity } from './graph.js';
import { findMessageBusHandlerForInvocation } from './graph-handler-join.js';
import { hasResultDependentAncestor as hasComposeResultDependentAncestor } from './compose-result-propagation.js';
import type { CallDescriptor } from './compose-prepared-invocation.js';
import { deriveCompiledGraphPlan } from './worklist.js';

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;

/**
 * Fail closed when a prepared call disagrees with the plan on selector or (non-result-dependent) argsHex.
 */
export function validateComposePreparedCallArguments(
  plan: CompiledGraphPlan,
  descriptors: readonly CallDescriptor[],
  descriptorWitnesses: readonly Record<string, FunctionArgument>[],
  rootCaller: Uint8Array,
): void {
  const hasResultDependentAncestor = (invocationIndex: number): boolean => (
    hasComposeResultDependentAncestor({ plan, descriptors }, invocationIndex)
  );
  plan.invocations.forEach((invocation, index) => {
    const supplied = descriptors[index];
    // prepared-call selector match: kernel prepared-call match is selector authority; diagnostic name alone cannot refuse.
    if (!supplied || !preparedCallMatchesPlanInvocation(supplied, invocation)) {
      throw new Error(
        `messageBus: prepared call ${index} is '${supplied?.functionName ?? '<missing>'}' `
        + `(selector '${supplied?.selector ?? '<none>'}'), `
        + `expected '${invocation.function}' (selector '${invocation.selectorHex}')`,
      );
    }
    const handler = findMessageBusHandlerForInvocation(supplied.artifact, {
      function: supplied.functionName,
      selectorHex: invocation.selectorHex,
    });
    const validationWitnesses = Object.fromEntries((handler?.batchKeyWitnesses ?? [])
      .filter((binding) => binding.source === 'expression')
      .map((binding) => [
        binding.perRow ? `${binding.routeInput}_r0` : binding.routeInput,
        descriptorWitnesses[index][binding.routeInput],
      ]).filter((entry): entry is [string, FunctionArgument] => entry[1] !== undefined));
    const participantExecution = plan.participants[invocation.callee];
    const plannedWitnesses = Object.fromEntries(participantExecution.routeInputs
      .filter((input) => input.name !== 'batchBlob' && !input.name.startsWith('__internal__'))
      .map((input, witnessIndex) => [input.name, participantExecution.batch.routeWitnesses[witnessIndex]]));
    const suppliedRow = encodeMessageBatch(supplied.artifact, [{
      function: supplied.functionName,
      selector: invocation.selectorHex,
      args: supplied.args,
      callMode: invocation.callMode,
      ...(invocation.caller !== null && handler?.usesMsgValue
        && (handler.transfers?.length ?? 0) === 0 && { msgValue: 0n }),
      logicalCaller: invocation.caller === null
        ? rootCaller : hexToBin(graphInvocationCallerIdentity(
          plan.participants, plan.invocations, invocation,
        ).lockingBytecode),
    }], { ...plannedWitnesses, ...validationWitnesses }).rows[0];
    // Once an ancestor's arguments are rebuilt from authenticated sibling returns, ordinary forwarded
    // descendants are re-derived by the compiler worklist too. Their discovery descriptors still describe the
    // preceding fixed-point pass, so comparing those stale bytes here would stop convergence before the
    // participant covenant can expose the next result. Calls outside such a dependency subtree remain strict.
    if (suppliedRow.argsHex !== invocation.argsHex && !hasResultDependentAncestor(index)) {
      throw new Error(
        `messageBus: prepared call ${index} '${invocation.function}' arguments disagree with compiler-derived `
        + `invocation arguments (prepared ${suppliedRow.argsHex}, derived ${invocation.argsHex})`,
      );
    }
  });
}
