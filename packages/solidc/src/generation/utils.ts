import {
  AddressType,
  ArrayType,
  BytesType,
  EnumType,
  FixedType,
  IntType,
  ValueType,
  encodeInt,
  Op,
  PrimitiveType,
  type Script,
  StructType,
  type Type,
} from '@solidcash/utils';
import { UnaryOperator, BinaryOperator, NullaryOperator } from '../ast/Operator.js';
import { GlobalFunction, TimeOp } from '../ast/Globals.js';

const extractAddressHash = (offset: bigint): Script => [
  encodeInt(offset), Op.OP_SPLIT, Op.OP_NIP, encodeInt(20n), Op.OP_SPLIT, Op.OP_DROP,
];

/** Convert a native BCH address or a Solidity ABI address word into the canonical 20-byte identity. */
export function compileAddressToEvmIdentity(): Script {
  return [
    Op.OP_SIZE, encodeInt(0n), Op.OP_EQUAL,
    Op.OP_IF,
    Op.OP_DROP, new Uint8Array(20),
    Op.OP_ELSE,
    Op.OP_SIZE, encodeInt(20n), Op.OP_EQUAL,
    Op.OP_IF,
    // Raw 20-byte address: already narrowed.
    Op.OP_ELSE,
    Op.OP_SIZE, encodeInt(32n), Op.OP_EQUAL,
    Op.OP_IF,
    // Graph arguments and constructed address arrays can retain the right-aligned Solidity ABI word.
    // This is an address conversion, not bytes32-to-bytes20 truncation: discard the 12-byte left padding.
    encodeInt(12n), Op.OP_SPLIT, Op.OP_NIP,
    Op.OP_ELSE,
    Op.OP_SIZE, encodeInt(23n), Op.OP_EQUAL,
    Op.OP_IF,
    ...extractAddressHash(2n),
    Op.OP_ELSE,
    Op.OP_SIZE, encodeInt(35n), Op.OP_EQUAL,
    Op.OP_IF,
    Op.OP_HASH160,
    Op.OP_ELSE,
    ...extractAddressHash(3n),
    Op.OP_ENDIF,
    Op.OP_ENDIF,
    Op.OP_ENDIF,
    Op.OP_ENDIF,
    Op.OP_ENDIF,
  ];
}

/** Strip Solidity ABI-word framing while preserving native locks for callers requiring that representation. */
export function compilePackedAddressAsInteger(): Script {
  return [
    Op.OP_SIZE, encodeInt(32n), Op.OP_EQUAL,
    Op.OP_IF,
    encodeInt(12n), Op.OP_SPLIT, Op.OP_NIP,
    Op.OP_ENDIF,
  ];
}

export function compileTimeOp(op: TimeOp): Script {
  const mapping = {
    [TimeOp.CHECK_LOCKTIME]: [Op.OP_CHECKLOCKTIMEVERIFY, Op.OP_DROP],
    [TimeOp.CHECK_SEQUENCE]: [Op.OP_CHECKSEQUENCEVERIFY, Op.OP_DROP],
  };

  return mapping[op];
}

// Under Solidity compatibility a same-width int <-> uint cast reinterprets the two's-complement bits, as the EVM
// does; its result is in the target range by construction.
export function isSignReinterpretCast(from: Type, to: Type, solidityCompat: boolean): boolean {
  return solidityCompat && from instanceof IntType && to instanceof IntType
    && from.signed !== to.signed && from.bits === to.bits;
}

