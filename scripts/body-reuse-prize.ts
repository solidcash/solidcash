/**
 * How many top-level bytes duplicate a body the script ALREADY defines?
 *
 * The two outlining passes are separate: one shares across OP_DEFINE'd bodies, the other within the
 * contract-level script. Neither sees a span that appears in both. The observed shape is a helper that exists
 * as a defined body AND verbatim inline at the top level - e.g. the int256 range guard, which the body pass
 * outlined for the bodies while the top-level copy stayed inline.
 *
 * Replacing such a copy with `<id> OP_INVOKE` needs the definition to already have executed, so only
 * occurrences AFTER the defining OP_DEFINE count here.
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
const key = (element: Script[number]): string =>
  (typeof element === 'number' ? `o${element}` : `d${Buffer.from(element).toString('hex')}`);

let grandTotal = 0;
const rows: { name: string; saved: number; total: number; hits: number }[] = [];

for (const file of fs.readdirSync(CORPUS).filter((f) => f.endsWith('.scash')).sort()) {
  let script: Script;
  try { script = asmToScript(compileFile(path.join(CORPUS, file)).bytecode); } catch { continue; }

  // Each defined body, with the index at which its OP_DEFINE completes.
  const defined: { tokens: string[]; bytes: number; definedAt: number; idBytes: number }[] = [];
  for (let i = 0; i + 2 < script.length; i += 1) {
    if (script[i + 2] !== Op.OP_DEFINE || typeof script[i] === 'number') continue;
    const body = bytecodeToScript(script[i] as Uint8Array);
    defined.push({
      tokens: body.map(key),
      bytes: body.reduce<number>((sum, e) => sum + pushBytes(e), 0),
      definedAt: i + 2,
      idBytes: pushBytes(script[i + 1]),
    });
  }

  const tokens = script.map(key);
  const claimed = new Set<number>();
  let saved = 0;
  let hits = 0;
  for (const body of defined) {
    if (body.tokens.length === 0) continue;
    for (let i = body.definedAt + 1; i + body.tokens.length <= tokens.length; i += 1) {
      let matches = true;
      for (let j = 0; j < body.tokens.length; j += 1) {
        if (tokens[i + j] !== body.tokens[j] || claimed.has(i + j)) { matches = false; break; }
      }
      if (!matches) continue;
      const gain = body.bytes - (body.idBytes + 1);
      if (gain <= 0) continue;
      for (let j = 0; j < body.tokens.length; j += 1) claimed.add(i + j);
      saved += gain;
      hits += 1;
      i += body.tokens.length - 1;
    }
  }
  if (saved <= 0) continue;
  const total = script.reduce<number>((sum, e) => sum + pushBytes(e), 0);
  grandTotal += saved;
  rows.push({ name: file, saved, total, hits });
}

rows.sort((a, b) => b.saved - a.saved);
for (const r of rows.slice(0, 15)) {
  console.log(`${String(r.saved).padStart(6)}B  (${((r.saved / r.total) * 100).toFixed(1)}% of ${r.total}B, ` +
    `${r.hits} reusable copies)\t${r.name}`);
}
console.log(`\ncontracts that would gain: ${rows.length}, total saving: ${grandTotal}B`);
