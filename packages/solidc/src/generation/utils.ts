import {
  AddressType,
  BytesType,
  EnumType,
  FixedType,
  IntType,
  ValueType,
  encodeInt,
  Op,
  PrimitiveType,
  Script,
  StructType,
  Type,
} from '@solidcash/utils';
import { UnaryOperator, BinaryOperator, NullaryOperator } from '../ast/Operator.js';
import { GlobalFunction, TimeOp } from '../ast/Globals.js';

export function compileTimeOp(op: TimeOp): Script {
  const mapping = {
    [TimeOp.CHECK_LOCKTIME]: [Op.OP_CHECKLOCKTIMEVERIFY, Op.OP_DROP],
    [TimeOp.CHECK_SEQUENCE]: [Op.OP_CHECKSEQUENCEVERIFY, Op.OP_DROP],
  };

  return mapping[op];
}

export function compileCast(from: Type, to: Type, isUnsafe: boolean): Script {
  // INT (integer literal/generic) shares the unbounded VM representation of BIGINT.
  if (from === PrimitiveType.INT) from = PrimitiveType.BIGINT;
  if (to === PrimitiveType.INT) to = PrimitiveType.BIGINT;
  // unsafe() casts intentionally skip ALL conversion opcodes (not just bounds checks).
  // This is by design: the developer asserts the raw stack value is already correct.
  // Examples: unsafe_int(bytes) skips OP_BIN2NUM, unsafe_bool(int) skips OP_0NOTEQUAL.
  // Bounds checks are separately gated in visitCast (GenerateTargetTraversal).
  if (isUnsafe) return [];

  // ValueType wrapping/unwrapping is zero-cost (no-op at VM level)
  if (from instanceof ValueType) return compileCast(from.underlyingType, to, isUnsafe);
  if (to instanceof ValueType) return compileCast(from, to.underlyingType, isUnsafe);

  // string -> bytes: no-op (already bytes at VM level)
  if (from === PrimitiveType.STRING && to instanceof BytesType) return [];
  // bytes -> string: no-op
  if (from instanceof BytesType && to === PrimitiveType.STRING) return [];

  if (from === PrimitiveType.BIGINT && to instanceof BytesType && to.bound !== undefined) {
    return [encodeInt(BigInt(to.bound)), Op.OP_NUM2BIN];
  }
  // int -> unbounded bytes: no-op (VM number is already bytes)
  if (from === PrimitiveType.BIGINT && to instanceof BytesType && to.bound === undefined) return [];

  if (from === PrimitiveType.BIGINT && to === PrimitiveType.BOOL) {
    return [Op.OP_0NOTEQUAL];
  }

  // bool -> int: no-op (bool 0/1 is already a valid int)
  if (from === PrimitiveType.BOOL && to === PrimitiveType.BIGINT) return [];

  if (from instanceof BytesType && to === PrimitiveType.BIGINT) {
    return [Op.OP_BIN2NUM];
  }

  // int -> IntType: no opcode needed, bounds check emitted by caller
  if (from === PrimitiveType.BIGINT && to instanceof IntType) return [];
  // IntType -> int: no-op (already a valid VM number)
  if (from instanceof IntType && to === PrimitiveType.BIGINT) return [];
  // IntType -> IntType: no-op, bounds check emitted by caller
  if (from instanceof IntType && to instanceof IntType) return [];
  // IntType -> BytesType: same as int -> bytes
  if (from instanceof IntType && to instanceof BytesType && to.bound !== undefined) {
    return [encodeInt(BigInt(to.bound)), Op.OP_NUM2BIN];
  }
  // BytesType -> IntType: same as bytes -> int, bounds check emitted by caller
  if (from instanceof BytesType && to instanceof IntType) return [Op.OP_BIN2NUM];
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

  // BytesType -> BytesType: equal bounds or an unbounded side is a no-op (same representation).
  // Shrinking keeps the leftmost M bytes (Solidity left-aligned truncation); widening right-pads
  // with (M-N) zero bytes. e.g. bytes4(keccak256(x)) -> first 4 bytes of the hash.
  if (from instanceof BytesType && to instanceof BytesType) {
    if (from.bound === undefined || to.bound === undefined || from.bound === to.bound) return [];
    if (to.bound < from.bound) return [encodeInt(BigInt(to.bound)), Op.OP_SPLIT, Op.OP_DROP];
    return [new Uint8Array(to.bound - from.bound), Op.OP_CAT];
  }

  // IntType/FixedType -> unbounded bytes: no-op (VM number is already bytes)
  if ((from instanceof IntType || from instanceof FixedType) && to instanceof BytesType && to.bound === undefined) {
    return [];
  }

  // StructType -> StructType: no-op (same blob at VM level)
  if (from instanceof StructType && to instanceof StructType) return [];

  // Solidity-compat narrowing casts: `bytes20(address)` / `uint160(address)`. A SolidCash address is a
  // variable-length locking bytecode, not a 20-byte value, so we narrow to the embedded 20-byte hash (the
  // P2PKH pubkey-hash at offset 3: 0x76a914 <20-byte hash> 0x88ac) first. This is lossy and warned in
  // TypeCheckTraversal. Only bytes20 and int targets narrow; `bytes(address)` keeps the full locking bytecode.
  const narrowAddressTo20 = [encodeInt(3n), Op.OP_SPLIT, Op.OP_NIP, encodeInt(20n), Op.OP_SPLIT, Op.OP_DROP];
  if (from instanceof AddressType && to instanceof BytesType && to.bound === 20) {
    return narrowAddressTo20;
  }
  if (from instanceof AddressType && to instanceof IntType) {
    // OP_BIN2NUM reads a sign-magnitude little-endian number; for unsigned targets append a 0x00 sign byte so
    // the hash is a non-negative value (otherwise ~half of hashes fail the uint's >= 0 bounds check).
    return to.signed
      ? [...narrowAddressTo20, Op.OP_BIN2NUM]
      : [...narrowAddressTo20, new Uint8Array([0]), Op.OP_CAT, Op.OP_BIN2NUM];
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

export function compileGlobalFunction(fn: GlobalFunction): Script {
  const mapping = {
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
    [GlobalFunction.ECRECOVER]: [],
  };

  return mapping[fn];
}

export function compileBinaryOp(op: BinaryOperator, numeric: boolean = false): Script {
  const mapping: { [key in BinaryOperator]: Script } = {
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

  if (numeric) {
    mapping[BinaryOperator.PLUS] = [Op.OP_ADD];
    mapping[BinaryOperator.EQ] = [Op.OP_NUMEQUAL];
    mapping[BinaryOperator.NE] = [Op.OP_NUMNOTEQUAL];
    mapping[BinaryOperator.SHIFT_LEFT] = [Op.OP_LSHIFTNUM];
    mapping[BinaryOperator.SHIFT_RIGHT] = [Op.OP_RSHIFTNUM];
  }

  return mapping[op];
}

export function compileUnaryOp(op: UnaryOperator): Op[] {
  const mapping = {
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

  return mapping[op];
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
  // StructType intentionally excluded - uses pushdata encoding, not packed
  return false; // int, bytes (unbounded), string, struct
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
  throw new Error(`Type is not fixed-width: ${type}`);
}

// Legacy alias - used during transition
export function getElementWidth(type: Type): number {
  return getFixedWidth(type);
}

export function compileNullaryOp(op: NullaryOperator): Op[] {
  const mapping: Record<string, Op[]> = {
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

  return mapping[op];
}
