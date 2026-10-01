/**
 * phase-boundary extract: SC extract — hydrate external predicate state for mapping-backed expressions.
 */

import {
  getDefaultStateValue,
  type Artifact,
  type ExternalCallExpression,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { selectMappingEntryByKeys } from './mapping-key-lookup.js';

export interface HydrateExternalPredicateStateHost {
  evaluateExternalExpression(...args: any[]): any;
  getEntries(...args: any[]): Promise<any> | any;
}

export async function hydrateExternalPredicateState(
  host: HydrateExternalPredicateStateHost,
  expressions: readonly (ExternalCallExpression | undefined)[],
  functionArgs: FunctionArgument[],
  artifact: Artifact,
  state: Record<string, unknown>,
  callerInputs?: readonly { type: string }[],
  executionSelfAddress?: FunctionArgument,
  occurrenceIndices: readonly number[] = [0],
): Promise<Record<string, unknown>> {
  const collections = artifact.stateLayout?.collections ?? [];
  const mappingByName = new Map(collections
    .filter((collection) => collection.kind === 'mapping')
    .map((collection) => [collection.name, collection] as const));
  if (mappingByName.size === 0) return state;

  const accesses: ExternalCallExpression[] = [];
  const seen = new Set<object>();
  const visit = (candidate: ExternalCallExpression | undefined): void => {
    if (!candidate || typeof candidate !== 'object' || seen.has(candidate)) return;
    seen.add(candidate);
    for (const child of Object.values(candidate)) {
      if (Array.isArray(child)) {
        for (const item of child) visit(item as ExternalCallExpression);
      } else visit(child as ExternalCallExpression);
    }
    if (candidate.kind === 'stateAccess' && candidate.name && mappingByName.has(candidate.name)) {
      accesses.push(candidate);
    }
  };
  for (const expression of expressions) visit(expression);
  if (accesses.length === 0) return state;

  const hydrated: Record<string, unknown> = { ...state };
  const entriesBySignature = new Map<string, Awaited<ReturnType<typeof host.getEntries>>>();
  const pending = new Set(accesses.flatMap((access) => occurrenceIndices.map((occurrenceIndex) => ({
    access, occurrenceIndex,
  }))));
  // Accesses were collected child-first, but iterate to a fixed point as a guard for shared/nested expression
  // objects. A mapping key may itself contain another stable mapping read.
  for (let pass = 0; pass <= accesses.length && pending.size > 0; pass += 1) {
    let progressed = false;
    for (const task of [...pending]) {
      const { access, occurrenceIndex } = task;
      const collection = mappingByName.get(access.name!);
      if (!collection) continue;
      const keys = (access.args ?? []).map((keyExpression) => host.evaluateExternalExpression(
        keyExpression,
        functionArgs,
        artifact,
        hydrated,
        callerInputs,
        undefined,
        occurrenceIndex,
        false,
        executionSelfAddress,
      ));
      if (keys.some((key) => key === undefined)) continue;
      const supportedKeys = keys.every((key) => typeof key === 'bigint' || typeof key === 'boolean'
        || typeof key === 'string' || key instanceof Uint8Array);
      if (!supportedKeys) continue;
      let entries = entriesBySignature.get(collection.signature);
      if (!entries) {
        entries = await host.getEntries(collection.signature);
        entriesBySignature.set(collection.signature, entries);
      }
      const typedKeys = keys as Array<bigint | boolean | Uint8Array | string>;
      const entry = selectMappingEntryByKeys(
        entries as Array<{
          slot?: Uint8Array;
          key?: bigint | boolean | Uint8Array;
          keys?: Array<bigint | boolean | Uint8Array>;
          value?: unknown;
        }>,
        typedKeys,
        collection.keyTypes ?? [collection.keyType],
        collection,
      );
      const value = entry?.value ?? getDefaultStateValue(
        collection.valueType,
        artifact.stateLayout?.structs,
      );
      let namespace = hydrated[access.name!] as Record<string, unknown> | undefined;
      if (!namespace || typeof namespace !== 'object' || Array.isArray(namespace)
        || namespace instanceof Uint8Array) {
        namespace = {};
        hydrated[access.name!] = namespace;
      }
      let target = namespace;
      for (let index = 0; index < typedKeys.length; index += 1) {
        const property = String(typedKeys[index]);
        if (index === typedKeys.length - 1) target[property] = value;
        else {
          const next = target[property];
          if (!next || typeof next !== 'object' || Array.isArray(next) || next instanceof Uint8Array) {
            target[property] = {};
          }
          target = target[property] as Record<string, unknown>;
        }
      }
      pending.delete(task);
      progressed = true;
    }
    if (!progressed) break;
  }
  return hydrated;
}
