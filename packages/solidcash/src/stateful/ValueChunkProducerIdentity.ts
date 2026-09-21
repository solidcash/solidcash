import { binToHex, hexToBin, sha256 } from '@bitauth/libauth';

const EFFECT_DOMAIN_TAG = new TextEncoder().encode('SolidCash/value-chunk-effect-domain/v1\0');

export interface ValueChunkProducerSourceSite {
  /** Compiler-authenticated global function/effect-domain digest. */
  readonly sourceEffectDomainId: string;
  readonly sourceCallsiteId: number;
  readonly sourceLogicalIndex?: number;
  readonly occurrenceIndex: number;
  readonly sourceEffectOrdinal: number;
}

export interface ValueChunkProducerIdentity {
  version: 1;
  stateOwner: {
    categoryId: string;
    lockingBytecode: string;
  };
  /** Root-to-leaf call occurrence path. The terminal mutation remains a separate program point. */
  sourcePath: readonly ValueChunkProducerSourceSite[];
  mutationEffectDomainId: string;
  mutationSourceEffectOrdinal: number;
}

export interface ValueChunkProducerPathContext {
  readonly version: 1;
  /** Empty only for a direct/root handler mutation. Nested producers append one site per call edge. */
  sourcePath: readonly ValueChunkProducerSourceSite[];
}

export type ValueChunkProducerPathDisposition =
  | { readonly status: 'complete'; readonly context: ValueChunkProducerPathContext }
  | { readonly status: 'unavailable' };

/** Copy-on-write argument state for independently rebuilt graph rows, keyed only by compiler source path. */
export type ValueChunkProducerArgumentEpoch<T> = ReadonlyMap<string, readonly T[]>;

export function createValueChunkProducerArgumentEpoch<T>(
  rows: readonly { producerPath?: ValueChunkProducerPathDisposition; args: readonly T[] }[],
): ValueChunkProducerArgumentEpoch<T> {
  const epoch = new Map<string, readonly T[]>();
  for (const row of rows) {
    const key = row.producerPath?.status === 'complete'
      ? canonicalValueChunkProducerPathContext(row.producerPath.context) : undefined;
    if (!key) continue;
    if (epoch.has(key)) {
      throw new Error('Value-chunk producer argument epoch contains a duplicate producer path.');
    }
    epoch.set(key, Object.freeze([...row.args]));
  }
  return epoch;
}

export function advanceValueChunkProducerArgumentEpoch<T>(
  epoch: ValueChunkProducerArgumentEpoch<T>,
  producerPath: ValueChunkProducerPathDisposition | undefined,
  args: readonly T[],
): ValueChunkProducerArgumentEpoch<T> {
  const key = producerPath?.status === 'complete'
    ? canonicalValueChunkProducerPathContext(producerPath.context) : undefined;
  if (!key || !epoch.has(key)) {
    throw new Error('Value-chunk producer argument refresh has no stable producer path.');
  }
  const next = new Map(epoch);
  next.set(key, Object.freeze([...args]));
  return next;
}

export function valueChunkProducerArgumentsInEpoch<T>(
  epoch: ValueChunkProducerArgumentEpoch<T>,
  producerPath: ValueChunkProducerPathDisposition | undefined,
): readonly T[] | undefined {
  const key = producerPath?.status === 'complete'
    ? canonicalValueChunkProducerPathContext(producerPath.context) : undefined;
  return key ? epoch.get(key) : undefined;
}

export function appendValueChunkProducerSourceSite(
  context: ValueChunkProducerPathContext,
  site: ValueChunkProducerSourceSite,
): ValueChunkProducerPathContext | undefined {
  if (!canonicalValueChunkProducerPathContext(context)) return undefined;
  const next: ValueChunkProducerPathContext = { version: 1, sourcePath: [...context.sourcePath, site] };
  if (!canonicalValueChunkProducerPathContext(next)) return undefined;
  return Object.freeze({
    version: 1,
    sourcePath: Object.freeze(next.sourcePath.map((candidate) => Object.freeze({
      sourceEffectDomainId: candidate.sourceEffectDomainId.toLowerCase(),
      sourceCallsiteId: candidate.sourceCallsiteId,
      ...(candidate.sourceLogicalIndex !== undefined && {
        sourceLogicalIndex: candidate.sourceLogicalIndex,
      }),
      occurrenceIndex: candidate.occurrenceIndex,
      sourceEffectOrdinal: candidate.sourceEffectOrdinal,
    }))),
  });
}

