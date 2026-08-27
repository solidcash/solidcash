import { describe, expect, it } from 'vitest';
import { uniqueParticipantIndexForTarget } from '../../src/stateful/StatefulContract.js';

describe('low-level participant target identity', () => {
  it('selects the unique participant whose physical or logical address matches the compiler-resolved target', () => {
    expect(uniqueParticipantIndexForTarget('aa20cafe87', [
      { index: 4, lockingBytecodeHexes: ['aa20dead87', '76a914beef88ac'] },
      { index: 7, lockingBytecodeHexes: ['aa20cafe87', '76a914f00d88ac'] },
    ])).toBe(7);
  });

  it('fails closed for an absent or ambiguous address identity', () => {
    const candidates = [
      { index: 1, lockingBytecodeHexes: ['aa20cafe87'] },
      { index: 2, lockingBytecodeHexes: ['AA20CAFE87'] },
    ];
    expect(uniqueParticipantIndexForTarget(undefined, candidates)).toBeUndefined();
    expect(uniqueParticipantIndexForTarget('aa20cafe87', candidates)).toBeUndefined();
    expect(uniqueParticipantIndexForTarget('aa20none87', candidates)).toBeUndefined();
  });
});
