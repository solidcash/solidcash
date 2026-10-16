import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

/**
 * ReuseEntryLocalForWriteback reuses the entry-read local for a whole-struct write-back, pre-empting the fresh
 * snapshot CoalesceMappingEntryFieldWrites would otherwise take. The exact Unicrow `refund` source is not in the
 * repo, so the shape is reconstructed synthetically: `S e = m[k]; e.a = ..; m[k].a = e.a; m[k].b = ..;`.
 * Sorted (vmap) mappings are the backend both passes target.
 */

const OPT = { evmCompat: true, sortedMappings: ['m'], forceStateful: true };
const PREFIX = 'contract C { struct S { uint x; uint y; uint z; } mapping(uint => S) m;';

describe('ReuseEntryLocalForWriteback', () => {
  it('is byte-identical to the explicit whole-struct write-back (sound by reduction)', () => {
    const sugar = PREFIX + ' function f(uint k, uint a, uint b) {'
      + ' S e = m[k]; e.x = a; m[k].x = e.x; m[k].y = b; require(true); } }';
    const hand = PREFIX + ' function f(uint k, uint a, uint b) {'
      + ' S e = m[k]; e.x = a; m[k] = S(e.x, b, e.z); require(true); } }';
    expect(compileString(sugar, OPT).bytecode).toBe(compileString(hand, OPT).bytecode);
  });

  it('keeps a whole reassignment of the local fail-closed', () => {
    // `e = m[1]` invalidates the snapshot the write-back would source untouched fields from; the pass must keep
    // the original statements rather than fold them unsoundly.
    const source = PREFIX + ' function f(uint k, uint a, uint b) {'
      + ' S e = m[k]; e = m[1]; m[k].x = a; m[k].y = b; require(true); } }';
    expect(compileString(source, OPT).contractName).toBe('C');
  });

  it('keeps a control-flow boundary fail-closed', () => {
    const source = PREFIX + ' function f(uint k, uint a, uint b) {'
      + ' S e = m[k]; if (a > 0) { e.x = 1; } m[k].x = e.x; m[k].y = b; require(true); } }';
    expect(compileString(source, OPT).contractName).toBe('C');
  });
});
