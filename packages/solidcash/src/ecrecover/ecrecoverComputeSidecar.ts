// Build the co-spent recovery side-car PAIR for one ecrecoverPubKey(hash,v,r,s) call. Side-car A runs the GLV
// ladder to a witnessed checkpoint and commits it; side-car B continues to the recovered pubkey and commits the
// compressed key to its recreated NFT (which the contract reads). The split point (chunkA) is DETERMINISTIC - the SDK
// VM-probes the two covenants' real op-cost and picks the split where both inputs fit their ~8M budget (a liveness
// parameter, so a probe can only land on a valid split). Mirrors the keccak compute side-car; see docs/ecrecover.md.
import { binToHex, hash256, hexToBin, createVirtualMachineBch2026 } from '@bitauth/libauth';
import {
  buildEcrecoverComputeRedeem, ecrecoverComputeLockingBytecode, ecrecoverComputeResultCommitment,
  SHARED_LIBRARY_SALT,
} from '@solidcash/utils';
import { computeEcrecoverWitness, type EcrecoverWitness } from './ecrecoverRecovery.js';
import { pushDataBytes } from '../keccak/keccakComputeSidecar.js';
import type { Unlocker, Utxo, Output } from '../interfaces.js';

const numByte = (n: number): Uint8Array => Uint8Array.from([n]);
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
  const to33 = (v: bigint): Uint8Array => {
    const b = new Uint8Array(33);
    let x = v;
    for (let i = 0; x > 0n; i++, x >>= 8n) b[i] = Number(x & 0xffn);
    return b;
  };
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
    token: {
      category: u.token!.category, amount: u.token?.amount ?? 0n,
      nft: { capability: 'mutable', commitment: binToHex(commitment) },
    },
  });
  // A commits H_A = hash256(argBlob || shared || checkpoint) - the binding hash B verifies against its own checkpoint
  // copy (so B ladders from the same C without A re-publishing the raw 99-byte checkpoint).
  const HA = hash256(Uint8Array.from([...wit.argBlob, ...shared, ...Cblob]));
  return {
    unlockerA: unlockA, recreateA: nft(lockA, HA, sidecarA),                       // A commits the A->B binding hash
    unlockerB: unlockB,
    recreateB: nft(lockB, ecrecoverComputeResultCommitment(wit.compressedQ), sidecarB), // B commits Q
    compressedQ: wit.compressedQ,
  };
}

let probeVm: ReturnType<typeof createVirtualMachineBch2026> | undefined;

/**
 * Deterministic split (chunkA) via VM-probe: build the A+B pair in isolation (A input 0 / output 0, B input 1 /
 * output 1 - the same index alignment the live tx uses) and evaluate each input's real op-cost across candidate
 * splits, choosing the viable split with the lowest peak. op-cost is a pure function of (covenant, witness), so this
 * is reproducible. Standalone (no TransactionBuilder) so the stateful path can reuse it.
 */
