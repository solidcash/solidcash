/**
 * The mapping plan.
 *
 * A mapping is a sorted list of node UTXOs. A node's commitment is its slot, its successor's slot and the value it
 * carries, and its slot is the key's (or composite keys') hash. An execution that writes a key therefore touches
 * whole node records rather than one value in place: an update rewrites one node's value, an insert splices a new
 * node between the predecessor and the successor the predecessor pointed at, and a delete relinks the predecessor
 * around the removed node.
 *
 * This module derives, for one write against the state the transaction spends, the node commitments the execution
 * must write, and then lays those nodes out as the record entries each segment must declare. It computes hashes and
 * node commitments only through the shipped encoders (`keyToSlotMulti`, `encodeEntryCommitment`, `bytesToSlotValue`
 * from `stateful/SortedList`, and `INDEX_NONE`); the one thing it takes from the caller is how a value is encoded,
 * because that depends on the collection's declared value type.
 */

import { INDEX_NONE, bytesEqual, bytesToHex, type RecordEntry } from '@solidcash/utils';
import {
  bytesToSlotValue,
  decodeEntryCommitment,
  encodeEntryCommitment,
  keyToSlotMulti,
} from '../../stateful/SortedList.js';
import { mappingIndexUnavailable, mappingPredecessorMissing } from './refusals.js';

/** A node's commitment is a 32-byte slot followed by a 32-byte successor link, then the value tail. */
const NODE_HEADER_BYTES = 64;

/** One node of a mapping's sorted list, as the inventory holds it. */
export interface MappingNode {
  readonly slot: Uint8Array;
  readonly nextKey: Uint8Array;
  readonly value: Uint8Array;
  /** The commitment the inventory holds for this node, so a relink reuses those exact bytes. */
  readonly commitment: Uint8Array;
}

/** One node an execution must write, with the commitment before and after the write. */
export interface MappingWrittenNode {
  readonly slot: Uint8Array;
  /** Whether the inventory held this node, so the execution spends it rather than creating it. */
  readonly existed: boolean;
  /** The commitment the inventory holds, or the empty create sentinel when the node is new. */
  readonly before: Uint8Array;
  /** The commitment the node carries after the write. */
  readonly after: Uint8Array;
}

/** The outcome of planning one write: the nodes it produces and the ones it consumes. */
export interface MappingWritePlan {
  /** The slot the write targets: `keyToSlotMulti` of the write's key(s). */
  readonly slot: Uint8Array;
  /** Whether the inventory already held a node for the target slot. */
  readonly existed: boolean;
  /** Whether the write removes the target node rather than storing a value. */
  readonly removed: boolean;
  /** The target node as the inventory holds it, present for an update or a delete. */
  readonly target?: MappingNode;
  /** The bracketing predecessor the write splices through, present for an insert or a delete. */
  readonly predecessor?: MappingNode;
  /** The nodes the execution must write, in write order, each with the commitment it must carry. */
  readonly written: readonly MappingWrittenNode[];
}

/** One write the execution performs: a value to store under the key(s), or `undefined` to remove the key. */
export interface MappingWriteRequest<V> {
  /** The collection's key(s): one entry for a flat mapping, several for a nested `m[a][b]`. */
  readonly keys: readonly Uint8Array[];
  /** The value to store, or `undefined` to remove the key. */
  readonly value: V | undefined;
  /** The current node inventory: every node commitment the caller reads from the state UTXOs. */
  readonly inventory: readonly Uint8Array[];
  /** The caller's encoding of a value into the node's value tail, which depends on the declared value type. */
  readonly encodeValue: (value: V) => Uint8Array;
}

/** Decodes an inventory into nodes, rejecting a commitment that cannot hold a slot and a successor. */
function readInventory(inventory: readonly Uint8Array[]): MappingNode[] {
  return inventory.map((commitment) => {
    if (commitment.length < NODE_HEADER_BYTES) {
      throw new Error(
        `composer mapping plan: a node commitment of ${commitment.length} bytes cannot hold a slot and a successor`,
      );
    }
    return { commitment, ...decodeEntryCommitment(commitment) };
  });
}

/** The node the inventory holds for a slot, by byte equality of the slots. */
function findNode(nodes: readonly MappingNode[], slot: Uint8Array): MappingNode | undefined {
  return nodes.find((node) => bytesEqual(node.slot, slot));
}

/** The node with the greatest slot strictly below the target, refusing when the inventory holds none. */
function requirePredecessor(nodes: readonly MappingNode[], slot: Uint8Array): MappingNode {
  const target = bytesToSlotValue(slot);
  let best: MappingNode | undefined;
  for (const node of nodes) {
    const value = bytesToSlotValue(node.slot);
    if (value < target && (best === undefined || value > bytesToSlotValue(best.slot))) best = node;
  }
  if (best === undefined) throw mappingPredecessorMissing(slot);
  return best;
}

/** Relinks a node to a new successor, keeping its value, so the commitment the chain carries updates. */
function relink(node: MappingNode, nextKey: Uint8Array): Uint8Array {
  return encodeEntryCommitment(node.slot, nextKey, node.value);
}

/**
 * Plans one write against the inventory and the caller's value encoding.
 *
 * An update rewrites the target's value and keeps its successor link. An insert relinks the predecessor to the new
 * slot and creates the new node ahead of the predecessor's old successor. A delete relinks the predecessor around
 * the target. A write of `undefined` to a key the inventory does not hold changes nothing and writes no node.
 */
