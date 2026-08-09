import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/types/**'],
    globals: true,
    // Compiler modules are several megabytes after ANTLR generation. Reusing each worker's
    // module graph avoids re-transforming and re-evaluating it for every test file.
    isolate: false,
    // Compilation is CPU- and memory-heavy; using every logical core increases contention.
    maxWorkers: '60%',
    // Root Vitest projects require projects with distinct worker budgets to run in distinct groups. Running
    // the compiler after the lighter packages also prevents both pools from contending for memory at once.
    sequence: { groupOrder: 1 },
    // Compiler tests measure real compilation, and several message-bus cases compile eight or nine contracts
    // in one test. At vitest's 5s default they pass in isolation and time out under the load of a full
    // multi-package run - 9 such failures were measured at this commit, every one a timeout and none an
    // assertion. A red suite made only of timeouts hides real regressions, so the budget is raised to a value
    // that still fails a genuine hang. Individual tests keep their own tighter or looser explicit budgets.
    testTimeout: 30_000,
    silent: 'passed-only',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/grammar/**/*.ts'],
    },
    setupFiles: ['./vitest.setup.ts'],
  },
});
