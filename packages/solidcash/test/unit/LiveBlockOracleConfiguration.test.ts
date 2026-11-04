import { describe, expect, it } from 'vitest';
import { ElectrumNetworkProvider } from '../../src/network/electrum/index.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import { Network } from '../../src/interfaces.js';

// A client supplied to the provider avoids creating a websocket or making network requests.
const electrum = {} as never;

describe('typed live oracle pool configuration', () => {
  it('names the default pool in lowercase display order and refuses anything but 32 bytes of hex', () => {
    const category = `${'A7'.repeat(31)}58`;
    const provider: NetworkProvider = new ElectrumNetworkProvider(Network.MAINNET, {
      electrum, oraclePoolCategory: category,
    });
    expect(provider.oraclePoolCategory).toBe(category.toLowerCase());
    expect(new ElectrumNetworkProvider(Network.MAINNET, { electrum }).oraclePoolCategory).toBeUndefined();
    for (const bad of ['a7'.repeat(31), `${'a7'.repeat(31)}5g`, `0x${'a7'.repeat(32)}`]) {
      expect(() => new ElectrumNetworkProvider(Network.MAINNET, { electrum, oraclePoolCategory: bad }))
        .toThrow('oraclePoolCategory must be 32 bytes of hex');
    }
  });
});
