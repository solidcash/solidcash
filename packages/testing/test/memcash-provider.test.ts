/**
 * `MemCashNetworkProvider` against an in-process devnet.
 *
 * The server is the shipped `@mem-cash/server` on an ephemeral port; the provider and the HRE are the shipped
 * implementations. The same scripted deploy runs against `MockNetworkProvider` so the CREATE nonce sequencing and
 * logical addresses can be compared directly.
 */
import { compileString } from '@solidcash/solidc';
import { createServer, type ServerHandle } from '@mem-cash/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHardhatRuntimeEnvironment } from '../src/hre.js';
import { resolveConfig } from '../src/config.js';
import type { HardhatRuntimeEnvironment } from '../src/hre.js';

const MOCK_MNEMONIC = 'test test test test test test test test test test test junk';
const OTHER_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const COUNTER_SOURCE = `contract MemCashCounter() {
  int public counter;
  function increment() { this.counter = this.counter + 1; require(true); }
}`;

let handle: ServerHandle | undefined;
const runtimes: HardhatRuntimeEnvironment[] = [];

function runtimeFor(port: number, overrides: { mnemonic?: string; accountsPath?: string } = {}): HardhatRuntimeEnvironment {
  const config = resolveConfig({
    defaultNetwork: 'localhost',
    networks: { localhost: { type: 'mem-cash', memCash: { port } } },
    ...(overrides.mnemonic === undefined ? {} : { mnemonic: overrides.mnemonic }),
    ...(overrides.accountsPath === undefined ? {} : { accounts: { path: overrides.accountsPath } }),
  });
  const hre = createHardhatRuntimeEnvironment(config, 'localhost');
  runtimes.push(hre);
  return hre;
}

function mockRuntime(): HardhatRuntimeEnvironment {
  const hre = createHardhatRuntimeEnvironment(resolveConfig({ defaultNetwork: 'mock', networks: { mock: { type: 'mock' } } }));
  runtimes.push(hre);
  return hre;
}

async function disconnectAll(): Promise<void> {
  for (const hre of runtimes.splice(0)) {
    await (hre.network.provider as unknown as { disconnect?: () => Promise<void> }).disconnect?.();
  }
}

async function deployCounter(hre: HardhatRuntimeEnvironment): Promise<{ address: string; contract: { call: Record<string, (...args: unknown[]) => { send(): Promise<unknown> }> } }> {
  const [signer] = await hre.ethers.getSigners(1);
  const artifact = compileString(COUNTER_SOURCE, { composition: 'direct' });
  const deployed = await hre.ethers.getContractFactory(artifact, signer).deploy();
  return { address: await deployed.getAddress(), contract: deployed as never };
}

beforeAll(async () => {
  handle = await createServer({
    port: 0,
    devnet: { accounts: { count: 1 }, height: 11 },
    logging: { level: 'error' },
  });
});

afterAll(async () => {
  await disconnectAll();
  await handle?.close({ drainMs: 10 });
});

describe('MemCashNetworkProvider connection and reads', () => {
  it('derives the node-funded signers, seeds the tip cache, and maps UTXOs', async () => {
    const hre = runtimeFor(handle!.port);
    const provider = hre.network.provider as unknown as {
      getBlockTime(): number;
      getUtxos(address: string): Promise<unknown[]>;
      addUtxo(address: string, utxo: unknown): Promise<unknown>;
      getLedgerOutput(txid: string, vout: number): Promise<{ satoshis: bigint } | undefined>;
      addTokenUtxos(outputs: unknown[]): Promise<{ categoryId: string; utxos: unknown[] }>;
      getUtxosByTokenCategory(category: string): Promise<unknown[]>;
      disconnect(): Promise<void>;
    };

    expect(() => provider.getBlockTime()).toThrow(/chain tip not seeded/);
    const [signer] = await hre.ethers.getSigners(1);
    expect(signer.address).toBe('bchtest:qzj4gasptsf6lw90hyskqv563n0fwmcl9ca4dqe4dh');
    expect(typeof provider.getBlockTime()).toBe('number');

    const coins = await provider.getUtxos(signer.address);
    expect(coins).toHaveLength(128);
    expect((coins[0] as { satoshis: bigint }).satoshis).toBe(7_812_500_000n);
    expect((coins[0] as { blockHeight: number }).blockHeight).toBe(1);

    const added = await provider.addUtxo(signer.address, {
      txid: 'aa'.repeat(32),
      vout: 4,
      satoshis: 12_345n,
      blockHeight: 9,
    });
    expect((added as { txid: string }).txid).toBe('aa'.repeat(32));
    const withAdded = await provider.getUtxos(signer.address);
    expect(withAdded).toHaveLength(129);
    expect(withAdded.find((coin) => (coin as { txid: string }).txid === 'aa'.repeat(32))).toMatchObject({
      vout: 4,
      satoshis: 12_345n,
      blockHeight: 9,
    });

    expect(await provider.getLedgerOutput('bb'.repeat(32), 0)).toBeUndefined();
    expect(await provider.getLedgerOutput('aa'.repeat(32), 4)).toMatchObject({ satoshis: 12_345n });

    const { categoryId } = await provider.addTokenUtxos([
      { address: signer.address, satoshis: 5000n, token: { amount: 77n } },
    ]);
    const byCategory = await provider.getUtxosByTokenCategory(categoryId);
    expect(byCategory).toHaveLength(1);
    expect((byCategory[0] as { token: { amount: bigint } }).token.amount).toBe(77n);

    await provider.disconnect();
    await provider.disconnect();
  }, 120_000);

  it('reports a path mismatch and a mnemonic mismatch with different messages', async () => {
    const pathMismatch = runtimeFor(handle!.port, { accountsPath: "m/44'/145'/0'/0" });
    await expect(pathMismatch.ethers.getSigners(1)).rejects.toThrow(/the node funds accounts at/);

    const mnemonicMismatch = runtimeFor(handle!.port, { mnemonic: OTHER_MNEMONIC });
    await expect(mnemonicMismatch.ethers.getSigners(1)).rejects.toThrow(/different mnemonic/);
    await disconnectAll();
  }, 120_000);
});

