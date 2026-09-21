import { hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  getDefaultStateValue, parseArrayTypeString, type EnumDefinitionAbi, type StateValue,
  type StructDefinitionInfo,
} from '@solidcash/utils';
import { lockingBytecodeToSolidityAddressPayload, tryCashAddressToLockScript } from '../utils.js';

interface EncodedEvmValue {
  bytes: Uint8Array;
  dynamic: boolean;
}

const concat = (parts: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
};

const word = (value: bigint): Uint8Array => {
  if (value < 0n || value >= 1n << 256n) throw new Error('EVM ABI word is outside uint256 range');
  const out = new Uint8Array(32);
  let remaining = value;
  for (let index = 31; index >= 0; index -= 1) {
    out[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return out;
};

const tuple = (values: readonly EncodedEvmValue[]): Uint8Array => {
  const headLength = values.reduce((length, value) => length + (value.dynamic ? 32 : value.bytes.length), 0);
  const heads: Uint8Array[] = [];
  const tails: Uint8Array[] = [];
  let tailOffset = headLength;
  for (const value of values) {
    if (value.dynamic) {
      heads.push(word(BigInt(tailOffset)));
      tails.push(value.bytes);
      tailOffset += value.bytes.length;
    } else heads.push(value.bytes);
  }
  return concat([...heads, ...tails]);
};

const bytesValue = (value: StateValue, type: string): Uint8Array => {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') {
    if (type === 'string') return utf8ToBin(value);
    if (/^(?:0x)?[0-9a-f]*$/i.test(value)) return hexToBin(value.replace(/^0x/, ''));
  }
  throw new Error(`EVM ABI ${type} value must be bytes${type === 'string' ? ' or a string' : ''}`);
};

const addressPayload = (value: StateValue): Uint8Array => {
  let bytes: Uint8Array | undefined;
  if (value instanceof Uint8Array) bytes = value;
  else if (typeof value === 'string') {
    bytes = value.includes(':') ? tryCashAddressToLockScript(value) : hexToBin(value.replace(/^0x/, ''));
  }
  if (!bytes) throw new Error('EVM ABI address value must be a byte array or address string');
  // SolidCash VM values use the minimal empty vector for numeric/address zero. Solidity ABI requires the same
  // value to occupy the canonical right-aligned 20-byte address payload.
  if (bytes.length === 0) return new Uint8Array(20);
  const payload = lockingBytecodeToSolidityAddressPayload(bytes);
  if (payload !== undefined) return payload;
  throw new Error(`EVM ABI address requires exactly 20 payload bytes, got ${bytes.length}`);
};

const numericValue = (value: StateValue, type: string): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^(?:-?\d+|0x[0-9a-f]+)$/i.test(value)) return BigInt(value);
  throw new Error(`EVM ABI ${type} value must be an integer`);
};

const numericWord = (value: StateValue, type: string): Uint8Array => {
  const signed = type === 'int' || /^int\d+$/.test(type) || type === 'fixed' || /^fixed\d+x\d+$/.test(type);
  const width = /^(?:u?int)(\d+)$/.exec(type)?.[1]
    ?? /^(?:u?fixed)(\d+)x\d+$/.exec(type)?.[1];
  const bits = width === undefined ? 256 : Number(width);
  const n = numericValue(value, type);
  const minimum = signed ? -(1n << BigInt(bits - 1)) : 0n;
  const maximum = signed ? (1n << BigInt(bits - 1)) - 1n : (1n << BigInt(bits)) - 1n;
  if (n < minimum || n > maximum) throw new Error(`EVM ABI ${type} value is out of range`);
  return word(n < 0n ? (1n << 256n) + n : n);
};

