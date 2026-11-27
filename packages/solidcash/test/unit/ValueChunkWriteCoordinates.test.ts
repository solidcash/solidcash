import { describe, expect, it } from 'vitest';
import {
  rebaseValueChunkWriteDescriptors,
  type ValueChunkWriteDescriptor,
} from '../../src/stateful/StatefulTransactionBuilder.js';

const write = (outputBase: number): ValueChunkWriteDescriptor => ({
  categoryId: '11'.repeat(31) + 'ee',
  collection: 'records',
  collectionSignature: 'records:mapping(bytes32 => Record[])',
  collectionHash: '22'.repeat(20),
  keySlot: '33'.repeat(32),
  entryAccessSlot: 0,
  routeSlot: 0,
  operation: 'update' as const,
  outputBase,
  outputCount: 2,
});

describe('value-chunk write coordinates', () => {
  it('moves described lanes when late binding changes the carrier coordinate domain', () => {
    expect(rebaseValueChunkWriteDescriptors(
      [write(221), write(224), write(-1)], 221, 102,
    )?.map((descriptor) => descriptor.outputBase)).toEqual([102, 105, -1]);
  });
});
