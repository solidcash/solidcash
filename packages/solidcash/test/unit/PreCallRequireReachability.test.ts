import { describe, expect, it, vi } from 'vitest';
import type { Artifact, ExternalCallExpression } from '@solidcash/utils';
import { StatefulContract } from '../../src/stateful/index.js';
import { materializeCreateBuilderLowLevelStatefulCall } from '../../src/stateful/sc-materialize-create-builder-low-level-stateful-call.js';
import { createTestProvider } from '../test-util.js';

const caller = Uint8Array.of(0x53);
const worker = Uint8Array.of(0x52);
const guard: ExternalCallExpression = {
  kind: 'binary', operator: '==',
  left: { kind: 'field', name: 'worker', expression: {
    kind: 'stateAccess', name: 'jobs', args: [{ kind: 'source', source: { kind: 'forward', paramIndex: 0 } }],
  } },
  right: { kind: 'source', source: { kind: 'msgSender' }, type: 'address' },
};
const artifact = {
  bytecode: '51', constructorInputs: [], contractName: 'GuardHost',
  compiler: { name: 'solidc', version: '0.13.0' },
  abi: [{ name: 'refund', inputs: [{ name: 'jobId', type: 'uint256' }], externalCalls: [{
    callsiteId: 0, interfaceName: 'IUnicrow', functionName: 'refund',
    requiredDataNftIndices: [], preCallRequires: [guard],
  }] }],
  stateLayout: { variables: [], structs: [], collections: [{
    kind: 'mapping', name: 'jobs', signature: 'jobs:mapping(uint256=>Job)',
    keyType: 'uint256', keyTypes: ['uint256'], valueType: 'Job',
  }] },
} as unknown as Artifact;
const evaluator = new StatefulContract('00'.repeat(32), artifact, createTestProvider()) as any;

describe('delegate pre-call require reachability', () => {
  const materialize = async (authenticatedWorker: Uint8Array | undefined): Promise<{
    result: Awaited<ReturnType<typeof materializeCreateBuilderLowLevelStatefulCall>>;
    getEntries: ReturnType<typeof vi.fn>;
  }> => {
    const getEntries = vi.fn(async () => authenticatedWorker === undefined ? [] : [{
      key: 7n, value: { worker: authenticatedWorker },
    }]);
    const callInfo = { type: 'stateful', functionName: 'refund', args: [7n], contract: {
      categoryId: '11'.repeat(32), inner: {
        artifact, stateLayout: { dataNftCount: 0 }, lockingBytecode: '51',
      },
    } };
    const result = await materializeCreateBuilderLowLevelStatefulCall({
      categoryId: '22'.repeat(32), inner: {}, selfContract: {},
      getMasterOnlyState: async () => ({ masterUtxo: {} }),
      getFullState: async () => ({ masterUtxo: {}, dataNftUtxos: [] }),
      getEntries,
      statefulCall: () => [7n],
      resolveExternalExpressionReturns: async () => undefined,
      evaluateExternalExpression: (...args: any[]) => evaluator._evaluateExternalExpression(...args),
    }, {
      callInfo, callMode: 'delegatecall', lowLevelCallUtxoGroups: [],
      groupProxyMasterIndices: [], abiFunction: undefined, physicalAbiFunction: undefined,
      functionName: 'refund', args: [7n], callIndex: 0, preparedAtomicNodes: [],
      rootProducerPath: { status: 'unavailable' },
      publicSelfAddress: Uint8Array.of(0x51), authenticatedSelfAddress: Uint8Array.of(0x51),
      incomingCallerAddress: caller, onChainState: { state: {} },
    });
    return { result, getEntries };
  };

  it('omits an unreachable callee before looking up its resources', async () => {
    const { result, getEntries } = await materialize(worker);
    expect(getEntries).toHaveBeenCalledOnce();
    expect(result.publishedNestedExternalCalls).toHaveLength(1);
    expect(result.nestedExternalCalls).toHaveLength(0);
  });

  it('retains reachable and unresolved callees', async () => {
    expect((await materialize(caller)).result.nestedExternalCalls).toHaveLength(1);
    expect((await materialize(undefined)).result.nestedExternalCalls).toHaveLength(1);
  });
});
