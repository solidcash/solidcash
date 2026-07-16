import { describe, it, expect } from 'vitest';
import { binToHex, createVirtualMachineBch2026 } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import {
  KECCAK256_COMPUTE_COVENANT,
  KECCAK256_COMPUTE_COVENANT_HASH,
  KECCAK256_COMPUTE_SALT_PREFIX_LENGTH,
  KECCAK256_COMPUTE_PAD_LENGTH,
  buildKeccakComputeRedeem,
  keccakComputeLockingBytecode,
  keccakComputeResultCommitment,
} from '../src/keccak-compute-library.js';
import { hash256 } from '../src/hash.js';

const vm = createVirtualMachineBch2026();
const C = new Uint8Array(32).fill(0xcc); // contract (branded) category
const K = new Uint8Array(32).fill(0xbb); // side-car own NFT category

// Minimal data push (direct / PUSHDATA1 / PUSHDATA2).
function push(data: Uint8Array): Uint8Array {
  const n = data.length;
  if (n <= 75) return Uint8Array.from([n, ...data]);
  if (n <= 255) return Uint8Array.from([0x4c, n, ...data]);
  return Uint8Array.from([0x4d, n & 0xff, (n >> 8) & 0xff, ...data]);
}
const tok = (category: Uint8Array, capability: 'none' | 'mutable' | 'minting', commitment: Uint8Array): any =>
  ({ category, amount: 0n, nft: { capability, commitment } });

// Evaluate the side-car (input 1) in a 2-input tx: input0 carries category C (the branded contract),
// input1 is the computing side-car; output1 recreates it with commitment `commitR`.
function evalSidecar(preimage: Uint8Array, commitR: Uint8Array, in0Category: Uint8Array | null = C): string | undefined {
  const redeem = buildKeccakComputeRedeem(C);
  const lock = keccakComputeLockingBytecode(C);
  const pad = new Uint8Array(KECCAK256_COMPUTE_PAD_LENGTH);
  const scUnlock = Uint8Array.from([...push(pad), ...push(preimage), ...push(redeem)]);
  const transaction = {
    version: 2, locktime: 0,
    inputs: [
      { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32), sequenceNumber: 0xffffffff, unlockingBytecode: Uint8Array.from([0x51]) },
      { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff, unlockingBytecode: scUnlock },
    ],
    outputs: [
      { lockingBytecode: new Uint8Array(25), valueSatoshis: 1000n },
      { lockingBytecode: lock, valueSatoshis: 100000n, token: tok(K, 'mutable', commitR) },
    ],
  };
  const sourceOutputs = [
    { lockingBytecode: Uint8Array.from([0x51]), valueSatoshis: 100000n, token: in0Category ? tok(in0Category, 'mutable', new Uint8Array(0)) : undefined },
    { lockingBytecode: lock, valueSatoshis: 100000n, token: tok(K, 'mutable', new Uint8Array(0)) },
  ];
  const st = vm.evaluate({ inputIndex: 1, sourceOutputs, transaction } as any);
  return typeof st.error === 'string' ? st.error : undefined;
}

describe('keccak compute-and-commit side-car (utils)', () => {
  it('COVENANT hash matches the baked integrity constant', () => {
    const covBytes = Uint8Array.from(KECCAK256_COMPUTE_COVENANT.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    expect(binToHex(hash256(covBytes))).toBe(KECCAK256_COMPUTE_COVENANT_HASH);
    expect(covBytes.length).toBe(2390);
  });

  it('redeem = OP_PUSHBYTES_32 || salt || COVENANT; salt-independent covenant', () => {
    const redeem = buildKeccakComputeRedeem(C);
    expect(redeem[0]).toBe(0x20);
    expect(binToHex(redeem.slice(1, 33))).toBe(binToHex(C));
    expect(KECCAK256_COMPUTE_SALT_PREFIX_LENGTH).toBe(33);
    // the covenant portion is identical regardless of salt (branded vs shared)
    const shared = buildKeccakComputeRedeem(new Uint8Array(32));
    expect(binToHex(redeem.slice(33))).toBe(binToHex(shared.slice(33)));
  });

  it('locking bytecode is P2SH32', () => {
    const lock = keccakComputeLockingBytecode(C);
    expect(lock[0]).toBe(0xaa);
    expect(lock[1]).toBe(0x20);
    expect(lock[34]).toBe(0x87);
    expect(lock.length).toBe(35);
  });

  it('result commitment is the 32-byte hash verbatim (EVM byte order)', () => {
    const h = keccak_256(new Uint8Array(32));
    expect(binToHex(keccakComputeResultCommitment(h))).toBe(binToHex(h));
    expect(() => keccakComputeResultCommitment(new Uint8Array(31))).toThrow();
  });

  it('side-car computes keccak256 matching EVM and commits it (VM e2e)', () => {
    const vectors = [
      new Uint8Array(32),
      new Uint8Array(32).fill(0x11),
      Uint8Array.from(Buffer.from('deadbeefcafebabe0102030405060708090a0b0c0d0e0f101112131415161718', 'hex')),
    ];
    for (const P of vectors) {
      const R = keccak_256(P);
      expect(evalSidecar(P, R)).toBeUndefined(); // no error -> covenant accepts the correct commitment
    }
  });

  it('rejects a wrong committed hash', () => {
    expect(evalSidecar(new Uint8Array(32).fill(0x11), keccak_256(new Uint8Array(32)))).toBeDefined();
  });

  it('rejects a spend without the branded category-C input (isolation)', () => {
    const P = new Uint8Array(32).fill(0x11);
    expect(evalSidecar(P, keccak_256(P), null)).toBeDefined();
    expect(evalSidecar(P, keccak_256(P), new Uint8Array(32).fill(0xee))).toBeDefined();
  });
});
