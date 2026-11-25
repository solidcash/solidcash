import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import {
  resolveValueChunkResourceLane,
  resolveValueChunkResourceLanes,
} from '../../src/stateful/StatefulContract.js';

describe('kernel value-chunk resource lanes', () => {
  it('collapses repeated callsites for one exact storage resource', () => {
    const slot = Uint8Array.from({ length: 32 }, (_, index) => index);
    const lane = resolveValueChunkResourceLane([
      { collection: 'records', slot },
      { collection: 'records', slot: slot.slice() },
      { collection: 'records', slot: slot.slice() },
    ]);
    expect(lane).toBe(`records:${binToHex(slot)}`);
    expect(resolveValueChunkResourceLanes([
      { collection: 'records', slot },
      { collection: 'records', slot: slot.slice() },
    ])).toEqual([`records:${binToHex(slot)}`]);
  });

  it('resolves ordered multi-lane resources while refusing incomplete slots', () => {
    const first = new Uint8Array(32);
    const second = new Uint8Array(32);
    second[31] = 1;
    expect(resolveValueChunkResourceLanes([
      { collection: 'records', slot: first },
      { collection: 'records', slot: second },
      { collection: 'payloads', slot: first.slice() },
      { collection: 'records', slot: first.slice() },
    ])).toEqual([
      `records:${binToHex(first)}`,
      `records:${binToHex(second)}`,
      `payloads:${binToHex(first)}`,
    ]);
    expect(() => resolveValueChunkResourceLane([
      { collection: 'records', slot: first },
      { collection: 'records', slot: second },
    ])).toThrow(/one exact compiler-published resource lane/);
    expect(() => resolveValueChunkResourceLanes([
      { collection: 'records' },
    ])).toThrow(/one exact compiler-published resource lane/);
    expect(() => resolveValueChunkResourceLane([
      { collection: 'records' },
    ])).toThrow(/one exact compiler-published resource lane/);
  });
});
