import type { Artifact, ExternalCallExpression, ExternalCallStatement } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import type { FunctionArgument } from '../../src/Argument.js';
import { evaluateExternalExpression } from '../../src/stateful/sc-evaluate-external-expression.js';

const literal = (value: number): ExternalCallExpression => ({ kind: 'literal', type: 'bigint', value: String(value) });
const variable = (name: string): ExternalCallExpression => ({ kind: 'identifier', name });
const element = (name: string, index: number): ExternalCallExpression => ({
  kind: 'arrayAccess', left: variable(name), right: literal(index),
});
const evaluate = (
  statements: ExternalCallStatement[], args: ExternalCallExpression[] = [], parameters: string[] = [],
  returns?: ReadonlyMap<string, FunctionArgument>,
): FunctionArgument | undefined => evaluateExternalExpression(
  { resolveExternalArgs: () => undefined }, { kind: 'call', name: 'compute', statements, args, parameters },
  [], {} as Artifact, undefined, undefined, returns,
);

describe('compiler-described pure helper array locals', () => {
  it('zero-initializes a fixed array and evaluates sequential element assignments', () => {
    expect(evaluate([
      { kind: 'variable', name: 'result', type: 'uint256[3]' },
      { kind: 'arrayAssign', name: 'result', index: literal(1), expression: literal(7) },
      { kind: 'arrayAssign', name: 'result', index: literal(2), expression: {
        kind: 'binary', operator: '+', left: element('result', 1), right: literal(2),
      } },
      { kind: 'return', expression: variable('result') },
    ])).toEqual([0n, 7n, 9n]);
  });

  it('does not mutate an authenticated producer array while evaluating a helper parameter', () => {
    const result: ExternalCallExpression = { kind: 'producerResult', callsiteId: 0, resultIndex: 0, type: 'uint16[2]' };
    const original = [7n, 9n];
    expect(evaluate([
      { kind: 'variable', name: 'alias', type: 'uint16[2]', expression: variable('input') },
      { kind: 'arrayAssign', name: 'alias', index: literal(0), expression: literal(8) },
      { kind: 'return', expression: variable('input') },
    ], [result], ['input'], new Map([[JSON.stringify(result), original]]))).toEqual([8n, 9n]);
    expect(original).toEqual([7n, 9n]);
  });

  it('allocates independent nested fixed arrays with the scalar default', () => {
    const result = evaluate([
      { kind: 'variable', name: 'grid', type: 'bool[2][2]' },
      { kind: 'return', expression: variable('grid') },
    ]) as boolean[][];
    expect(result).toEqual([[false, false], [false, false]]);
    expect(result[0]).not.toBe(result[1]);
  });

  it.each([-1, 2])('rejects out-of-bounds index %s instead of extending the array', (index) => {
    expect(evaluate([
      { kind: 'variable', name: 'result', type: 'uint256[2]' },
      { kind: 'arrayAssign', name: 'result', index: literal(index), expression: literal(7) },
      { kind: 'return', expression: variable('result') },
    ])).toBeUndefined();
  });

  it('bounds default allocation, including the product of nested array dimensions', () => {
    for (const type of ['uint256[10001]', 'uint256[1000][1000]']) {
      expect(evaluate([
        { kind: 'variable', name: 'result', type },
        { kind: 'return', expression: variable('result') },
      ])).toBeUndefined();
    }
  });
});
