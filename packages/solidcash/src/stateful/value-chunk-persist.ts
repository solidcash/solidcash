/**
 * Value-chunk persist / unlock recipe cluster and composition settlement session CompositionSettlementSession
 * (phase-boundary extract from StatefulTransactionBuilder.ts).
 */

import {
  VALUE_HEAD_SIZE,
  VALUE_CHUNK_SIZE,
  encodePushdataValue,
  computeCollectionHash,
  sha256 as sha256Sync,
} from '@solidcash/utils';
import { binToHex, hexToBin } from '@bitauth/libauth';
import type { Utxo } from '../interfaces.js';
import { getValueChunkLockingBytecode } from './covenant-helpers.js';
import { keyToSlot } from './SortedList.js';
import { LEGACY_JOB_EVENTS_COLLECTION_ALIASES } from './legacy-planning-heuristics.js';
import {
  createExecutionContextLifecycle,
} from '../message-bus/execution-context.js';
import {
  createConstraintFixpointSession,
  type ConstraintFixpointSession,
} from '../message-bus/constraint-fixpoint-session.js';
import {
  canonicalValueChunkProducerIdentity,
  canonicalValueChunkProducerResourceClaim,
  type ValueChunkProducerResourceClaim,
} from './ValueChunkProducerIdentity.js';

export interface ValueChunkWriteDescriptor {
  categoryId: string;
  collection: string;
  collectionSignature: string;
  collectionHash: string;
  keySlot: string;
  entryAccessSlot: number;
  routeSlot: number;
  operation: 'insert' | 'update';
  outputBase: number;
  outputCount: number;
}

export interface DerivedChunkOutputObservation {
  commitment: string;
  lockingBytecode: Uint8Array;
  categoryId?: string;
  fixedIndex?: boolean;
  /** Semantic output family. Commitment prefixes are not sufficient: entry HEAD/P' begins with the same
   * uint16 zero prefix as value chunk 0. */
  semanticKind?: 'valueChunk' | 'entryPin';
  /** Stable compiler/planner resource identity; physical output index is only a projection. */
  resourceIdentity?: string;
  resourcePart?: string;
}

export interface LateValueSuffixInsertion {
  /** Physical coordinate occupied only by the probe-local output. */
  insertAt: number;
  /** Whether the builder's absolute witness maps moved with the physical outputs. */
  shiftedAbsoluteWitnesses: boolean;
}

/** Compiler-described resource coordinates are authoritative; only descriptor-free runs may be relocated. */
export function permitsHeuristicValueChunkRunRelocation(resourceIdentity?: string): boolean {
  return resourceIdentity === undefined;
}

/** VM-authenticated resource observations already name physical outputs; legacy local runs need block rebasing. */
export function materializedValueChunkAbsoluteStart(
  start: number, coordinateBase: number, resourceIdentity?: string,
): number {
  return resourceIdentity === undefined ? coordinateBase + start : start;
}

export const sameDerivedChunkOutputObservation = (
  left: DerivedChunkOutputObservation | undefined,
  right: DerivedChunkOutputObservation | undefined,
): boolean => left === right || (!!left && !!right
  && left.commitment.toLowerCase() === right.commitment.toLowerCase()
  && binToHex(left.lockingBytecode) === binToHex(right.lockingBytecode)
  && left.categoryId?.toLowerCase() === right.categoryId?.toLowerCase()
  && (left.fixedIndex === true) === (right.fixedIndex === true)
  && left.semanticKind === right.semanticKind
  && left.resourceIdentity === right.resourceIdentity
  && left.resourcePart === right.resourcePart);

export const valueChunkWriteResourceIdentity = (write: ValueChunkWriteDescriptor): string => [
  write.categoryId.toLowerCase(), write.collectionHash.toLowerCase(), write.keySlot.toLowerCase(),
].join(':');

export const valueChunkWriteIdentity = valueChunkWriteResourceIdentity;

function validValueChunkWriteIdentity(write: ValueChunkWriteDescriptor): boolean {
  if (!/^[0-9a-f]{64}$/i.test(write.categoryId) || !/^[0-9a-f]{64}$/i.test(write.keySlot)
    || write.collection.length === 0
    || !write.collectionSignature.startsWith(`${write.collection}:`)) return false;
  try {
    return binToHex(computeCollectionHash(write.collectionSignature)) === write.collectionHash.toLowerCase();
  } catch {
    return false;
  }
}


export class ValueChunkWriteStagingSession {
  private readonly writes = new Map<string, Uint8Array>();
  /** Exact post-values are namespaced by both storage resource and compiler-authenticated producer. */
  private readonly ownedWrites = new Map<string, Map<string, Uint8Array>>();
  private readonly ambiguousWrites = new Set<string>();

  stage(write: ValueChunkWriteDescriptor, value: Uint8Array): boolean {
    if (!validValueChunkWriteIdentity(write)
      || value.length <= 60 || value.length > MAX_PERSISTED_JOB_EVENTS_BYTES) return false;
    const identity = valueChunkWriteIdentity(write);
    if (this.ambiguousWrites.has(identity) || this.ownedWrites.has(identity)) {
      this.ambiguousWrites.add(identity);
      this.writes.delete(identity);
      this.ownedWrites.delete(identity);
      return false;
    }
    this.writes.set(identity, value);
    return true;
  }

  get(write: ValueChunkWriteDescriptor): Uint8Array | undefined {
    if (!validValueChunkWriteIdentity(write)) return undefined;
    return this.writes.get(valueChunkWriteIdentity(write));
  }

