import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import {
  encodePushdataValue, MAX_MESSAGE_BUS_BLOB_BYTES, type JournalSettlementIdentityAbi,
} from '@solidcash/utils';
import {
  KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES,
  KERNEL_ENTRY_JOURNAL_MAX_ACCESSES,
  KERNEL_ENTRY_JOURNAL_ACCESS_TAG,
  KERNEL_ENTRY_JOURNAL_TAG,
  KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT,
  KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX,
  decodeKernelEntryJournalAccesses,
  decodeKernelEntryJournalRecord,
  encodeKernelEntryJournalAccesses,
  encodeKernelEntryJournalRecord,
  encodeKernelEntryJournalRecords,
  planKernelEntryJournalAccessTopology,
  planKernelEntryJournalSettlementAuthority,
  planKernelEntryJournalSettlementOutputSegments,
  validateKernelEntryJournalSettlementGroups,
  planKernelEntryJournalStreams,
  segmentKernelEntryJournalRecords,
  kernelEntryJournalRecordPosition,
  kernelEntryJournalRecordSegmentIndex,
  kernelEntryJournalRecordSegmentName,
  validateKernelEntryJournalRecordSegments,
  validateKernelEntryJournalRecordSegmentSlots,
  validateKernelEntryJournalTransportRecords,
} from '../../src/stateful/KernelEntryJournal.js';
import { SortedList, encodeEntryCommitment, slotValueToBytes } from '../../src/stateful/SortedList.js';
import type { Utxo } from '../../src/interfaces.js';
import {
  kernelJournalAccessStreamPlaceholders, kernelJournalRecordSegmentWitnesses,
} from '../../src/stateful/StatefulContract.js';

const bytes = (length: number, fill: number): Uint8Array => new Uint8Array(length).fill(fill);
const ACCESS_COLLECTION_HASH = bytes(20, 0xcc);

