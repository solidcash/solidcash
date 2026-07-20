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

  it('a SINGLE-ENTRY array-fill loop now COMPILES (runtime cache-in-loop, not fail-closed)', () => {
    // for(..) m[k][j]=v and read-after-write are cached to a local array + one upsert (CacheMappingEntryInLoop);
    // fixed OR dynamic bound, no unrolling. Covered at runtime by SortedArrayCacheInLoop.
    expect(() => compileString(K('for (int j = 0; j < i; j++) { m[k][j] = v; }'))).not.toThrow();
    expect(() => compileString(K('for (int j = 0; j < 3; j++) { m[k].push(v); }'))).not.toThrow();
    expect(() => compileString(K('for (int j = 1; j < 3; j++) { m[k][j] = m[k][j - 1] + 1; }'))).not.toThrow();
  });

  it('a DIFFERENT-key insert loop `for(i) m[ks[i]]=v` fails closed (per-iteration sorted insert not implemented)', () => {
    expect(() => compileString(
      `contract C() { mapping(int => int[]) m;
        function f(int[] ks, int v, pubkey pk, sig s) { require(checkSig(s, pk)); for (int j = 0; j < 3; j++) { m[ks[j]].push(v); } } }`,
    )).toThrow();
  });

  it('multi-dimensional array element write `m[k][i][j]` now COMPILES (whole-value RMW desugar)', () => {
    // `m[k][i][j]` on mapping(K => T[][]): DesugarNestedArrayWrite lowers it to `T[][] t=m[k]; t[i][j]=v; m[k]=t`.
    // VM roundtrip in MappingArray2dWrite. (Was a fail-closed boundary.)
    expect(() => compileString(
      `contract C() { mapping(int => int[][]) m;
        function f(int k, int i, int v, pubkey pk, sig s) { require(checkSig(s, pk)); m[k][i][0] = v; } }`,
    )).not.toThrow();
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