export function compileCast(from: Type, to: Type, isUnsafe: boolean, solidityCompat = false): Script {
  // INT (integer literal/generic) shares the unbounded VM representation of BIGINT.
  if (from === PrimitiveType.INT) from = PrimitiveType.BIGINT;
  if (to === PrimitiveType.INT) to = PrimitiveType.BIGINT;
  // unsafe() casts intentionally skip ALL conversion opcodes (not just bounds checks).
  // This is by design: the developer asserts the raw stack value is already correct.
  // Examples: unsafe_int(bytes) skips OP_BIN2NUM, unsafe_bool(int) skips OP_0NOTEQUAL.
  // Bounds checks are separately gated in visitCast (GenerateTargetTraversal).
  if (isUnsafe) return [];

  // ValueType wrapping/unwrapping is zero-cost (no-op at VM level)
  if (from instanceof ValueType) return compileCast(from.underlyingType, to, isUnsafe, solidityCompat);
  if (to instanceof ValueType) return compileCast(from, to.underlyingType, isUnsafe, solidityCompat);

  // string -> bytes: no-op (already bytes at VM level)
  if (from === PrimitiveType.STRING && to instanceof BytesType) return [];
  // bytes -> string: no-op
  if (from instanceof BytesType && to === PrimitiveType.STRING) return [];

  if (from === PrimitiveType.BIGINT && to instanceof BytesType && to.bound !== undefined) {
    return [encodeInt(BigInt(to.bound)), Op.OP_NUM2BIN, ...(solidityCompat ? [Op.OP_REVERSEBYTES] : [])];
  }
  // int -> unbounded bytes: no-op (VM number is already bytes)
  if (from === PrimitiveType.BIGINT && to instanceof BytesType && to.bound === undefined) return [];

  if (from === PrimitiveType.BIGINT && to === PrimitiveType.BOOL) {
    return [Op.OP_0NOTEQUAL];
  }

  // bool -> int: no-op (bool 0/1 is already a valid int)
  if (from === PrimitiveType.BOOL && to === PrimitiveType.BIGINT) return [];

  if (from instanceof BytesType && to === PrimitiveType.BIGINT) {
    return [...(solidityCompat && from.bound !== undefined ? [Op.OP_REVERSEBYTES] : []), Op.OP_BIN2NUM];
  }

  // int -> IntType: no opcode needed, bounds check emitted by caller
  if (from === PrimitiveType.BIGINT && to instanceof IntType) return [];
  // IntType -> int: no-op (already a valid VM number)
  if (from instanceof IntType && to === PrimitiveType.BIGINT) return [];
  // Solidity explicit unsigned narrowing keeps the low N bits. Native SolidCash casts retain their historical
  // checked semantics; compatibility mode performs the truncation before the caller's target bounds check.
  if (from instanceof IntType && to instanceof IntType) {
    if (solidityCompat && !from.signed && !to.signed && to.bits < from.bits) {
      return [encodeInt(1n << BigInt(to.bits)), Op.OP_MOD];
    }
    // Same-width sign change keeps the two's-complement bits: a negative value gains 2^N; a value with its top bit
    // (v >> N-1) set loses 2^N. The power of two is built at runtime.
    if (isSignReinterpretCast(from, to, solidityCompat)) {
      const n = encodeInt(BigInt(to.bits));
      return from.signed
        ? [Op.OP_DUP, Op.OP_0, Op.OP_LESSTHAN, n, Op.OP_LSHIFTNUM, Op.OP_ADD]
        : [Op.OP_DUP, encodeInt(BigInt(to.bits - 1)), Op.OP_RSHIFTNUM, n, Op.OP_LSHIFTNUM, Op.OP_SUB];
    }
    return [];
  }
  // IntType -> BytesType: same as int -> bytes. Under Solidity compatibility a same-width unsigned value may set the
  // top bit (bytes32(type(uint256).max)), which needs a sign byte: encode N+1 bytes and drop that byte.
  if (from instanceof IntType && to instanceof BytesType && to.bound !== undefined) {
    if (solidityCompat && !from.signed && from.bits === to.bound * 8) {
      const n = BigInt(to.bound);
      return [encodeInt(n + 1n), Op.OP_NUM2BIN, encodeInt(n), Op.OP_SPLIT, Op.OP_DROP, Op.OP_REVERSEBYTES];
    }
    return [encodeInt(BigInt(to.bound)), Op.OP_NUM2BIN, ...(solidityCompat ? [Op.OP_REVERSEBYTES] : [])];
  }
  // BytesType -> IntType: bytes are read as a script number. For an UNSIGNED target, sign-pad a 0x00 high byte
  // first so a value with the top bit set (e.g. uint256(keccak256(...))) reads as positive, not negative - a bare
  // BIN2NUM would read it as a negative number and fail the caller's >= 0 bounds check. Signed targets read as-is.
  if (from instanceof BytesType && to instanceof IntType) {
    const endian = solidityCompat && from.bound !== undefined ? [Op.OP_REVERSEBYTES] : [];
    return to.signed
      ? [...endian, Op.OP_BIN2NUM]
      : [...endian, new Uint8Array([0x00]), Op.OP_CAT, Op.OP_BIN2NUM];
  }
  // IntType -> bool: same as int -> bool
  if (from instanceof IntType && to === PrimitiveType.BOOL) return [Op.OP_0NOTEQUAL];
  // bool -> IntType: no-op (0 or 1 always in range), bounds check emitted by caller
  if (from === PrimitiveType.BOOL && to instanceof IntType) return [];

  // FixedType cast rules - at VM level, fixed-point values are scaled integers
  // int -> FixedType: multiply by scaleFactor
  if (from === PrimitiveType.BIGINT && to instanceof FixedType) {
    return [encodeInt(to.scaleFactor), Op.OP_MUL];
  }
  // IntType -> FixedType: multiply by scaleFactor
  if (from instanceof IntType && to instanceof FixedType) {
    return [encodeInt(to.scaleFactor), Op.OP_MUL];
  }
  // FixedType -> int: divide by scaleFactor (truncates)
  if (from instanceof FixedType && to === PrimitiveType.BIGINT) {
    return [encodeInt(from.scaleFactor), Op.OP_DIV];
  }
  // FixedType -> IntType: divide by scaleFactor, bounds check emitted by caller
  if (from instanceof FixedType && to instanceof IntType) {
    return [encodeInt(from.scaleFactor), Op.OP_DIV];
  }
  // FixedType -> FixedType (cross-scale): adjust by ratio of scale factors
  if (from instanceof FixedType && to instanceof FixedType) {
    if (from.decimals === to.decimals) return []; // same scale, no-op
    if (to.decimals > from.decimals) {
      const ratio = 10n ** BigInt(to.decimals - from.decimals);
      return [encodeInt(ratio), Op.OP_MUL];
    }
    const ratio = 10n ** BigInt(from.decimals - to.decimals);
    return [encodeInt(ratio), Op.OP_DIV];
  }
  // FixedType -> bool: non-zero check
  if (from instanceof FixedType && to === PrimitiveType.BOOL) {
    return [Op.OP_0NOTEQUAL];
  }
  // FixedType -> BytesType: same as int -> bytes
  if (from instanceof FixedType && to instanceof BytesType && to.bound !== undefined) {
    return [encodeInt(BigInt(to.bound)), Op.OP_NUM2BIN];
  }
  // BytesType -> FixedType: same as bytes -> int, bounds check emitted by caller
  if (from instanceof BytesType && to instanceof FixedType) {
    return [Op.OP_BIN2NUM];
  }
  // bool -> FixedType: multiply by scaleFactor
  if (from === PrimitiveType.BOOL && to instanceof FixedType) {
    return [encodeInt(to.scaleFactor), Op.OP_MUL];
  }

  // bool -> BytesType: no-op (bool 0/1 is already valid bytes)
  if (from === PrimitiveType.BOOL && to instanceof BytesType) return [];

  // BytesType -> BytesType: equal bounds or an unbounded target is a no-op (same representation).
  // Shrinking keeps the leftmost M bytes (Solidity left-aligned truncation); widening right-pads
  // with (M-N) zero bytes. e.g. bytes4(keccak256(x)) -> first 4 bytes of the hash.
  // Dynamic bytes -> bytesM pads with M zero bytes, then keeps the first M (Solidity >= 0.8.5).
  if (from instanceof BytesType && to instanceof BytesType) {
    if (to.bound === undefined || from.bound === to.bound) return [];
    if (from.bound === undefined) {
      const m = encodeInt(BigInt(to.bound));
      return [encodeInt(0n), m, Op.OP_NUM2BIN, Op.OP_CAT, m, Op.OP_SPLIT, Op.OP_DROP];
    }
    if (to.bound < from.bound) return [encodeInt(BigInt(to.bound)), Op.OP_SPLIT, Op.OP_DROP];
    return [new Uint8Array(to.bound - from.bound), Op.OP_CAT];
  }

  // IntType/FixedType -> unbounded bytes: no-op (VM number is already bytes)
  if ((from instanceof IntType || from instanceof FixedType) && to instanceof BytesType && to.bound === undefined) {
    return [];
  }

  // StructType -> StructType: no-op (same blob at VM level)
  if (from instanceof StructType && to instanceof StructType) return [];

  // Solidity permits an explicit conversion between identically-shaped array types (most commonly to turn a
  // calldata slice into an ordinary dynamic-array value). The slice already uses the target array's packed
  // representation, so the conversion emits no bytecode.
  if (from instanceof ArrayType && to instanceof ArrayType && from.toString() === to.toString()) return [];

  // Solidity-compat narrowing casts: `bytes20(address)` / `uint160(address)`. A SolidCash address is a
  // variable-length locking bytecode, not necessarily a 20-byte value. Preserve an already-raw Solidity
  // address, extract the hash at offset 2 from P2SH20 (a914 <20> 87), take HASH160 of a P2SH32
  // (aa20 <32> 87 — a 35-byte script whose 32-byte payload is not a 20-byte account id), or extract at
  // offset 3 from P2PKH (76a914 <20> 88ac). This is lossy and warned in TypeCheckTraversal. Only bytes20
  // and int targets narrow; `bytes(address)` keeps the full locking bytecode. Other lengths take the
  // P2PKH path and fail closed at OP_SPLIT if they cannot contain a 20-byte payload.
  //
  // `addressForm` does not reach here: the cast *is* the narrowing, so `uint160(a)` and `bytes20(a)`
  // truncate in either form. What the form decides is the value an un-cast address carries (see
  // `emitEvmPackedValue` and the decoded-result projection).
  if (from instanceof AddressType && to instanceof BytesType && to.bound === 20) {
    return compileAddressToEvmIdentity();
  }
  if (from instanceof AddressType && to instanceof IntType) {
    // OP_BIN2NUM reads a sign-magnitude little-endian number. Solidity's uint160(address) interprets the
    // 20-byte identity in big-endian order, so reverse it first in compatibility mode. Native SolidCash keeps
    // its historical little-endian numeric cast. For unsigned targets append a 0x00 sign byte so hashes whose
    // high bit is set remain non-negative before the caller's bounds check.
    const endian = solidityCompat ? [Op.OP_REVERSEBYTES] : [];
    return to.signed
      ? [...compileAddressToEvmIdentity(), ...endian, Op.OP_BIN2NUM]
      : [...compileAddressToEvmIdentity(), ...endian, new Uint8Array([0]), Op.OP_CAT, Op.OP_BIN2NUM];
  }

  // address casts are no-ops (stack value unchanged)
  if (to instanceof AddressType) return [];
  if (from instanceof AddressType) return [];

  // pubkey/sig/datasig <-> bytes: no-op (all are bytes at VM level)
  if (from === PrimitiveType.PUBKEY || from === PrimitiveType.SIG || from === PrimitiveType.DATASIG) return [];
  if (to === PrimitiveType.PUBKEY || to === PrimitiveType.SIG || to === PrimitiveType.DATASIG) return [];

  // Enum -> int or int -> enum: no-op (enums are integers at VM level)
  if (from instanceof EnumType || to instanceof EnumType) return [];

  // Same type: no-op
  if (from === to) return [];

  throw new Error(`compileCast: unsupported conversion from ${from.toString()} to ${to.toString()}`);
}

