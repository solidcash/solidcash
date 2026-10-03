/**
 * The records a proxy hop's entry writes beyond the proxy's data-NFT records.
 *
 * A delegate frame runs on the proxy's records, so a body that writes a sorted mapping touches the collection's
 * node UTXOs rather than a data NFT: an update rewrites the node the key names where it stands, and an insert
 * relinks the predecessor and creates the new node, and every one of them must be declared in the frame's segment
 * or the body's group walk reads a record the segment never named. This module plans those records from the
 * entry's own published access, reusing the shipped batch planner and its layout helper.
 *
 * The nodes come from the deployment's own classification: a genesis hop runs before the proxy's genesis, so its
 * collection holds only the empty head sentinel the proxy is about to mint, and a later call reads the nodes the
 * collection has grown. A head is minted only at genesis, so a live collection that holds none is refused by name.
 * A body that reads and writes one key (`require(users[who].publicKey.length == 0)` then `users[who] = ...`)
 * touches the key once, so its batch plans one write and the read is whatever node that write splices through. A
 * key the entry only reads beside its write has no group of its own and is refused by name.
 *
 * A written node's commitment carries the value the body computed. A collection whose values do not chunk states
 * that value from the access the artifact publishes and resolves it against the arguments the hop was given; a
 * value the source does not determine keeps its structural candidate and the derivation learns it from the body's
 * own close. A value source that reads fields back out of the entry's own node is resolved from the live node's
 * decoded value, and a field whose node lives in continuation chunks is refused by name. A collection whose values
 * chunk needs the value's byte length to size its run, so a value the source does not determine is refused by
 * name; a value it does determine also takes the run of chunk records the body pins, laid past the created node at
 * the value's own collection covenant. A body that pushes into such a mapping publishes the element it appends
 * rather than the whole value, so the value the node ends at is the node's live value with that element appended: an
 * element the published recipe does not resolve, and a mutation other than a push, are refused by name.
 *
 * A `delete m[k]` compiles to an in-place write of the value type's default, so that too is one write per target
 * with the target's commitment learned from the body's close.
 *
 * A caller that declares the node of each key the entry only reads, kept and ahead of the batch's groups as a callee
 * frame's read nodes are, names their slots, and a read at one of them is planned beside the batch, not refused.
 *
 * A dynamic-state write is the same shape one level out: the value is not in a node but in a run of chunk records
 * at its own collection covenant, and the hop declares that run exactly as the body addresses it. The run's width
 * has to be stated because a run laid out at another width is not the run the body reads; it is the value the write
 * starts from — the deployment's live chunks for a call, the empty value a genesis minted for a deployment's own
 * first hop — plus the elements the frame appends. The elements are the artifact's stated element where it has one,
 * and otherwise the growth its `dynamicWriteGrowth` fact states; a run that cannot be sized from either is refused
 * by name rather than sized by guessing.
 *
 * A write to several collections is planned as one batch per collection, laid at its own place in the frame's
 * segment and in the created region. A shape this module still has no plan for — several batches beside a dynamic
 * value, several dynamic variables — is refused by the fact that is missing.
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  INDEX_NONE,
  VALUE_HEAD_SIZE,
  VALUE_INLINE_LIMIT,
  buildEntryNftCovenantScript,
  bytesEqual,
  bytesToHex,
  chunkCountForLength,
  computeCollectionHash,
  decodePushdataValue,
  dynamicChunkSignature,
  dynamicLenKey,
  encodeChunkableValueTail,
  encodePushdataValue,
  fixedWidthBytes,
  getDefaultStateValue,
  isFixedWidthType,
  joinChunks,
  joinValueChunks,
  parseArrayTypeString,
  parseChunkCommitment,
  parsePushdataCommitment,
  parseValueChunkCommitment,
  scriptToBytecode,
  sha256,
  type AbiFunction,
  type ArgSource,
  type Artifact,
  type DynamicWriteGrowthAbi,
  type ExternalCallExpression,
  type RecordEntry,
  type StateValue,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../../Argument.js';
import { evaluateExternalExpression } from '../../stateful/sc-evaluate-external-expression.js';
import type { Utxo } from '../../interfaces.js';
import { addressToLockScript, createUnlockingBytecode, scriptToLockingBytecode } from '../../utils.js';
import {
  decodeEntryCommitment, encodeEntryCommitment, headSentinelCommitment, keyToSlotMulti,
} from '../../stateful/SortedList.js';
import { evalComputedKey } from '../../stateful/route-expression-key.js';
import { entryRecordReadUnlock } from '../deploy/records.js';
import type { DraftInput, DraftSourceOutput, DraftToken } from '../composer/draft.js';
import {
  dynamicValueRecords, layOutChunkRun, planChunkRun, type ChunkRunPlan,
} from '../composer/chunk-plan.js';
import {
  layOutMappingBatch, layOutMappingWritten, mappingValueChunkLock, planMappingBatch,
  type MappingBatchPlan, type MappingNodePlacement, type MappingNodePlacements,
} from '../composer/mapping-plan.js';
import {
  loopRecordMints, planCallLoopWrites, publishedLoopTurns, type CallLoopWritePlan, type LoopRecordMint,
} from '../call/entry-records.js';
import { PerCallProxyDeployError } from './errors.js';
import { hopTrace, hopTraceOn } from './hop-trace.js';
import { reachedNodeValue } from './reached-values.js';

/** The participant id a hop's layout holds for a collection's empty head sentinel. */
const MAPPING_HEAD_PREFIX = 'mapping-head-';

/** The participant id a hop's layout holds for a spent node that is not the empty head. */
const MAPPING_NODE_PREFIX = 'mapping-node-';


/** The collection a hop's participant id names when it is the empty head of one; `undefined` for any other id. */
export function mappingHeadCollection(id: string): string | undefined {
  return id.startsWith(MAPPING_HEAD_PREFIX) ? id.slice(MAPPING_HEAD_PREFIX.length) : undefined;
}

/** The slot a spent-node participant id names; `undefined` for an id that names no node. */
export function mappingNodeSlot(id: string): Uint8Array | undefined {
  if (!id.startsWith(MAPPING_NODE_PREFIX)) return undefined;
  const hex = id.slice(MAPPING_NODE_PREFIX.length);
  return hex.length > 0 && hex.length % 2 === 0 && /^[0-9a-f]+$/.test(hex) ? hexToBin(hex) : undefined;
}

/**
 * The participant id a callee contract's mapping node is placed under, whichever reach reads or writes it.
 *
 * The node is keyed by the category its records sit at, its collection and its own slot, so the reaches of one
 * transaction that touch one node name one input and each frame declares the views it sees of it. An id that named
 * the reach's role, or the key a read was resolved from, placed one node once per reach and spent its outpoint twice.
 */
export function sharedNodeId(categoryId: string, collection: string, slot: Uint8Array): string {
  return `${MAPPING_NODE_PREFIX}${categoryId}-${collection}-${bytesToHex(slot)}`;
}

/** One key an entry's own write targets, with the node an insert splices through. */
export interface ReachWriteTarget {
  readonly collection: string;
  /** The slot the write's key(s) hash to. */
  readonly slot: Uint8Array;
  /**
   * The slot of the node an insert splices through, present only when the list did not hold the target.
   *
   * A later reach that inserts into the same gap is planned against the link this one left, so it relinks the node
   * again or splices through the node this one created.
   */
  readonly predecessor?: Uint8Array;
  /**
   * True when this target's node is one an earlier reach of the same hop created, and this write continues it.
   *
   * An insert creates a node the transaction spends no input for, so a later reach that writes the same key
   * rewrites that node at the output the creating reach made rather than inserting it again: the record carries
   * no input index, and the two reaches' declarations chain through the one output.
   */
  readonly continued?: boolean;
}

/** One collection an entry's own write touches, as a cross-reach planner reads it. */
export interface ReachWrite {
  readonly collection: string;
  /**
   * True when the collection's value is dynamic, so its frames write versions of one value rather than one node.
   *
   * A dynamic value's node carries a length and a root, and each frame that writes it mints the chunks of its own
   * version and states the view it continues from, so two reaches that append to one key chain through the same
   * node instead of colliding over one output. A fixed-width value's node is instead recreated by each reach's own
   * batch, and one transaction cannot carry two recreations of one output.
   */
  readonly chunkable: boolean;
  /** Every key the entry writes to this collection, in the batch's target order. */
  readonly targets: readonly ReachWriteTarget[];
  /** The participant id of every node this collection's write spends. */
  readonly spentIds: readonly string[];
  /**
   * True when this write continues a node an earlier reach of the same hop created, rather than starting from the
   * deployment: the hop planned it against the view that reach left, so the two reaches' declarations chain.
   */
  readonly continued?: boolean;
}

/** One sorted batch an entry performs against the collection it starts from. */
interface HopMappingBatch {
  readonly collection: string;
  readonly signature: string;
  readonly plan: MappingBatchPlan;
  /**
   * True when the writes are the turns of a run-time loop the entry's own source runs.
   *
   * The loop's body mints one node per turn and chains the inserts of one gap by re-pointing the node it created
   * the turn before, so each node is declared once, in mint order: the plan's `written` list. A verified batch
   * instead declares a record per target group, a target's predecessor standing again for every insert in its gap.
   */
  readonly loopWritten?: boolean;
  /** For loops whose turns the artifact publishes, the loops of the run and the turn that mints each record. */
  readonly loopRun?: readonly CallLoopWritePlan[];
  readonly loopMints?: readonly LoopRecordMint[];
  /**
   * The nodes the batch spends, in write order, each with the commitment its input holds and the id the hop's block
   * holds it under.
   */
  readonly spent: readonly { readonly slot: Uint8Array; readonly before: Uint8Array; readonly id: string }[];
  /** Every key the batch writes, with the node an insert splices through. */
  readonly targets: readonly ReachWriteTarget[];
  /**
   * True when the batch writes over a node an earlier reach of the same hop created, and was planned against the
   * view that reach left: the two reaches' declarations of the one output chain rather than collide.
   */
  readonly continued?: boolean;
  /** The slot of each value-dependent node, in learning order, whose end view the body computes. */
  readonly learningSlots: readonly Uint8Array[];
  /** True when a chunkable write's value is the body's to compute, so its run's width is not yet stated. */
  readonly unstatedValue?: boolean;
  /** The placeholder each value-dependent node's declaration starts from, in learning order. */
  readonly learningCandidates: readonly Uint8Array[];
  /** The whole value each written node carries, by slot, for a collection whose values chunk. */
  readonly rawValues: ReadonlyMap<string, Uint8Array>;
  /** The live UTXO of each spent node, keyed by slot, where the deployment reads one. */
  readonly utxoBySlot: ReadonlyMap<string, Utxo>;
  /**
   * The long value each value-witness slot reads, keyed by the entry access's slot index.
   *
   * A body that reads a value its node's tail cannot hold takes the value itself from its frame's block, so the
   * hop hands it to the plan the same way the deployment's classification hands a node over.
   */
  readonly valueWitnesses: ReadonlyMap<number, Uint8Array>;
}

/** Everything the entry's own writes are planned from. */
export interface HopEntryWritesRequest {
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly args?: readonly FunctionArgument[];
  /** The frame's caller lock, which a `msg.sender` key resolves to. */
  readonly callerLockingBytecode: Uint8Array;
  /**
   * The deployment the hop runs against, when it is a call rather than a deployment's own first hop.
   *
   * A genesis hop runs before the proxy's genesis, so its collections hold only the empty head sentinel the proxy
   * is about to mint and its dynamic values are the empty ones; a later call reads the records, nodes and chunks
   * the deployment has grown, which is what lets it plan a write that starts from a live value. Absent means the
   * deployment path, whose writes start from the empty state.
   */
  readonly liveDeployment?: HopLiveDeployment;
  /**
   * The commitment the plan currently states for each record, in data-NFT order.
   *
   * A body that appends a default element and fills its fields in place publishes no element when a field's value
   * is one the artifact's vocabulary cannot state — a machine fact such as the block time. The record that carries
   * the value's byte length is still written by the body and closed against the declaration the plan states, so its
   * commitment here names the run's width: the value's length implies its chunks. Absent leaves that write refused,
   * which is the deployment path's shape.
   */
  readonly writtenCommitments?: readonly Uint8Array[];
  /**
   * The whole value an unstated chunkable write stores, learned from the body's own close.
   *
   * A collection whose values chunk needs the value's byte length to size its run, and a value the artifact's
   * source does not determine is refused by name on the first plan. The body still computes that value and its
   * digest, and both sit on the machine's stack at the close that stops the write, so the caller re-plans the write
   * from the value the close exposed. Absent leaves the write's run at one record and the value learned.
   */
  readonly learnedValue?: Uint8Array;
  /**
   * The entry-access slots of the keys the entry only reads whose nodes the caller declares, kept and ahead of the
   * batch's groups, as a callee frame's read nodes are. A read at one of them is the caller's; absent, a read beside
   * the batch is refused.
   */
  readonly declaredReadSlots?: readonly number[];
  /**
   * The id each node the batch spends is placed under, by its collection and its own slot. A callee frame names its
   * contract's nodes so every reach that touches one shares it (`sharedNodeId`); absent names a node by its slot, or
   * its collection's empty head by the collection.
   */
  readonly nodeIdOf?: (collection: string, slot: Uint8Array) => string;
  /**
   * The elements each of the entry's own dynamic writes appends, which a key the write then reads counts from.
   *
   * A body that appends to a dynamic value and keys a write by the written length (`m[this.items.length - 1]`) reads
   * the value it wrote. `hopEntryWrites` states those counts from the artifact's own append facts, so a caller
   * states them only when it knows something the artifact does not.
   */
  readonly stateLengthDeltas?: Readonly<Record<string, bigint>>;
}

