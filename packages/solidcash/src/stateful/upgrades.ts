import { lockingBytecodeToCashAddress } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  type Artifact, type AbiFunction, asmToBytecode, attachDecodedAccessors, buildEventNftCovenantScript,
  computeEventNameHash, hasDataNftIndexTags,
} from '@solidcash/utils';
import {
  ContractFactory, type DeployedContract, type DeployContractOptions, selectGenesisFundingUtxo,
} from './ContractFactory.js';
import type {
  FramedProxyCallerFunding, FramedProxyDeployHalf, FramedProxyDeployment,
} from '../framed/proxy/deploy.js';
import {
  StatefulContract, StatefulFunctionCall, type ContractRunner, type ConnectedStatefulContract,
  type ContractEventName, type EventListener,
  type EventLog, type StatefulContractEvent,
} from './StatefulContract.js';
import Signer from '../Signer.js';
import SignatureTemplate from '../SignatureTemplate.js';
import type { ConstructorArgument, FunctionArgument } from '../Argument.js';
import { addressToLockScript, getNetworkPrefix, scriptToLockingBytecode } from '../utils.js';
import { defaultProxyArtifact } from './defaultProxyArtifact.js';
import { SplitContract, SplitContractBundle } from './SplitContractBundle.js';
import { deriveLogicalCreateAddress } from './logical-identity.js';
import {
  findDeploymentByAddressValue, findDeploymentBySolidityAddressPayload, registerDeployment,
  registeredValueAddressLockingBytecode,
} from './deployment-registry.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { proxySyntheticPaginationCollection } from './proxy-pagination.js';
import { decorateFunctionResult, decorateStateAccessorResult } from './public-result.js';
import { artifactUsesSolidityAbi } from './solidityAbi.js';

// OpenZeppelin-hardhat-upgrades-style `upgrades.deployProxy` for stateful contracts. Unlike EVM's generic proxy
// bytecode, on BCH the proxy and implementation are separate on-chain contracts with a compatible state layout;
// the built-in SolidCashProxy sidesteps that (its bytecode is layout-independent). See docs/upgrades.md.

// The proxy forwarder's calling convention, detected from its ABI:
//   'baked'    - f(bytes input): impl is a baked constructor arg (the default proxy)
//   'param'    - f(bytes input, address impl, ...auth): impl is a call param (custom proxy)
//   'fallback' - __fallback(): impl auto-derived from the co-spend
type ForwardMode = 'baked' | 'param' | 'fallback';

interface ForwardShape {
  name: string;
  mode: ForwardMode;
}

// Event metadata belongs to the implementation, while event UTXOs belong to the proxy category. Keep a shared,
// read-only facade per state holder rather than mutating the operational proxy artifact (which would also change
// delegate transaction planning). Connected ProxyContract handles therefore observe the same subscriptions.
const proxyEventFacades = new WeakMap<object, StatefulContract>();

/**
 * Extra CREATE2 salt bytes the default mock proxy carries as a BCH-2026 density reserve.
 * Proxy unlocks are tiny (~260 bytes) while a delegate setter still runs its full body against
 * that input's budget (`operationCostBudgetPerByte * densityControlLength`). Size the reserve
 * from the largest non-route function body so admin calls clear the mock 10_000/byte budget.
 */
export function mockProxyDensityReserveBytes(
  maximumInputBytes: number | undefined,
  implArtifact?: {
    functionBodies?: Record<string, string>;
    messageBus?: { selector?: string };
  },
): number {
  if ((maximumInputBytes ?? 10_000) <= 10_000) return 0;
  let hasAdminBody = false;
  const routeSelector = implArtifact?.messageBus?.selector;
  for (const [selector, body] of Object.entries(implArtifact?.functionBodies ?? {})) {
    if (selector === routeSelector || selector === '53434231') continue;
    if (typeof body !== 'string') continue;
    const bytes = body.length / 2;
    if (bytes > 16_000) continue;
    if (bytes > 1_000) hasAdminBody = true;
  }
  // CREATE2 salt cap. A 10KB Marketplace setter through the default proxy costs
  // ~7.6M ops; 520 reserved bytes yields ~9.3M budget at 10_000/byte.
  return hasAdminBody || !implArtifact?.functionBodies ? 520 : 96;
}

export interface DeployProxyOptions {
  // OZ-style initializer. Default auto-detects an `initialize` delegate function and runs it with the init args
  // through the proxy; `false` seeds state at genesis instead; a string names a different initializer.
  initializer?: string | false;
  // Constructor arguments for the separately deployed implementation. Its own state is not proxy state,
  // but a source contract with a required constructor must still be deployed with valid arguments.
  implementationConstructorArgs?: readonly ConstructorArgument[];
  // A custom proxy contract artifact. Omit to use the built-in layout-independent `SolidCashProxy` (recommended).
  proxy?: Artifact;
  // Runner (Signer or NetworkProvider) to deploy + sign with. Defaults to the implementation factory's runner.
  runner?: ContractRunner;
  // A custom proxy's forwarding function name. Auto-detected ('f(bytes,address,...)' then '__fallback') if omitted.
  forwardFunction?: string;
  // Build a 'param'-mode forwarder's trailing auth args from the connected signer. Default: [pubkey, sigTemplate].
  auth?: (signer: Signer) => FunctionArgument[];
  // Deploy overrides for the proxy genesis / the implementation genesis (funding, fee, addressType, ...).
  proxyOverrides?: DeployContractOptions;
  implementationOverrides?: DeployContractOptions;
  /**
   * Framed only: `'hop'` runs the initializer as a separate hop after the proxy's genesis, the one way an initializer
   * that calls another contract runs; the proxy is uninitialized on chain until that hop confirms. The default mints
   * the proxy's genesis already initialized.
   */
  initializeAs?: 'genesis' | 'hop';
  /**
   * The coin a separate framed `initialize` hop (`initializeAs: 'hop'`) enters with, or absent to take the runner's
   * own largest tokenless UTXO. A hop's root frame binds `msg.sender` to the lock of the input it names, so the coin
   * has to sit at the deployer's own P2PKH lock.
   */
  callerFunding?: FramedProxyCallerFunding;
}

/** OZ `upgrades.deployProxy` initial state: a positional initializer list or a named state record. */
export type ProxyInitialState = readonly unknown[] | Record<string, unknown>;

function defaultAuth(signer: Signer): FunctionArgument[] {
  return [signer.publicKey, new SignatureTemplate(signer.privateKey)];
}

// Map an OZ-style positional initializer list to the implementation's declared state variables; a record is used
// as-is (it already names the proxy state fields).
function toInitialState(initialState: ProxyInitialState | undefined, impl: Artifact): Record<string, unknown> | undefined {
  if (!initialState) return undefined;
  if (!Array.isArray(initialState)) return initialState as Record<string, unknown>;
  const vars = impl.stateLayout?.variables ?? [];
  const out: Record<string, unknown> = {};
  initialState.forEach((value, i) => { if (vars[i]) out[vars[i].name] = value; });
  return out;
}

/** Resolve registered contract references in typed proxy state before encoding the genesis commitment. */
function normalizeInitialStateAddresses(
  initialState: Record<string, unknown> | undefined, impl: Artifact, provider: NetworkProvider,
): Record<string, unknown> | undefined {
  if (!initialState) return undefined;
  const normalized = { ...initialState };
  for (const variable of impl.stateLayout?.variables ?? []) {
    const value = normalized[variable.name];
    if ((variable.type === 'address' || variable.type === 'address payable') && typeof value === 'string') {
      normalized[variable.name] = registeredValueAddressLockingBytecode(provider, value) ?? value;
    }
  }
  return normalized;
}

