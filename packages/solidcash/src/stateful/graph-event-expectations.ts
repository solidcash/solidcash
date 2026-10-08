import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Output } from '@bitauth/libauth/build/lib/message/transaction-types.js';
;
;
import { vmNumberToBigInt } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
;
;
;
import { Op } from '@solidcash/utils';
import { isP2sh32LockingBytecode } from './faithful-probe-trace.js';

interface EventExpectation {
  commitment: string;
  lockingBytecode: string;
}

/** Match the compiler's commitment-and-lock test inside a bounded graph event window. */
function graphEventLockReadIp(state: AuthenticationProgramStateCommon): number | undefined {
  const expected = [
    Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUAL, undefined, Op.OP_PICK,
    undefined, Op.OP_PICK, Op.OP_OUTPUTBYTECODE, Op.OP_EQUAL, Op.OP_BOOLAND, Op.OP_IF,
  ];
  if (!expected.every((opcode, offset) => opcode === undefined
    || state.instructions[state.ip + offset]?.opcode === opcode)) return undefined;
  return state.ip + 6;
}

/** Outputs inspected by a graph event search must not fall back to commitment-only equality matching. */
export function graphEventCandidateIndices(
  trace: readonly AuthenticationProgramStateCommon[],
): ReadonlySet<number> {
  return new Set(trace.flatMap((state) => {
    if (state.controlStack.includes(false) || state.stack.length < 2
      || graphEventLockReadIp(state) === undefined) return [];
    return [Number(vmNumberToBigInt(state.stack.at(-1)!))];
  }));
}

/**
 * A graph event searches several candidate outputs. Pair its commitment with the lock operand from the same
 * candidate comparison, then publish one expectation for the window. Generic equality extraction can cross
 * the failed search into a category comparison, and publishing every candidate duplicates a single emit.
 */
export function extractGraphEventExpectations(
  trace: readonly AuthenticationProgramStateCommon[],
  requested: ReadonlySet<number>,
  outputs: readonly Output[],
): Map<number, EventExpectation> {
  const found = new Map<number, EventExpectation>();
  let window: { expectation: EventExpectation; candidates: number[] } | undefined;
  const flush = (): void => {
    if (!window) return;
    const { expectation, candidates } = window;
    const available = candidates.filter((index) => !found.has(index));
    const sameLock = (index: number): boolean => outputs[index] !== undefined
      && binToHex(outputs[index].lockingBytecode) === expectation.lockingBytecode;
    const selected = available.find((index) => sameLock(index)
      && outputs[index].token?.nft !== undefined
      && binToHex(outputs[index].token!.nft!.commitment) === expectation.commitment)
      ?? available.find(sameLock)
      // Balanced placeholders have no event covenant yet. Preserve candidates already assigned to a different
      // event identity; final covenant validation independently authenticates every materialized proposal.
      ?? available.find((index) => outputs[index] !== undefined
        && !isP2sh32LockingBytecode(outputs[index].lockingBytecode));
    if (selected !== undefined) found.set(selected, expectation);
    window = undefined;
  };
  for (let ordinal = 0; ordinal < trace.length; ordinal += 1) {
    const state = trace[ordinal];
    if (state.controlStack.includes(false)) continue;
    const opcode = state.instructions[state.ip]?.opcode;
    if (opcode === Op.OP_OUTPUTTOKENCATEGORY) flush();
    if (opcode !== Op.OP_OUTPUTTOKENCOMMITMENT) continue;
    const lockIp = graphEventLockReadIp(state);
    if (lockIp === undefined || state.stack.length < 2) { flush(); continue; }
    const outputIndex = Number(vmNumberToBigInt(state.stack.at(-1)!));
    if (!requested.has(outputIndex)) { flush(); continue; }
    // Both the sparse and complete recorder include OUTPUTBYTECODE. Only accept the next observation at the
    // statically paired instruction in this invocation; an unrelated later equality cannot supply the lock.
    let lockState: AuthenticationProgramStateCommon | undefined;
    for (let next = ordinal + 1; next < trace.length; next += 1) {
      const candidate = trace[next];
      if (candidate.instructions !== state.instructions || candidate.ip > lockIp) break;
      if (candidate.ip === lockIp) { lockState = candidate; break; }
    }
    if (!lockState || lockState.controlStack.includes(false) || lockState.stack.length < 2
      || Number(vmNumberToBigInt(lockState.stack.at(-1)!)) !== outputIndex
      || !isP2sh32LockingBytecode(lockState.stack.at(-2))) { flush(); continue; }
    const expectation = {
      commitment: binToHex(state.stack.at(-2)!),
      lockingBytecode: binToHex(lockState.stack.at(-2)!),
    };
    if (window && (window.expectation.commitment !== expectation.commitment
      || window.expectation.lockingBytecode !== expectation.lockingBytecode
      || window.candidates.at(-1)! + 1 !== outputIndex)) flush();
    window ??= { expectation, candidates: [] };
    window.candidates.push(outputIndex);
  }
  flush();
  return found;
}
