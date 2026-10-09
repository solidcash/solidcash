import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { vmNumberToBigInt } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import {
  BytesType, IntType, Op, PrimitiveType, encodeBool, encodeInt, encodeIntAsFixedBytes, encodeString,
  type Script, type Type,
} from '@solidcash/utils';
import {
  BoolLiteralNode, CastNode, ConstantDefinitionNode, ExpressionNode, HexLiteralNode, IdentifierNode, IntLiteralNode,
  StringLiteralNode,
} from '../ast/AST.js';
import { compileCast } from '../generation/utils.js';

/**
 * The value a mapping key's operand has at compile time, published as the bytes the body hashes for it.
 *
 * A key label is read off-chain (`evalComputedKey`), which knows a number, a boolean and a byte string but not the
 * type a value is converted to. A cast that changes its operand's bytes (`bytes32(0)` is 32 zero bytes, not the
 * empty number) and a constant (whose initializer type checking converts to its declared type) are therefore
 * folded here into the exact value code generation leaves on the stack, which the body's own key hash reads.
 */

/** A value fixed at compile time: the bytes the code generated for it leaves on the stack, and their type. */
interface CompileTimeValue {
  readonly bytes: Uint8Array;
  readonly type: Type;
}

/** What a fold needs from the compilation: the constant a name reads, and how conversions are emitted. */
export interface CompileTimeKeyContext {
  readonly constantOf: (name: string) => ConstantDefinitionNode | undefined;
  readonly solidityCompat: boolean;
}

const MAXIMUM_NUMBER_BYTES = 10_000;

const isNumberType = (type: Type | undefined): boolean =>
  type === PrimitiveType.INT || type === PrimitiveType.BIGINT || type instanceof IntType;

/** The integer a script number encodes, reading a non-minimal encoding as the VM's number operations do. */
function numberOf(item: Uint8Array): bigint | undefined {
  const value = vmNumberToBigInt(item, {
    requireMinimalEncoding: false, maximumVmNumberByteLength: MAXIMUM_NUMBER_BYTES,
  });
  return typeof value === 'bigint' ? value : undefined;
}

/**
 * The item a conversion's script leaves when it runs over `operand`, or undefined for an operation it does not run.
 *
 * The script is the conversion code generation emits (`compileCast`), so the fold is the body's own arithmetic:
 * `OP_NUM2BIN` widens a number to its sign-magnitude width, `OP_REVERSEBYTES` makes it big-endian under Solidity
 * compatibility, and so on. An operation outside the few a conversion of a literal uses leaves the cast unfolded.
 */
function runConversion(script: Script, operand: Uint8Array): Uint8Array | undefined {
  const stack: Uint8Array[] = [operand];
  const popNumber = (): bigint | undefined => {
    const item = stack.pop();
    return item === undefined ? undefined : numberOf(item);
  };
  for (const step of script) {
    if (step instanceof Uint8Array) {
      stack.push(step);
      continue;
    }
    if (step === Op.OP_NUM2BIN) {
      const size = popNumber();
      const value = popNumber();
      if (size === undefined || value === undefined || BigInt(encodeInt(value).length) > size) return undefined;
      stack.push(encodeIntAsFixedBytes(value, Number(size)));
    } else if (step === Op.OP_BIN2NUM) {
      const value = popNumber();
      if (value === undefined) return undefined;
      stack.push(encodeInt(value));
    } else if (step === Op.OP_REVERSEBYTES) {
      const item = stack.pop();
      if (item === undefined) return undefined;
      stack.push(Uint8Array.from(item).reverse());
    } else if (step === Op.OP_CAT) {
      const right = stack.pop();
      const left = stack.pop();
      if (left === undefined || right === undefined) return undefined;
      stack.push(Uint8Array.from([...left, ...right]));
    } else if (step === Op.OP_SPLIT) {
      const at = popNumber();
      const item = stack.pop();
      if (at === undefined || item === undefined || at < 0n || at > BigInt(item.length)) return undefined;
      stack.push(item.slice(0, Number(at)), item.slice(Number(at)));
    } else if (step === Op.OP_DROP) {
      if (stack.pop() === undefined) return undefined;
    } else if (step === Op.OP_0NOTEQUAL) {
      const value = popNumber();
      if (value === undefined) return undefined;
      stack.push(encodeBool(value !== 0n));
    } else if (step === Op.OP_MOD) {
      const modulus = popNumber();
      const value = popNumber();
      if (modulus === undefined || value === undefined || modulus === 0n) return undefined;
      stack.push(encodeInt(value % modulus));
    } else {
      return undefined;
    }
  }
  return stack.length === 1 ? stack[0] : undefined;
}

