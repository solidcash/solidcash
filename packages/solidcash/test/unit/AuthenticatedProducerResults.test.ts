import { describe, expect, it, vi } from 'vitest';
import { AuthenticatedProducerResults } from '../../src/message-bus/authenticated-producer-results.js';
import {
  decodeResultsByParent, propagateResultDependentArguments, type ResultPropagationContext,
} from '../../src/message-bus/compose-result-propagation.js';

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
      }, value)).toThrow(/duplicate authenticated producer lane 0:2/);
    }
    expect(() => results.add({ callsiteId: 2, occurrenceIndex: -1 }, 7n)).toThrow(/invalid source occurrence/);
    results.add({ callsiteId: 2, sourceCallsiteId: 5, sourceLogicalIndex: 2, occurrenceIndex: 0 }, 8n);
    expect(() => results.get(2)).toThrow(/cannot select among/);
  });

  it('propagates an independent scalar dependency without flattening unrelated repeated results', () => {
    const invocations = [
      { index: 0, parent: null, callee: 0, resultTypes: [] },
      ...[0, 1].map((occurrenceIndex) => ({ index: occurrenceIndex + 1, parent: 0, callee: 0,
        consumerCallsiteId: 1, sourceCallsiteId: 1, occurrenceIndex,
        resultTypes: ['uint256'], resultEncoding: 'evm-abi-v1' })),
      { index: 3, parent: 0, callee: 0, consumerCallsiteId: 2,
        resultTypes: ['uint256'], resultEncoding: 'evm-abi-v1' },
      { index: 4, parent: 0, callee: 0, consumerCallsiteId: 3, resultTypes: [] },
    ];
    const resolve = vi.fn((results: ReadonlyMap<number, unknown>) => [results.get(2)]);
    const context = {
      plan: { invocations, participants: [{ artifact: {} }] }, returning: invocations.slice(1, 4),
      descriptors: invocations.map((invocation) => ({
        functionName: `row${invocation.index}`, args: [0n],
        ...(invocation.index === 4 && { resolveArgsFromResults: resolve }),
      })),
    } as unknown as ResultPropagationContext;
    const values = { 1: '0b'.padStart(64, '0'), 2: '16'.padStart(64, '0'), 3: '21'.padStart(64, '0') };
    const propagated = propagateResultDependentArguments(context, values);
    expect(propagated.propagated).toBe(true);
    expect(propagated.calls[4].args).toEqual([33n]);
    expect(resolve).toHaveBeenCalledOnce();
    expect(() => decodeResultsByParent(context, values).get(0)!.get(1)).toThrow(/cannot select among/);
  });
});
