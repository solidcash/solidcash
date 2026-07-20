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
// msg.sender DEBIT (`bal[msg.sender] -= amounts[i]`) with the per-iteration CREDIT loop (`bal[recipients[i]] +=
// amounts[i]`) in ONE transaction. The credit handles both UPDATE (existing recipient) and INSERT (new recipient).
// masked LE-slot order for the fixtures: bob < carol < alice.
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

  const deploy = async (): Promise<{
    valOf: (a: string) => Promise<bigint | undefined>;
    setBal: (a: string, v: bigint) => Promise<{ txid: string }>;
    fundContract: () => Promise<void>; fundSigner: () => Promise<void>; sc: unknown;
  }> => {
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
    const fundContract = async (): Promise<void> => {
      await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n });
    };
    const fundSigner = async (): Promise<void> => {
      await provider.addUtxo(alice.getAddress(), { txid: uid(), vout: 0, satoshis: 200000n });
    };
    return { valOf, setBal, fundContract, fundSigner, sc: contract.connect(alice) };
  };
  const mt = (sc: unknown, rs: string[], as: bigint[]): Promise<{ txid: string }> =>
    (sc as Record<string, (...x: unknown[]) => { send: () => Promise<{ txid: string }> }>)
      .multiTransfer(rs, as, alicePub, sig).send();

  it('debits msg.sender by the total and credits each EXISTING recipient by its amount', async () => {
    const { valOf, setBal, fundContract, fundSigner, sc } = await deploy();
    await fundContract(); await setBal(aliceAddress, 1000n);
    await fundContract(); await setBal(bobAddress, 100n);
    await fundContract(); await setBal(carolAddress, 200n);
    await fundSigner();
    await mt(sc, [bobAddress, carolAddress], [10n, 20n]); // alice 970, bob 110, carol 220
    expect(await valOf(aliceAddress)).toBe(970n);
    expect(await valOf(bobAddress)).toBe(110n);
    expect(await valOf(carolAddress)).toBe(220n);
  });

  it('credits a NEW recipient (insert) whose predecessor is UNTOUCHED, alongside the debit', async () => {
    const { valOf, setBal, fundContract, fundSigner, sc } = await deploy();
    await fundContract(); await setBal(aliceAddress, 1000n); // sender (debited)
    await fundContract(); await setBal(bobAddress, 100n);    // bystander; carol's predecessor, NOT a recipient
    await fundSigner();
    await mt(sc, [carolAddress], [20n]); // debit alice 1000->980; INSERT carol=20 (predecessor bob, untouched)
    expect(await valOf(aliceAddress)).toBe(980n);
    expect(await valOf(carolAddress)).toBe(20n);
    expect(await valOf(bobAddress)).toBe(100n); // bystander unchanged (supply 980+20+100 = 1100 = 1000+100)
  });

  // CASE (b): a new recipient whose bracketing predecessor is ANOTHER CREDITED recipient (co-spent as an update this
  // tx, distinct from the debited msg.sender). The predecessor is co-spent ONCE serving both its update and the insert
  // re-point via the covenant's pending-defer register (SDK re-points its commitment in place). Requires the
  // predecessor to be credited immediately before the new key.
  it('folds a new recipient whose predecessor is another credited recipient (case b)', async () => {
    const { valOf, setBal, fundContract, fundSigner, sc } = await deploy();
    await fundContract(); await setBal(aliceAddress, 1000n); // msg.sender (debited)
    await fundContract(); await setBal(bobAddress, 100n);    // credited recipient below + carol's predecessor
    await fundSigner();
    // debit alice 1000->970; UPDATE bob 100->110 AND re-point to carol; INSERT carol=20 (predecessor bob). LE order
    // bob < carol < alice, so the chain becomes bob -> carol -> alice. Supply 970+110+20 = 1100 = 1000+100.
    await mt(sc, [bobAddress, carolAddress], [10n, 20n]);
    expect(await valOf(aliceAddress)).toBe(970n);
    expect(await valOf(bobAddress)).toBe(110n);
    expect(await valOf(carolAddress)).toBe(20n);
  });

  // SELF-TRANSFER: the msg.sender is ALSO listed as a recipient. A self-transfer nets out, so the SDK drops it from
  // recipients+amounts (the debit sum drops by its own amount) - identical net, msg.sender co-spent ONCE (the debit).
  // Solidity allows a self-transfer in a batch; this matches it.
  it('nets out a self-transfer when the msg.sender is also a credited recipient', async () => {
    const { valOf, setBal, fundContract, fundSigner, sc } = await deploy();
    await fundContract(); await setBal(aliceAddress, 1000n); // alice = msg.sender/debit
    await fundContract(); await setBal(bobAddress, 100n);
    await fundSigner();
    // multiTransfer([bob, alice], [10, 20]) from alice: debit alice 30, credit bob 10 + alice 20 -> net alice -10.
    // Dropping alice's self-credit: debit alice 10, credit bob 10. Same net: alice 990, bob 110.
    await mt(sc, [bobAddress, aliceAddress], [10n, 20n]);
    expect(await valOf(aliceAddress)).toBe(990n); // 1000 - 30 + 20  ==  1000 - 10
    expect(await valOf(bobAddress)).toBe(110n);   // 100 + 10
  });

  // DUPLICATE RECIPIENT: a key listed 2+ times accumulates for += (Solidity semantics). The SDK merges duplicates into
  // one entry (co-spent once) with the summed amount; the debit still sums the full total, so it is unchanged.
  it('accumulates a recipient listed twice (bob += 10 + 30 = 40)', async () => {
    const { valOf, setBal, fundContract, fundSigner, sc } = await deploy();
    await fundContract(); await setBal(aliceAddress, 1000n); // msg.sender (debited)
    await fundContract(); await setBal(bobAddress, 100n);
    await fundContract(); await setBal(carolAddress, 200n);
    await fundSigner();
    // multiTransfer([bob, carol, bob], [10, 20, 30]) from alice: bob merged to += 40, carol += 20, alice debited 60.
    await mt(sc, [bobAddress, carolAddress, bobAddress], [10n, 20n, 30n]);
    expect(await valOf(aliceAddress)).toBe(940n); // 1000 - (10 + 20 + 30)
    expect(await valOf(bobAddress)).toBe(140n);   // 100 + 10 + 30
    expect(await valOf(carolAddress)).toBe(220n); // 200 + 20
  });
});
