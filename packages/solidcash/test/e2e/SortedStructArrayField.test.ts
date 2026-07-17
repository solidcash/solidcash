import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// A struct with a dynamic-array field `struct S { int a; int[] d; }` is decomposed into per-field mappings (m__a,
// m__d), each C2-backed by default. So field access (m[k].a), inner-array element read/write (m[k].d[i]) and inner
// push all route to independent C2 sub-mappings - each unforgeable + chunk-aware. This locks that end-to-end.
describe('sorted struct-with-array-field mapping (field-decomposed C2)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  const setup = async (art: ReturnType<typeof compileString>, nonceBase: number): Promise<{
    contract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    fund: (addr: string) => Promise<void>;
  }> => {
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = nonceBase;
    const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
    const fund = async (addr: string): Promise<void> => {
      await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 100000n });
    };
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    return { contract, fund };
  };

  it('scalar field + inner-array push/read are independent C2 sub-mappings', async () => {
    const SRC = `contract C() {
      struct S { int a; int[] d; }
      mapping(int => S) m;
      function setA(int k, int a, pubkey pk, sig s) { require(checkSig(s, pk)); m[k].a = a; }
      function push(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); m[k].d.push(v); }
      function checkA(int k, int e, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k].a == e); }
      function checkAt(int k, int i, int e, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k].d[i] == e); }
    }`;
    const art = compileString(SRC);
    // decomposed into per-field C2 sub-mappings
    const cols = art.stateLayout?.collections ?? [];
    expect(cols.find((c) => c.name === 'm__a')?.sorted).toBe(true);
    expect(cols.find((c) => c.name === 'm__d')?.sorted).toBe(true);
    const { contract, fund } = await setup(art, 0x3a00);

    await fund(contract.address);
    expect((await contract.setA(5n, 42n, alicePub, sig).send()).txid).toBeDefined(); // m[5].a = 42
    await fund(contract.address);
    expect((await contract.push(5n, 10n, alicePub, sig).send()).txid).toBeDefined(); // m[5].d = [10]
    await fund(contract.address);
    expect((await contract.push(5n, 20n, alicePub, sig).send()).txid).toBeDefined(); // m[5].d = [10,20]
    await fund(contract.address);
    expect((await contract.checkA(5n, 42n, alicePub, sig).send()).txid).toBeDefined(); // scalar unaffected by pushes
    await fund(contract.address);
    expect((await contract.checkAt(5n, 1n, 20n, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.checkAt(5n, 0n, 10n, alicePub, sig).send()).txid).toBeDefined();
  });
});
