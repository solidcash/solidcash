import { binToHex } from '@bitauth/libauth';
import { computeCollectionHash } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  StatefulTransactionBuilder,
  ValueChunkWriteStagingSession,
  bindValueChunkProducerClaimAliases,
  canonicalValueChunkProducerIdentity,
  selectSingletonValueChunkProducer,
  valueChunkProducerClaimFromRouteRow,
  type ValueChunkWriteDescriptor,
  type ValueChunkProducerIdentity,
  type ValueChunkProducerResourceClaim,
} from '../../src/stateful/index.js';

const categoryId = '31'.repeat(32);
const effectDomainId = '91'.repeat(32);
const collectionSignature = 'records:mapping(uint256 => bytes32[])';
const resourceIdentity = `${categoryId}:${binToHex(computeCollectionHash(collectionSignature))}:${'42'.repeat(32)}`;
const producer = (occurrenceIndex = 0): ValueChunkProducerIdentity => ({
  version: 1,
  stateOwner: { categoryId, lockingBytecode: 'aa20' + '51'.repeat(32) + '87' },
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
const claim = (occurrenceIndex = 0): ValueChunkProducerResourceClaim => ({
  producer: producer(occurrenceIndex), resourceIdentity,
});
const write: ValueChunkWriteDescriptor = {
  categoryId,
  collection: 'records',
  collectionSignature,
  collectionHash: binToHex(computeCollectionHash(collectionSignature)),
  keySlot: '42'.repeat(32),
  entryAccessSlot: 0,
  routeSlot: 0,
  operation: 'update',
  outputBase: 10,
  outputCount: 2,
};

describe('hierarchical value-chunk producer identity', () => {
  it('canonicalizes physical and logical aliases of one source occurrence', () => {
    const aliases = [claim(), { ...claim(), producer: { ...producer(), sourcePath: [...producer().sourcePath] } }];
    expect(canonicalValueChunkProducerIdentity(aliases[0].producer)).toBe(
      canonicalValueChunkProducerIdentity(aliases[1].producer),
    );
    expect(selectSingletonValueChunkProducer(aliases, resourceIdentity)).toMatchObject({ status: 'exact' });
    const physical = {
      valueChunkStateOwner: producer().stateOwner,
      valueChunkProducerClaims: undefined as readonly ValueChunkProducerResourceClaim[] | undefined,
    };
    const logical = {
      valueChunkStateOwner: producer().stateOwner,
      valueChunkProducerClaims: undefined as readonly ValueChunkProducerResourceClaim[] | undefined,
    };
    expect(bindValueChunkProducerClaimAliases([physical, logical], aliases)).toBe(true);
    expect(physical.valueChunkProducerClaims).toBe(logical.valueChunkProducerClaims);
    aliases[0].producer.stateOwner.lockingBytecode = '00';
    expect(physical.valueChunkProducerClaims?.[0].producer.stateOwner.lockingBytecode).toBe(
      producer().stateOwner.lockingBytecode,
    );
  });

  it('builds a hierarchical claim only from complete effective-row coordinates', () => {
    const enclosing = producer().sourcePath[0];
    const derived = valueChunkProducerClaimFromRouteRow({
      row: {
        sourceEffectDomainId: effectDomainId,
        sourceCallsiteId: 8, sourceLogicalIndex: 2, occurrenceIndex: 3, sourceEffectOrdinal: 5,
      },
      enclosingSourcePath: [enclosing],
      mutationSourceEffectOrdinal: 9,
      mutationEffectDomainId: effectDomainId,
      stateOwnerCategoryId: categoryId,
      stateOwnerLockingBytecode: producer().stateOwner.lockingBytecode,
      resourceIdentity,
    });
    expect(derived?.producer.sourcePath).toEqual([
      enclosing,
      {
        sourceEffectDomainId: effectDomainId,
        sourceCallsiteId: 8, sourceLogicalIndex: 2, occurrenceIndex: 3, sourceEffectOrdinal: 5,
      },
    ]);
    expect(valueChunkProducerClaimFromRouteRow({
      row: { sourceEffectDomainId: effectDomainId, sourceCallsiteId: 8, sourceEffectOrdinal: 5 },
      mutationSourceEffectOrdinal: 9,
      mutationEffectDomainId: effectDomainId,
      stateOwnerCategoryId: categoryId,
      stateOwnerLockingBytecode: producer().stateOwner.lockingBytecode,
      resourceIdentity,
    })).toBeUndefined();
  });

  it('refuses to select between distinct occurrences writing one resource', () => {
    expect(selectSingletonValueChunkProducer([claim(0), claim(1)], resourceIdentity)).toMatchObject({
      status: 'multiple',
    });
  });

  it('keeps nonbatch and row-zero identities distinct', () => {
    const nonbatch = claim();
    nonbatch.producer = {
      ...nonbatch.producer,
      sourcePath: [{ ...nonbatch.producer.sourcePath[0], sourceLogicalIndex: undefined }],
    };
    expect(canonicalValueChunkProducerIdentity(nonbatch.producer)).not.toBe(
      canonicalValueChunkProducerIdentity({
        ...nonbatch.producer,
        sourcePath: [{ ...nonbatch.producer.sourcePath[0], sourceLogicalIndex: 0 }],
      }),
    );
  });

  it('treats distinct enclosing parent occurrences as distinct producers', () => {
    const first = valueChunkProducerClaimFromRouteRow({
      row: {
        sourceEffectDomainId: effectDomainId,
        sourceCallsiteId: 8, occurrenceIndex: 0, sourceEffectOrdinal: 5,
      },
      enclosingSourcePath: [producer(0).sourcePath[0]],
      mutationSourceEffectOrdinal: 9,
      mutationEffectDomainId: effectDomainId,
      stateOwnerCategoryId: categoryId,
      stateOwnerLockingBytecode: producer().stateOwner.lockingBytecode,
      resourceIdentity,
    })!;
    const second = valueChunkProducerClaimFromRouteRow({
      row: {
        sourceEffectDomainId: effectDomainId,
        sourceCallsiteId: 8, occurrenceIndex: 0, sourceEffectOrdinal: 5,
      },
      enclosingSourcePath: [producer(1).sourcePath[0]],
      mutationSourceEffectOrdinal: 9,
      mutationEffectDomainId: effectDomainId,
      stateOwnerCategoryId: categoryId,
      stateOwnerLockingBytecode: producer().stateOwner.lockingBytecode,
      resourceIdentity,
    })!;
    expect(selectSingletonValueChunkProducer([first, second], resourceIdentity)).toMatchObject({
      status: 'multiple',
    });
  });

  it('keeps producer-owned staging exact and rejects an authority collision', () => {
    StatefulTransactionBuilder.clearPersistedJobEvents();
    const session = new ValueChunkWriteStagingSession();
    const value = new Uint8Array(96).fill(0x61);
    expect(session.stageOwned(write, claim(), value)).toBe(true);
    value[0] = 0xff;
    expect(session.getOwned(write, claim())?.[0]).toBe(0x61);
    const retrieved = session.getOwned(write, claim())!;
    retrieved[0] = 0xee;
    expect(session.getOwned(write, claim())?.[0]).toBe(0x61);
    expect(session.stageOwned(write, claim(1), value)).toBe(false);
    expect(session.getOwned(write, claim())).toBeUndefined();
    expect(session.getOwned(write, claim(1))).toBeUndefined();
    session.clear(categoryId);
    expect(session.stageOwned(write, claim(), new Uint8Array(96).fill(0x62))).toBe(true);
  });

  it('tombstones legacy/producer staging collisions for the build session', () => {
    const legacyFirst = new ValueChunkWriteStagingSession();
    expect(legacyFirst.stage(write, new Uint8Array(96).fill(1))).toBe(true);
    expect(legacyFirst.stageOwned(write, claim(), new Uint8Array(96).fill(2))).toBe(false);
    expect(legacyFirst.get(write)).toBeUndefined();
    expect(legacyFirst.stage(write, new Uint8Array(96).fill(3))).toBe(false);
    legacyFirst.delete(write);
    expect(legacyFirst.stage(write, new Uint8Array(96).fill(4))).toBe(true);

    const ownedFirst = new ValueChunkWriteStagingSession();
    expect(ownedFirst.stageOwned(write, claim(), new Uint8Array(96).fill(1))).toBe(true);
    expect(ownedFirst.stage(write, new Uint8Array(96).fill(2))).toBe(false);
    expect(ownedFirst.getOwned(write, claim())).toBeUndefined();
  });

  it('rejects incomplete source paths and resource mismatches', () => {
    const invalid = claim();
    invalid.producer = {
      ...invalid.producer,
      sourcePath: [{ ...invalid.producer.sourcePath[0], sourceEffectOrdinal: -1 }],
    };
    expect(canonicalValueChunkProducerIdentity(invalid.producer)).toBeUndefined();
    expect(selectSingletonValueChunkProducer([invalid], resourceIdentity)).toEqual({ status: 'invalid' });
    expect(canonicalValueChunkProducerIdentity({
      ...producer(), stateOwner: { ...producer().stateOwner, lockingBytecode: 'xyz' },
    })).toBeUndefined();
    expect(selectSingletonValueChunkProducer([claim()], `${resourceIdentity}:extra`)).toEqual({
      status: 'invalid',
    });
    const session = new ValueChunkWriteStagingSession();
    expect(session.stageOwned(write, { ...claim(), resourceIdentity: `${resourceIdentity}:other` }, new Uint8Array(96)))
      .toBe(false);
    expect(session.stageOwned(write, {
      ...claim(),
      producer: {
        ...claim().producer,
        stateOwner: { ...claim().producer.stateOwner, categoryId: '99'.repeat(32) },
      },
    }, new Uint8Array(96))).toBe(false);
  });
});
