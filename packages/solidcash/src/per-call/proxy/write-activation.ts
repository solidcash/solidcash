/**
 * Whether a frame's mapping write or emit runs, decided from the frame's own facts.
 *
 * A per-call body publishes, for a write a branch guards, the condition it runs under (`entryAccesses[].activation`),
 * in the language a conditional call site's condition is published in, and the frame lets the body skip that write:
 * a skipped write keeps its node, or its absent key's predecessor. A builder decides the condition as it decides a
 * call site's (`makeCallResolver`): from the frame's arguments, its `msg.sender`, its state, `address(this)` and the
 * values the mapping nodes the frame runs on hold. A write whose access publishes no activation runs whenever the
 * body does.
 *
 * An emit a branch guards publishes its condition on its `emits` row, and the frame lists the event's output whether
 * or not the body reaches the emit: a skipped emit's output carries the empty commitment. A value send a branch
 * guards publishes its condition on its `transfers` row, decided the same way: a skipped send pays no output.
 */

import type { Artifact, ExternalCallExpression } from '@solidcash/utils';
import type { FunctionArgument } from '../../Argument.js';
import { makeCallResolver, type MappingValueReader } from './call-resolution.js';
import { PerCallProxyDeployError } from './errors.js';

/** The frame facts beyond its arguments and its sender that a write's activation is decided from. */
export interface WriteActivationFacts {
  /** The frame's state, keyed by field name, as its body reads it. */
  readonly stateValues: Readonly<Record<string, unknown>>;
  /** `address(this)` as the frame observes it. */
  readonly selfAddress?: Uint8Array;
  /** The value a mapping holds for a key, as the frame starts: past the frames placed before it in the hop. */
  readonly readMappingValue?: MappingValueReader;
}

/** The frame a write's activation is decided for. */
export interface WriteActivationFrame {
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly args: readonly FunctionArgument[];
  /** The frame's `msg.sender`, as the lock it is. */
  readonly senderAddress: Uint8Array;
  readonly facts?: WriteActivationFacts;
}

/**
 * Whether a write runs: true for one its access publishes no activation for, else the activation as the frame's
 * facts decide it, or undefined when they do not. A mapping value the hop cannot state, such as one an earlier
 * frame's body computes and no settle has learned yet, leaves the activation undecided rather than refusing.
 */
export function writeRuns(
  frame: WriteActivationFrame, activation: ExternalCallExpression | undefined,
): boolean | undefined {
  if (activation === undefined) return true;
  if (frame.facts === undefined) return undefined;
  let holds: FunctionArgument | undefined;
  try {
    holds = makeCallResolver({
      artifact: frame.artifact,
      functionName: frame.functionName,
      args: frame.args,
      stateValues: frame.facts.stateValues,
      senderAddress: frame.senderAddress,
      ...(frame.facts.selfAddress === undefined ? {} : { selfAddress: frame.facts.selfAddress }),
      ...(frame.facts.readMappingValue === undefined ? {} : { readMappingValue: frame.facts.readMappingValue }),
    }).evaluate(activation, 0);
  } catch (error) {
    if (error instanceof PerCallProxyDeployError) return undefined;
    throw error;
  }
  if (typeof holds === 'boolean') return holds;
  return typeof holds === 'bigint' ? holds !== 0n : undefined;
}

/**
 * The emit indices of the frame's entry whose condition its facts decide the body skips. The frame lists each one's
 * output with the empty commitment its not-taken arm closes against; an emit those facts do not decide starts from a
 * sentinel, against which the body's own close hands back its payload, or the empty payload of a skip.
 */
export function skippedEmits(frame: WriteActivationFrame): readonly number[] {
  const emits = frame.artifact.abi.find((candidate) => candidate.name === frame.functionName)?.emits ?? [];
  return emits.filter((emit) => writeRuns(frame, emit.activation) === false).map((emit) => emit.emitIndex);
}

/**
 * The transfer indices of the frame's entry whose condition its facts decide the body skips, as an emit's is decided
 * (`skippedEmits`). A send no branch guards runs whenever the body does, and one whose condition its artifact does
 * not reproduce (`condition: null`) is never decided here.
 */
export function skippedSends(frame: WriteActivationFrame): readonly number[] {
  const transfers = frame.artifact.abi.find((candidate) => candidate.name === frame.functionName)?.transfers ?? [];
  return transfers.filter((transfer) => transfer.condition !== null && writeRuns(frame, transfer.condition) === false)
    .map((transfer) => transfer.transferIndex);
}
