import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import {
  KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES,
  KERNEL_ENTRY_JOURNAL_MAX_ACCESSES,
  KERNEL_ENTRY_JOURNAL_ACCESS_TAG,
  KERNEL_ENTRY_JOURNAL_TAG,
  decodeKernelEntryJournalAccesses,
  decodeKernelEntryJournalRecord,
  encodeKernelEntryJournalAccesses,
  encodeKernelEntryJournalRecord,
  encodeKernelEntryJournalRecords,
  planKernelEntryJournalAccessTopology,
  planKernelEntryJournalStreams,
} from '../../src/stateful/KernelEntryJournal.js';
import { SortedList, encodeEntryCommitment, slotValueToBytes } from '../../src/stateful/SortedList.js';
import type { Utxo } from '../../src/interfaces.js';
import { kernelJournalAccessStreamPlaceholders } from '../../src/stateful/StatefulContract.js';

const bytes = (length: number, fill: number): Uint8Array => new Uint8Array(length).fill(fill);

describe('kernel pending-entry journal codec', () => {
  it('builds a dense canonical placeholder vector from stream ordinals, independent of schema names', () => {
    const handler = (name: string, collections: string[]): {
      name: string;
      inputs: Array<{ name: string; type: string }>;
      sortedUpsertLoopInfo: Array<{ collection: string; journalAccessStreamIndex: number }>;
    } => ({
      name,
      inputs: [{ name: '__internal__kernelJournalAccessStreams', type: 'bytes[]' }],
      sortedUpsertLoopInfo: collections.map((collection, journalAccessStreamIndex) => ({
        collection, journalAccessStreamIndex,
      })),
    });
    const ledger = kernelJournalAccessStreamPlaceholders(handler('reconcile', ['credits', 'debits']) as never);
    const registry = kernelJournalAccessStreamPlaceholders(handler('apply', ['primary', 'secondary']) as never);

    expect(ledger).toEqual([Uint8Array.of(0x06, 0), Uint8Array.of(0x06, 0)]);
    expect(registry).toEqual(ledger);
    expect(() => kernelJournalAccessStreamPlaceholders({
      ...handler('invalid', ['first', 'second']),
      sortedUpsertLoopInfo: [
        { collection: 'first', journalAccessStreamIndex: 0 },
        { collection: 'second', journalAccessStreamIndex: 0 },
      ],
    } as never)).toThrow('non-canonical');
  });

  it('round-trips an authenticated dirty scalar entry', () => {
    const encoded = encodeKernelEntryJournalRecord({
      collectionHash: bytes(20, 0x11),
      slot: bytes(32, 0x22),
      nextKey: bytes(32, 0x33),
      value: Uint8Array.of(0x2a),
      authenticated: true,
      dirty: true,
      tombstone: false,
      synthetic: false,
    });
    expect(encoded[0]).toBe(KERNEL_ENTRY_JOURNAL_TAG);
    expect(encoded).toHaveLength(87);
    expect(decodeKernelEntryJournalRecord(encoded)).toEqual({
      collectionHash: bytes(20, 0x11),
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
      collectionHash: bytes(20, 1), slot: bytes(32, 2), nextKey: bytes(32, 3),
      value: bytes(KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES, 4),
      authenticated: false, dirty: true, tombstone: false, synthetic: true,
    });
    expect(encoded).toHaveLength(150);
    expect(encoded.length).toBeLessThanOrEqual(520);
    expect(decodeKernelEntryJournalRecord(encoded).value)
      .toEqual(bytes(KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES, 4));
  });

  it('round-trips a dirty tombstone without a value tail', () => {
    const decoded = decodeKernelEntryJournalRecord(encodeKernelEntryJournalRecord({
      collectionHash: bytes(20, 1), slot: bytes(32, 2), nextKey: bytes(32, 3), value: new Uint8Array(),
      authenticated: true, dirty: true, tombstone: true, synthetic: false,
    }));
    expect(decoded).toMatchObject({ authenticated: true, dirty: true, tombstone: true, synthetic: false });
    expect(decoded.value).toHaveLength(0);
  });

  it('rejects malformed identities, tails, tags, flags, and impossible flag combinations', () => {
    const valid = {
      collectionHash: bytes(20, 1), slot: bytes(32, 2), nextKey: bytes(32, 3), value: new Uint8Array(),
      authenticated: true, dirty: false, tombstone: false, synthetic: false,
    };
    expect(() => encodeKernelEntryJournalRecord({ ...valid, collectionHash: bytes(32, 1) }))
      .toThrow('exactly 20');
    expect(() => encodeKernelEntryJournalRecord({ ...valid, slot: bytes(31, 2) })).toThrow('exactly 32');
    expect(() => encodeKernelEntryJournalRecord({
      ...valid, value: bytes(KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES + 1, 4),
    })).toThrow('exceeds');
    expect(() => encodeKernelEntryJournalRecord({ ...valid, synthetic: true })).toThrow('both');
    expect(() => encodeKernelEntryJournalRecord({ ...valid, tombstone: true })).toThrow('clean journal tombstone');
    expect(() => decodeKernelEntryJournalRecord(bytes(85, 0))).toThrow('truncated');
    const badTag = encodeKernelEntryJournalRecord(valid); badTag[0] = 0x06;
    expect(() => decodeKernelEntryJournalRecord(badTag)).toThrow('tag');
    const badFlags = encodeKernelEntryJournalRecord(valid); badFlags[1] = 0x80;
    expect(() => decodeKernelEntryJournalRecord(badFlags)).toThrow('unknown flags');
  });

  it('encodes a complete planner result without changing first-touch record ordinals', () => {
    const slot = (value: bigint): Uint8Array => slotValueToBytes(value);
    const entry = (txidByte: string, value: bigint, next: bigint): Utxo => ({
      txid: txidByte.repeat(64), vout: 0, satoshis: 1000n,
      token: {
        category: '11'.repeat(32), amount: 0n,
        nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(slot(value), slot(next))) },
      },
    });
    const plan = SortedList.fromUtxos([entry('0', 0n, 10n), entry('1', 10n, 0n)])
      .planJournaledUpserts([
        { slot: slot(20n), operation: Uint8Array.of(1) },
        { slot: slot(20n), operation: Uint8Array.of(2) },
      ], (_current, operation) => operation);
    const encoded = encodeKernelEntryJournalRecords(bytes(20, 0xaa), plan.records);
    expect(encoded.map((record) => Number(record[1] & 0x08))).toEqual([0, 8]);
    expect(encoded.map((record) => Number(decodeKernelEntryJournalRecord(record).slot[0])))
      .toEqual([10, 20]);
    expect(plan.accesses.map((access) => access.targetRecordOrdinal)).toEqual([1, 1]);
    expect(decodeKernelEntryJournalAccesses(encodeKernelEntryJournalAccesses(plan.accesses)))
      .toEqual(plan.accesses);
  });

  it('shares pending values and record ordinals across generically named source streams', () => {
    const slot = (value: bigint): Uint8Array => slotValueToBytes(value);
    const entry = (txidByte: string, value: bigint, next: bigint, tail = 0): Utxo => ({
      txid: txidByte.repeat(64), vout: 0, satoshis: 1000n,
      token: {
        category: '11'.repeat(32), amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: binToHex(encodeEntryCommitment(slot(value), slot(next), Uint8Array.of(tail))),
        },
      },
    });
    const list = SortedList.fromUtxos([
      entry('0', 0n, 10n),
      entry('1', 10n, 0n, 4),
    ]);
    const plan = planKernelEntryJournalStreams(
      list,
      bytes(20, 0xaa),
      [
        [{ slot: slot(10n), operation: 3 }],
        [{ slot: slot(10n), operation: 5 }, { slot: slot(20n), operation: 7 }],
      ],
      (current, delta) => Uint8Array.of((current?.[0] ?? 0) + delta),
    );

    expect(plan.encodedAccessStreams.map((stream) => decodeKernelEntryJournalAccesses(stream)))
      .toEqual([
        [{ targetRecordOrdinal: 0, presentBefore: true, presentAfter: true }],
        [
          { targetRecordOrdinal: 0, presentBefore: true, presentAfter: true },
          { targetRecordOrdinal: 1, predecessorRecordOrdinal: 0, presentBefore: false, presentAfter: true },
        ],
      ]);
    expect(plan.mutationPlan.records.map((record) => ({
      slot: record.slot[0], value: record.value[0], synthetic: record.synthetic,
    }))).toEqual([
      { slot: 10, value: 12, synthetic: false },
      { slot: 20, value: 7, synthetic: true },
    ]);
    expect(plan.encodedRecords).toHaveLength(2);
  });

  it('plans clean reads and writes across neutral runtime stream boundaries', () => {
    const slot = (value: bigint): Uint8Array => slotValueToBytes(value);
    const entry = (txidByte: string, value: bigint, next: bigint, tail?: number): Utxo => ({
      txid: txidByte.repeat(64), vout: 0, satoshis: 1000n,
      token: {
        category: '11'.repeat(32), amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: binToHex(encodeEntryCommitment(
            slot(value), slot(next), tail === undefined ? new Uint8Array() : Uint8Array.of(tail),
          )),
        },
      },
    });
    const plan = planKernelEntryJournalAccessTopology(
      SortedList.fromUtxos([entry('0', 0n, 10n), entry('1', 10n, 0n, 4)]),
      bytes(20, 0xaa),
      [
        [{ slot: slot(10n), operation: 'read' }, { slot: slot(20n), operation: 'read' }],
        [{ slot: slot(20n), operation: 'write' }, { slot: slot(10n), operation: 'delete' }],
      ],
    );

    expect(plan.recordCount).toBe(3);
    expect(plan.encodedRecords.map((record) => {
      const decoded = decodeKernelEntryJournalRecord(record);
      return {
        collection: decoded.collectionHash[0], slot: decoded.slot[0], value: decoded.value[0],
        next: decoded.nextKey[0], authenticated: decoded.authenticated,
        dirty: decoded.dirty, tombstone: decoded.tombstone, synthetic: decoded.synthetic,
      };
    })).toEqual([
      { collection: 0xaa, slot: 10, value: 4, next: 0,
        authenticated: true, dirty: false, tombstone: false, synthetic: false },
      { collection: 0xaa, slot: 20, value: undefined, next: 0,
        authenticated: false, dirty: false, tombstone: true, synthetic: true },
      { collection: 0xaa, slot: 0, value: undefined, next: 10,
        authenticated: true, dirty: false, tombstone: false, synthetic: false },
    ]);
    expect(plan.encodedAccessStreams.map((stream) => decodeKernelEntryJournalAccesses(stream))).toEqual([
      [
        { targetRecordOrdinal: 0, presentBefore: true, presentAfter: true },
        { targetRecordOrdinal: 1, predecessorRecordOrdinal: 0, presentBefore: false, presentAfter: false },
      ],
      [
        { targetRecordOrdinal: 1, predecessorRecordOrdinal: 0, presentBefore: false, presentAfter: true },
        { targetRecordOrdinal: 0, predecessorRecordOrdinal: 2, presentBefore: true, presentAfter: false },
      ],
    ]);
  });

  it('round-trips insert, update, delete, and absent-delete access states', () => {
    const accesses = [
      { targetRecordOrdinal: 1, predecessorRecordOrdinal: 0, presentBefore: false, presentAfter: true },
      { targetRecordOrdinal: 1, presentBefore: true, presentAfter: true },
      { targetRecordOrdinal: 1, predecessorRecordOrdinal: 0, presentBefore: true, presentAfter: false },
      { targetRecordOrdinal: 2, predecessorRecordOrdinal: 0, presentBefore: false, presentAfter: false },
    ];
    const encoded = encodeKernelEntryJournalAccesses(accesses);
    expect(encoded[0]).toBe(KERNEL_ENTRY_JOURNAL_ACCESS_TAG);
    expect(encoded).toHaveLength(2 + accesses.length * 5);
    expect(decodeKernelEntryJournalAccesses(encoded)).toEqual(accesses);
  });

  it('keeps the largest compact access program within one BCH item', () => {
    const accesses = Array.from({ length: KERNEL_ENTRY_JOURNAL_MAX_ACCESSES }, (_unused, ordinal) => ({
      targetRecordOrdinal: ordinal,
      presentBefore: true,
      presentAfter: true,
    }));
    const encoded = encodeKernelEntryJournalAccesses(accesses);
    expect(encoded).toHaveLength(517);
    expect(encoded.length).toBeLessThanOrEqual(520);
    expect(decodeKernelEntryJournalAccesses(encoded)).toEqual(accesses);
    expect(() => encodeKernelEntryJournalAccesses([...accesses, accesses[0]]))
      .toThrow(`exceeds ${KERNEL_ENTRY_JOURNAL_MAX_ACCESSES}`);
  });

  it('rejects malformed access programs and reserved or aliased ordinals', () => {
    expect(() => encodeKernelEntryJournalAccesses([{
      targetRecordOrdinal: 65535, presentBefore: true, presentAfter: true,
    }])).toThrow('below 65535');
    expect(() => encodeKernelEntryJournalAccesses([{
      targetRecordOrdinal: 1, predecessorRecordOrdinal: 1, presentBefore: false, presentAfter: true,
    }])).toThrow('must differ');
    expect(() => decodeKernelEntryJournalAccesses(Uint8Array.of(0x06))).toThrow('truncated');
    expect(() => decodeKernelEntryJournalAccesses(Uint8Array.of(0x07, 0))).toThrow('tag');
    expect(() => decodeKernelEntryJournalAccesses(Uint8Array.of(0x06, 1))).toThrow('length');
    expect(() => decodeKernelEntryJournalAccesses(Uint8Array.of(0x06, 1, 0x80, 0, 0, 0xff, 0xff)))
      .toThrow('unknown flags');
    expect(() => decodeKernelEntryJournalAccesses(Uint8Array.of(0x06, 1, 0, 0xff, 0xff, 0xff, 0xff)))
      .toThrow('reserved target');
    expect(() => decodeKernelEntryJournalAccesses(Uint8Array.of(0x06, 1, 0, 0, 0, 0, 0)))
      .toThrow('non-canonical predecessor');
  });
});
