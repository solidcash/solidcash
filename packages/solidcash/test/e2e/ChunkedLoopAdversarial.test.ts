/* eslint-disable max-len */
import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, bigIntToVmNumber, sha256 } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import {
  keyToSlot,
  encodeEntryCommitment,
  slotValueToBytes,
  getEntryNftAddress,
  getValueChunkAddress,
} from '../../src/stateful/index.js';
import { buildValueChunkCommitment, splitValueIntoValueChunks } from '@solidcash/utils';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

const badChunkRoot = 'vmap value chunks do not match the authenticated root';

function valueTail(v: Uint8Array): Uint8Array {
  const len4 = new Uint8Array(4);
  new DataView(len4.buffer).setUint32(0, v.length, true);
  const body = v.length > 60 ? new Uint8Array([...sha256.hash(v), ...v.slice(0, 28)]) : v;
  return new Uint8Array([...len4, ...body]);
}

const SRC = `contract C() {
  mapping(int => bytes) m;
  function fill(int[] ks, bytes[] vs, pubkey pk, sig s) { require(checkSig(s, pk)); for (int i = 0; i < ks.length; i++) { m[ks[i]] = vs[i]; } }
  function chk(int k, bytes exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k] == exp); }
}`;

/**
 * The per-iteration loop's value chunks are pinned/verified by the SAME slot-specific chunk covenant as the
 * single-write path (`emitSortedValueChunkPin`). A forged, reordered, or missing chunk store at the
 * (collection, slot, digest) address makes the value UNREADABLE - it can never return a wrong value, only fail closed.
 */
describe('chunked >60 B per-iteration loop: adversarial chunk verification', () => {
  const sig = new SignatureTemplate(alicePriv);
  const s5 = keyToSlot(bigIntToVmNumber(5n));

  /** Seed an entry whose digest commits to `realVal`, with attacker-controlled chunks at the chunk address. */
  const seed = async (
    realVal: Uint8Array, chunks: Uint8Array[],
  ): Promise<{ provider: ReturnType<typeof createTestProvider>; contract: Contract<any, any>; categoryId: string }> => {
    const provider = createTestProvider();
    const art = compileString(SRC, {});
    const contract = new Contract(art, [], { provider });
    const digest = sha256.hash(realVal);
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'm');
      const chunkAddr = getValueChunkAddress(pinned, cat, 'm', s5, digest);
      const outs = [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: binToHex(encodeEntryCommitment(slotValueToBytes(0n), s5)) } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: binToHex(encodeEntryCommitment(s5, slotValueToBytes(0n), valueTail(realVal))) } } },
      ];
      chunks.forEach((data, i) => outs.push({
        address: chunkAddr, satoshis: 1500n,
        token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: buildValueChunkCommitment(i, data) } },
      }));
      return outs;
    });
    return { provider, contract, categoryId: result.categoryId };
  };

  it('a forged chunk (bytes not matching the stored digest) fails the read closed', async () => {
    const realVal = hexToBin('11'.repeat(100)); // the value the entry digest commits to
    const forgedVal = hexToBin('22'.repeat(100)); // attacker's substitute of the same length
    const { contract, categoryId } = await seed(realVal, splitValueIntoValueChunks(forgedVal));

    let sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.chk(5n, forgedVal, alicePub, sig).send()).rejects.toThrow(badChunkRoot);
    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.chk(5n, realVal, alicePub, sig).send()).rejects.toThrow(badChunkRoot);
  });

  it('a missing chunk (fewer chunks than the value needs) fails the read closed', async () => {
    const realVal = hexToBin('33'.repeat(200)); // 200 B -> 2 chunks (126 + 46)
    const chunks = splitValueIntoValueChunks(realVal);
    expect(chunks).toHaveLength(2);
    // Seed only the first chunk: reassembly observes a chunk-count mismatch and rejects, never a truncated value.
    const { contract, categoryId } = await seed(realVal, chunks.slice(0, 1));

    const sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.chk(5n, realVal, alicePub, sig).send()).rejects.toThrow(/chunk count mismatch/);
  });

  it('a reordered chunk (data swapped between equal-size chunks) fails the read closed', async () => {
    // 280 B -> head(28) + two equal 126-byte chunks with DISTINCT bytes, so swapping them changes the value.
    const realVal = new Uint8Array(280);
    realVal.set(hexToBin('11'.repeat(28)), 0);
    realVal.set(hexToBin('22'.repeat(126)), 28);
    realVal.set(hexToBin('33'.repeat(126)), 154);
    const chunks = splitValueIntoValueChunks(realVal);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].length).toBe(chunks[1].length);
    expect(binToHex(chunks[0])).not.toBe(binToHex(chunks[1]));
    // Swap the two chunks' data (indices stay 0,1): the reassembled bytes differ, so the digest check rejects.
    const { contract, categoryId } = await seed(realVal, [chunks[1], chunks[0]]);

    const sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.chk(5n, realVal, alicePub, sig).send()).rejects.toThrow(badChunkRoot);
  });
});
