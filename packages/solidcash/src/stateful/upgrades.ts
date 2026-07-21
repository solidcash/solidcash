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
import { SplitContract, SplitContractBundle } from './SplitContractBundle.js';

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

export interface DeployProxyOptions {
  // OZ-style initializer. Default auto-detects an `initialize` delegate function and runs it with the init args
  // through the proxy; `false` seeds state at genesis instead; a string names a different initializer.
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
    const abiFn = (this.implementation.inner.artifact.abi as readonly AbiFunction[])
      .find((f) => f.name === implFunction);
    if (!abiFn) throw new Error(`Implementation '${this.implementation.inner.artifact.contractName}' has no function '${implFunction}'.`);
    const implSc = this.implementation as unknown as StatefulContract;
    // Connect the proxy to the runner so the forwarded call carries the signer. Its native P2PKH input funds the
    // tx and - crucially - is what the delegatecall'd impl's `emitTxOrigin` resolves `msg.sender` to. Without this
    // the proxy call has no _signer, the SDK funds with a dummy input, and a delegate impl that uses msg.sender
    // (e.g. `initialize` setting `this.owner = msg.sender`) reverts in emitTxOrigin.
    const runnerProxy = this.runner instanceof Signer ? this.proxy.connect(this.runner) : this.proxy;
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
    return builder.withDelegatecall(implSc, implFunction, implArgs);
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
  return new Proxy(handle, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && !(prop in target)) {
        if (implAbi.has(prop)) return (...args: FunctionArgument[]) => target.forward(prop, args);
        if (stateVars.has(prop)) {
          const underlying = target.proxy as unknown as Record<string, (...a: unknown[]) => unknown>;
          if (typeof underlying[prop] === 'function') return (...args: unknown[]) => underlying[prop](...args);
        }
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
// own state fields, so it holds any implementation's state. Keep the proxy's own constructorInputs (`implementation`).
function graftDefaultProxy(impl: Artifact): Artifact {
  return {
    ...defaultProxyArtifact,
    stateLayout: { ...impl.stateLayout, constructorInputs: defaultProxyArtifact.stateLayout?.constructorInputs },
  } as Artifact;
}

/**
 * ethers/hardhat `upgrades.deployProxy(ImplFactory, initialState?, options)`: deploy the implementation + a
 * state-holding proxy, seed the state, and return a handle whose method calls forward to the implementation
 * through the pinned delegatecall. Uses the built-in SolidCashProxy unless `options.proxy` is given.
 */
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
): Promise<ProxyContract<TImpl> | SplitContract> {
  // A compiler-generated split bundle already contains the state-holding root. Deploy it directly: its
  // forwarders target facets in one hop, so no P -> implementation-router -> facet stack is introduced.
  if (implementationFactory instanceof SplitContractBundle) {
    if (options.proxy) throw new Error('A split implementation cannot be wrapped in a custom proxy (nested delegatecall is unsupported).');
    if (typeof options.initializer === 'string') {
      throw new Error('A split implementation does not support delegate initializer routing; seed state at genesis.');
    }
    const nonLinkCtorInputs = implementationFactory.bundle.root.constructorInputs.filter(
      (input) => !input.name.startsWith('__facetAddr_'),
    );
    if (nonLinkCtorInputs.length > 0) {
      throw new Error(
        'Split deployProxy requires a constructor-free logical implementation; found: '
        + nonLinkCtorInputs.map((input) => input.name).join(', '),
      );
    }
    const seeded = toInitialState(initialState, implementationFactory.bundle.root);
    const facetOverrides = options.implementationOverrides
      ? Object.fromEntries(implementationFactory.bundle.manifest.facets.map(
        (facet) => [facet.name, options.implementationOverrides!],
      ))
      : undefined;
    return implementationFactory.deploy([], {
      ...options.proxyOverrides,
      initialState: seeded,
      ...(facetOverrides && { facetOverrides }),
    });
  }
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

  // 3. With an initializer, run it through the proxy: its positional args set the proxy state.
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
