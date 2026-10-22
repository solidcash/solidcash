import { describe, it, expect } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { buildPushdataCommitment, sha256 } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { authheadOutput } from '../../src/bcmr/authhead.js';
import {
  StatefulContract,
  createDataNftUnlocker,
  createDestroyDataNftUnlocker,
  createTokenContainerUnlocker,
  getDataNftAddress,
  getSatoshiContainerAddress,
  getTokenContainerAddress,
  type ConnectedStatefulContract,
} from '../../src/stateful/index.js';
import type { Output, TransactionDetails, Unlocker, Utxo } from '../../src/interfaces.js';
import { addressToLockScript } from '../../src/utils.js';
import { bobAddress, bobTokenAddress } from '../fixture/vars.js';
import { getTxOutputs } from '../test-util.js';

/**
 * AUTHHEAD-1, the selfdestruct path. A direct selfdestruct entry spends the minting master and recreates none, so the
 * transaction it authorizes could mint any NFT of its category C: a mutable one at C's BCMR authhead lock is a
 * look-alike identity, and a minting one at another lock hands that power on. A guard weaker than a sighash-ALL
 * signature, here a hashlock whose preimage is public once used, lets any caller add those outputs. The entry admits a
 * mutable or minting NFT of C only in place of the same-index input holding the same under the same lock: a record or
 * master carried through, as a write-path call or an intermediate destroy batch leaves it.
 */
const SOURCE = `
pragma solidcash >=0.8.0;

contract HashlockDestroy(bytes32 releaseHash) {
    int counter;

    function increment() {
        this.counter = this.counter + 1;
    }

    function destroy(bytes preimage) selfdestruct {
        require(sha256(preimage) == releaseHash);
    }
}
`;

const artifact = compileString(SOURCE);
const PREIMAGE = new TextEncoder().encode('released');
const FOREIGN = 'f00d'.repeat(16);
const FEE = 10_000n;
/** The VM refuses input 0, the master, as the mock or the builder's finalizer words it. */
const REFUSED = /(evaluating input index 0|\[covenant\] input 0):/;

interface Fixture {
  provider: MockNetworkProvider;
  deployed: ConnectedStatefulContract;
  categoryId: string;
  master: Utxo;
  records: Utxo[];
}

