/**
 * phase-boundary extract: authenticated collection-value recovery helpers
 * (phase-boundary extract from StatefulContract.ts).
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  decodePushdataValue,
  encodePushdataValue,
  parseArrayTypeString,
  sha256 as sha256Sync,
  VALUE_HEAD_SIZE,
  VALUE_INLINE_LIMIT,
  type StateLayout,
} from '@solidcash/utils';
import { decodeEntryCommitment } from './SortedList.js';


export function isCompleteCollectionValue(
  candidate: Uint8Array, valueType: string | undefined, structs: StateLayout['structs'],
): boolean {
  if (!valueType) return true;
  try {
    return decodePushdataValue(candidate, 0, valueType, structs).bytesConsumed === candidate.length;
  } catch {
    return false;
  }
}

/** Long chunkable entry tail is len4 LE || sha256(value) || value[0..28]. */
export function storedChunkableValueRoots(
  inputs: Array<{ token?: { nft?: { commitment?: string | Uint8Array } } }> | undefined,
): Set<string> {
  const roots = new Set<string>();
  for (const input of inputs ?? []) {
    const commitment = input.token?.nft?.commitment;
    if (!commitment) continue;
    try {
      const parsed = decodeEntryCommitment(
        typeof commitment === 'string' ? hexToBin(commitment) : commitment,
      );
      const raw = parsed.value;
      if (raw.length !== 4 + 32 + VALUE_HEAD_SIZE) continue;
      const length = raw[0] | (raw[1] << 8) | (raw[2] << 16) | (raw[3] << 24);
      if (length > 60) roots.add(binToHex(raw.slice(4, 36)));
    } catch {
      // Not a vmap entry NFT.
    }
  }
  return roots;
}

function authenticatedCollectionValueSelector(
  valueType: string | undefined, structs: StateLayout['structs'],
): (
  items: readonly Uint8Array[], roots: ReadonlySet<string>, preferredRoots: ReadonlySet<string>,
) => Uint8Array | undefined {
  // Sparse probe states share immutable stack items by reference. Cache their two pure classifications across
  // states so a long collection is not decoded and hashed hundreds of times during one witness search.
  const digests = new WeakMap<Uint8Array, string>();
  const completeness = new WeakMap<Uint8Array, boolean>();
  const digest = (item: Uint8Array): string => {
    const cached = digests.get(item);
    if (cached !== undefined) return cached;
    const computed = binToHex(sha256Sync(item));
    digests.set(item, computed);
    return computed;
  };
  const complete = (item: Uint8Array): boolean => {
    const cached = completeness.get(item);
    if (cached !== undefined) return cached;
    const computed = isCompleteCollectionValue(item, valueType, structs);
    completeness.set(item, computed);
    return computed;
  };
  const newestRooted = (
    items: readonly Uint8Array[], candidateRoots: ReadonlySet<string>,
  ): Uint8Array | undefined => {
    for (let index = items.length - 1; index >= 0; index--) {
      const item = items[index];
      if (item.length <= VALUE_HEAD_SIZE || item.length > 10_000) continue;
      // Almost every large stack item is unrelated. Hashing first limits the substantially more expensive typed
      // decode to candidates that are actually authenticated by a root observed in this probe state.
      if (!candidateRoots.has(digest(item)) || !complete(item)) continue;
      return item;
    }
    return undefined;
  };
  return (items, roots, preferredRoots) => {
    // A repeated route can expose several authenticated values for one collection: each logical row leaves its
    // intermediate value/root in the chronological trace, while only the final row owns the transaction output.
    // Recover from the end so the SDK materializes the last-write continuation run rather than a valid prefix.
    if (preferredRoots.size > 0) {
      const stored = newestRooted(items, preferredRoots);
      if (stored) return stored;
    }
    return newestRooted(items, roots);
  };
}

export function selectAuthenticatedCollectionValue(
  items: readonly Uint8Array[],
  roots: ReadonlySet<string>,
  preferredRoots: ReadonlySet<string>,
  valueType: string | undefined,
  structs: StateLayout['structs'],
): Uint8Array | undefined {
  return authenticatedCollectionValueSelector(valueType, structs)(items, roots, preferredRoots);
}

/** Select a pre-handler witness only when its full bytes match an authenticated stored-entry root. */
export function selectAuthenticatedPreValueWitness(
  items: readonly Uint8Array[], storedRoots: ReadonlySet<string>,
  valueType: string | undefined, structs: StateLayout['structs'],
): Uint8Array | undefined {
  if (storedRoots.size === 0) return undefined;
  return authenticatedCollectionValueSelector(valueType, structs)(items, storedRoots, storedRoots);
}

/** Every distinct long value whose complete bytes and authenticating root both occur in a probe trace. */
export function authenticatedCollectionValues(
  items: readonly Uint8Array[], roots: ReadonlySet<string>,
  valueType: string | undefined, structs: StateLayout['structs'],
): Uint8Array[] {
  const values = new Map<string, Uint8Array>();
  for (const item of items) {
    if (item.length <= VALUE_INLINE_LIMIT || item.length > 10_000) continue;
    const root = binToHex(sha256Sync(item));
    if (!roots.has(root)) continue;
    // Mapping bytes/string tails contain their payload verbatim. Unlike arrays and structs, there is no recursive
    // pushdata frame for decodePushdataValue to consume; the authenticated SHA-256 root is the complete framing.
    if (valueType !== 'bytes' && valueType !== 'string'
      && !isCompleteCollectionValue(item, valueType, structs)) continue;
    values.set(root, item);
  }
  return [...values.values()];
}

/** Recover a dynamic array whose element blob and authenticated whole-value root occur in different trace states. */
export function recoverAuthenticatedArrayValue(
  traceItems: readonly Uint8Array[], roots: ReadonlySet<string>, valueType: string | undefined,
  structs: StateLayout['structs'], preferredRoots: ReadonlySet<string> = new Set(),
): Uint8Array | undefined {
  const array = valueType ? parseArrayTypeString(valueType) : undefined;
  if (!array || array.bound !== undefined) return undefined;
  let fallback: Uint8Array | undefined;
  // The trace often contains the same immutable stack item in hundreds of observed states. More importantly, the
  // old recovery tried all 10,000 possible lengths for every occurrence, allocating and hashing each candidate.
  // Array elements are self-delimiting pushdata values, so decode them once to recover the only possible length.
  const uniqueItems = new Set(traceItems);
  for (const elements of uniqueItems) {
    if (elements.length <= VALUE_HEAD_SIZE || elements.length > 10_000) continue;
    let offset = 0;
    let length = 0;
    try {
      while (offset < elements.length) {
        const decoded = decodePushdataValue(elements, offset, array.elementType, structs);
        if (decoded.bytesConsumed <= 0) throw new Error('Array element decoder made no progress.');
        offset += decoded.bytesConsumed;
        length += 1;
      }
    } catch {
      // This stack item is not a complete sequence of this array's element encoding.
      continue;
    }
    if (offset !== elements.length || length === 0) continue;
    const prefix = encodePushdataValue(BigInt(length), 'bigint');
    const candidate = new Uint8Array(prefix.length + elements.length);
    candidate.set(prefix); candidate.set(elements, prefix.length);
    if (!isCompleteCollectionValue(candidate, valueType, structs)) continue;
    const digest = binToHex(sha256Sync(candidate));
    if (preferredRoots.has(digest)) return candidate;
    if (!fallback && roots.has(digest)) fallback = candidate;
  }
  return fallback;
}
