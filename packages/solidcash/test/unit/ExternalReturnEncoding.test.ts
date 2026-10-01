import { describe, expect, it } from 'vitest';
import { binToHex, hash160, hexToBin } from '@bitauth/libauth';
import { AbiCoder } from 'ethers';
import { decodePushdataValue, encodePushdataValue, sha256, type StructDefinitionInfo } from '@solidcash/utils';
import {
  decodeEvmReturnValue, encodeCompleteRouteArrayPushes, encodeExternalReturnValue, encodeExternalReturnValues,
  encodeLeadingRouteArrayPushes,
  encodeStructArgument,
  isCanonicalEvmReturnBlob, isCanonicalEvmReturnSequence, isCanonicalEvmReturnVector,
  isCanonicalEvmScalarReturnBlob, isCanonicalEvmScalarReturnVector,
  isConstrainedEvmResultVector,
  selectEvmReturnCommitment, selectEvmScalarReturnCommitment,
} from '../../src/stateful/StatefulContract.js';
import {
  selectMaterializedTailReturnEvents,
} from '../../src/stateful/StatefulTransactionBuilder.js';
import {
  decodeEvmInvocationResult, decodeEvmInvocationResultPrefix, encodeEvmInvocationResult,
} from '../../src/stateful/evm-abi-result.js';
import {
  discoveredReturnFollowsParticipantWrite,
  selectPreparedAtomicReturnSeed,
} from '../../src/stateful/sc-materialize-create-builder-return-emit.js';

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

  it('encodes Solidity ABI string returns so the kernel can take32 the offset word', () => {
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

  it('validates a framed named-struct sequence with the producing artifact schema', () => {
    const resultStructs: StructDefinitionInfo[] = [{
      name: 'Record',
      fields: [
        { name: 'stable', type: 'uint256' },
        { name: 'phase', type: 'uint256' },
        { name: 'tail', type: 'string' },
      ],
    }];
    const vector = encodeEvmInvocationResult(
      [{ stable: 11n, phase: 20n, tail: 'row-epoch-payload' }], ['Record'], resultStructs,
    );
    const framed = encodePushdataValue(vector, 'bytes');
    const digest = sha256(framed);

    expect(isCanonicalEvmReturnSequence(vector, [['Record']])).toBe(false);
    expect(isCanonicalEvmReturnSequence(vector, [['Record']], resultStructs)).toBe(true);
    expect(isCanonicalEvmReturnBlob(framed, [['Record']], resultStructs)).toBe(true);
    expect(isCanonicalEvmReturnBlob(digest, [['Record']], resultStructs)).toBe(false);
    expect(selectEvmReturnCommitment(
      [digest, framed], [['Record']], false, resultStructs,
    )).toBe(binToHex(vector));
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

describe('isConstrainedEvmResultVector', () => {
  it('accepts a complete multi-row vector with at least one constrained row', () => {
    expect(isConstrainedEvmResultVector([['uint256'], ['bool'], ['bool']])).toBe(true);
    expect(isConstrainedEvmResultVector([['uint256'], ['address']])).toBe(true);
    expect(isConstrainedEvmResultVector([['uint256'], ['uint8']])).toBe(true);
    expect(isConstrainedEvmResultVector([['bytes32'], ['uint256']])).toBe(true);
  });

  it('rejects vectors whose rows are all unconstrained ABI-width words', () => {
    expect(isConstrainedEvmResultVector([['uint256'], ['uint256']])).toBe(false);
    expect(isConstrainedEvmResultVector([['int'], ['bigint']])).toBe(false);
  });

  it('rejects single-row schemas and dynamic rows', () => {
    expect(isConstrainedEvmResultVector([['bool']])).toBe(false);
    expect(isConstrainedEvmResultVector([['uint256']])).toBe(false);
    expect(isConstrainedEvmResultVector([['uint256'], ['bytes']])).toBe(false);
    expect(isConstrainedEvmResultVector([['bool'], ['string']])).toBe(false);
    expect(isConstrainedEvmResultVector([])).toBe(false);
  });

  it('selects the bare multi-row vector only when its rows constrain the encoding', () => {
    const vector = new Uint8Array(96);
    vector[31] = 0xa0;
    vector[63] = 1;
    vector[95] = 1;
    const groups = [['uint256'], ['bool'], ['bool']];

    // A progressive probe can stop after the route assembled its frame and before that frame's output
    // comparison; the complete vector is then the only authenticated observation of the result.
    expect(selectEvmReturnCommitment([vector], groups, true)).toBe(binToHex(vector));
    expect(selectEvmReturnCommitment([vector], groups, false)).toBeUndefined();
    // The compiler-framed form still wins when both are live.
    expect(selectEvmReturnCommitment([vector, encodePushdataValue(vector, 'bytes')], groups, true))
      .toBe(binToHex(vector));
  });
});

describe('selectMaterializedTailReturnEvents', () => {
  const group = (overrides: Record<string, unknown> = {}): never => ({
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

  it('keeps a logical read result when its physical carrier becomes a writer', () => {
    const readResult = new Uint8Array(32);
    readResult[31] = 7;
    const writerResult = new Uint8Array(32);
    writerResult[31] = 1;
    const carrier = {
      functionName: 'write', logicalFunctionName: 'write', precomputedReturnCommitment: readResult,
    };
    expect(selectPreparedAtomicReturnSeed(carrier, 'read', writerResult)).toEqual(readResult);
    expect(selectPreparedAtomicReturnSeed(carrier, 'write', writerResult)).toEqual(writerResult);
    expect(selectPreparedAtomicReturnSeed({ ...carrier, functionName: '__forward', logicalFunctionName: 'read' },
      'read', writerResult)).toEqual(writerResult);
    expect(selectPreparedAtomicReturnSeed({ ...carrier, precomputedReturnCommitment: undefined },
      'read', writerResult)).toBeUndefined();
  });

  it('does not prepare an isolated read after an earlier mutation of its participant', () => {
    const artifact = { abi: [
      { name: 'balanceOf', writesState: false },
      { name: 'transferFrom', writesState: true },
    ] };
    const contract = (categoryId: string): { categoryId: string; inner: { artifact: typeof artifact } } => (
      { categoryId, inner: { artifact } }
    );
    const nodes = [
      { contract: contract('token'), functionName: 'balanceOf' },
      { contract: contract('other'), functionName: 'transferFrom' },
      { contract: contract('token'), functionName: 'transferFrom' },
      { contract: contract('token'), functionName: 'balanceOf' },
    ] as never;
    expect(discoveredReturnFollowsParticipantWrite(nodes, 0)).toBe(false);
    expect(discoveredReturnFollowsParticipantWrite(nodes, 2)).toBe(false);
    expect(discoveredReturnFollowsParticipantWrite(nodes, 3)).toBe(true);
  });

  it('does not prepare a cross-contract result whose nested read follows an earlier write', () => {
    const artifact = { abi: [
      { name: 'root', writesState: true },
      { name: 'release', writesState: true },
      { name: 'claim', writesState: true },
      { name: 'getEscrow', writesState: false },
      { name: 'unrelatedRead', writesState: false },
    ] };
    const contract = (categoryId: string): { categoryId: string; inner: { artifact: typeof artifact } } => (
      { categoryId, inner: { artifact } }
    );
    const nodes = [
      { contract: contract('marketplace'), functionName: 'root', parent: null },
      { contract: contract('escrow'), functionName: 'release', parent: 0 },
      { contract: contract('claim'), functionName: 'claim', parent: 1 },
      { contract: contract('escrow'), functionName: 'getEscrow', parent: 2 },
      { contract: contract('unrelated'), functionName: 'unrelatedRead', parent: 0 },
    ] as never;
    expect(discoveredReturnFollowsParticipantWrite(nodes, 2)).toBe(true);
    expect(discoveredReturnFollowsParticipantWrite(nodes, 3)).toBe(true);
    expect(discoveredReturnFollowsParticipantWrite(nodes, 4)).toBe(false);
  });

  it('does not treat missing interface effect metadata as a read-only proof', () => {
    const interfaceArtifact = { abi: [{ name: 'release' }] };
    const readArtifact = { abi: [{ name: 'claim', writesState: true }, { name: 'getEscrow', writesState: false }] };
    const nodes = [
      {
        contract: { categoryId: 'escrow', inner: { artifact: interfaceArtifact } },
        functionName: 'release', selector: '01020304', parent: null,
      },
      {
        contract: { categoryId: 'claim', inner: { artifact: readArtifact } },
        functionName: 'claim', parent: 0,
      },
      {
        contract: { categoryId: 'escrow', inner: { artifact: readArtifact } },
        functionName: 'getEscrow', parent: 1,
      },
    ] as never;
    expect(discoveredReturnFollowsParticipantWrite(nodes, 1)).toBe(true);
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
  const row = (key: bigint, count: bigint): RouteRow => ({
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
    candidate: RouteRow, access: NonNullable<RouteRow['handler']['entryAccesses']>[number], type: string,
  ): Uint8Array | undefined => {
    const index = access.storedElementSource?.expression.source?.paramIndex;
    return index === undefined ? undefined
      : encodeStructArgument(candidate.args[index], type, definitions);
  };

  it('encodes only earlier pushes targeting the final row key', () => {
    const encoded = encodeLeadingRouteArrayPushes({
      rowArguments: [row(7n, 2n), row(8n, 3n), row(7n, 4n)],
      collection: 'history',
      valueType: 'Pair[]',
      structs,
      resolveElement: resolveElement(structs),
    });
    expect(encoded).toBeDefined();
    expect(decodePushdataValue(encoded!, 0, 'Pair[]', structs).value).toEqual([{
      count: 2n,
      active: true,
    }]);
  });

  it('encodes the terminal push when pinning the complete selected-route value', () => {
    const initialValue = encodePushdataValue([{ count: 1n, active: false }], 'Pair[]', structs);
    const encoded = encodeCompleteRouteArrayPushes({
      rowArguments: [row(7n, 2n), row(8n, 3n), row(7n, 4n)],
      collection: 'history',
      valueType: 'Pair[]',
      structs,
      initialValue,
      resolveElement: resolveElement(structs),
    });
    expect(encoded).toBeDefined();
    expect(decodePushdataValue(encoded!, 0, 'Pair[]', structs).value).toEqual([
      { count: 1n, active: false },
      { count: 2n, active: true },
      { count: 4n, active: true },
    ]);
  });

  it('encodes a singleton terminal push from the empty array pre-state', () => {
    const encoded = encodeCompleteRouteArrayPushes({
      rowArguments: [row(7n, 2n)],
      collection: 'history',
      valueType: 'Pair[]',
      structs,
      resolveElement: resolveElement(structs),
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
      resolveElement: resolveElement(structs),
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
          mutationEffectOrdinals: [0],
          arrayMutation: 'push',
          storedElementSource: {
            version: 1, mutationEffectOrdinal: 0, elementType: 'Stamped',
            expression: { kind: 'source', type: 'Stamped', source: { kind: 'forward', paramIndex: 1 } },
          },
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
      resolveElement: resolveElement(stampedStructs),
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
