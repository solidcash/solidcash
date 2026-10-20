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
import { bumpFramedCounter } from '../composer/counters.js';

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

/**
 * A machine that can step to a program's stop state without retaining every step, and that can hand back the close
 * an evaluation of a program with the same content stopped on, when it offers them.
 */
type BoundedDebugVirtualMachine = VirtualMachine & {
  boundedDebug?: (program: VirtualMachineProgram) => readonly ProgramStateTrace[];
  recordedClose?: (program: VirtualMachineProgram) => ReadDeclaration | undefined;
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
    /** A close whose computed value is empty: only a learner that names its listed operand can read it. */
    readonly close?: ReadDeclaration;
  };

/** Reads the declaration a machine run closed against, or why its stop cannot be read that way. */
export function readComputedDeclaration(options: {
  readonly vm: VirtualMachine;
  readonly program: VirtualMachineProgram;
  /** The largest value the caller will accept as a commitment. */
  readonly maximumCommitmentBytes: number;
}): DeclarationReading {
  bumpFramedCounter('declarationReads');
  const machine = options.vm as BoundedDebugVirtualMachine;
  // The machine's own evaluation of a program with this content stopped on a failed close and kept its operands:
  // they are the two items the trace below would read before that OP_EQUALVERIFY, so the program is not run again.
  // Any other stop, or a program of other content, is read from a run as before.
  const recorded = machine.recordedClose?.(options.program);
  if (recorded !== undefined) {
    bumpFramedCounter('recordedCloses');
    return closeReading(recorded, options.maximumCommitmentBytes);
  }
  // Measured 2026-10-10: reading a close by running the program plainly first (`evaluateClose`) costs more than it
  // saves. Most reads here are not closes at all - the composer asks and is told so - so the plain run was a wasted
  // full run ahead of the walk that answers them, and `take job` in the no-proxy lane went from 303-324 s to
  // 418-430 s. The walk below is the primary answer; a middle path has to replace it, not precede it.
  bumpFramedCounter('tracedCloses');
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
  return closeReading({ declared, computed }, options.maximumCommitmentBytes);
}

/** A close's two operands as a reading: the computed value must be one a commitment can hold. */
function closeReading(close: ReadDeclaration, maximumCommitmentBytes: number): DeclarationReading {
  const { declared, computed } = close;
  if (computed.length === 0 || computed.length > maximumCommitmentBytes) {
    return { ok: false, reason: 'implausible-length', length: computed.length, ...(computed.length === 0 ? { close } : {}) };
  }
  return { ok: true, declared, computed };
}

/** True when the run's own declaration is the commitment a caller wrote. */
export function declaresCommitment(reading: ReadDeclaration, written: Uint8Array): boolean {
  return bytesEqual(reading.declared, written);
}

/** The emit a close names, and what the body computed for it. */
export interface EventClose {
  /** The emit's position among the frame's listed event outputs. */
  readonly position: number;
  /** A reached emit's payload, or the empty payload of a skipped one. */
  readonly payload: Uint8Array;
}

/**
 * The emit a close names by the commitment its listed output carries in `stated`, and what the body computed for it.
 * A reached emit closes its payload below the commitment; a skipped one closes the commitment below the empty payload
 * it computes. An empty commitment is a skipped emit's, stated already, so it names no emit.
 */
export function eventCloseOf(reading: ReadDeclaration, stated: readonly Uint8Array[]): EventClose | undefined {
  const named = (operand: Uint8Array): number =>
    stated.findIndex((commitment) => commitment.length > 0 && bytesEqual(commitment, operand));
  const reached = named(reading.declared);
  if (reached >= 0) return { position: reached, payload: Uint8Array.from(reading.computed) };
  const skipped = reading.declared.length === 0 ? named(reading.computed) : -1;
  return skipped < 0 ? undefined : { position: skipped, payload: new Uint8Array(0) };
}
