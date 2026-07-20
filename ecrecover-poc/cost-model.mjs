// ecrecover pure-script cost model.
// Implements the on-chain recovery algorithm (GLV endomorphism + 4-way Shamir,
// Jacobian a=0 formulas, witnessed inverses/sqrt) in bigint, validates the result
// against @noble/curves, and applies the SOURCE-VERIFIED BCH op-cost model:
//   OPCODE_COST=100; MUL/MOD/DIV quadraticOpCost = len(a)*len(b); result push 2x len;
//   per-input budget = (scriptSig+41)*800, scriptSig<=10000 -> ~8.03M.
// Goal: a real op-cost number for the "1 input per verify" target, not an estimate.
//
// run: node ecrecover-poc/cost-model.mjs

import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';

const P = 2n ** 256n - 2n ** 32n - 977n;
const N = secp256k1.CURVE.n;
const Gx = secp256k1.CURVE.Gx;
const Gy = secp256k1.CURVE.Gy;
const BETA = secp256k1.CURVE.endo.beta;
// secp256k1 GLV eigenvalue (phi(P) = LAMBDA*P). Verified against noble below.
const LAMBDA = 0x5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72n;
const BUDGET_1INPUT = (10000 + 41) * 800; // 8,032,800

const mod = (a, m) => ((a % m) + m) % m;
const modP = (a) => mod(a, P);
const modN = (a) => mod(a, N);

// ---- BCH minimal sign-magnitude byte length ----
function bchLen(x) {
  if (x < 0n) x = -x;
  if (x === 0n) return 0;
  let hex = x.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  let bytes = hex.length / 2;
  if (parseInt(hex.slice(0, 2), 16) & 0x80) bytes += 1; // sign byte
  return bytes;
}

// ---- cost model ----
let COST = { mul: 0, reduce: 0, add: 0, other: 0, stack: 0 };
let CNT = { fmul: 0, fadd: 0, fsub: 0, dbl: 0, madd: 0 };
let REDUCE = 'fast';      // 'fast' | 'general'
let STACK_PER_OP = 0;     // extra base-100 stack-routing ops charged per field op

const C_FOLD = 2n ** 32n + 977n; // 0x1000003d1, the secp256k1 reduction constant

function costOpMul(a, b) { return 100 + bchLen(a) * bchLen(b) + 2 * bchLen(a * b); }

function costReduceGeneral(prod) {
  return 100 + bchLen(prod) * bchLen(P) + 2 * bchLen(mod(prod, P));
}

// Fast reduction for p = 2^256 - 2^32 - 977, modeled op-by-op on the real product.
function costReduceFast(prod) {
  let c = 0;
  const MASK = (1n << 256n) - 1n;
  let t = prod;
  for (let fold = 0; fold < 2; fold++) {
    const hi = t >> 256n, lo = t & MASK;
    c += 100 + bchLen(lo) + bchLen(hi);            // OP_SPLIT (push two halves)
    const hc = hi * C_FOLD;
    c += 100 + bchLen(hi) * bchLen(C_FOLD) + 2 * bchLen(hc); // OP_MUL hi*C
    t = lo + hc;
    c += 100 + 2 * bchLen(t);                      // OP_ADD
  }
  // final conditional subtract of p (compare + IF + SUB)
  c += bchLen(P) + 100 + 100 + 100 + 2 * bchLen(P);
  return c;
}

function fmul(a, b) {
  CNT.fmul++;
  COST.mul += costOpMul(a, b);
  COST.reduce += REDUCE === 'fast' ? costReduceFast(a * b) : costReduceGeneral(a * b);
  COST.stack += STACK_PER_OP * 100;
  return modP(a * b);
}
const fsqr = (a) => fmul(a, a);
function fadd(a, b) { CNT.fadd++; const r = a + b; COST.add += 100 + 2 * bchLen(r % P); COST.stack += STACK_PER_OP * 100; return modP(r); }
function fsub(a, b) { CNT.fsub++; const r = a - b; COST.add += 100 + 2 * bchLen(modP(r)); COST.stack += STACK_PER_OP * 100; return modP(r); }

