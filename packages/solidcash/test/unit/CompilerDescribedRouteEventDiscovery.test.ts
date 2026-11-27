import { describe, expect, it } from 'vitest';
import { isCompilerDescribedEventCommitment } from '../../src/stateful/StatefulContract.js';

describe('compiler-described route event discovery', () => {
  it('accepts typed zero only with exact compiler slot and signature ownership', () => {
    const typedZero = '00';

    expect(isCompilerDescribedEventCommitment(typedZero, {
      compilerOwnedEventSlot: true,
      eventSignature: 'Observed(int256)',
    })).toBe(true);
    expect(isCompilerDescribedEventCommitment(typedZero, {
      compilerOwnedEventSlot: false,
      eventSignature: 'Observed(int256)',
    })).toBe(false);
    expect(isCompilerDescribedEventCommitment(typedZero, {
      compilerOwnedEventSlot: true,
    })).toBe(false);
  });

  it('preserves payload inference only for explicit unowned legacy coordinates', () => {
    expect(isCompilerDescribedEventCommitment('51', {
      compilerOwnedEventSlot: false,
    })).toBe(true);
    expect(isCompilerDescribedEventCommitment('', {
      compilerOwnedEventSlot: false,
    })).toBe(false);
  });
});
