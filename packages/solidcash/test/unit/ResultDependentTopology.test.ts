import { binToHex } from '@bitauth/libauth';
import type { Artifact, ExternalCallAbi, ExternalCallExpression } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import type { PreparedAtomicMessageBusCall } from '../../src/message-bus/compose.js';
import {
  propagateResultDependentArguments, type ResultPropagationContext,
} from '../../src/message-bus/compose-result-propagation.js';
import { resolveComposeParticipantIndexes } from '../../src/message-bus/compose-participant-indexes.js';
import {
  hasTransientConvergenceResultSeed, rebuildPreparedInvocation,
} from '../../src/message-bus/compose-prepared-invocation.js';
import { propagateResultDependentCallTopology } from '../../src/message-bus/compose-result-topology.js';
import { externalReturnsForCallsites } from '../../src/stateful/external-returns-for-callsites.js';
import type { StatefulContract } from '../../src/stateful/StatefulContract.js';

const producer: ExternalCallExpression = { kind: 'producerResult', callsiteId: 0, resultIndex: 0 };
const sources: ExternalCallAbi[] = [
  { callsiteId: 0, interfaceName: 'ISource', functionName: 'read', requiredDataNftIndices: [],
    returnTypes: ['bool'], argSources: [] },
  { callsiteId: 1, interfaceName: 'IGood', functionName: 'run', requiredDataNftIndices: [],
    condition: producer, occurrence: 'conditional', sourceEffectOrdinal: 1, argSources: [] },
  { callsiteId: 2, interfaceName: 'IBad', functionName: 'run', requiredDataNftIndices: [],
    condition: { kind: 'unary', operator: '!', expression: producer }, occurrence: 'conditional',
    sourceEffectOrdinal: 2, argSources: [] },
  { callsiteId: 3, interfaceName: 'ITail', functionName: 'run', requiredDataNftIndices: [],
    returnTypes: ['uint256'], argSources: [] },
];
const lanes = [1, 2].map((consumerCallsiteId) => ({
  consumerCallsiteId, producerCallsiteId: 0, resultIndex: 0, condition: true as const,
}));

function fixture(): ResultPropagationContext & {
  rootCaller: Uint8Array;
  stateOf: () => Promise<Record<string, unknown>>;
} {
  const contract = (id: number): StatefulContract => ({
    categoryId: id.toString(16).padStart(64, '0'),
    inner: { provider: {}, lockingBytecode: '51', artifact: {
      abi: [{ name: 'run', selector: '00000001', inputs: [] }],
    } },
    _externalRegistry: new Map(),
    _resolveExternalArgs: () => [],
  }) as unknown as StatefulContract;
  const owners = Array.from({ length: 6 }, (_, index) => contract(index));
  Object.assign(owners[1].inner.artifact.abi[0], { name: 'read' });
  const artifact = owners[0].inner.artifact;
  Object.assign(artifact.abi[0], { externalCalls: sources, resultConsumers: lanes });
  const registry = (owners[0] as unknown as { _externalRegistry: Map<string, StatefulContract> })._externalRegistry;
  registry.set('ISource', owners[1]);
  registry.set('IGood', owners[5]);
  registry.set('IBad', owners[2]);
  registry.set('ITail', owners[4]);
  const rows = [
    { index: 0, parent: null, callee: 0, resultTypes: [] },
    { index: 1, parent: 0, callee: 1, consumerCallsiteId: 0, resultTypes: ['bool'] },
    { index: 2, parent: 0, callee: 2, consumerCallsiteId: 2, resultTypes: [] },
    { index: 3, parent: 2, callee: 3, consumerCallsiteId: 0, resultTypes: [] },
    { index: 4, parent: 0, callee: 4, consumerCallsiteId: 3, resultTypes: ['uint256'] },
  ].map((row) => ({ ...row, resultEncoding: 'evm-abi-v1' }));
  const calls: PreparedAtomicMessageBusCall[] = rows.map((row) => ({
    contract: owners[row.index], functionName: row.index === 1 ? 'read' : 'run', selector: '00000001', args: [],
    callsiteId: row.consumerCallsiteId, occurrenceIndex: 0,
    producerPath: { status: 'complete', context: { version: 1, sourcePath: [] } },
  }));
  return {
    plan: { invocations: rows, participants: owners.map((owner) => ({ artifact: owner.inner.artifact })) },
    returning: [rows[1], rows[4]],
    descriptors: calls.map((call) => ({ ...call, artifact: call.contract.inner.artifact as Artifact })),
    rootCaller: new Uint8Array(), stateOf: async () => ({}),
  } as unknown as ReturnType<typeof fixture>;
}

