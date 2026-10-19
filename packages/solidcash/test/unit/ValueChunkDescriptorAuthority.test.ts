import { binToHex } from '@bitauth/libauth';
import { computeCollectionHash, sha256 as sha256Sync } from '@solidcash/utils';
import { afterEach, describe, expect, it } from 'vitest';
import { getValueChunkLockingBytecode } from '../../src/stateful/covenant-helpers.js';
import {
  StatefulTransactionBuilder,
  ValueChunkWriteStagingSession,
  commitStagedValueChunkWrite,
  legacyIsPersistedValueChunkReady,
  isValueChunkWriteReady,
  materializedValueChunkAbsoluteStart,
  persistedValueChunkWriteState,
  permitsHeuristicValueChunkRunRelocation,
  legacyRememberValueChunkLock,
  legacyRememberValueChunkValue,
  selectValueChunkResource,
  selectValueChunkCommitmentObservations,
  legacyStageValueChunkValue,
  stagedValueChunkWrite,
  stageValueChunkWrite,
  type ValueChunkWriteDescriptor,
} from '../../src/stateful/StatefulTransactionBuilder.js';

const categoryId = '71'.repeat(31) + '8e';

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

  it('keeps compiler-described physical runs out of descriptor-free relocation', () => {
    expect(permitsHeuristicValueChunkRunRelocation(
      `${categoryId}:${descriptor('records', 1).collectionHash}:${'01'.repeat(32)}`,
    )).toBe(false);
    expect(permitsHeuristicValueChunkRunRelocation()).toBe(true);
  });

  it('keeps sequential operations on one storage identity under one resource owner', () => {
    const insert = { ...descriptor('records', 1), operation: 'insert' as const, routeSlot: 2 };
    const update = { ...descriptor('records', 1), operation: 'update' as const, routeSlot: 8 };

    expect(selectValueChunkResource([insert, update])).toEqual({
      status: 'exact',
      identity: `${categoryId}:${insert.collectionHash}:${insert.keySlot}`,
      categoryId,
    });
    expect(selectValueChunkResource([insert, descriptor('records', 2)])).toMatchObject({
      status: 'multi',
    });
  });

  it('does not rebase VM-authenticated physical runs by a composition block base', () => {
    const resourceIdentity = `${categoryId}:${descriptor('records', 1).collectionHash}:${'01'.repeat(32)}`;
    expect(materializedValueChunkAbsoluteStart(63, 4, resourceIdentity)).toBe(63);
    expect(materializedValueChunkAbsoluteStart(63, 4)).toBe(67);
  });

  it('isolates mutable staged values between transaction build sessions', () => {
    const firstSession = new ValueChunkWriteStagingSession();
    const secondSession = new ValueChunkWriteStagingSession();
    const firstValue = new Uint8Array(96).fill(0x31);
    const secondValue = new Uint8Array(96).fill(0x32);

    expect(stageValueChunkWrite(descriptor('records', 1), firstValue, firstSession)).toBe(true);
    expect(stageValueChunkWrite(descriptor('records', 1), secondValue, secondSession)).toBe(true);
    expect(stagedValueChunkWrite(descriptor('records', 1), firstSession)).toEqual(firstValue);
    expect(stagedValueChunkWrite(descriptor('records', 1), secondSession)).toEqual(secondValue);

    firstSession.clear(categoryId);
    expect(stagedValueChunkWrite(descriptor('records', 1), firstSession)).toBeUndefined();
    expect(stagedValueChunkWrite(descriptor('records', 1), secondSession)).toEqual(secondValue);
  });

  it('retains independent values and locks for resources sharing one category', () => {
    const first = descriptor('records', 1);
    const second = descriptor('receipts', 2);
    const firstValue = new Uint8Array(100).fill(0x31);
    const secondValue = new Uint8Array(112).fill(0x52);
    const firstLock = getValueChunkLockingBytecode(
      categoryId, first.collection, Uint8Array.from({ length: 32 }, () => 1),
      sha256Sync(firstValue),
    );
    const secondLock = getValueChunkLockingBytecode(
      categoryId, second.collection, Uint8Array.from({ length: 32 }, () => 2),
      sha256Sync(secondValue),
    );

    // Model two authenticated observations before either resource is requested
    // from the descriptor registry. Observation order must not evict the first.
    legacyRememberValueChunkValue(categoryId, firstValue);
    legacyRememberValueChunkLock(categoryId, firstLock);
    legacyRememberValueChunkValue(categoryId, secondValue);
    legacyRememberValueChunkLock(categoryId, secondLock);

    expect(persistedValueChunkWriteState(first)).toMatchObject({
      value: firstValue,
      lockingBytecode: firstLock,
    });
    expect(persistedValueChunkWriteState(second)).toMatchObject({
      value: secondValue,
      lockingBytecode: secondLock,
    });
  });

  it('stages and readies alpha-renamed resources by collection and key identity', () => {
    const first = descriptor('ledgerRows', 1);
    const second = descriptor('auditRows', 1);
    const third = descriptor('ledgerRows', 2);
    const firstValue = new Uint8Array(100).fill(0x31);
    const secondValue = new Uint8Array(112).fill(0x52);
    const thirdValue = new Uint8Array(116).fill(0x64);
    const legacyCategoryValue = new Uint8Array(124).fill(0x73);
    const firstLock = getValueChunkLockingBytecode(
      categoryId, first.collection, new Uint8Array(32).fill(1), sha256Sync(firstValue),
    );
    const secondLock = getValueChunkLockingBytecode(
      categoryId, second.collection, new Uint8Array(32).fill(1), sha256Sync(secondValue),
    );
    const thirdLock = getValueChunkLockingBytecode(
      categoryId, third.collection, new Uint8Array(32).fill(2), sha256Sync(thirdValue),
    );

    expect(stageValueChunkWrite(first, firstValue)).toBe(true);
    expect(stageValueChunkWrite(second, secondValue)).toBe(true);
    expect(stageValueChunkWrite(third, thirdValue)).toBe(true);
    legacyStageValueChunkValue(categoryId, legacyCategoryValue);
    expect(stagedValueChunkWrite(first)).toEqual(firstValue);
    expect(stagedValueChunkWrite(second)).toEqual(secondValue);
    expect(stagedValueChunkWrite(third)).toEqual(thirdValue);

    expect(commitStagedValueChunkWrite(first, firstLock)).toBe(true);
    expect(isValueChunkWriteReady(first)).toBe(true);
    expect(isValueChunkWriteReady(second)).toBe(false);
    expect(isValueChunkWriteReady(third)).toBe(false);
    expect(legacyIsPersistedValueChunkReady()).toBe(false);
    expect(stagedValueChunkWrite(second)).toEqual(secondValue);
    expect(persistedValueChunkWriteState(first)?.value).toEqual(firstValue);
    expect(persistedValueChunkWriteState(second)).toBeUndefined();

    expect(commitStagedValueChunkWrite(second, secondLock)).toBe(true);
    expect(isValueChunkWriteReady(second)).toBe(true);
    expect(persistedValueChunkWriteState(second)?.value).toEqual(secondValue);
    expect(stagedValueChunkWrite(third)).toEqual(thirdValue);
    expect(commitStagedValueChunkWrite(third, thirdLock)).toBe(true);
    expect(isValueChunkWriteReady(third)).toBe(true);
    expect(persistedValueChunkWriteState(third)?.value).toEqual(thirdValue);
    expect(persistedValueChunkWriteState(first)?.value).toEqual(firstValue);
  });

  it('classifies failing chunk pins by described slot ownership, not payload bytes', () => {
    const exactLock = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x41), 0x87]);
    const unrelatedLock = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x62), 0x87]);
    const payload = '005e1976a91447d9fe52d462741f418e9dd5efaa6ae7e7adb60088ac0000';
    const selected = selectValueChunkCommitmentObservations([
      { kind: 'lockingBytecode', outputIndex: 12, lockingBytecode: unrelatedLock },
      { kind: 'commitment', outputIndex: 12, commitment: '010203' },
      { kind: 'lockingBytecode', outputIndex: 12, lockingBytecode: exactLock },
      { kind: 'commitment', outputIndex: 12, commitment: payload },
      { kind: 'lockingBytecode', outputIndex: 20, lockingBytecode: exactLock },
      { kind: 'commitment', outputIndex: 20, commitment: '040506' },
    ], { outputBase: 12, outputCount: 2, lockingBytecode: exactLock });

    expect(selected).toEqual(new Map([[12, payload]]));
  });

});
