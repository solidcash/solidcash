import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// `delete m[k]` on a C2 sorted VALUE mapping. In Solidity `delete m[k]` sets m[k] to the type default, so the
// compiler routes it through the upsert with value = 0: a present key updates to 0, an absent key inserts a 0.
// A subsequent read returns 0 either way - Solidity-equivalent. (A SET delete needs a splice and fails closed.)
const SRC = `contract C() {
  mapping(int => int) bal;
  function clear(int k, pubkey pk, sig s) { require(checkSig(s, pk)); delete bal[k]; }
}`;

describe('sorted value mapping delete (== set to default)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('delete bal[k] zeroes a present entry; a read then returns 0', async () => {
    const art = compileString(SRC, {});
    const contract = new Contract(art, [], { provider });
    const ZERO = slotValueToBytes(0n);
    const s30 = keyToSlot(bigIntToVmNumber(30n));

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

    // Present key 30 (value 100) -> delete -> 0.
    let sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.clear(30n, alicePub, sig).send()).txid).toBeDefined();
    expect(await valOf(30n)).toBe(0n);

    // Absent key 70 -> delete inserts a 0 (a read still returns 0, Solidity-equivalent).
    sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.clear(70n, alicePub, sig).send()).txid).toBeDefined();
    expect(await valOf(70n)).toBe(0n);
  });
});
