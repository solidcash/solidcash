/**
 * phase-boundary extract: SC _createBuilder extract — upsert-loop counter-step + key topology front
 * after domain/keys: occurrence helpers, value-trace, keyExpression bindings,
 * keyBinsFor/slotForKey, and counter-ordered keysArr rewrite.
 */

import type {
  AbiFunction,
  ExternalCallExpression,
  SortedUpsertLoopAbi,
} from '@solidcash/utils';
import type { ConstructorArgument, FunctionArgument } from '../Argument.js';
import {
  bytesToSlotValue,
  keyToSlotMulti,
} from './SortedList.js';
import { vmapCounterPermutationSpec } from './sc-batch-raw.js';

const VMAP_COUNTER_PERM_PREFIX = '__internal__vmapCounterPerm_';

export type PrepareCreateBuilderUpsertLoopKeyTopologyHost = {
  readonly signer: any;
  vmapCounterStep: (...args: any[]) => bigint | undefined;
  hydrateExternalPredicateState: (...args: any[]) => Promise<Record<string, unknown>>;
  evaluateExternalExpression: (...args: any[]) => unknown;
  [key: string]: any;
};

export type PrepareCreateBuilderUpsertLoopKeyTopologyResult = {
  keysArr: unknown[];
  loopPredicateState: Record<string, unknown>;
  counterSpec: any;
  resolveCounterStep: () => bigint | undefined;
  occurrenceOf: (key: unknown) => number;
  valueTrace: any;
  keyExpressionBindings: any;
  keyBinsFor: (key: unknown) => Uint8Array[];
  slotForKey: (key: unknown) => Uint8Array;
  isDelete: boolean;
};

/**
 * Prepare counter-step / occurrence / key-bin topology for one upsert-loop info
 * row after domain/keys resolution.
 */
