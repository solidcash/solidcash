import { describe, expect, it } from 'vitest';
import type { EnumDefinitionAbi, StructDefinitionInfo } from '@solidcash/utils';
import {
  decodeEvmInvocationResult, encodeEvmInvocationResult,
} from '../../src/stateful/evm-abi-result.js';
import { decodeAuthenticatedProducerResultVector } from '../../src/stateful/StatefulContract.js';

const schemas: readonly StructDefinitionInfo[] = [
  {
    name: 'Leaf',
    fields: [
      { name: 'tag', type: 'bytes3' },
      { name: 'note', type: 'string' },
    ],
  },
  {
    name: 'Branch',
    fields: [
      { name: 'weight', type: 'int16' },
      { name: 'leaves', type: 'Leaf[]' },
      { name: 'matrix', type: 'uint8[2][]' },
    ],
  },
];

const enumerations: readonly EnumDefinitionAbi[] = [{
  name: 'Mode',
  members: [{ name: 'Off', value: 0 }, { name: 'On', value: 3 }],
}];

const branch = {
  weight: -17n,
  leaves: [
    { tag: new Uint8Array([1, 2, 3]), note: 'alpha' },
    { tag: new Uint8Array([4, 5, 6]), note: 'βeta' },
  ],
  matrix: [[1n, 2n], [3n, 4n]],
};

describe('canonical EVM ABI invocation result decoding', () => {
  it('round-trips nested structs, fixed and dynamic arrays, bytes, strings, enums, and scalars', () => {
    const types = ['Branch', 'Mode', 'bytes', 'address', 'bytes4', 'bool', 'uint8'];
    const address = Uint8Array.from({ length: 20 }, (_value, index) => index + 1);
    const values = [
      branch,
      3n,
      new Uint8Array([0xca, 0xfe]),
      address,
      new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
      true,
      255n,
    ];
    const encoded = encodeEvmInvocationResult(values, types, schemas, enumerations);

    expect(decodeEvmInvocationResult(encoded, types, schemas, enumerations)).toEqual(values);
    expect(decodeAuthenticatedProducerResultVector(
      encoded, types, schemas, true, enumerations,
    )).toEqual(values);
  });

  it('requires canonical offsets, padding, integer extension, enum values, and full consumption', () => {
    const dynamic = encodeEvmInvocationResult(['abc'], ['string']);
    const shiftedTail = dynamic.slice();
    shiftedTail[31] = 64;
    expect(decodeEvmInvocationResult(shiftedTail, ['string'])).toBeUndefined();

    const dirtyPadding = dynamic.slice();
    dirtyPadding[dirtyPadding.length - 1] = 1;
    expect(decodeEvmInvocationResult(dirtyPadding, ['string'])).toBeUndefined();
    expect(decodeEvmInvocationResult(
      Uint8Array.from([...dynamic, 0]), ['string'],
    )).toBeUndefined();

    const dirtyAddress = encodeEvmInvocationResult([new Uint8Array(20)], ['address']);
    dirtyAddress[0] = 1;
    expect(decodeEvmInvocationResult(dirtyAddress, ['address'])).toBeUndefined();

    const dirtyFixedBytes = encodeEvmInvocationResult([new Uint8Array([1, 2])], ['bytes2']);
    dirtyFixedBytes[2] = 1;
    expect(decodeEvmInvocationResult(dirtyFixedBytes, ['bytes2'])).toBeUndefined();

    const dirtyUint8 = new Uint8Array(32); dirtyUint8[0] = 1; dirtyUint8[31] = 1;
    expect(decodeEvmInvocationResult(dirtyUint8, ['uint8'])).toBeUndefined();
    const dirtyInt8 = new Uint8Array(32); dirtyInt8[31] = 0xff;
    expect(decodeEvmInvocationResult(dirtyInt8, ['int8'])).toBeUndefined();

    const unknownEnum = new Uint8Array(32); unknownEnum[31] = 2;
    expect(decodeEvmInvocationResult(unknownEnum, ['Mode'], undefined, enumerations)).toBeUndefined();
    expect(decodeEvmInvocationResult(unknownEnum, ['Mode'])).toBeUndefined();
  });

  it('rejects truncated nested tails and recursive schemas without throwing', () => {
    const encoded = encodeEvmInvocationResult([branch], ['Branch'], schemas);
    expect(decodeEvmInvocationResult(encoded.slice(0, -1), ['Branch'], schemas)).toBeUndefined();

    const recursive: readonly StructDefinitionInfo[] = [{
      name: 'Node', fields: [{ name: 'children', type: 'Node[]' }],
    }];
    expect(decodeEvmInvocationResult(new Uint8Array(64), ['Node'], recursive)).toBeUndefined();
  });
});