// Executing an entire very-large delegate artifact merely to apply a conventional OZ initializer can overwhelm
// a JavaScript VM even when a private mock network intentionally relaxes BCH's script limits. For that test-only
// case, derive the initializer's direct assignments from its ABI names and seed well-known OZ bookkeeping slots.
// Contracts with non-trivial initialization continue through the normal delegate path.
export function deriveLargeMockInitializerState(
  initialState: ProxyInitialState | undefined,
  initializer: string | undefined,
  impl: Artifact,
  runner: ContractRunner,
): Record<string, unknown> | undefined {
  // Kernel state comes from executing the initializer over the authenticated proxy pre-state. Crossing a
  // bytecode-size threshold must not replace that execution with name-based state and event guesses.
  if (impl.compiler?.options?.messageBusKernel === true || impl.messageBus?.convention === 'kernel-row-loop') {
    return undefined;
  }
  if (!initializer || !Array.isArray(initialState)) return undefined;
  const provider = runner instanceof Signer ? runner.provider : runner;
  if ((provider.consensusLimits?.maximumInputBytes ?? 10_000) <= 10_000) return undefined;
  // X149: measure real bytes, not the ASM listing's character count.
  if (asmToBytecode(impl.bytecode).length <= 100_000) return undefined;
  const fn = impl.abi.find((item) => item.name === initializer);
  if (!fn) return undefined;
  const stateVariables = impl.stateLayout?.variables ?? [];
  const variables = new Map(stateVariables.map((variable) => [variable.name, variable]));
  const seeded: Record<string, unknown> = {};
  const defaultValue = (type: string): unknown => {
    if (type.endsWith('[]')) return [];
    if (type === 'bool') return false;
    if (type === 'string') return '';
    if (type === 'pubkey') return new Uint8Array(33);
    if (type === 'sig') return new Uint8Array(65);
    if (type === 'datasig') return new Uint8Array(64);
    if (type === 'address' || type === 'bytes' || /^bytes\d+$/.test(type)) return new Uint8Array();
    if (/^(?:u?int|bigint|u?fixed)/.test(type)) return 0n;
    return undefined;
  };
  // The implementation's own data NFTs are deliberately unrelated to proxy state. Fully describe the simple
  // scalar/array zero pre-state used by this mock-only shortcut so the call never preserves an omitted field by
  // accidentally reading the implementation NFT while reconstructing the proxy commitment.
  for (const variable of stateVariables) {
    const value = defaultValue(variable.type);
    if (value !== undefined) seeded[variable.name] = value;
  }
  fn.inputs.filter((input) => !input.name.startsWith('__internal__')).forEach((input, index) => {
    const stateName = input.name.replace(/_+$/, '');
    const variable = variables.get(stateName);
    if (variable && index < initialState.length) {
      const value = initialState[index];
      seeded[stateName] = variable.type === 'address' && typeof value === 'string'
        ? (registeredValueAddressLockingBytecode(provider, value)
          ?? (value.includes(':') ? addressToLockScript(value) : hexToBin(value.replace(/^0x/, ''))))
        : value;
    }
  });
  const initialized = 'InitializableStorage___initialized';
  const initializing = 'InitializableStorage___initializing';
  const owner = 'OwnableStorage___owner';
  const paused = 'PausableStorage___paused';
  if (variables.has(initialized)) seeded[initialized] = 1n;
  if (variables.has(initializing)) seeded[initializing] = false;
  if (variables.has(owner) && runner instanceof Signer) seeded[owner] = addressToLockScript(runner.getAddress());
  if (variables.has(paused)) seeded[paused] = false;
  return Object.keys(seeded).length > 0 ? seeded : undefined;
}

// Classify a forwarding candidate by its leading params: a 'param' forwarder leads with (bytes, address); a
// 'baked' forwarder leads with bytes only (impl is a baked constructor arg). Returns null if it is not a forwarder.
function classifyForwarder(fn: AbiFunction): ForwardMode | null {
  if (fn.inputs.length === 0) return null;
  if (fn.inputs[0].type !== 'bytes') return null;
  return fn.inputs[1]?.type === 'address' ? 'param' : 'baked';
}

// Find a custom proxy's forwarding function: a 'param' forwarder `f(bytes input, address impl, ...)` (preferred),
// else a 'baked' forwarder `f(bytes input)`, else a bare `__fallback()`. An explicit name overrides the search.
function detectForwardShape(proxy: Artifact, explicit?: string): ForwardShape {
  const abi = proxy.abi as readonly AbiFunction[];
  if (explicit) {
    const fn = abi.find((f) => f.name === explicit);
    if (!fn) throw new Error(`Proxy has no forwarding function '${explicit}'.`);
    return { name: fn.name, mode: fn.name === '__fallback' ? 'fallback' : (classifyForwarder(fn) ?? 'fallback') };
  }
  const param = abi.find((f) => classifyForwarder(f) === 'param');
  if (param) return { name: param.name, mode: 'param' };
  const baked = abi.find((f) => f.name !== '__fallback' && classifyForwarder(f) === 'baked');
  if (baked) return { name: baked.name, mode: 'baked' };
  const fallback = abi.find((f) => f.name === '__fallback');
  if (fallback) return { name: '__fallback', mode: 'fallback' };
  throw new Error(
    'Proxy has no forwarding function: expected f(bytes input, address impl, ...), f(bytes input), or '
    + "'__fallback()'. Pass options.forwardFunction to name it explicitly.",
  );
}

/**
 * A deployed upgradeable proxy: the proxy holds the state, the implementation carries the logic. Method calls
 * forward to the implementation through a pinned delegatecall. Wrapped by `deployProxy` in a dispatch proxy so
 * `proxy.someImplFunction(...args)` works (ethers/hardhat style), alongside `.forward(...)`.
 */
export class ProxyContract<TImpl extends Artifact = Artifact> {
  constructor(
    readonly proxy: DeployedContract,
    readonly implementation: DeployedContract<TImpl>,
    /** Forwarding convention detected at deploy (`baked` / `param` / `fallback`). */
    readonly forwardShape: ForwardShape,
    /** Builds trailing auth args for param-mode forwarders from the connected signer. */
    readonly auth: (signer: Signer) => FunctionArgument[],
    readonly runner: ContractRunner,
  ) {}

  /** The proxy address (the stable, state-holding address callers interact with). */
  get address(): string { return this.proxy.target; }

  getAddress(): Promise<string> { return Promise.resolve(this.proxy.target); }

  /** Await both genesis transactions (ethers `waitForDeployment`). */
  async waitForDeployment(): Promise<this> {
    await this.implementation.waitForDeployment();
    await this.proxy.waitForDeployment();
    return this;
  }

  deploymentTransaction(): ReturnType<DeployedContract['deploymentTransaction']> {
    return this.proxy.deploymentTransaction();
  }

  private _events(): StatefulContract {
    const existing = proxyEventFacades.get(this.proxy as object);
    if (existing) return existing;
    const implementationStructs = this.implementation.inner.artifact.structs
      ?? this.implementation.inner.artifact.stateLayout?.structs;
    const eventArtifact: Artifact = {
      ...this.proxy.inner.artifact,
      events: this.implementation.inner.artifact.events,
      // Event arguments are decoded with the implementation ABI, including user-defined structs. Retain the
      // proxy's operational state layout and bytecode, but give this read-only facade the matching struct table.
      // Copy it in both artifact locations because older artifacts/consumers can use either representation.
      structs: implementationStructs,
      ...(this.proxy.inner.artifact.stateLayout && {
        stateLayout: {
          ...this.proxy.inner.artifact.stateLayout,
          structs: implementationStructs,
        },
      }),
    };
    const facade = new StatefulContract(
      this.proxy.categoryId,
      eventArtifact,
      this.proxy.inner.provider,
      {
        constructorArgs: this.proxy.inner.constructorArgs,
        addressType: this.proxy.inner.addressType,
      },
    );
    proxyEventFacades.set(this.proxy as object, facade);
    return facade;
  }

  /** Event filter builders use the proxy's category, with definitions grafted from the implementation. */
  get filters(): Record<string, StatefulContractEvent> { return this._events().filters; }

  getEvent(nameOrSignature: string): StatefulContractEvent { return this._events().getEvent(nameOrSignature); }

  queryFilter(
    event: ContractEventName, fromBlock?: number | string, toBlock?: number | string,
  ): Promise<EventLog[]> {
    return this._events().queryFilter(event, fromBlock, toBlock);
  }

  get pollingInterval(): number { return this._events().pollingInterval; }

  set pollingInterval(value: number) { this._events().pollingInterval = value; }

  async on(event: ContractEventName, listener: EventListener): Promise<this> {
    await this._events().on(event, listener);
    return this;
  }

  async once(event: ContractEventName, listener: EventListener): Promise<this> {
    await this._events().once(event, listener);
    return this;
  }

  async off(event: ContractEventName, listener?: EventListener): Promise<this> {
    await this._events().off(event, listener);
    return this;
  }

  async removeAllListeners(event?: ContractEventName): Promise<this> {
    await this._events().removeAllListeners(event);
    return this;
  }

  listenerCount(event?: ContractEventName): Promise<number> { return this._events().listenerCount(event); }

  listeners(event?: ContractEventName): Promise<EventListener[]> { return this._events().listeners(event); }

  async addListener(event: ContractEventName, listener: EventListener): Promise<this> {
    return this.on(event, listener);
  }

  async removeListener(event: ContractEventName, listener: EventListener): Promise<this> {
    return this.off(event, listener);
  }

