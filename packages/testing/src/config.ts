/**
 * Config surface for the SolidCash harness (HARDHAT-PARITY.md WS1). Mirrors hardhat.config: paths, networks,
 * a default network, and the test mnemonic/accounts. `defineConfig` is the typed identity helper; `loadConfig`
 * dynamically imports `solidcash.config.{ts,js,mjs}` from a directory (the CLI runs under tsx so a .ts config
 * loads directly).
 */
import { pathToFileURL } from 'url';
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import {
  dirname, isAbsolute, join, relative, resolve, sep,
} from 'path';
import type { TypegenTarget } from './typegen.js';

export interface NetworkConfig {
  /** Which provider backs this network. */
  type?: 'mock' | 'regtest' | 'electrum' | 'bitcoin-rpc';
  /** BCH network used by live providers. Inferred from the config key when omitted. */
  network?: 'mainnet' | 'testnet3' | 'testnet4' | 'chipnet' | 'regtest';
  electrum?: { host: string; port?: number };
  rpc?: { url: string; user?: string; password?: string };
  /** Mock-only consensus overrides. Defaults to 1MB inputs/stack items and 10MB transactions. */
  consensus?: Partial<{
    maximumInputBytes: number;
    maximumStackItemBytes: number;
    maximumTransactionBytes: number;
    maximumNftCommitmentBytes: number;
    operationCostBudgetPerByte: number;
    hashDigestIterationsPerByte: number;
  }>;
  policy?: Partial<{
    enforceDust: boolean;
    /** Mock only: cap every input at BCH's 10,000 bytes, so tests and `solidhat compile` meet the real limit. */
    enforceProductionInputLimit: boolean;
  }>;
  /**
   * Signing phrase for this network. A live chain does not share the top-level mnemonic with a different
   * live chain: a BCH signature carries no chain id.
   */
  mnemonic?: string;
}

export interface AccountsConfig {
  /** BIP-32 account branch (child index appended per account). */
  path?: string;
  count?: number;
  initialIndex?: number;
  /** Per-account funding on mock/regtest, in satoshis. */
  satoshis?: bigint;
}

export interface TypegenConfig {
  targets: readonly { target: TypegenTarget; layout?: 'typechain'; outDir?: string; sourceDir?: string }[];
  /** Emit tiny runtime modules which import the co-located JSON artifact instead of embedding it as TS. */
  jsonArtifactModules?: boolean;
}

export interface SolidcashConfig {
  paths?: {
    contracts?: string;
    artifacts?: string;
    tests?: string;
    /**
     * Compile cache root, `~/.cache/solidcash` by default. Compile trusts its entries as compiled output, so anyone
     * who can write this directory can substitute artifacts. A directory inside the project needs `trustProjectCache`.
     */
    cache?: string;
  };
  /**
   * Use a `paths.cache` inside the project directory. Off by default: a cloned repository can ship cache entries
   * that replace the artifacts of its reviewed sources, so such a path is ignored for the per-user cache.
   */
  trustProjectCache?: boolean;
  networks?: Record<string, NetworkConfig>;
  defaultNetwork?: string;
  /** The HD mnemonic getSigners derives from (defaults to the hardhat `test test ... junk` phrase). */
  mnemonic?: string;
  accounts?: AccountsConfig;
  /** Compiler options passed through to solidc `compileString`. */
  solc?: Record<string, unknown>;
  /** Compiler options passed through to solidc. Preferred over the legacy `solc` name. */
  compiler?: Record<string, unknown>;
  /**
   * Composition convention the compiler targets. `direct` (the default) gives every entry point its own
   * top-level function and block layout; `framed` compiles each entry point as a master program that settles
   * the contract's state once per transaction. Passed through to solidc `compileString` / `compileStringMulti`.
   */
  composition?: 'direct' | 'framed';
  /**
   * Address a deployment by a stable, chain-independent CREATE identity (default) or by the address its own
   * deployment transaction produces.
   *
   * A project whose contracts derive or compare each other's addresses - an EVM port computing expected
   * addresses from the deployer and its nonce, say - needs the physical form, because the stable identity is
   * deliberately not the address the deployment lands at.
   */
  logicalIdentity?: boolean;
  /** Optional generated TypeChain-compatible bindings. */
  typegen?: TypegenConfig;
}

