import { defineConfig } from 'vitest/config';
import { availableParallelism } from 'node:os';

// Mocknet e2e is CPU-bound (compile + VM) and mostly isolated per file; use all cores for local iteration.
// Cap can still be overridden via VITEST_MAX_WORKERS.
const defaultWorkers = Math.max(1, availableParallelism());

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
    // file (MessageBusMappingJournalS1, RepeatedExternalBatchCorpus, MessageBusResultGraph, EcrecoverRecovery), every
    // one green in isolation, all four relying on this default. 120s still catches hangs (a hang is unbounded)
    // and stays under the regtest budget.
    testTimeout: process.env.TESTS_USE_REGTEST ? 180000 : 120000,
    hookTimeout: process.env.TESTS_USE_REGTEST ? 180000 : 10000,
    // Prefer more file-level parallelism on multi-core hosts (mocknet is process-isolated by file).
    maxWorkers: process.env.VITEST_MAX_WORKERS
      ? Number(process.env.VITEST_MAX_WORKERS)
      : defaultWorkers,
    fileParallelism: true,
  },
});
