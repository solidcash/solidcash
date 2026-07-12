import { describe, it, expect } from 'vitest';
import { compileStringMulti } from 'solidc';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// The Solidity corpus store_function.sol (functionTypes/store_function.sol) chain, adapted to SolidCash (uint ->
// int) with the result captured into state (`this.result = ev(x)`) instead of returned, since a value-RETURNING
// entry point combined with a same-tx deploy is a separate return-event/deploy interaction. t(): ev = eval (an
// internal fn-ptr alias); this.store((new Other()).addTwo) (deploy Other + store the fresh method to state x via
// a store helper); this.result = ev(x) == eval(x) == x(7) == addTwo(7) == 9. Exercises the full stack shipped
// this session: gratuitous ev-alias elimination + eval beta-reduction + interprocedural deploy fold +
// contract-member fn-ptr value + arg-passing.
const SRC = `contract Other {
  int c;
  function addTwo(int v) external returns (int) { return v + 2; }
}
contract C {
  function (function (int) external returns (int)) internal returns (int) ev;
  function (int) external returns (int) x;
  int result;
  function store(function(int) external returns (int) y) public { this.x = y; require(true); }
  function eval(function(int) external returns (int) y) public returns (int) { return y(7); }
  function t() public { ev = eval; this.store((new Other()).addTwo); this.result = ev(x); require(true); }
}`;

describe('store_function ev/eval chain: this.result = ev(x) folds to 9', () => {
  const arts = compileStringMulti(SRC, { solidityImportCompat: true });
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  it('deploys Other, stores + folds through ev/eval, and result == 9', async () => {
    const deployFunding: Utxo = { txid: 'ab01'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, deployFunding);
    const deployed = await StatefulContract.deploy(arts.C, [], {
      provider,
      fundingUtxo: deployFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { x: new Uint8Array(), __fnsel_x: new Uint8Array(4), result: 0n },
      changeAddress: p2pkh.address,
    });
    const c = deployed.contract;

    const tFunding: Utxo = { txid: 'ab02'.repeat(16), vout: 0, satoshis: 100000n };
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
    // The folded chain baked the result: this.result == addTwo(7) == 9.
    expect((await c.getState()).result).toBe(9n);
    // x holds the freshly-deployed Other's genesis address (store kept it received for later txs).
    expect(Buffer.from((await c.getState()).x as Uint8Array).toString('hex'))
      .toBe((out.child as StatefulContract).inner.lockingBytecode);
  });
});
