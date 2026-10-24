import { defineConfig } from 'vitest/config';
import { solidcashHardhatPreset } from '@solidcash/testing/vitest-preset';

export default defineConfig(solidcashHardhatPreset({
  root: '.',
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 120000,
    silent: false,
  },
}));
