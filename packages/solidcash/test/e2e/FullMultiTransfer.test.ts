import { describe, it, expect } from 'vitest';
import { vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, Signer, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, getEntryNftAddress, SortedList } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePriv, alicePub, alicePkh, aliceAddress, bobAddress, carolAddress } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// The FULL ERC-20 multiTransfer: debit the caller once, credit each recipient. Combines the cached same-key
// msg.sender DEBIT (`bal[msg.sender] -= amounts[i]`) with the per-iteration UPDATE CREDIT loop
// (`bal[recipients[i]] += amounts[i]`) in ONE transaction.
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

describe('FULL ERC-20 multiTransfer (cached msg.sender debit + credit upsert loop)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const alice = new Signer(alicePriv, provider);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0xf000;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };

  it('debits msg.sender by the total and credits each recipient by its amount', async () => {
    const art = compileString(SRC, { forceStateful: true });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract, categoryId } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    const ea = getEntryNftAddress(contract.inner, categoryId, 'bal');
    const valOf = async (addr: string): Promise<bigint | undefined> => {
      const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(addressToLockScript(addr)));
      return e ? vmNumberToBigInt(e.value, { requireMinimalEncoding: false }) as bigint : undefined;
    };
    const setBal = (a: string, v: bigint): Promise<{ txid: string }> =>
      (contract as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<{ txid: string }> }>)
        .setBal(a, v, alicePub, sig).send();
    const fundSigner = async (): Promise<void> => {
      await provider.addUtxo(alice.getAddress(), { txid: uid(), vout: 0, satoshis: 200000n });
    };
    const fundContract = async (): Promise<void> => {
      await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n });
    };

    // Seed: sender (alice) = 1000, recipients bob = 100, carol = 200 (existing).
    await fundContract(); await setBal(aliceAddress, 1000n);
    await fundContract(); await setBal(bobAddress, 100n);
    await fundContract(); await setBal(carolAddress, 200n);

    // alice.multiTransfer([bob, carol], [10, 20]) -> alice 1000-30=970, bob 110, carol 220.
    const sc = contract.connect(alice);
    await fundSigner();
    await (sc as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<{ txid: string }> }>)
      .multiTransfer([bobAddress, carolAddress], [10n, 20n], alicePub, sig).send();

    expect(await valOf(aliceAddress)).toBe(970n);
    expect(await valOf(bobAddress)).toBe(110n);
    expect(await valOf(carolAddress)).toBe(220n);
  });
});
