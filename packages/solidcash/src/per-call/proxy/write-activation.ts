/**
 * Whether a frame's mapping write runs, decided from the frame's own facts.
 *
 * A per-call body publishes, for a write a branch guards, the condition it runs under (`entryAccesses[].activation`),
 * in the language a conditional call site's condition is published in, and the frame lets the body skip that write:
 * a skipped write keeps its node, or its absent key's predecessor. A builder decides the condition as it decides a
 * call site's (`makeCallResolver`): from the frame's arguments, its `msg.sender`, its state, `address(this)` and the
 * values the mapping nodes the frame runs on hold. A write whose access publishes no activation runs whenever the
 * body does.
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
