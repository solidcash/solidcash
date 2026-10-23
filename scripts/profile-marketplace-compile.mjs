#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Perform one uncached maintained-corpus compile and print a machine-readable result.
 *
 * Each invocation accepts exactly one dispatch convention. Run this script in a
 * fresh process for every sample so module initialization and compiler caches
 * cannot leak between the legacy and kernel measurements.
 *
 *   node --max-old-space-size=8192 scripts/profile-marketplace-compile.mjs --legacy
 *   node --max-old-space-size=8192 scripts/profile-marketplace-compile.mjs --kernel
 */
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { compileFileMulti } from '@solidcash/solidc';
import { asmToBytecode } from '@solidcash/utils';

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
const compileAllDeclarations = process.argv.includes('--all-declarations');

// Both cache layers are opt-in environment features. Remove them as well as
// passing the explicit compiler option so this command remains cold when it is
// launched from a cache-enabled test or development shell.
delete process.env.SOLIDC_COMPILE_CACHE;
delete process.env.SOLIDC_COMPILE_CACHE_DIR;

const options = {
  evmCompat: true,
  messageBus: true,
  messageBusKernel: mode === 'kernel',
  messageBusGraphContext: true,
  ecrecover: 'p2pkh',
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
  maximumInputBytes: 10_000_000,
  commitmentLimit: 10_000_000,
  __artifactCache: false,
  __attemptFailureBox: { failures: [] },
  __strictNoInternalRecovery: true,
  ...(!compileAllDeclarations ? { compileDeclarations: [contractName] } : {}),
};

const compilerStarted = performance.now();
const artifacts = compileFileMulti(source, options);
const compilerMs = performance.now() - compilerStarted;
const artifact = artifacts[contractName];
if (!artifact) throw new Error(`${contractName} was not emitted while compiling ${source}`);
const redeemScriptBytes = asmToBytecode(artifact.bytecode).length;
const deployability = artifact.messageBus?.deployability;
if (!deployability || deployability.measuredBytecodeBytes !== redeemScriptBytes
  || deployability.withinP2shLimit !== (redeemScriptBytes <= deployability.p2shBytecodeLimit)
  || deployability.status !== (deployability.withinP2shLimit ? 'asserted' : 'over-budget')) {
  throw new Error(`${contractName}: compiler deployability certificate does not match emitted redeem-script bytes`);
}

const bodyBytes = (body) => typeof body === 'string' ? body.length / 2 : 0;
const routeSelector = artifact.messageBus?.selector;
const selectorBodies = Object.entries(artifact.functionBodies ?? {});
const sha256 = (value) => createHash('sha256').update(value ?? '').digest('hex');
const metadataProjection = {
  messageBus: artifact.messageBus,
  invocationAnalysis: artifact.invocationAnalysis,
  abi: artifact.abi.map((fn) => ({
    name: fn.name,
    selector: fn.selector,
    externalCalls: fn.externalCalls,
    resultConsumers: fn.resultConsumers,
    entryAccesses: fn.entryAccesses,
    sortedUpsertLoopInfo: fn.sortedUpsertLoopInfo,
  })),
};
const handlers = artifact.messageBus?.handlers ?? [];
const refusals = handlers.filter((handler) => !handler.eligible).map((handler) => ({
  name: handler.name,
  selector: handler.selector,
  code: handler.rejectionCode,
  reason: handler.rejectionReason ?? 'unspecified',
}));

const result = {
  mode,
  contract: contractName,
  source,
  declarations: compileAllDeclarations ? 'all' : contractName,
  convention: artifact.messageBus?.convention,
  deployability,
  sizes: {
    redeemScriptBytes,
    routeBytes: bodyBytes(routeSelector ? artifact.functionBodies?.[routeSelector] : undefined),
    directSelectorBodiesBytes: selectorBodies
      .filter(([selector]) => selector !== routeSelector)
      .reduce((total, [, body]) => total + bodyBytes(body), 0),
    fullBytes: bodyBytes(artifact.debug?.bytecode),
    functionBodiesBytes: selectorBodies.reduce((total, [, body]) => total + bodyBytes(body), 0),
    artifactJsonBytes: Buffer.byteLength(JSON.stringify(artifact)),
  },
  hashes: {
    route: sha256(artifact.functionBodies?.[artifact.messageBus?.selector ?? '']),
    full: sha256(artifact.debug?.bytecode),
    metadata: sha256(JSON.stringify(metadataProjection)),
  },
  timing: { compilerMs },
  caughtCompilerAttempts: options.__attemptFailureBox.failures,
  handlers: {
    total: handlers.length,
    eligible: handlers.length - refusals.length,
    refused: refusals.length,
    refusals,
  },
};

console.log(`[marketplace-compile] ${JSON.stringify(result)}`);
