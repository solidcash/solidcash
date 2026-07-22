import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, utf8ToBin, bigIntToVmNumber, sha256 } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress, getValueChunkAddress } from '../../src/index.js';
import { buildValueChunkCommitment, splitValueIntoValueChunks, parseValueChunkCommitment } from '@solidcash/utils';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// P5b: a sorted (C2) mapping with an unbounded bytes/string VALUE that EXCEEDS the 64 B inline tail. The entry
// commitment stores len(4 B LE) ++ sha256(value) (100 B total, real-chain-valid <= 128 B); the full value persists
// off-commitment in per-slot value chunks and a read verifies a caller witness against the stored hash. This closes
// the last C2 value-type gap: C2 is the unforgeable default for bytes/string of ANY practical length, not just <=64 B.

const ZERO = slotValueToBytes(0n);

// Entry value tail under the len-prefixed format: len(4 B LE) ++ [ value if <=60 B | sha256(value) ].
function valueTail(v: Uint8Array): Uint8Array {
  const len4 = new Uint8Array(4);
  new DataView(len4.buffer).setUint32(0, v.length, true);
  const body = v.length > 60 ? sha256.hash(v) : v;
  return new Uint8Array([...len4, ...body]);
}

describe('sorted mapping with a LONG (>64 B) unbounded bytes/string value (P5b)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('covenant digest write: overwrites a present key with a 100-byte value (tail = len4 ++ sha256)', async () => {
    const WRITE_SRC = `contract C() {
      mapping(int => bytes) data;
      function put(int k, bytes v, pubkey pk, sig s) { require(checkSig(s, pk)); data[k] = v; }
    }`;
    const art = compileString(WRITE_SRC, {});
    const contract = new Contract(art, [], { provider });

    const s5 = keyToSlot(bigIntToVmNumber(5n));
    const old = valueTail(utf8ToBin('hi'));
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'data');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, s5)) } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(s5, ZERO, old)) } } },
      ];
    });
    const categoryId = result.categoryId;

    const bigVal = hexToBin('ab'.repeat(100)); // 100-byte value, > 60 -> hashed tail
    const sc = StatefulContract.withCategory(contract, categoryId);
    const { txid } = await sc.put(5n, bigVal, alicePub, sig).send();
    expect(txid).toBeDefined();

    // The minted entry commitment must be slot ++ nextKey ++ len4(100) ++ sha256(bigVal).
    const ea = getEntryNftAddress(contract.withCategory(hexToBin(categoryId)), categoryId, 'data');
    const entries = await provider.getUtxos(ea);
    const expectedTail = valueTail(bigVal);
    const expectedCommit = binToHex(encodeEntryCommitment(s5, ZERO, expectedTail));
    expect(entries.some((e) => e.token?.nft?.commitment === expectedCommit)).toBe(true);
  });

  it('witness read: reads a present 100-byte value from seeded chunks; forged witness / wrong claim revert', async () => {
    const READ_SRC = `contract C() {
      mapping(int => bytes) data;
      function check(int k, bytes expected, pubkey pk, sig s) { require(checkSig(s, pk)); require(data[k] == expected); }
    }`;
    const art = compileString(READ_SRC, {});
    const contract = new Contract(art, [], { provider });

    const s5 = keyToSlot(bigIntToVmNumber(5n));
    const bigVal = hexToBin('cd'.repeat(100)); // 100-byte value -> hashed tail + chunks
    const digest = sha256.hash(bigVal);
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'data');
      const chunkAddr = getValueChunkAddress(pinned, cat, 'data');
      const outs = [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: binToHex(encodeEntryCommitment(ZERO, s5)) } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: binToHex(encodeEntryCommitment(s5, ZERO, valueTail(bigVal))) } } },
      ];
      // Seed the value chunks (100 B -> a single 120 B chunk) at the per-(collection, slot, digest) address.
      splitValueIntoValueChunks(bigVal).forEach((data, i) => outs.push({
        address: chunkAddr, satoshis: 1500n, // >= dust for the ~200 B chunk-commitment token output on a live node
        token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: buildValueChunkCommitment(s5, digest, i, data) } },
      }));
      return outs;
    });
    const categoryId = result.categoryId;

    let sc = StatefulContract.withCategory(contract, categoryId);
    const enumerated = await sc.getEntries('data');
    expect(enumerated).toHaveLength(1);
    expect(enumerated[0].slot).toEqual(s5);
    expect(enumerated[0].value).toEqual(bigVal);
    expect((await sc.check(5n, bigVal, alicePub, sig).send()).txid).toBeDefined(); // present long -> witness verified

    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.check(5n, hexToBin('cd'.repeat(99) + 'ce'), alicePub, sig).send()).rejects.toThrow(); // wrong value -> revert
  });

  it('round-trip: deploy -> write a 200-byte value (mints chunks) -> read it back (reassembles witness)', async () => {
    const SRC = `contract C() {
      mapping(int => bytes) data;
      function put(int k, bytes v, pubkey pk, sig s) { require(checkSig(s, pk)); data[k] = v; }
      function check(int k, bytes expected, pubkey pk, sig s) { require(checkSig(s, pk)); require(data[k] == expected); }
    }`;
    const art = compileString(SRC); // C2 by default (no options)
    expect(art.stateLayout?.collections?.find((c) => c.name === 'data')?.sorted).toBe(true);
    expect(art.abi.find((f) => f.name === 'put')?.entryAccesses?.[0]?.valueParam).toBe('v'); // value param recorded

    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0xd00;
    const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
    const fund = async (addr: string): Promise<void> => { await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 100000n }); };

    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });

    const bigVal = hexToBin('ab12'.repeat(100)); // 200-byte value -> 2 chunks (120 + 80)
    await fund(contract.address);
    expect((await contract.put(7n, bigVal, alicePub, sig).send()).txid).toBeDefined(); // write: entry digest + chunks

    await fund(contract.address);
    expect((await contract.check(7n, bigVal, alicePub, sig).send()).txid).toBeDefined(); // read: chunks -> witness -> match

    await fund(contract.address);
    await expect(contract.check(7n, hexToBin('ab12'.repeat(99) + 'ab13'), alicePub, sig).send()).rejects.toThrow(); // wrong -> revert
  });

  it('adversarial: a forged/tampered witness (chunks not matching the stored hash) fails the read closed', async () => {
    const READ_SRC = `contract C() {
      mapping(int => bytes) data;
      function check(int k, bytes expected, pubkey pk, sig s) { require(checkSig(s, pk)); require(data[k] == expected); }
    }`;
    const art = compileString(READ_SRC, {});
    const contract = new Contract(art, [], { provider });

    const s5 = keyToSlot(bigIntToVmNumber(5n));
    const realVal = hexToBin('11'.repeat(100)); // the value whose hash the entry commits to
    const forgedVal = hexToBin('22'.repeat(100)); // an attacker's substitute of the same length
    const digest = sha256.hash(realVal);
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'data');
      // Chunks are seeded at the address keyed by the ENTRY's digest (sha256(realVal)) but carry FORGED bytes -
      // the SDK reassembles them into the witness, and the covenant's sha256(witness)==digest check must reject.
      const chunkAddr = getValueChunkAddress(pinned, cat, 'data');
      const outs = [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: binToHex(encodeEntryCommitment(ZERO, s5)) } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: binToHex(encodeEntryCommitment(s5, ZERO, valueTail(realVal))) } } },
      ];
      splitValueIntoValueChunks(forgedVal).forEach((data, i) => outs.push({
        address: chunkAddr, satoshis: 1500n, // >= dust for the ~200 B chunk-commitment token output on a live node
        token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: buildValueChunkCommitment(s5, digest, i, data) } },
      }));
      return outs;
    });
    const categoryId = result.categoryId;

    // Reading the forged value fails (sha256(forged) != digest); reading the real value would too (chunks are wrong),
    // so a tampered chunk store makes the value UNREADABLE - never returns a wrong value. Fail-closed soundness.
    let sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.check(5n, forgedVal, alicePub, sig).send()).rejects.toThrow();
    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.check(5n, realVal, alicePub, sig).send()).rejects.toThrow();
  });

  it('computed value UPDATE: a COMPUTED long value (local-var RHS) writes chunks (derived) and reads back', async () => {
    // `data[k] = v` where v is a LOCAL (not a function param) - the SDK cannot build the chunks, so it DERIVES the
    // covenant-pinned chunk commitments from the trace (Design D two-phase). Closes residual #1 for updates.
    const SRC = `contract C() {
      mapping(int => bytes) data;
      function put(int k, bytes a, pubkey pk, sig s) { require(checkSig(s, pk)); bytes v = a; data[k] = v; }
      function check(int k, bytes expected, pubkey pk, sig s) { require(checkSig(s, pk)); require(data[k] == expected); }
    }`;
    const art = compileString(SRC, {});
    const contract = new Contract(art, [], { provider });

    const s5 = keyToSlot(bigIntToVmNumber(5n));
    const old = valueTail(utf8ToBin('seed'));
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'data');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, s5)) } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(s5, ZERO, old)) } } },
      ];
    });
    const categoryId = result.categoryId;

    const bigVal = hexToBin('7a'.repeat(150)); // 150-byte computed value -> 3 chunks (derived from the trace)
    let sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.put(5n, bigVal, alicePub, sig).send()).txid).toBeDefined(); // computed update: chunks derived

    sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.check(5n, bigVal, alicePub, sig).send()).txid).toBeDefined(); // read: chunks -> witness -> match
  });

  it('computed value INSERT: a COMPUTED long value into a fresh key derives NEW + chunks from the trace', async () => {
    const SRC = `contract C() {
      mapping(int => bytes) data;
      function put(int k, bytes a, pubkey pk, sig s) { require(checkSig(s, pk)); bytes v = a; data[k] = v; }
      function check(int k, bytes expected, pubkey pk, sig s) { require(checkSig(s, pk)); require(data[k] == expected); }
    }`;
    const art = compileString(SRC);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0xf00;
    const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
    const fund = async (addr: string): Promise<void> => { await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 100000n }); };

    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });

    const bigVal = hexToBin('3c'.repeat(150)); // 150-byte computed value into a fresh key -> INSERT
    await fund(contract.address);
    expect((await contract.put(11n, bigVal, alicePub, sig).send()).txid).toBeDefined(); // computed insert

    await fund(contract.address);
    expect((await contract.check(11n, bigVal, alicePub, sig).send()).txid).toBeDefined(); // read back
  });

  it('overwrite GC: overwriting a long value consumes the old chunks (no dust orphans)', async () => {
    const WRITE_SRC = `contract C() {
      mapping(int => bytes) data;
      function put(int k, bytes v, pubkey pk, sig s) { require(checkSig(s, pk)); data[k] = v; }
    }`;
    const art = compileString(WRITE_SRC, {});
    const contract = new Contract(art, [], { provider });

    const s5 = keyToSlot(bigIntToVmNumber(5n));
    const v1 = hexToBin('a1'.repeat(150)); // old long value -> 3 chunks
    const d1 = sha256.hash(v1);
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'data');
      const chunkAddr = getValueChunkAddress(pinned, cat, 'data');
      const outs = [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: binToHex(encodeEntryCommitment(ZERO, s5)) } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: binToHex(encodeEntryCommitment(s5, ZERO, valueTail(v1))) } } },
      ];
      splitValueIntoValueChunks(v1).forEach((data, i) => outs.push({
        address: chunkAddr, satoshis: 1500n, // >= dust for the ~200 B chunk-commitment token output on a live node
        token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: buildValueChunkCommitment(s5, d1, i, data) } },
      }));
      return outs;
    });
    const categoryId = result.categoryId;
    const chunkAddr = getValueChunkAddress(contract.withCategory(hexToBin(categoryId)), categoryId, 'data');
    const oldChunkCount = (await provider.getUtxos(chunkAddr)).length;
    expect(oldChunkCount).toBe(3); // v1's 3 chunks seeded

    const v2 = hexToBin('b2'.repeat(150)); // new long value (different digest)
    const sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.put(5n, v2, alicePub, sig).send()).txid).toBeDefined(); // overwrite: mint v2 chunks, consume v1's

    // Only v2's chunks remain at the address; v1's old chunks were co-spent (consumed), not orphaned.
    const remaining = (await provider.getUtxos(chunkAddr))
      .filter((u) => u.token?.nft?.commitment && u.token.nft.commitment.length > 0)
      .map((u) => binToHex(parseValueChunkCommitment(u.token!.nft!.commitment).digest));
    expect(remaining.every((d) => d === binToHex(sha256.hash(v2)))).toBe(true); // no v1-digest chunks left
    expect(remaining.length).toBe(3); // exactly v2's 3 chunks
  });
});
