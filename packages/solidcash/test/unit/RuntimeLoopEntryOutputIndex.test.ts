import { describe, expect, it } from 'vitest';
import { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';

describe('runtime loop entry output indices', () => {
  it('resolves interleaved segments after unsegmented entry outputs', () => {
    const builder = Object.create(StatefulTransactionBuilder.prototype) as StatefulTransactionBuilder & {
      categoryId: string;
      loopEntryVars: Array<{ collection: string; lockingBytecode: Uint8Array }>;
      loopEntryCommitments: Map<string, string[]>;
      runtimeLoopTrailingSegments: Array<{
        kind: 'entries'; collection: string; offset: number; count: number;
      }>;
      kernelJournalSettlementOutputPlan: unknown[];
      kernelJournalEagerOutputPlan: unknown[];
      getLoopEntryOutputBase: () => number;
    };
    builder.categoryId = '00'.repeat(32);
    builder.loopEntryVars = ['fixed', 'a', 'b'].map((collection) => ({
      collection, lockingBytecode: new Uint8Array(),
    }));
    builder.loopEntryCommitments = new Map([
      ['fixed', ['f0', 'f1']], ['a', ['a0', 'a1']], ['b', ['b0']],
    ]);
    builder.runtimeLoopTrailingSegments = [
      { kind: 'entries', collection: 'a', offset: 0, count: 1 },
      { kind: 'entries', collection: 'b', offset: 0, count: 1 },
      { kind: 'entries', collection: 'a', offset: 1, count: 1 },
    ];
    builder.kernelJournalSettlementOutputPlan = [];
    builder.kernelJournalEagerOutputPlan = [];
    builder.getLoopEntryOutputBase = () => 10;

    expect(builder.getLoopEntryOutputIndex('a', 0)).toBe(12);
    expect(builder.getLoopEntryOutputIndex('b', 0)).toBe(13);
    expect(builder.getLoopEntryOutputIndex('a', 1)).toBe(14);
    expect(() => builder.getLoopEntryOutputIndex('b', 1)).toThrow(/missing from the output plan/);
  });

  it('preserves a same-collection unsegmented prefix before interleaved effects', () => {
    const builder = Object.create(StatefulTransactionBuilder.prototype) as StatefulTransactionBuilder & {
      categoryId: string;
      loopEntryVars: Array<{ collection: string; lockingBytecode: Uint8Array }>;
      loopEntryCommitments: Map<string, string[]>;
      runtimeLoopTrailingSegments: Array<
      | { kind: 'entries'; collection: string; offset: number; count: number }
      | { kind: 'events'; offset: number; count: number }
      | { kind: 'transfers'; offset: number; count: number }
      >;
      runtimeLoopEventOutputs: unknown[];
      runtimeLoopTransferOutputs: unknown[];
      compilerRouteDelegateBlock: boolean;
      kernelJournalSettlementOutputPlan: unknown[];
      kernelJournalEagerOutputPlan: unknown[];
      getLoopEntryOutputBase: () => number;
      getChunkOutputBase: () => number;
    };
    builder.categoryId = '00'.repeat(32);
    builder.loopEntryVars = [{ collection: 'entries', lockingBytecode: new Uint8Array() }];
    builder.loopEntryCommitments = new Map([['entries', ['fixed', 'r0', 'r1']]]);
    builder.runtimeLoopTrailingSegments = [
      { kind: 'entries', collection: 'entries', offset: 1, count: 1 },
      { kind: 'events', offset: 0, count: 1 },
      { kind: 'transfers', offset: 0, count: 1 },
      { kind: 'entries', collection: 'entries', offset: 2, count: 1 },
    ];
    builder.runtimeLoopEventOutputs = [{}];
    builder.runtimeLoopTransferOutputs = [{}];
    builder.compilerRouteDelegateBlock = false;
    builder.kernelJournalSettlementOutputPlan = [];
    builder.kernelJournalEagerOutputPlan = [];
    builder.getLoopEntryOutputBase = () => 7;
    builder.getChunkOutputBase = () => 12;

    expect(builder.getLoopEntryOutputIndex('entries', 0)).toBe(7);
    expect(builder.getLoopEntryOutputIndex('entries', 1)).toBe(8);
    expect(builder.getRuntimeLoopEventOutputIndex(0)).toBe(9);
    expect(builder.getRuntimeLoopTransferOutputIndex(0)).toBe(10);
    expect(builder.getLoopEntryOutputIndex('entries', 2)).toBe(11);
  });

  it('rejects duplicate, gapped, and incomplete entry segment ranges', () => {
    const builder = Object.create(StatefulTransactionBuilder.prototype) as StatefulTransactionBuilder & {
      categoryId: string;
      loopEntryVars: Array<{ collection: string; lockingBytecode: Uint8Array }>;
      loopEntryCommitments: Map<string, string[]>;
      runtimeLoopTrailingSegments: Array<{
        kind: 'entries'; collection: string; offset: number; count: number;
      }>;
      kernelJournalSettlementOutputPlan: unknown[];
      kernelJournalEagerOutputPlan: unknown[];
      getLoopEntryOutputBase: () => number;
    };
    builder.categoryId = '00'.repeat(32);
    builder.loopEntryVars = [{ collection: 'entries', lockingBytecode: new Uint8Array() }];
    builder.loopEntryCommitments = new Map([['entries', ['a', 'b', 'c']]]);
    builder.getLoopEntryOutputBase = () => 0;
    builder.kernelJournalSettlementOutputPlan = [];
    builder.kernelJournalEagerOutputPlan = [];

    builder.runtimeLoopTrailingSegments = [
      { kind: 'entries', collection: 'entries', offset: 0, count: 2 },
      { kind: 'entries', collection: 'entries', offset: 1, count: 2 },
    ];
    expect(() => builder.getLoopEntryOutputIndex('entries', 0)).toThrow(/overlap or have a gap/);
    builder.runtimeLoopTrailingSegments = [
      { kind: 'entries', collection: 'entries', offset: 0, count: 1 },
      { kind: 'entries', collection: 'entries', offset: 2, count: 1 },
    ];
    expect(() => builder.getLoopEntryOutputIndex('entries', 0)).toThrow(/overlap or have a gap/);
    builder.runtimeLoopTrailingSegments = [
      { kind: 'entries', collection: 'entries', offset: 0, count: 2 },
    ];
    expect(() => builder.getLoopEntryOutputIndex('entries', 0)).toThrow(/cover 2 of 3 commitments/);
  });
});
