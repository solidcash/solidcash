/**
 * The identity-output rule (docs/bcmr/DESIGN.md 4.4): a vout-0 coin whose transaction is a token genesis, or carries
 * a BCMR output, is an identity output, and the SDK never spends one: no fee or funding it picks takes one, and a coin
 * it is handed is refused. The SDK's own identities sit at authhead contracts, so the identity outputs here are other
 * transactions' outputs at the wallet's lock. Each test clears the reservations the way a later session starts, so
 * only the coin's own transaction marks it.
 */
import { binToHex, hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS } from '../../../solidc/test/framed/machine.js';
import { publicationOutput, publishMetadata, resolveIdentity } from '../../src/bcmr/index.js';
import { callFramedEntry } from '../../src/framed/call/call.js';
import { FramedFunctionCall } from '../../src/framed/call/handle.js';
import { framedTokenContainerLockingBytecode } from '../../src/framed/call/token-containers.js';
import { ownCoinRefusal } from '../../src/framed/deploy/own-coin.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import type { Utxo } from '../../src/interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import Signer from '../../src/Signer.js';
import { fanOutPlainUtxos } from '../../src/stateful/ContractFactory.js';
import {
  clearGenesisReservations, genesisOutpointKey, reserveGenesisOutpoint,
} from '../../src/stateful/genesis-reservations.js';
import { ContractBundle, StatefulContract } from '../../src/stateful/index.js';
import { deployStatefulContract } from '../../src/stateful/sc-deploy.js';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { compileString } from '../direct-compile.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPriv } from '../fixture/vars.js';
import { fundShippedFacets } from '../framed/shapes/harness.js';

const COUNTER = `pragma solidcash >=0.8.0;
contract Counter() {
  int count;
  function bump() { this.count = this.count + 1; require(this.count > 0); }
}`;

// Two events: two output-only slots, each paired with a funder from the caller's wallet.
const EMITTER = `pragma solidcash >=0.8.0;
contract Emitter() {
  event Bumped(int value);
  event Doubled(int value);
  int count;
  function bump() {
    this.count = this.count + 1;
    emit Bumped(this.count);
    emit Doubled(this.count * 2);
    require(this.count > 0);
  }
}`;

// Two bodies: a user's frame to a one-body framed contract carries no selector, which the call path does not plan.
const FRAMED = 'pragma solidcash ^0.14.0; contract C { int n;'
  + ' function poke(bool go) { if (go) this.n = this.n + 1; else this.n = this.n + 1; require(this.n > 0); }'
  + ' function touch() { this.n = this.n + 1; require(this.n > 0); } }';

// Two runs of sends from one frame: the index between them takes one more coin at the caller's lock.
const TWIN = 'pragma solidity ^0.8.0;'
  + ' contract Twin { bytes32 immutable first; bytes32 immutable second;'
  + '   constructor(bytes32 first_, bytes32 second_) { first = first_; second = second_; }'
  + '   function payBoth(address to, int x, int y) external { bytes32 a = first; bytes32 b = second;'
  + '     this.tokens[a].transfer(to, x); this.tokens[a].transfer(to, x); this.tokens[b].transfer(to, y); } }';

// An upgradable contract keeps no record; V2 adds state, whose data NFT the upgrade's funding coin pays for.
const UPGRADE_V1 = `pragma solidcash >=0.8.0;
contract UpgradeV1(pubkey admin) {
  function migrate(sig s) upgrade { require(checkSig(s, admin)); }
}`;
const UPGRADE_V2 = `pragma solidcash >=0.8.0;
contract UpgradeV2(pubkey admin) {
  int counter;
  function increment() { this.counter = this.counter + 1; require(this.counter > 0); }
}`;

