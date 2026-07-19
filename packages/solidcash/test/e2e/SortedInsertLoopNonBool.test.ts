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

  // A C2 `delete m[k]` in a DYNAMIC loop routed to a single fixed-slot upsert (emitSortedValueUpsert) with NO
  // plainLoopDepth guard - it would pin only one iteration's delete and leave the rest un-covenanted (a C2 hole).
  // Now fails closed like the assign case.
  const delLoop = `contract C() {
    mapping(int => int) w;
    function clear(int[] ks) { for (int i = 0; i < ks.length; i++) { delete w[ks[i]]; } }
  }`;
  const nullifyLoop = `contract C() {
    mapping(int => int) w;
    function zero(int[] ks) { for (int i = 0; i < ks.length; i++) { w[ks[i]] = 0; } }
  }`;
  it('C2 delete-in-loop fails closed at compile (was a single-slot upsert in a loop = unsound)', () => {
    expect(() => compileString(delLoop, { sortedMappings: ['w'] })).toThrow(/SortedMappingCodegenPending|sorted/i);
  });
  it('C2 =default nullify-in-loop fails closed at compile', () => {
    expect(() => compileString(nullifyLoop, { sortedMappings: ['w'] })).toThrow(/SortedMappingCodegenPending|sorted/i);
  });
});
