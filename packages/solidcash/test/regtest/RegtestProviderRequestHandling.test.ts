import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX } from '@solidcash/utils';
import RegtestNetworkProvider from '../../src/network/RegtestNetworkProvider.js';
import { onMockNetworkProviderReset } from '../../src/network/mock-reset.js';
import type { Utxo } from '../../src/interfaces.js';
import { randomUtxo } from '../../src/utils.js';

// Needs the patched image (clearmempool, setmocktime), like RegtestProviderControls.
const describeRegtest = process.env.TESTS_USE_REGTEST === 'true' && process.env.BCHN_RELAXED === 'true'
  ? describe
  : describe.skip;

const options = {
  rpcUrl: process.env.REGTEST_RPC_URL ?? 'http://127.0.0.1:18443',
  rpcUser: process.env.REGTEST_RPC_USER ?? 'user',
  rpcPassword: process.env.REGTEST_RPC_PASSWORD ?? 'password',
};

const stub = (async (): Promise<Response> => new Response('stub')) as typeof fetch;

async function nodeRpc(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(options.rpcUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Basic ${btoa(`${options.rpcUser}:${options.rpcPassword}`)}`,
    },
    body: JSON.stringify({ jsonrpc: '1.0', id: 'test', method, params }),
  });
  return ((await response.json()) as { result: unknown }).result;
}

/** A provider built under a hooked fetch, which it adopts as its native one; `hook` runs inside each call. */
async function hookedProvider(
  hook: { run?: () => Response | undefined },
): Promise<{ provider: RegtestNetworkProvider; restore: () => void }> {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>): Promise<Response> => (
    hook.run?.() ?? realFetch(...args)
  )) as typeof fetch;
  const provider = new RegtestNetworkProvider(options);
  globalThis.fetch = realFetch;
  await provider.getBlockHeight();
  return { provider, restore: (): void => { globalThis.fetch = realFetch; } };
}

describeRegtest('RegtestNetworkProvider request handling', () => {
  it('caps the node requests it keeps in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (...args: Parameters<typeof fetch>): Promise<Response> => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      try {
        return await realFetch(...args);
      } finally {
        inFlight -= 1;
      }
    }) as typeof fetch;
    try {
      const provider = new RegtestNetworkProvider(options);
      await provider.getBlockHeight();
      peak = 0;
      const heights = await Promise.all(Array.from({ length: 40 }, () => provider.getBlockHeight()));
      expect(new Set(heights).size).toBe(1);
      expect(peak).toBeGreaterThan(1);
      expect(peak).toBeLessThanOrEqual(8);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('leaves a fetch the suite replaced while a request ran', async () => {
    const replacement = (async (): Promise<Response> => new Response('replacement')) as typeof fetch;
    const hook: { run?: () => Response | undefined } = {};
    const { provider, restore } = await hookedProvider(hook);
    try {
      globalThis.fetch = stub;
      hook.run = (): undefined => {
        globalThis.fetch = replacement;
        return undefined;
      };
      expect(await provider.getBlockHeight()).toBeGreaterThan(0);
      expect(globalThis.fetch).toBe(replacement);
    } finally {
      restore();
    }
  });

  it('retries a read under the native fetch after an overlapping request restored a stub', async () => {
    const hook: { run?: () => Response | undefined } = {};
    const { provider, restore } = await hookedProvider(hook);
    try {
      globalThis.fetch = stub;
      let failed = 0;
      hook.run = (): Response | undefined => {
        if (failed > 0) return undefined;
        failed += 1;
        // The first attempt meets a full work queue while another request hands the stub back.
        globalThis.fetch = stub;
        return new Response('Work queue depth exceeded', { status: 503 });
      };
      expect(await provider.getBlockHeight()).toBeGreaterThan(0);
      expect(failed).toBe(1);
      expect(globalThis.fetch).toBe(stub);
    } finally {
      restore();
    }
  });

  it('serves a repeated funder request the same live coin', async () => {
    const provider = new RegtestNetworkProvider(options);
    const seed = 'ab'.repeat(32);
    const first: Utxo = { txid: seed, vout: 0, satoshis: 5000n };
    const again: Utxo = { txid: seed, vout: 0, satoshis: 5000n };
    const other: Utxo = { txid: 'cd'.repeat(32), vout: 0, satoshis: 5000n };
    await provider.addUtxo(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX, first);
    await provider.addUtxo(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX, again);
    await provider.addUtxo(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX, other);
    expect(first.txid).not.toBe(seed);
    expect(`${again.txid}:${again.vout}`).toBe(`${first.txid}:${first.vout}`);
    expect(`${other.txid}:${other.vout}`).not.toBe(`${first.txid}:${first.vout}`);
  });

  it('funds without moving the block oracle', async () => {
    const provider = new RegtestNetworkProvider(options);
    await provider.getBlockHeight();
    const oracle = async (): Promise<string> => {
      const category = provider.blockOracleCategory;
      if (category === undefined) throw new Error('the provider installed no block oracle');
      const utxos = await provider.getUtxosByTokenCategory(binToHex(category));
      const live = utxos.find((utxo) => utxo.token?.nft?.capability === 'mutable');
      if (live === undefined) throw new Error('no live block oracle UTXO');
      return `${live.txid}:${live.vout}`;
    };
    const before = await oracle();
    await provider.addUtxo(`76a914${'11'.repeat(20)}88ac`, randomUtxo({ satoshis: 10_000n }));
    expect(await oracle()).toBe(before);
    await provider.mine(1);
    expect(await oracle()).not.toBe(before);
  });

  it('rewinds the block clock with a restore', async () => {
    const provider = new RegtestNetworkProvider(options);
    const tipTime = async (): Promise<number> => {
      const hash = await provider.getBlockHash(await provider.getBlockHeight());
      return (await nodeRpc('getblockheader', [hash, true]) as { time: number }).time;
    };
    await provider.mine(1);
    const snapshot = await provider.takeSnapshot();
    // One mine sets the clock once for all its blocks, so separate mines put it several seconds ahead.
    for (let block = 0; block < 5; block += 1) await provider.mine(1);
    const ahead = await tipTime();
    await snapshot.restore();
    await provider.mine(1);
    expect(await tipTime()).toBeLessThan(ahead);
  });

  it('clears chain-derived SDK caches on a rewind and a reset', async () => {
    const provider = new RegtestNetworkProvider(options);
    let resets = 0;
    onMockNetworkProviderReset(() => { resets += 1; });
    const snapshot = await provider.takeSnapshot();
    await provider.mine(1);
    await snapshot.restore();
    expect(resets).toBe(1);
    await provider.reset();
    expect(resets).toBe(2);
  });
});
