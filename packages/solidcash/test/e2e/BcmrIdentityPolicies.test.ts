/**
 * Identity policies at deployment (docs/bcmr/DESIGN.md, 4.2 and 4.3): an AuthGuard keyed to an AuthKey category
 * minted beforehand, the AuthKey refusals, and the default key lock with the sender, funder and change locks distinct.
 */
import { binToHex } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS } from '../../../solidc/test/framed/machine.js';
import {
  authGuardLockingBytecode, publishMetadata, withSnapshot, type IdentityPolicy, type IdentityRecord,
} from '../../src/bcmr/index.js';
import type { Unlocker, Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import Signer from '../../src/Signer.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { compileString } from '../direct-compile.js';
import { alicePriv, bobPriv, carolPriv } from '../fixture/vars.js';
import { fundShippedFacets } from '../framed/shapes/harness.js';

const COUNTER = `pragma solidcash >=0.8.0;
contract Counter() {
  int count;
  function bump() { this.count = this.count + 1; require(this.count > 0); }
}`;

const FRAMED = 'pragma solidcash ^0.13.0; contract C { int n;'
  + ' function touch() { this.n = this.n + 1; require(this.n > 0); } }';

const TIMESTAMP = '2026-10-20T12:00:00.000Z';

// The coin helpers of BcmrDeployment.test.ts.
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

describe('an AuthGuard keyed to an AuthKey category minted beforehand', () => {
  it('guards the identity without minting an AuthKey, and the existing AuthKey publishes an update', async () => {
    const provider = new MockNetworkProvider();
    const alice = await signerWithCoins(provider, 4);
    // K comes from an earlier token genesis of its own, its AuthKey at that transaction's output 0.
    const keyCoin = await genesisCoin(alice);
    const authKeyCategory = keyCoin.txid;
    await new TransactionBuilder({ provider })
      .addInput(keyCoin, alice.unlockP2PKH())
      .addOutput({
        to: alice.getLockingBytecode(),
        amount: 1000n,
        token: { category: authKeyCategory, amount: 0n, nft: { capability: 'none', commitment: '' } },
      })
      .addOutput({ to: alice.getAddress(), amount: keyCoin.satoshis - 3000n })
      .send();
    const authKey = (await alice.getUtxos()).find((utxo) => utxo.token?.category === authKeyCategory)!;

    const deployed = await StatefulContract.deploy(compileString(COUNTER, { forceStateful: true }), [], {
      provider,
      fundingUtxo: await genesisCoin(alice, [keyCoin]),
      funder: alice.unlockP2PKH(),
      changeAddress: alice.getAddress(),
      initialState: {},
      identity: { kind: 'authguard', authKeyCategory },
      bcmr: { name: 'Guarded', timestamp: TIMESTAMP },
    });
    const guardLock = binToHex(authGuardLockingBytecode(authKeyCategory));
    expect(binToHex(deployed.tx.outputs[0]!.lockingBytecode)).toBe(guardLock);
    // The genesis spends only its funding coin and mints nothing of K, so the master follows the publication.
    expect(deployed.tx.inputs).toHaveLength(1);
    expect(deployed.tx.outputs.some((output) => output.token !== undefined
      && binToHex(output.token.category) === authKeyCategory)).toBe(false);
    expect(deployed.tx.outputs[2]!.token?.nft?.capability).toBe('minting');
    expect(deployed.identity).toMatchObject({ policy: 'authguard', authKeyCategory });
    expect(deployed.registry!.registry.identities![deployed.categoryId]![TIMESTAMP]!.extensions)
      .toEqual({ authNft: authKeyCategory });

    const update = await publishMetadata({
      provider,
      identity: { txid: deployed.tx.txid, vout: 0, satoshis: deployed.identity!.satoshis },
      current: { kind: 'authguard', authKeyCategory, authKey, authKeyUnlocker: alice.unlockP2PKH() },
      registry: withSnapshot(
        deployed.registry!.registry, deployed.categoryId, { name: 'Guarded v2' }, '2026-10-21T12:00:00.000Z',
      ),
      feeFunding: { utxo: await feeCoin(alice, deployed.identity!), unlocker: alice.unlockP2PKH() },
      changeAddress: alice.getAddress(),
    });
    expect(binToHex(update.tx.outputs[0]!.lockingBytecode)).toBe(guardLock);
    expect(binToHex(update.tx.outputs[2]!.token!.category)).toBe(authKeyCategory);
    expect(update.identity).toMatchObject({ policy: 'authguard', authKeyCategory });
  });
});

describe('the AuthKey refusals', () => {
  it('refuses an AuthKey funding coin off vout 0, and an AuthKey category equal to the contract\'s', async () => {
    const provider = new MockNetworkProvider();
    // Two funding transactions of two coins each, so the signer also holds coins at vout 1.
    const [signer] = await provider.getSigners(1, { fundingUtxos: 4, genesisFundingUtxos: 2 });
    const alice = signer as unknown as Signer;
    const artifact = compileString(COUNTER, { forceStateful: true });
    const fundingUtxo = await genesisCoin(alice);
    const deploy = async (identity: IdentityPolicy): Promise<unknown> => StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialState: {}, identity,
    });

    const offVoutZero = (await alice.getUtxos()).find((utxo) => utxo.vout === 1 && utxo.token === undefined)!;
    await expect(deploy({ kind: 'authguard', authKeyFunding: offVoutZero }))
      .rejects.toThrow(/AuthKey funding coin must be at vout 0 to create a category, got vout 1/);
    // K equal to C, minted in the genesis or named as minted beforehand (in any case).
    const contractCategory: IdentityPolicy[] = [
      { kind: 'authguard', authKeyFunding: fundingUtxo },
      { kind: 'authguard', authKeyCategory: fundingUtxo.txid.toUpperCase() },
    ];
    for (const identity of contractCategory) {
      await expect(deploy(identity)).rejects.toThrow(/AuthKey category must differ from the contract category/);
    }
    // Nothing was broadcast: the funding coin is still there.
    expect((await alice.getUtxos()).some((utxo) => utxo.txid === fundingUtxo.txid && utxo.vout === 0)).toBe(true);
  });
});

