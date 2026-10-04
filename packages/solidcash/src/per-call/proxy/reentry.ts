/**
 * The views a callee frame starts from when an earlier frame of its contract left them (spec 16 and 20, V6).
 *
 * The hop plans every callee frame against the deployment, then chains the views each record's frames declare in
 * the order the validator walks them (`chainSharedNodeViews`): a later frame starts from the view the last earlier
 * frame of its contract left. That view is the earlier frame's to compute, so the later frame names it in one of two
 * ways, and its settle has to have learned it before the frame is judged:
 *
 *   - a data record or a spent node names the placeholder the composer declared for the earlier write, which a draft
 *     learns at the writer's own close. A close before the writer's first call is learned by any draft; one after a
 *     call is reached only once the writer's earlier calls are bound, which only a derivation from the writer does.
 *     A frame that runs inside the writer, a claimer calling back into the judge that called it, is reached by that
 *     same derivation after the close.
 *   - a node an earlier frame created names the view that frame's own settle learned (`calleeWriteViews`), so the
 *     creator is settled first.
 *
 * The hop settles its callees deepest first, which settles a re-entered frame before the frame it re-enters, and a
 * stopped plan settles only the frames its waiting site reads. `reentrySettleBefore` names the frames to settle
 * before each frame so the views it starts from can be learned, and `deriveReentryWriters` derives the writers a
 * settle needs before it judges the frame.
 *
 * A frame that calls back into the hop's own root runs on the root's records, so the root's implementation frame is
 * a writer every callee runs inside: a write it makes before the call that leads to the frame is one the plan leaves
 * for its own close to state, and that close is learned by deriving the root up to that call, before any callee
 * writer, since the root encloses them all.
 */

import { bytesToHex } from '@solidcash/utils';
import {
  UNFILLED_CALLEE_REF, deriveComposition, unstatedViewPlaceholder,
  type CompositionDraft, type DerivationHost, type DraftCall, type DraftRecordEntry, type FrameRequest,
} from '../composer/index.js';
import { hopTrace, hopTraceError, hopTraceOn } from './hop-trace.js';
import type { HopCallee } from './external-calls.js';

/** True when frame `outer` encloses frame `inner`: `inner` is entered, directly or not, by `outer`. */
function encloses(callees: readonly HopCallee[], outer: number, inner: number): boolean {
  for (let at = callees[inner]!.enteredBy; at !== null; at = callees[at]!.enteredBy) if (at === outer) return true;
  return false;
}

/** The frame itself and every frame it enters, in placement order. */
function subtreeOf(callees: readonly HopCallee[], index: number): readonly number[] {
  return callees.flatMap((_callee, at) => (at === index || encloses(callees, index, at) ? [at] : []));
}

/** The category of the records a frame runs on: its own, or its owner's for a delegate frame. */
function recordCategoryOf(callees: readonly HopCallee[], index: number): string {
  const callee = callees[index]!;
  return bytesToHex((callee.recordOwner === undefined ? callee : callees[callee.recordOwner]!).category);
}

/** The segments a frame's own writes land in, as its artifact publishes them; `'last'` is the one after its calls. */
function writeSegmentsOf(callee: HopCallee): readonly number[] {
  const entry = callee.artifact.composition?.stopSites?.entries
    .find((candidate) => candidate.functionName === callee.functionName);
  const published = entry?.writeSegments?.map((write) => write.segment)
    ?? (entry?.writeSegment === undefined ? [] : [entry.writeSegment]);
  return published.map((segment) => (segment === 'last' ? callee.calls.length : segment));
}

/** The frame `outer` calls on its way to `inner`, which it encloses: `inner` itself or one of its enclosers. */
function childToward(callees: readonly HopCallee[], outer: number, inner: number): number {
  let child = inner;
  while (callees[child]!.enteredBy !== outer) child = callees[child]!.enteredBy!;
  return child;
}

/** The position, among `outer`'s own calls, of the call through which `outer` enters `inner`. */
function callToward(callees: readonly HopCallee[], outer: number, inner: number): number {
  const child = childToward(callees, outer, inner);
  return callees[outer]!.calls.findIndex((call) => call.callee === callees[child]!.master);
}

/**
 * For each callee frame, the frames to settle before it so that the views it starts from can be learned.
 *
 * Every earlier frame that writes a category the frame's subtree runs on, and does not enclose it, comes first: the
 * view of a node it created is the one its own settle learned, and a write after one of its calls is learned by a
 * derivation from it, which needs its calls answered. A writer the frame runs inside cannot come first; when it
 * wrote after one of its calls and before the call the frame is reached through, the derivation from it reaches the
 * frame once every frame it runs first has answered, so each frame placed between the two that does not enclose the
 * frame comes first instead. The frames are placed in the order the validator walks them, so each named frame runs
 * before this one and none is entered through it: the order still settles a frame's callees before it.
 */
