import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Regression: a dynamic-storage (chunk-backed) array written inside a LOOP is cached into a local
// __dlcache_arr, flushed back to state once. The flush was appended at the fall-through END only, so an
// EARLY return before it silently skipped the write (arr never persisted -> arr$len computed 0). Fixed in
// CacheDynamicArrayInLoop: the flush is now inserted before EVERY return and at the fall-through end, so
// each exit path persists the accumulated value. The bug is invisible to the compile-only bench.
const provider = createTestProvider();
const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
let nonce = 0xD100;
const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
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

describe('dynamic-storage array write in a loop with an early return', () => {
  const SRC = `contract C { int[] arr;
    function run(int n) public { for (int i = 0; i < 3; i++) { arr.push(i); } if (n == 1) { return; } require(true); } }`;

  it('early return TAKEN still persists the loop-accumulated array', async () => {
    const c = await dep(SRC, { arr: [] });
    await fund(c); await c.run(1n).send();
    const s = await c.getState();
    expect(s.arr.map(Number)).toEqual([0, 1, 2]);
  });

  it('early return NOT taken persists the loop-accumulated array', async () => {
    const c = await dep(SRC, { arr: [] });
    await fund(c); await c.run(9n).send();
    const s = await c.getState();
    expect(s.arr.map(Number)).toEqual([0, 1, 2]);
  });

  it('value-returning: early return in the middle persists the array before returning', async () => {
    const src = `contract C { int[] arr;
      function run(int n) public returns (int) { for (int i = 0; i < 4; i++) { arr.push(i * 2); }
        if (n == 1) { return 111; } return 222; } }`;
    const c1 = await dep(src, { arr: [] });
    await fund(c1); await c1.run(1n).send();
    expect((await c1.getState()).arr.map(Number)).toEqual([0, 2, 4, 6]);
    const c2 = await dep(src, { arr: [] });
    await fund(c2); await c2.run(0n).send();
    expect((await c2.getState()).arr.map(Number)).toEqual([0, 2, 4, 6]);
  });

  it('early return inside a switch case persists the loop-accumulated array', async () => {
    const src = `contract C { int[] arr;
      function run(int n) public { for (int i = 0; i < 3; i++) { arr.push(i); }
        switch (n) { case 1: return; default: require(true); } } }`;
    const c1 = await dep(src, { arr: [] });
    await fund(c1); await c1.run(1n).send();
    expect((await c1.getState()).arr.map(Number)).toEqual([0, 1, 2]);
    const c2 = await dep(src, { arr: [] });
    await fund(c2); await c2.run(7n).send();
    expect((await c2.getState()).arr.map(Number)).toEqual([0, 1, 2]);
  });

  it('two loops with an early return between them persist the correct prefix / full value', async () => {
    const src = `contract C { int[] arr;
      function run(int n) public { for (int i = 0; i < 2; i++) { arr.push(i); }
        if (n == 1) { return; } for (int j = 0; j < 2; j++) { arr.push(9); } require(true); } }`;
    // n==1: returns after the first loop -> only [0,1]
    const c1 = await dep(src, { arr: [] });
    await fund(c1); await c1.run(1n).send();
    expect((await c1.getState()).arr.map(Number)).toEqual([0, 1]);
    // n==0: both loops run -> [0,1,9,9]
    const c2 = await dep(src, { arr: [] });
    await fund(c2); await c2.run(0n).send();
    expect((await c2.getState()).arr.map(Number)).toEqual([0, 1, 9, 9]);
  });
});
