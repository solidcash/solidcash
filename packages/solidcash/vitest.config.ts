import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/types/**'],
    globals: true,
    silent: 'passed-only',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
    setupFiles: ['./vitest.setup.ts'],
    // Live-node e2e tests do many sequential sends (each broadcast + auto-mine + Fulcrum index is ~2-6s for a
    // stateful call with auto-derivation), so a multi-send test can exceed 100s on regtest under load. Mock keeps
    // the tight 50s (fast, preserves hang/perf detection).
    testTimeout: process.env.TESTS_USE_REGTEST ? 180000 : 50000,
  },
});
