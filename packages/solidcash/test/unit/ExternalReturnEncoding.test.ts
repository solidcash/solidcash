import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { decodePushdataValue, encodePushdataValue, type StructDefinitionInfo } from '@solidcash/utils';
import {
  decodeEvmReturnValue, encodeExternalReturnValue, encodeLeadingRouteArrayPushes,
  isCanonicalEvmReturnBlob, isCanonicalEvmReturnSequence, isCanonicalEvmReturnVector,
  isCanonicalEvmScalarReturnBlob, isCanonicalEvmScalarReturnVector,
  selectEvmReturnCommitment, selectEvmScalarReturnCommitment,
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

  it('encodes, validates, and decodes scaled fixed-point return words', () => {
    const positive = encodeExternalReturnValue(1_500_000_000_000_000_000n, 'ufixed128x18', structs, true);
    expect(isCanonicalEvmScalarReturnVector(positive, ['ufixed128x18'])).toBe(true);
    expect(decodeEvmReturnValue(positive, 'ufixed128x18')).toBe(1_500_000_000_000_000_000n);

    const negative = encodeExternalReturnValue(-250_000_000_000_000_000n, 'fixed128x18', structs, true);
    expect(negative.slice(0, 16).every((byte) => byte === 0xff)).toBe(true);
    expect(isCanonicalEvmScalarReturnVector(negative, ['fixed128x18'])).toBe(true);
    expect(decodeEvmReturnValue(negative, 'fixed128x18')).toBe(-250_000_000_000_000_000n);

    const nonCanonical = positive.slice();
    nonCanonical[0] = 1;
    expect(isCanonicalEvmScalarReturnVector(nonCanonical, ['ufixed128x18'])).toBe(false);
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

  it('rejects a state-entry commitment from a framed Solidity return channel', () => {
    const entryCommitment = new Uint8Array(64).fill(0xca);
    expect(isCanonicalEvmScalarReturnBlob(entryCommitment, ['uint256'])).toBe(false);
  });

  it('selects a canonical dynamic string and boolean return over its provisional empty value', () => {
    const result = new Uint8Array(128);
    result[31] = 32;
    result[63] = 13;
    result.set(new TextEncoder().encode('DIGITAL_VIDEO'), 64);
    result[127] = 1;
    const framed = encodePushdataValue(result, 'bytes');
    const provisional = new Uint8Array(96);
    provisional[31] = 32;
    provisional[95] = 1;

    expect(isCanonicalEvmReturnSequence(result, [['string'], ['bool']])).toBe(true);
    expect(isCanonicalEvmReturnVector(result, ['string', 'bool'])).toBe(false);
    expect(isCanonicalEvmReturnBlob(framed, [['string'], ['bool']])).toBe(true);
    expect(selectEvmReturnCommitment(
      [framed, encodePushdataValue(provisional, 'bytes')], [['string'], ['bool']], false,
    )).toBe(binToHex(result));
    expect(decodeEvmReturnValue(result.slice(0, 96), 'string')).toBe('DIGITAL_VIDEO');
    expect(decodeEvmReturnValue(result.slice(96), 'bool')).toBe(true);
  });

  it('rejects non-canonical dynamic offsets and non-zero tail padding', () => {
    const wrongOffset = new Uint8Array(128);
    wrongOffset[31] = 96;
    wrongOffset[63] = 1;
    expect(isCanonicalEvmReturnVector(wrongOffset, ['string', 'bool'])).toBe(false);

    const dirtyPadding = new Uint8Array(128);
    dirtyPadding[31] = 64;
    dirtyPadding[63] = 1;
    dirtyPadding[95] = 1;
    dirtyPadding[96] = 0x61;
    dirtyPadding[127] = 1;
    expect(isCanonicalEvmReturnVector(dirtyPadding, ['string', 'bool'])).toBe(false);
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
  type RouteRow = Parameters<typeof encodeLeadingRouteArrayPushes>[0]['rowArguments'][number];
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

  it('preserves arbitrary timestamp_-named fields in generic route struct encoding', () => {
    const stampedStructs: StructDefinitionInfo[] = [{
      name: 'Stamped',
      fields: [{ name: 'value', type: 'uint256' }, { name: 'timestamp_', type: 'uint32' }],
    }];
    const encodedRecord = encodePushdataValue({ value: 2n, timestamp_: 0n }, 'Stamped', stampedStructs);
    const stampedRow = (
      record: Uint8Array | bigint[] | { value: bigint; timestamp_: bigint },
    ): RouteRow => ({
      args: [7n, record],
      handler: {
        inputs: [
          { name: 'recordId', type: 'uint256' },
          { name: 'record', type: 'Stamped' },
        ],
        entryAccesses: [{
          collection: 'history',
          keyParams: ['recordId'],
          operations: ['read', 'write'],
        }],
      },
    });
    const encoded = encodeLeadingRouteArrayPushes({
      rowArguments: [
        stampedRow(encodedRecord),
        stampedRow([3n, 0n]),
        stampedRow({ value: 4n, timestamp_: 0n }),
      ],
      collection: 'history',
      valueType: 'Stamped[]',
      structs: stampedStructs,
      timestamp: 42n,
    });
    expect(decodePushdataValue(encoded!, 0, 'Stamped[]', stampedStructs).value).toEqual([
      { value: 2n, timestamp_: 0n },
      { value: 3n, timestamp_: 0n },
    ]);
  });

  it('makes generic struct encoding independent of timestamp_ and address_ field names', () => {
    const named: StructDefinitionInfo[] = [{
      name: 'Named',
      fields: [{ name: 'timestamp_', type: 'uint32' }, { name: 'address_', type: 'bytes' }],
    }];
    const renamed: StructDefinitionInfo[] = [{
      name: 'Renamed',
      fields: [{ name: 'observedAt', type: 'uint32' }, { name: 'payload', type: 'bytes' }],
    }];
    const payload = new Uint8Array(20).fill(0x31);
    const encodedRows = (type: string, definitions: StructDefinitionInfo[]): Uint8Array | undefined =>
      encodeLeadingRouteArrayPushes({
        rowArguments: [
          {
            args: [7n, [0n, payload]],
            handler: {
              inputs: [{ name: 'id', type: 'uint256' }, { name: 'record', type }],
              entryAccesses: [{ collection: 'history', keyParams: ['id'], operations: ['read', 'write'] }],
            },
          },
          {
            args: [7n, [1n, new Uint8Array()]],
            handler: {
              inputs: [{ name: 'id', type: 'uint256' }, { name: 'record', type }],
              entryAccesses: [{ collection: 'history', keyParams: ['id'], operations: ['read', 'write'] }],
            },
          },
        ],
        collection: 'history', valueType: `${type}[]`, structs: definitions, timestamp: 42n,
      });
    const namedValue = decodePushdataValue(encodedRows('Named', named)!, 0, 'Named[]', named).value;
    const renamedValue = decodePushdataValue(encodedRows('Renamed', renamed)!, 0, 'Renamed[]', renamed).value;
    expect(namedValue).toEqual([{ timestamp_: 0n, address_: payload }]);
    expect(renamedValue).toEqual([{ observedAt: 0n, payload }]);
  });

  it('retains timestamp and packed-address adaptation behind the explicit legacy adapter', () => {
    const legacyStructs: StructDefinitionInfo[] = [{
      name: 'JobEventData',
      fields: [
        { name: 'type_', type: 'uint8' }, { name: 'address_', type: 'bytes' },
        { name: 'data_', type: 'bytes' }, { name: 'timestamp_', type: 'uint32' },
      ],
    }];
    const rawAddress = new Uint8Array(20).fill(0x31);
    const makeRow = (type: bigint): RouteRow => ({
      args: [7n, [type, rawAddress, new Uint8Array(), 0n]],
      handler: {
        inputs: [
          { name: 'id', type: 'uint256' }, { name: 'record', type: 'JobEventData' },
        ],
        entryAccesses: [{ collection: 'history', keyParams: ['id'], operations: ['read', 'write'] }],
      },
    });
    const encoded = encodeLeadingRouteArrayPushes({
      rowArguments: [makeRow(1n), makeRow(2n)],
      collection: 'history', valueType: 'JobEventData[]', structs: legacyStructs,
      timestamp: 42n, legacyJobEventCompatibility: true,
    });
    const decoded = decodePushdataValue(encoded!, 0, 'JobEventData[]', legacyStructs).value as Array<{
      address_: Uint8Array; timestamp_: bigint;
    }>;
    expect(decoded[0].timestamp_).toBe(42n);
    expect(decoded[0].address_).toHaveLength(25);
  });

});