/** Derive one child path from an exact executable parent entry point and compiler source occurrence. */
export function deriveValueChunkProducerChildPath(options: {
  parent: ValueChunkProducerPathDisposition;
  parentExecutionLockingBytecode: string;
  parentSelector?: string;
  sourceCallsiteId?: number;
  sourceLogicalIndex?: number;
  occurrenceIndex?: number;
  sourceEffectOrdinal?: number;
}): ValueChunkProducerPathDisposition {
  if (options.parent.status !== 'complete' || options.parentSelector === undefined
    || !safeOrdinal(options.sourceCallsiteId) || !safeOrdinal(options.occurrenceIndex)
    || !safeOrdinal(options.sourceEffectOrdinal)
    || (options.sourceLogicalIndex !== undefined && !safeOrdinal(options.sourceLogicalIndex))) {
    return Object.freeze({ status: 'unavailable' });
  }
  const sourceEffectDomainId = valueChunkEffectDomainId(
    options.parentExecutionLockingBytecode, options.parentSelector,
  );
  if (!sourceEffectDomainId) return Object.freeze({ status: 'unavailable' });
  const context = appendValueChunkProducerSourceSite(options.parent.context, {
    sourceEffectDomainId,
    sourceCallsiteId: options.sourceCallsiteId,
    ...(options.sourceLogicalIndex !== undefined && { sourceLogicalIndex: options.sourceLogicalIndex }),
    occurrenceIndex: options.occurrenceIndex,
    sourceEffectOrdinal: options.sourceEffectOrdinal,
  });
  return context === undefined
    ? Object.freeze({ status: 'unavailable' })
    : Object.freeze({ status: 'complete', context });
}

export function canonicalValueChunkProducerPathContext(
  context: ValueChunkProducerPathContext,
): string | undefined {
  if (!context || typeof context !== 'object' || context.version !== 1
    || !Array.isArray(context.sourcePath)) return undefined;
  const sourcePath: Array<[string, number, number | null, number, number]> = [];
  for (const site of context.sourcePath) {
    if (!site || typeof site !== 'object') return undefined;
    const effectDomain = canonicalHex(site.sourceEffectDomainId, 32);
    if (!effectDomain || !safeOrdinal(site.sourceCallsiteId) || !safeOrdinal(site.occurrenceIndex)
      || !safeOrdinal(site.sourceEffectOrdinal)
      || (site.sourceLogicalIndex !== undefined && !safeOrdinal(site.sourceLogicalIndex))) return undefined;
    sourcePath.push([
      effectDomain, site.sourceCallsiteId, site.sourceLogicalIndex ?? null,
      site.occurrenceIndex, site.sourceEffectOrdinal,
    ]);
  }
  return JSON.stringify([1, sourcePath]);
}

export interface ValueChunkProducerResourceClaim {
  producer: ValueChunkProducerIdentity;
  /** Exact category + collection hash + key slot identity. */
  resourceIdentity: string;
}

export interface ValueChunkProducerRouteRowCoordinates {
  sourceEffectDomainId?: string;
  sourceCallsiteId?: number;
  sourceLogicalIndex?: number;
  occurrenceIndex?: number;
  sourceEffectOrdinal?: number;
}

export interface ValueChunkProducerMutationRow {
  readonly selector?: string;
  readonly producerPath?: ValueChunkProducerPathDisposition;
  readonly handler: {
    readonly selector?: string;
    readonly sourceEffectOrder?: 'linear' | 'unsupported-flow';
    readonly entryAccesses?: readonly {
      readonly collection: string;
      readonly operations: readonly string[];
      readonly mutationEffectOrdinals?: readonly number[];
    }[];
  };
}

