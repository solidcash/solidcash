import { describe, it, expect } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// Solidity's `mapping(K => Struct) public m` getter returns the struct's scalar fields as one named tuple, which the
// compiler (under solidityImportCompat) publishes as one output per field. Awaiting that ABI entry point must READ
// the tuple: `_isPureRead` treated anything but a single output as a state write and the multi-output branch of
// the return derivation failed closed, so the await SENT a transaction. The bare getter name resolves to the
// authenticated state accessor instead, which keeps the declared struct shape.
const SRC = `contract Registry() {
  struct S { uint256 a; bytes b; string c; }
  mapping(int => S) public m;
  function set(int k, uint256 a, bytes b, string c) {
    m[k] = S(a, b, c);
    require(true);
  }
}`;

describe('struct-valued mapping getter reads back as a named tuple', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0xf00;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const fund = async (address: string): Promise<void> => {
    await provider.addUtxo(address, { txid: uid(), vout: 0, satoshis: 100000n });
  };

  it('returns the struct fields by name, in field order', async () => {
    const art = compileString(SRC, { forceStateful: true, solidityImportCompat: true });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig),
      initialState: {}, changeAddress: p2pkh.address,
    });
    await fund(contract.address);
    expect((await contract.set(0, 7n, hexToBin('cafe'), 'hi').send()).txid).toBeDefined();

    // The getter is an ABI entry point, so awaiting it must DERIVE the value rather than send.
    const row = await (contract as unknown as {
      call: { m: (key: number) => Promise<Record<string, unknown>> };
    }).call.m(0);
    expect(Array.isArray(row)).toBe(true);
    expect(row.a).toBe(7n);
    expect(row.b).toEqual(hexToBin('cafe'));
    expect(row.c).toBe('hi');
    // ethers-v6 `Result` parity: the tuple also carries positional components and a plain named copy.
    expect(row[0]).toBe(7n);
    expect((row.toObject as () => Record<string, unknown>)()).toEqual({ a: 7n, b: hexToBin('cafe'), c: 'hi' });
    // The bare getter name reads the authenticated entry in its declared struct shape.
    const entry = await (contract as unknown as { m: (key: number) => Promise<Record<string, unknown>> }).m(0);
    expect(entry.a).toBe(7n);
    expect(entry.c).toBe('hi');
  });
});
