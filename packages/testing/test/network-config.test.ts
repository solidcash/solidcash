import { BitcoinRpcNetworkProvider, RegtestNetworkProvider } from 'solidcash';
import { MockNetworkProvider } from 'solidcash/network/mock';
import { ElectrumNetworkProvider } from 'solidcash/network/electrum';
import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config.js';
import { createHardhatRuntimeEnvironment, createProvider } from '../src/hre.js';

describe('configured SolidHat networks', () => {
  it('constructs mocknet and regtest providers from their configured options', () => {
    expect(createProvider('mock', { type: 'mock' })).toBeInstanceOf(MockNetworkProvider);
    expect(createProvider('regtest', {
      type: 'regtest',
      rpc: { url: 'http://127.0.0.1:18443', user: 'alice', password: 'secret' },
    })).toBeInstanceOf(RegtestNetworkProvider);
  });

  it('constructs explicit live Electrum and Bitcoin RPC providers', () => {
    const electrum = createProvider('chipnet', { type: 'electrum', network: 'chipnet' });
    const rpc = createProvider('mainnet-rpc', {
      type: 'bitcoin-rpc', network: 'mainnet',
      rpc: { url: 'http://127.0.0.1:8332', user: 'alice', password: 'secret' },
    });

    expect(electrum).toBeInstanceOf(ElectrumNetworkProvider);
    expect(electrum.network).toBe('chipnet');
    expect(rpc).toBeInstanceOf(BitcoinRpcNetworkProvider);
    expect(rpc.network).toBe('mainnet');
  });

  it('rejects incomplete RPC networks and unknown network selection', async () => {
    expect(() => createProvider('broken', {
      type: 'bitcoin-rpc', rpc: { url: 'http://127.0.0.1:18443' },
    })).toThrow('requires an explicit BCH network');
    expect(() => createProvider('broken', {
      type: 'bitcoin-rpc', network: 'regtest', rpc: { url: 'http://127.0.0.1:18443' },
    })).toThrow('requires rpc.user and rpc.password');

    const hre = createHardhatRuntimeEnvironment(resolveConfig({ networks: { local: { type: 'mock' } } }));
    await expect(hre.network.connect('missing')).rejects.toThrow('Network "missing" is not configured');
    expect(() => createHardhatRuntimeEnvironment(hre.config, 'missing'))
      .toThrow('Network "missing" is not configured');
    expect(() => createHardhatRuntimeEnvironment(resolveConfig({
      networks: { mainnet: { type: 'electrum', network: 'mainnet' } },
    }), 'mainnet')).toThrow('requires an explicit mnemonic');
    await expect(hre.network.connect('mainnet')).rejects.toThrow('Network "mainnet" is not configured');
    const mixed = createHardhatRuntimeEnvironment(resolveConfig({
      networks: { mainnet: { type: 'electrum', network: 'mainnet' } },
    }));
    await expect(mixed.network.connect('mainnet')).rejects.toThrow('requires an explicit mnemonic');
  });

  it('TOOLS-7 a shared mnemonic cannot sign on two live chains', () => {
    const phrase = 'test test test test test test test test test test test junk';
    expect(() => createHardhatRuntimeEnvironment(resolveConfig({
      mnemonic: phrase,
      networks: {
        chipnet: { type: 'electrum', network: 'chipnet' },
        mainnet: { type: 'electrum', network: 'mainnet' },
      },
    }))).toThrow(/needs its own mnemonic/);
    expect(() => createHardhatRuntimeEnvironment(resolveConfig({
      mnemonic: phrase,
      networks: {
        chipnet: { type: 'electrum', network: 'chipnet' },
        chipnetRpc: {
          type: 'bitcoin-rpc', network: 'chipnet',
          rpc: { url: 'http://127.0.0.1:8332', user: 'alice', password: 'secret' },
        },
      },
    }))).not.toThrow();
    expect(() => createHardhatRuntimeEnvironment(resolveConfig({
      networks: {
        chipnet: { type: 'electrum', network: 'chipnet', mnemonic: phrase },
        mainnet: { type: 'electrum', network: 'mainnet', mnemonic: `${phrase} main` },
      },
    }))).not.toThrow();
  });
});
