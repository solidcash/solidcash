import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, bigIntToVmNumber } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// A C2 sorted mapping with a fixed-width bytesN value (e.g. mapping(int => bytes32) for a commitment/hash). The
// value is the raw N-byte commitment tail (no OP_BIN2NUM); present read -> the bytes, absent read -> N zero bytes.
// The upsert/read/RMW machinery is identical to the int case; only the value normalize differs (verbatim vs number).
const SRC = `contract C() {
  mapping(int => bytes32) hash;
  function set(int k, bytes32 h, pubkey pk, sig s) { require(checkSig(s, pk)); hash[k] = h; }
  function check(int k, bytes32 exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(hash[k] == exp); }
}`;

describe('sorted mapping bytes32 value', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('hash[k]=h stores a bytes32; a read matches it and rejects a wrong value', async () => {
    const art = compileString(SRC, { sortedMappings: ['hash'] });
    const contract = new Contract(art, [], { provider });
    const ZERO = slotValueToBytes(0n);
    const H = hexToBin('aa'.repeat(32));

    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'hash');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, ZERO)) } } },
      ];
    });
    const categoryId = result.categoryId;
    const ea = getEntryNftAddress(contract.withCategory(hexToBin(categoryId)), categoryId, 'hash');

    // Insert a bytes32 value.
    let sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.set(30n, H, alicePub, sig).send()).txid).toBeDefined();
    const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(bigIntToVmNumber(30n)));
    expect(e && binToHex(e.value)).toBe('aa'.repeat(32));

    // Read matches the stored bytes32; a wrong value reverts.
    sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.check(30n, H, alicePub, sig).send()).txid).toBeDefined();
    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.check(30n, hexToBin('bb'.repeat(32)), alicePub, sig).send()).rejects.toThrow();
  });
});