const safeOrdinal = (value: number | undefined): value is number => (
  Number.isSafeInteger(value) && value !== undefined && value >= 0
);

/** Globally scope a function-local effect ordinal to one exact executable entry point. */
export function valueChunkEffectDomainId(
  executionLockingBytecode: string,
  selector: string,
): string | undefined {
  const lockingBytecode = canonicalHex(executionLockingBytecode);
  const canonicalSelector = canonicalHex(selector, 4);
  if (!lockingBytecode || !canonicalSelector) return undefined;
  const lock = hexToBin(lockingBytecode);
  if (lock.length > 0xffffffff) return undefined;
  // uint32le length keeps the tagged preimage unambiguous for full 2026 VM bytecode without truncation.
  const length = Uint8Array.from([
    lock.length % 0x100,
    Math.floor(lock.length / 0x100) % 0x100,
    Math.floor(lock.length / 0x10000) % 0x100,
    Math.floor(lock.length / 0x1000000) % 0x100,
  ]);
  return binToHex(sha256.hash(Uint8Array.from([
    ...EFFECT_DOMAIN_TAG, ...length, ...lock, ...hexToBin(canonicalSelector),
  ])));
}

const canonicalHex = (value: unknown, bytes?: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase();
  if (!/^(?:[0-9a-f]{2})+$/.test(normalized)) return undefined;
  return bytes === undefined || normalized.length === bytes * 2 ? normalized : undefined;
};

export function canonicalValueChunkProducerResourceIdentity(value: string): string | undefined {
  if (typeof value !== 'string') return undefined;
  const [categoryId, collectionHash, keySlot, ...extra] = value.split(':');
  if (extra.length > 0) return undefined;
  const canonicalCategory = canonicalHex(categoryId, 32);
  const canonicalCollection = canonicalHex(collectionHash, 20);
  const canonicalSlot = canonicalHex(keySlot, 32);
  return canonicalCategory && canonicalCollection && canonicalSlot
    ? `${canonicalCategory}:${canonicalCollection}:${canonicalSlot}` : undefined;
}

export function canonicalValueChunkStateOwner(owner: {
  categoryId: string; lockingBytecode: string;
}): string | undefined {
  if (!owner || typeof owner !== 'object') return undefined;
  const categoryId = canonicalHex(owner.categoryId, 32);
  const lockingBytecode = canonicalHex(owner.lockingBytecode);
  return categoryId && lockingBytecode ? `${categoryId}:${lockingBytecode}` : undefined;
}

/** Canonical identity for one storage resource under one exact physical state owner. */
export function canonicalValueChunkResourceOwnerIdentity(
  resourceIdentity: string,
  owner: { categoryId: string; lockingBytecode: string },
): string | undefined {
  const resource = canonicalValueChunkProducerResourceIdentity(resourceIdentity);
  const stateOwner = canonicalValueChunkStateOwner(owner);
  if (!resource || !stateOwner || resource.split(':')[0] !== stateOwner.split(':')[0]) return undefined;
  return JSON.stringify([1, resource, stateOwner]);
}

export function canonicalValueChunkProducerIdentity(
  identity: ValueChunkProducerIdentity,
): string | undefined {
  if (!identity || typeof identity !== 'object' || !identity.stateOwner) return undefined;
  const categoryId = canonicalHex(identity.stateOwner.categoryId, 32);
  const lockingBytecode = canonicalHex(identity.stateOwner.lockingBytecode);
  if (identity.version !== 1 || !categoryId || !lockingBytecode
    || !canonicalHex(identity.mutationEffectDomainId, 32)
    || !safeOrdinal(identity.mutationSourceEffectOrdinal)) return undefined;
  const path = canonicalValueChunkProducerPathContext({ version: 1, sourcePath: identity.sourcePath });
  if (!path) return undefined;
  return JSON.stringify([
    1, categoryId, lockingBytecode, JSON.parse(path)[1],
    identity.mutationEffectDomainId.toLowerCase(), identity.mutationSourceEffectOrdinal,
  ]);
}

