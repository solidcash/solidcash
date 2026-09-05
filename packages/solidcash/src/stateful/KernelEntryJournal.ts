/** Canonical record tag, distinct from runtime event/BCH/FT/NFT effect tags 0x01..0x04. */
export const KERNEL_ENTRY_JOURNAL_TAG = 0x05;

/** Entry NFT commitments are capped at 128 bytes: slot + next slot + at most 64 bytes of value tail. */
export const KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES = 64;

const IDENTITY_BYTES = 32;
const HEADER_BYTES = 2 + IDENTITY_BYTES * 3;
const FLAG_AUTHENTICATED = 1 << 0;
const FLAG_DIRTY = 1 << 1;
const FLAG_TOMBSTONE = 1 << 2;
const FLAG_SYNTHETIC = 1 << 3;
const KNOWN_FLAGS = FLAG_AUTHENTICATED | FLAG_DIRTY | FLAG_TOMBSTONE | FLAG_SYNTHETIC;

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

function requireIdentity(name: string, value: Uint8Array): void {
  if (value.length !== IDENTITY_BYTES) throw new Error(`${name} must be exactly ${IDENTITY_BYTES} bytes`);
}

/**
 * Encode one independently bounded pending-entry record:
 * `0x05 || flags || collectionHash32 || slot32 || nextKey32 || valueTail`.
 */
export function encodeKernelEntryJournalRecord(record: KernelEntryJournalRecord): Uint8Array {
  requireIdentity('collectionHash', record.collectionHash);
  requireIdentity('slot', record.slot);
  requireIdentity('nextKey', record.nextKey);
  if (record.value.length > KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES) {
    throw new Error(`journal value tail exceeds ${KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES} bytes`);
  }
  if (record.authenticated && record.synthetic) {
    throw new Error('a journal node cannot be both authenticated and synthetic');
  }
  if (record.tombstone && !record.dirty) throw new Error('a journal tombstone must be dirty');
  let flags = 0;
  if (record.authenticated) flags |= FLAG_AUTHENTICATED;
  if (record.dirty) flags |= FLAG_DIRTY;
  if (record.tombstone) flags |= FLAG_TOMBSTONE;
  if (record.synthetic) flags |= FLAG_SYNTHETIC;
  const encoded = new Uint8Array(HEADER_BYTES + record.value.length);
  encoded[0] = KERNEL_ENTRY_JOURNAL_TAG;
  encoded[1] = flags;
  encoded.set(record.collectionHash, 2);
  encoded.set(record.slot, 2 + IDENTITY_BYTES);
  encoded.set(record.nextKey, 2 + IDENTITY_BYTES * 2);
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
  if (tombstone && !dirty) throw new Error('a journal tombstone must be dirty');
  return {
    collectionHash: encoded.slice(2, 2 + IDENTITY_BYTES),
    slot: encoded.slice(2 + IDENTITY_BYTES, 2 + IDENTITY_BYTES * 2),
    nextKey: encoded.slice(2 + IDENTITY_BYTES * 2, HEADER_BYTES),
    value: encoded.slice(HEADER_BYTES),
    authenticated,
    dirty,
    tombstone,
    synthetic,
  };
}
