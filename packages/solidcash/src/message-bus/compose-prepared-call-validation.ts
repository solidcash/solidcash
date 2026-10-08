/**
 * phase-boundary extract: Compose phase-boundary extract — validate prepared-call selector/args against the compiled plan.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import { lockingBytecodeToSolidityAddressPayload } from '../utils.js';
import {
  encodeMessageBatch, encodeMessageBusArguments, preparedCallMatchesPlanInvocation,
} from './message-bus.js';
import { graphInvocationCallerIdentity } from './graph.js';
import { findMessageBusHandlerForInvocation } from './graph-handler-join.js';
import { hasResultDependentAncestor as hasComposeResultDependentAncestor } from './compose-result-propagation.js';
import type { CallDescriptor } from './compose-prepared-invocation.js';
import { deriveCompiledGraphPlan } from './worklist.js';

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;

/**
 * A Solidity address forwarded through another handler is an ABI word in that handler's decoded frame. The
 * discovery descriptor can still hold its original native locking script. Accept that representation change
 * only when the typed address is the exact authenticated target of this invocation's outgoing callsite.
 */
function preparedArgsMatchAuthenticatedAddressTargets(
  plan: CompiledGraphPlan,
  index: number,
  supplied: CallDescriptor,
): boolean {
  if (supplied.artifact.compiler?.options?.solidityImportCompat !== true
    && supplied.artifact.compiler?.options?.evmCompat !== true) return false;
  const invocation = plan.invocations[index];
  const abi = supplied.artifact.abi.find((candidate) =>
    candidate.selector?.toLowerCase() === invocation.selectorHex.toLowerCase());
  if (!abi) return false;
  const plannedArgs = invocation.args;
  if (plannedArgs === undefined) return false;
  const inputs = abi.inputs.filter((input) => !input.name.startsWith('__internal__'));
  if (inputs.length !== supplied.args.length || inputs.length !== plannedArgs.length) return false;
  const structs = supplied.artifact.structs ?? supplied.artifact.stateLayout?.structs;
  let projectedAddressCount = 0;
  for (let argumentIndex = 0; argumentIndex < inputs.length; argumentIndex += 1) {
    const type = inputs[argumentIndex].type;
    const prepared = encodeFunctionArgument(supplied.args[argumentIndex], type, structs);
    const planned = encodeFunctionArgument(plannedArgs[argumentIndex], type, structs);
    if (!(prepared instanceof Uint8Array) || !(planned instanceof Uint8Array)) return false;
    if (binToHex(prepared) === binToHex(planned)) continue;
    if (type !== 'address' && type !== 'address payable') return false;
    if (planned.length !== 32 || !planned.subarray(0, 12).every((byte) => byte === 0)) return false;
    const identity = lockingBytecodeToSolidityAddressPayload(prepared);
    if (identity === undefined || binToHex(identity) !== binToHex(planned.subarray(12))) return false;
    const callsiteIds = (abi.externalCalls ?? []).filter((call) =>
      call.addressSource?.kind === 'forward' && call.addressSource.paramIndex === argumentIndex)
      .map((call) => call.callsiteId);
    const targets = plan.invocations.filter((child) => child.parent === index
      && callsiteIds.includes(child.consumerCallsiteId));
    if (targets.length === 0 || targets.some((child) =>
      child.targetLockingBytecode?.toLowerCase() !== binToHex(prepared))) return false;
    projectedAddressCount += 1;
  }
  return projectedAddressCount > 0;
}

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
    if (participantExecution.authority === 'direct') {
      const abi = supplied.artifact.abi.find((candidate) =>
        candidate.selector?.toLowerCase() === invocation.selectorHex.toLowerCase());
      const visible = abi?.inputs.filter((input) => !input.name.startsWith('__internal__')) ?? [];
      const encoded = visible.length === 1 && supplied.args.length === 1
        ? encodeFunctionArgument(supplied.args[0], visible[0].type,
          supplied.artifact.structs ?? supplied.artifact.stateLayout?.structs) : undefined;
      if (!(encoded instanceof Uint8Array)
        || binToHex(encodeMessageBusArguments([encoded], [visible[0].type])) !== invocation.argsHex) {
        throw new Error(`messageBus: prepared direct call ${index} has a non-canonical scalar argument`);
      }
      return;
    }
    const plannedWitnesses = Object.fromEntries(participantExecution.routeInputs
      .filter((input) => input.name !== 'batchBlob' && !input.name.startsWith('__internal__'))
      .map((input, witnessIndex) => [input.name, participantExecution.batch!.routeWitnesses[witnessIndex]]));
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
    if (suppliedRow.argsHex !== invocation.argsHex && !hasResultDependentAncestor(index)
      && !preparedArgsMatchAuthenticatedAddressTargets(plan, index, supplied)) {
      throw new Error(
        `messageBus: prepared call ${index} '${invocation.function}' arguments disagree with compiler-derived `
        + `invocation arguments (prepared ${suppliedRow.argsHex}, derived ${invocation.argsHex})`,
      );
    }
  });
}
