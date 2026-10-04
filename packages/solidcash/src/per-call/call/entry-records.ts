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
  collectionChunksValue,
  computeCollectionHash,
  parseArrayTypeString,
  scriptToBytecode,
  type AbiFunction,
  type Artifact,
  type PublishedWriteTurns,
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
  /** For a run of loops, the turn that mints each of `entries`, or undefined for a node the entry only reads. */
  readonly entryMints?: readonly (LoopRecordMint | undefined)[];
}

/** The mapping records one entry reads or writes, with the ids its plan places. */
export interface CallEntryRecords {
  /** The collection the entry's batch writes, or the first one it reads when it writes none. */
  readonly collection: string;
  /** The participant ids the frame's block holds for the nodes the entry spends, in declaration order. */
  readonly participantIds: readonly string[];
  /** The live UTXO of each spent node, keyed by the participant id the frame places it under. */
  readonly spentUtxos: ReadonlyMap<string, Utxo>;
  /** The run-time loops that write the collection, in the order the body runs them, when loops write it. */
  readonly loopRun?: readonly CallLoopWritePlan[];
  lay(context: CallEntryRecordsContext): LaidCallEntryRecords;
}

/**
 * The data-NFT indices of the records an entry's published block layout names, in that layout's order: its body
 * reads each one at its frame's record base plus the record's layout offset. An entry that publishes no layout names
 * every record.
 */
export function namedDataRecordIndices(artifact: Artifact, functionName: string): number[] {
  const slots = artifact.abi.find((candidate) => candidate.name === functionName)?.blockLayout?.slots;
  if (slots === undefined) {
    return Array.from({ length: artifact.stateLayout?.dataNftCount ?? 0 }, (_unused, nftIndex) => nftIndex);
  }
  return slots.filter((slot) => slot.kind === 'dataNft' && slot.nftIndex !== undefined)
    .sort((left, right) => left.offset - right.offset)
    .map((slot) => slot.nftIndex!);
}

/**
 * The data-NFT indices of the records a frame running an entry declares, in the order its code reads them: the ones
 * its published block layout names. An entry that writes a verified mapping declares every other record after them,
 * because its batch's groups follow every data record. An entry that publishes no layout declares every record.
 */
export function frameDataRecordIndices(artifact: Artifact, functionName: string): number[] {
  const entry = artifact.abi.find((candidate) => candidate.name === functionName);
  const named = namedDataRecordIndices(artifact, functionName);
  if (entry?.blockLayout?.slots === undefined || (entry.sortedBatchInfo ?? []).length === 0) return named;
  const all = Array.from({ length: artifact.stateLayout?.dataNftCount ?? 0 }, (_unused, nftIndex) => nftIndex);
  return [...named, ...all.filter((nftIndex) => !named.includes(nftIndex))];
}

/**
 * A contract block's state with the data records each of its frames names side by side, in that frame's own order.
 *
 * A frame reads each record its block layout names at its record base, which the first record it declares sets, plus
 * the record's layout offset, so the records it names must be adjacent inputs in that order. The order the frames
 * placed them in is kept when it serves every frame, since a frame also addresses what follows its records from that
 * base; otherwise the records lead the block in data-record order, ahead of its nodes. `named` holds each frame's
 * named record ids in its layout's order and `recordIndex` the data record each record id is; a frame that neither
 * order serves is handed to `refuse` by its position in `named`.
 */
