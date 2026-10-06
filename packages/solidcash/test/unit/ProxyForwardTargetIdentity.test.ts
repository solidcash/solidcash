import { binToHex, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import type { AbiFunction, Artifact } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import { registerDeployment } from '../../src/stateful/deployment-registry.js';
import { ProxyContract } from '../../src/stateful/upgrades.js';
import { createTestProvider } from '../test-util.js';

function fixture(): {
  handle: ProxyContract; address: string; target: object; registerExternal: ReturnType<typeof vi.fn>;
  delegate: ReturnType<typeof vi.fn>; lock: Uint8Array;
} {
  const provider = createTestProvider();
  const lock = hexToBin(`aa20${'42'.repeat(32)}87`);
  const address = lockingBytecodeToCashAddress({ bytecode: lock, prefix: 'bchtest' });
  if (typeof address === 'string') throw new Error(address);
  const target = {};
  registerDeployment(provider, {
    contractName: 'Target', address: address.address, lockingBytecode: binToHex(lock), contract: target,
  });
  const registerExternal = vi.fn();
  const delegate = vi.fn(() => ({}));
  const proxy = {
    inner: { provider }, call: { forward: () => ({ withDelegatecall: delegate }) },
  };
  const implAbi = {
    name: 'invoke', selector: '00000001', inputs: [{ name: 'destination', type: 'address' }],
    externalCalls: [{ interfaceName: 'ITarget', functionName: 'run', requiredDataNftIndices: [],
      addressSource: { kind: 'forward', paramIndex: 0 } }],
  } as AbiFunction;
  const implementation = {
    inner: { artifact: { contractName: 'Implementation', abi: [implAbi] } as Artifact },
    _registerResolvedExternal: registerExternal,
  };
  const handle = new ProxyContract(proxy as never, implementation as never,
    { name: 'forward', mode: 'baked' }, () => [], provider);
  return { handle, address: address.address, target, registerExternal, delegate, lock };
}

describe('proxy forward target identity', () => {
  it('registers an exact published callee address', () => {
    const test = fixture();
    test.handle.forward('invoke', [test.address]);
    expect(test.registerExternal).toHaveBeenCalledOnce();
    expect(test.registerExternal).toHaveBeenCalledWith('ITarget', test.target);
    expect(test.delegate.mock.calls[0]?.[2]).toEqual([test.lock]);
  });

  it('does not register a callee from an unrelated matching address suffix', () => {
    const test = fixture();
    const unrelated = `unrelated-${test.address}`;
    test.handle.forward('invoke', [unrelated]);
    expect(test.registerExternal).not.toHaveBeenCalled();
    expect(test.delegate.mock.calls[0]?.[2]).toEqual([unrelated]);
  });
});
