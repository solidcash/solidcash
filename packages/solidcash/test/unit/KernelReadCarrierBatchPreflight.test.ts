import { describe, expect, it } from 'vitest';
import {
  kernelJournalDispositionCommitmentMarker,
  kernelJournalDispositionManifestDigest,
  type AbiFunction,
  type Artifact,
  type KernelJournalDispositionsAbi,
} from '@solidcash/utils';
import {
  kernelJournalDispositionsFromArtifact,
  type KernelEntryJournalReadCarrierCapability,
} from '../../src/stateful/KernelEntryJournal.js';
import {
  assertKernelReadCarrierAuthenticatedRows,
  kernelReadCarrierOwnsDuplicateProof,
  kernelReadCarrierCapabilityForSelectedRoute,
  planAuthenticatedKernelJournalDispositionChain,
  shouldDeferKernelJournalBatchMaterialization,
  shouldDeferKernelJournalMaterialization,
  type SelectedKernelJournalHandler,
  type SelectedKernelJournalStream,
} from '../../src/stateful/StatefulContract.js';

const handler = (
  selector: string,
  compactAccessStream = true,
): SelectedKernelJournalStream['handler'] => ({
  selector,
  inputs: compactAccessStream
    ? [{ name: '__internal__kernelJournalAccessStreams', type: 'bytes[]' }]
    : [],
} as Pick<AbiFunction, 'selector' | 'inputs'>);

const selected = (
  selector: string,
  journalAccessStreamIndex: number,
  compactAccessStream = true,
): SelectedKernelJournalStream => ({
  handler: handler(selector, compactAccessStream), journalAccessStreamIndex,
});

const capability = (
  ...scopes: Array<{ handlerSelector: string; journalAccessStreamIndex: number }>
): KernelEntryJournalReadCarrierCapability => ({
  kind: 'internal-read-carrier', version: 1, scopes,
});

const batchHandler = (
  selector: string,
  streams: Array<{ collection: string; journalAccessStreamIndex: number }> = [],
  eagerCollections: string[] = [],
): SelectedKernelJournalHandler => ({
  selector,
  inputs: streams.length > 0
    ? [{ name: '__internal__kernelJournalAccessStreams', type: 'bytes[]' }]
    : [],
  sortedUpsertLoopInfo: streams.map(({ collection, journalAccessStreamIndex }) => ({
    collection,
    collectionHash: '11'.repeat(20),
    journalAccessStreamIndex,
    fixedKeyParams: [],
    varyingArrayParam: '__internal__permutation',
    valueArrayIndexParam: '__internal__permutation',
    op: 'read',
  })),
  entryAccesses: eagerCollections.map((collection) => ({
    collection, keyParams: ['key'], operations: ['read'],
  })),
} as SelectedKernelJournalHandler);

