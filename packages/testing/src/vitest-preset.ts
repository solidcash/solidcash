/**
 * Reusable Vitest preset that turns a Hardhat/ethers/chai project into a SolidCash drop-in with NO test edits.
 * A ported project's vitest.config.ts becomes:
 *
 *   import { defineConfig } from 'vitest/config';
 *   import { solidcashHardhatPreset } from '@solidcash/testing/vitest-preset';
 *   export default defineConfig(solidcashHardhatPreset({ test: { include: ['test/**\/*.test.ts'] } }));
 *
 * It aliases `hardhat`/`chai`/`@nomicfoundation/*`/`@openzeppelin/hardhat-upgrades` to our code, registers the
 * matchers + loads solidcash.config.ts via a setup file, and excludes the source-linked workspace packages from
 * Vite's optimizer. Project-specific aliases (e.g. app-dep version shims) are merged from the passed config.
 */
import { fileURLToPath } from 'url';

/** Minimal structural Vite/Vitest config shape (version-agnostic; `defineConfig` accepts it structurally). */
export interface ViteLikeConfig {
  test?: { setupFiles?: string | string[]; [k: string]: unknown };
  resolve?: { alias?: Record<string, string>; [k: string]: unknown };
  optimizeDeps?: { exclude?: string[]; [k: string]: unknown };
  [k: string]: unknown;
}

const stub = (name: string): string => fileURLToPath(new URL(`./stubs/${name}.js`, import.meta.url));

/** The Hardhat/ethers/chai -> @solidcash/testing alias map (the heart of the drop-in). */
export function hardhatAliases(): Record<string, string> {
  return {
    hardhat: '@solidcash/testing',
    'hardhat/config': '@solidcash/testing',
    'hardhat/types': stub('empty'),
    '@nomicfoundation/hardhat-toolbox/network-helpers': '@solidcash/testing/network-helpers',
    '@nomicfoundation/hardhat-network-helpers': '@solidcash/testing/network-helpers',
    '@nomicfoundation/hardhat-ethers/signers': stub('empty'),
    '@nomicfoundation/hardhat-ethers': '@solidcash/testing',
    '@nomicfoundation/hardhat-chai-matchers': '@solidcash/testing/chai',
    '@openzeppelin/hardhat-upgrades': '@solidcash/testing',
    chai: '@solidcash/testing/chai',
    'chai-subset': stub('chai-plugin'),
    'chai-as-promised': stub('chai-plugin'),
    // Redirect the EVM CREATE-address predictors to BCH (category-based) identity; re-exports the rest of ethers.
    ethers: '@solidcash/testing/ethers-shim',
  };
}

/** Merge the SolidCash Hardhat-drop-in settings into a user Vitest config. */
export function solidcashHardhatPreset(userConfig: ViteLikeConfig = {}): ViteLikeConfig {
  const userAlias = (userConfig.resolve?.alias ?? {}) as Record<string, string>;
  const userExclude = userConfig.optimizeDeps?.exclude ?? [];
  const userSetup = userConfig.test?.setupFiles;
  const setupList = Array.isArray(userSetup) ? userSetup : userSetup ? [userSetup] : [];
  return {
    ...userConfig,
    optimizeDeps: {
      ...userConfig.optimizeDeps,
      exclude: ['solidc', 'solidcash', '@solidcash/testing', '@solidcash/utils', ...userExclude],
    },
    resolve: {
      ...userConfig.resolve,
      alias: { ...hardhatAliases(), ...userAlias },
    },
    test: {
      globals: true,
      environment: 'node',
      ...userConfig.test,
      setupFiles: ['@solidcash/testing/vitest-setup', ...setupList],
    },
  };
}
