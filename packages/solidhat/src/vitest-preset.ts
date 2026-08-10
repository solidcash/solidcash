export interface CompatibilityTarget { hardhat: 2 | 3; ethers: 5 | 6 }
export interface AliasRule { find: string | RegExp; replacement: string }
export interface ViteLikeConfig {
  test?: { setupFiles?: string | string[]; [key: string]: unknown };
  resolve?: { alias?: Record<string, string> | AliasRule[]; dedupe?: string[]; [key: string]: unknown };
  optimizeDeps?: { exclude?: string[]; [key: string]: unknown };
  [key: string]: unknown;
}

const testingStub = (name: string): string => fileURLToPath(
  new URL(`../../testing/dist/stubs/${name}.js`, import.meta.url),
);
const solidcashVitest = fileURLToPath(
  new URL('../../solidcash/dist/test/TestExtensions.js', import.meta.url),
);
const testingSetup = fileURLToPath(
  new URL('../../testing/dist/vitest-setup.js', import.meta.url),
);

export function compatibilityAliases(target: CompatibilityTarget): Record<string, string> {
  return {
    hardhat: `@solidcash/solidhat/hardhat${target.hardhat}`,
    'hardhat/config': `@solidcash/solidhat/hardhat${target.hardhat}`,
    'hardhat/types': testingStub('empty'),
    ethers: `@solidcash/solidhat/ethers${target.ethers}`,
    '@nomicfoundation/hardhat-ethers': `@solidcash/solidhat/hardhat${target.hardhat}`,
    '@nomicfoundation/hardhat-ethers/signers': testingStub('empty'),
    '@nomiclabs/hardhat-ethers': `@solidcash/solidhat/hardhat${target.hardhat}`,
    '@openzeppelin/hardhat-upgrades': `@solidcash/solidhat/hardhat${target.hardhat}`,
    '@nomicfoundation/hardhat-network-helpers': '@solidcash/testing/network-helpers',
    '@nomicfoundation/hardhat-toolbox/network-helpers': '@solidcash/testing/network-helpers',
    '@nomicfoundation/hardhat-chai-matchers': '@solidcash/testing/chai',
    chai: '@solidcash/testing/chai',
    'chai-subset': testingStub('chai-plugin'),
    'chai-as-promised': testingStub('chai-plugin'),
    // Keep the setup extension in the same workspace package graph as this preset. Vite otherwise resolves a
    // symlinked testing package through the source checkout and can look for this subpath in the wrong worktree.
    'solidcash/vitest': solidcashVitest,
  };
}

export function solidhatPreset(target: CompatibilityTarget, user: ViteLikeConfig = {}): ViteLikeConfig {
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
      dedupe: ['@solidcash/testing', 'solidcash', ...(user.resolve?.dedupe ?? [])],
    },
    optimizeDeps: {
      ...user.optimizeDeps,
      exclude: ['@solidcash/solidhat', '@solidcash/testing', ...(user.optimizeDeps?.exclude ?? [])],
    },
    test: {
      globals: true,
      environment: 'node',
      ...user.test,
      setupFiles: [testingSetup, ...setupFiles],
    },
  };
}
import { fileURLToPath } from 'url';
