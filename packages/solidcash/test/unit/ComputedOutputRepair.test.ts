import { describe, expect, it } from 'vitest';
import { isRepairableNftOutput } from '../../src/stateful/computed-output-repair.js';

describe('isRepairableNftOutput', () => {
  it('accepts mutable and event (none) commitments up to the provider ceiling', () => {
    expect(isRepairableNftOutput('mutable', 128, 128)).toBe(true);
    expect(isRepairableNftOutput('none', 188, 1_000_000)).toBe(true);
    expect(isRepairableNftOutput('none', 188, 128)).toBe(false);
  });

  it('rejects minting outputs and undersized commitments', () => {
    expect(isRepairableNftOutput('minting', 64, 128)).toBe(false);
    expect(isRepairableNftOutput('mutable', 2, 128)).toBe(false);
    expect(isRepairableNftOutput(undefined, 64, 128)).toBe(false);
  });
});
