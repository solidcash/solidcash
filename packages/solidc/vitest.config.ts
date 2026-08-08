import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/types/**'],
    globals: true,
    // Compiler tests measure real compilation, and several message-bus cases compile eight or nine contracts
    // in one test. At vitest's 5s default they pass in isolation and time out under the load of a full
    // multi-package run - 9 such failures were measured at this commit, every one a timeout and none an
    // assertion. A red suite made only of timeouts hides real regressions, so the budget is raised to a value
    // that still fails a genuine hang. Individual tests keep their own tighter or looser explicit budgets.
    //
    // Raised again from 30s after a CLEAN-CLONE run: a fresh checkout's FIRST `yarn test` timed out on 6 files
    // (Events, Lexer, ImportedHardErrorPositionX107, InjectLocktimeGuardTraversal, CallManifestIneligibility
    // MatrixV1, calls-abi), every one a timeout and none an assertion, and all 6 passed on a warm re-run in the
    // same clone. That first run is what CI does every time: the yarn cache restores node_modules but not
    // vitest's transform cache, so CI pays the cold cost on every job. 60s keeps a genuine hang failing while
    // removing a flake that would read as a real regression.
    testTimeout: 60_000,
    silent: 'passed-only',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/grammar/**/*.ts'],
    },
    setupFiles: ['./vitest.setup.ts'],
  },
});