const encodeValue = (
  value: StateValue,
  type: string,
  structs: readonly StructDefinitionInfo[] | undefined,
  enums: readonly EnumDefinitionAbi[] | undefined,
  activeStructs: ReadonlySet<string>,
): EncodedEvmValue => {
  if (type === 'bool') {
    if (typeof value !== 'boolean' && value !== 0n && value !== 1n) {
      throw new Error('EVM ABI bool value must be boolean, zero, or one');
    }
    return { bytes: word(value === true || value === 1n ? 1n : 0n), dynamic: false };
  }
  if (type === 'int' || type === 'uint' || type === 'bigint' || type === 'fixed' || type === 'ufixed'
    || /^u?int\d+$/.test(type) || /^u?fixed\d+x\d+$/.test(type)) {
    return { bytes: numericWord(value, type), dynamic: false };
  }
  const enumeration = enums?.find((candidate) => candidate.name === type);
  if (enumeration) {
    const n = numericValue(value, type);
    if (!enumeration.members.some((member) => BigInt(member.value) === n)) {
      throw new Error(`EVM ABI enum ${type} value is outside its declared members`);
    }
    return { bytes: word(n), dynamic: false };
  }
  if (type === 'address' || type === 'address payable') {
    return { bytes: concat([new Uint8Array(12), addressPayload(value)]), dynamic: false };
  }
  const fixedBytes = /^bytes([1-9]|[12][0-9]|3[0-2])$/.exec(type);
  if (fixedBytes) {
    const bytes = bytesValue(value, type);
    const length = Number(fixedBytes[1]);
    if (bytes.length !== length) throw new Error(`EVM ABI ${type} requires ${length} bytes, got ${bytes.length}`);
    return { bytes: concat([bytes, new Uint8Array(32 - length)]), dynamic: false };
  }
  if (type === 'bytes' || type === 'string') {
    const bytes = bytesValue(value, type);
    const padding = (32 - (bytes.length % 32)) % 32;
    return { bytes: concat([word(BigInt(bytes.length)), bytes, new Uint8Array(padding)]), dynamic: true };
  }
  const array = parseArrayTypeString(type);
  if (array) {
    if (!Array.isArray(value)) throw new Error(`EVM ABI ${type} value must be an array`);
    if (array.bound !== undefined && value.length !== array.bound) {
      throw new Error(`EVM ABI ${type} requires ${array.bound} elements, got ${value.length}`);
    }
    const elements = value.map((element) =>
      encodeValue(element, array.elementType, structs, enums, activeStructs));
    const encodedElements = tuple(elements);
    return array.bound === undefined
      ? { bytes: concat([word(BigInt(value.length)), encodedElements]), dynamic: true }
      : { bytes: encodedElements, dynamic: elements.some((element) => element.dynamic) };
  }
  const struct = structs?.find((candidate) => candidate.name === type);
  if (struct) {
    if (activeStructs.has(type)) throw new Error(`EVM ABI struct schema is recursive at ${type}`);
    if (value === null || typeof value !== 'object' || value instanceof Uint8Array) {
      throw new Error(`EVM ABI struct ${type} value must be positional or field-addressable`);
    }
    const positional = Array.isArray(value);
    if (positional && value.length !== struct.fields.length) {
      throw new Error(`EVM ABI struct ${type} requires ${struct.fields.length} fields, got ${value.length}`);
    }
    const record = value as Record<string, StateValue>;
    if (!positional) {
      const extras = Object.keys(record).filter((key) => !struct.fields.some((field) => field.name === key));
      if (extras.length > 0) throw new Error(`EVM ABI struct ${type} has unknown field '${extras[0]}'`);
    }
    const nested = new Set(activeStructs); nested.add(type);
    const fields = struct.fields.map((field, index) => {
      const supplied = positional ? value[index] : record[field.name];
      return encodeValue(
        supplied ?? getDefaultStateValue(field.type, structs), field.type, structs, enums, nested,
      );
    });
    return { bytes: tuple(fields), dynamic: fields.some((field) => field.dynamic) };
  }
  // Named enum metadata was absent from older artifacts. Preserve their integer wire representation without
  // mistaking an unsupported aggregate for native pushdata.
  if (typeof value === 'bigint' || typeof value === 'number') {
    return { bytes: numericWord(value, 'uint8'), dynamic: false };
  }
  throw new Error(`EVM ABI result type '${type}' has no supported canonical encoding`);
};