/** Build a claim only from complete compiler row coordinates and an exact physical state owner. */
export function valueChunkProducerClaimFromRouteRow(options: {
  row: ValueChunkProducerRouteRowCoordinates;
  enclosingSourcePath?: readonly ValueChunkProducerSourceSite[];
  mutationSourceEffectOrdinal: number;
  mutationEffectDomainId: string;
  stateOwnerCategoryId: string;
  stateOwnerLockingBytecode: string;
  resourceIdentity: string;
}): ValueChunkProducerResourceClaim | undefined {
  const { row } = options;
  const resourceIdentity = canonicalValueChunkProducerResourceIdentity(options.resourceIdentity);
  if (!canonicalHex(row.sourceEffectDomainId ?? '', 32)
    || !canonicalHex(options.mutationEffectDomainId, 32)
    || !safeOrdinal(row.sourceCallsiteId) || !safeOrdinal(row.occurrenceIndex)
    || !safeOrdinal(row.sourceEffectOrdinal)
    || (row.sourceLogicalIndex !== undefined && !safeOrdinal(row.sourceLogicalIndex))
    || !resourceIdentity) return undefined;
  const claim: ValueChunkProducerResourceClaim = {
    resourceIdentity,
    producer: {
      version: 1,
      stateOwner: {
        categoryId: options.stateOwnerCategoryId,
        lockingBytecode: options.stateOwnerLockingBytecode,
      },
      sourcePath: [...(options.enclosingSourcePath ?? []), {
        sourceEffectDomainId: row.sourceEffectDomainId!,
        sourceCallsiteId: row.sourceCallsiteId,
        ...(row.sourceLogicalIndex !== undefined && { sourceLogicalIndex: row.sourceLogicalIndex }),
        occurrenceIndex: row.occurrenceIndex,
        sourceEffectOrdinal: row.sourceEffectOrdinal,
      }],
      mutationEffectDomainId: options.mutationEffectDomainId,
      mutationSourceEffectOrdinal: options.mutationSourceEffectOrdinal,
    },
  };
  return canonicalValueChunkProducerResourceClaim(claim);
}

/**
 * Select the terminal reached mutation of one exact storage resource.
 *
 * Row order is executable source order only when every matching handler publishes
 * a complete linear effect order. The invocation path identifies the exact graph
 * occurrence; the terminal mutation ordinal identifies the write within it.
 */
export function terminalValueChunkProducerClaim(options: {
  rows: readonly ValueChunkProducerMutationRow[];
  collectionIdentities: readonly string[];
  /** Selector family whose route covenant proves at most one unconditional fixed-chunkable mutation row. */
  fixedChunkableWriteSelectors?: readonly string[];
  executionLockingBytecode: string;
  stateOwnerCategoryId: string;
  stateOwnerLockingBytecode: string;
  resourceIdentity: string;
}): ValueChunkProducerResourceClaim | undefined {
  const collections = new Set(options.collectionIdentities);
  const matching = options.rows.flatMap((row, rowIndex) => {
    const accesses = (row.handler.entryAccesses ?? []).filter((access) => (
      collections.has(access.collection) && access.operations.includes('write')
    ));
    return accesses.length === 0 ? [] : [{ row, rowIndex, accesses }];
  });
  if (matching.length === 0) return undefined;
  const terminal = matching[matching.length - 1];
  const mutationOrdinals = terminal.accesses.flatMap((access) => (
    access.mutationEffectOrdinals ?? []
  ));
  if (mutationOrdinals.length === 0 || mutationOrdinals.some((ordinal) => !safeOrdinal(ordinal))) {
    return undefined;
  }
  const selector = terminal.row.selector ?? terminal.row.handler.selector;
  const canonicalSelector = selector === undefined ? undefined : canonicalHex(selector, 4);
  const fixedChunkableOccurrence = canonicalSelector !== undefined
    && terminal.accesses.length === 1 && mutationOrdinals.length === 1
    && (options.fixedChunkableWriteSelectors ?? [])
      .some((candidate) => canonicalHex(candidate, 4) === canonicalSelector);
  if ((terminal.row.handler.sourceEffectOrder !== 'linear' && !fixedChunkableOccurrence)
    || terminal.row.producerPath?.status !== 'complete') return undefined;
  const mutationEffectDomainId = selector === undefined ? undefined
    : valueChunkEffectDomainId(options.executionLockingBytecode, selector);
  if (!mutationEffectDomainId) return undefined;
  return canonicalValueChunkProducerResourceClaim({
    resourceIdentity: options.resourceIdentity,
    producer: {
      version: 1,
      stateOwner: {
        categoryId: options.stateOwnerCategoryId,
        lockingBytecode: options.stateOwnerLockingBytecode,
      },
      sourcePath: terminal.row.producerPath.context.sourcePath,
      mutationEffectDomainId,
      mutationSourceEffectOrdinal: Math.max(...mutationOrdinals),
    },
  });
}

