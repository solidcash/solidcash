/**
 * Planning the external calls an implementation frame makes through the proxy hop.
 *
 * A framed body binds each external call to the k-th record of its own witness block, and that record has to
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

import { keccak_256 } from '@noble/hashes/sha3.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { binToUtf8 } from '@bitauth/libauth/build/lib/format/utf8.js';
import { vmNumberToBigInt } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
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
  type AbiFunction,
  type ArgSource,
  type Artifact,
  type ExternalCallAbi,
  type ExternalCallExpression,
  type FrameKindValue,
  type StateLayout,
  type StateValue,
  type FunctionSplitBundle,
  type StateVariableInfo,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../../Argument.js';
import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import {
  findDeploymentByAddress, findDeploymentByLockingBytecode, findDeploymentByName, listDeployments,
} from '../../stateful/deployment-registry.js';
import { bindBlockOracleLock, blockOracleLockFor } from '../../oracle/block-oracle-lock.js';
import { externalReturnsForCallsites } from '../../stateful/external-returns-for-callsites.js';
import { mappingKeySlotCandidates } from '../../stateful/mapping-key-lookup.js';
import type { DraftCall } from '../composer/draft.js';
import {
  deploymentBlockId, mappingBatchRepeatsSlot, readPublishedStopSites, type PublishedEntryStopSites,
} from '../composer/index.js';
import { masterForEntry, prepareFunctionSplitDeployment, requireFunctionSplitShard } from '../deploy/entry-pool.js';
import { functionSplitFor } from '../deploy/split-registry.js';
import { deployMaster, type DeployedMaster } from '../deploy/material.js';
import { framedCreate2TemplateOf } from '../deploy/create2-child.js';
import { lockingBytecodeToSolidityAddressPayload } from '../../utils.js';
import {
  chunkRecordLockingBytecode, readFramedDeployment, stateRecordLockingBytecode,
  type FramedDeploymentSet,
} from '../deploy/records.js';
import {
  entryRowOf, makeCallResolver, resolveCallTarget, resolvePublishedCall, unresolvedCallArguments,
  type AbiEntryRow, type CallResolver, type HopCallInputs, type MappingValueReader, type ResolvedCall,
} from './call-resolution.js';
import {
  hopEntryWrites, joinedNodeValue, sharedNodeId,
  type HopEntryWrites, type HopLiveDeployment, type ReachWrite, type ReachWriteTarget,
} from './entry-writes.js';
import { readEntryNode } from '../call/entry-records.js';
import { entrySideCars } from '../call/side-cars.js';
import {
  bindProviderBlockOracle, framedBlockOracle, withBlockOracleSideCar, type FramedBlockOracle,
} from '../call/block-oracle.js';
import type { RecoverySideCars } from '../composer/recovery.js';
import { bytesToSlotValue, decodeEntryCommitment } from '../../stateful/SortedList.js';
import { chainsEnclosedTouch } from './enclosed-reads.js';
import { FramedFailedCallSite, FramedNodeChainError, FramedProxyDeployError } from './errors.js';
import { reachedNodeValue } from './reached-values.js';
import { lockOfIdentity } from './address-identity.js';
import {
  EntryWriteValueAwaited, entryWriteValueKey, statedMappingWrites, writeLandsBefore, type StatedMappingWrite,
} from './written-values.js';
import { skippedEmits, skippedSends, takenSends, type WriteActivationFacts } from './write-activation.js';
import { sendRecipient } from '../call/send-recipient.js';
import { valueEntryOrRefusal, valueSendCallData } from '../call/value-entry.js';

/** One contract the caller names for a call an implementation entry makes, keyed by the interface it calls. */
export interface FramedProxyExternal {
  /** The artifact whose entries the call names, i.e. the implementation behind the address the call reaches. */
  readonly artifact: Artifact;
  /** The category whose address the calling entry's own code computes, which is the proxy's when one sits there. */
  readonly categoryId: string;
  /**
   * The proxy the callee sits behind, when the address the call reaches names a proxy rather than the artifact.
   *
   * A framed deployment places a proxy whose fallback forwards the call data it received to the address it holds,
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
  /**
   * The fungible and NFT sends each token run of the frame makes, where a call's plan dropped sends on branches the
   * body did not take; absent, the entry's own counts.
   */
  readonly tokenRunSends?: readonly { readonly sends: number; readonly nftSends: number }[];
  /** The arguments the call passes the frame, as the plan resolved them. */
  readonly args?: readonly FunctionArgument[];
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
  /**
   * For a frame a loop of which calls at several sites, each site's calls' positions in `calls`: the loop makes its
   * turns one after another, so a site's calls interleave with the other sites' rather than following its base.
   */
  readonly callPositions?: readonly (readonly number[])[];
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
  /**
   * The transfer indices of the frame's sends to a contract the plan placed as calls into that contract's value entry
   * (`HopExternalPlanOptions.calleeValueCalls`), each a deferred record in `calls`.
   */
  readonly valueSends?: readonly number[];
}

