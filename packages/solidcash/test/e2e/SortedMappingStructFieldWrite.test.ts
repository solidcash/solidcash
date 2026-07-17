import { describe, it, expect } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// Field WRITE on a chunkable struct value: pos[k].x = v (RMW of the struct blob) must materialize the current
// struct, replace field x, and re-store (chunk if large). Small struct here uses the inline len4 tail.
describe('sorted struct-valued mapping: field write', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('pos[k].x = v updates one field, preserving the other; then reads back', async () => {
    const SRC = `contract C() {
      struct P { int x; int y; }
      mapping(int => P) pos;
      function setP(int k, int x, int y, pubkey pk, sig s) { require(checkSig(s, pk)); pos[k] = P(x, y); }
      function setX(int k, int nx, pubkey pk, sig s) { require(checkSig(s, pk)); pos[k].x = nx; }
      function checkXY(int k, int ex, int ey, pubkey pk, sig s) { require(checkSig(s, pk)); require(pos[k].x == ex); require(pos[k].y == ey); }
    }`;
    const art = compileString(SRC);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x1a00;
    const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
    const fund = async (addr: string): Promise<void> => {
      await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 100000n });
    };

    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });

    await fund(contract.address);
    expect((await contract.setP(5n, 1n, 2n, alicePub, sig).send()).txid).toBeDefined(); // pos[5] = P(1, 2)
    await fund(contract.address);
    expect((await contract.checkXY(5n, 1n, 2n, alicePub, sig).send()).txid).toBeDefined();

    await fund(contract.address);
    expect((await contract.setX(5n, 9n, alicePub, sig).send()).txid).toBeDefined(); // pos[5].x = 9
    await fund(contract.address);
    expect((await contract.checkXY(5n, 9n, 2n, alicePub, sig).send()).txid).toBeDefined(); // x updated, y preserved
  });

  it('LARGE struct (>128 B) chunks off-commitment; whole assign, field read + write, all work', async () => {
    // struct of 5 bytes32 = 160 B blob > 128 B commitment -> the struct value chunks (P5b, general).
    const SRC = `contract C() {
      struct Big { bytes32 a; bytes32 b; bytes32 c; bytes32 d; bytes32 e; }
      mapping(int => Big) m;
      function set(int k, bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e, pubkey pk, sig s) { require(checkSig(s, pk)); m[k] = Big(a, b, c, d, e); }
      function setC(int k, bytes32 nc, pubkey pk, sig s) { require(checkSig(s, pk)); m[k].c = nc; }
      function checkC(int k, bytes32 ec, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k].c == ec); }
      function checkA(int k, bytes32 ea, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k].a == ea); }
    }`;
    const art = compileString(SRC);
    expect(art.stateLayout?.collections?.find((c) => c.name === 'm')?.chunkableValue).toBe(true); // struct is chunkable
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x1b00;
    const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
    const fund = async (addr: string): Promise<void> => {
      await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 100000n });
    };

    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });

    const b = (h: string): Uint8Array => hexToBin(h.repeat(32));
    await fund(contract.address);
    expect((await contract.set(7n, b('a1'), b('b2'), b('c3'), b('d4'), b('e5'), alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.checkC(7n, b('c3'), alicePub, sig).send()).txid).toBeDefined(); // field read of a chunked struct

    await fund(contract.address);
    expect((await contract.setC(7n, b('99'), alicePub, sig).send()).txid).toBeDefined(); // field WRITE of a chunked struct
    await fund(contract.address);
    expect((await contract.checkC(7n, b('99'), alicePub, sig).send()).txid).toBeDefined(); // c updated
    await fund(contract.address);
    expect((await contract.checkA(7n, b('a1'), alicePub, sig).send()).txid).toBeDefined(); // a preserved
  });
});
