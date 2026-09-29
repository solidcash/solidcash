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
 * A written node's commitment carries the value the body computed, which no caller can state in advance, so its
 * declaration starts from the structural candidate the shipped planner computed with a placeholder tail and the
 * derivation learns the value from the body's own close. A shape this module has no plan for — a write to several
 * collections, a delete, a value whose width the artifact does not state — is refused by the fact that is missing.
 */

import { hexToBin } from '@bitauth/libauth';
import {
  VALUE_INLINE_LIMIT,
  buildEntryNftCovenantScript,
  bytesEqual,
  bytesToHex,
  computeCollectionHash,
  scriptToBytecode,
  type AbiFunction,
  type Artifact,
  type RecordEntry,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../../Argument.js';
import type { Utxo } from '../../interfaces.js';
import { createUnlockingBytecode, scriptToLockingBytecode } from '../../utils.js';
import { decodeEntryCommitment, headSentinelCommitment } from '../../stateful/SortedList.js';
import { evalComputedKey } from '../../stateful/route-expression-key.js';
import type { DraftInput, DraftSourceOutput, DraftToken } from '../composer/draft.js';
import {
  layOutMappingBatch, planMappingBatch, type MappingBatchPlan, type MappingNodePlacement,
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
  /** The collection the entry's batch writes, whose empty head the collection starts from. */
  readonly collection: string;
  /** The collection's canonical signature, which derives the entry covenant lock its nodes sit at. */
  readonly signature: string;
  /** The participant ids the proxy's block holds for the nodes the entry spends. */
  readonly participantIds: readonly string[];
  /** The placeholder each value-dependent node's declaration starts from, in learning order. */
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
  // A chunkable collection needs the value's width to know whether the write keeps its bytes in the node or needs a
  // run of chunk records, which this hop does not declare; a value the artifact does not state leaves that unknown.
  const valueWidth = (access: NonNullable<AbiFunction['entryAccesses']>[number]): Uint8Array | undefined => {
    if (access.valueParam !== undefined) {
      const byParam = encodedArgument(fn, args, access.valueParam, structs);
      if (byParam !== undefined) return byParam;
    }
    if (access.valueSource !== undefined) {
      return evalComputedKey(access.valueSource, args, visible, undefined, undefined);
    }
    return undefined;
  };

  const writes = ordered.map((access) => {
    if (keyTypes.length !== access.keyParams.length) {
      throw new PerCallProxyDeployError(
        `the implementation's "${request.functionName}" entry writes mapping "${access.collection}" with `
        + `${access.keyParams.length} key(s), which the collection's ${keyTypes.length} key type(s) do not cover`,
      );
    }
    const written = access.operations.filter((operation) => operation !== 'read');
    if (written.length !== 1 || written[0] !== 'write') {
      throw new PerCallProxyDeployError(
        `the implementation's "${request.functionName}" entry touches mapping "${access.collection}" as `
        + `${access.operations.join('/')}, and this hop plans one write per target`,
      );
    }
    if (collection.chunkableValue === true) {
      const raw = valueWidth(access);
      if (raw === undefined) {
        throw new PerCallProxyDeployError(
          `the implementation's "${request.functionName}" entry writes mapping "${access.collection}" a value whose `
          + 'source the artifact does not publish, so this hop cannot tell whether the write needs value chunks',
        );
      }
      if (raw.length > VALUE_INLINE_LIMIT) {
        throw new PerCallProxyDeployError(
          `the implementation's "${request.functionName}" entry writes mapping "${collection.name}" a ${raw.length}`
          + '-byte value, which needs value chunks this hop does not declare',
        );
      }
    }
    // The value is the body's to compute, so a one-byte placeholder fixes only the plan's structure: the slots, the
    // successor links and which targets are inserts. Every commitment that depends on the value is left unstated
    // and learned from the body's own close.
    const keys = access.keyParams.map((_param, index) => resolveKey(access, index));
    return { keys, value: new Uint8Array(1) };
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
  const plan = planMappingBatch({ writes, inventory, encodeValue: (encoded: Uint8Array) => encoded });

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

/** Plans the entry's own writes, with the ids the plan places. */
export function hopEntryWrites(request: HopEntryWritesRequest): HopEntryWrites | undefined {
  const batch = planHopMappingBatch(request);
  if (batch === undefined) return undefined;
  const { plan } = batch;
  const created = plan.written.filter((node) => !node.existed);
  const afterBySlot = new Map(plan.written.map((node) => [bytesToHex(node.slot), node.after]));
  return {
    collection: batch.collection,
    signature: batch.signature,
    participantIds: batch.spent.map((node) => node.id),
    learningCandidates: batch.learningCandidates,
    lay: (context: HopEntryWritesContext): LaidHopEntryWrites => {
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
      const entries = layOutMappingBatch(withLearnedViews(plan, learnedBySlot), {
        placementOf: (slot) => placements.get(bytesToHex(slot)),
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
      // A created node has no input, so it is a trailing output past the events, at the index it declares.
      const trailingOutputs = created.map((node): DraftSourceOutput => ({
        lockingBytecode: lock, valueSatoshis: context.recordAmount,
        token: nodeToken(context.category, writtenOf(node.slot)),
      }));
      return {
        entries,
        inputs,
        trailingOutputs,
        createdOutputs: created.map((_node, position) => context.createdBase + position),
      };
    },
  };
}
