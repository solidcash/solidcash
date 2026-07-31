import { defineConfig } from 'vitest/config';

/**
 * X175 admin-site throw-census config. Named so the root `packages/xx/vitest.config.ts` project glob never
 * picks it up, exactly as the census, gatesite, envelope, broadcast and estimator configs are. Ordinary SDK
 * config plus `test/e2e/x175-admin-census.ts`, which is itself inert unless `L3_X175_OUT` is set.
 */
export default defineConfig({
  test: {
    root: __dirname,
    environment: 'node',
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/types/**'],
    globals: true,
    silent: true,
    setupFiles: ['./vitest.setup.ts', './test/e2e/x175-admin-census.ts'],
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
});
