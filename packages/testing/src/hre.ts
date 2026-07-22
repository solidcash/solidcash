/**
 * The SolidCash Hardhat Runtime Environment (HARDHAT-PARITY.md WS2, decision D2). Presents a Hardhat-v2-shaped
 * surface (`hre.ethers.*`, `hre.network`, `hre.run`) over a connection seam (`hre.network.create()`), so a v3
 * mode can layer on later without a rewrite. `hre.ethers` merges the forwarded ethers utils with the BCH-native
 * signer/contract helpers bound to the active network provider.
 */
import fs from 'fs';
import path from 'path';
import type { Artifact, SplitArtifactBundle } from '@solidcash/utils';
import {
  type NetworkProvider,
  MockNetworkProvider, RegtestNetworkProvider, ElectrumNetworkProvider,
  Signer, HDSigner, signersFromMnemonic,
  StatefulContract, type ContractRunner, type ConnectedStatefulContract,
  ContractFactory, getContractFactory as sdkGetContractFactory, deployContract as sdkDeployContract,
  SplitContractBundle, type SplitContract, type SplitDeployOptions,
  type DeployedContract, type DeployContractOptions,
  type ConstructorArgument, type Utxo, randomUtxo,
} from 'solidcash';
import * as ethersUtils from './ethers-utils.js';
import * as nh from './network-helpers.js';
import { setActiveProvider } from './network-helpers.js';
import {
  type ResolvedConfig, type NetworkConfig, loadConfig, resolveConfig, type SolidcashConfig,
} from './config.js';
import {
  runTask, getTasks, getTask, type TaskArguments, type TaskDefinition,
} from './tasks.js';

const DEFAULT_MNEMONIC = MockNetworkProvider.DEFAULT_MNEMONIC;

/** Build a network provider from a resolved network config. */
export function createProvider(name: string, netCfg: NetworkConfig | undefined): NetworkProvider {
  const type = netCfg?.type ?? (name === 'regtest' ? 'regtest' : name === 'mock' ? 'mock' : 'mock');
  switch (type) {
    case 'regtest': return new RegtestNetworkProvider();
    case 'electrum': return new ElectrumNetworkProvider();
    case 'mock':
    default: return new MockNetworkProvider();
  }
}

/** The BCH-native `hre.ethers` object: forwarded utils + network-bound signer/contract helpers. */
export interface SolidcashEthers {
  provider: NetworkProvider;
  getSigners(count?: number, opts?: { satoshis?: bigint; mnemonic?: string }): Promise<Signer[]>;
  getSigner(index?: number, opts?: { satoshis?: bigint; mnemonic?: string }): Promise<Signer>;
  // Accept a compiled artifact object OR a contract name (hardhat `getContractFactory("Name")`).
  getContractFactory<T extends Artifact>(artifactOrName: T | SplitArtifactBundle | string, runner?: ContractRunner): any;
  getContractAt<T extends Artifact>(artifactOrName: T | string, addressOrCategory: string, runner?: ContractRunner)
  : Promise<ConnectedStatefulContract<T>>;
  deployContract<T extends Artifact>(artifactOrName: T | string, args?: ConstructorArgument[], runner?: ContractRunner,
    overrides?: DeployContractOptions): Promise<DeployedContract<T>>;
  // classes (BCH-native)
  Contract: typeof StatefulContract;
  ContractFactory: typeof ContractFactory;
  Signer: typeof Signer;
  // ethers `Wallet` (`new Wallet(wif, provider)`) plus a BCH `createRandom` that returns a funded ad-hoc HDSigner.
  Wallet: typeof Signer & { createRandom(provider?: NetworkProvider): HDSigner };
  HDSigner: typeof HDSigner;
  HDNodeWallet: { fromMnemonic(mnemonic: string | { phrase: string }, path?: string): HDSigner };
  [k: string]: unknown; // forwarded ethers utils (parseEther, keccak256, AbiCoder, constants, ...)
}

function isSplitBundle(value: unknown): value is SplitArtifactBundle {
  return typeof value === 'object' && value !== null
    && (value as { format?: string }).format === 'solidcash-split-v1';
}

