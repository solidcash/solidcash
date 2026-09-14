export interface ValueChunkProducerSourceSite {
  sourceCallsiteId: number;
  sourceLogicalIndex?: number;
  occurrenceIndex: number;
  sourceEffectOrdinal: number;
}

export interface ValueChunkProducerIdentity {
  version: 1;
  stateOwner: {
    categoryId: string;
    lockingBytecode: string;
  };
  /** Root-to-leaf call occurrence path. The terminal mutation remains a separate program point. */
  sourcePath: readonly ValueChunkProducerSourceSite[];
  mutationSourceEffectOrdinal: number;
}

export interface ValueChunkProducerResourceClaim {
  producer: ValueChunkProducerIdentity;
  /** Exact category + collection hash + key slot identity. */
  resourceIdentity: string;
}

export interface ValueChunkProducerRouteRowCoordinates {
  sourceCallsiteId?: number;
  sourceLogicalIndex?: number;
  occurrenceIndex?: number;
  sourceEffectOrdinal?: number;
}

const safeOrdinal = (value: number | undefined): value is number => (
  Number.isSafeInteger(value) && value !== undefined && value >= 0
);

const canonicalHex = (value: string, bytes?: number): string | undefined => {
  const normalized = value.toLowerCase();
  if (!/^(?:[0-9a-f]{2})+$/.test(normalized)) return undefined;
  return bytes === undefined || normalized.length === bytes * 2 ? normalized : undefined;
};

export function canonicalValueChunkProducerResourceIdentity(value: string): string | undefined {
  const [categoryId, collectionHash, keySlot, ...extra] = value.split(':');
  if (extra.length > 0) return undefined;
  const canonicalCategory = canonicalHex(categoryId, 32);
  const canonicalCollection = canonicalHex(collectionHash, 20);
  const canonicalSlot = canonicalHex(keySlot, 32);
  return canonicalCategory && canonicalCollection && canonicalSlot
    ? `${canonicalCategory}:${canonicalCollection}:${canonicalSlot}` : undefined;
}

export function canonicalValueChunkProducerIdentity(
  identity: ValueChunkProducerIdentity,
): string | undefined {
  const categoryId = canonicalHex(identity.stateOwner.categoryId, 32);
  const lockingBytecode = canonicalHex(identity.stateOwner.lockingBytecode);
  if (identity.version !== 1 || !categoryId || !lockingBytecode
    || identity.sourcePath.length === 0
    || !safeOrdinal(identity.mutationSourceEffectOrdinal)) return undefined;
  const sourcePath: Array<[number, number | null, number, number]> = [];
  for (const site of identity.sourcePath) {
    if (!safeOrdinal(site.sourceCallsiteId) || !safeOrdinal(site.occurrenceIndex)
      || !safeOrdinal(site.sourceEffectOrdinal)
      || (site.sourceLogicalIndex !== undefined && !safeOrdinal(site.sourceLogicalIndex))) return undefined;
    sourcePath.push([
      site.sourceCallsiteId, site.sourceLogicalIndex ?? null,
      site.occurrenceIndex, site.sourceEffectOrdinal,
    ]);
  }
  return JSON.stringify([1, categoryId, lockingBytecode, sourcePath, identity.mutationSourceEffectOrdinal]);
}

/** Build a claim only from complete compiler row coordinates and an exact physical state owner. */
export function valueChunkProducerClaimFromRouteRow(options: {
  row: ValueChunkProducerRouteRowCoordinates;
  enclosingSourcePath?: readonly ValueChunkProducerSourceSite[];
  mutationSourceEffectOrdinal: number;
  stateOwnerCategoryId: string;
  stateOwnerLockingBytecode: string;
  resourceIdentity: string;
}): ValueChunkProducerResourceClaim | undefined {
  const { row } = options;
  const resourceIdentity = canonicalValueChunkProducerResourceIdentity(options.resourceIdentity);
  if (!safeOrdinal(row.sourceCallsiteId) || !safeOrdinal(row.occurrenceIndex)
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
        sourceCallsiteId: row.sourceCallsiteId,
        ...(row.sourceLogicalIndex !== undefined && { sourceLogicalIndex: row.sourceLogicalIndex }),
        occurrenceIndex: row.occurrenceIndex,
        sourceEffectOrdinal: row.sourceEffectOrdinal,
      }],
      mutationSourceEffectOrdinal: options.mutationSourceEffectOrdinal,
    },
  };
  return canonicalValueChunkProducerIdentity(claim.producer) ? claim : undefined;
}