// Two's-complement truncation of an integer to `to` (Solidity's cleanup of a dirty word). The moduli are built at
// runtime. A known non-negative value needs one modulo; otherwise the remainder is lifted into [0, 2^bits) first.
// A signed target is biased by H = 2^(bits-1), reduced into [0, 2H) and unbiased.
export function compileIntTruncation(to: IntType, nonNegative: boolean): Script {
  if (!to.signed) {
    const modulus: Script = [Op.OP_1, encodeInt(BigInt(to.bits)), Op.OP_LSHIFTNUM];
    return nonNegative
      ? [...modulus, Op.OP_MOD]
      : [...modulus, Op.OP_TUCK, Op.OP_MOD, Op.OP_OVER, Op.OP_ADD, Op.OP_SWAP, Op.OP_MOD];
  }
  const biased: Script = [
    Op.OP_1, encodeInt(BigInt(to.bits - 1)), Op.OP_LSHIFTNUM, // [v, H]
    Op.OP_TUCK, Op.OP_ADD, Op.OP_OVER, Op.OP_DUP, Op.OP_ADD, // [H, v+H, 2H]
  ];
  const reduced: Script = nonNegative
    ? [Op.OP_MOD]
    : [Op.OP_TUCK, Op.OP_MOD, Op.OP_OVER, Op.OP_ADD, Op.OP_SWAP, Op.OP_MOD];
  return [...biased, ...reduced, Op.OP_SWAP, Op.OP_SUB];
}

