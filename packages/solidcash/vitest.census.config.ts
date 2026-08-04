import { defineConfig } from 'vitest/config';

/**
 * X130/X131 throw-census config. Named so the root `packages/xx/vitest.config.ts` project glob never picks it
 * up, exactly as the gatesite, envelope, broadcast and estimator configs are. Ordinary SDK config plus the
 * throw census, which is itself inert unless `L3_CENSUS_OUT` is set.
 */
export default defineConfig({
  test: {
    root: __dirname,
    environment: 'node',
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/types/**'],
    globals: true,
    silent: true,
    setupFiles: ['./vitest.setup.ts', './test/journal-message-bus/e2e/message-bus-throw-census.ts'],
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
});
