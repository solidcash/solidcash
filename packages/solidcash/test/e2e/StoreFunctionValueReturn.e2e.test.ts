import { describe, it, expect } from 'vitest';
import { compileStringMulti } from 'solidc';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// store_function with a VALUE-returning callee: install() deploys Other and stores its addTwo method as a
// fn-ptr; run() co-spends the deployed Other through the stored pointer and captures addTwo(7)==9 via the
// return-event NFT. The void-callee split is covered by StoreFunctionSplit; this is the value-returning form,
// which threads the callee's return through the fixed return-event section (order-independent extraction).
const SRC = `contract Other { int c;
  function addTwo(int x) external returns (int) { this.c = this.c + 1; return x + 2; } }
contract C {
  function(int) external returns (int) stored;
  int result;
  function install() public { Other o = new Other(); stored = Other(o).addTwo; require(true); }
  function run() public { this.result = stored(7); }
}`;

describe('store_function split: value-returning freshly-deployed method + capture return', () => {
  const arts = compileStringMulti(SRC, { solidityImportCompat: true });
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  it('installs then runs, capturing addTwo(7)==9 via the return-event NFT', async () => {
    const deployFunding: Utxo = { txid: 'bb01'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, deployFunding);
    const deployed = await StatefulContract.deploy(arts.C, [], {
      provider,
      fundingUtxo: deployFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { stored: new Uint8Array(), result: 0n },
      changeAddress: p2pkh.address,
    });
    const c = deployed.contract;

    const installFunding: Utxo = { txid: 'bb02'.repeat(16), vout: 0, satoshis: 100000n };
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

    await provider.addUtxo(c.address, { txid: 'bb03'.repeat(16), vout: 0, satoshis: 100000n });
    await c.run().withExternalCall(otherChild, 'addTwo', [7n]).send();
    expect((await otherChild.getState()).c).toBe(1n);
    expect((await c.getState()).result).toBe(9n);
  });
});