// A cast to or from the raw 32-byte word a Yul `:=` copies (CastNode.evmWord), in evmCompat byte order: an int
// target keeps the word's low bits (two's complement), a bytesN target takes the word's leading N bytes, and a
// bytesN source is left-aligned in the word. Undefined for a pair the ordinary cast handles.
export function compileEvmWordCast(from: Type, to: Type, nonNegative: boolean): Script | undefined {
  const fromInt = from instanceof IntType || from === PrimitiveType.INT || from === PrimitiveType.BIGINT;
  if (fromInt && to instanceof IntType) {
    const fits = from instanceof IntType && (from.signed === to.signed ? to.bits >= from.bits
      : !from.signed && to.bits > from.bits);
    return fits ? [] : compileIntTruncation(to, nonNegative);
  }
  if (fromInt && to instanceof BytesType && to.bound !== undefined) {
    // NUM2BIN to 33 bytes fits any word; drop its sign byte, then keep the leading N big-endian bytes.
    const word: Script = nonNegative ? [] : compileIntTruncation(new IntType(false, 256), false);
    const lead: Script = to.bound < 32 ? [encodeInt(BigInt(to.bound)), Op.OP_SPLIT, Op.OP_DROP] : [];
    return [...word, encodeInt(33n), Op.OP_NUM2BIN, Op.OP_REVERSEBYTES, Op.OP_1, Op.OP_SPLIT, Op.OP_NIP, ...lead];
  }
  if (from instanceof BytesType && from.bound !== undefined && to instanceof IntType) {
    const align: Script = from.bound < 32 ? [encodeInt(BigInt(8 * (32 - from.bound))), Op.OP_LSHIFTNUM] : [];
    const narrow: Script = to.signed || to.bits < 256 ? compileIntTruncation(to, true) : [];
    return [Op.OP_REVERSEBYTES, new Uint8Array([0x00]), Op.OP_CAT, Op.OP_BIN2NUM, ...align, ...narrow];
  }
  return undefined;
}

