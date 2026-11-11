import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { SHARED_LIBRARY_SALT, ecrecoverComputeLockingBytecode } from '@solidcash/utils';
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  buildEcrecoverVerifySidecar, computeEcrecoverVerifyWitness, type EcrecoverVerifyWitness,
} from '../../../src/ecrecover/ecrecoverVerifySidecar.js';

/**
 * The recovery side-car a framed body co-spends (covenant V), spent on the machine as the P2SH32 input it is.
 *
 * V accepts the key `ecrecover` gives and commits it, and refuses any other key, even one whose own witnesses are
 * consistent: the key of the other recovery id, which passes V's first check and fails its second, and a random
 * key, which fails its first. The forgeries rebuild the witness blob field by field, as an adversary would.
 */

const CATEGORY = 'ee'.repeat(31) + '11';
const UTXO = {
  txid: 'aa'.repeat(32), vout: 1, satoshis: 100_000n,
  token: { category: CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
} as never;
const P = 2n ** 256n - 2n ** 32n - 977n;
const FIELDS = ['Qx', 'Qy', 'Ry', 'rinv', 'D1x', 'D1y', 'inv1', 'gInv', 'r2inv', 'D2x', 'D2y', 'inv2'] as const;
type Fields = Record<(typeof FIELDS)[number], bigint>;

const leBytes = (hex: string): Uint8Array => hexToBin(hex.replace(/^0x/, '')).slice().reverse();
const unsigned = (bytes: Uint8Array): bigint => bytes.reduceRight((value, byte) => (value << 8n) | BigInt(byte), 0n);
const word33 = (value: bigint): Uint8Array =>
  Uint8Array.from({ length: 33 }, (_, index) => Number((value >> BigInt(8 * index)) & 0xffn));
const inverse = (value: bigint): bigint => {
  let result = 1n;
  for (let b = ((value % P) + P) % P, e = P - 2n; e > 0n; b = (b * b) % P, e >>= 1n) if (e & 1n) result = (result * b) % P;
  return result;
};

/** The fields of a witness blob, and the message bytes after them. */
function fieldsOf(witness: EcrecoverVerifyWitness): { fields: Fields; messages: Uint8Array } {
  const fields = Object.fromEntries(FIELDS.map((name, index) =>
    [name, unsigned(witness.witnessBlob.slice(33 * index, 33 * index + 33))])) as Fields;
  return { fields, messages: witness.witnessBlob.slice(33 * FIELDS.length) };
}

/** The witness with its key replaced by `key`, every inverse that reads the key recomputed for it. */
function forged(witness: EcrecoverVerifyWitness, key: { x: bigint; y: bigint }): EcrecoverVerifyWitness {
  const { fields, messages } = fieldsOf(witness);
  const next: Fields = {
    ...fields, Qx: key.x, Qy: key.y, inv1: inverse(fields.D1x - key.x), inv2: inverse(fields.D2x - key.x),
  };
  const witnessBlob = Uint8Array.from([...FIELDS.flatMap((name) => [...word33(next[name])]), ...messages]);
  return { ...witness, witnessBlob, compressedQ: Uint8Array.from([2 + Number(key.y & 1n), ...word33(key.x)]) };
}

/** A digest the key `name` names signs, with the little-endian scalars the builtin takes. */
function signed(name: string): { h: Uint8Array; v: number; r: Uint8Array; s: Uint8Array; key: ethers.SigningKey } {
  const wallet = new ethers.Wallet(ethers.sha256(ethers.toUtf8Bytes(name)));
  const digest = ethers.keccak256(ethers.toUtf8Bytes(`permit by ${name}`));
  const { r, s, v } = wallet.signingKey.sign(digest);
  return { h: leBytes(digest), v, r: leBytes(r), s: leBytes(s), key: wallet.signingKey };
}

/** Whether V, spent at input 1 over `witness` and recreated with `commitment`, is accepted. */
function accepts(witness: EcrecoverVerifyWitness, commitment = witness.compressedQ): boolean {
  const { unlocker, recreate } = buildEcrecoverVerifySidecar(witness, SHARED_LIBRARY_SALT, UTXO);
  const lock = ecrecoverComputeLockingBytecode(SHARED_LIBRARY_SALT, 'V');
  const token = (bytes: Uint8Array): never =>
    ({ category: hexToBin(CATEGORY), amount: 0n, nft: { capability: 'mutable', commitment: bytes } }) as never;
  const input = (index: number, unlockingBytecode: Uint8Array): never => ({
    outpointIndex: index, outpointTransactionHash: new Uint8Array(32).fill(index + 1), sequenceNumber: 0xffffffff,
    unlockingBytecode,
  }) as never;
  const transaction = {
    version: 2, locktime: 0,
    inputs: [input(0, new Uint8Array(0)), input(1, unlocker.generateUnlockingBytecode({} as never))],
    outputs: [
      { lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1_000n },
      { lockingBytecode: lock, valueSatoshis: recreate.amount, token: token(commitment) },
    ],
  };
  const sourceOutputs = [
    { lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1_000n },
    { lockingBytecode: lock, valueSatoshis: 100_000n, token: token(new Uint8Array(0)) },
  ];
  const machine = compositionMachine();
  return machine.stateSuccess(machine.evaluate({ inputIndex: 1, sourceOutputs, transaction } as never)) === true;
}

describe('the recovery side-car a framed body co-spends', () => {
  it('accepts the key ecrecover gives, and commits it compressed', () => {
    for (const name of ['recovery key 1', 'recovery key 2', 'recovery key 3']) {
      const { h, v, r, s, key } = signed(name);
      const witness = computeEcrecoverVerifyWitness(h, v, r, s);
      expect(accepts(witness), name).toBe(true);
      const compressed = hexToBin(key.compressedPublicKey.slice(2));
      expect([witness.compressedQ[0], ...witness.compressedQ.slice(1, 33).reverse(), witness.compressedQ[33]], name)
        .toStrictEqual([...compressed, 0]);
      expect(witness.uncompressedPubkey, name).toStrictEqual(hexToBin(key.publicKey.slice(4)));
    }
  });

  it('refuses the key of the other recovery id and a random key, each with consistent witnesses', () => {
    const { h, v, r, s } = signed('recovery key 1');
    const witness = computeEcrecoverVerifyWitness(h, v, r, s);
    const other = computeEcrecoverVerifyWitness(h, v === 27 ? 28 : 27, r, s);
    const { fields } = fieldsOf(other);
    const random = secp256k1.ProjectivePoint.BASE.multiply(0x5eed5n).toAffine();
    expect(accepts(forged(witness, { x: fields.Qx, y: fields.Qy }))).toBe(false);
    expect(accepts(forged(witness, random))).toBe(false);
    // The control: the forgery helper itself rebuilds the honest witness.
    const honest = fieldsOf(witness).fields;
    expect(accepts(forged(witness, { x: honest.Qx, y: honest.Qy }))).toBe(true);
  });

  it('refuses a commitment of another key and arguments it was not built over', () => {
    const { h, v, r, s } = signed('recovery key 2');
    const witness = computeEcrecoverVerifyWitness(h, v, r, s);
    const commitment = Uint8Array.from(witness.compressedQ);
    commitment[0] ^= 1;
    expect(accepts(witness, commitment)).toBe(false);
    const argBlob = Uint8Array.from(witness.argBlob);
    argBlob[0] ^= 1;
    expect(accepts({ ...witness, argBlob })).toBe(false);
  });
});
