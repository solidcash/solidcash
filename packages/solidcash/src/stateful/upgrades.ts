import { hexToBin } from '@bitauth/libauth';
import { Artifact, AbiFunction } from '@solidcash/utils';
import {
  ContractFactory, DeployedContract, DeployContractOptions,
} from './ContractFactory.js';
import { StatefulContract, StatefulFunctionCall, ContractRunner } from './StatefulContract.js';
import Signer from '../Signer.js';
import SignatureTemplate from '../SignatureTemplate.js';
import { FunctionArgument } from '../Argument.js';
import { addressToLockScript } from '../utils.js';
import { defaultProxyArtifact } from './defaultProxyArtifact.js';

// OpenZeppelin-hardhat-upgrades-style proxy deployment for stateful contracts.
//
// `upgrades.deployProxy(ImplFactory, initialState)` deploys the implementation (a `delegate`-backed contract),
// deploys a proxy that holds the live state, seeds the proxy state with `initialState`, and returns a handle whose
// method calls forward to the implementation through a pinned delegatecall (the C1 co-spend pin).
//
// By default the built-in `SolidCashProxy` is used: its bytecode is layout-INDEPENDENT (it never reads its own
// state fields), so deployProxy grafts the implementation's stateLayout onto it and bakes the implementation
// address as an immutable constructor arg. Pass `options.proxy` to use a custom proxy contract instead. On BCH the
// proxy and implementation are separate on-chain contracts with a compatible state layout (unlike EVM, where a
// generic proxy bytecode wraps any implementation). See docs/upgrades.md + docs/delegatecall-security.md.

// The forwarding function's calling convention, detected from the proxy ABI:
//   'baked'    - f(bytes input): the implementation is a baked constructor arg (the default proxy). Permissionless.
//   'param'    - f(bytes input, address impl, ...auth): the implementation is a call param (custom proxy).
//   'fallback' - __fallback(): a bare fallback (the implementation is auto-derived from the co-spend).
type ForwardMode = 'baked' | 'param' | 'fallback';

interface ForwardShape {
  name: string;
  mode: ForwardMode;
}

export interface DeployProxyOptions {
  // OZ-style initializer. Default (undefined) auto-detects an `initialize` delegate function and runs it with the
  // init args through the proxy (the Ethereum flow, for drop-in ports). `false` skips it and seeds state directly
  // at genesis (the SolidCash-native constructor style). A string names a different initializer function.
  initializer?: string | false;
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
    private readonly forwardShape: ForwardShape,
    private readonly auth: (signer: Signer) => FunctionArgument[],
    private readonly runner: ContractRunner,
  ) {}

  /** The proxy address (the stable, state-holding address callers interact with). */
  get address(): string { return this.proxy.address; }

  getAddress(): Promise<string> { return Promise.resolve(this.proxy.address); }

  /** Await both genesis transactions (ethers `waitForDeployment`). */
  async waitForDeployment(): Promise<this> {
    await this.implementation.waitForDeployment();
    await this.proxy.waitForDeployment();
    return this;
  }

  deploymentTransaction(): ReturnType<DeployedContract['deploymentTransaction']> {
    return this.proxy.deploymentTransaction();
  }

  /** Rebind to a different runner for authorizing forwarded calls (ethers `connect`). */
  connect(runner: ContractRunner): ProxyContract<TImpl> {
    return new ProxyContract(this.proxy, this.implementation, this.forwardShape, this.auth, runner);
  }

  /**
   * Forward an implementation function through the proxy via a pinned delegatecall. Returns the call builder
   * (chain `.send()`), so the co-spend + selector pin (finding C1) are wired automatically:
   *   proxy.forward('increment', [args]).send()
   */
  forward(
    implFunction: string, implArgs: FunctionArgument[] = [], extraForwardArgs: FunctionArgument[] = [],
  ): StatefulFunctionCall {
    const abiFn = (this.implementation.inner.artifact.abi as readonly AbiFunction[])
      .find((f) => f.name === implFunction);
    if (!abiFn) throw new Error(`Implementation '${this.implementation.inner.artifact.contractName}' has no function '${implFunction}'.`);
    const implSc = this.implementation as unknown as StatefulContract;
    const proxyCall = (this.proxy.call as Record<string, (...a: unknown[]) => StatefulFunctionCall>);
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
    return builder.withDelegatecall(implSc, implFunction, implArgs);
  }
}

