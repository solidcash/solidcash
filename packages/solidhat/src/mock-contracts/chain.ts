import { encodeP2pkhCashAddress } from '../cashaddr.js';
import {
  MockContractDefinition, MockContractModel, MockChainView, MockEmissionSink, MockEventEmission, MockRevert,
  MockReceipt,
} from './model.js';

/**
 * Deep-copy the values a model holds.
 *
 * `loadFixture` caches the objects a fixture returned and restores chain state between tests, so mock state has to be
 * restorable *in place*: the cached handles keep pointing at the same model instances, and a reset rewinds those
 * instances to the state they had when their deployment finished.
 */
function captureState(model: MockContractModel): Map<string, unknown> {
  const captured = new Map<string, unknown>();
  for (const [key, value] of Object.entries(model as unknown as Record<string, unknown>)) {
    captured.set(key, deepCopy(value));
  }
  return captured;
}

function deepCopy(value: unknown): unknown {
  if (value instanceof Map) {
    return new Map([...value.entries()].map(([entryKey, entryValue]) => [entryKey, deepCopy(entryValue)]));
  }
  if (value instanceof Set) return new Set([...value].map((entry) => deepCopy(entry)));
  if (Array.isArray(value)) return value.map((entry) => deepCopy(entry));
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (value !== null && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype === Object.prototype || prototype === null) {
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, deepCopy(entry)]));
    }
  }
  return value;
}

function restoreState(model: MockContractModel, snapshot: Map<string, unknown>): void {
  const target = model as unknown as Record<string, unknown>;
  for (const key of Object.keys(target)) {
    if (!snapshot.has(key) && key !== 'ctx') delete target[key];
  }
  for (const [key, value] of snapshot) target[key] = deepCopy(value);
}

/** A deployed mock contract. */
export interface MockDeployment {
  name: string;
  address: string;
  model: MockContractModel;
  definition: MockContractDefinition;
  /** Receipts produced by state-changing calls on this deployment, newest last. */
  receipts: MockReceipt[];
  /** State captured when the deployment finished, used by {@link MockChain.reset}. */
  initialState: Map<string, unknown>;
  /** ethers-style `addListener` subscriptions, keyed by event name. */
  listeners: Map<string, ((...args: unknown[]) => void)[]>;
}

export interface MockChainOptions {
  /** Reads the mock network clock in unix seconds. Defaults to a local clock advanced by {@link MockChain.advance}. */
  clock?: () => number;
  /** Builds the address for deployment `index` (0-based). */
  addressFor?: (name: string, index: number) => string;
}

/**
 * Deterministic, *valid* P2PKH CashAddress for a deployment. Validity matters: suites decode addresses, repack them
 * into event payloads, and compare them with signer addresses, so a placeholder string would fail far from its cause.
 */
const defaultAddress = (name: string, index: number): string => {
  const hash = new Uint8Array(20);
  const seed = `${name}#${index}`;
  for (let position = 0; position < seed.length; position += 1) {
    const slot = position % 20;
    hash[slot] = (hash[slot] * 31 + seed.charCodeAt(position)) % 256;
  }
  if (hash.every((byte) => byte === 0)) hash[0] = 1;
  return encodeP2pkhCashAddress(hash);
};

/**
 * Registry and dispatcher for mock contracts.
 *
 * A chain owns one deployment per contract name (enough for every suite that deploys a single instance of each
 * contract), a monotonic transaction counter, and the emission sink of the call currently in flight.
 */
export class MockChain implements MockChainView, MockEmissionSink {
  private readonly definitions = new Map<string, MockContractDefinition>();
  private readonly deployments = new Map<string, MockDeployment>();
  private readonly sinks: MockEventEmission[][] = [];
  private localClock = Math.floor(Date.now() / 1000);
  private counter = 0;

  constructor(private readonly options: MockChainOptions = {}) {}

  register(name: string, definition: MockContractDefinition): void {
    this.definitions.set(name, definition);
  }

