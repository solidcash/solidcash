/**
 * BCMR metadata at deployment (docs/bcmr/DESIGN.md): every genesis leads with the authhead contract, may publish a
 * registry at output 1, and an ERC-20-shaped token publishes fields read from the contract beside its premint; the
 * owner then updates, transfers, freezes or burns the identity.
 */
// cspell:ignore bafkreiexample bafkreihdwdcefgh dqkjv uzcmw ojee xedzdetojuzjevtenxquvyku XMPL bafkreiicon XDOL
import {
  binToHex, decodeAuthenticationInstructions, hexToBin, utf8ToBin,
} from '@bitauth/libauth';
import { compileFile } from 'solidc';
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS } from '../../../solidc/test/framed/machine.js';
import {
  AUTHHEAD_BODY, BCMR_PUBLICATION_PREFIX, BcmrError, FROZEN_LOCKING_BYTECODE, NATIVE_TOKEN_EXTENSION,
  authheadLockingBytecode, authheadRedeemScript, encodeRegistry, ipfsCidV1Raw, nativeDecimals, publicationBytecode,
  publicationOutput, publishMetadata, resolveIdentity, selfPublishedRegistry, withSnapshot, type IdentityRecord,
} from '../../src/bcmr/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import Signer from '../../src/Signer.js';
import { getTokenContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { deployStatefulContract } from '../../src/stateful/sc-deploy.js';
import type { Utxo } from '../../src/interfaces.js';
import { addressToLockScript } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { alicePriv } from '../fixture/vars.js';
import { fundShippedFacets } from '../framed/shapes/harness.js';

const COUNTER = `pragma solidcash >=0.8.0;
contract Counter() {
  int count;
  function bump() { this.count = this.count + 1; require(this.count > 0); }
}`;

const FRAMED = 'pragma solidcash ^0.14.0; contract C { int n;'
  + ' function touch() { this.n = this.n + 1; require(this.n > 0); } }';

const TOKEN = new URL('../fixture/bcmr_metadata_token.scash', import.meta.url);
const TIMESTAMP = '2026-10-20T12:00:00.000Z';

function pushesOf(lockingBytecode: Uint8Array): Uint8Array[] {
  return decodeAuthenticationInstructions(lockingBytecode).slice(1)
    .map((instruction) => ('data' in instruction ? instruction.data : new Uint8Array(0)));
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

/** The signer's largest token-free coin, which authorizes an owner's spend and pays for it. */
async function ownerCoin(signer: Signer): Promise<Utxo> {
  const coins = (await signer.getUtxos())
    .filter((utxo) => utxo.token === undefined)
    .sort((left, right) => (left.satoshis > right.satoshis ? -1 : 1));
  return coins[0]!;
}

describe('BCMR publication encoding', () => {
  it('pushes the raw hash and each URI, an HTTPS URI without its protocol', () => {
    const hash = new Uint8Array(32).fill(7);
    const bytecode = publicationBytecode(hash, ['https://example.org', 'ipfs://bafkreiexample']);
    expect(binToHex(bytecode.slice(0, 6))).toBe(binToHex(BCMR_PUBLICATION_PREFIX));
    const [, pushedHash, https, ipfs] = pushesOf(bytecode);
    expect(binToHex(pushedHash!)).toBe(binToHex(hash));
    expect(binToHex(https!)).toBe(binToHex(utf8ToBin('example.org')));
    expect(binToHex(ipfs!)).toBe(binToHex(utf8ToBin('ipfs://bafkreiexample')));
    expect(() => publicationOutput(hash, ['x'.repeat(200)])).toThrow(/relay cap/);
  });

  it('computes the raw CIDv1 of a registry from its SHA-256', () => {
    expect(ipfsCidV1Raw(new Uint8Array(0))).toBe('bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku');
  });

  it('validates a self-published registry and refuses a symbol or decimals BCMR does not admit', async () => {
    const category = 'ab'.repeat(32);
    const encoded = await encodeRegistry(selfPublishedRegistry(category, {
      name: 'Example', token: { symbol: 'XMPL', decimals: 2 },
    }, TIMESTAMP));
    expect(encoded.registry.registryIdentity).toBe(category);
    expect(encoded.json.endsWith('\n')).toBe(true);
    const next = withSnapshot(encoded.registry, category, { name: 'Example 2' }, '2026-10-21T12:00:00.000Z');
    expect(next.version.minor).toBe(2);
    expect(Object.keys(next.identities![category]!)).toEqual(['2026-10-21T12:00:00.000Z', TIMESTAMP]);
    expect(() => selfPublishedRegistry(category, { name: 'x', token: { symbol: 'stETH' } }, TIMESTAMP))
      .toThrow(BcmrError);
    expect(() => selfPublishedRegistry(category, { name: 'x', token: { symbol: 'X', decimals: 19 } }, TIMESTAMP))
      .toThrow(/0 to 18/);
  });

  it('derives the bearer decimals from a power-of-ten native scale only', () => {
    expect(nativeDecimals(18n, 10n ** 10n)).toBe(8);
    expect(nativeDecimals(6n)).toBe(6);
    expect(() => nativeDecimals(18n, 3n)).toThrow(/power of ten/);
    expect(() => nativeDecimals(2n, 1000n)).toThrow(/0 to 18/);
  });

  it('pins the authhead script: the push of C with its capability, then the 46-byte body', () => {
    const category = '01'.repeat(31) + 'ff';
    const script = authheadRedeemScript(category);
    expect(script.length).toBe(80);
    expect(binToHex(script.slice(0, 34))).toBe(`21${binToHex(hexToBin(category).reverse())}01`);
    expect(binToHex(AUTHHEAD_BODY)).toBe(
      '00d18800d39169c3529d51c09476ce0088c7c0cf8800cd76c0c78778016a879b7c016aaa02aa207c7e01877e879b',
    );
  });
});

/** Output 0 of `tx` is the authhead of `category`, holding its mutable NFT for `owner`. */
function expectAuthhead(
  output: { lockingBytecode: Uint8Array; token?: { category: Uint8Array; amount: bigint; nft?: { capability: string;
    commitment: Uint8Array } } } | undefined,
  category: string, owner: Uint8Array, lockingBytecode = authheadLockingBytecode(category),
): void {
  expect(binToHex(output!.lockingBytecode)).toBe(binToHex(lockingBytecode));
  expect(binToHex(output!.token!.category)).toBe(category);
  expect(output!.token!.amount).toBe(0n);
  expect(output!.token!.nft?.capability).toBe('mutable');
  expect(binToHex(output!.token!.nft!.commitment)).toBe(binToHex(owner));
}

describe('the genesis identity output', () => {
  it('leads a direct genesis with the authhead contract, owned by the deployer and found by its category', async () => {
    const provider = new MockNetworkProvider();
    const alice = await signerWithCoins(provider);
    const artifact = compileString(COUNTER, { forceStateful: true });
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: await genesisCoin(alice), funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
      initialState: {},
    });

    const [identity, master] = result.tx.outputs;
    expectAuthhead(identity, result.categoryId, alice.getLockingBytecode());
    expect(master!.token?.nft?.capability).toBe('minting');
    expect(result.identity).toMatchObject({
      txid: result.tx.txid, vout: 0, category: result.categoryId, status: 'active',
    });
    expect(binToHex(result.identity!.owner)).toBe(binToHex(alice.getLockingBytecode()));
    const resolved = await resolveIdentity(provider, result.categoryId);
    expect(resolved).toMatchObject({ txid: result.tx.txid, status: 'active', satoshis: result.identity!.satoshis });

    // Calls never touch it.
    const counter = result.contract.connect(alice) as unknown as { bump: () => { send: () => Promise<unknown> } };
    await counter.bump().send();
    expect((await resolveIdentity(provider, result.categoryId))?.txid).toBe(result.tx.txid);
  });

  it('publishes a registry at output 1, committing to the exact bytes returned', async () => {
    const provider = new MockNetworkProvider();
    const alice = await signerWithCoins(provider);
    const artifact = compileString(COUNTER, { forceStateful: true });
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: await genesisCoin(alice), funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
      initialState: {},
      bcmr: {
        name: 'Counter', description: 'Counts.', uris: { web: 'https://example.org' }, timestamp: TIMESTAMP,
        publicationUris: ['https://example.org'],
      },
    });
    const registry = result.registry!;
    const [, publication] = result.tx.outputs;
    expect(binToHex(publication!.lockingBytecode.slice(0, 6))).toBe(binToHex(BCMR_PUBLICATION_PREFIX));
    const [, hash, uri] = pushesOf(publication!.lockingBytecode);
    expect(binToHex(hash!)).toBe(binToHex(registry.sha256));
    expect(binToHex(uri!)).toBe(binToHex(utf8ToBin('example.org')));
    expect(registry.registry.identities![result.categoryId]![TIMESTAMP]!.name).toBe('Counter');
  });

  it('defaults the publication URI to the registry CID', async () => {
    const provider = new MockNetworkProvider();
    const alice = await signerWithCoins(provider);
    const artifact = compileString(COUNTER, { forceStateful: true });
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: await genesisCoin(alice), funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
      initialState: {}, bcmr: { name: 'Counter', timestamp: TIMESTAMP },
    });
    expect(result.registry!.uris).toEqual([`ipfs://${ipfsCidV1Raw(result.registry!.bytes)}`]);
  });

  it('leads a framed genesis with the authhead contract, ahead of its master pool', async () => {
    const artifact = compileStringMulti(FRAMED, { composition: 'framed' }).C!;
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const alice = new Signer(alicePriv, provider);
    const fundingUtxo = { txid: 'c7'.repeat(32), vout: 0, satoshis: 2_000_000n };
    await provider.addUtxo(alice.getAddress(), fundingUtxo);
    await fundShippedFacets(provider);
    const result = await deployStatefulContract(artifact, [], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
    });
    const [identity, master] = result.tx.outputs;
    expectAuthhead(identity, result.categoryId, alice.getLockingBytecode());
    expect(master!.token?.nft?.capability).toBe('minting');
    expect(result.identity?.status).toBe('active');
  });
});

