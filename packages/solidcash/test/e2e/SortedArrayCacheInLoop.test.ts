import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// A C2 array entry written more than once in one call (`for(..) m[k][j]=v` / `m[k].push(v)`, read-after-write
// `m[k][j]=m[k][j-1]+1`, or consecutive `m[k][0]=x; m[k][2]=z`) is a RUNTIME cache-in-loop desugar: read m[k] once,
// mutate a LOCAL array (all reads+writes redirected), flush `m[k]=local` as ONE upsert - never unrolled (byte-limit
// safe). Reads redirect to the local, so read-after-write reads the value being built.
describe('sorted C2 array loop write (runtime cache-in-loop)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  const setup = async (art: ReturnType<typeof compileString>, nb: number): Promise<{
    contract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract']; fund: (a: string) => Promise<void>;
  }> => {
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = nb;
    const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
    const fund = async (a: string): Promise<void> => {
      await provider.addUtxo(a, { txid: uid(), vout: 0, satoshis: 100000n });
    };
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    return { contract, fund };
  };

  it('push loop builds the array; fill loop overwrites; values verified', async () => {
    const SRC = `contract C() {
      mapping(int => int[]) m;
      function build(int k, int n, pubkey pk, sig s) { require(checkSig(s, pk)); for (int j = 0; j < n; j++) { m[k].push(j * 10); } }
      function fill(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); for (int j = 0; j < 3; j++) { m[k][j] = v; } }
      function chk(int k, int i, int e, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k][i] == e); }
    }`;
    const art = compileString(SRC);
    const { contract, fund } = await setup(art, 0x6a00);

    await fund(contract.address);
    expect((await contract.build(5n, 3n, alicePub, sig).send()).txid).toBeDefined(); // m[5]=[0,10,20]
    await fund(contract.address);
    expect((await contract.chk(5n, 0n, 0n, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.chk(5n, 1n, 10n, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.chk(5n, 2n, 20n, alicePub, sig).send()).txid).toBeDefined();

    await fund(contract.address);
    expect((await contract.fill(5n, 9n, alicePub, sig).send()).txid).toBeDefined(); // m[5]=[9,9,9]
    await fund(contract.address);
    expect((await contract.chk(5n, 0n, 9n, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.chk(5n, 2n, 9n, alicePub, sig).send()).txid).toBeDefined();
  });

  it('read-after-write loop `m[k][j]=m[k][j-1]+1` reads the local cache being built (correct values)', async () => {
    const SRC = `contract C() {
      mapping(int => int[]) m;
      function set3(int k, int a, int b, int c, pubkey pk, sig s) { require(checkSig(s, pk)); m[k] = [a, b, c]; }
      function prefix(int k, pubkey pk, sig s) { require(checkSig(s, pk)); for (int j = 1; j < 3; j++) { m[k][j] = m[k][j - 1] + 1; } }
      function chk(int k, int i, int e, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k][i] == e); }
    }`;
    const art = compileString(SRC);
    const { contract, fund } = await setup(art, 0x6b00);
    await fund(contract.address);
    expect((await contract.set3(5n, 0n, 10n, 20n, alicePub, sig).send()).txid).toBeDefined(); // [0,10,20]
    // j=1: m[1]=m[0]+1=1 (reads the just-computed cache, not the on-chain entry); j=2: m[2]=m[1]+1=2  -> [0,1,2]
    await fund(contract.address);
    expect((await contract.prefix(5n, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.chk(5n, 0n, 0n, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.chk(5n, 1n, 1n, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.chk(5n, 2n, 2n, alicePub, sig).send()).txid).toBeDefined();
  });
});

describe('sorted C2 array CONSECUTIVE straight-line writes (function-scoped cache)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  it('m[k][0]=x; m[k][2]=z; (two straight-line element writes) coalesce to one upsert', async () => {
    const SRC = `contract C() {
      mapping(int => int[]) m;
      function set3(int k, int a, int b, int c, pubkey pk, sig s) { require(checkSig(s, pk)); m[k] = [a, b, c]; }
      function set02(int k, int x, int z, pubkey pk, sig s) { require(checkSig(s, pk)); m[k][0] = x; m[k][2] = z; }
      function chk(int k, int i, int e, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k][i] == e); }
    }`;
    const art = compileString(SRC);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x6c00;
    const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
    const fund = async (a: string): Promise<void> => {
      await provider.addUtxo(a, { txid: uid(), vout: 0, satoshis: 100000n });
    };
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    await fund(contract.address);
    expect((await contract.set3(5n, 1n, 2n, 3n, alicePub, sig).send()).txid).toBeDefined(); // [1,2,3]
    await fund(contract.address);
    expect((await contract.set02(5n, 100n, 300n, alicePub, sig).send()).txid).toBeDefined(); // [100,2,300]
    await fund(contract.address);
    expect((await contract.chk(5n, 0n, 100n, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.chk(5n, 1n, 2n, alicePub, sig).send()).txid).toBeDefined(); // middle preserved
    await fund(contract.address);
    expect((await contract.chk(5n, 2n, 300n, alicePub, sig).send()).txid).toBeDefined();
  });
});
