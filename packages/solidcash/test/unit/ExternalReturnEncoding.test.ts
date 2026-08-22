import { describe, expect, it } from 'vitest';
import { decodePushdataValue, encodePushdataValue, type StructDefinitionInfo } from '@solidcash/utils';
import {
  encodeExternalReturnValue, encodeLeadingRouteArrayPushes, encodeRouteArrayPushResult,
  isCanonicalEvmScalarReturnVector, selectEvmScalarReturnCommitment,
} from '../../src/stateful/StatefulContract.js';
import {
  selectMaterializedTailReturnEvents,
} from '../../src/stateful/StatefulTransactionBuilder.js';

const structs: StructDefinitionInfo[] = [{
  name: 'Pair',
  fields: [
    { name: 'count', type: 'uint256' },
    { name: 'active', type: 'bool' },
  ],
}];

describe('encodeExternalReturnValue', () => {
  it('uses the callee struct schema for positional named-type returns', () => {
    const encoded = encodeExternalReturnValue([2n, true], 'Pair', structs, false);
    expect(decodePushdataValue(encoded, 0, 'Pair', structs).value).toEqual({
      count: 2n,
      active: true,
    });
  });

  it('retains 32-byte Solidity framing for scalar returns', () => {
    const encoded = encodeExternalReturnValue(2n, 'uint256', structs, true);
    expect(encoded).toHaveLength(32);
    expect(encoded[31]).toBe(2);
  });

  it('rejects an unrelated multi-word stack item with a non-canonical boolean', () => {
    const vector = new Uint8Array(128);
    vector[31] = 1;
    vector[64] = 0xa0;
    expect(isCanonicalEvmScalarReturnVector(
      vector, ['bool', 'uint256', 'bool', 'uint256'],
    )).toBe(false);
    vector[64] = 0;
    vector[95] = 1;
    expect(isCanonicalEvmScalarReturnVector(
      vector, ['bool', 'uint256', 'bool', 'uint256'],
    )).toBe(true);
  });

  it('prefers a framed return vector over an ABI-width state witness', () => {
    const expected = new Uint8Array(32);
    expected[31] = 7;
    const stateWitness = new Uint8Array(32).fill(0xca);
    const framed = encodePushdataValue(expected, 'bytes');

    expect(selectEvmScalarReturnCommitment(
      [stateWitness, framed], ['uint256'],
    )).toBe(`${'00'.repeat(31)}07`);
  });

  it('can require compiler framing when raw ABI words are ambiguous', () => {
    const stateHash = new Uint8Array(32).fill(0xca);
    expect(selectEvmScalarReturnCommitment([stateHash], ['uint256'], false)).toBeUndefined();
  });
});

describe('selectMaterializedTailReturnEvents', () => {
  const group = (overrides: Record<string, unknown> = {}) => ({
    categoryId: '11'.repeat(32),
    returnEventInBlock: false,
    blockLayout: { blockSize: 1, slots: [{ kind: 'master', offset: 0 }] },
    ...overrides,
  }) as never;

  it('keeps a typed precomputed zero instead of a minimal probe seed', () => {
    const canonicalZero = new Uint8Array(32);
    const events = selectMaterializedTailReturnEvents([
      group({ precomputedReturnCommitment: canonicalZero }),
    ], [
      { categoryId: '11'.repeat(32), commitment: canonicalZero, identity: 'external-call:0:0' },
      { categoryId: '11'.repeat(32), commitment: Uint8Array.of(0), identity: 'external-call:0' },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].identity).toBe('external-call:0:0');
    expect(events[0].commitment).toHaveLength(32);
  });

  it('promotes an exact writer probe over its provisional seed', () => {
    const exact = Uint8Array.of(1);
    const events = selectMaterializedTailReturnEvents([group()], [
      {
        categoryId: '11'.repeat(32), commitment: Uint8Array.of(0),
        identity: 'external-call:0:0', provisional: true,
      },
      { categoryId: '11'.repeat(32), commitment: exact, identity: 'external-call:0' },
    ]);
    expect(events).toEqual([
      { categoryId: '11'.repeat(32), commitment: exact, identity: 'external-call:0' },
    ]);
  });
});

describe('encodeLeadingRouteArrayPushes', () => {
  const row = (key: bigint, count: bigint) => ({
    args: [key, [count, true]],
    handler: {
      inputs: [
        { name: 'recordId', type: 'uint256' },
        { name: 'record', type: 'Pair' },
      ],
      entryAccesses: [{
        collection: 'history',
        keyParams: ['recordId'],
        operations: ['read', 'write'],
      }],
    },
  });

  it('encodes only earlier pushes targeting the final row key', () => {
    const encoded = encodeLeadingRouteArrayPushes({
      rowArguments: [row(7n, 2n), row(8n, 3n), row(7n, 4n)],
      collection: 'history',
      valueType: 'Pair[]',
      structs,
    });
    expect(encoded).toBeDefined();
    expect(decodePushdataValue(encoded!, 0, 'Pair[]', structs).value).toEqual([{
      count: 2n,
      active: true,
    }]);
  });

  it('does not merge pushes for different keys', () => {
    expect(encodeLeadingRouteArrayPushes({
      rowArguments: [row(7n, 2n), row(8n, 3n)],
      collection: 'history',
      valueType: 'Pair[]',
      structs,
    })).toBeUndefined();
  });

  it('applies selected same-key pushes to the authenticated stored value in row order', () => {
    const initialValue = encodeRouteArrayPushResult({
      rowArguments: [row(7n, 1n)],
      collection: 'history',
      valueType: 'Pair[]',
      structs,
      initialValue: encodePushdataValue([], 'Pair[]', structs),
    });
    const result = encodeRouteArrayPushResult({
      rowArguments: [row(7n, 2n), row(8n, 3n), row(7n, 4n)],
      collection: 'history',
      valueType: 'Pair[]',
      structs,
      initialValue: initialValue!,
    });
    expect(decodePushdataValue(result!, 0, 'Pair[]', structs).value).toEqual([
      { count: 1n, active: true },
      { count: 2n, active: true },
      { count: 4n, active: true },
    ]);
  });
});
