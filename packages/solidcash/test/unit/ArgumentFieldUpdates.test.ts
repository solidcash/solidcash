import { describe, expect, it } from 'vitest';
import { applyAbiArgumentFieldUpdates } from '../../src/stateful/StatefulContract.js';

describe('compiler-published ABI argument field updates', () => {
  const updates = [{
    parameter: 'notice',
    fieldPath: ['metadata', 'recordedAt'],
    source: 'blockTimestamp' as const,
  }];

  it('applies a block timestamp without depending on application field names', () => {
    const original = { kind: 7n, metadata: { recordedAt: 0n, label: 'alpha' } };
    const updated = applyAbiArgumentFieldUpdates(
      original,
      updates,
      'notice',
      { blockTimestamp: 1_725_000_000n },
    );

    expect(updated).toEqual({
      kind: 7n,
      metadata: { recordedAt: 1_725_000_000n, label: 'alpha' },
    });
    expect(original.metadata.recordedAt).toBe(0n);
  });

  it('leaves values unchanged without matching compiler metadata and context', () => {
    const original = { metadata: { recordedAt: 0n } };
    expect(applyAbiArgumentFieldUpdates(original, updates, 'other', {
      blockTimestamp: 1_725_000_000n,
    })).toEqual(original);
    expect(applyAbiArgumentFieldUpdates(original, updates, 'notice', {})).toEqual(original);
  });
});
