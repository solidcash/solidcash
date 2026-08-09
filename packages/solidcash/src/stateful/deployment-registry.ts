import type NetworkProvider from '../network/NetworkProvider.js';

export interface RegisteredDeployment {
  contractName: string;
  address: string;
  lockingBytecode?: string;
  contract: unknown;
}

const deployments = new WeakMap<NetworkProvider, RegisteredDeployment[]>();

/** A repeatable snapshot of the Hardhat-compatible deployment registry. */
export interface DeploymentRegistrySnapshot {
  restore(): void;
}

/**
 * Capture registrations associated with a provider. Mock-chain snapshots only rewind UTXOs; test fixtures
 * also need this process-local lookup table rewound so address/interface resolution cannot leak across tests.
 */
export function takeDeploymentRegistrySnapshot(provider: NetworkProvider): DeploymentRegistrySnapshot {
  const snapshot = [...(deployments.get(provider) ?? [])];
  return {
    restore: () => deployments.set(provider, [...snapshot]),
  };
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

/** Drop all registrations for a provider (call after MockNetworkProvider.reset between tests). */
export function clearDeployments(provider: NetworkProvider): void {
  deployments.delete(provider);
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
  const addr = String(address ?? '');
  for (let index = current.length - 1; index >= 0; index--) {
    if (current[index].address === addr) return current[index];
  }
  // Fuzzy: cashaddr prefix variants / trailing payload match (MistSwap MasterChef lp.address forms).
  if (addr.length > 12) {
    const tail = addr.slice(-20);
    for (let index = current.length - 1; index >= 0; index--) {
      const a = current[index].address ?? '';
      if (a.endsWith(tail) || addr.endsWith(a.slice(-20)) || a.includes(tail) || addr.includes(a.slice(-20))) {
        return current[index];
      }
    }
  }
  return undefined;
}

/** All deployments for a provider (most recent last). */
export function listDeployments(provider: NetworkProvider): readonly RegisteredDeployment[] {
  return deployments.get(provider) ?? [];
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

/**
 * Find the most recently deployed contract whose ABI exposes `functionName`.
 * Used when an external call is typed as an interface (e.g. IERC20.balanceOf) but
 * Hardhat suites only registered the concrete mock (ERC20Mock) under its own name.
 */
export function findDeploymentImplementing(
  provider: NetworkProvider, functionName: string,
): RegisteredDeployment | undefined {
  const current = deployments.get(provider) ?? [];
  for (let index = current.length - 1; index >= 0; index--) {
    const entry = current[index];
    const artifact = (entry.contract as { inner?: { artifact?: { abi?: readonly { name?: string }[] } } })
      ?.inner?.artifact;
    if (artifact?.abi?.some((fn) => fn.name === functionName)) return entry;
  }
  return undefined;
}
