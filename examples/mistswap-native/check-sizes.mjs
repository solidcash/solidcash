// Validate every DEPLOYABLE artifact against the real BCH 10,000-byte input-script ceiling.
// A contract that is split is deployed as its root plus delegate facets, each spent in its own input, so each
// of those must fit. The oversized unsplit artifact it was derived from is not deployed and is skipped.
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { asmToBytecode } from '@solidcash/utils';

const LIMIT = 10_000;
const dir = process.argv[2] ?? 'artifacts/solidcash';
const rows = [];
const size = (bytecode) => (typeof bytecode === 'string' ? asmToBytecode(bytecode).length : undefined);

for (const entry of readdirSync(dir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
  const path = join(dir, entry.name);
  let artifact;
  try { artifact = JSON.parse(readFileSync(path, 'utf8')); } catch { continue; }

  if (entry.name.endsWith('.split.json')) {
    const label = artifact.manifest?.logicalContractName ?? entry.name.replace('.split.json', '');
    rows.push({ name: `${label}#root`, bytes: size(artifact.root?.bytecode), split: true });
    for (const [facet, art] of Object.entries(artifact.facets ?? {})) {
      rows.push({ name: `${label}#${facet}`, bytes: size(art?.bytecode), split: true });
    }
    continue;
  }
  // Skip the unsplit source artifact when a split bundle superseded it.
  const base = entry.name.replace(/\.json$/, '');
  if (existsSync(join(dir, `${base}.split.json`))) continue;
  rows.push({ name: artifact.contractName ?? base, bytes: size(artifact.bytecode), split: false });
}

const measured = rows.filter((r) => r.bytes !== undefined);
measured.sort((a, b) => b.bytes - a.bytes);
const over = measured.filter((r) => r.bytes > LIMIT);
const splits = new Set(measured.filter((r) => r.split).map((r) => r.name.split('#')[0]));

console.log(`scanned ${measured.length} deployable script(s); ${splits.size} contract(s) split`);
console.log('\nlargest 15:');
for (const r of measured.slice(0, 15)) {
  console.log(`  ${String(r.bytes).padStart(6)}  ${r.bytes > LIMIT ? 'OVER' : '  ok'}  ${r.name}`);
}
console.log(`\n${over.length} script(s) exceed the ${LIMIT}-byte limit`);
for (const r of over) console.log(`  OVER ${String(r.bytes).padStart(6)}  ${r.name}`);
process.exit(over.length === 0 ? 0 : 1);
