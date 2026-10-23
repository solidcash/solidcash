/**
 * The SolidCash Hardhat Runtime Environment (HARDHAT-PARITY.md WS2, decision D2). Presents a Hardhat-v2-shaped
 * surface (`hre.ethers.*`, `hre.network`, `hre.run`) over a connection seam (`hre.network.create()`), so a v3
 * mode can layer on later without a rewrite. `hre.ethers` merges the forwarded ethers utils with the BCH-native
 * signer/contract helpers bound to the active network provider.
 */
import fs from 'fs';
import path from 'path';
import { encodeCashAddress } from '@bitauth/libauth/build/lib/address/cash-address.js';
import { hash160 } from '@bitauth/libauth/build/lib/crypto/combinations.js';
import { SigningKey as EthersSigningKey } from 'ethers/crypto';
import { hashMessage as hashEvmMessage, verifyMessage as verifyEvmMessage } from 'ethers/hash';
import { getBytes as getEthersBytes } from 'ethers/utils';
import type { Artifact, SplitArtifactBundle } from '@solidcash/utils';
import type { Network, NetworkProvider, ConstructorArgument, Utxo, ConsensusLimits, NetworkPolicy } from '@solidcash/solidcash';
import type {
  ContractRunner, ConnectedStatefulContract, SplitContract, SplitDeployOptions,
  DeployedContract, DeployContractOptions,
} from '@solidcash/solidcash/stateful';
import { Network as Networks } from '@solidcash/solidcash/dist/interfaces.js';
import MockNetworkProvider, { MOCK_CONSENSUS_LIMITS } from '@solidcash/solidcash/dist/network/MockNetworkProvider.js';
import RegtestNetworkProvider from '@solidcash/solidcash/dist/network/RegtestNetworkProvider.js';
import ElectrumNetworkProvider from '@solidcash/solidcash/dist/network/ElectrumNetworkProvider.js';
import BitcoinRpcNetworkProvider from '@solidcash/solidcash/dist/network/BitcoinRpcNetworkProvider.js';
import Signer from '@solidcash/solidcash/dist/Signer.js';
import { HDSigner, signersFromMnemonic } from '@solidcash/solidcash/hdsigner';
import {
  ContractFactory, getContractFactory as sdkGetContractFactory, deployContract as sdkDeployContract, fanOutPlainUtxos,
} from '@solidcash/solidcash/dist/stateful/ContractFactory.js';
import type { SplitContractBundle } from '@solidcash/solidcash/dist/stateful/SplitContractBundle.js';
import { randomUtxo } from '@solidcash/solidcash/dist/utils.js';

/** Plain coins each regtest signer holds; mock accounts hold 128. */
const REGTEST_PLAIN_COINS = 64;
import * as ethersUtils from './ethers-utils.js';
import { getCreateAddressForComposition } from './ethers-shim.js';
import * as nh from './network-helpers.js';
import { setActiveProvider } from './network-helpers.js';
import {
  type ResolvedConfig, type NetworkConfig, loadConfig, resolveConfig, type SolidcashConfig,
} from './config.js';
import {
  runTask, getTasks, getTask, type TaskArguments, type TaskDefinition,
} from './tasks.js';
import { solidcashArtifactsPath } from './artifact-paths.js';

const DEFAULT_MNEMONIC = MockNetworkProvider.DEFAULT_MNEMONIC;
// BCH's per-input unlocking bytecode limit, which the relaxed mock defaults lift.
const PRODUCTION_MAXIMUM_INPUT_BYTES = 10_000;
const HARDHAT_ACCOUNT_BRANCH = "m/44'/60'/0'/0";

function liveSigningChain(name: string, netCfg: NetworkConfig | undefined): string | undefined {
  const type = netCfg?.type;
  if (type !== 'electrum' && type !== 'bitcoin-rpc') return undefined;
  const inferred = name === 'mainnet' || name === 'chipnet' || name === 'testnet3' || name === 'testnet4'
    ? name : undefined;
  const chain = netCfg?.network ?? inferred;
  if (chain === undefined || chain === 'regtest') return undefined;
  return chain;
}

/**
 * Refuses a live network whose phrase also signs on another live chain: a BCH signature carries no chain id. Checked
 * when a live network is selected or connected, so mock and regtest commands still run.
 */