export type SingletonValueChunkProducerSelection =
  | { status: 'absent' }
  | { status: 'invalid' }
  | { status: 'exact'; claim: ValueChunkProducerResourceClaim }
  | { status: 'multiple'; claims: readonly ValueChunkProducerResourceClaim[] };

export interface ValueChunkProducerClaimCarrier {
  valueChunkProducerClaims?: readonly ValueChunkProducerResourceClaim[];
}

function immutableValueChunkProducerClaim(
  claim: ValueChunkProducerResourceClaim,
): ValueChunkProducerResourceClaim | undefined {
  if (!canonicalValueChunkProducerIdentity(claim.producer)) return undefined;
  const resourceIdentity = canonicalValueChunkProducerResourceIdentity(claim.resourceIdentity);
  if (!resourceIdentity) return undefined;
  const sourcePath = Object.freeze(claim.producer.sourcePath.map((site) => Object.freeze({ ...site })));
  const stateOwner = Object.freeze({
    categoryId: claim.producer.stateOwner.categoryId.toLowerCase(),
    lockingBytecode: claim.producer.stateOwner.lockingBytecode.toLowerCase(),
  });
  const producer = Object.freeze({ ...claim.producer, stateOwner, sourcePath });
  return Object.freeze({ producer, resourceIdentity });
}

/** Copy one immutable claim set to physical/logical aliases, refusing disagreement with prior transport. */
export function bindValueChunkProducerClaimAliases(
  aliases: readonly ValueChunkProducerClaimCarrier[],
  claims: readonly ValueChunkProducerResourceClaim[],
): boolean {
  const canonicalClaims = claims.map((claim) => {
    const producer = canonicalValueChunkProducerIdentity(claim.producer);
    const resource = canonicalValueChunkProducerResourceIdentity(claim.resourceIdentity);
    return producer && resource ? `${resource}\u0000${producer}` : undefined;
  });
  if (canonicalClaims.some((claim) => claim === undefined)) return false;
  const expected = [...canonicalClaims as string[]].sort().join('\u0001');
  for (const alias of aliases) {
    if (!alias.valueChunkProducerClaims) continue;
    const actualClaims = alias.valueChunkProducerClaims.map((claim) => {
      const producer = canonicalValueChunkProducerIdentity(claim.producer);
      const resource = canonicalValueChunkProducerResourceIdentity(claim.resourceIdentity);
      return producer && resource ? `${resource}\u0000${producer}` : undefined;
    });
    if (actualClaims.some((claim) => claim === undefined)
      || [...actualClaims as string[]].sort().join('\u0001') !== expected) return false;
  }
  const immutable = claims.map(immutableValueChunkProducerClaim);
  if (immutable.some((claim) => claim === undefined)) return false;
  const frozen = Object.freeze(immutable as ValueChunkProducerResourceClaim[]);
  for (const alias of aliases) alias.valueChunkProducerClaims = frozen;
  return true;
}

/** Collapse physical/logical aliases, but never choose between distinct producers of one resource. */
export function selectSingletonValueChunkProducer(
  claims: readonly ValueChunkProducerResourceClaim[],
  resourceIdentity: string,
): SingletonValueChunkProducerSelection {
  const resource = canonicalValueChunkProducerResourceIdentity(resourceIdentity);
  if (!resource) return { status: 'invalid' };
  const matching = claims.filter((claim) => (
    canonicalValueChunkProducerResourceIdentity(claim.resourceIdentity) === resource
  ));
  if (matching.length === 0) return { status: 'absent' };
  const canonical = new Map<string, ValueChunkProducerResourceClaim>();
  for (const claim of matching) {
    const key = canonicalValueChunkProducerIdentity(claim.producer);
    if (!key || !canonicalValueChunkProducerResourceIdentity(claim.resourceIdentity)) {
      return { status: 'invalid' };
    }
    canonical.set(key, claim);
  }
  return canonical.size === 1
    ? { status: 'exact', claim: [...canonical.values()][0] }
    : { status: 'multiple', claims: [...canonical.values()] };
}
