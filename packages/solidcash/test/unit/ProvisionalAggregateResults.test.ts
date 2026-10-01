import type { ArgSource, Artifact, ExternalCallAbi, ExternalCallExpression, StructDefinitionInfo } from '@solidcash/utils';
import { describe, expect, it, vi, type Mock } from 'vitest';
import type { FunctionArgument } from '../../src/Argument.js';
import { evaluateExternalExpression } from '../../src/stateful/sc-evaluate-external-expression.js';
import { resolveExternalArgs, type ResolveExternalArgsHost } from '../../src/stateful/sc-resolve-external-args.js';
import {
  resolveExternalExpressionReturns, type ResolveExternalExpressionReturnsHost,
} from '../../src/stateful/sc-resolve-external-expression-returns.js';
import { createGraphPlanningProducerResultContext } from '../../src/stateful/graph-planning-producer-result.js';
import {
  DeferredTransitiveReturnProbeError,
} from '../../src/stateful/sc-discover-create-builder-transitive-external-calls.js';
import type { StatefulContract } from '../../src/stateful/StatefulContract.js';
import { createTestProvider } from '../test-util.js';

type ProvisionalFixture = {
  derive: Mock<() => Promise<FunctionArgument>>;
  resolve: (provisional?: boolean) => Promise<FunctionArgument | undefined>;
  unavailable: Error;
};

function fixture(
  type: string, structs: StructDefinitionInfo[] = [],
  unavailable: Error = new Error('Could not derive the return value of the selected producer'),
): ProvisionalFixture {
  const artifact = { abi: [], constructorInputs: [], structs } as unknown as Artifact;
  const derive = vi.fn(async (): Promise<FunctionArgument> => { throw unavailable; });
  const producer = {
    inner: { artifact, lockingBytecode: '51' }, categoryId: '01'.repeat(32),
    _deriveReturnValue: derive, _resolveExternalArgs: () => [],
    _resolveCallAbi: () => ({ name: 'compute', inputs: [], outputs: [{ type }] }),
  } as unknown as StatefulContract;
  const registry = new Map([['ISource', producer]]);
  const owner = { inner: { artifact }, _externalRegistry: registry } as unknown as StatefulContract;
  const host: ResolveExternalExpressionReturnsHost & ResolveExternalArgsHost = {
    inner: { artifact, encodedConstructorArgs: [], provider: createTestProvider(), lockingBytecode: '51' },
    categoryId: '00'.repeat(32), externalRegistry: registry, asCallerContract: () => owner,
    resolveExternalArgs: (...args) => resolveExternalArgs(host, ...args),
    evaluateExternalExpression: (...args) => evaluateExternalExpression(host, ...args),
  };
  const expression: ExternalCallExpression = { kind: 'producerResult', callsiteId: 0, resultIndex: 0, type };
  const sources: ArgSource[] = [{ kind: 'expression', expression }];
  const calls: ExternalCallAbi[] = [{
    interfaceName: 'ISource', functionName: 'compute', callsiteId: 0,
    argSources: [], returnTypes: [type], hasReturnValues: true, requiredDataNftIndices: [],
  }];
  const context = createGraphPlanningProducerResultContext();
  const resolve = async (provisional = true): Promise<FunctionArgument | undefined> => (
    await resolveExternalExpressionReturns(host, sources, [], owner, {}, [], undefined,
      calls, provisional, context)
  ).get(JSON.stringify(expression));
  return { derive, resolve, unavailable };
}

describe('provisional aggregate producer results', () => {
  it('preserves fixed-array shape without letting a provisional cache satisfy an exact request', async () => {
    const test = fixture('uint256[3]');
    expect(await test.resolve()).toEqual([0n, 0n, 0n]);
    await expect(test.resolve(false)).rejects.toBe(test.unavailable);
    expect(test.derive).toHaveBeenCalledTimes(2);
  });

  it('defers an unmaterializable transitive return probe only while graph planning is provisional', async () => {
    const unavailable = new DeferredTransitiveReturnProbeError('Transitive callback needs the aggregate graph');
    const test = fixture('uint256[5]', [], unavailable);
    expect(await test.resolve()).toEqual([0n, 0n, 0n, 0n, 0n]);
    await expect(test.resolve(false)).rejects.toBe(unavailable);
    expect(test.derive).toHaveBeenCalledTimes(2);
  });

  it('preserves nested arrays, struct fields, and independent aggregate elements', async () => {
    const test = fixture('Receipt[2]', [{ name: 'Receipt', fields: [
      { name: 'weights', type: 'uint16[2]' }, { name: 'valid', type: 'bool' },
      { name: 'label', type: 'string' }, { name: 'payload', type: 'bytes4' },
    ] }]);
    const value = await test.resolve() as unknown as Array<{ weights: bigint[]; valid: boolean; label: string }>;
    expect(value).toEqual(Array.from({ length: 2 }, () => ({
      weights: [0n, 0n], valid: false, label: '', payload: new Uint8Array(4),
    })));
    expect(value[0]).not.toBe(value[1]);
    expect(value[0].weights).not.toBe(value[1].weights);
  });

  it.each(['uint256[10001]', 'uint256[1000][1000]'])('bounds aggregate allocation for %s', async (type) => {
    await expect(fixture(type).resolve()).rejects.toThrow('aggregate element limit');
  });

  it('rejects a fixed-size recursive struct while allowing an empty recursive dynamic array', async () => {
    const fields = [{ name: 'next', type: 'Node[1]' }];
    await expect(fixture('Node', [{ name: 'Node', fields }]).resolve()).rejects.toThrow('Circular provisional');
    expect(await fixture('Node', [{ name: 'Node', fields: [{ name: 'next', type: 'Node[]' }] }]).resolve())
      .toEqual({ next: [] });
  });
});
