import { describe, expect, it } from 'vitest';
import { hasMaterializedValueChunkWitness } from '../../src/stateful/sc-run-create-builder-derive-pass.js';

describe('materialized value-chunk witness', () => {
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
});
