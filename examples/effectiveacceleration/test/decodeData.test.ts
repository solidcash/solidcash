import { getAddress, hexlify } from 'ethers';
import { describe, expect, it } from 'vitest';
import { decodeAddress, decodeBool, decodeString, decodeUint16, decodeUint256 } from '../src/utils/decodeData.ts';

describe('Marketplace packed-address decoding', () => {
  it('preserves a full native locking bytecode before a packed bool', () => {
    const lock = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x42), 0x87]);
    const ptr = { bytes: Uint8Array.from([...lock, 1]), index: 0 };

    expect(decodeAddress(ptr)).toBe(hexlify(lock));
    expect(ptr.index).toBe(35);
    expect(decodeBool(ptr)).toBe(true);
  });

  it('advances exactly 20 bytes for a Solidity identity before trailing fields', () => {
    const identity = new Uint8Array(20).fill(0x23);
    const amount = new Uint8Array(32);
    amount[31] = 5;
    const deliveryMethod = new TextEncoder().encode('digital');
    const ptr = {
      bytes: Uint8Array.from([...identity, ...amount, 0, 0, 0, 120, 7, ...deliveryMethod]),
      index: 0,
    };

    expect(decodeAddress(ptr)).toBe(getAddress(hexlify(identity)));
    expect(ptr.index).toBe(20);
    expect(decodeUint256(ptr)).toBe(5n);
    expect(decodeUint16(ptr)).toBe(120);
    expect(decodeString(ptr)).toBe('digital');
  });
});
