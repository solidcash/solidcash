/**
 * The outputs and side-cars an entry's loops take.
 *
 * A framed body that emits, sends or hashes inside a loop binds each effect where its source makes it: the k-th
 * event at the k-th event output its frame lists, the k-th send at the k-th send output, the k-th hash at the k-th
 * side-car after its own input. Its artifact publishes the order those take as runs of each kind
 * (`PublishedLoopEffects` on the entry's stop-site row): a run the body makes once, or one a loop makes once per turn
 * with the loop's recurrence. A frame states exactly as many as the body makes, so each loop run is expanded by the
 * turns its recurrence counts against the entry's own arguments and state, as a loop's calls are
 * (`occurrenceCountOf`). A recurrence those facts do not fix is refused by name rather than guessed at.
 */

import type {
  Artifact, ExternalCallIterationDomainAbi, PublishedLoopEffectRun, PublishedLoopEffects,
} from '@solidcash/utils';
import { readPublishedStopSites } from '../composer/index.js';
import { makeCallResolver, type CallResolver, type HopCallInputs } from '../proxy/call-resolution.js';

/** Raised for a looped effect a frame cannot lay: a recurrence the entry's own facts do not count. */
export class FramedLoopTurnsError extends Error {
  public readonly name = 'FramedLoopTurnsError';

  public constructor(message: string) {
    super(message);
  }
}

/** The effects an entry's loops repeat, expanded to the turns its own facts count. Absent kinds are not looped. */
export interface EntryLoopTurns {
  /** The emit index each event output the frame lists carries, in the order the body emits them. */
  readonly emits?: readonly number[];
  /** How many sends the frame lists. */
  readonly sends?: number;
  /** How many keccak256 side-cars the body reads after its own input. */
  readonly hashes?: number;
}

/** The runs an entry publishes for its looped effects, or undefined for an entry that repeats none. */
export function publishedLoopEffects(artifact: Artifact, functionName: string): PublishedLoopEffects | undefined {
  if (artifact.composition?.stopSites === undefined) return undefined;
  const identity = `${artifact.contractName}.${functionName}()`;
  return readPublishedStopSites(artifact).entries.find((entry) => entry.functionName === identity)?.loopEffects;
}

/**
 * Expands an entry's looped effects by the turns each loop's recurrence counts against `inputs`, its own arguments
 * and state. Refuses by name a recurrence those facts do not fix.
 */
export function entryLoopTurns(inputs: HopCallInputs): EntryLoopTurns {
  const effects = publishedLoopEffects(inputs.artifact, inputs.functionName);
  if (effects === undefined) return {};
  const resolver = makeCallResolver(inputs);
  const where = `entry "${inputs.functionName}"`;
  const expand = (runs: readonly PublishedLoopEffectRun[] | undefined): number[] | undefined => {
    if (runs === undefined) return undefined;
    const ids: number[] = [];
    for (const run of runs) {
      const turns = run.iterationDomain === undefined ? 1 : turnsOf(run.iterationDomain, resolver, where);
      for (let turn = 0; turn < turns; turn += 1) ids.push(...run.ids);
    }
    return ids;
  };
  const emits = expand(effects.events);
  const sends = expand(effects.sends);
  const hashes = expand(effects.hashes);
  return {
    ...(emits === undefined ? {} : { emits }),
    ...(sends === undefined ? {} : { sends: sends.length }),
    ...(hashes === undefined ? {} : { hashes: hashes.length }),
  };
}

/** How many turns a loop's recurrence runs for, read with the counter bound on each turn. */
function turnsOf(domain: ExternalCallIterationDomainAbi, resolver: CallResolver, where: string): number {
  const initial = resolver.evaluate(domain.initialValue, 0);
  const step = resolver.evaluate(domain.stepValue, 0);
  if (typeof initial !== 'bigint' || typeof step !== 'bigint') {
    throw new FramedLoopTurnsError(`${where} runs a loop whose counter its own arguments do not fix`);
  }
  if (step === 0n) throw new FramedLoopTurnsError(`${where} runs a loop whose counter never advances`);
  let turns = 0;
  let counter = initial;
  for (; turns < domain.maximumIterations; turns += 1) {
    const holds = resolver.evaluate(domain.continueCondition, 0, new Map([[domain.counterName, counter]]));
    if (holds === undefined) {
      throw new FramedLoopTurnsError(
        `${where} runs a loop whose bound its own arguments do not fix, so the frame cannot state how many outputs `
        + 'and side-cars its turns take',
      );
    }
    if (!holds) break;
    counter += step;
  }
  return turns;
}
