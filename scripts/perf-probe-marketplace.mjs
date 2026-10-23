#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Cross-commit marketplace compile probe.
 *
 * The maintained profiler (scripts/profile-marketplace-compile.mjs) only exists on newer
 * commits. This probe keeps a stable option surface so the same command measures a
 * pre-optimisation checkout and a post-optimisation checkout.
 *
 * Kernel-specific options are only added for --kernel, because older checkouts predate
 * the kernel admission ladder and must still be measurable in legacy mode.
 *
 *   node --max-old-space-size=8192 scripts/perf-probe-marketplace.mjs --legacy
 *   node --max-old-space-size=8192 scripts/perf-probe-marketplace.mjs --kernel
 */
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { compileFileMulti } from '@solidcash/solidc';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hasLegacy = process.argv.includes('--legacy');
const hasKernel = process.argv.includes('--kernel');
if (hasLegacy === hasKernel) {
  console.error('Specify exactly one of --legacy or --kernel.');
  process.exit(2);
}

const optionValue = (name) => {
  const at = process.argv.indexOf(name);
  if (at < 0) return undefined;
  const value = process.argv[at + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
};

const mode = hasKernel ? 'kernel' : 'legacy';
const source = path.resolve(optionValue('--source')
  ?? path.join(root, '.marketplace/contracts/MarketplaceV1.sol'));
const contractName = optionValue('--contract') ?? 'MarketplaceV1';

delete process.env.SOLIDC_COMPILE_CACHE;
delete process.env.SOLIDC_COMPILE_CACHE_DIR;

const options = {
  evmCompat: true,
  messageBus: true,
  ecrecover: 'p2pkh',
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
  maximumInputBytes: 10_000_000,
  commitmentLimit: 10_000_000,
  __artifactCache: false,
  __attemptFailureBox: { failures: [] },
  __strictNoInternalRecovery: true,
  compileDeclarations: [contractName],
  // Match the maintained profiler's option surface exactly: graph context stays on in both
  // modes, and only messageBusKernel selects the dispatch convention.
  messageBusGraphContext: true,
  // The compiler default for messageBusKernel is true on newer commits, so legacy mode must
  // opt out explicitly or the two modes collapse onto the same kernel row-loop codegen.
  messageBusKernel: hasKernel,
};

// Warm the module graph so the measurement covers compile work, not first-import cost.
const compilerStarted = performance.now();
const artifacts = compileFileMulti(source, options);
const compilerMs = performance.now() - compilerStarted;

const artifact = artifacts[contractName];
if (!artifact) throw new Error(`${contractName} was not emitted while compiling ${source}`);

const bodyBytes = (body) => typeof body === 'string' ? body.length / 2 : 0;
const sha256 = (value) => createHash('sha256').update(value ?? '').digest('hex');
const handlers = artifact.messageBus?.handlers ?? [];

const result = {
  mode,
  contract: contractName,
  convention: artifact.messageBus?.convention,
  sizes: {
    routeBytes: bodyBytes(artifact.functionBodies?.[artifact.messageBus?.selector ?? '']),
    fullBytes: bodyBytes(artifact.debug?.bytecode),
    artifactJsonBytes: Buffer.byteLength(JSON.stringify(artifact)),
  },
  hashes: {
    route: sha256(artifact.functionBodies?.[artifact.messageBus?.selector ?? '']),
    full: sha256(artifact.debug?.bytecode),
  },
  timing: { compilerMs },
  caughtCompilerAttempts: options.__attemptFailureBox.failures.length,
  handlers: { total: handlers.length, eligible: handlers.filter((h) => h.eligible).length },
};

console.log(`[perf-probe] ${JSON.stringify(result)}`);