// mod-n multiply (few of these; general reduction)
function muln(a, b) { COST.mul += costOpMul(a, b); COST.reduce += 100 + bchLen(a * b) * bchLen(N) + 2 * bchLen(mod(a * b, N)); return modN(a * b); }

// ---- Jacobian point ops (a=0), with op counting ----
// dbl-2009-l: 2M + 5S
function jdbl(Pt) {
  if (Pt === null) return null;
  CNT.dbl++;
  const [X1, Y1, Z1] = Pt;
  const A = fsqr(X1), B = fsqr(Y1), C = fsqr(B);
  let t = fadd(X1, B); t = fsqr(t); t = fsub(t, A); t = fsub(t, C);
  const D = fadd(t, t);
  const E = fadd(fadd(A, A), A);
  const F = fsqr(E);
  const X3 = fsub(F, fadd(D, D));
  let C8 = fadd(C, C); C8 = fadd(C8, C8); C8 = fadd(C8, C8);
  const Y3 = fsub(fmul(E, fsub(D, X3)), C8);
  const Z3 = fmul(fadd(Y1, Y1), Z1);
  return [X3, Y3, Z3];
}

// madd-2007-bl: 7M + 4S, add affine (X2,Y2) to Jacobian Pt
function jaddMixed(Pt, X2, Y2) {
  if (Pt === null) return [X2, Y2, 1n];
  CNT.madd++;
  const [X1, Y1, Z1] = Pt;
  const Z1Z1 = fsqr(Z1);
  const U2 = fmul(X2, Z1Z1);
  const S2 = fmul(fmul(Y2, Z1), Z1Z1);
  const H = fsub(U2, X1);
  const HH = fsqr(H);
  let I = fadd(HH, HH); I = fadd(I, I);
  const J = fmul(H, I);
  const rr = fadd(fsub(S2, Y1), fsub(S2, Y1));
  const V = fmul(X1, I);
  const X3 = fsub(fsub(fsqr(rr), J), fadd(V, V));
  const Y1J = fmul(Y1, J);
  const Y3 = fsub(fmul(rr, fsub(V, X3)), fadd(Y1J, Y1J));
  const Z3 = fsub(fsub(fsqr(fadd(Z1, H)), Z1Z1), HH);
  return [X3, Y3, Z3];
}

// ---- GLV scalar split (from noble secp256k1.ts source constants) ----
function splitScalar(k) {
  const a1 = 0x3086d221a7d46bcde86c90e49284eb15n;
  const b1 = -0xe4437ed6010e88286f547fa90abfe4c3n;
  const a2 = 0x114ca50f7a8e2f3f657c1108d9d44cfd8n;
  const b2 = a1;
  const POW = 1n << 128n;
  const divNearest = (a, b) => (a + b / 2n) / b;
  const c1 = divNearest(b2 * k, N);
  const c2 = divNearest(-b1 * k, N);
  let k1 = modN(k - c1 * a1 - c2 * a2);
  let k2 = modN(-c1 * b1 - c2 * b2);
  const k1neg = k1 > POW, k2neg = k2 > POW;
  if (k1neg) k1 = N - k1;
  if (k2neg) k2 = N - k2;
  return { k1neg, k1, k2neg, k2 };
}

// convert Jacobian to affine using a witnessed Zinv (verify Z*Zinv==1)
function toAffineWitnessed(Pt) {
  const [X, Y, Z] = Pt;
  const Zinv = modP(secp256k1.CURVE.Fp.inv(Z)); // computed off-chain (witness)
  fmul(Z, Zinv); // on-chain verify Z*Zinv==1 (cost of one fmul)
  const Zinv2 = fsqr(Zinv);
  const x = fmul(X, Zinv2);
  const y = fmul(Y, fmul(Zinv2, Zinv));
  return [x, y];
}

