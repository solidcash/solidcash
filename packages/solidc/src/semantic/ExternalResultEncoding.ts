import {
  AddressType, ArrayType, BytesType, EnumType, FixedType, IntType, PrimitiveType, StructType, Type,
  type CompilerOptions, type ExternalResultEncoding,
} from '@solidcash/utils';

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

/** Tuple-wide wire representation emitted and expected by this exact compiler boundary. */
export const externalResultEncoding = (
  types: readonly Type[], options: Pick<CompilerOptions, 'evmCompat' | 'solidityImportCompat'>,
): ExternalResultEncoding => (options.evmCompat || options.solidityImportCompat)
  && isEvmExternalResultSchemaDecodable(types)
  ? 'evm-abi-v1'
  : 'compact-pushdata-v1';
