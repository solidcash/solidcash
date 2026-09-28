/**
 * The records a proxy hop's entry writes beyond the proxy's data-NFT records.
 *
 * A delegate frame runs on the proxy's records, so a body that writes a sorted mapping touches the collection's
 * node UTXOs rather than a data NFT: an insert relinks the head sentinel and creates the new node, and both must be
 * declared in the frame's segment or the body's group walk reads a record the segment never named. This module
 * plans those records from the entry's own published access, reusing the shipped mapping planner and its layout
 * helper, and leaves the commitment the body computes for the derivation to learn.
 *
 * The shape is the one the constructor planner serves: exactly one write to one collection, planned against the
 * empty list's head sentinel. A value the artifact states is used as the node's tail; one the body computes is
 * declared with a structurally valid placeholder the derivation replaces with the value the body's own close hands
 * back. The relinked predecessor needs no value and is stated outright.
 */

import {
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
  layOutMappingWrites, planMappingWrite, type MappingNodePlacement, type MappingWritePlan,
} from '../composer/mapping-plan.js';
import type { TransactionLayout } from '../composer/layout.js';
import { PerCallProxyDeployError } from './errors.js';

/** One mapping write an entry performs, planned against the empty list's head sentinel. */
interface HopMappingWrite {
  readonly collection: string;
  readonly signature: string;
  readonly headId: string;
  readonly plan: MappingWritePlan;
  /** The written node the entry's own value computes, whose commitment the derivation learns. */
  readonly targetIndex: number;
  /** Whether the value was stated, so the plan carries no placeholder for it. */
  readonly valueStated: boolean;
}

/** Everything the entry's own writes are planned from. */
export interface HopEntryWritesRequest {
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly args?: readonly FunctionArgument[];
  /** The frame's caller lock, which a `msg.sender` key resolves to. */
  readonly callerLockingBytecode: Uint8Array;
}

/** The coordinates a hop's entry writes need to be placed: the layout, the value candidates and the writer. */
export interface HopEntryWritesContext {
  readonly layout: TransactionLayout;
  /** The commitments the derivation currently holds, records first and then the entry's own computed writes. */
  readonly computed: readonly Uint8Array[];
  /** How many of `computed` are the proxy's data-NFT records, so the rest are the entry's own writes. */
  readonly recordCount: number;
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

/** The writes one entry performs, with the ids the plan places and the candidates the derivation learns. */
export interface HopEntryWrites {
  /** The participant ids the proxy's block holds for the entry's own writes. */
  readonly participantIds: readonly string[];
  /**
   * One placeholder per commitment the entry computes and the derivation must learn.
   *
   * The placeholder is a well-formed node commitment — the target's slot and successor with a placeholder value —
   * because the body decodes the declared record before it compares, so a bare digest would stop the decode rather
   * than reach the close that hands the computed value back.
   */
  readonly candidates: readonly Uint8Array[];
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

/** Plans the one mapping write an entry performs, or `undefined` when it touches no sorted collection. */
function planHopMappingWrite(request: HopEntryWritesRequest): HopMappingWrite | undefined {
  const fn = request.artifact.abi.find((candidate) => candidate.name === request.functionName);
  if (fn === undefined) return undefined;
  const accesses = fn.entryAccesses ?? [];
  const batches = fn.sortedBatchInfo ?? [];
  if (accesses.length === 0 && batches.length === 0) return undefined;
  // A body that only reads a sorted collection is left to the plan's other records; this module plans writes.
  const writesSomething = batches.length > 0
    || accesses.some((access) => access.operations.some((operation) => operation !== 'read'));
  if (!writesSomething) return undefined;
  if (accesses.length !== 1 || batches.length !== 1 || batches[0]!.slotIndices.length !== 1) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry writes ${accesses.length} mapping entry(ies) across `
      + `${batches.length} sorted batch(es), and this hop plans exactly one write to one collection`,
    );
  }
  const access = accesses[0]!;
  const collection = request.artifact.stateLayout?.collections
    ?.find((candidate) => candidate.name === access.collection);
  if (collection === undefined || collection.sorted !== true || batches[0]!.collection !== collection.name) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry writes mapping "${access.collection}", which the `
      + 'artifact does not publish as a sorted collection',
    );
  }
  const writes = access.operations.filter((operation) => operation !== 'read');
  if (writes.length !== 1 || writes[0] !== 'write') {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry touches mapping "${access.collection}" as `
      + `${access.operations.join('/')}, and this hop plans one write beside at most a read`,
    );
  }
  const visible = visibleInputs(fn);
  const args = [...(request.args ?? [])];
  const structs = request.artifact.structs ?? request.artifact.stateLayout?.structs;
  const keyTypes = collection.keyTypes ?? [collection.keyType];
  if (keyTypes.length !== access.keyParams.length) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry writes mapping "${access.collection}" with `
      + `${access.keyParams.length} key(s), which the collection's ${keyTypes.length} key type(s) do not cover`,
    );
  }
  const resolveKey = (index: number): Uint8Array => {
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
  const keys = access.keyParams.map((_param, index) => resolveKey(index));
  const rawValue = ((): Uint8Array | undefined => {
    if (access.valueParam !== undefined) {
      const byParam = encodedArgument(fn, args, access.valueParam, structs);
      if (byParam !== undefined) return byParam;
    }
    if (access.valueSource !== undefined) {
      return evalComputedKey(access.valueSource, args, visible, undefined, undefined);
    }
    return undefined;
  })();
  const valueStated = rawValue !== undefined;
  // A value the artifact states is used as the node's tail; one the body computes is planned with an empty tail so
  // the placeholder carries the target's slot and successor, and the derivation learns the value.
  const value = rawValue === undefined
    ? new Uint8Array(0)
    : (collection.chunkableValue === true ? encodeChunkableValueTail(rawValue) : rawValue);

  const plan = planMappingWrite({
    keys, value, inventory: [headSentinelCommitment()], encodeValue: (encoded: Uint8Array) => encoded,
  });
  if (plan.written.length !== 2 || !plan.written[0]!.existed || plan.written[1]!.existed) {
    throw new PerCallProxyDeployError(
      `the implementation's "${request.functionName}" entry's write to "${access.collection}" is not an insertion `
      + 'into the empty list, which is the only shape this hop plans',
    );
  }
  return {
    collection: collection.name,
    signature: collection.signature,
    headId: `mapping-head-${collection.name}`,
    plan,
    targetIndex: 1,
    valueStated,
  };
}

