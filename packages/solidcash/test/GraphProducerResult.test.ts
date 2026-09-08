import { describe, expect, it } from 'vitest';
import type { ArgSource, ExternalCallAbi } from '@solidcash/utils';
import { externalReturnsForCallsites } from '../src/stateful/StatefulContract.js';

const producer = (
  callsiteId: number, returnTypes: string[],
): ExternalCallAbi => ({
  interfaceName: 'IReader',
  functionName: 'read',
  slotIndex: callsiteId,
  callsiteId,
  requiredDataNftIndices: [],
  computedOffset: 0,
  hasReturnValues: true,
  returnTypes,
  argSources: [],
} as ExternalCallAbi);

const source = (callsiteId: number, resultIndex: number): ArgSource => ({
  kind: 'expression',
  expression: { kind: 'producerResult', callsiteId, resultIndex },
});

describe('graph producer-result identities', () => {
  it('selects distinct components from one authenticated multi-result callsite', () => {
    const sources = [source(3, 0), source(3, 1)];
    const results = externalReturnsForCallsites(
      sources,
      new Map([[3, [7n, new Uint8Array([0xaa])]]]),
      [producer(3, ['uint256', 'address'])],
    );

    expect(results.get(JSON.stringify(sources[0].expression))).toBe(7n);
    expect(results.get(JSON.stringify(sources[1].expression))).toEqual(new Uint8Array([0xaa]));
  });

  it('rejects ambiguous or out-of-schema producer identities', () => {
    expect(() => externalReturnsForCallsites(
      [source(3, 0)], new Map([[3, 7n]]),
      [producer(3, ['uint256']), producer(3, ['uint256'])],
    )).toThrow(/duplicate callsiteId 3/);

    expect(() => externalReturnsForCallsites(
      [source(3, 1)], new Map([[3, 7n]]), [producer(3, ['uint256'])],
    )).toThrow(/does not identify one published result/);
  });
});
