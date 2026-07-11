import { describe, it, expect } from 'vitest';
import { compileStringMulti } from 'solidc';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// store_function (split across txs): install() DEPLOYS Other and stores its freshly-deployed method as a
// fn-ptr (`stored = Other(o).addTwo`, the fixed-method pass -> stored = the child's genesis address); run()
// co-spends the deployed Other through the stored pointer. Proves a DEPLOYED contract's method can be captured
// into a fn-ptr and later called - the split (two-tx) form of store_function.
const SRC = `contract Other { int c;
  function bump() external { this.c = this.c + 1; require(true); } }
contract C {
  function() external stored;
  bigint bumps;
  function install() public { Other o = new Other(); stored = Other(o).bump; require(true); }
  function run() public { stored(); this.bumps = this.bumps + 1; }
}`;

describe('store_function split: deploy a child, store its method as a fn-ptr, call it later', () => {
  const arts = compileStringMulti(SRC, { solidityImportCompat: true });
  const cArtifact = arts.C;
  const otherArtifact = arts.Other;
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  it('installs (deploys Other + stores its method) then runs (co-spends Other)', async () => {
    const deployFunding: Utxo = { txid: 'aa01'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, deployFunding);
    const deployed = await StatefulContract.deploy(cArtifact, [], {
      provider,
      fundingUtxo: deployFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { stored: new Uint8Array(), bumps: 0n },
      changeAddress: p2pkh.address,
    });
    const c = deployed.contract;

    // tx1: install() folds the deploy of Other into the genesis and stores its address in `stored`.
    const installFunding: Utxo = { txid: 'aa02'.repeat(16), vout: 0, satoshis: 100000n };
    await provider.addUtxo(p2pkh.address, installFunding);
    const installed = await StatefulContract.deployFrom({
      provider,
      factory: c,
      deployFunctionName: 'install',
      deployFunctionArgs: [],
      childArtifact: otherArtifact,
      childConstructorArgs: [],
      childInitialState: { c: 0n },
      fundingUtxo: installFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });
    expect(installed.tx.txid).toBeDefined();
    const otherChild = installed.child as StatefulContract;

    // stored now holds Other's freshly-deployed genesis address (a p2sh32 locking bytecode).
    const st = (await c.getState()).stored as Uint8Array;
    expect(Buffer.from(st).toString('hex')).toBe(otherChild.inner.lockingBytecode);

    // tx2: run() co-spends Other through the stored pointer + calls bump.
    await provider.addUtxo(c.address, { txid: 'aa03'.repeat(16), vout: 0, satoshis: 100000n });
    const runTx = await c.run()
      .withExternalCall(otherChild, 'bump', [])
      .send();
    expect(runTx.txid).toBeDefined();
    expect((await otherChild.getState()).c).toBe(1n);  // bump incremented Other's counter
    expect((await c.getState()).bumps).toBe(1n);
  });
});
