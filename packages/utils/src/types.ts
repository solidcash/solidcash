export type Type =
  | PrimitiveType | ArrayType | TupleType | BytesType | IntType | FixedType
  | MappingType | StructType | TokenContainerType | EnumType
  | AddressType | ValueType | FunctionType;

export class TokenContainerType {
  toString(): string { return 'tokenContainer'; }
}

export class AddressType {
  // interfaceName: contract/interface this address was typed as (e.g. `IERC20 token`), so `token.method(..)`
  // can route to an external call. Metadata only - typesEqual/castability ignore it (an address is an address).
  constructor(public payable: boolean = false, public interfaceName?: string) {}
  toString(): string { return this.payable ? 'address payable' : 'address'; }
}

export class ArrayType {
  constructor(
    public elementType: Type,
    public bound?: number,
  ) { }

  toString(): string {
    return `${this.elementType}[${this.bound ?? ''}]`;
  }
}

export class BytesType {
  constructor(
    public bound?: number,
  ) { }

  static fromString(str: string): BytesType {
    if (str === 'byte') return new BytesType(1);
    if (str === 'bytes') return new BytesType();
    const boundStr = str.substring(5);
    const bound = Number.parseInt(boundStr, 10);
    if (Number.isNaN(bound) || bound.toString() !== boundStr) {
      throw new Error(`Invalid bytes type bound: "${str}"`);
    }
    return new BytesType(bound);
  }

  toString(): string {
    return `bytes${this.bound ?? ''}`;
  }
}

export class IntType {
  constructor(
    public signed: boolean,
    public bits: number, // Must be multiple of 8, 8-256
  ) {}

  get minValue(): bigint {
    return this.signed ? -(1n << BigInt(this.bits - 1)) : 0n;
  }

  get maxValue(): bigint {
    return this.signed
      ? (1n << BigInt(this.bits - 1)) - 1n
      : (1n << BigInt(this.bits)) - 1n;
  }

  // Sign-magnitude byte width for OP_NUM2BIN encoding
  // Need 1 extra bit for sign in sign-magnitude format
  get byteWidth(): number {
    return Math.ceil((this.bits + 1) / 8);
  }

  toString(): string {
    return `${this.signed ? 'int' : 'uint'}${this.bits}`;
  }

  static isValidBitWidth(bits: number): boolean {
    return bits >= 8 && bits <= 256 && bits % 8 === 0;
  }
}

export class FixedType {
  readonly scaleFactor: bigint;

  constructor(
    public signed: boolean,
    public bits: number,     // M - total bit width (8-256, step 8)
    public decimals: number, // N - decimal places (0-80)
  ) {
    this.scaleFactor = 10n ** BigInt(decimals);
  }

  get minValue(): bigint {
    return this.signed ? -(1n << BigInt(this.bits - 1)) : 0n;
  }

  get maxValue(): bigint {
    return this.signed
      ? (1n << BigInt(this.bits - 1)) - 1n
      : (1n << BigInt(this.bits)) - 1n;
  }

  get byteWidth(): number {
    return Math.ceil((this.bits + 1) / 8);
  }

  toString(): string {
    return `${this.signed ? 'fixed' : 'ufixed'}${this.bits}x${this.decimals}`;
  }

  static isValidBitWidth(bits: number): boolean {
    return bits >= 8 && bits <= 256 && bits % 8 === 0;
  }

  static isValidDecimals(decimals: number): boolean {
    return decimals >= 0 && decimals <= 80 && Number.isInteger(decimals);
  }
}

export class MappingType {
  constructor(
    public keyType: Type,
    public valueType: Type,
    public keyName?: string,
    public valueName?: string,
  ) { }

  toString(): string {
    return `mapping(${this.keyType} => ${this.valueType})`;
  }

  toSourceString(): string {
    const keyPart = this.keyName ? `${this.keyType} ${this.keyName}` : `${this.keyType}`;
    const valStr = this.valueType instanceof MappingType
      ? this.valueType.toSourceString()
      : this.valueName
        ? `${this.valueType} ${this.valueName}`
        : `${this.valueType}`;
    return `mapping(${keyPart} => ${valStr})`;
  }
}

