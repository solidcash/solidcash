/**
 * phase-boundary extract: STB public-surface extract — resolveDeferredEcrecoverArgument VM-trace learning.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { Op } from '@solidcash/utils';
import type { Output, UnlockableUtxo, Utxo } from '../interfaces.js';
import {
  buildEcrecoverComputeSidecars, buildEcrecoverComputeSidecars3, buildEcrecoverPlaceholderSidecars,
  probeEcrecoverSplit, probeEcrecoverSplit3,
} from '../ecrecover/ecrecoverComputeSidecar.js';
import { computeEcrecoverWitness, ecrecoverRefusal } from '../ecrecover/ecrecoverRecovery.js';
import { decodeVmScriptNumber } from './early-value-chunk-helpers.js';

export type DeferredEcrecoverComputeState = {
  salt: Uint8Array;
  argBlobs: Array<Uint8Array | null>;
  evmKeccakPreimageIndices: number[];
  /** Per call, the M and B3 coins its slots switch to when its learned recovery is width-0. */
  width0Coins?: Array<{ m: Utxo; b3: Utxo } | null>;
};

export interface ResolveDeferredEcrecoverArgumentHost {
  readonly deferredEcrecoverCompute?: DeferredEcrecoverComputeState;
  readonly allInputs: readonly UnlockableUtxo[];
  ecrecoverComputeCoSpendUtxos: UnlockableUtxo[];
  ecrecoverComputeRecreates: Output[];
  rebuildDeferredKeccakPreimage(callIndex: number, preimage: Uint8Array): boolean;
  refreshInputs(): void;
}

/**
 * Bind one exact (hash,v,r,s) argument blob to its call's slots without a VM discovery trace. Arguments a pair
 * recovers from take a two-covenant pair beside the middle coin, or A, M and B3 for a width-0 recovery, on the M and B3
 * coins reserved for it. Arguments the precompile refuses lay out as a direct call's do: the placeholder pair laid out
 * before the run stays for those a run does not read, an `r` no curve point has takes it with its A's pad carrying the
 * proof, and a key at infinity takes the pair over the digest shifted by -2^128 r mod n.
 */
export function applyDeferredEcrecoverArgument(
  host: ResolveDeferredEcrecoverArgumentHost,
  callIndex: number,
  argBlob: Uint8Array,
): boolean {
  const deferred = host.deferredEcrecoverCompute;
  if (!deferred || !Number.isSafeInteger(callIndex) || callIndex < 0
    || callIndex >= deferred.argBlobs.length || argBlob.length !== 97) return false;
  const previous = deferred.argBlobs[callIndex];
  if (previous !== null) {
    if (binToHex(previous) !== binToHex(argBlob)) {
      throw new Error(`recovery recipe disagrees with resolved call ${callIndex}`);
    }
    return false;
  }
  const sidecarA = host.ecrecoverComputeCoSpendUtxos[3 * callIndex];
  const sidecarB = host.ecrecoverComputeCoSpendUtxos[3 * callIndex + 2];
  if (!sidecarA || !sidecarB) return false;
  const { salt } = deferred;
  const [hash, v, r, s] = [argBlob.slice(0, 32), argBlob[32]!, argBlob.slice(33, 65), argBlob.slice(65, 97)];
  const refusal = ecrecoverRefusal(hash, v, r, s);
  const place = (offset: number, utxo: Utxo, unlocker: UnlockableUtxo['unlocker'], recreate: Output): void => {
    host.ecrecoverComputeCoSpendUtxos[3 * callIndex + offset] = { ...utxo, unlocker };
    host.ecrecoverComputeRecreates[3 * callIndex + offset] = recreate;
  };
  let evmPreimage: Uint8Array = new Uint8Array(64);
  if (refusal?.kind === 'offCurve') {
    const carrier = buildEcrecoverPlaceholderSidecars(salt, sidecarA, sidecarB, refusal.proof, 'B2');
    place(0, sidecarA, carrier.unlockerA, carrier.recreateA);
    place(2, sidecarB, carrier.unlockerB, carrier.recreateB);
  } else if (refusal?.kind !== 'unread') {
    const witness = computeEcrecoverWitness(refusal?.kind === 'atInfinity' ? refusal.shiftedHash : hash, v, r, s);
    if (refusal === undefined) evmPreimage = witness.uncompressedPubkey;
    let chunkA: number | undefined;
    try {
      chunkA = probeEcrecoverSplit(witness, salt, sidecarA, sidecarB);
    } catch {
      chunkA = undefined;
    }
    const width0 = deferred.width0Coins?.[callIndex];
    if (chunkA === undefined && width0 !== undefined && width0 !== null) {
      // Width-0: the 2-covenant window is empty, so A, M and B3 take the call's three slots, M in place of the coin
      // that held the middle slot, which no covenant read.
      const split = probeEcrecoverSplit3(witness, salt, sidecarA, width0.m, width0.b3);
      const built = buildEcrecoverComputeSidecars3(
        witness, split.chunkA, split.chunkM, salt, sidecarA, width0.m, width0.b3,
      );
      place(0, sidecarA, built.unlockerA, built.recreateA);
      place(1, width0.m, built.unlockerM, built.recreateM);
      place(2, width0.b3, built.unlockerB, built.recreateB);
    } else {
      const rebuilt = buildEcrecoverComputeSidecars(
        witness, chunkA ?? probeEcrecoverSplit(witness, salt, sidecarA, sidecarB), salt, sidecarA, sidecarB, undefined,
        'B2',
      );
      place(0, sidecarA, rebuilt.unlockerA, rebuilt.recreateA);
      place(2, sidecarB, rebuilt.unlockerB, rebuilt.recreateB);
    }
  }
  deferred.argBlobs[callIndex] = Uint8Array.from(argBlob);
  const evmPreimageIndex = deferred.evmKeccakPreimageIndices[callIndex] ?? -1;
  if (evmPreimageIndex >= 0) host.rebuildDeferredKeccakPreimage(evmPreimageIndex, evmPreimage);
  host.refreshInputs();
  return true;
}

