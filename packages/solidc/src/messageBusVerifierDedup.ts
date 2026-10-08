import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { authenticationInstructionsAreMalformed, decodeAuthenticationInstructions, encodeAuthenticationInstructions } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
;
import {
  encodeInt, Op, scriptToBytecode, type MessageBusVerifierProgram,
} from '@solidcash/utils';

// A generated verifier repeatedly moves twelve saved values to the alternate stack. This is a pure,
// straight-line stack transform: OP_INVOKE keeps both stacks and resumes the caller after the body.
const STACK_SUFFIX = Uint8Array.from(Array.from({ length: 12 }, () => [Op.OP_SWAP, Op.OP_TOALTSTACK]).flat());
const STACK_SUFFIX_INSTRUCTIONS = STACK_SUFFIX.length;

function freshHelperId(program: MessageBusVerifierProgram): number | undefined {
  const ids = new Set(program.functions.map((fn) => fn.id));
  const names = new Set(program.functions.map((fn) => fn.name));
  for (let id = 0; id <= 999; id += 1) {
    if (!ids.has(id) && !names.has(`__outlined_stack_suffix_${id}`)) return id;
  }
  return undefined;
}

const ALTSTACK_POP_RUN = 12;
const ALTSTACK_POP = Uint8Array.from({ length: ALTSTACK_POP_RUN }, () => Op.OP_FROMALTSTACK);

function concatParts(parts: Uint8Array[]): Uint8Array {
  const bytecode = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytecode.set(part, offset);
    offset += part.length;
  }
  return bytecode;
}

/** Outline one repeated, instruction-aligned straight-line body when the covenant gets smaller. */
function outlineRepeatedRun(
  program: MessageBusVerifierProgram,
  body: Uint8Array,
  matches: (instructions: ReturnType<typeof decodeAuthenticationInstructions>, cursor: number) => boolean,
  runLength: number,
  helperName: (id: number) => string,
): MessageBusVerifierProgram {
  const id = freshHelperId(program);
  if (id === undefined) return program;
  const call = scriptToBytecode([encodeInt(BigInt(id)), Op.OP_INVOKE]);
  const definition = scriptToBytecode([body, encodeInt(BigInt(id)), Op.OP_DEFINE]);
  let count = 0;
  const rewritten = program.functions.map((fn) => {
    const original = hexToBin(fn.bytecode);
    const instructions = decodeAuthenticationInstructions(original);
    if (authenticationInstructionsAreMalformed(instructions)) return fn;
    // Keep each encoded instruction intact. In particular, matching bytes inside a push are never opcodes.
    const encoded = instructions.map((instruction) => encodeAuthenticationInstructions([instruction]));
    const output: Uint8Array[] = [];
    for (let cursor = 0; cursor < instructions.length;) {
      if (cursor + runLength <= instructions.length && matches(instructions, cursor)) {
        output.push(call);
        count += 1;
        cursor += runLength;
      } else {
        output.push(encoded[cursor]);
        cursor += 1;
      }
    }
    if (output.length === instructions.length) return fn;
    return { ...fn, bytecode: binToHex(concatParts(output)) };
  });
  // OP_DEFINE itself has a byte cost. Do not change the program unless the whole covenant shrinks.
  if (count * (body.length - call.length) <= definition.length) return program;
  return {
    ...program,
    functions: [...rewritten, {
      id,
      name: helperName(id),
      bytecode: binToHex(body),
    }],
  };
}

/** Outline repeated, instruction-aligned verifier stack suffixes when doing so saves bytecode. */
export function deduplicateMessageBusVerifierStackSuffix(
  program: MessageBusVerifierProgram,
): MessageBusVerifierProgram {
  const withSuffix = outlineRepeatedRun(
    program,
    STACK_SUFFIX,
    (instructions, cursor) => instructions.slice(cursor, cursor + STACK_SUFFIX_INSTRUCTIONS).every(
      (instruction, offset) => !('data' in instruction)
        && instruction.opcode === (offset % 2 === 0 ? Op.OP_SWAP : Op.OP_TOALTSTACK),
    ),
    STACK_SUFFIX_INSTRUCTIONS,
    (id) => `__outlined_stack_suffix_${id}`,
  );
  // A verifier restores long altstack frames with a straight run of OP_FROMALTSTACK. One invoke of a
  // twelve-pop helper is shorter than repeating the opcode, and OP_INVOKE keeps the same altstack.
  return outlineRepeatedRun(
    withSuffix,
    ALTSTACK_POP,
    (instructions, cursor) => instructions.slice(cursor, cursor + ALTSTACK_POP_RUN).every(
      (instruction) => !('data' in instruction) && instruction.opcode === Op.OP_FROMALTSTACK,
    ),
    ALTSTACK_POP_RUN,
    (id) => `__outlined_altstack_pop_${id}`,
  );
}
