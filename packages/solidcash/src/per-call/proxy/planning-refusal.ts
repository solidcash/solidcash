/**
 * Which refusal a hop reports when planning its calls fails before the entry is settled (spec V6).
 *
 * The hop plans every call the entry's body publishes, and every frame those calls reach, before it derives one, and
 * refuses by name a shape the transaction cannot carry. The execution meets that shape only once the entry makes the
 * call that leads to it, so an entry that stops on a check of its own before that call never meets it: its own stop
 * comes first. The hop therefore finds the first of the entry's own sites whose frames, with those of the sites
 * before it, the planner refuses, plans the hop again stopped before that site, and settles that plan. The calls from
 * that site on are declared as records no callee stands behind, so the entry runs as it would with every call made
 * and stops on the first of them when it reaches it: then it meets the planning refusal, and an entry that stops
 * before it reports its own stop, or a refusal below a call it made before it, as any settle does. A frame a stopped
 * plan settles to learn an earlier call's result fails the same way: neither its refusal nor a result the hop cannot
 * decode is met before the entry makes the call that leads to it.
 */

import type { createVirtualMachineBch2026 } from '@bitauth/libauth';
import { FrameKind, type Artifact } from '@solidcash/utils';
import {
  UNFILLED_CALLEE_REF, frameReadsCallRecord, frameStopOf, readPublishedStopSites, readsUnfilledReference,
  type CompositionDraft, type CompositionRefusal,
} from '../composer/index.js';
import { PerCallProxyDeployError } from './errors.js';
import { requireSatisfiableReachWrites, type HopExternalPlan } from './external-calls.js';
import { hopTrace, hopTraceError, hopTraceOn } from './hop-trace.js';

type Machine = ReturnType<typeof createVirtualMachineBch2026>;

/**
 * The hop planned again and stopped before the first of the entry's own sites whose frames the planner refuses, the
 * stop carrying `refusal`; undefined when no site is found, which leaves the refusal as it was raised.
 *
 * Each pass plans one site more and runs the cross-reach checks over the frames placed so far, so the site is the one
 * a pass first refuses, the planner itself or its checks. A pass that plans every site, or stops at a site waiting on
 * an earlier result, without a refusal ends the search.
 */
export async function planBeforeRefusedSite(
  plan: (stopBefore: number) => Promise<HopExternalPlan>,
  refusal: Error,
): Promise<HopExternalPlan | undefined> {
  let before: HopExternalPlan;
  try {
    before = await plan(0);
  } catch {
    return undefined;
  }
  for (let site = 0; ; site += 1) {
    const stopped = before.blocked;
    if (stopped?.reads !== 'refusal') return undefined;
    try {
      const next = await plan(site + 1);
      requireSatisfiableReachWrites(next.callees);
      before = next;
    } catch (error) {
      if (!(error instanceof PerCallProxyDeployError)) return undefined;
      if (hopTraceOn()) hopTrace(`planning-refusal site=${site} reason=${hopTraceError(error)}`);
      return { ...before, blocked: { ...stopped, refusal } };
    }
  }
}

/**
 * The hop planned again and stopped before the entry's own site `site`, the stop carrying `refusal`; undefined when
 * the plan does not stop there, as when it stops earlier at a site waiting on an earlier result.
 */
export async function planBeforeSite(
  plan: (stopBefore: number) => Promise<HopExternalPlan>,
  site: number,
  refusal: Error,
): Promise<HopExternalPlan | undefined> {
  let stoppedPlan: HopExternalPlan;
  try {
    stoppedPlan = await plan(site);
  } catch {
    return undefined;
  }
  const stopped = stoppedPlan.blocked;
  return stopped?.reads === 'refusal' ? { ...stoppedPlan, blocked: { ...stopped, refusal } } : undefined;
}

/** The first of the entry's own sites that leads to one of `frames`, by published position, or undefined. */
export function entrySiteOf(plan: HopExternalPlan, frames: Iterable<number>): number | undefined {
  let first: number | undefined;
  for (const frame of frames) {
    let top = frame;
    for (let above = plan.callees[top]?.enteredBy ?? null; above !== null; above = plan.callees[top]?.enteredBy ?? null) {
      top = above;
    }
    const origin = plan.callees[top]?.origin;
    const site = origin === undefined || origin.callerPath !== '' ? -1 : plan.callsiteIds.indexOf(origin.callsiteId);
    if (site >= 0 && (first === undefined || site < first)) first = site;
  }
  return first;
}

/**
 * Declares the calls the entry makes past the ones a stopped plan states, each as a record no callee stands behind,
 * beside a copy of the last segment for the segment it opens.
 *
 * A body whose calls are fixed holds the count its block declares to its own before anything runs, so a block that
 * states only the calls before the stop would refuse there. Declared up to the count the entry publishes, the block
 * lets the body run to its own stop: the stated calls are read as before, and a site past them stops on its record.
 */
export function declareUnstatedCalls(draft: CompositionDraft, artifact: Artifact, master: string): void {
  const run = draft.runs.find((candidate) => candidate.master === master);
  const published = readPublishedStopSites(artifact).entries
    .find((entry) => entry.functionName === run?.functionName);
  if (published === undefined) return;
  const count = published.sites.sites.filter((site) => site.kind === 'segmentClose').length - 1;
  const block = draft.blockOf(master);
  const opened = block.segments[block.segments.length - 1] ?? [];
  while (block.calls.length < count) {
    block.calls.push({
      kind: FrameKind.CALL, target: new Uint8Array(0), value: 0n, calleeRef: UNFILLED_CALLEE_REF,
      argsHash: new Uint8Array(32), result: new Uint8Array(0),
    });
    block.segments.push([...opened]);
  }
}

/** True when the entry runs to completion on the calls the plan states alone, the declared ones left out. */
function completesOnStatedCalls(draft: CompositionDraft, vm: Machine, entry: string, stated: number): boolean {
  const run = draft.runs.find((candidate) => candidate.master === entry);
  if (run === undefined) return false;
  const block = draft.blockOf(entry);
  const trimmed = { ...block, calls: block.calls.slice(0, stated), segments: block.segments.slice(0, stated + 1) };
  return vm.stateSuccess(vm.evaluate(run.programFor(trimmed))) === true;
}

/**
 * True when the entry, refused on a plan stopped before the site a failure is met at, met that failure: it read the
 * record of the first call the plan does not state. A stop on an unfilled reference is where the derivation stopped
 * binding, which says nothing of where the entry stops, and an entry whose calls vary may complete without the call
 * at that site, which leaves it no stop of its own: the failure stands in both cases too.
 */
export function entryMeetsRefusedSite(options: {
  readonly draft: CompositionDraft;
  readonly vm: Machine;
  /** The entry's master. */
  readonly entry: string;
  /** The reporter's verdict on the draft the entry was evaluated on. */
  readonly report: CompositionRefusal;
}): boolean {
  const { draft, vm, entry } = options;
  const refused = options.report.refusals.find((refusal) => refusal.master === entry);
  if (refused === undefined || readsUnfilledReference(draft, refused)) return true;
  const stated = draft.assembly.calls.filter((call) => call.from === entry).length;
  if (completesOnStatedCalls(draft, vm, entry, stated)) return true;
  return frameReadsCallRecord(draft, vm, entry, stated, frameStopOf(vm.evaluate(draft.programFor(entry))));
}
