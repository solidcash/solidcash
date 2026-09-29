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
 * collection has grown. A body that reads and writes one key — `require(users[who].publicKey.length == 0)` then
 * `users[who] = ...` — touches the key once, so its batch plans one write and the read is whatever node that write
 * splices through. A key the entry only reads beside its write has no group of its own and is refused by name.
 *
 * A written node's commitment carries the value the body computed. A collection whose values do not chunk states
 * that value from the access the artifact publishes and resolves it against the arguments the hop was given; a
 * value the source does not determine keeps its structural candidate and the derivation learns it from the body's
 * own close. A value source that reads fields back out of the entry's own node is resolved from the live node's
 * decoded value, and a field whose node lives in continuation chunks is refused by name. A collection whose values
 * chunk needs the value's byte length to size its run, so a value the source does not determine is refused by
 * name; a value it does determine also takes the run of chunk records the body pins, laid past the created node at
 * the value's own collection covenant.
 *
 * A `delete m[k]` compiles to an in-place write of the value type's default, so that too is one write per target
 * with the target's commitment learned from the body's close.
 *
 * A dynamic-state write is the same shape one level out: the value is not in a node but in a run of chunk records
 * at its own collection covenant, and the hop declares that run exactly as the body addresses it. The run's width
 * has to be stated because a run laid out at another width is not the run the body reads; it is the value the write
 * starts from — the deployment's live chunks for a call, the empty value a genesis minted for a deployment's own
 * first hop — plus the element the frame appends. Every other shape is refused by name rather than sized by
 * guessing.
 *
 * A shape this module has no plan for — a write to several collections, several dynamic variables — is refused by
 * the fact that is missing.
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
  getDefaultStateValue,
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
  type ExternalCallExpression,
  type RecordEntry,
  type StateValue,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../../Argument.js';
