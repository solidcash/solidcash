import type { AbiFunction, ArgSource, Artifact, ExternalCallAbi, ExternalCallExpression } from '@solidcash/utils';
import { describe, expect, it, vi, type Mock } from 'vitest';
import type { FunctionArgument } from '../../src/Argument.js';
import type { ExternalCallUtxoGroup } from '../../src/stateful/external-call-utxo-group.js';
import { evaluateExternalExpression } from '../../src/stateful/sc-evaluate-external-expression.js';
import { resolveExternalArgs, type ResolveExternalArgsHost } from '../../src/stateful/sc-resolve-external-args.js';
import {
  resolveExternalExpressionReturns, type ResolveExternalExpressionReturnsHost,
} from '../../src/stateful/sc-resolve-external-expression-returns.js';
import type { StatefulContract } from '../../src/stateful/StatefulContract.js';
import {
  expandCreateBuilderLateTransitive,
  type ExpandCreateBuilderLateTransitiveHost,
} from '../../src/stateful/sc-expand-create-builder-late-transitive.js';

function edge(interfaceName: string, functionName = 'run'): ExternalCallAbi {
  return {
    interfaceName, functionName, callsiteId: 0, sourceEffectOrdinal: 0,
    argSources: [{ kind: 'forward', paramIndex: 0 }], requiredDataNftIndices: [],
  } as ExternalCallAbi;
}

function handler(name: string, calls: ExternalCallAbi[] = [], writesState = false): AbiFunction {
  return {
    name, selector: name === 'read' ? '00000002' : '00000001',
    inputs: [{ name: 'amount', type: 'uint256' }], externalCalls: calls, writesState,
  };
}

interface FixtureContract {
  categoryId: string;
  inner: {
    artifact: Artifact;
    lockingBytecode: string;
    stateLayout: { fields: never[]; collections: never[] };
  };
  _externalRegistry: Map<string, unknown>;
  getState(): Promise<Record<string, never>>;
  _resolveExternalArgs: ResolveExternalExpressionReturnsHost['resolveExternalArgs'];
}

type Tail<T extends unknown[]> = T extends [unknown, ...infer Rest] ? Rest : never;
type ExpressionFixture = FixtureContract & {
  _evaluateExternalExpression: ResolveExternalExpressionReturnsHost['evaluateExternalExpression'];
  _resolveExternalExpressionReturns(
    ...args: Tail<Parameters<typeof resolveExternalExpressionReturns>>
  ): ReturnType<typeof resolveExternalExpressionReturns>;
  _resolveCallAbi(name: string): AbiFunction | undefined;
};

function withExpressionResolution(target: FixtureContract): ExpressionFixture {
  const host: ResolveExternalExpressionReturnsHost & ResolveExternalArgsHost = {
    inner: { ...target.inner, provider: {} as ResolveExternalExpressionReturnsHost['inner']['provider'],
      encodedConstructorArgs: [] },
    categoryId: target.categoryId,
    externalRegistry: target._externalRegistry as Map<string, StatefulContract>,
    asCallerContract: () => target as unknown as StatefulContract,
    resolveExternalArgs: (...args) => resolveExternalArgs(host, ...args),
    evaluateExternalExpression: (...args) => evaluateExternalExpression(host, ...args),
  };
  return Object.assign(target, {
    _resolveExternalArgs: host.resolveExternalArgs,
    _evaluateExternalExpression: host.evaluateExternalExpression,
    _resolveExternalExpressionReturns: resolveExternalExpressionReturns.bind(undefined, host),
    _resolveCallAbi: (name: string) => target.inner.artifact.abi.find((fn) => fn.name === name),
  });
}

function contract(id: number, abi: AbiFunction[]): FixtureContract {
  return {
    categoryId: id.toString(16).padStart(64, '0'),
    inner: {
      artifact: { contractName: `Stage${id}`, abi } as Artifact,
      lockingBytecode: '51', stateLayout: { fields: [], collections: [] },
    },
    _externalRegistry: new Map<string, unknown>(),
    getState: async () => ({}),
    _resolveExternalArgs: (_sources: unknown, args: FunctionArgument[]) => [...args],
  };
}

function group(target: FixtureContract, functionName = 'run', amount = 9n): ExternalCallUtxoGroup {
  return {
    categoryId: target.categoryId, externalContract: target,
    functionName, functionArgs: [amount],
    stateLayout: target.inner.stateLayout as ExternalCallUtxoGroup['stateLayout'],
    masterUtxo: { txid: target.categoryId, vout: 0, satoshis: 1000n },
    dataNftUtxos: [], requiredDataNftIndices: [],
  };
}

