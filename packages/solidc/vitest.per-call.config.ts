import { defineConfig } from 'vitest/config';

// Focused per-call suites (packages/solidcash/test/per-call/MANIFEST.md). Each worker loads the compiler's source
// graph once, so the on-disk module cache, not parallelism, is what shortens a rerun.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/per-call/**/*.test.ts'],
    globals: true,
    isolate: false,
    maxWorkers: 3,
    // Compilation is deterministic, and these suites compile the same contracts in many files.
    env: { SOLIDC_COMPILE_CACHE: '1' },
    testTimeout: 60_000,
    silent: 'passed-only',
    // Transpiled modules persist between runs and an edited file is transpiled again; `npx vitest --clearCache`
    // empties the cache.
    experimental: { fsModuleCache: true },
  },
});
