/**
 * The mapping plan.
 *
 * A mapping is a sorted list of node UTXOs. A node's commitment is its slot, its successor's slot and the value it
 * carries, and its slot is the key's (or composite keys') hash. An execution that writes a key therefore touches
 * whole node records rather than one value in place: an update rewrites one node's value, an insert splices a new
 * node between the predecessor and the successor the predecessor pointed at, and a delete either relinks the
 * predecessor around the removed node or, as a per-call body compiles it, rewrites the node's value to the type's
 * default (`planMappingDelete`).
 *
 * This module derives, for one write against the state the transaction spends, the node commitments the execution
 * must write, and then lays those nodes out as the record entries each segment must declare. The writes one body
 * makes to one collection are planned together (`planMappingBatch`), as its sorted batch proves them. It computes
 * hashes and node commitments only through the shipped encoders (`keyToSlotMulti`, `encodeEntryCommitment`,
 * `bytesToSlotValue` from `stateful/SortedList`, and `INDEX_NONE`); the one thing it takes from the caller is how a
 * value is encoded, because that depends on the collection's declared value type.
 */

import { hexToBin } from '@bitauth/libauth';
import {
  INDEX_NONE,
  VALUE_INLINE_LIMIT,
  buildValueChunkCommitment,
  buildValueChunkCovenantScript,
  bytesEqual,
  bytesToHex,
  computeCollectionHash,
  sha256,
  splitValueIntoValueChunks,
  valueChunkSignature,
  type RecordEntry,
} from '@solidcash/utils';
import { scriptToLockingBytecode } from '../../utils.js';
import {
  bytesToSlotValue,
  decodeEntryCommitment,
  encodeEntryCommitment,
  keyToSlotMulti,
} from '../../stateful/SortedList.js';
import {
  mappingBatchRepeatsSlot,
  mappingBatchWritesCreatedNode,
  mappingChunkOutputUnavailable,
  mappingIndexUnavailable,
  mappingPredecessorMissing,
} from './refusals.js';

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

/** One delete the execution performs: the target key(s), whose node keeps its place and takes a default value. */
export interface MappingDeleteRequest {
  /** The collection's key(s): one entry for a flat mapping, several for a nested `m[a][b]`. */
  readonly keys: readonly Uint8Array[];
  /** The current node inventory: every node commitment the caller reads from the state UTXOs. */
  readonly inventory: readonly Uint8Array[];
  /**
   * The value type's default, encoded as the node's value tail.
   *
   * A sorted mapping's `delete m[k]` compiles to an upsert of the default (`visitMappingDelete` routes it through
   * the sorted-value upsert), so the body rewrites the node where it stands rather than unlinking it. The caller
   * supplies the encoding because the default depends on the collection's declared value type: an empty value's
   * tail for `string`, the minimal zero for an int, and so on.
   */
  readonly encodeDefault: () => Uint8Array;
}

/**
 * Plans a delete as the body performs it: the target rewritten in place with the value type's default.
 *
 * This is the delete-side counterpart of `planMappingWrite`. A write of `undefined` removes a key by relinking the
 * predecessor around it — the list removal the direct convention performs — while a per-call body never unlinks a
 * node, so the plan that agrees with the emitted bytes is an in-place write of the default tail. An absent key is
 * an insert of the default node, exactly as the upsert's absent branch does. The returned plan's `removed` is
 * therefore always false: the node stays.
 */
export function planMappingDelete(request: MappingDeleteRequest): MappingWritePlan {
  return planMappingWrite({
    keys: request.keys,
    value: request.encodeDefault(),
    inventory: request.inventory,
    encodeValue: (encoded: Uint8Array) => encoded,
  });
}

/** Where a node sits in the transaction the plan describes. */
export interface MappingNodePlacement {
  /** The input the node is spent at, when the execution spends it. */
  readonly in?: number;
  /** The output the node is recreated at; a recreating node defaults to the input it is spent at. */
  readonly out?: number;
}