describe('kernel read-carrier selected-batch preflight', () => {
  it('transfers duplicate read-proof ownership only to the authenticated carrier planner', () => {
    expect(kernelReadCarrierOwnsDuplicateProof(true, 'read')).toBe(true);
    expect(kernelReadCarrierOwnsDuplicateProof(false, 'read')).toBe(false);
    expect(kernelReadCarrierOwnsDuplicateProof(true, 'set')).toBe(false);
    expect(kernelReadCarrierOwnsDuplicateProof(true, '+')).toBe(false);
    expect(kernelReadCarrierOwnsDuplicateProof(true, 'delete')).toBe(false);
  });

  it('keeps direct entry points eager even when their artifact publishes a route capability', () => {
    const published = capability(
      { handlerSelector: '11111111', journalAccessStreamIndex: 0 },
    );

    expect(kernelReadCarrierCapabilityForSelectedRoute(published, undefined, [
      batchHandler('11111111', [{ collection: 'records', journalAccessStreamIndex: 0 }]),
    ])).toBeUndefined();
    expect(kernelReadCarrierCapabilityForSelectedRoute(published, {}, [])).toBeUndefined();
    expect(kernelReadCarrierCapabilityForSelectedRoute(published, {}, [
      batchHandler('11111111', [{ collection: 'records', journalAccessStreamIndex: 0 }]),
    ])).toBeUndefined();
  });

  it('does not infer local route authority from selected-row metadata or a cloned ABI object', () => {
    const published = capability(
      { handlerSelector: '11111111', journalAccessStreamIndex: 0 },
    );
    const rows = [batchHandler('11111111', [{ collection: 'records', journalAccessStreamIndex: 0 }])];
    const publicRouteMetadata = { selector: 'ffffffff', messageBusRowArguments: rows };

    expect(kernelReadCarrierCapabilityForSelectedRoute(
      published, undefined, rows, publicRouteMetadata,
    )).toBeUndefined();
    expect(kernelReadCarrierCapabilityForSelectedRoute(
      published, undefined, rows, { ...publicRouteMetadata },
    )).toBeUndefined();
  });

  it('keeps legacy materialization when no selected stream is covered', () => {
    const published = capability(
      { handlerSelector: '11111111', journalAccessStreamIndex: 0 },
    );

    expect(shouldDeferKernelJournalMaterialization(undefined, [selected('22222222', 0)]))
      .toBe(false);
    expect(shouldDeferKernelJournalMaterialization(published, []))
      .toBe(false);
    expect(shouldDeferKernelJournalMaterialization(published, [
      selected('22222222', 0, false), selected('33333333', 1),
    ])).toBe(false);
  });

  it('defers the complete selected batch only when every stream is covered', () => {
    const streams = [selected('11111111', 0), selected('11111111', 1), selected('22222222', 0)];
    const published = capability(
      { handlerSelector: '11111111', journalAccessStreamIndex: 0 },
      { handlerSelector: '11111111', journalAccessStreamIndex: 1 },
      { handlerSelector: '22222222', journalAccessStreamIndex: 0 },
    );

    expect(shouldDeferKernelJournalMaterialization(published, streams)).toBe(true);
  });

  it('rejects partial coverage before a materialization mode can be selected', () => {
    const streams = [selected('11111111', 0), selected('22222222', 0)];
    const published = capability(
      { handlerSelector: '11111111', journalAccessStreamIndex: 0 },
    );

    expect(() => shouldDeferKernelJournalMaterialization(published, streams))
      .toThrow('covers only part of the selected runtime journal batch');
  });

  it('rejects a fully covered batch whose route has no compact access carrier', () => {
    const published = capability(
      { handlerSelector: '11111111', journalAccessStreamIndex: 0 },
    );

    expect(() => shouldDeferKernelJournalMaterialization(published, [selected('11111111', 0, false)]))
      .toThrow('without a compact journal access stream');
  });

  it('rejects covered and uncovered journal rows in one authenticated batch', () => {
    const published = capability(
      { handlerSelector: '11111111', journalAccessStreamIndex: 0 },
    );
    const handlers = [
      batchHandler('11111111', [{ collection: 'source', journalAccessStreamIndex: 0 }]),
      batchHandler('22222222', [{ collection: 'destination', journalAccessStreamIndex: 0 }]),
    ];

    expect(() => shouldDeferKernelJournalBatchMaterialization(published, handlers))
      .toThrow('covers only part of the selected runtime journal batch');
  });

  it('rejects a selected capability scope absent from exact handler metadata', () => {
    const published = capability(
      { handlerSelector: '11111111', journalAccessStreamIndex: 1 },
    );

    expect(() => shouldDeferKernelJournalBatchMaterialization(published, [
      batchHandler('11111111', [{ collection: 'records', journalAccessStreamIndex: 0 }]),
    ])).toThrow('runtime journal stream absent from handler metadata');
    expect(() => shouldDeferKernelJournalBatchMaterialization(published, [
      batchHandler('11111111'),
    ])).toThrow('runtime journal stream absent from handler metadata');
  });

  it.each([
    ['fixed entry', { entryAccesses: [{ collection: 'records', keyParams: ['key'], operations: ['read'] }] }],
    ['runtime entry loop', { entryLoopWrites: ['records'] }],
    ['sorted insert name', { sortedInsertLoops: ['records'] }],
    ['sorted insert descriptor', {
      sortedInsertLoopInfo: [{
        collection: 'records', fixedKeyParams: [], varyingArrayParam: 'keys', valueBool: true,
      }],
    }],
    ['fixed sorted batch', { sortedBatchInfo: [{ collection: 'records', slotIndices: [0] }] }],
    ['collection iteration', { collectionIterations: [{
      collection: 'records', mode: 'entries', iterationIndex: 0,
    }] }],
  ] as const)('rejects an eager %s which aliases a deferred carrier collection', (_kind, metadata) => {
    const published = capability(
      { handlerSelector: '11111111', journalAccessStreamIndex: 0 },
    );
    const handlers = [
      batchHandler('11111111', [{ collection: 'records', journalAccessStreamIndex: 0 }]),
      { ...batchHandler('22222222'), ...metadata } as SelectedKernelJournalHandler,
    ];

    expect(() => shouldDeferKernelJournalBatchMaterialization(published, handlers))
      .toThrow("cannot share deferred collection(s) 'records' with eager batch accesses");
  });

  it('allows unrelated non-journal rows beside a completely covered carrier family', () => {
    const published = capability(
      { handlerSelector: '11111111', journalAccessStreamIndex: 0 },
      { handlerSelector: '11111111', journalAccessStreamIndex: 1 },
    );
    const handlers = [
      batchHandler('11111111', [
        { collection: 'source', journalAccessStreamIndex: 0 },
        { collection: 'destination', journalAccessStreamIndex: 1 },
      ]),
      batchHandler('22222222', [], ['unrelated']),
      batchHandler('33333333'),
    ];

    expect(shouldDeferKernelJournalBatchMaterialization(published, handlers)).toBe(true);
  });

  it('rejects SDK row metadata substituted beside authenticated carrier selectors', () => {
    expect(() => assertKernelReadCarrierAuthenticatedRows(
      true,
      ['11111111', '22222222'],
      [{ handler: { selector: '11111111' } }, { handler: { selector: '33333333' } }],
    )).toThrow('requires exact row metadata for every authenticated selector');
    expect(() => assertKernelReadCarrierAuthenticatedRows(
      true, ['11111111'], undefined,
    )).toThrow('requires exact row metadata for every authenticated selector');
    expect(() => assertKernelReadCarrierAuthenticatedRows(
      false, ['11111111'], undefined,
    )).not.toThrow();
  });
});

