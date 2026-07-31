import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, bigIntToVmNumber } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

const verifyFailure = 'layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';

// End-to-end: a COMPILED sorted-set mapping. `require(!claimed[k])` compiles to the sorted read covenant; the SDK
// co-spends the exact entry if k is present, else the bracketing predecessor. So the guard passes for an absent
// key and reverts for a present (claimed) key - and there is no default-on-absent branch to omit (C2 closed).
const SRC = `contract C() {
  mapping(int => bool) claimed;
  function check(int k, pubkey pk, sig s) { require(checkSig(s, pk)); require(!claimed[k]); }
}`;

describe('sorted mapping compiled read (C2 end-to-end)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('require(!claimed[k]) passes for an absent key, reverts for a present (claimed) key', async () => {
    const art = compileString(SRC, {});
    expect(art.stateLayout?.collections?.find((c) => c.name === 'claimed')?.sorted).toBe(true);
    const contract = new Contract(art, [], { provider });

    // State: key 5 is claimed (value tail = true = 0x01). List HEAD[0|slot5] -> entry5[slot5|0|true]. A bool set
    // stores its value: a present entry with an empty tail is FALSE, so a `claimed` key needs the 0x01 tail.
    const s5 = keyToSlot(bigIntToVmNumber(5n));
    const ZERO = slotValueToBytes(0n);
    const TRUE = new Uint8Array([0x01]);
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const entryAddr = getEntryNftAddress(pinned, cat, 'claimed');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: entryAddr, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, s5)) } } },
        { address: entryAddr, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(s5, ZERO, TRUE)) } } },
      ];
    });
    const categoryId = result.categoryId;

    // Absent key 3 -> !claimed[3] is true -> guard passes.
    let sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.check(3n, alicePub, sig).send()).txid).toBeDefined();

    // Present key 5 -> !claimed[5] is false -> guard reverts (already claimed). Cannot be bypassed by omission.
    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.check(5n, alicePub, sig).send()).rejects.toThrow(verifyFailure);
  });
});
