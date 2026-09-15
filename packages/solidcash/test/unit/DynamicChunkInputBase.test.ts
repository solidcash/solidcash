import { describe, expect, it } from 'vitest';
import { resolveDynamicChunkInputBase } from '../../src/stateful/StatefulContract.js';

describe('dynamic chunk input base coordinates', () => {
  it('offsets participant-local indices after materialization', () => {
    expect(resolveDynamicChunkInputBase(3, 17)).toBe(20n);
    expect(resolveDynamicChunkInputBase(20, 0)).toBe(20n);
    expect(resolveDynamicChunkInputBase(-1, 17)).toBe(-1n);
  });
});
