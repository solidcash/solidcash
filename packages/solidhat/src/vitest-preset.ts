export interface CompatibilityTarget { hardhat: 2 | 3; ethers: 5 | 6 }
export interface AliasRule { find: string | RegExp; replacement: string }
export interface ViteLikeConfig {
  test?: { setupFiles?: string | string[]; [key: string]: unknown };
  resolve?: { alias?: Record<string, string> | AliasRule[]; [key: string]: unknown };
  optimizeDeps?: { exclude?: string[]; [key: string]: unknown };
  [key: string]: unknown;
}

export function compatibilityAliases(target: CompatibilityTarget): Record<string, string> {
  return {
    hardhat: `@solidcash/solidhat/hardhat${target.hardhat}`,
    'hardhat/config': `@solidcash/solidhat/hardhat${target.hardhat}`,
    ethers: `@solidcash/solidhat/ethers${target.ethers}`,
    '@nomicfoundation/hardhat-ethers': `@solidcash/solidhat/hardhat${target.hardhat}`,
    '@nomiclabs/hardhat-ethers': `@solidcash/solidhat/hardhat${target.hardhat}`,
    '@openzeppelin/hardhat-upgrades': `@solidcash/solidhat/hardhat${target.hardhat}`,
    '@nomicfoundation/hardhat-network-helpers': '@solidcash/testing/network-helpers',
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
    },
    optimizeDeps: {
      ...user.optimizeDeps,
      exclude: ['@solidcash/solidhat', '@solidcash/testing', ...(user.optimizeDeps?.exclude ?? [])],
    },
    test: {
      globals: true,
      environment: 'node',
      ...user.test,
      setupFiles: ['@solidcash/testing/vitest-setup', ...setupFiles],
    },
  };
}