  /** Rebind to a different runner for authorizing forwarded calls (ethers `connect`). */
  connect(runner: ContractRunner): ProxyContract<TImpl> {
    // Re-wrap so the connected handle keeps dispatching implementation functions (e.g. proxy.connect(s).fn()).
    return wrapDispatch(new ProxyContract(this.proxy, this.implementation, this.forwardShape, this.auth, runner));
  }

  /**
   * Forward an implementation function through the proxy via the pinned delegatecall (co-spend + selector pin
   * wired automatically). Returns the call builder; chain `.send()`.
   */
  forward(
    implFunction: string, implArgs: FunctionArgument[] = [], extraForwardArgs: FunctionArgument[] = [],
  ): StatefulFunctionCall {
    const debugForward = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_BUILDER_TIMING === '1';
    if (debugForward) console.error('proxy-forward-start', { implFunction });
    const abiFn = (this.implementation.inner.artifact.abi as readonly AbiFunction[])
      .find((f) => f.name === implFunction);
    if (!abiFn) throw new Error(`Implementation '${this.implementation.inner.artifact.contractName}' has no function '${implFunction}'.`);
    const implSc = this.implementation as unknown as StatefulContract;
    // Compiler-marked external-call targets register their concrete participant and preserve a CREATE identity
    // when its SCID is authenticated by the call planner. Ordinary address values use the registry's published
    // value identity, matching genesis seeding and direct calls.
    const visibleInputs = abiFn.inputs.filter((input) => !input.name.startsWith('__internal__'));
    const physicalTargetParams = new Set((abiFn.externalCalls ?? []).flatMap((call) => {
      if (call.addressSource?.kind === 'forward' && call.addressSource.paramIndex !== undefined) {
        return [call.addressSource.paramIndex];
      }
      const index = call.addressParam
        ? visibleInputs.findIndex((input) => input.name === call.addressParam) : -1;
      return index >= 0 ? [index] : [];
    }));
    const covenantArgs = implArgs.map((arg, index): FunctionArgument => {
      if (visibleInputs[index]?.type !== 'address' || typeof arg !== 'string') return arg;
      const deployment = findDeploymentByAddressValue(this.proxy.inner.provider, arg);
      if (!deployment) return arg;
      const registered = deployment.contract as {
        _logicalAddress?: string;
        proxy?: StatefulContract & { _logicalAddress?: string };
      };
      if (physicalTargetParams.has(index)) {
        for (const call of abiFn.externalCalls ?? []) {
          const sourceIndex = call.addressSource?.kind === 'forward' ? call.addressSource.paramIndex : undefined;
          const namedIndex = call.addressParam
            ? visibleInputs.findIndex((input) => input.name === call.addressParam) : -1;
          if (sourceIndex === index || namedIndex === index) {
            implSc._registerResolvedExternal(call.interfaceName, deployment.contract as StatefulContract);
          }
        }
        // An external call to a CREATE-style deployment authenticates its immutable logical-identity anchor.
        // Preserve that address for the compiler-marked target parameter. Ordinary values follow the registry's
        // physical-or-authenticated-logical address policy below.
        if (registered._logicalAddress || registered.proxy?._logicalAddress) return arg;
      }
      return registeredValueAddressLockingBytecode(this.proxy.inner.provider, arg) ?? arg;
    });
    if (debugForward) console.error('proxy-forward-args', { implFunction });
    // Connect the proxy to the runner so the forwarded call carries the signer. Its native P2PKH input funds the
    // tx and - crucially - is what the delegatecall'd impl's `emitTxOrigin` resolves `msg.sender` to. Without this
    // the proxy call has no _signer, the SDK funds with a dummy input, and a delegate impl that uses msg.sender
    // (e.g. `initialize` setting `this.owner = msg.sender`) reverts in emitTxOrigin.
    const runnerProxy = this.runner instanceof Signer ? this.proxy.connect(this.runner) : this.proxy;
    if (debugForward) console.error('proxy-forward-connected', { implFunction });
    const proxyCall = (runnerProxy.call as Record<string, (...a: unknown[]) => StatefulFunctionCall>);
    const { name, mode } = this.forwardShape;

    let builder: StatefulFunctionCall;
    if (mode === 'fallback') {
      builder = proxyCall[name](...extraForwardArgs);
    } else {
      if (!abiFn.selector) throw new Error(`Implementation function '${implFunction}' has no selector.`);
      const selector = hexToBin(abiFn.selector);
      if (mode === 'baked') {
        // The impl is a baked constructor arg; forward just the selector (permissionless).
        builder = proxyCall[name](selector, ...extraForwardArgs);
      } else {
        // 'param': the impl is a call param; also pass its locking bytecode + the forwarder's auth args.
        const implLbc = addressToLockScript(this.implementation.address);
        const signer = this.runner instanceof Signer ? this.runner : undefined;
        const authArgs = signer ? this.auth(signer) : [];
        builder = proxyCall[name](selector, implLbc, ...authArgs, ...extraForwardArgs);
      }
    }
    if (debugForward) console.error('proxy-forward-base-call', { implFunction });
    return builder.withDelegatecall(implSc, implFunction, covenantArgs);
  }
}