/** The coordinates of the nodes a plan touches, looked up by slot, and of the value chunks a batch creates. */
export interface MappingNodePlacements {
  placementOf(slot: Uint8Array): MappingNodePlacement | undefined;
  /** The output a long value's chunk is created at, by its node's slot and its index. */
  chunkOutputOf?(slot: Uint8Array, index: number): number | undefined;
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
 * earlier has no coordinate to declare it with, and a node written again in the segment that created it belongs to
 * a sorted batch (`planMappingBatch`); both are refused by name.
 */
function entriesFor(
  plan: MappingWritePlan, placements: MappingNodePlacements, created: Set<string>, createdHere: Set<string>,
): RecordEntry[] {
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
        if (createdHere.has(key)) throw mappingBatchWritesCreatedNode(node.slot);
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
      createdHere.add(key);
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
  return segments.map((writes) => {
    const createdHere = new Set<string>();
    return writes.flatMap((plan) => entriesFor(plan, placements, created, createdHere));
  });
}

/** One write of a sorted batch: the key(s), and the value the body stores under them. */
export interface MappingBatchWrite<V> {
  readonly keys: readonly Uint8Array[];
  readonly value: V;
}

/** The writes one body makes to one collection, which its sorted batch verifies as one transition. */
export interface MappingBatchRequest<V> {
  /** The writes in the body's target order, the order its segment declares their record groups in. */
  readonly writes: readonly MappingBatchWrite<V>[];
  /** Every node commitment the caller reads from the collection's state UTXOs, the head included. */
  readonly inventory: readonly Uint8Array[];
  readonly encodeValue: (value: V) => Uint8Array;
  /**
   * A value's raw bytes, for a collection whose values chunk (`string`, `bytes` and other variable-width values):
   * a value over 60 bytes keeps its root in the node and its bytes past the node's head in value chunks.
   */
  readonly chunkable?: (value: V) => Uint8Array;
}

/** One value chunk a long value takes: its node's slot, the value's root, its index and its commitment. */
export interface MappingValueChunk {
  readonly slot: Uint8Array;
  readonly root: Uint8Array;
  readonly index: number;
  readonly commitment: Uint8Array;
}

/** One record a batch group declares: the node, the view it continues from and the view it leaves. */
export interface MappingBatchRecord {
  readonly slot: Uint8Array;
  /** Whether the inventory held the node, so the transaction spends it rather than creating it. */
  readonly existed: boolean;
  readonly viewIn: Uint8Array;
  readonly viewOut: Uint8Array;
}

/** A target's record group: the target alone for an update; its predecessor, then the new node, for an insert. */
export interface MappingBatchGroup {
  readonly slot: Uint8Array;
  readonly existed: boolean;
  readonly records: readonly MappingBatchRecord[];
}

/** A sorted batch as its segment declares it, and the nodes its transaction writes. */
export interface MappingBatchPlan {
  readonly groups: readonly MappingBatchGroup[];
  /** Every node the batch writes, once each, in first-declared order. */
  readonly written: readonly MappingWrittenNode[];
  /** The value chunks the batch's long values take, in target order and, inside a value, by index. */
  readonly chunks: readonly MappingValueChunk[];
}

/**
 * Plans the writes of one sorted batch as the body's batch verification proves them.
 *
 * Every predecessor is decided against the list the batch started from, so inserts that fall in one gap share its
 * predecessor, which links to the lowest of them, and the new nodes form one ascending chain ending at the gap's old
 * successor. An updated target keeps its link unless it is also such a predecessor. Each node is written once, in
 * its final form: a node's first declaration continues from the commitment the inventory holds, and a later group
 * that declares it again continues from, and leaves, that final form.
 */
export function planMappingBatch<V>(request: MappingBatchRequest<V>): MappingBatchPlan {
  const nodes = readInventory(request.inventory);
  const targets = request.writes.map((write) => ({
    slot: keyToSlotMulti([...write.keys]),
    value: request.encodeValue(write.value),
  }));
  const seen = new Set<string>();
  for (const target of targets) {
    const key = bytesToHex(target.slot);
    if (seen.has(key)) throw mappingBatchRepeatsSlot(target.slot);
    seen.add(key);
  }

  // Each insert's predecessor in the original list, and the inserts every predecessor takes, lowest first.
  const predecessorOf = new Map<string, MappingNode>();
  const insertsAfter = new Map<string, Uint8Array[]>();
  for (const target of targets) {
    if (findNode(nodes, target.slot) !== undefined) continue;
    const predecessor = requirePredecessor(nodes, target.slot);
    predecessorOf.set(bytesToHex(target.slot), predecessor);
    const key = bytesToHex(predecessor.slot);
    insertsAfter.set(key, [...(insertsAfter.get(key) ?? []), target.slot]);
  }
  const nextOf = new Map<string, Uint8Array>();
  for (const [key, slots] of insertsAfter) {
    const predecessor = nodes.find((node) => bytesToHex(node.slot) === key)!;
    const chain = [...slots].sort((a, b) => (bytesToSlotValue(a) < bytesToSlotValue(b) ? -1 : 1));
    nextOf.set(key, chain[0]!);
    chain.forEach((slot, index) => nextOf.set(bytesToHex(slot), chain[index + 1] ?? predecessor.nextKey));
  }
  const valueOf = new Map(targets.map((target) => [bytesToHex(target.slot), target.value]));
  const finalOf = (slot: Uint8Array, held: MappingNode | undefined): Uint8Array => {
    const key = bytesToHex(slot);
    return encodeEntryCommitment(slot, nextOf.get(key) ?? held!.nextKey, valueOf.get(key) ?? held!.value);
  };

  const written: MappingWrittenNode[] = [];
  const declared = new Set<string>();
  const declare = (slot: Uint8Array, held: MappingNode | undefined): MappingBatchRecord => {
    const key = bytesToHex(slot);
    const after = finalOf(slot, held);
    const first = !declared.has(key);
    if (first) {
      declared.add(key);
      written.push({ slot, existed: held !== undefined, before: held?.commitment ?? CREATE_VIEW_IN, after });
    }
    const viewIn = held === undefined ? CREATE_VIEW_IN : first ? held.commitment : after;
    return { slot, existed: held !== undefined, viewIn, viewOut: after };
  };
  const groups = targets.map((target): MappingBatchGroup => {
    const held = findNode(nodes, target.slot);
    if (held !== undefined) {
      return { slot: target.slot, existed: true, records: [declare(target.slot, held)] };
    }
    const predecessor = predecessorOf.get(bytesToHex(target.slot))!;
    return {
      slot: target.slot,
      existed: false,
      records: [declare(predecessor.slot, predecessor), declare(target.slot, undefined)],
    };
  });
  const chunks = request.chunkable === undefined ? [] : request.writes.flatMap((write, position) => {
    const raw = request.chunkable!(write.value);
    if (raw.length <= VALUE_INLINE_LIMIT) return [];
    const root = sha256(raw);
    return splitValueIntoValueChunks(raw).map((data, index): MappingValueChunk => ({
      slot: targets[position]!.slot, root, index, commitment: hexToBin(buildValueChunkCommitment(index, data)),
    }));
  });
  return { groups, written, chunks };
}

/**
 * Lays a sorted batch out as the record entries its segment declares, group by group.
 *
 * A node the transaction spends names its input and the output it is recreated at; a node the batch creates names
 * only its output. The value chunks follow the groups, each created at the output the layout gives it. A spent node
 * with no input, and a chunk with no output, are refused by name.
 */
export function layOutMappingBatch(plan: MappingBatchPlan, placements: MappingNodePlacements): RecordEntry[] {
  return [
    ...plan.groups.flatMap((group) => group.records.map((record) => layOutNodeRecord(record, placements))),
    ...layOutValueChunks(plan, placements),
  ];
}

/**
 * Lays a plan's records in the order the body's own run-time loop mints them, one declaration per node.
 *
 * A loop writes each node it touches once, in the order its turns mint them — the target of an update, or a
 * predecessor and the node it inserts — chaining inserts in one gap by re-pointing the node it created the turn
 * before. That is the plan's `written` list, which is exactly what its segment declares; a verified batch declares
 * a record per target group instead, its predecessor standing again for every insert in its gap.
 */
export function layOutMappingWritten(plan: MappingBatchPlan, placements: MappingNodePlacements): RecordEntry[] {
  // A node's pre-state is what the first group that declares it continues from: a node the hop creates in its own
  // transaction from a predecessor no input carries — the empty list's head — keeps that predecessor as its view,
  // which is the pre-state the body's own read of it is proved against.
  const viewInOf = new Map<string, Uint8Array>();
  for (const group of plan.groups) {
    for (const record of group.records) {
      const key = bytesToHex(record.slot);
      if (!viewInOf.has(key)) viewInOf.set(key, record.viewIn);
    }
  }
  return [
    ...plan.written.map((node) => layOutNodeRecord({
      slot: node.slot,
      existed: node.existed,
      viewIn: viewInOf.get(bytesToHex(node.slot)) ?? node.before,
      viewOut: node.after,
    }, placements)),
    ...layOutValueChunks(plan, placements),
  ];
}

/** One node's record: a spent node names its input and the output it is recreated at, a created one its output. */
function layOutNodeRecord(record: MappingBatchRecord, placements: MappingNodePlacements): RecordEntry {
  if (!record.existed) {
    return {
      in: INDEX_NONE,
      out: requireWrittenOutput(placements, record.slot, INDEX_NONE),
      viewIn: record.viewIn,
      viewOut: record.viewOut,
    };
  }
  const input = requireSpentInput(placements, record.slot);
  return {
    in: input,
    out: requireWrittenOutput(placements, record.slot, input),
    viewIn: record.viewIn,
    viewOut: record.viewOut,
  };
}

/** The long values' chunk records, each created at the output the layout gives it. */
function layOutValueChunks(plan: MappingBatchPlan, placements: MappingNodePlacements): RecordEntry[] {
  return plan.chunks.map((chunk): RecordEntry => {
    const out = placements.chunkOutputOf?.(chunk.slot, chunk.index);
    if (out === undefined || out === INDEX_NONE || !Number.isInteger(out) || out < 0) {
      throw mappingChunkOutputUnavailable(chunk.slot, chunk.index);
    }
    return { in: INDEX_NONE, out, viewIn: CREATE_VIEW_IN, viewOut: chunk.commitment };
  });
}

/** The lock a long value's chunks sit at: the collection's value-chunk covenant, salted with the slot and the root. */
export function mappingValueChunkLock(
  category: Uint8Array, collectionName: string, chunk: Pick<MappingValueChunk, 'slot' | 'root'>,
): Uint8Array {
  return scriptToLockingBytecode(buildValueChunkCovenantScript(
    category, computeCollectionHash(valueChunkSignature(collectionName)), chunk.slot, chunk.root,
  ), 'p2sh32');
}
