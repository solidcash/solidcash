import { describe, expect, it } from 'vitest';
import { BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX } from '@solidcash/utils';
import RegtestNetworkProvider from '../../src/network/RegtestNetworkProvider.js';
import { onMockNetworkProviderReset } from '../../src/network/mock-reset.js';
import type { Utxo } from '../../src/interfaces.js';

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
