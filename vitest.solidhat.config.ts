import { defineConfig } from 'vitest/config';
import { solidhatPreset } from '@solidcash/solidhat/vitest-preset';
import { fileURLToPath } from 'node:url';

const cipher = (entry: string): string => fileURLToPath(new URL(`node_modules/@noble/ciphers/${entry}.js`, import.meta.url));
const projectRoot = fileURLToPath(new URL('examples/effectiveacceleration', import.meta.url));
// Vitest discovers the checked-in compatibility test from the example root, while SolidHat must load the
// canonical artifacts compiled by the repository-level marketplace config. Keeping these roots distinct avoids
// silently exercising the example's stale checked-in artifacts after refreshing `.marketplace/artifacts`.
process.env.SOLIDCASH_PROJECT_ROOT = fileURLToPath(new URL('.', import.meta.url));

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
