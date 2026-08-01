// secp256k1 public-key recovery witness computation for the co-spent recovery side-car pair. Port of the proven
// engine (ecrecover-poc/engine.mjs) to TypeScript: given (hash, v, r, s) it derives everything the A/B covenants
// verify + ladder on - the GLV 4-way Shamir decomposition, the sign-adjusted base table, the per-bit mask stream,
// the affine-add inverses, and the cumulative Jacobian checkpoints (so any split point can be checkpointed). The
// recovered pubkey is Q = u1*G + u2*R. All of this is public data (recovery is not secret), computed off-chain and
// verified cheaply on-chain. See packages/solidc/docs/ecrecover.md.
import { secp256k1 } from '@noble/curves/secp256k1';

const N = secp256k1.CURVE.n;
const P = 2n ** 256n - 2n ** 32n - 977n;   // secp256k1 field prime
const BETA = 0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501een; // GLV endomorphism constant
const Point = secp256k1.ProjectivePoint;
const { x: GX, y: GY } = Point.BASE.toAffine();
const mod = (a: bigint, m: bigint): bigint => ((a % m) + m) % m;
const inv = (a: bigint, m: bigint): bigint => {
  let [g, x] = [mod(a, m), m]; let [s0, s1] = [1n, 0n];
  while (x) { const q = g / x; [g, x] = [x, g - q * x]; [s0, s1] = [s1, s0 - q * s1]; }
  return mod(s0, m);
};
const to33 = (v: bigint): Uint8Array => {
  const b = new Uint8Array(33);
  let x = v;
  for (let i = 0; x > 0n; i++, x >>= 8n) b[i] = Number(x & 0xffn);
  return b;
};

// GLV: split a 256-bit scalar into two ~128-bit halves k1 + k2*LAMBDA (with sign flags).
function splitScalar(k: bigint): { k1neg: boolean; k1: bigint; k2neg: boolean; k2: bigint } {
  const a1 = 0x3086d221a7d46bcde86c90e49284eb15n, b1 = -0xe4437ed6010e88286f547fa90abfe4c3n;
  const a2 = 0x114ca50f7a8e2f3f657c1108d9d44cfd8n, b2 = a1, POW = 1n << 128n;
  const dn = (x: bigint, y: bigint): bigint => (x + y / 2n) / y;
  const c1 = dn(b2 * k, N), c2 = dn(-b1 * k, N);
  let k1 = mod(k - c1 * a1 - c2 * a2, N), k2 = mod(-c1 * b1 - c2 * b2, N);
  const k1neg = k1 > POW, k2neg = k2 > POW;
  if (k1neg) k1 = N - k1; if (k2neg) k2 = N - k2;
  return { k1neg, k1, k2neg, k2 };
}
const recTerm = (kneg: boolean, k: bigint): bigint => (kneg ? mod(-k, N) : k);

// Jacobian point ops (a=0), matching the covenant's dbl-2009-l / madd-2007-bl.
type Jac = [bigint, bigint, bigint];
function jDbl([X1, Y1, Z1]: Jac): Jac {
  const A = mod(X1 * X1, P), B = mod(Y1 * Y1, P), C = mod(B * B, P);
  const D = mod(2n * mod((X1 + B) * (X1 + B) - A - C, P), P), E = mod(3n * A, P), F = mod(E * E, P);
  const X3 = mod(F - 2n * D, P);
  return [X3, mod(E * (D - X3) - 8n * C, P), mod(2n * Y1 * Z1, P)];
}
function jAdd([X1, Y1, Z1]: Jac, x2: bigint, y2: bigint): Jac {
  const Z1Z1 = mod(Z1 * Z1, P), U2 = mod(x2 * Z1Z1, P), S2 = mod(y2 * Z1 * Z1Z1, P);
  const H = mod(U2 - X1, P), HH = mod(H * H, P), I = mod(4n * HH, P), J = mod(H * I, P);
  const r = mod(2n * (S2 - Y1), P), V = mod(X1 * I, P), X3 = mod(r * r - J - 2n * V, P);
  return [X3, mod(r * (V - X3) - 2n * Y1 * J, P), mod((Z1 + H) * (Z1 + H) - Z1Z1 - HH, P)];
}

