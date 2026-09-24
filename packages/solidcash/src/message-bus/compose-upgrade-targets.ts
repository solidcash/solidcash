/**
 * phase-boundary extract: Compose phase-boundary extract — resolve upgrade replacement outputs / state suffixes.
 */

import { hexToBin } from '@bitauth/libauth';
import type { ConstructorArgument } from '../Argument.js';
import { Contract } from '../Contract.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { appendOnlyStateSuffix } from './compose-participant-helpers.js';
import type { CallDescriptor } from './compose-prepared-invocation.js';

export interface ResolveUpgradeTargetsResult {
  upgradeOutputs: Map<string, string>;
  upgradeStateSuffixes: Map<string, Uint8Array>;
}

export function resolveComposeUpgradeTargets(
  descriptors: readonly CallDescriptor[],
  provider: NetworkProvider,
): ResolveUpgradeTargetsResult {
  const upgradeOutputs = new Map<string, string>();
  const upgradeStateSuffixes = new Map<string, Uint8Array>();
  const upgradeDeclarations = new Map<string, number>();
  for (const descriptor of descriptors) {
    if (!descriptor.upgradeTarget) continue;
    if (descriptor.executor !== undefined || descriptor.executionArtifact !== undefined) {
      throw new Error('messageBus: upgrade targets cannot be attached to delegate execution routes');
    }
    const owner = descriptor.contract.inner.lockingBytecode.toLowerCase();
    const declarations = (upgradeDeclarations.get(owner) ?? 0) + 1;
    upgradeDeclarations.set(owner, declarations);
    if (declarations !== 1) {
      throw new Error('messageBus: an upgraded participant requires exactly one replacement target');
    }
    const stateSuffix = appendOnlyStateSuffix(
      descriptor.contract.inner.artifact,
      descriptor.upgradeTarget.artifact,
      descriptor.upgradeTarget.appendedState,
    );
    const replacement = new Contract(
      descriptor.upgradeTarget.artifact,
      [...descriptor.upgradeTarget.constructorArgs] as ConstructorArgument[],
      {
        provider,
        addressType: descriptor.contract.inner.addressType,
        category: hexToBin(descriptor.contract.categoryId),
      },
    );
    const outputLockingBytecode = replacement.lockingBytecode.toLowerCase();
    if (outputLockingBytecode === owner) {
      throw new Error('messageBus: an upgrade replacement must change the participant locking bytecode');
    }
    upgradeOutputs.set(owner, outputLockingBytecode);
    upgradeStateSuffixes.set(owner, stateSuffix);
  }
  return { upgradeOutputs, upgradeStateSuffixes };
}
