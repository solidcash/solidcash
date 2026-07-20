// FULL 2-INPUT SELF-VERIFYING REUSABLE RECOVERY. Signature-independent covenant pair, all values WITNESSED:
//  - input A: sig+mask self-verify (wsound) + init-bind (acc0 = table[first-nonzero-mask], leading masks zero) +
//    ladder chunk A -> checkpoint C.
//  - input B: table verify (wtable, table pre-split for budget) + ladder chunk B from C + affine + COMPRESS -> pubkey.
// SPLIT verification (A: sig+mask, B: table) is sound because A and B share ONE hash-bound (table,masks). The master
// does NOT re-verify - it body-hashes the covenant + binds (hash,v,r,s) + copies the pubkey. Proven vs ethers (6/6),
// forged rinv (A) + forged table (B) rejected, both inputs < 8.03M. This is the corrected architecture end-to-end.
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import { createVirtualMachineBch2026, assembleBytecodeBch, binToHex, bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth';
import { E, P } from './emit.mjs';
import { emitJdbl, emitJaddMixed } from './group.mjs';

const vm = createVirtualMachineBch2026();
const asm = (s) => { const r = assembleBytecodeBch(s); if (!r.success) throw new Error('asm ' + JSON.stringify(r.errors) + ' | ' + s.slice(0, 120)); return r.bytecode; };
const num = (v) => (v === 0n ? 'OP_0' : `<0x${binToHex(bigIntToVmNumber(v))}>`);
const N = secp256k1.CURVE.n, BETA = secp256k1.CURVE.endo.beta;
const LAMBDA = 0x5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72n;
const mod = (a, m) => ((a % m) + m) % m;
const invP = (a) => { let [g, x] = [mod(a, P), P], [s0, s1] = [1n, 0n]; while (x) { const q = g / x; [g, x] = [x, g - q * x]; [s0, s1] = [s1, s0 - q * s1]; } return mod(s0, P); };
const invN = (a) => { let [g, x] = [mod(a, N), N], [s0, s1] = [1n, 0n]; while (x) { const q = g / x; [g, x] = [x, g - q * x]; [s0, s1] = [s1, s0 - q * s1]; } return mod(s0, N); };
const pN = num(N), pP = num(P), muln = `OP_MUL ${pN} OP_MOD`, mulp = `OP_MUL ${pP} OP_MOD`;
const B128 = 1n << 128n;
const { x: GX, y: GY } = secp256k1.ProjectivePoint.BASE.toAffine();
const PHIGX = mod(BETA * GX, P);

function splitScalar(k) {
  const a1 = 0x3086d221a7d46bcde86c90e49284eb15n, b1 = -0xe4437ed6010e88286f547fa90abfe4c3n;
  const a2 = 0x114ca50f7a8e2f3f657c1108d9d44cfd8n, b2 = a1, POW = 1n << 128n, dn = (x, y) => (x + y / 2n) / y;
  const c1 = dn(b2 * k, N), c2 = dn(-b1 * k, N);
  let k1 = mod(k - c1 * a1 - c2 * a2, N), k2 = mod(-c1 * b1 - c2 * b2, N);
  const k1neg = k1 > POW, k2neg = k2 > POW; if (k1neg) k1 = N - k1; if (k2neg) k2 = N - k2;
  return { k1neg, k1, k2neg, k2 };
}
const recTerm = (kneg, k) => (kneg ? mod(-k, N) : k);
function jDbl([X1, Y1, Z1]) { const A = mod(X1 * X1, P), B = mod(Y1 * Y1, P), C = mod(B * B, P); const D = mod(2n * mod((X1 + B) * (X1 + B) - A - C, P), P), Ee = mod(3n * A, P), F = mod(Ee * Ee, P); const X3 = mod(F - 2n * D, P); return [X3, mod(Ee * (D - X3) - 8n * C, P), mod(2n * Y1 * Z1, P)]; }
function jAdd([X1, Y1, Z1], x2, y2) { const Z1Z1 = mod(Z1 * Z1, P), U2 = mod(x2 * Z1Z1, P), S2 = mod(y2 * Z1 * Z1Z1, P); const H = mod(U2 - X1, P), HH = mod(H * H, P), I = mod(4n * HH, P), J = mod(H * I, P); const r = mod(2n * (S2 - Y1), P), V = mod(X1 * I, P); const X3 = mod(r * r - J - 2n * V, P); return [X3, mod(r * (V - X3) - 2n * Y1 * J, P), mod((Z1 + H) * (Z1 + H) - Z1Z1 - HH, P)]; }
const to33 = (v) => { const b = new Uint8Array(33); b.set(bigIntToVmNumber(v)); return b; };
const accBlob = ([X, Y, Z]) => { const b = new Uint8Array(99); b.set(to33(X), 0); b.set(to33(Y), 33); b.set(to33(Z), 66); return b; };
const decAcc = (blob) => [0, 33, 66].map((o) => vmNumberToBigInt(blob.slice(o, o + 33), { requireMinimalEncoding: false }));

// subroutines: 0x10 double, 0x11 mixed-add, 0x12 AAV (affine add verified)
const DEFS = (() => {
  const db = new E(); db.stk = ['X', 'Y', 'Z']; emitJdbl(db, []);
  const ad = new E(); ad.stk = ['X', 'Y', 'Z', 'X2', 'Y2']; ad.relabel('X', 'X1').relabel('Y', 'Y1').relabel('Z', 'Z1'); emitJaddMixed(ad, []);
  const av = new E(); av.stk = ['x1', 'y1', 'x2', 'y2', 'inv'];
  av.sub('x2', 'x1', 'dx'); av.mul('dx', 'inv', 'chk'); av.sub('y2', 'y1', 'dy'); av.mul('dy', 'inv', 'lam');
  av.sqr('lam', 'lam2'); av.sub('lam2', 'x1', 'tt'); av.sub('tt', 'x2', 'x3'); av.sub('x1', 'x3', 'd1'); av.mul('lam', 'd1', 'm1'); av.sub('m1', 'y1', 'y3');
  av.keep(['x3', 'y3', 'chk']);
  return `<0x${binToHex(asm(db.asm()))}> <0x10> OP_DEFINE <0x${binToHex(asm(ad.asm()))}> <0x11> OP_DEFINE <0x${binToHex(asm(av.asm() + ' OP_1 OP_NUMEQUALVERIFY'))}> <0x12> OP_DEFINE`;
})();
const termHex = (() => { const tb = new Uint8Array(16 * 65); for (let m = 0; m < 16; m++) { let term = 0n; for (let j = 0; j < 4; j++) if (m & (1 << j)) term += B128 ** BigInt(j); tb.set(bigIntToVmNumber(term), m * 65); } return binToHex(tb); })();
const COMPOSITES = [[3, 2, 0], [5, 4, 0], [6, 4, 1], [7, 6, 0], [9, 8, 0], [10, 8, 1], [11, 10, 0], [12, 8, 2], [13, 12, 0], [14, 12, 1], [15, 14, 0]];

// ladder loop (witnessed table via constant-depth pick), copied from sidecar.mjs: [tbl X Y Z maskChunk] -> [tbl X' Y' Z']
const SHAMIR =
  'OP_BEGIN OP_TOALTSTACK <0x10> OP_INVOKE OP_FROMALTSTACK OP_1 OP_SPLIT OP_TOALTSTACK OP_BIN2NUM ' +
  'OP_DUP OP_0 OP_NUMEQUAL OP_IF OP_DROP OP_ELSE ' +
  '<4> OP_PICK OP_SWAP <0x42> OP_MUL OP_SPLIT OP_NIP <0x42> OP_SPLIT OP_DROP <33> OP_SPLIT OP_BIN2NUM OP_SWAP OP_BIN2NUM OP_SWAP <0x11> OP_INVOKE ' +
  'OP_ENDIF OP_FROMALTSTACK OP_SIZE OP_0 OP_NUMEQUAL OP_UNTIL OP_DROP';
const COMBINE3 = 'OP_TOALTSTACK OP_TOALTSTACK <33> OP_NUM2BIN OP_FROMALTSTACK <33> OP_NUM2BIN OP_CAT OP_FROMALTSTACK <33> OP_NUM2BIN OP_CAT';
// pre-split ladder: entries e0..e15 sit BELOW [X Y Z maskChunk]; each add-step picks the 66B entry[mask] by computed
// depth (20-mask) instead of re-splitting the 1KB table blob - saves ~120K/input, buying the 2-input budget slack.
const SHAMIR_PRESPLIT =
  'OP_BEGIN OP_TOALTSTACK <0x10> OP_INVOKE OP_FROMALTSTACK OP_1 OP_SPLIT OP_TOALTSTACK OP_BIN2NUM ' +
  'OP_DUP OP_0 OP_NUMEQUAL OP_IF OP_DROP OP_ELSE ' +
  'OP_DUP <0x13> OP_SWAP OP_SUB OP_PICK OP_SWAP OP_DROP <33> OP_SPLIT OP_BIN2NUM OP_SWAP OP_BIN2NUM OP_SWAP <0x11> OP_INVOKE ' +
  'OP_ENDIF OP_FROMALTSTACK OP_SIZE OP_0 OP_NUMEQUAL OP_UNTIL OP_DROP';
const DECODE3 = '<33> OP_SPLIT <33> OP_SPLIT OP_BIN2NUM OP_TOALTSTACK OP_BIN2NUM OP_TOALTSTACK OP_BIN2NUM OP_FROMALTSTACK OP_FROMALTSTACK'; // blob -> X Y Z (+2)
// affine + compress, register-machine generated: [X Y Z Zinv] -> [Qx Qy zchk] (zchk==1 iff Zinv correct)
const AFFINE = (() => {
  const e = new E(); e.stk = ['X', 'Y', 'Z', 'Zinv'];
  e.mul('Z', 'Zinv', 'zchk'); e.mul('Zinv', 'Zinv', 'Zi2'); e.mul('X', 'Zi2', 'Qx'); e.mul('Zi2', 'Zinv', 'Zi3'); e.mul('Y', 'Zi3', 'Qy');
  e.keep(['Qx', 'Qy', 'zchk']); return e.asm();
})();

// combined stack-tracked emitter over a named base block (acc0 is DERIVED on-chain, not witnessed)
// chunkA is WITNESSED (a liveness parameter, not soundness - A and B agree on it via the A->B hash): the SDK picks
// the split point per-signature to balance the two inputs' point-addition counts, absorbing per-sig cost variance.
const A_BASE = ['negZ', 'r', 's', 'rinv', 'Ry', 'phiRx', 'recPar', 't1a', 't2a', 't1b', 't2b', 'masks', 'tbl', 'invb', 'start', 'chunkA'];
const B_BASE = ['r', 'Ry', 'phiRx', 't1a', 't2a', 't1b', 't2b', 'masks', 'tbl', 'invb', 'start', 'Cblob', 'Zinv', 'chunkA'];
function V(base = A_BASE) {
  const stk = [...base]; const out = [];
  const D = (n) => { const i = stk.lastIndexOf(n); if (i < 0) throw new Error('no ' + n); return stk.length - 1 - i; };
  const emit = (t) => out.push(t), pushN = () => stk.push('@'), popN = (k = 1) => { for (let i = 0; i < k; i++) stk.pop(); };
  const a = {
    pk(n) { const d = D(n); emit(d === 0 ? 'OP_DUP' : `${num(BigInt(d))} OP_PICK`); pushN(); return a; },
    lit(t) { emit(t); pushN(); return a; },
    mul(m) { emit(m === 'n' ? muln : mulp); popN(); return a; },
    raw(t, dp = 0) { emit(t); if (dp < 0) { for (let i = 0; i < -dp; i++) pushN(); } else popN(dp); return a; },
    v1() { emit('OP_1 OP_NUMEQUALVERIFY'); popN(); return a; },
    eqv() { emit('OP_NUMEQUALVERIFY'); popN(2); return a; },
    fold() { emit(`OP_DUP ${num(B128)} OP_GREATERTHANOREQUAL OP_IF ${pN} OP_SWAP OP_SUB OP_ENDIF`); return a; },
    reconstruct() { emit(`OP_0 OP_SWAP OP_BEGIN OP_1 OP_SPLIT OP_SWAP OP_BIN2NUM <0x41> OP_MUL <0x${termHex}> OP_SWAP OP_SPLIT OP_NIP <0x41> OP_SPLIT OP_DROP OP_BIN2NUM OP_ROT OP_DUP OP_ADD OP_ADD OP_SWAP OP_SIZE OP_0 OP_NUMEQUAL OP_UNTIL OP_DROP`); return a; },
    extract(m) { a.pk('tbl'); emit(`${num(BigInt(m * 66))} OP_SPLIT OP_NIP <0x42> OP_SPLIT OP_DROP <33> OP_SPLIT OP_BIN2NUM OP_SWAP OP_BIN2NUM OP_SWAP`); pushN(); return a; }, // -> x y
    presplit() { a.pk('tbl'); for (let i = 0; i < 15; i++) { emit('<0x42> OP_SPLIT'); pushN(); } for (let i = 0; i < 16; i++) stk[stk.length - 16 + i] = 'e' + i; return a; }, // tbl -> e0..e15 (66B each)
    entryDecode(m) { a.pk('e' + m); emit('<33> OP_SPLIT OP_BIN2NUM OP_SWAP OP_BIN2NUM OP_SWAP'); pushN(); return a; }, // e_m -> x y (cheap pick vs re-splitting the 1KB blob)
    dropEntries() { emit('OP_2DROP OP_2DROP OP_2DROP OP_2DROP OP_2DROP OP_2DROP OP_2DROP OP_2DROP'); popN(16); return a; },
    invNext(k) { a.pk('invb'); emit(`${num(BigInt(k * 33))} OP_SPLIT OP_NIP <33> OP_SPLIT OP_DROP OP_BIN2NUM`); return a; },
    aav() { emit('<0x12> OP_INVOKE'); popN(3); return a; },
    rot() { emit('OP_ROT'); return a; },
    tableAtRuntime() { a.pk('tbl'); emit('OP_SWAP <0x42> OP_MUL OP_SPLIT OP_NIP <0x42> OP_SPLIT OP_DROP <33> OP_SPLIT OP_BIN2NUM OP_SWAP OP_BIN2NUM OP_SWAP'); return a; }, // [.. mval] -> [.. x y]
    entryAtRuntime() { emit('OP_DUP <0x10> OP_SWAP OP_SUB OP_PICK OP_SWAP OP_DROP <33> OP_SPLIT OP_BIN2NUM OP_SWAP OP_BIN2NUM OP_SWAP'); pushN(); return a; }, // [e.. mval] -> [e.. x y] (pick entry[mval], depth 16-mval)
    // derive base Y from the sign of a recomb term: signed>=2^128 => negated point (P - Yaff). Net stack effect +1;
    // the transient (term copy, bool) is consumed by GTE+IF, so the branch bodies see the base stack (depths stable).
    baseY(term, yTok, yIsWitness) {
      const dTerm = D(term); emit(`${num(BigInt(dTerm))} OP_PICK ${num(B128)} OP_GREATERTHANOREQUAL OP_IF`);
      if (yIsWitness) emit(`${num(BigInt(D(yTok)))} OP_PICK ${pP} OP_SWAP OP_SUB`); else emit(num(mod(P - yTok, P)));
      emit('OP_ELSE');
      if (yIsWitness) emit(`${num(BigInt(D(yTok)))} OP_PICK`); else emit(num(yTok));
      emit('OP_ENDIF'); pushN(); return a;
    },
    asm() { return out.join(' '); }, _stk: stk, D,
  };
  return a;
}

// table binding: derive bases (Y from recomb-term sign) then verify the witnessed table (single-base + 11 composites).
// Reusable by A (all-verify-on-A) and B (robust split). Requires r/phiRx/t1a..t2b/Ry/tbl/invb in the base block.
function emitTableVerify(v, keepEntries = false) {
  v.presplit();   // split the 1KB table blob into 16 stack entries ONCE (cheap 66B picks below vs 26 blob re-splits)
  const checkSingle = (m, i) => {
    v.entryDecode(m);
    if (i === 0) v.baseY('t1a', GY, false); else if (i === 1) v.baseY('t2a', GY, false); else if (i === 2) v.baseY('t1b', 'Ry', true); else v.baseY('t2b', 'Ry', true);
    v.eqv();
    if (i === 0) v.lit(num(GX)); else if (i === 1) v.lit(num(PHIGX)); else if (i === 2) v.pk('r'); else v.pk('phiRx');
    v.eqv();
  };
  [[1, 0], [2, 1], [4, 2], [8, 3]].forEach(([m, i]) => checkSingle(m, i));
  const baseCoord = (bi) => {
    if (bi === 0) { v.lit(num(GX)); v.baseY('t1a', GY, false); }
    else if (bi === 1) { v.lit(num(PHIGX)); v.baseY('t2a', GY, false); }
    else if (bi === 2) { v.pk('r'); v.baseY('t1b', 'Ry', true); }
  };
  COMPOSITES.forEach(([m, pred, bi], k) => {
    v.entryDecode(pred); baseCoord(bi); v.invNext(k); v.aav(); v.entryDecode(m); v.rot().eqv().eqv();
  });
  if (!keepEntries) v.dropEntries();   // B keeps e0..e15 to reuse for the pre-split ladder
}

// covenant A body: self-verify + ladder chunk A -> checkpoint C blob, then (for this test) leave C on the stack.
// withTable: include the table check on A (all-verify-on-A) or leave it to B (robust budget split).
function covABody(chunkA, withTable = true, base = A_BASE) {
  const v = V(base);
  // 1. sig binding
  v.pk('r').pk('rinv').mul('n').v1();
  v.pk('Ry').pk('Ry').mul('p').pk('r').pk('r').mul('p').pk('r').mul('p').lit('<0x07>').raw('OP_ADD', 1).lit(pP).raw('OP_MOD', 1).eqv();
  v.pk('Ry').lit('<0x02>').raw('OP_MOD', 1).pk('recPar').eqv();
  v.pk('r').lit(num(BETA)).mul('p').pk('phiRx').eqv();
  v.pk('negZ').pk('rinv').mul('n').pk('t2a').lit(num(LAMBDA)).mul('n').pk('t1a').raw('OP_ADD', 1).lit(pN).raw('OP_MOD', 1).eqv();
  v.pk('s').pk('rinv').mul('n').pk('t2b').lit(num(LAMBDA)).mul('n').pk('t1b').raw('OP_ADD', 1).lit(pN).raw('OP_MOD', 1).eqv();
  // 2. mask binding: reconstruct(masks) == fold(t1a)+fold(t2a)*2^128+fold(t1b)*2^256+fold(t2b)*2^384
  v.pk('masks').reconstruct();
  v.pk('t1a').fold();
  v.pk('t2a').fold().lit(num(B128)).raw('OP_MUL', 1).raw('OP_ADD', 1);
  v.pk('t1b').fold().lit(num(B128 * B128)).raw('OP_MUL', 1).raw('OP_ADD', 1);
  v.pk('t2b').fold().lit(num(B128 * B128 * B128)).raw('OP_MUL', 1).raw('OP_ADD', 1);
  v.eqv();
  // 3. table binding (keep the pre-split entries for the ladder to reuse); else just pre-split for the ladder
  if (withTable) emitTableVerify(v, true); else v.presplit();
  // 4. init binding + ladder chunk A. Stack still = 15 base values.
  // leading masks[0:start] must be zero (else `start` is a lie that skips a nonzero mask)
  v.pk('masks').pk('start').raw('OP_SPLIT OP_DROP OP_BIN2NUM OP_0 OP_NUMEQUALVERIFY', 2);
  // pre-split ladder: derive acc0 = table[masks[start]] via a pre-split entry pick, then run the chunk (entries already split)
  v.pk('masks').pk('start').raw('OP_SPLIT OP_NIP <0x01> OP_SPLIT OP_DROP OP_BIN2NUM', 1); // mval = masks[start]
  v.raw('OP_DUP OP_0 OP_NUMEQUAL OP_NOT OP_VERIFY', 0);                            // masks[start] != 0
  v.entryAtRuntime();                                                             // acc0 = entry[mval] -> accX accY
  v.lit('OP_1');                                                                   // Z = 1
  v.pk('masks').pk('start').raw('OP_1ADD OP_SPLIT OP_NIP', 1).pk('chunkA').raw('OP_SPLIT OP_DROP', 1); // sliceA = masks[start+1 : +chunkA]
  v.raw(SHAMIR_PRESPLIT, 1);                                                       // [e0..e15 X Y Z] (sliceA consumed)
  v.raw(COMBINE3, 2);                                                              // [e0..e15 Cblob]
  return { v, asm: v.asm() };
}

// covenant B body: table check (robust split - B's budget) + ladder chunk B from checkpoint C -> Q -> compressed pubkey.
// B trusts A's sig+mask binding via the A->B hash (checked in the covenant wrapper); here it derives the bases from the
// (hash-bound) r/Ry/phiRx/t-signs and verifies the shared witnessed table, then continues the ladder from C.
function covBBody(withTable = false, base = B_BASE) {
  const v = V(base);
  if (withTable) emitTableVerify(v, true); else v.presplit();                    // B is a PURE ladder (A verified the shared table); just pre-split for the ladder
  // pre-split ladder chunk B from Cblob (entries e0..e15 stay below [X Y Z maskChunk])
  v.pk('Cblob').raw(DECODE3, -2);                                                // Cblob -> X Y Z
  v.pk('masks').pk('start').raw('OP_1ADD', 0).pk('chunkA').raw('OP_ADD OP_SPLIT OP_NIP', 2); // sliceB = masks[start+1+chunkA :]
  v.raw(SHAMIR_PRESPLIT, 1);                                                     // [e0..e15 X Y Z] (Q Jacobian)
  v.pk('Zinv');                                                                  // [.. X Y Z Zinv]
  v.raw(AFFINE, 1);                                                              // [.. Qx Qy zchk]
  v.raw('OP_1 OP_NUMEQUALVERIFY', 1);                                            // Z*Zinv == 1 -> [.. Qx Qy]
  v.raw('<0x02> OP_MOD <0x02> OP_ADD OP_1 OP_NUM2BIN OP_SWAP <33> OP_NUM2BIN OP_CAT', 1); // compressed = 0x02/03 || Qx (entries + base14 still below)
  return { v, asm: v.asm() };
}

async function main() {
  console.log('=== engine: FULL 2-input self-verifying reusable recovery (A sig+mask, B table) vs ethers ===');
  const w = ethers.Wallet.createRandom();
  const sig = await w.signMessage('engine'); const digest = ethers.hashMessage('engine');
  const { r, s, v } = ethers.Signature.from(sig);
  const rr = BigInt(r), ss = BigInt(s), rec = v - 27, z = BigInt(digest) % N, Fp = secp256k1.CURVE.Fp;
  const Ry = (() => { const y = Fp.sqrt(mod(mod(rr * rr, P) * rr + 7n, P)); return (y & 1n) === BigInt(rec & 1) ? y : mod(P - y, P); })();
  const rinv = invN(rr), u1 = mod(mod(-z, N) * rinv, N), u2 = mod(ss * rinv, N), phiRx = mod(BETA * rr, P);
  const sp1 = splitScalar(u1), sp2 = splitScalar(u2);
  const t1a = recTerm(sp1.k1neg, sp1.k1), t2a = recTerm(sp1.k2neg, sp1.k2), t1b = recTerm(sp2.k1neg, sp2.k1), t2b = recTerm(sp2.k2neg, sp2.k2);
  const scalars = [sp1.k1, sp1.k2, sp2.k1, sp2.k2];
  const masks = []; for (let i = 127; i >= 0; i--) { let m = 0; for (let j = 0; j < 4; j++) if ((scalars[j] >> BigInt(i)) & 1n) m |= (1 << j); masks.push(m); }
  const maskBlob = new Uint8Array(masks);
  // GLV table + inverses (witnessed)
  const neg = (pt, isNeg) => isNeg ? secp256k1.ProjectivePoint.fromAffine({ x: pt.x, y: mod(-pt.y, P) }) : secp256k1.ProjectivePoint.fromAffine(pt);
  const bases = [neg({ x: GX, y: GY }, sp1.k1neg), neg({ x: PHIGX, y: GY }, sp1.k2neg), neg({ x: rr, y: Ry }, sp2.k1neg), neg({ x: phiRx, y: Ry }, sp2.k2neg)];
  const ta = []; for (let m = 0; m < 16; m++) { let acc = null; for (let i = 0; i < 4; i++) if (m & (1 << i)) acc = acc ? acc.add(bases[i]) : bases[i]; ta.push(acc ? acc.toAffine() : null); }
  const tbl = new Uint8Array(16 * 66); for (let m = 1; m < 16; m++) { tbl.set(to33(ta[m].x), m * 66); tbl.set(to33(ta[m].y), m * 66 + 33); }
  const basesAff = bases.map((b) => b.toAffine());
  const invb = new Uint8Array(COMPOSITES.length * 33);
  COMPOSITES.forEach(([m, pred, bi], k) => invb.set(to33(invP(mod(basesAff[bi].x - ta[pred].x, P))), k * 33));

  // 2-input split: A = sig+mask binding + init + ladder chunk A -> C ; B = table check + ladder chunk B from C -> Q.
  const start = masks.findIndex((m) => m !== 0), restMasks = masks.slice(start + 1);
  // cumulative reference ladder, so the SDK can checkpoint at ANY split point
  const accs = [[ta[masks[start]].x, ta[masks[start]].y, 1n]];
  for (let i = 0; i < restMasks.length; i++) { let a = jDbl(accs[i]); const m = restMasks[i]; if (m) a = jAdd(a, ta[m].x, ta[m].y); accs.push(a); }
  const Qjac = accs[restMasks.length];
  const [Qx, Qy] = (() => { const zi = invP(Qjac[2]), z2 = mod(zi * zi, P); return [mod(Qjac[0] * z2, P), mod(Qjac[1] * z2 * zi, P)]; })();
  const Zinv = invP(Qjac[2]);
  const compExp = new Uint8Array(34); compExp[0] = 2 + Number(Qy & 1n); compExp.set(to33(Qx), 1);
  const dropN = (n) => Array.from({ length: n }, () => 'OP_DROP').join(' ');
  const runInput = (bodyAsm, pushes, expBlob, nDrop) => {
    const lock = asm(`OP_DROP ${DEFS} ${bodyAsm} <0x${binToHex(expBlob)}> OP_EQUALVERIFY ${dropN(nDrop)} OP_1`);
    const pad = Math.max(0, 9990 - asm(pushes).length);   // fill scriptSig to the ~10000 cap => budget ~8.03M/input
    return vm.evaluate({ inputIndex: 0, sourceOutputs: [{ lockingBytecode: lock, valueSatoshis: 1000n }],
      transaction: { version: 2, locktime: 0, inputs: [{ outpointIndex: 0, outpointTransactionHash: new Uint8Array(32), sequenceNumber: 0xffffffff, unlockingBytecode: asm(`${pushes} <0x${'00'.repeat(pad)}>`) }], outputs: [{ lockingBytecode: new Uint8Array(0), valueSatoshis: 1000n }] } });
  };
  // the covenant bytecode is chunkA-INDEPENDENT (chunkA is witnessed), so build each once.
  // A does ALL verification (sig+mask+table); B is a PURE ladder that trusts A via the shared hash-bound (table,masks).
  const covA = covABody(0, true).asm, covB = covBBody(false).asm;
  const orderA = { negZ: mod(-z, N), r: rr, s: ss, rinv, Ry, phiRx, recPar: BigInt(rec & 1), t1a, t2a, t1b, t2b };
  const orderB = { r: rr, Ry, phiRx, t1a, t2a, t1b, t2b };
  const Cof = (cA) => accBlob(accs[cA]);
  const witA = (cA, o = orderA) => `${Object.values(o).map(num).join(' ')} <0x${binToHex(maskBlob)}> <0x${binToHex(tbl)}> <0x${binToHex(invb)}> ${num(BigInt(start))} ${num(BigInt(cA))}`;
  const witB = (cA, tb = tbl) => `${Object.values(orderB).map(num).join(' ')} <0x${binToHex(maskBlob)}> <0x${binToHex(tb)}> <0x${binToHex(invb)}> ${num(BigInt(start))} <0x${binToHex(Cof(cA))}> ${num(Zinv)} ${num(BigInt(cA))}`;
  // DETERMINISTIC VM-PROBE = what the SDK's auto-derivation does: measure the REAL op-cost at candidate split points
  // (op-cost is a deterministic function of covenant+witness) and pick the split where both inputs fit with most margin.
  // No cost model needed. chunkA is liveness-only, so a probe can only ever land on a provably-valid split.
  const CAP = 8030000;
  const costAt = (cA) => { const a = runInput(covA, witA(cA), Cof(cA), 32), b = runInput(covB, witB(cA), compExp, 30); return { a: a.error ? Infinity : a.metrics.operationCost, b: b.error ? Infinity : b.metrics.operationCost }; };
  let lo = 45, hi = Math.min(72, restMasks.length - 1);
  while (hi - lo > 1) { const mid = (lo + hi) >> 1, c = costAt(mid); if (c.a <= c.b) lo = mid; else hi = mid; } // A cheaper -> give A more
  const win = []; for (let c = Math.max(45, lo - 3); c <= Math.min(hi + 3, restMasks.length - 1); c++) win.push(c);
  const cand = win.map((cA) => ({ cA, ...costAt(cA) })).filter((x) => x.a < CAP && x.b < CAP).sort((p, q) => Math.max(p.a, p.b) - Math.max(q.a, q.b));
  const CHUNKA = (cand[0] ?? { cA: lo }).cA;
  const Cexp = Cof(CHUNKA), pushA = witA(CHUNKA), pushB = witB(CHUNKA);
  const rA = runInput(covA, pushA, Cexp, 32);
  console.log(`  probe -> chunkA=${CHUNKA} (deterministic from VM op-cost)`);
  console.log(`  input A (sig+mask + init + ladder[${CHUNKA}]) -> checkpoint C == JS: ${!rA.error}  cost=${rA.metrics?.operationCost} ${rA.error ? '(' + rA.error.slice(0, 50) + ')' : ''}`);
  const rB = runInput(covB, pushB, compExp, 30);
  const qMatch = !rB.error;
  console.log(`  input B (table + ladder[${restMasks.length - CHUNKA}] from C) -> compressed Q == ethers: ${qMatch}  cost=${rB.metrics?.operationCost} ${rB.error ? '(' + rB.error.slice(0, 50) + ')' : ''}`);
  // negatives: forged sig on A, forged table entry on B
  const tblBad = tbl.slice(); tblBad[15 * 66] ^= 1;
  const rejA = !!runInput(covA, witA(CHUNKA, { ...orderA, rinv: mod(rinv + 1n, N) }), Cexp, 32).error;
  const rejB = !!runInput(covB, witB(CHUNKA, tblBad), compExp, 30).error;
  console.log(`  negatives: A forged rinv rejected=${rejA}  B forged table rejected=${rejB}`);
  console.log(`\n  2-INPUT SELF-VERIFYING RECOVERY (A sig+mask, B table, both <8.03M): ${!rA.error && qMatch && rejA && rejB ? 'PROVEN vs ethers' : 'FAIL'}`);
}

// exported for the production-covenant builder (gen-ecrecover-sidecar.mjs) which wraps this proven verification+ladder
export {
  asm, num, N, P, BETA, mod, invP, invN, splitScalar, recTerm, jDbl, jAdd, to33, accBlob,
  DEFS, COMBINE3, SHAMIR_PRESPLIT, DECODE3, AFFINE, V, emitTableVerify, covABody, covBBody,
  GX, GY, PHIGX, LAMBDA, B128,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error('ERR', e.stack || e.message); process.exit(1); });
}
