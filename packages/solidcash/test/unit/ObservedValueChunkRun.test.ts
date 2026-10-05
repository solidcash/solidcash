import { afterEach, describe, expect, it } from 'vitest';
import {
  clearCollectionValueRecords,
  collectionValueWritesForExecution,
  getCollectionValueRecord,
  observeCollectionValueChunks,
  plannedCollectionValueChunkCount,
  stageCollectionValue,
  type CollectionValueIdentity,
} from '../../src/stateful/ValueChunkPersistence.js';

const category = 'ab'.repeat(32);
const lock = (byte: number): Uint8Array => Uint8Array.from([0xaa, 0x20, ...Array(32).fill(byte), 0x87]);
const identity = (
  collectionSignature: string,
  slotByte: number,
  categoryId = category,
): CollectionValueIdentity => ({
  categoryId,
  collectionSignature,
  slot: new Uint8Array(32).fill(slotByte),
});

describe('observed value chunk runs', () => {
  afterEach(() => clearCollectionValueRecords());

  it('isolates records by collection signature and resolved mapping slot', () => {
    const first = identity('items:mapping(bytes32 => Item[])', 1);
    const otherKey = identity('items:mapping(bytes32 => Item[])', 2);
    const otherCollection = identity('messages:mapping(bytes32 => Message[])', 1);
    const firstLock = lock(0x11);
    const firstValue = Uint8Array.from([1, 2, 3]);
    observeCollectionValueChunks(first, [
      { commitment: '000001', lockingBytecode: firstLock },
      { commitment: '010002', lockingBytecode: firstLock },
    ], { value: firstValue, lockingBytecode: firstLock });

    const otherLock = lock(0x22);
    observeCollectionValueChunks(otherKey, [
      { commitment: '000003', lockingBytecode: otherLock },
    ], { value: Uint8Array.of(9), lockingBytecode: otherLock });
    observeCollectionValueChunks(otherCollection, [
      { commitment: '000006', lockingBytecode: otherLock },
    ], { value: Uint8Array.of(6), lockingBytecode: otherLock });

    expect(getCollectionValueRecord(first)).toMatchObject({
      chunks: [{ commitment: '000001' }, { commitment: '010002' }],
      value: firstValue,
      lockingBytecode: firstLock,
    });
    expect(getCollectionValueRecord(otherKey)).toMatchObject({
      chunks: [{ commitment: '000003' }],
      value: Uint8Array.of(9),
      lockingBytecode: otherLock,
    });
    expect(getCollectionValueRecord(otherCollection)?.value).toEqual(Uint8Array.of(6));
  });

  it('replaces a version atomically and attaches only its staged value', () => {
    const record = identity('items:mapping(bytes32 => Item[])', 1);
    const other = identity('items:mapping(bytes32 => Item[])', 2);
    const firstLock = lock(0x11);
    observeCollectionValueChunks(record, [
      { commitment: '000001', lockingBytecode: firstLock },
      { commitment: '010002', lockingBytecode: firstLock },
    ], { value: Uint8Array.of(1, 2, 3), lockingBytecode: firstLock });
    observeCollectionValueChunks(other, [
      { commitment: '000003', lockingBytecode: firstLock },
    ], { value: Uint8Array.of(9), lockingBytecode: firstLock });

    // A shorter authenticated version must not inherit the prior version's decoded value.
    const nextLock = lock(0x33);
    observeCollectionValueChunks(record, [
      { commitment: '000004', lockingBytecode: nextLock },
    ]);
    expect(getCollectionValueRecord(record)).toMatchObject({
      chunks: [{ commitment: '000004', lockingBytecode: nextLock }],
      value: undefined,
      lockingBytecode: nextLock,
    });
    expect(getCollectionValueRecord(other)?.value).toEqual(Uint8Array.of(9));

    const staged = Uint8Array.of(7, 8);
    stageCollectionValue(record, staged);
    observeCollectionValueChunks(record, [
      { commitment: '000005', lockingBytecode: nextLock },
    ]);
    expect(getCollectionValueRecord(record)?.value).toEqual(staged);
  });

  it('can clear one category without dropping another', () => {
    const record = identity('items:mapping(bytes32 => Item[])', 1);
    const sharedLock = lock(0x44);
    observeCollectionValueChunks(record, [
      { commitment: '000001', lockingBytecode: sharedLock },
    ]);
    const otherCategory = 'cd'.repeat(32);
    const other = identity('items:mapping(bytes32 => Item[])', 1, otherCategory);
    observeCollectionValueChunks(other, [
      { commitment: '000002', lockingBytecode: sharedLock },
    ]);

    clearCollectionValueRecords({ categoryId: category });

    expect(getCollectionValueRecord(record)).toBeUndefined();
    expect(getCollectionValueRecord(other)?.chunks).toHaveLength(1);
  });

  it('plans exact active values and one probe slot for unresolved computed writes', () => {
    const exact = Uint8Array.from({ length: 190 }, (_value, index) => index);
    const write = {
      identity: identity('records:mapping(bytes32 => Record[])', 3),
      accessIndex: 2,
      collectionName: 'records',
      valueType: 'Record[]',
      value: exact,
    };

    expect(plannedCollectionValueChunkCount([write])).toBe(2);
    expect(plannedCollectionValueChunkCount([{ ...write, value: undefined }])).toBe(1);
    expect(plannedCollectionValueChunkCount([
      write,
      { ...write, accessIndex: 3, value: undefined },
    ])).toBe(3);

    expect(collectionValueWritesForExecution([], [write])).toEqual([write]);
    expect(collectionValueWritesForExecution([write], [])).toEqual([write]);
  });
});
