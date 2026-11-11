/**
 * The SolidCash Hardhat Runtime Environment (HARDHAT-PARITY.md WS2, decision D2). Presents a Hardhat-v2-shaped
 * surface (`hre.ethers.*`, `hre.network`, `hre.run`) over a connection seam (`hre.network.create()`), so a v3
 * mode can layer on later without a rewrite. `hre.ethers` merges the forwarded ethers utils with the BCH-native
 * signer/contract helpers bound to the active network provider.
 */
import fs from 'fs';
import path from 'path';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Artifact, FunctionSplitBundle, SplitArtifactBundle } from '@solidcash/utils';
import { asmToBytecode } from '@solidcash/utils';
import type { Network, NetworkProvider, ConsensusLimits, NetworkPolicy } from '@solidcash/solidcash';
import type { ContractRunner } from '@solidcash/solidcash/stateful';
import { Network as Networks } from '@solidcash/solidcash/dist/interfaces.js';
import MockNetworkProvider, { MOCK_CONSENSUS_LIMITS } from '@solidcash/solidcash/dist/network/MockNetworkProvider.js';
import RegtestNetworkProvider from '@solidcash/solidcash/dist/network/RegtestNetworkProvider.js';
import ElectrumNetworkProvider from '@solidcash/solidcash/dist/network/ElectrumNetworkProvider.js';
import BitcoinRpcNetworkProvider from '@solidcash/solidcash/dist/network/BitcoinRpcNetworkProvider.js';
import MemCashNetworkProvider from '@solidcash/solidcash/dist/network/MemCashNetworkProvider.js';

import * as nh from './network-helpers.js';
import { setActiveProvider } from './network-helpers.js';
import {
  type ResolvedConfig, type NetworkConfig, loadConfig, resolveConfig, type SolidcashConfig,
} from './config.js';
import {
  runTask, getTasks, getTask, type TaskArguments, type TaskDefinition,
} from './tasks.js';
import { solidcashArtifactsPath } from './artifact-paths.js';
import {
  buildEthers, loadStatefulContract, DEFAULT_MNEMONIC, HARDHAT_ACCOUNT_BRANCH, PRODUCTION_MAXIMUM_INPUT_BYTES,
  type ArtifactSource, type EthersOptions, type SolidcashEthers,
} from './ethers-runtime.js';

export type {
  ArtifactSource, SolidcashEthers, SolidcashArtifactMap, ArtifactForName, EthersOptions,
} from './ethers-runtime.js';
export { buildEthers } from './ethers-runtime.js';


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