  /** Stage metadata for one exact producer/resource without selecting it for legacy materialization. */
  stageOwned(
    write: ValueChunkWriteDescriptor,
    claim: ValueChunkProducerResourceClaim,
    expectedStateOwner: { categoryId: string; lockingBytecode: string },
    value: Uint8Array,
    options: { supersedeUnowned?: boolean } = {},
  ): boolean {
    const resourceIdentity = valueChunkWriteIdentity(write);
    const canonicalClaim = canonicalValueChunkProducerResourceClaim(claim);
    const producer = canonicalClaim && canonicalValueChunkProducerIdentity(canonicalClaim.producer);
    if (canonicalClaim?.resourceIdentity !== resourceIdentity || !producer
      || canonicalValueChunkProducerIdentity({
        ...canonicalClaim.producer, stateOwner: expectedStateOwner,
      }) !== producer
      || !validValueChunkWriteIdentity(write)
      || value.length <= 60 || value.length > MAX_PERSISTED_JOB_EVENTS_BYTES) return false;
    if (this.ambiguousWrites.has(resourceIdentity)
      || (this.writes.has(resourceIdentity) && options.supersedeUnowned !== true)) {
      this.ambiguousWrites.add(resourceIdentity);
      this.writes.delete(resourceIdentity);
      this.ownedWrites.delete(resourceIdentity);
      return false;
    }
    // A complete compiler producer claim is a stronger namespace than a raw
    // resource-scoped seed. Explicit promotion is permitted only at the callsite
    // which proved that terminal producer; ordinary stageOwned calls still fail
    // closed on mixed authority.
    if (options.supersedeUnowned === true) this.writes.delete(resourceIdentity);
    const producers = this.ownedWrites.get(resourceIdentity) ?? new Map<string, Uint8Array>();
    const existing = producers.get(producer);
    if (existing && binToHex(existing) !== binToHex(value)) {
      this.ambiguousWrites.add(resourceIdentity);
      this.ownedWrites.delete(resourceIdentity);
      return false;
    }
    producers.set(producer, value.slice());
    this.ownedWrites.set(resourceIdentity, producers);
    return true;
  }

  getOwned(
    write: ValueChunkWriteDescriptor,
    claim: ValueChunkProducerResourceClaim,
    expectedStateOwner: { categoryId: string; lockingBytecode: string },
  ): Uint8Array | undefined {
    const resourceIdentity = valueChunkWriteIdentity(write);
    const canonicalClaim = canonicalValueChunkProducerResourceClaim(claim);
    const producer = canonicalClaim && canonicalValueChunkProducerIdentity(canonicalClaim.producer);
    if (!producer
      || canonicalValueChunkProducerIdentity({
        ...canonicalClaim!.producer, stateOwner: expectedStateOwner,
      }) !== producer
      || canonicalClaim?.resourceIdentity !== resourceIdentity) return undefined;
    const existing = this.ownedWrites.get(resourceIdentity)?.get(producer);
    return existing?.slice();
  }

  delete(write: ValueChunkWriteDescriptor): void {
    const identity = valueChunkWriteIdentity(write);
    this.writes.delete(identity);
    this.ownedWrites.delete(identity);
  }

  clear(categoryId?: string): void {
    if (categoryId === undefined) {
      this.writes.clear();
      this.ownedWrites.clear();
      this.ambiguousWrites.clear();
      return;
    }
    const prefix = `${categoryId.toLowerCase()}:`;
    for (const key of this.writes.keys()) {
      if (key.startsWith(prefix)) this.writes.delete(key);
    }
    for (const key of this.ownedWrites.keys()) {
      if (key.startsWith(prefix)) this.ownedWrites.delete(key);
    }
    for (const key of this.ambiguousWrites) {
      if (key.startsWith(prefix)) this.ambiguousWrites.delete(key);
    }
  }
}


type ObservedValueChunkState = { value: Uint8Array; lockingBytecode: Uint8Array };

export type AuthenticatedValueChunk = {
  commitment: string; lockingBytecode: Uint8Array; categoryId?: string;
};

/**
 * composition settlement session: per-composition settlement state (persisted job-events / observed chunks / recipes).
 * Two sessions do not share mutable maps unless they deliberately share one instance.
 * path-effect activation/settle-time ExecutionContext: also owns settle-time ExecutionContextLifecycle (register → assert → settle).
 */
export class CompositionSettlementSession {
  readonly persistedJobEventsByCategory = new Map<string, Array<{
    commitment: string; lockingBytecode: Uint8Array; categoryId?: string;
  }>>();
  readonly observedValueChunksByCollection = new Map<string, AuthenticatedValueChunk[]>();
  readonly persistedJobEventsValues = new Map<string, Uint8Array>();
  readonly persistedJobEventsLocks = new Map<string, Uint8Array>();
  readonly persistedJobEventsSpends = new Map<string, Array<{
    txid: string;
    vout: number;
    satoshis: bigint;
    token: NonNullable<Utxo['token']>;
    lockingBytecode: Uint8Array;
  }>>();
  readonly persistedJobEventsRecipes = new Map<string, {
    slot: Uint8Array;
    root: Uint8Array;
    collection: string;
    categoryId: string;
  }>();
  readonly persistedValueChunkWrites = new Map<string, {
    value: Uint8Array; lockingBytecode: Uint8Array; width: number;
    recipe: { slot: Uint8Array; root: Uint8Array; collection: string; categoryId: string };
  }>();
  readonly valueChunkWriteStaging = new ValueChunkWriteStagingSession();
  readonly readyValueChunkWrites = new Set<string>();
  readonly persistedValueChunkSpends = new Map<string, Array<{
    txid: string; vout: number; satoshis: bigint;
    token: NonNullable<Utxo['token']>; lockingBytecode: Uint8Array;
  }>>();
  readonly observedValueChunkStatesByCategory = new Map<string, Map<string, ObservedValueChunkState>>();
  readonly stagedJobEventsValues = new Map<string, Uint8Array>();
  readonly createdDigestLocks = new Set<string>();
  readonly persistedCreatedValues = new Map<string, Uint8Array>();
  persistedJobEventsSendReady = false;
  /** Settle-time ExecutionContext lifecycle (isolated per composition session). */
  readonly executionContexts = createExecutionContextLifecycle();
  /** constraint fixpoint: multi-domain monotone fixpoint session (isolated per composition). */
  readonly constraintFixpoint = createConstraintFixpointSession();
  /**
   * settle-time ExecutionContext: last admit-time ExecutionContext effect plans (layout/slot authority consumers).
   * Cleared with the session; written by compose-admit before settle.
   */
  executionEffectPlans: readonly import('../message-bus/execution-context.js').ExecutionContextEffectPlan[] = [];

