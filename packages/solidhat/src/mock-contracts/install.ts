/**
 * Install local mock contracts in place of compiled artifacts.
 *
 * The installer swaps the three entry points a Hardhat/ethers suite uses to obtain a contract — `getContractFactory`,
 * `getContractAt`, and the OpenZeppelin-style `upgrades.deployProxy` — for factories backed by the registered models.
 * Anything not registered is refused loudly instead of silently falling back to a compiled covenant, so a suite that
 * passes here cannot be passing because part of it was still executing on chain.
 */
import { MockChain, type MockChainOptions } from './chain.js';
import {
  createMockFactory, createMockHandle, resolveSender, type MockContractFactory, type MockContractHandle,
} from './handle.js';
import type { MockContractDefinition } from './model.js';

interface EthersHost {
  getContractFactory?: (...args: unknown[]) => unknown;
  getContractAt?: (...args: unknown[]) => unknown;
  [key: string]: unknown;
}

export interface MockContractsHost {
  ethers?: EthersHost;
  [key: string]: unknown;
}

export interface InstallMockContractsOptions extends MockChainOptions {
  /** Contract name to model definition. */
  contracts: Record<string, MockContractDefinition>;
  /**
   * The OpenZeppelin-style `upgrades` object the suite itself imports. It has to be the caller's instance: the
   * same module can be reachable through more than one path, and patching a different copy would silently leave
   * `deployProxy` executing the real artifact-backed implementation.
   */
  upgrades?: { deployProxy?: (...args: unknown[]) => unknown; [key: string]: unknown };
  /**
   * Address `getContractFactory`/`deployProxy` should act as when the suite does not name a signer, matching
   * Hardhat's default (the first configured account). Deployment owner checks depend on it.
   */
  defaultSender?: () => string | undefined;
  /**
   * Fall back to the artifact-backed factory for names without a model. Off by default: a hermetic suite should not
   * quietly execute a compiled contract for a name nobody mocked.
   */
  fallbackToArtifacts?: boolean;
}

export interface MockContractsInstallation {
  readonly chain: MockChain;
  /** Handle for a deployed contract, by name. */
  contract(name: string): MockContractHandle;
  /** Address to deployment lookup, as `getContractAt` performs it. */
  handleAt(address: string): MockContractHandle | undefined;
  /** Drop every deployment and receipt, keeping the registrations. */
  reset(): void;
  /** Restore the original contract entry points. */
  restore(): void;
}

/**
 * Replace the contract entry points on `host` with model-backed ones.
 *
 * @throws when `host.ethers` is missing, because a silent no-op would let a suite appear mocked while still
 * compiling and executing real contracts.
 */
