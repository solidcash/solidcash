import { describe, expect, it } from 'vitest';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX,
  type Artifact,
  type ChildDeploymentSiteAbi,
} from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { SignatureTemplate } from '../../src/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { hasTransientConvergenceResultSeed } from '../../src/message-bus/compose-prepared-invocation.js';
import { valueChunkEffectDomainId } from '../../src/stateful/index.js';

// The wire carries token categories in internal (reversed) order; fixtures name them in display order.
const internalOrder = (hex: string): string => (hex.match(/../g) ?? []).reverse().join('');

const artifact = (selector: string, inputType = 'int'): Artifact => ({
  contractName: 'Participant',
  abi: [{ name: 'run', selector, inputs: [{ name: 'n', type: inputType }], outputs: [], modifiers: ['public'] }],
  structs: [],
  messageBus: {
    maximumRows: 1,
    atomicMessageBus: {
      protocolVersions: [1, 2, 3],
      messageEnvelope: {
        region: 'participant-verifiers', canonicalInput: 'final-participant-verifier', unlockingPush: 0,
      },
    },
    handlers: [{
      name: 'run', selector, inputs: [{ name: 'n', type: inputType }], outputs: [], eligible: true,
    }],
  },
  // Only policy fields are consumed by this pure planner fixture.
} as unknown as Artifact);

const lifecycleArtifact = (
  kind: 'split' | 'merge', protocolVersions: readonly (1 | 2 | 3 | 4)[] = [1, 2, 3],
): Artifact => {
  const selector = kind === 'split' ? '31313131' : '32323232';
  const fixedOne = { source: 'fixed' as const, value: 1 };
  const count = { source: 'parameter' as const, parameterIndex: 0, addend: 0 };
  const countPlusOne = { source: 'parameter' as const, parameterIndex: 0, addend: 1 };
  const preservedTokenAmount = kind === 'split' ? 'preserve' : 'nondecrease';
  const preserved = {
    lockingBytecode: 'participant' as const, tokenCategory: 'participant' as const,
    nftCapability: 'minting' as const, nftCommitment: 'preserve' as const,
    tokenAmount: preservedTokenAmount, satoshis: 'preserve' as const,
  };
  const consumed = {
    lockingBytecode: 'participant' as const, tokenCategory: 'participant' as const,
    nftCapability: 'minting' as const, nftCommitment: 'unconstrained' as const,
    tokenAmount: 'unconstrained' as const, satoshis: 'reclaim' as const,
  };
  const created = {
    lockingBytecode: 'participant' as const, tokenCategory: 'participant' as const,
    nftCapability: 'minting' as const, nftCommitment: 'empty' as const,
    tokenAmount: 'zero' as const, satoshis: 'funded' as const,
  };
  const lifecycleTopology = {
    version: 2 as const, kind, coordinate: 'participant' as const,
    categoryCensus: {
      tokenCategory: 'participant' as const, nftCapability: 'minting' as const,
      inputCount: kind === 'split' ? fixedOne : countPlusOne,
      outputCount: kind === 'split' ? countPlusOne : fixedOne,
    },
    inputSpans: kind === 'split'
      ? [{ mode: 'preserve' as const, offset: 0, count: fixedOne, identity: preserved }]
      : [{ mode: 'preserve' as const, offset: 0, count: fixedOne, identity: preserved },
        { mode: 'consume' as const, offset: 1, count, identity: consumed }],
    outputSpans: kind === 'split'
      ? [{ mode: 'preserve' as const, offset: 0, count: fixedOne, identity: preserved },
        { mode: 'create' as const, offset: 1, count, identity: created }]
      : [{ mode: 'preserve' as const, offset: 0, count: fixedOne, identity: preserved }],
  };
  const inputs = [{ name: 'count', type: 'int' }];
  return {
    contractName: 'LifecycleParticipant',
    abi: [{ name: kind, selector, inputs, outputs: [], modifiers: [kind] }],
    messageBus: {
      version: 1, selector: '53434231', maximumRows: 1, maximumBlobBytes: 256,
      atomicMessageBus: {
        domain: '4c33425553310000', protocolVersions,
        messageEnvelope: { region: 'participant-verifiers', canonicalInput: 'final-participant-verifier', unlockingPush: 0 },
        maximumParticipants: 8, maximumRows: 192,
      },
      verifierProgram: {
        verifyFunctionId: 1, inputCount: 1, inputs: [{ name: 'x', type: 'int' }], functions: [],
        lifecycle: true as const,
      },
      route: {
        name: '__message_bus1', selector: '53434231', inputs: [], outputs: [],
        blockLayout: { blockSize: 1, slots: [{ kind: 'master', offset: 0 }] },
      },
      handlers: [{ name: kind, selector, inputs, outputs: [], eligible: true, lifecycleTopology }],
    },
    invocationAnalysis: { version: 1, protocolVersions: [1], functions: [], components: [] },
  } as unknown as Artifact;
};

const plan = (): messageBus.CompiledGraphPlan => ({
  participants: [
    {
      participant: 0, artifact: artifact('11111111'), lockingBytecode: '51'.repeat(64), executionKind: 0,
      executorOffset: null, executorInputIndex: 0xffff, executorLockingBytecode: '',
      batch: {} as never, invocations: [0],
      blockLayout: { blockSize: 1, slots: [{ kind: 'master', offset: 0 }] },
      routeInputs: [], settlementBoundary: 2, completionPositions: [2],
    },
    {
      participant: 1, artifact: artifact('22222222'), lockingBytecode: '52'.repeat(64), executionKind: 0,
      executorOffset: null, executorInputIndex: 0xffff, executorLockingBytecode: '',
      batch: {} as never, invocations: [1],
      blockLayout: { blockSize: 1, slots: [{ kind: 'master', offset: 0 }] },
      routeInputs: [], settlementBoundary: 2, completionPositions: [2],
    },
  ],
  invocations: [
    {
      index: 0, parent: null, caller: null, callee: 0, subtreeEnd: 1, localRow: 0, depth: 0,
      function: 'run', selectorHex: '11111111', callMode: 'call', callOptions: 0,
      argsHex: '01', resultTypes: [], resultDependencies: [],
      producerPath: { status: 'complete', context: { version: 1, sourcePath: [] } },
      targetLockingBytecode: '51'.repeat(64), targetIdentityOffset: 0,
    },
    {
      index: 1, parent: 0, caller: 0, callee: 1, subtreeEnd: 1, localRow: 0, depth: 1,
      function: 'run', selectorHex: '22222222', callMode: 'staticcall', callOptions: 1,
      argsHex: '02', resultTypes: ['int'], consumerCallsiteId: 7, resultDependencies: [],
      producerPath: { status: 'unavailable' },
      targetLockingBytecode: '52'.repeat(64), targetIdentityOffset: 0,
    },
  ],
  rootCallerLockingBytecode: '53',
});

