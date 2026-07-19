import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: './test',
  // These are source-linked workspace packages; excluding them from Vite's dep pre-bundler avoids the
  // intermittent "Failed to resolve entry for package" optimizer race on a cold cache.
  optimizeDeps: {
    exclude: ['solidc', 'solidcash', '@solidcash/testing', '@solidcash/utils'],
  },
  resolve: {
    alias: {
      // Drop-in aliases: ported Hardhat/ethers/chai test files keep their bare imports.
      hardhat: '@solidcash/testing',
      chai: '@solidcash/testing/chai',
      '@nomicfoundation/hardhat-network-helpers': '@solidcash/testing/network-helpers',
    },
  },
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 50000,
    silent: 'passed-only',
    coverage: {
      provider: 'v8',
      reporter: ['json-summary'],
    },
  },
});
