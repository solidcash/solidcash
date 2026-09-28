/**
 * phase-boundary extract: physical external-call topology / proxy-forward helpers
 * (phase-boundary extract from StatefulContract.ts).
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import type { FunctionArgument } from '../Argument.js';
import type { Utxo } from '../interfaces.js';
import { addressToLockScript } from '../utils.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';

/** Resolve an explicit target to one physical participant; never guess through an ambiguous address. */
export function uniqueParticipantIndexForTarget(
  targetLockingBytecodeHex: string | undefined,
  candidates: readonly { index: number; lockingBytecodeHexes: readonly string[] }[],
): number | undefined {
  if (targetLockingBytecodeHex === undefined) return undefined;
  const target = targetLockingBytecodeHex.toLowerCase();
  const matches = candidates.filter((candidate) => candidate.lockingBytecodeHexes.some(
    (lockingBytecode) => lockingBytecode.toLowerCase() === target,
  ));
  return matches.length === 1 ? matches[0].index : undefined;
}

export function participantGroupForTarget(
  groups: readonly ExternalCallUtxoGroup[], candidateIndices: readonly number[],
  targetLockingBytecodeHex: string | undefined,
): number | undefined {
  return uniqueParticipantIndexForTarget(targetLockingBytecodeHex, candidateIndices.map((index) => {
    const group = groups[index];
    const locks = new Set<string>();
    const addHex = (value: unknown): void => {
      if (typeof value === 'string' && /^(?:[0-9a-f]{2})+$/i.test(value)) locks.add(value.toLowerCase());
    };
    const addAddress = (value: unknown): void => {
      if (typeof value !== 'string') return;
      try { locks.add(binToHex(addressToLockScript(value))); } catch { /* not an address */ }
    };
    addHex(group?.externalContract?.inner?.lockingBytecode);
    addAddress(group?.externalContract?._logicalAddress);
    addAddress(group?.externalContract?.target);
    const unlocker = group?.masterUtxo && 'unlocker' in group.masterUtxo
      ? group.masterUtxo.unlocker : undefined;
    if (unlocker) addHex(binToHex(unlocker.generateLockingBytecode()));
    return { index, lockingBytecodeHexes: [...locks] };
  }));
}

/**
 * Map `__internal__externalCallSelector` / `__internal__externalCallSelectorN` onto an ABI slot.
 * A lone unsuffixed param is the unique `needsSelectorVerification` slot, which is not always slot 0
 * (closeJob: slot 0 is conditional `__raw__` transfer, slot 1 is `publishJobEvent`).
 */
export function groupIndexForExternalCallSlot(params: {
  slot: number;
  externalCalls: ReadonlyArray<{ callsiteId?: number; occurrence?: string }> | undefined;
  groupByCallsite: ReadonlyMap<number, number> | undefined;
  compactGroups: readonly number[];
}): number | undefined {
  const call = params.externalCalls?.[params.slot];
  // A published callsite is slot-stable. Compact child arrays skip omitted conditionals, so
  // `compactGroups[slot]` would bind a later call (MarketplaceData) onto an earlier unused slot
  // (`__raw__` transfer). Only treat a *missing* map entry as omitted when the ABI says the
  // callsite is conditional; a required (`once`) call still falls back positionally.
  if (call?.callsiteId !== undefined) {
    const mapped = params.groupByCallsite?.get(call.callsiteId);
    if (mapped !== undefined) return mapped;
    if (call.occurrence && call.occurrence !== 'once') return undefined;
  }
  return params.compactGroups[params.slot];
}

/**
 * Map an external-return witness name onto the corresponding external-call ABI slot. Return witness suffixes
 * are compact ordinals among returning calls, while master/selector suffixes address the full call-slot list.
 * For example, calls `[returns, void, returns]` use return witnesses `Idx0` and `Idx1`, which map to slots 0 and 2.
 */
export function externalReturnParamSlot(
  paramName: string,
  externalCalls: ReadonlyArray<{ hasReturnValues?: boolean }> | undefined,
): number | undefined {
  const match = paramName.match(/^__internal__externalReturnOutputIdx(\d*)$/);
  if (!match) return undefined;
  const returnOrdinal = match[1] === '' ? 0 : Number(match[1]);
  if (!externalCalls) return returnOrdinal;
  return externalCalls
    .map((call, slot) => ({ call, slot }))
    .filter(({ call }) => call.hasReturnValues)[returnOrdinal]?.slot;
}

/**
 * These witnesses describe the assembled transaction, not the compiler route which requested it. Route builders
 * may carry provisional values from an isolated probe, but composition can omit conditional calls, fuse groups,
 * or move participant blocks. The SDK must therefore resolve these names after the physical layout is known.
 */
export function isSdkResolvedExternalCallTopologyWitness(paramName: string): boolean {
  return paramName === '__internal__externalCallInputBase'
    || paramName === '__internal__dynamicChunkInputBase'
    || /^__internal__extcallMasterIdx\d*$/.test(paramName)
    || /^__internal__extcallAnchorIdx\d*$/.test(paramName);
}

