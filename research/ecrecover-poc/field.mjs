// secp256k1 field arithmetic in BCH-2026 Script, validated against @noble/curves and measured on the real VM.
// The pivotal question: fast reduction (p = 2^256 - 2^32 - 977) vs general OP_MOD, per-modmul op-cost.
import { run, num, push, binToHex } from './harness.mjs';

export const P = 2n ** 256n - 2n ** 32n - 977n;
export const C = 2n ** 32n + 977n; // 2^256 == C (mod p)

// --- reduction snippets (input [T], T < 2^512, output [T mod p]) ---

// general: single OP_MOD by p
export const reduceGeneral = `${num(P)} OP_MOD`;

// one fold: [V] (V < 2^520) -> [V_lo + V_hi*C]  (halves the magnitude toward 2^256)
const FOLD =
  `<65> OP_NUM2BIN ` +          // V -> 65-byte LE
  `<32> OP_SPLIT ` +            // [lo32, hi33]
  `OP_BIN2NUM ` +               // [lo32, hiNum]   (hi33 top byte 0x00 => positive)
  `${num(C)} OP_MUL ` +         // [lo32, hiNum*C]
  `OP_SWAP <0x00> OP_CAT OP_BIN2NUM ` + // [hiNum*C, loNum]  (append sign byte => unsigned lo)
  `OP_ADD`;                     // [hiNum*C + loNum]

// fast: 3 folds + up to 2 conditional subtracts of p
const CONDSUB = `OP_DUP ${num(P)} OP_GREATERTHANOREQUAL OP_IF ${num(P)} OP_SUB OP_ENDIF`;
export const reduceFast = `${FOLD} ${FOLD} ${FOLD} ${CONDSUB} ${CONDSUB}`;

// hybrid: fold once/twice (shrink the 64-byte product toward 33 bytes) then a cheaper OP_MOD on the smaller value
export const reduceFold1Mod = `${FOLD} ${num(P)} OP_MOD`;
export const reduceFold2Mod = `${FOLD} ${FOLD} ${num(P)} OP_MOD`;

export const modmulGeneral = `OP_MUL ${reduceGeneral}`;
export const modmulFast = `OP_MUL ${reduceFast}`;
export const modmulFold1 = `OP_MUL ${reduceFold1Mod}`;
export const modmulFold2 = `OP_MUL ${reduceFold2Mod}`;

// --- test / measure ---
function checkModmul(label, snippet) {
  const rng = mulberry(12345);
  let okAll = true, maxCost = 0;
  for (let i = 0; i < 400; i++) {
    const a = rand256(rng) % P, b = rand256(rng) % P;
    const r = run(`${num(a)} ${num(b)}`, snippet);
    const want = (a * b) % P;
    const got = r.stack[r.stack.length - 1];
    if (r.error || got !== want) { okAll = false; if (i < 3 || !r.error) console.log(`  MISMATCH i=${i}: err=${r.error} got=${typeof got==='bigint'?got.toString(16).slice(0,20):got} want=${want.toString(16).slice(0,20)}`); if (i > 5) break; }
    maxCost = Math.max(maxCost, r.opCost);
  }
  // edge cases: a=b=p-1 (max product), a=0, b=0
  for (const [a, b] of [[P - 1n, P - 1n], [0n, 5n], [P - 1n, 2n], [1n, P - 1n]]) {
    const r = run(`${num(a)} ${num(b)}`, snippet);
    const want = (a * b) % P;
    if (r.error || r.stack[r.stack.length - 1] !== want) { okAll = false; console.log(`  EDGE FAIL a=${a.toString(16).slice(0,8)} b=${b.toString(16).slice(0,8)}: err=${r.error} got=${r.stackHex[r.stackHex.length-1]?.slice(0,20)} want=${want.toString(16).slice(0,20)}`); }
  }
  console.log(`${label}: ${okAll ? 'PASS' : 'FAIL'}  | per-modmul opCost ~${maxCost}`);
  return { okAll, maxCost };
}

// deterministic RNG + 256-bit sampler
function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function rand256(rng) { let x = 0n; for (let i = 0; i < 8; i++) x = (x << 32n) | BigInt(Math.floor(rng() * 4294967296)); return x; }

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== modmul reduction variants (400 random + edges vs noble math; budget/input 8.03M) ===');
  const variants = [
    ['general (OP_MUL+OP_MOD)  ', modmulGeneral],
    ['fold1+MOD                ', modmulFold1],
    ['fold2+MOD                ', modmulFold2],
    ['fast fold3+condsub       ', modmulFast],
  ];
  let best = { maxCost: Infinity, label: '' };
  for (const [label, snip] of variants) {
    const r = checkModmul(label, snip);
    if (r.okAll && r.maxCost < best.maxCost) best = { maxCost: r.maxCost, label };
    if (r.okAll) console.log(`     -> 2471 modmuls = ${(2471 * r.maxCost / 1e6).toFixed(2)}M  | fits 1 input: ${2471 * r.maxCost <= 8_032_800}`);
  }
  console.log(`\nBEST: ${best.label.trim()} @ ${best.maxCost}/modmul`);
}
