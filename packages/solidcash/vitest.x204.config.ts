import { defineConfig } from 'vitest/config';

/**
 * X204 settlement-attribution config. Named so the root `packages/**\/vitest.config.ts` project glob never
 * picks it up, exactly as the broadcast and envelope configs are. It is the ordinary SDK config plus the
 * X204 probe, which is itself inert unless `L3_X204_OUT` is set.
 */
export default defineConfig({
  test: {
    root: __dirname,
    environment: 'node',
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/types/**'],
    globals: true,
    setupFiles: ['./vitest.setup.ts', './test/e2e/layer3-x204-settlement-probe.ts'],
    testTimeout: 1_800_000,
    hookTimeout: 1_800_000,
  },
});
