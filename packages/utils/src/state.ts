import { AbiFunction, Artifact, StateLayout, StateVariableInfo, StructDefinitionInfo } from './artifact.js';
import { bytecodeToAsm, Op, Script, scriptToBytecode } from './script.js';
import { encodeInt, encodeIntAsFixedBytes, decodeIntFixedWidth } from './data.js';
import {
  ArrayType, BytesType, FixedType, IntType, parseTypeStrict, PrimitiveType, fixedWidthBytes, isFixedWidthType,
} from './types.js';
import {
  bigIntToVmNumber, binToHex, binToUtf8, hexToBin, utf8ToBin, vmNumberToBigInt, isVmNumberError,
} from '@bitauth/libauth';
import { sha256 } from './hash.js';

/** A primitive pushdata value: integer, boolean, byte array, or string (UTF-8 encoded). */
export type PrimitiveStateValue = bigint | boolean | Uint8Array | string;

/** A state value that may be a primitive or a (possibly nested) struct record. */
export type StateValue = PrimitiveStateValue | StateRecord | StateValue[];

/** A record whose values are state values (supports recursive nesting for nested structs). */
export interface StateRecord { [key: string]: StateValue; }

/**
 * Build the data-NFT covenant script seeded with a specific token category.
 *
 * Dual-path covenant:
 * - Write path (flag=1): requires master minting NFT at masterInputIndex
 * - Read-only path (flag=0): no master needed, but commitment must be preserved
 *
 * Both paths verify self-preservation (bytecode) and category preservation.
 *
 * Unlocking script provides: `<masterInputIndex | 0> <flag>`
 *
 * @param categoryId - 32-byte token category ID
 */
export function buildDataNftCovenantScript(categoryId: Uint8Array): Script {
  // OP_UTXOTOKENCATEGORY pushes category bytes in internal (reversed) byte order.
  // The caller passes display-order bytes, so reverse them to match the VM.
  const catInternal = categoryId.slice().reverse();
  return [
    // Stack: <masterInputIndex | 0> <flag>
    // Check for flag=2 (destroy path) before consuming the flag
    Op.OP_DUP,
    Op.OP_2,
    Op.OP_NUMEQUAL,
    Op.OP_IF,
    // === Destroy path (flag=2): verify master only, no output preservation ===
    Op.OP_DROP, // drop original flag
    // Verify minting NFT at masterInputIndex
    Op.OP_UTXOTOKENCATEGORY,
    encodeInt(32n),
    Op.OP_SPLIT,
    Op.OP_2,
    Op.OP_EQUALVERIFY, // minting capability
    catInternal,
    Op.OP_EQUALVERIFY, // correct category
    // Verify this input has the expected category
    Op.OP_INPUTINDEX,
    Op.OP_UTXOTOKENCATEGORY,
    encodeInt(32n),
    Op.OP_SPLIT,
    Op.OP_1,
    Op.OP_EQUALVERIFY, // verify mutable capability (0x01)
    catInternal,
    Op.OP_EQUALVERIFY, // correct category
    // Verify output at this input's index does NOT preserve this category
    // (if the output exists at all - when INPUTINDEX >= TXOUTPUTCOUNT the
    //  data NFT has no corresponding output, which is the expected destroy case)
    Op.OP_INPUTINDEX,
    Op.OP_TXOUTPUTCOUNT,
    Op.OP_LESSTHAN,
    Op.OP_IF,
    // Output exists at INPUTINDEX - verify it doesn't preserve this category
    Op.OP_INPUTINDEX,
    Op.OP_OUTPUTTOKENCATEGORY,
    Op.OP_SIZE,
    Op.OP_IF,
    // Non-empty: extract 32-byte category and verify it differs
    encodeInt(32n),
    Op.OP_SPLIT,
    Op.OP_DROP,
    catInternal,
    Op.OP_EQUAL,
    Op.OP_NOT,
    Op.OP_VERIFY,
    Op.OP_ELSE,
    Op.OP_DROP, // drop empty value
    Op.OP_ENDIF,
    Op.OP_ENDIF,
    Op.OP_1, // script success
    Op.OP_ELSE,
    // === Original two-path logic (flag=0 or flag=1) ===
    Op.OP_IF,
    // === Write path (flag=1): verify minting NFT at masterInputIndex ===
    // Part 1: verify minting NFT of expected category at masterInputIndex
    Op.OP_UTXOTOKENCATEGORY,
    encodeInt(32n),
    Op.OP_SPLIT,
    Op.OP_2,
    Op.OP_EQUALVERIFY,
    // Push expected category once; OP_TUCK keeps a copy for Part 2
    catInternal,
    Op.OP_TUCK,
    Op.OP_EQUALVERIFY,
    // Part 2: verify this input has the expected category
    Op.OP_INPUTINDEX,
    Op.OP_UTXOTOKENCATEGORY,
    encodeInt(32n),
    Op.OP_SPLIT,
    Op.OP_DROP,
    Op.OP_EQUALVERIFY,
    Op.OP_ELSE,
    // === Read-only path (flag=0): no master needed ===
    Op.OP_DROP, // discard unused placeholder
    // Self-pin (Stage 2): require this input's live category == C with mutable capability, so a fabricated
    // foreign-category UTXO at this address is unspendable - address-based external reads sound w/o the master.
    Op.OP_INPUTINDEX,
    Op.OP_UTXOTOKENCATEGORY,
    encodeInt(32n),
    Op.OP_SPLIT,
    Op.OP_1,
    Op.OP_EQUALVERIFY, // mutable capability (0x01)
    catInternal,
    Op.OP_EQUALVERIFY, // correct category
    // Commitment preservation: input commitment == output commitment
    Op.OP_INPUTINDEX,
    Op.OP_UTXOTOKENCOMMITMENT,
    Op.OP_INPUTINDEX,
    Op.OP_OUTPUTTOKENCOMMITMENT,
    Op.OP_EQUALVERIFY,
    Op.OP_ENDIF,
    // === Common: self-preservation + category preservation (flag=0 and flag=1 only) ===
    // Self-preservation (bytecode)
    Op.OP_INPUTINDEX,
    Op.OP_UTXOBYTECODE,
    Op.OP_INPUTINDEX,
    Op.OP_OUTPUTBYTECODE,
    Op.OP_EQUALVERIFY,
    // Token category preservation
    Op.OP_INPUTINDEX,
    Op.OP_UTXOTOKENCATEGORY,
    Op.OP_INPUTINDEX,
    Op.OP_OUTPUTTOKENCATEGORY,
    Op.OP_EQUALVERIFY,
    // FT amount preservation: output >= input (prevents FT drain via read-only path)
    Op.OP_INPUTINDEX,
    Op.OP_OUTPUTTOKENAMOUNT,
    Op.OP_INPUTINDEX,
    Op.OP_UTXOTOKENAMOUNT,
    Op.OP_GREATERTHANOREQUAL,
    Op.OP_VERIFY,
    // Exact satoshi preservation: input sats == output sats
    Op.OP_INPUTINDEX,
    Op.OP_UTXOVALUE,
    Op.OP_INPUTINDEX,
    Op.OP_OUTPUTVALUE,
    Op.OP_EQUAL,
    Op.OP_ENDIF,
  ];
}

/**
 * Build the hex-encoded bytecode for the data-NFT covenant seeded with a category.
 *
 * @param categoryIdHex - Hex-encoded 32-byte token category ID
 */
export function buildDataNftCovenantBytecode(categoryIdHex: string): string {
  return binToHex(scriptToBytecode(buildDataNftCovenantScript(hexToBin(categoryIdHex))));
}

/** Maximum byte length for vmNumberToBigInt (defense against oversized values).
 *  Set to 150 to accommodate unbounded int state variables within the default
 *  128-byte commitment limit (a sign-magnitude number can be up to commitmentLimit bytes). */
const VM_NUMBER_MAX_BYTE_LENGTH = 150;

/** Check if a type string represents an int-like type (int, int8, uint256, fixed128x18, etc.) */
function isIntLikeType(type: string): boolean {
  return type === 'bigint' || /^u?int\d+$/.test(type) || /^u?fixed\d+x\d+$/.test(type);
}

/** Parse a bounded int/fixed type string and return its min/max range, or undefined for unbounded 'bigint'. */
function parseBoundedIntRange(type: string): { min: bigint; max: bigint } | undefined {
  // Match int8, uint16, int128, uint256, etc.
  const intMatch = type.match(/^(u?)(int)(\d+)$/);
  if (intMatch) {
    const signed = intMatch[1] !== 'u';
    const bits = parseInt(intMatch[3], 10);
    const min = signed ? -(1n << BigInt(bits - 1)) : 0n;
    const max = signed ? (1n << BigInt(bits - 1)) - 1n : (1n << BigInt(bits)) - 1n;
    return { min, max };
  }
  // Match fixed128x18, ufixed64x8, etc.
  const fixedMatch = type.match(/^(u?)(fixed)(\d+)x(\d+)$/);
  if (fixedMatch) {
    const signed = fixedMatch[1] !== 'u';
    const bits = parseInt(fixedMatch[3], 10);
    const min = signed ? -(1n << BigInt(bits - 1)) : 0n;
    const max = signed ? (1n << BigInt(bits - 1)) - 1n : (1n << BigInt(bits)) - 1n;
    return { min, max };
  }
  return undefined;
}

/** Parse an array type string like "int[3]" (bounded) or "int[]" (unbounded) into element type and optional bound. */
export function parseArrayTypeString(type: string): { elementType: string; bound: number | undefined } | undefined {
  // Bounded: "int[3]", "bytes20[5]"
  const bounded = type.match(/^(.+)\[(\d+)\]$/);
  if (bounded) return { elementType: bounded[1], bound: parseInt(bounded[2], 10) };
  // Unbounded: "int[]", "bytes[]"
  const unbounded = type.match(/^(.+)\[\]$/);
  if (unbounded) return { elementType: unbounded[1], bound: undefined };
  return undefined;
}

