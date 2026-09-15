import { describe, expect, it } from 'vitest';
import { resolveDynamicChunkInputBase } from '../../src/stateful/StatefulContract.js';

describe('dynamic chunk input base coordinates', () => {
  it('offsets participant-local indices but preserves materialized absolute indices', () => {
    expect(resolveDynamicChunkInputBase(3, 17, false)).toBe(20n);
    expect(resolveDynamicChunkInputBase(20, 17, true)).toBe(20n);
    expect(resolveDynamicChunkInputBase(-1, 17, false)).toBe(-1n);
    expect(resolveDynamicChunkInputBase(-1, 17, true)).toBe(-1n);
  });
});
