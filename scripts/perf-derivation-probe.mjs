#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Measure SDK transaction-derivation cost on a real contract test.
 *
 * Transaction derivation is the SDK's auto-derivation of state/covenant geometry while
 * building a transaction. The builder logs one `builder-derive-pass` record per full
 * derivation pass, so the pass count is the primary signal: the optimisation line that
 * removed redundant discovery passes should collapse two passes into one.
 *
 *   node scripts/perf-derivation-probe.mjs --cwd <checkout> [--test <path>] [--name <filter>]
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const selfRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argValue = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at < 0 ? fallback : process.argv[at + 1];
};

const cwd = path.resolve(argValue('--cwd', selfRoot));
const testFile = argValue('--test', 'test/e2e/MappingEntryMutation.test.ts');
const nameFilter = argValue('--name');

const args = ['workspace', 'solidcash', 'vitest', 'run', testFile];
if (nameFilter) args.push('-t', nameFilter);

const started = Date.now();
const child = spawnSync('yarn', args, {
  cwd,
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
  env: { ...process.env, SOLIDC_DEBUG_BUILDER_TIMING: '1' },
});
const wallMs = Date.now() - started;
const output = `${child.stdout ?? ''}\n${child.stderr ?? ''}`;

// Structured console.error payloads arrive as `builder-derive-pass { functionName: 'x', pass: 2, ms: 12 }`.
const records = [];
for (const match of output.matchAll(/builder-derive-pass\s+(\{[^\n]*\})/g)) {
  try {
    records.push(JSON.parse(match[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"')));
  } catch { /* non-JSON log line: ignore */ }
}

const passCounts = new Map();
for (const record of records) {
  const key = record.functionName ?? '(unnamed)';
  passCounts.set(key, (passCounts.get(key) ?? 0) + 1);
}
const derivationMs = records.reduce((total, record) => total + (Number(record.ms) || 0), 0);

const vitest = output.match(/Duration\s+([0-9.]+)s/);
const tests = output.match(/Tests\s+(.*)/);

console.log(JSON.stringify({
  cwd,
  testFile,
  nameFilter: nameFilter ?? null,
  exitCode: child.status,
  wallMs,
  vitestDurationS: vitest ? Number(vitest[1]) : null,
  testsLine: tests ? tests[1].trim() : null,
  derivation: {
    totalPasses: records.length,
    derivationMs,
    passesByFunction: Object.fromEntries([...passCounts].map(([k, v]) => [k, v])),
  },
}, null, 2));
