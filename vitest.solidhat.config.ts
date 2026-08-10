import { defineConfig } from 'vitest/config';
import { solidhatPreset } from '@solidcash/solidhat/vitest-preset';

export default defineConfig(solidhatPreset(
  { hardhat: 2, ethers: 6 },
  {
    cacheDir: '.marketplace/vite-cache',
    test: {
      include: ['.marketplace/project/test/marketplace.test.ts'],
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
