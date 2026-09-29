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
 * has to be stated because a run laid out at another width is not the run the body reads, and an entry that
 * appends to an address array the frame's own sender is the one width an entry's own facts fix without reading
 * prior state. Every other shape is refused by name rather than sized by guessing.
 *
 * A shape this module has no plan for — a write to several collections, several dynamic variables — is refused by
 * the fact that is missing.
 */

import { hexToBin } from '@bitauth/libauth';
import {
  INDEX_NONE,
  VALUE_INLINE_LIMIT,
  buildEntryNftCovenantScript,
  bytesEqual,
  bytesToHex,
  computeCollectionHash,
  decodePushdataValue,
  dynamicChunkSignature,
  encodeChunkableValueTail,
  encodePushdataValue,
  getDefaultStateValue,
  parseArrayTypeString,
  scriptToBytecode,
  type AbiFunction,
  type Artifact,
  type RecordEntry,
  type StateValue,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../../Argument.js';
import type { Utxo } from '../../interfaces.js';
import { addressToLockScript, createUnlockingBytecode, scriptToLockingBytecode } from '../../utils.js';
import { decodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../stateful/SortedList.js';
import { evalComputedKey } from '../../stateful/route-expression-key.js';
import type { DraftInput, DraftSourceOutput, DraftToken } from '../composer/draft.js';
import {
  layOutChunkRun, planChunkRun, type ChunkRunPlan,
} from '../composer/chunk-plan.js';
import {
  layOutMappingBatch, mappingValueChunkLock, planMappingBatch,
  type MappingBatchPlan, type MappingNodePlacement,
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
}

/** Everything the entry's own writes are planned from. */
export interface HopEntryWritesRequest {
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly args?: readonly FunctionArgument[];
  /** The frame's caller lock, which a `msg.sender` key resolves to. */
  readonly callerLockingBytecode: Uint8Array;
  /**
   * Each sorted collection's live nodes, from the deployment's own classification.
   *
   * A genesis hop runs before the proxy's genesis, so its collection holds only the empty head sentinel the proxy
   * is about to mint; a later call reads the nodes the collection has grown. Absent means the empty head alone.
   */
  readonly nodesByCollection?: ReadonlyMap<string, readonly Utxo[]>;
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
}

/** The writes one entry performs, with the ids the plan places. */
export interface HopEntryWrites {
  /**
   * The collection the entry writes, whose empty head the deployment seeds.
   *
   * A sorted batch names its mapping; a dynamic-state write names the value's own chunk collection, which the
   * deployment seeds the same way. When an entry does both, the mapping's head is the one that is seeded.
   */
  readonly collection: string;
  /** The collection's canonical signature, which derives the entry covenant lock its records sit at. */
  readonly signature: string;
  /** The participant ids the proxy's block holds for the nodes the entry spends; a created run has none. */
  readonly participantIds: readonly string[];
  /** The placeholder each value-dependent record's declaration starts from, in learning order. */
  readonly learningCandidates: readonly Uint8Array[];
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
  /** Each collection's live nodes, which a field the source reads back out of the entry's own node comes from. */
  readonly nodesByCollection?: ReadonlyMap<string, readonly Utxo[]>;
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

/** The raw bytes a collection node holds, for a value the tail keeps inline; `undefined` when it does not. */
function inlineNodeValue(
  collection: ArtifactCollection | undefined,
  tail: Uint8Array,
): Uint8Array | undefined {
  if (collection?.chunkableValue !== true) return tail;
  // A chunkable value's tail is a four-byte length and, when the value fits, the value itself. A longer value's
  // bytes live in continuation chunks the hop is not handed, so only the inline form can be read back.
  if (tail.length < 4) return undefined;
  const length = new DataView(tail.buffer, tail.byteOffset, 4).getUint32(0, true);
  return tail.length === 4 + length && length <= VALUE_INLINE_LIMIT ? tail.slice(4) : undefined;
}

/**
 * One field of the node a key names, decoded out of the node's own value.
 *
 * The compiler publishes `field:<name>(map:<collection>(<key>))` for a field the body leaves as it was, so the
 * field's value is whatever the collection's node for that key holds. The node is the deployment's own
 * classification, and its value is decoded through the shipped entry-commitment and pushdata decoders. A key the
 * list does not hold is the type's default, which is what the body's own read of an absent key yields, so that is
 * stated rather than refused. A node whose value is held in continuation chunks cannot be decoded from the hop's
 * inputs and is refused by name rather than assumed.
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
  const slot = bytesToHex(keyToSlotMulti([key]));
  const node = (context.nodesByCollection?.get(collection.name) ?? []).find((candidate) => {
    const commitment = candidate.token?.nft?.commitment;
    return commitment !== undefined && bytesToHex(decodeEntryCommitment(hexToBin(commitment)).slot) === slot;
  });
  if (node === undefined) return getDefaultStateValue(fieldType, context.structs);
  const commitment = node.token?.nft?.commitment;
  if (commitment === undefined) return undefined;
  const raw = inlineNodeValue(collection, decodeEntryCommitment(new Uint8Array(hexToBin(commitment))).value);
  if (raw === undefined) {
    throw new PerCallProxyDeployError(
      `the implementation's "${context.fn.name}" entry reads field "${fieldName}" of the node "${collectionName}" `
      + 'holds, whose value lives in continuation chunks this hop is not handed',
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
    ...(request.nodesByCollection === undefined ? {} : { nodesByCollection: request.nodesByCollection }),
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

  const collectionNodes = request.nodesByCollection?.get(collection.name) ?? [];
  const inventory: Uint8Array[] = [];
  const utxoBySlot = new Map<string, Utxo>();
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
  const plan = planMappingBatch({
    writes, inventory,
    encodeValue: chunkable ? encodeChunkableValueTail : (encoded: Uint8Array) => encoded,
    ...(chunkable ? { chunkable: (value: Uint8Array) => value } : {}),
  });

  const headCommitment = headSentinelCommitment();
  const spent = plan.written.filter((node) => node.existed).map((node) => ({
    slot: node.slot,
    before: node.before,
    // The empty head sentinel is named by its collection; any other spent node is named by its own slot.
    id: bytesEqual(node.before, headCommitment)
      ? `${MAPPING_HEAD_PREFIX}${collection.name}`
      : `${MAPPING_NODE_PREFIX}${bytesToHex(node.slot)}`,
  }));
  // A node the batch creates, and a target it rewrites, carry the value the body computed; a node it only relinks
  // keeps its own value, so its end view is stated by the planner.
  const targets = new Set(plan.groups.map((group) => bytesToHex(group.slot)));
  const learningSlots: Uint8Array[] = [];
  const learningCandidates: Uint8Array[] = [];
  const learned = new Set<string>();
  for (const group of plan.groups) {
    for (const record of group.records) {
      const key = bytesToHex(record.slot);
      if (learned.has(key)) continue;
      if (record.existed && !targets.has(key)) continue;
      learned.add(key);
      learningSlots.push(record.slot);
      learningCandidates.push(record.viewOut);
    }
  }
  return {
    collection: collection.name,
    signature: collection.signature,
    plan,
    spent,
    learningSlots,
    learningCandidates,
    utxoBySlot,
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
}

/**
 * Plans the run of chunk records a dynamic-state write occupies.
 *
 * A per-call body holds a dynamic value in a run of chunk NFTs at the value's own collection covenant, addressed
 * from the frame's declared record block rather than from arithmetic. The run's records are the records the
 * transaction writes, so the hop has to declare them before the body runs; their commitments are what the body
 * computed, which no caller can state, so each declaration starts from the candidate the shipped chunk plan
 * derives and the derivation learns the body's own value from its close.
 *
 * What the hop must state is the run's width, because a run laid out at the wrong width is not one the body
 * addresses. This plans the one width an entry's own facts determine without reading prior state: a write to a
 * dynamic array of the frame's own address type, whose frame is a deployment's first call, starts from the empty
 * value the proxy's genesis minted and appends the frame sender. A single address element fills one chunk whatever
 * its bytes, so the run is exactly one chunk wide, and a body that wrote more than one element is refused by the
 * body's own pin rather than settled at a width the hop guessed. Every other shape — several dynamic variables, a
 * live value the hop is not handed, an element type that could straddle a chunk boundary — is refused by name.
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
  // A later call starts from the value the deployed record holds; a hop is handed that record's chunks by neither
  // the deployment path nor the call path today, so the run's spent side cannot be planned here.
  if (request.nodesByCollection !== undefined) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry writes dynamic "${variable}", whose live value a hop `
      + 'is not handed the deployed chunks for',
    );
  }
  const layout = request.artifact.stateLayout;
  const declared = layout?.variables.find((candidate) => candidate.name === variable);
  if (declared === undefined || declared.dynamic !== true) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry writes dynamic "${variable}", which the artifact does `
      + 'not publish as a dynamic state variable',
    );
  }
  // Only the frame's own sender can be stated as the appended element, and only an address element is one whose
  // value fills a single chunk whatever it holds: any other element type's width is not fixed by the frame, so the
  // run's width would be a guess.
  const element = parseArrayTypeString(declared.type)?.elementType;
  if (element !== 'address' || fn.usesMsgSender !== true) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry writes dynamic "${variable}" (${declared.type}) a value `
      + 'whose element this hop cannot state, so the run of chunk records its write creates cannot be sized',
    );
  }
  const structs = request.artifact.structs ?? layout?.structs;
  const written = encodePushdataValue([request.callerLockingBytecode] as StateValue[], declared.type, structs);
  const plan = planChunkRun({ layout, variable, spent: new Uint8Array(0), written });
  return { variable, type: declared.type, plan };
}

/** Plans the entry's own writes, with the ids the plan places. */
export function hopEntryWrites(request: HopEntryWritesRequest): HopEntryWrites | undefined {
  const batch = planHopMappingBatch(request);
  const dynamic = planHopDynamicRun(request);
  if (batch === undefined && dynamic === undefined) return undefined;
  return {
    collection: batch?.collection ?? dynamic!.variable,
    signature: batch?.signature
      ?? dynamicChunkSignature(dynamic!.variable, dynamic!.type),
    participantIds: batch?.spent.map((node) => node.id) ?? [],
    learningCandidates: [
      ...(batch?.learningCandidates ?? []),
      ...(dynamic?.plan.written.chunks ?? []),
    ],
    lay: (context: HopEntryWritesContext): LaidHopEntryWrites => {
      const dynamicLaid = dynamic === undefined ? undefined : layOutChunkRun({
        plan: dynamic.plan,
        category: context.category,
        base: context.createdBase + (batch === undefined ? 0
          : batch.plan.written.filter((node) => !node.existed).length + batch.plan.chunks.length),
        writer: context.proxyMasterIndex,
        valueSatoshis: context.recordAmount,
      });
      const dynamicBase = batch?.learningCandidates.length ?? 0;
      const dynamicEntries: RecordEntry[] = (dynamicLaid?.records ?? []).map((record, offset) => ({
        in: INDEX_NONE,
        out: record.index,
        viewIn: new Uint8Array(0),
        viewOut: context.learnedViews[dynamicBase + offset] ?? record.entry.viewOut,
      }));
      const dynamicOutputs: DraftSourceOutput[] = (dynamicLaid?.records ?? []).map((record, offset) => ({
        lockingBytecode: record.output!.lockingBytecode,
        valueSatoshis: record.output!.valueSatoshis,
        token: nodeToken(context.category, context.learnedViews[dynamicBase + offset] ?? record.entry.viewOut),
      }));
      if (batch === undefined) {
        return {
          entries: dynamicEntries,
          inputs: {},
          trailingOutputs: dynamicOutputs,
          createdOutputs: dynamicEntries.map((entry) => entry.out),
        };
      }
      const { plan } = batch;
      const created = plan.written.filter((node) => !node.existed);
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
      // A long value's chunks are created records too, one output each past the created nodes. They sit past the
      // value's own node, at the indices the segment declares them at.
      const chunkBase = context.createdBase + created.length;
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

      const covenant = buildEntryNftCovenantScript(context.category, computeCollectionHash(batch.signature));
      const lock = scriptToLockingBytecode(covenant, 'p2sh32');
      const unlockingBytecode = createUnlockingBytecode('p2sh32', scriptToBytecode(covenant), [
        encodeFunctionArgument(1n, 'bigint') as Uint8Array,
        encodeFunctionArgument(BigInt(context.proxyMasterIndex), 'bigint') as Uint8Array,
      ]);
      const inputs: Record<string, DraftInput> = {};
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
      // A created node has no input, so it is a trailing output past the events, at the index it declares. A long
      // value's chunks follow it, each at the value's own collection covenant carrying the bytes the body wrote.
      const trailingOutputs: DraftSourceOutput[] = created.map((node): DraftSourceOutput => ({
        lockingBytecode: lock, valueSatoshis: context.recordAmount,
        token: nodeToken(context.category, writtenOf(node.slot)),
      }));
      const chunkOutputs = plan.chunks.map((chunk): DraftSourceOutput => ({
        lockingBytecode: mappingValueChunkLock(context.category, batch.collection, chunk),
        valueSatoshis: context.recordAmount,
        token: nodeToken(context.category, chunk.commitment),
      }));
      return {
        entries: [...entries, ...dynamicEntries],
        inputs,
        trailingOutputs: [...trailingOutputs, ...chunkOutputs, ...dynamicOutputs],
        // The created records the transaction writes, in first-declaration order: every created node, then the run
        // of chunk records a long value takes, then a dynamic value's own run.
        createdOutputs: [
          ...entries.filter((entry) => entry.in === INDEX_NONE).map((entry) => entry.out),
          ...dynamicEntries.map((entry) => entry.out),
        ],
      };
    },
  };
}
