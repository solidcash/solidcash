import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
import { authenticationInstructionsAreMalformed, decodeAuthenticationInstructions } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import type { AuthenticationProgramStackFrame, AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
;
;
;
import { Op } from '@solidcash/utils';

type ProbeState = AuthenticationProgramStateCommon & {
  probeContinuations?: readonly AuthenticationProgramStackFrame[];
};

const decodedBodies = new WeakMap<Uint8Array, AuthenticationProgramStackFrame['instructions']>();

function continuations(state: ProbeState): readonly AuthenticationProgramStackFrame[] {
  return state.probeContinuations ?? state.controlStack.filter(
    (frame): frame is AuthenticationProgramStackFrame => typeof frame === 'object' && frame !== null,
  );
}

/** Retain code coordinates, never caller operand stacks, for a projected return-commitment observation. */
export function captureProbeContinuations(state: ProbeState): Pick<ProbeState, 'probeContinuations'> {
  if (state.instructions[state.ip]?.opcode !== Op.OP_OUTPUTTOKENCOMMITMENT) return {};
  return { probeContinuations: continuations(state).map(({ instructions, ip }) => ({ instructions, ip })) };
}

function literalIdentifier(instruction: AuthenticationProgramStackFrame['instructions'][number]): string | undefined {
  if ('data' in instruction) return binToHex(instruction.data);
  if (instruction.opcode === Op.OP_0) return '';
  if (instruction.opcode === Op.OP_1NEGATE) return '81';
  if (instruction.opcode >= Op.OP_1 && instruction.opcode <= Op.OP_16) {
    return (instruction.opcode - Op.OP_1 + 1).toString(16).padStart(2, '0');
  }
  return undefined;
}

/**
 * Match a small exact opcode sequence on either side of an observed operation. Static OP_INVOKE helpers are
 * transparent, including their recorded caller continuations; branches, dynamic calls and OP_EVAL are not.
 * This only recognizes code: the caller must still authenticate the observation's operands and output index.
 */
export function matchesProbeOpcodeSequence(
  state: ProbeState, direction: 1 | -1, expected: readonly number[],
): boolean {
  let cursor: AuthenticationProgramStackFrame = { instructions: state.instructions, ip: state.ip + direction };
  const callers = continuations(state).map((frame) => {
    const invoke = frame.instructions[frame.ip - 1];
    const identifier = frame.instructions[frame.ip - 2];
    // An EVAL continuation can reset operand context. Never treat it as bytecode outlining.
    if (invoke?.opcode !== Op.OP_INVOKE || !identifier || literalIdentifier(identifier) === undefined) return undefined;
    return { instructions: frame.instructions, ip: direction === 1 ? frame.ip : frame.ip - 3 };
  });
  let matched = 0;
  // Bound expansion even for recursive definitions or chains of empty functions. A refusal only means that
  // this observation is not an exact recognized pin; it cannot become an unauthenticated return fallback.
  for (let steps = 0; steps < 128 && matched < expected.length; steps += 1) {
    if (cursor.ip < 0 || cursor.ip >= cursor.instructions.length) {
      const caller = callers.pop();
      if (caller === undefined) return false;
      cursor = caller;
      continue;
    }
    const invokeIndex = direction === 1 ? cursor.ip + 1 : cursor.ip;
    const identifier = cursor.instructions[invokeIndex - 1];
    if (cursor.instructions[invokeIndex]?.opcode === Op.OP_INVOKE && identifier) {
      const key = literalIdentifier(identifier);
      const body = key === undefined ? undefined : state.functionTable?.[key];
      if (body === undefined) return false;
      let instructions = decodedBodies.get(body);
      if (instructions === undefined) {
        const decoded = decodeAuthenticationInstructions(body);
        if (authenticationInstructionsAreMalformed(decoded)) return false;
        instructions = decoded;
        decodedBodies.set(body, instructions);
      }
      callers.push({ instructions: cursor.instructions, ip: cursor.ip + 2 * direction });
      cursor = { instructions, ip: direction === 1 ? 0 : instructions.length - 1 };
      continue;
    }
    if (cursor.instructions[cursor.ip].opcode !== expected[matched]) return false;
    matched += 1;
    cursor.ip += direction;
  }
  return matched === expected.length;
}
