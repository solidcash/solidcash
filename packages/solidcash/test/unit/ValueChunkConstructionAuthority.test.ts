import { binToHex } from '@bitauth/libauth';
import { computeCollectionHash, sha256 } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  chunksFromJobEventsValue,
  chunksFromValue,
  legacyJobEventsPersistValueChunkLock,
  permitsLegacyNamedValueChunkFallback,
  type ValueChunkWriteDescriptor,
} from '../../src/stateful/StatefulTransactionBuilder.js';
import { getValueChunkLockingBytecode } from '../../src/stateful/covenant-helpers.js';

const categoryId = '11'.repeat(32);
const collectionSignature = 'records:mapping(uint256 => Record[])';
const keySlot = '22'.repeat(32);
const value = new Uint8Array(96).fill(0x33);

const exactWrite: ValueChunkWriteDescriptor = {
  categoryId,
  collection: 'records',
  collectionSignature,
  collectionHash: binToHex(computeCollectionHash(collectionSignature)),
  keySlot,
  entryAccessSlot: 0,
  routeSlot: 0,
  operation: 'update',
  outputBase: 5,
  outputCount: 1,
};

describe('value-chunk construction authority', () => {
  it('does not manufacture a legacy lock for an undescribed generic or kernel value', () => {
    const kernelGroup = {
      logicalArtifact: { messageBus: { convention: 'kernel-row-loop' as const } } as never,
      valueChunkWrites: [exactWrite],
    };

    expect(permitsLegacyNamedValueChunkFallback([kernelGroup])).toBe(false);
    expect(chunksFromValue(value, { categoryId })).toEqual([]);
    expect(chunksFromValue(value, {
      categoryId,
      write: { ...exactWrite, collectionHash: '00'.repeat(32) },
    })).toEqual([]);
  });

  it('constructs generic chunks from an exact compiler descriptor', () => {
    // Persist locks authenticate the collection name (same as rememberValueChunkUnlockRecipe).
    const expectedLock = getValueChunkLockingBytecode(
      categoryId, exactWrite.collection, Uint8Array.from({ length: 32 }, () => 0x22), sha256(value),
    );
    const chunks = chunksFromValue(value, { write: exactWrite });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((chunk) => binToHex(chunk.lockingBytecode) === binToHex(expectedLock))).toBe(true);
    expect(chunks.every((chunk) => chunk.categoryId === categoryId)).toBe(true);
  });

  it('retains explicit descriptor-free legacy compatibility behind the legacy convention gate', () => {
    const legacyGroup = {
      logicalArtifact: { messageBus: { convention: 'legacy-unroll' as const } } as never,
    };
    expect(permitsLegacyNamedValueChunkFallback([legacyGroup])).toBe(true);

    const expectedLock = legacyJobEventsPersistValueChunkLock(categoryId, value);
    const chunks = chunksFromJobEventsValue(value, undefined, categoryId);
    expect(expectedLock).toBeDefined();
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((chunk) => binToHex(chunk.lockingBytecode) === binToHex(expectedLock!))).toBe(true);
  });
});