export class StructType {
  constructor(
    public name: string,
    public fields: { name: string; type: Type }[],
  ) {}

  toString(): string { return this.name; }
}

export class EnumType {
  constructor(
    public name: string,
    public members: { name: string; value: bigint }[],
  ) {}

  toString(): string { return this.name; }
}

export class ValueType {
  constructor(
    public readonly name: string,
    public readonly underlyingType: BytesType | IntType | PrimitiveType,
  ) {}

  toString(): string { return this.name; }
}

export class TupleType {
  constructor(
    public elements: Type[],
  ) { }

  get leftType(): Type { return this.elements[0]; }
  get rightType(): Type { return this.elements[1]; }

  toString(): string {
    return `(${this.elements.map((e) => e.toString()).join(', ')})`;
  }
}

// Internal function type (function pointer). At the VM level a value of this type is the target's
// integer functionId; an indirect call is `<functionId> OP_INVOKE`. Internal-only (no external/ABI).
export class FunctionType {
  constructor(
    public parameterTypes: Type[],
    public returnTypes: Type[],
  ) {}

  toString(): string {
    const params = this.parameterTypes.map((t) => t.toString()).join(',');
    const base = `function(${params})`;
    if (this.returnTypes.length === 0) return base;
    return `${base}returns(${this.returnTypes.map((t) => t.toString()).join(',')})`;
  }
}

export enum PrimitiveType {
  // INT: integer-literal / generic-integer type (`5`); implicitly converts to any bounded IntType and to
  // BIGINT, and is normalized to BIGINT in the type-helper functions. BIGINT: explicit arbitrary-precision
  // type (keyword `bigint`). The `int`/`uint` keywords are IntType(.,256), not INT.
  INT = 'int',
  BIGINT = 'bigint',
  BOOL = 'bool',
  STRING = 'string',
  // ADDRESS = 'address',
  PUBKEY = 'pubkey',
  SIG = 'sig',
  DATASIG = 'datasig',
  ANY = 'any',
  VOID = 'void',
}

const ExplicitlyCastableTo: { [key in PrimitiveType]: PrimitiveType[] } = {
  [PrimitiveType.INT]: [PrimitiveType.INT, PrimitiveType.BIGINT, PrimitiveType.BOOL],
  [PrimitiveType.BIGINT]: [PrimitiveType.BIGINT, PrimitiveType.INT, PrimitiveType.BOOL],
  [PrimitiveType.BOOL]: [PrimitiveType.BOOL, PrimitiveType.BIGINT],
  [PrimitiveType.STRING]: [PrimitiveType.STRING],
  [PrimitiveType.PUBKEY]: [PrimitiveType.PUBKEY],
  [PrimitiveType.SIG]: [PrimitiveType.SIG],
  [PrimitiveType.DATASIG]: [PrimitiveType.DATASIG],
  [PrimitiveType.ANY]: [],
  [PrimitiveType.VOID]: [],
};

