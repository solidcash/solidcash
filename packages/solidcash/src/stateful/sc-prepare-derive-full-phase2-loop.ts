/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — Phase 2 loop prelude (bounds, fingerprints, optimistic seeds).
 */

import {
  binToHex, type AuthenticationProgramStateCommon,
} from '@bitauth/libauth';
import { hash256 as hash256Sync } from '@solidcash/utils';
import type { Output } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { StateValueType } from '../types/state-inference.js';
import { boundedDerivationIterations } from './early-value-chunk-helpers.js';
import { evaluateProbeTrace } from './faithful-probe-trace.js';
import { buildParticipantProbeProgram } from './participant-probe-program.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';

export interface DeriveFullPhase2LoopPreludeHost {
  readonly inner: { provider: NetworkProvider };
  readonly maxDerivationIterations: number;
  lastDerivationIterations: number;
}

export type DeriveFullPhase2LoopState = {
  derivedAState: Record<string, StateValueType> | undefined;
  prevConvergenceKey: string;
  derivedStateCount: number;
  lastTrace: AuthenticationProgramStateCommon[] | undefined;
  lastFailProbeOutputs: Output[] | undefined;
  previousProbeFingerprint: string | undefined;
  skipNestedAfterPass: boolean;
  seenConvergenceKeys: Set<string>;
  probedSortedLoop: Set<string>;
};

export type DeriveFullPhase2LoopPrelude = {
  entryCount: number;
  eventCount: number;
  stateCount: number;
  maxIterations: number;
  configuredDebugIterations: number;
  debugTargetsThisDerivation: boolean;
  persistWidth: number;
  retainDiagnosticTrace: (
    trace: AuthenticationProgramStateCommon[],
  ) => AuthenticationProgramStateCommon[];
  fingerprintLockingBytecode: (bytecode: Uint8Array) => string;
  lockingBytecodeFingerprintCache: WeakMap<Uint8Array, string>;
  loopState: DeriveFullPhase2LoopState;
};

/**
 * Compute Phase-2 iteration bounds, diagnostic helpers, and optimistic scalar-write seeds
 * before the convergence for-loop.
 */
