import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { solidcashHardhatPreset } from '@solidcash/testing/vitest-preset';

// The drop-in: the reusable @solidcash/testing preset supplies all the Hardhat/ethers/chai aliases + setup.
// This project only adds its own app-dep shim (@noble/ciphers v0.5 subpaths -> the installed v2 build).
export default defineConfig(solidcashHardhatPreset({
  test: {
    include: ['test/marketplace.test.ts'],
    testTimeout: 120000,
  },
  resolve: {
    alias: {
      '@noble/ciphers/chacha': '@noble/ciphers/chacha.js',
      '@noble/ciphers/utils': '@noble/ciphers/utils.js',
      '@noble/ciphers/crypto': fileURLToPath(new URL('./stubs/noble-crypto.ts', import.meta.url)),
    },
  },
}));
