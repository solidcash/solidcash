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
      participant: 0, artifact: artifact('11111111'), lockingBytecode: '51', executionKind: 0,
      executorOffset: null, executorInputIndex: 0xffff, executorLockingBytecode: '',
      batch: {} as never, invocations: [0],
      blockLayout: { blockSize: 1, slots: [{ kind: 'master', offset: 0 }] },
      routeInputs: [], settlementBoundary: 2, completionPositions: [2],
    },
    {
      participant: 1, artifact: artifact('22222222'), lockingBytecode: '52', executionKind: 0,
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
    },
    {
      index: 1, parent: 0, caller: 0, callee: 1, subtreeEnd: 1, localRow: 0, depth: 1,
      function: 'run', selectorHex: '22222222', callMode: 'staticcall', callOptions: 1,
      argsHex: '02', resultTypes: ['int'], consumerCallsiteId: 7, resultDependencies: [],
    },
  ],
  rootCallerLockingBytecode: '53',
});

describe('atomic compiled invocation graph', () => {
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

  it('changes the participant identity table when code identity or category changes', () => {
    const first = messageBus.finalizeAtomicInvocationGraph(plan(), ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' });
    const categoryChanged = messageBus.finalizeAtomicInvocationGraph(
      plan(), ['aa'.repeat(32), 'cc'.repeat(32)], { 1: '2a' },
    );
    const codeChanged = plan();
    const changed = {
      ...codeChanged,
      participants: [codeChanged.participants[0], { ...codeChanged.participants[1], lockingBytecode: '5353' }],
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
});