describe('result-dependent topology propagation', () => {
  it('replaces the selected subtree without moving a later producer seed to the new branch', async () => {
    const ctx = fixture();
    const results = { 1: '01'.padStart(64, '0'), 4: '4d'.padStart(64, '0') };
    const args = propagateResultDependentArguments(ctx, results);
    const changed = await propagateResultDependentCallTopology(ctx, args.calls, results);
    expect(changed.propagated).toBe(true);
    expect(changed.calls.map((call) => call.callsiteId)).toEqual([undefined, 0, 1, 3]);
    expect(changed.calls[2].provisionalResultCommitment).toBeUndefined();
    expect(binToHex(changed.calls[1].provisionalResultCommitment!)).toBe(results[1]);
    expect(binToHex(changed.calls[3].provisionalResultCommitment!)).toBe(results[4]);
    expect(changed.calls.some((call) => call.contract === ctx.descriptors[3].contract)).toBe(false);
  });

  it('keeps provisional restart results separate from caller-prepared commitments', async () => {
    const ctx = fixture();
    const observed = new Uint8Array(32);
    observed[31] = 1;
    const zero = new Uint8Array(32);
    const transient = rebuildPreparedInvocation(ctx.descriptors[1], [], binToHex(observed));
    expect(binToHex(transient.provisionalResultCommitment!)).toBe(binToHex(observed));
    expect(hasTransientConvergenceResultSeed(transient)).toBe(true);
    // Descriptor normalization spreads its fields on every recursive composition pass. The private provenance
    // must survive that internal spread while an independently supplied commitment remains strict.
    const spreadTransient = { ...transient, artifact: ctx.descriptors[1].artifact };
    expect(hasTransientConvergenceResultSeed(spreadTransient)).toBe(true);
    const supplied = { ...ctx.descriptors[1], provisionalResultCommitment: zero };
    const stillStrict = rebuildPreparedInvocation(supplied, [], binToHex(observed));
    expect(binToHex(stillStrict.provisionalResultCommitment!)).toBe(binToHex(zero));
    expect(hasTransientConvergenceResultSeed(stillStrict)).toBe(false);

    const participants = ctx.plan.participants.slice(0, ctx.descriptors.length).map((participant, index) => ({
      ...participant, lockingBytecode: (index + 1).toString(16).padStart(2, '0'),
    }));
    const descriptors = ctx.descriptors.map((descriptor, index) => ({
      ...descriptor,
      contract: {
        ...descriptor.contract,
        inner: {
          ...descriptor.contract.inner,
          lockingBytecode: participants[index].lockingBytecode,
        },
      },
    }));
    const softIndexes = await resolveComposeParticipantIndexes(
      { ...ctx.plan, participants } as never,
      descriptors.map((descriptor, index) => index === 1
        ? { ...spreadTransient, contract: descriptor.contract } : descriptor) as never,
      {} as never,
    );
    expect(softIndexes.preparedResults[1]).toBeUndefined();
    expect(softIndexes.provisionalResults[1]).toBe(binToHex(observed));

    const strictIndexes = await resolveComposeParticipantIndexes(
      { ...ctx.plan, participants } as never,
      descriptors.map((descriptor, index) => index === 1
        ? { ...stillStrict, contract: descriptor.contract } : descriptor) as never,
      {} as never,
    );
    expect(strictIndexes.preparedResults[1]).toBe(binToHex(zero));
  });

  it('keeps a speculative subtree while its guard producer is still unknown', async () => {
    const ctx = fixture();
    const results = { 4: '4d'.padStart(64, '0') };
    const args = propagateResultDependentArguments(ctx, results);
    const unchanged = await propagateResultDependentCallTopology(ctx, args.calls, results);
    expect(unchanged.propagated).toBe(false);
    expect(unchanged.calls.map((call) => call.contract)).toEqual(ctx.descriptors.map((call) => call.contract));
  });

  it('retains graph-inferred child callsites when prepared descriptors omit their optional IDs', async () => {
    const ctx = fixture();
    for (const child of ctx.descriptors.slice(1)) delete child.callsiteId;
    const results = { 1: '01'.padStart(64, '0'), 4: '4d'.padStart(64, '0') };
    const prepared = propagateResultDependentArguments(ctx, results).calls;
    const changed = await propagateResultDependentCallTopology(ctx, prepared, results);
    expect(changed.propagated).toBe(true);
    expect(changed.calls).toHaveLength(4);
    expect(changed.calls[0].contract).toBe(ctx.descriptors[0].contract);
    expect(changed.calls[1].contract).toBe(ctx.descriptors[1].contract);
    expect(changed.calls[2].contract).not.toBe(ctx.descriptors[2].contract);
    expect(changed.calls[3].contract).toBe(ctx.descriptors[4].contract);
  });

  it('binds guard results only through a published condition lane', () => {
    const args = [{ kind: 'expression' as const, expression: producer }];
    const results = new Map([[0, true]]);
    expect(externalReturnsForCallsites(args, results, sources, {
      callsiteId: 1, resultConsumers: lanes, lane: 'condition',
    }).get(JSON.stringify(producer))).toBe(true);
    expect(() => externalReturnsForCallsites(args, results, sources, {
      callsiteId: 1, resultConsumers: [{ consumerCallsiteId: 1, producerCallsiteId: 0, argument: 0 }],
      lane: 'condition',
    })).toThrow(/published consumer lane/);
    expect(() => externalReturnsForCallsites(args, results, sources, {
      callsiteId: 1, resultConsumers: lanes,
    })).toThrow(/published consumer lane/);
  });

  it('preserves an unrelated prepared loop without requiring a new iteration domain', async () => {
    const ctx = fixture();
    const fn = ctx.descriptors[0].artifact.abi[0];
    Object.assign(fn, { externalCalls: [...sources, {
      callsiteId: 4, interfaceName: 'IUnused', functionName: 'run', occurrence: 'loop',
      requiredDataNftIndices: [], condition: {
        kind: 'source', source: { kind: 'forward', paramIndex: 0 },
      },
    }] });
    ctx.descriptors[0].args = [false];
    const results = { 1: '01'.padStart(64, '0') };
    const args = propagateResultDependentArguments(ctx, results);
    const changed = await propagateResultDependentCallTopology(ctx, args.calls, results);
    expect(changed.calls.map((call) => call.callsiteId)).toEqual([undefined, 0, 1, 3]);
  });

  it('refreshes descendants when their parent arguments change without changing reachability', async () => {
    const ctx = fixture();
    ctx.descriptors[2].args = [1n];
    ctx.descriptors[3].args = [2n];
    ctx.descriptors[3].resolveArgsFromResults = (_results, frame) => [2n * (frame![0] as bigint)];
    Object.assign(ctx.descriptors[2].artifact.abi[0], {
      inputs: [{ name: 'value', type: 'uint256' }],
      externalCalls: [{ callsiteId: 0, interfaceName: 'ILeaf', functionName: 'run',
        requiredDataNftIndices: [], argSources: [{ kind: 'forward', paramIndex: 0 }] }],
    });
    const prepared = ctx.descriptors.map((call, index) => ({ ...call, args: index === 2 ? [3n] : call.args }));
    const changed = await propagateResultDependentCallTopology(ctx, prepared, {});
    expect(changed.propagated).toBe(true);
    expect(changed.calls[3].args).toEqual([6n]);
    expect(changed.calls.map((call) => call.contract)).toEqual(ctx.descriptors.map((call) => call.contract));
  });
});
