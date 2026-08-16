import { defineConfig } from 'vitest/config';
import { solidhatPreset } from '@solidcash/solidhat/vitest-preset';
import { fileURLToPath } from 'node:url';

const cipher = (entry: string): string => fileURLToPath(new URL(`node_modules/@noble/ciphers/${entry}.js`, import.meta.url));
const worktreeRoot = fileURLToPath(new URL('.', import.meta.url));
const bchCompatSrc = fileURLToPath(new URL('examples/effectiveacceleration/src', import.meta.url));
process.env.SOLIDCASH_PROJECT_ROOT = worktreeRoot;

export default defineConfig(solidhatPreset(
  { hardhat: 2, ethers: 6 },
  {
    root: worktreeRoot,
    cacheDir: '.marketplace/vite-cache-marketplace',
    resolve: {
      alias: {
        // The marketplace test file is unchanged; its `../src` import follows the
        // EA symlink. Replay helpers there assume 20-byte EVM addresses. Use the
        // worktree BCH-compat utils instead (same exports, locking-bytecode aware).
        '/Code/effectiveacceleration.ai/contract/src': bchCompatSrc,
        '@noble/ciphers/chacha': cipher('chacha'),
        '@noble/ciphers/crypto': cipher('utils'),
        '@noble/ciphers/utils': cipher('utils'),
        '@noble/ciphers/webcrypto': cipher('utils'),
      },
    },
    test: {
      include: ['.marketplace/project/test/marketplace.test.ts'],
      testTimeout: 600_000,
      hookTimeout: 600_000,
      fileParallelism: false,
      server: {
        deps: {
          inline: true,
        },
      },
    },
  },
));
