/**
 * Planning the external calls an implementation frame makes through the proxy hop.
 *
 * A per-call body binds each external call to the k-th record of its own witness block, and that record has to
 * carry the callee's frame kind, its target, its argument digest and its result. The hop's delegate frame is a
 * body like any other, so when the entry it runs makes calls the plan states the same records a call the composer
 * builds for itself does — the calls, and the callee frames they reach. A callee frame is a body too, so a callee
 * whose own entry makes calls is planned the same way, transitively: its records are stated and its own callees are
 * placed.
 *
 * The artifact already publishes the facts: the entry's stop sites (`composition.stopSites`, one `call` site per
 * external call in execution order) and the ABI's routing for that call (interface, method, target, argument
 * sources). `call-resolution.ts` turns a routing row into the target, the argument pushes and the frame kind, from
 * the caller's own arguments, state and frame addresses. Which live deployment a callee runs on is read from the
 * address the entry's own code computes — the provider's registered deployments, or the caller's named externals —
 * and, when the address names none, from the interface the site calls.
 *
 * The occurrence the source publishes decides how many records the site fills: a `conditional` site fills one when
 * its published condition holds against the caller's own facts and none when it does not, and a `loop` site fills
 * as many as its iteration domain reaches against those facts — or, for a loop the artifact publishes no domain
 * for, as many as the caller's own arrays that the site's own sources walk. A loop turn its own guard rules out
 * fills none. A site the caller's own facts give no visits fills nothing and places no callee.
 *
 * Each record a site fills runs on a master of its own, because a master carries one call data and the argument
 * pushes a call carries are the callee's call data. A composition gives a deployment one block, and that block holds
 * every master the transaction spends of the deployment, so a contract reached at several sites takes a master from
 * its live pool for each reach and all of them sit in its one block, while two deployments of one contract are two
 * blocks with their own pools and records, told apart by category. A callee behind its own proxy is two
 * contracts, so each reach takes a master of each: the proxy's fallback is what the caller records, and the
 * implementation's delegate frame is what carries that reach's call data. A reach either pool cannot serve (more
 * reaches than the deployment holds masters) is refused by name. A call back to the hop's own root (a receiver's
 * hook, a flash loan's repayment) enters the root's contract again: the root's deployment is one more callee behind
 * its proxy, whose masters come from the root's pools after the ones the root runs on, whose frames sit in the root's
 * own blocks and run on the root's own records (`HopExternalPlanOptions.reentrantRoot`). Without that root, and at
 * any other deployment of the root's implementation, a call that reaches it below itself is refused by name.
 *
 * A site whose argument or loop bound reads what an earlier call of the same frame returned is planned in execution
 * order: the plan stops before it, the hop settles the earlier calls and learns their results, and the plan is made
 * again with them, so the site is planned from the value its frame computes rather than from a stand-in.
 *
 * What this module derives is what the plan states, never a coordinate: the layout, the caller references and the
 * callee indices stay the composer's. A shape the hop cannot declare — a target no route names, an argument only
 * the running execution holds, a loop width the caller's facts do not fix — is refused by name.
 */

import { binToHex, binToUtf8, hexToBin, vmNumberToBigInt } from '@bitauth/libauth';
import { hopTrace, hopTraceOn } from './hop-trace.js';
import {
  bytesEqual,
  bytesToHex,
  chunkCountForLength,
  decodePushdataValue,
  dynamicLenKey,
  FrameKind,
  getDefaultStateValue,
  isFixedWidthType,
  joinChunks,
  parseArrayTypeString,
  parseChunkCommitment,
  parsePushdataCommitment,
  unpackFixedWidthArray,
  validatorAddress,
  VALUE_INLINE_LIMIT,
  type ArgSource,
  type Artifact,
  type ExternalCallAbi,
  type ExternalCallExpression,
  type FrameKindValue,
  type StateLayout,
  type StateValue,
  type StateVariableInfo,
} from '@solidcash/utils';
import type { FunctionArgument } from '../../Argument.js';
import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import {
  findDeploymentByAddress, findDeploymentByLockingBytecode, findDeploymentByName, listDeployments,
} from '../../stateful/deployment-registry.js';
import { externalReturnsForCallsites } from '../../stateful/external-returns-for-callsites.js';
import { mappingKeySlotCandidates } from '../../stateful/mapping-key-lookup.js';
import type { DraftCall } from '../composer/draft.js';
import { deploymentBlockId, readPublishedStopSites } from '../composer/index.js';
import { deployMaster, type DeployedMaster } from '../deploy/material.js';
import {
  chunkRecordLockingBytecode, readPerCallDeployment, stateRecordLockingBytecode,
  type PerCallDeploymentSet,
} from '../deploy/records.js';
import {
  entryRowOf, makeCallResolver, resolveCallTarget, resolvePublishedCall,
  type AbiEntryRow, type CallResolver, type HopCallInputs, type MappingValueReader, type ResolvedCall,
} from './call-resolution.js';
import {
  hopEntryWrites, joinedNodeValue, sharedNodeId,
  type HopEntryWrites, type HopLiveDeployment, type ReachWrite, type ReachWriteTarget,
} from './entry-writes.js';
import { readEntryNode } from '../call/entry-records.js';
import { entrySideCars } from '../call/side-cars.js';
import type { RecoverySideCars } from '../composer/recovery.js';
import { bytesToSlotValue, decodeEntryCommitment } from '../../stateful/SortedList.js';
import { chainsEnclosedTouch } from './enclosed-reads.js';
import { PerCallProxyDeployError } from './errors.js';
import { reachedNodeValue } from './reached-values.js';
import { lockOfIdentity } from './address-identity.js';
import {
  EntryWriteValueAwaited, entryWriteValueKey, statedMappingWrites, writeLandsBefore, type StatedMappingWrite,
} from './written-values.js';
import { skippedEmits, skippedSends, takenSends, type WriteActivationFacts } from './write-activation.js';

/** One contract the caller names for a call an implementation entry makes, keyed by the interface it calls. */
export interface PerCallProxyExternal {
  /** The artifact whose entries the call names, i.e. the implementation behind the address the call reaches. */
  readonly artifact: Artifact;
  /** The category whose address the calling entry's own code computes, which is the proxy's when one sits there. */
  readonly categoryId: string;
  /**
   * The proxy the callee sits behind, when the address the call reaches names a proxy rather than the artifact.
   *
   * A per-call deployment places a proxy whose fallback forwards the call data it received to the address it holds,
   * and the implementation's entry runs as the delegate frame that follows. A callee reached at a proxy's address
   * therefore has to be placed as that same chain, which needs the proxy's artifact and its implementation's
   * category beside the implementation's own artifact.
   */
  readonly proxyArtifact?: Artifact;
  /** The implementation's own category, whose master the delegate frame runs from. */
  readonly implementationCategoryId?: string;
}

/** One record a callee frame reads, with the live UTXO it sits on. */
export interface HopCalleeRecord {
  readonly id: string;
  readonly commitment: Uint8Array;
  readonly satoshis: bigint;
  readonly lockingBytecode: Uint8Array;
}

/** One mapping node a callee frame's entry only reads, with the live UTXO it sits on. */
export interface HopCalleeReadNode {
  readonly id: string;
  readonly collection: string;
  /** The collection's canonical signature, which derives the covenant lock the node sits at. */
  readonly signature: string;
  /** The entry-access slot the node is read at, which is its value-witness slot. */
  readonly slotIndex: number;
  /** The slot the read's key hashes to: the node's own when the list holds the key, one it brackets otherwise. */
  readonly keySlot: Uint8Array;
  /**
   * The whole value the node holds, when it crosses the inline limit and the body reads it by witness.
   *
   * A chunkable value past the inline limit keeps only its digest in the node's tail, so the body takes the value
   * itself from its frame's block, one slot per entry access that reads one. Absent for a value the tail holds
   * inline — the body never reaches the witness — and for a key the list does not hold.
   */
  readonly value?: Uint8Array;
  readonly commitment: Uint8Array;
  /**
   * The slot of the node this read resolves to when a reach placed earlier in the hop created it: the key's own
   * node, or the node that brackets a key no list holds. The created node carries no input, so the frame names it by
   * the creating frame's output rather than by a UTXO, and `utxo` is absent.
   */
  readonly createdSlot?: Uint8Array;
  readonly utxo?: Utxo;
}

/** One callee frame the hop runs: the master, the live records it reads, and the UTXO each participant sits on. */
export interface HopCallee {
  readonly master: string;
  readonly contract: string;
  /**
   * The block the frame's master sits in, which is its deployment's (`deploymentBlockId`): two deployments of one
   * contract are two blocks, each with its own masters and records. A delegate frame's records sit in its owner's.
   */
  readonly block: string;
  /** The ABI name of the entry the call reaches. */
  readonly entry: string;
  /** The published entry identity, `Contract.entry()`, matching the stop-site table. */
  readonly functionName: string;
  readonly artifact: Artifact;
  /** The callee's category, as the token category bytes and as the hex its records' covenant names. */
  readonly category: Uint8Array;
  readonly categoryId: string;
  readonly deployed: DeployedMaster;
  readonly kind: FrameKindValue;
  /** The satoshi value the callee's live master carries, which its input recreates. */
  readonly masterSatoshis: bigint;
  /** True when the entry returns a value, so the frame's `retval` is a candidate the derivation learns. */
  readonly returns: boolean;
  /**
   * Index in `callees` of the frame whose `retval` this frame records verbatim, or absent when its own body
   * computes the return.
   *
   * A proxy's fallback has no return of its own: it forwards the call data to its implementation and records the
   * bytes the delegate returned, so its `retval` is the delegate frame's. The caller's record for the call names
   * the proxy, so that recorded value is what the caller reads, and it is the implementation entry's own declared
   * return encoding that the caller decodes.
   */
  readonly retvalFrom?: number;
  /** The address this frame runs as, i.e. `address(this)`: the delegate frame runs as the proxy's. */
  readonly selfAddress: Uint8Array;
  readonly records: readonly HopCalleeRecord[];
  /**
   * The mapping nodes this frame's own entry only reads, in the order its code reads them.
   *
   * A body that reads a key declares the node the key's slot holds — or the node that brackets it when the list
   * holds no such key — whether or not it also writes, because the frame's segment has to carry the record for the
   * body's own group walk. They sit after the data records the entry's block layout names and ahead of any write.
   */
  readonly readNodes: readonly HopCalleeReadNode[];
  /**
   * What this frame's own write plan is built from, so a value the body computes can re-plan it.
   *
   * A chunkable mapping write whose value the artifact does not publish has its run sized from the value, which
   * only the frame's own close exposes; the reach is then planned again from that value. The inputs the write was
   * planned from are kept here so the re-plan is the same plan, not a second one built another way.
   */
  readonly writeInputs?: HopCalleeWriteInputs;
  /**
   * Index in `callees` of the frame whose live records this frame reads and whose block hosts them.
   *
   * A proxy's delegate frame reads the records the proxy's fallback frame runs on, so it declares them without
   * owning their block. Absent means the frame owns the records it lists.
   */
  readonly recordOwner?: number;
  /** Every participant of this callee, keyed by the id the plan places it under. */
  readonly utxos: ReadonlyMap<string, Utxo>;
  /**
   * The records this frame's own entry writes beyond the records its frame declares, or absent when it writes none.
   *
   * A body that writes a sorted mapping touches the collection's node UTXOs rather than a data NFT, and the frame
   * has to declare them in the segment its write lands in or its own group walk reads a record the segment never
   * named. The write belongs to the frame, so it is planned against the deployment that frame runs on — the
   * callee's own for a call frame, the proxy's records for the delegate frame a proxied callee reaches.
   */
  readonly entryWrites?: HopEntryWrites;
  /** The calls this callee's own entry makes, in execution order, whose callees are other frames of the plan. */
  readonly calls: readonly DraftCall[];
  /**
   * For each published call site of this callee's entry, the position of its first call in `calls`, or `-1` when
   * the plan places none. A site the execution does not reach places no call, so the positions the plan states are
   * not the source's own ordinals.
   */
  readonly callBases: readonly number[];
  /** Index in `callees` of the master that calls this callee, or null for the implementation's own master. */
  readonly enteredBy: number | null;
  /**
   * The frame's path from the hop's own entry: each call site and visit that reaches it, `/site.visit` per level.
   *
   * A plan placed in execution order is placed again from the start once an earlier call's result is learned, and
   * the frames before the site that waited are placed exactly as before. Master ids follow placement order, so the
   * path is what names a frame across those plans; a proxied callee's two frames share the reach's path.
   */
  readonly path: string;
  /** The call site whose record names this frame, or absent for the delegate frame a proxy's fallback forwards to. */
  readonly origin?: HopCallOrigin;
  /** True when the plan stopped inside this frame's own calls, so it states only the calls before that point. */
  readonly truncated?: boolean;
  /**
   * The emit indices of the frame's entry whose condition the reach's own facts decide the body skips
   * (`skippedEmits`): the frame lists each one's output with the empty commitment. Absent when none is.
   */
  readonly skippedEmits?: readonly number[];
  /**
   * The transfer indices of the frame's entry whose condition the reach's own facts decide the body skips
   * (`skippedSends`): the body pays no send there, so the frame lists none for it. Absent when none is.
   */
  readonly skippedSends?: readonly number[];
  /**
   * The transfer indices of the frame's entry the reach's own facts decide the body pays (`takenSends`): a send no
   * branch guards, and one whose condition holds. Absent when none is.
   */
  readonly takenSends?: readonly number[];
}

/** The live facts one callee frame's own write plan is built from, kept so the write can be planned again. */
export interface HopCalleeWriteInputs {
  /** The reach's own call data, which the write's keys and value are resolved from. */
  readonly args: readonly FunctionArgument[];
  /** The frame's `msg.sender`, which a key it writes can resolve to. */
  readonly senderAddress: Uint8Array | undefined;
  /** The deployment the frame runs on: its own records and nodes, or the proxy's for a delegate frame. */
  readonly live: HopLiveDeployment;
  /** The category the frame's nodes are placed under, which names a shared node. */
  readonly categoryId: string;
}

/** The call site whose record names a callee frame: the calling frame, by its path, and the site's visit. */
export interface HopCallOrigin {
  /** The calling frame's path, `''` for the hop's own entry. */
  readonly callerPath: string;
  readonly callsiteId: number;
  /** The visit of the site that placed the frame: `0` for a site that runs once. */
  readonly occurrence: number;
}

/**
 * The call site a plan stops before, because a value it needs is an earlier call's result no settle has learned.
 *
 * The site's own frame computes the value from what the earlier call returned, so the hop settles the frames of
 * those earlier calls first and plans again from their results: the site is planned once the code before it has
 * settled, in the order the execution reaches it. A plan also stops before an entry's own site where a failure of
 * planning is met (`refusal`), so the entry is settled up to it (`planning-refusal.ts`).
 */
export interface HopPlanBlock {
  /** The path of the frame whose site waits, `''` for the hop's own entry. */
  readonly path: string;
  /** The waiting call, as a refusal names it. */
  readonly where: string;
  /** What the site reads the results for, or `refusal` for a stop before a site whose frames are refused. */
  readonly reads: 'argument' | 'loop-bound' | 'refusal';
  /** The earlier call sites of the same frame whose results the site reads, by callsite id. */
  readonly producers: readonly number[];
  /** On a `refusal` stop, the failure met at the site: the planner's refusal of its frames, or a stop's failure. */
  readonly refusal?: Error;
}

/** The path a site's visit gives the frame it reaches, below the path of the frame that makes the call. */
export function calleePath(callerPath: string, site: number, occurrence: number): string {
  return `${callerPath}/${site}.${occurrence}`;
}

/** The key a learned call result is held under: the calling frame's path and the site's callsite id. */
export function reachedResultKey(callerPath: string, callsiteId: number): string {
  return `${callerPath}|${callsiteId}`;
}

/** What the implementation frame's calls and the callee frames they reach are planned as. */
export interface HopExternalPlan {
  readonly calls: readonly DraftCall[];
  /** For each published call site of the implementation's entry, the position of its first call in `calls`. */
  readonly callBases: readonly number[];
  /** The callsite id of each published call site, parallel to `callBases`, or `-1` for a site that publishes none. */
  readonly callsiteIds: readonly number[];
  /**
   * The callsite ids an entry's own condition reads a result from.
   *
   * A condition over one of these is not fixed by the caller's own facts, so the plan states none of its visits
   * until that result is learned and the hop is planned again with it. The list is what tells a caller whether a
   * further planning pass can change the plan, and its length bounds how many passes are worth taking.
   */
  readonly conditionalProducers: readonly number[];
  readonly callees: readonly HopCallee[];
  /** The live UTXO of every callee participant, keyed by the id the plan places it under. */
  readonly utxos: ReadonlyMap<string, Utxo>;
  /**
   * The compute side-cars each frame co-spends, keyed by the master whose body reads them.
   *
   * A body that hashes a runtime value or recovers a signer reads one side-car per call immediately after its own
   * input, so a hop that runs such a frame spends live side-car UTXOs and recreates them at their own indices. The
   * frames that read none contribute nothing, and the plan places the side-cars of every frame that does.
   */
  readonly sideCars: ReadonlyMap<string, RecoverySideCars>;
  /**
   * The site this plan stops before, or absent for a plan that states every call the execution reaches.
   *
   * A plan that stops states the calls the execution makes before that site, the frames they reach and the calls of
   * the frames above it up to the site that leads there (`truncated`): enough to settle the earlier calls whose
   * results the site reads, never enough to broadcast.
   */
  readonly blocked?: HopPlanBlock;
  /**
   * The end commitments learned for a callee frame's own data records, by record index, which the frame's own
   * declaration carries where the entry publishes the write.
   */
  /**
   * True for a plan whose held continuations take the view the chain carries.
   *
   * A frame that leaves a node an earlier frame created alone and one that rewrites it state the same declaration
   * before either has settled, so the two can only be told apart from a settle's own outcome. A pass planned with
   * this set states the held one the way the chain ends, and the caller keeps that pass only when it settles.
   */
  readonly heldContinuations?: boolean;
}

/** The entry's ABI routing, refusing an artifact that publishes none for it. */
export function routingOf(artifact: Artifact, functionName: string): readonly ExternalCallAbi[] {
  const row = entryRowOf(artifact, functionName);
  return (row as { readonly externalCalls?: readonly ExternalCallAbi[] }).externalCalls ?? [];
}

