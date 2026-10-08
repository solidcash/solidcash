import {
  BytesType, encodeString, FixedType, IntType, implicitlyCastable, PrimitiveType, type Type,
} from '@solidcash/utils';
import { CastNode, ExpressionNode, HexLiteralNode, StringLiteralNode } from './ast/AST.js';
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

/**
 * The smallest integer type that holds `value`, as Solidity types an integer literal on its own (its mobile type):
 * `uintN` for a value of zero or more, `intN` for a negative one, `N` the fewest whole bytes; none past 256 bits.
 */
export function literalMobileType(value: bigint): IntType | undefined {
  const negative = value < 0n;
  // A negative value needs the bits of its magnitude less one, beside a sign bit.
  let magnitude = negative ? (-value - 1n) << 1n : value;
  let bytes = 1;
  for (magnitude >>= 8n; magnitude > 0n; magnitude >>= 8n) bytes += 1;
  return bytes > 32 ? undefined : new IntType(negative, bytes * 8);
}

/**
 * The type a source-arithmetic integer literal takes beside a bounded operand, as Solidity's common type gives it,
 * when that is not the bounded type: a literal whose value does not fit it makes the operation take the literal's
 * own smallest type, provided the bounded type converts to that implicitly (`uint8 * 10000` is uint16 arithmetic).
 * Undefined leaves the literal generic, so the bounded type and its check stand, also where no common type exists.
 */
export function literalTypeBesideBounded(value: bigint, bounded: IntType): IntType | undefined {
  if (value >= bounded.minValue && value <= bounded.maxValue) return undefined;
  const mobile = literalMobileType(value);
  return mobile !== undefined && implicitlyCastable(bounded, mobile) ? mobile : undefined;
}

export function isNumericType(type?: Type): boolean {
  return type === PrimitiveType.BIGINT || type === PrimitiveType.INT || type === PrimitiveType.BOOL
    || type instanceof IntType || type instanceof FixedType;
}

// The value of a bytes expression if it is known at compile time: (casts of) hex and string literals
export function getCompileTimeBytes(node: ExpressionNode): Uint8Array | undefined {
  if (node instanceof HexLiteralNode) return node.value;
  if (node instanceof StringLiteralNode) return node.solidityBytes ?? encodeString(node.value);
  if (node instanceof CastNode && node.type instanceof BytesType) return getCompileTimeBytes(node.expression);
  return undefined;
}

// The length of a bytes expression if it is known at compile time, from its value or its type (e.g. bytes20)
export function getCompileTimeByteLength(node: ExpressionNode): number | undefined {
  return getCompileTimeBytes(node)?.byteLength ?? (node.type instanceof BytesType ? node.type.bound : undefined);
}
