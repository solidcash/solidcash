/**
 * How much operation-cost headroom has the size work consumed?
 *
 * The BCH-2026 budget is `operationCostBudgetPerByte x (41 + unlockingBytecodeLength)`, and for a p2sh32
 * contract the redeem script IS the unlocking bytecode. So every script byte removed removes 800 units of
 * budget at stock limits, while removing little or no operation cost - outlining in particular removes bytes
 * and ADDS OP_INVOKEs. This reports, per contract, the budget its own script size buys, so the loss can be
 * compared against a stored baseline rather than argued about.
 *
 *   npx tsx scripts/density-headroom.ts --json out.json
 *   npx tsx scripts/density-headroom.ts --base baseline.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileFile } from '../packages/solidc/src/index.js';
import { asmToScript, calculateBytesize } from '../packages/utils/src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.resolve(here, '../packages/solidc/test/valid-contract-files');
const BUDGET_PER_BYTE = 800;

interface Entry { name: string; scriptBytes: number; budget: number }

const entries: Entry[] = [];
for (const file of fs.readdirSync(CORPUS).filter((f) => f.endsWith('.scash')).sort()) {
  try {
    const scriptBytes = calculateBytesize(asmToScript(compileFile(path.join(CORPUS, file)).bytecode));
    // Budget from the script alone, i.e. ignoring constructor args and call arguments, which are unchanged by
    // codegen. The DELTA between two compiles is what this is for, and those terms cancel in it.
    entries.push({ name: file, scriptBytes, budget: BUDGET_PER_BYTE * (41 + scriptBytes) });
  } catch { /* reported by the size bench */ }
}

const args = process.argv.slice(2);
const jsonAt = args.indexOf('--json');
const baseAt = args.indexOf('--base');
const total = entries.reduce((sum, e) => sum + e.budget, 0);

if (baseAt !== -1) {
  const base: Entry[] = JSON.parse(fs.readFileSync(args[baseAt + 1], 'utf-8')).entries;
  const byName = new Map(base.map((e) => [e.name, e]));
  const diffs = entries
    .map((e) => ({ name: e.name, now: e.budget, was: byName.get(e.name)?.budget ?? e.budget }))
    .map((d) => ({ ...d, lost: d.was - d.now }))
    .filter((d) => d.lost !== 0)
    .sort((a, b) => b.lost - a.lost);
  for (const d of diffs.slice(0, 15)) {
    console.log(`${String(d.lost).padStart(8)} budget lost (${((d.lost / d.was) * 100).toFixed(1)}%)\t${d.name}`);
  }
  const baseTotal = base.reduce((sum, e) => sum + e.budget, 0);
  console.log(`\ntotal operation-cost budget: ${baseTotal} -> ${total} `
    + `(${(((total - baseTotal) / baseTotal) * 100).toFixed(2)}%)`);
  console.log('Every contract that shrank now runs against a proportionally smaller ceiling.');
} else {
  console.log(`contracts: ${entries.length}, total script-derived budget: ${total}`);
}

if (jsonAt !== -1) {
  fs.writeFileSync(args[jsonAt + 1], JSON.stringify({ entries, total }, null, 2));
  console.log(`wrote ${args[jsonAt + 1]}`);
}
