import { installOfflineRpcShims } from '../src/offline-rpc.js';

/** An address that already carries code on the mocked chain. */
const SEEDED_SINGLETON = '0x1111111111111111111111111111111111111111';

describe('installOfflineRpcShims', () => {
  it('reports no code for unknown addresses and seeded code for known ones', async () => {
    const provider = { send: async (_method: string): Promise<unknown> => 'unsupported' };
    const handle = installOfflineRpcShims(provider, { code: { [SEEDED_SINGLETON]: '0x6080' } });

    expect(await provider.send('eth_getCode', [SEEDED_SINGLETON.toUpperCase()])).toBe('0x6080');
    expect(await provider.send('eth_getCode', ['0x0000000000000000000000000000000000000001'])).toBe('0x');
    expect(handle.calls.every((call) => call.shimmed)).toBe(true);
    handle.restore();
  });

  it('accepts a raw transaction and returns a deterministic hash', async () => {
    const provider = { send: async (_method: string): Promise<unknown> => 'unsupported' };
    const handle = installOfflineRpcShims(provider);
    const raw = '0xf90f538085174876e800830f42408080';

    const first = await provider.send('eth_sendRawTransaction', [raw]);
    const second = await provider.send('eth_sendRawTransaction', [raw]);
    expect(first).toBe(second);
    expect(String(first)).toMatch(/^0x[0-9a-f]{64}$/);
    expect(handle.rawTransactions).toEqual([raw, raw]);
    handle.restore();
  });

  it('answers the remaining EVM read methods offline', async () => {
    const provider = { send: async (_method: string): Promise<unknown> => 'unsupported' };
    const handle = installOfflineRpcShims(provider, { callResult: '0xdeadbeef' });

    expect(await provider.send('eth_call', [{ to: SEEDED_SINGLETON }, 'latest'])).toBe('0xdeadbeef');
    expect(await provider.send('eth_getBalance', [SEEDED_SINGLETON])).toBe('0x0');
    expect(await provider.send('eth_getTransactionReceipt', ['0x00'])).toBeNull();
    expect(await provider.send('eth_estimateGas', [{}])).toBe('0x5208');
    handle.restore();
  });

  it('forwards methods it does not own to the wrapped provider', async () => {
    const forwarded: string[] = [];
    const provider = {
      send: async (method: string): Promise<unknown> => {
        forwarded.push(method);
        return '0x2a';
      },
    };
    const handle = installOfflineRpcShims(provider);
    expect(await provider.send('eth_blockNumber')).toBe('0x2a');
    expect(forwarded).toEqual(['eth_blockNumber']);
    expect(handle.calls).toEqual([{ method: 'eth_blockNumber', params: [], shimmed: false }]);
    handle.restore();
  });

  it('restores the original provider method', async () => {
    const original = async (): Promise<unknown> => 'original';
    const provider = { send: original };
    const handle = installOfflineRpcShims(provider);
    handle.restore();
    expect(provider.send).toBe(original);
  });
});