/** The live facts one callee frame's own write plan is built from, kept so the write can be planned again. */
export interface HopCalleeWriteInputs {
  /** The reach's own call data, which the write's keys and value are resolved from. */
  readonly args: readonly FunctionArgument[];
  /** The frame's `msg.sender`, which a key it writes can resolve to. */
  readonly senderAddress: Uint8Array | undefined;
  /** The frame's own address, which an `address(this)` key it writes resolves to. */
  readonly selfAddress?: Uint8Array;
  /** Whether each guarded write the frame's facts do not decide runs, by entry-access slot. */
  readonly assumedActivations?: ReadonlyMap<number, boolean>;
  /** True when the plan's caller plans the frame's undecided writes again, assumed the other way (`assumesUndecided`). */
  readonly assumesUndecided?: boolean;
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
  /**
   * What the site reads the results for, or `refusal` for a stop before a site whose frames are refused. `target`
   * is a site whose address names no deployment yet, while an earlier site whose guard reads the results may be the
   * call that creates what it reaches. `computed` is a site whose arguments the body computes in a way no published
   * expression states, which a run of the body up to the site hashes (`computed`).
   */
  readonly reads: 'argument' | 'computed' | 'loop-bound' | 'refusal' | 'target';
  /** The earlier call sites of the same frame whose results the site reads, by callsite id. */
  readonly producers: readonly number[];
  /**
   * On a `computed` stop, the call whose arguments a run reads back (`hashedCallArguments`): the key they are held
   * under (`hashedArgumentsKey`), the callee's selector and arity, and the canonical value of each argument the
   * caller's facts do resolve, which a hashed list has to agree with to be this call's.
   */
  readonly computed?: {
    readonly key: string;
    readonly selector: Uint8Array;
    readonly arity: number;
    readonly resolved: readonly (Uint8Array | undefined)[];
  };
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

/** The key the arguments a run hashed for one visit of a site are held under: the frame, the site and the turn. */
export function hashedArgumentsKey(callerPath: string, callsiteId: number, occurrence: number): string {
  return `${callerPath}|${callsiteId}.${occurrence}`;
}

/** What the implementation frame's calls and the callee frames they reach are planned as. */
export interface HopExternalPlan {
  readonly calls: readonly DraftCall[];
  /** For each published call site of the implementation's entry, the position of its first call in `calls`. */
  readonly callBases: readonly number[];
  /** Each site's calls' positions in `calls`, for an entry whose loop sites' calls interleave (`HopCallee`). */
  readonly callPositions?: readonly (readonly number[])[];
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
  throw new FramedProxyDeployError(
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
    throw new FramedProxyDeployError(
      `${where} runs a loop whose counter the caller's own arguments do not fix`,
    );
  }
  if (step === 0n) {
    throw new FramedProxyDeployError(`${where} runs a loop whose counter never advances`);
  }
  let count = 0;
  let counter = initial;
  for (let turn = 0; turn < domain.maximumIterations; turn += 1) {
    const bindings = new Map<string, FunctionArgument>([[domain.counterName, counter]]);
    const keep = resolver.evaluate(domain.continueCondition, 0, bindings, continueReturns);
    if (keep === undefined) {
      throw new FramedProxyDeployError(
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
 * True when no fact of the caller decides whether a conditional site's call runs: the artifact states no guard for
 * it, or the guard is neither true nor false (a value the evaluator cannot compute) once every result it reads that
 * the plan places is held. `occurrenceCountOf` plans such a site one way, taken without a guard or over the caller's
 * own facts and skipped over a result; the body is the authority on which it was. A guard over the frame's own writes
 * is left to the rule that plans it taken.
 */
function undecidedGuard(
  row: ExternalCallAbi, resolver: CallResolver, artifact: Artifact, writtenState: HopWrittenState, siteIndex: number,
  routing: readonly ExternalCallAbi[], placed: readonly unknown[],
  producerResults: ReadonlyMap<number, FunctionArgument> | undefined,
): boolean {
  if ((row.occurrence ?? 'once') !== 'conditional') return false;
  if (row.condition === undefined || row.condition === null) return true;
  if (conditionReadsWrittenState(row.condition, artifact, writtenState, siteIndex)) return false;
  if (waitingProducers([row.condition], siteIndex, routing, placed, producerResults).length > 0) return false;
  return resolver.evaluate(
    row.condition, 0, undefined, conditionExternalReturns(row.condition, routing, producerResults),
  ) === undefined;
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
    throw new FramedProxyDeployError(
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
  layout: StateLayout, categoryId: string, deployment: FramedDeploymentSet,
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
  return mappingKeySlotCandidates(scalarKeys, collection.keyTypes ?? [collection.keyType], collection);
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
/**
 * A frame reads a node an earlier reach of the same call rewrote at a value that reach's body computes. The call is
 * planned again once a settle of the reaches before the frame has learned the view the node ends at
 * (`calleeWriteViews`), which states the value the frame reads.
 */
export class WrittenValueAwaited extends FramedProxyDeployError {}

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
      throw new WrittenValueAwaited(
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
    const node = value as { readonly kind?: string; readonly name?: string; readonly readAtEntry?: boolean };
    // A read the compiler places where the frame starts reads the frame's own nodes, whatever the entry writes after.
    if (node.kind === 'stateAccess' && typeof node.name === 'string' && !fieldOf && node.readAtEntry !== true) {
      names.add(node.name);
    }
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
      throw new FramedProxyDeployError(refusal);
    }
    return mappingValueOf(collection.valueType, value, artifact, artifact.structs);
  };
}

/** One dynamic field's value, joined from its chunk records and decoded as the field's own type declares. */
function dynamicFieldValue(
  deployment: FramedDeploymentSet, layout: StateLayout, categoryId: string,
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
}): FramedProxyExternal | undefined {
  const contract = registered.contract as {
    readonly artifact?: Artifact;
    readonly inner?: { readonly artifact?: Artifact };
    readonly categoryId?: string;
    readonly proxy?: { readonly categoryId?: string };
    readonly framedProxy?: { readonly artifact?: Artifact; readonly implementationCategoryId?: string };
  };
  const artifact = contract.inner?.artifact ?? contract.artifact;
  const categoryId = contract.proxy?.categoryId ?? contract.categoryId;
  const proxy = contract.framedProxy;
  return artifact === undefined || categoryId === undefined ? undefined : {
    artifact,
    categoryId,
    ...(proxy?.artifact === undefined ? {} : { proxyArtifact: proxy.artifact }),
    ...(proxy?.implementationCategoryId === undefined
      ? {} : { implementationCategoryId: proxy.implementationCategoryId }),
  };
}

/** The deployment one call's target address names, from the provider's registrations. */
function externalOfAddress(provider: NetworkProvider, target: Uint8Array): FramedProxyExternal | undefined {
  const registered = findDeploymentByLockingBytecode(provider, binToHex(target))
    ?? findDeploymentByAddress(provider, binToHex(target));
  return registered === undefined ? undefined : externalOfRegistered(registered);
}

/** The deployment a call's interface names, stripping the Solidity interface's leading `I`. */
function externalOfName(provider: NetworkProvider, interfaceName: string): FramedProxyExternal | undefined {
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
): FramedProxyExternal | undefined {
  return (target.length === 0 ? undefined : externalOfAddress(provider, target))
    ?? externalOfName(provider, interfaceName);
}

/**
 * The address a call names by a 20-byte identity: the address of a contract the plan can reach whose identity it is.
 * An identity no deployment answers stays the identity, which no callee resolves: a created child is reached at its
 * own `addrV(K)` in the transaction that mints it (docs/framed/CREATE2_IDENTITY.md), so nothing is stood up here.
 */
async function identityTarget(
  _ctx: PlanContext, _caller: HopCallInputs, _row: ExternalCallAbi, identity: Uint8Array,
): Promise<Uint8Array> {
  return reachedIdentity(_ctx, identity) ?? identity;
}

/** The address a 20-byte identity names among the deployments a plan can reach, if one projects to it. */
export function reachedIdentity(scope: ReachableScope, identity: Uint8Array): Uint8Array | undefined {
  for (const address of reachableAddresses(scope)) {
    const projected = lockingBytecodeToSolidityAddressPayload(address);
    if (projected !== undefined && bytesEqual(projected, identity)) return address;
  }
  return undefined;
}

/**
 * The child a call reaches at an identity no deployment holds: one the caller's own creation names
 * (`composition.creates`), or one its target computes as a CREATE2 address over a code hash a template names
 * (`registerFramedCreate2Template`) — `keccak256(0xff ++ creator ++ salt ++ codeHash)`, whose creator the target
 * names as well. Absent when neither describes the call.
 */
function createdChildOf(
  provider: NetworkProvider, caller: HopCallInputs, row: ExternalCallAbi,
): { readonly contractName: string; readonly creatorSelf: Uint8Array | undefined } | undefined {
  const creates = caller.artifact.composition?.creates ?? [];
  if (creates.length > 0) {
    const named = creates.length === 1 ? creates[0]
      : creates.find((site) => site.contractName === row.interfaceName.replace(/^I/, ''));
    if (named === undefined) return undefined;
    return {
      contractName: named.contractName ?? createdFromCode(provider, caller, row, named.codeStateVariable),
      creatorSelf: caller.selfAddress,
    };
  }
  const fields = create2TargetFields(row);
  if (fields === undefined) return undefined;
  const resolver = makeCallResolver(caller);
  const codeHash = resolver.evaluate(fields.codeHash, 0);
  const creator = resolver.evaluate(fields.creator, 0);
  if (!(codeHash instanceof Uint8Array) || codeHash.length !== 32 || !(creator instanceof Uint8Array)) return undefined;
  const contractName = framedCreate2TemplateOf(provider, codeHash);
  return contractName === undefined ? undefined : { contractName, creatorSelf: creator };
}

/** The creator and code hash of a target the routing computes as a CREATE2 address, or absent for any other. */
function create2TargetFields(
  row: ExternalCallAbi,
): { readonly creator: ExternalCallExpression; readonly codeHash: ExternalCallExpression } | undefined {
  const source = row.addressSource;
  if (source?.kind !== 'expression') return undefined;
  let expression: ExternalCallExpression | undefined = source.expression;
  while (expression?.kind === 'cast') expression = expression.expression;
  if (expression?.kind !== 'call' || expression.name !== 'keccak256' || expression.args?.length !== 1) return undefined;
  const packed = expression.args[0];
  if (packed?.kind !== 'abiEncodePacked' || packed.args?.length !== 4) return undefined;
  const [prefix, creator, , codeHash] = packed.args;
  if (prefix?.kind !== 'literal' || String(prefix.value).toLowerCase() !== 'ff' || creator === undefined
    || codeHash === undefined) return undefined;
  return { creator, codeHash };
}

/**
 * The contract a creation from the code the creator holds stands up: the template registered for the code's
 * keccak256, which is the hash the child's identity commits to (`registerFramedCreate2Template`).
 */
function createdFromCode(
  provider: NetworkProvider, caller: HopCallInputs, row: ExternalCallAbi, codeStateVariable: string | undefined,
): string {
  const where = `the call to "${row.interfaceName}.${row.functionName}"`;
  const code = codeStateVariable === undefined ? undefined : caller.stateValues[codeStateVariable];
  if (!(code instanceof Uint8Array)) {
    throw new FramedProxyDeployError(
      `${where} reaches a child "${caller.artifact.contractName}" creates from code it holds in `
      + `"${codeStateVariable ?? '<unnamed>'}", which its state does not carry as bytes`,
    );
  }
  const codeHash = Uint8Array.from(keccak_256(code));
  const contractName = framedCreate2TemplateOf(provider, codeHash);
  if (contractName === undefined) {
    throw new FramedProxyDeployError(
      `${where} reaches a child "${caller.artifact.contractName}" creates from code whose keccak256 is `
      + `${binToHex(codeHash)}, which no CREATE2 template names (registerFramedCreate2Template)`,
    );
  }
  return contractName;
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
  readonly external: FramedProxyExternal;
  /** The entry the root runs. */
  readonly functionName: string;
}

/** The planner's running state: the live deployments it resolves against and the frames it has placed. */
interface PlanContext {
  readonly provider: NetworkProvider;
  readonly externals: Readonly<Record<string, FramedProxyExternal>>;
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
  readonly deployments: Map<string, FramedDeploymentSet>;
  /**
   * The state each category's placed frames leave, as their entries' own published writes state it
   * (`AbiFunction.stateWrites`): a later reach of the contract in the same transaction reads its records as those
   * frames left them, which the deployment does not hold yet.
   */
  readonly reachedState: Map<string, Readonly<Record<string, unknown>>>;
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
  /** Whether each callee frame's undecided guarded writes run, by master and entry-access slot. */
  readonly calleeAssumedActivations?: ReadonlyMap<string, ReadonlyMap<number, boolean>>;
  /** Whether each conditional site no fact of the caller decides is taken, by `undecidedCallKey`. */
  readonly assumedCalls?: ReadonlyMap<string, boolean>;
  /** Told each conditional site no fact decides (`undecidedGuard`), by `undecidedCallKey`, and the way it was planned. */
  readonly noteUndecidedCall?: (key: string, taken: boolean) => void;
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
  /**
   * The arguments runs of the calling bodies hashed for visits whose arguments no published expression states, in
   * parameter order and keyed by `hashedArgumentsKey`.
   */
  readonly hashedArguments?: ReadonlyMap<string, readonly Uint8Array[]>;
  /** The site the plan stops before, once one is found: nothing after it in execution order is placed. */
  readonly stop: { blocked?: HopPlanBlock };
  /** The entry's own site the plan is asked to stop before (`HopExternalPlanOptions.stopBefore`). */
  readonly stopBefore?: number;
  /** The per-entry bundle a same-category call resolves a shard from. Absent on a monolith. */
  readonly split?: FunctionSplitBundle;
  /** The category whose calls `split` retargets onto shards. */
  readonly splitCategoryId?: string;
  /**
   * The caller's own `address(this)`.
   *
   * A call whose target is this address spends another master of the same category. It is the root's own
   * deployment, reached again, rather than a second contract of the same name.
   */
  readonly selfAddress?: Uint8Array;
  /** Masters already claimed, keyed by category, so a later frame does not spend them again. */
  readonly takenMasters: Map<string, Set<string>>;
  /**
   * True when a callee frame's send to a contract is planned as the call it is (`HopExternalPlanOptions`), absent
   * where such a send is left to the frame's own refusal.
   */
  readonly calleeValueCalls?: boolean;
  /** True when a call to the root's own address re-enters the root's deployment (`HopExternalPlanOptions`). */
  readonly rootReentry?: boolean;
  /** The category the root's own records sit at (`HopExternalPlanOptions.entryDeployment`). */
  readonly rootCategoryId?: string;
  /** True when a callee frame's site the planner refuses stops the plan there (`HopExternalPlanOptions`). */
  readonly calleeSiteRefusals?: boolean;
  /** True when a callee frame's undecided writes are planned again, assumed the other way (`HopExternalPlanOptions`). */
  readonly assumesUndecided?: boolean;
}

/** The addresses of the contracts a plan can reach: the caller's named externals, then the latest registrations. */
/** What names the deployments a plan can reach: the caller's externals and the provider's registrations. */
type ReachableScope = Pick<PlanContext, 'externals' | 'provider' | 'validatorProgram'>;

function* reachableAddresses(ctx: ReachableScope): Generator<Uint8Array> {
  for (const external of Object.values(ctx.externals)) {
    yield validatorAddress(hexToBin(external.categoryId), ctx.validatorProgram);
  }
  for (const registered of [...listDeployments(ctx.provider)].reverse()) {
    const external = externalOfRegistered(registered);
    if (external !== undefined) yield validatorAddress(hexToBin(external.categoryId), ctx.validatorProgram);
  }
}

/** The addresses of the framed deployments the provider registers, latest first, as their frames present them. */
export function registeredFramedAddresses(provider: NetworkProvider, validatorProgram: Uint8Array): Uint8Array[] {
  return [...listDeployments(provider)].reverse().flatMap((registered) => {
    const external = externalOfRegistered(registered);
    return external === undefined ? [] : [validatorAddress(hexToBin(external.categoryId), validatorProgram)];
  });
}

/**
 * The per-entry bundle the frame making a call runs from, with its category: the bundle of the deployment the frame
 * names, or the root's own for a frame that names none.
 */
function callerSplitOf(
  ctx: PlanContext, caller: HopCallInputs,
): { readonly split: FunctionSplitBundle; readonly categoryId: string } | undefined {
  const categoryId = caller.categoryId ?? ctx.splitCategoryId;
  if (categoryId === undefined) return undefined;
  const split = splitOf(ctx, categoryId);
  return split === undefined ? undefined : { split, categoryId };
}

/** The per-entry bundle a category runs from: the root's own, or the one its genesis registered on the provider. */
function splitOf(ctx: PlanContext, categoryId: string): FunctionSplitBundle | undefined {
  if (ctx.split !== undefined && ctx.splitCategoryId !== undefined
    && categoryId.toLowerCase() === ctx.splitCategoryId.toLowerCase()) return ctx.split;
  return functionSplitFor(ctx.provider, categoryId);
}

/** The program a split callee's entry runs: its shard, with any helper lock the shard names filled. */
function shardArtifactOf(
  ctx: PlanContext, split: FunctionSplitBundle, categoryId: string,
  call: { readonly selector: string; readonly functionName: string },
): Artifact {
  const shard = split.shards.find((candidate) => candidate.selector.toLowerCase() === call.selector.toLowerCase());
  if (shard === undefined) throw new FramedProxyDeployError(`function "${call.functionName}" has no shard`);
  if ((shard.artifact.composition?.internalHelperLocks?.length ?? 0) === 0) return shard.artifact;
  const prepared = prepareFunctionSplitDeployment(split, hexToBin(categoryId), ctx.validatorProgram);
  const filled = prepared.shardArtifacts.get(shard.selector.toLowerCase());
  if (filled === undefined) throw new FramedProxyDeployError(`function "${call.functionName}" is not in the prepared split`);
  return filled;
}

/**
 * The deployment a call reaches, as the callee frame runs it: a category deployed from a per-entry bundle, the root's
 * own or another's, runs the callee entry's shard. The address stays addrV; the lock is the shard's. A split contract
 * has no shard for a function its logical contract does not define: the call then reaches no body, which `entryRowOf`
 * names, and a low-level call fails there as the EVM's does.
 */
function withCalleeShard(
  ctx: PlanContext, external: FramedProxyExternal,
  call: { readonly selector: string; readonly functionName: string }, functionName: string,
): FramedProxyExternal {
  const split = splitOf(ctx, external.categoryId);
  if (split === undefined) return external;
  const definesShard = split.shards.some((candidate) =>
    candidate.selector.toLowerCase() === call.selector.toLowerCase());
  const logicalDefines = external.artifact.abi.some((candidate) => candidate.name === functionName);
  return definesShard || logicalDefines
    ? { ...external, artifact: shardArtifactOf(ctx, split, external.categoryId, call) } : external;
}

/** The deployment a call reaches: the caller's named externals first, then the provider's registrations. */
function resolveExternal(ctx: PlanContext, row: ExternalCallAbi, target: Uint8Array): FramedProxyExternal {
  const expected = (external: FramedProxyExternal): string =>
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
    throw new FramedProxyDeployError(
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
export function argumentReturnsOf(
  row: ExternalCallAbi, routing: readonly ExternalCallAbi[], known: ReadonlyMap<number, FunctionArgument> | undefined,
): ReadonlyMap<string, FunctionArgument> | undefined {
  const sources = [...row.argSources ?? [], ...row.addressSource === undefined ? [] : [row.addressSource]];
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
  readonly external: FramedProxyExternal;
  /** The deployment each resolved call reaches, parallel to `resolved`: a loop's turns may reach different ones. */
  readonly externals: readonly FramedProxyExternal[];
  readonly resolved: readonly ResolvedCall[];
  readonly where: string;
  /** The turn each resolved call runs in, parallel to `resolved`: a guarded loop's skipped turns are left out. */
  readonly turns: readonly number[];
  /** Every turn the site calls on, past the ones `turns` resolves when the pass stopped inside the site. */
  readonly callingTurns: readonly number[];
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
  /** Each site's calls' positions in `calls`, for a plan whose loop sites' calls interleave (`HopCallee`). */
  readonly callPositions?: readonly (readonly number[])[];
  readonly callsiteIds: number[];
  /** True when the plan stopped before one of this entry's own sites or inside a callee one of them reached. */
  readonly truncated: boolean;
  /** The transfer indices of the sends to a contract the plan placed as calls (`calleeValueSends`). */
  readonly valueSends?: readonly number[];
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
/** The cut artifact plus the ABI row the planner needs. The published cut strips that row. */
function helperArtifactWithStub(
  artifact: Artifact,
  functionName: string,
  selector: string,
  row: ExternalCallAbi,
  entry?: AbiFunction,
): Artifact {
  // The cut publishes the helper's own row. A cut that predates it is read from the call site: its arguments' and
  // results' types, as the caller states them.
  const stated = entry ?? {
    name: functionName,
    inputs: (row.argSources ?? []).map((source, index) => ({ name: `arg${index}`, type: source.type ?? 'int' })),
    outputs: (row.returnTypes ?? []).map((type, index) => ({ name: `ret${index}`, type })),
    ...(row.resultEncoding === undefined ? {} : { resultEncoding: row.resultEncoding }),
  };
  const stub: Artifact = {
    ...artifact,
    abi: [
      ...artifact.abi.filter((fn) => fn.name !== functionName),
      { ...stated, name: functionName, selector: selector.replace(/^0x/i, '').toLowerCase() },
    ],
  };
  // The stub is the helper's own program, so its masters pin the block oracle the helper's deployment bound.
  const oracleLock = blockOracleLockFor(artifact);
  if (oracleLock !== undefined) bindBlockOracleLock(stub, oracleLock);
  return stub;
}

/**
 * What a `computed` stop names for one visit: its key, the callee's selector and arity, and the canonical value of
 * each integer or byte-string argument the caller's facts resolve. An address is not compared, since the body digests
 * one it holds as an identity as that identity (`identityArguments`), nor is a `bool`, whose push this side does not
 * pin.
 */
function computedStop(
  row: ExternalCallAbi, calleeEntry: AbiEntryRow, resolver: CallResolver, occurrence: number, key: string,
): NonNullable<HopPlanBlock['computed']> {
  if (calleeEntry.selector === undefined) {
    throw new FramedProxyDeployError(
      `the callee entry "${calleeEntry.name}" publishes no selector, so the call carries no call data`,
    );
  }
  const visible = calleeEntry.inputs.filter((input) => !input.name.startsWith('__internal__'));
  const resolved = (row.argSources ?? []).map((source, index): Uint8Array | undefined => {
    const type = visible[index]?.type;
    if (type === undefined || !/^(u?int\d*|bytes\d*|string)$/.test(type)) return undefined;
    const value = resolver.resolveArgument(source, occurrence);
    if (value === undefined) return undefined;
    try {
      const encoded = encodeFunctionArgument(value, type);
      return encoded instanceof Uint8Array ? encoded : undefined;
    } catch {
      return undefined;
    }
  });
  return { key, selector: hexToBin(calleeEntry.selector), arity: visible.length, resolved };
}

async function planEntryCalls(
  ctx: PlanContext,
  caller: HopCallInputs,
  enteredBy: number | null,
  path: string,
): Promise<PlannedEntryCalls> {
  const identity = `${caller.artifact.contractName}.${caller.functionName}()`;
  const published = readPublishedStopSites(caller.artifact).entries
    .find((entry) => entry.functionName === identity);
  // A callee frame's sends to a contract are calls into the contract's value entry, made where its body sends.
  const valueSends = path !== '' && ctx.calleeValueCalls === true ? calleeValueSends(caller, published) : [];
  if (published === undefined || (published.calls.length === 0 && valueSends.length === 0)) {
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
  // The results the guards of the sites skipped so far read and the pass does not hold: such a site fills nothing
  // yet, and a later site may reach a contract its call creates (a factory's `createPair` ahead of the pair's call).
  const guardWaits = new Set<number>();
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
      throw new FramedProxyDeployError(
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
    const counted = occurrenceCountOf(
      row, caller.args, siteBase, where, caller.artifact, writtenState, index, routing, known,
    );
    // A conditional site no fact of the caller decides is decided by the execution alone: the plan takes the way it
    // counted as an assumption the caller tries both ways, since a frame that skips a planned call, or makes one the
    // plan skipped, binds every later record a place off.
    const undecided = undecidedGuard(row, siteBase, caller.artifact, writtenState, index, routing, sites, known);
    const key = undecidedCallKey(path, index);
    const assumed = undecided ? ctx.assumedCalls?.get(key) : undefined;
    if (undecided && assumed === undefined) ctx.noteUndecidedCall?.(key, counted > 0);
    const count = assumed === undefined ? counted : assumed ? 1 : 0;
    const turns = callingTurnsOf(row, count, siteBase, caller.artifact, writtenState, index, routing, known);
    // A site the caller's own facts give no visits fills no record: it reaches no callee, so nothing is placed
    // for it and its target and arguments need not resolve.
    if (turns.length === 0) {
      // A guard over a result the pass does not hold yet ends the pass, as an argument over one does: the calls the
      // site would make (a factory's `createPair`) may create or write what the sites after it reach, so nothing
      // after it is planned until the settle learns the result and the next pass decides the guard.
      const guardReads = (row.occurrence ?? 'once') !== 'loop' && row.condition !== undefined && row.condition !== null
        ? waitingProducers([row.condition], index, routing, sites, known) : [];
      if (guardReads.length > 0) {
        for (const producer of guardReads) guardWaits.add(producer);
        ownStop = { path, where, reads: 'argument', producers: guardReads };
        break;
      }
      sites.push(undefined);
      continue;
    }
    const argumentWaits = waitingProducers(row.argSources ?? [], index, routing, sites, known);
    if (argumentWaits.length > 0) {
      ownStop = { path, where, reads: 'argument', producers: argumentWaits };
      break;
    }
    // A target the caller computes from an earlier call's result (the factory it asks a router for, or a pair address
    // hashed from it) waits for that result as an argument over one does, and is resolved from it on the next pass.
    const targetWaits = row.addressSource === undefined
      ? [] : waitingProducers([row.addressSource], index, routing, sites, known);
    if (targetWaits.length > 0) {
      ownStop = { path, where, reads: 'argument', producers: targetWaits };
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
    const resolvedTarget = resolveCallTarget(effective, siteCaller, siteResolver, turns[0]!);
    // A target the source names as the zero address has no deployment to place a callee on. The hop states no
    // record for the site and lets the entry's own body decide: a body that guards the call never reaches it and
    // is settled on its own refusal, while one that does reach it stalls on the record the hop never filled rather
    // than reaching a contract it did not name.
    if (resolvedTarget === undefined) {
      sites.push(undefined);
      continue;
    }
    const target = resolvedTarget.length === 20 && call.interfaceName !== '__FunctionSplitInternal'
      ? await identityTarget(ctx, caller, row, resolvedTarget) : resolvedTarget;
    // A cut helper's target is its filled lock, not addrV, so it is not a registered external. The stub row
    // lets the existing planner place the cut; the frame kind is INTERNAL, which the ABI cannot state.
    const internalCut = call.interfaceName === '__FunctionSplitInternal';
    let external: FramedProxyExternal;
    let reentry = false;
    let forcedKind: FrameKindValue | undefined;
    if (internalCut) {
      // The cut is a helper of the contract the calling frame runs on, which may be a callee's rather than the root's.
      const own = callerSplitOf(ctx, caller);
      if (own === undefined) {
        throw new FramedProxyDeployError(
          `${where} is an internal helper cut, which this call places only for a function split`,
        );
      }
      const named = own.split.internalCuts.filter((cut) =>
        cut.name === call.functionName || cut.name.startsWith(`${call.functionName}(`));
      // Helpers two entries cut apart, each compiled beside that entry's other cuts, are told apart by their caller.
      const callerSelector = caller.artifact.abi.find((fn) => fn.name === caller.functionName)?.selector?.toLowerCase();
      const ownCaller = named.filter((cut) => callerSelector !== undefined
        && cut.callerSelectors.some((selector) => selector.toLowerCase() === callerSelector));
      const matches = named.length > 1 && ownCaller.length === 1 ? ownCaller : named;
      if (matches.length !== 1) {
        throw new FramedProxyDeployError(`${where} matches ${matches.length} internal helper cuts`);
      }
      const cut = matches[0]!;
      const prepared = prepareFunctionSplitDeployment(own.split, hexToBin(own.categoryId), ctx.validatorProgram);
      const helper = prepared.cutArtifacts.get(cut.name);
      if (helper === undefined) {
        throw new FramedProxyDeployError(`${where} has no filled helper lock`);
      }
      const stub = helperArtifactWithStub(helper, call.functionName, call.selector, row, cut.entry);
      // A deployment binds the provider's oracle into the helper it mints, so the stub its masters are found by does too.
      bindProviderBlockOracle(ctx.provider, stub);
      external = { artifact: stub, categoryId: own.categoryId };
      forcedKind = FrameKind.INTERNAL;
      // The cut is another master of the contract this hop already places, not a second deployment of it.
      reentry = true;
    } else {
      // A call back to the hop's own root enters the root's deployment again. A proxy hop names that root.
      // A split direct call names it by address: the target is address(this), so the root external is the
      // deployment the caller already runs, and the shard swap below selects the callee entry's master. A monolith
      // has no second master to give it, so its call to address(this) meets the refusal below.
      const callsSelf = (ctx.split !== undefined || ctx.rootReentry === true) && ctx.selfAddress !== undefined
        && bytesEqual(target, ctx.selfAddress);
      reentry = targetsRoot(ctx.root, target) || callsSelf;
      try {
        external = reentry && ctx.root !== undefined ? ctx.root.external : resolveExternal(ctx, row, target);
      } catch (error) {
        // An identity no deployment sits at yet, past a site whose guard waits on a result, may be the contract that
        // site's call creates: the pass stops here, and the next one plans that site from the result first.
        // So may one an earlier site's callee creates: an earlier call whose result the pass does not hold yet (a
        // factory's `createPair`) is settled first, and the next pass finds the child its frame stood up.
        const creators = sites.flatMap((site, at) => {
          const callsiteId = routing[at]?.callsiteId;
          return site !== undefined && callsiteId !== undefined && known?.has(callsiteId) !== true
            && (site.entry.outputs ?? []).length > 0 ? [callsiteId] : [];
        });
        if (!(error instanceof FramedProxyDeployError) || target.length !== 20
          || guardWaits.size + creators.length === 0) throw error;
        ownStop = { path, where, reads: 'target', producers: [...guardWaits, ...creators] };
        break;
      }
      external = withCalleeShard(ctx, external, call, row.functionName);
    }
    const entry = ((): ReturnType<typeof entryRowOf> => {
      try {
        return entryRowOf(external.artifact, row.functionName);
      } catch (error) {
        // A low-level call to a contract with no body for it fails, as the EVM's does, where the caller makes it.
        if (!(error instanceof FramedProxyDeployError) || row.failedCallMessage === undefined) throw error;
        throw new FramedFailedCallSite(error.message, row.failedCallMessage);
      }
    })();
    // A body the compiler refused publishes no call sites, so the hop could declare no record for it and would
    // settle its frame against a program whose calls stay unbound. The refusal is named here, before any frame is
    // placed, exactly as the hop names a refused entry of its own.
    const refusal = refusedEntryReason(external.artifact, row.functionName);
    if (refusal !== undefined) {
      throw new FramedProxyDeployError(
        `${where} reaches "${external.artifact.contractName}.${row.functionName}()", which the compiler refused: `
        + refusal,
      );
    }
    // An address the caller holds as the identity a call result carried reaches the callee as the lock it names.
    const lockOf = (carried: Uint8Array): Uint8Array => lockOfIdentity(carried, reachableAddresses(ctx));
    // A turn whose arguments the body computes in a way no published expression states is planned from what a run of
    // the body hashed for it. The turns before the first one no run has read are placed, and the pass stops there:
    // a run of the body up to that turn hashes its arguments, and the next pass plans it from them.
    const resolved: ResolvedCall[] = [];
    for (const turn of turns) {
      const hashed = row.callsiteId === undefined
        ? undefined : ctx.hashedArguments?.get(hashedArgumentsKey(path, row.callsiteId, turn));
      if (hashed === undefined && row.callsiteId !== undefined && path === ''
        && unresolvedCallArguments(effective, siteResolver, turn).length > 0) {
        ownStop = {
          path, where, reads: 'computed', producers: [],
          computed: computedStop(row, entryRowOf(external.artifact, row.functionName), siteResolver, turn,
            hashedArgumentsKey(path, row.callsiteId, turn)),
        };
        break;
      }
      let stated: ResolvedCall;
      try {
        stated = resolvePublishedCall(
          effective, external.artifact, siteCaller, siteResolver, turn, lockOf, hashed);
      } catch (error) {
        // A callee frame's site the planner refuses is met only once the frame reaches it (spec V6): the frame is
        // placed with the calls before the site, and a check of its own that stops it first names its own reason.
        if (path === '' || ctx.calleeSiteRefusals !== true || !(error instanceof FramedProxyDeployError)) throw error;
        ownStop = { path, where, reads: 'refusal', producers: [], refusal: error };
        break;
      }
      resolved.push(forcedKind === undefined ? stated : { ...stated, kind: forcedKind });
    }
    // A callee behind its own proxy is two contracts, and the hop's own implementation is one the composition
    // fixes: a call back to the root itself is placed on the root's own deployment, and any other reach of the
    // implementation is refused by name here, before any live record is read.
    const placedNames = external.proxyArtifact === undefined
      ? [external.artifact.contractName]
      : [external.proxyArtifact.contractName, external.artifact.contractName];
    for (const name of placedNames) {
      if (ctx.fixed.has(name) && !reentry) {
        throw new FramedProxyDeployError(
          `${where} reaches "${name}", which this hop already places; a contract that reaches itself below `
          + 'itself cannot be given a second block in the hop',
        );
      }
    }
    // A loop's turns may reach different deployments, one pair per hop of a path: a turn whose target is not the first
    // turn's is placed on the deployment its own target names, found the way the first turn's is.
    const externals: FramedProxyExternal[] = [];
    for (const turnCall of resolved) {
      if (externals.length === 0 || internalCut || reentry || bytesEqual(turnCall.target, resolved[0]!.target)) {
        externals.push(external);
        continue;
      }
      const turnTarget = turnCall.target.length === 20
        ? await identityTarget(ctx, caller, row, turnCall.target) : turnCall.target;
      externals.push(withCalleeShard(ctx, resolveExternal(ctx, row, turnTarget), call, row.functionName));
    }
    if (resolved.length > 0) {
      sites.push({
        entry, external, externals, resolved, where, turns: turns.slice(0, resolved.length), callingTurns: turns,
      });
    }
    if (ownStop !== undefined) break;
  }

  // Pass two: read each callee's live deployment, take a master per reach from its pool, plan the callee's own
  // calls from the values that deployment holds, and place its frames. A stop inside a callee's own calls is
  // earlier in execution order than anything after that callee, so nothing after it is placed.
  const calls: DraftCall[] = [];
  const callBases: number[] = [];
  const callsiteIds: number[] = [];
  const placedSends: number[] = [];
  // A send is made after the calls its body makes before it, each site before it making one call as its own
  // `sendCallsBefore` counts them; a site that may make none or several leaves the send's place open, which is
  // refused by name rather than guessed.
  const placeSendsBefore = async (index: number): Promise<void> => {
    for (const send of valueSends.filter((candidate) => candidate.callsBefore === index)) {
      const open = published.calls.slice(0, index).findIndex((_call, at) => {
        const row = routing[at];
        return (row?.occurrence ?? 'once') !== 'once' || (row?.condition !== undefined && row?.condition !== null);
      });
      if (open >= 0) {
        throw new FramedProxyDeployError(
          `the entry "${caller.functionName}" sends to the contract at ${binToHex(send.recipient)} after a call that `
          + 'may be made once, many times or not at all, so the call the send makes has no fixed place among its calls',
        );
      }
      await placeValueSend(ctx, caller, enteredBy, path, send, calls);
      placedSends.push(send.transferIndex);
    }
  };
  // Each site's calls' positions in `calls`, which a loop whose body calls at several sites interleaves.
  const positions: number[][] = [];
  /** Places the resolved turns `[from, to)` of a site, the consecutive ones that reach one deployment together. */
  const placeTurns = async (index: number, site: ResolvedSite, from: number, to: number): Promise<void> => {
    const callsiteId = routing[index]!.callsiteId ?? -1;
    const { externals, entry, resolved, where, turns } = site;
    for (let start = from; start < to && ctx.stop.blocked === undefined;) {
      const external = externals[start]!;
      let end = start + 1;
      while (end < to && externals[end]!.categoryId === external.categoryId) end += 1;
      const reach: CalleeReach = { callerPath: path, site: index, callsiteId, turns: turns.slice(start, end) };
      const run = resolved.slice(start, end);
      start = end;
      const before = calls.length;
      // A callee whose address names a framed proxy is placed as the same chain the root hop places for its own
      // proxy: the proxy's fallback frame, then the implementation entry it delegates to on the proxy's records.
      if (external.proxyArtifact !== undefined && external.implementationCategoryId !== undefined) {
        await placeProxiedCallee(ctx, caller, enteredBy, external, entry, run, calls, where, reach);
      } else {
        await placeCalleeMasters(ctx, caller, enteredBy, external, entry, run, calls, where, reach);
      }
      for (let at = before; at < calls.length; at += 1) positions[index]!.push(at);
    }
  };
  // The loop a site's calls are made in, for a site a single loop repeats.
  const loopOf = (index: number): number | undefined => {
    const row = routing[index];
    return row?.occurrence === 'loop' && row.nestedIterationDomains === undefined
      ? row.iterationDomain?.sourceLoopId : undefined;
  };
  for (let index = 0; index < sites.length; index += 1) {
    if (ctx.stop.blocked !== undefined) break;
    await placeSendsBefore(index);
    if (ctx.stop.blocked !== undefined) break;
    // The sites one loop's body calls at are made turn by turn: a turn makes its calls in the order the body does,
    // before any of the next turn's, so their frames are placed in that order and each record falls where the body
    // binds it, by the number of calls it has made. A site the pass resolved no further ends the placement there.
    const loop = loopOf(index);
    let last = index;
    while (loop !== undefined && last + 1 < published.calls.length && loopOf(last + 1) === loop) last += 1;
    const members = Array.from({ length: Math.min(last, sites.length - 1) - index + 1 }, (_unused, at) => index + at);
    for (const member of members) positions[member] = [];
    let stopped = false;
    if (last === index) {
      const site = sites[index];
      if (site !== undefined) await placeTurns(index, site, 0, site.resolved.length);
    } else {
      const lastTurn = Math.max(-1, ...members.flatMap((member) => sites[member]?.callingTurns ?? []));
      for (let turn = 0; turn <= lastTurn && !stopped; turn += 1) {
        for (let member = index; member <= last && !stopped; member += 1) {
          const site = member < sites.length ? sites[member] : undefined;
          if (member >= sites.length) {
            stopped = true;
          } else if (site !== undefined) {
            const at = site.turns.indexOf(turn);
            if (at >= 0) await placeTurns(member, site, at, at + 1);
            else if (site.callingTurns.includes(turn)) stopped = true;
            if (ctx.stop.blocked !== undefined) stopped = true;
          }
        }
      }
    }
    for (const member of members) {
      callsiteIds.push(routing[member]!.callsiteId ?? -1);
      callBases.push(positions[member]![0] ?? -1);
    }
    index = members[members.length - 1]!;
    if (stopped) break;
  }
  // Positions are stated only where a loop interleaves its sites' calls; elsewhere each site's run from its base is.
  const interleaved = positions.some((list) => list.some((at, turn) => turn > 0 && at !== list[turn - 1]! + 1));
  // The sends the body makes after its last site, or in a body that makes no other call.
  if (ctx.stop.blocked === undefined && ownStop === undefined) {
    for (let index = sites.length; index <= Math.max(sites.length, ...valueSends.map((send) => send.callsBefore));
      index += 1) {
      await placeSendsBefore(index);
    }
  }
  if (ctx.stop.blocked === undefined && ownStop !== undefined) ctx.stop.blocked = ownStop;
  return {
    calls, callBases, callsiteIds, truncated: ctx.stop.blocked !== undefined,
    ...(interleaved ? { callPositions: callBases.map((_base, site) => positions[site] ?? []) } : {}),
    ...(placedSends.length === 0 ? {} : { valueSends: placedSends }),
  };
}

/** One send a callee frame's body makes to a contract: the call into the contract's value entry it makes there. */
interface CalleeValueSend {
  readonly transferIndex: number;
  /** The contract's address, as the send's published recipe names it. */
  readonly recipient: Uint8Array;
  readonly amount: bigint;
  /** How many of the entry's calls the body makes before the send (`sendCallsBefore`). */
  readonly callsBefore: number;
  /** The send's `FixedBchTransferAbi.failedCallMessage`, for one its body checks. */
  readonly failedCallMessage?: string;
}

/**
 * The sends a callee frame's body makes to a contract (spec 4b), each the call into the contract's value entry the
 * body makes where it sends: a send its reach's facts decide the body makes, to a recipient its published recipe
 * names, of an amount its source states. A send to a user's lock is a listed send, none of which this plans; a send
 * whose recipient, amount or place the facts leave open is left to the frame's own refusal.
 */
function calleeValueSends(
  caller: HopCallInputs, published: PublishedEntryStopSites | undefined,
): readonly CalleeValueSend[] {
  const abi = caller.artifact.abi.find((candidate) => candidate.name === caller.functionName);
  const transfers = abi?.transfers ?? [];
  if (transfers.length === 0 || caller.senderAddress === undefined || published === undefined) return [];
  const facts = {
    stateValues: caller.stateValues as Readonly<Record<string, StateValue>>,
    ...(caller.readMappingValue === undefined ? {} : { readMappingValue: caller.readMappingValue }),
  };
  const taken = new Set(takenSends({
    artifact: caller.artifact, functionName: caller.functionName, args: caller.args,
    senderAddress: caller.senderAddress, facts,
  }));
  const resolver = makeCallResolver(caller);
  const inputs = (abi?.inputs ?? []).filter((input) => !input.name.startsWith('__internal__'));
  return transfers.flatMap((transfer): CalleeValueSend[] => {
    // A send no branch guards runs whenever the body does; a guarded one runs where the reach's facts decide it does.
    if (transfer.condition !== undefined && !taken.has(transfer.transferIndex)) return [];
    const recipient = sendRecipient(transfer.recipientRecipe, {
      args: caller.args, inputs, structs: caller.artifact.structs, callerLock: caller.senderAddress!,
      state: [caller.stateValues as Record<string, StateValue>],
    });
    if (recipient === undefined || recipient.length === 25) return [];
    const amount = transfer.amount === undefined ? undefined : resolver.resolve(transfer.amount, 0);
    const callsBefore = published.sendCallsBefore?.[transfer.transferIndex];
    if (typeof amount !== 'bigint' || callsBefore === undefined) return [];
    return [{
      transferIndex: transfer.transferIndex, recipient, amount, callsBefore,
      ...(transfer.failedCallMessage === undefined ? {} : { failedCallMessage: transfer.failedCallMessage }),
    }];
  });
}

/** The site index a callee frame's value send to a contract names its callee frame by, past every published site. */
const VALUE_SEND_SITE_BASE = 1 << 16;

/**
 * Places the call a callee frame's send to a contract makes: the frame of the recipient's value entry, entered by the
 * sending frame with no arguments, and the sending frame's call record, carrying the amount. No stop site names the
 * call, so its record is deferred: its callee reference is filled when the draft is built, and the value entry's
 * frame is derived as a request of its own.
 */
async function placeValueSend(
  ctx: PlanContext, caller: HopCallInputs, enteredBy: number | null, path: string, send: CalleeValueSend,
  calls: DraftCall[],
): Promise<void> {
  const where = `the send of ${send.amount} from "${caller.artifact.contractName}.${caller.functionName}" to the `
    + `contract at ${binToHex(send.recipient)}`;
  const external = Object.values(ctx.externals).find((candidate) =>
    bytesEqual(validatorAddress(hexToBin(candidate.categoryId), ctx.validatorProgram), send.recipient))
    ?? externalOfAddress(ctx.provider, send.recipient);
  if (external === undefined) {
    throw new FramedProxyDeployError(`${where} reaches no deployment the call's externals or the provider name`);
  }
  // A per-entry bundle's value entry is its logical contract's, and runs from that entry's own shard. The external
  // that names a split deployment may carry another entry's shard, as the root's does.
  const split = splitOf(ctx, external.categoryId);
  const picked = valueEntryOrRefusal(split?.logical ?? external.artifact, where);
  if ('refusal' in picked) throw new FramedProxyDeployError(picked.refusal);
  const callee = split === undefined ? external : {
    ...external,
    artifact: shardArtifactOf(ctx, split, external.categoryId, {
      selector: requireFunctionSplitShard(split, picked.entry.name).selector, functionName: picked.entry.name,
    }),
  };
  const entry = entryRowOf(callee.artifact, picked.entry.name);
  const reach: CalleeReach = {
    callerPath: path, site: VALUE_SEND_SITE_BASE + send.transferIndex, callsiteId: -1, turns: [0],
  };
  const at = calls.length;
  await placeCalleeMasters(ctx, caller, enteredBy, callee, entry, [{
    kind: FrameKind.CALL, target: send.recipient, argumentValues: [],
    argumentPushes: [valueSendCallData(callee.artifact)],
    ...(send.failedCallMessage === undefined ? {} : { failedCallMessage: send.failedCallMessage }),
  }], calls, where, reach);
  if (calls.length > at) calls[at] = { ...calls[at]!, value: send.amount, deferred: true };
}

/**
 * Folds the state one placed frame leaves into its category's reached state: each write its entry publishes
 * (`AbiFunction.stateWrites`), evaluated over the frame's own inputs. A write those inputs do not state leaves the
 * variable as the reached state held it.
 */
function recordReachedState(
  ctx: PlanContext, categoryId: string, artifact: Artifact, entryName: string, inputs: HopCallInputs,
): void {
  const writes = artifact.abi.find((candidate) => candidate.name === entryName)?.stateWrites ?? [];
  if (writes.length === 0) return;
  const resolver = makeCallResolver(inputs);
  const left: Record<string, unknown> = { ...(ctx.reachedState.get(categoryId) ?? {}) };
  for (const write of writes) {
    const value = resolver.evaluate(write.value, 0);
    if (value !== undefined) left[write.name] = value;
  }
  ctx.reachedState.set(categoryId, left);
}

/** The live deployment a category names, read once however many sites reach it. */
async function deploymentOf(
  ctx: PlanContext, categoryId: string, layout: StateLayout,
): Promise<FramedDeploymentSet> {
  const cached = ctx.deployments.get(categoryId);
  if (cached !== undefined) return cached;
  const read = await readFramedDeployment(ctx.provider, categoryId, layout);
  ctx.deployments.set(categoryId, read);
  return read;
}

/**
 * The live deployment a reach placed now plans its writes against: the category's deployment, and what the reaches
 * placed before it wrote there.
 */
function reachedDeploymentOf(
  ctx: PlanContext, categoryId: string, deployment: FramedDeploymentSet, layout: StateLayout,
): HopLiveDeployment {
  return liveDeploymentOf(categoryId, deployment, layout, ctx.writtenNodes.get(categoryId) ?? [],
    ctx.rewrittenNodes.get(categoryId) ?? [], [...(ctx.reachedLinks.get(categoryId)?.values() ?? [])]);
}

/** The live deployment a frame's own writes are planned against, as `hopEntryWrites` states it. */
export function liveDeploymentOf(
  categoryId: string, deployment: FramedDeploymentSet, layout: StateLayout,
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
        throw new FramedProxyDeployError(
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

/** Labels an imported read uses for the caller, beside the `msgSender` kind a write publishes. */
const CALLER_KEY_LABELS: Readonly<Record<string, string>> = {
  'nullop:msg.sender': 'caller:msg.sender',
  'sender:msg.sender': 'caller:msg.sender',
  'call:_msgSender()': 'caller:msg.sender',
  'nullop:tx.origin': 'caller:tx.origin',
};

/** One key source, as far as the allowance check has to tell two spellings of a key apart. */
interface AccessKeySource {
  readonly kind: string;
  readonly paramName?: string;
  readonly senderOp?: string;
  readonly expressionLabel?: string;
  readonly stateVarName?: string;
  readonly constantValue?: string;
}

/** One entry access, as far as that check reads it. */
interface AccessKey {
  readonly slotIndex?: number;
  readonly collection: string;
  readonly keyParams: readonly string[];
  readonly keySources?: readonly AccessKeySource[];
  readonly operations: readonly string[];
}

/** The key expression an access names, so `msg.sender` matches across the read's label and the write's kind. */
function accessKeyIdentity(access: AccessKey): string {
  return access.keyParams.map((param, index) => {
    const source = access.keySources?.[index];
    if (source?.kind === 'msgSender') return `caller:${source.senderOp ?? 'msg.sender'}`;
    const label = source?.expressionLabel ?? param;
    const caller = CALLER_KEY_LABELS[label];
    if (caller !== undefined) return caller;
    if (source?.kind === 'param' && source.paramName !== undefined) return `param:${source.paramName}`;
    if (source?.kind === 'state' && source.stateVarName !== undefined) return `state:${source.stateVarName}`;
    if (source?.kind === 'constant' && source.constantValue !== undefined) return `const:${source.constantValue}`;
    return source?.expressionLabel ?? param;
  }).join('\0');
}

/**
 * True when `node` reads a key a write of its collection also names.
 *
 * An allowance is that key: the read and the write are one node, and the frame keeps the value the write starts
 * from. A second spelling that only resolves to the node is not.
 */
function readNamesWrittenKey(accesses: readonly AccessKey[] | undefined, node: HopCalleeReadNode): boolean {
  if (accesses === undefined) return true;
  const read = accesses.find((access) => access.slotIndex === node.slotIndex && access.collection === node.collection);
  if (read === undefined) return true;
  const key = accessKeyIdentity(read);
  const sameParams = (access: AccessKey): boolean => access.keyParams.length === read.keyParams.length
    && access.keyParams.every((param, index) => param === read.keyParams[index]);
  return accesses.some((access) => access.collection === node.collection
    && access.slotIndex !== read.slotIndex
    && access.operations.some((operation) => operation !== 'read')
    && (accessKeyIdentity(access) === key || sameParams(access)));
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
 * cannot state is refused by name, naming the callee, rather than left to a frame that cannot settle. A later write of
 * a slot the batch already writes is the exception: it is kept as a skipped target, because a body may take at most
 * one of them, and a run that makes both is refused for it after the run (`calleeRepeatsSlot`). So is a read
 * naming a node the batch also spends under another id or another key, which one transaction cannot spend twice. A
 * read of the same key the write names, an allowance a token reads before it rewrites it, is one input. A dynamic
 * value's run is read only where its write runs, so an entry that writes no batch keeps a plan without the run: a
 * path that skips the write still settles, and one that takes it is refused by the callee's own frame.
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
  selfAddress?: Uint8Array,
  assumedActivations?: ReadonlyMap<number, boolean>,
  producerResults?: ReadonlyMap<number, FunctionArgument>,
  assumesUndecided?: boolean,
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
      ...(selfAddress === undefined ? {} : { selfAddress }),
      ...(assumedActivations === undefined ? {} : { assumedActivations }),
      ...(assumesUndecided === true ? { assumesUndecided: true } : {}),
      // Two writes of one slot, such as two mints whose recipients the frame's facts leave at one address, are kept,
      // the later one as a skipped target, so a body that makes one of them settles (`calleeRepeatsSlot`).
      keepsRepeatedSlots: true,
      // A key the write reads back through one of the frame's own calls is what that call returned, once it answered.
      ...(producerResults === undefined ? {} : { producerResults }),
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
    throw new FramedProxyDeployError(`the callee "${callee}" writes records this hop cannot declare: `
      + `${error instanceof Error ? error.message : String(error)}`);
  }
  // A node the batch spends and the entry also reads, an allowance a token reads before it rewrites it, is one input
  // when both name that key: the read is declared kept ahead of the batch's transition of it. A read that names the
  // same node under another id, or under another key that only resolves to it, would spend it a second time. The
  // frame used to fail an OP_VERIFY on that second spelling instead of naming the node.
  const spentAs = new Map([...writes?.spentUtxos ?? []].map(([id, utxo]) => [`${utxo.txid}:${utxo.vout}`, id]));
  const fn = artifact.abi.find((candidate) => candidate.name === functionName);
  const shared = readNodes.find((node) => {
    const spentId = node.utxo === undefined ? undefined : spentAs.get(`${node.utxo.txid}:${node.utxo.vout}`);
    if (spentId === undefined) return false;
    if (spentId !== node.id) return true;
    return !readNamesWrittenKey(fn?.entryAccesses, node);
  });
  if (shared !== undefined) {
    throw new FramedProxyDeployError(
      `the callee "${callee}" reads mapping "${shared.collection}" at a node its batch also spends, which one `
      + 'transaction cannot spend twice',
    );
  }
  return writes;
}

/**
 * The compute side-cars one callee frame's own body reads, over the provider's live pool, and the block oracle.
 *
 * A body that hashes a runtime value or recovers a signer reads one side-car per call immediately after its own
 * input; the pushes the caller records for the call are what those calls' scalars are read from. A body that reads
 * the clock finds the one oracle input by its lock, so the frame co-spends the oracle after its side-cars unless an
 * earlier frame already does. A frame whose entry publishes none of these reads none, and contributes nothing.
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
  // A recovery call is published either by its argument sources or, when the sources are absent, by its framed
  // flag, so both have to be absent for the frame to read no side-car.
  const hashes = (abiFunction.keccakPreimageParams ?? []).length > 0;
  const recovers = (abiFunction.ecrecoverArgParams ?? []).length > 0
    || (abiFunction.ecrecoverEvmFlags ?? []).length > 0;
  const computed = hashes || recovers ? await entrySideCars({
    provider: ctx.provider, master, abiFunction, argumentPushes, leadingPushes: 1,
    taken: new Set([...ctx.utxos.values()].map((utxo) => `${utxo.txid}:${utxo.vout}`)),
  }) : undefined;
  const oracle = abiFunction.usesBlockOracle === true ? await unplacedBlockOracle(ctx, artifact, entryName) : undefined;
  const sideCars = oracle === undefined ? computed : withBlockOracleSideCar(master, computed, oracle);
  if (sideCars === undefined || sideCars.ids.length === 0) return;
  ctx.sideCars.set(master, sideCars);
  for (const [id, utxo] of Object.entries(sideCars.utxos)) ctx.utxos.set(id, utxo);
}

/** The live block oracle, or undefined when a frame this plan already placed co-spends it. */
async function unplacedBlockOracle(
  ctx: PlanContext, artifact: Artifact, entryName: string,
): Promise<FramedBlockOracle | undefined> {
  const lock = bindProviderBlockOracle(ctx.provider, artifact);
  const oracle = await framedBlockOracle(ctx.provider, lock, entryName, (reason) => new FramedProxyDeployError(reason));
  const placed = [...ctx.utxos.values()].some((utxo) => utxo.txid === oracle.utxo.txid && utxo.vout === oracle.utxo.vout);
  return placed ? undefined : oracle;
}

/**
 * The refusal a callee frame's run meets when it makes both writes of a slot its batch writes twice.
 *
 * The batch keeps the later write as a skipped target, which the write site refuses if the write runs, so a run of
 * the frame refused with no reason of its own made it: the batch is one this hop cannot declare, refused as the
 * planner refuses any other. A frame whose batch names no slot twice has none.
 */
export function calleeRepeatsSlot(callee: HopCallee): FramedProxyDeployError | undefined {
  const slot = callee.entryWrites?.repeatedSlots?.[0];
  if (slot === undefined) return undefined;
  return new FramedProxyDeployError(`the callee "${callee.functionName}" writes records this hop cannot declare: `
    + mappingBatchRepeatsSlot(slot).message);
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
    inputs.categoryId, learnedValue, inputs.selfAddress, inputs.assumedActivations, undefined, inputs.assumesUndecided,
  );
}

/**
 * The mapping nodes one callee frame's entry only reads, in the order its own code reads them.
 *
 * A framed body that touches a sorted mapping does not read one value in place: the mapping is a chain of entry
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
  /** The address the frame presents as `address(this)`, which a key the body reads at its own address names. */
  readonly selfAddress?: Uint8Array;
  readonly categoryId: string;
  readonly deployment: FramedDeploymentSet;
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
    throw new FramedProxyDeployError(
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
        ...(options.selfAddress === undefined ? {} : { selfAddress: options.selfAddress }),
        categoryId: options.categoryId,
        nodesByCollection: options.deployment.nodesByCollection,
        slotIndex: slot.slotIndex!,
        readMappingValue,
      });
    } catch (error) {
      throw new FramedProxyDeployError(
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
          throw new FramedProxyDeployError(
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
  deployment: FramedDeploymentSet,
): readonly HopCalleeRecord[] {
  const cached = ctx.records.get(categoryId);
  if (cached !== undefined) return cached;
  // The root's own category, whichever form its address takes: a CREATE2 child presents its 20-byte identity.
  const ownCategory = categoryId === ctx.rootCategoryId || (ctx.selfAddress !== undefined
    && bytesEqual(validatorAddress(hexToBin(categoryId), ctx.validatorProgram), ctx.selfAddress));
  const records = Array.from({ length: layout.dataNftCount }, (_unused, nftIndex): HopCalleeRecord => {
    const utxo = deployment.records[nftIndex];
    const commitment = utxo?.token?.nft?.commitment;
    if (utxo === undefined || commitment === undefined) {
      throw new FramedProxyDeployError(
        `the callee's category ${categoryId} holds no record at data NFT ${nftIndex}`,
      );
    }
    return {
      // The root already names its own records `record-N`. A same-category callee spends those inputs.
      id: ownCategory ? `record-${nftIndex}` : `${block}-record-${nftIndex}`,
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
  external: FramedProxyExternal,
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
  // The masters claimed before this plan, the root's own on a call back into its deployment, are no reach's: the
  // reaches take the pool's other masters, in slot order.
  const calleeSplit = splitOf(ctx, categoryId);
  const claimed = calleeSplit === undefined ? ctx.takenMasters.get(categoryId) : undefined;
  const pool = claimed === undefined ? deployment.masters
    : deployment.masters.filter((utxo) => !claimed.has(`${utxo.txid}:${utxo.vout}`));
  const base = ctx.masterSlots.get(categoryId) ?? 0;
  const needed = base + resolved.length;
  if (calleeSplit === undefined && pool.length < needed) {
    throw new FramedProxyDeployError(
      `${where} reaches "${contract}", which this hop already places; its category ${categoryId} holds `
      + `${pool.length} master(s) it may take, so it cannot be entered ${needed} time(s)`,
    );
  }
  ctx.masterSlots.set(categoryId, needed);
  const block = deploymentBlockId(ctx.blocks, contract, categoryId);
  const records = calleeRecordSet(ctx, block, categoryId, layout, deployment);
  const deployedState = deploymentStateValues(layout, categoryId, deployment);
  const category = hexToBin(categoryId);
  const nodeIdOf = (collection: string, slot: Uint8Array): string => sharedNodeId(categoryId, collection, slot);
  for (const [position, call] of resolved.entries()) {
    // A stop inside an earlier visit's own calls ends the plan there, so no later visit is placed.
    if (ctx.stop.blocked !== undefined) break;
    // Each visit is planned against what the visits and reaches before it wrote, a loop's earlier turns included.
    const live = reachedDeploymentOf(ctx, categoryId, deployment, layout);
    const stateValues = { ...deployedState, ...(ctx.reachedState.get(categoryId) ?? {}) };
    const readMappingValue = liveMappingValueReader(external.artifact, live, external.artifact.structs);
    // The turn the call runs in names the frame; its place among the site's calls takes the master.
    const occurrence = reach.turns[position] ?? position;
    const calleeIndex = ctx.callees.length;
    const master = `callee-master-${calleeIndex + 1}`;
    const path = calleePath(reach.callerPath, reach.site, occurrence);
    const deployed = deployMaster(external.artifact, category, ctx.validatorProgram);
    let masterUtxo = pool[base + position];
    if (calleeSplit !== undefined) {
      const taken = ctx.takenMasters.get(categoryId) ?? new Set<string>();
      try {
        masterUtxo = masterForEntry({
          masters: deployment.masters,
          filledLock: deployed.lockingBytecode,
          functionName: entry.name,
          taken,
        });
      } catch (error) {
        throw new FramedProxyDeployError((error as Error).message);
      }
      taken.add(`${masterUtxo.txid}:${masterUtxo.vout}`);
      ctx.takenMasters.set(categoryId, taken);
    }
    if (masterUtxo === undefined) {
      throw new FramedProxyDeployError(
        `${where} reaches "${contract}", which this hop already places; its category ${categoryId} holds `
        + `${deployment.masters.length} master(s), so it cannot be entered ${needed} time(s)`,
      );
    }
    // The nodes the entry only reads, from the reach's own call data; they lead any batch's groups.
    const readNodes = calleeReadNodesOrNone({
      artifact: external.artifact, functionName: entry.name, args: call.argumentValues,
      senderAddress: caller.selfAddress, selfAddress: deployed.self, categoryId, deployment, nodeIdOf,
      createdNodes: ctx.writtenNodes.get(categoryId) ?? [], rewrittenNodes: ctx.rewrittenNodes.get(categoryId) ?? [],
    });
    // The frame's own write is planned from the reach's own call data, so two reaches that pass different values
    // write different nodes.
    const writes = calleeEntryWrites(
      external.artifact, entry.name, call.argumentValues, caller.selfAddress, live, readNodes, categoryId,
      ctx.calleeWriteValues?.get(master), deployed.self, ctx.calleeAssumedActivations?.get(master),
      knownResultsOf(ctx, external.artifact, path), ctx.assumesUndecided);
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
      selfAddress: deployed.self,
      records,
      readNodes,
      utxos: new Map<string, Utxo>([[master, masterUtxo]]),
      ...(writes === undefined ? {} : { entryWrites: writes }),
      ...(writes === undefined ? {} : {
        writeInputs: {
          args: call.argumentValues, senderAddress: caller.selfAddress, selfAddress: deployed.self, live, categoryId,
          ...(ctx.calleeAssumedActivations?.get(master) === undefined
            ? {} : { assumedActivations: ctx.calleeAssumedActivations.get(master)! }),
          ...(ctx.assumesUndecided === true ? { assumesUndecided: true } : {}),
        },
      }),
      args: call.argumentValues,
      calls: [],
      callBases: [],
      enteredBy,
      path,
      origin: { callerPath: reach.callerPath, callsiteId: reach.callsiteId, occurrence },
      ...reachSkippedEmits(external.artifact, entry.name, call.argumentValues, caller.selfAddress,
        { stateValues, selfAddress: deployed.self, readMappingValue }),
      ...reachDecidedSends(external.artifact, entry.name, call.argumentValues, caller.selfAddress,
        { stateValues, selfAddress: deployed.self, readMappingValue }),
    };
    // Reserve the slot before planning the callee's own calls, so a frame it reaches names this master as its
    // caller and sits after it.
    ctx.callees.push(frame);
    const nested = await planEntryCalls(ctx, {
      artifact: external.artifact,
      functionName: entry.name,
      args: call.argumentValues,
      stateValues,
      selfAddress: deployed.self,
      categoryId,
      readMappingValue,
      ...(caller.selfAddress === undefined ? {} : { senderAddress: caller.selfAddress }),
    }, calleeIndex, path);
    ctx.callees[calleeIndex] = {
      ...frame, calls: nested.calls, callBases: nested.callBases, ...(nested.truncated ? { truncated: true } : {}),
      ...(nested.callPositions === undefined ? {} : { callPositions: nested.callPositions }),
      ...(nested.valueSends === undefined ? {} : { valueSends: nested.valueSends }),
    };
    recordReachedState(ctx, categoryId, external.artifact, entry.name, {
      artifact: external.artifact, functionName: entry.name, args: call.argumentValues, stateValues,
      selfAddress: deployed.self, readMappingValue,
      ...(caller.selfAddress === undefined ? {} : { senderAddress: caller.selfAddress }),
    });
    ctx.utxos.set(master, masterUtxo);
    calls.push({
      kind: call.kind, callee: master, target: call.target, value: 0n,
      argumentPushes: call.argumentPushes,
      ...(call.failedCallMessage === undefined ? {} : { failedCallMessage: call.failedCallMessage }),
    });
    if (hopTraceOn()) {
      const byTarget = findDeploymentByAddress(ctx.provider, binToHex(call.target))
        ?? findDeploymentByLockingBytecode(ctx.provider, binToHex(call.target));
      hopTrace(`callee ${master} entry=${entry.name} self=${binToHex(deployed.address).slice(0, 12)} `
        + `target=${binToHex(call.target).slice(0, 12)} cat=${categoryId.slice(-12)} `
        + `byTarget=${byTarget?.contractName ?? 'none'} args=[${call.argumentValues.map((value) => (value instanceof Uint8Array
          ? binToHex(value).slice(0, 12) : String(value))).join(',')}]`);
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
  external: FramedProxyExternal,
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
    throw new FramedProxyDeployError(
      `${where} reaches "${proxyContract}", which this hop already places; its category ${external.categoryId} `
      + `holds ${proxyDeployment.masters.length} master(s), so it cannot be entered ${proxyBase + needed} time(s)`,
    );
  }
  if (implementationDeployment.masters.length < implementationBase + needed) {
    throw new FramedProxyDeployError(
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
      senderAddress: caller.selfAddress, selfAddress: proxyDeployed.self, categoryId: external.categoryId,
      deployment: proxyDeployment,
      recordLayout: proxyReadLayout,
      nodeIdOf: (collection, slot) => sharedNodeId(external.categoryId, collection, slot),
      createdNodes: ctx.writtenNodes.get(external.categoryId) ?? [],
      rewrittenNodes: ctx.rewrittenNodes.get(external.categoryId) ?? [],
    });
    // The implementation entry's own write is planned from this reach's call data, against the proxy's deployment.
    const implementationWrites = calleeEntryWrites(
      external.artifact, entry.name, call.argumentValues, caller.selfAddress, live, implementationReads,
      external.categoryId, ctx.calleeWriteValues?.get(implementationMaster), proxyDeployed.address);
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
          args: call.argumentValues, senderAddress: caller.selfAddress, selfAddress: proxyDeployed.address, live,
          categoryId: external.categoryId,
        },
      }),
      args: call.argumentValues,
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
        categoryId: external.categoryId,
        readMappingValue,
        ...(caller.selfAddress === undefined ? {} : { senderAddress: caller.selfAddress }),
      }, implementationIndex, path);
    ctx.callees[implementationIndex] = {
      ...implementationBaseFrame, calls: nested.calls, callBases: nested.callBases,
      ...(nested.callPositions === undefined ? {} : { callPositions: nested.callPositions }),
      ...(nested.truncated ? { truncated: true } : {}),
    };
    ctx.utxos.set(proxyMaster, proxyMasterUtxo);
    ctx.utxos.set(implementationMaster, implementationMasterUtxo);
    calls.push({
      kind: call.kind, callee: proxyMaster, target: call.target, value: 0n,
      argumentPushes: call.argumentPushes,
      ...(call.failedCallMessage === undefined ? {} : { failedCallMessage: call.failedCallMessage }),
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
            throw new FramedProxyDeployError(
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
 * call that leads there (`enclosed-reads.ts`), and for a node the entering frame only reads: the walk keeps the view
 * that frame read in its segments up to the call and the one the frames inside it leave in the segments past it, and
 * those frames settle before it resumes. A helper a split cut out of a body that reads a balance and then burns it is
 * such a pair.
 *
 * A node whose values chunk is chainable in the same way, except that the bytes a later reach continues from are
 * the ones the reach before it wrote: a reach whose chunkable write states no value leaves none, which
 * `requireSettledNodeChains` refuses once every frame has settled, and a relink states none, which is refused here.
 */
function requireChainableNodes(callees: readonly HopCallee[]): void {
  // The first pair one frame of which enters the other is refused once every other node's chain is checked, which
  // refuses by its own name.
  let interleaved: FramedNodeChainError | undefined;
  for (const [id, touches] of nodeTouches(callees)) {
    if (touches.length < 2) continue;
    const collection = touches[0]!.collection;
    for (const [at, outer] of touches.entries()) {
      for (const inner of touches.slice(at + 1)) {
        if (!entersFrame(callees, outer.frame, inner.frame) && !entersFrame(callees, inner.frame, outer.frame)) continue;
        // A read or rewrite of a node a frame it runs inside wrote before entering it chains (`enclosed-reads.ts`).
        if (chainsEnclosedTouch(callees, outer, inner, collection, id)) continue;
        // So does any touch inside a frame that only reads the node.
        if ((entersFrame(callees, outer.frame, inner.frame) ? outer : inner).kind === 'read') continue;
        interleaved ??= new FramedNodeChainError(
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
          throw new FramedProxyDeployError(`${pair} relinks to insert a key; ${CHUNKED_RELINK}`);
        }
        if (touch.kind === 'relink') {
          throw new FramedProxyDeployError(`${pair} writes, and inserts through it; ${CHUNKED_RELINK}`);
        }
      }
      if (touch.kind !== 'read') written = touch;
    }
  }
  if (interleaved !== undefined) throw interleaved;
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
        throw new FramedProxyDeployError(`${pair} relinks to insert a key; ${CHUNKED_RELINK}`);
      }
      if (later.kind === 'relink') {
        throw new FramedProxyDeployError(`${pair} writes, and inserts through it; ${CHUNKED_RELINK}`);
      }
      if (earlier.kind === 'read') continue;
      if (!leavesValueForLaterReach(callees, earlier, id)) {
        throw new FramedProxyDeployError(
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
 * For each callee frame, the frames that write a node it reads or writes before it does, created or spent.
 *
 * A node a frame's body creates is no deployment's, so the frames the plan places after it name it only by its
 * slot: the view and whole chunked value the writer leaves are stated by its own settle, and a later reader or
 * writer continues from them.
 */
export function writtenNodeWritersBefore(callees: readonly HopCallee[]): ReadonlyMap<number, readonly number[]> {
  const before = new Map<number, number[]>();
  const written = new Map<string, number[]>();
  callees.forEach((callee, frame) => {
    const owner = callee.recordOwner === undefined ? callee : callees[callee.recordOwner]!;
    const writtenIds = (callee.entryWrites?.writtenNodes ?? []).map((node) =>
      sharedNodeId(bytesToHex(owner.category), node.collection, node.slot));
    for (const id of new Set([...callee.readNodes.map((node) => node.id), ...writtenIds])) {
      const earlier = before.get(frame) ?? [];
      // A writer the frame runs inside settles after it; the view it left is learned by deriving it up to its call.
      for (const writer of written.get(id) ?? []) {
        if (!earlier.includes(writer) && !entersFrame(callees, writer, frame)) earlier.push(writer);
      }
      before.set(frame, earlier);
    }
    for (const id of writtenIds) {
      const writers = written.get(id) ?? [];
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
  readonly externals: Readonly<Record<string, FramedProxyExternal>>;
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
    readonly deployment: FramedDeploymentSet;
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
   * The arguments runs of the entry's body hashed where it calls, keyed by `hashedArgumentsKey`. A visit whose
   * arguments no published expression states is planned from these; absent or missing one, the plan stops before
   * that visit (`computed`).
   */
  readonly hashedArguments?: ReadonlyMap<string, readonly Uint8Array[]>;
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
  /** Whether each callee frame's undecided guarded writes run, by master and entry-access slot. */
  readonly calleeAssumedActivations?: ReadonlyMap<string, ReadonlyMap<number, boolean>>;
  /** Whether each conditional site no fact of the caller decides is taken, by `undecidedCallKey`. */
  readonly assumedCalls?: ReadonlyMap<string, boolean>;
  /**
   * Told each conditional site no fact of the caller decides (`undecidedGuard`) that the plan meets with no assumption
   * for it, by `undecidedCallKey`, and whether the plan took it, however the plan ends.
   */
  readonly noteUndecidedCall?: (key: string, taken: boolean) => void;
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
  /** The per-entry bundle a call back to `splitCategoryId` spends a shard of. */
  readonly split?: FunctionSplitBundle;
  /** The category `split` belongs to. A call to any other category keeps the callee's own artifact. */
  readonly splitCategoryId?: string;
  /** Outpoints already claimed before this plan, keyed by category. */
  readonly takenMasters?: ReadonlyMap<string, ReadonlySet<string>>;
  /**
   * Plans a callee frame's send to a contract as the call into the contract's value entry the body makes where it
   * sends (spec 4b): a deferred call record carrying the amount, which no stop site names, and the value entry's frame
   * it enters. Absent, such a send is left to the frame's own refusal.
   */
  readonly calleeValueCalls?: boolean;
  /**
   * Plans a call whose target is the root's own address (`selfAddress`) as a call back into the root's deployment: a
   * further master of the root's pool, on the root's records, in the root's block. Absent, such a call is refused by
   * name, as a contract that reaches itself below itself.
   */
  readonly rootReentry?: boolean;
  /**
   * Stops the plan inside a callee frame at a site of its own the planner refuses (`reads: 'refusal'`, the stop
   * carrying the refusal): the frame is placed with the calls before the site, and nothing the execution reaches from
   * it on, so a check of the frame's own that stops it first names its own reason (spec V6). Absent, the refusal is
   * raised, and met at the entry's own site that leads to the frame.
   */
  readonly calleeSiteRefusals?: boolean;
  /**
   * Plans a callee frame's undecided write at a key its list does not hold as skipped, for a caller that plans the
   * frame again with the write assumed run when the frame refuses (`calleeAssumedActivations`). Absent, such a write is
   * refused by name.
   */
  readonly assumesUndecided?: boolean;
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
    reachedState: new Map(),
    records: new Map(),
    writtenNodes: new Map(),
    rewrittenNodes: new Map(),
    reachedLinks: new Map(),
    ...(options.calleeWriteViews === undefined ? {} : { calleeWriteViews: options.calleeWriteViews }),
    ...(options.calleeAssumedActivations === undefined
      ? {} : { calleeAssumedActivations: options.calleeAssumedActivations }),
    ...(options.calleeWriteValues === undefined ? {} : { calleeWriteValues: options.calleeWriteValues }),
    ...(options.assumedCalls === undefined ? {} : { assumedCalls: options.assumedCalls }),
    ...(options.noteUndecidedCall === undefined ? {} : { noteUndecidedCall: options.noteUndecidedCall }),
    callees: [],
    utxos: new Map(),
    sideCars: new Map(options.sideCars ?? []),
    ...(options.externalReturns === undefined || options.externalReturns.size === 0
      ? {} : { producerResults: { artifact: options.artifact, values: options.externalReturns } }),
    reachedResults: options.reachedResults ?? new Map(),
    ...(options.hashedArguments === undefined ? {} : { hashedArguments: options.hashedArguments }),
    stop: {},
    ...(options.stopBefore === undefined ? {} : { stopBefore: options.stopBefore }),
    ...(options.split === undefined ? {} : { split: options.split, splitCategoryId: options.splitCategoryId }),
    ...(options.selfAddress === undefined ? {} : { selfAddress: options.selfAddress }),
    takenMasters: new Map(
      [...(options.takenMasters ?? [])].map(([category, taken]) => [category, new Set(taken)]),
    ),
    ...(options.calleeValueCalls === true ? { calleeValueCalls: true } : {}),
    ...(options.rootReentry === true ? { rootReentry: true } : {}),
    ...(options.entryDeployment === undefined ? {} : { rootCategoryId: options.entryDeployment.categoryId }),
    ...(options.calleeSiteRefusals === true ? { calleeSiteRefusals: true } : {}),
    ...(options.assumesUndecided === true ? { assumesUndecided: true } : {}),
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
    ...(own === undefined ? {} : { categoryId: own.categoryId }),
    ...(options.senderAddress === undefined ? {} : { senderAddress: options.senderAddress }),
    ...(options.constructorArgs === undefined ? {} : { constructorArgs: options.constructorArgs }),
  }, null, '');
  return {
    calls: root.calls,
    callBases: root.callBases,
    ...(root.callPositions === undefined ? {} : { callPositions: root.callPositions }),
    callsiteIds: root.callsiteIds,
    conditionalProducers: conditionalProducerCallsites(options.artifact, options.functionName),
    callees: ctx.callees,
    utxos: ctx.utxos,
    sideCars: ctx.sideCars,
    ...(options.heldContinuations === true ? { heldContinuations: true } : {}),
    ...(ctx.stop.blocked === undefined ? {} : { blocked: ctx.stop.blocked }),
  };
}

/** The key a conditional site the plan cannot decide is assumed under: the frame's path and the site's call index. */
export function undecidedCallKey(path: string, index: number): string {
  return `${path}#${index}`;
}
