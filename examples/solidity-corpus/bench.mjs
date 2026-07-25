import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const BENCH_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(BENCH_DIR, '..', '..');
const { compileFile } = await import(join(REPO_ROOT, 'packages/solidc/dist/index.js'));

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
  // True negatives (solc rejects them via the `// ----` Error trailer) are deliberately-uncompilable test
  // fixtures, not real contracts, so they are SKIPPED (never scored). Whether SolidCash also happens to accept
  // one is kept only as an over-permissiveness diagnostic (`overAccepted`), not counted against the score.
  if (cls === 'NEGATIVE') { results.push({ rel, status: 'NEGATIVE', overAccepted: !tryCompile(f) }); i++; continue; }
  writeFileSync(join(BENCH_DIR, 'current.txt'), rel); // culprit marker if it crashes/hangs
  const err = tryCompile(f);
  results.push({ rel, status: err ? 'FAIL' : 'OK', err });
  if (++i % 500 === 0) process.stderr.write(`  ...${i}/${files.length}\n`);
}

const by = (s) => results.filter(r => r.status === s);
const ok = by('OK'), fail = by('FAIL'), neg = by('NEGATIVE'), multi = by('MULTIFILE');
const overAcc = neg.filter(r => r.overAccepted).length; // solc-negative fixtures we also accept (diagnostic only)
const inScope = ok.length + fail.length;
writeFileSync(join(BENCH_DIR, 'results.json'), JSON.stringify(results, null, 1));

origLog(`\n=== SOLC-CORPUS SCORECARD: ${ok.length}/${inScope} single-file in-scope compiled `
  + `(${fail.length} failed) | ${neg.length} negative-skipped (solc rejects; ${overAcc} of them we also accept, `
  + `diagnostic) | ${multi.length} multifile-skipped | ${results.length} total ===\n`);

// Top failure reasons (grouped by error head) - the actionable gap signal.
const groups = {};
for (const r of fail) { const head = (r.err || '').replace(/'[^']*'/g, "'..'").replace(/\d+/g, 'N').slice(0, 90); groups[head] = (groups[head] || 0) + 1; }
origLog('--- TOP FAILURE REASONS ---');
for (const [head, n] of Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 30)) origLog(`${String(n).padStart(5)}  ${head}`);