/**
 * Return a sensible zero/empty default for a state variable type.
 */
export function getDefaultStateValue(
  type: string,
  structs?: readonly StructDefinitionInfo[],
  _visited?: Set<string>,
): StateValue {
  if (structs) {
    const structDef = structs.find((s) => s.name === type);
    if (structDef) {
      const visited = new Set<string>(_visited ?? []);
      if (visited.has(type)) throw new Error(`Circular struct definition detected: ${type}`);
      visited.add(type);
      const record: StateRecord = {};
      for (const field of structDef.fields) {
        record[field.name] = getDefaultStateValue(field.type, structs, visited);
      }
      return record;
    }
  }
  const arrInfo = parseArrayTypeString(type);
  if (arrInfo) {
    if (arrInfo.bound === undefined) return []; // Unbounded: empty array
    const arr: StateValue[] = [];
    for (let i = 0; i < arrInfo.bound; i++) {
      arr.push(getDefaultStateValue(arrInfo.elementType, structs));
    }
    return arr;
  }
  if (isIntLikeType(type)) return 0n;
  if (type === 'bool') return false;
  const match = type.match(/^bytes(\d+)$/);
  if (match) return new Uint8Array(parseInt(match[1], 10));
  if (type === 'pubkey') return new Uint8Array(33);
  return new Uint8Array(0);
}

/**
 * Get the worst-case pushdata-encoded size for a type (string form).
 * Used for bin-packing state variables into NFT commitments.
 */
export function getMaxPushdataEncodedSize(
  type: string,
  structs?: readonly StructDefinitionInfo[],
  _visited?: Set<string>,
): number {
  if (structs) {
    const structDef = structs.find((s) => s.name === type);
    if (structDef) {
      const visited = new Set<string>(_visited ?? []);
      if (visited.has(type)) throw new Error(`Circular struct definition detected: ${type}`);
      visited.add(type);
      return structDef.fields.reduce((sum, f) => sum + getMaxPushdataEncodedSize(f.type, structs, visited), 0);
    }
  }
  const arrInfo = parseArrayTypeString(type);
  if (arrInfo) {
    const lengthSize = getMaxPushdataEncodedSize('bigint', structs);
    if (arrInfo.bound === undefined) return lengthSize; // Unbounded: just length prefix (minimum)
    const elemSize = getMaxPushdataEncodedSize(arrInfo.elementType, structs);
    return lengthSize + arrInfo.bound * elemSize;
  }
  if (type === 'bool') return 1; // 0x00 or 0x51
  // Since May 2025, BCH VM supports arbitrarily large integers (up to 10,000-byte stack elements).
  // Using 258 (1 OP_PUSHDATA1 prefix + 1 length byte + 256 data bytes) handles numbers up to 2^2048
  // while staying within practical NFT commitment size limits.
  if (type === 'bigint') return 258;
  if (type === 'pubkey') return 34; // 1 byte length prefix (0x21) + 33 bytes
  if (type === 'sig') return 74; // 1 byte length prefix + up to 73 bytes
  if (type === 'datasig') return 66; // 1 byte length prefix + up to 65 bytes

  // Bounded int types (int8, uint256, etc.): 1 byte length prefix + ceil((bits+1)/8) data bytes
  const intMatch = type.match(/^u?int(\d+)$/);
  if (intMatch) {
    const bits = parseInt(intMatch[1], 10);
    const dataBytes = Math.ceil((bits + 1) / 8); // +1 for sign bit
    if (dataBytes <= 75) return dataBytes + 1;
    if (dataBytes <= 255) return dataBytes + 2;
    return dataBytes + 3;
  }

  // Fixed-point types (fixed128x18, ufixed64x8): same encoding as int of same bit width
  const fixedMatch = type.match(/^u?fixed(\d+)x\d+$/);
  if (fixedMatch) {
    const bits = parseInt(fixedMatch[1], 10);
    const dataBytes = Math.ceil((bits + 1) / 8);
    if (dataBytes <= 75) return dataBytes + 1;
    if (dataBytes <= 255) return dataBytes + 2;
    return dataBytes + 3;
  }

  const match = type.match(/^bytes(\d+)$/);
  if (match) {
    const n = parseInt(match[1], 10);
    if (n === 0) return 1; // OP_0
    if (n === 1) return 2; // bytes1 uses generic encoder: worst case 0x01 <byte>
    if (n <= 75) return n + 1; // 1 byte length prefix + N bytes
    if (n <= 255) return n + 2; // OP_PUSHDATA1 + 1-byte length + N bytes
    return n + 3; // OP_PUSHDATA2 + 2-byte length + N bytes
  }

  // bytes (unbounded) - worst case unknown, use a reasonable max
  if (type === 'bytes') return 9; // conservative: OP_0 for empty, or standard pushdata

  return 9; // conservative default
}

/**
 * Encode a value to pushdata format.
 * Must produce byte-identical output to the compiler's emitPushdataEncode.
 */
export function encodePushdataValue(
  value: StateValue,
  type: string,
  structs?: readonly StructDefinitionInfo[],
  _visited?: Set<string>,
): Uint8Array {
  if (structs) {
    const structDef = structs.find((s) => s.name === type);
    if (structDef) {
      const visited = new Set<string>(_visited);
      if (visited.has(type)) throw new Error(`Circular struct definition detected: ${type}`);
      visited.add(type);
      const record = value as StateRecord;
      const parts: Uint8Array[] = [];
      for (const field of structDef.fields) {
        const fieldValue = record[field.name]
          ?? getDefaultStateValue(field.type, structs);
        parts.push(encodePushdataValue(fieldValue, field.type, structs, visited));
      }
      const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
      const result = new Uint8Array(totalLen);
      let offset = 0;
      for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
      }
      return result;
    }
  }
  const arrInfo = parseArrayTypeString(type);
  if (arrInfo) {
    const arr = value as StateValue[];
    const parts: Uint8Array[] = [];
    // Length prefix (encoded as int)
    parts.push(encodePushdataValue(BigInt(arr.length), 'bigint'));
    // Elements. Fixed-width elements are PACKED at their stride (the compiler's emitEncodeElementPacked /
    // the array literal + element access model; decodePushdataValue reads them back the same way) -
    // per-element pushdata encoding here diverged from the covenant's in-script struct encode and failed
    // the output-commitment EQUALVERIFY on whole-struct writes.
    if (isFixedWidthType(arrInfo.elementType)) {
      parts.push(packFixedWidthArray(arr as PrimitiveStateValue[], arrInfo.elementType));
    } else {
      for (const elem of arr) {
        parts.push(encodePushdataValue(elem, arrInfo.elementType, structs));
      }
    }
    const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
    const result = new Uint8Array(totalLen);
    let off = 0;
    for (const part of parts) { result.set(part, off); off += part.length; }
    return result;
  }

  if (type === 'bool') {
    // bool: 0x00 (false) or 0x51 (true)
    const boolVal = typeof value === 'boolean' ? value : Boolean(value);
    return new Uint8Array([boolVal ? 0x51 : 0x00]);
  }

  if (type === 'pubkey') {
    // pubkey is 33 bytes: <0x21> <33 bytes>
    const bytes = value as Uint8Array;
    if (bytes.length !== 33) {
      throw new Error(`encodePushdataValue: pubkey must be exactly 33 bytes, got ${bytes.length}`);
    }
    const result = new Uint8Array(34);
    result[0] = 33;
    result.set(bytes, 1);
    return result;
  }

  // Check for fixed-size bytes (2-75) - uses simple length prefix
  const bytesMatch = type.match(/^bytes(\d+)$/);
  if (bytesMatch) {
    const n = parseInt(bytesMatch[1], 10);
    if (n >= 2 && n <= 75) {
      const bytes = value as Uint8Array;
      if (bytes.length !== n) {
        throw new Error(`encodePushdataValue: bytes${n} must be exactly ${n} bytes, got ${bytes.length}`);
      }
      const result = new Uint8Array(n + 1);
      result[0] = n;
      result.set(bytes, 1);
      return result;
    }
  }

  // Generic pushdata encode for int, int-like types, bytes1, bytes0, unbounded bytes, sig, datasig
  // At this point, struct types have already been handled and returned above
  const primitiveValue = value as PrimitiveStateValue;
  if (isIntLikeType(type)) {
    // M-9: Validate value is bigint for int-like types
    if (typeof primitiveValue !== 'bigint') {
      throw new Error(
        `encodePushdataValue: expected bigint for type '${type}', got ${typeof primitiveValue}`,
      );
    }
    // M-10: Range validation for bounded int/fixed types (not unbounded 'bigint')
    if (type !== 'bigint') {
      const bounds = parseBoundedIntRange(type);
      if (bounds && (primitiveValue < bounds.min || primitiveValue > bounds.max)) {
        throw new Error(
          `encodePushdataValue: value ${primitiveValue} out of range for type '${type}' `
          + `(${bounds.min} to ${bounds.max})`,
        );
      }
    }
    const scriptBytes = valueToScriptBytes(primitiveValue, type);
    return encodeGenericPushdataValue(scriptBytes, true);
  }

  // bytes1 uses int-like encoding (OP_1-OP_16, OP_1NEGATE shortcuts) to match compiler
  let bytes: Uint8Array;
  if (primitiveValue instanceof Uint8Array) {
    if (type === 'bytes1' && primitiveValue.length !== 1) {
      throw new Error(`encodePushdataValue: bytes1 must be exactly 1 byte, got ${primitiveValue.length}`);
    }
    bytes = primitiveValue;
  } else {
    bytes = valueToScriptBytes(primitiveValue, type);
  }
  const isIntLikeEnc = type === 'bytes1';
  return encodeGenericPushdataValue(bytes, isIntLikeEnc);
}

