import {
  encodePushdataValue,
  KERNEL_ENTRY_JOURNAL_MAX_RECORDS,
  KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX,
  KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT,
  MAX_MESSAGE_BUS_BLOB_BYTES,
  type JournalSettlementIdentityAbi,
} from '@solidcash/utils';
export {
  KERNEL_ENTRY_JOURNAL_MAX_RECORDS,
  KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS,
  KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX,
  KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT,
} from '@solidcash/utils';
import {
  SortedList,
  type JournaledMutationAccess,
  type JournaledMutationPlan,
  type JournaledMutationRecord,
  type JournaledMutationResult,
  type JournaledUpsert,
} from './SortedList.js';

/** Canonical record tag, distinct from runtime event/BCH/FT/NFT effect tags 0x01..0x04. */
export const KERNEL_ENTRY_JOURNAL_TAG = 0x05;

/** Compact per-stream record-selection program consumed by a kernel row. */
export const KERNEL_ENTRY_JOURNAL_ACCESS_TAG = 0x06;

/** Entry NFT commitments are capped at 128 bytes: slot + next slot + at most 64 bytes of value tail. */
export const KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES = 64;

/** Return the stable compiler-owned input name for one zero-based journal record segment. */
export function kernelEntryJournalRecordSegmentName(segmentIndex: number): string {
  if (!Number.isSafeInteger(segmentIndex) || segmentIndex < 0) {
    throw new Error('kernel entry journal segment index must be a non-negative safe integer');
  }
  return `${KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX}${segmentIndex}`;
}

/** Parse a canonical compiler-owned segment input name, rejecting aliases such as `_00`. */
export function kernelEntryJournalRecordSegmentIndex(name: string): number | undefined {
  if (!name.startsWith(KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX)) return undefined;
  const suffix = name.slice(KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX.length);
  if (!/^(0|[1-9][0-9]*)$/.test(suffix)) {
    throw new Error(`kernel entry journal segment input '${name}' has a non-canonical index`);
  }
  const segmentIndex = Number(suffix);
  if (!Number.isSafeInteger(segmentIndex)) {
    throw new Error(`kernel entry journal segment input '${name}' exceeds the safe index range`);
  }
  return segmentIndex;
}

const COLLECTION_HASH_BYTES = 20;
const SLOT_BYTES = 32;
const HEADER_BYTES = 2 + COLLECTION_HASH_BYTES + SLOT_BYTES * 2;
const FLAG_AUTHENTICATED = 1 << 0;
const FLAG_DIRTY = 1 << 1;
const FLAG_TOMBSTONE = 1 << 2;
const FLAG_SYNTHETIC = 1 << 3;
const KNOWN_FLAGS = FLAG_AUTHENTICATED | FLAG_DIRTY | FLAG_TOMBSTONE | FLAG_SYNTHETIC;

const ACCESS_HEADER_BYTES = 2 + COLLECTION_HASH_BYTES;
const ACCESS_BYTES = 5;
const ACCESS_FLAG_PRESENT_BEFORE = 1 << 0;
const ACCESS_FLAG_PRESENT_AFTER = 1 << 1;
const ACCESS_FLAG_HAS_PREDECESSOR = 1 << 2;
const ACCESS_FLAG_MUTATES = 1 << 3;
const ACCESS_FLAG_AUTHENTICATES_TARGET = 1 << 4;
const ACCESS_FLAG_AUTHENTICATES_PREDECESSOR = 1 << 5;
/** The access participates in a transaction-local dependency and must publish/consume a dirty carrier. */
const ACCESS_FLAG_PENDING = 1 << 6;
const KNOWN_ACCESS_FLAGS = ACCESS_FLAG_PRESENT_BEFORE
  | ACCESS_FLAG_PRESENT_AFTER | ACCESS_FLAG_HAS_PREDECESSOR | ACCESS_FLAG_MUTATES
  | ACCESS_FLAG_AUTHENTICATES_TARGET | ACCESS_FLAG_AUTHENTICATES_PREDECESSOR | ACCESS_FLAG_PENDING;
const NO_PREDECESSOR = 0xffff;
/** `tag || count || N * (flags || target-u16le || predecessor-u16le)` must remain one BCH item. */
export const KERNEL_ENTRY_JOURNAL_MAX_ACCESSES = Math.floor((520 - ACCESS_HEADER_BYTES) / ACCESS_BYTES);

/**
 * Explicit protocol-wide transport/indexing ceiling across all access streams. It is aligned as a deliberate v1
 * budget with the reviewed one-stream access ceiling so permissive compiler profiles cannot create unbounded
 * hidden ABIs; several streams may collectively request more records, in which case admission fails closed at
 * this global cap. Finalized transactions remain subject to independent BCH size and cost checks.
 */
if (KERNEL_ENTRY_JOURNAL_MAX_RECORDS !== KERNEL_ENTRY_JOURNAL_MAX_ACCESSES) {
  throw new Error('kernel entry journal record and compact-access protocol caps diverged');
}