/** Participant storage proofs depend on the materialized state UTXOs, so an atomic graph's provisional/default
 * argument vector cannot own them. They are resolved while assembling the participant block. */
export function isSdkResolvedParticipantStorageWitness(paramName: string): boolean {
  return paramName.startsWith('__internal__vmapBatch')
    || paramName.startsWith('__internal__valueWitness_');
}

/** Sentinels for a vmap-batch ABI slot when this handler has no planned sorted batch. */
export function vmapBatchWitnessFallback(paramName: string): Uint8Array | bigint | undefined {
  if (!paramName.startsWith('__internal__vmapBatch')) return undefined;
  if (/^__internal__vmapBatchRank_\d+$/.test(paramName)) return 0n;
  if (paramName.startsWith('__internal__vmapBatchRows_')) return new Uint8Array();
  if (/^__internal__vmapBatchSlot_\d+$/.test(paramName)) return new Uint8Array(32);
  if (/^__internal__vmapBatchNext_\d+$/.test(paramName)) return new Uint8Array(32);
  if (/^__internal__vmapBatchProof_\d+$/.test(paramName)) return -1n;
  // -1 means an active UPDATE with no separate predecessor output; -2 means no transition.
  if (/^__internal__vmapBatchPredOut_\d+$/.test(paramName)) return -2n;
  if (paramName === '__internal__vmapBatchTrailingCount') return 0n;
  return undefined;
}

export function selectorParamSlot(
  paramName: string,
  externalCalls: ReadonlyArray<{
    needsSelectorVerification?: boolean;
    selectorArrayVar?: string;
  }> | undefined,
): number {
  const match = paramName.match(/^__internal__externalCallSelector(\d*)$/);
  if (!match) return 0;
  if (match[1] !== '') return Number(match[1]);
  const explicit = (externalCalls ?? [])
    .map((call, index) => ({ call, index }))
    .filter(({ call }) => call.needsSelectorVerification === true && !call.selectorArrayVar);
  if (explicit.length === 1) return explicit[0].index;
  const implicit = (externalCalls ?? [])
    .map((call, index) => ({ call, index }))
    .filter(({ call }) => call.needsSelectorVerification !== false && !call.selectorArrayVar);
  return implicit.length === 1 ? implicit[0].index : 0;
}

type PhysicalExternalCallInputGroup = {
  masterUtxo: Pick<Utxo, 'txid' | 'vout'>;
  sharedGroupIndex?: number;
};

/** Resolve the one physical input owner for logical callsites consuming the same stateful master UTXO. */
export function physicalExternalCallGroupIndexByMasterOutpoint(
  groups: readonly PhysicalExternalCallInputGroup[],
  masterUtxo: Pick<Utxo, 'txid' | 'vout'>,
): number {
  const existing = groups.findIndex((group) => (
    group.masterUtxo.txid.toLowerCase() === masterUtxo.txid.toLowerCase()
    && group.masterUtxo.vout === masterUtxo.vout
  ));
  return existing < 0 ? -1 : (groups[existing].sharedGroupIndex ?? existing);
}

type PhysicalSelectorGroup = {
  sharedGroupIndex?: number;
  delegateCallGroupIndex?: number;
  functionName: string;
  compilerRoute?: { selector: Uint8Array };
  externalContract: { inner: { artifact: { abi: readonly { name: string; selector?: string }[] } } };
};

/**
 * Bytes argument for a baked `__forward(bytes)` proxy. The caller covenant extracts the first 4-byte
 * unlocking push (skipping a short delegate-index prefix) and EQUALVERIFYs it against the logical
 * implementation selector. Compiler-route `SCB1` belongs on the co-spent implementation unlocker.
 */
const COMPILER_ROUTE_SELECTOR_HEX = '53434231';

const isFunctionSelectorHex = (value: string | undefined): value is string => (
  !!value && /^[0-9a-fA-F]{8}$/i.test(value)
);

export function selectProxyForwardInput(
  logicalSelectorHex: string | undefined,
  functionArgs: readonly FunctionArgument[] = [],
): Uint8Array {
  const arg = functionArgs[0];
  const argHex = arg instanceof Uint8Array && arg.length === 4 ? binToHex(arg) : undefined;
  // A shared proxy master is created by the first nested call (often a view) and later retargeted
  // to the state-writing handler. Prefer that 4-byte functionArgs selector over a stale logical name.
  // Compiler-route SCB1 still belongs on the implementation unlocker, not this slot.
  if (argHex && argHex.toLowerCase() !== COMPILER_ROUTE_SELECTOR_HEX) return arg as Uint8Array;
  if (isFunctionSelectorHex(logicalSelectorHex)
    && logicalSelectorHex.toLowerCase() !== COMPILER_ROUTE_SELECTOR_HEX) {
    return hexToBin(logicalSelectorHex);
  }
  if (argHex) return arg as Uint8Array;
  if (isFunctionSelectorHex(logicalSelectorHex)) return hexToBin(logicalSelectorHex);
  const got = logicalSelectorHex
    ?? (arg instanceof Uint8Array ? `${arg.length} bytes` : typeof arg);
  throw new Error(`Proxy __forward requires a 4-byte implementation selector; got ${got}`);
}

