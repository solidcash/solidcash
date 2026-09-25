/**
 * Claim 7: the value tail's two thresholds.
 *
 * Spec: docs/per-call/SPEC_PER_CALL_TRANSACTION.md
 *   1461 - long value: "Head in the node's tail: `len4 || sha256(v) || v[0:28]`; chunks ... Chunk:
 *          `uint16LE(i) || 126-byte slice`";
 *   1467-1472 - "A node's tail holds 64 bytes, and both thresholds come from it: a fixed-width value whose
 *          canonical encoding is at most 64 bytes fills the tail directly; ... a length-prefixed value of at most
 *          60 bytes fits inline, since `len4 || v` is then at most 64 bytes. A longer one is a long value ...
 *          The table's 'over 60 bytes' counts the value, not the tail".
 * Doc: packages/solidc/docs/verified-mappings.md 3.1-3.3 (value encoding, chunk layout).
 */
import { describe, it, expect } from 'vitest';
import { sha256 } from '@bitauth/libauth';
import {
  VALUE_HEAD_SIZE, VALUE_INLINE_LIMIT, VALUE_CHUNK_SIZE, VALUE_CHUNK_INDEX_SIZE,
  encodeChunkableValueTail, splitValueIntoValueChunks, buildValueChunkCommitment, parseValueChunkCommitment,
  joinValueChunks,
} from '../../../../utils/src/state.js';
import { isChunkableValueType, parseType, fixedWidthBytes } from '../../../../utils/src/types.js';
import { encodeEntryCommitment } from '../../../../solidcash/src/stateful/SortedList.js';
import { compileString } from '../../direct-compile.js';
import { concatBytes, hex } from './fixtures.js';

function lengthPrefix(length: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, length, true);
  return out;
}

function bytes(length: number, seed = 1): Uint8Array {
  return new Uint8Array(length).map((_, i) => (i * 31 + seed) & 0xff);
}

