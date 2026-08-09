import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.js';

// A dedicated watch config avoids passing `test/e2e` as a positional filter.
// That filter is OR-ed with a developer's file filter and accidentally runs the
// entire e2e suite; an include pattern composes correctly with CLI file filters.
export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: ['test/e2e/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
  },
}));
