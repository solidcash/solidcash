import { isPayToScriptHash20, isPayToScriptHash32 } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { hash160, hash256 } from '@bitauth/libauth/build/lib/crypto/combinations.js';
import { authenticationInstructionsAreMalformed, decodeAuthenticationInstructions } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import { OpcodesBch2026 as Op } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';

type Instruction = ReturnType<typeof decodeAuthenticationInstructions>[number];

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index]);

const isStaticIdentifierPush = (instruction: Instruction | undefined): boolean => instruction !== undefined
  && ('data' in instruction
    || instruction.opcode === Op.OP_1NEGATE
    || (instruction.opcode >= Op.OP_1 && instruction.opcode <= Op.OP_16));

interface ExecutableRegion {
  definitions: Uint8Array[];
  invokes: boolean;
  malformedDefinition: boolean;
  readsOutputTokenCommitment: boolean;
}

/**
 * Decode one executable region without interpreting bytes held inside pushes as opcodes.
 *
 * The compiler's OP_DEFINE form is `<body> <identifier> OP_DEFINE`. Anything else may obtain its body from
 * runtime stack state, so it cannot be excluded by static inspection.
 */
function inspectExecutableRegion(bytecode: Uint8Array): ExecutableRegion | undefined {
  const instructions = decodeAuthenticationInstructions(bytecode);
  if (authenticationInstructionsAreMalformed(instructions)) return undefined;

  const definitions: Uint8Array[] = [];
  let invokes = false;
  let malformedDefinition = false;
  let readsOutputTokenCommitment = false;
  for (let index = 0; index < instructions.length; index += 1) {
    const instruction = instructions[index]!;
    if (instruction.opcode === Op.OP_OUTPUTTOKENCOMMITMENT) readsOutputTokenCommitment = true;
    if (instruction.opcode === Op.OP_INVOKE) invokes = true;
    if (instruction.opcode !== Op.OP_DEFINE) continue;
    const body = instructions[index - 2];
    if (body === undefined || !('data' in body) || !isStaticIdentifierPush(instructions[index - 1])) {
      malformedDefinition = true;
      continue;
    }
    definitions.push(body.data);
  }
  return { definitions, invokes, malformedDefinition, readsOutputTokenCommitment };
}

/**
 * Return whether an authenticated executable could execute OP_OUTPUTTOKENCOMMITMENT.
 *
 * `false` is a proof of absence, not a heuristic. OP_DEFINE bodies are data until an executable region can invoke
 * them; once OP_INVOKE is reachable, every statically registered body is conservatively considered callable.
 * Malformed bytecode, dynamically-shaped OP_DEFINE, and malformed callable bodies return `true` (eligible).
 */
export function executableMayExecuteOutputTokenCommitment(bytecode: Uint8Array): boolean {
  const root = inspectExecutableRegion(bytecode);
  if (root === undefined) return true;
  if (root.readsOutputTokenCommitment) return true;
  if (root.malformedDefinition) return true;
  if (!root.invokes) return false;

  const pending = [...root.definitions];
  for (let index = 0; index < pending.length; index += 1) {
    const region = inspectExecutableRegion(pending[index]!);
    if (region === undefined || region.malformedDefinition) return true;
    if (region.readsOutputTokenCommitment) return true;
    // An invoked body can register more bodies. Since invocation identifiers are stack values, each body in the
    // reachable definition environment remains a candidate; append nested definitions to the same closure.
    pending.push(...region.definitions);
  }
  return false;
}

/**
 * Extract the bytecode authenticated as one input's executable program.
 *
 * Non-P2SH source locking bytecode is authenticated directly by the spent output. For P2SH20/P2SH32, extraction
 * succeeds only when the unlocking bytecode is well formed, ends in a data push, and that redeem bytecode exactly
 * matches the hash committed by the source locking bytecode.
 */
export function extractAuthenticatedSpendBytecode(
  sourceLockingBytecode: Uint8Array,
  unlockingBytecode: Uint8Array,
): Uint8Array | undefined {
  const p2sh20 = isPayToScriptHash20(sourceLockingBytecode);
  const p2sh32 = isPayToScriptHash32(sourceLockingBytecode);
  if (!p2sh20 && !p2sh32) return sourceLockingBytecode;

  const unlockingInstructions = decodeAuthenticationInstructions(unlockingBytecode);
  if (authenticationInstructionsAreMalformed(unlockingInstructions)) return undefined;
  const finalInstruction = unlockingInstructions.at(-1);
  if (finalInstruction === undefined || !('data' in finalInstruction)) return undefined;
  const redeemBytecode = finalInstruction.data;
  const expectedHash = sourceLockingBytecode.slice(2, p2sh20 ? 22 : 34);
  const actualHash = p2sh20 ? hash160(redeemBytecode) : hash256(redeemBytecode);
  return bytesEqual(expectedHash, actualHash) ? redeemBytecode : undefined;
}

/** Fail closed when the input's authenticated executable cannot be established exactly. */
export function inputMayExecuteOutputTokenCommitment(
  sourceLockingBytecode: Uint8Array,
  unlockingBytecode: Uint8Array,
): boolean {
  const executable = extractAuthenticatedSpendBytecode(sourceLockingBytecode, unlockingBytecode);
  return executable === undefined || executableMayExecuteOutputTokenCommitment(executable);
}