/**
 * Convert a typed value to its script bytes representation.
 */
function valueToScriptBytes(value: bigint | boolean | Uint8Array | string, type: string): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') return utf8ToBin(value);
  if ((isIntLikeType(type) || type === 'bytes1') && typeof value === 'bigint') {
    return bigIntToVmNumber(value);
  }
  if (type === 'bool') {
    return value ? new Uint8Array([0x01]) : new Uint8Array(0);
  }
  throw new Error(`Cannot convert value to bytes for type ${type}`);
}

/**
 * Generic pushdata encoder matching the compiler's emitGenericPushdataEncode.
 * For int/bytes1: checks OP_0, OP_1-OP_16, OP_1NEGATE, then standard pushdata.
 * For other types: checks empty (OP_0), then standard pushdata.
 */
function encodeGenericPushdataValue(data: Uint8Array, isIntLike: boolean): Uint8Array {
  // Empty/zero -> OP_0
  if (data.length === 0) {
    return new Uint8Array([0x00]);
  }

  if (isIntLike) {
    // 1-byte value: check for OP_1NEGATE and OP_1-OP_16
    if (data.length === 1) {
      const byte = data[0];

      // Check for 0x81 (-1 in script number) -> OP_1NEGATE (0x4f)
      if (byte === 0x81) {
        return new Uint8Array([0x4f]);
      }

      // Check for 1-16 -> OP_1-OP_16 (0x51-0x60)
      // We need to interpret the byte as a script number first
      const numResult = vmNumberToBigInt(data, { maximumVmNumberByteLength: VM_NUMBER_MAX_BYTE_LENGTH });
      if (!isVmNumberError(numResult)) {
        const num = numResult;
        if (num >= 1n && num <= 16n) {
          return new Uint8Array([0x50 + Number(num)]);
        }
      }

      // Standard 1-byte pushdata: 0x01 <byte>
      return new Uint8Array([0x01, byte]);
    }

    // Multi-byte: standard pushdata framing
    return standardPushdataFrame(data);
  }

  // Non-int types: just standard pushdata framing (no special opcodes for small values)
  return standardPushdataFrame(data);
}

/**
 * Standard pushdata frame: <len> <data>, OP_PUSHDATA1 <len> <data>, or OP_PUSHDATA2 <len_LE> <data>
 */
function standardPushdataFrame(data: Uint8Array): Uint8Array {
  const len = data.length;

  if (len <= 75) {
    // <size_byte> <data>
    const result = new Uint8Array(1 + len);
    result[0] = len;
    result.set(data, 1);
    return result;
  }

  if (len <= 255) {
    // OP_PUSHDATA1 (0x4c) <1-byte len> <data>
    const result = new Uint8Array(2 + len);
    result[0] = 0x4c;
    result[1] = len;
    result.set(data, 2);
    return result;
  }

  if (len > 65535) {
    throw new Error(`Data length ${len} exceeds maximum for PUSHDATA2 encoding (65535 bytes)`);
  }

  // OP_PUSHDATA2 (0x4d) <2-byte len LE> <data>
  const result = new Uint8Array(3 + len);
  result[0] = 0x4d;
  result[1] = len & 0xff;
  result[2] = (len >> 8) & 0xff;
  result.set(data, 3);
  return result;
}

/**
 * Decode a pushdata-encoded value from a buffer at a given offset.
 * Returns the decoded value and number of bytes consumed.
 */
export function decodePushdataValue(
  data: Uint8Array,
  offset: number,
  type: string,
  structs?: readonly StructDefinitionInfo[],
  _visited?: Set<string>,
): { value: StateValue; bytesConsumed: number } {
  if (offset < 0 || offset >= data.length) {
    throw new Error(`decodePushdataValue: offset ${offset} out of bounds (buffer length ${data.length})`);
  }

  if (structs) {
    const structDef = structs.find((s) => s.name === type);
    if (structDef) {
      const visited = new Set<string>(_visited ?? []);
      if (visited.has(type)) throw new Error(`Circular struct definition detected: ${type}`);
      visited.add(type);
      const record: StateRecord = {};
      let totalConsumed = 0;
      for (const field of structDef.fields) {
        const { value, bytesConsumed } = decodePushdataValue(data, offset + totalConsumed, field.type, structs, visited);
        record[field.name] = value;
        totalConsumed += bytesConsumed;
      }
      return { value: record, bytesConsumed: totalConsumed };
    }
  }
  const arrInfo = parseArrayTypeString(type);
  if (arrInfo) {
    let totalConsumed = 0;
    // Decode length prefix (encoded as int)
    const { value: lenVal, bytesConsumed: lenBytes } = decodePushdataValue(data, offset, 'bigint');
    totalConsumed += lenBytes;
    const len = Number(lenVal as bigint);
    if (len < 0 || len > 10000) {
      throw new Error(`Array length ${len} exceeds safe decoding limit (max 10000)`);
    }
    // Decode elements. Fixed-width elements (uint256, bytesN, ...) are PACKED - fixedWidthBytes each, no per-
    // element pushdata length prefix (packFixedWidthArray) - so read them by width. Variable-width elements
    // (bigint, string, bytes, structs) are pushdata-encoded.
    const arr: StateValue[] = [];
    const packed = isFixedWidthType(arrInfo.elementType);
    const elemWidth = packed ? fixedWidthBytes(parseTypeStrict(arrInfo.elementType)) : 0;
    for (let i = 0; i < len; i++) {
      if (packed) {
        const elemBytes = data.slice(offset + totalConsumed, offset + totalConsumed + elemWidth);
        arr.push(unpackFixedWidthElement(elemBytes, arrInfo.elementType));
        totalConsumed += elemWidth;
      } else {
        const { value: elem, bytesConsumed } = decodePushdataValue(
          data, offset + totalConsumed, arrInfo.elementType, structs,
        );
        arr.push(elem);
        totalConsumed += bytesConsumed;
      }
    }
    return { value: arr, bytesConsumed: totalConsumed };
  }

  if (type === 'bool') {
    const boolByte = data[offset];
    if (boolByte !== 0x00 && boolByte !== 0x51) {
      throw new Error(
        `Invalid boolean encoding at offset ${offset}: expected 0x00 or 0x51, got 0x${boolByte.toString(16).padStart(2, '0')}`,
      );
    }
    return { value: boolByte === 0x51, bytesConsumed: 1 };
  }

  if (type === 'pubkey') {
    // 1-byte length prefix (must be 33) + 33 bytes data
    if (offset + 1 > data.length) {
      throw new Error('decodePushdataValue: unexpected end of data reading pubkey length prefix');
    }
    const len = data[offset];
    if (len !== 33) {
      throw new Error(
        `decodePushdataValue: pubkey must have length 33, got ${len} at offset ${offset}`,
      );
    }
    if (offset + 1 + len > data.length) {
      throw new Error(`decodePushdataValue: unexpected end of data reading pubkey (need ${1 + len} bytes at offset ${offset})`);
    }
    const value = data.slice(offset + 1, offset + 1 + len);
    return { value, bytesConsumed: 1 + len };
  }

  // Fixed-size bytes (1-75)
  const bytesMatch = type.match(/^bytes(\d+)$/);
  if (bytesMatch) {
    const n = parseInt(bytesMatch[1], 10);
    if (n === 1) {
      // bytes1 uses int-like encoding (OP_0, OP_1-OP_16, OP_1NEGATE shortcuts) to match compiler.
      // Decode opcode shortcuts directly to raw byte to avoid int normalization
      // (e.g., 0x80 is "negative zero" in script numbers but a valid byte value).
      const firstByte = data[offset];
      if (firstByte === 0x00) {
        // OP_0 -> zero byte
        return { value: new Uint8Array([0x00]), bytesConsumed: 1 };
      }
      if (firstByte === 0x4f) {
        // OP_1NEGATE -> byte 0x81 (script number -1 = sign-magnitude 0x81)
        return { value: new Uint8Array([0x81]), bytesConsumed: 1 };
      }
      if (firstByte >= 0x51 && firstByte <= 0x60) {
        // OP_1-OP_16 -> byte 0x01-0x10
        return { value: new Uint8Array([firstByte - 0x50]), bytesConsumed: 1 };
      }
      // Standard pushdata: 0x01 <byte>
      if (firstByte === 0x01 && offset + 2 <= data.length) {
        return { value: new Uint8Array([data[offset + 1]]), bytesConsumed: 2 };
      }
      throw new Error(`decodePushdataValue: invalid bytes1 encoding at offset ${offset}`);
    }
    if (n >= 2 && n <= 75) {
      if (offset + 1 > data.length) {
        throw new Error(
          `decodePushdataValue: unexpected end of data reading bytes${n} length prefix at offset ${offset}`,
        );
      }
      const prefixLen = data[offset];
      if (prefixLen !== n) {
        throw new Error(
          `decodePushdataValue: bytes${n} length prefix mismatch: expected ${n}, got ${prefixLen} at offset ${offset}`,
        );
      }
      if (offset + 1 + n > data.length) {
        throw new Error(
          `decodePushdataValue: unexpected end of data reading bytes${n} (need ${1 + n} bytes at offset ${offset})`,
        );
      }
      const value = data.slice(offset + 1, offset + 1 + n);
      return { value, bytesConsumed: 1 + n };
    }
  }

  // Generic pushdata decode
  const genericResult = decodeGenericPushdata(data, offset, type);

  // Convert Uint8Array back to string for string-typed state variables (symmetric with encode)
  if (type === 'string' && genericResult.value instanceof Uint8Array) {
    return { value: binToUtf8(genericResult.value), bytesConsumed: genericResult.bytesConsumed };
  }

  // Validate decoded value is within range for bounded int/uint/fixed types (symmetric with encode)
  if (typeof genericResult.value === 'bigint') {
    const bounds = parseBoundedIntRange(type);
    if (bounds && (genericResult.value < bounds.min || genericResult.value > bounds.max)) {
      throw new Error(
        `decodePushdataValue: decoded value ${genericResult.value} out of range for type '${type}' `
        + `(${bounds.min} to ${bounds.max})`,
      );
    }
  }

  // Validate decoded byte length matches declared type for bytesN (N > 75)
  if (genericResult.value instanceof Uint8Array && bytesMatch) {
    const n = parseInt(bytesMatch[1], 10);
    if (n > 75 && genericResult.value.length !== n) {
      throw new Error(
        `decodePushdataValue: bytes${n} decoded length mismatch: expected ${n}, got ${genericResult.value.length}`,
      );
    }
  }

  return genericResult;
}

