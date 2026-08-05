import { solidcashHardhatPreset } from '@solidcash/testing/vitest-preset';
import { defineConfig } from 'vitest/config';

export default defineConfig(solidcashHardhatPreset({
  test: {
    include: ['/Code/mistswap/mistswap/test/**/*.test.ts'],
  },
}));
