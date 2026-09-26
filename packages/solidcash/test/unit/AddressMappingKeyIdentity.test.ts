import { hexToBin } from '@bitauth/libauth';
import { hash160 } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { keyToSlot, keyToSlotMulti } from '../../src/stateful/SortedList.js';

const identity = new Uint8Array(20).fill(0x61);
const native = Uint8Array.of(0x76, 0xa9, 0x14, ...identity, 0x88, 0xac);
const word = Uint8Array.of(...new Uint8Array(12), ...identity);
const addressCollection = { keyType: 'address', addressKeyEncoding: 'identity20' } as const;

describe('compiler-described address mapping key identity', () => {
  it.each(['address', 'address payable'])('unifies native, raw and ABI %s keys', (keyType) => {
    const collection = { ...addressCollection, keyType };
    for (const key of [native, identity, word, Uint8Array.of(0xa9, 0x14, ...identity, 0x87)]) {
      expect(keyToSlotMulti([key], collection)).toEqual(keyToSlot(identity));
    }
    expect(native.length).toBe(25);
    expect(word.length).toBe(32);
  });

  it('uses the full P2SH32 locking script identity, matching graph address projection', () => {
    const lock = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x42), 0x87);
    const projected = Uint8Array.of(...new Uint8Array(12), ...hash160(lock));
    expect(keyToSlotMulti([lock], addressCollection)).toEqual(keyToSlot(hash160(lock)));
    expect(keyToSlotMulti([projected], addressCollection)).toEqual(keyToSlotMulti([lock], addressCollection));
  });

  it('unifies empty, raw and ABI zero addresses without aliasing a different identity', () => {
    for (const key of [new Uint8Array(), new Uint8Array(20), new Uint8Array(32)]) {
      expect(keyToSlotMulti([key], addressCollection)).toEqual(keyToSlot(new Uint8Array(20)));
      expect(keyToSlotMulti([key], addressCollection)).not.toEqual(keyToSlotMulti([native], addressCollection));
    }
  });

  it('normalizes only address positions in composite keys and preserves ordering', () => {
    const collection = { ...addressCollection, keyTypes: ['address', 'bytes32', 'address payable'] };
    expect(keyToSlotMulti([native, word, word], collection)).toEqual(keyToSlotMulti([identity, word, identity]));
    expect(keyToSlotMulti([native, word, word], collection)).not.toEqual(keyToSlotMulti([identity, identity, identity]));
    const other = new Uint8Array(20).fill(0x62);
    const pair = { ...addressCollection, keyTypes: ['address', 'address'] };
    expect(keyToSlotMulti([native, other], pair)).not.toEqual(keyToSlotMulti([other, native], pair));
  });

  it('retains exact-byte hashing for legacy and non-address collections', () => {
    for (const collection of [undefined, { keyType: 'address' }, { ...addressCollection, keyType: 'bytes32' }]) {
      expect(keyToSlotMulti([native], collection)).toEqual(keyToSlot(native));
      expect(keyToSlotMulti([word], collection)).toEqual(keyToSlot(word));
      expect(keyToSlotMulti([native], collection)).not.toEqual(keyToSlotMulti([word], collection));
    }
  });

  it('rejects non-zero high bytes in a typed address ABI word, without rejecting bytes32', () => {
    const malformed = hexToBin('01'.repeat(32));
    expect(() => keyToSlotMulti([malformed], addressCollection)).toThrow('non-zero high bytes');
    expect(keyToSlotMulti([malformed], { ...addressCollection, keyType: 'bytes32' })).toEqual(keyToSlot(malformed));
  });
});