describe('the owner\'s spends of an identity', () => {
  async function deployed(provider: MockNetworkProvider, alice: Signer): Promise<{
    categoryId: string; identity: IdentityRecord; registry: Parameters<typeof withSnapshot>[0];
    publication: Uint8Array;
  }> {
    const result = await StatefulContract.deploy(compileString(COUNTER, { forceStateful: true }), [], {
      provider, fundingUtxo: await genesisCoin(alice), funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
      initialState: {}, bcmr: { name: 'Counter', timestamp: TIMESTAMP },
    });
    return {
      categoryId: result.categoryId, identity: result.identity!, registry: result.registry!.registry,
      publication: result.tx.outputs[1]!.lockingBytecode,
    };
  }

  it('updates it: output 0 recreates the authhead and output 1 publishes', async () => {
    const provider = new MockNetworkProvider();
    const alice = await signerWithCoins(provider);
    const { categoryId, identity, registry } = await deployed(provider, alice);
    const update = await publishMetadata({
      provider,
      identity,
      owner: { utxo: await ownerCoin(alice), unlocker: alice.unlockP2PKH() },
      registry: withSnapshot(registry, categoryId, { name: 'Counter v2' }, '2026-10-21T12:00:00.000Z'),
      changeAddress: alice.getAddress(),
    });
    expectAuthhead(update.tx.outputs[0], categoryId, alice.getLockingBytecode());
    expect(binToHex(pushesOf(update.tx.outputs[1]!.lockingBytecode)[1]!)).toBe(binToHex(update.registry!.sha256));
    expect(update.identity).toMatchObject({ txid: update.tx.txid, vout: 0, status: 'active' });
    expect((await resolveIdentity(provider, categoryId))?.txid).toBe(update.tx.txid);
  });

  it('transfers it, carrying the registry over; only the new owner spends it next', async () => {
    const provider = new MockNetworkProvider();
    const [first, second] = await provider.getSigners(2, { fundingUtxos: 3, genesisFundingUtxos: 3 });
    const alice = first as unknown as Signer;
    const bob = second as unknown as Signer;
    const {
      categoryId, identity, registry, publication: genesisPublication,
    } = await deployed(provider, alice);
    const transfer = await publishMetadata({
      provider,
      identity,
      owner: { utxo: await ownerCoin(alice), unlocker: alice.unlockP2PKH() },
      action: { kind: 'transfer', owner: bob.getAddress() },
      changeAddress: alice.getAddress(),
    });
    expectAuthhead(transfer.tx.outputs[0], categoryId, bob.getLockingBytecode());
    expect(binToHex(transfer.tx.outputs[1]!.lockingBytecode)).toBe(binToHex(genesisPublication));
    expect(binToHex(transfer.identity.owner)).toBe(binToHex(bob.getLockingBytecode()));

    await expect(publishMetadata({
      provider, identity: transfer.identity, owner: { utxo: await ownerCoin(alice), unlocker: alice.unlockP2PKH() },
      registry, changeAddress: alice.getAddress(),
    })).rejects.toThrow(/not at the identity's owner lock/);
    const update = await publishMetadata({
      provider, identity: transfer.identity, owner: { utxo: await ownerCoin(bob), unlocker: bob.unlockP2PKH() },
      registry: withSnapshot(registry, categoryId, { name: 'Counter by Bob' }, '2026-10-21T12:00:00.000Z'),
      changeAddress: bob.getAddress(),
    });
    expectAuthhead(update.tx.outputs[0], categoryId, bob.getLockingBytecode());
  });

  it('freezes one identity and burns another; a frozen identity is final, a burn publishes nothing', async () => {
    const provider = new MockNetworkProvider();
    const alice = await signerWithCoins(provider, 4);
    const owner = async (): Promise<{ utxo: Utxo; unlocker: ReturnType<Signer['unlockP2PKH']> }> => (
      { utxo: await ownerCoin(alice), unlocker: alice.unlockP2PKH() });
    const first = await deployed(provider, alice);
    const frozen = await publishMetadata({
      provider, identity: first.identity, owner: await owner(), action: { kind: 'freeze' },
      changeAddress: alice.getAddress(),
    });
    expectAuthhead(frozen.tx.outputs[0], first.categoryId, alice.getLockingBytecode(), FROZEN_LOCKING_BYTECODE);
    expect(binToHex(frozen.tx.outputs[1]!.lockingBytecode.slice(0, 6))).toBe(binToHex(BCMR_PUBLICATION_PREFIX));
    expect(frozen.identity.status).toBe('frozen');
    expect(await resolveIdentity(provider, first.categoryId)).toBeUndefined();
    await expect(publishMetadata({
      provider, identity: frozen.identity, owner: await owner(), changeAddress: alice.getAddress(),
    })).rejects.toThrow(/is frozen/);

    const second = await deployed(provider, alice);
    await expect(publishMetadata({
      provider, identity: second.identity, owner: await owner(), action: { kind: 'burn' },
      registry: second.registry, changeAddress: alice.getAddress(),
    })).rejects.toThrow(/burned identity publishes nothing/);
    const burned = await publishMetadata({
      provider, identity: second.identity, owner: await owner(), action: { kind: 'burn' },
      changeAddress: alice.getAddress(),
    });
    expectAuthhead(burned.tx.outputs[0], second.categoryId, alice.getLockingBytecode(), hexToBin('6a'));
    expect(burned.tx.outputs[0]!.valueSatoshis).toBe(0n);
    expect(burned.tx.outputs).toHaveLength(2);
    expect(burned.identity.status).toBe('burned');
  });
});

describe('an ERC-20-shaped token', () => {
  const artifact = compileFile(TOKEN, { messageBus: false });

  /** A signer with a deployment coin and a coin whose txid becomes the token's own category. */
  async function coins(provider: MockNetworkProvider): Promise<{ alice: Signer; funding: Utxo; token: Utxo }> {
    const alice = await signerWithCoins(provider, 4);
    const funding = await genesisCoin(alice);
    return { alice, funding, token: await genesisCoin(alice, [funding]) };
  }

  it('creates its own token category, publishes what the contract answers, and premints the reserve', async () => {
    const provider = new MockNetworkProvider();
    const { alice, funding, token } = await coins(provider);
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
      initArgs: [hexToBin(token.txid)],
      bcmr: { uris: { icon: 'ipfs://bafkreiicon' }, timestamp: TIMESTAMP },
      nativeToken: { funding: token, reserve: 1_000_000n },
    });
    const identities = result.registry!.registry.identities!;
    const snapshot = identities[token.txid]![TIMESTAMP]!;
    expect(snapshot.name).toBe('Example Dollar');
    expect(snapshot.token).toEqual({ category: token.txid, symbol: 'XDOL', decimals: 6 });
    expect(identities[result.categoryId]![TIMESTAMP]!.name).toBe('Example Dollar contract');
    // The genesis spends the token's coin, so it creates both categories, which share its identity output.
    expect(result.tx.inputs.map((input) => binToHex(input.outpointTransactionHash))).toContain(token.txid);
    const reserveLock = addressToLockScript(getTokenContainerAddress(result.contract.inner, result.categoryId,
      token.txid));
    const reserve = result.tx.outputs.find((output) => binToHex(output.lockingBytecode) === binToHex(reserveLock));
    expect(reserve?.token?.amount).toBe(1_000_000n);
    expect(binToHex(reserve!.token!.category)).toBe(token.txid);
    expect(snapshot.extensions?.[NATIVE_TOKEN_EXTENSION]).toEqual({
      reserveLockingBytecode: binToHex(reserveLock), scale: '1', ledgerSupply: 'totalSupply()',
    });
  });

  it('scales the published decimals by the native scale', async () => {
    const provider = new MockNetworkProvider();
    const { alice, funding, token } = await coins(provider);
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
      initArgs: [hexToBin(token.txid)],
      bcmr: { timestamp: TIMESTAMP }, nativeToken: { funding: token, reserve: 50n, scale: 100n },
    });
    expect(result.registry!.registry.identities![token.txid]![TIMESTAMP]!.token?.decimals).toBe(4);
  });

  it('refuses, before broadcasting, a symbol, premint or token category the contract disagrees with', async () => {
    const provider = new MockNetworkProvider();
    const { alice, funding, token } = await coins(provider);
    const base = {
      provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
      initArgs: [hexToBin(token.txid)],
    };
    await expect(StatefulContract.deploy(artifact, [], {
      ...base, bcmr: { token: { symbol: 'OTHER' }, timestamp: TIMESTAMP }, nativeToken: { funding: token },
    })).rejects.toThrow(/disagrees with the contract's symbol\(\)/);
    await expect(StatefulContract.deploy(artifact, [], {
      ...base, nativeToken: { funding: token, reserve: 4999n },
    })).rejects.toThrow(/totalSupply\(\) of 5000/);
    await expect(StatefulContract.deploy(artifact, [], {
      ...base, initArgs: [hexToBin('ee'.repeat(32))], nativeToken: { funding: token, reserve: 5000n },
    })).rejects.toThrow(/keys its reserve by category e{64}/);
    // Nothing was broadcast: both coins are still there.
    const live = await alice.getUtxos();
    for (const coin of [funding, token]) {
      expect(live.some((utxo) => utxo.txid === coin.txid && utxo.vout === 0)).toBe(true);
    }
  });
});