/**
 * Learn deferred ecrecover argument blobs from OP_INPUTBYTECODE stack traces and rebuild the
 * corresponding compute sidecars. One pass can resolve several unresolved A inputs.
 */
export function resolveDeferredEcrecoverArgument(
  host: ResolveDeferredEcrecoverArgumentHost,
  trace: unknown[],
  inputBase = 0,
): boolean {
  const deferred = host.deferredEcrecoverCompute;
  if (!deferred || !deferred.argBlobs.some((argBlob) => argBlob === null)) return false;
  const unresolvedAIndices = new Map<number, number>();
  for (let callIndex = 0; callIndex < deferred.argBlobs.length; callIndex++) {
    if (deferred.argBlobs[callIndex] !== null) continue;
    const sidecarA = host.ecrecoverComputeCoSpendUtxos[3 * callIndex];
    if (!sidecarA) continue;
    const inputIndex = host.allInputs.findIndex((input) => (
      input.txid.toLowerCase() === sidecarA.txid.toLowerCase() && input.vout === sidecarA.vout
    ));
    if (inputIndex >= 0) unresolvedAIndices.set(inputBase + inputIndex, callIndex);
  }
  if (unresolvedAIndices.size === 0) return false;

  // Learn EVERY argument this trace exposes, not just the first: a pass that reads several A inputs otherwise
  // advances by one call, and if a later probe dies earlier (the composition is rebuilt each round) the
  // remaining calls never learn at all - the measured shape is `ecrecoverUnresolved 7/8` with every keccak
  // resolved. Applying all matches in one pass converges in as many passes as the traces allow.
  const learnedCandidates: Array<{ callIndex: number; argBlob: Uint8Array }> = [];
  const seenCallIndices = new Set<number>();
  for (const raw of trace) {
    const state = raw as {
      ip?: number; stack?: Uint8Array[]; instructions?: Array<{ opcode?: number }>;
      controlStack?: unknown[];
    };
    if (state.controlStack?.some((condition) => condition === false)
      || state.instructions?.[state.ip ?? -1]?.opcode !== Op.OP_INPUTBYTECODE
      || !state.stack || state.stack.length < 2) continue;
    const inputIndex = Number(decodeVmScriptNumber(state.stack[state.stack.length - 1]));
    const callIndex = unresolvedAIndices.get(inputIndex);
    const argBlob = state.stack[state.stack.length - 2];
    if (callIndex === undefined || argBlob.length !== 97) continue;
    if (seenCallIndices.has(callIndex)) continue;
    seenCallIndices.add(callIndex);
    learnedCandidates.push({ callIndex, argBlob: Uint8Array.from(argBlob) });
  }
  if (learnedCandidates.length === 0) {
    if ((globalThis as { process?: { env?: Record<string, string> } }).process
      ?.env?.SOLIDC_DEBUG_ECRECOVER_DERIVE === '1') {
      console.error('deferred-ecrecover-no-argument', {
        unresolvedAIndices: [...unresolvedAIndices.entries()],
        inputCount: host.allInputs.length,
        inputBytecodeReads: trace.flatMap((raw) => {
          const state = raw as {
            ip?: number; stack?: Uint8Array[]; instructions?: Array<{ opcode?: number }>;
          };
          if (state.instructions?.[state.ip ?? -1]?.opcode !== Op.OP_INPUTBYTECODE || !state.stack) return [];
          return [{
            index: state.stack.length > 0
              ? Number(decodeVmScriptNumber(state.stack[state.stack.length - 1])) : undefined,
            belowBytes: state.stack.at(-2)?.length,
            below: state.stack.at(-2) ? binToHex(state.stack.at(-2)!) : undefined,
            stackBytes: state.stack.slice(-5).map((item) => item.length),
          }];
        }).slice(-24),
      });
    }
    return false;
  }

  let learnedAny = false;
  for (const candidate of learnedCandidates) {
    const { callIndex, argBlob } = candidate;
    try {
      if (!applyDeferredEcrecoverArgument(host, callIndex, argBlob)) continue;
      if ((globalThis as { process?: { env?: Record<string, string> } }).process
        ?.env?.SOLIDC_DEBUG_ECRECOVER_DERIVE === '1') {
        console.error('deferred-ecrecover-learned', {
          callIndex, inputIndices: [...unresolvedAIndices.keys()], argument: binToHex(argBlob),
        });
      }
      learnedAny = true;
    } catch (error) {
      if ((globalThis as { process?: { env?: Record<string, string> } }).process
        ?.env?.SOLIDC_DEBUG_ECRECOVER_DERIVE === '1') {
        console.error('deferred-ecrecover-invalid-argument', {
          callIndex, argument: binToHex(argBlob), error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  return learnedAny;
}