function typesEqual(a: Type, b?: Type): boolean {
  if (!b) return false;
  // INT (integer literal/generic) is interchangeable with BIGINT (unbounded) at the type level.
  if (a === PrimitiveType.INT) a = PrimitiveType.BIGINT;
  if (b === PrimitiveType.INT) b = PrimitiveType.BIGINT;
  if (a === b) return true; // PrimitiveType enum comparison
  if (a instanceof BytesType && b instanceof BytesType) return a.bound === b.bound;
  if (a instanceof IntType && b instanceof IntType) return a.signed === b.signed && a.bits === b.bits;
  if (a instanceof FixedType && b instanceof FixedType) {
    return a.signed === b.signed && a.bits === b.bits && a.decimals === b.decimals;
  }
  if (a instanceof ArrayType && b instanceof ArrayType) {
    return a.bound === b.bound && typesEqual(a.elementType, b.elementType);
  }
  if (a instanceof TupleType && b instanceof TupleType) {
    return a.elements.length === b.elements.length
      && a.elements.every((el, i) => typesEqual(el, b.elements[i]));
  }
  if (a instanceof MappingType && b instanceof MappingType) {
    return typesEqual(a.keyType, b.keyType) && typesEqual(a.valueType, b.valueType);
  }
  if (a instanceof StructType && b instanceof StructType) {
    return a.name === b.name && a.fields.length === b.fields.length
      && a.fields.every((f, i) => f.name === b.fields[i].name && typesEqual(f.type, b.fields[i].type));
  }
  if (a instanceof EnumType && b instanceof EnumType) {
    return a.name === b.name && a.members.length === b.members.length
      && a.members.every((m, i) => m.name === b.members[i].name && m.value === b.members[i].value);
  }
  if (a instanceof ValueType && b instanceof ValueType) {
    return a.name === b.name && typesEqual(a.underlyingType, b.underlyingType);
  }
  if (a instanceof AddressType && b instanceof AddressType) return a.payable === b.payable;
  if (a instanceof TokenContainerType && b instanceof TokenContainerType) return true;
  return a.toString() === b.toString();
}