  clear(categoryId?: string): void {
    if (categoryId) {
      this.persistedJobEventsByCategory.delete(categoryId);
      this.persistedJobEventsValues.delete(categoryId);
      this.persistedJobEventsLocks.delete(categoryId);
      this.persistedJobEventsSpends.delete(categoryId);
      this.persistedJobEventsRecipes.delete(categoryId);
      for (const key of this.persistedValueChunkWrites.keys()) {
        if (key.startsWith(`${categoryId.toLowerCase()}:`)) this.persistedValueChunkWrites.delete(key);
      }
      this.valueChunkWriteStaging.clear(categoryId);
      for (const key of this.readyValueChunkWrites) {
        if (key.startsWith(`${categoryId.toLowerCase()}:`)) this.readyValueChunkWrites.delete(key);
      }
      for (const key of this.persistedValueChunkSpends.keys()) {
        if (key.startsWith(`${categoryId.toLowerCase()}:`)) this.persistedValueChunkSpends.delete(key);
      }
      this.observedValueChunkStatesByCategory.delete(categoryId);
      this.stagedJobEventsValues.delete(categoryId);
      this.createdDigestLocks.delete(categoryId);
      this.persistedCreatedValues.delete(categoryId);
      const prefix = `${categoryId.toLowerCase()}:`;
      for (const key of this.observedValueChunksByCollection.keys()) {
        if (key.startsWith(prefix)) this.observedValueChunksByCollection.delete(key);
      }
    } else {
      this.persistedJobEventsByCategory.clear();
      this.persistedJobEventsValues.clear();
      this.persistedJobEventsLocks.clear();
      this.persistedJobEventsSpends.clear();
      this.persistedJobEventsRecipes.clear();
      this.persistedValueChunkWrites.clear();
      this.valueChunkWriteStaging.clear();
      this.readyValueChunkWrites.clear();
      this.persistedValueChunkSpends.clear();
      this.observedValueChunkStatesByCategory.clear();
      this.stagedJobEventsValues.clear();
      this.createdDigestLocks.clear();
      this.persistedCreatedValues.clear();
      this.observedValueChunksByCollection.clear();
      this.executionContexts.clear();
      this.constraintFixpoint.clear();
      this.executionEffectPlans = [];
    }
    this.persistedJobEventsSendReady = false;
  }
}

let activeCompositionSettlementSession = new CompositionSettlementSession();

/** Process-default settlement session (single-build convenience / back-compat). */
export function getCompositionSettlementSession(): CompositionSettlementSession {
  return activeCompositionSettlementSession;
}

export function createCompositionSettlementSession(): CompositionSettlementSession {
  return new CompositionSettlementSession();
}

/** Run `fn` with `session` as the active settlement owner (nested-safe). */
export function runWithCompositionSettlementSession<T>(
  session: CompositionSettlementSession,
  fn: () => T,
): T {
  const previous = activeCompositionSettlementSession;
  activeCompositionSettlementSession = session;
  try {
    return fn();
  } finally {
    activeCompositionSettlementSession = previous;
  }
}

/** Active settlement maps for this composition (default session unless runWith…). */
/**
 * constraint fixpoint: record one live converge fingerprint onto the active settlement's
 * ConstraintFixpointSession (no-op when the session is already finalized).
 */
export function recordActiveConstraintPass(
  domain: string,
  stateKey: string,
  cycleMessage: string,
): void {
  const session = settlement().constraintFixpoint;
  if (session.getPhase() === 'finalized') return;
  session.recordDomainPass(domain, stateKey, cycleMessage);
}

/** constraint fixpoint: resolve every domain recorded during admit-time converges. */
export function finalizeActiveConstraintFixpoint(): string {
  const session = settlement().constraintFixpoint;
  if (session.getPhase() === 'finalized') return session.jointStateKey();
  return session.finalize();
}

/**
 * constraint fixpoint: run a speculative admit/converge body on the active ConstraintFixpointSession.
 * Throws restore the pre-call snapshot so a failed probe does not poison joint state.
 */
export function runActiveConstraintSpeculative<T>(
  body: (session: ConstraintFixpointSession) => T,
): T {
  const session = settlement().constraintFixpoint;
  if (session.getPhase() === 'finalized') return body(session);
  return session.runSpeculative(body);
}

/**
 * constraint fixpoint: speculative domain-pass inside a converge loop.
 * Returns false when the joint fingerprint would cycle (snapshot restored); true when recorded.
 */
