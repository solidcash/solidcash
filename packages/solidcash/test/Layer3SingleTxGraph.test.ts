import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { layer3 } from '../src/index.js';

const artifact = (selector: string, inputType = 'int'): Artifact => ({
  hiddenBatch: {
    maximumRows: 1,
    handlers: [{
      name: 'run', selector, inputs: [{ name: 'n', type: inputType }], outputs: [], eligible: true,
    }],
  },
  // Only policy fields are consumed by this pure planner fixture.
} as unknown as Artifact);

const plan = (): layer3.CompiledGraphPlan => ({
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

describe('controllerless compiled invocation graph', () => {
  it('derives participant bases, identities, policies, and exact invocation rows', () => {
    const finalized = layer3.finalizeSingleTxInvocationGraph(
      plan(), ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    );
    expect(finalized.layout).toEqual({ participantInputs: [0, 1], feeInput: 2, totalSlots: 3 });
    expect(finalized.transcript.participants.map((participant) => participant.base)).toEqual([0, 1]);
    expect(finalized.transcript.participants.map((participant) => participant.masterCategory)).toEqual([
      'aa'.repeat(32), 'bb'.repeat(32),
    ]);
    expect(finalized.transcript.rows).toMatchObject([
      { owner: 0, consumer: 0, sourceSlot: 0xffff, targetSlot: 0, subjectHex: '53', position: 2 },
      {
        owner: 0, consumer: 1, slot: 7, mode: 1, sourceSlot: 0, targetSlot: 1,
        selectorHex: '22222222', argsHex: '02', resultHex: '2a', position: 2,
      },
    ]);
    expect(layer3.decodeSingleTxCarrier(finalized.carrier)).toEqual(finalized.transcript);
  });

  it('changes the participant identity table when code identity or category changes', () => {
    const first = layer3.finalizeSingleTxInvocationGraph(plan(), ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' });
    const categoryChanged = layer3.finalizeSingleTxInvocationGraph(
      plan(), ['aa'.repeat(32), 'cc'.repeat(32)], { 1: '2a' },
    );
    const codeChanged = plan();
    const changed = {
      ...codeChanged,
      participants: [codeChanged.participants[0], { ...codeChanged.participants[1], lockingBytecode: '5353' }],
    };
    expect(layer3.finalizeSingleTxInvocationGraph(
      changed, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    ).bytes).not.toEqual(first.bytes);
    expect(categoryChanged.bytes).not.toEqual(first.bytes);
  });

  it('admits canonical event rows and fails closed on missing results or unsupported resources', () => {
    expect(() => layer3.finalizeSingleTxInvocationGraph(
      plan(), ['aa'.repeat(32), 'bb'.repeat(32)],
    )).toThrow(/lacks canonical result/);
    const base = plan();
    const eventPlan: layer3.CompiledGraphPlan = {
      ...base,
      participants: [base.participants[0], {
        ...base.participants[1],
        blockLayout: {
          blockSize: 2, slots: [{ kind: 'master', offset: 0 }, { kind: 'event', offset: 1, slotIndex: 0 }],
        },
      }],
    };
    expect(layer3.finalizeSingleTxInvocationGraph(
      eventPlan, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' }, [{
        participant: 1, offset: 1, active: true, lockingBytecodeHex: '51', commitmentHex: '012a',
      }],
    ).transcript.rows[2]).toMatchObject({
      kind: 2, owner: 1, consumer: 1, sourceSlot: 2, targetSlot: 2,
      subjectHex: '51', effectHex: '012a',
    });
    const unsupported: layer3.CompiledGraphPlan = {
      ...base,
      participants: [base.participants[0], {
        ...base.participants[1],
        blockLayout: {
          blockSize: 2, slots: [{ kind: 'master', offset: 0 }, { kind: 'transfer', offset: 1 }],
        },
      }],
    };
    expect(() => layer3.finalizeSingleTxInvocationGraph(
      unsupported, ['aa'.repeat(32), 'bb'.repeat(32)], { 1: '2a' },
    )).toThrow(expect.objectContaining({ code: 'L3_TRANSCRIPT_EFFECT_UNIMPLEMENTED' }));
  });
});
