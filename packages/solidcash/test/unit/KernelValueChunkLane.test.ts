import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { resolveKernelValueChunkResourceLanes } from '../../src/stateful/StatefulContract.js';

describe('kernel value-chunk resource lanes', () => {
  it('collapses repeated callsites for one exact storage resource', () => {
    const slot = Uint8Array.from({ length: 32 }, (_, index) => index);
    const lanes = resolveKernelValueChunkResourceLanes([
      { collection: 'records', slot },
      { collection: 'records', slot: slot.slice() },
      { collection: 'records', slot: slot.slice() },
    ]);
    expect(lanes).toEqual([`records:${binToHex(slot)}`]);
  });

  it('preserves distinct resources in their first compiler-published order', () => {
    const first = new Uint8Array(32);
    const second = new Uint8Array(32);
    second[31] = 1;
    expect(resolveKernelValueChunkResourceLanes([
      { collection: 'records', slot: first },
      { collection: 'audit', slot: first },
      { collection: 'records', slot: second },
      { collection: 'records', slot: first.slice() },
    ])).toEqual([
      `records:${binToHex(first)}`,
      `audit:${binToHex(first)}`,
      `records:${binToHex(second)}`,
    ]);
  });

  it('refuses an incomplete compiler-published resource identity', () => {
    expect(() => resolveKernelValueChunkResourceLanes([
      { collection: 'records' },
    ])).toThrow(/exact compiler-published resource lanes/);
  });
});