const digest = (digit: string): string => digit.repeat(64);

const dispositionManifest = (): KernelJournalDispositionsAbi => ({
  version: 1,
  handlers: [{
    selectorHex: '11111111', completedDescriptorDigest: digest('1'), mode: 'carrier',
    streams: [0, 1].map((journalAccessStreamIndex) => ({
      journalAccessStreamIndex, descriptorDigest: digest(String(journalAccessStreamIndex + 2)),
      disposition: 'carrier' as const,
    })),
  }, {
    selectorHex: '22222222', completedDescriptorDigest: digest('4'), mode: 'eager-journal',
    streams: [{ journalAccessStreamIndex: 0, descriptorDigest: digest('5'), disposition: 'eager-journal' }],
  }, {
    selectorHex: '33333333', completedDescriptorDigest: digest('6'), mode: 'neutral', streams: [],
  }],
});

const dispositionArtifact = (): Artifact => {
  const handlers = [
    batchHandler('11111111', [
      { collection: 'a', journalAccessStreamIndex: 0 },
      { collection: 'b', journalAccessStreamIndex: 1 },
    ]),
    batchHandler('22222222', [{ collection: 'c', journalAccessStreamIndex: 0 }]),
    batchHandler('33333333'),
  ];
  const manifest = dispositionManifest();
  const manifestDigest = kernelJournalDispositionManifestDigest(manifest);
  return {
    contractName: 'DispositionFixture', constructorInputs: [],
    bytecode: kernelJournalDispositionCommitmentMarker(manifestDigest)!, source: '', abi: handlers,
    messageBus: {
      version: 1, selector: '53434231', routeInBytecode: true, convention: 'kernel-row-loop', available: true,
      maximumRows: 3, maximumBlobBytes: 520, minimumRows: 1,
      atomicMessageBus: {
        domain: '53434d42', protocolVersions: [2],
        messageEnvelope: { region: 'participant-verifiers', canonicalInput: 'final-participant-verifier', unlockingPush: 0 },
        maximumParticipants: 8, maximumRows: 0xffff,
      },
      kernelEntryJournal: {
        version: 1, kernelJournalDispositions: manifest,
        kernelJournalDispositionCommitment: { version: 1, digest },
        capabilities: [{ kind: 'internal-read-carrier', version: 1, scopes: [
          { handlerSelector: '11111111', journalAccessStreamIndex: 0 },
          { handlerSelector: '11111111', journalAccessStreamIndex: 1 },
        ] }],
      },
      route: { name: '__message_bus__', selector: '53434231', inputs: [], outputs: [] },
      handlers: handlers.map((candidate) => ({
        name: candidate.selector!, selector: candidate.selector!, inputs: [], eligible: true,
      })),
    },
  } as unknown as Artifact;
};