export type SingletonValueChunkProducerSelection =
  | { status: 'absent' }
  | { status: 'invalid' }
  | { status: 'exact'; claim: ValueChunkProducerResourceClaim }
  | { status: 'multiple'; claims: readonly ValueChunkProducerResourceClaim[] };

export interface ValueChunkProducerClaimCarrier {
  valueChunkStateOwner: { categoryId: string; lockingBytecode: string };
  valueChunkProducerClaims?: readonly ValueChunkProducerResourceClaim[];
}

export function canonicalValueChunkProducerResourceClaim(
  claim: ValueChunkProducerResourceClaim,
): ValueChunkProducerResourceClaim | undefined {
  if (!claim || typeof claim !== 'object' || !claim.producer) return undefined;
  if (!canonicalValueChunkProducerIdentity(claim.producer)) return undefined;
  const resourceIdentity = canonicalValueChunkProducerResourceIdentity(claim.resourceIdentity);
  const owner = canonicalValueChunkStateOwner(claim.producer.stateOwner);
  if (!resourceIdentity || !owner || resourceIdentity.split(':')[0] !== owner.split(':')[0]) return undefined;
  const sourcePath = Object.freeze(claim.producer.sourcePath.map((site) => Object.freeze({
    sourceEffectDomainId: site.sourceEffectDomainId.toLowerCase(),
    sourceCallsiteId: site.sourceCallsiteId,
    ...(site.sourceLogicalIndex !== undefined && { sourceLogicalIndex: site.sourceLogicalIndex }),
    occurrenceIndex: site.occurrenceIndex,
    sourceEffectOrdinal: site.sourceEffectOrdinal,
  })));
  const stateOwner = Object.freeze({
    categoryId: claim.producer.stateOwner.categoryId.toLowerCase(),
    lockingBytecode: claim.producer.stateOwner.lockingBytecode.toLowerCase(),
  });
  const producer = Object.freeze({
    version: 1 as const,
    stateOwner,
    sourcePath,
    mutationEffectDomainId: claim.producer.mutationEffectDomainId.toLowerCase(),
    mutationSourceEffectOrdinal: claim.producer.mutationSourceEffectOrdinal,
  });
  return Object.freeze({ producer, resourceIdentity });
}

