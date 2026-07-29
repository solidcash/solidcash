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
    // stateful call with auto-derivation), so a multi-send test can exceed 100s on regtest under load.
    // Mock was 50s, which parallel-worker rounds blow: four full runs near one commit each failed a DIFFERENT
    // file (Layer3MappingJournalS1, RepeatedExternalBatchCorpus, Layer3ResultGraph, EcrecoverRecovery), every
    // one green in isolation, all four relying on this default. 120s still catches hangs (a hang is unbounded)
    // and stays under the regtest budget.
    testTimeout: process.env.TESTS_USE_REGTEST ? 180000 : 120000,
  },
});
