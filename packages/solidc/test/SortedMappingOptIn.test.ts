import { describe, it, expect } from 'vitest';
import { compileString, SortedMappingCodegenPendingError } from '../src/index.js';

// The C2 sorted-linked-list mapping opt-in (CompilerOptions.sortedMappings). The covenant + SDK (SortedList) are
// proven and shipped; the source-level codegen is pending, so the compiler marks the collection sorted (metadata
// for the SDK) but FAILS CLOSED on a source-level access - it never silently compiles to the omittable entry
// model, which would reintroduce C2. See docs/sorted-mapping-c2.md.
describe('sorted mapping opt-in (C2)', () => {
  const SET = 'contract C() { mapping(int => bool) claimed;';

  it('marks the named mapping sorted in the artifact metadata', () => {
    const art = compileString(`${SET} function f() { require(true); } }`, { sortedMappings: ['claimed'], forceStateful: true });
    const col = art.stateLayout?.collections?.find((c) => c.name === 'claimed');
    expect(col?.sorted).toBe(true);
    expect(art.stateLayout?.mappings?.find((c) => c.name === 'claimed')?.sorted).toBe(true);
  });

  it('only marks the mappings named in sortedMappings', () => {
    const art = compileString(
      'contract C() { mapping(int => bool) a; mapping(int => bool) b; function f() { require(true); } }',
      { sortedMappings: ['a'], forceStateful: true },
    );
    expect(art.stateLayout?.collections?.find((c) => c.name === 'a')?.sorted).toBe(true);
    expect(art.stateLayout?.collections?.find((c) => c.name === 'b')?.sorted).toBeUndefined();
  });

  it('compiles a source-level read of a sorted mapping (emits the C2 read covenant)', () => {
    // The read codegen is implemented + VM-verified (SortedMappingCompiledRead.test.ts); it emits the proven
    // membership/bracket covenant instead of the omittable entry-model read.
    expect(() => compileString(`${SET} function f(int k) { require(!claimed[k]); } }`, { sortedMappings: ['claimed'], forceStateful: true }))
      .not.toThrow();
  });

  it('compiles a source-level WRITE of a sorted set (emits the C2 insert covenant)', () => {
    // The write codegen is implemented + VM-verified (SortedMappingCompiledWrite.test.ts); `claimed[k]=true`
    // emits the proven sorted-list insert (bracket + splice), not the omittable entry-model write.
    expect(() => compileString(`${SET} function f(int k) { claimed[k] = true; } }`, { sortedMappings: ['claimed'], forceStateful: true }))
      .not.toThrow();
  });

  it('still fails closed on a sorted mapping with a value type (only set writes are implemented)', () => {
    const MAP = 'contract C() { mapping(int => int) bal;';
    expect(() => compileString(`${MAP} function f(int k) { bal[k] = 5; } }`, { sortedMappings: ['bal'], forceStateful: true }))
      .toThrow(SortedMappingCodegenPendingError);
  });

  it('without the opt-in, the same mapping compiles on the default entry model', () => {
    expect(() => compileString(`${SET} function f(int k) { claimed[k] = true; } }`, { forceStateful: true })).not.toThrow();
  });
});
