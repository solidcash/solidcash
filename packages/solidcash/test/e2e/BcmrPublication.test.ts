/**
 * The publication output, the registry, later updates and the SDK surface (docs/bcmr/DESIGN.md 5.1, 5.2, 5.4 and
 * section 10). Expected bytes are built from the spec's text, not from the SDK's own helpers.
 */
// cspell:ignore XDOL
import { createHash } from 'node:crypto';
import { binToHex, hexToBin, utf8ToBin, type NftCategory } from '@bitauth/libauth';
import { compileFile } from '@solidcash/solidc';
import { describe, expect, it, vi } from 'vitest';
import {
  publishMetadata, withSnapshot, type IdentityAction, type IdentityRecord, type MetadataRegistry,
  type PublishMetadataOptions,
} from '../../src/bcmr/index.js';
import type { TransactionDetails, Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import Signer from '../../src/Signer.js';
import { ContractFactory, StatefulContract } from '../../src/stateful/index.js';
import { compileString } from '../direct-compile.js';
import { bobPriv } from '../fixture/vars.js';

const COUNTER = `pragma solidcash >=0.8.0;
contract Counter() {
  int count;
  function bump() { this.count = this.count + 1; require(this.count > 0); }
}`;

const TOKEN = new URL('../fixture/bcmr_metadata_token.scash', import.meta.url);
const T0 = '2026-10-20T12:00:00.000Z';
const T1 = '2026-10-21T12:00:00.000Z';
// The locking bytecode prefix of a publication output (R3).
const PUBLICATION_PREFIX = '6a0442434d52';
// An HTTPS URI is pushed without its protocol (R6).
const URI = 'https://example.org';
const PUSHED_URI = 'example.org';
// One labelled NFT type: enough for the contract identity to carry a token.
const STATE_NFTS: NftCategory = { parse: { types: { '01': { name: 'Ledger state' } } } };

const counter = compileString(COUNTER, { forceStateful: true });
const tokenArtifact = compileFile(TOKEN, { messageBus: false });

function sha256(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(bytes).digest());
}

// P2SH32 of the one-byte redeem script OP_RETURN (4.2).
const FROZEN_LOCK = `aa20${binToHex(sha256(sha256(Uint8Array.of(0x6a))))}87`;

/** A direct push of fewer than 76 bytes. */
function push(data: Uint8Array): string {
  return binToHex(Uint8Array.of(data.length)) + binToHex(data);
}

/**
 * The authhead contract of `category`: P2SH32 of the push of the category in the VM's order with the mutable
 * capability, then the body the design spells out (4.2).
 */
function authheadLockHex(category: string): string {
  const body = '00d18800d39169c3529d51c09476ce0088c7c0cf8800cd76c0c78778016a879b7c016aaa02aa207c7e01877e879b';
  const redeemScript = hexToBin(`${push(Uint8Array.from([...hexToBin(category).reverse(), 0x01]))}${body}`);
  return `aa20${binToHex(sha256(sha256(redeemScript)))}87`;
}

/** Output 0 holds the identity NFT of `category` for `owner` at `lockHex`. */
function expectIdentityNft(
  output: TransactionDetails['outputs'][number] | undefined, category: string, owner: Uint8Array, lockHex: string,
): void {
  expect(binToHex(output!.lockingBytecode)).toBe(lockHex);
  expect(binToHex(output!.token!.category)).toBe(category);
  expect(output!.token!.nft?.capability).toBe('mutable');
  expect(binToHex(output!.token!.nft!.commitment)).toBe(binToHex(owner));
}

/** `OP_RETURN <'BCMR'> <sha256(bytes)> <uri>`, the raw digest in OP_SHA256 byte order (5.1). */
function publicationHex(bytes: Uint8Array, pushedUri: string): string {
  return `6a${push(utf8ToBin('BCMR'))}${push(sha256(bytes))}${push(utf8ToBin(pushedUri))}`;
}

/** True when `tx` spends output 0 of `txid`, so it extends that authchain (R1). */
function spendsOutputZero(tx: TransactionDetails, txid: string): boolean {
  return tx.inputs.some((input) => input.outpointIndex === 0 && binToHex(input.outpointTransactionHash) === txid);
}

function isLive(coins: readonly Utxo[], txid: string, vout: number): boolean {
  return coins.some((utxo) => utxo.txid === txid && utxo.vout === vout);
}

async function signerWithCoins(provider: MockNetworkProvider, coins = 3): Promise<Signer> {
  const [alice] = await provider.getSigners(1, { fundingUtxos: coins, genesisFundingUtxos: coins });
  return alice as unknown as Signer;
}

