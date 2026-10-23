import { binToHex } from '@bitauth/libauth';
import { addressToLockScript } from '@solidcash/solidcash/dist/utils.js';
import { compileString } from '@solidcash/solidc';
import MockNetworkProvider from '@solidcash/solidcash/dist/network/MockNetworkProvider.js';
import { createLookaheadForAddress } from '@solidcash/solidcash/dist/framed/deploy/create-lookahead-session.js';
import { isReservedGenesisOutpoint, genesisOutpointKey } from '@solidcash/solidcash/dist/stateful/genesis-reservations.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHardhatRuntimeEnvironment } from '../src/hre.js';
import { resolveConfig } from '../src/config.js';

const providers: MockNetworkProvider[] = [];
afterEach(() => {
  for (const provider of providers.splice(0)) provider.reset();
  vi.restoreAllMocks();
});

const harness = (): ReturnType<typeof createHardhatRuntimeEnvironment> => {
  const hre = createHardhatRuntimeEnvironment(resolveConfig({
    composition: 'framed',
    networks: { mock: { type: 'mock' } }, defaultNetwork: 'mock',
    accounts: { count: 1, satoshis: 1_234_567n },
  }));
  providers.push(hre.ethers.provider as MockNetworkProvider);
  return hre;
};

describe('mock HRE funding for read-only CREATE look-ahead', () => {
  it('predicts four distinct creates without broadcasting or changing the configured balance', async () => {
    const hre = harness();
    const [signer] = await hre.ethers.getSigners(1);
    const provider = hre.ethers.provider as MockNetworkProvider;
    const before = await signer.getUtxos();
    expect(before).toHaveLength(128);
    expect(before.reduce((sum, coin) => sum + coin.satoshis, 0n)).toBe(128n * 1_234_567n);
    expect(before.filter((coin) => coin.vout === 0)).toHaveLength(4);
    expect(new Set(before.map((coin) => coin.txid)).size).toBe(4);
    const broadcast = vi.spyOn(provider, 'sendRawTransaction');
    const nonce = await signer.getNonce();
    expect(await signer.getNonce()).toBe(nonce);
    const predictions = Array.from({ length: 4 }, (_unused, index) => hre.ethers.getCreateAddress({
      from: signer.address, nonce: nonce + index,
    }));
    expect(new Set(predictions).size).toBe(4);
    expect(broadcast).not.toHaveBeenCalled();
    expect(await signer.getUtxos()).toEqual(before);
    const reserved = createLookaheadForAddress(signer.address)!;
    expect(reserved.getReservedCount()).toBe(4);
    expect(reserved.getReservedUtxos().every((coin) => coin.vout === 0)).toBe(true);
    expect(before.filter((coin) => !isReservedGenesisOutpoint(genesisOutpointKey(coin.txid, coin.vout))))
      .toHaveLength(124);
    expect(await hre.ethers.getSigners(1)).toEqual([signer]);
    expect(await signer.getUtxos()).toEqual(before);

    const artifact = compileString(`contract PrefundedCreate() {
      int counter;
      function increment() { this.counter = this.counter + 1; require(true); }
    }`, { composition: 'framed' });
    const expectedCategory = reserved.getFundingUtxo(nonce).txid;
    const deployed = await hre.ethers.getContractFactory(artifact, signer).deploy();
    expect(deployed.categoryId).toBe(expectedCategory);
    expect(binToHex(addressToLockScript(await deployed.getAddress()))).toBe(predictions[0]);
  });

  it('partitions an explicit smaller coin pool without adding balance or changing the SDK default', async () => {
    const hre = harness();
    const [signer] = await hre.ethers.getSigners(1, { satoshis: 200_000n, fundingUtxos: 7 });
    const coins = await signer.getUtxos();
    expect(coins).toHaveLength(7);
    expect(coins.filter((coin) => coin.vout === 0)).toHaveLength(4);
    expect(coins.reduce((sum, coin) => sum + coin.satoshis, 0n)).toBe(1_400_000n);

    const provider = new MockNetworkProvider();
    providers.push(provider);
    const [sdkSigner] = await provider.getSigners(1, { satoshis: 200_000n, fundingUtxos: 7 });
    const sdkCoins = await sdkSigner.getUtxos();
    expect(sdkCoins).toHaveLength(7);
    expect(sdkCoins.filter((coin) => coin.vout === 0)).toHaveLength(1);
    expect(sdkCoins.reduce((sum, coin) => sum + coin.satoshis, 0n)).toBe(1_400_000n);
  });
});
