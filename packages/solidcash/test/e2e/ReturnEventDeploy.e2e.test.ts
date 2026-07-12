import { describe, it, expect } from 'vitest';
import { compileStringMulti } from 'solidc';
import { decodePushdataValue } from '@solidcash/utils';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Isolate the return-event x deploy interaction: a value-RETURNING deploy entry that ALSO deploys a child in the
// same tx. No fn-ptrs. t returns addTwo(7)==9 (an external call folded into Other's genesis) AND t itself returns
// that value via its own return-event (B8-emit). The two return paths + the deploy slot collide at send.
const SRC = `contract Other {
  int c;
  function addTwo(int v) external returns (int) { return v + 2; }
}
contract C {
  int result;
  function t() public returns (int) { return (new Other()).addTwo(7); }
}`;

describe('return-event x deploy: value-returning entry that also deploys', () => {
  const arts = compileStringMulti(SRC, { solidityImportCompat: true });
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  it('deploys Other, folds addTwo(7), and returns 9', async () => {
    const deployFunding: Utxo = { txid: 'cc01'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, deployFunding);
    const deployed = await StatefulContract.deploy(arts.C, [], {
      provider,
      fundingUtxo: deployFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { result: 0n },
      changeAddress: p2pkh.address,
    });
    const c = deployed.contract;

    const tFunding: Utxo = { txid: 'cc02'.repeat(16), vout: 0, satoshis: 100000n };
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

    // The child (Other) is deployed at the self-pinned genesis address.
    expect((out.child as StatefulContract).categoryId).toBe(tFunding.txid);

    // Output layout: [factory master(0), returnEvent(1), child master(2), child data NFT(3)]. Decode the
    // return-event NFT commitment and confirm the covenant computed + emitted addTwo(7) == 9. (send() only
    // proves the SDK and covenant agree on the value; decoding proves the value is actually 9.)
    const retOut = out.tx.outputs[1];
    // The return event rides the FACTORY category (byte order is provider-dependent: compare both ways).
    const catHex = Buffer.from(retOut.token!.category).toString('hex');
    const catRevHex = Buffer.from(retOut.token!.category).reverse().toString('hex');
    expect([catHex, catRevHex]).toContain(c.categoryId);
    // Anyone-can-spend (OP_TRUE) return event, no capability, zero FT.
    expect(Buffer.from(retOut.lockingBytecode).toString('hex')).toBe('51');
    const decoded = decodePushdataValue(retOut.token!.nft!.commitment, 0, 'int256', arts.C.structs).value;
    expect(decoded).toBe(9n);
  });
});