const COMPOSITES: [number, number, number][] = [
  [3, 2, 0], [5, 4, 0], [6, 4, 1], [7, 6, 0], [9, 8, 0], [10, 8, 1],
  [11, 10, 0], [12, 8, 2], [13, 12, 0], [14, 12, 1], [15, 14, 0],
];

export interface EcrecoverWitness {
  negZ: bigint; rr: bigint; ss: bigint; recPar: bigint;
  rinv: bigint; Ry: bigint; phiRx: bigint;
  t1a: bigint; t2a: bigint; t1b: bigint; t2b: bigint;
  masks: Uint8Array;          // 128 bytes, one nibble-mask per GLV bit (MSB first)
  table: Uint8Array;          // 16 * 66 bytes: sign-adjusted GLV base-combination table (affine x||y, 33 each)
  invb: Uint8Array;           // 11 * 33 bytes: affine-add inverses for the on-chain table check
  start: number;              // index of the first non-zero mask (ladder init = table[masks[start]])
  checkpoints: Uint8Array[];  // cumulative Jacobian ladder state (99 B each) at every step, for any split point
  zinv: Uint8Array;           // Z^-1 of the final Jacobian point (affine conversion witness for B), as a VM number
  compressedQ: Uint8Array;    // 34-byte recovered pubkey commitment: parity(0x02/0x03) || Qx (33-byte LE VM number)
  uncompressedPubkey: Uint8Array; // 64-byte Qx||Qy big-endian (the EVM keccak preimage; no 0x04 prefix)
  argBlob: Uint8Array;        // hash(32) || v(1) || r(32) || s(32) LE - what the master binds
}

/**
 * Compute all recovery-side-car witnesses for (hash, v, r, s). `hash`/`r`/`s` are 32-byte LITTLE-endian (BCH-native;
 * the SDK reverses ethers big-endian before calling); v is 27/28. argBlob echoes the LE bytes verbatim.
 */
