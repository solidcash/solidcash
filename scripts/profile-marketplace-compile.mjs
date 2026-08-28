#!/usr/bin/env node
/**
 * Cold-compile MarketplaceV1.sol with phase profiling.
 *
 *   SOLIDC_PROFILE=1 node --max-old-space-size=8192 scripts/profile-marketplace-compile.mjs
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { compileFileMulti } from 'solidc';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, '.marketplace/contracts/MarketplaceV1.sol');
const ownedOnly = process.argv.includes('--owned-only');
const warm = process.argv.includes('--warm');
const options = {
  solidityImportCompat: true,
  messageBus: true,
  messageBusGraphContext: true,
  ecrecover: 'p2pkh',
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
  maximumInputBytes: 10_000_000,
  commitmentLimit: 10_000_000,
  ...(ownedOnly ? { compileDeclarations: ['MarketplaceV1'] } : {}),
};

const compileOnce = (label) => {
  const started = Date.now();
  const map = compileFileMulti(source, options);
  const names = Object.entries(map).map(([name, artifact]) => ({
    name,
    bytecodeBytes: artifact.debug?.bytecode ? artifact.debug.bytecode.length / 2 : 0,
    functions: artifact.abi?.length ?? 0,
  }));
  console.error('[solidc-profile]', JSON.stringify({
    label: 'marketplace-file',
    pass: label,
    ms: Date.now() - started,
    ownedOnly,
    artifacts: names,
  }));
  return map;
};

compileOnce('cold');
if (warm) compileOnce('warm');
