/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — Phase 2 P5b computed value-chunk apply.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import {
  Op,
  VALUE_INLINE_LIMIT,
  buildValueChunkCommitment,
  parseValueChunkCommitment,
  sha256 as sha256Sync,
  splitValueIntoValueChunks,
  type StateLayout,
} from '@solidcash/utils';
import type { Contract } from '../Contract.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript } from '../utils.js';
import {
  authenticatedCollectionValues,
  selectAuthenticatedCollectionValue,
  storedChunkableValueRoots,
} from './authenticated-collection-value.js';
import { getValueChunkAddress, getValueChunkLockingBytecode } from './covenant-helpers.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { extractCommitmentMapFromTrace } from './trace-commitment-helpers.js';
import { extractVerifiedValuesFromTrace } from './trace-verified-value-helpers.js';

/** Speculative value-chunk scan width. */
const VALUE_CHUNK_SCAN_MAX = 256;

export type DeriveFullPhase2ValueChunksHost = {
  readonly categoryId: string;
  readonly inner: Contract<any, any>;
  /** The records' physical state owner lock for a delegate: the proxy master's 35-byte lock, when set. */
  readonly stateOwnerLock?: Uint8Array;
};

export type DeriveFullPhase2ValueChunksResult = {
  commitmentProgress: number;
};

/**
 * Grow/replace P5b computed value-chunk placeholders from Phase-2 probe traces.
 * Prefers authenticated rooted values when present; otherwise progressive OTC discovery.
 */
