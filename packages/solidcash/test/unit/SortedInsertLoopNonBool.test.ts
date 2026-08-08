import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';

// SOUNDNESS + CLARITY: the C2 diff-key insert-in-loop RANGE-SPLICE covenant pins each new node's value to
// 0x01/empty (loop-invariant bool), because it walks the SORTED output chain and cannot map a chain position back
// to a source value without a permutation/value witness. Per-key VALUE loops are instead handled by the per-
// iteration UPSERT loop (1:1 co-spend/mint in SOURCE order = no permutation): `w[ks[i]] = vs[i]` (absolute 'set'),
// `w[ks[i]] += vs[i]` (RMW credit), and the loop-invariant `w[ks[i]] = v` (SortedInsertLoopValue) all compile and
// are VM-proven (SortedUpsertLoop). What still fails CLOSED at COMPILE (a clean SortedMappingCodegenPendingError,
// NOT compile-then-revert): delete-in-loop and `= <default>` nullify-in-loop.
describe('C2 per-key value + delete loops compile; only =default nullify fails closed at COMPILE', () => {
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

  it('per-key value assign loop (w[ks[i]] = vs[i]) COMPILES via the per-iteration UPSERT loop (op=set)', () => {
    // Absolute per-key set: each iteration co-spends k[i]'s entry (update) or predecessor (insert) + mints v[i].
    const art = compileString(nonBool, {});
    const info = art.abi.find((f) => f.name === 'setmany')?.sortedUpsertLoopInfo?.[0];
    expect(info?.valueArrayParam).toBe('vs');
    expect(info?.op).toBe('set');
  });
  it('diff-key RMW loop (w[ks[i]] += vs[i]) COMPILES via the per-iteration UPDATE loop (multitransfer credit)', () => {
    // Now supported: each iteration co-spends k[i]'s EXISTING entry + mints the updated value (SortedUpsertLoop).
    const art = compileString(rmw, {});
    expect(art.abi.find((f) => f.name === 'addmany')?.sortedUpsertLoopInfo?.[0]?.valueArrayParam).toBe('vs');
  });
  it('the bool set loop (w[ks[i]] = true) still compiles (range-splice supported)', () => {
    expect(() => compileString(boolSet, {})).not.toThrow();
  });

  // A per-iteration C2 `delete m[k[i]]` COMPILES via the upsert loop (op=delete): each iteration co-spends k[i]'s
  // existing entry + mints it nullified to the default; absent keys fail closed. `= 0` (an IntLiteral) also compiles
  // now, but as an op=set (valueConst): it INSERTS a 0-node on an absent key (set-to-0 = EnumerableMap.set(k,0)),
  // distinct from delete (which fails closed on absent). Both are sound; they differ only on the absent-key case.
  const delLoop = `contract C() {
    mapping(int => int) w;
    function clear(int[] ks) { for (int i = 0; i < ks.length; i++) { delete w[ks[i]]; } }
  }`;
  const nullifyLoop = `contract C() {
    mapping(int => int) w;
    function zero(int[] ks) { for (int i = 0; i < ks.length; i++) { w[ks[i]] = 0; } }
  }`;
  it('C2 delete-in-loop COMPILES via the upsert loop (op=delete)', () => {
    const art = compileString(delLoop, {});
    const info = art.abi.find((f) => f.name === 'clear')?.sortedUpsertLoopInfo?.[0];
    expect(info?.op).toBe('delete');
    expect(info?.valueArrayParam).toBeUndefined(); // delete has no value array
  });
  it('C2 =literal set-in-loop (w[ks[i]] = 0) COMPILES via the upsert loop (op=set, valueConst)', () => {
    const info = compileString(nullifyLoop, {}).abi
      .find((f) => f.name === 'zero')?.sortedUpsertLoopInfo?.[0];
    expect(info?.op).toBe('set');
    expect(info?.valueConst).toBe('0');
  });
});
