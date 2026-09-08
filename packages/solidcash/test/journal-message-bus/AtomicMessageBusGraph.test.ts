import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { compileString } from 'solidc';
import { messageBus, SignatureTemplate } from '../../src/index.js';

const artifact = (selector: string, inputType = 'int'): Artifact => ({
  contractName: 'Participant',
  abi: [{ name: 'run', selector, inputs: [{ name: 'n', type: inputType }], outputs: [], modifiers: ['public'] }],
  structs: [],
  messageBus: {
    maximumRows: 1,
    atomicMessageBus: { protocolVersions: [1, 2, 3] },
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
      ...(kind === 'split' && { verifierProgram: {
        verifyFunctionId: 1, inputCount: 1, inputs: [{ name: 'x', type: 'int' }], functions: [],
        splitLifecycle: true as const,
      } }),
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
      targetLockingBytecode: '51'.repeat(64), targetIdentityOffset: 0,
    },
    {
      index: 1, parent: 0, caller: 0, callee: 1, subtreeEnd: 1, localRow: 0, depth: 1,
      function: 'run', selectorHex: '22222222', callMode: 'staticcall', callOptions: 1,
      argsHex: '02', resultTypes: ['int'], consumerCallsiteId: 7, resultDependencies: [],
      targetLockingBytecode: '52'.repeat(64), targetIdentityOffset: 0,
    },
  ],
  rootCallerLockingBytecode: '53',
});

