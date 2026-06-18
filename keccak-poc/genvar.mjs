// Variable-length keccak256 (arbitrary input, multi-block) on 25 separate lane items.
// Self-contained (does not modify the original gen.mjs/gen25.mjs). Reuses the validated round logic.
import { RC, R } from './keccak.mjs';
export const be = (v) => v.toString(16).padStart(16, '0');
const ALLONES = 'ffffffffffffffff';
const ZERO = '0000000000000000';
const piSrc = new Array(25);
for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) piSrc[y + 5*((2*x+3*y)%5)] = { x, y, rot: R[x][y] };

class Emit {
  constructor() { this.ops = []; this.size = 0; }
  raw(s, d) { this.ops.push(s); this.size += d; }
  pushHex(h) { this.raw(`<0x${h}>`, 1); }
  pickAbs(ai) { this.raw(`<${this.size - 1 - ai}> OP_PICK`, 1); }
  word(i) { if (i > 0) this.raw(`<${8*i}> OP_SPLIT OP_NIP`, 0); this.raw('<8> OP_SPLIT OP_DROP', 0); } // top blob -> word i
  xor() { this.raw('OP_XOR', -1); }
  and() { this.raw('OP_AND', -1); }
  not() { this.raw(`<0x${ALLONES}> OP_XOR`, 0); }
  rotl(k) { if (k % 64 === 0) return; this.raw(`OP_DUP <${k}> OP_LSHIFTBIN OP_SWAP <${64-k}> OP_RSHIFTBIN OP_OR`, 0); }
}
// reverse each of n 8-byte lanes of the top item, in place (net 0).
function reverseEachLane(e, n) {
  e.raw('<8> OP_SPLIT OP_SWAP OP_REVERSEBYTES OP_SWAP', 1);
  for (let i = 1; i < n; i++) { e.raw('<8> OP_SPLIT OP_SWAP OP_REVERSEBYTES', 1); e.raw('OP_ROT OP_SWAP OP_CAT OP_SWAP', -1); }
  e.raw('OP_DROP', -1);
}
// round body (theta,rho,pi,chi). in/out 25 lane items (lane i at depth i). net 0.
function emitRoundBody25(e) {
  const base = e.size - 25, L = (i) => base + (24 - i), C = [], D = [], B = [];
  for (let x = 0; x < 5; x++) { e.pickAbs(L(x)); for (let y = 1; y < 5; y++) { e.pickAbs(L(x+5*y)); e.xor(); } C[x] = e.size-1; }
  for (let x = 0; x < 5; x++) { e.pickAbs(C[(x+4)%5]); e.pickAbs(C[(x+1)%5]); e.rotl(1); e.xor(); D[x] = e.size-1; }
  for (let p = 0; p < 25; p++) { const { x, y, rot } = piSrc[p]; e.pickAbs(L(x+5*y)); e.pickAbs(D[x]); e.xor(); e.rotl(rot); B[p] = e.size-1; }
  for (let i = 24; i >= 0; i--) { const x = i%5, y = (i-x)/5;
    e.pickAbs(B[x+5*y]); e.pickAbs(B[((x+1)%5)+5*y]); e.not(); e.pickAbs(B[((x+2)%5)+5*y]); e.and(); e.xor(); }
  for (let k = 0; k < 60; k++) e.raw('<25> OP_ROLL OP_DROP', -1);
}
// absorb a 136-byte block (on top) into the 25 lane items below it. out: 25 new lane items.
function emitAbsorbBlock25(e) {
  reverseEachLane(e, 17);                       // block -> per-word-reversed (BE), still on top
  const base = e.size - 26, L = (i) => base + (24 - i), blk = base + 25;
  for (let i = 24; i >= 0; i--) {               // build new lane i (lane0 ends on top)
    e.pickAbs(L(i));
    if (i < 17) { e.pickAbs(blk); e.word(i); e.xor(); }   // ^ rev(word_i) for rate lanes
  }
  for (let k = 0; k < 26; k++) e.raw('<25> OP_ROLL OP_DROP', -1);  // drop old 25 + block'
}
// keccak256 of an arbitrary-length message on top. in: [msg]. out: [hash32].
export function genKeccak256var(assemble) {
  const e = new Emit(); e.size = 1;
  // pad: msg || 0x01 || zeros(Z) to a multiple of 136, then last byte |= 0x80
  e.pushHex('01'); e.raw('OP_CAT', -1);                         // msg||0x01
  e.raw('OP_SIZE <136> OP_MOD <136> OP_SWAP OP_SUB <136> OP_MOD', 1);  // Z on top
  e.raw('<0> OP_SWAP OP_NUM2BIN OP_CAT', -1);                   // append Z zero bytes -> padded
  e.raw('OP_SIZE <1> OP_SUB OP_SPLIT <0x80> OP_OR OP_CAT', 0);  // last byte |= 0x80
  // state = 25 zero lane items, pushed UNDER the padded message
  e.raw('OP_TOALTSTACK', -1);
  for (let i = 0; i < 25; i++) e.pushHex(ZERO);
  e.raw('OP_FROMALTSTACK', 1);                                  // [25 zeros, padded]
  // define round body once
  const body = new Emit(); body.size = 25; emitRoundBody25(body);
  e.raw(`<0x${assemble(body.ops.join(' '))}> <2> OP_DEFINE`, 0);
  // block loop: absorb + permute per 136-byte block, until the padded message is consumed
  e.raw('OP_BEGIN', 0);
  e.raw('<136> OP_SPLIT', 1);                                   // [25 state, block, rest]
  e.raw('OP_TOALTSTACK', -1);                                   // stash rest
  emitAbsorbBlock25(e);                                         // [25 new state]
  for (let r = 0; r < 24; r++) { e.raw('<2> OP_INVOKE', 0); e.raw(`<0x${be(RC[r])}> OP_XOR`, 0); }
  e.raw('OP_FROMALTSTACK', 1);                                  // [25 permuted, rest]
  e.raw('OP_SIZE <0> OP_NUMEQUAL', 1);                          // isEmpty(rest)
  e.raw('OP_UNTIL', -1);
  e.raw('OP_DROP', -1);                                         // drop empty rest -> [25 state]
  // squeeze: hash = rev(lane0)|rev(lane1)|rev(lane2)|rev(lane3); drop lanes 4..24
  e.raw('OP_REVERSEBYTES', 0);
  e.raw('OP_SWAP OP_REVERSEBYTES OP_CAT OP_SWAP OP_REVERSEBYTES OP_CAT OP_SWAP OP_REVERSEBYTES OP_CAT', -3);
  for (let k = 0; k < 21; k++) e.raw('OP_NIP', -1);
  return e.ops.join(' ');
}
