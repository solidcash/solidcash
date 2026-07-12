import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Behavioral coverage for a scalar state variable written under assorted control flow: switch case, early
// return with divergent per-path writes, loop accumulation, conditional delete, nested-if, and two vars
// each conditionally written. Sound vein (no bug found); pins the pending-state-write machinery that #19
// and the conditional-rewrite fixes touched. Invisible to the compile-only bench.
async function dep(src: string): Promise<any> {
  return getContractFactory(compileString(src, { forceStateful: true }), await fundedSigner()).deploy();
}

describe('scalar state write combined with control flow', () => {
  it('A: switch-case state write (matched writes, unmatched keeps prior)', async () => {
    const sc = await dep(`contract C { int public count;
      function set(int n) public returns (int) { count = 9; switch (n) { case 1: count = 1; case 2: count = 2; } return count; } }`);
    await sc.set(1n); expect((await sc.getState()).count).toBe(1n);
    await sc.set(2n); expect((await sc.getState()).count).toBe(2n);
    await sc.set(7n); expect((await sc.getState()).count).toBe(9n);
  });

  it('B: early return with divergent state writes per path', async () => {
    const sc = await dep(`contract C { int public count;
      function set(int n) public returns (int) { if (n == 1) { count = 11; return count; } count = 22; return count; } }`);
    await sc.set(1n); expect((await sc.getState()).count).toBe(11n);
    await sc.set(0n); expect((await sc.getState()).count).toBe(22n);
  });

  it('C: scalar accumulation in a loop', async () => {
    const sc = await dep(`contract C { int public count;
      function acc(int n) public returns (int) { count = 0; for (int i = 0; i < n; i++) { count = count + i; } return count; } }`);
    await sc.acc(4n); expect((await sc.getState()).count).toBe(6n);  // 0+1+2+3
  });

  it('D: conditional delete (reset to default on one branch)', async () => {
    const sc = await dep(`contract C { int public count;
      function upd(bool c) public returns (int) { count = 8; if (c) { delete count; } return count; } }`);
    await sc.upd(false); expect((await sc.getState()).count).toBe(8n);
    await sc.upd(true); expect((await sc.getState()).count).toBe(0n);
  });

  it('E: nested-if state write (only innermost condition writes)', async () => {
    const sc = await dep(`contract C { int public count;
      function upd(bool a, bool b) public returns (int) { count = 3; if (a) { if (b) { count = 100; } } return count; } }`);
    await sc.upd(false, false); expect((await sc.getState()).count).toBe(3n);
    await sc.upd(true, false); expect((await sc.getState()).count).toBe(3n);
    await sc.upd(true, true); expect((await sc.getState()).count).toBe(100n);
  });

  it('F: two vars, each conditionally written', async () => {
    const sc = await dep(`contract C { int public a; int public b;
      function upd(bool c) public returns (int) { a = 1; b = 2; if (c) { a = 10; } else { b = 20; } return a; } }`);
    await sc.upd(true); { const s = await sc.getState(); expect(s.a).toBe(10n); expect(s.b).toBe(2n); }
    await sc.upd(false); { const s = await sc.getState(); expect(s.a).toBe(1n); expect(s.b).toBe(20n); }
  });
});
