import { hexToBin, isHex } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  type AbiFunction,
  AddressType,
  ArrayType,
  type Artifact,
  BytesType,
  encodeBool,
  encodeInt,
  encodePushdataValue,
  encodeString,
  FixedType,
  FunctionType,
  IntType,
  parseArrayTypeString,
  parseType,
  PrimitiveType,
  type StateValue,
  type StructDefinitionInfo,
} from '@solidcash/utils';
import { TypeError } from './Errors.js';
import SignatureTemplate from './SignatureTemplate.js';
import {
  addressPayloadToLockingBytecode, addressToLockScript, lockingBytecodeToSolidityAddressPayload,
  tryCashAddressToLockScript,
} from './utils.js';

// A struct argument (Solidity's struct = ABI tuple): an object keyed by field name, encoded in declaration
// order. A struct may also be passed as a positional tuple (the array case below), matching Solidity/ethers.
export interface StructArgument { [field: string]: FunctionArgument }
// A `bigint[]`/`boolean[]`/nested array argument for an array-typed parameter (`uint[]`, `int[][]`, `T[]`), a
// struct object, or a primitive.
export type ConstructorArgument = bigint | boolean | string | Uint8Array | ConstructorArgument[] | StructArgument;
export type SignatureTemplateArgument = SignatureTemplate | SignatureTemplateArgument[];
export type FunctionArgument = ConstructorArgument | SignatureTemplateArgument;

/** Solidity compatibility at call boundaries: a native address in a byte slot names its EVM identity bytes. */
export function normalizeSolidityBytesArgument(arg: FunctionArgument, type: string): FunctionArgument {
  if (!/^bytes(?:[1-9]|[12][0-9]|3[0-2])?$/.test(type) || typeof arg !== 'string') return arg;
  const lock = tryCashAddressToLockScript(arg);
  return lock ? lockingBytecodeToSolidityAddressPayload(lock) ?? arg : arg;
}

/** Coerce ethers BigNumber, the testing shim, BN.js, and equivalent numeric objects to bigint. */
function coerceNumericObject(value: object): bigint | undefined {
  const numeric = value as {
    toBigInt?: () => bigint; _value?: unknown; _isBigNumber?: boolean; _hex?: string; hex?: string;
    type?: string; toString?: (base?: number) => string; valueOf?: () => unknown;
  };
  if (typeof numeric.toBigInt === 'function') {
    try {
      const converted = numeric.toBigInt();
      if (typeof converted === 'bigint') return converted;
    } catch { /* try the compatible representations below */ }
  }
  if (typeof numeric._value === 'bigint') return numeric._value;
  if (typeof numeric._value === 'number' && Number.isFinite(numeric._value)) {
    return BigInt(Math.trunc(numeric._value));
  }
  if (typeof numeric._value === 'string' && /^-?\d+$/.test(numeric._value)) return BigInt(numeric._value);
  if (numeric._value && typeof numeric._value === 'object') {
    const nested = coerceNumericObject(numeric._value as object);
    if (nested !== undefined) return nested;
  }
  if ((numeric._isBigNumber === true || numeric.type === 'BigNumber') && typeof numeric._hex === 'string') {
    try { return BigInt(numeric._hex); } catch { /* continue */ }
  }
  if (typeof numeric.hex === 'string' && /^0x[0-9a-f]+$/i.test(numeric.hex)) {
    try { return BigInt(numeric.hex); } catch { /* continue */ }
  }
  if (typeof numeric.valueOf === 'function') {
    try {
      const converted = numeric.valueOf();
      if (typeof converted === 'bigint') return converted;
      if (typeof converted === 'number' && Number.isFinite(converted)) return BigInt(Math.trunc(converted));
    } catch { /* continue */ }
  }
  if (typeof numeric.toString === 'function') {
    try {
      const converted = numeric.toString(10);
      if (/^(?:-?\d+|0x[0-9a-f]+)$/i.test(converted)) return BigInt(converted);
    } catch { /* not a numeric object */ }
  }
  return undefined;
}

