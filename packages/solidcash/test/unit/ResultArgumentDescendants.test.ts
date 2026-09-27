import { describe, expect, it, vi } from 'vitest';
import type { FunctionArgument } from '../../src/Argument.js';
import {
  propagateResultDependentArguments, type ResultPropagationContext,
} from '../../src/message-bus/compose-result-propagation.js';

describe('result-dependent descendant arguments', () => {
  it('propagates changed parent arguments through several levels without requiring child results', () => {
    const untouched = vi.fn();
    const first = (_results: ReadonlyMap<number, FunctionArgument>, args?: readonly FunctionArgument[]):
    readonly FunctionArgument[] | undefined => args;
    const last = (_results: ReadonlyMap<number, FunctionArgument>, args?: readonly FunctionArgument[]):
    readonly FunctionArgument[] | undefined => args && [(args[0] as bigint) + 3n];
    const invocations = [
      { index: 0, parent: null, callee: 0, resultTypes: [] },
      { index: 1, parent: 0, callee: 0, consumerCallsiteId: 0, resultTypes: ['uint256'], resultEncoding: 'evm-abi-v1' },
      { index: 2, parent: 0, callee: 0, consumerCallsiteId: 1, resultTypes: [] },
      { index: 3, parent: 2, callee: 0, consumerCallsiteId: 0, resultTypes: [] },
      { index: 4, parent: 3, callee: 0, consumerCallsiteId: 0, resultTypes: [] },
      { index: 5, parent: 0, callee: 0, consumerCallsiteId: 2, resultTypes: [] },
      { index: 6, parent: 5, callee: 0, consumerCallsiteId: 0, resultTypes: [] },
    ];
    const context = {
      plan: { invocations, participants: [{ artifact: {} }] }, returning: [invocations[1]],
      descriptors: invocations.map((row) => ({
        functionName: `row${row.index}`, args: [row.index === 4 ? 103n : 100n],
        ...(row.index === 2 && { resolveArgsFromResults: (results: ReadonlyMap<number, FunctionArgument>) =>
          results.has(0) ? [results.get(0)!] : undefined }),
        ...(row.index === 3 && { resolveArgsFromResults: first }),
        ...(row.index === 4 && { resolveArgsFromResults: last }),
        ...(row.index === 6 && { resolveArgsFromResults: untouched }),
      })),
    } as unknown as ResultPropagationContext;
    const results = { 1: '50'.padStart(64, '0') };
    const changed = propagateResultDependentArguments(context, results);
    expect(changed.propagated).toBe(true);
    expect(changed.calls.map((call) => call.args)).toEqual([[100n], [100n], [80n], [80n], [83n], [100n], [100n]]);
    expect(untouched).not.toHaveBeenCalled();
    const stable = propagateResultDependentArguments({ ...context,
      descriptors: changed.calls as ResultPropagationContext['descriptors'] }, results);
    expect(stable.propagated).toBe(false);
    expect(stable.calls.map((call) => call.args)).toEqual(changed.calls.map((call) => call.args));
  });
});
