/**
 * How many bytes do function identifiers cost, and how many would an optimal assignment save?
 *
 * Every OP_DEFINE and every OP_INVOKE is preceded by a push of the function id. Ids 1..16 and -1 encode as a
 * single-byte opcode (OP_1..OP_16, OP_1NEGATE); every other one-byte VM number costs two bytes to push. The
 * compiler hands compiler-helper ids out from -12 downwards, so it never uses the cheap range at all.
 *
 * Counts id pushes per id across a whole compiled script (top level plus every OP_DEFINE'd body) and reports the
 * saving from giving the most-pushed ids the cheap encodings.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileFile } from '../packages/solidc/src/index.js';
import { asmToScript, bytecodeToScript, Op, Script } from '../packages/utils/src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.resolve(here, '../packages/solidc/test/valid-contract-files');

const pushBytes = (element: Script[number]): number => {
  if (typeof element === 'number') return 1;
  const { length } = element;
  if (length === 0) return 1;
  if (length === 1 && ((element[0] !== 0 && element[0] <= 16) || element[0] === 129)) return 1;
  if (length <= 75) return length + 1;
  if (length <= 255) return length + 2;
  return length + 3;
};

const idKey = (element: Script[number]): string =>
  (typeof element === 'number' ? `op${element}` : Buffer.from(element).toString('hex'));

/** Every script in the artifact: the top level plus each OP_DEFINE'd body. */
function allScripts(bytecodeAsm: string): Script[] {
  const script = asmToScript(bytecodeAsm);
  const out: Script[] = [script];
  for (let i = 0; i + 2 < script.length; i += 1) {
    if (script[i + 2] === Op.OP_DEFINE && typeof script[i] !== 'number') {
      out.push(bytecodeToScript(script[i] as Uint8Array));
    }
  }
  return out;
}

interface Row { name: string; current: number; optimal: number; ids: number }

const rows: Row[] = [];
for (const file of fs.readdirSync(CORPUS).filter((f) => f.endsWith('.scash')).sort()) {
  let artifact;
  try { artifact = compileFile(path.join(CORPUS, file)); } catch { continue; }

  // id -> number of pushes of that id (one per OP_DEFINE, one per OP_INVOKE), and its current push width.
  const pushes = new Map<string, { count: number; width: number; isData: boolean }>();
  for (const script of allScripts(artifact.bytecode)) {
    for (let i = 1; i < script.length; i += 1) {
      if (script[i] !== Op.OP_DEFINE && script[i] !== Op.OP_INVOKE) continue;
      const id = script[i - 1];
      const key = idKey(id);
      const entry = pushes.get(key) ?? { count: 0, width: pushBytes(id), isData: typeof id !== 'number' };
      entry.count += 1;
      pushes.set(key, entry);
    }
  }
  if (pushes.size === 0) continue;

  const current = [...pushes.values()].reduce((sum, e) => sum + e.count * e.width, 0);
  // Cheap encodings available: OP_1..OP_16 and OP_1NEGATE. An id already at width 1 keeps it; otherwise the
  // hottest ids claim the free cheap slots. Selectors (4-byte) are fixed by the ABI and never rebadged.
  const rebadgeable = [...pushes.entries()]
    .filter(([, e]) => e.width === 2 && e.isData)
    .sort((a, b) => b[1].count - a[1].count);
  const alreadyCheap = [...pushes.values()].filter((e) => e.width === 1).length;
  const cheapSlots = Math.max(0, 17 - alreadyCheap);
  let optimal = current;
  for (const [, e] of rebadgeable.slice(0, cheapSlots)) optimal -= e.count;

  rows.push({ name: file, current, optimal, ids: pushes.size });
}

rows.sort((a, b) => (b.current - b.optimal) - (a.current - a.optimal));
const totalCurrent = rows.reduce((s, r) => s + r.current, 0);
const totalOptimal = rows.reduce((s, r) => s + r.optimal, 0);
for (const r of rows.slice(0, 20)) {
  console.log(`${String(r.current - r.optimal).padStart(6)}B saveable  (id bytes ${r.current} -> ${r.optimal}, ` +
    `${r.ids} distinct ids)\t${r.name}`);
}
console.log(`\ncontracts: ${rows.length}`);
console.log(`id push bytes: ${totalCurrent} -> ${totalOptimal} (saving ${totalCurrent - totalOptimal})`);
