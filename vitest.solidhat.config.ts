import { defineConfig } from 'vitest/config';
import { solidhatPreset } from '@solidcash/solidhat/vitest-preset';
import { fileURLToPath } from 'node:url';

const cipher = (entry: string): string => fileURLToPath(new URL(`node_modules/@noble/ciphers/${entry}.js`, import.meta.url));
const projectRoot = fileURLToPath(new URL('examples/effectiveacceleration', import.meta.url));
process.env.SOLIDCASH_PROJECT_ROOT = projectRoot;

export default defineConfig(solidhatPreset(
  { hardhat: 2, ethers: 6 },
  {
    root: projectRoot,
    cacheDir: '../../.marketplace/vite-cache-marketplace',
    resolve: {
      alias: {
        '@noble/ciphers/chacha': cipher('chacha'),
        '@noble/ciphers/crypto': cipher('utils'),
        '@noble/ciphers/utils': cipher('utils'),
        '@noble/ciphers/webcrypto': cipher('utils'),
      },
    },
    test: {
      include: ['test/marketplace.test.ts'],
      testTimeout: 120_000,
      hookTimeout: 120_000,
    },
  },
));
