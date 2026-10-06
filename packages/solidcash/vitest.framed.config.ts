import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Focused per-call suites (test/per-call/MANIFEST.md). They use no custom matchers, so the package setup file is
// not loaded, and they run without per-file isolation. Each worker loads the compiler and SDK graphs once, so the
// on-disk module cache, not parallelism, is what shortens a rerun.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/per-call/**/*.test.ts'],
    globals: true,
    isolate: false,
    maxWorkers: 3,
    // Compilation is deterministic, and these suites compile the same contracts in many files. The disk layer keeps
    // artifacts across runs; its key hashes every compiler source, so an edit misses. An outer
    // SOLIDC_COMPILE_CACHE_DIR wins, and '' turns the disk layer off.
    env: {
      SOLIDC_COMPILE_CACHE: '1',
      SOLIDC_COMPILE_CACHE_DIR: process.env.SOLIDC_COMPILE_CACHE_DIR
        ?? fileURLToPath(new URL('../../node_modules/.cache/solidc-compile', import.meta.url)),
    },
    testTimeout: 120_000,
    silent: 'passed-only',
    // Transpiled modules persist between runs and an edited file is transpiled again; `npx vitest --clearCache`
    // empties the cache.
    experimental: { fsModuleCache: true },
  },
});