async function genesisCoin(signer: Signer, skip: readonly Utxo[] = []): Promise<Utxo> {
  const coin = (await signer.getUtxos()).find((utxo) => utxo.vout === 0 && utxo.token === undefined
    && utxo.satoshis >= 100_000n && !skip.some((other) => other.txid === utxo.txid));
  if (coin === undefined) throw new Error('no genesis coin left');
  return coin;
}

/** The signer's largest token-free coin. */
async function ownerCoin(signer: Signer): Promise<Utxo> {
  const coins = (await signer.getUtxos())
    .filter((utxo) => utxo.token === undefined)
    .sort((left, right) => (left.satoshis > right.satoshis ? -1 : 1));
  return coins[0]!;
}

interface Published {
  readonly provider: MockNetworkProvider;
  readonly alice: Signer;
  readonly category: string;
  readonly genesis: TransactionDetails;
  readonly identity: IdentityRecord;
  readonly registry: MetadataRegistry;
}

/** A Counter whose genesis publishes a registry, its identity owned by alice. */
async function publishedCounter(coins?: number): Promise<Published> {
  const provider = new MockNetworkProvider();
  const alice = await signerWithCoins(provider, coins);
  const deployed = await StatefulContract.deploy(counter, [], {
    provider, fundingUtxo: await genesisCoin(alice), funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
    initialState: {}, bcmr: { name: 'Counter', timestamp: T0, publicationUris: [URI] },
  });
  return {
    provider, alice, category: deployed.categoryId, genesis: deployed.tx, identity: deployed.identity!,
    registry: deployed.registry!.registry,
  };
}

/** What every spend of `published` states: the identity and alice's coin, which authorizes and pays. */
async function updateOf(
  published: Published,
): Promise<Omit<PublishMetadataOptions, 'registry' | 'publicationUris' | 'action'>> {
  const { provider, alice, identity } = published;
  return {
    provider, identity, owner: { utxo: await ownerCoin(alice), unlocker: alice.unlockP2PKH() },
    changeAddress: alice.getAddress(),
  };
}

interface TokenDeployment {
  readonly contract: string;
  readonly token: string;
  readonly tx: TransactionDetails;
  readonly registry: MetadataRegistry;
}

/** The ledger token deployed with a bearer category X of its own beside the contract's C. */
async function deployToken(nfts?: NftCategory): Promise<TokenDeployment> {
  const provider = new MockNetworkProvider();
  const alice = await signerWithCoins(provider, 4);
  const funding = await genesisCoin(alice);
  const token = await genesisCoin(alice, [funding]);
  const result = await StatefulContract.deploy(tokenArtifact, [], {
    provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
    initArgs: [hexToBin(token.txid)],
    bcmr: { timestamp: T0, ...(nfts === undefined ? {} : { token: { nfts } }) },
    nativeToken: { funding: token, reserve: 1_000_000n },
  });
  return { contract: result.categoryId, token: token.txid, tx: result.tx, registry: result.registry!.registry };
}