export function adjacentRecordOrder(
  state: readonly string[],
  named: readonly (readonly string[])[],
  recordIndex: ReadonlyMap<string, number>,
  refuse: (frame: number) => never,
): readonly string[] {
  /** The first frame whose named records `order` leaves apart, or -1 when it serves every frame. */
  const splitIn = (order: readonly string[]): number => named.findIndex((ids) => {
    const first = ids.length === 0 ? -1 : order.indexOf(ids[0]!);
    return ids.some((id, at) => order[first + at] !== id);
  });
  if (splitIn(state) < 0) return state;
  const records = state.filter((id) => recordIndex.has(id))
    .sort((left, right) => recordIndex.get(left)! - recordIndex.get(right)!);
  const ordered = [...records, ...state.filter((id) => !recordIndex.has(id))];
  const split = splitIn(ordered);
  return split < 0 ? ordered : refuse(split);
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
  /** For a loop's turns, the turn that mints each record of `written`, in its order. */
  readonly loopMints?: readonly LoopRecordMint[];
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
  /**
   * The elements the frame's own writes append to a state array, by variable.
   *
   * A body that appends to a dynamic value and then keys a write by the value's length reads the length the append
   * produces rather than the one the segment started from, so a key published as `state:<array>.length` is counted
   * from the written value. The caller states the elements each write adds; absent leaves the key at the live length.
   */
  readonly stateLengthDeltas?: Readonly<Record<string, bigint>>;
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
    const evaluated = evalComputedKey(label, args, visible, request.state, request.stateLengthDeltas);
    if (evaluated !== undefined) return evaluated;
    const byName = encodedArgument(fn, args, label ?? '', structs);
    if (byName !== undefined) return byName;
    throw new PerCallCallRecordError(
      `entry "${request.functionName}" touches mapping "${access.collection}" at a key the frame's arguments do `
      + `not determine (${label ?? '<unnamed>'})`,
    );
  });
}

/** The slot one mapping access's key(s) hash to, resolved as `resolveKeys` resolves them, or undefined for none. */
export function accessKeySlot(
  request: KeyResolutionContext & { readonly artifact: Artifact },
  access: NonNullable<AbiFunction['entryAccesses']>[number],
): Uint8Array | undefined {
  const fn = request.artifact.abi.find((candidate) => candidate.name === request.functionName);
  if (fn === undefined) return undefined;
  const structs = request.artifact.structs ?? request.artifact.stateLayout?.structs;
  try {
    return keyToSlotMulti([...resolveKeys(request, fn, access, structs)]);
  } catch {
    return undefined;
  }
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
  /** The array whose elements select the turns (`if (flags[i] == 1)`), which walks in the key array's order. */
  readonly predicateArrayParam?: string;
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
    // The frame receives its own argument array through the shipped encoder, so an element whose type is an address
    // arrives as its locking bytecode. A label resolved against the caller's own spelling - a bare payload or a
    // CashAddress - would name a different key than the frame's body reads and writes.
    const elementType = parseArrayTypeString(visible[arrayIndex]?.type ?? '')?.elementType;
    const frameArgs: FunctionArgument[] = elementType !== undefined
      && /^address(\s+payable)?$/.test(elementType)
      ? args.map((argument, index): FunctionArgument => (index !== arrayIndex || !Array.isArray(argument)
        ? argument
        : argument.map((element): FunctionArgument => encodeFunctionArgument(
          element as FunctionArgument, elementType)) as unknown as ConstructorArgument))
      : [...args];
    const derived = elements.map((_element, source): { source: number; keys: readonly Uint8Array[] } => ({
      source,
      keys: labels.map((label): Uint8Array => {
        const resolved = evalComputedKey(
          label.replace(pattern, `lit:${source}`), frameArgs, visible, request.state, request.stateLengthDeltas);
        if (resolved !== undefined) return resolved;
        // A key the loop's own turn does not vary is published as the bare parameter it takes, which the frame's
        // arguments carry directly, exactly as a batch's target key is resolved by its declared name.
        const byName = encodedArgument(fn, frameArgs, label, structs);
        if (byName !== undefined) return byName;
        throw new PerCallCallRecordError(
          `entry "${request.functionName}" writes mapping "${info.collection}" at turn ${source} of "${arrayName}" `
          + `under a key the frame's arguments do not determine (${label})`,
        );
      }),
    }));
    // A guard on an array the call carries (`if (flags[i] == 1)`) selects the turns: the body walks every element
    // and writes only under those whose guard element equals the published literal.
    const selected = selectedTurns(request, info, visible, args, derived);
    // The emitted body chains a turn's insert in the gap its pending predecessor opened, so it reaches the node it
    // created only while each turn's key sits above the one before it: the turn below the pending takes the body's
    // normal path and co-spends the predecessor of the chain the plan built.
    //
    // One value stored under every key makes the write order unobservable, so the array is put in the slot order the
    // body's chain walks and the turns follow it (`orderLoopKeyArgs` hands the frame that exact array, the elements a
    // guard skips after them). A loop whose value comes per key keeps the caller's order - its array is not this
    // lane's to permute - and a key below the turn before it is refused by name, because the body cannot walk that
    // array. So does a loop whose turns make calls: they run in the array's order, which reordering would change.
    const invariantValue = info.valueBool !== undefined || info.valueConst !== undefined
      || (info.valueScalarParam ?? '') !== '';
    const calling = turnsOfLoop(request.artifact, request.functionName, info.collection, arrayName) !== undefined;
    if (calling && selected.length !== derived.length) {
      throw new PerCallCallRecordError(
        `entry "${request.functionName}" writes mapping "${info.collection}" in a run-time loop over "${arrayName}" `
        + 'whose turns make calls and whose guard skips an element, and a skipped turn\'s segments are not planned',
      );
    }
    const reordered = invariantValue && !calling;
    const ordered = reordered
      ? [...selected].sort((left, right) => {
        const leftSlot = bytesToSlotValue(keyToSlotMulti([...left.keys]));
        const rightSlot = bytesToSlotValue(keyToSlotMulti([...right.keys]));
        return leftSlot === rightSlot ? left.source - right.source : leftSlot < rightSlot ? -1 : 1;
      })
      : selected;
    let previous: bigint | undefined;
    for (const entry of ordered) {
      const value = bytesToSlotValue(keyToSlotMulti([...entry.keys]));
      if (previous !== undefined && value < previous) {
        throw new PerCallCallRecordError(
          `entry "${request.functionName}" writes mapping "${info.collection}" at turn ${entry.source} of `
          + `"${arrayName}" under a key that does not sit above the turn before it, and a loop whose value comes `
          + `per key${calling ? ' or whose turns make calls' : ''} keeps the caller's order, which the run-time loop `
          + 'can insert through only when it ascends',
        );
      }
      previous = value;
    }
    // A turn's position is where the frame's array holds its element: first in slot order when reordered, and the
    // caller's own index otherwise.
    const turns: CallLoopWriteTurn[] = ordered.map((entry, at) => ({ ...entry, turn: reordered ? at : entry.source }));
    const skipped = derived.filter((entry) => !selected.includes(entry));
    return {
      collection: info.collection,
      op: (info as { readonly op?: string }).op ?? 'set',
      varyingArrayParam: arrayName,
      valueScalarParam: info.valueScalarParam ?? '',
      invariantValue,
      arrayOrder: reordered ? [...ordered, ...skipped].map((entry) => entry.source) : derived.map((entry) => entry.source),
      ...(info.predicateArrayParam === undefined ? {} : { predicateArrayParam: info.predicateArrayParam }),
      ...(info.valueBool === undefined ? {} : { valueBool: info.valueBool }),
      ...(info.valueConst === undefined ? {} : { valueConst: info.valueConst }),
      turns,
    };
  });
}

