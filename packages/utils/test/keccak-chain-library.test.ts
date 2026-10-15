import { describe, it, expect } from 'vitest';
import { binToHex, createVirtualMachineBch2026 } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import {
  KECCAK_CHAIN_START_COVENANT,
  KECCAK_CHAIN_START_COVENANT_HASH,
  KECCAK_CHAIN_CONT_COVENANT,
  KECCAK_CHAIN_CONT_COVENANT_HASH,
  KECCAK_CHAIN_FINAL_COVENANT,
  KECCAK_CHAIN_FINAL_COVENANT_HASH,
  buildKeccakChainRedeem,
  keccakChainLockingBytecode,
  splitKeccakChainBlocks,
} from '../src/keccak-compute-library.js';
import { hash256 } from '../src/hash.js';

const vm = createVirtualMachineBch2026();
const C = new Uint8Array(32);            // shared salt
const K = new Uint8Array(32).fill(0xbb); // side-car NFT category

const hexToBin = (h: string): Uint8Array => Uint8Array.from(h.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
const push = (data: Uint8Array): Uint8Array => {
  const n = data.length;
  if (n === 0) return Uint8Array.of(0x00);
  if (n <= 75) return Uint8Array.from([n, ...data]);
  if (n <= 255) return Uint8Array.from([0x4c, n, ...data]);
  return Uint8Array.from([0x4d, n & 0xff, (n >> 8) & 0xff, ...data]);
};
const tok = (commitment: Uint8Array): any =>
  ({ category: K, amount: 0n, nft: { capability: 'mutable', commitment } });

// Reference keccak-f[1600] (25 BigInt lanes, little-endian) - the correctness oracle for the intermediate
// sponge states; the final digest is cross-checked against noble's keccak_256.
const MASK = (1n << 64n) - 1n;
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
const ROT = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]];
const rotl = (x: bigint, n: number): bigint => n === 0 ? x : (((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK);
function keccakF(state: bigint[]): bigint[] {
  const A = [...state];
  for (let round = 0; round < 24; round++) {
    const C = [0n, 0n, 0n, 0n, 0n];
    for (let x = 0; x < 5; x++) C[x] = A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20];
    const D = [0n, 0n, 0n, 0n, 0n];
    for (let x = 0; x < 5; x++) D[x] = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x + 5 * y] ^= D[x];
    const B = new Array<bigint>(25).fill(0n);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(A[x + 5 * y], ROT[x][y]);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      A[x + 5 * y] = (B[x + 5 * y] ^ ((~B[((x + 1) % 5) + 5 * y] & B[((x + 2) % 5) + 5 * y]) & MASK)) & MASK;
    }
    A[0] ^= RC[round];
  }
  return A;
}
// Reference sponge step: absorb one 136-byte block into 25 LE lanes, one keccak-f[1600].
function absorbBlock(state: bigint[], block: Uint8Array): bigint[] {
  const next = [...state];
  for (let i = 0; i < 17; i++) {
    let lane = 0n;
    for (let b = 0; b < 8; b++) lane |= BigInt(block[i * 8 + b]) << BigInt(8 * b);
    next[i] ^= lane;
  }
  return keccakF(next);
}
// Commitment byte order = lane24 || ... || lane0, each lane 8 bytes big-endian.
function commitState(state: bigint[]): Uint8Array {
  const bytes: number[] = [];
  for (let i = 24; i >= 0; i--) {
    for (let b = 7; b >= 0; b--) bytes.push(Number((state[i] >> BigInt(8 * b)) & 0xffn));
  }
  return Uint8Array.from(bytes);
}

function chainBlockPlan(length: number): Array<{ kind: 'start' | 'cont' | 'final'; data: Uint8Array }> {
  const { fullBlocks, remainder } = splitKeccakChainBlocks(length);
  const preimage = new Uint8Array(length);
  for (let i = 0; i < length; i++) preimage[i] = (i * 13 + 7) & 0xff;
  const plan: Array<{ kind: 'start' | 'cont' | 'final'; data: Uint8Array }> = [];
  for (let off = 0; off < fullBlocks * 136; off += 136) {
    plan.push({ kind: plan.length === 0 ? 'start' : 'cont', data: preimage.slice(off, off + 136) });
  }
  plan.push({ kind: 'final', data: preimage.slice(fullBlocks * 136, fullBlocks * 136 + remainder) });
  return plan;
}