import { evaluateExternalExpression } from '../../stateful/sc-evaluate-external-expression.js';
import type { Utxo } from '../../interfaces.js';
import { addressToLockScript, createUnlockingBytecode, scriptToLockingBytecode } from '../../utils.js';
import { decodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../stateful/SortedList.js';
import { evalComputedKey } from '../../stateful/route-expression-key.js';
import type { DraftInput, DraftSourceOutput, DraftToken } from '../composer/draft.js';
import {
  dynamicValueRecords, layOutChunkRun, planChunkRun, type ChunkRunPlan,
} from '../composer/chunk-plan.js';
import {
  layOutMappingBatch, mappingValueChunkLock, planMappingBatch,
  type MappingBatchPlan, type MappingBatchRecord, type MappingNodePlacement, type MappingWrittenNode,
} from '../composer/mapping-plan.js';
import { PerCallProxyDeployError } from './errors.js';

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

/** One sorted batch an entry performs against the collection it starts from. */
interface HopMappingBatch {
  readonly collection: string;
  readonly signature: string;
  readonly plan: MappingBatchPlan;
  /** The nodes the batch spends, in write order, each with the id the hop's block holds it under. */
  readonly spent: readonly { readonly slot: Uint8Array; readonly before: Uint8Array; readonly id: string }[];
  /** The slot of each value-dependent node, in learning order, whose end view the body computes. */
  readonly learningSlots: readonly Uint8Array[];
  /** The placeholder each value-dependent node's declaration starts from, in learning order. */
  readonly learningCandidates: readonly Uint8Array[];
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
}

/** The coordinates a hop's entry writes need to be placed: the layout, the created region and the writer. */
export interface HopEntryWritesContext {
  /** The input index of a participant id the layout placed. */
  indexOf(id: string): number;
  readonly proxyMasterIndex: number;
  /** The first trailing output index past the events, where a created node sits. */
  readonly createdBase: number;
  readonly recordAmount: bigint;
  readonly category: Uint8Array;
  /** The end commitment learned for each value-dependent node, in `learningCandidates` order. */
  readonly learnedViews: readonly (Uint8Array | undefined)[];
}

/** The records an entry's own writes contribute to a hop plan. */
export interface LaidHopEntryWrites {
  readonly entries: readonly RecordEntry[];
  readonly inputs: Readonly<Record<string, DraftInput>>;
  readonly trailingOutputs: readonly DraftSourceOutput[];
  readonly createdOutputs: readonly number[];
  /** The long value each value-witness slot reads, in slot order, where the body reads one from its frame. */
  readonly values?: readonly Uint8Array[];
}

/** The writes one entry performs, with the ids the plan places. */
export interface HopEntryWrites {
  /**
   * The sorted collection the entry batches into, when it writes one; the deployment seeds its empty head.
   *
   * A sorted list has no node until something writes it, so a deployment that a later entry writes has to mint the
   * list's empty head. A dynamic value's chunks have no head — the empty value is no chunk at all — so a write that
   * only appends to one names no collection here and the deployment seeds nothing.
   */
  readonly collection?: string;
  /** The collection's canonical signature, which derives the entry covenant lock its records sit at. */
  readonly signature?: string;
  /** The participant ids the proxy's block holds for the nodes the entry spends; a created run has none. */
  readonly participantIds: readonly string[];
  /** The placeholder each value-dependent record's declaration starts from, in learning order. */
  readonly learningCandidates: readonly Uint8Array[];
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
  readonly sizedRun?: { readonly variable: string; readonly chunks: number };
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
type ArtifactCollection = NonNullable<NonNullable<Artifact['stateLayout']>['collections']>[number];

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
function joinedNodeValue(
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
 * The writes one entry performs to its one sorted collection, in the batch's target order.
 *
 * The batch names its targets by physical entry slot, so each write's key sources are read from the access the same
 * batch lists at that slot.
 */
function orderedAccesses(
  fn: AbiFunction,
  accesses: NonNullable<AbiFunction['entryAccesses']>,
): NonNullable<AbiFunction['entryAccesses']> {
  const batch = fn.sortedBatchInfo![0]!;
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

/** Plans the one sorted batch an entry performs, or `undefined` when it touches no sorted collection. */
function planHopMappingBatch(request: HopEntryWritesRequest): HopMappingBatch | undefined {
  const fn = request.artifact.abi.find((candidate) => candidate.name === request.functionName);
  if (fn === undefined) return undefined;
  const accesses = fn.entryAccesses ?? [];
  const batches = fn.sortedBatchInfo ?? [];
  if (accesses.length === 0 && batches.length === 0) return undefined;
  // A body that only reads a sorted collection is left to the plan's other records; this module plans writes.
  const writesSomething = batches.length > 0
    || accesses.some((access) => access.operations.some((operation) => operation !== 'read'));
  if (!writesSomething) return undefined;
  if (batches.length !== 1) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry writes ${accesses.length} mapping entry(ies) across `
      + `${batches.length} sorted batch(es), and this hop plans one batch to one collection`,
    );
  }
  const batch = batches[0]!;
  const collection = request.artifact.stateLayout?.collections
    ?.find((candidate) => candidate.name === batch.collection);
  if (collection === undefined || collection.sorted !== true) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry writes mapping "${batch.collection}", which the `
      + 'artifact does not publish as a sorted collection',
    );
  }
  const ordered = orderedAccesses(fn, accesses);
  const visible = visibleInputs(fn);
  const args = [...(request.args ?? [])];
  const structs = request.artifact.structs ?? request.artifact.stateLayout?.structs;
  const keyTypes = collection.keyTypes ?? [collection.keyType];

  const resolveKey = (access: NonNullable<AbiFunction['entryAccesses']>[number], index: number): Uint8Array => {
    const source = access.keySources?.[index];
    if (source?.kind === 'msgSender') return request.callerLockingBytecode;
    const label = source?.expressionLabel ?? source?.paramName ?? access.keyParams[index];
    const evaluated = evalComputedKey(label, args, visible, undefined, undefined);
    if (evaluated !== undefined) return evaluated;
    const byName = encodedArgument(fn, args, label ?? '', structs);
    if (byName !== undefined) return byName;
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry writes mapping "${access.collection}" at a key this `
      + `hop cannot resolve from its call data (${label ?? '<unnamed>'})`,
    );
  };
  const chunkable = collection.chunkableValue === true;
  const resolution: ValueResolutionContext = {
    fn, args, structs, callerLockingBytecode: request.callerLockingBytecode,
    ...(request.artifact.stateLayout?.collections === undefined
      ? {} : { collections: request.artifact.stateLayout.collections }),
    ...(request.liveDeployment === undefined ? {} : { liveDeployment: request.liveDeployment }),
  };

  const writes = ordered.map((access) => {
    if (keyTypes.length !== access.keyParams.length) {
      throw new PerCallProxyDeployError(
        `the implementation's "${request.functionName}" entry writes mapping "${access.collection}" with `
        + `${access.keyParams.length} key(s), which the collection's ${keyTypes.length} key type(s) do not cover`,
      );
    }
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
      const keys = access.keyParams.map((_param, index) => resolveKey(access, index));
      return { keys, value: new Uint8Array(0) };
    }
    // A chunkable collection's node tail states the value's byte length, so its run has to be sized from the value
    // itself: a value the artifact's source does not determine is refused by name rather than sized approximately.
    // A value the source does determine is stated outright, and a value past the inline limit also takes the run of
    // chunk records.
    if (chunkable) {
      const raw = resolveWriteValue(resolution, access);
      if (raw === undefined) {
        throw new PerCallProxyDeployError(
          `the implementation's "${request.functionName}" entry writes mapping "${access.collection}" a value whose `
          + 'source the artifact does not publish, so this hop cannot tell whether the write needs value chunks',
        );
      }
      return { keys: access.keyParams.map((_param, index) => resolveKey(access, index)), value: raw };
    }
    // The value is the body's to compute, so a one-byte placeholder fixes only the plan's structure: the slots, the
    // successor links and which targets are inserts. Every commitment that depends on the value is left unstated
    // and learned from the body's own close.
    return { keys: access.keyParams.map((_param, index) => resolveKey(access, index)), value: new Uint8Array(1) };
  });

  // A body that reads a value the node's tail cannot hold takes the value itself from its frame's block, one slot
  // per entry access that reads one. The hop supplies the slot, so the witness is the node's own whole value,
  // joined across its continuation chunks exactly as the field read is.
  const valueWitnesses = new Map<number, Uint8Array>();
  if (chunkable && request.liveDeployment !== undefined) {
    for (const access of ordered) {
      if (access.slotIndex === undefined || !access.operations.includes('read')) continue;
      const keys = access.keyParams.map((_param, index) => resolveKey(access, index));
      const node = liveNode(collection, keyToSlotMulti([...keys]), request.liveDeployment);
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
  const inventory: Uint8Array[] = [];
  const utxoBySlot = new Map<string, Utxo>();
  // The empty list's head sentinel is what a first write splices through. A deployment's own entry mints it, and
  // the genesis seeds it for that collection; a call into a collection the deployment holds no node of has only the
  // sentinel's commitment to plan against, so the hop mints the head in its own transaction and spends nothing
  // for it — the node the plan relinks is a record the transaction writes, not one it reads.
  const createsHead = request.liveDeployment !== undefined && collectionNodes.length === 0;
  if (collectionNodes.length === 0) {
    // The genesis mints the empty list's head sentinel, so a hop before it plans against that commitment.
    inventory.push(headSentinelCommitment());
  } else {
    for (const node of collectionNodes) {
      const commitment = node.token?.nft?.commitment;
      if (commitment === undefined) {
        throw new PerCallProxyDeployError(
          `the deployment holds a node of collection "${collection.name}" with no commitment`,
        );
      }
      const bytes = new Uint8Array(hexToBin(commitment));
      inventory.push(bytes);
      utxoBySlot.set(bytesToHex(decodeEntryCommitment(bytes).slot), node);
    }
  }
  const planned = planMappingBatch({
    writes, inventory,
    encodeValue: chunkable ? encodeChunkableValueTail : (encoded: Uint8Array) => encoded,
    ...(chunkable ? { chunkable: (value: Uint8Array) => value } : {}),
  });

  // A node the batch creates, and a target it rewrites, carry the value the body computed; a node it only relinks
  // keeps its own value, so its end view is stated by the planner. The candidates are read from the plan the
  // inventory fixed, before a created head is marked as one: the head's relink is structural — it is the target
  // slot — so it is the planner's to state rather than the body's to compute.
  const targets = new Set(planned.groups.map((group) => bytesToHex(group.slot)));
  const learningSlots: Uint8Array[] = [];
  const learningCandidates: Uint8Array[] = [];
  const learned = new Set<string>();
  for (const group of planned.groups) {
    for (const record of group.records) {
      const key = bytesToHex(record.slot);
      if (learned.has(key)) continue;
      if (record.existed && !targets.has(key)) continue;
      learned.add(key);
      learningSlots.push(record.slot);
      learningCandidates.push(record.viewOut);
    }
  }
  const plan = createsHead ? withCreatedHead(planned) : planned;
  const headCommitment = headSentinelCommitment();
  const spent = plan.written.filter((node) => node.existed).map((node) => ({
    slot: node.slot,
    before: node.before,
    // The empty head sentinel is named by its collection; any other spent node is named by its own slot.
    id: bytesEqual(node.before, headCommitment)
      ? `${MAPPING_HEAD_PREFIX}${collection.name}`
      : `${MAPPING_NODE_PREFIX}${bytesToHex(node.slot)}`,
  }));
  return {
    collection: collection.name,
    signature: collection.signature,
    plan,
    spent,
    learningSlots,
    learningCandidates,
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

/**
 * The plan with its empty head sentinel turned into a record the hop creates rather than spends.
 *
 * A call into a collection the deployment holds no node of plans its first write against the empty list, whose head
 * sentinel no live UTXO carries. The hop mints that head in its own transaction — the shipped encoder's commitment
 * for the empty list, at the collection's own entry covenant, which is what the genesis mints and what the body's
 * group walk reads — so the predecessor record declares no input and the hop lays it out at a trailing output. The
 * relink the planner computed is unchanged; only where the head comes from is.
 *
 * The record keeps the sentinel as its `viewIn`: its input side names no coordinate, but a body that reads the
 * predecessor through its segment declaration returns that view, and the empty list's head is the pre-state a
 * read of an absent key proves its bracket against. Emptying it would make that read resolve to nothing.
 */
function withCreatedHead(plan: MappingBatchPlan): MappingBatchPlan {
  const sentinel = headSentinelCommitment();
  const isHead = (commitment: Uint8Array): boolean => bytesEqual(commitment, sentinel);
  return {
    ...plan,
    groups: plan.groups.map((group) => ({
      ...group,
      records: group.records.map((record): MappingBatchRecord => (
        record.existed && isHead(record.viewIn)
          ? { ...record, existed: false }
          : record
      )),
    })),
    written: plan.written.map((node): MappingWrittenNode => (
      node.existed && isHead(node.before)
        ? { ...node, existed: false, before: new Uint8Array(0) }
        : node
    )),
  };
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
   * from the chunks the deployment holds, and each of them the frame spends and recreates in place.
   */
  readonly spent: readonly { readonly id: string; readonly utxo: Utxo }[];
  /** The run's width, when the record's own declared length fixed it rather than a stated element. */
  readonly declaredChunks?: number;
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

/** The element an append writes, in the raw form the array's element type encodes. */
function appendedElement(resolved: FunctionArgument, elementType: string): StateValue | undefined {
  // A literal or forwarded string is the only resolved form whose encoding depends on the element type: a string
  // element stays the text, an address element is its locking bytecode, and a bytes element is its bytes.
  if (typeof resolved !== 'string') return resolved as StateValue;
  return coerceFieldValue(resolved, elementType) as StateValue | undefined;
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
): StateValue | undefined {
  const visible = visibleInputs(fn);
  const args = [...(request.args ?? [])];
  const host = {
    resolveExternalArgs: (sources: readonly ArgSource[] | undefined): FunctionArgument[] | undefined =>
      sources?.map((entry): FunctionArgument | undefined => {
        if (entry.kind === 'msgSender') return request.callerLockingBytecode;
        if (entry.kind === 'forward') {
          return entry.paramIndex === undefined ? undefined : args[entry.paramIndex];
        }
        if (entry.kind === 'constructorArg') {
          const index = visible.findIndex((input) => input.name === entry.paramName);
          return index < 0 ? undefined : args[index];
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
    host, source, args, request.artifact, undefined, visible,
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
 * addresses. Two facts can fix it, and the hop takes whichever the entry has:
 *
 *   - the append's element, which the artifact publishes under the pushed variable's name when the body's own
 *     fields are all values its vocabulary can state, added to the value the deployment holds;
 *   - the record's own declaration, when the element is unstated: the body writes the value's byte length into the
 *     record and closes against the declaration the plan states, so the length that record is asked to carry names
 *     the run's chunks. The declaration is read from `writtenCommitments`, which the caller re-states from the
 *     body's own close, so the run is planned at the width the body wrote rather than at the empty one it started
 *     from. Until the length is stated the run is laid at the live width; the record close precedes the run's pin
 *     in the body, which is what lets that first plan reach the close that sizes it.
 *
 * The run's spent side is the live chunks, which the frame spends and recreates; a write that would shorten the run
 * is refused by name, and so is every other shape — several dynamic variables, a live set that does not match the
 * record's own length.
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
  const structs = request.artifact.structs ?? layout?.structs;
  // The element the append writes, when the artifact publishes one. The run's width is the live value's length
  // plus that element, so a stated element sizes it without the body's help.
  const element = elementType === undefined || source === undefined
    ? undefined : resolveAppendedElement(request, fn, source, elementType);
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

  // The element is unstated, so the record's own declaration is what names the run's width. A caller that states
  // the record's commitments is a call reconstructing the plan from what the body closed against; a caller that
  // does not is the deployment path, which has no such close to read and refuses by name.
  const length = declaredRunLength(request, declared.name, declared.nftIndex);
  if (length !== undefined) {
    const width = chunkCountForLength(length);
    if (width < spentChunks.length) {
      throw new PerCallProxyDeployError(
        `the implementation's "${request.functionName}" entry writes dynamic "${variable}" ${length} byte(s), which `
        + `is ${width} chunk(s), fewer than the ${spentChunks.length} chunk(s) the deployment holds`,
      );
    }
    const plan: ChunkRunPlan = {
      variable,
      type: declared.type,
      spent: { header: new Uint8Array(0), chunks: spentChunks },
      written: {
        header: new Uint8Array(0),
        chunks: Array.from({ length: width }, (_unused, index) => runChunkCandidate(variable, index)),
      },
    };
    return { variable, type: declared.type, plan, spent: spentParticipants, declaredChunks: width };
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

/** Plans the entry's own writes, with the ids the plan places. */
export function hopEntryWrites(request: HopEntryWritesRequest): HopEntryWrites | undefined {
  const batch = planHopMappingBatch(request);
  const dynamic = planHopDynamicRun(request);
  if (batch === undefined && dynamic === undefined) return undefined;
  // A batch's group and a dynamic value's run both sit in the frame's one segment, and the body addresses each by
  // its own rule: the group by declared position, the run at the ordinal its arithmetic derives past the group.
  // The contract states the group's declared surplus in both loops that address the run, so an insert group (the
  // relinked predecessor and the created node) and a run beside it settle together.
  const spentUtxos = new Map<string, Utxo>();
  for (const node of batch?.spent ?? []) {
    const utxo = batch!.utxoBySlot.get(bytesToHex(node.slot));
    if (utxo !== undefined) spentUtxos.set(node.id, utxo);
  }
  for (const chunk of dynamic?.spent ?? []) spentUtxos.set(chunk.id, chunk.utxo);
  return {
    ...(batch === undefined ? {} : { collection: batch.collection, signature: batch.signature }),
    participantIds: [
      ...(batch?.spent.map((node) => node.id) ?? []),
      ...(dynamic?.spent.map((chunk) => chunk.id) ?? []),
    ],
    learningCandidates: [
      ...(batch?.learningCandidates ?? []),
      ...(dynamic?.plan.written.chunks ?? []),
    ],
    spentUtxos,
    ...(dynamic?.declaredChunks === undefined
      ? {} : { sizedRun: { variable: dynamic.variable, chunks: dynamic.declaredChunks } }),
    lay: (context: HopEntryWritesContext): LaidHopEntryWrites => {
      // The record families that fill the trailing region are laid out in the order the compiler emits them: the
      // batch's records, then a dynamic value's chunks, then a chunkable mapping value's chunks. A created record's
      // declared index has to be the output the trailing region allocates it, so the families' indices are
      // allocated in that same order — every created node, then the chunks the dynamic run grows, then the value
      // chunks. The chunks a dynamic run keeps are participants the frame spends and recreates in place.
      const plan = batch?.plan;
      const created = plan === undefined ? [] : plan.written.filter((node) => !node.existed);
      const keptCount = dynamic?.plan.spent.chunks.length ?? 0;
      const dynamicCreatedCount = dynamic === undefined ? 0 : dynamic.plan.written.chunks.length - keptCount;
      const dynamicCreatedBase = context.createdBase + created.length;
      const chunkBase = dynamicCreatedBase + dynamicCreatedCount;
      const dynamicBase = batch?.learningCandidates.length ?? 0;

      const dynamicLaid = dynamic === undefined ? undefined : layOutChunkRun({
        plan: dynamic.plan,
        category: context.category,
        base: keptCount === 0 ? chunkBase : context.indexOf(dynamic.spent[0]!.id),
        writer: context.proxyMasterIndex,
        valueSatoshis: context.recordAmount,
      });
      const dynamicEntries: RecordEntry[] = [];
      const dynamicOutputs: DraftSourceOutput[] = [];
      const dynamicInputs: Record<string, DraftInput> = {};
      (dynamicLaid?.records ?? []).forEach((record, offset) => {
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
      if (batch === undefined || plan === undefined) {
        return {
          entries: dynamicEntries,
          inputs: dynamicInputs,
          trailingOutputs: dynamicOutputs,
          createdOutputs: dynamicEntries.filter((entry) => entry.in === INDEX_NONE).map((entry) => entry.out),
        };
      }
      const afterBySlot = new Map(plan.written.map((node) => [bytesToHex(node.slot), node.after]));
      const learnedBySlot = new Map<string, Uint8Array>();
      batch.learningSlots.forEach((slot, index) => {
        const learned = context.learnedViews[index];
        if (learned !== undefined) learnedBySlot.set(bytesToHex(slot), learned);
      });
      const placements = new Map<string, MappingNodePlacement>();
      for (const node of batch.spent) {
        const index = context.indexOf(node.id);
        placements.set(bytesToHex(node.slot), { in: index, out: index });
      }
      created.forEach((node, position) => {
        placements.set(bytesToHex(node.slot), { out: context.createdBase + position });
      });
      const chunkPosition = new Map(plan.chunks.map((chunk, position) => [chunkKey(chunk.slot, chunk.index), position]));
      const entries = layOutMappingBatch(withLearnedViews(plan, learnedBySlot), {
        placementOf: (slot) => placements.get(bytesToHex(slot)),
        chunkOutputOf: (slot, index) => {
          const position = chunkPosition.get(chunkKey(slot, index));
          return position === undefined ? undefined : chunkBase + position;
        },
      });
      // A value-dependent node's end view is the body's to compute; every other node keeps the planner's own.
      const writtenOf = (slot: Uint8Array): Uint8Array =>
        learnedBySlot.get(bytesToHex(slot)) ?? afterBySlot.get(bytesToHex(slot))!;
      const valueChunkEntries = entries.slice(entries.length - plan.chunks.length);
      const groupEntries = entries.slice(0, entries.length - plan.chunks.length);

      const covenant = buildEntryNftCovenantScript(context.category, computeCollectionHash(batch.signature));
      const lock = scriptToLockingBytecode(covenant, 'p2sh32');
      const unlockingBytecode = createUnlockingBytecode('p2sh32', scriptToBytecode(covenant), [
        encodeFunctionArgument(1n, 'bigint') as Uint8Array,
        encodeFunctionArgument(BigInt(context.proxyMasterIndex), 'bigint') as Uint8Array,
      ]);
      const inputs: Record<string, DraftInput> = { ...dynamicInputs };
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
      return {
        entries: [...groupEntries, ...dynamicEntries, ...valueChunkEntries],
        inputs,
        trailingOutputs: [...trailingOutputs, ...dynamicOutputs, ...chunkOutputs],
        // The created records the transaction writes, in first-declaration order: every created node, then the run
        // the dynamic value grew, then the run of chunk records a long mapping value takes.
        createdOutputs: [
          ...groupEntries.filter((entry) => entry.in === INDEX_NONE).map((entry) => entry.out),
          ...dynamicEntries.filter((entry) => entry.in === INDEX_NONE).map((entry) => entry.out),
          ...valueChunkEntries.map((entry) => entry.out),
        ],
        ...(valueSlots === undefined ? {} : { values: valueSlots }),
      };
    },
  };
}
