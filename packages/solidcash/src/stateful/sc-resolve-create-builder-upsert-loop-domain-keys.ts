/**
 * phase-boundary extract: SC _createBuilder extract — one sortedUpsertLoopInfo domain/keys front:
 * predicate hydrate/evaluate, counter domain, fixed-key bins, and runtime key filter.
 * Host keeps the inner for-loop and continue on skipped.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { bigIntToVmNumber } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import {
  encodePushdataValue,
  type AbiFunction,
  type StateValue,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { addressToLockScript } from '../utils.js';
import { getEntryNftAddress } from './covenant-helpers.js';
import {
  SortedList,
  bytesToSlotValue,
  keyToSlotMulti,
} from './SortedList.js';
import { evalComputedKey, visibleHandlerInputs } from './route-expression-key.js';
import { vmapCounterPermutationSpec } from './sc-batch-raw.js';

export type ResolveCreateBuilderUpsertLoopDomainKeysHost = {
  readonly categoryId: string;
  readonly inner: any;
  readonly signer: any;
  hydrateExternalPredicateState: (...args: any[]) => Promise<Record<string, unknown>>;
  evaluateExternalExpression: (...args: any[]) => unknown;
  vmapCounterDomain: (...args: any[]) => bigint[] | undefined | null;
  [key: string]: any;
};

export type ResolveCreateBuilderUpsertLoopDomainKeysResult =
  | { skipped: true }
  | {
    skipped: false;
    collection: any;
    list: any;
    entryAddr: string;
    entries: any[];
    argOf: (name: string | undefined) => unknown;
    visibleInputs: any[];
    conditionArgs: FunctionArgument[];
    valueTraceDomain: bigint[] | undefined;
    sourceOccurrences: number[] | undefined;
    selectedSourceValues: bigint[] | undefined;
    loopPredicateState: Record<string, unknown>;
    keyTypes: string[];
    encKey: (v: unknown, keyType: string) => Uint8Array;
    fixedSources: any[];
    keyExpressions: any;
    varyingKeyIndices: number[];
    varyingKeyIndexSet: Set<number>;
    fixedKeyIndices: number[];
    fixedBins: Uint8Array[];
    varyType: string;
    keysArr: unknown[];
    runtimeFiltered: boolean;
    runtimeInputStart: number;
    runtimeJournalIntentStart: number;
  };

/**
 * Resolve domain predicates and key material for one sortedUpsertLoopInfo row.
 * Returns `{ skipped: true }` when the host should `continue` the inner for-loop.
 */
