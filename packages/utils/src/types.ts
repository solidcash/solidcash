export type Type =
  | PrimitiveType | ArrayType | TupleType | BytesType | IntType | FixedType
  | MappingType | StructType | TokenContainerType | EnumType
  | AddressType | ConnectedAddressType | ValueType;

export class TokenContainerType {
  toString(): string { return 'tokenContainer'; }
}

export class AddressType {
  constructor(public payable: boolean = false) {}
  toString(): string { return this.payable ? 'address payable' : 'address'; }
}

export class ConnectedAddressType {
  constructor(public payable: boolean = false) {}
  toString(): string { return this.payable ? 'connected address payable' : 'connected address'; }
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

export enum PrimitiveType {
  INT = 'int',
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
  [PrimitiveType.INT]: [PrimitiveType.INT, PrimitiveType.BOOL],
  [PrimitiveType.BOOL]: [PrimitiveType.BOOL, PrimitiveType.INT],
  [PrimitiveType.STRING]: [PrimitiveType.STRING],
  [PrimitiveType.PUBKEY]: [PrimitiveType.PUBKEY],
  [PrimitiveType.SIG]: [PrimitiveType.SIG],
  [PrimitiveType.DATASIG]: [PrimitiveType.DATASIG],
  [PrimitiveType.ANY]: [],
  [PrimitiveType.VOID]: [],
};

function typesEqual(a: Type, b?: Type): boolean {
  if (!b) return false;
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
  if (a instanceof ConnectedAddressType && b instanceof ConnectedAddressType) return a.payable === b.payable;
  if (a instanceof TokenContainerType && b instanceof TokenContainerType) return true;
  return a.toString() === b.toString();
}

export function explicitlyCastable(from?: Type, to?: Type): boolean {
  if (!from || !to) return false;

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
    return false;
  }
  if (to instanceof ConnectedAddressType) {
    // connected address -> connected address payable (via payable() cast)
    if (from instanceof ConnectedAddressType && to.payable) return true;
    return false;
  }
  if (from instanceof AddressType) {
    // address -> bytes (address is lbc bytes at VM level)
    if (to instanceof BytesType) return true;
    return false;
  }
  if (from instanceof ConnectedAddressType) {
    // connected address -> bytes (category bytes at VM level)
    if (to instanceof BytesType) return true;
    return false;
  }

  // Mappings can't be cast
  if (from instanceof MappingType || to instanceof MappingType) return false;

  // Structs can't be cast
  if (from instanceof StructType || to instanceof StructType) return false;

  // Enums can't be cast
  if (from instanceof EnumType || to instanceof EnumType) return false;

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
    if (from === PrimitiveType.INT) return true;
    // Can cast bounded int to any size bytes (same as int -> bytes)
    if (from instanceof IntType) return true;
    // Can cast fixed to any size bytes (same as int -> bytes, since stored as scaled int)
    if (from instanceof FixedType) return true;

    // Can freely cast to unbounded bytes
    if (!to.bound) return true;

    if (from instanceof BytesType) {
      // Can freely cast from unbounded bytes
      if (!from.bound) return true;
      // Can only cast bounded bytes to bounded bytes if bounds are equal
      return from.bound === to.bound;
    }

    // string -> bytes: allowed (string is UTF-8 bytes)
    if (from === PrimitiveType.STRING) return true;

    // Cannot cast other primitive types directly to bounded bytes types
    return false;
  }

  if (from instanceof BytesType) {
    // Can cast unbounded bytes or <=4 bytes to int
    if (to === PrimitiveType.INT) return !from.bound || from.bound <= 8;
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
    if (to === PrimitiveType.INT) return true;
    if (to instanceof IntType) return true;
    if (to === PrimitiveType.BOOL) return true;
    if (to instanceof FixedType) return true; // IntType -> FixedType (scale by scaleFactor)
    // IntType -> BytesType is handled above (to instanceof BytesType check)
    return false;
  }
  if (to instanceof IntType) {
    if (from === PrimitiveType.INT) return true;
    if (from === PrimitiveType.BOOL) return true;
    if (from instanceof FixedType) return true; // FixedType -> IntType (divide by scaleFactor)
    return false;
  }

  // FixedType explicit cast rules
  // Note: FixedType -> BytesType is handled above in the `to instanceof BytesType` block
  if (from instanceof FixedType) {
    if (to instanceof FixedType) return true;   // any FixedType -> any FixedType
    if (to === PrimitiveType.INT) return true;   // FixedType -> int (divide by scaleFactor)
    if (to === PrimitiveType.BOOL) return true;  // FixedType -> bool (non-zero check)
    return false;
  }
  if (to instanceof FixedType) {
    if (from === PrimitiveType.INT) return true;  // int -> FixedType (scale by scaleFactor)
    if (from === PrimitiveType.BOOL) return true;
    return false;
  }

  return ExplicitlyCastableTo[from].includes(to);
}

export function implicitlyCastable(actual?: Type, expected?: Type): boolean {
  if (!actual || !expected) return false;

  // ValueType: only the same value type is implicitly castable to itself
  if (actual instanceof ValueType || expected instanceof ValueType) {
    if (actual instanceof ValueType && expected instanceof ValueType) {
      return actual.name === expected.name;
    }
    return false;
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
  if (actual instanceof ConnectedAddressType && expected instanceof ConnectedAddressType) {
    if (expected.payable && !actual.payable) return false;
    return true;
  }
  if (actual instanceof AddressType && expected instanceof BytesType) {
    // address -> unbounded bytes: OK (address is lbc bytes at VM level)
    return !expected.bound;
  }
  if (actual instanceof ConnectedAddressType && expected instanceof BytesType) {
    // connected address -> unbounded bytes: OK (category bytes at VM level)
    return !expected.bound;
  }
  // Can't implicitly cast to/from address types in other cases
  if (actual instanceof AddressType || expected instanceof AddressType) return false;
  if (actual instanceof ConnectedAddressType || expected instanceof ConnectedAddressType) return false;

  // Mappings can't be implicitly cast
  if (actual instanceof MappingType || expected instanceof MappingType) return false;

  // Enums can't be implicitly cast
  if (actual instanceof EnumType || expected instanceof EnumType) return false;

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
    if (actual === PrimitiveType.INT) return false;
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

  // IntType -> PrimitiveType.INT: widening to unbounded (always OK)
  if (actual instanceof IntType && expected === PrimitiveType.INT) return true;

  // IntType -> IntType: widening same-signedness or unsigned->wider-signed
  if (actual instanceof IntType && expected instanceof IntType) {
    if (actual.signed === expected.signed) return expected.bits >= actual.bits;
    // unsigned -> wider signed (needs strictly wider to fit all values)
    if (!actual.signed && expected.signed) return expected.bits > actual.bits;
    return false;
  }

  // FixedType -> PrimitiveType.INT: widening to unbounded (always OK)
  if (actual instanceof FixedType && expected === PrimitiveType.INT) return false;

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

  if (str.startsWith('byte')) return BytesType.fromString(str);

  // Array types: int[5], int[], bytes20[], int[3][5], etc.
  // Use lastIndexOf to find the outermost dimension (rightmost brackets)
  if (str.endsWith(']') && str.includes('[')) {
    const bracketIdx = str.lastIndexOf('[');
    const elementTypeStr = str.substring(0, bracketIdx);
    const boundStr = str.substring(bracketIdx + 1, str.length - 1);
    const elementType = parseType(elementTypeStr);
    const bound = boundStr ? parseInt(boundStr, 10) : undefined;
    return new ArrayType(elementType, bound);
  }

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
