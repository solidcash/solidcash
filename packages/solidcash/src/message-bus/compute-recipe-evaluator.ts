/**
 * Pure, fail-closed replay of compiler-published compute operands. These values are planner candidates:
 * the participant and producer covenants still bind every return, side-car argument and result in the VM.
 */
import { hexToBin, utf8ToBin } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { decodeIntFixedWidth, encodeInt, encodeIntAsFixedBytes, parseArrayTypeString,
  type Artifact, type ExternalCallExpression, type StateValue } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { lockingBytecodeToSolidityAddressPayload, tryCashAddressToLockScript } from '../utils.js';
import { encodeEvmInvocationResult } from '../stateful/evm-abi-result.js';

export class PendingComputeProducerResult extends Error {
  constructor(readonly callsiteId: number) {
    super(`messageBus: compute recipe awaits an exact producer candidate at callsite ${callsiteId}`);
  }
}

/** Runtime calldata can be malformed on a path that reverts before reaching recovery. */
export class UnusableComputeSignature extends Error {
  constructor() {
    super('messageBus: compute recipe cannot bind a non-canonical runtime signature');
  }
}

export interface ComputeRecipeContext {
  readonly artifact: Artifact;
  readonly args: readonly FunctionArgument[];
  readonly inputTypes: readonly string[];
  /** Exact caller-prepared or deterministic state-derived candidate; never a schema-shaped placeholder. */
  readonly producerResult: (expression: ExternalCallExpression) => FunctionArgument | undefined;
}

const bytesOf = (value: FunctionArgument, type: string): Uint8Array => {
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (typeof value === 'string') {
    if (type === 'string') return utf8ToBin(value);
    if (/^0x(?:[0-9a-f]{2})*$/i.test(value)) return hexToBin(value.slice(2));
    if (/^bytes(?:[1-9]|[12][0-9]|3[0-2])?$/.test(type)
      && /^(?:[0-9a-f]{2})*$/i.test(value)) {
      const bytes = hexToBin(value);
      const width = /^bytes(\d+)$/.exec(type)?.[1];
      if (width !== undefined && bytes.length !== Number(width)) {
        throw new Error(`messageBus: compute recipe ${type} literal has ${bytes.length} bytes`);
      }
      return bytes;
    }
  }
  throw new Error(`messageBus: compute recipe requires canonical ${type} bytes`);
};

const numericOf = (value: FunctionArgument, type: string): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^(?:-?\d+|0x[0-9a-f]+)$/i.test(value)) return BigInt(value);
  throw new Error(`messageBus: compute recipe requires canonical ${type} integer`);
};

const concat = (parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
};

// eslint-disable-next-line max-len
const integerType = /^(u?int)(?:(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256))?$/;
const fixedBytesType = /^bytes([1-9]|[12][0-9]|3[0-2])$/;

type IntegerBounds = { bits: number; signed: boolean };

const integerBounds = (type: string): IntegerBounds | undefined => {
  const match = integerType.exec(type);
  return match ? { bits: Number(match[2] ?? 256), signed: match[1] === 'int' } : undefined;
};

const checkedInteger = (number: bigint, { bits, signed }: IntegerBounds, label: string): bigint => {
  const minimum = signed ? -(1n << BigInt(bits - 1)) : 0n;
  const maximum = signed ? (1n << BigInt(bits - 1)) - 1n : (1n << BigInt(bits)) - 1n;
  if (number < minimum || number > maximum) throw new Error(`messageBus: compute recipe ${label} is out of range`);
  return number;
};

const addressBytes = (value: FunctionArgument): Uint8Array => {
  let bytes: Uint8Array | undefined;
  if (value instanceof Uint8Array) bytes = value;
  else if (typeof value === 'string') {
    bytes = tryCashAddressToLockScript(value);
    if (!bytes && /^0x(?:[0-9a-f]{2})*$/i.test(value)) bytes = hexToBin(value.slice(2));
  }
  if (!bytes) throw new Error('messageBus: compute recipe requires a canonical address');
  return bytes;
};

// The 20-byte Solidity identity of an address: empty is zero, a zero-padded ABI word is unwrapped, and locking
// bytecode maps through its hash payload.
const solidityAddressPayload = (value: FunctionArgument): Uint8Array => {
  const bytes = addressBytes(value);
  if (bytes.length === 0) return new Uint8Array(20);
  if (bytes.length === 32 && bytes.slice(0, 12).every((byte) => byte === 0)) return bytes.slice(12);
  const payload = lockingBytecodeToSolidityAddressPayload(bytes);
  if (!payload) throw new Error('messageBus: compute recipe address has no Solidity identity');
  return payload;
};

