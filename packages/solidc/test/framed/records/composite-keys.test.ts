/**
 * Claim 6: composite keys for nested mappings, and one collection per nested mapping.
 *
 * Spec: docs/framed/SPEC_FRAMED_TRANSACTION.md
 *   1474-1477 - "`mapping(K0 => mapping(K1 => V))` is one collection, not one per outer key. The slot for keys
 *          `k0, k1, ...` is `mask(sha256(sha256(k0) || sha256(k1) || ...))`. A single key gives
 *          `mask(sha256(k0))`. Each `ki` is the key's canonical encoding; `mask` clears the top bit of the last
 *          byte."
 * Doc: packages/solidc/docs/verified-mappings.md 2.1 (slot derivation for nested mappings).
 * Compiler mirror: emitSortedKeyHash (GenerateTargetTraversal.ts:20946-21012), which hashes each key
 *   independently, concatenates, hashes once more and masks.
 */
import { describe, it, expect } from 'vitest';
import { sha256, utf8ToBin, hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { keyToSlot, keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import { computeCollectionSignature, computeCollectionHash } from '../../../../utils/src/state.js';
import { compileString } from '../../direct-compile.js';
import { concatBytes, maskedSha256, valueOf } from './fixtures.js';

const K = {
  outerA: utf8ToBin('job-1'),
  outerB: utf8ToBin('job-2'),
  inner: utf8ToBin('worker-7'),
  third: utf8ToBin('field'),
};

describe('section 20 composite keys', () => {
  it('the slot is the masked hash of the concatenated per-key hashes (SPEC:1475)', () => {
    const expected = maskedSha256(concatBytes(sha256.hash(K.outerA), sha256.hash(K.inner)));
    expect(keyToSlotMulti([K.outerA, K.inner])).toEqual(expected);

    // Three keys concatenate the same way; each key is hashed independently before concatenation.
    const expected3 = maskedSha256(concatBytes(sha256.hash(K.outerA), sha256.hash(K.inner), sha256.hash(K.third)));
    expect(keyToSlotMulti([K.outerA, K.inner, K.third])).toEqual(expected3);

    // A single key reduces to mask(sha256(k0)).
    expect(keyToSlotMulti([K.outerA])).toEqual(keyToSlot(K.outerA));
    expect(keyToSlotMulti([K.outerA])).toEqual(maskedSha256(K.outerA));
  });

  it('hashing each key independently makes the composition unambiguous (SPEC:1475-1476)', () => {
    // Order matters and the boundary between keys is fixed, so no two key sequences collide by construction.
    expect(keyToSlotMulti([K.outerA, K.inner])).not.toEqual(keyToSlotMulti([K.inner, K.outerA]));
    const joined = concatBytes(K.outerA, K.inner);
    expect(keyToSlotMulti([K.outerA, K.inner])).not.toEqual(keyToSlot(joined));
    expect(valueOf(keyToSlotMulti([K.outerA, K.inner])) < (1n << 255n)).toBe(true);
  });

  it('a nested mapping is one collection, not one per outer key (SPEC:1474)', () => {
    const nested = compileString(
      'contract C { mapping(int=>mapping(int=>bool)) m; function f(int a, int b) external { m[a][b]=true; require(true); } }',
    );
    const collections = (nested as unknown as { stateLayout: { collections: Array<Record<string, unknown>> } })
      .stateLayout.collections;
    expect(collections).toHaveLength(1);
    expect(collections[0].signature).toBe('m:mapping(int256 => mapping(int256 => bool))');
    expect(collections[0].keyTypes).toEqual(['int256', 'int256']);
    expect(collections[0].valueType).toBe('bool');

    // A single-key mapping is the same shape with one key type.
    const single = compileString(
      'contract C { mapping(int=>bool) m; function f(int a) external { m[a]=true; require(true); } }',
    );
    const singleCollections = (single as unknown as { stateLayout: { collections: Array<Record<string, unknown>> } })
      .stateLayout.collections;
    expect(singleCollections).toHaveLength(1);
    expect(singleCollections[0].signature).toBe('m:mapping(int256 => bool)');
    expect(singleCollections[0].keyTypes).toBeUndefined();
  });

  it('the compiled script hashes each key, concatenates, hashes once more, then masks (SPEC:1475)', () => {
    const asmOf = (source: string): string => bytecodeToAsm(hexToBin(
      (compileString(source) as unknown as { debug: { bytecode: string } }).debug.bytecode,
    ));
    // 1f = split at 31, 7f = AND-mask the last byte; the composite access hashes the concatenated per-key
    // hashes a second time before masking, the single-key access masks after its one hash.
    const singleMask = 'OP_SHA256 1f OP_SPLIT 7f OP_AND OP_CAT';
    const compositeMask = 'OP_SHA256 OP_CAT OP_SHA256 1f OP_SPLIT 7f OP_AND OP_CAT';

    const nestedAsm = asmOf(
      'contract C { mapping(int=>mapping(int=>bool)) m; function f(int a, int b) external { m[a][b]=true; require(true); } }',
    );
    expect(nestedAsm).toContain(compositeMask);
    expect(nestedAsm).toContain(singleMask);

    const singleAsm = asmOf(
      'contract C { mapping(int=>bool) m; function f(int a) external { m[a]=true; require(true); } }',
    );
    expect(singleAsm).toContain(singleMask);
    expect(singleAsm).not.toContain(compositeMask);
  });

  it('every nested access resolves through the one collection lock (SPEC:1474-1475)', () => {
    // Two different outer keys have different composite slots, yet both live at the one collection's entry lock.
    const slotA = keyToSlotMulti([K.outerA, K.inner]);
    const slotB = keyToSlotMulti([K.outerB, K.inner]);
    expect(valueOf(slotA)).not.toBe(valueOf(slotB));
    expect(valueOf(slotA)).toBe(valueOf(keyToSlotMulti([K.outerA, K.inner]))); // deterministic

    const signature = computeCollectionSignature('m', 'mapping(int256 => mapping(int256 => bool))');
    expect(signature).toBe('m:mapping(int256 => mapping(int256 => bool))');
    const lockSalt = computeCollectionHash(signature);
    expect(lockSalt).toEqual(sha256.hash(utf8ToBin(signature)).slice(0, 20));
    // The salt is per collection, so the nested collection is a different lock from the single-key one.
    expect(computeCollectionHash(signature))
      .not.toEqual(computeCollectionHash(computeCollectionSignature('m', 'mapping(int256 => bool)')));
  });
});
