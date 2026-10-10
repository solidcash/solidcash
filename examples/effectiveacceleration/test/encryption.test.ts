import { hexlify } from 'ethers';
import { describe, expect, it } from 'vitest';
import { decryptBinaryData, encryptBinaryData } from '../src/utils/encryption.ts';

describe('Marketplace encrypted payloads', () => {
  it('retains the zero-nonce prefix for an unencrypted payload', () => {
    const data = new TextEncoder().encode('hello');
    const encrypted = encryptBinaryData(data, undefined);

    expect(encrypted.slice(0, 24)).toEqual(new Uint8Array(24));
    expect(decryptBinaryData(encrypted, undefined)).toEqual(data);
  });

  it('uses fresh 24-byte nonces and roundtrips encrypted payloads', () => {
    const data = new TextEncoder().encode('private message');
    const key = hexlify(new Uint8Array(32).fill(0x42));
    const first = encryptBinaryData(data, key);
    const second = encryptBinaryData(data, key);

    expect(first).toHaveLength(24 + data.length + 16);
    expect(first.slice(0, 24)).not.toEqual(new Uint8Array(24));
    expect(first.slice(0, 24)).not.toEqual(second.slice(0, 24));
    expect(decryptBinaryData(first, key)).toEqual(data);
    expect(decryptBinaryData(second, key)).toEqual(data);
  });
});