describe('kernel pending-entry journal codec', () => {
  const journalRecord = (ordinal: number, valueBytes = KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES): Uint8Array =>
    encodeKernelEntryJournalRecord({
      collectionHash: bytes(20, 0x11),
      slot: bytes(32, ordinal),
      nextKey: bytes(32, ordinal + 1),
      value: bytes(valueBytes, ordinal),
      authenticated: true,
      dirty: false,
      tombstone: false,
      synthetic: false,
    });

  it('segments a carrier larger than 520 bytes without changing global record ordinals', () => {
    const records = Array.from({ length: 8 }, (_unused, ordinal) => journalRecord(ordinal + 1));
    const segments = segmentKernelEntryJournalRecords(records);
    expect(encodePushdataValue(records, 'bytes[]').length).toBeGreaterThan(MAX_MESSAGE_BUS_BLOB_BYTES);
    expect(KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT).toBe(3);
    expect(segments.map((segment) => segment.length)).toEqual([3, 3, 2]);
    expect(segments.every((segment) =>
      encodePushdataValue(segment, 'bytes[]').length <= MAX_MESSAGE_BUS_BLOB_BYTES)).toBe(true);
    expect(validateKernelEntryJournalRecordSegments(segments, { expectedRecordCount: 8 })
      .map((record) => record.slot[0])).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(kernelEntryJournalRecordPosition(0, 8)).toEqual({ segmentIndex: 0, segmentRecordIndex: 0 });
    expect(kernelEntryJournalRecordPosition(3, 8)).toEqual({ segmentIndex: 1, segmentRecordIndex: 0 });
    expect(kernelEntryJournalRecordPosition(7, 8)).toEqual({ segmentIndex: 2, segmentRecordIndex: 1 });
  });

  it('keeps segment membership stable when clean records acquire different dirty value lengths', () => {
    const clean = Array.from({ length: 7 }, (_unused, ordinal) => journalRecord(ordinal + 1, 0));
    const dirty = clean.map((encoded, ordinal) => encodeKernelEntryJournalRecord({
      ...decodeKernelEntryJournalRecord(encoded),
      value: bytes(ordinal % 2 === 0 ? KERNEL_ENTRY_JOURNAL_MAX_VALUE_BYTES : 1, ordinal + 1),
      dirty: true,
    }));
    expect(segmentKernelEntryJournalRecords(clean).map((segment) => segment.length)).toEqual([3, 3, 1]);
    expect(segmentKernelEntryJournalRecords(dirty).map((segment) => segment.length)).toEqual([3, 3, 1]);
  });

  it('rejects malformed segment partitions, count claims, transport records, and sparse slots', () => {
    const records = Array.from({ length: 5 }, (_unused, ordinal) => journalRecord(ordinal + 1));
    const canonical = segmentKernelEntryJournalRecords(records);
    expect(() => validateKernelEntryJournalRecordSegments([[], canonical[0]]))
      .toThrow('non-empty prefix');
    expect(() => validateKernelEntryJournalRecordSegments([
      canonical[0].slice(0, 2), [...canonical[0].slice(2), ...canonical[1]],
    ])).toThrow('non-canonical record partition');
    expect(() => validateKernelEntryJournalRecordSegments(canonical, { expectedRecordCount: 4 }))
      .toThrow('authenticated record count');
    const dirty = encodeKernelEntryJournalRecord({
      ...decodeKernelEntryJournalRecord(records[0]), dirty: true,
    });
    expect(() => validateKernelEntryJournalRecordSegments([[dirty]], { transportOnly: true }))
      .toThrow('final-flush settlement');
    expect(() => validateKernelEntryJournalRecordSegmentSlots(
      [canonical[0], [], canonical[1]], 2,
    )).toThrow('authenticated non-empty prefix');
    expect(() => validateKernelEntryJournalRecordSegmentSlots([canonical[0], canonical[1], []], 1))
      .toThrow('authenticated non-empty prefix');
    expect(() => kernelEntryJournalRecordPosition(5, 5)).toThrow('out of range');
  });

  it('binds a carrier above 520 bytes to compiler-published stable segment slots', () => {
    const records = Array.from({ length: 7 }, (_unused, ordinal) => journalRecord(ordinal + 1));
    expect(encodePushdataValue(records, 'bytes[]').length).toBeGreaterThan(MAX_MESSAGE_BUS_BLOB_BYTES);
    const inputs = Array.from({ length: 4 }, (_unused, segmentIndex) => ({
      name: kernelEntryJournalRecordSegmentName(segmentIndex), type: 'bytes',
    }));
    const { slots } = kernelJournalRecordSegmentWitnesses(inputs, records);
    expect(slots.map(({ name, inputIndex, carrier }) => ({
      name, inputIndex, carrier: binToHex(carrier),
    }))).toEqual([
      { name: `${KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX}0`, inputIndex: 0,
        carrier: binToHex(encodePushdataValue(records.slice(0, 3), 'bytes[]')) },
      { name: `${KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX}1`, inputIndex: 1,
        carrier: binToHex(encodePushdataValue(records.slice(3, 6), 'bytes[]')) },
      { name: `${KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX}2`, inputIndex: 2,
        carrier: binToHex(encodePushdataValue(records.slice(6), 'bytes[]')) },
      { name: `${KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX}3`, inputIndex: 3,
        carrier: binToHex(encodePushdataValue([], 'bytes[]')) },
    ]);
    expect(kernelEntryJournalRecordSegmentIndex(inputs[2].name)).toBe(2);
  });

  it('rejects insufficient, gapped, duplicated, and non-canonical compiler segment slots', () => {
    const records = Array.from({ length: 4 }, (_unused, ordinal) => journalRecord(ordinal + 1));
    const input = (suffix: string): { name: string; type: string } => ({
      name: `${KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX}${suffix}`, type: 'bytes',
    });
    expect(() => kernelJournalRecordSegmentWitnesses([input('0')], records))
      .toThrow('requires 2 carrier segments');
    expect(() => kernelJournalRecordSegmentWitnesses([input('0'), input('2')], records))
      .toThrow('missing slot 1');
    expect(() => kernelJournalRecordSegmentWitnesses([input('0'), input('0')], records))
      .toThrow('published more than once');
    expect(() => kernelJournalRecordSegmentWitnesses([input('00')], records))
      .toThrow('non-canonical index');
    expect(() => kernelJournalRecordSegmentWitnesses([
      { ...input('0'), type: 'bytes[][]' }, input('1'),
    ], records)).toThrow('must have type bytes');
  });

  it('builds a dense canonical placeholder vector from stream ordinals, independent of schema names', () => {
    const handler = (name: string, collections: string[]): {
      name: string;
      inputs: Array<{ name: string; type: string }>;
      sortedUpsertLoopInfo: Array<{
        collection: string; collectionHash: string; journalAccessStreamIndex: number;
      }>;
    } => ({
      name,
      inputs: [{ name: '__internal__kernelJournalAccessStreams', type: 'bytes[]' }],
      sortedUpsertLoopInfo: collections.map((collection, journalAccessStreamIndex) => ({
        collection, collectionHash: binToHex(bytes(20, journalAccessStreamIndex + 1)), journalAccessStreamIndex,
      })),
    });
    const ledger = kernelJournalAccessStreamPlaceholders(handler('reconcile', ['credits', 'debits']) as never);
    const registry = kernelJournalAccessStreamPlaceholders(handler('apply', ['primary', 'secondary']) as never);

    expect(ledger).toEqual([
      Uint8Array.of(0x06, 0, ...bytes(20, 1)),
      Uint8Array.of(0x06, 0, ...bytes(20, 2)),
    ]);
    expect(registry).toEqual(ledger);
    expect(() => kernelJournalAccessStreamPlaceholders({
      ...handler('invalid', ['first', 'second']),
      sortedUpsertLoopInfo: [
        { collection: 'first', journalAccessStreamIndex: 0 },
        { collection: 'second', journalAccessStreamIndex: 0 },
      ],
    } as never)).toThrow('non-canonical');
    expect(() => kernelJournalAccessStreamPlaceholders({
      ...handler('missing-hash', ['only']),
      sortedUpsertLoopInfo: [{ collection: 'only', journalAccessStreamIndex: 0 }],
    } as never)).toThrow('no canonical collection hash');
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

  it('fails closed on dirty or malformed transport records until final flush exists', () => {
    const clean = encodeKernelEntryJournalRecord({
      collectionHash: bytes(20, 1), slot: bytes(32, 2), nextKey: bytes(32, 3),
      value: Uint8Array.of(4), authenticated: true, dirty: false, tombstone: false, synthetic: false,
    });
    const absent = encodeKernelEntryJournalRecord({
      collectionHash: bytes(20, 1), slot: bytes(32, 5), nextKey: bytes(32, 0),
      value: new Uint8Array(), authenticated: false, dirty: false, tombstone: true, synthetic: true,
    });
    expect(validateKernelEntryJournalTransportRecords([clean, absent])).toHaveLength(2);

    const dirty = encodeKernelEntryJournalRecord({
      collectionHash: bytes(20, 1), slot: bytes(32, 2), nextKey: bytes(32, 3),
      value: Uint8Array.of(4), authenticated: true, dirty: true, tombstone: false, synthetic: false,
    });
    expect(() => validateKernelEntryJournalTransportRecords([dirty]))
      .toThrow('require final-flush settlement');
    expect(() => validateKernelEntryJournalTransportRecords([Uint8Array.of(0x05)]))
      .toThrow('truncated');
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
    expect(() => encodeKernelEntryJournalRecord({ ...valid, authenticated: false }))
      .toThrow('either authenticated or synthetic');
    expect(() => encodeKernelEntryJournalRecord({
      ...valid, authenticated: false, synthetic: true,
    })).toThrow('absence tombstone');
    expect(() => encodeKernelEntryJournalRecord({
      ...valid, authenticated: false, synthetic: true, tombstone: true,
      nextKey: bytes(32, 1),
    })).toThrow('zero successor');
    expect(() => encodeKernelEntryJournalRecord({
      ...valid, authenticated: false, synthetic: true, tombstone: true,
      value: Uint8Array.of(1),
    })).toThrow('cannot carry a value');
    expect(() => encodeKernelEntryJournalRecord({ ...valid, tombstone: true })).toThrow('clean journal tombstone');
    expect(() => decodeKernelEntryJournalRecord(bytes(85, 0))).toThrow('truncated');
    const badTag = encodeKernelEntryJournalRecord(valid); badTag[0] = 0x06;
    expect(() => decodeKernelEntryJournalRecord(badTag)).toThrow('tag');
    const badFlags = encodeKernelEntryJournalRecord(valid); badFlags[1] = 0x80;
    expect(() => decodeKernelEntryJournalRecord(badFlags)).toThrow('unknown flags');
    const unauthenticated = encodeKernelEntryJournalRecord(valid); unauthenticated[1] = 0;
    expect(() => decodeKernelEntryJournalRecord(unauthenticated))
      .toThrow('either authenticated or synthetic');
    const cleanSyntheticLive = encodeKernelEntryJournalRecord(valid); cleanSyntheticLive[1] = 0x08;
    expect(() => decodeKernelEntryJournalRecord(cleanSyntheticLive)).toThrow('absence tombstone');
    const valueTombstone = encodeKernelEntryJournalRecord({ ...valid, value: Uint8Array.of(1) });
    valueTombstone[1] = 0x07;
    expect(() => decodeKernelEntryJournalRecord(valueTombstone)).toThrow('cannot carry a value');
    const nonzeroAbsentSuccessor = encodeKernelEntryJournalRecord(valid).slice(0, 86);
    nonzeroAbsentSuccessor[1] = 0x0c;
    nonzeroAbsentSuccessor[54] = 1;
    expect(() => decodeKernelEntryJournalRecord(nonzeroAbsentSuccessor)).toThrow('zero successor');
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
    expect(decodeKernelEntryJournalAccesses(
      encodeKernelEntryJournalAccesses(bytes(20, 0xaa), plan.accesses),
    ))
      .toEqual(plan.accesses);
  });

  it('round-trips the transaction-local pending protocol marker independently of topology flags', () => {
    const access = {
      targetRecordOrdinal: 3,
      predecessorRecordOrdinal: 1,
      presentBefore: false,
      presentAfter: true,
      mutates: true,
      authenticatesPredecessor: true as const,
      pending: true as const,
    };
    expect(decodeKernelEntryJournalAccesses(
      encodeKernelEntryJournalAccesses(ACCESS_COLLECTION_HASH, [access]),
    )).toEqual([access]);
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
        [{ targetRecordOrdinal: 0, presentBefore: true, presentAfter: true, mutates: true,
          authenticatesTarget: true }],
        [
          { targetRecordOrdinal: 0, presentBefore: true, presentAfter: true, mutates: true },
          { targetRecordOrdinal: 1, predecessorRecordOrdinal: 0, presentBefore: false, presentAfter: true, mutates: true },
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
        [{ slot: slot(20n), operation: 'write' }, { slot: slot(10n), operation: 'remove' }],
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
        { targetRecordOrdinal: 0, presentBefore: true, presentAfter: true, mutates: false,
          authenticatesTarget: true },
        { targetRecordOrdinal: 1, predecessorRecordOrdinal: 0, presentBefore: false, presentAfter: false, mutates: false },
      ],
      [
        { targetRecordOrdinal: 1, predecessorRecordOrdinal: 0, presentBefore: false, presentAfter: true, mutates: true },
        { targetRecordOrdinal: 0, predecessorRecordOrdinal: 2, presentBefore: true, presentAfter: false, mutates: true,
          authenticatesPredecessor: true },
      ],
    ]);
  });

  it('assigns record settlement authority to stable last-mutating access identities', () => {
    const identity = (
      accessStreamIndex: number,
      settlementRole: JournalSettlementIdentityAbi['settlementRole'],
    ): JournalSettlementIdentityAbi => ({
      accessStreamIndex,
      accessOrdinalSource: 'access-program-order',
      recordOrdinalSources: ['target-record-ordinal', 'predecessor-record-ordinal'],
      settlementRole,
      settlementOwnership: settlementRole === 'mutation-settlement' ? 'last-mutating-access' : 'none',
    });
    const update = (targetRecordOrdinal: number): {
      targetRecordOrdinal: number; presentBefore: boolean; presentAfter: boolean; mutates: boolean;
    } => ({
      targetRecordOrdinal, presentBefore: true, presentAfter: true, mutates: true,
    });
    const plan = planKernelEntryJournalSettlementAuthority([
      { frameIndex: 4, identity: identity(0, 'mutation-settlement'), accessOrdinal: 0, access: update(0) },
      {
        frameIndex: 4,
        identity: identity(1, 'mutation-settlement'),
        accessOrdinal: 0,
        access: {
          targetRecordOrdinal: 1, predecessorRecordOrdinal: 0,
          presentBefore: false, presentAfter: true, mutates: true,
        },
      },
      { frameIndex: 4, identity: identity(0, 'mutation-settlement'), accessOrdinal: 1, access: update(0) },
      {
        frameIndex: 4,
        identity: identity(2, 'carrier-only'),
        accessOrdinal: 0,
        access: {
          targetRecordOrdinal: 2, presentBefore: true, presentAfter: true, mutates: false,
          authenticatesTarget: true,
        },
      },
      {
        frameIndex: 4,
        identity: identity(3, 'mutation-settlement'),
        accessOrdinal: 0,
        access: {
          targetRecordOrdinal: 3, predecessorRecordOrdinal: 4,
          presentBefore: true, presentAfter: false, mutates: true,
        },
      },
      {
        frameIndex: 4,
        identity: identity(4, 'carrier-only'),
        accessOrdinal: 0,
        access: {
          targetRecordOrdinal: 5, predecessorRecordOrdinal: 6,
          presentBefore: false, presentAfter: false, mutates: false,
          authenticatesPredecessor: true,
        },
      },
    ]);

    expect(plan.references.map(({ accessStreamIndex, accessOrdinal, recordOrdinal, recordRole }) => ({
      accessStreamIndex, accessOrdinal, recordOrdinal, recordRole,
    }))).toEqual([
      { accessStreamIndex: 0, accessOrdinal: 0, recordOrdinal: 0, recordRole: 'target' },
      { accessStreamIndex: 1, accessOrdinal: 0, recordOrdinal: 1, recordRole: 'target' },
      { accessStreamIndex: 1, accessOrdinal: 0, recordOrdinal: 0, recordRole: 'predecessor' },
      { accessStreamIndex: 0, accessOrdinal: 1, recordOrdinal: 0, recordRole: 'target' },
      { accessStreamIndex: 2, accessOrdinal: 0, recordOrdinal: 2, recordRole: 'target' },
      { accessStreamIndex: 3, accessOrdinal: 0, recordOrdinal: 3, recordRole: 'target' },
      { accessStreamIndex: 3, accessOrdinal: 0, recordOrdinal: 4, recordRole: 'predecessor' },
      { accessStreamIndex: 4, accessOrdinal: 0, recordOrdinal: 5, recordRole: 'target' },
      { accessStreamIndex: 4, accessOrdinal: 0, recordOrdinal: 6, recordRole: 'predecessor' },
    ]);
    expect([...plan.settlementAuthorities].map(([recordOrdinal, authority]) => ({
      recordOrdinal,
      accessStreamIndex: authority.accessStreamIndex,
      accessOrdinal: authority.accessOrdinal,
      recordRole: authority.recordRole,
    }))).toEqual([
      { recordOrdinal: 0, accessStreamIndex: 0, accessOrdinal: 1, recordRole: 'target' },
      { recordOrdinal: 1, accessStreamIndex: 1, accessOrdinal: 0, recordRole: 'target' },
      { recordOrdinal: 3, accessStreamIndex: 3, accessOrdinal: 0, recordRole: 'target' },
      { recordOrdinal: 4, accessStreamIndex: 3, accessOrdinal: 0, recordRole: 'predecessor' },
    ]);
    expect([...plan.recordDispositions].map(([recordOrdinal, disposition]) => ({
      recordOrdinal,
      basis: disposition.basis,
      settlementDisposition: disposition.reference.settlementDisposition,
    }))).toEqual([
      { recordOrdinal: 0, basis: 'mutation-settlement', settlementDisposition: 'present-output' },
      { recordOrdinal: 1, basis: 'mutation-settlement', settlementDisposition: 'present-output' },
      { recordOrdinal: 2, basis: 'authenticated-carrier', settlementDisposition: 'present-output' },
      { recordOrdinal: 3, basis: 'mutation-settlement', settlementDisposition: 'absence' },
      { recordOrdinal: 4, basis: 'mutation-settlement', settlementDisposition: 'present-output' },
      { recordOrdinal: 5, basis: 'origin-carrier', settlementDisposition: 'absence' },
      { recordOrdinal: 6, basis: 'authenticated-carrier', settlementDisposition: 'present-output' },
    ]);
  });

  it('requires authenticated global ordinals for multiple mutation streams in one execution group', () => {
    const identity = (
      accessStreamIndex: number,
      recordOrdinalScope?: 'global-journal',
    ): JournalSettlementIdentityAbi => ({
      accessStreamIndex,
      ...(recordOrdinalScope && { recordOrdinalScope }),
      accessOrdinalSource: 'access-program-order',
      recordOrdinalSources: ['target-record-ordinal', 'predecessor-record-ordinal'],
      settlementRole: 'mutation-settlement',
      settlementOwnership: 'last-mutating-access',
    });
    expect(() => validateKernelEntryJournalSettlementGroups([
      { executionGroup: 'frame:group', mutates: true, identity: identity(0) },
    ])).not.toThrow();
    expect(() => validateKernelEntryJournalSettlementGroups([
      { executionGroup: 'frame:group', mutates: true, identity: identity(0) },
      { executionGroup: 'frame:group', mutates: true, identity: identity(1, 'global-journal') },
    ])).toThrow('multiple mutation streams without authenticated global record ordinals');
    expect(() => validateKernelEntryJournalSettlementGroups([
      { executionGroup: 'frame:group', mutates: true, identity: identity(0, 'global-journal') },
      { executionGroup: 'frame:group', mutates: true, identity: identity(1, 'global-journal') },
    ])).not.toThrow();

    const plan = planKernelEntryJournalSettlementAuthority([
      {
        frameIndex: 0,
        identity: identity(0, 'global-journal'),
        accessOrdinal: 0,
        access: {
          targetRecordOrdinal: 1, predecessorRecordOrdinal: 0,
          presentBefore: false, presentAfter: true, mutates: true,
        },
      },
      {
        frameIndex: 0,
        identity: identity(1, 'global-journal'),
        accessOrdinal: 0,
        access: {
          targetRecordOrdinal: 2, predecessorRecordOrdinal: 0,
          presentBefore: false, presentAfter: true, mutates: true,
        },
      },
    ]);
    expect(plan.settlementAuthorities.get(0)).toMatchObject({
      accessStreamIndex: 1, accessOrdinal: 0, recordOrdinal: 0, recordRole: 'predecessor',
    });
  });

  it('rejects forged or ambiguous settlement identity programs', () => {
    const mutationIdentity: JournalSettlementIdentityAbi = {
      accessStreamIndex: 0,
      accessOrdinalSource: 'access-program-order',
      recordOrdinalSources: ['target-record-ordinal', 'predecessor-record-ordinal'],
      settlementRole: 'mutation-settlement',
      settlementOwnership: 'last-mutating-access',
    };
    const mutation = {
      targetRecordOrdinal: 0, presentBefore: true, presentAfter: true, mutates: true,
    };
    expect(() => planKernelEntryJournalSettlementAuthority([
      { frameIndex: 0, identity: mutationIdentity, accessOrdinal: 0, access: mutation },
      { frameIndex: 0, identity: mutationIdentity, accessOrdinal: 0, access: mutation },
    ])).toThrow('repeats access ordinal 0');
    expect(() => planKernelEntryJournalSettlementAuthority([
      { frameIndex: 0, identity: mutationIdentity, accessOrdinal: 1, access: mutation },
    ])).toThrow('expected access ordinal 0, received 1');
    expect(() => planKernelEntryJournalSettlementAuthority([
      { frameIndex: 0, identity: mutationIdentity, accessOrdinal: 0, access: mutation },
      { frameIndex: 0, identity: mutationIdentity, accessOrdinal: 2, access: mutation },
    ])).toThrow('expected access ordinal 1, received 2');
    expect(() => planKernelEntryJournalSettlementAuthority([{
      frameIndex: 0,
      identity: { ...mutationIdentity, settlementOwnership: 'none' },
      accessOrdinal: 0,
      access: mutation,
    }])).toThrow('inconsistent settlement ownership rule');
    expect(() => planKernelEntryJournalSettlementAuthority([{
      frameIndex: 0,
      identity: { ...mutationIdentity, recordDispositionSource: 'authenticated-carrier' },
      accessOrdinal: 0,
      access: mutation,
    }])).toThrow('inconsistent record disposition source');
    expect(() => planKernelEntryJournalSettlementAuthority([{
      frameIndex: 0,
      identity: { ...mutationIdentity, settlementRole: 'carrier-only', settlementOwnership: 'none' },
      accessOrdinal: 0,
      access: mutation,
    }])).toThrow('settlement role disagrees with its access');
    expect(() => planKernelEntryJournalSettlementAuthority([{
      frameIndex: 0,
      identity: {
        ...mutationIdentity,
        recordOrdinalSources: ['predecessor-record-ordinal', 'target-record-ordinal'],
      } as unknown as JournalSettlementIdentityAbi,
      accessOrdinal: 0,
      access: mutation,
    }])).toThrow('unsupported record recipe');
  });

  it('emits settlement locations in global record order instead of grouping collections', () => {
    const authority = (
      recordOrdinal: number,
      accessStreamIndex: number,
    ): ReturnType<typeof planKernelEntryJournalSettlementAuthority>['references'][number] => ({
      frameIndex: 0,
      accessStreamIndex,
      accessOrdinal: 0,
      recordOrdinal,
      recordRole: 'target',
      settlementRole: 'mutation-settlement',
      settlementDisposition: 'present-output',
    });
    const a0 = authority(0, 0);
    const absent = { ...authority(1, 2), settlementDisposition: 'absence' as const };
    const b0 = authority(2, 1);
    const a1 = authority(3, 0);
    const plan = {
      references: [a0, absent, b0, a1],
      // Deliberately insert in collection-grouped order; physical planning must sort authenticated ordinals.
      settlementAuthorities: new Map([[0, a0], [3, a1], [1, absent], [2, b0]]),
      recordDispositions: new Map([
        [0, { reference: a0, basis: 'mutation-settlement' as const }],
        [3, { reference: a1, basis: 'mutation-settlement' as const }],
        [1, { reference: absent, basis: 'mutation-settlement' as const }],
        [2, { reference: b0, basis: 'mutation-settlement' as const }],
      ]),
    };
    expect(planKernelEntryJournalSettlementOutputSegments(plan, (reference) => (
      reference.accessStreamIndex === 0
        ? { collection: 'alpha', offset: reference.recordOrdinal === 0 ? 0 : 1 }
        : { collection: 'beta', offset: 0 }
    ))).toEqual([
      { collection: 'alpha', offset: 0, count: 1 },
      { collection: 'beta', offset: 0, count: 1 },
      { collection: 'alpha', offset: 1, count: 1 },
    ]);
    expect(() => planKernelEntryJournalSettlementOutputSegments(plan, () => ({
      collection: 'shared', offset: 0,
    }))).toThrow('aliases a physical output location');
  });

  it('keeps repeated same-slot row carriers immutable during topology-only planning', () => {
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
    const collectionHash = bytes(20, 0xaa);
    const list = SortedList.fromUtxos([
      entry('0', 0n, 10n),
      entry('1', 10n, 0n, 4),
    ]);

    const present = planKernelEntryJournalAccessTopology(list, collectionHash, [
      [{ slot: slot(10n), operation: 'write' }],
      [{ slot: slot(10n), operation: 'write' }],
    ]);
    expect(present.recordCount).toBe(1);
    expect(present.encodedAccessStreams.map(decodeKernelEntryJournalAccesses)).toEqual([
      [{ targetRecordOrdinal: 0, presentBefore: true, presentAfter: true, mutates: true,
        authenticatesTarget: true }],
      [{ targetRecordOrdinal: 0, presentBefore: true, presentAfter: true, mutates: true }],
    ]);
    expect(present.encodedRecords.map(decodeKernelEntryJournalRecord)).toEqual([
      {
        collectionHash, slot: slot(10n), nextKey: slot(0n), value: Uint8Array.of(4),
        authenticated: true, dirty: false, tombstone: false, synthetic: false,
      },
    ]);

    const absent = planKernelEntryJournalAccessTopology(list, collectionHash, [
      [{ slot: slot(20n), operation: 'write' }],
      [{ slot: slot(20n), operation: 'write' }],
    ]);
    expect(absent.recordCount).toBe(2);
    expect(absent.encodedAccessStreams.map(decodeKernelEntryJournalAccesses)).toEqual([
      [{ targetRecordOrdinal: 1, predecessorRecordOrdinal: 0,
        presentBefore: false, presentAfter: true, mutates: true, authenticatesPredecessor: true }],
      [{ targetRecordOrdinal: 1, presentBefore: true, presentAfter: true, mutates: true }],
    ]);
    expect(absent.encodedRecords.map(decodeKernelEntryJournalRecord)).toEqual([
      {
        collectionHash, slot: slot(10n), nextKey: slot(0n), value: Uint8Array.of(4),
        authenticated: true, dirty: false, tombstone: false, synthetic: false,
      },
      {
        collectionHash, slot: slot(20n), nextKey: slot(0n), value: new Uint8Array(),
        authenticated: false, dirty: false, tombstone: true, synthetic: true,
      },
    ]);
  });

  it('round-trips insert, update, delete, and absent-delete access states', () => {
    const accesses = [
      { targetRecordOrdinal: 1, predecessorRecordOrdinal: 0, presentBefore: false, presentAfter: true, mutates: true },
      { targetRecordOrdinal: 1, presentBefore: true, presentAfter: true, mutates: true },
      { targetRecordOrdinal: 1, predecessorRecordOrdinal: 0, presentBefore: true, presentAfter: false, mutates: true },
      { targetRecordOrdinal: 2, predecessorRecordOrdinal: 0, presentBefore: false, presentAfter: false, mutates: true },
    ];
    const encoded = encodeKernelEntryJournalAccesses(ACCESS_COLLECTION_HASH, accesses);
    expect(encoded[0]).toBe(KERNEL_ENTRY_JOURNAL_ACCESS_TAG);
    expect(encoded).toHaveLength(22 + accesses.length * 5);
    expect(encoded.slice(2, 22)).toEqual(ACCESS_COLLECTION_HASH);
    expect(decodeKernelEntryJournalAccesses(encoded)).toEqual(accesses);
  });

  it('keeps the largest compact access program within one BCH item', () => {
    const accesses = Array.from({ length: KERNEL_ENTRY_JOURNAL_MAX_ACCESSES }, (_unused, ordinal) => ({
      targetRecordOrdinal: ordinal,
      presentBefore: true,
      presentAfter: true,
      mutates: ordinal % 2 === 0,
    }));
    const encoded = encodeKernelEntryJournalAccesses(ACCESS_COLLECTION_HASH, accesses);
    expect(encoded).toHaveLength(517);
    expect(encoded.length).toBeLessThanOrEqual(520);
    expect(decodeKernelEntryJournalAccesses(encoded)).toEqual(accesses);
    expect(() => encodeKernelEntryJournalAccesses(ACCESS_COLLECTION_HASH, [...accesses, accesses[0]]))
      .toThrow(`exceeds ${KERNEL_ENTRY_JOURNAL_MAX_ACCESSES}`);
  });

  it('rejects malformed access programs and reserved or aliased ordinals', () => {
    expect(() => encodeKernelEntryJournalAccesses(ACCESS_COLLECTION_HASH, [{
      targetRecordOrdinal: 65535, presentBefore: true, presentAfter: true, mutates: true,
    }])).toThrow('below 65535');
    expect(() => encodeKernelEntryJournalAccesses(ACCESS_COLLECTION_HASH, [{
      targetRecordOrdinal: 1, predecessorRecordOrdinal: 1, presentBefore: false, presentAfter: true, mutates: true,
    }])).toThrow('must differ');
    expect(() => encodeKernelEntryJournalAccesses(ACCESS_COLLECTION_HASH, [{
      targetRecordOrdinal: 1, predecessorRecordOrdinal: 0,
      presentBefore: true, presentAfter: true, mutates: true,
    }])).toThrow('match its topology transition');
    expect(() => encodeKernelEntryJournalAccesses(ACCESS_COLLECTION_HASH, [{
      targetRecordOrdinal: 1, predecessorRecordOrdinal: 0,
      presentBefore: false, presentAfter: true, mutates: false,
    }])).toThrow('must preserve target presence');
    expect(() => encodeKernelEntryJournalAccesses(ACCESS_COLLECTION_HASH, [{
      targetRecordOrdinal: 1, presentBefore: true, presentAfter: true, mutates: false,
      authenticatesPredecessor: true,
    }])).toThrow('cannot authenticate an absent predecessor');
    expect(() => encodeKernelEntryJournalAccesses(ACCESS_COLLECTION_HASH, [{
      targetRecordOrdinal: 1, predecessorRecordOrdinal: 0,
      presentBefore: false, presentAfter: true, mutates: true, authenticatesTarget: true,
    }])).toThrow('cannot authenticate an absent target');
    expect(() => encodeKernelEntryJournalAccesses(bytes(19, 0), [])).toThrow('exactly 20');
    expect(() => decodeKernelEntryJournalAccesses(Uint8Array.of(0x06))).toThrow('truncated');
    const valid = encodeKernelEntryJournalAccesses(ACCESS_COLLECTION_HASH, [{
      targetRecordOrdinal: 0, presentBefore: true, presentAfter: true, mutates: false,
    }]);
    const wrongTag = new Uint8Array(valid); wrongTag[0] = 0x07;
    expect(() => decodeKernelEntryJournalAccesses(wrongTag)).toThrow('tag');
    expect(() => decodeKernelEntryJournalAccesses(valid.slice(0, -1))).toThrow('length');
    const unknownFlags = new Uint8Array(valid); unknownFlags[22] = 0x80;
    expect(() => decodeKernelEntryJournalAccesses(unknownFlags)).toThrow('unknown flags');
    const reservedTarget = new Uint8Array(valid); reservedTarget[23] = 0xff; reservedTarget[24] = 0xff;
    expect(() => decodeKernelEntryJournalAccesses(reservedTarget)).toThrow('reserved target');
    const nonCanonicalPredecessor = new Uint8Array(valid);
    nonCanonicalPredecessor[25] = 0; nonCanonicalPredecessor[26] = 0;
    expect(() => decodeKernelEntryJournalAccesses(nonCanonicalPredecessor))
      .toThrow('non-canonical predecessor');
    const falseTopologyPredecessor = new Uint8Array(valid);
    falseTopologyPredecessor[22] |= 0x04;
    falseTopologyPredecessor[25] = 1; falseTopologyPredecessor[26] = 0;
    expect(() => decodeKernelEntryJournalAccesses(falseTopologyPredecessor))
      .toThrow('match its topology transition');
    const falseAuthenticatedPredecessor = new Uint8Array(valid);
    falseAuthenticatedPredecessor[22] |= 0x20;
    expect(() => decodeKernelEntryJournalAccesses(falseAuthenticatedPredecessor))
      .toThrow('cannot authenticate an absent predecessor');
    const falseAuthenticatedTarget = encodeKernelEntryJournalAccesses(ACCESS_COLLECTION_HASH, [{
      targetRecordOrdinal: 1, predecessorRecordOrdinal: 0,
      presentBefore: false, presentAfter: true, mutates: true,
    }]);
    falseAuthenticatedTarget[22] |= 0x10;
    expect(() => decodeKernelEntryJournalAccesses(falseAuthenticatedTarget))
      .toThrow('cannot authenticate an absent target');
    const falseCleanTransition = encodeKernelEntryJournalAccesses(ACCESS_COLLECTION_HASH, [{
      targetRecordOrdinal: 1, predecessorRecordOrdinal: 0,
      presentBefore: false, presentAfter: true, mutates: true,
    }]);
    falseCleanTransition[22] &= ~0x08;
    expect(() => decodeKernelEntryJournalAccesses(falseCleanTransition))
      .toThrow('must preserve target presence');
  });
});
