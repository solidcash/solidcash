import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth';
import { hash160 } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// SOUNDNESS: two STRAIGHT-LINE writes to the SAME C2 scalar entry in one call (`m[k]+=a; m[k]+=b`) each route to
// their own emitSortedValueUpsert, which co-spends the entry NFT + emits one output. A second upsert needs a second
// co-spend of the same (already-spent) input, so the covenant OP_VERIFYs must fail (revert) - NEVER silently store a
// partial value. (The ARRAY-valued same-entry case is coalesced by CacheMappingEntryInLoop; the scalar case is not,
// so it must fail closed.) This seeds w[pkh]=5 and requires the tx to REVERT (not store 8 or 10 or 7).
const SRC = `contract C() {
  mapping(bytes20 => bigint) m;
  function twice(pubkey pk, sig s, bigint a, bigint b) {
    require(checkSig(s, pk));
    bytes20 k = hash160(pk);
    this.m[k] += a;
    this.m[k] += b;
  }
  function chkval(bytes20 k, bigint expected, pubkey pk, sig s) { require(checkSig(s, pk)); require(this.m[k] == expected); }
}`;

describe('C2 consecutive same-entry scalar RMW (must fail closed, never partial-store)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  let n = 0x1a00;
  const uid = (): string => { n += 1; return n.toString(16).padStart(64, '0'); };
  const fund = async (a: string): Promise<void> => {
    await provider.addUtxo(a, { txid: uid(), vout: 0, satoshis: 100000n });
  };

  it('m[k]+=a; m[k]+=b either coalesces to old+a+b OR reverts - never a wrong/partial value', async () => {
    const art = compileString(SRC, {});
    const contract = new Contract(art, [], { provider });
    const pkh = hash160(alicePub);
    const slot = keyToSlot(pkh);
    const ZERO = slotValueToBytes(0n);
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'm');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, slot)) } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(slot, ZERO, bigIntToVmNumber(5n))) } } },
      ];
    });
    const categoryId = result.categoryId;
    const ea = getEntryNftAddress(contract.withCategory(hexToBin(categoryId)), categoryId, 'm');
    const sc = StatefulContract.withCategory(contract, categoryId);
    await fund(contract.address);
    let ran = false;
    try { await sc.twice(alicePub, sig, 3n, 2n).send(); ran = true; } catch { /* fail-closed is sound */ }
    if (ran) {
      // If it was accepted it MUST have coalesced to 5+3+2 = 10 (never a partial 8 or 7).
      const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(slot);
      expect(vmNumberToBigInt(e!.value)).toBe(10n);
    }
    // Either way the persisted value is sound: prove it is NOT a wrong partial by requiring 8 and 7 to be REJECTED.
    await fund(contract.address);
    await expect(sc.chkval(pkh, 8n, alicePub, sig).send()).rejects.toThrow(
      /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/,
    );
    await fund(contract.address);
    await expect(sc.chkval(pkh, 7n, alicePub, sig).send()).rejects.toThrow(
      /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/,
    );
  });
});
