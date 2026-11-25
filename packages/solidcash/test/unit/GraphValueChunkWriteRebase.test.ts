import { binToHex } from '@bitauth/libauth';
import { computeCollectionHash } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import type { ExternalCallUtxoGroup } from '../../src/stateful/external-call-utxo-group.js';
import {
  hasMaterializedValueChunkWitness,
  rebaseGraphValueChunkWrites,
} from '../../src/stateful/sc-run-create-builder-derive-pass.js';
import type { ValueChunkWriteDescriptor } from '../../src/stateful/value-chunk-persist.js';
import { valueChunkWriteResourceIdentity } from '../../src/stateful/value-chunk-persist.js';
import {
  buildTransportedContinuationResourceClaim,
  type TransportedContinuationResourceClaim,
  type ValueChunkProducerIdentity,
} from '../../src/stateful/ValueChunkProducerIdentity.js';

const categoryId = '31'.repeat(31) + 'ce';
const owner = { categoryId, lockingBytecode: `aa20${'51'.repeat(32)}87` };
const effectDomainId = '91'.repeat(32);
const producer = (occurrenceIndex: number): ValueChunkProducerIdentity => ({
  version: 1,
  stateOwner: owner,
  sourcePath: [{
    sourceEffectDomainId: effectDomainId,
    sourceCallsiteId: 3,
    sourceLogicalIndex: 1,
    occurrenceIndex,
    sourceEffectOrdinal: 4,
  }],
  mutationEffectDomainId: effectDomainId,
  mutationSourceEffectOrdinal: 7,
});
const write = (
  collection: string, keySlot: string, outputBase: number, outputCount: number,
): ValueChunkWriteDescriptor => {
  const collectionSignature = `${collection}:mapping(uint256 => bytes)`;
  return {
    categoryId,
    collection,
    collectionSignature,
    collectionHash: binToHex(computeCollectionHash(collectionSignature)),
    keySlot,
    entryAccessSlot: 0,
    routeSlot: 0,
    operation: 'update',
    outputBase,
    outputCount,
  };
};
const claim = (
  descriptor: ValueChunkWriteDescriptor, chunkCount: number, bandOffset: number, index: number,
): TransportedContinuationResourceClaim => {
  const result = buildTransportedContinuationResourceClaim({
    owner,
    collectionSignature: descriptor.collectionSignature,
    collectionHash: descriptor.collectionHash,
    keySlot: descriptor.keySlot,
    digest: 'aa'.repeat(32),
    chunkCount,
    bandOffset,
    producerClaim: {
      producer: producer(index),
      resourceIdentity: valueChunkWriteResourceIdentity(descriptor),
    },
  });
  if (!result) throw new Error('Invalid test continuation claim.');
  return result;
};
const group = (writes: ValueChunkWriteDescriptor[]): ExternalCallUtxoGroup => ({
  valueChunkWrites: writes,
} as ExternalCallUtxoGroup);

