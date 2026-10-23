import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract, SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import type { Utxo } from '../../src/interfaces.js';
import * as messageBus from '../../src/message-bus/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { ContractBundle, StatefulContract } from '../../src/stateful/index.js';
import { aliceAddress, alicePkh, alicePriv, alicePub, bobPriv } from '../fixture/vars.js';
import { MESSAGE_BUS_SEMANTIC_TEST_PROFILE } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { setupStatefulUtxos } from '../test-util.js';

/**
 * A contract-driven child genesis proves each coin that becomes a child category before anything is signed (the
 * SDKFRAMED-1 shape): every `deployFrom` funding coin, and every compose child-deployment coin. The coin is read
 * from the transaction the provider serves for it, which must hash to its txid, or from the simulator's own ledger;
 * it must sit at its funder's own lock with the listed value and no token, else nothing is broadcast.
 */

const DEPLOY_FROM_SOURCE = `
  contract Leaf() {
    bytes20 owner;
    int counter;
    constructor(bytes20 initialOwner) { this.owner = initialOwner; this.counter = 1; }
    function bump() { this.counter = this.counter + 1; require(true); }
  }
  contract Maker(pubkey makerOwner) {
    int made;
    function make(sig s, bytes20 leafOwner) {
      require(checkSig(s, makerOwner));
      Leaf leaf = new Leaf(leafOwner);
      this.made = this.made + 1;
    }
  }
`;

const COMPOSE_SOURCE = `
  contract Leaf(int seed) {
    int marker;
    function keep() public { require(true); }
  }
  interface IMaker { function make(int seed); }
  contract Maker() {
    function make(int seed) public {
      Leaf leaf = new Leaf(seed);
      require(true);
    }
  }
  contract Caller(address maker) {
    function run(int seed) public {
      IMaker(maker).make(seed);
      require(true);
    }
  }
`;

const deployFromArtifacts = compileStringMulti(DEPLOY_FROM_SOURCE);
const composeArtifacts = compileStringMulti(COMPOSE_SOURCE, {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
});

const alice = new SignatureTemplate(alicePriv);
const bob = new SignatureTemplate(bobPriv);

/** A mock that can serve other bytes as a transaction, and counts the broadcasts it is asked for. */
class WatchedProvider extends MockNetworkProvider {
  public readonly served = new Map<string, string>();

  public broadcasts = 0;

  override async getRawTransaction(txid: string): Promise<string> {
    return this.served.get(txid) ?? super.getRawTransaction(txid);
  }

  override async sendRawTransaction(txHex: string): Promise<string> {
    this.broadcasts += 1;
    return super.sendRawTransaction(txHex);
  }
}

let serial = 0;

/** A synthetic vout-0 coin the mock ledger holds at `owner`'s lock, backed by no transaction. */
async function ledgerCoin(provider: MockNetworkProvider, owner: SignatureTemplate, satoshis = 200_000n): Promise<Utxo> {
  serial += 1;
  const utxo = { txid: `c7${serial.toString(16).padStart(6, '0')}`.padEnd(64, 'f'), vout: 0, satoshis };
  await provider.addUtxo(binToHex(owner.unlockP2PKH().generateLockingBytecode()), utxo);
  return utxo;
}

/** A vout-0 coin at `owner`'s lock, created by a real transaction the mock serves; `token` puts one on it. */
async function realCoin(provider: MockNetworkProvider, owner: SignatureTemplate, token = false): Promise<Utxo> {
  const source = await ledgerCoin(provider, owner);
  const satoshis = source.satoshis - 2_000n;
  const builder = new TransactionBuilder({ provider });
  builder.addInput(source, owner.unlockP2PKH());
  if (!token) {
    builder.addOutput({ to: owner.unlockP2PKH().generateLockingBytecode(), amount: satoshis });
    const sent = await builder.send();
    return { txid: sent.txid, vout: 0, satoshis };
  }
  // A token minted at output 0 makes that coin its category's BCMR identity output, which no genesis may spend, so it
  // is minted at output 1 and moved to output 0 of a transaction that creates no category.
  const minted = { category: source.txid, amount: 1_000n };
  builder.addOutput({ to: owner.unlockP2PKH().generateLockingBytecode(), amount: 1_000n });
  builder.addOutput({ to: owner.unlockP2PKH().generateLockingBytecode(), amount: satoshis - 1_000n, token: minted });
  const mint = await builder.send();
  const move = new TransactionBuilder({ provider });
  move.addInput({ txid: mint.txid, vout: 1, satoshis: satoshis - 1_000n, token: minted }, owner.unlockP2PKH());
  move.addOutput({ to: owner.unlockP2PKH().generateLockingBytecode(), amount: satoshis - 3_000n, token: minted });
  const sent = await move.send();
  return { txid: sent.txid, vout: 0, satoshis: satoshis - 3_000n };
}

