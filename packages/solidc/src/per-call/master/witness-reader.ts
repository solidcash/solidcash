/**
 * Reading a witness block inside script.
 *
 * A master's unlocking bytecode begins with its witness block as the first push, so a program can always recover the
 * block from the transaction rather than from a copy handed to it. Reading it from there is what keeps the program
 * and any verifier of the same input from ever disagreeing about the bytes: both read the one canonical location.
 *
 * The block is a minimal push, so its length class follows its own size. Realistic blocks are larger than 75 bytes
 * and at most 64 KiB, which leaves exactly two forms: a one-byte length below 256, and a two-byte length above it.
 * Both are handled, and anything else fails rather than guessing.
 *
 * Field offsets are walked from the start, because the variable-length fields before a field determine where that
 * field begins.
 */

import { encodeDataPush } from '@bitauth/libauth';
import { Opcodes } from '@bitauth/libauth';
import { WITNESS_BLOCK_MAGIC, WITNESS_BLOCK_VERSION } from '@solidcash/utils';

const op = (...opcodes: number[]): Uint8Array => new Uint8Array(opcodes);

/** Bytes before the first variable-length field: magic, version, kind, and the three frame references. */
export const WITNESS_BLOCK_HEADER_LENGTH = WITNESS_BLOCK_MAGIC.length
  + 1 // version
  + 1 // frame kind
  + 2 + 2 + 2; // caller, origin and validator references

/** The two push forms a realistic witness block can take. */
export const PUSHDATA1_OPCODE = 0x4c;
export const PUSHDATA2_OPCODE = 0x4d;

const PUSHDATA2_OPCODE_PUSH = encodeDataPush(new Uint8Array([PUSHDATA2_OPCODE]));

/** Drops the first `count` bytes of the item on top, failing when it is shorter. */
export function dropPrefix(count: number): Uint8Array {
  return new Uint8Array([...encodeDataPush(minimalNumber(count)), ...op(Opcodes.OP_SPLIT, Opcodes.OP_NIP)]);
}

/** Keeps the first `count` bytes of the item on top and drops the rest. */
export function takePrefix(count: number): Uint8Array {
  return new Uint8Array([...encodeDataPush(minimalNumber(count)), ...op(Opcodes.OP_SPLIT, Opcodes.OP_DROP)]);
}

/**
 * Takes a `u16`-length-prefixed field from the front of the item on top.
 *
 * On entry the stack holds `[..., tail]`. On exit it holds `[..., field, tailAfterField]`, so a walk can extract
 * consecutive fields and still have the remainder on top.
 */
export function takeLengthPrefixedField(): Uint8Array {
  return new Uint8Array([
    ...encodeDataPush(minimalNumber(2)),
    ...op(Opcodes.OP_SPLIT, Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_SPLIT),
  ]);
}

/** Takes a fixed-width field from the front of the item on top, leaving `[..., field, tail]`. */
export function takeFixedWidthField(width: number): Uint8Array {
  return new Uint8Array([...encodeDataPush(minimalNumber(width)), ...op(Opcodes.OP_SPLIT)]);
}

/**
 * Leaves the transaction's witness block for this input on the stack, read from the first push of the input's own
 * unlocking bytecode.
 *
 * Reads nothing and leaves one item. The push declares its own payload length, and the payload is taken at exactly
 * that length, so the pushes that follow the block — the arguments and the redeem script — are excluded rather than
 * being read as part of it. A push form outside the two a real block can use fails the split rather than being
 * interpreted as a block.
 */
