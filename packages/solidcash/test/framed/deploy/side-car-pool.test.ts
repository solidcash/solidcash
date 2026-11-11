import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { SHARED_LIBRARY_SALT, keccakComputeLockingBytecode } from '@solidcash/utils';
import { HDSigner } from '../../../src/HDSigner.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { FramedSideCarPoolError, SIDE_CAR_SATOSHIS, entrySideCars } from '../../../src/framed/call/side-cars.js';
import {
  DEFAULT_KECCAK_SIDE_CARS, FramedSideCarDeployError, deployComputeSideCarPool,
} from '../../../src/framed/deploy/index.js';
import { byLockOnly } from '../by-lock-only.js';

/**
 * The compute side-cars a real network holds. A provider that can mint them provisions stand-ins when a call asks; a
 * real network has only what a deployment left, so an entry that hashes refuses until a pool is there.
 */

const PHRASE = 'test test test test test test test test test test test junk';
const LOCK = keccakComputeLockingBytecode(SHARED_LIBRARY_SALT, true);

async function funded(): Promise<{ provider: MockNetworkProvider; signer: HDSigner }> {
  const provider = new MockNetworkProvider({ policy: { enforceDust: true } } as never);
  const signer = HDSigner.fromPhrase(PHRASE, provider);
  await provider.addUtxo(signer.getAddress(), { txid: '11'.repeat(32), vout: 0, satoshis: 10_000_000n });
  return { provider, signer };
}

describe('the compute side-car pool', () => {
  it('mints the pool a deployment asks for at the shared lock', async () => {
    const { provider, signer } = await funded();
    const pool = await deployComputeSideCarPool({ provider: byLockOnly(provider), signer, keccak: 3 });
    expect(pool.minted).toBe(3);
    const coins = await provider.getUtxosForLockingBytecode(LOCK);
    expect(coins).toHaveLength(3);
    for (const coin of coins) {
      expect(coin.satoshis).toBe(SIDE_CAR_SATOSHIS);
      expect(coin.token).toMatchObject({ amount: 0n, nft: { capability: 'mutable', commitment: '00'.repeat(32) } });
    }
  });

  it('tops a pool up and mints nothing past it', async () => {
    const { provider, signer } = await funded();
    await deployComputeSideCarPool({ provider, signer, keccak: 2 });
    await provider.addUtxo(signer.getAddress(), { txid: '22'.repeat(32), vout: 0, satoshis: 10_000_000n });
    await expect(deployComputeSideCarPool({ provider, signer, keccak: 2 })).resolves.toStrictEqual({ minted: 0 });
    const more = await deployComputeSideCarPool({ provider, signer, keccak: 5 });
    expect(more.minted).toBe(3);
    expect(await provider.getUtxosForLockingBytecode(LOCK)).toHaveLength(5);
    expect(DEFAULT_KECCAK_SIDE_CARS).toBeGreaterThanOrEqual(5);
  });

  it('refuses a signer with no output-0 coin to mint from', async () => {
    const provider = new MockNetworkProvider();
    const signer = HDSigner.fromPhrase(PHRASE, provider);
    await provider.addUtxo(signer.getAddress(), { txid: '33'.repeat(32), vout: 1, satoshis: 10_000_000n });
    await expect(deployComputeSideCarPool({ provider, signer, keccak: 1 })).rejects
      .toBeInstanceOf(FramedSideCarDeployError);
  });

  it('takes no coin without a result or the value to carry one, which anyone can pay to the public lock', async () => {
    const { provider, signer } = await funded();
    await deployComputeSideCarPool({ provider, signer, keccak: 1 });
    await provider.addUtxo(binToHex(LOCK), {
      txid: '00'.repeat(32), vout: 9, satoshis: 2_000n,
      token: { category: 'ee'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });
    await provider.addUtxo(binToHex(LOCK), {
      txid: '00'.repeat(32), vout: 10, satoshis: 800n,
      token: { category: 'ee'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: 'ff'.repeat(32) } },
    });
    const coins = await provider.getUtxosForLockingBytecode(LOCK);
    expect(coins).toHaveLength(3);
    // No provider of this view mints a stand-in, so what the call takes is what the lock holds.
    const lockOnly = { network: provider.network, getUtxosForLockingBytecode: async () => coins } as never;
    const { utxos } = await entrySideCars({
      provider: lockOnly, master: 'master', abiFunction: { name: 'hash', keccakInLoop: true } as never,
      argumentPushes: [], leadingPushes: 0, hashes: 1,
    });
    const taken = Object.values(utxos);
    expect(taken).toHaveLength(1);
    expect(taken[0]!.token?.nft?.commitment).toBe('00'.repeat(32));
  });

  it('names the pool a real network is short of', async () => {
    const { provider } = await funded();
    await expect(entrySideCars({
      provider: { network: provider.network, getUtxosForLockingBytecode: async () => [] } as never, master: 'master',
      abiFunction: { name: 'hash', keccakInLoop: true } as never, argumentPushes: [], leadingPushes: 0, hashes: 1,
    })).rejects.toBeInstanceOf(FramedSideCarPoolError);
  });
});
