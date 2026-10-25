import { binToHex, hash160, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { describe, expect, it } from 'vitest';
import {
  findDeploymentByAddressValue, findDeploymentByLockingBytecode, isCreate2ProjectedAddressValue,
  registerDeployment,
  registeredAddressValueLockingBytecode, registeredPhysicalLockingBytecode,
  registeredValueAddressLockingBytecode,
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

  it('does not normalize an unrelated address string from a matching suffix', () => {
    const provider = createTestProvider();
    const physical = hexToBin(`aa20${'31'.repeat(32)}87`);
    const logical = hexToBin(`aa20${'42'.repeat(32)}87`);
    const address = lockingBytecodeToCashAddress({ bytecode: logical, prefix: 'bchtest' });
    if (typeof address === 'string') throw new Error(address);
    registerDeployment(provider, {
      contractName: 'Target', address: address.address, lockingBytecode: binToHex(physical), contract: {},
    });

    expect(registeredValueAddressLockingBytecode(provider, address.address)).toEqual(physical);
    expect(registeredPhysicalLockingBytecode(provider, address.address)).toEqual(physical);
    const unrelated = `unrelated-${address.address}`;
    expect(registeredValueAddressLockingBytecode(provider, unrelated)).toBeUndefined();
    expect(registeredPhysicalLockingBytecode(provider, unrelated)).toBeUndefined();
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

  it('resolves a lock-derived child identity and a unique off-chain CREATE2 projection', () => {
    const provider = createTestProvider();
    const parentLock = hexToBin(`76a914${'11'.repeat(20)}88ac`);
    const parent = lockingBytecodeToCashAddress({ bytecode: parentLock, prefix: 'bchtest' });
    const childLock = hexToBin(`aa20${'22'.repeat(32)}87`);
    const child = lockingBytecodeToCashAddress({ bytecode: childLock, prefix: 'bchtest' });
    if (typeof parent === 'string' || typeof child === 'string') throw new Error('invalid fixture');
    const salt = 'ab'.repeat(32);
    registerDeployment(provider, {
      contractName: 'Child', address: child.address, lockingBytecode: binToHex(childLock),
      parentAddress: parent.address, parentLockingBytecode: binToHex(parentLock), salt, contract: {},
    });

    // The projection the Solidity `pairFor` helper computes: keccak(0xff ++ parent identity ++ salt ++ init).
    // A P2PKH lock's Solidity identity is its payload, not the hash of the whole lock.
    const preimage = Uint8Array.from([
      0xff, ...parentLock.subarray(3, 23), ...hexToBin(salt),
      ...hexToBin('e18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303'),
    ]);
    const projected = keccak_256(preimage).slice(12);
    expect(findDeploymentByAddressValue(provider, projected)?.contractName).toBe('Child');
    // One owning child is resolvable: the SDK substitutes that child's real lock for the witness.
    expect(isCreate2ProjectedAddressValue(provider, projected)).toBe(false);

    // The identity the child's own locking bytecode projects to is the one the covenant can authenticate.
    const physical = hash160(childLock);
    expect(findDeploymentByAddressValue(provider, physical)?.contractName).toBe('Child');
    expect(isCreate2ProjectedAddressValue(provider, physical)).toBe(false);

    // Without an owner, or with several, there is no callee the caller can authenticate.
    expect(isCreate2ProjectedAddressValue(provider, keccak_256(new Uint8Array(64).fill(7)).slice(12))).toBe(true);
    registerDeployment(provider, {
      contractName: 'Sibling', address: 'sibling', lockingBytecode: binToHex(childLock),
      parentAddress: parent.address, parentLockingBytecode: binToHex(parentLock), salt, contract: {},
    });
    expect(isCreate2ProjectedAddressValue(provider, projected)).toBe(true);
  });
});
