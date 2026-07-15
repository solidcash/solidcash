import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlotMulti, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// Nested / composite-key sorted mapping `mapping(int => mapping(int => int))` (an ERC20-allowance shape). The slot
// for `allow[a][b]` is sha256(sha256(a)++sha256(b)) high-bit-masked (keyToSlotMulti / covenant emitSortedKeyHash) -
// each key hashed independently so the pair is unambiguous. Every op (read/upsert/RMW/delete) is the same sorted
// linked-list op over that composite slot, C2-sound (absence still proven by the bracket).
const SRC = `contract C() {
  mapping(int => mapping(int => int)) allow;
  function approve(int a, int b, int v, pubkey pk, sig s) { require(checkSig(s, pk)); allow[a][b] = v; }
  function bump(int a, int b, int v, pubkey pk, sig s) { require(checkSig(s, pk)); allow[a][b] += v; }
  function check(int a, int b, int exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(allow[a][b] == exp); }
}`;

describe('sorted nested mapping (composite key)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('allow[a][b] upsert/read/RMW keyed by the (a,b) pair, distinct pairs independent', async () => {
    const art = compileString(SRC, { sortedMappings: ['allow'] });
    const contract = new Contract(art, [], { provider });
    const ZERO = slotValueToBytes(0n);
    const slotOf = (a: bigint, b: bigint): Uint8Array => keyToSlotMulti([bigIntToVmNumber(a), bigIntToVmNumber(b)]);

    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'allow');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, ZERO)) } } },
      ];
    });
    const categoryId = result.categoryId;
    const ea = getEntryNftAddress(contract.withCategory(hexToBin(categoryId)), categoryId, 'allow');
    const valOf = async (a: bigint, b: bigint): Promise<bigint | undefined> => {
      const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(slotOf(a, b));
      return e ? vmNumberToBigInt(e.value, { requireMinimalEncoding: false }) as bigint : undefined;
    };
    const call = (fn: 'approve' | 'bump' | 'check', ...a: unknown[]): Promise<{ txid: string }> => {
      type Caller = Record<string, (...args: unknown[]) => { send: () => Promise<{ txid: string }> }>;
      return (StatefulContract.withCategory(contract, categoryId) as unknown as Caller)[fn](...a, alicePub, sig).send();
    };

    // approve allow[10][20] = 100 (insert at the (10,20) composite slot).
    expect((await call('approve', 10n, 20n, 100n)).txid).toBeDefined();
    expect(await valOf(10n, 20n)).toBe(100n);

    // read reflects it; a different pair (10,30) is absent (reads 0).
    await expect(call('check', 10n, 20n, 100n)).resolves.toBeDefined();
    await expect(call('check', 10n, 30n, 0n)).resolves.toBeDefined();
    await expect(call('check', 10n, 20n, 99n)).rejects.toThrow();

    // RMW allow[10][20] += 5 -> 105 (update the same composite entry).
    expect((await call('bump', 10n, 20n, 5n)).txid).toBeDefined();
    expect(await valOf(10n, 20n)).toBe(105n);

    // A different pair (10,30) inserts independently; (20,10) is a DIFFERENT slot than (10,20).
    expect((await call('approve', 10n, 30n, 7n)).txid).toBeDefined();
    expect(await valOf(10n, 30n)).toBe(7n);
    expect(await valOf(10n, 20n)).toBe(105n); // unaffected
    expect(await valOf(20n, 10n)).toBeUndefined(); // (20,10) != (10,20)
  });
});