/**
 * Generic pushdata decoder matching the compiler's emitGenericPushdataDecode.
 */
function decodeGenericPushdata(
  data: Uint8Array,
  offset: number,
  type: string,
): { value: bigint | boolean | Uint8Array; bytesConsumed: number } {
  if (offset < 0 || offset >= data.length) {
    throw new Error(`decodeGenericPushdata: offset ${offset} out of bounds (buffer length ${data.length})`);
  }

  const firstByte = data[offset];

  const intLike = isIntLikeType(type);

  // OP_0 (0x00)
  if (firstByte === 0x00) {
    if (intLike) {
      return { value: 0n, bytesConsumed: 1 };
    }
    return { value: new Uint8Array(0), bytesConsumed: 1 };
  }

  // OP_1NEGATE (0x4f)
  if (firstByte === 0x4f) {
    if (intLike) {
      return { value: -1n, bytesConsumed: 1 };
    }
    return { value: new Uint8Array([0x81]), bytesConsumed: 1 };
  }

  // OP_1 - OP_16 (0x51 - 0x60)
  if (firstByte >= 0x51 && firstByte <= 0x60) {
    const num = firstByte - 0x50;
    if (intLike) {
      return { value: BigInt(num), bytesConsumed: 1 };
    }
    // For bytes types, return as 1-byte value
    return { value: new Uint8Array([num]), bytesConsumed: 1 };
  }

  // OP_PUSHDATA1 (0x4c)
  if (firstByte === 0x4c) {
    if (offset + 2 > data.length) {
      throw new Error('decodeGenericPushdata: unexpected end of data reading OP_PUSHDATA1 length');
    }
    const len = data[offset + 1];
    if (offset + 2 + len > data.length) {
      throw new Error(
        `decodeGenericPushdata: unexpected end of data for OP_PUSHDATA1 (need ${2 + len} bytes at offset ${offset})`,
      );
    }
    const value = data.slice(offset + 2, offset + 2 + len);
    if (intLike) {
      const numResult = vmNumberToBigInt(value, { maximumVmNumberByteLength: VM_NUMBER_MAX_BYTE_LENGTH });
      if (isVmNumberError(numResult)) throw new Error(`Invalid VM number: ${numResult}`);
      return { value: numResult, bytesConsumed: 2 + len };
    }
    return { value, bytesConsumed: 2 + len };
  }

  // OP_PUSHDATA2 (0x4d)
  if (firstByte === 0x4d) {
    if (offset + 3 > data.length) {
      throw new Error('decodeGenericPushdata: unexpected end of data reading OP_PUSHDATA2 length');
    }
    const len = data[offset + 1] | (data[offset + 2] << 8);
    if (offset + 3 + len > data.length) {
      throw new Error(
        `decodeGenericPushdata: unexpected end of data for OP_PUSHDATA2 (need ${3 + len} bytes at offset ${offset})`,
      );
    }
    const value = data.slice(offset + 3, offset + 3 + len);
    if (intLike) {
      const numResult = vmNumberToBigInt(value, { maximumVmNumberByteLength: VM_NUMBER_MAX_BYTE_LENGTH });
      if (isVmNumberError(numResult)) throw new Error(`Invalid VM number: ${numResult}`);
      return { value: numResult, bytesConsumed: 3 + len };
    }
    return { value, bytesConsumed: 3 + len };
  }

  // Standard pushdata: first byte is the length (1-75)
  const len = firstByte;
  if (len > 75) {
    throw new Error(
      `decodeGenericPushdata: non-canonical pushdata byte 0x${len.toString(16)} at offset ${offset} (expected 1-75, OP_PUSHDATA1 0x4c, or OP_PUSHDATA2 0x4d)`,
    );
  }
  if (offset + 1 + len > data.length) {
    throw new Error(
      `decodeGenericPushdata: unexpected end of data for pushdata (need ${1 + len} bytes at offset ${offset})`,
    );
  }
  const value = data.slice(offset + 1, offset + 1 + len);
  if (intLike) {
    const numResult = vmNumberToBigInt(value, { maximumVmNumberByteLength: VM_NUMBER_MAX_BYTE_LENGTH });
    if (isVmNumberError(numResult)) throw new Error(`Invalid VM number: ${numResult}`);
    return { value: numResult, bytesConsumed: 1 + len };
  }
  return { value, bytesConsumed: 1 + len };
}

/**
 * A layout spans multiple data NFTs when its fixed-size state occupies more than one NFT. Such layouts
 * prepend a verifiable nftIndex tag to every data-NFT commitment so a higher-index NFT cannot be
 * substituted for a lower one (they share one covenant address). Single-NFT layouts carry no tag.
 */
export function isMultiDataNftLayout(layout: StateLayout): boolean {
  return layout.dataNftCount > 1;
}

/**
 * The nftIndex tag prepended to a multi-data-NFT commitment: the index encoded as a pushdata int
 * (1 byte for indices 0-16). Identical to how the compiler stamps and verifies it on-chain.
 */
export function encodeNftIndexTag(nftIndex: number): Uint8Array {
  return encodePushdataValue(BigInt(nftIndex), 'bigint');
}

/**
 * Build a pushdata commitment hex string for a single NFT.
 */
export function buildPushdataCommitment(
  layout: StateLayout,
  values: Record<string, StateValue>,
  nftIndex: number,
): string {
  const fieldsForNft = layout.variables
    .filter((v: StateVariableInfo) => v.nftIndex === nftIndex)
    .sort((a, b) => a.fieldIndex - b.fieldIndex);

  const parts: Uint8Array[] = [];
  if (isMultiDataNftLayout(layout)) {
    parts.push(encodeNftIndexTag(nftIndex));
  }
  for (const field of fieldsForNft) {
    if (field.dynamic) {
      // Dynamic var: the data-NFT field is a uint32 length header (A$len); the value lives in chunks.
      // Use an explicit <name>$len (set during auto-derivation) if present, else compute it from the value.
      const lenKey = dynamicLenKey(field.name);
      const len = values[lenKey] !== undefined
        ? Number(values[lenKey] as bigint)
        : dynamicValueByteLength(values[field.name] ?? getDefaultStateValue(field.type, layout.structs), field.type);
      parts.push(encodePushdataValue(BigInt(len), DYNAMIC_LEN_TYPE));
      continue;
    }
    const value = values[field.name] ?? getDefaultStateValue(field.type, layout.structs);
    parts.push(encodePushdataValue(value, field.type, layout.structs));
  }

  // Concatenate all parts
  const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  // Validate commitment size against layout limit
  if (layout.commitmentLimit !== undefined && result.length > layout.commitmentLimit) {
    throw new Error(
      `Commitment for NFT index ${nftIndex} exceeds limit: ${result.length} bytes > ${layout.commitmentLimit} byte limit`,
    );
  }

  return binToHex(result);
}

/**
 * Parse a pushdata commitment hex string for a single NFT.
 */
export function parsePushdataCommitment(
  hex: string,
  layout: StateLayout,
  nftIndex: number,
): Record<string, StateValue> {
  const bytes = hexToBin(hex);
  const fieldsForNft = layout.variables
    .filter((v: StateVariableInfo) => v.nftIndex === nftIndex)
    .sort((a, b) => a.fieldIndex - b.fieldIndex);

  const result: Record<string, StateValue> = {};
  let offset = 0;

  // Multi-data-NFT commitments carry a leading nftIndex tag - verify and skip it before the fields.
  if (isMultiDataNftLayout(layout)) {
    const { value: tag, bytesConsumed } = decodePushdataValue(bytes, offset, 'bigint');
    if (Number(tag) !== nftIndex) {
      throw new Error(`parsePushdataCommitment: nftIndex tag mismatch for NFT index ${nftIndex}: got ${tag}`);
    }
    offset += bytesConsumed;
  }

  for (const field of fieldsForNft) {
    if (field.dynamic) {
      // Dynamic var: decode the uint32 length header into <name>$len; the value is assembled from
      // chunks by the StateReader. parsePushdataCommitment alone cannot reconstruct it.
      const { value, bytesConsumed } = decodePushdataValue(bytes, offset, DYNAMIC_LEN_TYPE);
      result[dynamicLenKey(field.name)] = value;
      offset += bytesConsumed;
      continue;
    }
    const { value, bytesConsumed } = decodePushdataValue(bytes, offset, field.type, layout.structs);
    result[field.name] = value;
    offset += bytesConsumed;
  }

  if (offset < bytes.length) {
    throw new Error(
      `parsePushdataCommitment: ${bytes.length - offset} trailing byte(s) after parsing all fields for NFT index ${nftIndex}`,
    );
  }

  return result;
}

// hexToUint8Array removed - use hexToBin from @bitauth/libauth instead

/**
 * Build the initial state for a stateful contract deployment.
 */
