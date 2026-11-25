import { describe, expect, it } from 'vitest';
import { AuthenticatedProducerResults } from '../../src/stateful/authenticated-producer-results.js';

describe('authenticated producer result occurrences', () => {
  it('retains unused loop results but refuses ambiguous scalar reads or enumeration', () => {
    const results = new AuthenticatedProducerResults(3);
    results.add({ callsiteId: 7, occurrenceIndex: 0 }, 11n);
    results.add({ callsiteId: 7, occurrenceIndex: 1 }, 22n);
    results.add({ callsiteId: 8 }, 33n);
    expect(results.size).toBe(2);
    expect([...results.keys()]).toEqual([7, 8]);
    expect(results.has(7)).toBe(true);
    expect(results.get(8)).toBe(33n);
    expect(results.get(9)).toBeUndefined();
    for (const read of [() => results.get(7), () => [...results], () => [...results.values()],
      () => results.forEach(() => {})]) {
      expect(read).toThrow(/cannot select among 2 authenticated producer occurrences at lane 3:7/);
    }
  });

  it('rejects duplicated exact occurrences regardless of value equality', () => {
    const results = new AuthenticatedProducerResults(0);
    results.add({ callsiteId: 2, sourceCallsiteId: 4, sourceLogicalIndex: 1, occurrenceIndex: 0 }, 5n);
    for (const value of [5n, 6n]) {
      expect(() => results.add({
        callsiteId: 2, sourceCallsiteId: 4, sourceLogicalIndex: 1, occurrenceIndex: 0,
      }, value)).toThrow(/[Dd]uplicate authenticated producer lane 0:2/);
    }
    expect(() => results.add({ callsiteId: 2, occurrenceIndex: -1 }, 7n)).toThrow(/invalid source occurrence/);
    results.add({ callsiteId: 2, sourceCallsiteId: 5, sourceLogicalIndex: 2, occurrenceIndex: 0 }, 8n);
    expect(() => results.get(2)).toThrow(/cannot select among/);
  });
});