export interface KernelEntryJournalRecord {
  /** Hash of the collection signature; combined with the owner category to derive its entry covenant address. */
  collectionHash: Uint8Array;
  slot: Uint8Array;
  nextKey: Uint8Array;
  value: Uint8Array;
  /** This node was authenticated from one unique physical pre-state input. */
  authenticated: boolean;
  /** The final flush must recreate this node unless it is a tombstone. */
  dirty: boolean;
  /** The logical node has been removed; its predecessor carries the final successor link. */
  tombstone: boolean;
  /** The node was introduced by this journal and has no physical pre-state input. */
  synthetic: boolean;
}

export interface KernelEntryJournalStreamPlan {
  /** One collection-wide plan, preserving pending values and topology across row/loop stream boundaries. */
  mutationPlan: JournaledMutationPlan;
  /** Independently bounded record carriers, shared by every access stream in this collection plan. */
  encodedRecords: Uint8Array[];
  /** One compact access program for each source stream, in the same order as the input stream vector. */
  encodedAccessStreams: Uint8Array[];
}

export type KernelEntryJournalAccess = JournaledMutationAccess & {
  /** This access or an earlier producer it depends on must use the route-final carrier settlement protocol. */
  pending?: true;
};

/**
 * Value-independent operation classes used while assigning stable access ordinals. A SolidCash mapping `delete`
 * is a default-value write and therefore uses `write`; `remove` is reserved for an actual linked-list splice.
 */
export type KernelEntryJournalTopologyOperation = 'read' | 'write' | 'remove';

export interface KernelEntryJournalAccessTopologyPlan {
  /** Number of first-touch records addressed by every stream in this plan. */
  recordCount: number;
  /**
   * Truthful topology-phase carriers in the same first-touch ordinal space as the access programs. Existing
   * records are exactly clean+authenticated; absent records are exactly clean+synthetic+tombstone with no value
   * or successor. Dirty carrier forms are reserved for a future covenant-verified final-flush phase.
   */
  encodedRecords: Uint8Array[];
  /** One compact access program for each source stream. */
  encodedAccessStreams: Uint8Array[];
}

export interface KernelEntryJournalSettlementOccurrence {
  /** Selected invocation/frame owning the compiler-local stream index. */
  frameIndex: number;
  /** Compiler-published identity recipe for the containing compact access stream. */
  identity: JournalSettlementIdentityAbi;
  /** Zero-based position in that stream's compact access program. */
  accessOrdinal: number;
  /** Runtime access after collection-local ordinals have been remapped into the transaction-wide carrier space. */
  access: KernelEntryJournalAccess;
}

export interface KernelEntryJournalSettlementStream {
  /** Compiler-published control-flow group, already scoped to the selected invocation frame. */
  executionGroup: string;
  /** Whether this stream contains at least one operation capable of mutating the journal. */
  mutates: boolean;
  /** Stable compiler-published settlement recipe, when emitted by the artifact version. */
  identity?: JournalSettlementIdentityAbi;
}

/**
 * Enforce the compatibility boundary for transaction-wide record ordinals. Legacy artifacts remain valid for a
 * singleton mutation stream, where collection-local and global record identity cannot be confused. Once multiple
 * mutation streams share an execution group, every stream in that group must explicitly authenticate the global
 * journal ordinal domain used by scheduling and last-mutating settlement ownership.
 */
export function validateKernelEntryJournalSettlementGroups(
  streams: readonly KernelEntryJournalSettlementStream[],
): void {
  const groups = new Map<string, KernelEntryJournalSettlementStream[]>();
  for (const stream of streams) {
    const group = groups.get(stream.executionGroup) ?? [];
    group.push(stream);
    groups.set(stream.executionGroup, group);
  }
  for (const [executionGroup, group] of groups) {
    if (group.filter((stream) => stream.mutates).length < 2) continue;
    if (group.some((stream) => stream.identity?.recordOrdinalScope !== 'global-journal')) {
      throw new Error(
        `kernel journal execution group '${executionGroup}' has multiple mutation streams without authenticated `
        + 'global record ordinals',
      );
    }
  }
}

export interface KernelEntryJournalSettlementReference {
  frameIndex: number;
  accessStreamIndex: number;
  accessOrdinal: number;
  recordOrdinal: number;
  recordRole: 'target' | 'predecessor';
  settlementRole: JournalSettlementIdentityAbi['settlementRole'];
  /** Final logical disposition; absence has settlement authority but deliberately no physical NFT output. */
  settlementDisposition: 'present-output' | 'absence';
}

export interface KernelEntryJournalSettlementPlan {
  /** Every authenticated record reference, in caller-supplied execution order. */
  references: KernelEntryJournalSettlementReference[];
  /** Unique final settlement authority per mutated runtime record ordinal. */
  settlementAuthorities: ReadonlyMap<number, KernelEntryJournalSettlementReference>;
  /** Final logical disposition and provenance for every referenced record, including clean carriers. */
  recordDispositions: ReadonlyMap<number, {
    reference: KernelEntryJournalSettlementReference;
    basis: 'mutation-settlement' | 'authenticated-carrier' | 'origin-carrier';
  }>;
}

