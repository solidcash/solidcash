import {
  AddressType, ArrayType, BytesType, EnumType, FixedType, IntType, PrimitiveType, StructType, type Type,
  type CompilerOptions, type ExternalResultEncoding,
} from '@solidcash/utils';
import { getMaxStateFieldBytes } from './maxEncodedSize.js';

/** Keep compiler-generated ABI materialization finite under the consensus script-size ceiling. */
const MAX_MATERIALIZED_RESULT_ARRAY_ELEMENTS = 10_000;

const isDynamicAbiType = (type: Type): boolean => {
  if (type === PrimitiveType.STRING) return true;
  if (type instanceof BytesType) return type.bound === undefined;
  if (type instanceof ArrayType) return type.bound === undefined || isDynamicAbiType(type.elementType);
  if (type instanceof StructType) return type.fields.some((field) => isDynamicAbiType(field.type));
  return false;
};

/** Types represented by one EVM ABI word and supported by the compiler's word conversion helpers. */
export const isEvmAbiWordType = (type: Type): boolean => type === PrimitiveType.BOOL
  || type === PrimitiveType.BIGINT
  || type instanceof IntType
  || type instanceof FixedType
  || type instanceof EnumType
  || type instanceof AddressType
  || (type instanceof BytesType && type.bound !== undefined && type.bound <= 32);

const isArrayElementDecodable = (type: Type): boolean => {
  if (!isDynamicAbiType(type)) return isEvmExternalResultTypeDecodable(type);
  if (type === PrimitiveType.STRING || (type instanceof BytesType && type.bound === undefined)) return true;
  if (type instanceof StructType) return isEvmExternalResultTypeDecodable(type);
  return type instanceof ArrayType && type.bound === undefined && isArrayElementDecodable(type.elementType);
};

/**
 * One compiler-owned classification for every typed external-result boundary. Code generation and artifact
 * publication must call this function rather than independently approximating which recursive ABI layouts the
 * decoder can consume.
 */
export const isEvmExternalResultTypeDecodable = (type: Type): boolean => {
  if (isEvmAbiWordType(type)) return true;
  if (type === PrimitiveType.STRING || (type instanceof BytesType && type.bound === undefined)) return true;
  if (type instanceof StructType) {
    if (!isDynamicAbiType(type)) {
      return type.fields.every((field) => isEvmExternalResultTypeDecodable(field.type));
    }
    return type.fields.every((field) => {
      const member = field.type;
      if (member === PrimitiveType.STRING || (member instanceof BytesType && member.bound === undefined)) {
        return true;
      }
      if (member instanceof ArrayType && member.bound === undefined) {
        return isArrayElementDecodable(member.elementType);
      }
      if (member instanceof ArrayType && member.bound !== undefined && isDynamicAbiType(member)) {
        return member.bound <= MAX_MATERIALIZED_RESULT_ARRAY_ELEMENTS
          && isEvmExternalResultTypeDecodable(member.elementType);
      }
      if (member instanceof StructType && isDynamicAbiType(member)) {
        return isEvmExternalResultTypeDecodable(member);
      }
      return !isDynamicAbiType(member) && isEvmExternalResultTypeDecodable(member);
    });
  }
  if (type instanceof ArrayType) {
    if (type.bound === undefined) return isArrayElementDecodable(type.elementType);
    return type.bound <= MAX_MATERIALIZED_RESULT_ARRAY_ELEMENTS
      && isEvmExternalResultTypeDecodable(type.elementType);
  }
  return false;
};

export const isEvmExternalResultSchemaDecodable = (types: readonly Type[]): boolean =>
  types.every(isEvmExternalResultTypeDecodable);

/** Exact encoded width for a static, decodable EVM result; dynamic layouts have no fixed width. */
export const evmStaticResultBytes = (types: readonly Type[]): number | undefined => {
  const width = (type: Type): number | undefined => {
    if (isEvmAbiWordType(type)) return 32;
    if (type instanceof ArrayType && type.bound !== undefined) {
      const element = width(type.elementType);
      return element === undefined ? undefined : type.bound * element;
    }
    if (type instanceof StructType) {
      let total = 0;
      for (const field of type.fields) {
        const member = width(field.type);
        if (member === undefined) return undefined;
        total += member;
      }
      return total;
    }
    return undefined;
  };
  let total = 0;
  for (const type of types) {
    const item = width(type);
    if (item === undefined) return undefined;
    total += item;
  }
  return total;
};

/** A dynamic ABI result can cross the NFT commitment limit at runtime. */
export const evmResultMayNeedPreimage = (types: readonly Type[]): boolean => {
  const staticBytes = evmStaticResultBytes(types);
  return staticBytes === undefined || staticBytes > 128;
};

/** A direct call record's digest: SHA256 of the call's ordinal, selector and arguments. */
export const CALL_RECORD_DIGEST_BYTES = 32;

/** The widest result a call record carries inline, after its digest and form byte, in a 128-byte commitment. */
export const CALL_RECORD_INLINE_RESULT_BYTES = 128 - CALL_RECORD_DIGEST_BYTES - 1;

/**
 * A result a call record may carry only as its SHA256, so the caller takes the bytes from a preimage witness: one
 * whose encoding may exceed the record's inline capacity.
 */
export const externalResultMayNeedPreimage = (
  types: readonly Type[], options: Pick<CompilerOptions, 'evmCompat'>,
): boolean => {
  if (externalResultEncoding(types, options) === 'evm-abi-v1') {
    const staticBytes = evmStaticResultBytes(types);
    return staticBytes === undefined || staticBytes > CALL_RECORD_INLINE_RESULT_BYTES;
  }
  const widest = types.reduce((total: number, type) => total + getMaxStateFieldBytes(type), 0);
  return widest > CALL_RECORD_INLINE_RESULT_BYTES;
};

/** Tuple-wide wire representation emitted and expected by this exact compiler boundary. */
export const externalResultEncoding = (
  types: readonly Type[], options: Pick<CompilerOptions, 'evmCompat'>,
): ExternalResultEncoding => (options.evmCompat)
  && isEvmExternalResultSchemaDecodable(types)
  ? 'evm-abi-v1'
  : 'compact-pushdata-v1';
