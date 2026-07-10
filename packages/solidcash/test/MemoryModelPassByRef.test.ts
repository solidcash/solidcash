import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../src/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

// EXPERIMENTAL memory model P4: internal pass-by-reference. A memory array passed to an internal VOID helper is
// mutated IN PLACE (Solidity semantics): the helper is inlined as `{ T[] memory __inl_x = a; <body> }`, so the
// param aliases the caller's array via the shared buffer and the helper's writes are visible in the caller. Under
// value-copy the caller would NOT see the helper's writes (pass-by-value), so each require below is a pass-by-ref
// proof - and the flag-off case shows the same contract is REJECTED (the divergence P4 closes).

async function run(src: string, flag = true): Promise<void> {
  const provider = createTestProvider();
  const artifact = compileString(src, { experimentalMemoryModel: flag });
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

  it('value-copy (flag off) does NOT pass by reference - the divergence P4 closes', async () => {
    await expect(run(BASIC, false)).rejects.toThrow();
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
});
