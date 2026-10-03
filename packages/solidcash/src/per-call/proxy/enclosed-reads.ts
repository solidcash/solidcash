/**
 * A mapping node a frame writes before the call that leads to frames of its contract reading it back or rewriting it
 * (spec 20, V6).
 *
 * A frame that records a decision in its own mapping and then calls out to a frame which reads that record back
 * through the first contract's getter, or rewrites it in place, touches one node from two frames, one of which runs
 * inside the other: a re-entered touch of a node an outer frame wrote. The chain walk restates every declaration in
 * execution order, each segment of a frame with the callee of its call between it and the next
 * (`chainSharedNodeViews`), so a read keeps the view the writer's segment left and a rewrite continues from it, and
 * the frames the writer runs before that call settle first (`reentry.ts`). The touch is judged before the writer
 * settles, so the pair chains when the value the writer leaves is one the touch can be given then
 * (`enclosingWriteValue`): a value the plan states, as it does for a field the write sets beside the fields it keeps,
 * or a value the body computes, which the hop learns from the writer's own run before the touch is judged
 * (`enclosed-values.ts`): a long value from the writer's chunk pin, and a value the node keeps inline, which every
 * value of a collection whose values do not chunk is, from the writer's close of the node. A computed value no run
 * exposes is refused by its own name there, and any other pair of touches one frame of which enters the other is
 * still refused as before.
 */

import { bytesToHex } from '@solidcash/utils';
import { sharedNodeId } from './entry-writes.js';
import type { HopCallee } from './external-calls.js';
import { PerCallProxyDeployError } from './errors.js';

/** One frame's touch of a node, as the chain checks read it. */
interface EnclosedTouch {
  readonly frame: number;
  readonly functionName: string;
  readonly kind: string;
  /** True when the node's collection holds values that chunk. */
  readonly chunkable: boolean;
}

/** True when frame `outer` enters frame `inner`, directly or through the frames between them. */
function enclosesFrame(callees: readonly HopCallee[], outer: number, inner: number): boolean {
  for (let at = callees[inner]?.enteredBy ?? null; at !== null; at = callees[at]?.enteredBy ?? null) {
    if (at === outer) return true;
  }
  return false;
}

/** The position, among `outer`'s own calls, of the call through which it enters `inner`, which it encloses. */
function callToward(callees: readonly HopCallee[], outer: number, inner: number): number {
  let child = inner;
  while (callees[child]!.enteredBy !== outer) child = callees[child]!.enteredBy!;
  return callees[outer]!.calls.findIndex((call) => call.callee === callees[child]!.master);
}

/**
 * True when frame `outer` encloses `inner` and every write of `collection` the outer's entry publishes lands in a
 * segment that closes no later than the call through which it enters `inner`: a touch of `inner` follows them all.
 */
export function writesBeforeEntering(
  callees: readonly HopCallee[], outer: number, inner: number, collection: string,
): boolean {
  if (!enclosesFrame(callees, outer, inner)) return false;
  const writer = callees[outer]!;
  const through = callToward(callees, outer, inner);
  if (through < 0) return false;
  // A published segment counts the source's calls, which are the plan's own while each site up to the one that
  // leads to `inner` placed exactly one call.
  const bases = writer.callBases.slice(0, through + 1);
  if (bases.length !== through + 1 || !bases.every((base, site) => base === site)) return false;
  const entry = writer.artifact.composition?.stopSites?.entries
    .find((candidate) => candidate.functionName === writer.functionName);
  // A write a run-time loop makes once per turn lands past the loop's own calls, which no fixed segment names.
  const writes = (entry?.writeSegments ?? []).filter((write) => write.collection === collection);
  return writes.length > 0 && writes.every((write) =>
    write.turns === undefined && typeof write.segment === 'number' && write.segment <= through);
}

/**
 * True when `outer` updates a node of `collection` that `inner`, a frame it encloses, reads or rewrites in place,
 * after every write of that collection the outer makes (`writesBeforeEntering`): the read keeps the view the outer's
 * write left and the rewrite continues from it, which the chain walk states.
 */
function followsEnclosingWrite(
  callees: readonly HopCallee[], outer: EnclosedTouch, inner: EnclosedTouch, collection: string,
): boolean {
  if (outer.kind !== 'update' || (inner.kind !== 'read' && inner.kind !== 'update')) return false;
  return writesBeforeEntering(callees, outer.frame, inner.frame, collection);
}

/**
 * The value the enclosing writer leaves node `nodeId` at, as the touch it encloses sees it, or undefined when the
 * plan does not state it.
 *
 * The touch is judged first, against the view the writer's declaration states, so the value has to be known before
 * the writer runs: a value the plan states is (a chunking collection's write the planner resolves, or one the hop
 * learned from the writer's own run and planned again from). Any other value the writer's body computes is a
 * placeholder until the writer's own run is read (`enclosed-values.ts`), so none is given here.
 */
export function enclosingWriteValue(
  callees: readonly HopCallee[], writerFrame: number, nodeId: string,
): Uint8Array | undefined {
  const writer = callees[writerFrame]!;
  const owner = writer.recordOwner === undefined ? writer : callees[writer.recordOwner]!;
  const categoryId = bytesToHex(owner.category);
  return (writer.entryWrites?.writtenNodes ?? [])
    .find((node) => sharedNodeId(categoryId, node.collection, node.slot) === nodeId)?.value;
}

/**
 * The refusal of a touch inside a writer whose value the touch cannot be given before the writer settles: one the
 * plan does not state, and neither the writer's own pin nor its close of the node exposes.
 */
export function enclosedValueRefusal(
  inner: string, reads: boolean, collection: string, outer: string,
): PerCallProxyDeployError {
  return new PerCallProxyDeployError(
    `the hop's reach "${inner}" ${reads ? 'reads' : 'rewrites'} a node of collection "${collection}" that "${outer}", `
    + 'a frame it runs inside, writes before the call that leads to it, and that write\'s value is the body\'s to '
    + `compute: the ${reads ? 'read' : 'rewrite'} is judged before the writer settles, so it would read the plan's `
    + 'placeholder',
  );
}

/**
 * Whether a pair of touches, one frame of which enters the other, chains as a re-entered read or rewrite of the outer
 * frame's write; refused by name when it is that touch but the writer's value cannot be given to it.
 */
export function chainsEnclosedTouch(
  callees: readonly HopCallee[], outer: EnclosedTouch, inner: EnclosedTouch, collection: string, nodeId: string,
): boolean {
  if (!followsEnclosingWrite(callees, outer, inner, collection)) return false;
  if (enclosingWriteValue(callees, outer.frame, nodeId) !== undefined) return true;
  // A value the body computes is exposed by the writer's own run: the hop learns it before the touch is judged, from
  // the writer's chunk pin or its close of the node, and refuses the touch by name there when neither exposes it
  // (`enclosed-values.ts`). A collection whose values do not chunk has every written view learned from the close.
  if (!outer.chunkable || callees[outer.frame]!.entryWrites?.awaitsValue === true) return true;
  throw enclosedValueRefusal(inner.functionName, inner.kind === 'read', collection, outer.functionName);
}
