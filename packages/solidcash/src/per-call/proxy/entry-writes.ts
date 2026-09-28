/**
 * The records a proxy hop's entry writes beyond the proxy's data-NFT records.
 *
 * A delegate frame runs on the proxy's records, so a body that writes a sorted mapping touches the collection's
 * node UTXOs rather than a data NFT: an insert relinks the head sentinel and creates the new node, and both must be
 * declared in the frame's segment or the body's group walk reads a record the segment never named. This module
 * plans those records from the entry's own published access, reusing the shipped batch planner and its layout
 * helper.
 *
 * The shape is a sorted batch of insertions into the empty list, planned against its head sentinel. Every write's
 * value has to be stated by the artifact — a literal the source spells, or a parameter the entry's call data
 * carries — because a created node's commitment carries it and the hop declares the node outright. A write whose
 * value the artifact does not state is refused by that fact rather than planned.
 */

import {
  VALUE_INLINE_LIMIT,
  buildEntryNftCovenantScript,
  bytesToHex,
  computeCollectionHash,
  encodeChunkableValueTail,
  scriptToBytecode,
  type AbiFunction,
  type Artifact,
  type RecordEntry,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../../Argument.js';
import { createUnlockingBytecode, scriptToLockingBytecode } from '../../utils.js';
import { headSentinelCommitment } from '../../stateful/SortedList.js';
import { evalComputedKey } from '../../stateful/route-expression-key.js';
import type { DraftInput, DraftSourceOutput, DraftToken } from '../composer/draft.js';
import {
  layOutMappingBatch, planMappingBatch, type MappingBatchPlan, type MappingNodePlacement,
} from '../composer/mapping-plan.js';
import type { TransactionLayout } from '../composer/layout.js';
import { PerCallProxyDeployError } from './errors.js';

/** The participant id a hop's layout holds for a collection's empty head. */
const MAPPING_HEAD_PREFIX = 'mapping-head-';

/** The collection a hop's participant id names when it is the empty head of one; `undefined` for any other id. */
export function mappingHeadCollection(id: string): string | undefined {
  return id.startsWith(MAPPING_HEAD_PREFIX) ? id.slice(MAPPING_HEAD_PREFIX.length) : undefined;
}

/** One sorted batch an entry performs, planned against the empty list's head sentinel. */
interface HopMappingBatch {
  readonly collection: string;
  readonly signature: string;
  readonly headId: string;
  readonly plan: MappingBatchPlan;
}

/** Everything the entry's own writes are planned from. */
export interface HopEntryWritesRequest {
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly args?: readonly FunctionArgument[];
  /** The frame's caller lock, which a `msg.sender` key resolves to. */
  readonly callerLockingBytecode: Uint8Array;
}

/** The coordinates a hop's entry writes need to be placed: the layout, the created region and the writer. */
export interface HopEntryWritesContext {
  readonly layout: TransactionLayout;
  readonly proxyMasterIndex: number;
  /** The first trailing output index past the events, where a created node sits. */
  readonly createdBase: number;
  readonly recordAmount: bigint;
  readonly category: Uint8Array;
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
  /** The participant ids the proxy's block holds for the entry's own writes. */
  readonly participantIds: readonly string[];
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
  const resolveValue = (access: NonNullable<AbiFunction['entryAccesses']>[number]): Uint8Array => {
    if (access.valueParam !== undefined) {
      const byParam = encodedArgument(fn, args, access.valueParam, structs);
      if (byParam !== undefined) return byParam;
    }
    if (access.valueSource !== undefined) {
      const described = evalComputedKey(access.valueSource, args, visible, undefined, undefined);
      if (described !== undefined) return described;
    }
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry writes mapping "${access.collection}" a value whose `
      + 'source the artifact does not publish, so this hop cannot declare the created node\'s commitment',
    );
  };

  const writes = ordered.map((access) => {
    if (keyTypes.length !== access.keyParams.length) {
      throw new PerCallProxyDeployError(
        `the implementation's "${request.functionName}" entry writes mapping "${access.collection}" with `
        + `${access.keyParams.length} key(s), which the collection's ${keyTypes.length} key type(s) do not cover`,
      );
    }
    if (access.operations.length !== 1 || access.operations[0] !== 'write') {
      throw new PerCallProxyDeployError(
        `the implementation's "${request.functionName}" entry touches mapping "${access.collection}" as `
        + `${access.operations.join('/')}, and this hop plans one insertion per write into the empty list`,
      );
    }
    const keys = access.keyParams.map((_param, index) => resolveKey(access, index));
    const raw = resolveValue(access);
    if (collection.chunkableValue === true && raw.length > VALUE_INLINE_LIMIT) {
      throw new PerCallProxyDeployError(
        `the implementation's "${request.functionName}" entry writes mapping "${access.collection}" a ${raw.length}`
        + `-byte value, which needs value chunks this hop does not declare`,
      );
    }
    return { keys, value: collection.chunkableValue === true ? encodeChunkableValueTail(raw) : raw };
  });

  const plan = planMappingBatch({
    writes, inventory: [headSentinelCommitment()], encodeValue: (encoded: Uint8Array) => encoded,
  });
  if (plan.groups.some((group) => group.existed) || plan.written[0]?.existed !== true) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry's writes to "${collection.name}" are not insertions `
      + 'into the empty list, which is the only shape this hop plans',
    );
  }
  return {
    collection: collection.name,
    signature: collection.signature,
    headId: `${MAPPING_HEAD_PREFIX}${collection.name}`,
    plan,
  };
}