export function explicitlyCastable(from?: Type, to?: Type): boolean {
  if (!from || !to) return false;
  // INT (integer literal/generic) behaves as BIGINT (unbounded) for casting.
  if (from === PrimitiveType.INT) from = PrimitiveType.BIGINT;
  if (to === PrimitiveType.INT) to = PrimitiveType.BIGINT;

  // ValueType: only allow wrap (underlying -> value type) and unwrap (value type -> underlying)
  if (from instanceof ValueType || to instanceof ValueType) {
    if (from instanceof ValueType && to instanceof ValueType) return false; // no cross-value-type casts
    if (from instanceof ValueType) return typesEqual(from.underlyingType, to);
    if (to instanceof ValueType) return typesEqual(from, to.underlyingType);
    return false;
  }

  // Token containers can't be cast
  if (from instanceof TokenContainerType || to instanceof TokenContainerType) return false;

  // Address type explicit casts
  if (to instanceof AddressType) {
    // bytes -> address (non-payable only via address() cast)
    if (from instanceof BytesType && !to.payable) return true;
    // address -> address (any payable combo, including contract type constructors)
    if (from instanceof AddressType) return true;
    // int -> address: `address(0)` / `address(uint160(x))`. Address is locking bytecode at the VM level;
    // the integer is converted to its byte representation.
    if (from === PrimitiveType.BIGINT || from instanceof IntType) return true;
    return false;
  }
  if (from instanceof AddressType) {
    // address -> bytes (address is lbc bytes at VM level)
    if (to instanceof BytesType) return true;
    // address -> int: Solidity-compat `uint160(address)`. Narrows the (variable-length) address to 20 bytes
    // first; see compileCast. Address is not a fixed-width number on BCH, so this is lossy (warned).
    if (to instanceof IntType) return true;
    return false;
  }

  // Mappings can't be cast
  if (from instanceof MappingType || to instanceof MappingType) return false;

  // Structs can't be cast
  if (from instanceof StructType || to instanceof StructType) return false;

  // Enums are int-backed: allow explicit enum <-> int conversions (int -> enum is range-checked at
  // codegen). Enum <-> enum is still disallowed.
  if (from instanceof EnumType || to instanceof EnumType) {
    if (from instanceof EnumType && to instanceof EnumType) return false;
    const isInt = (t: Type): boolean => t === PrimitiveType.BIGINT || t instanceof IntType;
    return from instanceof EnumType ? isInt(to) : isInt(from);
  }

  // Tuples can't be cast
  if (from instanceof TupleType || to instanceof TupleType) return false;

  // Arrays can be cast if their elements can be cast (don't think this is actually used ever)
  if (from instanceof ArrayType && to instanceof ArrayType) {
    return explicitlyCastable(from.elementType, to.elementType);
  }

  // Can't cast between Array and non-Array
  if (from instanceof ArrayType || to instanceof ArrayType) return false;

  if (to instanceof BytesType) {
    // Can't cast bool to bytes
    if (from === PrimitiveType.BOOL) return false;
    // Can cast int to any size bytes
    if (from === PrimitiveType.BIGINT) return true;
    // Can cast bounded int to any size bytes (same as int -> bytes)
    if (from instanceof IntType) return true;
    // Can cast fixed to any size bytes (same as int -> bytes, since stored as scaled int)
    if (from instanceof FixedType) return true;

    // Can freely cast to unbounded bytes
    if (!to.bound) return true;

    if (from instanceof BytesType) {
      // bytesN -> bytesM is always castable (Solidity semantics): equal/unbounded is a no-op,
      // shrinking truncates the leftmost bytes, widening right-pads with zeros. e.g.
      // bytes4(keccak256(x)) for a function selector.
      return true;
    }

    // string -> bytes: allowed (string is UTF-8 bytes)
    if (from === PrimitiveType.STRING) return true;

    // Cannot cast other primitive types directly to bounded bytes types
    return false;
  }

  if (from instanceof BytesType) {
    // Can cast unbounded bytes or <=4 bytes to int
    if (to === PrimitiveType.BIGINT) return !from.bound || from.bound <= 8;
    // bytes -> IntType (like bytes -> int, with BIN2NUM)
    if (to instanceof IntType) return true;
    // bytes -> FixedType (like bytes -> int, with BIN2NUM)
    if (to instanceof FixedType) return true;
    // Can't cast bytes to bool
    if (to === PrimitiveType.BOOL) return false;
    // bytes -> string: allowed (string is UTF-8 bytes)
    if (to === PrimitiveType.STRING) return true;
    // Can cast any bytes to pubkey, sig, datasig
    if (to === PrimitiveType.PUBKEY) return true;
    if (to === PrimitiveType.SIG) return true;
    if (to === PrimitiveType.DATASIG) return true;
    return true;
  }

  // IntType explicit cast rules
  if (from instanceof IntType) {
    if (to === PrimitiveType.BIGINT) return true;
    if (to instanceof IntType) return true;
    if (to === PrimitiveType.BOOL) return true;
    if (to instanceof FixedType) return true; // IntType -> FixedType (scale by scaleFactor)
    // IntType -> BytesType is handled above (to instanceof BytesType check)
    return false;
  }
  if (to instanceof IntType) {
    if (from === PrimitiveType.BIGINT) return true;
    if (from === PrimitiveType.BOOL) return true;
    if (from instanceof FixedType) return true; // FixedType -> IntType (divide by scaleFactor)
    return false;
  }

  // FixedType explicit cast rules
  // Note: FixedType -> BytesType is handled above in the `to instanceof BytesType` block
  if (from instanceof FixedType) {
    if (to instanceof FixedType) return true;   // any FixedType -> any FixedType
    if (to === PrimitiveType.BIGINT) return true;   // FixedType -> int (divide by scaleFactor)
    if (to === PrimitiveType.BOOL) return true;  // FixedType -> bool (non-zero check)
    return false;
  }
  if (to instanceof FixedType) {
    if (from === PrimitiveType.BIGINT) return true;  // int -> FixedType (scale by scaleFactor)
    if (from === PrimitiveType.BOOL) return true;
    return false;
  }

  // class-based types (function/enum/array/struct/...) are not in the primitive cast table
  if (typeof from !== 'string' || typeof to !== 'string') return false;
  return ExplicitlyCastableTo[from].includes(to);
}

