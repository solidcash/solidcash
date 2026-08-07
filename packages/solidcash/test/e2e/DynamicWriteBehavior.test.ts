// Dynamic-storage (chunked) write behavior pins: conditional writes, value-returning functions, early
// returns, control-flow combos, returning-call coexistence.
import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { hexToBin } from '@bitauth/libauth';

describe('conditional writes', () => {
  // Conditional / control-flow writes on DYNAMIC arrays (array analogue of the scalar not-taken-path
  // family); uses StatefulContract.deploy + initialState (chunk/data-NFT init).

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

    // (Value-returning + dynamic-write is pinned in 'value-returning function' below.)

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
});

describe('value-returning function', () => {
  // A dynamic write in a VALUE-RETURNING function: blockSize counts the returnEvent slot a plain send
  // does not materialize; covenant + SDK both subtract 1 when it is absent (chunk sat one output lower).
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
});

describe('early return', () => {
  // An early return skipped the loop-cache flush `arr = __dlcache_arr` (appended at fall-through only),
  // silently dropping the loop's writes; the flush now precedes every return.
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
});

describe('control-flow combos', () => {
  // The flush-before-every-return fix composes with continue, nested loops, multiple arrays, conditional
  // loops, and a return BEFORE the loop (must not invent data).
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
});

describe('returning call + chunk reads', () => {
  // A returning external call + >=2 chunk reads: getEntryOutputBase missed the chunk-before-callee
  // outputs, the derivation searched the wrong range, and the placeholder return event was rejected.
  const RH = `pragma solidcash >=0.8.0;
  contract RetHandler() { bigint counter;
    function inc(uint256 v) returns (uint256) { this.counter = this.counter + int(v); require(int(v) >= 0); return uint256(this.counter); } }`;

  describe('value-returning external call + multiple dynamic-array reads', () => {
    it('returns correctly while the caller reads two chunked arrays', async () => {
      const provider = createTestProvider();
      const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
      const ra = compileString(RH);
      const rh = new Contract(ra, [], { provider });
      const { categoryId: rc } = await setupStatefulUtxos(
        provider, rh, ra.stateLayout!, { counter: 40n }, { saltContract: true },
      );
      const rhSc = StatefulContract.withCategory(rh, rc);
      const rhAddr = rh.withCategory(hexToBin(rc)).lockingBytecode;

      const TA = `pragma solidcash >=0.8.0;
      interface IR { public bigint counter; function inc(uint256 v) returns (uint256); }
      contract T() { int[] a; int[] b; address target; bigint last;
        function seed(pubkey pk, sig s) { require(checkSig(s, pk)); this.a.push(7); this.b.push(9); }
        function fire(uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); int x = a[0]; int y = b[0]; this.last = int(IR(target).inc(v)) + x + y - x - y; } }`;
      const ta = compileString(TA);
      const t = new Contract(ta, [], { provider });
      const { categoryId: tc } = await setupStatefulUtxos(
        provider, t, ta.stateLayout!, { a: [], b: [], target: hexToBin(rhAddr), last: 0n }, { saltContract: true },
      );
      const tSc = StatefulContract.withCategory(t, tc);
      await tSc.seed(alicePub, sig()).send();

      await tSc.fire(2n, alicePub, sig()).withExternalCall(rhSc, 'inc', [2n]).send();
      expect((await tSc.getState()).last).toBe(42n);
      expect((await rhSc.getState()).counter).toBe(42n);
    });
  });
});
