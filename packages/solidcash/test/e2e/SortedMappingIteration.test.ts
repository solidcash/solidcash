import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, bigIntToVmNumber } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import {
  keyToSlot, encodeEntryCommitment, slotValueToBytes, bytesToSlotValue, getEntryNftAddress,
} from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// End-to-end: trustless VALUES iteration over a SORTED (enumerable) `mapping(int => int)`. `for (int v of this.bal)`
// compiles to the LINKAGE-completeness covenant: co-spend the HEAD sentinel and walk the nextKey chain to the tail,
// verifying per entry (a) its address (a real entry - no substitution) and (b) slot == the previous nextKey
// (contiguity). Omitting any linked entry breaks the chain -> the covenant reverts. No trusted count.
const SRC = `contract C() {
  enumerable mapping(int => int) bal;
  function total(int expected, pubkey pk, sig s) {
    require(checkSig(s, pk));
    int sum = 0;
    for (int v of this.bal) { sum = sum + v; }
    require(sum == expected);
  }
}`;

const ZERO = slotValueToBytes(0n);

// HEAD + entries chained in ascending-SLOT order (H(key) masked), tail nextKey = 0. Index 0 is the HEAD; 1..N are
// the entries by ascending slot, each nextKey pointing to the following entry's slot (the last -> 0).
function buildEntries(kvs: [bigint, bigint][]): { slot: Uint8Array; next: Uint8Array; value: Uint8Array }[] {
  const items = kvs.map(([k, v]) => ({ slot: keyToSlot(bigIntToVmNumber(k)), value: bigIntToVmNumber(v) }));
  items.sort((a, b) => (bytesToSlotValue(a.slot) < bytesToSlotValue(b.slot) ? -1 : 1));
  const out: { slot: Uint8Array; next: Uint8Array; value: Uint8Array }[] = [];
  out.push({ slot: ZERO, next: items[0].slot, value: new Uint8Array() }); // HEAD
  for (let i = 0; i < items.length; i++) {
    const next = i + 1 < items.length ? items[i + 1].slot : ZERO;
    out.push({ slot: items[i].slot, next, value: items[i].value });
  }
  return out;
}

describe('sorted mapping VALUES iteration (linkage completeness)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const art = compileString(SRC, { sortedMappings: ['bal'] });

  // Seed a data NFT (register) + the given entry UTXOs; return a StatefulContract pinned to the minted category.
  async function seed(
    entries: { slot: Uint8Array; next: Uint8Array; value: Uint8Array }[],
  ): Promise<{ contract: Contract; categoryId: string }> {
    const contract = new Contract(art, [], { provider });
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const entryAddr = getEntryNftAddress(pinned, cat, 'bal');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        ...entries.map((e) => ({
          address: entryAddr,
          satoshis: 1500n,
          token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: binToHex(encodeEntryCommitment(e.slot, e.next, e.value)) } },
        })),
      ];
    });
    return { contract, categoryId: result.categoryId };
  }

  it('happy: sums every value in the sorted list (HEAD walked to tail)', async () => {
    expect(art.stateLayout?.collections?.find((c) => c.name === 'bal')?.sorted).toBe(true);
    // bal = {5:10, 9:20, 12:30}; sum = 60.
    const all = buildEntries([[5n, 10n], [9n, 20n], [12n, 30n]]);
    const { contract, categoryId } = await seed(all);

    let sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.total(60n, alicePub, sig).send()).txid).toBeDefined();

    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.total(59n, alicePub, sig).send()).rejects.toThrow(); // wrong total -> require fails
  });

  it('omission: a co-spend set missing a middle linked entry breaks the chain -> reverts', async () => {
    // Full chain HEAD -> min -> mid -> max, but seed only HEAD + min + max (omit the middle). min.nextKey still
    // points to mid's slot, so the covenant reads the next input (max), sees slot(max) != expectedNext(mid) and
    // reverts. This is exactly the negative-existence/omission attack, failing closed.
    const all = buildEntries([[5n, 10n], [9n, 20n], [12n, 30n]]);
    const withGap = [all[0], all[1], all[3]]; // HEAD, min, max - middle (all[2]) omitted
    const { contract, categoryId } = await seed(withGap);

    // Any claimed total must revert: the covenant fails on the chain check (OP_EQUALVERIFY slot==expectedNext at
    // the VM, "error in evaluating input index 0: Program failed an OP_VERIFY") before the sum is even trusted.
    let sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.total(40n, alicePub, sig).send()).rejects.toThrow(); // attacker's under-reported 10+30
    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.total(60n, alicePub, sig).send()).rejects.toThrow();
  });

  it('truncation: a co-spend set missing the tail entry never reaches nextKey==0 -> reverts', async () => {
    // Seed HEAD + min + mid (omit the tail max). mid.nextKey points to max's slot (nonzero), so the loop keeps
    // walking past the last co-spent entry -> reads a non-existent/foreign input -> reverts.
    const all = buildEntries([[5n, 10n], [9n, 20n], [12n, 30n]]);
    const truncated = [all[0], all[1], all[2]]; // HEAD, min, mid - tail (all[3]) omitted
    const { contract, categoryId } = await seed(truncated);

    let sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.total(30n, alicePub, sig).send()).rejects.toThrow(); // attacker's under-reported 10+20
    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.total(60n, alicePub, sig).send()).rejects.toThrow();
  });
});
