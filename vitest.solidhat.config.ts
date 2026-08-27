import { defineConfig } from 'vitest/config';
import { solidhatPreset } from '@solidcash/solidhat/vitest-preset';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cipher = (entry: string): string => require.resolve(`@noble/ciphers/${entry}.js`);
const projectRoot = '/Code/effectiveacceleration.ai/contract-noproxy';
process.env.SOLIDCASH_PROJECT_ROOT = projectRoot;

export default defineConfig(solidhatPreset(
  { hardhat: 2, ethers: 6 },
  {
    root: projectRoot,
    cacheDir: 'cache/vite',
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
      testTimeout: 7_200_000,
      hookTimeout: 7_200_000,
    },
  },
));
