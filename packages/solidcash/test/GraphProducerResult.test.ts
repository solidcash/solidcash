import { describe, expect, it } from 'vitest';
import { encodePushdataValue, type ArgSource, type ExternalCallAbi } from '@solidcash/utils';
import type { FunctionArgument } from '../src/Argument.js';
import {
  createGraphPlanningProducerResultContext,
  decodeAuthenticatedProducerResultVector,
  externalReturnsForCallsites,
  memoizeGraphPlanningProducerResult,
} from '../src/stateful/StatefulContract.js';

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

const concat = (...values: Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(values.reduce((length, value) => length + value.length, 0));
  let offset = 0;
  for (const value of values) {
    result.set(value, offset);
    offset += value.length;
  }
  return result;
};

const evmWord = (value: bigint): Uint8Array => {
  const result = new Uint8Array(32);
  let remaining = value;
  for (let index = result.length - 1; index >= 0; index -= 1) {
    result[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return result;
};

describe('graph producer-result identities', () => {
  it('evaluates one unchanged producer callsite once per planning epoch', async () => {
    const context = createGraphPlanningProducerResultContext();
    let evaluations = 0;
    const evaluate = async (): Promise<FunctionArgument> => {
      evaluations += 1;
      return 41n;
    };
    const args = [7n, { payload: new Uint8Array([0xaa]) }] as unknown as FunctionArgument[];

    expect(await memoizeGraphPlanningProducerResult(
      context, 3, args, undefined, false, evaluate,
    )).toBe(41n);
    expect(await memoizeGraphPlanningProducerResult(
      context, 3, [7n, { payload: new Uint8Array([0xaa]) }] as unknown as FunctionArgument[],
      undefined, false, evaluate,
    )).toBe(41n);
    // An exact result is also a sound provisional seed for the same authenticated callsite invocation.
    expect(await memoizeGraphPlanningProducerResult(
      context, 3, args, undefined, true, evaluate,
    )).toBe(41n);
    expect(evaluations).toBe(1);

    await memoizeGraphPlanningProducerResult(context, 3, [8n], undefined, false, evaluate);
    expect(evaluations).toBe(2);
  });

  it('does not let a provisional fallback satisfy a later exact producer request', async () => {
    const context = createGraphPlanningProducerResultContext();
    let evaluations = 0;
    const evaluate = async (): Promise<FunctionArgument> => BigInt(++evaluations);

    expect(await memoizeGraphPlanningProducerResult(
      context, 5, [1n], undefined, true, evaluate,
    )).toBe(1n);
    expect(await memoizeGraphPlanningProducerResult(
      context, 5, [1n], undefined, false, evaluate,
    )).toBe(2n);
    expect(evaluations).toBe(2);
  });

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

    expect(() => externalReturnsForCallsites(
      [source(3, 1)], new Map([[3, [7n]]]), [producer(3, ['uint256', 'bool'])],
    )).toThrow(/does not match its 2-component schema/);
  });

  it('binds consumer arguments to exact callsite/result lanes and accepts old lane metadata', () => {
    const sources = [source(3, 0), source(3, 1)];
    const calls = [producer(3, ['uint256', 'bool'])];
    const results = new Map<number, FunctionArgument>([
      [3, [7n, true] as unknown as FunctionArgument],
    ]);

    const current = externalReturnsForCallsites(sources, results, calls, {
      callsiteId: 8,
      resultConsumers: [
        { consumerCallsiteId: 8, argument: 0, producerCallsiteId: 3, resultIndex: 0 },
        { consumerCallsiteId: 8, argument: 1, producerCallsiteId: 3, resultIndex: 1 },
      ],
    });
    expect(sources.map(({ expression }) => current.get(JSON.stringify(expression))))
      .toEqual([7n, true]);

    const legacy = externalReturnsForCallsites([sources[1]], results, calls, {
      callsiteId: 8,
      resultConsumers: [
        { consumerCallsiteId: 8, argument: 0, producerCallsiteId: 3 },
      ],
    });
    expect(legacy.get(JSON.stringify(sources[1].expression))).toBe(true);
  });

  it('rejects duplicate, mismatched, and invalid consumer lanes', () => {
    const calls = [producer(3, ['uint256', 'bool'])];
    const results = new Map<number, FunctionArgument>([
      [3, [7n, true] as unknown as FunctionArgument],
    ]);
    const lane = { consumerCallsiteId: 8, argument: 0, producerCallsiteId: 3, resultIndex: 1 };

    expect(() => externalReturnsForCallsites([source(3, 1)], results, calls, {
      callsiteId: 8, resultConsumers: [lane, lane],
    })).toThrow(/duplicate lane 8:0:3:1/);
    expect(() => externalReturnsForCallsites([source(3, 0)], results, calls, {
      callsiteId: 8, resultConsumers: [lane],
    })).toThrow(/does not identify exactly one published consumer lane 8:0/);
    expect(() => externalReturnsForCallsites([source(3, 1)], results, calls, {
      callsiteId: 8,
      resultConsumers: [{ ...lane, resultIndex: 2 }],
    })).toThrow(/invalid result index 2/);
  });

  it('decodes an exact native multi-result vector and rejects unchecked bytes', () => {
    const commitment = concat(
      encodePushdataValue(17n, 'int256'),
      encodePushdataValue(true, 'bool'),
      encodePushdataValue(new Uint8Array([0xaa, 0xbb]), 'bytes2'),
    );

    expect(decodeAuthenticatedProducerResultVector(
      commitment, ['int256', 'bool', 'bytes2'], undefined, false,
    )).toEqual([17n, true, new Uint8Array([0xaa, 0xbb])]);
    expect(decodeAuthenticatedProducerResultVector(
      concat(commitment, new Uint8Array([0])), ['int256', 'bool', 'bytes2'], undefined, false,
    )).toBeUndefined();
  });

  it('decodes one canonical Solidity mixed result tuple by component index', () => {
    const payload = new Uint8Array([0xca, 0xfe, 0xba]);
    const commitment = concat(
      evmWord(23n),
      evmWord(1n),
      evmWord(96n),
      evmWord(BigInt(payload.length)),
      payload,
      new Uint8Array(29),
    );
    const decoded = decodeAuthenticatedProducerResultVector(
      commitment, ['uint256', 'bool', 'bytes'], undefined, true,
    );
    expect(decoded).toEqual([23n, true, payload]);

    const sources = [source(8, 0), source(8, 1), source(8, 2)];
    const resolved = externalReturnsForCallsites(
      sources, new Map([[8, decoded!]]), [producer(8, ['uint256', 'bool', 'bytes'])],
    );
    expect(sources.map(({ expression }) => resolved.get(JSON.stringify(expression))))
      .toEqual([23n, true, payload]);

    const malformed = commitment.slice();
    malformed[95] = 95;
    expect(decodeAuthenticatedProducerResultVector(
      malformed, ['uint256', 'bool', 'bytes'], undefined, true,
    )).toBeUndefined();
  });
});
