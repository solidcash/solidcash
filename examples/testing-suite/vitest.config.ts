import { defineConfig } from 'vitest/config';
import { solidcashHardhatPreset } from '@solidcash/testing/vitest-preset';

// The reusable @solidcash/testing preset supplies the Hardhat/ethers/chai drop-in aliases + setup + optimizeDeps.
export default defineConfig(solidcashHardhatPreset({
  root: './test',
  test: {
    // Vitest 5 clears mock call history before every test. This suite reads history recorded in hooks.
    clearMocks: false,
    testTimeout: 50000,
    silent: 'passed-only',
    coverage: { provider: 'v8', reporter: ['json-summary'] },
  },
}));
