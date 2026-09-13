import { hash160, hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  getDefaultStateValue, parseArrayTypeString, type EnumDefinitionAbi, type StateValue,
  type StructDefinitionInfo,
} from '@solidcash/utils';
import { tryCashAddressToLockScript } from '../utils.js';

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
  if (bytes.length === 20) return bytes;
  // Match the compiler's explicit address-to-20 narrowing: preserve 20-byte hash payloads and HASH160 the
  // complete P2SH32 locking bytecode, whose 32-byte script hash cannot fit an EVM address.
  if (bytes.length === 25 && bytes[0] === 0x76 && bytes[1] === 0xa9 && bytes[2] === 0x14
    && bytes[23] === 0x88 && bytes[24] === 0xac) return bytes.slice(3, 23);
  if (bytes.length === 23 && bytes[0] === 0xa9 && bytes[1] === 0x14 && bytes[22] === 0x87) {
    return bytes.slice(2, 22);
  }
  if (bytes.length === 35 && bytes[0] === 0xaa && bytes[1] === 0x20 && bytes[34] === 0x87) return hash160(bytes);
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
