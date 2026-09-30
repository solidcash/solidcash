import { BytesType, FixedType, IntType, implicitlyCastable, PrimitiveType, Type } from '@solidcash/utils';
import { BinaryOperator } from './ast/Operator.js';

export function resultingTypeForBinaryOp(
  operator: BinaryOperator,
  left: Type,
  right: Type,
  sourceArithmetic = false,
): Type | undefined {
  // Shift/split/power take the LEFT operand's type: the right operand (shift amount / exponent) is an unsigned
  // count that need not match the base's type, and the result is the base's type (Solidity `-1 ** e` is int).
  if ([BinaryOperator.SHIFT_LEFT, BinaryOperator.SHIFT_RIGHT, BinaryOperator.SPLIT, BinaryOperator.POW]
    .includes(operator)) return left;

  // In source arithmetic an integer literal takes the type of the bounded operand beside it, as Solidity converts
  // it, so the result stays bounded and range-checked. Compiler-built arithmetic keeps the literal's generic type.
  if (sourceArithmetic && left instanceof IntType && right === PrimitiveType.INT) return left;
  if (sourceArithmetic && right instanceof IntType && left === PrimitiveType.INT) return right;

  if (implicitlyCastable(left, right)) return right;
  if (implicitlyCastable(right, left)) return left;
  if (left instanceof BytesType && right instanceof BytesType) {
    return new BytesType();
  }

  return undefined;
}

export function isNumericType(type?: Type): boolean {
  return type === PrimitiveType.BIGINT || type === PrimitiveType.INT || type === PrimitiveType.BOOL
    || type instanceof IntType || type instanceof FixedType;
}