/** Coins listed as alice's, with alice signing for them, that a child genesis must refuse. */
const FORGED: ReadonlyArray<{
  readonly name: string;
  readonly refusal: RegExp;
  readonly coin: (provider: WatchedProvider) => Promise<Utxo>;
}> = [
  {
    name: 'whose served transaction does not hash to its txid',
    refusal: /the bytes served for [0-9a-f]{64} do not hash to it/,
    coin: async (provider) => {
      const foreign = await realCoin(provider, bob);
      // Alice's own transaction pays the same value at her lock: only its hash gives it away.
      const own = await realCoin(provider, alice);
      expect(own.satoshis).toBe(foreign.satoshis);
      provider.served.set(foreign.txid, await provider.getRawTransaction(own.txid));
      return foreign;
    },
  },
  {
    name: 'that sits at another lock',
    refusal: /sits at [0-9a-f]+, not the funder's own lock/,
    coin: async (provider) => realCoin(provider, bob),
  },
  {
    name: 'that carries a token the listing omits',
    refusal: /carries a token, so it cannot fund a genesis/,
    coin: async (provider) => realCoin(provider, alice, true),
  },
  {
    name: 'listed with a value its transaction does not carry',
    refusal: /holds \d+ satoshis, not the \d+ the provider listed/,
    coin: async (provider) => {
      const own = await realCoin(provider, alice);
      return { ...own, satoshis: own.satoshis + 1_000n };
    },
  },
];

async function expectNoGenesis(provider: WatchedProvider, coin: Utxo, broadcastsBefore: number): Promise<void> {
  expect(provider.broadcasts).toBe(broadcastsBefore);
  expect(await provider.getUtxosByTokenCategory(coin.txid)).toStrictEqual([]);
}

describe('audit: a deployFrom child genesis proves each funding coin before signing', () => {
  const makerSetup = async (): Promise<{ readonly provider: WatchedProvider; readonly maker: StatefulContract }> => {
    const provider = new WatchedProvider();
    const bundle = ContractBundle.from(deployFromArtifacts, { provider });
    const { contract: maker } = await bundle.deploy('Maker', [alicePub], {
      fundingUtxo: await ledgerCoin(provider, alice), funder: alice.unlockP2PKH(),
      initialState: { made: 0n }, changeAddress: aliceAddress,
    });
    return { provider, maker };
  };
  const deployFrom = (
    provider: WatchedProvider, maker: StatefulContract, fundingUtxo: Utxo,
  ): ReturnType<typeof StatefulContract.deployFrom> => StatefulContract.deployFrom({
    provider, factory: maker, deployFunctionName: 'make', deployFunctionArgs: [alice, alicePkh],
    fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: aliceAddress,
  });

  it('deploys a child honestly from a real coin at the funder\'s own lock', async () => {
    const { provider, maker } = await makerSetup();
    const coin = await realCoin(provider, alice);
    const result = await deployFrom(provider, maker, coin);
    expect(result.childCategoryId).toBe(coin.txid);
    expect((await provider.getUtxosByTokenCategory(coin.txid)).length).toBeGreaterThan(0);
  }, 120_000);

  it.each(FORGED)('refuses a funding coin $name, with nothing broadcast', async ({ refusal, coin }) => {
    const { provider, maker } = await makerSetup();
    const listed = await coin(provider);
    const before = provider.broadcasts;
    await expect(deployFrom(provider, maker, listed)).rejects.toThrow(refusal);
    await expectNoGenesis(provider, listed, before);
  }, 120_000);
});

describe('audit: a compose child deployment proves its genesis coin before signing', () => {
  const composeSetup = async (): Promise<{
    readonly provider: WatchedProvider;
    readonly composition: (genesis: Utxo) => ReturnType<typeof messageBus.compose>;
  }> => {
    const provider = new WatchedProvider({
      consensusLimits: { ...MESSAGE_BUS_SEMANTIC_TEST_PROFILE.consensusLimits },
      policy: { ...MESSAGE_BUS_SEMANTIC_TEST_PROFILE.policy },
    });
    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const maker = (await connect(composeArtifacts.Maker)).registerChild(composeArtifacts.Leaf);
    const caller = await connect(composeArtifacts.Caller, [hexToBin(maker.inner.lockingBytecode)]);
    const fee = { utxo: await ledgerCoin(provider, alice, 1_000_000n), unlocker: alice.unlockP2PKH() };
    const composition = (genesis: Utxo): ReturnType<typeof messageBus.compose> => messageBus.compose({
      preparedCalls: [
        { contract: caller, functionName: 'run', args: [7n] },
        { contract: maker, functionName: 'make', args: [7n] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      childDeployments: [{ invocationIndex: 1, siteIndex: 0, funder: { utxo: genesis, unlocker: alice.unlockP2PKH() } }],
    });
    return { provider, composition };
  };

  it('deploys a child honestly from a simulator coin at the funder\'s own lock', async () => {
    const { provider, composition } = await composeSetup();
    const coin = await ledgerCoin(provider, alice, 20_000n);
    await expect(composition(coin).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect((await provider.getUtxosByTokenCategory(coin.txid)).length).toBeGreaterThan(0);
  }, 120_000);

  it.each(FORGED)('refuses a genesis coin $name, with nothing broadcast', async ({ refusal, coin }) => {
    const { provider, composition } = await composeSetup();
    const listed = await coin(provider);
    const before = provider.broadcasts;
    await expect(composition(listed).send()).rejects.toThrow(refusal);
    await expectNoGenesis(provider, listed, before);
  }, 120_000);
});
