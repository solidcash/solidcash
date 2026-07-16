import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import {
  keyToSlot, encodeEntryCommitment, slotValueToBytes, bytesToSlotValue, getEntryNftAddress,
} from '../../src/index.js';
import { bigIntToVmNumber } from '@bitauth/libauth';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// KEYS / ENTRIES iteration over a SORTED (enumerable) `mapping(bytes20 => int)`. The C2 entry stores slot=H(key),
// not the raw key, so the caller supplies the keys (setIterationKeys) and the covenant verifies keyToSlot(key) ==
// each entry's slot during the linkage walk. A forged/wrong key hashes to a different slot -> reverts; a missing
// entry breaks the chain -> reverts. bytes20 is a fixed-width key (required for the sequential blob split).
const KEYS_SRC = `contract C() {
  enumerable mapping(bytes20 => int) bal;
  function checkKeys(int expectedCount, bytes20 expectedLast, pubkey pk, sig s) {
    require(checkSig(s, pk));
    int count = 0;
    bytes20 last = 0x0000000000000000000000000000000000000000;
    for (bytes20 k in this.bal) { count = count + 1; last = k; }
    require(count == expectedCount);
    require(last == expectedLast);
  }
}`;

const ENTRIES_SRC = `contract C() {
  enumerable mapping(bytes20 => int) bal;
  function sumEntries(int expectedCount, int expectedSum, pubkey pk, sig s) {
    require(checkSig(s, pk));
    int count = 0;
    int sum = 0;
    for (bytes20 k, int v of this.bal.entries) { count = count + 1; sum = sum + v; }
    require(count == expectedCount);
    require(sum == expectedSum);
  }
}`;

const ZERO = slotValueToBytes(0n);

function bytes20(n: number): Uint8Array {
  return hexToBin(n.toString(16).padStart(40, '0'));
}

// HEAD + entries chained ascending by SLOT (H(key) masked); returns { entries, keysAscending, lastKey }.
function build(kvs: [Uint8Array, bigint][]): {
  entries: { slot: Uint8Array; next: Uint8Array; value: Uint8Array }[];
  keys: Uint8Array[]; lastKey: Uint8Array;
} {
  const items = kvs.map(([k, v]) => ({ key: k, slot: keyToSlot(k), value: bigIntToVmNumber(v) }));
  items.sort((a, b) => (bytesToSlotValue(a.slot) < bytesToSlotValue(b.slot) ? -1 : 1));
  const entries: { slot: Uint8Array; next: Uint8Array; value: Uint8Array }[] = [];
  entries.push({ slot: ZERO, next: items[0].slot, value: new Uint8Array() }); // HEAD
  for (let i = 0; i < items.length; i++) {
    entries.push({ slot: items[i].slot, next: i + 1 < items.length ? items[i + 1].slot : ZERO, value: items[i].value });
  }
  return { entries, keys: items.map((it) => it.key), lastKey: items[items.length - 1].key };
}