describe('atomic compiled invocation graph', () => {
  it('derives lifecycle wire geometry from metadata and invocation args, never a caller transcript', () => {
    expect(messageBus.atomicParticipantPolicyHash(lifecycleArtifact('split')))
      .not.toBe(messageBus.atomicParticipantPolicyHash(lifecycleArtifact('merge')));
    for (const kind of ['split'] as const) {
      const participant = { artifact: lifecycleArtifact(kind), lockingBytecode: '51' };
      const invocation = {
        parent: null, callee: 0, function: kind, args: [2n],
        lifecycle: { kind: kind === 'split' ? 'merge' : 'split', count: 19 },
      } as messageBus.CompiledGraphInvocation & { lifecycle: unknown };
      const planned = messageBus.planCompiledGraph([participant], [invocation]);
      expect(planned.participants[0].lifecycle).toEqual({
        version: 1, kind, count: 2, inputSpan: 1, outputSpan: 3, balancedSpan: 3,
        inputTail: 'funding', outputTail: 'created-masters',
      });
    }
    expect(() => messageBus.planCompiledGraph([
      { artifact: lifecycleArtifact('merge'), lockingBytecode: '51' },
    ], [{ parent: null, callee: 0, function: 'merge', args: [2n] }]))
      .toThrow(/implemented split verifier/);
    const unsupported = lifecycleArtifact('split');
    delete unsupported.messageBus!.verifierProgram!.splitLifecycle;
    expect(() => messageBus.planCompiledGraph([
      { artifact: unsupported, lockingBytecode: '51' },
    ], [{ parent: null, callee: 0, function: 'split', args: [2n] }]))
      .toThrow(/selector-derived split authority/);
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

    const lifecycle = messageBus.planCompiledGraph([
      { artifact: lifecycleArtifact('split', [1, 2, 3, 4]), lockingBytecode: '51'.repeat(64) },
    ], [{ parent: null, callee: 0, function: 'split', args: [2n] }]).participants[0].lifecycle!;
    for (const lifecycleParticipant of [0, 1]) {
      const unsupportedCombination = structuredClone(signedPlan);
      unsupportedCombination.participants[lifecycleParticipant].lifecycle = lifecycle;
      expect(() => messageBus.finalizeAtomicInvocationGraph(
        unsupportedCombination, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
      )).toThrow(/transaction-signature provenance cannot yet be combined with participant lifecycle geometry/);
    }
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
    const derive = (functionName: 'forward' | 'construct') => messageBus.deriveCompiledGraphPlan({
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

  it('uses a runtime occurrence proof for a bounded conditional raw edge', () => {
    const capability = (
      name: string,
      selector: string,
      inputs: { name: string; type: string }[],
      delegated = false,
    ) => ({
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
    const derive = (count: number) => messageBus.deriveCompiledGraphPlan({
      root,
      function: 'run',
      args: [Uint8Array.of(0x51), payload],
      targets: {},
      occurrence: () => count,
      // The root owns state at 0x52 and publishes logical identity 0x54, while its handler executes at the
      // authenticated delegate input 0x56. `address(this)` is that input's exact OP_UTXOBYTECODE result.
      dynamicCall: () => ({ participant: target, function: 'approve', args: [Uint8Array.of(0x56)] }),
    });
    expect(derive(0).invocations.map((invocation) => invocation.function)).toEqual(['run']);
    const reached = derive(1);
    expect(reached.invocations.map((invocation) => invocation.function)).toEqual(['run', 'approve']);
    expect(reached.invocations[1].argsHex).toBe('0156');
  });

  it('preserves exact identities for omitted conditional siblings calling the same method', () => {
    const capability = (name: string, selector: string, inputs: { name: string; type: string }[]) => ({
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
    const capability = (name: string, selector: string, inputs: { name: string; type: string }[]) => ({
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
              selector: '01020304', logicalIndex: 0, inputs: pingInputs,
              argSources: [{ kind: 'literal' as const, type: 'int', value: '1' }],
            }, {
              selector: '01020304', logicalIndex: 1, inputs: pingInputs, occurrence: 'loop' as const,
              argSources: [{ kind: 'arrayElement' as const, paramIndex: 0, indexValue: 0 }],
            }],
          }],
        }],
        messageBus: capability('run', '11111111', [{ name: 'values', type: 'int[]' }]),
        invocationAnalysis: { version: 1, protocolVersions: [1], functions: [], components: [] },
      } as unknown as Artifact,
      lockingBytecode: '52',
    };
    const derive = (values: bigint[]) => {
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
    expect(three.targets).toEqual([
      { batchLogicalIndex: 0, occurrence: 0 },
      { batchLogicalIndex: 1, occurrence: 0 },
      { batchLogicalIndex: 1, occurrence: 1 },
      { batchLogicalIndex: 1, occurrence: 2 },
    ]);
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
    expect(finalized.callManifest.rows[1].subjectHex).toBe('51'.repeat(64));
    expect(finalized.plan.invocations[1].targetLockingBytecode).toBe('55');
    expect(finalized.callManifest.rows[1].targetOffset).toBe(1);
  });

  it('uses a delegate owner input as the nested high-level caller identity', () => {
    const delegatedCaller = plan();
    delegatedCaller.participants[0] = {
      ...delegatedCaller.participants[0],
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

  it('preserves the delegate owner as caller for a nested raw call', () => {
    const delegatedCaller = plan();
    delegatedCaller.participants[0] = {
      ...delegatedCaller.participants[0],
      artifact: {
        ...delegatedCaller.participants[0].artifact,
        abi: [{
          name: 'run', inputs: [{ name: 'n', type: 'int' }], outputs: [],
          externalCalls: [{
            callsiteId: 7, interfaceName: '__raw__', functionName: '__raw__',
            rawSelector: '22222222', occurrence: 'once',
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
    legacyPeer.participants[1] = {
      ...legacyPeer.participants[1],
      artifact: {
        ...legacyPeer.participants[1].artifact,
        messageBus: {
          ...legacyPeer.participants[1].artifact.messageBus!, atomicMessageBus: undefined,
        },
      },
    };
    expect(() => messageBus.finalizeAtomicInvocationGraph(
      legacyPeer, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    )).toThrow(/participant 1 verifier does not advertise.*protocol 2/);
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
        tokenCategoryHex: 'cc'.repeat(32), outputTokenCategoryHex: 'cc'.repeat(32),
        inputCommitmentHex: '', outputCommitmentHex: '', inputValue: 100n, outputValue: 75n,
      }], [], [{
        participant: 1, offset: 2, lockingBytecodeHex: '53', tokenCategoryHex: 'cc'.repeat(32),
        amount: 25n, commitmentHex: '', capability: 'ft',
      }],
    );
    expect(tokenized.callManifest.rows.slice(2)).toMatchObject([{
      kind: 1, mode: 4, sourceOffset: 1, targetOffset: 1, argsHex: 'cc'.repeat(32),
      resultHex: '6400000000000000', effectHex: `20${'cc'.repeat(32)}4b00000000000000`,
    }, {
      kind: 4, mode: 0, sourceOffset: 2, targetOffset: 2, argsHex: 'cc'.repeat(32),
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
        tokenCategoryHex: `${'cc'.repeat(32)}01`,
        inputCommitmentHex: 'aa',
        outputCommitmentHex: 'bb',
      }],
    );
    expect(finalized.callManifest.rows[2]).toMatchObject({
      kind: 1,
      mode: 5,
      subjectHex: '51',
      argsHex: `${'cc'.repeat(32)}01`,
      resultHex: 'aa',
      effectHex: '010052bb',
    });
    expect(() => messageBus.finalizeAtomicInvocationGraph(
      replacementPlan, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' }, [], [{
        participant: 1,
        offset: 1,
        mode: 5,
        lockingBytecodeHex: '51',
        tokenCategoryHex: `${'cc'.repeat(32)}01`,
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
    const category = 'cc'.repeat(32);
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
      subjectHex: '', argsHex: `0000${category}${'ab'.repeat(32)}`, resultHex: '',
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
      ...effect.outputs[1], tokenCategoryHex: 'dd'.repeat(32),
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
    const site = (siteIndex: number, contractName: string, dataNftOutputCount: number) => ({
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
    const wideCategory = 'cc'.repeat(32);
    const narrowCategory = 'dd'.repeat(32);
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
      { kind: 5, slot: 1, parent: 0, argsHex: `0000${wideCategory}${'1'.repeat(64)}` },
      { kind: 5, slot: 4, parent: 0, argsHex: `0100${narrowCategory}${'2'.repeat(64)}` },
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