type PreparationParams = Parameters<typeof expandCreateBuilderLateTransitive>[1];

function preparation(groups: ExternalCallUtxoGroup[]): {
  groups: ExternalCallUtxoGroup[];
  nodes: NonNullable<PreparationParams['preparedAtomicNodes']>;
  host: ExpandCreateBuilderLateTransitiveHost;
  params: PreparationParams;
  expand: () => ReturnType<typeof expandCreateBuilderLateTransitive>;
} {
  const root = { parent: null, active: true, args: [] };
  const nodes = [root, ...groups.map((value) => ({
    parent: 0, active: true, args: value.functionArgs,
    functionName: value.functionName, contract: value.externalContract,
  }))];
  const host: ExpandCreateBuilderLateTransitiveHost = {
    categoryId: '00'.repeat(32), inner: { provider: {} }, signer: undefined,
    externalRegistry: new Map(),
    nestedFullState: async (target: FixtureContract) => ({
      state: {}, masterUtxo: group(target).masterUtxo, dataNftUtxos: [],
    }),
    nestedAddressUtxos: async () => [],
    markSharedFunder: () => {}, shiftSharedFunder: () => undefined,
    nextNestedFunderIndex: () => 0,
    selectProxyForwardInput: () => new Uint8Array([0x51]),
    preparedChildProducerPath: () => ({ status: 'complete', context: { version: 1, sourcePath: [] } }),
    timing: () => {},
  };
  const params = {
    externalCallUtxoGroups: groups, lowLevelCallUtxoGroups: [],
    preparedAtomicNodes: nodes,
    preparedAtomicNodeByExternalGroup: new Map(groups.map((_, index) => [index, index + 1])),
    publicSelfAddress: new Uint8Array([0x51]),
    bags: {
      allGroupEcSlots: groups.map(() => ({ requiredDataNftIndices: [] })),
      allGroupParentIndices: groups.map(() => -1), lateTransitiveGroupIndices: new Set<number>(),
    },
  };
  return { groups, nodes, host, params, expand: () => expandCreateBuilderLateTransitive(host, params) };
}

