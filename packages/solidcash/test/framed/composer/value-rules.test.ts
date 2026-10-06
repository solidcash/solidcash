import { describe, expect, it } from 'vitest';
import {
  assertValueRules, valueIssues, ValueRuleError,
  type PlannedSend, type ValueFacts,
} from '../../../src/framed/composer/value-rules.js';

/**
 * The value rules a settlement has to satisfy, driven through the shipped check.
 *
 * A record must keep at least what it had unless a listed send pays from it, and a listed send must be paid exactly.
 * The tests state the values directly and vary one number at a time, so a refusal is attributable to that number.
 */

const facts = (overrides: Partial<ValueFacts> = {}): ValueFacts => ({
  inputValues: new Map([[1, 1000n]]),
  outputValues: new Map([[1, 1000n]]),
  ...overrides,
});

const record = { in: 1, out: 1 };

describe('keeping a record\'s value', () => {
  it('accepts a record that keeps what it had', () => {
    expect(valueIssues([record], facts(), [])).toStrictEqual([]);
    expect(() => assertValueRules([record], facts(), [])).not.toThrow();
  });

  it('accepts a record that is funded beyond what it had', () => {
    const funded = facts({ outputValues: new Map([[1, 1500n]]) });
    expect(valueIssues([record], funded, [])).toStrictEqual([]);
  });

  it('refuses a record that keeps less than it had', () => {
    const drained = facts({ outputValues: new Map([[1, 999n]]) });
    const issues = valueIssues([record], drained, []);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.record).toBe(1);
    expect(issues[0]!.reason).toMatch(/keeps 999 of 1000/);
  });

  it('treats a created record as starting from nothing, so it may hold anything', () => {
    const created = facts({ outputValues: new Map([[4, 0n]]) });
    expect(valueIssues([{ out: 4 }], created, [])).toStrictEqual([]);
  });

  it('refuses a record the transaction writes no value for', () => {
    const missing = facts({ outputValues: new Map() });
    expect(valueIssues([record], missing, [])[0]!.reason).toMatch(/writes no value at output 1/);
  });
});

describe('paying a listed send', () => {
  it('accepts a send that takes from a record and is paid exactly', () => {
    // The record held 1000, 600 goes out, and 400 stays.
    const spent = facts({ outputValues: new Map([[1, 400n], [5, 600n]]) });
    const sends: PlannedSend[] = [{ out: 5, value: 600n, from: 1 }];
    expect(valueIssues([record], spent, sends)).toStrictEqual([]);
  });

  it('refuses a send whose output holds a different amount', () => {
    const short = facts({ outputValues: new Map([[1, 400n], [5, 599n]]) });
    const issues = valueIssues([record], short, [{ out: 5, value: 600n, from: 1 }]);
    const aboutSend = issues.find((issue) => issue.send === 5);
    expect(aboutSend).toBeDefined();
    expect(aboutSend!.reason).toMatch(/pays 600 but output 5 holds 599/);
  });

  it('refuses sends that take more than the record holds', () => {
    const overdrawn = facts({ outputValues: new Map([[1, 0n], [5, 1001n]]) });
    const issues = valueIssues([record], overdrawn, [{ out: 5, value: 1001n, from: 1 }]);
    expect(issues.some((issue) => /take 1001 from a record that holds 1000/.test(issue.reason))).toBe(true);
  });

  it('lets the funder pay a send, which asks nothing of a record', () => {
    const funded = facts({ outputValues: new Map([[1, 1000n], [5, 250n]]) });
    expect(valueIssues([record], funded, [{ out: 5, value: 250n }])).toStrictEqual([]);
  });

  it('refuses a send the transaction writes no output for', () => {
    const issues = valueIssues([record], facts(), [{ out: 9, value: 1n }]);
    expect(issues.some((issue) => issue.send === 9 && /writes no value at output 9/.test(issue.reason))).toBe(true);
  });

  it('sums the sends that take from one record', () => {
    // Two sends of 400 out of a record holding 1000 leave 200, which is what the record must keep.
    const twoSends = facts({ outputValues: new Map([[1, 200n], [5, 400n], [6, 400n]]) });
    const sends: PlannedSend[] = [{ out: 5, value: 400n, from: 1 }, { out: 6, value: 400n, from: 1 }];
    expect(valueIssues([record], twoSends, sends)).toStrictEqual([]);

    const shortByOne = facts({ outputValues: new Map([[1, 199n], [5, 400n], [6, 400n]]) });
    expect(valueIssues([record], shortByOne, sends).some((issue) => issue.record === 1)).toBe(true);
  });

  it('names the first thing at fault when it refuses', () => {
    let raised: ValueRuleError | undefined;
    try {
      assertValueRules([record], facts({ outputValues: new Map([[1, 999n]]) }), []);
    } catch (error) {
      raised = error as ValueRuleError;
    }
    expect(raised).toBeInstanceOf(ValueRuleError);
    expect(raised!.issue.record).toBe(1);
    expect(raised!.message).toMatch(/record 1: the record keeps 999 of 1000/);
  });

  it('reports a record fault before a send fault, so the cause is named first', () => {
    // A send of 600 from a record holding 1000 leaves 400, so a record that keeps 399 is short — and the send's own
    // output holds nothing, so both are wrong and the record is named first.
    const both = facts({ outputValues: new Map([[1, 399n], [5, 0n]]) });
    const issues = valueIssues([record], both, [{ out: 5, value: 600n, from: 1 }]);
    expect(issues[0]!.record).toBe(1);
    expect(issues[0]!.reason).toMatch(/keeps 399 of 400/);
    expect(issues.some((issue) => issue.send === 5)).toBe(true);
  });
});
