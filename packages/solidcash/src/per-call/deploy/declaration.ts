/**
 * Reading back a declaration a machine run closed against.
 *
 * A body compares a value it computed with a declaration the caller wrote — a segment's record view, or the
 * commitment an output carries — and the failing `OP_EQUALVERIFY` leaves both operands on the machine's stack: the
 * declaration sits on top and the computed value below it. That is the only channel a caller has for learning a
 * value the body computes on its own, and it is what a deployment uses when the state a frame writes cannot be
 * stated in advance.
 *
 * The reading is shared rather than guessed at each call site: the opcode the run stopped at, and the two operands
 * it left, are checked here so a run that stopped anywhere else is reported rather than misread.
 */

import { bytesEqual, Op } from '@solidcash/utils';
import { createVirtualMachineBch2026ForProvider } from '../../network/createVirtualMachine.js';

/** Why a run's stop could not be read as a declaration close. */
export type DeclarationReadingFailure =
  /** The run left no trace, or failed on its very first instruction. */
  | 'no-trace'
  /** The run stopped at an opcode that is not a declaration close. */
  | 'not-a-close'
  /** The close left fewer than two operands, so nothing was compared. */
  | 'no-operands'
  /** The computed value is empty or larger than any commitment. */
  | 'implausible-length';

/** The declaration a run closed against, and the value the body computed for it. */
export interface ReadDeclaration {
  readonly declared: Uint8Array;
  readonly computed: Uint8Array;
}

/** The machine the deployment runs its programs on, and one program it can be asked about. */
type VirtualMachine = ReturnType<typeof createVirtualMachineBch2026ForProvider>;
type VirtualMachineProgram = Parameters<VirtualMachine['evaluate']>[0];

/** A machine that can step to a program's stop state without retaining every step, when it offers it. */
type BoundedDebugVirtualMachine = VirtualMachine & {
  boundedDebug?: (program: VirtualMachineProgram) => readonly ProgramStateTrace[];
};

/** The program state facts a stop's declaration is read from. */
interface ProgramStateTrace {
  readonly ip: number;
  readonly instructions: readonly { readonly opcode: number }[];
  readonly stack: readonly Uint8Array[];
  readonly error?: string;
}

export type DeclarationReading =
  | ({ readonly ok: true } & ReadDeclaration)
  | {
    readonly ok: false;
    readonly reason: DeclarationReadingFailure;
    readonly opcode?: number;
    readonly error?: string;
    readonly length?: number;
  };

/** Reads the declaration a machine run closed against, or why its stop cannot be read that way. */
export function readComputedDeclaration(options: {
  readonly vm: VirtualMachine;
  readonly program: VirtualMachineProgram;
  /** The largest value the caller will accept as a commitment. */
  readonly maximumCommitmentBytes: number;
}): DeclarationReading {
  const machine = options.vm as BoundedDebugVirtualMachine;
  const trace = (machine.boundedDebug?.(options.program)
    ?? options.vm.debug(options.program)) as unknown as readonly ProgramStateTrace[];
  const failed = trace.findIndex((state) => state.error !== undefined);
  if (failed <= 0) return { ok: false, reason: 'no-trace', error: trace[0]?.error };
  const before = trace[failed - 1]!;
  const opcode = before.instructions[before.ip]?.opcode;
  if (opcode !== Op.OP_EQUALVERIFY) {
    return { ok: false, reason: 'not-a-close', ...(opcode === undefined ? {} : { opcode }),
      error: trace[failed]!.error };
  }
  const declared = before.stack[before.stack.length - 1];
  const computed = before.stack[before.stack.length - 2];
  if (declared === undefined || computed === undefined) return { ok: false, reason: 'no-operands' };
  if (computed.length === 0 || computed.length > options.maximumCommitmentBytes) {
    return { ok: false, reason: 'implausible-length', length: computed.length };
  }
  return { ok: true, declared, computed };
}

/** True when the run's own declaration is the commitment a caller wrote. */
export function declaresCommitment(reading: ReadDeclaration, written: Uint8Array): boolean {
  return bytesEqual(reading.declared, written);
}