/** The token a mapping node carries: a mutable NFT of the contract's category. */
function nodeToken(category: Uint8Array, commitment: Uint8Array): DraftToken {
  return { category, amount: 0n, nft: { capability: 'mutable', commitment } };
}

/** Plans the entry's own writes, with the ids the plan places. */
export function hopEntryWrites(request: HopEntryWritesRequest): HopEntryWrites | undefined {
  const mapping = planHopMappingBatch(request);
  if (mapping === undefined) return undefined;
  const spent = mapping.plan.written.find((node) => node.existed);
  if (spent === undefined) {
    throw new PerCallProxyDeployError(
      `the hop's plan for "${mapping.collection}" spends no input for the empty list's head sentinel`,
    );
  }
  const created = mapping.plan.written.filter((node) => !node.existed);
  return {
    collection: mapping.collection,
    signature: mapping.signature,
    participantIds: [mapping.headId],
    lay: (context: HopEntryWritesContext): LaidHopEntryWrites => {
      const headIndex = context.layout.participants.find((placed) => placed.id === mapping.headId)?.index;
      if (headIndex === undefined) {
        throw new PerCallProxyDeployError(
          `the hop's layout places no input for the mapping head "${mapping.headId}"`,
        );
      }
      const placements = new Map<string, MappingNodePlacement>([
        [bytesToHex(spent.slot), { in: headIndex, out: headIndex }],
        ...created.map((node, position): [string, MappingNodePlacement] =>
          [bytesToHex(node.slot), { out: context.createdBase + position }]),
      ]);
      const entries = layOutMappingBatch(mapping.plan, {
        placementOf: (slot) => placements.get(bytesToHex(slot)),
      });

      const covenant = buildEntryNftCovenantScript(context.category, computeCollectionHash(mapping.signature));
      const lock = scriptToLockingBytecode(covenant, 'p2sh32');
      const unlockingBytecode = createUnlockingBytecode('p2sh32', scriptToBytecode(covenant), [
        encodeFunctionArgument(1n, 'bigint') as Uint8Array,
        encodeFunctionArgument(BigInt(context.proxyMasterIndex), 'bigint') as Uint8Array,
      ]);
      return {
        entries,
        inputs: {
          [mapping.headId]: {
            source: { lockingBytecode: lock, valueSatoshis: context.recordAmount,
              token: nodeToken(context.category, spent.before) },
            output: { lockingBytecode: lock, valueSatoshis: context.recordAmount,
              token: nodeToken(context.category, spent.after) },
            unlockingBytecode,
          },
        },
        // A created node has no input, so it is a trailing output past the events, at the index it declares.
        trailingOutputs: created.map((node): DraftSourceOutput => ({
          lockingBytecode: lock, valueSatoshis: context.recordAmount,
          token: nodeToken(context.category, node.after),
        })),
        createdOutputs: created.map((_node, position) => context.createdBase + position),
      };
    },
  };
}
