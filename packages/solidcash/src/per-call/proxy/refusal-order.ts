/**
 * Which refusal a hop reports when a callee frame's own settle refused and the entry's frame refused as well.
 *
 * The settle derives every callee before the entry, so a callee can refuse in its own settle although the execution
 * never enters it: the entry stopped before the call that leads to it. The execution meets refusals in the order the
 * validator derives (spec V6), so a callee's refusal is met only below a call the entry made, and of those the first
 * the execution finishes - a callee before the frame that entered it, an earlier call's frames before a later one's.
 * When no deferred refusal sits below a call the entry made, the entry's own stop is the one met first.
 */

import type { createVirtualMachineBch2026 } from '@bitauth/libauth';
import {
  frameMadeCall, frameStopOf, readsUnfilledReference,
  type CompositionDraft, type CompositionRefusal, type FrameStop,
} from '../composer/index.js';
import type { HopCallee } from './external-calls.js';

type Machine = ReturnType<typeof createVirtualMachineBch2026>;

/** The callee indices in the order the execution finishes their frames. */
function finishOrder(callees: readonly HopCallee[]): readonly number[] {
  const entered = new Map<number | null, number[]>();
  callees.forEach((callee, index) => entered.set(callee.enteredBy, [...(entered.get(callee.enteredBy) ?? []), index]));
  const order: number[] = [];
  const visit = (index: number): void => {
    for (const inner of entered.get(index) ?? []) visit(inner);
    order.push(index);
  };
  for (const top of entered.get(null) ?? []) visit(top);
  return order;
}

/** The index of the frame the entry's own call enters on the way to `index`. */
function enteredByEntry(callees: readonly HopCallee[], index: number): number {
  let current = index;
  for (let above = callees[current]!.enteredBy; above !== null; above = callees[current]!.enteredBy) current = above;
  return current;
}

/** Whether `index` is below `above`, which entered it directly or through frames it entered. */
function below(callees: readonly HopCallee[], index: number, above: number): boolean {
  for (let current = callees[index]!.enteredBy; current !== null; current = callees[current]!.enteredBy) {
    if (current === above) return true;
  }
  return false;
}

/** The deferred refusal the execution finishes first, when the entry made every call. */
export function firstDeferredRefusal(
  callees: readonly HopCallee[],
  deferred: ReadonlyMap<number, Error> | undefined,
): Error | undefined {
  if (deferred === undefined) return undefined;
  return finishOrder(callees).map((index) => deferred.get(index)).find((failure) => failure !== undefined);
}

/**
 * Drops the deferred refusals below a callee whose own stop its report names first: that frame stopped before the
 * calls that lead to them, so the execution never meets them.
 */
export function dropDeferredBelow(
  callees: readonly HopCallee[],
  deferred: Map<number, Error>,
  index: number,
): void {
  for (const at of [...deferred.keys()]) if (below(callees, at, index)) deferred.delete(at);
}

/**
 * The deferred refusal the execution meets before the entry's own stop, or undefined when the entry's stop is met
 * first. A stop on an unfilled reference of the entry's own is where the derivation stopped binding rather than where
 * the execution stopped, so then every deferred refusal stands.
 */
export function deferredRefusalMetFirst(options: {
  readonly draft: CompositionDraft;
  readonly vm: Machine;
  /** The entry's master. */
  readonly entry: string;
  /** The reporter's verdict on the draft the entry was evaluated on. */
  readonly report: CompositionRefusal;
  readonly callees: readonly HopCallee[];
  readonly deferred: ReadonlyMap<number, Error> | undefined;
}): Error | undefined {
  const { draft, vm, entry, callees, deferred } = options;
  if (deferred === undefined || deferred.size === 0) return undefined;
  const refused = options.report.refusals.find((refusal) => refusal.master === entry);
  if (refused === undefined || readsUnfilledReference(draft, refused)) return firstDeferredRefusal(callees, deferred);
  const calls = draft.assembly.calls.filter((call) => call.from === entry).map((call) => call.callee);
  let stop: FrameStop | undefined;
  const verdicts = new Map<number, boolean>();
  const made = (index: number): boolean => {
    const call = calls.indexOf(callees[enteredByEntry(callees, index)]!.master);
    if (call < 0) return true;
    if (!verdicts.has(call)) {
      stop ??= frameStopOf(vm.evaluate(draft.programFor(entry)));
      verdicts.set(call, frameMadeCall(draft, vm, entry, call, stop));
    }
    return verdicts.get(call)!;
  };
  const first = finishOrder(callees).find((index) => deferred.has(index) && made(index));
  return first === undefined ? undefined : deferred.get(first);
}