/** Copy one immutable claim set to physical/logical aliases, refusing disagreement with prior transport. */
export function bindValueChunkProducerClaimAliases(
  aliases: readonly ValueChunkProducerClaimCarrier[],
  claims: readonly ValueChunkProducerResourceClaim[],
): boolean {
  if (!Array.isArray(aliases) || aliases.length === 0 || !Array.isArray(claims)) return false;
  const canonicalClaims = claims.map((claim) => {
    if (!claim || typeof claim !== 'object' || !claim.producer) return undefined;
    const producer = canonicalValueChunkProducerIdentity(claim.producer);
    const resource = canonicalValueChunkProducerResourceIdentity(claim.resourceIdentity);
    return producer && resource ? `${resource}\u0000${producer}` : undefined;
  });
  if (canonicalClaims.some((claim) => claim === undefined)) return false;
  const ownerKeys = new Set(claims.map((claim) => (
    claim && typeof claim === 'object' && claim.producer
      ? canonicalValueChunkStateOwner(claim.producer.stateOwner)
      : undefined
  )));
  if (ownerKeys.has(undefined) || ownerKeys.size !== 1) return false;
  const expectedOwner = ownerKeys.values().next().value;
  if (!expectedOwner || aliases.some((alias) => (
    !alias || typeof alias !== 'object'
    || canonicalValueChunkStateOwner(alias.valueChunkStateOwner) !== expectedOwner
  ))) return false;
  const expected = [...canonicalClaims as string[]].sort().join('\u0001');
  for (const alias of aliases) {
    if (!alias.valueChunkProducerClaims) continue;
    if (!Array.isArray(alias.valueChunkProducerClaims)) return false;
    const transportedClaims: readonly ValueChunkProducerResourceClaim[] = alias.valueChunkProducerClaims;
    const actualClaims = transportedClaims.map((claim) => {
      if (!claim || typeof claim !== 'object' || !claim.producer) return undefined;
      const producer = canonicalValueChunkProducerIdentity(claim.producer);
      const resource = canonicalValueChunkProducerResourceIdentity(claim.resourceIdentity);
      return producer && resource ? `${resource}\u0000${producer}` : undefined;
    });
    if (actualClaims.some((claim) => claim === undefined)
      || [...actualClaims as string[]].sort().join('\u0001') !== expected) return false;
  }
  const immutable = claims.map(canonicalValueChunkProducerResourceClaim);
  if (immutable.some((claim) => claim === undefined)) return false;
  const frozen = Object.freeze(immutable as ValueChunkProducerResourceClaim[]);
  for (const alias of aliases) alias.valueChunkProducerClaims = frozen;
  return true;
}

/** Collapse physical/logical aliases, but never choose between distinct producers of one resource. */
export function selectSingletonValueChunkProducer(
  claims: readonly ValueChunkProducerResourceClaim[],
  resourceIdentity: string,
  expectedStateOwner: { categoryId: string; lockingBytecode: string },
): SingletonValueChunkProducerSelection {
  const normalized = claims.map((claim) => canonicalValueChunkProducerResourceClaim(claim));
  if (normalized.some((claim) => claim === undefined)) return { status: 'invalid' };
  const resource = canonicalValueChunkProducerResourceIdentity(resourceIdentity);
  const expectedOwner = canonicalValueChunkStateOwner(expectedStateOwner);
  if (!resource || !expectedOwner) return { status: 'invalid' };
  const matching = (normalized as ValueChunkProducerResourceClaim[]).filter((claim) => (
    canonicalValueChunkProducerResourceIdentity(claim.resourceIdentity) === resource
  ));
  if (matching.length === 0) return { status: 'absent' };
  const canonical = new Map<string, ValueChunkProducerResourceClaim>();
  for (const claim of matching) {
    const key = canonicalValueChunkProducerIdentity(claim.producer);
    if (!key || !canonicalValueChunkProducerResourceIdentity(claim.resourceIdentity)) {
      return { status: 'invalid' };
    }
    if (canonicalValueChunkStateOwner(claim.producer.stateOwner) !== expectedOwner) {
      return { status: 'invalid' };
    }
    canonical.set(key, claim);
  }
  return canonical.size === 1
    ? { status: 'exact', claim: [...canonical.values()][0] }
    : { status: 'multiple', claims: [...canonical.values()] };
}

/**
 * One authenticated continuation band for a distinct storage resource.
 *
 * `bandOffset` is participant-local (absolute = participantInputs[p] + bandOffset). The scalar
 * `__internal__valueChunkOutputBase` witness remains band[0]'s absolute coordinate; later bands are
 * authenticated by this ordered claim list rather than by inventing additional scalar witnesses.
 */