const GLOBAL_FUNCTION_SCRIPT: Record<GlobalFunction, Script> = {
  [GlobalFunction.ABS]: [Op.OP_ABS],
  [GlobalFunction.CHECKDATASIG]: [Op.OP_CHECKDATASIG],
  [GlobalFunction.CHECKMULTISIG]: [Op.OP_CHECKMULTISIG],
  [GlobalFunction.CHECKSIG]: [Op.OP_CHECKSIG],
  [GlobalFunction.MAX]: [Op.OP_MAX],
  [GlobalFunction.MIN]: [Op.OP_MIN],
  [GlobalFunction.RIPEMD160]: [Op.OP_RIPEMD160],
  [GlobalFunction.SHA1]: [Op.OP_SHA1],
  [GlobalFunction.SHA256]: [Op.OP_SHA256],
  [GlobalFunction.HASH160]: [Op.OP_HASH160],
  [GlobalFunction.HASH256]: [Op.OP_HASH256],
  [GlobalFunction.WITHIN]: [Op.OP_WITHIN],
  [GlobalFunction.TO_PADDED_BYTES]: [Op.OP_NUM2BIN],
  // intToString/stringToInt/addmod/mulmod/keccak256 are handled directly in visitFunctionCall, not here
  [GlobalFunction.INT_TO_STRING]: [],
  [GlobalFunction.STRING_TO_INT]: [],
  [GlobalFunction.ADDMOD]: [],
  [GlobalFunction.MULMOD]: [],
  [GlobalFunction.KECCAK256]: [],
  // blockhash/blobhash/ecrecover are handled directly in visitFunctionCall (oracle read / bytes32(0) /
  // checkDataSig + P2PKH build)
  [GlobalFunction.BLOCKHASH]: [],
  [GlobalFunction.BLOBHASH]: [],
  // ecrecoverPubKey/P2pkh/Evm are handled directly in visitFunctionCall (recovery side-car read).
  [GlobalFunction.ECRECOVER_PUBKEY]: [],
  [GlobalFunction.ECRECOVER_P2PKH]: [],
  [GlobalFunction.ECRECOVER_EVM]: [],
};

