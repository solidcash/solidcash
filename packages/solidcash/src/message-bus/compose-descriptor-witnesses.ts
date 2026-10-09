/**
 * phase-boundary extract: Compose phase-boundary extract — derive expression-backed route witnesses per prepared call.
 */

import { vmNumberToBigInt } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
;
;
;
import type { FunctionArgument } from '../Argument.js';
import { evalComputedKey } from '../stateful/StatefulContract.js';
import type { StatefulContract } from '../stateful/StatefulContract.js';
import type { CallDescriptor } from './compose-prepared-invocation.js';
import {
  resolveMessageBusAbiFunction,
  resolveMessageBusHandler,
} from './message-bus.js';

export async function deriveComposeDescriptorWitnesses(
  descriptors: readonly CallDescriptor[],
  stateOf: (contract: StatefulContract) => Promise<Record<string, unknown>>,
): Promise<ReadonlyArray<Readonly<Record<string, FunctionArgument>>>> {
  return Promise.all(descriptors.map(async (descriptor) => {
    const artifact = descriptor.artifact;
    const abi = resolveMessageBusAbiFunction(artifact, descriptor.functionName, descriptor.selector);
    const handler = resolveMessageBusHandler(artifact, descriptor.functionName, abi?.selector);
    const expressionBindings = handler?.batchKeyWitnesses?.filter((binding) =>
      binding.source === 'expression') ?? [];
    if (expressionBindings.length === 0) return Object.freeze({}) as Readonly<Record<string, FunctionArgument>>;
    if (!abi) throw new Error(`messageBus: ABI for '${descriptor.functionName}' is missing`);
    const state = await stateOf(descriptor.contract);
    const witnesses: Record<string, FunctionArgument> = {};
    for (const binding of expressionBindings) {
      const encoded = evalComputedKey(
        binding.expressionLabel,
        [...descriptor.args],
        abi.inputs,
        state as Parameters<typeof evalComputedKey>[3],
      );
      if (!encoded) {
        throw new Error(
          `messageBus: cannot derive computed route witness '${binding.routeInput}' `
          + `from '${binding.expressionLabel ?? '<missing expression>'}'`,
        );
      }
      const routeType = artifact.messageBus?.route.inputs.find((input) =>
        input.name === (binding.perRow ? `${binding.routeInput}_r0` : binding.routeInput))?.type;
      witnesses[binding.routeInput] = routeType === 'bool'
        ? vmNumberToBigInt(encoded) !== 0n
        : routeType === 'bigint' || routeType === 'int' || routeType === 'uint'
          || /^u?int\d+$/.test(routeType ?? '')
          ? vmNumberToBigInt(encoded)
          : encoded;
    }
    return Object.freeze(witnesses);
  }));
}
