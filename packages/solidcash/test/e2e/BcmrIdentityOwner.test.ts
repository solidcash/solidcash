/**
 * The identity's owner at deployment (docs/bcmr/DESIGN.md, 4.2 and 4.3): the authhead NFT's commitment names a stated
 * owner, or by default the sender, the P2PKH funder or the change address; owners that leave nobody in control are
 * refused before anything is broadcast.
 */
import { binToHex, encodeLockingBytecodeP2sh20 } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS } from '../../../solidc/test/framed/machine.js';
import { authheadLockingBytecode, type IdentityOptions } from '../../src/bcmr/index.js';
import type { Unlocker, Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import Signer from '../../src/Signer.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { compileString } from '../direct-compile.js';
import { alicePriv, bobPriv, carolPriv } from '../fixture/vars.js';
import { fundShippedFacets } from '../framed/shapes/harness.js';

const COUNTER = `pragma solidcash >=0.8.0;
contract Counter() {
  int count;
  function bump() { this.count = this.count + 1; require(this.count > 0); }
}`;

const FRAMED = 'pragma solidcash ^0.14.0; contract C { int n;'
  + ' function touch() { this.n = this.n + 1; require(this.n > 0); } }';

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

describe('the identity owner', () => {
  for (const { builder, provider: newProvider, artifact: compile, options } of BUILDERS) {
    it(`is the stated owner, else the sender lock, a P2PKH funder's or the change address (${builder})`, async () => {
      const provider = newProvider();
      if (builder === 'framed') await fundShippedFacets(provider);
      const artifact = compile();
      const [alice, bob, carol] = [alicePriv, bobPriv, carolPriv].map((key) => new Signer(key, provider));
      let deployments = 0;
      const ownerOf = async (
        funder: Unlocker, senderLockingBytecode?: Uint8Array, identity?: IdentityOptions,
      ): Promise<string> => {
        deployments += 1;
        const txid = `${builder === 'direct' ? 'd' : 'f'}${deployments}`.padEnd(64, '7');
        const fundingUtxo = { txid, vout: 0, satoshis: 2_000_000n };
        await provider.addUtxo(binToHex(funder.generateLockingBytecode()), fundingUtxo);
        const result = await StatefulContract.deploy(artifact, [], {
          provider, fundingUtxo, funder, changeAddress: bob.getAddress(), ...options,
          ...(senderLockingBytecode === undefined ? {} : { senderLockingBytecode }),
          ...(identity === undefined ? {} : { identity }),
        });
        const [output] = result.tx.outputs;
        expect(binToHex(output!.lockingBytecode)).toBe(binToHex(authheadLockingBytecode(result.categoryId)));
        return binToHex(output!.token!.nft!.commitment);
      };

      // Three distinct locks: carol is the stated sender, alice the P2PKH funder, bob the change address.
      expect(await ownerOf(alice.unlockP2PKH(), carol.getLockingBytecode())).toBe(binToHex(carol.getLockingBytecode()));
      expect(await ownerOf(alice.unlockP2PKH())).toBe(binToHex(alice.getLockingBytecode()));
      // A 25-byte funder lock of another shape is not P2PKH: the change address owns the identity.
      expect(await ownerOf(BARE_FUNDER)).toBe(binToHex(bob.getLockingBytecode()));
      // A stated owner wins, as a CashAddress or as a P2SH20 lock such as a multisig's.
      expect(await ownerOf(alice.unlockP2PKH(), carol.getLockingBytecode(), { owner: bob.getAddress() }))
        .toBe(binToHex(bob.getLockingBytecode()));
      const multisig = encodeLockingBytecodeP2sh20(new Uint8Array(20).fill(0x5a));
      expect(await ownerOf(alice.unlockP2PKH(), undefined, { owner: multisig })).toBe(binToHex(multisig));
    });
  }

  it('refuses, before broadcasting, an owner that leaves nobody in control', async () => {
    const provider = new MockNetworkProvider();
    const alice = new Signer(alicePriv, provider);
    const fundingUtxo: Utxo = { txid: 'e1'.repeat(32), vout: 0, satoshis: 2_000_000n };
    await provider.addUtxo(alice.getAddress(), fundingUtxo);
    const deploy = async (owner: Uint8Array): Promise<unknown> => StatefulContract.deploy(
      compileString(COUNTER, { forceStateful: true }), [], {
        provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialState: {},
        identity: { owner },
      },
    );
    await expect(deploy(Uint8Array.of(0x6a))).rejects.toThrow(/a P2PKH, P2SH20 or P2SH32 lock/);
    await expect(deploy(authheadLockingBytecode(fundingUtxo.txid))).rejects.toThrow(/cannot own its own identity/);
    expect((await alice.getUtxos()).some((utxo) => utxo.txid === fundingUtxo.txid && utxo.vout === 0)).toBe(true);
  });
});