export function installMockContracts(
  host: MockContractsHost,
  options: InstallMockContractsOptions,
): MockContractsInstallation {
  const ethers = host.ethers;
  if (!ethers || typeof ethers.getContractFactory !== 'function') {
    throw new Error('installMockContracts requires an HRE with `ethers.getContractFactory`');
  }
  const providerClock = (ethers as { provider?: { getBlockTime?: () => number } }).provider;
  const chain = new MockChain({
    // Read the chain clock the suite advances with `time.increase`/`evm_increaseTime`; a private counter would
    // freeze every deadline and challenge window at deployment time.
    clock: providerClock && typeof providerClock.getBlockTime === 'function'
      ? () => providerClock.getBlockTime?.() ?? Math.floor(Date.now() / 1000)
      : options.clock,
    addressFor: options.addressFor,
  });
  for (const [name, definition] of Object.entries(options.contracts)) chain.register(name, definition);

  const originalFactory = ethers.getContractFactory;
  const originalAt = ethers.getContractAt;
  const upgradesModule = options.upgrades;
  const originalDeployProxy = upgradesModule?.deployProxy;

  const isMockFactory = (value: unknown): value is MockContractFactory =>
    typeof value === 'object' && value !== null && typeof (value as MockContractFactory).mockContractName === 'string';

  const defaultSender = (): string | undefined => options.defaultSender?.();
  const factoryFor = (name: string, sender?: string): MockContractFactory =>
    createMockFactory(chain, name, sender ?? defaultSender());

  const guardedFactory = (...args: unknown[]): unknown => {
    const name = String(args[0]);
    const signer = resolveSender(args[1]);
    if (chain.has(name)) return factoryFor(name, signer);
    if (options.fallbackToArtifacts === true) return (originalFactory as (...a: unknown[]) => unknown)(...args);
    throw new Error(
      `No mock contract registered for "${name}". Register it in installMockContracts, or set `
      + 'fallbackToArtifacts to execute the compiled artifact instead.',
    );
  };

  const guardedAt = (...args: unknown[]): unknown => {
    const name = String(args[0]);
    const address = args[1] === undefined ? undefined : String(args[1]);
    if (chain.has(name)) {
      const deployment = address ? chain.deploymentsList().find((entry) => entry.address === address) : undefined;
      // A mock suite may talk to a contract it did not deploy (a pre-existing singleton), so bind the model to the
      // requested address instead of insisting on a deployment this chain performed.
      const resolved = deployment ?? chain.deployment(name) ?? (address ? chain.attach(name, address) : undefined);
      if (!resolved) throw new Error(`Mock contract "${name}" has not been deployed yet`);
      return createMockHandle(chain, resolved, defaultSender());
    }
    if (options.fallbackToArtifacts === true) return (originalAt as (...a: unknown[]) => unknown)(...args);
    throw new Error(`No mock contract registered for "${name}"`);
  };

  const guardedDeployProxy = async (...callArgs: unknown[]): Promise<unknown> => {
    const [factory, args = [], optionsArg] = callArgs as [unknown, unknown[]?, unknown?];
    if (isMockFactory(factory)) {
      const deployment = chain.deploy(factory.mockContractName, args, defaultSender() ?? 'system');
      return createMockHandle(chain, deployment, defaultSender());
    }
    if (typeof originalDeployProxy === 'function') return originalDeployProxy(factory, args, optionsArg);
    throw new Error('upgrades.deployProxy is unavailable and the factory is not a mock factory');
  };

  // Snapshot-aware provider: `loadFixture` rewinds the chain between tests, so mock state must rewind with it.
  const provider = (ethers as { provider?: Record<string, unknown> }).provider as {
    takeSnapshot?: () => Promise<{ restore: () => Promise<void> | void }>;
  } | undefined;
  const originalTakeSnapshot = provider?.takeSnapshot?.bind(provider);
  if (provider && originalTakeSnapshot) {
    provider.takeSnapshot = async (): Promise<{ restore: () => Promise<void> }> => {
      const restorer = await originalTakeSnapshot();
      const snapshot = chain.captureSnapshot();
      const originalRestore = restorer.restore.bind(restorer);
      return {
        ...restorer,
        restore: async (): Promise<void> => {
          await originalRestore();
          chain.restoreSnapshot(snapshot);
        },
      };
    };
  }

  ethers.getContractFactory = guardedFactory;
  ethers.getContractAt = guardedAt;
  if (upgradesModule) upgradesModule.deployProxy = guardedDeployProxy as unknown as (...args: unknown[]) => unknown;

  const handleAt = (address: string): MockContractHandle | undefined => {
    const deployment = chain.deploymentsList().find((entry) => entry.address === address);
    return deployment ? createMockHandle(chain, deployment) : undefined;
  };

  return {
    chain,
    contract: (name: string): MockContractHandle => {
      const deployment = chain.deployment(name);
      if (!deployment) throw new Error(`Mock contract "${name}" has not been deployed yet`);
      return createMockHandle(chain, deployment);
    },
    handleAt,
    reset: (): void => { chain.reset(); },
    restore: (): void => {
      ethers.getContractFactory = originalFactory;
      ethers.getContractAt = originalAt;
      if (upgradesModule) upgradesModule.deployProxy = originalDeployProxy;
      if (provider && originalTakeSnapshot) provider.takeSnapshot = originalTakeSnapshot;
    },
  };
}