/** Build a network provider from a resolved network config. */
export function createProvider(
  name: string,
  netCfg: NetworkConfig | undefined,
  config?: Pick<ResolvedConfig, 'mnemonic' | 'accounts'>,
): NetworkProvider {
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
      const server = netCfg?.electrum;
      // A regtest chain has no public server, so a local one is named, on whatever port it serves.
      if (network === Networks.REGTEST && !server?.host) {
        throw new Error('An Electrum network on regtest names its server: set electrum.host.');
      }
      return new ElectrumNetworkProvider(network, {
        ...(server?.host ? { hostname: server.host } : {}),
        ...(server?.port === undefined ? {} : { port: server.port }),
        ...(server?.encrypted === undefined ? {} : { encrypted: server.encrypted }),
        ...(server?.manualConnectionManagement === undefined
          ? {} : { manualConnectionManagement: server.manualConnectionManagement }),
      });
    }
    case 'mem-cash': {
      const memCash = netCfg?.memCash;
      // A configured BCH network selects the cashaddr prefix; the global `--network` only picks the entry.
      const providerNetwork = configuredNetwork === Networks.REGTEST ? Networks.REGTEST : Networks.MOCKNET;
      return new MemCashNetworkProvider(providerNetwork, {
        ...(memCash?.url === undefined ? {} : { url: memCash.url }),
        ...(memCash?.host === undefined ? {} : { hostname: memCash.host }),
        ...(memCash?.port === undefined ? {} : { port: memCash.port }),
        ...(memCash?.encrypted === undefined ? {} : { encrypted: memCash.encrypted }),
        ...(memCash?.token === undefined ? {} : { token: memCash.token }),
        ...(memCash?.timeoutMs === undefined ? {} : { requestTimeoutMs: memCash.timeoutMs }),
        mnemonic: netCfg?.mnemonic ?? config?.mnemonic ?? DEFAULT_MNEMONIC,
        // Undefined lets the provider adopt the node's advertised branch, which is the value that must agree.
        ...(config?.accounts?.path === undefined ? {} : { derivationPath: config.accounts.path }),
        ...(config?.accounts?.initialIndex === undefined ? {} : { initialIndex: config.accounts.initialIndex }),
        // Before the socket connects, the compile reads these limits. The node's advertised profile replaces them.
        ...(netCfg?.consensus === undefined ? {} : { consensusLimits: netCfg.consensus as ConsensusLimits }),
      });
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

export interface NetworkConnection {
  name: string;
  provider: NetworkProvider;
  config: NetworkConfig | undefined;
  ethers: SolidcashEthers;
  networkHelpers: typeof nh;
  /** Hardhat 3 `connection.close()`: drop a devnet provider's socket. An in-process provider holds none. */
  close(): Promise<void>;
}

export interface HardhatNetwork extends NetworkConnection {
  /** v3 seam: create a fresh isolated connection (new provider + bound helpers). */
  create(networkName?: string): Promise<NetworkConnection>;
  /** Hardhat 3 spelling for creating and selecting a connection. */
  connect(networkName?: string): Promise<NetworkConnection>;
  /** Close the active connection and every one `create()` opened, as a Hardhat process exiting does. */
  closeAll(): Promise<void>;
}

export interface HardhatRuntimeEnvironment {
  config: ResolvedConfig;
  network: HardhatNetwork;
  /** Hardhat 3 `hre.artifacts`: a compiled contract by name, its bytecode as hex. */
  artifacts: { readArtifact(name: string): Promise<Record<string, unknown>> };
  /** Hardhat 3 `hre.globalOptions`: the options the CLI was given, the selected `--network` among them. */
  globalOptions: { network: string };
  ethers: SolidcashEthers;
  networkHelpers: typeof nh;
  tasks: { getTask: typeof getTask; getTasks: typeof getTasks };
  run(taskName: string, args?: TaskArguments): Promise<unknown>;
}

/**
 * hardhat `artifacts.readArtifact("Name")`: the artifact `loadArtifactByName` finds, its bytecode as hex. SolidCash
 * publishes the contract script as ASM; Hardhat callers (and `keccak256(artifact.bytecode)`) expect hex.
 */
export async function readHexArtifact(artifactsDir: string, name: string): Promise<Record<string, unknown>> {
  const artifact = loadArtifactByName(artifactsDir, name);
  const bytecode = `0x${binToHex(asmToBytecode(artifact.bytecode))}`;
  return { ...artifact, bytecode, deployedBytecode: bytecode };
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

/**
 * The per-entry bundle a `split: 'func'` compile published for a framed contract (`<Contract>.func.json`), or
 * undefined when the contract is published as one program.
 */
export function loadFunctionSplitByName(artifactsDir: string, name: string): FunctionSplitBundle | undefined {
  const bundlePath = path.join(solidcashArtifactsPath(artifactsDir), `${name}.func.json`);
  return fs.existsSync(bundlePath) ? JSON.parse(fs.readFileSync(bundlePath, 'utf-8')) as FunctionSplitBundle : undefined;
}

export function loadArtifactOrSplitByName(artifactsDir: string, name: string): Artifact | SplitArtifactBundle {
  const base = solidcashArtifactsPath(artifactsDir);
  const splitPath = path.join(base, `${name}.split.json`);
  if (fs.existsSync(splitPath)) return JSON.parse(fs.readFileSync(splitPath, 'utf-8')) as SplitArtifactBundle;
  return loadArtifactByName(artifactsDir, name);
}

/** The project's artifacts directory as the runtime's artifact source. */
export function fsArtifactSource(artifactsDir: string): ArtifactSource {
  return {
    artifact: (name) => loadArtifactByName(artifactsDir, name),
    functionSplit: (name) => loadFunctionSplitByName(artifactsDir, name),
    artifactOrSplit: (name) => loadArtifactOrSplitByName(artifactsDir, name),
  };
}

function buildConnection(
  name: string,
  netCfg: NetworkConfig | undefined,
  mnemonic: string,
  opts: EthersOptions,
  resolvedConfig?: ResolvedConfig,
): NetworkConnection {
  const provider = createProvider(name, netCfg, resolvedConfig);
  const ethers = buildEthers(provider, mnemonic, opts);
  const close = async (): Promise<void> => {
    try {
      await (provider as { disconnect?: () => Promise<void> }).disconnect?.();
    } catch {
      // A socket that is already closed is the desired state.
    }
  };
  return { name, provider, config: netCfg, ethers, networkHelpers: nh, close };
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
    artifacts: fsArtifactSource(config.paths.artifacts),
    composition: config.composition ?? (config.compiler?.composition === 'framed' ? 'framed'
      : 'direct'),
    ...(config.create2Templates === undefined ? {} : { create2Templates: config.create2Templates }),
    // Keep getSigners() and the hardhat-shaped config.networks.*.accounts.path view identical. Ported suites
    // commonly reconstruct HDNodeWallets from that published path and expect wallet i to be signer i.
    // A devnet may fund a different branch than the default; leave it undefined so the provider adopts the
    // node's advertised path instead of substituting a branch the node never funded.
    accountsPath: selectedConfig.type === 'mem-cash'
      ? config.accounts?.path as string
      : config.accounts?.path ?? HARDHAT_ACCOUNT_BRANCH,
    accountsInitialIndex: config.accounts?.initialIndex ?? 0,
    accountSatoshis: config.accounts?.satoshis,
    recoveryProjection: config.compiler?.ecrecover === 'evm' ? 'evm'
      : config.compiler?.ecrecover === 'p2pkh' ? 'p2pkh'
        : config.compiler?.evmCompat === true ? 'evm'
          : 'p2pkh',
    logicalIdentity: config.logicalIdentity,
  };
  // ethers v6 exposes the chain id through provider.getNetwork(). The covenant's `block.chainid` is the
  // compiler's configured selector (masked to one byte), so report the same value the compiled contracts use.
  const attachEthersNetwork = <C extends { provider: unknown }>(conn: C): C => {
    const target = conn.provider as { getNetwork?: unknown } | undefined;
    if (target !== undefined && typeof target.getNetwork !== 'function') {
      (target as { getNetwork?: () => Promise<{ chainId: bigint; name: string }> }).getNetwork =
        async () => ({ chainId: BigInt((config.compiler as { chainId?: number } | undefined)?.chainId ?? 0), name });
    }
    const exposed = (conn as unknown as { ethers?: { provider?: unknown } }).ethers?.provider;
    if (exposed !== undefined && exposed !== target && typeof (exposed as { getNetwork?: unknown }).getNetwork !== 'function') {
      (exposed as { getNetwork?: () => Promise<{ chainId: bigint; name: string }> }).getNetwork =
        (target as { getNetwork?: () => Promise<{ chainId: bigint; name: string }> } | undefined)?.getNetwork;
    }
    return conn;
  };
  const base = attachEthersNetwork(buildConnection(name, selectedConfig, mnemonic, ethersOpts, config));
  // The active provider backs the module-global network helpers (loadFixture/time/...).
  setActiveProvider(base.provider as unknown as nh.TestNetworkProvider);

  // Every connection a script opens holds a devnet socket until the task closes it.
  const opened: NetworkConnection[] = [];
  const connect = async (n?: string): Promise<NetworkConnection> => {
    const cn = n ?? name;
    const cnCfg = validateNetwork(cn);
    const conn = attachEthersNetwork(buildConnection(cn, cnCfg, mnemonicFor(cnCfg), ethersOpts, config));
    opened.push(conn);
    // A network that keeps one socket for the run opens it here, where a connection first needs it.
    if (cnCfg.electrum?.manualConnectionManagement === true) {
      await (conn.provider as unknown as { connect(): Promise<void> }).connect();
    }
    await conn.ethers.getSigners(config.accounts?.count ?? 20);
    setActiveProvider(conn.provider as unknown as nh.TestNetworkProvider);
    return conn;
  };
  const network: HardhatNetwork = {
    ...base,
    create: connect,
    connect,
    closeAll: async () => {
      for (const conn of [base, ...opened.splice(0)]) await conn.close();
    },
  };

  const hre: HardhatRuntimeEnvironment = {
    config,
    network,
    artifacts: { readArtifact: async (contractName) => readHexArtifact(config.paths.artifacts, contractName) },
    globalOptions: { network: name },
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
