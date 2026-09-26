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

/** The length-prefixed push opcodes; a direct push carries its length in the opcode itself. */
export const PUSHDATA1_OPCODE = 0x4c;
export const PUSHDATA2_OPCODE = 0x4d;

const PUSHDATA1_OPCODE_PUSH = encodeDataPush(new Uint8Array([PUSHDATA1_OPCODE]));
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
  return takeLengthPrefixedFieldOfWidth(2);
}

/**
 * Takes a `u32`-length-prefixed field from the front, leaving `[..., field, tailAfterField]`.
 *
 * `retval` and a call's `result` are the fields a witness block writes this way, which is why the tail of the
 * block cannot be walked with the `u16` helper alone.
 */
export function takeLengthPrefixedField32(): Uint8Array {
  return takeLengthPrefixedFieldOfWidth(4);
}

function takeLengthPrefixedFieldOfWidth(width: number): Uint8Array {
  return new Uint8Array([
    ...encodeDataPush(minimalNumber(width)),
    ...op(Opcodes.OP_SPLIT, Opcodes.OP_SWAP),
    ...unsignedLength(),
    Opcodes.OP_SPLIT,
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

/**
 * Splits the first push off the item on top, leaving `[..., payload, rest]`.
 *
 * The opcode byte of the push decides its form: a direct push (`0x01`-`0x4b`) declares its length in the opcode
 * itself, `PUSHDATA1` follows it with one length byte, and `PUSHDATA2` with two. A push a real call data carries
 * is one of those three, so the payload is taken at exactly the declared length and the pushes that follow are
 * excluded — which is how a callee's argument pushes are separated from its selector and its redeem script.
 */
export function splitFirstPushScript(): Uint8Array {
  const readPayload = (lengthFieldWidth: number): Uint8Array => new Uint8Array([
    ...dropPrefix(1),
    ...takeLengthField(lengthFieldWidth),
    Opcodes.OP_SPLIT,
  ]);
  return new Uint8Array([
    ...op(Opcodes.OP_DUP),
    ...encodeDataPush(minimalNumber(1)),
    ...op(Opcodes.OP_SPLIT, Opcodes.OP_DROP), // the opcode, with the item below it
    ...op(Opcodes.OP_DUP),
    ...PUSHDATA2_OPCODE_PUSH,
    Opcodes.OP_EQUAL,
    Opcodes.OP_IF,
    ...op(Opcodes.OP_DROP), // the opcode, now that the two-byte form is known
    ...readPayload(2),
    Opcodes.OP_ELSE,
    ...op(Opcodes.OP_DUP),
    ...PUSHDATA1_OPCODE_PUSH,
    Opcodes.OP_EQUAL,
    Opcodes.OP_IF,
    ...op(Opcodes.OP_DROP),
    ...readPayload(1),
    Opcodes.OP_ELSE,
    // A direct push: the opcode is the length, and the payload begins after it. The opcode-only shorthands
    // (`OP_1NEGATE` and `OP_1`-`OP_16`) push data from no length at all, so they are refused rather than read as a
    // length.
    ...op(Opcodes.OP_DUP),
    ...encodeDataPush(minimalNumber(0x4b)),
    Opcodes.OP_LESSTHANOREQUAL,
    Opcodes.OP_VERIFY,
    ...op(Opcodes.OP_SWAP),
    ...dropPrefix(1),
    Opcodes.OP_SWAP,
    Opcodes.OP_SPLIT,
    Opcodes.OP_ENDIF,
    Opcodes.OP_ENDIF,
  ]);
}

/** Leaves `[..., rest]`: the item on top with its first push removed. */
export function dropFirstPushScript(): Uint8Array {
  return new Uint8Array([...splitFirstPushScript(), Opcodes.OP_NIP]);
}

/**
 * Leaves `[..., leading]`: the item on top with its **last** push removed.
 *
 * A master's unlocking bytecode ends with the redeem script, so removing the last push leaves the pushes before it
 * — the call data a callee's selector and argument pushes sit in. Which push is last is found by walking forward
 * from the start rather than by reading backwards: each push declares its own length, so the walk advances one
 * push at a time and remembers where its last step began. No assumption is made about how many pushes precede the
 * last one.
 *
 * A direct push (`0x01`-`0x4b`) declares its length in the opcode, `PUSHDATA1` follows it with one length byte and
 * `PUSHDATA2` with two, and the `OP_0`, `OP_1NEGATE` and `OP_1`-`OP_16` shorthands occupy their opcode alone. The
 * length bytes are read with `unsignedLength`, for the same reason `splitFirstPushScript` reads its own that way:
 * `OP_BIN2NUM` reads a signed little-endian number, so a length byte at or above `0x80` would otherwise come out
 * negative and the split that follows would fail.
 */
export function dropLastPushScript(): Uint8Array {
  const bytes: number[] = [];
  const emit = (...opcodes: number[]): void => { bytes.push(...opcodes); };
  const number = (value: number): void => { bytes.push(...encodeDataPush(minimalNumber(value))); };
  // Leaves `[...]` with `base + B[pos + 1 : pos + 1 + width]` on top, both read as unsigned VM numbers.
  const lengthFieldPlusBase = (width: number, base: number): void => {
    number(3); emit(Opcodes.OP_PICK); // B
    number(2); emit(Opcodes.OP_PICK); // pos
    emit(Opcodes.OP_1ADD, Opcodes.OP_SPLIT, Opcodes.OP_NIP); // B from pos + 1
    number(width); emit(Opcodes.OP_SPLIT, Opcodes.OP_DROP); // the length bytes
    emit(...unsignedLength());
    number(base); emit(Opcodes.OP_ADD);
  };

  // [B] -> [B, total, pos, lastPos]
  emit(Opcodes.OP_DUP, Opcodes.OP_SIZE, Opcodes.OP_NIP);
  emit(Opcodes.OP_0, Opcodes.OP_DUP);
  emit(Opcodes.OP_BEGIN);
  // total > pos ?
  number(2); emit(Opcodes.OP_PICK);
  number(2); emit(Opcodes.OP_PICK);
  emit(Opcodes.OP_GREATERTHAN, Opcodes.OP_IF);
  emit(Opcodes.OP_DROP, Opcodes.OP_DUP); // lastPos = pos
  // The opcode at pos, as an unsigned number.
  number(3); emit(Opcodes.OP_PICK); // B
  number(2); emit(Opcodes.OP_PICK); // pos
  emit(Opcodes.OP_SPLIT, Opcodes.OP_NIP);
  number(1); emit(Opcodes.OP_SPLIT, Opcodes.OP_DROP);
  emit(...unsignedLength());
  // The push's total length, from the opcode that introduces it.
  emit(Opcodes.OP_DUP, Opcodes.OP_0, Opcodes.OP_EQUAL, Opcodes.OP_IF);
  emit(Opcodes.OP_DROP, Opcodes.OP_1); // OP_0 pushes nothing and is one byte
  emit(Opcodes.OP_ELSE, Opcodes.OP_DUP);
  number(0x4b); emit(Opcodes.OP_LESSTHANOREQUAL, Opcodes.OP_IF);
  emit(Opcodes.OP_1ADD); // a direct push: opcode plus payload
  emit(Opcodes.OP_ELSE, Opcodes.OP_DUP);
  number(0x4c); emit(Opcodes.OP_EQUAL, Opcodes.OP_IF);
  emit(Opcodes.OP_DROP); lengthFieldPlusBase(1, 2); // PUSHDATA1
  emit(Opcodes.OP_ELSE, Opcodes.OP_DUP);
  number(0x4d); emit(Opcodes.OP_EQUAL, Opcodes.OP_IF);
  emit(Opcodes.OP_DROP); lengthFieldPlusBase(2, 3); // PUSHDATA2
  emit(Opcodes.OP_ELSE, Opcodes.OP_DUP);
  number(0x4e); emit(Opcodes.OP_EQUAL, Opcodes.OP_IF);
  emit(Opcodes.OP_DROP); lengthFieldPlusBase(4, 5); // PUSHDATA4
  emit(Opcodes.OP_ELSE);
  // A shorthand: `OP_1NEGATE` or `OP_1`-`OP_16`, whose byte comes from the opcode alone.
  emit(Opcodes.OP_DROP, Opcodes.OP_1);
  emit(Opcodes.OP_ENDIF); // PUSHDATA4
  emit(Opcodes.OP_ENDIF); // PUSHDATA2
  emit(Opcodes.OP_ENDIF); // PUSHDATA1
  emit(Opcodes.OP_ENDIF); // direct push
  emit(Opcodes.OP_ENDIF); // OP_0
  // pos += size
  emit(Opcodes.OP_ROT, Opcodes.OP_ADD, Opcodes.OP_SWAP);
  emit(Opcodes.OP_0);
  emit(Opcodes.OP_ELSE, Opcodes.OP_1);
  emit(Opcodes.OP_ENDIF);
  emit(Opcodes.OP_UNTIL);
  // [B, total, pos, lastPos] -> [leading]
  emit(Opcodes.OP_NIP); // pos
  number(2); emit(Opcodes.OP_PICK); // B
  emit(Opcodes.OP_OVER); // lastPos
  // Split B at the last push's start, then keep only its first part.
  emit(Opcodes.OP_SPLIT, Opcodes.OP_DROP, Opcodes.OP_NIP, Opcodes.OP_NIP, Opcodes.OP_NIP);
  return new Uint8Array(bytes);
}

/** Reads a fixed-width length field from the front, leaving `[rest, length]` with the length on top. */
function takeLengthField(width: number): Uint8Array {
  return new Uint8Array([
    ...encodeDataPush(minimalNumber(width)),
    ...op(Opcodes.OP_SPLIT, Opcodes.OP_SWAP),
    ...unsignedLength(),
  ]);
}

/**
 * Converts the length bytes on top into an unsigned VM Number.
 *
 * `OP_BIN2NUM` reads a signed little-endian number, so a one-byte length of `0x80` and up would come out negative
 * and the split that follows would fail. Appending a zero byte forces the sign, which costs no meaning: the
 * length is never negative.
 */
function unsignedLength(): Uint8Array {
  return new Uint8Array([
    ...encodeDataPush(new Uint8Array([0x00])), Opcodes.OP_CAT, Opcodes.OP_BIN2NUM,
  ]);
}

/**
 * Leaves the frame's fixed header fields on the stack, having first required that the block begins with the expected
 * magic and version.
 *
 * Leaves `[kind, callerRef, originRef, validatorRef, tail]`, so the variable-length fields that follow can be walked
 * on top. The magic check is what stops a byte string that merely starts with a length from being read as a block.
 */
export function readFrameHeaderScript(): Uint8Array {
  const prefix = expectedBlockPrefix();
  return new Uint8Array([
    // Compare the leading magic and version with the constant, keeping the rest.
    ...encodeDataPush(minimalNumber(prefix.length)),
    ...op(Opcodes.OP_SPLIT, Opcodes.OP_SWAP),
    ...encodeDataPush(prefix),
    Opcodes.OP_EQUALVERIFY,
    // kind, then the three frame references.
    ...takeFixedWidthField(1),
    ...takeFixedWidthField(2),
    ...takeFixedWidthField(2),
    ...takeFixedWidthField(2),
  ]);
}

/**
 * Leaves the frame's `sender`, its `self` claim and its `value` on the stack, followed by the block's remaining
 * fields.
 *
 * Reads one item (a block whose header has already been taken) and leaves four, in this order with the remainder on
 * top:
 *
 *     [sender, self, value, rest]
 *
 * The `self` claim is always read, including for the frame kinds whose `self` comes from a code constant: those
 * kinds compare it against the constant, and comparing is only meaningful if the claim is materialised first.
 */
export function readFrameFieldsScript(): Uint8Array {
  return new Uint8Array([
    // sender, then self: each is a length-prefixed address.
    ...takeLengthPrefixedField(),
    ...takeLengthPrefixedField(),
    // value: a fixed eight bytes, little-endian. Values beyond the signed range are not reachable for satoshis.
    ...takeFixedWidthField(8),
    Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_SWAP,
  ]);
}

/**
 * The whole frame reader, header then fields, for a frame whose block is the only thing on the stack besides the
 * inherited copy.
 *
 * Leaves `[kind, callerRef, originRef, validatorRef, sender, self, value, rest]`. The inherited copy of the block
 * push has to be dropped first for a frame that takes no arguments; see `dropInheritedBlockPushScript`.
 */
export function readWholeFrameScript(): Uint8Array {
  return new Uint8Array([...readOwnWitnessBlockScript(), ...readFrameHeaderScript(), ...readFrameFieldsScript()]);
}

/** The whole frame reader: the block from its canonical location, then its frame fields. */
export function buildFrameReaderScript(): Uint8Array {
  return readWholeFrameScript();
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