export function buildInitialStateCommitments(
  layout: StateLayout,
  initialState: Record<string, StateValue>,
): string[] {
  const commitments: string[] = [];

  for (let nftIdx = 0; nftIdx < layout.dataNftCount; nftIdx++) {
    commitments.push(buildPushdataCommitment(layout, initialState, nftIdx));
  }

  return commitments;
}

/**
 * Build an entry NFT commitment hex string from a key and value.
 * The commitment is: encodePushdata(key) ++ encodePushdata(value)
 */
export function buildEntryCommitment(
  keyValue: bigint | boolean | Uint8Array,
  keyType: string,
  valueValue: StateValue,
  valueType: string,
  structs?: readonly StructDefinitionInfo[],
  commitmentLimit?: number,
): string {
  const keyEncoded = encodePushdataValue(keyValue, keyType);
  const valueEncoded = encodePushdataValue(valueValue, valueType, structs);

  const result = new Uint8Array(keyEncoded.length + valueEncoded.length);
  result.set(keyEncoded, 0);
  result.set(valueEncoded, keyEncoded.length);

  if (commitmentLimit !== undefined && result.length > commitmentLimit) {
    throw new Error(
      `Entry commitment exceeds limit: ${result.length} bytes > ${commitmentLimit} byte limit`,
    );
  }

  return binToHex(result);
}

/**
 * Parse an entry NFT commitment hex string into key and value.
 */
export function parseEntryCommitment(
  hex: string,
  keyType: string,
  valueType: string,
  structs?: readonly StructDefinitionInfo[],
): {
    key: bigint | boolean | Uint8Array;
    value: StateValue;
  } {
  const bytes = hexToBin(hex);

  // Keys are never struct types, so narrow the type
  const { value: key, bytesConsumed: keyConsumed } = decodePushdataValue(bytes, 0, keyType) as
    { value: bigint | boolean | Uint8Array; bytesConsumed: number };
  const { value, bytesConsumed: valueConsumed } = decodePushdataValue(bytes, keyConsumed, valueType, structs);

  const totalConsumed = keyConsumed + valueConsumed;
  if (totalConsumed < bytes.length) {
    throw new Error(
      `parseEntryCommitment: ${bytes.length - totalConsumed} trailing byte(s) after parsing key+value`,
    );
  }

  return { key, value };
}

// ---------- Dynamic storage chunks (chunked string/bytes) ----------
//
// A dynamic var's data is split into fixed-size chunks, each in a chunk UTXO that is structurally an entry
// NFT: commitment = encodePushdata(chunkIndex) ++ encodePushdata(chunkData). chunkData is bounded to fit the
// 128-byte budget: index (<=5 bytes) + bytes framing (<=2 via OP_PUSHDATA1) + data <= 128.

/** Max chunk data bytes. 120 + 5 (index) + 2 (framing) <= 128-byte commitment budget. */
export const DYNAMIC_CHUNK_SIZE = 120;

/** Type of a dynamic var's hidden length-header register field (A$len). See dynamic-storage.md. */
export const DYNAMIC_LEN_TYPE = 'uint32';

/** Internal state-record key under which a dynamic var's decoded length is held before chunk assembly. */
export function dynamicLenKey(varName: string): string {
  return `${varName}$len`;
}

/** Chunk-collection signature for a dynamic var: "<name>:<type>" (e.g. "text:string"). */
export function dynamicChunkSignature(varName: string, varTypeString: string): string {
  return computeCollectionSignature(varName, varTypeString);
}

/** UTF-8/raw byte length of a dynamic-storage value (string -> utf8 bytes, bytes -> raw). */
export function dynamicValueByteLength(value: StateValue, type?: string): number {
  // Chunk-packed fixed-width array: A$len = tight element blob byte length = count * elementWidth.
  if (type !== undefined && Array.isArray(value)) {
    const arrInfo = parseArrayTypeString(type);
    if (arrInfo && isFixedWidthType(arrInfo.elementType)) {
      return packFixedWidthArray(value as PrimitiveStateValue[], arrInfo.elementType).length;
    }
  }
  if (typeof value === 'string') return utf8ToBin(value).length;
  if (value instanceof Uint8Array) return value.length;
  return 0;
}

/** ceil(byteLength / DYNAMIC_CHUNK_SIZE) - the number of chunk UTXOs a value of this length needs. */
export function chunkCountForLength(byteLength: number): number {
  return Math.ceil(byteLength / DYNAMIC_CHUNK_SIZE);
}

/** Split a value into DYNAMIC_CHUNK_SIZE-byte pieces (the last piece may be shorter). */
export function splitValueIntoChunks(value: Uint8Array): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let off = 0; off < value.length; off += DYNAMIC_CHUNK_SIZE) {
    chunks.push(value.slice(off, off + DYNAMIC_CHUNK_SIZE));
  }
  return chunks;
}

/** Build a chunk UTXO commitment (an entry with key=chunkIndex, value=chunkData). */
export function buildChunkCommitment(
  chunkIndex: number, chunkData: Uint8Array, commitmentLimit?: number,
): string {
  return buildEntryCommitment(BigInt(chunkIndex), 'bigint', chunkData, 'bytes', undefined, commitmentLimit);
}

/** Parse a chunk UTXO commitment into its index and data. */
export function parseChunkCommitment(hex: string): { chunkIndex: number; chunkData: Uint8Array } {
  const { key, value } = parseEntryCommitment(hex, 'bigint', 'bytes');
  return { chunkIndex: Number(key as bigint), chunkData: value as Uint8Array };
}

/** Concatenate chunk data (ordered by chunkIndex) and truncate to the authoritative length. */
export function joinChunks(orderedChunkData: Uint8Array[], totalLength: number): Uint8Array {
  const joined = new Uint8Array(orderedChunkData.reduce((acc, c) => acc + c.length, 0));
  let off = 0;
  for (const c of orderedChunkData) {
    joined.set(c, off);
    off += c.length;
  }
  return joined.slice(0, totalLength);
}

// ===== Flat-stream chunk-packed array codec (fixed-width elements) =====
// Tight-packed blob `elem_0 ++ elem_1 ++ ...` (element i at byte [i*width, (i+1)*width)) backing a
// chunk-packed fixed-width T[]. Matches the compiler's emitEncodeElementPacked. See docs/arrays.md.
// Structs are deferred.

/** Pack one fixed-width element to exactly fixedWidthBytes(type) bytes (OP_NUM2BIN for int/fixed). */
export function packFixedWidthElement(value: PrimitiveStateValue, elementType: string): Uint8Array {
  const t = parseTypeStrict(elementType);
  if (t === PrimitiveType.BOOL) return new Uint8Array([value ? 1 : 0]);
  if (t instanceof IntType || t instanceof FixedType) {
    return encodeIntAsFixedBytes(value as bigint, t.byteWidth);
  }
  if ((t instanceof BytesType && t.bound !== undefined) || t === PrimitiveType.PUBKEY) {
    const width = fixedWidthBytes(t);
    const bytes = value as Uint8Array;
    if (bytes.length !== width) {
      throw new Error(`packFixedWidthElement: '${elementType}' must be ${width} bytes, got ${bytes.length}`);
    }
    return bytes;
  }
  // A fixed-inner array element (a `uint256[N]` row): pack its elements tight. Value is the nested row array
  // (statically PrimitiveStateValue here, so widen through unknown).
  if (t instanceof ArrayType && t.bound !== undefined) {
    return packFixedWidthArray(value as unknown as PrimitiveStateValue[], t.elementType.toString());
  }
  throw new Error(`packFixedWidthElement: '${elementType}' is not a supported fixed-width element type`);
}

/** Decode one fixed-width element from its packed bytes (OP_BIN2NUM for int/fixed). */
export function unpackFixedWidthElement(bytes: Uint8Array, elementType: string): PrimitiveStateValue {
  const t = parseTypeStrict(elementType);
  if (t === PrimitiveType.BOOL) return bytes.length > 0 && bytes[0] !== 0;
  if (t instanceof IntType || t instanceof FixedType) return decodeIntFixedWidth(bytes);
  if ((t instanceof BytesType && t.bound !== undefined) || t === PrimitiveType.PUBKEY) return bytes;
  // A fixed-inner array element (a `uint256[N]` row): unpack the tight row into its nested element array.
  if (t instanceof ArrayType && t.bound !== undefined) {
    return unpackFixedWidthArray(bytes, t.elementType.toString()) as unknown as PrimitiveStateValue;
  }
  throw new Error(`unpackFixedWidthElement: '${elementType}' is not a supported fixed-width element type`);
}

/** Pack a fixed-width array into its tight blob. */
export function packFixedWidthArray(elements: PrimitiveStateValue[], elementType: string): Uint8Array {
  const width = fixedWidthBytes(parseTypeStrict(elementType));
  const blob = new Uint8Array(elements.length * width);
  for (let i = 0; i < elements.length; i++) {
    blob.set(packFixedWidthElement(elements[i], elementType), i * width);
  }
  return blob;
}

/** Unpack a tight blob into elements; blob length must be a whole multiple of the element width. */
export function unpackFixedWidthArray(blob: Uint8Array, elementType: string): PrimitiveStateValue[] {
  const width = fixedWidthBytes(parseTypeStrict(elementType));
  if (blob.length % width !== 0) {
    throw new Error(`unpackFixedWidthArray: blob length ${blob.length} is not a multiple of element width ${width}`);
  }
  const out: PrimitiveStateValue[] = [];
  for (let off = 0; off < blob.length; off += width) {
    out.push(unpackFixedWidthElement(blob.slice(off, off + width), elementType));
  }
  return out;
}

