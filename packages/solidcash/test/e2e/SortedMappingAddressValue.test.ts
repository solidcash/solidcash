import { describe, it, expect } from 'vitest';
const inputZeroVerifyFailure = /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/;
import { hexToBin, binToHex, bigIntToVmNumber } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress, SortedList } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePriv, alicePub, aliceAddress, bobAddress } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// Address-VALUED sorted mapping `mapping(int => address)` - the NFT-owner shape. The value tail stores the address
// verbatim (its locking bytecode); it is the last commitment field, so a variable width is unambiguous. Present ->
// the stored address, absent -> the empty default. C2-sound as usual (absence proven by the bracket).
const SRC = `contract C() {
  mapping(int => address) owner;
  function setOwner(int k, address a, pubkey pk, sig s) { require(checkSig(s, pk)); owner[k] = a; }
  function check(int k, address exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(owner[k] == exp); }
}`;

describe('sorted address-valued mapping (NFT owner shape)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('owner[k]=addr stores an address value; a read matches it and updates', async () => {
    const art = compileString(SRC, {});
    const contract = new Contract(art, [], { provider });
    const ZERO = slotValueToBytes(0n);

    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'owner');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, ZERO)) } } },
      ];
    });
    const categoryId = result.categoryId;
    const ea = getEntryNftAddress(contract.withCategory(hexToBin(categoryId)), categoryId, 'owner');
    const valOf = async (k: bigint): Promise<string | undefined> => {
      const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(bigIntToVmNumber(k)));
      return e ? binToHex(e.value) : undefined;
    };
    const call = (fn: 'setOwner' | 'check', ...a: unknown[]): Promise<{ txid: string }> => {
      type Caller = Record<string, (...args: unknown[]) => { send: () => Promise<{ txid: string }> }>;
      return (StatefulContract.withCategory(contract, categoryId) as unknown as Caller)[fn](...a, alicePub, sig).send();
    };

    // setOwner(5) = bob -> stored as bob's locking bytecode; read matches; wrong owner reverts.
    expect((await call('setOwner', 5n, bobAddress)).txid).toBeDefined();
    expect(await valOf(5n)).toBe(binToHex(addressToLockScript(bobAddress)));
    expect(await call('check', 5n, bobAddress)).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
    await expect(call('check', 5n, aliceAddress)).rejects.toThrow(inputZeroVerifyFailure);

    // Update owner[5] -> alice (present-key update of an address value).
    expect((await call('setOwner', 5n, aliceAddress)).txid).toBeDefined();
    expect(await valOf(5n)).toBe(binToHex(addressToLockScript(aliceAddress)));
    expect(await call('check', 5n, aliceAddress)).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
  });
});
