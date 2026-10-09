import { binsAreEqual } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
;
;
;
import { Op, sha256 } from '@solidcash/utils';
import { decodeScriptNumber } from './trace-commitment-helpers.js';
import { matchesProbeOpcodeSequence } from './probe-instruction-sequence.js';

// emitReturnCovenant checks a long return against either its digest or the legacy raw commitment. Unlike
// the short-return EQUALVERIFY, this pin ends in BOOLOR VERIFY and must retain the digest's preimage.
const HASH_PREFIX = [Op.OP_DUP, Op.OP_SHA256, Op.OP_2, Op.OP_PICK];
const REVERSED_HASH_PREFIX = [...HASH_PREFIX].reverse();
const HASH_OR_RAW_PIN = [
  Op.OP_2DUP, Op.OP_EQUAL, Op.OP_TOALTSTACK, Op.OP_TOALTSTACK, Op.OP_DROP,
  Op.OP_FROMALTSTACK, Op.OP_EQUAL, Op.OP_FROMALTSTACK, Op.OP_BOOLOR, Op.OP_VERIFY,
];

/** Recover only the preimage bound to the compiler's exact targeted hash-or-raw return covenant. */
export function extractHashedReturnCommitmentAtOutput(
  trace: readonly AuthenticationProgramStateCommon[], outputIndex: number,
): Uint8Array | undefined {
  for (let index = trace.length - 1; index >= 0; index -= 1) {
    const state = trace[index];
    if (state.controlStack.some((flag) => flag === false) || state.stack.length < 3) continue;
    if (state.instructions[state.ip]?.opcode !== Op.OP_OUTPUTTOKENCOMMITMENT) continue;
    if (decodeScriptNumber(state.stack.at(-1)!) !== BigInt(outputIndex)) continue;
    if (!matchesProbeOpcodeSequence(state, -1, REVERSED_HASH_PREFIX)) continue;
    if (!matchesProbeOpcodeSequence(state, 1, HASH_OR_RAW_PIN)) continue;
    const value = state.stack.at(-3)!;
    const digest = state.stack.at(-2)!;
    if (value.length <= 128 || digest.length !== 32 || !binsAreEqual(sha256(value), digest)) continue;
    return value.slice();
  }
  return undefined;
}