/**
 * Decode an array as it appears in an EVENT NFT commitment: `<count> ++ <elements>`, where count is the minimal
 * script-number push the compiler emits (OP_0, OP_1..OP_16, or OP_PUSHBYTES_n + value) and elements are raw
 * fixed-width (int, bytesN, bool, ...) or framed pushdata for variable-width element types. This is the on-stack
 * blob the emit covenant writes verbatim (emitPushdataEncode is a no-op on ArrayType), distinct from the framed
 * encoding decodePushdataValue produces - so events use this decoder, not the generic array branch.
 */
export function decodePackedEventArray(
  data: Uint8Array, offset: number, type: string, structs?: readonly StructDefinitionInfo[],
): { value: StateValue[]; bytesConsumed: number } {
  const arrInfo = parseArrayTypeString(type);
  if (!arrInfo) throw new Error(`decodePackedEventArray: '${type}' is not an array type`);
  const b0 = data[offset];
  let count: number;
  let countBytes: number;
  if (b0 === 0x00) {
    count = 0; countBytes = 1; // OP_0
  } else if (b0 >= 0x51 && b0 <= 0x60) {
    count = b0 - 0x50; countBytes = 1; // OP_1..OP_16
  } else if (b0 >= 0x01 && b0 <= 0x4b) {
    const num = vmNumberToBigInt(
      data.slice(offset + 1, offset + 1 + b0), { maximumVmNumberByteLength: VM_NUMBER_MAX_BYTE_LENGTH },
    );
    if (isVmNumberError(num)) throw new Error(`decodePackedEventArray: invalid array count: ${num}`);
    count = Number(num); countBytes = 1 + b0;
  } else {
    throw new Error(`decodePackedEventArray: unexpected array count push 0x${b0.toString(16)} at offset ${offset}`);
  }
  if (count < 0 || count > 10000) {
    throw new Error(`decodePackedEventArray: array length ${count} exceeds safe decoding limit (max 10000)`);
  }
  const elemType = parseTypeStrict(arrInfo.elementType);
  if (isFixedWidthType(elemType)) {
    const width = fixedWidthBytes(elemType);
    const blob = data.slice(offset + countBytes, offset + countBytes + count * width);
    return {
      value: unpackFixedWidthArray(blob, arrInfo.elementType) as StateValue[],
      bytesConsumed: countBytes + count * width,
    };
  }
  let totalConsumed = countBytes;
  const arr: StateValue[] = [];
  for (let i = 0; i < count; i++) {
    const { value: elem, bytesConsumed } = decodePushdataValue(data, offset + totalConsumed, arrInfo.elementType, structs);
    arr.push(elem);
    totalConsumed += bytesConsumed;
  }
  return { value: arr, bytesConsumed: totalConsumed };
}

/**
 * Build an entry NFT commitment hex string from multiple keys and a value.
 * The commitment is: encodePushdata(key1) ++ encodePushdata(key2) ++ ... ++ encodePushdata(value)
 */
export function buildEntryCommitmentMultiKey(
  keyValues: Array<bigint | boolean | Uint8Array>,
  keyTypes: string[],
  valueValue: StateValue,
  valueType: string,
  structs?: readonly StructDefinitionInfo[],
  commitmentLimit?: number,
): string {
  const parts: Uint8Array[] = [];
  for (let i = 0; i < keyValues.length; i++) {
    parts.push(encodePushdataValue(keyValues[i], keyTypes[i]));
  }
  parts.push(encodePushdataValue(valueValue, valueType, structs));

  const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  if (commitmentLimit !== undefined && result.length > commitmentLimit) {
    throw new Error(
      `Entry commitment exceeds limit: ${result.length} bytes > ${commitmentLimit} byte limit`,
    );
  }

  return binToHex(result);
}

/**
 * Parse an entry NFT commitment hex string with multiple keys into keys array and value.
 */
export function parseEntryCommitmentMultiKey(
  hex: string,
  keyTypes: string[],
  valueType: string,
  structs?: readonly StructDefinitionInfo[],
): {
    keys: Array<bigint | boolean | Uint8Array>;
    value: StateValue;
  } {
  const bytes = hexToBin(hex);
  const keys: Array<bigint | boolean | Uint8Array> = [];
  let offset = 0;

  for (const keyType of keyTypes) {
    // Keys are never struct types, so narrow the type
    const { value: key, bytesConsumed } = decodePushdataValue(bytes, offset, keyType) as
      { value: bigint | boolean | Uint8Array; bytesConsumed: number };
    keys.push(key);
    offset += bytesConsumed;
  }

  const { value, bytesConsumed: valueConsumed } = decodePushdataValue(bytes, offset, valueType, structs);

  const totalConsumed = offset + valueConsumed;
  if (totalConsumed < bytes.length) {
    throw new Error(
      `parseEntryCommitmentMultiKey: ${bytes.length - totalConsumed} trailing byte(s) after parsing keys+value`,
    );
  }

  return { keys, value };
}

/**
 * Build the canonical collection signature string: "name:type"
 * e.g. "balances:mapping(pubkey => int)"
 */
export function computeCollectionSignature(name: string, typeString: string): string {
  return `${name}:${typeString}`;
}

/**
 * Compute collection signature hash: SHA-256 of the UTF-8 collection signature, truncated to 20 bytes.
 * This makes each collection's covenant address unique.
 */
export function computeCollectionHash(collectionSignature: string): Uint8Array {
  const bytes = utf8ToBin(collectionSignature);
  return sha256(bytes).slice(0, 20);
}

/**
 * Build the entry-NFT covenant script seeded with a specific token category and collection hash.
 *
 * Dual-path covenant:
 * - Write path (flag=1): requires master minting NFT, allows delete (no self-preservation)
 * - Read-only path (flag=0): no master needed, enforces self-preservation + commitment preservation
 *
 * Unlocking script provides: `<masterInputIndex | 0> <flag>`
 *
 * @param categoryId - 32-byte token category ID
 * @param collectionHash - 20-byte hash derived from collection signature
 */
export function buildEntryNftCovenantScript(categoryId: Uint8Array, collectionHash: Uint8Array): Script {
  const catInternal = categoryId.slice().reverse();
  return [
    // Stack: <masterInputIndex | 0> <flag>
    Op.OP_IF,
    // === Write path (flag=1): verify minting NFT at masterInputIndex ===
    Op.OP_UTXOTOKENCATEGORY,
    encodeInt(32n),
    Op.OP_SPLIT,
    Op.OP_2,
    Op.OP_EQUALVERIFY,
    catInternal,
    Op.OP_TUCK,
    Op.OP_EQUALVERIFY,
    // Verify this input has the expected category
    Op.OP_INPUTINDEX,
    Op.OP_UTXOTOKENCATEGORY,
    encodeInt(32n),
    Op.OP_SPLIT,
    Op.OP_DROP,
    Op.OP_EQUALVERIFY,
    Op.OP_ELSE,
    // === Read-only path (flag=0): no master needed ===
    Op.OP_DROP, // discard unused placeholder
    // Self-pin (Stage 2): require this input's live category == C with mutable capability, so a fabricated
    // foreign-category UTXO at this entry address is unspendable - address-based entry reads sound w/o master.
    Op.OP_INPUTINDEX,
    Op.OP_UTXOTOKENCATEGORY,
    encodeInt(32n),
    Op.OP_SPLIT,
    Op.OP_1,
    Op.OP_EQUALVERIFY, // mutable capability (0x01)
    catInternal,
    Op.OP_EQUALVERIFY, // correct category
    // Self-preservation (bytecode) - prevents readers from redirecting entries
    Op.OP_INPUTINDEX,
    Op.OP_UTXOBYTECODE,
    Op.OP_INPUTINDEX,
    Op.OP_OUTPUTBYTECODE,
    Op.OP_EQUALVERIFY,
    // Category preservation
    Op.OP_INPUTINDEX,
    Op.OP_UTXOTOKENCATEGORY,
    Op.OP_INPUTINDEX,
    Op.OP_OUTPUTTOKENCATEGORY,
    Op.OP_EQUALVERIFY,
    // Commitment preservation: input commitment == output commitment
    Op.OP_INPUTINDEX,
    Op.OP_UTXOTOKENCOMMITMENT,
    Op.OP_INPUTINDEX,
    Op.OP_OUTPUTTOKENCOMMITMENT,
    Op.OP_EQUALVERIFY,
    // FT amount preservation: output >= input (prevents FT drain via read-only path)
    Op.OP_INPUTINDEX,
    Op.OP_OUTPUTTOKENAMOUNT,
    Op.OP_INPUTINDEX,
    Op.OP_UTXOTOKENAMOUNT,
    Op.OP_GREATERTHANOREQUAL,
    Op.OP_VERIFY,
    // Exact satoshi preservation (read-only path only)
    Op.OP_INPUTINDEX,
    Op.OP_UTXOVALUE,
    Op.OP_INPUTINDEX,
    Op.OP_OUTPUTVALUE,
    Op.OP_EQUALVERIFY,
    Op.OP_ENDIF,
    // Embed collection hash (makes address unique per collection)
    collectionHash,
    Op.OP_DROP,
    Op.OP_1,
  ];
}

/**
 * Build the hex-encoded bytecode for the entry-NFT covenant seeded with a category and collection signature.
 */
export function buildEntryNftCovenantBytecode(categoryIdHex: string, collectionSignature: string): string {
  const categoryId = hexToBin(categoryIdHex);
  const collectionHash = computeCollectionHash(collectionSignature);
  return binToHex(scriptToBytecode(buildEntryNftCovenantScript(categoryId, collectionHash)));
}

/**
 * Build the canonical event signature string: "Name(type1,type2,...)"
 */
export function computeEventSignature(eventName: string, paramTypes: string[]): string {
  return `${eventName}(${paramTypes.join(',')})`;
}

/**
 * Build the canonical error signature string: "Name(type1,type2,...)"
 */
