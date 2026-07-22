import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, bigIntToVmNumber } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// Solidity parity for mapping(K=>bool): `delete m[k]` and `m[k]=false` NULLIFY (assign the default), they do not
// physically remove the entry (Solidity delete == assign-default; libsolidity storageSetToZero). A sorted bool set
// is a value mapping (true=0x01 tail, false=empty tail), so a present-false entry reads false and the C2 bracket
// still proves absent keys false - no omittable default. `claimed[k]` reads true only for a present true entry.
const SRC = `contract C() {
  mapping(int => bool) flag;
  function set(int k, bool v, pubkey pk, sig s) { require(checkSig(s, pk)); flag[k] = v; }
  function del(int k, pubkey pk, sig s) { require(checkSig(s, pk)); delete flag[k]; }
  function needTrue(int k, pubkey pk, sig s) { require(checkSig(s, pk)); require(flag[k]); }
  function needFalse(int k, pubkey pk, sig s) { require(checkSig(s, pk)); require(!flag[k]); }
}`;

describe('sorted bool mapping nullify (Solidity delete parity)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('flag[k]=true/false and delete flag[k] all nullify; reads reflect the value', async () => {
    const art = compileString(SRC, {});
    const contract = new Contract(art, [], { provider });
    const ZERO = slotValueToBytes(0n);

    // Genesis: master + HEAD[0|0] (empty set).
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'flag');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, ZERO)) } } },
      ];
    });
    const categoryId = result.categoryId;
    const ea = getEntryNftAddress(contract.withCategory(hexToBin(categoryId)), categoryId, 'flag');
    const present = async (k: bigint): Promise<boolean> =>
      SortedList.fromUtxos(await provider.getUtxos(ea)).has(keyToSlot(bigIntToVmNumber(k)));
    type Caller = Record<string, (...args: unknown[]) => { send: () => Promise<{ txid: string }> }>;
    const call = (fn: 'set' | 'del' | 'needTrue' | 'needFalse', ...a: unknown[]): Promise<{ txid: string }> => {
      const sc = StatefulContract.withCategory(contract, categoryId) as unknown as Caller;
      return sc[fn](...a, alicePub, sig).send();
    };

    // set flag[30]=true -> reads true, rejects needFalse.
    expect((await call('set', 30n, true)).txid).toBeDefined();
    await expect(call('needTrue', 30n)).resolves.toBeDefined();
    await expect(call('needFalse', 30n)).rejects.toThrow();

    // set flag[30]=false -> NULLIFY: reads false (entry stays in the list, value emptied), needFalse passes.
    expect((await call('set', 30n, false)).txid).toBeDefined();
    expect(await present(30n)).toBe(true); // still physically present (nullified, not removed)
    await expect(call('needFalse', 30n)).resolves.toBeDefined();
    await expect(call('needTrue', 30n)).rejects.toThrow();

    // set true again, then delete flag[30] -> also NULLIFY to false; entry still present, reads false.
    expect((await call('set', 30n, true)).txid).toBeDefined();
    await expect(call('needTrue', 30n)).resolves.toBeDefined();
    expect((await call('del', 30n)).txid).toBeDefined();
    expect(await present(30n)).toBe(true); // delete nullifies, does not remove (matches Solidity)
    await expect(call('needFalse', 30n)).resolves.toBeDefined();

    // An absent key reads false via the C2 bracket (needFalse passes, needTrue reverts) - omission-proof.
    await expect(call('needFalse', 99n)).resolves.toBeDefined();
    await expect(call('needTrue', 99n)).rejects.toThrow();
  });
});
