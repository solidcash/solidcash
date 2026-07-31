import { describe, it, expect } from 'vitest';
import { vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, Signer, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, getEntryNftAddress, SortedList } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePriv, alicePub, alicePkh, aliceAddress, bobPriv, bobPub, bobAddress, carolAddress } from '../fixture/vars.js';
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
  function chk(address a, int exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(this.bal[a] == exp); }
}`;

describe('FULL multiTransfer: NEW recipient whose predecessor is msg.sender (merge)', () => {
  const provider = createTestProvider();
  const aliceSig = new SignatureTemplate(alicePriv);
  const bobSig = new SignatureTemplate(bobPriv);
  const bob = new Signer(bobPriv, provider);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0xa000;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };

  // BATCH-UPSERT MERGE: the debit entry (bob) is co-spent ONCE and re-pointed to the new node (carol), instead of
  // failing closed. bob's single output becomes [bobSlot | carolSlot | 980] (debited value + re-point) and carol is
  // minted [carolSlot | bobOldNext | 20]. Chain: HEAD -> bob -> carol.
  it('debits bob and INSERTS carol (predecessor = bob = msg.sender) in one tx', async () => {
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
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n });
    await (contract as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<unknown> }>)
      .setBal(bobAddress, 1000n, alicePub, aliceSig).send();

    const sc = contract.connect(bob);
    await provider.addUtxo(bob.getAddress(), { txid: uid(), vout: 0, satoshis: 200000n });
    await (sc as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<unknown> }>)
      .multiTransfer([carolAddress], [20n], bobPub, bobSig).send();
    expect(await valOf(bobAddress)).toBe(980n);   // debited
    expect(await valOf(carolAddress)).toBe(20n);   // inserted (predecessor bob re-pointed to carol)

    // CHAIN VALIDITY (no orphan): a covenant read walks HEAD -> bob -> carol. chk reverts if the chain is broken.
    const chk = (a: string, exp: bigint): Promise<unknown> =>
      (contract as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<unknown> }>)
        .chk(a, exp, alicePub, aliceSig).send();
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n });
    await expect(chk(carolAddress, 20n)).resolves.toBeDefined();  // carol reachable through bob's re-point
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n });
    await expect(chk(bobAddress, 980n)).resolves.toBeDefined();
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n });
    await expect(chk(bobAddress, 1000n)).rejects.toThrow('layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.'); // bob was debited, not the old value
  });

  it('merges into a gap with a REAL successor (bob -> carol -> alice), leaving the successor untouched', async () => {
    // Seed bob(sender)=1000 AND alice=500. LE order bob < carol < alice, so the list is HEAD -> bob -> alice and
    // carol lands in bob's gap with a REAL nextKey (alice, not +inf) - exercises the covenant's dNext != 0 branch.
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
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n }); await setBal(aliceAddress, 500n);
    const sc = contract.connect(bob);
    await provider.addUtxo(bob.getAddress(), { txid: uid(), vout: 0, satoshis: 200000n });
    await (sc as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<unknown> }>)
      .multiTransfer([carolAddress], [20n], bobPub, bobSig).send();
    expect(await valOf(bobAddress)).toBe(980n);
    expect(await valOf(carolAddress)).toBe(20n);
    expect(await valOf(aliceAddress)).toBe(500n); // uninvolved successor untouched; chain HEAD -> bob -> carol -> alice
  });

  it('combines an UPDATE recipient and a MERGE recipient in one multiTransfer', async () => {
    // bob(sender)=1000, alice(existing recipient)=500. multiTransfer([alice, carol], [10, 20]): alice updated (+10),
    // carol NEW merged into bob's gap (bob -> carol -> alice). bob debited 30. Exercises merge + update coexistence.
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
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n }); await setBal(aliceAddress, 500n);
    const sc = contract.connect(bob);
    await provider.addUtxo(bob.getAddress(), { txid: uid(), vout: 0, satoshis: 200000n });
    await (sc as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<unknown> }>)
      .multiTransfer([aliceAddress, carolAddress], [10n, 20n], bobPub, bobSig).send();
    expect(await valOf(bobAddress)).toBe(970n);    // debited 30
    expect(await valOf(aliceAddress)).toBe(510n);   // updated +10
    expect(await valOf(carolAddress)).toBe(20n);    // inserted (merged into bob's gap)
  });

  it('CHAINS two new recipients in the debited senders gap (bob -> carol -> alice)', async () => {
    // bob is the only entry, so both carol and alice are new and land in bob's (debit) gap. The debit merge DEFERS the
    // first new node (carol) and re-points bob to it; alice chains off carol via the pending flush. One bob co-spend
    // serves the whole chain: bob -> carol -> alice. bob is debited by 20 + 30 = 50.
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
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n });
    await (contract as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<unknown> }>)
      .setBal(bobAddress, 1000n, alicePub, aliceSig).send();
    const sc = contract.connect(bob);
    await provider.addUtxo(bob.getAddress(), { txid: uid(), vout: 0, satoshis: 200000n });
    await (sc as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<unknown> }>)
      .multiTransfer([carolAddress, aliceAddress], [20n, 30n], bobPub, bobSig).send();
    expect(await valOf(bobAddress)).toBe(950n);   // debited 20 + 30
    expect(await valOf(carolAddress)).toBe(20n);   // new, re-pointed from bob
    expect(await valOf(aliceAddress)).toBe(30n);   // new, chained after carol
    // CHAIN VALIDITY: a read walks HEAD -> bob -> carol -> alice.
    const chk = (a: string, exp: bigint): Promise<unknown> =>
      (contract as unknown as Record<string, (...x: unknown[]) => { send: () => Promise<unknown> }>)
        .chk(a, exp, alicePub, aliceSig).send();
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n });
    await expect(chk(aliceAddress, 30n)).resolves.toBeDefined();
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n });
    await expect(chk(carolAddress, 20n)).resolves.toBeDefined();
  });
});