/** The live deployment a call's hop reads its writes against, from the deployment's own classification. */
export interface HopLiveDeployment {
  /** The deployed category, which a record's covenant and a value chunk's lock are derived from. */
  readonly category: Uint8Array;
  /** The data-NFT records' commitments, in data-NFT order; a dynamic value's live length is read from its own. */
  readonly recordCommitments: readonly Uint8Array[];
  /** Every chunk UTXO the deployment holds: a dynamic value's chunks and a mapping value's chunks. */
  readonly chunks: readonly Utxo[];
  /** Each sorted collection's own node UTXOs, keyed by collection name. */
  readonly nodesByCollection: ReadonlyMap<string, readonly Utxo[]>;
  /**
   * The nodes an earlier frame of this hop created in the transaction being planned, by collection and slot.
   *
   * The deployment does not hold a node another frame of the same hop created, and no input carries it: a write
   * over one continues the view that frame left, and the record the frame declares names that frame's output
   * rather than an input, so the two declarations chain through the one output the transaction carries.
   */
  readonly continuedNodes?: readonly {
    readonly collection: string;
    readonly slot: Uint8Array;
    readonly commitment: Uint8Array;
    /**
     * The whole value that frame left the node with, for a collection whose values chunk.
     *
     * A chunking value's bytes live past the node's head in chunk records the creating frame's own outputs carry,
     * so they are not in the deployment: a reach that appends to the value continues from these bytes.
     */
    readonly value?: Uint8Array;
  }[];
  /**
   * The nodes an earlier frame of this hop rewrote in place, by collection and slot.
   *
   * The deployment holds the pre-write node and an input still spends it, so the transaction carries the pre-write
   * commitment and the view a later frame's declaration starts from is the one the chain walk carries to it
   * (`chainSharedNodeViews`). What this states is the bytes that frame left: a chunking value's are not the ones the
   * input holds, and the run of chunk records a later write takes is sized from them.
   */
  readonly rewrittenNodes?: readonly {
    readonly collection: string;
    readonly slot: Uint8Array;
    readonly commitment: Uint8Array;
    readonly value?: Uint8Array;
  }[];
  /**
   * The successor each node holds once the frames of this hop placed before this one wrote it, by collection and
   * slot.
   *
   * An insert relinks its predecessor, so a later insert into the same list is planned against the links the
   * earlier ones left: its predecessor is the closest node below its key there, and the node it creates links to
   * that predecessor's successor there. Only the links are restated: the input still spends the deployment's node,
   * and a value an earlier frame's body computed is the chain walk's to carry (`chainSharedNodeViews`).
   */
  readonly reachedLinks?: readonly {
    readonly collection: string;
    readonly slot: Uint8Array;
    readonly next: Uint8Array;
  }[];
  /**
   * The deployment's own state, decoded through the layout the frame's declaration names.
   *
   * A key the artifact publishes as a state read — `state:<name>`, or an array's length — is the value the frame
   * itself reads, so it is resolved against the deployment's records exactly as the entry's own read of them.
   */
  readonly state?: Readonly<Record<string, StateValue>>;
}

/** The coordinates a hop's entry writes need to be placed: the layout, the created region and the writer. */
export interface HopEntryWritesContext {
  /** The input index of a participant id the layout placed. */
  indexOf(id: string): number;
  readonly proxyMasterIndex: number;
  /** The first trailing output index past the events, where a created node sits. */
  readonly createdBase: number;
  /**
   * The output a continued node was created at by the frame before this one, by slot.
   *
   * A node this transaction spends no input for has only that output to name it by, so a frame that writes one
   * declares it there and continues the view the creating frame left.
   */
  readonly continuedOutputOf?: (slot: Uint8Array) => number | undefined;
  readonly recordAmount: bigint;
  readonly category: Uint8Array;
  /** The end commitment learned for each value-dependent node, in `learningCandidates` order. */
  readonly learnedViews: readonly (Uint8Array | undefined)[];
  /**
   * The lock a chunk is paid to when a write leaves its dynamic value narrower than the run the deployment holds.
   *
   * The chunks past the written value's width are consumed with no successor record, so their satoshis leave the
   * run; absent, such a write is refused by name.
   */
  readonly releasedLock?: Uint8Array;
}

/** The records an entry's own writes contribute to a hop plan. */
export interface LaidHopEntryWrites {
  readonly entries: readonly RecordEntry[];
  readonly inputs: Readonly<Record<string, DraftInput>>;
  readonly trailingOutputs: readonly DraftSourceOutput[];
  readonly createdOutputs: readonly number[];
  /**
   * The nodes this frame created, with the output each sits at, by slot.
   *
   * A frame placed after this one writes a node this frame created by naming that output: it spends no input for
   * it, so the output is the only coordinate it can carry the declaration at.
   */
  readonly createdNodes: readonly { readonly slot: Uint8Array; readonly out: number }[];
  /**
   * The records that only relink a node: a predecessor an insert splices through that the batch does not write.
   *
   * The node keeps its slot and its value and takes a new successor, so its end view is the view the chain carries
   * to it with the successor the plan states, which `chainSharedNodeViews` restates once the views before it are
   * known: an earlier frame may have rewritten the value with one only that frame's close states.
   */
  readonly relinked?: readonly RecordEntry[];
  /**
   * The nodes whose end view this frame's own settlement stated, by slot.
   *
   * A frame's write whose value its body computes closes against the view the plan stated there, and the settle
   * hands the value the body computed back; a frame that leaves such a node alone never closes it, so it never
   * appears here. The two are otherwise indistinguishable in a plan - both state the same starting view - so this
   * is what tells a frame that rewrote a node from one that only held it.
   */
  readonly learnedSlots: readonly Uint8Array[];
  /** The long value each value-witness slot reads, in slot order, where the body reads one from its frame. */
  readonly values?: readonly Uint8Array[];
}

/** The writes one entry performs, with the ids the plan places. */
export interface HopEntryWrites {
  /**
   * The first sorted collection the entry batches into, when it writes one.
   *
   * A dynamic value's chunks have no head (the empty value is no chunk at all), so a write that only appends to one
   * names no collection here.
   */
  readonly collection?: string;
  /** The first collection's canonical signature, which derives the entry covenant lock its records sit at. */
  readonly signature?: string;
  /** The participant ids the proxy's block holds for the nodes the entry spends; a created run has none. */
  readonly participantIds: readonly string[];
  /**
   * The participant ids, also in `participantIds`, of the chunks of a dynamic value the entry only reads.
   *
   * They are kept unchanged, so no write fact places them: each segment declares them where the body reads them.
   */
  readonly readRunIds?: readonly string[];
  /**
   * Every collection the entry writes, with the keys it writes and the nodes it spends.
   *
   * A hop that reaches one contract several times plans each reach on its own, so this is what a cross-reach pass
   * reads to tell two reaches that write one collection apart.
   */
  readonly reachWrites: readonly ReachWrite[];
  /** The placeholder each value-dependent record's declaration starts from, in learning order. */
  readonly learningCandidates: readonly Uint8Array[];
  /**
   * The slot order the learned views are indexed by, one per `learningCandidates` entry.
   *
   * A settle learns an end commitment for each value-dependent node in the order the frame's records declare them,
   * so a caller holding those views can find the one belonging to a node it has by that node's slot.
   */
  readonly learningSlotOrder: readonly Uint8Array[];
  /**
   * Every node this entry's writes produce, with the view the write leaves it at.
   *
   * A frame that runs later in the same hop plans against the deployment, which does not hold what this entry wrote:
   * these are what it continues a write over the same node from, and what it names a node this entry created by.
   */
  readonly writtenNodes: readonly {
    readonly collection: string;
    readonly slot: Uint8Array;
    readonly commitment: Uint8Array;
    readonly existed: boolean;
    /** The whole value the write left a chunking node with, which a later reach's append continues from. */
    readonly value?: Uint8Array;
  }[];
  /**
   * The live UTXO each participant the entry spends sits on, keyed by its id.
   *
   * A node's id names its own slot or its collection's empty head, which the deployment's classification already
   * places; a dynamic value's chunk carries no such name, so its outpoint is handed back here rather than searched
   * for again when the hop is rebuilt for the broadcast.
   */
  readonly spentUtxos: ReadonlyMap<string, Utxo>;
  /**
   * The dynamic run whose width the record's own declaration fixed, and that width, when the element was unstated.
   *
   * It is what a refusal names: a run laid at a width the body's own pin does not close at is a run whose record
   * declared a length the body did not write.
   */
  readonly sizedRun?: { readonly variable: string; readonly chunks: number; readonly from: 'record' | 'growth' };
  /**
   * True when a chunkable write's value is the body's to compute, so its run's width is unknown until learned.
   *
   * The body's own value pin stops on the chunk count it computed, and the value and digest it holds sit on the
   * stack there, so the caller learns the value from that close and re-plans this write from it.
   */
  readonly awaitsValue?: boolean;
  /** For loops whose turns the artifact publishes, the loops of the run and the turn that mints each record. */
  readonly loopRun?: readonly CallLoopWritePlan[];
  readonly loopMints?: readonly LoopRecordMint[];
  lay(context: HopEntryWritesContext): LaidHopEntryWrites;
}

/** The entry's visible inputs, which a key or value label can be resolved against. */
function visibleInputs(fn: AbiFunction): AbiFunction['inputs'] {
  return fn.inputs.filter((input) => !input.name.startsWith('__internal__'));
}

/** The encoded argument one visible parameter carries, by its declared name. */
function encodedArgument(
  fn: AbiFunction,
  args: readonly FunctionArgument[],
  name: string,
  structs: Artifact['structs'],
): Uint8Array | undefined {
  const visible = visibleInputs(fn);
  const index = visible.findIndex((input) => input.name === name);
  if (index < 0 || index >= args.length) return undefined;
  const encoded = encodeFunctionArgument(args[index], visible[index]!.type, structs);
  return encoded instanceof Uint8Array ? encoded : undefined;
}

/** The labels that name the frame's own caller, which a struct field may read as its address. */
const CALLER_VALUE_LABELS = new Set([
  'nullop:msg.sender', 'sender:msg.sender', 'call:_msgSender()', 'nullop:tx.origin',
]);

/** True when a value field's declared type holds an integer, so a literal is its numeric value. */
function isIntegerField(type: string): boolean {
  return type === 'bigint' || type === 'int' || type === 'uint' || /^u?int\d+$/.test(type);
}

/** The field values a struct instantiation's source reads from. */
interface ValueResolutionContext {
  readonly fn: AbiFunction;
  readonly args: readonly FunctionArgument[];
  readonly structs: Artifact['structs'];
  readonly callerLockingBytecode: Uint8Array;
  /** The sorted collections the artifact publishes, which a `map:` read names. */
  readonly collections?: readonly ArtifactCollection[];
  /** The live deployment, which a field the source reads back out of the entry's own node comes from. */
  readonly liveDeployment?: HopLiveDeployment;
}

/** A supplied argument, coerced to the raw form the field's declared type encodes. */
function coerceFieldValue(argument: FunctionArgument, fieldType: string): unknown {
  if (argument instanceof Uint8Array) return argument;
  if (typeof argument === 'bigint' || typeof argument === 'boolean') return argument;
  if (typeof argument === 'number') return BigInt(argument);
  if (typeof argument !== 'string') return undefined;
  if (fieldType === 'string') return argument;
  if (fieldType.startsWith('address')) {
    return argument.includes(':') ? addressToLockScript(argument) : hexToBin(argument.replace(/^0x/, ''));
  }
  if (/^bytes/.test(fieldType)) return hexToBin(argument.replace(/^0x/, ''));
  if (isIntegerField(fieldType)) return BigInt(argument.replace(/_/g, ''));
  return undefined;
}

/**
 * A supplied argument, in the raw form the type the entry declares for it encodes.
 *
 * The hop's call data carries each argument as the caller supplied it — an ethers `bytesN` is a `0x`-prefixed hex
 * string and an address is often a cashaddr — while a value the frame stores is the pushdata encoding of the
 * field's own bytes. Every argument a source forwards is therefore read through its declared type, arrays element
 * by element, exactly as the whole-value path reads a parameter.
 */
function declaredArgumentValue(
  value: FunctionArgument | undefined,
  declaredType: string | undefined,
): FunctionArgument | undefined {
  if (value === undefined || declaredType === undefined) return value;
  if (Array.isArray(value)) {
    const element = parseArrayTypeString(declaredType)?.elementType;
    if (element === undefined) return value;
    return value.map((item) => declaredArgumentValue(item as FunctionArgument, element) ?? item) as FunctionArgument;
  }
  if (typeof value !== 'string') return value;
  return (coerceFieldValue(value, declaredType) as FunctionArgument | undefined) ?? value;
}

/** One literal label's value, in the raw form the field's declared type encodes. */
function literalFieldValue(text: string, fieldType: string): unknown {
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?[0-9][0-9_]*$/.test(text)) return BigInt(text.replace(/_/g, ''));
  if (/^0x[0-9a-f]*$/i.test(text)) return hexToBin(text.slice(2));
  return fieldType === 'string' ? text : undefined;
}

