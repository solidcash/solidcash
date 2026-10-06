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

import { bytesEqual, FramedEncodingError, type CompositionPlaceholders } from '@solidcash/utils';

/** Length of the state category. */
export const CATEGORY_SLOT_LENGTH = 32;

/** Length of the contract address, a P2SH32 locking bytecode. */
export const ADDRESS_SLOT_LENGTH = 35;

/** Length of the hash of the validator program, which a master carries when it recognises a validator. */
export const TEMPLATE_HASH_SLOT_LENGTH = 32;

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
  if (length < 1) throw new FramedEncodingError(`a slot holds at least one byte: got ${length}`);
  if (length <= 75) return 1;
  if (length <= 0xff) return 2;
  if (length <= 0xffff) return 3;
  throw new FramedEncodingError(`a slot above 65535 bytes is not representable: got ${length}`);
}

/** The script bytes that reserve a slot: a minimal push of a zero-filled value of that length. */
export function placeholderPush(length: number): Uint8Array {
  const payload = emptySlot(length);
  if (length <= 75) return new Uint8Array([length, ...payload]);
  if (length <= 0xff) return new Uint8Array([PUSHDATA1_OPCODE, length, ...payload]);
  if (length <= 0xffff) {
    return new Uint8Array([PUSHDATA2_OPCODE, length & 0xff, (length >>> 8) & 0xff, ...payload]);
  }
  throw new FramedEncodingError(`a slot above 65535 bytes is not representable: got ${length}`);
}

/** Byte length of `placeholderPush(length)`. */
export function placeholderPushLength(length: number): number {
  return placeholderPrefixLength(length) + length;
}

/** Builds the descriptor for a script that reserves both slots. */
export function placeholdersAt(
  categoryOffset: number,
  addressOffset: number,
  templateHashOffset?: number,
): CompositionPlaceholders {
  return templateHashOffset === undefined
    ? { version: 1, categoryOffset, addressOffset }
    : { version: 1, categoryOffset, addressOffset, templateHashOffset };
}

/** The slots a descriptor declares, in the order they sit in the script, with the length each reserves. */
export function declaredSlots(
  placeholders: CompositionPlaceholders,
): readonly { readonly offset: number; readonly length: number; readonly what: string }[] {
  const slots = [
    { offset: placeholders.categoryOffset, length: CATEGORY_SLOT_LENGTH, what: 'category' },
    { offset: placeholders.addressOffset, length: ADDRESS_SLOT_LENGTH, what: 'address' },
  ];
  if (placeholders.templateHashOffset !== undefined) {
    slots.push({
      offset: placeholders.templateHashOffset,
      length: TEMPLATE_HASH_SLOT_LENGTH,
      what: 'validator program hash',
    });
  }
  return slots;
}

/**
 * Requires that the bytes at the published offsets are the reserved pushes, so a fill cannot overwrite a different
 * part of the script.
 */
export function assertPlaceholders(script: Uint8Array, placeholders: CompositionPlaceholders): void {
  if (placeholders.version !== 1) {
    throw new FramedEncodingError(`unsupported placeholder version: ${String(placeholders.version)}`);
  }
  for (const slot of declaredSlots(placeholders)) {
    if (slot.offset < 0 || slot.offset + placeholderPushLength(slot.length) > script.length) {
      throw new FramedEncodingError(
        `${slot.what} slot at ${slot.offset} is outside a ${script.length}-byte script`,
      );
    }
    const expected = placeholderPush(slot.length);
    const actual = script.subarray(slot.offset, slot.offset + expected.length);
    if (!bytesEqual(actual, expected)) {
      throw new FramedEncodingError(
        `${slot.what} slot at ${slot.offset} is not a reserved ${slot.length}-byte zero push`,
      );
    }
  }
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
  values: { category: Uint8Array; contractAddress: Uint8Array; templateHash?: Uint8Array },
): Uint8Array {
  if (values.category.length !== CATEGORY_SLOT_LENGTH) {
    throw new FramedEncodingError(
      `a category is ${CATEGORY_SLOT_LENGTH} bytes: got ${values.category.length}`,
    );
  }
  if (values.contractAddress.length !== ADDRESS_SLOT_LENGTH) {
    throw new FramedEncodingError(
      `a contract address is ${ADDRESS_SLOT_LENGTH} bytes: got ${values.contractAddress.length}`,
    );
  }
  const declaresTemplateHash = placeholders.templateHashOffset !== undefined;
  if (declaresTemplateHash) {
    if (values.templateHash === undefined) {
      throw new FramedEncodingError('the descriptor declares a validator program hash slot, so a value is required');
    }
    if (values.templateHash.length !== TEMPLATE_HASH_SLOT_LENGTH) {
      throw new FramedEncodingError(
        `a validator program hash is ${TEMPLATE_HASH_SLOT_LENGTH} bytes: got ${values.templateHash.length}`,
      );
    }
  } else if (values.templateHash !== undefined) {
    throw new FramedEncodingError('the descriptor declares no validator program hash slot, so none can be filled');
  }
  assertPlaceholders(script, placeholders);

  const filled = Uint8Array.from(script);
  // The payload starts after the push's opcode and length field.
  for (const slot of declaredSlots(placeholders)) {
    const value = slot.what === 'category'
      ? values.category
      : slot.what === 'address'
        ? values.contractAddress
        : values.templateHash!;
    filled.set(value, slot.offset + placeholderPrefixLength(slot.length));
  }
  return filled;
}

/** Reads the filled constants back, for a caller that has a deployed script and its descriptor. */
export function readPlaceholders(
  script: Uint8Array,
  placeholders: CompositionPlaceholders,
): { category: Uint8Array; contractAddress: Uint8Array; templateHash?: Uint8Array } {
  const bounds = (offset: number, length: number): void => {
    if (offset < 0 || offset + placeholderPushLength(length) > script.length) {
      throw new FramedEncodingError(`slot at ${offset} is outside a ${script.length}-byte script`);
    }
  };
  bounds(placeholders.categoryOffset, CATEGORY_SLOT_LENGTH);
  bounds(placeholders.addressOffset, ADDRESS_SLOT_LENGTH);
  const at = (offset: number, length: number): Uint8Array => {
    const start = offset + placeholderPrefixLength(length);
    return script.subarray(start, start + length);
  };
  const read: { category: Uint8Array; contractAddress: Uint8Array; templateHash?: Uint8Array } = {
    category: at(placeholders.categoryOffset, CATEGORY_SLOT_LENGTH),
    contractAddress: at(placeholders.addressOffset, ADDRESS_SLOT_LENGTH),
  };
  if (placeholders.templateHashOffset !== undefined) {
    read.templateHash = at(placeholders.templateHashOffset, TEMPLATE_HASH_SLOT_LENGTH);
  }
  return read;
}
