import { binToHex } from '@bitauth/libauth';
import { computeCollectionHash, sha256 as sha256Sync } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  legacyJobEventsPersistValueChunkLock,
  persistValueChunkLock,
  permitsLegacyNamedValueChunkFallback,
  type ValueChunkWriteDescriptor,
} from '../../src/stateful/StatefulTransactionBuilder.js';
import { getValueChunkLockingBytecode } from '../../src/stateful/covenant-helpers.js';

const ownerCategory = '11'.repeat(31) + 'ee';
const candidateCategory = '22'.repeat(31) + 'dd';
const collectionSignature = 'records:mapping(uint256 => Record[])';
const keySlot = '33'.repeat(32);
const value = new Uint8Array(96).fill(0x44);
const masterLock = Uint8Array.from({ length: 35 }, (_, index) => (
  index === 0 ? 0xaa : index === 1 ? 0x20 : index === 34 ? 0x87 : 0x42
));

const write: ValueChunkWriteDescriptor = {
  categoryId: ownerCategory,
  collection: 'records',
  collectionSignature,
  collectionHash: '',
  keySlot,
  entryAccessSlot: 0,
  routeSlot: 0,
  operation: 'update',
  outputBase: 5,
  outputCount: 1,
};

describe('persist value-chunk lock generality', () => {
  it('fails closed for an unmatched kernel candidate instead of synthesizing a legacy schema lock', () => {
    const kernelArtifact = { messageBus: { convention: 'kernel-row-loop' as const } };
    const candidate = persistValueChunkLock(candidateCategory, value, undefined, masterLock);
    const legacy = legacyJobEventsPersistValueChunkLock(candidateCategory, value, masterLock);

    expect(permitsLegacyNamedValueChunkFallback([{
      logicalArtifact: kernelArtifact as never,
      valueChunkWrites: [write],
    }])).toBe(false);
    expect(permitsLegacyNamedValueChunkFallback([{
      logicalArtifact: { messageBus: { convention: 'legacy-unroll' } } as never,
    }])).toBe(true);
    expect(candidate).toBeUndefined();
    expect(legacy).toBeDefined();
  });

  it('derives a lock only from the exact descriptor identity', () => {
    const exact = {
      ...write,
      collectionHash: binToHex(computeCollectionHash(collectionSignature)),
    };
    const expected = getValueChunkLockingBytecode(
      ownerCategory, write.collection, Uint8Array.from({ length: 32 }, () => 0x33), sha256Sync(value), masterLock,
    );

    expect(persistValueChunkLock(candidateCategory, value, exact, masterLock)).toBeUndefined();
    expect(persistValueChunkLock(ownerCategory, value, exact, masterLock)).toEqual(expected);
  });
});