/**
 * The compiler's reason for refusing one entry, or undefined for one it serves.
 *
 * A refused entry's body is emitted as one that fails whenever the dispatcher reaches it, and its call sites are
 * not published. A frame settled on such an entry therefore has no call record to bind, so a hop that reaches one
 * would settle it against a program whose edge was never declared; naming the refusal is the answer instead.
 */
function refusedEntryReason(artifact: Artifact, functionName: string): string | undefined {
  const identity = `${artifact.contractName}.${functionName}()`;
  const listed = (artifact.composition as {
    readonly refusedEntries?: readonly { readonly functionName: string; readonly reason: string }[];
  } | undefined)?.refusedEntries ?? [];
  return listed.find((entry) => entry.functionName === identity)?.reason;
}

/** The segment one published write's records are declared in: a call count, or the run's own last segment. */
type WriteSegment = number | 'last';

/** The live state an entry's own body rewrites, as its published write segments name it. */
interface HopWrittenState {
  /** Per data record, per written variable name, the segments of the writes that rebuilt it. */
  readonly records: ReadonlyMap<number, ReadonlyMap<string, readonly WriteSegment[]>>;
  /**
   * Per data record, the segments of writes whose written variables the artifact does not publish.
   *
   * An unnamed write's changed fields are not known, which is the conservative reading: any field of the record may
   * have changed.
   */
  readonly unnamedRecords: ReadonlyMap<number, readonly WriteSegment[]>;
  /** Per dynamic variable, the segments of the writes to it. */
  readonly variables: ReadonlyMap<string, readonly WriteSegment[]>;
}

/**
 * The records and named variables an entry's own body rewrites, read from its published write segments.
 *
 * The segment a body's own write lands in is published per entry, as either the data record it rewrites or the
 * name of a dynamic variable it appends to. A write to a data record names the state variable it rebuilt, so the
 * segment is kept under that name; a write to a dynamic value is kept under the variable itself. An entry that
 * publishes no write rewrites nothing, and its incoming state is what its body sees.
 */
export function entryWrittenState(artifact: Artifact, functionName: string): HopWrittenState {
  const entry = readPublishedStopSites(artifact).entries
    .find((candidate) => candidate.functionName === `${artifact.contractName}.${functionName}()`);
  const writes = (entry as { readonly writeSegments?: readonly {
    readonly record?: number;
    readonly variable?: string;
    readonly segment: WriteSegment;
    readonly writtenVariables?: readonly string[];
  }[] } | undefined)?.writeSegments ?? [];
  const records = new Map<number, Map<string, WriteSegment[]>>();
  const unnamedRecords = new Map<number, WriteSegment[]>();
  const variables = new Map<string, WriteSegment[]>();
  const push = <K>(map: Map<K, WriteSegment[]>, key: K, segment: WriteSegment): void => {
    const list = map.get(key);
    if (list === undefined) map.set(key, [segment]);
    else list.push(segment);
  };
  for (const write of writes) {
    if (write.record !== undefined) {
      if (write.writtenVariables === undefined) {
        push(unnamedRecords, write.record, write.segment);
      } else {
        const perVariable = records.get(write.record) ?? new Map<string, WriteSegment[]>();
        records.set(write.record, perVariable);
        for (const name of write.writtenVariables) push(perVariable, name, write.segment);
      }
    }
    if (write.variable === undefined) continue;
    push(variables, write.variable, write.segment);
  }
  return { records, unnamedRecords, variables };
}

/**
 * True when a published write can run before a call site at `siteIndex`, so the incoming state may not fix it.
 *
 * A record write's segment is the count of calls the entry makes before it, or `'last'` for one every call
 * precedes: a count no greater than the site's own position runs before the site, while a greater count or the
 * run's last segment runs after it. A dynamic value's records are rebuilt in the run's last segment whatever the
 * source order, so its segment cannot place the write and it keeps the conservative reading.
 */
function writeCanPrecedeSite(
  segments: readonly WriteSegment[] | undefined, dynamic: boolean, siteIndex: number,
): boolean {
  if (segments === undefined || segments.length === 0) return false;
  if (dynamic) return true;
  return segments.some((segment) => typeof segment === 'number' && segment <= siteIndex);
}

/**
 * Every state variable a published condition reads, with the field path each read goes through.
 *
 * The path is the field carried on the expression the read sits under: for `rows[k].stamp` the state `rows` is
 * read through the field `stamp`, while a read of the variable itself or of a whole element is recorded as
 * `null`, meaning the field is not fixed.
 */
function conditionStateReads(condition: ExternalCallExpression): ReadonlyMap<string, Array<string | null>> {
  const reads = new Map<string, Array<string | null>>();
  const visit = (value: unknown, inheritedField: string | null): void => {
    if (value === null || typeof value !== 'object') return;
    const node = value as { readonly kind?: string; readonly name?: string };
    const field = node.kind === 'field' && typeof node.name === 'string' ? node.name : inheritedField;
    if ((node.kind === 'state' || node.kind === 'stateAccess') && typeof node.name === 'string') {
      const fields = reads.get(node.name) ?? [];
      fields.push(field);
      reads.set(node.name, fields);
    }
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(child)) child.forEach((entry) => visit(entry, field));
      else visit(child, field);
    }
  };
  visit(condition, null);
  return reads;
}

/**
 * True when a condition reads a whole state value the entry's own body rewrites.
 *
 * The planner evaluates a condition against the state the caller holds when its frame starts, but an earlier
 * statement in the same frame can rewrite that state before the guarded call is reached. A record or named
 * dynamic value the entry's body rewrites carries the value the condition reads, so the incoming value does not
 * fix the condition and the site is stated as one record.
 *
 * A read through a struct field is not such a read: the compiler publishes it where the condition itself stands,
 * folding every dominating write to that field into the expression, so a field read the expression still carries
 * is the value the frame starts with and the caller's incoming facts fix it. A bare read of a scalar variable is
 * published the same way, its dominating writes folded in, and one whose write the compiler cannot follow is
 * published as a `writtenState` node, which the planner refuses by name (`refuseUnfollowedState`). Only a read of
 * a whole struct, array or dynamic value is published as the raw pre-transaction read an earlier statement can
 * invalidate.
 *
 * `siteIndex` is the site's own position among the entry's calls. A write the artifact places after that position
 * cannot make the incoming state stale, so it does not force the site; a write placed at or before it, or one
 * whose segment cannot place it at all, keeps the conservative reading.
 */
function conditionReadsWrittenState(
  condition: ExternalCallExpression, artifact: Artifact, writtenState: HopWrittenState, siteIndex: number,
): boolean {
  const layout = artifact.stateLayout;
  if (layout === undefined) return false;
  for (const [name, readFields] of conditionStateReads(condition)) {
    if (readFields.every((field) => field !== null)) continue;
    const variable = layout.variables.find((candidate) => candidate.name === name);
    if (variable === undefined || foldsDominatingWrites(variable, artifact)) continue;
    const dynamic = variable.dynamic === true;
    const recordSegments = writtenState.records.get(variable.nftIndex)?.get(name);
    const unnamedSegments = writtenState.unnamedRecords.get(variable.nftIndex);
    const variableSegments = writtenState.variables.get(name);
    if (writeCanPrecedeSite(recordSegments, dynamic, siteIndex)
      || writeCanPrecedeSite(unnamedSegments, dynamic, siteIndex)
      || writeCanPrecedeSite(variableSegments, dynamic, siteIndex)) return true;
  }
  return false;
}

/**
 * True for a state variable whose bare reads the compiler publishes with the entry's own dominating writes folded
 * in: one held whole in its record, neither a dynamic value nor a struct or array.
 */
function foldsDominatingWrites(
  variable: NonNullable<Artifact['stateLayout']>['variables'][number], artifact: Artifact,
): boolean {
  const structs = artifact.structs ?? artifact.stateLayout?.structs ?? [];
  return variable.dynamic !== true && !variable.type.endsWith(']')
    && !structs.some((struct) => struct.name === variable.type);
}

/** The variable of the first `writtenState` node an expression carries: a read of state written before it. */
function unfollowedStateRead(expression: unknown): string | undefined {
  if (expression === null || typeof expression !== 'object') return undefined;
  const node = expression as { readonly kind?: string; readonly name?: string };
  if (node.kind === 'writtenState' && typeof node.name === 'string') return node.name;
  for (const child of Object.values(expression as Record<string, unknown>)) {
    const found = Array.isArray(child)
      ? child.map(unfollowedStateRead).find((name) => name !== undefined)
      : unfollowedStateRead(child);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Refuses a site whose guard reads state the entry's own body writes before it in a way the compiler states no value
 * for: the incoming value is not the one the body reads there, and stating the call would leave the run to skip it.
 */
function refuseUnfollowedState(condition: ExternalCallExpression | null | undefined, where: string): void {
  const name = unfollowedStateRead(condition);
  if (name === undefined) return;
  throw new PerCallProxyDeployError(
    `${where} is guarded by "${name}", which the entry's own body writes before the call in a way its published `
    + 'facts do not state, so the hop cannot decide whether the call is made',
  );
}

/** Every `producerResult`/`externalCall` node a condition or an argument source reads, at any nesting depth. */
function producerCallsitesOf(condition: ExternalCallExpression | ArgSource): readonly number[] {
  const found: number[] = [];
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return;
    const node = value as { readonly kind?: string; readonly callsiteId?: number };
    if ((node.kind === 'producerResult' || node.kind === 'externalCall')
      && typeof node.callsiteId === 'number') found.push(node.callsiteId);
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  };
  visit(condition);
  return found;
}

/**
 * True when a condition reads an earlier call's result, which the caller's own facts do not fix.
 *
 * A condition over such a result cannot be decided when the site is resolved: the answer is whatever that call
 * returned, which only a run of that call produces. The site is therefore planned as no visit until the result is
 * known, and a later planning pass with the learned results is what decides it.
 */
function conditionReadsProducerResult(condition: ExternalCallExpression): boolean {
  return producerCallsitesOf(condition).length > 0;
}

/**
 * The earlier calls' results, keyed the way the expression evaluator reads them, for one condition.
 *
 * The evaluator resolves a `producerResult` node by the JSON of the node itself, and the shared binder is what
 * turns a callsite-keyed map of results into that form. A condition that reads no producer, or one whose results
 * the hop has not learned, yields no map and the condition stays unevaluated.
 */
function conditionExternalReturns(
  condition: ExternalCallExpression,
  routing: readonly ExternalCallAbi[],
  results: ReadonlyMap<number, FunctionArgument> | undefined,
): ReadonlyMap<string, FunctionArgument> | undefined {
  if (results === undefined || results.size === 0) return undefined;
  try {
    const bound = externalReturnsForCallsites(
      [{ kind: 'expression', expression: condition }], results, routing,
    );
    return bound.size === 0 ? undefined : bound;
  } catch {
    return undefined;
  }
}

/**
 * How many records one published site fills.
 *
 * A `loop` site fills the records its visits do: the domain's recurrence is evaluated against the caller's own
 * arguments, so a loop bounded by a forwarded array's length fills that length and a loop bounded by a literal
 * fills that count. A domain that reads an earlier call's result is evaluated against the result a settle learned
 * (the planner stops before the site until one has); a domain the caller's facts and those results do not fix is
 * refused by name, because the plan would not know the run's width. A loop the artifact publishes no domain for is
 * read from the site's own sources instead, and refused by the same name when nothing there fixes its width.
 *
 * A `conditional` site fills its record only when the condition the artifact publishes holds against the caller's
 * own facts: the arm a condition the caller's facts fix does not take reaches no call, so the site places nothing.
 * A site the artifact publishes no condition for still fills one, and so does one whose condition the caller's own
 * facts do not fix: the plan states the record and the execution is what skips it. A condition whose state the
 * entry's own body rewrites is not fixed by the incoming facts either: a write the artifact places at or before
 * the site can make it hold, so the plan states the record rather than dropping a call the body takes. A write the
 * artifact places after the site cannot make the incoming value stale, so such a condition is evaluated as it
 * stands. A read that goes solely through struct fields, or a bare read of a scalar variable, is fixed by the
 * incoming facts, since the compiler folds every dominating write to it into the expression the condition carries;
 * a guard over a write the compiler cannot fold is refused by name.
 *
 * A condition over an earlier call's result is the exception: the caller's own facts do not fix it, but a later
 * planning pass does, because the result is learned when that call is settled. Such a site fills nothing in the
 * pass that does not yet hold the result, so the arm the run does not take is never planned and the plan states
 * exactly the calls the execution makes.
 */
export function occurrenceCountOf(
  row: ExternalCallAbi, args: readonly FunctionArgument[], resolver: CallResolver, where: string,
  artifact: Artifact, writtenState: HopWrittenState, siteIndex: number,
  routing: readonly ExternalCallAbi[],
  producerResults: ReadonlyMap<number, FunctionArgument> | undefined,
): number {
  refuseUnfollowedState(row.condition, where);
  if ((row.occurrence ?? 'once') !== 'loop') {
    if (row.condition === undefined || row.condition === null) return 1;
    if (conditionReadsWrittenState(row.condition, artifact, writtenState, siteIndex)) return 1;
    const holds = resolver.evaluate(
      row.condition, 0, undefined, conditionExternalReturns(row.condition, routing, producerResults),
    );
    if (holds === false) return 0;
    if (holds === undefined && conditionReadsProducerResult(row.condition)) return 0;
    return 1;
  }
  const domain = row.iterationDomain;
  if (domain === undefined) return derivedOccurrenceCountOf(row, args, where);
  // A domain read from an earlier call's result is evaluated against the result a settle learned for that call.
  const returnsOf = (expression: ExternalCallExpression): ReadonlyMap<string, FunctionArgument> | undefined =>
    conditionExternalReturns(expression, routing, producerResults);
  const initial = resolver.evaluate(domain.initialValue, 0, undefined, returnsOf(domain.initialValue));
  const step = resolver.evaluate(domain.stepValue, 0, undefined, returnsOf(domain.stepValue));
  const continueReturns = returnsOf(domain.continueCondition);
  if (typeof initial !== 'bigint' || typeof step !== 'bigint') {
    throw new PerCallProxyDeployError(
      `${where} runs a loop whose counter the caller's own arguments do not fix`,
    );
  }
  if (step === 0n) {
    throw new PerCallProxyDeployError(`${where} runs a loop whose counter never advances`);
  }
  let count = 0;
  let counter = initial;
  for (let turn = 0; turn < domain.maximumIterations; turn += 1) {
    const bindings = new Map<string, FunctionArgument>([[domain.counterName, counter]]);
    const keep = resolver.evaluate(domain.continueCondition, 0, bindings, continueReturns);
    if (keep === undefined) {
      throw new PerCallProxyDeployError(
        `${where} runs a loop whose bound is not fixed by the caller's own arguments, so the hop cannot state how `
        + 'many records its visits fill',
      );
    }
    if (!keep) break;
    count += 1;
    counter += step;
  }
  return count;
}

/**
 * The turns of a site that make its call, out of the `count` its visits reach.
 *
 * A loop whose body guards its call (`if (parts[i] > 0) sink.take(parts[i])`) publishes that guard as the site's condition
 * beside its iteration domain, and a turn the guard rules out makes no call and takes no record. Each turn's guard is
 * evaluated with the turn's counter bound, against the results the settles learned (the planner stops before the site
 * until it holds them); a turn it does not decide is stated, and the execution is what skips it. A guard over state
 * the entry's own body rewrites before the site is not fixed by the incoming facts, so every turn is stated. Any
 * other site's visits are all turns.
 */
export function callingTurnsOf(
  row: ExternalCallAbi, count: number, resolver: CallResolver, artifact: Artifact, writtenState: HopWrittenState,
  siteIndex: number, routing: readonly ExternalCallAbi[],
  producerResults: ReadonlyMap<number, FunctionArgument> | undefined,
): readonly number[] {
  const turns = Array.from({ length: count }, (_unused, turn) => turn);
  const guard = row.occurrence === 'loop' ? row.condition ?? undefined : undefined;
  if (guard === undefined || conditionReadsWrittenState(guard, artifact, writtenState, siteIndex)) return turns;
  const domain = row.iterationDomain;
  const valueOf = (expression: ExternalCallExpression): FunctionArgument | undefined =>
    resolver.evaluate(expression, 0, undefined, conditionExternalReturns(expression, routing, producerResults));
  const initial = domain === undefined ? undefined : valueOf(domain.initialValue);
  const step = domain === undefined ? undefined : valueOf(domain.stepValue);
  const returns = conditionExternalReturns(guard, routing, producerResults);
  return turns.filter((turn) => {
    // The counter as the body holds it on this turn, for a guard that names it rather than the turn's index.
    const bindings = domain !== undefined && typeof initial === 'bigint' && typeof step === 'bigint'
      ? new Map<string, FunctionArgument>([[domain.counterName, initial + step * BigInt(turn)]])
      : undefined;
    return resolver.evaluate(guard, turn, bindings, returns) !== false;
  });
}

/** The most visits a derived loop width may reach before the caller's own facts are taken to leave it open. */
const MAXIMUM_DERIVED_VISITS = 1 << 16;

/** Every `arrayElement` source a site's argument sources contain, at any nesting depth. */
function arrayElementSourcesOf(sources: readonly ArgSource[]): readonly ArgSource[] {
  const found: ArgSource[] = [];
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return;
    if ((value as { readonly kind?: string }).kind === 'arrayElement') found.push(value as ArgSource);
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  };
  sources.forEach(visit);
  return found;
}

/**
 * The width of a repeated site the artifact publishes no iteration domain for, read from the site's own sources.
 *
 * A repeated site still publishes where each of its arguments comes from, and a loop walks whatever its body
 * indexes: an `arrayElement` source whose index advances with the visit names the element that visit carries, so
 * the elements the caller's own array holds are the visits the site fills — the source's own length is the run's
 * width. More than one such source fixes the narrowest. A site whose sources walk no caller-held array — a
 * constant, or a value only an earlier call's result fixes — has a width the caller's own facts do not fix, and is
 * refused by name.
 */
function derivedOccurrenceCountOf(
  row: ExternalCallAbi, args: readonly FunctionArgument[], where: string,
): number {
  let width: number | undefined;
  for (const source of arrayElementSourcesOf(row.argSources ?? [])) {
    const array = source.paramIndex === undefined ? undefined : args[source.paramIndex];
    if (!Array.isArray(array)) continue;
    const start = source.indexValue ?? 0;
    const step = source.indexStepValue ?? 0;
    if (step === 0) continue;
    let visits = 0;
    while (visits < MAXIMUM_DERIVED_VISITS) {
      const index = start + step * visits;
      if (index < 0 || index >= array.length) break;
      visits += 1;
    }
    width = width === undefined ? visits : Math.min(width, visits);
  }
  if (width === undefined) {
    throw new PerCallProxyDeployError(
      `${where} runs a loop whose bound is not fixed by the caller's own arguments, so the hop cannot state how `
      + 'many records its visits fill',
    );
  }
  return width;
}

