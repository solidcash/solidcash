/**
 * How many bytes sit in OP_DEFINE'd bodies that are byte-identical to another body in the same script?
 *
 * `<body> <id> OP_DEFINE` twice can be `<body> OP_DUP <id1> OP_DEFINE <id2> OP_DEFINE`: OP_DEFINE consumes the
 * body and the id, so duplicating the body on the stack once registers it under both identifiers. That saves a
 * whole body copy for one byte, and unlike outlining it adds NO OP_INVOKE - the call sites already invoke - so
 * it is the one form of sharing that does not trade operation-cost budget for size.
 *
 * The outliner cannot find these: a body is a data push whose successor-but-one is OP_DEFINE, which the
 * constant seeding excludes precisely so it does not try to share a function definition as if it were a value.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileFile } from '../packages/solidc/src/index.js';
import { asmToScript, Op, Script } from '../packages/utils/src/index.js';

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

let grandTotal = 0;
const rows: { name: string; saved: number; total: number; groups: number }[] = [];

for (const file of fs.readdirSync(CORPUS).filter((f) => f.endsWith('.scash')).sort()) {
  let script: Script;
  try { script = asmToScript(compileFile(path.join(CORPUS, file)).bytecode); } catch { continue; }

  const bodies = new Map<string, number>();
  for (let i = 0; i + 2 < script.length; i += 1) {
    if (script[i + 2] !== Op.OP_DEFINE || typeof script[i] === 'number') continue;
    const key = Buffer.from(script[i] as Uint8Array).toString('hex');
    bodies.set(key, (bodies.get(key) ?? 0) + 1);
  }

  let saved = 0;
  let groups = 0;
  for (const [hex, count] of bodies) {
    if (count < 2) continue;
    const bytes = pushBytes(Buffer.from(hex, 'hex'));
    // Each extra copy costs one OP_DUP instead of a whole push.
    saved += (count - 1) * (bytes - 1);
    groups += 1;
  }
  if (saved <= 0) continue;
  const total = script.reduce<number>((sum, e) => sum + (typeof e === 'number' ? 1 : pushBytes(e)), 0);
  grandTotal += saved;
  rows.push({ name: file, saved, total, groups });
}

rows.sort((a, b) => b.saved - a.saved);
for (const r of rows.slice(0, 15)) {
  console.log(`${String(r.saved).padStart(6)}B  (${((r.saved / r.total) * 100).toFixed(1)}% of ${r.total}B, ` +
    `${r.groups} duplicated bodies)\t${r.name}`);
}
console.log(`\ncontracts with duplicate bodies: ${rows.length}, total saving: ${grandTotal}B`);
