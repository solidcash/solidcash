import { binToHex } from '@bitauth/libauth';
import { hash160, type ArgSource, type Artifact, type ExternalCallAbi, type ExternalCallExpression, type StructDefinitionInfo } from '@solidcash/utils';
import { describe, expect, it, vi, type Mock } from 'vitest';
import type { FunctionArgument } from '../../src/Argument.js';
import { evaluateExternalExpression } from '../../src/stateful/sc-evaluate-external-expression.js';
import { resolveExternalArgs, type ResolveExternalArgsHost } from '../../src/stateful/sc-resolve-external-args.js';
import {
  resolveExternalExpressionReturns, type ResolveExternalExpressionReturnsHost,
} from '../../src/stateful/sc-resolve-external-expression-returns.js';
import { createGraphPlanningProducerResultContext } from '../../src/stateful/graph-planning-producer-result.js';
import { registerDeployment } from '../../src/stateful/deployment-registry.js';
import {
  DeferredTransitiveReturnProbeError,
} from '../../src/stateful/sc-discover-create-builder-transitive-external-calls.js';
import type { StatefulContract } from '../../src/stateful/StatefulContract.js';
import { createTestProvider } from '../test-util.js';

type ProvisionalFixture = {
  derive: Mock<() => Promise<FunctionArgument>>;
  resolve: (provisional?: boolean) => Promise<FunctionArgument | undefined>;
  unavailable: Error;
  provider: ReturnType<typeof createTestProvider>;
  producer: StatefulContract;
};

function fixture(
  type: string, structs: StructDefinitionInfo[] = [],
  unavailable: Error = new Error('Could not derive the return value of the selected producer'),
  target?: Uint8Array,
  calleeLockingBytecode = '51',
  unresolvedTarget = false,
): ProvisionalFixture {
  const artifact = { abi: [], constructorInputs: [], structs } as unknown as Artifact;
  const derive = vi.fn(async (): Promise<FunctionArgument> => { throw unavailable; });
  const producer = {
    inner: { artifact, lockingBytecode: calleeLockingBytecode }, categoryId: '01'.repeat(32),
    _deriveReturnValue: derive, _resolveExternalArgs: () => [],
    _resolveCallAbi: () => ({ name: 'compute', inputs: [], outputs: [{ type }] }),
  } as unknown as StatefulContract;
  const registry = new Map([['ISource', producer]]);
  const owner = { inner: { artifact }, _externalRegistry: registry } as unknown as StatefulContract;
  const provider = createTestProvider();
  const host: ResolveExternalExpressionReturnsHost & ResolveExternalArgsHost = {
    inner: { artifact, encodedConstructorArgs: [], provider, lockingBytecode: '51' },
    categoryId: '00'.repeat(32), externalRegistry: registry, asCallerContract: () => owner,
    resolveExternalArgs: (...args) => resolveExternalArgs(host, ...args),
    evaluateExternalExpression: (...args) => evaluateExternalExpression(host, ...args),
  };
  const expression: ExternalCallExpression = { kind: 'producerResult', callsiteId: 0, resultIndex: 0, type };
  const sources: ArgSource[] = [{ kind: 'expression', expression }];
  const calls: ExternalCallAbi[] = [{
    interfaceName: 'ISource', functionName: 'compute', callsiteId: 0,
    ...(unresolvedTarget
      ? { addressSource: { kind: 'constructorArg' as const, paramName: 'missing' } }
      : target ? { addressSource: { kind: 'forward' as const, paramIndex: 0 } } : {}),
    argSources: [], returnTypes: [type], hasReturnValues: true, requiredDataNftIndices: [],
  }];
  const context = createGraphPlanningProducerResultContext();
  const resolve = async (provisional = true): Promise<FunctionArgument | undefined> => (
    await resolveExternalExpressionReturns(host, sources, target ? [target] : [], owner, {}, [], undefined,
      calls, provisional, context)
  ).get(JSON.stringify(expression));
  return { derive, resolve, unavailable, provider, producer };
}

