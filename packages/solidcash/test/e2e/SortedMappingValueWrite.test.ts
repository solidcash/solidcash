import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// End-to-end value-mapping upsert `mapping(int => int)`. `bal[k] = v` compiles to the sorted upsert covenant:
// present key (slot==H(k)) -> UPDATE the value (link preserved); absent key -> INSERT (co-spend predecessor, mint
// NEW[k|next|v]). The SDK co-spends the exact entry (update) or predecessor (insert); the covenant pins the output
// value, so the RHS is derived from the VM trace. A read `bal[k]` returns the stored value / default (C2-sound).
const SRC = `contract C() {
  mapping(int => int) bal;
  function setBal(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); bal[k] = v; }
  function check(int k, int expected, pubkey pk, sig s) { require(checkSig(s, pk)); require(bal[k] == expected); }
}`;

describe('sorted mapping compiled value write / upsert (mapping(K=>int))', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('bal[k]=v inserts an absent key and updates a present key; reads reflect the value', async () => {
    const art = compileString(SRC, {});
    const contract = new Contract(art, [], { provider });
    const ZERO = slotValueToBytes(0n);

    // Genesis: master (minting) + empty list HEAD[0|0].
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const entryAddr = getEntryNftAddress(pinned, cat, 'bal');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: entryAddr, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, ZERO)) } } },
      ];
    });
    const categoryId = result.categoryId;
    const pinned = contract.withCategory(hexToBin(categoryId));
    const entryAddr = getEntryNftAddress(pinned, categoryId, 'bal');
    const listNow = async (): Promise<SortedList> => SortedList.fromUtxos(await provider.getUtxos(entryAddr));
    const valueOf = async (k: bigint): Promise<bigint> => {
      const e = (await listNow()).find(keyToSlot(bigIntToVmNumber(k)));
      if (!e) return -1n;
      const n = vmNumberToBigInt(e.value, { requireMinimalEncoding: false }); // raw minimal-number value tail
      return typeof n === 'bigint' ? n : 0n; // empty tail -> 0
    };

    // Insert key 30 = 100.
    let sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.setBal(30n, 100n, alicePub, sig).send()).txid).toBeDefined();
    expect((await listNow()).all.length).toBe(2); // HEAD + 30
    expect(await valueOf(30n)).toBe(100n);

    // Update key 30 -> 200 (present -> update, link preserved, no new node).
    sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.setBal(30n, 200n, alicePub, sig).send()).txid).toBeDefined();
    expect((await listNow()).all.length).toBe(2); // still HEAD + 30
    expect(await valueOf(30n)).toBe(200n);

    // Insert a second key 70 = 50 (absent -> insert).
    sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.setBal(70n, 50n, alicePub, sig).send()).txid).toBeDefined();
    expect((await listNow()).all.length).toBe(3); // HEAD + 30 + 70
    expect(await valueOf(70n)).toBe(50n);
    expect(await valueOf(30n)).toBe(200n); // 30 unaffected

    // Read reflects the values.
    sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.check(30n, 200n, alicePub, sig).send()).txid).toBeDefined();
    sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.check(70n, 50n, alicePub, sig).send()).txid).toBeDefined();
  });
});
