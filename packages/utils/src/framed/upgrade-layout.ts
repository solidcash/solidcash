/**
 * The record rule an upgrade behind a framed proxy keeps (spec 20, plan 4.7).
 *
 * An upgrade changes only the code a delegate frame runs. The records stay where they are, and the new code reads
 * and rebuilds each one from its own declaration, so it must read every record the way the old code wrote it: each
 * state variable by the same name, type, coordinates and encoding, each struct a field or collection reaches with
 * the same fields, and each collection with the same signature and value form. A framed record is minted only at
 * its contract's genesis, so a field or collection the old layout does not declare has no record behind the proxy:
 * an append is refused as well, by the name of what it adds.
 */

import type { CollectionInfo, StateLayout, StateVariableInfo, StructDefinitionInfo } from '../artifact.js';
import { hasDataNftIndexTags } from '../state.js';

/** Whether a new layout may replace an old one behind the same records, or the first declaration that stops it. */
export type UpgradeLayoutVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly name: string; readonly reason: string };

/** A field's place in its contract's records. */
function place(variable: StateVariableInfo): string {
  return `data NFT ${variable.nftIndex} field ${variable.fieldIndex}`;
}

/** The fields of a layout in record order. */
function inRecordOrder(layout: StateLayout): readonly StateVariableInfo[] {
  return [...layout.variables]
    .sort((left, right) => left.nftIndex - right.nftIndex || left.fieldIndex - right.fieldIndex);
}

/** Why a kept field no longer reads its record the old way, or undefined when it does. */
function fieldChange(old: StateVariableInfo, next: StateVariableInfo | undefined): string | undefined {
  if (next === undefined) return `state variable "${old.name}" is removed, but its record still holds it`;
  if (next.type !== old.type) return `state variable "${old.name}" changes type from ${old.type} to ${next.type}`;
  if (next.nftIndex !== old.nftIndex || next.fieldIndex !== old.fieldIndex) {
    return `state variable "${old.name}" moves from ${place(old)} to ${place(next)}`;
  }
  if ((next.packed === true) !== (old.packed === true) || (next.dynamic === true) !== (old.dynamic === true)) {
    return `state variable "${old.name}" changes how its record encodes it`;
  }
  return undefined;
}

/** The identifiers a type string names: `S[2]` and `mapping(address => S)` both reach `S`. */
function namesIn(type: string): readonly string[] {
  return type.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? [];
}

/** The types a collection's records encode. */
function collectionTypes(collection: CollectionInfo): readonly string[] {
  return [collection.keyType, collection.valueType, ...(collection.keyTypes ?? []), collection.elementType ?? ''];
}

/** The structs the old layout's fields and collections reach, each with the definition the old layout gives it. */
function reachedStructs(layout: StateLayout): readonly StructDefinitionInfo[] {
  const byName = new Map((layout.structs ?? []).map((definition) => [definition.name, definition]));
  const reached = new Map<string, StructDefinitionInfo>();
  const visit = (type: string): void => {
    for (const name of namesIn(type)) {
      const definition = byName.get(name);
      if (definition === undefined || reached.has(name)) continue;
      reached.set(name, definition);
      for (const field of definition.fields) visit(field.type);
    }
  };
  for (const variable of layout.variables) visit(variable.type);
  for (const collection of layout.collections ?? []) collectionTypes(collection).forEach(visit);
  return [...reached.values()];
}

/** Why a struct no longer encodes the old way, or undefined when its fields are unchanged. */
function structChange(old: StructDefinitionInfo, next: StructDefinitionInfo | undefined): string | undefined {
  if (next === undefined) return `struct "${old.name}" is removed, but a record still encodes it`;
  for (let index = 0; index < Math.max(old.fields.length, next.fields.length); index += 1) {
    const before = old.fields[index];
    const after = next.fields[index];
    if (before === undefined) return `struct "${old.name}" adds field "${after!.name}", which its records lack`;
    if (after === undefined) return `struct "${old.name}" removes field "${before.name}"`;
    if (after.name !== before.name) {
      return `struct "${old.name}" field ${index} changes from "${before.name}" to "${after.name}"`;
    }
    if (after.type !== before.type) {
      return `struct "${old.name}" field "${before.name}" changes type from ${before.type} to ${after.type}`;
    }
  }
  return undefined;
}

/** The facts a collection's records are found and decoded by. */
const COLLECTION_FACTS = [
  'signature', 'kind', 'keyType', 'valueType', 'keyTypes', 'elementType', 'bound', 'sorted', 'chunkableValue',
  'enumerable',
] as const;

/** Why a collection's records no longer read the old way, or undefined when they do. */
function collectionChange(old: CollectionInfo, next: CollectionInfo | undefined): string | undefined {
  if (next === undefined) return `collection "${old.name}" is removed, but its records still hold it`;
  for (const fact of COLLECTION_FACTS) {
    const before = JSON.stringify(old[fact] ?? null);
    const after = JSON.stringify(next[fact] ?? null);
    if (before !== after) return `collection "${old.name}" changes its ${fact} from ${before} to ${after}`;
  }
  return undefined;
}

/**
 * Reads whether `next` may replace `old` behind the records `old` was deployed with, naming the first declaration
 * that stops it: a kept field, then an added one, then a struct, then a collection.
 */
export function readUpgradeLayoutVerdict(old: StateLayout, next: StateLayout): UpgradeLayoutVerdict {
  if (old.dataNftCount > 0 && hasDataNftIndexTags(old) !== hasDataNftIndexTags(next)) {
    return { ok: false, name: '(records)', reason: 'changes the NFT-index tag encoding of existing records' };
  }
  const nextFields = new Map(next.variables.map((variable) => [variable.name, variable]));
  for (const variable of inRecordOrder(old)) {
    const reason = fieldChange(variable, nextFields.get(variable.name));
    if (reason !== undefined) return { ok: false, name: variable.name, reason };
  }
  const oldFields = new Set(old.variables.map((variable) => variable.name));
  const added = inRecordOrder(next).find((variable) => !oldFields.has(variable.name));
  if (added !== undefined) {
    return {
      ok: false, name: added.name,
      reason: `adds state variable "${added.name}" at ${place(added)}, which no record holds: a framed record `
        + 'is minted only at its contract\'s genesis',
    };
  }
  if (next.dataNftCount !== old.dataNftCount) {
    return {
      ok: false, name: '(records)',
      reason: `declares ${next.dataNftCount} data NFT(s) where the records are ${old.dataNftCount}`,
    };
  }
  const nextStructs = new Map((next.structs ?? []).map((definition) => [definition.name, definition]));
  for (const definition of reachedStructs(old)) {
    const reason = structChange(definition, nextStructs.get(definition.name));
    if (reason !== undefined) return { ok: false, name: definition.name, reason };
  }
  const nextCollections = new Map((next.collections ?? []).map((collection) => [collection.name, collection]));
  for (const collection of old.collections ?? []) {
    const reason = collectionChange(collection, nextCollections.get(collection.name));
    if (reason !== undefined) return { ok: false, name: collection.name, reason };
  }
  const oldCollections = new Set((old.collections ?? []).map((collection) => collection.name));
  const addedCollection = (next.collections ?? []).find((collection) => !oldCollections.has(collection.name));
  if (addedCollection !== undefined) {
    return {
      ok: false, name: addedCollection.name,
      reason: `adds collection "${addedCollection.name}", whose head no genesis minted behind these records`,
    };
  }
  return { ok: true };
}
