#!/usr/bin/env node
/**
 * Marketplace compile scoreboard: phase ms + bytecode.
 *
 *   SOLIDC_PROFILE=1 SOLIDC_DEBUG_OUTLINE_TIMING=1 \
 *     node --max-old-space-size=8192 scripts/marketplace-scoreboard.mjs [--owned-only] [--warm]
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ownedOnly = process.argv.includes('--owned-only');
const warm = process.argv.includes('--warm');
const rounds = warm ? 2 : 1;

const sumByLabel = (rows) => {
  const totals = {};
  for (const row of rows) {
    const key = row.label ?? 'unknown';
    totals[key] = (totals[key] ?? 0) + (row.ms ?? 0);
  }
  return totals;
};

const runOnce = (label) => {
  const started = Date.now();
  const result = spawnSync(
    process.execPath,
    ['--max-old-space-size=8192', path.join(root, 'scripts/profile-marketplace-compile.mjs'),
      ...(ownedOnly ? ['--owned-only'] : [])],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        SOLIDC_PROFILE: '1',
        SOLIDC_DEBUG_OUTLINE_TIMING: '1',
      },
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  const wallMs = Date.now() - started;
  const stderr = `${result.stderr ?? ''}${result.stdout ?? ''}`;
  const profile = [];
  const outlineAttempts = [];
  for (const line of stderr.split('\n')) {
    const profileMatch = line.match(/^\[solidc-profile\]\s+(\{.*\})$/);
    if (profileMatch) {
      try { profile.push(JSON.parse(profileMatch[1])); } catch { /* ignore truncated */ }
      continue;
    }
    const outlineMatch = line.match(/^\[outline-timing\]\s+(\{.*\})$/);
    if (outlineMatch) {
      try { outlineAttempts.push(JSON.parse(outlineMatch[1])); } catch { /* ignore truncated */ }
      continue;
    }
    const roundMatch = line.match(/^\[outline-round\]\s+(\{.*\})$/);
    if (roundMatch) {
      try { outlineAttempts.push({ kind: 'round', ...JSON.parse(roundMatch[1]) }); } catch { /* ignore truncated */ }
    }
  }
  const fileRow = [...profile].reverse().find((row) => row.label === 'marketplace-file');
  const resolved = profile.filter((row) => row.label === 'resolved');
  const parseRoutes = profile.filter((row) => row.label === 'messageBus:parseRoute');
  const synthesize = profile.filter((row) => row.label === 'messageBus:synthesize');
  const outlines = profile.filter((row) => row.label === 'outline');
  return {
    label,
    exitCode: result.status,
    wallMs,
    artifacts: fileRow?.artifacts ?? [],
    marketplaceBytes: (fileRow?.artifacts ?? []).find((a) => a.name === 'MarketplaceV1')?.bytecodeBytes,
    totals: sumByLabel(profile),
    resolved,
    parseRoutes,
    synthesize,
    outlines,
    outlineAttempts: outlineAttempts.map((row) => ({
      window: row.minimumWindowElements,
      bodyOrder: row.bodyOrder,
      bodies: row.bodies,
      savedBytes: row.savedBytes,
      elapsedMs: row.elapsedMs,
    })),
    error: result.status === 0 ? undefined : (result.stderr ?? result.stdout ?? '').slice(-2000),
  };
};

const runs = [];
for (let i = 0; i < rounds; i += 1) {
  runs.push(runOnce(i === 0 ? 'cold' : 'warm'));
}

const scoreboard = {
  ownedOnly,
  warm,
  runs,
};
console.log(JSON.stringify(scoreboard, null, 2));
if (runs.some((run) => run.exitCode !== 0)) process.exit(1);