  has(name: string): boolean {
    return this.definitions.has(name);
  }

  /** Contract names with a registered model. */
  names(): string[] {
    return [...this.definitions.keys()];
  }

  deployment(name: string): MockDeployment | undefined {
    return this.deployments.get(name);
  }

  deploymentsList(): MockDeployment[] {
    return [...this.deployments.values()];
  }

  /** Deploy (or replace) a contract and run its `initialize` method, mirroring `upgrades.deployProxy`. */
  deploy(name: string, args: readonly unknown[] = [], sender = 'system'): MockDeployment {
    const definition = this.definitions.get(name);
    if (!definition) throw new Error(`No mock contract registered for "${name}"`);
    for (const [existingName, deployment] of this.deployments) {
      if (deployment.address === this.addressFor(name, this.deployments.size)) this.deployments.delete(existingName);
    }
    const address = this.addressFor(name, this.deployments.size);
    const model = definition.create();
    const deployment: MockDeployment = {
      name, address, model, definition, receipts: [], initialState: new Map(), listeners: new Map(),
    };
    this.deployments.set(name, deployment);
    definition.setup?.(model, { args, address, chain: this });
    if (typeof (model as unknown as Record<string, unknown>).initialize === 'function') {
      this.invoke(deployment, 'initialize', args, sender);
    }
    deployment.initialState = captureState(model);
    return deployment;
  }

  /** Bind a model to an address that already exists (a pre-deployed singleton), without running an initializer. */
  attach(name: string, address: string): MockDeployment {
    const definition = this.definitions.get(name);
    if (!definition) throw new Error(`No mock contract registered for "${name}"`);
    const model = definition.create();
    const deployment: MockDeployment = {
      name, address, model, definition, receipts: [], initialState: new Map(), listeners: new Map(),
    };
    this.deployments.set(name, deployment);
    deployment.initialState = captureState(model);
    return deployment;
  }

  addressOf(name: string): string | undefined {
    return this.deployments.get(name)?.address;
  }

  model<T extends MockContractModel = MockContractModel>(name: string): T {
    const deployment = this.deployments.get(name);
    if (!deployment) throw new Error(`Mock contract "${name}" is not deployed`);
    return deployment.model as T;
  }

  now(): number {
    return this.options.clock ? this.options.clock() : this.localClock;
  }

  /** Advance the fallback clock; only used when the runtime has no network clock. */
  advance(seconds: number): void {
    this.localClock += seconds;
  }

  /** Register another chain's sink so nested calls land in the receipt of the outermost transaction. */
  pushSink(sink: MockEventEmission[]): void {
    this.sinks.push(sink);
  }

  popSink(): void {
    this.sinks.pop();
  }

  push(emission: MockEventEmission): void {
    for (const sink of this.sinks) sink.push(emission);
    this.notifyListeners(emission);
  }

  /**
   * Deliver an emission to `addListener` subscribers of the contract that produced it.
   *
   * Notifying here rather than in the transaction handle matters for composed calls: a nested contract's events are
   * emitted by the chain itself, so a listener registered on the callee would otherwise never see the events a
   * caller publishes through it.
   */
  private notifyListeners(emission: MockEventEmission): void {
    const deployment = [...this.deployments.values()].find((entry) => entry.address === emission.address);
    const listeners = deployment?.listeners.get(emission.event);
    if (!deployment || !listeners || listeners.length === 0) return;
    const parameters = (deployment.model.constructor as typeof MockContractModel).events[emission.event] ?? [];
    const args = parameters.length > 0
      ? parameters.map((parameter) => emission.args[parameter])
      : Object.values(emission.args);
    for (const listener of [...listeners]) listener(...args);
  }

  /** A throwaway model instance used for metadata (events, view methods) before any deployment. */
  preview(name: string): MockContractModel {
    const definition = this.definitions.get(name);
    if (!definition) throw new Error(`No mock contract registered for "${name}"`);
    return definition.create();
  }

