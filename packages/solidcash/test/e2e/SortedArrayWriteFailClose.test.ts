import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';

// C2 (sorted) array WRITE shapes that are not yet implemented must fail CLOSED at compile - never crash with an
// internal error, and never silently degrade to the omittable default-on-absent entry model. The supported shapes
// (single element write, push/pop, whole assign, conditional, nested mapping+array) are covered elsewhere
// (SortedMappingArrayElementWrite). This locks the fail-close boundary.
describe('sorted C2 array writes: fail-close boundary', () => {
  const K = (body: string, val = 'int=>int[]'): string =>
    `contract C() { mapping(${val}) m;
      function f(int k, int i, int v, pubkey pk, sig s) { require(checkSig(s, pk)); ${body} } }`;

  it('array element write inside a DYNAMIC loop fails closed (per-iteration sorted insert not implemented)', () => {
    expect(() => compileString(K('for (int j = 0; j < i; j++) { m[k][j] = v; }'))).toThrow();
  });

  it('array element write inside a FIXED-bound loop fails closed (same-entry write coalescing not implemented)', () => {
    // Unrolling would produce consecutive writes to the SAME entry, which do not chain (each is a fresh co-spend);
    // so it stays a loop and fails closed rather than compiling to a runtime-reverting tx.
    expect(() => compileString(K('for (int j = 0; j < 3; j++) { m[k][j] = v; }'))).toThrow();
  });

  it('multi-dimensional array element write fails closed (was an internal TypeError crash)', () => {
    // `m[k][i][j]` on mapping(K => T[][]): the excess index used to be type-checked as a phantom mapping key and
    // crashed with "type 'undefined' was expected"; now a clean UnsupportedTypeError.
    expect(() => compileString(
      `contract C() { mapping(int => int[][]) m;
        function f(int k, int i, int v, pubkey pk, sig s) { require(checkSig(s, pk)); m[k][i][0] = v; } }`,
    )).toThrow();
  });

  it('the supported single-write shapes still compile (no over-broad fail-close)', () => {
    expect(() => compileString(K('m[k][i] = v;'))).not.toThrow(); // element write
    expect(() => compileString(K('m[k].push(v);'))).not.toThrow(); // push
    expect(() => compileString(K('if (v > 0) { m[k][i] = v; }'))).not.toThrow(); // conditional element write
    // nested mapping whose value is an array: m[a][b][i] = v (keys a,b == 2 keys, [i] == the array index)
    expect(() => compileString(
      `contract C() { mapping(int => mapping(int => int[])) m;
        function f(int a, int b, int i, int v, pubkey pk, sig s) { require(checkSig(s, pk)); m[a][b][i] = v; } }`,
    )).not.toThrow();
  });
});
