import { describe, it, expect } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// General P5b chunking for DYNAMIC ARRAY values in a sorted (C2) mapping. A dynamic array value is chunkable:
// small arrays inline (len4 tail), large arrays chunk off-commitment. Element writes `m[k][i]=v` and push/pop are
// whole-value RMW (materialize the array, apply surgery, re-chunk), mirroring the struct field-write path.
describe('sorted array-valued mapping: element write + chunking', () => {
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

  it('int[] (var-width elements): whole assign, element read, element write preserves neighbors', async () => {
    const SRC = `contract C() {
      mapping(int => int[]) m;
      function set3(int k, int a, int b, int c, pubkey pk, sig s) { require(checkSig(s, pk)); m[k] = [a, b, c]; }
      function setAt(int k, int i, int v, pubkey pk, sig s) { require(checkSig(s, pk)); m[k][i] = v; }
      function checkAt(int k, int i, int e, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k][i] == e); }
    }`;
    const art = compileString(SRC);
    expect(art.stateLayout?.collections?.find((c) => c.name === 'm')?.sorted).toBe(true);
    expect(art.stateLayout?.collections?.find((c) => c.name === 'm')?.chunkableValue).toBe(true);
    const { contract, fund } = await setup(art, 0x2a00);

    await fund(contract.address);
    expect((await contract.set3(5n, 10n, 20n, 30n, alicePub, sig).send()).txid).toBeDefined(); // m[5] = [10,20,30]
    await fund(contract.address);
    expect((await contract.checkAt(5n, 1n, 20n, alicePub, sig).send()).txid).toBeDefined(); // element read
    await fund(contract.address);
    expect((await contract.setAt(5n, 1n, 99n, alicePub, sig).send()).txid).toBeDefined(); // m[5][1] = 99
    await fund(contract.address);
    expect((await contract.checkAt(5n, 1n, 99n, alicePub, sig).send()).txid).toBeDefined(); // updated
    await fund(contract.address);
    expect((await contract.checkAt(5n, 0n, 10n, alicePub, sig).send()).txid).toBeDefined(); // neighbor preserved
    await fund(contract.address);
    expect((await contract.checkAt(5n, 2n, 30n, alicePub, sig).send()).txid).toBeDefined(); // neighbor preserved
  });

  it('bytes32[] (fixed-width): LARGE array (>128 B) chunks off-commitment; element read + write', async () => {
    // 6 * 32 B = 192 B of elements + length prefix > 128 B commitment -> the array value chunks (P5b general).
    const SRC = `contract C() {
      mapping(int => bytes32[]) m;
      function set(int k, bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e, bytes32 f, pubkey pk, sig s) {
        require(checkSig(s, pk)); m[k] = [a, b, c, d, e, f];
      }
      function setAt(int k, int i, bytes32 v, pubkey pk, sig s) { require(checkSig(s, pk)); m[k][i] = v; }
      function checkAt(int k, int i, bytes32 e, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k][i] == e); }
    }`;
    const art = compileString(SRC);
    expect(art.stateLayout?.collections?.find((c) => c.name === 'm')?.chunkableValue).toBe(true);
    const { contract, fund } = await setup(art, 0x2b00);

    const b = (h: string): Uint8Array => hexToBin(h.repeat(32));
    await fund(contract.address);
    expect((await contract.set(7n, b('a1'), b('b2'), b('c3'), b('d4'), b('e5'), b('f6'), alicePub, sig).send()).txid)
      .toBeDefined(); // m[7] = 6 x bytes32 (chunked)
    await fund(contract.address);
    expect((await contract.checkAt(7n, 3n, b('d4'), alicePub, sig).send()).txid).toBeDefined(); // element read of chunked
    await fund(contract.address);
    expect((await contract.setAt(7n, 3n, b('99'), alicePub, sig).send()).txid).toBeDefined(); // element write -> re-chunk
    await fund(contract.address);
    expect((await contract.checkAt(7n, 3n, b('99'), alicePub, sig).send()).txid).toBeDefined(); // updated
    await fund(contract.address);
    expect((await contract.checkAt(7n, 0n, b('a1'), alicePub, sig).send()).txid).toBeDefined(); // element 0 preserved
    await fund(contract.address);
    expect((await contract.checkAt(7n, 5n, b('f6'), alicePub, sig).send()).txid).toBeDefined(); // element 5 preserved
  });

  it('push/pop under C2: INSERT (empty->[v]), inline->chunked and back, across the 60 B boundary', async () => {
    // push/pop CHANGE the element count, so the value can flip across the inline<->chunked size boundary. int elems
    // pack 32 B, so [10] = 34 B (inline), [10,20] = 66 B (chunked). Exercises INSERT-via-push (computed value),
    // inline->chunked (push), chunked->chunked (push), and chunked->inline (pop) - the SDK derives the new chunk set.
    const SRC = `contract C() {
      mapping(int => int[]) m;
      function push(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); m[k].push(v); }
      function pop(int k, pubkey pk, sig s) { require(checkSig(s, pk)); m[k].pop(); }
      function checkAt(int k, int i, int e, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k][i] == e); }
    }`;
    const art = compileString(SRC);
    expect(art.stateLayout?.collections?.find((c) => c.name === 'm')?.sorted).toBe(true);
    const { contract, fund } = await setup(art, 0x2c00);

    await fund(contract.address);
    expect((await contract.push(5n, 10n, alicePub, sig).send()).txid).toBeDefined(); // INSERT: m[5] = [10] (inline)
    await fund(contract.address);
    expect((await contract.checkAt(5n, 0n, 10n, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.push(5n, 20n, alicePub, sig).send()).txid).toBeDefined(); // inline->chunked: m[5]=[10,20]
    await fund(contract.address);
    expect((await contract.checkAt(5n, 1n, 20n, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.push(5n, 30n, alicePub, sig).send()).txid).toBeDefined(); // chunked->chunked: m[5]=[10,20,30]
    await fund(contract.address);
    expect((await contract.checkAt(5n, 2n, 30n, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.pop(5n, alicePub, sig).send()).txid).toBeDefined(); // chunked->chunked: m[5]=[10,20]
    await fund(contract.address);
    expect((await contract.checkAt(5n, 1n, 20n, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.pop(5n, alicePub, sig).send()).txid).toBeDefined(); // chunked->inline: m[5]=[10]
    await fund(contract.address);
    expect((await contract.checkAt(5n, 0n, 10n, alicePub, sig).send()).txid).toBeDefined();
  });
});