  callOn<T = unknown>(name: string, method: string, args: readonly unknown[] = [], sender?: string): T {
    const deployment = this.deployments.get(name);
    if (!deployment) throw new Error(`Mock contract "${name}" is not deployed`);
    return this.invoke(deployment, method, args, sender ?? deployment.address).result as T;
  }

  /**
   * Run one method on a deployment. Emissions are collected into `emissions` and also forwarded to any enclosing
   * sink, so a nested call's events appear on the outer receipt the way a composed transaction reports them.
   */
  invoke(
    deployment: MockDeployment,
    method: string,
    args: readonly unknown[],
    sender: string,
    emissions: MockEventEmission[] = [],
  ): { result: unknown; emissions: MockEventEmission[] } {
    const model = deployment.model as unknown as Record<string, unknown>;
    const implementation = model[method];
    if (typeof implementation !== 'function') {
      throw new MockRevert(`Mock contract ${deployment.name} has no method "${method}"`);
    }
    const previousContext = deployment.model.ctx;
    deployment.model.ctx = {
      sender,
      address: deployment.address,
      contractName: deployment.name,
      chain: this,
      emit: (event, eventArgs): void => {
        // Push through the sink stack: the innermost receipt and every enclosing one receive the emission, so a
        // nested contract's events appear on the outer transaction the way a composed call reports them.
        this.push({ event, args: eventArgs, address: deployment.address });
      },
      revert: (reason: string): never => { throw new MockRevert(reason); },
      revertError: (errorName: string, errorArgs: readonly unknown[] = []): never => {
        const rendered = errorArgs.map((value) => String(value)).join(', ');
        throw new MockRevert(`reverted with custom error '${errorName}(${rendered})'`, errorName, errorArgs);
      },
    };
    this.sinks.push(emissions);
    try {
      const result = (implementation as (...callArgs: unknown[]) => unknown).apply(deployment.model, [...args]);
      return { result, emissions };
    } finally {
      this.sinks.pop();
      deployment.model.ctx = previousContext;
    }
  }

  /**
   * Capture every deployment's state so it can be restored later. `loadFixture` snapshots the chain once and rewinds
   * to that point before each test; mock contracts have to travel with that snapshot, otherwise state written by the
   * fixture itself (token approvals, registry setup) is lost while the cached contract objects stay in place.
   */
  captureSnapshot(): Map<string, { state: Map<string, unknown>; receipts: number }> {
    return new Map([...this.deployments.entries()].map(([name, deployment]) => [
      name,
      { state: captureState(deployment.model), receipts: deployment.receipts.length },
    ]));
  }

  /** Rewind to a snapshot taken by {@link MockChain.captureSnapshot}, keeping model instances identity-stable. */
  restoreSnapshot(snapshot: Map<string, { state: Map<string, unknown>; receipts: number }>): void {
    for (const [name, deployment] of [...this.deployments.entries()]) {
      const captured = snapshot.get(name);
      if (!captured) {
        this.deployments.delete(name);
        continue;
      }
      restoreState(deployment.model, captured.state);
      // Subscriptions belong to the test that registered them; a fixture rewind must not replay stale listeners.
      deployment.listeners.clear();
    }
  }

  /**
   * Rewind every deployment to the state it had when it finished deploying, keeping the registrations and the model
   * instances. Cached fixture objects therefore keep working, which is what `loadFixture` expects between tests.
   */
  reset(): void {
    for (const deployment of this.deployments.values()) {
      restoreState(deployment.model, deployment.initialState);
      deployment.receipts.length = 0;
    }
    this.sinks.length = 0;
    this.counter = 0;
  }

  /** Deterministic transaction id for the `counter`-th state change. */
  nextTxid(): string {
    this.counter += 1;
    const seed = this.counter.toString(16).padStart(8, '0');
    return `0x${seed.repeat(8)}`;
  }

  private addressFor(name: string, index: number): string {
    return this.options.addressFor ? this.options.addressFor(name, index) : defaultAddress(name, index);
  }
}
