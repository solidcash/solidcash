import { afterEach, describe, expect, it } from 'vitest';
import { binToHex, hash160, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { cashAddressToEthHex, defaultAbiCoder, setCashAddressLockResolver } from '../src/cash-abi-coder.js';

/**
 * The 20-byte identity ethers-side ABI coding gives a CashAddress is the one the contract holds for it.
 *
 * A P2SH20 address names its identity outright, as a CREATE2 child's address does: the child's own body holds that
 * hash as `address(this)`, whichever lock its frames execute under, so a resolver that maps the address to that lock
 * is not consulted for it. A P2SH32 address is still the HASH160 of the lock it resolves to.
 */

afterEach(() => setCashAddressLockResolver(undefined));

const cashAddress = (bytecode: Uint8Array): string => {
  const encoded = lockingBytecodeToCashAddress({ bytecode, prefix: 'bchtest', tokenSupport: true });
  if (typeof encoded === 'string') throw new Error(encoded);
  return encoded.address;
};

const IDENTITY = Uint8Array.from({ length: 20 }, (_, index) => index + 1);
const P2SH20 = Uint8Array.from([0xa9, 0x14, ...IDENTITY, 0x87]);
const P2SH32 = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x33), 0x87]);
const EXECUTION_LOCK = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x44), 0x87]);

describe('a CashAddress coded as an ABI address', () => {
  it('is the identity a P2SH20 address names, whatever lock a resolver gives it', () => {
    setCashAddressLockResolver(() => EXECUTION_LOCK);
    const address = cashAddress(P2SH20);
    expect(cashAddressToEthHex(address)).toBe(`0x${binToHex(IDENTITY)}`);
    expect(defaultAbiCoder.encode(['address'], [address])).toBe(`0x${'00'.repeat(12)}${binToHex(IDENTITY)}`);
  });

  it('is the HASH160 of the lock a P2SH32 address resolves to', () => {
    const address = cashAddress(P2SH32);
    expect(cashAddressToEthHex(address)).toBe(`0x${binToHex(hash160(P2SH32))}`);
    setCashAddressLockResolver(() => EXECUTION_LOCK);
    expect(cashAddressToEthHex(address)).toBe(`0x${binToHex(hash160(EXECUTION_LOCK))}`);
  });
});