export function planMappingWrite<V>(request: MappingWriteRequest<V>): MappingWritePlan {
  const slot = keyToSlotMulti([...request.keys]);
  const nodes = readInventory(request.inventory);
  const target = findNode(nodes, slot);

  if (request.value === undefined) {
    if (target === undefined) {
      return { slot, existed: false, removed: false, written: [] };
    }
    const predecessor = requirePredecessor(nodes, slot);
    const relinked: MappingWrittenNode = {
      slot: predecessor.slot,
      existed: true,
      before: predecessor.commitment,
      after: relink(predecessor, target.nextKey),
    };
    return { slot, existed: true, removed: true, target, predecessor, written: [relinked] };
  }

  const value = request.encodeValue(request.value);
  if (target !== undefined) {
    const written: MappingWrittenNode = {
      slot,
      existed: true,
      before: target.commitment,
      after: encodeEntryCommitment(target.slot, target.nextKey, value),
    };
    return { slot, existed: true, removed: false, target, written: [written] };
  }

  const predecessor = requirePredecessor(nodes, slot);
  const written: MappingWrittenNode[] = [
    { slot: predecessor.slot, existed: true, before: predecessor.commitment, after: relink(predecessor, slot) },
    {
      slot,
      existed: false,
      before: new Uint8Array(0),
      after: encodeEntryCommitment(slot, predecessor.nextKey, value),
    },
  ];
  return { slot, existed: false, removed: false, predecessor, written };
}

/** Where a node sits in the transaction the plan describes. */
export interface MappingNodePlacement {
  /** The input the node is spent at, when the execution spends it. */
  readonly in?: number;
  /** The output the node is recreated at; a recreating node defaults to the input it is spent at. */
  readonly out?: number;
}

/** The coordinates of the nodes a plan touches, looked up by slot. */
export interface MappingNodePlacements {
  placementOf(slot: Uint8Array): MappingNodePlacement | undefined;
}

/** A record no input holds is declared with an empty commitment before it, the create sentinel. */
const CREATE_VIEW_IN = new Uint8Array(0);

/** The real input a spent node is declared at, refusing a slot the layout gives no input. */
function requireSpentInput(placements: MappingNodePlacements, slot: Uint8Array): number {
  const placed = placements.placementOf(slot);
  if (placed?.in === undefined || placed.in === INDEX_NONE) throw mappingIndexUnavailable(slot, 'input');
  return placed.in;
}

/** The real output a written or created node is declared at, refusing a slot the layout gives no output. */
function requireWrittenOutput(placements: MappingNodePlacements, slot: Uint8Array, fallback: number): number {
  const placed = placements.placementOf(slot);
  const out = placed?.out ?? fallback;
  if (out === INDEX_NONE || !Number.isInteger(out) || out < 0) throw mappingIndexUnavailable(slot, 'output');
  return out;
}

/**
 * The record entries one plan contributes: every node it writes, then the target it removes.
 *
 * A node the segment spends names its input index and the output it recreates it at. A node it creates names only
 * its output, and the slots the earlier segments created are recorded so a later segment that rewrites one
 * carries on from the view the one before it left with no input to read it at. A node neither spent nor created
 * earlier has no coordinate to declare it with, which is refused by name.
 */
function entriesFor(plan: MappingWritePlan, placements: MappingNodePlacements, created: Set<string>): RecordEntry[] {
  const entries: RecordEntry[] = [];
  for (const node of plan.written) {
    const key = bytesToHex(node.slot);
    if (node.existed) {
      const placed = placements.placementOf(node.slot);
      if (placed?.in !== undefined && placed.in !== INDEX_NONE) {
        entries.push({
          in: placed.in,
          out: requireWrittenOutput(placements, node.slot, placed.in),
          viewIn: node.before,
          viewOut: node.after,
        });
      } else if (created.has(key)) {
        // An earlier segment created this node, so the transaction writes it rather than spends it: the
        // declaration continues the created chain from the view that segment left.
        entries.push({
          in: INDEX_NONE,
          out: requireWrittenOutput(placements, node.slot, INDEX_NONE),
          viewIn: node.before,
          viewOut: node.after,
        });
      } else {
        throw mappingIndexUnavailable(node.slot, 'input');
      }
    } else {
      entries.push({
        in: INDEX_NONE,
        out: requireWrittenOutput(placements, node.slot, INDEX_NONE),
        viewIn: CREATE_VIEW_IN,
        viewOut: node.after,
      });
      created.add(key);
    }
  }
  if (plan.removed && plan.target !== undefined) {
    const index = requireSpentInput(placements, plan.target.slot);
    entries.push({ in: index, out: INDEX_NONE, viewIn: plan.target.commitment, viewOut: CREATE_VIEW_IN });
  }
  return entries;
}

/**
 * Lays out the plans as the record entries each segment must declare, in the order the segments run.
 *
 * A segment's entries are its plans' written nodes in the order they were written, plus a removed target's
 * declaration. A node the execution spends names its input index and the output it recreates it at; a node it
 * creates names only its output, and later segments that rewrite it name that output and carry on from the view
 * the segment before left; a node it removes names only its input.
 */
export function layOutMappingWrites(
  segments: readonly (readonly MappingWritePlan[])[],
  placements: MappingNodePlacements,
): readonly (readonly RecordEntry[])[] {
  const created = new Set<string>();
  return segments.map((writes) => writes.flatMap((plan) => entriesFor(plan, placements, created)));
}
