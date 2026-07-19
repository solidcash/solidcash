/**
 * The SolidCash Hardhat Runtime Environment (HARDHAT-PARITY.md WS2, decision D2). Presents a Hardhat-v2-shaped
 * surface (`hre.ethers.*`, `hre.network`, `hre.run`) over a connection seam (`hre.network.create()`), so a v3
 * mode can layer on later without a rewrite. `hre.ethers` merges the forwarded ethers utils with the BCH-native
 * signer/contract helpers bound to the active network provider.
 */
import fs from 'fs';
import path from 'path';
import type { Artifact } from '@solidcash/utils';
import {
  type NetworkProvider,
  MockNetworkProvider, RegtestNetworkProvider, ElectrumNetworkProvider,
  Signer, HDSigner, signersFromMnemonic,
  StatefulContract, type ContractRunner, type ConnectedStatefulContract,
  ContractFactory, getContractFactory as sdkGetContractFactory, deployContract as sdkDeployContract,
  type DeployedContract, type DeployContractOptions,
  type ConstructorArgument,
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
  getContractFactory<T extends Artifact>(artifactOrName: T | string, runner?: ContractRunner): ContractFactory<T>;
  getContractAt<T extends Artifact>(artifactOrName: T | string, addressOrCategory: string, runner?: ContractRunner)
  : Promise<ConnectedStatefulContract<T>>;
  deployContract<T extends Artifact>(artifactOrName: T | string, args?: ConstructorArgument[], runner?: ContractRunner,
    overrides?: DeployContractOptions): Promise<DeployedContract<T>>;
  // classes (BCH-native)
  Contract: typeof StatefulContract;
  ContractFactory: typeof ContractFactory;
  Signer: typeof Signer;
  Wallet: typeof Signer;
  HDSigner: typeof HDSigner;
  HDNodeWallet: typeof HDSigner;
  [k: string]: unknown; // forwarded ethers utils (parseEther, keccak256, AbiCoder, constants, ...)
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

/** hardhat `getContractFactory("Name")`: resolve a compiled artifact by name from the artifacts dir. */
export function loadArtifactByName(artifactsDir: string, name: string): Artifact {
  const base = path.isAbsolute(artifactsDir) ? artifactsDir : path.resolve(process.cwd(), artifactsDir);
  // Try `<dir>/<Name>.json`, then a hardhat-style `<dir>/**/<Name>.sol/<Name>.json`.
  const direct = path.join(base, `${name}.json`);
  const candidates = [direct];
  if (fs.existsSync(base)) {
    const nested = path.join(base, `${name}.sol`, `${name}.json`);
    candidates.push(nested);
  }
  for (const file of candidates) {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8')) as Artifact;
  }
  throw new Error(
    `getContractFactory: no artifact named "${name}" in ${base}. Compile it first (\`solidcash compile\`), `
    + `or pass the artifact object directly. Tried: ${candidates.join(', ')}`,
  );
}

interface EthersOptions { artifactsDir: string; accountsPath?: string }

function buildEthers(provider: NetworkProvider, mnemonic: string, opts: EthersOptions): SolidcashEthers {
  const { artifactsDir, accountsPath } = opts;
  const resolveArtifact = <T extends Artifact>(a: T | string): T =>
    (typeof a === 'string' ? loadArtifactByName(artifactsDir, a) : a) as T;

  const getSigners = async (count = 20, o: { satoshis?: bigint; mnemonic?: string } = {}): Promise<Signer[]> => {
    const anyProvider = provider as unknown as { getSigners?: (c: number, x: object) => Promise<Signer[]> };
    if (typeof anyProvider.getSigners === 'function') {
      return anyProvider.getSigners(count, { mnemonic, path: accountsPath, ...o });
    }
    return signersFromMnemonic(o.mnemonic ?? mnemonic, provider, { count, path: accountsPath });
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
    getContractFactory: <T extends Artifact>(artifactOrName: T | string, runner?: ContractRunner): ContractFactory<T> =>
      sdkGetContractFactory(resolveArtifact(artifactOrName), runner ?? provider),
    getContractAt: <T extends Artifact>(artifactOrName: T | string, addressOrCategory: string, runner?: ContractRunner) =>
      StatefulContract.at(addressOrCategory, resolveArtifact(artifactOrName), runner ?? provider),
    deployContract: <T extends Artifact>(artifactOrName: T | string, args: ConstructorArgument[] = [],
      runner?: ContractRunner, overrides?: DeployContractOptions) =>
      sdkDeployContract(resolveArtifact(artifactOrName), args, runner ?? provider, overrides),
    Contract: StatefulContract,
    ContractFactory,
    Signer,
    Wallet: Signer,
    HDSigner,
    HDNodeWallet: HDSigner,
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
  return singleton;
}

export type { SolidcashConfig, TaskDefinition, TaskArguments, ContractRunner };
