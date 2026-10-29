// NATIVE-SIGCHECK RECOVERY: verify a witnessed ecrecover result with OP_CHECKDATASIG instead of a Script ladder.
//
// OP_CHECKDATASIG checks a signature over SHA256(msg), so it cannot check the raw keccak digest z directly. Two facts
// make it usable anyway:
//  - Key shift. If (r, s) is a valid signature on z for key Q, it is a valid signature on z1 = SHA256(m1) for
//    Q + ((z - z1) / r) * G: the verifier's point (z1/s)G + (r/s)(Q + ((z - z1)/r)G) is (z/s)G + (r/s)Q unchanged.
//  - Known discrete log. A witnessed point D is exactly d * G for a d the covenant computes when a Schnorr check by
//    D passes on a signature the covenant builds itself: nonce point R0 = k0 * G (baked, Jacobi(y) = 1), challenge
//    e = SHA256(R0.x || compressed(D) || SHA256(msg)), s0 = k0 + e * d. The check computes s0 G - e D = R0 + e(dG - D),
//    which is R0 only when D = dG (e != 0).
// An ECDSA check only compares x-coordinates, so one check pins W = (z/s)G + (r/s)Q to {R, -R}. A second check on
// W + G against x(R + G) pins W = R, the point with x = r whose y parity v selects, and W fixes Q.
// Each check costs 26,000 op-cost; four checks and ~25 field multiplications replace the ~12.7M two-input ladder.
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import { secp256k1 as nativeSecp, sha256 } from '@bitauth/libauth';
import { run, num, asm as asmOf, binToHex, hexToBin } from './harness.mjs';

