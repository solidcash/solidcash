import { describe, expect, it } from 'vitest';
import type { ExternalCallExpression, RuntimeLoopEventAbi } from '@solidcash/utils';
import {
  runtimeLoopEventIterationValues,
  runtimeLoopEventRepeatSource,
} from '../../src/stateful/runtime-loop-event-domain.js';

const literal = (value: bigint): ExternalCallExpression => ({
  kind: 'literal', type: 'bigint', value: value.toString(),
});
const counter = (name = 'cursor'): ExternalCallExpression => ({ kind: 'identifier', name });
const compare = (operator: string, right: bigint): ExternalCallExpression => ({
  kind: 'binary', operator, left: counter(), right: literal(right),
});

const evaluate = (
  expression: ExternalCallExpression,
  bindings: ReadonlyMap<string, bigint>,
): bigint | boolean | undefined => {
  if (expression.kind === 'literal' && typeof expression.value === 'string') return BigInt(expression.value);
  if (expression.kind === 'identifier' && expression.name) return bindings.get(expression.name);
  if (expression.kind !== 'binary' || !expression.left || !expression.right) return undefined;
  const left = evaluate(expression.left, bindings);
  const right = evaluate(expression.right, bindings);
  if (typeof left !== 'bigint' || typeof right !== 'bigint') return undefined;
  if (expression.operator === '<') return left < right;
  if (expression.operator === '>') return left > right;
  return undefined;
};

const eventLoop = (overrides: Partial<RuntimeLoopEventAbi>): RuntimeLoopEventAbi => ({
  eventSignatures: ['Tick(int256)'], ...overrides,
});

describe('runtime-loop event iteration domains', () => {
  it('requires exactly one repeat source', () => {
    expect(() => runtimeLoopEventRepeatSource(eventLoop({}))).toThrow(/exactly one repeat source/);
    expect(() => runtimeLoopEventRepeatSource(eventLoop({
      repeatCount: 1,
      permutationParam: '__internal__order',
    }))).toThrow(/exactly one repeat source/);
  });

  it('recognizes every repeat-source variant without contract-specific knowledge', () => {
    expect(runtimeLoopEventRepeatSource(eventLoop({ repeatCount: 2 }))).toEqual({ kind: 'fixed', count: 2 });
    expect(runtimeLoopEventRepeatSource(eventLoop({ permutationParam: '__internal__order' }))).toEqual({
      kind: 'permutation', parameter: '__internal__order',
    });
    expect(runtimeLoopEventRepeatSource(eventLoop({
      iterationDomain: {
        counterName: 'cursor', initialValue: literal(0n), stepValue: literal(1n),
        continueCondition: compare('<', 1n), maximumIterations: 2,
      },
    })).kind).toBe('iterationDomain');
  });

  it('materializes ascending and descending affine do-while frames exactly', () => {
    expect(runtimeLoopEventIterationValues({
      counterName: 'cursor', initialValue: literal(0n), stepValue: literal(2n),
      continueCondition: compare('<', 5n), maximumIterations: 4,
    }, evaluate)).toEqual([0n, 2n, 4n, 6n]);
    expect(runtimeLoopEventIterationValues({
      counterName: 'cursor', initialValue: literal(5n), stepValue: literal(-2n),
      continueCondition: compare('>', 0n), maximumIterations: 4,
    }, evaluate)).toEqual([5n, 3n, 1n, -1n]);
  });

  it('retains the initial frame when recursion is skipped', () => {
    expect(runtimeLoopEventIterationValues({
      counterName: 'cursor', initialValue: literal(0n), stepValue: literal(1n),
      continueCondition: compare('<', 0n), maximumIterations: 1,
    }, evaluate)).toEqual([0n]);
  });

  it('fails closed on non-affine, zero-step, unresolved, or over-cap domains', () => {
    expect(() => runtimeLoopEventIterationValues({
      counterName: 'cursor', initialValue: literal(0n), stepValue: counter(),
      continueCondition: compare('<', 1n), maximumIterations: 2,
    }, evaluate)).toThrow(/step must be invariant/);
    expect(() => runtimeLoopEventIterationValues({
      counterName: 'cursor', initialValue: literal(0n), stepValue: literal(0n),
      continueCondition: compare('<', 1n), maximumIterations: 2,
    }, evaluate)).toThrow(/step must be non-zero/);
    expect(() => runtimeLoopEventIterationValues({
      counterName: 'cursor', initialValue: literal(0n), stepValue: literal(1n),
      continueCondition: { kind: 'unsupported' }, maximumIterations: 2,
    }, evaluate)).toThrow(/did not resolve to a boolean/);
    expect(() => runtimeLoopEventIterationValues({
      counterName: 'cursor', initialValue: literal(0n), stepValue: literal(1n),
      continueCondition: compare('<', 100n), maximumIterations: 2,
    }, evaluate)).toThrow(/exceeds its compiler-published maximum/);
    expect(() => runtimeLoopEventIterationValues({
      counterName: 'cursor', initialValue: literal(0n), stepValue: literal(1n),
      continueCondition: compare('<', 100n), maximumIterations: 65,
    }, evaluate)).toThrow(/between 1 and 64/);
  });
});
