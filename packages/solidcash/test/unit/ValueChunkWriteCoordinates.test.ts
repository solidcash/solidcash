import { describe, expect, it } from 'vitest';
import {
  absoluteComposedValueChunkOutputBase,
  rebaseValueChunkWriteDescriptors,
  selectBuilderValueChunkOutputBase,
  transportedContinuationLocalBase,
} from '../../src/stateful/StatefulTransactionBuilder.js';

const write = (outputBase: number) => ({
  categoryId: '11'.repeat(32),
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
  it('exports local continuation slots in aggregate coordinates', () => {
    expect(absoluteComposedValueChunkOutputBase(102, 119)).toBe(221);
    expect(absoluteComposedValueChunkOutputBase(4, 0)).toBe(4);
  });

  it('preserves an unresolved continuation sentinel', () => {
    expect(absoluteComposedValueChunkOutputBase(-1, 119)).toBe(-1);
  });

  it('keeps a composed participant local until descriptor export', () => {
    expect(selectBuilderValueChunkOutputBase(102, 221, 119)).toBe(102);
    expect(absoluteComposedValueChunkOutputBase(
      selectBuilderValueChunkOutputBase(102, 221, 119), 119,
    )).toBe(221);
  });

  it('projects a repacked published lane back into the participant builder', () => {
    expect(selectBuilderValueChunkOutputBase(102, 220, 119)).toBe(101);
  });

  it('retains a published lane that is already participant-local', () => {
    expect(selectBuilderValueChunkOutputBase(102, 101, 119)).toBe(101);
  });

  it('selects a unique transported lane only at the observed width', () => {
    const resourceIdentity = `${'11'.repeat(32)}:${'22'.repeat(20)}:${'33'.repeat(32)}`;
    const claims = [{
      bandOffset: 101,
      chunkCount: 3,
      producerClaim: { resourceIdentity },
    }];
    expect(transportedContinuationLocalBase(claims, resourceIdentity, 3)).toBe(101);
    expect(transportedContinuationLocalBase(claims, resourceIdentity, 2)).toBeUndefined();
  });

  it('accepts a published coordinate outside composition', () => {
    expect(selectBuilderValueChunkOutputBase(102, 221, 0)).toBe(221);
    expect(selectBuilderValueChunkOutputBase(102, undefined, 0)).toBe(102);
  });

  it('moves described lanes when late binding changes the carrier coordinate domain', () => {
    expect(rebaseValueChunkWriteDescriptors(
      [write(221), write(224), write(-1)], 221, 102,
    )?.map((descriptor) => descriptor.outputBase)).toEqual([102, 105, -1]);
  });
});