/** Fully-resolved config (defaults applied). */
export interface ResolvedConfig extends Required<Pick<SolidcashConfig, 'paths' | 'defaultNetwork'>> {
  paths: Required<NonNullable<SolidcashConfig['paths']>>;
  networks: Record<string, NetworkConfig>;
  defaultNetwork: string;
  mnemonic?: string;
  accounts?: AccountsConfig;
  solc?: Record<string, unknown>;
  compiler?: Record<string, unknown>;
  composition?: 'direct' | 'framed';
  logicalIdentity: boolean;
  typegen: {
    targets: { target: TypegenTarget; layout: 'typechain'; outDir: string; sourceDir?: string }[];
    jsonArtifactModules?: boolean;
  };
}

/** Typed identity helper for `solidcash.config.ts` (mirrors hardhat `defineConfig`). */
export function defineConfig(config: SolidcashConfig): SolidcashConfig {
  return config;
}

/** JSON Schema for editor integrations and generated configuration UIs. */
export const solidcashConfigSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'SolidCash configuration', type: 'object', additionalProperties: false,
  properties: {
    paths: { type: 'object', additionalProperties: false, properties: {
      contracts: { type: 'string' }, artifacts: { type: 'string' }, tests: { type: 'string' }, cache: { type: 'string' },
    } },
    defaultNetwork: { type: 'string' }, mnemonic: { type: 'string' },
    compiler: { type: 'object' }, solc: { type: 'object', deprecated: true },
    composition: { enum: ['direct', 'framed'] },
    logicalIdentity: { type: 'boolean' },
    trustProjectCache: { type: 'boolean' },
    networks: { type: 'object', additionalProperties: { type: 'object' } },
    accounts: { type: 'object' },
    typegen: { type: 'object', properties: { targets: { type: 'array', items: {
      type: 'object', required: ['target'], properties: {
        target: { enum: ['ethers5', 'ethers6'] }, layout: { const: 'typechain' },
        outDir: { type: 'string' }, sourceDir: { type: 'string' },
      },
    } } } },
  },
} as const;

const CONFIG_BASENAMES = ['solidcash.config.ts', 'solidcash.config.mjs', 'solidcash.config.js'];

/** Apply defaults to a user config. */
export function resolveConfig(config: SolidcashConfig = {}, baseDir?: string): ResolvedConfig {
  const resolvePath = (configured: string | undefined, fallback: string): string => {
    const value = configured ?? fallback;
    return baseDir ? resolve(baseDir, value) : value;
  };
  const compiler = config.compiler ?? config.solc;
  const configuredTargets = config.typegen?.targets ?? [];
  const multipleTargets = configuredTargets.length > 1;
  return {
    paths: {
      contracts: resolvePath(config.paths?.contracts, 'contracts'),
      // Artifact root. SolidCash-owned files are written beneath its `@solidcash/solidcash/` namespace so native Hardhat
      // artifacts and build-info can coexist in the same root.
      artifacts: resolvePath(config.paths?.artifacts, 'artifacts'),
      tests: resolvePath(config.paths?.tests, 'test'),
      cache: resolvePath(config.paths?.cache, join(homedir(), '.cache', 'solidcash')),
    },
    networks: { mock: { type: 'mock' }, ...config.networks },
    defaultNetwork: config.defaultNetwork ?? 'mock',
    mnemonic: config.mnemonic,
    accounts: config.accounts,
    solc: compiler,
    compiler,
    composition: config.composition,
    logicalIdentity: config.logicalIdentity ?? true,
    typegen: {
      jsonArtifactModules: config.typegen?.jsonArtifactModules,
      targets: configuredTargets.map((target) => ({
        target: target.target,
        layout: target.layout ?? 'typechain',
        sourceDir: target.sourceDir ? resolvePath(target.sourceDir, target.sourceDir) : undefined,
        outDir: resolvePath(
          target.outDir, multipleTargets ? `typechain-types-${target.target}` : 'typechain-types',
        ),
      })),
    },
  };
}

