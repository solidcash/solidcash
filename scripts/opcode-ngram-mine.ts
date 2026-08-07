/**
 * Most frequent short opcode sequences in the compiled corpus.
 *
 * Outlining trades operation-cost headroom for bytes (see the density note), so the remaining safe direction is
 * removing OPERATIONS - a shorter equivalent sequence wins on bytes and on operation cost at once. This ranks
 * what the compiler actually emits so a rewrite can be aimed at something common rather than something that
 * merely looks wasteful.
 *
 * Data pushes collapse to a width class: a rewrite can only key on opcodes, so the payload is noise, but a
 * one-byte push behaves differently from a long one and must not merge with it.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileFile } from '../packages/solidc/src/index.js';
import { asmToScript, bytecodeToScript, Op, Script } from '../packages/utils/src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.resolve(here, '../packages/solidc/test/valid-contract-files');

const opNames = new Map<number, string>(
  Object.entries(Op).filter(([, v]) => typeof v === 'number').map(([k, v]) => [v as number, k]),
);
const token = (element: Script[number]): string =>
  (typeof element === 'number' ? opNames.get(element) ?? `OP_${element}` : `<d${element.length}>`);

const MIN_N = Number(process.env.MIN_N ?? 2);
const MAX_N = Number(process.env.MAX_N ?? 4);
const counts = new Map<string, number>();
const contracts = new Map<string, Set<string>>();

for (const file of fs.readdirSync(CORPUS).filter((f) => f.endsWith('.scash')).sort()) {
  let script: Script;
  try { script = asmToScript(compileFile(path.join(CORPUS, file)).bytecode); } catch { continue; }
  const scripts: Script[] = [script];
  for (let i = 0; i + 2 < script.length; i += 1) {
    if (script[i + 2] === Op.OP_DEFINE && typeof script[i] !== 'number') {
      scripts.push(bytecodeToScript(script[i] as Uint8Array));
    }
  }
  for (const part of scripts) {
    const tokens = part.map(token);
    for (let n = MIN_N; n <= MAX_N; n += 1) {
      for (let i = 0; i + n <= tokens.length; i += 1) {
        const key = tokens.slice(i, i + n).join(' ');
        counts.set(key, (counts.get(key) ?? 0) + 1);
        const set = contracts.get(key) ?? new Set<string>();
        set.add(file);
        contracts.set(key, set);
      }
    }
  }
}

const ranked = [...counts.entries()]
  .filter(([key, n]) => n >= 30 && !key.includes('<d'))
  .sort((a, b) => b[1] - a[1]);

console.log('count\tcontracts\tsequence');
for (const [key, count] of ranked.slice(0, Number(process.env.TOP ?? 40))) {
  console.log(`${count}\t${contracts.get(key)!.size}\t\t${key}`);
}