function evalChain(length: number): string | undefined {
  const plan = chainBlockPlan(length);
  const locks2 = plan.map((s) => keccakChainLockingBytecode(C, s.kind));

  // Oracle states.
  const preimage = new Uint8Array(length);
  for (let i = 0; i < length; i++) preimage[i] = (i * 13 + 7) & 0xff;
  let state = new Array<bigint>(25).fill(0n);
  const intermediates: Uint8Array[] = [];
  for (let off = 0; off < preimage.length - (preimage.length % 136); off += 136) {
    state = absorbBlock(state, preimage.slice(off, off + 136));
    intermediates.push(commitState(state));
  }
  const digest = keccak_256(preimage);

  const n = plan.length;
  const outputs = plan.map((s, i) => {
    const commitment = s.kind === 'final' ? digest : intermediates[i];
    return { lockingBytecode: locks2[i], valueSatoshis: 100000n, token: tok(commitment) };
  });
  const sourceOutputs = plan.map((s, i) => ({
    lockingBytecode: locks2[i], valueSatoshis: 100000n, token: tok(new Uint8Array(0)),
  }));
  const inputs = plan.map((s, i) => {
    const redeem = buildKeccakChainRedeem(C, s.kind);
    const pad = new Uint8Array(3200);
    return {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(i + 1),
      sequenceNumber: 0xffffffff, unlockingBytecode: Uint8Array.from([...push(s.data), ...push(pad), ...push(redeem)]),
    };
  });
  const transaction = { version: 2, locktime: 0, inputs, outputs } as any;
  for (let i = 0; i < n; i++) {
    const st = vm.evaluate({ inputIndex: i, sourceOutputs, transaction } as any);
    if (typeof st.error === 'string') return `input ${i}: ${st.error}`;
  }
  return undefined;
}

describe('keccak chained compute side-cars (utils)', () => {
  it('chained covenant hashes match the baked integrity constants', () => {
    for (const [cov, hash] of [
      [KECCAK_CHAIN_START_COVENANT, KECCAK_CHAIN_START_COVENANT_HASH],
      [KECCAK_CHAIN_CONT_COVENANT, KECCAK_CHAIN_CONT_COVENANT_HASH],
      [KECCAK_CHAIN_FINAL_COVENANT, KECCAK_CHAIN_FINAL_COVENANT_HASH],
    ] as const) {
      expect(binToHex(hash256(hexToBin(cov)))).toBe(hash);
    }
    expect(hexToBin(KECCAK_CHAIN_START_COVENANT).length).toBe(2400);
    expect(hexToBin(KECCAK_CHAIN_CONT_COVENANT).length).toBe(2226);
    expect(hexToBin(KECCAK_CHAIN_FINAL_COVENANT).length).toBe(2211);
  });

  it('splitKeccakChainBlocks splits on the 136-byte keccak rate with a pad-only final block', () => {
    expect(splitKeccakChainBlocks(0)).toEqual({ fullBlocks: 0, remainder: 0, total: 1 });
    expect(splitKeccakChainBlocks(135)).toEqual({ fullBlocks: 0, remainder: 135, total: 1 });
    expect(splitKeccakChainBlocks(136)).toEqual({ fullBlocks: 1, remainder: 0, total: 2 });
    expect(splitKeccakChainBlocks(137)).toEqual({ fullBlocks: 1, remainder: 1, total: 2 });
    expect(splitKeccakChainBlocks(408)).toEqual({ fullBlocks: 3, remainder: 0, total: 4 });
    expect(() => splitKeccakChainBlocks(-1)).toThrow();
  });

  it('chain redeem = OP_PUSHBYTES_32 || salt || covenant; locking is P2SH32', () => {
    const redeem = buildKeccakChainRedeem(C, 'final');
    expect(redeem[0]).toBe(0x20);
    expect(binToHex(redeem.slice(1, 33))).toBe(binToHex(C));
    const lock = keccakChainLockingBytecode(C, 'final');
    expect(lock[0]).toBe(0xaa);
    expect(lock[1]).toBe(0x20);
    expect(lock[34]).toBe(0x87);
    expect(lock.length).toBe(35);
  });

  it('a 2-side-car chain (start+final) hashes a 136-byte preimage matching EVM', () => {
    expect(evalChain(136)).toBeUndefined();
  });

  it('a 5-side-car chain hashes a 600-byte preimage matching EVM', () => {
    expect(evalChain(600)).toBeUndefined();
  });
});
