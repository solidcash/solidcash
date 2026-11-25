/**
 * phase-boundary extract: resource-fold route helpers + encoded array channel utilities
 * (phase-boundary extract from StatefulContract.ts).
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  decodePushdataValue,
  encodePushdataValue,
  parseArrayTypeString,
  type Artifact,
  type EntryAccessAbi,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import type { RouteExpressionKeyRow } from './route-expression-key.js';

/** Place a resolved complete array fold in its compiler-published hidden ABI slot by name. */
export function materializeCompletePushValueWitness(
  inputs: readonly { name: string }[],
  args: FunctionArgument[],
  slotIndex: number,
  value: Uint8Array,
): number {
  const index = inputs.findIndex((input) => (
    input.name === `__internal__completePushValue_${slotIndex}`
      || input.name === '__internal__completePushValue'
  ));
  if (index >= 0) args[index] = value;
  return index;
}

/** Optional settle-time ExecutionContext lookup for fold activation env (settle-time ExecutionContext). */

export function appendEncodedArrayElement(arrayBlob: Uint8Array, element: Uint8Array): Uint8Array {
  const count = decodePushdataValue(arrayBlob, 0, 'bigint');
  const prefix = encodePushdataValue(BigInt(count.value as bigint) + 1n, 'bigint');
  const out = new Uint8Array(prefix.length + (arrayBlob.length - count.bytesConsumed) + element.length);
  out.set(prefix, 0);
  out.set(arrayBlob.subarray(count.bytesConsumed), prefix.length);
  out.set(element, prefix.length + arrayBlob.length - count.bytesConsumed);
  return out;
}


export function concatenateEncodedArrays(left: Uint8Array, right: Uint8Array): Uint8Array {
  const leftCount = decodePushdataValue(left, 0, 'bigint');
  const rightCount = decodePushdataValue(right, 0, 'bigint');
  const prefix = encodePushdataValue(
    BigInt(leftCount.value as bigint) + BigInt(rightCount.value as bigint),
    'bigint',
  );
  const leftElements = left.subarray(leftCount.bytesConsumed);
  const rightElements = right.subarray(rightCount.bytesConsumed);
  const out = new Uint8Array(prefix.length + leftElements.length + rightElements.length);
  out.set(prefix, 0);
  out.set(leftElements, prefix.length);
  out.set(rightElements, prefix.length + leftElements.length);
  return out;
}

/**
 * Keep a chunkable array access's authenticated inputs separate from its derived result.
 *
 * The value witness is the exact proof-entry value before the handler. A leading mutation
 * represents earlier selected rows, while `postValue` is used only for persistence and
 * continuation outputs. In particular, deriving `postValue` must never replace the witness.
 */
export function deriveChunkableArrayValueChannels({
  preValueWitness,
  storedPreValue,
  leadingMutation,
  currentElement,
}: {
  preValueWitness?: Uint8Array;
  storedPreValue: Uint8Array;
  leadingMutation?: Uint8Array;
  currentElement?: Uint8Array;
}): {
    preValueWitness?: Uint8Array;
    leadingMutation?: Uint8Array;
    postValue: Uint8Array;
  } {
  let postValue = storedPreValue;
  if (leadingMutation && leadingMutation.length > 0) {
    postValue = concatenateEncodedArrays(postValue, leadingMutation);
  }
  if (currentElement) postValue = appendEncodedArrayElement(postValue, currentElement);
  return { preValueWitness, leadingMutation, postValue };
}

/** Environment a selected fold row's path effects evaluate under. Direct compilation publishes no rows. */
export type FoldActivationEnvironment = Readonly<Record<string, FunctionArgument>>;

export type FoldActivationEnvResolveOptions = {
  participantIndex?: number;
  nestedScopeId?: number;
};

/** Direct compilation selects no route rows, so a row activation environment has no effects to evaluate. */
export function foldActivationEnvironmentFromRouteRow(
  _row: RouteExpressionKeyRow,
  _options?: FoldActivationEnvResolveOptions,
): FoldActivationEnvironment {
  return {};
}

/** Direct compilation selects no route rows, so every row resolves to an empty activation environment. */
export function createFoldRowActivationEnvResolver(
  _options?: FoldActivationEnvResolveOptions & { useActiveSettlement?: boolean },
): (row: RouteExpressionKeyRow, rowIndex?: number) => FoldActivationEnvironment {
  return () => ({});
}

export function buildChunkablePushFoldPlan(_params: any): undefined {
  return undefined;
}

export function foldLeadingRouteArrayPushes(_params: any): {
  leading: Uint8Array; complete: Uint8Array; plan: unknown;
} | undefined {
  return undefined;
}

export function foldCompleteRouteArrayPushes(_params: any): {
  complete: Uint8Array; plan: unknown;
} | undefined {
  return undefined;
}

export function encodeLeadingRouteArrayPushes(_params: any): Uint8Array | undefined {
  return undefined;
}
