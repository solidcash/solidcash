import { binToHex } from '@bitauth/libauth';
import type { AbiFunction, Artifact } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import { registerDeployment } from '../../src/stateful/deployment-registry.js';
import { deriveReturnValue, type DeriveReturnValueHost } from '../../src/stateful/sc-derive-return-value.js';
import type { CallInfo, StatefulContract } from '../../src/stateful/StatefulContract.js';
import { createTestProvider } from '../test-util.js';

function fixture(
  bindWrongInterface: boolean, unknownStoredTarget = false, connectRightWithoutDeployment = false,
  proxyOwnsState = false, incompatibleProxySlot = false,
): { read: () => Promise<unknown>; rightRead: () => unknown; wrongRead: () => unknown } {
  const provider = createTestProvider();
  const target = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x42), 0x87);
  const rightRead = vi.fn(() => ({ staticCall: async () => 222n }));
  const wrongRead = vi.fn(() => ({ staticCall: async () => 111n }));
  const right = { inner: { lockingBytecode: binToHex(target) }, call: { read: rightRead } };
  const wrong = { inner: { lockingBytecode: '52' }, call: { read: wrongRead } };
  const passthrough = {
    interfaceName: 'IChild', functionName: 'read', requiredDataNftIndices: [], argSources: [],
    hasReturnValues: true, returnTypes: ['uint256'], addressStateVar: 'target',
  };
  const stateVariable = { name: 'target', type: 'address', nftIndex: 0, fieldIndex: 0 };
  const logical = {
    name: 'facadeRead', inputs: [], outputs: [{ name: '', type: 'uint256' }],
    externalCalls: [passthrough],
    blockLayout: { blockSize: 1, slots: [{ kind: 'returnEvent', offset: 0 }] },
  } as AbiFunction;
  const direct = proxyOwnsState
    ? { name: '__forward', inputs: [], lowLevelCalls: [{ callMode: 'delegatecall' }] } as AbiFunction
    : { name: 'facadeRead', inputs: [] } as AbiFunction;
  const facade = {
    inner: { artifact: { contractName: 'Facade', abi: [logical],
      stateLayout: { variables: [stateVariable] } }, lockingBytecode: '51' },
    _resolveCallAbi: () => logical,
    _resolveExternalArgs: () => [],
    _externalRegistry: new Map(bindWrongInterface ? [['IChild', wrong]]
      : connectRightWithoutDeployment ? [['IChild', right]] : []),
    getState: async () => ({ target: unknownStoredTarget || proxyOwnsState ? Uint8Array.of(0x53) : target }),
  } as unknown as StatefulContract;
  registerDeployment(provider, { contractName: 'Facade', address: 'facade', lockingBytecode: '51', contract: facade });
  if (!connectRightWithoutDeployment) registerDeployment(provider, {
    contractName: 'IChild', address: 'right-child', lockingBytecode: binToHex(target), contract: right,
  });
  const rootArtifact = {
    contractName: 'Root', abi: [direct],
    ...(proxyOwnsState && { stateLayout: { variables: [{ ...stateVariable,
      fieldIndex: incompatibleProxySlot ? 1 : stateVariable.fieldIndex }] } }),
  } as Artifact;
  const host = {
    inner: { artifact: rootArtifact, provider, lockingBytecode: Uint8Array.of(0x51) },
    provider, target: 'facade', externalRegistry: new Map(),
    addressMappingKeyCandidates: () => [], getSoftMapping: () => undefined,
    resolveCallAbi: () => direct, getEntries: async () => [],
    createBuilder: async () => { throw new Error('unrelated return probe was started'); },
    deriveReturnBlob: () => undefined, getState: async () => (proxyOwnsState ? { target } : {}),
    getCallerMasterUtxo: async () => undefined,
  } as unknown as DeriveReturnValueHost;
  const calls = [{ type: 'stateful', contract: facade, functionName: 'facadeRead', args: [] }] as CallInfo[];
  return { read: () => deriveReturnValue(host, direct.name, [], calls), rightRead, wrongRead };
}

describe('facade passthrough callee identity', () => {
  it('reads the stored-address callee without an interface binding', async () => {
    const test = fixture(false);
    expect(await test.read()).toBe(222n);
    expect(test.rightRead).toHaveBeenCalledOnce();

    const connectedOnly = fixture(false, false, true);
    expect(await connectedOnly.read()).toBe(222n);
    expect(connectedOnly.rightRead).toHaveBeenCalledOnce();
  });

  it('does not prefer a stale interface binding over the stored callee address', async () => {
    const test = fixture(true);
    expect(await test.read()).toBe(222n);
    expect(test.rightRead).toHaveBeenCalledOnce();
    expect(test.wrongRead).not.toHaveBeenCalled();

    const unknown = fixture(true, true);
    await expect(unknown.read()).rejects.toThrow('unrelated return probe was started');
    expect(unknown.wrongRead).not.toHaveBeenCalled();
  });

  it('resolves a delegated passthrough target from the proxy-owned state', async () => {
    const test = fixture(false, false, false, true);
    expect(await test.read()).toBe(222n);
    expect(test.rightRead).toHaveBeenCalledOnce();

    const incompatible = fixture(false, false, false, true, true);
    await expect(incompatible.read()).rejects.toThrow('unrelated return probe was started');
    expect(incompatible.rightRead).not.toHaveBeenCalled();
  });
});