export function compileGlobalFunction(fn: GlobalFunction): Script {
  return GLOBAL_FUNCTION_SCRIPT[fn];
}

const BINARY_OP_SCRIPT: Record<BinaryOperator, Script> = {
  [BinaryOperator.POW]: [], // Handled specially in GenerateTargetTraversal.visitBinaryOp
  [BinaryOperator.MUL]: [Op.OP_MUL],
  [BinaryOperator.DIV]: [Op.OP_DIV],
  [BinaryOperator.MOD]: [Op.OP_MOD],
  [BinaryOperator.PLUS]: [Op.OP_CAT],
  [BinaryOperator.MINUS]: [Op.OP_SUB],
  [BinaryOperator.SHIFT_LEFT]: [Op.OP_LSHIFTBIN],
  [BinaryOperator.SHIFT_RIGHT]: [Op.OP_RSHIFTBIN],
  [BinaryOperator.BIT_AND]: [Op.OP_AND],
  [BinaryOperator.BIT_OR]: [Op.OP_OR],
  [BinaryOperator.BIT_XOR]: [Op.OP_XOR],
  [BinaryOperator.LT]: [Op.OP_LESSTHAN],
  [BinaryOperator.LE]: [Op.OP_LESSTHANOREQUAL],
  [BinaryOperator.GT]: [Op.OP_GREATERTHAN],
  [BinaryOperator.GE]: [Op.OP_GREATERTHANOREQUAL],
  [BinaryOperator.EQ]: [Op.OP_EQUAL],
  [BinaryOperator.NE]: [Op.OP_EQUAL, Op.OP_NOT],
  [BinaryOperator.AND]: [Op.OP_BOOLAND],
  [BinaryOperator.OR]: [Op.OP_BOOLOR],
  [BinaryOperator.SPLIT]: [Op.OP_SPLIT],
};

