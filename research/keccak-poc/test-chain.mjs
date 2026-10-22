// End-to-end chained keccak on the real VM: a >=136-byte preimage split across START/CONT/FINAL steps of the one
// chain covenant, each verifying its own absorb transition and its link to the previous step on-chain.
import { keccak_256 } from '@noble/hashes/sha3.js';
import { sha256 } from '@bitauth/libauth';
import { keccakF } from './keccak.mjs';
import { binToHex, hexToBin, evalInput } from './sidecar.mjs';
import { CHAIN_COVENANT, MODE, buildRedeem, lockOf } from './gen-chain-sidecar.mjs';

const be = (v) => v.toString(16).padStart(16, '0');

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
// Script state byte order: lane24 || ... || lane0, each lane as its 8-byte BE value.
function stateBytes(A) {
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
  const expected = keccak_256(preimage);

  // Oracle chain: state S and block chain X = sha256(X || block) after each absorb; commitment X || sha256(S).
  let state = new Array(25).fill(0n);
  let link = new Uint8Array(0);
  const states = [];
  const intermediate = [];
  for (const blk of fullBlocks) {
    state = oracleAbsorb(state, blk);
    link = sha256.hash(Uint8Array.from([...link, ...blk]));
    states.push(stateBytes(state));
    intermediate.push(Uint8Array.from([...link, ...sha256.hash(stateBytes(state))]));
  }

  const n = fullBlocks.length + 1;
  if (n < 2) throw new Error('chaining test needs >= 2 side-cars');
  const lock = lockOf(C, CHAIN_COVENANT);
  const redeem = buildRedeem(C, CHAIN_COVENANT);
  const pushData = (data) => {
    const len = data.length;
    if (len === 0) return Uint8Array.from([0x00]);
    if (len === 1 && data[0] >= 1 && data[0] <= 16) return Uint8Array.from([0x50 + data[0]]);
    if (len === 1 && data[0] === 0x81) return Uint8Array.from([0x4f]);
    if (len <= 75) return Uint8Array.from([len, ...data]);
    if (len <= 255) return Uint8Array.from([0x4c, len, ...data]);
    return Uint8Array.from([0x4d, len & 0xff, (len >> 8) & 0xff, ...data]);
  };
  // <pad> <data> <mode> <redeem>: CONT/FINAL reveal the previous state in the first 200 pad bytes; FINAL carries
  // the FULL preimage (the contract-side bind) with mode 1.
  const inputUnlockings = Array.from({ length: n }, (_v, i) => {
    const pad = new Uint8Array(PAD_LEN);
    if (i > 0) pad.set(states[i - 1]);
    const final = i === fullBlocks.length;
    const mode = final ? MODE.final : i === 0 ? MODE.start : MODE.cont;
    return Uint8Array.from([
      ...pushData(pad), ...pushData(final ? preimage : fullBlocks[i]), 0x50 + mode, ...pushData(redeem),
    ]);
  });

  // Outputs: recreate each side-car, committing X || sha256(S) or the final digest.
  const outputs = inputUnlockings.map((_u, i) => ({
    lockingBytecode: lock, valueSatoshis: 100000n, token: tok(i < fullBlocks.length ? intermediate[i] : expected),
  }));
  const sourceOutputs = inputUnlockings.map(() => ({
    lockingBytecode: lock, valueSatoshis: 100000n, token: tok(new Uint8Array(0)),
  }));
  const inputs = inputUnlockings.map((unlockingBytecode, i) => ({
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(i + 1),
    sequenceNumber: 0xffffffff, unlockingBytecode,
  }));

  const results = inputUnlockings.map((_u, i) => {
    try { return evalInput(inputs, sourceOutputs, outputs, i); }
    catch (err) { return { ok: false, error: 'THREW: ' + (err?.message ?? String(err)).slice(0, 120), stack: [] }; }
  });
  return { n, results };
}

let allOk = true;
for (const L of [136, 272, 408, 600, 1000]) {
  const preimage = new Uint8Array(L);
  for (let i = 0; i < L; i++) preimage[i] = (i * 13 + 7) & 0xff;
  const { n, results } = build(binToHex(preimage));
  const ok = results.every((r) => r.ok);
  allOk = allOk && ok;
  const bad = results.map((r, i) => r.ok ? '' : `[${i}:${r.error?.slice(0, 40)}]`).filter(Boolean).join(' ');
  console.log(`L=${String(L).padStart(4)} sideCars=${n} ok=${ok}${bad}`);
}
console.log(allOk ? '\nCHAIN OK' : '\nCHAIN FAIL');