/** The most chunks one dynamic value may span, so a corrupt length header cannot size a run. */
const MAXIMUM_DYNAMIC_CHUNKS = 1 << 15;

/**
 * The live state a deployment's records hold, keyed by field name, as the contract's own body reads it.
 *
 * Every data-NFT record parses with the shipped decoder at its own index. A dynamic field's record holds only the
 * byte length of its value; the value itself lives in the field's own chunk records, one entry NFT per chunk, which
 * a body joins and decodes before it reads a `.length` or an element. The planner is handed the assembled value for
 * the same reason a body has it: a site whose argument or bound reads the field cannot be resolved from its byte
 * length alone. A field whose chunks the record's own length does not account for is left unstated rather than
 * guessed at, so a site that reads it is refused by name.
 */
export function deploymentStateValues(
  layout: StateLayout, categoryId: string, deployment: PerCallDeploymentSet,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  deployment.records.forEach((record, nftIndex) => {
    const commitment = record.token?.nft?.commitment;
    if (commitment === undefined) return;
    Object.assign(values, parsePushdataCommitment(commitment, layout, nftIndex));
  });
  for (const field of layout.variables ?? []) {
    if (field.dynamic !== true) continue;
    const value = dynamicFieldValue(deployment, layout, categoryId, field, values);
    if (value !== undefined) values[field.name] = value;
  }
  return values;
}

/** A mapping value type a node holds as a script number: an integer, a fixed-point number or a `bool`. */
const NUMBER_VALUE_TYPE = /^(?:bool|bigint|u?int\d+|u?fixed\d+x\d+)$/;

/** A mapping value type a node holds as its own bytes. */
const BYTES_VALUE_TYPE = /^(?:string|bytes\d*|address(?: payable)?|pubkey|sig|datasig)$/;

/**
 * One mapping value as the contract's own body reads it: from the whole value its node holds, or the type's default
 * for a key the mapping does not hold (`raw` absent).
 *
 * A node holds the value as the body's own stack item. An integer, an enum or a `bool` is a script number, which the
 * body reads with `OP_BIN2NUM`; a `string`, `bytes` or `bytesN`, an address or a public key is its own bytes; a struct
 * or an array is its pushdata encoding. A chunking collection's values are therefore read in the forms
 * `isWholeNodeValue` holds a learned one to. A value its type does not decode, or a type none of these names, is left
 * unstated.
 */
function mappingValueOf(
  type: string, raw: Uint8Array | undefined, artifact: Artifact, structs: Artifact['structs'],
): FunctionArgument | undefined {
  if (NUMBER_VALUE_TYPE.test(type) || (artifact.enums ?? []).some((declared) => declared.name === type)) {
    // An absent key reads as the empty item the body pushes for the default.
    const number = vmNumberToBigInt(raw ?? new Uint8Array(0), { requireMinimalEncoding: false });
    if (typeof number !== 'bigint') return undefined;
    return type === 'bool' ? number !== 0n : number;
  }
  if (BYTES_VALUE_TYPE.test(type)) {
    const bytes = raw ?? getDefaultStateValue(type, structs) as Uint8Array;
    return type === 'string' ? binToUtf8(bytes) : bytes;
  }
  if (!(structs ?? []).some((struct) => struct.name === type) && parseArrayTypeString(type) === undefined) {
    return undefined;
  }
  if (raw === undefined) return getDefaultStateValue(type, structs) as FunctionArgument;
  try {
    return decodePushdataValue(raw, 0, type, structs).value as FunctionArgument;
  } catch {
    return undefined;
  }
}

/** One mapping collection as the artifact's state layout publishes it. */
type MappingCollection = NonNullable<StateLayout['collections']>[number];

/** The mapping collection an artifact publishes under `name`, or undefined for any other name. */
function mappingCollectionOf(artifact: Artifact, name: string): MappingCollection | undefined {
  return artifact.stateLayout?.collections?.find((candidate) => candidate.name === name && candidate.kind === 'mapping');
}

/** The slots a read's key(s) can name, the exact one first, or undefined for a key that is not one scalar value. */
function keySlotsOf(collection: MappingCollection, keys: readonly FunctionArgument[]): readonly Uint8Array[] | undefined {
  const scalarKeys = keys.filter((key): key is bigint | boolean | Uint8Array | string => (
    typeof key === 'bigint' || typeof key === 'boolean' || typeof key === 'string' || key instanceof Uint8Array
  ));
  if (scalarKeys.length !== keys.length) return undefined;
  return mappingKeySlotCandidates(scalarKeys, collection.keyTypes ?? [collection.keyType]);
}

/**
 * Builds the reader a frame resolves a mapping-backed state read with, from its own live deployment.
 *
 * A mapping's entries are separate nodes, so the caller's data-NFT state never carries the collection: the reader
 * finds the node the key's slot names among the deployment's own nodes and reads the value the node's tail (or its
 * continuation chunks) holds, in the form the body stores it (`mappingValueOf`). A node an earlier reach of the same
 * hop created is not in the deployment - the transaction has no input carrying it - and one it rewrote holds the bytes
 * from before that write, so the reader takes the bytes the last such reach left, which is what the body reads over.
 * Only a slot none of them holds is the language's default, exactly as the contract's own read yields, so a routing
 * over an absent key states the same value the body would. A node value the deployment cannot reassemble is left
 * unstated, which refuses the site by name rather than guessing.
 *
 * A node whose values do not chunk keeps the whole value in its view, and an earlier reach's view of it holds the
 * plan's placeholder until a settle learns it: the bytes that reach left are the value its plan states or the view a
 * settle learned (`recordWrittenNodes`), and a value its body computes that neither states is refused by name.
 */
export function liveMappingValueReader(
  artifact: Artifact,
  live: HopLiveDeployment,
  structs: Artifact['structs'],
): MappingValueReader {
  return (name, keys) => {
    const collection = mappingCollectionOf(artifact, name);
    if (collection === undefined) return undefined;
    // The value the body reads from the whole value a node holds; bytes the hop cannot reassemble state none.
    const held = (raw: Uint8Array | undefined): FunctionArgument | undefined =>
      (raw === undefined ? undefined : mappingValueOf(collection.valueType, raw, artifact, structs));
    // The bytes an earlier reach of this hop left a node holding.
    const left = (reached: NonNullable<HopLiveDeployment['rewrittenNodes']>[number]): FunctionArgument | undefined => {
      if (reached.value !== undefined) return held(reached.value);
      if (collection.chunkableValue === true) return held(joinedNodeValue(collection, reached.commitment, live));
      throw new PerCallProxyDeployError(
        `a call is routed through mapping "${name}" at a node an earlier reach of the hop leaves at a value its body `
        + 'computes, which the hop has not learned, so the call cannot be stated from it',
      );
    };
    const slots = keySlotsOf(collection, keys);
    if (slots === undefined) return undefined;
    const nodes = live.nodesByCollection.get(collection.name) ?? [];
    const nodeAt = (slot: Uint8Array): (typeof nodes)[number] | undefined => nodes.find((utxo) => {
      const commitment = utxo.token?.nft?.commitment;
      return commitment !== undefined && bytesEqual(decodeEntryCommitment(hexToBin(commitment)).slot, slot);
    });
    // A node earlier reaches of this hop rewrote: the deployment's own node for the slot holds the bytes from before
    // those writes, so the value the body reads is the one the last of them left (`reachedNodeValue`).
    const rewritten = (live.rewrittenNodes ?? []).findLast((candidate) =>
      candidate.collection === collection.name && slots.some((slot) => bytesEqual(candidate.slot, slot)));
    if (rewritten !== undefined) return left(rewritten);
    // Slot candidates are exact-first, so the exact key's node wins over a compatibility alias's.
    let node: (typeof nodes)[number] | undefined;
    for (const slot of slots) {
      node = nodeAt(slot);
      if (node !== undefined) break;
    }
    if (node === undefined) {
      // A node an earlier reach of this hop created is not among the deployment's own: it carries no input there,
      // and the value the body reads is the one that reach left, not the type default. The deployment's own nodes
      // are read first, so a node the transaction spends wins over a continuation of the same slot. A slot both
      // hold is a deployment that already carries the write, which is a plan the positions agree on. A long value's
      // chunk records are that reach's own outputs, which no deployment holds, so its value is the bytes it left.
      const continued = (live.continuedNodes ?? []).findLast((candidate) =>
        candidate.collection === collection.name && slots.some((slot) => bytesEqual(candidate.slot, slot)));
      if (continued === undefined) return mappingValueOf(collection.valueType, undefined, artifact, structs);
      return left(continued);
    }
    const commitment = node.token?.nft?.commitment;
    if (commitment === undefined) return undefined;
    return held(joinedNodeValue(collection, hexToBin(commitment), live));
  };
}

/**
 * The mappings a site reads a whole value of: each `stateAccess` its routing, condition or loop domain carries other
 * than as the struct a field is read from.
 *
 * The compiler publishes a field read where the site stands, folding into it every write of that field the entry
 * makes before the site (`conditionReadsWrittenState`), so the read it still carries is the value the frame starts
 * with. A read of a whole value is published as it is, whatever the entry wrote before the site.
 */
function wholeMappingReads(row: ExternalCallAbi): ReadonlySet<string> {
  const names = new Set<string>();
  const visit = (value: unknown, fieldOf: boolean): void => {
    if (value === null || typeof value !== 'object') return;
    const node = value as { readonly kind?: string; readonly name?: string };
    if (node.kind === 'stateAccess' && typeof node.name === 'string' && !fieldOf) names.add(node.name);
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (Array.isArray(child)) child.forEach((entry) => visit(entry, false));
      else visit(child, node.kind === 'field' && key === 'expression');
    }
  };
  visit(row, false);
  return names;
}

/**
 * The reader one site of a frame reads its mappings with, past the writes its own entry makes before the site.
 *
 * `base` reads a node as the frame starts, but a write the entry makes before the site leaves its key at the value
 * that write stores, which is the one the body reads there (`statedMappingWrites`): that value is read instead. A key
 * such a write leaves at a value its body computes, or one a write whose key the frame's facts do not determine may
 * have rewritten, is refused by name rather than read from the node as it was. The hop's own entry, whose site is
 * `site`, awaits the bytes of a node every such write keys instead (`EntryWriteValueAwaited`), which the hop learns
 * from the entry's own close of it.
 */
function readerPastOwnWrites(
  base: MappingValueReader | undefined,
  artifact: Artifact,
  writes: readonly StatedMappingWrite[],
  where: string,
  site?: number,
): MappingValueReader {
  return (name, keys) => {
    const collection = mappingCollectionOf(artifact, name);
    if (collection === undefined) return base?.(name, keys);
    const slots = keySlotsOf(collection, keys);
    const written = writes.filter((write) => write.collection === name && (write.slot === undefined
      || slots === undefined || slots.some((slot) => bytesEqual(slot, write.slot!))));
    if (written.length === 0) return base?.(name, keys);
    const value = written[0]!.value;
    if (value === undefined || written.some((write) => write.slot === undefined || write.value === undefined
      || !bytesEqual(write.value, value))) {
      const refusal = `${where} reads mapping "${name}" at a key the entry's own write before the call leaves at a `
        + 'value its published facts do not state, so the hop cannot state the call the body makes from it';
      const slot = written[0]!.slot;
      if (site !== undefined && slots !== undefined && slot !== undefined
        && written.every((write) => write.slot !== undefined && bytesEqual(write.slot, slot))) {
        throw new EntryWriteValueAwaited(refusal, site, name, slot);
      }
      throw new PerCallProxyDeployError(refusal);
    }
    return mappingValueOf(collection.valueType, value, artifact, artifact.structs);
  };
}

/** One dynamic field's value, joined from its chunk records and decoded as the field's own type declares. */
function dynamicFieldValue(
  deployment: PerCallDeploymentSet, layout: StateLayout, categoryId: string,
  field: StateVariableInfo, values: Readonly<Record<string, unknown>>,
): StateValue | undefined {
  const header = values[dynamicLenKey(field.name)];
  const length = typeof header === 'bigint' ? Number(header) : 0;
  if (!Number.isSafeInteger(length) || length < 0) return undefined;
  const span = chunkCountForLength(length);
  if (span > MAXIMUM_DYNAMIC_CHUNKS) return undefined;
  const lock = bytesToHex(chunkRecordLockingBytecode(categoryId, field.name, field.type));
  const chunks: Array<Uint8Array | undefined> = [];
  for (const utxo of deployment.chunks) {
    const commitment = utxo.token?.nft?.commitment;
    const lockingBytecode = utxo.lockingBytecode;
    if (commitment === undefined || lockingBytecode === undefined
      || bytesToHex(lockingBytecode) !== lock) continue;
    let chunk: { readonly chunkIndex: number; readonly chunkData: Uint8Array };
    try {
      chunk = parseChunkCommitment(commitment);
    } catch {
      return undefined;
    }
    if (chunk.chunkIndex < 0 || chunk.chunkIndex >= MAXIMUM_DYNAMIC_CHUNKS) return undefined;
    chunks[chunk.chunkIndex] = new Uint8Array(chunk.chunkData);
  }
  const parts = Array.from({ length: span }, (_unused, index) => chunks[index]);
  if (parts.some((part) => part === undefined)) return undefined;
  const joined = joinChunks(parts as Uint8Array[], length);
  const array = parseArrayTypeString(field.type);
  try {
    if (array !== undefined) {
      return (isFixedWidthType(array.elementType)
        ? unpackFixedWidthArray(joined, array.elementType)
        : joined.length === 0
          ? [] : decodePushdataValue(joined, 0, field.type, layout.structs).value) as StateValue;
    }
    return field.type === 'string' ? binToUtf8(joined) : joined;
  } catch {
    // A value the field's own declared type does not decode is left unstated, like one whose chunks are missing.
    return undefined;
  }
}

/** The live deployment a registered contract names, read from its artifact and category. */
function externalOfRegistered(registered: {
  readonly contract: unknown;
}): PerCallProxyExternal | undefined {
  const contract = registered.contract as {
    readonly artifact?: Artifact;
    readonly inner?: { readonly artifact?: Artifact };
    readonly categoryId?: string;
    readonly proxy?: { readonly categoryId?: string };
    readonly perCallProxy?: { readonly artifact?: Artifact; readonly implementationCategoryId?: string };
  };
  const artifact = contract.inner?.artifact ?? contract.artifact;
  const categoryId = contract.proxy?.categoryId ?? contract.categoryId;
  const proxy = contract.perCallProxy;
  return artifact === undefined || categoryId === undefined ? undefined : {
    artifact,
    categoryId,
    ...(proxy?.artifact === undefined ? {} : { proxyArtifact: proxy.artifact }),
    ...(proxy?.implementationCategoryId === undefined
      ? {} : { implementationCategoryId: proxy.implementationCategoryId }),
  };
}

/** The deployment one call's target address names, from the provider's registrations. */
function externalOfAddress(provider: NetworkProvider, target: Uint8Array): PerCallProxyExternal | undefined {
  const registered = findDeploymentByLockingBytecode(provider, binToHex(target))
    ?? findDeploymentByAddress(provider, binToHex(target));
  return registered === undefined ? undefined : externalOfRegistered(registered);
}

/** The deployment a call's interface names, stripping the Solidity interface's leading `I`. */
function externalOfName(provider: NetworkProvider, interfaceName: string): PerCallProxyExternal | undefined {
  for (const name of [interfaceName, interfaceName.replace(/^I/, '')]) {
    const registered = findDeploymentByName(provider, name);
    if (registered === undefined) continue;
    const external = externalOfRegistered(registered);
    if (external !== undefined) return external;
  }
  return undefined;
}

/**
 * The deployment a call reaches, from the provider's registrations: the address the site carries first, then the
 * interface the call names.
 *
 * The hop and the off-chain read resolve a call the same way, so the walk lives here and both take it. An empty
 * target names no address, so only the interface is tried.
 */
export function registeredExternalFor(
  provider: NetworkProvider, target: Uint8Array, interfaceName: string,
): PerCallProxyExternal | undefined {
  return (target.length === 0 ? undefined : externalOfAddress(provider, target))
    ?? externalOfName(provider, interfaceName);
}

/** The successor a reach left one node of a collection with. */
interface ReachedLink {
  readonly collection: string;
  readonly slot: Uint8Array;
  readonly next: Uint8Array;
}

/** The hop's own root as a frame below it reaches it again (`HopExternalPlanOptions.reentrantRoot`). */
interface ReentrantRoot {
  /** The address the root runs as, its proxy's, which a call back to it targets. */
  readonly address: Uint8Array;
  /** The root's deployment as a callee behind its proxy. */
  readonly external: PerCallProxyExternal;
  /** The entry the root runs. */
  readonly functionName: string;
}

