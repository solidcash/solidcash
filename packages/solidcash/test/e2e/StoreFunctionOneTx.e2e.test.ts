import { describe, it, expect } from 'vitest';
import { compileStringMulti } from 'solidc';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// One-tx store_function (LOCAL pointer, the corpus shape `x = (new Other()).m; x()`): deploy Other and call
// its method through a local fn-ptr, all in one tx - the same-tx call folds into Other's deploy genesis
// (Other is born in its post-call state; a UTXO output cannot be spent as an input of the same tx).
const SRC = `contract Other { int c;
  function bump() external { this.c = this.c + 1; require(true); } }
contract Factory { int n;
  function run() public {
    function() external p = (new Other()).bump;
    p();
    this.n = this.n + 1;
  }
}`;

describe('one-tx store_function via a local fn-ptr (deploy + fold-call)', () => {
  const arts = compileStringMulti(SRC, { solidityImportCompat: true });
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  it('deploys Other and folds the pointer call into its genesis', async () => {
    const deployFunding: Utxo = { txid: 'cc01'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, deployFunding);
    const deployed = await StatefulContract.deploy(arts.Factory, [], {
      provider,
      fundingUtxo: deployFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { n: 0n },
      changeAddress: p2pkh.address,
    });
    const factory = deployed.contract;

    const runFunding: Utxo = { txid: 'cc02'.repeat(16), vout: 0, satoshis: 100000n };
    await provider.addUtxo(p2pkh.address, runFunding);
    const out = await StatefulContract.deployFrom({
      provider,
      factory,
      deployFunctionName: 'run',
      deployFunctionArgs: [],
      childArtifact: arts.Other,
      childConstructorArgs: [],
      childInitialState: { c: 0n },
      fundingUtxo: runFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });
    expect(out.tx.txid).toBeDefined();
    // Other is born already-bumped (the folded call): c == 1.
    expect((await (out.child as StatefulContract).getState()).c).toBe(1n);
    expect((await factory.getState()).n).toBe(1n);
  });
});
