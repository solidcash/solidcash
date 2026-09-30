/**
 * The mapping records a user-entered call must declare.
 *
 * A per-call body that touches a sorted mapping does not read one value in place: the mapping is a chain of entry
 * NFTs, so the frame's segment has to declare every node the body's group walk reads. A target the inventory holds
 * is rewritten in place, so its group is one record; a target the inventory does not hold is spliced in, so its
 * group is the relinked predecessor followed by a created node. The created node has no input, so it is a trailing
 * output, and its commitment carries the value the body computes — which no caller can state in advance. The node's
 * declaration therefore starts from a structural candidate, the slot and successor the planner computed with a
 * placeholder tail, which the body parses for its update/insert decision and then closes against, handing the value
 * it computed back to the caller.
 *
 * The nodes and their commitments come from the deployment's own classification (`readPerCallDeployment`): the
 * collection a write touches is the one its access names, its inventory is that collection's live nodes, and the
 * lock every node is spent under is the entry covenant the collection's signature derives. The writes themselves
 * are planned by the shipped batch planner (`planMappingBatch`) against that inventory, so the groups the segment
 * declares are the ones the body's own batch derivation walks.
 *
 * A key an entry only reads is declared as its node, kept in place, ahead of any batch's groups. A shape this module
 * has no plan for is refused by name: a write to several collections, a write outside a sorted batch, a key the call
 * data does not resolve, a value type that chunks. Nothing here guesses at an ordinal the body does not read.
 */

import { bigIntToVmNumber, hexToBin } from '@bitauth/libauth';
import {
  INDEX_NONE,
  VALUE_INLINE_LIMIT,
  buildEntryNftCovenantScript,
  bytesEqual,
  bytesToHex,
  computeCollectionHash,
  scriptToBytecode,
  type AbiFunction,
  type Artifact,
  type StateValue,
} from '@solidcash/utils';
import {
  encodeFunctionArgument, isSignatureTemplateArray,
  type ConstructorArgument, type FunctionArgument, type SignatureTemplateArgument,
} from '../../Argument.js';
import type { Utxo } from '../../interfaces.js';
import { bytesToSlotValue, decodeEntryCommitment, keyToSlotMulti } from '../../stateful/SortedList.js';
import { evalComputedKey } from '../../stateful/route-expression-key.js';
import { createUnlockingBytecode } from '../../utils.js';
import type { DraftInput, DraftRecordEntry, DraftSourceOutput, DraftToken } from '../composer/draft.js';
import { planMappingBatch, type MappingBatchPlan, type MappingNodePlacement } from '../composer/mapping-plan.js';
import { entryRecordLockingBytecode, entryRecordReadUnlock } from '../deploy/records.js';

/** Raised when a call's mapping records cannot be planned from the artifact and the deployment. */
export class PerCallCallRecordError extends Error {
  public readonly name = 'PerCallCallRecordError';

  public constructor(message: string) {
    super(message);
  }
}

/** The deployment facts and call data one entry's mapping records are planned from. */
export interface CallEntryRecordsRequest {
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly args: readonly FunctionArgument[];
  /** The frame's caller lock, which a `msg.sender` key resolves to. */
  readonly callerLockingBytecode: Uint8Array;
  /** The deployed category, as hex: the records' covenant and the token every node carries derive from it. */
  readonly categoryId: string;
  /** Each sorted collection's live nodes, as the deployment's own classification reports them. */
  readonly nodesByCollection: ReadonlyMap<string, readonly Utxo[]>;
}

/** The coordinates and values one segment's mapping records need. */
export interface CallEntryRecordsContext {
  /** The first trailing output index, where a created node sits. */
  readonly createdBase: number;
  /** The frame's own input index, which a node's spend authorizes itself by. */
  readonly masterIndex: number;
  /** The satoshi value a created node output carries. */
  readonly recordAmount: bigint;
  /**
   * The end commitment learned for each value-dependent node, in `learningCandidates` order.
   *
   * A node whose end commitment carries a value the body computes cannot be stated in advance, so the plan starts
   * from a structural candidate — the node's own slot and successor with a placeholder tail — and the derivation
   * replaces it with the value the body's close hands back. An entry that is still a candidate is the plan's.
   */
  readonly learnedViews: readonly (Uint8Array | undefined)[];
  /** The input index of a participant id the layout placed. */
  indexOf(id: string): number;
}

/** The records an entry's mapping writes contribute to a call. */
export interface LaidCallEntryRecords {
  /** The records to declare after the frame's own state records, in the order the body's group walk reads them. */
  readonly entries: readonly DraftRecordEntry[];
  /** The spent nodes' inputs, recreated from the learned declaration chain. */
  readonly inputs: Readonly<Record<string, DraftInput>>;
  /** One output per created node, at the index its declaration names. */
  readonly trailingOutputs: readonly DraftSourceOutput[];
  /** The output index of each created node, in created order, which a validator settles. */
  readonly createdOutputs: readonly number[];
  /** The structural candidate each value-dependent node's declaration starts from, in learning order. */
  readonly learningCandidates: readonly Uint8Array[];
}