/** A 25-byte lock that is not P2PKH: it drops a 23-byte push, so `OP_1` spends it. */
const BARE_LOCK = Uint8Array.from([0x17, ...Array<number>(23).fill(0xab), 0x75]);
const BARE_FUNDER: Unlocker = {
  generateLockingBytecode: () => BARE_LOCK,
  generateUnlockingBytecode: () => Uint8Array.of(0x51),
};

const BUILDERS = [
  {
    builder: 'direct',
    provider: (): MockNetworkProvider => new MockNetworkProvider(),
    artifact: (): Artifact => compileString(COUNTER, { forceStateful: true }),
    options: { initialState: {} },
  },
  {
    builder: 'framed',
    provider: (): MockNetworkProvider => new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS }),
    artifact: (): Artifact => compileStringMulti(FRAMED, { composition: 'framed' }).C!,
    options: {},
  },
];

describe('the default key lock (4.3)', () => {
  for (const { builder, provider: newProvider, artifact: compile, options } of BUILDERS) {
    it(`takes the stated sender lock, else a P2PKH funder's, else the change address (${builder})`, async () => {
      const provider = newProvider();
      if (builder === 'framed') await fundShippedFacets(provider);
      const artifact = compile();
      const [alice, bob, carol] = [alicePriv, bobPriv, carolPriv].map((key) => new Signer(key, provider));
      let deployments = 0;
      const identityLock = async (funder: Unlocker, senderLockingBytecode?: Uint8Array): Promise<string> => {
        deployments += 1;
        const txid = `${builder === 'direct' ? 'd' : 'f'}${deployments}`.padEnd(64, '7');
        const fundingUtxo = { txid, vout: 0, satoshis: 2_000_000n };
        await provider.addUtxo(binToHex(funder.generateLockingBytecode()), fundingUtxo);
        const result = await StatefulContract.deploy(artifact, [], {
          provider, fundingUtxo, funder, changeAddress: bob.getAddress(), ...options,
          ...(senderLockingBytecode === undefined ? {} : { senderLockingBytecode }),
        });
        return binToHex(result.tx.outputs[0]!.lockingBytecode);
      };

      // Three distinct locks: carol is the stated sender, alice the P2PKH funder, bob the change address.
      expect(await identityLock(alice.unlockP2PKH(), carol.getLockingBytecode()))
        .toBe(binToHex(carol.getLockingBytecode()));
      expect(await identityLock(alice.unlockP2PKH())).toBe(binToHex(alice.getLockingBytecode()));
      // A 25-byte funder lock of another shape is not P2PKH: the change address holds the identity.
      expect(await identityLock(BARE_FUNDER)).toBe(binToHex(bob.getLockingBytecode()));
    });
  }
});
