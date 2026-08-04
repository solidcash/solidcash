import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// Boundary #4: a loop that assigns a loop-INVARIANT rawbytes value (bytes / int[]) to N sorted-mapping keys -
// `for(i) m[ks[i]] = a`. The covenant routes through the upsert loop; the value is stored as the inline chunkable
// tail (len4 ++ value, size<=60 asserted - chunked-in-loop fails closed). The SDK mirrors the tail. Present reads
// verify each key got `a`; an absent read is bracket-proven default.
describe('C2 array/bytes-VALUE insert loop for(i) m[ks[i]] = a', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0xf40;
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

  it('bytes value: fills N keys with one blob in a loop; each reads back; absent is default', async () => {
    const SRC = `contract C() {
      mapping(int => bytes) m;
      function fill(int[] ks, bytes a, pubkey pk, sig s) { require(checkSig(s, pk)); for (int i = 0; i < ks.length; i++) { m[ks[i]] = a; } }
      function chk(int k, bytes exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k] == exp); }
      function chkAbsent(int k, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k] == 0x); }
    }`;
    const art = compileString(SRC, { forceStateful: true });
    const info = art.abi.find((f: any) => f.name === 'fill')?.sortedUpsertLoopInfo?.[0];
    expect(info?.op).toBe('set');
    expect(info?.valueScalarParam).toBe('a');

    const c = await deploy(art);
    const blob = Uint8Array.from([0xca, 0xfe, 0xba, 0xbe]);
    await fund(c.address);
    expect((await c.fill([3n, 7n, 5n], blob, alicePub, sig).send()).txid).toBeDefined();
    for (const k of [3n, 5n, 7n]) {
      await fund(c.address);
      expect((await c.chk(k, blob, alicePub, sig).send()).txid).toBeDefined();
    }
    await fund(c.address);
    expect((await c.chkAbsent(9n, alicePub, sig).send()).txid).toBeDefined();
  });

  it('int[] value: fills N keys with one array in a loop; each element reads back', async () => {
    const SRC = `contract C() {
      mapping(int => int[]) m;
      function fill(int[] ks, int[] a, pubkey pk, sig s) { require(checkSig(s, pk)); for (int i = 0; i < ks.length; i++) { m[ks[i]] = a; } }
      function chk(int k, int idx, int exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k][idx] == exp); }
    }`;
    const art = compileString(SRC, { forceStateful: true });
    const c = await deploy(art);
    // int256 elements are 32-byte-packed, so a chunkable value must stay <=60 B inline -> one element (4B len + 32B).
    // A larger array chunks, which fails closed in a loop (verified separately).
    const arr = [42n];
    await fund(c.address);
    expect((await c.fill([2n, 8n, 5n], arr, alicePub, sig).send()).txid).toBeDefined();
    // Each key holds the array; check element 0.
    for (const k of [2n, 5n, 8n]) {
      await fund(c.address);
      expect((await c.chk(k, 0n, 42n, alicePub, sig).send()).txid).toBeDefined();
    }
  });

  it('fails closed for one invariant int[] value >60 B until loop chunk pins are supported', async () => {
    const SRC = `contract C() {
      mapping(int => int[]) m;
      function fill(int[] ks, int[] a, pubkey pk, sig s) { require(checkSig(s, pk)); for (int i = 0; i < ks.length; i++) { m[ks[i]] = a; } }
      function chk(int k, int idx, int exp) { require(m[k][idx] == exp); }
    }`;
    const art = compileString(SRC, { forceStateful: true });
    const c = await deploy(art);
    await fund(c.address);
    const arr = [11n, 22n, 33n]; // 100 B: persisted in authenticated reverse-suffix chunks.
    await expect(c.fill([2n, 8n], arr, alicePub, sig).send()).rejects.toThrow(/OP_VERIFY|preflight/i);
  });
});
