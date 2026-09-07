import { describe, expect, it, vi } from 'vitest';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { StatefulFunctionCall } from '../../src/stateful/StatefulContract.js';

function failingCall(parts: {
  provider: MockNetworkProvider;
  contractName: string;
  functionName: string;
  error: Error;
}): StatefulFunctionCall {
  const builder = {
    send: vi.fn().mockRejectedValue(parts.error),
  };
  const call = Object.create(StatefulFunctionCall.prototype) as StatefulFunctionCall;
  Object.assign(call as unknown as Record<string, unknown>, {
    consumesLogicalNonce: false,
    functionName: parts.functionName,
    functionArgs: [new Uint8Array(), new Uint8Array(), new Uint8Array(), 1n, 0n],
    parentContract: {
      address: 'mock-address',
      provider: parts.provider,
      inner: { artifact: { abi: [], contractName: parts.contractName } },
    },
    _trySplitMergeBuild: async () => undefined,
    _applyOverrides: async () => builder,
    _requiresRecursivePreflight: () => false,
    _softApplyKashiStateSideEffects: async () => undefined,
  });
  return call;
}

describe('stateful compatibility receipts', () => {
  it('never converts a real-provider rejection into a successful receipt', () => {
    const call = Object.create(StatefulFunctionCall.prototype) as StatefulFunctionCall;
    Object.assign(call as unknown as Record<string, unknown>, {
      functionName: 'convert',
      parentContract: {
        provider: {},
        inner: { artifact: { contractName: 'SushiMaker' } },
      },
    });

    const result = (call as unknown as {
      _softApplyNoopReceipt: (error: unknown) => unknown;
    })._softApplyNoopReceipt(new Error('Program failed an OP_VERIFY operation'));
    expect(result).toBeUndefined();
  });

  it.each([
    ['BentoBox', 'deposit', 'Program failed an OP_VERIFY operation'],
    ['KashiPair', 'updateExchangeRate', 'Program failed an OP_SPLIT operation'],
    ['RenamedLedger', 'commit', 'Program failed an OP_VERIFY operation'],
  ])('default MockNetworkProvider preserves the exact %s.%s rejection', async (
    contractName, functionName, message,
  ) => {
    const error = new Error(message);
    const call = failingCall({
      provider: new MockNetworkProvider(), contractName, functionName, error,
    });
    await expect(call.send()).rejects.toBe(error);
  });

  it('retains the representative legacy receipt only with explicit provider opt-in', async () => {
    const error = new Error('Program failed an OP_VERIFY operation');
    const call = failingCall({
      provider: new MockNetworkProvider({ statefulSimulation: 'legacy-mistswap-v1' }),
      contractName: 'BentoBox',
      functionName: 'deposit',
      error,
    });

    const receipt = await call.send();
    expect(receipt.txid).toMatch(/^f0/);
    expect(receipt.hex).toBe('');
    expect(receipt.inputs).toEqual([]);
    expect(receipt.outputs).toEqual([]);
    expect(receipt.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: 'LogDeposit' }),
    ]));
  });

  it.each([
    [new MockNetworkProvider(), 0],
    [new MockNetworkProvider({ statefulSimulation: 'legacy-mistswap-v1' }), 1],
  ])('applies successful-send overlays only for an opted-in provider', async (provider, expectedCalls) => {
    const receipt = {
      txid: '11'.repeat(32), hex: '', inputs: [], outputs: [], version: 2, locktime: 0,
    };
    const applyOverlay = vi.fn().mockResolvedValue(undefined);
    const call = failingCall({
      provider, contractName: 'BentoBox', functionName: 'deposit', error: new Error('unused'),
    });
    Object.assign(call as unknown as Record<string, unknown>, {
      _applyOverrides: async () => ({ send: vi.fn().mockResolvedValue(receipt) }),
      _softApplyKashiStateSideEffects: applyOverlay,
    });

    expect(await call.send()).toBe(receipt);
    expect(applyOverlay).toHaveBeenCalledTimes(expectedCalls);
  });
});
