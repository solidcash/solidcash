import { vmNumberToBigInt } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import { OpcodesBch2026 as Op } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import { VALUE_CHUNK_INDEX_SIZE, VALUE_CHUNK_SIZE } from '@solidcash/utils';
import { followsProbeEquality, matchesProbeOpcodeSequence } from './probe-instruction-sequence.js';

const isP2sh32 = (bytecode: Uint8Array | undefined): bytecode is Uint8Array => !!bytecode
  && bytecode.length === 35 && bytecode[0] === 0xaa && bytecode[1] === 0x20 && bytecode[34] === 0x87;

const encodedChunkIndex = (commitment: Uint8Array): number | undefined => {
  if (commitment.length < VALUE_CHUNK_INDEX_SIZE + 1
    || commitment.length > VALUE_CHUNK_INDEX_SIZE + VALUE_CHUNK_SIZE) return undefined;
  const index = commitment[0] + 256 * commitment[1];
  return index < 32 ? index : undefined;
};

/** A compiler-owned continuation candidate must remain inside its published absolute output band. */
export function computedValueChunkOutputIndexInBand(
  outputIndex: number,
  band: { start: number; end: number },
): boolean {
  return Number.isSafeInteger(outputIndex)
    && Number.isSafeInteger(band.start)
    && Number.isSafeInteger(band.end)
    && band.start >= 0
    && band.end >= band.start
    && outputIndex >= band.start
    && outputIndex <= band.end;
}

/** Validate the `uint16-le index || non-empty chunk data` encoding. This is not an ownership proof: another
 * resource commitment can satisfy the same byte-level shape, so callers must also authenticate the compiler pin. */
export function isValidComputedValueChunkCommitmentEncoding(commitment: string): boolean {
  if (!/^[0-9a-f]+$/i.test(commitment) || commitment.length % 2 !== 0) return false;
  const bytes = Uint8Array.from(commitment.match(/../g)!.map((byte) => Number.parseInt(byte, 16)));
  return encodedChunkIndex(bytes) !== undefined;
}

/** Recognize the compiler's continuation locking-bytecode pin. `outputBase` additionally authenticates the
 * position within a nominated run; callers which only need to classify the local emitter may omit it. */
export function computedValueChunkOutputPin(
  state: Pick<AuthenticationProgramStateCommon, 'controlStack' | 'instructions' | 'ip' | 'stack'>
  & Partial<Pick<AuthenticationProgramStateCommon, 'functionTable'>>,
  outputBase?: number,
): { outputIndex: number; lockingBytecode: Uint8Array; commitment: Uint8Array } | undefined {
  if (state.instructions[state.ip]?.opcode !== Op.OP_OUTPUTBYTECODE
    || !matchesProbeOpcodeSequence(state, -1, [Op.OP_SWAP])
    || !followsProbeEquality(state)
    || state.controlStack.some((frame) => frame === false)
    || state.stack.length < 4) return undefined;
  const lockingBytecode = state.stack[state.stack.length - 2];
  const commitment = state.stack[state.stack.length - 4];
  const chunkIndex = encodedChunkIndex(commitment);
  if (!isP2sh32(lockingBytecode) || chunkIndex === undefined) return undefined;
  let outputIndex: number;
  try {
    outputIndex = Number(vmNumberToBigInt(state.stack[state.stack.length - 1]));
  } catch { return undefined; }
  if (!Number.isSafeInteger(outputIndex) || outputIndex < 0
    || (outputBase !== undefined && outputIndex - outputBase !== chunkIndex)) return undefined;
  return { outputIndex, lockingBytecode, commitment };
}
