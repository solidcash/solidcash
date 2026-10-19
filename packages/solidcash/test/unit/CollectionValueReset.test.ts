import { beforeEach, describe, expect, it } from 'vitest';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import {
  clearCollectionValueRecords,
  commitInlineCollectionValue,
  getCollectionValueRecord,
  type CollectionValueIdentity,
} from '../../src/stateful/ValueChunkPersistence.js';
import {
  collectionEntryOneToOneIndices,
  isDisposableAlignmentPad,
} from '../../src/stateful/StatefulTransactionBuilder.js';

const identity = (categoryId = 'ab'.repeat(31) + '54'): CollectionValueIdentity => ({
  categoryId,
  collectionSignature: 'records:mapping(uint256 => bytes)',
  slot: new Uint8Array(32).fill(0x22),
});

describe('collection-value persistence reset', () => {
  beforeEach(() => clearCollectionValueRecords());

  it('invalidates chain-derived records when the mock chain is wiped', () => {
    commitInlineCollectionValue(identity(), new Uint8Array([1, 2, 3]));
    expect(getCollectionValueRecord(identity())).toBeDefined();

    new MockNetworkProvider().reset();

    expect(getCollectionValueRecord(identity())).toBeUndefined();
  });

  it('invalidates chain-derived records when a mock snapshot is restored', async () => {
    const provider = new MockNetworkProvider();
    const snapshot = await provider.takeSnapshot();
    commitInlineCollectionValue(identity('cd'.repeat(32)), new Uint8Array([4, 5, 6]));
    expect(getCollectionValueRecord(identity('cd'.repeat(32)))).toBeDefined();

    await snapshot.restore();

    expect(getCollectionValueRecord(identity('cd'.repeat(32)))).toBeUndefined();
  });

  it('treats token-free P2PKH and OP_TRUE occupants as disposable alignment pads', () => {
    const p2pkh = new Uint8Array(25);
    p2pkh[0] = 0x76;
    p2pkh[1] = 0xa9;
    p2pkh[2] = 0x14;
    p2pkh[23] = 0x88;
    p2pkh[24] = 0xac;
    expect(isDisposableAlignmentPad({ to: p2pkh })).toBe(true);
    expect(isDisposableAlignmentPad({ to: Uint8Array.of(0x51) })).toBe(true);
  });

  it('reserves only same-lock mutable collection inputs as one-to-one entries', () => {
    const lock = new Uint8Array(35);
    lock[0] = 0xaa;
    lock[1] = 0x20;
    lock[34] = 0x87;
    const other = lock.slice();
    other[2] = 0x11;
    const inputs = [
      { token: { nft: { capability: 'none' as const } }, unlocker: { generateLockingBytecode: () => lock } },
      { token: { nft: { capability: 'mutable' as const } }, unlocker: { generateLockingBytecode: () => lock } },
      { token: { nft: { capability: 'mutable' as const } }, unlocker: { generateLockingBytecode: () => other } },
    ];
    expect(collectionEntryOneToOneIndices(inputs, lock)).toEqual([1]);
  });
});