export interface KernelEntryJournalSettlementOutputSegment {
  collection: string;
  offset: number;
  count: number;
}

/**
 * Consume compiler-published settlement recipes against concrete compact access programs.
 *
 * The compiler binds the stream and permitted record roles; runtime topology supplies the actual record ordinals.
 * Callers must provide occurrences in source execution order. Replacing the authority on each mutating reference
 * implements the published `last-mutating-access` rule without using collection iteration order, commitment-vector
 * position, or a best-effort slot scan as the semantic settlement identity.
 */
export function planKernelEntryJournalSettlementAuthority(
  occurrences: readonly KernelEntryJournalSettlementOccurrence[],
): KernelEntryJournalSettlementPlan {
  const streamRecipes = new Map<string, string>();
  const ordinalsByStream = new Map<string, Set<number>>();
  const references: KernelEntryJournalSettlementReference[] = [];
  const settlementAuthorities = new Map<number, KernelEntryJournalSettlementReference>();
  const origins = new Map<number, KernelEntryJournalSettlementReference>();
  const authenticatedCarriers = new Map<number, KernelEntryJournalSettlementReference>();
  for (const { frameIndex, identity, accessOrdinal, access } of occurrences) {
    if (!Number.isSafeInteger(frameIndex) || frameIndex < 0) {
      throw new Error('kernel journal settlement identity has an invalid frame index');
    }
    if (!Number.isSafeInteger(identity.accessStreamIndex) || identity.accessStreamIndex < 0) {
      throw new Error('kernel journal settlement identity has an invalid access stream index');
    }
    if (identity.recordOrdinalScope !== undefined && identity.recordOrdinalScope !== 'global-journal') {
      throw new Error('kernel journal settlement identity has an unsupported record ordinal scope');
    }
    if (identity.accessOrdinalSource !== 'access-program-order'
      || identity.recordOrdinalSources.length !== 2
      || identity.recordOrdinalSources[0] !== 'target-record-ordinal'
      || identity.recordOrdinalSources[1] !== 'predecessor-record-ordinal') {
      throw new Error('kernel journal settlement identity has an unsupported record recipe');
    }
    if ((identity.settlementRole === 'carrier-only') !== (identity.settlementOwnership === 'none')
      || (identity.settlementRole === 'mutation-settlement')
        !== (identity.settlementOwnership === 'last-mutating-access')) {
      throw new Error('kernel journal settlement identity has an inconsistent settlement ownership rule');
    }
    const recipe = [
      identity.accessStreamIndex,
      identity.recordOrdinalScope ?? 'legacy-single-stream',
      identity.accessOrdinalSource,
      identity.recordOrdinalSources[0],
      identity.recordOrdinalSources[1],
      identity.settlementRole,
      identity.settlementOwnership,
    ].join('\0');
    const scopedStream = `${frameIndex}:${identity.accessStreamIndex}`;
    const priorRecipe = streamRecipes.get(scopedStream);
    if (priorRecipe !== undefined && priorRecipe !== recipe) {
      throw new Error(`kernel journal settlement stream ${identity.accessStreamIndex} changes identity recipe`);
    }
    streamRecipes.set(scopedStream, recipe);
    if (!Number.isSafeInteger(accessOrdinal) || accessOrdinal < 0) {
      throw new Error('kernel journal settlement access ordinal must be a non-negative safe integer');
    }
    const streamOrdinals = ordinalsByStream.get(scopedStream) ?? new Set<number>();
    if (streamOrdinals.has(accessOrdinal)) {
      throw new Error(
        `kernel journal settlement stream ${identity.accessStreamIndex} repeats access ordinal ${accessOrdinal}`,
      );
    }
    if (accessOrdinal !== streamOrdinals.size) {
      throw new Error(
        `kernel journal settlement stream ${identity.accessStreamIndex} expected access ordinal `
        + `${streamOrdinals.size}, received ${accessOrdinal}`,
      );
    }
    streamOrdinals.add(accessOrdinal);
    ordinalsByStream.set(scopedStream, streamOrdinals);
    if ((identity.settlementRole === 'mutation-settlement') !== access.mutates) {
      throw new Error(
        `kernel journal settlement stream ${identity.accessStreamIndex} settlement role disagrees with its access`,
      );
    }
    const append = (recordOrdinal: number, recordRole: 'target' | 'predecessor'): void => {
      requireRecordOrdinal(`${recordRole}RecordOrdinal`, recordOrdinal);
      const reference: KernelEntryJournalSettlementReference = {
        frameIndex,
        accessStreamIndex: identity.accessStreamIndex,
        accessOrdinal,
        recordOrdinal,
        recordRole,
        settlementRole: identity.settlementRole,
        settlementDisposition: recordRole === 'predecessor' || access.presentAfter
          ? 'present-output' : 'absence',
      };
      references.push(reference);
      if (!origins.has(recordOrdinal)) origins.set(recordOrdinal, reference);
      const authenticatesRecord = recordRole === 'target'
        ? access.authenticatesTarget === true : access.authenticatesPredecessor === true;
      if (authenticatesRecord) {
        if (authenticatedCarriers.has(recordOrdinal)) {
          throw new Error(`kernel journal record ${recordOrdinal} has multiple authenticating access identities`);
        }
        authenticatedCarriers.set(recordOrdinal, reference);
      }
      const changesRecord = access.mutates && (recordRole === 'target'
        || access.presentBefore !== access.presentAfter);
      if (changesRecord) settlementAuthorities.set(recordOrdinal, reference);
    };
    append(access.targetRecordOrdinal, 'target');
    if (access.predecessorRecordOrdinal !== undefined) {
      append(access.predecessorRecordOrdinal, 'predecessor');
    }
  }
  const recordDispositions = new Map<number, {
    reference: KernelEntryJournalSettlementReference;
    basis: 'mutation-settlement' | 'authenticated-carrier' | 'origin-carrier';
  }>();
  for (const [recordOrdinal, origin] of origins) {
    const mutation = settlementAuthorities.get(recordOrdinal);
    const authenticated = authenticatedCarriers.get(recordOrdinal);
    recordDispositions.set(recordOrdinal, mutation
      ? { reference: mutation, basis: 'mutation-settlement' }
      : authenticated
        ? { reference: authenticated, basis: 'authenticated-carrier' }
        : { reference: origin, basis: 'origin-carrier' });
  }
  return { references, settlementAuthorities, recordDispositions };
}