describe('the publication output and the registry (5.1, 5.2)', () => {
  it('commits output 1, with no satoshis, to the raw SHA-256 of the exact registry bytes returned', async () => {
    const provider = new MockNetworkProvider();
    const alice = await signerWithCoins(provider);
    const result = await StatefulContract.deploy(counter, [], {
      provider, fundingUtxo: await genesisCoin(alice), funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
      initialState: {}, bcmr: { name: 'Counter', timestamp: T0, publicationUris: [URI] },
    });
    const registry = result.registry!;
    // The bytes are the JSON returned, which encodes the registry returned.
    expect(new TextDecoder().decode(registry.bytes)).toBe(registry.json);
    expect(JSON.parse(registry.json)).toEqual(registry.registry);
    expect(binToHex(registry.sha256)).toBe(binToHex(sha256(registry.bytes)));
    const publication = result.tx.outputs[1]!;
    expect(binToHex(publication.lockingBytecode)).toBe(publicationHex(registry.bytes, PUSHED_URI));
    expect(publication.valueSatoshis).toBe(0n);
    // Without a token of its own, the identity publishes C's identity alone, as its own registry.
    expect(registry.registry.registryIdentity).toBe(result.categoryId);
    expect(Object.keys(registry.registry.identities!)).toEqual([result.categoryId]);
  });

  it('refuses a registry libauth\'s importMetadataRegistry rejects, before the genesis is built', async () => {
    const provider = new MockNetworkProvider();
    const alice = await signerWithCoins(provider);
    const fundingUtxo = await genesisCoin(alice);
    // The schema admits only strings as URIs, which the SDK leaves to libauth to check.
    const uris = { icon: 42 } as unknown as Record<string, string>;
    await expect(StatefulContract.deploy(counter, [], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialState: {},
      bcmr: { name: 'Counter', uris, timestamp: T0 },
    })).rejects.toThrow(/Metadata Registry import failed/);
    expect(isLive(await alice.getUtxos(), fundingUtxo.txid, 0)).toBe(true);
  });

  it('names C the registryIdentity beside the token identity X, and labels C\'s NFTs as <SYMBOL>-STATE', async () => {
    const labelled = await deployToken(STATE_NFTS);
    const { contract: c, token: x, registry } = labelled;
    expect(c).not.toBe(x);
    expect(registry.registryIdentity).toBe(c);
    expect(Object.keys(registry.identities!).sort()).toEqual([c, x].sort());
    // The genesis spends output 0 of both authbases, so its publication speaks for both.
    expect(spendsOutputZero(labelled.tx, c)).toBe(true);
    expect(spendsOutputZero(labelled.tx, x)).toBe(true);
    const tokenFields = registry.identities![x]![T0]!.token!;
    expect(tokenFields).toMatchObject({ category: x, symbol: 'XDOL', decimals: 6 });
    expect(tokenFields.nfts).toBeUndefined();
    expect(registry.identities![c]![T0]!.token).toMatchObject({ category: c, symbol: 'XDOL-STATE', nfts: STATE_NFTS });

    // C carries a token only to label its NFTs.
    const unlabelled = await deployToken();
    expect(unlabelled.registry.identities![unlabelled.contract]![T0]!.token).toBeUndefined();
  });
});