/** Encode one complete Solidity ABI invocation result tuple. */
export function encodeEvmInvocationResult(
  values: readonly StateValue[],
  types: readonly string[],
  structs?: readonly StructDefinitionInfo[],
  enums?: readonly EnumDefinitionAbi[],
): Uint8Array {
  if (values.length !== types.length) {
    throw new Error(`EVM ABI result has ${values.length} values for ${types.length} declared types`);
  }
  return tuple(values.map((value, index) => encodeValue(
    value, types[index], structs, enums, new Set(),
  )));
}

const EVM_WORD_BYTES = 32;
const EVM_DECODE_MAX_DEPTH = 64;

interface DecodedEvmValue {
  value: StateValue;
  end: number;
}

const decodeWord = (bytes: Uint8Array, offset: number): bigint => {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset + EVM_WORD_BYTES > bytes.length) {
    throw new Error('EVM ABI word is outside the result');
  }
  let value = 0n;
  for (let index = offset; index < offset + EVM_WORD_BYTES; index += 1) {
    value = (value << 8n) | BigInt(bytes[index]);
  }
  return value;
};

const safeOffset = (value: bigint): number => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('EVM ABI offset exceeds the safe range');
  return Number(value);
};

const checkedAdd = (left: number, right: number, limit: number): number => {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right) || right < 0 || left > limit - right) {
    throw new Error('EVM ABI range exceeds the result');
  }
  return left + right;
};

const structFor = (
  type: string, structs: readonly StructDefinitionInfo[] | undefined,
): StructDefinitionInfo | undefined => structs?.find((candidate) => candidate.name === type);

/**
 * Return the exact inline head width, or `undefined` when the type is represented by one offset word.
 * Resolving this independently of the encoded bytes prevents an attacker-controlled offset from changing the
 * schema's head layout.
 */
const staticEvmWidth = (
  type: string,
  structs: readonly StructDefinitionInfo[] | undefined,
  activeStructs: ReadonlySet<string>,
  depth: number,
): number | undefined => {
  if (depth > EVM_DECODE_MAX_DEPTH) throw new Error('EVM ABI schema exceeds the recursion limit');
  if (type === 'bytes' || type === 'string') return undefined;
  const array = parseArrayTypeString(type);
  if (array) {
    if (array.bound === undefined) return undefined;
    const elementWidth = staticEvmWidth(array.elementType, structs, activeStructs, depth + 1);
    if (elementWidth === undefined) return undefined;
    const width = elementWidth * array.bound;
    if (!Number.isSafeInteger(width)) throw new Error('EVM ABI static array is too large');
    return width;
  }
  const struct = structFor(type, structs);
  if (struct) {
    if (activeStructs.has(type)) throw new Error(`EVM ABI struct schema is recursive at ${type}`);
    const nested = new Set(activeStructs); nested.add(type);
    let width = 0;
    for (const field of struct.fields) {
      const fieldWidth = staticEvmWidth(field.type, structs, nested, depth + 1);
      if (fieldWidth === undefined) return undefined;
      width += fieldWidth;
      if (!Number.isSafeInteger(width)) throw new Error('EVM ABI struct is too large');
    }
    return width;
  }
  return EVM_WORD_BYTES;
};

const decodeNumericWord = (bytes: Uint8Array, offset: number, type: string): bigint => {
  const match = /^(u?)(?:int)(\d+)$/.exec(type)
    ?? /^(u?)(?:fixed)(\d+)x\d+$/.exec(type);
  const signed = type === 'int' || type === 'fixed' || (match !== null && match[1] === '');
  const bits = match ? Number(match[2]) : 256;
  if (!Number.isSafeInteger(bits) || bits < 8 || bits > 256 || bits % 8 !== 0) {
    throw new Error(`EVM ABI numeric type '${type}' has an invalid width`);
  }
  const encoded = decodeWord(bytes, offset);
  if (!signed) {
    if (bits < 256 && encoded >= 1n << BigInt(bits)) {
      throw new Error(`EVM ABI ${type} has non-zero high padding`);
    }
    return encoded;
  }
  if (bits === 256) return encoded >= 1n << 255n ? encoded - (1n << 256n) : encoded;
  const modulus = 1n << BigInt(bits);
  const payload = encoded & (modulus - 1n);
  const negative = (payload & (1n << BigInt(bits - 1))) !== 0n;
  const canonical = negative ? ((1n << 256n) - modulus) | payload : payload;
  if (encoded !== canonical) throw new Error(`EVM ABI ${type} has invalid sign padding`);
  return negative ? payload - modulus : payload;
};

