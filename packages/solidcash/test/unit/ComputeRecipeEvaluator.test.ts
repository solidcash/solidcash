import { binToHex } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { describe, expect, it } from 'vitest';
import type { Artifact, ExternalCallExpression } from '@solidcash/utils';
import {
  evaluateComputeRecipeExpression,
  evaluateSignature65RecoveryArgument,
  PendingComputeProducerResult,
} from '../../src/message-bus/compute-recipe-evaluator.js';

const artifact = {
  compiler: { options: { solidityImportCompat: true } },
} as Artifact;

describe('compute side-car recipe replay', () => {
  const length: ExternalCallExpression = {
    kind: 'producerResult', callsiteId: 1, resultIndex: 0, type: 'uint256',
  };
  const jobId: ExternalCallExpression = { kind: 'source', source: { kind: 'forward', paramIndex: 0 } };
  const signature: ExternalCallExpression = { kind: 'source', source: { kind: 'forward', paramIndex: 1 } };
  const innerPreimage: ExternalCallExpression = { kind: 'abiEncode', args: [length, jobId] };
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
});