describe('provisional aggregate producer results', () => {
  it('preserves fixed-array shape without letting a provisional cache satisfy an exact request', async () => {
    const test = fixture('uint256[3]');
    expect(await test.resolve()).toEqual([0n, 0n, 0n]);
    await expect(test.resolve(false)).rejects.toBe(test.unavailable);
    expect(test.derive).toHaveBeenCalledTimes(2);
  });

  it('respects explicit callee address identity when probing producer results', async () => {
    const unknown = fixture('uint256', [], new Error('wrong callee was probed'), Uint8Array.of(0x52));
    expect(await unknown.resolve(false)).toBeUndefined();
    expect(unknown.derive).not.toHaveBeenCalled();

    const matchedError = new Error('matched callee was probed');
    const matched = fixture('uint256', [], matchedError, Uint8Array.of(0x51));
    await expect(matched.resolve(false)).rejects.toBe(matchedError);
    expect(matched.derive).toHaveBeenCalledOnce();

    const p2sh32 = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x42), 0x87);
    const projectedError = new Error('projected callee was probed');
    const projected = fixture('uint256', [], projectedError, hash160(p2sh32), binToHex(p2sh32));
    await expect(projected.resolve(false)).rejects.toBe(projectedError);
    expect(projected.derive).toHaveBeenCalledOnce();

    const ambiguous = fixture('uint256', [], new Error('ambiguous callee was probed'),
      hash160(p2sh32), binToHex(p2sh32));
    const payload = binToHex(hash160(p2sh32));
    registerDeployment(ambiguous.provider, {
      contractName: 'Source', address: 'first', lockingBytecode: binToHex(p2sh32), contract: ambiguous.producer,
    });
    registerDeployment(ambiguous.provider, {
      contractName: 'Other', address: 'second', lockingBytecode: `a914${payload}87`, contract: {},
    });
    expect(await ambiguous.resolve(false)).toBeUndefined();
    expect(ambiguous.derive).not.toHaveBeenCalled();

    const unresolved = fixture('uint256', [], new Error('unresolved callee was probed'),
      undefined, '51', true);
    expect(await unresolved.resolve(false)).toBeUndefined();
    expect(unresolved.derive).not.toHaveBeenCalled();
  });

  it('separates cached producer results by dynamic callee target', async () => {
    const artifact = { abi: [], constructorInputs: [] } as unknown as Artifact;
    const provider = createTestProvider();
    const firstDerive = vi.fn(async () => 11n);
    const secondDerive = vi.fn(async () => 22n);
    const callee = (lockingBytecode: string, derive: typeof firstDerive): StatefulContract => ({
      inner: { artifact, lockingBytecode }, categoryId: lockingBytecode.repeat(32),
      _deriveReturnValue: derive, _resolveExternalArgs: () => [],
      _resolveCallAbi: () => ({ name: 'compute', inputs: [], outputs: [{ type: 'uint256' }] }),
    }) as unknown as StatefulContract;
    const first = callee('51', firstDerive);
    const second = callee('52', secondDerive);
    registerDeployment(provider, {
      contractName: 'Source', address: 'first', lockingBytecode: '51', contract: first,
    });
    registerDeployment(provider, {
      contractName: 'Source', address: 'second', lockingBytecode: '52', contract: second,
    });
    const owner = {
      inner: { artifact }, _externalRegistry: new Map<string, StatefulContract>(),
    } as unknown as StatefulContract;
    const host: ResolveExternalExpressionReturnsHost & ResolveExternalArgsHost = {
      inner: { artifact, encodedConstructorArgs: [], provider, lockingBytecode: '53' },
      categoryId: '00'.repeat(32), externalRegistry: new Map(), asCallerContract: () => owner,
      resolveExternalArgs: (...args) => resolveExternalArgs(host, ...args),
      evaluateExternalExpression: (...args) => evaluateExternalExpression(host, ...args),
    };
    const expression: ExternalCallExpression = {
      kind: 'producerResult', callsiteId: 0, resultIndex: 0, type: 'uint256',
    };
    const calls: ExternalCallAbi[] = [{
      interfaceName: 'ISource', functionName: 'compute', callsiteId: 0,
      addressSource: { kind: 'forward', paramIndex: 0 },
      argSources: [], returnTypes: ['uint256'], hasReturnValues: true, requiredDataNftIndices: [],
    }];
    const context = createGraphPlanningProducerResultContext();
    const resolve = async (target: number): Promise<FunctionArgument | undefined> => (
      await resolveExternalExpressionReturns(host, [{ kind: 'expression', expression }],
        [Uint8Array.of(target)], owner, {}, [], undefined, calls, false, context)
    ).get(JSON.stringify(expression));

    expect(await resolve(0x51)).toBe(11n);
    expect(await resolve(0x52)).toBe(22n);
    expect(await resolve(0x51)).toBe(11n);
    expect(firstDerive).toHaveBeenCalledOnce();
    expect(secondDerive).toHaveBeenCalledOnce();
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
