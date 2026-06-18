// Optimized keccak-f: state = 25 separate 8-byte lane items (no blob copies). lane i at depth i.
import { RC, R } from './keccak.mjs';
export const be = (v) => v.toString(16).padStart(16, '0');
const ALLONES = 'ffffffffffffffff';
const piSrc = new Array(25);
for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) piSrc[y + 5*((2*x+3*y)%5)] = { x, y, rot: R[x][y] };

class Emit {
  constructor() { this.ops = []; this.size = 0; }
  raw(s, d) { this.ops.push(s); this.size += d; }
  pickAbs(ai) { this.raw(`<${this.size - 1 - ai}> OP_PICK`, 1); }
  xor() { this.raw('OP_XOR', -1); }
  and() { this.raw('OP_AND', -1); }
  not() { this.raw(`<0x${ALLONES}> OP_XOR`, 0); }
  rotl(k) { if (k % 64 === 0) return; this.raw(`OP_DUP <${k}> OP_LSHIFTBIN OP_SWAP <${64-k}> OP_RSHIFTBIN OP_OR`, 0); }
}

// theta, rho, pi, chi (no iota). In/out: 25 lane items, lane i at depth i. Net 0.
function emitRoundBody25(e) {
  const base = e.size - 25;
  const L = (i) => base + (24 - i);
  const C = [], D = [], B = [];
  for (let x = 0; x < 5; x++) { e.pickAbs(L(x)); for (let y = 1; y < 5; y++) { e.pickAbs(L(x+5*y)); e.xor(); } C[x] = e.size-1; }
  for (let x = 0; x < 5; x++) { e.pickAbs(C[(x+4)%5]); e.pickAbs(C[(x+1)%5]); e.rotl(1); e.xor(); D[x] = e.size-1; }
  for (let p = 0; p < 25; p++) { const { x, y, rot } = piSrc[p]; e.pickAbs(L(x+5*y)); e.pickAbs(D[x]); e.xor(); e.rotl(rot); B[p] = e.size-1; }
  for (let i = 24; i >= 0; i--) { const x = i%5, y = (i-x)/5;
    e.pickAbs(B[x+5*y]); e.pickAbs(B[((x+1)%5)+5*y]); e.not(); e.pickAbs(B[((x+2)%5)+5*y]); e.and(); e.xor(); }
  for (let k = 0; k < 60; k++) e.raw('<25> OP_ROLL OP_DROP', -1);
}

// 24-round permutation via OP_DEFINE. In/out: 25 lane items (lane0 on top). iota inline per round.
export function genPermute25(assemble, fnId = 2, rounds = 24) {
  const body = new Emit(); body.size = 25; emitRoundBody25(body);
  const bodyHex = assemble(body.ops.join(' '));
  const e = new Emit(); e.size = 25;
  e.raw(`<0x${bodyHex}> <${fnId}> OP_DEFINE`, 0);
  for (let r = 0; r < rounds; r++) { e.raw(`<${fnId}> OP_INVOKE`, 0); e.raw(`<0x${be(RC[r])}> OP_XOR`, 0); }
  return e.ops.join(' ');
}

// Absorb a 32-byte preimage into 25 lane items (lane0 on top). Pre: [msg32]. Post: 25 items.
export function genKeccak256x32v2(assemble) {
  const e = new Emit(); e.size = 1;
  // stash msg, push lanes 24..4 (constants), restore msg, reverse+split into lanes 3..0 (lane0 top)
  e.raw('OP_TOALTSTACK', -1);
  for (let i = 24; i >= 4; i--) e.raw(`<0x${i===16?'8000000000000000':(i===4?'0000000000000001':'0000000000000000')}>`, 1);
  e.raw('OP_FROMALTSTACK', 1);
  e.raw('OP_REVERSEBYTES <8> OP_SPLIT <8> OP_SPLIT <8> OP_SPLIT', 3); // [l3,l2,l1,l0] l0 top
  // permutation (lane0 on top throughout)
  e.raw(genPermute25(assemble), 0);
  // squeeze: hash = rev(l0)|rev(l1)|rev(l2)|rev(l3); drop lanes 4..24
  e.raw('OP_REVERSEBYTES', 0);
  e.raw('OP_SWAP OP_REVERSEBYTES OP_CAT', -1);
  e.raw('OP_SWAP OP_REVERSEBYTES OP_CAT', -1);
  e.raw('OP_SWAP OP_REVERSEBYTES OP_CAT', -1);
  for (let k = 0; k < 21; k++) e.raw('OP_NIP', -1);
  return e.ops.join(' ');
}
