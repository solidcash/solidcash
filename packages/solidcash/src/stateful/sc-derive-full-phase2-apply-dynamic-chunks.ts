/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — Phase 2 dynamic-storage chunk commitment apply.
 */

import {
  binToHex, binToUtf8, utf8ToBin, type AuthenticationProgramStateCommon,
} from '@bitauth/libauth';
import type { StateLayout } from '@solidcash/utils';
import {
  DYNAMIC_CHUNK_SIZE,
  Op,
  buildChunkCommitment,
  decodePushdataValue,
  isFixedWidthType,
  parseArrayTypeString,
  splitValueIntoChunks,
  unpackFixedWidthArray,
} from '@solidcash/utils';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { StateValueType } from '../types/state-inference.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import {
  extractCommitmentMapFromTrace,
  isDynamicChunkCommitmentAtIndex,
} from './trace-commitment-helpers.js';
import { extractVerifiedValuesFromTrace } from './trace-verified-value-helpers.js';

export interface DeriveFullPhase2DynamicChunksHost {
  readonly categoryId: string;
  readonly inner: {
    provider: NetworkProvider & {
      consensusLimits?: { maximumNftCommitmentBytes?: number };
    };
  };
}

export type DeriveFullPhase2DynamicChunkVar = ReturnType<
  StatefulTransactionBuilder['getDynamicChunkVars']
>[number];

export type DeriveFullPhase2DynamicChunksResult = {
  commitmentProgress: number;
  derivedAState: Record<string, StateValueType> | undefined;
  chunkVars: DeriveFullPhase2DynamicChunkVar[];
  getPhysicalChunkOutputBase: () => number;
};

/**
 * Grow/replace dynamic-storage chunk placeholders from Phase-2 probe traces and
 * refresh typed A-state when a complete dynamic value is recovered.
 */
