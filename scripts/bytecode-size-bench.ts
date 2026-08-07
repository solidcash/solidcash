/**
 * Bytecode size benchmark.
 *
 * Compiles every contract in the valid-contract-files corpus and reports the emitted script size, so a codegen
 * or optimiser change can be measured against a fixed baseline instead of a single hand-picked contract.
 *
 * Usage:
 *   npx tsx scripts/bytecode-size-bench.ts                    # print the table
 *   npx tsx scripts/bytecode-size-bench.ts --json out.json    # also write machine-readable results
 *   npx tsx scripts/bytecode-size-bench.ts --base base.json   # diff against a previous run
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileFile } from '../packages/solidc/src/index.js';
import { asmToScript, calculateBytesize } from '../packages/utils/src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.resolve(here, '../packages/solidc/test/valid-contract-files');

interface Entry { name: string; bytes: number; ops: number }

function sizeOfArtifactBytecode(bytecodeAsm: string): number {
  return calculateBytesize(asmToScript(bytecodeAsm));
}

function run(): { entries: Entry[]; failures: string[] } {
  const files = fs.readdirSync(CORPUS).filter((f) => f.endsWith('.scash')).sort();
  const entries: Entry[] = [];
  const failures: string[] = [];
  for (const file of files) {
    try {
      const artifact = compileFile(path.join(CORPUS, file));
      const bytes = sizeOfArtifactBytecode(artifact.bytecode);
      const ops = artifact.bytecode.split(' ').filter(Boolean).length;
      entries.push({ name: file, bytes, ops });
    } catch (error) {
      failures.push(`${file}: ${(error as Error).message.split('\n')[0]}`);
    }
  }
  return { entries, failures };
}

const args = process.argv.slice(2);
const jsonAt = args.indexOf('--json');
const baseAt = args.indexOf('--base');

const { entries, failures } = run();
const total = entries.reduce((sum, e) => sum + e.bytes, 0);

if (baseAt !== -1) {
  const base: Entry[] = JSON.parse(fs.readFileSync(args[baseAt + 1], 'utf-8')).entries;
  const baseByName = new Map(base.map((e) => [e.name, e]));
  const diffs = entries
    .map((e) => ({ name: e.name, now: e.bytes, was: baseByName.get(e.name)?.bytes ?? e.bytes }))
    .map((d) => ({ ...d, delta: d.now - d.was }))
    .filter((d) => d.delta !== 0)
    .sort((a, b) => a.delta - b.delta);
  const baseTotal = base.reduce((sum, e) => sum + e.bytes, 0);
  for (const d of diffs) {
    const pct = ((d.delta / d.was) * 100).toFixed(1);
    console.log(`${d.delta > 0 ? '+' : ''}${d.delta}\t${pct}%\t${d.name}\t(${d.was} -> ${d.now})`);
  }
  console.log(`\nchanged: ${diffs.length}/${entries.length} contracts`);
  console.log(`total:   ${baseTotal} -> ${total} (${total - baseTotal >= 0 ? '+' : ''}${total - baseTotal}, ` +
    `${(((total - baseTotal) / baseTotal) * 100).toFixed(2)}%)`);
} else {
  const sorted = [...entries].sort((a, b) => b.bytes - a.bytes);
  console.log('top 25 by size:');
  for (const e of sorted.slice(0, 25)) console.log(`${String(e.bytes).padStart(7)}\t${e.name}`);
  console.log(`\ncompiled: ${entries.length}, failed: ${failures.length}`);
  console.log(`total bytes: ${total}`);
}

if (jsonAt !== -1) {
  fs.writeFileSync(args[jsonAt + 1], JSON.stringify({ entries, failures, total }, null, 2));
  console.log(`wrote ${args[jsonAt + 1]}`);
}
