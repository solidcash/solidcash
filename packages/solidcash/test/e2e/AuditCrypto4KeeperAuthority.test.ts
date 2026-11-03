import { describe, it, expect } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { blockhashOracleLockingBytecode } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { BlockOracleUpdater, RpcLike, type BlockOracleFields } from '../../src/oracle/blockOracleUpdater.js';
import type { Utxo } from '../../src/interfaces.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { aliceAddress, alicePriv } from '../fixture/vars.js';

/**
 * Audit CRYPTO-4 / CRYPTO-5 (docs/security/2026-10/CRYPTO.md, closed in the ledger's ORACLE-6).
 *
 * CRYPTO-4: a blockhash() consumer's keeper held a minting NFT of the consumer's own category, and the data and
 * entry covenants accept any minting NFT of that category as the master's authority. The keeper holds no token now:
 * the genesis mints the reader's ring of mutable slots, so no coin but a master holds the category's minting NFT. A
 * slot's owner alone updates it, and no master spend mints a slot (BlockhashRing.test.ts).
 *
 * CRYPTO-5: the owner must not report block.number as a time-type value (>= 500,000,000), which a time-type
 * nLockTime would satisfy under OP_CHECKLOCKTIMEVERIFY. The block oracle covenant moves the number only under a
 * height-type nLockTime, below 500,000,000.
 */

// Its reads reach four blocks back, so its ring holds four slots.
const CONSUMER = 'contract B(){ function f(bytes32 h){ require(blockhash(block.number - 4) == h); } }';

const fakeRpc = (): RpcLike => ({ request: async (): Promise<never> => { throw new Error('unused'); } });

describe('CRYPTO-4: no coin but a master holds a blockhash reader\'s minting NFT', () => {
  it('mints the ring as mutable slots, and only the master holds the minting NFT', async () => {
    const provider = new MockNetworkProvider();
    const fundingUtxo = await provider.addUtxo(aliceAddress, randomUtxo({ vout: 0, satoshis: 500_000n }));
    const { contract, categoryId } = await StatefulContract.deploy(compileString(CONSUMER), [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
      blockhashDepth: 4,
    });
    const coins = await provider.getUtxosByTokenCategory(categoryId);
    const lockOf = (utxo: Utxo): string => binToHex(utxo.lockingBytecode!);
    const minting = coins.filter(({ token }) => token?.nft?.capability === 'minting');
    expect(minting.length).toBeGreaterThan(0);
    expect(new Set(minting.map(lockOf))).toEqual(new Set([contract.inner.lockingBytecode]));
    const slotLock = binToHex(blockhashOracleLockingBytecode(hexToBin(categoryId)));
    expect(coins.filter((utxo) => lockOf(utxo) === slotLock).map(({ token }) => token?.nft?.capability))
      .toEqual(['mutable', 'mutable', 'mutable', 'mutable']);
  }, 120_000);
});

// Below the mock's median time past, so a time-type nLockTime alone would not stop the update.
const T0 = 1_699_990_000n;

const OWNED_ORACLE = `
contract BlockOracleOwned() {
    function readBack(int eNumber) { require(block.number == eNumber); }
}`;

describe('CRYPTO-5: block.number cannot be reported as a time-type value', () => {
  // A reader whose own oracle holds (0, T0), kept by the mock's owner key.
  async function owned(): Promise<{ provider: MockNetworkProvider; updater: BlockOracleUpdater } | undefined> {
    const provider = createTestProvider();
    if (!('setBlockOracleFields' in provider)) return undefined;
    const fundingUtxo = await provider.addUtxo(aliceAddress, randomUtxo({ vout: 0, satoshis: 500_000n }));
    const { contract, categoryId } = await StatefulContract.deploy(compileString(OWNED_ORACLE), [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
    });
    provider.setBlockOracleFields({
      number: 0n, timestamp: T0, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: hexToBin('00'),
    }, categoryId);
    const updater = new BlockOracleUpdater({
      contract: contract.inner, categoryId, keeperKey: provider.blockOracleOwnerKey, rpc: fakeRpc(),
    });
    return { provider, updater };
  }

  const fields = (number: bigint): BlockOracleFields => ({
    number, timestamp: T0, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: hexToBin('00'),
  });

  it('accepts an honest height update', async () => {
    const o = await owned();
    if (o === undefined) return;
    const n = await o.provider.getBlockHeight();
    expect(await o.updater.pushUpdate(fields(BigInt(n)), n)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects number >= 500,000,000 under a time-type locktime', async () => {
    const o = await owned();
    if (o === undefined) return;
    // The audit's shape: nLockTime is a final time just past the stored timestamp, and the number is time-sized.
    await expect(o.updater.pushUpdate(fields(500_000_001n), Number(T0 + 100n))).rejects.toThrow();
    expect(await o.updater.oracleHeight()).toBe(0n);
  });
});
