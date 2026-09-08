import {
  KERNEL_ENTRY_JOURNAL_MAX_RECORDS,
  KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS,
  KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX,
  decodePushdataValue,
} from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  encodeKernelEntryJournalRecord,
  kernelEntryJournalRecordPosition,
  segmentKernelEntryJournalRecords,
  validateKernelEntryJournalRecordSegmentSlots,
  validateKernelEntryJournalRecordSegments,
} from '../../src/stateful/KernelEntryJournal.js';
import {
  assertKernelJournalRecordBudget,
  kernelJournalRecordSegmentWitnesses,
} from '../../src/stateful/StatefulContract.js';

const record = (ordinal: number): Uint8Array => encodeKernelEntryJournalRecord({
  collectionHash: new Uint8Array(20).fill((ordinal % 251) + 1),
  slot: new Uint8Array(32).fill((ordinal % 251) + 1),
  nextKey: new Uint8Array(32),
  value: new Uint8Array(),
  authenticated: true,
  dirty: false,
  tombstone: false,
  synthetic: false,
});

const segmentInput = (index: number): { name: string; type: string } => ({
  name: `${KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX}${index}`,
  type: 'bytes',
});

describe('kernel journal protocol budget', () => {
  it('enforces the global record cap across independently planned streams', () => {
    expect(KERNEL_ENTRY_JOURNAL_MAX_RECORDS).toBe(99);
    expect(assertKernelJournalRecordBudget([49, 50])).toBe(99);
    expect(() => assertKernelJournalRecordBudget([50, 50]))
      .toThrow('100 records across all streams, exceeding the protocol cap of 99');
  });

  it('fills and validates every segment slot at the record boundary', () => {
    const records = Array.from({ length: KERNEL_ENTRY_JOURNAL_MAX_RECORDS }, (_unused, ordinal) => record(ordinal));
    const inputs = Array.from({ length: KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS }, (_unused, index) =>
      segmentInput(index));
    const witnesses = kernelJournalRecordSegmentWitnesses(inputs, records);

    expect(witnesses.slots).toHaveLength(KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS);
    const decoded = witnesses.slots.flatMap((slot) =>
      decodePushdataValue(slot.carrier, 0, 'bytes[]').value as Uint8Array[]);
    expect(decoded).toHaveLength(KERNEL_ENTRY_JOURNAL_MAX_RECORDS);
    expect(witnesses.slots.every((slot) =>
      (decodePushdataValue(slot.carrier, 0, 'bytes[]').value as Uint8Array[]).length === 3)).toBe(true);
    expect(kernelEntryJournalRecordPosition(98, records.length))
      .toEqual({ segmentIndex: 32, segmentRecordIndex: 2 });
    expect(() => kernelEntryJournalRecordPosition(99, records.length)).toThrow('out of range');
    expect(() => segmentKernelEntryJournalRecords([...records, record(99)]))
      .toThrow('must not exceed 99');
  });

  it('rejects sparse and over-capacity segment partitions', () => {
    const records = Array.from({ length: 4 }, (_unused, ordinal) => record(ordinal));
    const [full, tail] = segmentKernelEntryJournalRecords(records);
    expect(() => validateKernelEntryJournalRecordSegments([[...full, tail[0]]]))
      .toThrow('non-canonical record partition');
    expect(() => validateKernelEntryJournalRecordSegmentSlots([full, [], tail], 2))
      .toThrow('authenticated non-empty prefix');
    expect(() => validateKernelEntryJournalRecordSegmentSlots([full, [], tail], 3))
      .toThrow('authenticated non-empty prefix');
  });

  it('rejects compiler ABI segment slots outside the protocol domain', () => {
    const inputs = Array.from({ length: KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS + 1 }, (_unused, index) =>
      segmentInput(index));
    expect(() => kernelJournalRecordSegmentWitnesses(inputs, []))
      .toThrow(`exceeds the protocol cap of ${KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS} slots`);
  });
});
