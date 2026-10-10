import { getAddress, hexlify } from 'ethers';
import { describe, expect, it } from 'vitest';
import { decodeAddress, decodeString, decodeUint256, decodeUint32 } from '../src/utils/decodeData.ts';
import { decodeJobCreatedEvent } from '../src/utils/decodeEvents.ts';

// The suite compiles with `addressForm: 'hash'` (see `solidcash.config.ts`), so an address field is the packed
// 20-byte identity and the decoders read exactly those 20 bytes: no form sniffing is involved.
describe('Marketplace packed-address decoding', () => {
  it('advances exactly 20 bytes for a packed identity before trailing fields', () => {
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
    expect(decodeUint32(ptr)).toBe(120);
    expect(decodeString(ptr)).toBe('digital');
  });

  it('reads a created event whose address fields are packed identities', () => {
    const token = new Uint8Array(20).fill(0x23);
    const amount = new Uint8Array(32);
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
    expect(event.amount).toBe(5n);
    expect(event.maxTime).toBe(120);
    expect(event.deliveryMethod).toBe('digital');
  });
});
