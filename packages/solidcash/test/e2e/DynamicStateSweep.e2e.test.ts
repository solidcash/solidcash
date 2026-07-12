import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Behavioral sweep of CONDITIONAL / control-flow patterns on DYNAMIC state (arrays), using the full
// StatefulContract.deploy + initialState harness (the minimal getContractFactory().deploy() can't init a
// dynamic array's chunk/data-NFT structure). These are the array analogues of the scalar conditional-re-write
// and control-flow bugs the sweep already found+fixed - checking the same not-taken-path family holds for arrays.

const provider = createTestProvider();
const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
let nonce = 0x1000;
const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(4, '0').repeat(16); };

async function deploySweep(src: string, initialState: Record<string, unknown>): Promise<any> {
  const art = compileString(src);
  const funding = { txid: uid(), vout: 0, satoshis: 400000n };
  await provider.addUtxo(p2pkh.address, funding);
  const deployed = await StatefulContract.deploy(art, [], {
    provider, fundingUtxo: funding,
    funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    initialState, changeAddress: p2pkh.address,
  });
  return deployed.contract;
}

async function fund(c: any): Promise<void> {
  await provider.addUtxo(c.address, { txid: uid(), vout: 0, satoshis: 100000n });
}

describe('dynamic-state conditional/control-flow behavioral sweep (arrays)', () => {
  it('conditional array-element re-write: arr[0]=1; if(c){arr[0]=5}', async () => {
    const c = await deploySweep(`contract C {
      int[] arr;
      function run(bool cond) public { while (arr.length < 2) arr.push(); arr[0] = 1; if (cond) { arr[0] = 5; } require(true); }
    }`, { arr: [] });
    await fund(c); await c.run(false).send();
    expect(Number((await c.getState()).arr[0])).toBe(1);
    await fund(c); await c.run(true).send();
    expect(Number((await c.getState()).arr[0])).toBe(5);
  });

  it('conditional array push: if(c){arr.push(9)}', async () => {
    const c = await deploySweep(`contract C {
      int[] arr;
      function run(bool cond) public { if (cond) { arr.push(9); } require(true); }
    }`, { arr: [] });
    await fund(c); await c.run(false).send();
    expect((await c.getState()).arr.length).toBe(0);
    await fund(c); await c.run(true).send();
    const st = await c.getState();
    expect(st.arr.length).toBe(1); expect(Number(st.arr[0])).toBe(9);
  });

  // NOTE: a value-RETURNING function that writes a dynamic array (`function f() returns(int){ arr.push(x); ... }`)
  // is a separate, pre-existing bug (the trailing chunk output index blockSize+i counts the returnEvent slot,
  // which a plain .send() does not materialize -> "invalid output index"). Same family as commit 5a691a9a.
  // Tracked in correctness_sweep memory; the VOID array-write forms below are sound.

  it('array push inside a loop, conditional count', async () => {
    const c = await deploySweep(`contract C {
      int[] arr;
      function run(bool cond) public { for (int i = 0; i < 3; i++) { if (cond) { arr.push(i); } } require(true); }
    }`, { arr: [] });
    await fund(c); await c.run(false).send();
    expect((await c.getState()).arr.length).toBe(0);
    await fund(c); await c.run(true).send();
    expect((await c.getState()).arr.length).toBe(3);
  });
});