export function implicitlyCastable(actual?: Type, expected?: Type): boolean {
  if (!actual || !expected) return false;
  // INT (integer literal/generic) behaves as BIGINT (unbounded): casts to any IntType and to bigint.
  if (actual === PrimitiveType.INT) actual = PrimitiveType.BIGINT;
  if (expected === PrimitiveType.INT) expected = PrimitiveType.BIGINT;

  // ValueType: only the same value type is implicitly castable to itself
  if (actual instanceof ValueType || expected instanceof ValueType) {
    if (actual instanceof ValueType && expected instanceof ValueType) {
      return actual.name === expected.name;
    }
    return false;
  }

  // Function types: only an exact structural match casts (and never to/from anything else, so a raw
  // int can't become a function pointer). Compared via toString, which encodes params + returns.
  if (actual instanceof FunctionType || expected instanceof FunctionType) {
    return actual instanceof FunctionType && expected instanceof FunctionType
      && actual.toString() === expected.toString();
  }

  // Token containers can't be implicitly cast
  if (actual instanceof TokenContainerType || expected instanceof TokenContainerType) return false;

  // Address type implicit casts
  if (actual instanceof AddressType && expected instanceof AddressType) {
    // payable -> non-payable: OK; non-payable -> non-payable: OK; payable -> payable: OK
    // non-payable -> payable: NOT OK (must use explicit payable() cast)
    if (expected.payable && !actual.payable) return false;
    return true;
  }
  if (actual instanceof AddressType && expected instanceof BytesType) {
    // address -> unbounded bytes: OK (address is lbc bytes at VM level)
    return !expected.bound;
  }
  // bytes -> address: address literals (`0x...`) and lbc bytes assign to a non-payable address.
  if (actual instanceof BytesType && expected instanceof AddressType) return !expected.payable;
  // Can't implicitly cast to/from address types in other cases
  if (actual instanceof AddressType || expected instanceof AddressType) return false;

  // Mappings can't be implicitly cast
  if (actual instanceof MappingType || expected instanceof MappingType) return false;

  // Enums are int-backed: implicitly compatible with int types and the same enum (not other enums).
  if (actual instanceof EnumType || expected instanceof EnumType) {
    const intLike = (t: Type): boolean => t === PrimitiveType.BIGINT || t instanceof IntType;
    if (actual instanceof EnumType && expected instanceof EnumType) return actual.name === expected.name;
    return actual instanceof EnumType ? intLike(expected) : intLike(actual);
  }

  // Structs can only be implicitly cast to the same struct type
  if (actual instanceof StructType || expected instanceof StructType) {
    if (actual instanceof StructType && expected instanceof StructType) {
      return actual.name === expected.name;
    }
    return false;
  }

  if (actual instanceof TupleType && expected instanceof TupleType) {
    if (actual.elements.length !== expected.elements.length) return false;
    return actual.elements.every((el, i) => implicitlyCastable(el, expected.elements[i]));
  }

  // Can't cast between Tuple and non-Tuple
  if (actual instanceof TupleType || expected instanceof TupleType) return false;

  // Arrays can be cast if their elements can be cast and bounds are compatible
  if (actual instanceof ArrayType && expected instanceof ArrayType) {
    if (!implicitlyCastable(actual.elementType, expected.elementType)) return false;
    // Two bounded arrays must have matching bounds
    if (actual.bound !== undefined && expected.bound !== undefined) {
      return actual.bound === expected.bound;
    }
    return true;
  }

  // Can't cast between Array and non-Array
  if (actual instanceof ArrayType || expected instanceof ArrayType) return false;

  // Anything can be implicitly cast to ANY
  if (expected === PrimitiveType.ANY) return true;

  if (expected instanceof BytesType) {
    // Can't implicitly cast bool, int, bounded int, fixed to bytes
    if (actual === PrimitiveType.BOOL) return false;
    if (actual === PrimitiveType.BIGINT) return false;
    if (actual instanceof IntType) return false;
    if (actual instanceof FixedType) return false;
    // string -> unbounded bytes: allow implicit cast
    if (actual === PrimitiveType.STRING) return !expected.bound;

    // Can freely cast to unbounded bytes
    if (!expected.bound) return true;

    if (actual instanceof BytesType) {
      // Cannot implicitly cast from unbounded bytes
      if (!actual.bound) return false;
      // Can only cast bounded bytes to bounded bytes if bounds are equal
      return actual.bound === expected.bound;
    }

    // Cannot cast other primitive types directly to bounded bytes types
    return false;
  }

  // IntType -> PrimitiveType.BIGINT: widening to unbounded (always OK)
  if (actual instanceof IntType && expected === PrimitiveType.BIGINT) return true;

  // PrimitiveType.BIGINT -> IntType: the BCH VM has one unbounded integer, so bounded widths (uint256, int128,
  // ...) are nominal; int values and literals assign freely to them (matches Solidity ports using uintN).
  if (actual === PrimitiveType.BIGINT && expected instanceof IntType) return true;

  // IntType -> IntType: widening same-signedness or unsigned->wider-signed
  if (actual instanceof IntType && expected instanceof IntType) {
    if (actual.signed === expected.signed) return expected.bits >= actual.bits;
    // unsigned -> wider signed (needs strictly wider to fit all values)
    if (!actual.signed && expected.signed) return expected.bits > actual.bits;
    return false;
  }

  // FixedType -> PrimitiveType.BIGINT: widening to unbounded (always OK)
  if (actual instanceof FixedType && expected === PrimitiveType.BIGINT) return false;

  // FixedType -> FixedType: same decimals, wider bits, same signedness direction
  if (actual instanceof FixedType && expected instanceof FixedType) {
    if (actual.decimals !== expected.decimals) return false;
    if (actual.signed === expected.signed) return expected.bits >= actual.bits;
    if (!actual.signed && expected.signed) return expected.bits > actual.bits;
    return false;
  }

  // No implicit int <-> fixed (require explicit cast)
  if (actual instanceof FixedType || expected instanceof FixedType) return false;

  // unbounded bytes -> string: allow implicit cast
  if (actual instanceof BytesType && !actual.bound && expected === PrimitiveType.STRING) return true;

  // Other primitive types can only be implicitly cast to themselves
  return actual === expected;
}

