/**
 * The ethers-shaped surface a SolidCash network presents (`hre.ethers`): signers, contract factories and attached
 * contracts over one provider. It reads compiled artifacts through an `ArtifactSource`, so it runs where no file system
 * is: the HRE hands it the project's artifacts directory (`hre.ts`), and a browser app the artifacts it bundles.
 */
import { encodeCashAddress } from '@bitauth/libauth/build/lib/address/cash-address.js';
import { hexToBin, binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { hash160 } from '@bitauth/libauth/build/lib/crypto/combinations.js';
import { cashAddressToLockingBytecode } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { SigningKey as EthersSigningKey } from 'ethers/crypto';
import { hashMessage as hashEvmMessage, verifyMessage as verifyEvmMessage } from 'ethers/hash';
import { getBytes as getEthersBytes } from 'ethers/utils';
import type { Artifact, FunctionSplitBundle, SplitArtifactBundle } from '@solidcash/utils';
import { decodedSolidityAddressIdentity } from '@solidcash/utils';
import type { NetworkProvider, ConstructorArgument, Utxo } from '@solidcash/solidcash';
import type {
  ContractRunner, ConnectedStatefulContract, SplitContract, SplitDeployOptions,
  DeployedContract, DeployContractOptions,
} from '@solidcash/solidcash/stateful';
import { listDeployments } from '@solidcash/solidcash/stateful';
import { framedDeploy } from '@solidcash/solidcash/framed';
import { Network as Networks } from '@solidcash/solidcash/dist/interfaces.js';
import MockNetworkProvider from '@solidcash/solidcash/dist/network/MockNetworkProvider.js';
import RegtestNetworkProvider from '@solidcash/solidcash/dist/network/RegtestNetworkProvider.js';
import Signer from '@solidcash/solidcash/dist/Signer.js';
import { HDSigner, signersFromMnemonic } from '@solidcash/solidcash/hdsigner';
import {
  ContractFactory, getContractFactory as sdkGetContractFactory, deployContract as sdkDeployContract, fanOutPlainUtxos,
} from '@solidcash/solidcash/dist/stateful/ContractFactory.js';
import type { SplitContractBundle } from '@solidcash/solidcash/dist/stateful/SplitContractBundle.js';
import { randomUtxo } from '@solidcash/solidcash/dist/utils.js';
import * as ethersUtils from './ethers-utils.js';
import { getCreateAddressForComposition } from './ethers-shim.js';

/** Where the runtime reads compiled artifacts by contract name. */
export interface ArtifactSource {
  /** The contract's artifact. Throws when there is none. */
  artifact(name: string): Artifact;
  /** The per-entry bundle a `split: 'func'` compile published, or undefined for a contract published whole. */
  functionSplit(name: string): FunctionSplitBundle | undefined;
  /** A split-bundle deployment's bundle where one is published, else the contract's artifact. */
  artifactOrSplit(name: string): Artifact | SplitArtifactBundle;
}

/** Plain coins each regtest signer holds; mock accounts hold 512. */
export const REGTEST_PLAIN_COINS = 64;
export const DEFAULT_MNEMONIC = MockNetworkProvider.DEFAULT_MNEMONIC;
// BCH's per-input unlocking bytecode limit, which the relaxed mock defaults lift.
export const PRODUCTION_MAXIMUM_INPUT_BYTES = 10_000;
export const HARDHAT_ACCOUNT_BRANCH = "m/44'/60'/0'/0";

// StatefulContract is the single heaviest SDK module (~759 KB and its transitive graph). The HRE only needs it
// when a contract is attached/deployed (`Contract`/`getContractAt`), so it is loaded lazily and cached. `initHre`
// awaits this before publishing the HRE, keeping the module out of the entry package's import graph.
export type StatefulContractCtor = typeof import('@solidcash/solidcash/dist/stateful/StatefulContract.js').StatefulContract;
let statefulContractCtor: StatefulContractCtor | undefined;
export async function loadStatefulContract(): Promise<StatefulContractCtor> {
  if (!statefulContractCtor) {
    statefulContractCtor = (await import('@solidcash/solidcash/dist/stateful/StatefulContract.js')).StatefulContract;
  }
  return statefulContractCtor;
}


/** Augmented by generated TypeChain registries so literal contract names retain their artifact type. */
export interface SolidcashArtifactMap {}
export type ArtifactForName<Name extends string> = Name extends keyof SolidcashArtifactMap
  ? SolidcashArtifactMap[Name]
  : Artifact;

/** The BCH-native `hre.ethers` object: forwarded utils + network-bound signer/contract helpers. */
export interface SolidcashEthers {
  provider: NetworkProvider;
  getSigners(count?: number, opts?: { satoshis?: bigint; mnemonic?: string }): Promise<Signer[]>;
  getSigner(index?: number, opts?: { satoshis?: bigint; mnemonic?: string }): Promise<Signer>;
  /** Recover using the projection selected by `compiler.ecrecover` (`p2pkh` for native BCH identity). */
  verifyMessage(message: string | Uint8Array, signature: Parameters<typeof verifyEvmMessage>[1]): string;
  /** Recover the native BCH P2PKH CashAddress on the active network. */
  verifyMessageP2pkh(message: string | Uint8Array, signature: Parameters<typeof verifyEvmMessage>[1]): string;
  /** Recover the conventional ethers/Solidity 20-byte EVM address. */
  verifyMessageEvm(message: string | Uint8Array, signature: Parameters<typeof verifyEvmMessage>[1]): string;
  // Accept a compiled artifact object OR a contract name (hardhat `getContractFactory("Name")`).
  getContractFactory<Value extends Artifact | SplitArtifactBundle | string>(artifactOrName: Value,
    runner?: ContractRunner): Value extends SplitArtifactBundle ? HardhatSplitContractFactory
    : ContractFactory<Value extends Artifact ? Value : Value extends string ? ArtifactForName<Value> : Artifact>;
  getContractAt<Value extends Artifact | SplitArtifactBundle | string>(artifactOrName: Value, addressOrCategory: string,
    runner?: ContractRunner): Promise<Value extends SplitArtifactBundle ? SplitContract : ConnectedStatefulContract<
  Value extends Artifact ? Value : Value extends string ? ArtifactForName<Value> : Artifact>>;
  deployContract<Value extends Artifact | SplitArtifactBundle | string>(artifactOrName: Value,
    args?: ConstructorArgument[], runner?: ContractRunner, overrides?: DeployContractOptions): Promise<
  Value extends SplitArtifactBundle ? SplitContract : DeployedContract<
  Value extends Artifact ? Value : Value extends string ? ArtifactForName<Value> : Artifact>>;
  // classes (BCH-native)
  Contract: StatefulContractCtor;
  ContractFactory: typeof ContractFactory;
  Signer: typeof Signer;
  // ethers `Wallet` (`new Wallet(wif, provider)`) plus a BCH `createRandom` that returns a funded ad-hoc HDSigner.
  Wallet: typeof Signer & { createRandom(provider?: NetworkProvider): HDSigner };
  HDSigner: typeof HDSigner;
  HDNodeWallet: typeof HDSigner & {
    fromMnemonic(mnemonic: string | { phrase: string }, path?: string): HDSigner;
  };
  [k: string]: unknown; // forwarded ethers utils (parseEther, keccak256, AbiCoder, constants, ...)
}

export function isSplitBundle(value: unknown): value is SplitArtifactBundle {
  return typeof value === 'object' && value !== null
    && (value as { format?: string }).format === 'solidcash-split-v1';
}

/** Positional ethers deploy facade over the SDK's explicit split-bundle deployment API. */
export class HardhatSplitContractFactory {
  private splitInstance?: SplitContractBundle;
  constructor(readonly bundle: SplitArtifactBundle, readonly runner: ContractRunner) {}

  private async loadSplit(): Promise<SplitContractBundle> {
    if (!this.splitInstance) {
      const { SplitContractBundle: SplitContractBundleValue } = await import('@solidcash/solidcash/dist/stateful/SplitContractBundle.js');
      this.splitInstance = SplitContractBundleValue.from(this.bundle, this.runner);
    }
    return this.splitInstance;
  }

  get artifact(): Artifact { return this.bundle.root; }
  connect(runner: ContractRunner): Promise<HardhatSplitContractFactory> {
    return Promise.resolve(new HardhatSplitContractFactory(this.bundle, runner));
  }

  async deploy(...values: unknown[]): Promise<SplitContract> {
    const split = await this.loadSplit();
    let options: SplitDeployOptions = {};
    const last = values.at(-1);
    if (typeof last === 'object' && last !== null && !(last instanceof Uint8Array) && !Array.isArray(last)) {
      options = values.pop() as SplitDeployOptions;
    }
    return split.deploy(values as ConstructorArgument[], options);
  }

  async at(address: string, constructorArgs: ConstructorArgument[] = []): Promise<SplitContract> {
    const split = await this.loadSplit();
    return split.at(address, constructorArgs);
  }
}


export interface EthersOptions {
  /** Where compiled artifacts come from: the project's artifacts directory, or an in-memory map in a browser. */
  artifacts: ArtifactSource;
  composition?: 'direct' | 'framed';
  /** The contract a framed CREATE2 over a code value stands up, by the code's keccak256 as hex. */
  create2Templates?: Record<string, string>;
  accountsPath?: string;
  /** `accounts.initialIndex`: the first derived account, so signer i is wallet initialIndex + i. */
  accountsInitialIndex?: number;
  accountSatoshis?: bigint;
  recoveryProjection: 'p2pkh' | 'evm';
  /** False binds every deploy to the address its own transaction produces instead of a stable CREATE identity. */
  logicalIdentity: boolean;
}

/** Hardhat signers use EIP-191 message signatures; the BCH SDK signer intentionally uses Bitcoin Signed Message. */
function withEthersMessageSigning<T extends Signer>(signer: T): T {
  const connect = signer.connect.bind(signer);
  Object.defineProperty(signer, 'signingKey', {
    configurable: true,
    get: (): EthersSigningKey => new EthersSigningKey(signer.privateKey),
  });
  Object.defineProperty(signer, 'signMessage', {
    configurable: true,
    value: async (message: string | Uint8Array): Promise<string> =>
      new EthersSigningKey(signer.privateKey).sign(hashEvmMessage(message)).serialized,
  });
  // EIP-712 typed-data signing is a plain secp256k1 signature over the typed-data digest. BCH covenant
  // ecrecover verifies the same curve, so the ethers-parity method can produce the EVM-shaped signature the
  // ported permit() tests expect instead of refusing the operation.
  Object.defineProperty(signer, 'signTypedData', {
    configurable: true,
    value: async (
      domain: Record<string, unknown>, types: Record<string, unknown>, value: Record<string, unknown>,
    ): Promise<string> => {
      const { TypedDataEncoder } = await import('ethers/hash');
      // EIP-712's `address` type is a 20-byte EVM word. A ported contract sees its own address (and every
      // argument) as the 20-byte identity hash160(lock), so normalize CashAddress strings to that same value
      // before hashing; ethers rejects a CashAddress as an address.
      const evmAddress = (candidate: unknown): unknown => {
        if (typeof candidate !== 'string' || /^0x[0-9a-fA-F]{40}$/.test(candidate)) return candidate;
        try {
          const decoded = cashAddressToLockingBytecode(candidate) as unknown as { bytecode?: Uint8Array };
          if (decoded?.bytecode) {
            const lock = decoded.bytecode;
            const hex = binToHex(lock);
            // A P2PKH/P2SH20 address's identity is the payload; a contract (P2SH32) commits to hash160(lock).
            if (lock.length === 25 && hex.startsWith('76a914') && hex.endsWith('88ac')) return `0x${hex.slice(6, 46)}`;
            if (lock.length === 23 && hex.startsWith('a914') && hex.endsWith('87')) return `0x${hex.slice(4, 44)}`;
            return `0x${binToHex(hash160(lock))}`;
          }
        } catch { /* not a CashAddress */ }
        return candidate;
      };
      const normalize = (typeName: string, candidate: unknown): unknown => {
        if (typeName === 'address') return evmAddress(candidate);
        if (typeName.endsWith('[]') && Array.isArray(candidate)) {
          return candidate.map((entry) => normalize(typeName.slice(0, -2), entry));
        }
        const fields = (types as Record<string, unknown>)[typeName];
        if (Array.isArray(fields) && candidate !== null && typeof candidate === 'object') {
          const copy: Record<string, unknown> = { ...(candidate as Record<string, unknown>) };
          for (const field of fields as Array<{ name: string; type: string }>) {
            copy[field.name] = normalize(field.type, copy[field.name]);
          }
          return copy;
        }
        return candidate;
      };
      const normalizedDomain = { ...domain };
      if ('verifyingContract' in normalizedDomain) {
        normalizedDomain.verifyingContract = evmAddress(normalizedDomain.verifyingContract);
      }
      const primary = (Object.keys(types) as string[]).find((name) => name !== 'EIP712Domain');
      const normalizedValue = primary === undefined ? value : normalize(primary, value) as Record<string, unknown>;
      const digest = TypedDataEncoder.hash(
        normalizedDomain as never, types as never, normalizedValue as never,
      );
      return new EthersSigningKey(signer.privateKey).sign(digest).serialized;
    },
  });
  // ethers' plain value transfer. To a framed contract it is a value send that runs the contract's `receive()`, else
  // its payable `fallback()`, as an EVM transfer to a contract does; call data and a wallet-to-wallet payment have no
  // composed form here and are refused by name.
  Object.defineProperty(signer, 'sendTransaction', {
    configurable: true,
    value: async (request: { readonly to?: unknown; readonly value?: unknown; readonly data?: unknown }) => {
      const target = request.to as { getAddress?: () => Promise<string> | string; target?: unknown } | string;
      const to = typeof target === 'string' ? target
        : typeof target?.getAddress === 'function' ? await target.getAddress() : String(target?.target ?? target);
      if (request.data !== undefined && request.data !== '0x' && request.data !== '') {
        throw new Error('sendTransaction() carries call data; call the contract through its handle instead');
      }
      const value = BigInt((request.value as bigint | number | string | undefined) ?? 0);
      const { findDeploymentByAddress } = await import('@solidcash/solidcash/stateful');
      const deployed = findDeploymentByAddress(signer.provider as never, to)?.contract as {
        categoryId?: string; inner?: { artifact?: Artifact };
      } | undefined;
      const artifact = deployed?.inner?.artifact;
      if (deployed?.categoryId === undefined || artifact?.composition?.convention !== 'framed') {
        throw new Error(`sendTransaction() to ${to}: only a value send to a framed contract is composed`);
      }
      const { framedCall } = await import('@solidcash/solidcash/framed');
      return framedCall.sendFramedValueFromSigner({
        provider: signer.provider, artifact, categoryId: deployed.categoryId, signer, value,
      });
    },
  });
  Object.defineProperty(signer, 'connect', {
    configurable: true,
    value: (nextProvider: NetworkProvider): Signer => withEthersMessageSigning(connect(nextProvider)),
  });
  return signer;
}

export function buildEthers(provider: NetworkProvider, mnemonic: string, opts: EthersOptions): SolidcashEthers {
  const { artifacts, accountsPath, accountsInitialIndex = 0 } = opts;
  // Every deploy in the project starts from this convention; a call's own trailing overrides refine it.
  const deployDefaults: DeployContractOptions = opts.logicalIdentity ? {} : { logicalNonce: false };
  const fundRegtestSigner = async (
    signer: Signer, satoshis: bigint, desiredCount: number,
  ): Promise<void> => {
    if (!(provider instanceof RegtestNetworkProvider)) return;
    // No local cache: a fixture snapshot restore rewinds the chain, so an address that was funded when
    // this provider was first seen can be empty again. Re-checking the node is the source of truth.
    // Each `addUtxo` is its own transaction with the requested output at vout 0, which is the geometry
    // CREATE look-ahead reserves. Fund serially because every call spends a shared wallet coin.
    const existing = await provider.getUtxos(signer.getAddress());
    // Mock accounts come pre-split into 512 coins so compiler-owned funder slots never meet an artificial wallet
    // limit. A regtest signer gets the same room from one fan-out, fed by one extra coin so the vout-0 coins above
    // stay intact; with four coins a nested oracle slot found the shared funder pool empty.
    const fanOut = existing.filter((utxo) => !utxo.token).length < REGTEST_PLAIN_COINS;
    for (let index = existing.length; index < desiredCount + (fanOut ? 1 : 0); index += 1) {
      await provider.addUtxo(signer.getAddress(), randomUtxo({ satoshis }));
    }
    if (fanOut) await fanOutPlainUtxos(signer, REGTEST_PLAIN_COINS);
  };
  // A framed contract a `split: 'func'` compile published as a bundle deploys one master pool per entry.
  const withFunctionSplit = (defaults: DeployContractOptions, artifact: Artifact): DeployContractOptions => {
    if (artifact.composition?.convention !== 'framed') return defaults;
    const functionSplit = artifacts.functionSplit(artifact.contractName);
    return functionSplit === undefined ? defaults : { ...defaults, functionSplit };
  };
  const resolveArtifact = <T extends Artifact>(a: T | SplitArtifactBundle | string): T | SplitArtifactBundle =>
    (typeof a === 'string' ? artifacts.artifactOrSplit(a) : a) as T | SplitArtifactBundle;

  // A local HD signer is one object per account, so every handle on an account, the factory's default deployer
  // included, counts its logical nonce once: two objects for one key would number two deployments alike, and the
  // second would land at the first's address. The mock provider keeps its own signers; this serves the others.
  const localSigners = new Map<string, Signer>();
  const localSigner = (index: number, accountMnemonic: string): Signer => {
    const key = `${accountMnemonic}\u0000${index}`;
    let signer = localSigners.get(key);
    if (signer === undefined) {
      [signer] = signersFromMnemonic(accountMnemonic, provider, { count: 1, path: accountsPath, initialIndex: index });
      localSigners.set(key, signer!);
    }
    return signer!;
  };

  // hardhat `getContractFactory("Name")` binds to the default deployer = signers[0]. Derive it synchronously
  // (same identity `getSigners()` funds), so `factory.deploy(...)` funds the genesis from that account.
  let cachedSigner: Signer | undefined;
  const defaultRunner = (): ContractRunner => {
    const anyProvider = provider as unknown as { getSigners?: unknown };
    // Regtest has local HD signers even though its provider has no `getSigners` fast path. Live networks
    // (Electrum, Bitcoin RPC) do not, and a factory without a signer needs the provider as its runner.
    if (typeof anyProvider.getSigners !== 'function' && provider.network !== Networks.REGTEST) return provider;
    const cacheable = provider as unknown as { getCachedSigner?: (index: number, opts: object) => Signer };
    cachedSigner ??= typeof cacheable.getCachedSigner === 'function'
      ? cacheable.getCachedSigner(accountsInitialIndex, { mnemonic, path: accountsPath })
      : localSigner(accountsInitialIndex, mnemonic);
    return cachedSigner;
  };

  const getSigners = async (
    count = 20, o: { satoshis?: bigint; mnemonic?: string; fundingUtxos?: number } = {},
  ): Promise<Signer[]> => {
    const anyProvider = provider as unknown as { getSigners?: (c: number, x: object) => Promise<Signer[]> };
    if (typeof anyProvider.getSigners === 'function') {
      // A read-only CREATE look-ahead reserves four existing vout-0 coins without broadcasting. Partition
      // mock prefunding across distinct transactions so nonce-relative predictions have those coins ready,
      // while the nonzero outputs stay available for fees and compiler-owned block slots. This changes the
      // account's coin geometry, never its configured coin count or per-coin value.
      return (await anyProvider.getSigners(count, {
        // Bounded message-bus participant blocks can require dozens of
        // category-neutral filler inputs in one call. Keep the Hardhat-style
        // mock accounts generously pre-split so those compiler-owned slots do
        // not turn into an artificial wallet-funding limit.
        satoshis: opts.accountSatoshis ?? 100_000_000n,
        fundingUtxos: 512, genesisFundingUtxos: 4, mnemonic, path: accountsPath, initialIndex: accountsInitialIndex, ...o,
      })).map(withEthersMessageSigning);
    }
    const signers = Array.from({ length: count }, (_unused, at) =>
      withEthersMessageSigning(localSigner(accountsInitialIndex + at, o.mnemonic ?? mnemonic)));
    const satoshis = o.satoshis ?? opts.accountSatoshis ?? 100_000_000n;
    const fundingUtxos = o.fundingUtxos ?? 4;
    for (const [index, signer] of signers.entries()) {
      // The default deployer performs every CREATE in a fixture. Give it enough genesis-eligible vout-0
      // coins for the child contracts; the other participants only spend.
      await fundRegtestSigner(signer, satoshis, index === 0 ? Math.max(fundingUtxos, 16) : fundingUtxos);
    }
    return signers;
  };

  // A CREATE2 over a code value is resolved through the template table; the child is created in its creator's own
  // transaction (docs/framed/CREATE2_IDENTITY.md), so no deployer is installed.
  if (opts.composition === 'framed') {
    for (const [codeHash, contractName] of Object.entries(opts.create2Templates ?? {})) {
      framedDeploy.registerFramedCreate2Template(provider, hexToBin(codeHash.replace(/^0x/, '')), contractName);
    }
  }

  const verifyMessageP2pkh: SolidcashEthers['verifyMessageP2pkh'] = (message, signature) => {
    const recovered = EthersSigningKey.recoverPublicKey(hashEvmMessage(message), signature);
    const compressed = getEthersBytes(EthersSigningKey.computePublicKey(recovered, true));
    const prefix = provider.network === 'mainnet' ? 'bitcoincash'
      : provider.network === 'regtest' ? 'bchreg'
        : 'bchtest';
    return encodeCashAddress({
      prefix, type: 'p2pkh', payload: hash160(compressed), throwErrors: true,
    }).address;
  };
  const verifyMessageEvm: SolidcashEthers['verifyMessageEvm'] = (message, signature) =>
    verifyEvmMessage(message, signature);

  // ethers `Wallet.createRandom()` returns a fresh HDNodeWallet with no provider; ported tests then
  // `.connect(provider)` and use it as an unauthorized signer. Bind the active provider and, on a mock network,
  // fund it (fire-and-forget: MockNetworkProvider.addUtxo mutates the in-memory indexer synchronously) so the
  // covenant call can be built and reach its owner check. Live/regtest providers have no addUtxo - funding is the
  // caller's job there, matching getSigners.
  class Wallet extends Signer {
    static createRandom(providerOverride?: NetworkProvider): HDSigner {
      const p = providerOverride ?? provider;
      const s = HDSigner.createRandom(p);
      const fundable = p as unknown as { addUtxo?: (a: string, u: Utxo) => Promise<Utxo> };
      if (typeof fundable.addUtxo === 'function') {
        // Fund lazily, when the wallet is actually read. A suite may restore a fixture between createRandom()
        // and the call; eager funding would land above that snapshot and be invalidated. Re-checking also
        // re-funds a wallet whose previous coin was spent by an earlier call.
        const ensureFunded = async (): Promise<void> => {
          if ((await p.getUtxos(s.getAddress())).length === 0) {
            await fundable.addUtxo!(s.getAddress(), randomUtxo({ satoshis: 1_000_000n }));
          }
        };
        const originalGetUtxos = s.getUtxos.bind(s);
        (s as unknown as { getUtxos: () => Promise<Utxo[]> }).getUtxos = async () => {
          await ensureFunded();
          return originalGetUtxos();
        };
      }
      return withEthersMessageSigning(s);
    }
  }
  // ethers v6 keeps this compatibility constructor on HDNodeWallet. Unlike `HDSigner.fromPhrase`, its
  // provider is supplied later with `.connect(provider)`, so bind the active HRE provider temporarily.
  const HDNodeWallet = Object.assign(HDSigner, {
    fromMnemonic(mnemonicValue: string | { phrase: string }, derivationPath?: string): HDSigner {
      const phrase = typeof mnemonicValue === 'string' ? mnemonicValue : mnemonicValue.phrase;
      return withEthersMessageSigning(HDSigner.fromPhrase(phrase, provider, derivationPath));
    },
  });

  // After a factory deploys, auto-register every deployTarget child whose artifact is already compiled
  // into `artifactsDir`. Hardhat/MistSwap suites call `factory.createPair(...)` without an explicit
  // `registerChild(UniswapV2Pair)` — the multi-contract compile already produced both artifacts, so
  // looking them up by the ABI's deployTargets is the least-surprise path (see createPair wall).
  type Registerable = {
    registerChild?: (a: Artifact) => unknown;
    inner?: { artifact?: Artifact };
    artifact?: Artifact;
  };
  const registerDeployTargetChildren = (deployed: Registerable): void => {
    if (typeof deployed.registerChild !== 'function') return;
    const art = deployed.inner?.artifact ?? deployed.artifact;
    const targets = (art?.abi ?? [])
      .flatMap((fn) => fn.deployTargets ?? [])
      .map((t) => t.contractName)
      .filter((name): name is string => typeof name === 'string' && name.length > 0);
    for (const name of new Set(targets)) {
      try {
        const child = artifacts.artifact(name);
        deployed.registerChild(child);
      } catch {
        // Child not compiled yet / name mismatch — leave unresolved; deployFrom will still error clearly.
      }
    }
  };

  const wrapFactoryDeploy = <T extends Artifact>(factory: ContractFactory<T>, loaded: Artifact): ContractFactory<T> => {
    const original = factory.deploy.bind(factory);
    factory.deploy = (async (...args: Parameters<ContractFactory<T>['deploy']>) => {
      const deployed = await original(...args);
      registerDeployTargetChildren(deployed as Registerable);
      return presentAddresses(deployed as object, loaded) as typeof deployed;
    }) as ContractFactory<T>['deploy'];
    return factory;
  };

  const contractFactory = (<T extends Artifact>(artifactOrName: T | SplitArtifactBundle | string,
    runner?: ContractRunner): ContractFactory<T> | HardhatSplitContractFactory => {
    const loaded = resolveArtifact(artifactOrName);
    const boundRunner = runner ?? defaultRunner();
    if (isSplitBundle(loaded)) {
      return new HardhatSplitContractFactory(loaded, boundRunner);
    }
    return wrapFactoryDeploy(
      sdkGetContractFactory(loaded as T, boundRunner, withFunctionSplit(deployDefaults, loaded as Artifact)),
      loaded as Artifact,
    );
  }) as SolidcashEthers['getContractFactory'];
  // ethers semantics: (taker) contract methods win a name collision with a framework member. The SDK's dispatch
  // proxy lets a framework member keep its own name, so `pair.name()` would resolve the contract-name getter;
  // a getter-created contract must expose the ABI routine under that bare name, as ethers does.
  const preferAbiMethods = <T extends object>(contract: T, loaded: Artifact): T => {
    const abiNames = new Set((loaded.abi ?? []).map((entry) => entry.name).filter(Boolean));
    return new Proxy(contract, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && abiNames.has(prop)) {
          const direct = Reflect.get(target, prop, target);
          if (typeof direct !== 'function') {
            const getFunction = Reflect.get(target, 'getFunction', target);
            if (typeof getFunction === 'function') return (getFunction as (name: string) => unknown).call(target, prop);
          }
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  };
  // A Solidity-compat read answers an `address` with its 20-byte identity (DECISIONS D13), or under `addressForm:
  // 'bytecode'` with the whole lock (D56), while a handle's `getAddress()` names a contract by its address, so a test
  // that compares a getter's answer with a contract's address by `===`, as ethers lets it, would never find them
  // equal. A framed handle answers an address whose identity names a deployment the provider registers with that
  // deployment's address instead; any other address, a key's hash or lock or the zero address, is answered as given,
  // and a handle the contract connects to a signer answers the same way.
  const presentAddresses = <T extends object>(contract: T, loaded: Artifact): T => {
    if (loaded.composition?.convention !== 'framed') return contract;
    const addressGetters = new Set((loaded.abi ?? [])
      .filter((entry) => entry.outputs?.length === 1 && entry.outputs[0]!.type === 'address')
      .map((entry) => entry.name));
    const addressOf = (value: unknown): unknown => {
      if (!(value instanceof Uint8Array) || value.length === 0) return value;
      const identityBytes = value.length === 20 ? value : decodedSolidityAddressIdentity(value);
      if (identityBytes === undefined) return value;
      const identity = binToHex(identityBytes);
      const registered = [...listDeployments(provider as never)].reverse().find((entry) => entry.address === identity
        || (entry.lockingBytecode !== undefined && binToHex(hash160(hexToBin(entry.lockingBytecode))) === identity));
      const named = (registered?.contract as { _framedAddress?: string } | undefined)?._framedAddress;
      return named ?? (registered !== undefined && registered.address !== identity ? registered.address : value);
    };
    return new Proxy(contract, {
      get(target, prop, receiver) {
        const member = Reflect.get(target, prop, receiver);
        if (prop === 'connect' && typeof member === 'function') {
          return (...args: unknown[]) => presentAddresses((member as (...a: unknown[]) => object).apply(target, args),
            loaded);
        }
        if (typeof prop !== 'string' || !addressGetters.has(prop) || typeof member !== 'function') return member;
        const getter = member as ((...args: unknown[]) => unknown) & { staticCall?: (...args: unknown[]) => unknown };
        const answered = (...args: unknown[]): Promise<unknown> =>
          Promise.resolve(getter.apply(target, args)).then(addressOf);
        return Object.assign(answered, {
          staticCall: (...args: unknown[]) => Promise.resolve((getter.staticCall ?? getter).apply(target, args))
            .then(addressOf),
        });
      },
    });
  };
  const contractAt = (<T extends Artifact>(artifactOrName: T | SplitArtifactBundle | string,
    addressOrCategory: string, runner?: ContractRunner) => {
    const loaded = resolveArtifact(artifactOrName);
    if (isSplitBundle(loaded)) {
      return new HardhatSplitContractFactory(loaded, runner ?? defaultRunner())
        .at(addressOrCategory);
    }
    return (async () => {
      const SC = await loadStatefulContract();
      // A factory-created child's address commits to its category, which only the creating frame knows. Reuse
      // the registered handle so `getContractAt` reads the state this session actually deployed.
      const { findDeploymentByAddress, listDeployments: listRegistered } = await import('@solidcash/solidcash/stateful');
      let registered = typeof addressOrCategory === 'string'
        ? findDeploymentByAddress(provider as never, addressOrCategory) : undefined;
      // A getter's decoded `address` is the 20-byte Solidity identity of the child's physical lock, or under
      // `addressForm: 'bytecode'` that whole lock; resolve either by the identity against the same registry when a
      // test feeds that value back into `getContractAt`.
      const rawAddress: unknown = addressOrCategory;
      const rawIdentity = rawAddress instanceof Uint8Array
        ? (rawAddress.length === 20 ? rawAddress : decodedSolidityAddressIdentity(rawAddress)) : undefined;
      if (registered === undefined && rawIdentity !== undefined) {
        const wanted = binToHex(rawIdentity);
        registered = [...listRegistered(provider as never)].reverse().find((entry) => (
          entry.lockingBytecode !== undefined
          && binToHex(hash160(hexToBin(entry.lockingBytecode))) === wanted
        ));
      }
      // Once the identity maps to a deployment, connect through that deployment's cash address: the identity
      // is not itself an address, and `SC.at` needs either a category or a spendable address to resolve state.
      const lookupAddress: string | undefined = registered?.address
        ?? (typeof addressOrCategory === 'string' ? addressOrCategory : undefined);
      if ((globalThis as any).process?.env?.DEBUG_CREATE2) {
        console.error('CONTRACT_AT', addressOrCategory, loaded.contractName, registered?.contractName,
          registered?.category);
      }
      if (registered?.contractName === loaded.contractName && registered.category !== undefined) {
        // Rebuild the child with the exact salt and category its creator used: the data-NFT covenant embeds the
        // (salted) master lock, so an unsalted handle would query the wrong state addresses.
        const options: Record<string, unknown> = { provider, addressType: 'p2sh32' };
        if (registered.salt !== undefined) options.salt = hexToBin(registered.salt);
        const child = SC.from(loaded as T, [], options as never, registered.category);
        // A framed deployment is addressed by the lock its frames present, which a CREATE2 child presents as its
        // identity: the rebuilt handle keeps the address the deployed one carries, so `getAddress()` names it.
        const deployedHandle = registered.contract as { _framedAddress?: string } | undefined;
        if (deployedHandle?._framedAddress !== undefined) {
          (child as unknown as { _framedAddress?: string })._framedAddress = deployedHandle._framedAddress;
        }
        // ethers parity: `getContractAt` connects the default signer just like `.at()` does. Without it the
        // builder provisions no native P2PKH input, and a covenant reading msg.sender/tx.origin (emitTxOrigin
        // scans for exactly that input) refuses the transaction with an empty origin.
        const signingRunner = defaultRunner() as unknown as {
          unlockP2PKH?: unknown; getAddress?: unknown; _logicalNonceSigner?: unknown;
        };
        if (typeof signingRunner?.unlockP2PKH === 'function' && typeof signingRunner.getAddress === 'function') {
          (child as unknown as { _signer?: unknown })._signer = signingRunner;
          (child as unknown as { _logicalNonceSigner?: unknown })._logicalNonceSigner = signingRunner;
        }
        return presentAddresses(preferAbiMethods(child as object, loaded), loaded) as typeof child;
      }
      if (lookupAddress === undefined) {
        throw new Error(
          `getContractAt: no deployment matches the address ${binToHex(rawAddress as Uint8Array)}`,
        );
      }
      // `at` is async (it eagerly resolves the category); await it before the dispatch proxy wraps the handle,
      // otherwise the proxy shadows `Promise.prototype.then` and the caller's `await` throws.
      const connected = await SC.at(lookupAddress, loaded as T, runner ?? defaultRunner());
      // A frame runs a category's entry on its shard only when the category's bundle is registered, which its genesis
      // does in the deploying process. This HRE deploys a framed contract from the bundle its artifacts publish
      // (`withFunctionSplit`), so a category attached in another process was minted from that bundle too; without it
      // the call composes the logical program, whose master outgrows an input.
      const attachedCategory = (connected as unknown as { categoryId?: string }).categoryId;
      const attachedSplit = withFunctionSplit({}, loaded as Artifact).functionSplit;
      if (attachedSplit !== undefined && attachedCategory !== undefined
        && framedDeploy.functionSplitFor(provider, attachedCategory) === undefined) {
        framedDeploy.registerFunctionSplit(provider, attachedCategory, attachedSplit);
      }
      // A framed deployment is addressed by the lock its frames present: the connected handle keeps the address the
      // registered one carries, so `getAddress()` names the contract the identity named, as the child branch does.
      const registeredHandle = registered?.contract as { _framedAddress?: string } | undefined;
      if (registeredHandle?._framedAddress !== undefined) {
        (connected as unknown as { _framedAddress?: string })._framedAddress = registeredHandle._framedAddress;
      } else if (attachedCategory !== undefined && (loaded as Artifact).composition?.convention === 'framed') {
        // A deployment this process did not make is registered as its deployment registers it: at the lock its
        // frames present, which another contract that stored its address calls it by, and at the address it was
        // attached by.
        const { registerDeployment } = await import('@solidcash/solidcash/stateful');
        const framedAddress = framedDeploy.framedContractAddress(provider.network, attachedCategory);
        (connected as unknown as { _framedAddress?: string })._framedAddress = framedAddress;
        const decodedLock = cashAddressToLockingBytecode(framedAddress);
        if (typeof decodedLock === 'string') throw new Error(`getContractAt: ${decodedLock}`);
        const lockingBytecode = binToHex(decodedLock.bytecode);
        for (const address of new Set([framedAddress, lookupAddress])) {
          registerDeployment(provider as never, {
            contractName: (loaded as Artifact).contractName, address, lockingBytecode, contract: connected,
          });
        }
      }
      registerDeployTargetChildren(connected as Registerable);
      return presentAddresses(preferAbiMethods(connected as object, loaded), loaded) as typeof connected;
    })();
  }) as SolidcashEthers['getContractAt'];
  const contractDeploy = (<T extends Artifact>(artifactOrName: T | SplitArtifactBundle | string,
    args: ConstructorArgument[] = [], runner?: ContractRunner, overrides?: DeployContractOptions) => {
    const loaded = resolveArtifact(artifactOrName);
    if (isSplitBundle(loaded)) {
      return new HardhatSplitContractFactory(loaded, runner ?? defaultRunner())
        .deploy(...args, ...(overrides ? [overrides] : []));
    }
    return (async () => {
      // A contract whose surface moves native value needs a satoshi container to spend, exactly like an
      // account with a balance. Fund one at deployment (the deploy API's `initialBalance`) unless the caller
      // asks for a specific balance; without it the first payable transfer aborts before the covenant runs.
      const valueMoving = (loaded as Artifact).abi?.some((entry) => (entry.transferCount ?? 0) > 0
        || (entry.blockLayout?.slots ?? []).some((slot) => slot.kind === 'satoshiContainer')) === true;
      const initialBalance = overrides?.initialBalance ?? (valueMoving ? 200_000n : undefined);
      const deployed = await sdkDeployContract(
        loaded as T, args, runner ?? defaultRunner(),
        {
          ...withFunctionSplit(deployDefaults, loaded as Artifact),
          ...(initialBalance === undefined ? {} : { initialBalance }), ...overrides,
        },
      );
      registerDeployTargetChildren(deployed as Registerable);
      return presentAddresses(deployed as object, loaded as Artifact) as typeof deployed;
    })();
  }) as SolidcashEthers['deployContract'];

  // ethers-compatible block surface used by Hardhat-era helpers (MistSwap `test/utilities/time.ts`):
  //   ethers.provider.getBlockNumber() / getBlock("latest") / send("evm_mine", ...)
  // MockNetworkProvider already implements `send` for the common evm_* methods; layer the missing
  // getBlock* shims without mutating the underlying NetworkProvider instance.
  const ethersProvider = provider as NetworkProvider & {
    getBlockNumber?: () => Promise<number>;
    getBlock?: (tag?: string | number) => Promise<{ number: number; timestamp: number; hash?: string }>;
    getCode?: (address: string) => Promise<string>;
    getBlockHeight: () => Promise<number>;
    getBlockTime?: () => number;
    getBlockHash?: (height: number) => Promise<string>;
  };
  if (typeof (ethersProvider as { getBalance?: unknown }).getBalance !== 'function') {
    // ethers' native-balance read, as the UTXO sum at the address. Ported suites use it to assert an ETH
    // transfer; on BCH the same value is the satoshi balance of the address's coins.
    (ethersProvider as { getBalance?: (address: string | { address?: string }) => Promise<bigint> }).getBalance =
      async (address: string | { address?: string }): Promise<bigint> => {
        const value = typeof address === 'string' ? address : address?.address ?? String(address);
        // A framed contract's balance is the value its satoshi containers hold (spec 4b): the coins at its own
        // address carry its validator and masters, whose dust is no part of what the contract owns.
        const { findDeploymentByAddress } = await import('@solidcash/solidcash/stateful');
        const deployed = findDeploymentByAddress(provider as never, value)?.contract as {
          categoryId?: string; inner?: { artifact?: Artifact };
        } | undefined;
        if (deployed?.categoryId !== undefined && deployed.inner?.artifact?.composition?.convention === 'framed') {
          const containers = await framedDeploy.readSatoshiContainers(provider, deployed.categoryId);
          return containers.reduce((sum, utxo) => sum + utxo.satoshis, 0n);
        }
        const utxos = await provider.getUtxos(value);
        return utxos.reduce((sum, utxo) => sum + utxo.satoshis, 0n);
      };
  }
  if (typeof ethersProvider.getBlockNumber !== 'function') {
    ethersProvider.getBlockNumber = async (): Promise<number> => ethersProvider.getBlockHeight();
  }
  if (typeof ethersProvider.getCode !== 'function') {
    // ethers `getCode`: an address a contract is deployed at holds code, any other address "0x". A contract's address
    // is a logical identity, whose anchor commits to the root locking bytecode it runs as, or the script its state
    // coins sit at; a key's address (P2PKH) holds no code whatever it holds.
    ethersProvider.getCode = async (address: string): Promise<string> => {
      const decoded = cashAddressToLockingBytecode(address);
      if (typeof decoded === 'string') return '0x';
      const lock = binToHex(decoded.bytecode);
      if (/^76a914[0-9a-f]{40}88ac$/.test(lock)) return '0x';
      const { resolveLogicalIdentity } = await import('@solidcash/solidcash/stateful');
      try {
        const identity = await resolveLogicalIdentity(provider, address);
        return `0x${binToHex(identity.rootLockingBytecode)}`;
      } catch (error) {
        if (!/missing or invalid/.test(error instanceof Error ? error.message : String(error))) throw error;
      }
      return (await provider.getUtxos(address)).length > 0 ? `0x${lock}` : '0x';
    };
  }
  if (typeof ethersProvider.getBlock !== 'function') {
    ethersProvider.getBlock = async (
      _tag: string | number = 'latest',
    ): Promise<{ number: number; timestamp: number; hash?: string }> => {
      const number = await ethersProvider.getBlockHeight();
      const timestamp = typeof ethersProvider.getBlockTime === 'function'
        ? ethersProvider.getBlockTime()
        : Math.floor(Date.now() / 1000);
      const hash = typeof ethersProvider.getBlockHash === 'function'
        ? await ethersProvider.getBlockHash(number)
        : undefined;
      return { number, timestamp, hash };
    };
  }

  const ethers: SolidcashEthers = {
    ...ethersUtils,
    getCreateAddress: (tx: { from: string; nonce: number | bigint }) =>
      getCreateAddressForComposition(tx, opts.composition),
    provider: ethersProvider,
    getSigners,
    verifyMessage: opts.recoveryProjection === 'p2pkh' ? verifyMessageP2pkh : verifyMessageEvm,
    verifyMessageP2pkh,
    verifyMessageEvm,
    getSigner: async (index = 0, o = {}): Promise<Signer> => {
      const anyProvider = provider as unknown as { getSigner?: (i: number, x: object) => Promise<Signer> };
      if (typeof anyProvider.getSigner === 'function') {
        return withEthersMessageSigning(await anyProvider.getSigner(index, {
          satoshis: opts.accountSatoshis, mnemonic, path: accountsPath, initialIndex: accountsInitialIndex, ...o,
        }));
      }
      const connected = withEthersMessageSigning(localSigner(accountsInitialIndex + index, o.mnemonic ?? mnemonic));
      await fundRegtestSigner(
        connected, o.satoshis ?? opts.accountSatoshis ?? 100_000_000n, index === 0 ? 16 : 4,
      );
      return connected;
    },
    getContractFactory: contractFactory,
    getContractAt: contractAt,
    deployContract: contractDeploy,
    get Contract(): StatefulContractCtor {
      if (!statefulContractCtor) {
        throw new Error('SolidCash HRE: StatefulContract is not loaded yet; await initHre() before using ethers.Contract.');
      }
      return statefulContractCtor;
    },
    ContractFactory,
    Signer,
    Wallet,
    HDSigner,
    HDNodeWallet,
  };
  return ethers;
}