/** Input index of the co-spent implementation master immediately after a nested proxy state prefix. */
export function nestedProxyImplementationInputIndex(
  proxyMasterIndex: number,
  proxyDataNftCount: number,
): number {
  if (!Number.isSafeInteger(proxyMasterIndex) || proxyMasterIndex < 0) {
    throw new Error('Proxy master index must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(proxyDataNftCount) || proxyDataNftCount < 0) {
    throw new Error('Proxy data NFT count must be a non-negative safe integer');
  }
  return proxyMasterIndex + 1 + proxyDataNftCount;
}

/** Resolve the selector actually present on a composed co-spend, following shared masters and proxy delegates. */
export function physicalExternalCallSelectorHex(
  groups: readonly PhysicalSelectorGroup[],
  delegateGroups: readonly PhysicalSelectorGroup[],
  groupIndex: number | undefined,
): string | undefined {
  if (groupIndex === undefined) return undefined;
  const logical = groups[groupIndex];
  if (!logical) return undefined;
  const physical = groups[logical.sharedGroupIndex ?? groupIndex] ?? logical;
  const delegate = physical.delegateCallGroupIndex === undefined
    ? undefined : delegateGroups[physical.delegateCallGroupIndex];
  const selected = delegate ?? physical;
  if (selected.compilerRoute?.selector) return binToHex(selected.compilerRoute.selector);
  return selected.externalContract.inner.artifact.abi
    .find((candidate) => candidate.name === selected.functionName)?.selector;
}

export {
  evalComputedKey,
  type RouteExpressionKeyRow,
  parseRowArgsDecodeLabel,
  visibleHandlerInputs,
  canonicalAbiFunctionSignature,
  entryAccessAt,
  resolvePreparedProducerEntry,
  selectVisibleCallArguments,
  type DirectMappingReadPlan,
  directMappingReadPlan,
  canShareIdempotentCounterLoopSettlement,
  matchingRouteRowsForExpressionKey,
  resolveRouteRowExpressionKey,
} from './route-expression-key.js';
import {
  evalComputedKey,
  type RouteExpressionKeyRow,
  parseRowArgsDecodeLabel,
  visibleHandlerInputs,
  canonicalAbiFunctionSignature,
  entryAccessAt,
  resolvePreparedProducerEntry,
  selectVisibleCallArguments,
  type DirectMappingReadPlan,
  directMappingReadPlan,
  canShareIdempotentCounterLoopSettlement,
  matchingRouteRowsForExpressionKey,
  resolveRouteRowExpressionKey,
} from './route-expression-key.js';


/**
 * Resolve the exact source occurrences represented by one compiler-published call edge.
 *
 * Loop cardinality is authoritative only when every array-element argument source names a
 * public array argument and all named arrays have the same runtime length. This is the same
 * source-level proof consumed by the graph worklist; an opaque or inconsistent shape stays
 * unavailable instead of being collapsed to a guessed occurrence zero.
 */
export function externalCallReachedOccurrenceIndices(
  call: {
    occurrence?: 'once' | 'conditional' | 'loop';
    argSources?: readonly unknown[];
    minimumOccurrences?: number;
    maximumOccurrences?: number;
  },
  functionArgs: readonly FunctionArgument[],
): readonly number[] | undefined {
  if ((call.occurrence ?? 'once') !== 'loop') return Object.freeze([0]);
  const parameterIndices = new Set<number>();
  const visit = (value: unknown, seen = new Set<object>()): void => {
    if (!value || typeof value !== 'object' || seen.has(value as object)) return;
    seen.add(value as object);
    const source = value as { kind?: string; paramIndex?: number };
    if (source.kind === 'arrayElement' && Number.isSafeInteger(source.paramIndex)
      && source.paramIndex! >= 0) parameterIndices.add(source.paramIndex!);
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach((item) => visit(item, seen));
      else visit(child, seen);
    }
  };
  visit(call.argSources);
  if (parameterIndices.size === 0) return undefined;
  const lengths = [...parameterIndices].map((parameterIndex) => {
    const value = functionArgs[parameterIndex];
    return Array.isArray(value) ? value.length : undefined;
  });
  if (lengths.some((length) => length === undefined)
    || !lengths.every((length) => length === lengths[0])) return undefined;
  const count = lengths[0]!;
  if ((call.minimumOccurrences !== undefined && count < call.minimumOccurrences)
    || (call.maximumOccurrences !== undefined && count > call.maximumOccurrences)) return undefined;
  return Object.freeze(Array.from({ length: count }, (_, occurrenceIndex) => occurrenceIndex));
}