// A factory whose entry deploys a child, funded by the signer it is connected to.
const MAKER = `
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

const TIMESTAMP = '2026-10-20T12:00:00.000Z';

const outpoint = (utxo: Pick<Utxo, 'txid' | 'vout'>): string => `${utxo.txid}:${utxo.vout}`;

let framed: Artifact | undefined;

/** The framed contract C, compiled once for the titles that deploy it. */
function framedArtifact(): Artifact {
  framed ??= compileStringMulti(FRAMED, { composition: 'framed' }).C!;
  return framed;
}

/** Output 0 of a token genesis and of a transaction publishing a registry, both paying `signer`. */
async function identityCoins(
  provider: MockNetworkProvider, signer: Signer,
): Promise<{ readonly genesis: Utxo; readonly publication: Utxo }> {
  const genesisSource = { txid: 'd1'.repeat(32), vout: 0, satoshis: 5_000_000n };
  const publicationSource = { txid: 'd2'.repeat(32), vout: 1, satoshis: 4_000_000n };
  await provider.addUtxo(signer.getAddress(), genesisSource);
  await provider.addUtxo(signer.getAddress(), publicationSource);
  const genesis = await new TransactionBuilder({ provider })
    .addInput(genesisSource, signer.unlockP2PKH())
    .addOutput({ to: signer.getAddress(), amount: 4_000_000n })
    .addOutput({ to: signer.getLockingBytecode(), amount: 1_000n, token: { category: genesisSource.txid, amount: 1n } })
    .addOutput({ to: signer.getAddress(), amount: 997_000n })
    .send();
  const publication = await new TransactionBuilder({ provider })
    .addInput(publicationSource, signer.unlockP2PKH())
    .addOutput({ to: signer.getAddress(), amount: 3_000_000n })
    .addOutput(publicationOutput(hexToBin('ab'.repeat(32)), ['example.org']))
    .addOutput({ to: signer.getAddress(), amount: 998_000n })
    .send();
  return {
    genesis: { txid: genesis.txid, vout: 0, satoshis: 4_000_000n },
    publication: { txid: publication.txid, vout: 0, satoshis: 3_000_000n },
  };
}

describe('the identity-output coin rule', () => {
  it('refuses a vout-0 coin whose transaction is a token genesis or carries a BCMR output', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider();
    const alice = new Signer(alicePriv, provider);
    const { genesis, publication } = await identityCoins(provider, alice);
    const lock = alice.getLockingBytecode();
    expect(await ownCoinRefusal(provider, genesis, lock, { role: 'caller' }))
      .toMatch(/BCMR identity output of category d1d1/);
    expect(await ownCoinRefusal(provider, publication, lock, { role: 'caller' }))
      .toMatch(/BCMR identity output of the identity it publishes for/);
    // Every other output of the same transaction is an ordinary coin.
    const change = { txid: publication.txid, vout: 2, satoshis: 998_000n };
    expect(await ownCoinRefusal(provider, change, lock, { role: 'caller' })).toBeUndefined();
  });

  it('pays a framed call with a proven plain coin, never a larger identity output or reserved coin', async () => {
    clearGenesisReservations();
    const artifact = framedArtifact();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: 'c1'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    await fundShippedFacets(provider);
    const built = await deployStatefulContract(artifact, [], {
      provider, fundingUtxo, funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: funder.address,
    });
    const alice = new Signer(alicePriv, provider);
    await identityCoins(provider, alice);
    const reserved = { txid: 'c2'.repeat(32), vout: 0, satoshis: 5_000_000n };
    await provider.addUtxo(alice.getAddress(), reserved);
    reserveGenesisOutpoint(genesisOutpointKey(reserved.txid, 0));
    const entry = artifact.abi.find((candidate) => candidate.name === 'poke')!;
    const result = await new FramedFunctionCall({
      artifact, abiEntry: entry, categoryId: built.categoryId, provider, signer: alice,
    }, 'poke', [false]).compose();
    // The caller's coin is the largest one proven plain: the publication's change.
    const values = (result.sourceOutputs ?? []).map((output) => output.valueSatoshis);
    expect(values).toContain(998_000n);
    for (const refused of [reserved.satoshis, 4_000_000n, 3_000_000n]) expect(values).not.toContain(refused);
  });

  it('funds a direct call without a reserved coin, and leaves the authhead alone', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider();
    const alice = new Signer(alicePriv, provider);
    const fundingUtxo = { txid: 'b1'.repeat(32), vout: 0, satoshis: 2_000_000n };
    await provider.addUtxo(alice.getAddress(), fundingUtxo);
    const deployed = await StatefulContract.deploy(compileString(EMITTER, { forceStateful: true }), [], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialState: {},
    });
    const change = { txid: deployed.tx.txid, vout: deployed.tx.outputs.length - 1 };
    clearGenesisReservations();
    const reserved = { txid: 'b2'.repeat(32), vout: 0, satoshis: 50_000n };
    await provider.addUtxo(alice.getAddress(), reserved);
    reserveGenesisOutpoint(genesisOutpointKey(reserved.txid, 0));

    const emitter = deployed.contract.connect(alice) as unknown as { bump: () => { send: () => Promise<unknown> } };
    await emitter.bump().send();
    const live = (await alice.getUtxos()).map(outpoint);
    expect((await resolveIdentity(provider, deployed.categoryId))?.txid).toBe(deployed.tx.txid);
    expect(live).toContain(outpoint(reserved));
    // The wallet did pay: the deployment's change funded the call's slots.
    expect(live).not.toContain(outpoint(change));
  });

  it('refuses an owner coin that is another identity\'s output', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider();
    const alice = new Signer(alicePriv, provider);
    const fundingUtxo = { txid: 'e1'.repeat(32), vout: 0, satoshis: 2_000_000n };
    await provider.addUtxo(alice.getAddress(), fundingUtxo);
    const deployed = await StatefulContract.deploy(compileString(COUNTER, { forceStateful: true }), [], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialState: {},
      bcmr: { name: 'Counter', timestamp: TIMESTAMP },
    });
    const { genesis, publication } = await identityCoins(provider, alice);
    for (const [coin, holder] of [[genesis, 'category d1d1'], [publication, 'the identity it publishes for']] as const) {
      await expect(publishMetadata({
        provider, identity: deployed.identity!, owner: { utxo: coin, unlocker: alice.unlockP2PKH() },
        changeAddress: alice.getAddress(),
      })).rejects.toThrow(new RegExp(`BCMR identity output of ${holder}`));
    }
    const live = (await alice.getUtxos()).map(outpoint);
    expect(live).toEqual(expect.arrayContaining([outpoint(genesis), outpoint(publication)]));
  });

  it('refuses an update with nothing to publish; a transfer needs no publication', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider();
    const alice = new Signer(alicePriv, provider);
    const bob = new Signer(bobPriv, provider);
    const fundingUtxo = { txid: 'f1'.repeat(32), vout: 0, satoshis: 2_000_000n };
    const fee = { txid: 'f2'.repeat(32), vout: 1, satoshis: 100_000n };
    await provider.addUtxo(alice.getAddress(), fundingUtxo);
    await provider.addUtxo(alice.getAddress(), fee);
    const deployed = await StatefulContract.deploy(compileString(COUNTER, { forceStateful: true }), [], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialState: {},
    });
    const owner = { utxo: fee, unlocker: alice.unlockP2PKH() };
    await expect(publishMetadata({
      provider, identity: deployed.identity!, owner, changeAddress: alice.getAddress(),
    })).rejects.toThrow(/publishes nothing to carry over/);
    const transfer = await publishMetadata({
      provider, identity: deployed.identity!, owner, action: { kind: 'transfer', owner: bob.getLockingBytecode() },
      changeAddress: alice.getAddress(),
    });
    expect(transfer.tx.outputs).toHaveLength(2);
    expect(binToHex(transfer.tx.outputs[0]!.token!.nft!.commitment)).toBe(binToHex(bob.getLockingBytecode()));
  });

  it('refuses an identity output an upgrade is handed as its funding coin, and spends nothing', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider();
    const alice = new Signer(alicePriv, provider);
    const fundingUtxo = { txid: 'a3'.repeat(32), vout: 0, satoshis: 2_000_000n };
    await provider.addUtxo(alice.getAddress(), fundingUtxo);
    const deployed = await StatefulContract.deploy(compileString(UPGRADE_V1, { forceStateful: true }), [alicePub], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
    });
    clearGenesisReservations();
    const { genesis, publication } = await identityCoins(provider, alice);
    const master = (await deployed.contract.getFullState()).masterUtxo!;
    const replacement = compileString(UPGRADE_V2);
    const upgrade = (coin: Utxo): Promise<unknown> => StatefulContract.upgrade({
      provider, oldContract: deployed.contract, upgradeFunctionName: 'migrate',
      upgradeFunctionArgs: [new SignatureTemplate(alicePriv)], newArtifact: replacement, newConstructorArgs: [alicePub],
      fundingUtxo: coin, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
    });
    await expect(upgrade(genesis)).rejects.toThrow(/BCMR identity output of category d1d1/);
    await expect(upgrade(publication)).rejects.toThrow(/BCMR identity output of the identity it publishes for/);
    const live = (await alice.getUtxos()).map(outpoint);
    expect(live).toEqual(expect.arrayContaining([outpoint(genesis), outpoint(publication)]));
    expect(outpoint((await deployed.contract.getFullState()).masterUtxo!)).toBe(outpoint(master));
  });

  it('refuses an identity output a framed call is handed as the caller\'s coin', async () => {
    clearGenesisReservations();
    const artifact = framedArtifact();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: 'c3'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    await fundShippedFacets(provider);
    const built = await deployStatefulContract(artifact, [], {
      provider, fundingUtxo, funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: funder.address,
    });
    const alice = new Signer(alicePriv, provider);
    const { genesis, publication } = await identityCoins(provider, alice);
    const call = (callerUtxo: Utxo): Promise<unknown> => callFramedEntry({
      provider, artifact, categoryId: built.categoryId, functionName: 'poke', args: [false], callerUtxo,
      callerLockingBytecode: alice.getLockingBytecode(), funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
    });
    await expect(call(genesis)).rejects.toThrow(/BCMR identity output of category d1d1/);
    await expect(call(publication)).rejects.toThrow(/BCMR identity output of the identity it publishes for/);
    const live = (await alice.getUtxos()).map(outpoint);
    expect(live).toEqual(expect.arrayContaining([outpoint(genesis), outpoint(publication)]));
  });

  it('funds a connected signer\'s child deployment past the identity outputs it holds', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider();
    const alice = new Signer(alicePriv, provider);
    const fundingUtxo = { txid: 'a4'.repeat(32), vout: 0, satoshis: 2_000_000n };
    await provider.addUtxo(alice.getAddress(), fundingUtxo);
    const bundle = ContractBundle.from(compileStringMulti(MAKER), { provider });
    const { contract: maker } = await bundle.deploy('Maker', [alicePub], {
      fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialState: { made: 0n },
    });
    clearGenesisReservations();
    // The identity outputs are the signer's only vout-0 coins that cover a child, so a fresh one is fanned out.
    const { genesis, publication } = await identityCoins(provider, alice);
    const connected = maker.connect(alice) as unknown as {
      make: (s: SignatureTemplate, owner: Uint8Array) => PromiseLike<{ readonly childCategoryId: string }>;
    };
    const { childCategoryId } = await connected.make(new SignatureTemplate(alicePriv), alicePkh);
    expect([genesis.txid, publication.txid]).not.toContain(childCategoryId);
    const live = (await alice.getUtxos()).map(outpoint);
    expect(live).toEqual(expect.arrayContaining([outpoint(genesis), outpoint(publication)]));
  });

  it('fills the index between a framed call\'s token runs with a plain coin, never an identity output', async () => {
    clearGenesisReservations();
    const twin = compileStringMulti(TWIN, { composition: 'framed', evmCompat: true } as never).Twin!;
    const provider = new MockNetworkProvider();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const alice = new Signer(alicePriv, provider);
    await fundShippedFacets(provider);
    const fundingUtxo = { txid: 'a5'.repeat(32), vout: 0, satoshis: 3_000_000n };
    await provider.addUtxo(alice.getAddress(), fundingUtxo);
    const [first, second] = ['a1'.repeat(32), 'a2'.repeat(32)] as const;
    const deployment = await deployStatefulContract(twin, [hexToBin(first), hexToBin(second)], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
    });
    for (const [index, category] of [first, second].entries()) {
      await provider.addUtxo(binToHex(framedTokenContainerLockingBytecode(deployment.categoryId, category)), {
        txid: `b${index + 2}`.repeat(32), vout: 0, satoshis: 1_000n, token: { category, amount: 1_000n },
      });
    }
    clearGenesisReservations();
    const { genesis, publication } = await identityCoins(provider, alice);
    const callerUtxo = { txid: 'b5'.repeat(32), vout: 0, satoshis: 300_000n };
    await provider.addUtxo(alice.getAddress(), callerUtxo);
    const before = (await alice.getUtxos()).filter((utxo) => utxo.token === undefined).map(outpoint);

    const paid = await callFramedEntry({
      provider, artifact: twin, categoryId: deployment.categoryId, functionName: 'payBoth',
      args: [new Signer(bobPriv, provider).getLockingBytecode(), 10n, 20n], callerUtxo,
      callerLockingBytecode: alice.getLockingBytecode(), funder: alice.unlockP2PKH(), vm,
    });
    expect(paid.verdicts.filter((verdict) => !verdict.accepted)).toEqual([]);
    expect(paid.broadcast).toBeDefined();
    // The identity outputs lead the caller's coins, so a filler that did not hold them out would take one.
    const live = (await alice.getUtxos()).map(outpoint);
    expect(live).toEqual(expect.arrayContaining([outpoint(genesis), outpoint(publication)]));
    // The caller's coin and one plain coin beside it entered the call.
    const spent = before.filter((key) => !live.includes(key));
    expect(spent).toContain(outpoint(callerUtxo));
    expect(spent).toHaveLength(2);
  }, 900_000);

  it('fans plain coins out of the largest plain coin, never a larger identity output', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider();
    const alice = new Signer(alicePriv, provider);
    const { genesis, publication } = await identityCoins(provider, alice);
    const identities = [outpoint(genesis), outpoint(publication)];
    // The two changes are the only plain coins, so four take a split of one.
    const coins = await fanOutPlainUtxos(alice, 4);
    expect(coins?.length).toBeGreaterThanOrEqual(4);
    for (const coin of coins ?? []) expect(identities).not.toContain(outpoint(coin));
    const live = (await alice.getUtxos()).map(outpoint);
    expect(live).toEqual(expect.arrayContaining(identities));
    // The split took the publication's change, the largest plain coin.
    expect(live).not.toContain(`${publication.txid}:2`);
  });
});
