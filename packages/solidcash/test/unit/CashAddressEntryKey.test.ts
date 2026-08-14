import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { addressToLockScript, tryCashAddressToLockScript } from '../../src/utils.js';

describe('tryCashAddressToLockScript', () => {
  it('converts a cashaddr so it matches addressToLockScript', () => {
    const addr = 'bchtest:qpcn7sy4mgy9glvkjxj3r5y0s9rhy5lwtymfzfnde8';
    const encoded = tryCashAddressToLockScript(addr);
    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(binToHex(encoded!)).toBe(binToHex(addressToLockScript(addr)));
  });

  it('passes through locking bytecode and rejects non-address strings', () => {
    const script = addressToLockScript('bchtest:qpcn7sy4mgy9glvkjxj3r5y0s9rhy5lwtymfzfnde8');
    expect(tryCashAddressToLockScript(script)).toBe(script);
    expect(tryCashAddressToLockScript('https://example.com/avatar')).toBeUndefined();
    expect(tryCashAddressToLockScript('Create a marketplace in solidity')).toBeUndefined();
    expect(tryCashAddressToLockScript(1n)).toBeUndefined();
  });
});
