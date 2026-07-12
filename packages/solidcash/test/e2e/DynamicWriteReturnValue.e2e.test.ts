import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Regression: a DYNAMIC-storage write (chunked array / string) in a VALUE-RETURNING function
// (`function f() returns(int){ arr.push(x); ... }`) failed at send with "invalid output index". The trailing
// chunk output index blockSize+i counts the returnEvent slot, which a plain .send() does NOT materialize (only
// .emitReturn()), so the chunk sits one output lower. Fixed on BOTH sides in sync: the covenant
// (emitDynamicWriteVerification) subtracts 1 at runtime when __internal__returnOutputIdx < 0, and the SDK
// (getChunkOutputBase) subtracts 1 when the returnEvent slot is present but not materialized
// (pendingReturnEventOutputs empty). A common pattern (`append() returns(newLength)`).
const provider = createTestProvider();
const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
let nonce = 0xC000;
const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(4, '0').repeat(16); };
async function dep(src: string, init: Record<string, unknown>): Promise<any> {
  const f = { txid: uid(), vout: 0, satoshis: 400000n };
  await provider.addUtxo(p2pkh.address, f);
  return (await StatefulContract.deploy(compileString(src), [], {
    provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    initialState: init, changeAddress: p2pkh.address,
  })).contract;
}
async function fund(c: any): Promise<void> {
  await provider.addUtxo(c.address, { txid: uid(), vout: 0, satoshis: 100000n });
}

describe('dynamic-storage write in a value-returning function', () => {
  it('array push in a returning function (plain send, return discarded)', async () => {
    const c = await dep('contract C { int[] arr; function run() public returns (int) { arr.push(5); return 0; } }', { arr: [] });
    await fund(c); await c.run().send();
    expect(Number((await c.getState()).arr[0])).toBe(5);
  });

  it('array element writes in a loop in a returning function', async () => {
    const c = await dep(`contract C { int[] arr;
      function run() public returns (int) { while (arr.length < 5) arr.push(); for (int i = 0; i < 5; i++) { arr[i] = i; } return 99; }
    }`, { arr: [] });
    await fund(c); await c.run().send();
    const s = await c.getState();
    expect(Number(s.arr[0])).toBe(0); expect(Number(s.arr[3])).toBe(3);
  });

  it('string write in a returning function', async () => {
    const c = await dep('contract C { string s; function run() public returns (int) { s = "the quick brown fox jumps over the lazy dog"; return 0; } }', { s: '' });
    await fund(c); await c.run().send();
    expect((await c.getState()).s).toBe('the quick brown fox jumps over the lazy dog');
  });

  it('emitReturn (returnEvent materialized) still works alongside a dynamic write', async () => {
    const c = await dep('contract C { int[] arr; function run() public returns (int) { arr.push(8); return 42; } }', { arr: [] });
    await fund(c); await c.run().emitReturn().send();
    expect(Number((await c.getState()).arr[0])).toBe(8);
  });
});
