export interface ValueChunkProducerSourceSite {
  /** Compiler-authenticated global function/effect-domain digest. */
  sourceEffectDomainId: string;
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
  mutationEffectDomainId: string;
  mutationSourceEffectOrdinal: number;
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

function canonicalValueChunkStateOwner(owner: {
  categoryId: string; lockingBytecode: string;
}): string | undefined {
  const categoryId = canonicalHex(owner.categoryId, 32);
  const lockingBytecode = canonicalHex(owner.lockingBytecode);
  return categoryId && lockingBytecode ? `${categoryId}:${lockingBytecode}` : undefined;
}

export function canonicalValueChunkProducerIdentity(
  identity: ValueChunkProducerIdentity,
): string | undefined {
  const categoryId = canonicalHex(identity.stateOwner.categoryId, 32);
  const lockingBytecode = canonicalHex(identity.stateOwner.lockingBytecode);
  if (identity.version !== 1 || !categoryId || !lockingBytecode
    || !canonicalHex(identity.mutationEffectDomainId, 32)
    || !safeOrdinal(identity.mutationSourceEffectOrdinal)) return undefined;
  const sourcePath: Array<[string, number, number | null, number, number]> = [];
  for (const site of identity.sourcePath) {
    const effectDomain = canonicalHex(site.sourceEffectDomainId, 32);
    if (!effectDomain || !safeOrdinal(site.sourceCallsiteId) || !safeOrdinal(site.occurrenceIndex)
      || !safeOrdinal(site.sourceEffectOrdinal)
      || (site.sourceLogicalIndex !== undefined && !safeOrdinal(site.sourceLogicalIndex))) return undefined;
    sourcePath.push([
      effectDomain, site.sourceCallsiteId, site.sourceLogicalIndex ?? null,
      site.occurrenceIndex, site.sourceEffectOrdinal,
    ]);
  }
  return JSON.stringify([
    1, categoryId, lockingBytecode, sourcePath,
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
  if (!canonicalValueChunkProducerIdentity(claim.producer)) return undefined;
  const resourceIdentity = canonicalValueChunkProducerResourceIdentity(claim.resourceIdentity);
  const owner = canonicalValueChunkStateOwner(claim.producer.stateOwner);
  if (!resourceIdentity || !owner || resourceIdentity.split(':')[0] !== owner.split(':')[0]) return undefined;
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
  const ownerKeys = new Set(claims.map((claim) => canonicalValueChunkStateOwner(claim.producer.stateOwner)));
  if (ownerKeys.has(undefined) || ownerKeys.size !== 1) return false;
  const expectedOwner = ownerKeys.values().next().value;
  if (!expectedOwner || aliases.some((alias) => (
    canonicalValueChunkStateOwner(alias.valueChunkStateOwner) !== expectedOwner
  ))) return false;
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
): SingletonValueChunkProducerSelection {
  const normalized = claims.map((claim) => canonicalValueChunkProducerResourceClaim(claim));
  if (normalized.some((claim) => claim === undefined)) return { status: 'invalid' };
  const resource = canonicalValueChunkProducerResourceIdentity(resourceIdentity);
  if (!resource) return { status: 'invalid' };
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
    canonical.set(key, claim);
  }
  return canonical.size === 1
    ? { status: 'exact', claim: [...canonical.values()][0] }
    : { status: 'multiple', claims: [...canonical.values()] };
}
