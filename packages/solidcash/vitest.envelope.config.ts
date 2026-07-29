import { defineConfig } from 'vitest/config';

/**
 * F1 measurement config. Deliberately NOT named `vitest.config.ts`, so the root `packages/xx/vitest.config.ts`
 * project glob never picks it up and a normal `yarn test` is completely unaffected. It is the ordinary SDK
 * config plus the envelope probe, which is itself inert unless `L3_ENVELOPE_OUT` is set.
 */
export default defineConfig({
  test: {
    root: __dirname,
    environment: 'node',
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/types/**'],
    globals: true,
    setupFiles: ['./vitest.setup.ts', './test/e2e/layer3-envelope-probe.ts'],
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
});
