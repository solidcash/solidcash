import { keccak_256 } from '@noble/hashes/sha3.js';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  buildKeccakComputeRedeem, keccakComputeLockingBytecode, KECCAK256_COMPUTE_PAD_LENGTH,
  buildKeccakComputeRedeemLegacy, keccakComputeLockingBytecodeLegacy,
  buildKeccakChainRedeem, keccakChainLockingBytecode, planKeccakChain, keccakChainCommitments,
} from '@solidcash/utils';
import type { Unlocker, Utxo, Output } from '../interfaces.js';

export const OP_INPUTBYTECODE = 0xca;

// Decode a small non-negative VM number (little-endian; side-car slot indices are tiny positives).
export function leSmallNumber(bytes: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < bytes.length; i++) n += bytes[i] * 256 ** i;
  return n;
}

export type KeccakPreimageRead = { callIndex: number; preimage: Uint8Array };

// Every keccak256 side-car read in a contract's VM debug trace, in execution order: each executed
// OP_INPUTBYTECODE step whose top-of-stack (the side-car input index) is in [base, base+slotCount). The stack is
// `[.., arg, ordinal, idx]`: the call is `ordinal - 1` (NOT the side-car slot - nested calls run inner-to-outer,
// not in emission order) and `arg` is the argument its binding OP_EQUALVERIFY compares. A read without an ordinal
// (`[.., arg, idx]`) is assigned to slot `idx - base`.
export function scanKeccakPreimageReads(
  trace: unknown[], base: number, n: number, slotCount = n,
): KeccakPreimageRead[] {
  const reads: KeccakPreimageRead[] = [];
  for (const s of trace) {
    const step = s as { ip: number; stack: Uint8Array[]; instructions?: { opcode: number }[]; controlStack?: unknown[] };
    if (step.controlStack?.some((c) => c === false)) continue;
    if (step.instructions?.[step.ip]?.opcode !== OP_INPUTBYTECODE) continue;
    if (step.stack.length < 2) continue;
    const idx = leSmallNumber(step.stack[step.stack.length - 1]);
    if (idx >= base && idx < base + slotCount) {
      const marker = step.stack.length >= 3 ? leSmallNumber(step.stack[step.stack.length - 2]) : 0;
      reads.push(marker >= 1 && marker <= n
        ? { callIndex: marker - 1, preimage: Uint8Array.from(step.stack[step.stack.length - 3]) }
        : { callIndex: idx - base, preimage: Uint8Array.from(step.stack[step.stack.length - 2]) });
    }
  }
  return reads;
}

