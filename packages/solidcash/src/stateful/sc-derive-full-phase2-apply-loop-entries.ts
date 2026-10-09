/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — Phase 2 loop-entry commitment apply.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import { Op, parseChunkCommitment, type StateLayout } from '@solidcash/utils';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript } from '../utils.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { extractCommitmentMapFromTrace } from './trace-commitment-helpers.js';
import { extractVerifiedValuesFromTrace } from './trace-verified-value-helpers.js';

export type DeriveFullPhase2LoopEntriesResult = {
  commitmentProgress: number;
  latestLoopEntryCommits: string[];
};

/**
 * Grow/replace loop mapping-write entry placeholders from Phase-2 probe traces.
 * Mutates `probedSortedLoop` in place for sorted VALUE upsert seed tracking.
 */
export function deriveFullPhase2ApplyLoopEntries(
  stb: StatefulTransactionBuilder,
  params: {
    probeBuilder2: TransactionBuilder;
    fullTrace2: AuthenticationProgramStateCommon[];
    commitmentProgress: number;
    latestLoopEntryCommits: string[];
    stateLayout: StateLayout;
    probedSortedLoop: Set<string>;
    delegatecallInputIndex: number | undefined;
    iter: number;
    phaseCheckpoint: (stage: string) => void;
  },
): DeriveFullPhase2LoopEntriesResult {
  let { commitmentProgress, latestLoopEntryCommits } = params;
  const {
    probeBuilder2,
    fullTrace2,
    stateLayout,
    probedSortedLoop,
    delegatecallInputIndex,
    iter,
    phaseCheckpoint,
  } = params;

  // Loop mapping-write entry commitments (`for(i<n) m[k[i]]=v[i]`): a runtime-variable count N of new
  // entry NFT outputs. The VM halts at the first mismatched OP_EQUALVERIFY, so each probe reveals one more
  // commitment; grow the placeholder set by one until the trace stops revealing new ones (all N known),
  // then drop the trailing probe placeholder so the covenant's output-count pin passes.
  const loopEntryVars = stb.getLoopEntryVars();
  if (loopEntryVars.length > 0) {
    let loopOffset = stb.getLoopEntryOutputBase();
    for (const lv of loopEntryVars) {
      // P5b: a chunkable-value insert injects NEW exactly (pinned) - skip derivation so the value-chunk pin's
      // OP_OUTPUTTOKENCOMMITMENT calls are not misread as NEW. Advance loopOffset by the injected count.
      if (stb.isLoopEntryPinned(lv.collection)) {
        loopOffset += stb.getLoopEntryCommitments(lv.collection).length;
        continue;
      }
      // A vmap sorted upsert (bool/int/bytesN) carries its value in NEW, so NEW is derived from the trace.
      const scoll = stateLayout.collections?.find((c) => c.name === lv.collection);
      const isSortedValueMintColl = !!scoll?.sorted;
      const existing = stb.getLoopEntryCommitments(lv.collection);
      const segmentedOutputIndices = stb.hasRuntimeLoopEntrySegments(lv.collection)
        ? existing.map((_, index) => stb.getLoopEntryOutputIndex(lv.collection, index))
        : undefined;
      if (existing.length > 0 && segmentedOutputIndices === undefined) {
        const loopBytecode = binToHex(lv.lockingBytecode);
        const matches = probeBuilder2.outputs.map((output, index) => ({ output, index }))
          .filter(({ output }) => binToHex(typeof output.to === 'string'
            ? addressToLockScript(output.to) : output.to) === loopBytecode);
        const knownOrdinal = existing.findIndex((commitment) => commitment !== '00');
        // A sorted batch can publish the same seed at its fixed entry coordinate and its trailing
        // coordinate. Anchor in the trailing region; the fixed copy is not this loop-entry run.
        const minimumLoopIndex = loopOffset;
        const anchored = knownOrdinal < 0 ? undefined : matches.find(({ index, output }) =>
          index >= minimumLoopIndex && output.token?.nft?.commitment === existing[knownOrdinal]);
        const physicalLoopOffset = anchored
          ? anchored.index - knownOrdinal
          : (matches.at(-1)?.index ?? -1) - Math.max(0, existing.length - 1);
        if (physicalLoopOffset >= 0) loopOffset = physicalLoopOffset;
      }
      if (existing.length === 0) {
        // An UPDATE (present key) mints no trailing node; once probed empty, keep it empty (no re-seed).
        if (isSortedValueMintColl && probedSortedLoop.has(lv.collection)) continue;
        // Seed one placeholder so the next probe's iteration 0 has an output to verify against.
        stb.setLoopEntryCommitments(lv.collection, ['00']);
        latestLoopEntryCommits = latestLoopEntryCommits.concat('00');
        continue;
      }
      if (isSortedValueMintColl) probedSortedLoop.add(lv.collection);
      // A sorted VALUE upsert mints at most ONE trailing NEW node (insert), so cap its range to a single
      // output - otherwise a chunkable-value insert's value-chunk pin (which emits OP_OUTPUTTOKENCOMMITMENT
      // at loopOffset+1..) would be misread here as extra NEW nodes.
      const requiredCount = stb.getRequiredLoopEntryCount(lv.collection);
      const loopMax = requiredCount > 0
        ? loopOffset + requiredCount
        : isSortedValueMintColl ? loopOffset + 1 : loopOffset + Math.max(1, existing.length);
      const range = segmentedOutputIndices && segmentedOutputIndices.length > 0
        ? { min: Math.min(...segmentedOutputIndices), max: Math.max(...segmentedOutputIndices) + 1 }
        : { min: loopOffset, max: loopMax };
      // The compiler is authoritative for the precise collection covenant used by a synthesized
      // message-bus handler. Recover the bytecode from its tight OUTPUTBYTECODE equality before reading
      // commitments; proxy routes can graft a loop slot whose signature is not reconstructible from the
      // outer contract's state layout alone.
      const derivedBytecodes = segmentedOutputIndices
        ? segmentedOutputIndices.flatMap((outputIndex) => extractVerifiedValuesFromTrace(
          fullTrace2, Op.OP_OUTPUTBYTECODE, { min: outputIndex, max: outputIndex + 1 },
          true, true, delegatecallInputIndex !== undefined,
        ))
        : extractVerifiedValuesFromTrace(
          fullTrace2, Op.OP_OUTPUTBYTECODE, range, true, true, delegatecallInputIndex !== undefined,
        );
      let loopBytecodeChanged = false;
      if (lv.delegate !== true && derivedBytecodes.length > 0
        && binToHex(derivedBytecodes[0]) !== binToHex(lv.lockingBytecode)) {
        stb.setLoopEntryLockingBytecode(lv.collection, derivedBytecodes[0]);
        commitmentProgress += 1;
        loopBytecodeChanged = true;
      }
      // This probe stopped at the address mismatch, before the following commitment comparison could
      // expose its value. Keep the same placeholder count and retry with the learned address.
      if (loopBytecodeChanged) {
        loopOffset += existing.length;
        continue;
      }
      // A delegate's scalar NEW check executes in the implementation invocation after the proxy redeem
      // phase. Restricting extraction to the longest redeem-script suffix discards that observation,
      // causing the dynamic-region bootstrap to grow forever and shift NEW out of place.
      const commitMap = segmentedOutputIndices
        ? new Map(segmentedOutputIndices.flatMap((outputIndex) => ([...extractCommitmentMapFromTrace(
          fullTrace2, { min: outputIndex, max: outputIndex + 1 }, true,
        )])))
        : extractCommitmentMapFromTrace(fullTrace2, range, true);
      const logicalIndexByPhysical = segmentedOutputIndices === undefined
        ? undefined : new Map(segmentedOutputIndices.map((physical, logical) => [physical, logical]));
      const isChunkableLoop = lv.chunkable === true;
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_CHUNK_SCAN === '1') {
        console.error('loop-entry-derive-scan', {
          iter, collection: lv.collection, loopOffset, existing, range,
          currentBytecode: binToHex(lv.lockingBytecode),
          derivedBytecodes: derivedBytecodes.map(binToHex),
          observed: [...commitMap.entries()], traceError: fullTrace2.at(-1)?.error,
          ...(iter >= 60 && { traceTail: fullTrace2.slice(-16).map((state) => ({
            ip: state.ip,
            opcode: state.instructions[state.ip]?.opcode,
            error: state.error,
            ...(state.error && { instructions: state.instructions.map((instruction) => ({
              opcode: instruction.opcode,
              data: 'data' in instruction && instruction.data instanceof Uint8Array
                ? binToHex(instruction.data) : undefined,
            })) }),
            stack: state.stack.slice(-20).map((item) => {
              const hex = binToHex(item);
              return `${item.length}:${hex.slice(0, 96)}`;
            }),
          })) }),
        });
      }
      const derived: string[] = [];
      for (const [outIdx, commit] of commitMap) {
        const logicalIndex = logicalIndexByPhysical?.get(outIdx) ?? outIdx - loopOffset;
        if (logicalIndexByPhysical && !logicalIndexByPhysical.has(outIdx)) continue;
        if (isChunkableLoop) {
          try {
            // Chunkable mapping loops can emit the same canonical chunk more than once (for example while
            // serializing the fields of one pushed struct). The runtime row ordinal, not the commitment's
            // embedded chunk index, determines the output position. Parsing remains a structural guard
            // against neighbouring covenant observations being mistaken for loop rows.
            parseChunkCommitment(commit);
            derived[logicalIndex] = commit;
          } catch {
            // A neighbouring covenant observation is not a canonical value chunk; do not let it grow
            // this chunk-indexed region under a physical ordinal.
          }
        } else {
          derived[logicalIndex] = commit;
        }
      }
      const derivedIndices = derived.map((commitment, index) => ({ commitment, index }))
        .filter((item): item is { commitment: string; index: number } => item.commitment !== undefined);
      const derivedCount = derivedIndices.length;
      // A newly-learned last commitment (its placeholder was still '00') means more may follow; keep probing
      // with one extra placeholder. If the last commitment merely re-confirms a known one, the loop ran to
      // completion (all N derived) - drop the extra placeholder so the count pin sees exactly N outputs.
      // A sorted VALUE upsert mints a STATIC number of trailing NEW nodes (1 on insert, 0 on update), not a
      // growing loop, so never add the speculative extra placeholder (it would create a phantom output that
      // shifts the fixed entry-slot P' and oscillates the derivation).
      const isSortedValueMint = !!scoll?.sorted && !isChunkableLoop;
      // P5b computed INSERT: the value-chunk pin runs BEFORE the NEW-node check in the covenant, so until the
      // chunks converge the NEW OTC never runs and derivedCount is 0. Do NOT drop the seeded loop entry to 0
      // (that would shift vcBase and misalign the chunk derivation) - keep the count of 1 until NEW derives.
      const hasValueChunks = stb.getValueChunkVars().some((v) => v.collection === lv.collection);
      if (isSortedValueMint && derivedCount === 0 && existing.length > 0
        && (hasValueChunks || requiredCount > 0)) {
        loopOffset += existing.length;
        continue;
      }
      // The first pass seeds one speculative NEW output so an insert can expose its commitment. If the
      // second pass reaches the sorted-upsert count check without observing NEW, this is an UPDATE: drop
      // the seed. `probedSortedLoop` prevents the now-empty family from being seeded again next pass.
      if (isSortedValueMint && derivedCount === 0 && existing.length > 0) {
        stb.setLoopEntryCommitments(lv.collection, []);
        continue;
      }
      const highestDerivedIndex = derivedIndices.at(-1)?.index ?? -1;
      const highestChanged = highestDerivedIndex >= 0
        && derived[highestDerivedIndex] !== (existing[highestDerivedIndex] ?? '00');
      const stillLearning = !isSortedValueMint && highestChanged;
      // Observations can be sparse: once output N is correct, execution may halt at N+1 without
      // re-verifying earlier outputs in the trace phase we scan. Preserve known lower ordinals and write
      // each observation at its physical ordinal rather than compacting index N onto index 0.
      const next: string[] = derivedCount === 0 ? [...existing] : Array.from(
        { length: highestDerivedIndex + 1 },
        (_, index) => derived[index] ?? existing[index] ?? '00',
      );
      if (stillLearning && (requiredCount === 0 || next.length < requiredCount)) next.push('00');
      if (!stillLearning && derivedCount > 0 && next.at(-1) === '00') next.pop();
      if (requiredCount > 0 && next.length > requiredCount) next.length = requiredCount;
      while (next.length < requiredCount) next.push(existing[next.length] ?? '00');
      stb.setLoopEntryCommitments(lv.collection, next);
      commitmentProgress += derivedCount;
      latestLoopEntryCommits = latestLoopEntryCommits.concat(next);
      loopOffset += next.length;
    }
  }

  phaseCheckpoint('loop-entries');

  return {
    commitmentProgress,
    latestLoopEntryCommits,
  };
}
