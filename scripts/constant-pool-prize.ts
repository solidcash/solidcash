/**
 * Would a constant pool pay?
 *
 * Outlining only considers spans of at least eight elements, so a data push repeated across bodies is never
 * shared however large it is. A one-element function whose body is just that push would let every site become
 * `<id> OP_INVOKE`. This measures the net saving that would buy, corpus-wide.
 *
 * Identifier operands (the element before OP_DEFINE / OP_INVOKE) are excluded: rewriting one would redirect
 * dispatch rather than share a constant.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileFile } from '../packages/solidc/src/index.js';
import { asmToScript, bytecodeToScript, Op, Script } from '../packages/utils/src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.resolve(here, '../packages/solidc/test/valid-contract-files');

const pushBytes = (element: Uint8Array): number => {
  const { length } = element;
  if (length === 0) return 1;
  if (length === 1 && ((element[0] !== 0 && element[0] <= 16) || element[0] === 129)) return 1;
  if (length <= 75) return length + 1;
  if (length <= 255) return length + 2;
  return length + 3;
};

// A pooled constant costs one definition and turns each site into an id push plus OP_INVOKE. Two bytes is the
// id width a contract past the single-byte pool actually draws.
const ID_PUSH_BYTES = 2;
const savingOf = (bytes: number, count: number): number => {
  const definitionOverhead = bytes < 76 ? 1 : bytes < 256 ? 2 : 3;
  return count * bytes - (definitionOverhead + bytes + ID_PUSH_BYTES + 1) - count * (ID_PUSH_BYTES + 1);
};

let grandTotal = 0;
let topOnly = 0;
let bodyOnly = 0;
let mixed = 0;
const rows: { name: string; saved: number; total: number; pooled: number }[] = [];
const only = process.argv.slice(2);
const corpus = fs.readdirSync(CORPUS).filter((f) => f.endsWith('.scash')).sort()
  .filter((f) => only.length === 0 || only.includes(f));

for (const file of corpus) {
  let script: Script;
  try { script = asmToScript(compileFile(path.join(CORPUS, file)).bytecode); } catch { continue; }

  const counts = new Map<string, { count: number; bytes: number; top: number }>();
  const scan = (s: Script, isTop: boolean): void => {
    for (let i = 0; i < s.length; i += 1) {
      const element = s[i];
      if (s[i + 2] === Op.OP_DEFINE && typeof element !== 'number') {
        scan(bytecodeToScript(element), false);
        i += 2;
        continue;
      }
      if (typeof element === 'number') continue;
      if (s[i + 1] === Op.OP_DEFINE || s[i + 1] === Op.OP_INVOKE) continue;
      const bytes = pushBytes(element);
      // Below four bytes a pooled site (3) barely undercuts the push, so nothing there can repay a definition.
      if (bytes < 4) continue;
      const key = Buffer.from(element).toString('hex');
      const entry = counts.get(key) ?? { count: 0, bytes, top: 0 };
      entry.count += 1;
      if (isTop) entry.top += 1;
      counts.set(key, entry);
    }
  };
  scan(script, true);

  let saved = 0;
  let pooled = 0;
  for (const [hex, { count, bytes, top }] of counts) {
    const gain = savingOf(bytes, count);
    if (gain <= 0) continue;
    saved += gain;
    pooled += 1;
    if (top === count) topOnly += gain; else if (top === 0) bodyOnly += gain; else mixed += gain;
    if (only.length > 0) console.log(`  x${count} (${top} top-level) ${bytes}B saves ${gain}B: ${hex.slice(0, 80)}`);
  }
  if (saved <= 0) continue;
  const total = script.reduce<number>((sum, e) => sum + (typeof e === 'number' ? 1 : pushBytes(e)), 0);
  grandTotal += saved;
  rows.push({ name: file, saved, total, pooled });
}

rows.sort((a, b) => b.saved - a.saved);
for (const r of rows.slice(0, 20)) {
  console.log(`${String(r.saved).padStart(6)}B  (${((r.saved / r.total) * 100).toFixed(1)}% of ${r.total}B, ` +
    `${r.pooled} constants)\t${r.name}`);
}
console.log(`\ncontracts that would gain: ${rows.length}, total saving: ${grandTotal}B`);
console.log(`  top-level only: ${topOnly}B   inside OP_DEFINE bodies only: ${bodyOnly}B   spanning both: ${mixed}B`);
