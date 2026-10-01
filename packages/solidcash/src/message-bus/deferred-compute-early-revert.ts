import {
  binToHex, encodeAuthenticationInstruction, vmNumberToBigInt,
  type AuthenticationProgramStateCommon,
} from '@bitauth/libauth';
import { Op } from '@solidcash/utils';
import { FailedRequireError } from '../Errors.js';
import { isContractUnlocker } from '../interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';

export interface DeferredComputeEarlyRevertCandidate {
  inputIndex: number;
  inputBase: number;
  offsets: readonly number[];
}

/** Keep partially unresolved families conservative; a fully resolved family cannot taint the early rejection. */
export function unresolvedComputeOffsetsForEarlyRevert(
  offsets: readonly number[],
  slots: readonly { offset: number; kind: string }[],
  remaining?: { keccakUnresolved: number; ecrecoverUnresolved: number },
): number[] {
  if (remaining === undefined) return [...offsets];
  const kindAt = new Map(slots.map((slot) => [slot.offset, slot.kind]));
  return offsets.filter((offset) => {
    const kind = kindAt.get(offset);
    if (kind === 'keccakSideCar') return remaining.keccakUnresolved > 0;
    if (kind === 'ecrecoverSideCar') return remaining.ecrecoverUnresolved > 0;
    return true;
  });
}

const unresolvedValueReads = new Set<number>([
  // Resolving a compute sidecar changes its unlocking script and its aligned output commitment. Other fields,
  // including the input category and aligned output lock, are already fixed by the recipe.
  Op.OP_INPUTBYTECODE,
  Op.OP_OUTPUTTOKENCOMMITMENT,
]);

/**
 * An invalid call can fail a source-level require before its selected handler ever reads a deferred sidecar.
 * The recipe must not use VM traces to *discover* missing compute values, but it can reject that call using a
 * VM failure already attributed to the exact active compiler body. The result is rejection only: no trace value
 * is promoted into a resource, manifest row, or output. If the execution reads an unresolved field, or if the
 * active body/require cannot be identified unambiguously, the ordinary fail-closed recipe error remains.
 */
export function probeEarlySourceRevertBeforeDeferredCompute(
  builder: TransactionBuilder,
  provider: NetworkProvider,
  candidates: readonly DeferredComputeEarlyRevertCandidate[],
): FailedRequireError | undefined {
  const unresolvedCoordinates = new Set(candidates.flatMap((candidate) =>
    candidate.offsets.map((offset) => candidate.inputBase + offset)));
  if (unresolvedCoordinates.size === 0) return undefined;

  let program: ReturnType<TransactionBuilder['buildLibauthProgram']>;
  try {
    program = builder.buildLibauthProgram();
  } catch {
    return undefined;
  }

  for (const inputIndex of new Set(candidates.map((candidate) => candidate.inputIndex))) {
    const unlocker = builder.inputs[inputIndex]?.unlocker;
    if (!unlocker || !isContractUnlocker(unlocker)) continue;
    let readUnresolvedValue = false;
    const vm = createVirtualMachineBch2026ForProvider(provider, {
      opcodes: unresolvedValueReads,
      beforeOperation: (unknownState) => {
        const state = unknownState as Pick<AuthenticationProgramStateCommon, 'ip' | 'instructions' | 'stack'>;
        const operand = state.stack.at(-1);
        if (operand === undefined) return;
        const coordinate = Number(vmNumberToBigInt(operand));
        if (Number.isSafeInteger(coordinate) && unresolvedCoordinates.has(coordinate)) {
          readUnresolvedValue = true;
        }
      },
    });
    let state: AuthenticationProgramStateCommon;
    try {
      state = vm.evaluate({ ...program, inputIndex });
    } catch {
      continue;
    }
    const failingIp = state.ip - 1;
    if (!state.error) continue;

    const artifact = unlocker.contract.artifact;
    const activeBytecode = binToHex(Uint8Array.from(state.instructions.flatMap((instruction) =>
      [...encodeAuthenticationInstruction(instruction)])));
    const matches = Object.values(artifact.debug?.invokeDebug ?? {})
      .filter((body) => body.bytecode === activeBytecode);
    if (readUnresolvedValue || !state.error.includes('OP_VERIFY')
        || state.instructions[failingIp]?.opcode !== Op.OP_VERIFY
        || matches.length !== 1) continue;
    const requires = matches[0].requires.filter((requireStatement) => requireStatement.ip === failingIp);
    if (requires.length !== 1) continue;

    // The provisional transaction is not a useful Bitauth debugging URI: it still carries placeholder compute
    // outputs. Report only the source-attributed failure; the actual signed transaction is never submitted.
    return new FailedRequireError(
      artifact, failingIp, requires[0], inputIndex, '', state.error, matches[0].sourceMap,
      false, state.stack,
    );
  }
  return undefined;
}
