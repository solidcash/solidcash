import { binsAreEqual } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
import { bigIntToVmNumber } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
;
;
;
import type { Artifact, EntryAccessAbi, StateValue } from '@solidcash/utils';
import { encodeFunctionArgument } from '../Argument.js';
import { mappingKeySlotCandidates } from './mapping-key-lookup.js';
import {
  resolveRouteRowExpressionKey, visibleHandlerInputs, type RouteExpressionKeyRow,
} from './route-expression-key.js';
import type { StoredValueIncomingEntry } from './sc-encode-stored-element-source.js';

type Collection = NonNullable<NonNullable<Artifact['stateLayout']>['collections']>[number];
export type StoredValueMutationRow = { row: RouteExpressionKeyRow; access: EntryAccessAbi };

/** Fold exact whole-entry recipes over the prior row's bytes, never over a pending state overlay. */
export function foldRouteStoredValues(options: {
  writes: readonly StoredValueMutationRow[];
  collection: Collection;
  targetSlot: Uint8Array;
  incomingEntries: readonly StoredValueIncomingEntry[];
  artifact: Artifact;
  state?: Record<string, StateValue>;
  encode: (write: StoredValueMutationRow, entries: readonly StoredValueIncomingEntry[]) => Uint8Array | undefined;
}): Uint8Array | undefined {
  const { collection, targetSlot } = options;
  const entries = [...options.incomingEntries];
  let value: Uint8Array | undefined;
  const readsIncomingEntry = (expression: unknown): boolean => !!expression && typeof expression === 'object'
    && ((expression as { kind?: string }).kind === 'entryPreValue'
      || Object.values(expression).some(readsIncomingEntry));
  // An exact replacement supersedes earlier values. It need not evaluate recipes whose results
  // are overwritten; subsequent read/modify/write rows still require the sequential fold.
  let start = 0;
  options.writes.forEach((write, index) => {
    const recipe = write.access.storedValueSource;
    if (recipe && !readsIncomingEntry(recipe.expression)) start = index;
  });
  for (const write of options.writes.slice(start)) {
    const { row, access } = write;
    if (access.collection !== collection.name && access.collection !== collection.signature) return undefined;
    const inputs = visibleHandlerInputs(row.handler.inputs);
    const sources = access.keySources ?? access.keyParams.map((paramName) => ({ kind: 'param' as const, paramName }));
    const keyTypes = collection.keyTypes ?? [collection.keyType];
    if (sources.length !== keyTypes.length) return undefined;
    const keys = sources.map((source, index): Uint8Array | undefined => {
      if (source.kind === 'constant') {
        return source.constantValue !== undefined && /^-?\d+$/u.test(source.constantValue)
          ? bigIntToVmNumber(BigInt(source.constantValue)) : undefined;
      }
      if (source.kind === 'expression') {
        return resolveRouteRowExpressionKey({
          expressionLabel: source.expressionLabel, collection: access.collection, rowArguments: [row],
          routePlanningArgs: row.args, routeVisibleInputs: inputs, structs: options.artifact.structs,
          state: options.state,
        });
      }
      const position = source.kind === 'param' ? inputs.findIndex((input) => input.name === source.paramName) : -1;
      const array = source.kind === 'stateArrayLast' ? options.state?.[source.stateArrayName ?? ''] : undefined;
      const key = source.kind === 'state' ? options.state?.[source.stateVarName ?? '']
        : source.kind === 'stateArrayLast' ? Array.isArray(array) ? array.at(-1) : undefined
          : position >= 0 ? row.args[position] : undefined;
      if (key === undefined || (typeof key !== 'bigint' && typeof key !== 'boolean'
        && typeof key !== 'string' && !(key instanceof Uint8Array))) return undefined;
      const encoded = encodeFunctionArgument(key, keyTypes[index], options.artifact.structs);
      return encoded instanceof Uint8Array ? encoded : undefined;
    });
    if (!keys.every((key): key is Uint8Array => key !== undefined)
      || !mappingKeySlotCandidates(keys, keyTypes, collection).some((slot) => binsAreEqual(slot, targetSlot))) {
      return undefined;
    }
    value = options.encode(write, entries);
    if (!value) return undefined;
    const matching = entries.flatMap((entry, index) => (
      entry.collection === collection.signature && binsAreEqual(entry.slot, targetSlot) ? [index] : []
    ));
    if (matching.length > 1) return undefined;
    const next = { collection: collection.signature, slot: targetSlot, value };
    if (matching.length === 1) entries[matching[0]] = next;
    else entries.push(next);
  }
  return value;
}