describe('sorted mapping KEYS/ENTRIES iteration (caller-supplied keys, covenant-verified)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  async function seed(art: ReturnType<typeof compileString>, entries: { slot: Uint8Array; next: Uint8Array; value: Uint8Array }[]): Promise<{ contract: Contract; categoryId: string }> {
    const contract = new Contract(art, [], { provider });
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const entryAddr = getEntryNftAddress(pinned, cat, 'bal');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        ...entries.map((e) => ({
          address: entryAddr, satoshis: 1500n,
          token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: binToHex(encodeEntryCommitment(e.slot, e.next, e.value)) } },
        })),
      ];
    });
    return { contract, categoryId: result.categoryId };
  }

  it('KEYS: walks every key, each verified keyToSlot(k)==slot', async () => {
    const art = compileString(KEYS_SRC, { sortedMappings: ['bal'] });
    const { entries, keys, lastKey } = build([[bytes20(0x11), 10n], [bytes20(0x22), 20n], [bytes20(0x33), 30n]]);
    const { contract, categoryId } = await seed(art, entries);

    const sc = StatefulContract.withCategory(contract, categoryId);
    sc.setIterationKeys('bal', keys);
    expect((await sc.checkKeys(3n, lastKey, alicePub, sig).send()).txid).toBeDefined();
  });

  it('ENTRIES: walks every (key, value); count + sum verified', async () => {
    const art = compileString(ENTRIES_SRC, { sortedMappings: ['bal'] });
    const { entries, keys } = build([[bytes20(0x11), 10n], [bytes20(0x22), 20n], [bytes20(0x33), 30n]]);
    const { contract, categoryId } = await seed(art, entries);

    const sc = StatefulContract.withCategory(contract, categoryId);
    sc.setIterationKeys('bal', keys);
    expect((await sc.sumEntries(3n, 60n, alicePub, sig).send()).txid).toBeDefined();
  });

  it('ADVERSARIAL: a supplied key that does not hash to its entry slot reverts (covenant key-verify backstop)', async () => {
    const art = compileString(KEYS_SRC, { sortedMappings: ['bal'] });
    const { entries, keys, lastKey } = build([[bytes20(0x11), 10n], [bytes20(0x22), 20n], [bytes20(0x33), 30n]]);
    const { contract, categoryId } = await seed(art, entries);

    // `keys` is ascending-slot order. A malicious spender tampers the middle key with one that hashes elsewhere;
    // the covenant's keyToSlot(k)==slot EQUALVERIFY must revert (bypasses the SDK's honest slot-matching). Blob is
    // length-prefixed (1-byte length ++ key) to match the covenant's split.
    const parts: number[] = [];
    keys.forEach((k, i) => { const key = i === 1 ? bytes20(0x99) : k; parts.push(key.length, ...key); });
    const tampered = Uint8Array.from(parts);
    // The revert is VM-level: "error in evaluating input index 0: Program failed an OP_VERIFY" - the covenant's
    // keyToSlot(k)==slot EQUALVERIFY, not an SDK pre-check (the raw-blob hook bypasses the SDK's slot-matching).
    const sc = StatefulContract.withCategory(contract, categoryId);
    sc._setRawIterationKeysBlob('bal', tampered);
    await expect(sc.checkKeys(3n, lastKey, alicePub, sig).send()).rejects.toThrow();
  });

  it('VARIABLE-WIDTH KEYS: int-keyed mapping iterates (length-prefixed blob)', async () => {
    const SRC = `contract C() {
      enumerable mapping(int => int) bal;
      function sumKeys(int expectedCount, int expectedKeySum, pubkey pk, sig s) {
        require(checkSig(s, pk));
        int count = 0; int keySum = 0;
        for (int k in this.bal) { count = count + 1; keySum = keySum + k; }
        require(count == expectedCount); require(keySum == expectedKeySum);
      }
    }`;
    const art = compileString(SRC, { sortedMappings: ['bal'] });
    // int keys 5, 9, 12 (variable-width minimal script numbers); ascending by slot.
    const items = [5n, 9n, 12n].map((n) => ({ key: bigIntToVmNumber(n), slot: keyToSlot(bigIntToVmNumber(n)) }));
    items.sort((a, b) => (bytesToSlotValue(a.slot) < bytesToSlotValue(b.slot) ? -1 : 1));
    const entries: { slot: Uint8Array; next: Uint8Array; value: Uint8Array }[] = [
      { slot: ZERO, next: items[0].slot, value: new Uint8Array() },
    ];
    for (let i = 0; i < items.length; i++) {
      entries.push({ slot: items[i].slot, next: i + 1 < items.length ? items[i + 1].slot : ZERO, value: bigIntToVmNumber(1n) });
    }
    const { contract, categoryId } = await seed(art, entries);
    const sc = StatefulContract.withCategory(contract, categoryId);
    sc.setIterationKeys('bal', items.map((it) => it.key));
    expect((await sc.sumKeys(3n, 26n, alicePub, sig).send()).txid).toBeDefined(); // 5+9+12
  });
});
