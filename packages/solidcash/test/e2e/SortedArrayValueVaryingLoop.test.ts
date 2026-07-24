import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// Boundary #4 (per-key sub-case): a loop that assigns a PER-KEY rawbytes value to N sorted-mapping keys -
// `for(i) m[ks[i]] = vs[i]` where vs is a bytes[] / int[][] param. Each vs[i] is committed as its own inline
// chunkable tail (len4 ++ value, size<=60 asserted - chunked-in-loop fails closed). The covenant visits vs[i] per
// iteration; the SDK encodes each key's own tail. Present reads verify each key got ITS value (independence);
// a duplicate key is last-wins.
describe('C2 per-key array/bytes-VALUE loop for(i) m[ks[i]] = vs[i]', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0x2f40;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const fund = async (addr: string): Promise<void> => {
    await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 100000n });
  };
  const deploy = async (art: any): Promise<any> => {
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    return contract;
  };

  it('bytes[] value: each key gets its OWN blob; reads are independent', async () => {
    const SRC = `contract C() {
      mapping(int => bytes) m;
      function fill(int[] ks, bytes[] vs, pubkey pk, sig s) { require(checkSig(s, pk)); for (int i = 0; i < ks.length; i++) { m[ks[i]] = vs[i]; } }
      function chk(int k, bytes exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k] == exp); }
    }`;
    const art = compileString(SRC, { forceStateful: true });
    const info = art.abi.find((f: any) => f.name === 'fill')?.sortedUpsertLoopInfo?.[0];
    expect(info?.op).toBe('set');
    expect(info?.valueArrayParam).toBe('vs');

    const c = await deploy(art);
    const vals: Record<string, Uint8Array> = {
      '3': Uint8Array.from([0xaa, 0xbb]),
      '7': Uint8Array.from([0xca, 0xfe, 0xba, 0xbe]),
      '5': Uint8Array.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]),
    };
    await fund(c.address);
    expect((await c.fill([3n, 7n, 5n], [vals['3'], vals['7'], vals['5']], alicePub, sig).send()).txid).toBeDefined();
    for (const k of [3n, 5n, 7n]) {
      await fund(c.address);
      expect((await c.chk(k, vals[k.toString()], alicePub, sig).send()).txid).toBeDefined();
    }
  });

  it('int[][] value: each key gets its OWN array; element reads are independent', async () => {
    const SRC = `contract C() {
      mapping(int => int[]) m;
      function fill(int[] ks, int[][] vs, pubkey pk, sig s) { require(checkSig(s, pk)); for (int i = 0; i < ks.length; i++) { m[ks[i]] = vs[i]; } }
      function chk(int k, int idx, int exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k][idx] == exp); }
    }`;
    const art = compileString(SRC, { forceStateful: true });
    const c = await deploy(art);
    // int256 elements are 32-byte-packed: 4B len + 32B = 36 B <= 60, so a 1-element array per key stays inline.
    await fund(c.address);
    expect((await c.fill([2n, 8n, 5n], [[10n], [20n], [30n]], alicePub, sig).send()).txid).toBeDefined();
    const exp: Record<string, bigint> = { '2': 10n, '8': 20n, '5': 30n };
    for (const k of [2n, 5n, 8n]) {
      await fund(c.address);
      expect((await c.chk(k, 0n, exp[k.toString()], alicePub, sig).send()).txid).toBeDefined();
    }
  });

  it('duplicate key is last-wins', async () => {
    const SRC = `contract C() {
      mapping(int => bytes) m;
      function fill(int[] ks, bytes[] vs, pubkey pk, sig s) { require(checkSig(s, pk)); for (int i = 0; i < ks.length; i++) { m[ks[i]] = vs[i]; } }
      function chk(int k, bytes exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k] == exp); }
    }`;
    const art = compileString(SRC, { forceStateful: true });
    const c = await deploy(art);
    const first = Uint8Array.from([0x11, 0x11]);
    const last = Uint8Array.from([0x99, 0x99, 0x99]);
    await fund(c.address);
    // key 4 listed twice: Solidity `= ` semantics keep the LAST write.
    expect((await c.fill([4n, 4n], [first, last], alicePub, sig).send()).txid).toBeDefined();
    await fund(c.address);
    expect((await c.chk(4n, last, alicePub, sig).send()).txid).toBeDefined();
  });

  it('persists per-key values above 60 B using authenticated reverse-suffix chunks', async () => {
    const SRC = `contract C() {
      mapping(int => bytes) m;
      function fill(int[] ks, bytes[] vs, pubkey pk, sig s) { require(checkSig(s, pk)); for (int i = 0; i < ks.length; i++) { m[ks[i]] = vs[i]; } }
      function chk(int k, bytes exp) { require(m[k] == exp); }
    }`;
    const art = compileString(SRC, { forceStateful: true });
    const c = await deploy(art);
    await fund(c.address);
    const big = new Uint8Array(70).fill(0x5a);
    const bigger = new Uint8Array(145).fill(0xa5);
    expect((await c.fill([2n, 8n], [big, bigger], alicePub, sig).send()).txid).toBeDefined();
    await fund(c.address);
    expect((await c.chk(2n, big).send()).txid).toBeDefined();
    await fund(c.address);
    expect((await c.chk(8n, bigger).send()).txid).toBeDefined();
  });

  it('authenticates varying-key push, element assignment, and pop across the chunk boundary', async () => {
    const SRC = `contract C() {
      mapping(int => int[]) m;
      function fill(int[] ks, int[][] vs, pubkey pk, sig s) {
        require(checkSig(s, pk));
        for (int i = 0; i < ks.length; i++) { m[ks[i]] = vs[i]; }
      }
      function pushMany(int[] ks, int[] vs, pubkey pk, sig s) {
        require(checkSig(s, pk));
        for (int i = 0; i < ks.length; i++) { m[ks[i]].push(vs[i]); }
      }
      function setMany(int[] ks, int[] idxs, int[] vs, pubkey pk, sig s) {
        require(checkSig(s, pk));
        for (int i = 0; i < ks.length; i++) { m[ks[i]][idxs[i]] = vs[i]; }
      }
      function popMany(int[] ks, pubkey pk, sig s) {
        require(checkSig(s, pk));
        for (int i = 0; i < ks.length; i++) { m[ks[i]].pop(); }
      }
      function chk(int k, int idx, int exp) { require(m[k][idx] == exp); }
    }`;
    const art = compileString(SRC, { forceStateful: true });
    expect(art.abi.find((f: any) => f.name === 'pushMany')?.sortedUpsertLoopInfo?.[0]?.mutation).toBe('push');
    expect(art.abi.find((f: any) => f.name === 'setMany')?.sortedUpsertLoopInfo?.[0]?.mutation).toBe('setAt');
    expect(art.abi.find((f: any) => f.name === 'popMany')?.sortedUpsertLoopInfo?.[0]?.mutation).toBe('pop');

    const c = await deploy(art);
    await fund(c.address);
    await c.fill([2n, 8n], [[10n], [20n]], alicePub, sig).send();

    // One push changes each int[] from an inline 36-byte value to a chunked 68-byte value.
    await fund(c.address);
    expect((await c.pushMany([2n, 8n], [11n, 21n], alicePub, sig).send()).txid).toBeDefined();
    await fund(c.address);
    expect((await c.chk(2n, 1n, 11n).send()).txid).toBeDefined();
    await fund(c.address);
    expect((await c.chk(8n, 1n, 21n).send()).txid).toBeDefined();

    // Mutate authenticated chunked old values, then pop back to the inline representation (old chunks are GC'd).
    await fund(c.address);
    expect((await c.setMany([2n, 8n], [0n, 1n], [12n, 22n], alicePub, sig).send()).txid).toBeDefined();
    await fund(c.address);
    expect((await c.popMany([2n, 8n], alicePub, sig).send()).txid).toBeDefined();
    await fund(c.address);
    expect((await c.chk(2n, 0n, 12n).send()).txid).toBeDefined();
    await fund(c.address);
    expect((await c.chk(8n, 0n, 20n).send()).txid).toBeDefined();
  });
});