/** Splits a struct instantiation's argument list at the top level, leaving nested parentheses intact. */
function splitTopLevel(text: string): string[] {
  if (text.length === 0) return [];
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '(' || character === '[' || character === '{') depth += 1;
    else if (character === ')' || character === ']' || character === '}') depth -= 1;
    else if (character === ',' && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

/** One field of a struct instantiation source, resolved from the arguments it reads. */
function fieldValue(label: string, fieldType: string, context: ValueResolutionContext): unknown {
  if (CALLER_VALUE_LABELS.has(label)) return context.callerLockingBytecode;
  const bound = label.match(/^id:(.+)$/);
  if (bound !== null) {
    const visible = visibleInputs(context.fn);
    const index = visible.findIndex((input) => input.name === bound[1]);
    if (index < 0 || index >= context.args.length) return undefined;
    // The argument is read through the type the entry declares for it, arrays element by element: a field the source
    // forwards from an array parameter carries its elements' own form, which the field's type alone cannot give.
    const declaredType = visible[index]!.type;
    if (declaredType !== undefined) return declaredArgumentValue(context.args[index]!, declaredType);
    return coerceFieldValue(context.args[index]!, fieldType);
  }
  const literal = label.match(/^lit:(.+)$/);
  if (literal !== null) return literalFieldValue(literal[1]!, fieldType);
  // A field the write reads back out of the entry's own node: the compiler publishes `field:<name>(map:<c>(<key>))`
  // for a field the body leaves as it was, and the value is what the node the key names holds, or the type's
  // default when the list holds no such node.
  const read = label.match(/^field:([^()]+)\(map:([^()]+)\((.*)\)\)$/s);
  if (read !== null) return nodeFieldValue(read[1]!, read[2]!, read[3]!, fieldType, context);
  const binop = label.match(/^binop:([^()]+)\((.*)\)$/s);
  if (binop !== null) {
    const operands = splitTopLevel(binop[2]!);
    if (operands.length !== 2) return undefined;
    const left = numericFieldValue(operands[0]!, context);
    const right = numericFieldValue(operands[1]!, context);
    if (typeof left !== 'bigint' || typeof right !== 'bigint') return undefined;
    if (binop[1] === '+') return left + right;
    if (binop[1] === '-') return left - right;
    if (binop[1] === '*') return left * right;
    return undefined;
  }
  const cast = label.match(/^cast:[a-z0-9]+\((.*)\)$/is);
  if (cast !== null) return fieldValue(cast[1]!, fieldType, context);
  // A composite expression the shipped evaluator resolves, for a field that spells bytes: its grammar covers the
  // calls, casts and conditionals the artifact publishes, and its result is the field's raw bytes.
  return /^bytes/.test(fieldType) || fieldType.startsWith('address') || fieldType === 'string'
    ? evalComputedKey(label, [...context.args], visibleInputs(context.fn), undefined, undefined)
    : undefined;
}

/** A field label read as a number, for the arithmetic a struct source states over its own fields. */
function numericFieldValue(label: string, context: ValueResolutionContext): bigint | undefined {
  const value = fieldValue(label, 'bigint', context);
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'boolean') return value ? 1n : 0n;
  return undefined;
}

/** The key an expression inside a struct source names, or `undefined` when its arguments do not determine one. */
function nodeKey(label: string, context: ValueResolutionContext): Uint8Array | undefined {
  if (CALLER_VALUE_LABELS.has(label)) return context.callerLockingBytecode;
  const evaluated = evalComputedKey(label, [...context.args], visibleInputs(context.fn), undefined, undefined);
  if (evaluated !== undefined) return evaluated;
  const byName = label.match(/^id:(.+)$/);
  if (byName !== null) {
    const encoded = encodedArgument(context.fn, context.args, byName[1]!, context.structs);
    if (encoded !== undefined) return encoded;
  }
  return undefined;
}

/** One collection as the artifact's state layout publishes it. */
export type ArtifactCollection = NonNullable<NonNullable<Artifact['stateLayout']>['collections']>[number];

/** The lock a value's continuation chunks sit at: the collection's own value-chunk covenant, salted with the node. */
function valueChunkLock(
  category: Uint8Array,
  collection: string,
  slot: Uint8Array,
  root: Uint8Array,
): Uint8Array {
  return mappingValueChunkLock(category, collection, { slot, root });
}

/**
 * The whole value a collection node holds, inline or across its continuation chunks.
 *
 * A chunkable value's tail is a four-byte length followed, while the value fits, by the value itself. A longer
 * value keeps a digest and its first bytes in the tail and the rest in chunks at the value's own covenant, salted
 * with the collection, the node's slot and that digest, which is what tells one node's chunks from another's. The
 * length is the authority: the chunks are joined and the result truncated to it, so a set that does not account
 * for the whole value is refused rather than read short.
 */
export function joinedNodeValue(
  collection: ArtifactCollection,
  commitment: Uint8Array,
  deployment: HopLiveDeployment,
): Uint8Array | undefined {
  const { slot, value: tail } = decodeEntryCommitment(commitment);
  if (collection.chunkableValue !== true) return tail;
  if (tail.length < 4) return undefined;
  const length = new DataView(tail.buffer, tail.byteOffset, 4).getUint32(0, true);
  if (tail.length === 4 + length && length <= VALUE_INLINE_LIMIT) return tail.slice(4);
  if (tail.length < 4 + 32 + VALUE_HEAD_SIZE) return undefined;
  const root = tail.slice(4, 4 + 32);
  const head = tail.slice(4 + 32, 4 + 32 + VALUE_HEAD_SIZE);
  const lock = bytesToHex(valueChunkLock(deployment.category, collection.name, slot, root));
  const chunks = deployment.chunks
    .filter((utxo) => {
      const nft = utxo.token?.nft;
      return nft?.commitment !== undefined && utxo.lockingBytecode !== undefined
        && bytesToHex(utxo.lockingBytecode) === lock;
    })
    .map((utxo) => parseValueChunkCommitment(utxo.token!.nft!.commitment!))
    .sort((left, right) => left.chunkIndex - right.chunkIndex);
  if (chunks.length === 0) return undefined;
  try {
    return joinValueChunks(head, chunks, length);
  } catch {
    return undefined;
  }
}

/**
 * True when `value` is one whole value of the collection's own type, in the form its node and chunks hold it.
 *
 * A `string` or unbounded `bytes` value is held as its own bytes, so any bytes are one; every other value is held as
 * its type's pushdata encoding, so it is one only when that encoding reads back over all of it.
 */
export function isWholeNodeValue(
  collection: Pick<ArtifactCollection, 'valueType'>,
  value: Uint8Array,
  structs: Artifact['structs'],
): boolean {
  if (collection.valueType === 'string' || collection.valueType === 'bytes') return true;
  try {
    return decodePushdataValue(value, 0, collection.valueType, structs).bytesConsumed === value.length;
  } catch {
    return false;
  }
}

/** The live node a collection holds for a slot, as the deployment's own classification reports it. */
function liveNode(
  collection: ArtifactCollection,
  slot: Uint8Array,
  deployment: HopLiveDeployment,
): Utxo | undefined {
  const slotHex = bytesToHex(slot);
  return (deployment.nodesByCollection.get(collection.name) ?? []).find((candidate) => {
    const commitment = candidate.token?.nft?.commitment;
    return commitment !== undefined && bytesToHex(decodeEntryCommitment(hexToBin(commitment)).slot) === slotHex;
  });
}

/**
 * One field of the node a key names, decoded out of the node's own value.
 *
 * The compiler publishes `field:<name>(map:<collection>(<key>))` for a field the body leaves as it was, so the
 * field's value is whatever the collection's node for that key holds. The node is the deployment's own
 * classification, and its value is decoded through the shipped entry-commitment and pushdata decoders, joined
 * across its continuation chunks when the value does not fit the tail. A key the list does not hold is the type's
 * default, which is what the body's own read of an absent key yields, so that is stated rather than refused. A
 * node whose value cannot be reassembled from the hop's own inputs is refused by name rather than assumed.
 */
function nodeFieldValue(
  fieldName: string,
  collectionName: string,
  keyLabel: string,
  fieldType: string,
  context: ValueResolutionContext,
): unknown {
  const collection = context.collections?.find((candidate) => candidate.name === collectionName);
  if (collection === undefined) {
    throw new PerCallProxyDeployError(
      `the implementation's "${context.fn.name}" entry reads field "${fieldName}" of mapping `
      + `"${collectionName}", which the artifact does not publish as a collection`,
    );
  }
  const key = nodeKey(keyLabel, context);
  if (key === undefined) {
    throw new PerCallProxyDeployError(
      `the implementation's "${context.fn.name}" entry reads field "${fieldName}" of mapping `
      + `"${collectionName}" at a key this hop cannot resolve (${keyLabel})`,
    );
  }
  const deployment = context.liveDeployment;
  if (deployment === undefined) return getDefaultStateValue(fieldType, context.structs);
  // A node an earlier reach of this hop wrote is read as that reach left it, and one whose bytes that reach did not
  // state leaves the field unstated (`reached-values.ts`).
  const reached = reachedNodeValue(deployment, collectionName, keyToSlotMulti([key]));
  if (reached !== undefined) {
    return reached.value === undefined ? undefined : decodedField(reached.value, collection, fieldName, context);
  }
  const node = liveNode(collection, keyToSlotMulti([key]), deployment);
  if (node === undefined) return getDefaultStateValue(fieldType, context.structs);
  const commitment = node.token?.nft?.commitment;
  if (commitment === undefined) return undefined;
  const raw = joinedNodeValue(collection, new Uint8Array(hexToBin(commitment)), deployment);
  if (raw === undefined) {
    throw new PerCallProxyDeployError(
      `the implementation's "${context.fn.name}" entry reads field "${fieldName}" of the node mapping `
      + `"${collectionName}" holds for this key, whose value this hop cannot reassemble from the deployment's `
      + 'chunks',
    );
  }
  return decodedField(raw, collection, fieldName, context);
}

/** One field of a node's whole value, decoded at the collection's own value type. */
function decodedField(
  raw: Uint8Array, collection: ArtifactCollection, fieldName: string, context: ValueResolutionContext,
): unknown {
  const decoded = decodePushdataValue(raw, 0, collection.valueType, context.structs).value;
  return decoded !== null && typeof decoded === 'object' && !(decoded instanceof Uint8Array)
    ? (decoded as Record<string, unknown>)[fieldName]
    : undefined;
}

/** The struct one `call:<Name>(...)` source instantiates, when the artifact declares that struct. */
function structNameOf(source: string, structs: Artifact['structs']): string | undefined {
  const match = source.match(/^call:([A-Za-z_$][\w$]*)\((.*)\)$/s);
  if (match === null || structs === undefined) return undefined;
  return structs.some((struct) => struct.name === match[1]) ? match[1] : undefined;
}

/** The stored value a struct instantiation source states, or `undefined` when a field it reads is undetermined. */
function structValue(
  source: string,
  structName: string,
  context: ValueResolutionContext,
): Uint8Array | undefined {
  const definition = (context.structs ?? []).find((struct) => struct.name === structName);
  if (definition === undefined) return undefined;
  const inner = source.match(/^call:[A-Za-z_$][\w$]*\((.*)\)$/s)![1]!;
  const labels = splitTopLevel(inner);
  if (labels.length !== definition.fields.length) return undefined;
  const tuple: StateValue[] = [];
  for (let index = 0; index < definition.fields.length; index += 1) {
    const value = fieldValue(labels[index]!, definition.fields[index]!.type, context);
    if (value === undefined) return undefined;
    tuple.push(value as StateValue);
  }
  return encodePushdataValue(tuple, structName, context.structs);
}

/**
 * The raw value the entry's write stores, resolved from the artifact's published source or its direct parameter.
 *
 * A whole-value literal or parameter is the shipped evaluator's, and a struct instantiation over the entry's own
 * arguments is encoded in declaration order through the same pushdata encoder the covenant's value-copy decode
 * reads back. A source that reads prior state, or one whose operands the arguments do not determine, leaves the
 * value unstated and the caller refuses by name rather than guessing.
 */
function resolveWriteValue(
  context: ValueResolutionContext,
  access: NonNullable<AbiFunction['entryAccesses']>[number],
): Uint8Array | undefined {
  if (access.valueParam !== undefined) {
    const byParam = encodedArgument(context.fn, context.args, access.valueParam, context.structs);
    if (byParam !== undefined) return byParam;
  }
  const source = access.valueSource;
  if (source === undefined) return undefined;
  const structName = structNameOf(source, context.structs);
  if (structName !== undefined) return structValue(source, structName, context);
  return evalComputedKey(source, [...context.args], visibleInputs(context.fn), undefined, undefined);
}

/**
 * The writes one entry performs to one sorted collection, in the batch's target order.
 *
 * The batch names its targets by physical entry slot, so each write's key sources are read from the access the same
 * batch lists at that slot.
 */
function orderedAccesses(
  fn: AbiFunction,
  accesses: NonNullable<AbiFunction['entryAccesses']>,
  batch: NonNullable<AbiFunction['sortedBatchInfo']>[number],
): NonNullable<AbiFunction['entryAccesses']> {
  return batch.slotIndices.map((slotIndex) => {
    const access = accesses.find((candidate) => (candidate.slotIndex ?? -1) === slotIndex);
    if (access === undefined) {
      throw new PerCallProxyDeployError(
        `the implementation's "${fn.name}" entry's sorted batch names slot ${slotIndex}, which its entry accesses `
        + 'do not describe',
      );
    }
    return access;
  });
}

/**
 * Plans the writes an entry performs, one sorted batch per collection it writes.
 *
 * A body that writes one collection performs one batch; a body that writes two — an imported token's `transferFrom`,
 * which rewrites the allowance and both balances — performs one batch per collection, and the frame has to declare
 * every node of both or its group walk reads a record its segment never named. The batches are planned in the order
 * the artifact publishes them, which is the order the body's own verification walks them in.
 */
function planHopMappingBatches(request: HopEntryWritesRequest): readonly HopMappingBatch[] {
  const fn = request.artifact.abi.find((candidate) => candidate.name === request.functionName);
  if (fn === undefined) return [];
  const accesses = fn.entryAccesses ?? [];
  const batches = fn.sortedBatchInfo ?? [];
  if (accesses.length === 0 && batches.length === 0) return [];
  // A body that only reads a sorted collection is left to the plan's other records; this module plans writes.
  const writesSomething = batches.length > 0
    || accesses.some((access) => access.operations.some((operation) => operation !== 'read'));
  if (!writesSomething) return [];
  if (batches.length === 0) {
    // A write the body performs in a run-time loop over its own call's array is published as an access with no
    // batch: the loop's turns are the frame's own arguments, so it is planned the way the call path plans it, from
    // the artifact's own statement of the shape. An array the hop's arguments do not carry is left to the refusal
    // below, which names the batch this module plans rather than guessing at the loop.
    const loop = planHopLoopBatch(request, fn, accesses);
    if (loop !== undefined) return [loop];
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry writes ${accesses.length} mapping entry(ies) across `
      + '0 sorted batch(es), and this hop plans one batch to one collection',
    );
  }
  // A key the entry only reads beside the batches it writes has no group of its own: every access that is not one of
  // the batches' targets is a read this hop does not declare, unless the caller declares that read's node itself.
  const batched = new Set(batches.flatMap((batch) => batch.slotIndices));
  const declared = new Set(request.declaredReadSlots ?? []);
  const declaredRead = (access: NonNullable<AbiFunction['entryAccesses']>[number]): boolean =>
    access.slotIndex !== undefined && declared.has(access.slotIndex)
    && access.operations.every((operation) => operation === 'read');
  const read = accesses.find((access) =>
    (access.slotIndex === undefined || !batched.has(access.slotIndex)) && !declaredRead(access));
  if (read !== undefined) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry reads mapping "${read.collection}" beside the batch it `
      + 'writes, which this hop does not declare',
    );
  }
  return batches.map((batch) => planHopMappingBatch(request, fn, accesses, batch));
}

