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

    // The clock is MTP-based. Advancing by a day mines the median window, then the restore rewinds it.
    const clockSnapshot = await provider.takeSnapshot();
    const before = provider.getBlockTime();
    const advanced = await provider.send('evm_increaseTime', [86400]);
    expect(advanced).toBe(before + 86400);
    expect(provider.getBlockTime()).toBe(advanced as number);
    expect(provider.getBlockTime() - before).toBe(86400);
    expect(await provider.getBlockHeight()).toBe(startHeight + 11);

    await clockSnapshot.restore();
    expect(await provider.getBlockHeight()).toBe(startHeight);
    await provider.reset();
  }, 180_000);
});
