/**
 * Where the emitted bytes go, corpus-wide.
 *
 * Splits every compiled script into the overhead of having functions at all (identifier pushes, OP_DEFINE /
 * OP_INVOKE opcodes, the length prefix on each pushed body) versus the instruction content those functions
 * hold. A lever only pays if the bucket it targets is actually large.
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

const buckets = {
  total: 0,
  idPushes: 0,
  defineInvokeOps: 0,
  bodyLengthPrefix: 0,
  content: 0,
  dataPushes: 0,
  opcodes: 0,
};
let defines = 0;
let invokes = 0;

/** Walk a script, recursing into each pushed OP_DEFINE body. */
function walk(script: Script): void {
  for (let i = 0; i < script.length; i += 1) {
    const element = script[i];
    const isIdSite = script[i + 1] === Op.OP_DEFINE || script[i + 1] === Op.OP_INVOKE;
    if (script[i + 2] === Op.OP_DEFINE && typeof element !== 'number') {
      // <body> <id> OP_DEFINE: the body's own bytes are counted by recursing, so only its prefix is overhead.
      buckets.bodyLengthPrefix += pushBytes(element) - element.length;
      walk(bytecodeToScript(element));
      buckets.idPushes += pushBytes(script[i + 1]);
      buckets.defineInvokeOps += 1;
      defines += 1;
      i += 2;
      continue;
    }
    if (isIdSite) {
      buckets.idPushes += pushBytes(element);
      buckets.defineInvokeOps += 1;
      if (script[i + 1] === Op.OP_DEFINE) defines += 1; else invokes += 1;
      i += 1;
      continue;
    }
    const bytes = pushBytes(element);
    buckets.content += bytes;
    if (typeof element === 'number') buckets.opcodes += bytes; else buckets.dataPushes += bytes;
  }
}

for (const file of fs.readdirSync(CORPUS).filter((f) => f.endsWith('.scash')).sort()) {
  try {
    const script = asmToScript(compileFile(path.join(CORPUS, file)).bytecode);
    buckets.total += script.reduce<number>((sum, e) => sum + pushBytes(e), 0);
    walk(script);
  } catch { /* corpus compile failures are reported by the size bench */ }
}

const pct = (n: number): string => `${((n / buckets.total) * 100).toFixed(1)}%`;
console.log(`total                 ${buckets.total}`);
console.log(`  identifier pushes   ${buckets.idPushes}\t${pct(buckets.idPushes)}`);
console.log(`  OP_DEFINE/OP_INVOKE ${buckets.defineInvokeOps}\t${pct(buckets.defineInvokeOps)}`);
console.log(`  body length prefix  ${buckets.bodyLengthPrefix}\t${pct(buckets.bodyLengthPrefix)}`);
console.log(`  content             ${buckets.content}\t${pct(buckets.content)}`);
console.log(`    opcodes           ${buckets.opcodes}\t${pct(buckets.opcodes)}`);
console.log(`    data pushes       ${buckets.dataPushes}\t${pct(buckets.dataPushes)}`);
console.log(`\ndefines=${defines} invokes=${invokes}`);
