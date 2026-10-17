import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { authenticationInstructionsAreMalformed, decodeAuthenticationInstructions, encodeAuthenticationInstructions } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
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

type ArmNode =
| { kind: 'op'; encoded: Uint8Array; opcode: number }
| { kind: 'if'; open: Uint8Array; arms: ArmNode[][] }
| { kind: 'loop'; body: ArmNode[] };

const ENCODED_ELSE = Uint8Array.of(Op.OP_ELSE);
const ENCODED_ENDIF = Uint8Array.of(Op.OP_ENDIF);
const ENCODED_BEGIN = Uint8Array.of(Op.OP_BEGIN);
const ENCODED_UNTIL = Uint8Array.of(Op.OP_UNTIL);
// Opcodes whose result depends on the executing frame's bytecode or that define functions stay in their frame.
const FRAME_BOUND_OPCODES = new Set<number>([
  Op.OP_DEFINE, Op.OP_ACTIVEBYTECODE, Op.OP_CODESEPARATOR, Op.OP_CHECKSIG, Op.OP_CHECKSIGVERIFY,
  Op.OP_CHECKMULTISIG, Op.OP_CHECKMULTISIGVERIFY, Op.OP_CHECKDATASIG, Op.OP_CHECKDATASIGVERIFY,
]);
/** A not-taken arm of at least this many instructions steps over one call instead of its body. */
const MINIMUM_OUTLINED_ARM_INSTRUCTIONS = 8;
/** Inside a loop an arm is stepped once per iteration, so a shorter one already pays for its call. */
const MINIMUM_OUTLINED_LOOP_ARM_INSTRUCTIONS = 5;

function parseArms(bytecode: Uint8Array): ArmNode[] | undefined {
  const instructions = decodeAuthenticationInstructions(bytecode);
  if (authenticationInstructionsAreMalformed(instructions)) return undefined;
  const root: ArmNode[] = [];
  const open: { node: ArmNode & { kind: 'if' | 'loop' }; into: ArmNode[] }[] = [];
  let into = root;
  for (const instruction of instructions) {
    const { opcode } = instruction;
    if (opcode === Op.OP_IF || opcode === Op.OP_NOTIF) {
      const node: ArmNode = { kind: 'if', open: encodeAuthenticationInstructions([instruction]), arms: [[]] };
      into.push(node);
      open.push({ node, into });
      [into] = node.arms;
    } else if (opcode === Op.OP_ELSE) {
      const top = open.at(-1);
      if (top?.node.kind !== 'if') return undefined;
      into = [];
      top.node.arms.push(into);
    } else if (opcode === Op.OP_ENDIF) {
      const top = open.pop();
      if (top?.node.kind !== 'if') return undefined;
      ({ into } = top);
    } else if (opcode === Op.OP_BEGIN) {
      const node: ArmNode = { kind: 'loop', body: [] };
      into.push(node);
      open.push({ node, into });
      into = node.body;
    } else if (opcode === Op.OP_UNTIL) {
      const top = open.pop();
      if (top?.node.kind !== 'loop') return undefined;
      ({ into } = top);
    } else {
      into.push({ kind: 'op', encoded: encodeAuthenticationInstructions([instruction]), opcode });
    }
  }
  return open.length === 0 ? root : undefined;
}

function armInstructionCount(nodes: ArmNode[]): number {
  return nodes.reduce((count, node) => count + (node.kind === 'op' ? 1
    : node.kind === 'loop' ? 2 + armInstructionCount(node.body)
      : node.arms.length + 1 + node.arms.reduce((sum, arm) => sum + armInstructionCount(arm), 0)), 0);
}

function armIsFrameFree(nodes: ArmNode[]): boolean {
  return nodes.every((node) => (node.kind === 'op' ? !FRAME_BOUND_OPCODES.has(node.opcode)
    : node.kind === 'loop' ? armIsFrameFree(node.body) : node.arms.every(armIsFrameFree)));
}

function encodeArms(nodes: ArmNode[], parts: Uint8Array[] = []): Uint8Array[] {
  for (const node of nodes) {
    if (node.kind === 'op') parts.push(node.encoded);
    else if (node.kind === 'loop') {
      parts.push(ENCODED_BEGIN);
      encodeArms(node.body, parts);
      parts.push(ENCODED_UNTIL);
    } else {
      parts.push(node.open);
      node.arms.forEach((arm, index) => {
        if (index > 0) parts.push(ENCODED_ELSE);
        encodeArms(arm, parts);
      });
      parts.push(ENCODED_ENDIF);
    }
  }
  return parts;
}

/** Free function ids, shortest encoding first. */
function* freeFunctionIds(taken: Set<number>): Generator<number> {
  const candidates = [
    ...Array.from({ length: 127 }, (_unused, index) => index + 1),
    ...Array.from({ length: 127 }, (_unused, index) => -(index + 1)),
    ...Array.from({ length: 32767 - 127 }, (_unused, index) => index + 128),
  ];
  for (const id of candidates) if (!taken.has(id)) yield id;
}

/**
 * Outline every conditional arm of at least `MINIMUM_OUTLINED_ARM_INSTRUCTIONS` instructions (in a loop,
 * `MINIMUM_OUTLINED_LOOP_ARM_INSTRUCTIONS`) into its own function.
 *
 * BCH-2026 charges each instruction a not-taken arm steps over, so a verifier loop pays its untaken branches on every
 * iteration and its whole body once more at exit. OP_INVOKE shares both stacks and the arm is balanced, so the call
 * is the same stack transform; a taken arm pays one push and the invoke, a not-taken one steps over just those two.
 */
export function outlineMessageBusVerifierArms(program: MessageBusVerifierProgram): MessageBusVerifierProgram {
  const ids = freeFunctionIds(new Set(program.functions.map((fn) => fn.id)));
  const names = new Set(program.functions.map((fn) => fn.name));
  const outlined: MessageBusVerifierProgram['functions'][number][] = [];
  const outline = (nodes: ArmNode[], inLoop: boolean): void => {
    const minimum = inLoop ? MINIMUM_OUTLINED_LOOP_ARM_INSTRUCTIONS : MINIMUM_OUTLINED_ARM_INSTRUCTIONS;
    for (const node of nodes) {
      if (node.kind === 'loop') outline(node.body, true);
      if (node.kind !== 'if') continue;
      node.arms = node.arms.map((arm) => {
        outline(arm, inLoop);
        if (armInstructionCount(arm) < minimum || !armIsFrameFree(arm)) return arm;
        const { value: id } = ids.next();
        if (id === undefined) return arm;
        const name = `__outlined_arm_${id < 0 ? `n${-id}` : id}`;
        if (names.has(name)) return arm;
        names.add(name);
        outlined.push({ id, name, bytecode: binToHex(concatParts(encodeArms(arm))) });
        const push = scriptToBytecode([encodeInt(BigInt(id))]);
        return [
          { kind: 'op', encoded: push, opcode: push[0] },
          { kind: 'op', encoded: Uint8Array.of(Op.OP_INVOKE), opcode: Op.OP_INVOKE },
        ];
      });
    }
  };
  const functions = program.functions.map((fn) => {
    const nodes = parseArms(hexToBin(fn.bytecode));
    if (nodes === undefined) return fn;
    outline(nodes, false);
    return { ...fn, bytecode: binToHex(concatParts(encodeArms(nodes))) };
  });
  return outlined.length === 0 ? program : { ...program, functions: [...functions, ...outlined] };
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
