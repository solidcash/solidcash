import { binToHex, hexToBin, sha256 } from '@bitauth/libauth';

const EFFECT_DOMAIN_TAG = new TextEncoder().encode('SolidCash/value-chunk-effect-domain/v1\0');

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

export interface ValueChunkProducerPathContext {
  version: 1;
  /** Empty only for a direct/root handler mutation. Nested producers append one site per call edge. */
  sourcePath: readonly ValueChunkProducerSourceSite[];
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

function canonicalValueChunkStateOwner(owner: {
  categoryId: string; lockingBytecode: string;
}): string | undefined {
  if (!owner || typeof owner !== 'object') return undefined;
  const categoryId = canonicalHex(owner.categoryId, 32);
  const lockingBytecode = canonicalHex(owner.lockingBytecode);
  return categoryId && lockingBytecode ? `${categoryId}:${lockingBytecode}` : undefined;
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
