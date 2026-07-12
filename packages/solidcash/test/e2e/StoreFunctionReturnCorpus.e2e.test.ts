import { describe, it, expect } from 'vitest';
import { compileStringMulti } from 'solidc';
import { decodePushdataValue } from '@solidcash/utils';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// The Solidity corpus store_function.sol (functionTypes/store_function.sol) VERBATIM, uint->int: t() RETURNS
// the value (`return ev(x)`) while ALSO deploying Other and storing addTwo via the store helper. This is the
// full return-event x deploy combination on top of the whole fn-ptr stack (ev-alias elimination + eval
// beta-reduction + interprocedural deploy fold + contract-member fn-ptr). Corpus expects t() -> 9.
const SRC = `contract Other {
  int c;
  function addTwo(int v) external returns (int) { return v + 2; }
}
contract C {
  function (function (int) external returns (int)) internal returns (int) ev;
  function (int) external returns (int) x;
  function store(function(int) external returns (int) y) public { this.x = y; require(true); }
  function eval(function(int) external returns (int) y) public returns (int) { return y(7); }
  function t() public returns (int) { ev = eval; this.store((new Other()).addTwo); return ev(x); }
}`;

describe('store_function corpus (returning form): t() -> 9', () => {
  const arts = compileStringMulti(SRC, { solidityImportCompat: true });
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  it('deploys Other, folds through ev/eval, and RETURNS 9 via the return-event NFT', async () => {
    const deployFunding: Utxo = { txid: 'dd01'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, deployFunding);
    const deployed = await StatefulContract.deploy(arts.C, [], {
      provider,
      fundingUtxo: deployFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { x: new Uint8Array(), __fnsel_x: new Uint8Array(4) },
      changeAddress: p2pkh.address,
    });
    const c = deployed.contract;

    const tFunding: Utxo = { txid: 'dd02'.repeat(16), vout: 0, satoshis: 100000n };
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

    // Decode the return-event NFT commitment: t() must have returned addTwo(7) == 9.
    const retOut = out.tx.outputs.find(
      (o) => o.token && Buffer.from(o.lockingBytecode).toString('hex') === '51' && o.token.nft,
    );
    expect(retOut).toBeDefined();
    const decoded = decodePushdataValue(retOut!.token!.nft!.commitment, 0, 'int256', arts.C.structs).value;
    expect(decoded).toBe(9n);

    // x holds the freshly-deployed Other's genesis address (store kept it received for later txs).
    expect(Buffer.from((await c.getState()).x as Uint8Array).toString('hex'))
      .toBe((out.child as StatefulContract).inner.lockingBytecode);
  });
});