const decodeEvmTuple = (
  bytes: Uint8Array,
  start: number,
  types: readonly string[],
  structs: readonly StructDefinitionInfo[] | undefined,
  enums: readonly EnumDefinitionAbi[] | undefined,
  activeStructs: ReadonlySet<string>,
  depth: number,
): { values: StateValue[]; end: number } => {
  if (depth > EVM_DECODE_MAX_DEPTH) throw new Error('EVM ABI value exceeds the recursion limit');
  const widths = types.map((type) => staticEvmWidth(type, structs, activeStructs, depth + 1));
  const headLength = widths.reduce<number>((length, width) => length + (width ?? EVM_WORD_BYTES), 0);
  if (!Number.isSafeInteger(headLength)) throw new Error('EVM ABI tuple head is too large');
  const headEnd = checkedAdd(start, headLength, bytes.length);
  let headCursor = start;
  let tailCursor = headEnd;
  const values: StateValue[] = [];
  for (let index = 0; index < types.length; index += 1) {
    const width = widths[index];
    if (width !== undefined) {
      const decoded = decodeEvmValue(bytes, headCursor, types[index], structs, enums, activeStructs, depth + 1);
      if (decoded.end !== headCursor + width) throw new Error('EVM ABI static value has an invalid width');
      headCursor = decoded.end;
      values.push(decoded.value);
      continue;
    }
    const relativeOffset = safeOffset(decodeWord(bytes, headCursor));
    if (relativeOffset % EVM_WORD_BYTES !== 0 || relativeOffset !== tailCursor - start) {
      throw new Error('EVM ABI dynamic tails are not canonical and contiguous');
    }
    headCursor += EVM_WORD_BYTES;
    const decoded = decodeEvmValue(bytes, tailCursor, types[index], structs, enums, activeStructs, depth + 1);
    if (decoded.end <= tailCursor) throw new Error('EVM ABI dynamic value made no progress');
    tailCursor = decoded.end;
    values.push(decoded.value);
  }
  if (headCursor !== headEnd) throw new Error('EVM ABI tuple head was not fully consumed');
  return { values, end: tailCursor };
};

