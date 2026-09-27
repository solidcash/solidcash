import type { AbiFunction, Artifact, ExternalCallAbi } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import type { FunctionArgument } from '../../src/Argument.js';
import type { ExternalCallUtxoGroup } from '../../src/stateful/external-call-utxo-group.js';
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
  _resolveExternalArgs(sources: unknown, args: FunctionArgument[]): FunctionArgument[];
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
