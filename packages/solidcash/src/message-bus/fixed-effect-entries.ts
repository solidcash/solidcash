import {
  abiTypeString, getDefaultStateValue, parseArrayTypeString, parseTypeStrict,
  type Artifact, type ChildDeploymentValueRecipe, type StateValue,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { selectMappingEntryByKeys, type MappingEntryLookup } from '../stateful/mapping-key-lookup.js';

type EntryRecipe = Extract<ChildDeploymentValueRecipe, { kind: 'entry' }>;
type Entry = MappingEntryLookup & { value: StateValue };
export type FixedEffectEntryResolver = (recipe: EntryRecipe, keys: readonly FunctionArgument[]) => FunctionArgument;

/** Load only compiler-described incoming collections. Decoding and slot lookup use the authenticated entry API;
 * no pending-write overlay is accepted. The covenant VM remains the final authority for the assembled payment. */
export async function loadFixedEffectEntries(
  recipes: readonly (ChildDeploymentValueRecipe | undefined)[],
  artifact: Artifact,
  host: { getEntries(collection: string): Promise<Entry[]> },
): Promise<FixedEffectEntryResolver> {
  const signatures = new Set<string>();
  const seen = new WeakSet<object>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if ((value as { kind?: string }).kind === 'entry') signatures.add((value as EntryRecipe).collection);
    Object.values(value).forEach(visit);
  };
  recipes.forEach(visit);
  const collections = artifact.stateLayout?.collections ?? [];
  const entries = new Map<string, Entry[]>();
  await Promise.all([...signatures].map(async (signature) => {
    const matches = collections.filter((collection) => collection.signature === signature && collection.kind === 'mapping');
    if (matches.length !== 1) throw new Error(`messageBus: entry recipe collection '${signature}' is unavailable`);
    entries.set(signature, await host.getEntries(signature));
  }));
  const structs = artifact.stateLayout?.structs ?? artifact.structs;
  return (recipe, keys) => {
    const collection = collections.find((candidate) => candidate.signature === recipe.collection);
    const incoming = entries.get(recipe.collection);
    if (!collection || !incoming) throw new Error('messageBus: authenticated entry recipe context is unavailable');
    const keyTypes = collection.keyTypes ?? [collection.keyType];
    if (keys.length !== keyTypes.length || keys.some((key) => typeof key !== 'bigint'
      && typeof key !== 'boolean' && typeof key !== 'string' && !(key instanceof Uint8Array))) {
      throw new Error('messageBus: entry recipe keys do not match the collection schema');
    }
    const entry = selectMappingEntryByKeys(
      incoming, keys as Array<bigint | boolean | string | Uint8Array>, keyTypes, collection,
    );
    let value = entry?.value ?? getDefaultStateValue(collection.valueType, structs);
    let type = collection.valueType;
    for (const segment of recipe.path) {
      const parentType = type;
      const struct = structs?.find((candidate) => candidate.name === parentType);
      const array = parseArrayTypeString(type);
      if (typeof segment === 'string' && struct) {
        const field = struct.fields.find((candidate) => candidate.name === segment);
        if (!field || !value || typeof value !== 'object' || value instanceof Uint8Array || Array.isArray(value)
          || !Object.hasOwn(value, segment)) throw new Error('messageBus: entry recipe has an invalid struct projection');
        type = field.type;
        value = value[segment];
      } else if (typeof segment === 'number' && array?.bound !== undefined
        && Number.isSafeInteger(segment) && segment >= 0 && segment < array.bound
        && Array.isArray(value) && segment < value.length) {
        type = array.elementType;
        value = value[segment];
      } else throw new Error('messageBus: entry recipe has an invalid fixed-array projection');
    }
    if (abiTypeString(parseTypeStrict(type)) !== abiTypeString(parseTypeStrict(recipe.resultType))
      || (typeof value !== 'bigint' && typeof value !== 'boolean' && typeof value !== 'string'
        && !(value instanceof Uint8Array))) {
      throw new Error('messageBus: entry recipe leaf does not match its declared type');
    }
    return value;
  };
}