const HARDHAT_CONFIG_BASENAMES = ['hardhat.config.ts', 'hardhat.config.mjs', 'hardhat.config.js'];

function parentDirectories(start: string): string[] {
  const directories: string[] = [];
  let current = resolve(start);
  while (true) {
    directories.push(current);
    const parent = dirname(current);
    if (parent === current) return directories;
    current = parent;
  }
}

/**
 * Why another local user could have planted `file`: neither this user nor root owns it, or it sits in a
 * world-writable directory without the sticky bit. Windows has no uid and is not checked. A checkout another uid owns
 * (a container running as root over a mounted tree) is trusted with `SOLIDCASH_TRUST_CONFIG_OWNER=1`.
 */
function plantedBy(file: string): string | undefined {
  if (typeof process.getuid !== 'function') return undefined;
  const uid = process.getuid();
  const owner = statSync(file).uid;
  if (owner !== uid && owner !== 0 && process.env.SOLIDCASH_TRUST_CONFIG_OWNER !== '1') {
    return `it is owned by uid ${owner}, not by this user (uid ${uid}); set SOLIDCASH_TRUST_CONFIG_OWNER=1 to trust it`;
  }
  const directory = dirname(file);
  const { mode } = statSync(directory);
  if ((mode & 0o002) !== 0 && (mode & 0o1000) === 0) return `${directory} is world-writable without the sticky bit`;
  return undefined;
}

const warnedPlanted = new Set<string>();

/** `file` exists and no other local user could have put it there; a skipped file is reported once. */
function ownedFile(file: string): boolean {
  if (!existsSync(file)) return false;
  let reason: string | undefined;
  try {
    reason = plantedBy(file);
  } catch (error) {
    reason = (error as Error).message;
  }
  if (reason === undefined) return true;
  if (!warnedPlanted.has(file)) {
    warnedPlanted.add(file);
    console.warn(`SolidCash: ignoring ${file}: ${reason}.`);
  }
  return false;
}

/** A directory that bounds config discovery: the nearest package or git root, else `start` itself. */
function projectRoot(start: string): string {
  for (const current of parentDirectories(start)) {
    if (ownedFile(join(current, 'package.json')) || ownedFile(join(current, '.git'))) return current;
  }
  return resolve(start);
}