/** Plans the writes of one sorted batch, in `batch`'s target order. */
function planHopMappingBatch(
  request: HopEntryWritesRequest,
  fn: AbiFunction,
  accesses: NonNullable<AbiFunction['entryAccesses']>,
  batch: NonNullable<AbiFunction['sortedBatchInfo']>[number],
): HopMappingBatch {
  const collection = requireHopCollection(request, batch.collection);
  const ordered = orderedAccesses(fn, accesses, batch);
  return planHopCollectionBatch(request, fn, collection, ordered.map((access) => ({
    access,
    keys: access.keyParams.map((_param, index) => resolveHopKey(request, fn, access, index)),
  })));
}

/** The collection the artifact publishes under a name, or a refusal naming the entry that writes it. */
function requireHopCollection(request: HopEntryWritesRequest, name: string): ArtifactCollection {
  const collection = request.artifact.stateLayout?.collections?.find((candidate) => candidate.name === name);
  if (collection === undefined || collection.sorted !== true) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry writes mapping "${name}", which the artifact does not `
      + 'publish as a sorted collection',
    );
  }
  return collection;
}

/** Resolves one access's key(s) from the frame's own arguments, its sender, or a compile-time expression. */
function resolveHopKey(
  request: HopEntryWritesRequest,
  fn: AbiFunction,
  access: NonNullable<AbiFunction['entryAccesses']>[number],
  index: number,
): Uint8Array {
  const args = [...(request.args ?? [])];
  const visible = visibleInputs(fn);
  const structs = request.artifact.structs ?? request.artifact.stateLayout?.structs;
  const source = access.keySources?.[index];
  if (source?.kind === 'msgSender') return request.callerLockingBytecode;
  const label = source?.expressionLabel ?? source?.paramName ?? access.keyParams[index];
  // A key that names the frame's own caller is that caller's lock, whichever way the artifact serialized it: an
  // imported interface publishes `msg.sender` as an expression label rather than as the `msgSender` kind.
  if (label !== undefined && CALLER_VALUE_LABELS.has(label)) return request.callerLockingBytecode;
  const evaluated = evalComputedKey(
    label, args, visible, request.liveDeployment?.state, request.stateLengthDeltas,
  );
  if (evaluated !== undefined) return evaluated;
  const byName = encodedArgument(fn, args, label ?? '', structs);
  if (byName !== undefined) return byName;
  throw new PerCallProxyDeployError(
    `the implementation's "${request.functionName}" entry writes mapping "${access.collection}" at a key this `
    + `hop cannot resolve from its call data (${label ?? '<unnamed>'})`,
  );
}

/** One target of a collection's write: the access it came from, and the key(s) it writes under. */
interface HopTargetWrite {
  readonly access: NonNullable<AbiFunction['entryAccesses']>[number];
  readonly keys: readonly Uint8Array[];
  /** The value the artifact states for a loop turn; absent for a batch, whose value the body computes. */
  readonly value?: Uint8Array;
}

/**
 * Plans the turns of the run-time loop the entry's own source writes a collection in, when that is its write.
 *
 * The turns and their keys are the call path's own planning (`planCallLoopWrites`): the artifact states the array
 * the loop walks, and each turn's key is the published label with the loop's counter replaced by the turn's index.
 * An array the hop's own arguments do not carry leaves this `undefined`, and the caller refuses by name.
 */
function planHopLoopBatch(
  request: HopEntryWritesRequest,
  fn: AbiFunction,
  accesses: NonNullable<AbiFunction['entryAccesses']>,
): HopMappingBatch | undefined {
  const written = accesses.find((access) => access.operations.some((operation) => operation !== 'read'));
  if (written === undefined) return undefined;
  let loops: readonly CallLoopWritePlan[] | undefined;
  try {
    loops = planCallLoopWrites({
      artifact: request.artifact,
      functionName: request.functionName,
      args: request.args ?? [],
      callerLockingBytecode: request.callerLockingBytecode,
      ...(request.liveDeployment?.state === undefined ? {} : { state: request.liveDeployment.state }),
      ...(request.stateLengthDeltas === undefined ? {} : { stateLengthDeltas: request.stateLengthDeltas }),
    });
  } catch {
    // The call path refuses the shape by its own name; the hop's own refusal below names what this module plans.
    return undefined;
  }
  const loop = (loops ?? []).find((candidate) => candidate.collection === written.collection);
  if (loop === undefined) return undefined;
  // Loops whose turns the artifact publishes write one run of records, every loop of the collection in turn.
  const turned = publishedLoopTurns(request.artifact, request.functionName)
    .some((turns) => turns.collection === loop.collection);
  const run = turned ? (loops ?? []).filter((candidate) => candidate.collection === loop.collection) : [loop];
  const collection = requireHopCollection(request, loop.collection);
  // A chunkable value's node tail states the value's byte length, so the run of chunk records its write takes has
  // to be sized from the value itself. A loop stores its value per turn, which the hop does not compute.
  if (collection.chunkableValue === true) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry writes mapping "${collection.name}" in a run-time loop `
      + 'over its own call data, whose values chunk, so the run of chunk records the write takes cannot be sized '
      + 'from the call',
    );
  }
  const batch = planHopCollectionBatch(request, fn, collection, run.flatMap((each) => each.turns.map((turn) => ({
    access: written,
    keys: turn.keys,
    value: loopStoredValue(each),
  }))), loop);
  return turned
    ? { ...batch, loopRun: run, loopMints: loopRecordMints(request.functionName, run, batch.plan.written) }
    : batch;
}

/**
 * The value a run-time loop's turns store, when the artifact publishes it as one literal.
 *
 * The plan's commitments are its structure, so a value the source states is stated exactly as the body computes it;
 * a value the body derives per turn is left to the one-byte placeholder that fixes only the plan's shape.
 */
function loopStoredValue(loop: CallLoopWritePlan): Uint8Array {
  if (loop.valueBool !== undefined) return loop.valueBool ? Uint8Array.from([1]) : new Uint8Array(0);
  if (loop.valueConst !== undefined) {
    return encodeFunctionArgument(BigInt(loop.valueConst), 'bigint') as Uint8Array;
  }
  return new Uint8Array(1);
}

/** Plans the writes of one collection, one target per write, whether the body batches them or loops over them. */
function planHopCollectionBatch(
  request: HopEntryWritesRequest,
  fn: AbiFunction,
  collection: ArtifactCollection,
  targets: readonly HopTargetWrite[],
  loop?: CallLoopWritePlan,
): HopMappingBatch {
  const visible = visibleInputs(fn);
  const args = [...(request.args ?? [])];
  const structs = request.artifact.structs ?? request.artifact.stateLayout?.structs;
  const keyTypes = collection.keyTypes ?? [collection.keyType];
  const chunkable = collection.chunkableValue === true;
  const resolution: ValueResolutionContext = {
    fn, args, structs, callerLockingBytecode: request.callerLockingBytecode,
    ...(request.artifact.stateLayout?.collections === undefined
      ? {} : { collections: request.artifact.stateLayout.collections }),
    ...(request.liveDeployment === undefined ? {} : { liveDeployment: request.liveDeployment }),
  };

  let unstatedValue = false;
  const writes = targets.map(({ access, keys, value }) => {
    if (keyTypes.length !== access.keyParams.length) {
      throw new PerCallProxyDeployError(
        `the implementation's "${request.functionName}" entry writes mapping "${access.collection}" with `
        + `${access.keyParams.length} key(s), which the collection's ${keyTypes.length} key type(s) do not cover`,
      );
    }
    // A loop's value is stated where the artifact publishes it, and is otherwise the body's to compute: one byte
    // fixes only the plan's structure. A loop over a chunkable collection is refused above, where the run of chunk
    // records its write takes can no longer be sized.
    if (loop !== undefined) return { keys: [...keys], value: value ?? new Uint8Array(1), stated: true };
    const written = access.operations.filter((operation) => operation !== 'read');
    const isDelete = written.length === 1 && written[0] === 'delete';
    if (written.length !== 1 || (written[0] !== 'write' && !isDelete)) {
      throw new PerCallProxyDeployError(
        `the implementation's "${request.functionName}" entry touches mapping "${access.collection}" as `
        + `${access.operations.join('/')}, and this hop plans one write per target`,
      );
    }
    // A per-call body compiles `delete m[k]` as an upsert of the value type's default, so the node stays in place
    // and takes the default tail. The commitment is the body's to compute and is learned from its close, so only
    // the run the default takes has to be stated: an inline default is the empty value's own tail, which is one
    // record with no chunks.
    if (isDelete) {
      return { keys: [...keys], value: new Uint8Array(0), stated: true };
    }
    // A chunkable collection's node tail states the value's byte length, so its run has to be sized from the value
    // itself. A value the source does determine is stated outright; a value the artifact's source does not
    // determine is the body's to compute, so the first plan lays one record and the value is learned from the close
    // the body's own chunk pin stops at, then the write is re-planned from it. A caller that states no learned value
    // leaves the run unstated, which is what lets the first plan reach that close.
    if (chunkable) {
      // A whole value the artifact states is stated outright; a push that states only its element is joined with
      // the node's live value, because the run of chunk records its length names has to be planned before the body
      // runs. Anything else is the body's value, learned from its close.
      const raw = resolveWriteValue(resolution, access)
        ?? resolveAppendedMappingValue(request, resolution, collection, access, keys);
      if (raw !== undefined) return { keys: [...keys], value: raw, stated: true };
      // Fail closed: bytes the close exposed are only the value when they are one whole value of the collection's own
      // type; anything else is not the value this write computed, and the run stays unstated.
      const learned = request.learnedValue;
      if (learned !== undefined && isWholeNodeValue(collection, learned, structs)) {
        return { keys: [...keys], value: learned, stated: true };
      }
      unstatedValue = true;
      // A placeholder fixes only the plan's structure: it is not the value the node holds, so no later reach of the
      // same node may continue from it, and the caller that consumes this write's facts refuses that shape by name.
      return { keys: [...keys], value: new Uint8Array(1), stated: false };
    }
    // The value is the body's to compute, so a one-byte placeholder fixes only the plan's structure: the slots, the
    // successor links and which targets are inserts. Every commitment that depends on the value is left unstated
    // and learned from the body's own close. Such a value is never a chunking value's, so it is always a placeholder.
    return { keys: [...keys], value: new Uint8Array(1), stated: false };
  });

  // A body that reads a value the node's tail cannot hold takes the value itself from its frame's block, one slot
  // per entry access that reads one. The hop supplies the slot, so the witness is the node's own whole value,
  // joined across its continuation chunks exactly as the field read is.
  const valueWitnesses = new Map<number, Uint8Array>();
  if (chunkable && request.liveDeployment !== undefined) {
    for (const access of targets.map((target) => target.access)
      .filter((access, index, all) => all.indexOf(access) === index)) {
      if (access.slotIndex === undefined || !access.operations.includes('read')) continue;
      const keys = access.keyParams.map((_param, index) => resolveHopKey(request, fn, access, index));
      const slot = keyToSlotMulti([...keys]);
      // A node an earlier frame of this hop created carries its value in the frame's own plan: the deployment holds
      // neither its commitment nor its chunks, so the bytes the read materializes are the ones that frame left.
      const continued = (request.liveDeployment.continuedNodes ?? []).find((node) =>
        node.collection === collection.name && bytesEqual(node.slot, slot));
      if (continued !== undefined) {
        if (continued.value !== undefined) valueWitnesses.set(access.slotIndex, continued.value);
        continue;
      }
      // A node an earlier frame of this hop rewrote is one the deployment holds, but it holds the bytes from before
      // that write: the value the read materializes is the one the earlier frame left.
      const rewritten = (request.liveDeployment.rewrittenNodes ?? []).find((node) =>
        node.collection === collection.name && bytesEqual(node.slot, slot));
      if (rewritten !== undefined) {
        if (rewritten.value !== undefined) valueWitnesses.set(access.slotIndex, rewritten.value);
        continue;
      }
      const node = liveNode(collection, slot, request.liveDeployment);
      const commitment = node?.token?.nft?.commitment;
      if (commitment === undefined) continue;
      const value = joinedNodeValue(collection, new Uint8Array(hexToBin(commitment)), request.liveDeployment);
      if (value === undefined) {
        throw new PerCallProxyDeployError(
          `the implementation's "${request.functionName}" entry reads mapping "${access.collection}" a value this `
          + "hop cannot reassemble from the node the deployment holds, so it cannot witness the body's read",
        );
      }
      valueWitnesses.set(access.slotIndex, value);
    }
  }

  const collectionNodes = request.liveDeployment?.nodesByCollection.get(collection.name) ?? [];
  // A node an earlier frame of this hop created in this transaction: the list holds it, and only the frame that
  // wrote it has an output to name it by, so it is held here rather than spent.
  const continuedBySlot = new Map<string, Uint8Array>();
  for (const node of request.liveDeployment?.continuedNodes ?? []) {
    if (node.collection === collection.name) continuedBySlot.set(bytesToHex(node.slot), node.commitment);
  }
  // The list as the frames placed before this one left it: a node an insert of theirs relinked takes its new
  // successor, so this batch's predecessors and the links it writes are decided against the list it splices into.
  const reachedNext = new Map<string, Uint8Array>();
  for (const link of request.liveDeployment?.reachedLinks ?? []) {
    if (link.collection === collection.name) reachedNext.set(bytesToHex(link.slot), link.next);
  }
  const reached = (commitment: Uint8Array): Uint8Array => {
    const { slot, value } = decodeEntryCommitment(commitment);
    const next = reachedNext.get(bytesToHex(slot));
    return next === undefined ? commitment : encodeEntryCommitment(slot, next, value);
  };
  const inventory: Uint8Array[] = [];
  const utxoBySlot = new Map<string, Utxo>();
  // The commitment each spent node's input holds, which the reached list may have relinked past.
  const spentBySlot = new Map<string, Uint8Array>();
  // The empty list's head sentinel is what a first write splices through. A deployment's own first hop runs before
  // the genesis that mints it, so that hop plans against the sentinel's commitment.
  if (request.liveDeployment === undefined) inventory.push(headSentinelCommitment());
  for (const node of collectionNodes) {
    const commitment = node.token?.nft?.commitment;
    if (commitment === undefined) {
      throw new PerCallProxyDeployError(
        `the deployment holds a node of collection "${collection.name}" with no commitment`,
      );
    }
    const slot = bytesToHex(decodeEntryCommitment(hexToBin(commitment)).slot);
    const bytes = new Uint8Array(hexToBin(commitment));
    inventory.push(reached(bytes));
    utxoBySlot.set(slot, node);
    spentBySlot.set(slot, bytes);
  }
  // A head is minted only at genesis and a call never creates one, so every insert splices through a node the
  // transaction spends. A live collection with no head was deployed without it, and is refused by name.
  const isHead = (commitment: Uint8Array): boolean => {
    const { slot } = decodeEntryCommitment(commitment);
    return slot.length === 32 && slot.every((byte) => byte === 0);
  };
  if (!inventory.some(isHead)) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry writes mapping "${collection.name}", but the `
      + `deployment's collection "${collection.name}" has no head; a head is minted only at genesis, so this `
      + 'deployment was deployed without it',
    );
  }
  for (const commitment of continuedBySlot.values()) inventory.push(reached(commitment));
  const plan = planMappingBatch({
    writes, inventory,
    encodeValue: chunkable ? encodeChunkableValueTail : (encoded: Uint8Array) => encoded,
    ...(chunkable ? { chunkable: (value: Uint8Array) => value } : {}),
    ...(continuedBySlot.size === 0 ? {} : { continuedSlots: new Set(continuedBySlot.keys()) }),
  });
  // A chunking collection's nodes carry the whole value, which a reach that appends to one of them continues from:
  // the raw bytes are the write's own value, since the plan's value here is already that form.
  const rawValues = new Map<string, Uint8Array>();
  if (chunkable) {
    // A write whose value the plan could not state carries a placeholder, which is not the bytes the node holds: a
    // reach placed after this one is refused rather than told to continue from it.
    for (const write of writes) {
      if (!write.stated) continue;
      rawValues.set(bytesToHex(keyToSlotMulti([...write.keys])), write.value);
    }
  }

  // A node the batch creates, and a target it rewrites, carry the value the body computed; a node it only relinks
  // keeps its own value, so its end view is stated by the planner and restated from the chain (`relinked`).
  const writtenSlots = new Set(plan.groups.map((group) => bytesToHex(group.slot)));
  const learningSlots: Uint8Array[] = [];
  const learningCandidates: Uint8Array[] = [];
  const learned = new Set<string>();
  // A loop's segment declares one record per node, in the order its turns mint them; a batch declares a record per
  // target group. Either way the value-dependent nodes are the created ones and the targets, in that declaration
  // order, which is the order the body closes them in and the derivation learns them.
  const declared = loop === undefined
    ? plan.groups.flatMap((group) => group.records)
    : plan.written.map((node) => ({
      slot: node.slot, existed: node.existed, viewIn: node.before, viewOut: node.after,
    }));
  for (const record of declared) {
    const key = bytesToHex(record.slot);
    if (learned.has(key)) continue;
    if (record.existed && !writtenSlots.has(key)) continue;
    learned.add(key);
    learningSlots.push(record.slot);
    learningCandidates.push(record.viewOut);
  }
  // The key each write targets, and the node it splices through when the list did not hold it. The plan's groups
  // are in write order, so each target reads its own group; a group the list did not hold names its predecessor
  // first.
  const writeTargets = plan.groups.map((group): ReachWriteTarget => ({
    collection: collection.name,
    slot: group.slot,
    ...(group.existed
      ? (group.records[0]?.continued === true ? { continued: true } : {})
      : { predecessor: group.records[0]!.slot }),
  }));
  const headCommitment = headSentinelCommitment();
  const spent = plan.written
    .filter((node) => node.existed && !continuedBySlot.has(bytesToHex(node.slot))).map((node) => {
      // The input spends the deployment's node, whatever link the frames before this one left it with.
      const before = spentBySlot.get(bytesToHex(node.slot)) ?? node.before;
      return {
        slot: node.slot,
        before,
        // The empty head sentinel is named by its collection; any other spent node is named by its own slot, unless
        // the caller names the nodes it shares across frames.
        id: request.nodeIdOf?.(collection.name, node.slot) ?? (bytesEqual(before, headCommitment)
          ? `${MAPPING_HEAD_PREFIX}${collection.name}`
          : `${MAPPING_NODE_PREFIX}${bytesToHex(node.slot)}`),
      };
    });
  return {
    collection: collection.name,
    signature: collection.signature,
    plan,
    ...(loop === undefined ? {} : { loopWritten: true }),
    spent,
    targets: writeTargets,
    ...(plan.written.some((node) => node.existed && continuedBySlot.has(bytesToHex(node.slot)))
      ? { continued: true } : {}),
    learningSlots,
    learningCandidates,
    ...(unstatedValue ? { unstatedValue: true } : {}),
    rawValues,
    utxoBySlot,
    valueWitnesses,
  };
}

