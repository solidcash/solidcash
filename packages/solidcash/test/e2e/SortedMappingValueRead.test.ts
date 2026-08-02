import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, bigIntToVmNumber } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// End-to-end: a COMPILED value-typed sorted mapping `mapping(int => int)`. `bal[k]` compiles to the sorted read
// covenant that returns the entry's value tail for a present key, or the type default (0) proven-absent via the
// bracket - never an omittable default. The value is stored raw (minimal script number) in the commitment tail.
const SRC = `contract C() {
  mapping(int => int) bal;
  function check(int k, int expected, pubkey pk, sig s) { require(checkSig(s, pk)); require(bal[k] == expected); }
}`;

describe('sorted mapping compiled value read (mapping(K=>int))', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('bal[k] returns the stored value for a present key and 0 (default) for an absent key', async () => {
    const art = compileString(SRC, {});
    expect(art.stateLayout?.collections?.find((c) => c.name === 'bal')?.sorted).toBe(true);
    const contract = new Contract(art, [], { provider });

    // State: key 5 has value 42. List HEAD[0|slot5] -> entry5[slot5|0|42].
    const s5 = keyToSlot(bigIntToVmNumber(5n));
    const ZERO = slotValueToBytes(0n);
    const v42 = bigIntToVmNumber(42n);
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const entryAddr = getEntryNftAddress(pinned, cat, 'bal');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: entryAddr, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, s5)) } } },
        { address: entryAddr, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(s5, ZERO, v42)) } } },
      ];
    });
    const categoryId = result.categoryId;

    // Present key 5 -> value 42.
    let sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.check(5n, 42n, alicePub, sig).send()).txid).toBeDefined();

    // Present key 5, wrong expected -> reverts.
    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.check(5n, 99n, alicePub, sig).send()).rejects.toThrow(
      /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/,
    );

    // Absent key 3 -> default 0 (proven absent via the bracket, not an omittable default).
    sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.check(3n, 0n, alicePub, sig).send()).txid).toBeDefined();

    // Absent key 3, claim it is nonzero -> reverts.
    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.check(3n, 7n, alicePub, sig).send()).rejects.toThrow(
      /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/,
    );
  });
});
