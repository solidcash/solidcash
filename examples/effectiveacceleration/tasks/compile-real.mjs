// Cross-compile the REAL EffectiveAcceleration Solidity source verbatim (no source edits) to BCH artifacts,
// via the same solidc path @solidcash/testing's `compile` task uses for .sol. Points at the real Hardhat project
// so OZ / interface imports resolve from ITS node_modules. Writes name-resolvable <Name>.json (what
// getContractFactory resolves) into artifacts-real/, kept separate from the stub-backed artifacts/ so the
// marketplace.test.ts drop-in keeps running while we prove real cross-compilation.
//
// Status: 17/22 files -> 22 real contract artifacts. The 5 fails (EACCToken, MarketplaceV1/V2/V3, MarketplaceDataV1)
// are the deep C2 mapping-loop walls (whitelistWorkers nested write + extcall in a loop; _balances multitransfer
// RMW-loop) - compiler codegen gaps, not harness gaps. ecrecover cross-compiles via ecrecover: 'p2pkh'.
//
// Run:  node tasks/compile-real.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileFileMulti } from 'solidc';
import { formatArtifact } from '@solidcash/utils';

const here = path.dirname(fileURLToPath(import.meta.url));
function findSiblingProject(start) {
  let current = start;
  while (true) {
    const candidate = path.join(current, 'effectiveacceleration.ai', 'contract', 'contracts');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}
const contractsDir = process.env.EACC_CONTRACTS_DIR
  ? path.resolve(process.env.EACC_CONTRACTS_DIR)
  : findSiblingProject(here);
const artifactsDir = path.resolve(here, '../artifacts-real/solidcash');
const solc = { solidityImportCompat: true, ecrecover: 'p2pkh' };

function findSolSources(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('@')) continue;
      findSolSources(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith('.sol')) out.push(path.join(dir, entry.name));
  }
  return out;
}

if (!contractsDir || !fs.existsSync(contractsDir)) {
  throw new Error('Real EA source not found; set EACC_CONTRACTS_DIR to its contract/contracts directory.');
}
fs.rmSync(artifactsDir, { recursive: true, force: true });
fs.mkdirSync(artifactsDir, { recursive: true });

const written = new Set();
let ok = 0;
let contracts = 0;
const failures = [];
for (const full of findSolSources(contractsDir)) {
  const rel = path.relative(contractsDir, full);
  try {
    const map = compileFileMulti(full, { solidityImportCompat: true, ...solc });
    const fresh = [];
    for (const [name, artifact] of Object.entries(map)) {
      if (written.has(name)) continue;
      written.add(name);
      fs.writeFileSync(path.join(artifactsDir, `${name}.json`), formatArtifact(artifact, 'json'));
      fresh.push(name);
      contracts++;
    }
    console.log(`OK   ${rel}${fresh.length ? ` -> ${fresh.join(', ')}` : ' (names already emitted)'}`);
    ok++;
  } catch (e) {
    const msg = e && e.message ? e.message.split('\n')[0] : String(e);
    console.log(`FAIL ${rel}: ${msg.slice(0, 90)}`);
    failures.push({ rel, msg });
  }
}
const total = ok + failures.length;
console.log(`\n=== ${ok}/${total} files cross-compiled, ${contracts} contract artifacts -> ${path.relative(process.cwd(), artifactsDir)} ===`);
if (failures.length) {
  console.log('\nRemaining walls (deep C2 mapping-loop codegen, not harness):');
  for (const f of failures) console.log(`  ${f.rel}`);
}
