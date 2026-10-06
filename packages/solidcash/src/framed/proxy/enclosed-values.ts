/**
 * The bytes an enclosing writer leaves a node at, learned from the writer's own run before the frames it encloses
 * are judged (spec 20, V6).
 *
 * A frame that rewrites a node before the call that leads to frames reading or rewriting it again
 * (`enclosed-reads.ts`) leaves the bytes those frames start from: a long value's witness, the fields a later write
 * keeps, and the view the read keeps. A write whose value the body computes is planned against a candidate - a
 * chunking value with its run unstated (`awaitsValue`), and every value of a collection whose values do not chunk -
 * and the frames inside it are judged before it settles, deepest first. So before such a frame is judged, the writer
 * is derived up to the call that leads there and run once more:
 *
 *   - a long value stops the writer's own chunk pin on the bytes it computed: a whole value of the collection's own
 *     type whose digest is beside it. Those bytes are read there, and the hop is planned again from them
 *     (`EnclosingValueLearned`), which states the write and the bytes every frame inside it starts from;
 *   - a value the node keeps inline passes no pin, and the run stops where the writer closes the node against the
 *     plan's candidate: the close's other operand is the node the writer rebuilt, at the candidate's own slot. A
 *     chunking value is read out of that node's tail and the hop is planned again from it, as from a pin; any other
 *     node's view is handed back to the settle, which states it for the writer and judges the frame on it
 *     (`EnclosingViewLearned`). Either only fills the plan: the writer's own close compares the node it rebuilds
 *     against the view the transaction declares, so a view the writer does not compute is still refused;
 *   - a run that stops anywhere else stops before the write: the execution never reaches the frames inside the writer
 *     there, so nothing is learned and the settle reports whichever refusal the execution meets first.
 */

import { bytesEqual, bytesToHex, VALUE_INLINE_LIMIT } from '@solidcash/utils';
import { decodeEntryCommitment } from '../../stateful/SortedList.js';
import type { CompositionDraft, DerivationHost } from '../composer/index.js';
import type { DeclarationReading } from '../deploy/declaration.js';
import { enclosedValueRefusal, writesBeforeEntering } from './enclosed-reads.js';
import { isWholeNodeValue, sharedNodeId } from './entry-writes.js';
import type { HopCallee } from './external-calls.js';
import { deriveUpToEntering } from './reentry.js';

/**
 * The hop learned the bytes a writer leaves a node at, and is to be planned again from them: an enclosing writer, or
 * an earlier sibling of the frames that reach the node after it (`reached-values.ts`).
 */
export class EnclosingValueLearned extends Error {
  public readonly name = 'EnclosingValueLearned';

  public constructor(public readonly master: string, public readonly value: Uint8Array) {
    super(`the hop learned the bytes the frame "${master}" leaves a node at, before the frames that start from them `
      + 'settled');
  }
}

/** The view an enclosing writer's own close rebuilt for one of its nodes, by its place among the writer's candidates. */
export interface EnclosingViewLearned {
  readonly master: string;
  readonly at: number;
  readonly view: Uint8Array;
}

/** What one run of a writer's program shows: the value its pin stopped on, and the comparison it stopped at. */
export interface WriterRun {
  readonly valueAt: (master: string) => Uint8Array | undefined;
  readonly readingAt: (master: string) => DeclarationReading;
}

/** A node one frame's write leaves at a view its body computes, and where that view sits among its candidates. */
interface WrittenNode {
  /** The participant id every frame of the hop names the node by. */
  readonly id: string;
  readonly collection: string;
  readonly slot: Uint8Array;
  /** The node's place in the frame's `learningCandidates`. */
  readonly at: number;
  readonly chunkable: boolean;
  /** True when the plan states the whole value a chunking write leaves, so its candidate is the node's view. */
  readonly stated: boolean;
}

