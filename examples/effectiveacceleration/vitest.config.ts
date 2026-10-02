import { defineConfig } from 'vitest/config';
import { solidcashHardhatPreset } from '@solidcash/testing/vitest-preset';

// The drop-in: the reusable @solidcash/testing preset supplies all the Hardhat/ethers/chai aliases + setup.
// This project only aliases the older @noble/ciphers subpaths to the installed v2 build.
export default defineConfig(solidcashHardhatPreset({
  test: {
    include: ['test/marketplace.test.ts', 'test/decodeData.test.ts', 'test/encryption.test.ts', 'test/wagmiAbi.test.ts'],
    testTimeout: 120000,
  },
  resolve: {
    alias: {
      '@noble/ciphers/chacha': '@noble/ciphers/chacha.js',
      '@noble/ciphers/utils': '@noble/ciphers/utils.js',
    },
  },
}));
