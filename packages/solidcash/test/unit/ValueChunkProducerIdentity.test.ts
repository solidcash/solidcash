import { binToHex } from '@bitauth/libauth';
import { computeCollectionHash } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  ValueChunkWriteStagingSession,
  advanceValueChunkProducerArgumentEpoch,
  bindValueChunkProducerClaimAliases,
  buildTransportedContinuationResourceClaim,
  canonicalValueChunkProducerResourceClaim,
  canonicalValueChunkProducerIdentity,
  deriveValueChunkProducerChildPath,
  createValueChunkProducerArgumentEpoch,
  orderTransportedContinuationResourceClaims,
  selectSingletonValueChunkProducer,
  terminalValueChunkProducerClaim,
  valueChunkProducerClaimFromRouteRow,
  valueChunkEffectDomainId,
  valueChunkProducerArgumentsInEpoch,
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
  it('advances sibling arguments in an immutable producer-path epoch', () => {
    const firstPath = { status: 'complete' as const, context: {
      version: 1 as const, sourcePath: producer(0).sourcePath,
    } };
    const secondPath = { status: 'complete' as const, context: {
      version: 1 as const, sourcePath: producer(1).sourcePath,
    } };
    const initial = createValueChunkProducerArgumentEpoch([
      { producerPath: firstPath, args: [1n] },
      { producerPath: secondPath, args: [2n] },
    ]);
    const afterFirst = advanceValueChunkProducerArgumentEpoch(initial, firstPath, [11n]);
    const afterSecond = advanceValueChunkProducerArgumentEpoch(afterFirst, secondPath, [22n]);

    expect(valueChunkProducerArgumentsInEpoch(initial, firstPath)).toEqual([1n]);
    expect(valueChunkProducerArgumentsInEpoch(afterSecond, firstPath)).toEqual([11n]);
    expect(valueChunkProducerArgumentsInEpoch(afterSecond, secondPath)).toEqual([22n]);
    expect(() => advanceValueChunkProducerArgumentEpoch(
      afterSecond, { status: 'unavailable' }, [33n],
    )).toThrow(/no stable producer path/);
  });

  it('derives a tagged effect domain from exact executable bytecode and selector', () => {
    const baseline = valueChunkEffectDomainId('51', '01020304');
    expect(baseline).toMatch(/^[0-9a-f]{64}$/);
    expect(valueChunkEffectDomainId('52', '01020304')).not.toBe(baseline);
    expect(valueChunkEffectDomainId('51', '01020305')).not.toBe(baseline);
    const beforeUint16Boundary = valueChunkEffectDomainId('51'.repeat(65535), '01020304');
    const atUint16Boundary = valueChunkEffectDomainId('51'.repeat(65536), '01020304');
    expect(beforeUint16Boundary).toMatch(/^[0-9a-f]{64}$/);
    expect(atUint16Boundary).toMatch(/^[0-9a-f]{64}$/);
    expect(atUint16Boundary).not.toBe(beforeUint16Boundary);
    expect(valueChunkEffectDomainId('51', '010203')).toBeUndefined();
    expect(valueChunkEffectDomainId('xyz', '01020304')).toBeUndefined();
  });

  it('derives child paths only from an exact parent selector and complete compiler coordinates', () => {
    const parent = { status: 'complete' as const, context: { version: 1 as const, sourcePath: [] } };
    const derived = deriveValueChunkProducerChildPath({
      parent,
      parentExecutionLockingBytecode: '51',
      parentSelector: '01020304',
      sourceCallsiteId: 2,
      occurrenceIndex: 0,
      sourceEffectOrdinal: 3,
    });
    expect(derived.status).toBe('complete');
    if (derived.status === 'complete') {
      expect(derived.context.sourcePath).toHaveLength(1);
      expect(derived.context.sourcePath[0].sourceEffectDomainId).toBe(
        valueChunkEffectDomainId('51', '01020304'),
      );
    }
    expect(deriveValueChunkProducerChildPath({
      parent,
      parentExecutionLockingBytecode: '51',
      sourceCallsiteId: 2,
      occurrenceIndex: 0,
      sourceEffectOrdinal: 3,
    })).toEqual({ status: 'unavailable' });
  });

  it('canonicalizes physical and logical aliases of one source occurrence', () => {
    const aliases = [claim(), { ...claim(), producer: { ...producer(), sourcePath: [...producer().sourcePath] } }];
    expect(canonicalValueChunkProducerIdentity(aliases[0].producer)).toBe(
      canonicalValueChunkProducerIdentity(aliases[1].producer),
    );
    expect(selectSingletonValueChunkProducer(
      aliases, resourceIdentity, producer().stateOwner,
    )).toMatchObject({ status: 'exact' });
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
    expect(bindValueChunkProducerClaimAliases([], aliases)).toBe(false);
    expect(bindValueChunkProducerClaimAliases([{
      valueChunkStateOwner: { ...producer().stateOwner, lockingBytecode: '51' },
    }], aliases)).toBe(false);
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

  it('selects the terminal linear mutation using the exact reached producer path', () => {
    const row = (
      occurrenceIndex: number, mutationEffectOrdinals: number[],
    ): Parameters<typeof terminalValueChunkProducerClaim>[0]['rows'][number] => ({
      selector: '01020304',
      producerPath: {
        status: 'complete' as const,
        context: {
          version: 1 as const,
          sourcePath: producer(occurrenceIndex).sourcePath,
        },
      },
      handler: {
        selector: '01020304',
        sourceEffectOrder: 'linear' as const,
        entryAccesses: [{
          collection: collectionSignature,
          operations: ['read', 'write'],
          mutationEffectOrdinals,
        }],
      },
    });
    const selected = terminalValueChunkProducerClaim({
      rows: [row(0, [2]), row(1, [2, 7])],
      collectionIdentities: ['records', collectionSignature],
      executionLockingBytecode: '51',
      stateOwnerCategoryId: categoryId,
      stateOwnerLockingBytecode: producer().stateOwner.lockingBytecode,
      resourceIdentity,
    });

    expect(selected?.producer.sourcePath.at(-1)?.occurrenceIndex).toBe(1);
    expect(selected?.producer.mutationSourceEffectOrdinal).toBe(7);
    expect(selected?.producer.mutationEffectDomainId).toBe(
      valueChunkEffectDomainId('51', '01020304'),
    );
    expect(terminalValueChunkProducerClaim({
      rows: [{ ...row(1, [7]), handler: { ...row(1, [7]).handler, sourceEffectOrder: 'unsupported-flow' } }],
      collectionIdentities: [collectionSignature],
      executionLockingBytecode: '51',
      stateOwnerCategoryId: categoryId,
      stateOwnerLockingBytecode: producer().stateOwner.lockingBytecode,
      resourceIdentity,
    })).toBeUndefined();

    const fixedFlowRow = {
      ...row(1, [7]),
      handler: { ...row(1, [7]).handler, sourceEffectOrder: 'unsupported-flow' as const },
    };
    expect(terminalValueChunkProducerClaim({
      rows: [fixedFlowRow],
      collectionIdentities: [collectionSignature],
      fixedChunkableWriteSelectors: ['01020304'],
      executionLockingBytecode: '51',
      stateOwnerCategoryId: categoryId,
      stateOwnerLockingBytecode: producer().stateOwner.lockingBytecode,
      resourceIdentity,
    })?.producer.mutationSourceEffectOrdinal).toBe(7);
    expect(terminalValueChunkProducerClaim({
      rows: [{
        ...fixedFlowRow,
        handler: {
          ...fixedFlowRow.handler,
          entryAccesses: [{
            collection: collectionSignature, operations: ['write'], mutationEffectOrdinals: [3, 7],
          }],
        },
      }],
      collectionIdentities: [collectionSignature],
      fixedChunkableWriteSelectors: ['01020304'],
      executionLockingBytecode: '51',
      stateOwnerCategoryId: categoryId,
      stateOwnerLockingBytecode: producer().stateOwner.lockingBytecode,
      resourceIdentity,
    })).toBeUndefined();
  });

  it('accepts an exact whole-value occurrence without treating its handler as linear', () => {
    const access = {
      collection: collectionSignature, operations: ['write'], mutationEffectOrdinals: [7],
      storedValueSource: { version: 1 as const, execution: 'unconditional-once' as const, mutationEffectOrdinal: 7 },
    };
    const row = {
      selector: '01020304',
      producerPath: { status: 'complete' as const, context: { version: 1 as const, sourcePath: producer().sourcePath } },
      handler: { sourceEffectOrder: 'unsupported-flow' as const, entryAccesses: [access] },
    };
    const options = {
      rows: [row], collectionIdentities: [collectionSignature], executionLockingBytecode: '51',
      stateOwnerCategoryId: categoryId, stateOwnerLockingBytecode: producer().stateOwner.lockingBytecode,
      resourceIdentity,
    };
    expect(terminalValueChunkProducerClaim(options)?.producer.mutationSourceEffectOrdinal).toBe(7);
    expect(terminalValueChunkProducerClaim({
      ...options,
      rows: [{ ...row, handler: { ...row.handler, entryAccesses: [{ ...access, storedValueSource: undefined }] } }],
    })).toBeUndefined();
    expect(terminalValueChunkProducerClaim({
      ...options,
      rows: [{ ...row, handler: { ...row.handler, entryAccesses: [{ ...access, mutationEffectOrdinals: [8] }] } }],
    })).toBeUndefined();
    expect(terminalValueChunkProducerClaim({
      ...options,
      rows: [{ ...row, handler: { ...row.handler, entryAccesses: [access, access] } }],
    })).toBeUndefined();
  });

  it('refuses to select between distinct occurrences writing one resource', () => {
    expect(selectSingletonValueChunkProducer(
      [claim(0), claim(1)], resourceIdentity, producer().stateOwner,
    )).toMatchObject({
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
    expect(selectSingletonValueChunkProducer(
      [first, second], resourceIdentity, producer().stateOwner,
    )).toMatchObject({
      status: 'multiple',
    });
  });

  it('keeps multiple sequential producers exact within one resource', () => {
    const session = new ValueChunkWriteStagingSession();
    const value = new Uint8Array(96).fill(0x61);
    const later = new Uint8Array(96).fill(0x72);
    expect(session.stageOwned(write, claim(), producer().stateOwner, value)).toBe(true);
    value[0] = 0xff;
    expect(session.getOwned(write, claim(), producer().stateOwner)?.[0]).toBe(0x61);
    const retrieved = session.getOwned(write, claim(), producer().stateOwner)!;
    retrieved[0] = 0xee;
    expect(session.getOwned(write, claim(), producer().stateOwner)?.[0]).toBe(0x61);
    expect(session.stageOwned(write, claim(1), producer().stateOwner, later)).toBe(true);
    expect(session.getOwned(write, claim(), producer().stateOwner)?.[0]).toBe(0x61);
    expect(session.getOwned(write, claim(1), producer().stateOwner)?.[0]).toBe(0x72);
    expect(session.stageOwned(
      write, claim(1), producer().stateOwner, new Uint8Array(96).fill(0x73),
    )).toBe(false);
    expect(session.getOwned(write, claim(), producer().stateOwner)).toBeUndefined();
    expect(session.getOwned(write, claim(1), producer().stateOwner)).toBeUndefined();
    session.clear(categoryId);
    expect(session.stageOwned(
      write, claim(), producer().stateOwner, new Uint8Array(96).fill(0x62),
    )).toBe(true);
  });

  it('tombstones legacy/producer staging collisions for the build session', () => {
    const legacyFirst = new ValueChunkWriteStagingSession();
    expect(legacyFirst.stage(write, new Uint8Array(96).fill(1))).toBe(true);
    expect(legacyFirst.stageOwned(
      write, claim(), producer().stateOwner, new Uint8Array(96).fill(2),
    )).toBe(false);
    expect(legacyFirst.get(write)).toBeUndefined();
    expect(legacyFirst.stage(write, new Uint8Array(96).fill(3))).toBe(false);
    legacyFirst.delete(write);
    expect(legacyFirst.stage(write, new Uint8Array(96).fill(4))).toBe(false);

    const ownedFirst = new ValueChunkWriteStagingSession();
    expect(ownedFirst.stageOwned(
      write, claim(), producer().stateOwner, new Uint8Array(96).fill(1),
    )).toBe(true);
    expect(ownedFirst.stage(write, new Uint8Array(96).fill(2))).toBe(false);
    expect(ownedFirst.getOwned(write, claim(), producer().stateOwner)).toBeUndefined();
  });

  it('allows an exact terminal producer to supersede a resource-only seed explicitly', () => {
    const session = new ValueChunkWriteStagingSession();
    const seed = new Uint8Array(96).fill(1);
    const terminal = new Uint8Array(96).fill(2);
    expect(session.stage(write, seed)).toBe(true);
    expect(session.stageOwned(
      write, claim(), producer().stateOwner, terminal, { supersedeUnowned: true },
    )).toBe(true);
    expect(session.get(write)).toBeUndefined();
    expect(session.getOwned(write, claim(), producer().stateOwner)).toEqual(terminal);
  });

  it('does not let a same-category decoy resource seed the selected write', () => {
    const session = new ValueChunkWriteStagingSession();
    const decoySignature = 'archives:mapping(uint256 => bytes32[])';
    const decoyWrite: ValueChunkWriteDescriptor = {
      ...write,
      collection: 'archives',
      collectionSignature: decoySignature,
      collectionHash: binToHex(computeCollectionHash(decoySignature)),
      keySlot: '43'.repeat(32),
    };
    const decoyResourceIdentity = `${categoryId}:${decoyWrite.collectionHash}:${decoyWrite.keySlot}`;
    const decoyClaim: ValueChunkProducerResourceClaim = {
      producer: producer(), resourceIdentity: decoyResourceIdentity,
    };
    const authentic = new Uint8Array(96).fill(0x61);
    const hostile = new Uint8Array(96).fill(0x78);

    expect(session.stageOwned(decoyWrite, decoyClaim, producer().stateOwner, hostile)).toBe(true);
    expect(session.getOwned(write, claim(), producer().stateOwner)).toBeUndefined();
    expect(session.getOwned(write, decoyClaim, producer().stateOwner)).toBeUndefined();
    expect(session.stageOwned(write, claim(), producer().stateOwner, authentic)).toBe(true);
    expect(session.getOwned(write, claim(), producer().stateOwner)).toEqual(authentic);
    expect(session.getOwned(decoyWrite, decoyClaim, producer().stateOwner)).toEqual(hostile);
  });

  it('rejects incomplete source paths and resource mismatches', () => {
    const invalid = claim();
    invalid.producer = {
      ...invalid.producer,
      sourcePath: [{ ...invalid.producer.sourcePath[0], sourceEffectOrdinal: -1 }],
    };
    expect(canonicalValueChunkProducerIdentity(invalid.producer)).toBeUndefined();
    expect(selectSingletonValueChunkProducer(
      [invalid], resourceIdentity, producer().stateOwner,
    )).toEqual({ status: 'invalid' });
    expect(canonicalValueChunkProducerIdentity({
      ...producer(), stateOwner: { ...producer().stateOwner, lockingBytecode: 'xyz' },
    })).toBeUndefined();
    expect(selectSingletonValueChunkProducer(
      [claim()], `${resourceIdentity}:extra`, producer().stateOwner,
    )).toEqual({
      status: 'invalid',
    });
    const session = new ValueChunkWriteStagingSession();
    expect(session.stageOwned(
      write, { ...claim(), resourceIdentity: `${resourceIdentity}:other` }, producer().stateOwner,
      new Uint8Array(96),
    ))
      .toBe(false);
    expect(session.stageOwned(write, {
      ...claim(),
      producer: {
        ...claim().producer,
        stateOwner: { ...claim().producer.stateOwner, categoryId: '99'.repeat(32) },
      },
    }, producer().stateOwner, new Uint8Array(96))).toBe(false);
    expect(() => canonicalValueChunkProducerResourceClaim(null as never)).not.toThrow();
    expect(canonicalValueChunkProducerResourceClaim(null as never)).toBeUndefined();
    expect(() => selectSingletonValueChunkProducer(
      [null as never], resourceIdentity, producer().stateOwner,
    )).not.toThrow();
    expect(selectSingletonValueChunkProducer(
      [claim()], resourceIdentity,
      { ...producer().stateOwner, lockingBytecode: 'aa20' + '52'.repeat(32) + '87' },
    )).toEqual({ status: 'invalid' });
    expect(() => canonicalValueChunkProducerIdentity({
      ...producer(), sourcePath: [null as never],
    })).not.toThrow();
    expect(canonicalValueChunkProducerIdentity({
      ...producer(), sourcePath: [null as never],
    })).toBeUndefined();
    expect(() => bindValueChunkProducerClaimAliases(
      [null as never], [claim()],
    )).not.toThrow();
    expect(bindValueChunkProducerClaimAliases([null as never], [claim()])).toBe(false);
    expect(() => bindValueChunkProducerClaimAliases(
      [{ valueChunkStateOwner: producer().stateOwner }], [null as never],
    )).not.toThrow();
    expect(bindValueChunkProducerClaimAliases(
      [{ valueChunkStateOwner: producer().stateOwner }], [null as never],
    )).toBe(false);
  });

  it('orders contiguous continuation-resource bands under one owner', () => {
    const collectionHash = binToHex(computeCollectionHash(collectionSignature));
    const secondSignature = 'payloads:mapping(uint256 => bytes)';
    const secondHash = binToHex(computeCollectionHash(secondSignature));
    const secondResource = `${categoryId}:${secondHash}:${'43'.repeat(32)}`;
    const first = buildTransportedContinuationResourceClaim({
      owner: producer().stateOwner,
      collectionSignature,
      collectionHash,
      keySlot: '42'.repeat(32),
      digest: 'aa'.repeat(32),
      chunkCount: 2,
      bandOffset: 5,
      producerClaim: claim(),
    });
    const second = buildTransportedContinuationResourceClaim({
      owner: producer().stateOwner,
      collectionSignature: secondSignature,
      collectionHash: secondHash,
      keySlot: '43'.repeat(32),
      digest: 'bb'.repeat(32),
      chunkCount: 3,
      bandOffset: 7,
      producerClaim: { producer: producer(1), resourceIdentity: secondResource },
    });
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(orderTransportedContinuationResourceClaims([first!, second!])).toEqual([first, second]);
    expect(orderTransportedContinuationResourceClaims([first!, { ...second!, bandOffset: 8 }]))
      .toBeUndefined();
    expect(orderTransportedContinuationResourceClaims([first!, {
      ...second!,
      owner: { ...producer().stateOwner, lockingBytecode: 'aa20' + '52'.repeat(32) + '87' },
      producerClaim: {
        producer: {
          ...producer(1),
          stateOwner: { ...producer().stateOwner, lockingBytecode: 'aa20' + '52'.repeat(32) + '87' },
        },
        resourceIdentity: secondResource,
      },
    }])).toBeUndefined();
    expect(selectSingletonValueChunkProducer(
      [claim(), claim(1)], resourceIdentity, producer().stateOwner,
    )).toMatchObject({ status: 'multiple' });
    expect(selectSingletonValueChunkProducer(
      [claim()], resourceIdentity, producer().stateOwner,
    )).toMatchObject({ status: 'exact' });
  });
});
