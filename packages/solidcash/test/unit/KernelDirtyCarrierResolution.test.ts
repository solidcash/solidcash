import { describe, expect, it } from 'vitest';
import {
  resolveKernelEntryJournalDirtyFinalBodies,
  type KernelEntryJournalDirtyFinalBodyProducer,
  type KernelEntryJournalPhysicalSettlementPlan,
  type KernelEntryJournalRecord,
} from '../../src/stateful/KernelEntryJournal.js';
import { encodeEntryCommitment } from '../../src/stateful/SortedList.js';

const bytes = (length: number, fill: number): Uint8Array => new Uint8Array(length).fill(fill);
const producer = (accessOrdinal = 0): KernelEntryJournalDirtyFinalBodyProducer => ({
  frameIndex: 0, accessStreamIndex: 0, accessOrdinal, recordRole: 'target' as const,
});

describe('kernel dirty carrier final-body binding', () => {
  it('accepts one complete body only after the caller binds it to the final global ordinal', () => {
    const slot = bytes(32, 0x11);
    const record: KernelEntryJournalRecord = {
      collectionHash: bytes(20, 0xaa), slot, nextKey: bytes(32, 0x22), value: Uint8Array.of(1),
      authenticated: true, dirty: true, tombstone: false, synthetic: false,
    };
    const plan = { outputs: [{ recordOrdinal: 0, outputOrdinal: 0, finalOwner: producer() }] } as Pick<
    KernelEntryJournalPhysicalSettlementPlan, 'outputs'
    >;
    const finalBody = encodeEntryCommitment(slot, record.nextKey, Uint8Array.of(9));

    expect(resolveKernelEntryJournalDirtyFinalBodies(plan, [record], [{
      producer: producer(), commitment: finalBody,
    }])).toEqual([{ recordOrdinal: 0, outputOrdinal: 0, commitment: finalBody }]);
  });

  it('rejects ambiguous, cross-ordinal, and wrong-slot candidates rather than picking a provisional body', () => {
    const slot = bytes(32, 0x11);
    const record: KernelEntryJournalRecord = {
      collectionHash: bytes(20, 0xaa), slot, nextKey: bytes(32, 0x22), value: Uint8Array.of(1),
      authenticated: true, dirty: true, tombstone: false, synthetic: false,
    };
    const plan = { outputs: [{ recordOrdinal: 0, outputOrdinal: 0, finalOwner: producer() }] } as Pick<
    KernelEntryJournalPhysicalSettlementPlan, 'outputs'
    >;
    const body = encodeEntryCommitment(slot, record.nextKey, Uint8Array.of(9));

    expect(() => resolveKernelEntryJournalDirtyFinalBodies(plan, [record], [])).toThrow('exactly one');
    expect(() => resolveKernelEntryJournalDirtyFinalBodies(plan, [record], [
      { producer: producer(), commitment: body }, { producer: producer(), commitment: body },
    ])).toThrow('exactly one');
    expect(() => resolveKernelEntryJournalDirtyFinalBodies(plan, [record], [{
      producer: producer(1), commitment: body,
    }])).toThrow('unexpected producer');
    expect(() => resolveKernelEntryJournalDirtyFinalBodies(plan, [record], [{
      producer: producer(), commitment: encodeEntryCommitment(bytes(32, 0x44), record.nextKey, Uint8Array.of(9)),
    }])).toThrow('slot mismatches');
  });
});
