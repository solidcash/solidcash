/**
 * Child-deployment value recipes and entry-value materialization.
 */

import { sha1 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { binToUtf8, utf8ToBin } from '@bitauth/libauth/build/lib/format/utf8.js';
import { bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import {
  AddressType, BytesType, FixedType, IntType,
  parseArrayTypeString, parseTypeStrict, PrimitiveType,
  hash160, hash256, ripemd160, sha256,
} from '@solidcash/utils';
import type { ChildDeploymentValueRecipe, StateValue, StructDefinitionInfo } from '@solidcash/utils';
import type { ConstructorArgument, FunctionArgument } from '../Argument.js';
import { addressToLockScript } from '../utils.js';
import type { FixedEffectEntryResolver } from './fixed-effect-entries.js';

const recipeType = (
  recipe: ChildDeploymentValueRecipe,
  inputTypes: readonly string[],
): string => recipe.resultType
  ?? (recipe.kind === 'handlerInput' ? inputTypes[recipe.inputIndex] : undefined)
  ?? (() => { throw new Error('deployment: deployment recipe has no result type'); })();

/** Unsigned big-endian byte comparison, ignoring leading zero bytes (the compiled bytes->number ordering). */
const compareUnsignedBigEndian = (left: Uint8Array, right: Uint8Array): number => {
  let leftStart = 0;
  while (leftStart < left.length && left[leftStart] === 0) leftStart += 1;
  let rightStart = 0;
  while (rightStart < right.length && right[rightStart] === 0) rightStart += 1;
  const leftLength = left.length - leftStart;
  const rightLength = right.length - rightStart;
  if (leftLength !== rightLength) return leftLength < rightLength ? -1 : 1;
  for (let index = 0; index < leftLength; index += 1) {
    const difference = left[leftStart + index]! - right[rightStart + index]!;
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  return 0;
};

const numericRecipeValue = (value: FunctionArgument, typeName: string, solidityAbi: boolean): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'boolean') return value ? 1n : 0n;
  if (typeof value === 'string' && /^(?:-?\d+|0x[0-9a-f]+)$/i.test(value)) return BigInt(value);
  if (value instanceof Uint8Array) {
    const type = parseTypeStrict(typeName);
    const bytes = solidityAbi && type instanceof BytesType && type.bound !== undefined
      ? value.slice().reverse() : value;
    const decoded = vmNumberToBigInt(bytes);
    if (typeof decoded !== 'bigint') {
      throw new Error(`deployment: deployment recipe has a non-minimal numeric ${typeName}`);
    }
    return decoded;
  }
  throw new Error(`deployment: deployment recipe expected a scalar numeric ${typeName}`);
};

const byteRecipeValue = (value: FunctionArgument, typeName: string, solidityAbi: boolean): Uint8Array => {
  const type = parseTypeStrict(typeName);
  if (type === PrimitiveType.BOOL || type === PrimitiveType.BIGINT
    || type instanceof IntType || type instanceof FixedType) {
    return bigIntToVmNumber(numericRecipeValue(value, typeName, solidityAbi));
  }
  if (type === PrimitiveType.STRING) {
    if (typeof value === 'string') return utf8ToBin(value);
    if (value instanceof Uint8Array) return value;
    throw new Error('deployment: deployment recipe expected string bytes');
  }
  if (type instanceof AddressType && typeof value === 'string' && value.includes(':')) {
    return addressToLockScript(value);
  }
  const byteType = type instanceof AddressType || type instanceof BytesType
    || type === PrimitiveType.PUBKEY || type === PrimitiveType.DATASIG;
  if (!byteType) throw new Error(`deployment: deployment recipe type ${typeName} is not byte-represented`);
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') {
    return hexToBin(value.startsWith('0x') ? value.slice(2) : value);
  }
  throw new Error(`deployment: deployment recipe expected byte sequence ${typeName}`);
};

export const fixedVmNumber = (value: bigint, width: number): Uint8Array => {
  const minimal = bigIntToVmNumber(value);
  if (minimal.length > width) throw new Error(`deployment: deployment recipe value does not fit bytes${width}`);
  if (minimal.length === width) return minimal;
  const result = new Uint8Array(width);
  result.set(minimal);
  if (value < 0n && minimal.length > 0) {
    result[minimal.length - 1] &= 0x7f;
    result[width - 1] |= 0x80;
  }
  return result;
};

