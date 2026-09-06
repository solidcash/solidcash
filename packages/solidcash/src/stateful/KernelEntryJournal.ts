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
const KNOWN_ACCESS_FLAGS = ACCESS_FLAG_PRESENT_BEFORE
  | ACCESS_FLAG_PRESENT_AFTER | ACCESS_FLAG_HAS_PREDECESSOR | ACCESS_FLAG_MUTATES
  | ACCESS_FLAG_AUTHENTICATES_TARGET | ACCESS_FLAG_AUTHENTICATES_PREDECESSOR;
const NO_PREDECESSOR = 0xffff;
/** `tag || count || N * (flags || target-u16le || predecessor-u16le)` must remain one BCH item. */
export const KERNEL_ENTRY_JOURNAL_MAX_ACCESSES = Math.floor((520 - ACCESS_HEADER_BYTES) / ACCESS_BYTES);

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

/**
 * Value-independent operation classes used while assigning stable access ordinals. A SolidCash mapping `delete`
 * is a default-value write and therefore uses `write`; `remove` is reserved for an actual linked-list splice.
 */
export type KernelEntryJournalTopologyOperation = 'read' | 'write' | 'remove';

export interface KernelEntryJournalAccessTopologyPlan {
  /** Number of first-touch records addressed by every stream in this plan. */
  recordCount: number;
  /** Truthful pre-state carriers in the same first-touch ordinal space as the access programs. */
  encodedRecords: Uint8Array[];
  /** One compact access program for each source stream. */
  encodedAccessStreams: Uint8Array[];
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
  accesses: readonly JournaledMutationAccess[],
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
    let flags = 0;
    if (access.presentBefore) flags |= ACCESS_FLAG_PRESENT_BEFORE;
    if (access.presentAfter) flags |= ACCESS_FLAG_PRESENT_AFTER;
    if (access.predecessorRecordOrdinal !== undefined) flags |= ACCESS_FLAG_HAS_PREDECESSOR;
    if (access.mutates) flags |= ACCESS_FLAG_MUTATES;
    if (access.authenticatesTarget) flags |= ACCESS_FLAG_AUTHENTICATES_TARGET;
    if (access.authenticatesPredecessor) flags |= ACCESS_FLAG_AUTHENTICATES_PREDECESSOR;
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
export function decodeKernelEntryJournalAccesses(encoded: Uint8Array): JournaledMutationAccess[] {
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
    return {
      targetRecordOrdinal,
      ...(hasPredecessor && { predecessorRecordOrdinal: predecessor }),
      presentBefore,
      presentAfter,
      mutates,
      ...((flags & ACCESS_FLAG_AUTHENTICATES_TARGET) !== 0 && { authenticatesTarget: true as const }),
      ...((flags & ACCESS_FLAG_AUTHENTICATES_PREDECESSOR) !== 0
        && { authenticatesPredecessor: true as const }),
    };
  });
}