export function computeEcrecoverWitness(hash: Uint8Array, v: number, r: Uint8Array, s: Uint8Array): EcrecoverWitness {
  const leBig = (b: Uint8Array): bigint => {
    let x = 0n;
    for (let i = b.length - 1; i >= 0; i--) x = (x << 8n) | BigInt(b[i]);
    return x;
  };
  const rr = leBig(r), ss = leBig(s), rec = v - 27, z = mod(leBig(hash), N);
  const Fp = (secp256k1.CURVE as unknown as { Fp: { sqrt: (a: bigint) => bigint } }).Fp;
  const y = Fp.sqrt(mod(mod(rr * rr, P) * rr + 7n, P));
  const Ry = (y & 1n) === BigInt(rec & 1) ? y : mod(P - y, P);
  const rinv = inv(rr, N), u1 = mod(mod(-z, N) * rinv, N), u2 = mod(ss * rinv, N), phiRx = mod(BETA * rr, P);
  const sp1 = splitScalar(u1), sp2 = splitScalar(u2);
  const t1a = recTerm(sp1.k1neg, sp1.k1), t2a = recTerm(sp1.k2neg, sp1.k2);
  const t1b = recTerm(sp2.k1neg, sp2.k1), t2b = recTerm(sp2.k2neg, sp2.k2);
  const scalars = [sp1.k1, sp1.k2, sp2.k1, sp2.k2];
  const masks = new Uint8Array(128);
  for (let i = 127; i >= 0; i--) {
    let m = 0;
    for (let j = 0; j < 4; j++) if ((scalars[j] >> BigInt(i)) & 1n) m |= 1 << j;
    masks[127 - i] = m;
  }
  const neg = (x: bigint, ny: bigint, isNeg: boolean): { x: bigint; y: bigint } => ({ x, y: isNeg ? mod(-ny, P) : ny });
  const PHIGX = mod(BETA * GX, P);
  const bases = [neg(GX, GY, sp1.k1neg), neg(PHIGX, GY, sp1.k2neg), neg(rr, Ry, sp2.k1neg), neg(phiRx, Ry, sp2.k2neg)]
    .map((b) => Point.fromAffine({ x: b.x, y: b.y }));
  const ta: ({ x: bigint; y: bigint } | null)[] = [];
  for (let m = 0; m < 16; m++) {
    let acc: typeof bases[0] | null = null;
    for (let i = 0; i < 4; i++) if (m & (1 << i)) acc = acc ? acc.add(bases[i]) : bases[i];
    ta.push(acc ? acc.toAffine() : null);
  }
  const table = new Uint8Array(16 * 66);
  for (let m = 1; m < 16; m++) { table.set(to33(ta[m]!.x), m * 66); table.set(to33(ta[m]!.y), m * 66 + 33); }
  const basesAff = bases.map((b) => b.toAffine());
  const invb = new Uint8Array(COMPOSITES.length * 33);
  COMPOSITES.forEach(([, pred, bi], k) => invb.set(to33(inv(mod(basesAff[bi].x - ta[pred]!.x, P), P)), k * 33));
  const start = masks.findIndex((m) => m !== 0), rest = Array.from(masks.slice(start + 1));
  const accBlob = ([X, Y, Z]: Jac): Uint8Array => {
    const b = new Uint8Array(99);
    b.set(to33(X), 0); b.set(to33(Y), 33); b.set(to33(Z), 66);
    return b;
  };
  const checkpoints: Uint8Array[] = [];
  let acc: Jac = [ta[masks[start]]!.x, ta[masks[start]]!.y, 1n];
  checkpoints.push(accBlob(acc));
  for (let i = 0; i < rest.length; i++) {
    acc = jDbl(acc);
    const m = rest[i];
    if (m) acc = jAdd(acc, ta[m]!.x, ta[m]!.y);
    checkpoints.push(accBlob(acc));
  }
  const zi = inv(acc[2], P), z2 = mod(zi * zi, P);
  const Qx = mod(acc[0] * z2, P), Qy = mod(acc[1] * z2 * zi, P);
  // matches the covenant commitment: parity byte (0x02/0x03) || Qx as a 33-byte VM number (little-endian)
  const compressedQ = new Uint8Array(34);
  compressedQ[0] = 2 + Number(Qy & 1n);
  compressedQ.set(to33(Qx), 1);
  // the uncompressed pubkey (Qx || Qy, 32-byte big-endian each, NO 0x04 prefix) = the EVM keccak preimage; ecrecoverEvm
  // co-spends a keccak side-car over this and the master binds compress(it) == the recovered compressed key.
  const to32BE = (x: bigint): Uint8Array => {
    const b = new Uint8Array(32);
    for (let i = 31; i >= 0; i--, x >>= 8n) b[i] = Number(x & 0xffn);
    return b;
  };
  const uncompressedPubkey = new Uint8Array(64);
  uncompressedPubkey.set(to32BE(Qx), 0); uncompressedPubkey.set(to32BE(Qy), 32);
  const vmNum = (x: bigint): Uint8Array => {
    if (x === 0n) return new Uint8Array(0);
    const b: number[] = [];
    let n = x;
    while (n > 0n) { b.push(Number(n & 0xffn)); n >>= 8n; }
    if (b[b.length - 1] & 0x80) b.push(0);
    return Uint8Array.from(b);
  };
  const argBlob = new Uint8Array(97); argBlob.set(hash, 0); argBlob[32] = v; argBlob.set(r, 33); argBlob.set(s, 65);
  return {
    negZ: mod(-z, N), rr, ss, recPar: BigInt(rec & 1), rinv, Ry, phiRx,
    t1a, t2a, t1b, t2b, masks, table, invb, start, checkpoints,
    zinv: vmNum(inv(acc[2], P)), compressedQ, uncompressedPubkey, argBlob,
  };
}