const coerceRecipeValue = (
  value: FunctionArgument,
  sourceTypeName: string,
  resultTypeName: string,
  solidityAbi: boolean,
): FunctionArgument => {
  const sourceType = parseTypeStrict(sourceTypeName);
  const resultType = parseTypeStrict(resultTypeName);
  if (resultType === PrimitiveType.BOOL) {
    return numericRecipeValue(value, sourceTypeName, solidityAbi) !== 0n;
  }
  if (resultType === PrimitiveType.BIGINT || resultType instanceof IntType || resultType instanceof FixedType) {
    let numeric = numericRecipeValue(value, sourceTypeName, solidityAbi);
    if ((sourceType === PrimitiveType.BIGINT || sourceType instanceof IntType)
      && resultType instanceof FixedType) numeric *= resultType.scaleFactor;
    if (sourceType instanceof FixedType
      && (resultType === PrimitiveType.BIGINT || resultType instanceof IntType)) numeric /= sourceType.scaleFactor;
    if (sourceType instanceof FixedType && resultType instanceof FixedType) {
      numeric = resultType.decimals > sourceType.decimals
        ? numeric * 10n ** BigInt(resultType.decimals - sourceType.decimals)
        : numeric / 10n ** BigInt(sourceType.decimals - resultType.decimals);
    }
    if ((resultType instanceof IntType || resultType instanceof FixedType)
      && (numeric < resultType.minValue || numeric > resultType.maxValue)) {
      throw new Error(`deployment: deployment recipe value ${numeric} is out of bounds for ${resultTypeName}`);
    }
    return numeric;
  }
  if (resultType instanceof AddressType) {
    // The compiler's bytes/int -> address cast is a VM-level no-op: an address is the locking-bytecode stack
    // item itself. Reproduce that representation here so constructor genesis replay authenticates the same
    // value. CashAddress spelling is only possible for an address-typed source; bytes strings remain hex.
    if (value instanceof Uint8Array) return value;
    if (typeof value === 'string' && sourceType instanceof AddressType && value.includes(':')) {
      return addressToLockScript(value);
    }
    if (typeof value === 'string' && sourceType instanceof BytesType) {
      return hexToBin(value.startsWith('0x') ? value.slice(2) : value);
    }
    return bigIntToVmNumber(numericRecipeValue(value, sourceTypeName, solidityAbi));
  }
  if (resultType instanceof BytesType) {
    if (value instanceof Uint8Array) {
      if (resultType.bound === undefined) return value;
      if (!(sourceType instanceof BytesType)) {
        throw new Error(`deployment: deployment recipe cannot cast ${sourceTypeName} to ${resultTypeName}`);
      }
      return value.length > resultType.bound
        ? value.slice(0, resultType.bound)
        : Uint8Array.from([...value, ...new Uint8Array(resultType.bound - value.length)]);
    }
    const numeric = numericRecipeValue(value, sourceTypeName, solidityAbi);
    if (resultType.bound === undefined) return bigIntToVmNumber(numeric);
    const encoded = fixedVmNumber(numeric, resultType.bound);
    return solidityAbi ? encoded.reverse() : encoded;
  }
  throw new Error(`deployment: deployment recipe type ${resultTypeName} is not materializable`);
};

const canonicalRecipeEqualityValue = (
  value: FunctionArgument,
  typeName: string,
  solidityAbi: boolean,
): bigint | string => {
  const type = parseTypeStrict(typeName);
  if (type === PrimitiveType.BOOL || type === PrimitiveType.BIGINT
    || type instanceof IntType || type instanceof FixedType) {
    return numericRecipeValue(value, typeName, solidityAbi);
  }
  if (type === PrimitiveType.STRING) {
    if (typeof value === 'string') return binToHex(utf8ToBin(value));
    if (value instanceof Uint8Array) return binToHex(value);
    throw new Error('deployment: deployment recipe expected string');
  }
  if (type instanceof AddressType || type instanceof BytesType
    || type === PrimitiveType.PUBKEY || type === PrimitiveType.DATASIG) {
    let bytesValue = value;
    if (typeof bytesValue === 'string' && type instanceof AddressType && bytesValue.includes(':')) {
      bytesValue = addressToLockScript(bytesValue);
    } else if (typeof bytesValue === 'string' && type instanceof AddressType && /^(?:0x)?0*$/i.test(bytesValue)) {
      bytesValue = new Uint8Array(0);
    } else if (typeof bytesValue === 'string') {
      bytesValue = hexToBin(bytesValue.startsWith('0x') ? bytesValue.slice(2) : bytesValue);
    }
    if (!(bytesValue instanceof Uint8Array)) {
      throw new Error(`deployment: deployment recipe expected byte sequence ${typeName}`);
    }
    return binToHex(bytesValue);
  }
  throw new Error(`deployment: deployment recipe equality type ${typeName} is not materializable`);
};

