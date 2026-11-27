#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Compile the marketplace project's roots in ONE process and report per-root and total time.
 *
 * A project compile repeats work across roots: every root re-parses its whole import graph. This probe keeps the
 * process alive across roots, disables both artifact caches, and prints the per-contract bytecode hashes so an
 * optimisation can be checked against the emitted bytecode. It compiles framed, as the project configures it.
 *
 *   node --max-old-space-size=8192 scripts/perf-project-compile.mjs [--roots MarketplaceV1.sol,MarketplaceV2.sol]
 */
import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { compileFileMulti } from '@solidcash/solidc';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allRoots = [
  'MarketplaceV1.sol', 'MarketplaceV2.sol', 'MarketplaceV3.sol', 'MarketplaceDataV1.sol',
  'EACCToken.sol', 'TreasurySplit.sol', 'unicrow/FakeToken.sol', 'unicrow/UnicrowDispute.sol',
  'unicrow/UnicrowArbitrator.sol', 'unicrow/UnicrowClaim.sol',
];
const rootsAt = process.argv.indexOf('--roots');
let roots = rootsAt < 0 ? allRoots : process.argv[rootsAt + 1].split(',');
if (process.argv.includes('--smallest-first')) {
  roots = [...roots].sort((left, right) =>
    statSync(path.join(root, '.marketplace/contracts', left)).size
    - statSync(path.join(root, '.marketplace/contracts', right)).size);
  console.error(`[order] ${roots.join(' ')}`);
}

delete process.env.SOLIDC_COMPILE_CACHE;
delete process.env.SOLIDC_COMPILE_CACHE_DIR;

const options = {
  evmCompat: true,
  ecrecover: 'p2pkh',
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
  tagSingletonDataNfts: true,
  composition: 'framed',
  maximumInputBytes: 10_000_000,
  commitmentLimit: 10_000_000,
  __artifactCache: false,
  __strictNoInternalRecovery: true,
};

const sha256 = (value) => createHash('sha256').update(value ?? '').digest('hex').slice(0, 16);
const bodyBytes = (body) => (typeof body === 'string' ? body.length / 2 : 0);

// `--smallest-first` tests compile ordering (JIT warm-up on cheap roots first). The effect did NOT reproduce:
// big-first 22,420/22,189 ms vs alphabetical 21,290/22,857 ms over two repetitions each, i.e. the earlier
// single-run spread (19.7 s vs 26.2 s) was machine noise, not ordering.
const started = performance.now();
const startedCpu = process.cpuUsage();
const rows = [];
for (const relative of roots) {
  const source = path.join(root, '.marketplace/contracts', relative);
  const contract = path.basename(relative).replace(/\.sol$/, '');
  const rootStarted = performance.now();
  const rootCpuStarted = process.cpuUsage();
  const cpuMs = () => {
    const delta = process.cpuUsage(rootCpuStarted);
    return (delta.user + delta.system) / 1000;
  };
  let artifacts;
  try {
    artifacts = compileFileMulti(source, { ...options, compileDeclarations: [contract] });
  } catch (error) {
    rows.push({
      root: relative, ms: performance.now() - rootStarted, cpuMs: cpuMs(),
      error: String(error.message).slice(0, 200),
    });
    continue;
  }
  const artifact = artifacts[contract];
  rows.push({
    root: relative,
    ms: performance.now() - rootStarted,
    cpuMs: cpuMs(),
    fullBytes: bodyBytes(artifact?.debug?.bytecode),
    fullHash: sha256(artifact?.debug?.bytecode),
  });
}

const totalMs = performance.now() - started;
const totalCpu = process.cpuUsage(startedCpu);
console.log(`[project-compile] ${JSON.stringify({
  roots: rows.length,
  totalMs: Math.round(totalMs),
  // CPU time is the load-independent half of the measurement: the machine is shared, so wall-clock deltas
  // between two runs minutes apart routinely exceed the effect being measured. User+system time per root still
  // tracks the work the compiler actually did.
  totalCpuMs: Math.round((totalCpu.user + totalCpu.system) / 1000),
  perRoot: rows.map((row) => ({ ...row, ms: Math.round(row.ms), cpuMs: Math.round(row.cpuMs) })),
})}`);
