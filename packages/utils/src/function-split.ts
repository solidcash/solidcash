/**
 * Per-function loader identity for a `solidcash-split-v2` shard.
 *
 * The loader redeem script pushes that function's code hash and selector. The lock is the P2SH32 of that
 * script, so two functions do not share a loader. A loader whose function id lives only in the witness or
 * the commitment is a different script and is not in this table.
 */

import { encodeLockingBytecodeP2sh32 } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import { hash256 } from './hash.js';
import { Op, asmToBytecode } from './script.js';

/** P2SH32 locking bytecode of an artifact's published redeem script, as hex. Placeholders are still empty. */
export function publishedRedeemLock(bytecodeAsm: string): string {
  return binToHex(encodeLockingBytecodeP2sh32(hash256(asmToBytecode(bytecodeAsm))));
}

/** A script number in its minimal unsigned form. Zero is a single `0x00` byte, which `encodeDataPush` makes `OP_0`. */
function minimalNumber(value: number): Uint8Array {
  if (value === 0) return Uint8Array.of(0x00);
  const bytes: number[] = [];
  let rest = value;
  while (rest > 0) {
    bytes.push(rest & 0xff);
    rest = Math.floor(rest / 256);
  }
  if ((bytes[bytes.length - 1]! & 0x80) !== 0) bytes.push(0x00);
  return Uint8Array.from(bytes);
}

/** `OP_BIN2NUM` reads a signed number. A trailing zero keeps a length non-negative. */
function unsignedLengthScript(): Uint8Array {
  return Uint8Array.from([...encodeDataPush(Uint8Array.of(0x00)), Op.OP_CAT, Op.OP_BIN2NUM]);
}

/** Drops the first `count` bytes of the item on top. */
function dropPrefixScript(count: number): Uint8Array {
  return Uint8Array.from([...encodeDataPush(minimalNumber(count)), Op.OP_SPLIT, Op.OP_NIP]);
}

/** Reads a fixed-width length from the front, leaving `[rest, length]`. */
function takeLengthFieldScript(width: number): Uint8Array {
  return Uint8Array.from([
    ...encodeDataPush(minimalNumber(width)),
    Op.OP_SPLIT,
    Op.OP_SWAP,
    ...unsignedLengthScript(),
  ]);
}

/**
 * Splits the first push off the item on top, leaving `[payload, rest]`.
 *
 * A direct push (`0x01`–`0x4b`), `PUSHDATA1` and `PUSHDATA2` are taken at the length they declare. The
 * opcode-only shorthands (`OP_1`–`OP_16`) are refused: they carry no payload.
 */
function splitFirstPushScript(): Uint8Array {
  const readPayload = (width: number): Uint8Array => Uint8Array.from([
    ...dropPrefixScript(1),
    ...takeLengthFieldScript(width),
    Op.OP_SPLIT,
  ]);
  return Uint8Array.from([
    Op.OP_DUP,
    ...encodeDataPush(minimalNumber(1)),
    Op.OP_SPLIT,
    Op.OP_DROP,
    Op.OP_DUP,
    ...encodeDataPush(Uint8Array.of(0x4d)),
    Op.OP_EQUAL,
    Op.OP_IF,
    Op.OP_DROP,
    ...readPayload(2),
    Op.OP_ELSE,
    Op.OP_DUP,
    ...encodeDataPush(Uint8Array.of(0x4c)),
    Op.OP_EQUAL,
    Op.OP_IF,
    Op.OP_DROP,
    ...readPayload(1),
    Op.OP_ELSE,
    Op.OP_DUP,
    ...encodeDataPush(minimalNumber(0x4b)),
    Op.OP_LESSTHANOREQUAL,
    Op.OP_VERIFY,
    Op.OP_SWAP,
    ...dropPrefixScript(1),
    Op.OP_SWAP,
    Op.OP_SPLIT,
    Op.OP_ENDIF,
    Op.OP_ENDIF,
  ]);
}

/**
 * The redeem script of one function's loader.
 *
 * The script pushes that function's code hash and selector, so the P2SH32 lock names one function. The
 * unlocking bytecode leaves one item under the redeem script: the input index of the carrier that holds
 * this function's code. The script drops the two identity pushes, reads that input, checks the first push
 * is the code, and invokes it. `OP_DEFINE` takes an identifier of at most seven bytes; a selector is four.
 * Each input is its own execution, so one carrier serves every master of this function in the transaction.
 */
export function functionSplitLoaderScript(codeHash: Uint8Array, selector: Uint8Array): Uint8Array {
  if (codeHash.length !== 32) {
    throw new Error(`a function loader code hash is 32 bytes: got ${codeHash.length}`);
  }
  if (selector.length !== 4) {
    throw new Error(`a function loader selector is 4 bytes: got ${selector.length}`);
  }
  return Uint8Array.from([
    ...encodeDataPush(codeHash),
    ...encodeDataPush(selector),
    Op.OP_2DROP,
    Op.OP_INPUTBYTECODE,
    ...splitFirstPushScript(),
    Op.OP_DROP,
    Op.OP_DUP,
    Op.OP_HASH256,
    ...encodeDataPush(codeHash),
    Op.OP_EQUALVERIFY,
    ...encodeDataPush(selector),
    Op.OP_DEFINE,
    ...encodeDataPush(selector),
    Op.OP_INVOKE,
  ]);
}

/** P2SH32 lock of a per-function loader script. */
export function functionSplitLoaderLock(script: Uint8Array): Uint8Array {
  return encodeLockingBytecodeP2sh32(hash256(script));
}

/**
 * Whether `lockHex` is absent from the per-function loader table.
 *
 * Discovery at rest is this comparison. A shared loader, whose function id is only in the witness or the
 * commitment, has a lock the table does not publish, so it is rejected.
 */
export function isRejectedFunctionLoader(lockHex: string, loaders: readonly { lock: string }[]): boolean {
  const normalized = lockHex.replace(/^0x/i, '').toLowerCase();
  return !loaders.some((loader) => loader.lock.replace(/^0x/i, '').toLowerCase() === normalized);
}