/** The token a mapping node carries: a mutable NFT of the contract's category. */
function nodeToken(category: Uint8Array, commitment: Uint8Array): DraftToken {
  return { category, amount: 0n, nft: { capability: 'mutable', commitment } };
}

/** The identity one chunk of a value's run is keyed by: its node's slot and its index in the run. */
function chunkKey(slot: Uint8Array, index: number): string {
  return `${bytesToHex(slot)}#${index}`;
}

/** The batch plan with each value-dependent node's end view replaced by the commitment the body computed. */
function withLearnedViews(
  plan: MappingBatchPlan,
  learnedBySlot: ReadonlyMap<string, Uint8Array>,
): MappingBatchPlan {
  const learnedOf = (slot: Uint8Array): Uint8Array | undefined => learnedBySlot.get(bytesToHex(slot));
  return {
    ...plan,
    groups: plan.groups.map((group) => ({
      ...group,
      records: group.records.map((record) => {
        const learned = learnedOf(record.slot);
        return learned === undefined ? record : { ...record, viewOut: learned };
      }),
    })),
    written: plan.written.map((node) => {
      const learned = learnedOf(node.slot);
      return learned === undefined ? node : { ...node, after: learned };
    }),
  };
}

/** One dynamic value an entry writes: the run of chunk records its write occupies. */
interface HopDynamicRun {
  readonly variable: string;
  /** The declared type, which the run's collection covenant is derived from. */
  readonly type: string;
  readonly plan: ChunkRunPlan;
  /**
   * The live chunk each spent record sits on, in run order, with the id the hop's block holds it under.
   *
   * A deployment's own first hop starts from the empty value its genesis minted, so it spends none; a call starts
   * from the chunks the deployment holds, and the frame spends each of them: it recreates in place the ones the
   * written value still holds and consumes the rest.
   */
  readonly spent: readonly { readonly id: string; readonly utxo: Utxo }[];
  /** The run's width, when the record's own declared length fixed it rather than a stated element. */
  readonly declaredChunks?: number;
  /** Which fact fixed `declaredChunks`: the record's own declaration, or the growth the entry publishes. */
  readonly sizedFrom?: 'record' | 'growth';
}

/** The participant id a hop's block holds for one chunk of a dynamic value's run. */
export function dynamicChunkId(variable: string, index: number): string {
  return `dynamic-chunk-${variable}-${index}`;
}

/** The lock a dynamic value's chunk sits at, which its own collection covenant derives. */
function dynamicChunkLock(category: Uint8Array, variable: string, type: string): Uint8Array {
  return scriptToLockingBytecode(
    buildEntryNftCovenantScript(category, computeCollectionHash(dynamicChunkSignature(variable, type))),
    'p2sh32',
  );
}

/** The live value a dynamic variable holds, and the chunk UTXOs it is held in, in chunk order. */
interface LiveDynamicValue {
  readonly value: Uint8Array;
  readonly chunks: readonly { readonly utxo: Utxo; readonly index: number }[];
}

/**
 * Reads a dynamic variable's live value out of the deployment's record and chunks.
 *
 * The data NFT that declares a dynamic variable carries the value's byte length and nothing else, so it is the
 * authority for how many chunks the deployment holds and how many bytes they account for. The chunks are the ones
 * at the variable's own collection covenant; a set that does not match the record's length is refused rather than
 * joined short, because a run planned from a partial value would be a run the body does not address.
 */
function liveDynamicValue(
  deployment: HopLiveDeployment,
  layout: NonNullable<Artifact['stateLayout']>,
  variable: string,
  type: string,
  nftIndex: number,
): LiveDynamicValue {
  const commitment = deployment.recordCommitments[nftIndex];
  if (commitment === undefined) {
    throw new PerCallProxyDeployError(
      `the deployment holds no record declaring dynamic "${variable}", so this hop cannot read the value its `
      + 'write starts from',
    );
  }
  const decoded = parsePushdataCommitment(binToHex(commitment), layout, nftIndex);
  const length = Number(decoded[dynamicLenKey(variable)] ?? 0n);
  const lock = bytesToHex(dynamicChunkLock(deployment.category, variable, type));
  const chunks: { readonly utxo: Utxo; readonly chunkIndex: number; readonly chunkData: Uint8Array }[] = [];
  for (const utxo of deployment.chunks) {
    const nft = utxo.token?.nft;
    if (nft?.commitment === undefined || utxo.lockingBytecode === undefined
      || bytesToHex(utxo.lockingBytecode) !== lock) continue;
    try {
      chunks.push({ utxo, ...parseChunkCommitment(nft.commitment) });
    } catch {
      throw new PerCallProxyDeployError(
        `the deployment holds a record at dynamic "${variable}"'s collection covenant whose commitment is not a `
        + 'chunk, so this hop cannot read the value its write starts from',
      );
    }
  }
  chunks.sort((left, right) => left.chunkIndex - right.chunkIndex);
  if (chunks.length !== chunkCountForLength(length)) {
    throw new PerCallProxyDeployError(
      `the deployment's dynamic "${variable}" declares ${length} byte(s), which is `
      + `${chunkCountForLength(length)} chunk(s), but ${chunks.length} chunk(s) sit at its collection covenant`,
    );
  }
  chunks.forEach((chunk, index) => {
    if (chunk.chunkIndex !== index) {
      throw new PerCallProxyDeployError(
        `the deployment's dynamic "${variable}" holds chunk ${chunk.chunkIndex} where chunk ${index} belongs`,
      );
    }
  });
  return {
    value: joinChunks(chunks.map((chunk) => chunk.chunkData), length),
    chunks: chunks.map((chunk) => ({ utxo: chunk.utxo, index: chunk.chunkIndex })),
  };
}

/** The value an append produces: the elements the value already holds, then the element the write appends. */
function appendedElementValue(
  live: Uint8Array,
  type: string,
  element: StateValue,
  structs: Artifact['structs'],
): Uint8Array {
  const decoded = live.length === 0 ? [] : decodePushdataValue(live, 0, type, structs).value;
  const elements = Array.isArray(decoded) ? decoded as StateValue[] : [];
  return encodePushdataValue([...elements, element] as StateValue[], type, structs);
}

/** The live state a hop's deployment holds, keyed by field name, as the entry's own body reads it. */
function liveStateValues(request: HopEntryWritesRequest): Record<string, unknown> | undefined {
  const layout = request.artifact.stateLayout;
  const deployment = request.liveDeployment;
  if (layout === undefined || deployment === undefined) return undefined;
  const values: Record<string, unknown> = {};
  deployment.recordCommitments.forEach((commitment, nftIndex) => {
    try {
      Object.assign(values, parsePushdataCommitment(binToHex(commitment), layout, nftIndex));
    } catch {
      // A commitment the layout's own decoder does not read states nothing; an expression that names it is refused
      // by name where it is resolved rather than being assumed here.
    }
  });
  return values;
}

/**
 * The whole value the node a key names holds, joined across its continuation chunks.
 *
 * A key the list does not hold is the type's empty value, which is what the body's own read of an absent key
 * splices onto, so that is stated rather than refused. A node whose value cannot be reassembled from the
 * deployment's own chunks is left unstated here and refused by name at the call site.
 */
function liveNodeValue(
  collection: ArtifactCollection,
  slot: Uint8Array,
  request: HopEntryWritesRequest,
): Uint8Array | undefined {
  const deployment = request.liveDeployment;
  if (deployment === undefined) return new Uint8Array(0);
  // A node an earlier frame of this hop created: the deployment holds no chunks for it, and that frame's own plan
  // is what carries the value it left, so an append continues from those bytes rather than the deployment's.
  const continued = (deployment.continuedNodes ?? []).find((candidate) =>
    candidate.collection === collection.name && bytesEqual(candidate.slot, slot));
  if (continued !== undefined) return continued.value;
  // A node an earlier frame of this hop rewrote: the deployment holds the bytes from before that write, so the
  // value the deployment's own node and chunks reassemble is not the one the frame before this one left.
  const rewritten = (deployment.rewrittenNodes ?? []).find((candidate) =>
    candidate.collection === collection.name && bytesEqual(candidate.slot, slot));
  if (rewritten !== undefined) return rewritten.value;
  const node = liveNode(collection, slot, deployment);
  const commitment = node?.token?.nft?.commitment;
  if (node === undefined || commitment === undefined) return new Uint8Array(0);
  return joinedNodeValue(collection, new Uint8Array(hexToBin(commitment)), deployment);
}

