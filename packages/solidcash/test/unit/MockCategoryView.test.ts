import { describe, expect, it } from 'vitest';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { randomUtxo } from '../../src/utils.js';
import { aliceAddress } from '../fixture/vars.js';

/**
 * `getUtxosByTokenCategory` reuses one live UTXO view until the store is written. A write, a snapshot restore and a
 * caller mutating what it got back must all leave the next read exactly what a fresh read of the store returns.
 */
describe('MockNetworkProvider category reads', () => {
  const category = 'ab'.repeat(32);
  const withToken = (amount: bigint, commitment?: string): ReturnType<typeof randomUtxo> => randomUtxo({
    token: {
      category, amount, ...(commitment === undefined ? {} : { nft: { capability: 'mutable', commitment } }),
    },
  });

  it('sees every write and restore, and hands out copies', async () => {
    const provider = new MockNetworkProvider();
    await provider.addUtxo(aliceAddress, withToken(1n, '01'));
    const first = await provider.getUtxosByTokenCategory(category);
    expect(first).toHaveLength(1);
    first[0]!.token!.nft!.commitment = 'ff';
    first[0]!.lockingBytecode![0] = 0x00;
    const again = await provider.getUtxosByTokenCategory(category);
    expect(again[0]!.token!.nft!.commitment).toBe('01');
    expect(again[0]!.lockingBytecode![0]).toBe(0x76);

    const snapshot = await provider.takeSnapshot();
    await provider.addUtxo(aliceAddress, withToken(2n));
    expect((await provider.getUtxosByTokenCategory(category)).map((utxo) => utxo.token!.amount)).toEqual([1n, 2n]);
    await snapshot.restore();
    expect((await provider.getUtxosByTokenCategory(category)).map((utxo) => utxo.token!.amount)).toEqual([1n]);
  });
});