/**
 * Resolve authenticated record dispositions into the physical contiguous settlement band. Present records are
 * emitted as a dense subsequence of global record-ordinal order, even when collections or access streams interleave.
 * An absence disposition (a deleted/tombstoned target) is settled without emitting an NFT.
 */
export function planKernelEntryJournalSettlementOutputSegments(
  plan: KernelEntryJournalSettlementPlan,
  resolve: (authority: KernelEntryJournalSettlementReference) => {
    collection: string; offset: number;
  },
): KernelEntryJournalSettlementOutputSegment[] {
  const segments: KernelEntryJournalSettlementOutputSegment[] = [];
  const usedLocations = new Set<string>();
  const ordered = [...plan.recordDispositions.entries()]
    .sort(([left], [right]) => left - right);
  for (const [recordOrdinal, disposition] of ordered) {
    const { reference } = disposition;
    if (reference.recordOrdinal !== recordOrdinal) {
      throw new Error('kernel journal record disposition aliases a different record ordinal');
    }
    if (reference.settlementDisposition === 'absence') continue;
    const { collection, offset } = resolve(reference);
    if (!collection || !Number.isSafeInteger(offset) || offset < 0) {
      throw new Error(`kernel journal settlement record ${recordOrdinal} has an invalid physical output location`);
    }
    const locationIdentity = `${collection}\0${offset}`;
    if (usedLocations.has(locationIdentity)) {
      throw new Error(`kernel journal settlement record ${recordOrdinal} aliases a physical output location`);
    }
    usedLocations.add(locationIdentity);
    const previous = segments[segments.length - 1];
    if (previous?.collection === collection && previous.offset + previous.count === offset) previous.count += 1;
    else segments.push({ collection, offset, count: 1 });
  }
  return segments;
}

export interface KernelEntryJournalRecordPosition {
  /** Zero-based independently-pushed carrier segment. */
  segmentIndex: number;
  /** Zero-based record position inside `segmentIndex`. */
  segmentRecordIndex: number;
}

export interface KernelEntryJournalSegmentValidationOptions {
  /** Bind an authenticated external cardinality to the complete segmented vector. */
  expectedRecordCount?: number;
  /** Route-entry witnesses must be clean; dirty records exist only after kernel execution. */
  transportOnly?: boolean;
}

function requireIdentity(name: string, value: Uint8Array, length: number): void {
  if (value.length !== length) throw new Error(`${name} must be exactly ${length} bytes`);
}

/**
 * Encode one independently bounded pending-entry record:
 * `0x05 || flags || collectionHash20 || slot32 || nextKey32 || valueTail`.
 */
export function encodeKernelEntryJournalRecord(record: KernelEntryJournalRecord): Uint8Array {
  requireIdentity('collectionHash', record.collectionHash, COLLECTION_HASH_BYTES);
  requireIdentity('slot', record.slot, SLOT_BYTES);
  requireIdentity('nextKey', record.nextKey, SLOT_BYTES);
  if (record.value.length > KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES) {
    throw new Error(`journal value tail exceeds ${KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES} bytes`);
  }
  if (record.authenticated && record.synthetic) {
    throw new Error('a journal node cannot be both authenticated and synthetic');
  }
  if (!record.authenticated && !record.synthetic) {
    throw new Error('a journal node must be either authenticated or synthetic');
  }
  if (record.synthetic && !record.dirty && !record.tombstone) {
    throw new Error('a clean synthetic journal node must be an absence tombstone');
  }
  if (record.tombstone && !record.dirty && !record.synthetic) {
    throw new Error('a clean journal tombstone must describe an unauthenticated synthetic record');
  }
  if (record.tombstone && record.value.length !== 0) {
    throw new Error('a journal tombstone cannot carry a value');
  }
  if (record.synthetic && !record.dirty && record.nextKey.some((byte) => byte !== 0)) {
    throw new Error('a clean synthetic journal tombstone must use the zero successor');
  }
  let flags = 0;
  if (record.authenticated) flags |= FLAG_AUTHENTICATED;
  if (record.dirty) flags |= FLAG_DIRTY;
  if (record.tombstone) flags |= FLAG_TOMBSTONE;
  if (record.synthetic) flags |= FLAG_SYNTHETIC;
  const encoded = new Uint8Array(HEADER_BYTES + record.value.length);
  encoded[0] = KERNEL_ENTRY_JOURNAL_TAG;
  encoded[1] = flags;
  encoded.set(record.collectionHash, 2);
  encoded.set(record.slot, 2 + COLLECTION_HASH_BYTES);
  encoded.set(record.nextKey, 2 + COLLECTION_HASH_BYTES + SLOT_BYTES);
  encoded.set(record.value, HEADER_BYTES);
  return encoded;
}

