import { describe, it, expect } from 'vitest';
import { compileStringMulti } from 'solidc';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// A contract instance's method accessed as a fn-ptr VALUE via the DIRECT member form `o.bump` (not the cast
// `Other(o).bump`): DesugarContractMemberFnPtr rewrites it to the recognised member form. install() deploys
// Other and stores o.bump; run() co-spends the deployed Other through the stored pointer.
const SRC = `contract Other { int c;
  function bump() external { this.c = this.c + 1; require(true); } }
contract C {
  function() external stored;
  bigint bumps;
  function install() public { Other o = new Other(); stored = o.bump; require(true); }
  function run() public { stored(); this.bumps = this.bumps + 1; }
}`;

describe('contract-member fn-ptr value via direct `o.method` syntax', () => {
  const arts = compileStringMulti(SRC, { solidityImportCompat: true });
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  it('installs (deploys Other + stores o.bump) then runs (co-spends Other)', async () => {
    const deployFunding: Utxo = { txid: 'ee01'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, deployFunding);
    const deployed = await StatefulContract.deploy(arts.C, [], {
      provider,
      fundingUtxo: deployFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { stored: new Uint8Array(), bumps: 0n },
      changeAddress: p2pkh.address,
    });
    const c = deployed.contract;

    const installFunding: Utxo = { txid: 'ee02'.repeat(16), vout: 0, satoshis: 100000n };
    await provider.addUtxo(p2pkh.address, installFunding);
    const installed = await StatefulContract.deployFrom({
      provider,
      factory: c,
      deployFunctionName: 'install',
      deployFunctionArgs: [],
      childArtifact: arts.Other,
      childConstructorArgs: [],
      childInitialState: { c: 0n },
      fundingUtxo: installFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });
    const otherChild = installed.child as StatefulContract;
    // stored holds Other's freshly-deployed genesis address.
    expect(Buffer.from((await c.getState()).stored as Uint8Array).toString('hex'))
      .toBe(otherChild.inner.lockingBytecode);

    await provider.addUtxo(c.address, { txid: 'ee03'.repeat(16), vout: 0, satoshis: 100000n });
    await c.run().withExternalCall(otherChild, 'bump', []).send();
    expect((await otherChild.getState()).c).toBe(1n);
    expect((await c.getState()).bumps).toBe(1n);
  });
});
