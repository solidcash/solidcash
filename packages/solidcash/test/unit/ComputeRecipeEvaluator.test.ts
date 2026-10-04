import { binToHex } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { describe, expect, it } from 'vitest';
import type { Artifact, ExternalCallExpression } from '@solidcash/utils';
import {
  evaluateArgs4RecoveryArgument,
  evaluateComputeRecipeExpression,
  evaluateSignature65RecoveryArgument,
  PendingComputeProducerResult,
  UnusableComputeSignature,
} from '../../src/message-bus/compute-recipe-evaluator.js';

const artifact = {
  compiler: { options: { solidityImportCompat: true } },
} as Artifact;

describe('compute side-car recipe replay', () => {
  const length: ExternalCallExpression = {
    kind: 'producerResult', callsiteId: 1, resultIndex: 0, type: 'uint256',
  };
  const recordId: ExternalCallExpression = { kind: 'source', source: { kind: 'forward', paramIndex: 0 } };
  const signature: ExternalCallExpression = { kind: 'source', source: { kind: 'forward', paramIndex: 1 } };
  const innerPreimage: ExternalCallExpression = { kind: 'abiEncode', args: [length, recordId] };
  const innerHash: ExternalCallExpression = { kind: 'call', name: 'keccak256', args: [innerPreimage] };
  const prefix = '\x19Ethereum Signed Message:\n32';
  const outerPreimage: ExternalCallExpression = {
    kind: 'bytesConcat', args: [{ kind: 'literal', value: prefix, type: 'string' }, innerHash],
  };
  const outerHash: ExternalCallExpression = { kind: 'call', name: 'keccak256', args: [outerPreimage] };
  const sig = Uint8Array.from([...new Uint8Array(31), 1, ...new Uint8Array(31), 2, 27]);
  const ctx = {
    artifact, args: [7n, sig], inputTypes: ['uint256', 'bytes'],
    producerResult: () => 3n,
  };

  it('replays nested Solidity ABI hashes in reserved outer/inner ordinal order', () => {
    const inner = evaluateComputeRecipeExpression(innerPreimage, ctx) as Uint8Array;
    expect(inner.length).toBe(64);
    expect(binToHex(inner.slice(0, 32))).toBe(`${'0'.repeat(63)}3`);
    expect(binToHex(inner.slice(32))).toBe(`${'0'.repeat(63)}7`);
    const outer = evaluateComputeRecipeExpression(outerPreimage, ctx) as Uint8Array;
    expect(binToHex(outer)).toBe(binToHex(new Uint8Array([
      ...new TextEncoder().encode(prefix), ...keccak_256(inner),
    ])));
    expect(binToHex(evaluateComputeRecipeExpression(outerHash, ctx) as Uint8Array))
      .toBe(binToHex(keccak_256(outer)));
  });

  it('binds signature65 recovery as little-endian scalar words', () => {
    const digest = evaluateComputeRecipeExpression(outerHash, ctx) as Uint8Array;
    const blob = evaluateSignature65RecoveryArgument(outerHash, signature, ctx);
    expect(blob.length).toBe(97);
    expect(binToHex(blob.slice(0, 32))).toBe(binToHex(digest.slice().reverse()));
    expect(blob[32]).toBe(27);
    expect(blob[33]).toBe(1);
    expect(blob[65]).toBe(2);
  });

  it('leaves malformed runtime signatures unresolved without manufacturing recovery arguments', () => {
    for (const invalid of ['bchtest:not-a-byte-string', new Uint8Array(20),
      Uint8Array.from([...sig.slice(0, 64), 29])]) {
      expect(() => evaluateSignature65RecoveryArgument(outerHash, signature, {
        ...ctx, args: [7n, invalid],
      })).toThrow(UnusableComputeSignature);
    }
    const malformedRecipe: ExternalCallExpression = { kind: 'call', name: 'unknown', args: [] };
    expect(() => evaluateSignature65RecoveryArgument(outerHash, malformedRecipe, ctx))
      .toThrow(/unsupported compute recipe expression/);
  });

  it('reverses args4 scalar words under evmCompat without Solidity import mode', () => {
    const evm = { compiler: { options: { evmCompat: true } } } as Artifact;
    const words = [
      Uint8Array.from([...new Uint8Array(31), 3]), 27n,
      Uint8Array.from([...new Uint8Array(31), 4]),
      Uint8Array.from([...new Uint8Array(31), 5]),
    ] as const;
    const args4 = words.map((_value, index) => ({
      kind: 'source', source: { kind: 'forward', paramIndex: index },
    })) as [ExternalCallExpression, ExternalCallExpression,
      ExternalCallExpression, ExternalCallExpression];
    const blob = evaluateArgs4RecoveryArgument(args4, {
      artifact: evm, args: words as unknown as (bigint | Uint8Array)[],
      inputTypes: ['bytes32', 'uint8', 'bytes32', 'bytes32'],
      producerResult: () => undefined,
    });
    expect(blob.length).toBe(97);
    expect(blob[0]).toBe(3);
    expect(blob[32]).toBe(27);
    expect(blob[33]).toBe(4);
    expect(blob[65]).toBe(5);
  });

  it('refuses absent producer values instead of treating a zero-shaped seed as authority', () => {
    expect(() => evaluateComputeRecipeExpression(innerPreimage, {
      ...ctx, producerResult: () => undefined,
    })).toThrow(PendingComputeProducerResult);
  });

  it('decodes compiler-published unprefixed fixed-byte literals exactly', () => {
    const literal: ExternalCallExpression = { kind: 'literal', type: 'bytes1', value: 'ff' };
    const concat: ExternalCallExpression = { kind: 'bytesConcat', args: [literal, literal] };
    expect(binToHex(evaluateComputeRecipeExpression(concat, ctx) as Uint8Array)).toBe('ffff');
  });

  it('replays typed packed-ABI operands and numeric casts before Keccak', () => {
    const packed: ExternalCallExpression = {
      kind: 'abiEncodePacked', fields: ['uint16', 'uint16', 'bytes2', 'bool'], args: [
        { kind: 'cast', type: 'uint16', expression: { kind: 'literal', type: 'uint256', value: '2' } },
        { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
        { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
        { kind: 'literal', type: 'bool', value: true },
      ],
    };
    const packedCtx = {
      ...ctx, args: [3n, Uint8Array.of(0xab, 0xcd)], inputTypes: ['uint16', 'bytes2'],
    };
    expect(binToHex(evaluateComputeRecipeExpression(packed, packedCtx))).toBe('00020003abcd01');
    expect(binToHex(evaluateComputeRecipeExpression({ kind: 'call', name: 'keccak256', args: [packed] },
      packedCtx))).toBe(binToHex(keccak_256(Uint8Array.of(0, 2, 0, 3, 0xab, 0xcd, 1))));
  });
});
