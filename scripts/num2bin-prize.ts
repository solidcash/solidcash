/**
 * How much would emitting wide integer constants as `<minimal> <width> OP_NUM2BIN` save?
 *
 * A fixed-width integer constant is pushed verbatim: 256-bit parity means a 32-byte push for a value whose
 * minimal script-number encoding is often one or two bytes. OP_NUM2BIN reproduces the identical byte string
 * from the minimal encoding plus a width, so the stack item is unchanged and only the encoding shrinks.
 *
 * Unlike a constant pool this needs no repetition and no definition - one occurrence already pays.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileFile } from '../packages/solidc/src/index.js';
import { asmToScript, bytecodeToScript, encodeInt, Op, Script } from '../packages/utils/src/index.js';

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

/**
 * Bytes saved by re-emitting `element` as `<minimal> <width> OP_NUM2BIN`, or 0 when that is not shorter or not
 * byte-exact. `decodeInt` refuses a non-minimal encoding, so the value is read from the equivalent minimal form
 * and the result checked against the original bytes.
 */
export function minimalScriptNumberOf(element: Uint8Array): Uint8Array | undefined {
  if (element.length === 0) return undefined;
  const sign = element[element.length - 1] & 0x80;
  // Magnitude is the element with the sign bit cleared; NUM2BIN zero-pads exactly this and re-sets the sign.
  const magnitude = new Uint8Array(element);
  magnitude[magnitude.length - 1] &= 0x7f;
  let end = magnitude.length;
  while (end > 0 && magnitude[end - 1] === 0) end -= 1;
  if (end === 0) return sign === 0 ? new Uint8Array() : undefined; // negative zero is not a value NUM2BIN emits
  // A magnitude whose top byte already uses bit 7 needs one more byte to carry the sign.
  const needsSignByte = (magnitude[end - 1] & 0x80) !== 0;
  const minimal = new Uint8Array(end + (needsSignByte ? 1 : 0));
  minimal.set(magnitude.subarray(0, end), 0);
  minimal[minimal.length - 1] |= sign;
  return minimal;
}

function num2binSaving(element: Uint8Array): number {
  const minimal = minimalScriptNumberOf(element);
  if (minimal === undefined || minimal.length >= element.length) return 0;
  const widthPush = pushBytes(encodeInt(BigInt(element.length)));
  return pushBytes(element) - (pushBytes(minimal) + widthPush + 1);
}

let grandTotal = 0;
let sites = 0;
const rows: { name: string; saved: number; total: number; sites: number }[] = [];

for (const file of fs.readdirSync(CORPUS).filter((f) => f.endsWith('.scash')).sort()) {
  let script: Script;
  try { script = asmToScript(compileFile(path.join(CORPUS, file)).bytecode); } catch { continue; }
  let saved = 0;
  let count = 0;
  const scan = (s: Script): void => {
    for (let i = 0; i < s.length; i += 1) {
      const element = s[i];
      if (s[i + 2] === Op.OP_DEFINE && typeof element !== 'number') {
        scan(bytecodeToScript(element));
        i += 2;
        continue;
      }
      if (typeof element === 'number') continue;
      const gain = num2binSaving(element);
      if (gain > 0) {
        saved += gain;
        count += 1;
        if (process.env.SHOW) console.log(`    ${Buffer.from(element).toString('hex').slice(0, 80)}`);
      }
    }
  };
  scan(script);
  if (saved <= 0) continue;
  const total = script.reduce<number>((sum, e) => sum + (typeof e === 'number' ? 1 : pushBytes(e)), 0);
  grandTotal += saved;
  sites += count;
  rows.push({ name: file, saved, total, sites: count });
}

rows.sort((a, b) => b.saved - a.saved);
for (const r of rows.slice(0, 20)) {
  console.log(`${String(r.saved).padStart(6)}B  (${((r.saved / r.total) * 100).toFixed(1)}% of ${r.total}B, ` +
    `${r.sites} sites)\t${r.name}`);
}
console.log(`\ncontracts that would gain: ${rows.length}, sites: ${sites}, total saving: ${grandTotal}B`);
