import path from 'path';
import fs from 'fs';

export interface NetworkConfig {
  /** Network URL (Electrum server for chipnet/mainnet) */
  url?: string;
  /** Mnemonic for account derivation */
  mnemonic?: string;
  /** Number of accounts to derive (default: 10) */
  accountCount?: number;
  /** Default satoshi balance for mock accounts (default: 100_000) */
  accountBalance?: bigint;
}

export interface SolidCashConfig {
  /** Compiler settings */
  compiler?: {
    /** Compiler version constraint (default: '>=0.13.0') */
    version?: string;
  };

  /** Directory paths (all relative to project root) */
  paths?: {
    /** Contract source files (default: 'contracts') */
    sources?: string;
    /** Compiled artifacts (default: 'artifacts') */
    artifacts?: string;
    /** Test files (default: 'test') */
    tests?: string;
    /** Deployment scripts (default: 'scripts') */
    scripts?: string;
  };

  /** Network configurations */
  networks?: {
    /** In-memory mock network (default, always available) */
    mocknet?: NetworkConfig;
    /** Local regtest node */
    regtest?: NetworkConfig;
    /** BCH chipnet (testnet) */
    chipnet?: NetworkConfig;
    /** BCH mainnet */
    mainnet?: NetworkConfig;
    /** Custom named networks */
    [name: string]: NetworkConfig | undefined;
  };

  /** Default network to use (default: 'mocknet') */
  defaultNetwork?: string;
}

const DEFAULT_CONFIG = {
  compiler: {
    version: '>=0.13.0',
  },
  paths: {
    sources: 'contracts',
    artifacts: 'artifacts',
    tests: 'test',
    scripts: 'scripts',
  },
  networks: {
    mocknet: {
      accountCount: 10,
      accountBalance: 100_000n,
    },
  },
  defaultNetwork: 'mocknet',
};

/** Resolve paths relative to project root */
export interface ResolvedPaths {
  root: string;
  sources: string;
  artifacts: string;
  tests: string;
  scripts: string;
}

export interface ResolvedConfig {
  compiler: Required<SolidCashConfig>['compiler'];
  paths: ResolvedPaths;
  networks: NonNullable<SolidCashConfig['networks']>;
  defaultNetwork: string;
}

/**
 * Load solidcash.config.ts from the project root.
 * Falls back to defaults if no config file is found.
 */
export async function loadConfig(projectRoot?: string): Promise<ResolvedConfig> {
  const root = projectRoot ?? process.cwd();
  let userConfig: SolidCashConfig = {};

  const configPath = path.join(root, 'solidcash.config.ts');
  const configPathJs = path.join(root, 'solidcash.config.js');

  if (fs.existsSync(configPath) || fs.existsSync(configPathJs)) {
    const actualPath = fs.existsSync(configPath) ? configPath : configPathJs;
    try {
      const imported = await import(actualPath);
      userConfig = imported.default ?? imported;
    } catch {
      // If native import fails (TS file), try dynamic import with tsx loader
      try {
        const imported = await import(`file://${actualPath}`);
        userConfig = imported.default ?? imported;
      } catch {
        console.warn(`Warning: could not load ${actualPath}, using defaults`);
      }
    }
  }

  return resolveConfig(userConfig, root);
}

export function resolveConfig(userConfig: SolidCashConfig, root: string): ResolvedConfig {
  const paths = {
    root,
    sources: path.resolve(root, userConfig.paths?.sources ?? DEFAULT_CONFIG.paths.sources),
    artifacts: path.resolve(root, userConfig.paths?.artifacts ?? DEFAULT_CONFIG.paths.artifacts),
    tests: path.resolve(root, userConfig.paths?.tests ?? DEFAULT_CONFIG.paths.tests),
    scripts: path.resolve(root, userConfig.paths?.scripts ?? DEFAULT_CONFIG.paths.scripts),
  };

  const networks = {
    ...DEFAULT_CONFIG.networks,
    ...userConfig.networks,
  };

  return {
    compiler: { ...DEFAULT_CONFIG.compiler, ...userConfig.compiler },
    paths,
    networks,
    defaultNetwork: userConfig.defaultNetwork ?? DEFAULT_CONFIG.defaultNetwork,
  };
}

/**
 * Helper to define config with type safety.
 * Usage in solidcash.config.ts:
 *   import { defineConfig } from '@solidcash/testing';
 *   export default defineConfig({ ... });
 */
export function defineConfig(config: SolidCashConfig): SolidCashConfig {
  return config;
}