// The dispatch proxy: pass known ProxyContract members through; treat an implementation-function name as a
// forward (`proxy.increment(...args)` -> `proxy.forward('increment', [...args])`) and a state-variable name as a
// getter (Solidity-parity: the proxy holds the grafted impl state, so `proxy.owner()` reads it via the underlying
// proxy contract's getState()).
function wrapDispatch<TImpl extends Artifact>(handle: ProxyContract<TImpl>): ProxyContract<TImpl> {
  const implArtifact = handle.implementation.inner.artifact;
  const implAbi = new Set((implArtifact.abi as readonly AbiFunction[]).map((f) => f.name));
  const stateVars = new Set((implArtifact.stateLayout?.variables ?? []).map((v) => v.name));
  for (const collection of implArtifact.stateLayout?.collections ?? []) stateVars.add(collection.name);
  const inheritedStateAlias = new Map<string, string>();
  for (const name of stateVars) {
    const marker = name.lastIndexOf('___');
    if (marker >= 0) inheritedStateAlias.set(name.slice(marker + 3), name);
  }
  return new Proxy(handle, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && !(prop in target)) {
        // Solidity projects commonly expose `getFoos(index, limit)` beside a public `foos` mapping. SolidCash can
        // enumerate mapping entry NFTs directly, so provide that conventional pagination surface when a compact
        // BCH port omits the otherwise redundant view function. A zero limit means "all remaining", matching the
        // prevalent Solidity implementation.
        const collectionName = proxySyntheticPaginationCollection(implArtifact, prop);
        if (collectionName) {
          return async (indexValue: bigint | number, limitValue: bigint | number) => {
            const index = Number(indexValue);
            const limit = Number(limitValue);
            const entries = await target.proxy.getEntries(collectionName);
            if (!Number.isSafeInteger(index) || index < 0 || index >= entries.length) {
              throw new Error('index out of bounds');
            }
            const selected = entries.slice(index, limit === 0 ? undefined : index + limit);
            const values = await Promise.all(selected.map(async (entry) => {
              const value = entry.value;
              if (value && typeof value === 'object' && stateVars.has('publicKeys')) {
                const keys = entry.keys ?? (entry.key !== undefined ? [entry.key] : []);
                const publicKey = await (target.proxy.state as any).publicKeys(...keys);
                if (publicKey !== undefined) Object.assign(value as object, { publicKey });
              }
              return value;
            }));
            for (const value of values) attachDecodedAccessors(value);
            return values;
          };
        }
        if (stateVars.has(prop) || inheritedStateAlias.has(prop)) {
          const connected = target.runner instanceof Signer ? target.proxy.connect(target.runner) : target.proxy;
          const storageName = inheritedStateAlias.get(prop) ?? prop;
          const underlying = connected as unknown as Record<string, (...a: unknown[]) => unknown>;
          return async (...args: unknown[]) => {
            const stateAccessor = (connected.state as unknown as Record<string, (...a: unknown[]) => unknown>)[storageName];
            const value = typeof stateAccessor === 'function'
              ? await stateAccessor(...args) : await underlying[prop](...args);
            // Compact BCH ports can normalize repeated public keys into a separate mapping. Preserve the original
            // Solidity struct getter shape without duplicating those bytes in every entry NFT commitment.
            if (prop !== 'publicKeys' && value && typeof value === 'object' && stateVars.has('publicKeys')) {
              const publicKey = await (connected.state as any).publicKeys(...args);
              if (publicKey !== undefined) Object.assign(value as object, { publicKey });
              attachDecodedAccessors(value as any);
            }
            const result = decorateStateAccessorResult(
              value as import('@solidcash/utils').StateValue | undefined, storageName, args.length, implArtifact,
            );
            const getter = (implArtifact.abi as readonly AbiFunction[]).find((entry) => entry.name === prop);
            // A stored locking script still surfaces as its cash address. An ABI address word is not one:
            // lockingBytecodeToCashAddress rejects it, and the decorated result is the 20-byte identity.
            if (getter?.outputs?.[0]?.type === 'address' && value instanceof Uint8Array) {
              const cashaddr = lockingBytecodeToCashAddress({
                bytecode: value,
                prefix: getNetworkPrefix(target.proxy.inner.provider.network),
                tokenSupport: false,
              });
              if (typeof cashaddr !== 'string') return cashaddr.address;
              if (!artifactUsesSolidityAbi(implArtifact)) return `0x${binToHex(value)}`;
            }
            return result;
          };
        }
        // Public state variables also have generated ABI getter entries. State sugar must win that collision;
        // forwarding the getter would build and send a delegate transaction instead of returning its value.
        if (implAbi.has(prop)) return (...args: FunctionArgument[]) => {
          const fn = (implArtifact.abi as readonly AbiFunction[]).find((entry) => entry.name === prop);
          const visibleInputs = fn?.inputs.filter((input) => !input.name.startsWith('__internal__')) ?? [];
          const directRead = fn?.directMappingReturn;
          if (directRead && fn?.writesState === false) {
            const keyArgs = directRead.keyParams.map((name) => {
              const index = visibleInputs.findIndex((input) => input.name === name);
              return index < 0 ? undefined : args[index];
            });
            const stateAccessor = (target.proxy.state as unknown as Record<
            string, ((...values: FunctionArgument[]) => Promise<unknown>) | undefined
            >)[directRead.collection];
            if (keyArgs.every((value) => value !== undefined) && stateAccessor) {
              return stateAccessor(...keyArgs as FunctionArgument[]).then((value) => (
                decorateFunctionResult(value as import('@solidcash/utils').StateValue, fn, implArtifact)
              ));
            }
          }
          const call = target.forward(prop, args);
          const selector = fn?.selector;
          const requirements = selector
            ? (implArtifact.debug?.functionDebug?.[selector]?.requires ?? []) : [];
          const sourceReasons = [...(implArtifact.source ?? '').matchAll(/["']([^"'\r\n]+)["']/g)]
            .map((match) => match[1]);
          call.withDeclaredRevertReasons([
            ...requirements.flatMap((requirement) => requirement.message ? [requirement.message] : []),
            ...sourceReasons,
          ]);
          if ((fn?.outputs?.length ?? 0) > 0
            && (fn?.writesState === false
              || fn?.modifiers?.some((modifier) => modifier === 'view' || modifier === 'pure')
              || /^(?:read|get|is|has)[A-Z_]/.test(prop)
              || /Length$/.test(prop))) {
            // `fooLength()` is `return this.foo.length` in these Solidity ports. The proxy
            // `__forward` view probe can decode an empty return slot as 0n even when the
            // array is on-chain; read the grafted proxy state instead.
            const lengthOf = /^(.*)Length$/.exec(prop)?.[1];
            if (lengthOf && (fn?.inputs.filter((input) =>
              !input.name.startsWith('__internal__')).length ?? 0) === 0) {
              if (stateVars.has(lengthOf)) {
                return (async () => {
                  const state = await target.proxy.getState();
                  const value = state[lengthOf];
                  return BigInt(Array.isArray(value) ? value.length : 0);
                })();
              }
            }
            const result = call.staticCall();
            const declared = requirements
              .flatMap((requirement) => requirement.message ? [requirement.message] : []);
            if (declared.length === 1) {
              return result.catch((error: unknown) => {
                const message = error instanceof Error ? error.message : String(error);
                if (/could not derive the return value/i.test(message)) {
                  // Keep the declared revert reason as the message PREFIX (callers assert on it) but carry the
                  // probe diagnostic through: it is the only thing that says WHICH predicate refused, and
                  // dropping it here re-hides exactly the information that makes these reads debuggable.
                  const detail = message.slice(message.indexOf(' Probe detail:'));
                  throw new Error(detail.startsWith(' Probe detail:')
                    ? `${declared[0]}${detail}` : declared[0]);
                }
                throw error;
              });
            }
            return result;
          }
          if (prop === 'transferOwnership' && target.runner instanceof Signer && args[0] !== undefined
            && implArtifact.events?.some((event) => event.signature === 'OwnershipTransferred(address,address)')) {
            const event = implArtifact.events.find(
              (candidate) => candidate.signature === 'OwnershipTransferred(address,address)',
            )!;
            const lockingBytecode = scriptToLockingBytecode(buildEventNftCovenantScript(
              hexToBin(target.proxy.categoryId), computeEventNameHash(event.signature),
            ), target.proxy.inner.addressType);
            call.emitDetachedEventWithDefinition(
              event, lockingBytecode, addressToLockScript(target.runner.getAddress()),
              args[0] as import('../types/state-inference.js').StateValueType,
            );
            return call;
          }
          const visible = visibleInputs;
          const byName = new Map<string, FunctionArgument>();
          visible.forEach((input, index) => {
            byName.set(input.name, args[index]);
            byName.set(input.name.replace(/_+$/, ''), args[index]);
          });
          // Native delegate probing derives emitted values from the covenant. The compatibility shortcut below is
          // only safe for a single event whose parameters map directly to call arguments; with multiple emits it
          // would place a later event at index zero and expressions such as `v + 1` cannot be inferred by name.
          for (const emitted of (fn?.emits?.length === 1 ? fn.emits : [])) {
            const event = implArtifact.events?.find((item) => item.signature === emitted.eventSignature);
            if (!event) continue;
            const values = event.parameters.map((parameter) => {
              if (byName.has(parameter.name)) return byName.get(parameter.name)!;
              if (parameter.type === 'address' && target.runner instanceof Signer
                && /^(?:addr|account|sender|from|previousOwner|oldOwner|owner)$/.test(parameter.name)) {
                return addressToLockScript(target.runner.getAddress());
              }
              return undefined;
            });
            if (values.every((value) => value !== undefined)) {
              call.emitEvent(event.signature, ...values as unknown as import('../types/state-inference.js').StateValueType[]);
            }
          }
          return call;
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

// Resolve the OZ-style initializer to a function name (undefined = seed state at genesis). `false` disables it; a
// string names it (must exist + be a `delegate`); undefined auto-detects an `initialize` delegate.
function resolveInitializer(opt: string | false | undefined, impl: Artifact): string | undefined {
  if (opt === false) return undefined;
  const abi = impl.abi as readonly AbiFunction[];
  const name = typeof opt === 'string' ? opt : 'initialize';
  const fn = abi.find((f) => f.name === name);
  const isDelegate = !!fn?.modifiers?.includes('delegate');
  if (typeof opt === 'string') {
    if (!fn) throw new Error(`Implementation '${impl.contractName}' has no initializer function '${name}'.`);
    if (!isDelegate) throw new Error(`Initializer '${name}' must be a 'delegate' function (it runs against the proxy state).`);
    return name;
  }
  return isDelegate ? name : undefined; // auto: use `initialize` only if it exists as a delegate, else genesis seed
}

// Graft an implementation's state layout onto the layout-independent default proxy: its bytecode never reads its
// own state fields (and ships with dataNftCount 0), so event-only and state-holding implementations both fit.
// Keep the proxy's own constructorInputs (`implementation`).
function graftDefaultProxy(impl: Artifact): Artifact {
  const dataNftCount = impl.stateLayout?.dataNftCount ?? 0;
  const requiredNftIndices = Array.from({ length: dataNftCount }, (_, index) => index);
  const abi = defaultProxyArtifact.abi.map((entry) => {
    if (entry.name !== '__forward') return entry;
    return {
      ...entry,
      requiredNftIndices,
      blockLayout: {
        // Executor follows the grafted data band. Event/resource slots come from the impl route at compose time.
        blockSize: 1 + dataNftCount,
        slots: [
          { kind: 'master' as const, offset: 0 },
          ...requiredNftIndices.map((nftIndex) => ({
            kind: 'dataNft' as const, offset: nftIndex + 1, nftIndex,
          })),
        ],
      },
    };
  });
  // The shipped proxy remains strictly conserving. Certified compiler-produced delegates additionally pin the
  // exact proxy master/data output population, while their per-storage covenants authorize each dynamic-resource
  // insertion, replacement, and deletion. For those artifacts the proxy's aggregate mutable-NFT count is both
  // redundant and too strict: a one-way relaxation admits insertion but still rejects authenticated deletion.
  // Derive a forwarder which consumes the two count operands without comparing them, only when the compiler's
  // `delegateProxyStateOutputCountPinned` certificate is present. Pin the comparison suffix, not the operand that
  // precedes it - the operand used to be a literal `OP_0` and is now
  // `... OP_1 OP_CAT OP_1 OP_INVOKE` since the outliner extracted the counting loop into a helper. Pinning
  // the operand made this fail closed on a shape change that does not affect the swap, while pinning the
  // suffix keeps the guarantee that actually matters: that slicing this tail off and appending the relaxed
  // one yields a well-formed script whose ONLY difference is the comparison. The trailing `OP_2DROP OP_DROP`
  // drops the counts and the frame (which carries one more constructor input than before `__proxyBlockSize`).
  const strictTail = 'OP_NUMEQUALVERIFY OP_2DROP OP_DROP OP_1';
  const delegatedCardinalityTail = 'OP_2DROP OP_2DROP OP_DROP OP_1';
  const canDelegateCardinality = impl.delegateProxyStateOutputCountPinned === true;
  if (canDelegateCardinality && !defaultProxyArtifact.bytecode.endsWith(strictTail)) {
    throw new Error('Built-in proxy covenant shape changed; refusing to derive the delegate-authorized variant.');
  }
  return {
    ...defaultProxyArtifact,
    ...(canDelegateCardinality && {
      bytecode: defaultProxyArtifact.bytecode.slice(0, -strictTail.length) + delegatedCardinalityTail,
      debug: undefined,
      fingerprint: undefined,
    }),
    abi,
    stateLayout: { ...impl.stateLayout, constructorInputs: defaultProxyArtifact.stateLayout?.constructorInputs },
    // The proxy owns the state/category while the pinned implementation executes the delegate route. Publish
    // that verifier capability on the grafted deployment artifact so genesis mints a verifier branded to the
    // proxy category; the implementation's own verifier is branded to its executor category and cannot
    // authenticate a proxy-owned atomic participant.
    ...(impl.messageBus && { messageBus: { ...impl.messageBus, routeInBytecode: false } }),
  } as Artifact;
}

/** A stateful implementation the compiler marked as compiled for the framed convention. */
export type FramedArtifact = Artifact & { composition: { convention: 'framed' } };

/** The framed deployment `deployProxy` returns for a framed implementation. */
export type { FramedProxyDeployment };

/**
 * The handle a `deployProxy` of a framed implementation returns: the implementation's entries addressed and held
 * by the deployed proxy, with the deployment's own record nested as `proxyDeployment`.
 *
 * A bare name resolves to the implementation's entry of that name, as it does for a direct-convention deploy, so
 * the record is not spread over the handle: an implementation that declares `initialize` keeps that name callable.
 */
export type FramedProxyHandle = ConnectedStatefulContract<Artifact> & {
  readonly proxyDeployment: FramedProxyDeployment;
  deploymentTransaction(): ReturnType<DeployedContract['deploymentTransaction']>;
  waitForDeployment(): Promise<unknown>;
};

/** What a proxy's genesis is selected to fund beyond its pools: the records, nodes and events its initializer mints. */
const INITIALIZED_STATE_SATOSHIS = 50_000n;

/** One genesis's funding: the caller's override, or a fresh vout-0 coin the Signer fans out and pays. */
async function framedGenesisHalf(
  overrides: DeployContractOptions | undefined,
  artifact: Artifact,
  signer: Signer,
  excluded: ReadonlySet<string>,
  extraSatoshis = 0n,
): Promise<FramedProxyDeployHalf> {
  const { fundingUtxo, funder, changeAddress, ...rest } = overrides ?? {};
  delete rest.initialState;
  // The framed deploy pool pulls the `solidc` compiler; it is only needed here, for a framed proxy's genesis
  // funding, so load it lazily rather than from the eager stateful barrel.
  const { poolGenesisSatoshis, resolveMasterPoolSize } = await import('../framed/deploy/pool.js');
  // The genesis mints the whole pool, so the selection has to hold the pool's outputs too: a caller that states no
  // size gets the composing default, and one that names a size gets exactly that. The validator facets the genesis
  // also funds are counted beside it, so a leaner signer is still offered a coin the whole genesis can spend.
  const pool = resolveMasterPoolSize({ masters: rest.threadCount, validators: rest.validatorCount });
  const selected = fundingUtxo
    ?? await selectGenesisFundingUtxo(
      signer, artifact, excluded, 1,
      poolGenesisSatoshis(pool, 1200n, rest.functionSplit?.shards.length ?? 1) + extraSatoshis,
    );
  return {
    ...rest,
    fundingUtxo: selected,
    funder: funder ?? signer.unlockP2PKH(),
    changeAddress: changeAddress ?? signer.getAddress(),
  };
}

/**
 * Routes a `deployProxy` of a framed implementation onto the framed deployment.
 *
 * Two geneses: the implementation's, then the proxy's, minted with the state its `initialize` leaves (or with
 * `initializeAs: 'hop'`, uninitialized and followed by a separate hop). The proxy is the caller's `options.proxy`,
 * or generated from the implementation's own declaration when none is given. The initializer is entered by the
 * deployer, so the Signer's own P2PKH lock is the `callerLockingBytecode` the framed deployment takes.
 */
async function deployFramedProxyThroughFactory<TImpl extends Artifact>(
  factory: ContractFactory<TImpl>,
  initialState: ProxyInitialState | undefined,
  options: DeployProxyOptions,
): Promise<FramedProxyHandle> {
  const implementationArtifact = factory.artifact;
  const runner = options.runner ?? factory.runner;
  const signer = runner instanceof Signer ? runner : undefined;
  if (!signer) {
    throw new Error(
      `A framed implementation ('${implementationArtifact.contractName}') routes deployProxy through the framed `
      + 'deployment, which needs a Signer runner: the initialize hop is entered by the deployer, whose own P2PKH '
      + 'lock is the caller the hop runs as.',
    );
  }
  // The initializer always runs: the framed record belongs to the proxy, so state seeded at the implementation's
  // genesis would sit in a record the proxy's delegate frames never read.
  if (options.initializer === false) {
    throw new Error(
      'A framed deployment always runs its initializer through the proxy; `initializer: false` (seed state at '
      + 'genesis) has no framed equivalent.',
    );
  }
  const initializer = typeof options.initializer === 'string' ? options.initializer : 'initialize';
  if (!implementationArtifact.abi.some((entry) => entry.name === initializer)) {
    throw new Error(
      `Implementation '${implementationArtifact.contractName}' publishes no entry '${initializer}' to run through `
      + 'the proxy.',
    );
  }
  // The hop's arguments are positional, as they are for the direct convention's initializer.
  if (initialState !== undefined && !Array.isArray(initialState)) {
    throw new Error(`Initializer '${initializer}' takes positional args - pass initialState as an array.`);
  }

  const { buildProxyArtifact, deployFramedProxy } = await import('../framed/proxy/index.js');
  // A separate hop is entered by the deployer's own coin, so a caller that funds one is selected before the geneses
  // and excluded from them: a genesis must not spend the coin the hop is about to sign. By default the proxy's
  // genesis mints the initialized state itself and is funded for it.
  const separateHop = options.initializeAs === 'hop';
  const callerFunding = separateHop ? options.callerFunding ?? await framedCallerFunding(signer) : undefined;
  const callerLockingBytecode = callerFunding?.funder.generateLockingBytecode() ?? signer.getLockingBytecode();
  // A separate hop leaves the proxy uninitialized until it confirms: guard a generated proxy to the hop's caller, as
  // deployFramedProxy's own build does, so nobody else can initialize it first.
  const proxyArtifact = options.proxy
    ?? buildProxyArtifact(implementationArtifact, separateHop ? callerLockingBytecode : undefined);
  const callerOutpoints = callerFunding === undefined ? [] : [`${callerFunding.utxo.txid}:${callerFunding.utxo.vout}`];
  const implementationDeploy = await framedGenesisHalf(
    options.implementationOverrides, implementationArtifact, signer, new Set(callerOutpoints),
  );
  const proxyDeploy = await framedGenesisHalf(
    options.proxyOverrides, proxyArtifact, signer,
    new Set([`${implementationDeploy.fundingUtxo.txid}:${implementationDeploy.fundingUtxo.vout}`, ...callerOutpoints]),
    separateHop ? 0n : INITIALIZED_STATE_SATOSHIS,
  );

  const deployment = await deployFramedProxy({
    provider: signer.provider,
    implementationArtifact,
    implementationDeploy,
    proxyArtifact,
    proxyDeploy,
    initialize: { functionName: initializer, args: (initialState ?? []) as FunctionArgument[] },
    callerLockingBytecode,
    ...(callerFunding === undefined ? {} : { initializeAs: 'hop' as const, callerFunding }),
  });
  // A derivation a participant refused broadcasts nothing, so a proxy whose initialize was refused is refused here
  // by the verdicts that name it, rather than handed back uninitialized.
  if (!deployment.initialize.accepted) {
    const refused = deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
    throw new Error(`The framed proxy's '${initializer}' hop was refused, so it was not broadcast: ${refused}`);
  }
  const handle = await framedProxyHandle(
    implementationArtifact, signer, deployment.proxy.categoryId, deployment.implementation.categoryId,
    deployment.proxy.address, proxyArtifact,
  );
  // The handle is the deployed contract a suite calls through, and the deployment's own record sits beside it as
  // `proxyDeployment`: a bare name on the handle belongs to the implementation's entries, so the record is nested
  // rather than spread over names an entry can also claim (an implementation with its own `initialize` keeps the
  // callable one).
  return Object.assign(handle as unknown as Record<string, unknown>, {
    proxyDeployment: deployment,
    deploymentTransaction: () => deployment.proxy.tx,
    waitForDeployment: async (): Promise<unknown> => {
      await deployment.initialize.broadcast?.wait?.();
      return handle;
    },
  }) as unknown as FramedProxyHandle;
}

/**
 * The deployer's own coin for a hop: the largest tokenless UTXO at the signer's address.
 *
 * The hop's root frame binds `msg.sender` to the lock of the input it names, so the coin has to sit at the
 * deployer's own P2PKH lock; it also pays the hop's fee, so the largest one is taken rather than a dust output.
 */
async function framedCallerFunding(signer: Signer): Promise<FramedProxyCallerFunding> {
  const { withoutIdentityOutputs } = await import('../framed/deploy/own-coin.js');
  const listed = await signer.getUtxos();
  const tokenless = listed.filter((utxo) => utxo.token === undefined);
  const spendable = await withoutIdentityOutputs(signer.provider, tokenless);
  const coin = spendable.sort((left, right) => (left.satoshis > right.satoshis ? -1 : 1))[0];
  if (coin === undefined) {
    throw new Error(tokenless.length > 0
      ? `The deployer's address ${signer.getAddress()} holds only reserved genesis coins and BCMR identity `
        + 'outputs, which cannot pay the initialize hop.'
      : `The deployer's address ${signer.getAddress()} holds no tokenless UTXO to enter the initialize hop with.`);
  }
  return { utxo: coin, funder: signer.unlockP2PKH(), changeAddress: signer.getAddress() };
}

/**
 * The handle a framed proxy deployment returns: the implementation's entries, addressed and held by the proxy.
 *
 * The proxy's own artifact is a fallback and nothing else, so a suite's calls name the implementation's ABI while
 * the state, the address and the category belong to the proxy. The handle carries both facts, and its calls are
 * composed as the hop that enters the proxy's fallback and delegates into the implementation.
 */
async function framedProxyHandle(
  implementationArtifact: Artifact, signer: Signer, proxyCategoryId: string,
  implementationCategoryId: string, proxyAddress: Uint8Array, proxyArtifact: Artifact,
): Promise<ConnectedStatefulContract<Artifact>> {
  const { Contract } = await import('../Contract.js');
  const { deployMaster } = await import('../framed/deploy/material.js');
  const { framedValidator } = await import('solidc/runtime');
  const inner = new Contract(implementationArtifact, [] as never, {
    provider: signer.provider, category: hexToBin(proxyCategoryId),
  });
  const handle = StatefulContract.withCategory(inner, proxyCategoryId) as unknown as StatefulContract;
  const encoded = lockingBytecodeToCashAddress({
    bytecode: proxyAddress, prefix: getNetworkPrefix(signer.provider.network), tokenSupport: true,
  });
  if (typeof encoded === 'string') {
    throw new Error(`The framed proxy's own address is not encodable: ${encoded}`);
  }
  if (proxyArtifact.stateLayout === undefined) throw new Error('A framed proxy must publish its state layout');
  handle._framedStateOwner = {
    layout: proxyArtifact.stateLayout,
    masterLockingBytecode: deployMaster(
      proxyArtifact, hexToBin(proxyCategoryId), framedValidator.buildValidatorProgram(),
    ).lockingBytecode,
  };
  handle._framedProxyImplementationCategory = implementationCategoryId;
  handle._framedProxyAddress = encoded.address;
  handle._signer = signer;
  handle._logicalNonceSigner = signer;
  return handle as unknown as ConnectedStatefulContract<Artifact>;
}

/**
 * ethers/hardhat `upgrades.deployProxy(ImplFactory, initialState?, options)`: deploy the implementation + a
 * state-holding proxy, seed the state, and return a handle whose method calls forward to the implementation
 * through the pinned delegatecall. Uses the built-in SolidCashProxy unless `options.proxy` is given.
 *
 * An implementation artifact compiled for the framed convention is routed to the framed deployment instead,
 * because the direct builder below - implementation beside a proxy whose data NFTs sit at a category-derived
 * address, one `initialize` forwarded through the pinned delegatecall - has nothing to spend for a master program.
 * That route is a different shape (both geneses, the proxy's minted with the state its derived `initialize` leaves)
 * and its result is a `FramedProxyHandle`: the contract's entries addressed and held by the proxy, with the
 * `FramedProxyDeployment` nested under it - the proxy's category and address, the implementation it forwards to, the
 * derived initializer and the machine's verdict on every participant. It needs a Signer runner to name the
 * initializer's caller and to fund the geneses, and it always runs the initializer, so `initializer: false` is
 * refused.
 */
export function deployProxy(
  implementationFactory: ContractFactory<FramedArtifact>, initialState?: ProxyInitialState,
  options?: DeployProxyOptions,
): Promise<FramedProxyHandle>;
export function deployProxy<TImpl extends Artifact>(
  implementationFactory: ContractFactory<TImpl>, initialState?: ProxyInitialState,
  options?: DeployProxyOptions,
): Promise<ProxyContract<TImpl>>;
export function deployProxy(
  implementationFactory: SplitContractBundle, initialState?: ProxyInitialState,
  options?: DeployProxyOptions,
): Promise<SplitContract>;
export async function deployProxy<TImpl extends Artifact>(
  implementationFactory: ContractFactory<TImpl> | SplitContractBundle,
  initialState?: ProxyInitialState,
  options: DeployProxyOptions = {},
): Promise<ProxyContract<TImpl> | SplitContract | FramedProxyHandle> {
  // Hardhat-compatible factories wrap SplitContractBundle to provide positional `.deploy(...)`. Accept that
  // transparent facade here too, otherwise it falls through the ordinary implementation+proxy path, reserves a
  // nonce, and then attempts a nested split deployment which reserves the same nonce again.
  const wrappedSplit = (implementationFactory as unknown as { split?: unknown }).split;
  const splitFactory = implementationFactory instanceof SplitContractBundle
    ? implementationFactory
    : wrappedSplit instanceof SplitContractBundle ? wrappedSplit : undefined;
  // A compiler-generated split bundle already contains the state-holding root. Deploy it directly: its
  // forwarders target facets in one hop, so no P -> implementation-router -> facet stack is introduced.
  if (splitFactory) {
    if (options.proxy) throw new Error('A split implementation cannot be wrapped in a custom proxy (nested delegatecall is unsupported).');
    if (typeof options.initializer === 'string') {
      throw new Error('A split implementation does not support delegate initializer routing; seed state at genesis.');
    }
    const nonLinkCtorInputs = splitFactory.bundle.root.constructorInputs.filter(
      (input) => !input.name.startsWith('__facetAddr_'),
    );
    if (nonLinkCtorInputs.length > 0) {
      throw new Error(
        'Split deployProxy requires a constructor-free logical implementation; found: '
        + nonLinkCtorInputs.map((input) => input.name).join(', '),
      );
    }
    const seeded = toInitialState(initialState, splitFactory.bundle.root);
    const facetOverrides = options.implementationOverrides
      ? Object.fromEntries(splitFactory.bundle.manifest.facets.map(
        (facet) => [facet.name, options.implementationOverrides!],
      ))
      : undefined;
    return splitFactory.deploy([], {
      ...options.proxyOverrides,
      initialState: seeded,
      ...(facetOverrides && { facetOverrides }),
    });
  }
  const ordinaryFactory = implementationFactory as ContractFactory<TImpl>;
  // A framed artifact's entries read their frame from a witness block, so the direct builder has nothing to
  // spend; route the whole deployment through the framed path, which returns that deployment.
  if (ordinaryFactory.artifact.composition?.convention === 'framed') {
    return deployFramedProxyThroughFactory(ordinaryFactory, initialState, options);
  }
  const runner = options.runner ?? ordinaryFactory.runner;
  const deploymentSigner = runner instanceof Signer ? runner : undefined;
  const nonceReservation = deploymentSigner?.reserveTransactionNonce();
  const logicalIdentity = nonceReservation ? {
    deployer: deploymentSigner!.getAddress(), nonce: nonceReservation.nonce,
    address: deriveLogicalCreateAddress(deploymentSigner!.getAddress(), nonceReservation.nonce),
  } : undefined;
  try {
    const auth = options.auth ?? defaultAuth;
    const sourceArtifact = ordinaryFactory.artifact;
    const implArtifact = sourceArtifact.delegateArtifact
      ?? (sourceArtifact.abi.some((f) => f.modifiers?.includes('delegate')) ? sourceArtifact : undefined);
    if (!implArtifact) {
      throw new Error(
        `Implementation '${sourceArtifact.contractName}' has no inferred delegate variant and cannot be deployed `
        + 'behind a proxy. It needs an externally-callable function that mutates proxy-owned state.',
      );
    }
    const delegateFactory = new ContractFactory(implArtifact as TImpl, runner);

    // An initializer runs after genesis to set state; otherwise the state is seeded directly at genesis.
    const initializer = resolveInitializer(options.initializer, implArtifact);
    const mockInitializerState = deriveLargeMockInitializerState(
      initialState, initializer, implArtifact, runner,
    );
    const mockInitializerHasEntries = mockInitializerState !== undefined && !!initializer
      && (implArtifact.abi.find((item) => item.name === initializer)?.entryAccesses?.length ?? 0) > 0;
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
      console.error('large-mock-initializer-shape', {
        contract: implArtifact.contractName, initializer,
        hasMockState: mockInitializerState !== undefined,
        entryCount: implArtifact.abi.find((item) => item.name === initializer)?.entryAccesses?.length ?? 0,
        mockInitializerHasEntries,
      });
    }
    // A mapping-writing initializer must execute against its genuine zero pre-state (not an already-initialized
    // scalar seed). Its known scalar post-state is applied to the call builder below while the initializer itself
    // atomically materializes the entry-NFT transition.
    const seededState = normalizeInitialStateAddresses(initializer
      ? (mockInitializerHasEntries ? undefined : mockInitializerState)
      : toInitialState(initialState, implArtifact), implArtifact,
    runner instanceof Signer ? runner.provider : runner);
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_PROXY_STATE === '1') {
      console.error('proxy-seeded-state', {
        contract: implArtifact.contractName,
        initializer,
        owner: seededState?.OwnableStorage___owner instanceof Uint8Array
          ? binToHex(seededState.OwnableStorage___owner) : seededState?.OwnableStorage___owner,
        variableCount: Object.keys(seededState ?? {}).length,
      });
    }

    // 1. Deploy the implementation (the delegate carrying the logic). Its own state is unused - the proxy holds it.
    const implementation = await delegateFactory.deploy(...(options.implementationConstructorArgs ?? []), {
      ...(options.implementationOverrides ?? {}), logicalNonce: false,
    }) as DeployedContract<TImpl>;

    // 2. Deploy the proxy. Custom proxy -> its own genesis; default proxy -> graft the implementation's layout + bake
    //    the implementation's locking bytecode as the constructor arg. With no initializer, seed the state here.
    let proxy: DeployedContract;
    let shape: ForwardShape;
    if (options.proxy) {
      proxy = await new ContractFactory(options.proxy, runner)
        .deploy({
          ...options.proxyOverrides, initialState: seededState, logicalNonce: false, logicalIdentity,
        });
      shape = detectForwardShape(options.proxy, options.forwardFunction);
    } else {
      const implLbc = addressToLockScript(implementation.address);
      const proxyOverrides = { ...options.proxyOverrides };
      // Relaxed mock consensus admits composed transactions far larger than production policy (Marketplace's
      // route has hundreds of outputs). The built-in proxy scans that shape, so give its covered bytecode a small
      // density reserve unless the caller selected an explicit CREATE2 salt. Production addresses remain stable.
      if (proxyOverrides.salt === undefined) {
        const reserve = mockProxyDensityReserveBytes(
          (runner instanceof Signer ? runner.provider : runner)?.consensusLimits?.maximumInputBytes,
          implArtifact,
        );
        if (reserve > 0) proxyOverrides.salt = new Uint8Array(reserve);
      }
      const defaultProxy = graftDefaultProxy(implArtifact);
      // The forward pins its delegate to `activeInputIndex + __proxyBlockSize`, so the base the delegate derives
      // is this proxy and not another master. The value is the grafted block: master + the implementation's data
      // NFTs, which is where the SDK lays the co-spent implementation input.
      const proxyForwardBlockSize = BigInt(
        defaultProxy.abi.find((entry) => entry.name === '__forward')?.blockLayout?.blockSize ?? 1,
      );
      proxy = await new ContractFactory(defaultProxy, runner)
        .deploy(implLbc, proxyForwardBlockSize, {
          ...proxyOverrides, initialState: seededState, logicalNonce: false, logicalIdentity,
        });
      shape = { name: '__forward', mode: 'baked' };
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_PROXY_STATE === '1') {
      const deployedState = await proxy.getState();
      console.error('proxy-deployed-state', {
        contract: implArtifact.contractName,
        owner: deployedState.OwnableStorage___owner instanceof Uint8Array
          ? binToHex(deployedState.OwnableStorage___owner) : deployedState.OwnableStorage___owner,
      });
    }

    const handle = wrapDispatch(new ProxyContract<TImpl>(proxy, implementation, shape, auth, runner));
    registerDeployment(proxy.inner.provider, {
      contractName: implArtifact.contractName,
      address: handle.address,
      lockingBytecode: proxy.inner.lockingBytecode,
      contract: handle,
    });

    // 3. With an initializer, run it through the proxy: its positional args set the proxy state.
    if (initializer && (mockInitializerState === undefined || mockInitializerHasEntries)) {
      if (initialState !== undefined && !Array.isArray(initialState)) {
        throw new Error(`Initializer '${initializer}' takes positional args - pass initialState as an array (or use { initializer: false } to seed state at genesis).`);
      }
      const initializerCall = handle.forward(initializer, (initialState ?? []) as FunctionArgument[])
        .withoutLogicalNonce();
      if (mockInitializerHasEntries) {
        initializerCall.setState(mockInitializerState as Record<string, any>);
        const initFn = implArtifact.abi.find((item) => item.name === initializer);
        for (const emitted of initFn?.emits ?? []) {
          if (emitted.eventName === 'OwnershipTransferred' && runner instanceof Signer) {
            initializerCall.emitEvent(emitted.eventName, new Uint8Array(), runner.getAddress());
          } else if (emitted.eventName === 'Initialized') {
            initializerCall.emitEvent(emitted.eventName, 1n);
          } else if (emitted.eventName.endsWith('AddressChanged')
            && Array.isArray(initialState) && initialState.length > 0) {
            initializerCall.emitEvent(emitted.eventName, initialState[0] as any);
          }
        }
      }
      await initializerCall.send();
    }

    // Mock chains do not run the production block-oracle keeper. Refresh only this completed deployment graph:
    // doing it before the initializer would invalidate that transaction's authenticated state transition, while
    // refreshing every registered deployment here makes unrelated contracts change out of band.
    const { syncMockBlockOracleDeployment } = await import('../oracle/blockOracleUpdater.js');
    await syncMockBlockOracleDeployment(proxy.inner.provider, { contract: handle });

    nonceReservation?.commit();
    return handle;
  } catch (error) {
    nonceReservation?.release();
    throw error;
  }
}

export interface UpgradeProxyOptions {
  /** Runner for the new implementation deploy and the returned handle. Defaults to the existing proxy runner. */
  runner?: ContractRunner;
  /** Deploy overrides for the new implementation genesis. */
  implementationOverrides?: DeployContractOptions;
}

/**
 * Assert the new implementation can decode the proxy's existing data-NFT commitments unchanged.
 * Retargeting does not migrate commitments, so even an appended field in an existing NFT is unsafe.
 */
export function assertAppendOnlyProxyLayout(previous: Artifact, next: Artifact): void {
  const prevLayout = previous.stateLayout;
  const nextLayout = next.stateLayout;
  if (!prevLayout || !nextLayout) return;
  // upgradeProxy retargets the implementation without migrating the proxy's existing data NFTs.
  // An untagged singleton becoming a multi-NFT layout changes NFT 0's commitment: multiple records carry
  // index tags. A newly added NFT would also have no live UTXO to read or spend.
  if (nextLayout.dataNftCount !== prevLayout.dataNftCount) {
    throw new Error(
      'Upgrade layout incompatibility: data NFT count changed '
      + `(old: ${prevLayout.dataNftCount}, new: ${nextLayout.dataNftCount}). `
      + 'Retargeting does not migrate existing proxy commitments or create data NFTs.',
    );
  }
  if (prevLayout.dataNftCount > 0 && hasDataNftIndexTags(prevLayout) !== hasDataNftIndexTags(nextLayout)) {
    throw new Error(
      'Upgrade layout incompatibility: data NFT index-tag encoding changed. '
      + 'Retargeting does not migrate existing proxy commitments.',
    );
  }
  const oldStructs = prevLayout.structs ?? [];
  const newStructs = nextLayout.structs ?? [];
  const checkedStructs = new Set<string>();
  const assertStructShape = (type: string): void => {
    const oldStruct = oldStructs.find((item) => type === item.name || type.startsWith(`${item.name}[`));
    const newStruct = newStructs.find((item) => type === item.name || type.startsWith(`${item.name}[`));
    if (!oldStruct && !newStruct) return;
    const name = oldStruct?.name ?? newStruct!.name;
    if (checkedStructs.has(name)) return;
    checkedStructs.add(name);
    if (!oldStruct || !newStruct
      || JSON.stringify(oldStruct.fields) !== JSON.stringify(newStruct.fields)) {
      throw new Error(
        `Upgrade layout incompatibility: struct '${name}' changed. `
        + 'Existing state fields must retain their complete encoded struct shape.',
      );
    }
    for (const field of oldStruct.fields) assertStructShape(field.type);
  };
  for (const oldVar of prevLayout.variables) {
    const newVar = nextLayout.variables.find((variable) => variable.name === oldVar.name);
    if (!newVar) {
      throw new Error(
        `Upgrade layout incompatibility: state variable '${oldVar.name}' exists in the old contract `
        + 'but is missing in the new contract. Existing encoded fields cannot be removed.',
      );
    }
    if (newVar.nftIndex !== oldVar.nftIndex || newVar.fieldIndex !== oldVar.fieldIndex) {
      throw new Error(
        `Upgrade layout incompatibility: state variable '${oldVar.name}' changed position `
        + `(old: nft=${oldVar.nftIndex}/field=${oldVar.fieldIndex}, `
        + `new: nft=${newVar.nftIndex}/field=${newVar.fieldIndex}). `
        + 'Existing encoded fields cannot be reordered.',
      );
    }
    if (newVar.type !== oldVar.type) {
      throw new Error(
        `Upgrade layout incompatibility: state variable '${oldVar.name}' changed type `
        + `(old: ${oldVar.type}, new: ${newVar.type}). `
        + 'State variable types cannot change during upgrade.',
      );
    }
    if ((newVar.dynamic === true) !== (oldVar.dynamic === true)
      || (newVar.packed === true) !== (oldVar.packed === true)) {
      throw new Error(
        `Upgrade layout incompatibility: state variable '${oldVar.name}' changed its wire encoding. `
        + 'Existing state fields cannot change dynamic or packed storage mode.',
      );
    }
    assertStructShape(oldVar.type);
  }
  for (const newVar of nextLayout.variables) {
    if (!prevLayout.variables.some((variable) => variable.name === newVar.name)) {
      throw new Error(
        `Upgrade layout incompatibility: state variable '${newVar.name}' adds an encoded field `
        + `to data NFT ${newVar.nftIndex}. Retargeting requires commitment migration for new fields.`,
      );
    }
  }
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function isProxyHandle(value: unknown): value is ProxyContract {
  return value instanceof ProxyContract || (typeof value === 'object' && value !== null
    && typeof (value as { forwardShape?: { mode?: unknown } }).forwardShape?.mode === 'string');
}

/**
 * The proxy an upgrade targets: the handle itself, or (as OpenZeppelin accepts) the address of a proxy deployed on
 * the network the upgrade runs on, or a contract handle carrying that address. Anything else is refused at once,
 * naming the address and the network: an address taken from another network's config names nothing here, and the
 * upgrade must fail rather than proceed with nothing.
 */
function resolveUpgradeTarget(target: unknown, runner: ContractRunner | undefined): ProxyContract {
  if (isProxyHandle(target)) return target;
  const provider = runner instanceof Signer ? runner.provider : runner;
  const network = provider?.network ?? 'the connected network';
  const carried = typeof target === 'object' && target !== null
    ? [(target as { target?: unknown }).target, (target as { address?: unknown }).address]
      .find((value): value is string => typeof value === 'string')
    : undefined;
  const address = typeof target === 'string' ? target.trim() : carried;
  if (address === undefined || address === '') {
    const got = typeof target === 'string' ? 'an empty address'
      : target === null || typeof target !== 'object' ? String(target) : 'an object without an address';
    throw new Error(`upgradeProxy: expected a deployed proxy or its address, got ${got}`);
  }
  const deployment = provider === undefined ? undefined : findDeploymentByAddressValue(provider, address)
    ?? (EVM_ADDRESS.test(address)
      ? findDeploymentBySolidityAddressPayload(provider, hexToBin(address.slice(2)))
      : undefined);
  if (deployment === undefined) throw new Error(`upgradeProxy: no proxy is deployed at ${address} on ${network}`);
  if (!isProxyHandle(deployment.contract)) {
    throw new Error(
      `upgradeProxy: the contract deployed at ${address} on ${network} ('${deployment.contractName}') is not a `
      + 'proxy; deploy it with upgrades.deployProxy to make it upgradeable.',
    );
  }
  return deployment.contract;
}

/**
 * OZ-shaped `upgrades.upgradeProxy(proxy, NewImplFactory)` for **param-mode** proxies (implementation is a
 * call argument). `proxy` is the proxy handle or its address; an address with no proxy deployed on the network
 * is refused at once. Re-wraps the same state-holding proxy with a newly deployed implementation; no on-chain
 * proxy mutation. Default baked `SolidCashProxy` refuses — its implementation lock is a constructor pin, so
 * same-address upgrade requires a new P2SH (migrate) or a param-mode custom proxy.
 */
export async function upgradeProxy<TImpl extends Artifact>(
  proxyOrAddress: ProxyContract | string,
  newImplementationFactory: ContractFactory<TImpl>,
  options: UpgradeProxyOptions = {},
): Promise<ProxyContract<TImpl>> {
  const proxy = resolveUpgradeTarget(
    proxyOrAddress,
    options.runner ?? (newImplementationFactory as { runner?: ContractRunner } | undefined)?.runner,
  );
  if (proxy.forwardShape.mode !== 'param') {
    throw new Error(
      'upgrades.upgradeProxy only supports param-mode proxies (forwarder takes address impl). '
      + `This proxy uses '${proxy.forwardShape.mode}' mode with a constructor-baked implementation pin; `
      + 'deploy a new proxy and migrate state, or use a custom param-mode proxy.',
    );
  }

  const runner = options.runner ?? proxy.runner;
  const sourceArtifact = newImplementationFactory.artifact;
  const implArtifact = sourceArtifact.delegateArtifact
    ?? (sourceArtifact.abi.some((fn) => fn.modifiers?.includes('delegate')) ? sourceArtifact : undefined);
  if (!implArtifact) {
    throw new Error(
      `Implementation '${sourceArtifact.contractName}' has no inferred delegate variant and cannot be `
      + 'deployed behind a proxy. It needs an externally-callable function that mutates proxy-owned state.',
    );
  }

  // Param-mode keeps the proxy's own state layout (not grafted). Both the live proxy holder and the
  // previous implementation must accept the new implementation's unchanged physical commitment layout.
  assertAppendOnlyProxyLayout(proxy.proxy.inner.artifact, implArtifact);
  assertAppendOnlyProxyLayout(proxy.implementation.inner.artifact, implArtifact);

  const delegateFactory = new ContractFactory(implArtifact as TImpl, runner);
  const implementation = await delegateFactory.deploy({
    ...(options.implementationOverrides ?? {}),
    logicalNonce: false,
  }) as DeployedContract<TImpl>;

  const handle = wrapDispatch(new ProxyContract<TImpl>(
    proxy.proxy,
    implementation,
    proxy.forwardShape,
    proxy.auth,
    runner,
  ));
  registerDeployment(proxy.proxy.inner.provider, {
    contractName: implArtifact.contractName,
    address: handle.address,
    lockingBytecode: proxy.proxy.inner.lockingBytecode,
    contract: handle,
  });
  return handle;
}

/** The ethers/hardhat `upgrades` namespace. */
export const upgrades = { deployProxy, upgradeProxy };