/**
 * The whole value an in-place append to a chunkable mapping produces, from the node's live value and the element.
 *
 * A body that pushes into a chunkable mapping publishes the element it appends (`storedElementSource`) rather than
 * the whole value, so the value the node ends at is the one the deployment holds with the element appended. That
 * is exactly the value the node's tail carries beside the run of chunk records its length names, so stating it is
 * what sizes the run the frame's own group walk addresses. An element the published recipe does not resolve, or a
 * live value the hop cannot reassemble, leaves the value unstated.
 */
function resolveAppendedMappingValue(
  request: HopEntryWritesRequest,
  context: ValueResolutionContext,
  collection: ArtifactCollection,
  access: NonNullable<AbiFunction['entryAccesses']>[number],
  keys: readonly Uint8Array[],
): Uint8Array | undefined {
  const stored = access.storedElementSource;
  if (stored === undefined) return undefined;
  if (access.arrayMutation !== 'push') {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry mutates mapping "${collection.name}" as `
      + `"${access.arrayMutation ?? 'indexed'}", and this hop plans only the element an append carries`,
    );
  }
  const elementType = parseArrayTypeString(collection.valueType)?.elementType;
  if (elementType === undefined || elementType !== stored.elementType) return undefined;
  const element = resolveAppendedElement(
    request, context.fn, stored.expression, elementType, liveStateValues(request),
  );
  if (element === undefined) return undefined;
  const live = liveNodeValue(collection, keyToSlotMulti([...keys]), request);
  if (live === undefined) {
    throw new PerCallProxyDeployError(
      `the implementation's "${context.fn.name}" entry appends to mapping "${collection.name}" a value whose live `
      + "bytes this hop cannot reassemble from the deployment's chunks",
    );
  }
  return appendedElementValue(live, collection.valueType, element, context.structs);
}

/** The element an append writes, in the raw form the array's element type encodes. */
function appendedElement(resolved: FunctionArgument, elementType: string): StateValue | undefined {
  // A literal or forwarded string is the only resolved form whose encoding depends on the element type: a string
  // element stays the text, an address element is its locking bytecode, and a bytes element is its bytes.
  if (typeof resolved === 'string') return coerceFieldValue(resolved, elementType) as StateValue | undefined;
  if (Array.isArray(resolved)) {
    const element = parseArrayTypeString(elementType)?.elementType;
    if (element !== undefined) {
      return resolved.map((item) => appendedElement(item as FunctionArgument, element) ?? item) as StateValue;
    }
  }
  return resolved as StateValue;
}

/**
 * The element one append writes, resolved from the artifact's own published source against the hop's call data.
 *
 * A non-constructor entry's dynamic write is an append, so the artifact publishes the ELEMENT the push names under
 * the pushed variable's name, in the same source vocabulary a constructor's whole-value source uses: a forwarded
 * parameter or contract argument, a literal, the transaction's sender, a struct construction, and the field, index,
 * cast and operator nodes the shipped evaluator speaks. The sender resolves to the frame's own caller lock, which
 * is the address `msg.sender` is bound to. An operand the vocabulary cannot name is published as nothing, so the
 * source is absent and the caller refuses by name rather than guessing an element.
 */
function resolveAppendedElement(
  request: HopEntryWritesRequest,
  fn: AbiFunction,
  source: ExternalCallExpression,
  elementType: string,
  stateValues?: Readonly<Record<string, unknown>>,
): StateValue | undefined {
  const visible = visibleInputs(fn);
  const args = [...(request.args ?? [])];
  const host = {
    resolveExternalArgs: (sources: readonly ArgSource[] | undefined): FunctionArgument[] | undefined =>
      sources?.map((entry): FunctionArgument | undefined => {
        if (entry.kind === 'msgSender') return request.callerLockingBytecode;
        if (entry.kind === 'forward') {
          if (entry.paramIndex === undefined) return undefined;
          return declaredArgumentValue(args[entry.paramIndex], visible[entry.paramIndex]?.type);
        }
        if (entry.kind === 'constructorArg') {
          const index = visible.findIndex((input) => input.name === entry.paramName);
          return index < 0 ? undefined : declaredArgumentValue(args[index], visible[index]?.type);
        }
        if (entry.kind === 'literal') {
          if (entry.type === 'bool') return entry.value === 'true';
          if (entry.type === 'string') return entry.value;
          if (entry.value !== undefined && entry.type !== undefined && /^u?int/.test(entry.type)) {
            return BigInt(entry.value);
          }
          return entry.value === undefined || entry.type === undefined
            ? undefined : hexToBin(entry.value);
        }
        return undefined;
      }) as FunctionArgument[] | undefined,
  };
  const resolved = evaluateExternalExpression(
    host, source, args, request.artifact, stateValues as Record<string, unknown> | undefined, visible,
    undefined, 0, false, undefined, undefined, request.stateLengthDeltas,
  );
  return resolved === undefined ? undefined : appendedElement(resolved, elementType);
}

/**
 * Plans the run of chunk records a dynamic-state write occupies.
 *
 * A per-call body holds a dynamic value in a run of chunk NFTs at the value's own collection covenant, addressed
 * from the frame's declared record block rather than from arithmetic. The run's records are the records the
 * transaction writes, so the hop has to declare them before the body runs; their commitments are what the body
 * computed, which no caller can state, so each declaration starts from a candidate and the derivation learns the
 * body's own value from its close.
 *
 * What the hop must state is the run's width, because a run laid out at the wrong width is not one the body
 * addresses. Three facts can fix it, and the hop takes whichever the entry has:
 *
 *   - the append's element, which the artifact publishes under the pushed variable's name when the body's own
 *     fields are all values its vocabulary can state, added to the value the deployment holds;
 *   - the growth the entry's own write publishes (`dynamicWriteGrowth`), when the element is unstated: the number
 *     of elements the write appends - a bare `push()` grows the run by one, and a push inside a run-time loop by
 *     the loop's own width - added to the live value. The elements' bytes are what the body computed, so each
 *     created chunk's commitment is learned from the body's close exactly as a stated element's run is;
 *   - the record's own declaration, when neither is stated: the body writes the value's byte length into the
 *     record and closes against the declaration the plan states, so the length that record is asked to carry names
 *     the run's chunks. The declaration is read from `writtenCommitments`, which the caller re-states from the
 *     body's own close, so the run is planned at the width the body wrote rather than at the empty one it started
 *     from. Until the length is stated the run is laid at the live width; the record close precedes the run's pin
 *     in the body, which is what lets that first plan reach the close that sizes it.
 *
 * The run's spent side is the live chunks, which the frame spends: those the written value still holds are recreated
 * in place, and a write that shortens the run consumes the rest with no successor. Every other shape is refused by
 * name: several dynamic variables, or a live set that does not match the record's own length.
 */
function planHopDynamicRun(request: HopEntryWritesRequest): HopDynamicRun | undefined {
  const fn = request.artifact.abi.find((candidate) => candidate.name === request.functionName);
  if (fn === undefined) return undefined;
  const variables = fn.dynamicWrites ?? [];
  if (variables.length === 0) return undefined;
  if (variables.length > 1) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry writes ${variables.length} dynamic value(s), and this `
      + 'hop plans one run to one variable',
    );
  }
  const variable = variables[0]!;
  const layout = request.artifact.stateLayout;
  const declared = layout?.variables.find((candidate) => candidate.name === variable);
  if (declared === undefined || declared.dynamic !== true) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry writes dynamic "${variable}", which the artifact does `
      + 'not publish as a dynamic state variable',
    );
  }
  const elementType = parseArrayTypeString(declared.type)?.elementType;
  const source = fn.dynamicWriteSources?.[variable];
  const growth = fn.dynamicWriteGrowth?.[variable];
  const structs = request.artifact.structs ?? layout?.structs;
  // The element the append writes, when the artifact publishes one. The run's width is the live value's length
  // plus that element, so a stated element sizes it without the body's help. A field the artifact publishes as a
  // read of the deployment's own state - the machine's clock register - resolves against that state.
  const element = elementType === undefined || source === undefined
    ? undefined : resolveAppendedElement(request, fn, source, elementType, liveStateValues(request));
  const live = request.liveDeployment === undefined ? undefined
    : liveDynamicValue(request.liveDeployment, layout!, variable, declared.type, declared.nftIndex);
  const spent = live?.value ?? new Uint8Array(0);
  const spentChunks = dynamicValueRecords(layout, variable, spent).chunks;
  const spentParticipants = (live?.chunks ?? []).map(
    (chunk, index) => ({ id: dynamicChunkId(variable, index), utxo: chunk.utxo }),
  );

  if (element !== undefined) {
    const written = appendedElementValue(spent, declared.type, element, structs);
    const plan = planChunkRun({ layout, variable, spent, written });
    if (plan.spent.chunks.length > plan.written.chunks.length) {
      throw new PerCallProxyDeployError(
        `the implementation's "${request.functionName}" entry writes dynamic "${variable}" a value shorter than `
        + 'the one the deployment holds, which this hop does not plan',
      );
    }
    return { variable, type: declared.type, plan, spent: spentParticipants };
  }

  // The element is unstated, but the artifact states how many elements the write appends, so the run's width is
  // at least the live value grown by those elements. When the element type packs at a fixed stride that bound is
  // exact; otherwise the body's own close names the exact width, and the bound is what lets the first plan reach
  // that close instead of laying a run the body's own coordinate cannot read.
  const recordLength = declaredRunLength(request, declared.name, declared.nftIndex);
  const growthFloor = source === undefined && growth !== undefined
    ? dynamicGrowthFloorLength(request, fn, growth, declared, spent, structs) : undefined;
  if (recordLength !== undefined || growthFloor !== undefined) {
    const length = Math.max(recordLength ?? 0, growthFloor ?? 0);
    return sizedDynamicRun(variable, declared.type, length, spentChunks, spentParticipants,
      growthFloor !== undefined && (recordLength === undefined || growthFloor > recordLength)
        ? 'growth' : 'record');
  }
  if (elementType === undefined || source === undefined) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry writes dynamic "${variable}" (${declared.type}), whose `
      + 'appended element the artifact publishes no source for, so the run of chunk records its write creates '
      + 'cannot be sized',
    );
  }
  throw new PerCallProxyDeployError(
    `the implementation's "${request.functionName}" entry writes dynamic "${variable}" (${declared.type}) an `
    + 'element the artifact publishes a source for but the hop\'s call data does not determine, so the run of '
    + 'chunk records its write creates cannot be sized',
  );
}

/**
 * Lays a dynamic run at the width a stated byte length fixes, learning no chunk's commitment here.
 *
 * The width is all the hop can state: every chunk's bytes are what the body computed, so each declaration starts
 * from a candidate, and the derivation learns the body's own value from its close exactly as it does for a stated
 * element's run. `sizedFrom` names which fact fixed the width, so a refusal can say whether the record's own
 * declaration sized it or the growth the entry publishes. A width below the live run's is a write that shortens the
 * value: the chunks past it are the ones the frame consumes.
 */
function sizedDynamicRun(
  variable: string,
  type: string,
  length: number,
  spentChunks: readonly Uint8Array[],
  spent: HopDynamicRun['spent'],
  sizedFrom: 'record' | 'growth',
): HopDynamicRun {
  const width = chunkCountForLength(length);
  const plan: ChunkRunPlan = {
    variable,
    type,
    spent: { header: new Uint8Array(0), chunks: [...spentChunks] },
    written: {
      header: new Uint8Array(0),
      chunks: Array.from({ length: width }, (_unused, index) => runChunkCandidate(variable, index)),
    },
  };
  return { variable, type, plan, spent, declaredChunks: width, sizedFrom };
}

/**
 * A lower bound on the byte length a dynamic write leaves, from the growth the entry publishes, or `undefined` when
 * nothing usable about the run's width follows.
 *
 * The elements the write appends grow the value by their own encoded length, and every appended element is framed
 * in at least one byte, so the live value's length plus the number of appended elements is a bound the run cannot
 * be narrower than. A packed element type - a built-in fixed-width element such as `uint` or `bytes32`, whose
 * elements sit at a constant stride - makes the bound exact, so the run settles from it alone. A framed element
 * type - a struct whose fields encode at their own length, a `string`, an unbounded `bytes` - leaves the exact
 * width to the body's own close: a call re-takes its plan from that close, so the bound is what lets the first plan
 * reach it rather than laying an empty run the body's own record coordinate cannot read, while a hop that states
 * its run once (a deployment's own first hop) has no such close to read and gets nothing.
 */
function dynamicGrowthFloorLength(
  request: HopEntryWritesRequest,
  fn: AbiFunction,
  growth: DynamicWriteGrowthAbi,
  declared: NonNullable<Artifact['stateLayout']>['variables'][number],
  spent: Uint8Array,
  structs: Artifact['structs'],
): number | undefined {
  const elements = growthElementCount(request, fn, growth, declared.name);
  const elementType = parseArrayTypeString(declared.type)?.elementType;
  if (elementType === undefined || !isFixedWidthType(elementType)) {
    return request.liveDeployment === undefined ? undefined : spent.length + elements;
  }
  const liveCount = spent.length === 0 ? 0
    : arrayLengthOf(decodePushdataValue(spent, 0, declared.type, structs).value);
  const count = liveCount + elements;
  const stride = fixedWidthBytes(elementType);
  return encodePushdataValue(BigInt(count), 'bigint').length + count * stride;
}

/** The element count of a decoded array value; a value that does not decode as one counts no elements. */
function arrayLengthOf(value: StateValue): number {
  return Array.isArray(value) ? value.length : 0;
}

/**
 * The number of elements a write appends, from the growth the entry publishes.
 *
 * A straight-line write appends the published count outright. A write inside a run-time loop appends the published
 * count once per turn, and the turns are the length of the call's own array when the artifact pinned the loop to
 * one; a loop the artifact could not pin, or a call whose data does not carry that array, is refused by name
 * rather than guessed at.
 */