// ---- full recovery with counting ----
function recover(hHex, r, s, rec) {
  const z = BigInt('0x' + hHex);
  // input validation (cheap comparisons, ~a few OPCODE_COST each)
  COST.other += 8 * 100;

  // R = (r, Ry); Ry witnessed, verify Ry^2 == r^3 + 7
  const Fp = secp256k1.CURVE.Fp;
  const rhs = modP(modP(r * r) * r + 7n);
  let Ry = Fp.sqrt(rhs);
  if ((Ry & 1n) !== BigInt(rec & 1)) Ry = modP(P - Ry); // parity per recovery id
  fmul(r, r); fmul(modP(r * r), r); fsqr(Ry);           // on-chain verify cost
  COST.other += 3 * 100;                                 // +7, parity, compare

  // rinv witnessed, verify r*rinv==1 mod n
  const rinv = modInvN(r);
  muln(r, rinv);
  const u1 = modN(-z * rinv);
  const u2 = modN(s * rinv);
  muln(modN(z), rinv); muln(s, rinv); // u1,u2 compute

  // GLV split u1,u2 (witnessed decomposition, verify u == k1 +/- k2*lambda mod n)
  const s1 = splitScalar(u1), s2 = splitScalar(u2);
  muln(s1.k2, LAMBDA); muln(s2.k2, LAMBDA); // verification muls
  COST.other += 6 * 100;

  // base points (affine), sign-adjusted; phi(P) = (beta*x, y)
  const neg = (Pt, isNeg) => isNeg ? [Pt[0], modP(P - Pt[1])] : Pt;
  const G = [Gx, Gy];
  const phiG = [modP(BETA * Gx), Gy];
  const R = [r, Ry];
  const phiR = [modP(BETA * r), Ry];      fmul(BETA, r); // phiR needs 1 on-chain mul (phiG is constant)
  const bases = [neg(G, s1.k1neg), neg(phiG, s1.k2neg), neg(R, s2.k1neg), neg(phiR, s2.k2neg)];
  const scalars = [s1.k1, s1.k2, s2.k1, s2.k2];

  // 4-way Shamir table[1..15] (affine). Built in Jacobian then normalized.
  const table = new Array(16).fill(null);
  for (let m = 1; m < 16; m++) {
    let acc = null;
    for (let i = 0; i < 4; i++) if (m & (1 << i)) acc = jaddMixed(acc, bases[i][0], bases[i][1]);
    table[m] = acc; // Jacobian (single base points are affine-lifted with Z=1)
  }
  // batch-normalize the (up to) 11 composite entries to affine (witnessed inverse)
  const affTable = table.map((Pt) => {
    if (Pt === null) return null;
    if (Pt[2] === 1n) return [Pt[0], Pt[1]];
    return toAffineWitnessed(Pt);
  });

  // main loop: 128 iterations, double + conditional mixed-add
  let acc = null;
  for (let bit = 127; bit >= 0; bit--) {
    acc = jdbl(acc);
    let mask = 0;
    for (let i = 0; i < 4; i++) if ((scalars[i] >> BigInt(bit)) & 1n) mask |= (1 << i);
    if (mask) { const e = affTable[mask]; acc = e ? jaddMixed(acc, e[0], e[1]) : acc; }
  }

  const [qx, qy] = toAffineWitnessed(acc);
  return [qx, qy];
}

// modular inverse mod n (off-chain witness computation)
function modInvN(a) { return modPow(a, N - 2n, N); }
function modPow(b, e, m) { b = mod(b, m); let r = 1n; while (e > 0n) { if (e & 1n) r = mod(r * b, m); b = mod(b * b, m); e >>= 1n; } return r; }

// ---- keccak address cost (in-script blob): one permutation over 64-byte input ----
// Keccak-f[1600]: 24 rounds. Per round ~ (theta 5 xor-chains + rho/pi + chi 5 + iota)
// implemented on 8-byte lanes with OP_AND/OP_XOR/OP_LSHIFT. We estimate op-cost from
// the round op count; refined once the real keccak blob op-cost is measured.
function keccakAddressCost() {
  const OPS_PER_ROUND = 200; // xor/and/rot/split/cat ops per round (rough, lane-wise)
  const rounds = 24;
  const avgOpCost = 100 + 2 * 8; // base + small (8-byte lane) push
  return rounds * OPS_PER_ROUND * avgOpCost;
}

