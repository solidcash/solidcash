/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — Phase 2 post-loop cleaned placeholder rescan.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
;
;
;
import type { Output } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { evaluateProbeTrace } from './faithful-probe-trace.js';
import { buildParticipantProbeProgram } from './participant-probe-program.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { extractCommitmentMapFromTrace } from './trace-commitment-helpers.js';

export type DeriveFullPhase2CleanedRescanHost = {
  readonly categoryId: string;
  readonly inner: { provider: NetworkProvider };
};

export type DeriveFullPhase2CleanedRescanResult = {
  lastTrace: AuthenticationProgramStateCommon[] | undefined;
  lastFailProbeOutputs: Output[] | undefined;
};

/**
 * Drop unresolved value-chunk `00` placeholders, then iteratively re-probe dynamic
 * chunk commitments from the cleaned layout. Mutates STB chunk commitments in place.
 */
export function deriveFullPhase2CleanedRescan(
  host: DeriveFullPhase2CleanedRescanHost,
  stb: StatefulTransactionBuilder,
  params: {
    configuredDebugIterations: number;
    debugTargetsThisDerivation: boolean;
    dummyLbc: Uint8Array;
    delegatecallInputIndex: number | undefined;
    lastTrace: AuthenticationProgramStateCommon[] | undefined;
    lastFailProbeOutputs: Output[] | undefined;
    retainDiagnosticTrace: (
      trace: AuthenticationProgramStateCommon[],
    ) => AuthenticationProgramStateCommon[];
  },
): DeriveFullPhase2CleanedRescanResult {
  let { lastTrace, lastFailProbeOutputs } = params;
  const {
    configuredDebugIterations,
    debugTargetsThisDerivation,
    dummyLbc,
    delegatecallInputIndex,
    retainDiagnosticTrace,
  } = params;

  // P5b: drop any unresolved '00' value-chunk placeholder from the FINAL commitments. The seed at derivation
  // time gives the covenant's chunk 0 an output to verify against (the chunked bootstrap), but a computed value
  // that resolves INLINE (<= 60 B) pins NO chunks (emitSortedValueChunkPin's size>60 guard), so the placeholder
  // is spurious - a real chunk commitment is always long (slot++digest++i++data), never the 1-byte '00'.
  // Minting it would leave a garbage chunk NFT that a later chunked read of the same slot fails to parse.
  let removedValueChunkPlaceholder = false;
  for (const vcv of stb.getValueChunkVars()) {
    const commits = stb.getValueChunkRawCommitments(vcv.id).filter((c) => c !== '00');
    if (commits.length !== stb.getValueChunkRawCommitments(vcv.id).length) {
      stb.setValueChunkRawCommitments(vcv.id, commits);
      removedValueChunkPlaceholder = true;
    }
  }

  // The speculative value-chunk placeholder above can be the first failing output pin in every
  // primary probe. Once it is removed, delegate execution can finally reach later dynamic-storage
  // pins. Derive those commitments from the cleaned layout before constructing the final transaction.
  if (removedValueChunkPlaceholder && stb.getDynamicChunkVars().length > 0) {
    const cleanedIterationLimit = configuredDebugIterations > 0
      ? Math.min(64, configuredDebugIterations) : 64;
    for (let iter = 0; iter < cleanedIterationLimit; iter++) {
      const cleanedStartedAt = debugTargetsThisDerivation ? Date.now() : 0;
      const cleanedProbe = stb.build();
      const cleanedParamSnap = delegatecallInputIndex !== undefined
        && cleanedProbe.outputs.length > 30
        ? stb.snapshotBuilderReturnOutputParams(cleanedProbe) : undefined;
      let cleanedInsertion: ReturnType<typeof stb.insertBeforeLateValueSuffix> | undefined;
      try {
        cleanedInsertion = delegatecallInputIndex !== undefined
          ? stb.insertBeforeLateValueSuffix(cleanedProbe, { to: dummyLbc, amount: 1000n }, {
            rebindReturnWitnessesOnly: cleanedProbe.outputs.length > 30,
          }) : undefined;
        const { transaction, sourceOutputs } = buildParticipantProbeProgram(
          cleanedProbe, stb.getComposedBlockBase(),
        );
        const cleanedProgram = {
          inputIndex: delegatecallInputIndex ?? 0,
          sourceOutputs,
          transaction,
        };
        const cleanedTrace = evaluateProbeTrace(host.inner.provider, cleanedProgram);
        const faithfulCleanedHadError = cleanedTrace.some((state) => state.error !== undefined);
        if (debugTargetsThisDerivation) console.error('derive-cleaned-evaluated', {
          iter, evaluateMs: Date.now() - cleanedStartedAt,
          faithfulError: cleanedTrace.at(-1)?.error,
          states: cleanedTrace.length,
        });
        lastTrace = retainDiagnosticTrace(cleanedTrace);
        if (faithfulCleanedHadError) {
          lastFailProbeOutputs = cleanedProbe.outputs.map((output) => ({
            to: output.to,
            amount: output.amount,
            token: output.token ? {
              amount: output.token.amount,
              category: output.token.category,
              nft: output.token.nft ? {
                capability: output.token.nft.capability,
                commitment: String(output.token.nft.commitment ?? ''),
              } : undefined,
            } : undefined,
          }));
        }
        let changed = false;
        const firstChunkVar = stb.getDynamicChunkVars()[0];
        const chunkMatches = !firstChunkVar ? []
          : cleanedProbe.outputs.map((output, index) => ({ output, index })).filter(({ output }) =>
            output.token?.category === host.categoryId
            && output.token?.nft?.capability === 'mutable'
            && output.to instanceof Uint8Array
            && binToHex(output.to) === binToHex(firstChunkVar.lockingBytecode));
        const firstCommitments = firstChunkVar
          ? stb.getChunkRawCommitments(firstChunkVar.name) : [];
        const knownOrdinal = firstCommitments.findIndex((commitment) => commitment !== '00');
        const anchored = knownOrdinal < 0 ? undefined : chunkMatches.find(({ output }) =>
          output.token?.nft?.commitment === firstCommitments[knownOrdinal]);
        const physicalChunkIndex = anchored
          ? anchored.index - knownOrdinal
          : (chunkMatches.at(-1)?.index ?? -1) - Math.max(0, firstCommitments.length - 1);
        let chunkOffset = physicalChunkIndex >= 0 ? physicalChunkIndex : stb.getChunkOutputBase();
        for (const dv of stb.getDynamicChunkVars()) {
          const existing = stb.getChunkRawCommitments(dv.name);
          const commitMap = extractCommitmentMapFromTrace(
            cleanedTrace, { min: chunkOffset, max: chunkOffset + existing.length }, true,
          );
          if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
            ?.SOLIDC_DEBUG_CHUNK_SCAN === '1') {
            console.error('cleaned-dynamic-chunk-scan', {
              iter, variable: dv.name, physicalChunkIndex, chunkOffset, existing,
              observed: [...commitMap.entries()], traceError: cleanedTrace.at(-1)?.error,
              traceTail: cleanedTrace.slice(-24).map((state) => ({
                ip: state.ip,
                opcode: state.instructions[state.ip]?.opcode,
                error: state.error,
                ...(state.error && { instructions: state.instructions.map((instruction) => ({
                  opcode: instruction.opcode,
                  data: 'data' in instruction && instruction.data instanceof Uint8Array
                    ? binToHex(instruction.data) : undefined,
                })) }),
                stack: state.stack.slice(-10).map((item) => {
                  const hex = binToHex(item);
                  return `${item.length}:${hex.slice(0, 96)}`;
                }),
              })),
              matchingOutputs: cleanedProbe.outputs.map((output, index) => ({ output, index }))
                .filter(({ output }) => output.to instanceof Uint8Array
                  && binToHex(output.to) === binToHex(dv.lockingBytecode))
                .map(({ output, index }) => ({ index, category: output.token?.category,
                  commitment: output.token?.nft?.commitment })),
              inputs: cleanedProbe.inputs.map((input, index) => ({
                index,
                lockingBytecode: binToHex(input.unlocker.generateLockingBytecode()).slice(0, 70),
                category: input.token?.category,
                commitment: input.token?.nft?.commitment,
              })),
              outputs: cleanedProbe.outputs.map((output, index) => ({
                index,
                lockingBytecode: output.to instanceof Uint8Array ? binToHex(output.to).slice(0, 70) : output.to,
                category: output.token?.category,
                commitment: output.token?.nft?.commitment,
              })),
            });
          }
          const currentChunkOffset = chunkOffset;
          const next = existing.map((commit, i) => commitMap.get(currentChunkOffset + i) ?? commit);
          if (next.some((commit, i) => commit !== existing[i])) {
            stb.setChunkRawCommitments(dv.name, next);
            changed = true;
          }
          chunkOffset += existing.length;
        }
        if (!changed || !faithfulCleanedHadError) break;
        if (debugTargetsThisDerivation) console.error('derive-cleaned-iteration-complete', {
          iter, elapsedMs: Date.now() - cleanedStartedAt, changed,
        });
      } finally {
        if (cleanedParamSnap) {
          stb.restoreBuilderReturnOutputParams(cleanedProbe, cleanedParamSnap, cleanedInsertion);
        }
      }
    }
  }

  return {
    lastTrace,
    lastFailProbeOutputs,
  };
}
