/**
 * The bytes an enclosing writer leaves a node at, learned from the writer's own chunk pin before the frames it
 * encloses are judged (spec 20, V6).
 *
 * A frame that rewrites a node whose values chunk before the call that leads to frames reading or rewriting it again
 * (`enclosed-reads.ts`) leaves the bytes those frames start from: a long value's witness, and the fields a later write
 * keeps. A write whose value the body computes is planned with its run unstated (`awaitsValue`), and the frames
 * inside it are judged before it settles, deepest first. So before such a frame is judged, the writer is derived up to
 * the call that leads there and run once more:
 *
 *   - a long value stops the writer's own chunk pin on the bytes it computed: a whole value of the collection's own
 *     type whose digest is beside it. Those bytes are read there, and the hop is planned again from them
 *     (`EnclosingValueLearned`), which states the write and the bytes every frame inside it starts from;
 *   - a value the node keeps inline passes no pin, and the run stops where the writer closes the node against the
 *     plan's candidate: nothing exposes the value before the frame is judged, so the touch is refused by its own name,
 *     as it is at planning for any other computed value;
 *   - a run that stops anywhere else stops before the write: the execution never reaches the frames inside the writer
 *     there, so nothing is learned and the settle reports whichever refusal the execution meets first.
 */

import { bytesEqual, decodePushdataValue, VALUE_INLINE_LIMIT } from '@solidcash/utils';
import type { CompositionDraft, DerivationHost } from '../composer/index.js';
import type { DeclarationReading } from '../deploy/declaration.js';
import { enclosedValueRefusal, writesBeforeEntering } from './enclosed-reads.js';
import type { HopCallee } from './external-calls.js';
import { deriveUpToEntering } from './reentry.js';

/** The hop learned the bytes an enclosing writer leaves a node at, and is to be planned again from them. */
export class EnclosingValueLearned extends Error {
  public readonly name = 'EnclosingValueLearned';

  public constructor(public readonly master: string, public readonly value: Uint8Array) {
    super(`the hop learned the bytes the frame "${master}" leaves a node at, before the frames it encloses settled`);
  }
}

/** What one run of a writer's program shows: the value its pin stopped on, and the comparison it stopped at. */
export interface WriterRun {
  readonly valueAt: (master: string) => Uint8Array | undefined;
  readonly readingAt: (master: string) => DeclarationReading;
}

/** An enclosing writer whose value awaits learning, and the first frame of the settled subtree that touches its node. */
interface AwaitedValue {
  readonly writer: number;
  readonly toucher: number;
  readonly collection: string;
  readonly reads: boolean;
}

/** The frame and every frame it enters, in placement order. */
function subtreeOf(callees: readonly HopCallee[], index: number): readonly number[] {
  return callees.flatMap((_callee, at) => {
    for (let frame: number | null = at; frame !== null; frame = callees[frame]!.enteredBy) {
      if (frame === index) return [at];
    }
    return [];
  });
}

/** The nodes a frame reads or writes, by participant id, each marked true when the frame only reads it. */
function touchedNodes(callee: HopCallee): ReadonlyMap<string, boolean> {
  const touched = new Map<string, boolean>((callee.readNodes ?? []).map((node) => [node.id, true]));
  for (const write of callee.entryWrites?.reachWrites ?? []) {
    for (const id of write.spentIds) touched.set(id, false);
  }
  return touched;
}

/**
 * The enclosing writers of frame `index`, outermost first, whose write awaits its value and spends a node a frame of
 * `index`'s subtree reads or rewrites after it (`writesBeforeEntering`), each with the first such frame.
 */
function awaitedValues(
  callees: readonly HopCallee[], index: number, learned: ReadonlyMap<string, Uint8Array>,
): readonly AwaitedValue[] {
  const subtree = subtreeOf(callees, index);
  const awaited: AwaitedValue[] = [];
  for (let at = callees[index]!.enteredBy; at !== null; at = callees[at]!.enteredBy) {
    const writer = at;
    const writes = callees[writer]!.entryWrites;
    if (writes?.awaitsValue !== true || learned.has(callees[writer]!.master)) continue;
    for (const write of writes.reachWrites) {
      const toucher = subtree.find((frame) => writesBeforeEntering(callees, writer, frame, write.collection)
        && write.spentIds.some((id) => touchedNodes(callees[frame]!).has(id)));
      if (toucher === undefined) continue;
      const reads = write.spentIds.some((id) => touchedNodes(callees[toucher]!).get(id) === true);
      awaited.unshift({ writer, toucher, collection: write.collection, reads });
      break;
    }
  }
  return awaited;
}

/** True when `value` is one whole long value of `collection`'s own type, as the writer's pin holds it. */
function wholeLongValue(writer: HopCallee, collection: string, value: Uint8Array): boolean {
  if (value.length <= VALUE_INLINE_LIMIT) return false;
  const declared = writer.artifact.stateLayout?.collections?.find((candidate) => candidate.name === collection);
  if (declared === undefined) return false;
  try {
    return decodePushdataValue(value, 0, declared.valueType, writer.artifact.structs).bytesConsumed === value.length;
  } catch {
    return false;
  }
}

/** True when the writer's run stopped closing a node it writes against the candidate the plan states for it. */
function closesOnCandidate(writer: HopCallee, reading: DeclarationReading): boolean {
  if (!reading.ok) return false;
  return (writer.entryWrites?.learningCandidates ?? []).some((candidate) =>
    bytesEqual(candidate, reading.declared) || bytesEqual(candidate, reading.computed));
}

/**
 * Before frame `index` is judged: the bytes each enclosing writer whose value awaits learning leaves a node the
 * frame's subtree touches. The writer is derived up to the call that leads there and its run is read (`WriterRun`):
 * a long value its pin stopped on is thrown as `EnclosingValueLearned`, so the hop is planned again from it; a value
 * the writer closes inline is refused by name; and a run that stops before the write learns nothing.
 */
export function learnEnclosingValues(
  candidate: { readonly draft: CompositionDraft; readonly host: DerivationHost },
  callees: readonly HopCallee[],
  index: number,
  learned: ReadonlyMap<string, Uint8Array>,
  run: WriterRun,
): void {
  for (const awaited of awaitedValues(callees, index, learned)) {
    deriveUpToEntering(candidate, callees, awaited.writer, index);
    const writer = callees[awaited.writer]!;
    const value = run.valueAt(writer.master);
    if (value !== undefined && wholeLongValue(writer, awaited.collection, value)) {
      throw new EnclosingValueLearned(writer.master, value);
    }
    if (closesOnCandidate(writer, run.readingAt(writer.master))) {
      throw enclosedValueRefusal(callees[awaited.toucher]!.functionName, awaited.reads, awaited.collection,
        writer.functionName);
    }
  }
}
