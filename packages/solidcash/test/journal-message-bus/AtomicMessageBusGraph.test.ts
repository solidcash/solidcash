import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { messageBus } from '../../src/index.js';

const artifact = (selector: string, inputType = 'int'): Artifact => ({
  messageBus: {
    maximumRows: 1,
    handlers: [{
      name: 'run', selector, inputs: [{ name: 'n', type: inputType }], outputs: [], eligible: true,
    }],
  },
  // Only policy fields are consumed by this pure planner fixture.
} as unknown as Artifact);

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
  it('keeps the production blob envelope by default and admits an explicit provider profile', () => {
    const wide = {
      messageBus: { maximumBlobBytes: 10_000 },
    } as unknown as Artifact;
    expect(() => messageBus.assertGraphBatchBlobEnvelope(wide, 2)).toThrow(/wider than the 520/);
    expect(() => messageBus.assertGraphBatchBlobEnvelope(wide, 2, 10_000)).not.toThrow();
  });

  it('scans every prepared occurrence of an unbounded source loop', () => {
    expect(messageBus.preparedExternalCallOccurrenceScanLimit({}, 'loop', 3)).toBe(3);
    expect(messageBus.preparedExternalCallOccurrenceScanLimit({}, 'conditional', 3)).toBe(1);
    expect(messageBus.preparedExternalCallOccurrenceScanLimit(
      { maximumOccurrences: 2 }, 'loop', 3,
    )).toBe(2);
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
});
