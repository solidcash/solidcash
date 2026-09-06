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
});
