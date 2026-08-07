/**
 * What is left in the data pushes, corpus-wide.
 *
 * Data pushes are the largest content bucket after opcodes, so before reaching for another lever it is worth
 * knowing what they hold: a histogram by width, and the payloads that cost the most in total.
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

const widths = new Map<number, { count: number; bytes: number }>();
const payloads = new Map<string, { count: number; bytes: number }>();
const roles = { identifier: 0, body: 0, value: 0 };

for (const file of fs.readdirSync(CORPUS).filter((f) => f.endsWith('.scash')).sort()) {
  let script: Script;
  try { script = asmToScript(compileFile(path.join(CORPUS, file)).bytecode); } catch { continue; }
  const scan = (s: Script): void => {
    for (let i = 0; i < s.length; i += 1) {
      const element = s[i];
      if (s[i + 2] === Op.OP_DEFINE && typeof element !== 'number') {
        roles.body += pushBytes(element) - element.length;
        scan(bytecodeToScript(element));
        roles.identifier += pushBytes(s[i + 1]);
        i += 2;
        continue;
      }
      if (typeof element === 'number') continue;
      const bytes = pushBytes(element);
      if (s[i + 1] === Op.OP_DEFINE || s[i + 1] === Op.OP_INVOKE) { roles.identifier += bytes; continue; }
      roles.value += bytes;
      const widthKey = element.length <= 4 ? element.length : element.length <= 8 ? 8
        : element.length <= 20 ? 20 : element.length <= 32 ? 32 : 33;
      const width = widths.get(widthKey) ?? { count: 0, bytes: 0 };
      width.count += 1;
      width.bytes += bytes;
      widths.set(widthKey, width);
      const key = Buffer.from(element).toString('hex');
      const payload = payloads.get(key) ?? { count: 0, bytes: 0 };
      payload.count += 1;
      payload.bytes += bytes;
      payloads.set(key, payload);
    }
  };
  scan(script);
}

console.log(`value pushes ${roles.value}B, identifier pushes ${roles.identifier}B, body prefixes ${roles.body}B`);
console.log('\nvalue pushes by width (<=N bytes):');
for (const [width, stat] of [...widths].sort((a, b) => a[0] - b[0])) {
  console.log(`  <=${String(width).padStart(3)}  x${String(stat.count).padStart(5)}  ${stat.bytes}B`);
}
console.log('\ncostliest distinct payloads (total bytes across the corpus):');
for (const [hex, stat] of [...payloads].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 12)) {
  console.log(`  ${String(stat.bytes).padStart(5)}B  x${String(stat.count).padStart(4)}  ${hex.slice(0, 64)}`);
}