describe('kernel journal disposition manifest handoff', () => {
  it('accepts one exact ordered completed-descriptor manifest beside the released carrier capability', () => {
    const artifact = dispositionArtifact();
    const manifest = kernelJournalDispositionsFromArtifact(artifact);
    expect(manifest).toEqual(dispositionManifest());
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest!.handlers[0]!.streams)).toBe(true);
  });

  it('stays dormant when either exact metadata or released carrier capability is absent', () => {
    const absent = dispositionArtifact();
    delete absent.messageBus!.kernelEntryJournal!.kernelJournalDispositions;
    expect(kernelJournalDispositionsFromArtifact(absent)).toBeUndefined();

    const unreleased = dispositionArtifact();
    unreleased.messageBus!.kernelEntryJournal!.capabilities = [];
    expect(kernelJournalDispositionsFromArtifact(unreleased)).toBeUndefined();
  });

  it.each([
    ['handler reorder', (artifact: Artifact) => artifact.messageBus!.kernelEntryJournal!
      .kernelJournalDispositions!.handlers.reverse()],
    ['bad completed digest', (artifact: Artifact) => {
      (artifact.messageBus!.kernelEntryJournal!.kernelJournalDispositions!.handlers[0] as any)
        .completedDescriptorDigest = '01';
    }],
    ['stream reorder', (artifact: Artifact) => artifact.messageBus!.kernelEntryJournal!
      .kernelJournalDispositions!.handlers[0]!.streams.reverse()],
    ['mode mismatch', (artifact: Artifact) => {
      (artifact.messageBus!.kernelEntryJournal!.kernelJournalDispositions!.handlers[0]!.streams[0] as any)
        .disposition = 'eager-journal';
    }],
    ['capability mismatch', (artifact: Artifact) => artifact.messageBus!.kernelEntryJournal!
      .capabilities![0]!.scopes!.reverse()],
    ['unknown envelope key', (artifact: Artifact) => {
      (artifact.messageBus!.kernelEntryJournal!.kernelJournalDispositions as any).trusted = true;
    }],
    ['missing bytecode commitment', (artifact: Artifact) => { artifact.bytecode = ''; }],
    ['substituted bytecode commitment', (artifact: Artifact) => {
      artifact.messageBus!.kernelEntryJournal!.kernelJournalDispositionCommitment!.digest = '77'.repeat(32);
    }],
    ['self-consistent public metadata without matching bytecode', (artifact: Artifact) => {
      artifact.messageBus!.kernelEntryJournal!.kernelJournalDispositions!.handlers[1]
        .completedDescriptorDigest = '88'.repeat(32);
      artifact.messageBus!.kernelEntryJournal!.kernelJournalDispositionCommitment!.digest
        = kernelJournalDispositionManifestDigest(
          artifact.messageBus!.kernelEntryJournal!.kernelJournalDispositions!,
        );
    }],
    ['duplicate bytecode commitment', (artifact: Artifact) => {
      artifact.bytecode += ` ${artifact.bytecode}`;
    }],
  ])('rejects hostile %s metadata', (_name, mutate) => {
    const artifact = dispositionArtifact();
    mutate(artifact);
    expect(() => kernelJournalDispositionsFromArtifact(artifact)).toThrow(/kernel journal disposition/);
  });

  it('plans an eager prefix only from explicitly selected eager stream provenance', () => {
    const manifest = dispositionManifest();
    const eager = batchHandler('22222222', [{ collection: 'ignored-by-disposition', journalAccessStreamIndex: 0 }]);
    const neutral = batchHandler('33333333');
    expect(planAuthenticatedKernelJournalDispositionChain(manifest, [eager, neutral], [{
      handlerSelector: '22222222', journalAccessStreamIndex: 0, collection: 'records', offset: 4,
    }, {
      handlerSelector: '22222222', journalAccessStreamIndex: 0, collection: 'other', offset: 1,
    }])).toEqual({
      deferRuntimeJournalMaterialization: false,
      eagerOutputPlan: [
        { eagerOutputOrdinal: 0, collection: 'records', offset: 4 },
        { eagerOutputOrdinal: 1, collection: 'other', offset: 1 },
      ],
    });
  });

  it('rejects mixed chain ownership and hostile eager output provenance', () => {
    const manifest = dispositionManifest();
    const carrier = batchHandler('11111111', [
      { collection: 'a', journalAccessStreamIndex: 0 },
      { collection: 'b', journalAccessStreamIndex: 1 },
    ]);
    const eager = batchHandler('22222222', [{ collection: 'c', journalAccessStreamIndex: 0 }]);
    expect(() => planAuthenticatedKernelJournalDispositionChain(manifest, [carrier, eager], []))
      .toThrow('mixes carrier and eager-journal dispositions');
    expect(() => planAuthenticatedKernelJournalDispositionChain(manifest, [eager], [{
      handlerSelector: '11111111', journalAccessStreamIndex: 0, collection: 'c', offset: 0,
    }])).toThrow('has no selected eager-journal stream');
    expect(() => planAuthenticatedKernelJournalDispositionChain(manifest, [eager], [{
      handlerSelector: '22222222', journalAccessStreamIndex: 0, collection: 'c', offset: 0,
    }, {
      handlerSelector: '22222222', journalAccessStreamIndex: 0, collection: 'c', offset: 0,
    }])).toThrow('repeats physical location c[0]');
  });
});
