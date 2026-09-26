import { describe, expect, it } from 'vitest';
import { INDEX_NONE, type RecordEntry } from '@solidcash/utils';
import {
  assertCompositionSettlement, assertOutputOccupancy, assertRecordChains, outputIssues, OutputOccupancyError,
  recordChainIssues, RecordChainError,
  type SettlementFacts,
} from '../../../src/per-call/composer/settlement.js';

/**
 * The record chain a settlement has to satisfy, driven through the shipped check.
 *
 * A frame's segments each declare a record's commitment at the segment's start and end. Chaining those declarations
 * is what makes a list of segments one transition, so the tests state the chain directly rather than building a
 * composition that happens to have one: each case varies exactly one declaration, so an issue is attributable.
 */

// Three commitments a record can hold in turn, and a fourth that belongs to no chain here.
const SPENT = new Uint8Array([0xa0]);
const MIDDLE = new Uint8Array([0xa1]);
const WRITTEN = new Uint8Array([0xa2]);
const STRAY = new Uint8Array([0xa9]);

const kept = (viewIn: Uint8Array, viewOut: Uint8Array, index = 0): RecordEntry =>
  ({ in: index, out: index, viewIn, viewOut });
const created = (out: number, viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry =>
  ({ in: INDEX_NONE, out, viewIn, viewOut });
const deleted = (index: number, viewIn: Uint8Array): RecordEntry =>
  ({ in: index, out: INDEX_NONE, viewIn, viewOut: new Uint8Array(0) });

const facts = (overrides: Partial<SettlementFacts> = {}): SettlementFacts => ({
  inputCommitments: new Map([[0, SPENT]]),
  outputCommitments: new Map([[0, WRITTEN]]),
  ...overrides,
});

describe('a record chain', () => {
  it('accepts two segments that carry a record from what is spent to what is written', () => {
    const segments = [[kept(SPENT, MIDDLE)], [kept(MIDDLE, WRITTEN)]];
    expect(recordChainIssues(segments, facts())).toStrictEqual([]);
    expect(() => assertRecordChains(segments, facts())).not.toThrow();
  });

  it('refuses a segment that does not carry on from the one before it', () => {
    const issues = recordChainIssues([[kept(SPENT, MIDDLE)], [kept(STRAY, WRITTEN)]], facts());
    expect(issues).toHaveLength(1);
    expect(issues[0]!.segment).toBe(1);
    expect(issues[0]!.reason).toMatch(/carry on from segment 0/);
  });

  it('refuses a first declaration that does not match what the transaction spends', () => {
    const issues = recordChainIssues([[kept(STRAY, MIDDLE)], [kept(MIDDLE, WRITTEN)]], facts());
    expect(issues).toHaveLength(1);
    expect(issues[0]!.segment).toBe(0);
    expect(issues[0]!.reason).toMatch(/does not match the commitment spent at input 0/);
  });

  it('refuses a last declaration that does not match what the transaction writes', () => {
    const issues = recordChainIssues([[kept(SPENT, MIDDLE)], [kept(MIDDLE, STRAY)]], facts());
    expect(issues).toHaveLength(1);
    expect(issues[0]!.reason).toMatch(/does not match the commitment written at output 0/);
  });

  it('refuses a record the transaction neither spends nor writes', () => {
    // A record with no home is wrong in both directions, and both are reported: nothing holds it when the chain
    // starts, and nothing holds it when the chain ends.
    const issues = recordChainIssues([[kept(SPENT, MIDDLE, 4)]], facts());
    expect(issues[0]!.segment).toBe(0);
    expect(issues[0]!.reason).toMatch(/input 4 is not one the transaction spends/);
    expect(issues.some((issue) => /writes nothing at output 4/.test(issue.reason))).toBe(true);

    const noOutput = recordChainIssues([[kept(SPENT, WRITTEN)]], {
      inputCommitments: new Map([[0, SPENT]]), outputCommitments: new Map(),
    });
    expect(noOutput.some((issue) => /writes nothing at output 0/.test(issue.reason))).toBe(true);
  });

  it('accepts a record the transaction creates and then carries', () => {
    // A created record is known by the output it appears at, and nothing is spent for it.
    const segments = [[created(7, new Uint8Array(0), MIDDLE)], [kept(MIDDLE, WRITTEN, 7)]];
    const withCreated = facts({ inputCommitments: new Map([[0, SPENT]]), outputCommitments: new Map([[7, WRITTEN]]) });
    expect(recordChainIssues(segments, withCreated)).toStrictEqual([]);
  });

  it('refuses a record created twice', () => {
    const segments = [[created(7, new Uint8Array(0), MIDDLE)], [created(7, MIDDLE, WRITTEN)]];
    const issues = recordChainIssues(segments, facts({ outputCommitments: new Map([[7, WRITTEN]]) }));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.reason).toMatch(/created after it already existed/);
  });

  it('accepts a deletion as a record\'s last declaration, with nothing written for it', () => {
    const segments = [[kept(SPENT, MIDDLE)], [deleted(0, MIDDLE)]];
    const deleting = facts({ outputCommitments: new Map() });
    expect(recordChainIssues(segments, deleting)).toStrictEqual([]);
  });

  it('refuses a record touched after its deletion', () => {
    const segments = [[kept(SPENT, MIDDLE)], [deleted(0, MIDDLE)], [kept(MIDDLE, WRITTEN)]];
    const issues = recordChainIssues(segments, facts({ outputCommitments: new Map() }));
    // The touching segment is the fault, and separately the chain now ends claiming a write that is not there.
    const afterDeletion = issues.find((issue) => /already deleted/.test(issue.reason));
    expect(afterDeletion).toBeDefined();
    expect(afterDeletion!.segment).toBe(2);
    expect(issues.some((issue) => /writes nothing at output 0/.test(issue.reason))).toBe(true);
  });

  it('refuses a record that moves between indices', () => {
    const segments = [[{ in: 0, out: 1, viewIn: SPENT, viewOut: MIDDLE }]];
    const issues = recordChainIssues(segments, facts({ outputCommitments: new Map([[0, MIDDLE]]) }));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.reason).toMatch(/moves from 0 to 1/);
  });

  it('names the first declaration that does not hold when it refuses', () => {
    let raised: RecordChainError | undefined;
    try {
      assertRecordChains([[kept(SPENT, MIDDLE)], [kept(STRAY, WRITTEN)]], facts());
    } catch (error) {
      raised = error as RecordChainError;
    }
    expect(raised).toBeInstanceOf(RecordChainError);
    expect(raised!.issue.record).toBe(0);
    expect(raised!.issue.segment).toBe(1);
    expect(raised!.message).toMatch(/record 0 in segment 1/);
  });

  it('reports every failing declaration rather than stopping at the first', () => {
    const issues = recordChainIssues([[kept(STRAY, MIDDLE)], [kept(MIDDLE, STRAY)]], facts());
    expect(issues.length).toBeGreaterThan(1);
  });
});

