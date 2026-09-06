import { binToHex } from '@bitauth/libauth';
import { computeCollectionHash, sha256 as sha256Sync } from '@solidcash/utils';
import { afterEach, describe, expect, it } from 'vitest';
import { getValueChunkLockingBytecode } from '../../src/stateful/covenant-helpers.js';
import {
  StatefulTransactionBuilder,
  persistedValueChunkWriteState,
  rememberJobEventsLock,
  rememberJobEventsValue,
  type ValueChunkWriteDescriptor,
} from '../../src/stateful/StatefulTransactionBuilder.js';

const categoryId = '71'.repeat(32);

const descriptor = (
  collection: string,
  keyByte: number,
): ValueChunkWriteDescriptor => {
  const collectionSignature = `${collection}:mapping(uint256 => Record[])`;
  return {
    categoryId,
    collection,
    collectionSignature,
    collectionHash: binToHex(computeCollectionHash(collectionSignature)),
    keySlot: keyByte.toString(16).padStart(2, '0').repeat(32),
    entryAccessSlot: keyByte,
    routeSlot: keyByte,
    operation: 'update',
    outputBase: 8 + keyByte,
    outputCount: 1,
  };
};

describe('value-chunk descriptor authority', () => {
  afterEach(() => StatefulTransactionBuilder.clearPersistedJobEvents());

  it('retains independent values and locks for resources sharing one category', () => {
    const first = descriptor('records', 1);
    const second = descriptor('receipts', 2);
    const firstValue = new Uint8Array(100).fill(0x31);
    const secondValue = new Uint8Array(112).fill(0x52);
    const firstLock = getValueChunkLockingBytecode(
      categoryId, first.collectionSignature, Uint8Array.from({ length: 32 }, () => 1),
      sha256Sync(firstValue),
    );
    const secondLock = getValueChunkLockingBytecode(
      categoryId, second.collectionSignature, Uint8Array.from({ length: 32 }, () => 2),
      sha256Sync(secondValue),
    );

    // Model two authenticated observations before either resource is requested
    // from the descriptor registry. Observation order must not evict the first.
    rememberJobEventsValue(categoryId, firstValue);
    rememberJobEventsLock(categoryId, firstLock);
    rememberJobEventsValue(categoryId, secondValue);
    rememberJobEventsLock(categoryId, secondLock);

    expect(persistedValueChunkWriteState(first)).toMatchObject({
      value: firstValue,
      lockingBytecode: firstLock,
    });
    expect(persistedValueChunkWriteState(second)).toMatchObject({
      value: secondValue,
      lockingBytecode: secondLock,
    });
  });

  it.todo('classifies failing chunk pins by described slot ownership, not payload bytes');
});