/** The value of an expression built from literals, casts and constants, or undefined for any other expression. */
function valueOf(
  expression: ExpressionNode, context: CompileTimeKeyContext, seen: ReadonlySet<string>,
): CompileTimeValue | undefined {
  if (expression instanceof IntLiteralNode) return { bytes: encodeInt(expression.value), type: PrimitiveType.INT };
  if (expression instanceof BoolLiteralNode) return { bytes: encodeBool(expression.value), type: PrimitiveType.BOOL };
  if (expression instanceof HexLiteralNode) {
    if (expression.codegenError !== undefined) return undefined;
    return { bytes: expression.value, type: expression.type ?? new BytesType(expression.value.length) };
  }
  if (expression instanceof StringLiteralNode) {
    return { bytes: expression.solidityBytes ?? encodeString(expression.value), type: PrimitiveType.STRING };
  }
  if (expression instanceof CastNode) {
    const operand = valueOf(expression.expression, context, seen);
    if (operand === undefined) return undefined;
    let script: Script;
    try {
      script = compileCast(operand.type, expression.type, expression.isUnsafe, context.solidityCompat);
    } catch {
      return undefined;
    }
    const bytes = runConversion(script, operand.bytes);
    return bytes === undefined ? undefined : { bytes, type: expression.type };
  }
  if (expression instanceof IdentifierNode) {
    const constant = context.constantOf(expression.name);
    if (constant === undefined || seen.has(constant.name)) return undefined;
    return constantValue(constant, context, new Set([...seen, constant.name]));
  }
  return undefined;
}

/**
 * A constant's value as code generation inlines it: its initializer as type checking converts it to the declared
 * type (`TypeCheckTraversal.visitConstantDefinition`). The zero literal is the all-zero value of any fixed width; under
 * Solidity compatibility a shorter string or fixed-width byte value is right-padded to it, and a hex literal is a
 * number in an integral declaration. A conversion this does not model leaves the constant unfolded.
 */
function constantValue(
  constant: ConstantDefinitionNode, context: CompileTimeKeyContext, seen: ReadonlySet<string>,
): CompileTimeValue | undefined {
  const { expression, type } = constant;
  if (type instanceof BytesType && type.bound !== undefined) {
    const zero = (expression instanceof IntLiteralNode && expression.value === 0n)
      || (expression instanceof HexLiteralNode && expression.value.every((byte) => byte === 0));
    if (zero) return { bytes: new Uint8Array(type.bound), type };
    const value = valueOf(expression, context, seen);
    if (value === undefined || value.bytes.length > type.bound) return undefined;
    if (value.bytes.length === type.bound) return { bytes: value.bytes, type };
    const padded = context.solidityCompat && (value.type === PrimitiveType.STRING
      || (value.type instanceof BytesType && value.type.bound !== undefined));
    if (!padded) return undefined;
    const bytes = new Uint8Array(type.bound);
    bytes.set(value.bytes);
    return { bytes, type };
  }
  if (isNumberType(type) && expression instanceof HexLiteralNode) {
    if (!context.solidityCompat) return undefined;
    const number = expression.numericValue
      ?? expression.value.reduce((total, byte) => (total << 8n) + BigInt(byte), 0n);
    return { bytes: encodeInt(number), type };
  }
  const value = valueOf(expression, context, seen);
  if (value === undefined || isNumberType(type) !== isNumberType(value.type)) return undefined;
  return { bytes: value.bytes, type };
}

/** A value as a key label: a number or a boolean as itself, anything else as its exact bytes. */
function valueLabel(value: CompileTimeValue): string {
  if (isNumberType(value.type)) {
    const number = numberOf(value.bytes);
    if (number !== undefined && binToHex(encodeInt(number)) === binToHex(value.bytes)) return `lit:${number}`;
  }
  if (value.type === PrimitiveType.BOOL && binToHex(value.bytes) === binToHex(encodeBool(value.bytes.length > 0))) {
    return `lit:${value.bytes.length > 0}`;
  }
  return `lit:0x${binToHex(value.bytes)}`;
}

/** The label of the value a constant holds where a key reads it, or undefined for one this does not fold. */
export function constantKeyLabel(constant: ConstantDefinitionNode, context: CompileTimeKeyContext): string | undefined {
  const value = constantValue(constant, context, new Set([constant.name]));
  return value === undefined ? undefined : valueLabel(value);
}

/**
 * The label of the value a cast leaves where a key reads it, when its operand is a compile-time value and the
 * conversion changes that value's bytes. A cast that leaves them as they are (`address(0)`) keeps its structural
 * label, which the off-chain evaluator already reads as the operand.
 */
export function castKeyLabel(cast: CastNode, context: CompileTimeKeyContext): string | undefined {
  const operand = valueOf(cast.expression, context, new Set());
  const value = valueOf(cast, context, new Set());
  if (operand === undefined || value === undefined) return undefined;
  return binToHex(operand.bytes) === binToHex(value.bytes) ? undefined : valueLabel(value);
}