/** The token a mapping node carries: a mutable NFT of the contract's category. */
function nodeToken(category: Uint8Array, commitment: Uint8Array): DraftToken {
  return { category, amount: 0n, nft: { capability: 'mutable', commitment } };
}

/** Plans the entry's own writes, with the ids the plan places and how many values the derivation learns. */
export function hopEntryWrites(request: HopEntryWritesRequest): HopEntryWrites | undefined {
  const mapping = planHopMappingWrite(request);
  if (mapping === undefined) return undefined;
  const target = mapping.plan.written[mapping.targetIndex]!;
  return {
    participantIds: [mapping.headId],
    // The dummy-value plan already carries the target's slot and successor, so its commitment is the placeholder
    // the body's own close replaces with the value it computed.
    candidates: mapping.valueStated ? [] : [target.after],
    lay: (context: HopEntryWritesContext): LaidHopEntryWrites => {
      const headIndex = context.layout.participants.find((placed) => placed.id === mapping.headId)?.index;
      if (headIndex === undefined) {
        throw new PerCallProxyDeployError(
          `the hop's layout places no input for the mapping head "${mapping.headId}"`,
        );
      }
      // Only the target node's commitment depends on the value the body computes; the predecessor's relink does
      // not, so a stated value leaves the whole plan exact and an unstated one carries the learned candidate.
      const learned = context.computed[context.recordCount];
      const written = mapping.plan.written.map((node, index) => (index === mapping.targetIndex && learned !== undefined
        ? { ...node, after: learned } : node));
      const createdIndex = context.createdBase;
      const placements = new Map<string, MappingNodePlacement>();
      for (const node of written) {
        placements.set(
          bytesToHex(node.slot),
          node.existed ? { in: headIndex, out: headIndex } : { out: createdIndex },
        );
      }
      const entries = layOutMappingWrites([[{ ...mapping.plan, written }]], {
        placementOf: (slot) => placements.get(bytesToHex(slot)),
      })[0]!;

      const covenant = buildEntryNftCovenantScript(context.category, computeCollectionHash(mapping.signature));
      const lock = scriptToLockingBytecode(covenant, 'p2sh32');
      const unlockingBytecode = createUnlockingBytecode('p2sh32', scriptToBytecode(covenant), [
        encodeFunctionArgument(1n, 'bigint') as Uint8Array,
        encodeFunctionArgument(BigInt(context.proxyMasterIndex), 'bigint') as Uint8Array,
      ]);
      const spent = written[0]!;
      const created = written[mapping.targetIndex]!;
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
        trailingOutputs: [{
          lockingBytecode: lock, valueSatoshis: context.recordAmount,
          token: nodeToken(context.category, created.after),
        }],
        createdOutputs: [createdIndex],
      };
    },
  };
}
