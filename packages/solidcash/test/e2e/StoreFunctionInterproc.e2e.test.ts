import { describe, it, expect } from 'vitest';
import { compileStringMulti } from 'solidc';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// The store_function CORE, interprocedural: t() deploys Other, passes its method to a store helper (which stashes
// it in the fn-ptr state var x), then calls x(7) - all one tx. InterproceduralStoreFold rewrites the same-tx
// x(7) to the folded o.addTwo(7), so Other is born in its post-call state and the return (9) is baked in. x
// still holds Other's genesis address for later txs (store keeps it received).
const SRC = `contract Other { int c;
  function addTwo(int v) external returns (int) { return v + 2; } }
contract C {
  function(int) external returns (int) x;
  int result;
  function store(function(int) external returns (int) y) public { this.x = y; require(true); }
  function t() public { this.store((new Other()).addTwo); this.result = x(7); require(true); }
}`;

describe('store_function core: interprocedural deploy fold through a store helper', () => {
  const arts = compileStringMulti(SRC, { solidityImportCompat: true });
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  it('t() deploys Other via store(), folds x(7), and stores result 9', async () => {
    const deployFunding: Utxo = { txid: 'ff01'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, deployFunding);
    const deployed = await StatefulContract.deploy(arts.C, [], {
      provider,
      fundingUtxo: deployFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { x: new Uint8Array(), result: 0n },
      changeAddress: p2pkh.address,
    });
    const c = deployed.contract;

    const tFunding: Utxo = { txid: 'ff02'.repeat(16), vout: 0, satoshis: 100000n };
    await provider.addUtxo(p2pkh.address, tFunding);
    const out = await StatefulContract.deployFrom({
      provider,
      factory: c,
      deployFunctionName: 't',
      deployFunctionArgs: [],
      childArtifact: arts.Other,
      childConstructorArgs: [],
      childInitialState: { c: 0n },
      fundingUtxo: tFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });
    expect(out.tx.txid).toBeDefined();
    // The folded call's return value is baked in: result == addTwo(7) == 9.
    expect((await c.getState()).result).toBe(9n);
    // x holds the freshly-deployed Other's genesis address (store kept it received).
    expect(Buffer.from((await c.getState()).x as Uint8Array).toString('hex'))
      .toBe((out.child as StatefulContract).inner.lockingBytecode);
  });
});
