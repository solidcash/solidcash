// Script generator for keccak-f[1600]. State = one 200-byte blob (25 lanes x 8 bytes, BIG-endian
// so (x<<k)|(x>>(64-k)) is a correct 64-bit ROTL). Emits CashAssembly. Stack model tracked in JS.
import { RC, R } from './keccak.mjs';

const be = (v) => v.toString(16).padStart(16, '0'); // BigInt lane -> 8-byte big-endian hex
const ALLONES = 'ffffffffffffffff';

// inverse-pi: for output position p (=x+5y indexing of B), which source (x,y) maps here.
// B[y + 5*((2x+3y)%5)] = rot(A[x+5y]). We need, per p, the (x,y,rot).
const piSrc = new Array(25);
for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
  piSrc[y + 5 * ((2*x + 3*y) % 5)] = { x, y, rot: R[x][y] };
}

class Emit {
  constructor() { this.ops = []; this.size = 0; }              // size = items on stack
  raw(s, delta) { this.ops.push(s); this.size += delta; }
  pushHex(h) { this.raw(`<0x${h}>`, 1); }
  pushInt(n) { this.raw(`<${n}>`, 1); }
  // copy lane i (8 bytes) of the blob whose bottom-index is `base`, onto the top.
  pickLane(base, i) {
    const depth = this.size - 1 - base;
    this.raw(`<${depth}> OP_PICK`, 1);                          // copy whole blob to top
    if (i > 0) this.raw(`<${8*i}> OP_SPLIT OP_NIP`, 0);         // drop leading 8i bytes
    this.raw('<8> OP_SPLIT OP_DROP', 0);                        // keep first 8
  }
  xor() { this.raw('OP_XOR', -1); }
  and() { this.raw('OP_AND', -1); }
  or() { this.raw('OP_OR', -1); }
  not() { this.raw(`<0x${ALLONES}> OP_XOR`, 0); }              // ~x = x ^ 0xff..ff
  rotl(k) { if (k % 64 === 0) return; this.raw(`OP_DUP <${k}> OP_LSHIFTBIN OP_SWAP <${64-k}> OP_RSHIFTBIN OP_OR`, 0); }
  cat() { this.raw('OP_CAT', -1); }
  // After computing lane[0..n-1] pushed in order, they were CAT'd progressively; helper below builds.
  buildBlob(n, computeLaneI) {                                  // leaves one n*8-byte blob on top
    for (let i = 0; i < n; i++) { computeLaneI(i); if (i > 0) this.cat(); }
  }
}

// Iota: state lane0 ^= RC[round]. Pre/post: [state] on top (net 0).
function emitIota(e, round) {
  e.raw('<8> OP_SPLIT', 1);            // [lane0, rest]
  e.raw('OP_SWAP', 0);                 // [rest, lane0]
  e.pushHex(be(RC[round]));            // [rest, lane0, RC]
  e.xor();                             // [rest, lane0^RC]
  e.raw('OP_SWAP OP_CAT', -1);         // [(lane0^RC)|rest]
}

// Round body (theta, rho, pi, chi) WITHOUT iota. Pre: [S] state blob. Post: [state'] (S removed).
function emitRoundBody(e) {
  const S = e.size - 1;                                         // bottom-index of S
  // C[x] = XOR of column x lanes ; build C blob (5 lanes) on top
  e.buildBlob(5, (x) => {
    e.pickLane(S, x); for (let y = 1; y < 5; y++) { e.pickLane(S, x + 5*y); e.xor(); }
  });
  const C = e.size - 1;
  // D[x] = C[(x+4)%5] ^ ROTL(C[(x+1)%5],1) ; build D blob on top
  e.buildBlob(5, (x) => {
    e.pickLane(C, (x+4)%5); e.pickLane(C, (x+1)%5); e.rotl(1); e.xor();
  });
  const D = e.size - 1;
  // Bstate[p] = ROTL(S[x+5y] ^ D[x], rot) ; build 25-lane blob
  e.buildBlob(25, (p) => {
    const { x, y, rot } = piSrc[p];
    e.pickLane(S, x + 5*y); e.pickLane(D, x); e.xor(); e.rotl(rot);
  });
  const B = e.size - 1;
  // A'[x+5y] = B[x+5y] ^ (~B[(x+1)%5+5y] & B[(x+2)%5+5y]) ; build 25-lane blob
  e.buildBlob(25, (p) => {
    const x = p % 5, y = (p - x) / 5;
    e.pickLane(B, x + 5*y);
    e.pickLane(B, ((x+1)%5) + 5*y); e.not();
    e.pickLane(B, ((x+2)%5) + 5*y); e.and();
    e.xor();
  });
  // stack: [S, C, D, B, A']. Remove intermediates + S, leaving [A'] (each removes the item below top).
  e.raw('<1> OP_ROLL OP_DROP', -1);  // drop B
  e.raw('<1> OP_ROLL OP_DROP', -1);  // drop D
  e.raw('<1> OP_ROLL OP_DROP', -1);  // drop C
  e.raw('<1> OP_ROLL OP_DROP', -1);  // drop S  -> leaves [A']
}

