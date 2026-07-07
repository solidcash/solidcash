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

// OpenZeppelin-hardhat-upgrades-style proxy deployment for stateful contracts.
//
// `upgrades.deployProxy(ImplFactory, initialState, { proxy })` deploys the implementation (a `delegate`-backed
// contract), deploys the proxy that holds the live state, seeds the proxy state with `initialState`, and returns a
// handle whose method calls forward to the implementation through a pinned delegatecall (the C1 co-spend pin).
//
// On BCH the proxy and implementation are separate on-chain contracts with a compatible state layout (unlike EVM,
// where a generic proxy bytecode wraps any implementation), so the proxy artifact is provided in `options.proxy`.
// The forwarding function is auto-detected: a pinned forwarder `f(bytes input, address impl, ...auth)` (preferred,
// forces + pins the delegate co-spend) or a bare `__fallback()`. See docs/delegatecall-security.md.

/** The implementation's forwarding function shape, detected from the proxy ABI. */
interface ForwardShape {
  name: string;
  pinned: boolean; // pinned: leads with (bytes input, address impl); else a bare __fallback()
}

export interface DeployProxyOptions {
  // The proxy contract artifact (SolidCash needs a proxy contract separate from the implementation).
  proxy: Artifact;
  // Runner (Signer or NetworkProvider) to deploy + sign with. Defaults to the implementation factory's runner.
  runner?: ContractRunner;
  // The proxy's pure-forwarding function name. Auto-detected ('f(bytes,address,...)' then '__fallback') if omitted.
  forwardFunction?: string;
  // Build the pinned forwarder's trailing auth args from the connected signer. Default: [pubkey, SignatureTemplate].
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

// Find the proxy's forwarding function: a pinned forwarder `f(bytes input, address impl, ...)` (preferred), else a
// bare `__fallback()`. An explicit name overrides the search.
function detectForwardShape(proxy: Artifact, explicit?: string): ForwardShape {
  const abi = proxy.abi as readonly AbiFunction[];
  if (explicit) {
    const fn = abi.find((f) => f.name === explicit);
    if (!fn) throw new Error(`Proxy has no forwarding function '${explicit}'.`);
    return { name: fn.name, pinned: isPinnedForwarder(fn) };
  }
  const pinned = abi.find(isPinnedForwarder);
  if (pinned) return { name: pinned.name, pinned: true };
  const fallback = abi.find((f) => f.name === '__fallback');
  if (fallback) return { name: '__fallback', pinned: false };
  throw new Error(
    'Proxy has no forwarding function: expected a pinned forwarder f(bytes input, address impl, ...) or a '
    + "'__fallback()'. Pass options.forwardFunction to name it explicitly.",
  );
}

function isPinnedForwarder(fn: AbiFunction): boolean {
  return fn.inputs.length >= 2 && fn.inputs[0].type === 'bytes' && fn.inputs[1].type === 'address';
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

    let builder: StatefulFunctionCall;
    if (this.forwardShape.pinned) {
      if (!abiFn.selector) throw new Error(`Implementation function '${implFunction}' has no selector.`);
      const selector = hexToBin(abiFn.selector);
      const implLbc = addressToLockScript(this.implementation.address);
      const signer = this.runner instanceof Signer ? this.runner : undefined;
      const authArgs = signer ? this.auth(signer) : [];
      builder = proxyCall[this.forwardShape.name](selector, implLbc, ...authArgs, ...extraForwardArgs);
    } else {
      builder = proxyCall[this.forwardShape.name](...extraForwardArgs);
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

/**
 * ethers/hardhat `upgrades.deployProxy(ImplFactory, initialState?, options)`. Deploys the implementation and a
 * state-holding proxy, seeds the proxy state, and returns a handle whose method calls forward to the implementation
 * through a pinned delegatecall. `options.proxy` (the proxy artifact) is required.
 */
export async function deployProxy<TImpl extends Artifact>(
  implementationFactory: ContractFactory<TImpl>,
  initialState?: ProxyInitialState,
  options?: DeployProxyOptions,
): Promise<ProxyContract<TImpl>> {
  if (!options?.proxy) {
    throw new Error(
      'deployProxy needs options.proxy (the proxy contract artifact). On BCH the proxy is a separate on-chain '
      + 'contract with a layout compatible with the implementation. See docs/delegatecall-security.md.',
    );
  }
  const runner = options.runner ?? implementationFactory.runner;
  const auth = options.auth ?? defaultAuth;
  const implArtifact = implementationFactory.artifact;

  // 1. Deploy the implementation (the delegate carrying the logic). Its own state is unused - the proxy holds it.
  const implementation = await implementationFactory.connect(runner).deploy(
    ...(options.implementationOverrides ? [options.implementationOverrides] : []),
  ) as DeployedContract<TImpl>;

  // 2. Deploy the proxy, seeding the live state with initialState.
  const proxyFactory = new ContractFactory(options.proxy, runner);
  const proxy = await proxyFactory.deploy({
    ...options.proxyOverrides,
    initialState: toInitialState(initialState, implArtifact),
  });

  const shape = detectForwardShape(options.proxy, options.forwardFunction);
  return wrapDispatch(new ProxyContract<TImpl>(proxy, implementation, shape, auth, runner));
}

/** The ethers/hardhat `upgrades` namespace. */
export const upgrades = { deployProxy };
