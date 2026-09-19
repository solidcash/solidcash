import { describe, expect, it } from 'vitest';
import { resolveDynamicChunkInputBase } from '../../src/stateful/StatefulContract.js';

describe('dynamic chunk input base coordinates', () => {
  it('offsets participant-local indices after materialization', () => {
    expect(resolveDynamicChunkInputBase(3, 17)).toBe(20n);
    expect(resolveDynamicChunkInputBase(20, 0)).toBe(20n);
    expect(resolveDynamicChunkInputBase(-1, 17)).toBe(-1n);
  });

  it('rebases local slots when a published block slides past a dynamic band', () => {
    // Before slide: participant published at base 4; local chunk slot 1 → absolute 5.
    expect(resolveDynamicChunkInputBase(1, 4)).toBe(5n);
    // After a foreign block inserts 3 inputs ahead of the participant, the published base slides to 7.
    expect(resolveDynamicChunkInputBase(1, 7)).toBe(8n);
    // Inactive / unaddressable local indices stay negative sentinels under any published base.
    expect(resolveDynamicChunkInputBase(-1, 7)).toBe(-1n);
    expect(resolveDynamicChunkInputBase(-2, 0)).toBe(-1n);
  });
});