// The dispatch proxy: pass known ProxyContract members through; treat any other property access as an
// implementation-function forward (`proxy.increment(...args)` -> `proxy.forward('increment', [...args])`).
function wrapDispatch<TImpl extends Artifact>(handle: ProxyContract<TImpl>): ProxyContract<TImpl> {
  const implAbi = new Set((handle.implementation.inner.artifact.abi as readonly AbiFunction[]).map((f) => f.name));
  return new Proxy(handle, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && implAbi.has(prop) && !(prop in target)) {
        return (...args: FunctionArgument[]) => target.forward(prop, args);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

// Resolve the OZ-style initializer to a function name (or undefined for genesis init). `false` disables it; a
// string names it (and must exist + be a `delegate`); undefined auto-detects an `initialize` delegate function.
// EVM proxies must init via a function called through the proxy (a constructor would set the impl's storage, not
// the proxy's); on BCH genesis sets the proxy's state directly, so a plain state seed is the native equivalent.
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
// own state fields, so it holds any implementation's state. Keep the proxy's own constructorInputs (`implementation`).
function graftDefaultProxy(impl: Artifact): Artifact {
  return {
    ...defaultProxyArtifact,
    stateLayout: { ...impl.stateLayout, constructorInputs: defaultProxyArtifact.stateLayout?.constructorInputs },
  } as Artifact;
}

/**
 * ethers/hardhat `upgrades.deployProxy(ImplFactory, initialState?, options)`. Deploys the implementation and a
 * state-holding proxy, seeds the proxy state, and returns a handle whose method calls forward to the implementation
 * through a pinned delegatecall. By default the built-in `SolidCashProxy` is used (the implementation address is
 * baked as an immutable constructor arg); pass `options.proxy` to use a custom proxy contract.
 */
export async function deployProxy<TImpl extends Artifact>(
  implementationFactory: ContractFactory<TImpl>,
  initialState?: ProxyInitialState,
  options: DeployProxyOptions = {},
): Promise<ProxyContract<TImpl>> {
  const runner = options.runner ?? implementationFactory.runner;
  const auth = options.auth ?? defaultAuth;
  const implArtifact = implementationFactory.artifact;

  // An initializer runs after genesis to set state; otherwise the state is seeded directly at genesis.
  const initializer = resolveInitializer(options.initializer, implArtifact);
  const seededState = initializer ? undefined : toInitialState(initialState, implArtifact);

  // 1. Deploy the implementation (the delegate carrying the logic). Its own state is unused - the proxy holds it.
  const implementation = await implementationFactory.connect(runner).deploy(
    ...(options.implementationOverrides ? [options.implementationOverrides] : []),
  ) as DeployedContract<TImpl>;

  // 2. Deploy the proxy. Custom proxy -> its own genesis; default proxy -> graft the implementation's layout + bake
  //    the implementation's locking bytecode as the constructor arg. With no initializer, seed the state here.
  let proxy: DeployedContract;
  let shape: ForwardShape;
  if (options.proxy) {
    proxy = await new ContractFactory(options.proxy, runner)
      .deploy({ ...options.proxyOverrides, initialState: seededState });
    shape = detectForwardShape(options.proxy, options.forwardFunction);
  } else {
    const implLbc = addressToLockScript(implementation.address);
    proxy = await new ContractFactory(graftDefaultProxy(implArtifact), runner)
      .deploy(implLbc, { ...options.proxyOverrides, initialState: seededState });
    shape = { name: '__forward', mode: 'baked' };
  }

  const handle = wrapDispatch(new ProxyContract<TImpl>(proxy, implementation, shape, auth, runner));

  // 3. If an initializer is used, run it through the proxy (the Ethereum flow) - the init args are its positional
  //    arguments, so the delegate sets the proxy state.
  if (initializer) {
    if (initialState !== undefined && !Array.isArray(initialState)) {
      throw new Error(`Initializer '${initializer}' takes positional args - pass initialState as an array (or use { initializer: false } to seed state at genesis).`);
    }
    await handle.forward(initializer, (initialState ?? []) as FunctionArgument[]).send();
  }

  return handle;
}

/** The ethers/hardhat `upgrades` namespace. */
export const upgrades = { deployProxy };
