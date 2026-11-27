import { describe, expect, it } from 'vitest';
import { retainCompleteObservedValueChunkWriteGeometry } from '../../src/stateful/value-chunk-write-geometry.js';
import { valueChunkWriteResourceIdentity, type ValueChunkWriteDescriptor } from '../../src/stateful/value-chunk-persist.js';

const write = (key: string, outputBase: number, outputCount: number): ValueChunkWriteDescriptor => ({
  categoryId: '11'.repeat(31) + 'ee', collection: 'values', collectionSignature: 'values:bytes[]',
  collectionHash: '22'.repeat(20), keySlot: key.repeat(32), entryAccessSlot: 0,
  routeSlot: 0, operation: 'update', outputBase, outputCount,
});

describe('value-chunk write geometry', () => {
  it('retains only complete resource-owned bands across a shared scalar re-description', () => {
    const left = write('88', 6, 1);
    const right = write('99', 7, 2);
    const described = [write('88', 7, 2), write('99', 7, 2)];
    const observed = [
      { offset: 6, resourceIdentity: valueChunkWriteResourceIdentity(left), resourcePart: 'chunk:0' },
      { offset: 7, resourceIdentity: valueChunkWriteResourceIdentity(right), resourcePart: 'chunk:0' },
      { offset: 8, resourceIdentity: valueChunkWriteResourceIdentity(right), resourcePart: 'chunk:1' },
    ];
    expect(retainCompleteObservedValueChunkWriteGeometry(described, [left, right], observed))
      .toEqual([left, right]);
    expect(retainCompleteObservedValueChunkWriteGeometry(described, [left, right], observed.slice(1)))
      .toEqual([described[0], right]);
    expect(retainCompleteObservedValueChunkWriteGeometry(described,
      [{ ...left, operation: 'update' }, { ...right, operation: 'insert' }], observed))
      .toEqual([left, described[1]]);
  });
});
