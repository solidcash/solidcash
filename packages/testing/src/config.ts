/**
 * Config surface for the SolidCash harness (HARDHAT-PARITY.md WS1). Mirrors hardhat.config: paths, networks,
 * a default network, and the test mnemonic/accounts. `defineConfig` is the typed identity helper; `loadConfig`
 * dynamically imports `solidcash.config.{ts,js,mjs}` from a directory (the CLI runs under tsx so a .ts config
 * loads directly).
 */
import { pathToFileURL } from 'url';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import type { TypegenTarget } from './typegen.js';

export interface NetworkConfig {
  /** Which provider backs this network. */
  type?: 'mock' | 'regtest' | 'electrum' | 'bitcoin-rpc';
  electrum?: { host: string; port?: number };
  rpc?: { url: string; user?: string; password?: string };
  /** Mock-only consensus overrides. Defaults to 1MB inputs/stack items and 10MB transactions. */
  consensus?: Partial<{
    maximumInputBytes: number;
    maximumStackItemBytes: number;
    maximumTransactionBytes: number;
  }>;
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
}

export interface SolidcashConfig {
  paths?: {
    contracts?: string;
    artifacts?: string;
    tests?: string;
    cache?: string;
  };
  networks?: Record<string, NetworkConfig>;
  defaultNetwork?: string;
  /** The HD mnemonic getSigners derives from (defaults to the hardhat `test test ... junk` phrase). */
  mnemonic?: string;
  accounts?: AccountsConfig;
  /** Compiler options passed through to solidc `compileString`. */
  solc?: Record<string, unknown>;
  /** Compiler options passed through to solidc. Preferred over the legacy `solc` name. */
  compiler?: Record<string, unknown>;
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
  typegen: { targets: { target: TypegenTarget; layout: 'typechain'; outDir: string; sourceDir?: string }[] };
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
      // Artifact root. SolidCash-owned files are written beneath its `solidcash/` namespace so native Hardhat
      // artifacts and build-info can coexist in the same root.
      artifacts: resolvePath(config.paths?.artifacts, 'artifacts'),
      tests: resolvePath(config.paths?.tests, 'test'),
      cache: resolvePath(config.paths?.cache, 'cache'),
    },
    networks: { mock: { type: 'mock' }, ...config.networks },
    defaultNetwork: config.defaultNetwork ?? 'mock',
    mnemonic: config.mnemonic,
    accounts: config.accounts,
    solc: compiler,
    compiler,
    typegen: {
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

/** Locate the nearest SolidCash config, or an explicitly opted-in Hardhat config. */
export function findConfigFile(dir: string = process.cwd()): string | undefined {
  for (const current of parentDirectories(dir)) {
    for (const name of CONFIG_BASENAMES) {
      const candidate = join(current, name);
      if (existsSync(candidate)) return candidate;
    }
    for (const name of HARDHAT_CONFIG_BASENAMES) {
      const candidate = join(current, name);
      if (!existsSync(candidate)) continue;
      const source = readFileSync(candidate, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      if (/\bsolidcash\s*:/.test(source) || /\bwithSolidCash\s*\(/.test(source)) return candidate;
    }
  }
  return undefined;
}

/** Locate the nearest Hardhat config, including one which has not opted into SolidCash yet. */
export function findHardhatConfigFile(dir: string = process.cwd()): string | undefined {
  for (const current of parentDirectories(dir)) {
    for (const name of HARDHAT_CONFIG_BASENAMES) {
      const candidate = join(current, name);
      if (existsSync(candidate)) return candidate;
    }
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
      cache: embedded.paths?.cache ?? config.paths?.cache,
    },
    mnemonic: embedded.mnemonic ?? hardhatAccounts?.mnemonic,
    accounts: embedded.accounts ?? inheritedAccounts,
  };
}

/** Load and resolve the config from `dir` (empty config if none found). */
export async function loadConfig(dir: string = process.cwd()): Promise<ResolvedConfig> {
  const file = findConfigFile(dir);
  if (!file) return resolveConfig({});
  const mod = await import(pathToFileURL(file).href);
  const exported = (mod.default ?? mod.config ?? {}) as SolidcashConfig & HardhatCompatConfig;
  const isHardhat = HARDHAT_CONFIG_BASENAMES.some((name) => file.endsWith(name));
  const user = isHardhat ? fromHardhatConfig(exported) : exported;
  return resolveConfig(user, dirname(file));
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
    '  compiler: { solidityImportCompat: true },',
  ];
  if (migrated.mnemonic) lines.push(`  mnemonic: ${JSON.stringify(migrated.mnemonic)},`);
  if (migrated.accounts) lines.push(
    `  accounts: ${JSON.stringify(migrated.accounts, null, 2).replace(/\n/g, '\n  ')},`,
  );
  lines.push("  networks: { mock: { type: 'mock' } },", "  defaultNetwork: 'mock',", '});', '');
  writeFileSync(target, lines.join('\n'), { encoding: 'utf8', flag: 'wx' });
  return target;
}
