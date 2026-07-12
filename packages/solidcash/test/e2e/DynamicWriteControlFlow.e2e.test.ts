import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Behavioral coverage for a loop-written dynamic-storage array (cached to __dlcache_ then flushed once)
// combined with assorted control flow. Companion to DynamicWriteEarlyReturn: these pin that the
// flush-before-every-return fix (CacheDynamicArrayInLoop) composes with continue, nested loops, multiple
// arrays, a conditional loop, and a return placed BEFORE the loop runs (must NOT invent data). Invisible
// to the compile-only bench.
const provider = createTestProvider();
const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
let nonce = 0xE100;
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

describe('dynamic-storage loop write combined with control flow', () => {
  it('continue in a dyn-write loop with an early return persists the accumulated array', async () => {
    const src = `contract C { int[] arr;
      function run(int n) public { for (int i = 0; i < 5; i++) { if (i == 2) { continue; } arr.push(i); }
        if (n == 1) { return; } require(true); } }`;
    const c1 = await dep(src, { arr: [] });
    await fund(c1); await c1.run(1n).send();
    expect((await c1.getState()).arr.map(Number)).toEqual([0, 1, 3, 4]);
  });

  it('nested loops writing the array with an early return persist all elements', async () => {
    const src = `contract C { int[] arr;
      function run(int n) public { for (int i = 0; i < 2; i++) { for (int j = 0; j < 2; j++) { arr.push(i * 10 + j); } }
        if (n == 1) { return; } require(true); } }`;
    const c1 = await dep(src, { arr: [] });
    await fund(c1); await c1.run(1n).send();
    expect((await c1.getState()).arr.map(Number)).toEqual([0, 1, 10, 11]);
  });

  it('two different dynamic arrays each written in a loop persist across an early return', async () => {
    const src = `contract C { int[] a; int[] b;
      function run(int n) public { for (int i = 0; i < 3; i++) { a.push(i); } for (int j = 0; j < 2; j++) { b.push(j + 100); }
        if (n == 1) { return; } require(true); } }`;
    const c1 = await dep(src, { a: [], b: [] });
    await fund(c1); await c1.run(1n).send();
    const s = await c1.getState();
    expect(s.a.map(Number)).toEqual([0, 1, 2]);
    expect(s.b.map(Number)).toEqual([100, 101]);
  });

  it('a dyn-write loop inside an if-branch persists across a later early return', async () => {
    const src = `contract C { int[] arr;
      function run(int n) public { if (n > 0) { for (int i = 0; i < 3; i++) { arr.push(i); } }
        if (n == 1) { return; } require(true); } }`;
    const c1 = await dep(src, { arr: [] });
    await fund(c1); await c1.run(1n).send();
    expect((await c1.getState()).arr.map(Number)).toEqual([0, 1, 2]);
  });

  it('an early return BEFORE the loop leaves the array empty (no invented data)', async () => {
    const src = `contract C { int[] arr;
      function run(int n) public { if (n == 1) { return; } for (int i = 0; i < 3; i++) { arr.push(i); } require(true); } }`;
    const c1 = await dep(src, { arr: [] });
    await fund(c1); await c1.run(1n).send();
    expect((await c1.getState()).arr.map(Number)).toEqual([]);
    const c2 = await dep(src, { arr: [] });
    await fund(c2); await c2.run(0n).send();
    expect((await c2.getState()).arr.map(Number)).toEqual([0, 1, 2]);
  });
});
