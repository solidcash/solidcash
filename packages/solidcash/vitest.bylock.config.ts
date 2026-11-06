import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The framed suites on a mock network with no category index (test/framed/by-lock-setup.ts): every read has to find
// what it needs at the locks it derives, as on a Fulcrum server. A suite whose own test code lists a category cannot
// run here, so it is left out by name. One worker: pass a directory to take a part of it.
const root = fileURLToPath(new URL('.', import.meta.url));
const walk = (directory: string): string[] => readdirSync(directory).flatMap((name) => {
  const path = join(directory, name);
  return statSync(path).isDirectory() ? walk(path) : path.endsWith('.test.ts') ? [path] : [];
});
const listsByCategory = walk(join(root, 'test/framed'))
  .filter((file) => readFileSync(file, 'utf8').includes('getUtxosByTokenCategory'));
// Asserts the mock's clock register to the second, which the pool coin a by-lock read takes states one second behind.
const mockClock = join(root, 'test/framed/deploy/proxy-dynamic-append-growth.test.ts');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/framed/**/*.test.ts'],
    exclude: ['**/node_modules/**', ...listsByCategory, mockClock],
    setupFiles: ['./test/framed/by-lock-setup.ts'],
    globals: true,
    isolate: false,
    maxWorkers: 1,
    env: {
      SOLIDC_COMPILE_CACHE: '1',
      SOLIDC_COMPILE_CACHE_DIR: process.env.SOLIDC_COMPILE_CACHE_DIR
        ?? fileURLToPath(new URL('../../node_modules/.cache/solidc-compile', import.meta.url)),
    },
    testTimeout: 120_000,
    silent: 'passed-only',
    experimental: { fsModuleCache: true },
  },
});