function assertLiveMnemonicIsChainSpecific(config: ResolvedConfig, selected: string): void {
  const chain = liveSigningChain(selected, config.networks[selected]);
  if (chain === undefined) return;
  const phrase = config.networks[selected].mnemonic ?? config.mnemonic;
  if (phrase === undefined) return;
  for (const [name, netCfg] of Object.entries(config.networks)) {
    const other = liveSigningChain(name, netCfg);
    if (other === undefined || other === chain || (netCfg.mnemonic ?? config.mnemonic) !== phrase) continue;
    throw new Error(
      `Network "${selected}" needs its own mnemonic. A shared phrase would sign on ${chain} and ${other} `
      + `(network "${name}"), and a BCH signature carries no chain id.`,
    );
  }
}

// StatefulContract is the single heaviest SDK module (~759 KB and its transitive graph). The HRE only needs it
// when a contract is attached/deployed (`Contract`/`getContractAt`), so it is loaded lazily and cached. `initHre`
// awaits this before publishing the HRE, keeping the module out of the entry package's import graph.
type StatefulContractCtor = typeof import('@solidcash/solidcash/dist/stateful/StatefulContract.js').StatefulContract;
let statefulContractCtor: StatefulContractCtor | undefined;
async function loadStatefulContract(): Promise<StatefulContractCtor> {
  if (!statefulContractCtor) {
    statefulContractCtor = (await import('@solidcash/solidcash/dist/stateful/StatefulContract.js')).StatefulContract;
  }
  return statefulContractCtor;
}