export function readOwnWitnessBlockScript(): Uint8Array {
  const readPayload = (lengthFieldWidth: number): Uint8Array => new Uint8Array([
    // Step over the push opcode, leaving the length field at the front.
    ...dropPrefix(1),
    // Read the declared length, then take exactly that many bytes and discard the remainder.
    ...takeLengthField(lengthFieldWidth),
    Opcodes.OP_SPLIT,
    Opcodes.OP_DROP,
  ]);

  return new Uint8Array([
    ...op(Opcodes.OP_INPUTINDEX, Opcodes.OP_INPUTBYTECODE),
    // The opcode byte of the first push decides how long its length field is.
    ...op(Opcodes.OP_DUP),
    ...encodeDataPush(minimalNumber(1)),
    ...op(Opcodes.OP_SPLIT, Opcodes.OP_DROP),
    ...PUSHDATA2_OPCODE_PUSH,
    Opcodes.OP_EQUAL,
    Opcodes.OP_IF,
    // Two length bytes after the opcode.
    ...readPayload(2),
    Opcodes.OP_ELSE,
    // One length byte after the opcode.
    ...readPayload(1),
    Opcodes.OP_ENDIF,
  ]);
}

/** Reads a fixed-width length field from the front, leaving `[rest, length]` with the length on top. */
function takeLengthField(width: number): Uint8Array {
  return new Uint8Array([
    ...encodeDataPush(minimalNumber(width)),
    ...op(Opcodes.OP_SPLIT, Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM),
  ]);
}

/**
 * Leaves the frame's `sender`, its `self` claim and its `value` on the stack, followed by the block's remaining
 * fields.
 *
 * Reads one item (the block) and leaves four, in this order with the remainder on top:
 *
 *     [sender, self, value, rest]
 *
 * The `self` claim is always read, including for the frame kinds whose `self` comes from a code constant: those
 * kinds compare it against the constant, and comparing is only meaningful if the claim is materialised first.
 */
export function readFrameFieldsScript(): Uint8Array {
  return new Uint8Array([
    // Skip the fixed-width header.
    ...dropPrefix(WITNESS_BLOCK_HEADER_LENGTH),
    // sender, then self: each is a length-prefixed address.
    ...takeLengthPrefixedField(),
    ...takeLengthPrefixedField(),
    // value: a fixed eight bytes, little-endian. Values beyond the signed range are not reachable for satoshis.
    ...takeFixedWidthField(8),
    Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_SWAP,
  ]);
}

/** The whole frame reader: the block from its canonical location, then its frame fields. */
export function buildFrameReaderScript(): Uint8Array {
  return new Uint8Array([...readOwnWitnessBlockScript(), ...readFrameFieldsScript()]);
}

/**
 * Drops the copy of the block that the unlocking bytecode itself pushed.
 *
 * Reading the block from the transaction leaves that copy behind, and it sits *below* the frame's argument pushes,
 * because the unlocking bytecode pushes the block first and the arguments after it. So a frame drops it at the point
 * where it surfaces: before the reader when the frame takes no arguments, and otherwise once the frame has consumed
 * its arguments, which leaves the inherited copy on top.
 */
export function dropInheritedBlockPushScript(): Uint8Array {
  return op(Opcodes.OP_DROP);
}

/**
 * The reader preceded by the drop, for the common case of a frame that takes no arguments. A frame with arguments
 * drops the inherited copy after consuming them and then calls the two halves directly.
 */
export function buildArgumentlessFrameReaderScript(): Uint8Array {
  return new Uint8Array([...dropInheritedBlockPushScript(), ...buildFrameReaderScript()]);
}

/** A script number in its minimal form. */
function minimalNumber(value: number): Uint8Array {
  if (value === 0) return new Uint8Array([0x00]);
  const bytes: number[] = [];
  let rest = value;
  while (rest > 0) {
    bytes.push(rest & 0xff);
    rest = Math.floor(rest / 256);
  }
  if ((bytes[bytes.length - 1]! & 0x80) !== 0) bytes.push(0x00);
  return new Uint8Array(bytes);
}

/** The magic and version this reader expects a block to begin with, for a caller that wants to check them. */
export function expectedBlockPrefix(): Uint8Array {
  return new Uint8Array([...WITNESS_BLOCK_MAGIC, WITNESS_BLOCK_VERSION]);
}
