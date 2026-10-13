import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Vitest 5 clears mock call history before every test. This suite reads history recorded in hooks.
    clearMocks: false,
    environment: 'node',
    // Tests are authored in TypeScript. Build output can exist beside sources in a development worktree; never
    // discover those stale JavaScript copies as a second, independently scheduled version of the same test.
    include: ['test/**/*.{test,spec}.?(c|m)ts?(x)'],
    exclude: ['**/types/**'],
    globals: true,
    // Stateful kernel E2E workers each retain the generated compiler/ANTLR graph plus large VM traces. Measured
    // RSS reaches roughly 1.2-1.9 GiB per worker; running the default one-worker-per-core pool pushed a 10-core
    // host into swap and made otherwise deterministic recurrence tests approach their timeout. Keep enough
    // concurrency for the suite while bounding aggregate memory and scheduler contention.
    maxWorkers: 3,
    silent: 'passed-only',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
    setupFiles: ['./vitest.setup.ts'],
    // Live-node e2e tests do many sequential sends (each broadcast + auto-mine + Fulcrum index is ~2-6s for a
    // stateful call with auto-derivation), so a multi-send test can exceed 100s on regtest under load.
    // Mock was 50s, which parallel-worker rounds blow: four full runs near one commit each failed a DIFFERENT
    // file (MessageBusMappingJournalS1, RepeatedExternalBatchCorpus, MessageBusResultGraph, EcrecoverRecovery), every
    // one green in isolation, all four relying on this default. 120s still catches hangs (a hang is unbounded)
    // and stays under the regtest budget.
    testTimeout: process.env.TESTS_USE_REGTEST ? 180000 : 120000,
    hookTimeout: process.env.TESTS_USE_REGTEST ? 180000 : 10000,
  },
});
