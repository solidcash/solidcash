import { defineConfig } from 'vitest/config';

// The focused framed suite of the testing layer: it drives a contract compiled for the composition convention
// through the same `getContractFactory(...).deploy(...)` entry a Hardhat-style project uses. Each worker loads the
// compiler and SDK graphs once, so the on-disk module cache, not parallelism, is what shortens a rerun.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/framed/**/*.test.ts'],
    globals: true,
    isolate: false,
    maxWorkers: 3,
    // Compilation is deterministic, and these suites compile the same contracts in many files.
    env: { SOLIDC_COMPILE_CACHE: '1' },
    testTimeout: 120_000,
    silent: 'passed-only',
    // Transpiled modules persist between runs and an edited file is transpiled again; `npx vitest --clearCache`
    // empties the cache.
    experimental: { fsModuleCache: true },
  },
});