// ================= run =================
function run(hHex, r, s, rec, expectedAddr) {
  COST = { mul: 0, reduce: 0, add: 0, other: 0, stack: 0 };
  CNT = { fmul: 0, fadd: 0, fsub: 0, dbl: 0, madd: 0 };
  const [qx, qy] = recover(hHex, r, s, rec);

  // oracle check
  const sig = new secp256k1.Signature(r, s, rec);
  const Q = sig.recoverPublicKey(hHex);
  const ok = Q.x === qx && Q.y === qy;

  // address = keccak256(Qx||Qy)[12:]
  const buf = new Uint8Array(64);
  const put = (v, off) => { const h = v.toString(16).padStart(64, '0'); for (let i = 0; i < 32; i++) buf[off + i] = parseInt(h.slice(i * 2, i * 2 + 2), 16); };
  put(qx, 0); put(qy, 32);
  const addr = '0x' + Buffer.from(keccak_256(buf).slice(12)).toString('hex');
  const addrOk = expectedAddr ? addr.toLowerCase() === expectedAddr.toLowerCase() : null;

  return { qx, qy, ok, addr, addrOk };
}

// verify LAMBDA/BETA consistency: phi(G) should equal LAMBDA*G
{
  const phiGx = modP(BETA * Gx);
  const lg = secp256k1.ProjectivePoint.BASE.multiply(LAMBDA).toAffine();
  console.log('endo check phi(G).x==LAMBDA*G.x:', lg.x === phiGx, '\n');
}

const gold = {
  h: '18c547e4f7b0f325ad1e56f57e26c745b09a3e503d86e00e5255ff7f715d3d1c',
  r: 0x73b1693892219d736caba55bdb67216e485557ea6b6af75f37096c9aa6a5a75fn,
  s: 0xeeb940b1d03b21e36b0e47e79769f095fe2ab855bd91e3a38756b7d75a9c4549n,
  rec: 1,
  addr: '0xa94f5374fce5edbc8e2a8697c15331677e6ebf0b',
};

// correctness first
REDUCE = 'fast'; STACK_PER_OP = 0;
const res = run(gold.h, gold.r, gold.s, gold.rec, gold.addr);
console.log('=== correctness ===');
console.log('recovered == noble:', res.ok);
console.log('address:', res.addr, '== golden:', res.addrOk);
console.log('field-op counts:', CNT);
console.log('  total fmul (256-bit modmuls):', CNT.fmul);
console.log('  total fadd+fsub           :', CNT.fadd + CNT.fsub);
console.log('  point doublings / madds   :', CNT.dbl, '/', CNT.madd);

const kecc = keccakAddressCost();

function report(reduce) {
  REDUCE = reduce;
  for (const so of [0, 2, 4, 6]) {
    STACK_PER_OP = so;
    run(gold.h, gold.r, gold.s, gold.rec);
    const ec = COST.mul + COST.reduce + COST.add + COST.other + COST.stack;
    const total = ec + kecc;
    const inputs = (total / BUDGET_1INPUT);
    console.log(
      `reduce=${reduce.padEnd(7)} stack/op=${so}  ` +
      `EC=${(ec / 1e6).toFixed(2)}M  +keccak=${(kecc / 1e6).toFixed(2)}M  ` +
      `TOTAL=${(total / 1e6).toFixed(2)}M  inputs=${inputs.toFixed(2)}`
    );
  }
}

console.log('\n=== op-cost (budget/input = ' + (BUDGET_1INPUT / 1e6).toFixed(2) + 'M) ===');
console.log('breakdown (fast reduce, stack/op=0): mul=' + (COST.mul / 1e6).toFixed(2) + 'M reduce=' + (COST.reduce / 1e6).toFixed(2) + 'M add=' + (COST.add / 1e6).toFixed(2) + 'M');
report('fast');
console.log();
report('general');