/** The planner's running state: the live deployments it resolves against and the frames it has placed. */
interface PlanContext {
  readonly provider: NetworkProvider;
  readonly externals: Readonly<Record<string, PerCallProxyExternal>>;
  readonly validatorProgram: Uint8Array;
  /** The contracts the hop's own root fixes at one master: its implementation, entered by its proxy. */
  readonly fixed: Set<string>;
  /** The hop's own root, when a frame below it may call back into it; absent, such a call is refused by name. */
  readonly root?: ReentrantRoot;
  /** How many masters of each callee category the hop has taken from that deployment's live pool. */
  readonly masterSlots: Map<string, number>;
  /** The block each callee category's frames and records sit in, by category id (`deploymentBlockId`). */
  readonly blocks: Map<string, string>;
  /** The live deployments already read, keyed by category id. */
  readonly deployments: Map<string, PerCallDeploymentSet>;
  /** The records of each callee category, shared by every master the hop places for that deployment. */
  readonly records: Map<string, readonly HopCalleeRecord[]>;
  /**
   * Every node the reaches placed so far created, keyed by the category its ids are built with.
   *
   * Each reach is planned against the deployment alone, so a reach that follows another's write over one node has
   * to be told what that write left: this is that view, in placement order, with the bytes the node holds where they
   * are known (`recordWrittenNodes`).
   */
  readonly writtenNodes: Map<string, {
    collection: string;
    slot: Uint8Array;
    commitment: Uint8Array;
    value?: Uint8Array;
  }[]>;
  /**
   * Every node the reaches placed so far rewrote in place, by category, with the bytes the node holds where they are
   * known (`recordWrittenNodes`).
   *
   * A node the deployment holds is still spent by the transaction, so a later reach's declaration starts from the
   * view the chain walk carries to it. What a later reach needs told is the *bytes* the reach before it left: the run
   * of chunk records a chunking value's write takes is sized from them, a call routed through the node's value is
   * stated from them, and the deployment's own node and chunks hold only the bytes from before that write.
   */
  readonly rewrittenNodes: Map<string, {
    collection: string;
    slot: Uint8Array;
    commitment: Uint8Array;
    value?: Uint8Array;
  }[]>;
  /**
   * The successor every node the reaches placed so far wrote holds after the last of them, by category and then by
   * collection and slot.
   *
   * An insert relinks its predecessor, so a later reach's batch is planned against the list these links make: the
   * deployment's nodes, the nodes the earlier reaches created, and the successors they left each of them with.
   */
  readonly reachedLinks: Map<string, Map<string, ReachedLink>>;
  /** The end views a previous settle learned, per frame master, in each frame's own learning order. */
  readonly calleeWriteViews?: ReadonlyMap<string, readonly (Uint8Array | undefined)[]>;
  /**
   * The whole value a previous settle learned for a frame's chunkable mapping write, per frame master.
   *
   * A write whose value the artifact does not publish states its run unstated, so the first plan lays no chunk
   * records; the frame's own close exposes the value, and every pass after that one sizes the run from it. The bytes
   * a settle of the hop's own entry learned its write leaves a node at are held under `entryWriteValueKey`.
   */
  readonly calleeWriteValues?: ReadonlyMap<string, Uint8Array>;
  /** Callee frames in placement order; a slot is reserved before the callee's own calls are planned. */
  readonly callees: HopCallee[];
  readonly utxos: Map<string, Utxo>;
  /** The compute side-cars each frame co-spends, keyed by master, in the order its body reads them. */
  readonly sideCars: Map<string, RecoverySideCars>;
  /**
   * The results an earlier planning pass learned, keyed by the publishing artifact and its callsite ids.
   *
   * A condition gated on an earlier call's result is decided from these on the next pass; absent leaves every such
   * condition undecided for this pass.
   */
  readonly producerResults?: { readonly artifact: Artifact; readonly values: ReadonlyMap<number, FunctionArgument> };
  /** The results settled earlier calls returned, keyed by `reachedResultKey`: the calling frame's path and site. */
  readonly reachedResults: ReadonlyMap<string, FunctionArgument>;
  /** The site the plan stops before, once one is found: nothing after it in execution order is placed. */
  readonly stop: { blocked?: HopPlanBlock };
  /** The entry's own site the plan is asked to stop before (`HopExternalPlanOptions.stopBefore`). */
  readonly stopBefore?: number;
}

/** The addresses of the contracts a plan can reach: the caller's named externals, then the latest registrations. */
function* reachableAddresses(ctx: PlanContext): Generator<Uint8Array> {
  for (const external of Object.values(ctx.externals)) {
    yield validatorAddress(hexToBin(external.categoryId), ctx.validatorProgram);
  }
  for (const registered of [...listDeployments(ctx.provider)].reverse()) {
    const external = externalOfRegistered(registered);
    if (external !== undefined) yield validatorAddress(hexToBin(external.categoryId), ctx.validatorProgram);
  }
}

/** The deployment a call reaches: the caller's named externals first, then the provider's registrations. */
function resolveExternal(ctx: PlanContext, row: ExternalCallAbi, target: Uint8Array): PerCallProxyExternal {
  const expected = (external: PerCallProxyExternal): string =>
    binToHex(validatorAddress(hexToBin(external.categoryId), ctx.validatorProgram)).slice(-16);
  const named = ctx.externals[row.interfaceName];
  if (hopTraceOn()) {
    hopTrace(`resolve ${row.interfaceName}.${row.functionName} target=${binToHex(target).slice(-16)} `
      + `named=${named === undefined ? 'none' : `${named.artifact.contractName}@${expected(named)}`}`);
  }
  if (named !== undefined) return named;
  const atTarget = Object.values(ctx.externals).find((candidate) =>
    bytesEqual(validatorAddress(hexToBin(candidate.categoryId), ctx.validatorProgram), target));
  if (atTarget !== undefined) {
    if (hopTraceOn()) hopTrace(`resolve matched-at-target ${atTarget.artifact.contractName}`);
    return atTarget;
  }
  const external = registeredExternalFor(ctx.provider, target, row.interfaceName);
  if (external !== undefined && hopTraceOn()) {
    hopTrace(`resolve provider ${external.artifact.contractName}@${expected(external)}`);
  }
  if (external === undefined) {
    throw new PerCallProxyDeployError(
      `the call to "${row.interfaceName}.${row.functionName}" targets ${binToHex(target)}, and none of the `
      + "deployment's contracts sits at that address",
    );
  }
  return external;
}

/** True when a call's target is the hop's own root: its address, or the 20-byte identity that address projects to. */
function targetsRoot(root: ReentrantRoot | undefined, target: Uint8Array): boolean {
  if (root === undefined) return false;
  return bytesEqual(target, root.address)
    || (target.length === 20 && bytesEqual(lockOfIdentity(target, [root.address]), root.address));
}

/**
 * How many frames on the path down to frame `enteredBy` run the root's entry `entry`, the root's own frame included.
 *
 * A call back to the root that runs an entry two of them already run repeats a re-entry: the execution gets past it
 * only when a frame refuses first, as a reentrancy guard does, or runs out of what it can spend, so such a frame is
 * placed without its own calls and the frames above it are the ones the settle judges.
 */
function rootEntryRuns(ctx: PlanContext, enteredBy: number | null, entry: string): number {
  const root = ctx.root!;
  let runs = root.functionName === entry ? 1 : 0;
  for (let at = enteredBy; at !== null; at = ctx.callees[at]!.enteredBy) {
    const frame = ctx.callees[at]!;
    if (frame.categoryId === root.external.implementationCategoryId && frame.entry === entry) runs += 1;
  }
  return runs;
}

/**
 * The results one frame's sites may read, by callsite id: what the settles learned for the frame's earlier calls,
 * and, for the hop's own entry, the results a conditional re-plan learned.
 *
 * The results of earlier calls are only meaningful within the frame that made them: the callsite ids a condition or
 * an argument names are that artifact's own call sites, so a frame never sees another frame's results.
 */
function knownResultsOf(
  ctx: PlanContext, artifact: Artifact, path: string,
): ReadonlyMap<number, FunctionArgument> | undefined {
  const known = new Map<number, FunctionArgument>(
    path === '' && ctx.producerResults?.artifact === artifact ? ctx.producerResults.values : [],
  );
  const prefix = `${path}|`;
  for (const [key, value] of ctx.reachedResults) {
    if (!key.startsWith(prefix)) continue;
    const callsiteId = Number(key.slice(prefix.length));
    if (Number.isInteger(callsiteId)) known.set(callsiteId, value);
  }
  return known.size === 0 ? undefined : known;
}

/** The learned results one site's argument sources read, keyed the way the expression evaluator reads them. */
function argumentReturnsOf(
  row: ExternalCallAbi, routing: readonly ExternalCallAbi[], known: ReadonlyMap<number, FunctionArgument> | undefined,
): ReadonlyMap<string, FunctionArgument> | undefined {
  const sources = row.argSources ?? [];
  if (known === undefined || sources.every((source) => producerCallsitesOf(source).length === 0)) return undefined;
  try {
    const bound = externalReturnsForCallsites(sources, known, routing);
    return bound.size === 0 ? undefined : bound;
  } catch {
    return undefined;
  }
}

/**
 * The earlier call sites of one frame whose results a site reads and no settle has learned yet.
 *
 * The site waits for each of them: each is an earlier site of the same frame that this plan places, so settling the
 * calls before the site learns its result, and the site is planned from it. A result the hop cannot learn that way
 * is not waited for (one a loop returns once per turn, one of a site the plan places no call for), so a site that
 * reads one stays refused by name, as it is when nothing is learned.
 */
export function waitingProducers(
  nodes: readonly (ExternalCallExpression | ArgSource)[],
  site: number,
  routing: readonly ExternalCallAbi[],
  placed: readonly unknown[],
  known: ReadonlyMap<number, FunctionArgument> | undefined,
): readonly number[] {
  const waiting = new Set<number>();
  for (const callsiteId of nodes.flatMap(producerCallsitesOf)) {
    if (known?.has(callsiteId) === true) continue;
    const at = routing.findIndex((row) => row.callsiteId === callsiteId);
    if (at < 0 || at >= site || placed[at] === undefined) continue;
    if ((routing[at]!.occurrence ?? 'once') === 'loop') continue;
    waiting.add(callsiteId);
  }
  return [...waiting];
}

/** What one published site was resolved to in pass one, before any of its frames is placed. */
interface ResolvedSite {
  readonly entry: AbiEntryRow;
  readonly external: PerCallProxyExternal;
  readonly resolved: readonly ResolvedCall[];
  readonly where: string;
  /** The turn each resolved call runs in, parallel to `resolved`: a guarded loop's skipped turns are left out. */
  readonly turns: readonly number[];
}

/** Where a site's callee frames sit in the plan: the calling frame's path, the site and its callsite id. */
interface CalleeReach {
  readonly callerPath: string;
  readonly site: number;
  readonly callsiteId: number;
  /** The turn each of the site's calls runs in, which names its frame; its place in the list takes a master. */
  readonly turns: readonly number[];
}

/** The calls one entry's body makes as a plan states them, and whether the plan stopped inside them. */
interface PlannedEntryCalls {
  readonly calls: DraftCall[];
  readonly callBases: number[];
  readonly callsiteIds: number[];
  /** True when the plan stopped before one of this entry's own sites or inside a callee one of them reached. */
  readonly truncated: boolean;
}

/**
 * Plans the calls one entry's body makes, and — transitively — the frames each of them reaches.
 *
 * The caller's own facts (its arguments, its state, its own address and its sender) are what each call site is
 * resolved from, and the live records of each callee are read so the callee's own call sites resolve from *its*
 * facts. `enteredBy` is the index in `ctx.callees` of the master that calls this entry, or null for the
 * implementation's own master; the frames this entry reaches are appended to `ctx.callees`. `path` names this frame
 * from the hop's own entry (`HopCallee.path`).
 *
 * Every call site's record count, target, frame kind and argument pushes are resolved first, so a shape the hop
 * cannot declare is refused without depending on a deployment. Only then is each callee's live deployment read, and
 * its own calls planned from it. A site the caller's own facts give no visits fills no record, so it places no
 * callee and the rest of it need not resolve.
 *
 * A site whose argument or loop bound reads an earlier call's result is planned in execution order: while no settle
 * has learned that result, the plan stops before the site (`ctx.stop`), placing the calls before it and nothing the
 * execution reaches after it, so the hop can settle the earlier call, learn what it returned and plan again from it.
 * A stop inside a callee's own calls stops this frame after the site that reached that callee.
 *
 * Each record a site fills runs on a master of its own, so a site whose arguments differ turn to turn — a loop
 * over the caller's own array, say — reaches a contract once per master it takes. The positions the plan states
 * for the calls are the execution's own, which a site the plan places nothing for leaves out: `callBases` maps
 * each published site to the first call the plan states for it, or `-1` when it states none.
 */
async function planEntryCalls(
  ctx: PlanContext,
  caller: HopCallInputs,
  enteredBy: number | null,
  path: string,
): Promise<PlannedEntryCalls> {
  const identity = `${caller.artifact.contractName}.${caller.functionName}()`;
  const published = readPublishedStopSites(caller.artifact).entries
    .find((entry) => entry.functionName === identity);
  if (published === undefined || published.calls.length === 0) {
    return { calls: [], callBases: [], callsiteIds: [], truncated: false };
  }
  const routing = routingOf(caller.artifact, caller.functionName);
  const resolver = makeCallResolver(caller);
  const writtenState = entryWrittenState(caller.artifact, caller.functionName);
  const known = knownResultsOf(ctx, caller.artifact, path);
  // The mapping writes the entry's own body makes: a site after one reads the value it leaves (`readerPastOwnWrites`).
  // The hop's own entry states beside its facts the bytes a settle of it learned a write leaves (`written-values.ts`).
  const root = path === '';
  const ownWrites = statedMappingWrites(
    caller.artifact, caller.functionName, caller.args, caller.senderAddress, caller.stateValues,
    root ? (collection, slot) => ctx.calleeWriteValues?.get(entryWriteValueKey(collection, slot)) : undefined,
    caller.readMappingValue);

  // Pass one: resolve every site of this entry from the caller's own facts and the results learned for its earlier
  // calls, so the plan is refused for its own shape before any live record is read. A site that reads a result no
  // settle has learned ends the pass: the sites after it are planned once that result is learned.
  const sites: (ResolvedSite | undefined)[] = [];
  let ownStop: HopPlanBlock | undefined;
  for (const [index, call] of published.calls.entries()) {
    // A plan asked to stop before one of the entry's own sites places the calls before it and nothing after.
    if (path === '' && index === ctx.stopBefore) {
      ownStop = {
        path, where: `the call to "${call.interfaceName}.${call.functionName}"`, reads: 'refusal', producers: [],
      };
      break;
    }
    const row = routing[index];
    if (row === undefined || row.interfaceName !== call.interfaceName
      || row.functionName !== call.functionName) {
      throw new PerCallProxyDeployError(
        `the entry "${caller.functionName}" publishes call ${index} to `
        + `"${call.interfaceName}.${call.functionName}", which its ABI routing does not describe`,
      );
    }
    const where = `the call to "${row.interfaceName}.${row.functionName}"`;
    const domain = row.occurrence === 'loop' ? row.iterationDomain : undefined;
    // A loop's own guard decides which of its turns call, so it is read in execution order as its bound is.
    const guard = row.occurrence === 'loop' ? row.condition ?? undefined : undefined;
    const boundWaits = waitingProducers([
      ...(domain === undefined ? [] : [domain.initialValue, domain.stepValue, domain.continueCondition]),
      ...(guard === undefined ? [] : [guard]),
    ], index, routing, sites, known);
    if (boundWaits.length > 0) {
      ownStop = { path, where, reads: 'loop-bound', producers: boundWaits };
      break;
    }
    // A whole value the site reads of a mapping is read past the writes the frame's own entry makes before it.
    const wholeReads = wholeMappingReads(row);
    const writtenBefore = ownWrites.filter((write) => wholeReads.has(write.collection)
      && writeLandsBefore(published.writeSegments, write.collection, index));
    const siteCaller: HopCallInputs = writtenBefore.length === 0 ? caller : {
      ...caller,
      readMappingValue: readerPastOwnWrites(
        caller.readMappingValue, caller.artifact, writtenBefore, where, root ? index : undefined),
    };
    const siteBase = siteCaller === caller ? resolver : makeCallResolver(siteCaller);
    const count = occurrenceCountOf(
      row, caller.args, siteBase, where, caller.artifact, writtenState, index, routing, known,
    );
    const turns = callingTurnsOf(row, count, siteBase, caller.artifact, writtenState, index, routing, known);
    // A site the caller's own facts give no visits fills no record: it reaches no callee, so nothing is placed
    // for it and its target and arguments need not resolve.
    if (turns.length === 0) {
      sites.push(undefined);
      continue;
    }
    const argumentWaits = waitingProducers(row.argSources ?? [], index, routing, sites, known);
    if (argumentWaits.length > 0) {
      ownStop = { path, where, reads: 'argument', producers: argumentWaits };
      break;
    }
    const argumentReturns = argumentReturnsOf(row, routing, known);
    const siteResolver = argumentReturns === undefined
      ? siteBase : makeCallResolver({ ...siteCaller, argumentReturns });
    // The stop site's baked target is the address the compiler pinned into the caller's own code; the ABI routing
    // carries it as `addressLiteral` for a literal and leaves it empty for one the caller computes.
    const effective: ExternalCallAbi = row.addressLiteral === undefined && call.target.length > 0
      ? { ...row, addressLiteral: call.target }
      : row;
    const target = resolveCallTarget(effective, siteCaller, siteResolver, turns[0]!);
    // A target the source names as the zero address has no deployment to place a callee on. The hop states no
    // record for the site and lets the entry's own body decide: a body that guards the call never reaches it and
    // is settled on its own refusal, while one that does reach it stalls on the record the hop never filled rather
    // than reaching a contract it did not name.
    if (target === undefined) {
      sites.push(undefined);
      continue;
    }
    // A call back to the hop's own root enters the root's deployment again, as a callee behind its proxy.
    const reentry = targetsRoot(ctx.root, target);
    const external = reentry ? ctx.root!.external : resolveExternal(ctx, row, target);
    const entry = entryRowOf(external.artifact, row.functionName);
    // A body the compiler refused publishes no call sites, so the hop could declare no record for it and would
    // settle its frame against a program whose calls stay unbound. The refusal is named here, before any frame is
    // placed, exactly as the hop names a refused entry of its own.
    const refusal = refusedEntryReason(external.artifact, row.functionName);
    if (refusal !== undefined) {
      throw new PerCallProxyDeployError(
        `${where} reaches "${external.artifact.contractName}.${row.functionName}()", which the compiler refused: `
        + refusal,
      );
    }
    // An address the caller holds as the identity a call result carried reaches the callee as the lock it names.
    const lockOf = (identity: Uint8Array): Uint8Array => lockOfIdentity(identity, reachableAddresses(ctx));
    const resolved = turns.map((turn) => (
      resolvePublishedCall(effective, external.artifact, siteCaller, siteResolver, turn, lockOf)
    ));
    // A callee behind its own proxy is two contracts, and the hop's own implementation is one the composition
    // fixes: a call back to the root itself is placed on the root's own deployment, and any other reach of the
    // implementation is refused by name here, before any live record is read.
    const placedNames = external.proxyArtifact === undefined
      ? [external.artifact.contractName]
      : [external.proxyArtifact.contractName, external.artifact.contractName];
    for (const name of placedNames) {
      if (ctx.fixed.has(name) && !reentry) {
        throw new PerCallProxyDeployError(
          `${where} reaches "${name}", which this hop already places; a contract that reaches itself below `
          + 'itself cannot be given a second block in the hop',
        );
      }
    }
    sites.push({ entry, external, resolved, where, turns });
  }

  // Pass two: read each callee's live deployment, take a master per reach from its pool, plan the callee's own
  // calls from the values that deployment holds, and place its frames. A stop inside a callee's own calls is
  // earlier in execution order than anything after that callee, so nothing after it is placed.
  const calls: DraftCall[] = [];
  const callBases: number[] = [];
  const callsiteIds: number[] = [];
  for (const [index, site] of sites.entries()) {
    if (ctx.stop.blocked !== undefined) break;
    const callsiteId = routing[index]!.callsiteId ?? -1;
    callsiteIds.push(callsiteId);
    if (site === undefined) {
      callBases.push(-1);
      continue;
    }
    callBases.push(calls.length);
    const { external, entry, resolved, where, turns } = site;
    const reach: CalleeReach = { callerPath: path, site: index, callsiteId, turns };
    // A callee whose address names a per-call proxy is placed as the same chain the root hop places for its own
    // proxy: the proxy's fallback frame, then the implementation entry it delegates to on the proxy's records.
    if (external.proxyArtifact !== undefined && external.implementationCategoryId !== undefined) {
      await placeProxiedCallee(ctx, caller, enteredBy, external, entry, resolved, calls, where, reach);
      continue;
    }
    await placeCalleeMasters(ctx, caller, enteredBy, external, entry, resolved, calls, where, reach);
  }
  if (ctx.stop.blocked === undefined && ownStop !== undefined) ctx.stop.blocked = ownStop;
  return { calls, callBases, callsiteIds, truncated: ctx.stop.blocked !== undefined };
}

