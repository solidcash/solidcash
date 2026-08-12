import { defineConfig } from 'vitest/config';
import { solidhatPreset } from '@solidcash/solidhat/vitest-preset';
import { fileURLToPath } from 'node:url';

const cipher = (entry: string): string => fileURLToPath(new URL(`node_modules/@noble/ciphers/${entry}.js`, import.meta.url));

export default defineConfig(solidhatPreset(
  { hardhat: 2, ethers: 6 },
  {
    root: 'examples/effectiveacceleration',
    cacheDir: '../../.marketplace/vite-cache-utils',
    resolve: {
      alias: {
        '@noble/ciphers/chacha': cipher('chacha'),
        '@noble/ciphers/crypto': cipher('utils'),
        '@noble/ciphers/utils': cipher('utils'),
        '@noble/ciphers/webcrypto': cipher('utils'),
      },
    },
    test: {
      include: ['test/utils.test.ts'],
      testTimeout: 120_000,
      hookTimeout: 120_000,
      server: {
        deps: {
          inline: true,
        },
      },
    },
  },
));
