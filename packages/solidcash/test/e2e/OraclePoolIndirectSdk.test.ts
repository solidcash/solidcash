import { describe, expect, it } from 'vitest';
import { binToHex, decodeTransaction, hexToBin } from '@bitauth/libauth';
import { ORACLE_POOL_PARAMETER } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import type { MockNetworkProvider } from '../../src/network/mock/index.js';
import {
  poolInfoUnlockable, readsPoolOnlyIndirectly, selectPoolInfoCoin, type PoolBlockFields,
} from '../../src/oracle/pool/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, mintTestOraclePool } from '../test-util.js';

/**
 * A block.* read reached only through a function pointer (oracle pools, phase 3). An indirect call hands its target
 * no coin index, so the target finds the first block-info coin of the pool its contract binds, and the entry
 * publishes no index. The SDK co-spends a coin of that pool for every call of such a contract, recreated at its own
 * index, and the read checks the coin's category and flags, not its lock.
 */

const POINTER_READER = `
contract PointerClock() {
    function stamp() internal view returns (uint32) { return block.timestamp; }
    function zero() internal view returns (uint32) { return 0; }
    function check(int expected, bool live) {
        function() internal view returns (uint32) read = live ? stamp : zero;
        require(read() == expected);
    }
}`;

// Fields of a pool the test mints, unlike the chain's tip that the provider's pool publishes.
const POOL_TIP: PoolBlockFields = {
  number: 120_000n, timestamp: 1_690_000_000n, difficulty: 0n, size: 1_000n, totalFees: 0n,
  coinbase: hexToBin(`76a914${'11'.repeat(20)}88ac`),
};

const TXID = /^[0-9a-f]{64}$/;
const SCRIPT_FAILURE = /OP_VERIFY|EQUALVERIFY|non-truthy/;

const artifact = compileString(POINTER_READER);

/** Spend the reader once; unless `coins` are given, the builder co-spends a coin of its pool itself. */
async function spend(
  provider: MockNetworkProvider, reader: Contract, expected: bigint, live: boolean,
  coins?: Parameters<typeof poolInfoUnlockable>[],
): Promise<string> {
  const utxo = await provider.addUtxo(reader.address, randomUtxo({ satoshis: 100_000n }));
  const builder = new TransactionBuilder({ provider, skipAutomaticCoSpends: coins !== undefined })
    .addInput(utxo, reader.unlock.check(expected, live))
    .addOutput({ to: reader.address, amount: 90_000n });
  for (const [coin, category] of coins ?? []) {
    const { unlocker, ...utxoOf } = poolInfoUnlockable(coin, category);
    builder.addInput(utxoOf, unlocker).addOutput({
      to: unlocker.generateLockingBytecode(), amount: utxoOf.satoshis, token: utxoOf.token,
    });
  }
  return (await builder.send()).txid;
}

/** The pool categories whose mutable NFT transaction `txid` recreates. */
async function recreatedPools(provider: MockNetworkProvider, txid: string): Promise<string[]> {
  const transaction = decodeTransaction(hexToBin(await provider.getRawTransaction(txid)));
  if (typeof transaction === 'string') throw new Error(transaction);
  return transaction.outputs.flatMap(({ token }) => (token?.nft?.capability === 'mutable'
    ? [binToHex(token.category)] : []));
}

describe('oracle pool reads reached only through a function pointer', () => {
  it('compiles an entry that takes the pool binding and no coin index', () => {
    expect(artifact.usesBlockOracle).toBe(true);
    expect(artifact.constructorInputs.map((input) => input.name)).toEqual([ORACLE_POOL_PARAMETER]);
    const check = artifact.abi.find((fn) => fn.name === 'check')!;
    expect(check.inputs.map((input) => input.name)).not.toContain('__internal__blockOracleInputIndex');
    expect(check.usesBlockOracle).toBeUndefined();
    expect(readsPoolOnlyIndirectly(artifact)).toBe(true);
  });

  it('co-spends a coin of the bound pool for a call that reads through the pointer', async () => {
    const provider = createTestProvider() as MockNetworkProvider;
    const pool = await mintTestOraclePool(provider, POOL_TIP);
    const reader = new Contract(artifact, [], { provider, oraclePool: pool });
    expect(reader.oraclePool).toBe(pool);

    const txid = await spend(provider, reader, POOL_TIP.timestamp, true);
    expect(txid).toMatch(TXID);
    expect(await recreatedPools(provider, txid)).toEqual([pool]);
    // The target slices the coin it found: a timestamp the pool does not hold is refused.
    await expect(spend(provider, reader, POOL_TIP.timestamp + 1n, true)).rejects.toThrow(SCRIPT_FAILURE);
    // A call that takes the other arm reads nothing, and still co-spends a coin.
    const zero = await spend(provider, reader, 0n, false);
    expect(await recreatedPools(provider, zero)).toEqual([pool]);
  });

  it('reads the provider\'s pool by default, at the clock its keeper publishes', async () => {
    const provider = createTestProvider() as MockNetworkProvider;
    const reader = new Contract(artifact, [], { provider });
    const category = provider.oraclePoolCategory!;
    expect(reader.oraclePool).toBe(category);
    const { fields } = (await selectPoolInfoCoin(provider, category))!;
    const txid = await spend(provider, reader, fields.timestamp, true);
    expect(await recreatedPools(provider, txid)).toEqual([category]);
  });

  it('finds the coin by its category: a coin of another pool is refused, one of the bound pool accepted', async () => {
    const provider = createTestProvider() as MockNetworkProvider;
    const pool = await mintTestOraclePool(provider, POOL_TIP);
    const other = await mintTestOraclePool(provider, POOL_TIP);
    const reader = new Contract(artifact, [], { provider, oraclePool: pool });
    const coinOf = async (category: string): Promise<Parameters<typeof poolInfoUnlockable>> => (
      [(await selectPoolInfoCoin(provider, category))!.utxo, category]);

    // The only pool coin is another pool's, with the same fields at its own pool's lock: the walk passes the last input.
    const refused = spend(provider, reader, POOL_TIP.timestamp, true, [await coinOf(other)]);
    await expect(refused).rejects.toThrow(/UTXO index|OP_VERIFY|EQUALVERIFY|non-truthy/);
    // The walk passes over it to the bound pool's coin.
    const txid = await spend(provider, reader, POOL_TIP.timestamp, true, [await coinOf(other), await coinOf(pool)]);
    expect(await recreatedPools(provider, txid)).toEqual([other, pool]);
  });
});
