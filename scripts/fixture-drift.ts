/**
 * Report (and optionally apply) drift between the checked-in generation fixtures and what the compiler now
 * emits. A codegen size change legitimately rewrites bytecode, function bodies and source maps in these
 * fixtures; this keeps that update mechanical instead of hand-transcribed.
 *
 *   npx tsx scripts/fixture-drift.ts                 # list drifted fields
 *   npx tsx scripts/fixture-drift.ts --apply         # rewrite the string-valued ones in place
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileFile } from '../packages/solidc/src/index.js';
import { fixtures } from '../packages/solidc/test/generation/fixtures.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.resolve(here, '../packages/solidc/test/valid-contract-files');
const FIXTURES = path.resolve(here, '../packages/solidc/test/generation/fixtures.ts');

const apply = process.argv.includes('--apply');
const replacements: [string, string][] = [];
const requirePatches: { fn: string; ips: number[] }[] = [];

for (const fixture of fixtures) {
  const artifact = compileFile(path.join(CORPUS, fixture.fn), {
    messageBus: false,
    ...fixture.compilerOptions,
  });
  const actual = JSON.parse(JSON.stringify(artifact));
  delete actual.invocationAnalysis;
  delete actual.compiler.options.messageBus;

  const drifted: string[] = [];
  const walk = (now: unknown, was: unknown, at: string): void => {
    if (at === 'updatedAt' || at === 'fingerprint') return;
    if (JSON.stringify(now) === JSON.stringify(was)) return;
    if (now && was && typeof now === 'object' && typeof was === 'object'
      && !Array.isArray(now) && !Array.isArray(was)) {
      for (const key of new Set([...Object.keys(now), ...Object.keys(was)])) {
        walk((now as never)[key], (was as never)[key], at ? `${at}.${key}` : key);
      }
      return;
    }
    drifted.push(at);
    if (typeof now === 'string' && typeof was === 'string') replacements.push([was, now]);
  };
  walk(actual, fixture.artifact, '');
  // `abi` differs only by in-memory `undefined` fields the test's JSON round-trip drops.
  const real = drifted.filter((key) => key !== 'abi');
  if (real.length === 0) continue;
  console.log(`\n### ${fixture.fn}`);
  for (const key of real) console.log(`  ${key}`);
  if (real.includes('debug.requires')) {
    requirePatches.push({ fn: fixture.fn, ips: actual.debug.requires.map((r: { ip: number }) => r.ip) });
  }
}

if (!apply) process.exit(0);
let source = fs.readFileSync(FIXTURES, 'utf-8');
let applied = 0;
for (const [was, now] of replacements) {
  if (was === now || source.split(was).length - 1 !== 1) continue;
  source = source.replace(was, now);
  applied += 1;
}

/**
 * Rewrite one fixture's `debug.requires` instruction pointers in declaration order. The block is the first
 * `requires` array after the fixture's `fn`, and the rewrite refuses unless its entry count matches, so a
 * layout change fails loudly rather than scrambling pointers.
 */
let patched = 0;
for (const { fn, ips } of requirePatches) {
  const lines = source.split('\n');
  const at = lines.findIndex((line) => line.includes(`fn: '${fn}'`));
  if (at < 0) throw new Error(`fixture ${fn} not found`);
  const open = lines.findIndex((line, index) => index > at && /^\s*'requires': \[$/.test(line));
  if (open < 0) throw new Error(`no requires block for ${fn}`);
  const indent = lines[open].match(/^(\s*)/)![1];
  const close = lines.findIndex((line, index) => index > open && line === `${indent}],`);
  if (close < 0) throw new Error(`unterminated requires block for ${fn}`);
  const ipLines = [];
  for (let i = open; i < close; i += 1) if (/^\s*'ip': \d+,$/.test(lines[i])) ipLines.push(i);
  if (ipLines.length !== ips.length) {
    throw new Error(`${fn}: block holds ${ipLines.length} pointers, compiler reports ${ips.length}`);
  }
  ipLines.forEach((line, index) => {
    lines[line] = lines[line].replace(/'ip': \d+,/, `'ip': ${ips[index]},`);
  });
  source = lines.join('\n');
  patched += 1;
}
fs.writeFileSync(FIXTURES, source);
console.log(`\napplied ${applied}/${replacements.length} string replacements, `
  + `${patched}/${requirePatches.length} requires blocks`);
