// Build the co-spent recovery side-car PAIR for one ecrecoverPubKey(hash,v,r,s) call. Side-car A runs the GLV
// ladder to a witnessed checkpoint and commits it; side-car B continues to the recovered pubkey and commits the
// compressed key to its recreated NFT (which the contract reads). The split point (chunkA) is DETERMINISTIC - the SDK
// VM-probes the two covenants' real op-cost and picks the split where both inputs fit their ~8M budget (a liveness
// parameter, so a probe can only land on a valid split). Mirrors the keccak compute side-car; see docs/ecrecover.md.
import { binToHex, hash256 } from '@bitauth/libauth';
import {
  buildEcrecoverComputeRedeem, ecrecoverComputeLockingBytecode, ecrecoverComputeResultCommitment,
  ECRECOVER_COMPUTE_PAD_LENGTH,
} from '@solidcash/utils';
import { computeEcrecoverWitness, type EcrecoverWitness } from './ecrecoverRecovery.js';
import { pushDataBytes } from '../keccak/keccakComputeSidecar.js';
import type { Unlocker, Utxo, Output } from '../interfaces.js';

const numByte = (n: number): Uint8Array => Uint8Array.from([n]);
// Minimal VM-number encoding of a small non-negative int (side-car indices / chunkA are tiny).
const vmNum = (n: number): Uint8Array => {
  if (n === 0) return new Uint8Array(0);
  const bytes: number[] = []; let x = n; while (x > 0) { bytes.push(x & 0xff); x >>= 8; }
  if (bytes[bytes.length - 1] & 0x80) bytes.push(0);
  return Uint8Array.from(bytes);
};

/**
 * Build the A and B recovery side-cars for one call. `chunkA` is the split point (how many ladder steps A runs); the
 * caller VM-probes it via `ecrecoverSidecarCosts`. Returns the two input unlockers, the two recreation outputs (A
 * commits the checkpoint, B the compressed pubkey), and the recovered key. `salt` brands the pair to the contract.
 */
export function buildEcrecoverComputeSidecars(
  wit: EcrecoverWitness, chunkA: number, salt: Uint8Array, sidecarA: Utxo, sidecarB: Utxo,
): { unlockerA: Unlocker; recreateA: Output; unlockerB: Unlocker; recreateB: Output; compressedQ: Uint8Array } {
  const redeemA = buildEcrecoverComputeRedeem(salt, 'A'), redeemB = buildEcrecoverComputeRedeem(salt, 'B');
  const lockA = ecrecoverComputeLockingBytecode(salt, 'A'), lockB = ecrecoverComputeLockingBytecode(salt, 'B');
  const to33 = (v: bigint): Uint8Array => { const b = new Uint8Array(33); let x = v; for (let i = 0; x > 0n; i++, x >>= 8n) b[i] = Number(x & 0xffn); return b; };
  const Cblob = wit.checkpoints[chunkA];                          // checkpoint after chunkA ladder steps (99 B)
  // shared blob both A and B hash-bind on = masks || table || start || chunkA (the ladder inputs)
  const shared = Uint8Array.from([...wit.masks, ...wit.table, ...numByte(wit.start), ...numByte(chunkA)]);
  // A witnesses the full verification set; B is a pure ladder needing only the shared blob + checkpoint + Zinv.
  const aBlob = Uint8Array.from([
    ...to33(wit.rinv), ...to33(wit.Ry), ...to33(wit.phiRx),
    ...to33(wit.t1a), ...to33(wit.t2a), ...to33(wit.t1b), ...to33(wit.t2b), ...wit.invb,
  ]);
  // Fill the scriptSig to ~9950 (just under the 10000-byte relay cap + stack-item limit): the covenant bytes (in the
  // P2SH redeem) + witnesses already fund most of the ~8M op-budget, so the pad is just the remainder. Must stay under
  // 10000 or OP_INPUTBYTECODE (the contract reading the side-car) overflows the 10000-byte stack-item limit.
  const padTo = (witBytes: number): Uint8Array => new Uint8Array(Math.max(0, 9950 - witBytes));
  const padA = padTo(wit.argBlob.length + shared.length + aBlob.length + redeemA.length);
  const padB = padTo(wit.argBlob.length + shared.length + Cblob.length + wit.zinv.length + redeemB.length);
  const unlockA: Unlocker = {
    generateUnlockingBytecode: () => Uint8Array.from([
      ...pushDataBytes(padA), ...pushDataBytes(wit.argBlob), ...pushDataBytes(shared),
      ...pushDataBytes(aBlob), ...pushDataBytes(redeemA),
    ]),
    generateLockingBytecode: () => lockA,
  };
  const unlockB: Unlocker = {
    generateUnlockingBytecode: () => Uint8Array.from([
      ...pushDataBytes(padB), ...pushDataBytes(wit.argBlob), ...pushDataBytes(shared),
      ...pushDataBytes(Cblob), ...pushDataBytes(wit.zinv), ...pushDataBytes(redeemB),
    ]),
    generateLockingBytecode: () => lockB,
  };
  const nft = (lock: Uint8Array, commitment: Uint8Array, u: Utxo): Output => ({
    to: lock, amount: u.satoshis,
    token: { category: u.token!.category, amount: u.token?.amount ?? 0n, nft: { capability: 'mutable', commitment: binToHex(commitment) } },
  });
  // A commits H_A = hash256(argBlob || shared || checkpoint) - the binding hash B verifies against its own checkpoint
  // copy (so B ladders from the same C without A re-publishing the raw 99-byte checkpoint).
  const HA = hash256(Uint8Array.from([...wit.argBlob, ...shared, ...Cblob]));
  return {
    unlockerA: unlockA, recreateA: nft(lockA, HA, sidecarA),                       // A commits the A->B binding hash
    unlockerB: unlockB, recreateB: nft(lockB, ecrecoverComputeResultCommitment(wit.compressedQ), sidecarB), // B commits Q
    compressedQ: wit.compressedQ,
  };
}

/**
 * Balanced split estimate: the number of ladder steps side-car A runs (B runs the rest). A does the verification +
 * its chunk; B is a pure ladder. This estimates the balancing split from the per-step add counts. The production SDK
 * refines it with a deterministic VM-probe of both covenants' op-cost (op-cost is a pure function of the witness).
 */
export function ecrecoverBalancedSplit(wit: EcrecoverWitness): number {
  const rest = Array.from(wit.masks.slice(wit.start + 1));
  const AFIX = 900000, BFIX = 340000, DBL = 51000, ADD = 66000;
  const stepCost = (m: number): number => DBL + (m ? ADD : 0);
  const hi = Math.min(70, rest.length - 1);
  let best = Math.min(60, hi), bestMax = Infinity;
  for (let cA = Math.min(45, hi); cA <= hi; cA++) {
    let a = AFIX, b = BFIX;
    rest.forEach((m, i) => { if (i < cA) a += stepCost(m); else b += stepCost(m); });
    if (Math.max(a, b) < bestMax) { bestMax = Math.max(a, b); best = cA; }
  }
  return best;
}

export { computeEcrecoverWitness };
