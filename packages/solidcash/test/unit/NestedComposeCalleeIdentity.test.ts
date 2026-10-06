import { binToHex } from '@bitauth/libauth';
import type { AbiFunction, ArgSource, Artifact, ExternalCallAbi } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import type { FunctionArgument } from '../../src/Argument.js';
import {
  resolveCreateBuilderNestedComposeCallee,
  type ResolveCreateBuilderNestedComposeCalleeHost,
} from '../../src/stateful/sc-resolve-create-builder-nested-compose-callee.js';
import { createTestProvider } from '../test-util.js';

const target = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x58), 0x87);
const other = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x59), 0x87);
const artifact = { contractName: 'Delegate', abi: [], constructorInputs: [] } as unknown as Artifact;
const nested = {
  interfaceName: 'ITarget', functionName: 'ping', requiredDataNftIndices: [], argSources: [],
  addressSource: { kind: 'expression', expression: { kind: 'state', name: 'target' } },
} as ExternalCallAbi;
const delegateFn = { name: 'run', inputs: [] } as unknown as AbiFunction;

function connected(lockingBytecode: Uint8Array): {
  inner: { lockingBytecode: string; artifact: { contractName: string; abi: { name: string; inputs: never[] }[] } };
} {
  return {
    inner: {
      lockingBytecode: binToHex(lockingBytecode),
      artifact: { contractName: 'Target', abi: [{ name: 'ping', inputs: [] }] },
    },
  };
}

function resolve(callee: unknown, state: Record<string, unknown>, edge = nested):
ReturnType<typeof resolveCreateBuilderNestedComposeCallee> {
  const host: ResolveCreateBuilderNestedComposeCalleeHost = {
    provider: createTestProvider(),
    resolveExternalArgs: (sources: readonly ArgSource[] | undefined, _args: FunctionArgument[],
      _artifact: Artifact, snapshot?: Record<string, unknown>) => {
      if (!sources) return undefined;
      if (sources.length === 0) return [];
      const value = snapshot?.target;
      return sources[0]?.kind === 'expression' && value instanceof Uint8Array ? [value] : undefined;
    },
    resolveExternalExpressionReturns: async () => undefined,
    nestedIdentity: async () => undefined,
    callerRegistryValues: () => [],
    callerRegistryGet: () => callee,
    calleeRegistryValues: () => [],
    calleeRegistryGet: () => undefined,
  };
  return resolveCreateBuilderNestedComposeCallee(host, {
    nested: edge,
    delegateVisibleArgs: [],
    delegateVisibleInputs: [],
    delegateFn,
    callInfoContract: { _externalRegistry: new Map(), inner: { artifact } },
    onChainState: { state },
    delegateSelfAddress: new Uint8Array(),
    publishedNestedExternalCalls: [edge],
    preparedAtomicNodes: undefined,
    graphPlanningResults: undefined,
  });
}

describe('nested delegate callee identity', () => {
  it('uses a connected callee whose physical address matches the published target', async () => {
    const callee = connected(target);
    const result = await resolve(callee, { target });
    expect(result.skip).toBe(false);
    if (!result.skip) expect(result.callee).toBe(callee);
  });

  it('does not redirect a published target to a different interface-bound callee', async () => {
    const wrong = connected(other);
    await expect(resolve(wrong, { target })).rejects.toThrow('not connected');
    await expect(resolve(wrong, {})).rejects.toThrow('not connected');
  });
});
