import { keccak_256 } from '@noble/hashes/sha3.js';
import { binToHex } from '@bitauth/libauth';
import {
  buildKeccakComputeRedeem, keccakComputeLockingBytecode, KECCAK256_COMPUTE_PAD_LENGTH,
} from '@solidcash/utils';
import type { Unlocker, Utxo, Output } from '../interfaces.js';

export const OP_INPUTBYTECODE = 0xca;

// Decode a small non-negative VM number (little-endian; side-car slot indices are tiny positives).
export function leSmallNumber(bytes: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < bytes.length; i++) n += bytes[i] * 256 ** i;
  return n;
}

// Read the LAST keccak256 side-car read off a contract's VM debug trace: the last executed OP_INPUTBYTECODE
// step whose top-of-stack (the side-car input index) is in the range [base, base+n) is the call the probe
// aborted at (its binding OP_EQUALVERIFY failed on a placeholder). The stack is `[.., arg, idx]`, so the
// preimage `arg` is one below the index; the call's slot is `idx - base` (assign to that call, NOT the loop
// index - nested calls abort in inner-to-outer runtime order, not emission order). Shared by the stateless
// (base TransactionBuilder) and stateful (block-layout-slot) complex/nested-arg probes.
export function extractKeccakPreimageFromTrace(
  trace: unknown[], base: number, n: number,
): { callIndex: number; preimage: Uint8Array } {
  let found: { callIndex: number; preimage: Uint8Array } | undefined;
  for (const s of trace) {
    const step = s as { ip: number; stack: Uint8Array[]; instructions?: { opcode: number }[]; controlStack?: unknown[] };
    if (step.controlStack?.some((c) => c === false)) continue;
    if (step.instructions?.[step.ip]?.opcode !== OP_INPUTBYTECODE) continue;
    if (step.stack.length < 2) continue;
    const idx = leSmallNumber(step.stack[step.stack.length - 1]);
    if (idx >= base && idx < base + n) {
      found = { callIndex: idx - base, preimage: Uint8Array.from(step.stack[step.stack.length - 2]) };
    }
  }
  if (!found) throw new Error('keccak256 preimage extraction: no side-car read found in the probe trace.');
  return found;
}

// Minimal data push (OP_0 / OP_1-16 / OP_1NEGATE / direct / PUSHDATA1 / PUSHDATA2) for hand-built unlocking
// bytecode. Must be minimal or the 2026 VM rejects the input ("Push operations must use the smallest encoding").
export function pushDataBytes(data: Uint8Array): Uint8Array {
  const n = data.length;
  if (n === 0) return Uint8Array.from([0x00]);                       // OP_0 (empty)
  if (n === 1) {
    const b = data[0];
    if (b >= 1 && b <= 16) return Uint8Array.from([0x50 + b]);       // OP_1 .. OP_16
    if (b === 0x81) return Uint8Array.from([0x4f]);                  // OP_1NEGATE
  }
  if (n <= 75) return Uint8Array.from([n, ...data]);
  if (n <= 255) return Uint8Array.from([0x4c, n, ...data]);
  return Uint8Array.from([0x4d, n & 0xff, (n >> 8) & 0xff, ...data]);
}

// The maximum keccak256 preimage a single side-car input can fund (~3 blocks of 136 bytes; the per-input op
// budget tops out near ~8M, ~2.26M op/block).
export function keccakComputeBlocks(preimageLength: number): number {
  return Math.floor(preimageLength / 136) + 1;
}

/**
 * Build one keccak256 compute side-car for a given preimage: the input unlocker feeding
 * `<budget-pad><preimage><PUSHDATA(redeem)>`, the recreation output committing `R = keccak256(preimage)` (EVM
 * byte order) to a mutable NFT, and `R` itself. `salt` is the side-car branding (a stateful contract's category,
 * or the shared 32-zero salt for stateless). Shared by the stateless (TransactionBuilder) and stateful
 * (StatefulContract block-layout-slot) co-spend paths. See docs/keccak-result-nft.md.
 */
export function buildKeccakComputeSidecar(
  preimage: Uint8Array, salt: Uint8Array, sidecar: Utxo, stateful = false,
): { unlocker: Unlocker; recreate: Output; commitment: Uint8Array } {
  const redeem = buildKeccakComputeRedeem(salt, stateful);
  const lock = keccakComputeLockingBytecode(salt, stateful);
  const blocks = keccakComputeBlocks(preimage.length);
  if (blocks > 3) {
    throw new Error(`keccak256 preimage too large (${preimage.length} B = ${blocks} blocks); a single side-car `
      + 'input funds at most 3 keccak blocks (~407 B). Split the hash or use multiple side-cars.');
  }
  // Size the op-budget pad by the block count (~2900 unlocking bytes fund one block); the redeem + preimage
  // pushes already contribute to the per-input budget, so subtract them.
  const redeemPushLen = redeem.length + (redeem.length <= 255 ? 2 : 3);
  const preimagePushLen = preimage.length + (preimage.length <= 75 ? 1 : preimage.length <= 255 ? 2 : 3);
  const padLen = Math.max(KECCAK256_COMPUTE_PAD_LENGTH, blocks * 3100 - redeemPushLen - preimagePushLen);
  const pad = new Uint8Array(padLen);
  const commitment = keccak_256(preimage);
  const unlocker: Unlocker = {
    generateUnlockingBytecode: () => Uint8Array.from(
      [...pushDataBytes(pad), ...pushDataBytes(preimage), ...pushDataBytes(redeem)],
    ),
    generateLockingBytecode: () => lock,
  };
  const recreate: Output = {
    to: lock,
    amount: sidecar.satoshis,
    token: {
      category: sidecar.token!.category,
      amount: sidecar.token?.amount ?? 0n,
      nft: { capability: 'mutable', commitment: binToHex(commitment) },
    },
  };
  return { unlocker, recreate, commitment };
}
