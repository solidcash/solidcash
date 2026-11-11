// The native-sigcheck recovery side-car (covenant V) a framed body co-spends, one per recovery call, in place of the
// A/B ladder pair. The SDK computes the recovered key off-chain and witnesses it; V checks it with four native
// OP_CHECKDATASIGs and commits it in the form B does. OP_CHECKDATASIG checks a signature over SHA256(m), so each
// ECDSA check runs through a shifted key: (r, s) over the digest z by Q is (r, s) over z1 = SHA256(m1) by
// Q + ((z - z1)/r)G, and a Schnorr check V signs itself proves the shift D1 = ((z - z1)/r)G. Check 1 pins
// W = (z/s)G + (r/s)Q to the two points with x = r; check 2, on W + G against x(R + G), pins the one v selects, and W
// fixes Q. The proven construction and its forgery cases are ecrecover-poc/native.mjs and gen-ecrecover-native.mjs;
// see packages/solidc/docs/ecrecover.md.
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { secp256k1 } from '@noble/curves/secp256k1';
import {
  buildEcrecoverComputeRedeem, ecrecoverComputeLockingBytecode, ecrecoverComputeResultCommitment, sha256,
} from '@solidcash/utils';
import { pushDataBytes } from '../keccak/keccakComputeSidecar.js';
import type { Output, Unlocker, Utxo } from '../interfaces.js';

const N = secp256k1.CURVE.n;
const P = 2n ** 256n - 2n ** 32n - 977n;
const Point = secp256k1.ProjectivePoint;
const G = Point.BASE;
const { x: GX } = G.toAffine();

/** The bytes of V's pad: a framed body reads an off-curve proof in its first (and only) word. */
export const ECRECOVER_VERIFY_PAD_LENGTH = 32;

/** The message bytes a witness tries before it gives up on a degenerate shift, which a random one never hits. */
const MESSAGE_DRAWS = 64;

/** What V reads and commits for one recovery. */
export interface EcrecoverVerifyWitness {
  /** hash(32) || v(1) || r(32) || s(32), the scalars little-endian: the blob the body binds. */
  readonly argBlob: Uint8Array;
  /** Qx Qy Ry rinv D1x D1y inv1 gInv r2inv D2x D2y inv2, each a 33-byte little-endian number, then m1 || m2. */
  readonly witnessBlob: Uint8Array;
  /** parity || Qx as a 33-byte little-endian number: the commitment the body reads. */
  readonly compressedQ: Uint8Array;
  /** Qx || Qy big-endian, the EVM projection's keccak preimage. */
  readonly uncompressedPubkey: Uint8Array;
}

const mod = (a: bigint, m: bigint): bigint => ((a % m) + m) % m;
function powMod(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  for (let b = mod(base, modulus), e = exponent; e > 0n; b = (b * b) % modulus, e >>= 1n) {
    if ((e & 1n) === 1n) result = (result * b) % modulus;
  }
  return result;
}
const inv = (a: bigint, m: bigint): bigint => powMod(a, m - 2n, m);
const littleEndian = (value: bigint, bytes: number): Uint8Array => {
  const word = new Uint8Array(bytes);
  for (let index = 0, x = value; x > 0n; index += 1, x >>= 8n) word[index] = Number(x & 0xffn);
  return word;
};
const unsignedOf = (word: Uint8Array): bigint => {
  let value = 0n;
  for (let index = word.length - 1; index >= 0; index -= 1) value = (value << 8n) | BigInt(word[index]!);
  return value;
};
const bigEndianOf = (digest: Uint8Array): bigint => BigInt(`0x${binToHex(digest)}`);

/**
 * V's witness for `ecrecover(hash, v, r, s)`, the scalars little-endian as the builtin reads them. Throws for a
 * recovery the precompile refuses, and for the cases no V can prove: `r` equal to G's x-coordinate (R + G is then
 * a doubling) and a key at infinity.
 */