export interface TransportedContinuationResourceClaim {
  version: 1;
  owner: { categoryId: string; lockingBytecode: string };
  collectionSignature: string;
  collectionHash: string;
  keySlot: string;
  digest: string;
  chunkCount: number;
  bandOffset: number;
  producerClaim: ValueChunkProducerResourceClaim;
}

export function canonicalTransportedContinuationResourceClaim(
  claim: TransportedContinuationResourceClaim,
): TransportedContinuationResourceClaim | undefined {
  if (!claim || typeof claim !== 'object' || claim.version !== 1) return undefined;
  const owner = canonicalValueChunkStateOwner(claim.owner);
  const collectionHash = canonicalHex(claim.collectionHash, 20);
  const keySlot = canonicalHex(claim.keySlot, 32);
  const digest = canonicalHex(claim.digest, 32);
  const producerClaim = canonicalValueChunkProducerResourceClaim(claim.producerClaim);
  if (!owner || !collectionHash || !keySlot || !digest || !producerClaim
    || typeof claim.collectionSignature !== 'string' || claim.collectionSignature.length === 0
    || !safeOrdinal(claim.chunkCount) || claim.chunkCount < 1
    || !safeOrdinal(claim.bandOffset)
    || producerClaim.resourceIdentity !== `${owner.split(':')[0]}:${collectionHash}:${keySlot}`
    || canonicalValueChunkStateOwner(producerClaim.producer.stateOwner) !== owner) {
    return undefined;
  }
  return Object.freeze({
    version: 1 as const,
    owner: Object.freeze({
      categoryId: claim.owner.categoryId.toLowerCase(),
      lockingBytecode: claim.owner.lockingBytecode.toLowerCase(),
    }),
    collectionSignature: claim.collectionSignature,
    collectionHash,
    keySlot,
    digest,
    chunkCount: claim.chunkCount,
    bandOffset: claim.bandOffset,
    producerClaim,
  });
}

/** Build one ordered continuation-band claim from an authenticated production and its participant-local offset. */
export function buildTransportedContinuationResourceClaim(options: {
  owner: { categoryId: string; lockingBytecode: string };
  collectionSignature: string;
  collectionHash: string;
  keySlot: string;
  digest: string;
  chunkCount: number;
  bandOffset: number;
  producerClaim: ValueChunkProducerResourceClaim;
}): TransportedContinuationResourceClaim | undefined {
  return canonicalTransportedContinuationResourceClaim({
    version: 1,
    owner: options.owner,
    collectionSignature: options.collectionSignature,
    collectionHash: options.collectionHash,
    keySlot: options.keySlot,
    digest: options.digest,
    chunkCount: options.chunkCount,
    bandOffset: options.bandOffset,
    producerClaim: options.producerClaim,
  });
}

/**
 * Order continuation-resource claims by source/mutation order already present in `claims`, failing closed on
 * overlapping bands, duplicate resources, or mixed owners. Callers must still run
 * `selectSingletonValueChunkProducer` per resource before publishing.
 */
export function orderTransportedContinuationResourceClaims(
  claims: readonly TransportedContinuationResourceClaim[],
): readonly TransportedContinuationResourceClaim[] | undefined {
  if (!Array.isArray(claims) || claims.length === 0) return undefined;
  const ordered: TransportedContinuationResourceClaim[] = [];
  const resources = new Set<string>();
  const owners = new Set<string>();
  let nextOffset: number | undefined;
  for (const claim of claims) {
    const canonical = canonicalTransportedContinuationResourceClaim(claim);
    if (!canonical) return undefined;
    const resource = canonical.producerClaim.resourceIdentity;
    const owner = canonicalValueChunkStateOwner(canonical.owner);
    if (!owner || resources.has(resource)) return undefined;
    if (nextOffset !== undefined && canonical.bandOffset !== nextOffset) return undefined;
    resources.add(resource);
    owners.add(owner);
    ordered.push(canonical);
    nextOffset = canonical.bandOffset + canonical.chunkCount;
  }
  if (owners.size !== 1) return undefined;
  return Object.freeze(ordered);
}
