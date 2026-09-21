import type { ExternalCallExpression } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  visitExternalExpressionEvaluationPath,
} from '../../src/message-bus/result-evaluation-path.js';

const literal = (value: boolean): ExternalCallExpression => ({
  kind: 'literal', type: 'bool', value,
});
const producer = (callsiteId: number): ExternalCallExpression => ({
  kind: 'producerResult', type: 'uint16[5]', callsiteId, resultIndex: 0,
});

const visitedProducers = async (
  expression: ExternalCallExpression,
  values: ReadonlyMap<ExternalCallExpression, unknown>,
): Promise<number[]> => {
  const visited: number[] = [];
  await visitExternalExpressionEvaluationPath(expression, async (node) => {
    if (node.kind === 'producerResult') visited.push(node.callsiteId!);
  }, (node) => values.get(node) ?? node.value);
  return visited;
};

describe('graph producer-result evaluation paths', () => {
  it.each([true, false])('visits only the selected ternary producer when the condition is %s', async (choose) => {
    const condition = literal(choose);
    const selected = producer(2);
    const inactive = producer(3);
    const expression: ExternalCallExpression = {
      kind: 'ternary', type: 'uint16[5]', condition,
      ifTrue: selected, ifFalse: inactive,
    };

    expect(await visitedProducers(expression, new Map([[condition, choose]])))
      .toEqual([choose ? 2 : 3]);
  });

  it.each([
    ['&&', false, []],
    ['&&', true, [7]],
    ['||', true, []],
    ['||', false, [7]],
  ] as const)('honors %s short-circuit evaluation for left=%s', async (operator, leftValue, expected) => {
    const left = literal(leftValue);
    const right = producer(7);
    const expression: ExternalCallExpression = {
      kind: 'binary', type: 'bool', operator, left, right,
    };

    expect(await visitedProducers(expression, new Map([[left, leftValue]]))).toEqual(expected);
  });

  it('fails closed when a branch condition cannot be resolved', async () => {
    const condition: ExternalCallExpression = { kind: 'identifier', type: 'bool', name: 'unknown' };
    const expression: ExternalCallExpression = {
      kind: 'ternary', type: 'uint16[5]', condition,
      ifTrue: producer(2), ifFalse: producer(3),
    };

    await expect(visitedProducers(expression, new Map())).rejects
      .toThrow(/condition cannot be resolved/);
  });
});