/** The live deployment a category names, read once however many sites reach it. */
async function deploymentOf(
  ctx: PlanContext, categoryId: string, layout: StateLayout,
): Promise<PerCallDeploymentSet> {
  const cached = ctx.deployments.get(categoryId);
  if (cached !== undefined) return cached;
  const read = await readPerCallDeployment(ctx.provider, categoryId, layout);
  ctx.deployments.set(categoryId, read);
  return read;
}

/**
 * The live deployment a reach placed now plans its writes against: the category's deployment, and what the reaches
 * placed before it wrote there.
 */
function reachedDeploymentOf(
  ctx: PlanContext, categoryId: string, deployment: PerCallDeploymentSet, layout: StateLayout,
): HopLiveDeployment {
  return liveDeploymentOf(categoryId, deployment, layout, ctx.writtenNodes.get(categoryId) ?? [],
    ctx.rewrittenNodes.get(categoryId) ?? [], [...(ctx.reachedLinks.get(categoryId)?.values() ?? [])]);
}

/** The live deployment a frame's own writes are planned against, as `hopEntryWrites` states it. */
function liveDeploymentOf(
  categoryId: string, deployment: PerCallDeploymentSet, layout: StateLayout,
  written: readonly {
    readonly collection: string;
    readonly slot: Uint8Array;
    readonly commitment: Uint8Array;
    readonly value?: Uint8Array;
  }[] = [],
  rewritten: readonly {
    readonly collection: string;
    readonly slot: Uint8Array;
    readonly commitment: Uint8Array;
    readonly value?: Uint8Array;
  }[] = [],
  links: readonly ReachedLink[] = [],
): HopLiveDeployment {
  // Each list is copied: a reach is planned, and planned again from a value its close exposed, against what the
  // reaches before it left, not against what the ones placed after it add.
  return {
    // What the already-placed reaches of this hop wrote: a node one of them created is not in the deployment, and
    // a later reach's write over it continues from the view that reach left.
    ...(written.length === 0 ? {} : { continuedNodes: [...written] }),
    // A node an earlier reach rewrote is one the deployment still holds and the transaction still spends, so this
    // states only the bytes that reach left, which the deployment's own node does not hold.
    ...(rewritten.length === 0 ? {} : { rewrittenNodes: [...rewritten] }),
    // The successors the earlier reaches' inserts left their predecessors with, which the list is planned against.
    ...(links.length === 0 ? {} : { reachedLinks: [...links] }),
    category: hexToBin(categoryId),
    recordCommitments: deployment.records.map((record) => {
      const commitment = record.token?.nft?.commitment;
      if (commitment === undefined) {
        throw new PerCallProxyDeployError(
          `the callee's category ${categoryId} holds a record with no commitment`,
        );
      }
      return new Uint8Array(hexToBin(commitment));
    }),
    chunks: [...deployment.chunks, ...deployment.collectionNodes],
    nodesByCollection: deployment.nodesByCollection,
    // A key the artifact publishes as a state read is the value the frame itself reads, so the deployment's own
    // records are decoded into the same view the frame's data slots carry.
    state: deploymentStateValues(layout, categoryId, deployment) as Readonly<Record<string, StateValue>>,
  };
}

/**
 * Records the nodes one reach created and rewrote, and the links it left, for the reaches placed after it.
 *
 * A reach is planned against the deployment, which does not hold a node another reach of the same hop created in
 * this transaction: the reach that writes over one has to continue from the view this reach left, so the node and
 * that view are what this keeps. A node a reach spent the deployment holds, and a reach that writes it chains through
 * the shared participant the plan already places, so of a node this reach rewrote only the bytes it left are kept,
 * which the deployment's own node does not hold. The successor each written node holds is recorded either way, so a
 * later insert splices into the list this reach left.
 *
 * The bytes a node holds are kept where they are known: a chunking value the plan states, and for a node whose values
 * do not chunk, the view a settle learned or the value the reach's own published facts state for its key
 * (`statedMappingWrites`). Such a node keeps its whole value in its view, which the plan starts from a placeholder,
 * so one whose value its body computes and no settle has learned is kept without bytes: a call later routed through
 * it is refused by name (`liveMappingValueReader`).
 */
function recordWrittenNodes(
  ctx: PlanContext, categoryId: string, writes: HopEntryWrites | undefined,
  learned: readonly (Uint8Array | undefined)[] | undefined, stated: readonly StatedMappingWrite[],
): void {
  const nodes = writes?.writtenNodes ?? [];
  if (nodes.length === 0) return;
  const created = nodes.filter((node) => !node.existed);
  const order = writes?.learningSlotOrder ?? [];
  const learningIndexOf = (node: { readonly slot: Uint8Array }): number =>
    order.findIndex((slot) => bytesEqual(slot, node.slot));
  if (hopTraceOn()) {
    // What a reach leaves for the reaches after it: the slot head, the commitment's width and its last byte are
    // enough to tell one written node from another for the same slot, and the learning index says whether the
    // settle's own end view for the node is available to record instead of the plan's placeholder.
    for (const node of nodes) {
      const at = learningIndexOf(node);
      hopTrace(`reach-written ${categoryId.slice(0, 8)} ${node.collection} `
        + `slot=${binToHex(node.slot).slice(0, 16)} len=${String(node.commitment.length)} `
        + `tail=${binToHex(node.commitment.slice(-4))} at=${String(at)} `
        + `learned=${String(at < 0 ? -1 : learned?.[at]?.length ?? -1)}`);
    }
  }
  // A node whose end view the settle learned carries that view rather than the plan's placeholder: the reaches
  // planned after this one read the value the frame's own record closes with, so a target whose value the body
  // computes is not defaulted to the type's zero.
  const commitmentOf = (node: { readonly slot: Uint8Array; readonly commitment: Uint8Array }): Uint8Array => {
    const at = learningIndexOf(node);
    return (at < 0 ? undefined : learned?.[at]) ?? node.commitment;
  };
  const chunking = new Set((writes?.reachWrites ?? [])
    .filter((write) => write.chunkable).map((write) => write.collection));
  // The bytes a written node holds where they are known: a value of a node that does not chunk is the tail of the
  // view a settle learned, or the one value the reach's own facts state for the key.
  const valueOf = (node: (typeof nodes)[number]): Uint8Array | undefined => {
    if (node.value !== undefined || chunking.has(node.collection)) return node.value;
    const at = learningIndexOf(node);
    const view = at < 0 ? undefined : learned?.[at];
    if (view !== undefined) return decodeEntryCommitment(view).value;
    const writing = stated.filter((write) => write.collection === node.collection
      && (write.slot === undefined || bytesEqual(write.slot, node.slot)));
    const value = writing[0]?.value;
    return value !== undefined && writing.every((write) => write.slot !== undefined && write.value !== undefined
      && bytesEqual(write.value, value)) ? value : undefined;
  };
  const withValue = (node: (typeof nodes)[number]): {
    collection: string; slot: Uint8Array; commitment: Uint8Array; value?: Uint8Array;
  } => {
    const value = valueOf(node);
    return {
      collection: node.collection, slot: node.slot, commitment: commitmentOf(node),
      ...(value === undefined ? {} : { value }),
    };
  };
  const held = ctx.writtenNodes.get(categoryId) ?? [];
  held.push(...created.map(withValue));
  ctx.writtenNodes.set(categoryId, held);
  // The successor the plan writes each node with: an update keeps it, an insert's relink and the node it creates set
  // it. A value the body computes is not stated here; the chain walk carries it to the reaches after this one.
  const links = ctx.reachedLinks.get(categoryId) ?? new Map<string, ReachedLink>();
  for (const node of nodes) {
    links.set(`${node.collection}|${bytesToHex(node.slot)}`, {
      collection: node.collection, slot: node.slot, next: decodeEntryCommitment(node.commitment).nextKey,
    });
  }
  ctx.reachedLinks.set(categoryId, links);
  // A node this reach rewrote is one the deployment still holds and the transaction still spends, so a later reach
  // reads the input's own bytes unless it is told what this reach left: the bytes a chunking value's run is sized
  // from, and the value a call routed through the node is stated from. A node whose values do not chunk and that the
  // write only relinks keeps its value, and its declarations chain through the one participant the plan places.
  const targeted = (node: (typeof nodes)[number]): boolean => (writes?.reachWrites ?? []).some((write) =>
    write.collection === node.collection && write.targets.some((target) => bytesEqual(target.slot, node.slot)));
  const rewritten = nodes.filter((node) => node.existed && (chunking.has(node.collection) || targeted(node)));
  if (rewritten.length === 0) return;
  const heldRewritten = ctx.rewrittenNodes.get(categoryId) ?? [];
  heldRewritten.push(...rewritten.map(withValue));
  ctx.rewrittenNodes.set(categoryId, heldRewritten);
}

/**
 * The records one callee frame's own entry writes beyond the records its frame declares.
 *
 * The frame's `msg.sender` is the caller's own address, which a write keyed by the sender resolves to, and the
 * deployment is the one that frame runs on: its own records and collection nodes for a call frame, the proxy's for
 * the delegate frame a proxied callee reaches. A key the entry only reads beside its batch is one of the frame's
 * `readNodes`, declared kept ahead of the batch's groups as its code counts them, so it is planned, not refused.
 *
 * A body that writes a sorted mapping walks every group of its batch whichever path it takes, so a batch this planner
 * cannot state is refused by name, naming the callee, rather than left to a frame that cannot settle; so is a read
 * naming a node the batch also spends by another id, which one transaction cannot spend twice. A dynamic value's run
 * is read only where its write runs, so an entry that writes no batch keeps a plan without the run: a path that skips
 * the write still settles, and one that takes it is refused by the callee's own frame.
 */
function calleeEntryWrites(
  artifact: Artifact,
  functionName: string,
  args: readonly FunctionArgument[],
  senderAddress: Uint8Array | undefined,
  live: HopLiveDeployment,
  readNodes: readonly HopCalleeReadNode[],
  categoryId: string,
  learnedValue?: Uint8Array,
): HopEntryWrites | undefined {
  const callee = `${artifact.contractName}.${functionName}()`;
  // The values the nodes hold as the reaches before this one left them.
  const readMappingValue = liveMappingValueReader(artifact, live, artifact.structs);
  let writes: HopEntryWrites | undefined;
  try {
    writes = hopEntryWrites({
      artifact,
      functionName,
      args,
      callerLockingBytecode: senderAddress ?? new Uint8Array(0),
      liveDeployment: live,
      writtenCommitments: live.recordCommitments,
      declaredReadSlots: readNodes.map((node) => node.slotIndex),
      // A node is the contract's, not the reach's: every reach that touches it names the same participant.
      nodeIdOf: (collection, slot) => sharedNodeId(categoryId, collection, slot),
      // A key the write reads out of another mapping is the value that node holds, the view its read node declares.
      readMappingValue,
      ...(learnedValue === undefined ? {} : { learnedValue }),
      // A write a branch guards is decided from the state and the nodes the reaches before this one left.
      activationFacts: { stateValues: live.state ?? {}, readMappingValue },
    });
  } catch (error) {
    const fn = artifact.abi.find((candidate) => candidate.name === functionName);
    if ((fn?.sortedBatchInfo ?? []).length === 0) return undefined;
    throw new PerCallProxyDeployError(`the callee "${callee}" writes records this hop cannot declare: `
      + `${error instanceof Error ? error.message : String(error)}`);
  }
  // A node the batch spends and the entry also reads, an allowance a token reads before it rewrites it, is one input
  // when both name it by its shared id: the read is declared kept ahead of the batch's transition of it, as the hop
  // declares its own frame's (`batchSpentReads`). A read naming it by another id would spend it a second time.
  const spentAs = new Map([...writes?.spentUtxos ?? []].map(([id, utxo]) => [`${utxo.txid}:${utxo.vout}`, id]));
  const shared = readNodes.find((node) => {
    const spentId = node.utxo === undefined ? undefined : spentAs.get(`${node.utxo.txid}:${node.utxo.vout}`);
    return spentId !== undefined && spentId !== node.id;
  });
  if (shared !== undefined) {
    throw new PerCallProxyDeployError(
      `the callee "${callee}" reads mapping "${shared.collection}" at a node its batch also spends, which one `
      + 'transaction cannot spend twice',
    );
  }
  return writes;
}

/**
 * The compute side-cars one callee frame's own body reads, over the provider's live pool.
 *
 * A body that hashes a runtime value or recovers a signer reads one side-car per call immediately after its own
 * input; the pushes the caller records for the call are what those calls' scalars are read from. A frame whose
 * entry publishes neither reads none, and contributes nothing.
 */
async function calleeSideCars(
  ctx: PlanContext,
  master: string,
  artifact: Artifact,
  entryName: string,
  argumentPushes: readonly Uint8Array[],
): Promise<void> {
  const abiFunction = artifact.abi.find((candidate) => candidate.name === entryName);
  if (abiFunction === undefined) return;
  // A recovery call is published either by its argument sources or, when the sources are absent, by its per-call
  // flag, so both have to be absent for the frame to read no side-car.
  const hashes = (abiFunction.keccakPreimageParams ?? []).length > 0;
  const recovers = (abiFunction.ecrecoverArgParams ?? []).length > 0
    || (abiFunction.ecrecoverEvmFlags ?? []).length > 0;
  if (!hashes && !recovers) return;
  const sideCars = await entrySideCars({
    provider: ctx.provider, master, abiFunction, argumentPushes, leadingPushes: 1,
  });
  if (sideCars.ids.length === 0) return;
  ctx.sideCars.set(master, sideCars);
  for (const [id, utxo] of Object.entries(sideCars.utxos)) ctx.utxos.set(id, utxo);
}

/**
 * A callee frame's own write plan as the value its body computed implies it, or absent when it writes none.
 *
 * A chunkable mapping write whose value the artifact does not publish is planned once with its run unstated, so
 * the frame's own close exposes the whole value the body stored; the frame is then handed back to the planner with
 * that value, which sizes the run of chunk records the write takes. A frame with nothing kept to plan against is
 * left as it was planned.
 */
export function planCalleeWrites(callee: HopCallee, learnedValue?: Uint8Array): HopEntryWrites | undefined {
  const inputs = callee.writeInputs;
  if (inputs === undefined) return undefined;
  return calleeEntryWrites(
    callee.artifact, callee.entry, inputs.args, inputs.senderAddress, inputs.live, callee.readNodes,
    inputs.categoryId, learnedValue,
  );
}

/**
 * The mapping nodes one callee frame's entry only reads, in the order its own code reads them.
 *
 * A per-call body that touches a sorted mapping does not read one value in place: the mapping is a chain of entry
 * NFTs, so the frame's segment has to carry the node each key's group walk reads. An entry that rewrites no record
 * still reads one, so those nodes are planned here rather than folded into a write: the body reads them at fixed
 * positions past the data records its block layout names, and each is spent on the entry covenant's read-only path.
 *
 * The node is the deployment's own classification, so no second classifier is built here, and the key is resolved
 * from the reach's own call data, its frame's sender and the nodes of the mappings it reads a key out of. A key this
 * hop cannot resolve to a node, or a node whose value the hop cannot state, is refused by name rather than guessed at.
 */