// The LAST keccak256 side-car read in the trace: the call the probe aborted at (its binding OP_EQUALVERIFY failed
// on a placeholder). Shared by the stateless (base TransactionBuilder) and stateful (block-layout-slot) probes.
export function extractKeccakPreimageFromTrace(
  trace: unknown[], base: number, n: number, slotCount = n,
  acceptCandidate: (callIndex: number, preimage: Uint8Array) => boolean = () => true,
): KeccakPreimageRead {
  const reads = scanKeccakPreimageReads(trace, base, n, slotCount)
    .filter((read) => acceptCandidate(read.callIndex, read.preimage));
  if (reads.length === 0) throw new Error('keccak256 preimage extraction: no side-car read found in the probe trace.');
  return reads[reads.length - 1];
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Record what one complex/nested-argument probe learned (the side-cars carry the known preimages and the empty
 * placeholder, committed as keccak256 of what they carry). The last read is the call the probe stopped at, so it
 * takes the argument it was bound against. An earlier read of a still-unknown call passed on the placeholder, so its
 * argument (empty) is known as well: without it a call that hashes empty bytes is never resolved, since every later
 * probe ends past it. Returns false when nothing new was learned: the contract stopped for its own reason or never
 * reaches the remaining calls (a short-circuit), and another probe would end the same way.
 */
export function learnKeccakPreimages(
  preimages: (Uint8Array | null)[], reads: readonly KeccakPreimageRead[],
): boolean {
  let learned = false;
  reads.forEach(({ callIndex, preimage }, index) => {
    const known = preimages[callIndex];
    if (known === null || (index === reads.length - 1 && !sameBytes(known, preimage))) {
      preimages[callIndex] = preimage;
      learned = true;
    }
  });
  return learned;
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
 * Build one keccak256 compute side-car for one to three preimages: the input unlocker feeds
 * `<budget-pad><preimage...><width><PUSHDATA(redeem)>`; the recreation commits the ordered digests directly to
 * the same mutable NFT. `salt` is the side-car branding (a stateful contract's category,
 * or the shared 32-zero salt for stateless). Shared by the stateless (TransactionBuilder) and stateful
 * (StatefulContract block-layout-slot) co-spend paths. See docs/keccak-result-nft.md.
 */
export function buildKeccakComputeSidecar(
  preimageOrBatch: Uint8Array | readonly Uint8Array[], salt: Uint8Array, sidecar: Utxo, stateful = false,
  legacy = false,
): { unlocker: Unlocker; recreate: Output; commitment: Uint8Array } {
  const preimages = preimageOrBatch instanceof Uint8Array ? [preimageOrBatch] : [...preimageOrBatch];
  if (preimages.length < 1 || preimages.length > 3) {
    throw new Error(`keccak256 compute side-car requires 1 to 3 preimages; received ${preimages.length}.`);
  }
  if (legacy && preimages.length !== 1) throw new Error('legacy keccak side-cars accept exactly one preimage.');
  const redeem = legacy ? buildKeccakComputeRedeemLegacy(salt, stateful) : buildKeccakComputeRedeem(salt, stateful);
  const lock = legacy ? keccakComputeLockingBytecodeLegacy(salt, stateful) : keccakComputeLockingBytecode(salt, stateful);
  const blocks = preimages.reduce((sum, preimage) => sum + keccakComputeBlocks(preimage.length), 0);
  if (blocks > 3) {
    throw new Error(`keccak256 batch too large (${blocks} total blocks); a single side-car input funds at most `
      + '3 keccak blocks. Use a smaller batch or multiple side-cars.');
  }
  // Size the op-budget pad by the block count (~2900 unlocking bytes fund one block); the redeem + preimage
  // pushes already contribute to the per-input budget, so subtract them.
  const redeemPushLen = redeem.length + (redeem.length <= 255 ? 2 : 3);
  const preimagePushLen = preimages.reduce(
    (sum, preimage) => sum + preimage.length + (preimage.length <= 75 ? 1 : preimage.length <= 255 ? 2 : 3), 0,
  );
  const padLen = Math.max(KECCAK256_COMPUTE_PAD_LENGTH, blocks * 3100 - redeemPushLen - preimagePushLen);
  const pad = new Uint8Array(padLen);
  const commitment = Uint8Array.from(preimages.flatMap((preimage) => [...keccak_256(preimage)]));
  const unlocker: Unlocker = {
    generateUnlockingBytecode: () => Uint8Array.from(legacy
      ? [...pushDataBytes(pad), ...pushDataBytes(preimages[0]), ...pushDataBytes(redeem)]
      : [
        ...pushDataBytes(pad),
        ...preimages.flatMap((preimage) => [...pushDataBytes(preimage)]),
        ...pushDataBytes(Uint8Array.from([preimages.length])),
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
      nft: { capability: 'mutable', commitment: binToHex(commitment) },
    },
  };
  return { unlocker, recreate, commitment };
}

/**
 * Build the chained keccak256 compute side-cars for one preimage larger than three blocks (or any preimage on
 * the chained path): one side-car per 136-byte block (`start` for the first, `cont` for the middle full blocks,
 * `final` for the padded remainder), chaining the running sponge state through their mutable-NFT commitments.
 * The FINAL side-car is mode-aware: mode 1 reads the previous commitment, mode 3 (solo) seeds the zero state for
 * a sub-136-byte preimage. `sidecars` must have at least `planKeccakChain(preimage).length` mutable-NFT UTXOs at
 * the chained address (stateful: consecutive block-layout slots; stateless: the last-N inputs, final last).
 */
export function buildKeccakChainSidecars(
  preimage: Uint8Array, salt: Uint8Array, sidecars: readonly Utxo[], stateful = false,
): Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; commitment: Uint8Array }> {
  const plan = planKeccakChain(preimage);
  const commitments = keccakChainCommitments(preimage);
  if (sidecars.length < plan.length) {
    throw new Error(`keccak256 chained preimage needs ${plan.length} side-car UTXO(s); found ${sidecars.length}.`);
  }
  return plan.map((step, i) => {
    const lock = keccakChainLockingBytecode(salt, step.kind, stateful);
    const redeem = buildKeccakChainRedeem(salt, step.kind, stateful);
    // One keccak block per side-car: the budget pad plus the block and redeem pushes fund ~2.26M op.
    const padLen = Math.max(KECCAK256_COMPUTE_PAD_LENGTH, 3200 - redeem.length - step.block.length);
    const pad = new Uint8Array(padLen);
    const unlocker: Unlocker = {
      generateLockingBytecode: () => lock,
      generateUnlockingBytecode: () => step.kind === 'final'
        ? Uint8Array.from([plan.length === 1 ? 0x53 : 0x51, ...pushDataBytes(step.block), ...pushDataBytes(pad), ...pushDataBytes(redeem)])
        : Uint8Array.from([...pushDataBytes(step.block), ...pushDataBytes(pad), ...pushDataBytes(redeem)]),
    };
    const recreate: Output = {
      to: lock,
      amount: sidecars[i].satoshis,
      token: {
        category: sidecars[i].token!.category,
        amount: sidecars[i].token?.amount ?? 0n,
        nft: { capability: 'mutable', commitment: binToHex(commitments[i]) },
      },
    };
    return { utxo: sidecars[i], unlocker, recreate, commitment: commitments[i] };
  });
}
