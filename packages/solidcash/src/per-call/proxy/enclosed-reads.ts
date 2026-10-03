/**
 * A mapping node a frame writes before the call that leads to a frame of its contract reading it back (spec 20, V6).
 *
 * A frame that records a decision in its own mapping and then calls out to a frame which reads that record back
 * through the first contract's getter touches one node from two frames, one of which runs inside the other: a
 * re-entered read of a node an outer frame wrote. The chain walk restates every declaration in execution order, each
 * segment of a frame with the callee of its call between it and the next (`chainSharedNodeViews`), so the read keeps
 * the view the writer's segment left, and the frames the writer runs before that call settle first (`reentry.ts`).
 * The read is judged before the writer settles, so the pair chains when the value the writer leaves is one the read
 * can be given then (`enclosingWriteValue`): today a value the plan states, as it does for a field the write sets
 * beside the fields it keeps. A write whose value the body computes is refused by its own name, and any other pair of
 * touches one frame of which enters the other is still refused as before.
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
 * True when `outer` updates a node of `collection` that `inner`, a frame it encloses, only reads, and every write of
 * that collection the outer's entry publishes lands in a segment that closes no later than the call through which
 * it enters `inner`: the read keeps the view the outer's write left, which the chain walk states.
 */
function readsAfterEnclosingWrite(
  callees: readonly HopCallee[], outer: EnclosedTouch, inner: EnclosedTouch, collection: string,
): boolean {
  if (outer.kind !== 'update' || inner.kind !== 'read') return false;
  if (!enclosesFrame(callees, outer.frame, inner.frame)) return false;
  const writer = callees[outer.frame]!;
  const through = callToward(callees, outer.frame, inner.frame);
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
 * The value the enclosing writer leaves node `nodeId` at, as the read it encloses sees it, or undefined when the
 * read cannot be given one before the writer settles.
 *
 * The read is judged first, against the view the writer's declaration states, so the value has to be known before
 * the writer runs: a value the plan states is (a chunking collection's write the planner resolves). A value the
 * writer's body computes is a placeholder until the writer's own close is learned, so none is given here.
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
 * Whether a pair of touches, one frame of which enters the other, chains as a re-entered read of the outer frame's
 * write; refused by name when it is that read but the writer's value cannot be given to it.
 */
export function chainsEnclosedRead(
  callees: readonly HopCallee[], outer: EnclosedTouch, inner: EnclosedTouch, collection: string, nodeId: string,
): boolean {
  if (!readsAfterEnclosingWrite(callees, outer, inner, collection)) return false;
  if (enclosingWriteValue(callees, outer.frame, nodeId) !== undefined) return true;
  throw new PerCallProxyDeployError(
    `the hop's reach "${inner.functionName}" reads a node of collection "${collection}" that "${outer.functionName}", `
    + 'a frame it runs inside, writes before the call that leads to it, and that write\'s value is the body\'s to '
    + 'compute: the read is judged before the writer settles, so it would read the plan\'s placeholder',
  );
}
