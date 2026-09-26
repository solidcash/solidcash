/**
 * Deployment-time constants in a compiled master.
 *
 * Two values in a master script are only known once the contract is deployed: the state category its token carries,
 * and the address it presents as `address(this)`. The compiler therefore emits a zero-filled slot for each and
 * publishes where they are, and deployment fills them in.
 *
 * The published offsets are authoritative. The shape check that accompanies them exists so a mistaken offset is
 * refused rather than silently overwriting script bytes, because a wrong fill produces a contract that rejects every
 * spend with no indication of why.
 */

import { bytesEqual, PerCallEncodingError, type CompositionPlaceholders } from '@solidcash/utils';

/** Length of the state category. */
export const CATEGORY_SLOT_LENGTH = 32;

/** Length of the contract address, a P2SH32 locking bytecode. */
export const ADDRESS_SLOT_LENGTH = 35;

/** The push opcode for a payload above 75 bytes: one length byte. */
const PUSHDATA1_OPCODE = 0x4c;

/** The push opcode for a payload above 255 bytes: two length bytes. */
const PUSHDATA2_OPCODE = 0x4d;

/** The descriptor the artifact publishes, so a deployment fills the slots the compiler reserved. */
export type { CompositionPlaceholders };

/** The value a slot holds before deployment. */
export function emptySlot(length: number): Uint8Array {
  return new Uint8Array(length);
}

/** Bytes a push of `length` payload bytes spends on its opcode and length field. */
export function placeholderPrefixLength(length: number): number {
  if (length < 1) throw new PerCallEncodingError(`a slot holds at least one byte: got ${length}`);
  if (length <= 75) return 1;
  if (length <= 0xff) return 2;
  if (length <= 0xffff) return 3;
  throw new PerCallEncodingError(`a slot above 65535 bytes is not representable: got ${length}`);
}

/** The script bytes that reserve a slot: a minimal push of a zero-filled value of that length. */
export function placeholderPush(length: number): Uint8Array {
  const payload = emptySlot(length);
  if (length <= 75) return new Uint8Array([length, ...payload]);
  if (length <= 0xff) return new Uint8Array([PUSHDATA1_OPCODE, length, ...payload]);
  if (length <= 0xffff) {
    return new Uint8Array([PUSHDATA2_OPCODE, length & 0xff, (length >>> 8) & 0xff, ...payload]);
  }
  throw new PerCallEncodingError(`a slot above 65535 bytes is not representable: got ${length}`);
}

/** Byte length of `placeholderPush(length)`. */
export function placeholderPushLength(length: number): number {
  return placeholderPrefixLength(length) + length;
}

/** Builds the descriptor for a script that reserves both slots. */
export function placeholdersAt(categoryOffset: number, addressOffset: number): CompositionPlaceholders {
  return { version: 1, categoryOffset, addressOffset };
}

/**
 * Requires that the bytes at the published offsets are the reserved pushes, so a fill cannot overwrite a different
 * part of the script.
 */
export function assertPlaceholders(script: Uint8Array, placeholders: CompositionPlaceholders): void {
  if (placeholders.version !== 1) {
    throw new PerCallEncodingError(`unsupported placeholder version: ${String(placeholders.version)}`);
  }
  const check = (offset: number, length: number, what: string): void => {
    if (offset < 0 || offset + placeholderPushLength(length) > script.length) {
      throw new PerCallEncodingError(`${what} slot at ${offset} is outside a ${script.length}-byte script`);
    }
    const expected = placeholderPush(length);
    const actual = script.subarray(offset, offset + expected.length);
    if (!bytesEqual(actual, expected)) {
      throw new PerCallEncodingError(`${what} slot at ${offset} is not a reserved ${length}-byte zero push`);
    }
  };
  check(placeholders.categoryOffset, CATEGORY_SLOT_LENGTH, 'category');
  check(placeholders.addressOffset, ADDRESS_SLOT_LENGTH, 'address');
}

/** True when both slots still hold their pre-deployment value. */
export function placeholdersAreEmpty(script: Uint8Array, placeholders: CompositionPlaceholders): boolean {
  try {
    assertPlaceholders(script, placeholders);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fills both slots, returning a new script. The reserved pushes stay the same length, so every offset in the script
 * and in the artifact's debug information remains valid.
 */
export function fillPlaceholders(
  script: Uint8Array,
  placeholders: CompositionPlaceholders,
  values: { category: Uint8Array; contractAddress: Uint8Array },
): Uint8Array {
  if (values.category.length !== CATEGORY_SLOT_LENGTH) {
    throw new PerCallEncodingError(
      `a category is ${CATEGORY_SLOT_LENGTH} bytes: got ${values.category.length}`,
    );
  }
  if (values.contractAddress.length !== ADDRESS_SLOT_LENGTH) {
    throw new PerCallEncodingError(
      `a contract address is ${ADDRESS_SLOT_LENGTH} bytes: got ${values.contractAddress.length}`,
    );
  }
  assertPlaceholders(script, placeholders);

  const filled = Uint8Array.from(script);
  // The payload starts after the push's opcode and length field.
  filled.set(values.category, placeholders.categoryOffset + placeholderPrefixLength(CATEGORY_SLOT_LENGTH));
  filled.set(
    values.contractAddress,
    placeholders.addressOffset + placeholderPrefixLength(ADDRESS_SLOT_LENGTH),
  );
  return filled;
}

/** Reads the filled constants back, for a caller that has a deployed script and its descriptor. */
export function readPlaceholders(
  script: Uint8Array,
  placeholders: CompositionPlaceholders,
): { category: Uint8Array; contractAddress: Uint8Array } {
  const bounds = (offset: number, length: number): void => {
    if (offset < 0 || offset + placeholderPushLength(length) > script.length) {
      throw new PerCallEncodingError(`slot at ${offset} is outside a ${script.length}-byte script`);
    }
  };
  bounds(placeholders.categoryOffset, CATEGORY_SLOT_LENGTH);
  bounds(placeholders.addressOffset, ADDRESS_SLOT_LENGTH);
  const categoryStart = placeholders.categoryOffset + placeholderPrefixLength(CATEGORY_SLOT_LENGTH);
  const addressStart = placeholders.addressOffset + placeholderPrefixLength(ADDRESS_SLOT_LENGTH);
  return {
    category: script.subarray(categoryStart, categoryStart + CATEGORY_SLOT_LENGTH),
    contractAddress: script.subarray(addressStart, addressStart + ADDRESS_SLOT_LENGTH),
  };
}