const solidityPacked = (value: FunctionArgument, type: string, ctx: ComputeRecipeContext): Uint8Array => {
  if (type === 'bool') {
    if (value !== true && value !== false && value !== 0n && value !== 1n) {
      throw new Error('messageBus: compute recipe bool is non-canonical');
    }
    return Uint8Array.of(value === true || value === 1n ? 1 : 0);
  }
  const integer = integerBounds(type);
  if (integer) {
    const number = checkedInteger(numericOf(value, type), integer, type);
    const width = integer.bits / 8;
    const result = new Uint8Array(width);
    let unsigned = number < 0n ? (1n << BigInt(integer.bits)) + number : number;
    for (let index = width - 1; index >= 0; index -= 1) {
      result[index] = Number(unsigned & 0xffn);
      unsigned >>= 8n;
    }
    return result;
  }
  if (type === 'address' || type === 'address payable') return solidityAddressPayload(value);
  if (fixedBytesType.test(type)) {
    const bytes = bytesOf(value, type);
    const width = Number(fixedBytesType.exec(type)![1]);
    if (bytes.length !== width) throw new Error(`messageBus: compute recipe ${type} requires ${width} bytes`);
    return bytes;
  }
  if (type === 'bytes' || type === 'string') return bytesOf(value, type);
  const array = parseArrayTypeString(type);
  if (array && array.bound === undefined && Array.isArray(value)) {
    // The EVM packed-array form omits the length but ABI-pads each scalar element to a full word.
    // The compiler admits only fixed-width value-type elements for this lowering.
    if (!integerBounds(array.elementType) && array.elementType !== 'bool'
      && !fixedBytesType.test(array.elementType) && !['address', 'address payable'].includes(array.elementType)) {
      throw new Error(`messageBus: compute recipe unsupported packed array element ${array.elementType}`);
    }
    return concat(value.map((element) => {
      if (typeof element !== 'bigint' && typeof element !== 'boolean'
        && typeof element !== 'string' && !(element instanceof Uint8Array)) {
        throw new Error('messageBus: compute recipe packed array has a non-scalar element');
      }
      return encodeEvmInvocationResult(
        [element as StateValue], [array.elementType],
        ctx.artifact.structs ?? ctx.artifact.stateLayout?.structs, ctx.artifact.enums,
      );
    }));
  }
  throw new Error(`messageBus: compute recipe unsupported packed type ${type}`);
};

const nativePacked = (value: FunctionArgument, type: string): Uint8Array => {
  if (type === 'bool') {
    if (value !== true && value !== false && value !== 0n && value !== 1n) {
      throw new Error('messageBus: compute recipe bool is non-canonical');
    }
    return Uint8Array.of(value === true || value === 1n ? 1 : 0);
  }
  const integer = integerBounds(type);
  if (integer) {
    return encodeIntAsFixedBytes(checkedInteger(numericOf(value, type), integer, type), Math.ceil((integer.bits + 1) / 8));
  }
  if (type === 'bigint') return encodeInt(numericOf(value, type));
  if (fixedBytesType.test(type)) {
    const bytes = bytesOf(value, type);
    const width = Number(fixedBytesType.exec(type)![1]);
    if (bytes.length !== width) throw new Error(`messageBus: compute recipe ${type} requires ${width} bytes`);
    return bytes;
  }
  if (type === 'bytes' || type === 'string') return bytesOf(value, type);
  if (type === 'address' || type === 'address payable') return addressBytes(value);
  throw new Error(`messageBus: compute recipe unsupported native packed type ${type}`);
};

const expressionType = (expression: ExternalCallExpression, ctx: ComputeRecipeContext): string => {
  if (expression.type) return expression.type;
  if (expression.kind === 'source' && expression.source?.kind === 'forward'
    && expression.source.paramIndex !== undefined) {
    return ctx.inputTypes[expression.source.paramIndex] ?? '';
  }
  if (expression.kind === 'producerResult') return expression.type ?? '';
  if (expression.kind === 'literal' && typeof expression.value === 'string') return 'string';
  if (expression.kind === 'call' && expression.name === 'keccak256') return 'bytes32';
  if (expression.kind === 'abiEncode' || expression.kind === 'bytesConcat'
    || expression.kind === 'abiEncodePacked') return 'bytes';
  return '';
};