function growthElementCount(
  request: HopEntryWritesRequest,
  fn: AbiFunction,
  growth: DynamicWriteGrowthAbi,
  variable: string,
): number {
  if (growth.varyingArrayParam !== undefined) {
    const visible = visibleInputs(fn);
    const index = visible.findIndex((input) => input.name === growth.varyingArrayParam);
    const array = index < 0 ? undefined : request.args?.[index];
    if (!Array.isArray(array)) {
      throw new PerCallProxyDeployError(
        `the implementation's "${request.functionName}" entry appends to dynamic "${variable}" once per turn of a `
        + `run-time loop over "${growth.varyingArrayParam}", whose length this hop's call data does not carry, so `
        + 'the run of chunk records its write creates cannot be sized',
      );
    }
    return array.length * growth.elements;
  }
  if (growth.looping === true) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry appends to dynamic "${variable}" inside a run-time `
      + 'loop whose width the artifact does not pin to a call parameter, so the run of chunk records its write '
      + 'creates cannot be sized',
    );
  }
  return growth.elements;
}

/**
 * The byte length the record's own declaration asks for a dynamic value, or `undefined` when the caller states no
 * record for it.
 *
 * The record carries the value's length beside the contract's other fields, so it is decoded through the shipped
 * pushdata decoder the deployment's own classification uses. A commitment that does not decode as this layout's
 * record states nothing here, and the run stays unsized rather than being planned from a guess.
 */
function declaredRunLength(
  request: HopEntryWritesRequest,
  variable: string,
  nftIndex: number,
): number | undefined {
  const commitment = request.writtenCommitments?.[nftIndex];
  const layout = request.artifact.stateLayout;
  if (commitment === undefined || layout === undefined) return undefined;
  let length: unknown;
  try {
    length = parsePushdataCommitment(binToHex(commitment), layout, nftIndex)[dynamicLenKey(variable)];
  } catch {
    return undefined;
  }
  return typeof length === 'bigint' ? Number(length) : undefined;
}

/**
 * The candidate one chunk of an unsized run starts from.
 *
 * The record's declaration fixes only how many chunks the run has; the bytes each carries are what the body
 * computed, so each is learned from the body's own close exactly as a stated element's run is. The candidate is
 * the identity the close is matched against, and it is derived from the variable and the chunk's index, so a run
 * re-planned at a wider width keeps the candidates an earlier attempt learned.
 */
function runChunkCandidate(variable: string, index: number): Uint8Array {
  return sha256(new TextEncoder().encode(`per-call dynamic run\u0000${variable}\u0000${index}`));
}

/** One dynamic value the entry only reads: its live chunks, in run order, each with the id the block holds it under. */
interface HopReadRun {
  readonly variable: string;
  /** The declared type, which the run's collection covenant is derived from. */
  readonly type: string;
  readonly chunks: readonly { readonly id: string; readonly utxo: Utxo; readonly commitment: Uint8Array }[];
}

/**
 * Plans the runs of chunk records the entry reads and does not write.
 *
 * A body reads a dynamic value from its frame's own declaration of the value's run, which sits past the records
 * ahead of it in the segment, and the compiler addresses a read-only run ahead of every run a write grows, in the
 * order the artifact publishes the reads. The hop declares each such run as the deployment holds it: every live
 * chunk, kept in place at the commitment it carries. A value the entry also writes is the write's run, and a
 * deployment's own first hop reads the empty values its genesis minted, which hold no chunk.
 */
function planHopReadRuns(request: HopEntryWritesRequest): readonly HopReadRun[] {
  const fn = request.artifact.abi.find((candidate) => candidate.name === request.functionName);
  const layout = request.artifact.stateLayout;
  const deployment = request.liveDeployment;
  if (fn === undefined || layout === undefined || deployment === undefined) return [];
  const written = new Set(fn.dynamicWrites ?? []);
  return (fn.dynamicReads ?? []).filter((variable) => !written.has(variable)).map((variable): HopReadRun => {
    const declared = layout.variables.find((candidate) => candidate.name === variable);
    if (declared === undefined || declared.dynamic !== true) {
      throw new PerCallProxyDeployError(
        `the implementation's "${request.functionName}" entry reads dynamic "${variable}", which the artifact does `
        + 'not publish as a dynamic state variable',
      );
    }
    const live = liveDynamicValue(deployment, layout, variable, declared.type, declared.nftIndex);
    return {
      variable,
      type: declared.type,
      chunks: live.chunks.map((chunk, index) => ({
        id: dynamicChunkId(variable, index),
        utxo: chunk.utxo,
        commitment: new Uint8Array(hexToBin(chunk.utxo.token!.nft!.commitment!)),
      })),
    };
  }).filter((run) => run.chunks.length > 0);
}

/**
 * The records the runs the entry only reads contribute: each live chunk kept where it sits, at its own commitment,
 * spent on its collection covenant's read-only path, which recreates it unchanged.
 */
function layReadRuns(
  reads: readonly HopReadRun[],
  context: HopEntryWritesContext,
): { readonly entries: readonly RecordEntry[]; readonly inputs: Readonly<Record<string, DraftInput>> } {
  const entries: RecordEntry[] = [];
  const inputs: Record<string, DraftInput> = {};
  for (const run of reads) {
    const { lockingBytecode, unlockingBytecode } = entryRecordReadUnlock(
      bytesToHex(context.category), dynamicChunkSignature(run.variable, run.type),
    );
    for (const chunk of run.chunks) {
      const index = context.indexOf(chunk.id);
      entries.push({ in: index, out: index, viewIn: chunk.commitment, viewOut: chunk.commitment });
      inputs[chunk.id] = {
        source: {
          lockingBytecode, valueSatoshis: chunk.utxo.satoshis, token: nodeToken(context.category, chunk.commitment),
        },
        unlockingBytecode,
      };
    }
  }
  return { entries, inputs };
}

/**
 * The elements each of the entry's own dynamic writes appends, from the artifact's own append facts.
 *
 * A body that appends to a dynamic value and keys a write by the written length reads the value it wrote, so the
 * hop counts those keys from the live length plus the elements the append adds. The artifact states the elements: a
 * push of a published element appends one, and a write that publishes only its growth appends that many per turn —
 * once for a straight-line write, and once per element of the array a loop walks. A growth whose trip count the
 * artifact does not pin to a call parameter states nothing, so such a key is left at the live length rather than
 * counted from a guess.
 */
function appendDeltas(
  request: HopEntryWritesRequest,
  fn: AbiFunction,
): Readonly<Record<string, bigint>> | undefined {
  const variables = fn.dynamicWrites ?? [];
  if (variables.length === 0) return undefined;
  const args = [...(request.args ?? [])];
  const visible = visibleInputs(fn);
  const deltas: Record<string, bigint> = {};
  for (const variable of variables) {
    const growth = fn.dynamicWriteGrowth?.[variable];
    if (growth === undefined) {
      if (fn.dynamicWriteSources?.[variable] !== undefined) deltas[variable] = 1n;
      continue;
    }
    if (growth.looping === true) continue;
    const perTurn = BigInt(growth.elements);
    if (growth.varyingArrayParam === undefined) {
      deltas[variable] = perTurn;
      continue;
    }
    const index = visible.findIndex((input) => input.name === growth.varyingArrayParam);
    const array = index < 0 ? undefined : args[index];
    if (Array.isArray(array)) deltas[variable] = perTurn * BigInt(array.length);
  }
  return Object.keys(deltas).length === 0 ? undefined : deltas;
}

/** The request with the elements its own dynamic writes append, unless the caller already stated them. */
function withAppendDeltas(request: HopEntryWritesRequest): HopEntryWritesRequest {
  if (request.stateLengthDeltas !== undefined) return request;
  const fn = request.artifact.abi.find((candidate) => candidate.name === request.functionName);
  if (fn === undefined) return request;
  const deltas = appendDeltas(request, fn);
  return deltas === undefined ? request : { ...request, stateLengthDeltas: deltas };
}

/**
 * Refuses a run the entry only reads beside a run-time loop's writes unless its frame finds the run as the last family
 * its segments declare: the one dynamic value the entry reads, beside no dynamic write and no long mapping value.
 */
function requireTrailingReadRun(request: HopEntryWritesRequest, batch: HopMappingBatch, writesDynamic: boolean): void {
  const fn = request.artifact.abi.find((candidate) => candidate.name === request.functionName);
  const reads = fn?.dynamicReads ?? [];
  const chunkable = (request.artifact.stateLayout?.collections ?? [])
    .find((candidate) => candidate.name === batch.collection)?.chunkableValue === true;
  if (reads.length === 1 && (fn?.dynamicWrites ?? []).length === 0 && !writesDynamic && !chunkable) return;
  throw new PerCallProxyDeployError(
    `the implementation's "${request.functionName}" entry reads ${reads.map((name) => `"${name}"`).join(', ')} beside `
    + `a run-time loop's writes to "${batch.collection}", and its frame finds a run past the loop's records only `
    + 'when it is the one dynamic value the entry reads and no dynamic write or long mapping value follows it',
  );
}

