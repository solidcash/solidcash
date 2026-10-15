// Verify the chained keccak absorb step: [25 zero lanes, 136-byte block] -> [25 lanes] equals the
// JS oracle's keccakF output (one absorb + one permutation), in the script's big-endian lane order.
import { keccakF, RC } from './keccak.mjs';
import { asm, binToHex, run } from './vm.mjs';
import { genRoundDefine } from './genvar.mjs';

const be = (v) => v.toString(16).padStart(16, '0');
const ALLONES = 'ffffffffffffffff';
const ZERO = '0000000000000000';
const ROT = [[0,36,3,41,18],[1,44,10,45,2],[62,6,43,15,61],[28,55,25,21,56],[27,20,39,8,14]];
const piSrc = [];
for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) piSrc[y + 5 * ((2 * x + 3 * y) % 5)] = { x, y, rot: ROT[x][y] };

class Emit {
  constructor() { this.ops = []; this.size = 0; }
  raw(s, d) { this.ops.push(s); this.size += d; }
  pushHex(h) { this.raw(`<0x${h}>`, 1); }
  pickAbs(ai) { this.raw(`<${this.size - 1 - ai}> OP_PICK`, 1); }
  word(i) { if (i > 0) this.raw(`<${8 * i}> OP_SPLIT OP_NIP`, 0); this.raw('<8> OP_SPLIT OP_DROP', 0); }
  xor() { this.raw('OP_XOR', -1); }
  and() { this.raw('OP_AND', -1); }
  not() { this.raw(`<0x${ALLONES}> OP_XOR`, 0); }
  rotl(k) { if (k % 64 === 0) return; this.raw(`OP_DUP <${k}> OP_LSHIFTBIN OP_SWAP <${64 - k}> OP_RSHIFTBIN OP_OR`, 0); }
}
function reverseEachLane(e, n) {
  e.raw('<8> OP_SPLIT OP_SWAP OP_REVERSEBYTES OP_SWAP', 1);
  for (let i = 1; i < n; i++) { e.raw('<8> OP_SPLIT OP_SWAP OP_REVERSEBYTES', 1); e.raw('OP_ROT OP_SWAP OP_CAT OP_SWAP', -1); }
  e.raw('OP_DROP', -1);
}
function emitAbsorbBlock25(e) {
  reverseEachLane(e, 17);
  const base = e.size - 26, L = (i) => base + (24 - i), blk = base + 25;
  for (let i = 24; i >= 0; i--) {
    e.pickAbs(L(i));
    if (i < 17) { e.pickAbs(blk); e.word(i); e.xor(); }
  }
  for (let k = 0; k < 26; k++) e.raw('<25> OP_ROLL OP_DROP', -1);
}

const aTo = (s) => binToHex(asm(s));
const ROUND_DEFINE_ASM = genRoundDefine(aTo, 2);

function genChainStepAsm() {
  const e = new Emit(); e.size = 26;
  emitAbsorbBlock25(e);
  for (let r = 0; r < 24; r++) { e.raw('<2> OP_INVOKE', 0); e.raw(`<0x${be(RC[r])}> OP_XOR`, 0); }
  return e.ops.join(' ');
}
const CHAIN_STEP_ASM = genChainStepAsm();

// Combine 25 lanes (lane0 on top) -> lane24 || ... || lane0 (the chained commitment byte order).
const COMBINE_STATE_ASM =
  'OP_TOALTSTACK '.repeat(25).trim() + ' OP_FROMALTSTACK'
  + ' OP_FROMALTSTACK OP_CAT'.repeat(24);

const block = new Uint8Array(136);
for (let i = 0; i < 136; i++) block[i] = (i * 7 + 3) & 0xff;
const blockHex = binToHex(block);
const zeros25 = Array.from({ length: 25 }, () => `<0x${ZERO}>`).join(' ');

// Oracle: absorb block (LE lanes) into zero state, one keccakF.
const A = new Array(25).fill(0n);
for (let i = 0; i < 17; i++) {
  let lane = 0n;
  for (let b = 0; b < 8; b++) lane |= BigInt(block[i * 8 + b]) << BigInt(8 * b);
  A[i] ^= lane;
}
keccakF(A, 24);
let expectedCommitment = '';
for (let i = 24; i >= 0; i--) expectedCommitment += be(A[i]).padStart(16, '0');

const locking =
  'OP_DROP '
  + `${ROUND_DEFINE_ASM} <0x${aTo(CHAIN_STEP_ASM)}> <3> OP_DEFINE `
  + 'OP_TOALTSTACK '
  + `${zeros25} `
  + 'OP_FROMALTSTACK '
  + '<3> OP_INVOKE '
  + COMBINE_STATE_ASM
  + ` <0x${expectedCommitment}> OP_EQUAL`;
const padHex = '00'.repeat(3200);
const unlocking = `<0x${blockHex}> <0x${padHex}>`;

const r = run(unlocking, locking);
if (r.error) { console.log('FAIL error:', r.error); process.exit(1); }
console.log(r.ok ? 'CHAIN STEP OK' : 'CHAIN STEP FAIL', 'stack=', r.stack.slice(0, 2));
console.log('step bytes', binToHex(asm(CHAIN_STEP_ASM)).length / 2);