const P = secp256k1.CURVE.p, N = secp256k1.CURVE.n;
const G = secp256k1.ProjectivePoint.BASE;
const { x: GX, y: GY } = G.toAffine();
const mod = (a, m) => ((a % m) + m) % m;
const pow = (b, e, m) => { let r = 1n; b = mod(b, m); while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
const inv = (a, m) => pow(a, m - 2n, m);
const be32 = (x) => hexToBin(x.toString(16).padStart(64, '0'));
const beNum = (bytes) => BigInt('0x' + binToHex(bytes));
const isQr = (y) => pow(y, (P - 1n) / 2n, P) === 1n;
const H0 = sha256.hash(new Uint8Array(0)); // the Schnorr checks sign the empty message
// The Schnorr nonce point: G or -G, whichever has a quadratic-residue y. Its x is G's either way.
const K0 = isQr(GY) ? 1n : N - 1n;
// Helper functions, defined once and invoked by a one-byte id: the 33-byte moduli would otherwise ride every op.
const F = { P: 1, N: 2, MODP: 3, MODN: 4, MULP: 5, MULN: 6, SUBP: 7, SUBN: 8, ADDN: 9, BE32: 10, KNOWN_LOG: 11, SHIFTED: 12, ECDSA: 13, GX: 14 };
const call = (id) => `${num(BigInt(id))} OP_INVOKE`;

/** A named stack: `pick` copies, a leading `!` on an operand consumes it. */
class S {
  constructor(init) { this.stk = [...init]; this.out = []; }
  depth(name) { const i = this.stk.lastIndexOf(name); if (i < 0) throw new Error(`no ${name} in [${this.stk}]`); return this.stk.length - 1 - i; }
  pick(name, as = name) { const d = this.depth(name); this.out.push(d === 0 ? 'OP_DUP' : d === 1 ? 'OP_OVER' : `${num(BigInt(d))} OP_PICK`); this.stk.push(as); return this; }
  roll(name) { const d = this.depth(name); if (d === 1) this.out.push('OP_SWAP'); else if (d === 2) this.out.push('OP_ROT'); else if (d > 2) this.out.push(`${num(BigInt(d))} OP_ROLL`); this.stk.splice(this.stk.length - 1 - d, 1); this.stk.push(name); return this; }
  ld(spec) { return spec.startsWith('!') ? this.roll(spec.slice(1)) : this.pick(spec); }
  lit(text, as) { this.out.push(text); this.stk.push(as); return this; }
  op(text, consumed, ...produced) { this.out.push(text); this.stk.splice(this.stk.length - consumed, consumed); this.stk.push(...produced); return this; }
  mul(a, b, res, m) { return this.ld(a).ld(b).op(call(m === 'p' ? F.MULP : F.MULN), 2, res); }
  sub(a, b, res, m) { return this.ld(a).ld(b).op(call(m === 'p' ? F.SUBP : F.SUBN), 2, res); }
  addn(a, b, res) { return this.ld(a).ld(b).op(call(F.ADDN), 2, res); }
  isOne(a) { return this.ld(a).op('OP_1 OP_NUMEQUALVERIFY', 1); }
  within(a, lo, hi) { return this.ld(a).op(`${lo} ${hi} OP_WITHIN OP_VERIFY`, 1); }
  /** The body built so far, checked to leave exactly `outputs`. */
  body(outputs) {
    if (this.stk.join() !== outputs.join()) throw new Error(`leaves [${this.stk}], not [${outputs}]`);
    return this.out.join(' ');
  }
}
// Top-of-stack conversions.
const BE_TO_NUM = 'OP_REVERSEBYTES <0x00> OP_CAT OP_BIN2NUM';                // big-endian bytes -> unsigned number
// A positive minimal VM number reversed is a DER INTEGER's content; frame it as 0x02 || len || content.
const DER_INT = 'OP_REVERSEBYTES OP_SIZE OP_SWAP OP_CAT <0x02> OP_SWAP OP_CAT';
const UNCOMPRESSED = `${call(F.BE32)} OP_SWAP ${call(F.BE32)} OP_SWAP OP_CAT <0x04> OP_SWAP OP_CAT`; // [x y] -> 04||x||y

/**
 * [dx dy d] -> []: D = (dx, dy) is d * G, by a Schnorr check the covenant signs with the baked nonce point, whose x
 * is G's. The check signs the empty message, so its digest is SHA256 of nothing.
 */
function knownLogBody() {
  const e = new S(['dx', 'dy', 'd']);
  e.lit(call(F.GX), 'r0').pick('r0', 'rc').pick('dy').op('OP_2 OP_MOD OP_2 OP_ADD', 1, 'pre').pick('dx').op(call(F.BE32), 1, 'xb');
  e.op('OP_CAT OP_CAT', 3, 'ch').op(`OP_0 OP_SHA256 OP_CAT OP_SHA256 ${BE_TO_NUM} ${call(F.MODN)}`, 1, 'e');
  e.mul('!e', '!d', 'ed', 'n').op(`${num(K0)} OP_ADD ${call(F.MODN)} ${call(F.BE32)}`, 1, 'sb');
  e.roll('r0').op('OP_SWAP OP_CAT OP_0', 2, 'sig', 'msg');
  e.roll('dx').roll('dy').op(`${UNCOMPRESSED} OP_CHECKDATASIGVERIFY`, 4);
  return e.body([]);
}
/** [Qx Qy dx dy inv] -> [Px Py]: P = Q + D, affine, with inv = 1 / (dx - Qx) checked. */
function shiftedBody() {
  const e = new S(['Qx', 'Qy', 'dx', 'dy', 'inv']);
  e.sub('dx', 'Qx', 'h', 'p').mul('!h', 'inv', 'chk', 'p').isOne('!chk');
  e.sub('!dy', 'Qy', 'h', 'p').mul('!h', '!inv', 'lam', 'p').mul('lam', 'lam', 'l2', 'p').sub('!l2', 'Qx', 't', 'p').sub('!t', '!dx', 'Px', 'p');
  e.sub('Qx', 'Px', 't', 'p').mul('!lam', '!t', 't2', 'p').sub('!t2', '!Qy', 'Py', 'p').roll('Qx').op('OP_DROP', 1);
  return e.body(['Px', 'Py']);
}
/** [rk sk mk Px Py] -> []: an ECDSA check of (rk, low-s sk) over SHA256(mk) by the uncompressed P. */
function ecdsaBody() {
  const e = new S(['rk', 'sk', 'mk', 'Px', 'Py']);
  e.op(UNCOMPRESSED, 2, 'pub').roll('rk').op(DER_INT, 1, 'dr').roll('sk');
  e.op(`OP_DUP ${call(F.N)} OP_2 OP_DIV OP_GREATERTHAN OP_IF ${call(F.N)} OP_SWAP OP_SUB OP_ENDIF ${DER_INT}`, 1, 'ds');
  e.op('OP_CAT OP_SIZE OP_SWAP OP_CAT <0x30> OP_SWAP OP_CAT', 2, 'der').roll('mk').roll('pub').op('OP_CHECKDATASIGVERIFY', 3);
  return e.body([]);
}

const DEFINITIONS = [
  [F.P, num(P)], [F.N, num(N)], [F.MODP, `${call(F.P)} OP_MOD`], [F.MODN, `${call(F.N)} OP_MOD`],
  [F.MULP, `OP_MUL ${call(F.MODP)}`], [F.MULN, `OP_MUL ${call(F.MODN)}`],
  [F.SUBP, `OP_SUB ${call(F.P)} OP_ADD ${call(F.MODP)}`], [F.SUBN, `OP_SUB ${call(F.N)} OP_ADD ${call(F.MODN)}`],
  [F.ADDN, `OP_ADD ${call(F.MODN)}`],
  [F.BE32, '<33> OP_NUM2BIN <32> OP_SPLIT OP_DROP OP_REVERSEBYTES'], // 0 <= x < 2^256 -> 32 bytes big-endian
  [F.GX, `<0x${binToHex(be32(GX))}>`],                                // G's x, 32 bytes big-endian
  [F.KNOWN_LOG, knownLogBody()], [F.SHIFTED, shiftedBody()], [F.ECDSA, ecdsaBody()],
];
export const defines = () => DEFINITIONS.map(([id, text]) => `<0x${binToHex(asmOf(text))}> ${num(BigInt(id))} OP_DEFINE`).join(' ');

const WITNESS = ['z', 'v', 'r', 's', 'Qx', 'Qy', 'Ry', 'rinv', 'm1', 'D1x', 'D1y', 'inv1', 'gInv', 'r2inv', 'm2', 'D2x', 'D2y', 'inv2'];

/**
 * The verifier over a named stack holding every WITNESS item (in any order, `init` bottom to top): leaves [Qx Qy],
 * failing unless Q is ecrecover(z, v, r, s). It invokes the helpers `defines()` defines.
 */
export function verifierBody(init = WITNESS) {
  const e = new S(init);
  e.within('r', 'OP_1', call(F.N)).within('s', 'OP_1', call(F.N)).within('v', '<27>', '<29>');
  for (const c of ['Qx', 'Qy', 'Ry', 'D1x', 'D1y', 'D2x', 'D2y']) e.within(c, 'OP_0', call(F.P));
  e.mul('r', 'rinv', 'chk', 'n').isOne('!chk');
  // R = (r, Ry): on the curve, with the parity v selects.
  e.mul('Ry', 'Ry', 'ry2', 'p').mul('r', 'r', 'rr', 'p').mul('!rr', 'r', 'r3', 'p').op(`<7> OP_ADD ${call(F.MODP)} OP_NUMEQUALVERIFY`, 2);
  e.pick('Ry').op('OP_2 OP_MOD', 1, 'par').pick('v').op('<27> OP_SUB OP_NUMEQUALVERIFY', 2);
  // Q on the curve.
  e.mul('Qy', 'Qy', 'qy2', 'p').mul('Qx', 'Qx', 'qx2', 'p').mul('!qx2', 'Qx', 'qx3', 'p').op(`<7> OP_ADD ${call(F.MODP)} OP_NUMEQUALVERIFY`, 2);
  e.pick('z').op(call(F.MODN), 1, 'zn');
  // Check 1: x((z/s)G + (r/s)Q) = r, through the key shifted by d1 = (z - z1)/r.
  e.pick('m1').op(`OP_SHA256 ${BE_TO_NUM} ${call(F.MODN)}`, 1, 'z1').sub('zn', '!z1', 't', 'n').mul('!t', 'rinv', 'd1', 'n');
  e.pick('D1x').pick('D1y').roll('d1').op(call(F.KNOWN_LOG), 3);
  e.pick('Qx').pick('Qy').pick('D1x').pick('D1y').pick('inv1').op(call(F.SHIFTED), 5, 'P1x', 'P1y');
  e.pick('r').pick('s').pick('m1').roll('P1x').roll('P1y').op(call(F.ECDSA), 5);
  // Check 2: x(W + G) = x(R + G), with r2 = x(R + G) mod n, s2 = r2 s / r and d2 = (z + s - z2 r / r2) / r.
  e.lit(`${call(F.GX)} ${BE_TO_NUM}`, 'gx').sub('gx', 'r', 'h', 'p').mul('!h', 'gInv', 'chk', 'p').isOne('!chk');
  e.lit(num(GY), 'gy').sub('!gy', 'Ry', 'h', 'p').mul('!h', 'gInv', 'lg', 'p').mul('lg', '!lg', 'lg2', 'p').sub('!lg2', 'r', 't', 'p').sub('!t', '!gx', 'xg', 'p');
  e.roll('xg').op(call(F.MODN), 1, 'r2');
  e.mul('r2', 'r2inv', 'chk', 'n').isOne('!chk');
  e.mul('r2', 's', 't', 'n').mul('!t', 'rinv', 's2', 'n');
  e.pick('m2').op(`OP_SHA256 ${BE_TO_NUM} ${call(F.MODN)}`, 1, 'z2').mul('!z2', 'r', 't', 'n').mul('!t', 'r2inv', 'zr', 'n');
  e.addn('zn', 's', 't').sub('!t', '!zr', 't3', 'n').mul('!t3', 'rinv', 'd2', 'n');
  e.pick('D2x').pick('D2y').roll('d2').op(call(F.KNOWN_LOG), 3);
  e.pick('Qx').pick('Qy').pick('D2x').pick('D2y').pick('inv2').op(call(F.SHIFTED), 5, 'P2x', 'P2y');
  e.roll('r2').roll('s2').pick('m2').roll('P2x').roll('P2y').op(call(F.ECDSA), 5);
  // Leave [Qx Qy].
  e.roll('Qx').roll('Qy').op('OP_TOALTSTACK OP_TOALTSTACK', 2);
  e.op(Array(e.stk.length).fill('OP_DROP').join(' '), e.stk.length).op('OP_FROMALTSTACK OP_FROMALTSTACK', 0, 'Qx', 'Qy');
  return e.body(['Qx', 'Qy']);
}

/** The witness the SDK would build for ecrecover(z, v, r, s) = Q. */
export function witnessFor({ z, v, r, s }, Q, { m1 = Uint8Array.of(1), m2 = Uint8Array.of(2) } = {}) {
  const zn = mod(z, N), rinv = inv(r, N);
  const alpha = mod(r ** 3n + 7n, P);
  let Ry = pow(alpha, (P + 1n) / 4n, P);
  if (Ry * Ry % P !== alpha) throw new Error('r has no curve point');
  if ((Ry & 1n) !== BigInt(v - 27)) Ry = P - Ry;
  const Rv = new secp256k1.ProjectivePoint(r, Ry, 1n);
  const Qp = new secp256k1.ProjectivePoint(Q.x, Q.y, 1n);
  const z1 = mod(beNum(sha256.hash(m1)), N), d1 = mod((zn - z1) * rinv, N);
  const D1 = G.multiply(d1).toAffine();
  const RG = Rv.add(G).toAffine(), r2 = mod(RG.x, N), r2inv = inv(r2, N);
  const z2 = mod(beNum(sha256.hash(m2)), N), d2 = mod((zn + s - z2 * r * r2inv) * rinv, N);
  const D2 = G.multiply(d2).toAffine();
  return {
    z, v: BigInt(v), r, s, Qx: Q.x, Qy: Q.y, Ry, rinv, m1, D1x: D1.x, D1y: D1.y, inv1: inv(mod(D1.x - Q.x, P), P),
    gInv: inv(mod(GX - r, P), P), r2inv, m2, D2x: D2.x, D2y: D2.y, inv2: inv(mod(D2.x - Q.x, P), P),
    // for the JS self-check
    _P1: Qp.add(G.multiply(d1)).toAffine(), _P2: Qp.add(G.multiply(d2)).toAffine(), _r2: r2, _s2: mod(r2 * s * rinv, N),
    _d1: d1, _d2: d2,
  };
}

const unlockingOf = (w) => WITNESS.map((k) => (w[k] instanceof Uint8Array ? `<0x${binToHex(w[k])}>` : num(w[k]))).join(' ');

/** JS-only check of the four signatures the covenant builds, through libauth's own verifiers. */
function jsChecks(w) {
  const der = (rr, ss) => secp256k1.Signature.fromCompact(binToHex(be32(rr)) + binToHex(be32(ss))).normalizeS().toDERRawBytes();
  const uncompressed = (pt) => hexToBin('04' + binToHex(be32(pt.x)) + binToHex(be32(pt.y)));
  const compressed = (x, y) => hexToBin((y & 1n ? '03' : '02') + binToHex(be32(x)));
  const schnorr = (dx, dy, d) => {
    const e = mod(beNum(sha256.hash(Uint8Array.from([...be32(GX), ...compressed(dx, dy), ...H0]))), N);
    const sig = Uint8Array.from([...be32(GX), ...be32(mod(K0 + e * d, N))]);
    return nativeSecp.verifySignatureSchnorr(sig, uncompressed({ x: dx, y: dy }), H0);
  };
  return {
    schnorr1: schnorr(w.D1x, w.D1y, w._d1),
    ecdsa1: nativeSecp.verifySignatureDERLowS(der(w.r, w.s), uncompressed(w._P1), sha256.hash(w.m1)),
    schnorr2: schnorr(w.D2x, w.D2y, w._d2),
    ecdsa2: nativeSecp.verifySignatureDERLowS(der(w._r2, w._s2), uncompressed(w._P2), sha256.hash(w.m2)),
  };
}

export { WITNESS, K0, H0, GX, GY, P, N, be32, beNum, mod, inv };
export const signedBy = (wallet, digest) => signed(wallet, digest);

const COVENANT = `${defines()} ${verifierBody()}`;
// A pad buys the op-cost budget; the tail leaves one item: Q compared to `expect`, or just whether the verifier passed.
const evaluate = (w, pad = 0, expect) => run(`${unlockingOf(w)}${pad ? ` <0x${'00'.repeat(pad)}>` : ''}`,
  `${pad ? 'OP_DROP ' : ''}${COVENANT} ${expect ? `${num(expect.y)} OP_NUMEQUALVERIFY ${num(expect.x)} OP_NUMEQUAL` : 'OP_2DROP OP_1'}`);

const signed = (wallet, digest) => {
  const sig = wallet.signingKey.sign(digest);
  const pub = hexToBin(wallet.signingKey.publicKey.slice(2));
  return {
    call: { z: beNum(hexToBin(digest.slice(2))), v: sig.v, r: BigInt(sig.r), s: BigInt(sig.s) },
    Q: { x: beNum(pub.slice(1, 33)), y: beNum(pub.slice(33)) },
    address: wallet.address,
  };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) selfTest();

function selfTest() {
console.log('=== native-sigcheck recovery: verify a witnessed ecrecover result with 4 OP_CHECKDATASIGs ===');
console.log(`  covenant ${asmOf(COVENANT).length} B (definitions ${asmOf(defines()).length} B)`);
let worst = 0;
for (let i = 0; i < 8; i += 1) {
  const wallet = ethers.Wallet.createRandom();
  const digest = ethers.keccak256(ethers.toUtf8Bytes(`permit ${i} ${Date.now()}`));
  const { call, Q, address } = signed(wallet, digest);
  const rec = ethers.recoverAddress(digest, { r: ethers.toBeHex(call.r, 32), s: ethers.toBeHex(call.s, 32), v: call.v });
  const w = witnessFor(call, Q);
  const js = jsChecks(w);
  const res = evaluate(w, 600, Q);
  worst = Math.max(worst, res.opCost ?? 0);
  console.log(`  sig ${i}: v=${call.v} js=${Object.values(js).every(Boolean)} vm(Q==witnessed)=${res.error === undefined} witnessed==ethers=${rec === address} cost=${res.opCost}${res.error ? ' ERR ' + res.error.slice(0, 120) : ''}`);
}
console.log(`  worst op-cost ${worst} -> needs ${Math.ceil(worst / 800) - 41} B of unlocking`);

// Negatives: each must fail closed.
{
  const wallet = ethers.Wallet.createRandom();
  const digest = ethers.keccak256(ethers.toUtf8Bytes('negatives'));
  const { call, Q } = signed(wallet, digest);
  const honest = witnessFor(call, Q);
  const other = (() => { // the key the other recovery id gives
    const pub = ethers.SigningKey.recoverPublicKey(digest, { r: ethers.toBeHex(call.r, 32), s: ethers.toBeHex(call.s, 32), v: call.v === 27 ? 28 : 27 });
    const b = hexToBin(pub.slice(2)); return { x: beNum(b.slice(1, 33)), y: beNum(b.slice(33)) };
  })();
  const random = G.multiply(12345678901234567890n).toAffine();
  const rejected = (w) => evaluate(w, 600).error !== undefined;
  const flipV = { ...call, v: call.v === 27 ? 28 : 27 };
  const cases = {
    'other recovery id key (honest witnesses for it)': rejected({ ...witnessFor(call, other), v: BigInt(call.v) }),
    'other key under its own v (must ACCEPT: that is ecrecover with v flipped)': !rejected(witnessFor(flipV, other)),
    'honest key, v flipped': rejected({ ...witnessFor(call, Q), v: BigInt(flipV.v) }),
    'honest key, v flipped with its R': rejected(witnessFor(flipV, Q)),
    'random key': rejected(witnessFor(call, random)),
    'Q.y negated': rejected(witnessFor(call, { x: Q.x, y: P - Q.y })),
    'Q.x + p (range)': rejected({ ...honest, Qx: Q.x + P }),
    'D1 = (d1 + 1) G': rejected({ ...honest, ...(() => { const d = G.multiply(mod(honest._d1 + 1n, N)).toAffine(); return { D1x: d.x, D1y: d.y }; })() }),
    'D1.y negated': rejected({ ...honest, D1y: P - honest.D1y }),
    'D2 = d1 G': rejected({ ...honest, D2x: honest.D1x, D2y: honest.D1y }),
    'Ry other root': rejected({ ...honest, Ry: P - honest.Ry }),
    'rinv tampered': rejected({ ...honest, rinv: honest.rinv + 1n }),
    'r2inv tampered': rejected({ ...honest, r2inv: honest.r2inv + 1n }),
    'inv1 tampered': rejected({ ...honest, inv1: honest.inv1 + 1n }),
    'z tampered': rejected({ ...honest, z: honest.z + 1n }),
    's tampered': rejected({ ...honest, s: honest.s + 1n }),
  };
  for (const [name, ok] of Object.entries(cases)) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  console.log(`  NEGATIVES: ${Object.values(cases).every(Boolean) ? 'all fail closed' : 'SOME CASE FAILED'}`);
}
}