export function computeErrorSignature(errorName: string, paramTypes: string[]): string {
  return `${errorName}(${paramTypes.join(',')})`;
}

/**
 * Build the canonical function signature string: "Name(type1,type2,...)"
 */
export function computeFunctionSignature(funcName: string, paramTypes: string[]): string {
  return `${funcName}(${paramTypes.join(',')})`;
}

/**
 * Compute 4-byte function selector: SHA-256 of the UTF-8 function signature, truncated to 4 bytes.
 * The signature format is "funcName(type1,type2,...)", e.g. "transfer(pubkey,sig,int)".
 * Used as OP_DEFINE/OP_INVOKE identifier for entry-point functions.
 */
export function computeFunctionSelector(signature: string): Uint8Array {
  const nameBytes = utf8ToBin(signature);
  return sha256(nameBytes).slice(0, 4);
}

/**
 * Compute 4-byte function selector as hex string.
 */
export function computeFunctionSelectorHex(signature: string): string {
  return binToHex(computeFunctionSelector(signature));
}

/**
 * Compute event signature hash: SHA-256 of the UTF-8 event signature, truncated to 20 bytes.
 * The signature includes all parameter types, e.g. "Transfer(pubkey,int)".
 * This makes each event overload's covenant address unique.
 */
export function computeEventNameHash(eventSignature: string): Uint8Array {
  const nameBytes = utf8ToBin(eventSignature);
  return sha256(nameBytes).slice(0, 20);
}

/**
 * Compute the 32-byte event selector (`E.selector`, bytes32): the full SHA-256 of the UTF-8 event
 * signature - the platform's analog of Solidity's keccak-based topic hash (signature-injective, so
 * equal signatures give equal selectors and distinct signatures distinct ones).
 */
export function computeEventSelector(eventSignature: string): Uint8Array {
  return sha256(utf8ToBin(eventSignature));
}

/**
 * Build the event-NFT covenant script seeded with a specific token category and event name.
 *
 * The covenant:
 * 1. Verifies this input's token category matches the expected category
 * 2. Embeds event name hash (makes address unique per event type)
 * 3. Enforces a 144-block relative timelock, after which anyone can spend (clean up)
 *
 * Unlocking script: empty (after 144 blocks)
 *
 * @param categoryId - 32-byte token category ID
 * @param eventNameHash - 20-byte hash derived from event name
 */
export function buildEventNftCovenantScript(categoryId: Uint8Array, eventNameHash: Uint8Array): Script {
  const catInternal = categoryId.slice().reverse();
  return [
    // Part 1: verify this input's token category matches the expected category
    // and capability is 'none' (no capability byte)
    Op.OP_INPUTINDEX,
    Op.OP_UTXOTOKENCATEGORY,
    encodeInt(32n),
    Op.OP_SPLIT,       // [cat32, capByte_or_empty]
    Op.OP_SWAP,        // [capByte_or_empty, cat32]
    catInternal,
    Op.OP_EQUALVERIFY, // verify category
    encodeInt(0n),
    Op.OP_EQUALVERIFY, // verify capability is empty (none)
    // Part 2: embed event signature hash (makes address unique per event overload)
    eventNameHash,
    Op.OP_DROP,
    // Part 3: 144-block relative timelock
    encodeInt(144n),
    Op.OP_CHECKSEQUENCEVERIFY,
    Op.OP_DROP,
    Op.OP_1,
  ];
}

/**
 * Build the hex-encoded bytecode for the event-NFT covenant.
 */
export function buildEventNftCovenantBytecode(categoryIdHex: string, eventSignature: string): string {
  const categoryId = hexToBin(categoryIdHex);
  const eventNameHash = computeEventNameHash(eventSignature);
  return binToHex(scriptToBytecode(buildEventNftCovenantScript(categoryId, eventNameHash)));
}

/**
 * Build the anonymous event-NFT covenant script seeded with a specific token category.
 *
 * Unlike named events, anonymous events skip the eventNameHash embedding (Part 2),
 * so all anonymous events from a contract share one P2SH32 address.
 *
 * The covenant:
 * 1. Verifies this input's token category matches the expected category
 * 2. Enforces a 144-block relative timelock, after which anyone can spend (clean up)
 *
 * @param categoryId - 32-byte token category ID
 */
export function buildAnonymousEventNftCovenantScript(categoryId: Uint8Array): Script {
  const catInternal = categoryId.slice().reverse();
  return [
    // Part 1: verify this input's token category matches the expected category
    // and capability is 'none' (no capability byte)
    Op.OP_INPUTINDEX,
    Op.OP_UTXOTOKENCATEGORY,
    encodeInt(32n),
    Op.OP_SPLIT,       // [cat32, capByte_or_empty]
    Op.OP_SWAP,        // [capByte_or_empty, cat32]
    catInternal,
    Op.OP_EQUALVERIFY, // verify category
    encodeInt(0n),
    Op.OP_EQUALVERIFY, // verify capability is empty (none)
    // Part 2 SKIPPED - no eventNameHash (anonymous)
    // Part 3: 144-block relative timelock
    encodeInt(144n),
    Op.OP_CHECKSEQUENCEVERIFY,
    Op.OP_DROP,
    Op.OP_1,
  ];
}

/**
 * Build the hex-encoded bytecode for the anonymous event-NFT covenant.
 */
export function buildAnonymousEventNftCovenantBytecode(categoryIdHex: string): string {
  const categoryId = hexToBin(categoryIdHex);
  return binToHex(scriptToBytecode(buildAnonymousEventNftCovenantScript(categoryId)));
}

/**
 * Build the blockhash (n -> hash) oracle covenant for block `n` under the oracle token category
 * (docs/block-and-transaction-properties.md s11). The immutable ('none' capability) NFT carries commitment =
 * n(4 LE)||hash(32).
 *
 * The covenant:
 *  - self-pins its token category == categoryId (capability 'none'), so a foreign-category UTXO paid to
 *    this address is unspendable;
 *  - read path (flag 0): self-preserving recreate (bytecode + category + commitment at the same output
 *    index), so permissionless reads cannot tamper with or destroy it;
 *  - wipe path (flag 1): `tx.time >= n + 256` (CLTV absolute - reads recreate the UTXO so a relative CSV
 *    would keep resetting), after which anyone may consume it for cleanup. `n` is baked, which both bounds
 *    the wipe and makes addr(n) unique per block.
 *
 * No compiler reconstruction: the consumer reads by category + commitment.n, never rebuilds this address.
 */
export function buildBlockhashOracleCovenantScript(categoryId: Uint8Array, n: bigint): Script {
  const catInternal = categoryId.slice().reverse();
  return [
    // self-pin: this input's token category == categoryId, capability 'none' (immutable)
    Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCATEGORY,
    encodeInt(32n), Op.OP_SPLIT, Op.OP_SWAP, // [flag, capOrEmpty, cat32]
    catInternal, Op.OP_EQUALVERIFY,
    encodeInt(0n), Op.OP_EQUALVERIFY,        // capability empty (none)
    // flag (from unlocking): wipe (1) vs read (0)
    Op.OP_IF,
    encodeInt(n + 256n), Op.OP_CHECKLOCKTIMEVERIFY, Op.OP_DROP, // wipe: tx.time >= n + 256
    Op.OP_ELSE,
    // read: self-preserve (bytecode + category + commitment) at the same output index
    Op.OP_INPUTINDEX, Op.OP_UTXOBYTECODE, Op.OP_INPUTINDEX, Op.OP_OUTPUTBYTECODE, Op.OP_EQUALVERIFY,
    Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCATEGORY, Op.OP_INPUTINDEX, Op.OP_OUTPUTTOKENCATEGORY, Op.OP_EQUALVERIFY,
    Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCOMMITMENT, Op.OP_INPUTINDEX, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY,
    Op.OP_ENDIF,
    Op.OP_1,
  ];
}

/** p2sh32 locking bytecode for the (n -> hash) oracle UTXO of block `n`. */
export function blockhashOracleLockingBytecode(categoryId: Uint8Array, n: bigint): Uint8Array {
  const scriptHash = sha256(sha256(scriptToBytecode(buildBlockhashOracleCovenantScript(categoryId, n))));
  return Uint8Array.from([0xaa, 0x20, ...scriptHash, 0x87]);
}

/** Build the (n,hash) commitment: n as 4 little-endian bytes followed by the 32-byte hash. */
export function buildBlockhashCommitment(n: bigint, hash: Uint8Array): Uint8Array {
  const n4 = new Uint8Array(4);
  let v = n;
  for (let i = 0; i < 4; i++) { n4[i] = Number(v & 0xffn); v >>= 8n; }
  return Uint8Array.from([...n4, ...hash]);
}

// Decode the block number from a (n->hash) oracle commitment: the first 4 bytes, little-endian (the inverse
// of buildBlockhashCommitment). Used to match a co-spent oracle UTXO to a blockhash(n) reader.
export function blockhashCommitmentNumber(commitment: Uint8Array): bigint {
  let n = 0n;
  for (let i = 0; i < 4 && i < commitment.length; i++) n |= BigInt(commitment[i]) << BigInt(8 * i);
  return n;
}

// A blockhashReads entry is either a function param name (n = the call arg) or a synthetic computed-read key
// `<computed:i>`. For a computed key the SDK resolves n from the auto-derivation probe trace - the covenant
// computes n on-stack from ANY expression (block.number - K, arbitrary arithmetic), so n is never re-derived
// in JS. A param name cannot contain '<', so param names and computed keys never collide. Each computed call
// site gets its own key/slot (arbitrary expressions cannot be deduped statically).
const COMPUTED_BLOCKHASH_PREFIX = '<computed:';

export function encodeComputedBlockhashKey(index: number): string {
  return `${COMPUTED_BLOCKHASH_PREFIX}${index}>`;
}

