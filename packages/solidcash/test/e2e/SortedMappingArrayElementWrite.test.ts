import { describe, it, expect } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
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

  it('an array mapping that uses push/pop stays on the DEFAULT model (no C2 regression of push/pop)', () => {
    // `m[k].push`/`.pop` change the element count, which can flip the array value across the inline<->chunked size
    // boundary; that computed-value size-class transition is not wired for C2 yet. To avoid regressing push/pop
    // (which works on the default entry model), an array-valued mapping that uses push/pop opts OUT of sorted C2.
    // A push/pop-free array mapping still gets C2 (chunking large values), as the first two tests show.
    const withPush = `contract C() {
      mapping(int => int[]) m;
      function push(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); m[k].push(v); }
      function setAt(int k, int i, int v, pubkey pk, sig s) { require(checkSig(s, pk)); m[k][i] = v; }
    }`;
    const noPush = `contract C() {
      mapping(int => int[]) n;
      function setAt(int k, int i, int v, pubkey pk, sig s) { require(checkSig(s, pk)); n[k][i] = v; }
    }`;
    const artPush = compileString(withPush); // compiles fine, default model
    expect(artPush.stateLayout?.collections?.find((c) => c.name === 'm')?.sorted).toBeFalsy();
    const artNoPush = compileString(noPush); // no push/pop -> C2
    expect(artNoPush.stateLayout?.collections?.find((c) => c.name === 'n')?.sorted).toBe(true);
    expect(artNoPush.stateLayout?.collections?.find((c) => c.name === 'n')?.chunkableValue).toBe(true);
  });
});
