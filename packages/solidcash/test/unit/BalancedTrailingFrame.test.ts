import { describe, expect, it } from 'vitest';
import {
  physicalBalancedTrailingOutputCount,
  shouldAppendUnsegmentedLoopEntries,
  shouldReassertLegacyDelegateLoopEntries,
} from '../../src/stateful/StatefulTransactionBuilder.js';

describe('balanced trailing-frame accounting', () => {
  it('uses the physical cursor when one semantic plan emits extra settlement outputs', () => {
    expect(physicalBalancedTrailingOutputCount(59, 117, 64)).toBe(6);
  });

  it('does not count fixed-prefix outputs as trailing resources', () => {
    expect(physicalBalancedTrailingOutputCount(53, 117, 64)).toBe(0);
    expect(physicalBalancedTrailingOutputCount(40, 117, 64)).toBe(0);
  });

  it('rejects invalid frame geometry', () => {
    expect(() => physicalBalancedTrailingOutputCount(1, 5, 6)).toThrow(
      'Invalid balanced trailing-frame geometry',
    );
  });

  it('does not replay legacy loop entries over a compiler-owned route frame', () => {
    expect(shouldReassertLegacyDelegateLoopEntries(true)).toBe(false);
    expect(shouldReassertLegacyDelegateLoopEntries(false)).toBe(true);
  });

  it('does not replay segmented loop entries through the unsegmented fallback', () => {
    expect(shouldAppendUnsegmentedLoopEntries(1, false, false)).toBe(false);
    expect(shouldAppendUnsegmentedLoopEntries(0, false, false)).toBe(true);
    expect(shouldAppendUnsegmentedLoopEntries(0, true, false)).toBe(false);
    expect(shouldAppendUnsegmentedLoopEntries(0, false, true)).toBe(false);
  });
});
