import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';

// SOUNDNESS + CLARITY: the C2 diff-key insert-in-loop range-splice covenant pins each new node's value to
// 0x01/empty (loop-invariant bool), because it walks the SORTED output chain and cannot map a chain position back
// to a source value without a permutation/value witness. A NON-BOOL per-key insert/RMW loop `for(i) w[ks[i]] =
// vs[i]` therefore is NOT supported - and must fail CLOSED at COMPILE (a clean SortedMappingCodegenPendingError
// pointing at the opt-out), NOT compile-OK then revert at runtime (which reads like a silent success until it
// aborts). The bool case (whitelistWorkers `w[k[i]] = true`) still compiles via the range-splice (SortedInsertLoop).
describe('C2 NON-BOOL insert-in-loop fails closed at COMPILE (not compile-then-revert)', () => {
  const nonBool = `contract C() {
    mapping(int => int) w;
    function setmany(int[] ks, int[] vs) { for (int i = 0; i < ks.length; i++) { w[ks[i]] = vs[i]; } }
  }`;
  const rmw = `contract C() {
    mapping(int => int) w;
    function addmany(int[] ks, int[] vs) { for (int i = 0; i < ks.length; i++) { w[ks[i]] += vs[i]; } }
  }`;
  const boolSet = `contract C() {
    mapping(int => bool) w;
    function whitelist(int[] ks) { for (int i = 0; i < ks.length; i++) { w[ks[i]] = true; } }
  }`;

  it('per-key value insert loop (w[ks[i]] = vs[i]) fails closed at compile', () => {
    expect(() => compileString(nonBool, { sortedMappings: ['w'] })).toThrow(/SortedMappingCodegenPending|sorted/i);
  });
  it('diff-key RMW loop (w[ks[i]] += vs[i]) fails closed at compile', () => {
    expect(() => compileString(rmw, { sortedMappings: ['w'] })).toThrow(/SortedMappingCodegenPending|sorted/i);
  });
  it('the bool set loop (w[ks[i]] = true) still compiles (range-splice supported)', () => {
    expect(() => compileString(boolSet, { sortedMappings: ['w'] })).not.toThrow();
  });
});
