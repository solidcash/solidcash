/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — Phase 2 speculative grow + convergence fingerprint.
 */

import { binToHex, type AuthenticationProgramStateCommon } from '@bitauth/libauth';
import { shouldGrowSpeculativeChunkRegion } from './early-value-chunk-helpers.js';
import { valueChunkOutputWitnessCarrier } from './route-value-chunk-helpers.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { computeConvergenceKey } from './trace-verified-value-helpers.js';

/** Matches StatefulContract MAX_SPECULATIVE_CHUNK_OUTPUTS. */
const MAX_SPECULATIVE_CHUNK_OUTPUTS = 32;

export type DeriveFullPhase2DynamicChunkVar = ReturnType<
StatefulTransactionBuilder['getDynamicChunkVars']
>[number];

export type DeriveFullPhase2ConvergenceResult = {
  convergenceKey: string;
  anyProbeHadError: boolean;
  needsPassingProbe: boolean;
};

/**
 * Speculatively grow the dynamic-chunk region when a zero-progress probe leaves
 * only placeholders, fingerprint derived commitments, and compute whether the
 * loop still needs a passing probe. Caller owns break/throw on the returned flags.
 */
export function deriveFullPhase2Convergence(
  stb: StatefulTransactionBuilder,
  params: {
    commitmentProgress: number;
    derivedAState: Record<string, unknown> | undefined;
    chunkVars: DeriveFullPhase2DynamicChunkVar[];
    derivedTransfers: Array<{ lockingBytecode: Uint8Array; amount: bigint }> | undefined;
    derivedFtTransfers: Array<{
      categoryId: string; lockingBytecode: Uint8Array; amount: bigint;
    }> | undefined;
    derivedNftTransfers: Array<{
      categoryId: string; lockingBytecode: Uint8Array; commitment: Uint8Array; capability: string;
    }> | undefined;
    stateCommits: string[];
    latestEntryCommits: string[];
    latestEventCommits: string[];
    latestLoopEntryCommits: string[];
    faithfulProbeHadError: boolean;
    nestedProbeHadError: boolean;
    nestedPinProgress: number;
    runtimeLoopTransferBytecodesDerived: readonly boolean[];
    runtimeLoopTransferAmountsDerived: readonly boolean[];
    runtimeLoopTransferCommitmentsDerived: readonly boolean[];
    runtimeLoopTransferCapabilitiesDerived: readonly boolean[];
    fullTrace2: AuthenticationProgramStateCommon[];
    iter: number;
    debugTargetsThisDerivation: boolean;
    debugIterationStartedAt: number;
    phaseCheckpoint: (stage: string) => void;
  },
): DeriveFullPhase2ConvergenceResult {
  const {
    commitmentProgress,
    derivedAState,
    chunkVars,
    derivedTransfers,
    derivedFtTransfers,
    derivedNftTransfers,
    stateCommits,
    latestEntryCommits,
    latestEventCommits,
    latestLoopEntryCommits,
    faithfulProbeHadError,
    nestedProbeHadError,
    nestedPinProgress,
    runtimeLoopTransferBytecodesDerived,
    runtimeLoopTransferAmountsDerived,
    runtimeLoopTransferCommitmentsDerived,
    runtimeLoopTransferCapabilitiesDerived,
    fullTrace2,
    iter,
    debugTargetsThisDerivation,
    debugIterationStartedAt,
    phaseCheckpoint,
  } = params;

  // X10. A trailing vmap entry mint places its NEW node AFTER the chunk region, and the covenant checks
  // that output's ADDRESS before any commitment - so a region laid out one output short aborts the probe
  // before the data NFT is verified, A$len is never revealed, and the exact count above can never be
  // computed. Break that cycle from the only evidence a zero-progress probe leaves: nothing at all was
  // learned, so the trailing region is the wrong size. Grow it by one output and re-probe. The first
  // probe that reaches ANY commitment stops the growth, and A$len then snaps the count to its exact
  // value.
  // X101. This is a linear grow of the region TOTAL, not a search over per-var splits, and measurement
  // says a search is not needed: the covenant reaches the trailing NEW node's address before it verifies
  // any chunk, so during the speculative phase only the region's total output count is observable - the
  // split is not. Growing the first var and growing the last var were measured to produce the same
  // accepted transaction for (200,60), (60,200) and (200,200), including the two cases whose grown split
  // is WRONG (right total): the very next probe reads every $len off the data NFT and the block above
  // snaps each var to its exact count. Grow the first so the single-var path stays byte-identical. The
  // bound is on the TOTAL region, so several vars cannot multiply it.
  if (chunkVars.length > 0) {
    const regions = chunkVars.map((cv) => stb.getChunkRawCommitments(cv.name));
    const total = regions.reduce((n, r) => n + r.length, 0);
    if (shouldGrowSpeculativeChunkRegion({
      commitmentProgress,
      hasDerivedState: derivedAState !== undefined,
      chunkVariableCount: chunkVars.length,
      loopEntryVariableCount: stb.getLoopEntryVars().length,
      outputVerificationMismatchObserved: false,
      totalRegionWidth: total,
      maximumRegionWidth: MAX_SPECULATIVE_CHUNK_OUTPUTS,
      allCommitmentsArePlaceholders: regions.every((region) =>
        region.every((commitment) => commitment === '00')),
      // A proxy's reverse-indexed value chunks use TXOUTPUTCOUNT-1-nNew. Growing nNew here
      // parks chunk 0 on empty pads and never reveals A$len.
      reverseIndexedChunkSuffix: chunkVars.some((variable) => variable.delegateSuffix === true),
    })) {
      stb.setChunkRawCommitments(chunkVars[0].name, [...regions[0], '00']);
    }
  }

  // Check convergence using content fingerprint (not just count)
  // to detect when derived values change without the count increasing.
  const convergenceKey = computeConvergenceKey(
    commitmentProgress, derivedTransfers, derivedFtTransfers, derivedNftTransfers,
    stateCommits, latestEntryCommits, latestEventCommits, latestLoopEntryCommits,
  );
  phaseCheckpoint('convergence');
  // P5b: a computed value's ENTRY commitment only derives once the (earlier) value-chunk pin passes, which
  // is one probe AFTER the chunks converge - so with value chunks, do not break on a stable fingerprint
  // while the probe still errors (bounded by maxIterations). Non-value-chunk txs keep the original break so
  // an expected-revert derivation still exits fast.
  const probeHadError = faithfulProbeHadError;
  const anyProbeHadError = probeHadError || nestedProbeHadError;
  if (debugTargetsThisDerivation && (globalThis as { process?: { env?: Record<string, string> } }).process
    ?.env?.SOLIDC_DEBUG_DERIVATION_MIN === '1') {
    console.error('derivation-min', {
      iter, commitmentProgress, probeError: fullTrace2.find((state) => state.error)?.error,
      stateCommits, entryCommits: latestEntryCommits, loopCommits: latestLoopEntryCommits,
      chunks: stb.getDynamicChunkVars().map((variable) => ({
        name: variable.name, commitments: stb.getChunkRawCommitments(variable.name),
      })),
    });
  }
  const needsPassingProbe = nestedProbeHadError || stb.hasUnresolvedDeferredKeccakPreimages()
    || stb.hasUnresolvedDeferredEcrecoverArguments()
    || runtimeLoopTransferBytecodesDerived.some((derived) => !derived)
    || runtimeLoopTransferAmountsDerived.some((derived) => !derived)
    || runtimeLoopTransferCommitmentsDerived.some((derived) => !derived)
    || runtimeLoopTransferCapabilitiesDerived.some((derived) => !derived)
    || stb.getValueChunkVars().length > 0
    || stb.getDynamicChunkVars().length > 0 || stb.getLoopEntryVars().length > 0;
  if (debugTargetsThisDerivation || (globalThis as { process?: { env?: Record<string, string> } })
    .process?.env?.SOLIDC_DEBUG_EVENT_STAGE === '1') console.error('derive-iteration-summary', JSON.stringify({
    iter,
    elapsedMs: Date.now() - debugIterationStartedAt,
    traceStates: fullTrace2.length,
    probeError: fullTrace2.find((state) => state.error)?.error,
    commitmentProgress,
    nestedPinProgress,
    nestedProbeHadError,
    stateCommitments: stateCommits.length,
    entryCommitments: latestEntryCommits.length,
    eventCommitments: latestEventCommits.filter((commitment) => commitment !== undefined).length,
    dynamicChunks: stb.getDynamicChunkVars().map((variable) => ({
      name: variable.name,
      count: stb.getChunkRawCommitments(variable.name).length,
    })),
    loopEntries: stb.getLoopEntryVars().map((variable) => ({
      collection: variable.collection,
      count: stb.getLoopEntryCommitments(variable.collection).length,
    })),
    valueChunks: stb.getValueChunkVars().map((variable) => ({
      id: variable.id,
      collection: variable.collection,
      count: stb.getValueChunkRawCommitments(variable.id).length,
    })),
    derivedChunks: [...stb.getDerivedChunkOutputs()].map(([outputIndex, chunk]) => ({
      outputIndex,
      fixedIndex: chunk.fixedIndex === true,
      categoryId: chunk.categoryId?.slice(0, 8),
      commitment: chunk.commitment.slice(0, 12),
      lockingBytecode: binToHex(chunk.lockingBytecode.slice(0, 8)),
    })),
    sharedChunkBand: stb.getChunkableValueWriteBand(),
    valueChunkCarriers: stb.getExternalCallUtxoGroups().flatMap((group, groupIndex) => {
      const witness = valueChunkOutputWitnessCarrier(stb, group);
      return witness ? [{
        groupIndex,
        functionName: group.logicalFunctionName ?? group.functionName,
        base: group.valueChunkOutputBase,
        carrierBase: witness.carrier.valueChunkOutputBase,
      }] : [];
    }),
    needsPassingProbe,
  }));

  return {
    convergenceKey,
    anyProbeHadError,
    needsPassingProbe,
  };
}