export function evaluateComputeRecipeExpression(
  expression: ExternalCallExpression,
  ctx: ComputeRecipeContext,
): FunctionArgument {
  const evaluate = (value: ExternalCallExpression): FunctionArgument => (
    evaluateComputeRecipeExpression(value, ctx)
  );
  if (expression.kind === 'source' && expression.source?.kind === 'forward') {
    const index = expression.source.paramIndex;
    if (!Number.isSafeInteger(index) || index! < 0 || index! >= ctx.args.length) {
      throw new Error('messageBus: compute recipe names an invalid handler argument');
    }
    return ctx.args[index!];
  }
  if (expression.kind === 'producerResult') {
    const id = expression.callsiteId;
    if (!Number.isSafeInteger(id) || id! < 0 || !Number.isSafeInteger(expression.resultIndex)
      || expression.resultIndex! < 0) {
      throw new Error('messageBus: compute recipe names an invalid producer result');
    }
    const result = ctx.producerResult(expression);
    if (result === undefined) throw new PendingComputeProducerResult(id!);
    return result;
  }
  if (expression.kind === 'literal') {
    if (typeof expression.value === 'string') return expression.value;
    if (typeof expression.value === 'boolean') return expression.value;
    throw new Error('messageBus: compute recipe has an unsupported literal');
  }
  if (expression.kind === 'cast' && expression.expression && expression.type) {
    const value = evaluate(expression.expression);
    const fromType = expressionType(expression.expression, ctx);
    const target = expression.type;
    const solidity = ctx.artifact.compiler?.options?.evmCompat === true;
    const toInteger = integerBounds(target);
    if (toInteger) {
      let number: bigint;
      if (fromType === 'address' || fromType === 'address payable') {
        const payload = solidityAddressPayload(value);
        number = [...(solidity ? payload : payload.slice().reverse())]
          .reduce((sum, byte) => (sum << 8n) | BigInt(byte), 0n);
      } else if (fixedBytesType.test(fromType)) {
        const bytes = bytesOf(value, fromType);
        const width = Number(fixedBytesType.exec(fromType)![1]);
        if (bytes.length !== width) throw new Error(`messageBus: compute recipe ${fromType} requires ${width} bytes`);
        const littleEndian = solidity ? bytes.slice().reverse() : bytes;
        number = toInteger.signed ? decodeIntFixedWidth(littleEndian)
          : [...littleEndian].reverse().reduce((sum, byte) => (sum << 8n) | BigInt(byte), 0n);
      } else number = numericOf(value, fromType);
      const fromInteger = integerBounds(fromType);
      if (solidity && !toInteger.signed && fromInteger && !fromInteger.signed && toInteger.bits < fromInteger.bits) {
        number %= 1n << BigInt(toInteger.bits);
      }
      return checkedInteger(number, toInteger, `cast to ${target}`);
    }
    const toBytes = fixedBytesType.exec(target);
    if (toBytes) {
      const width = Number(toBytes[1]);
      if ((fromType === 'address' || fromType === 'address payable') && width === 20) {
        return solidityAddressPayload(value);
      }
      if (integerBounds(fromType) || fromType === 'bigint') {
        const bytes = encodeIntAsFixedBytes(numericOf(value, fromType), width);
        return solidity ? bytes.reverse() : bytes;
      }
      const bytes = bytesOf(value, fromType);
      return bytes.length >= width ? bytes.slice(0, width)
        : concat([bytes, new Uint8Array(width - bytes.length)]);
    }
    if (target === 'bytes') {
      if (typeof value === 'string' && fromType === 'string') return utf8ToBin(value);
      if (integerBounds(fromType) || fromType === 'bigint') return encodeInt(numericOf(value, fromType));
      return bytesOf(value, fromType);
    }
    if (target === 'string') return value;
    if (target === 'bigint') return numericOf(value, fromType);
    if (target === 'bool') {
      if (typeof value === 'boolean') return value;
      return numericOf(value, fromType) !== 0n;
    }
    if (target === 'address' || target === 'address payable') return addressBytes(value);
    throw new Error(`messageBus: unsupported compute recipe cast to ${target}`);
  }
  if (expression.kind === 'abiEncode') {
    if (ctx.artifact.compiler?.options?.evmCompat !== true) {
      throw new Error('messageBus: compute recipe abi.encode needs Solidity ABI');
    }
    const children = expression.args ?? [];
    const types = children.map((child) => expressionType(child, ctx));
    if (types.some((type) => type === '')) {
      throw new Error('messageBus: compute recipe abi.encode has an untyped operand');
    }
    const values = children.map((child, index) => {
      const value = evaluate(child);
      return /^(?:u?int(?:\d+)?|bigint)$/.test(types[index])
        ? numericOf(value, types[index]) : value;
    });
    return encodeEvmInvocationResult(values as Parameters<typeof encodeEvmInvocationResult>[0],
      types, ctx.artifact.structs ?? ctx.artifact.stateLayout?.structs, ctx.artifact.enums);
  }
  if (expression.kind === 'abiEncodePacked') {
    const children = expression.args ?? [];
    const types = expression.fields;
    if (!types || types.length !== children.length || types.some((type) => !type)) {
      throw new Error('messageBus: compute recipe abi.encodePacked has an untyped operand');
    }
    const solidity = ctx.artifact.compiler?.options?.evmCompat === true;
    return concat(children.map((child, index) => solidity
      ? solidityPacked(evaluate(child), types[index], ctx)
      : nativePacked(evaluate(child), types[index])));
  }
  if (expression.kind === 'bytesConcat') {
    const children = expression.args ?? [];
    if (children.length === 0) throw new Error('messageBus: compute recipe bytes.concat has no operands');
    const values = children.map((child) => bytesOf(evaluate(child), expressionType(child, ctx)));
    return Uint8Array.from(values.flatMap((value) => [...value]));
  }
  if (expression.kind === 'call' && expression.name === 'keccak256') {
    if (expression.args?.length !== 1) {
      throw new Error('messageBus: compute recipe keccak256 must have one operand');
    }
    return keccak_256(bytesOf(evaluate(expression.args[0]), expressionType(expression.args[0], ctx)));
  }
  throw new Error(`messageBus: unsupported compute recipe expression ${expression.kind}`);
}

