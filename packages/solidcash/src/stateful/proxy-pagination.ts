import type { Artifact } from '@solidcash/utils';

/**
 * Resolve the optional SDK-only `getCollection(offset, limit)` convenience surface.
 *
 * This fallback exists only for an omitted ABI method over an enumerable mapping. A declared method owns its
 * dispatch name and must execute its compiled body; intercepting it here changes observable semantics (including
 * loop-return ordering and source-level bounds checks). Dynamic arrays are likewise handled by their declared
 * accessors rather than the mapping-entry indexer.
 */
export function proxySyntheticPaginationCollection(
  implementation: Pick<Artifact, 'abi' | 'stateLayout'>,
  methodName: string,
): string | undefined {
  if (implementation.abi.some((entry) => entry.name === methodName)) return undefined;
  const suffix = methodName.match(/^get([A-Z].*)$/)?.[1];
  if (!suffix) return undefined;
  const collectionName = suffix[0].toLowerCase() + suffix.slice(1);
  return implementation.stateLayout?.collections?.some((collection) => (
    collection.name === collectionName && collection.kind === 'mapping'
  )) ? collectionName : undefined;
}
