import { describe, expect, it } from 'vitest';
import {
  KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES,
  KERNEL_ENTRY_JOURNAL_TAG,
  decodeKernelEntryJournalRecord,
  encodeKernelEntryJournalRecord,
} from '../../src/stateful/KernelEntryJournal.js';

const bytes = (length: number, fill: number): Uint8Array => new Uint8Array(length).fill(fill);

describe('kernel pending-entry journal codec', () => {
  it('round-trips an authenticated dirty scalar entry', () => {
    const encoded = encodeKernelEntryJournalRecord({
      collectionHash: bytes(32, 0x11),
      slot: bytes(32, 0x22),
      nextKey: bytes(32, 0x33),
      value: Uint8Array.of(0x2a),
      authenticated: true,
      dirty: true,
      tombstone: false,
      synthetic: false,
    });
    expect(encoded[0]).toBe(KERNEL_ENTRY_JOURNAL_TAG);
    expect(encoded).toHaveLength(99);
    expect(decodeKernelEntryJournalRecord(encoded)).toEqual({
      collectionHash: bytes(32, 0x11),
      slot: bytes(32, 0x22),
      nextKey: bytes(32, 0x33),
      value: Uint8Array.of(0x2a),
      authenticated: true,
      dirty: true,
      tombstone: false,
      synthetic: false,
    });
  });

  it('keeps the largest entry-tail record independently below BCH item limits', () => {
    const encoded = encodeKernelEntryJournalRecord({
      collectionHash: bytes(32, 1), slot: bytes(32, 2), nextKey: bytes(32, 3),
      value: bytes(KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES, 4),
      authenticated: false, dirty: true, tombstone: false, synthetic: true,
    });
    expect(encoded).toHaveLength(162);
    expect(encoded.length).toBeLessThanOrEqual(520);
    expect(decodeKernelEntryJournalRecord(encoded).value)
      .toEqual(bytes(KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES, 4));
  });

  it('round-trips a dirty tombstone without a value tail', () => {
    const decoded = decodeKernelEntryJournalRecord(encodeKernelEntryJournalRecord({
      collectionHash: bytes(32, 1), slot: bytes(32, 2), nextKey: bytes(32, 3), value: new Uint8Array(),
      authenticated: true, dirty: true, tombstone: true, synthetic: false,
    }));
    expect(decoded).toMatchObject({ authenticated: true, dirty: true, tombstone: true, synthetic: false });
    expect(decoded.value).toHaveLength(0);
  });

  it('rejects malformed identities, tails, tags, flags, and impossible flag combinations', () => {
    const valid = {
      collectionHash: bytes(32, 1), slot: bytes(32, 2), nextKey: bytes(32, 3), value: new Uint8Array(),
      authenticated: true, dirty: false, tombstone: false, synthetic: false,
    };
    expect(() => encodeKernelEntryJournalRecord({ ...valid, slot: bytes(31, 2) })).toThrow('exactly 32');
    expect(() => encodeKernelEntryJournalRecord({
      ...valid, value: bytes(KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES + 1, 4),
    })).toThrow('exceeds');
    expect(() => encodeKernelEntryJournalRecord({ ...valid, synthetic: true })).toThrow('both');
    expect(() => encodeKernelEntryJournalRecord({ ...valid, tombstone: true })).toThrow('must be dirty');
    expect(() => decodeKernelEntryJournalRecord(bytes(97, 0))).toThrow('truncated');
    const badTag = encodeKernelEntryJournalRecord(valid); badTag[0] = 0x06;
    expect(() => decodeKernelEntryJournalRecord(badTag)).toThrow('tag');
    const badFlags = encodeKernelEntryJournalRecord(valid); badFlags[1] = 0x80;
    expect(() => decodeKernelEntryJournalRecord(badFlags)).toThrow('unknown flags');
  });
});