/** The mapping records one entry reads or writes, with the ids its plan places. */
export interface CallEntryRecords {
  /** The collection the entry's batch writes, or the first one it reads when it writes none. */
  readonly collection: string;
  /** The participant ids the frame's block holds for the nodes the entry spends, in declaration order. */
  readonly participantIds: readonly string[];
  /** The live UTXO of each spent node, keyed by the participant id the frame places it under. */
  readonly spentUtxos: ReadonlyMap<string, Utxo>;
  lay(context: CallEntryRecordsContext): LaidCallEntryRecords;
}

/**
 * The data-NFT indices of the records a frame running an entry declares, in the order its code reads them: the ones
 * its published block layout names. An entry that writes a verified mapping declares every other record after them,
 * because its batch's groups follow every data record. An entry that publishes no layout declares every record.
 */
export function frameDataRecordIndices(artifact: Artifact, functionName: string): number[] {
  const entry = artifact.abi.find((candidate) => candidate.name === functionName);
  const all = Array.from({ length: artifact.stateLayout?.dataNftCount ?? 0 }, (_unused, nftIndex) => nftIndex);
  const slots = entry?.blockLayout?.slots;
  if (slots === undefined) return all;
  const named = [...slots]
    .filter((slot) => slot.kind === 'dataNft' && slot.nftIndex !== undefined)
    .sort((left, right) => left.offset - right.offset)
    .map((slot) => slot.nftIndex!);
  if ((entry?.sortedBatchInfo ?? []).length === 0) return named;
  return [...named, ...all.filter((nftIndex) => !named.includes(nftIndex))];
}

/** The participant id a spent mapping node is placed under, keyed by its slot so the live UTXO is findable again. */
export function mappingNodeParticipantId(slot: Uint8Array): string {
  return `mapping-node-${bytesToHex(slot)}`;
}

/** The entry's visible inputs, which a key label can be resolved against. */
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

/** One sorted batch an entry performs, planned against the collection's live inventory. */
interface CallMappingBatch {
  readonly collection: string;
  readonly signature: string;
  readonly plan: MappingBatchPlan;
  /** The live UTXO of each held node, by slot: a spent node's input sits on it and keeps the value it holds. */
  readonly utxoBySlot: ReadonlyMap<string, Utxo>;
  /** True when the plan states every node's end view itself, so the body's close has none to hand back. */
  readonly statedValue?: boolean;
  /**
   * True when the plan's writes are a run-time loop's turns.
   *
   * The loop's own body mints one node per turn - the target of an update, or a predecessor and its new node for an
   * insert - and chains inserts in one gap by re-pointing the node it created the turn before, so each node is
   * written once, in mint order. That is the plan's `written` list, while a verified batch declares its writes per
   * target (`groups`), a target's predecessor standing again for every insert in its gap.
   */
  readonly loopWritten?: boolean;
}

/** The expression labels an artifact publishes for the frame's own caller. */
const CALLER_KEY_LABELS = new Set(['nullop:msg.sender', 'sender:msg.sender', 'call:_msgSender()', 'nullop:tx.origin']);

/** The frame's own facts a mapping access's key(s) are resolved from. */
interface KeyResolutionContext {
  readonly functionName: string;
  readonly args: readonly FunctionArgument[];
  readonly callerLockingBytecode: Uint8Array;
  /**
   * The state the frame reads, when the caller holds a decoded view of it.
   *
   * A key the artifact publishes as a state read — `state:<name>`, or a dynamic array's length — is the frame's own
   * on-chain value, so a caller that has read the deployment hands that view over and the key resolves against it.
   */
  readonly state?: Readonly<Record<string, StateValue>>;
}

/** Resolves one access's key(s) from the frame's own arguments, its sender, or a compile-time expression. */
function resolveKeys(
  request: KeyResolutionContext,
  fn: AbiFunction,
  access: NonNullable<AbiFunction['entryAccesses']>[number],
  structs: Artifact['structs'],
): readonly Uint8Array[] {
  const args = [...request.args];
  const visible = visibleInputs(fn);
  return access.keyParams.map((_param, index): Uint8Array => {
    const source = access.keySources?.[index];
    if (source?.kind === 'msgSender') return request.callerLockingBytecode;
    const label = source?.expressionLabel ?? source?.paramName ?? access.keyParams[index];
    // An artifact may publish the caller as an expression label rather than as a source kind. A root frame's
    // sender and its transaction origin are the same user, which is the coin the call spends.
    if (label !== undefined && CALLER_KEY_LABELS.has(label)) return request.callerLockingBytecode;
    const evaluated = evalComputedKey(label, args, visible, undefined, undefined);
    if (evaluated !== undefined) return evaluated;
    const byName = encodedArgument(fn, args, label ?? '', structs);
    if (byName !== undefined) return byName;
    throw new PerCallCallRecordError(
      `entry "${request.functionName}" touches mapping "${access.collection}" at a key the frame's arguments do `
      + `not determine (${label ?? '<unnamed>'})`,
    );
  });
}

/** One turn of a write loop the entry's own source runs: its index and the keys it writes under. */
export interface CallLoopWriteTurn {
  /** The position in the array the frame evaluates, which is the order the body walks the keys. */
  readonly turn: number;
  /** The element's index in the array the caller handed the entry. */
  readonly source: number;
  readonly keys: readonly Uint8Array[];
}

