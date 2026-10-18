import { describe, expect, it } from 'vitest';
import RegtestNetworkProvider from '../../src/network/RegtestNetworkProvider.js';

// The controls need the patched image (clearmempool, setmocktime). The stock regtest stack used by
// `yarn test:regtest` must not run this file.
const describeRegtest = process.env.TESTS_USE_REGTEST === 'true' && process.env.BCHN_RELAXED === 'true'
  ? describe
  : describe.skip;

describeRegtest('RegtestNetworkProvider controls', () => {
  const provider = new RegtestNetworkProvider({
    rpcUrl: process.env.REGTEST_RPC_URL ?? 'http://127.0.0.1:18443',
    rpcUser: process.env.REGTEST_RPC_USER ?? 'user',
    rpcPassword: process.env.REGTEST_RPC_PASSWORD ?? 'password',
  });

  it('restores snapshots and advances median-time-past', async () => {
    const startHeight = await provider.getBlockHeight();
    const snapshot = await provider.takeSnapshot();
    expect(snapshot.snapshotId).toMatch(/^regtest-/);

    await provider.mine(1);
    expect(await provider.getBlockHeight()).toBe(startHeight + 1);
    await snapshot.restore();
    expect(await provider.getBlockHeight()).toBe(startHeight);

    // A snapshot taken above the current tip has no chain state left to undo. Restoring it after an earlier
    // snapshot rewound the chain must keep the earlier chain; wallet-only fixtures can be captured after they
    // fund signers, which happens above the base fixture's height.
    await provider.mine(2);
    const laterSnapshot = await provider.takeSnapshot();
    await snapshot.restore();
    expect(await provider.getBlockHeight()).toBe(startHeight);
    await laterSnapshot.restore();
    expect(await provider.getBlockHeight()).toBe(startHeight);

    // A ported suite can replace global fetch with an in-memory IPFS stub that assumes every POST is an upload.
    // The node RPC must keep the native fetch, or every call is parsed as an upload body and fails.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (): Promise<Response> => new Response('stub')) as typeof fetch;
    try {
      expect(await provider.getBlockHeight()).toBeGreaterThanOrEqual(0);
    } finally {
      globalThis.fetch = originalFetch;
    }

    // The clock is MTP-based. Advancing by a day mines the median window, then the restore rewinds it.
    const clockSnapshot = await provider.takeSnapshot();
    const before = provider.getBlockTime();
    const advanced = await provider.send('evm_increaseTime', [86400]);
    // One extra second lets the oracle publish `MTP - 1` at the requested time while its own update stays final;
    // monotonic mine times may add a few more seconds so a restored fixture can never regenerate an old block.
    expect(advanced).toBeGreaterThanOrEqual(before + 86401);
    expect(provider.getBlockTime()).toBe(advanced as number);
    expect(provider.getBlockTime() - before).toBeGreaterThanOrEqual(86401);
    expect(await provider.getBlockHeight()).toBe(startHeight + 11);

    await clockSnapshot.restore();
    expect(await provider.getBlockHeight()).toBe(startHeight);
    await provider.reset();
  }, 180_000);
});
