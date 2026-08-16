import { describe, expect, it } from 'vitest';
import { hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { getAddress } from '../src/ethers-shim.js';

describe('ethers getAddress BCH locking-bytecode compat', () => {
  it('turns a P2PKH locking script into a CashAddress', () => {
    const hex = '76a91471782e8159265ed94bd35b8e699c08f53a6f38c688ac';
    const address = getAddress(`0x${hex}`);
    expect(getAddress(hexToBin(hex))).toBe(address);
    const expected = lockingBytecodeToCashAddress({
      bytecode: hexToBin(hex), prefix: 'bchtest', tokenSupport: false,
    });
    const expectedAddress = typeof expected === 'string' ? expected : (expected as { address: string }).address;
    expect(address).toBe(expectedAddress);
    expect(address.startsWith('bchtest:')).toBe(true);
  });

  it('passes a 20-byte hex through ethers checksumming', () => {
    const raw = '0x71782e8159265ed94bd35b8e699c08f53a6f38c6';
    expect(getAddress(raw)).toMatch(/^0x71782e8159265e/i);
    expect(getAddress(raw)).toBe(getAddress(raw.toLowerCase()));
  });

  it('leaves an existing CashAddress unchanged', () => {
    const cash = 'bchtest:qpcn7sy4mgy9glvkjxj3r5y0s9rhy5lwtymfzfnde8';
    expect(getAddress(cash)).toBe(cash);
  });
});
