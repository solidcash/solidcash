import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress, SortedList } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePriv, alicePub, aliceAddress, bobAddress } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// Address-keyed sorted mapping `mapping(address => int)` - the ERC20 balance shape. An address key is hashed as its
// locking bytecode (the covenant's on-stack address == the SDK's addressToLockScript), so the slot is
// keyToSlot(addressToLockScript(addr)). Distinct addresses are independent entries; C2-sound as usual.
const SRC = `contract C() {
  mapping(address => int) bal;
  function setBal(address a, int v, pubkey pk, sig s) { require(checkSig(s, pk)); bal[a] = v; }
  function check(address a, int exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(bal[a] == exp); }
}`;

describe('sorted address-keyed mapping (ERC20 balance shape)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('bal[addr] keyed by the address; distinct addresses independent', async () => {
    const art = compileString(SRC, {});
    const contract = new Contract(art, [], { provider });
    const ZERO = slotValueToBytes(0n);
    const slotOfAddr = (addr: string): Uint8Array => keyToSlot(addressToLockScript(addr));

    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'bal');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, ZERO)) } } },
      ];
    });
    const categoryId = result.categoryId;
    const ea = getEntryNftAddress(contract.withCategory(hexToBin(categoryId)), categoryId, 'bal');
    const valOf = async (addr: string): Promise<bigint | undefined> => {
      const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(slotOfAddr(addr));
      return e ? vmNumberToBigInt(e.value, { requireMinimalEncoding: false }) as bigint : undefined;
    };
    const call = (fn: 'setBal' | 'check', ...a: unknown[]): Promise<{ txid: string }> => {
      type Caller = Record<string, (...args: unknown[]) => { send: () => Promise<{ txid: string }> }>;
      return (StatefulContract.withCategory(contract, categoryId) as unknown as Caller)[fn](...a, alicePub, sig).send();
    };

    // setBal(bob) = 100.
    expect((await call('setBal', bobAddress, 100n)).txid).toBeDefined();
    expect(await valOf(bobAddress)).toBe(100n);
    await expect(call('check', bobAddress, 100n)).resolves.toBeDefined();

    // A different address (alice) is a distinct entry, absent -> reads 0.
    await expect(call('check', aliceAddress, 0n)).resolves.toBeDefined();
    expect((await call('setBal', aliceAddress, 42n)).txid).toBeDefined();
    expect(await valOf(aliceAddress)).toBe(42n);
    expect(await valOf(bobAddress)).toBe(100n); // bob unaffected
  });
});
