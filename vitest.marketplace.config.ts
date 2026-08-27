import { defineConfig } from 'vitest/config';
import { solidhatPreset } from '@solidcash/solidhat/vitest-preset';
import { fileURLToPath } from 'node:url';

const cipher = (entry: string): string => fileURLToPath(new URL(`node_modules/@noble/ciphers/${entry}.js`, import.meta.url));
const worktreeRoot = fileURLToPath(new URL('.', import.meta.url));
const requestedWorkerHeapMb = Number.parseInt(
  process.env.SOLIDCASH_MARKETPLACE_WORKER_HEAP_MB ?? '8192', 10,
);
const workerHeapMb = Number.isSafeInteger(requestedWorkerHeapMb) && requestedWorkerHeapMb >= 512
  ? requestedWorkerHeapMb : 8192;
const workerExecArgv = [`--max-old-space-size=${workerHeapMb}`];
const cpuProfileDir = process.env.SOLIDCASH_MARKETPLACE_CPU_PROFILE_DIR;
if (cpuProfileDir) workerExecArgv.push('--cpu-prof', `--cpu-prof-dir=${cpuProfileDir}`);
const workerPreload = process.env.SOLIDCASH_MARKETPLACE_WORKER_PRELOAD;
if (workerPreload) workerExecArgv.push(`--require=${workerPreload}`);
const workerInspectPort = Number.parseInt(process.env.SOLIDCASH_MARKETPLACE_WORKER_INSPECT_PORT ?? '', 10);
if (Number.isSafeInteger(workerInspectPort) && workerInspectPort > 0 && workerInspectPort < 65_536) {
  workerExecArgv.push(`--inspect=127.0.0.1:${workerInspectPort}`);
}
process.env.SOLIDCASH_PROJECT_ROOT = worktreeRoot;

export default defineConfig(solidhatPreset(
  { hardhat: 2, ethers: 6 },
  {
    root: worktreeRoot,
    cacheDir: '.marketplace/vite-cache-marketplace',
    resolve: {
      // Keep the canonical test and application source symlinks rooted under this checkout so all bare package
      // imports resolve through this worktree's fully materialized node_modules tree.
      preserveSymlinks: true,
      alias: {
        '@noble/ciphers/chacha': cipher('chacha'),
        '@noble/ciphers/crypto': cipher('utils'),
        '@noble/ciphers/utils': cipher('utils'),
        '@noble/ciphers/webcrypto': cipher('utils'),
      },
    },
    test: {
      include: ['.marketplace/project/test/marketplace.test.ts'],
      testTimeout: 600_000,
      hookTimeout: 600_000,
      fileParallelism: false,
      // The fixture retains several multi-megabyte covenant transactions. Avoid spending most of a full run in
      // major GC at Node's default ~4 GB worker ceiling, and expose per-test progress without SDK debug logging.
      // Keep the large-suite default, but let focused diagnostics fail at a controlled process-local heap limit
      // rather than allowing a leaking probe to exhaust the host before it can report its phase.
      execArgv: workerExecArgv,
      reporters: ['verbose'],
    },
  },
));