export function deriveFullPhase2ApplyDynamicChunks(
  host: DeriveFullPhase2DynamicChunksHost,
  stb: StatefulTransactionBuilder,
  params: {
    probeBuilder2: TransactionBuilder;
    fullTrace2: AuthenticationProgramStateCommon[];
    commitmentProgress: number;
    derivedAState: Record<string, StateValueType> | undefined;
    stateLayout: StateLayout;
    iter: number;
    phaseCheckpoint: (stage: string) => void;
  },
): DeriveFullPhase2DynamicChunksResult {
  let { commitmentProgress, derivedAState } = params;
  const { probeBuilder2, fullTrace2, stateLayout, iter, phaseCheckpoint } = params;

  // Dynamic-storage chunk commitments. The data-NFT field holds uint32 A$len; from it we know
  // nNew = ceil(len/CHUNK). Ensure the builder creates nNew chunk outputs (placeholders until
  // their commitments are extracted), then extract the real commitments the covenant built.
  const chunkVars = stb.getDynamicChunkVars();
  // StatefulTransactionBuilder already incorporates the composed delegate block base. Dynamic chunks
  // are inserted before later composed output families, so they are not generally at the transaction
  // tail (Marketplace has message-bus/event outputs after this region).
  const getPhysicalChunkOutputBase = (): number => {
    if (chunkVars.length === 0) return stb.getChunkOutputBase();
    const suffixVar = chunkVars.find((variable) => variable.delegateSuffix === true);
    if (suffixVar) {
      // Delegate writes use TXOUTPUTCOUNT-1-nNew (one trailing OP_RETURN/change).
      const nNew = Math.max(1, stb.getChunkRawCommitments(suffixVar.name).length);
      return Math.max(0, probeBuilder2.outputs.length - 1 - nNew);
    }
    const chunkBytecode = binToHex(chunkVars[0].lockingBytecode);
    const matches = probeBuilder2.outputs.map((output, index) => ({ output, index })).filter(({ output }) =>
      output.token?.category === host.categoryId
      && output.token?.nft?.capability === 'mutable'
      && output.to instanceof Uint8Array && binToHex(output.to) === chunkBytecode);
    const firstCommitments = stb.getChunkRawCommitments(chunkVars[0].name);
    const knownOrdinal = firstCommitments.findIndex((commitment) => commitment !== '00');
    // With no authenticated chunk yet, the locking bytecode/category pair is not a sufficient anchor:
    // a delegate suffix can use the same covenant and category. Falling back to its last match aliases
    // that suffix onto the chunk window. The builder's layout is authoritative until a commitment pins it.
    if (knownOrdinal < 0) return stb.getChunkOutputBase();
    const anchored = knownOrdinal < 0 ? undefined : matches.find(({ output }) =>
      output.token?.nft?.commitment === firstCommitments[knownOrdinal]);
    if (anchored) return anchored.index - knownOrdinal;
    return stb.getChunkOutputBase();
  };
  if (chunkVars.length > 0 && derivedAState) {
    let chunkOffset = getPhysicalChunkOutputBase();
    for (const dv of chunkVars) {
      const existing = stb.getChunkRawCommitments(dv.name);
      const derivedLength = derivedAState[`${dv.name}$len`];
      // A composed delegate variable may not exist in the caller's decoded A-state. Missing is not zero:
      // retain the speculative region so the delegate covenant can reveal its chunk commitment by trace.
      const lengthIsNumeric = typeof derivedLength === 'bigint' || typeof derivedLength === 'number';
      const hasDerivedLength = lengthIsNumeric
        && (dv.delegate !== true || Number(derivedLength) > 0 || existing.length === 0);
      const len = hasDerivedLength ? Number(derivedLength) : 0;
      const decodedCount = hasDerivedLength ? Math.ceil(len / DYNAMIC_CHUNK_SIZE) : existing.length;
      // A known post-state length owns the entire new run, including retired tail chunks. Keeping the old
      // width on a shrink shifts TXOUTPUTCOUNT-1-nNew and republishes chunks the covenant must consume.
      // When the delegate has not exposed its length yet, decodedCount already retains the speculative width.
      const nNew = decodedCount;
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_DYNAMIC_MIN === '1') {
        console.error('dynamic-min', {
          iter, name: dv.name, delegate: dv.delegate, derivedLength, existing,
          hasDerivedLength, nNew, chunkOffset, computedBase: stb.getChunkOutputBase(),
        });
      }
      if (existing.length !== nNew) {
        stb.setChunkRawCommitments(dv.name, Array.from({ length: nNew }, (_, i) => existing[i] ?? '00'));
        commitmentProgress += Math.abs(existing.length - nNew);
      }
      const derivedDynamicValue = derivedAState[dv.name];
      let derivedDynamicBytes = typeof derivedDynamicValue === 'string'
        ? utf8ToBin(derivedDynamicValue)
        : derivedDynamicValue instanceof Uint8Array ? derivedDynamicValue : undefined;
      // Dynamic writes keep the newly assembled value on the VM stack while pinning its chunk outputs.
      // The data-NFT state exposes its exact byte length even when it cannot decode the value itself, so
      // recover the length-matched stack item and build every canonical chunk without guessing outputs.
      if (derivedDynamicBytes === undefined && len > 0) {
        for (let traceIndex = fullTrace2.length - 1; traceIndex >= 0 && !derivedDynamicBytes; traceIndex--) {
          const stack = fullTrace2[traceIndex].stack;
          for (let stackIndex = stack.length - 1; stackIndex >= 0; stackIndex--) {
            if (stack[stackIndex].length === len) {
              derivedDynamicBytes = stack[stackIndex];
              break;
            }
          }
        }
      }
      if (derivedDynamicBytes === undefined && dv.delegate === true && !hasDerivedLength) {
        // A delegate may assemble the complete new dynamic value before it reaches the data-NFT length pin;
        // a preceding grafted loop can halt execution in between. Recover the largest chunk-worthy stack
        // item, then let the delegate's own chunk commitments authenticate it on the following probe.
        const candidates = fullTrace2.flatMap((step) => step.stack)
          .filter((item) => item.length > DYNAMIC_CHUNK_SIZE);
        derivedDynamicBytes = candidates.sort((a, b) => b.length - a.length)[0];
      }
      if (derivedDynamicBytes !== undefined) {
        const exact = splitValueIntoChunks(derivedDynamicBytes).map((chunk, index) => (
          buildChunkCommitment(
            index, chunk, host.inner.provider.consensusLimits?.maximumNftCommitmentBytes,
          )
        ));
        const authenticatedDynamicBytes = exact.length === existing.length
          && exact.every((commitment, index) => commitment === existing[index]);
        const variable = authenticatedDynamicBytes
          ? stateLayout.variables.find((candidate) => candidate.name === dv.name)
          : undefined;
        if (variable !== undefined) {
          try {
            const array = parseArrayTypeString(variable.type);
            if (array && isFixedWidthType(array.elementType)) {
              derivedAState[dv.name] = unpackFixedWidthArray(
                derivedDynamicBytes, array.elementType,
              ) as StateValueType;
            } else if (array) {
              derivedAState[dv.name] = (derivedDynamicBytes.length === 0
                ? []
                : decodePushdataValue(
                  derivedDynamicBytes, 0, variable.type, stateLayout.structs,
                ).value) as StateValueType;
            } else {
              derivedAState[dv.name] = (variable.type === 'string'
                ? binToUtf8(derivedDynamicBytes)
                : derivedDynamicBytes) as StateValueType;
            }
          } catch {
            // A relaxed probe can expose a length-matched intermediate before its output pin succeeds.
            // Keep the commitment candidate, but defer typed dependency refresh until a later probe
            // exposes a structurally complete dynamic value.
          }
        }
        stb.setChunkRawCommitments(dv.name, dv.delegateSuffix === true && !hasDerivedLength
          && existing.length > exact.length
          ? [...exact, ...existing.slice(exact.length)] : exact);
        commitmentProgress += exact.filter((commitment, index) => commitment !== existing[index]).length;
      }
      if (nNew > 0) {
        // X10: key each observation by ITS output index (chunk i lives at chunkOffset + i), not
        // positionally. A positional list collapses onto index 0, so when the region's LOW chunks are
        // never verified - the covenant addressed a different output - a commitment observed higher in
        // the window is silently credited to chunk 0 and the true chunk 0 stays a '00' placeholder.
        // Matches the loop-entry and value-chunk derivations, which are already index-keyed.
        const range = { min: chunkOffset, max: chunkOffset + nNew };
        const chunkMap = extractCommitmentMapFromTrace(fullTrace2, range, true);
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_DYNAMIC_MIN === '1' && iter < 5) {
          console.error('dynamic-min-commit-map', { iter, name: dv.name, range, entries: [...chunkMap.entries()] });
        }
        if (chunkMap.size > 0) {
          const derivedChunks: string[] = [];
          for (const [outIdx, commit] of chunkMap) {
            const chunkIndex = outIdx - chunkOffset;
            const current = stb.getChunkRawCommitments(dv.name)[chunkIndex];
            derivedChunks[chunkIndex] = current !== undefined
              && isDynamicChunkCommitmentAtIndex(current, chunkIndex)
              && !isDynamicChunkCommitmentAtIndex(commit, chunkIndex) ? current : commit;
          }
          const cur = stb.getChunkRawCommitments(dv.name);
          stb.setChunkRawCommitments(dv.name,
            Array.from({ length: nNew }, (_, i) => derivedChunks[i] ?? cur[i] ?? '00'));
          commitmentProgress += chunkMap.size;
        }
      }
      if (dv.delegateSuffix === true) {
        const current = stb.getChunkRawCommitments(dv.name);
        const nextIndex = chunkOffset + current.length;
        const nextBytecodes = extractVerifiedValuesFromTrace(
          fullTrace2, Op.OP_OUTPUTBYTECODE, { min: nextIndex, max: nextIndex + 1 }, true, true, true,
        );
        if (nextBytecodes.some((bytecode) => binToHex(bytecode) === binToHex(dv.lockingBytecode))) {
          stb.setChunkRawCommitments(dv.name, [...current, '00']);
          commitmentProgress += 1;
        }
      }
      chunkOffset += stb.getChunkRawCommitments(dv.name).length;
    }
  } else if (chunkVars.length > 0) {
    // Delegate probes can reveal the exact expected chunk commitment before their rewritten data-NFT
    // state has converged. Preserve that progress instead of leaving the seeded `00` placeholder.
    let chunkOffset = getPhysicalChunkOutputBase();
    for (const dv of chunkVars) {
      const existing = stb.getChunkRawCommitments(dv.name);
      const range = { min: chunkOffset, max: chunkOffset + existing.length };
      const commitMap = extractCommitmentMapFromTrace(fullTrace2, range, true);
      const currentChunkOffset = chunkOffset;
      const next = existing.map((commit, i) => {
        const learned = commitMap.get(currentChunkOffset + i);
        return learned === undefined || (isDynamicChunkCommitmentAtIndex(commit, i)
          && !isDynamicChunkCommitmentAtIndex(learned, i)) ? commit : learned;
      });
      if (next.some((commit, i) => commit !== existing[i])) {
        stb.setChunkRawCommitments(dv.name, next);
        commitmentProgress += next.length;
      }
      chunkOffset += existing.length;
    }
  }
  if (chunkVars.length > 0) {
    let chunkOffset = getPhysicalChunkOutputBase();
    for (const dv of chunkVars) {
      const existing = stb.getChunkRawCommitments(dv.name);
      const commitMap = extractCommitmentMapFromTrace(
        fullTrace2, { min: chunkOffset, max: chunkOffset + existing.length },
        true,
      );
      const currentChunkOffset = chunkOffset;
      const next = existing.map((commit, i) => {
        const learned = commitMap.get(currentChunkOffset + i);
        return learned === undefined || (isDynamicChunkCommitmentAtIndex(commit, i)
          && !isDynamicChunkCommitmentAtIndex(learned, i)) ? commit : learned;
      });
      if (next.some((commit, i) => commit !== existing[i])) {
        stb.setChunkRawCommitments(dv.name, next);
        commitmentProgress += next.length;
      }
      chunkOffset += existing.length;
    }
  }

  phaseCheckpoint('dynamic-initial');

  return {
    commitmentProgress,
    derivedAState,
    chunkVars,
    getPhysicalChunkOutputBase,
  };
}
