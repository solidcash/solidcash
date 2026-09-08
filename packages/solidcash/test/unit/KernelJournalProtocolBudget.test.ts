import {
  KERNEL_ENTRY_JOURNAL_MAX_RECORDS,
  KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS,
  KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX,
} from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { encodeKernelEntryJournalRecord } from '../../src/stateful/KernelEntryJournal.js';
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
  type: 'bytes[]',
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
    expect(witnesses.slots.flatMap((slot) => slot.records)).toHaveLength(KERNEL_ENTRY_JOURNAL_MAX_RECORDS);
    expect(witnesses.slots.every((slot) => slot.records.length === 3)).toBe(true);
  });

  it('rejects compiler ABI segment slots outside the protocol domain', () => {
    const inputs = Array.from({ length: KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS + 1 }, (_unused, index) =>
      segmentInput(index));
    expect(() => kernelJournalRecordSegmentWitnesses(inputs, []))
      .toThrow(`exceeds the protocol cap of ${KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS} slots`);
  });
});
