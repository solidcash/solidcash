import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, bigIntToVmNumber } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// End-to-end WRITE: a compiled claim-once. `claimed[k]=true` compiles to the sorted-list insert (co-spend the
// bracketing predecessor, rewrite its next -> k, mint NEW[k|oldNext]); the SDK builds it from SortedList.planInsert.
// A claim inserts the key and a re-claim reverts on `require(!claimed[k])` - claim-once with no omittable default.
const SRC = `contract C() {
  mapping(int => bool) claimed;
  function claim(int k, pubkey pk, sig s) { require(checkSig(s, pk)); require(!claimed[k]); claimed[k] = true; }
}`;

describe('sorted mapping compiled write / claim-once (C2 end-to-end)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('claim(k) inserts the key on-chain; a second claim of the same key reverts', async () => {
    const art = compileString(SRC, {});
    const contract = new Contract(art, [], { provider });
    const ZERO = slotValueToBytes(0n);

    // Genesis: master (minting) + empty list HEAD[0|0].
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const entryAddr = getEntryNftAddress(pinned, cat, 'claimed');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: entryAddr, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, ZERO)) } } },
      ];
    });
    const categoryId = result.categoryId;
    const pinned = contract.withCategory(hexToBin(categoryId));
    const entryAddr = getEntryNftAddress(pinned, categoryId, 'claimed');
    const listNow = async (): Promise<SortedList> => SortedList.fromUtxos(await provider.getUtxos(entryAddr));

    // claim(30): inserts key 30.
    let sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.claim(30n, alicePub, sig).send()).txid).toBeDefined();
    let list = await listNow();
    expect(list.has(keyToSlot(bigIntToVmNumber(30n)))).toBe(true);
    expect(list.all.length).toBe(2); // HEAD + 30

    // Re-claim 30: require(!claimed[30]) reverts (already claimed).
    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.claim(30n, alicePub, sig).send()).rejects.toThrow('layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.');

    // A different key still claims.
    sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.claim(70n, alicePub, sig).send()).txid).toBeDefined();
    list = await listNow();
    expect(list.has(keyToSlot(bigIntToVmNumber(70n)))).toBe(true);
    expect(list.all.length).toBe(3);
  });
});
