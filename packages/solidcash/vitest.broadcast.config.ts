import { defineConfig } from 'vitest/config';

/**
 * X49 broadcast-capture config. Named so the root `packages/xx/vitest.config.ts` project glob never picks it
 * up, exactly as F1's envelope config is. It is the ordinary SDK config plus the broadcast probe, which is
 * itself inert unless `L3_BROADCAST_OUT` is set.
 */
export default defineConfig({
  test: {
    root: __dirname,
    environment: 'node',
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/types/**'],
    globals: true,
    setupFiles: ['./vitest.setup.ts', './test/journal-message-bus/e2e/layer3-broadcast-probe.ts'],
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
});