export const evaluateChildDeploymentRecipe = (
  recipe: ChildDeploymentValueRecipe,
  args: readonly FunctionArgument[],
  inputTypes: readonly string[],
  solidityAbi: boolean,
  state: Readonly<Record<string, FunctionArgument>> = {},
  logicalCaller?: FunctionArgument,
  entryResolver?: FixedEffectEntryResolver,
): FunctionArgument => {
  const resultType = recipeType(recipe, inputTypes);
  const evaluate = (value: ChildDeploymentValueRecipe): FunctionArgument => evaluateChildDeploymentRecipe(
    value, args, inputTypes, solidityAbi, state, logicalCaller, entryResolver,
  );
  if (recipe.kind === 'handlerInput') {
    if (recipe.inputIndex < 0 || recipe.inputIndex >= args.length) {
      throw new Error(`deployment: deployment recipe input ${recipe.inputIndex} is out of range`);
    }
    return args[recipe.inputIndex];
  }
  if (recipe.kind === 'state') {
    if (!Object.hasOwn(state, recipe.name)) {
      throw new Error(`deployment: authenticated state recipe '${recipe.name}' is unavailable`);
    }
    return state[recipe.name];
  }
  if (recipe.kind === 'entry') {
    if (!entryResolver) throw new Error('deployment: authenticated entry recipe context is unavailable');
    return entryResolver(recipe, recipe.keys.map(evaluate));
  }
  if (recipe.kind === 'logicalCaller') {
    if (logicalCaller === undefined) {
      throw new Error('deployment: authenticated logical caller recipe is unavailable');
    }
    return logicalCaller;
  }
  if (recipe.kind === 'aggregate') {
    return recipe.elements.map(evaluate) as ConstructorArgument[];
  }
  if (recipe.kind === 'concat') {
    if (recipe.operands.length === 0) {
      throw new Error('deployment: deployment concat recipe requires at least one operand');
    }
    const parsedResult = parseTypeStrict(resultType);
    if (!(parsedResult instanceof BytesType) && parsedResult !== PrimitiveType.STRING) {
      throw new Error(`deployment: deployment concat recipe cannot produce ${resultType}`);
    }
    const values = recipe.operands.map((operand) => {
      const operandTypeName = recipeType(operand, inputTypes);
      const operandType = parseTypeStrict(operandTypeName);
      if (!(operandType instanceof BytesType) && operandType !== PrimitiveType.STRING) {
        throw new Error(`deployment: deployment concat operand ${operandTypeName} is not concatenable`);
      }
      return byteRecipeValue(
        evaluate(operand), operandTypeName, solidityAbi,
      );
    });
    const joined = Uint8Array.from(values.flatMap((value) => [...value]));
    if (parsedResult instanceof BytesType && parsedResult.bound !== undefined && joined.length !== parsedResult.bound) {
      throw new Error(`deployment: deployment concat recipe produced ${joined.length} bytes for ${resultType}`);
    }
    return parsedResult === PrimitiveType.STRING ? binToUtf8(joined) : joined;
  }
  if (recipe.kind === 'hash') {
    const expectedResultTypes = {
      ripemd160: 'bytes20', sha1: 'bytes20', sha256: 'bytes32', hash160: 'bytes20', hash256: 'bytes32',
    } as const;
    if (resultType !== expectedResultTypes[recipe.algorithm]) {
      throw new Error(`deployment: deployment ${recipe.algorithm} recipe cannot produce ${resultType}`);
    }
    const operand = byteRecipeValue(
      evaluate(recipe.operand),
      recipeType(recipe.operand, inputTypes),
      solidityAbi,
    );
    switch (recipe.algorithm) {
      case 'ripemd160': return ripemd160(operand);
      case 'sha1': return sha1.hash(operand);
      case 'sha256': return sha256(operand);
      case 'hash160': return hash160(operand);
      case 'hash256': return hash256(operand);
      default: throw new Error('deployment: unsupported deployment hash recipe');
    }
  }
  if (recipe.kind === 'intLiteral') return coerceRecipeValue(BigInt(recipe.value), 'bigint', resultType, solidityAbi);
  if (recipe.kind === 'boolLiteral') return coerceRecipeValue(recipe.value, 'bool', resultType, solidityAbi);
  if (recipe.kind === 'bytesLiteral') {
    return coerceRecipeValue(hexToBin(recipe.value), `bytes${recipe.value.length / 2}`, resultType, solidityAbi);
  }
  if (recipe.kind === 'cast') {
    const operand = evaluate(recipe.operand);
    return coerceRecipeValue(operand, recipeType(recipe.operand, inputTypes), resultType, solidityAbi);
  }
  if (recipe.kind === 'unary') {
    const operand = evaluate(recipe.operand);
    const operandTypeName = recipeType(recipe.operand, inputTypes);
    const operandType = parseTypeStrict(operandTypeName);
    const result = parseTypeStrict(resultType);
    const numeric = numericRecipeValue(operand, operandTypeName, solidityAbi);
    if (recipe.operator === '!') {
      if (operandType instanceof FixedType) {
        throw new Error('deployment: fixed deployment recipe does not support logical negation');
      }
      return coerceRecipeValue(numeric === 0n, 'bool', resultType, solidityAbi);
    }
    if (recipe.operator === '-') {
      if ((operandType instanceof FixedType || result instanceof FixedType)
        && (!(operandType instanceof FixedType) || !(result instanceof FixedType)
          || operandType.decimals !== result.decimals)) {
        throw new Error('deployment: fixed deployment recipe unary operands must use one scale');
      }
      return coerceRecipeValue(-numeric, operandTypeName, resultType, solidityAbi);
    }
    throw new Error(`deployment: unsupported deployment recipe unary operator ${recipe.operator}`);
  }
  if (recipe.kind === 'conditional') {
    const conditionType = recipeType(recipe.condition, inputTypes);
    if (conditionType !== 'bool'
      || recipeType(recipe.ifTrue, inputTypes) !== resultType
      || recipeType(recipe.ifFalse, inputTypes) !== resultType) {
      throw new Error('deployment: conditional recipe branches must match its declared type');
    }
    const condition = evaluate(recipe.condition);
    const selected = numericRecipeValue(condition, conditionType, solidityAbi) !== 0n
      ? recipe.ifTrue : recipe.ifFalse;
    return evaluate(selected);
  }
  const leftValue = evaluate(recipe.left);
  const leftType = recipeType(recipe.left, inputTypes);
  if (recipe.operator === '&&' || recipe.operator === '||') {
    const rightType = recipeType(recipe.right, inputTypes);
    if (parseTypeStrict(leftType) instanceof FixedType || parseTypeStrict(rightType) instanceof FixedType) {
      throw new Error('deployment: fixed deployment recipe does not support logical operators');
    }
    const left = numericRecipeValue(leftValue, leftType, solidityAbi) !== 0n;
    if (recipe.operator === '&&' && !left) return false;
    if (recipe.operator === '||' && left) return true;
    const rightValue = evaluate(recipe.right);
    const right = numericRecipeValue(rightValue, rightType, solidityAbi) !== 0n;
    return recipe.operator === '&&' ? left && right : left || right;
  }
  const rightValue = evaluate(recipe.right);
  const rightType = recipeType(recipe.right, inputTypes);
  // Relational operators on byte values compare them as unsigned big-endian numbers (the compiled script's
  // address ordering), not as minimal VM numbers.
  const byteRelational = ['<', '<=', '>', '>='].includes(recipe.operator)
    && (parseTypeStrict(leftType) instanceof AddressType || parseTypeStrict(leftType) instanceof BytesType)
    && (parseTypeStrict(rightType) instanceof AddressType || parseTypeStrict(rightType) instanceof BytesType);
  if (byteRelational) {
    const comparison = compareUnsignedBigEndian(
      byteRecipeValue(leftValue, leftType, solidityAbi),
      byteRecipeValue(rightValue, rightType, solidityAbi),
    );
    switch (recipe.operator) {
      case '<': return comparison < 0;
      case '<=': return comparison <= 0;
      case '>': return comparison > 0;
      case '>=': return comparison >= 0;
      default: break;
    }
  }
  const leftParsedType = parseTypeStrict(leftType);
  const rightParsedType = parseTypeStrict(rightType);
  const resultParsedType = parseTypeStrict(resultType);
  const hasFixedOperand = leftParsedType instanceof FixedType || rightParsedType instanceof FixedType;
  if (hasFixedOperand || resultParsedType instanceof FixedType) {
    if (!(leftParsedType instanceof FixedType) || !(rightParsedType instanceof FixedType)
      || leftParsedType.decimals !== rightParsedType.decimals) {
      throw new Error('deployment: fixed deployment recipe binary operands must use one scale');
    }
    const booleanResult = ['==', '!=', '<', '<=', '>', '>='].includes(recipe.operator);
    if (booleanResult ? resultParsedType !== PrimitiveType.BOOL
      : !(resultParsedType instanceof FixedType)
        || resultParsedType.decimals !== leftParsedType.decimals) {
      throw new Error('deployment: fixed deployment recipe result must preserve operand scale');
    }
  }
  if (recipe.operator === '==' || recipe.operator === '!=') {
    const equal = canonicalRecipeEqualityValue(leftValue, leftType, solidityAbi)
      === canonicalRecipeEqualityValue(rightValue, rightType, solidityAbi);
    return recipe.operator === '==' ? equal : !equal;
  }
  const left = numericRecipeValue(leftValue, leftType, solidityAbi);
  const right = numericRecipeValue(rightValue, rightType, solidityAbi);
  let value: bigint | boolean;
  const fixedScale = resultParsedType instanceof FixedType ? resultParsedType.scaleFactor : undefined;
  switch (recipe.operator) {
    case '+': value = left + right; break;
    case '-': value = left - right; break;
    case '*': value = fixedScale === undefined ? left * right : left * right / fixedScale; break;
    case '/':
      if (right === 0n) throw new Error('deployment: division by zero in deployment recipe');
      value = fixedScale === undefined ? left / right : left * fixedScale / right; break;
    case '%':
      if (right === 0n) throw new Error('deployment: modulo by zero in deployment recipe');
      value = left % right; break;
    case '<': value = left < right; break;
    case '<=': value = left <= right; break;
    case '>': value = left > right; break;
    case '>=': value = left >= right; break;
    default: throw new Error(`deployment: unsupported deployment recipe binary operator ${recipe.operator}`);
  }
  return coerceRecipeValue(
    value,
    typeof value === 'boolean' ? 'bool' : fixedScale === undefined ? 'bigint' : resultType,
    resultType,
    solidityAbi,
  );
};

