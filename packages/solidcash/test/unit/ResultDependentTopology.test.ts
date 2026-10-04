import { binToHex } from '@bitauth/libauth';
import type { Artifact, ExternalCallAbi, ExternalCallExpression } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  AtomicMessageBusComposition, compose, composeDiscoveredGraph, type PreparedAtomicMessageBusCall,
} from '../../src/message-bus/compose.js';
import {
  propagateResultDependentArguments, type ResultPropagationContext,
} from '../../src/message-bus/compose-result-propagation.js';
import { resolveComposeParticipantIndexes } from '../../src/message-bus/compose-participant-indexes.js';
import {
  hasTransientConvergenceResultSeed, rebuildPreparedInvocation,
} from '../../src/message-bus/compose-prepared-invocation.js';
import {
  discoverInitialCallTopology, propagateResultDependentCallTopology,
} from '../../src/message-bus/compose-result-topology.js';
import { externalReturnsForCallsites } from '../../src/stateful/external-returns-for-callsites.js';
import { encodeExternalReturnValue } from '../../src/stateful/external-return-encoding.js';
import { failedProbeCannotReplaceTransientSeed } from '../../src/stateful/sc-derive-return-blob.js';
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
  it('does not prune a producer-result require from a provisional false seed', async () => {
    const ctx = fixture();
    const root = ctx.descriptors[0];
    root.artifact.abi[0]!.externalCalls = [
      { ...sources[0]!, hasReturnValues: true, sourceEffectOrdinal: 0 },
      { ...sources[1]!, occurrence: 'conditional', condition: undefined,
        preCallRequires: [producer], sourceEffectOrdinal: 1 },
    ];
    // The first return has no strict view proof, so discovery seeds its bool schema with false.
    // That candidate must not become proof that the following source require failed.
    const discovered = await discoverInitialCallTopology(root, new Uint8Array(), ctx.stateOf);
    expect(discovered.calls.map((call) => call.callsiteId)).toEqual([undefined, 0, 1]);

    root.artifact.abi[0]!.externalCalls![1]!.preCallRequires = [{
      kind: 'literal', type: 'bool', value: false,
    }];
    const rejected = await discoverInitialCallTopology(root, new Uint8Array(), ctx.stateOf);
    expect(rejected.calls.map((call) => call.callsiteId)).toEqual([undefined, 0]);
  });

  it('omits an unresolved edge only when an earlier source require is provably false', async () => {
    const ctx = fixture();
    const root = ctx.descriptors[0];
    const noCode: ExternalCallExpression = {
      kind: 'binary', operator: '>',
      left: {
        kind: 'addressCodeLength', type: 'bigint',
        expression: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
      },
      right: { kind: 'literal', type: 'bigint', value: '0' },
    };
    root.artifact.abi[0]!.inputs = [{ name: 'target', type: 'address' }];
    root.artifact.abi[0]!.externalCalls = [{
      callsiteId: 0, interfaceName: 'IUnregistered', functionName: 'run',
      requiredDataNftIndices: [], preCallRequires: [noCode], argSources: [],
    }];
    (root.contract as unknown as { _resolveExternalArgs: unknown })._resolveExternalArgs = (
      argSources: readonly { kind: string; paramIndex?: number }[], args: readonly unknown[],
    ) => argSources.map((source) => source.kind === 'forward' ? args[source.paramIndex!] : undefined);
    root.args = [`0x${'00'.repeat(20)}`];
    expect((await discoverInitialCallTopology(root, new Uint8Array(), ctx.stateOf)).calls).toEqual([root]);
    root.args = [`0xaa20${'01'.repeat(32)}87`];
    await expect(discoverInitialCallTopology(root, new Uint8Array(), ctx.stateOf))
      .rejects.toThrow(/cannot resolve newly reached callsite 0/);
    root.artifact.abi[0]!.externalCalls![0]!.preCallRequires = [{
      kind: 'binary', operator: '==',
      left: { kind: 'state', name: 'flag' },
      right: { kind: 'literal', type: 'bigint', value: '1' },
    }];
    await expect(discoverInitialCallTopology(root, new Uint8Array(), async () => ({ flag: 0n })))
      .rejects.toThrow(/cannot resolve newly reached callsite 0/);
  });

  it('keeps a compiler-published callee address authoritative in graph discovery', async () => {
    const ctx = fixture();
    const root = ctx.descriptors[0];
    root.artifact.abi[0]!.externalCalls = [{
      callsiteId: 0, interfaceName: 'ISource', functionName: 'read',
      requiredDataNftIndices: [], argSources: [],
      addressSource: { kind: 'forward', paramIndex: 0 },
    }];
    (root.contract as unknown as { _resolveExternalArgs: unknown })._resolveExternalArgs = (
      argSources: readonly { kind: string; paramIndex?: number }[], args: readonly unknown[],
    ) => argSources.map((source) => source.kind === 'forward' ? args[source.paramIndex!] : undefined);

    root.args = [Uint8Array.of(0x51)];
    expect((await discoverInitialCallTopology(root, new Uint8Array(), ctx.stateOf)).calls[1]?.contract)
      .toBe(ctx.descriptors[1].contract);
    root.args = [Uint8Array.of(0x52)];
    await expect(discoverInitialCallTopology(root, new Uint8Array(), ctx.stateOf))
      .rejects.toThrow(/cannot resolve newly reached callsite 0/);
  });

  it('seeds a scalar leaf view without pinning its graph return', async () => {
    const ctx = fixture();
    const root = ctx.descriptors[0];
    root.artifact.abi[0]!.externalCalls = [{ ...sources[0]!, hasReturnValues: true,
      returnTypes: ['uint256'] }];
    const child = ctx.descriptors[1].contract;
    Object.assign(child.inner.artifact.abi[0], {
      outputs: [{ type: 'uint256' }], modifiers: ['view'], writesState: false,
      resultEncoding: 'compact-pushdata-v1',
    });
    (child as unknown as { _deriveReturnValue: unknown })._deriveReturnValue = async () => 7n;
    const discovered = await discoverInitialCallTopology(root, new Uint8Array(), ctx.stateOf);
    expect(discovered).toHaveLength(2);
    expect(discovered[1]?.provisionalResultCommitment).toEqual(encodeExternalReturnValue(
      7n, 'uint256', undefined, false,
    ));
    expect(hasTransientConvergenceResultSeed(discovered[1]!)).toBe(true);
  });

  it('reuses a one-shot producer result across every guarded loop iteration', async () => {
    const ctx = fixture();
    const root = ctx.descriptors[0];
    const source = ctx.descriptors[1];
    const literal = (value: number): ExternalCallExpression => ({
      kind: 'literal', type: 'bigint', value: String(value),
    });
    const index: ExternalCallExpression = {
      kind: 'source', source: { kind: 'loopIndex', initialValue: '0', stepValue: '1' },
    };
    const result: ExternalCallExpression = {
      kind: 'producerResult', callsiteId: 0, resultIndex: 0, type: 'uint256',
    };
    root.artifact.abi[0]!.externalCalls = [
      { ...sources[0]!, hasReturnValues: true, returnTypes: ['uint256'], sourceEffectOrdinal: 0 },
      { callsiteId: 1, interfaceName: 'ISink', functionName: 'run', requiredDataNftIndices: [],
        sourceEffectOrdinal: 1, occurrence: 'loop', maximumOccurrences: 5, argSources: [],
        condition: { kind: 'binary', operator: '>', left: result, right: index },
        iterationDomain: {
          counterName: 'i', initialValue: literal(0), stepValue: literal(1), maximumIterations: 5,
          continueCondition: { kind: 'binary', operator: '<',
            left: { kind: 'identifier', name: 'i' }, right: literal(5) },
        } },
    ];
    root.artifact.abi[0]!.resultConsumers = [{
      consumerCallsiteId: 1, producerCallsiteId: 0, resultIndex: 0, condition: true,
    }];
    (root.contract as unknown as { _externalRegistry: Map<string, StatefulContract> })
      ._externalRegistry.set('ISink', ctx.descriptors[2].contract);
    (root.contract as unknown as { _resolveExternalArgs: unknown })._resolveExternalArgs = (
      argSources: readonly { kind: string; initialValue?: string; stepValue?: string }[],
      _args: readonly unknown[], _artifact: Artifact, _state: unknown, _inputs: unknown,
      _returns: unknown, occurrenceIndex = 0,
    ) => argSources.map((argSource) => argSource.kind === 'loopIndex'
      ? BigInt(argSource.initialValue!) + BigInt(argSource.stepValue!) * BigInt(occurrenceIndex)
      : undefined);
    source.contract.inner.artifact.abi[0]!.outputs = [{ type: 'uint256' }];
    ctx.plan.invocations = ctx.plan.invocations.slice(0, 2);
    ctx.plan.invocations[1]!.resultTypes = ['uint256'];
    ctx.returning = [ctx.plan.invocations[1]];
    ctx.descriptors = [root, source];
    const encoded = encodeExternalReturnValue(3n, 'uint256', undefined, true);
    const changed = await propagateResultDependentCallTopology(
      ctx, [root, source], { 1: binToHex(encoded) },
    );
    expect(changed.propagated).toBe(true);
    expect(changed.calls.filter((call) => call.callsiteId === 1).map((call) => call.occurrenceIndex))
      .toEqual([0, 1, 2]);
  });

  it('does not seed a view after an earlier write to its participant', async () => {
    const ctx = fixture();
    const root = ctx.descriptors[0];
    root.artifact.abi[0]!.externalCalls = [
      { callsiteId: 0, interfaceName: 'ISource', functionName: 'transferFrom',
        requiredDataNftIndices: [], argSources: [], sourceEffectOrdinal: 0 },
      { callsiteId: 1, interfaceName: 'ISource', functionName: 'read',
        requiredDataNftIndices: [], argSources: [], sourceEffectOrdinal: 1,
        hasReturnValues: true, returnTypes: ['uint256'] },
    ];
    const child = ctx.descriptors[1].contract;
    child.inner.artifact.abi.unshift({ name: 'transferFrom', selector: '00000002', inputs: [],
      writesState: true } as Artifact['abi'][number]);
    Object.assign(child.inner.artifact.abi[1], {
      outputs: [{ type: 'uint256' }], modifiers: ['view'], writesState: false,
      resultEncoding: 'compact-pushdata-v1',
    });
    let probes = 0;
    (child as unknown as { _deriveReturnValue: unknown })._deriveReturnValue = async () => {
      probes += 1;
      return 7n;
    };
    const discovered = await discoverInitialCallTopology(root, new Uint8Array(), ctx.stateOf);
    expect(discovered.map((call) => call.functionName)).toEqual(['run', 'transferFrom', 'read']);
    expect(discovered[2]?.provisionalResultCommitment).toBeUndefined();
    expect(probes).toBe(0);
  });

  it('does not seed a declared view without the compiler read-only proof', async () => {
    const ctx = fixture();
    const root = ctx.descriptors[0];
    root.artifact.abi[0]!.externalCalls = [{ ...sources[0]!, hasReturnValues: true,
      returnTypes: ['uint256'] }];
    const child = ctx.descriptors[1].contract;
    Object.assign(child.inner.artifact.abi[0], {
      outputs: [{ type: 'uint256' }], modifiers: ['view'],
      resultEncoding: 'compact-pushdata-v1',
    });
    let probes = 0;
    (child as unknown as { _deriveReturnValue: unknown })._deriveReturnValue = async () => {
      probes += 1;
      return 7n;
    };
    const discovered = await discoverInitialCallTopology(root, new Uint8Array(), ctx.stateOf);
    expect(discovered[1]?.provisionalResultCommitment).toBeUndefined();
    expect(probes).toBe(0);
  });

  it('retains a transient seed when a failed trace only pins the provisional return', () => {
    expect(failedProbeCannotReplaceTransientSeed(true, undefined, 'aa')).toBe(true);
    expect(failedProbeCannotReplaceTransientSeed(true, 'aa', 'aa')).toBe(true);
    expect(failedProbeCannotReplaceTransientSeed(true, 'bb', 'aa')).toBe(false);
    expect(failedProbeCannotReplaceTransientSeed(false, 'aa', 'aa')).toBe(false);
  });

  it('discovers a missing void child after its argument producer returns', async () => {
    const ctx = fixture();
    const root = ctx.descriptors[0].contract;
    const fn = root.inner.artifact.abi[0];
    fn.externalCalls = [
      sources[0],
      { ...sources[1], condition: undefined, argSources: [{ kind: 'expression', expression: producer }] },
      sources[3],
    ];
    fn.resultConsumers = [{ consumerCallsiteId: 1, argument: 0, producerCallsiteId: 0, resultIndex: 0 }];
    Object.assign(root, {
      _resolveExternalArgs: (argSources: readonly { expression?: ExternalCallExpression }[], ...rest: unknown[]) => {
        const returns = rest[4] as ReadonlyMap<string, boolean> | undefined;
        return argSources.map((source) => source.expression
          ? returns?.get(JSON.stringify(source.expression)) : undefined);
      },
    });
    const rows = [ctx.plan.invocations[0], ctx.plan.invocations[1],
      { ...ctx.plan.invocations[4], index: 2 }];
    ctx.plan = { ...ctx.plan, invocations: rows };
    ctx.descriptors = [ctx.descriptors[0], ctx.descriptors[1], ctx.descriptors[4]];
    ctx.returning = [rows[1], rows[2]];

    const results = { 1: '01'.padStart(64, '0') };
    const argumentsResult = propagateResultDependentArguments(ctx, results);
    const changed = await propagateResultDependentCallTopology(ctx, argumentsResult.calls, results);
    expect(changed.propagated).toBe(true);
    expect(changed.calls.map((call) => call.callsiteId)).toEqual([undefined, 0, 1, 3]);
    expect(changed.calls[2].args).toEqual([true]);
  });

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

  it('normalizes public composition entries before classifying a caller result seed', () => {
    const ctx = fixture();
    const transient = rebuildPreparedInvocation(ctx.descriptors[1], [], '01'.padStart(64, '0'));
    const supplied = new Uint8Array(32);
    supplied[31] = 7;
    const callerObject = Object.assign(Object.create({}), transient, {
      provisionalResultCommitment: supplied,
    }) as PreparedAtomicMessageBusCall;
    expect(hasTransientConvergenceResultSeed(callerObject)).toBe(true);
    const options = {
      preparedCalls: [ctx.descriptors[0], callerObject], funder: {} as never, changeAddress: '',
    };
    const preparedCall = (composition: AtomicMessageBusComposition): PreparedAtomicMessageBusCall => (
      (composition as unknown as {
        options: { preparedCalls: readonly PreparedAtomicMessageBusCall[] };
      }).options.preparedCalls[1]
    );

    const direct = preparedCall(new AtomicMessageBusComposition(options));
    expect(direct).not.toBe(callerObject);
    expect(hasTransientConvergenceResultSeed(direct)).toBe(false);
    expect(direct.provisionalResultCommitment).toEqual(supplied);
    expect(direct.provisionalResultCommitment).not.toBe(supplied);

    const wrapped = preparedCall(compose(options));
    expect(wrapped).not.toBe(callerObject);
    expect(hasTransientConvergenceResultSeed(wrapped)).toBe(false);
    expect(wrapped.provisionalResultCommitment).toEqual(supplied);

    const internal = preparedCall(composeDiscoveredGraph({
      ...options, preparedCalls: [ctx.descriptors[0], transient],
    }));
    expect(internal).not.toBe(transient);
    expect(internal.provisionalResultCommitment).toEqual(transient.provisionalResultCommitment);
    expect(internal.provisionalResultCommitment).not.toBe(transient.provisionalResultCommitment);
    expect(hasTransientConvergenceResultSeed(internal)).toBe(true);
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
