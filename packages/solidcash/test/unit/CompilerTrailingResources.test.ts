import { describe, expect, it } from 'vitest';
import {
  collectionValuePhysicalBindings,
  planCompilerTrailingResources,
} from '../../src/stateful/StatefulTransactionBuilder.js';

describe('compiler trailing resource coordinates', () => {
  it('places authenticated batch predecessors before dynamic and collection-value chunks', () => {
    expect(planCompilerTrailingResources({
      trailingBase: 61,
      batchPredecessorCount: 1,
      dynamicChunkCount: 2,
      collectionValueChunkCount: 2,
    })).toEqual({
      batchPredecessorBase: 61,
      dynamicChunkBase: 62,
      collectionValueChunkBase: 64,
      end: 66,
    });
  });

  it('does not reserve phantom gaps when a family is empty', () => {
    expect(planCompilerTrailingResources({
      trailingBase: 8,
      batchPredecessorCount: 0,
      dynamicChunkCount: 3,
      collectionValueChunkCount: 0,
    })).toEqual({
      batchPredecessorBase: 8,
      dynamicChunkBase: 8,
      collectionValueChunkBase: 11,
      end: 11,
    });
  });

  it('rejects coordinates which cannot be represented exactly', () => {
    expect(() => planCompilerTrailingResources({
      trailingBase: 1,
      batchPredecessorCount: -1,
      dynamicChunkCount: 0,
      collectionValueChunkCount: 0,
    })).toThrow('non-negative safe integers');
  });

  it('binds a delegated collection write after both independent physical frames', () => {
    const proxy = {
      blockLayout: { blockSize: 8, trailingBase: 6 },
      delegateCallGroupIndex: 0,
    };
    const logicalWrite = {
      sharedGroupIndex: 0,
      collectionValueWrites: [{}],
      valueChunkOutputCount: 2,
    };
    const implementation = {
      blockLayout: { blockSize: 5, trailingBase: 4 },
    };
    const bindings = collectionValuePhysicalBindings({
      externalGroups: [proxy, logicalWrite],
      lowLevelGroups: [implementation],
      externalMaster: () => 10,
      lowLevelMaster: () => 18,
    });

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toMatchObject({
      writeGroup: logicalWrite,
      owner: proxy,
      executor: implementation,
      ownerMaster: 10,
      executorMaster: 18,
      start: 22,
    });
  });

  it('keeps an embedded delegate continuation in its compiler-owned owner frame', () => {
    const proxy = {
      blockLayout: { blockSize: 12, trailingBase: 7 },
      delegateCallGroupIndex: 0,
      delegateEmbeddedInBlock: true,
      collectionValueWrites: [{}],
    };
    const implementation = { blockLayout: { blockSize: 5, trailingBase: 4 } };

    expect(collectionValuePhysicalBindings({
      externalGroups: [proxy],
      lowLevelGroups: [implementation],
      externalMaster: () => 30,
      lowLevelMaster: () => 37,
    })[0]).toMatchObject({ owner: proxy, executor: implementation, start: 37 });
  });
});