const NUMERIC_BINARY_OP_SCRIPT: Partial<Record<BinaryOperator, Script>> = {
  [BinaryOperator.PLUS]: [Op.OP_ADD],
  [BinaryOperator.EQ]: [Op.OP_NUMEQUAL],
  [BinaryOperator.NE]: [Op.OP_NUMNOTEQUAL],
  [BinaryOperator.SHIFT_LEFT]: [Op.OP_LSHIFTNUM],
  [BinaryOperator.SHIFT_RIGHT]: [Op.OP_RSHIFTNUM],
};

export function compileBinaryOp(op: BinaryOperator, numeric: boolean = false): Script {
  return (numeric && NUMERIC_BINARY_OP_SCRIPT[op]) || BINARY_OP_SCRIPT[op];
}

const UNARY_OP_SCRIPT = {
  [UnaryOperator.NOT]: [Op.OP_NOT],
  [UnaryOperator.NEGATE]: [Op.OP_NEGATE],
  [UnaryOperator.INVERT]: [Op.OP_INVERT],
  [UnaryOperator.SIZE]: [Op.OP_SIZE, Op.OP_NIP],
  [UnaryOperator.REVERSE]: [Op.OP_REVERSEBYTES],
  [UnaryOperator.INPUT_VALUE]: [Op.OP_UTXOVALUE],
  [UnaryOperator.INPUT_LOCKING_BYTECODE]: [Op.OP_UTXOBYTECODE],
  [UnaryOperator.INPUT_OUTPOINT_HASH]: [Op.OP_OUTPOINTTXHASH],
  [UnaryOperator.INPUT_OUTPOINT_INDEX]: [Op.OP_OUTPOINTINDEX],
  [UnaryOperator.INPUT_UNLOCKING_BYTECODE]: [Op.OP_INPUTBYTECODE],
  [UnaryOperator.INPUT_SEQUENCE_NUMBER]: [Op.OP_INPUTSEQUENCENUMBER],
  [UnaryOperator.OUTPUT_VALUE]: [Op.OP_OUTPUTVALUE],
  [UnaryOperator.OUTPUT_LOCKING_BYTECODE]: [Op.OP_OUTPUTBYTECODE],
  [UnaryOperator.INPUT_TOKEN_CATEGORY]: [Op.OP_UTXOTOKENCATEGORY],
  [UnaryOperator.INPUT_NFT_COMMITMENT]: [Op.OP_UTXOTOKENCOMMITMENT],
  [UnaryOperator.INPUT_TOKEN_AMOUNT]: [Op.OP_UTXOTOKENAMOUNT],
  [UnaryOperator.OUTPUT_TOKEN_CATEGORY]: [Op.OP_OUTPUTTOKENCATEGORY],
  [UnaryOperator.OUTPUT_NFT_COMMITMENT]: [Op.OP_OUTPUTTOKENCOMMITMENT],
  [UnaryOperator.OUTPUT_TOKEN_AMOUNT]: [Op.OP_OUTPUTTOKENAMOUNT],
};

export function compileUnaryOp(op: UnaryOperator): Op[] {
  // Postfix `++`/`--` are lowered by DesugarPostfixExpressions before codegen; reaching here is a bug.
  if (op === UnaryOperator.POSTFIX_INCREMENT || op === UnaryOperator.POSTFIX_DECREMENT) {
    throw new Error(`postfix '${op}' reached codegen; it must be desugared before semantic analysis`);
  }
  return UNARY_OP_SCRIPT[op as keyof typeof UNARY_OP_SCRIPT];
}

