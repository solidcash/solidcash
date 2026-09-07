import { hexToBin, utf8ToBin } from '@bitauth/libauth';
import type { ChildDeploymentValueRecipe } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { evaluateChildDeploymentRecipe } from '../../src/message-bus/compose.js';

const equality = (leftType: string, rightType: string): ChildDeploymentValueRecipe => ({
  kind: 'binary',
  operator: '==',
  resultType: 'bool',
  left: { kind: 'handlerInput', inputIndex: 0, resultType: leftType },
  right: { kind: 'handlerInput', inputIndex: 1, resultType: rightType },
});

const fixedBinary = (
  operator: Extract<ChildDeploymentValueRecipe, { kind: 'binary' }>['operator'],
  resultType = ['<', '<=', '>', '>=', '==', '!='].includes(operator) ? 'bool' : 'fixed128x2',
  leftType = 'fixed128x2',
  rightType = 'fixed128x2',
): ChildDeploymentValueRecipe => ({
  kind: 'binary', operator, resultType,
  left: { kind: 'handlerInput', inputIndex: 0, resultType: leftType },
  right: { kind: 'handlerInput', inputIndex: 1, resultType: rightType },
});

describe('child deployment recipe evaluation', () => {
  it('compares ABI-equivalent byte and numeric representations canonically', () => {
    const lockingBytecode = '76a914000000000000000000000000000000000000000088ac';
    expect(evaluateChildDeploymentRecipe(
      equality('address', 'address'), [lockingBytecode, hexToBin(lockingBytecode)], ['address', 'address'], false,
    )).toBe(true);
    expect(evaluateChildDeploymentRecipe(
      equality('uint32', 'uint32'), [1, 1n], ['uint32', 'uint32'], true,
    )).toBe(true);
    expect(evaluateChildDeploymentRecipe(
      equality('string', 'string'), ['Straße', utf8ToBin('Straße')], ['string', 'string'], true,
    )).toBe(true);
  });

  it('matches scaled fixed-point unary and binary VM arithmetic', () => {
    const evaluate = (
      operator: Parameters<typeof fixedBinary>[0], left: bigint, right: bigint,
    ): ReturnType<typeof evaluateChildDeploymentRecipe> =>
      evaluateChildDeploymentRecipe(fixedBinary(operator), [left, right], ['fixed128x2', 'fixed128x2'], true);
    expect(evaluate('+', 125n, 250n)).toBe(375n);
    expect(evaluate('-', 125n, 250n)).toBe(-125n);
    expect(evaluate('*', 125n, 250n)).toBe(312n);
    expect(evaluate('/', 125n, 40n)).toBe(312n);
    expect(evaluate('%', -125n, 40n)).toBe(-5n);
    expect(evaluate('<', 125n, 250n)).toBe(true);
    expect(evaluate('>=', 250n, 250n)).toBe(true);
    expect(evaluate('==', 250n, 250n)).toBe(true);
    expect(evaluateChildDeploymentRecipe({
      kind: 'unary', operator: '-', resultType: 'fixed128x2',
      operand: { kind: 'handlerInput', inputIndex: 0, resultType: 'fixed64x2' },
    }, [125n], ['fixed64x2'], true)).toBe(-125n);
  });

  it('applies explicit fixed-point cast scaling and truncation', () => {
    expect(evaluateChildDeploymentRecipe({
      kind: 'cast', resultType: 'fixed128x4',
      operand: { kind: 'handlerInput', inputIndex: 0, resultType: 'fixed128x2' },
    }, [125n], ['fixed128x2'], true)).toBe(12_500n);
    expect(evaluateChildDeploymentRecipe({
      kind: 'cast', resultType: 'int256',
      operand: { kind: 'handlerInput', inputIndex: 0, resultType: 'fixed128x2' },
    }, [-199n], ['fixed128x2'], true)).toBe(-1n);
  });

  it('evaluates enum inputs through the compiler-normalized bigint representation', () => {
    expect(evaluateChildDeploymentRecipe({
      kind: 'cast', resultType: 'int256',
      operand: { kind: 'handlerInput', inputIndex: 0, resultType: 'bigint' },
    }, [1n], ['Choice'], false)).toBe(1n);
  });

  it('selects one typed pure branch lazily and rejects mismatched branch types', () => {
    const conditional: ChildDeploymentValueRecipe = {
      kind: 'conditional', resultType: 'uint256',
      condition: { kind: 'handlerInput', inputIndex: 0, resultType: 'bool' },
      ifTrue: { kind: 'handlerInput', inputIndex: 1, resultType: 'uint256' },
      ifFalse: { kind: 'handlerInput', inputIndex: 2, resultType: 'uint256' },
    };
    expect(evaluateChildDeploymentRecipe(
      conditional, [true, 7n, 9n], ['bool', 'uint256', 'uint256'], true,
    )).toBe(7n);
    expect(evaluateChildDeploymentRecipe(
      conditional, [false, 7n, 9n], ['bool', 'uint256', 'uint256'], true,
    )).toBe(9n);
    expect(() => evaluateChildDeploymentRecipe({
      ...conditional,
      ifFalse: { kind: 'handlerInput', inputIndex: 2, resultType: 'bytes' },
    }, [false, 7n, Uint8Array.of(0x51)], ['bool', 'uint256', 'bytes'], true))
      .toThrow(/branches must match/);
  });

  it('refuses malformed fixed-point recipes with mixed scales or scalar kinds', () => {
    expect(() => evaluateChildDeploymentRecipe(
      fixedBinary('+', 'fixed128x2', 'fixed128x2', 'fixed128x3'),
      [125n, 2_500n], ['fixed128x2', 'fixed128x3'], true,
    )).toThrow(/must use one scale/);
    expect(() => evaluateChildDeploymentRecipe(
      fixedBinary('*', 'fixed128x2', 'fixed128x2', 'int256'),
      [125n, 2n], ['fixed128x2', 'int256'], true,
    )).toThrow(/must use one scale/);
    expect(() => evaluateChildDeploymentRecipe(
      fixedBinary('&&', 'bool'), [0n, 100n], ['fixed128x2', 'fixed128x2'], true,
    )).toThrow(/does not support logical operators/);
  });
});
