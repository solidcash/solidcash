import { defineConfig } from 'vitest/config';
import { solidhatPreset } from '@solidcash/solidhat/vitest-preset';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cipher = (entry: string): string => require.resolve(`@noble/ciphers/${entry}.js`);
const worktreeRoot = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = fileURLToPath(new URL('./.marketplace/project/', import.meta.url));
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
// The kernel lane materializes `.marketplace/project` as a self-contained project with its own solidcash config (the
// no-proxy twin); the framed lane keeps the config, artifacts and compiler build at the worktree root, which the
// fixture-freshness setup reads through this variable. Each layout gets the root its config lives at.
const projectHasOwnConfig = ['solidcash.config.ts', 'solidcash.config.mjs', 'solidcash.config.js']
  .some((name) => existsSync(path.join(projectRoot, name)));
process.env.SOLIDCASH_PROJECT_ROOT = projectHasOwnConfig ? projectRoot : worktreeRoot;

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
      // A run measures the compiled fixture on disk, so a fixture older than the compiler build is refused up front.
      globalSetup: ['./scripts/marketplace-fixture-fresh.mjs'],
      // Kernel-mode history tests compose dozens of multi-participant BCH transactions serially. Keep the
      // unchanged upstream test bodies authoritative rather than aborting a healthy loop at the ten-minute mark.
      // The original 20-minute budget does not hold for the no-proxy twin. Measured 2026-10-06 at 19f6c28b5:
      // `approve result and review sanity checks` is 1148.58 s of test time (1155.62 s file) on a lightly loaded
      // box, but 1360.99 s in a full ladder run on a loaded one, and it timed out at a 1_200_000 ms cap there. The
      // cap is 30 minutes: half again the loaded worst case measured so far, and tighter than the 40 minutes a
      // 20-26-minute reading previously justified. Raise it only with a new measurement.
      testTimeout: 1_800_000,
      hookTimeout: 1_800_000,
      fileParallelism: false,
      // The fixture retains several multi-megabyte covenant transactions. Avoid spending most of a full run in
      // major GC at Node's default ~4 GB worker ceiling, and expose per-test progress without SDK debug logging.
      // Keep the large-suite default, but let focused diagnostics fail at a controlled process-local heap limit
      // rather than allowing a leaking probe to exhaust the host before it can report its phase.
      execArgv: workerExecArgv,
      reporters: ['verbose'],
    },
  },
  // The unchanged upstream message tests publish through an IPFS upload/gateway service. Keep that transport
  // hermetic through SolidHat's wire-compatible in-memory service and reject unexpected network requests.
  { offline: true },
));