export function decodeKernelEntryJournalRecord(encoded: Uint8Array): KernelEntryJournalRecord {
  if (encoded.length < HEADER_BYTES) throw new Error('kernel entry journal record is truncated');
  if (encoded.length > HEADER_BYTES + KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES) {
    throw new Error(`journal value tail exceeds ${KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES} bytes`);
  }
  if (encoded[0] !== KERNEL_ENTRY_JOURNAL_TAG) throw new Error('invalid kernel entry journal record tag');
  const flags = encoded[1];
  if ((flags & ~KNOWN_FLAGS) !== 0) throw new Error('kernel entry journal record has unknown flags');
  const authenticated = (flags & FLAG_AUTHENTICATED) !== 0;
  const dirty = (flags & FLAG_DIRTY) !== 0;
  const tombstone = (flags & FLAG_TOMBSTONE) !== 0;
  const synthetic = (flags & FLAG_SYNTHETIC) !== 0;
  if (authenticated && synthetic) throw new Error('a journal node cannot be both authenticated and synthetic');
  if (!authenticated && !synthetic) {
    throw new Error('a journal node must be either authenticated or synthetic');
  }
  if (synthetic && !dirty && !tombstone) {
    throw new Error('a clean synthetic journal node must be an absence tombstone');
  }
  if (tombstone && !dirty && !synthetic) {
    throw new Error('a clean journal tombstone must describe an unauthenticated synthetic record');
  }
  if (tombstone && encoded.length !== HEADER_BYTES) {
    throw new Error('a journal tombstone cannot carry a value');
  }
  const nextKey = encoded.slice(2 + COLLECTION_HASH_BYTES + SLOT_BYTES, HEADER_BYTES);
  if (synthetic && !dirty && nextKey.some((byte) => byte !== 0)) {
    throw new Error('a clean synthetic journal tombstone must use the zero successor');
  }
  return {
    collectionHash: encoded.slice(2, 2 + COLLECTION_HASH_BYTES),
    slot: encoded.slice(2 + COLLECTION_HASH_BYTES, 2 + COLLECTION_HASH_BYTES + SLOT_BYTES),
    nextKey,
    value: encoded.slice(HEADER_BYTES),
    authenticated,
    dirty,
    tombstone,
    synthetic,
  };
}

/**
 * Validate the record vector accepted by the transport-only kernel route.
 *
 * Dirty records describe an in-progress state transition. They are valid only after compiler-generated route
 * execution has authenticated and transformed a clean carrier; accepting one from the caller would bypass that
 * provenance check. Transport therefore admits only clean authenticated records and clean synthetic tombstones.
 */
export function validateKernelEntryJournalTransportRecords(
  encodedRecords: readonly Uint8Array[],
): KernelEntryJournalRecord[] {
  return encodedRecords.map((encoded) => {
    const record = decodeKernelEntryJournalRecord(encoded);
    if (record.dirty) {
      throw new Error('dirty kernel entry journal records require final-flush settlement');
    }
    return record;
  });
}

function encodedKernelEntryJournalSegmentLength(segment: readonly Uint8Array[]): number {
  return encodePushdataValue([...segment], 'bytes[]').length;
}

/** Encode one canonical record vector as the opaque, independently bounded wire carrier. */
export function encodeKernelEntryJournalRecordSegment(segment: readonly Uint8Array[]): Uint8Array {
  return encodePushdataValue([...segment], 'bytes[]');
}

function requireSegmentRecordCount(recordCount: number): void {
  if (!Number.isSafeInteger(recordCount) || recordCount < 0
    || recordCount > KERNEL_ENTRY_JOURNAL_MAX_RECORDS) {
    throw new Error(
      `kernel entry journal segmented record count must not exceed ${KERNEL_ENTRY_JOURNAL_MAX_RECORDS}`,
    );
  }
}

/**
 * Map one stable global first-touch ordinal to its value-independent segmented carrier position.
 */
export function kernelEntryJournalRecordPosition(
  ordinal: number,
  recordCount: number,
): KernelEntryJournalRecordPosition {
  requireSegmentRecordCount(recordCount);
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= recordCount) {
    throw new Error('kernel entry journal global record ordinal is out of range');
  }
  return {
    segmentIndex: Math.floor(ordinal / KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT),
    segmentRecordIndex: ordinal % KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT,
  };
}