/** An enclosing writer whose value awaits learning, and the first frame of the settled subtree that touches its node. */
interface AwaitedValue {
  readonly writer: number;
  readonly toucher: number;
  readonly node: WrittenNode;
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

/**
 * The nodes frame `frame` reads or writes, by participant id, each marked true when the frame only reads it. A node
 * an earlier frame of the hop created is written at that frame's output rather than spent, so a frame's own written
 * nodes count beside the ones it spends.
 */
function touchedNodes(callees: readonly HopCallee[], frame: number): ReadonlyMap<string, boolean> {
  const callee = callees[frame]!;
  const touched = new Map<string, boolean>((callee.readNodes ?? []).map((node) => [node.id, true]));
  for (const write of callee.entryWrites?.reachWrites ?? []) {
    for (const id of write.spentIds) touched.set(id, false);
  }
  for (const node of writtenNodesOf(callees, frame)) touched.set(node.id, false);
  return touched;
}

/** Every node frame `frame`'s write leaves at a view its body computes: the nodes it creates and the ones it rewrites. */
function writtenNodesOf(callees: readonly HopCallee[], frame: number): readonly WrittenNode[] {
  const writer = callees[frame]!;
  const writes = writer.entryWrites;
  if (writes === undefined) return [];
  // A delegate frame writes its caller's records, so its nodes are named under the owner's category.
  const owner = writer.recordOwner === undefined ? writer : callees[writer.recordOwner]!;
  const categoryId = bytesToHex(owner.category);
  const collections = writer.artifact.stateLayout?.collections ?? [];
  return writes.writtenNodes.flatMap((node): WrittenNode[] => {
    // A node the batch only relinks keeps its value, so it is no candidate of the frame's own.
    const at = writes.learningSlotOrder.findIndex((slot) => bytesEqual(slot, node.slot));
    if (at < 0) return [];
    return [{
      id: sharedNodeId(categoryId, node.collection, node.slot),
      collection: node.collection,
      slot: node.slot,
      at,
      chunkable: collections.some((collection) => collection.name === node.collection
        && collection.chunkableValue === true),
      stated: node.value !== undefined,
    }];
  });
}

/**
 * True when the view a writer leaves `node` at is still the body's to compute: a chunking value the plan has not
 * stated and no settle has learned, or a view of any other node no settle has learned.
 */
function awaitsNode(
  writer: HopCallee,
  node: WrittenNode,
  learnedValues: ReadonlyMap<string, Uint8Array>,
  learnedViews: ReadonlyMap<string, readonly (Uint8Array | undefined)[]>,
): boolean {
  if (node.chunkable) {
    return writer.entryWrites?.awaitsValue === true && !node.stated && !learnedValues.has(writer.master);
  }
  return learnedViews.get(writer.master)?.[node.at] === undefined;
}

/**
 * The enclosing writers of frame `index`, outermost first, each with a node it leaves for its body to compute that a
 * frame of `index`'s subtree reads or rewrites after it (`writesBeforeEntering`), and the first such frame.
 */
function awaitedValues(
  callees: readonly HopCallee[],
  index: number,
  learnedValues: ReadonlyMap<string, Uint8Array>,
  learnedViews: ReadonlyMap<string, readonly (Uint8Array | undefined)[]>,
): readonly AwaitedValue[] {
  const subtree = subtreeOf(callees, index);
  const awaited: AwaitedValue[] = [];
  for (let at = callees[index]!.enteredBy; at !== null; at = callees[at]!.enteredBy) {
    const writer = at;
    for (const node of writtenNodesOf(callees, writer)) {
      if (!awaitsNode(callees[writer]!, node, learnedValues, learnedViews)) continue;
      const toucher = subtree.find((frame) => writesBeforeEntering(callees, writer, frame, node.collection)
        && touchedNodes(callees, frame).has(node.id));
      if (toucher === undefined) continue;
      awaited.unshift({ writer, toucher, node, reads: touchedNodes(callees, toucher).get(node.id) === true });
      break;
    }
  }
  return awaited;
}

/** True when `value` is one whole long value of `collection`'s own type, as the writer's pin holds it. */
function wholeLongValue(writer: HopCallee, collection: string, value: Uint8Array): boolean {
  if (value.length <= VALUE_INLINE_LIMIT) return false;
  const declared = writer.artifact.stateLayout?.collections?.find((candidate) => candidate.name === collection);
  return declared !== undefined && isWholeNodeValue(declared, value, writer.artifact.structs);
}

/**
 * True when `value`, which the writer's run stopped its pin on, is the long value its unstated chunking write
 * computes: the pin stops the run before any close after it, whichever node the frame inside touches.
 */
function pinnedLongValue(
  writer: HopCallee, learnedValues: ReadonlyMap<string, Uint8Array>, value: Uint8Array | undefined,
): value is Uint8Array {
  const writes = writer.entryWrites;
  if (value === undefined || writes?.awaitsValue !== true || learnedValues.has(writer.master)) return false;
  return writes.reachWrites.some((write) => write.chunkable && wholeLongValue(writer, write.collection, value));
}

/**
 * The value a chunking node's view keeps inline: the whole value of the collection's own type its tail holds, or
 * undefined when the tail holds a long value's digest instead.
 */
function inlineNodeValue(writer: HopCallee, node: WrittenNode, view: Uint8Array): Uint8Array | undefined {
  const tail = decodeEntryCommitment(view).value;
  if (tail.length < 4) return undefined;
  const length = new DataView(tail.buffer, tail.byteOffset, 4).getUint32(0, true);
  if (length > VALUE_INLINE_LIMIT || tail.length !== 4 + length) return undefined;
  const value = tail.slice(4);
  const declared = writer.artifact.stateLayout?.collections?.find((candidate) => candidate.name === node.collection);
  return declared !== undefined && isWholeNodeValue(declared, value, writer.artifact.structs) ? value : undefined;
}

/**
 * The value frame `frame` leaves inline in its chunking node at candidate `at`, read off the view its own close
 * rebuilt, or undefined for any other node.
 *
 * A chunking write whose value the body computes stops its own pin when the value is long; one the node keeps inline
 * passes no pin, and the close of the node against the plan's candidate is the only place the value shows. A later
 * reach of the node continues from it as from a pin's (`reached-values.ts`).
 */
export function inlineValueAt(
  callees: readonly HopCallee[], frame: number, at: number, view: Uint8Array,
): Uint8Array | undefined {
  const node = writtenNodesOf(callees, frame).find((candidate) => candidate.at === at);
  if (node === undefined || !node.chunkable || view.length < 64) return undefined;
  if (!bytesEqual(decodeEntryCommitment(view).slot, node.slot)) return undefined;
  return inlineNodeValue(callees[frame]!, node, view);
}

/** The node a writer's run closed against the plan's candidate, and the view the run rebuilt for it. */
interface ClosedNode {
  readonly node: WrittenNode;
  readonly view: Uint8Array;
}

/**
 * The node writer `writer`'s run stopped closing against one of its candidates before the call that leads to frame
 * `index`, with the view the run rebuilt, or undefined when the run stopped anywhere else.
 *
 * A close names the declaration and the node the body computed, whichever operand the candidate sits on, and the
 * candidates are in the order the body closes them: the node is the first match no settle has learned yet. A node
 * the writer writes past that call is computed from what the call returned, which the frame's settle is still to
 * learn, so only a close of a node written before it is read.
 */
function closedNode(
  callees: readonly HopCallee[],
  writer: number,
  index: number,
  reading: DeclarationReading,
  learnedViews: ReadonlyMap<string, readonly (Uint8Array | undefined)[]>,
): ClosedNode | undefined {
  if (!reading.ok) return undefined;
  const callee = callees[writer]!;
  const candidates = callee.entryWrites?.learningCandidates ?? [];
  const learned = learnedViews.get(callee.master) ?? [];
  const placeOf = (operand: Uint8Array): number => {
    const matches = candidates.flatMap((candidate, at) => (bytesEqual(operand, candidate) ? [at] : []));
    return matches.find((at) => learned[at] === undefined) ?? matches[0] ?? -1;
  };
  const declaredAt = placeOf(reading.declared);
  const at = declaredAt >= 0 ? declaredAt : placeOf(reading.computed);
  const node = writtenNodesOf(callees, writer).find((candidate) => candidate.at === at);
  if (node === undefined || !writesBeforeEntering(callees, writer, index, node.collection)) return undefined;
  return { node, view: Uint8Array.from(declaredAt >= 0 ? reading.computed : reading.declared) };
}

/** How many candidates the frames enclosing frame `index` state, each a view its settle may learn for them first. */
export function enclosingCandidateCount(callees: readonly HopCallee[], index: number): number {
  let count = 0;
  for (let at = callees[index]!.enteredBy; at !== null; at = callees[at]!.enteredBy) {
    count += callees[at]!.entryWrites?.learningCandidates.length ?? 0;
  }
  return count;
}

/**
 * Before frame `index` is judged: the bytes each enclosing writer leaves a node the frame's subtree touches, when the
 * writer's body computes them. The writer is derived up to the call that leads there and its run is read
 * (`WriterRun`): a long value its pin stopped on, and a chunking value its close of the node rebuilt inline, are
 * thrown as `EnclosingValueLearned`, so the hop is planned again from them; the view its close rebuilt for any other
 * node is returned, for the settle to state before it judges the frame; and a run that stops before the write learns
 * nothing. A close whose other operand is not a node at the candidate's own slot exposes no value, and the touch is
 * refused by name.
 */
export function learnEnclosingValues(
  candidate: { readonly draft: CompositionDraft; readonly host: DerivationHost },
  callees: readonly HopCallee[],
  index: number,
  learnedValues: ReadonlyMap<string, Uint8Array>,
  learnedViews: ReadonlyMap<string, readonly (Uint8Array | undefined)[]>,
  run: WriterRun,
): EnclosingViewLearned | undefined {
  for (const awaited of awaitedValues(callees, index, learnedValues, learnedViews)) {
    deriveUpToEntering(candidate, callees, awaited.writer, index);
    const writer = callees[awaited.writer]!;
    const value = run.valueAt(writer.master);
    if (pinnedLongValue(writer, learnedValues, value)) throw new EnclosingValueLearned(writer.master, value);
    const closed = closedNode(callees, awaited.writer, index, run.readingAt(writer.master), learnedViews);
    if (closed === undefined) continue;
    const refusal = (): Error => enclosedValueRefusal(callees[awaited.toucher]!.functionName, awaited.reads,
      awaited.node.collection, writer.functionName);
    if (closed.view.length < 64 || !bytesEqual(decodeEntryCommitment(closed.view).slot, closed.node.slot)) {
      throw refusal();
    }
    // The node the frame touches carries its value on to the frames after it, so a chunking one is stated whole.
    if (closed.node.chunkable && closed.node.id === awaited.node.id) {
      const inline = inlineNodeValue(writer, closed.node, closed.view);
      if (inline === undefined) throw refusal();
      throw new EnclosingValueLearned(writer.master, inline);
    }
    // A view the plan already states is no progress: the frame is judged on it.
    const known = learnedViews.get(writer.master)?.[closed.node.at];
    if (known !== undefined && bytesEqual(known, closed.view)) continue;
    return { master: writer.master, at: closed.node.at, view: closed.view };
  }
  return undefined;
}