export async function prepareCreateBuilderUpsertLoopKeyTopology(
  host: PrepareCreateBuilderUpsertLoopKeyTopologyHost,
  params: {
    info: any;
    loopAbiFunction: AbiFunction;
    entryArtifact: any;
    entryArgs: any[];
    loopArgs: any[];
    conditionArgs: any[];
    visibleInputs: any[];
    loopPredicateState: Record<string, unknown>;
    executionSelfAddress: any;
    keysArr: unknown[];
    keyExpressions: any;
    fixedBins: Uint8Array[];
    keyTypes: string[];
    encKey: (v: unknown, keyType: string) => Uint8Array;
    fixedKeyIndices: number[];
    varyingKeyIndexSet: Set<number>;
    collection: any;
    valueTraceDomain: bigint[] | undefined;
    selectedSourceValues: bigint[] | undefined;
    sourceOccurrences: number[] | undefined;
    argOf: (name: string | undefined) => unknown;
    replaceLoopArgument: (index: number, value: any) => void;
    [key: string]: any;
  },
): Promise<PrepareCreateBuilderUpsertLoopKeyTopologyResult> {
  let { keysArr, loopPredicateState } = params;
  const {
    info, loopAbiFunction, entryArtifact, conditionArgs,
    visibleInputs, executionSelfAddress, keyExpressions, fixedBins, keyTypes,
    encKey, varyingKeyIndexSet, collection, valueTraceDomain,
    selectedSourceValues, replaceLoopArgument,
  } = params;

  // Bare counter keys (`m[i]`) deliberately omit `varyingKeyExpressions`; only derived/composite recipes need
  // that metadata. Identify a counter stream from its compiler-owned permutation parameter so logical witness
  // alignment also applies to the canonical bare-key form, while parameter-array permutations remain distinct.
  const counterSpec = vmapCounterPermutationSpec(info.varyingArrayParam);
  let counterStep: bigint | undefined;
  let counterStepResolved = false;
  const resolveCounterStep = (): bigint | undefined => {
    if (!counterSpec) return undefined;
    if (!counterStepResolved) {
      counterStep = host.vmapCounterStep(
        info,
        counterSpec,
        conditionArgs,
        entryArtifact,
        visibleInputs,
        loopPredicateState,
        executionSelfAddress,
      );
      counterStepResolved = true;
    }
    return counterStep;
  };
  const occurrenceOf = (key: unknown): number => {
    if (!counterSpec) return 0;
    const step = resolveCounterStep();
    if (step === undefined || step === 0n) {
      throw new Error(`vmap upsert loop ${info.collection}: cannot resolve a non-zero counter step`);
    }
    const value = typeof key === 'bigint' ? key : BigInt(key as number | string);
    const rank = (value - counterSpec.start) / step;
    const occurrence = Number(rank);
    if (!Number.isSafeInteger(occurrence) || occurrence < 0) {
      throw new Error(`vmap upsert loop ${info.collection}: invalid counter-derived key rank ${rank}`);
    }
    return occurrence;
  };
  let valueTrace: FunctionArgument[] | undefined;
  if (info.valueTraceWitnessParam) {
    if (!info.valueTraceLocal || !info.valueTraceInitial) {
      throw new Error(`vmap value trace ${info.collection}: incomplete compiler metadata`);
    }
    const witnessIndex = loopAbiFunction.inputs.findIndex(
      (input) => input.name === info.valueTraceWitnessParam,
    );
    if (witnessIndex < 0) {
      throw new Error(`vmap value trace ${info.collection}: missing witness ABI input`);
    }
    const traceExpressions = [
      info.valueTraceInitial,
      ...(info.valueTraceUpdates ?? []).flatMap((update: any) => [update.condition, update.expression]),
      ...(info.valueTraceAfterUpdates ?? []).flatMap((update: any) => [update.condition, update.expression]),
    ].filter((expression: any): expression is ExternalCallExpression => expression !== undefined);
    loopPredicateState = await host.hydrateExternalPredicateState(
      traceExpressions,
      conditionArgs,
      entryArtifact,
      loopPredicateState,
      visibleInputs,
      executionSelfAddress,
      valueTraceDomain?.map((_value: any, occurrence: any) => occurrence) ?? keysArr.map(occurrenceOf),
    );
    let current = host.evaluateExternalExpression(
      info.valueTraceInitial,
      conditionArgs,
      entryArtifact,
      loopPredicateState,
      visibleInputs,
      undefined,
      0,
      false,
      executionSelfAddress,
    );
    if (current === undefined) {
      throw new Error(`vmap value trace ${info.collection}: could not resolve initial value`);
    }
    valueTrace = [];
    const bindings = new Map<string, FunctionArgument>();
    const applyUpdates = (
      updates: NonNullable<SortedUpsertLoopAbi['valueTraceUpdates']>, occurrence: number,
    ): void => {
      for (const update of updates) {
        bindings.set(info.valueTraceLocal!, current as FunctionArgument);
        const selected = update.condition ? host.evaluateExternalExpression(
          update.condition, conditionArgs, entryArtifact, loopPredicateState, visibleInputs,
          undefined, occurrence, false, executionSelfAddress, bindings,
        ) : true;
        if (typeof selected !== 'boolean') {
          throw new Error(`vmap value trace ${info.collection}: could not resolve update predicate`);
        }
        if (!selected) continue;
        const next = host.evaluateExternalExpression(
          update.expression, conditionArgs, entryArtifact, loopPredicateState, visibleInputs,
          undefined, occurrence, false, executionSelfAddress, bindings,
        );
        if (next === undefined) {
          throw new Error(`vmap value trace ${info.collection}: could not resolve update value`);
        }
        current = next;
      }
    };
    const traceOccurrences = valueTraceDomain?.length ?? keysArr.length;
    for (let occurrence = 0; occurrence < traceOccurrences; occurrence += 1) {
      applyUpdates(info.valueTraceUpdates ?? [], occurrence);
      valueTrace.push(current as FunctionArgument);
      applyUpdates(info.valueTraceAfterUpdates ?? [], occurrence);
    }
    replaceLoopArgument(witnessIndex, valueTrace as ConstructorArgument[]);
  }
  const keyExpressionBindings = new Map<string, FunctionArgument>();
  if (info.prefixCountWitnessParam) {
    if (!info.prefixCountCondition) {
      throw new Error(`vmap prefix-count trace ${info.collection}: incomplete compiler metadata`);
    }
    const witnessIndex = loopAbiFunction.inputs.findIndex(
      (input) => input.name === info.prefixCountWitnessParam,
    );
    if (witnessIndex < 0) {
      throw new Error(`vmap prefix-count trace ${info.collection}: missing witness ABI input`);
    }
    const traceOccurrences = valueTraceDomain?.length ?? keysArr.length;
    loopPredicateState = await host.hydrateExternalPredicateState(
      [info.prefixCountCondition],
      conditionArgs,
      entryArtifact,
      loopPredicateState,
      visibleInputs,
      executionSelfAddress,
      Array.from({ length: traceOccurrences }, (_value, occurrence) => occurrence),
    );
    const prefixCountTrace: bigint[] = [0n];
    let count = 0n;
    for (let occurrence = 0; occurrence < traceOccurrences; occurrence += 1) {
      const selected = host.evaluateExternalExpression(
        info.prefixCountCondition,
        conditionArgs,
        entryArtifact,
        loopPredicateState,
        visibleInputs,
        undefined,
        occurrence,
        false,
        executionSelfAddress,
      );
      if (typeof selected !== 'boolean') {
        throw new Error(`vmap prefix-count trace ${info.collection}: could not resolve predicate`);
      }
      if (selected) count += 1n;
      prefixCountTrace.push(count);
    }
    replaceLoopArgument(witnessIndex, prefixCountTrace);
    keyExpressionBindings.set(info.prefixCountWitnessParam, prefixCountTrace);
  }
  const keyExpressionLengthDeltas = Object.fromEntries(
    (loopAbiFunction.dynamicWrites ?? []).map((name: any) => [name, 1n]),
  );
  if (keyExpressions?.length) {
    loopPredicateState = await host.hydrateExternalPredicateState(
      keyExpressions,
      conditionArgs,
      entryArtifact,
      loopPredicateState,
      visibleInputs,
      executionSelfAddress,
      keysArr.map(occurrenceOf),
    );
  }
  const keyBinsFor = (key: unknown): Uint8Array[] => {
    if (keyExpressions?.length) {
      const occurrence = occurrenceOf(key);
      return keyExpressions.map((expression: any, index: any) => {
        const value = host.evaluateExternalExpression(
          expression,
          conditionArgs,
          entryArtifact,
          loopPredicateState,
          visibleInputs,
          undefined,
          occurrence,
          false,
          executionSelfAddress,
          keyExpressionBindings,
          keyExpressionLengthDeltas,
        );
        if (value === undefined) {
          throw new Error(`vmap upsert loop ${info.collection}: cannot resolve key component ${index}`);
        }
        return encKey(value, keyTypes[index] ?? collection.keyType);
      });
    }
    let fixedIndex = 0;
    return keyTypes.map((keyType, index) => varyingKeyIndexSet.has(index)
      ? encKey(key, keyType)
      : fixedBins[fixedIndex++]);
  };
  const slotForKey = (key: unknown): Uint8Array => keyToSlotMulti(keyBinsFor(key), collection);
  if (Array.isArray(keysArr) && info.varyingArrayParam.startsWith(VMAP_COUNTER_PERM_PREFIX)) {
    keysArr = [...keysArr].sort((left: any, right: any) => {
      const leftSlot = bytesToSlotValue(slotForKey(left));
      const rightSlot = bytesToSlotValue(slotForKey(right));
      // This is the first sort which sees the complete derived key recipe. Equal slots are repeated writes to
      // one entry, so restore logical source order rather than retaining the provisional raw-counter order;
      // the pending transition then implements the language's last-write-wins semantics.
      return leftSlot < rightSlot ? -1 : leftSlot > rightSlot ? 1
        : occurrenceOf(left) - occurrenceOf(right);
    });
    const varyingIndex = loopAbiFunction.inputs.findIndex((input: any) => input.name === info.varyingArrayParam);
    if (varyingIndex >= 0) replaceLoopArgument(varyingIndex, keysArr as FunctionArgument);
  }
  if (info.sourceOrderIndexParam) {
    if (!selectedSourceValues) {
      throw new Error(`vmap upsert loop ${info.collection}: source-order index has no selected domain`);
    }
    const sourceIndex = loopAbiFunction.inputs.findIndex(
      (input) => input.name === info.sourceOrderIndexParam,
    );
    if (sourceIndex < 0) {
      throw new Error(`vmap upsert loop ${info.collection}: missing source-order index ABI input`);
    }
    const physicalRanks = new Map<string, number>();
    keysArr.forEach((value, index) => {
      const numeric = typeof value === 'bigint' ? value : BigInt(value as number | string);
      physicalRanks.set(numeric.toString(), index);
    });
    const inverse = selectedSourceValues.map((value) => {
      const index = physicalRanks.get(value.toString());
      if (index === undefined) {
        throw new Error(`vmap upsert loop ${info.collection}: selected source value is absent from permutation`);
      }
      return BigInt(index);
    });
    replaceLoopArgument(sourceIndex, inverse);
  }
  const isDelete = info.op === 'delete';

  return {
    keysArr,
    loopPredicateState,
    counterSpec,
    resolveCounterStep,
    occurrenceOf,
    valueTrace,
    keyExpressionBindings,
    keyBinsFor,
    slotForKey,
    isDelete,
  };
}
