import { describe, expect, it } from 'vitest';
import { Signer, TransactionBuilder } from '../../src/index.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import { StatefulContract, getContractFactory } from '../../src/stateful/index.js';
import { compileString } from '../direct-compile.js';

/**
 * A direct (non-framed) stateful deploy proves its genesis coin before anything is signed (the SDKFRAMED-1 shape).
 *
 * A genesis takes its category from the funding coin's txid, so a coin a provider lists at the deployer's address
 * but that sits at another lock would hand the category to that lock's owner. The coin is read from the transaction
 * the provider serves for it, which must hash to its txid, or from the simulator's own ledger; anything else is
 * refused before signing and nothing is broadcast.
 */

const TALLY_SOURCE = `
pragma solidcash >=0.8.0;

contract Tally() {
    bigint count;

    function bump() {
        this.count = this.count + 1;
    }
}
`;

const tally = compileString(TALLY_SOURCE);

const DEPLOYER_KEY = new Uint8Array(32).fill(0xd1);
const OTHER_KEY = new Uint8Array(32).fill(0xd2);

let serial = 0;

/** A synthetic vout-0 coin the mock ledger holds at `address`, backed by no transaction. */
async function ledgerCoin(provider: MockNetworkProvider, address: string, satoshis = 5_000_000n): Promise<Utxo> {
  serial += 1;
  const utxo = { txid: `d5${serial.toString(16).padStart(6, '0')}`.padEnd(64, 'e'), vout: 0, satoshis };
  await provider.addUtxo(address, utxo);
  return utxo;
}

/** A vout-0 coin at `signer`'s own lock, created by a real transaction the mock serves; `token` puts one on it. */
async function realCoin(provider: MockNetworkProvider, signer: Signer, token = false): Promise<Utxo> {
  const source = await ledgerCoin(provider, signer.getAddress());
  const satoshis = source.satoshis - 2_000n;
  const builder = new TransactionBuilder({ provider });
  builder.addInput(source, signer.unlockP2PKH());
  if (!token) {
    builder.addOutput({ to: signer.getLockingBytecode(), amount: satoshis });
    const sent = await builder.send();
    return { txid: sent.txid, vout: 0, satoshis };
  }
  // A token minted at output 0 makes that coin its category's BCMR identity output, which no genesis may spend, so it
  // is minted at output 1 and moved to output 0 of a transaction that creates no category.
  const minted = { category: source.txid, amount: 1_000n };
  builder.addOutput({ to: signer.getLockingBytecode(), amount: 1_000n });
  builder.addOutput({ to: signer.getLockingBytecode(), amount: satoshis - 1_000n, token: minted });
  const mint = await builder.send();
  const move = new TransactionBuilder({ provider });
  move.addInput({ txid: mint.txid, vout: 1, satoshis: satoshis - 1_000n, token: minted }, signer.unlockP2PKH());
  move.addOutput({ to: signer.getLockingBytecode(), amount: satoshis - 3_000n, token: minted });
  const sent = await move.send();
  return { txid: sent.txid, vout: 0, satoshis: satoshis - 3_000n };
}

interface Listing {
  /** Bytes served as the listed coin's transaction. */
  readonly served?: string;
  /** Report the provider as no in-process simulator. */
  readonly notSimulator?: boolean;
}

