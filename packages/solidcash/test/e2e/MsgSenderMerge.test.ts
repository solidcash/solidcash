import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, Signer, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh, bobPriv, bobPub, bobAddress, carolAddress } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// The full multiTransfer where a NEW recipient's bracketing predecessor is the DEBITED msg.sender (case a-real).
// LE-slot order for the fixtures is bob < carol < alice, so with bob = msg.sender and carol a new recipient, carol's
// predecessor is bob = msg.sender. The debit entry (bob) is co-spent once; its flush must re-point nextKey to carol.
const SRC = `contract Token() {
  mapping(address => int) bal;
  function setBal(address a, int v, pubkey pk, sig s) { require(checkSig(s, pk)); this.bal[a] = v; }
  function multiTransfer(address[] recipients, int[] amounts, pubkey pk, sig s) {
    require(checkSig(s, pk));
    for (int i = 0; i < recipients.length; i++) {
      this.bal[msg.sender] -= amounts[i];
      this.bal[recipients[i]] += amounts[i];
    }
  }
}`;

describe('FULL multiTransfer: NEW recipient whose predecessor is msg.sender (merge)', () => {
  const provider = createTestProvider();
  const aliceSig = new SignatureTemplate(alicePriv);
  const bobSig = new SignatureTemplate(bobPriv);
  const bob = new Signer(bobPriv, provider);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0xa000;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };

  // This is the BATCH-UPSERT MERGE case (deferrals: "batch-upsert merge"). It currently FAILS CLOSED with a clear
  // message - the debit entry (bob) cannot be co-spent twice (once by the cached debit, once as carol's insert
  // predecessor). Merging both effects onto bob's single output (debited value + a nextKey re-point to carol) is a
  // dedicated fund-guarding build (design in deferrals). This test pins the SOUND fail-closed behavior until then.
  it('fails closed cleanly (merge not yet built) - the debit entry cannot be co-spent twice', async () => {
    const art = compileString(SRC, { forceStateful: true });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, aliceSig), initialState: {}, changeAddress: p2pkh.address,
    });
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n });
    await (contract as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<unknown> }>)
      .setBal(bobAddress, 1000n, alicePub, aliceSig).send();

    const sc = contract.connect(bob);
    await provider.addUtxo(bob.getAddress(), { txid: uid(), vout: 0, satoshis: 200000n });
    await expect((sc as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<unknown> }>)
      .multiTransfer([carolAddress], [20n], bobPub, bobSig).send())
      .rejects.toThrow(/predecessor is already co-spent|split into separate/i);
  });
});
