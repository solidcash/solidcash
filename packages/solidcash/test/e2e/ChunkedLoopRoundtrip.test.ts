/* eslint-disable max-len */
import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

const SRC = `contract C() {
  mapping(int => bytes) m;
  function fill(int[] ks, bytes[] vs, pubkey pk, sig s) { require(checkSig(s, pk)); for (int i = 0; i < ks.length; i++) { m[ks[i]] = vs[i]; } }
  function chk(int k, bytes exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k] == exp); }
}`;

describe('chunked >60 B per-iteration loop: update + insert roundtrip', () => {
  it('inserts a >60B value, updates it in place, and reads the exact value back', async () => {
    const provider = createTestProvider();
    const sig = new SignatureTemplate(alicePriv);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x5000;
    const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
    const fund = async (addr: string): Promise<void> => {
      await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 100000n });
    };

    const art = compileString(SRC, { forceStateful: true });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });

    const first = new Uint8Array(170).fill(0x11);
    const second = new Uint8Array(170).fill(0x22);

    // INSERT: a 170-byte value (>60 B -> chunked) to a new key 5.
    await fund(contract.address);
    expect((await contract.fill([5n], [first], alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.chk(5n, first, alicePub, sig).send()).txid).toBeDefined();

    // UPDATE: overwrite the SAME key with a different 170-byte value (last-wins, old chunks reclaimed).
    await fund(contract.address);
    expect((await contract.fill([5n], [second], alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.chk(5n, second, alicePub, sig).send()).txid).toBeDefined();
  }, 180_000);
});
