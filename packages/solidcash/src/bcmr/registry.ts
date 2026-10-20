/**
 * Building the registry a publication commits to (CHIP-BCMR, "Metadata Registry JSON Schema").
 *
 * A deployment publishes its own registry: `registryIdentity` is the category, which is the identity's authbase,
 * and the registry carries one identity whose snapshots are keyed by the time each takes effect. The registry is
 * validated against the schema before it is hashed, and the bytes hashed are the bytes returned: re-serializing
 * them would change the hash a publication carries.
 */

import type {
  Extensions, IdentitySnapshot, MetadataRegistry, NftCategory, Tag, URIs,
} from '@bitauth/libauth/build/lib/engine/types/bcmr-types.js';
import { utf8ToBin } from '@bitauth/libauth/build/lib/format/utf8.js';
import { sha256 } from '@solidcash/utils';
import { BcmrError } from './publication.js';

export type { MetadataRegistry } from '@bitauth/libauth/build/lib/engine/types/bcmr-types.js';

/** The schema a registry names, so editors and tools can validate it. */
export const BCMR_SCHEMA = 'https://cashtokens.org/bcmr-v2.schema.json';

/** A token symbol (CHIP-BCMR, "Ticker Symbol Selection"). */
export const TOKEN_SYMBOL_PATTERN = /^[A-Z0-9]+[-A-Z0-9]*$/;

const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const CATEGORY_PATTERN = /^[0-9a-f]{64}$/;

/** What a snapshot says about an identity. */
export interface BcmrSnapshot {
  readonly name: string;
  readonly description?: string;
  /** `icon`, `web` and the other URI identifiers of the schema. */
  readonly uris?: URIs;
  /** The registry tags this identity carries, by identifier. */
  readonly tags?: Readonly<Record<string, Tag>>;
  readonly token?: {
    readonly symbol: string;
    readonly decimals?: number;
    readonly nfts?: NftCategory;
  };
  readonly extensions?: Extensions;
  readonly status?: 'active' | 'inactive' | 'burned';
}

/** A registry as published: the object, the exact bytes hashed, and the hash. */
export interface EncodedRegistry {
  readonly registry: MetadataRegistry;
  readonly json: string;
  readonly bytes: Uint8Array;
  readonly sha256: Uint8Array;
}

/** Refuses a symbol the schema does not admit. */
export function assertTokenSymbol(symbol: string): void {
  if (!TOKEN_SYMBOL_PATTERN.test(symbol)) {
    throw new BcmrError(
      `token symbol "${symbol}" is not a BCMR symbol: use capital letters, digits and hyphens (^[A-Z0-9]+[-A-Z0-9]*$)`,
    );
  }
}

/** Refuses a decimals value the schema does not admit. */
export function assertTokenDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new BcmrError(`token decimals must be an integer from 0 to 18, got ${decimals}`);
  }
}

function assertCategory(category: string): void {
  if (!CATEGORY_PATTERN.test(category)) {
    throw new BcmrError(`a category is 64 lowercase hex characters, got "${category}"`);
  }
}

function assertTimestamp(timestamp: string): void {
  if (!TIMESTAMP_PATTERN.test(timestamp)) {
    throw new BcmrError(`a registry timestamp is YYYY-MM-DDTHH:mm:ss.sssZ, got "${timestamp}"`);
  }
}

/** The identity snapshot `snapshot` describes for `category`. */
export function identitySnapshot(category: string, snapshot: BcmrSnapshot): IdentitySnapshot {
  assertCategory(category);
  if (snapshot.name.length === 0) throw new BcmrError('an identity snapshot needs a name');
  if (snapshot.token !== undefined) {
    assertTokenSymbol(snapshot.token.symbol);
    if (snapshot.token.decimals !== undefined) assertTokenDecimals(snapshot.token.decimals);
  }
  const tags = Object.keys(snapshot.tags ?? {});
  return {
    name: snapshot.name,
    ...(snapshot.description === undefined ? {} : { description: snapshot.description }),
    ...(tags.length === 0 ? {} : { tags }),
    ...(snapshot.status === undefined ? {} : { status: snapshot.status }),
    ...(snapshot.token === undefined ? {} : {
      token: {
        category,
        symbol: snapshot.token.symbol,
        ...(snapshot.token.decimals === undefined ? {} : { decimals: snapshot.token.decimals }),
        ...(snapshot.token.nfts === undefined ? {} : { nfts: snapshot.token.nfts }),
      },
    }),
    ...(snapshot.uris === undefined ? {} : { uris: { ...snapshot.uris } }),
    ...(snapshot.extensions === undefined ? {} : { extensions: snapshot.extensions }),
  };
}

/** A registry the identity of `category` publishes about itself, holding one snapshot taking effect at `timestamp`. */
export function selfPublishedRegistry(category: string, snapshot: BcmrSnapshot, timestamp: string): MetadataRegistry {
  assertTimestamp(timestamp);
  const tags = snapshot.tags ?? {};
  return {
    $schema: BCMR_SCHEMA,
    version: { major: 0, minor: 1, patch: 0 },
    latestRevision: timestamp,
    registryIdentity: category,
    identities: { [category]: { [timestamp]: identitySnapshot(category, snapshot) } },
    ...(Object.keys(tags).length === 0 ? {} : { tags: { ...tags } }),
  };
}

/**
 * `registry` with a new snapshot of `category` taking effect at `timestamp`: a minor version bump, as the schema's
 * versioning asks for an added snapshot. Earlier snapshots are kept, so clients can show what changed.
 */
export function withSnapshot(
  registry: MetadataRegistry, category: string, snapshot: BcmrSnapshot, timestamp: string,
): MetadataRegistry {
  assertTimestamp(timestamp);
  const history = registry.identities?.[category] ?? {};
  if (history[timestamp] !== undefined) throw new BcmrError(`the registry already holds a snapshot at ${timestamp}`);
  const tags = { ...(registry.tags ?? {}), ...(snapshot.tags ?? {}) };
  return {
    ...registry,
    version: { major: registry.version.major, minor: registry.version.minor + 1, patch: 0 },
    latestRevision: timestamp,
    identities: {
      ...(registry.identities ?? {}),
      [category]: { [timestamp]: identitySnapshot(category, snapshot), ...history },
    },
    ...(Object.keys(tags).length === 0 ? {} : { tags }),
  };
}

/** Validates `registry` against the schema and encodes it: the exact bytes a host serves and their SHA-256. */
export async function encodeRegistry(registry: MetadataRegistry): Promise<EncodedRegistry> {
  const { importMetadataRegistry } = await import('@bitauth/libauth/build/lib/schema/bcmr.js');
  const validated = importMetadataRegistry(registry);
  if (typeof validated === 'string') throw new BcmrError(validated);
  const json = `${JSON.stringify(registry, null, 2)}\n`;
  const bytes = utf8ToBin(json);
  return { registry, json, bytes, sha256: sha256(bytes) };
}

/** The current time in the registry's timestamp format. */
export function registryTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}