export function deriveFullPhase2ApplyValueChunks(
  host: DeriveFullPhase2ValueChunksHost,
  stb: StatefulTransactionBuilder,
  params: {
    probeBuilder2: TransactionBuilder;
    fullTrace2: AuthenticationProgramStateCommon[];
    commitmentProgress: number;
    stateLayout: StateLayout;
    delegatecallInputIndex: number | undefined;
    iter: number;
    phaseCheckpoint: (stage: string) => void;
  },
): DeriveFullPhase2ValueChunksResult {
  let { commitmentProgress } = params;
  const {
    probeBuilder2, fullTrace2, stateLayout, delegatecallInputIndex, iter, phaseCheckpoint,
  } = params;

  // P5b COMPUTED value chunks: the covenant PINS them (emitSortedValueChunkPin) but the SDK has no value
  // param to build them, so derive their commitments from the trace progressively (like loop entries). The
  // VM halts at the first placeholder mismatch, so each probe reveals one more chunk; grow the placeholder
  // set until the trace stops revealing new ones. A short value (<= 60 B) reveals 0 - the placeholder drops.
  const valueChunkVars = stb.getValueChunkVars();
  if (valueChunkVars.length > 0) {
    let vcOffset = stb.getValueChunkOutputBase();
    for (const vcv of valueChunkVars) {
      const existing = stb.getValueChunkRawCommitments(vcv.id);
      if (existing.length === 0) {
        stb.setValueChunkRawCommitments(vcv.id, ['00']); // seed so the covenant's chunk 0 has an output
        continue;
      }
      const range = { min: vcOffset, max: vcOffset + VALUE_CHUNK_SCAN_MAX };
      const derivedBytecodes = extractVerifiedValuesFromTrace(
        fullTrace2, Op.OP_OUTPUTBYTECODE, range, true,
      );
      // Resolve the address while the region is still speculative. Once a real continuation commitment
      // exists, the address is fixed; later families may inspect the same output index and must not replace
      // this collection's already-authenticated address.
      if (!vcv.slot && derivedBytecodes.length > 0
        && existing.every((commitment) => commitment === '00')) {
        stb.setValueChunkLockingBytecode(vcv.id, derivedBytecodes[0]);
        commitmentProgress += 1;
      }
      // The complete computed value and its SHA-256 root are already present in the write trace. Recover
      // that authenticated value once and materialize every canonical continuation deterministically.
      // Progressive output-index discovery is circular for an INSERT: its speculative NEW node shifts the
      // assumed chunk base, so chunk 1 can be observed at the coordinate currently called chunk 0.
      const collection = stateLayout.collections?.find((candidate) => (
        candidate.name === vcv.collection || candidate.signature === vcv.collection
      ));
      const traceItems = fullTrace2.flatMap((state) => state.stack);
      const traceRoots = new Set(traceItems.filter((item) => item.length === 32).map(binToHex));
      const priorRoots = storedChunkableValueRoots(probeBuilder2.inputs);
      const newRoots = new Set([...traceRoots].filter((root) => !priorRoots.has(root)));
      // Runtime-loop runs publish their exact storage slot. Associate each rooted computed value with its
      // slot by the value-chunk address the covenant itself constructs in the trace. This remains sound
      // while loop-entry discovery shifts the tentative output base: unlike the output coordinate, the
      // address commits only to category, collection, slot, and the computed value digest.
      if (vcv.slot) {
        const rooted = authenticatedCollectionValues(
          traceItems, newRoots.size > 0 ? newRoots : traceRoots,
          collection?.valueType, stateLayout.structs,
        );
        const traceItemsHex = new Set(traceItems.map(binToHex));
        const chunkLock = (root: Uint8Array): Uint8Array => (
          host.stateOwnerLock !== undefined
            ? getValueChunkLockingBytecode(
              host.categoryId, vcv.collection, vcv.slot!, root, host.stateOwnerLock,
            )
            : addressToLockScript(getValueChunkAddress(
              host.inner, host.categoryId, vcv.collection, vcv.slot!, root,
            ))
        );
        const matched = rooted.find((value) => {
          const lockingBytecode = chunkLock(sha256Sync(value));
          return traceItemsHex.has(binToHex(lockingBytecode));
        });
        if (matched) {
          const lockingBytecode = chunkLock(sha256Sync(matched));
          const exact = splitValueIntoValueChunks(matched)
            .map((chunk, index) => buildValueChunkCommitment(index, chunk));
          const lockChanged = binToHex(vcv.lockingBytecode) !== binToHex(lockingBytecode);
          const commitmentsChanged = exact.some((commitment, index) => commitment !== existing[index])
            || exact.length !== existing.length;
          if (lockChanged) stb.setValueChunkLockingBytecode(vcv.id, lockingBytecode);
          if (commitmentsChanged) stb.setValueChunkRawCommitments(vcv.id, exact);
          if (lockChanged || commitmentsChanged) commitmentProgress += Math.max(1, exact.length);
          // The same authenticated value completes a batch TARGET node for this entry whose tail the
          // planner had to publish empty (the route row builds the value inside its handler).
          if (stb.completePendingEntryValueTail(vcv.collection, vcv.slot, matched)) commitmentProgress += 1;
          if (stb.completeExistingEntryValueTail(vcv.collection, vcv.slot, matched)) commitmentProgress += 1;
          vcOffset += exact.length;
          continue;
        }
        // No authenticated address for this slot means this physical iteration produced an inline value,
        // or its pin is not reachable in this probe yet. Never assign another iteration's rooted value to
        // it; retain the placeholder until convergence cleanup (or a later probe) resolves the run.
        vcOffset += existing.length;
        continue;
      }
      const authenticatedValue = selectAuthenticatedCollectionValue(
        traceItems,
        traceRoots,
        newRoots,
        collection?.valueType,
        stateLayout.structs,
      );
      if (authenticatedValue && authenticatedValue.length > VALUE_INLINE_LIMIT) {
        const exact = splitValueIntoValueChunks(authenticatedValue)
          .map((chunk, index) => buildValueChunkCommitment(index, chunk));
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1') {
          console.error('value-chunk-recovered', JSON.stringify({
            iter, collection: vcv.collection, vcOffset, valueLength: authenticatedValue.length,
            priorRoots: [...priorRoots], newRoots: [...newRoots], exact,
          }));
        }
        if (exact.some((commitment, index) => commitment !== existing[index])
          || exact.length !== existing.length) {
          stb.setValueChunkRawCommitments(vcv.id, exact);
          commitmentProgress += exact.length;
        }
        vcOffset += exact.length;
        continue;
      }
      const commitMap = extractCommitmentMapFromTrace(
        fullTrace2, range, delegatecallInputIndex !== undefined, true,
      );
      const derived: string[] = [];
      for (const [outIdx, commit] of commitMap) {
        const outputChunkIndex = outIdx - vcOffset;
        try {
          const parsed = parseValueChunkCommitment(commit);
          // The next trailing output may belong to another covenant family (for example dynamic
          // storage). Accept only the canonical continuation whose encoded index matches its
          // position in this value's chunk run.
          if (parsed.chunkIndex === outputChunkIndex) derived[outputChunkIndex] = commit;
        } catch {
          // A different output family can have a commitment that is not a vmap continuation at all.
        }
      }
      const derivedCount = derived.filter((c) => c !== undefined).length;
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1') {
        console.error('value-chunk-derivation', JSON.stringify({
          iter, collection: vcv.collection, vcOffset, existing, derivedBytecodes: derivedBytecodes.map(binToHex),
          commitMap: [...commitMap.entries()], derived, derivedCount,
        }));
      }
      if (derivedCount === 0 && existing.some((commitment) => commitment !== '00')) {
        commitmentProgress += existing.length;
        vcOffset += existing.length;
        continue;
      }
      // Keep the speculative slot until another derivation change lets execution reach this pin. Dropping
      // an unobserved `00` here makes the next pass seed the identical slot again, producing a 0/1 output
      // oscillation until the global iteration limit. If no other family changes the transaction, the
      // complete-program fingerprint exits on the next pass and final cleanup removes the unresolved seed.
      if (derivedCount === 0 && existing.every((commitment) => commitment === '00')) {
        vcOffset += existing.length;
        continue;
      }
      const stillLearning = derivedCount > 0 && derived[derivedCount - 1] !== (existing[derivedCount - 1] ?? '00');
      const next: string[] = [];
      for (let i = 0; i < derivedCount; i++) next[i] = derived[i] ?? existing[i] ?? '00';
      if (stillLearning) next.push('00');
      stb.setValueChunkRawCommitments(vcv.id, next);
      commitmentProgress += derivedCount;
      vcOffset += next.length;
    }
  }

  phaseCheckpoint('value-chunks');

  return { commitmentProgress };
}
