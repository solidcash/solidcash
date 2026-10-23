import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export interface CompatibilityTarget { hardhat: 2 | 3; ethers: 5 | 6 }

export interface SolidHatPresetOptions {
  /**
   * Install the hermetic offline runtime: an in-memory IPFS service, a guard that fails any request no registered
   * service claims, and EVM JSON-RPC shims for ported deployment scripts. See `./offline-setup.js`.
   */
  offline?: boolean;
}

export interface AliasRule { find: string | RegExp; replacement: string }
export interface ViteLikeConfig {
  test?: { setupFiles?: string | string[]; [key: string]: unknown };
  resolve?: { alias?: Record<string, string> | AliasRule[]; dedupe?: string[]; [key: string]: unknown };
  optimizeDeps?: { exclude?: string[]; [key: string]: unknown };
  [key: string]: unknown;
}

const testingEntry = (name: string): string => fileURLToPath(
  new URL(`../../testing/dist/${name}.js`, import.meta.url),
);
const testingStub = (name: string): string => testingEntry(`stubs/${name}`);
const solidhatEntry = (name: string): string => fileURLToPath(
  new URL(`../dist/${name}.js`, import.meta.url),
);
// Resolve the package rather than a sibling path: it is a dependency of solidhat and resolves correctly in both
// layouts.
const requireFromHere = createRequire(import.meta.url);
const solidcashEntry = (): string => requireFromHere.resolve('@solidcash/solidcash');
const solidcashVitest = requireFromHere.resolve('@solidcash/solidcash/vitest');
const testingSetup = fileURLToPath(
  new URL('../../testing/dist/vitest-setup.js', import.meta.url),
);
const offlineSetup = solidhatEntry('offline-setup');

export function compatibilityAliases(target: CompatibilityTarget): Record<string, string> {
  return {
    hardhat: solidhatEntry(`hardhat${target.hardhat}`),
    'hardhat/config': solidhatEntry(`hardhat${target.hardhat}`),
    'hardhat/types': testingStub('empty'),
    ethers: solidhatEntry(`ethers${target.ethers}`),
    '@nomicfoundation/hardhat-ethers': solidhatEntry(`hardhat${target.hardhat}`),
    '@nomicfoundation/hardhat-ethers/signers': testingStub('empty'),
    '@nomiclabs/hardhat-ethers': solidhatEntry(`hardhat${target.hardhat}`),
    '@openzeppelin/hardhat-upgrades': solidhatEntry(`hardhat${target.hardhat}`),
    '@nomicfoundation/hardhat-network-helpers': testingEntry('network-helpers'),
    '@nomicfoundation/hardhat-toolbox/network-helpers': testingEntry('network-helpers'),
    '@nomicfoundation/hardhat-chai-matchers': testingEntry('chai'),
    chai: testingEntry('chai'),
    '@solidcash/testing': testingEntry('index'),
    '@solidcash/testing/config': testingEntry('config'),
    '@solidcash/testing/ethers': testingEntry('ethers-utils'),
    '@solidcash/testing/ethers-shim': testingEntry('ethers-shim'),
    '@solidcash/testing/hre': testingEntry('hre'),
    '@solidcash/solidcash': solidcashEntry(),
    'chai-subset': testingStub('chai-plugin'),
    'chai-as-promised': testingStub('chai-plugin'),
    // Keep the setup extension in the same workspace package graph as this preset. Vite otherwise resolves a
    // symlinked testing package through the source checkout and can look for this subpath in the wrong worktree.
    '@solidcash/solidcash/vitest': solidcashVitest,
  };
}

export function solidhatPreset(
  target: CompatibilityTarget,
  user: ViteLikeConfig = {},
  options: SolidHatPresetOptions = {},
): ViteLikeConfig {
  const setup = user.test?.setupFiles;
  const setupFiles = Array.isArray(setup) ? setup : setup ? [setup] : [];
  const aliases = compatibilityAliases(target);
  const exactAliases: AliasRule[] = Object.entries(aliases).map(([name, replacement]) => ({
    find: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
    replacement,
  }));
  const userAliases = Array.isArray(user.resolve?.alias)
    ? user.resolve.alias
    : Object.entries(user.resolve?.alias ?? {}).map(([find, replacement]) => ({ find, replacement }));
  return {
    ...user,
    resolve: {
      ...user.resolve,
      alias: [...exactAliases, ...userAliases],
      dedupe: ['@solidcash/testing', '@solidcash/solidcash', ...(user.resolve?.dedupe ?? [])],
    },
    optimizeDeps: {
      ...user.optimizeDeps,
      exclude: ['@solidcash/solidhat', '@solidcash/testing', ...(user.optimizeDeps?.exclude ?? [])],
    },
    test: {
      globals: true,
      environment: 'node',
      ...user.test,
      // The offline runtime installs after the testing setup, which is what creates the HRE it attaches to.
      setupFiles: [testingSetup, ...(options.offline ? [offlineSetup] : []), ...setupFiles],
    },
  };
}
