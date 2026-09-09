import { describe, expect, it } from 'vitest';
import {
  resolveKernelEntryJournalDirtyFinalBodies,
  type KernelEntryJournalPhysicalSettlementPlan,
  type KernelEntryJournalRecord,
} from '../../src/stateful/KernelEntryJournal.js';
import { encodeEntryCommitment } from '../../src/stateful/SortedList.js';

const bytes = (length: number, fill: number): Uint8Array => new Uint8Array(length).fill(fill);

describe('kernel dirty carrier final-body binding', () => {
  it('accepts one complete body only after the caller binds it to the final global ordinal', () => {
    const slot = bytes(32, 0x11);
    const record: KernelEntryJournalRecord = {
      collectionHash: bytes(20, 0xaa), slot, nextKey: bytes(32, 0x22), value: Uint8Array.of(1),
      authenticated: true, dirty: true, tombstone: false, synthetic: false,
    };
    const plan = { outputs: [{ recordOrdinal: 0, outputOrdinal: 0 }] } as Pick<
      KernelEntryJournalPhysicalSettlementPlan, 'outputs'
    >;
    const finalBody = encodeEntryCommitment(slot, bytes(32, 0x33), Uint8Array.of(9));

    expect(resolveKernelEntryJournalDirtyFinalBodies(plan, [record], [{
      recordOrdinal: 0, commitment: finalBody,
    }])).toEqual([{ recordOrdinal: 0, outputOrdinal: 0, commitment: finalBody }]);
  });

  it('rejects ambiguous, cross-ordinal, and wrong-slot candidates rather than picking a provisional body', () => {
    const slot = bytes(32, 0x11);
    const record: KernelEntryJournalRecord = {
      collectionHash: bytes(20, 0xaa), slot, nextKey: bytes(32, 0x22), value: Uint8Array.of(1),
      authenticated: true, dirty: true, tombstone: false, synthetic: false,
    };
    const plan = { outputs: [{ recordOrdinal: 0, outputOrdinal: 0 }] } as Pick<
      KernelEntryJournalPhysicalSettlementPlan, 'outputs'
    >;
    const body = encodeEntryCommitment(slot, bytes(32, 0x33), Uint8Array.of(9));

    expect(() => resolveKernelEntryJournalDirtyFinalBodies(plan, [record], [])).toThrow('exactly one');
    expect(() => resolveKernelEntryJournalDirtyFinalBodies(plan, [record], [
      { recordOrdinal: 0, commitment: body }, { recordOrdinal: 0, commitment: body },
    ])).toThrow('exactly one');
    expect(() => resolveKernelEntryJournalDirtyFinalBodies(plan, [record], [{
      recordOrdinal: 1, commitment: body,
    }])).toThrow('unexpected candidate');
    expect(() => resolveKernelEntryJournalDirtyFinalBodies(plan, [record], [{
      recordOrdinal: 0, commitment: encodeEntryCommitment(bytes(32, 0x44), bytes(32, 0x33), Uint8Array.of(9)),
    }])).toThrow('slot mismatches');
  });
});