/** Normalize a replayed scalar into the physical state-codec domain used by entry commitments. */
export const materializeChildDeploymentEntryScalar = (
  value: FunctionArgument, typeName: string, solidityAbi: boolean,
): bigint | boolean | Uint8Array => {
  const type = parseTypeStrict(typeName);
  if (type === PrimitiveType.BOOL) return numericRecipeValue(value, typeName, solidityAbi) !== 0n;
  if (type === PrimitiveType.BIGINT || type instanceof IntType || type instanceof FixedType) {
    return numericRecipeValue(value, typeName, solidityAbi);
  }
  if (type instanceof AddressType || type instanceof BytesType
    || type === PrimitiveType.PUBKEY || type === PrimitiveType.DATASIG) {
    return hexToBin(canonicalRecipeEqualityValue(value, typeName, solidityAbi) as string);
  }
  throw new Error(`deployment: deployment entry scalar type ${typeName} is not materializable`);
};

/** Normalize a replayed fixed-layout aggregate into the state codec's positional representation. */
export const materializeChildDeploymentEntryValue = (
  value: FunctionArgument, typeName: string, solidityAbi: boolean,
  structs: readonly StructDefinitionInfo[] = [], visited: ReadonlySet<string> = new Set(),
): StateValue => {
  const struct = structs.find((candidate) => candidate.name === typeName);
  if (struct) {
    if (visited.has(typeName)) {
      throw new Error(`deployment: cyclic deployment entry struct ${typeName} is not materializable`);
    }
    if (!Array.isArray(value) || value.length !== struct.fields.length) {
      throw new Error(`deployment: deployment entry struct ${typeName} has an invalid aggregate value`);
    }
    const nested = new Set(visited);
    nested.add(typeName);
    return struct.fields.map((field, index) => materializeChildDeploymentEntryValue(
      value[index], field.type, solidityAbi, structs, nested,
    ));
  }
  const array = parseArrayTypeString(typeName);
  if (array) {
    if (array.bound === undefined || !Array.isArray(value) || value.length !== array.bound) {
      throw new Error(`deployment: deployment entry array ${typeName} is not a fixed-layout aggregate`);
    }
    return value.map((element) => materializeChildDeploymentEntryValue(
      element, array.elementType, solidityAbi, structs, visited,
    ));
  }
  return materializeChildDeploymentEntryScalar(value, typeName, solidityAbi);
};
