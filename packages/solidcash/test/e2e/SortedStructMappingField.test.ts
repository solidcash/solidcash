import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// A struct with a mapping field `struct S { mapping(int=>bool) seen; int[] keys; }` is decomposed into per-field
// collections: m__seen (a nested C2 mapping keyed [k][j]) and m__keys (a C2 array). This is the Solidity
// IterableMapping / EnumerableSet shape, and every field is independently C2 (unforgeable exclusion-proof reads).
describe('sorted struct-with-mapping-field mapping (field-decomposed C2, IterableMapping shape)', () => {
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

  it('nested mapping field + array field both work as independent C2 sub-collections', async () => {
    const SRC = `contract C() {
      struct S { mapping(int => bool) seen; int[] keys; }
      mapping(int => S) m;
      function mark(int k, int j, pubkey pk, sig s) { require(checkSig(s, pk)); m[k].seen[j] = true; }
      function addKey(int k, int j, pubkey pk, sig s) { require(checkSig(s, pk)); m[k].keys.push(j); }
      function isSeen(int k, int j, bool e, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k].seen[j] == e); }
      function keyAt(int k, int i, int e, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k].keys[i] == e); }
    }`;
    const art = compileString(SRC, { sortedMappings: ['m__keys'] }); // opt the decomposed array field into C2
    const cols = art.stateLayout?.collections ?? [];
    expect(cols.find((c) => c.name === 'm__seen')?.sorted).toBe(true);
    expect(cols.find((c) => c.name === 'm__keys')?.sorted).toBe(true);
    const { contract, fund } = await setup(art, 0x3b00);

    await fund(contract.address);
    expect((await contract.mark(5n, 7n, alicePub, sig).send()).txid).toBeDefined(); // m[5].seen[7] = true
    await fund(contract.address);
    expect((await contract.addKey(5n, 7n, alicePub, sig).send()).txid).toBeDefined(); // m[5].keys = [7]
    await fund(contract.address);
    expect((await contract.isSeen(5n, 7n, true, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.isSeen(5n, 8n, false, alicePub, sig).send()).txid).toBeDefined(); // absent -> proven false
    await fund(contract.address);
    expect((await contract.keyAt(5n, 0n, 7n, alicePub, sig).send()).txid).toBeDefined();
    // a DIFFERENT outer key k=6 is independent
    await fund(contract.address);
    expect((await contract.isSeen(6n, 7n, false, alicePub, sig).send()).txid).toBeDefined();
  });
});