/** One run-time loop in which the entry's source writes a collection, with the turns its own arguments fix. */
export interface CallLoopWritePlan {
  readonly collection: string;
  /** The write the loop performs, as the artifact publishes it: `set` for an assignment, `delete` for a removal. */
  readonly op: string;
  /** The array parameter whose elements the loop walks, one turn per element. */
  readonly varyingArrayParam: string;
  /** The parameter the stored value comes from, or the empty string for a loop with no value. */
  readonly valueScalarParam: string;
  /**
   * True when every turn stores the same value, so the caller's key array is reordered into slot order.
   *
   * The artifact publishes such a value as a literal or a scalar parameter; a per-key value source (a value array,
   * a runtime local or an accumulation) leaves this false and the array in the caller's own order.
   */
  readonly invariantValue: boolean;
  /**
   * The element each walk position reads, by its index in the caller's array: the permutation `orderLoopKeyArgs`
   * hands the frame. It is the identity unless the keys are reordered into the slot order the body's chain walks.
   */
  readonly arrayOrder: readonly number[];
  /** The literal the loop stores under every key, when the artifact publishes one. */
  readonly valueBool?: boolean;
  readonly valueConst?: string;
  readonly turns: readonly CallLoopWriteTurn[];
}

/** One key of an access, as the label the artifact publishes for it. */
function keyLabel(access: NonNullable<AbiFunction['entryAccesses']>[number], index: number): string {
  return access.keySources?.[index]?.expressionLabel ?? access.keyParams[index]!;
}

/**
 * The run-time loops the entry's own source writes a collection in, with each turn's keys resolved.
 *
 * `sortedUpsertLoopInfo` is the artifact's own statement of the shape: the collection, the array whose elements the
 * loop walks (`varyingArrayParam`), the parameter the value comes from (`valueScalarParam`) and the operation. The
 * loop's accesses name each key as a label whose operands include the loop's counter, so a turn's key is that label
 * with the counter replaced by the turn's index - the same substitution the read path's paged planning makes
 * (`pagedKeyAt` in `read.ts`) - and the turns are the array's own length, since the loop the artifact publishes runs
 * over that array. A loop whose array the frame's arguments do not carry as an array, or whose key names no counter
 * to walk it with, is refused by name rather than guessed at.
 */
export function planCallLoopWrites(
  request: KeyResolutionContext & { readonly artifact: Artifact },
): readonly CallLoopWritePlan[] | undefined {
  const fn = request.artifact.abi.find((candidate) => candidate.name === request.functionName);
  const infos = fn?.sortedUpsertLoopInfo ?? [];
  if (fn === undefined || infos.length === 0) return undefined;
  const visible = visibleInputs(fn);
  const args = [...request.args];
  return infos.map((info): CallLoopWritePlan => {
    const arrayName = info.varyingArrayParam;
    const accesses = (fn.entryAccesses ?? []).filter((access) => access.collection === info.collection);
    const marked = accesses.flatMap((access) => access.keyParams.map((_param, index) => ({
      access, label: keyLabel(access, index),
    }))).filter((key) => key.label.includes(`id:${arrayName}`));
    const varying = marked.find((key) => key.label.includes(`arridx(id:${arrayName},`));
    if (varying === undefined) {
      throw new PerCallCallRecordError(
        `entry "${request.functionName}" writes mapping "${info.collection}" in a run-time loop over "${arrayName}", `
        + 'whose key the artifact does not publish as an element of that array',
      );
    }
    const operands = [...varying.label.matchAll(/id:([A-Za-z_$][\w$]*)/g)].map((match) => match[1]!);
    const counter = operands.find((name) => name !== arrayName);
    if (counter === undefined) {
      throw new PerCallCallRecordError(
        `entry "${request.functionName}" writes mapping "${info.collection}" in a run-time loop whose key names no `
        + 'counter to walk it with',
      );
    }
    const arrayIndex = visible.findIndex((input) => input.name === arrayName);
    const elements = arrayIndex < 0 ? undefined : args[arrayIndex];
    if (!Array.isArray(elements)) {
      throw new PerCallCallRecordError(
        `entry "${request.functionName}" writes mapping "${info.collection}" in a run-time loop over "${arrayName}", `
        + "which the frame's arguments do not carry as an array",
      );
    }
    const escaped = counter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`id:${escaped}(?![\\w$])`, 'g');
    const labels = varying.access.keyParams.map((_param, index) => keyLabel(varying.access, index));
    const structs = request.artifact.structs ?? request.artifact.stateLayout?.structs;
    const derived = elements.map((_element, source): { source: number; keys: readonly Uint8Array[] } => ({
      source,
      keys: labels.map((label): Uint8Array => {
        const resolved = evalComputedKey(
          label.replace(pattern, `lit:${source}`), args, visible, request.state, undefined);
        if (resolved !== undefined) return resolved;
        // A key the loop's own turn does not vary is published as the bare parameter it takes, which the frame's
        // arguments carry directly, exactly as a batch's target key is resolved by its declared name.
        const byName = encodedArgument(fn, args, label, structs);
        if (byName !== undefined) return byName;
        throw new PerCallCallRecordError(
          `entry "${request.functionName}" writes mapping "${info.collection}" at turn ${source} of "${arrayName}" `
          + `under a key the frame's arguments do not determine (${label})`,
        );
      }),
    }));
    // The emitted body chains a turn's insert in the gap its pending predecessor opened, so it reaches the node it
    // created only while each turn's key sits above the one before it: the turn below the pending takes the body's
    // normal path and co-spends the predecessor of the chain the plan built.
    //
    // One value stored under every key makes the write order unobservable, so the array is put in the slot order the
    // body's chain walks and the turns follow it (`orderLoopKeyArgs` hands the frame that exact array). A loop whose
    // value comes per key keeps the caller's order - its array is not this lane's to permute - and a key below the
    // turn before it is refused by name, because the body cannot walk that array.
    const invariantValue = info.valueBool !== undefined || info.valueConst !== undefined
      || (info.valueScalarParam ?? '') !== '';
    const ordered = invariantValue
      ? [...derived].sort((left, right) => {
        const leftSlot = bytesToSlotValue(keyToSlotMulti([...left.keys]));
        const rightSlot = bytesToSlotValue(keyToSlotMulti([...right.keys]));
        return leftSlot === rightSlot ? left.source - right.source : leftSlot < rightSlot ? -1 : 1;
      })
      : derived;
    let previous: bigint | undefined;
    for (const entry of ordered) {
      const value = bytesToSlotValue(keyToSlotMulti([...entry.keys]));
      if (previous !== undefined && value < previous) {
        throw new PerCallCallRecordError(
          `entry "${request.functionName}" writes mapping "${info.collection}" at turn ${entry.source} of `
          + `"${arrayName}" under a key that does not sit above the turn before it, and a loop whose value comes `
          + 'per key keeps the caller\'s order, which the run-time loop can insert through only when it ascends',
        );
      }
      previous = value;
    }
    const turns: CallLoopWriteTurn[] = ordered.map((entry, turn) => ({ ...entry, turn }));
    return {
      collection: info.collection,
      op: (info as { readonly op?: string }).op ?? 'set',
      varyingArrayParam: arrayName,
      valueScalarParam: info.valueScalarParam ?? '',
      invariantValue,
      arrayOrder: turns.map((turn) => turn.source),
      ...(info.valueBool === undefined ? {} : { valueBool: info.valueBool }),
      ...(info.valueConst === undefined ? {} : { valueConst: info.valueConst }),
      turns,
    };
  });
}

