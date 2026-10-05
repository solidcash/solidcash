import { describe, expect, it, vi } from 'vitest';
import type { FunctionArgument } from '../../src/Argument.js';
import {
  propagateResultDependentArguments, type ResultPropagationContext,
} from '../../src/message-bus/compose-result-propagation.js';
import type { PreparedAtomicMessageBusCall } from '../../src/message-bus/compose-prepared-invocation.js';

describe('computed stored-value result propagation', () => {
  it('refreshes unchanged arguments with only that invocation\'s child results', () => {
    const refresh = vi.fn((
      _args: readonly FunctionArgument[], _results: ReadonlyMap<number, FunctionArgument>,
    ): NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']> => []);
    const invocations = [
      { index: 0, parent: null, callee: 0, resultTypes: [] },
      { index: 1, parent: 0, callee: 0, consumerCallsiteId: 0, resultTypes: ['uint256'], resultEncoding: 'evm-abi-v1' },
      { index: 2, parent: 0, callee: 0, consumerCallsiteId: 1, resultTypes: ['uint256'], resultEncoding: 'evm-abi-v1' },
      { index: 3, parent: 1, callee: 0, consumerCallsiteId: 0, resultTypes: ['uint256'], resultEncoding: 'evm-abi-v1' },
    ];
    // Planning/contract execution is outside this unit: propagation consumes only the published tree and schemas.
    const context = {
      plan: { invocations, participants: [{ artifact: {} }] },
      returning: invocations.slice(1),
      descriptors: invocations.map((invocation) => ({
        functionName: `row${invocation.index}`, args: [7n],
        ...(invocation.index === 1 && { resolveValueChunkProductionsFromResults: refresh }),
      })),
    } as unknown as ResultPropagationContext;
    const result = propagateResultDependentArguments(context, {
      1: '0b'.padStart(64, '0'), 2: '16'.padStart(64, '0'), 3: '21'.padStart(64, '0'),
    });
    expect(refresh).toHaveBeenCalledOnce();
    expect(refresh.mock.calls[0][0]).toEqual([7n]);
    expect([...refresh.mock.calls[0][1]]).toEqual([[0, 33n]]);
    expect(result.calls[1].valueChunkProductions).toEqual([]);
    expect(result.propagated).toBe(false);
  });
});
