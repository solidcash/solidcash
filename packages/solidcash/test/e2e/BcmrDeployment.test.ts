/**
 * BCMR metadata at deployment (docs/bcmr/DESIGN.md): every genesis leads with an identity output, may publish a
 * registry at output 1, and an ERC-20-shaped token publishes fields read from the contract beside its premint.
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
  BCMR_PUBLICATION_PREFIX, BcmrError, NATIVE_TOKEN_EXTENSION, authGuardLockingBytecode, authGuardRedeemScript,
  authGuardUnlocker, encodeRegistry, frozenLockingBytecode, ipfsCidV1Raw, nativeDecimals, publicationBytecode,
  publicationOutput, publishMetadata, selfPublishedRegistry, withSnapshot, type IdentityRecord,
} from '../../src/bcmr/index.js';
import { ownCoinRefusal } from '../../src/framed/deploy/own-coin.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import Signer from '../../src/Signer.js';
import { getTokenContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { genesisOutpointKey, isReservedGenesisOutpoint } from '../../src/stateful/genesis-reservations.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { deployStatefulContract } from '../../src/stateful/sc-deploy.js';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';
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

const FRAMED = 'pragma solidcash ^0.13.0; contract C { int n;'
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

async function feeCoin(signer: Signer, identity: IdentityRecord): Promise<Utxo> {
  const coins = (await signer.getUtxos())
    .filter((utxo) => utxo.token === undefined && !(utxo.txid === identity.txid && utxo.vout === 0))
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

  it('pins the AuthGuard script: the key push and the 15-byte body, 48 bytes', () => {
    const category = '01'.repeat(31) + 'ff';
    const script = authGuardRedeemScript(category);
    expect(script.length).toBe(48);
    expect(binToHex(script.slice(1, 33))).toBe(binToHex(hexToBin(category).reverse()));
    expect(binToHex(script.slice(33))).toBe('51ce8851d0009d6300cdc0c7886851');
  });
});

describe('the genesis identity output', () => {
  it('leads a direct genesis with a key identity at the deployer lock that the SDK will not spend', async () => {
    const provider = new MockNetworkProvider();
    const alice = await signerWithCoins(provider);
    const artifact = compileString(COUNTER, { forceStateful: true });
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: await genesisCoin(alice), funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
      initialState: {},
    });

    const [identity, master] = result.tx.outputs;
    expect(identity!.token).toBeUndefined();
    expect(binToHex(identity!.lockingBytecode)).toBe(binToHex(alice.getLockingBytecode()));
    expect(master!.token?.nft?.capability).toBe('minting');
    expect(result.identity).toMatchObject({ txid: result.tx.txid, vout: 0, policy: 'key' });
    expect(isReservedGenesisOutpoint(genesisOutpointKey(result.tx.txid, 0))).toBe(true);

    // Proven from its own transaction, the identity output is refused as a coin for any role.
    const refusal = await ownCoinRefusal(provider, {
      txid: result.tx.txid, vout: 0, satoshis: identity!.valueSatoshis,
    }, alice.getLockingBytecode(), { role: 'funder', tokenFree: true });
    expect(refusal).toMatch(/BCMR identity output/);

    // Calls still find their fee elsewhere.
    const counter = result.contract.connect(alice) as unknown as { bump: () => { send: () => Promise<unknown> } };
    await counter.bump().send();
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

  it('freezes or burns an identity, and a burned identity publishes nothing', async () => {
    const provider = new MockNetworkProvider();
    const alice = await signerWithCoins(provider);
    const artifact = compileString(COUNTER, { forceStateful: true });
    const deploy = async (
      identity: { kind: 'frozen' } | { kind: 'burned' }, bcmr?: { name: string },
    ): Promise<{ tx: { outputs: { lockingBytecode: Uint8Array; valueSatoshis: bigint }[] } }> => (
      StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo: await genesisCoin(alice), funder: alice.unlockP2PKH(),
        changeAddress: alice.getAddress(), initialState: {}, identity, ...(bcmr === undefined ? {} : { bcmr }),
      }));
    const frozen = await deploy({ kind: 'frozen' });
    expect(binToHex(frozen.tx.outputs[0]!.lockingBytecode)).toBe(binToHex(frozenLockingBytecode()));
    const burned = await deploy({ kind: 'burned' });
    expect(binToHex(burned.tx.outputs[0]!.lockingBytecode)).toBe('6a');
    expect(burned.tx.outputs[0]!.valueSatoshis).toBe(0n);
    await expect(deploy({ kind: 'burned' }, { name: 'Nope' })).rejects.toThrow(/burned identity publishes nothing/);
  });

  it('leads a framed genesis with the identity output, ahead of its master pool', async () => {
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
    expect(identity!.token).toBeUndefined();
    expect(binToHex(identity!.lockingBytecode)).toBe(binToHex(alice.getLockingBytecode()));
    expect(master!.token?.nft?.capability).toBe('minting');
    expect(result.identity?.policy).toBe('key');
  });
});

describe('updating a published identity', () => {
  it('spends a key identity: the update recreates it and publishes at output 1', async () => {
    const provider = new MockNetworkProvider();
    const alice = await signerWithCoins(provider);
    const artifact = compileString(COUNTER, { forceStateful: true });
    const deployed = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: await genesisCoin(alice), funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
      initialState: {}, bcmr: { name: 'Counter', timestamp: TIMESTAMP },
    });
    const identity = deployed.identity!;
    const registry = withSnapshot(
      deployed.registry!.registry, deployed.categoryId, { name: 'Counter v2' }, '2026-10-21T12:00:00.000Z',
    );
    const update = await publishMetadata({
      provider,
      identity: { txid: identity.txid, vout: 0, satoshis: identity.satoshis },
      current: { kind: 'key', unlocker: alice.unlockP2PKH() },
      registry,
      feeFunding: { utxo: await feeCoin(alice, identity), unlocker: alice.unlockP2PKH() },
      changeAddress: alice.getAddress(),
    });
    expect(binToHex(update.tx.outputs[0]!.lockingBytecode)).toBe(binToHex(alice.getLockingBytecode()));
    expect(binToHex(pushesOf(update.tx.outputs[1]!.lockingBytecode)[1]!)).toBe(binToHex(update.registry!.sha256));
    expect(update.identity).toMatchObject({ txid: update.tx.txid, vout: 0, policy: 'key' });
  });

  it('guards an identity with AuthGuard (opt-in): only the AuthKey at input 1 moves it', async () => {
    const provider = new MockNetworkProvider();
    const alice = await signerWithCoins(provider, 4);
    const artifact = compileString(COUNTER, { forceStateful: true });
    const fundingUtxo = await genesisCoin(alice);
    const authKeyFunding = await genesisCoin(alice, [fundingUtxo]);
    const deployed = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialState: {},
      identity: { kind: 'authguard', authKeyFunding },
      bcmr: { name: 'Guarded', timestamp: TIMESTAMP },
    });
    const authKeyCategory = authKeyFunding.txid;
    expect(binToHex(deployed.tx.outputs[0]!.lockingBytecode)).toBe(binToHex(authGuardLockingBytecode(authKeyCategory)));
    expect(deployed.identity).toMatchObject({ policy: 'authguard', authKeyCategory });
    expect(deployed.registry!.registry.identities![deployed.categoryId]![TIMESTAMP]!.extensions)
      .toEqual({ authNft: authKeyCategory });
    const authKey = (await alice.getUtxos()).find((utxo) => utxo.token?.category === authKeyCategory)!;
    expect(authKey.token?.nft?.capability).toBe('none');

    // Without the AuthKey at input 1 the guard refuses the spend.
    const guard: Utxo = { txid: deployed.tx.txid, vout: 0, satoshis: deployed.identity!.satoshis };
    const plain = await feeCoin(alice, deployed.identity!);
    const unguarded = new TransactionBuilder({ provider })
      .addInput(guard, authGuardUnlocker(authKeyCategory))
      .addInput(plain, alice.unlockP2PKH())
      .addOutput({ to: authGuardLockingBytecode(authKeyCategory), amount: guard.satoshis })
      .addOutput({ to: alice.getAddress(), amount: plain.satoshis - 3000n });
    await expect(unguarded.send()).rejects.toThrow();

    const update = await publishMetadata({
      provider,
      identity: guard,
      current: { kind: 'authguard', authKeyCategory, authKey, authKeyUnlocker: alice.unlockP2PKH() },
      registry: withSnapshot(
        deployed.registry!.registry, deployed.categoryId, { name: 'Guarded v2' }, '2026-10-21T12:00:00.000Z',
      ),
      feeFunding: { utxo: await feeCoin(alice, deployed.identity!), unlocker: alice.unlockP2PKH() },
      changeAddress: alice.getAddress(),
    });
    expect(binToHex(update.tx.outputs[0]!.lockingBytecode)).toBe(binToHex(authGuardLockingBytecode(authKeyCategory)));
    expect(binToHex(update.tx.outputs[2]!.token!.category)).toBe(authKeyCategory);
    expect(update.identity.policy).toBe('authguard');
  });
});

describe('an ERC-20-shaped token', () => {
  const artifact = compileFile(TOKEN, { messageBus: false });

  it('publishes the fields the contract answers beside its premint', async () => {
    const provider = new MockNetworkProvider();
    const alice = await signerWithCoins(provider);
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: await genesisCoin(alice), funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
      bcmr: { uris: { icon: 'ipfs://bafkreiicon' }, timestamp: TIMESTAMP },
      nativeToken: { reserve: 1_000_000n },
    });
    const snapshot = result.registry!.registry.identities![result.categoryId]![TIMESTAMP]!;
    expect(snapshot.name).toBe('Example Dollar');
    expect(snapshot.token).toEqual({ category: result.categoryId, symbol: 'XDOL', decimals: 6 });
    const reserveLock = addressToLockScript(getTokenContainerAddress(result.contract.inner, result.categoryId,
      result.categoryId));
    const reserve = result.tx.outputs.find((output) => binToHex(output.lockingBytecode) === binToHex(reserveLock));
    expect(reserve?.token?.amount).toBe(1_000_000n);
    expect(binToHex(reserve!.token!.category)).toBe(result.categoryId);
    expect(snapshot.extensions?.[NATIVE_TOKEN_EXTENSION]).toEqual({
      reserveLockingBytecode: binToHex(reserveLock), scale: '1', ledgerSupply: 'totalSupply()',
    });
  });

  it('scales the published decimals by the native scale', async () => {
    const provider = new MockNetworkProvider();
    const alice = await signerWithCoins(provider);
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: await genesisCoin(alice), funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
      bcmr: { timestamp: TIMESTAMP }, nativeToken: { reserve: 50n, scale: 100n },
    });
    expect(result.registry!.registry.identities![result.categoryId]![TIMESTAMP]!.token?.decimals).toBe(4);
  });

  it('refuses, before broadcasting, a stated symbol the contract disagrees with or a premint below the ledger', async () => {
    const provider = new MockNetworkProvider();
    const alice = await signerWithCoins(provider);
    const fundingUtxo = await genesisCoin(alice);
    const base = { provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress() };
    await expect(StatefulContract.deploy(artifact, [], {
      ...base, bcmr: { token: { symbol: 'OTHER' }, timestamp: TIMESTAMP },
    })).rejects.toThrow(/disagrees with the contract's symbol\(\)/);
    await expect(StatefulContract.deploy(artifact, [], { ...base, nativeToken: { reserve: 4999n } }))
      .rejects.toThrow(/totalSupply\(\) of 5000/);
    // Nothing was broadcast: the funding coin is still there.
    expect((await alice.getUtxos()).some((utxo) => utxo.txid === fundingUtxo.txid && utxo.vout === 0)).toBe(true);
  });
});