function resultingTypeForArrayElements(left: Type | undefined, right: Type | undefined): Type | undefined {
  if (!left || !right) return undefined;

  if (implicitlyCastable(left, right)) return right;
  if (implicitlyCastable(right, left)) return left;
  if (left instanceof BytesType && right instanceof BytesType) {
    return new BytesType();
  }
  return undefined;
}

export function arrayType(types: Type[]): Type | undefined {
  if (types.length === 0) return undefined;
  let resType: Type | undefined = types[0];
  types.forEach((t) => {
    resType = resultingTypeForArrayElements(resType, t) as Type;
  });
  return resType;
}

export function implicitlyCastableSignature(
  actual: Type[],
  expected: Type[],
): boolean {
  if (actual.length !== expected.length) return false;
  return expected.every((t, i) => implicitlyCastable(actual[i], t));
}

export function parseType(str: string): Type {
  if (str === 'address payable' || str === 'addresspayable') return new AddressType(true);
  if (str === 'address') return new AddressType();

  // `bigint` is the arbitrary-precision native int (BCH VM integer). `int`/`uint` are Solidity-parity
  // aliases for int256/uint256 (bounded, fixed-width, overflow-checked).
  if (str === 'bigint') return PrimitiveType.BIGINT;
  if (str === 'int') return new IntType(true, 256);
  if (str === 'uint') return new IntType(false, 256);

  // Array types: int[5], int[], bytes20[], int[3][5], etc. Checked before the `byte`/`function` branches so
  // `bytes20[]` parses as an array of bytes20. lastIndexOf finds the outermost (rightmost) dimension.
  if (str.endsWith(']') && str.includes('[')) {
    const bracketIdx = str.lastIndexOf('[');
    const elementTypeStr = str.substring(0, bracketIdx);
    const boundStr = str.substring(bracketIdx + 1, str.length - 1);
    const elementType = parseType(elementTypeStr);
    const bound = boundStr ? parseInt(boundStr, 10) : undefined;
    return new ArrayType(elementType, bound);
  }

  if (str.startsWith('byte')) return BytesType.fromString(str);

  // Internal function type: function(<types>)[returns(<types>)] (whitespace already stripped).
  if (str.startsWith('function(')) return parseFunctionType(str);

  // mapping(KeyType => ValueType) - supports nested mappings
  if (str.startsWith('mapping(') && str.endsWith(')')) {
    const inner = str.slice(8, -1);
    const arrowIndex = findTopLevelArrow(inner);
    if (arrowIndex >= 0) {
      const keyStr = inner.slice(0, arrowIndex).trim();
      const valueStr = inner.slice(arrowIndex + 2).trim();
      return new MappingType(parseType(keyStr), parseType(valueStr));
    }
  }

  // Bounded integer types: int8, uint256, etc.
  const intMatch = str.match(/^(u?int)(\d+)$/);
  if (intMatch) {
    const signed = intMatch[1] === 'int';
    const bits = parseInt(intMatch[2], 10);
    if (IntType.isValidBitWidth(bits)) {
      return new IntType(signed, bits);
    }
  }

  // Fixed-point types: fixed128x18, ufixed64x8, etc.
  if (str === 'fixed') return new FixedType(true, 128, 18);
  if (str === 'ufixed') return new FixedType(false, 128, 18);
  const fixedMatch = str.match(/^(u?fixed)(\d+)x(\d+)$/);
  if (fixedMatch) {
    const signed = fixedMatch[1] === 'fixed';
    const bits = parseInt(fixedMatch[2], 10);
    const decimals = parseInt(fixedMatch[3], 10);
    if (FixedType.isValidBitWidth(bits) && FixedType.isValidDecimals(decimals)) {
      return new FixedType(signed, bits, decimals);
    }
  }

  // Returns undefined for unrecognized type strings (e.g., contract names).
  // Callers that need a guaranteed Type should use parseTypeStrict() instead.
  return PrimitiveType[str.toUpperCase() as keyof typeof PrimitiveType];
}

