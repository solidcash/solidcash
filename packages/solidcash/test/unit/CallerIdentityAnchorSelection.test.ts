import { describe, expect, it } from 'vitest';
import { callerIdentityAnchorBand } from '../../src/stateful/StatefulContract.js';

describe('nested caller identity anchor selection', () => {
  const physical = 'aa20' + '11'.repeat(32) + '87';
  const logical = 'aa20' + '22'.repeat(32) + '87';

  it('keeps a physical owner direct when a same-category SCID is co-spent', () => {
    expect(callerIdentityAnchorBand(physical, physical, [
      { band: 0, lockingBytecode: logical },
    ])).toBeUndefined();
  });

  it('selects the exact logical caller rather than an anchor by category', () => {
    expect(callerIdentityAnchorBand(logical, physical, [
      { band: 4, lockingBytecode: 'aa20' + '33'.repeat(32) + '87' },
      { band: 7, lockingBytecode: logical },
    ])).toBe(7);
  });

  it('fails closed when a non-physical caller has no unique exact anchor', () => {
    expect(() => callerIdentityAnchorBand(logical, physical, [])).toThrow(/found 0/);
    expect(() => callerIdentityAnchorBand(logical, physical, [
      { band: 1, lockingBytecode: logical },
      { band: 2, lockingBytecode: logical },
    ])).toThrow(/found 2/);
  });
});