/**
 * The arguments a per-call call must carry, with each run-time loop's key array in the order the body walks it.
 *
 * The plan declares the loop's per-turn nodes in the collection's slot order, and the emitted body builds its chain
 * by linking each turn's node to the next turn's key. The two agree only while the keys arrive ascending, so an
 * array that descends would plan a chain the body cannot walk: its first turn relinks the predecessor to the first
 * key, and no later turn can put a lower key below that relink.
 *
 * The array is therefore reordered into slot order, the license the direct convention's insert loop takes for the
 * same shape (`loadCreateBuilderSortedInsertLoops`: "Reorder the invariant-value key array itself so source-loop
 * evaluation follows that same order"). It is semantics-preserving exactly where the artifact publishes the loop's
 * value as one literal or one scalar parameter - every iteration stores the same value under its key, so the final
 * mapping is the same whatever order the writes run in. A loop whose value comes per key (a value array, a runtime
 * local or an accumulation) keeps the caller's order: its array is not this function's to permute.
 *
 * A shape `planCallLoopWrites` refuses is left exactly as the caller passed it, so the refusal is raised where the
 * call plans its records rather than here.
 */
export function orderLoopKeyArgs(
  request: KeyResolutionContext & { readonly artifact: Artifact },
): readonly FunctionArgument[] {
  const args = [...request.args];
  const fn = request.artifact.abi.find((candidate) => candidate.name === request.functionName);
  if (fn === undefined) return args;
  let plans: readonly CallLoopWritePlan[] | undefined;
  try {
    plans = planCallLoopWrites({ ...request, args });
  } catch {
    return args;
  }
  const visible = visibleInputs(fn);
  for (const plan of plans ?? []) {
    if (plan.arrayOrder.every((source, position) => source === position)) continue;
    const arrayIndex = visible.findIndex((input) => input.name === plan.varyingArrayParam);
    const elements = arrayIndex < 0 ? undefined : args[arrayIndex];
    if (!Array.isArray(elements)) continue;
    args[arrayIndex] = reorderedArguments(elements, plan.arrayOrder);
  }
  return args;
}

/**
 * The same elements in `order`, which is a permutation of their positions.
 *
 * A permutation does not change what an element is, so the array is rebuilt at the argument family it was given:
 * a list of signature templates stays one and a list of constructor values stays one. The two families are not
 * interchangeable, so which one the array holds is read from the array itself rather than assumed, and nothing
 * here converts between them.
 */
function reorderedArguments(
  elements: readonly FunctionArgument[], order: readonly number[],
): SignatureTemplateArgument | ConstructorArgument {
  const reordered = order.map((source) => elements[source]!);
  return isSignatureTemplateArray(reordered)
    ? reordered
    // Not every element is a signature template, so the array is the constructor-value family the builder gave.
    : (reordered as ConstructorArgument[]);
}