describe('MemCashNetworkProvider.send() translation', () => {
  it('implements the mock-shaped return table without sending EVM names', async () => {
    const hre = runtimeFor(handle!.port);
    const provider = hre.network.provider as unknown as {
      send(method: string, params?: unknown[]): Promise<unknown>;
      getBlockHeight(): Promise<number>;
      getBlockTime(): number;
    };
    const statsBefore = await (async () => {
      const response = await fetch(handle!.httpUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'devnet.stats', params: [] }),
      });
      return (await response.json()) as { result: { requests: { byMethod: Record<string, number> } } };
    })();

    expect(await provider.send('evm_mine')).toBe('0x0');
    expect(await provider.send('hardhat_mine', ['0x2'])).toBe('0x0');
    const height = await provider.getBlockHeight();
    expect(await provider.send('eth_blockNumber')).toBe(`0x${height.toString(16)}`);
    expect(await provider.send('eth_chainId')).toBe('0x0');
    expect(await provider.send('net_version')).toBe('0x0');
    const mptBefore = provider.getBlockTime();
    const timestamp = await provider.send('evm_increaseTime', [60]);
    expect(typeof timestamp).toBe('number');
    expect(provider.getBlockTime() - mptBefore).toBeGreaterThanOrEqual(50);
    expect(await provider.send('evm_setNextBlockTimestamp', [Math.floor(Date.now() / 1000) + 60])).toBeNull();
    expect(await provider.send('evm_setAutomine', [false])).toBeNull();
    expect(await provider.send('evm_setIntervalMining', [0])).toBeNull();
    expect(await provider.send('hardhat_reset')).toBeNull();
    await expect(provider.send('eth_call')).rejects.toThrow(/unsupported JSON-RPC method 'eth_call'/);

    const snapshot = await provider.send('evm_snapshot');
    expect(typeof snapshot).toBe('string');
    expect(await provider.send('evm_revert', [snapshot])).toBe(true);
    expect(await provider.send('evm_revert', ['0xdead'])).toBe(false);

    const heightAfter = await provider.getBlockHeight();
    expect(heightAfter).toBe(height);

    const statsAfter = await (async () => {
      const response = await fetch(handle!.httpUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'devnet.stats', params: [] }),
      });
      return (await response.json()) as { result: { requests: { byMethod: Record<string, number> } } };
    })();
    const evmNames = Object.keys(statsAfter.result.requests.byMethod)
      .filter((name) => /^(eth_|evm_|hardhat_|web3_|net_)/.test(name));
    expect(evmNames).toEqual(
      Object.keys(statsBefore.result.requests.byMethod).filter((name) => /^(eth_|evm_|hardhat_|web3_|net_)/.test(name)),
    );
  }, 120_000);
});

describe('deploy nonce sequencing', () => {
  it('runs deploy -> call -> deploy at nonce 0 and 2, matching MockNetworkProvider', async () => {
    const devnet = runtimeFor(handle!.port);
    const devnetScript = async (): Promise<string[]> => {
      const first = await deployCounter(devnet);
      await first.contract.call.increment!().send();
      const second = await deployCounter(devnet);
      return [first.address, second.address];
    };
    const devnetAddresses = await devnetScript();

    const mock = mockRuntime();
    const mockAddresses = await (async (): Promise<string[]> => {
      const first = await deployCounter(mock);
      await first.contract.call.increment!().send();
      const second = await deployCounter(mock);
      return [first.address, second.address];
    })();

    expect(devnetAddresses).toHaveLength(2);
    expect(devnetAddresses[0]).not.toBe(devnetAddresses[1]);
    expect(devnetAddresses).toEqual(mockAddresses);
  }, 240_000);

  it('derives distinct addresses for two providers against one node, and seeds a fresh process from the chain', async () => {
    const first = runtimeFor(handle!.port);
    const second = runtimeFor(handle!.port);
    const a = await deployCounter(first);
    const [signerB] = await second.ethers.getSigners(1);
    // A fresh provider's first nonce read sees the anchor the first provider created.
    const nonce = await (signerB as unknown as { getNonce(): Promise<number> }).getNonce();
    expect(nonce).toBeGreaterThanOrEqual(1);
    const b = await deployCounter(second);
    expect(b.address).not.toBe(a.address);
  }, 240_000);

  it('restores signer nonce state with a snapshot', async () => {
    const hre = runtimeFor(handle!.port);
    const provider = hre.network.provider as unknown as { send(method: string, params?: unknown[]): Promise<unknown> };
    const [signer] = await hre.ethers.getSigners(1);
    const nonceSigner = signer as unknown as { getNonce(): Promise<number> };
    const before = await nonceSigner.getNonce();
    const snapshot = await provider.send('evm_snapshot');
    const deployed = await deployCounter(hre);
    expect(deployed.address).toBeTruthy();
    const afterDeploy = await nonceSigner.getNonce();
    expect(afterDeploy).toBe(before + 1);
    expect(await provider.send('evm_revert', [snapshot])).toBe(true);
    expect(await nonceSigner.getNonce()).toBe(before);
  }, 240_000);
});
