import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth';
import { hash160 } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

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
    const art = compileString(SRC, {});
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

    // deposit 5 -> balances[pkh] becomes 10 + 5 = 15. pkh is a LOCAL (bytes20 pkh = hash160(pk)); the compiler
    // inlines its initializer into the key's canonical (call:hash160(id:pk)) so the SDK auto-derives it - NO
    // withEntryKey needed. The covenant recomputes hash160(pk) and EQUALVERIFYs it against the entry slot.
    const sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.deposit(5n, alicePub, sig).send()).txid).toBeDefined();

    const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(slot);
    expect(e).toBeDefined();
    expect(vmNumberToBigInt(e!.value)).toBe(15n);
  });

  it('INSERT branch: an absent computed key mints a new entry (balances[pkh] = 0 + amt)', async () => {
    const art = compileString(SRC, {});
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
    expect((await sc.deposit(7n, alicePub, sig).send()).txid).toBeDefined();

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
    const art = compileString(DIRECT_SRC, {});
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

  it('reads through a last-use local copy of a parameter with the correct C2 stack offset', async () => {
    const source = `contract C() {
      mapping(bytes20 => bigint) balances;
      bigint result;
      function read(bytes20 user) {
        bytes20 localUser = user;
        this.result = this.balances[localUser];
        require(true);
      }
      function lookup(bytes20 user) internal view returns (bigint) {
        bytes20 localUser = user;
        return this.balances[localUser];
      }
      function readInlined(bytes20 user) {
        this.result = lookup(user);
        require(true);
      }
      function readAssigned(bytes20 user) {
        bytes20 localUser;
        localUser = user;
        this.result = this.balances[localUser];
        require(true);
      }
      function readComputed(pubkey pk) {
        bytes20 localUser = hash160(pk);
        this.result = this.balances[localUser];
        require(true);
      }
      function readLive(bytes20 user) {
        bytes20 localUser = user;
        this.result = this.balances[localUser];
        require(localUser == user);
      }
      function lookupComputed(pubkey pk) internal view returns (bigint) {
        bytes20 localUser = hash160(pk);
        return this.balances[localUser];
      }
      function readComputedInlined(pubkey pk) {
        this.result = lookupComputed(pk);
        require(true);
      }
    }`;
    const art = compileString(source, {});
    const contract = new Contract(art, [], { provider });
    const key = hash160(alicePub);
    const slot = keyToSlot(key);
    const zero = slotValueToBytes(0n);
    const result = await setupStatefulUtxos(provider, contract, art.stateLayout!, { result: 0n });
    const pinned = contract.withCategory(hexToBin(result.categoryId));
    const entryAddress = getEntryNftAddress(pinned, result.categoryId, 'balances');
    const [sentinel] = await provider.getUtxos(entryAddress);
    await provider.addUtxo(entryAddress, {
      txid: sentinel.txid, vout: sentinel.vout, satoshis: sentinel.satoshis,
      token: {
        category: result.categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(zero, slot)) },
      },
    });
    await provider.addUtxo(entryAddress, {
      txid: '22'.repeat(32), vout: 0, satoshis: 1500n,
      token: {
        category: result.categoryId, amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: binToHex(encodeEntryCommitment(slot, zero, bigIntToVmNumber(41n))),
        },
      },
    });

    const sc = StatefulContract.withCategory(contract, result.categoryId);
    await expect(sc.read(key).send()).resolves.toHaveProperty('txid');
    await expect(sc.getState()).resolves.toMatchObject({ result: 41n });
    await expect(sc.readInlined(key).send()).resolves.toHaveProperty('txid');
    await expect(sc.getState()).resolves.toMatchObject({ result: 41n });
    await expect(sc.readAssigned(key).send()).resolves.toHaveProperty('txid');
    await expect(sc.getState()).resolves.toMatchObject({ result: 41n });
    await expect(sc.readComputed(alicePub).send()).resolves.toHaveProperty('txid');
    await expect(sc.getState()).resolves.toMatchObject({ result: 41n });
    await expect(sc.readLive(key).send()).resolves.toHaveProperty('txid');
    await expect(sc.getState()).resolves.toMatchObject({ result: 41n });
    await expect(sc.readComputedInlined(alicePub).send()).resolves.toHaveProperty('txid');
    await expect(sc.getState()).resolves.toMatchObject({ result: 41n });
  });
});
