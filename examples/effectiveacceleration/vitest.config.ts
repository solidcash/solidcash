import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

const stub = (p: string): string => fileURLToPath(new URL(`./stubs/${p}`, import.meta.url));

// The drop-in: aliases redirect the ported project's Hardhat/ethers/chai imports to @solidcash/testing.
// The project's test files are NOT edited.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 120000,
    include: ['test/marketplace.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
  optimizeDeps: {
    exclude: ['solidc', 'solidcash', '@solidcash/testing', '@solidcash/utils'],
  },
  resolve: {
    alias: {
      hardhat: '@solidcash/testing',
      'hardhat/config': '@solidcash/testing',
      'hardhat/types': stub('empty.ts'),
      '@nomicfoundation/hardhat-toolbox/network-helpers': '@solidcash/testing/network-helpers',
      '@nomicfoundation/hardhat-ethers/signers': stub('empty.ts'),
      '@nomicfoundation/hardhat-ethers': '@solidcash/testing',
      '@nomicfoundation/hardhat-chai-matchers': '@solidcash/testing/chai',
      '@openzeppelin/hardhat-upgrades': '@solidcash/testing',
      chai: '@solidcash/testing/chai',
      'chai-subset': stub('chai-plugin.ts'),
      'chai-as-promised': stub('chai-plugin.ts'),
      '@noble/ciphers/chacha': '@noble/ciphers/chacha.js',
      '@noble/ciphers/utils': '@noble/ciphers/utils.js',
      '@noble/ciphers/crypto': stub('noble-crypto.ts'),
    },
  },
});
