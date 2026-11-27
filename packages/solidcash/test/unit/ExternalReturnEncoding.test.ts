import { describe, expect, it } from 'vitest';
import { binToHex, hash160, hexToBin } from '@bitauth/libauth';
import { AbiCoder } from 'ethers';
import { decodePushdataValue, encodePushdataValue, type StructDefinitionInfo } from '@solidcash/utils';
import {
  decodeEvmReturnValue, encodeExternalReturnValue, encodeExternalReturnValues,
  encodeStructArgument,
  isCanonicalEvmReturnVector, isCanonicalEvmScalarReturnVector,
  selectEvmScalarReturnCommitment,
} from '../../src/stateful/StatefulContract.js';
import { foldLeadingRowArrayPushes } from '../../src/stateful/resource-fold.js';
import {
  selectMaterializedTailReturnEvents,
} from '../../src/stateful/StatefulTransactionBuilder.js';
import {
  decodeEvmInvocationResult, decodeEvmInvocationResultPrefix, encodeEvmInvocationResult,
} from '../../src/stateful/evm-abi-result.js';

const structs: StructDefinitionInfo[] = [{
  name: 'Pair',
  fields: [
    { name: 'count', type: 'uint256' },
    { name: 'active', type: 'bool' },
  ],
}];

describe('decodeEvmInvocationResult for aggregate results', () => {
  it('decodes a non-empty array return which the scalar-only helper rejects', () => {
    const encoded = encodeEvmInvocationResult([[1n, 2n]], ['uint256[]'], structs);
    expect(decodeEvmInvocationResult(encoded, ['uint256[]'], structs)).toEqual([[1n, 2n]]);
    // The scalar-only helper only understands scalar widths; a read that fell back to the native pushdata
    // decoder instead read the ABI head as a length and produced an empty array.
    expect(decodeEvmReturnValue(encoded, 'uint256[]')).toBeUndefined();
  });

  it('decodes an array of named structs through the same schema the writer used', () => {
    const encoded = encodeEvmInvocationResult([[{ count: 7n, active: true }]], ['Pair[]'], structs);
    expect(decodeEvmInvocationResult(encoded, ['Pair[]'], structs)).toEqual([[{ count: 7n, active: true }]]);
  });

  it('splits and resumes a rolled array with the prefix codec the replacement needs', () => {
    // A rolled call resumes its parent array element by element: the codec must report both the decoded array and
    // the exact blob range it consumed, and re-encoding the resumed array must reproduce that same encoding.
    const encoded = encodeEvmInvocationResult(
      [[{ count: 1n, active: true }, { count: 2n, active: false }]], ['Pair[]'], structs,
    );
    const prefix = decodeEvmInvocationResultPrefix(encoded, ['Pair[]'], structs);
    expect(prefix?.values).toEqual([[{ count: 1n, active: true }, { count: 2n, active: false }]]);
    expect(prefix?.bytesConsumed).toBe(encoded.length);
    const resumed = prefix?.values[0] as Array<{ count: bigint; active: boolean }>;
    expect(binToHex(encodeEvmInvocationResult([resumed], ['Pair[]'], structs))).toBe(binToHex(encoded));
  });
});

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

  it('encodes Solidity ABI string returns so the journal can take32 the offset word', () => {
    const encoded = encodeExternalReturnValue('DIGITAL_VIDEO', 'string', structs, true);
    expect(encoded.length).toBe(96);
    expect(encoded[31]).toBe(32);
    expect(encoded[63]).toBe(13);
    expect(isCanonicalEvmReturnVector(encoded, ['string'])).toBe(true);
    expect(decodeEvmReturnValue(encoded, 'string')).toBe('DIGITAL_VIDEO');
    const compact = encodeExternalReturnValue('DIGITAL_VIDEO', 'string', structs, false);
    expect(compact.length).toBeLessThan(32);
    expect(isCanonicalEvmReturnVector(compact, ['string'])).toBe(false);
  });

  it('encodes a dynamic nested struct exactly as one canonical Solidity result tuple', () => {
    const aggregateStructs: StructDefinitionInfo[] = [
      {
        name: 'Roles',
        fields: [
          { name: 'creator', type: 'address' },
          { name: 'reviewer', type: 'address' },
        ],
      },
      {
        name: 'Listing',
        fields: [
          { name: 'state', type: 'uint8' },
          { name: 'active', type: 'bool' },
          { name: 'roles', type: 'Roles' },
          { name: 'title', type: 'string' },
          { name: 'tags', type: 'string[]' },
          { name: 'digest', type: 'bytes32' },
        ],
      },
    ];
    const creator = hexToBin('11'.repeat(20));
    const reviewer = hexToBin('22'.repeat(20));
    const digest = hexToBin('ab'.repeat(32));
    const positional = [2n, true, [creator, reviewer], 'alpha', ['one', 'two'], digest];
    const encoded = encodeExternalReturnValue(positional, 'Listing', aggregateStructs, true);
    const expected = AbiCoder.defaultAbiCoder().encode(
      ['tuple(uint8,bool,tuple(address,address),string,string[],bytes32)'],
      [[
        2n, true, [`0x${binToHex(creator)}`, `0x${binToHex(reviewer)}`], 'alpha', ['one', 'two'],
        `0x${binToHex(digest)}`,
      ]],
    );
    expect(binToHex(encoded)).toBe(expected.slice(2));

    const named = encodeExternalReturnValue({
      state: 2n,
      active: true,
      roles: { creator, reviewer },
      title: 'alpha',
      tags: ['one', 'two'],
      digest,
    }, 'Listing', aggregateStructs, true);
    expect(named).toEqual(encoded);
    expect(encoded).not.toEqual(encodePushdataValue(positional, 'Listing', aggregateStructs));
  });

  it('uses one shared head for a complete mixed-output invocation', () => {
    const encoded = encodeExternalReturnValues(['alpha', true], ['string', 'bool'], structs, true);
    const expected = AbiCoder.defaultAbiCoder().encode(['string', 'bool'], ['alpha', true]);
    expect(binToHex(encoded)).toBe(expected.slice(2));
    expect(encoded[31]).toBe(64);
  });

  it('canonicalizes the VM zero-address representation', () => {
    const encoded = encodeExternalReturnValue(new Uint8Array(), 'address', structs, true);
    expect(encoded).toEqual(new Uint8Array(32));
  });

  it('uses the established synthetic Solidity identity for P2SH32 addresses', () => {
    const lockingBytecode = hexToBin(`aa20${'34'.repeat(32)}87`);
    const encoded = encodeExternalReturnValue(lockingBytecode, 'address', structs, true);
    expect(encoded.slice(0, 12)).toEqual(new Uint8Array(12));
    expect(encoded.slice(12)).toEqual(hash160(lockingBytecode));
  });

  it('fails closed for malformed fixed aggregates and fixed bytes', () => {
    expect(() => encodeExternalReturnValue([1n], 'uint256[2]', structs, true))
      .toThrow('requires 2 elements');
    expect(() => encodeExternalReturnValue(hexToBin('0102'), 'bytes4', structs, true))
      .toThrow('requires 4 bytes');
    expect(() => encodeExternalReturnValue(-1n, 'uint8', structs, true))
      .toThrow('out of range');
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
  const group = (overrides: Record<string, unknown> = {}): never => ({
    categoryId: '11'.repeat(31) + 'ee',
    returnEventInBlock: false,
    blockLayout: { blockSize: 1, slots: [{ kind: 'master', offset: 0 }] },
    ...overrides,
  }) as never;

  it('keeps a typed precomputed zero instead of a minimal probe seed', () => {
    const canonicalZero = new Uint8Array(32);
    const events = selectMaterializedTailReturnEvents([
      group({ precomputedReturnCommitment: canonicalZero }),
    ], [
      { categoryId: '11'.repeat(31) + 'ee', commitment: canonicalZero, identity: 'external-call:0:0' },
      { categoryId: '11'.repeat(31) + 'ee', commitment: Uint8Array.of(0), identity: 'external-call:0' },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].identity).toBe('external-call:0:0');
    expect(events[0].commitment).toHaveLength(32);
  });

  it('promotes an exact writer probe over its provisional seed', () => {
    const exact = Uint8Array.of(1);
    const events = selectMaterializedTailReturnEvents([group()], [
      {
        categoryId: '11'.repeat(31) + 'ee', commitment: Uint8Array.of(0),
        identity: 'external-call:0:0', provisional: true,
      },
      { categoryId: '11'.repeat(31) + 'ee', commitment: exact, identity: 'external-call:0' },
    ]);
    expect(events).toEqual([
      { categoryId: '11'.repeat(31) + 'ee', commitment: exact, identity: 'external-call:0' },
    ]);
  });
});

