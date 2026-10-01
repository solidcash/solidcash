/**
 * Compose phase-boundary extract: prepare call descriptors, fee funder,
 * provider, upgrade targets, and state cache.
 */

import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { StatefulContract } from '../stateful/StatefulContract.js';
import { funderUtxo } from './compose-participant-helpers.js';
import {
  deriveComposeDescriptorWitnesses,
} from './compose-descriptor-witnesses.js';
import {
  resolveComposeUpgradeTargets,
} from './compose-upgrade-targets.js';
import type {
  CallDescriptor,
  ComposeAtomicMessageBusOptions,
} from './compose-prepared-invocation.js';
import { resolveMessageBusAbiFunction } from './message-bus.js';

export interface PrepareComposeDescriptorsResult {
  descriptors: CallDescriptor[];
  feeFunder: UnlockableUtxo;
  rootCaller: Uint8Array;
  provider: NetworkProvider;
  upgradeOutputs: Map<string, string>;
  upgradeStateSuffixes: Map<string, Uint8Array>;
  stateOf: (contract: StatefulContract) => Promise<Record<string, unknown>>;
  descriptorWitnesses: readonly Readonly<Record<string, FunctionArgument>>[];
}

/**
 * Normalize prepared/call descriptors, validate the fee-tail P2PKH root caller and shared provider,
 * resolve upgrade targets, and derive expression route witnesses from contract state.
 */
export async function prepareComposeDescriptors(
  options: ComposeAtomicMessageBusOptions,
): Promise<PrepareComposeDescriptorsResult> {
  const descriptors: CallDescriptor[] = options.preparedCalls
    ? options.preparedCalls.map((call) => ({
      ...call,
      artifact: call.executionArtifact ?? call.contract.inner.artifact,
    }))
    : (options.calls ?? []).map((call) => {
      const descriptor = call._messageBusCompositionDescriptor();
      return { ...descriptor, artifact: descriptor.contract.inner.artifact };
    });
  for (const descriptor of descriptors) {
    const selected = resolveMessageBusAbiFunction(
      descriptor.artifact, descriptor.functionName, descriptor.selector,
    );
    if (selected?.selector !== undefined) descriptor.selector = selected.selector;
  }
  if (descriptors.length < 2) {
    throw new Error('messageBus: atomic composition requires at least two prepared calls');
  }
  const feeFunder = funderUtxo(options.funder);
  const rootCaller = feeFunder.unlocker.generateLockingBytecode();
  if (rootCaller.length !== 25 || rootCaller[0] !== 0x76 || rootCaller[1] !== 0xa9
    || rootCaller[2] !== 0x14 || rootCaller[23] !== 0x88 || rootCaller[24] !== 0xac) {
    throw new Error(
      'messageBus: the canonical fee tail must be a bare P2PKH input so the root caller equals authenticated tx.origin',
    );
  }
  const provider = descriptors[0].contract.inner.provider;
  if (descriptors.some((descriptor) => descriptor.contract.inner.provider !== provider)) {
    throw new Error('messageBus: all participants must use the same network provider');
  }
  const { upgradeOutputs, upgradeStateSuffixes } = resolveComposeUpgradeTargets(descriptors, provider);

  const stateByContract = new Map<StatefulContract, Promise<Record<string, unknown>>>();
  const stateOf = (contract: StatefulContract): Promise<Record<string, unknown>> => {
    let pending = stateByContract.get(contract);
    if (!pending) {
      pending = contract.getState() as Promise<Record<string, unknown>>;
      stateByContract.set(contract, pending);
    }
    return pending;
  };
  const descriptorWitnesses = await deriveComposeDescriptorWitnesses(descriptors, stateOf);
  return {
    descriptors,
    feeFunder,
    rootCaller,
    provider,
    upgradeOutputs,
    upgradeStateSuffixes,
    stateOf,
    descriptorWitnesses,
  };
}
