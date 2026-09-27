import { decodePushdataValue, type Artifact } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { evaluateFixedEffectPredicate } from './message-bus.js';

/** Decode only the exact compiler-described row bytes; malformed rows cannot suppress a resource. */
export function decodeSelectedHandlerArguments(
  artifact: Artifact, selector: string, bytes: Uint8Array,
): FunctionArgument[] | undefined {
  const handlers = artifact.messageBus?.handlers.filter((handler) => handler.eligible
    && handler.selector.toLowerCase() === selector.toLowerCase());
  if (handlers?.length !== 1) return undefined;
  let cursor = 0;
  const args: FunctionArgument[] = [];
  try {
    for (const input of handlers[0].inputs) {
      const decoded = decodePushdataValue(bytes, cursor, input.type, artifact.structs ?? artifact.stateLayout?.structs);
      args.push(decoded.value as FunctionArgument);
      cursor += decoded.bytesConsumed;
    }
  } catch {
    return undefined;
  }
  return cursor === bytes.length ? args : undefined;
}

/** Narrow a shared route resource only from every selected handler's exact compiler-published layout. */
export function selectedSatoshiContainerRequired(
  artifact: Artifact,
  selectors: readonly (string | undefined)[],
  rowArguments?: readonly (readonly FunctionArgument[] | undefined)[],
): boolean | undefined {
  const handlers = selectors.map((selector) => {
    const matches = selector === undefined ? [] : artifact.abi.filter((candidate) =>
      candidate.selector?.toLowerCase() === selector.toLowerCase());
    return matches.length === 1 ? matches[0] : undefined;
  });
  if (handlers.some((handler) => handler?.blockLayout === undefined)) return undefined;
  return handlers.some((handler, index) => {
    const required = (handler!.transferCount ?? 0) > 0
      || handler!.blockLayout!.slots.some((slot) => slot.kind === 'satoshiContainer');
    if (!required) return false;
    const args = rowArguments?.[index];
    const transfers = handler!.transfers;
    // Omit a union resource only when every published transfer is provably inactive from immutable row
    // arguments. Incomplete metadata, state-dependent predicates and runtime loops remain conservative.
    if (!args || !transfers?.length || transfers.length !== handler!.transferCount
      || (handler!.runtimeLoopTransfers?.length ?? 0) > 0) return true;
    return transfers.some((transfer) => !transfer.condition
      || evaluateFixedEffectPredicate(transfer.condition, args) !== false);
  });
}