describe('a composition whose record spans executions', () => {
  it('chains one record across two masters in execution order', () => {
    const order = [
      { master: 'Ledger#0', segments: [[kept(SPENT, MIDDLE)]] },
      { master: 'Vault#0', segments: [[kept(MIDDLE, WRITTEN)]] },
    ];
    expect(() => assertCompositionSettlement(order, facts())).not.toThrow();
  });

  it('refuses the same declarations in the wrong order', () => {
    // The second execution's declaration starts from a state the first never produced.
    const order = [
      { master: 'Ledger#0', segments: [[kept(SPENT, MIDDLE)]] },
      { master: 'Vault#0', segments: [[kept(WRITTEN, MIDDLE)]] },
    ];
    let raised: RecordChainError | undefined;
    try {
      assertCompositionSettlement(order, facts());
    } catch (error) {
      raised = error as RecordChainError;
    }
    expect(raised).toBeInstanceOf(RecordChainError);
    // The fault is inside the second execution's declaration, and the message says so.
    expect(raised!.issue.owner).toBe('Vault#0');
    expect(raised!.message).toMatch(/of Vault#0/);
  });

  it('checks each record separately, so one broken record does not hide another', () => {
    const order = [
      { master: 'Ledger#0', segments: [[kept(SPENT, MIDDLE), kept(SPENT, MIDDLE, 3)]] },
    ];
    const withThird = facts({
      inputCommitments: new Map([[0, SPENT], [3, SPENT]]),
      outputCommitments: new Map([[0, WRITTEN], [3, WRITTEN]]),
    });
    // Record 0 stops at MIDDLE while the transaction writes WRITTEN; record 3 has the same shape.
    const issues = recordChainIssues(order[0]!.segments, withThird);
    expect(issues.filter((issue) => /written at output/.test(issue.reason)).map((issue) => issue.record))
      .toStrictEqual([0, 3]);
  });
});

describe('the output regions', () => {
  const occupancy = (overrides: Partial<Parameters<typeof outputIssues>[0]> = {}) => ({
    records: [0],
    events: [1, 2],
    sends: [3, 4],
    ...overrides,
  });

  it('accepts regions that occupy different outputs', () => {
    expect(outputIssues(occupancy())).toStrictEqual([]);
    expect(() => assertOutputOccupancy(occupancy())).not.toThrow();
  });

  it('accepts empty event and send regions', () => {
    expect(outputIssues(occupancy({ events: [], sends: [] }))).toStrictEqual([]);
  });

  it('refuses two events at one output, which is what makes an event log ambiguous', () => {
    const issues = outputIssues(occupancy({ events: [1, 1] }));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.out).toBe(1);
    expect(issues[0]!.reason).toMatch(/two events name the same output/);
  });

  it('refuses an event and a record at one output', () => {
    const issues = outputIssues(occupancy({ events: [0] }));
    expect(issues.some((issue) => /an event and a record share an output/.test(issue.reason))).toBe(true);
  });

  it('refuses a send at a record or an event output', () => {
    const atRecord = outputIssues(occupancy({ sends: [0] }));
    expect(atRecord.some((issue) => /a send and a record share an output/.test(issue.reason))).toBe(true);
    const atEvent = outputIssues(occupancy({ sends: [2] }));
    expect(atEvent.some((issue) => /a send and an event share an output/.test(issue.reason))).toBe(true);
  });

  it('refuses two records at one output', () => {
    expect(outputIssues(occupancy({ records: [0, 0] })).some((issue) => /two records/.test(issue.reason))).toBe(true);
  });

  it('names the output at fault when it refuses', () => {
    let raised: OutputOccupancyError | undefined;
    try {
      assertOutputOccupancy(occupancy({ sends: [2] }));
    } catch (error) {
      raised = error as OutputOccupancyError;
    }
    expect(raised).toBeInstanceOf(OutputOccupancyError);
    expect(raised!.issue.out).toBe(2);
    expect(raised!.message).toMatch(/output 2: a send and an event share an output/);
  });
});
