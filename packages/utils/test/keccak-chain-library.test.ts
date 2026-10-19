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
  KECCAK_CHAIN_START_COVENANT_STATELESS,
  KECCAK_CHAIN_START_COVENANT_STATELESS_HASH,
  KECCAK_CHAIN_CONT_COVENANT_STATELESS,
  KECCAK_CHAIN_CONT_COVENANT_STATELESS_HASH,
  KECCAK_CHAIN_FINAL_COVENANT_STATELESS,
  KECCAK_CHAIN_FINAL_COVENANT_STATELESS_HASH,
  buildKeccakChainRedeem,
  keccakChainLockingBytecode,
  splitKeccakChainBlocks,
  planKeccakChain,
  keccakChainCommitments,
} from '../src/keccak-compute-library.js';
import { hash256 } from '../src/hash.js';

const vm = createVirtualMachineBch2026();
const C = new Uint8Array(32);            // shared salt
const K = Uint8Array.from({ length: 32 }, (_v, i) => (i === 31 ? 0x44 : 0xbb)); // side-car NFT category

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

// Reference keccak-f[1600] (25 BigInt lanes) - the intermediate sponge state oracle.
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
    const CLanes = [0n, 0n, 0n, 0n, 0n];
    for (let x = 0; x < 5; x++) CLanes[x] = A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20];
    const D = [0n, 0n, 0n, 0n, 0n];
    for (let x = 0; x < 5; x++) D[x] = CLanes[(x + 4) % 5] ^ rotl(CLanes[(x + 1) % 5], 1);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x + 5 * y] ^= D[x];
    const B = new Array<bigint>(25).fill(0n);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(A[x + 5 * y], ROT[x][y]);
    }
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      const otherLanes = ~B[((x + 1) % 5) + 5 * y] & B[((x + 2) % 5) + 5 * y];
      A[x + 5 * y] = (B[x + 5 * y] ^ (otherLanes & MASK)) & MASK;
    }
    A[0] ^= RC[round];
  }
  return A;
}
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
  for (let i = 24; i >= 0; i--) for (let b = 7; b >= 0; b--) bytes.push(Number((state[i] >> BigInt(8 * b)) & 0xffn));
  return Uint8Array.from(bytes);
}

function evalChain(length: number, stateful = false): string | undefined {
  const preimage = new Uint8Array(length);
  for (let i = 0; i < length; i++) preimage[i] = (i * 13 + 7) & 0xff;
  const plan = planKeccakChain(preimage);
  const locks = plan.map((s) => keccakChainLockingBytecode(C, s.kind, stateful));

  let state = new Array<bigint>(25).fill(0n);
  const intermediates: Uint8Array[] = [];
  for (let off = 0; off < preimage.length - (preimage.length % 136); off += 136) {
    state = absorbBlock(state, preimage.slice(off, off + 136));
    intermediates.push(commitState(state));
  }
  const digest = keccak_256(preimage);

  const n = plan.length;
  const outputs = plan.map((s, i) => ({
    lockingBytecode: locks[i], valueSatoshis: 100000n,
    token: tok(s.kind === 'final' ? digest : intermediates[i]),
  }));
  const sourceOutputs = plan.map((_s, i) => ({
    lockingBytecode: locks[i], valueSatoshis: 100000n, token: tok(new Uint8Array(0)),
  }));
  const inputs = plan.map((s, i) => {
    const redeem = buildKeccakChainRedeem(C, s.kind, stateful);
    const pad = new Uint8Array(3200);
    // FINAL carries the FULL preimage + width 1 (the contract decoder shape); start/cont carry their block.
    const data = s.kind === 'final'
      ? Uint8Array.from([...push(pad), ...push(preimage), 0x51, ...push(redeem)])
      : Uint8Array.from([...push(s.block), ...push(pad), ...push(redeem)]);
    return {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(i + 1),
      sequenceNumber: 0xffffffff, unlockingBytecode: data,
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
      [KECCAK_CHAIN_START_COVENANT_STATELESS, KECCAK_CHAIN_START_COVENANT_STATELESS_HASH],
      [KECCAK_CHAIN_CONT_COVENANT_STATELESS, KECCAK_CHAIN_CONT_COVENANT_STATELESS_HASH],
      [KECCAK_CHAIN_FINAL_COVENANT_STATELESS, KECCAK_CHAIN_FINAL_COVENANT_STATELESS_HASH],
    ] as const) {
      expect(binToHex(hash256(hexToBin(cov)))).toBe(hash);
    }
  });

  it('splitKeccakChainBlocks and planKeccakChain split on the 136-byte keccak rate', () => {
    expect(splitKeccakChainBlocks(0)).toEqual({ fullBlocks: 0, remainder: 0, total: 1 });
    expect(splitKeccakChainBlocks(136)).toEqual({ fullBlocks: 1, remainder: 0, total: 2 });
    expect(splitKeccakChainBlocks(408)).toEqual({ fullBlocks: 3, remainder: 0, total: 4 });
    expect(() => splitKeccakChainBlocks(-1)).toThrow();
    const plan = planKeccakChain(new Uint8Array(600));
    expect(plan.map((s) => s.kind)).toEqual(['start', 'cont', 'cont', 'cont', 'final']);
    expect(plan.every((s) => s.kind !== 'final' ? s.block.length === 136 : s.block.length === 600 - 4 * 136)).toBe(true);
    // a sub-136 preimage is a single SOLO final side-car
    expect(planKeccakChain(new Uint8Array(100)).map((s) => s.kind)).toEqual(['final']);
  });

  it('chain redeem = OP_PUSHBYTES_32 || salt || covenant; locking is P2SH32 (stateful + stateless)', () => {
    for (const stateful of [false, true]) {
      const redeem = buildKeccakChainRedeem(C, 'final', stateful);
      expect(redeem[0]).toBe(0x20);
      expect(binToHex(redeem.slice(1, 33))).toBe(binToHex(C));
      const lock = keccakChainLockingBytecode(C, 'final', stateful);
      expect(lock[0]).toBe(0xaa);
      expect(lock[1]).toBe(0x20);
      expect(lock[34]).toBe(0x87);
      expect(lock.length).toBe(35);
    }
  });

  it('a 5-side-car stateless chain hashes a 600-byte preimage matching EVM', () => {
    expect(evalChain(600, false)).toBeUndefined();
  });

  it('a 5-side-car stateful chain hashes a 600-byte preimage matching EVM', () => {
    expect(evalChain(600, true)).toBeUndefined();
  });

  it('keccakChainCommitments final digest matches noble and has one commitment per side-car', () => {
    const preimage = new Uint8Array(600);
    for (let i = 0; i < 600; i++) preimage[i] = (i * 13 + 7) & 0xff;
    const commitments = keccakChainCommitments(preimage);
    expect(commitments.length).toBe(5);              // 4 full blocks + final digest
    expect(commitments.slice(0, 4).every((c) => c.length === 200)).toBe(true);
    expect(binToHex(commitments[4])).toBe(binToHex(keccak_256(preimage)));
  });
});
