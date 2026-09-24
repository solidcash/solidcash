import { describe, expect, it } from 'vitest';
import {
  applyParticipantAbsoluteWitnesses,
  resolveParticipantAbsoluteWitnesses,
} from '../../src/message-bus/layout-resolver.js';

/**
 * transaction layout authority plan step 2 (unit half): drive the shipped apply helper that compose uses to mutate
 * unlocker params — not a resolve-vs-resolve tautology.
 */
describe('compose layout authority (resolve-once + applyParticipantAbsoluteWitnesses)', () => {
  it('mutates fake unlocker params to the single-resolve absolutes for dyn+valueChunk+PredOut', () => {
    const publishedBase = 119;
    const trailingBase = 40;
    const dynChunkCount = 2;
    const valueChunkBandOffset = 22;
    const predPhysical = trailingBase + dynChunkCount;

    const witnesses = resolveParticipantAbsoluteWitnesses({
      participant: 1,
      contractName: 'MarketplaceDataV1',
      publishedBase,
      blockSize: 106,
      trailingBase,
      trailingCapacity: 66,
      dynChunkCount,
      entryNews: [{ collection: 'jobEvents', entryIndex: 0 }],
      valueChunkBandOffset,
      valueChunkCollection: 'jobEvents',
      valueChunkCount: 1,
      predOuts: [{
        witnessName: '__internal__vmapBatchPredOut_3',
        physicalLocalOffset: predPhysical,
      }],
    });

    // Fake unlocker frame: provisional local/sentinel values, as compose has before apply.
    const inputs = [
      { name: 'batchBlob' },
      { name: '__internal__dynamicChunkInputBase' },
      { name: '__internal__valueChunkOutputBase' },
      { name: '__internal__vmapBatchPredOut_3' },
    ];
    const params: unknown[] = [
      new Uint8Array([1]),
      BigInt(trailingBase), // local dyn
      BigInt(trailingBase + valueChunkBandOffset), // local value-chunk
      4n, // concrete PredOut (historical drift source)
    ];

    const applied = applyParticipantAbsoluteWitnesses({
      inputs,
      params,
      witnesses,
      participant: 1,
    });

    expect(params[1]).toBe(witnesses.dynamicChunkInputBase);
    expect(params[2]).toBe(witnesses.valueChunkOutputBase);
    expect(params[3]).toBe(witnesses.predOuts.get('__internal__vmapBatchPredOut_3'));
    expect(params[3]).toBe(BigInt(publishedBase + predPhysical));
    expect(params[3]).not.toBe(BigInt(publishedBase + 4));
    expect(applied.written.map((entry) => entry.name).sort()).toEqual([
      'dynamicChunkInputBase',
      'valueChunkOutputBase',
      'vmapBatchPredOut_3',
    ].sort());
  });

  it('fail-closes when an active PredOut slot exists but the resolve omitted it', () => {
    // Non-negative provisional = active claim; inactive sentinels (value < 0) are skipped.
    expect(() => applyParticipantAbsoluteWitnesses({
      inputs: [{ name: '__internal__vmapBatchPredOut_0' }],
      params: [4n],
      witnesses: {
        predOuts: new Map(),
      },
      participant: 0,
    })).toThrow(/pred-out-unresolved/);
  });
});
