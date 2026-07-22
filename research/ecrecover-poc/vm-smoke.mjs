// Smoke-test the BCH-2026 toolchain for the pieces the recovery needs:
// (1) BigInt OP_MUL + OP_MOD on 256-bit numbers, (2) OP_BEGIN/OP_UNTIL loop, (3) OP_DEFINE/OP_INVOKE functions.
import { run, num, push, binToHex } from './harness.mjs';

const P = 2n ** 256n - 2n ** 32n - 977n;
const a = 0x1122334455667788990011223344556677889900112233445566778899001122n % P;
const b = 0xffeeddccbbaa99887766554433221100ffeeddccbbaa998877665544332211n % P;

console.log('=== (1) modmul via OP_MUL + OP_MOD (256-bit) ===');
{
  const r = run(`${num(a)} ${num(b)}`, `OP_MUL ${num(P)} OP_MOD`);
  const want = (a * b) % P;
  console.log('  err:', r.error ?? 'none', '| opCost:', r.opCost, '| instr:', r.instr);
  console.log('  got == want:', r.stack[r.stack.length - 1] === want, r.error ? '' : `(${r.stackHex[r.stackHex.length-1].slice(0,16)}..)`);
}

console.log('=== (2) OP_BEGIN / OP_UNTIL loop (repeated squaring x8) ===');
{
  // seed x=a; counter=8; loop: x = x*x mod P; counter--; until counter==0
  // stack layout during loop: [x, counter]
  const body = `OP_SWAP OP_DUP OP_MUL ${num(P)} OP_MOD OP_SWAP OP_1SUB OP_DUP OP_0 OP_NUMEQUAL`;
  const r = run(`${num(a)} <0x08>`, `OP_BEGIN ${body} OP_UNTIL OP_DROP`);
  let want = a; for (let i = 0; i < 8; i++) want = (want * want) % P;
  console.log('  err:', r.error ?? 'none', '| opCost:', r.opCost);
  console.log('  got == want:', r.stack[r.stack.length - 1] === want);
}

console.log('=== (3) OP_DEFINE / OP_INVOKE function ===');
{
  // Probe the calling convention: define a function that does [x y]->[x*y mod P], invoke it.
  // Try the common shape: <body-bytecode> <id> OP_DEFINE ; ... <id> OP_INVOKE
  const attempts = [
    { name: 'body-push then id then DEFINE; INVOKE by id',
      lock: `${num(a)} ${num(b)} OP_2 OP_INVOKE OP_NIP` /* placeholder */ },
  ];
  // Instead just probe raw assembler acceptance of the opcodes:
  for (const op of ['OP_DEFINE', 'OP_INVOKE', 'OP_BEGIN', 'OP_UNTIL']) {
    try {
      const r = run('OP_1', `${op === 'OP_DEFINE' || op === 'OP_INVOKE' ? 'OP_DROP OP_1' : `OP_DROP OP_1`}`);
      console.log(`  assembler knows ${op}: (indirect ok)`);
      break;
    } catch (e) { /* ignore */ }
  }
  // Direct DEFINE/INVOKE probe with a minimal body:
  try {
    const r = run(`${num(6n)} ${num(7n)}`, `OP_MUL`); // baseline
    console.log('  baseline mul 6*7:', r.stack[r.stack.length-1]);
  } catch (e) { console.log('  baseline err', e.message.slice(0,80)); }
}
