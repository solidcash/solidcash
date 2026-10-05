import { getAddress, hexlify } from 'ethers';
import { describe, expect, it } from 'vitest';
import { decodeAddress, decodeBool, decodeString, decodeUint16, decodeUint256 } from '../src/utils/decodeData.ts';
import { decodeJobCreatedEvent } from '../src/utils/decodeEvents.ts';

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

  it('uses the declared token width when a 20-byte identity resembles a native lock', () => {
    const token = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(18).fill(0x23)]);
    const amount = new Uint8Array(32);
    amount[14] = 0x87;
    amount[31] = 5;
    const payload = Uint8Array.from([
      0, // empty title
      ...new Uint8Array(32), // content hash
      0, // multiple applicants
      0, // no tags
      ...token,
      ...amount,
      0, 0, 0, 120, // maxTime
      7, ...new TextEncoder().encode('digital'),
      ...new Uint8Array(20), // zero arbitrator
      0, // whitelistWorkers
    ]);

    const event = decodeJobCreatedEvent(payload);
    expect(event.token).toBe(getAddress(hexlify(token)));
    expect(event.amount).toBe(BigInt(hexlify(amount)));
    expect(event.maxTime).toBe(120);
    expect(event.deliveryMethod).toBe('digital');
  });
});
