import { describe, expect, it } from 'vitest';
import type { AbiFunction, EntryAccessAbi } from '@solidcash/utils';
import { binToHex } from '@bitauth/libauth';
import {
  cachedEntryOutputOwnsLock, physicalEntryAccessForSlot,
} from '../../src/stateful/StatefulTransactionBuilder.js';

const access = (collection: string): EntryAccessAbi => ({
  collection,
  keyParams: ['key'],
  operations: ['read'],
});

describe('physical entry ownership', () => {
  it('reads a handler entry access at its slot ordinal', () => {
    const logicalHandler = {
      entryAccesses: [access('labels')],
    } as Pick<AbiFunction, 'entryAccesses'>;

    expect(physicalEntryAccessForSlot([logicalHandler], 0)?.collection).toBe('labels');
  });

  it('does not replay a learned entry transition onto a new collection at the same coordinate', () => {
    const firstCollectionLock = new Uint8Array([0xaa, 0x20, ...new Uint8Array(32), 0x87]);
    const secondCollectionLock = firstCollectionLock.slice();
    secondCollectionLock[2] = 1;

    expect(cachedEntryOutputOwnsLock(
      binToHex(firstCollectionLock), firstCollectionLock,
    )).toBe(true);
    expect(cachedEntryOutputOwnsLock(
      binToHex(firstCollectionLock), secondCollectionLock,
    )).toBe(false);
  });
});
