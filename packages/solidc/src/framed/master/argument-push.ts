/**
 * The wire's canonical push of a value, emitted as script.
 *
 * A call's argument pushes are the bytes between the caller's selector and its callee's witness block, and they
 * have one encoding: the empty value is `OP_0`, a one-byte value in `0x01`-`0x10` is `OP_1`-`OP_16`, `0x81` is
 * `OP_1NEGATE`, and every other value is a direct push below 76 bytes, `PUSHDATA1` below 256 and `PUSHDATA2`
 * above. A caller that computes its argument digest from values it holds at run time has to produce exactly
 * those bytes, because the digest it records is the one the callee's own pushes hash to.
 *
 * Entry `[..., value]`, exit `[..., push]`. A bounded numeric value is a VM number first, so the same number has
 * one encoding however the code that produced it formatted it; a value the VM holds as raw bytes is taken as it
 * is, which is how `bytesN`, `string`, an address and an arbitrary-precision integer are already canonical.
 *
 * Lengths above 65,535 would take `PUSHDATA4`, which no argument reaches: the unlocking bytecode that has to
 * carry the push is bounded by the consensus limit of 10,000 bytes, so a value that long cannot be co-spent.
 */

import { OpcodesBchSpec as Opcodes } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/spec/bch-spec-opcodes.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';

/** The longest payload a direct push carries in its opcode. */
const LONGEST_DIRECT_PUSH = 0x4b;
/** The opcode that introduces a one-byte length, and the longest payload it carries. */
const PUSHDATA1 = 0x4c;
const LARGEST_ONE_BYTE_LENGTH = 0xff;
/** The opcode that introduces a two-byte length. */
const PUSHDATA2 = 0x4d;
/** The opcode that pushes `-1`, which a one-byte `0x81` value uses. */
const OP_1NEGATE = 0x4f;
/** The opcode byte a one-byte value in `0x01`-`0x10` pushes from, `OP_1` minus one. */
const SMALL_INTEGER_BASE = 0x50;

/** A one-byte data item: the opcode or length byte the fragment concatenates. */
const singleByte = (value: number): Uint8Array => encodeDataPush(Uint8Array.from([value]));

/**
 * A threshold as a script number: a byte at or above `0x80` would otherwise read negative, so `0xff` is the two
 * bytes `ff00` and not the single byte `ff`.
 */
const numberPush = (value: number): Uint8Array => {
  const bytes: number[] = [];
  let rest = value;
  while (rest > 0) {
    bytes.push(rest & 0xff);
    rest = Math.floor(rest / 256);
  }
  if (bytes.length > 0 && (bytes[bytes.length - 1]! & 0x80) !== 0) bytes.push(0x00);
  return encodeDataPush(new Uint8Array(bytes));
};

/**
 * Builds the fragment that turns the value on top into the push the wire carries.
 *
 * `numeric` adds a `OP_BIN2NUM` first, for a declared type whose value the VM holds as a number.
 */
export function canonicalPushScript(numeric: boolean): Uint8Array {
  const bytes: number[] = [];
  const emit = (...ops: readonly (number | Uint8Array)[]): void => { pushAll(bytes, ops); };
  // A number's canonical value is its minimal encoding.
  if (numeric) emit(Opcodes.OP_BIN2NUM);
  // `[value]`, then its length, which is what chooses the form. The length is re-read in each arm rather than
  // kept, so every arm starts and ends with the value alone.
  emit(Opcodes.OP_DUP, Opcodes.OP_SIZE, Opcodes.OP_NIP, Opcodes.OP_0, Opcodes.OP_NUMEQUAL, Opcodes.OP_IF);
  // The empty value pushes nothing: its push is the `OP_0` opcode byte itself.
  emit(Opcodes.OP_DROP, singleByte(0x00));
  emit(Opcodes.OP_ELSE);
  emit(Opcodes.OP_DUP, Opcodes.OP_SIZE, Opcodes.OP_NIP, numberPush(1), Opcodes.OP_NUMEQUAL, Opcodes.OP_IF);
  // One byte: `0x01`-`0x10` and `0x81` have an opcode of their own.
  emit(Opcodes.OP_DUP, numberPush(1), Opcodes.OP_SPLIT, Opcodes.OP_DROP);
  emit(Opcodes.OP_DUP, numberPush(0x01), Opcodes.OP_GREATERTHANOREQUAL,
    Opcodes.OP_OVER, numberPush(0x10), Opcodes.OP_LESSTHANOREQUAL, Opcodes.OP_BOOLAND);
  emit(Opcodes.OP_IF);
  // `OP_1`-`OP_16`: the opcode byte is the value plus the base.
  emit(Opcodes.OP_BIN2NUM, numberPush(SMALL_INTEGER_BASE), Opcodes.OP_ADD, Opcodes.OP_NIP);
  emit(Opcodes.OP_ELSE);
  emit(Opcodes.OP_DUP, singleByte(0x81), Opcodes.OP_EQUAL);
  emit(Opcodes.OP_IF);
  emit(Opcodes.OP_2DROP, singleByte(OP_1NEGATE));
  emit(Opcodes.OP_ELSE);
  // Any other one-byte value: a direct push of one byte.
  emit(Opcodes.OP_DROP, singleByte(0x01), Opcodes.OP_SWAP, Opcodes.OP_CAT);
  emit(Opcodes.OP_ENDIF);
  emit(Opcodes.OP_ENDIF);
  emit(Opcodes.OP_ELSE);
  // Two bytes or more: the length is the opcode below 76, `PUSHDATA1`'s length byte below 256, and a two-byte
  // little-endian length above it.
  emit(Opcodes.OP_DUP, Opcodes.OP_SIZE, Opcodes.OP_NIP);
  emit(Opcodes.OP_DUP, numberPush(LONGEST_DIRECT_PUSH), Opcodes.OP_LESSTHANOREQUAL, Opcodes.OP_IF);
  emit(Opcodes.OP_SWAP, Opcodes.OP_CAT);
  emit(Opcodes.OP_ELSE);
  emit(Opcodes.OP_DUP, numberPush(LARGEST_ONE_BYTE_LENGTH), Opcodes.OP_LESSTHANOREQUAL, Opcodes.OP_IF);
  // The length field is unsigned, so the byte comes from the two-byte form's low byte: `0xff` as a script number
  // is `ff00`, and one byte of it is the length `255` the wire writes.
  emit(numberPush(2), Opcodes.OP_NUM2BIN, numberPush(1), Opcodes.OP_SPLIT, Opcodes.OP_DROP, singleByte(PUSHDATA1),
    Opcodes.OP_SWAP, Opcodes.OP_CAT, Opcodes.OP_SWAP, Opcodes.OP_CAT);
  emit(Opcodes.OP_ELSE);
  emit(numberPush(2), Opcodes.OP_NUM2BIN, singleByte(PUSHDATA2),
    Opcodes.OP_SWAP, Opcodes.OP_CAT, Opcodes.OP_SWAP, Opcodes.OP_CAT);
  emit(Opcodes.OP_ENDIF);
  emit(Opcodes.OP_ENDIF);
  emit(Opcodes.OP_ENDIF);
  emit(Opcodes.OP_ENDIF);
  return new Uint8Array(bytes);
}

/** Appends opcode bytes and pushed payloads, so the builder can mix numbers and `encodeDataPush` results. */
function pushAll(target: number[], ops: readonly (number | Uint8Array)[]): void {
  for (const op of ops) {
    if (typeof op === 'number') target.push(op);
    else target.push(...op);
  }
}