function coerceArrayElements(value: unknown, type: ReturnType<typeof parseType> | undefined): unknown {
  if (Array.isArray(value)) {
    const elementType = type instanceof ArrayType ? type.elementType : undefined;
    return value.map((element) => coerceArrayElements(element, elementType));
  }
  // Scalar integer arguments already accept safe JS numbers and decimal/hex strings. Apply the same
  // conversion to typed array leaves before fixed-width packing, without changing bool/bytes/address arrays.
  const numeric = type === PrimitiveType.INT || type === PrimitiveType.BIGINT
    || type instanceof IntType || type instanceof FixedType;
  if (numeric && typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (numeric && typeof value === 'string' && /^(?:-?\d+|0x[0-9a-f]+)$/i.test(value)) return BigInt(value);
  if (value && typeof value === 'object' && !(value instanceof Uint8Array)
    && !(value instanceof SignatureTemplate)) return coerceNumericObject(value) ?? value;
  return value;
}

export type EncodedConstructorArgument = Uint8Array;
export type DeferredSignatureArgument = SignatureTemplateArgument;
export type EncodedFunctionArgument = Uint8Array | DeferredSignatureArgument;
export const isSignatureTemplateArray = (value: unknown): value is SignatureTemplate[] =>
  Array.isArray(value) && value.every((element) => element instanceof SignatureTemplate);
export const isSignatureTemplateMatrix = (value: unknown): value is SignatureTemplate[][] =>
  Array.isArray(value) && value.every((element) => isSignatureTemplateArray(element));
export const isDeferredSignatureArgument = (value: unknown): value is DeferredSignatureArgument =>
  value instanceof SignatureTemplate
  || (Array.isArray(value) && value.every((element) => isDeferredSignatureArgument(element)));
export const isSignatureTemplateArgumentForType = (
  value: unknown, typeStr: string,
): value is SignatureTemplateArgument => {
  const isSignatureType = (type: ReturnType<typeof parseType>): boolean => type === PrimitiveType.SIG
    || (type instanceof ArrayType && isSignatureType(type.elementType));
  const matches = (candidate: unknown, type: ReturnType<typeof parseType>): boolean => {
    if (type === PrimitiveType.SIG) return candidate instanceof SignatureTemplate;
    return type instanceof ArrayType && Array.isArray(candidate)
      && candidate.every((element) => matches(element, type.elementType));
  };
  const type = parseType(typeStr);
  return isSignatureType(type) && matches(value, type);
};

export type EncodeFunction =
  (arg: FunctionArgument, typeStr: string, structs?: readonly StructDefinitionInfo[]) => EncodedFunctionArgument;

// Normalize address-typed array leaves using the same rules as scalar address arguments. The pushdata encoder
// must receive locking bytecode, not a CashAddress or hex string to encode as UTF-8 text.
// Non-address arrays pass through untouched.
function convertAddressArg(value: unknown, typeStr: string): unknown {
  const t = parseType(typeStr);
  if (!(t instanceof ArrayType) || !Array.isArray(value)) return value;
  // Only touch arrays whose element type is `address` or a nested array (recurse to
  // reach an inner address[]). Structs, ints, bytes, etc. are returned UNCHANGED - never remapped - so their
  // struct-tuple / packed encodings are untouched.
  if (t.elementType instanceof AddressType) {
    // Every element takes the scalar path's own address normalization, so a CashAddress, a hex payload and an
    // already-encoded lock all name the same locking bytecode the contract writes and reads back.
    return value.map((el) => encodeFunctionArgument(el as FunctionArgument, 'address'));
  }
  if (t.elementType instanceof ArrayType) {
    return value.map((el) => convertAddressArg(el, t.elementType.toString()));
  }
  return value;
}

export function encodeFunctionArgument(
  argument: FunctionArgument,
  typeStr: string,
  structs?: readonly StructDefinitionInfo[],
): EncodedFunctionArgument {
  // Struct-typed parameter (Solidity encodes a struct as an ABI tuple): accept an object keyed by field name
  // or a positional tuple array - both are valid Solidity/ethers forms. Delegate to the shared pushdata
  // encoder, which lays fields out in declaration order exactly as the covenant's value-copy struct decode
  // expects. Checked before the array branch so a positional struct tuple is not mistaken for an array.
  const structDef = structs?.find((s) => s.name === typeStr);
  if (structDef) {
    const isObject = typeof argument === 'object'
      && !(argument instanceof Uint8Array) && !(argument instanceof SignatureTemplate);
    if (!isObject) throw new TypeError(typeof argument, typeStr);
    return encodePushdataValue(argument as StateValue, typeStr, structs);
  }

  // Array-typed parameter (`uint[]`, `int[][]`, `T[]`): encode the value-copy array the covenant decodes -
  // a length prefix followed by packed fixed-width elements (or per-element encodings) - via the shared
  // pushdata encoder, so it matches the compiler's runtime array layout / state encoding exactly.
  if (Array.isArray(argument)) {
    const parsed = parseType(typeStr);
    if (parsed instanceof ArrayType) {
      if (isSignatureTemplateArgumentForType(argument, typeStr)) return argument;
      // Address strings inside an `address[]` (or nested array) must become their locking bytecode BEFORE the
      // pushdata encoder runs. Otherwise it encodes hex strings as UTF-8 text, while scalar address arguments
      // and the compiler's address operations use the binary locking bytecode.
      const coerced = coerceArrayElements(argument, parsed);
      const encoded = encodePushdataValue(convertAddressArg(coerced, typeStr) as StateValue, typeStr, structs);
      // The unlocking template pushes each encoded argument as one stack item. A sole 0x00 count prefix would be
      // minimally encoded as OP_0 and arrive as an empty item, so the covenant could no longer split/decode the
      // array header. The equivalent explicit pushdata form remains two bytes and therefore survives the outer
      // argument push. This special case is only needed for a top-level empty array argument.
      return argument.length === 0 ? Uint8Array.from([0x01, 0x00]) : encoded;
    }
    // Compose/preflight sometimes seeds scalar `bytes` witnesses as `[]`. Treat an empty JS array as empty bytes
    // rather than attempting array encoding against a non-array ABI type.
    if (argument.length === 0 && (typeStr === 'bytes' || typeStr === 'string' || /^bytes\d+$/.test(typeStr))) {
      argument = new Uint8Array();
    } else {
      throw new TypeError('object', typeStr);
    }
  }
  let type = parseType(typeStr);
  if (type === undefined) {
    // Unrecognized type name (e.g. an enum): enum values are int-backed, encode as int.
    if (typeof argument === 'bigint') return encodeInt(argument);
    throw new Error(`Unrecognized type string "${typeStr}"`);
  }

  if (type === PrimitiveType.BOOL) {
    if (typeof argument !== 'boolean') {
      throw new TypeError(typeof argument, type);
    }
    return encodeBool(argument);
  }

  if (type === PrimitiveType.BIGINT || type instanceof IntType || type instanceof FixedType) {
    // ethers-parity: accept a JS `number` for an integer arg by coercing a safe integer to bigint.
    if (typeof argument === 'number' && Number.isSafeInteger(argument)) {
      argument = BigInt(argument);
    }
    if (typeof argument === 'string' && /^(?:-?\d+|0x[0-9a-f]+)$/i.test(argument)) {
      argument = BigInt(argument);
    }
    if (typeof argument === 'object' && argument !== null && !(argument instanceof Uint8Array)) {
      argument = coerceNumericObject(argument) ?? argument;
    }
    if (typeof argument !== 'bigint') {
      throw new TypeError(typeof argument, type);
    }
    if (type instanceof IntType) {
      if (argument < type.minValue || argument > type.maxValue) {
        throw new Error(
          `value out-of-bounds: ${argument} for type ${type.toString()} `
          + `(min: ${type.minValue}, max: ${type.maxValue})`,
        );
      }
    }
    if (type instanceof FixedType) {
      if (argument < type.minValue || argument > type.maxValue) {
        throw new Error(
          `Value ${argument} is out of range for type ${type.toString()} `
          + `(min: ${type.minValue}, max: ${type.maxValue})`,
        );
      }
    }
    return encodeInt(argument);
  }

  if (type instanceof FunctionType) {
    // Function pointer: its value is the target's integer functionId.
    if (typeof argument !== 'bigint') {
      throw new TypeError(typeof argument, type);
    }
    return encodeInt(argument);
  }

  if (type === PrimitiveType.STRING) {
    if (typeof argument !== 'string') {
      throw new TypeError(typeof argument, type);
    }
    return encodeString(argument);
  }

  if (type === PrimitiveType.SIG && argument instanceof SignatureTemplate) return argument;

  // Ethers-style address-bearing objects (including SignerWithAddress) are
  // address arguments only. Read their concrete address here so direct unlock
  // and stateful ABI validation agree on the encoded value.
  if (type instanceof AddressType && typeof argument === 'object' && argument !== null
    && !(argument instanceof Uint8Array) && !Array.isArray(argument)) {
    const address = (argument as { address?: unknown }).address;
    if (typeof address === 'string') argument = address;
  }

  // An `address` argument given as a CashAddress string (has a `prefix:` part) -> its locking bytecode. A
  // hex-encoded locking bytecode still falls through to hexToBin below. Prevents silently hexToBin-ing a
  // CashAddress into garbage bytes (which then mismatch the real address everywhere it is used).
  if (type instanceof AddressType && typeof argument === 'string' && argument.includes(':')) {
    argument = addressToLockScript(argument);
  }

  // Solidity's `address(0)` compiles to EMPTY bytes: a BCH address is a variable-length locking bytecode and the
  // zero address has no script (GenerateTargetTraversal: "Default is empty (address(0))"). ethers hands
  // `ethers.ZeroAddress` through as the string of 20 zero bytes, which would hexToBin to 20 zero bytes, compare
  // UNEQUAL to address(0), and then be decoded as a locking bytecode. Normalise it to the compiler's form. No
  // real locking bytecode is all-zero, so this cannot swallow a valid address.
  if (type instanceof AddressType && typeof argument === 'string' && /^(0x)?0*$/i.test(argument)) {
    argument = new Uint8Array(0);
  }

  // Convert hex string to Uint8Array
  if (typeof argument === 'string') {
    const hex = argument.startsWith('0x') ? argument.slice(2) : argument;

    if (!isHex(hex)) {
      throw Error(`Value for type ${type} should be a valid hex string with an even number of digits, found '${argument}'`);
    }

    argument = hexToBin(hex);
  }

  if (!(argument instanceof Uint8Array)) {
    throw Error(`Value for type ${type} should be a Uint8Array or hex string`);
  }

  // An `address` given in the 20-byte payload form an EVM ABI carries names its locking bytecode: the compiler's
  // `address` is a lock, so a value passed as the payload would otherwise reach the contract as an address no other
  // form of the same address equals (a mapping keyed by one reads under a different key than the body wrote).
  if (type instanceof AddressType && argument.byteLength === 20) {
    argument = addressPayloadToLockingBytecode(argument);
  }

  // Redefine PUBKEY as a bytes33 (compressed) or bytes65 (uncompressed)
  if (type === PrimitiveType.PUBKEY) {
    if (![33, 65].includes(argument.byteLength)) {
      throw new TypeError(`bytes${argument.byteLength}`, type);
    }
    type = new BytesType(argument.byteLength);
  }

  // Redefine SIG as a bytes65 (Schnorr) or bytes71, bytes72, bytes73 (ECDSA) or bytes0 (for NULLFAIL)
  if (type === PrimitiveType.SIG) {
    if (![0, 65, 71, 72, 73].includes(argument.byteLength)) {
      throw new TypeError(`bytes${argument.byteLength}`, type);
    }
    type = new BytesType(argument.byteLength);
  }

  // Redefine DATASIG as a bytes64 (Schnorr) or bytes70, bytes71, bytes72 (ECDSA) or bytes0 (for NULLFAIL)
  if (type === PrimitiveType.DATASIG) {
    if (![0, 64, 70, 71, 72].includes(argument.byteLength)) {
      throw new TypeError(`bytes${argument.byteLength}`, type);
    }
    type = new BytesType(argument.byteLength);
  }

  // Bounded bytes types require a correctly sized argument
  if (type instanceof BytesType && type.bound && argument.byteLength !== type.bound) {
    throw new Error(
      `incorrect data length: got ${argument.byteLength} bytes, expected ${type.bound} for ${type.toString()}`,
    );
  }

  return argument;
}

export const encodeConstructorArguments = (
  artifact: Artifact,
  constructorArgs: ConstructorArgument[],
  encodeFunction: EncodeFunction = encodeFunctionArgument,
): Uint8Array[] => {
  // Check there's no signature templates in the constructor
  if (constructorArgs.some((arg) => arg instanceof SignatureTemplate)) {
    throw new Error('Cannot use signatures in constructor');
  }

  const structs = artifact.structs ?? artifact.stateLayout?.structs;
  const encodedArgs = constructorArgs
    .map((arg, i) => encodeFunction(arg, artifact.constructorInputs[i].type, structs));

  return encodedArgs as Uint8Array[];
};

export const encodeFunctionArguments = (
  abiFunction: AbiFunction,
  functionArgs: FunctionArgument[],
  encodeFunction: EncodeFunction = encodeFunctionArgument,
  structs?: readonly StructDefinitionInfo[],
): EncodedFunctionArgument[] => {
  const encodedArgs = functionArgs.map((arg, i) => encodeFunction(arg, abiFunction.inputs[i].type, structs));

  return encodedArgs;
};

/** An ethers `Addressable`: a value that names an address through `getAddress()`, as a signer or a contract does. */
export interface Addressable {
  getAddress(): string | Uint8Array | PromiseLike<string | Uint8Array>;
}

const isAddressable = (value: unknown): value is Addressable => typeof value === 'object' && value !== null
  && typeof (value as Partial<Addressable>).getAddress === 'function';

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => typeof value === 'object' && value !== null
  && typeof (value as Partial<PromiseLike<unknown>>).then === 'function';

const isAddressTypeString = (typeStr: string): boolean => parseType(typeStr) instanceof AddressType;

// True when a value of `typeStr` can hold an address: an address, or an array or struct with one at some depth.
function holdsAddress(
  typeStr: string, structs: readonly StructDefinitionInfo[] | undefined, seen: Set<string> = new Set(),
): boolean {
  if (isAddressTypeString(typeStr)) return true;
  const arrayInfo = parseArrayTypeString(typeStr);
  if (arrayInfo) return holdsAddress(arrayInfo.elementType, structs, seen);
  const structDef = structs?.find((s) => s.name === typeStr);
  if (!structDef || seen.has(typeStr)) return false;
  seen.add(typeStr);
  return structDef.fields.some((field) => holdsAddress(field.type, structs, seen));
}

// A resolved value, boxed so that a value outside an address position is carried as given rather than awaited.
interface ResolvedValue { readonly value: unknown }

async function resolveAddressesIn(
  value: unknown, typeStr: string, structs: readonly StructDefinitionInfo[] | undefined,
): Promise<ResolvedValue> {
  if (isAddressTypeString(typeStr)) {
    if (isAddressable(value)) return { value: await value.getAddress() };
    return { value: isPromiseLike(value) ? await value : value };
  }
  if (typeof value !== 'object' || value === null || value instanceof Uint8Array
    || !holdsAddress(typeStr, structs)) return { value };
  const structDef = structs?.find((s) => s.name === typeStr);
  if (Array.isArray(value)) {
    // An array, or a struct given as a positional tuple: each element resolves at its own type.
    const elementType = parseArrayTypeString(typeStr)?.elementType;
    const parts = await Promise.all(value.map((element, index) => {
      const at = structDef ? structDef.fields[index]?.type : elementType;
      return at === undefined ? { value: element } : resolveAddressesIn(element, at, structs);
    }));
    return parts.every((part, index) => part.value === value[index])
      ? { value } : { value: parts.map((part) => part.value) };
  }
  if (!structDef) return { value };
  // A struct given as an object keyed by field name: each field resolves at its declared type.
  const record = value as Record<string, unknown>;
  const parts = await Promise.all(structDef.fields.map((field) => resolveAddressesIn(
    record[field.name], field.type, structs,
  )));
  if (parts.every((part, index) => part.value === record[structDef.fields[index].name])) return { value };
  const resolved = { ...record };
  structDef.fields.forEach((field, index) => {
    if (parts[index].value !== record[field.name]) resolved[field.name] = parts[index].value;
  });
  return { value: resolved };
}

/**
 * Resolves the values a call carries at `address` positions, as ethers resolves a contract call's arguments before it
 * encodes them: an `Addressable` (a signer, a contract) stands for the address its `getAddress()` names, awaited when
 * that is a promise, and a promise of an address for the address it settles to. Arrays and structs are walked to any
 * depth, so an `address[]`, an `address[3]` and a struct's address field resolve alike. Every other value, a string
 * or bytes included, is returned as given for the encoder to check, and a container in which nothing resolved is
 * returned as the same object.
 */
export async function resolveAddressArguments(
  inputs: readonly { readonly type: string }[],
  args: readonly FunctionArgument[],
  structs?: readonly StructDefinitionInfo[],
): Promise<FunctionArgument[]> {
  const parts = await Promise.all(args.map((arg, index) => (inputs[index] === undefined
    ? { value: arg } : resolveAddressesIn(arg, inputs[index].type, structs))));
  return parts.map((part) => part.value as FunctionArgument);
}