describe('graph value-chunk write rebasing', () => {
  it('keeps an inline chunkable writer inactive despite a provisional chunk seed', () => {
    const witnessBuilder = {
      hasStagedValueChunkOutputs: () => false,
      getValueChunkRawCommitments: () => ['00'],
      getDerivedChunkOutputs: () => new Map(),
    } as unknown as Parameters<typeof hasMaterializedValueChunkWitness>[0];
    expect(hasMaterializedValueChunkWitness(witnessBuilder, [{ id: 'delegatedOwner' }], []))
      .toBe(false);
  });

  it('activates only a concretely encoded continuation chunk', () => {
    const witnessBuilder = {
      hasStagedValueChunkOutputs: () => false,
      getValueChunkRawCommitments: (id: string) => id === 'delegatedOwner' ? ['0000aa'] : [],
      getDerivedChunkOutputs: () => new Map(),
    } as unknown as Parameters<typeof hasMaterializedValueChunkWitness>[0];
    expect(hasMaterializedValueChunkWitness(witnessBuilder, [{ id: 'delegatedOwner' }], []))
      .toBe(true);
    expect(hasMaterializedValueChunkWitness(witnessBuilder, [{ id: 'other' }], []))
      .toBe(false);
  });

  it('keeps the root inline witness inactive when only an unrelated nested value chunk materializes', () => {
    const witnessBuilder = {
      hasStagedValueChunkOutputs: () => true,
      getDerivedChunkOutputs: () => new Map([[18, {
        semanticKind: 'valueChunk', resourceIdentity: 'nested', commitment: '0000aa',
      }]]),
      getValueChunkRawCommitments: () => ['00'],
    } as unknown as Parameters<typeof hasMaterializedValueChunkWitness>[0];
    expect(hasMaterializedValueChunkWitness(witnessBuilder, [{ id: 'root#0' }], []))
      .toBe(false);
  });

  it('activates a root continuation already materialized from a concrete long mint', () => {
    const witnessBuilder = {
      getValueChunkRawCommitments: () => [],
    } as unknown as Parameters<typeof hasMaterializedValueChunkWitness>[0];
    expect(hasMaterializedValueChunkWitness(witnessBuilder, [], [1]))
      .toBe(true);
    expect(hasMaterializedValueChunkWitness(witnessBuilder, [], [0]))
      .toBe(false);
  });

  it('retains the existing single-resource count when moving its scalar witness', () => {
    const carrier = group([write('records', '42'.repeat(32), 10, 2)]);
    rebaseGraphValueChunkWrites(carrier, 50, 5);
    expect(carrier.valueChunkWrites?.map(({ outputBase, outputCount }) => [outputBase, outputCount]))
      .toEqual([[50, 2]]);
  });

  it('reconstructs sparse multi-resource lanes from complete authenticated claims and rejects ambiguity', () => {
    const first = write('records', '42'.repeat(32), 10, 5);
    const second = write('profiles', '43'.repeat(32), 10, 5);
    const firstClaim = claim(first, 1, 10, 0);
    const secondClaim = claim(second, 4, 12, 1);
    const carrier = group([first, second]);
    carrier.transportedValueChunkProductions = true;
    carrier.continuationResourceClaims = [firstClaim, secondClaim];

    rebaseGraphValueChunkWrites(carrier, 50, 5);
    expect(carrier.valueChunkWrites?.map(({ outputBase, outputCount }) => [outputBase, outputCount]))
      .toEqual([[50, 1], [52, 4]]);
    expect(carrier.continuationResourceClaims).toEqual([firstClaim, secondClaim]);

    const missing = group([first, second]);
    missing.transportedValueChunkProductions = true;
    missing.continuationResourceClaims = [firstClaim];
    expect(() => rebaseGraphValueChunkWrites(missing, 50, 5)).toThrow(/exact continuation geometry/);
    expect(missing.valueChunkWrites).toEqual([first, second]);

    const overlapping = group([first, second]);
    overlapping.transportedValueChunkProductions = true;
    overlapping.continuationResourceClaims = [firstClaim, { ...secondClaim, bandOffset: 10 }];
    expect(() => rebaseGraphValueChunkWrites(overlapping, 50, 5)).toThrow(/exact continuation geometry/);

    const duplicate = group([first, { ...first }]);
    duplicate.transportedValueChunkProductions = true;
    duplicate.continuationResourceClaims = [firstClaim, secondClaim];
    expect(() => rebaseGraphValueChunkWrites(duplicate, 50, 5)).toThrow(/exact continuation geometry/);
  });

  it('keeps local resource claims aligned when absolute writes are rebased into a participant', () => {
    const first = write('records', '42'.repeat(32), 114, 1);
    const second = write('profiles', '43'.repeat(32), 118, 4);
    const carrier = group([first, second]);
    carrier.transportedValueChunkProductions = true;
    carrier.continuationResourceClaims = [claim(first, 1, 14, 0), claim(second, 4, 18, 1)];

    rebaseGraphValueChunkWrites(carrier, 14, 5);
    expect(carrier.valueChunkWrites?.map((item) => item.outputBase)).toEqual([14, 18]);
    expect(carrier.continuationResourceClaims?.map((item) => item.bandOffset)).toEqual([14, 18]);

    rebaseGraphValueChunkWrites(carrier, 16, 5);
    expect(carrier.valueChunkWrites?.map((item) => item.outputBase)).toEqual([16, 20]);
    expect(carrier.continuationResourceClaims?.map((item) => item.bandOffset)).toEqual([16, 20]);
  });
});
