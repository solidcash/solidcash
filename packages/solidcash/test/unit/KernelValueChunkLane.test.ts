import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { resolveKernelValueChunkResourceLane } from '../../src/stateful/StatefulContract.js';

describe('kernel value-chunk resource lanes', () => {
  it('collapses repeated callsites for one exact storage resource', () => {
    const slot = Uint8Array.from({ length: 32 }, (_, index) => index);
    const lane = resolveKernelValueChunkResourceLane([
      { collection: 'records', slot },
      { collection: 'records', slot: slot.slice() },
      { collection: 'records', slot: slot.slice() },
    ]);
    expect(lane).toBe(`records:${binToHex(slot)}`);
  });

  it('refuses distinct or incomplete resources instead of sharing one scalar base', () => {
    const first = new Uint8Array(32);
    const second = new Uint8Array(32);
    second[31] = 1;
    expect(() => resolveKernelValueChunkResourceLane([
      { collection: 'records', slot: first },
      { collection: 'records', slot: second },
    ])).toThrow(/one exact compiler-published resource lane/);
    expect(() => resolveKernelValueChunkResourceLane([
      { collection: 'records' },
    ])).toThrow(/one exact compiler-published resource lane/);
  });
});
