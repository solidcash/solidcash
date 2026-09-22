
import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { evalComputedKey } from '../../src/stateful/StatefulContract.js';

describe('evalComputedKey collection length', () => {
  it('applies a pending length delta before computing the appended element key', () => {
    const encoded = evalComputedKey(
      'binop:-(unop:.length(state:records),lit:1)',
      [],
      [],
      { records: [] },
      { records: 1n },
    );
    expect(encoded).toBeDefined();
    expect(binToHex(encoded!)).toBe(''); // VM 0
  });
  it('uses the persisted collection length when no pending delta exists', () => {
    const encoded = evalComputedKey(
      'binop:-(unop:.length(state:records),lit:1)',
      [],
      [],
      { records: [] },
    );
    expect(encoded).toBeDefined();
    // bigIntToVmNumber(-1n) is 0x81
    expect(binToHex(encoded!)).toBe('81');
  });
});
