/**
 * One block-info oracle coin per master (direct convention): a block.* reader deployed with several masters mints one
 * oracle coin per master, all with the same commitment. A call co-spends one of them, the oracle covenant refuses a
 * transaction that spends two coins of its lock, and the keeper refreshes every coin.
 */
import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  blockOracleFieldValue, blockOracleLockingBytecode, blockOracleReadUnlocking, encodeBlockOracleCommitment, hash160,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import type { Utxo } from '../../src/interfaces.js';
import { BlockOracleUpdater } from '../../src/oracle/index.js';
import { randomUtxo } from '../../src/utils.js';
import { aliceAddress, alicePriv } from '../fixture/vars.js';

const SOURCE = 'contract Clock() { function at(int t) { require(block.timestamp == t); } }';
const MASTERS = 3;

async function deploy(provider: MockNetworkProvider): Promise<Awaited<ReturnType<typeof StatefulContract.deploy>>> {
  const fundingUtxo = await provider.addUtxo(aliceAddress, randomUtxo({ vout: 0, satoshis: 500_000n }));
  return StatefulContract.deploy(compileString(SOURCE), [], {
    provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
    threadCount: MASTERS,
  });
}

async function oracleCoins(provider: MockNetworkProvider, categoryId: string): Promise<Utxo[]> {
  const utxos = await provider.getUtxosForLockingBytecode(blockOracleLockingBytecode(hexToBin(categoryId)));
  return utxos.filter((utxo) => utxo.token?.category === categoryId && utxo.token.nft?.capability === 'mutable');
}

const commitments = (coins: readonly Utxo[]): Set<string> => new Set(coins.map((coin) => coin.token!.nft!.commitment));
const sameOutpoint = (left: Utxo, right: Utxo): boolean => left.txid === right.txid && left.vout === right.vout;

describe('one block-info oracle coin per master', () => {
  it('mints one oracle coin per master, all with the same commitment', async () => {
    const provider = new MockNetworkProvider();
    const { contract, categoryId } = await deploy(provider);
    const masters = (await provider.getUtxos(contract.inner.tokenAddress)).filter((utxo) => (
      utxo.token?.category === categoryId && utxo.token.nft?.capability === 'minting'));
    expect(masters).toHaveLength(MASTERS);
    const coins = await oracleCoins(provider, categoryId);
    expect(coins).toHaveLength(MASTERS);
    expect(commitments(coins).size).toBe(1);
  });

  it('a call co-spends one coin and recreates it; the others stay where they were', async () => {
    const provider = new MockNetworkProvider();
    const { contract, categoryId } = await deploy(provider);
    const before = await oracleCoins(provider, categoryId);
    const now = blockOracleFieldValue(hexToBin(before[0]!.token!.nft!.commitment), 'timestamp');
    await expect(contract.call.at(now).send()).resolves.toHaveProperty('txid');
    const after = await oracleCoins(provider, categoryId);
    expect(after).toHaveLength(MASTERS);
    expect(after.filter((coin) => before.some((old) => sameOutpoint(old, coin)))).toHaveLength(MASTERS - 1);
    expect(commitments(after)).toEqual(commitments(before));
  });

  it('the covenant refuses a transaction that spends two coins of its lock', async () => {
    const provider = new MockNetworkProvider();
    const { categoryId } = await deploy(provider);
    const category = hexToBin(categoryId);
    const lock = blockOracleLockingBytecode(category);
    const reader = {
      generateLockingBytecode: (): Uint8Array => lock,
      generateUnlockingBytecode: (): Uint8Array => blockOracleReadUnlocking(category),
    };
    const fee = await provider.addUtxo(aliceAddress, randomUtxo({ satoshis: 100_000n }));
    // Each coin is read on its own path and recreated at its own index; a fee coin pays.
    const read = async (coins: readonly Utxo[]): Promise<unknown> => {
      const builder = new TransactionBuilder({ provider });
      for (const coin of coins) builder.addInput(coin, reader);
      builder.addInput(fee, new SignatureTemplate(alicePriv).unlockP2PKH());
      for (const coin of coins) builder.addOutput({ to: lock, amount: coin.satoshis, token: coin.token });
      builder.addOutput({ to: aliceAddress, amount: fee.satoshis - 3_000n });
      return builder.send();
    };
    const [first, second] = await oracleCoins(provider, categoryId);
    await expect(read([first!, second!])).rejects.toThrow(/OP_VERIFY/);
    await expect(read([first!])).resolves.toHaveProperty('txid');
  });

  it('the keeper refreshes every coin, one transaction each', async () => {
    const provider = new MockNetworkProvider();
    const { contract, categoryId } = await deploy(provider);
    const rpc = { request: async (): Promise<never> => { throw new Error('unused'); } };
    const keeper = new BlockOracleUpdater({
      contract: contract.inner, categoryId, keeperKey: provider.blockOracleOwnerKey, rpc,
    });
    // A height update keeps the stored timestamp; the other fields are the keeper's, which the mock never writes.
    const fields = {
      number: BigInt(await provider.getBlockHeight()), timestamp: await keeper.oracleTimestamp(),
      difficulty: 7n, size: 1n, totalFees: 0n, coinbase: new Uint8Array(),
    };
    await expect(keeper.pushUpdate(fields)).resolves.toMatch(/^[0-9a-f]{64}$/);
    const coins = await oracleCoins(provider, categoryId);
    expect(coins).toHaveLength(MASTERS);
    expect(new Set(coins.map((coin) => coin.txid)).size).toBe(MASTERS);
    const signed = binToHex(encodeBlockOracleCommitment(hash160(provider.blockOracleOwnerPublicKey), fields));
    expect([...commitments(coins)]).toEqual([signed]);
  });
});
