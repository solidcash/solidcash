import { defineConfig } from 'vitest/config';
import { solidcashHardhatPreset } from '@solidcash/testing/vitest-preset';

export default defineConfig(solidcashHardhatPreset({
  root: '.',
  test: {
    include: ['test/**/*.test.ts'],
    // One case deploys a pair, registers it, adds liquidity, swaps and removes liquidity: a devnet mines each
    // transaction in seconds.
    testTimeout: 600_000,
    hookTimeout: 600_000,
    silent: false,
    // Every file spends the same devnet accounts; parallel files race on those UTXOs and fail with
    // `bad-txns-inputs-missingorspent`.
    fileParallelism: false,
  },
}));
