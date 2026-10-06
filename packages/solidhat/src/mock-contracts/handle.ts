import { MockChain, type MockDeployment } from './chain.js';
import { MockContractModel, type MockEventEmission, type MockReceipt, MockRevert } from './model.js';

/** Event/parameter metadata exposed the way the chai matchers read a contract artifact. */
export interface MockArtifact {
  contractName: string;
  abi: readonly unknown[];
  events: readonly { name: string; parameters: readonly { name: string }[]; inputs: readonly { name: string }[] }[];
}

export interface MockContractHandle {
  readonly target: string;
  readonly address: string;
  readonly artifact: MockArtifact;
  getAddress(): Promise<string>;
  waitForDeployment(): Promise<MockContractHandle>;
  connect(signer: unknown): MockContractHandle;
  queryFilter(filter?: unknown, fromBlock?: unknown, toBlock?: unknown): Promise<MockEventEmission[]>;
  /** Subscribe to an event; listeners fire for transactions that follow, like ethers' `on`/`addListener`. */
  addListener(event: string, listener: (...args: unknown[]) => void): MockContractHandle;
  on(event: string, listener: (...args: unknown[]) => void): MockContractHandle;
  removeListener(event: string, listener: (...args: unknown[]) => void): MockContractHandle;
  off(event: string, listener: (...args: unknown[]) => void): MockContractHandle;
  [method: string]: unknown;
}

/** Resolve a caller from whatever `.connect(...)` received: a signer, an address, or a contract handle. */
export function resolveSender(signer: unknown): string | undefined {
  if (signer === undefined || signer === null) return undefined;
  if (typeof signer === 'string') return signer;
  if (typeof signer === 'object') {
    const record = signer as { address?: unknown; target?: unknown; getAddress?: () => unknown };
    if (typeof record.address === 'string') return record.address;
    if (typeof record.target === 'string') return record.target;
  }
  return undefined;
}

const eventNames = (model: MockContractModel): string[] => {
  const definition = model.constructor as typeof MockContractModel;
  return Object.keys(definition.events ?? {});
};

/** Build the artifact the chai `emit` matcher reads for positional `.withArgs(...)`. */
function buildArtifact(name: string, model: MockContractModel): MockArtifact {
  const definition = model.constructor as typeof MockContractModel;
  const events = Object.entries(definition.events ?? {}).map(([eventName, parameters]) => ({
    name: eventName,
    parameters: parameters.map((parameter) => ({ name: parameter })),
    inputs: parameters.map((parameter) => ({ name: parameter })),
  }));
  return { contractName: name, abi: [], events };
}

const receiptFor = (txid: string, emissions: MockEventEmission[]): MockReceipt => {
  const receipt = {
    txid,
    status: 1,
    events: emissions,
    wait: async (): Promise<MockReceipt> => receipt,
  };
  return receipt;
};

const revertError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

/**
 * Create an ethers-shaped handle for a mock deployment.
 *
 * Read-only methods answer with a promise of the model's return value; state-changing methods answer with a promise
 * of a decoded receipt. Both reject with the revert reason instead of throwing synchronously, so
 * `expect(contract.method(...)).to.be.revertedWith(...)` observes the failure the same way it does for a real call.
 */
export function createMockHandle(chain: MockChain, deployment: MockDeployment, sender?: string): MockContractHandle {
  const model = deployment.model;
  const definition = model.constructor as typeof MockContractModel;
  const views = new Set(definition.viewMethods ?? []);
  const methodNames = new Set<string>();
  for (let prototype = model; prototype; prototype = Object.getPrototypeOf(prototype) as MockContractModel) {
    for (const key of Object.getOwnPropertyNames(prototype)) {
      if (key === 'constructor' || key === 'ctx' || key.startsWith('_')) continue;
      if (typeof (model as unknown as Record<string, unknown>)[key] === 'function') methodNames.add(key);
    }
  }

  const emissions: MockEventEmission[] = [];
  const subscribe = (event: string, listener: (...args: unknown[]) => void): MockContractHandle => {
    const registered = deployment.listeners.get(event) ?? [];
    registered.push(listener);
    deployment.listeners.set(event, registered);
    return handle as unknown as MockContractHandle;
  };
  const unsubscribe = (event: string, listener: (...args: unknown[]) => void): MockContractHandle => {
    const registered = deployment.listeners.get(event) ?? [];
    deployment.listeners.set(event, registered.filter((entry) => entry !== listener));
    return handle as unknown as MockContractHandle;
  };
  const handle: Record<string, unknown> = {
    target: deployment.address,
    address: deployment.address,
    artifact: buildArtifact(deployment.name, model),
    getAddress: async (): Promise<string> => deployment.address,
    addListener: subscribe,
    on: subscribe,
    removeListener: unsubscribe,
    off: unsubscribe,
    waitForDeployment: async (): Promise<MockContractHandle> => handle as unknown as MockContractHandle,
    connect: (signer: unknown): MockContractHandle =>
      createMockHandle(chain, deployment, resolveSender(signer) ?? sender),
    queryFilter: async (filter?: unknown): Promise<MockEventEmission[]> => {
      const queried = deployment.receipts.flatMap((receipt) => receipt.events);
      const wanted = typeof filter === 'object' && filter !== null
        ? (filter as { name?: unknown; fragment?: { name?: unknown } })
        : undefined;
      const eventName = typeof filter === 'string'
        ? filter
        : (wanted?.name ?? wanted?.fragment?.name) as string | undefined;
      return eventName ? queried.filter((emission) => emission.event === eventName) : queried;
    },
  };

  for (const method of methodNames) {
    if (method in handle) continue;
    handle[method] = (...args: unknown[]): unknown => {
      const callEmissions: MockEventEmission[] = [];
      const caller = sender ?? deployment.address;
      if (views.has(method)) {
        try {
          const { result } = chain.invoke(deployment, method, args, caller, callEmissions);
          return Promise.resolve(result);
        } catch (error) {
          return Promise.reject(revertError(error));
        }
      }
      try {
        const { emissions: produced } = chain.invoke(deployment, method, args, caller, callEmissions);
        const receipt = receiptFor(chain.nextTxid(), produced);
        deployment.receipts.push(receipt);
        emissions.push(...produced);
        return Promise.resolve(receipt);
      } catch (error) {
        return Promise.reject(revertError(error));
      }
    };
  }

  return handle as unknown as MockContractHandle;
}

/** `ethers.getContractFactory(name)` replacement bound to one contract model. */
export interface MockContractFactory {
  readonly mockContractName: string;
  readonly artifact: MockArtifact;
  deploy(...args: unknown[]): Promise<MockContractHandle>;
  connect(signer: unknown): MockContractFactory;
}

/**
 * Build a factory for a contract model. The factory performs no deployment: `upgrades.deployProxy`, the suite's
 * usual entry point, decides when the contract is created and with which initializer arguments.
 */
export function createMockFactory(chain: MockChain, name: string, sender?: string): MockContractFactory {
  const artifact = buildArtifact(name, chain.preview(name));
  return {
    mockContractName: name,
    artifact,
    deploy: async (...args: unknown[]): Promise<MockContractHandle> => {
      const deployment = chain.deploy(name, args, sender ?? 'system');
      return createMockHandle(chain, deployment, sender);
    },
    connect: (signer: unknown): MockContractFactory =>
      createMockFactory(chain, name, resolveSender(signer) ?? sender),
  };
}

/** Names of the events a model declares; used for diagnostics and `queryFilter` defaults. */
export const declaredEvents = eventNames;

export { MockRevert };
