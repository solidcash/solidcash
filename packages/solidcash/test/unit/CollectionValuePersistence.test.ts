import { describe, expect, it, beforeEach } from 'vitest';
import { sha256 } from '@solidcash/utils';
import {
  clearCollectionValueRecords,
  coherentAuthenticatedValueChunkRun,
  commitCollectionValue,
  commitInlineCollectionValue,
  getCollectionValueRecord,
  getCommittedCollectionValueSpends,
  observeCollectionValueChunks,
  stageCollectionValue,
  type CollectionValueIdentity,
  type CollectionValueSpend,
} from '../../src/stateful/ValueChunkPersistence.js';

const categoryId = '11'.repeat(32);
const lock = Uint8Array.from({ length: 35 }, (_unused, index) => index);
const identity = (signature = 'records:mapping(uint256 => bytes)', slotByte = 0x22): CollectionValueIdentity => ({
  categoryId,
  collectionSignature: signature,
  slot: new Uint8Array(32).fill(slotByte),
});
const chunks = [
  { commitment: '0000aa', lockingBytecode: lock, categoryId },
  { commitment: '0100bb', lockingBytecode: lock, categoryId },
];
const spends: CollectionValueSpend[] = chunks.map((chunk, vout) => ({
  txid: '33'.repeat(32),
  vout,
  satoshis: 1200n,
  token: {
    category: categoryId,
    amount: 0n,
    nft: { capability: 'mutable', commitment: chunk.commitment },
  },
  lockingBytecode: lock,
}));

describe('collection value persistence', () => {
  beforeEach(() => clearCollectionValueRecords());

  it('selects one coherent zero-based run without mixing covenant locks', () => {
    const otherLock = lock.slice();
    otherLock[4] ^= 0xff;
    expect(coherentAuthenticatedValueChunkRun([
      chunks[1],
      { commitment: '0000cc', lockingBytecode: otherLock, categoryId },
      chunks[0],
    ])).toEqual(chunks);
  });

  it('keys committed spends by category, collection signature, slot, and value root', () => {
    const value = new Uint8Array(180).fill(0x44);
    stageCollectionValue(identity(), value);
    observeCollectionValueChunks(identity(), chunks, { spends });
    commitCollectionValue(identity(), spends);

    expect(getCommittedCollectionValueSpends(identity(), sha256(value))).toEqual(spends);
    expect(getCommittedCollectionValueSpends(identity('other:mapping(uint256 => bytes)'), sha256(value)))
      .toBeUndefined();
    expect(getCommittedCollectionValueSpends(identity(undefined, 0x23), sha256(value))).toBeUndefined();
    expect(getCommittedCollectionValueSpends(identity(), sha256(new Uint8Array([1])))).toBeUndefined();
  });

  it('commits an inline replacement as an authoritative empty continuation run', () => {
    const longValue = new Uint8Array(180).fill(0x55);
    stageCollectionValue(identity(), longValue);
    observeCollectionValueChunks(identity(), chunks, { spends });
    commitCollectionValue(identity(), spends);

    const inlineValue = new Uint8Array([1, 2, 3]);
    commitInlineCollectionValue(identity(), inlineValue);
    expect(getCollectionValueRecord(identity())).toMatchObject({
      chunks: [],
      value: inlineValue,
      phase: 'committed',
    });
    expect(getCommittedCollectionValueSpends(identity(), sha256(longValue))).toBeUndefined();
  });

  it('clears only records matching the requested storage identity scope', () => {
    commitInlineCollectionValue(identity(), new Uint8Array([1]));
    commitInlineCollectionValue(identity('other:mapping(uint256 => bytes)'), new Uint8Array([2]));

    clearCollectionValueRecords({ collectionSignature: identity().collectionSignature });
    expect(getCollectionValueRecord(identity())).toBeUndefined();
    expect(getCollectionValueRecord(identity('other:mapping(uint256 => bytes)'))).toBeDefined();
  });
});
