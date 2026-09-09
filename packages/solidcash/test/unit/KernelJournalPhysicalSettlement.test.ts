import { describe, expect, it } from 'vitest';
import type { JournalSettlementIdentityAbi } from '@solidcash/utils';
import { planKernelEntryJournalPhysicalSettlement } from '../../src/stateful/KernelEntryJournal.js';

const identity = (
  accessStreamIndex: number,
  settlementRole: JournalSettlementIdentityAbi['settlementRole'],
): JournalSettlementIdentityAbi => ({
  accessStreamIndex,
  recordOrdinalScope: 'global-journal',
  accessOrdinalSource: 'access-program-order',
  recordOrdinalSources: ['target-record-ordinal', 'predecessor-record-ordinal'],
  settlementRole,
  settlementOwnership: settlementRole === 'mutation-settlement' ? 'last-mutating-access' : 'none',
  recordDispositionSource: settlementRole === 'mutation-settlement'
    ? 'mutation-settlement' : 'authenticated-carrier',
});

describe('kernel journal physical settlement plan', () => {
  it('separates source-order first inputs from dense global final outputs and normalizes clean consumers', () => {
    const sourceCarrier = {
      frameIndex: 0, identity: identity(2, 'carrier-only'), accessOrdinal: 0,
      access: {
        targetRecordOrdinal: 9, presentBefore: true, presentAfter: true, mutates: false,
        authenticatesTarget: true,
      },
    };
    const dirtyWrite = {
      frameIndex: 1, identity: identity(0, 'mutation-settlement'), accessOrdinal: 0,
      access: {
        targetRecordOrdinal: 3, presentBefore: true, presentAfter: true, mutates: true,
        authenticatesTarget: true,
      },
    };
    const sourceConsumer = {
      frameIndex: 2, identity: identity(4, 'carrier-only'), accessOrdinal: 0,
      access: {
        targetRecordOrdinal: 9, presentBefore: true, presentAfter: true, mutates: false,
        // A topology prepass can conservatively set this; physical ownership must clear it.
        authenticatesTarget: true,
      },
    };
    const absentOwner = {
      frameIndex: 0, identity: identity(3, 'carrier-only'), accessOrdinal: 0,
      access: {
        targetRecordOrdinal: 20, predecessorRecordOrdinal: 4,
        presentBefore: false, presentAfter: false, mutates: false,
        authenticatesPredecessor: true,
      },
    };
    const absentConsumer = {
      frameIndex: 3, identity: identity(1, 'carrier-only'), accessOrdinal: 0,
      access: {
        targetRecordOrdinal: 21, predecessorRecordOrdinal: 4,
        presentBefore: false, presentAfter: false, mutates: false,
        authenticatesPredecessor: true,
      },
    };
    const syntheticWrite = {
      frameIndex: 1, identity: identity(0, 'mutation-settlement'), accessOrdinal: 1,
      access: {
        targetRecordOrdinal: 7, predecessorRecordOrdinal: 3,
        presentBefore: false, presentAfter: true, mutates: true,
        // The predecessor is an already-owned dirty input. It must not acquire a second authority.
      },
    };
    const plan = planKernelEntryJournalPhysicalSettlement([
      sourceCarrier, dirtyWrite, sourceConsumer, absentOwner, absentConsumer, syntheticWrite,
    ]);

    // Inputs are first physical authentications in source order, not ordinal order. Synthetic record 7 has no input.
    expect(plan.inputs.map(({ recordOrdinal, recordRole, firstOwner }) => ({
      recordOrdinal, recordRole, frame: firstOwner.frameIndex, stream: firstOwner.accessStreamIndex,
    }))).toEqual([
      { recordOrdinal: 9, recordRole: 'target', frame: 0, stream: 2 },
      { recordOrdinal: 3, recordRole: 'target', frame: 1, stream: 0 },
      { recordOrdinal: 4, recordRole: 'predecessor', frame: 0, stream: 3 },
    ]);
    // Final flushing is dense and global-record ordered. The absent targets 20/21 have no output.
    expect(plan.outputs.map(({ recordOrdinal, outputOrdinal, finalOwner }) => ({
      recordOrdinal, outputOrdinal, frame: finalOwner.frameIndex, stream: finalOwner.accessStreamIndex,
    }))).toEqual([
      { recordOrdinal: 3, outputOrdinal: 0, frame: 1, stream: 0 },
      { recordOrdinal: 4, outputOrdinal: 1, frame: 0, stream: 3 },
      { recordOrdinal: 7, outputOrdinal: 2, frame: 1, stream: 0 },
      { recordOrdinal: 9, outputOrdinal: 3, frame: 0, stream: 2 },
    ]);
    expect(plan.finalOutputCursorDelta).toBe(plan.outputs.length);
    expect(plan.occurrences.map(({ access, materializesInput, rewritesToZeroAuthConsumer }) => ({
      target: access.targetRecordOrdinal,
      authenticatesTarget: access.authenticatesTarget,
      authenticatesPredecessor: access.authenticatesPredecessor,
      materializesInput,
      rewritesToZeroAuthConsumer,
    }))).toEqual([
      { target: 9, authenticatesTarget: true, authenticatesPredecessor: undefined, materializesInput: true, rewritesToZeroAuthConsumer: false },
      { target: 3, authenticatesTarget: true, authenticatesPredecessor: undefined, materializesInput: true, rewritesToZeroAuthConsumer: false },
      { target: 9, authenticatesTarget: undefined, authenticatesPredecessor: undefined, materializesInput: false, rewritesToZeroAuthConsumer: true },
      { target: 20, authenticatesTarget: undefined, authenticatesPredecessor: true, materializesInput: true, rewritesToZeroAuthConsumer: false },
      { target: 21, authenticatesTarget: undefined, authenticatesPredecessor: undefined, materializesInput: false, rewritesToZeroAuthConsumer: true },
      { target: 7, authenticatesTarget: undefined, authenticatesPredecessor: undefined, materializesInput: false, rewritesToZeroAuthConsumer: false },
    ]);
    expect(plan.streamAccounting).toEqual([
      { frameIndex: 0, accessStreamIndex: 2, inputCount: 1, outputCount: 1 },
      { frameIndex: 0, accessStreamIndex: 3, inputCount: 1, outputCount: 1 },
      { frameIndex: 1, accessStreamIndex: 0, inputCount: 1, outputCount: 2 },
      { frameIndex: 2, accessStreamIndex: 4, inputCount: 0, outputCount: 0 },
      { frameIndex: 3, accessStreamIndex: 1, inputCount: 0, outputCount: 0 },
    ]);
  });

  it('fails closed for a consumer before its owner, repeated dirty proof, or unauthenticated live record', () => {
    const clean = (authenticatesTarget: boolean, frameIndex: number) => ({
      frameIndex, identity: identity(0, 'carrier-only'), accessOrdinal: 0,
      access: { targetRecordOrdinal: 1, presentBefore: true, presentAfter: true, mutates: false, authenticatesTarget },
    });
    expect(() => planKernelEntryJournalPhysicalSettlement([clean(false, 0), clean(true, 1)]))
      .toThrow('consumer precedes authenticated producer');
    expect(() => planKernelEntryJournalPhysicalSettlement([{
      frameIndex: 0, identity: identity(0, 'mutation-settlement'), accessOrdinal: 0,
      access: { targetRecordOrdinal: 1, presentBefore: true, presentAfter: true, mutates: true, authenticatesTarget: true },
    }, {
      frameIndex: 1, identity: identity(1, 'mutation-settlement'), accessOrdinal: 0,
      access: { targetRecordOrdinal: 1, presentBefore: true, presentAfter: true, mutates: true, authenticatesTarget: true },
    }])).toThrow('multiple non-clean authenticators');
    expect(() => planKernelEntryJournalPhysicalSettlement([clean(false, 0)]))
      .toThrow('has no authenticated producer');
  });
});
