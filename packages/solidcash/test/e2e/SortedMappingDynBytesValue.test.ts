import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, utf8ToBin, bigIntToVmNumber, sha256 } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// P5a: a sorted (C2) mapping with an UNBOUNDED `bytes` / `string` VALUE <= 60 B, stored INLINE in the entry
// commitment tail as len(4 B LE) ++ value (<= 128 B total, real-chain-valid). C2's exclusion proofs extend to
// bytes/string values - closing the value-type gap for the common short-string case. A value > 60 B stores
// len ++ sha256(value) and persists the full value in chunks (P5b, see SortedMappingLongValue.test.ts).

// Entry value tail: len(4 B LE) ++ [ value if <=60 B | sha256(value) ] - matches the covenant's emitChunkableValueTail.
function valueTail(v: Uint8Array): Uint8Array {
  const len4 = new Uint8Array(4);
  new DataView(len4.buffer).setUint32(0, v.length, true);
  const body = v.length > 60 ? sha256.hash(v) : v;
  return new Uint8Array([...len4, ...body]);
}
const READ_SRC = `contract C() {
  mapping(int => bytes) data;
  function check(int k, bytes expected, pubkey pk, sig s) { require(checkSig(s, pk)); require(data[k] == expected); }
}`;

const WRITE_SRC = `contract C() {
  mapping(int => bytes) data;
  function put(int k, bytes v, pubkey pk, sig s) { require(checkSig(s, pk)); data[k] = v; }
}`;

const ZERO = slotValueToBytes(0n);
const WRONG_VALUE_INPUT_0 = /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/;

describe('sorted mapping with unbounded bytes/string value (P5a: value in the 64 B tail)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('reads the stored bytes for a present key; empty (default) for absent - both exclusion-proven', async () => {
    const art = compileString(READ_SRC, {});
    expect(art.stateLayout?.collections?.find((c) => c.name === 'data')?.sorted).toBe(true);
    const contract = new Contract(art, [], { provider });

    const s5 = keyToSlot(bigIntToVmNumber(5n));
    const val = hexToBin('deadbeefcafe'); // 6-byte value
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'data');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, s5)) } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(s5, ZERO, valueTail(val))) } } },
      ];
    });
    const categoryId = result.categoryId;

    let sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.check(5n, val, alicePub, sig).send()).txid).toBeDefined(); // present -> stored bytes

    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.check(5n, hexToBin('0011'), alicePub, sig).send())
      .rejects.toThrow(WRONG_VALUE_INPUT_0); // wrong -> revert

    sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.check(3n, new Uint8Array(), alicePub, sig).send()).txid).toBeDefined(); // absent -> empty default

    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.check(3n, hexToBin('ab'), alicePub, sig).send())
      .rejects.toThrow(WRONG_VALUE_INPUT_0); // absent claimed nonempty -> revert
  });

  it('writes a new bytes value into a present key', async () => {
    const art = compileString(WRITE_SRC, {});
    const contract = new Contract(art, [], { provider });

    const s5 = keyToSlot(bigIntToVmNumber(5n));
    const old = utf8ToBin('hi');
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'data');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, s5)) } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(s5, ZERO, valueTail(old))) } } },
      ];
    });
    const categoryId = result.categoryId;

    const sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.put(5n, hexToBin('c01dbeef'), alicePub, sig).send()).txid).toBeDefined();
  });

  it('string value: reads the stored UTF-8 string; empty default for absent', async () => {
    const STR_SRC = `contract C() {
      mapping(int => string) name;
      function check(int k, string expected, pubkey pk, sig s) { require(checkSig(s, pk)); require(name[k] == expected); }
    }`;
    const art = compileString(STR_SRC, {});
    const contract = new Contract(art, [], { provider });

    const s5 = keyToSlot(bigIntToVmNumber(5n));
    const val = utf8ToBin('alice'); // stored value tail = UTF-8 bytes
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'name');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, s5)) } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(s5, ZERO, valueTail(val))) } } },
      ];
    });
    const categoryId = result.categoryId;

    let sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.check(5n, 'alice', alicePub, sig).send()).txid).toBeDefined(); // present -> "alice"

    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.check(5n, 'bob', alicePub, sig).send())
      .rejects.toThrow(WRONG_VALUE_INPUT_0); // wrong -> revert

    sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.check(3n, '', alicePub, sig).send()).txid).toBeDefined(); // absent -> empty default
  });
});