function calleeReadNodes(options: {
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly args: readonly FunctionArgument[];
  readonly senderAddress: Uint8Array | undefined;
  readonly categoryId: string;
  readonly deployment: PerCallDeploymentSet;
  /**
   * The nodes reaches placed earlier in this hop created, keyed by collection and slot.
   *
   * The deployment does not hold a node an earlier reach of the same hop inserted, so a read of that key would
   * otherwise resolve through the deployment to the bracketing predecessor the insert relinked. Planning the read
   * against the node the insert created keeps the two reaches on distinct nodes.
   */
  readonly createdNodes?: readonly {
    readonly collection: string;
    readonly slot: Uint8Array;
    readonly commitment: Uint8Array;
    readonly value?: Uint8Array;
  }[];
  /**
   * The nodes of collections whose values chunk that reaches placed earlier in this hop rewrote in place, in placement
   * order. The deployment's own chunks reassemble a node's bytes from before such a write, so a read placed after it
   * witnesses the bytes the write left (`reached-values.ts`), and the chain walk carries the view it left.
   */
  readonly rewrittenNodes?: HopLiveDeployment['rewrittenNodes'];
  /**
   * The layout the deployment's records were minted under, which is not always the artifact's own.
   *
   * A frame behind a proxy runs on the proxy's records, and the generated proxy declares the implementation's
   * fields plus one of its own, so its commitments are read with the proxy's layout rather than the
   * implementation's. Absent means the deployment's records are the artifact's own.
   */
  readonly recordLayout?: StateLayout;
  /**
   * The id each node is placed under, by its collection and its own slot: a callee frame's node is its contract's,
   * shared with every reach that reads or writes it (`sharedNodeId`). Absent names it by the key the read resolved.
   */
  readonly nodeIdOf?: (collection: string, slot: Uint8Array) => string;
  /** How a refusal names the frame: the callee by its contract and entry when absent. */
  readonly frameLabel?: string;
}): readonly HopCalleeReadNode[] {
  const fn = options.artifact.abi.find((candidate) => candidate.name === options.functionName);
  if (fn === undefined) return [];
  const accesses = fn.entryAccesses ?? [];
  if (accesses.length === 0) return [];
  const batched = new Set((fn.sortedBatchInfo ?? []).flatMap((batch) => batch.slotIndices));
  // A key the entry only reads is declared here; a key it also writes belongs to the write planner.
  const reads = accesses.filter((access) =>
    (access.slotIndex === undefined || !batched.has(access.slotIndex))
    && !access.operations.some((operation) => operation !== 'read'));
  if (reads.length === 0) return [];
  const slots = (fn.blockLayout?.slots ?? [])
    .filter((slot) => slot.kind === 'entry' && slot.slotIndex !== undefined
      && !batched.has(slot.slotIndex) && reads.some((access) => access.slotIndex === slot.slotIndex))
    .sort((left, right) => left.offset - right.offset);
  // A read at no fixed entry slot has no position in the frame's segment, so the body would walk past it and read
  // a record the plan never declared: refused by name rather than dropped from the plan.
  const frame = options.frameLabel ?? `the callee "${options.artifact.contractName}.${options.functionName}()"`;
  if (reads.some((access) => !slots.some((slot) => slot.slotIndex === access.slotIndex))) {
    throw new PerCallProxyDeployError(
      `${frame} reads a mapping key at no fixed entry slot, which this hop does not declare a node for`,
    );
  }
  // A chunkable collection's node tail holds only a digest past the inline limit, so the body takes the value
  // itself from its frame's block: the joined value is that witness, assembled from the deployment's own chunks.
  const layout = options.recordLayout ?? options.artifact.stateLayout
    ?? { variables: [], dataNftCount: 0, commitmentLimit: 0 };
  const live = liveDeploymentOf(options.categoryId, options.deployment, layout, options.createdNodes);
  // A key the body reads out of another mapping (`m[n[k]]`) is the value n's node holds for k, as the reaches placed
  // before this one left it, or the type's default where no node holds k: the body reads it at its own position.
  const readMappingValue = liveMappingValueReader(options.artifact, liveDeploymentOf(
    options.categoryId, options.deployment, layout, options.createdNodes, options.rewrittenNodes,
  ), options.artifact.structs);
  return slots.map((slot): HopCalleeReadNode => {
    let node: ReturnType<typeof readEntryNode>;
    try {
      node = readEntryNode({
        artifact: options.artifact,
        functionName: options.functionName,
        args: options.args,
        callerLockingBytecode: options.senderAddress ?? new Uint8Array(0),
        categoryId: options.categoryId,
        nodesByCollection: options.deployment.nodesByCollection,
        slotIndex: slot.slotIndex!,
        readMappingValue,
      });
    } catch (error) {
      throw new PerCallProxyDeployError(
        `${frame} reads a mapping node this hop cannot declare: `
        + `${error instanceof Error ? error.message : String(error)}`,
      );
    }
    // A key the deployment does not hold may be one an earlier reach of this hop inserted: the list the insert
    // left holds the node it created, so the read is planned against that node rather than resolving through the
    // deployment to the bracketing predecessor the insert relinked. The created node carries the value the
    // creating frame left, so its commitment is the read's own.
    const created = node.present ? undefined : (options.createdNodes ?? []).find((candidate) =>
      candidate.collection === node.collection && bytesEqual(candidate.slot, node.slot));
    // A key no list holds is proved absent by the closest node below it, and an earlier reach may have inserted one
    // between the deployment's bracketing node and the key: the read is then planned against the node it created.
    const bracket = node.present || created !== undefined ? undefined : closestCreatedBelow(
      options.createdNodes ?? [], node.collection, node.slot, decodeEntryCommitment(node.commitment).slot);
    const resolved = created ?? bracket;
    const commitment = resolved?.commitment ?? node.commitment;
    const collection = options.artifact.stateLayout?.collections
      ?.find((candidate) => candidate.name === node.collection);
    let value: Uint8Array | undefined;
    if (resolved !== undefined) {
      // An absent key reads no value, so only the key's own node witnesses one; a value that does not chunk is the
      // node's own tail, which the body reads in place.
      value = collection?.chunkableValue === true ? created?.value : undefined;
    } else {
      const tail = node.commitment.slice(64);
      const length = tail.length < 4 ? 0 : new DataView(tail.buffer, tail.byteOffset, 4).getUint32(0, true);
      // A long value an earlier reach rewrote is witnessed with the bytes that reach left (`reached-values.ts`).
      const reached = node.present
        ? reachedNodeValue({ rewrittenNodes: options.rewrittenNodes }, node.collection, node.slot)?.value
        : undefined;
      if (collection?.chunkableValue === true && reached !== undefined && reached.length > VALUE_INLINE_LIMIT) {
        value = reached;
      } else if (node.present && collection?.chunkableValue === true && length > VALUE_INLINE_LIMIT) {
        value = joinedNodeValue(collection, node.commitment, live);
        if (value === undefined) {
          throw new PerCallProxyDeployError(
            `${frame} reads a mapping node of collection "${node.collection}" whose ${length}-byte value this hop `
            + "cannot reassemble from the deployment's chunk records, so it cannot witness the body's read",
          );
        }
      }
    }
    return {
      // A key the list does not hold is read against the node that brackets it, so a shared id names the node's own
      // slot: two reads that resolve to one node are one input. A node an earlier reach created is named by the
      // slot the insert targeted, which is the node's own, so the read and the insert touch distinct nodes.
      id: resolved === undefined
        ? options.nodeIdOf?.(node.collection, decodeEntryCommitment(node.commitment).slot)
          ?? `mapping-read-${node.collection}-${bytesToHex(node.slot)}`
        : options.nodeIdOf?.(node.collection, resolved.slot)
          ?? `mapping-read-${node.collection}-${bytesToHex(resolved.slot)}`,
      collection: node.collection,
      signature: node.signature,
      slotIndex: slot.slotIndex!,
      keySlot: node.slot,
      ...(value === undefined ? {} : { value }),
      commitment,
      ...(resolved === undefined ? { utxo: node.utxo } : { createdSlot: resolved.slot }),
    };
  });
}

/** The node of `collection` an earlier reach created whose slot lies closest below `slot` and above `floor`. */
function closestCreatedBelow<Node extends { readonly collection: string; readonly slot: Uint8Array }>(
  nodes: readonly Node[], collection: string, slot: Uint8Array, floor: Uint8Array,
): Node | undefined {
  const ceiling = bytesToSlotValue(slot);
  const least = bytesToSlotValue(floor);
  let closest: Node | undefined;
  for (const node of nodes) {
    const at = bytesToSlotValue(node.slot);
    if (node.collection !== collection || at >= ceiling || at <= least) continue;
    if (closest === undefined || at > bytesToSlotValue(closest.slot)) closest = node;
  }
  return closest;
}

/**
 * The nodes a callee reads, or none when the artifact publishes a shape this planner does not state.
 *
 * A read the planner cannot state leaves the frame planned without it, exactly as a write outside a sorted batch it
 * cannot state does: the callee's own frame reports its refusal when it is settled, naming the callee, rather than
 * the hop fabricating a plan for a record it cannot place. The hop's own implementation frame reads its nodes the
 * same way. An entry that writes a sorted batch beside its reads is the exception: its batch's groups follow the
 * read nodes on every path, so a read the planner cannot state is refused here by its own reason, rather than
 * leaving the batch planner to name the first read it finds undeclared.
 */
export function calleeReadNodesOrNone(options: Parameters<typeof calleeReadNodes>[0]): readonly HopCalleeReadNode[] {
  try {
    return calleeReadNodes(options);
  } catch (error) {
    const fn = options.artifact.abi.find((candidate) => candidate.name === options.functionName);
    if ((fn?.sortedBatchInfo ?? []).length > 0) throw error;
    return [];
  }
}

/**
 * The records a callee deployment's masters read, one participant per data NFT, named for the deployment's block.
 *
 * A contract's records are the deployment's, not a frame's: every master the hop places for the deployment reads
 * the same record inputs, so the ids are its block's and the block places each record once. Two deployments of one
 * contract hold two sets of records, which their blocks' names keep apart.
 */
function calleeRecordSet(
  ctx: PlanContext,
  block: string,
  categoryId: string,
  layout: StateLayout,
  deployment: PerCallDeploymentSet,
): readonly HopCalleeRecord[] {
  const cached = ctx.records.get(categoryId);
  if (cached !== undefined) return cached;
  const records = Array.from({ length: layout.dataNftCount }, (_unused, nftIndex): HopCalleeRecord => {
    const utxo = deployment.records[nftIndex];
    const commitment = utxo?.token?.nft?.commitment;
    if (utxo === undefined || commitment === undefined) {
      throw new PerCallProxyDeployError(
        `the callee's category ${categoryId} holds no record at data NFT ${nftIndex}`,
      );
    }
    return {
      id: `${block}-record-${nftIndex}`,
      commitment: new Uint8Array(hexToBin(commitment)),
      satoshis: utxo.satoshis,
      lockingBytecode: stateRecordLockingBytecode(categoryId),
    };
  });
  records.forEach((record, nftIndex) => ctx.utxos.set(record.id, deployment.records[nftIndex]!));
  ctx.records.set(categoryId, records);
  return records;
}

/**
 * The emits one reach's own facts decide its body skips (`HopCallee.skippedEmits`): its call data, the caller's address
 * as `msg.sender`, the deployment's state, the nodes as the reaches before it left them, and the address the frame
 * runs as. A reach whose sender the hop does not know decides none; each of its emits is learned from its own close.
 */
function reachSkippedEmits(
  artifact: Artifact, entry: string, args: readonly FunctionArgument[], senderAddress: Uint8Array | undefined,
  facts: WriteActivationFacts,
): { readonly skippedEmits?: readonly number[] } {
  if (senderAddress === undefined) return {};
  const skipped = skippedEmits({ artifact, functionName: entry, args, senderAddress, facts });
  return skipped.length === 0 ? {} : { skippedEmits: skipped };
}

/**
 * The value sends one reach's own facts decide, from the facts its emits are decided from (`reachSkippedEmits`): those
 * its body skips (`HopCallee.skippedSends`) and those it pays (`HopCallee.takenSends`). A reach whose sender the hop
 * does not know decides none.
 */
function reachDecidedSends(
  artifact: Artifact, entry: string, args: readonly FunctionArgument[], senderAddress: Uint8Array | undefined,
  facts: WriteActivationFacts,
): { readonly skippedSends?: readonly number[]; readonly takenSends?: readonly number[] } {
  if (senderAddress === undefined) return {};
  const frame = { artifact, functionName: entry, args, senderAddress, facts };
  const skipped = skippedSends(frame);
  const taken = takenSends(frame);
  return {
    ...(skipped.length === 0 ? {} : { skippedSends: skipped }), ...(taken.length === 0 ? {} : { takenSends: taken }),
  };
}

/**
 * Places one master per reach of a direct callee, all of them in the callee deployment's one block.
 *
 * Each reach carries its own call data, so each takes a master of its own from the deployment's live pool: the
 * pool's masters are ordered by outpoint, and the hop's running count of the masters it has taken from the category
 * is the slot the next reach takes. A pool that cannot hold every reach is refused by name before any frame is
 * placed, so a plan is never half-stated for a pool that cannot serve it.
 */
async function placeCalleeMasters(
  ctx: PlanContext,
  caller: HopCallInputs,
  enteredBy: number | null,
  external: PerCallProxyExternal,
  entry: AbiEntryRow,
  resolved: readonly ResolvedCall[],
  calls: DraftCall[],
  where: string,
  reach: CalleeReach,
): Promise<void> {
  const contract = external.artifact.contractName;
  const categoryId = external.categoryId;
  const layout = external.artifact.stateLayout ?? { variables: [], dataNftCount: 0, commitmentLimit: 0 };
  const deployment = await deploymentOf(ctx, categoryId, layout);
  const base = ctx.masterSlots.get(categoryId) ?? 0;
  const needed = base + resolved.length;
  if (deployment.masters.length < needed) {
    throw new PerCallProxyDeployError(
      `${where} reaches "${contract}", which this hop already places; its category ${categoryId} holds `
      + `${deployment.masters.length} master(s), so it cannot be entered ${needed} time(s)`,
    );
  }
  ctx.masterSlots.set(categoryId, needed);
  const block = deploymentBlockId(ctx.blocks, contract, categoryId);
  const records = calleeRecordSet(ctx, block, categoryId, layout, deployment);
  const stateValues = deploymentStateValues(layout, categoryId, deployment);
  const category = hexToBin(categoryId);
  const nodeIdOf = (collection: string, slot: Uint8Array): string => sharedNodeId(categoryId, collection, slot);
  for (const [position, call] of resolved.entries()) {
    // A stop inside an earlier visit's own calls ends the plan there, so no later visit is placed.
    if (ctx.stop.blocked !== undefined) break;
    // Each visit is planned against what the visits and reaches before it wrote, a loop's earlier turns included.
    const live = reachedDeploymentOf(ctx, categoryId, deployment, layout);
    const readMappingValue = liveMappingValueReader(external.artifact, live, external.artifact.structs);
    // The turn the call runs in names the frame; its place among the site's calls takes the master.
    const occurrence = reach.turns[position] ?? position;
    const calleeIndex = ctx.callees.length;
    const master = `callee-master-${calleeIndex + 1}`;
    const path = calleePath(reach.callerPath, reach.site, occurrence);
    const masterUtxo = deployment.masters[base + position]!;
    const deployed = deployMaster(external.artifact, category, ctx.validatorProgram);
    // The nodes the entry only reads, from the reach's own call data; they lead any batch's groups.
    const readNodes = calleeReadNodesOrNone({
      artifact: external.artifact, functionName: entry.name, args: call.argumentValues,
      senderAddress: caller.selfAddress, categoryId, deployment, nodeIdOf,
      createdNodes: ctx.writtenNodes.get(categoryId) ?? [], rewrittenNodes: ctx.rewrittenNodes.get(categoryId) ?? [],
    });
    // The frame's own write is planned from the reach's own call data, so two reaches that pass different values
    // write different nodes.
    const writes = calleeEntryWrites(
      external.artifact, entry.name, call.argumentValues, caller.selfAddress, live, readNodes, categoryId,
      ctx.calleeWriteValues?.get(master));
    for (const node of readNodes) if (node.utxo !== undefined) ctx.utxos.set(node.id, node.utxo);
    // A mapping node the frame writes sits on a live UTXO the deployment's classification already placed, so the
    // hop hands the rebuild its outpoint rather than have it search the category again.
    for (const [id, utxo] of writes?.spentUtxos ?? []) ctx.utxos.set(id, utxo);
    // A node this reach creates is one the reaches placed after it have to be told about: it is in no deployment,
    // and only this frame's output carries it. A node it rewrites holds bytes the deployment does not.
    recordWrittenNodes(ctx, categoryId, writes, ctx.calleeWriteViews?.get(master), statedMappingWrites(
      external.artifact, entry.name, call.argumentValues, caller.selfAddress, stateValues, undefined,
      readMappingValue));
    await calleeSideCars(ctx, master, external.artifact, entry.name, call.argumentPushes);
    const frame: HopCallee = {
      master,
      contract,
      block,
      entry: entry.name,
      functionName: `${contract}.${entry.name}()`,
      artifact: external.artifact,
      category,
      categoryId,
      deployed,
      kind: call.kind,
      masterSatoshis: masterUtxo.satoshis,
      returns: (entry.outputs ?? []).length > 0,
      selfAddress: deployed.address,
      records,
      readNodes,
      utxos: new Map<string, Utxo>([[master, masterUtxo]]),
      ...(writes === undefined ? {} : { entryWrites: writes }),
      ...(writes === undefined ? {} : {
        writeInputs: { args: call.argumentValues, senderAddress: caller.selfAddress, live, categoryId },
      }),
      calls: [],
      callBases: [],
      enteredBy,
      path,
      origin: { callerPath: reach.callerPath, callsiteId: reach.callsiteId, occurrence },
      ...reachSkippedEmits(external.artifact, entry.name, call.argumentValues, caller.selfAddress,
        { stateValues, selfAddress: deployed.address, readMappingValue }),
      ...reachDecidedSends(external.artifact, entry.name, call.argumentValues, caller.selfAddress,
        { stateValues, selfAddress: deployed.address, readMappingValue }),
    };
    // Reserve the slot before planning the callee's own calls, so a frame it reaches names this master as its
    // caller and sits after it.
    ctx.callees.push(frame);
    const nested = await planEntryCalls(ctx, {
      artifact: external.artifact,
      functionName: entry.name,
      args: call.argumentValues,
      stateValues,
      selfAddress: deployed.address,
      readMappingValue,
      ...(caller.selfAddress === undefined ? {} : { senderAddress: caller.selfAddress }),
    }, calleeIndex, path);
    ctx.callees[calleeIndex] = {
      ...frame, calls: nested.calls, callBases: nested.callBases, ...(nested.truncated ? { truncated: true } : {}),
    };
    ctx.utxos.set(master, masterUtxo);
    calls.push({
      kind: call.kind, callee: master, target: call.target, value: 0n,
      argumentPushes: call.argumentPushes,
    });
    if (hopTraceOn()) {
      const byTarget = findDeploymentByAddress(ctx.provider, binToHex(call.target))
        ?? findDeploymentByLockingBytecode(ctx.provider, binToHex(call.target));
      hopTrace(`callee ${master} entry=${entry.name} self=${binToHex(deployed.address).slice(0, 12)} `
        + `target=${binToHex(call.target).slice(0, 12)} cat=${categoryId.slice(-12)} `
        + `byTarget=${byTarget?.contractName ?? 'none'}`);
    }
  }
}

/**
 * Places one proxy-fallback plus delegate-frame pair per reach of a proxied callee, in the two blocks the chain
 * owns.
 *
 * A proxied callee is two contracts: the proxy, whose fallback forwards the call data it received to the address
 * its record holds, and the implementation the delegate frame runs. Each reach carries its own call data, so each
 * takes a master of its own from both pools: one of the proxy's, which the caller records, and one of the
 * implementation's, which the proxy's record names and whose input carries that reach's call data. The proxy's
 * masters all sit in the proxy's one block and read its one set of records; the implementation's masters all sit
 * in the implementation's one block and run as delegates on the proxy's records. A pool that cannot hold every
 * reach is refused by name before any frame is placed, so a plan is never half-stated for a pool that cannot serve
 * it.
 */