/**
 * Split a record vector without changing its global first-touch ordinal space. Every non-final segment has the
 * fixed capacity, and the final segment is non-empty. This unique partition is safe under later record mutation:
 * segment membership never depends on a record's current encoded length.
 */
export function segmentKernelEntryJournalRecords(
  encodedRecords: readonly Uint8Array[],
): Uint8Array[][] {
  requireSegmentRecordCount(encodedRecords.length);
  encodedRecords.forEach(decodeKernelEntryJournalRecord);
  const segments: Uint8Array[][] = [];
  for (let offset = 0; offset < encodedRecords.length; offset += KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT) {
    const segment = encodedRecords.slice(offset, offset + KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT)
      .map((record) => new Uint8Array(record));
    if (encodedKernelEntryJournalSegmentLength(segment) > MAX_MESSAGE_BUS_BLOB_BYTES) {
      throw new Error('kernel entry journal segment exceeds the 520-byte BCH stack-item limit');
    }
    segments.push(segment);
  }
  return segments;
}

/**
 * Validate the canonical non-empty segmented prefix and return its global-ordinal record vector. Swapped,
 * duplicated, or omitted records remain visible in that vector for the route's authenticated access-program
 * identity checks; this layer binds exact cardinality, framing, and the one permissible segment partition.
 */
export function validateKernelEntryJournalRecordSegments(
  segments: readonly (readonly Uint8Array[])[],
  options: KernelEntryJournalSegmentValidationOptions = {},
): KernelEntryJournalRecord[] {
  if (segments.some((segment) => segment.length === 0)) {
    throw new Error('kernel entry journal segments must form a non-empty prefix');
  }
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment.length > KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT
      || (index + 1 < segments.length && segment.length !== KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT)) {
      throw new Error('kernel entry journal segments use a non-canonical record partition');
    }
    if (encodedKernelEntryJournalSegmentLength(segment) > MAX_MESSAGE_BUS_BLOB_BYTES) {
      throw new Error('kernel entry journal segment exceeds the 520-byte BCH stack-item limit');
    }
  }
  const encodedRecords = segments.flatMap((segment) => [...segment]);
  requireSegmentRecordCount(encodedRecords.length);
  if (options.expectedRecordCount !== undefined) {
    requireSegmentRecordCount(options.expectedRecordCount);
    if (encodedRecords.length !== options.expectedRecordCount) {
      throw new Error('kernel entry journal segment cardinality does not match the authenticated record count');
    }
  }
  return options.transportOnly
    ? validateKernelEntryJournalTransportRecords(encodedRecords)
    : encodedRecords.map(decodeKernelEntryJournalRecord);
}

/**
 * Validate a compiler-provisioned segment slot vector. `segmentCount` is the authenticated active prefix:
 * exactly those slots are non-empty and every remaining capacity slot is the canonical empty array.
 */
export function validateKernelEntryJournalRecordSegmentSlots(
  slots: readonly (readonly Uint8Array[])[],
  segmentCount: number,
  options: KernelEntryJournalSegmentValidationOptions = {},
): KernelEntryJournalRecord[] {
  if (!Number.isSafeInteger(segmentCount) || segmentCount < 0 || segmentCount > slots.length) {
    throw new Error('kernel entry journal segment count is out of range');
  }
  for (let index = 0; index < slots.length; index += 1) {
    if ((index < segmentCount) !== (slots[index].length > 0)) {
      throw new Error('kernel entry journal segment slots must use the authenticated non-empty prefix');
    }
  }
  return validateKernelEntryJournalRecordSegments(slots.slice(0, segmentCount), options);
}

/** Encode a planner's first-touch-ordered records for one collection into the exact covenant carrier format. */
export function encodeKernelEntryJournalRecords(
  collectionHash: Uint8Array,
  records: readonly JournaledMutationRecord[],
): Uint8Array[] {
  requireIdentity('collectionHash', collectionHash, COLLECTION_HASH_BYTES);
  return records.map((record) => encodeKernelEntryJournalRecord({
    collectionHash,
    slot: record.slot,
    nextKey: record.nextKey,
    value: record.value,
    authenticated: record.authenticated,
    dirty: record.dirty,
    tombstone: record.tombstone,
    synthetic: record.synthetic,
  }));
}

/**
 * Plan all row/loop streams for one collection as one ordered transition, then split only the compact access
 * programs back at their source boundaries. Flattening before planning is essential: a later stream must observe
 * the pending value and predecessor topology produced by every earlier stream, while all streams address one
 * collection-wide first-touch record ordinal space.
 */
