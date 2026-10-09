/**
 * A contract's balance in script: the value of its satoshi containers (spec section 4b).
 *
 * A container is a tokenless UTXO at the container covenant's P2SH32 lock for the contract's category, the one the
 * direct convention uses (`buildSatoshiContainerCovenantScript`). Its master path opens whenever a master of the
 * category is spent beside it, so a master that accepts value has to account for its containers itself: growth
 * over the transaction, outputs at the lock less inputs at it, must cover the value its frame receives.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { OpcodesBchSpec as Opcodes } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/spec/bch-spec-opcodes.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
;
import {
  WITNESS_BLOCK_HEADER_LENGTH,
  dropPrefix,
  readOwnWitnessBlockScript,
  takeFixedWidthField,
  takeLengthPrefixedField,
  takeLengthPrefixedField32,
} from './witness-reader.js';

/** The covenant bytes before the first category push. */
const COVENANT_PREFIX = hexToBin('63ce01207f5288');
/** The covenant bytes between the two category pushes. */
const COVENANT_MIDDLE = hexToBin(
  '8867767676cdc0c788ccc0c6a269d1c0ce88d3c0d0a269c0c7c38c6576c09c6476c75279879169688c76009f66757568',
);
/** The covenant bytes after the second category push. */
const COVENANT_SUFFIX = hexToBin('7551');
/** `OP_HASH256 OP_PUSHBYTES_32`, the front of a P2SH32 lock. */
const P2SH32_FRONT = hexToBin('aa20');
/** `OP_EQUAL`, the end of a P2SH32 lock. */
const P2SH32_END = hexToBin('87');

/**
 * Leaves the container lock of the category on top.
 *
 * Entry `[..., category]`, exit `[..., lock]`. The category is the 32 bytes `OP_UTXOTOKENCATEGORY` answers with,
 * pushed twice into the covenant, which is then hashed into its P2SH32 lock.
 */
export function containerLockScript(): number[] {
  return [
    ...encodeDataPush(new Uint8Array([0x20])), Opcodes.OP_SWAP, Opcodes.OP_CAT,
    Opcodes.OP_DUP,
    ...encodeDataPush(COVENANT_PREFIX), Opcodes.OP_SWAP, Opcodes.OP_CAT,
    ...encodeDataPush(COVENANT_MIDDLE), Opcodes.OP_CAT,
    Opcodes.OP_SWAP, Opcodes.OP_CAT,
    ...encodeDataPush(COVENANT_SUFFIX), Opcodes.OP_CAT,
    Opcodes.OP_HASH256,
    ...encodeDataPush(P2SH32_FRONT), Opcodes.OP_SWAP, Opcodes.OP_CAT,
    ...encodeDataPush(P2SH32_END), Opcodes.OP_CAT,
  ];
}

/**
 * Leaves the container lock of the running master's own category.
 *
 * Entry `[...]`, exit `[..., lock]`. The category is the running input's own, which the prologue pinned, so a master
 * accounts for the containers its own presence opens.
 */
export function selfContainerLockScript(): number[] {
  return [
    Opcodes.OP_INPUTINDEX, Opcodes.OP_UTXOTOKENCATEGORY,
    ...encodeDataPush(new Uint8Array([32])), Opcodes.OP_SPLIT, Opcodes.OP_DROP,
    ...containerLockScript(),
  ];
}

/**
 * Leaves the growth of the containers at a lock over the transaction.
 *
 * Entry `[..., lock]`, exit `[..., growth]`: the value of the outputs at the lock less the value of the inputs at it.
 */