// Returns true if the type has a fixed byte width (suitable for abi.encodePacked).
// StructType is excluded: struct construction uses pushdata framing (variable-length
// prefixes per field), so the actual blob size differs from the sum of raw field widths.
export function isFixedWidthType(type: Type): boolean {
  if (type === PrimitiveType.BOOL) return true;
  if (type === PrimitiveType.PUBKEY) return true;
  if (type instanceof BytesType && type.bound !== undefined) return true;
  if (type instanceof IntType) return true;
  if (type instanceof FixedType) return true;
  // A bounded array of fixed-width elements is fixed-width (a `uint256[N]` row is bound * elementWidth bytes),
  // so a fixed-inner nested array `uint256[N][]` chunk-packs as a dynamic array of fixed-width rows.
  if (type instanceof ArrayType) return type.bound !== undefined && isFixedWidthType(type.elementType);
  // StructType intentionally excluded - uses pushdata encoding, not packed
  return false; // int, bytes (unbounded), string, struct
}

/**
 * Whether an array element type is DYNAMICALLY ENCODED: `string`, unbounded `bytes`, an unbounded array, or a
 * composite (struct / bounded array) holding one of those anywhere.
 *
 * Solidity refuses index-range access (`x[start:end]`) on an array with a dynamically encoded base type
 * (TypeError 2148), so there is no source access to lower and the compiler must refuse it too - for a fixed-stride
 * element because there is no stride, and for a framed one because a dynamically encoded element has no frame
 * boundary the scan can stop at.
 */
export function isDynamicallyEncodedElementType(type: Type): boolean {
  if (type === PrimitiveType.STRING) return true;
  if (type instanceof BytesType) return type.bound === undefined;
  if (type instanceof ArrayType) {
    return type.bound === undefined || isDynamicallyEncodedElementType(type.elementType);
  }
  if (type instanceof StructType) {
    return type.fields.some((field) => isDynamicallyEncodedElementType(field.type));
  }
  return false;
}

// Returns the fixed byte width for bounded types. Only valid when isFixedWidthType is true.
export function getFixedWidth(type: Type): number {
  if (type === PrimitiveType.BOOL) return 1;
  if (type === PrimitiveType.PUBKEY) return 33;
  if (type instanceof BytesType && type.bound !== undefined) return type.bound;
  if (type instanceof IntType) return type.byteWidth;
  if (type instanceof FixedType) return type.byteWidth;
  if (type instanceof StructType) {
    return type.fields.reduce((sum, f) => sum + getFixedWidth(f.type), 0);
  }
  if (type instanceof ArrayType && type.bound !== undefined) return type.bound * getFixedWidth(type.elementType);
  throw new Error(`Type is not fixed-width: ${type}`);
}

// Legacy alias - used during transition
export function getElementWidth(type: Type): number {
  return getFixedWidth(type);
}

const NULLARY_OP_SCRIPT: Record<string, Op[]> = {
  [NullaryOperator.INPUT_INDEX]: [Op.OP_INPUTINDEX],
  [NullaryOperator.BYTECODE]: [Op.OP_ACTIVEBYTECODE],
  // The active input's own state-NFT category (capability byte appended for mutable/minting NFTs).
  [NullaryOperator.CATEGORY_ID]: [Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCATEGORY],
  [NullaryOperator.INPUT_COUNT]: [Op.OP_TXINPUTCOUNT],
  [NullaryOperator.OUTPUT_COUNT]: [Op.OP_TXOUTPUTCOUNT],
  [NullaryOperator.VERSION]: [Op.OP_TXVERSION],
  [NullaryOperator.LOCKTIME]: [Op.OP_TXLOCKTIME],
  [NullaryOperator.MSG_SENDER]: [],  // handled inline in GenerateTargetTraversal
  [NullaryOperator.MSG_VALUE]: [],   // handled inline in GenerateTargetTraversal
  [NullaryOperator.MSG_SIG]: [],     // handled inline in GenerateTargetTraversal
  [NullaryOperator.MSG_DATA]: [],    // handled inline in GenerateTargetTraversal
  [NullaryOperator.TX_ORIGIN]: [],   // handled inline in GenerateTargetTraversal
};

export function compileNullaryOp(op: NullaryOperator): Op[] {
  return NULLARY_OP_SCRIPT[op];
}
