import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth';
import { hash160 } from '@solidcash/utils';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// C2 read-modify-write with a COMPUTED / LOCAL key: `balances[pkh] = balances[pkh] + amt` where pkh is a local.
// This is the common ERC pattern; it regressed under C2 because the value's read (RHS) is emitted before the write
// key-hash (LHS), so visitIdentifier's last-use ROLL consumed the key. The upsert now hashes the key first. This
// verifies the fix is SOUND at runtime (the RMW reads the old value and writes old+amt), not just that it compiles.
const SRC = `contract C() {
  mapping(bytes20 => bigint) balances;
  function deposit(int amt, pubkey pk, sig s) {
    require(checkSig(s, pk));
    bytes20 pkh = hash160(pk);
    this.balances[pkh] = this.balances[pkh] + amt;
  }
}`;

describe('sorted mapping RMW with a computed/local key', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('balances[pkh] = balances[pkh] + amt reads old value and writes old+amt', async () => {
    const art = compileString(SRC, { sortedMappings: ['balances'] });
    expect(art.stateLayout?.collections?.find((c) => c.name === 'balances')?.sorted).toBe(true);
    const contract = new Contract(art, [], { provider });

    const pkh = hash160(alicePub);
    const slot = keyToSlot(pkh);
    const ZERO = slotValueToBytes(0n);
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'balances');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, slot)) } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(slot, ZERO, bigIntToVmNumber(10n))) } } },
      ];
    });
    const categoryId = result.categoryId;
    const ea = getEntryNftAddress(contract.withCategory(hexToBin(categoryId)), categoryId, 'balances');

    // deposit 5 -> balances[pkh] becomes 10 + 5 = 15. The key is a local (hash160(pk)), not a function param, so
    // it is supplied via withEntryKey (slotIndex 0); the covenant recomputes hash160(pk) and EQUALVERIFYs it.
    const sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.deposit(5n, alicePub, sig).withEntryKey(0, pkh).send()).txid).toBeDefined();

    const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(slot);
    expect(e).toBeDefined();
    expect(vmNumberToBigInt(e!.value)).toBe(15n);
  });

  it('INSERT branch: an absent computed key mints a new entry (balances[pkh] = 0 + amt)', async () => {
    const art = compileString(SRC, { sortedMappings: ['balances'] });
    const contract = new Contract(art, [], { provider });

    const pkh = hash160(alicePub);
    const slot = keyToSlot(pkh);
    const ZERO = slotValueToBytes(0n);
    // Empty mapping: only the HEAD sentinel (no entry for pkh) -> deposit takes the INSERT branch.
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'balances');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, ZERO)) } } },
      ];
    });
    const categoryId = result.categoryId;
    const ea = getEntryNftAddress(contract.withCategory(hexToBin(categoryId)), categoryId, 'balances');

    const sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.deposit(7n, alicePub, sig).withEntryKey(0, pkh).send()).txid).toBeDefined();

    const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(slot);
    expect(e).toBeDefined();
    expect(vmNumberToBigInt(e!.value)).toBe(7n); // 0 (absent default) + 7
  });

  it('AUTO-DERIVE: a DIRECT computed key balances[hash160(pk)] resolves WITHOUT withEntryKey', async () => {
    // Direct (inline) computed key -> the artifact carries expressionLabel "call:hash160(id:pk)", which the SDK
    // evaluates from the pk arg (hash160(pk)) - no manual withEntryKey needed, matching Solidity auto-resolution.
    const DIRECT_SRC = `contract C() {
      mapping(bytes20 => bigint) balances;
      function deposit(int amt, pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.balances[hash160(pk)] = this.balances[hash160(pk)] + amt;
      }
    }`;
    const art = compileString(DIRECT_SRC, { sortedMappings: ['balances'] });
    const contract = new Contract(art, [], { provider });

    const pkh = hash160(alicePub);
    const slot = keyToSlot(pkh);
    const ZERO = slotValueToBytes(0n);
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'balances');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, slot)) } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(slot, ZERO, bigIntToVmNumber(10n))) } } },
      ];
    });
    const categoryId = result.categoryId;
    const ea = getEntryNftAddress(contract.withCategory(hexToBin(categoryId)), categoryId, 'balances');

    const sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.deposit(5n, alicePub, sig).send()).txid).toBeDefined(); // no withEntryKey

    const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(slot);
    expect(e).toBeDefined();
    expect(vmNumberToBigInt(e!.value)).toBe(15n);
  });
});