export async function resolveCreateBuilderUpsertLoopDomainKeys(
  host: ResolveCreateBuilderUpsertLoopDomainKeysHost,
  params: {
    info: any;
    loopAbiFunction: AbiFunction;
    upsertFrame: any;
    loopArgs: any[];
    entryArtifact: any;
    stateLayout: any;
    onChainState: any;
    loopPredicateState: Record<string, unknown>;
    executionSelfAddress: any;
    insertLoopPredecessorsLength: number;
    runtimeJournalMaterializationIntentsLength: number;
    selectedRowArgument: (row: any, name: string) => unknown;
    replaceLoopArgument: (index: number, value: FunctionArgument) => void;
    [key: string]: any;
  },
): Promise<ResolveCreateBuilderUpsertLoopDomainKeysResult> {
  const {
    info, loopAbiFunction, upsertFrame, loopArgs, entryArtifact, stateLayout,
    onChainState, executionSelfAddress, selectedRowArgument, replaceLoopArgument,
  } = params;
  let loopPredicateState = params.loopPredicateState;
  const runtimeInputStart = params.insertLoopPredecessorsLength;
  const runtimeJournalIntentStart = params.runtimeJournalMaterializationIntentsLength;

  const collection = (stateLayout.collections ?? []).find((c: any) => c.name === info.collection);
  if (!collection) return { skipped: true as const };
  const entryAddr = getEntryNftAddress(host.inner, host.categoryId, collection.signature);
  const entries = (await host.inner.provider.getUtxos(entryAddr)).filter((u: any) => (
    u.token?.category === host.categoryId && u.token?.nft?.capability === 'mutable'
    && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0
  ));
  const list = SortedList.fromUtxos(entries);
  const argOf = (name: string | undefined): unknown => {
    if (!name) return undefined;
    if (upsertFrame.routed) return selectedRowArgument(upsertFrame.row!, name);
    const i = loopAbiFunction.inputs.findIndex((p: any) => p.name === name);
    return i >= 0 ? loopArgs[i] : undefined;
  };
  const visibleInputs = visibleHandlerInputs(loopAbiFunction.inputs);
  const conditionArgs = upsertFrame.routed
    ? [...upsertFrame.row!.args]
    : visibleInputs.map((input: any) => {
      const index = loopAbiFunction.inputs.findIndex((candidate: any) => candidate.name === input.name);
      return loopArgs[index];
    }) as FunctionArgument[];
  let valueTraceDomain: bigint[] | undefined;
  let sourceOccurrences: number[] | undefined;
  let selectedSourceValues: bigint[] | undefined;
  if (info.condition || info.iterationCondition || info.iterationBreakCondition) {
    if (info.condition) {
      loopPredicateState = await host.hydrateExternalPredicateState(
        [info.condition],
        conditionArgs,
        entryArtifact,
        loopPredicateState,
        visibleInputs,
        executionSelfAddress,
      );
    }
    const active = info.condition ? host.evaluateExternalExpression(
      info.condition,
      conditionArgs,
      entryArtifact,
      loopPredicateState,
      visibleInputs,
      undefined,
      0,
      false,
      executionSelfAddress,
    ) : true;
    if (typeof active !== 'boolean') {
      throw new Error(`Could not resolve runtime loop predicate for '${loopAbiFunction.name}'.`);
    }
    const varyingIndex = loopAbiFunction.inputs.findIndex(
      (input: any) => input.name === info.varyingArrayParam,
    );
    if (varyingIndex < 0) throw new Error(
      `Runtime loop in '${loopAbiFunction.name}' is missing '${info.varyingArrayParam}'.`,
    );
    const permutationSpec = vmapCounterPermutationSpec(info.varyingArrayParam);
    if (!permutationSpec) throw new Error(
      `Runtime loop in '${loopAbiFunction.name}' has an invalid permutation parameter.`,
    );
    const countValue = argOf(permutationSpec.countName);
    if (countValue === undefined && !info.iterationBound) throw new Error(
      `vmap counter loop bound '${permutationSpec.countName}' must be a public argument`,
    );
    const resolvedDomain = active ? host.vmapCounterDomain(
      info,
      permutationSpec,
      countValue,
      conditionArgs,
      entryArtifact,
      visibleInputs,
      loopPredicateState,
      executionSelfAddress,
    ) : [];
    if (!resolvedDomain) throw new Error(
      `Could not resolve runtime loop bound for '${loopAbiFunction.name}'.`,
    );
    const domain = resolvedDomain;
    valueTraceDomain = domain;
    if (active && info.iterationCondition) {
      loopPredicateState = await host.hydrateExternalPredicateState(
        [info.iterationCondition, info.iterationBreakCondition],
        conditionArgs,
        entryArtifact,
        loopPredicateState,
        visibleInputs,
        executionSelfAddress,
        domain.map((_value: any, occurrenceIndex: any) => occurrenceIndex),
      );
    }
    const permutation: bigint[] = [];
    const selectedOccurrences: number[] = [];
    if (active) for (let occurrenceIndex = 0; occurrenceIndex < domain.length; occurrenceIndex += 1) {
      const selected = info.iterationCondition ? host.evaluateExternalExpression(
        info.iterationCondition,
        conditionArgs,
        entryArtifact,
        loopPredicateState,
        visibleInputs,
        undefined,
        occurrenceIndex,
        false,
        executionSelfAddress,
      ) : true;
      const breaking = info.iterationBreakCondition ? host.evaluateExternalExpression(
        info.iterationBreakCondition,
        conditionArgs,
        entryArtifact,
        loopPredicateState,
        visibleInputs,
        undefined,
        occurrenceIndex,
        false,
        executionSelfAddress,
      ) : false;
      if (typeof selected !== 'boolean') throw new Error(
        `Could not resolve runtime loop iteration predicate for '${loopAbiFunction.name}'.`,
      );
      if (typeof breaking !== 'boolean') throw new Error(
        `Could not resolve runtime loop break predicate for '${loopAbiFunction.name}'.`,
      );
      if (selected) {
        permutation.push(domain[occurrenceIndex]);
        selectedOccurrences.push(occurrenceIndex);
      }
      if (breaking) break;
    }
    permutation.sort((left: any, right: any) => {
      const leftSlot = bytesToSlotValue(keyToSlotMulti([bigIntToVmNumber(left)]));
      const rightSlot = bytesToSlotValue(keyToSlotMulti([bigIntToVmNumber(right)]));
      return leftSlot < rightSlot ? -1 : leftSlot > rightSlot ? 1 : 0;
    });
    // Do not sort this beside `permutation`. The generated row loop advances its physical-key cursor only on a
    // selected source frame: selectedOccurrences[i] therefore consumes permutation[i], even when permutation[i]
    // originated at another logical rank. Later topology reordering has the same cursor semantics.
    sourceOccurrences = selectedOccurrences;
    selectedSourceValues = selectedOccurrences.map((occurrence: any) => domain[occurrence]);
    replaceLoopArgument(varyingIndex, permutation);
  }
  const keyTypes = collection.keyTypes ?? [collection.keyType];
  const encKey = (v: unknown, keyType: string): Uint8Array => (
    keyType === 'address' && typeof v === 'string' && v.includes(':') ? addressToLockScript(v)
      : typeof v === 'bigint' ? bigIntToVmNumber(v)
        : v instanceof Uint8Array ? v
          : typeof v === 'boolean' ? bigIntToVmNumber(v ? 1n : 0n)
            : encodePushdataValue(v as StateValue, keyType, stateLayout.structs));
  const fixedSources = info.fixedKeySources ?? info.fixedKeyParams.map((paramName: any) => ({
    kind: 'param' as const, paramName,
  }));
  const keyExpressions = info.varyingKeyExpressions;
  const varyingKeyIndices = info.varyingKeyIndices?.length
    ? [...info.varyingKeyIndices] : [keyTypes.length - 1];
  const varyingKeyIndexSet = new Set(varyingKeyIndices);
  const fixedKeyIndices = keyTypes.map((_type: any, index: any) => index)
    .filter((index: any) => !varyingKeyIndexSet.has(index));
  const fixedBins = keyExpressions?.length ? [] : fixedSources.map((source: any, i: any) => {
    let value: unknown;
    if (source.kind === 'param') value = argOf(source.paramName);
    else if (source.kind === 'constant') value = BigInt(source.constantValue ?? '0');
    else if (source.kind === 'state') value = onChainState.state[source.stateVarName ?? ''];
    else if (source.kind === 'stateArrayLast') {
      const array = onChainState.state[source.stateArrayName ?? ''];
      if (!Array.isArray(array) || array.length === 0) {
        throw new Error(`vmap upsert loop ${info.collection}: state array '${source.stateArrayName}' is empty`);
      }
      value = array[array.length - 1];
    } else if (source.kind === 'msgSender') {
      if (!host.signer) throw new Error(`vmap upsert loop ${info.collection}: msg.sender key requires a signer`);
      value = host.signer.getAddress();
    } else if (source.kind === 'expression') {
      const stateLengthDeltas = Object.fromEntries(
        (loopAbiFunction.dynamicWrites ?? []).map((name: any) => [name, 1n]),
      );
      value = evalComputedKey(
        source.expressionLabel, loopArgs, loopAbiFunction.inputs, onChainState.state, stateLengthDeltas,
      );
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
        console.error('sorted-upsert-expression-key', {
          collection: info.collection, label: source.expressionLabel,
          value: typeof value === 'bigint' ? value.toString() : value,
          dynamicWrites: loopAbiFunction.dynamicWrites,
          stateLengthDeltas,
          stateLengths: Object.fromEntries(Object.entries(onChainState.state)
            .filter(([, candidate]) => Array.isArray(candidate))
            .map(([name, candidate]) => [name, (candidate as unknown[]).length])),
        });
      }
    }
    if (value === undefined) throw new Error(`vmap upsert loop ${info.collection}: cannot resolve fixed key ${i}`);
    return encKey(value, keyTypes[fixedKeyIndices[i] ?? i] ?? collection.keyType);
  });
  const varyType = keyTypes[varyingKeyIndices[0]] ?? collection.keyType;
  let keysArr = argOf(info.varyingArrayParam) as unknown[];
  const runtimeFiltered = info.keyDecodeTupleIndex !== undefined || info.predicateArrayParam !== undefined;
  if (runtimeFiltered) {
    const sourceKeys = keysArr;
    const predicate = info.predicateArrayParam ? argOf(info.predicateArrayParam) as unknown[] : undefined;
    if (!Array.isArray(sourceKeys) || (info.predicateArrayParam && !Array.isArray(predicate))) {
      return { skipped: true as const };
    }
    const selected: unknown[] = [];
    const asBigInt = (v: unknown): bigint => typeof v === 'bigint' ? v : BigInt(v as number | string);
    const decodeStaticWord = (blob: unknown, tupleIndex: number, typeName: string): unknown => {
      const bytes = blob instanceof Uint8Array ? blob
        : typeof blob === 'string' ? hexToBin(blob.startsWith('0x') ? blob.slice(2) : blob)
          : new Uint8Array(0);
      const word = bytes.slice(tupleIndex * 32, tupleIndex * 32 + 32);
      if (word.length !== 32) {
        throw new Error(`vmap upsert loop ${info.collection}: ABI tuple word ${tupleIndex} is truncated`);
      }
      if (typeName === 'address') return word.slice(12);
      if (typeName === 'bool') return word.some((byte) => byte !== 0);
      const fixedBytes = typeName.match(/^bytes(\d+)$/);
      if (fixedBytes) return word.slice(0, Number(fixedBytes[1]));
      if (/^u?int(?:\d+)?$/.test(typeName)) {
        let value = 0n;
        for (const byte of word) value = (value << 8n) | BigInt(byte);
        if (typeName.startsWith('int') && (word[0] & 0x80) !== 0) value -= 1n << 256n;
        return value;
      }
      throw new Error(`vmap upsert loop ${info.collection}: unsupported ABI-decoded key type '${typeName}'`);
    };
    for (let i = 0; i < sourceKeys.length; i++) {
      if (predicate && info.predicateEquals !== undefined
        && asBigInt(predicate[i]) !== BigInt(info.predicateEquals)) continue;
      selected.push(info.keyDecodeTupleIndex === undefined ? sourceKeys[i] : decodeStaticWord(
        sourceKeys[i], info.keyDecodeTupleIndex,
        info.keyDecodeTupleTypes?.[info.keyDecodeTupleIndex] ?? varyType,
      ));
    }
    keysArr = selected;
  }

  return {
    skipped: false as const,
    collection,
    list,
    entryAddr,
    entries,
    argOf,
    visibleInputs,
    conditionArgs,
    valueTraceDomain,
    sourceOccurrences,
    selectedSourceValues,
    loopPredicateState,
    keyTypes,
    encKey,
    fixedSources,
    keyExpressions,
    varyingKeyIndices,
    varyingKeyIndexSet,
    fixedKeyIndices,
    fixedBins,
    varyType,
    keysArr,
    runtimeFiltered,
    runtimeInputStart,
    runtimeJournalIntentStart,
  };
}
