import { hexToBin } from '@bitauth/libauth';
import {
  AbiFunction,
  AddressType,
  ArrayType,
  Artifact,
  BytesType,
  encodeBool,
  encodeInt,
  encodePushdataValue,
  encodeString,
  FixedType,
  FunctionType,
  IntType,
  parseType,
  PrimitiveType,
  StateValue,
  StructDefinitionInfo,
} from '@solidcash/utils';
import { TypeError } from './Errors.js';
import SignatureTemplate from './SignatureTemplate.js';
import { addressToLockScript } from './utils.js';

// A struct argument (Solidity's struct = ABI tuple): an object keyed by field name, encoded in declaration
// order. A struct may also be passed as a positional tuple (the array case below), matching Solidity/ethers.
export interface StructArgument { [field: string]: ConstructorArgument }
// A `bigint[]`/`boolean[]`/nested array argument for an array-typed parameter (`uint[]`, `int[][]`, `T[]`), a
// struct object, or a primitive.
export type ConstructorArgument = bigint | boolean | string | Uint8Array | ConstructorArgument[] | StructArgument;
export type FunctionArgument = ConstructorArgument | SignatureTemplate | SignatureTemplate[];

export type EncodedConstructorArgument = Uint8Array;
export type EncodedFunctionArgument = Uint8Array | SignatureTemplate | SignatureTemplate[];
export const isSignatureTemplateArray = (value: unknown): value is SignatureTemplate[] =>
  Array.isArray(value) && value.every((element) => element instanceof SignatureTemplate);

export type EncodeFunction =
  (arg: FunctionArgument, typeStr: string, structs?: readonly StructDefinitionInfo[]) => EncodedFunctionArgument;

// Recursively convert CashAddress string elements of an `address[]` (or nested `address[][]`) to their locking
// bytecode, so the pushdata encoder stores the lockscript (== addressToLockScript / keyToSlot) not the raw string.
// Non-address arrays pass through untouched.
function convertAddressArg(value: unknown, typeStr: string): unknown {
  const t = parseType(typeStr);
  if (!(t instanceof ArrayType) || !Array.isArray(value)) return value;
  // Only touch arrays whose element type is `address` (convert CashAddress strings) or a nested array (recurse to
  // reach an inner address[]). Structs, ints, bytes, etc. are returned UNCHANGED - never remapped - so their
  // struct-tuple / packed encodings are untouched.
  if (t.elementType instanceof AddressType) {
    return value.map((el) => (typeof el === 'string' && el.includes(':') ? addressToLockScript(el) : el));
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
    if (parsed instanceof ArrayType && parsed.elementType === PrimitiveType.SIG
      && isSignatureTemplateArray(argument)) return argument;
    // A CashAddress string inside an `address[]` (or nested) arg must become its locking bytecode BEFORE the
    // pushdata encoder runs - the scalar path below converts it, but the array path delegates straight to
    // encodePushdataValue, which would otherwise encode the raw address STRING (mismatching addressToLockScript
    // everywhere the value is used, e.g. keyToSlot of an address[] mapping key).
    const encoded = encodePushdataValue(convertAddressArg(argument, typeStr) as StateValue, typeStr, structs);
    // The unlocking template pushes each encoded argument as one stack item. A sole 0x00 count prefix would be
    // minimally encoded as OP_0 and arrive as an empty item, so the covenant could no longer split/decode the
    // array header. The equivalent explicit pushdata form remains two bytes and therefore survives the outer
    // argument push. This special case is only needed for a top-level empty array argument.
    return argument.length === 0 ? Uint8Array.from([0x01, 0x00]) : encoded;
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
    if (typeof argument !== 'bigint') {
      throw new TypeError(typeof argument, type);
    }
    if (type instanceof IntType) {
      if (argument < type.minValue || argument > type.maxValue) {
        throw new Error(
          `Value ${argument} is out of range for type ${type.toString()} `
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
    if (argument.startsWith('0x')) {
      argument = argument.slice(2);
    }

    argument = hexToBin(argument);
  }

  if (!(argument instanceof Uint8Array)) {
    throw Error(`Value for type ${type} should be a Uint8Array or hex string`);
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
    throw new TypeError(`bytes${argument.byteLength}`, type);
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