describe('later updates (5.4)', () => {
  it('transfers with a new registry: output 0 holds the NFT for the new owner, output 1 publishes', async () => {
    const published = await publishedCounter();
    const bob = new Signer(bobPriv, published.provider);
    const registry = withSnapshot(published.registry, published.category, { name: 'Counter v2' }, T1);
    const update = await publishMetadata({
      ...await updateOf(published), registry, publicationUris: [URI],
      action: { kind: 'transfer', owner: bob.getLockingBytecode() },
    });
    expect(spendsOutputZero(update.tx, published.identity.txid)).toBe(true);
    const [identity, publication] = update.tx.outputs;
    expectIdentityNft(identity, published.category, bob.getLockingBytecode(), authheadLockHex(published.category));
    expect(JSON.parse(new TextDecoder().decode(update.registry!.bytes))).toEqual(registry);
    expect(binToHex(publication!.lockingBytecode)).toBe(publicationHex(update.registry!.bytes, PUSHED_URI));
    expect(publication!.valueSatoshis).toBe(0n);
    expect(update.identity).toMatchObject({ txid: update.tx.txid, vout: 0, status: 'active' });
    expect(binToHex(update.identity.owner)).toBe(binToHex(bob.getLockingBytecode()));
  });

  it('updates without a registry, carrying the current publication over (R2)', async () => {
    const published = await publishedCounter();
    const update = await publishMetadata(await updateOf(published));
    const [identity, carried] = update.tx.outputs;
    const owner = published.alice.getLockingBytecode();
    expectIdentityNft(identity, published.category, owner, authheadLockHex(published.category));
    expect(binToHex(carried!.lockingBytecode)).toBe(binToHex(published.genesis.outputs[1]!.lockingBytecode));
    expect(carried!.valueSatoshis).toBe(0n);
  });

  it('freezes the identity: output 0 is P2SH32 of OP_RETURN, output 1 re-publishes the current registry', async () => {
    const published = await publishedCounter();
    const update = await publishMetadata({ ...await updateOf(published), action: { kind: 'freeze' } });
    expect(spendsOutputZero(update.tx, published.identity.txid)).toBe(true);
    expectIdentityNft(update.tx.outputs[0], published.category, published.alice.getLockingBytecode(), FROZEN_LOCK);
    const carried = update.tx.outputs[1]!;
    expect(binToHex(carried.lockingBytecode)).toBe(binToHex(published.genesis.outputs[1]!.lockingBytecode));
    expect(carried.valueSatoshis).toBe(0n);
    expect(update.identity).toMatchObject({ txid: update.tx.txid, vout: 0, status: 'frozen' });
  });

  it('burns the identity: output 0 of the new authhead is OP_RETURN, and the burn publishes nothing', async () => {
    const published = await publishedCounter();
    const update = await publishMetadata({ ...await updateOf(published), action: { kind: 'burn' } });
    expect(spendsOutputZero(update.tx, published.identity.txid)).toBe(true);
    expectIdentityNft(update.tx.outputs[0], published.category, published.alice.getLockingBytecode(), '6a');
    // Its output 0 ends the identity (4.2), so no output carries a publication over.
    expect(update.tx.outputs.some((output) => binToHex(output.lockingBytecode).startsWith(PUBLICATION_PREFIX)))
      .toBe(false);
    expect(update.registry).toBeUndefined();
    expect(update.identity).toMatchObject({ txid: update.tx.txid, vout: 0, status: 'burned' });
  });

  it('refuses to burn while publishing, a coin at another lock, and an owner nobody controls', async () => {
    const published = await publishedCounter();
    const base = await updateOf(published);
    const bob = new Signer(bobPriv, published.provider);
    const registry = withSnapshot(published.registry, published.category, { name: 'Counter v2' }, T1);
    await expect(publishMetadata({ ...base, registry, action: { kind: 'burn' } }))
      .rejects.toThrow(/burned identity publishes nothing/);
    await expect(publishMetadata({ ...base, owner: { utxo: base.owner.utxo, unlocker: bob.unlockP2PKH() } }))
      .rejects.toThrow(/not at the identity's owner lock/);
    await expect(publishMetadata({ ...base, action: { kind: 'transfer', owner: Uint8Array.of(0x6a) } }))
      .rejects.toThrow(/a P2PKH, P2SH20 or P2SH32 lock/);
    const live = await published.alice.getUtxos();
    expect(isLive(live, base.owner.utxo.txid, base.owner.utxo.vout)).toBe(true);
  });

  it('refuses a spend that keeps the identity without a registry when its authhead is not served', async () => {
    const published = await publishedCounter();
    const base = await updateOf(published);
    // The provider stops serving the authhead, so its publication cannot be carried over (R2).
    const serve = published.provider.getRawTransaction.bind(published.provider);
    const hidden = vi.spyOn(published.provider, 'getRawTransaction')
      .mockImplementation(async (txid) => (txid === published.identity.txid ? '' : serve(txid)));
    const actions: IdentityAction[] = [
      { kind: 'update' }, { kind: 'freeze' }, { kind: 'transfer', owner: published.alice.getLockingBytecode() },
    ];
    for (const action of actions) {
      await expect(publishMetadata({ ...base, action }))
        .rejects.toThrow(/no publication to carry over that the SDK can read \(the provider does not serve its/);
    }
    hidden.mockRestore();
    expect(isLive(await published.alice.getUtxos(), base.owner.utxo.txid, base.owner.utxo.vout)).toBe(true);
  });
});

describe('the SDK surface (section 10)', () => {
  it('ContractFactory passes identity, bcmr and nativeToken through and answers its identity and registry', async () => {
    const provider = new MockNetworkProvider();
    const alice = await signerWithCoins(provider, 4);
    const bob = new Signer(bobPriv, provider);
    const token = await genesisCoin(alice);
    const deployed = await new ContractFactory(tokenArtifact, alice).deploy(hexToBin(token.txid), {
      identity: { owner: bob.getLockingBytecode() },
      bcmr: { timestamp: T0, publicationUris: [URI] },
      nativeToken: { funding: token, reserve: 1_000_000n },
    });
    const tx = deployed.deploymentTransaction();
    // identity: output 0's NFT names the stated owner rather than the deployer.
    expectIdentityNft(tx.outputs[0], deployed.categoryId, bob.getLockingBytecode(), authheadLockHex(deployed.categoryId));
    const identity = deployed.deploymentIdentity()!;
    expect(identity).toMatchObject({ txid: tx.txid, vout: 0, status: 'active', category: deployed.categoryId });
    expect(binToHex(identity.owner)).toBe(binToHex(bob.getLockingBytecode()));
    // bcmr: output 1 publishes the registry deploymentRegistry() returns.
    const registry = deployed.deploymentRegistry()!;
    expect(binToHex(tx.outputs[1]!.lockingBytecode)).toBe(publicationHex(registry.bytes, PUSHED_URI));
    // nativeToken: the genesis creates X beside C, premints it, and the registry describes it.
    expect(spendsOutputZero(tx, token.txid)).toBe(true);
    const reserve = tx.outputs.find((output) => output.token !== undefined
      && binToHex(output.token.category) === token.txid);
    expect(reserve?.token?.amount).toBe(1_000_000n);
    expect(registry.registry.registryIdentity).toBe(deployed.categoryId);
    expect(registry.registry.identities![token.txid]![T0]!.token?.category).toBe(token.txid);
  });
});