/** The live mapping node one access names: the collection it belongs to and the UTXO carrying it. */
export interface ReadEntryNode {
  readonly collection: string;
  readonly signature: string;
  readonly slot: Uint8Array;
  /** True when the node's slot is the key's, so the body reads its value; false for a bracketing predecessor. */
  readonly present: boolean;
  readonly commitment: Uint8Array;
  readonly utxo: Utxo;
}

/**
 * The live node the entry's mapping access at `slotIndex` reads.
 *
 * The node the key names is the one whose slot equals the key's hash; a key no node holds is read against the node
 * the key would be spliced beside, the greatest slot below the key's, whose successor brackets it. The nodes come
 * from the deployment's own classification (`nodesByCollection`), so no second classifier is built here, and a key
 * neither present nor bracketed is refused by name.
 */
export function readEntryNode(request: KeyResolutionContext & {
  readonly artifact: Artifact;
  readonly categoryId: string;
  readonly nodesByCollection: ReadonlyMap<string, readonly Utxo[]>;
  readonly slotIndex: number;
}): ReadEntryNode {
  const fn = request.artifact.abi.find((candidate) => candidate.name === request.functionName);
  if (fn === undefined) {
    throw new PerCallCallRecordError(
      `artifact "${request.artifact.contractName}" publishes no entry "${request.functionName}"`,
    );
  }
  const access = fn.entryAccesses?.find((candidate) => candidate.slotIndex === request.slotIndex);
  if (access === undefined) {
    throw new PerCallCallRecordError(
      `entry "${request.functionName}" publishes no mapping access at entry slot ${request.slotIndex}`,
    );
  }
  const collection = request.artifact.stateLayout?.collections
    ?.find((candidate) => candidate.name === access.collection);
  if (collection === undefined) {
    throw new PerCallCallRecordError(
      `entry "${request.functionName}" reads mapping "${access.collection}", which the artifact does not publish `
      + 'as a collection',
    );
  }
  const structs = request.artifact.structs ?? request.artifact.stateLayout?.structs;
  const slot = keyToSlotMulti([...resolveKeys(request, fn, access, structs)]);
  const nodes = (request.nodesByCollection.get(collection.name) ?? []).map((utxo) => {
    const commitment = utxo.token?.nft?.commitment;
    if (commitment === undefined) {
      throw new PerCallCallRecordError(
        `category ${request.categoryId} holds a node of collection "${collection.name}" with no commitment`,
      );
    }
    return { utxo, commitment: new Uint8Array(hexToBin(commitment)) };
  });
  const found = nodes.find((node) => bytesEqual(decodeEntryCommitment(node.commitment).slot, slot));
  // A key no node holds is read against its bracketing predecessor, so the body can prove the key absent.
  const node = found ?? nodes.reduce<typeof nodes[number] | undefined>((best, candidate) => {
    if (bytesToSlotValue(decodeEntryCommitment(candidate.commitment).slot) >= bytesToSlotValue(slot)) return best;
    if (best === undefined) return candidate;
    return bytesToSlotValue(decodeEntryCommitment(candidate.commitment).slot)
      > bytesToSlotValue(decodeEntryCommitment(best.commitment).slot) ? candidate : best;
  }, undefined);
  if (node === undefined) {
    throw new PerCallCallRecordError(
      `category ${request.categoryId} holds no node of collection "${collection.name}" whose slot is the key's `
      + 'or the key\'s bracketing predecessor, so the read cannot locate what it reads',
    );
  }
  return {
    collection: collection.name,
    signature: collection.signature,
    slot,
    present: found !== undefined,
    commitment: node.commitment,
    utxo: node.utxo,
  };
}