describe('atomic compiled invocation graph', () => {
  it('requires exact prepared producer identity and preserves it across result-dependent rebuilds', () => {
    const invocation = {
      ...plan().invocations[1],
      sourceCallsiteId: 11,
      sourceLogicalIndex: 2,
      occurrenceIndex: 3,
      sourceCallsiteProvenance: 'compiler' as const,
    };
    const base = {
      contract: {} as never,
      functionName: 'run',
      args: [0n],
      producerPath: { status: 'unavailable' as const },
    };
    expect(() => messageBus.assertPreparedInvocationIdentity(base, invocation, 1))
      .toThrow(/omits its physical callsite identity/);
    const descriptor = {
      ...base,
      callsiteId: 7,
      sourceCallsiteId: 11,
      sourceLogicalIndex: 2,
      occurrenceIndex: 3,
      batchLogicalIndex: 2,
      batchOccurrenceIndex: 3,
    };
    expect(() => messageBus.assertPreparedInvocationIdentity(descriptor, invocation, 1)).not.toThrow();
    expect(() => messageBus.assertPreparedInvocationIdentity({
      ...descriptor,
      batchOccurrenceIndex: 4,
    }, invocation, 1)).toThrow(/conflicting occurrence identities/);
    // Batched edges must not silently alias source identity from the physical lane or invent occurrence 0.
    expect(() => messageBus.assertPreparedInvocationIdentity({
      ...base,
      callsiteId: 7,
      sourceLogicalIndex: 2,
      occurrenceIndex: 3,
    }, invocation, 1)).toThrow(/omits its source callsite identity/);
    expect(() => messageBus.assertPreparedInvocationIdentity({
      ...base,
      callsiteId: 7,
      sourceCallsiteId: 11,
      sourceLogicalIndex: 2,
    }, invocation, 1)).toThrow(/omits its source occurrence/);
    expect(() => messageBus.assertPreparedInvocationIdentity({
      ...base,
      callsiteId: 7,
      sourceCallsiteId: 7,
      sourceLogicalIndex: 2,
      occurrenceIndex: 3,
    }, invocation, 1)).toThrow(/source callsite disagrees/);
    const rebuilt = messageBus.rebuildPreparedInvocation(descriptor, [1n], '01');
    expect(rebuilt).toMatchObject({
      callsiteId: 7,
      sourceCallsiteId: 11,
      sourceLogicalIndex: 2,
      occurrenceIndex: 3,
      batchLogicalIndex: 2,
      batchOccurrenceIndex: 3,
      args: [1n],
      provisionalResultCommitment: Uint8Array.of(1),
      producerPath: { status: 'unavailable' },
    });
    let productionRefreshes = 0;
    const siblingRefreshed = messageBus.rebuildPreparedInvocation({
      ...descriptor,
      resolveValueChunkProductionsFromArgs: () => {
        productionRefreshes += 1;
        return [];
      },
    }, descriptor.args, undefined, { refreshValueProductions: true });
    expect(productionRefreshes).toBe(1);
    expect(siblingRefreshed.args).toBe(descriptor.args);
    expect(() => messageBus.assertPreparedInvocationIdentity({
      ...descriptor,
      producerPath: { status: 'complete', context: { version: 1, sourcePath: [] } },
    }, invocation, 1)).toThrow(/producer path disagrees/);
    expect(() => messageBus.assertPreparedInvocationIdentity({
      ...base,
      producerPath: { status: 'complete', context: { version: 1, sourcePath: [] } },
    }, plan().invocations[0], 0)).not.toThrow();
    expect(() => messageBus.assertPreparedInvocationIdentity(base, plan().invocations[0], 0))
      .toThrow(/producer path disagrees/);
  });

  it('keeps a caller-prepared result strict and an SDK-learned result a provisional seed', () => {
    const descriptor = { contract: {} as never, functionName: 'run', args: [0n], callsiteId: 7 };
    const learned = messageBus.rebuildPreparedInvocation(descriptor, [1n], '01');
    expect(hasTransientConvergenceResultSeed(learned)).toBe(true);
    expect(messageBus.rebuildPreparedInvocation(learned, [1n], '03').provisionalResultCommitment)
      .toEqual(Uint8Array.of(3));
    // A caller's commitment survives a rebuild unchanged, so the composer compares it with the producer.
    const supplied = messageBus.rebuildPreparedInvocation(
      { ...descriptor, provisionalResultCommitment: Uint8Array.of(2) }, [1n], '01',
    );
    expect(supplied.provisionalResultCommitment).toEqual(Uint8Array.of(2));
    expect(hasTransientConvergenceResultSeed(supplied)).toBe(false);
    // Public entries drop the SDK mark; the SDK's own discovered graph marks every result it carries.
    const options = { preparedCalls: [descriptor, learned], funder: {} as never, changeAddress: '' };
    const second = (composition: messageBus.AtomicMessageBusComposition): messageBus.PreparedAtomicMessageBusCall => (
      composition as unknown as { options: { preparedCalls: readonly messageBus.PreparedAtomicMessageBusCall[] } }
    ).options.preparedCalls[1];
    expect(hasTransientConvergenceResultSeed(second(messageBus.compose(options)))).toBe(false);
    expect(hasTransientConvergenceResultSeed(second(new messageBus.AtomicMessageBusComposition(options))))
      .toBe(false);
    const discovered = second(messageBus.composeDiscoveredGraph({ ...options, preparedCalls: [descriptor, supplied] }));
    expect(hasTransientConvergenceResultSeed(discovered)).toBe(true);
    expect(discovered.provisionalResultCommitment).toEqual(Uint8Array.of(2));
  });

  it('does not authorize a computed chunk from a value-mismatched balanced dummy', () => {
    const input = {
      satoshis: 1200n,
      unlocker: {
        generateLockingBytecode: () => Uint8Array.from(Buffer.from(
          BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX, 'hex',
        )),
      },
    } as never;
    const output = {
      amount: 1199n,
      token: {
        category: 'aa'.repeat(31) + '55', amount: 0n,
        nft: { capability: 'mutable' as const, commitment: '0000' },
      },
    };
    expect(messageBus.canSeedComputedValueChunkClaim(input, output, {
      tokenCategory: 'aa'.repeat(31) + '55', commitment: '0000',
    })).toBe(false);
    expect(messageBus.canSeedComputedValueChunkClaim(input, { ...output, amount: 1200n }, {
      tokenCategory: 'aa'.repeat(31) + '55', commitment: '0000',
    })).toBe(true);
  });

  it('authorizes a transported continuation slot from a balanced dummy or a predecessor chunk', () => {
    const category = 'ab'.repeat(31) + '54';
    const dummy = {
      unlocker: {
        generateLockingBytecode: () => Uint8Array.from(Buffer.from(
          BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX, 'hex',
        )),
      },
    } as never;
    const predecessor = (index: number, tokenCategory = category): never => ({
      token: {
        category: tokenCategory,
        amount: 0n,
        nft: { capability: 'mutable' as const, commitment: `${index.toString(16).padStart(2, '0')}00aabb` },
      },
      unlocker: { generateLockingBytecode: () => Uint8Array.from([0xaa, 0x20]) },
    }) as never;
    const claim = { categoryId: category, commitment: '0200ccdd' };

    expect(messageBus.canOwnTransportedContinuationSlot(undefined, claim)).toBe(false);
    expect(messageBus.canOwnTransportedContinuationSlot(dummy, claim)).toBe(true);
    // A wider continuation shifts the transported band, so a slot's predecessor need not carry the same index.
    expect(messageBus.canOwnTransportedContinuationSlot(predecessor(0), claim)).toBe(true);
    expect(messageBus.canOwnTransportedContinuationSlot(predecessor(2), claim)).toBe(true);
    expect(messageBus.canOwnTransportedContinuationSlot(predecessor(0, 'cd'.repeat(32)), claim)).toBe(false);
    expect(messageBus.canOwnTransportedContinuationSlot({
      token: {
        category,
        amount: 0n,
        nft: { capability: 'none' as const, commitment: '0000aabb' },
      },
      unlocker: { generateLockingBytecode: () => Uint8Array.from([0xaa, 0x20]) },
    } as never, claim)).toBe(false);
    expect(messageBus.canOwnTransportedContinuationSlot(predecessor(0), {
      categoryId: category, commitment: 'ccdd',
    })).toBe(false);
  });

  it('keeps compiler-owned computed chunks inside the compact participant span', () => {
    const resourceA = `${'11'.repeat(32)}:${'22'.repeat(20)}:${'33'.repeat(32)}`;
    const resourceB = `${'44'.repeat(32)}:${'55'.repeat(20)}:${'66'.repeat(32)}`;
    const claims = [
      { offset: 18, resourceIdentity: resourceA, resourcePart: 'chunk:0' },
      { offset: 19, resourceIdentity: resourceA, resourcePart: 'chunk:1' },
    ];
    const actualSize = messageBus.minimumActualSizeForComputedValueChunkClaims(1, 8, 8, 72, claims);
    expect(actualSize).toBe(12);
    // A fixed participant suffix disables compaction at the caller, but chunk claims still belong to the
    // compiler-published trailing band rather than an empty range beginning at the full block size.
    expect(messageBus.minimumActualSizeForComputedValueChunkClaims(
      1, 8, 40, 106, [{ offset: 110, resourceIdentity: resourceA, resourcePart: 'chunk:0' }],
    )).toBe(103);
    expect(messageBus.atomicMessageBusPhysicalLayout([8, actualSize, 5])).toMatchObject({
      participantInputs: [0, 8, 20],
      verifierInputs: [25, 26, 27],
      verifierInput: 27,
      feeInput: 28,
      totalSlots: 29,
    });
    expect(messageBus.minimumActualSizeForComputedValueChunkClaims(
      1, 8, 8, 72, [{ offset: 79 }],
    )).toBe(8);
    expect(() => messageBus.minimumActualSizeForComputedValueChunkClaims(
      1, 8, 8, 72, [{ offset: 15, resourceIdentity: resourceA, resourcePart: 'chunk:0' }],
    )).toThrow(/outside its published trailing range/);
    expect(() => messageBus.minimumActualSizeForComputedValueChunkClaims(
      1, 8, 8, 72, [{ offset: 80, resourceIdentity: resourceA, resourcePart: 'chunk:0' }],
    )).toThrow(/outside its published trailing range/);
    expect(() => messageBus.minimumActualSizeForComputedValueChunkClaims(
      1, 8, 8, 72, [{ offset: 18, resourceIdentity: resourceA, resourcePart: 'chunk:x' }],
    )).toThrow(/non-canonical resource part/);
    expect(() => messageBus.minimumActualSizeForComputedValueChunkClaims(1, 8, 8, 72, [
      ...claims,
      { offset: 20, resourceIdentity: resourceA, resourcePart: 'chunk:1' },
    ])).toThrow(/moves chunk:1/);
    expect(() => messageBus.minimumActualSizeForComputedValueChunkClaims(1, 8, 8, 72, [
      claims[0],
      { offset: 18, resourceIdentity: resourceB, resourcePart: 'chunk:0' },
    ])).toThrow(/claimed by both/);
    expect(() => messageBus.minimumActualSizeForComputedValueChunkClaims(
      1, 8, 8, 72, [{ offset: 19, resourceIdentity: resourceA, resourcePart: 'chunk:1' }],
    )).toThrow(/omits chunk:0/);
    expect(() => messageBus.minimumActualSizeForComputedValueChunkClaims(
      1, 8, 8, 72, [{ offset: 18, resourceIdentity: 'resource-a', resourcePart: 'chunk:0' }],
    )).toThrow(/non-canonical computed value-chunk resource identity/);
  });

  it('keeps compiler span geometry when a local row observes the same chunk elsewhere', () => {
    const resource = `${'11'.repeat(32)}:${'22'.repeat(20)}:${'33'.repeat(32)}`;
    const merged = messageBus.mergeComputedValueChunkSpanClaims([
      { offset: 18, resourceIdentity: resource, resourcePart: 'chunk:0' },
      { offset: 19, resourceIdentity: resource, resourcePart: 'chunk:1' },
    ], [
      { offset: 20, resourceIdentity: resource, resourcePart: 'chunk:0' },
    ]);
    expect(merged.map((claim) => claim.offset)).toEqual([18, 19]);
    expect(messageBus.minimumActualSizeForComputedValueChunkClaims(1, 8, 8, 72, merged)).toBe(12);

    const ambiguous = messageBus.mergeComputedValueChunkSpanClaims([
      { offset: 18, resourceIdentity: resource, resourcePart: 'chunk:0' },
    ], [
      { offset: 20, resourceIdentity: resource, resourcePart: 'chunk:0' },
      { offset: 22, resourceIdentity: resource, resourcePart: 'chunk:0' },
    ]);
    expect(() => messageBus.minimumActualSizeForComputedValueChunkClaims(
      1, 8, 8, 72, ambiguous,
    )).toThrow(/moves chunk:0/);
  });

  it('derives route batch trailing cardinality from physical predecessor outputs', () => {
    const inputs = [
      { name: '__internal__vmapBatchPredOut_0' },
      { name: '__internal__vmapBatchPredOut_1' },
      { name: '__internal__vmapBatchPredOut_2' },
      { name: '__internal__vmapBatchTrailingCount' },
    ];
    expect(messageBus.physicalVmapBatchTrailingCount(inputs, [-1n, -2n, -1n, 1n])).toBe(0n);
    expect(messageBus.physicalVmapBatchTrailingCount(inputs, [40n, 40n, 41n, 0n])).toBe(2n);
    expect(messageBus.physicalVmapBatchTrailingCount(
      inputs.slice(0, 3), [40n, -1n, 41n],
    )).toBeUndefined();
  });

  it('applies every changed semantic class in one complete observation pass', () => {
    const applied: string[] = [];
    expect(messageBus.applySemanticClaimObservationPass([
      { previous: [], observed: ['resource'], apply: () => applied.push('resource') },
      { previous: [], observed: ['value'], apply: () => applied.push('value') },
      { previous: [], observed: ['token'], apply: () => applied.push('token') },
    ])).toBe(true);
    expect(applied).toEqual(['resource', 'value', 'token']);
  });

  it('interns content-identical artifact instances for distinct graph edges to one owner', () => {
    const leafArtifact = compileString(`contract SharedOwner() {
      event Touched(int value);
      int stored;
      function touchA() public { this.stored = 1; emit Touched(1); require(true); }
      function touchB() public { this.stored = 2; emit Touched(2); require(true); }
    }`, { forceStateful: true, messageBus: true, messageBusKernel: true });
    const rootArtifact = compileString(`interface ISharedOwner {
      function touchA() external;
      function touchB() external;
    }
    contract DistinctCallsites() {
      function run(address targetA, address targetB) public {
        ISharedOwner(targetA).touchA();
        ISharedOwner(targetB).touchB();
        require(true);
      }
    }`, { forceStateful: true, messageBus: true, messageBusKernel: true });
    const callsites = rootArtifact.abi.find((candidate) => candidate.name === 'run')?.externalCalls ?? [];
    expect(callsites).toHaveLength(2);

    const planned = messageBus.deriveCompiledGraphPlan({
      root: { artifact: rootArtifact, lockingBytecode: '51' },
      function: 'run',
      args: [Uint8Array.of(0x52), Uint8Array.of(0x52)],
      targets: {},
      // Proxy implementation accessors may deserialize a fresh, content-identical publication for each edge.
      target: () => ({ artifact: structuredClone(leafArtifact), lockingBytecode: '52' }),
    });

    expect(planned.participants).toHaveLength(2);
    expect(planned.invocations.map((invocation) => invocation.consumerCallsiteId))
      .toEqual([undefined, ...callsites.map((callsite) => callsite.callsiteId)]);
    expect(planned.invocations[0].producerPath).toEqual({
      status: 'complete', context: { version: 1, sourcePath: [] },
    });
    expect(Object.isFrozen(planned.invocations[0].producerPath)).toBe(true);
    for (const [index, callsite] of callsites.entries()) {
      const path = planned.invocations[index + 1].producerPath;
      expect(path.status).toBe('complete');
      if (path.status !== 'complete') continue;
      expect(path.context.sourcePath).toEqual([{
        sourceEffectDomainId: valueChunkEffectDomainId(
          '51', rootArtifact.abi.find((candidate) => candidate.name === 'run')!.selector!,
        ),
        sourceCallsiteId: callsite.sourceCallsiteId ?? callsite.callsiteId,
        occurrenceIndex: 0,
        sourceEffectOrdinal: callsite.sourceEffectOrdinal,
      }]);
    }
    expect(planned.invocations[1].producerPath).not.toEqual(planned.invocations[2].producerPath);
  });

  it('builds hierarchical producer paths and marks incomplete compiler provenance unavailable', () => {
    const leaf = compileString(`contract PathLeaf() {
      function touch() public { require(true); }
    }`, { forceStateful: true, messageBus: true, messageBusKernel: true });
    const middle = compileString(`interface IPathLeaf { function touch() external; }
    contract PathMiddle() {
      function descend(address leaf) public { IPathLeaf(leaf).touch(); require(true); }
    }`, { forceStateful: true, messageBus: true, messageBusKernel: true });
    const root = compileString(`interface IPathMiddle { function descend(address leaf) external; }
    contract PathRoot() {
      function run(address middle, address leaf) public {
        IPathMiddle(middle).descend(leaf); require(true);
      }
    }`, { forceStateful: true, messageBus: true, messageBusKernel: true });
    const planned = messageBus.deriveCompiledGraphPlan({
      root: { artifact: root, lockingBytecode: '51' },
      function: 'run', args: [Uint8Array.of(0x52), Uint8Array.of(0x53)],
      targets: {
        IPathMiddle: { artifact: middle, lockingBytecode: '52' },
        IPathLeaf: { artifact: leaf, lockingBytecode: '53' },
      },
    });
    expect(planned.invocations).toHaveLength(3);
    expect(planned.invocations.map((invocation) => invocation.producerPath.status))
      .toEqual(['complete', 'complete', 'complete']);
    const child = planned.invocations[1].producerPath;
    const grandchild = planned.invocations[2].producerPath;
    expect(child.status === 'complete' && child.context.sourcePath).toHaveLength(1);
    expect(grandchild.status === 'complete' && grandchild.context.sourcePath).toHaveLength(2);
    if (child.status === 'complete' && grandchild.status === 'complete') {
      expect(grandchild.context.sourcePath[0]).toEqual(child.context.sourcePath[0]);
    }

    const incomplete = structuredClone(root);
    const run = incomplete.abi.find((candidate) => candidate.selector
      === root.abi.find((runCandidate) => runCandidate.name === 'run')?.selector)!;
    delete run.externalCalls?.[0].sourceEffectOrdinal;
    const fenced = messageBus.deriveCompiledGraphPlan({
      root: { artifact: incomplete, lockingBytecode: '51' },
      function: 'run', args: [Uint8Array.of(0x52), Uint8Array.of(0x53)],
      targets: {
        IPathMiddle: { artifact: middle, lockingBytecode: '52' },
        IPathLeaf: { artifact: leaf, lockingBytecode: '53' },
      },
    });
    expect(fenced.invocations[1].producerPath).toEqual({ status: 'unavailable' });
    expect(fenced.invocations[2].producerPath).toEqual({ status: 'unavailable' });
    expect(Object.isFrozen(fenced.invocations[1].producerPath)).toBe(true);
    expect(fenced.invocations[1].producerPath).toBe(fenced.invocations[2].producerPath);
  });

  it('plans a resource-free split row once the verifier advertises selector-derived lifecycle authority', () => {
    const compiled = compileString(`contract LifecycleProtocolBoundary() {
      function divide(int count) public split(count) {
        require(count > 0);
      }
      function control() public { require(true); }
    }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
    });
    expect(compiled.messageBus?.handlers.find((handler) => handler.name === 'divide')).toMatchObject({
      eligible: true,
      lifecycleTopology: { kind: 'split' },
    });
    expect(compiled.messageBus?.verifierProgram?.lifecycle).toBe(true);
    const planned = messageBus.planCompiledGraph([
      { artifact: compiled, lockingBytecode: '51'.repeat(64) },
    ], [{ parent: null, callee: 0, function: 'divide', args: [2n] }]);
    expect(planned.participants[0].lifecycle).toMatchObject({
      kind: 'split', count: 2, balancedSpan: 3,
    });
  });

  it('cannot plan compiler-fenced lifecycle rows carrying detached signature leaves', () => {
    const compiled = compileString(`contract LifecycleSignatureBoundary() {
      struct Authorization { sig proof; int nonce; }
      function divide(int count, Authorization auth) public split(count) {
        require(auth.nonce >= 0 && count > 0);
      }
      function control() public { require(true); }
    }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
    });
    expect(compiled.messageBus?.handlers.find((handler) => handler.name === 'divide')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_TX_SIGNATURE',
      lifecycleTopology: { kind: 'split' },
    });
    expect(compiled.messageBus?.route.inputs.some((input) => input.name.includes('__message_bus_sig_')))
      .toBe(false);
    expect(() => messageBus.planCompiledGraph([
      { artifact: compiled, lockingBytecode: '51'.repeat(64) },
    ], [{ parent: null, callee: 0, function: 'divide', args: [2n, { proof: '00', nonce: 0n }] }]))
      .toThrow(/lifecycle participant .* does not advertise selector-derived authority|not message-bus eligible/);
  });

  it('derives lifecycle wire geometry from metadata and invocation args, never a caller transcript', () => {
    expect(messageBus.atomicParticipantPolicyHash(lifecycleArtifact('split')))
      .not.toBe(messageBus.atomicParticipantPolicyHash(lifecycleArtifact('merge')));
    for (const kind of ['split', 'merge'] as const) {
      const participant = { artifact: lifecycleArtifact(kind), lockingBytecode: '51' };
      const invocation = {
        parent: null, callee: 0, function: kind, args: [2n],
        lifecycle: { kind: kind === 'split' ? 'merge' : 'split', count: 19 },
      } as messageBus.CompiledGraphInvocation & { lifecycle: unknown };
      const planned = messageBus.planCompiledGraph([participant], [invocation]);
      expect(planned.participants[0].lifecycle).toEqual(kind === 'split'
        ? {
          version: 1, kind, count: 2, inputSpan: 1, outputSpan: 3, balancedSpan: 3,
          inputTail: 'funding', outputTail: 'created-masters',
        }
        : {
          version: 1, kind, count: 2, inputSpan: 3, outputSpan: 1, balancedSpan: 3,
          inputTail: 'consumed-masters', outputTail: 'reclaim',
        });
    }
    const unsupported = lifecycleArtifact('split');
    delete unsupported.messageBus!.verifierProgram!.lifecycle;
    expect(() => messageBus.planCompiledGraph([
      { artifact: unsupported, lockingBytecode: '51' },
    ], [{ parent: null, callee: 0, function: 'split', args: [2n] }]))
      .toThrow(/selector-derived authority/);
    expect(() => messageBus.planCompiledGraph([
      { artifact: lifecycleArtifact('split'), lockingBytecode: '51' },
    ], [{ parent: null, callee: 0, function: 'split', args: [0n] }]))
      .toThrow(/positive safe integer/);

    const derived = messageBus.planCompiledGraph([
      { artifact: lifecycleArtifact('split'), lockingBytecode: '51'.repeat(64) },
    ], [{ parent: null, callee: 0, function: 'split', args: [2n] }]);
    const ordinary = plan();
    const combined: messageBus.CompiledGraphPlan = {
      ...ordinary,
      participants: [
        { ...derived.participants[0], invocations: [0], settlementBoundary: 2, completionPositions: [2] },
        ordinary.participants[1],
      ],
    };
    const finalized = messageBus.finalizeAtomicInvocationGraph(
      combined, ['11'.repeat(32), '22'.repeat(32)], { 1: '2a' },
    );
    expect(finalized.callManifest.version).toBeUndefined();
    expect(finalized.callManifest.participants[0]).toMatchObject({
      fixedSize: 1, actualSize: 3, maximumSize: 3, trailingUsed: 2,
    });
    expect(finalized.callManifest.participants[0]).not.toHaveProperty('lifecycle');
    expect(messageBus.encodeAtomicMessageBusCallManifest(finalized.callManifest).slice(0, 8))
      .toEqual(messageBus.encodeAtomicMessageBusCallManifest({
        ...finalized.callManifest, version: 1,
      }).slice(0, 8));
    expect(finalized.layout.participantInputs).toEqual([0, 3]);
  });

  it('derives V4 signature provenance from handler policy and refuses row or protocol drift', () => {
    const base = plan();
    const v4Artifact = (source: Artifact, signed: boolean): Artifact => ({
      ...source,
      messageBus: {
        ...source.messageBus!,
        atomicMessageBus: { ...source.messageBus!.atomicMessageBus!, protocolVersions: [1, 2, 3, 4] },
        handlers: source.messageBus!.handlers.map((handler) => signed ? {
          ...handler, usesTransactionSignature: true, signatureBytecode: '51',
          transactionSignaturePolicy: { hashType: 'all' as const, parameterIndices: [0] },
          inputs: [{ name: 'proof', type: 'sig' }],
        } : handler),
      },
      abi: signed ? [{
        name: 'run', selector: source.abi[0].selector, inputs: [{ name: 'proof', type: 'sig' }],
        outputs: [], modifiers: ['public'],
      }] : source.abi,
    });
    const firstArtifact = v4Artifact(base.participants[0].artifact, true);
    const secondArtifact = v4Artifact(base.participants[1].artifact, false);
    const signatureFrame = messageBus.messageBusTransactionSignatureFrameHex(firstArtifact, 'run', '11111111');
    const signedPlan: messageBus.CompiledGraphPlan = {
      ...base,
      participants: base.participants.map((participant, index) => ({
        ...participant,
        artifact: index === 0 ? firstArtifact : secondArtifact,
        batch: {
          blob: new Uint8Array(), routeWitnesses: [], rowCount: 1, results: [],
          rows: [{
            row: 0, function: 'run', selectorHex: index === 0 ? '11111111' : '22222222',
            argsHex: index === 0 ? '01' : '02',
            transactionSignatureFrameHex: index === 0 ? signatureFrame : '',
          }],
        },
      })),
    };
    const finalized = messageBus.finalizeAtomicInvocationGraph(
      signedPlan, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    );
    expect(finalized.callManifest.version).toBe(4);
    expect(finalized.callManifest.rows[0].transactionSignatureFrameHex).toBe(signatureFrame);
    expect(finalized.callManifest.rows[1].transactionSignatureFrameHex).toBeUndefined();

    const changedPolicy = structuredClone(firstArtifact);
    changedPolicy.messageBus!.handlers[0].signatureBytecode = '52';
    expect(messageBus.atomicParticipantPolicyHash(changedPolicy))
      .not.toBe(messageBus.atomicParticipantPolicyHash(firstArtifact));

    const misaligned = structuredClone(signedPlan);
    misaligned.participants[0].batch.rows[0].argsHex = '02';
    expect(() => messageBus.finalizeAtomicInvocationGraph(
      misaligned, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    )).toThrow(/provenance is not aligned/);
    const forged = structuredClone(signedPlan);
    forged.participants[0].batch.rows[0].transactionSignatureFrameHex =
      `${signatureFrame.slice(0, -2)}${signatureFrame.endsWith('00') ? '01' : '00'}`;
    expect(() => messageBus.finalizeAtomicInvocationGraph(
      forged, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    )).toThrow(/provenance disagrees with compiler policy/);
    const legacyPeer = structuredClone(signedPlan);
    legacyPeer.participants[1].artifact.messageBus!.atomicMessageBus!.protocolVersions = [1, 2, 3];
    expect(() => messageBus.finalizeAtomicInvocationGraph(
      legacyPeer, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    )).toThrow(/protocol 4/);

    // Resource-free lifecycle may share a V4 manifest with KTS siblings: the V4 participant suffix stays
    // neutral (mode=0,count=0) while selector-derived authority authenticates split/merge/selfdestruct.
    // End-to-end coverage lives in KernelLifecycleV4SignatureCompose; the previous early refuse is gone.
    const lifecycleV4 = messageBus.planCompiledGraph([
      { artifact: lifecycleArtifact('split', [1, 2, 4]), lockingBytecode: '51'.repeat(64) },
    ], [{ parent: null, callee: 0, function: 'split', args: [2n] }]);
    expect(lifecycleV4.participants[0].lifecycle?.kind).toBe('split');
    expect(lifecycleV4.participants[0].artifact.messageBus?.atomicMessageBus?.protocolVersions)
      .toEqual(expect.arrayContaining([4]));
  });

  it('commits a streamed handler\'s event schemas to the participant policy', () => {
    // A streamed handler publishes no `emits`; its runtime stream names the events it settles.
    const streamed = (eventSignatures: string[]): Artifact => {
      const base = artifact('11111111');
      return {
        ...base,
        messageBus: {
          ...base.messageBus!,
          handlers: base.messageBus!.handlers.map((handler) => ({
            ...handler, runtimeLoopEvents: [{ repeatCount: 1, eventSignatures, stream: true as const }],
          })),
        },
      };
    };
    expect(messageBus.atomicParticipantPolicyHash(streamed(['A(int256)'])))
      .not.toBe(messageBus.atomicParticipantPolicyHash(streamed(['B(int256)'])));
  });

  it('projects forwarded and constructed signature arrays out of child invocation bytes', () => {
    const leafArtifact = compileString(`contract SignatureArrayLeaf() {
      function authorize(sig[] proofs, pubkey[] authorities, int amount) public {
        require(checkMultiSig(proofs, authorities));
      }
    }`, { forceStateful: true, messageBus: true, messageBusKernel: true });
    const rootArtifact = compileString(`interface ISignatureArrayLeaf {
      function authorize(sig[] proofs, pubkey[] authorities, int amount);
    }
    contract SignatureArrayRoot(address target) {
      function forward(sig[] proofs, pubkey[] authorities, int amount) public {
        ISignatureArrayLeaf(target).authorize(proofs, authorities, amount);
        require(true);
      }
      function construct(sig first, sig second, pubkey[] authorities, int amount) public {
        ISignatureArrayLeaf(target).authorize([first, second], authorities, amount);
        require(true);
      }
    }`, { forceStateful: true, messageBus: true, messageBusKernel: true });
    const leaf = { artifact: leafArtifact, lockingBytecode: '52' };
    const root = {
      artifact: rootArtifact, lockingBytecode: '51', constructorArgs: [Uint8Array.of(0x52)],
    };
    const proofs = [
      new SignatureTemplate(new Uint8Array(32).fill(1)),
      new SignatureTemplate(new Uint8Array(32).fill(2)),
    ];
    const authorities = [new Uint8Array(33).fill(3), new Uint8Array(33).fill(4)];
    const derive = (
      functionName: 'forward' | 'construct',
    ): ReturnType<typeof messageBus.deriveCompiledGraphPlan> => messageBus.deriveCompiledGraphPlan({
      root,
      function: functionName,
      args: functionName === 'forward'
        ? [proofs, authorities, 7n]
        : [proofs[0], proofs[1], authorities, 7n],
      targets: {},
      target: () => leaf,
      expressionArgument: ({ argument }) => argument === 0 ? proofs : undefined,
    });
    const forwarded = derive('forward');
    const constructed = derive('construct');
    expect(forwarded.invocations.map((invocation) => invocation.function))
      .toEqual(['forward', 'authorize']);
    expect(constructed.invocations.map((invocation) => invocation.function))
      .toEqual(['construct', 'authorize']);
    expect(forwarded.invocations[1].argsHex).toBe(constructed.invocations[1].argsHex);
    expect(forwarded.participants[1].batch.routeWitnesses[0]).toEqual([proofs]);
    expect(constructed.participants[1].batch.routeWitnesses[0]).toEqual([proofs]);
  });

  it('retains an exact overload selector and refuses ambiguity or mismatch', () => {
    const overloaded = compileString(`pragma solidcash >=0.8.0;
      contract OverloadedGraph() {
        int stored;
        function apply(int next) public { this.stored = next; require(true); }
        function apply(bool enabled) public {
          if (enabled) { this.stored = 1; } else { this.stored = 0; }
          require(true);
        }
      }`, { forceStateful: true, messageBus: true });
    const selected = overloaded.abi.find((candidate) =>
      candidate.name === 'apply' && candidate.inputs[0]?.type === 'bool')!;
    const participant = { artifact: overloaded, lockingBytecode: '51' };
    const exact = messageBus.planCompiledGraph([participant], [{
      parent: null, callee: 0, function: 'apply', selector: selected.selector, args: [true],
    }]);
    expect(exact.invocations[0].selectorHex).toBe(selected.selector);
    expect(exact.participants[0].batch.rows[0].selectorHex).toBe(selected.selector);
    const derived = messageBus.deriveCompiledGraphPlan({
      root: participant,
      function: 'apply',
      selector: selected.selector,
      args: [true],
      targets: {},
    });
    expect(derived.invocations[0].selectorHex).toBe(selected.selector);

    const rootInputs: { name: string; type: string }[] = [];
    const root = {
      artifact: {
        contractName: 'SelectorRoot',
        abi: [{
          name: 'run', selector: '11111111', inputs: rootInputs, outputs: [],
          externalCalls: [{
            callsiteId: 1, interfaceName: 'IOverloaded', functionName: 'apply',
            requiredDataNftIndices: [],
            argSources: [{ kind: 'literal' as const, type: 'bool', value: 'true' }],
          }],
        }],
        messageBus: {
          version: 1, selector: '53434231', maximumRows: 2, maximumBlobBytes: 256,
          route: {
            name: '__message_bus1', selector: '53434231', inputs: [], outputs: [],
            blockLayout: { blockSize: 1, slots: [{ kind: 'master', offset: 0 }] },
          },
          handlers: [{ name: 'run', selector: '11111111', inputs: rootInputs, outputs: [], eligible: true }],
        },
        invocationAnalysis: { version: 1, protocolVersions: [1], functions: [], components: [] },
      } as unknown as Artifact,
      lockingBytecode: '52',
    };
    const target = { participant, selector: selected.selector };
    const nested = messageBus.deriveCompiledGraphPlan({
      root, function: 'run', targets: {}, target: () => target,
    });
    expect(nested.invocations.map((invocation) => invocation.selectorHex))
      .toEqual(['11111111', selected.selector]);
    expect(() => messageBus.deriveCompiledGraphPlan({
      root, function: 'run', targets: {}, target: () => participant,
    })).toThrow(/distinct ABI functions/);
    expect(() => messageBus.planCompiledGraph([participant], [{
      parent: null, callee: 0, function: 'apply', args: [true],
    }])).toThrow(/distinct ABI functions/);
    expect(() => messageBus.planCompiledGraph([participant], [{
      parent: null, callee: 0, function: 'apply', selector: 'ffffffff', args: [true],
    }])).toThrow(/does not identify ABI function 'apply'/);
  });

  it('uses one state-owner identity for a delegated outgoing raw edge', () => {
    const capability = (
      name: string,
      selector: string,
      inputs: { name: string; type: string }[],
      delegated = false,
    ): NonNullable<Artifact['messageBus']> => ({
      version: 1 as const,
      selector: '53434231' as const,
      maximumRows: 2,
      maximumBlobBytes: 256,
      route: {
        name: '__message_bus1', selector: '53434231', inputs: [], outputs: [],
        blockLayout: delegated
          ? {
            blockSize: 2,
            slots: [
              { kind: 'master' as const, offset: 0 },
              { kind: 'lowLevelCall' as const, offset: 1 },
            ],
          }
          : { blockSize: 1, slots: [{ kind: 'master' as const, offset: 0 }] },
      },
      handlers: [{ name, selector, inputs, outputs: [], eligible: true }],
    });
    const approveInputs = [{ name: 'owner', type: 'address' }];
    const targetArtifact = {
      contractName: 'Target',
      abi: [{
        name: 'approve', selector: '01020304', inputs: approveInputs, outputs: [],
      }],
      messageBus: capability('approve', '01020304', approveInputs),
      invocationAnalysis: { version: 1, protocolVersions: [1], functions: [], components: [] },
    } as unknown as Artifact;
    const target = {
      artifact: targetArtifact,
      lockingBytecode: '51',
      // Lookup/public identity is deliberately different: the source-level address proof must bind the
      // physical participant that actually executes, not this SDK identity alias.
      logicalLockingBytecode: '55',
    };
    const payload = Uint8Array.of(0x01, 0x02, 0x03, 0x04, 0x51);
    const runInputs = [{ name: 'target', type: 'address' }, { name: 'payload', type: 'bytes' }];
    const root = {
      artifact: {
        contractName: 'Root',
        abi: [{
          name: 'run', selector: '11111111',
          inputs: runInputs, outputs: [],
          externalCalls: [{
            callsiteId: 1, occurrence: 'conditional', maximumOccurrences: 1,
            interfaceName: '__raw__', functionName: '__raw__', rawSelector: '01020304',
            rawArgSources: [{ kind: 'selfAddress' }],
            addressParam: 'target', argSources: [{ kind: 'forward', paramIndex: 1 }],
          }],
        }],
        messageBus: capability('run', '11111111', runInputs, true),
        invocationAnalysis: { version: 1, protocolVersions: [1], functions: [], components: [] },
      } as unknown as Artifact,
      lockingBytecode: '52',
      logicalLockingBytecode: '54',
      executionKind: 'delegate' as const,
      executorLockingBytecode: '56',
    };
    const derive = (count: number): ReturnType<typeof messageBus.deriveCompiledGraphPlan> => (
      messageBus.deriveCompiledGraphPlan({
        root,
        function: 'run',
        args: [Uint8Array.of(0x51), payload],
        targets: {},
        occurrence: () => count,
        // The root owns state at 0x52 and publishes logical identity 0x54, while its handler executes at the
        // authenticated delegate input 0x56. An outgoing CALL uses the state owner for both address(this) and the
        // nested callee's msg.sender; the executor remains a separate code/resource identity.
        dynamicCall: () => ({ participant: target, function: 'approve', args: [Uint8Array.of(0x52)] }),
      })
    );
    expect(derive(0).invocations.map((invocation) => invocation.function)).toEqual(['run']);
    const reached = derive(1);
    expect(reached.invocations.map((invocation) => invocation.function)).toEqual(['run', 'approve']);
    expect(reached.invocations[1].argsHex).toBe('0152');
    const nestedCaller = messageBus.graphInvocationCallerIdentity(
      reached.participants, reached.invocations, reached.invocations[1],
    );
    expect(nestedCaller).toMatchObject({
      lockingBytecode: '52', offset: 0, role: 'owner',
    });
    expect(reached.invocations[1].argsHex)
      .toBe(`01${nestedCaller.lockingBytecode}`);
  });

  it('preserves exact identities for omitted conditional siblings calling the same method', () => {
    const capability = (
      name: string, selector: string, inputs: { name: string; type: string }[],
    ): NonNullable<Artifact['messageBus']> => ({
      version: 1 as const,
      selector: '53434231' as const,
      maximumRows: 3,
      maximumBlobBytes: 256,
      route: {
        name: '__message_bus1', selector: '53434231', inputs: [], outputs: [],
        blockLayout: { blockSize: 1, slots: [{ kind: 'master' as const, offset: 0 }] },
      },
      handlers: [{ name, selector, inputs, outputs: [], eligible: true }],
    });
    const pingInputs = [{ name: 'value', type: 'int' }];
    const sink = {
      artifact: {
        contractName: 'RepeatedConditionalSink',
        abi: [{ name: 'ping', selector: '01020304', inputs: pingInputs, outputs: [] }],
        messageBus: capability('ping', '01020304', pingInputs),
        invocationAnalysis: { version: 1, protocolVersions: [1], functions: [], components: [] },
      } as unknown as Artifact,
      lockingBytecode: '51',
      logicalLockingBytecode: '53',
    };
    const root = {
      artifact: {
        contractName: 'RepeatedConditionalRoot',
        abi: [{
          name: 'run', selector: '11111111', inputs: [], outputs: [],
          externalCalls: [1, 2, 3].map((callsiteId) => ({
            callsiteId, occurrence: 'conditional' as const, maximumOccurrences: 1,
            interfaceName: 'ISink', functionName: 'ping',
            argSources: [{ kind: 'literal' as const, type: 'int', value: String(callsiteId) }],
          })),
        }],
        messageBus: capability('run', '11111111', []),
        invocationAnalysis: { version: 1, protocolVersions: [1], functions: [], components: [] },
      } as unknown as Artifact,
      lockingBytecode: '52',
    };
    const planned = messageBus.deriveCompiledGraphPlan({
      root,
      function: 'run',
      targets: {},
      target: () => ({ participant: sink, targetLockingBytecode: '51' }),
      occurrence: ({ callsiteId }) => callsiteId === 2 ? 1 : 0,
    });
    expect(planned.invocations.map((invocation) => ({
      function: invocation.function,
      callsiteId: invocation.consumerCallsiteId,
      target: invocation.targetLockingBytecode,
    }))).toEqual([
      { function: 'run', callsiteId: undefined, target: '52' },
      { function: 'ping', callsiteId: 2, target: '51' },
    ]);
  });

  it('expands fixed and runtime-loop rows from one collapsed callsite', () => {
    const capability = (
      name: string, selector: string, inputs: { name: string; type: string }[],
    ): NonNullable<Artifact['messageBus']> => ({
      version: 1 as const,
      selector: '53434231' as const,
      maximumRows: 8,
      maximumBlobBytes: 512,
      route: {
        name: '__message_bus1', selector: '53434231', inputs: [], outputs: [],
        blockLayout: { blockSize: 1, slots: [{ kind: 'master' as const, offset: 0 }] },
      },
      handlers: [{ name, selector, inputs, outputs: [], eligible: true }],
    });
    const pingInputs = [{ name: 'value', type: 'int' }];
    const sink = {
      artifact: {
        contractName: 'RuntimeBatchSink',
        abi: [{ name: 'ping', selector: '01020304', inputs: pingInputs, outputs: [] }],
        messageBus: capability('ping', '01020304', pingInputs),
        invocationAnalysis: { version: 1, protocolVersions: [1], functions: [], components: [] },
      } as unknown as Artifact,
      lockingBytecode: '51',
    };
    const root = {
      artifact: {
        contractName: 'RuntimeBatchRoot',
        abi: [{
          name: 'run', selector: '11111111', inputs: [{ name: 'values', type: 'int[]' }], outputs: [],
          externalCalls: [{
            callsiteId: 4,
            occurrence: 'once' as const,
            interfaceName: 'ISink',
            functionName: 'ping',
            batchInvocations: [{
              selector: '01020304', sourceCallsiteId: 40, sourceEffectOrdinal: 2,
              logicalIndex: 0, inputs: pingInputs,
              argSources: [{ kind: 'literal' as const, type: 'int', value: '1' }],
            }, {
              selector: '01020304', sourceCallsiteId: 41, sourceEffectOrdinal: 5, logicalIndex: 1,
              inputs: pingInputs, occurrence: 'loop' as const,
              argSources: [{ kind: 'arrayElement' as const, paramIndex: 0, indexValue: 0 }],
            }],
          }],
        }],
        messageBus: capability('run', '11111111', [{ name: 'values', type: 'int[]' }]),
        invocationAnalysis: { version: 1, protocolVersions: [1], functions: [], components: [] },
      } as unknown as Artifact,
      lockingBytecode: '52',
    };
    const derive = (values: bigint[]): {
      planned: ReturnType<typeof messageBus.deriveCompiledGraphPlan>;
      targets: Array<{ batchLogicalIndex?: number; occurrence: number }>;
    } => {
      const targets: Array<{ batchLogicalIndex?: number; occurrence: number }> = [];
      const planned = messageBus.deriveCompiledGraphPlan({
        root,
        function: 'run',
        args: [values],
        targets: {},
        target: ({ batchLogicalIndex, occurrence }) => {
          targets.push({ batchLogicalIndex, occurrence });
          return sink;
        },
        expressionArgument: ({ occurrence }) => values[occurrence],
      });
      return { planned, targets };
    };
    expect(derive([]).planned.invocations.map((invocation) => invocation.function)).toEqual(['run', 'ping']);
    const three = derive([2n, 3n, 4n]);
    expect(three.planned.invocations.map((invocation) => invocation.function))
      .toEqual(['run', 'ping', 'ping', 'ping', 'ping']);
    expect(three.planned.invocations.map((invocation) => ({
      physical: invocation.consumerCallsiteId,
      source: invocation.sourceCallsiteId,
      logical: invocation.sourceLogicalIndex,
      occurrence: invocation.occurrenceIndex,
      effect: invocation.sourceEffectOrdinal,
    }))).toEqual([
      { physical: undefined, source: undefined, logical: undefined, occurrence: undefined, effect: undefined },
      { physical: 4, source: 40, logical: 0, occurrence: 0, effect: 2 },
      { physical: 4, source: 41, logical: 1, occurrence: 0, effect: 5 },
      { physical: 4, source: 41, logical: 1, occurrence: 1, effect: 5 },
      { physical: 4, source: 41, logical: 1, occurrence: 2, effect: 5 },
    ]);
    expect(three.targets).toEqual([
      { batchLogicalIndex: 0, occurrence: 0 },
      { batchLogicalIndex: 1, occurrence: 0 },
      { batchLogicalIndex: 1, occurrence: 1 },
      { batchLogicalIndex: 1, occurrence: 2 },
    ]);
    const compiled = three.planned.invocations.map((invocation, index) => ({
      parent: invocation.parent,
      callee: invocation.callee,
      function: invocation.function,
      selector: invocation.selectorHex,
      args: index === 0 ? [[2n, 3n, 4n]] : [BigInt(index === 1 ? 1 : index)],
      ...(invocation.consumerCallsiteId !== undefined && {
        consumerCallsiteId: invocation.consumerCallsiteId,
      }),
      ...(invocation.sourceCallsiteId !== undefined && {
        sourceCallsiteId: invocation.sourceCallsiteId,
      }),
      ...(invocation.sourceLogicalIndex !== undefined && {
        sourceLogicalIndex: invocation.sourceLogicalIndex,
      }),
      ...(invocation.occurrenceIndex !== undefined && {
        occurrenceIndex: invocation.occurrenceIndex,
      }),
      ...(invocation.sourceEffectOrdinal !== undefined && {
        sourceEffectOrdinal: invocation.sourceEffectOrdinal,
      }),
      ...(invocation.parent !== null && { targetLockingBytecode: invocation.targetLockingBytecode }),
      callMode: invocation.callMode,
    }));
    const duplicate = compiled.map((invocation, index) => index === 3
      ? { ...invocation, occurrenceIndex: 0 } : invocation);
    expect(() => messageBus.planCompiledGraph(
      three.planned.participants.map((participant) => ({
        artifact: participant.artifact,
        lockingBytecode: participant.lockingBytecode,
      })),
      duplicate,
    )).toThrow(/canonical next occurrence/);
    const missingSource = compiled.map((invocation, index) => {
      if (index !== 1) return invocation;
      const withoutSource = { ...invocation };
      delete withoutSource.sourceCallsiteId;
      return withoutSource;
    });
    expect(() => messageBus.planCompiledGraph(
      three.planned.participants.map((participant) => ({
        artifact: participant.artifact,
        lockingBytecode: participant.lockingBytecode,
      })),
      missingSource,
    )).toThrow(/omits compiler source callsite/);
    const wrongEffect = compiled.map((invocation, index) => index === 1
      ? { ...invocation, sourceEffectOrdinal: 5 } : invocation);
    expect(() => messageBus.planCompiledGraph(
      three.planned.participants.map((participant) => ({
        artifact: participant.artifact,
        lockingBytecode: participant.lockingBytecode,
      })),
      wrongEffect,
    )).toThrow(/source-effect ordinal disagrees/);
    const mixedEffectRoot = structuredClone(root) as typeof root;
    delete (mixedEffectRoot.artifact.abi[0].externalCalls![0].batchInvocations![1] as {
      sourceEffectOrdinal?: number;
    }).sourceEffectOrdinal;
    expect(() => messageBus.deriveCompiledGraphPlan({
      root: mixedEffectRoot, function: 'run', args: [[2n]], targets: {}, target: () => sink,
      expressionArgument: ({ occurrence }) => BigInt(occurrence + 2),
    })).toThrow(/mixes source-effect provenance/);
    const substituted = compiled.map((invocation, index) => index === 1 ? {
      ...invocation,
      sourceCallsiteId: 41,
      sourceLogicalIndex: 1,
      occurrenceIndex: 0,
      sourceEffectOrdinal: 5,
    } : index > 1 ? { ...invocation, occurrenceIndex: index - 1 } : invocation);
    expect(() => messageBus.planCompiledGraph(
      three.planned.participants.map((participant) => ({
        artifact: participant.artifact,
        lockingBytecode: participant.lockingBytecode,
      })),
      substituted,
    )).toThrow(/source row 0 must be represented exactly once/);

    const legacyRoot = structuredClone(root) as typeof root;
    for (const row of legacyRoot.artifact.abi[0].externalCalls![0].batchInvocations!) {
      delete (row as { sourceCallsiteId?: number }).sourceCallsiteId;
    }
    const legacy = messageBus.deriveCompiledGraphPlan({
      root: legacyRoot, function: 'run', args: [[2n, 3n]], targets: {},
      target: () => sink,
      expressionArgument: ({ occurrence }) => BigInt(occurrence + 2),
    });
    expect(legacy.invocations.slice(1).map((invocation) => ({
      physical: invocation.consumerCallsiteId,
      source: invocation.sourceCallsiteId,
      logical: invocation.sourceLogicalIndex,
      provenance: invocation.sourceCallsiteProvenance,
    }))).toEqual([
      { physical: 4, source: 4, logical: 0, provenance: 'legacy-logical' },
      { physical: 4, source: 4, logical: 1, provenance: 'legacy-logical' },
      { physical: 4, source: 4, logical: 1, provenance: 'legacy-logical' },
    ]);

    const kernelRoot = structuredClone(root) as typeof root;
    kernelRoot.artifact.messageBus = {
      ...kernelRoot.artifact.messageBus!,
      convention: 'kernel-row-loop',
    };
    for (const row of kernelRoot.artifact.abi[0].externalCalls![0].batchInvocations!) {
      delete (row as { sourceCallsiteId?: number }).sourceCallsiteId;
    }
    expect(() => messageBus.deriveCompiledGraphPlan({
      root: kernelRoot, function: 'run', args: [[2n]], targets: {},
      target: () => sink,
      expressionArgument: ({ occurrence }) => BigInt(occurrence + 2),
    })).toThrow(/kernel batched callsite .* omits sourceCallsiteId/);
  });

  it('assigns canonical occurrences to a non-batched runtime callsite', () => {
    const inputs = [{ name: 'value', type: 'int' }];
    const capability = (
      name: string, selector: string, handlerInputs: readonly { name: string; type: string }[] = inputs,
    ): NonNullable<Artifact['messageBus']> => ({
      version: 1 as const,
      selector: '53434231' as const,
      maximumRows: 4,
      maximumBlobBytes: 256,
      route: {
        name: '__message_bus1', selector: '53434231', inputs: [], outputs: [],
        blockLayout: { blockSize: 1, slots: [{ kind: 'master' as const, offset: 0 }] },
      },
      handlers: [{ name, selector, inputs: handlerInputs, outputs: [], eligible: true }],
    });
    const sink = {
      artifact: {
        contractName: 'OccurrenceSink',
        abi: [{ name: 'ping', selector: '01020304', inputs, outputs: [] }],
        messageBus: capability('ping', '01020304'),
        invocationAnalysis: { version: 1, protocolVersions: [1], functions: [], components: [] },
      } as unknown as Artifact,
      lockingBytecode: '51',
    };
    const root = {
      artifact: {
        contractName: 'OccurrenceRoot',
        abi: [{
          name: 'run', selector: '11111111', inputs: [{ name: 'values', type: 'int[]' }], outputs: [],
          externalCalls: [{
            callsiteId: 7, sourceEffectOrdinal: 4, occurrence: 'loop' as const, maximumOccurrences: 3,
            interfaceName: 'ISink', functionName: 'ping',
            argSources: [{ kind: 'arrayElement' as const, paramIndex: 0, indexValue: 0 }],
          }],
        }],
        messageBus: capability('run', '11111111', [{ name: 'values', type: 'int[]' }]),
        invocationAnalysis: { version: 1, protocolVersions: [1], functions: [], components: [] },
      } as unknown as Artifact,
      lockingBytecode: '52',
    };
    const planned = messageBus.deriveCompiledGraphPlan({
      root, function: 'run', args: [[1n, 2n, 3n]], targets: { ISink: sink },
      occurrence: () => 3,
      expressionArgument: ({ occurrence }) => BigInt(occurrence + 1),
    });
    expect(planned.invocations.slice(1).map((invocation) => ({
      physical: invocation.consumerCallsiteId,
      source: invocation.sourceCallsiteId,
      logical: invocation.sourceLogicalIndex,
      occurrence: invocation.occurrenceIndex,
    }))).toEqual([
      { physical: 7, source: 7, logical: undefined, occurrence: 0 },
      { physical: 7, source: 7, logical: undefined, occurrence: 1 },
      { physical: 7, source: 7, logical: undefined, occurrence: 2 },
    ]);
    const first = planned.invocations[1];
    expect(first.producerPath.status).toBe('complete');
    expect(() => messageBus.assertPreparedInvocationIdentity({
      contract: {} as never,
      functionName: 'ping',
      args: [1n],
      callsiteId: 7,
      sourceCallsiteId: 7,
      occurrenceIndex: 0,
      sourceEffectOrdinal: 4,
      producerPath: first.producerPath,
    }, first, 1)).not.toThrow();
    if (first.producerPath.status !== 'complete') throw new Error('expected a complete producer path');
    expect(() => messageBus.assertPreparedInvocationIdentity({
      contract: {} as never,
      functionName: 'ping',
      args: [1n],
      callsiteId: 7,
      sourceCallsiteId: 7,
      sourceLogicalIndex: 0,
      occurrenceIndex: 0,
      sourceEffectOrdinal: 4,
      producerPath: {
        status: 'complete',
        context: {
          version: 1,
          sourcePath: first.producerPath.context.sourcePath.map((site) => ({
            ...site, sourceLogicalIndex: 0,
          })),
        },
      },
    }, first, 1)).toThrow(/producer path disagrees/);
  });

  it('uses the authenticated physical owner identity for nested callers', () => {
    const withLogicalCaller = plan();
    withLogicalCaller.participants[0].logicalLockingBytecode = '54';
    withLogicalCaller.participants[1] = {
      ...withLogicalCaller.participants[1],
      logicalLockingBytecode: '55',
      logicalIdentityOffset: 1,
      blockLayout: {
        blockSize: 2,
        slots: [{ kind: 'master', offset: 0 }, { kind: 'identityAnchor', offset: 1 }],
      },
    };
    withLogicalCaller.invocations[1] = {
      ...withLogicalCaller.invocations[1], targetLockingBytecode: '55', targetIdentityOffset: 1,
    };
    const finalized = messageBus.finalizeAtomicInvocationGraph(
      withLogicalCaller, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    );
    expect(finalized.callManifest.participants[0].lockingBytecode).toBe('51'.repeat(64));
    // Legacy fallback: absent callerIdentity keeps owner@0 even when the callee target is a logical alias.
    expect(finalized.callManifest.rows[1].subjectHex).toBe('51'.repeat(64));
    expect(finalized.plan.invocations[1].targetLockingBytecode).toBe('55');
    expect(finalized.callManifest.rows[1].targetOffset).toBe(1);
  });

  it('uses the authenticated state owner as the nested high-level caller identity', () => {
    const delegatedCaller = plan();
    delegatedCaller.participants[0] = {
      ...delegatedCaller.participants[0],
      artifact: {
        ...delegatedCaller.participants[0].artifact,
        abi: [{
          name: 'run', selector: '11111111', inputs: [{ name: 'n', type: 'int' }], outputs: [],
          externalCalls: [{
            callsiteId: 7, interfaceName: 'IPeer', functionName: 'run', occurrence: 'once',
            callerIdentity: {
              version: 1, role: 'owner', auth: 'input-bytecode', authOffset: 0,
            },
          }],
        }],
      },
      logicalLockingBytecode: '54',
      logicalIdentityOffset: 0,
      executionKind: 1,
      executorOffset: 1,
      executorInputIndex: 1,
      executorLockingBytecode: '56',
      blockLayout: {
        blockSize: 2,
        slots: [{ kind: 'master', offset: 0 }, { kind: 'lowLevelCall', offset: 1 }],
      },
    };
    const finalized = messageBus.finalizeAtomicInvocationGraph(
      delegatedCaller, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    );
    // Publication says owner: executor lock 0x56 must not become msg.sender.
    expect(finalized.callManifest.rows[1]).toMatchObject({ subjectHex: '51'.repeat(64), sourceOffset: 0 });
    expect(messageBus.graphInvocationCallerIdentity(
      delegatedCaller.participants, delegatedCaller.invocations, delegatedCaller.invocations[1],
    )).toMatchObject({ role: 'owner', lockingBytecode: '51'.repeat(64), offset: 0 });
  });

  it('uses the authenticated state owner as caller for a nested raw call', () => {
    const delegatedCaller = plan();
    delegatedCaller.participants[0] = {
      ...delegatedCaller.participants[0],
      artifact: {
        ...delegatedCaller.participants[0].artifact,
        abi: [{
          name: 'run', selector: '11111111', inputs: [{ name: 'n', type: 'int' }], outputs: [],
          externalCalls: [{
            callsiteId: 7, interfaceName: '__raw__', functionName: '__raw__',
            rawSelector: '22222222', occurrence: 'once',
            callerIdentity: {
              version: 1, role: 'owner', auth: 'input-bytecode', authOffset: 0,
            },
          }],
        }],
      },
      logicalLockingBytecode: '54',
      logicalIdentityOffset: 0,
      executionKind: 1,
      executorOffset: 1,
      executorInputIndex: 1,
      executorLockingBytecode: '56',
      blockLayout: {
        blockSize: 2,
        slots: [{ kind: 'master', offset: 0 }, { kind: 'lowLevelCall', offset: 1 }],
      },
    };
    const finalized = messageBus.finalizeAtomicInvocationGraph(
      delegatedCaller, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    );
    expect(finalized.callManifest.rows[1]).toMatchObject({ subjectHex: '51'.repeat(64), sourceOffset: 0 });
  });

  it('resolves a published CREATE caller identity at the identity-anchor offset', () => {
    const createCaller = plan();
    createCaller.participants[0] = {
      ...createCaller.participants[0],
      artifact: {
        ...createCaller.participants[0].artifact,
        abi: [{
          name: 'run', selector: '11111111', inputs: [{ name: 'n', type: 'int' }], outputs: [],
          externalCalls: [{
            callsiteId: 7, interfaceName: 'IPeer', functionName: 'run', occurrence: 'once',
            callerIdentity: {
              version: 1, role: 'create', auth: 'input-bytecode', authOffset: 1,
            },
          }],
        }],
      },
      logicalLockingBytecode: '54',
      logicalIdentityOffset: 1,
      blockLayout: {
        blockSize: 2,
        slots: [{ kind: 'master', offset: 0 }, { kind: 'identityAnchor', offset: 1 }],
      },
    };
    const resolved = messageBus.graphInvocationCallerIdentity(
      createCaller.participants, createCaller.invocations, createCaller.invocations[1],
    );
    expect(resolved).toMatchObject({
      role: 'create', lockingBytecode: '54', offset: 1, authOffset: 1,
      sourceCallsiteProvenance: 'compiler',
    });
    const finalized = messageBus.finalizeAtomicInvocationGraph(
      {
        ...createCaller,
        invocations: [
          createCaller.invocations[0],
          { ...createCaller.invocations[1], callerIdentity: resolved },
        ],
      },
      ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    );
    expect(finalized.callManifest.rows[1]).toMatchObject({ subjectHex: '54', sourceOffset: 1 });
  });

  it('resolves active caller identity from the authenticated physical or logical parent target', () => {
    const activeCaller = plan();
    activeCaller.participants[0] = {
      ...activeCaller.participants[0],
      artifact: {
        ...activeCaller.participants[0].artifact,
        messageBus: {
          ...activeCaller.participants[0].artifact.messageBus!,
          convention: 'kernel-row-loop',
        },
        abi: [{
          name: 'run', selector: '11111111', inputs: [{ name: 'n', type: 'int' }], outputs: [],
          externalCalls: [{
            callsiteId: 7, interfaceName: 'IPeer', functionName: 'run', occurrence: 'once',
            callerIdentity: {
              version: 1, role: 'active', auth: 'input-bytecode', authOffset: 0xffff,
            },
          }],
        }],
      },
      logicalLockingBytecode: '54',
      logicalIdentityOffset: 1,
      blockLayout: {
        blockSize: 2,
        slots: [{ kind: 'master', offset: 0 }, { kind: 'identityAnchor', offset: 1 }],
      },
    };
    const physical = messageBus.graphInvocationCallerIdentity(
      activeCaller.participants, activeCaller.invocations, activeCaller.invocations[1],
    );
    expect(physical).toMatchObject({ role: 'active', lockingBytecode: '51'.repeat(64), offset: 0 });

    activeCaller.invocations[0] = {
      ...activeCaller.invocations[0], targetLockingBytecode: '54', targetIdentityOffset: 1,
    };
    const logical = messageBus.graphInvocationCallerIdentity(
      activeCaller.participants, activeCaller.invocations, activeCaller.invocations[1],
    );
    expect(logical).toMatchObject({ role: 'active', lockingBytecode: '54', offset: 1 });

    const published = activeCaller.participants[0].artifact.abi[0].externalCalls![0].callerIdentity!;
    Object.assign(published, { version: 2 });
    expect(() => messageBus.graphInvocationCallerIdentity(
      activeCaller.participants, activeCaller.invocations, activeCaller.invocations[1],
    )).toThrow(/unsupported callsite callerIdentity version 2/);
    Object.assign(published, { version: 1 });

    const missingAnchor = activeCaller.participants.map((participant, index) => index === 0
      ? { ...participant, logicalIdentityOffset: undefined }
      : participant);
    expect(() => messageBus.graphInvocationCallerIdentity(
      missingAnchor, activeCaller.invocations, activeCaller.invocations[1],
    )).toThrow(/does not match the authenticated parent target/);

    activeCaller.invocations[0] = {
      ...activeCaller.invocations[0], targetIdentityOffset: 0,
    };
    expect(() => messageBus.graphInvocationCallerIdentity(
      activeCaller.participants, activeCaller.invocations, activeCaller.invocations[1],
    )).toThrow(/does not match the authenticated parent target/);
  });

  it('uses the authenticated proxy identity as the active caller of a delegate external call', () => {
    const activeCaller = plan();
    activeCaller.participants[0] = {
      ...activeCaller.participants[0],
      artifact: {
        ...activeCaller.participants[0].artifact,
        messageBus: {
          ...activeCaller.participants[0].artifact.messageBus!,
          convention: 'kernel-row-loop',
        },
        abi: [{
          name: 'run', selector: '11111111', inputs: [{ name: 'n', type: 'int' }], outputs: [],
          externalCalls: [{
            callsiteId: 7, interfaceName: 'IPeer', functionName: 'run', occurrence: 'once',
            callerIdentity: {
              version: 1, role: 'active', auth: 'input-bytecode', authOffset: 0xffff,
            },
          }],
        }],
      },
      executionKind: 1,
      logicalLockingBytecode: '54',
      logicalIdentityOffset: 1,
      executorLockingBytecode: '56',
      executorOffset: 2,
    };

    const resolved = messageBus.graphInvocationCallerIdentity(
      activeCaller.participants, activeCaller.invocations, activeCaller.invocations[1],
    );
    expect(resolved).toMatchObject({
      role: 'active', lockingBytecode: '54', offset: 1, authOffset: 1,
    });
    expect(resolved.lockingBytecode).not.toBe(activeCaller.participants[0].lockingBytecode);
    expect(resolved.lockingBytecode).not.toBe('56');
  });

  it('refuses to treat a delegate executor as caller when publication says owner', () => {
    const delegatedCaller = plan();
    delegatedCaller.participants[0] = {
      ...delegatedCaller.participants[0],
      artifact: {
        ...delegatedCaller.participants[0].artifact,
        messageBus: {
          ...delegatedCaller.participants[0].artifact.messageBus!,
          convention: 'kernel-row-loop',
        },
        abi: [{
          name: 'run', selector: '11111111', inputs: [{ name: 'n', type: 'int' }], outputs: [],
          externalCalls: [{
            callsiteId: 7, interfaceName: 'IPeer', functionName: 'run', occurrence: 'once',
            callerIdentity: {
              version: 1, role: 'owner', auth: 'input-bytecode', authOffset: 0,
            },
          }],
        }],
      },
      logicalLockingBytecode: '54',
      executionKind: 1,
      executorOffset: 1,
      executorInputIndex: 1,
      executorLockingBytecode: '56',
      blockLayout: {
        blockSize: 2,
        slots: [{ kind: 'master', offset: 0 }, { kind: 'lowLevelCall', offset: 1 }],
      },
    };
    const resolved = messageBus.graphInvocationCallerIdentity(
      delegatedCaller.participants, delegatedCaller.invocations, delegatedCaller.invocations[1],
    );
    expect(resolved.lockingBytecode).toBe('51'.repeat(64));
    expect(resolved.lockingBytecode).not.toBe('56');
    expect(resolved.role).toBe('owner');
  });

  it('refuses a kernel callsite that omits callerIdentity', () => {
    const kernelCaller = plan();
    kernelCaller.participants[0] = {
      ...kernelCaller.participants[0],
      artifact: {
        ...kernelCaller.participants[0].artifact,
        messageBus: {
          ...kernelCaller.participants[0].artifact.messageBus!,
          convention: 'kernel-row-loop',
        },
        abi: [{
          name: 'run', selector: '11111111', inputs: [{ name: 'n', type: 'int' }], outputs: [],
          externalCalls: [{
            callsiteId: 7, interfaceName: 'IPeer', functionName: 'run', occurrence: 'once',
          }],
        }],
      },
    };
    expect(() => messageBus.graphInvocationCallerIdentity(
      kernelCaller.participants, kernelCaller.invocations, kernelCaller.invocations[1],
    )).toThrow(/missing compiler-published callerIdentity/);
  });

  it('keeps legacy owner@0 when callerIdentity is absent outside kernel convention', () => {
    const legacy = plan();
    expect(messageBus.graphInvocationCallerIdentity(
      legacy.participants, legacy.invocations, legacy.invocations[1],
    )).toMatchObject({
      role: 'owner', lockingBytecode: '51'.repeat(64), offset: 0,
      sourceCallsiteProvenance: 'legacy-logical',
    });
  });

  it('derives participant bases, identities, policies, and exact invocation rows', () => {
    const finalized = messageBus.finalizeAtomicInvocationGraph(
      plan(), ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    );
    expect(finalized.layout).toEqual({
      participantInputs: [0, 1], verifierInputs: [2, 3], verifierInput: 3, feeInput: 4, totalSlots: 5,
    });
    expect(finalized.callManifest.participants.map((participant) => participant.actualSize)).toEqual([1, 1]);
    expect(finalized.callManifest.participants.map((participant) => participant.stateCategory)).toEqual([
      'aa'.repeat(32), 'bb'.repeat(32),
    ]);
    expect(finalized.callManifest.rows).toMatchObject([
      { owner: 0, consumer: 0, sourceOffset: 0xffff, targetOffset: 0, subjectHex: '53', position: 2 },
      {
        owner: 0, consumer: 1, slot: 7, mode: 1, sourceOffset: 0, targetOffset: 0,
        selectorHex: '22222222', argsHex: '02', resultHex: '2a', position: 2,
      },
    ]);
    expect(messageBus.decodeAtomicMessageEnvelope(finalized.messageEnvelope)).toEqual(finalized.callManifest);
  });

  it('activates a published return slot only for a selected returning invocation', () => {
    const base = plan();
    const withUnionReturnSlots: messageBus.CompiledGraphPlan = {
      ...base,
      participants: base.participants.map((participant) => ({
        ...participant,
        blockLayout: {
          blockSize: 2,
          slots: [{ kind: 'master' as const, offset: 0 }, { kind: 'returnEvent' as const, offset: 1 }],
        },
      })),
    };
    const finalized = messageBus.finalizeAtomicInvocationGraph(
      withUnionReturnSlots, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    );
    expect(finalized.callManifest.participants.map((participant) => participant.returnOffset))
      .toEqual([0xffff, 1]);
  });

  it('changes the participant identity table when code identity or category changes', () => {
    const first = messageBus.finalizeAtomicInvocationGraph(plan(), ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' });
    const categoryChanged = messageBus.finalizeAtomicInvocationGraph(
      plan(), ['aa'.repeat(32), 'cc'.repeat(32)], { 1: '2a' },
    );
    const codeChanged = plan();
    const changed = {
      ...codeChanged,
      participants: [codeChanged.participants[0], {
        ...codeChanged.participants[1], lockingBytecode: '53'.repeat(64),
      }],
    };
    expect(messageBus.finalizeAtomicInvocationGraph(
      changed, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    ).bytes).not.toEqual(first.bytes);
    expect(categoryChanged.bytes).not.toEqual(first.bytes);
  });

  it('authenticates a participant output identity independently of its consumed identity', () => {
    const upgraded = plan();
    upgraded.participants[0] = {
      ...upgraded.participants[0], outputLockingBytecode: '54'.repeat(64),
    };
    const finalized = messageBus.finalizeAtomicInvocationGraph(
      upgraded, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    );
    expect(finalized.callManifest.version).toBe(2);
    expect(finalized.callManifest.participants[0]).toMatchObject({
      lockingBytecode: '51'.repeat(64),
      outputLockingBytecode: '54'.repeat(64),
    });
    expect(finalized.callManifest.participants[1]).toMatchObject({
      lockingBytecode: '52'.repeat(64),
    });
    // Once one participant selects V2, preservation participants are also encoded with an authenticated
    // output identity equal to their input identity.
    expect(messageBus.decodeAtomicMessageEnvelope(finalized.messageEnvelope).participants[1])
      .toMatchObject({ lockingBytecode: '52'.repeat(64), outputLockingBytecode: '52'.repeat(64) });

    const changedTarget = plan();
    changedTarget.participants[0] = {
      ...changedTarget.participants[0], outputLockingBytecode: '55'.repeat(64),
    };
    expect(messageBus.finalizeAtomicInvocationGraph(
      changedTarget, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    ).bytes).not.toEqual(finalized.bytes);

    const legacyPeer = plan();
    legacyPeer.participants[0] = {
      ...legacyPeer.participants[0], outputLockingBytecode: '54'.repeat(64),
    };
    // The peer keeps the same envelope and drops protocol 2, so the V2 check is the one that refuses it.
    legacyPeer.participants[1] = {
      ...legacyPeer.participants[1],
      artifact: {
        ...legacyPeer.participants[1].artifact,
        messageBus: {
          ...legacyPeer.participants[1].artifact.messageBus!,
          atomicMessageBus: {
            ...legacyPeer.participants[1].artifact.messageBus!.atomicMessageBus!,
            protocolVersions: [1],
          },
        },
      },
    };
    expect(() => messageBus.finalizeAtomicInvocationGraph(
      legacyPeer, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    )).toThrow(/participant 1 verifier does not advertise.*protocol 2/);
  });

  it('rejects an atomic descriptor that omits its envelope region', () => {
    const rootOmitted = plan();
    rootOmitted.participants[0] = {
      ...rootOmitted.participants[0],
      artifact: {
        ...rootOmitted.participants[0].artifact,
        messageBus: {
          ...rootOmitted.participants[0].artifact.messageBus!,
          atomicMessageBus: { protocolVersions: [1, 2, 3] },
        },
      },
    };
    expect(() => messageBus.finalizeAtomicInvocationGraph(
      rootOmitted, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    )).toThrow(/no supported atomic envelope transport/);
    const peerOmitted = plan();
    peerOmitted.participants[1] = {
      ...peerOmitted.participants[1],
      artifact: {
        ...peerOmitted.participants[1].artifact,
        messageBus: {
          ...peerOmitted.participants[1].artifact.messageBus!,
          atomicMessageBus: { protocolVersions: [1, 2, 3] },
        },
      },
    };
    expect(() => messageBus.finalizeAtomicInvocationGraph(
      peerOmitted, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    )).toThrow(/participant 1 uses a different atomic envelope transport/);
  });

  it('admits canonical event, value, token-container, and token-settlement rows', () => {
    expect(() => messageBus.finalizeAtomicInvocationGraph(
      plan(), ['aa'.repeat(32), 'bb'.repeat(32)],
    )).toThrow(/lacks canonical result/);
    const base = plan();
    const eventPlan: messageBus.CompiledGraphPlan = {
      ...base,
      participants: [base.participants[0], {
        ...base.participants[1],
        blockLayout: {
          blockSize: 2, slots: [{ kind: 'master', offset: 0 }, { kind: 'event', offset: 1, slotIndex: 0 }],
        },
      }],
    };
    expect(messageBus.finalizeAtomicInvocationGraph(
      eventPlan, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' }, [{
        participant: 1, offset: 1, active: true, lockingBytecodeHex: '51', commitmentHex: '012a',
      }],
    ).callManifest.rows[2]).toMatchObject({
      kind: 2, owner: 1, consumer: 1, sourceOffset: 1, targetOffset: 1,
      subjectHex: '51', effectHex: '012a',
    });
    const valuePlan: messageBus.CompiledGraphPlan = {
      ...base,
      participants: [base.participants[0], {
        ...base.participants[1],
        blockLayout: {
          blockSize: 2, slots: [{ kind: 'master', offset: 0 }, { kind: 'transfer', offset: 1, slotIndex: 0 }],
        },
      }],
    };
    expect(messageBus.finalizeAtomicInvocationGraph(
      valuePlan, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' }, [], [], [{
        participant: 1, offset: 1, lockingBytecodeHex: '52', amount: 900n,
      }],
    ).callManifest.rows[2]).toMatchObject({
      kind: 3, owner: 1, consumer: 1, sourceOffset: 1, targetOffset: 1,
      subjectHex: '52', effectHex: '8403000000000000',
    });
    const tokenPlan: messageBus.CompiledGraphPlan = {
      ...base,
      participants: [base.participants[0], {
        ...base.participants[1],
        blockLayout: {
          blockSize: 3, slots: [
            { kind: 'master', offset: 0 },
            { kind: 'tokenContainer', offset: 1, slotIndex: 0 },
            { kind: 'tcTransfer', offset: 2, slotIndex: 0 },
          ],
        },
      }],
    };
    const tokenized = messageBus.finalizeAtomicInvocationGraph(
      tokenPlan, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' }, [], [{
        participant: 1, offset: 1, mode: 4, lockingBytecodeHex: '52',
        tokenCategoryHex: 'cc'.repeat(31) + '33', outputTokenCategoryHex: 'cc'.repeat(31) + '33',
        inputCommitmentHex: '', outputCommitmentHex: '', inputValue: 100n, outputValue: 75n,
      }], [], [{
        participant: 1, offset: 2, lockingBytecodeHex: '53', tokenCategoryHex: 'cc'.repeat(31) + '33',
        amount: 25n, commitmentHex: '', capability: 'ft',
      }],
    );
    expect(tokenized.callManifest.rows.slice(2)).toMatchObject([{
      kind: 1, mode: 4, sourceOffset: 1, targetOffset: 1, argsHex: 'cc'.repeat(31) + '33',
      resultHex: '6400000000000000',
      effectHex: `20${'cc'.repeat(31) + '33'}4b00000000000000`,
    }, {
      kind: 4, mode: 0, sourceOffset: 2, targetOffset: 2, argsHex: 'cc'.repeat(31) + '33',
      effectHex: '1900000000000000',
    }]);
  });

  it('binds compiler-published sparse event sites without requiring a rectangular row frame', () => {
    const base = plan();
    const sparseArtifact = artifact('22222222');
    sparseArtifact.messageBus!.maximumRows = 8;
    sparseArtifact.messageBus!.handlers[0].emits = [{
      eventName: 'Changed', eventSignature: 'Changed(int)', emitIndex: 0,
    }];
    const sparseEventPlan: messageBus.CompiledGraphPlan = {
      ...base,
      participants: [base.participants[0], {
        ...base.participants[1],
        artifact: sparseArtifact,
        blockLayout: {
          blockSize: 4,
          slots: [
            { kind: 'master', offset: 0 },
            { kind: 'event', offset: 1, slotIndex: 0, conditional: true },
            { kind: 'event', offset: 2, slotIndex: 1, conditional: true },
            { kind: 'event', offset: 3, slotIndex: 2, conditional: true },
          ],
        },
      }],
    };
    const finalized = messageBus.finalizeAtomicInvocationGraph(
      sparseEventPlan, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' }, [{
        participant: 1, offset: 2, active: true, lockingBytecodeHex: '51', commitmentHex: '012a',
      }],
    );
    expect(finalized.callManifest.rows[2]).toMatchObject({
      kind: 2, owner: 1, consumer: 1, sourceOffset: 2, targetOffset: 2, parent: 1,
      subjectHex: '51', effectHex: '012a',
    });
  });

  it('admits only event slots owned by selected graph-effect rows', () => {
    const base = plan();
    const framedArtifact = artifact('22222222');
    framedArtifact.contractName = 'FramedEvents';
    framedArtifact.messageBus!.maximumRows = 2;
    framedArtifact.messageBus!.handlers[0].emits = [{
      eventName: 'Changed', eventSignature: 'Changed(int)', emitIndex: 0,
    }];
    framedArtifact.messageBus!.route = {
      name: '__message_bus1', inputs: [], outputs: [],
      graphEffectFrame: {
        sites: 2, eventBase: 0, eventWidth: 1,
        transferBase: 0, transferWidth: 0,
        tokenTransferBase: 0, tokenTransferWidth: 0, tokenNftTransfers: false,
      },
      blockLayout: {
        blockSize: 3,
        slots: [
          { kind: 'master', offset: 0 },
          { kind: 'event', offset: 1, slotIndex: 0, conditional: true },
          { kind: 'event', offset: 2, slotIndex: 1, conditional: true },
        ],
      },
    };
    const framed: messageBus.CompiledGraphPlan = {
      ...base,
      participants: [base.participants[0], {
        ...base.participants[1], artifact: framedArtifact,
        blockLayout: framedArtifact.messageBus!.route.blockLayout!,
      }],
    };
    expect([...messageBus.selectedGraphEventOffsets(framed, framed.participants[1])!]).toEqual([1]);
    expect(() => messageBus.finalizeAtomicInvocationGraph(
      framed, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' }, [{
        participant: 1, offset: 2, active: true, lockingBytecodeHex: '51', commitmentHex: '012a',
      }],
    )).toThrow(/active ordinal 0.*declare 1 event emission/s);
  });

  it('infers only a canonical one-event-per-row legacy prefix', () => {
    const base = plan();
    const legacyArtifact = artifact('22222222');
    legacyArtifact.messageBus!.maximumRows = 2;
    legacyArtifact.messageBus!.handlers[0].emits = [{
      eventName: 'Changed', eventSignature: 'Changed(int)', emitIndex: 0,
    }];
    legacyArtifact.messageBus!.route = {
      name: '__message_bus1', inputs: [], outputs: [],
      blockLayout: {
        blockSize: 3,
        slots: [
          { kind: 'master', offset: 0 },
          { kind: 'event', offset: 1, slotIndex: 0, conditional: true },
          { kind: 'event', offset: 2, slotIndex: 1, conditional: true },
        ],
      },
    };
    const legacy: messageBus.CompiledGraphPlan = {
      ...base,
      participants: [base.participants[0], {
        ...base.participants[1], artifact: legacyArtifact,
        blockLayout: legacyArtifact.messageBus!.route.blockLayout!,
      }],
    };
    expect([...messageBus.selectedGraphEventOffsets(legacy, legacy.participants[1])!]).toEqual([1]);
    legacyArtifact.messageBus!.route.blockLayout!.blockSize = 4;
    legacyArtifact.messageBus!.route.blockLayout!.slots.push({
      kind: 'event', offset: 3, slotIndex: 2, conditional: true,
    });
    expect(messageBus.selectedGraphEventOffsets(legacy, legacy.participants[1])).toBeUndefined();
    legacyArtifact.messageBus!.route.blockLayout!.slots.pop();
    legacyArtifact.messageBus!.route.blockLayout!.slots[2].slotIndex = 7;
    expect(messageBus.selectedGraphEventOffsets(legacy, legacy.participants[1])).toBeUndefined();
  });

  it('encodes a mutable-resource replacement with independent input and output covenants', () => {
    const base = plan();
    const replacementPlan: messageBus.CompiledGraphPlan = {
      ...base,
      participants: [base.participants[0], {
        ...base.participants[1],
        blockLayout: {
          blockSize: 2,
          trailingBase: 1,
          trailingCapacity: 1,
          slots: [{ kind: 'master', offset: 0 }, { kind: 'trailing', offset: 1, slotIndex: 0 }],
        },
      }],
    };
    const finalized = messageBus.finalizeAtomicInvocationGraph(
      replacementPlan, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' }, [], [{
        participant: 1,
        offset: 1,
        mode: 5,
        lockingBytecodeHex: '51',
        outputLockingBytecodeHex: '52',
        tokenCategoryHex: `${'cc'.repeat(31) + '33'}01`,
        inputCommitmentHex: 'aa',
        outputCommitmentHex: 'bb',
      }],
    );
    expect(finalized.callManifest.rows[2]).toMatchObject({
      kind: 1,
      mode: 5,
      subjectHex: '51',
      argsHex: `${'cc'.repeat(31) + '33'}01`,
      resultHex: 'aa',
      effectHex: '010052bb',
    });
    expect(() => messageBus.finalizeAtomicInvocationGraph(
      replacementPlan, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' }, [], [{
        participant: 1,
        offset: 1,
        mode: 5,
        lockingBytecodeHex: '51',
        tokenCategoryHex: `${'cc'.repeat(31) + '33'}01`,
        inputCommitmentHex: 'aa',
        outputCommitmentHex: 'bb',
      }],
    )).toThrow(/not a mutable NFT/);
  });

  it('binds a compiler-published child deployment to one exact genesis output span', () => {
    const base = plan();
    const deploymentArtifact = {
      ...base.participants[0].artifact,
      messageBus: {
        ...base.participants[0].artifact.messageBus!,
        handlers: [{
          ...base.participants[0].artifact.messageBus!.handlers[0],
          childDeployments: [{
            siteIndex: 0, contractName: 'NeutralChild', occurrence: 'once',
            genesisInputCount: 1, masterOutputCount: 1, dataNftOutputCount: 1, totalOutputCount: 2,
            categorySource: 'genesis-input-outpoint-txhash', constructorArgs: [], creationBytecode: '51',
            childLayoutDigest: 'ab'.repeat(32),
          }],
        }],
      },
    } as Artifact;
    const valueBoundArtifact = {
      ...deploymentArtifact,
      messageBus: {
        ...deploymentArtifact.messageBus!,
        handlers: [{
          ...deploymentArtifact.messageBus!.handlers[0],
          childDeployments: deploymentArtifact.messageBus!.handlers[0].childDeployments!.map((site) => ({
            ...site,
            value: {
              transferIndex: 0,
              amount: { kind: 'handlerInput' as const, inputIndex: 0, resultType: 'int256' },
            },
          })),
        }],
      },
    } as Artifact;
    const changedValueRecipe = {
      ...valueBoundArtifact,
      messageBus: {
        ...valueBoundArtifact.messageBus!,
        handlers: [{
          ...valueBoundArtifact.messageBus!.handlers[0],
          childDeployments: valueBoundArtifact.messageBus!.handlers[0].childDeployments!.map((site) => ({
            ...site, value: { ...site.value!, transferIndex: 1 },
          })),
        }],
      },
    } as Artifact;
    expect(messageBus.atomicParticipantPolicyHash(valueBoundArtifact))
      .not.toBe(messageBus.atomicParticipantPolicyHash(deploymentArtifact));
    expect(messageBus.atomicParticipantPolicyHash(changedValueRecipe))
      .not.toBe(messageBus.atomicParticipantPolicyHash(valueBoundArtifact));
    const deploymentPlan: messageBus.CompiledGraphPlan = {
      ...base,
      participants: [{
        ...base.participants[0], artifact: deploymentArtifact,
        blockLayout: {
          blockSize: 3,
          slots: [
            { kind: 'master', offset: 0 },
            { kind: 'deploy', offset: 1, slotIndex: 0 },
            { kind: 'deployDataNft', offset: 2, slotIndex: 0, nftIndex: 0 },
          ],
        },
      }, base.participants[1]],
    };
    const category = 'cc'.repeat(31) + '33';
    const effect: messageBus.AtomicDeploymentSlotEffect = {
      participant: 0, invocation: 0, siteIndex: 0, offset: 1,
      genesisTransactionHashHex: category, genesisOutputIndex: 0,
      outputs: [
        {
          lockingBytecodeHex: '51', tokenCategoryHex: category, capability: 'minting',
          commitmentHex: '', tokenAmount: 0n, value: 1200n,
        },
        {
          lockingBytecodeHex: '52', tokenCategoryHex: category, capability: 'mutable',
          commitmentHex: 'aa', tokenAmount: 0n, value: 1200n,
        },
      ],
    };
    const finalize = (
      selected: readonly messageBus.AtomicDeploymentSlotEffect[], selectedPlan = deploymentPlan,
    ): ReturnType<typeof messageBus.finalizeAtomicInvocationGraph> => messageBus.finalizeAtomicInvocationGraph(
      selectedPlan, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' }, [], [], [], [], [], undefined, selected,
    );
    const finalized = finalize([effect]);
    expect(finalized.callManifest.rows[2]).toEqual({
      kind: 5, owner: 0, consumer: 0, slot: 1, mode: 0, sourceOffset: 1, targetOffset: 1,
      selectorHex: '00000000', position: 1, parent: 0, depth: 0, subtreeEnd: 0,
      subjectHex: '', argsHex: `0000${internalOrder(category)}${'ab'.repeat(32)}`, resultHex: '',
      effectHex: '0200b004000000000000020100510000b004000000000000010100520100aa',
    });
    expect(messageBus.decodeAtomicMessageBusCallManifest(finalized.bytes).rows[2])
      .toEqual(finalized.callManifest.rows[2]);
    const descriptorlessArtifact = {
      ...deploymentArtifact,
      messageBus: {
        ...deploymentArtifact.messageBus!,
        handlers: [{
          ...deploymentArtifact.messageBus!.handlers[0],
          childDeployments: deploymentArtifact.messageBus!.handlers[0].childDeployments!.map((site) => ({
            ...site, childLayoutDigest: undefined,
          })),
        }],
      },
    } as Artifact;
    expect(() => finalize([effect], {
      ...deploymentPlan,
      participants: [{ ...deploymentPlan.participants[0], artifact: descriptorlessArtifact }, base.participants[1]],
    })).toThrow(/no authenticated child layout descriptor/);

    const narrowArtifact = {
      ...deploymentArtifact,
      messageBus: {
        ...deploymentArtifact.messageBus!,
        handlers: [{
          ...deploymentArtifact.messageBus!.handlers[0],
          childDeployments: [{
            ...deploymentArtifact.messageBus!.handlers[0].childDeployments![0],
            dataNftOutputCount: 0, totalOutputCount: 1,
          }],
        }],
      },
    } as Artifact;
    const narrowPlan: messageBus.CompiledGraphPlan = {
      ...deploymentPlan,
      participants: [{ ...deploymentPlan.participants[0], artifact: narrowArtifact }, base.participants[1]],
    };
    // A route reserves its widest child frame for every row. The narrower reached site owns the canonical
    // prefix only; the compiler-authenticated suffix remains a neutral balanced slot, not a forged child NFT.
    expect(finalize([{ ...effect, outputs: effect.outputs.slice(0, 1) }], narrowPlan).callManifest.rows[2])
      .toMatchObject({ kind: 5, effectHex: '0100b004000000000000020100510000' });

    const overloadedArtifact = {
      ...deploymentArtifact,
      messageBus: {
        ...deploymentArtifact.messageBus!,
        handlers: [
          { ...deploymentArtifact.messageBus!.handlers[0], selector: 'aaaaaaaa', childDeployments: undefined },
          deploymentArtifact.messageBus!.handlers[0],
        ],
      },
    } as Artifact;
    const overloadedPlan: messageBus.CompiledGraphPlan = {
      ...deploymentPlan,
      participants: [{ ...deploymentPlan.participants[0], artifact: overloadedArtifact }, base.participants[1]],
    };
    expect(finalize([effect], overloadedPlan).callManifest.rows[2]).toMatchObject({ kind: 5, parent: 0 });

    expect(() => finalize([])).toThrow(/exactly cover reached deployment invocations/);
    expect(() => finalize([{ ...effect, invocation: 1 }])).toThrow(/exactly cover reached deployment invocations/);
    expect(() => finalize([{ ...effect, genesisOutputIndex: 1 }])).toThrow(/vout-0/);
    expect(() => finalize([{ ...effect, genesisTransactionHashHex: 'cc'.repeat(31) }])).toThrow(/32-byte vout-0/);
    expect(() => finalize([{ ...effect, outputs: effect.outputs.slice(0, 1) }])).toThrow(/requires 2 exact outputs/);
    expect(() => finalize([{ ...effect, outputs: [effect.outputs[0], {
      ...effect.outputs[1], tokenCategoryHex: 'dd'.repeat(31) + '22',
    }] }])).toThrow(/child-genesis shape/);
    expect(() => finalize([{ ...effect, outputs: [{
      ...effect.outputs[0], capability: 'mutable',
    }, effect.outputs[1]] }])).toThrow(/child-genesis shape/);
    expect(() => finalize([{ ...effect, outputs: [{
      ...effect.outputs[0], lockingBytecodeHex: '',
    }, effect.outputs[1]] }])).toThrow(/child-genesis shape/);
    expect(() => finalize([{ ...effect, outputs: [effect.outputs[0], {
      ...effect.outputs[1], tokenAmount: 1n,
    }] }])).toThrow(/child-genesis shape/);
    expect(() => finalize([{ ...effect, outputs: [{
      ...effect.outputs[0], value: 0x1_0000_0000_0000_0000n,
    }, effect.outputs[1]] }])).toThrow(/child-genesis shape/);

    const ambiguousArtifact = {
      ...deploymentArtifact,
      messageBus: {
        ...deploymentArtifact.messageBus!,
        handlers: [{
          ...deploymentArtifact.messageBus!.handlers[0],
          childDeployments: [
            ...deploymentArtifact.messageBus!.handlers[0].childDeployments!,
            { ...deploymentArtifact.messageBus!.handlers[0].childDeployments![0], siteIndex: 1 },
          ],
        }],
      },
    } as Artifact;
    const ambiguousPlan: messageBus.CompiledGraphPlan = {
      ...deploymentPlan,
      participants: [{ ...deploymentPlan.participants[0], artifact: ambiguousArtifact }, base.participants[1]],
    };
    expect(() => finalize([effect], ambiguousPlan)).toThrow(/exactly cover reached deployment invocations/);

    const malformedSpan: messageBus.CompiledGraphPlan = {
      ...deploymentPlan,
      participants: [{
        ...deploymentPlan.participants[0],
        blockLayout: {
          ...deploymentPlan.participants[0].blockLayout!,
          slots: deploymentPlan.participants[0].blockLayout!.slots.map((slot) =>
            slot.kind === 'deployDataNft' ? { ...slot, offset: 3 } : slot),
        },
      }, base.participants[1]],
    };
    expect(() => finalize([effect], malformedSpan)).toThrow(/non-canonical deployment window/);
  });

  it('binds every compiler-derived stateless child transfer operand into the participant policy hash', () => {
    const base = plan();
    const derivedArtifact = {
      ...base.participants[0].artifact,
      messageBus: {
        ...base.participants[0].artifact.messageBus!,
        handlers: [{
          ...base.participants[0].artifact.messageBus!.handlers[0],
          transfers: [{
            transferIndex: 0,
            recipient: { kind: 'expression' as const },
            amount: { kind: 'forward' as const, paramIndex: 0 },
            amountRecipe: { kind: 'handlerInput' as const, inputIndex: 0, resultType: 'int256' },
            derivedRecipient: {
              contractName: 'Capsule',
              creationBytecode: '51',
              constructorInputs: [{ name: 'seed', type: 'int256' }],
              constructorArgs: [{ kind: 'handlerInput' as const, inputIndex: 0, resultType: 'int256' }],
              salt: { kind: 'bytesLiteral' as const, value: 'aa'.repeat(32), resultType: 'bytes32' },
            },
          }],
        }],
      },
    } as Artifact;
    const baseHash = messageBus.atomicParticipantPolicyHash(derivedArtifact);
    const mutateTransfer = (
      mutate: (transfer: NonNullable<NonNullable<Artifact['messageBus']>['handlers'][number]['transfers']>[number])
      => NonNullable<NonNullable<Artifact['messageBus']>['handlers'][number]['transfers']>[number],
    ): Artifact => ({
      ...derivedArtifact,
      messageBus: {
        ...derivedArtifact.messageBus!,
        handlers: derivedArtifact.messageBus!.handlers.map((handler) => ({
          ...handler, transfers: handler.transfers?.map(mutate),
        })),
      },
    });
    const original = derivedArtifact.messageBus!.handlers[0].transfers![0];
    const derived = original.derivedRecipient!;
    const mutations = [
      mutateTransfer((transfer) => ({
        ...transfer, derivedRecipient: { ...derived, creationBytecode: '52' },
      })),
      mutateTransfer((transfer) => ({
        ...transfer,
        derivedRecipient: {
          ...derived,
          constructorArgs: [{ kind: 'intLiteral', value: '7', resultType: 'int256' }],
        },
      })),
      mutateTransfer((transfer) => ({
        ...transfer,
        derivedRecipient: {
          ...derived,
          salt: { kind: 'bytesLiteral', value: 'bb'.repeat(32), resultType: 'bytes32' },
        },
      })),
      mutateTransfer((transfer) => ({
        ...transfer,
        amountRecipe: { kind: 'intLiteral', value: '1200', resultType: 'int256' },
      })),
    ];
    for (const mutation of mutations) {
      expect(messageBus.atomicParticipantPolicyHash(mutation)).not.toBe(baseHash);
    }
  });

  it('orders and exactly covers multiple heterogeneous deployment sites in one row window', () => {
    const base = plan();
    const site = (
      siteIndex: number, contractName: string, dataNftOutputCount: number,
    ): ChildDeploymentSiteAbi => ({
      siteIndex, contractName, occurrence: 'once' as const,
      genesisInputCount: 1 as const, masterOutputCount: 1 as const,
      dataNftOutputCount, totalOutputCount: 1 + dataNftOutputCount,
      categorySource: 'genesis-input-outpoint-txhash' as const,
      constructorArgs: [], creationBytecode: '51', childLayoutDigest: `${siteIndex + 1}`.repeat(64),
    });
    const deploymentArtifact = {
      ...base.participants[0].artifact,
      messageBus: {
        ...base.participants[0].artifact.messageBus!,
        handlers: [{
          ...base.participants[0].artifact.messageBus!.handlers[0],
          childDeployments: [site(0, 'WideChild', 2), site(1, 'NarrowChild', 0)],
        }],
      },
    } as Artifact;
    const deploymentPlan: messageBus.CompiledGraphPlan = {
      ...base,
      participants: [{
        ...base.participants[0], artifact: deploymentArtifact,
        blockLayout: {
          blockSize: 5,
          slots: [
            { kind: 'master', offset: 0 },
            { kind: 'deploy', offset: 1, slotIndex: 0 },
            { kind: 'deployDataNft', offset: 2, slotIndex: 0, nftIndex: 0 },
            { kind: 'deployDataNft', offset: 3, slotIndex: 0, nftIndex: 1 },
            { kind: 'deployDataNft', offset: 4, slotIndex: 0, nftIndex: 2 },
          ],
        },
      }, base.participants[1]],
    };
    const wideCategory = 'cc'.repeat(31) + '33';
    const narrowCategory = 'dd'.repeat(31) + '22';
    const changedTopology = {
      ...deploymentArtifact,
      messageBus: {
        ...deploymentArtifact.messageBus!,
        handlers: [{
          ...deploymentArtifact.messageBus!.handlers[0],
          childDeployments: deploymentArtifact.messageBus!.handlers[0].childDeployments!.map((candidate) =>
            candidate.siteIndex === 1 ? { ...candidate, creationBytecode: '52' } : candidate),
        }],
      },
    } as Artifact;
    expect(messageBus.atomicParticipantPolicyHash(changedTopology))
      .not.toBe(messageBus.atomicParticipantPolicyHash(deploymentArtifact));
    const wide: messageBus.AtomicDeploymentSlotEffect = {
      participant: 0, invocation: 0, siteIndex: 0, offset: 1,
      genesisTransactionHashHex: wideCategory, genesisOutputIndex: 0,
      outputs: [
        {
          lockingBytecodeHex: '51', tokenCategoryHex: wideCategory, capability: 'minting',
          commitmentHex: '', tokenAmount: 0n, value: 1200n,
        },
        {
          lockingBytecodeHex: '52', tokenCategoryHex: wideCategory, capability: 'mutable',
          commitmentHex: 'aa', tokenAmount: 0n, value: 1200n,
        },
        {
          lockingBytecodeHex: '52', tokenCategoryHex: wideCategory, capability: 'mutable',
          commitmentHex: 'bb', tokenAmount: 0n, value: 1200n,
        },
      ],
    };
    const narrow: messageBus.AtomicDeploymentSlotEffect = {
      participant: 0, invocation: 0, siteIndex: 1, offset: 4,
      genesisTransactionHashHex: narrowCategory, genesisOutputIndex: 0,
      outputs: [{
        lockingBytecodeHex: '53', tokenCategoryHex: narrowCategory, capability: 'minting',
        commitmentHex: '', tokenAmount: 0n, value: 1200n,
      }],
    };
    const finalize = (
      effects: readonly messageBus.AtomicDeploymentSlotEffect[], selectedPlan = deploymentPlan,
    ): ReturnType<typeof messageBus.finalizeAtomicInvocationGraph> => messageBus.finalizeAtomicInvocationGraph(
      selectedPlan, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' }, [], [], [], [], [], undefined, effects,
    );

    // Caller order is irrelevant: the wire is canonical physical/source order.
    const finalized = finalize([narrow, wide]);
    expect(finalized.callManifest.rows.slice(2).map((row) => ({
      kind: row.kind, slot: row.slot, parent: row.parent, argsHex: row.argsHex,
    }))).toEqual([
      { kind: 5, slot: 1, parent: 0, argsHex: `0000${internalOrder(wideCategory)}${'1'.repeat(64)}` },
      { kind: 5, slot: 4, parent: 0, argsHex: `0100${internalOrder(narrowCategory)}${'2'.repeat(64)}` },
    ]);

    expect(() => finalize([wide])).toThrow(/exactly cover reached deployment invocations/);
    expect(() => finalize([narrow])).toThrow(/exactly cover reached deployment invocations/);
    expect(() => finalize([wide, wide])).toThrow(/duplicate invocation site/);
    expect(() => finalize([wide, { ...narrow, siteIndex: 0 }])).toThrow(/duplicate invocation site/);
    expect(() => finalize([wide, { ...narrow, siteIndex: 2 }]))
      .toThrow(/exactly cover reached deployment invocations/);
    expect(() => finalize([{ ...wide, offset: narrow.offset }, { ...narrow, offset: wide.offset }]))
      .toThrow(/non-canonical output span/);
    expect(() => finalize([{ ...wide, outputs: wide.outputs.slice(0, 2) }, narrow]))
      .toThrow(/requires 3 exact outputs/);
    expect(() => finalize([wide, { ...narrow, outputs: [...narrow.outputs, narrow.outputs[0]] }]))
      .toThrow(/requires 1 exact outputs/);

    const sparseWindow: messageBus.CompiledGraphPlan = {
      ...deploymentPlan,
      participants: [{
        ...deploymentPlan.participants[0],
        blockLayout: {
          ...deploymentPlan.participants[0].blockLayout!,
          slots: deploymentPlan.participants[0].blockLayout!.slots.map((slot) =>
            slot.kind === 'deployDataNft' && slot.offset === 3 ? { ...slot, offset: 5 } : slot),
        },
      }, base.participants[1]],
    };
    expect(() => finalize([wide, narrow], sparseWindow)).toThrow(/non-canonical deployment window/);
  });
});
