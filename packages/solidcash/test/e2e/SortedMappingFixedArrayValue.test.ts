/* eslint-disable max-len */
import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

describe('sorted fixed-array-valued mapping (C2)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  it('int[3] element write + read under C2', async () => {
    const SRC = `contract C() {
      mapping(int => int[3]) m;
      function setAt(int k, int i, int v, pubkey pk, sig s) { require(checkSig(s, pk)); m[k][i] = v; }
      function chkAt(int k, int i, int e, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k][i] == e); }
    }`;
    const art = compileString(SRC);
    expect(art.stateLayout?.collections?.find((c) => c.name === 'm')?.sorted).toBe(true);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x3d00;
    const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
    const fund = async (a: string): Promise<void> => { await provider.addUtxo(a, { txid: uid(), vout: 0, satoshis: 100000n }); };
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    await fund(contract.address);
    expect((await contract.setAt(5n, 1n, 42n, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.chkAt(5n, 1n, 42n, alicePub, sig).send()).txid).toBeDefined();
  });
});
