import { binToHex, hash160, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import {
  findDeploymentByAddressValue, findDeploymentByLockingBytecode, registerDeployment,
  registeredAddressValueLockingBytecode,
} from '../../src/stateful/deployment-registry.js';
import { createTestProvider } from '../test-util.js';

const word = (payload: Uint8Array): Uint8Array => Uint8Array.of(...new Uint8Array(12), ...payload);

describe('typed deployment address resolution', () => {
  it('resolves native, raw and ABI-word forms without treating bytes32 as locking bytecode', () => {
    const provider = createTestProvider();
    const physical = hexToBin(`aa20${'31'.repeat(32)}87`);
    const logical = hexToBin(`aa20${'42'.repeat(32)}87`);
    const address = lockingBytecodeToCashAddress({ bytecode: logical, prefix: 'bchtest' });
    if (typeof address === 'string') throw new Error(address);
    const deployment = { contractName: 'Target', address: address.address, lockingBytecode: binToHex(physical), contract: {} };
    registerDeployment(provider, deployment);
    for (const native of [physical, logical]) {
      const payload = hash160(native);
      for (const value of [native, payload, word(payload), `0x${binToHex(word(payload))}`]) {
        expect(findDeploymentByAddressValue(provider, value)).toBe(deployment);
        expect(registeredAddressValueLockingBytecode(provider, value)).toEqual(native);
      }
      expect(findDeploymentByLockingBytecode(provider, binToHex(word(payload)))).toBeUndefined();
    }
  });

  it('leaves malformed words, unknown identities and ambiguous projections unresolved', () => {
    const provider = createTestProvider();
    const lock = hexToBin(`aa20${'31'.repeat(32)}87`);
    const payload = hash160(lock);
    registerDeployment(provider, { contractName: 'First', address: 'first', lockingBytecode: binToHex(lock), contract: {} });
    const malformed = word(payload);
    malformed[0] = 1;
    for (const value of [malformed, `0x${binToHex(malformed)}`, word(new Uint8Array(20).fill(0x77))]) {
      expect(findDeploymentByAddressValue(provider, value)).toBeUndefined();
      expect(registeredAddressValueLockingBytecode(provider, value)).toBeUndefined();
    }
    registerDeployment(provider, {
      contractName: 'Second', address: 'second', lockingBytecode: `a914${binToHex(payload)}87`, contract: {},
    });
    for (const value of [payload, word(payload), `0x${binToHex(word(payload))}`]) {
      expect(findDeploymentByAddressValue(provider, value)).toBeUndefined();
      expect(registeredAddressValueLockingBytecode(provider, value)).toBeUndefined();
    }
    expect(registeredAddressValueLockingBytecode(provider, lock)).toEqual(lock);
  });
});
