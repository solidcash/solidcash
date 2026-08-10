import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// Read-modify-write on a vmap sorted value mapping - the ORIGINAL vmap-blocked pattern (a `+=` on `mapping(K=>int)`
// could be reset by omitting the entry, since the covenant read the type default). With the sorted backend the
// read and write co-spend the SAME entry (the exact entry if present, else the bracketing predecessor), so a
// present-key `bal[k]+=v` is an UPDATE (old value read from the co-spent entry) and an absent-key `bal[k]+=v` is
// an INSERT of `0+v` - both provable, neither omittable. Unblocks balances / vote counts / accumulators.
const SRC = `contract C() {
  mapping(int => int) bal;
  function add(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); bal[k] += v; }
  function sub(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); bal[k] -= v; }
}`;

describe('sorted value mapping read-modify-write (vmap unblocked)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('bal[k]+=v updates a present entry and inserts an absent one; bal[k]-=v decrements', async () => {
    const art = compileString(SRC, {});
    const contract = new Contract(art, [], { provider });
    const ZERO = slotValueToBytes(0n);
    const s30 = keyToSlot(bigIntToVmNumber(30n));

    // State: bal[30] = 100. List HEAD[0|slot30] -> entry30[slot30|0|100].
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'bal');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, s30)) } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(s30, ZERO, bigIntToVmNumber(100n))) } } },
      ];
    });
    const categoryId = result.categoryId;
    const ea = getEntryNftAddress(contract.withCategory(hexToBin(categoryId)), categoryId, 'bal');
    const valOf = async (k: bigint): Promise<bigint | undefined> => {
      const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(bigIntToVmNumber(k)));
      return e ? vmNumberToBigInt(e.value, { requireMinimalEncoding: false }) as bigint : undefined;
    };

    // Present key: 100 += 25 -> 125 (update).
    let sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.add(30n, 25n, alicePub, sig).send()).txid).toBeDefined();
    expect(await valOf(30n)).toBe(125n);

    // Absent key 70: 0 += 7 -> 7 (insert on read-modify-write).
    sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.add(70n, 7n, alicePub, sig).send()).txid).toBeDefined();
    expect(await valOf(70n)).toBe(7n);

    // Decrement a present key: 125 -= 5 -> 120.
    sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.sub(30n, 5n, alicePub, sig).send()).txid).toBeDefined();
    expect(await valOf(30n)).toBe(120n);
    expect(await valOf(70n)).toBe(7n); // 70 unaffected
  });
});
