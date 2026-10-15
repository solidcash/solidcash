import { describe, expect, it } from 'vitest';
import { blockOracleLockingBytecode } from '@solidcash/utils';
import { ElectrumNetworkProvider } from '../../src/network/electrum/index.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import { Network } from '../../src/interfaces.js';

// A client supplied to the provider avoids creating a websocket or making network requests.
const electrum = {} as never;

describe('typed live block oracle configuration', () => {
  it('derives the shared lock and owns a copy of its category', () => {
    const category = new Uint8Array(32).fill(0xa7);
    const provider: NetworkProvider = new ElectrumNetworkProvider(Network.MAINNET, {
      electrum, blockOracleCategory: category,
    });
    expect(provider.blockOracleLock).toEqual(blockOracleLockingBytecode(category));
    category.fill(0);
    expect(provider.blockOracleCategory).toEqual(new Uint8Array(32).fill(0xa7));
    expect(() => new ElectrumNetworkProvider(Network.MAINNET, {
      electrum, blockOracleCategory: new Uint8Array(31),
    })).toThrow('exactly 32 bytes');
  });
});
