import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// A C2 (sorted) SCALAR mapping entry written more than once to the SAME (loop-invariant) key -
// `for(i) balance[owner] -= amts[i]` - is now cached by CacheMappingEntryInLoop: read balance[owner] ONCE into a
// local, apply every subtraction to the local, flush ONE upsert. This VM-verifies the cached loop stores the exact
// accumulated value (100 - 10 - 20 - 30 = 40), and adversarially that a wrong value reverts - so the cache is sound.
const SRC = `contract C() {
  mapping(int => int) balance;
  function debitMany(int owner, int[] amts, pubkey pk, sig s) {
    require(checkSig(s, pk));
    for (int i = 0; i < amts.length; i++) { this.balance[owner] -= amts[i]; }
  }
  function chkval(int owner, int expected, pubkey pk, sig s) { require(checkSig(s, pk)); require(this.balance[owner] == expected); }
}`;

describe('C2 scalar same-key cache-in-loop is sound (accumulates then one upsert)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  let n = 0x2b00;
  const uid = (): string => { n += 1; return n.toString(16).padStart(64, '0'); };
  const fund = async (a: string): Promise<void> => { await provider.addUtxo(a, { txid: uid(), vout: 0, satoshis: 100000n }); };

  it('for(i) balance[owner] -= amts[i] : 100 - 10 - 20 - 30 = 40 (exact), wrong value reverts', async () => {
    const art = compileString(SRC, {});
    const contract = new Contract(art, [], { provider });
    const owner = 42n;
    const slot = keyToSlot(bigIntToVmNumber(owner));
    const ZERO = slotValueToBytes(0n);
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'balance');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, slot)) } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(slot, ZERO, bigIntToVmNumber(100n))) } } },
      ];
    });
    const categoryId = result.categoryId;
    const ea = getEntryNftAddress(contract.withCategory(hexToBin(categoryId)), categoryId, 'balance');
    const sc = StatefulContract.withCategory(contract, categoryId);
    await fund(contract.address);
    await sc.debitMany(owner, [10n, 20n, 30n], alicePub, sig).send(); // no try/catch: must succeed + be exact
    const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(slot);
    expect(vmNumberToBigInt(e!.value)).toBe(40n);
    await fund(contract.address);
    await expect(sc.chkval(owner, 60n, alicePub, sig).send()).rejects.toThrow(); // adversarial: not the intermediate 60
  });
});
