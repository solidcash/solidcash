/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — Phase 2 dynamic-rescan + event commitment apply.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import type { EmitAbi, FunctionBlockLayout } from '@solidcash/utils';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { extractGraphEventExpectations, graphEventCandidateIndices } from './graph-event-expectations.js';
import {
  extractCommitmentMapFromTrace,
  isDynamicChunkCommitmentAtIndex,
} from './trace-commitment-helpers.js';

export type DeriveFullPhase2DynamicChunkVar = ReturnType<
StatefulTransactionBuilder['getDynamicChunkVars']
>[number];

export type DeriveFullPhase2EventsHost = {
  extractExpectedOutputCommitmentFromTrace: (
    trace: AuthenticationProgramStateCommon[],
    outputIndex: number,
    actualCommitment: string,
  ) => string | undefined;
};

export type DeriveFullPhase2EventsResult = {
  commitmentProgress: number;
  latestEventCommits: string[];
};

/**
 * Re-scan dynamic chunk commitments after value-chunk discovery, then apply
 * compiler-published event commitments from the Phase-2 probe trace.
 */
export function deriveFullPhase2ApplyDynamicRescanAndEvents(
  host: DeriveFullPhase2EventsHost,
  stb: StatefulTransactionBuilder,
  params: {
    fullTrace2: AuthenticationProgramStateCommon[];
    commitmentProgress: number;
    latestEventCommits: string[];
    chunkVars: DeriveFullPhase2DynamicChunkVar[];
    getPhysicalChunkOutputBase: () => number;
    eventCount: number;
    emitInfos: readonly EmitAbi[] | undefined;
    eventBlockLayout: FunctionBlockLayout | undefined;
    probeBuilder2: TransactionBuilder;
    transaction2: ReturnType<TransactionBuilder['buildLibauthProgram']>['transaction'];
    sourceOutputs2: ReturnType<TransactionBuilder['buildLibauthProgram']>['sourceOutputs'];
    delegatecallInputIndex: number | undefined;
    iter: number;
    phaseCheckpoint: (stage: string) => void;
  },
): DeriveFullPhase2EventsResult {
  let { commitmentProgress, latestEventCommits } = params;
  const {
    fullTrace2,
    chunkVars,
    getPhysicalChunkOutputBase,
    eventCount,
    emitInfos,
    eventBlockLayout,
    probeBuilder2,
    transaction2,
    sourceOutputs2,
    delegatecallInputIndex,
    iter,
    phaseCheckpoint,
  } = params;

  // Value-chunk discovery can shift the delegate dynamic-output base during this probe. Re-scan
  // dynamic commitments after value chunks have converged so the output-index range reflects the
  // builder's updated layout (NEW nodes, value chunks, pending outputs, then dynamic chunks).
  if (chunkVars.length > 0) {
    const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
    const debugDynamicChunks = env?.SOLIDC_DEBUG_ROUTE_CONCISE === '1' || env?.SOLIDC_DEBUG_RETURN === '1';
    let chunkOffset = getPhysicalChunkOutputBase();
    for (const dv of chunkVars) {
      const existing = stb.getChunkRawCommitments(dv.name);
      const commitMap = extractCommitmentMapFromTrace(
        fullTrace2, { min: chunkOffset, max: chunkOffset + existing.length }, true,
      );
      if (debugDynamicChunks) {
        console.error('root-dynamic-chunk-scan', {
          iter, variable: dv.name, delegatecallInputIndex,
          chunkOffset, existing, outputCount: probeBuilder2.outputs.length,
          observed: [...commitMap.entries()], traceError: fullTrace2.at(-1)?.error,
          ...(iter <= 1 && {
            allObserved: [...extractCommitmentMapFromTrace(fullTrace2, undefined, true).entries()],
            traceTail: fullTrace2.slice(-24).map((state) => ({
              ip: state.ip,
              instructionCount: state.instructions.length,
              opcode: state.instructions[state.ip]?.opcode,
              error: state.error,
              stack: state.stack.slice(-12).map((item) => {
                const hex = binToHex(item);
                return `${item.length}:${hex.slice(0, 96)}`;
              }),
            })),
            tokenOutputs: probeBuilder2.outputs.map((output, index) => ({
              index,
              category: output.token?.category,
              capability: output.token?.nft?.capability,
              commitment: output.token?.nft?.commitment
                ? String(output.token.nft.commitment).slice(0, 48) : undefined,
            })).filter((output) => output.category !== undefined),
          }),
        });
      }
      const currentChunkOffset = chunkOffset;
      const next = existing.map((commit, i) => {
        const learned = commitMap.get(currentChunkOffset + i);
        if (learned === undefined) return commit;
        // Dynamic chunk commitments are pushdata(index) ++ pushdata(non-empty chunk). Reject loop-control
        // integers and other incidental OTC/EQUALVERIFY pairs before they poison iterative convergence.
        try {
          return isDynamicChunkCommitmentAtIndex(learned, i) ? learned : commit;
        } catch {
          return commit;
        }
      });
      if (next.some((commit, i) => commit !== existing[i])) {
        stb.setChunkRawCommitments(dv.name, next);
        commitmentProgress += next.length;
      }
      chunkOffset += existing.length;
    }
  }

  phaseCheckpoint('dynamic-rescan');
  // Event commitments are keyed by the compiler-published physical emit index. A bounded route reserves
  // the union of all event sites, while a runtime batch can select a sparse subset (for example only row
  // 1 emits). `eventCount` is therefore not a physical width and must not be used as a contiguous range.
  if (eventCount > 0) {
    latestEventCommits = [];
    const eventSlots = eventBlockLayout?.slots.filter((slot) => slot.kind === 'event') ?? [];
    const firstEventOffset = eventSlots[0]?.offset;
    const selectedEmits = emitInfos!.map((emitInfo, selectedOrdinal) => {
      const slot = eventSlots.find((candidate) => candidate.slotIndex === emitInfo.emitIndex);
      const outputIndex = slot === undefined
        // Backward compatibility for artifacts predating block-layout event slots.
        ? stb.getEventOutputBase() + selectedOrdinal
        // The builder's effective layout has already projected any
        // delegate-owned slots into its physical event frame. Anchor
        // that frame once; the delegate input index belongs to VM
        // execution, not to output materialization.
        : stb.getEventOutputBase() + slot.offset - (firstEventOffset ?? slot.offset);
      return { emitInfo, selectedOrdinal, slot, outputIndex };
    });
    // Graph handlers search a bounded event window using both commitment and covenant identity. There is no
    // EQUALVERIFY pin until a candidate matches, so an empty event blocks every later state/value-chunk pin.
    // Reuse the same compiler-pattern-aware extractor as return probes, restricted to these published slots.
    const graphExpectations = extractGraphEventExpectations(
      fullTrace2, new Set(selectedEmits.map((emit) => emit.outputIndex)), transaction2.outputs,
    );
    const graphCandidates = graphEventCandidateIndices(fullTrace2);
    for (const { emitInfo, selectedOrdinal, slot, outputIndex } of selectedEmits) {
      const eventCommitMap = extractCommitmentMapFromTrace(
        fullTrace2, { min: outputIndex, max: outputIndex + 1 }, true, false, true,
      );
      const actual = probeBuilder2.outputs[outputIndex]?.token?.nft?.commitment;
      const mappedCommitment = graphCandidates.has(outputIndex)
        ? graphExpectations.get(outputIndex)?.commitment : eventCommitMap.get(outputIndex);
      const fallbackCommitment = mappedCommitment === undefined && !graphCandidates.has(outputIndex)
        ? host.extractExpectedOutputCommitmentFromTrace(fullTrace2, outputIndex, actual ?? '')
        : undefined;
      const commitment = mappedCommitment ?? fallbackCommitment;
      const debugEnv = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
      const debugEventIndex = Number.parseInt(debugEnv?.SOLIDC_DEBUG_EVENT_INDEX ?? '', 10);
      if (debugEventIndex === outputIndex || debugEnv?.SOLIDC_DEBUG_EVENT_STAGE === '1') {
        console.error('stateful-event-derivation', {
          iter,
          outputIndex,
          selectedOrdinal,
          emitIndex: emitInfo.emitIndex,
          eventSignature: emitInfo.eventSignature,
          blockSize: eventBlockLayout?.blockSize,
          slot,
          actual,
          mappedCommitment,
          fallbackCommitment,
          traceStates: fullTrace2.length,
          traceEnd: fullTrace2.at(-1) === undefined ? undefined : {
            ip: fullTrace2.at(-1)!.ip,
            error: String(fullTrace2.at(-1)!.error),
          },
          pinned: [...eventCommitMap.entries()],
          eventBase: stb.getEventOutputBase(),
          outputCount: transaction2.outputs.length,
          inputs: sourceOutputs2.slice(0, 14).map((output, index) => ({
            index,
            lock: binToHex(output.lockingBytecode).slice(0, 16),
            category: output.token?.category === undefined
              ? undefined : binToHex(output.token.category).slice(0, 10),
            commitmentLength: output.token?.nft?.commitment?.length,
          })),
          materialized: transaction2.outputs.slice(0, 14).map((output, index) => ({
            index,
            lock: binToHex(output.lockingBytecode).slice(0, 16),
            category: output.token?.category === undefined
              ? undefined : binToHex(output.token.category).slice(0, 10),
            commitmentLength: output.token?.nft?.commitment?.length,
            commitment: output.token?.nft?.commitment === undefined
              ? '~none~' : binToHex(output.token.nft.commitment).slice(0, 12),
          })),
        });
      }
      if (commitment === undefined) continue;
      latestEventCommits[selectedOrdinal] = commitment;
      stb.setEventRawCommitment(emitInfo.emitIndex, commitment);
      commitmentProgress += 1;
    }
  }

  phaseCheckpoint('events');

  return {
    commitmentProgress,
    latestEventCommits,
  };
}
