import { describe, expect, it } from 'vitest';
import { isCompilerDescribedRouteEventCommitment } from '../../src/stateful/StatefulContract.js';

describe('compiler-described route event discovery', () => {
  it('accepts typed zero only with exact compiler slot and signature ownership', () => {
    const typedZero = '00';

    expect(isCompilerDescribedRouteEventCommitment(typedZero, {
      compilerOwnedEventSlot: true,
      eventSignature: 'Observed(int256)',
    })).toBe(true);
    expect(isCompilerDescribedRouteEventCommitment(typedZero, {
      compilerOwnedEventSlot: false,
      eventSignature: 'Observed(int256)',
    })).toBe(false);
    expect(isCompilerDescribedRouteEventCommitment(typedZero, {
      compilerOwnedEventSlot: true,
    })).toBe(false);
  });

  it('preserves payload inference only for explicit unowned legacy coordinates', () => {
    expect(isCompilerDescribedRouteEventCommitment('51', {
      compilerOwnedEventSlot: false,
    })).toBe(true);
    expect(isCompilerDescribedRouteEventCommitment('', {
      compilerOwnedEventSlot: false,
    })).toBe(false);
  });
});