/** An integer-valued argument element, or undefined for an element that is not one. */
function integerElement(element: unknown): bigint | undefined {
  if (typeof element === 'bigint') return element;
  if (typeof element === 'number' && Number.isInteger(element)) return BigInt(element);
  if (typeof element === 'boolean') return element ? 1n : 0n;
  return undefined;
}

/**
 * The turns a run-time loop's guard selects among the elements it walks.
 *
 * A loop the artifact publishes with `predicateArrayParam` writes only where that array's element at the turn's
 * index equals `predicateEquals`; every other loop writes at every element. The guard array is the call's own
 * argument, so the selection is fixed by the call data: an array shorter than the one the loop walks, or an element
 * that is not an integer, is refused by name, as the body itself fails reading past the guard's end.
 */
function selectedTurns<T extends { readonly source: number }>(
  request: KeyResolutionContext,
  info: NonNullable<AbiFunction['sortedUpsertLoopInfo']>[number],
  visible: AbiFunction['inputs'],
  args: readonly FunctionArgument[],
  derived: readonly T[],
): readonly T[] {
  const guardName = info.predicateArrayParam;
  if (guardName === undefined) return derived;
  const guardIndex = visible.findIndex((input) => input.name === guardName);
  const guard = guardIndex < 0 ? undefined : args[guardIndex];
  if (!Array.isArray(guard) || guard.length < derived.length) {
    throw new PerCallCallRecordError(
      `entry "${request.functionName}" writes mapping "${info.collection}" in a run-time loop over `
      + `"${info.varyingArrayParam}" guarded by "${guardName}", which the frame's arguments do not carry as an array `
      + 'as long as the one the loop walks',
    );
  }
  const equals = BigInt(info.predicateEquals ?? '0');
  return derived.filter((entry) => {
    const element = integerElement(guard[entry.source]);
    if (element === undefined) {
      throw new PerCallCallRecordError(
        `entry "${request.functionName}" writes mapping "${info.collection}" in a run-time loop guarded by `
        + `"${guardName}", whose element ${entry.source} is not an integer`,
      );
    }
    return element === equals;
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
 * local or an accumulation) keeps the caller's order: its array is not this function's to permute. A guard array
 * that selects the turns is permuted with the keys, so each element keeps the guard that selects it.
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
    const walked = [...new Set([plan.varyingArrayParam, plan.predicateArrayParam ?? plan.varyingArrayParam])];
    for (const name of walked) {
      const arrayIndex = visible.findIndex((input) => input.name === name);
      const elements = arrayIndex < 0 ? undefined : args[arrayIndex];
      if (!Array.isArray(elements)) continue;
      // A guard longer than the array the loop walks keeps its unread tail where it was.
      const tail = [...elements.keys()].filter((at) => !plan.arrayOrder.includes(at));
      args[arrayIndex] = reorderedArguments(elements, [...plan.arrayOrder, ...tail]);
    }
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

/** One loop write the artifact publishes per turn (`PublishedWriteSegment.turns`), with the calls before it. */
export interface PublishedLoopTurns extends PublishedWriteTurns {
  /** The calls a turn makes before its write. */
  readonly offset: number;
}

/** The loop writes an entry's artifact publishes per turn, in the order it lists them. */
export function publishedLoopTurns(artifact: Artifact, functionName: string): readonly PublishedLoopTurns[] {
  const identity = `${artifact.contractName}.${functionName}()`;
  const entry = artifact.composition?.stopSites?.entries.find((candidate) => candidate.functionName === identity);
  return (entry?.writeSegments ?? []).flatMap((write) => (write.turns === undefined || write.segment === 'last'
    ? [] : [{ ...write.turns, offset: write.segment }]));
}

/** The published turns of the loop that walks `array` writing `collection`, matched by the array its key names. */
function turnsOfLoop(
  artifact: Artifact, functionName: string, collection: string, array: string,
): PublishedLoopTurns | undefined {
  const accesses = artifact.abi.find((candidate) => candidate.name === functionName)?.entryAccesses ?? [];
  return publishedLoopTurns(artifact, functionName).find((turns) => turns.collection === collection
    && accesses.find((access) => access.slotIndex === turns.slot)?.keyParams
      .some((label) => label.includes(`arridx(id:${array},`)) === true);
}

/** Where one record of a run of loops is minted: a loop of the run, and a turn of it or its teardown. */
export interface LoopRecordMint {
  /** The loop's position in the run. */
  readonly loop: number;
  /** The turn whose write mints the record, or the loop's turn count for the record its teardown flushes. */
  readonly turn: number;
}

/**
 * The turn that mints each record a run of run-time loops writes, in the order the plan's `written` list holds them.
 *
 * The body defers each turn's node: an update is held until the next turn's write or the loop's teardown mints it,
 * and an insert mints its relinked predecessor at once and holds the new node. A turn whose key falls in the gap
 * the held node leaves re-points it instead of co-spending a predecessor. Every record of the run is minted once,
 * in the order of `written`, at the turn this names. Each loop of a run starts with nothing held, so a run whose
 * loops touch one node twice mints differently from the plan, and is refused by name.
 */
export function loopRecordMints(
  functionName: string,
  run: readonly CallLoopWritePlan[],
  written: readonly { readonly slot: Uint8Array; readonly existed: boolean; readonly before: Uint8Array }[],
): readonly LoopRecordMint[] {
  // Every node a turn co-spends - its target, or the predecessor its insert splices through - is one the plan writes.
  const nodes = written.filter((node) => node.existed).map((node) => decodeEntryCommitment(node.before));
  const value = (slot: Uint8Array): bigint => bytesToSlotValue(slot);
  const mints: (LoopRecordMint & { readonly slot: Uint8Array })[] = [];
  run.forEach((loop, index) => {
    let held: { slot: Uint8Array; next: Uint8Array } | undefined;
    loop.turns.forEach((turn, at) => {
      const slot = keyToSlotMulti([...turn.keys]);
      if (held !== undefined) {
        const next = value(held.next);
        const inGap = value(held.slot) < value(slot) && (next === 0n || value(slot) < next);
        mints.push({ loop: index, turn: at, slot: held.slot });
        if (inGap) {
          held = { slot, next: held.next };
          return;
        }
        held = undefined;
      }
      const node = nodes.find((candidate) => bytesEqual(candidate.slot, slot));
      if (node !== undefined) {
        held = { slot, next: node.nextKey };
        return;
      }
      const predecessor = nodes.filter((candidate) => value(candidate.slot) < value(slot))
        .sort((left, right) => (value(left.slot) < value(right.slot) ? 1 : -1))[0];
      if (predecessor === undefined) return;
      mints.push({ loop: index, turn: at, slot: predecessor.slot });
      held = { slot, next: predecessor.nextKey };
    });
    if (held !== undefined) mints.push({ loop: index, turn: loop.turns.length, slot: held.slot });
  });
  if (mints.length !== written.length || mints.some((mint, at) => !bytesEqual(mint.slot, written[at]!.slot))) {
    throw new PerCallCallRecordError(
      `entry "${functionName}" writes mapping "${run[0]?.collection ?? ''}" in ${run.length} run-time loop(s) whose `
      + 'turns touch one node twice, which one run of their records cannot declare',
    );
  }
  return mints.map(({ loop, turn }) => ({ loop, turn }));
}

/** The segments a frame declares one record of a loop run in: from the one its turn mints it in, to the run's last. */
export interface LoopRecordSpan {
  readonly least: number;
  readonly most: number;
}

/**
 * The segments each record of a run of loops is declared in, from the frame's own calls and the turns the artifact
 * publishes for each loop, or a refusal naming what the frame does not place.
 *
 * Turn `t` of a loop writes in the segment `t` strides past the frame position of its site's first call, plus the
 * calls a turn makes before the write, and its teardown runs `turns` strides past that position. A record is
 * declared from the segment that mints it to the run's last mint, so every turn's write finds the records before it
 * at the positions its own counters name, and a record's view changes in the one segment that wrote it.
 */
export function loopRecordSpans(options: {
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly run: readonly CallLoopWritePlan[];
  readonly mints: readonly LoopRecordMint[];
  /** For each published call site of the entry, the frame position of its first call, or -1 for none. */
  readonly callBases: readonly number[];
  readonly calls: number;
}): readonly LoopRecordSpan[] | string {
  const at: number[][] = [];
  for (const [index, loop] of options.run.entries()) {
    const turns = turnsOfLoop(options.artifact, options.functionName, loop.collection, loop.varyingArrayParam);
    at[index] = [];
    if (loop.turns.length === 0) continue;
    if (turns === undefined) {
      return `the run-time loop over "${loop.varyingArrayParam}" writes mapping "${loop.collection}" in a frame `
        + 'that makes calls, and the artifact publishes no segment for its turns';
    }
    const base = options.callBases[turns.site];
    if (base === undefined || base < 0) {
      return `the run-time loop over "${loop.varyingArrayParam}" makes no call at its site ${turns.site}`;
    }
    const segments = Array.from({ length: loop.turns.length + 1 }, (_unused, turn) => base + turn * turns.stride
      + (turn < loop.turns.length ? turns.offset : 0));
    if (segments.at(-1)! > options.calls) {
      return `the run-time loop over "${loop.varyingArrayParam}" ends in segment ${segments.at(-1)!}, which the `
        + `frame's ${options.calls + 1} segment(s) do not hold`;
    }
    at[index] = segments;
  }
  const least = options.mints.map((mint) => at[mint.loop]![mint.turn]!);
  const most = Math.max(0, ...least);
  return least.map((segment) => ({ least: segment, most }));
}

/**
 * Declares an entry's records across a frame's segments: each record in its laid order, as its span places it.
 *
 * Inside its span a record is declared as laid in the span's first segment and kept at the view it was written to
 * afterwards: a record the transaction creates is created once, and a later segment reads it at the output it was
 * created at. Outside its span a spent record is kept at the view before or after it, and a created one is left
 * out. A record without a span is declared as laid in every segment.
 */
export function placeRecordsBySpan(
  entries: readonly DraftRecordEntry[],
  spans: readonly (LoopRecordSpan | undefined)[],
  segmentCount: number,
): DraftRecordEntry[][] {
  return Array.from({ length: segmentCount }, (_unused, segment) => entries.flatMap((entry, index) => {
    const span = spans[index];
    if (span === undefined) return [entry];
    const viewIn = entry.viewIn;
    const viewOut = entry.viewOut ?? entry.viewIn;
    if (segment >= span.least && segment <= span.most) {
      const at = entry.in === INDEX_NONE ? entry.out : entry.in;
      return segment === span.least ? [entry] : [{ in: at, out: at, viewIn: viewOut, viewOut }];
    }
    if (entry.in === INDEX_NONE) return [];
    const view = segment < span.least ? viewIn : viewOut;
    return [{ in: entry.in, out: entry.in, viewIn: view, viewOut: view }];
  }));
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
  run?: readonly CallLoopWritePlan[],
): CallMappingBatch | undefined {
  // The loops that write one collection are one run of records, in the order the body runs them.
  const loop = run?.[0];
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
  const stated = run !== undefined && run.every((each) => each.valueBool !== undefined || each.valueConst !== undefined);
  const storedValue = (each: CallLoopWritePlan): Uint8Array => {
    if (each.valueBool !== undefined) return each.valueBool ? new Uint8Array([1]) : new Uint8Array(0);
    if (each.valueConst !== undefined) return bigIntToVmNumber(BigInt(each.valueConst));
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
  const writes = run !== undefined
    ? run.flatMap((each) => each.turns.map((turn) => ({ keys: [...turn.keys], value: storedValue(each) })))
    : batch!.slotIndices.map((slotIndex) => targetWrite(slotIndex));
  // The value is the body's to compute, so a one-byte placeholder fixes only the plan's structure: the slots, the
  // successor links and which targets are inserts. Every commitment that depends on the value is left unstated and
  // learned from the body's own close.
  const plan = planMappingBatch({ writes, inventory, encodeValue: (encoded: Uint8Array) => encoded });
  // Loops whose turns the artifact publishes are placed segment by segment, by the turn that mints each record.
  const turned = run !== undefined && publishedLoopTurns(request.artifact, request.functionName)
    .some((turns) => turns.collection === collection.name);
  return {
    collection: collection.name,
    signature: collection.signature,
    plan,
    utxoBySlot,
    ...(stated ? { statedValue: true } : {}),
    ...(run === undefined ? {} : { loopWritten: true }),
    ...(turned ? { loopMints: loopRecordMints(request.functionName, run, plan.written) } : {}),
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
    // declare. A node read beside the key is never read for its value, so its width is free. Only a collection whose
    // values chunk writes a length ahead of the value, so those bytes are one only where one is written.
    const tail = node.commitment.slice(64);
    const length = collectionChunksValue(request.artifact, node.collection) && tail.length >= 4
      ? new DataView(tail.buffer, tail.byteOffset, 4).getUint32(0, true) : 0;
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
  // Loops whose turns the artifact publishes write one run of records, every loop of the collection in turn.
  const turned = loop !== undefined && publishedLoopTurns(request.artifact, request.functionName)
    .some((turns) => turns.collection === loop.collection);
  const run = loop === undefined ? undefined
    : turned ? loops.filter((candidate) => candidate.collection === loop.collection) : [loop];
  const batch = (fn.sortedBatchInfo ?? []).length > 0 || run !== undefined
    ? planCallMappingBatch(request, run)
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
    ...(turned ? { loopRun: run } : {}),
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
        ...(batch.loopMints === undefined ? {} : {
          entryMints: [...read.entries.map(() => undefined), ...batch.loopMints],
        }),
      };
    },
  };
}
