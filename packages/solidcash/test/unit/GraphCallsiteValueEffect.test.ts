import type { Artifact, ExternalCallAbi } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { planCompiledGraph, type CompiledGraphPlan } from '../../src/message-bus/graph.js';

const callsite = (id: number, value?: boolean): ExternalCallAbi => ({
  callsiteId: id, interfaceName: '__raw__', functionName: '__raw__', requiredDataNftIndices: [],
  callerIdentity: { version: 1, role: 'owner', auth: 'input-bytecode', authOffset: 0 },
  ...(value === undefined ? {} : { callValueEffect: value }),
});

const artifact = (calls?: ExternalCallAbi[], kernel = true): Artifact => ({
  contractName: 'Participant',
  abi: [{ name: 'run', selector: '11111111', inputs: [], outputs: [], externalCalls: calls }],
  messageBus: {
    convention: kernel ? 'kernel-row-loop' : 'legacy-unroll',
    version: 1, selector: '53434231', maximumRows: 4, maximumBlobBytes: 256,
    route: { name: '__message_bus1', selector: '53434231', inputs: [], outputs: [],
      blockLayout: { blockSize: 1, slots: [{ kind: 'master', offset: 0 }] } },
    handlers: [{ name: 'run', selector: '11111111', inputs: [], outputs: [], eligible: true,
      ...(calls && { transfers: [{ transferIndex: 0, callOption: 'value' }] }) }],
  },
  invocationAnalysis: { version: 1, protocolVersions: [1], functions: [], components: [] },
} as unknown as Artifact);

const plan = (calls: ExternalCallAbi[], kernel = true, grouped = false): CompiledGraphPlan => planCompiledGraph([
  { artifact: artifact(calls, kernel), lockingBytecode: '51' },
  { artifact: artifact(), lockingBytecode: '52' },
], [
  { parent: null, callee: 0, function: 'run', args: [] },
  ...Array.from({ length: grouped ? 2 : calls.length }, (_, index) => ({
    parent: 0, callee: 1, function: 'run', args: [], consumerCallsiteId: grouped ? 0 : index,
    ...(grouped && { sourceCallsiteId: index, sourceLogicalIndex: index }),
  })),
]);

describe('graph source-edge value attribution', () => {
  it('assigns value to its exact sibling, not the whole parent', () => {
    expect(plan([callsite(0, false), callsite(1, true)]).invocations.map((row) => row.callOptions))
      .toEqual([0, 0, 2]);
  });

  it.each([true, false])('uses each grouped row independently of representative %s', (representative) => {
    const grouped: ExternalCallAbi = {
      ...callsite(0, representative),
      batchInvocations: [true, false].map((callValueEffect, index) => ({
        logicalIndex: index, sourceCallsiteId: index, selector: '11111111', inputs: [], callValueEffect,
      })),
    };
    expect(plan([grouped], true, true).invocations.map((row) => row.callOptions)).toEqual([0, 2, 0]);
    delete grouped.batchInvocations![1].callValueEffect;
    expect(() => plan([grouped], true, true)).toThrow(/omits framedsite value metadata/);
  });

  it('requires recompilation for missing kernel value attribution', () => {
    expect(() => plan([callsite(0)])).toThrow(/omits framedsite value metadata/);
  });

  it('keeps the singular unconditional legacy raw-value edge', () => {
    expect(plan([callsite(0)], false).invocations[1].callOptions).toBe(2);
    expect(() => plan([callsite(0), callsite(1)], false)).toThrow(/omits framedsite value metadata/);
  });

  it('rejects invalid markers and duplicate source identities', () => {
    expect(() => plan([callsite(0, 'false' as unknown as boolean)]))
      .toThrow(/invalid framedsite value metadata/);
    const grouped = { ...callsite(0, true), batchInvocations: [true, false].map((callValueEffect, index) => ({
      logicalIndex: index, sourceCallsiteId: 0, selector: '11111111', inputs: [], callValueEffect,
    })) };
    expect(() => plan([grouped], true, true)).toThrow(/source callsite.*disagrees/);
  });
});