/** Locate the nearest SolidCash config inside the project, or an explicitly opted-in Hardhat config. */
export function findConfigFile(dir: string = process.cwd()): string | undefined {
  const root = projectRoot(dir);
  for (const current of parentDirectories(dir)) {
    for (const name of CONFIG_BASENAMES) {
      const candidate = join(current, name);
      if (ownedFile(candidate)) return candidate;
    }
    for (const name of HARDHAT_CONFIG_BASENAMES) {
      const candidate = join(current, name);
      if (!ownedFile(candidate)) continue;
      const source = readFileSync(candidate, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      if (/\bsolidcash\s*:/.test(source) || /\bwithSolidCash\s*\(/.test(source)) return candidate;
    }
    if (current === root) break;
  }
  return undefined;
}

/** Locate the nearest Hardhat config, including one which has not opted into SolidCash yet. */
export function findHardhatConfigFile(dir: string = process.cwd()): string | undefined {
  const root = projectRoot(dir);
  for (const current of parentDirectories(dir)) {
    for (const name of HARDHAT_CONFIG_BASENAMES) {
      const candidate = join(current, name);
      if (ownedFile(candidate)) return candidate;
    }
    if (current === root) break;
  }
  return undefined;
}

interface HardhatCompatConfig {
  solidcash?: SolidcashConfig;
  paths?: { sources?: string; tests?: string; artifacts?: string; cache?: string };
  networks?: Record<string, { accounts?: AccountsConfig & { mnemonic?: string } }>;
}

function fromHardhatConfig(config: HardhatCompatConfig): SolidcashConfig {
  const embedded = config.solidcash ?? {};
  const hardhatAccounts = config.networks?.hardhat?.accounts;
  const inheritedAccounts = hardhatAccounts && {
    path: hardhatAccounts.path,
    count: hardhatAccounts.count,
    initialIndex: hardhatAccounts.initialIndex,
  };
  return {
    ...embedded,
    paths: {
      contracts: embedded.paths?.contracts ?? config.paths?.sources,
      tests: embedded.paths?.tests ?? config.paths?.tests,
      artifacts: embedded.paths?.artifacts ?? config.paths?.artifacts,
      // Hardhat's cache root is not inherited: a SolidCash cache inside the project is opted into explicitly.
      cache: embedded.paths?.cache,
    },
    mnemonic: embedded.mnemonic ?? hardhatAccounts?.mnemonic,
    accounts: embedded.accounts ?? inheritedAccounts,
  };
}

/** Drop a `paths.cache` inside the project unless the config trusts it, so the per-user cache serves instead. */
function withTrustedCache(config: SolidcashConfig, configDir: string): SolidcashConfig {
  const cache = config.paths?.cache;
  if (cache === undefined || config.trustProjectCache === true) return config;
  const directory = resolve(configDir, cache);
  const inside = relative(configDir, directory);
  if (isAbsolute(inside) || inside === '..' || inside.startsWith(`..${sep}`)) return config;
  console.warn(
    `SolidCash: ignoring paths.cache ${directory}: compile trusts its entries, and it is inside the project. `
    + 'Set trustProjectCache: true to use it.',
  );
  return { ...config, paths: { ...config.paths, cache: undefined } };
}

/** Load and resolve the config from `dir` (empty config if none found). */
export async function loadConfig(dir: string = process.cwd()): Promise<ResolvedConfig> {
  const file = findConfigFile(dir);
  if (!file) return resolveConfig({});
  const configDir = dirname(file);
  if (configDir !== resolve(dir) && !warnedPlanted.has(`load:${file}`)) {
    warnedPlanted.add(`load:${file}`);
    console.warn(`SolidCash: loading ${file}, which is not in ${resolve(dir)}.`);
  }
  const mod = await import(pathToFileURL(file).href);
  const exported = (mod.default ?? mod.config ?? {}) as SolidcashConfig & HardhatCompatConfig;
  const isHardhat = HARDHAT_CONFIG_BASENAMES.some((name) => file.endsWith(name));
  const user = isHardhat ? fromHardhatConfig(exported) : exported;
  return resolveConfig(withTrustedCache(user, configDir), configDir);
}

/** Generate a standalone SolidCash config from the nearest Hardhat config without modifying the original. */
export async function migrateHardhatConfig(dir: string = process.cwd()): Promise<string> {
  const hardhatFile = findHardhatConfigFile(dir);
  if (!hardhatFile) throw new Error('No hardhat.config.{ts,mjs,js} found in this directory or its parents.');
  const target = join(dirname(hardhatFile), 'solidcash.config.ts');
  if (existsSync(target)) throw new Error(`Refusing to overwrite existing ${target}`);
  const mod = await import(pathToFileURL(hardhatFile).href);
  const hardhat = (mod.default ?? mod.config ?? {}) as HardhatCompatConfig;
  const migrated = fromHardhatConfig(hardhat);
  const lines = [
    "import { defineConfig } from '@solidcash/testing';",
    '',
    'export default defineConfig({',
    `  paths: ${JSON.stringify(migrated.paths ?? {}, null, 2).replace(/\n/g, '\n  ')},`,
    '  // Hardhat solidity.settings are intentionally not translated. Set SolidCash compiler options here.',
    '  compiler: { evmCompat: true },',
  ];
  if (migrated.mnemonic) lines.push('  mnemonic: process.env.SOLIDCASH_MNEMONIC,');
  if (migrated.accounts) lines.push(
    `  accounts: ${JSON.stringify(migrated.accounts, null, 2).replace(/\n/g, '\n  ')},`,
  );
  lines.push("  networks: { mock: { type: 'mock' } },", "  defaultNetwork: 'mock',", '});', '');
  writeFileSync(target, lines.join('\n'), { encoding: 'utf8', flag: 'wx' });
  return target;
}