/** Build a network provider from a resolved network config. */
export function createProvider(name: string, netCfg: NetworkConfig | undefined): NetworkProvider {
  const type = netCfg?.type ?? (name === 'regtest' ? 'regtest' : name === 'mock' ? 'mock' : 'mock');
  const knownNetworks: readonly Network[] = [
    Networks.MAINNET, Networks.TESTNET3, Networks.TESTNET4, Networks.CHIPNET, Networks.REGTEST,
  ];
  const configuredNetwork = netCfg?.network ?? (
    knownNetworks.includes(name as Network) ? name as Network : undefined
  );
  switch (type) {
    case 'regtest': return new RegtestNetworkProvider({
      rpcUrl: netCfg?.rpc?.url,
      rpcUser: netCfg?.rpc?.user,
      rpcPassword: netCfg?.rpc?.password,
      consensusLimits: netCfg?.consensus as ConsensusLimits | undefined,
      policy: netCfg?.policy as NetworkPolicy | undefined,
    });
    case 'electrum': {
      if (configuredNetwork === undefined) {
        throw new Error(
          `Network "${name}" is not a known BCH network. Set network to mainnet, testnet3, testnet4, or chipnet.`,
        );
      }
      const network = configuredNetwork;
      if (network === Networks.REGTEST) {
        throw new Error('ElectrumNetworkProvider does not support regtest; use type "regtest" or "bitcoin-rpc".');
      }
      if (netCfg?.electrum?.port !== undefined) {
        throw new Error('Custom Electrum ports are not supported; configure a hostname using its standard port.');
      }
      return new ElectrumNetworkProvider(
        network,
        netCfg?.electrum?.host ? { hostname: netCfg.electrum.host } : {},
      );
    }
    case 'bitcoin-rpc': {
      if (!netCfg?.rpc?.url) throw new Error(`Network "${name}" requires rpc.url.`);
      if (!configuredNetwork) throw new Error(`Network "${name}" requires an explicit BCH network.`);
      if (!netCfg.rpc.user || !netCfg.rpc.password) {
        throw new Error(`Network "${name}" requires rpc.user and rpc.password.`);
      }
      return new BitcoinRpcNetworkProvider(configuredNetwork, netCfg.rpc.url, {
        rpcUser: netCfg.rpc.user, rpcPassword: netCfg.rpc.password,
      });
    }
    case 'mock':
    default: {
      const { enforceProductionInputLimit, ...policy }: NonNullable<NetworkConfig['policy']> = netCfg?.policy ?? {};
      return new MockNetworkProvider({
        consensusLimits: {
          ...MOCK_CONSENSUS_LIMITS,
          ...netCfg?.consensus,
          ...(enforceProductionInputLimit ? { maximumInputBytes: PRODUCTION_MAXIMUM_INPUT_BYTES } : {}),
        },
        policy,
      });
    }
  }
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

function isSplitBundle(value: unknown): value is SplitArtifactBundle {
  return typeof value === 'object' && value !== null
    && (value as { format?: string }).format === 'solidcash-split-v1';
}

/** Positional ethers deploy facade over the SDK's explicit split-bundle deployment API. */
class HardhatSplitContractFactory {
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

export interface NetworkConnection {
  name: string;
  provider: NetworkProvider;
  config: NetworkConfig | undefined;
  ethers: SolidcashEthers;
  networkHelpers: typeof nh;
}

export interface HardhatNetwork extends NetworkConnection {
  /** v3 seam: create a fresh isolated connection (new provider + bound helpers). */
  create(networkName?: string): Promise<NetworkConnection>;
  /** Hardhat 3 spelling for creating and selecting a connection. */
  connect(networkName?: string): Promise<NetworkConnection>;
}

export interface HardhatRuntimeEnvironment {
  config: ResolvedConfig;
  network: HardhatNetwork;
  ethers: SolidcashEthers;
  networkHelpers: typeof nh;
  tasks: { getTask: typeof getTask; getTasks: typeof getTasks };
  run(taskName: string, args?: TaskArguments): Promise<unknown>;
}

/**
 * hardhat `getContractFactory("Name")`: resolve a compiled artifact BY CONTRACT NAME. Mirrors hardhat's
 * name resolution - the compile task writes one `<Contract>.json` per contract (nested per source file), and
 * this recursively finds `<Name>.json` anywhere under the artifacts dir. Errors on ambiguity (like hardhat's
 * "multiple artifacts" - pass the artifact object to disambiguate).
 */
export function loadArtifactByName(artifactsDir: string, name: string): Artifact {
  const timingEnabled = process.env.SOLIDC_DEBUG_HARNESS_TIMING === '1';
  const startedAt = timingEnabled ? Date.now() : 0;
  const base = solidcashArtifactsPath(artifactsDir);
  const separator = name.lastIndexOf(':');
  const sourceName = separator === -1 ? undefined : name.slice(0, separator).replace(/\\/g, '/');
  const contractName = separator === -1 ? name : name.slice(separator + 1);
  const target = `${contractName}.json`;
  const matches: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name === target) {
        const relative = path.relative(base, p).replace(/\\/g, '/');
        if (!sourceName || !relative.includes('/') || relative.includes(`/${sourceName}/`) || relative.startsWith(`${sourceName}/`)
          || relative.includes(`/${sourceName}.scash/`) || relative.includes(`/${sourceName}.sol/`)) matches.push(p);
      }
    }
  };
  if (fs.existsSync(base)) walk(base);
  const parsed = matches.map((m) => JSON.parse(fs.readFileSync(m, 'utf-8')) as Artifact);
  // The flat backward-compat `<file>.json` and the nested `<file>.scash/<Contract>.json` are the SAME contract
  // when filename == contract name; they differ only in `updatedAt`. Dedupe by fingerprint (fall back to bytecode).
  const ident = (a: Artifact): string => (a as any).fingerprint ?? a.bytecode ?? JSON.stringify(a.abi);
  const distinct = new Map<string, Artifact>();
  parsed.forEach((a) => distinct.set(ident(a), a));
  if (timingEnabled) console.error('harness-artifact-timing', {
    name, matches: matches.length, ms: Date.now() - startedAt,
  });
  if (distinct.size === 1) return [...distinct.values()][0];
  if (distinct.size > 1) {
    throw new Error(
      `getContractFactory: multiple DISTINCT artifacts named "${name}" (${matches.map((m) => path.relative(base, m)).join(', ')}). `
      + 'Use a fully-qualified name (`source/path.scash:Contract`) or pass the artifact object to disambiguate.',
    );
  }
  throw new Error(
    `getContractFactory: no SolidCash artifact named "${name}" in ${base}. Compile it first (\`solidcash compile\`), `
    + 'or pass the artifact object directly.',
  );
}

