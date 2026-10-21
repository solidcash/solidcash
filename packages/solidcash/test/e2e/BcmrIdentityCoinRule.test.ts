/**
 * The identity-output rule (docs/bcmr/DESIGN.md 4.4): a vout-0 coin whose transaction is a token genesis, or carries
 * a BCMR output, is an identity output, and no fee or funding the SDK picks spends one. Each test clears the
 * reservations the way a later session starts, so only the coin's own transaction marks it.
 */
import { binToHex, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS } from '../../../solidc/test/framed/machine.js';
import { publicationOutput, publishMetadata } from '../../src/bcmr/index.js';
import { FramedFunctionCall } from '../../src/framed/call/handle.js';
import { ownCoinRefusal } from '../../src/framed/deploy/own-coin.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import Signer from '../../src/Signer.js';
import {
  clearGenesisReservations, genesisOutpointKey, reserveGenesisOutpoint,
} from '../../src/stateful/genesis-reservations.js';
import { StatefulContract } from '../../src/stateful/index.js';
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
const FRAMED = 'pragma solidcash ^0.13.0; contract C { int n;'
  + ' function poke(bool go) { if (go) this.n = this.n + 1; else this.n = this.n + 1; require(this.n > 0); }'
  + ' function touch() { this.n = this.n + 1; require(this.n > 0); } }';

const TIMESTAMP = '2026-10-20T12:00:00.000Z';

const outpoint = (utxo: Pick<Utxo, 'txid' | 'vout'>): string => `${utxo.txid}:${utxo.vout}`;

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
    const artifact = compileStringMulti(FRAMED, { composition: 'framed' }).C!;
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

  it('funds a direct call without the deployer identity output or a reserved coin', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider();
    const alice = new Signer(alicePriv, provider);
    const fundingUtxo = { txid: 'b1'.repeat(32), vout: 0, satoshis: 2_000_000n };
    await provider.addUtxo(alice.getAddress(), fundingUtxo);
    const deployed = await StatefulContract.deploy(compileString(EMITTER, { forceStateful: true }), [], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialState: {},
    });
    const identity = { txid: deployed.tx.txid, vout: 0 };
    const change = { txid: deployed.tx.txid, vout: deployed.tx.outputs.length - 1 };
    clearGenesisReservations();
    const reserved = { txid: 'b2'.repeat(32), vout: 0, satoshis: 50_000n };
    await provider.addUtxo(alice.getAddress(), reserved);
    reserveGenesisOutpoint(genesisOutpointKey(reserved.txid, 0));

    const emitter = deployed.contract.connect(alice) as unknown as { bump: () => { send: () => Promise<unknown> } };
    await emitter.bump().send();
    const live = (await alice.getUtxos()).map(outpoint);
    expect(live).toContain(outpoint(identity));
    expect(live).toContain(outpoint(reserved));
    // The wallet did pay: the deployment's change funded the call's slots.
    expect(live).not.toContain(outpoint(change));
  });

  it('keeps a rotated key identity an identity output: the update carries the current publication over', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider();
    const alice = new Signer(alicePriv, provider);
    const bob = new Signer(bobPriv, provider);
    const fundingUtxo = { txid: 'e1'.repeat(32), vout: 0, satoshis: 2_000_000n };
    const fee = { txid: 'e2'.repeat(32), vout: 1, satoshis: 100_000n };
    await provider.addUtxo(alice.getAddress(), fundingUtxo);
    await provider.addUtxo(alice.getAddress(), fee);
    const deployed = await StatefulContract.deploy(compileString(COUNTER, { forceStateful: true }), [], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialState: {},
      bcmr: { name: 'Counter', timestamp: TIMESTAMP },
    });
    const identity = deployed.identity!;
    const update = await publishMetadata({
      provider,
      identity: { txid: identity.txid, vout: 0, satoshis: identity.satoshis },
      current: { kind: 'key', unlocker: alice.unlockP2PKH() },
      next: { kind: 'key', lockingBytecode: bob.getLockingBytecode() },
      feeFunding: { utxo: fee, unlocker: alice.unlockP2PKH() },
      changeAddress: alice.getAddress(),
    });
    expect(binToHex(update.tx.outputs[0]!.lockingBytecode)).toBe(binToHex(bob.getLockingBytecode()));
    expect(binToHex(update.tx.outputs[1]!.lockingBytecode)).toBe(binToHex(deployed.tx.outputs[1]!.lockingBytecode));

    clearGenesisReservations();
    const rotated = { txid: update.tx.txid, vout: 0, satoshis: update.identity.satoshis };
    expect(await ownCoinRefusal(provider, rotated, bob.getLockingBytecode(), { role: 'caller' }))
      .toMatch(/BCMR identity output of the identity it publishes for/);
  });

  it('refuses a key-held update that has neither a registry nor a publication to carry over', async () => {
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
    const identity = deployed.identity!;
    await expect(publishMetadata({
      provider,
      identity: { txid: identity.txid, vout: 0, satoshis: identity.satoshis },
      current: { kind: 'key', unlocker: alice.unlockP2PKH() },
      next: { kind: 'key', lockingBytecode: bob.getLockingBytecode() },
      feeFunding: { utxo: fee, unlocker: alice.unlockP2PKH() },
      changeAddress: alice.getAddress(),
    })).rejects.toThrow(/no publication to carry over/);
  });
});
