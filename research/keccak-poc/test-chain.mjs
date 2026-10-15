// End-to-end chained keccak on the real VM: a >407-byte preimage split across START/CONT/FINAL
// side-cars whose covenants each verify their own absorb transition on-chain.
import { keccak_256 } from '@noble/hashes/sha3.js';
import { keccakF } from './keccak.mjs';
import { binToHex, hexToBin, evalInput } from './sidecar.mjs';
import { START_COVENANT, CONT_COVENANT, FINAL_COVENANT, buildRedeem, lockOf } from './gen-chain-sidecar.mjs';

const be = (v) => v.toString(16).padStart(16, '0');
const ZERO = new Uint8Array(8);

// Oracle sponge: state = 25 BigInt lanes (LE values). Absorb a block into lanes 0..16, one keccakF.
function oracleAbsorb(state, block) {
  const A = [...state];
  for (let i = 0; i < 17; i++) {
    let lane = 0n;
    for (let b = 0; b < 8; b++) lane |= BigInt(block[i * 8 + b]) << BigInt(8 * b);
    A[i] ^= lane;
  }
  return keccakF(A, 24);
}
// Script commitment byte order: lane24 || ... || lane0, each lane as its 8-byte BE value.
function commitState(A) {
  let hex = '';
  for (let i = 24; i >= 0; i--) hex += be(A[i]);
  return hexToBin(hex);
}

const C = new Uint8Array(32);                 // shared (zero) salt -> brand check skipped in POC
const K = new Uint8Array(32).fill(0xbb);      // side-car NFT category
const tok = (commitment) => ({ category: K, amount: 0n, nft: { capability: 'mutable', commitment } });
const PAD_LEN = 3200;

function build(preimageHex) {
  const preimage = hexToBin(preimageHex);
  const L = preimage.length;
  const fullBlocks = [];
  for (let off = 0; off + 136 <= L; off += 136) fullBlocks.push(preimage.slice(off, off + 136));
  const remainder = preimage.slice(fullBlocks.length * 136);   // 0..135 bytes
  const expected = keccak_256(preimage);

  // Oracle chain: state after each absorb.
  let state = new Array(25).fill(0n);
  const intermediate = [];  // commitment after each FULL block
  for (const blk of fullBlocks) { state = oracleAbsorb(state, blk); intermediate.push(commitState(state)); }

  const covenants = [START_COVENANT, ...fullBlocks.slice(1).map(() => CONT_COVENANT), FINAL_COVENANT];
  const n = covenants.length;   // == fullBlocks.length + 1
  if (n < 2) throw new Error('chaining test needs >= 2 side-cars');

  const locks = covenants.map((c) => lockOf(C, c));
  // Build unlocking with proper data pushes: <pad> <block> <redeem>.
  const pushData = (data) => {
    const n = data.length;
    if (n === 0) return Uint8Array.from([0x00]);
    if (n === 1 && data[0] >= 1 && data[0] <= 16) return Uint8Array.from([0x50 + data[0]]);
    if (n === 1 && data[0] === 0x81) return Uint8Array.from([0x4f]);
    if (n <= 75) return Uint8Array.from([n, ...data]);
    if (n <= 255) return Uint8Array.from([0x4c, n, ...data]);
    return Uint8Array.from([0x4d, n & 0xff, (n >> 8) & 0xff, ...data]);
  };
  const inputUnlockings = covenants.map((c, i) => {
    const block = i < fullBlocks.length ? fullBlocks[i] : remainder;
    // FINAL is mode-aware: mode 1 = final (previous committed state). Push [mode, block, pad, redeem].
    if (i === fullBlocks.length) {
      return Uint8Array.from([0x51, ...pushData(block), ...pushData(new Uint8Array(PAD_LEN)), ...pushData(buildRedeem(C, c))]);
    }
    return Uint8Array.from([...pushData(block), ...pushData(new Uint8Array(PAD_LEN)), ...pushData(buildRedeem(C, c))]);
  });

  // Outputs: recreate each side-car, committing intermediate state or final digest.
  const outputs = covenants.map((c, i) => {
    const commitment = i < fullBlocks.length ? intermediate[i] : expected;
    return { lockingBytecode: locks[i], valueSatoshis: 100000n, token: tok(commitment) };
  });
  const sourceOutputs = covenants.map((c, i) => ({
    lockingBytecode: locks[i], valueSatoshis: 100000n, token: tok(new Uint8Array(0)),
  }));
  const inputs = inputUnlockings.map((unlockingBytecode, i) => ({
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(i + 1),
    sequenceNumber: 0xffffffff, unlockingBytecode,
  }));

  const results = covenants.map((_c, i) => {
    try { return evalInput(inputs, sourceOutputs, outputs, i); }
    catch (err) { return { ok: false, error: 'THREW: ' + (err?.message ?? String(err)).slice(0, 120), stack: [] }; }
  });
  return { n, expected, results };
}

let allOk = true;
for (const L of [136, 272, 408, 600, 1000]) {
  const preimage = new Uint8Array(L);
  for (let i = 0; i < L; i++) preimage[i] = (i * 13 + 7) & 0xff;
  const { n, expected, results } = build(binToHex(preimage));
  const ok = results.every((r) => r.ok);
  allOk = allOk && ok;
  const bad = results.map((r, i) => r.ok ? '' : `[${i}:${r.error?.slice(0, 40)}]`).filter(Boolean).join(' ');
  console.log(`L=${String(L).padStart(4)} sideCars=${n} digestMatch=${binToHex(hexToBin(binToHex(expected))) === binToHex(expected)} ok=${ok}${bad}`);
}
console.log(allOk ? '\nCHAIN OK' : '\nCHAIN FAIL');
