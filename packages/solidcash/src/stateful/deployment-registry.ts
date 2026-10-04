import { binToHex, hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import type NetworkProvider from '../network/NetworkProvider.js';
import { addressToLockScript, lockingBytecodeToSolidityAddressPayload } from '../utils.js';

export interface RegisteredDeployment {
  contractName: string;
  address: string;
  lockingBytecode?: string;
  contract: unknown;
}

/** Exact covenant bytecode which executes calls made by a registered deployment. */
export function registeredExecutionLockingBytecode(
  deployment: RegisteredDeployment,
): string | undefined {
  const registered = deployment.contract as {
    implementation?: { inner?: { lockingBytecode?: string } };
    inner?: { lockingBytecode?: string };
  };
  return registered.implementation?.inner?.lockingBytecode
    ?? registered.inner?.lockingBytecode
    ?? deployment.lockingBytecode;
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

/** Resolve the most recent registered state owner for one token category. */
export function findDeploymentByCategory(
  provider: NetworkProvider, categoryId: string,
): RegisteredDeployment | undefined {
  const current = deployments.get(provider) ?? [];
  const wanted = categoryId.replace(/^0x/, '').toLowerCase();
  for (let index = current.length - 1; index >= 0; index--) {
    const registered = current[index].contract as {
      categoryId?: string;
      proxy?: { categoryId?: string };
    };
    const candidate = registered.proxy?.categoryId ?? registered.categoryId;
    if (candidate?.replace(/^0x/, '').toLowerCase() === wanted) return current[index];
  }
  return undefined;
}

function findDeploymentByExactAddress(
  provider: NetworkProvider, address: string,
): RegisteredDeployment | undefined {
  const current = deployments.get(provider) ?? [];
  const addr = String(address ?? '');
  for (let index = current.length - 1; index >= 0; index--) {
    if (current[index].address === addr) return current[index];
  }
  // Token-aware and non-token cashaddrs share a lock script; string equality misses that pair.
  try {
    const wanted = binToHex(addressToLockScript(addr));
    for (let index = current.length - 1; index >= 0; index--) {
      const registered = current[index].address ?? '';
      try {
        if (binToHex(addressToLockScript(registered)) === wanted) return current[index];
      } catch { /* not a cashaddr */ }
    }
  } catch { /* not a canonical cashaddr */ }
  return undefined;
}

export function findDeploymentByAddress(
  provider: NetworkProvider, address: string,
): RegisteredDeployment | undefined {
  const exact = findDeploymentByExactAddress(provider, address);
  if (exact) return exact;
  const current = deployments.get(provider) ?? [];
  const addr = String(address ?? '');
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

/**
 * Resolve a registered Solidity-facing address to the physical locking bytecode held by the deployment.
 *
 * This explicitly selects the execution identity, including for routes which expose an authenticated public
 * SCID as `address(this)` / `msg.sender`. Use registeredValueAddressLockingBytecode when persisting a peer's
 * language-level address. Unresolved EOAs and forward references remain the caller's responsibility.
 */
export function registeredPhysicalLockingBytecode(
  provider: NetworkProvider,
  address: string,
): Uint8Array | undefined {
  const physical = findDeploymentByAddress(provider, address)?.lockingBytecode;
  return physical ? hexToBin(physical) : undefined;
}

/** Address value observed when a registered contract identifies itself or calls another contract. */
export function registeredValueAddressLockingBytecode(
  provider: NetworkProvider,
  address: string,
): Uint8Array | undefined {
  const deployment = findDeploymentByAddress(provider, address);
  if (!deployment) return undefined;
  const contract = deployment.contract as {
    inner?: { artifact?: Artifact };
    implementation?: { inner?: { artifact?: Artifact } };
  };
  const artifact = contract.implementation?.inner?.artifact ?? contract.inner?.artifact;
  const authenticatesPublicSelf = artifact?.messageBus?.route?.inputs
    .some((input) => input.name === '__internal__graphSelfIdentityInput') === true;
  // New kernel routes prove their public SCID on-chain. Persisting the physical execution address instead
  // would make an otherwise identical CREATE reference depend on whether its deployment was already known.
  if (authenticatesPublicSelf) return addressToLockScript(deployment.address);
  return deployment.lockingBytecode ? hexToBin(deployment.lockingBytecode) : undefined;
}

/** All deployments for a provider (most recent last). */
export function listDeployments(provider: NetworkProvider): readonly RegisteredDeployment[] {
  return deployments.get(provider) ?? [];
}

export function findDeploymentByLockingBytecode(
  provider: NetworkProvider, lockingBytecode: string,
): RegisteredDeployment | undefined {
  const current = deployments.get(provider) ?? [];
  const wanted = lockingBytecode.replace(/^0x/, '').toLowerCase();
  for (let index = current.length - 1; index >= 0; index--) {
    if (registeredExecutionLockingBytecode(current[index])?.replace(/^0x/, '').toLowerCase() === wanted) {
      return current[index];
    }
    if (current[index].lockingBytecode?.replace(/^0x/, '').toLowerCase() === wanted) {
      return current[index];
    }
    // Stateful registrations may use a physical covenant bytecode internally while exposing a stable logical
    // address to other contracts. Resolve either identity through this bytecode-oriented API so every external
    // call path follows the same registry semantics.
    try {
      if (binToHex(addressToLockScript(current[index].address)) === wanted) return current[index];
    } catch { /* the registered address is not a cashaddr */ }
  }
  return undefined;
}

/**
 * Resolve the canonical 20-byte address carried by imported-Solidity ABI values.
 *
 * This is intentionally separate from `findDeploymentByLockingBytecode`: a 20-byte Solidity identity is not a
 * Bitcoin Cash locking bytecode. More than one matching deployment is ambiguous and therefore unresolved.
 */
export function findDeploymentBySolidityAddressPayload(
  provider: NetworkProvider, payload: Uint8Array,
): RegisteredDeployment | undefined {
  if (payload.length !== 20) return undefined;
  const wanted = binToHex(payload);
  const current = deployments.get(provider) ?? [];
  const matches = current.filter((deployment) => {
    const candidates = new Set<string | undefined>([
      registeredExecutionLockingBytecode(deployment), deployment.lockingBytecode,
    ]);
    try { candidates.add(binToHex(addressToLockScript(deployment.address))); } catch { /* not a cashaddr */ }
    return [...candidates].some((candidate) => {
      if (!candidate) return false;
      let bytecode: Uint8Array;
      try { bytecode = hexToBin(candidate.replace(/^0x/, '')); } catch { return false; }
      const narrowed = lockingBytecodeToSolidityAddressPayload(bytecode);
      return narrowed !== undefined && binToHex(narrowed) === wanted;
    });
  });
  return matches.length === 1 ? matches[0] : undefined;
}

/** Resolve a compiler-typed address value, preserving exact BCH identities before Solidity ABI projection. */
export function findDeploymentByAddressValue(
  provider: NetworkProvider, value: string | Uint8Array,
): RegisteredDeployment | undefined {
  const exact = typeof value === 'string'
    ? findDeploymentByExactAddress(provider, value) ?? findDeploymentByLockingBytecode(provider, value)
    : findDeploymentByLockingBytecode(provider, binToHex(value));
  if (exact) return exact;
  const payload = typedSolidityAddressPayload(value);
  return payload && findDeploymentBySolidityAddressPayload(provider, payload);
}

/** Only a typed address may interpret a canonical ABI word as its right-aligned 20-byte identity. */
function typedSolidityAddressPayload(value: string | Uint8Array): Uint8Array | undefined {
  const bytes = value instanceof Uint8Array ? value
    : /^(?:0x)?(?:[0-9a-f]{40}|[0-9a-f]{64})$/iu.test(value)
      ? hexToBin(value.replace(/^0x/iu, '')) : undefined;
  if (bytes?.length === 20) return bytes;
  if (bytes?.length === 32 && bytes.subarray(0, 12).every((byte) => byte === 0)) return bytes.subarray(12);
  return undefined;
}

/** Recover the exact registered native address which projects to a typed Solidity identity. */
export function registeredAddressValueLockingBytecode(
  provider: NetworkProvider, value: string | Uint8Array,
): Uint8Array | undefined {
  const deployment = findDeploymentByAddressValue(provider, value);
  if (!deployment) return undefined;
  const payload = typedSolidityAddressPayload(value);
  if (!payload) {
    if (value instanceof Uint8Array) return value;
    try { return addressToLockScript(value); } catch { return hexToBin(value.replace(/^0x/iu, '')); }
  }
  const candidates = new Set([deployment.lockingBytecode, registeredExecutionLockingBytecode(deployment)]);
  try { candidates.add(binToHex(addressToLockScript(deployment.address))); } catch { /* not a cashaddr */ }
  const wanted = binToHex(payload);
  for (const candidate of candidates) {
    if (!candidate) continue;
    const bytes = hexToBin(candidate.replace(/^0x/iu, ''));
    const identity = lockingBytecodeToSolidityAddressPayload(bytes);
    if (identity && binToHex(identity) === wanted) return bytes;
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