/** Like parseType but throws on unrecognized types (for SDK boundary validation). */
export function parseTypeStrict(str: string): Type {
  const result = parseType(str);
  if (result === undefined) {
    throw new Error(`Unrecognized type string "${str}"`);
  }
  return result;
}

/**
 * A type is fixed-width when its packed (tight) encoding is a constant number of bytes - the basis for the
 * flat-stream chunk-packed array (element `i` at byte offset `i * fixedWidthBytes`). Mirrors the compiler's
 * getFixedWidth/emitEncodeElementPacked. NOT fixed-width (value-dependent encoding): plain `int`, unbounded
 * `bytes`, `string`, and structs with any dynamic field. Accepts a Type or a type string.
 */
export function isFixedWidthType(type: Type | string): boolean {
  const t = typeof type === 'string' ? parseType(type) : type;
  if (t === undefined) return false;
  if (t === PrimitiveType.BOOL || t === PrimitiveType.PUBKEY) return true;
  if (t instanceof BytesType) return t.bound !== undefined;
  if (t instanceof IntType || t instanceof FixedType) return true;
  if (t instanceof StructType) return t.fields.every((f) => isFixedWidthType(f.type));
  // A bounded array of fixed-width elements is itself fixed-width (bound * elementWidth). This lets a fixed-inner
  // nested array (`uint256[N][]`) back a chunk-packed dynamic array whose element is the N-wide row.
  if (t instanceof ArrayType) return t.bound !== undefined && isFixedWidthType(t.elementType);
  return false;
}

/**
 * An array element type eligible for the chunk-packed backend. Fixed-width types (incl. fixed-width structs)
 * use the flat-stream layout (count = A$len/width). Variable-width leaves (plain `int`, `string`, unbounded
 * `bytes`) and variable-width structs use the framed layout: one dynamic value
 * `pushdata(count) ++ pushdata(elem_0) ++ ...`, accessed by scan. Nested-array elements are NOT yet
 * chunk-packable (they stay on the collection backend). Accepts a Type or a type string.
 */
