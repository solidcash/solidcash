#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Run authoritative cold legacy and kernel Marketplace compiles in separate
 * processes, then report size, compiler-time, wall-time, and admission deltas.
 *
 *   node scripts/marketplace-scoreboard.mjs
 *   node scripts/marketplace-scoreboard.mjs --source /path/to/MarketplaceV1.sol
 */
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { cleanCompilerEnvironment } from './clean-compiler-env.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceAt = process.argv.indexOf('--source');
const sourceArgs = sourceAt < 0 ? [] : ['--source', process.argv[sourceAt + 1]];
if (sourceAt >= 0 && (!sourceArgs[1] || sourceArgs[1].startsWith('--'))) {
  console.error('--source requires a value');
  process.exit(2);
}
const declarationArgs = process.argv.includes('--all-declarations') ? ['--all-declarations'] : [];

const run = (mode) => {
  const coldEnv = cleanCompilerEnvironment();
  const started = performance.now();
  const child = spawnSync(process.execPath, [
    '--max-old-space-size=8192',
    path.join(root, 'scripts/profile-marketplace-compile.mjs'),
    `--${mode}`,
    ...sourceArgs,
    ...declarationArgs,
  ], {
    cwd: root,
    encoding: 'utf8',
    env: coldEnv,
    maxBuffer: 64 * 1024 * 1024,
  });
  const wallMs = performance.now() - started;
  const combined = `${child.stdout ?? ''}\n${child.stderr ?? ''}`;
  const resultLine = combined.split('\n').find((line) => line.startsWith('[marketplace-compile] '));
  let result;
  if (resultLine) {
    try { result = JSON.parse(resultLine.slice('[marketplace-compile] '.length)); } catch { /* reported below */ }
  }
  if (child.status !== 0 || !result) {
    return {
      mode,
      exitCode: child.status,
      wallMs,
      error: combined.slice(-4000),
    };
  }
  return { ...result, exitCode: child.status, timing: { ...result.timing, wallMs } };
};

const legacy = run('legacy');
const kernel = run('kernel');

const delta = (before, after) => ({
  absolute: after - before,
  percent: before === 0 ? null : ((after - before) / before) * 100,
});

const deltas = legacy.exitCode === 0 && kernel.exitCode === 0 ? {
  routeBytes: delta(legacy.sizes.routeBytes, kernel.sizes.routeBytes),
  fullBytes: delta(legacy.sizes.fullBytes, kernel.sizes.fullBytes),
  functionBodiesBytes: delta(legacy.sizes.functionBodiesBytes, kernel.sizes.functionBodiesBytes),
  artifactJsonBytes: delta(legacy.sizes.artifactJsonBytes, kernel.sizes.artifactJsonBytes),
  compilerMs: delta(legacy.timing.compilerMs, kernel.timing.compilerMs),
  wallMs: delta(legacy.timing.wallMs, kernel.timing.wallMs),
  eligibleHandlers: delta(legacy.handlers.eligible, kernel.handlers.eligible),
  refusedHandlers: delta(legacy.handlers.refused, kernel.handlers.refused),
} : undefined;

console.log(JSON.stringify({
  cold: true,
  processIsolation: 'one-process-per-mode',
  runs: { legacy, kernel },
  deltas,
}, null, 2));

if (legacy.exitCode !== 0 || kernel.exitCode !== 0) process.exit(1);