async function placeProxiedCallee(
  ctx: PlanContext,
  caller: HopCallInputs,
  enteredBy: number | null,
  external: PerCallProxyExternal,
  entry: AbiEntryRow,
  resolved: readonly ResolvedCall[],
  calls: DraftCall[],
  where: string,
  reach: CalleeReach,
): Promise<void> {
  const proxyArtifact = external.proxyArtifact!;
  const implementationCategoryId = external.implementationCategoryId!;
  const proxyContract = proxyArtifact.contractName;
  const implementationContract = external.artifact.contractName;
  const proxyLayout = proxyArtifact.stateLayout ?? { variables: [], dataNftCount: 0, commitmentLimit: 0 };
  const implementationLayout =
    external.artifact.stateLayout ?? { variables: [], dataNftCount: 0, commitmentLimit: 0 };
  // A delegate frame runs the implementation's own code, so the mapping nodes at the proxy's category were minted
  // by the implementation's own collection covenants. The generated proxy mirrors the implementation's record
  // fields but declares none of its collections, so the proxy's live UTXOs are classified with the implementation's
  // collections beside the proxy's records: otherwise a node the entry reads would be unfiled and unread.
  const proxyReadLayout: StateLayout = {
    ...proxyLayout,
    ...(implementationLayout.collections === undefined ? {} : { collections: implementationLayout.collections }),
  };
  const proxyDeployment = await deploymentOf(ctx, external.categoryId, proxyReadLayout);
  const implementationDeployment = await deploymentOf(ctx, implementationCategoryId, implementationLayout);
  const proxyBase = ctx.masterSlots.get(external.categoryId) ?? 0;
  const implementationBase = ctx.masterSlots.get(implementationCategoryId) ?? 0;
  const needed = resolved.length;
  if (proxyDeployment.masters.length < proxyBase + needed) {
    throw new PerCallProxyDeployError(
      `${where} reaches "${proxyContract}", which this hop already places; its category ${external.categoryId} `
      + `holds ${proxyDeployment.masters.length} master(s), so it cannot be entered ${proxyBase + needed} time(s)`,
    );
  }
  if (implementationDeployment.masters.length < implementationBase + needed) {
    throw new PerCallProxyDeployError(
      `${where} reaches "${implementationContract}", which this hop already places; its category `
      + `${implementationCategoryId} holds ${implementationDeployment.masters.length} master(s), so it cannot be `
      + `entered ${implementationBase + needed} time(s)`,
    );
  }
  ctx.masterSlots.set(external.categoryId, proxyBase + needed);
  ctx.masterSlots.set(implementationCategoryId, implementationBase + needed);
  const proxyBlock = deploymentBlockId(ctx.blocks, proxyContract, external.categoryId);
  const implementationBlock = deploymentBlockId(ctx.blocks, implementationContract, implementationCategoryId);

  const proxyCategory = hexToBin(external.categoryId);
  const implementationCategory = hexToBin(implementationCategoryId);
  const proxyDeployed = deployMaster(proxyArtifact, proxyCategory, ctx.validatorProgram);
  const implementationDeployed = deployMaster(external.artifact, implementationCategory, ctx.validatorProgram);
  // The proxy's records are the deployment's, shared by every master the hop places for it; a delegate frame reads
  // them without owning them, so none are placed for the implementation's own category.
  const records = calleeRecordSet(ctx, proxyBlock, external.categoryId, proxyLayout, proxyDeployment);
  const stateValues = deploymentStateValues(proxyLayout, external.categoryId, proxyDeployment);
  // Whether the entry the proxy forwards to returns a value, which the fallback frame records in its own `retval`.
  const returnsValue = (entry.outputs ?? []).length > 0;
  for (const [position, call] of resolved.entries()) {
    // A stop inside an earlier visit's own calls ends the plan there, so no later visit is placed.
    if (ctx.stop.blocked !== undefined) break;
    // A delegate frame runs on the proxy's records, so a write its entry makes lands at the proxy's category and is
    // planned against the proxy's own live records and collection nodes, as the visits before it left them.
    const live = reachedDeploymentOf(ctx, external.categoryId, proxyDeployment, proxyLayout);
    const readMappingValue = liveMappingValueReader(external.artifact, live, external.artifact.structs);
    // The turn the call runs in names the pair; its place among the site's calls takes the masters.
    const occurrence = reach.turns[position] ?? position;
    const proxyIndex = ctx.callees.length;
    const implementationIndex = proxyIndex + 1;
    const path = calleePath(reach.callerPath, reach.site, occurrence);
    const proxyMaster = `callee-master-${proxyIndex + 1}`;
    const implementationMaster = `callee-impl-master-${implementationIndex + 1}`;
    const proxyMasterUtxo = proxyDeployment.masters[proxyBase + position]!;
    const implementationMasterUtxo = implementationDeployment.masters[implementationBase + position]!;
    const proxyBaseFrame: HopCallee = {
      master: proxyMaster,
      contract: proxyContract,
      block: proxyBlock,
      entry: '__fallback',
      functionName: `${proxyContract}.__fallback()`,
      artifact: proxyArtifact,
      category: proxyCategory,
      categoryId: external.categoryId,
      deployed: proxyDeployed,
      kind: call.kind,
      masterSatoshis: proxyMasterUtxo.satoshis,
      // The fallback records the bytes the delegate returned, so the frame returns exactly when the entry it
      // forwards to does; the value it records is the implementation frame's own, not one its body computed.
      returns: returnsValue,
      ...(returnsValue ? { retvalFrom: implementationIndex } : {}),
      selfAddress: proxyDeployed.address,
      records,
      readNodes: [],
      utxos: new Map<string, Utxo>([[proxyMaster, proxyMasterUtxo]]),
      // The fallback forwards the call data the caller recorded to the address its own record holds, which is the
      // implementation's master at its own category.
      calls: [{
        kind: FrameKind.DELEGATE,
        callee: implementationMaster,
        target: implementationDeployed.address,
        value: 0n,
        argumentPushes: call.argumentPushes,
      }],
      callBases: [0],
      enteredBy,
      path,
      origin: { callerPath: reach.callerPath, callsiteId: reach.callsiteId, occurrence },
    };
    // The nodes the entry only reads are the proxy's own, planned against the proxy's deployment.
    const implementationReads = calleeReadNodesOrNone({
      artifact: external.artifact, functionName: entry.name, args: call.argumentValues,
      senderAddress: caller.selfAddress, categoryId: external.categoryId, deployment: proxyDeployment,
      recordLayout: proxyReadLayout,
      nodeIdOf: (collection, slot) => sharedNodeId(external.categoryId, collection, slot),
      createdNodes: ctx.writtenNodes.get(external.categoryId) ?? [],
      rewrittenNodes: ctx.rewrittenNodes.get(external.categoryId) ?? [],
    });
    // The implementation entry's own write is planned from this reach's call data, against the proxy's deployment.
    const implementationWrites = calleeEntryWrites(
      external.artifact, entry.name, call.argumentValues, caller.selfAddress, live, implementationReads,
      external.categoryId, ctx.calleeWriteValues?.get(implementationMaster));
    for (const node of implementationReads) if (node.utxo !== undefined) ctx.utxos.set(node.id, node.utxo);
    for (const [id, utxo] of implementationWrites?.spentUtxos ?? []) ctx.utxos.set(id, utxo);
    // A node this reach creates or rewrites is one the reaches placed after it have to be told about, as a call
    // frame's is, with the views a settle learned for the delegate frame that writes it.
    recordWrittenNodes(ctx, external.categoryId, implementationWrites, ctx.calleeWriteViews?.get(implementationMaster),
      statedMappingWrites(external.artifact, entry.name, call.argumentValues, caller.selfAddress, stateValues,
        undefined, readMappingValue));
    await calleeSideCars(ctx, implementationMaster, external.artifact, entry.name, call.argumentPushes);
    const implementationBaseFrame: HopCallee = {
      master: implementationMaster,
      contract: implementationContract,
      block: implementationBlock,
      entry: entry.name,
      functionName: `${implementationContract}.${entry.name}()`,
      artifact: external.artifact,
      category: implementationCategory,
      categoryId: implementationCategoryId,
      deployed: implementationDeployed,
      kind: FrameKind.DELEGATE,
      masterSatoshis: implementationMasterUtxo.satoshis,
      returns: (entry.outputs ?? []).length > 0,
      // A delegate frame runs as its caller's contract, so its `address(this)` is the proxy's.
      selfAddress: proxyDeployed.address,
      records: [],
      recordOwner: proxyIndex,
      readNodes: implementationReads,
      utxos: new Map<string, Utxo>([[implementationMaster, implementationMasterUtxo]]),
      ...(implementationWrites === undefined ? {} : { entryWrites: implementationWrites }),
      ...(implementationWrites === undefined ? {} : {
        writeInputs: {
          args: call.argumentValues, senderAddress: caller.selfAddress, live, categoryId: external.categoryId,
        },
      }),
      calls: [],
      callBases: [],
      enteredBy: proxyIndex,
      // The delegate frame runs the reach's entry, so its own sites are planned under the reach's path.
      path,
      // It keeps its caller's sender, and runs on the proxy's state and nodes as the proxy.
      ...reachSkippedEmits(external.artifact, entry.name, call.argumentValues, caller.selfAddress,
        { stateValues, selfAddress: proxyDeployed.address, readMappingValue }),
      ...reachDecidedSends(external.artifact, entry.name, call.argumentValues, caller.selfAddress,
        { stateValues, selfAddress: proxyDeployed.address, readMappingValue }),
    };
    // A call back to the root that repeats a re-entry is placed without its own calls (`rootEntryRuns`).
    const repeated = ctx.root !== undefined && external.categoryId === ctx.root.external.categoryId
      && rootEntryRuns(ctx, enteredBy, entry.name) >= 2;
    // Reserve the pair before planning the entry's own calls, so a frame it reaches names its own reach's
    // implementation master as its caller and sits after it.
    ctx.callees.push(proxyBaseFrame, implementationBaseFrame);
    const nested: PlannedEntryCalls = repeated
      ? { calls: [], callBases: [], callsiteIds: [], truncated: true }
      : await planEntryCalls(ctx, {
        artifact: external.artifact,
        functionName: entry.name,
        args: call.argumentValues,
        stateValues,
        selfAddress: proxyDeployed.address,
        readMappingValue,
        ...(caller.selfAddress === undefined ? {} : { senderAddress: caller.selfAddress }),
      }, implementationIndex, path);
    ctx.callees[implementationIndex] = {
      ...implementationBaseFrame, calls: nested.calls, callBases: nested.callBases,
      ...(nested.truncated ? { truncated: true } : {}),
    };
    ctx.utxos.set(proxyMaster, proxyMasterUtxo);
    ctx.utxos.set(implementationMaster, implementationMasterUtxo);
    calls.push({
      kind: call.kind, callee: proxyMaster, target: call.target, value: 0n,
      argumentPushes: call.argumentPushes,
    });
    if (hopTraceOn()) {
      hopTrace(`callee ${proxyMaster} entry=__fallback self=${binToHex(proxyDeployed.address).slice(0, 12)} `
        + `target=${binToHex(call.target).slice(0, 12)} impl=${implementationMaster} `
        + `impl-self=${binToHex(implementationDeployed.address).slice(0, 12)}`);
    }
  }
}

/** One reach's writes to one collection, as the cross-reach check below reads them. */
interface CollectionReach {
  readonly functionName: string;
  readonly targets: readonly ReachWriteTarget[];
  /** The keys the reach inserts, i.e. the nodes it creates because the list did not hold them. */
  readonly createdSlots: ReadonlySet<string>;
  /** The keys the reach rewrites as a continuation of a node an earlier reach created, keyed by slot. */
  readonly continuedSlots: ReadonlySet<string>;
}

/**
 * Why a node whose values chunk does not chain through an insert's relink: each reach of such a node sizes the run of
 * chunk records a value takes, and witnesses a long value it reads, from the bytes the write before it stated, and a
 * relink, which keeps the value, states none.
 */
const CHUNKED_RELINK = 'a node whose values chunk is continued from the bytes the write before each reach stated, '
  + 'and a relink states none';

/**
 * The spent nodes one reach's write rewrites in place: the targets the list held, which an update keeps where they
 * stand. A node an insert splices through is relinked instead, and so is a target some insert of the same write
 * splices through.
 */
function updatedNodeIds(categoryId: string, write: ReachWrite): ReadonlySet<string> {
  const idOf = (slot: Uint8Array): string => sharedNodeId(categoryId, write.collection, slot);
  const relinked = new Set(write.targets.flatMap((target) =>
    (target.predecessor === undefined ? [] : [idOf(target.predecessor)])));
  return new Set(write.targets
    .filter((target) => target.predecessor === undefined)
    .map((target) => idOf(target.slot))
    .filter((id) => !relinked.has(id)));
}

/**
 * Refuses a hop whose sibling reaches of one contract write one collection in a way one transaction cannot carry.
 *
 * Each reach of a mapping-writing callee runs as a master of its own and is planned against the list the reaches
 * placed before it left: the deployment's nodes, the nodes those reaches created and the successors their inserts
 * relinked. The transaction spends each node once, so a node several reaches touch is one participant, and the
 * frames' views of it chain in the order they run (`buildHopPlan`): a read sees the view every write before it left,
 * an update rewrites it, and a relink keeps the slot and the value it reaches and takes a new successor. The master
 * proves an insert's gap, and checks the relink it writes, against the views its own frame declares, also for a node
 * an earlier frame created, so inserts into one gap, or through a node another reach updates, share a transaction.
 *
 * A key the list does not hold is inserted once, and a later reach that writes it continues the node the insert
 * created. Two reaches that each insert one key, or a later reach that writes an inserted key without continuing
 * it, state a list that holds the key twice, so either shape is refused by name here rather than settled into a
 * transaction the network rejects; so are the chains `requireChainableNodes` names.
 */
export function requireSatisfiableReachWrites(callees: readonly HopCallee[]): void {
  const byCollection = new Map<string, {
    readonly collection: string;
    readonly chunkable: boolean;
    readonly reaches: CollectionReach[];
  }>();
  for (const callee of callees) {
    const writes = callee.entryWrites;
    if (writes === undefined) continue;
    // A delegate frame writes through its caller's records, so its collection is the owner's.
    const owner = callee.recordOwner === undefined ? callee : callees[callee.recordOwner]!;
    for (const write of writes.reachWrites) {
      const key = `${bytesToHex(owner.category)}|${write.collection}`;
      const group = byCollection.get(key)
        ?? { collection: write.collection, chunkable: write.chunkable, reaches: [] };
      group.reaches.push({
        functionName: callee.functionName,
        targets: write.targets,
        createdSlots: new Set(write.targets
          .filter((target) => target.predecessor !== undefined)
          .map((target) => bytesToHex(target.slot))),
        continuedSlots: new Set(write.targets
          .filter((target) => target.continued === true)
          .map((target) => bytesToHex(target.slot))),
      });
      byCollection.set(key, group);
    }
  }
  for (const group of byCollection.values()) {
    if (group.reaches.length < 2) continue;
    // A dynamic value's reaches are left to the settled hop (`requireSettledNodeChains`).
    if (group.chunkable) continue;
    const where = `the hop reaches the entry "${group.reaches[0]!.functionName}" `
      + `${group.reaches.length} times`;
    for (let left = 0; left < group.reaches.length; left += 1) {
      for (let right = left + 1; right < group.reaches.length; right += 1) {
        const first = group.reaches[left]!;
        const second = group.reaches[right]!;
        // A key the list holds is updated in place by each reach, so the reaches chain through its node; a key it
        // does not hold is inserted by each.
        const inserted = (reach: CollectionReach, slot: Uint8Array): boolean => reach.targets.some((target) =>
          bytesEqual(target.slot, slot) && target.predecessor !== undefined);
        const sharedKey = first.targets.find((target) =>
          second.targets.some((other) => bytesEqual(other.slot, target.slot))
          && (inserted(first, target.slot) || inserted(second, target.slot)));
        if (sharedKey !== undefined) {
          // A later reach that rewrites the node an earlier reach created continues it: the created node carries no
          // input, the earlier reach's own declaration names it at the output it made, and the later reach's
          // declaration names that same output, so one transaction carries both. Any other reach of an inserted key
          // inserts it a second time.
          const chained = first.createdSlots.has(bytesToHex(sharedKey.slot))
            && second.continuedSlots.has(bytesToHex(sharedKey.slot));
          if (!chained) {
            throw new PerCallProxyDeployError(
              `${where}, and ${group.reaches.filter((reach) => reach.targets.some((target) =>
                bytesEqual(target.slot, sharedKey.slot))).length} of them write collection `
              + `"${group.collection}" at the same key, which the list does not hold, so each reach inserts it; a `
              + 'list holds one node per key, so a later reach of the key has to continue the node the insert created',
            );
          }
        }
      }
    }
  }
  requireChainableNodes(callees);
}

/** One frame's touch of a node its contract holds. */
interface NodeTouch {
  /** The frame's index in the hop's callees, which is the order the frames run in. */
  readonly frame: number;
  readonly functionName: string;
  readonly collection: string;
  /** The frame reads the node, rewrites it in place as its own key's update, or relinks it for an insert. */
  readonly kind: 'read' | 'update' | 'relink';
  /**
   * True when the collection's values chunk: a write's value sizes the run of chunk records it takes, and a long
   * value is read from a witness, both planned from the value the deployment holds.
   */
  readonly chunkable: boolean;
}

/**
 * Every callee mapping node the hop's frames touch, by its participant id, with one touch per frame in frame order.
 *
 * A frame that touches a node twice, a read beside its write, is counted by its strongest touch. The frames are in
 * placement order, which is the order they run in for frames none of which enters another.
 */
function nodeTouches(callees: readonly HopCallee[]): ReadonlyMap<string, readonly NodeTouch[]> {
  const strength = { read: 0, update: 1, relink: 2 } as const;
  const touches = new Map<string, NodeTouch[]>();
  callees.forEach((callee, frame) => {
    const owner = callee.recordOwner === undefined ? callee : callees[callee.recordOwner]!;
    const own = new Map<string, NodeTouch>();
    const touch = (id: string, found: NodeTouch): void => {
      const known = own.get(id);
      if (known === undefined || strength[found.kind] > strength[known.kind]) own.set(id, found);
    };
    const collections = callee.artifact?.stateLayout?.collections ?? [];
    for (const node of callee.readNodes ?? []) {
      touch(node.id, {
        frame, functionName: callee.functionName, collection: node.collection, kind: 'read',
        chunkable: collections.some((candidate) => candidate.name === node.collection
          && candidate.chunkableValue === true),
      });
    }
    for (const write of callee.entryWrites?.reachWrites ?? []) {
      const updated = updatedNodeIds(bytesToHex(owner.category), write);
      for (const id of write.spentIds) {
        touch(id, {
          frame, functionName: callee.functionName, collection: write.collection,
          kind: updated.has(id) ? 'update' : 'relink', chunkable: write.chunkable,
        });
      }
    }
    for (const [id, found] of own) touches.set(id, [...(touches.get(id) ?? []), found]);
  });
  return touches;
}

