import { describe, expect, it } from 'vitest';
import { addressToGraphEmissionBytes, hash160 } from '../src/hash.js';

describe('addressToGraphEmissionBytes', () => {
  it('keeps address(0) empty and passes through ABI words', () => {
    expect(addressToGraphEmissionBytes(new Uint8Array(0))).toEqual(new Uint8Array(0));
    const word = new Uint8Array(32);
    word[31] = 0xab;
    expect(addressToGraphEmissionBytes(word)).toEqual(word);
  });

  it('projects P2SH32 locking bytecode to a left-padded ABI word', () => {
    const hash = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) hash[i] = i + 1;
    const lock = new Uint8Array(35);
    lock[0] = 0xaa;
    lock[1] = 0x20;
    lock.set(hash, 2);
    lock[34] = 0x87;
    const word = addressToGraphEmissionBytes(lock);
    expect(word.length).toBe(32);
    expect(word.slice(0, 12)).toEqual(new Uint8Array(12));
    expect(word.slice(12)).toEqual(hash160(lock));
  });
});