export function prepareDeriveFullPhase2Loop(
  host: DeriveFullPhase2LoopPreludeHost,
  stb: StatefulTransactionBuilder,
  params: {
    entryAccessesLength: number;
    emitInfosLength: number;
    requiredNftIndicesLength: number;
    persistWidthAtEntry: number;
    debugTargetDerivation: boolean;
    dummyLbc: Uint8Array;
    delegatecallInputIndex: number | undefined;
  },
): DeriveFullPhase2LoopPrelude {
  const {
    entryAccessesLength: entryCount,
    emitInfosLength: eventCount,
    requiredNftIndicesLength: stateCount,
    persistWidthAtEntry,
    debugTargetDerivation,
    dummyLbc,
    delegatecallInputIndex,
  } = params;

  // Phase 2: Derive A's state + entries + events (iterative)
  let derivedAState: Record<string, StateValueType> | undefined;
  let prevConvergenceKey = '';
  let derivedStateCount = 0;
  const configuredDebugIterations = Number((globalThis as { process?: { env?: Record<string, string> } })
    .process?.env?.SOLIDC_DEBUG_MAX_DERIVATION_ITERATIONS ?? 0);
  const hasLoopOrChunkVars = stb.getLoopEntryVars().length > 0
    || stb.getRuntimeLoopEventOutputs().length > 0
    || stb.getRuntimeLoopTransferOutputs().length > 0
    || stb.getValueChunkVars().length > 0
    || stb.getDynamicChunkVars().length > 0;
  const persistWidth = persistWidthAtEntry;
  if (persistWidth > 0) stb.seedPersistedJobEventsBand();
  const maxIterationsDefault = boundedDerivationIterations({
    defaultIterations: host.maxDerivationIterations,
    persistWidth,
    hasLoopOrChunkVars,
  });
  const debugTargetsThisDerivation = debugTargetDerivation;
  const maxIterations = configuredDebugIterations > 0
    ? Math.min(maxIterationsDefault, configuredDebugIterations) : maxIterationsDefault;
  let lastTrace: AuthenticationProgramStateCommon[] | undefined;
  let lastFailProbeOutputs: Output[] | undefined;
  const retainDiagnosticTrace = (
    trace: AuthenticationProgramStateCommon[],
  ): AuthenticationProgramStateCommon[] => {
    const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
    const from = Number(env?.SOLIDC_DEBUG_DERIVE_TRACE_FROM_IP ?? Number.NaN);
    const to = Number(env?.SOLIDC_DEBUG_DERIVE_TRACE_TO_IP ?? Number.NaN);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return trace.slice(-16);
    return [...trace.filter((state) => state.ip >= from && state.ip <= to), ...trace.slice(-16)];
  };
  let previousProbeFingerprint: string | undefined;
  const lockingBytecodeFingerprintCache = new WeakMap<Uint8Array, string>();
  const fingerprintLockingBytecode = (bytecode: Uint8Array): string => {
    const cached = lockingBytecodeFingerprintCache.get(bytecode);
    if (cached !== undefined) return cached;
    const fingerprint = binToHex(hash256Sync(bytecode));
    lockingBytecodeFingerprintCache.set(bytecode, fingerprint);
    return fingerprint;
  };
  let skipNestedAfterPass = false;
  const seenConvergenceKeys = new Set<string>();
  const probedSortedLoop = new Set<string>();

  if (debugTargetsThisDerivation) console.error('derive-phase2-loop-ready', { maxIterations });

  stb.seedOptimisticScalarWrites(0);
  stb.seedOptimisticArrayElementWrites();
  const optimisticPermutationCount = stb.getOptimisticPermutationCount();
  if (optimisticPermutationCount > 1) {
    let permutationAccepted = false;
    for (let permutationIndex = 0; permutationIndex < optimisticPermutationCount; permutationIndex += 1) {
      if (permutationIndex > 0) {
        stb.clearOptimisticScalarWrites();
        stb.seedOptimisticScalarWrites(permutationIndex);
      }
      const trialBuilder = stb.build();
      const trialParamSnap = delegatecallInputIndex !== undefined
        && trialBuilder.outputs.length > 30
        ? stb.snapshotBuilderReturnOutputParams(trialBuilder) : undefined;
      const trialInsertion = delegatecallInputIndex !== undefined
        ? stb.insertBeforeLateValueSuffix(trialBuilder, { to: dummyLbc, amount: 1000n }, {
          rebindReturnWitnessesOnly: trialBuilder.outputs.length > 30,
        }) : undefined;
      const { transaction: trialTransaction, sourceOutputs: trialSources } = buildParticipantProbeProgram(
        trialBuilder, stb.getComposedBlockBase(),
      );
      if (trialParamSnap) stb.restoreBuilderReturnOutputParams(trialBuilder, trialParamSnap, trialInsertion);
      const trialTrace = evaluateProbeTrace(host.inner.provider, {
        inputIndex: delegatecallInputIndex ?? 0,
        sourceOutputs: trialSources,
        transaction: trialTransaction,
      }, false);
      if (!trialTrace.some((state) => state.error !== undefined)) {
        permutationAccepted = true;
        break;
      }
    }
    if (!permutationAccepted) {
      stb.clearOptimisticScalarWrites();
      stb.seedOptimisticScalarWrites(0);
    }
  }
  host.lastDerivationIterations = 0;

  return {
    entryCount,
    eventCount,
    stateCount,
    maxIterations,
    configuredDebugIterations,
    debugTargetsThisDerivation,
    persistWidth,
    retainDiagnosticTrace,
    fingerprintLockingBytecode,
    lockingBytecodeFingerprintCache,
    loopState: {
      derivedAState,
      prevConvergenceKey,
      derivedStateCount,
      lastTrace,
      lastFailProbeOutputs,
      previousProbeFingerprint,
      skipNestedAfterPass,
      seenConvergenceKeys,
      probedSortedLoop,
    },
  };
}