/** The writes one entry performs to its one sorted collection, in the batch's target order. */
function planCallMappingBatch(
  request: CallEntryRecordsRequest,
  loop?: CallLoopWritePlan,
): CallMappingBatch | undefined {
  const fn = request.artifact.abi.find((candidate) => candidate.name === request.functionName);
  if (fn === undefined) return undefined;
  const accesses = fn.entryAccesses ?? [];
  const batches = fn.sortedBatchInfo ?? [];
  if (loop === undefined) {
    if (accesses.length === 0) return undefined;
    if (batches.length !== 1) {
      throw new PerCallCallRecordError(
        `entry "${request.functionName}" touches ${accesses.length} mapping entry(ies) across ${batches.length} `
        + 'sorted batch(es), and a call declares one collection\'s writes',
      );
    }
  }
  const batch = batches[0];
  const collectionName = loop?.collection ?? batch!.collection;
  const collection = request.artifact.stateLayout?.collections
    ?.find((candidate) => candidate.name === collectionName);
  if (collection === undefined || collection.sorted !== true) {
    throw new PerCallCallRecordError(
      `entry "${request.functionName}" writes mapping "${collectionName}", which the artifact does not publish `
      + 'as a sorted collection',
    );
  }
  // A key the entry only reads beside the batch is a kept node of its own, planned by `planReadNodes`.
  if (loop === undefined
    && batch!.slotIndices.some((slotIndex) => !accesses.some((access) => access.slotIndex === slotIndex))) {
    throw new PerCallCallRecordError(
      `entry "${request.functionName}"'s sorted batch names a slot its entry accesses do not describe`,
    );
  }
  if (collection.chunkableValue === true) {
    throw new PerCallCallRecordError(
      `entry "${request.functionName}" writes mapping "${collection.name}", whose values chunk, so the created `
      + 'node\'s run of chunk records cannot be declared from the call alone',
    );
  }
  const structs = request.artifact.structs ?? request.artifact.stateLayout?.structs;
  const inventory: Uint8Array[] = [];
  const utxoBySlot = new Map<string, Utxo>();
  for (const node of request.nodesByCollection.get(collection.name) ?? []) {
    const commitment = node.token?.nft?.commitment;
    if (commitment === undefined) {
      throw new PerCallCallRecordError(
        `category ${request.categoryId} holds a mapping node of "${collection.name}" with no commitment`,
      );
    }
    const bytes = new Uint8Array(hexToBin(commitment));
    inventory.push(bytes);
    utxoBySlot.set(bytesToHex(decodeEntryCommitment(bytes).slot), node);
  }
  // A literal value is stated rather than learned, so the loop's declarations carry their end views directly.
  const stated = loop !== undefined && (loop.valueBool !== undefined || loop.valueConst !== undefined);
  const storedValue = (): Uint8Array => {
    if (loop?.valueBool !== undefined) return loop.valueBool ? new Uint8Array([1]) : new Uint8Array(0);
    if (loop?.valueConst !== undefined) return bigIntToVmNumber(BigInt(loop.valueConst));
    return new Uint8Array(1);
  };
  // One target's write, the value a batch plans with a one-byte placeholder: only the plan's structure depends on it.
  const targetWrite = (slotIndex: number): { keys: Uint8Array[]; value: Uint8Array } => {
    const access = accesses.find((candidate) => candidate.slotIndex === slotIndex)!;
    const operations = access.operations;
    const changes = operations.filter((operation) => operation !== 'read');
    if (changes.length !== 1 || changes[0] !== 'write') {
      throw new PerCallCallRecordError(
        `entry "${request.functionName}" touches mapping "${access.collection}" as ${operations.join('/')}, and a `
        + 'call plans one write per target',
      );
    }
    return { keys: [...resolveKeys(request, fn, access, structs)], value: new Uint8Array(1) };
  };
  const writes = loop !== undefined
    ? loop.turns.map((turn) => ({ keys: [...turn.keys], value: storedValue() }))
    : batch!.slotIndices.map((slotIndex) => targetWrite(slotIndex));
  // The value is the body's to compute, so a one-byte placeholder fixes only the plan's structure: the slots, the
  // successor links and which targets are inserts. Every commitment that depends on the value is left unstated and
  // learned from the body's own close.
  return {
    collection: collection.name,
    signature: collection.signature,
    plan: planMappingBatch({ writes, inventory, encodeValue: (encoded: Uint8Array) => encoded }),
    utxoBySlot,
    ...(stated ? { statedValue: true } : {}),
    ...(loop === undefined ? {} : { loopWritten: true }),
  };
}

/** The token a mapping node carries: a mutable NFT of the contract's category. */
function nodeToken(category: Uint8Array, commitment: Uint8Array): DraftToken {
  return { category, amount: 0n, nft: { capability: 'mutable', commitment } };
}

/** A node an entry reads and does not write, under the participant id its frame places it at. */
interface ReadNode extends ReadEntryNode {
  readonly id: string;
}

/**
 * The nodes an entry reads and does not write: one kept record per fixed entry slot no batch writes.
 *
 * The body reads such a node at a fixed coordinate past the frame's data records, in the order the block layout
 * lists the entry's slots, and beside a batch ahead of its groups, so the nodes are placed in that order. Each is
 * spent on the entry covenant's read-only path, which recreates it in place, and is declared kept in every segment.
 */
