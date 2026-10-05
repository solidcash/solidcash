import { describe, expect, it, vi } from 'vitest';
import {
  identityScanValueChunkOutputBase,
  publishIdentityScanValueChunkRange,
} from '../../src/stateful/identity-scan-value-chunk-range.js';
import type { ExternalCallUtxoGroup } from '../../src/stateful/external-call-utxo-group.js';
import type { DerivedChunkOutputObservation } from '../../src/stateful/value-chunk-persist.js';

const chunk = (resourceIdentity: string, part: number): DerivedChunkOutputObservation => ({
  commitment: `${part.toString(16).padStart(2, '0')}0061`, lockingBytecode: Uint8Array.of(0x51),
  resourceIdentity, resourcePart: `chunk:${part}`, semanticKind: 'valueChunk', fixedIndex: true,
});

describe('identity-scanned continuation range allocation', () => {
  it('keeps disjoint new writers out of an already authenticated range', () => {
    const observations = new Map([[7, chunk('first', 0)], [8, chunk('first', 1)]]);
    expect(identityScanValueChunkOutputBase(7, 3, 'second', observations)).toBe(9);
    expect(identityScanValueChunkOutputBase(8, 3, 'second', observations)).toBe(9);
    expect(identityScanValueChunkOutputBase(4, 3, 'second', observations)).toBe(4);
    expect([...observations.keys()]).toEqual([7, 8]);
  });

  it('checks the complete width and skips successive occupied ranges', () => {
    const observations = new Map([
      [7, chunk('first', 0)], [8, chunk('first', 1)], [10, chunk('second', 0)],
    ]);
    expect(identityScanValueChunkOutputBase(6, 3, 'third', observations)).toBe(11);
  });

  it('retains an allocated resource on repeated probes with a stale provisional base', () => {
    const observations = new Map([
      [7, chunk('first', 0)], [8, chunk('first', 1)], [9, chunk('second', 0)], [10, chunk('second', 1)],
    ]);
    expect(identityScanValueChunkOutputBase(7, 2, 'second', observations)).toBe(9);
  });

  it('refuses to heuristically move a previously authenticated range on conflict', () => {
    const observations = new Map([[7, chunk('first', 0)], [8, chunk('second', 0)]]);
    expect(() => identityScanValueChunkOutputBase(7, 2, 'first', observations)).toThrow('overlaps another resource');
  });

  it('publishes width and base to every physical witness alias without changing predecessor offsets', () => {
    const aliases = [vi.fn(), vi.fn()].map((refreshInternalArgs) => ({
      valueChunkOutputBase: 7, valueChunkOutputCount: 1,
      internalArgNames: ['__internal__valueChunkOutputBase'], refreshInternalArgs,
    } as unknown as ExternalCallUtxoGroup));
    expect(publishIdentityScanValueChunkRange(aliases, 'first', 9, 3)).toBe(true);
    for (const alias of aliases) {
      expect(alias.valueChunkOutputBase).toBe(9);
      expect(alias.valueChunkOutputCount).toBe(3);
      expect(alias.refreshInternalArgs).toHaveBeenCalledWith(
        { __internal__valueChunkOutputBase: 9n }, { shiftPredOut: false },
      );
    }
    expect(publishIdentityScanValueChunkRange(aliases, 'first', 9, 3)).toBe(false);
  });

  it('updates a logical alias without inventing a hidden argument in its ABI', () => {
    const refreshInternalArgs = vi.fn();
    const alias = { valueChunkOutputBase: 7, refreshInternalArgs } as unknown as ExternalCallUtxoGroup;
    expect(publishIdentityScanValueChunkRange([alias], 'first', 9, 3)).toBe(true);
    expect(alias.valueChunkOutputBase).toBe(9);
    expect(alias.valueChunkOutputCount).toBe(3);
    expect(refreshInternalArgs).not.toHaveBeenCalled();
    expect(alias.internalArgs).toBeUndefined();
    expect(publishIdentityScanValueChunkRange([alias], 'first', 9, 3)).toBe(false);
  });

  it('reports progress when the range is current but its encoded witness is stale', () => {
    const alias = {
      valueChunkOutputBase: 9, valueChunkOutputCount: 3,
      internalArgNames: ['__internal__valueChunkOutputBase'],
      internalArgs: { __internal__valueChunkOutputBase: 7n }, refreshInternalArgs: vi.fn(),
    } as unknown as ExternalCallUtxoGroup;
    expect(publishIdentityScanValueChunkRange([alias], 'first', 9, 3)).toBe(true);
    expect(alias.internalArgs?.__internal__valueChunkOutputBase).toBe(9n);
    expect(publishIdentityScanValueChunkRange([alias], 'first', 9, 3)).toBe(false);
  });
});