/** Positional ethers deploy facade over the SDK's explicit split-bundle deployment API. */
class HardhatSplitContractFactory {
  constructor(readonly split: SplitContractBundle) {}
  get runner(): ContractRunner { return this.split.runner; }
  get artifact(): Artifact { return this.split.bundle.root; }
  connect(runner: ContractRunner): HardhatSplitContractFactory {
    return new HardhatSplitContractFactory(SplitContractBundle.from(this.split.bundle, runner));
  }
  async deploy(...values: unknown[]): Promise<SplitContract> {
    let options: SplitDeployOptions = {};
    const last = values.at(-1);
    if (typeof last === 'object' && last !== null && !(last instanceof Uint8Array) && !Array.isArray(last)) {
      options = values.pop() as SplitDeployOptions;
    }
    return this.split.deploy(values as ConstructorArgument[], options);
  }
  at(address: string, constructorArgs: ConstructorArgument[] = []): Promise<SplitContract> {
    return this.split.at(address, constructorArgs);
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
  const base = path.isAbsolute(artifactsDir) ? artifactsDir : path.resolve(process.cwd(), artifactsDir);
  const target = `${name}.json`;
  const matches: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name === target) matches.push(p);
    }
  };
  if (fs.existsSync(base)) walk(base);
  const parsed = matches.map((m) => JSON.parse(fs.readFileSync(m, 'utf-8')) as Artifact);
  // The flat backward-compat `<file>.json` and the nested `<file>.scash/<Contract>.json` are the SAME contract
  // when filename == contract name; they differ only in `updatedAt`. Dedupe by fingerprint (fall back to bytecode).
  const ident = (a: Artifact): string => (a as any).fingerprint ?? a.bytecode ?? JSON.stringify(a.abi);
  const distinct = new Map<string, Artifact>();
  parsed.forEach((a) => distinct.set(ident(a), a));
  if (distinct.size === 1) return [...distinct.values()][0];
  if (distinct.size > 1) {
    throw new Error(
      `getContractFactory: multiple DISTINCT artifacts named "${name}" (${matches.map((m) => path.relative(base, m)).join(', ')}). `
      + 'Pass the artifact object to disambiguate.',
    );
  }
  throw new Error(
    `getContractFactory: no artifact named "${name}" in ${base}. Compile it first (\`solidcash compile\`), `
    + 'or pass the artifact object directly.',
  );
}

export function loadArtifactOrSplitByName(artifactsDir: string, name: string): Artifact | SplitArtifactBundle {
  const base = path.isAbsolute(artifactsDir) ? artifactsDir : path.resolve(process.cwd(), artifactsDir);
  const splitPath = path.join(base, `${name}.split.json`);
  if (fs.existsSync(splitPath)) return JSON.parse(fs.readFileSync(splitPath, 'utf-8')) as SplitArtifactBundle;
  return loadArtifactByName(artifactsDir, name);
}

interface EthersOptions { artifactsDir: string; accountsPath?: string }

