import {
  authenticationInstructionsAreMalformed,
  binToHex,
  decodeAuthenticationInstructions,
  encodeAuthenticationInstructions,
  hexToBin,
} from '@bitauth/libauth';
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

/** Outline repeated, instruction-aligned verifier stack suffixes when doing so saves bytecode. */
export function deduplicateMessageBusVerifierStackSuffix(
  program: MessageBusVerifierProgram,
): MessageBusVerifierProgram {
  const id = freshHelperId(program);
  if (id === undefined) return program;
  const call = scriptToBytecode([encodeInt(BigInt(id)), Op.OP_INVOKE]);
  const definition = scriptToBytecode([STACK_SUFFIX, encodeInt(BigInt(id)), Op.OP_DEFINE]);
  let count = 0;
  const rewritten = program.functions.map((fn) => {
    const original = hexToBin(fn.bytecode);
    const instructions = decodeAuthenticationInstructions(original);
    if (authenticationInstructionsAreMalformed(instructions)) return fn;
    // Keep each encoded instruction intact. In particular, matching bytes inside a push are never opcodes.
    const encoded = instructions.map((instruction) => encodeAuthenticationInstructions([instruction]));
    const output: Uint8Array[] = [];
    for (let cursor = 0; cursor < instructions.length;) {
      const matches = cursor + STACK_SUFFIX_INSTRUCTIONS <= instructions.length
        && instructions.slice(cursor, cursor + STACK_SUFFIX_INSTRUCTIONS).every((instruction, offset) =>
          !('data' in instruction)
          && instruction.opcode === (offset % 2 === 0 ? Op.OP_SWAP : Op.OP_TOALTSTACK));
      if (matches) {
        output.push(call);
        count += 1;
        cursor += STACK_SUFFIX_INSTRUCTIONS;
      } else {
        output.push(encoded[cursor]);
        cursor += 1;
      }
    }
    if (output.length === instructions.length) return fn;
    const bytecode = new Uint8Array(output.reduce((size, part) => size + part.length, 0));
    let offset = 0;
    for (const part of output) {
      bytecode.set(part, offset);
      offset += part.length;
    }
    return { ...fn, bytecode: binToHex(bytecode) };
  });
  // OP_DEFINE itself has a byte cost. Do not change the program unless the whole covenant shrinks.
  if (count * (STACK_SUFFIX.length - call.length) <= definition.length) return program;
  return {
    ...program,
    functions: [...rewritten, {
      id,
      name: `__outlined_stack_suffix_${id}`,
      bytecode: binToHex(STACK_SUFFIX),
    }],
  };
}
