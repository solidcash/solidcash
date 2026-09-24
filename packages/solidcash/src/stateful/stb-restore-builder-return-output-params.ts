/**
 * phase-boundary extract: STB public-surface extract — restoreBuilderReturnOutputParams after probe rebuild.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  sameDerivedChunkOutputObservation,
  type DerivedChunkOutputObservation,
  type LateValueSuffixInsertion,
} from './value-chunk-persist.js';

export interface BuilderReturnOutputParamsSnapshot {
  unlockerParams: Array<{ inputIndex: number; argIndex: number; value: unknown }>;
  groupReturns: Array<{
    index: number;
    ret?: number;
    planned?: number;
    valueChunkOutputBase?: number;
    valueChunkArg?: unknown;
  }>;
  built: Array<[string, number]>;
  derivedChunkOutputs: Array<[number, unknown]>;
}

export interface RestoreBuilderReturnOutputParamsHost {
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
  builtReturnEventOutputIndices: Map<string, number>;
  derivedChunkOutputs: Map<number, DerivedChunkOutputObservation>;
  setDerivedChunkOutput(outputIndex: number, chunk: DerivedChunkOutputObservation): boolean;
}

/**
 * Restore snapshot return/unlocker/derived-chunk state after a probe rebuild, replaying learned
 * observations through setDerivedChunkOutput and rebinding group return / unlocker params.
 */
export function restoreBuilderReturnOutputParams(
  host: RestoreBuilderReturnOutputParamsHost,
  builder: TransactionBuilder,
  snapshot: BuilderReturnOutputParamsSnapshot,
  insertion?: LateValueSuffixInsertion,
): void {
  const allGroups = [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups];
  const baseline = new Map(
    snapshot.derivedChunkOutputs as Array<[number, DerivedChunkOutputObservation]>,
  );
  const probeBaseline = insertion?.shiftedAbsoluteWitnesses
    ? new Map([...baseline].map(([index, observation]) => [
      index >= insertion.insertAt ? index + 1 : index,
      observation,
    ] as const))
    : baseline;
  const learned = [...host.derivedChunkOutputs].filter(([index, observation]) => (
    !sameDerivedChunkOutputObservation(probeBaseline.get(index), observation)
  ));
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_RESOURCE_PARTS === '1'
    && [...learned, ...baseline].some(([, observation]) => observation.resourceIdentity !== undefined)) {
    const summarize = ([index, observation]: [number, DerivedChunkOutputObservation]) => ({
      index,
      categoryId: observation.categoryId?.slice(0, 8),
      resourceIdentity: observation.resourceIdentity,
      resourcePart: observation.resourcePart,
      semanticKind: observation.semanticKind,
      commitment: observation.commitment.slice(0, 20),
    });
    console.error('restore-derived-resource-parts', {
      insertion,
      baseline: [...baseline].filter(([, item]) => item.resourceIdentity !== undefined).map(summarize),
      probeBaseline: [...probeBaseline].filter(([, item]) => item.resourceIdentity !== undefined).map(summarize),
      learned: learned.filter(([, item]) => item.resourceIdentity !== undefined).map(summarize),
    });
  }
  host.builtReturnEventOutputIndices = new Map(snapshot.built);
  host.derivedChunkOutputs = new Map(
    snapshot.derivedChunkOutputs as Array<[number, DerivedChunkOutputObservation]>,
  );
  for (const [probeIndex, observation] of learned) {
    // The inserted output is deliberately unauthenticated probe padding. Evidence naming it cannot be carried
    // into the transaction which omits that output.
    if (insertion && probeIndex === insertion.insertAt
      && observation.resourceIdentity === undefined) continue;
    // A probe-local splice changes semantic coordinates only when the corresponding absolute witnesses were
    // rebound. If they stayed fixed, an observation at index N authenticates index N in the rebuilt transaction;
    // projecting it back by one aliases adjacent resource parts (for example chunk 1 onto chunk 0).
    const outputIndex = insertion?.shiftedAbsoluteWitnesses && probeIndex > insertion.insertAt
      ? probeIndex - 1 : probeIndex;
    if (sameDerivedChunkOutputObservation(host.derivedChunkOutputs.get(outputIndex), observation)) continue;
    if (observation.resourceIdentity && observation.resourcePart) {
      const prior = [...host.derivedChunkOutputs.entries()].find(([, candidate]) => (
        candidate.resourceIdentity === observation.resourceIdentity
        && candidate.resourcePart === observation.resourcePart
      ));
      if (prior && !sameDerivedChunkOutputObservation(prior[1], observation)) {
        if (host.messageBusConvention === 'kernel-row-loop') {
          throw new Error(
            `Conflicting authenticated observation for value-chunk resource '${observation.resourceIdentity}'`,
          );
        }
      } else if (prior && prior[0] !== outputIndex) {
        host.derivedChunkOutputs.delete(prior[0]);
      }
    }
    host.setDerivedChunkOutput(outputIndex, observation);
  }
  for (const entry of snapshot.groupReturns) {
    const group = allGroups[entry.index];
    if (!group) continue;
    group.returnOutputIndex = entry.ret;
    if ('plannedReturnOutputIndex' in group) group.plannedReturnOutputIndex = entry.planned;
    group.valueChunkOutputBase = entry.valueChunkOutputBase;
    if (entry.valueChunkArg !== undefined) {
      group.internalArgs = {
        ...group.internalArgs,
        __internal__valueChunkOutputBase: entry.valueChunkArg,
      };
    }
  }
  for (const entry of snapshot.unlockerParams) {
    const unlocker = builder.inputs[entry.inputIndex]?.unlocker as {
      params?: unknown[];
      syncEncodedArgsFromParams?: (onlyIndices?: readonly number[]) => void;
    } | undefined;
    if (!unlocker?.params) continue;
    if (unlocker.params[entry.argIndex] === entry.value) continue;
    unlocker.params[entry.argIndex] = entry.value;
    unlocker.syncEncodedArgsFromParams?.([entry.argIndex]);
  }
}