export function reentrySettleBefore(callees: readonly HopCallee[]): ReadonlyMap<number, readonly number[]> {
  const before = new Map<number, readonly number[]>();
  callees.forEach((_callee, index) => {
    const categories = new Set(subtreeOf(callees, index).map((at) => recordCategoryOf(callees, at)));
    const frames = new Set<number>();
    callees.forEach((writer, at) => {
      if (at >= index || !categories.has(recordCategoryOf(callees, at))) return;
      const segments = writeSegmentsOf(writer);
      if (segments.length === 0 && writer.entryWrites === undefined) return;
      if (!encloses(callees, at, index)) {
        frames.add(at);
        return;
      }
      const through = callToward(callees, at, index);
      if (!segments.some((segment) => segment > 0 && segment <= through)) return;
      for (let between = at + 1; between < index; between += 1) {
        if (!encloses(callees, between, index)) frames.add(between);
      }
    });
    if (frames.size > 0) before.set(index, [...frames].sort((left, right) => left - right));
  });
  return before;
}

/** `frames` with every frame `reentrySettleBefore` names for one of them, closed over. */
export function withReentryFrames(frames: Set<number>, callees: readonly HopCallee[]): Set<number> {
  const before = reentrySettleBefore(callees);
  const pending = [...frames];
  while (pending.length > 0) {
    for (const frame of before.get(pending.pop()!) ?? []) {
      if (frames.has(frame)) continue;
      frames.add(frame);
      pending.push(frame);
    }
  }
  return frames;
}

/**
 * A declaration that carries a chained record on from its frame's own last one, restated from the chain walk.
 *
 * A frame that makes a call between two declarations of one record is entered again when a frame of its contract
 * runs below that call, and a write there moves the record on: the later declaration continues from the view that
 * write left, which the walk holds in `continued`, rather than from the frame's own last view. A kept declaration
 * takes that view on both sides; a write starts from it and leaves the placeholder the composer declares for it,
 * which the walk carries on to the frames after. A record the walk does not chain, or holds no view of, is left as
 * it is.
 */
export function carriedFromChain(
  entry: DraftRecordEntry, chained: ReadonlySet<number>, continued: Map<number, Uint8Array>,
  master: string, segmentIndex: number, entryIndex: number,
): DraftRecordEntry {
  const view = continued.get(entry.in);
  if (entry.viewIn !== 'carried' || !chained.has(entry.in) || view === undefined) return entry;
  if (entry.viewOut === 'carried') return { ...entry, viewIn: view, viewOut: view };
  continued.set(entry.in, entry.viewOut ?? unstatedViewPlaceholder(master, segmentIndex, entryIndex));
  return { ...entry, viewIn: view };
}

/** The request that derives a callee frame on its own. */
function requestOf(callee: HopCallee): FrameRequest {
  return { contract: callee.contract, functionName: callee.functionName, kind: callee.kind, master: callee.master };
}

/** Ends a writer's derivation once it has bound the call through which it enters the frame being settled. */
class ReachedSettledFrame extends Error {}

/**
 * The candidate's host, ending the derivation at the step of `master` that binds its call `callIndex`.
 *
 * That step learns the closes before the call, which is what the derivation is run for; the frames the call enters
 * are the settled frame's own to derive, and its own settle judges them.
 */
function stoppingAt(
  candidate: { readonly draft: CompositionDraft; readonly host: DerivationHost }, master: string, callIndex: number,
): DerivationHost {
  return {
    sitesFor: (functionName) => candidate.host.sitesFor(functionName),
    step: (request, site) => {
      const outcome = candidate.host.step(request, site);
      if (request.master === master && site.kind === 'call'
        && candidate.draft.blockOf(master).calls[callIndex]?.calleeRef !== UNFILLED_CALLEE_REF) {
        throw new ReachedSettledFrame();
      }
      return outcome;
    },
  };
}

/** The hop's own implementation frame, inside one of whose calls every callee frame runs. */
export interface EnclosingRoot {
  readonly request: FrameRequest;
  /** The frame's own calls, in the order it makes them. */
  readonly calls: readonly DraftCall[];
  /** The category of the records the root runs on, its proxy's, as hex. */
  readonly recordCategory: string;
}

/** Derives the root frame up to the call through which it enters frame `index`, learning its closes before it. */
function deriveRootUpToEntering(
  candidate: { readonly draft: CompositionDraft; readonly host: DerivationHost },
  callees: readonly HopCallee[],
  index: number,
  root: EnclosingRoot,
): void {
  let top = index;
  for (let above = callees[top]!.enteredBy; above !== null; above = callees[top]!.enteredBy) top = above;
  const callIndex = root.calls.findIndex((call) => call.callee === callees[top]!.master);
  if (callIndex < 0) return;
  try {
    deriveComposition([root.request], stoppingAt(candidate, root.request.master, callIndex));
  } catch (error) {
    if (hopTraceOn() && !(error instanceof ReachedSettledFrame)) {
      hopTrace(`reentry-stop writer=${root.request.master} reason=${hopTraceError(error)}`);
    }
  }
}

