import { describe, expect, it } from 'vitest';
import {
  legacyInitialValueChunkWrite,
  legacyNamedJobEventCollectionFallback,
  legacyIsJobEventsCollection,
  legacyIsPublishJobEventName,
  legacyScalarNameHints,
  permitsLegacyScalarNameHeuristics,
} from '../../src/stateful/legacy-planning-heuristics.js';
import {
  createCompositionSettlementSession,
  legacyRememberValueChunkValue,
  markPersistedCompatibilityValueChunkReady,
  permitsLegacyNamedValueChunkFallback,
  runWithCompositionSettlementSession,
} from '../../src/stateful/StatefulTransactionBuilder.js';
import {
  isInitialChunkableValueWrite,
  isPersistedChunkableValueWriteReady,
  shouldRematerializePersistUpdateForHost,
  shouldStampPersistUpdateDigestLockForHost,
} from '../../src/stateful/stb-chunkable-write-planning.js';
import { getChunkableValueWriteBand } from '../../src/stateful/stb-get-chunkable-value-write-band.js';

describe('legacy planning heuristics isolation (item 1)', () => {
  it('exposes JobEvent / jobEvents name matchers only via the legacy adapter module', () => {
    expect(legacyIsPublishJobEventName('publishJobEvent')).toBe(true);
    expect(legacyIsPublishJobEventName('setRecord')).toBe(false);
    expect(legacyIsJobEventsCollection('jobEvents')).toBe(true);
    expect(legacyIsJobEventsCollection('records')).toBe(false);
  });

  it('kernel-row-loop forbids legacy named value-chunk fallback and scalar name heuristics', () => {
    expect(permitsLegacyNamedValueChunkFallback([], 'kernel-row-loop')).toBe(false);
    expect(permitsLegacyScalarNameHeuristics('kernel-row-loop')).toBe(false);
    expect(permitsLegacyScalarNameHeuristics('legacy-unroll')).toBe(true);
  });

  it('alpha-renaming scalar function names changes legacy hints but kernel path ignores them', () => {
    const resetHints = legacyScalarNameHints('reset');
    const foobarHints = legacyScalarNameHints('foobar');
    expect(resetHints.zero).toBe(true);
    expect(foobarHints.zero).toBe(false);

    // Kernel convention: name heuristics disabled — both names yield the same (disabled) policy.
    expect(permitsLegacyScalarNameHeuristics('kernel-row-loop')).toBe(false);
    const kernelUsesHints = permitsLegacyScalarNameHeuristics('kernel-row-loop');
    expect(kernelUsesHints && resetHints.zero).toBe(false);
    expect(kernelUsesHints && foobarHints.zero).toBe(false);
  });

  it('kernel artifact groups cannot take the publishJobEvent name branch', () => {
    const kernelGroup = {
      logicalArtifact: { messageBus: { convention: 'kernel-row-loop' as const } },
      functionName: 'publishJobEvent',
    };
    expect(permitsLegacyNamedValueChunkFallback([kernelGroup as never])).toBe(false);
  });

  it('recognizes a renamed legacy first write from planned inserts without changing kernel behavior', () => {
    const group = { functionName: 'createRecord', plannedEntryInserts: [{ blockSlot: 1 }] };
    const host = {
      externalCallUtxoGroups: [group],
      lowLevelCallUtxoGroups: [],
      messageBusConvention: 'legacy-unroll',
      composedParticipant: false,
      getLowLevelCallMasterInputIndex: () => -1,
      getExternalCallMasterInputIndex: () => -1,
    };
    expect(legacyInitialValueChunkWrite([], [group])).toBe(true);
    expect(isInitialChunkableValueWrite(host as never)).toBe(true);
    expect(isInitialChunkableValueWrite({ ...host, messageBusConvention: 'kernel-row-loop' } as never))
      .toBe(false);
    expect(legacyInitialValueChunkWrite([{ functionName: 'publishJobPost' }], [])).toBe(false);
    expect(legacyInitialValueChunkWrite([{
      functionName: 'publishJobPost', plannedEntryInserts: [{ blockSlot: 1 }],
    }], [])).toBe(true);
    expect(legacyInitialValueChunkWrite([], [{ functionName: 'updateRecord' }])).toBe(false);
  });

  it('requires a matching historical publisher before selecting the legacy collection fallback', () => {
    expect(legacyNamedJobEventCollectionFallback([], true)).toBeUndefined();
    expect(legacyNamedJobEventCollectionFallback([{ functionName: 'appendNotice' }], true))
      .toBeUndefined();
    expect(legacyNamedJobEventCollectionFallback([{ functionName: 'publishJobEvent' }], true))
      .toBe('jobEvents');
    expect(legacyNamedJobEventCollectionFallback([{ functionName: 'publishJobEvent' }], false))
      .toBeUndefined();
  });

  it('does not treat another category as a ready legacy value-chunk publisher', () => {
    const session = createCompositionSettlementSession();
    const publisher = 'aa'.repeat(32);
    const unrelated = 'bb'.repeat(32);
    const host = {
      externalCallUtxoGroups: [{
        categoryId: publisher,
        functionName: 'publishJobEvent',
        logicalFunctionArgs: [0n, [16, '', '', 0]],
      }],
      lowLevelCallUtxoGroups: [],
      messageBusConvention: 'legacy-unroll',
      composedParticipant: false,
      getLowLevelCallMasterInputIndex: () => -1,
      getExternalCallMasterInputIndex: () => -1,
    };
    runWithCompositionSettlementSession(session, () => {
      markPersistedCompatibilityValueChunkReady(unrelated);
      legacyRememberValueChunkValue(unrelated, new Uint8Array(80));
      expect(isPersistedChunkableValueWriteReady(host as never)).toBe(false);
      expect(shouldRematerializePersistUpdateForHost(host as never)).toBe(false);
      expect(shouldStampPersistUpdateDigestLockForHost(host as never)).toBe(false);
      markPersistedCompatibilityValueChunkReady(publisher);
      legacyRememberValueChunkValue(publisher, new Uint8Array(80));
      expect(isPersistedChunkableValueWriteReady(host as never)).toBe(true);
      expect(shouldRematerializePersistUpdateForHost(host as never)).toBe(true);
      expect(shouldStampPersistUpdateDigestLockForHost(host as never)).toBe(true);
    });
  });

  it('does not read the historical collection for a renamed descriptor-free band writer', () => {
    const queriedCollections: string[] = [];
    const group = {
      categoryId: 'ab'.repeat(32),
      functionName: 'appendNotice',
      dataNftUtxos: [],
      valueChunkOutputCount: 1,
    };
    const historical = { ...group, functionName: 'publishJobEvent' };
    const host = {
      // A different participant's historical name must not identify this selected writer's collection.
      externalCallUtxoGroups: [group, historical],
      lowLevelCallUtxoGroups: [],
      messageBusConvention: 'legacy-unroll',
      derivedChunkOutputs: new Map(),
      allInputs: [],
      composedParticipant: false,
      chunkableValueWriteExecution: () => undefined,
      chunkableValueWriteGroups: () => ({
        external: group, externalIndex: 0, externalIndices: [0], lowLevelIndex: -1,
      }),
      getLowLevelCallMasterInputIndex: () => -1,
      findMintingInputIndex: () => 0,
      getLoopEntryCommitments: (collection: string) => {
        queriedCollections.push(collection);
        return [];
      },
      chunkableValueWriteCategory: () => group.categoryId,
      persistedChunkableValueWriteState: () => undefined,
      isPersistedChunkableValueWriteReady: () => false,
      isInitialChunkableValueWrite: () => true,
      chunkableValueWriteInputIndex: () => 0,
      entryScaledPreserveRange: () => undefined,
    };

    expect(getChunkableValueWriteBand(host as never)).toBeDefined();
    expect(queriedCollections).toEqual([]);

    expect(getChunkableValueWriteBand({
      ...host,
      externalCallUtxoGroups: [historical],
      chunkableValueWriteGroups: () => ({
        external: historical, externalIndex: 0, externalIndices: [0], lowLevelIndex: -1,
      }),
    } as never)).toBeDefined();
    expect(queriedCollections).toEqual(['jobEvents']);
  });

  it('rejects ambiguous compiler-published band collections before the legacy name fallback', () => {
    const group = {
      categoryId: 'ab'.repeat(32),
      functionName: 'publishJobEvent',
      dataNftUtxos: [],
      valueChunkOutputCount: 1,
      stateLayout: {
        variables: [], collections: [
          { name: 'notices', signature: 'notices:mapping(int => Notice[])', chunkableValue: true },
          { name: 'records', signature: 'records:mapping(int => Record[])', chunkableValue: true },
        ],
      },
      compilerRoute: { abiFunction: {
        name: 'publishJobEvent',
        inputs: [], outputs: [],
        entryAccesses: [
          { collection: 'notices', operations: ['write'] },
          { collection: 'records', operations: ['write'] },
        ],
      } },
    };
    const host = {
      externalCallUtxoGroups: [group],
      lowLevelCallUtxoGroups: [],
      messageBusConvention: 'legacy-unroll',
      derivedChunkOutputs: new Map(),
      allInputs: [],
      composedParticipant: false,
      chunkableValueWriteExecution: () => undefined,
      chunkableValueWriteGroups: () => ({
        external: group, externalIndex: 0, externalIndices: [0], lowLevelIndex: -1,
      }),
      getLowLevelCallMasterInputIndex: () => -1,
      findMintingInputIndex: () => 0,
      getLoopEntryCommitments: () => [],
      chunkableValueWriteCategory: () => group.categoryId,
      persistedChunkableValueWriteState: () => undefined,
      isPersistedChunkableValueWriteReady: () => false,
      isInitialChunkableValueWrite: () => true,
      chunkableValueWriteInputIndex: () => 0,
      entryScaledPreserveRange: () => undefined,
    };

    expect(() => getChunkableValueWriteBand(host as never))
      .toThrow('Ambiguous compiler-published chunkable-value band collections');
  });
});