describe('foldLeadingRowArrayPushes', () => {
  type Row = Parameters<typeof foldLeadingRowArrayPushes>[0]['rowArguments'][number];
  const row = (key: bigint, count: bigint): Row => ({
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
        mutationEffectOrdinals: [0],
        arrayMutation: 'push',
        storedElementSource: {
          version: 1, mutationEffectOrdinal: 0, elementType: 'Pair',
          expression: { kind: 'source', type: 'Pair', source: { kind: 'forward', paramIndex: 1 } },
        },
      }],
    },
  });
  const resolveElement = (definitions: StructDefinitionInfo[]) => (
    candidate: Row, access: NonNullable<Row['handler']['entryAccesses']>[number], type: string,
  ): Uint8Array | undefined => {
    const index = access.storedElementSource?.expression.source?.paramIndex;
    return index === undefined ? undefined
      : encodeStructArgument(candidate.args[index], type, definitions);
  };

  it('encodes only earlier pushes targeting the final row key', () => {
    const encoded = foldLeadingRowArrayPushes({
      rowArguments: [row(7n, 2n), row(8n, 3n), row(7n, 4n)],
      collection: 'history',
      valueType: 'Pair[]',
      structs,
      resolveElement: resolveElement(structs),
    })?.leading;
    expect(encoded).toBeDefined();
    expect(decodePushdataValue(encoded!, 0, 'Pair[]', structs).value).toEqual([{
      count: 2n,
      active: true,
    }]);
  });

  it('does not merge pushes for different keys', () => {
    expect(foldLeadingRowArrayPushes({
      rowArguments: [row(7n, 2n), row(8n, 3n)],
      collection: 'history',
      valueType: 'Pair[]',
      structs,
      resolveElement: resolveElement(structs),
    })?.leading).toBeUndefined();
  });

  it('preserves arbitrary timestamp_-named fields in generic struct encoding', () => {
    const stampedStructs: StructDefinitionInfo[] = [{
      name: 'Stamped',
      fields: [{ name: 'value', type: 'uint256' }, { name: 'timestamp_', type: 'uint32' }],
    }];
    const encodedRecord = encodePushdataValue({ value: 2n, timestamp_: 0n }, 'Stamped', stampedStructs);
    const stampedRow = (
      record: Uint8Array | bigint[] | { value: bigint; timestamp_: bigint },
    ): Row => ({
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
          mutationEffectOrdinals: [0],
          arrayMutation: 'push',
          storedElementSource: {
            version: 1, mutationEffectOrdinal: 0, elementType: 'Stamped',
            expression: { kind: 'source', type: 'Stamped', source: { kind: 'forward', paramIndex: 1 } },
          },
        }],
      },
    });
    const encoded = foldLeadingRowArrayPushes({
      rowArguments: [
        stampedRow(encodedRecord),
        stampedRow([3n, 0n]),
        stampedRow({ value: 4n, timestamp_: 0n }),
      ],
      collection: 'history',
      valueType: 'Stamped[]',
      structs: stampedStructs,
      resolveElement: resolveElement(stampedStructs),
    })?.leading;
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
      foldLeadingRowArrayPushes({
        rowArguments: [
          {
            args: [7n, [0n, payload]],
            handler: {
              inputs: [{ name: 'id', type: 'uint256' }, { name: 'record', type }],
              entryAccesses: [{
                collection: 'history', keyParams: ['id'], operations: ['read', 'write'],
                mutationEffectOrdinals: [0], arrayMutation: 'push', storedElementSource: {
                  version: 1, mutationEffectOrdinal: 0, elementType: type,
                  expression: { kind: 'source', type, source: { kind: 'forward', paramIndex: 1 } },
                },
              }],
            },
          },
          {
            args: [7n, [1n, new Uint8Array()]],
            handler: {
              inputs: [{ name: 'id', type: 'uint256' }, { name: 'record', type }],
              entryAccesses: [{
                collection: 'history', keyParams: ['id'], operations: ['read', 'write'],
                mutationEffectOrdinals: [0], arrayMutation: 'push', storedElementSource: {
                  version: 1, mutationEffectOrdinal: 0, elementType: type,
                  expression: { kind: 'source', type, source: { kind: 'forward', paramIndex: 1 } },
                },
              }],
            },
          },
        ],
        collection: 'history', valueType: `${type}[]`, structs: definitions,
        resolveElement: resolveElement(definitions),
      })?.leading;
    const namedValue = decodePushdataValue(encodedRows('Named', named)!, 0, 'Named[]', named).value;
    const renamedValue = decodePushdataValue(encodedRows('Renamed', renamed)!, 0, 'Renamed[]', renamed).value;
    expect(namedValue).toEqual([{ timestamp_: 0n, address_: payload }]);
    expect(renamedValue).toEqual([{ observedAt: 0n, payload }]);
  });


});
