import { defineConfig } from 'vitest/config';

/**
 * X163 Row B overhead-measurement config. Named so the root `packages/xx/vitest.config.ts` project glob never
 * picks it up. Ordinary SDK config plus the overhead probe, which is itself inert unless `L4_OVERHEAD_OUT` is
 * set.
 */
export default defineConfig({
  test: {
    root: __dirname,
    environment: 'node',
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/types/**'],
    globals: true,
    silent: true,
    setupFiles: ['./vitest.setup.ts', './test/e2e/l4-overhead-probe.ts'],
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
});