export function planKernelEntryJournalStreams<T>(
  list: SortedList,
  collectionHash: Uint8Array,
  streams: readonly (readonly JournaledUpsert<T>[])[],
  reduce: (current: Uint8Array | undefined, operation: T, slot: Uint8Array) => Uint8Array | undefined,
): KernelEntryJournalStreamPlan {
  const streamLengths = streams.map((stream) => stream.length);
  const mutationPlan = list.planJournaledMutations(streams.flat(), reduce);
  let accessOffset = 0;
  const encodedAccessStreams = streamLengths.map((length) => {
    const streamAccesses = mutationPlan.accesses.slice(accessOffset, accessOffset + length);
    accessOffset += length;
    return encodeKernelEntryJournalAccesses(collectionHash, streamAccesses);
  });
  return {
    mutationPlan,
    encodedRecords: encodeKernelEntryJournalRecords(collectionHash, mutationPlan.records),
    encodedAccessStreams,
  };
}

/**
 * Plan record selection before concrete values are available. This intentionally returns no record carriers:
 * placeholder values are sufficient to determine presence, predecessor topology, and first-touch ordinals, but
 * must never be confused with the final values emitted by `planKernelEntryJournalStreams`.
 */
export function planKernelEntryJournalAccessTopology(
  list: SortedList,
  collectionHash: Uint8Array,
  streams: readonly (readonly JournaledUpsert<KernelEntryJournalTopologyOperation>[])[],
): KernelEntryJournalAccessTopologyPlan {
  requireIdentity('collectionHash', collectionHash, COLLECTION_HASH_BYTES);
  const preserve = (current: Uint8Array | undefined): JournaledMutationResult => ({
    value: current,
    dirty: false,
  });
  const streamLengths = streams.map((stream) => stream.length);
  const mutationPlan = list.planJournaledMutations(
    streams.flat(),
    (current, operation) => operation === 'read' ? preserve(current)
      : operation === 'remove' ? undefined : new Uint8Array(),
  );
  let accessOffset = 0;
  return {
    recordCount: mutationPlan.records.length,
    // Topology planning intentionally does not claim final values. Existing records carry their exact authenticated
    // pre-state commitment, while absent targets are clean synthetic tombstones. The covenant may transition these
    // records in source order later; neither form can be mistaken for an already-settled dirty output.
    encodedRecords: mutationPlan.records.map((record) => {
      const original = list.find(record.slot);
      return encodeKernelEntryJournalRecord(original ? {
        collectionHash,
        slot: original.slot,
        nextKey: original.nextKey,
        value: original.value,
        authenticated: true,
        dirty: false,
        tombstone: false,
        synthetic: false,
      } : {
        collectionHash,
        slot: record.slot,
        nextKey: new Uint8Array(SLOT_BYTES),
        value: new Uint8Array(),
        authenticated: false,
        dirty: false,
        tombstone: true,
        synthetic: true,
      });
    }),
    encodedAccessStreams: streamLengths.map((length) => {
      const accesses = mutationPlan.accesses.slice(accessOffset, accessOffset + length);
      accessOffset += length;
      return encodeKernelEntryJournalAccesses(collectionHash, accesses);
    }),
  };
}

function requireRecordOrdinal(name: string, ordinal: number): void {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= NO_PREDECESSOR) {
    throw new Error(`${name} must be an unsigned 16-bit journal record ordinal below 65535`);
  }
}

/**
 * Encode one row-owned mutation stream. Record identities stay in independently bounded `0x05` items; this
 * compact program only selects their stable first-touch ordinals and states whether the operation inserts,
 * updates, deletes, or observes absence. Canonical counter streams contain at most 64 operations, while the
 * format remains valid up to the largest fixed-width program which fits one 520-byte BCH stack item.
 */
export function encodeKernelEntryJournalAccesses(
  collectionHash: Uint8Array,
  accesses: readonly KernelEntryJournalAccess[],
): Uint8Array {
  requireIdentity('collectionHash', collectionHash, COLLECTION_HASH_BYTES);
  if (accesses.length > KERNEL_ENTRY_JOURNAL_MAX_ACCESSES) {
    throw new Error(
      `kernel entry journal access stream exceeds ${KERNEL_ENTRY_JOURNAL_MAX_ACCESSES} operations`,
    );
  }
  const encoded = new Uint8Array(ACCESS_HEADER_BYTES + accesses.length * ACCESS_BYTES);
  encoded[0] = KERNEL_ENTRY_JOURNAL_ACCESS_TAG;
  encoded[1] = accesses.length;
  encoded.set(collectionHash, 2);
  accesses.forEach((access, index) => {
    requireRecordOrdinal('targetRecordOrdinal', access.targetRecordOrdinal);
    if (access.predecessorRecordOrdinal !== undefined) {
      requireRecordOrdinal('predecessorRecordOrdinal', access.predecessorRecordOrdinal);
      if (access.predecessorRecordOrdinal === access.targetRecordOrdinal) {
        throw new Error('journal target and predecessor record ordinals must differ');
      }
    }
    const requiresPredecessor = !access.presentBefore || !access.presentAfter;
    if ((access.predecessorRecordOrdinal !== undefined) !== requiresPredecessor) {
      throw new Error('journal access predecessor presence must match its topology transition');
    }
    if (!access.mutates && access.presentBefore !== access.presentAfter) {
      throw new Error('a non-mutating journal access must preserve target presence');
    }
    if (access.authenticatesPredecessor && access.predecessorRecordOrdinal === undefined) {
      throw new Error('journal access cannot authenticate an absent predecessor');
    }
    if (access.authenticatesTarget && !access.presentBefore) {
      throw new Error('journal access cannot authenticate an absent target');
    }
    let flags = 0;
    if (access.presentBefore) flags |= ACCESS_FLAG_PRESENT_BEFORE;
    if (access.presentAfter) flags |= ACCESS_FLAG_PRESENT_AFTER;
    if (access.predecessorRecordOrdinal !== undefined) flags |= ACCESS_FLAG_HAS_PREDECESSOR;
    if (access.mutates) flags |= ACCESS_FLAG_MUTATES;
    if (access.authenticatesTarget) flags |= ACCESS_FLAG_AUTHENTICATES_TARGET;
    if (access.authenticatesPredecessor) flags |= ACCESS_FLAG_AUTHENTICATES_PREDECESSOR;
    if (access.pending) flags |= ACCESS_FLAG_PENDING;
    const offset = ACCESS_HEADER_BYTES + index * ACCESS_BYTES;
    const predecessor = access.predecessorRecordOrdinal ?? NO_PREDECESSOR;
    encoded[offset] = flags;
    encoded[offset + 1] = access.targetRecordOrdinal & 0xff;
    encoded[offset + 2] = access.targetRecordOrdinal >>> 8;
    encoded[offset + 3] = predecessor & 0xff;
    encoded[offset + 4] = predecessor >>> 8;
  });
  return encoded;
}

