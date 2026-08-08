import type NetworkProvider from '../network/NetworkProvider.js';

export interface RegisteredDeployment {
  contractName: string;
  address: string;
  lockingBytecode?: string;
  contract: unknown;
}

const deployments = new WeakMap<NetworkProvider, RegisteredDeployment[]>();

export interface DeploymentRegistrySnapshot { restore(): void }

/** Capture process-local registrations alongside a mock-chain fixture snapshot. */
export function takeDeploymentRegistrySnapshot(provider: NetworkProvider): DeploymentRegistrySnapshot {
  const snapshot = [...(deployments.get(provider) ?? [])];
  return { restore: () => deployments.set(provider, [...snapshot]) };
}

/** Record contracts created by the Hardhat-compatible factory on this provider. */
export function registerDeployment(
  provider: NetworkProvider, deployment: RegisteredDeployment,
): void {
  const current = deployments.get(provider) ?? [];
  const withoutOldAddress = current.filter((entry) => entry.address !== deployment.address);
  withoutOldAddress.push(deployment);
  deployments.set(provider, withoutOldAddress);
}

/** Resolve the most recently deployed instance compatible with an interface name. */
export function findDeploymentByName(
  provider: NetworkProvider, contractName: string,
): RegisteredDeployment | undefined {
  const current = deployments.get(provider) ?? [];
  for (let index = current.length - 1; index >= 0; index--) {
    if (current[index].contractName === contractName) return current[index];
  }
  return undefined;
}

export function findDeploymentByAddress(
  provider: NetworkProvider, address: string,
): RegisteredDeployment | undefined {
  const current = deployments.get(provider) ?? [];
  for (let index = current.length - 1; index >= 0; index--) {
    if (current[index].address === address) return current[index];
  }
  return undefined;
}

export function findDeploymentByLockingBytecode(
  provider: NetworkProvider, lockingBytecode: string,
): RegisteredDeployment | undefined {
  const current = deployments.get(provider) ?? [];
  for (let index = current.length - 1; index >= 0; index--) {
    if (current[index].lockingBytecode === lockingBytecode) return current[index];
  }
  return undefined;
}