export function containerGrowthScript(): number[] {
  return [
    // [lock, growth, index]
    Opcodes.OP_0, Opcodes.OP_0,
    Opcodes.OP_BEGIN,
    Opcodes.OP_DUP, Opcodes.OP_TXOUTPUTCOUNT, Opcodes.OP_LESSTHAN,
    Opcodes.OP_IF,
    Opcodes.OP_DUP, Opcodes.OP_OUTPUTBYTECODE, Opcodes.OP_3, Opcodes.OP_PICK, Opcodes.OP_EQUAL,
    Opcodes.OP_IF,
    Opcodes.OP_DUP, Opcodes.OP_OUTPUTVALUE, Opcodes.OP_ROT, Opcodes.OP_ADD, Opcodes.OP_SWAP,
    Opcodes.OP_ENDIF,
    Opcodes.OP_ENDIF,
    Opcodes.OP_DUP, Opcodes.OP_TXINPUTCOUNT, Opcodes.OP_LESSTHAN,
    Opcodes.OP_IF,
    Opcodes.OP_DUP, Opcodes.OP_UTXOBYTECODE, Opcodes.OP_3, Opcodes.OP_PICK, Opcodes.OP_EQUAL,
    Opcodes.OP_IF,
    Opcodes.OP_DUP, Opcodes.OP_UTXOVALUE, Opcodes.OP_ROT, Opcodes.OP_SWAP, Opcodes.OP_SUB, Opcodes.OP_SWAP,
    Opcodes.OP_ENDIF,
    Opcodes.OP_ENDIF,
    Opcodes.OP_1ADD,
    Opcodes.OP_DUP, Opcodes.OP_TXINPUTCOUNT, Opcodes.OP_TXOUTPUTCOUNT, Opcodes.OP_MAX, Opcodes.OP_GREATERTHANOREQUAL,
    Opcodes.OP_UNTIL,
    Opcodes.OP_DROP, Opcodes.OP_NIP,
  ];
}

/**
 * Leaves the value of a run of consecutive outputs: what a frame's sends pay when a loop makes them.
 *
 * Entry `[..., count, first]`, exit `[..., paid]`: the value of outputs `first` to `first + count - 1`, or zero for
 * an empty run, whose first output is the no-index sentinel and is never read.
 */
export function sendRunValuesScript(): number[] {
  return [
    // [first, paid, left]
    Opcodes.OP_0, Opcodes.OP_ROT,
    Opcodes.OP_DUP, Opcodes.OP_0, Opcodes.OP_GREATERTHAN,
    Opcodes.OP_IF,
    Opcodes.OP_BEGIN,
    Opcodes.OP_1SUB,
    Opcodes.OP_DUP, Opcodes.OP_3, Opcodes.OP_PICK, Opcodes.OP_ADD, Opcodes.OP_OUTPUTVALUE,
    Opcodes.OP_ROT, Opcodes.OP_ADD, Opcodes.OP_SWAP,
    Opcodes.OP_DUP, Opcodes.OP_0, Opcodes.OP_LESSTHANOREQUAL,
    Opcodes.OP_UNTIL,
    Opcodes.OP_ENDIF,
    Opcodes.OP_DROP, Opcodes.OP_NIP,
  ];
}

/**
 * Leaves the value the frame's call records pass on: what the running master pays through its calls.
 *
 * Entry `[...]`, exit `[..., paid]`. Each record's `value` is bound at the site that made the call, so their sum is
 * what the master's own code passes; the block is read again from the master's own input.
 */
export function callValuesScript(): number[] {
  return [
    ...readOwnWitnessBlockScript(),
    ...dropPrefix(WITNESS_BLOCK_HEADER_LENGTH),
    ...takeLengthPrefixedField(), Opcodes.OP_NIP, // sender
    ...takeLengthPrefixedField(), Opcodes.OP_NIP, // self
    ...takeFixedWidthField(8), Opcodes.OP_NIP, // value
    ...takeLengthPrefixedField32(), Opcodes.OP_NIP, // retval
    // [count, paid, tail]
    ...takeFixedWidthField(2), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, Opcodes.OP_0, Opcodes.OP_ROT,
    Opcodes.OP_2, Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_GREATERTHAN,
    Opcodes.OP_IF,
    Opcodes.OP_BEGIN,
    ...takeFixedWidthField(1), Opcodes.OP_NIP, // kind
    ...takeLengthPrefixedField(), Opcodes.OP_NIP, // target
    ...takeFixedWidthField(8), Opcodes.OP_SWAP, Opcodes.OP_BIN2NUM, // value
    Opcodes.OP_ROT, Opcodes.OP_ADD, Opcodes.OP_SWAP,
    ...takeFixedWidthField(2), Opcodes.OP_NIP, // calleeRef
    ...takeFixedWidthField(32), Opcodes.OP_NIP, // argsHash
    ...takeLengthPrefixedField32(), Opcodes.OP_NIP, // result
    Opcodes.OP_ROT, Opcodes.OP_1SUB, Opcodes.OP_ROT, Opcodes.OP_ROT,
    Opcodes.OP_2, Opcodes.OP_PICK, Opcodes.OP_0, Opcodes.OP_LESSTHANOREQUAL,
    Opcodes.OP_UNTIL,
    Opcodes.OP_ENDIF,
    Opcodes.OP_DROP, Opcodes.OP_NIP,
  ];
}
