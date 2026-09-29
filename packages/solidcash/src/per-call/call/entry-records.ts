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
 * A shape this module has no plan for is refused by name: a write to several collections, an access that is only a
 * read, a key the call data does not resolve, a value type that chunks. Nothing here guesses at an ordinal the body
 * does not read.
 */

import { hexToBin } from '@bitauth/libauth';
import {
  INDEX_NONE,
  buildEntryNftCovenantScript,
  bytesToHex,
  computeCollectionHash,
  scriptToBytecode,
  type AbiFunction,
  type Artifact,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../../Argument.js';
import type { Utxo } from '../../interfaces.js';
import { decodeEntryCommitment } from '../../stateful/SortedList.js';
import { evalComputedKey } from '../../stateful/route-expression-key.js';
import { createUnlockingBytecode } from '../../utils.js';
import type { DraftInput, DraftRecordEntry, DraftSourceOutput, DraftToken } from '../composer/draft.js';
import { planMappingBatch, type MappingBatchPlan, type MappingNodePlacement } from '../composer/mapping-plan.js';
import { entryRecordLockingBytecode } from '../deploy/records.js';

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

/** The mapping records one entry writes, with the ids its plan places. */
export interface CallEntryRecords {
  /** The collection the entry's batch writes. */
  readonly collection: string;
  /** The participant ids the frame's block holds for the nodes the entry spends, in declaration order. */
  readonly participantIds: readonly string[];
  /** The live UTXO of each spent node, keyed by the participant id the frame places it under. */
  readonly spentUtxos: ReadonlyMap<string, Utxo>;
  lay(context: CallEntryRecordsContext): LaidCallEntryRecords;
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
}

/** The expression labels an artifact publishes for the frame's own caller. */
const CALLER_KEY_LABELS = new Set(['nullop:msg.sender', 'sender:msg.sender', 'call:_msgSender()', 'nullop:tx.origin']);

/** Resolves one access's key(s) from the call's own arguments, its sender, or a compile-time expression. */
function resolveKeys(
  request: CallEntryRecordsRequest,
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
      `entry "${request.functionName}" writes mapping "${access.collection}" at a key the call's arguments do `
      + `not determine (${label ?? '<unnamed>'})`,
    );
  });
}

/** The writes one entry performs to its one sorted collection, in the batch's target order. */
function planCallMappingBatch(request: CallEntryRecordsRequest): CallMappingBatch | undefined {
  const fn = request.artifact.abi.find((candidate) => candidate.name === request.functionName);
  if (fn === undefined) return undefined;
  const accesses = fn.entryAccesses ?? [];
  const batches = fn.sortedBatchInfo ?? [];
  if (accesses.length === 0) return undefined;
  if (batches.length !== 1) {
    throw new PerCallCallRecordError(
      `entry "${request.functionName}" touches ${accesses.length} mapping entry(ies) across ${batches.length} `
      + 'sorted batch(es), and a call declares one collection\'s writes',
    );
  }
  const batch = batches[0]!;
  const collection = request.artifact.stateLayout?.collections
    ?.find((candidate) => candidate.name === batch.collection);
  if (collection === undefined || collection.sorted !== true) {
    throw new PerCallCallRecordError(
      `entry "${request.functionName}" writes mapping "${batch.collection}", which the artifact does not publish `
      + 'as a sorted collection',
    );
  }
  // Every access has to be one of the batch's targets: a key the entry only reads has no group of its own, so the
  // frame would have no ordinal to declare its node at.
  const slots = new Set(batch.slotIndices);
  if (accesses.length !== batch.slotIndices.length
    || accesses.some((access) => access.slotIndex === undefined || !slots.has(access.slotIndex))) {
    throw new PerCallCallRecordError(
      `entry "${request.functionName}" reads a mapping key outside the write batch it proves, which a call does `
      + 'not declare a node for',
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
  const writes = batch.slotIndices.map((slotIndex) => {
    const access = accesses.find((candidate) => candidate.slotIndex === slotIndex)!;
    const operations = access.operations;
    const writes = operations.filter((operation) => operation !== 'read');
    if (writes.length !== 1 || writes[0] !== 'write') {
      throw new PerCallCallRecordError(
        `entry "${request.functionName}" touches mapping "${access.collection}" as ${operations.join('/')}, and a `
        + 'call plans one write per target',
      );
    }
    return { keys: [...resolveKeys(request, fn, access, structs)], value: new Uint8Array(1) };
  });
  // The value is the body's to compute, so a one-byte placeholder fixes only the plan's structure: the slots, the
  // successor links and which targets are inserts. Every commitment that depends on the value is left unstated and
  // learned from the body's own close.
  return {
    collection: collection.name,
    signature: collection.signature,
    plan: planMappingBatch({ writes, inventory, encodeValue: (encoded: Uint8Array) => encoded }),
    utxoBySlot,
  };
}

/** The token a mapping node carries: a mutable NFT of the contract's category. */
function nodeToken(category: Uint8Array, commitment: Uint8Array): DraftToken {
  return { category, amount: 0n, nft: { capability: 'mutable', commitment } };
}

/** Plans the mapping records an entry writes, or `undefined` when it touches no sorted collection. */
export function callEntryRecords(request: CallEntryRecordsRequest): CallEntryRecords | undefined {
  const batch = planCallMappingBatch(request);
  if (batch === undefined) return undefined;
  const spent = batch.plan.written.filter((node) => node.existed);
  const created = batch.plan.written.filter((node) => !node.existed);
  const targetSlots = new Set(batch.plan.groups.map((group) => bytesToHex(group.slot)));
  const slotHex = (slot: Uint8Array): string => bytesToHex(slot);
  const spentUtxos = new Map<string, Utxo>();
  for (const node of spent) {
    const utxo = batch.utxoBySlot.get(slotHex(node.slot));
    if (utxo !== undefined) spentUtxos.set(mappingNodeParticipantId(node.slot), utxo);
  }
  const lock = entryRecordLockingBytecode(request.categoryId, batch.signature);
  const covenant = scriptToBytecode(
    buildEntryNftCovenantScript(hexToBin(request.categoryId), computeCollectionHash(batch.signature)),
  );
  return {
    collection: batch.collection,
    participantIds: spent.map((node) => mappingNodeParticipantId(node.slot)),
    spentUtxos,
    lay: (context: CallEntryRecordsContext): LaidCallEntryRecords => {
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
      for (const group of batch.plan.groups) {
        for (const record of group.records) {
          const placed = placements.get(slotHex(record.slot));
          const valueDependent = !record.existed || targetSlots.has(slotHex(record.slot));
          if (valueDependent) {
            const learningIndex = learningCandidates.length;
            learningCandidates.push(record.viewOut);
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
        entries,
        inputs,
        trailingOutputs,
        createdOutputs: created.map((_node, position) => context.createdBase + position),
        learningCandidates,
      };
    },
  };
}
