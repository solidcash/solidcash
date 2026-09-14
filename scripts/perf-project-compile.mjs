#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Compile the marketplace project's roots in ONE process and report per-root and total time.
 *
 * `scripts/profile-marketplace-compile.mjs` measures one root in a fresh process, which is the right shape for
 * the scoreboard but hides the work a project compile repeats across roots: every root re-parses its whole
 * import graph. This probe keeps the process alive across roots, disables both artifact caches, and prints the
 * per-contract route/full bytecode hashes so an optimisation can be checked against the emitted bytecode.
 *
 *   node --max-old-space-size=8192 scripts/perf-project-compile.mjs [--roots MarketplaceV1.sol,MarketplaceV2.sol]
 */
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { compileFileMulti } from 'solidc';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allRoots = [
  'MarketplaceV1.sol', 'MarketplaceV2.sol', 'MarketplaceV3.sol', 'MarketplaceDataV1.sol',
  'EACCToken.sol', 'TreasurySplit.sol', 'unicrow/FakeToken.sol', 'unicrow/UnicrowDispute.sol',
  'unicrow/UnicrowArbitrator.sol', 'unicrow/UnicrowClaim.sol',
];
const rootsAt = process.argv.indexOf('--roots');
const roots = rootsAt < 0 ? allRoots : process.argv[rootsAt + 1].split(',');

delete process.env.SOLIDC_COMPILE_CACHE;
delete process.env.SOLIDC_COMPILE_CACHE_DIR;

const options = {
  solidityImportCompat: true,
  messageBus: true,
  messageBusKernel: true,
  messageBusGraphContext: true,
  ecrecover: 'p2pkh',
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
  maximumInputBytes: 10_000_000,
  commitmentLimit: 10_000_000,
  __artifactCache: false,
  __attemptFailureBox: { failures: [] },
  __strictNoInternalRecovery: true,
};
if (process.argv.includes('--no-cheap-admission')) options.__cheapAdmissionCodegen = false;

const sha256 = (value) => createHash('sha256').update(value ?? '').digest('hex').slice(0, 16);
const bodyBytes = (body) => (typeof body === 'string' ? body.length / 2 : 0);

// `--no-cheap-admission` measures the ladder's cost without its cheap search pass. It is NOT an optimisation:
// measured on the marketplace corpus it is slower in total (32.8 s vs 19.7 s) AND changes the emitted bytecode
// for most roots, because the ladder then retries rungs with full codegen and lands on a different winner.
const started = performance.now();
const rows = [];
for (const relative of roots) {
  const source = path.join(root, '.marketplace/contracts', relative);
  const contract = path.basename(relative).replace(/\.sol$/, '');
  const rootStarted = performance.now();
  let artifacts;
  try {
    artifacts = compileFileMulti(source, { ...options, compileDeclarations: [contract] });
  } catch (error) {
    rows.push({ root: relative, ms: performance.now() - rootStarted, error: String(error.message).slice(0, 200) });
    continue;
  }
  const artifact = artifacts[contract];
  rows.push({
    root: relative,
    ms: performance.now() - rootStarted,
    routeBytes: bodyBytes(artifact?.functionBodies?.[artifact?.messageBus?.selector ?? '']),
    fullBytes: bodyBytes(artifact?.debug?.bytecode),
    routeHash: sha256(artifact?.functionBodies?.[artifact?.messageBus?.selector ?? '']),
    fullHash: sha256(artifact?.debug?.bytecode),
  });
}

const totalMs = performance.now() - started;
console.log(`[project-compile] ${JSON.stringify({
  roots: rows.length,
  totalMs: Math.round(totalMs),
  perRoot: rows.map((row) => ({ ...row, ms: Math.round(row.ms) })),
})}`);
