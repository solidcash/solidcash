import { describe, expect, it } from 'vitest';
import {
  appendComputedValueChunkRun, type ComputedValueChunkRun,
} from '../../src/stateful/computed-value-chunk-runs.js';

describe('computed continuation registration', () => {
  it('shares one run for different lanes of the same concrete collection/key', () => {
    const runs: ComputedValueChunkRun[] = [];
    const slot = new Uint8Array(32).fill(0x31);
    appendComputedValueChunkRun(runs, 'records', slot);
    appendComputedValueChunkRun(runs, 'records', slot.slice());
    expect(runs).toEqual([{ id: 'records#0', collection: 'records', slot }]);
    expect(runs[0].slot).not.toBe(slot);
  });

  it('retains different concrete keys and collections as independent runs', () => {
    const runs: ComputedValueChunkRun[] = [];
    appendComputedValueChunkRun(runs, 'records', new Uint8Array(32).fill(0x31));
    appendComputedValueChunkRun(runs, 'records', new Uint8Array(32).fill(0x32));
    appendComputedValueChunkRun(runs, 'notes', new Uint8Array(32).fill(0x31));
    expect(runs.map(({ id }) => id)).toEqual(['records#0', 'records#1', 'notes#2']);
  });

  it('does not guess aliases for unresolved slots', () => {
    const runs: ComputedValueChunkRun[] = [];
    appendComputedValueChunkRun(runs, 'records');
    appendComputedValueChunkRun(runs, 'records');
    appendComputedValueChunkRun(runs, 'records', new Uint8Array(32));
    expect(runs.map(({ id }) => id)).toEqual(['records#0', 'records#1', 'records#2']);
  });
});