export function computeEcrecoverVerifyWitness(
  hash: Uint8Array, v: number, r: Uint8Array, s: Uint8Array,
): EcrecoverVerifyWitness {
  const z = mod(unsignedOf(hash), N), rr = unsignedOf(r), ss = unsignedOf(s);
  if ((v !== 27 && v !== 28) || rr < 1n || rr >= N || ss < 1n || ss >= N) {
    throw new Error('the precompile refuses these recovery scalars');
  }
  const alpha = mod(rr * rr * rr + 7n, P);
  let Ry = powMod(alpha, (P + 1n) / 4n, P);
  if ((Ry * Ry) % P !== alpha) throw new Error('no curve point has r as its x-coordinate');
  if ((Ry & 1n) !== BigInt(v - 27)) Ry = P - Ry;
  if (rr === GX) throw new Error('r is G\'s x-coordinate, which V cannot shift by G');
  const R = Point.fromAffine({ x: rr, y: Ry });
  const rinv = inv(rr, N);
  const recovered = G.multiplyAndAddUnsafe(R, mod(-z * rinv, N), mod(ss * rinv, N));
  if (recovered === undefined) throw new Error('the recovered key is the point at infinity');
  const Q = recovered.toAffine();
  const r2 = mod(R.add(G).toAffine().x, N);
  if (r2 === 0n) throw new Error('x(R + G) is a multiple of the group order');
  const r2inv = inv(r2, N);
  for (let draw = 0; draw < MESSAGE_DRAWS; draw += 1) {
    const m1 = Uint8Array.of(2 * draw + 1), m2 = Uint8Array.of(2 * draw + 2);
    const d1 = mod((z - bigEndianOf(sha256(m1))) * rinv, N);
    const d2 = mod((z + ss - bigEndianOf(sha256(m2)) * rr * r2inv) * rinv, N);
    if (d1 === 0n || d2 === 0n) continue;
    const D1 = G.multiply(d1).toAffine(), D2 = G.multiply(d2).toAffine();
    if (D1.x === Q.x || D2.x === Q.x) continue;
    const fields = [
      Q.x, Q.y, Ry, rinv, D1.x, D1.y, inv(mod(D1.x - Q.x, P), P), inv(mod(GX - rr, P), P), r2inv,
      D2.x, D2.y, inv(mod(D2.x - Q.x, P), P),
    ];
    const uncompressedPubkey = new Uint8Array(64);
    uncompressedPubkey.set(littleEndian(Q.x, 32).reverse(), 0);
    uncompressedPubkey.set(littleEndian(Q.y, 32).reverse(), 32);
    return {
      argBlob: Uint8Array.from([...hash, v, ...r, ...s]),
      witnessBlob: Uint8Array.from([...fields.flatMap((field) => [...littleEndian(field, 33)]), ...m1, ...m2]),
      compressedQ: Uint8Array.from([2 + Number(Q.y & 1n), ...littleEndian(Q.x, 33)]),
      uncompressedPubkey,
    };
  }
  throw new Error(`no message byte in ${MESSAGE_DRAWS} draws gives V a proper shift`);
}

/**
 * Builds V's input and its recreated output for one recovery. `padPrefix` fills the pad, which the covenant only
 * drops: a framed body reads an off-curve proof there. `salt` brands the side-car to the contract.
 */
export function buildEcrecoverVerifySidecar(
  witness: EcrecoverVerifyWitness, salt: Uint8Array, sidecar: Utxo, padPrefix?: Uint8Array,
): { unlocker: Unlocker; recreate: Output } {
  const redeem = buildEcrecoverComputeRedeem(salt, 'V');
  const lock = ecrecoverComputeLockingBytecode(salt, 'V');
  const pad = new Uint8Array(ECRECOVER_VERIFY_PAD_LENGTH);
  if (padPrefix !== undefined) pad.set(padPrefix);
  const unlocker: Unlocker = {
    generateUnlockingBytecode: () => Uint8Array.from([
      ...pushDataBytes(pad), ...pushDataBytes(witness.argBlob), ...pushDataBytes(witness.witnessBlob),
      ...pushDataBytes(redeem),
    ]),
    generateLockingBytecode: () => lock,
  };
  const recreate: Output = {
    to: lock,
    amount: sidecar.satoshis,
    token: {
      category: sidecar.token!.category,
      amount: sidecar.token?.amount ?? 0n,
      nft: { capability: 'mutable', commitment: binToHex(ecrecoverComputeResultCommitment(witness.compressedQ)) },
    },
  };
  return { unlocker, recreate };
}
