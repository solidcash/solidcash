import { describe, expect, it } from 'vitest';
import {
  resolveValueChunkWriteGeometry,
  retainCompleteObservedValueChunkWriteGeometry,
} from '../../src/stateful/value-chunk-write-geometry.js';
import { valueChunkWriteResourceIdentity, type ValueChunkWriteDescriptor } from '../../src/stateful/value-chunk-persist.js';

const write = (key: string, outputBase: number, outputCount: number): ValueChunkWriteDescriptor => ({
  categoryId: '11'.repeat(31) + 'ee', collection: 'values', collectionSignature: 'values:bytes[]',
  collectionHash: '22'.repeat(20), keySlot: key.repeat(32), entryAccessSlot: 0,
  routeSlot: 0, operation: 'update', outputBase, outputCount,
});

describe('value-chunk write geometry', () => {
  it('keeps transported and locally materialized resources in separate authenticated bands', () => {
    const transported = write('33', 102, 2);
    const local = write('44', 102, 3);
    const observed = [0, 1, 2].map((index) => ({
      offset: 110 + index, resourceIdentity: valueChunkWriteResourceIdentity(local),
      resourcePart: `chunk:${index}`,
    }));
    expect(resolveValueChunkWriteGeometry([transported, local], [transported], observed))
      .toEqual([transported, { ...local, outputBase: 110, outputCount: 3 }]);
  });

  it('rejects contradictory resource pins and transported geometry', () => {
    const resource = write('55', 102, 2);
    const identity = valueChunkWriteResourceIdentity(resource);
    expect(() => resolveValueChunkWriteGeometry([resource], [], [
      { offset: 110, resourceIdentity: identity, resourcePart: 'chunk:0' },
      { offset: 112, resourceIdentity: identity, resourcePart: 'chunk:1' },
    ])).toThrow(/non-contiguous/);
    expect(() => resolveValueChunkWriteGeometry([resource], [resource, { ...resource, outputBase: 104 }], []))
      .toThrow(/conflicting geometry/);
  });

  it('does not narrow a compiler-owned span from a partial observed prefix', () => {
    const resource = write('66', 102, 3);
    const identity = valueChunkWriteResourceIdentity(resource);
    expect(() => resolveValueChunkWriteGeometry([resource], [], [
      { offset: 110, resourceIdentity: identity, resourcePart: 'chunk:0' },
    ])).toThrow(/incomplete observed output band/);
    const unresolved = write('77', -1, 0);
    expect(resolveValueChunkWriteGeometry([unresolved], [], [
      { offset: 110, resourceIdentity: valueChunkWriteResourceIdentity(unresolved), resourcePart: 'chunk:0' },
    ])).toEqual([unresolved]);
  });

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