function planReadNodes(
  request: CallEntryRecordsRequest,
  fn: AbiFunction,
  coveredCollection?: string,
): readonly ReadNode[] {
  const batched = new Set((fn.sortedBatchInfo ?? []).flatMap((batch) => batch.slotIndices));
  const reads = (fn.entryAccesses ?? [])
    .filter((access) => access.slotIndex === undefined || !batched.has(access.slotIndex))
    .filter((access) => access.collection !== coveredCollection);
  const written = reads.find((access) => access.operations.some((operation) => operation !== 'read'));
  if (written !== undefined) {
    // A write the artifact publishes as a run-time loop over an array has its turns derived here, so the refusal
    // names what that shape needs - how many turns of which array - rather than only what this plan cannot do.
    const loop = planCallLoopWrites(request)
      ?.find((candidate) => candidate.collection === written.collection);
    if (loop !== undefined) {
      throw new PerCallCallRecordError(
        `entry "${request.functionName}" writes mapping "${written.collection}" at ${loop.turns.length} turn(s) of `
        + `"${loop.varyingArrayParam}", a run-time loop whose per-turn records a call does not declare yet`,
      );
    }
    throw new PerCallCallRecordError(
      `entry "${request.functionName}" touches mapping "${written.collection}" as ${written.operations.join('/')} `
      + 'outside a sorted batch, which a call does not plan',
    );
  }
  const coveredSlots = new Set((fn.entryAccesses ?? [])
    .filter((access) => access.collection === coveredCollection)
    .map((access) => access.slotIndex));
  const slots = (fn.blockLayout?.slots ?? [])
    .filter((slot) => slot.kind === 'entry' && slot.slotIndex !== undefined && !batched.has(slot.slotIndex))
    .filter((slot) => !coveredSlots.has(slot.slotIndex))
    .sort((left, right) => left.offset - right.offset);
  if (reads.some((access) => !slots.some((slot) => slot.slotIndex === access.slotIndex))) {
    throw new PerCallCallRecordError(
      `entry "${request.functionName}" reads a mapping key at no fixed entry slot, which a call does not declare `
      + 'a node for',
    );
  }
  return slots.map((slot) => {
    const node = readEntryNode({ ...request, slotIndex: slot.slotIndex! });
    // A value past the inline limit holds only its hash in the node, with the bytes in chunk records a call does not
    // declare. A node read beside the key is never read for its value, so its width is free.
    const tail = node.commitment.slice(64);
    const length = tail.length < 4 ? 0 : new DataView(tail.buffer, tail.byteOffset, 4).getUint32(0, true);
    if (node.present && length > VALUE_INLINE_LIMIT) {
      throw new PerCallCallRecordError(
        `entry "${request.functionName}" reads a ${length}-byte value of mapping "${node.collection}" whose bytes sit `
        + 'in chunk records, which a call does not declare',
      );
    }
    // Two collections can hold the same slot, so the id names the collection too.
    return { ...node, id: `mapping-read-${node.collection}-${bytesToHex(node.slot)}` };
  });
}

/** The read nodes' kept declarations and their read-only spends. */
function layReadNodes(
  request: CallEntryRecordsRequest,
  nodes: readonly ReadNode[],
  context: CallEntryRecordsContext,
): { readonly entries: readonly DraftRecordEntry[]; readonly inputs: Readonly<Record<string, DraftInput>> } {
  const category = new Uint8Array(hexToBin(request.categoryId));
  const inputs: Record<string, DraftInput> = {};
  for (const node of nodes) {
    const { lockingBytecode, unlockingBytecode } = entryRecordReadUnlock(request.categoryId, node.signature);
    inputs[node.id] = {
      source: { lockingBytecode, valueSatoshis: node.utxo.satoshis, token: nodeToken(category, node.commitment) },
      unlockingBytecode,
    };
  }
  const entries = nodes.map((node): DraftRecordEntry => {
    const index = context.indexOf(node.id);
    return { in: index, out: index, viewIn: node.commitment, viewOut: node.commitment };
  });
  return { entries, inputs };
}

/** Refuses by name a node two of the entry's records would spend. */
function requireDistinctNodes(request: CallEntryRecordsRequest, utxos: readonly Utxo[]): void {
  const outpoints = utxos.map((utxo) => `${utxo.txid}:${utxo.vout}`);
  if (new Set(outpoints).size !== outpoints.length) {
    throw new PerCallCallRecordError(
      `entry "${request.functionName}" reads a key at a mapping node it also spends for another key, which a call `
      + 'cannot spend twice',
    );
  }
}

/**
 * Plans the mapping records an entry reads or writes, or `undefined` when it touches no sorted collection: the node
 * of each key it only reads, then its batch's groups.
 */
