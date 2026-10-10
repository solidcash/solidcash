// Bench harness: compile every solidity-by-example src contract with solidc + evmCompat.
// Records pass/fail + first blocker per contract. BCH specifics are NOT considered; this measures how
// far solidc gets parsing/checking real Solidity. Usage: node _bench/run.mjs
import { compileFile } from '../../../packages/solidc/dist/compileFile.js';
import { existsSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
// The solidity-by-example corpus lives OUTSIDE this repo (see ../SBE_SOURCE.md): a sibling of the repo root,
// which is a different number of levels away from the main checkout than from a worktree. Walk up to find it
// by shape instead of counting directories; override with SBE_ROOT.
const findCorpus = () => {
  for (let dir = here; ;) {
    const candidate = join(dir, 'solidity-by-example');
    if (existsSync(join(candidate, 'contracts', 'src'))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return candidate;
    dir = parent;
  }
};
const SBE_ROOT = process.env.SBE_ROOT || findCorpus();
const SRC = join(SBE_ROOT, 'contracts', 'src');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.sol')) out.push(p);
  }
  return out;
}

const files = walk(SRC).sort();
const results = [];
for (const f of files) {
  const rel = relative(SRC, f);
  try {
    // This bench measures language/source conformance on UNMODIFIED upstream Solidity, so the compiler's
    // covenant-safety policy is stated explicitly: the final-require rule guards a CashScript spending path
    // and is exercised by the solidc suite and the application benches, not by a conformance sweep.
    compileFile(f, { evmCompat: true, enforceFinalRequire: false });
    results.push({ file: rel, ok: true });
  } catch (e) {
    const name = e?.constructor?.name ?? 'Error';
    const msg = (e?.message ?? String(e)).split('\n')[0].slice(0, 240);
    results.push({ file: rel, ok: false, error: name, message: msg });
  }
}

const ok = results.filter((r) => r.ok);
const fail = results.filter((r) => !r.ok);

// Bucket failures by error class.
const byClass = {};
for (const r of fail) byClass[r.error] = (byClass[r.error] ?? 0) + 1;

writeFileSync(join(here, 'results.json'), JSON.stringify(results, null, 2));

console.log(`TOTAL ${results.length}  PASS ${ok.length}  FAIL ${fail.length}`);
console.log('\n=== failures by error class ===');
for (const [k, v] of Object.entries(byClass).sort((a, b) => b[1] - a[1])) {
  console.log(`${String(v).padStart(4)}  ${k}`);
}
