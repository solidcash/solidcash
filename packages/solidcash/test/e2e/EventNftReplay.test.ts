import { binToHex, encodeTransaction } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import type { Unlocker, Utxo } from '../../src/interfaces.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import {
  EventProvenanceError,
  StatefulContract,
  createAnonymousEventNftUnlocker,
  createEventNftUnlocker,
  getAnonymousEventNftAddress,
  getEventNftAddress,
} from '../../src/stateful/index.js';
import { EVENT_NFT_RELATIVE_LOCK_SEQUENCE } from '../../src/stateful/covenant-helpers.js';
import { createFeeFunder, setupStatefulUtxos } from '../test-util.js';

/**
 * An event NFT's covenant lets anyone spend it once its 144-block relative lock matures and constrains no output, so
 * the spender can recreate it unchanged at its event address under a new outpoint. A read counts a coin only when its
 * transaction also outputs the category's minting NFT, as every emit's does: the copy is not an event.
 */
const SOURCE = `pragma solidcash >=0.8.0;
contract Deposits() {
  event Deposited(bigint amount);
  event Noted(bigint amount) anonymous;
  bigint counter;
  function deposit(bigint amount) {
    emit Deposited(amount);
    this.counter = this.counter + amount;
  }
  function depositQuietly(bigint amount) {
    this.counter = this.counter + amount;
    emit Noted(amount);
  }
}`;

const artifact = compileString(SOURCE);

async function deploy(): Promise<{ provider: MockNetworkProvider; sc: any }> {
  const provider = new MockNetworkProvider();
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  return { provider, sc: new StatefulContract(categoryId, artifact, provider) };
}

/** Matures `coin`, then spends it into an unchanged copy at `address` in a hand-built version-2 transaction. */
async function replay(
  provider: MockNetworkProvider, coin: Utxo, unlocker: Unlocker, address: string,
): Promise<string> {
  // Every send mines a block on the mock, so the age is counted from the indexer's own tip.
  await provider.mineUpTo(provider.indexer.getTip()!.height + 144);
  const fee = await createFeeFunder(provider, 2_000n);
  const builder = new TransactionBuilder({ provider })
    .addInput(coin, unlocker, { sequence: EVENT_NFT_RELATIVE_LOCK_SEQUENCE })
    .addInput(fee.utxo, fee.unlocker)
    .addOutput({ to: address, amount: coin.satoshis, token: coin.token });
  return provider.sendRawTransaction(binToHex(encodeTransaction(builder.buildLibauthTransaction())));
}

describe('a swept and recreated event NFT is not an event', () => {
  it('counts a named event once, never its copy, and still counts the next emit', async () => {
    const { provider, sc } = await deploy();
    const address = getEventNftAddress(sc.inner, sc.categoryId, 'Deposited');
    // What an app crediting deposits keeps: each event it has read, by outpoint.
    const credited = new Map<string, bigint>();
    const read = async (): Promise<bigint[]> => {
      const logs = await sc.queryFilter('Deposited');
      for (const log of logs) credited.set(`${log.txid}:${log.vout}`, log.args.amount);
      return logs.map((log: any) => log.args.amount);
    };

    await sc.deposit(5n).send();
    expect(await read()).toEqual([5n]);

    const listed = await provider.getUtxos(address);
    expect(listed).toHaveLength(1);
    const copyTxid = await replay(
      provider, listed[0], createEventNftUnlocker(sc.inner, sc.categoryId, 'Deposited'), address,
    );
    const copies = await provider.getUtxos(address);
    expect(copies.map((coin) => coin.txid)).toEqual([copyTxid]);
    expect(copies[0].token).toEqual(listed[0].token);
    expect(await read()).toEqual([]);

    await sc.deposit(7n).send();
    expect(await read()).toEqual([7n]);
    expect([...credited.values()]).toEqual([5n, 7n]);
  });

  it('counts an anonymous event once, never its copy, and still counts the next emit', async () => {
    const { provider, sc } = await deploy();
    const address = getAnonymousEventNftAddress(sc.inner, sc.categoryId);
    const read = async (): Promise<bigint[]> => (await sc.queryEvents('Noted')).map((event: any) => event.values.amount);

    await sc.depositQuietly(5n).send();
    expect(await read()).toEqual([5n]);

    const listed = await provider.getUtxos(address);
    expect(listed).toHaveLength(1);
    const copyTxid = await replay(
      provider, listed[0], createAnonymousEventNftUnlocker(sc.inner, sc.categoryId), address,
    );
    const copies = await provider.getUtxos(address);
    expect(copies.map((coin) => coin.txid)).toEqual([copyTxid]);
    expect(copies[0].token).toEqual(listed[0].token);
    expect(await read()).toEqual([]);

    await sc.depositQuietly(7n).send();
    expect(await read()).toEqual([7n]);
  });

  it('refuses a read whose provider serves no transaction for an event coin', async () => {
    const { provider, sc } = await deploy();
    await sc.deposit(5n).send();
    provider.getRawTransaction = async (): Promise<string> => { throw new Error('no transaction index'); };
    await expect(sc.queryFilter('Deposited')).rejects.toThrow(EventProvenanceError);
  });
});