/** ECDSA signature65 calldata uses [rBE32 | sBE32 | v1]; the recovery side-car binds LE scalars. */
export function evaluateSignature65RecoveryArgument(
  hash: ExternalCallExpression,
  signature: ExternalCallExpression,
  ctx: ComputeRecipeContext,
): Uint8Array {
  if (ctx.artifact.compiler?.options?.evmCompat !== true) {
    throw new Error('messageBus: signature65 compute recipe requires EVM-compatible scalar encoding');
  }
  const digest = bytesOf(evaluateComputeRecipeExpression(hash, ctx), expressionType(hash, ctx));
  const runtimeSignature = signature.kind === 'source' && expressionType(signature, ctx) === 'bytes';
  const signatureValue = evaluateComputeRecipeExpression(signature, ctx);
  let sig: Uint8Array;
  try {
    sig = bytesOf(signatureValue, expressionType(signature, ctx));
  } catch (error) {
    if (runtimeSignature) {
      throw new UnusableComputeSignature();
    }
    throw error;
  }
  if (runtimeSignature && (sig.length !== 65 || (sig[64] !== 27 && sig[64] !== 28))) {
    throw new UnusableComputeSignature();
  }
  if (digest.length !== 32 || sig.length !== 65 || (sig[64] !== 27 && sig[64] !== 28)) {
    throw new Error('messageBus: compute recipe requires a canonical 32-byte digest and 65-byte signature');
  }
  return Uint8Array.from([
    ...digest.slice().reverse(), sig[64],
    ...sig.slice(0, 32).reverse(), ...sig.slice(32, 64).reverse(),
  ]);
}

/** Exact four-argument recovery call; Solidity's builtin reverses bytes32 scalars at its boundary. */
export function evaluateArgs4RecoveryArgument(
  args: readonly [ExternalCallExpression, ExternalCallExpression,
    ExternalCallExpression, ExternalCallExpression],
  ctx: ComputeRecipeContext,
): Uint8Array {
  const [hash, v, r, s] = args.map((value) => evaluateComputeRecipeExpression(value, ctx));
  const hashBytes = bytesOf(hash, expressionType(args[0], ctx));
  const rBytes = bytesOf(r, expressionType(args[2], ctx));
  const sBytes = bytesOf(s, expressionType(args[3], ctx));
  const recoveryId = numericOf(v, expressionType(args[1], ctx));
  if (hashBytes.length !== 32 || rBytes.length !== 32 || sBytes.length !== 32
    || (recoveryId !== 27n && recoveryId !== 28n)) {
    throw new Error('messageBus: compute recipe recovery arguments are non-canonical');
  }
  const reverseEvmScalars = ctx.artifact.compiler?.options?.evmCompat === true;
  return Uint8Array.from([
    ...(reverseEvmScalars ? hashBytes.reverse() : hashBytes), Number(recoveryId),
    ...(reverseEvmScalars ? rBytes.reverse() : rBytes),
    ...(reverseEvmScalars ? sBytes.reverse() : sBytes),
  ]);
}
