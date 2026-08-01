/* eslint-disable max-len */
import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// A struct storage-pointer library fn applied to a MAPPING ELEMENT (`L.addX(pos[k], d)` / BentoBox BoringRebase
// `totals[t].addElastic(x)`): InlineStoragePointerCalls lowers it to the read-modify-write template
// `P __sp = pos[k]; __sp.x += d; pos[k] = __sp;`. This proves the RMW behaves IDENTICALLY to the direct
// `pos[k].x += d` field write - the mutation lands on the mapping element and the untouched field is preserved.
describe('storage-pointer library fn on a mapping element (RMW inline)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  let deploymentNonce = 0x5c00;

  const SRC = `struct P { int x; int y; }
    library L {
      function addX(P storage p, int d) { p.x += d; }
      function setBoth(P storage p, int nx, int ny) { p.x = nx; p.y = ny; }
    }
    contract C() {
      mapping(int => P) pos;
      function setP(int k, int x, int y, pubkey pk, sig s) { require(checkSig(s, pk)); this.pos[k] = P(x, y); }
      function bumpX(int k, int d, pubkey pk, sig s) { require(checkSig(s, pk)); L.addX(this.pos[k], d); }
      function setBoth(int k, int nx, int ny, pubkey pk, sig s) { require(checkSig(s, pk)); L.setBoth(this.pos[k], nx, ny); }
      function checkXY(int k, int ex, int ey, pubkey pk, sig s) {
        require(checkSig(s, pk)); require(this.pos[k].x == ex); require(this.pos[k].y == ey);
      }
    }`;

  const deploy = async (): Promise<{ contract: Record<string, (...a: unknown[]) => { send: () => Promise<{ txid: string }> }>; fund: () => Promise<void> }> => {
    const art = compileString(SRC, { solidityImportCompat: true });
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const uid = (): string => { deploymentNonce += 1; return deploymentNonce.toString(16).padStart(64, '0'); };
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    const fund = async (): Promise<void> => { await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 100000n }); };
    return { contract: contract as never, fund };
  };

  it('L.addX(pos[k], d) mutates x on the mapping element, preserves y (== direct pos[k].x += d)', async () => {
    const { contract, fund } = await deploy();
    await fund();
    expect((await contract.setP(5n, 1n, 2n, alicePub, sig).send()).txid).toBeDefined(); // pos[5] = P(1, 2)
    await fund();
    expect((await contract.bumpX(5n, 9n, alicePub, sig).send()).txid).toBeDefined(); // L.addX -> pos[5].x += 9 -> 10
    await fund();
    expect((await contract.checkXY(5n, 10n, 2n, alicePub, sig).send()).txid).toBeDefined(); // x=10, y preserved=2
  });

  it('L.setBoth(pos[k], nx, ny) writes both fields of the mapping element via the storage pointer', async () => {
    const { contract, fund } = await deploy();
    await fund();
    expect((await contract.setP(3n, 7n, 8n, alicePub, sig).send()).txid).toBeDefined(); // pos[3] = P(7, 8)
    await fund();
    expect((await contract.setBoth(3n, 100n, 200n, alicePub, sig).send()).txid).toBeDefined(); // pos[3] = P(100, 200)
    await fund();
    expect((await contract.checkXY(3n, 100n, 200n, alicePub, sig).send()).txid).toBeDefined();
  });

  // The `using L for P` method-call spelling (`pos[k].addX(d)`, how BentoBox writes `totals[t].addElastic(x)`).
  // RedesugarImportedUsingForCalls rewrites the struct-valued mapping-element receiver to `L.addX(pos[k], d)`
  // before InlineStoragePointerCalls, which then applies the same RMW inline.
  it('using-for `pos[k].addX(d)` method spelling resolves + mutates the mapping element', async () => {
    const USRC = `struct P { int x; int y; }
      library L { function addX(P storage p, int d) { p.x += d; } }
      contract C() {
        using L for P;
        mapping(int => P) pos;
        function setP(int k, int x, int y, pubkey pk, sig s) { require(checkSig(s, pk)); this.pos[k] = P(x, y); }
        function bumpX(int k, int d, pubkey pk, sig s) { require(checkSig(s, pk)); this.pos[k].addX(d); }
        function checkXY(int k, int ex, int ey, pubkey pk, sig s) {
          require(checkSig(s, pk)); require(this.pos[k].x == ex); require(this.pos[k].y == ey);
        }
      }`;
    const art = compileString(USRC, { solidityImportCompat: true });
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x5d00;
    const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    const c = contract as unknown as Record<string, (...a: unknown[]) => { send: () => Promise<{ txid: string }> }>;
    const fund = async (): Promise<void> => { await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 100000n }); };
    await fund();
    expect((await c.setP(4n, 5n, 6n, alicePub, sig).send()).txid).toBeDefined(); // pos[4] = P(5, 6)
    await fund();
    expect((await c.bumpX(4n, 3n, alicePub, sig).send()).txid).toBeDefined(); // pos[4].addX(3) -> x = 8
    await fund();
    expect((await c.checkXY(4n, 8n, 6n, alicePub, sig).send()).txid).toBeDefined(); // x=8, y preserved=6
  });

  // A struct storage-pointer on a bare STATE struct var (`L.addX(this.tot, d)`) - whole-struct RMW of the scalar
  // state var. And on a state-ARRAY element (`L.addX(this.arr[i], d)`) - the array-element read via the same RMW.
  it('storage-pointer on a bare state struct var + a state-array element both mutate correctly', async () => {
    const VSRC = `struct P { int x; int y; }
      library L { function addX(P storage p, int d) { p.x += d; } }
      contract C() {
        P tot;
        P[] arr;
        function setTot(int x, int y, pubkey pk, sig s) { require(checkSig(s, pk)); this.tot = P(x, y); }
        function bumpTot(int d, pubkey pk, sig s) { require(checkSig(s, pk)); L.addX(this.tot, d); }
        function checkTot(int ex, int ey, pubkey pk, sig s) { require(checkSig(s, pk)); require(this.tot.x == ex); require(this.tot.y == ey); }
        function pushArr(int x, int y, pubkey pk, sig s) { require(checkSig(s, pk)); this.arr.push(P(x, y)); }
        function bumpArr(int i, int d, pubkey pk, sig s) { require(checkSig(s, pk)); L.addX(this.arr[i], d); }
        function checkArr(int i, int ex, int ey, pubkey pk, sig s) { require(checkSig(s, pk)); require(this.arr[i].x == ex); require(this.arr[i].y == ey); }
      }`;
    const art = compileString(VSRC, { solidityImportCompat: true });
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x5e00;
    const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    const c = contract as unknown as Record<string, (...a: unknown[]) => { send: () => Promise<{ txid: string }> }>;
    const fund = async (): Promise<void> => { await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 100000n }); };
    // bare state struct var
    await fund();
    expect((await c.setTot(1n, 2n, alicePub, sig).send()).txid).toBeDefined(); // tot = P(1, 2)
    await fund();
    expect((await c.bumpTot(5n, alicePub, sig).send()).txid).toBeDefined(); // L.addX(this.tot, 5) -> x = 6
    await fund();
    expect((await c.checkTot(6n, 2n, alicePub, sig).send()).txid).toBeDefined(); // x=6, y=2
    // state-array element
    await fund();
    expect((await c.pushArr(10n, 20n, alicePub, sig).send()).txid).toBeDefined(); // arr[0] = P(10, 20)
    await fund();
    expect((await c.bumpArr(0n, 7n, alicePub, sig).send()).txid).toBeDefined(); // L.addX(this.arr[0], 7) -> x = 17
    await fund();
    expect((await c.checkArr(0n, 17n, 20n, alicePub, sig).send()).txid).toBeDefined(); // x=17, y=20 preserved
  });
});