/** A provider that lists `listed` as the only coin at `address`, and counts the broadcasts it is asked for. */
function listingProvider(
  provider: MockNetworkProvider, address: string, listed: Utxo, listing: Listing = {},
): { readonly provider: NetworkProvider; readonly broadcasts: () => number } {
  let count = 0;
  const wrapped = new Proxy(provider, {
    get(target, key): unknown {
      if (key === 'getUtxos') {
        return async (at: string): Promise<Utxo[]> => (at === address ? [listed] : target.getUtxos(at));
      }
      const { served } = listing;
      if (key === 'getRawTransaction' && served !== undefined) {
        return async (txid: string): Promise<string> => (txid === listed.txid ? served : target.getRawTransaction(txid));
      }
      if (key === 'simulator' && listing.notSimulator === true) return false;
      const value: unknown = Reflect.get(target, key, target);
      if (key === 'sendRawTransaction' || key === 'sendPreparedTransaction') {
        const send = value as (...args: unknown[]) => Promise<string>;
        return async (...args: unknown[]): Promise<string> => {
          count += 1;
          return send.apply(target, args);
        };
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { provider: wrapped, broadcasts: () => count };
}

async function expectNoGenesis(provider: MockNetworkProvider, coin: Utxo): Promise<void> {
  expect(await provider.getUtxosByTokenCategory(coin.txid)).toStrictEqual([]);
}

const LOCK_REFUSAL = /sits at [0-9a-f]+, not the funder's own lock/;

describe('audit: a direct stateful deploy proves its genesis coin at the deployer\'s own lock before signing', () => {
  it('deploys honestly from a real coin and from a simulator coin at the deployer\'s own lock', async () => {
    const provider = new MockNetworkProvider();
    const deployer = new Signer(DEPLOYER_KEY, provider);
    const own = await realCoin(provider, deployer);
    const fromReal = await getContractFactory(tally, deployer).deploy() as unknown as { readonly categoryId: string };
    expect(fromReal.categoryId).toBe(own.txid);
    expect((await provider.getUtxosByTokenCategory(own.txid)).length).toBeGreaterThan(0);

    const owner = new Signer(OTHER_KEY, provider);
    const coin = await ledgerCoin(provider, owner.getAddress());
    const fromLedger = await StatefulContract.deploy(tally, [], {
      provider, fundingUtxo: coin, funder: owner.unlockP2PKH(), changeAddress: owner.getAddress(),
    });
    expect(fromLedger.categoryId).toBe(coin.txid);
    expect((await provider.getUtxosByTokenCategory(coin.txid)).length).toBeGreaterThan(0);
  });

  it('refuses a listed coin whose served transaction does not hash to its txid', async () => {
    const provider = new MockNetworkProvider();
    const deployer = new Signer(DEPLOYER_KEY, provider);
    const foreign = await realCoin(provider, new Signer(OTHER_KEY, provider));
    // The deployer's own transaction pays the same value at the deployer's lock: only its hash gives it away.
    const own = await realCoin(provider, deployer);
    expect(own.satoshis).toBe(foreign.satoshis);
    const listing = listingProvider(
      provider, deployer.getAddress(), foreign, { served: await provider.getRawTransaction(own.txid) });

    await expect(getContractFactory(tally, new Signer(DEPLOYER_KEY, listing.provider)).deploy())
      .rejects.toThrow(`the bytes served for ${foreign.txid} do not hash to it`);
    expect(listing.broadcasts()).toBe(0);
    await expectNoGenesis(provider, foreign);
  });

  it('refuses a real coin listed at the deployer that sits at another lock', async () => {
    const provider = new MockNetworkProvider();
    const other = new Signer(OTHER_KEY, provider);
    const foreign = await realCoin(provider, other);
    const listing = listingProvider(provider, new Signer(DEPLOYER_KEY, provider).getAddress(), foreign);

    await expect(getContractFactory(tally, new Signer(DEPLOYER_KEY, listing.provider)).deploy())
      .rejects.toThrow(LOCK_REFUSAL);
    expect(listing.broadcasts()).toBe(0);
    await expectNoGenesis(provider, foreign);
    expect((await provider.getUtxos(other.getAddress())).map((utxo) => utxo.txid)).toContain(foreign.txid);
  });

  it('refuses a simulator coin passed as the deployer\'s that the ledger holds at another lock', async () => {
    const provider = new MockNetworkProvider();
    const deployer = new Signer(DEPLOYER_KEY, provider);
    const foreign = await ledgerCoin(provider, new Signer(OTHER_KEY, provider).getAddress());
    const listing = listingProvider(provider, deployer.getAddress(), foreign);

    await expect(StatefulContract.deploy(tally, [], {
      provider: listing.provider, fundingUtxo: foreign, funder: deployer.unlockP2PKH(),
      changeAddress: deployer.getAddress(),
    })).rejects.toThrow(LOCK_REFUSAL);
    expect(listing.broadcasts()).toBe(0);
    await expectNoGenesis(provider, foreign);
  });

  it('refuses the deployer\'s own coin when its transaction carries a token the listing omits', async () => {
    const provider = new MockNetworkProvider();
    const deployer = new Signer(DEPLOYER_KEY, provider);
    const own = await realCoin(provider, deployer, true);
    const listing = listingProvider(provider, deployer.getAddress(), own);

    await expect(getContractFactory(tally, new Signer(DEPLOYER_KEY, listing.provider)).deploy())
      .rejects.toThrow(/carries a token, so it cannot fund a genesis/);
    expect(listing.broadcasts()).toBe(0);
    await expectNoGenesis(provider, own);
  });

  it('refuses the deployer\'s own coin listed with a value its transaction does not carry', async () => {
    const provider = new MockNetworkProvider();
    const deployer = new Signer(DEPLOYER_KEY, provider);
    const own = await realCoin(provider, deployer);
    const listing = listingProvider(provider, deployer.getAddress(), { ...own, satoshis: own.satoshis + 1_000n });

    await expect(getContractFactory(tally, new Signer(DEPLOYER_KEY, listing.provider)).deploy())
      .rejects.toThrow(/holds \d+ satoshis, not the \d+ the provider listed/);
    expect(listing.broadcasts()).toBe(0);
    await expectNoGenesis(provider, own);
  });

  it('fails closed on a provider that serves no transaction for the coin and is no simulator', async () => {
    const provider = new MockNetworkProvider();
    const deployer = new Signer(DEPLOYER_KEY, provider);
    const own = await ledgerCoin(provider, deployer.getAddress());
    const listing = listingProvider(provider, deployer.getAddress(), own, { notSimulator: true });

    await expect(StatefulContract.deploy(tally, [], {
      provider: listing.provider, fundingUtxo: own, funder: deployer.unlockP2PKH(),
      changeAddress: deployer.getAddress(),
    })).rejects.toThrow(`the provider served no transaction for ${own.txid}`);
    expect(listing.broadcasts()).toBe(0);
    await expectNoGenesis(provider, own);
  });
});
