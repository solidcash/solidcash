import {
  AddressType, ArrayType, BytesType, EVENT_CHUNK_BYTES, FixedType, IntType, PrimitiveType, StructType, type Type,
  ValueType, encodeNftIndexTag,
} from '@solidcash/utils';

/** Reserve the explicit opt-in tag while preserving historical packing when the option is absent. */
export function stateNftPackingLimit(limit: number, nftIndex: number, tagSingletonDataNfts = false): number {
  return limit - (tagSingletonDataNfts ? encodeNftIndexTag(nftIndex).length : 0);
}

/**
 * Widest pushdata encoding of an address: its locking bytecode is stored inline, and the widest form is
 * P2SH32 (`OP_HASH256 <32> OP_EQUAL` = 35 B), so 36 with the push prefix.
 */
const ADDRESS_MAX_ENCODED_BYTES = 36;

/**
 * Widest pushdata encoding of a value with no static bound (`bigint`, unbounded `bytes`, `string`): the VM caps a
 * number or stack item at 10,000 bytes, pushed behind a 3-byte PUSHDATA2 prefix. That is wider than any commitment,
 * so a state layout gives such a field a data NFT of its own, where its growth cannot overflow a packed neighbour.
 */
const UNBOUNDED_VALUE_MAX_ENCODED_BYTES = 10_003;

/** The generic handle other estimates (event chunks, bounded-array chunking) reserve for a value with no bound. */
const UNBOUNDED_VALUE_HANDLE_BYTES = 9;

export function getMaxPushdataEncodedSizeForType(
  type: Type, seen: Set<string> = new Set(), addressBytes: number = ADDRESS_MAX_ENCODED_BYTES,
  unboundedBytes: number = UNBOUNDED_VALUE_HANDLE_BYTES,
): number {
  if (type === PrimitiveType.BOOL) return 1;
  if (type === PrimitiveType.BIGINT || type === PrimitiveType.STRING) return unboundedBytes;
  if (type === PrimitiveType.PUBKEY) return 34;
  if (type === PrimitiveType.SIG) return 74;
  if (type === PrimitiveType.DATASIG) return 66;
  if (type instanceof IntType) {
    const dataBytes = Math.ceil((type.bits + 1) / 8); // +1 for sign bit
    if (dataBytes <= 75) return dataBytes + 1;
    if (dataBytes <= 255) return dataBytes + 2;
    return dataBytes + 3;
  }
  if (type instanceof FixedType) {
    const dataBytes = Math.ceil((type.bits + 1) / 8);
    if (dataBytes <= 75) return dataBytes + 1;
    if (dataBytes <= 255) return dataBytes + 2;
    return dataBytes + 3;
  }
  if (type instanceof BytesType) {
    if (type.bound === undefined) return unboundedBytes;
    const n = type.bound;
    if (n === 0) return 1;
    if (n === 1) return 2;
    if (n <= 75) return n + 1;
    if (n <= 255) return n + 2;
    return n + 3;
  }
  // An address IS its locking bytecode, stored inline, so it costs its widest encoding - not the 9 bytes of a
  // generic handle. Under-estimating packs too many addresses into one NFT and the commitment overflows the
  // 128-byte consensus limit at send time (MistSwap SushiMaker deploy: 171 B).
  if (type instanceof AddressType) return addressBytes;
  if (type instanceof ValueType) {
    return getMaxPushdataEncodedSizeForType(type.underlyingType, seen, addressBytes, unboundedBytes);
  }
  if (type instanceof StructType) {
    // A struct reaches itself only through a dynamic array / mapping (returns a bounded handle below). A direct
    // or fixed-array self / mutual reference has no finite size - reject cleanly rather than recursing forever.
    if (seen.has(type.name)) {
      throw new Error(`Recursive struct '${type.name}' has no bounded size; a struct may only reference itself `
        + 'through a dynamic array or mapping');
    }
    const next = new Set(seen).add(type.name);
    return type.fields.reduce(
      (sum, f) => sum + getMaxPushdataEncodedSizeForType(f.type, next, addressBytes, unboundedBytes), 0,
    );
  }
  if (type instanceof ArrayType && type.bound !== undefined) {
    return UNBOUNDED_VALUE_HANDLE_BYTES // the element count
      + type.bound * getMaxPushdataEncodedSizeForType(type.elementType, seen, addressBytes, unboundedBytes);
  }
  return 9;
}

/** Bytes a state layout reserves for a field: a value with no static bound counts at its VM cap, so it packs alone. */
export function getMaxStateFieldBytes(type: Type): number {
  return getMaxPushdataEncodedSizeForType(type, new Set(), ADDRESS_MAX_ENCODED_BYTES, UNBOUNDED_VALUE_MAX_ENCODED_BYTES);
}

/**
 * NFT commitments one emit of an event needs: its widest encoded payload over `chunkBytes` (the commitment limit).
 * A zero-parameter event carries one marker byte. Unbounded `string` / `bytes` / dynamic arrays count as the
 * generic 9 bytes, so for them this is the capacity the layout reserves, not a bound; a wider payload is refused.
 */
export function getEventChunkCount(
  parameters: readonly { type: Type }[], chunkBytes: number = EVENT_CHUNK_BYTES,
): number {
  let bytes = parameters.length === 0 ? 1 : 0;
  try {
    for (const parameter of parameters) bytes += getMaxPushdataEncodedSizeForType(parameter.type);
  } catch {
    return 1;
  }
  return Math.max(1, Math.ceil(bytes / chunkBytes));
}
