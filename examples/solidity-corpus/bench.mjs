import { compileFile } from '/Code/cashscript/packages/solidc/dist/index.js';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

// Parallel bench to solidity-by-example: attempt to compile every .sol in the ethereum/solidity compiler test
// corpus (../solidity). Reuses the SBE tooling shape (compileFile + solidityImportCompat + OK/FAIL scorecard),
// adding solc-test-format bucketing so the denominator is meaningful:
//   NEGATIVE  - the `// ----` trailer declares a compile Error; solc rejects it too, so SolidCash rejecting is
//               parity (excluded). If SolidCash ACCEPTS one, that is over-permissive -> NEG_ACCEPTED (a signal).
//   MULTIFILE - `==== Source:` harness delimiter; not a single compilable file (excluded).
// Denominator = OK + FAIL (files that should compile as a single unit).
const ROOT = process.env.SOLC_CORPUS || '/Code/solidity';
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
const files = execSync(`find ${ROOT} -name '*.sol'`).toString().trim().split('\n').filter(Boolean).sort();

function classify(src) {
  if (src.includes('==== Source:') || src.includes('==== ExternalSource:')) return 'MULTIFILE';
  const idx = src.search(/\n\/\/ ----/);
  if (idx >= 0 && /^\/\/ \w*Error \d+:/m.test(src.slice(idx))) return 'NEGATIVE';
  return 'INSCOPE';
}

const origLog = console.log, origErr = console.error, origWarn = console.warn, origInfo = console.info;
const noop = () => {};
const mute = () => { console.log = console.error = console.warn = console.info = noop; };
const unmute = () => { console.log = origLog; console.error = origErr; console.warn = origWarn; console.info = origInfo; };
const tryCompile = (f) => { mute(); try { compileFile(f, { solidityImportCompat: true }); unmute(); return null; }
  catch (e) { unmute(); return (e.name || 'Error') + ': ' + String(e.message).split('\n')[0]; } };

const results = [];
let i = 0;
for (const f of files) {
  if (i >= LIMIT) break;
  const rel = f.replace(ROOT + '/', '');
  let src; try { src = readFileSync(f, 'utf8'); } catch { results.push({ rel, status: 'READERR' }); continue; }
  const cls = classify(src);
  if (cls === 'MULTIFILE') { results.push({ rel, status: 'MULTIFILE' }); i++; continue; }
  if (cls === 'NEGATIVE') { results.push({ rel, status: tryCompile(f) ? 'NEGATIVE' : 'NEG_ACCEPTED' }); i++; continue; }
  const err = tryCompile(f);
  results.push({ rel, status: err ? 'FAIL' : 'OK', err });
  if (++i % 500 === 0) process.stderr.write(`  ...${i}/${files.length}\n`);
}

const by = (s) => results.filter(r => r.status === s);
const ok = by('OK'), fail = by('FAIL'), neg = by('NEGATIVE'), negAcc = by('NEG_ACCEPTED'), multi = by('MULTIFILE');
const inScope = ok.length + fail.length;
writeFileSync('/Code/cashscript/examples/solidity-corpus/results.json', JSON.stringify(results, null, 1));

console.log(`\n=== SOLC-CORPUS SCORECARD: ${ok.length}/${inScope} single-file in-scope compiled `
  + `(${fail.length} failed) | ${neg.length} negative (correctly rejected) | ${negAcc.length} NEG-ACCEPTED `
  + `(solc rejects, we compiled) | ${multi.length} multifile-skipped | ${results.length} total ===\n`);

// Top failure reasons (grouped by error head) - the actionable gap signal.
const groups = {};
for (const r of fail) { const head = (r.err || '').replace(/'[^']*'/g, "'..'").replace(/\d+/g, 'N').slice(0, 90); groups[head] = (groups[head] || 0) + 1; }
console.log('--- TOP FAILURE REASONS ---');
for (const [head, n] of Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`${String(n).padStart(5)}  ${head}`);
