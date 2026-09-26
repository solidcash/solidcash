import { describe, expect, it } from 'vitest';
import { INDEX_NONE, type RecordEntry } from '@solidcash/utils';
import {
  assertCompositionSettlement, assertRecordChains, recordChainIssues, RecordChainError,
  type SettlementFacts,
} from '../../../src/per-call/composer/settlement.js';

/**
 * The record chain a settlement has to satisfy, driven through the shipped check.
 *
 * A frame's segments each declare a record's commitment at the segment's start and end. Chaining those declarations
 * is what makes a list of segments one transition, so the tests state the chain directly rather than building a
 * composition that happens to have one: each case varies exactly one declaration, so an issue is attributable.
 */

const C0 = new Uint8Array([0xa0]);
const C1 = new Uint8Array([0xa1]);
const C2 = new Uint8Array([0xa2]);
const C9 = new Uint8Array([0xa9]);

const kept = (viewIn: Uint8Array, viewOut: Uint8Array, index = 0): RecordEntry =>
  ({ in: index, out: index, viewIn, viewOut });
const created = (out: number, viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry =>
  ({ in: INDEX_NONE, out, viewIn, viewOut });
const deleted = (index: number, viewIn: Uint8Array): RecordEntry =>
  ({ in: index, out: INDEX_NONE, viewIn, viewOut: new Uint8Array(0) });

const facts = (overrides: Partial<SettlementFacts> = {}): SettlementFacts => ({
  inputCommitments: new Map([[0, C0]]),
  outputCommitments: new Map([[0, C2]]),
  ...overrides,
});

describe('a record chain', () => {
  it('accepts two segments that carry a record from what is spent to what is written', () => {
    const segments = [[kept(C0, C1)], [kept(C1, C2)]];
    expect(recordChainIssues(segments, facts())).toStrictEqual([]);
    expect(() => assertRecordChains(segments, facts())).not.toThrow();
  });

  it('refuses a segment that does not carry on from the one before it', () => {
    const issues = recordChainIssues([[kept(C0, C1)], [kept(C9, C2)]], facts());
    expect(issues).toHaveLength(1);
    expect(issues[0]!.segment).toBe(1);
    expect(issues[0]!.reason).toMatch(/carry on from segment 0/);
  });

  it('refuses a first declaration that does not match what the transaction spends', () => {
    const issues = recordChainIssues([[kept(C9, C1)], [kept(C1, C2)]], facts());
    expect(issues).toHaveLength(1);
    expect(issues[0]!.segment).toBe(0);
    expect(issues[0]!.reason).toMatch(/does not match the commitment spent at input 0/);
  });

  it('refuses a last declaration that does not match what the transaction writes', () => {
    const issues = recordChainIssues([[kept(C0, C1)], [kept(C1, C9)]], facts());
    expect(issues).toHaveLength(1);
    expect(issues[0]!.reason).toMatch(/does not match the commitment written at output 0/);
  });

  it('refuses a record the transaction neither spends nor writes', () => {
    // A record with no home is wrong in both directions, and both are reported: nothing holds it when the chain
    // starts, and nothing holds it when the chain ends.
    const issues = recordChainIssues([[kept(C0, C1, 4)]], facts());
    expect(issues[0]!.segment).toBe(0);
    expect(issues[0]!.reason).toMatch(/input 4 is not one the transaction spends/);
    expect(issues.some((issue) => /writes nothing at output 4/.test(issue.reason))).toBe(true);

    const noOutput = recordChainIssues([[kept(C0, C2)]], {
      inputCommitments: new Map([[0, C0]]), outputCommitments: new Map(),
    });
    expect(noOutput.some((issue) => /writes nothing at output 0/.test(issue.reason))).toBe(true);
  });

  it('accepts a record the transaction creates and then carries', () => {
    // A created record is known by the output it appears at, and nothing is spent for it.
    const segments = [[created(7, new Uint8Array(0), C1)], [kept(C1, C2, 7)]];
    const withCreated = facts({ inputCommitments: new Map([[0, C0]]), outputCommitments: new Map([[7, C2]]) });
    expect(recordChainIssues(segments, withCreated)).toStrictEqual([]);
  });

  it('refuses a record created twice', () => {
    const segments = [[created(7, new Uint8Array(0), C1)], [created(7, C1, C2)]];
    const issues = recordChainIssues(segments, facts({ outputCommitments: new Map([[7, C2]]) }));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.reason).toMatch(/created after it already existed/);
  });

  it('accepts a deletion as a record\'s last declaration, with nothing written for it', () => {
    const segments = [[kept(C0, C1)], [deleted(0, C1)]];
    const deleting = facts({ outputCommitments: new Map() });
    expect(recordChainIssues(segments, deleting)).toStrictEqual([]);
  });

  it('refuses a record touched after its deletion', () => {
    const segments = [[kept(C0, C1)], [deleted(0, C1)], [kept(C1, C2)]];
    const issues = recordChainIssues(segments, facts({ outputCommitments: new Map() }));
    // The touching segment is the fault, and separately the chain now ends claiming a write that is not there.
    const afterDeletion = issues.find((issue) => /already deleted/.test(issue.reason));
    expect(afterDeletion).toBeDefined();
    expect(afterDeletion!.segment).toBe(2);
    expect(issues.some((issue) => /writes nothing at output 0/.test(issue.reason))).toBe(true);
  });

  it('refuses a record that moves between indices', () => {
    const segments = [[{ in: 0, out: 1, viewIn: C0, viewOut: C1 }]];
    const issues = recordChainIssues(segments, facts({ outputCommitments: new Map([[0, C1]]) }));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.reason).toMatch(/moves from 0 to 1/);
  });

  it('names the first declaration that does not hold when it refuses', () => {
    let raised: RecordChainError | undefined;
    try {
      assertRecordChains([[kept(C0, C1)], [kept(C9, C2)]], facts());
    } catch (error) {
      raised = error as RecordChainError;
    }
    expect(raised).toBeInstanceOf(RecordChainError);
    expect(raised!.issue.record).toBe(0);
    expect(raised!.issue.segment).toBe(1);
    expect(raised!.message).toMatch(/record 0 in segment 1/);
  });

  it('reports every failing declaration rather than stopping at the first', () => {
    const issues = recordChainIssues([[kept(C9, C1)], [kept(C1, C9)]], facts());
    expect(issues.length).toBeGreaterThan(1);
  });
});

describe('a composition whose record spans executions', () => {
  it('chains one record across two masters in execution order', () => {
    const order = [
      { master: 'Ledger#0', segments: [[kept(C0, C1)]] },
      { master: 'Vault#0', segments: [[kept(C1, C2)]] },
    ];
    expect(() => assertCompositionSettlement(order, facts())).not.toThrow();
  });

  it('refuses the same declarations in the wrong order', () => {
    // The second execution's declaration starts from a state the first never produced.
    const order = [
      { master: 'Ledger#0', segments: [[kept(C0, C1)]] },
      { master: 'Vault#0', segments: [[kept(C2, C1)]] },
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
      { master: 'Ledger#0', segments: [[kept(C0, C1), kept(C0, C1, 3)]] },
    ];
    const withThird = facts({ inputCommitments: new Map([[0, C0], [3, C0]]), outputCommitments: new Map([[0, C2], [3, C2]]) });
    // Record 0 stops at C1 while the transaction writes C2; record 3 has the same shape.
    const issues = recordChainIssues(order[0]!.segments, withThird);
    expect(issues.filter((issue) => /written at output/.test(issue.reason)).map((issue) => issue.record))
      .toStrictEqual([0, 3]);
  });
});
