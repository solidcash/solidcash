#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sequential cross-checkout marketplace compile benchmark.
 *
 * Runs one checkout at a time so CPU contention cannot skew the comparison, and
 * reports median/p10/p90 compiler time plus the emitted route/full bytecode sizes
 * so a speed change can always be checked against a behavior change.
 *
 *   node scripts/perf-matrix-marketplace.mjs [--samples 3] [--mode legacy]
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argValue = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at < 0 ? fallback : process.argv[at + 1];
};

const samples = Number(argValue('--samples', '3'));
const mode = argValue('--mode', 'legacy');

const checkouts = [
  ['baseline-pre-perf', '0b723a6bf', '/Code/cashscript/.worktrees/kernel-perf-baseline'],
  ['perf-tip', '24af483ee', '/Code/cashscript/.worktrees/kernel-perf-tip'],
  ['head', '2955c6e9a', '/Code/cashscript/.worktrees/kernel-perf-investigation'],
];

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const rows = [];
for (const [label, commit, cwd] of checkouts) {
  const times = [];
  let last;
  for (let i = 0; i < samples; i += 1) {
    const child = spawnSync(process.execPath, [
      '--max-old-space-size=8192',
      path.join(cwd, 'scripts/perf-probe-marketplace.mjs'),
      `--${mode}`,
    ], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

    const line = `${child.stdout ?? ''}`.split('\n').find((l) => l.startsWith('[perf-probe] '));
    if (child.status !== 0 || !line) {
      console.error(`${label} sample ${i + 1} failed:\n${(child.stdout ?? '')}\n${(child.stderr ?? '').slice(-2000)}`);
      break;
    }
    last = JSON.parse(line.slice('[perf-probe] '.length));
    times.push(last.timing.compilerMs);
  }
  if (!times.length) continue;
  rows.push({ label, commit, mode, samples: times.length, medianMs: median(times), times, result: last });
}

const first = rows[0];
console.log(`\n=== marketplace ${mode} compile matrix (${samples} samples each, sequential) ===\n`);
console.log('checkout                commit      median(ms)   samples(ms)                     route    full     handlers');
for (const row of rows) {
  const speedup = row === first ? '  (base)' : `  ${(first.medianMs / row.medianMs).toFixed(2)}x`;
  console.log(
    `${row.label.padEnd(23)} ${row.commit.padEnd(11)} ${String(Math.round(row.medianMs)).padStart(8)}   `
    + `${row.times.map((t) => Math.round(t)).join('/').padEnd(30)} `
    + `${String(row.result.sizes.routeBytes).padStart(7)}  ${String(row.result.sizes.fullBytes).padStart(7)}  `
    + `${row.result.handlers.eligible}/${row.result.handlers.total}${speedup}`,
  );
}

console.log('\n=== output identity check ===');
for (const row of rows) {
  console.log(`${row.label.padEnd(23)} convention=${row.result.convention ?? '(none)'} `
    + `route=${row.result.hashes.route.slice(0, 16)} full=${row.result.hashes.full.slice(0, 16)}`);
}