export function callEntryRecords(request: CallEntryRecordsRequest): CallEntryRecords | undefined {
  const fn = request.artifact.abi.find((candidate) => candidate.name === request.functionName);
  if (fn === undefined) return undefined;
  const loops = planCallLoopWrites(request) ?? [];
  const loop = loops.find((candidate) => (fn.entryAccesses ?? []).some((access) => access.collection
    === candidate.collection && access.operations.some((operation) => operation !== 'read')));
  const reads = planReadNodes(request, fn, loop?.collection);
  const batch = (fn.sortedBatchInfo ?? []).length > 0 || loop !== undefined
    ? planCallMappingBatch(request, loop)
    : undefined;
  if (batch === undefined) {
    if (reads.length === 0) return undefined;
    requireDistinctNodes(request, reads.map((node) => node.utxo));
    return {
      collection: reads[0]!.collection,
      participantIds: reads.map((node) => node.id),
      spentUtxos: new Map(reads.map((node) => [node.id, node.utxo])),
      lay: (context: CallEntryRecordsContext): LaidCallEntryRecords => ({
        ...layReadNodes(request, reads, context), trailingOutputs: [], createdOutputs: [], learningCandidates: [],
      }),
    };
  }
  const spent = batch.plan.written.filter((node) => node.existed);
  const created = batch.plan.written.filter((node) => !node.existed);
  const targetSlots = new Set(batch.plan.groups.map((group) => bytesToHex(group.slot)));
  const slotHex = (slot: Uint8Array): string => bytesToHex(slot);
  const spentUtxos = new Map<string, Utxo>();
  for (const node of spent) {
    const utxo = batch.utxoBySlot.get(slotHex(node.slot));
    if (utxo !== undefined) spentUtxos.set(mappingNodeParticipantId(node.slot), utxo);
  }
  requireDistinctNodes(request, [...reads.map((node) => node.utxo), ...spentUtxos.values()]);
  const lock = entryRecordLockingBytecode(request.categoryId, batch.signature);
  const covenant = scriptToBytecode(
    buildEntryNftCovenantScript(hexToBin(request.categoryId), computeCollectionHash(batch.signature)),
  );
  return {
    collection: batch.collection,
    // The nodes it only reads come first, so they sit past the frame's data records where its code reads them.
    participantIds: [...reads.map((node) => node.id), ...spent.map((node) => mappingNodeParticipantId(node.slot))],
    spentUtxos: new Map([...reads.map((node) => [node.id, node.utxo] as const), ...spentUtxos]),
    lay: (context: CallEntryRecordsContext): LaidCallEntryRecords => {
      const read = layReadNodes(request, reads, context);
      const placements = new Map<string, MappingNodePlacement>();
      for (const node of spent) {
        const index = context.indexOf(mappingNodeParticipantId(node.slot));
        placements.set(slotHex(node.slot), { in: index, out: index });
      }
      created.forEach((node, position) => {
        placements.set(slotHex(node.slot), { out: context.createdBase + position });
      });

      // A node the batch rewrites carries the value the body computes, so no caller can state its end commitment.
      // Its declaration starts from a structural candidate — the slot and successor the planner computed, with a
      // placeholder tail — which the body parses for the update/insert decision and then closes against, handing
      // back the value it computed. A predecessor the batch only relinks keeps its value, so its end view is stated.
      const entries: DraftRecordEntry[] = [];
      const learningCandidates: Uint8Array[] = [];
      const createdLearningIndex: number[] = [];
      // A batch writes each node once, in its final form, but a node that is both a target and another target's
      // relinked predecessor is declared once per group that names it. Every declaration of one node has to carry
      // the same final form: the first continues from the inventory view, a later one continues from, and leaves,
      // that final form. The final form is the value the body computes, learned at the node's first declaration.
      const finalLearning = new Map<string, number>();
      // A loop's turns write each node once, in the order its own body mints them, so its records are the plan's
      // written list; a verified batch declares a record per target group instead.
      const batchRecords = batch.loopWritten === true
        ? batch.plan.written.map((node) => ({
          slot: node.slot, existed: node.existed, viewIn: node.before, viewOut: node.after,
        }))
        : batch.plan.groups.flatMap((group) => group.records);
      for (const record of batchRecords) {
        const key = slotHex(record.slot);
        const placed = placements.get(key);
        const repeated = finalLearning.get(key);
        if (repeated !== undefined) {
          const final = context.learnedViews[repeated] ?? record.viewOut;
          const input = placed?.in ?? INDEX_NONE;
          entries.push({ in: input, out: placed?.out ?? input, viewIn: final, viewOut: final });
          continue;
        }
        const valueDependent = (!record.existed || targetSlots.has(key)) && batch.statedValue !== true;
        if (valueDependent) {
          const learningIndex = learningCandidates.length;
          learningCandidates.push(record.viewOut);
          finalLearning.set(key, learningIndex);
          if (!record.existed) createdLearningIndex.push(learningIndex);
          entries.push({
            in: record.existed ? placed?.in ?? INDEX_NONE : INDEX_NONE,
            out: placed?.out ?? (record.existed ? placed?.in ?? INDEX_NONE : INDEX_NONE),
            viewIn: record.viewIn,
            viewOut: context.learnedViews[learningIndex] ?? record.viewOut,
          });
        } else {
          const input = placed?.in ?? INDEX_NONE;
          entries.push({ in: input, out: placed?.out ?? input, viewIn: record.viewIn, viewOut: record.viewOut });
        }
      }

      const category = new Uint8Array(hexToBin(request.categoryId));
      const unlockingBytecode = createUnlockingBytecode('p2sh32', covenant, [
        encodeFunctionArgument(1n, 'bigint') as Uint8Array,
        encodeFunctionArgument(BigInt(context.masterIndex), 'bigint') as Uint8Array,
      ]);
      const inputs: Record<string, DraftInput> = {};
      for (const node of spent) {
        const utxo = batch.utxoBySlot.get(slotHex(node.slot));
        const source: DraftSourceOutput = {
          lockingBytecode: lock,
          valueSatoshis: utxo?.satoshis ?? context.recordAmount,
          token: nodeToken(category, node.before),
        };
        inputs[mappingNodeParticipantId(node.slot)] = { source, unlockingBytecode };
      }
      const trailingOutputs = created.map((node, position): DraftSourceOutput => ({
        lockingBytecode: lock,
        valueSatoshis: context.recordAmount,
        token: nodeToken(category, context.learnedViews[createdLearningIndex[position]!] ?? node.after),
      }));
      return {
        // The read nodes lead the batch's groups, which its code counts past them.
        entries: [...read.entries, ...entries],
        inputs: { ...read.inputs, ...inputs },
        trailingOutputs,
        createdOutputs: created.map((_node, position) => context.createdBase + position),
        learningCandidates,
      };
    },
  };
}
