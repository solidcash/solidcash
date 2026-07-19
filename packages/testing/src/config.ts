/**
 * Config surface for the SolidCash harness (HARDHAT-PARITY.md WS1). Mirrors hardhat.config: paths, networks,
 * a default network, and the test mnemonic/accounts. `defineConfig` is the typed identity helper; `loadConfig`
 * dynamically imports `solidcash.config.{ts,js,mjs}` from a directory (the CLI runs under tsx so a .ts config
 * loads directly).
 */
import { pathToFileURL } from 'url';
import { existsSync } from 'fs';
import { resolve } from 'path';

export interface NetworkConfig {
  /** Which provider backs this network. */
  type?: 'mock' | 'regtest' | 'electrum' | 'bitcoin-rpc';
  electrum?: { host: string; port?: number };
  rpc?: { url: string; user?: string; password?: string };
}

export interface AccountsConfig {
  /** BIP-32 account branch (child index appended per account). */
  path?: string;
  count?: number;
  initialIndex?: number;
  /** Per-account funding on mock/regtest, in satoshis. */
  satoshis?: bigint;
}

export interface SolidcashConfig {
  paths?: {
    contracts?: string;
    artifacts?: string;
    tests?: string;
  };
  networks?: Record<string, NetworkConfig>;
  defaultNetwork?: string;
  /** The HD mnemonic getSigners derives from (defaults to the hardhat `test test ... junk` phrase). */
  mnemonic?: string;
  accounts?: AccountsConfig;
  /** Compiler options passed through to solidc `compileString`. */
  solc?: Record<string, unknown>;
}

/** Fully-resolved config (defaults applied). */
export interface ResolvedConfig extends Required<Pick<SolidcashConfig, 'paths' | 'defaultNetwork'>> {
  paths: Required<NonNullable<SolidcashConfig['paths']>>;
  networks: Record<string, NetworkConfig>;
  defaultNetwork: string;
  mnemonic?: string;
  accounts?: AccountsConfig;
  solc?: Record<string, unknown>;
}

/** Typed identity helper for `solidcash.config.ts` (mirrors hardhat `defineConfig`). */
export function defineConfig(config: SolidcashConfig): SolidcashConfig {
  return config;
}

const CONFIG_BASENAMES = ['solidcash.config.ts', 'solidcash.config.mjs', 'solidcash.config.js'];

/** Apply defaults to a user config. */
export function resolveConfig(config: SolidcashConfig = {}): ResolvedConfig {
  return {
    paths: {
      contracts: config.paths?.contracts ?? 'contracts',
      artifacts: config.paths?.artifacts ?? 'artifacts',
      tests: config.paths?.tests ?? 'test',
    },
    networks: { mock: { type: 'mock' }, ...config.networks },
    defaultNetwork: config.defaultNetwork ?? 'mock',
    mnemonic: config.mnemonic,
    accounts: config.accounts,
    solc: config.solc,
  };
}

/** Locate a solidcash config file in `dir`, returning its absolute path or undefined. */
export function findConfigFile(dir: string = process.cwd()): string | undefined {
  for (const name of CONFIG_BASENAMES) {
    const p = resolve(dir, name);
    if (existsSync(p)) return p;
  }
  return undefined;
}

/** Load and resolve the config from `dir` (empty config if none found). */
export async function loadConfig(dir: string = process.cwd()): Promise<ResolvedConfig> {
  const file = findConfigFile(dir);
  if (!file) return resolveConfig({});
  const mod = await import(pathToFileURL(file).href);
  const user = (mod.default ?? mod.config ?? {}) as SolidcashConfig;
  return resolveConfig(user);
}
