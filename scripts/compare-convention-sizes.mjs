#!/usr/bin/env node
/**
 * Compare compiled artifacts from two conventions.
 *
 *   node scripts/compare-convention-sizes.mjs \
 *     --left <artifact-dir> --left-name kernel \
 *     --right <artifact-dir> --right-name per-call
 *
 * Each directory is a flat or nested folder of `*.json` artifacts (TypeScript
 * artifact modules are ignored). Contracts are paired by `contractName`.
 *
 * Bytes are the real script (`asmToBytecode`), not the ASM character count.
 * The 10,000-byte column is the BCH per-input script limit. A per-call master
 * redeem script larger than that cannot be spent under standardness; mocknet
 * relaxes the limit. Deployment UTXOs use the shipped defaults: a per-call
 * deploy funds `dataNftCount` state records plus the default pool (12 masters
 * and 4 validators, `DEFAULT_MASTER_POOL_SIZE`); a direct deploy funds
 * `dataNftCount` state records plus one master. A per-call call spends one
 * master per entry into that contract. Records touched by the call are not in
 * the artifact; the column is the state-record upper bound.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const utilsScript = pathToFileURL(path.join(here, '../packages/utils/dist/script.js')).href;
const { asmToBytecode } = await import(utilsScript);

const INPUT_LIMIT = 10_000;
const PER_CALL_MASTERS = 12;
const PER_CALL_VALIDATORS = 4;

function arg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || process.argv[index + 1] === undefined) {
    console.error(`missing ${name}`);
    process.exit(2);
  }
  return process.argv[index + 1];
}

function walkJson(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkJson(full, out);
    else if (name.endsWith('.json')) out.push(full);
  }
  return out;
}

function hexBytes(hex) {
  if (typeof hex !== 'string' || hex.length === 0 || hex.length % 2 !== 0) return 0;
  return hex.length / 2;
}

function loadArtifact(file) {
  const artifact = JSON.parse(readFileSync(file, 'utf8'));
  if (typeof artifact.bytecode !== 'string' || typeof artifact.contractName !== 'string') return undefined;
  return artifact;
}

function measure(artifact) {
  const script = asmToBytecode(artifact.bytecode);
  const bodies = artifact.functionBodies ?? {};
  const bodyBytes = Object.values(bodies).map((hex) => hexBytes(hex));
  const refused = artifact.composition?.refusedEntries ?? artifact.refusedFunctions ?? [];
  const perCall = artifact.composition?.convention === 'per-call';
  const stateRecords = artifact.stateLayout?.dataNftCount ?? 0;
  const deploymentUtxos = perCall
    ? stateRecords + PER_CALL_MASTERS + PER_CALL_VALIDATORS
    : stateRecords + 1;
  return {
    contractName: artifact.contractName,
    convention: perCall ? 'per-call' : 'direct',
    bytecodeBytes: script.length,
    bytecodeChars: artifact.bytecode.length,
    functionBodyBytes: bodyBytes.reduce((sum, n) => sum + n, 0),
    functionBodyCount: bodyBytes.length,
    largestFunctionBody: bodyBytes.reduce((max, n) => Math.max(max, n), 0),
    overInputLimit: script.length > INPUT_LIMIT,
    stateRecords,
    deploymentUtxos,
    callMasters: perCall ? 1 : 0,
    callStateRecordBound: stateRecords,
    refusedCount: refused.length,
    refused: refused.map((entry) => `${entry.functionName}: ${entry.reason}`),
  };
}

function indexDir(dir) {
  const map = new Map();
  for (const file of walkJson(dir)) {
    const artifact = loadArtifact(file);
    if (artifact === undefined) continue;
    map.set(artifact.contractName, measure(artifact));
    if (artifact.delegateArtifact !== undefined) {
      const delegate = measure(artifact.delegateArtifact);
      delegate.contractName = `${artifact.contractName}#delegate`;
      map.set(delegate.contractName, delegate);
    }
  }
  return map;
}

const leftDir = arg('--left');
const rightDir = arg('--right');
const leftName = arg('--left-name');
const rightName = arg('--right-name');
const left = indexDir(leftDir);
const right = indexDir(rightDir);
const names = [...new Set([...left.keys(), ...right.keys()])].sort();

const header = [
  'contract',
  `${leftName}Convention`, `${leftName}Bytecode`, `${leftName}Bodies`, `${leftName}LargestBody`,
  `${leftName}DeployUtxos`, `${leftName}Over10k`, `${leftName}Refused`,
  `${rightName}Convention`, `${rightName}Bytecode`, `${rightName}Bodies`, `${rightName}LargestBody`,
  `${rightName}DeployUtxos`, `${rightName}Over10k`, `${rightName}Refused`,
  'bytecodeDelta',
];
console.log(header.join('\t'));

function cell(row, key) {
  return row === undefined ? '' : String(row[key]);
}

for (const name of names) {
  const a = left.get(name);
  const b = right.get(name);
  const delta = a !== undefined && b !== undefined ? String(b.bytecodeBytes - a.bytecodeBytes) : '';
  console.log([
    name,
    cell(a, 'convention'), cell(a, 'bytecodeBytes'), cell(a, 'functionBodyBytes'), cell(a, 'largestFunctionBody'),
    cell(a, 'deploymentUtxos'), cell(a, 'overInputLimit'), cell(a, 'refusedCount'),
    cell(b, 'convention'), cell(b, 'bytecodeBytes'), cell(b, 'functionBodyBytes'), cell(b, 'largestFunctionBody'),
    cell(b, 'deploymentUtxos'), cell(b, 'overInputLimit'), cell(b, 'refusedCount'),
    delta,
  ].join('\t'));
  for (const side of [a, b]) {
    if (side !== undefined && side.refused.length > 0) {
      console.log(`# refused ${side.contractName} ${side.convention}: ${side.refused.join(' | ')}`);
    }
  }
}

console.log(`# input limit ${INPUT_LIMIT}`);
console.log(`# per-call deployment = dataNftCount + ${PER_CALL_MASTERS} masters + ${PER_CALL_VALIDATORS} validators`);
console.log('# direct deployment = dataNftCount + 1 master');
console.log('# per-call call masters = 1 per entry; callStateRecordBound = dataNftCount');