/** True when frame `outer` enters frame `inner`, directly or through the frames between them. */
function entersFrame(callees: readonly HopCallee[], outer: number, inner: number): boolean {
  for (let at = callees[inner]?.enteredBy ?? null; at !== null; at = callees[at]?.enteredBy ?? null) {
    if (at === outer) return true;
  }
  return false;
}

/** True when a node's collection holds values that chunk, which the hop does not chain across frames. */
function chunkingNode(touches: readonly NodeTouch[]): boolean {
  return touches.some((touch) => touch.chunkable);
}

/**
 * Refuses a node several frames touch in a chain the hop cannot state.
 *
 * Every frame is planned against the list the frames placed before it left, and the views a shared node's frames
 * declare are chained in the order the frames run: a read keeps the view the last write before it left, an update of
 * the node's own key rewrites it, and an insert's relink keeps the slot and the value it reaches and takes the
 * successor its plan states. That covers reads, updates and relinks of a fixed-width value in any order. Two touches
 * where one frame enters the other are refused by name, since their segments interleave in an order this hop does not
 * settle, but for a read or an in-place rewrite after the entering frame's write of the node, which lands before the
 * call that leads there (`enclosed-reads.ts`).
 *
 * A node whose values chunk is chainable in the same way, except that the bytes a later reach continues from are
 * the ones the reach before it wrote: a reach whose chunkable write states no value leaves none, which
 * `requireSettledNodeChains` refuses once every frame has settled, and a relink states none, which is refused here.
 */
function requireChainableNodes(callees: readonly HopCallee[]): void {
  for (const [id, touches] of nodeTouches(callees)) {
    if (touches.length < 2) continue;
    const collection = touches[0]!.collection;
    for (const [at, outer] of touches.entries()) {
      for (const inner of touches.slice(at + 1)) {
        if (!entersFrame(callees, outer.frame, inner.frame) && !entersFrame(callees, inner.frame, outer.frame)) continue;
        // A read or rewrite of a node a frame it runs inside wrote before entering it chains (`enclosed-reads.ts`).
        if (chainsEnclosedTouch(callees, outer, inner, collection, id)) continue;
        throw new PerCallProxyDeployError(
          `the hop's reaches "${outer.functionName}" and "${inner.functionName}" touch one node of collection `
          + `"${collection}", and one of them enters the other, so their segments interleave in an order this hop `
          + 'does not settle',
        );
      }
    }
    if (!chunkingNode(touches)) continue;
    let written: NodeTouch | undefined;
    for (const touch of touches) {
      if (written !== undefined) {
        const pair = `the hop's reach "${touch.functionName}" touches a node of collection "${collection}" that an `
          + `earlier reach "${written.functionName}"`;
        if (written.kind === 'relink') {
          throw new PerCallProxyDeployError(`${pair} relinks to insert a key; ${CHUNKED_RELINK}`);
        }
        if (touch.kind === 'relink') {
          throw new PerCallProxyDeployError(`${pair} writes, and inserts through it; ${CHUNKED_RELINK}`);
        }
      }
      if (touch.kind !== 'read') written = touch;
    }
  }
}

/**
 * Refuses a settled hop whose later reach of a chunking node has no value to continue from.
 *
 * Each reach sizes the run of chunk records a value takes, and witnesses a long value it reads, from the value the
 * reach before it wrote: a chunkable write's value is the body's to compute, and the close that stops the write is
 * what hands it back, so the plan states it every pass after that one. A reach whose write the plan never stated
 * leaves none, and the later frame would read a value the write never produced: the shape is refused here, once
 * every frame has settled, rather than at planning, so an arm the planner states and the execution skips, or a
 * frame that refuses before the chain is reached, is reported as itself.
 */
export function requireSettledNodeChains(callees: readonly HopCallee[]): void {
  for (const [id, touches] of nodeTouches(callees).entries()) {
    if (touches.length < 2 || !chunkingNode(touches)) continue;
    // Every touch of the node but the last is continued from by the one after it, so each write among them has to
    // have stated the value it left; a read continues from the last write before it the same way.
    for (let at = 0; at + 1 < touches.length; at += 1) {
      const earlier = touches[at]!;
      const later = touches[at + 1]!;
      const pair = `the hop's reach "${later.functionName}" touches a node of collection "${later.collection}" that `
        + `an earlier reach "${earlier.functionName}"`;
      // A relink of a chunking node states no bytes to continue from, as `requireChainableNodes` names it.
      if (earlier.kind === 'relink') {
        throw new PerCallProxyDeployError(`${pair} relinks to insert a key; ${CHUNKED_RELINK}`);
      }
      if (later.kind === 'relink') {
        throw new PerCallProxyDeployError(`${pair} writes, and inserts through it; ${CHUNKED_RELINK}`);
      }
      if (earlier.kind === 'read') continue;
      if (!leavesValueForLaterReach(callees, earlier, id)) {
        throw new PerCallProxyDeployError(
          `${pair} writes, and its values chunk: the reach before it states no value a later reach can continue `
          + 'from, so the run of chunk records the later reach takes cannot be sized',
        );
      }
    }
  }
}

/**
 * True when the given reach wrote the node with a value a later reach of it can continue from.
 *
 * A write whose value the plan could not state carries a placeholder that is not the bytes the node holds, and a
 * reach placed after it would size its own run from those bytes: the write facts carry no value for such a write.
 */
function leavesValueForLaterReach(callees: readonly HopCallee[], earlier: NodeTouch, id: string): boolean {
  const callee = callees[earlier.frame]!;
  const owner = callee.recordOwner === undefined ? callee : callees[callee.recordOwner]!;
  const categoryId = bytesToHex(owner.category);
  const written = (callee.entryWrites?.writtenNodes ?? []).find((node) =>
    sharedNodeId(categoryId, node.collection, node.slot) === id);
  return written?.value !== undefined;
}

/**
 * The callee mapping nodes whose frames' views the hop chains: every node the frames touch.
 *
 * A node whose values chunk chains the same way, and the output the chain ends at carries the value the last write
 * left, which is what a later reach of the same hop reads.
 */
export function chainedNodeIds(callees: readonly HopCallee[]): ReadonlySet<string> {
  return new Set([...nodeTouches(callees)].map(([id]) => id));
}

/**
 * For each callee frame, the frames that write a node it touches before it does.
 *
 * A frame declares the view each earlier write of a shared node left, and a write's view is learned when its own
 * frame is settled, so the hop settles a frame after every such writer (`settleCallees`). A node whose values chunk
 * orders its writers the same way: the value a later reach continues from is the one the reach before it wrote.
 */
export function sharedNodeWritersBefore(callees: readonly HopCallee[]): ReadonlyMap<number, readonly number[]> {
  const before = new Map<number, number[]>();
  for (const touches of nodeTouches(callees).values()) {
    touches.forEach((touch, at) => {
      for (const earlier of touches.slice(0, at)) {
        if (earlier.kind === 'read') continue;
        // A writer the frame runs inside settles after it; the frames it runs first are ordered by `reentry.ts`.
        if (entersFrame(callees, earlier.frame, touch.frame)) continue;
        const writers = before.get(touch.frame) ?? [];
        if (!writers.includes(earlier.frame)) writers.push(earlier.frame);
        before.set(touch.frame, writers);
      }
    });
  }
  return before;
}

/**
 * For each callee frame, the frames that write a node it also writes before it does, created or spent.
 *
 * A node a frame's body creates is no deployment's, so the frames the plan places after it name it only by the
 * slot they both write: the view one of them leaves is stated by its own settle, and the frame that writes the
 * same node continues from it.
 */
export function writtenNodeWritersBefore(callees: readonly HopCallee[]): ReadonlyMap<number, readonly number[]> {
  const before = new Map<number, number[]>();
  const written = new Map<string, number[]>();
  callees.forEach((callee, frame) => {
    const owner = callee.recordOwner === undefined ? callee : callees[callee.recordOwner]!;
    for (const node of callee.entryWrites?.writtenNodes ?? []) {
      const id = sharedNodeId(bytesToHex(owner.category), node.collection, node.slot);
      const writers = written.get(id) ?? [];
      const earlier = before.get(frame) ?? [];
      // A writer the frame runs inside settles after it; the view it left is learned by deriving it up to its call.
      for (const writer of writers) {
        if (!earlier.includes(writer) && !entersFrame(callees, writer, frame)) earlier.push(writer);
      }
      before.set(frame, earlier);
      if (!writers.includes(frame)) writers.push(frame);
      written.set(id, writers);
    }
  });
  return before;
}

/** Everything the implementation frame's calls are planned from, and the live deployments they run against. */
export interface HopExternalPlanOptions {
  readonly provider: NetworkProvider;
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly args: readonly FunctionArgument[];
  /** The caller's named deployments, keyed by the interface each call reaches. */
  readonly externals: Readonly<Record<string, PerCallProxyExternal>>;
  readonly validatorProgram: Uint8Array;
  /** The caller's own state, keyed by field name, as its body reads it. Defaults to empty. */
  readonly stateValues?: Readonly<Record<string, unknown>>;
  /**
   * The deployment the entry's own frame runs on: the category its records and mapping nodes sit at, the live set
   * read there and the layout that set was classified with.
   *
   * A mapping's values are its nodes, not fields of the caller's state, so a site the entry routes through one is
   * resolved from the node this deployment holds for the key (`liveMappingValueReader`). Absent leaves every such
   * site refused by name.
   */
  readonly entryDeployment?: {
    readonly categoryId: string;
    readonly deployment: PerCallDeploymentSet;
    readonly layout: StateLayout;
  };
  /**
   * The root's own deployment behind its proxy, which a frame below the root may call back into: the proxy, the
   * implementation's category, and the root's records as the root's own frames name them.
   *
   * A call that reaches the root's address (`selfAddress`) enters the root's contract again, as a callee behind its
   * proxy whose masters are the ones of the root's pools after the root's own (`entryDeployment` is the proxy's), whose
   * frames sit in the root's own blocks, and which runs on the root's own records. Absent, such a call is refused by
   * name.
   */
  readonly reentrantRoot?: {
    readonly proxyArtifact: Artifact;
    readonly implementationCategoryId: string;
    readonly records: readonly HopCalleeRecord[];
  };
  /** The caller's own locking bytecode, i.e. `address(this)`. */
  readonly selfAddress?: Uint8Array;
  /** The frame's own `msg.sender`. */
  readonly senderAddress?: Uint8Array;
  readonly constructorArgs?: readonly FunctionArgument[];
  /**
   * The results a previous planning pass learned, keyed by the entry's own callsite ids.
   *
   * A condition that reads an earlier call's result is stated as no visit until that result is known; supplying it
   * here decides the condition, so a site whose arm the run takes gains its visits. Absent leaves every such
   * condition undecided, which is the first pass.
   */
  readonly externalReturns?: ReadonlyMap<number, FunctionArgument>;
  /**
   * The results the calls before a stopped plan's site returned, as settles of those calls learned them, keyed by
   * `reachedResultKey`: the path of the frame that made each call and the call's site.
   *
   * A site whose argument or loop bound reads an earlier call's result is planned from these; absent or missing
   * one, the plan stops before that site (`HopExternalPlan.blocked`).
   */
  readonly reachedResults?: ReadonlyMap<string, FunctionArgument>;
  /**
   * The end views a previous settle learned, per frame master for a callee and once for the entry, in each frame's
   * own learning order.
   *
   * A node a reach creates carries a value the planner cannot know when the body computes it: the settle learns the
   * commitment the frame's own record closes with, and a reach planned after it has to be told that commitment
   * rather than the plan's placeholder. Absent leaves every created node at its planned view, which is the first
   * pass.
   */
  readonly calleeWriteViews?: ReadonlyMap<string, readonly (Uint8Array | undefined)[]>;
  /**
   * The whole value a previous settle learned for a frame's chunkable mapping write, per frame master.
   *
   * A write whose value the artifact does not publish states its run unstated; the frame's own close exposes the
   * value, and a later pass sizes the run from it. Absent leaves every such run unstated, which is the first pass.
   * Under `entryWriteValueKey`, the bytes a settle of the entry itself learned its own write leaves a node at, which
   * a site after the write is planned from (`EntryWriteValueAwaited`).
   */
  readonly calleeWriteValues?: ReadonlyMap<string, Uint8Array>;
  /**
   * The compute side-cars the caller already built for the implementation's own entry, keyed by its master.
   *
   * The caller holds that frame's argument pushes, so it builds the side-cars the entry's own hashing and recovery
   * calls read; this planner builds the ones the callee frames it places read. Both are placed by the same plan.
   */
  readonly sideCars?: ReadonlyMap<string, RecoverySideCars>;
  /**
   * True for the pass that states a held continuation the way the chain ends.
   *
   * A frame that leaves a node an earlier frame created alone states the same declaration as one that rewrites it,
   * so the two are told apart only by what a settle learned: a pass planned without this keeps every continuation
   * on the view it was given, and the caller re-plans with it once the settle has accepted.
   */
  readonly heldContinuations?: boolean;
  /**
   * One of the entry's own sites, by its published position, that the plan stops before (`reads: 'refusal'`): the
   * calls before it are placed and nothing the execution reaches from it on. Absent plans every site.
   */
  readonly stopBefore?: number;
}

/** The hop's own root as a call back to it reaches it, or undefined for a plan that admits no such call. */
function reentrantRootOf(options: HopExternalPlanOptions): ReentrantRoot | undefined {
  const { reentrantRoot, entryDeployment, selfAddress } = options;
  if (reentrantRoot === undefined || entryDeployment === undefined || selfAddress === undefined) return undefined;
  return {
    address: selfAddress,
    external: {
      artifact: options.artifact,
      categoryId: entryDeployment.categoryId,
      proxyArtifact: reentrantRoot.proxyArtifact,
      implementationCategoryId: reentrantRoot.implementationCategoryId,
    },
    functionName: options.functionName,
  };
}

/** The callsite ids an entry's own conditions read a result from, in published order. */
function conditionalProducerCallsites(artifact: Artifact, functionName: string): readonly number[] {
  const found = new Set<number>();
  for (const row of routingOf(artifact, functionName)) {
    if (row.condition === undefined || row.condition === null) continue;
    for (const id of producerCallsitesOf(row.condition)) found.add(id);
  }
  return [...found];
}

/**
 * Plans the calls one implementation entry makes and the callee frames they reach, transitively.
 *
 * The published stop sites give the calls in execution order and the ABI routing gives each call its target and
 * argument sources; `externals` names the live deployment each callee runs on, and the provider's registrations are
 * the fallback. Each callee's live records are read so that a callee whose own entry makes calls is planned from
 * its own facts. A shape the hop cannot declare is refused by name, and a reach the callee's own master pool cannot
 * serve is refused by name too. A site that reads an earlier call's result `reachedResults` does not hold stops the
 * plan before it (`blocked`), with the calls the execution makes before that site placed.
 */
export async function planHopExternalCalls(
  options: HopExternalPlanOptions,
): Promise<HopExternalPlan> {
  const reentrant = reentrantRootOf(options);
  const ctx: PlanContext = {
    provider: options.provider,
    externals: options.externals,
    validatorProgram: options.validatorProgram,
    fixed: new Set([options.artifact.contractName]),
    ...(reentrant === undefined ? {} : { root: reentrant }),
    masterSlots: new Map(),
    blocks: new Map(),
    deployments: new Map(),
    records: new Map(),
    writtenNodes: new Map(),
    rewrittenNodes: new Map(),
    reachedLinks: new Map(),
    ...(options.calleeWriteViews === undefined ? {} : { calleeWriteViews: options.calleeWriteViews }),
    ...(options.calleeWriteValues === undefined ? {} : { calleeWriteValues: options.calleeWriteValues }),
    callees: [],
    utxos: new Map(),
    sideCars: new Map(options.sideCars ?? []),
    ...(options.externalReturns === undefined || options.externalReturns.size === 0
      ? {} : { producerResults: { artifact: options.artifact, values: options.externalReturns } }),
    reachedResults: options.reachedResults ?? new Map(),
    stop: {},
    ...(options.stopBefore === undefined ? {} : { stopBefore: options.stopBefore }),
  };
  for (const sideCars of ctx.sideCars.values()) {
    for (const [id, utxo] of Object.entries(sideCars.utxos)) ctx.utxos.set(id, utxo);
  }
  // A call back to the root is a callee of the root's own deployment: its frames sit in the blocks the root's own
  // frames sit in, its masters are the ones of the root's pools after the root's own, and its records are the root's.
  if (reentrant !== undefined) {
    const proxyCategoryId = reentrant.external.categoryId;
    const implementationCategoryId = reentrant.external.implementationCategoryId!;
    ctx.blocks.set(proxyCategoryId, reentrant.external.proxyArtifact!.contractName);
    ctx.blocks.set(implementationCategoryId, options.artifact.contractName);
    ctx.masterSlots.set(proxyCategoryId, 1);
    ctx.masterSlots.set(implementationCategoryId, 1);
    ctx.records.set(proxyCategoryId, options.reentrantRoot!.records);
    ctx.deployments.set(proxyCategoryId, options.entryDeployment!.deployment);
  }
  // The entry's own mapping values are read from its deployment's nodes, as a callee frame reads its own.
  const own = options.entryDeployment;
  const readMappingValue = own === undefined ? undefined : liveMappingValueReader(options.artifact,
    reachedDeploymentOf(ctx, own.categoryId, own.deployment, own.layout), options.artifact.structs);
  const root = await planEntryCalls(ctx, {
    artifact: options.artifact,
    functionName: options.functionName,
    args: options.args,
    stateValues: options.stateValues ?? {},
    ...(readMappingValue === undefined ? {} : { readMappingValue }),
    ...(options.selfAddress === undefined ? {} : { selfAddress: options.selfAddress }),
    ...(options.senderAddress === undefined ? {} : { senderAddress: options.senderAddress }),
    ...(options.constructorArgs === undefined ? {} : { constructorArgs: options.constructorArgs }),
  }, null, '');
  return {
    calls: root.calls,
    callBases: root.callBases,
    callsiteIds: root.callsiteIds,
    conditionalProducers: conditionalProducerCallsites(options.artifact, options.functionName),
    callees: ctx.callees,
    utxos: ctx.utxos,
    sideCars: ctx.sideCars,
    ...(options.heldContinuations === true ? { heldContinuations: true } : {}),
    ...(ctx.stop.blocked === undefined ? {} : { blocked: ctx.stop.blocked }),
  };
}