/** A master and `count` data NFTs of a fresh category. */
async function fixture(count: number): Promise<Fixture> {
  const provider = new MockNetworkProvider();
  const contract = new Contract(artifact, [sha256(PREIMAGE)], { provider });
  const stateLayout = artifact.stateLayout!;
  const { categoryId } = await provider.addTokenUtxosDynamic((cat: string) => {
    const salted = contract.withCategory(hexToBin(cat));
    return [
      { address: salted.tokenAddress, satoshis: 50_000n,
        token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
      ...Array.from({ length: count }, (_, counter) => ({
        address: getDataNftAddress(salted, cat), satoshis: 10_000n,
        token: { amount: 0n, nft: {
          capability: 'mutable' as const,
          commitment: buildPushdataCommitment(stateLayout, { counter: BigInt(counter) }, 0),
        } },
      })),
    ];
  });
  const deployed = StatefulContract.withCategory(contract, categoryId);
  const master = (await provider.getUtxos(deployed.tokenAddress)).find(
    (utxo) => utxo.token?.category === categoryId && utxo.token.nft?.capability === 'minting',
  )!;
  return { provider, deployed, categoryId, master, records: (await deployed.getFullState()).dataNftUtxos };
}

/**
 * The master and its first record at inputs 0 and 1, then `extra`. Bob's reclaim sits at output 1: the record's
 * destroy path refuses a token of C at its own index, so the outputs under test go at 0 and from 2 on.
 */
async function sendDestroy(
  fx: Fixture, [first, ...rest]: Output[], extra: Array<{ utxo: Utxo; unlocker: Unlocker }> = [],
): Promise<TransactionDetails> {
  const builder = new TransactionBuilder({ provider: fx.provider, allowImplicitNftBurn: true })
    .addInput(fx.master, fx.deployed.inner.unlock.destroy(PREIMAGE))
    .addInput(fx.records[0], createDestroyDataNftUnlocker(fx.deployed.inner, 0, fx.categoryId));
  for (const { utxo, unlocker } of extra) builder.addInput(utxo, unlocker);
  const spent = [fx.master, fx.records[0], ...extra.map(({ utxo }) => utxo)]
    .reduce((sum, utxo) => sum + utxo.satoshis, 0n);
  const paid = [first, ...rest].reduce((sum, output) => sum + output.amount, 0n);
  builder.addOutput(first);
  builder.addOutput({ to: bobAddress, amount: spent - paid - FEE });
  for (const output of rest) builder.addOutput(output);
  return builder.send();
}

const lookAlike = (fx: Fixture): Output => authheadOutput(fx.categoryId, addressToLockScript(bobAddress));
const minting = (fx: Fixture, to: string): Output => ({
  to, amount: 2_000n, token: { category: fx.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
});
const record = (fx: Fixture): Output => ({
  to: getDataNftAddress(fx.deployed.inner, fx.categoryId), amount: fx.records[0].satoshis, token: fx.records[0].token,
});

/** The master recreated at output 0 and `carried` at output 1, the first record's index; the record takes its write path. */
async function sendCarried(fx: Fixture, carried: Output): Promise<TransactionDetails> {
  const master = minting(fx, fx.deployed.tokenAddress);
  const spent = fx.master.satoshis + fx.records[0].satoshis;
  return new TransactionBuilder({ provider: fx.provider, allowImplicitNftBurn: true })
    .addInput(fx.master, fx.deployed.inner.unlock.destroy(PREIMAGE))
    .addInput(fx.records[0], createDataNftUnlocker(fx.deployed.inner, 0, fx.categoryId))
    .addOutput(master)
    .addOutput(carried)
    .addOutput({ to: bobAddress, amount: spent - master.amount - carried.amount - FEE })
    .send();
}

describe('AUTHHEAD-1: a selfdestruct mints no NFT of its own category', () => {
  it('refuses, at the master, a destroy that also mints a mutable NFT of C at the authhead lock', async () => {
    const fx = await fixture(1);
    await expect(sendDestroy(fx, [lookAlike(fx)])).rejects.toThrow(REFUSED);
  });

  it('refuses, at the master, a minting NFT of C moved off the master lock', async () => {
    const fx = await fixture(1);
    await expect(sendDestroy(fx, [minting(fx, bobTokenAddress)])).rejects.toThrow(REFUSED);
  });

  it('refuses a look-alike beside a master recreated at its own lock, and settles that shape without it', async () => {
    const fx = await fixture(1);
    await expect(sendDestroy(fx, [minting(fx, fx.deployed.tokenAddress), lookAlike(fx)])).rejects.toThrow(REFUSED);
    const tx = await sendDestroy(fx, [minting(fx, fx.deployed.tokenAddress)]);
    expect(getTxOutputs(tx)[0]).toMatchObject({
      to: fx.deployed.tokenAddress, token: { category: fx.categoryId, nft: { capability: 'minting' } },
    });
  });

  it('refuses, at the master, a look-alike standing in the place of a record', async () => {
    const fx = await fixture(1);
    await expect(sendCarried(fx, lookAlike(fx))).rejects.toThrow(REFUSED);
  });

  it('settles a record carried in place beside its master', async () => {
    const fx = await fixture(1);
    const tx = await sendCarried(fx, record(fx));
    expect(getTxOutputs(tx).slice(0, 2).map((output) => output.token?.nft?.capability)).toEqual(['minting', 'mutable']);
  });

  it('pays a foreign-category NFT out of a token container on a destroy', async () => {
    const fx = await fixture(1);
    const token = { category: FOREIGN, amount: 0n, nft: { capability: 'mutable' as const, commitment: 'ab' } };
    const container: Utxo = { txid: 'c3'.repeat(32), vout: 0, satoshis: 5_000n, token };
    await fx.provider.addUtxo(getTokenContainerAddress(fx.deployed.inner, fx.categoryId, FOREIGN), container);
    const unlocker = createTokenContainerUnlocker(fx.deployed.inner, 0, fx.categoryId, FOREIGN);
    const tx = await sendDestroy(fx, [{ to: bobTokenAddress, amount: 2_000n, token }], [{ utxo: container, unlocker }]);
    expect(getTxOutputs(tx)[0]).toMatchObject({ to: bobTokenAddress, token: { category: FOREIGN } });
  });

  it('settles the honest destroy in one transaction', async () => {
    const fx = await fixture(2);
    const result = await StatefulContract.destroy({
      provider: fx.provider, contract: fx.deployed, destroyFunctionName: 'destroy',
      destroyFunctionArgs: [PREIMAGE], recipient: bobAddress,
    });
    expect(result.txs.map((tx) => tx.inputs.length)).toEqual([3]);
    expect(getTxOutputs(result.txs[0]).map((output) => output.token)).toEqual([undefined]);
  });

  it('settles a batched destroy: each intermediate batch recreates the master, the containers go last', async () => {
    const fx = await fixture(5);
    const satoshiAddress = getSatoshiContainerAddress(fx.deployed.inner, fx.categoryId);
    for (const byte of ['c1', 'c2']) {
      await fx.provider.addUtxo(satoshiAddress, { txid: byte.repeat(32), vout: 0, satoshis: 20_000n });
    }
    // 1 master + 5 records + 2 containers over a 4-input limit: [master + 3], [master + 1], [master, record, c1, c2].
    const result = await StatefulContract.destroy({
      provider: fx.provider, contract: fx.deployed, destroyFunctionName: 'destroy',
      destroyFunctionArgs: [PREIMAGE], recipient: bobAddress, maxInputsPerTx: 4,
    });
    expect(result.txs.map((tx) => tx.inputs.length)).toEqual([4, 2, 4]);
    const kept = result.txs.map((tx) => getTxOutputs(tx)
      .filter((output) => output.token?.category === fx.categoryId)
      .map((output) => [output.to, output.token?.nft?.capability]));
    const master = [fx.deployed.tokenAddress, 'minting'];
    expect(kept).toEqual([[master], [master], []]);
    expect(await fx.provider.getUtxos(satoshiAddress)).toEqual([]);
  });
});
