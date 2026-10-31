/**
 * A creator's child address in script: the `addrV(K)` a CREATE2 child of the running transaction presents.
 *
 * A framed child's category `K` is the txid of the genesis-eligible coin its creator's transaction spends, which
 * the creator reads from input 0's outpoint. The child's address is that category's `addrV`, and it is known only
 * once the coin exists, so the creating body computes it rather than baking it in:
 *
 *   addrV(K) = P2SH32(hash256(push(pin(K, MUTABLE)) ++ template))
 *
 * The template is the one validator program the toolchain deploys, which the creator's own validator co-spend
 * carries as its redeem script (`recogniseValidatorScriptAgainstReservedHash` reads the same push). Reading it
 * from that input keeps the creator from embedding a program of several kilobytes it would otherwise have to
 * repeat in every creating master.
 *
 * The pin is the category in the chain's own byte order followed by the mutable capability byte, pushed with
 * `OP_PUSHBYTES_33`: the same bytes `validatorRedeemScript` builds, which is what makes the address this leaves
 * the one the child's validator settles at.
 */

import { OpcodesBchSpec as Opcodes } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/spec/bch-spec-opcodes.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import { bigIntToVmNumber } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import { VALIDATOR_PIN_PUSH_LENGTH } from '@solidcash/utils';
import { dropFirstPushScript } from './witness-reader.js';

/** `OP_HASH256 OP_PUSHBYTES_32`, the front of a P2SH32 lock. */
const P2SH32_FRONT = Uint8Array.of(0xaa, 0x20);
/** `OP_EQUAL`, the end of a P2SH32 lock. */
const P2SH32_END = Uint8Array.of(0x87);
/** The push opcode a 33-byte pin begins with, which a validator redeem script opens with. */
const PIN_PUSH_OPCODE = Uint8Array.of(VALIDATOR_PIN_PUSH_LENGTH - 1);

/**
 * Bytes of the push header that carries a redeem script into an unlocking bytecode.
 *
 * A redeem script is the pin push (34 bytes) followed by the validator program, so its push is `OP_PUSHDATA2`
 * with a two-byte length: three bytes in all. The same width the head's validator recognition steps over.
 */
const REDEEM_PUSH_HEADER_LENGTH = 3;

function scriptNumber(value: number): Uint8Array {
  return bigIntToVmNumber(BigInt(value));
}

/**
 * Leaves the validator program the child's address commits to.
 *
 * Entry `[..., validatorIndex]`, exit `[..., program]`. `validatorIndex` names the input carrying the validator
 * program, which the frame's block already fixes for the head; the caller pushes it again for this read. The
 * program is what follows the transcript push and the redeem script's pin push in that input's unlocking bytecode.
 */
export function validatorProgramScript(): number[] {
  return [
    Opcodes.OP_INPUTBYTECODE,
    ...dropFirstPushScript(),
    ...encodeDataPush(scriptNumber(REDEEM_PUSH_HEADER_LENGTH)), Opcodes.OP_SPLIT, Opcodes.OP_NIP,
    ...encodeDataPush(scriptNumber(VALIDATOR_PIN_PUSH_LENGTH)), Opcodes.OP_SPLIT, Opcodes.OP_NIP,
  ];
}

/**
 * Wraps `push(pin(K)) ++ program` into the P2SH32 address `addrV(K)`.
 *
 * Entry `[..., program]`, exit `[..., lock]`. `coin` says where `K`'s input index comes from: `input0` reads input
 * 0's outpoint (a transaction that leads with the genesis-eligible coin), and `stack` reads the index already on
 * top (`[..., program, coinIndex]`), which is how a body names the transaction's `tx.origin` input.
 */
export function childAddressFromProgramScript(coin: 'input0' | 'stack' = 'input0'): number[] {
  return [
    // K: the coin's outpoint txid in the provider's display order, the order the node's wire and the category use.
    ...(coin === 'input0' ? [Opcodes.OP_0, Opcodes.OP_OUTPOINTTXHASH] : [Opcodes.OP_OUTPOINTTXHASH]),
    // pin(K, MUTABLE): the category and its capability byte, pushed as data.
    Opcodes.OP_1, Opcodes.OP_CAT,
    ...encodeDataPush(PIN_PUSH_OPCODE), Opcodes.OP_SWAP, Opcodes.OP_CAT,
    // The redeem script, then its P2SH32 lock.
    Opcodes.OP_SWAP, Opcodes.OP_CAT,
    Opcodes.OP_HASH256,
    ...encodeDataPush(P2SH32_FRONT), Opcodes.OP_SWAP, Opcodes.OP_CAT,
    ...encodeDataPush(P2SH32_END), Opcodes.OP_CAT,
  ];
}

/**
 * Leaves the child's address, `addrV(K)` of input 0's outpoint.
 *
 * Entry `[..., validatorIndex]`, exit `[..., lock]`. The transaction is expected to lead with the
 * genesis-eligible coin, whose outpoint txid is the child's category.
 */
export function childAddressScript(): number[] {
  return [...validatorProgramScript(), ...childAddressFromProgramScript('input0')];
}