describe('section 20 value tail thresholds', () => {
  it('the constants are the ones the spec states, and they compose to a 64-byte tail (SPEC:1461,1467)', () => {
    expect(VALUE_INLINE_LIMIT).toBe(60);
    expect(VALUE_HEAD_SIZE).toBe(28);
    expect(VALUE_CHUNK_INDEX_SIZE).toBe(2);
    expect(VALUE_CHUNK_SIZE).toBe(126); // 128 - uint16 index
    expect(4 + VALUE_INLINE_LIMIT).toBe(64);          // inline: len4 || v
    expect(4 + 32 + VALUE_HEAD_SIZE).toBe(64);        // long: len4 || root || head
  });

  it('a length-prefixed value is inline up to 60 VALUE bytes, then a head (SPEC:1471-1472)', () => {
    // The threshold is measured on the value bytes, never on the tail: a 60-byte value and a 61-byte value both
    // produce a 64-byte tail, so only the value length can discriminate them.
    const inline = encodeChunkableValueTail(bytes(60));
    expect(inline).toEqual(concatBytes(lengthPrefix(60), bytes(60)));
    expect(inline.length).toBe(64);

    const head = encodeChunkableValueTail(bytes(61));
    expect(head).toEqual(concatBytes(lengthPrefix(61), sha256.hash(bytes(61)), bytes(61).slice(0, VALUE_HEAD_SIZE)));
    expect(head.length).toBe(64);

    // Zero-length inline is the bare length prefix.
    expect(encodeChunkableValueTail(new Uint8Array())).toEqual(lengthPrefix(0));
  });

  it('chunks start after the 28-byte head and are 126 bytes each (SPEC:1461)', () => {
    const value = bytes(28 + VALUE_CHUNK_SIZE * 2 + 5); // 285 bytes -> chunks of 126, 126, 5
    const chunks = splitValueIntoValueChunks(value);
    expect(chunks.map((chunk) => chunk.length)).toEqual([126, 126, 5]);
    // The head (first 28 bytes) stays in the node tail, so chunk i starts at offset 28 + 126*i.
    for (let i = 0; i < chunks.length; i += 1) {
      expect(chunks[i]).toEqual(value.slice(VALUE_HEAD_SIZE + VALUE_CHUNK_SIZE * i,
        VALUE_HEAD_SIZE + VALUE_CHUNK_SIZE * (i + 1)));
    }

    const commitments = chunks.map((chunk, i) => buildValueChunkCommitment(i, chunk));
    commitments.forEach((commitment, i) => {
      const expected = concatBytes(new Uint8Array([i & 0xff, (i >> 8) & 0xff]), chunks[i]); // uint16LE(i)
      expect(commitment).toBe(hex(expected));
      expect(parseValueChunkCommitment(commitment)).toEqual({ chunkIndex: i, chunkData: chunks[i] });
      expect(expected.length).toBeLessThanOrEqual(128);
    });

    // Reconstruction is exact and driven by the authoritative length.
    const headData = value.slice(0, VALUE_HEAD_SIZE);
    expect(joinValueChunks(headData, chunks.map((chunkData, i) => ({ chunkIndex: i, chunkData })), value.length))
      .toEqual(value);
  });

  it('strict reconstruction rejects the malformed chunk sets (Doc: verified-mappings.md 3.4)', () => {
    const value = bytes(VALUE_HEAD_SIZE + 200);
    expect(() => joinValueChunks(value.slice(0, VALUE_HEAD_SIZE), [], VALUE_INLINE_LIMIT)).toThrow();
    expect(() => joinValueChunks(bytes(28, 9), [], value.length)).toThrow();
    expect(() => joinValueChunks(value.slice(0, VALUE_HEAD_SIZE), [{ chunkIndex: 1, chunkData: value.slice(28) }],
      value.length)).toThrow();
  });

  it('the direct class is chosen by the value TYPE, not by measuring the encoding (SPEC:1468)', () => {
    // The direct/length-prefixed split is a type classification; only the length-prefixed branch is measured, at
    // the 60-value-byte boundary (encodeChunkableValueTail). A direct value is placed in the tail verbatim
    // (StatefulContract.ts:10837 "fixed rawbytes (bytesN/address): stored verbatim, no tail").
    expect(isChunkableValueType(parseType('uint256'))).toBe(false);
    expect(isChunkableValueType(parseType('bool'))).toBe(false);
    expect(isChunkableValueType(parseType('bytes32'))).toBe(false);
    expect(isChunkableValueType(parseType('pubkey'))).toBe(false);
    expect(isChunkableValueType(parseType('datasig'))).toBe(false); // 64 raw bytes fill the tail exactly
    expect(isChunkableValueType(parseType('string'))).toBe(true);
    expect(isChunkableValueType(parseType('bytes'))).toBe(true);
    expect(isChunkableValueType(parseType('uint256[]'))).toBe(true);

    // A 64-byte datasig raw value plus slot+next is exactly the 128-byte commitment ceiling.
    expect(encodeEntryCommitment(new Uint8Array(32), new Uint8Array(32), bytes(64)).length).toBe(128);
    expect(fixedWidthBytes(parseType('bytes32'))).toBe(32);
  });

  it('the compiler marks exactly the chunkable value types in the artifact (SPEC:1468,1471)', () => {
    const flagOf = (valueType: string): boolean | undefined => {
      const artifact = compileString(
        `contract C { mapping(int=>${valueType}) m; function f(int k) external { m[k]=m[k]; require(true); } }`,
      ) as unknown as { stateLayout: { collections: Array<{ chunkableValue?: boolean }> } };
      return artifact.stateLayout.collections[0].chunkableValue;
    };
    expect(flagOf('bool')).toBeUndefined();
    expect(flagOf('uint256')).toBeUndefined();
    expect(flagOf('bytes32')).toBeUndefined();
    expect(flagOf('datasig')).toBeUndefined();
    expect(flagOf('string')).toBe(true);
    expect(flagOf('bytes')).toBe(true);
  });

  it('DIVERGENCE: `sig` and `bigint` are stored directly although their encoding exceeds 64 bytes', () => {
    // The spec's direct class is "canonical encoding at most 64 bytes" (SPEC:1468) and verified-mappings.md:132
    // states that a 65-byte Schnorr `sig` "is therefore chunkable". The shipped classifier disagrees: it is
    // type-based and returns false for `sig` (up to 73 raw bytes) and for unbounded `bigint`, so the compiler
    // emits no `chunkableValue` flag and the tail is the verbatim value with no length prefix.
    expect(isChunkableValueType(parseType('sig'))).toBe(false);
    expect(isChunkableValueType(parseType('bigint'))).toBe(false);

    const flagOf = (valueType: string): boolean | undefined => {
      const artifact = compileString(
        `contract C { mapping(int=>${valueType}) m; function f(int k) external { m[k]=m[k]; require(true); } }`,
      ) as unknown as { stateLayout: { collections: Array<{ chunkableValue?: boolean }> } };
      return artifact.stateLayout.collections[0].chunkableValue;
    };
    expect(flagOf('sig')).toBeUndefined();
    expect(flagOf('bigint')).toBeUndefined();

    // A 65-byte raw value would need a 129-byte commitment, above the 128-byte packing target.
    expect(encodeEntryCommitment(new Uint8Array(32), new Uint8Array(32), bytes(65)).length).toBe(129);
  });
});
