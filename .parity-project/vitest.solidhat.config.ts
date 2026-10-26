import { defineConfig } from 'vitest/config';
import { solidcashHardhatPreset } from '@solidcash/testing/vitest-preset';

export default defineConfig(solidcashHardhatPreset({
  root: '.',
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 120000,
    // A fixture hook deploys a factory, tokens, WETH and a router; six suite files in parallel on a loaded host
    // push one past the 10s default, which reports a hook timeout as a test failure (measured: a combined run
    // showed 103/192 where the per-suite runs are 107/192). The hook is bounded work, so give it room.
    hookTimeout: 60000,
    silent: false,
  },
}));