describe('late transitive call preparation', () => {
  it('refuses sparse return carriers whose source index differs from their compact occurrence', async () => {
    const literal = (value: number): ExternalCallExpression => ({ kind: 'literal', type: 'bigint', value: String(value) });
    const loop: ExternalCallAbi = {
      ...edge('Source', 'read'), occurrence: 'loop', hasReturnValues: true, returnTypes: ['int'],
      iterationDomain: {
        counterName: 'i', initialValue: literal(0), stepValue: literal(1), maximumIterations: 3,
        continueCondition: { kind: 'binary', operator: '<', left: { kind: 'identifier', name: 'i' }, right: literal(3) },
      },
      condition: {
        kind: 'binary', operator: '!=', right: literal(1),
        left: { kind: 'source', source: { kind: 'loopIndex', initialValue: '0', stepValue: '1' } },
      },
    };
    const first = withExpressionResolution(contract(1, [handler('run', [loop])]));
    const fixture = preparation([group(first)]);
    await expect(fixture.expand()).rejects.toThrow(/return metadata has no per-occurrence source identity/);
    expect(fixture.nodes).toHaveLength(2);
  });

  it.each([true, false])('prepares only reached result-dependent branches and loop calls (choice %s)', async (choice) => {
    const result = (callsiteId: number, type: string): ExternalCallExpression => ({
      kind: 'producerResult', callsiteId, resultIndex: 0, type,
    });
    const choose = result(0, 'bool');
    const selected: ExternalCallExpression = {
      kind: 'ternary', condition: choose, ifTrue: result(1, 'int[5]'), ifFalse: result(2, 'int[5]'),
    };
    const iteration: ExternalCallExpression = {
      kind: 'source', source: { kind: 'loopIndex', initialValue: '0', stepValue: '1' },
    };
    const amount: ExternalCallExpression = { kind: 'arrayAccess', left: selected, right: iteration };
    const literal = (value: number): ExternalCallExpression => ({ kind: 'literal', type: 'bigint', value: String(value) });
    const reads: ExternalCallAbi[] = [
      { ...edge('Choice', 'read'), hasReturnValues: true, returnTypes: ['bool'] },
      { ...edge('Left', 'read'), callsiteId: 1, sourceEffectOrdinal: 1,
        condition: choose, hasReturnValues: true, returnTypes: ['int[5]'] },
      { ...edge('Right', 'read'), callsiteId: 2, sourceEffectOrdinal: 2,
        condition: { kind: 'unary', operator: '!', expression: choose },
        hasReturnValues: true, returnTypes: ['int[5]'] },
    ];
    const loop: ExternalCallAbi = {
      ...edge('Sink'), callsiteId: 3, sourceEffectOrdinal: 3, occurrence: 'loop', maximumOccurrences: 5,
      condition: { kind: 'binary', operator: '>', left: amount, right: literal(0) },
      argSources: [{ kind: 'expression', expression: amount }],
      iterationDomain: {
        counterName: 'i', initialValue: literal(0), stepValue: literal(1), maximumIterations: 5,
        continueCondition: { kind: 'binary', operator: '<', left: { kind: 'identifier', name: 'i' }, right: literal(5) },
      },
    };
    const fn: AbiFunction = { ...handler('run', [...reads, loop]), resultConsumers: [
      { consumerCallsiteId: 1, condition: true, producerCallsiteId: 0, resultIndex: 0 },
      { consumerCallsiteId: 2, condition: true, producerCallsiteId: 0, resultIndex: 0 },
      ...[0, 1, 2].flatMap((producerCallsiteId) => [
        { consumerCallsiteId: 3, condition: true, producerCallsiteId, resultIndex: 0 },
        { consumerCallsiteId: 3, argument: 0, producerCallsiteId, resultIndex: 0 },
      ]),
    ] };
    const first = withExpressionResolution(contract(1, [fn]));
    const reader = (
      id: number, type: string, value: FunctionArgument, active = true,
    ): ExpressionFixture & { _deriveReturnValue: Mock<() => Promise<FunctionArgument>> } => Object.assign(
      withExpressionResolution(contract(id, [{ ...handler('read'), outputs: [{ type }] }])), {
        _deriveReturnValue: vi.fn(async () => {
          if (!active) throw new Error('Inactive producer must not be probed');
          return value;
        }),
      },
    );
    const chooser = reader(2, 'bool', choice);
    const left = reader(3, 'int[5]', [0n, 31n, 0n, 53n, 0n], choice);
    const right = reader(4, 'int[5]', [0n, 71n, 0n, 97n, 0n], !choice);
    const sink = contract(5, [handler('run', [], true)]);
    for (const [name, target] of [['Choice', chooser], ['Left', left], ['Right', right], ['Sink', sink]] as const) {
      first._externalRegistry.set(name, target);
    }
    const fixture = preparation([group(first)]);
    await fixture.expand();
    const reached = fixture.nodes.filter((node) => node.contract === sink);
    expect(reached).toMatchObject([
      { parent: 1, callsiteId: 3, occurrenceIndex: 0, args: [choice ? 31n : 71n] },
      { parent: 1, callsiteId: 3, occurrenceIndex: 1, args: [choice ? 53n : 97n] },
    ]);
    expect((choice ? right : left)._deriveReturnValue).not.toHaveBeenCalled();
    expect((choice ? left : right)._deriveReturnValue).toHaveBeenCalledTimes(1);
    const refreshed: ReadonlyMap<number, FunctionArgument> = new Map([
      [0, choice], [choice ? 1 : 2, [0n, 101n, 0n, 103n, 0n]],
    ]);
    expect(reached.map((node) => node.resolveArgsFromResults!(refreshed))).toEqual([[101n], [103n]]);
  });

  it('prepares a late argument from its exact sibling producer and keeps the result refresh callback', async () => {
    const result = { kind: 'producerResult', callsiteId: 0, resultIndex: 0, type: 'uint256' } as const;
    const producer = { ...edge('Source', 'read'), hasReturnValues: true, returnTypes: ['uint256'] };
    const consumer = {
      ...edge('Sink'), callsiteId: 1, sourceEffectOrdinal: 1,
      argSources: [{ kind: 'expression', expression: result }],
    } as ExternalCallAbi;
    const source = Object.assign(contract(2, [{ ...handler('read'), outputs: [{ type: 'uint256' }] }]), {
      _deriveReturnValue: async () => 41n,
    });
    const sink = contract(3, [handler('run', [], true)]);
    const fn = { ...handler('run', [producer, consumer]), resultConsumers: [{
      consumerCallsiteId: 1, argument: 0, producerCallsiteId: 0, resultIndex: 0,
    }] };
    const resolveResults = vi.fn(async () => new Map([[JSON.stringify(result), 41n]]));
    const first = Object.assign(contract(1, [fn]), { _resolveExternalExpressionReturns: resolveResults });
    first._resolveExternalArgs = ((sources: readonly ArgSource[], args: FunctionArgument[], _artifact: Artifact,
      _state: unknown, _inputs: unknown, returns?: ReadonlyMap<string, FunctionArgument>) => {
      if (sources[0]?.kind !== 'expression') return [...args];
      const value = returns?.get(JSON.stringify(sources[0].expression));
      return value === undefined ? undefined : [value];
    }) as FixtureContract['_resolveExternalArgs'];
    first._externalRegistry.set('Source', source);
    first._externalRegistry.set('Sink', sink);
    const fixture = preparation([group(first)]);
    await fixture.expand();
    expect(fixture.groups.map((value) => value.categoryId)).toEqual([
      first.categoryId, source.categoryId, sink.categoryId,
    ]);
    const node = fixture.nodes.at(-1)!;
    expect(node).toMatchObject({ parent: 1, callsiteId: 1, args: [41n] });
    expect(node.resolveArgsFromResults(new Map([[0, 73n]]))).toEqual([73n]);
    expect(resolveResults).toHaveBeenCalledWith(
      consumer.argSources, [9n], first, {}, fn.inputs, new Uint8Array([0x51]),
      fn.externalCalls, true, expect.objectContaining({ entries: expect.any(Map) }),
      undefined, 0,
    );
  });

  it('closes newly appended descendants and keeps their exact logical arguments and parents', async () => {
    const leaf = contract(3, [handler('run', [], true)]);
    const middle = contract(2, [handler('run', [edge('Leaf')])]);
    const first = contract(1, [handler('run', [edge('Middle')])]);
    first._externalRegistry.set('Middle', middle);
    middle._externalRegistry.set('Leaf', leaf);
    const fixture = preparation([group(first)]);
    const result = await fixture.expand();
    expect(fixture.groups.map((value) => value.categoryId)).toEqual([
      first.categoryId, middle.categoryId, leaf.categoryId,
    ]);
    expect(fixture.nodes.map((value) => value.parent)).toEqual([null, 0, 1, 2]);
    expect(fixture.nodes.slice(1).map((value) => value.args)).toEqual([[9n], [9n], [9n]]);
    expect(result.allGroupParentIndices).toEqual([-1, 0, 1]);
  });

  it('does not replace an unvisited logical reader when a later writer takes its physical input', async () => {
    const leaf = contract(3, [handler('run')]);
    const shared = contract(2, [handler('read', [edge('Leaf')]), handler('run', [], true)]);
    const first = contract(1, [handler('run', [edge('Shared')])]);
    first._externalRegistry.set('Shared', shared);
    shared._externalRegistry.set('Leaf', leaf);
    const fixture = preparation([group(first, 'run', 7n), group(shared, 'read', 1n)]);
    await fixture.expand();
    expect(fixture.groups[1].functionName).toBe('run');
    expect(fixture.groups[1].functionArgs).toEqual([7n]);
    expect(fixture.groups.find((value) => value.categoryId === leaf.categoryId)?.functionArgs).toEqual([1n]);
    expect(fixture.nodes.at(-1)).toMatchObject({ parent: 2, args: [1n] });
  });

  it('expands proxy children with the implementation ABI and logical arguments, not the forward frame', async () => {
    const leaf = contract(4, [handler('run')]);
    const implementation = contract(3, [handler('run', [edge('Leaf')])]);
    implementation._externalRegistry.set('Leaf', leaf);
    const proxy = contract(2, [handler('__forward')]);
    const first = contract(1, [handler('run', [edge('Proxy')])]);
    first._externalRegistry.set('Proxy', { proxy, implementation, forward: () => undefined });
    const fixture = preparation([group(first)]);
    await fixture.expand();
    expect(fixture.groups[1].functionName).toBe('__forward');
    expect(fixture.groups[1].functionArgs).toEqual([new Uint8Array([0x51])]);
    expect(fixture.groups[1].logicalFunctionArgs).toEqual([9n]);
    expect(fixture.groups[2].externalContract).toBe(leaf);
    expect(fixture.groups[2].functionArgs).toEqual([9n]);
  });

  it('refuses recursive descendants at the deployed depth bound', async () => {
    const recursive = contract(1, [handler('run', [edge('Self')])]);
    recursive._externalRegistry.set('Self', recursive);
    const fixture = preparation([group(recursive)]);
    await expect(fixture.expand()).rejects.toMatchObject({
      code: 'L3_GRAPH_DEPTH_LIMIT', context: { measured: 8, limit: 7 },
    });
    expect(fixture.groups).toHaveLength(7);
  });
});
