import { defineConfig } from 'vitest/config';

/**
 * F2 measurement config. Deliberately NOT named `vitest.config.ts`, so the root project glob never picks it
 * up and a normal `yarn test` is completely unaffected. It is the ordinary SDK config plus the estimator
 * probe, which is itself inert unless `L3_ESTIMATOR_OUT` is set.
 */
export default defineConfig({
  test: {
    root: __dirname,
    environment: 'node',
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/types/**'],
    globals: true,
    setupFiles: ['./vitest.setup.ts', './test/journal-message-bus/e2e/message-bus-estimator-probe.ts'],
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
});
