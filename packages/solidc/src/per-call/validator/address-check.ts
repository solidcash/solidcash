/**
 * The contract address a covered master must present as `self`.
 *
 * A root, message call, read-only call or create frame takes `address(this)` from its own category. A delegate or
 * internal frame runs on the caller's records, so its `self` is not that constant and this fragment does not check
 * it.
 *
 * Entry is `[pin, payload]`, with the payload on top, and exit is `[]`. `pin` is 33 bytes: the category in the
 * order `OP_UTXOTOKENCATEGORY` reports, followed by the mutable capability. The fragment does not read the token.
 * `payload` is that master's witness block. The header and the `sender` / `self` / `value` fields are read by the
 * same scripts a master uses, so a length with its sign bit set is an unsigned number before it is used as a split.
 *
 * The address is the P2SH32 lock of `push(pin) || program`. A 33-byte pin is a direct push (`0x21`). Pass `program`
 * to push that constant, or `fromAltStack` when the bytes were parked at the start of the validator program.
 */

import { Opcodes, encodeDataPush } from '@bitauth/libauth';
import { CATEGORY_PIN_LENGTH, FrameKind, encodeInt } from '@solidcash/utils';
import {
  readFrameFieldsScript,
  readFrameHeaderScript,
  unsignedLength,
} from '../master/witness-reader.js';

/** `OP_HASH256 OP_PUSHBYTES_32`, then the hash, then `OP_EQUAL`. That is what `encodeLockingBytecodeP2sh32` writes. */
const P2SH32_PREFIX = new Uint8Array([Opcodes.OP_HASH256, Opcodes.OP_PUSHBYTES_32]);
const P2SH32_SUFFIX = new Uint8Array([Opcodes.OP_EQUAL]);

/**
 * The P2SH32 lock of `push(pin) || program`, the address a covered master of `pin`'s category presents.
 *
 * Entry is `[pin]`, exit is `[address]`; anything the caller holds below `pin` is left in place. `pin` is the
 * 33-byte mutable category pin in chain order. Pass the validator program to push it as a constant, which is how a
 * test runs the fragment on its own. Pass `{ fromActiveBytecode: true }` from the validator: the redeem script is
 * `push(pin) || program`, so the program is what follows that push in the script now running. Pushing the program
 * as a constant would nest it inside itself.
 */
export function addressFromPinScript(source: Uint8Array | { fromActiveBytecode: true }): Uint8Array {
  const programOnStack = source instanceof Uint8Array
    ? concat(encodeDataPush(source), op(Opcodes.OP_CAT))
    : concat(
      op(Opcodes.OP_ACTIVEBYTECODE),
      pushInt(1 + CATEGORY_PIN_LENGTH),
      op(Opcodes.OP_SPLIT, Opcodes.OP_NIP, Opcodes.OP_CAT),
    );

  // `[pin, 0x21 || pin || program]`, hashed and wrapped into the P2SH32 lock.
  return concat(
    encodeDataPush(new Uint8Array([CATEGORY_PIN_LENGTH])),
    op(Opcodes.OP_SWAP, Opcodes.OP_CAT),
    programOnStack,
    op(Opcodes.OP_HASH256),
    encodeDataPush(P2SH32_PREFIX),
    op(Opcodes.OP_SWAP, Opcodes.OP_CAT),
    encodeDataPush(P2SH32_SUFFIX),
    op(Opcodes.OP_CAT),
  );
}

/**
 * Script that enforces the address rule for one witness block.
 *
 * Entry is `[pin, payload]`, with the payload on top, and exit is `[]`. `pin` is the 33-byte mutable category pin
 * in chain order, and `payload` is a covered master's witness block; the `self` it claims must be the address
 * {@link addressFromPinScript} derives. Delegate and internal frames inherit their caller's address rather than
 * presenting this one, so the rule does not decide them.
 */
export function addressCheckScript(source: Uint8Array | { fromActiveBytecode: true }): Uint8Array {
  return concat(
    // `[pin, payload]`. The pin is the 33-byte mutable category.
    op(Opcodes.OP_SWAP, Opcodes.OP_SIZE),
    pushInt(CATEGORY_PIN_LENGTH),
    op(Opcodes.OP_NUMEQUALVERIFY, Opcodes.OP_SWAP),
    // `[pin, kind, caller, origin, validator, tail]`. Drop the three references; the tail starts at `sender`.
    readFrameHeaderScript(),
    op(Opcodes.OP_NIP, Opcodes.OP_NIP, Opcodes.OP_NIP, Opcodes.OP_SWAP),
    unsignedLength(),
    // Delegate and internal frames are not this rule.
    op(Opcodes.OP_DUP),
    pushInt(FrameKind.DELEGATE),
    op(Opcodes.OP_NUMEQUAL, Opcodes.OP_OVER),
    pushInt(FrameKind.INTERNAL),
    op(Opcodes.OP_NUMEQUAL, Opcodes.OP_BOOLOR, Opcodes.OP_IF),
    op(Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP),
    op(Opcodes.OP_ELSE, Opcodes.OP_DROP),
    // `[pin, sender, self, value, rest]`. Keep `self`.
    readFrameFieldsScript(),
    op(Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_NIP, Opcodes.OP_SWAP),
    // `[self, address]`, compared raw.
    addressFromPinScript(source),
    op(Opcodes.OP_EQUALVERIFY),
    op(Opcodes.OP_ENDIF),
  );
}

/** A minimal script number, pushed the way `encodeInt` encodes every other integer in the toolchain. */
function pushInt(value: number): Uint8Array {
  return encodeDataPush(encodeInt(BigInt(value)));
}

function op(...opcodes: number[]): Uint8Array {
  return Uint8Array.from(opcodes);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const out = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
