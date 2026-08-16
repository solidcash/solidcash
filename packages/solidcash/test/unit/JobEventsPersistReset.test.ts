import { describe, expect, it } from 'vitest';
import { sha256 } from '@solidcash/utils';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { getValueChunkLockingBytecode } from '../../src/stateful/covenant-helpers.js';
import { keyToSlot } from '../../src/stateful/SortedList.js';
import {
  isDisposableAlignmentPad,
  jobEventsEntryOneToOneIndices,
  persistedJobEventsLock,
  persistedJobEventsUnlockRecipe,
  rememberJobEventsLock,
  rememberJobEventsUnlockRecipe,
  rememberJobEventsValue,
  stageJobEventsValue,
  StatefulTransactionBuilder,
} from '../../src/stateful/StatefulTransactionBuilder.js';

describe('jobEvents persist vs mock reset', () => {
  it('drops the previous test category lock when the mock chain is wiped', () => {
    const lock = new Uint8Array(35);
    lock[0] = 0xaa;
    lock[1] = 0x20;
    lock[34] = 0x87;
    rememberJobEventsLock('ee643a16', lock);
    expect(persistedJobEventsLock('ee643a16')).toEqual(lock);
    new MockNetworkProvider().reset();
    expect(persistedJobEventsLock('ee643a16')).toBeUndefined();
    StatefulTransactionBuilder.clearPersistedJobEvents();
  });

  it('treats token-free p2pkh occupants as disposable alignment pads', () => {
    const p2pkh = new Uint8Array(25);
    p2pkh[0] = 0x76;
    p2pkh[1] = 0xa9;
    p2pkh[2] = 0x14;
    p2pkh[23] = 0x88;
    p2pkh[24] = 0xac;
    expect(isDisposableAlignmentPad({ to: p2pkh })).toBe(true);
    expect(isDisposableAlignmentPad({ to: Uint8Array.of(0x51) })).toBe(true);
  });

  it('names same-index mutable jobEvents entries so view tails cannot occupy them', () => {
    const lock = new Uint8Array(35);
    lock[0] = 0xaa;
    lock[1] = 0x20;
    lock[34] = 0x87;
    const other = new Uint8Array(lock);
    other[2] = 0x11;
    const inputs = [
      { token: { nft: { capability: 'none' as const } }, unlocker: { generateLockingBytecode: () => lock } },
      { token: { nft: { capability: 'mutable' as const } }, unlocker: { generateLockingBytecode: () => lock } },
      { token: { nft: { capability: 'mutable' as const } }, unlocker: { generateLockingBytecode: () => other } },
    ];
    expect(jobEventsEntryOneToOneIndices(inputs, lock)).toEqual([1]);
  });

  it('recovers a real value-chunk unlock recipe from persist lock + committed v', () => {
    const categoryId = 'ee643a1671fbbe53000000000000000000000000000000000000000000000000';
    const value = new Uint8Array(80);
    value[0] = 0x4c;
    value[1] = 0xb4;
    const slot = keyToSlot(new Uint8Array());
    const lock = getValueChunkLockingBytecode(categoryId, 'jobEvents', slot, sha256(value));
    stageJobEventsValue(categoryId, value);
    expect(persistedJobEventsUnlockRecipe(categoryId)).toBeUndefined();
    rememberJobEventsValue(categoryId, value);
    rememberJobEventsLock(categoryId, lock);
    expect(rememberJobEventsUnlockRecipe(categoryId)).toBe(true);
    const recipe = persistedJobEventsUnlockRecipe(categoryId);
    expect(recipe?.collection).toBe('jobEvents');
    expect(recipe?.categoryId).toBe(categoryId);
    expect(recipe?.slot).toEqual(slot);
    expect(recipe?.root).toEqual(sha256(value));
    StatefulTransactionBuilder.clearPersistedJobEvents();
    expect(persistedJobEventsUnlockRecipe(categoryId)).toBeUndefined();
  });
});