// Unrolled keccak-f (for tests; exceeds the 10KB script limit beyond ~4 rounds).
export function genKeccakF(rounds = 24) {
  const e = new Emit();
  e.size = 1;
  for (let r = 0; r < rounds; r++) { emitRoundBody(e); emitIota(e, r); }
  return e.ops.join(' ');
}

// keccak-f using OP_DEFINE: the round body is defined once and invoked per round (fits 10KB).
// `assemble` converts the body ASM to bytecode hex (so it can be pushed for OP_DEFINE).
export function genKeccakFDefined(assemble, rounds = 24, fnId = 1) {
  const body = new Emit();
  body.size = 1;
  emitRoundBody(body);
  const bodyHex = assemble(body.ops.join(' '));
  const e = new Emit();
  e.size = 1;
  e.raw(`<0x${bodyHex}> <${fnId}> OP_DEFINE`, 0);               // define round body
  for (let r = 0; r < rounds; r++) {
    e.raw(`<${fnId}> OP_INVOKE`, 0);                            // run theta..chi
    emitIota(e, r);
  }
  return e.ops.join(' ');
}
// Reverse each 8-byte lane of an n*8-byte value on top, in place (concatenated). Pre: [V]. Post: [V'].
function emitReverseEachLane(e, n) {
  e.raw('<8> OP_SPLIT OP_SWAP OP_REVERSEBYTES OP_SWAP', 1);     // [rev(l0), rest]
  for (let i = 1; i < n; i++) {
    e.raw('<8> OP_SPLIT OP_SWAP OP_REVERSEBYTES', 1);           // [acc, rest', rev(li)]
    e.raw('OP_ROT OP_SWAP OP_CAT OP_SWAP', -1);                 // [acc|rev(li), rest']
  }
  e.raw('OP_DROP', -1);                                         // drop trailing empty rest
}

// Absorb a fixed 32-byte message into the initial (zero) state for a single 136-byte block.
// Pre: [msg32]. Post: [state200]. (msg words reversed to BE lanes; Ethereum pad 0x01..0x80.)
function emitAbsorb32(e) {
  emitReverseEachLane(e, 4);                                    // 4 message lanes (BE)
  const tail = '0000000000000001' + '00'.repeat(88) + '8000000000000000' + '00'.repeat(64);
  e.pushHex(tail);                                              // lanes 4..24 (pad + capacity)
  e.cat();                                                      // [state200]
}

// keccak256 of a 32-byte preimage: absorb -> permute -> squeeze. Pre: [msg32]. Post: [hash32].
export function genKeccak256x32(assemble) {
  const e = new Emit();
  e.size = 1;
  emitAbsorb32(e);
  e.raw(genKeccakFDefined(assemble), 0);
  emitSqueeze(e);
  return e.ops.join(' ');
}

// Squeeze: output = first 32 bytes = lanes 0..3. Lanes are stored big-endian; keccak emits them
// little-endian, so reverse each lane. Pre: [state]. Post: [hash32].
function emitSqueeze(e) {
  const S = e.size - 1;
  for (let i = 0; i < 4; i++) { e.pickLane(S, i); e.raw('OP_REVERSEBYTES', 0); if (i > 0) e.cat(); }
  e.raw('OP_NIP', -1);                                          // drop the state, leave [hash]
}

// Full hash from an already-absorbed 200-byte state blob: keccak-f then squeeze. (single-block path)
export function genHashFromState(assemble) {
  const e = new Emit();
  e.size = 1;
  // inline the defined permutation
  e.raw(genKeccakFDefined(assemble), 0);
  emitSqueeze(e);
  return e.ops.join(' ');
}
export { be };
