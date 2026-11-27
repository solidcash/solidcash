import { describe, expect, it } from 'vitest';
import { isValidComputedValueChunkCommitmentEncoding } from '../../src/stateful/computed-value-chunk-pin.js';

describe('computed value-chunk ownership', () => {
  it('does not mistake a valid encoding for a resource ownership proof', () => {
    expect(isValidComputedValueChunkCommitmentEncoding('000001')).toBe(true);
    expect(isValidComputedValueChunkCommitmentEncoding(`0000${'00'.repeat(126)}`)).toBe(true);
    expect(isValidComputedValueChunkCommitmentEncoding(`0000${'00'.repeat(127)}`)).toBe(false);
  });
});
