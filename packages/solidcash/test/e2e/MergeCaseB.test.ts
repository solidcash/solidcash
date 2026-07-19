import { describe, it, expect } from 'vitest';
import { vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, Signer, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, getEntryNftAddress, SortedList } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePriv, alicePub, alicePkh, aliceAddress, bobPriv, bobPub, bobAddress, carolAddress } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// CASE (b): a NEW recipient whose bracketing predecessor is ANOTHER CREDITED recipient (not the debited msg.sender).
// LE-slot order is bob < carol < alice. Seed bob(sender) + carol(existing). multiTransfer([carol, alice]): carol is
// UPDATED (existing) and is ALSO alice's predecessor; alice is NEW and inserts right after carol. carol must be
// co-spent ONCE serving both its own value-update and alice's insert re-point - the FOLD-into-predecessor construction.
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
  function chk(address a, int exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(this.bal[a] == exp); }
}`;

describe('CASE (b): NEW recipient whose predecessor is another CREDITED recipient (fold)', () => {
  const provider = createTestProvider();
  const aliceSig = new SignatureTemplate(alicePriv);
  const bobSig = new SignatureTemplate(bobPriv);
  const bob = new Signer(bobPriv, provider);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0xb000;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };

  it('updates carol (existing) AND inserts alice (new, predecessor carol) in one multiTransfer', async () => {
    const art = compileString(SRC, { forceStateful: true });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract, categoryId } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, aliceSig), initialState: {}, changeAddress: p2pkh.address,
    });
    const ea = getEntryNftAddress(contract.inner, categoryId, 'bal');
    const valOf = async (addr: string): Promise<bigint | undefined> => {
      const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(addressToLockScript(addr)));
      return e ? vmNumberToBigInt(e.value, { requireMinimalEncoding: false }) as bigint : undefined;
    };
    const setBal = (a: string, v: bigint): Promise<unknown> =>
      (contract as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<unknown> }>)
        .setBal(a, v, alicePub, aliceSig).send();
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n }); await setBal(bobAddress, 1000n);
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n }); await setBal(carolAddress, 5n);

    const sc = contract.connect(bob);
    await provider.addUtxo(bob.getAddress(), { txid: uid(), vout: 0, satoshis: 200000n });
    await (sc as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<unknown> }>)
      .multiTransfer([carolAddress, aliceAddress], [10n, 20n], bobPub, bobSig).send();
    expect(await valOf(bobAddress)).toBe(970n);    // debited 30
    expect(await valOf(carolAddress)).toBe(15n);    // updated 5 + 10, AND re-pointed to alice
    expect(await valOf(aliceAddress)).toBe(20n);    // inserted (predecessor carol re-pointed)

    // CHAIN VALIDITY: HEAD -> bob -> carol -> alice (no orphan). chk reverts on a broken chain.
    const chk = (a: string, exp: bigint): Promise<unknown> =>
      (contract as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<unknown> }>)
        .chk(a, exp, alicePub, aliceSig).send();
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n });
    await expect(chk(aliceAddress, 20n)).resolves.toBeDefined();  // alice reachable through carol's re-point
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n });
    await expect(chk(carolAddress, 15n)).resolves.toBeDefined();
  });

  it('is ORDER-INDEPENDENT: the SDK reorders [alice(new), carol(update)] so the predecessor is adjacent', async () => {
    // Caller passes the new recipient BEFORE its credited predecessor: multiTransfer([alice(new), carol(update)]).
    // alice's predecessor is carol, but carol is listed after alice. The SDK's adjacency reorder swaps them (preserving
    // each recipient's amount) to [carol, alice] so the covenant fold applies. Same result as the adjacent case.
    const art = compileString(SRC, { forceStateful: true });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract, categoryId } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, aliceSig), initialState: {}, changeAddress: p2pkh.address,
    });
    const ea = getEntryNftAddress(contract.inner, categoryId, 'bal');
    const valOf = async (addr: string): Promise<bigint | undefined> => {
      const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(addressToLockScript(addr)));
      return e ? vmNumberToBigInt(e.value, { requireMinimalEncoding: false }) as bigint : undefined;
    };
    const setBal = (a: string, v: bigint): Promise<unknown> =>
      (contract as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<unknown> }>)
        .setBal(a, v, alicePub, aliceSig).send();
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n }); await setBal(bobAddress, 1000n);
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n }); await setBal(carolAddress, 5n);
    const sc = contract.connect(bob);
    await provider.addUtxo(bob.getAddress(), { txid: uid(), vout: 0, satoshis: 200000n });
    // caller order [alice(new), carol(update)], amounts [20, 10] -> alice+=20, carol+=10 (pairing preserved by reorder)
    await (sc as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<unknown> }>)
      .multiTransfer([aliceAddress, carolAddress], [20n, 10n], bobPub, bobSig).send();
    expect(await valOf(bobAddress)).toBe(970n);   // debited 30
    expect(await valOf(carolAddress)).toBe(15n);   // 5 + 10
    expect(await valOf(aliceAddress)).toBe(20n);   // new, +20
  });
});