export function probeEcrecoverSplit(wit: EcrecoverWitness, _salt: Uint8Array, scA: Utxo, scB: Utxo): number {
  const vm = (probeVm ??= createVirtualMachineBch2026());
  // Probe with the SHARED (all-zero) salt so the covenant's brand-check drops (the isolated 2-input probe has no
  // consuming contract at input 0 to verify a branded category against). op-cost is salt-independent (only the tiny
  // drop-vs-verify branch differs, << the 8M budget margin), so the chosen split is valid for the real branded pair.
  const salt = SHARED_LIBRARY_SALT;
  const toTok = (t?: Utxo['token']): unknown => (t
    ? { category: hexToBin(t.category), amount: t.amount ?? 0n,
      nft: t.nft ? { capability: t.nft.capability, commitment: hexToBin(t.nft.commitment) } : undefined }
    : undefined);
  const laOut = (o: Output): unknown => ({ lockingBytecode: o.to, valueSatoshis: o.amount, token: toTok(o.token) });
  // op-cost at a candidate split: build the pair, evaluate both inputs. Over-budget -> Infinity (the eval errors).
  const cost = (cA: number): { a: number; b: number; ok: boolean } => {
    const { unlockerA, recreateA, unlockerB, recreateB } = buildEcrecoverComputeSidecars(wit, cA, salt, scA, scB);
    const inputs = [scA, scB].map((u, k) => ({
      outpointIndex: u.vout, outpointTransactionHash: hexToBin(u.txid), sequenceNumber: 0xffffffff,
      unlockingBytecode: (k === 0 ? unlockerA : unlockerB).generateUnlockingBytecode({} as never),
    }));
    const sourceOutputs = [scA, scB].map((u, k) => ({
      lockingBytecode: (k === 0 ? unlockerA : unlockerB).generateLockingBytecode(),
      valueSatoshis: u.satoshis,
      token: toTok(u.token),
    }));
    const transaction = { version: 2, locktime: 0, inputs, outputs: [laOut(recreateA), laOut(recreateB)] };
    const rA = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction } as never) as {
      error?: string; metrics: { operationCost: number };
    };
    const rB = vm.evaluate({ inputIndex: 1, sourceOutputs, transaction } as never) as {
      error?: string; metrics: { operationCost: number };
    };
    return {
      a: rA.error ? Infinity : rA.metrics.operationCost,
      b: rB.error ? Infinity : rB.metrics.operationCost,
      ok: !rA.error && !rB.error,
    };
  };
  const maxCA = Math.max(1, wit.masks.length - wit.start - 2);
  const L = wit.masks.length - wit.start - 1;         // total ladder doubling steps
  // Each covenant's op-budget (~8M, capped by the 10000-byte scriptSig consensus limit) covers ~half the ladder, so
  // A's cost RISES with chunkA and B's FALLS, leaving a THIN viable window (width ~1-7) where both fit. The window
  // sits at nearly the same place for EVERY signature - A carries more fixed overhead (the GLV table check) than B, so
  // the crossover is ~0.462*L (empirically cA ~= 54..61 across all sigs), NOT L/2. Seed the search there and spiral
  // out to the first viable split, then settle on the local min-peak (max budget margin). Seeding at the true center
  // is both fast (a handful of evals vs a full binary search) and robust (binary-search-from-[1,maxCA] occasionally
  // misconverged around the thin window). op-cost is a pure function of (covenant, witness), so this is reproducible.
  const seed = Math.min(maxCA, Math.max(1, Math.round(L * 0.462)));
  let best = -1, bestPeak = Infinity;
  // Costs are MONOTONE: A rises with chunkA, B falls. So the first A-over-budget above the seed caps the window's high
  // edge (nothing higher can fit), and the first B-over-budget below caps the low edge. Spiral out from the seed and
  // stop as soon as BOTH edges are known - the min-peak split is the balanced one between them (max budget margin).
  let lowCapped = false, highCapped = false;  // hit B-over below seed / A-over above seed
  const consider = (cA: number, side: -1 | 0 | 1): void => {
    if (cA < 1) { lowCapped = true; return; }
    if (cA > maxCA) { highCapped = true; return; }
    const c = cost(cA);
    if (c.ok) { const peak = Math.max(c.a, c.b); if (peak < bestPeak) { bestPeak = peak; best = cA; } return; }
    if (c.a === Infinity && side >= 0) highCapped = true; // A over budget -> no viable split at a higher chunkA
    if (c.b === Infinity && side <= 0) lowCapped = true;  // B over budget -> no viable split at a lower chunkA
  };
  const RADIUS = 16;                        // >> the observed max distance from seed to a window edge (~4), with margin
  consider(seed, 0);
  for (let d = 1; d <= RADIUS && !(lowCapped && highCapped); d++) {
    if (!lowCapped) consider(seed - d, -1);
    if (!highCapped) consider(seed + d, 1);
  }
  if (best < 0) {                           // window not near the seed (only genuine width-0 sigs) - confirm exhaustively
    for (let cA = 1; cA <= maxCA; cA++) consider(cA, 0);
  }
  if (best < 0) {
    throw new Error('ecrecover: no ladder split fits both side-cars\' op-budget for this signature (a rare '
      + 'high-Hamming-weight scalar makes the GLV ladder too long for a 2-covenant split). Re-sign to obtain a '
      + 'different signature, which will decompose differently.');
  }
  return best;
}

export { computeEcrecoverWitness };
