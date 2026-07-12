import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Completeness pin for INTERNAL function-pointer STATE variables:
//  - an UNINITIALIZED internal fn-ptr state var, when CALLED, must revert (Solidity panics on a null fn-ptr).
//    This is the state-var analogue of the local/delete default fixed in 6ffb6b8f; the SDK deploy-time default
//    does NOT dispatch to function-0 (verified across void + int-typed pointers).
//  - a SET internal fn-ptr state var persists across txs and dispatches to the stored functionId.
const provider = createTestProvider();
const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
let nonce = 0x300;
const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
async function dep(src: string, init: Record<string, unknown>): Promise<any> {
  const f = { txid: uid(), vout: 0, satoshis: 400000n };
  await provider.addUtxo(p2pkh.address, f);
  return (await StatefulContract.deploy(compileString(src, { forceStateful: true }), [], {
    provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    initialState: init, changeAddress: p2pkh.address,
  })).contract;
}
async function fund(c: any): Promise<void> {
  await provider.addUtxo(c.address, { txid: uid(), vout: 0, satoshis: 100000n });
}

describe('internal fn-ptr state variable behavior', () => {
  it('calling an uninitialized void internal fn-ptr state var reverts', async () => {
    const c = await dep('contract Test { function() internal x; function f() public returns (int) { x(); return 2; } }', {});
    await fund(c); await expect(c.f().send()).rejects.toThrow();
  });

  it('calling an uninitialized int-typed internal fn-ptr state var reverts', async () => {
    const c = await dep('contract Test { function(int) internal returns(int) x; function f() public returns (int) { return x(5); } }', {});
    await fund(c); await expect(c.f().send()).rejects.toThrow();
  });

  it('a set internal fn-ptr state var persists and dispatches to the stored function', async () => {
    const c = await dep(`contract Test { function(int) internal returns(int) x; int public r;
      function a(int v) public returns (int) { return v + 1; }
      function set() public { x = a; require(true); }
      function run() public { this.r = x(7); } }`, { x: new Uint8Array(), __fnsel_x: new Uint8Array(4), r: 0n });
    await fund(c); await c.set().send();
    await fund(c); await c.run().send();
    expect(Number((await c.getState()).r)).toBe(8);
  });
});