export function isChunkPackableElementType(type: Type | string): boolean {
  const t = typeof type === 'string' ? parseType(type) : type;
  if (t === undefined) return false;
  if (isFixedWidthType(t)) return true;
  if (t === PrimitiveType.BIGINT || t === PrimitiveType.STRING) return true;
  if (t instanceof BytesType) return true; // unbounded bytes (bounded bytesN already fixed-width above)
  if (t instanceof AddressType) return true; // variable-width locking bytecode -> framed layout (like bytes)
  if (t instanceof StructType) return true; // variable-width struct -> framed layout (fixed-width handled above)
  return false;
}

/** Packed (tight) byte width of a fixed-width type. Throws if the type is not fixed-width. */
export function fixedWidthBytes(type: Type | string): number {
  const t = typeof type === 'string' ? parseTypeStrict(type) : type;
  if (t === PrimitiveType.BOOL) return 1;
  if (t === PrimitiveType.PUBKEY) return 33;
  if (t instanceof BytesType && t.bound !== undefined) return t.bound;
  if (t instanceof IntType || t instanceof FixedType) return t.byteWidth;
  if (t instanceof StructType) return t.fields.reduce((sum, f) => sum + fixedWidthBytes(f.type), 0);
  if (t instanceof ArrayType && t.bound !== undefined) return t.bound * fixedWidthBytes(t.elementType);
  throw new Error(`Type is not fixed-width: ${t}`);
}

// Parse `function(<types>)` or `function(<types>)returns(<types>)` (no whitespace) into a FunctionType.
function parseFunctionType(str: string): FunctionType {
  const afterKeyword = str.slice('function'.length); // "(params)..." or "(params)returns(rets)"
  const [paramsInner, rest] = splitParenGroup(afterKeyword);
  let returnTypes: Type[] = [];
  if (rest.startsWith('returns(')) {
    const [retsInner] = splitParenGroup(rest.slice('returns'.length));
    returnTypes = splitTopLevelCommas(retsInner).map(parseType);
  }
  return new FunctionType(splitTopLevelCommas(paramsInner).map(parseType), returnTypes);
}

// Given a string starting with '(', return [inside, remainder-after-matching-paren].
function splitParenGroup(s: string): [string, string] {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) return [s.slice(1, i), s.slice(i + 1)];
    }
  }
  return [s.slice(1), ''];
}

// Split on commas at parenthesis/bracket depth 0; empty input yields no elements.
function splitTopLevelCommas(s: string): string[] {
  if (s === '') return [];
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; }
  }
  parts.push(s.slice(start));
  return parts;
}

/** Find the index of `=>` at parenthesis depth 0 within a string. */
function findTopLevelArrow(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length - 1; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if (depth === 0 && s[i] === '=' && s[i + 1] === '>') {
      return i;
    }
  }
  return -1;
}

export function isPrimitive(type: Type): type is PrimitiveType {
  return Boolean(PrimitiveType[type.toString().toUpperCase() as keyof typeof PrimitiveType]);
}

/**
 * A dynamic-storage type: variable-length state stored in chunk UTXOs (string / unbounded bytes).
 * Such a state var desugars to a hidden `uint32 <name>$len` register field + a chunk collection.
 * See packages/solidc/docs/dynamic-storage.md.
 */
export function isDynamicStorageType(type: Type): boolean {
  if (type === PrimitiveType.STRING) return true;
  if (type instanceof BytesType && type.bound === undefined) return true;
  return false;
}

export interface LocationI {
  start: {
    line: number,
    column: number
  };
  end: {
    line: number,
    column: number
  };
}

export type SingleLocationData = {
  location: LocationI;
  positionHint: PositionHint;
};

export type FullLocationData = Array<SingleLocationData>;

// Denotes whether an opcode belongs to the "start" or "end" of the statement it's in (defaults to "start")
// Examples:
// require(true); --> the OP_VERIFY comes after the condition (OP_TRUE), so it should get a PositionHint.END
// !true --> the OP_NOT comes after the condition (OP_TRUE), so it should get a PositionHint.END
// if (true) { ... } --> the OP_IF comes before the body, so it should get a PositionHint.START,
//                       the OP_ENDIF comes after the body, so it should get a PositionHint.END
export enum PositionHint {
  START = 0,
  END = 1,
}