export function isComputedBlockhashKey(key: string): boolean {
  return key.startsWith(COMPUTED_BLOCKHASH_PREFIX);
}

/**
 * Build the token container covenant script for holding foreign tokens on behalf
 * of a stateful master contract.
 *
 * Two spending paths:
 * - flag=1 (master-authorized): verifies minting NFT at masterInputIndex
 * - flag=0 (merge): verifies output preserves locking bytecode
 *
 * Unlocking script: `<masterInputIndex | mergeOutputIndex> <flag>`
 *
 * @param categoryId - 32-byte master contract's token category ID
 * @param tokenContainerCategoryId - 32-byte token container's token category (salt for unique address)
 */
export function buildTokenContainerCovenantScript(
  categoryId: Uint8Array,
  tokenContainerCategoryId: Uint8Array,
): Script {
  const catInternal = categoryId.slice().reverse();
  return [
    // Stack: <masterInputIndex | mergeOutputIndex> <flag>
    Op.OP_IF,
    // Master path: verify minting NFT at masterInputIndex
    Op.OP_UTXOTOKENCATEGORY,
    encodeInt(32n),
    Op.OP_SPLIT,
    Op.OP_2,
    Op.OP_EQUALVERIFY,
    catInternal,
    Op.OP_EQUALVERIFY,
    Op.OP_ELSE,
    // Merge path: output preserves locking bytecode, value, FT amount, and category
    Op.OP_DUP,
    Op.OP_DUP,
    Op.OP_DUP, // need mergeOutputIndex four times: bytecode, value, tokenAmount, tokenCategory
    Op.OP_OUTPUTBYTECODE,
    Op.OP_INPUTINDEX,
    Op.OP_UTXOBYTECODE,
    Op.OP_EQUALVERIFY, // bytecode preservation
    // Value preservation: inputValue <= outputValue (outputValue >= inputValue)
    Op.OP_OUTPUTVALUE,
    Op.OP_INPUTINDEX,
    Op.OP_UTXOVALUE,
    Op.OP_GREATERTHANOREQUAL,
    Op.OP_VERIFY,
    // FT amount preservation: inputAmount <= outputAmount (outputAmount >= inputAmount)
    Op.OP_OUTPUTTOKENAMOUNT,
    Op.OP_INPUTINDEX,
    Op.OP_UTXOTOKENAMOUNT,
    Op.OP_GREATERTHANOREQUAL,
    Op.OP_VERIFY,
    // Category preservation: mergeOutput category == input category
    Op.OP_OUTPUTTOKENCATEGORY, // uses 4th copy of mergeOutputIndex
    Op.OP_INPUTINDEX,
    Op.OP_UTXOTOKENCATEGORY,
    Op.OP_EQUALVERIFY,
    // Single-input constraint: verify no other input shares this locking bytecode
    // Prevents double-merge attacks where multiple UTXOs are merged to a single output
    Op.OP_INPUTINDEX,
    Op.OP_UTXOBYTECODE, // [myLbc]
    Op.OP_TXINPUTCOUNT,
    Op.OP_1SUB, // [myLbc, i=last_input_idx]
    Op.OP_BEGIN,
    Op.OP_DUP,
    Op.OP_INPUTINDEX,
    Op.OP_NUMEQUAL, // [myLbc, i, isMe]
    Op.OP_NOTIF,
    Op.OP_DUP,
    Op.OP_UTXOBYTECODE, // [myLbc, i, otherLbc]
    Op.OP_2,
    Op.OP_PICK, // [myLbc, i, otherLbc, myLbc]
    Op.OP_EQUAL,
    Op.OP_NOT,
    Op.OP_VERIFY, // verify otherLbc != myLbc
    Op.OP_ENDIF,
    Op.OP_1SUB, // [myLbc, i-1]
    Op.OP_DUP,
    encodeInt(0n),
    Op.OP_LESSTHAN, // [myLbc, i-1, i-1<0]
    Op.OP_UNTIL, // [myLbc, i-1]
    Op.OP_DROP,
    Op.OP_DROP, // cleanup
    Op.OP_ENDIF,
    // Salt for unique address per token container category
    tokenContainerCategoryId,
    Op.OP_DROP,
    Op.OP_1,
  ];
}

/**
 * Build the hex-encoded bytecode for the token container covenant.
 */
export function buildTokenContainerCovenantBytecode(
  categoryIdHex: string,
  tokenContainerCategoryIdHex: string,
): string {
  const categoryId = hexToBin(categoryIdHex);
  const tokenContainerCategoryId = hexToBin(tokenContainerCategoryIdHex);
  return binToHex(
    scriptToBytecode(buildTokenContainerCovenantScript(categoryId, tokenContainerCategoryId)),
  );
}

/**
 * Build the covenant script for a satoshi container.
 *
 * Satoshi containers hold the contract's BCH treasury. All this.transfer()
 * calls draw from this container rather than from the master UTXO.
 *
 * Dual-path spending:
 * - flag=1 (master path): verifies minting NFT at masterInputIndex (master-authorized spend)
 * - flag=0 (merge path): verifies output preserves locking bytecode (UTXO consolidation)
 *
 * @param categoryId - 32-byte master contract's token category (also used as salt for unique address)
 */
export function buildSatoshiContainerCovenantScript(categoryId: Uint8Array): Script {
  const catInternal = categoryId.slice().reverse();
  return [
    // Stack: <masterInputIndex | mergeOutputIndex> <flag>
    Op.OP_IF,
    // === Master path (flag=1): verify minting NFT at masterInputIndex ===
    Op.OP_UTXOTOKENCATEGORY,
    encodeInt(32n),
    Op.OP_SPLIT,
    Op.OP_2,
    Op.OP_EQUALVERIFY, // minting capability
    catInternal,
    Op.OP_EQUALVERIFY, // expected category
    Op.OP_ELSE,
    // === Merge path (flag=0): output preserves locking bytecode, value, token category, and FT amount ===
    Op.OP_DUP, // preserve mergeOutputIndex for value check
    Op.OP_DUP, // preserve mergeOutputIndex for token category check
    Op.OP_DUP, // preserve mergeOutputIndex for FT amount check
    Op.OP_OUTPUTBYTECODE,
    Op.OP_INPUTINDEX,
    Op.OP_UTXOBYTECODE,
    Op.OP_EQUALVERIFY, // bytecode preservation
    // Value preservation: inputValue <= outputValue (outputValue >= inputValue)
    Op.OP_OUTPUTVALUE,
    Op.OP_INPUTINDEX,
    Op.OP_UTXOVALUE,
    Op.OP_GREATERTHANOREQUAL,
    Op.OP_VERIFY,
    // Token category preservation: prevents accidental token stripping during merge
    Op.OP_OUTPUTTOKENCATEGORY,
    Op.OP_INPUTINDEX,
    Op.OP_UTXOTOKENCATEGORY,
    Op.OP_EQUALVERIFY,
    // FT amount preservation: prevents draining any accidentally-held fungible tokens
    Op.OP_OUTPUTTOKENAMOUNT,
    Op.OP_INPUTINDEX,
    Op.OP_UTXOTOKENAMOUNT,
    Op.OP_GREATERTHANOREQUAL,
    Op.OP_VERIFY,
    // Single-input constraint: verify no other input shares this locking bytecode
    // Prevents double-merge attacks where multiple UTXOs are merged to a single output
    Op.OP_INPUTINDEX,
    Op.OP_UTXOBYTECODE, // [myLbc]
    Op.OP_TXINPUTCOUNT,
    Op.OP_1SUB, // [myLbc, i=last_input_idx]
    Op.OP_BEGIN,
    Op.OP_DUP,
    Op.OP_INPUTINDEX,
    Op.OP_NUMEQUAL, // [myLbc, i, isMe]
    Op.OP_NOTIF,
    Op.OP_DUP,
    Op.OP_UTXOBYTECODE, // [myLbc, i, otherLbc]
    Op.OP_2,
    Op.OP_PICK, // [myLbc, i, otherLbc, myLbc]
    Op.OP_EQUAL,
    Op.OP_NOT,
    Op.OP_VERIFY, // verify otherLbc != myLbc
    Op.OP_ENDIF,
    Op.OP_1SUB, // [myLbc, i-1]
    Op.OP_DUP,
    encodeInt(0n),
    Op.OP_LESSTHAN, // [myLbc, i-1, i-1<0]
    Op.OP_UNTIL, // [myLbc, i-1]
    Op.OP_DROP,
    Op.OP_DROP, // cleanup
    Op.OP_ENDIF,
    // Salt for deterministic, unique address per contract instance
    catInternal,
    Op.OP_DROP,
    Op.OP_1,
  ];
}

/**
 * Build the hex-encoded bytecode for the satoshi container covenant.
 *
 * @param categoryIdHex - Hex-encoded 32-byte master contract's token category
 */
export function buildSatoshiContainerCovenantBytecode(categoryIdHex: string): string {
  const categoryId = hexToBin(categoryIdHex);
  return binToHex(
    scriptToBytecode(buildSatoshiContainerCovenantScript(categoryId)),
  );
}

/**
 * Build a minimal Artifact for a covenant script, suitable for debug template generation.
 *
 * The artifact contains raw bytecode ASM (no source maps or debug info), which is enough
 * for the libauth template generator to produce a working debuggable template.
 */
export function buildCovenantArtifact(
  contractName: string,
  covenantScript: Script,
  abiFunction: AbiFunction,
): Artifact {
  const bytecodeBytes = scriptToBytecode(covenantScript);
  return {
    contractName,
    constructorInputs: [],
    abi: [abiFunction],
    bytecode: bytecodeToAsm(bytecodeBytes),
    source: '',
    compiler: { name: 'solidc', version: '0.13.0-next.3' },
    updatedAt: new Date().toISOString(),
  };
}