export function tryRecordActiveConstraintPass(
  domain: string,
  stateKey: string,
  cycleMessage: string,
): boolean {
  const session = settlement().constraintFixpoint;
  if (session.getPhase() === 'finalized') return false;
  try {
    session.runSpeculative((fixpoint) => {
      fixpoint.recordDomainPass(domain, stateKey, cycleMessage);
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * constraint fixpoint: try candidates in order; first that records without a joint cycle wins.
 * Failed attempts restore via {@link tryRecordActiveConstraintPass}.
 */
export function selectActiveConstraintCandidate(
  domain: string,
  candidates: readonly string[],
  cycleMessage: string,
): { stateKey: string; index: number } | undefined {
  for (let index = 0; index < candidates.length; index += 1) {
    const stateKey = candidates[index]!;
    if (tryRecordActiveConstraintPass(domain, stateKey, cycleMessage)) {
      return { stateKey, index };
    }
  }
  return undefined;
}

export function settlement(): CompositionSettlementSession {
  return getCompositionSettlementSession();
}


function isCreatedPersistValue(value: Uint8Array | undefined): boolean {
  if (!value || value.length === 0) return false;
  const hex = binToHex(value);
  return hex.includes('4372656174') || hex.includes('00004cb4');
}

/**
 * Retain authenticated value/lock observations until compiler descriptors can bind them to an exact resource.
 * Category is only an observation bucket: descriptor reads authenticate collection hash and key slot before use.
 */
function rememberObservedValueChunkState(
  categoryId: string,
  value: Uint8Array | undefined,
  lockingBytecode: Uint8Array | undefined,
): void {
  if (!value || !lockingBytecode) return;
  const observations = settlement().observedValueChunkStatesByCategory.get(categoryId) ?? new Map();
  const valueHex = binToHex(value);
  const lockHex = binToHex(lockingBytecode);
  observations.set(`${lockHex}:${valueHex}`, { value, lockingBytecode });
  settlement().observedValueChunkStatesByCategory.set(categoryId, observations);
}

export function valueChunkIndexFromCommitment(commitment: string): number | undefined {
  if (commitment.length < 4) return undefined;
  const index = Number.parseInt(commitment.slice(0, 2), 16)
    + 256 * Number.parseInt(commitment.slice(2, 4) || '00', 16);
  if (!Number.isFinite(index) || index < 0 || index >= 32) return undefined;
  return index;
}

/**
 * Persist jobEvents value-chunks: uint16-le index heads (`0000`/`0100`/`0200`)
 * or the empty-root digest (`e3b0c442…`). Data-NFT tags (`0023…`, `51…`) are not.
 */
export function isEmptyValueChunkCommitment(hex: string): boolean {
  const body = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (body.length < 4) return false;
  return /^(?:[0-9a-f]{2}|[0-9a-f]{4})0+$/i.test(body);
}

function usableAuthenticatedValueChunks(
  chunks: ReadonlyArray<AuthenticatedValueChunk>,
): AuthenticatedValueChunk[] {
  return chunks.filter((chunk) => {
    if (chunk.commitment.length < 3 || chunk.commitment === '00') return false;
    // A 12-byte 05||00… tail is a padded split, not a live continuation.
    // Keep short stubs (unit tests) and 1-byte occupancy dummies.
    return !(chunk.commitment.length >= 16 && isEmptyValueChunkCommitment(chunk.commitment));
  });
}

/** Recover one canonical, root-addressed run from a cache that may mix versions. */
export function coherentAuthenticatedValueChunkRun(
  chunks: ReadonlyArray<AuthenticatedValueChunk>,
): AuthenticatedValueChunk[] {
  const byLock = new Map<string, {
    chunks: Map<number, AuthenticatedValueChunk>;
    lastSeen: number;
  }>();
  for (const [order, chunk] of usableAuthenticatedValueChunks(chunks).entries()) {
    const chunkIndex = valueChunkIndexFromCommitment(chunk.commitment);
    if (chunkIndex === undefined) continue;
    const lock = binToHex(chunk.lockingBytecode);
    const group = byLock.get(lock) ?? { chunks: new Map(), lastSeen: order };
    group.chunks.set(chunkIndex, chunk);
    group.lastSeen = order;
    byLock.set(lock, group);
  }
  let selected: AuthenticatedValueChunk[] = [];
  let selectedAt = -1;
  for (const group of byLock.values()) {
    const run: AuthenticatedValueChunk[] = [];
    for (let index = 0; group.chunks.has(index); index++) run.push(group.chunks.get(index)!);
    if (run.length > selected.length || (run.length === selected.length && group.lastSeen > selectedAt)) {
      selected = run;
      selectedAt = group.lastSeen;
    }
  }
  return selected;
}

/**
 * Prefer a newly authenticated chunk run over a fallback, even when the value
 * became shorter. An unusable observation leaves the prior run intact.
 */
export function selectObservedValueChunkRun(
  fallback: ReadonlyArray<AuthenticatedValueChunk>,
  observed: ReadonlyArray<AuthenticatedValueChunk>,
): AuthenticatedValueChunk[] {
  const current = coherentAuthenticatedValueChunkRun(observed);
  return current.length > 0 ? current : coherentAuthenticatedValueChunkRun(fallback);
}

/** Select the first usable run in explicit authority order. */
export function firstUsableValueChunkRun(
  ...runs: ReadonlyArray<ReadonlyArray<AuthenticatedValueChunk>>
): AuthenticatedValueChunk[] {
  for (const run of runs) {
    const usable = coherentAuthenticatedValueChunkRun(run);
    if (usable.length > 0) return usable;
  }
  return [];
}

const MAX_PERSISTED_JOB_EVENTS_BYTES = VALUE_HEAD_SIZE + VALUE_CHUNK_SIZE * 32;

export function valueChunkCountFor(value: Uint8Array): number {
  if (value.length <= VALUE_HEAD_SIZE || value.length > MAX_PERSISTED_JOB_EVENTS_BYTES) return 0;
  return Math.ceil((value.length - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE);
}

/** Live continuation count of the last Updated extract for `categoryId`. */
export function persistedJobEventsWidth(categoryId?: string): number {
  if (!categoryId) {
    let widest = 0;
    for (const chunks of settlement().persistedJobEventsByCategory.values()) {
      widest = Math.max(widest, coherentAuthenticatedValueChunkRun(chunks).length);
    }
    for (const value of settlement().persistedJobEventsValues.values()) {
      widest = Math.max(widest, valueChunkCountFor(value));
    }
    return Math.min(32, widest);
  }
  const fromChunks = coherentAuthenticatedValueChunkRun(
    settlement().persistedJobEventsByCategory.get(categoryId) ?? [],
  ).length;
  const fromValue = valueChunkCountFor(settlement().persistedJobEventsValues.get(categoryId) ?? new Uint8Array());
  return Math.min(32, Math.max(fromChunks, fromValue));
}

function jobEventsSlotCandidates(): Uint8Array[] {
  const slots: Uint8Array[] = [keyToSlot(new Uint8Array()), keyToSlot(Uint8Array.of(0x00))];
  for (const type of ['int', 'uint', 'uint256', 'bigint'] as const) {
    try {
      slots.push(keyToSlot(encodePushdataValue(0n, type)));
    } catch { /* type not encodable as a mapping key */ }
  }
  return slots;
}

/** Recover slot+root so the next UPDATE can spend persist chunks with a real unlocker. */
export function rememberJobEventsUnlockRecipe(categoryId: string): boolean {
  const pairs: Array<{ value: Uint8Array; lock: Uint8Array }> = [];
  const localValue = settlement().persistedJobEventsValues.get(categoryId);
  const localLock = settlement().persistedJobEventsLocks.get(categoryId);
  if (localValue && localLock) pairs.push({ value: localValue, lock: localLock });
  for (const value of settlement().persistedJobEventsValues.values()) {
    for (const lock of settlement().persistedJobEventsLocks.values()) {
      if (localValue && localLock && value === localValue && lock === localLock) continue;
      pairs.push({ value, lock });
    }
  }
  for (const { value, lock } of pairs) {
    const root = sha256Sync(value);
    for (const slot of jobEventsSlotCandidates()) {
      for (const cat of new Set([categoryId, ...settlement().persistedJobEventsLocks.keys(), ...settlement().persistedJobEventsValues.keys()])) {
        for (const collection of LEGACY_JOB_EVENTS_COLLECTION_ALIASES) {
          try {
            const expected = getValueChunkLockingBytecode(cat, collection, slot, root);
            if (binToHex(expected) === binToHex(lock)) {
              const recipe = { slot, root, collection, categoryId: cat };
              settlement().persistedJobEventsRecipes.set(categoryId, recipe);
              settlement().persistedJobEventsRecipes.set(cat, recipe);
              return true;
            }
          } catch { /* category, collection, or slot rejected */ }
        }
      }
    }
  }
  return false;
}

export function persistedJobEventsUnlockRecipe(categoryId: string): {
  slot: Uint8Array; root: Uint8Array; collection: string; categoryId: string;
} | undefined {
  return latestPersisted(settlement().persistedJobEventsRecipes, categoryId);
}

/**
 * Dest-15 UPDATE dest-20 lock: emitValueChunkP2sh32(master category, H(0), sha256(v)).
 * Do not use a persist unlock recipe — that recipe matches the dummy
 * `aa20||sha256(v)||87` first-publish lock, not dest 15's pin.
 */
export function persistValueChunkLock(
  categoryId: string | undefined,
  value?: Uint8Array,
  write?: ValueChunkWriteDescriptor | null,
): Uint8Array | undefined {
  if (!categoryId || !/^[0-9a-f]{64}$/i.test(categoryId) || !value || value.length === 0) {
    return undefined;
  }
  const root = sha256Sync(value);
  // Missing and ambiguous descriptors fail closed. Historical schema recovery is
  // available only through the explicitly named legacy adapter below.
  if (!write || !validValueChunkWriteIdentity(write)) return undefined;
  if (write.categoryId.toLowerCase() !== categoryId.toLowerCase()) return undefined;
  try {
    return getValueChunkLockingBytecode(
      categoryId, write.collection, hexToBin(write.keySlot), root,
    );
  } catch {
    return undefined;
  }
}

/** Explicit adapter for descriptor-free plans using the historical JobEvent collection schema. */
export function legacyJobEventsPersistValueChunkLock(
  categoryId: string | undefined,
  value?: Uint8Array,
): Uint8Array | undefined {
  if (!categoryId || !/^[0-9a-f]{64}$/i.test(categoryId) || !value || value.length === 0) {
    return undefined;
  }
  const root = sha256Sync(value);
  const slot = keyToSlot(new Uint8Array());
  for (const collection of LEGACY_JOB_EVENTS_COLLECTION_ALIASES) {
    try {
      return getValueChunkLockingBytecode(categoryId, collection, slot, root);
    } catch { /* collection rejected */ }
  }
  return undefined;
}

/**
 * Stage the value this tx will write. Do not overwrite persist until send succeeds —
 * withdraw must still spend the previous digest.
 */
export function stageJobEventsValue(
  categoryId: string,
  value: Uint8Array,
  session?: CompositionSettlementSession,
): void {
  const apply = (): void => {
    if (value.length <= 60 || value.length > MAX_PERSISTED_JOB_EVENTS_BYTES) return;
    settlement().stagedJobEventsValues.delete(categoryId);
    settlement().stagedJobEventsValues.set(categoryId, value);
  };
  if (session) runWithCompositionSettlementSession(session, apply);
  else apply();
}


/** Full last committed jobEvents blob (not a Created probe). Latest commit wins. */
export function rememberJobEventsValue(
  categoryId: string,
  value: Uint8Array,
  session?: CompositionSettlementSession,
): void {
  const apply = (): void => {
    if (value.length <= 60 || value.length > MAX_PERSISTED_JOB_EVENTS_BYTES) return;
    // Planning knows the value this transaction intends to authenticate. Later
    // VM probes can still encounter a consumed predecessor, so their temporal
    // order does not make them more authoritative than the staged write.
    const authoritative = settlement().stagedJobEventsValues.get(categoryId) ?? value;
    settlement().persistedJobEventsValues.delete(categoryId);
    settlement().persistedJobEventsValues.set(categoryId, authoritative);
    rememberObservedValueChunkState(categoryId, authoritative, settlement().persistedJobEventsLocks.get(categoryId));
    if (isCreatedPersistValue(authoritative) && !settlement().persistedCreatedValues.has(categoryId)) {
      settlement().persistedCreatedValues.set(categoryId, authoritative);
    }
    rememberJobEventsUnlockRecipe(categoryId);
  };
  if (session) runWithCompositionSettlementSession(session, apply);
  else apply();
}


export function latestPersisted<T>(map: Map<string, T>, categoryId?: string): T | undefined {
  if (categoryId && map.has(categoryId)) return map.get(categoryId);
  let latest: T | undefined;
  for (const value of map.values()) latest = value;
  return latest;
}

export function persistedJobEventsValue(
  categoryId: string,
  session?: CompositionSettlementSession,
): Uint8Array | undefined {
  const read = (): Uint8Array | undefined => (
    // Prefer the value this transaction already planned (INSERT/UPDATE) over a prior
    // committed blob — nested probes often lack the full value on the VM stack.
    settlement().stagedJobEventsValues.get(categoryId) ?? settlement().persistedJobEventsValues.get(categoryId)
  );
  return session ? runWithCompositionSettlementSession(session, read) : read();
}


/** Redeem p2sh32 from emitValueChunkP2sh32 / getValueChunkLockingBytecode — not aa20||sha256(v)||87. */
export function rememberJobEventsLock(
  categoryId: string,
  lock: Uint8Array,
  session?: CompositionSettlementSession,
): void {
  const apply = (): void => {
    if (lock.length !== 35 || lock[0] !== 0xaa || lock[1] !== 0x20 || lock[34] !== 0x87) return;
    // Created digest (first publishJobPost persist) is the UPDATE dest-18 pin.
    // Later persist-v rematerialize must not replace it.
    if (settlement().createdDigestLocks.has(categoryId)) return;
    settlement().persistedJobEventsLocks.set(categoryId, lock);
    const value = settlement().persistedJobEventsValues.get(categoryId)
      ?? latestPersisted(settlement().persistedJobEventsValues, categoryId);
    rememberObservedValueChunkState(categoryId, value, lock);
    const hex = value ? binToHex(value) : '';
    if (hex.includes('4372656174') || hex.includes('00004cb4')) {
      settlement().createdDigestLocks.add(categoryId);
    }
    rememberJobEventsUnlockRecipe(categoryId);
  };
  if (session) runWithCompositionSettlementSession(session, apply);
  else apply();
}


export function persistedJobEventsLock(
  categoryId: string,
  session?: CompositionSettlementSession,
): Uint8Array | undefined {
  const read = (): Uint8Array | undefined => settlement().persistedJobEventsLocks.get(categoryId);
  return session ? runWithCompositionSettlementSession(session, read) : read();
}


/** Stage one compiler-described chunkable value without sharing category-wide mutable state. */
export function stageValueChunkWrite(
  write: ValueChunkWriteDescriptor,
  value: Uint8Array,
  session = settlement().valueChunkWriteStaging,
): boolean {
  return session.stage(write, value);
}

export function stagedValueChunkWrite(
  write: ValueChunkWriteDescriptor,
  session = settlement().valueChunkWriteStaging,
): Uint8Array | undefined {
  return session.get(write);
}

export function isValueChunkWriteReady(write: ValueChunkWriteDescriptor): boolean {
  return validValueChunkWriteIdentity(write) && settlement().readyValueChunkWrites.has(valueChunkWriteIdentity(write));
}

export type ValueChunkWriteCategorySelection =
  | { status: 'absent' }
  | { status: 'exact'; categoryId: string; write: ValueChunkWriteDescriptor }
  | { status: 'multi'; writes: ValueChunkWriteDescriptor[] }
  | { status: 'ambiguous' };

export type ValueChunkResourceSelection =
  | { status: 'absent' }
  | { status: 'exact'; identity: string; categoryId: string }
  | { status: 'multi'; identities: string[] }
  | { status: 'ambiguous' };

/** Select storage-resource ownership independently of the operations applied to it. A graph may INSERT and then
 * UPDATE the same resource in source order; differing operation/route ordinals do not create a second resource. */
export function selectValueChunkResource(
  writes: ReadonlyArray<ValueChunkWriteDescriptor>,
): ValueChunkResourceSelection {
  if (writes.length === 0) return { status: 'absent' };
  const identities = new Map<string, string>();
  for (const write of writes) {
    if (!validValueChunkWriteIdentity(write)) return { status: 'ambiguous' };
    identities.set(valueChunkWriteResourceIdentity(write), write.categoryId);
  }
  if (identities.size === 0) return { status: 'ambiguous' };
  if (identities.size > 1) return { status: 'multi', identities: [...identities.keys()] };
  const [identity, categoryId] = [...identities.entries()][0];
  return { status: 'exact', identity, categoryId };
}

/** Select one compiler-described chunkable-value resource identity; duplicate route/logical views collapse. */
export function selectValueChunkWriteCategory(
  writes: ReadonlyArray<ValueChunkWriteDescriptor>,
): ValueChunkWriteCategorySelection {
  if (writes.length === 0) return { status: 'absent' };
  const identities = new Map<string, ValueChunkWriteDescriptor>();
  for (const write of writes) {
    if (!/^[0-9a-f]{64}$/i.test(write.categoryId) || !/^[0-9a-f]{64}$/i.test(write.keySlot)) {
      return { status: 'ambiguous' };
    }
    try {
      if (binToHex(computeCollectionHash(write.collectionSignature))
        !== write.collectionHash.toLowerCase()) return { status: 'ambiguous' };
    } catch {
      return { status: 'ambiguous' };
    }
    const identity = valueChunkWriteIdentity(write);
    const previous = identities.get(identity);
    // Logical and physical views may publish the same resource descriptor. They
    // must agree on the planner slot and operation which produced that identity;
    // otherwise choosing the last view would turn an INSERT into an UPDATE (or
    // vice versa) based only on group enumeration order.
    if (previous && (previous.operation !== write.operation
      || previous.entryAccessSlot !== write.entryAccessSlot
      || previous.routeSlot !== write.routeSlot)) return { status: 'ambiguous' };
    identities.set(identity, write);
  }
  if (identities.size === 0) return { status: 'ambiguous' };
  if (identities.size > 1) return { status: 'multi', writes: [...identities.values()] };
  const write = [...identities.values()][0];
  return { status: 'exact', categoryId: write.categoryId, write };
}

/**
 * Resolve first-write semantics from an authenticated resource descriptor.
 * A source-name fallback is accepted only when no descriptor was published.
 */
export function isInitialValueChunkWrite(
  selection: ValueChunkWriteCategorySelection,
  legacyNamedInitial = false,
): boolean {
  if (selection.status === 'ambiguous') {
    throw new Error('Ambiguous compiler-described value-chunk write identity');
  }
  if (selection.status === 'multi') return selection.writes.every((write) => write.operation === 'insert');
  return selection.status === 'exact' ? selection.write.operation === 'insert' : legacyNamedInitial;
}

/**
 * Scope persisted continuation readiness to the active compiler-described resource.
 * Process-global readiness is retained only for descriptor-free pre-kernel plans.
 */
export function persistedValueChunkReadiness(parts: {
  selection: ValueChunkWriteCategorySelection;
  hasWriteMetadata: boolean;
  permitsLegacyFallback: boolean;
  descriptorReady: boolean;
  legacyReady: boolean;
}): boolean {
  if (parts.selection.status === 'ambiguous') {
    throw new Error('Ambiguous compiler-described value-chunk write identity');
  }
  if (parts.selection.status === 'exact') return parts.descriptorReady;
  if (parts.selection.status === 'multi') return false;
  if (parts.hasWriteMetadata) {
    throw new Error('Chunkable value write metadata did not produce one exact resource descriptor');
  }
  return parts.permitsLegacyFallback && parts.legacyReady;
}

/** Descriptor-owned rematerialization decision; `undefined` delegates to old-artifact compatibility. */
export function shouldRematerializeDescribedValueChunkWrite(parts: {
  selection: ValueChunkWriteCategorySelection;
  persisted: boolean;
  plannedInserts: number;
}): boolean | undefined {
  if (parts.selection.status === 'ambiguous') {
    throw new Error('Ambiguous compiler-described value-chunk write identity');
  }
  if (parts.selection.status === 'absent' || parts.selection.status === 'multi') return undefined;
  return parts.persisted && parts.plannedInserts === 0
    && parts.selection.write.operation === 'update';
}

/** Resolve a chunk's owner without allowing a caller/default category to contradict compiler write identity. */
export function resolveValueChunkWriteCategory(
  selection: ValueChunkWriteCategorySelection,
  claimedCategoryId: string | undefined,
  legacyDefaultCategoryId: string,
): string | undefined {
  // A physical probe can report a category, but it cannot disambiguate two
  // compiler-described collection resources which share that category. The
  // collection hash and key slot are part of the authenticated identity too.
  if (selection.status === 'ambiguous') return undefined;
  if (selection.status === 'multi') {
    if (!claimedCategoryId) return undefined;
    const claimed = claimedCategoryId.toLowerCase();
    return selection.writes.some((write) => write.categoryId.toLowerCase() === claimed)
      ? claimedCategoryId
      : undefined;
  }
  if (selection.status === 'absent') return claimedCategoryId ?? legacyDefaultCategoryId;
  if (claimedCategoryId !== undefined
    && claimedCategoryId.toLowerCase() !== selection.categoryId.toLowerCase()) return undefined;
  return selection.categoryId;
}

/** Bind an observed value and redeem lock to one exact compiler-described collection write. */
export function rememberValueChunkUnlockRecipe(
  write: ValueChunkWriteDescriptor,
  value = stagedValueChunkWrite(write) ?? settlement().persistedJobEventsValues.get(write.categoryId),
  lockingBytecode = settlement().persistedJobEventsLocks.get(write.categoryId),
): boolean {
  if (!value || !lockingBytecode || !validValueChunkWriteIdentity(write)) return false;
  try {
    const slot = hexToBin(write.keySlot);
    const root = sha256Sync(value);
    const expected = getValueChunkLockingBytecode(
      write.categoryId, write.collection, slot, root,
    );
    if (binToHex(expected) !== binToHex(lockingBytecode)) return false;
    const recipe = {
      slot, root, collection: write.collection, categoryId: write.categoryId,
    };
    settlement().persistedJobEventsRecipes.set(write.categoryId, recipe);
    settlement().persistedValueChunkWrites.set(valueChunkWriteIdentity(write), {
      value,
      lockingBytecode,
      width: valueChunkCountFor(value),
      recipe,
    });
    return true;
  } catch {
    return false;
  }
}

/** Commit one successfully sent compiler-described write and make only that identity ready. */
export function commitStagedValueChunkWrite(
  write: ValueChunkWriteDescriptor,
  lockingBytecode: Uint8Array,
  session = settlement().valueChunkWriteStaging,
): boolean {
  const value = session.get(write);
  if (!value || !rememberValueChunkUnlockRecipe(write, value, lockingBytecode)) return false;
  session.delete(write);
  const identity = valueChunkWriteIdentity(write);
  settlement().readyValueChunkWrites.add(identity);
  return true;
}

/** Authenticate retained observations against one exact compiler/planner write identity. */
export function persistedValueChunkWriteState(
  write: ValueChunkWriteDescriptor,
): { value: Uint8Array; lockingBytecode: Uint8Array; width: number; recipe: {
    slot: Uint8Array; root: Uint8Array; collection: string; categoryId: string;
  } } | undefined {
  const identity = valueChunkWriteIdentity(write);
  const cached = settlement().persistedValueChunkWrites.get(identity);
  if (cached) return cached;
  const currentValue = settlement().persistedJobEventsValues.get(write.categoryId);
  const currentLock = settlement().persistedJobEventsLocks.get(write.categoryId);
  const candidates = [...(settlement().observedValueChunkStatesByCategory.get(write.categoryId)?.values() ?? [])];
  if (currentValue && currentLock) candidates.push({ value: currentValue, lockingBytecode: currentLock });
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const { value, lockingBytecode } = candidates[index];
    if (!rememberValueChunkUnlockRecipe(write, value, lockingBytecode)) continue;
    return settlement().persistedValueChunkWrites.get(identity);
  }
  return undefined;
}

/** Select one authenticated persisted/staged resource, collapsing duplicate physical/logical descriptions. */
export function selectPersistedValueChunkWrite(
  writes: ReadonlyArray<ValueChunkWriteDescriptor>,
  categoryId?: string,
  session = settlement().valueChunkWriteStaging,
): ValueChunkWriteDescriptor | undefined {
  // INSERT must be eligible: first publishJobEvent stages the JobEventData[] blob before
  // the nested probe has a full root-matching value on the stack.
  const candidates = writes.filter((write) => (
    (write.operation === 'update' || write.operation === 'insert')
    && (categoryId === undefined || write.categoryId === categoryId)
    && (stagedValueChunkWrite(write, session) !== undefined || persistedValueChunkWriteState(write) !== undefined)
  ));
  const identities = new Map(candidates.map((write) => [valueChunkWriteIdentity(write), write]));
  return identities.size === 1 ? [...identities.values()][0] : undefined;
}

/**
 * UPDATE rematerialization must reuse the persist redeem lock the impl
 * EQUALVERIFYs (`getValueChunkLockingBytecode` of the Created root), not
 * `aa20||sha256(v)||87` and not a consumed UTXO's previous physical lock.
 */
export function persistUpdateRedeemLock(
  categoryId: string | undefined,
  sessionLock?: Uint8Array,
  write?: ValueChunkWriteDescriptor | null,
): Uint8Array | undefined {
  if (write === null) return undefined;
  if (write) {
    const exact = persistedValueChunkWriteState(write)?.lockingBytecode;
    if (!exact) return undefined;
    if (sessionLock && sessionLock.length === 35 && sessionLock[0] === 0xaa && sessionLock[34] === 0x87
      && binToHex(sessionLock) === binToHex(exact)) return sessionLock;
    return exact;
  }
  if (sessionLock && sessionLock.length === 35 && sessionLock[0] === 0xaa && sessionLock[34] === 0x87) {
    return sessionLock;
  }
  if (!categoryId) return undefined;
  // Compatibility only: callers which have not attached an exact value-chunk descriptor retain the legacy
  // category/name recipe. New transaction geometry must pass `write` and cannot enter this fallback.
  const recipe = persistedJobEventsUnlockRecipe(categoryId);
  if (recipe) {
    try {
      return getValueChunkLockingBytecode(categoryId, recipe.collection, recipe.slot, recipe.root);
    } catch { /* invalid recipe */ }
    try {
      return getValueChunkLockingBytecode(recipe.categoryId, recipe.collection, recipe.slot, recipe.root);
    } catch { /* invalid recipe */ }
  }
  return persistedJobEventsLock(categoryId);
}

/** True only after a successful publishJobEvent send, not compose/extract. */
export function isPersistedJobEventsReady(): boolean {
  return settlement().persistedJobEventsSendReady;
}
