import { binToHex, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import type { AbiFunction, Artifact, ExternalCallAbi } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import {
  resolveTransitiveExternalContract, type TransitiveExternalContract,
} from '../../src/stateful/sc-discover-create-builder-transitive-external-calls.js';
import { registerDeployment } from '../../src/stateful/deployment-registry.js';
import { createTestProvider } from '../test-util.js';

const edge = {
  interfaceName: 'ITarget', functionName: 'read',
  addressSource: { kind: 'expression', expression: { kind: 'state', name: 'target' } },
} as ExternalCallAbi;
const abi = { name: 'run', inputs: [] } as AbiFunction;

describe('transitive external target resolution', () => {
  it('uses the compiler-derived address when the callee has no interface binding', async () => {
    const provider = createTestProvider();
    const lock = hexToBin(`76a914${'31'.repeat(20)}88ac`);
    const address = lockingBytecodeToCashAddress({ bytecode: lock, prefix: 'bchtest' });
    if (typeof address === 'string') throw new Error(address);
    const callee = { categoryId: '01'.repeat(32) } as TransitiveExternalContract;
    registerDeployment(provider, {
      contractName: 'Target', address: address.address, lockingBytecode: binToHex(lock), contract: callee,
    });
    const resolveArgs = vi.fn((_sources, _args, _artifact, state: Record<string, unknown>) => [state.target]);
    const caller = {
      _externalRegistry: new Map(),
      inner: { provider, artifact: { abi: [] } as unknown as Artifact, lockingBytecode: '51' },
      getState: async () => ({ target: address.address }),
      _resolveExternalArgs: resolveArgs,
    } as unknown as TransitiveExternalContract;
    expect(await resolveTransitiveExternalContract(caller, edge, [], abi)).toBe(callee);
    expect(resolveArgs).toHaveBeenCalledWith(
      [edge.addressSource], [], caller.inner.artifact, { target: address.address }, abi.inputs,
    );
  });

  it('withholds an ambiguous typed address rather than selecting by interface name', async () => {
    const provider = createTestProvider();
    const payload = new Uint8Array(20).fill(0x42);
    for (const lock of [
      Uint8Array.of(0x76, 0xa9, 0x14, ...payload, 0x88, 0xac),
      Uint8Array.of(0xa9, 0x14, ...payload, 0x87),
    ]) {
      const address = lockingBytecodeToCashAddress({ bytecode: lock, prefix: 'bchtest' });
      if (typeof address === 'string') throw new Error(address);
      registerDeployment(provider, {
        contractName: 'Target', address: address.address, lockingBytecode: binToHex(lock), contract: {},
      });
    }
    const caller = {
      _externalRegistry: new Map(),
      inner: { provider, artifact: { abi: [] } as unknown as Artifact, lockingBytecode: '51' },
      getState: async () => ({ target: payload }),
      _resolveExternalArgs: () => [payload],
    } as unknown as TransitiveExternalContract;
    expect(await resolveTransitiveExternalContract(caller, edge, [], abi)).toBeUndefined();
  });
});
