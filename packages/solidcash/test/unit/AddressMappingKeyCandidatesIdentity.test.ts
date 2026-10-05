import { binToHex, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { addressMappingKeyCandidates } from '../../src/stateful/sc-address-mapping-key-candidates.js';
import { registerDeployment } from '../../src/stateful/deployment-registry.js';
import { createTestProvider } from '../test-util.js';

function fixture() {
  const provider = createTestProvider();
  const logicalLock = hexToBin(`aa20${'42'.repeat(32)}87`);
  const executionLock = hexToBin(`aa20${'31'.repeat(32)}87`);
  const address = lockingBytecodeToCashAddress({ bytecode: logicalLock, prefix: 'bchtest' });
  if (typeof address === 'string') throw new Error(address);
  registerDeployment(provider, {
    contractName: 'Target', address: address.address,
    lockingBytecode: binToHex(executionLock), contract: {},
  });
  return { provider, address: address.address, logicalLock, executionLock };
}

describe('address mapping key candidates', () => {
  it('includes execution identity for an exact registered address', () => {
    const { provider, address, logicalLock, executionLock } = fixture();
    const candidates = addressMappingKeyCandidates({ provider }, address);
    expect(candidates).toContain(address);
    expect(candidates).toContainEqual(logicalLock);
    expect(candidates).toContainEqual(executionLock);
  });

  it('does not alias an unrelated address with a matching suffix to a registered contract', () => {
    const { provider, address, executionLock } = fixture();
    const unrelated = `unrelated-${address}`;
    const candidates = addressMappingKeyCandidates({ provider }, unrelated);
    expect(candidates).toEqual([unrelated]);
    expect(candidates).not.toContainEqual(executionLock);
  });
});