const decodeEvmValue = (
  bytes: Uint8Array,
  start: number,
  type: string,
  structs: readonly StructDefinitionInfo[] | undefined,
  enums: readonly EnumDefinitionAbi[] | undefined,
  activeStructs: ReadonlySet<string>,
  depth: number,
): DecodedEvmValue => {
  if (depth > EVM_DECODE_MAX_DEPTH) throw new Error('EVM ABI value exceeds the recursion limit');
  if (type === 'bool') {
    const value = decodeWord(bytes, start);
    if (value > 1n) throw new Error('EVM ABI bool is not canonical');
    return { value: value === 1n, end: start + EVM_WORD_BYTES };
  }
  if (type === 'int' || type === 'uint' || type === 'bigint' || type === 'fixed' || type === 'ufixed'
    || /^u?int\d+$/.test(type) || /^u?fixed\d+x\d+$/.test(type)) {
    return { value: decodeNumericWord(bytes, start, type), end: start + EVM_WORD_BYTES };
  }
  const enumeration = enums?.find((candidate) => candidate.name === type);
  if (enumeration) {
    const value = decodeWord(bytes, start);
    if (!enumeration.members.some((member) => BigInt(member.value) === value)) {
      throw new Error(`EVM ABI enum ${type} value is outside its declared members`);
    }
    return { value, end: start + EVM_WORD_BYTES };
  }
  if (type === 'address' || type === 'address payable') {
    const end = checkedAdd(start, EVM_WORD_BYTES, bytes.length);
    if (!bytes.slice(start, start + 12).every((byte) => byte === 0)) {
      throw new Error('EVM ABI address has non-zero high padding');
    }
    return { value: bytes.slice(start + 12, end), end };
  }
  const fixedBytes = /^bytes([1-9]|[12][0-9]|3[0-2])$/.exec(type);
  if (fixedBytes) {
    const end = checkedAdd(start, EVM_WORD_BYTES, bytes.length);
    const length = Number(fixedBytes[1]);
    if (!bytes.slice(start + length, end).every((byte) => byte === 0)) {
      throw new Error(`EVM ABI ${type} has non-zero right padding`);
    }
    return { value: bytes.slice(start, start + length), end };
  }
  if (type === 'bytes' || type === 'string') {
    const length = safeOffset(decodeWord(bytes, start));
    const payloadStart = checkedAdd(start, EVM_WORD_BYTES, bytes.length);
    const payloadEnd = checkedAdd(payloadStart, length, bytes.length);
    const paddedLength = Math.ceil(length / EVM_WORD_BYTES) * EVM_WORD_BYTES;
    const end = checkedAdd(payloadStart, paddedLength, bytes.length);
    if (!bytes.slice(payloadEnd, end).every((byte) => byte === 0)) {
      throw new Error(`EVM ABI ${type} has non-zero right padding`);
    }
    const payload = bytes.slice(payloadStart, payloadEnd);
    if (type === 'bytes') return { value: payload, end };
    const stringValue = new TextDecoder('utf-8', { fatal: true }).decode(payload);
    return { value: stringValue, end };
  }
  const array = parseArrayTypeString(type);
  if (array) {
    const dynamic = array.bound === undefined;
    const length = dynamic ? safeOffset(decodeWord(bytes, start)) : array.bound!;
    const tupleStart = dynamic ? checkedAdd(start, EVM_WORD_BYTES, bytes.length) : start;
    // Every ABI element occupies at least one word in its containing tuple. This bound prevents a forged length
    // from allocating an attacker-selected array before its head is known to fit the authenticated commitment.
    if (length > Math.floor((bytes.length - tupleStart) / EVM_WORD_BYTES)) {
      throw new Error('EVM ABI array length exceeds its encoded head');
    }
    const decoded = decodeEvmTuple(
      bytes, tupleStart, Array.from({ length }, () => array.elementType),
      structs, enums, activeStructs, depth + 1,
    );
    return { value: decoded.values, end: decoded.end };
  }
  const struct = structFor(type, structs);
  if (struct) {
    if (activeStructs.has(type)) throw new Error(`EVM ABI struct schema is recursive at ${type}`);
    const nested = new Set(activeStructs); nested.add(type);
    const decoded = decodeEvmTuple(
      bytes, start, struct.fields.map((field) => field.type), structs, enums, nested, depth + 1,
    );
    return {
      value: Object.fromEntries(struct.fields.map((field, index) => [field.name, decoded.values[index]])),
      end: decoded.end,
    };
  }
  throw new Error(`EVM ABI result type '${type}' has no supported canonical decoding`);
};

/** Decode one canonical Solidity ABI invocation result tuple at the start of a concatenated vector. */
export function decodeEvmInvocationResultPrefix(
  value: Uint8Array,
  types: readonly string[],
  structs?: readonly StructDefinitionInfo[],
  enums?: readonly EnumDefinitionAbi[],
): { values: StateValue[]; bytesConsumed: number } | undefined {
  if (types.length === 0) return undefined;
  try {
    const decoded = decodeEvmTuple(value, 0, types, structs, enums, new Set(), 0);
    return { values: decoded.values, bytesConsumed: decoded.end };
  } catch {
    return undefined;
  }
}

/** Decode one complete, canonical Solidity ABI invocation result tuple. */
export function decodeEvmInvocationResult(
  value: Uint8Array,
  types: readonly string[],
  structs?: readonly StructDefinitionInfo[],
  enums?: readonly EnumDefinitionAbi[],
): StateValue[] | undefined {
  const decoded = decodeEvmInvocationResultPrefix(value, types, structs, enums);
  return decoded?.bytesConsumed === value.length ? decoded.values : undefined;
}