/**
 * Derives the writers of the views a callee frame's subtree starts from, before the frame is judged.
 *
 * A declaration of the frame or of a frame it enters that names the placeholder of an earlier frame's write starts
 * from that write, which the draft learns at the writer's close. Each writer the frame runs inside is derived up to
 * the call through which it enters the frame, outermost first: that binds the writer's earlier calls and learns its
 * closes, and leaves the frame's subtree to the settle. A writer it does not run inside is derived whole, unless one
 * of those derivations already runs it. A derivation that stops past the close it was run for has done its work, so
 * its stall is not the frame's verdict.
 *
 * A subtree that calls back into the hop's own root runs on the root's records, and the root encloses every frame:
 * when its own close is still to state a view, the root is derived first, up to the call that leads to the frame, so
 * the subtree and every writer between them start from what the root left there.
 */
export function deriveReentryWriters(
  candidate: { readonly draft: CompositionDraft; readonly host: DerivationHost },
  callees: readonly HopCallee[],
  index: number,
  root?: EnclosingRoot,
): void {
  const subtree = subtreeOf(callees, index);
  const inside = new Set(subtree.map((at) => callees[at]!.master));
  const writerOf = new Map<string, string>();
  for (const view of candidate.draft.unlearnedViews()) {
    if (inside.has(view.master)) continue;
    writerOf.set(bytesToHex(unstatedViewPlaceholder(view.master, view.segmentIndex, view.entryIndex)), view.master);
  }
  if (writerOf.size === 0) return;
  if (root !== undefined && [...writerOf.values()].includes(root.request.master)
    && subtree.some((at) => recordCategoryOf(callees, at) === root.recordCategory)) {
    deriveRootUpToEntering(candidate, callees, index, root);
  }
  const named = new Set<string>();
  for (const at of subtree) {
    for (const segment of candidate.draft.blockOf(callees[at]!.master).segments) {
      for (const entry of segment) {
        for (const view of [entry.viewIn, entry.viewOut]) {
          const writer = writerOf.get(bytesToHex(view));
          if (writer !== undefined) named.add(writer);
        }
      }
    }
  }
  const writers = callees.flatMap((callee, at) => (named.has(callee.master) ? [at] : []));
  if (writers.length === 0) return;
  const enclosing = writers.filter((at) => encloses(callees, at, index));
  // A writer runs, before the call through which it enters the settled frame, every frame it enters before that one.
  const runBy = (outer: number, at: number): boolean => {
    const toward = childToward(callees, outer, index);
    return encloses(callees, outer, at) && at !== toward && !encloses(callees, toward, at);
  };
  const whole = writers.filter((at) => !enclosing.includes(at) && !enclosing.some((outer) => runBy(outer, at)));
  const derivations = [
    ...whole.filter((at) => !whole.some((other) => encloses(callees, other, at)))
      .map((at) => ({ writer: at, host: candidate.host })),
    ...enclosing.map((at) => ({
      writer: at, host: stoppingAt(candidate, callees[at]!.master, callToward(callees, at, index)),
    })),
  ];
  for (const { writer, host } of derivations) {
    try {
      deriveComposition([requestOf(callees[writer]!)], host);
    } catch (error) {
      if (hopTraceOn() && !(error instanceof ReachedSettledFrame)) {
        hopTrace(`reentry-stop writer=${callees[writer]!.master} reason=${hopTraceError(error)}`);
      }
    }
  }
  if (hopTraceOn()) {
    hopTrace(`reentry callee=${callees[index]!.master} writers=[${writers.map((at) => callees[at]!.master).join(',')}] `
      + `derived=[${derivations.map(({ writer }) => callees[writer]!.master).join(',')}]`);
  }
}

/**
 * Derives frame `writer` up to the call through which it enters frame `index`, which it encloses, so its run reaches
 * the code before that call with its earlier calls answered (`enclosed-values.ts`). A stall on the way is the
 * writer's own to report when it settles, not this derivation's.
 */
export function deriveUpToEntering(
  candidate: { readonly draft: CompositionDraft; readonly host: DerivationHost },
  callees: readonly HopCallee[],
  writer: number,
  index: number,
): void {
  try {
    deriveComposition([requestOf(callees[writer]!)],
      stoppingAt(candidate, callees[writer]!.master, callToward(callees, writer, index)));
  } catch (error) {
    if (hopTraceOn() && !(error instanceof ReachedSettledFrame)) {
      hopTrace(`enclosing-stop writer=${callees[writer]!.master} reason=${hopTraceError(error)}`);
    }
  }
}
