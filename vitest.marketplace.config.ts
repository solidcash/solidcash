import { defineConfig, type Plugin } from 'vitest/config';
import { solidhatPreset } from '@solidcash/solidhat/vitest-preset';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cipher = (entry: string): string => require.resolve(`@noble/ciphers/${entry}.js`);
const worktreeRoot = fileURLToPath(new URL('.', import.meta.url));
const bchCompatSrc = fileURLToPath(new URL('examples/effectiveacceleration/src', import.meta.url));

/**
 * Relative imports skip Vite aliases; remap the Ethereum EA src onto the BCH-aware copy. The no-proxy twin's src is
 * the same source as the proxied project's, so a run retargeted onto it decodes with the same copy: both lanes
 * publish the same payload (a packed `uint160(address)` is the lock), and only the copy reads the lock back.
 */
export function redirectEffectiveAccelerationSrc(id: string): string | undefined {
  const normalized = id.replace(/\\/g, '/');
  const markers = [
    '/.marketplace/project/src/', '/effectiveacceleration.ai/contract/src/',
    '/effectiveacceleration.ai/contract-noproxy/src/',
  ];
  for (const marker of markers) {
    const index = normalized.indexOf(marker);
    if (index < 0) continue;
    return path.join(bchCompatSrc, normalized.slice(index + marker.length));
  }
  return undefined;
}

function existingSource(candidate: string): string | undefined {
  if (!candidate) return undefined;
  if (existsSync(candidate)) return candidate;
  if (existsSync(`${candidate}.ts`)) return `${candidate}.ts`;
  if (existsSync(`${candidate}.js`)) return `${candidate}.js`;
  if (existsSync(path.join(candidate, 'index.ts'))) return path.join(candidate, 'index.ts');
  return undefined;
}

function eaSrcRedirectPlugin(): Plugin {
  return {
    name: 'ea-bch-src-redirect',
    enforce: 'pre',
    resolveId(source, importer) {
      const direct = existingSource(redirectEffectiveAccelerationSrc(source) ?? '');
      if (direct) return direct;
      if (!source.startsWith('.') || !importer) return undefined;
      const resolved = path.resolve(path.dirname(importer), source);
      const redirected = redirectEffectiveAccelerationSrc(resolved);
      return redirected ? existingSource(redirected) : undefined;
    },
  };
}

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
    plugins: [eaSrcRedirectPlugin()],
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
      // The budget is the original 20 minutes. Measured 2026-10-06 at 8c4671242 under a concurrent load: the
      // slowest no-proxy title, `approve result and review sanity checks`, is 1148.58 s of test time (1155.62 s
      // file), and the pair with `refund sanity checks` is 1915.66 s. A single gate run on an unloaded box is
      // faster than that reading, so 20 minutes holds; raise this only with a new measurement.
      testTimeout: 1_200_000,
      hookTimeout: 1_200_000,
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
