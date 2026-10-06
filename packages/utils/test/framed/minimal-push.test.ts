import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth';
import { encodeMinimalDataPush } from '../../src/per-call/primitives.js';

// Each payload byte depends on its position, so a push that copies the wrong span cannot agree by accident.
function payload(length: number, seed: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) out[index] = (index * 131 + seed * 17 + 7) & 0xff;
  return out;
}

describe('encodeMinimalDataPush', () => {
  it('matches libauth for every single-byte value', () => {
    for (let value = 0; value <= 0xff; value += 1) {
      const data = Uint8Array.of(value);
      expect(encodeMinimalDataPush(data), `byte ${value}`).toEqual(encodeDataPush(data));
    }
  });

  it('matches libauth on both sides of every length boundary', () => {
    for (const length of [0, 1, 2, 74, 75, 76, 77, 254, 255, 256, 257, 65534, 65535, 65536, 65537]) {
      for (const seed of [1, 2]) {
        const data = payload(length, seed);
        expect(encodeMinimalDataPush(data), `length ${length}`).toEqual(encodeDataPush(data));
      }
    }
  });

  it('matches libauth on a zero-filled payload of every length up to 300', () => {
    for (let length = 0; length <= 300; length += 1) {
      const data = new Uint8Array(length);
      expect(encodeMinimalDataPush(data), `length ${length}`).toEqual(encodeDataPush(data));
    }
  });

  it('pushes a view into a larger buffer without its neighbours', () => {
    const backing = payload(400, 3);
    const view = backing.subarray(100, 180);
    expect(encodeMinimalDataPush(view)).toEqual(encodeDataPush(view));
  });
});