/** Decode and canonically validate one compact row-owned mutation stream. */
export function decodeKernelEntryJournalAccesses(encoded: Uint8Array): KernelEntryJournalAccess[] {
  if (encoded.length < ACCESS_HEADER_BYTES) throw new Error('kernel entry journal access stream is truncated');
  if (encoded[0] !== KERNEL_ENTRY_JOURNAL_ACCESS_TAG) {
    throw new Error('invalid kernel entry journal access stream tag');
  }
  const count = encoded[1];
  if (count > KERNEL_ENTRY_JOURNAL_MAX_ACCESSES) {
    throw new Error(`kernel entry journal access stream exceeds ${KERNEL_ENTRY_JOURNAL_MAX_ACCESSES} operations`);
  }
  if (encoded.length !== ACCESS_HEADER_BYTES + count * ACCESS_BYTES) {
    throw new Error('kernel entry journal access stream has a non-canonical length');
  }
  return Array.from({ length: count }, (_unused, index) => {
    const offset = ACCESS_HEADER_BYTES + index * ACCESS_BYTES;
    const flags = encoded[offset];
    if ((flags & ~KNOWN_ACCESS_FLAGS) !== 0) {
      throw new Error('kernel entry journal access stream has unknown flags');
    }
    const targetRecordOrdinal = encoded[offset + 1] | (encoded[offset + 2] << 8);
    const predecessor = encoded[offset + 3] | (encoded[offset + 4] << 8);
    const hasPredecessor = (flags & ACCESS_FLAG_HAS_PREDECESSOR) !== 0;
    if (targetRecordOrdinal === NO_PREDECESSOR) {
      throw new Error('kernel entry journal access stream uses the reserved target ordinal');
    }
    if (hasPredecessor !== (predecessor !== NO_PREDECESSOR)) {
      throw new Error('kernel entry journal access stream has a non-canonical predecessor');
    }
    if (predecessor === targetRecordOrdinal) {
      throw new Error('journal target and predecessor record ordinals must differ');
    }
    const presentBefore = (flags & ACCESS_FLAG_PRESENT_BEFORE) !== 0;
    const presentAfter = (flags & ACCESS_FLAG_PRESENT_AFTER) !== 0;
    if (hasPredecessor !== (!presentBefore || !presentAfter)) {
      throw new Error('journal access predecessor presence must match its topology transition');
    }
    const mutates = (flags & ACCESS_FLAG_MUTATES) !== 0;
    if (!mutates && presentBefore !== presentAfter) {
      throw new Error('a non-mutating journal access must preserve target presence');
    }
    if ((flags & ACCESS_FLAG_AUTHENTICATES_PREDECESSOR) !== 0 && !hasPredecessor) {
      throw new Error('journal access cannot authenticate an absent predecessor');
    }
    if ((flags & ACCESS_FLAG_AUTHENTICATES_TARGET) !== 0 && !presentBefore) {
      throw new Error('journal access cannot authenticate an absent target');
    }
    return {
      targetRecordOrdinal,
      ...(hasPredecessor && { predecessorRecordOrdinal: predecessor }),
      presentBefore,
      presentAfter,
      mutates,
      ...((flags & ACCESS_FLAG_AUTHENTICATES_TARGET) !== 0 && { authenticatesTarget: true as const }),
      ...((flags & ACCESS_FLAG_AUTHENTICATES_PREDECESSOR) !== 0
        && { authenticatesPredecessor: true as const }),
      ...((flags & ACCESS_FLAG_PENDING) !== 0 && { pending: true as const }),
    };
  });
}
