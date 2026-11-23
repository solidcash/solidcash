import { binToHex, encodeTransaction } from '@bitauth/libauth';
import { encodeEventCommitment } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate, TransactionBuilder } from '../../src/index.js';
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
import { buildDestroyTransactionHex } from '../../src/stateful/sc-destroy.js';
import { aliceAddress, alicePriv, alicePub } from '../fixture/vars.js';
import { addProvenUtxo, setupStatefulUtxos } from '../test-util.js';

/**
 * An event NFT's covenant lets anyone spend it once its 144-block relative lock matures and constrains no output, so
 * the spender can recreate it unchanged at its event address under a new outpoint. A read counts a coin only when its
 * transaction spent the contract's minting master, which an emit recreates and a selfdestruct burns: the copy spends
 * none, so it is not an event.
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

const CLOSABLE = `pragma solidcash >=0.8.0;
contract Closable(pubkey admin) {
  event Closed(bigint value);
  bigint counter;
  function bump(bigint x) {
    this.counter = this.counter + x;
    require(x > 0);
  }
  function destroy(sig s) selfdestruct {
    require(checkSig(s, admin));
    emit Closed(this.counter);
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

/** A fee coin with a transaction behind it: a read looks at what a master-less transaction's inputs spent. */
async function feeCoin(provider: MockNetworkProvider, satoshis: bigint): Promise<{ utxo: Utxo; unlocker: Unlocker }> {
  return {
    utxo: await addProvenUtxo(provider, aliceAddress, satoshis),
    unlocker: new SignatureTemplate(alicePriv).unlockP2PKH(),
  };
}

/** Matures `coin`, then spends it into an unchanged copy at `address` in a hand-built version-2 transaction. */
async function replay(
  provider: MockNetworkProvider, coin: Utxo, unlocker: Unlocker, address: string,
): Promise<string> {
  // Every send mines a block on the mock, so the age is counted from the indexer's own tip.
  await provider.mineUpTo(provider.indexer.getTip()!.height + 144);
  const fee = await feeCoin(provider, 2_000n);
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

  it('counts the event a selfdestruct emits, which burns the master, and never its copy', async () => {
    const closable = compileString(CLOSABLE);
    const provider = new MockNetworkProvider();
    const contract = new Contract(closable, [alicePub], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, closable.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const sc: any = StatefulContract.withCategory(contract, categoryId);
    // A call first, so the master the destroy spends has a transaction behind it.
    await sc.bump(5n).send();
    const { masterUtxo, dataNftUtxos } = await sc.getFullState();
    const { builder } = await buildDestroyTransactionHex(
      sc, categoryId, undefined, aliceAddress, [masterUtxo],
      dataNftUtxos.map((utxo: Utxo) => ({ utxo, kind: 'data' as const })),
      'destroy', [new SignatureTemplate(alicePriv)], true,
    );
    // The destroy sweep places no event output, so the emit's slot is filled here.
    const address = getEventNftAddress(sc.inner, categoryId, 'Closed');
    const eventSlot = closable.abi.find((entry) => entry.name === 'destroy')!.blockLayout!.slots
      .find((slot) => slot.kind === 'event')!.offset;
    const closed = closable.events!.find((event) => event.name === 'Closed')!;
    const fee = await feeCoin(provider, 20_000n);
    builder.addInput(fee.utxo, fee.unlocker);
    while (builder.outputs.length < eventSlot) builder.addOutput({ to: aliceAddress, amount: 1_000n });
    builder.addOutput({
      to: address,
      amount: 1_000n,
      token: {
        category: categoryId,
        amount: 0n,
        nft: { capability: 'none', commitment: binToHex(encodeEventCommitment(closed.parameters, [5n])) },
      },
    });
    const destroy = builder.buildLibauthTransaction();
    expect(destroy.outputs.some((output) => output.token?.nft?.capability === 'minting')).toBe(false);
    await provider.sendRawTransaction(binToHex(encodeTransaction(destroy)));

    const read = async (): Promise<bigint[]> => (await sc.queryFilter('Closed')).map((log: any) => log.args.value);
    expect(await read()).toEqual([5n]);

    const listed = await provider.getUtxos(address);
    expect(listed).toHaveLength(1);
    await replay(provider, listed[0], createEventNftUnlocker(sc.inner, categoryId, 'Closed'), address);
    expect(await read()).toEqual([]);
  });

  it('refuses a read whose provider serves no transaction for an event coin', async () => {
    const { provider, sc } = await deploy();
    await sc.deposit(5n).send();
    provider.getRawTransaction = async (): Promise<string> => { throw new Error('no transaction index'); };
    await expect(sc.queryFilter('Deposited')).rejects.toThrow(EventProvenanceError);
  });
});
