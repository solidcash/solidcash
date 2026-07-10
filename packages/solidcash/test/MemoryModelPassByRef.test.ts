import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../src/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

// Memory model P4: internal pass-by-reference. A memory array passed to an internal VOID helper is mutated IN
// PLACE (Solidity semantics): the helper is inlined as `{ T[] memory __inl_x = a; <body> }`, so the param aliases
// the caller's array via the shared buffer and the helper's writes are visible in the caller. Under the old
// value-copy model the caller would NOT see the helper's writes (pass-by-value), so each require below is a
// pass-by-ref proof.

async function run(src: string): Promise<void> {
  const provider = createTestProvider();
  const artifact = compileString(src);
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  const sc = StatefulContract.withCategory(contract, categoryId);
  await sc.f().send();
}

const BASIC = `contract C() {
  int counter;
  function g(uint[] memory x) internal { x[0] = 42; }
  function f() {
    uint[] memory a = new uint[](2);
    a[0] = 1; a[1] = 2;
    g(a);
    require(a[0] == 42); require(a[1] == 2);
    require(true);
  }
}`;

describe('memory model P4: internal pass-by-reference', () => {
  it('helper mutates the caller array element in place', async () => {
    await run(BASIC);
  });

  it('helper writes value-params through the reference', async () => {
    await run(`contract C() {
      int counter;
      function set(uint[] memory x, uint i, uint v) internal { x[i] = v; }
      function f() {
        uint[] memory a = new uint[](3);
        set(a, 1, 99); set(a, 2, 7);
        require(a[1] == 99); require(a[2] == 7); require(a[0] == 0);
        require(true);
      }
    }`);
  });

  it('helper fills the array in a loop (local renamed, control flow inlined)', async () => {
    await run(`contract C() {
      int counter;
      function fill(uint[] memory x) internal {
        uint i = 0;
        while (i < x.length) { x[i] = i + 10; i = i + 1; }
      }
      function f() {
        uint[] memory a = new uint[](3);
        fill(a);
        require(a[0] == 10); require(a[1] == 11); require(a[2] == 12);
        require(true);
      }
    }`);
  });

  it('multiple call sites get independent fresh names', async () => {
    await run(`contract C() {
      int counter;
      function bump(uint[] memory x, uint i) internal { uint t = x[i]; x[i] = t + 1; }
      function f() {
        uint[] memory a = new uint[](2);
        a[0] = 5;
        bump(a, 0); bump(a, 0); bump(a, 0);
        require(a[0] == 8);
        require(true);
      }
    }`);
  });

  it('mutation persists through a subsequent alias (composition with P1/P2 aliasing)', async () => {
    await run(`contract C() {
      int counter;
      function g(uint[] memory x) internal { x[0] = 100; }
      function f() {
        uint[] memory a = new uint[](2);
        a[0] = 1;
        uint[] memory b = a;
        g(b);
        require(a[0] == 100);
        require(true);
      }
    }`);
  });

  it('struct param mutated by reference (s.f written in helper is visible in caller)', async () => {
    await run(`contract C() {
      int counter;
      struct P { uint a; uint b; }
      function g(P memory s) internal { s.a = 42; }
      function f() {
        P memory a = P(1, 2);
        g(a);
        require(a.a == 42); require(a.b == 2);
        require(true);
      }
    }`);
  });

  it('delegation chain f->h->g mutates through two levels (multi-level inline)', async () => {
    await run(`contract C() {
      int counter;
      function g(uint[] memory x) internal { x[0] = 42; }
      function h(uint[] memory a) internal { g(a); require(a[0] == 42); }
      function f() {
        uint[] memory a = new uint[](2);
        a[0] = 1;
        h(a);
        require(a[0] == 42);
        require(true);
      }
    }`);
  });

  it('delegation chain f->h->g->k mutates through three levels', async () => {
    await run(`contract C() {
      int counter;
      function k(uint[] memory z) internal { z[0] = 9; }
      function g(uint[] memory y) internal { k(y); y[1] = 8; }
      function h(uint[] memory a) internal { g(a); }
      function f() {
        uint[] memory a = new uint[](2);
        h(a);
        require(a[0] == 9); require(a[1] == 8);
        require(true);
      }
    }`);
  });

  it('value-returning helper: mutates the param AND returns a value (uint n = g(a))', async () => {
    await run(`contract C() {
      int counter;
      function g(uint[] memory x) internal returns (uint) { x[0] = 42; return 7; }
      function f() {
        uint[] memory a = new uint[](2);
        a[0] = 1;
        uint n = g(a);
        require(a[0] == 42);
        require(n == 7);
        require(true);
      }
    }`);
  });

  it('value-returning helper whose return reads the param (with a value param)', async () => {
    await run(`contract C() {
      int counter;
      function sum2(uint[] memory x, uint v) internal returns (uint) { x[0] = v; return x[0] + x[1]; }
      function f() {
        uint[] memory a = new uint[](2);
        a[1] = 3;
        uint n = sum2(a, 10);
        require(a[0] == 10);
        require(n == 13);
        require(true);
      }
    }`);
  });

  // Materializes a caller PARAM array into the buffer so a helper mutates it by reference (c). `f` takes a real
  // `uint[] memory` argument (passed from the SDK); it is deserialized into a buffer array at entry, and `g(a)`
  // inlines against that buffer. Without materialization `a` would be a value-copy and require(a[0]==42) would fail.
  it('materializes a caller-param array for pass-by-reference (c)', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract C() {
      int counter;
      function g(uint[] memory x) internal { x[0] = 42; }
      function f(uint[] memory a) { g(a); require(a[0] == 42); require(a[1] == 5); require(true); }
    }`, {});
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.f([1n, 5n]).send()).resolves.toBeDefined();
  });
});