function buildEthers(provider: NetworkProvider, mnemonic: string, opts: EthersOptions): SolidcashEthers {
  const { artifactsDir, accountsPath } = opts;
  const resolveArtifact = <T extends Artifact>(a: T | SplitArtifactBundle | string): T | SplitArtifactBundle =>
    (typeof a === 'string' ? loadArtifactOrSplitByName(artifactsDir, a) : a) as T | SplitArtifactBundle;

  // hardhat `getContractFactory("Name")` binds to the default deployer = signers[0]. Derive it synchronously
  // (same identity `getSigners()` funds), so `factory.deploy(...)` funds the genesis from that account.
  let cachedSigner: Signer | undefined;
  const defaultRunner = (): ContractRunner => {
    const anyProvider = provider as unknown as { getSigners?: unknown };
    if (typeof anyProvider.getSigners !== 'function') return provider; // live net: no local signer
    const cacheable = provider as unknown as { getCachedSigner?: (index: number, opts: object) => Signer };
    cachedSigner ??= typeof cacheable.getCachedSigner === 'function'
      ? cacheable.getCachedSigner(0, { mnemonic, path: accountsPath })
      : signersFromMnemonic(mnemonic, provider, { count: 1, path: accountsPath })[0];
    return cachedSigner;
  };

  const getSigners = async (
    count = 20, o: { satoshis?: bigint; mnemonic?: string; fundingUtxos?: number } = {},
  ): Promise<Signer[]> => {
    const anyProvider = provider as unknown as { getSigners?: (c: number, x: object) => Promise<Signer[]> };
    if (typeof anyProvider.getSigners === 'function') {
      // One funding UTXO per signer is enough: the deploy step fans out fresh vout-0 genesis coins on demand
      // (ContractFactory.selectGenesisFundingUtxo), so an account can deploy any number of contracts. Override
      // `fundingUtxos` to pre-split (saves a fan-out tx per deploy).
      return anyProvider.getSigners(count, { mnemonic, path: accountsPath, ...o });
    }
    return signersFromMnemonic(o.mnemonic ?? mnemonic, provider, { count, path: accountsPath });
  };

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
      if (typeof fundable.addUtxo === 'function') void fundable.addUtxo(s.getAddress(), randomUtxo({ satoshis: 1_000_000n }));
      return s;
    }
  }
  const HDNodeWallet = class {
    static fromMnemonic(mnemonicValue: string | { phrase: string }, path?: string): HDSigner {
      const phrase = typeof mnemonicValue === 'string' ? mnemonicValue : mnemonicValue.phrase;
      return HDSigner.fromPhrase(phrase, provider, path ?? "m/44'/60'/0'/0/0");
    }
  };

  const ethers: SolidcashEthers = {
    ...ethersUtils,
    provider,
    getSigners,
    getSigner: async (index = 0, o = {}): Promise<Signer> => {
      const anyProvider = provider as unknown as { getSigner?: (i: number, x: object) => Promise<Signer> };
      if (typeof anyProvider.getSigner === 'function') {
        return anyProvider.getSigner(index, { mnemonic, path: accountsPath, ...o });
      }
      const [signer] = signersFromMnemonic(o.mnemonic ?? mnemonic, provider, {
        initialIndex: index, count: 1, path: accountsPath,
      });
      return signer;
    },
    getContractFactory: <T extends Artifact>(
      artifactOrName: T | SplitArtifactBundle | string, runner?: ContractRunner,
    ): ContractFactory<T> | HardhatSplitContractFactory => {
      const loaded = resolveArtifact(artifactOrName);
      const boundRunner = runner ?? defaultRunner();
      return isSplitBundle(loaded)
        ? new HardhatSplitContractFactory(SplitContractBundle.from(loaded, boundRunner))
        : sdkGetContractFactory(loaded as T, boundRunner);
    },
    getContractAt: <T extends Artifact>(artifactOrName: T | string, addressOrCategory: string, runner?: ContractRunner) =>
      isSplitBundle(resolveArtifact(artifactOrName))
        ? new HardhatSplitContractFactory(SplitContractBundle.from(
          resolveArtifact(artifactOrName) as SplitArtifactBundle, runner ?? defaultRunner(),
        )).at(addressOrCategory) as any
        : StatefulContract.at(addressOrCategory, resolveArtifact(artifactOrName) as T, runner ?? defaultRunner()),
    deployContract: <T extends Artifact>(artifactOrName: T | string, args: ConstructorArgument[] = [],
      runner?: ContractRunner, overrides?: DeployContractOptions) =>
      isSplitBundle(resolveArtifact(artifactOrName))
        ? new HardhatSplitContractFactory(SplitContractBundle.from(
          resolveArtifact(artifactOrName) as SplitArtifactBundle, runner ?? defaultRunner(),
        )).deploy(...args, ...(overrides ? [overrides] : [])) as any
        : sdkDeployContract(resolveArtifact(artifactOrName) as T, args, runner ?? defaultRunner(), overrides),
    Contract: StatefulContract,
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
  const mnemonic = config.mnemonic ?? DEFAULT_MNEMONIC;
  const ethersOpts: EthersOptions = {
    artifactsDir: config.paths.artifacts,
    accountsPath: config.accounts?.path,
  };
  const base = buildConnection(name, config.networks[name], mnemonic, ethersOpts);
  // The active provider backs the module-global network helpers (loadFixture/time/...).
  setActiveProvider(base.provider as unknown as nh.TestNetworkProvider);

  const network: HardhatNetwork = {
    ...base,
    create: async (n?: string): Promise<NetworkConnection> => {
      const cn = n ?? name;
      const conn = buildConnection(cn, config.networks[cn], mnemonic, ethersOpts);
      await conn.ethers.getSigners(config.accounts?.count ?? 20);
      setActiveProvider(conn.provider as unknown as nh.TestNetworkProvider);
      return conn;
    },
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
    path: resolved.accounts?.path ?? "m/44'/60'/0'/0",
    count: resolved.accounts?.count ?? 20,
    initialIndex: resolved.accounts?.initialIndex ?? 0,
  };
  const networks: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(resolved.networks)) networks[k] = { ...v, accounts };
  if (!networks.hardhat) networks.hardhat = { accounts };
  return { ...resolved, networks };
}

let singleton: HardhatRuntimeEnvironment | undefined;

/** The active HRE singleton (built lazily with a default mock-network config if `initHre` hasn't run). */
export function getDefaultHre(): HardhatRuntimeEnvironment {
  if (!singleton) singleton = createHardhatRuntimeEnvironment(resolveConfig({}));
  return singleton;
}

/** Alias: the currently-active HRE (config-loaded if `initHre` ran, else the default). */
export const getActiveHre = getDefaultHre;

/** Build (and cache) the HRE from an on-disk config in `dir`. Used by the CLI. */
export async function initHre(dir?: string, networkName?: string): Promise<HardhatRuntimeEnvironment> {
  const config = await loadConfig(dir);
  singleton = createHardhatRuntimeEnvironment(config, networkName);
  // Hardhat places configured account balances in genesis; initialize the mock account set before tests run.
  await singleton.ethers.getSigners(config.accounts?.count ?? 20);
  return singleton;
}

export type { SolidcashConfig, TaskDefinition, TaskArguments, ContractRunner };