/** Plans the entry's own writes, with the ids the plan places. */
export function hopEntryWrites(rawRequest: HopEntryWritesRequest): HopEntryWrites | undefined {
  const request = withAppendDeltas(rawRequest);
  const batches = planHopMappingBatches(request);
  const dynamic = planHopDynamicRun(request);
  // A read-only run is declared beside no mapping write, or past a run-time loop's records, one per turn, as the
  // declaration's last family: the frame finds the one run it reads there from the declaration's own end, and holds
  // it kept. A verified batch's body holds the records past its groups to the chunks it writes and counts no run it
  // only reads.
  const loopOnly = batches.length === 1 && batches[0]!.loopWritten === true;
  const reads = batches.length === 0 || loopOnly ? planHopReadRuns(request) : [];
  if (loopOnly && reads.length > 0) requireTrailingReadRun(request, batches[0]!, dynamic !== undefined);
  if (batches.length === 0 && dynamic === undefined && reads.length === 0) return undefined;
  // One batch and one dynamic run sit in the frame's one segment, and the contract states the group's declared
  // surplus in both loops that address the run. Several batches beside a run would need the compiler's own order
  // for the two families, which it does not publish, so that shape is refused rather than guessed at.
  if (batches.length > 1 && dynamic !== undefined) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry writes ${batches.length} sorted collections beside a `
      + `dynamic value, whose records this hop does not order`,
    );
  }
  const spentUtxos = new Map<string, Utxo>();
  for (const batch of batches) {
    for (const node of batch.spent) {
      const utxo = batch.utxoBySlot.get(bytesToHex(node.slot));
      if (utxo !== undefined) spentUtxos.set(node.id, utxo);
    }
  }
  for (const chunk of dynamic?.spent ?? []) spentUtxos.set(chunk.id, chunk.utxo);
  const readRunIds = reads.flatMap((run) => run.chunks.map((chunk) => chunk.id));
  for (const chunk of reads.flatMap((run) => run.chunks)) spentUtxos.set(chunk.id, chunk.utxo);
  if (hopTraceOn() && (batches.length > 0 || dynamic !== undefined || reads.length > 0)) {
    hopTrace(`writes ${request.functionName} batch=${batches.map((batch) => (
      `${batch.collection}${batch.loopWritten === true ? '(loop)' : ''}:`
      + `${batch.spent.length}spent/${batch.plan.written.length}written`)).join(',')} `
      + `dyn=${dynamic === undefined ? 'none' : `${dynamic.variable}:${dynamic.plan.spent.chunks.length}spent/`
        + `${dynamic.plan.written.chunks.length}written${dynamic.declaredChunks === undefined ? '' : 'sz'}`
        + (dynamic.declaredChunks === undefined ? ''
          : `(${dynamic.declaredChunks}${dynamic.sizedFrom === 'growth' ? 'g' : ''})`)} `
      + `reads=${reads.map((run) => `${run.variable}:${run.chunks.length}`).join(',')}`);
  }
  return {
    ...(batches[0] === undefined ? {} : { collection: batches[0].collection, signature: batches[0].signature }),
    participantIds: [
      ...batches.flatMap((batch) => batch.spent.map((node) => node.id)),
      ...(dynamic?.spent.map((chunk) => chunk.id) ?? []),
      ...readRunIds,
    ],
    ...(readRunIds.length === 0 ? {} : { readRunIds }),
    reachWrites: batches.map((batch) => ({
      collection: batch.collection,
      chunkable: (request.artifact.stateLayout?.collections ?? [])
        .find((candidate) => candidate.name === batch.collection)?.chunkableValue === true,
      targets: batch.targets,
      spentIds: batch.spent.map((node) => node.id),
      ...(batch.continued === true ? { continued: true } : {}),
    })),
    learningCandidates: [
      ...batches.flatMap((batch) => batch.learningCandidates),
      ...(dynamic?.plan.written.chunks ?? []),
    ],
    // The batch entries come first in the learned views, so a lookup by a batch node's slot is exact with only
    // them; a dynamic run's chunks follow and are not looked up by slot.
    learningSlotOrder: batches.flatMap((batch) => batch.learningSlots),
    writtenNodes: batches.flatMap((batch) => batch.plan.written.map((node) => ({
      collection: batch.collection, slot: node.slot, commitment: node.after, existed: node.existed,
      // A chunking value's bytes are what a later append joins its element onto, and the plan's own value is the
      // whole array it wrote: it is not reassemblable from the deployment once an earlier frame wrote it.
      ...(batch.rawValues.has(bytesToHex(node.slot))
        ? { value: batch.rawValues.get(bytesToHex(node.slot))! } : {}),
    }))),
    spentUtxos,
    ...(batches.some((batch) => batch.unstatedValue === true) ? { awaitsValue: true } : {}),
    ...(batches[0]?.loopMints === undefined ? {} : { loopRun: batches[0].loopRun, loopMints: batches[0].loopMints }),
    ...(dynamic?.declaredChunks === undefined
      ? {} : {
        sizedRun: {
          variable: dynamic.variable,
          chunks: dynamic.declaredChunks,
          from: dynamic.sizedFrom ?? 'record',
        },
      }),
    // A body that writes one collection is laid out exactly as the shipped planner computes it, dynamic run beside
    // its batch. A body that writes several lays each batch's records at its own place in the created region.
    lay: (context: HopEntryWritesContext): LaidHopEntryWrites => (batches.length <= 1
      ? layEntryWrites(batches[0], dynamic, context, reads)
      : layEntryWriteBatches(batches, context)),
  };
}

/** Lays one batch's — or one dynamic run's — records at `context.createdBase`, as the entry's own write. */
function layEntryWrites(
  batch: HopMappingBatch | undefined,
  dynamic: HopDynamicRun | undefined,
  context: HopEntryWritesContext,
  reads: readonly HopReadRun[] = [],
): LaidHopEntryWrites {
  // The record families that fill the trailing region are laid out in the order the compiler emits them: the
  // batch's records, then a dynamic value's chunks, then a chunkable mapping value's chunks. A created record's
  // declared index has to be the output the trailing region allocates it, so the families' indices are
  // allocated in that same order — every created node, then the chunks the dynamic run grows, then the value
  // chunks. The chunks a dynamic run keeps are participants the frame spends and recreates in place, and the ones a
  // shorter value leaves behind are participants it spends and does not recreate.
  const plan = batch?.plan;
  const created = plan === undefined ? [] : plan.written.filter((node) => !node.existed);
  const spentCount = dynamic?.plan.spent.chunks.length ?? 0;
  const writtenCount = dynamic?.plan.written.chunks.length ?? 0;
  const keptCount = Math.min(spentCount, writtenCount);
  const dynamicCreatedCount = Math.max(0, writtenCount - spentCount);
  const dynamicCreatedBase = context.createdBase + created.length;
  const chunkBase = dynamicCreatedBase + dynamicCreatedCount;
  const dynamicBase = batch?.learningCandidates.length ?? 0;

  const dynamicLaid = dynamic === undefined ? undefined : layOutChunkRun({
    plan: dynamic.plan,
    category: context.category,
    base: spentCount === 0 ? chunkBase : context.indexOf(dynamic.spent[0]!.id),
    writer: context.proxyMasterIndex,
    valueSatoshis: context.recordAmount,
    ...(context.releasedLock === undefined ? {} : { removedLock: context.releasedLock }),
  });
  const dynamicEntries: RecordEntry[] = [];
  const dynamicOutputs: DraftSourceOutput[] = [];
  const dynamicInputs: Record<string, DraftInput> = {};
  const learnedSlots: Uint8Array[] = [];
  (dynamicLaid?.records ?? []).forEach((record, offset) => {
    if (record.role === 'removed') {
      // A chunk past the written value's width is consumed with no successor: its input is spent on the write path
      // and its index carries a plain output that takes its satoshis, which settlement reads as the record's value.
      const spent = dynamic!.spent[offset]!;
      dynamicEntries.push({
        in: context.indexOf(spent.id), out: INDEX_NONE, viewIn: record.viewIn, viewOut: new Uint8Array(0),
      });
      dynamicInputs[spent.id] = {
        source: {
          lockingBytecode: record.input!.source.lockingBytecode, valueSatoshis: spent.utxo.satoshis,
          token: nodeToken(context.category, record.viewIn),
        },
        output: { lockingBytecode: record.input!.output!.lockingBytecode, valueSatoshis: spent.utxo.satoshis },
        unlockingBytecode: record.input!.unlockingBytecode,
      };
      return;
    }
    const learned = context.learnedViews[dynamicBase + offset] ?? record.entry.viewOut;
    if (record.role !== 'kept') {
      // A created chunk declares no input: it is a trailing output at the index its family allocates.
      dynamicEntries.push({
        in: INDEX_NONE,
        out: dynamicCreatedBase + (offset - keptCount),
        viewIn: new Uint8Array(0),
        viewOut: learned,
      });
      dynamicOutputs.push({
        lockingBytecode: record.output!.lockingBytecode,
        valueSatoshis: record.output!.valueSatoshis,
        token: nodeToken(context.category, learned),
      });
      return;
    }
    const spent = dynamic!.spent[offset]!;
    const lockingBytecode = record.input!.source.lockingBytecode;
    dynamicEntries.push({ in: record.index, out: record.index, viewIn: record.viewIn, viewOut: learned });
    dynamicInputs[spent.id] = {
      source: {
        lockingBytecode, valueSatoshis: spent.utxo.satoshis,
        token: nodeToken(context.category, record.viewIn),
      },
      output: {
        lockingBytecode, valueSatoshis: spent.utxo.satoshis,
        token: nodeToken(context.category, learned),
      },
      unlockingBytecode: record.input!.unlockingBytecode,
    };
  });
  // The runs the entry only reads sit past the batch's records and ahead of the run a write grows.
  const read = layReadRuns(reads, context);
  if (batch === undefined || plan === undefined) {
    return {
      entries: [...read.entries, ...dynamicEntries],
      inputs: { ...read.inputs, ...dynamicInputs },
      trailingOutputs: dynamicOutputs,
      createdOutputs: dynamicEntries.filter((entry) => entry.in === INDEX_NONE).map((entry) => entry.out),
      createdNodes: [],
      learnedSlots,
    };
  }
  const afterBySlot = new Map(plan.written.map((node) => [bytesToHex(node.slot), node.after]));
  const learnedBySlot = new Map<string, Uint8Array>();
  batch.learningSlots.forEach((slot, index) => {
    const learned = context.learnedViews[index];
    if (learned !== undefined) {
      learnedBySlot.set(bytesToHex(slot), learned);
      learnedSlots.push(slot);
    }
  });
  const placements = new Map<string, MappingNodePlacement>();
  for (const node of batch.spent) {
    const index = context.indexOf(node.id);
    placements.set(bytesToHex(node.slot), { in: index, out: index });
  }
  // A node an earlier frame of this hop created is named by that frame's output: this frame spends no input for it.
  for (const node of plan.written) {
    const key = bytesToHex(node.slot);
    if (!node.existed || placements.has(key)) continue;
    const out = context.continuedOutputOf?.(node.slot);
    if (out === undefined) continue;
    placements.set(key, { out });
  }
  created.forEach((node, position) => {
    placements.set(bytesToHex(node.slot), { out: context.createdBase + position });
  });
  const chunkPosition = new Map(plan.chunks.map((chunk, position) => [chunkKey(chunk.slot, chunk.index), position]));
  const nodePlacements: MappingNodePlacements = {
    placementOf: (slot) => placements.get(bytesToHex(slot)),
    chunkOutputOf: (slot, index) => {
      const position = chunkPosition.get(chunkKey(slot, index));
      return position === undefined ? undefined : chunkBase + position;
    },
  };
  // A batch's segment declares a record per target group; a run-time loop's declares one per node, in the order its
  // turns mint them, which is the plan's own `written` list.
  const laid = withLearnedViews(plan, learnedBySlot);
  const entries = batch.loopWritten === true
    ? layOutMappingWritten(laid, nodePlacements)
    : layOutMappingBatch(laid, nodePlacements);
  // A value-dependent node's end view is the body's to compute; every other node keeps the planner's own.
  const writtenOf = (slot: Uint8Array): Uint8Array =>
    learnedBySlot.get(bytesToHex(slot)) ?? afterBySlot.get(bytesToHex(slot))!;
  const valueChunkEntries = entries.slice(entries.length - plan.chunks.length);
  const groupEntries = entries.slice(0, entries.length - plan.chunks.length);
  // A node no target of the batch names is one an insert relinks and nothing else writes. The node records are laid
  // in the order the plan states them, the groups' or, for a loop, the written nodes'.
  const targetSlots = new Set(batch.targets.map((target) => bytesToHex(target.slot)));
  const nodeRecords = batch.loopWritten === true ? laid.written : laid.groups.flatMap((group) => group.records);
  const relinked = groupEntries.filter((_entry, at) => nodeRecords[at]?.existed === true
    && !targetSlots.has(bytesToHex(nodeRecords[at]!.slot)));

  const covenant = buildEntryNftCovenantScript(context.category, computeCollectionHash(batch.signature));
  const lock = scriptToLockingBytecode(covenant, 'p2sh32');
  const unlockingBytecode = createUnlockingBytecode('p2sh32', scriptToBytecode(covenant), [
    encodeFunctionArgument(1n, 'bigint') as Uint8Array,
    encodeFunctionArgument(BigInt(context.proxyMasterIndex), 'bigint') as Uint8Array,
  ]);
  const inputs: Record<string, DraftInput> = { ...read.inputs, ...dynamicInputs };
  for (const node of batch.spent) {
    const satoshis = batch.utxoBySlot.get(bytesToHex(node.slot))?.satoshis ?? context.recordAmount;
    inputs[node.id] = {
      source: {
        lockingBytecode: lock, valueSatoshis: satoshis,
        token: nodeToken(context.category, node.before),
      },
      output: {
        lockingBytecode: lock, valueSatoshis: satoshis,
        token: nodeToken(context.category, writtenOf(node.slot)),
      },
      unlockingBytecode,
    };
  }
  // A created node has no input, so it is a trailing output past the events, at the index it declares. The
  // dynamic run's grown chunks and then the value chunks follow it, each carrying what the body computed.
  const trailingOutputs: DraftSourceOutput[] = created.map((node): DraftSourceOutput => ({
    lockingBytecode: lock, valueSatoshis: context.recordAmount,
    token: nodeToken(context.category, writtenOf(node.slot)),
  }));
  const chunkOutputs = plan.chunks.map((chunk): DraftSourceOutput => ({
    lockingBytecode: mappingValueChunkLock(context.category, batch.collection, chunk),
    valueSatoshis: context.recordAmount,
    token: nodeToken(context.category, chunk.commitment),
  }));
  // The value witnesses the frame's block lists, in slot order: a slot the entry does not read stays empty,
  // and the head parks one slot per value its master runs a body of.
  const valueSlots = batch.valueWitnesses.size === 0 ? undefined
    : Array.from(
      { length: Math.max(...batch.valueWitnesses.keys()) + 1 },
      (_unused, slot) => batch.valueWitnesses.get(slot) ?? new Uint8Array(0),
    );
  if (hopTraceOn()) {
    const laid = [...groupEntries, ...read.entries, ...dynamicEntries, ...valueChunkEntries];
    hopTrace(`laid entries=[${laid.map((entry) => `${entry.in}/${entry.out}`
      + `:${bytesToHex(entry.viewIn).slice(0, 12)}>${bytesToHex(entry.viewOut ?? new Uint8Array(0)).slice(0, 12)}`
      + `:${(entry.viewIn ?? new Uint8Array(0)).length}`).join(' ')}] `
      + `dynamicOut=[${dynamicEntries.map((entry) => entry.out).join(' ')}]`);
  }
  return {
    entries: [...groupEntries, ...read.entries, ...dynamicEntries, ...valueChunkEntries],
    inputs,
    trailingOutputs: [...trailingOutputs, ...dynamicOutputs, ...chunkOutputs],
    // The created records the transaction writes, in first-declaration order: every created node, then the run
    // the dynamic value grew, then the run of chunk records a long mapping value takes.
    createdOutputs: [
      ...groupEntries.filter((entry) => entry.in === INDEX_NONE).map((entry) => entry.out),
      ...dynamicEntries.filter((entry) => entry.in === INDEX_NONE).map((entry) => entry.out),
      ...valueChunkEntries.map((entry) => entry.out),
    ],
    // A batch's created nodes sit at the created region's own indices, in the order the segment declares them.
    createdNodes: created.map((node, position) => ({ slot: node.slot, out: context.createdBase + position })),
    ...(relinked.length === 0 ? {} : { relinked }),
    learnedSlots,
    ...(valueSlots === undefined ? {} : { values: valueSlots }),
  };
}

/**
 * Lays every batch the entry writes, each at its own place in the created region.
 *
 * A body that writes two collections verifies them in the order the artifact publishes, so its frame's segment
 * declares the first batch's records and then the second's, and the transaction's created records follow the same
 * order: each batch's created nodes and value chunks are appended after the previous batch's, and the next batch's
 * declared output indices start where the previous batch's region ended.
 */
function layEntryWriteBatches(
  batches: readonly HopMappingBatch[],
  context: HopEntryWritesContext,
): LaidHopEntryWrites {
  const entries: RecordEntry[] = [];
  const inputs: Record<string, DraftInput> = {};
  const trailingOutputs: DraftSourceOutput[] = [];
  const createdOutputs: number[] = [];
  const createdNodes: { slot: Uint8Array; out: number }[] = [];
  const relinked: RecordEntry[] = [];
  const learnedSlots: Uint8Array[] = [];
  const valueSlots = new Map<number, Uint8Array>();
  let createdBase = context.createdBase;
  let learnedBase = 0;
  for (const batch of batches) {
    const laid = layEntryWrites(batch, undefined, {
      ...context,
      createdBase,
      learnedViews: context.learnedViews.slice(learnedBase),
    });
    entries.push(...laid.entries);
    Object.assign(inputs, laid.inputs);
    trailingOutputs.push(...laid.trailingOutputs);
    createdOutputs.push(...laid.createdOutputs);
    createdNodes.push(...laid.createdNodes);
    relinked.push(...laid.relinked ?? []);
    learnedSlots.push(...laid.learnedSlots);
    (laid.values ?? []).forEach((value, slot) => valueSlots.set(slot, value));
    learnedBase += batch.learningCandidates.length;
    createdBase += laid.trailingOutputs.length;
  }
  const values = valueSlots.size === 0 ? undefined
    : Array.from(
      { length: Math.max(...valueSlots.keys()) + 1 },
      (_unused, slot) => valueSlots.get(slot) ?? new Uint8Array(0),
    );
  return { entries, inputs, trailingOutputs, createdOutputs, createdNodes, learnedSlots,
    ...(relinked.length === 0 ? {} : { relinked }),
    ...(values === undefined ? {} : { values }) };
}