export function loadArtifactOrSplitByName(artifactsDir: string, name: string): Artifact | SplitArtifactBundle {
  const base = solidcashArtifactsPath(artifactsDir);
  const splitPath = path.join(base, `${name}.split.json`);
  if (fs.existsSync(splitPath)) return JSON.parse(fs.readFileSync(splitPath, 'utf-8')) as SplitArtifactBundle;
  return loadArtifactByName(artifactsDir, name);
}

interface EthersOptions {
  artifactsDir: string;
  composition?: 'direct' | 'framed';
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
  Object.defineProperty(signer, 'connect', {
    configurable: true,
    value: (nextProvider: NetworkProvider): Signer => withEthersMessageSigning(connect(nextProvider)),
  });
  return signer;
}

function buildEthers(provider: NetworkProvider, mnemonic: string, opts: EthersOptions): SolidcashEthers {
  const { artifactsDir, accountsPath, accountsInitialIndex = 0 } = opts;
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
    // Mock accounts come pre-split into 128 coins so compiler-owned funder slots never meet an artificial wallet
    // limit. A regtest signer gets the same room from one fan-out, fed by one extra coin so the vout-0 coins above
    // stay intact; with four coins a nested oracle slot found the shared funder pool empty.
    const fanOut = existing.filter((utxo) => !utxo.token).length < REGTEST_PLAIN_COINS;
    for (let index = existing.length; index < desiredCount + (fanOut ? 1 : 0); index += 1) {
      await provider.addUtxo(signer.getAddress(), randomUtxo({ satoshis }));
    }
    if (fanOut) await fanOutPlainUtxos(signer, REGTEST_PLAIN_COINS);
  };
  const resolveArtifact = <T extends Artifact>(a: T | SplitArtifactBundle | string): T | SplitArtifactBundle =>
    (typeof a === 'string' ? loadArtifactOrSplitByName(artifactsDir, a) : a) as T | SplitArtifactBundle;

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
      : signersFromMnemonic(mnemonic, provider, { count: 1, path: accountsPath, initialIndex: accountsInitialIndex })[0];
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
        fundingUtxos: 128, genesisFundingUtxos: 4, mnemonic, path: accountsPath, initialIndex: accountsInitialIndex, ...o,
      })).map(withEthersMessageSigning);
    }
    const signers = signersFromMnemonic(o.mnemonic ?? mnemonic, provider, {
      count, path: accountsPath, initialIndex: accountsInitialIndex,
    })
      .map(withEthersMessageSigning);
    const satoshis = o.satoshis ?? opts.accountSatoshis ?? 100_000_000n;
    const fundingUtxos = o.fundingUtxos ?? 4;
    for (const [index, signer] of signers.entries()) {
      // The default deployer performs every CREATE in a fixture. Give it enough genesis-eligible vout-0
      // coins for the child contracts; the other participants only spend.
      await fundRegtestSigner(signer, satoshis, index === 0 ? Math.max(fundingUtxos, 16) : fundingUtxos);
    }
    return signers;
  };

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
        const child = loadArtifactByName(artifactsDir, name);
        deployed.registerChild(child);
      } catch {
        // Child not compiled yet / name mismatch — leave unresolved; deployFrom will still error clearly.
      }
    }
  };

  const wrapFactoryDeploy = <T extends Artifact>(factory: ContractFactory<T>): ContractFactory<T> => {
    const original = factory.deploy.bind(factory);
    factory.deploy = (async (...args: Parameters<ContractFactory<T>['deploy']>) => {
      const deployed = await original(...args);
      registerDeployTargetChildren(deployed as Registerable);
      return deployed;
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
    return wrapFactoryDeploy(sdkGetContractFactory(loaded as T, boundRunner, deployDefaults));
  }) as SolidcashEthers['getContractFactory'];
  const contractAt = (<T extends Artifact>(artifactOrName: T | SplitArtifactBundle | string,
    addressOrCategory: string, runner?: ContractRunner) => {
    const loaded = resolveArtifact(artifactOrName);
    if (isSplitBundle(loaded)) {
      return new HardhatSplitContractFactory(loaded, runner ?? defaultRunner())
        .at(addressOrCategory);
    }
    return (async () => {
      const SC = await loadStatefulContract();
      const connected = SC.at(addressOrCategory, loaded as T, runner ?? defaultRunner());
      registerDeployTargetChildren(connected as Registerable);
      return connected;
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
      const deployed = await sdkDeployContract(
        loaded as T, args, runner ?? defaultRunner(), { ...deployDefaults, ...overrides },
      );
      registerDeployTargetChildren(deployed as Registerable);
      return deployed;
    })();
  }) as SolidcashEthers['deployContract'];

  // ethers-compatible block surface used by Hardhat-era helpers (MistSwap `test/utilities/time.ts`):
  //   ethers.provider.getBlockNumber() / getBlock("latest") / send("evm_mine", ...)
  // MockNetworkProvider already implements `send` for the common evm_* methods; layer the missing
  // getBlock* shims without mutating the underlying NetworkProvider instance.
  const ethersProvider = provider as NetworkProvider & {
    getBlockNumber?: () => Promise<number>;
    getBlock?: (tag?: string | number) => Promise<{ number: number; timestamp: number; hash?: string }>;
    getBlockHeight: () => Promise<number>;
    getBlockTime?: () => number;
    getBlockHash?: (height: number) => Promise<string>;
  };
  if (typeof ethersProvider.getBlockNumber !== 'function') {
    ethersProvider.getBlockNumber = async (): Promise<number> => ethersProvider.getBlockHeight();
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
      const [signer] = signersFromMnemonic(o.mnemonic ?? mnemonic, provider, {
        initialIndex: accountsInitialIndex + index, count: 1, path: accountsPath,
      });
      const connected = withEthersMessageSigning(signer);
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

function buildConnection(name: string, netCfg: NetworkConfig | undefined, mnemonic: string, opts: EthersOptions)
  : NetworkConnection {
  const provider = createProvider(name, netCfg);
  const ethers = buildEthers(provider, mnemonic, opts);
  return { name, provider, config: netCfg, ethers, networkHelpers: nh };
}

/** Create an HRE from a resolved config, selecting `networkName` (defaults to config.defaultNetwork). */
export function createHardhatRuntimeEnvironment(config: ResolvedConfig, networkName?: string)
  : HardhatRuntimeEnvironment {
  const name = networkName ?? config.defaultNetwork;
  const validateNetwork = (candidate: string): NetworkConfig => {
    if (!Object.hasOwn(config.networks, candidate)) {
      throw new Error(
        `Network "${candidate}" is not configured. Available networks: ${Object.keys(config.networks).join(', ')}`,
      );
    }
    const candidateConfig = config.networks[candidate];
    const selectedNetwork = candidateConfig.network ?? candidate;
    if ((candidateConfig.type === 'electrum' || candidateConfig.type === 'bitcoin-rpc')
      && selectedNetwork !== Networks.REGTEST && !config.mnemonic && !candidateConfig.mnemonic) {
      throw new Error(
        `Network "${candidate}" is live and requires an explicit mnemonic; refusing to use the public mock mnemonic.`,
      );
    }
    assertLiveMnemonicIsChainSpecific(config, candidate);
    return candidateConfig;
  };
  const selectedConfig = validateNetwork(name);
  const mnemonicFor = (netCfg: NetworkConfig | undefined): string =>
    netCfg?.mnemonic ?? config.mnemonic ?? DEFAULT_MNEMONIC;
  const mnemonic = mnemonicFor(selectedConfig);
  const ethersOpts: EthersOptions = {
    artifactsDir: config.paths.artifacts,
    composition: config.composition ?? (config.compiler?.composition === 'framed' ? 'framed'
      : 'direct'),
    // Keep getSigners() and the hardhat-shaped config.networks.*.accounts.path view identical. Ported suites
    // commonly reconstruct HDNodeWallets from that published path and expect wallet i to be signer i.
    accountsPath: config.accounts?.path ?? HARDHAT_ACCOUNT_BRANCH,
    accountsInitialIndex: config.accounts?.initialIndex ?? 0,
    accountSatoshis: config.accounts?.satoshis,
    recoveryProjection: config.compiler?.ecrecover === 'evm' ? 'evm'
      : config.compiler?.ecrecover === 'p2pkh' ? 'p2pkh'
        : config.compiler?.evmCompat === true ? 'evm'
          : 'p2pkh',
    logicalIdentity: config.logicalIdentity,
  };
  const base = buildConnection(name, selectedConfig, mnemonic, ethersOpts);
  // The active provider backs the module-global network helpers (loadFixture/time/...).
  setActiveProvider(base.provider as unknown as nh.TestNetworkProvider);

  const connect = async (n?: string): Promise<NetworkConnection> => {
    const cn = n ?? name;
    const cnCfg = validateNetwork(cn);
    const conn = buildConnection(cn, cnCfg, mnemonicFor(cnCfg), ethersOpts);
    await conn.ethers.getSigners(config.accounts?.count ?? 20);
    setActiveProvider(conn.provider as unknown as nh.TestNetworkProvider);
    return conn;
  };
  const network: HardhatNetwork = {
    ...base,
    create: connect,
    connect,
  };

  const hre: HardhatRuntimeEnvironment = {
    config,
    network,
    ethers: base.ethers,
    networkHelpers: nh,
    tasks: { getTask, getTasks },
    run: (taskName: string, args: TaskArguments = {}) => runTask(taskName, args, hre),
  };
  return hre;
}

/**
 * A hardhat-`config`-shaped view of our ResolvedConfig: exposes `networks.<name>.accounts.{mnemonic, path,
 * count, initialIndex}` (ported suites read `config.networks.hardhat.accounts.mnemonic`). The `hardhat` and the
 * active default network both carry the accounts block.
 */
export function hardhatCompatConfig(resolved: ResolvedConfig): Record<string, unknown> {
  const accounts = {
    mnemonic: resolved.mnemonic ?? DEFAULT_MNEMONIC,
    path: resolved.accounts?.path ?? HARDHAT_ACCOUNT_BRANCH,
    count: resolved.accounts?.count ?? 20,
    initialIndex: resolved.accounts?.initialIndex ?? 0,
  };
  const networks: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(resolved.networks)) networks[k] = { ...v, accounts };
  if (!networks.hardhat) networks.hardhat = { accounts };
  return { ...resolved, networks };
}

// Vitest can load this package through both the setup-file and Hardhat compatibility alias module graphs.
// Keep the active HRE process-global so those equivalent module instances cannot diverge onto separate providers.
const hreGlobal = globalThis as typeof globalThis & {
  __solidcashActiveHre?: HardhatRuntimeEnvironment;
};

/** The active HRE singleton (built lazily with a default mock-network config if `initHre` hasn't run). */
export function getDefaultHre(): HardhatRuntimeEnvironment {
  if (!hreGlobal.__solidcashActiveHre) {
    hreGlobal.__solidcashActiveHre = createHardhatRuntimeEnvironment(resolveConfig({}));
  }
  return hreGlobal.__solidcashActiveHre;
}

/** Alias: the currently-active HRE (config-loaded if `initHre` ran, else the default). */
export const getActiveHre = getDefaultHre;

/** Build (and cache) the HRE from an on-disk config in `dir`. Used by the CLI. */
export async function initHre(dir?: string, networkName?: string): Promise<HardhatRuntimeEnvironment> {
  const config = await loadConfig(dir);
  // Load the heavy StatefulContract module here (async) rather than at hre.ts import time.
  await loadStatefulContract();
  hreGlobal.__solidcashActiveHre = createHardhatRuntimeEnvironment(config, networkName);
  if (process.env.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
    console.error('init-hre-config', { dir, defaultNetwork: config.defaultNetwork,
      consensus: config.networks[config.defaultNetwork]?.consensus });
  }
  // Hardhat places configured mock balances in genesis; initialize those accounts before tests run. Live-like
  // providers (including regtest) fund only when a script explicitly requests signers, so read-only tasks such as
  // compile and doctor do not mutate a real node wallet or chain merely by initializing the HRE.
  if (hreGlobal.__solidcashActiveHre.network.provider instanceof MockNetworkProvider) {
    await hreGlobal.__solidcashActiveHre.ethers.getSigners(config.accounts?.count ?? 20);
  }
  return hreGlobal.__solidcashActiveHre;
}

export type { SolidcashConfig, TaskDefinition, TaskArguments, ContractRunner };
