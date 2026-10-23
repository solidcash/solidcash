/**
 * Deploying a framed contract behind a proxy, in two transactions, neither of which calls another contract.
 *
 *   1. the implementation's genesis: its category, master pool and validator pool (and the records its own
 *      constructor frame computed);
 *   2. the proxy's genesis: the same pools, and the proxy's records as `initialize` leaves them.
 *
 * `initialize` is the proxy's constructor frame (audit SDKFRAMED-2): a root frame on the proxy's master whose body
 * delegatecalls the implementation, which runs as a `DELEGATE` frame on the proxy's own records, so its `msg.sender`
 * and `address(this)` are the deployer's and the proxy's. It is derived against a probe of the proxy's genesis (its
 * records carrying the implementation's address, every collection empty) beside the implementation's held genesis,
 * and the genesis that is broadcast mints the records, nodes, chunks and events that derivation left. The probe and
 * the derived hop are never broadcast, so no uninitialized proxy state is ever on chain for anyone to take first.
 *
 * The proxy shape is the one the convention compiles: a contract whose only body is a `fallback` that forwards
 * the call data it received to an address it holds in state. Its master reads that address from its record and
 * records a `DELEGATE` call to it; the implementation's master runs the forwarded entry as a delegate frame. Any
 * other shape is refused by name rather than guessing where the implementation's address lives or what a body
 * forwards.
 *
 * The geneses go through the shipped deployment entry point, which selects the framed genesis from the artifact.
 * The derivation is the shipped composer's: the plan names the deployed masters, the proxy's record and validator,
 * and the delegate edge, and the shipped derivation resolves the callee reference and fills the witnesses.
 *
 * An initializer that calls another contract changes state the proxy's genesis cannot mint, so it is refused unless
 * the caller asks for a separate hop (`initializeAs: 'hop'`): the uninitialized proxy genesis, then the derived hop
 * rebuilt on the outpoints the geneses create and signed by the caller's own coin (`callerFunding`). All three are
 * held until the hop is accepted and then broadcast back to back, but until the hop confirms anyone can race it.
 *
 * A later call by anyone is the same hop on the same live pools: `callFramedProxyEntry` names the entry and the
 * caller's coin and runs the identical plan, derivation, evaluation and broadcast. The delegation is one
 * participant graph with two kinds of caller, so an entry a deployment ran and an entry a user calls settle the
 * same way.
 */

import { encodeLockingBytecodeP2sh32 } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { hash256 } from '@bitauth/libauth/build/lib/crypto/combinations.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { OpcodesBch2023 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2023/bch-2023-opcodes.js';
import { createVirtualMachineBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-vm.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import {
  FrameKind, INDEX_NONE, VALUE_INLINE_LIMIT, buildEntryNftCovenantScript, bytesEqual, bytesToHex,
  computeCollectionHash, decodeTranscript, dynamicChunkSignature, frameKindName, getDefaultStateValue,
  mintedRef, sha256,
  validatorRedeemScript,
  type Artifact, type FunctionSplitBundle, type RecordEntry, type StateValue, type StructDefinitionInfo,
} from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { requireFramedFunderSighash } from '../sighash.js';
import {
  encodeFunctionArgument, encodeFunctionArguments, type ConstructorArgument, type FunctionArgument,
} from '../../Argument.js';
import { authheadLockingBytecode } from '../../bcmr/authhead.js';
import type { PublishedRegistry } from '../../bcmr/deployment.js';
import { publicationOutput } from '../../bcmr/publication.js';
import {
  identityRecord, isP2pkhLock, planGenesisIdentity, type GenesisIdentity, type IdentityRecord,
} from '../../bcmr/identity.js';
import type { Output, TransactionDetails, Unlocker, Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { deployStatefulContract } from '../../stateful/sc-deploy.js';
import { registerDeployment } from '../../stateful/deployment-registry.js';
import { decodeEntryCommitment, encodeEntryCommitment, headSentinelCommitment } from '../../stateful/SortedList.js';
import { providerUnixLocktime } from '../../stateful/soft-state-overlays.js';
import type { DeployOptions, DeployResult } from '../../stateful/stateful-lifecycle-types.js';
import {
  addressToLockScript, libauthOutputToSolidCashOutput, libauthTokenDetailsToSolidCashTokenDetails,
  scriptToLockingBytecode,
} from '../../utils.js';
import {
  FramedComposerError, INDEX_NONE_REFERENCE, UNFILLED_CALLEE_REF, createComposedDerivationHost, deriveComposition,
  describeInnermost, facetId, findParticipant, layoutTransaction, participant, reportCompositionRefusal,
  requireLearnedViews, unstatedViewPlaceholder, validatorFacetsOf,
  type CompositionDraft, type CompositionDraftPlan, type ContractBlock, type DraftCall, type DraftInput,
  type DraftMaster, type DraftMintedMaster, type DraftRecordEntry, type DraftSourceOutput, type FrameRequest,
  type RecoverySideCars, type ShippedVmProgram,
} from '../composer/index.js';
import { bumpFramedCounter } from '../composer/counters.js';
import { eventCloseOf, readComputedDeclaration, type DeclarationReading } from '../deploy/declaration.js';
import {
  adjacentRecordOrder, frameDataRecordIndices, loopRecordSpans, namedDataRecordIndices, orderLoopKeyArgs,
} from '../call/entry-records.js';
import { entrySideCars } from '../call/side-cars.js';
import {
  bindProviderBlockOracle, blockOracleClock, entryReadsBlockOracle, framedBlockOracle, withBlockOracleSideCar,
  type FramedBlockOracle,
} from '../call/block-oracle.js';
import {
  FramedLoopTurnsError, entryLoopTurns, publishedLoopEffects, type EntryLoopTurns,
} from '../call/loop-turns.js';
import type { HopCallInputs } from './call-resolution.js';
import { eventLockingBytecode, eventSentinel } from '../deploy/genesis.js';
import { masterForEntry, requireFunctionSplitShard } from '../deploy/entry-pool.js';
import { deployMaster, type DeployedMaster } from '../deploy/material.js';
import { ownCoinRefusal } from '../deploy/own-coin.js';
import {
  classifyFramedDeployment, readFramedDeployment, entryRecordReadUnlock, stateRecordLockingBytecode,
  stateRecordUnlockingBytecode,
} from '../deploy/records.js';
import { decodeReturnValues } from '../read/index.js';
import { FramedProxyDeployError } from './errors.js';
import { hopTrace, hopTraceError, hopTraceOn } from './hop-trace.js';
import { learnedReachedValue } from './reached-values.js';
import { stageBroadcasts } from './staged-broadcasts.js';
import { skippedEmits, type WriteActivationFacts } from './write-activation.js';
import {
  hopEntryWrites, mappingHeadCollection, mappingNodeSlot, sharedNodeId,
  type HopEntryWrites, type LaidHopEntryWrites,
} from './entry-writes.js';
import {
  calleeReadNodesOrNone,
  chainedNodeIds,
  deploymentStateValues,
  liveMappingValueReader,
  planCalleeWrites,
  planHopExternalCalls,
  reachedResultKey,
  requireSatisfiableReachWrites,
  requireSettledNodeChains,
  routingOf,
  sharedNodeWritersBefore,
  writtenNodeWritersBefore,
  type HopCallee,
  type HopCalleeReadNode,
  type HopCalleeRecord,
  type HopExternalPlan,
  type HopPlanBlock,
  type FramedProxyExternal,
} from './external-calls.js';
import { buildProxyArtifact, readLayoutAgreement, type LayoutAgreement } from './generate.js';
import {
  hopContainerId, hopContainerInputs, hopPaying, hopValueOutputs, learnHopSend, madeHopSends, planHopValue,
  unlearnedHopSends, type HopSend, type HopValue,
} from './hop-value.js';
import {
  carriedFromChain, deriveReentryWriters, reentrySettleBefore, subtreeOf, withReentryFrames, type EnclosingRoot,
} from './reentry.js';
import {
  EnclosingValueLearned, enclosingCandidateCount, inlineValueAt, learnEnclosingValues,
} from './enclosed-values.js';
import {
  deferredRefusalMetFirst, dropDeferredBelow, firstDeferredRefusal, stalledCalleeRefusal,
} from './refusal-order.js';
import {
  declareUnstatedCalls, entryMeetsRefusedSite, entrySiteOf, planBeforeRefusedSite, planBeforeSite,
} from './planning-refusal.js';
import {
  EntryWriteValueAwaited, EntryWriteValueLearned, entryWriteValueKey, settledWriteValue,
} from './written-values.js';

/** One contract's deploy inputs, minus what this module derives: the provider and the proxy's record seed. */
export type FramedProxyDeployHalf = Omit<DeployOptions, 'provider' | 'initialState' | 'mintedState'>;

/** The caller's own funding for a hop: the coin the root frame's caller input spends. */
export interface FramedProxyCallerFunding {
  /** A UTXO at `callerLockingBytecode`; a root frame binds `msg.sender` to the lock of the input it names. */
  readonly utxo: Utxo;
  /** The caller's own unlocker over `callerLockingBytecode`, which signs the hop over the real transaction. */
  readonly funder: Unlocker;
  /** Where the caller's leftover satoshis go. Defaults to `callerLockingBytecode`. */
  readonly changeAddress?: string | Uint8Array;
}

type Machine = ReturnType<typeof createVirtualMachineBch2026>;

export interface FramedProxyDeployOptions {
  readonly provider: NetworkProvider;
  readonly implementationArtifact: Artifact;
  /** The implementation's constructor arguments, in parameter order. */
  readonly implementationArgs?: readonly ConstructorArgument[];
  readonly implementationDeploy: FramedProxyDeployHalf;
  /**
   * The proxy to run behind, or absent to generate one from the implementation's own declaration.
   *
   * A generated proxy declares exactly the implementation's record fields plus the fallback that forwards to the
   * `implementation` field, so it agrees with the implementation by construction. A caller that supplies one keeps
   * the same requirement: the two must declare the same records, which is why every supplied proxy's layout is
   * checked against the implementation's.
   */
  readonly proxyArtifact?: Artifact;
  readonly proxyDeploy: FramedProxyDeployHalf;
  /** The entry to call through the proxy, and its arguments in parameter order. */
  readonly initialize: { readonly functionName: string; readonly args?: readonly FunctionArgument[] };
  /** The deployer's own 25-byte P2PKH lock: the root frame's caller, and the `initialize` frame's `msg.sender`. */
  readonly callerLockingBytecode: Uint8Array;
  /**
   * Where `initialize` runs. `'genesis'` (the default) mints the proxy's genesis with the state the derived
   * `initialize` leaves, so the proxy is never on chain uninitialized. `'hop'` broadcasts the uninitialized genesis
   * and then `initialize` as a separate root hop: the one way an initializer that calls another contract runs, at
   * the cost that anyone can initialize the proxy first until the hop confirms (audit SDKFRAMED-2).
   */
  readonly initializeAs?: 'genesis' | 'hop';
  /**
   * The caller's own funding for a separate hop (`initializeAs: 'hop'`), which refuses a deployment without it; the
   * default genesis spends no caller coin and ignores it.
   *
   * The derived hop is rebuilt on the outpoints the two geneses create, the caller input is signed by `funder` over
   * that transaction, and the three transactions are broadcast. The caller's input is the deployer's own (the
   * frame's root caller), so the UTXO must sit at `callerLockingBytecode`, the same lock the witness sender is bound
   * to.
   */
  readonly callerFunding?: FramedProxyCallerFunding;
  /**
   * The contracts the entry's published call sites reach, keyed by the interface the site calls.
   *
   * An entry that makes an external call has that call bound by its own frame, so the hop states the call's record
   * and runs its callee as a frame of its own. A call whose callee is not named here has nowhere to run and is
   * refused by name.
   */
  readonly externals?: Readonly<Record<string, FramedProxyExternal>>;
  /** The machine the initialize transaction is evaluated on. Defaults to the provider's BCH-2026 machine. */
  readonly vm?: Machine;
  /**
   * A hook the hop path calls after both geneses are published and before the hop is applied, so a caller can
   * observe the window an uninitialized proxy would otherwise open (audit SDKFRAMED-2). The proxy's fallback
   * already refuses a stranger there, so a hook that only observes does not re-open it.
   */
  readonly beforeHopBroadcast?: (context: { readonly proxyCategoryId: string }) => void | Promise<void>;
}

/** One deployed contract, with the address its masters and validators sit under. */
export interface FramedProxyHalf {
  readonly contract: DeployResult['contract'];
  readonly categoryId: string;
  /** `addrV(category)`, the address the contract presents, which `Contract.address` does not report framed. */
  readonly address: Uint8Array;
  readonly tx: DeployResult['tx'];
  /** The genesis's identity output, output 0, which holds the category's BCMR authority. */
  readonly identity?: IdentityRecord;
  /** The registry the genesis published, with the URIs its publication offers. */
  readonly registry?: PublishedRegistry;
}

/** The machine's verdict on one participant of the initialize transaction. */
export interface InitializeVerdict {
  readonly id: string;
  readonly index: number;
  readonly accepted: boolean;
  readonly objection?: string;
}

export interface FramedProxyDeployment {
  readonly implementation: FramedProxyHalf;
  readonly proxy: FramedProxyHalf;
  readonly initialize: {
    /** The derived transaction the machine was asked about. */
    readonly transaction: NonNullable<ShippedVmProgram['transaction']>;
    /** The output each input spends, in input order. */
    readonly sourceOutputs: ShippedVmProgram['sourceOutputs'];
    readonly draft: CompositionDraft;
    /** The frames the derivation completed, callee before caller. */
    readonly completed: readonly FrameRequest[];
    /** Every participant's verdict but a leading funding coin's, which the network judges signed, in input order. */
    readonly verdicts: readonly InitializeVerdict[];
    /**
     * True when every convention input (the masters, the validator and the record) was accepted. A refused hop is
     * thrown before anything is broadcast, so a returned deployment always carries `true`.
     */
    readonly accepted: boolean;
    /** The commitment of each record after the entry ran, in data-NFT order: what the entry itself computed. */
    readonly writtenRecordCommitments: readonly Uint8Array[];
    /** The commitment of the record at data NFT 0 after the entry ran, which a one-record proxy has. */
    readonly writtenRecordCommitment: Uint8Array;
    /** The payload of each event output the entry listed, in emit order: what its body computed, empty where skipped. */
    readonly writtenEventCommitments: readonly Uint8Array[];
    /** The bytes the implementation frame recorded in its `retval`: what a returning entry's own body computed. */
    readonly retval: Uint8Array;
    /** The entry's returned values, decoded with the shipped decoder, in declaration order. */
    readonly values: readonly StateValue[];
    /** The first returned value, for the common single-value `initialize`. */
    readonly value: StateValue;
    /**
     * The provider's receipt for the transaction that put the initialized state on chain: the proxy's genesis, which
     * minted the state `transaction` derives (the default), or with `initializeAs: 'hop'` the hop, rebuilt on the
     * outpoints the geneses created and broadcast right after them. `transaction` remains the derived specification.
     */
    readonly broadcast: TransactionDetails;
  };
}

/** The commitment size a deployment assumes when its provider publishes no limit. */
const DEFAULT_MAXIMUM_COMMITMENT_BYTES = 10_000_000;
/** How many times a hop rebuilds its plan from the state it read back, one attempt per record written. */
const MAXIMUM_HOP_ATTEMPTS = 4;
/**
 * The most attempts a hop makes at all.
 *
 * A record that sizes one of the entry's own runs is itself learned in one of the attempts, after which the plan
 * states the run's records, so the per-attempt budget above grows with the plan. The cap only bounds a plan that
 * never hands anything back.
 */
const MAXIMUM_HOP_ATTEMPT_CAP = MAXIMUM_HOP_ATTEMPTS * 16;

const PROXY_MASTER_ID = 'proxy-master';
const CALLER_LOCK_REFUSAL = 'the caller funding unlocker signs for a lock that is not the hop\'s caller lock, so the '
  + 'root frame\'s `msg.sender` binding would not hold';
const IMPLEMENTATION_MASTER_ID = 'implementation-master';
const RECORD_ID = 'proxy-record';
const VALIDATOR_ID = 'validator';
const USER_ID = 'deployer';

/**
 * The participant id of the proxy's data NFT at `nftIndex`, in data-NFT order.
 *
 * A proxy's records are the implementation's fields' records plus, when the implementation declares nothing about
 * its proxy, the record the address it forwards to lives in; each is its own participant of a deployment's draft.
 */
export function proxyRecordParticipantId(nftIndex: number): string {
  return `${RECORD_ID}-${nftIndex}`;
}

/** The data-NFT index a record participant id names, or undefined for an id that names no record. */
function recordIndexOfRecord(id: string): number | undefined {
  const prefix = `${RECORD_ID}-`;
  if (!id.startsWith(prefix)) return undefined;
  const index = Number(id.slice(prefix.length));
  return Number.isInteger(index) && index >= 0 ? index : undefined;
}

/** The selector an artifact publishes for an entry, refusing one it does not publish. */
function selectorOf(artifact: Artifact, functionName: string): Uint8Array {
  const entry = artifact.abi.find((candidate) => candidate.name === functionName);
  if (entry?.selector === undefined) {
    throw new FramedProxyDeployError(
      `contract "${artifact.contractName}" publishes no selector for "${functionName}"`,
    );
  }
  return hexToBin(entry.selector);
}

/** The identity the compiler's stop-site table keys an entry on. */
function entryName(artifact: Artifact, functionName: string): string {
  return `${artifact.contractName}.${functionName}()`;
}

/**
 * The segment the entry's derived record write is declared in, as the artifact publishes it.
 *
 * The write lands in the segment the entry's own source fixes, and the compiler publishes which that is: a fixed
 * count of the external calls the entry makes before the write, or `'last'` when every call precedes it. The stop
 * site table rides on `artifact.composition` outside the frozen placeholder type, so it is read through a widened
 * view of the artifact the way the compiler attaches it. Absent means the entry writes no such record, or writes
 * one whose segment the artifact does not publish, which the hop refuses rather than guessing.
 */
function publishedWriteSegment(artifact: Artifact, functionName: string): number | 'last' | undefined {
  return publishedStopSiteEntry(artifact, functionName)?.writeSegment;
}

/** One write of an entry, as the artifact publishes it: named by exactly one identity, with its segment. */
interface PublishedWrite {
  readonly record?: number;
  readonly collection?: string;
  readonly variable?: string;
  readonly segment: number | 'last';
  /** For a dynamic value's run, true when the frame reads the run in its own segment apart from the batch. */
  readonly apart?: true;
}

/** One entry's published stop sites, in the widened view the compiler attaches the table through. */
interface PublishedStopSiteEntry {
  readonly functionName?: string;
  readonly writeSegment?: number | 'last';
  readonly writeSegments?: readonly PublishedWrite[];
}

/** The stop-site entry the artifact publishes for one entry, if it publishes one. */
function publishedStopSiteEntry(artifact: Artifact, functionName: string): PublishedStopSiteEntry | undefined {
  const entries = (artifact.composition as {
    readonly stopSites?: { readonly entries?: readonly PublishedStopSiteEntry[] };
  } | undefined)?.stopSites?.entries;
  const identity = entryName(artifact, functionName);
  return entries?.find((entry) => entry.functionName === identity);
}

/**
 * The segment each of an entry's own writes declares its records in, as the artifact publishes it per write.
 *
 * A body whose writes do not all land in one segment publishes no single `writeSegment`, but every write still
 * names its own segment here: the record of the entry's own frame by record index, a verified mapping's write by
 * its collection, and the run of chunk records a dynamic value's write occupies by its variable.
 */
function publishedWriteFacts(artifact: Artifact, functionName: string): readonly PublishedWrite[] {
  return publishedStopSiteEntry(artifact, functionName)?.writeSegments ?? [];
}

/** The data records an entry's own body writes, by record index, at every segment the artifact publishes for each. */
function publishedRecordWrites(
  artifact: Artifact,
  functionName: string,
): ReadonlyMap<number, readonly (number | 'last')[]> {
  const records = new Map<number, (number | 'last')[]>();
  for (const write of publishedWriteFacts(artifact, functionName)) {
    if (write.record === undefined) continue;
    const segments = records.get(write.record) ?? [];
    if (!segments.includes(write.segment)) segments.push(write.segment);
    records.set(write.record, segments);
  }
  return records;
}

/** The write one of the hop's laid records belongs to, as the artifact publishes its segment. */
interface LaidWriteIdentity {
  readonly record?: number;
  readonly collection?: string;
  readonly variable?: string;
  /** True for a chunk of a run the entry only reads, which no write fact places. */
  readonly read?: boolean;
}

/**
 * The segments of a frame one of its writes can land in: one for a write the source places, and a run of them for a
 * write a loop's own calls move.
 */
interface SegmentSpan {
  readonly least: number;
  readonly most: number;
}

/** True when every segment of the first span is one of the second's. */
function spansWithin(inner: SegmentSpan, outer: SegmentSpan): boolean {
  return inner.least >= outer.least && inner.most <= outer.most;
}

/** The fact one of the entry's own writes is placed by, or undefined for a write the artifact does not place. */
function publishedWriteFact(
  artifact: Artifact, functionName: string, write: LaidWriteIdentity,
): PublishedWrite | undefined {
  return publishedWriteFacts(artifact, functionName).find((candidate) =>
    candidate.record === write.record && candidate.collection === write.collection
    && candidate.variable === write.variable);
}

/** The segment one of the entry's writes declares its records in, or undefined when the artifact states none. */
function publishedSegmentOfWrite(
  artifact: Artifact,
  functionName: string,
  write: LaidWriteIdentity,
): number | 'last' | undefined {
  // An artifact that publishes one fact for the whole entry states that segment for every write it makes.
  return publishedWriteFact(artifact, functionName, write)?.segment
    ?? publishedWriteSegment(artifact, functionName);
}

/** True when one of a call site's own argument sources walks an element of the given parameter's array. */
function walksArrayParam(sources: readonly unknown[] | undefined, paramIndex: number): boolean {
  const visit = (value: unknown): boolean => {
    if (value === null || typeof value !== 'object') return false;
    const node = value as { readonly kind?: string; readonly paramIndex?: number };
    if (node.kind === 'arrayElement' && node.paramIndex === paramIndex) return true;
    return Object.values(value as Record<string, unknown>).some((child) =>
      (Array.isArray(child) ? child.some(visit) : visit(child)));
  };
  return (sources ?? []).some(visit);
}

/**
 * The segments a write an entry's run-time loop performs can land in, or undefined for a write the loop does not
 * perform and one the entry's own facts place.
 *
 * A loop that reaches a call makes that call once per turn, and the walk that resolves a write's segment reads the
 * calls the run has made so far. A write inside such a loop that the entry's own facts do not place therefore lands
 * among the segments the loop's own calls name rather than in the segment the entry-wide statement names. The calls
 * a loop's body reaches are the published sites that walk the same array the loop itself walks, and the calls
 * before them are the ones the plan places in front of the first such site, so the landing is recognized from the
 * artifact alone rather than guessed at.
 *
 * The range spans each turn's landing: a loop that makes a call per turn writes in as many segments as the turns
 * the plan states, and a turn's own calls decide which of them it takes.
 */
function loopWriteLanding(options: {
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly write: LaidWriteIdentity;
  readonly callBases: readonly number[] | undefined;
  readonly calls: number;
  readonly label: string;
  readonly what: string;
}): SegmentSpan | undefined {
  const bases = options.callBases;
  if (options.write.collection === undefined || bases === undefined) return undefined;
  const row = options.artifact.abi.find((candidate) => candidate.name === options.functionName);
  const loop = (row?.sortedUpsertLoopInfo ?? [])
    .find((entry) => entry.collection === options.write.collection);
  if (loop === undefined) return undefined;
  const param = (row?.inputs ?? []).findIndex((input) => input.name === loop.varyingArrayParam);
  if (param < 0) return undefined;
  const placed = (index: number): number | undefined => {
    const base = bases[index];
    return base === undefined || base < 0 ? undefined : base;
  };
  const routing = routingOf(options.artifact, options.functionName);
  const linked = routing
    .map((call, index) => ({ call, index }))
    .filter(({ call, index }) => call.occurrence === 'loop' && placed(index) !== undefined
      && walksArrayParam(call.argSources, param));
  if (linked.length === 0) return undefined;
  const first = linked[0]!.index;
  const least = placed(first)!;
  const next = routing.findIndex((_call, index) => index > first && placed(index) !== undefined);
  const turns = (next < 0 ? options.calls : placed(next)!) - least;
  return { least, most: Math.min(options.calls, least + turns * linked.length) };
}

/**
 * The segment one of the entry's writes lands in, as an index of the frame's own segments.
 *
 * A frame that makes `k` calls declares `k + 1` segments, and each write lands in the one its own source fixes: the
 * count of calls before it, or the last segment the run opens when the epilogue pins what it wrote. A write the
 * artifact places nowhere beside a call is one the hop cannot declare, and a segment the frame's own count does not
 * hold is a publication the hop does not follow; both are refused by name rather than declared in a guessed
 * segment.
 */
function resolvedWriteSegment(options: {
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly label: string;
  readonly what: string;
  readonly write: LaidWriteIdentity;
  readonly calls: number;
  /** For each published call site of the entry, the position of its first call in the frame, or -1 for none. */
  readonly callBases?: readonly number[];
  /**
   * True for a frame a stopped plan states only the first calls of. Such a frame is never settled on that plan, so a
   * write past its last stated call is declared in its last segment rather than refused.
   */
  readonly truncated?: boolean;
}): SegmentSpan {
  const published = publishedSegmentOfWrite(options.artifact, options.functionName, options.write);
  if (published === undefined) {
    // An entry that makes no call has one segment, so a write inside it can only land there.
    if (options.calls === 0) return { least: 0, most: 0 };
    throw new FramedProxyDeployError(
      `${options.label} ${options.what} beside an external call, and the segment that write lands in is not fixed `
      + 'by the entry\'s own source, so the hop cannot declare it',
    );
  }
  if (published === 'last' && publishedWriteFact(options.artifact, options.functionName, options.write) === undefined) {
    // A write the entry's own facts do not place, performed by a loop that reaches calls of its own, lands in the
    // segments those calls name rather than in the entry-wide last segment: the range is the turns the plan states
    // for the loop's own call sites, and a turn's calls inside it decide which of them that turn takes.
    const landing = loopWriteLanding({
      artifact: options.artifact,
      functionName: options.functionName,
      write: options.write,
      callBases: options.callBases,
      calls: options.calls,
      label: options.label,
      what: options.what,
    });
    if (landing !== undefined) return landing;
  }
  const at = published === 'last' ? options.calls : published;
  if (options.truncated === true && at > options.calls) return { least: options.calls, most: options.calls };
  if (at < 0 || at > options.calls) {
    throw new FramedProxyDeployError(
      `${options.label} publishes segment ${String(at)} for ${options.what}, which the hop's `
      + `${options.calls + 1} segment(s) do not hold`,
    );
  }
  return { least: at, most: at };
}

/**
 * The lock a dynamic value's run of chunk records sits at: the value's own collection covenant.
 *
 * The run's chunks are entry NFTs of the value's collection, so their lock is the value's own — which is what tells
 * the records a dynamic write contributes from the nodes and value chunks a sorted batch's write contributes.
 */
function dynamicRunLock(category: Uint8Array, variable: string, type: string): Uint8Array {
  return scriptToLockingBytecode(
    buildEntryNftCovenantScript(category, computeCollectionHash(dynamicChunkSignature(variable, type))),
    'p2sh32',
  );
}

/** The dynamic values an entry's own writes grow, each with its declared type; none for an entry that writes none. */
function dynamicWriteVariables(
  artifact: Artifact, functionName: string,
): readonly { readonly variable: string; readonly type: string }[] {
  const written = artifact.abi.find((candidate) => candidate.name === functionName)?.dynamicWrites ?? [];
  return written.flatMap((variable) => {
    const declared = artifact.stateLayout?.variables.find((candidate) => candidate.name === variable);
    return declared === undefined ? [] : [{ variable, type: declared.type }];
  });
}

/** One record an entry's own writes contribute, and the write it belongs to. */
interface LaidWriteRecord {
  readonly write: LaidWriteIdentity;
  /** How a refusal names the write. */
  readonly what: string;
  readonly entry: RecordEntry;
}

/**
 * The records an entry's own writes contribute, each with the write it belongs to, in the order the plan lays them.
 *
 * The plan lays the sorted batch's nodes, then the run of chunk records each dynamic value's write occupies, then the
 * value chunks a long mapping value takes, and each write is declared in its own segment. A record names its write
 * by the coordinate it sits at: a batch record is a participant the plan lists under a mapping id, or an output the
 * write places at the collection's own covenant, while a run's chunk is any other participant, or an output a
 * value's own collection covenant locks. Each value's chunks sit at its own covenant, so a chunk names its run by
 * that lock: the one its input spends, or the one its output carries.
 */
function laidWriteRecords(options: {
  readonly laid: LaidHopEntryWrites;
  readonly writes: HopEntryWrites;
  readonly indexOf: (id: string) => number;
  readonly category: Uint8Array;
  readonly createdBase: number;
  /** The dynamic values the writes grow, each with its declared type. */
  readonly dynamicRuns?: readonly { readonly variable: string; readonly type: string }[];
}): readonly LaidWriteRecord[] {
  const { laid, writes } = options;
  const readIds = new Set(writes.readRunIds ?? []);
  const readIndices = new Set([...readIds].map((id) => options.indexOf(id)));
  // The nodes a sorted batch spends, under whatever id the plan names them: the frame's own or a shared one.
  const nodeIds = new Set(writes.reachWrites.flatMap((write) => write.spentIds));
  const runLocks = (options.dynamicRuns ?? []).map((run) => ({
    variable: run.variable, lock: dynamicRunLock(options.category, run.variable, run.type),
  }));
  const runAt = (lock: Uint8Array | undefined): string | undefined =>
    (lock === undefined ? undefined : runLocks.find((run) => bytesEqual(run.lock, lock))?.variable);
  const runIndices = new Map<number, string | undefined>();
  for (const id of writes.participantIds) {
    // The plan lists a sorted batch's nodes and a read run's chunks apart; every other participant belongs to a
    // run a write grows.
    if (!nodeIds.has(id) && !readIds.has(id)) {
      runIndices.set(options.indexOf(id), runAt(laid.inputs[id]?.source.lockingBytecode));
    }
  }
  const batch = { write: { collection: writes.collection } as LaidWriteIdentity, what: 'writes a mapping record' };
  return laid.entries.map((entry): LaidWriteRecord => {
    if (entry.in !== INDEX_NONE && readIndices.has(entry.in)) {
      return { write: { read: true }, what: 'reads a run of chunk records', entry };
    }
    const spent = entry.in !== INDEX_NONE && runIndices.has(entry.in);
    const variable = entry.in !== INDEX_NONE
      ? runIndices.get(entry.in)
      : runAt(laid.trailingOutputs[entry.out - options.createdBase]?.lockingBytecode);
    if (spent && variable === undefined) {
      throw new FramedProxyDeployError(
        'the entry lays a run of chunk records and the artifact publishes no dynamic value for it',
      );
    }
    return variable === undefined
      ? { ...batch, entry } : { write: { variable }, what: 'writes a run of chunk records', entry };
  });
}

/**
 * Places the records an entry's own writes contribute in the segments their writes are declared in.
 *
 * Each record is declared in its own write's segment, in the order the plan lays the plan's records; every record a
 * write spends is kept in the segments on either side of it, at the commitment it was spent with before and at the
 * written one after, so the segments chain into the one transition each write performs. A run its frame reads apart
 * from the batch beside it is the exception: the frame addresses that run in the run's own segments alone, past the
 * records every segment declares ahead of any group, so the run is kept nowhere else and nothing is kept there.
 */
function placeLaidWrites(
  segments: DraftRecordEntry[][],
  placed: readonly PlacedLaidWrite[],
): void {
  const apartRun = runSpanApartFromBatch(placed);
  // Every segment declares the records in the order the plan lays them, whichever of them its span holds: a body
  // reads a record by its position, so a record kept outside its span keeps its place ahead of the ones after it.
  segments.forEach((segment, segmentIndex) => {
    const inApartRun = apartRun !== undefined && segmentIndex >= apartRun.least && segmentIndex <= apartRun.most;
    const declared = new Set<number>();
    for (const { span, entry, write } of placed) {
      if (segmentIndex >= span.least && segmentIndex <= span.most) {
        // A span's segments are the turns a write can land in, and a turn's own calls decide which one it takes,
        // so every record the write states is declared in each of them. A record the transaction spends is written
        // in the span's first turn and kept at what that write left after it: the declarations are read as one
        // chain in the order the frames run, so a later turn naming the record's start again would break it. A
        // record the transaction creates is declared unchanged in each turn and chained by the output afterwards.
        if (segmentIndex === span.least || entry.in === INDEX_NONE) {
          segment.push(entry);
          continue;
        }
        // A record the write consumes with no successor is gone once its first turn has run.
        if (entry.out === INDEX_NONE) continue;
        const written = entry.viewOut ?? entry.viewIn;
        segment.push({ in: entry.in, out: entry.out, viewIn: written, viewOut: written });
        continue;
      }
      // A run read apart from its batch keeps nothing in its own segments and is kept in no other.
      if (inApartRun || (apartRun !== undefined && write.variable !== undefined)) continue;
      if (entry.in === INDEX_NONE || declared.has(entry.in)) continue;
      // A record the write consumes is held kept before its segments and declared nowhere after them.
      if (entry.out === INDEX_NONE && segmentIndex > span.most) continue;
      declared.add(entry.in);
      segment.push(segmentIndex < span.least
        ? { in: entry.in, out: entry.in, viewIn: entry.viewIn, viewOut: entry.viewIn }
        : { in: entry.in, out: entry.in, viewIn: entry.viewOut, viewOut: entry.viewOut });
    }
  });
}

/**
 * The segment each of an entry's laid records is declared in, in the order the plan lays them.
 *
 * A write's segments are resolved once and its records all take them, so the records reach the segments in the
 * order the plan declares them and a write the artifact places nowhere is refused once rather than per record. A
 * batch and the run of chunk records a dynamic write grows have to share the segments they land in: a frame reads
 * the run past the records its own block declares, and the records a segment declares in front of the run are the
 * position that read resolves against, so a batch whose records land elsewhere leaves the run where the frame's own
 * close refuses it. The exception is a frame the artifact publishes as reading the run apart (`servesApart`): it
 * addresses the run in the run's own segment, ahead of any group, so the two may land in different segments. A run
 * the entry only reads is kept unchanged, so it takes the segments of the write it sits among, which keeps it at
 * its place in every segment, or the first when the entry writes nothing beside it.
 */
function resolveLaidWriteSegments(
  records: readonly LaidWriteRecord[],
  segmentOfWrite: (write: LaidWriteIdentity, what: string) => SegmentSpan,
  label: string,
  servesApart = false,
  /** For a run of loops whose turns the artifact publishes, the span of each of its records, in laid order. */
  loopSpans?: readonly SegmentSpan[],
): readonly PlacedLaidWrite[] {
  const spans = new Map<string, SegmentSpan>();
  const spanOf = ({ write, what }: LaidWriteRecord): SegmentSpan => {
    const key = `${String(write.record)}|${String(write.collection)}|${String(write.variable)}`;
    let span = spans.get(key);
    if (span === undefined) {
      span = segmentOfWrite(write, what);
      spans.set(key, span);
    }
    return span;
  };
  let loopRecord = 0;
  const writeSpans = records.map((record) => {
    if (record.write.read === true) return undefined;
    if (loopSpans !== undefined && record.write.collection !== undefined) return loopSpans[loopRecord++]!;
    return spanOf(record);
  });
  const readSpan = writeSpans.find((span) => span !== undefined) ?? { least: 0, most: 0 };
  const placed = records.map((record, index) => ({
    span: writeSpans[index] ?? readSpan,
    entry: record.entry,
    write: record.write,
  }));
  const batchAt = records.findIndex(({ write }) => write.collection !== undefined);
  const runAt = records.findIndex(({ write }) => write.variable !== undefined);
  // A frame reads the run of chunk records a dynamic write grows past the records the segment declares, so the run
  // has to land inside the segments the batch beside it lands in: a batch whose records another segment holds
  // leaves the run where the frame's own close refuses it, unless the artifact publishes the frame reads it apart.
  if (batchAt >= 0 && runAt >= 0 && !servesApart && !spansWithin(placed[runAt]!.span, placed[batchAt]!.span)) {
    throw new FramedProxyDeployError(
      `${label} declares its mapping's records in segment ${placed[batchAt]!.span.least} and the run of chunk `
      + `records its dynamic write grows in segment ${placed[runAt]!.span.least}, and a frame reads the run past `
      + 'the records its own block declares, so a batch whose records another segment holds leaves the run unreadable',
    );
  }
  return placed;
}

/** One of an entry's laid records, the write it belongs to, and the segments that write lands in. */
export interface PlacedLaidWrite {
  readonly span: SegmentSpan;
  readonly entry: RecordEntry;
  readonly write: LaidWriteIdentity;
}

/** The segments the run a dynamic write grows lands in, when they lie outside those of the batch beside it. */
function runSpanApartFromBatch(placed: readonly PlacedLaidWrite[]): SegmentSpan | undefined {
  const batch = placed.find(({ write }) => write.collection !== undefined);
  const run = placed.find(({ write }) => write.variable !== undefined);
  return batch !== undefined && run !== undefined && !spansWithin(run.span, batch.span) ? run.span : undefined;
}

/** True when the artifact publishes that the entry's frame reads its dynamic value's run apart from its batch. */
function readsRunApart(artifact: Artifact, functionName: string): boolean {
  return dynamicWriteVariables(artifact, functionName)
    .some(({ variable }) => publishedWriteFact(artifact, functionName, { variable })?.apart === true);
}

/**
 * The span of each record a run of loops writes, from the turns the artifact publishes and the frame's own calls,
 * or undefined for an entry no such run writes. A stopped plan that does not reach the loop's calls yet declares
 * its records in the frame's last segment, as it does a write past the last call it states.
 */
function hopLoopSpans(options: {
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly writes: HopEntryWrites;
  readonly calls: number;
  readonly label: string;
  readonly callBases?: readonly number[];
  readonly truncated?: boolean;
}): readonly SegmentSpan[] | undefined {
  const { loopRun, loopMints } = options.writes;
  if (loopRun === undefined || loopMints === undefined) return undefined;
  const spans = loopRecordSpans({
    artifact: options.artifact, functionName: options.functionName, run: loopRun, mints: loopMints,
    callBases: options.callBases ?? [], calls: options.calls,
  });
  if (typeof spans !== 'string') return spans;
  if (options.truncated === true) return loopMints.map(() => ({ least: options.calls, most: options.calls }));
  throw new FramedProxyDeployError(`${options.label} cannot declare its loop's records: ${spans}`);
}

/** What one frame's own laid writes are declared in its segments from. */
export interface OwnWritesPlacement {
  readonly artifact: Artifact;
  readonly functionName: string;
  /** How a refusal names the frame's entry. */
  readonly label: string;
  readonly laid: LaidHopEntryWrites;
  readonly writes: HopEntryWrites;
  /** The input index of a participant id the layout placed. */
  readonly indexOf: (id: string) => number;
  readonly category: Uint8Array;
  /** The first trailing output the writes create a record at. */
  readonly createdBase: number;
  /** The calls the frame makes, each closing one of its segments. */
  readonly calls: number;
  /** For each published call site of the entry, the position of its first call in the frame, or -1 for none. */
  readonly callBases?: readonly number[];
  /** True for a frame a stopped plan states only the first calls of. */
  readonly truncated?: boolean;
}

/**
 * Declares a frame's own writes in the segments they land in, after what each segment declares already, and answers
 * each laid record with the segments its write lands in: the segment the artifact publishes for the write
 * (`resolvedWriteSegment`), or a loop's turns for a run of loops (`hopLoopSpans`), with every record a write spends
 * kept on either side (`placeLaidWrites`). The hop places its delegate frame's writes so, and the plain call path its
 * root's.
 */
export function placeOwnWrites(
  segments: DraftRecordEntry[][], options: OwnWritesPlacement,
): readonly PlacedLaidWrite[] {
  const { artifact, functionName, label, writes, calls } = options;
  const bounds = {
    ...(options.callBases === undefined ? {} : { callBases: options.callBases }),
    ...(options.truncated === true ? { truncated: true } : {}),
  };
  const placed = resolveLaidWriteSegments(
    laidWriteRecords({
      laid: options.laid,
      writes,
      indexOf: options.indexOf,
      category: options.category,
      createdBase: options.createdBase,
      dynamicRuns: dynamicWriteVariables(artifact, functionName),
    }),
    (write, what) => resolvedWriteSegment({ artifact, functionName, label, what, write, calls, ...bounds }),
    label,
    readsRunApart(artifact, functionName),
    hopLoopSpans({ artifact, functionName, writes, calls, label, ...bounds }),
  );
  placeLaidWrites(segments, placed);
  return placed;
}

/**
 * The candidate a hop's implementation frame carries for its `retval` before the entry's own return is known.
 *
 * An entry that returns a value compares the blob its own `return` built against the frame's `retval` slot, so the
 * slot has to hold something for the run to reach that comparison. Domain-separating it by the implementation and
 * the entry keeps it a value the body never produces and distinct from every record and event candidate the same
 * plan carries, which is what lets the failing close name the answer.
 */
function hopRetvalPlaceholder(contract: string, functionName: string): Uint8Array {
  return sha256(new TextEncoder().encode(`framed hop retval\u0000${contract}\u0000${functionName}`));
}

/** The struct definitions a hop decodes an implementation entry's returned values against. */
function structDefinitionsOf(artifact: Artifact): readonly StructDefinitionInfo[] | undefined {
  return artifact.stateLayout?.structs ?? artifact.structs;
}

/**
 * Refuses a hop whose entry the compiler did not emit, naming the entry and the shape that refused it.
 *
 * A body a framed master cannot serve is emitted as a body that fails whenever the dispatcher reaches it, so a
 * frame that runs one stops on that stub and the hop would report the opcode rather than the shape. The artifact
 * publishes the reason beside the stop sites, keyed by the same identity, which is what a caller reads instead.
 *
 * The refused entry is the one the hop names, or the proxy's fallback the hop is entered on. A refusal here is an
 * answer about the artifact, so it is raised before either genesis is deployed rather than after the hop fails.
 */
function requireServedEntry(artifact: Artifact, functionName: string, role: string): void {
  const identity = entryName(artifact, functionName);
  const listed = (artifact.composition as {
    readonly refusedEntries?: readonly { readonly functionName: string; readonly reason: string }[];
  } | undefined)?.refusedEntries ?? [];
  const reason = listed.find((entry) => entry.functionName === identity)?.reason;
  if (reason !== undefined) {
    throw new FramedProxyDeployError(`${role} is refused by the compiler (${identity}): ${reason}`);
  }
}

/** How a hop names the entry it runs, e.g. `"initialize" entry`. */
function entryLabelFor(functionName: string): string {
  return `"${functionName}" entry`;
}

/**
 * Refuses a proxy that is not the served shape: an `address implementation` field and a fallback body.
 *
 * The proxy's records are the implementation's records, so the proxy declares the implementation's fields beside
 * its own; that the two agree is checked when the pair is handed to a deployment. What is checked here is the part
 * only the proxy can answer: that it holds the address the fallback forwards to, and that a user's call reaches
 * the fallback.
 */
function requireProxyShape(proxyArtifact: Artifact): void {
  if (proxyArtifact.stateLayout === undefined) {
    throw new FramedProxyDeployError(`proxy "${proxyArtifact.contractName}" is not a stateful contract`);
  }
  const layout = proxyArtifact.stateLayout;
  const field = (layout.variables ?? []).find((candidate) => candidate.name === 'implementation');
  if (field === undefined || field.type !== 'address') {
    throw new FramedProxyDeployError(
      `proxy "${proxyArtifact.contractName}" declares no address field named "implementation", so there is `
      + 'nothing for its fallback to forward the call data it received to',
    );
  }
  if (!proxyArtifact.abi.some((entry) => entry.name === '__fallback')) {
    throw new FramedProxyDeployError(
      `proxy "${proxyArtifact.contractName}" has no fallback, so it cannot forward the call data it received`,
    );
  }
}

/**
 * Requires the implementation and the proxy to agree on their record fields, and returns the agreement.
 *
 * A frame's write rebuilds its contract's whole record commitment from the fields that contract declares, so a
 * record the implementation and the proxy do not agree on loses whichever fields only one of them knows. The
 * implementation's fields therefore have to appear in the proxy at the same coordinates; beside them the proxy may
 * keep one record of its own — the address its fallback forwards to — which no implementation frame rewrites. A
 * mismatch is refused here rather than discovered as a state a deployment can no longer call.
 */
function requireSharedLayout(implementationArtifact: Artifact, proxyArtifact: Artifact): LayoutAgreement {
  const agreement = readLayoutAgreement(implementationArtifact, proxyArtifact);
  if (!agreement.ok) throw new FramedProxyDeployError(agreement.reason);
  return agreement;
}

/** Why a learning attempt could not read the state the entry computed. */
function describeReading(
  reading: ReturnType<typeof readComputedDeclaration>,
  written: Uint8Array,
): string {
  if (reading.ok) {
    return `the entry closed against ${bytesToHexText(reading.declared)} rather than the record's `
      + `${bytesToHexText(written)}`;
  }
  switch (reading.reason) {
    case 'no-trace':
      return `its frame failed without a traceable comparison (${String(reading.error)})`;
    case 'not-a-close':
      return `its frame stopped at opcode ${String(reading.opcode)} rather than a record close `
        + `(${String(reading.error)})`;
    case 'no-operands':
      return 'its frame stopped on a comparison with no declared view';
    default:
      return `it computed a ${String(reading.length)}-byte value, which is not a record commitment`;
  }
}

/** Bytes as lowercase hex, for a message. */
function bytesToHexText(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A call's argument pushes: the selector first, then the values with the first parameter's push last. */
function callPushes(
  artifact: Artifact, functionName: string, args: readonly FunctionArgument[],
): readonly Uint8Array[] {
  const abi = artifact.abi.find((candidate) => candidate.name === functionName);
  if (abi === undefined) {
    throw new FramedProxyDeployError(
      `implementation "${artifact.contractName}" publishes no entry "${functionName}"`,
    );
  }
  const visible = abi.inputs.filter((input) => !input.name.startsWith('__internal__'));
  const encoded = encodeFunctionArguments(
    abi, [...args], encodeFunctionArgument, artifact.structs,
  ) as Uint8Array[];
  if (encoded.length !== visible.length) {
    throw new FramedProxyDeployError(
      `"${functionName}" takes ${visible.length} argument(s), but ${encoded.length} were supplied`,
    );
  }
  return [selectorOf(artifact, functionName), ...[...encoded].reverse()];
}

/**
 * The compute side-cars the implementation's own entry reads, from its own argument pushes over the live pool.
 *
 * The implementation's frame is the one the hop enters through the proxy on, so its hashing and recovery calls read
 * side-cars placed immediately after its master's input; the key is that master. An entry that reads neither reads
 * none, and the hop lays out as before.
 */
async function implementationFrameSideCars(
  provider: NetworkProvider, artifact: Artifact, functionName: string, args: readonly FunctionArgument[],
  loopHashes?: number,
): Promise<ReadonlyMap<string, RecoverySideCars>> {
  const abiFunction = artifact.abi.find((candidate) => candidate.name === functionName);
  if (abiFunction === undefined) return new Map();
  // A recovery call is published either by its argument sources or, when the sources are absent, by its framed
  // flag, so both have to be absent for the entry to read no side-car.
  const hashes = (abiFunction.keccakPreimageParams ?? []).length > 0;
  const recovers = (abiFunction.ecrecoverArgParams ?? []).length > 0
    || (abiFunction.ecrecoverEvmFlags ?? []).length > 0;
  if (!hashes && !recovers) return new Map();
  const frame = await entrySideCars({
    provider, master: IMPLEMENTATION_MASTER_ID, abiFunction,
    argumentPushes: callPushes(artifact, functionName, args), leadingPushes: 1,
    ...(loopHashes === undefined ? {} : { hashes: loopHashes }),
  });
  return frame.ids.length === 0 ? new Map() : new Map([[IMPLEMENTATION_MASTER_ID, frame]]);
}

/** The block oracle the implementation's entry co-spends, or undefined for an entry that reads none. */
async function hopBlockOracle(
  provider: NetworkProvider, lock: Uint8Array | undefined, artifact: Artifact, functionName: string,
): Promise<FramedBlockOracle | undefined> {
  if (!entryReadsBlockOracle(artifact, functionName)) return undefined;
  return framedBlockOracle(provider, lock, functionName, (reason) => new FramedProxyDeployError(reason));
}

/**
 * The implementation master's side-cars with the block oracle after them, where a direct call places it: the
 * plan lays it out and spends it as one, and every frame's body finds it by its lock.
 */
function withBlockOracle(
  sideCars: ReadonlyMap<string, RecoverySideCars>, oracle: FramedBlockOracle | undefined,
): ReadonlyMap<string, RecoverySideCars> {
  if (oracle === undefined) return sideCars;
  return new Map<string, RecoverySideCars>([...sideCars, [IMPLEMENTATION_MASTER_ID,
    withBlockOracleSideCar(IMPLEMENTATION_MASTER_ID, sideCars.get(IMPLEMENTATION_MASTER_ID), oracle)]]);
}

/** The entry facts the composer's admission rules read for one execution. */
function factsOf(
  artifact: Artifact, functionName: string, kind: number, makesExternalCall: boolean,
): DraftMaster['facts'] {
  return {
    contract: artifact.contractName,
    functionName: entryName(artifact, functionName),
    kind,
    callerIsUser: kind === FrameKind.ROOT,
    originEqualsCaller: kind === FrameKind.ROOT,
    makesExternalCall,
    mastersOfContract: 1,
  };
}

/** A minting NFT of a category, as the composer models a master source. */
function masterSource(lockingBytecode: Uint8Array, category: Uint8Array, amount: bigint): DraftSourceOutput {
  return {
    lockingBytecode, valueSatoshis: amount,
    token: { category, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
  };
}

/** A mutable NFT of a category, as the composer models a record or validator source. */
function mutableSource(
  lockingBytecode: Uint8Array, amount: bigint, category: Uint8Array, commitment: Uint8Array,
): DraftSourceOutput {
  return {
    lockingBytecode, valueSatoshis: amount,
    token: { category, amount: 0n, nft: { capability: 'mutable', commitment } },
  };
}

/** A root caller's unlocking: a filler signature ending in `SIGHASH_ALL`, then a filler pubkey. */
function callerUnlocking(): Uint8Array {
  const signature = new Uint8Array(65).fill(0x30);
  signature[64] = 0x41;
  return new Uint8Array([
    ...encodeDataPush(signature), ...encodeDataPush(new Uint8Array(33).fill(0x02)),
  ]);
}

/**
 * Deploys an implementation and a proxy behind it, then runs `initialize` through the proxy.
 *
 * The proxy is the caller's, or generated from the implementation's declaration when none is given: either way it
 * declares the implementation's record fields, and the two layouts are checked to agree. The proxy's record is
 * seeded with the implementation's address — `addrV(implementationCategory)`, not whatever `Contract.address`
 * reports for a placeholder program — so the proxy's fallback delegates to the master the implementation actually
 * runs on.
 *
 * The deployment commits fully or broadcasts nothing: every refusal, static or from the hop's own evaluation, is
 * raised while the three transactions are only held, and they are broadcast back to back after the hop is accepted.
 */
export async function deployFramedProxy(
  options: FramedProxyDeployOptions,
): Promise<FramedProxyDeployment> {
  const { implementationArtifact } = options;
  const separateHop = options.initializeAs === 'hop';
  const proxyArtifact = options.proxyArtifact ?? buildProxyArtifact(
    implementationArtifact, separateHop ? options.callerLockingBytecode : undefined,
  );
  requireProxyShape(proxyArtifact);
  requireSharedLayout(implementationArtifact, proxyArtifact);
  requireServedEntry(implementationArtifact, options.initialize.functionName,
    `the implementation's ${entryLabelFor(options.initialize.functionName)}`);
  requireServedEntry(proxyArtifact, '__fallback', "the proxy's fallback");
  if (options.callerLockingBytecode.length !== 25) {
    throw new FramedProxyDeployError(
      `a root frame's caller is a 25-byte P2PKH lock; got ${options.callerLockingBytecode.length} bytes`,
    );
  }
  for (const half of [options.implementationDeploy, options.proxyDeploy]) {
    if (half.fundingUtxo.vout !== 0) {
      throw new FramedProxyDeployError('each genesis funding UTXO must be at vout 0 to create a token category');
    }
  }
  // A separate hop is what initializes the proxy then, so one that cannot be broadcast is refused (SDKFRAMED-2).
  const { callerFunding } = options;
  if (separateHop && callerFunding === undefined) {
    throw new FramedProxyDeployError(
      'a framed proxy initialized by a separate hop needs `callerFunding`: without the caller\'s own coin the hop '
      + 'cannot be broadcast, and the geneses alone would leave the proxy uninitialized for anyone to initialize first',
    );
  }
  // The hop's caller signs as every framed funder does.
  if (separateHop) requireFramedFunderSighash(callerFunding!.funder);
  // A refusal knowable now is raised before anything is signed.
  const upFrontRefusal = await deployFundingRefusal(options, separateHop ? callerFunding : undefined);
  if (upFrontRefusal !== undefined) throw new FramedProxyDeployError(upFrontRefusal);
  // Every transaction below is signed through the overlay, which holds it and serves its outputs to the reads after
  // it, so a refusal anywhere before the release broadcasts nothing. By default the derivation reads through an inner
  // overlay that also holds the probe proxy genesis, and is never released.
  const staging = stageBroadcasts(options.provider);
  const { provider } = separateHop ? staging : stageBroadcasts(staging.provider);

  const validatorProgram = framedValidator.buildValidatorProgram();
  const implementationCategory = hexToBin(options.implementationDeploy.fundingUtxo.txid);
  const proxyCategory = hexToBin(options.proxyDeploy.fundingUtxo.txid);
  // The implementation's masters pin the oracle lock its later calls co-spend.
  const oracleLock = bindProviderBlockOracle(options.provider, implementationArtifact);
  const implementationMaster = deployMaster(implementationArtifact, implementationCategory, validatorProgram);
  const proxyMaster = deployMaster(proxyArtifact, proxyCategory, validatorProgram);

  // The records the entry's own body writes (mapping nodes today) are planned against the entry's published
  // accesses and their stated values, so their commitments are declared outright rather than learned. A first
  // insert splices through the empty head the proxy's genesis mints.
  // A run-time loop's key array is handed to the frame in the order the emitted body walks it, so the plan's
  // per-turn nodes are the ones the body reaches; the caller's call data carries that same array.
  const initializeArgs = orderLoopKeyArgs({
    artifact: implementationArtifact,
    functionName: options.initialize.functionName,
    args: options.initialize.args ?? [],
    callerLockingBytecode: options.callerLockingBytecode,
  });
  // A write or an emit a branch guards is decided against the state the proxy's genesis mints: every field at its
  // default but the implementation's address, and every collection empty.
  const initializeFacts: WriteActivationFacts = {
    stateValues: {
      ...Object.fromEntries((implementationArtifact.stateLayout?.variables ?? []).map((variable) => [
        variable.name, getDefaultStateValue(variable.type, implementationArtifact.stateLayout?.structs),
      ])),
      implementation: implementationMaster.address,
    },
    selfAddress: proxyMaster.address,
    readMappingValue: liveMappingValueReader(implementationArtifact, {
      category: proxyCategory, recordCommitments: [], chunks: [], nodesByCollection: new Map(),
    }, implementationArtifact.structs),
  };
  const entryWrites = hopEntryWrites({
    artifact: implementationArtifact,
    functionName: options.initialize.functionName,
    ...(initializeArgs.length === 0 ? {} : { args: initializeArgs }),
    callerLockingBytecode: options.callerLockingBytecode,
    activationFacts: initializeFacts,
  });
  const skippedInitializeEmits = skippedEmits({
    artifact: implementationArtifact, functionName: options.initialize.functionName, args: initializeArgs,
    senderAddress: options.callerLockingBytecode, facts: initializeFacts,
  });
  // A head is minted only at genesis and a call never creates one. A delegate frame writes the proxy's records, so
  // the proxy's genesis mints the empty head of every sorted collection the implementation declares, whether or not
  // `initialize` writes it.
  const headCollections = (implementationArtifact.stateLayout?.collections ?? [])
    .filter((collection) => collection.sorted === true)
    .map((collection) => ({ name: collection.name, signature: collection.signature }));

  // 1. The implementation's genesis and pools, signed and held until the derivation is accepted.
  const implementation = await deployStatefulContract(
    implementationArtifact, [...(options.implementationArgs ?? [])],
    { ...options.implementationDeploy, provider: staging.provider },
  );

  // 2. The proxy's uninitialized genesis, its one record carrying the implementation's address, and the empty head
  // of every sorted collection the implementation declares: the probe the derivation runs on, or with a separate hop
  // the genesis itself.
  const proxy = await deployStatefulContract(proxyArtifact, [], {
    ...options.proxyDeploy,
    provider,
    initialState: { implementation: implementationMaster.address },
    ...(headCollections.length === 0 ? {} : { headCollections }),
  });

  // The genesis published the facet pool, so the hop spends a facet from the outpoint the genesis actually created
  // rather than searching the provider for it: a facet holds no token and pins no category, so any UTXO of its code
  // serves.
  const facetSpends = new Map<string, Utxo>();
  const facetLocks = framedValidator.buildValidatorFacets()
    .map((code) => binToHex(encodeLockingBytecodeP2sh32(hash256(code))));
  for (const [at, lock] of facetLocks.entries()) {
    for (const genesis of [implementation.tx, proxy.tx]) {
      const vout = (genesis.outputs ?? []).findIndex((output) => binToHex(output.lockingBytecode) === lock);
      if (vout !== -1) {
        facetSpends.set(facetId(VALIDATOR_ID, at + 1), {
          txid: genesis.txid, vout, satoshis: (genesis.outputs ?? [])[vout]!.valueSatoshis,
        });
        break;
      }
    }
  }

  // The proxy's records are its held genesis's own outputs, not whatever a provider lists for the category.
  const layout = proxyArtifact.stateLayout!;
  const deployment = classifyFramedDeployment(categoryUtxosOf(proxy.tx, proxy.categoryId), layout);
  if (deployment.records.length !== layout.dataNftCount) {
    throw new FramedProxyDeployError(
      `the proxy's genesis published ${deployment.records.length} record(s) for category ${proxy.categoryId}, but `
      + `its layout declares ${layout.dataNftCount} data NFT(s)`,
    );
  }
  const recordCommitments = deployment.records.map((record, nftIndex) => {
    const commitment = record.token?.nft?.commitment;
    if (commitment === undefined) {
      throw new FramedProxyDeployError(
        `the proxy's genesis published no commitment for the record at data NFT ${nftIndex} of category `
        + proxy.categoryId,
      );
    }
    return hexToBin(commitment);
  });

  const vm = options.vm ?? await providerMachine(options.provider);
  const maximumCommitmentBytes = provider.consensusLimits?.maximumNftCommitmentBytes
    ?? DEFAULT_MAXIMUM_COMMITMENT_BYTES;
  const recordLockingBytecode = stateRecordLockingBytecode(options.proxyDeploy.fundingUtxo.txid);
  const recordAmount = options.proxyDeploy.dataNftAmount ?? 1200n;
  // The `initialize` entry's own answer, when it returns one: the plan states the candidate its return comparison
  // fails against and the derivation learns the bytes its body computed, exactly as a later call does.
  const initializeEntry = implementationArtifact.abi.find(
    (candidate) => candidate.name === options.initialize.functionName,
  );
  const retvalPlaceholder = (initializeEntry?.outputs ?? []).length > 0
    ? hopRetvalPlaceholder(implementationArtifact.contractName, options.initialize.functionName)
    : undefined;
  // The events and hashes the entry's loops repeat, counted against the same facts its calls are resolved from.
  const loopTurns = implementationLoopTurns({
    artifact: implementationArtifact, functionName: options.initialize.functionName, args: initializeArgs,
    stateValues: deploymentStateValues(proxyArtifact.stateLayout!, proxy.categoryId, deployment),
    selfAddress: proxyMaster.address, senderAddress: options.callerLockingBytecode,
  });
  // A deployment's hop carries no value, and the proxy it just minted holds no container to pay a send from.
  if ((loopTurns.sends ?? 0) > 0) {
    throw new FramedProxyDeployError(
      `the implementation's ${entryLabelFor(options.initialize.functionName)} sends value from a loop, and the hop `
      + 'lists no send for the implementation\'s frame',
    );
  }
  // A calling genesis leads with the proxy's authhead, owned as every framed genesis's identity is (stateful.ts).
  const proxyFunderLock = options.proxyDeploy.funder.generateLockingBytecode();
  const proxyIdentity = planGenesisIdentity({
    category: options.proxyDeploy.fundingUtxo.txid,
    ...(options.proxyDeploy.identity === undefined ? {} : { identity: options.proxyDeploy.identity }),
    deployerLock: options.proxyDeploy.senderLockingBytecode
      ?? (isP2pkhLock(proxyFunderLock) ? proxyFunderLock : addressToLockScript(options.proxyDeploy.changeAddress)),
  });
  // The calls the entry's own body makes through the proxy hop: the plan states their records, and each callee's
  // frame runs from the live deployment the caller named for it. The entry's own facts are the proxy's record
  // values, the proxy's own address for `address(this)`, and the deployer's lock for `msg.sender`.
  const settleOptionsFor = (
    externalPlan: HopExternalPlan, seed?: CalleeSettlement, genesis = false, genesisValidatorAmount?: bigint,
    funderLockingBytecode?: Uint8Array,
  ): SettleHopOptions => ({
    vm,
    proxyArtifact,
    implementationArtifact,
    // The genesis mints the proxy master rather than running it, so the derivation starts from the implementation
    // frame the minted root delegates into; the hop derives the proxy's fallback root instead.
    root: genesis
      ? {
        contract: implementationArtifact.contractName,
        functionName: entryName(implementationArtifact, options.initialize.functionName),
        kind: FrameKind.DELEGATE,
        master: IMPLEMENTATION_MASTER_ID,
      }
      : rootOn(proxyArtifact),
    ...(genesis ? { genesis: true } : {}),
    ...(genesisValidatorAmount === undefined ? {} : { genesisValidatorAmount }),
    ...(funderLockingBytecode === undefined ? {} : { funderLockingBytecode }),
    maximumCommitmentBytes,
    recordCommitments,
    ...(entryWrites === undefined ? {} : { entryWrites }),
    ...(externalPlan.callees.length === 0 ? {} : { callees: externalPlan.callees }),
    ...(seed === undefined ? {} : { seed }),
    eventCommitments: hopEventSentinels(
      implementationArtifact, options.initialize.functionName, proxyCategory, maximumCommitmentBytes, loopTurns.emits,
      skippedInitializeEmits,
    ),
    ...(retvalPlaceholder === undefined ? {} : { retvalPlaceholder }),
    entryLabel: entryLabelFor(options.initialize.functionName),
    ...(externalPlan.blocked?.refusal === undefined ? {} : { refusedSite: externalPlan.blocked.refusal }),
    planFor: (
      writtenCommitments, attemptWrites, entryWriteViews, eventCommitments, implementationRetval, calleeRetvals,
      calleeWriteViews, calleeWriteValues, calleeEventCommitments,
    ) => buildHopPlan({
      provider,
      proxyArtifact, implementationArtifact, implementationMaster, proxyMaster,
      proxyCategory, implementationCategory, recordCommitments, writtenCommitments, recordLockingBytecode,
      ...(genesis ? { genesis: true, identity: proxyIdentity } : {}),
      ...(attemptWrites === undefined ? {} : { entryWrites: attemptWrites }),
      entryWriteViews,
      implementationRetval,
      ...(externalPlan.calls.length === 0 ? {} : { calls: externalPlan.calls }),
      ...(externalPlan.callBases.length === 0 ? {} : { callBases: externalPlan.callBases }),
      ...(externalPlan.callees.length === 0 ? {} : { callees: externalPlan.callees, calleeRetvals }),
      ...(calleeWriteViews.size === 0 ? {} : { calleeWriteViews }),
      ...(calleeWriteValues.size === 0 ? {} : { calleeWriteValues }),
      ...(calleeEventCommitments.size === 0 ? {} : { calleeEventCommitments }),
      ...(externalPlan.sideCars.size === 0 ? {} : { sideCars: externalPlan.sideCars }),
      ...(externalPlan.heldContinuations === true ? { heldContinuations: true } : {}),
      maximumCommitmentBytes,
      eventOutputs: hopEventOutputs(
        implementationArtifact, options.initialize.functionName, proxyCategory, eventCommitments, loopTurns.emits,
      ),
      recordCategoryHex: options.proxyDeploy.fundingUtxo.txid,
      callerSatoshis: options.proxyDeploy.fundingUtxo.satoshis,
      proxyMasterAmount: options.proxyDeploy.masterAmount ?? 1200n,
      implementationMasterAmount: options.implementationDeploy.masterAmount ?? 1200n,
      validatorAmount: recordAmount,
      ...(genesisValidatorAmount === undefined ? {} : { genesisValidatorAmount }),
      ...(funderLockingBytecode === undefined ? {} : { funderLockingBytecode }),
      // A record's covenant pins its value, and the genesis funds a wide record above the fixed amount, so each one
      // is spent at what it holds.
      recordAmounts: deployment.records.map((record) => record.satoshis),
      callerLockingBytecode: options.callerLockingBytecode,
      entry: { functionName: options.initialize.functionName, args: initializeArgs },
      ...(externalPlan.blocked === undefined ? {} : { truncated: true }),
    }),
  });
  // The compute side-cars the implementation's own entry reads, built once over the live pool for the whole hop.
  const implementationSideCars = withBlockOracle(await implementationFrameSideCars(
    provider, implementationArtifact, options.initialize.functionName, initializeArgs, loopTurns.hashes,
  ), await hopBlockOracle(provider, oracleLock, implementationArtifact, options.initialize.functionName));
  const { externalPlan, settled } = await planAndSettleHop({
    plan: (externalReturns, reachedResults, calleeWriteViews, calleeWriteValues, heldContinuations, stopBefore) =>
      planHopExternalCalls({
        provider, artifact: implementationArtifact, functionName: options.initialize.functionName,
        args: initializeArgs, externals: options.externals ?? {}, validatorProgram,
        stateValues: deploymentStateValues(proxyArtifact.stateLayout!, proxy.categoryId, deployment),
        entryDeployment: { categoryId: proxy.categoryId, deployment, layout: proxyArtifact.stateLayout! },
        selfAddress: proxyMaster.address,
        senderAddress: options.callerLockingBytecode,
        externalReturns,
        reachedResults,
        ...(calleeWriteViews.size === 0 ? {} : { calleeWriteViews }),
        ...(calleeWriteValues.size === 0 ? {} : { calleeWriteValues }),
        ...(implementationSideCars.size === 0 ? {} : { sideCars: implementationSideCars }),
        ...(heldContinuations === true ? { heldContinuations: true } : {}),
        ...(stopBefore === undefined ? {} : { stopBefore }),
      }),
    settle: (stated, seed, defer) => settleHop(defer === true
      ? { ...settleOptionsFor(stated, seed), deferCalleeFailures: true }
      : settleOptionsFor(stated, seed)),
    settleCallees: (stated, only, seed) => settleHopCallees(settleOptionsFor(stated, seed), only),
  });
  // A calling initializer is atomic: the genesis-shaped plan mints the proxy master and creates its records in the
  // same transaction that runs the callee frames, so no uninitialized proxy genesis is broadcast (SDKFRAMED-2). The
  // genesis mints the proxy's own validator, so the validator that runs is the first callee's, whose pool the
  // broadcast spends and recreates at its live value. The genesis's funding coin leads it, so its output 0 is the
  // proxy's authhead and the proxy's authchain starts at its own genesis, not at another contract (D47).
  const callingGenesis = !separateHop && externalPlan.callees.length > 0;
  // The calling composition mints the proxy and carries no token premint, so one is refused rather than dropped.
  if (callingGenesis && options.proxyDeploy.nativeToken !== undefined) {
    throw new FramedProxyDeployError(
      'a proxy whose initializer calls another contract is minted by that composition, which carries no token '
        + 'premint: deploy the token without `nativeToken`, or pass `initializeAs: \'hop\'`',
    );
  }
  // The genesis's funding coin is its leading input, signed by the proxy's funder rather than a root caller.
  const genesisFunderLock = callingGenesis ? proxyFunderLock : undefined;
  const runningValidator = callingGenesis
    ? (await readFramedDeployment(
      provider, externalPlan.callees[0]!.categoryId, externalPlan.callees[0]!.artifact.stateLayout!,
    )).validators[0]
    : undefined;
  if (callingGenesis && runningValidator === undefined) {
    throw new FramedProxyDeployError(
      `category ${externalPlan.callees[0]!.categoryId} holds no validator for the calling initializer to run under`,
    );
  }
  const finalized = callingGenesis
    ? await settleHop({ ...settleOptionsFor(externalPlan, undefined, true, runningValidator!.satoshis, genesisFunderLock) })
    : settled;
  const {
    draft, program, verdicts, accepted, writtenCommitments, writtenEventCommitments, retval,
    completed: completedFrames,
  } = finalized;
  const values = retvalPlaceholder === undefined
    ? []
    : decodeReturnValues(
      retval, initializeEntry!.outputs ?? [], structDefinitionsOf(implementationArtifact),
      initializeEntry!.resultEncoding, implementationArtifact.enums,
    );

  // A hop a participant refused is never broadcast, and neither is either genesis: its verdicts are the refusal.
  if (!accepted) {
    const refused = verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
    throw new FramedProxyDeployError(
      `the "${options.initialize.functionName}" hop was refused, so nothing was broadcast: ${refused}`,
    );
  }
  // By default the proxy's genesis mints the state the derivation left, in place of the probe's; a calling
  // initializer's genesis is the derived transaction itself, so it is broadcast rather than re-minted.
  const initialized = separateHop || callingGenesis ? undefined : await deployStatefulContract(proxyArtifact, [], {
    ...options.proxyDeploy,
    provider: staging.provider,
    mintedState: initializedProxyState({
      entryLabel: entryLabelFor(options.initialize.functionName),
      genesis: proxy.tx.outputs,
      program,
      draft,
      category: proxyCategory,
      validatorLock: proxyMaster.address,
    }),
  });
  const broadcast = initialized?.tx ?? await broadcastHop({
    // A calling genesis mints the proxy rather than spending the probe the inner overlay holds, so it is staged on
    // the outer overlay beside the implementation's genesis, which the two are released with.
    provider: callingGenesis ? staging.provider : provider,
    callerFunding: callingGenesis
      ? {
        utxo: options.proxyDeploy.fundingUtxo, funder: options.proxyDeploy.funder,
        changeAddress: options.proxyDeploy.changeAddress,
      }
      : callerFunding!,
    callerLockingBytecode: callingGenesis ? genesisFunderLock! : options.callerLockingBytecode,
    proxyArtifact,
    implementationArtifact,
    proxyCategoryId: proxy.categoryId,
    implementationCategoryId: implementation.categoryId,
    program,
    draft,
    // A calling genesis is the proxy's genesis, so it carries the publication the probe genesis prepared.
    ...(callingGenesis && proxy.registry !== undefined
      ? { publication: publicationOutput(proxy.registry.sha256, proxy.registry.uris) } : {}),
    ...(callingGenesis
      ? { spentUtxos: new Map([
        ...(entryWrites?.spentUtxos ?? []), ...externalPlan.utxos, ...facetSpends, [VALIDATOR_ID, runningValidator!],
      ]) }
      : entryWrites === undefined && externalPlan.utxos.size === 0 && facetSpends.size === 0
        ? {}
        : { spentUtxos: new Map([...(entryWrites?.spentUtxos ?? []), ...externalPlan.utxos, ...facetSpends]) }),
  });
  const proxyGenesis = callingGenesis
    ? {
      contract: proxy.contract, tx: broadcast, categoryId: proxy.categoryId,
      identity: identityRecord(proxyIdentity, broadcast.txid),
      ...(proxy.registry === undefined ? {} : { registry: proxy.registry }),
    }
    : initialized ?? proxy;

  // 3. Everything is built and accepted: the implementation's genesis and the proxy's (and a separate hop) go out
  // back to back, in that order. A hop's window (uninitialized proxy published, hop not yet applied) is exposed to
  // the hook once both geneses are live; the proxy's fallback still refuses a stranger there (SDKFRAMED-2).
  try {
    if (separateHop && options.beforeHopBroadcast !== undefined) {
      await staging.releaseFirst(2);
      await options.beforeHopBroadcast({ proxyCategoryId: proxy.categoryId });
    }
    await staging.release();
  } catch (error) {
    throw new FramedProxyDeployError(
      `the deployment was refused while broadcasting: ${error instanceof Error ? error.message : String(error)}`);
  }

  // The deployment is recorded under the address the proxy presents, so a caller whose own state holds that
  // address — another contract's entry calling into this one — resolves the live deployment from it. The record
  // carries the implementation's artifact beside the proxy's category and the implementation's own, so the caller
  // can place the same fallback-plus-delegate chain this deployment runs.
  registerDeployment(options.provider, {
    contractName: implementationArtifact.contractName,
    address: binToHex(proxyMaster.address),
    lockingBytecode: binToHex(proxyMaster.address),
    contract: {
      inner: { artifact: implementationArtifact },
      proxy: { categoryId: proxy.categoryId },
      framedProxy: { artifact: proxyArtifact, implementationCategoryId: implementation.categoryId },
    },
  });

  return {
    implementation: {
      contract: implementation.contract, categoryId: implementation.categoryId,
      address: implementationMaster.address, tx: implementation.tx,
      ...(implementation.identity === undefined ? {} : { identity: implementation.identity }),
      ...(implementation.registry === undefined ? {} : { registry: implementation.registry }),
    },
    proxy: {
      contract: proxyGenesis.contract, categoryId: proxyGenesis.categoryId,
      address: proxyMaster.address, tx: proxyGenesis.tx,
      ...(proxyGenesis.identity === undefined ? {} : { identity: proxyGenesis.identity }),
      ...(proxyGenesis.registry === undefined ? {} : { registry: proxyGenesis.registry }),
    },
    initialize: {
      transaction: program.transaction, sourceOutputs: program.sourceOutputs,
      draft, completed: completedFrames, verdicts, accepted,
      // The commitment every record of the hop ends at, which the entry's own write computed.
      writtenRecordCommitments: writtenCommitments,
      writtenRecordCommitment: writtenCommitments[0]!,
      // The payload of every event the entry emitted, in emit order, which the entry's own body computed.
      writtenEventCommitments,
      // The value the entry returned, which its own body computed, decoded the way a direct call decodes one.
      retval, values, value: values[0] ?? 0n,
      broadcast,
    },
  };
}

/** Why the coins a proxy deployment signs for cannot carry it: both genesis coins and a separate hop's caller coin. */
async function deployFundingRefusal(
  options: FramedProxyDeployOptions, callerFunding: FramedProxyCallerFunding | undefined,
): Promise<string | undefined> {
  const halves = [options.implementationDeploy, options.proxyDeploy];
  for (const half of halves) {
    const refusal = await ownCoinRefusal(
      options.provider, half.fundingUtxo, half.funder.generateLockingBytecode(), { role: 'funder', tokenFree: true });
    if (refusal !== undefined) return refusal;
  }
  if (callerFunding === undefined) return undefined;
  if (!bytesEqual(callerFunding.funder.generateLockingBytecode(), options.callerLockingBytecode)) {
    return CALLER_LOCK_REFUSAL;
  }
  const { txid, vout } = callerFunding.utxo;
  if (halves.some((half) => half.fundingUtxo.txid.toLowerCase() === txid.toLowerCase()
    && half.fundingUtxo.vout === vout)) {
    return `the caller's coin ${txid}:${vout} also funds a genesis, so the hop could not spend it`;
  }
  return ownCoinRefusal(options.provider, callerFunding.utxo, options.callerLockingBytecode, { role: 'caller' });
}

/** The outputs of a held genesis that carry this category, as the classifier reads a live deployment's. */
function categoryUtxosOf(tx: TransactionDetails, categoryId: string): Utxo[] {
  const wanted = categoryId.toLowerCase();
  const utxos: Utxo[] = [];
  (tx.outputs ?? []).forEach((output, vout) => {
    const token = output.token;
    if (token?.nft === undefined) return;
    const category = binToHex(token.category);
    if (category.toLowerCase() !== wanted) return;
    utxos.push({
      txid: tx.txid,
      vout,
      satoshis: output.valueSatoshis,
      lockingBytecode: output.lockingBytecode,
      token: libauthTokenDetailsToSolidCashTokenDetails(token),
    });
  });
  return utxos;
}

/** The root frame a hop is entered on: the proxy's fallback, carrying the call data it forwards. */
function rootOn(proxyArtifact: Artifact): FrameRequest {
  return {
    contract: proxyArtifact.contractName,
    functionName: entryName(proxyArtifact, '__fallback'),
    kind: FrameKind.ROOT,
    master: PROXY_MASTER_ID,
  };
}

/** The implementation's own frame a plan runs, which every callee frame runs inside (`deriveReentryWriters`). */
function enclosingRootOf(plan: CompositionDraftPlan): Parameters<typeof deriveReentryWriters>[3] {
  const master = plan.masters.find((candidate) => candidate.master === IMPLEMENTATION_MASTER_ID);
  const category = plan.inputs[PROXY_MASTER_ID]?.source.token?.category;
  if (master === undefined || category === undefined) return undefined;
  return {
    request: {
      contract: master.contract, functionName: master.functionName, kind: master.frame.kind, master: master.master,
    },
    calls: master.calls,
    recordCategory: bytesToHex(category),
  };
}

/**
 * The commitment each of the proxy's records ends at, as the derived hop recreates it: the one the settle stated, or
 * for a record a frame that calls back into the root shares, the end of its chain of declarations.
 */
function recordOutputs(
  draft: CompositionDraft, program: ShippedVmProgram, stated: readonly Uint8Array[],
): readonly Uint8Array[] {
  return stated.map((commitment, nftIndex) => {
    const placed = findParticipant(draft.layout, proxyRecordParticipantId(nftIndex));
    const output = placed === undefined ? undefined : program.transaction.outputs[placed.index];
    return output?.token?.nft?.commitment ?? commitment;
  });
}

type HopOutput = NonNullable<ShippedVmProgram['transaction']>['outputs'][number];

/** An output's whole content, so two outputs nothing can tell apart compare equal. */
function outputKey(output: HopOutput): string {
  const { token } = output;
  const nft = token?.nft === undefined ? '' : `${token.nft.capability}:${binToHex(token.nft.commitment)}`;
  const held = token === undefined ? '' : `${binToHex(token.category)}:${token.amount}:${nft}`;
  return `${binToHex(output.lockingBytecode)}:${output.valueSatoshis}:${held}`;
}

/**
 * The proxy's state as the derived `initialize` leaves it, which its genesis mints in place of the probe's: what the
 * probe minted and the hop does not spend, then every output of the proxy's own state the hop recreates or creates.
 * The pools (masters at the minting capability, validators at `validatorLock`) are the genesis's own to mint. An
 * effect elsewhere (another contract's frame, a send) is refused: a calling initializer never reaches this — it runs
 * as a genesis-shaped transaction of its own (`callingGenesis`) — and only a separate hop carries any other effect.
 */
function initializedProxyState(options: {
  readonly entryLabel: string;
  readonly genesis: readonly HopOutput[];
  readonly program: ShippedVmProgram;
  readonly draft: CompositionDraft;
  readonly category: Uint8Array;
  readonly validatorLock: Uint8Array;
}): Output[] {
  const { program, draft } = options;
  const elsewhere = (what: string): FramedProxyDeployError => new FramedProxyDeployError(
    `the implementation's ${options.entryLabel} ${what}, which the proxy's genesis cannot mint; pass `
    + '`initializeAs: \'hop\'` to run it as a separate hop, which leaves the proxy uninitialized until it confirms',
  );
  // The genesis mints its own authhead, so the probe's identity NFT is no part of the state.
  const authhead = authheadLockingBytecode(bytesToHex(options.category));
  const isState = (output: HopOutput | undefined): boolean => output?.token !== undefined
    && bytesEqual(output.token.category, options.category) && output.token.nft?.capability !== 'minting'
    && !bytesEqual(output.lockingBytecode, options.validatorLock) && !bytesEqual(output.lockingBytecode, authhead);
  const unspent = options.genesis.filter(isState);
  const left: HopOutput[] = [];
  for (const placed of draft.layout.participants) {
    const source: HopOutput | undefined = program.sourceOutputs[placed.index];
    const output: HopOutput | undefined = program.transaction.outputs[placed.index];
    if (source !== undefined && isState(source)) {
      const at = unspent.findIndex((minted) => outputKey(minted) === outputKey(source));
      if (at === -1) {
        throw new FramedProxyDeployError(
          `the ${options.entryLabel} derivation spends "${placed.id}", which the proxy's genesis does not mint`);
      }
      unspent.splice(at, 1);
      if (output !== undefined && isState(output)) left.push(output);
    } else if (source?.token !== undefined && (output === undefined || outputKey(output) !== outputKey(source))) {
      throw elsewhere(`changes "${placed.id}"`);
    }
  }
  for (const { index } of draft.trailingOutputs) {
    const output: HopOutput | undefined = program.transaction.outputs[index];
    if (output === undefined || !isState(output)) throw elsewhere(`lists output ${index} outside the proxy's own state`);
    left.push(output);
  }
  return [...unspent, ...left].map(libauthOutputToSolidCashOutput);
}

/** What a settled hop produced, before the caller's own coin turns it into a broadcast transaction. */
interface SettledHop {
  readonly draft: CompositionDraft;
  readonly program: ShippedVmProgram;
  /** The frames the derivation completed, callee before caller. */
  readonly completed: readonly FrameRequest[];
  readonly verdicts: readonly InitializeVerdict[];
  readonly accepted: boolean;
  /** The commitment every record ends at, which the entry's own write computed. */
  readonly writtenCommitments: readonly Uint8Array[];
  /** The payload of every event output the entry lists, in emit order, which its body computed: empty where skipped. */
  readonly writtenEventCommitments: readonly Uint8Array[];
  /** The bytes the implementation frame recorded in its `retval`, which a returning entry's own body computed. */
  readonly retval: Uint8Array;
  /** What each settled callee frame's own body returned, keyed by the master the plan placed it under. */
  readonly calleeRetvals: ReadonlyMap<string, Uint8Array>;
  /**
   * The end view each settled callee frame's own record closed with, keyed by the master it was placed under.
   *
   * The plan states a placeholder for a node whose value the frame's body computes, so a reach planned after that
   * frame has to be handed the view the settle learned rather than the placeholder.
   */
  readonly calleeWriteViews: ReadonlyMap<string, readonly (Uint8Array | undefined)[]>;
  /** The whole value a settled callee frame's own chunkable write computed, keyed by the master it was placed under. */
  readonly calleeWriteValues: ReadonlyMap<string, Uint8Array>;
  /** The entry's own writes as the settled plan states them, whose participant ids the broadcast reads back. */
  readonly entryWrites?: HopEntryWrites;
  /** The sends the settled plan lists for the implementation's frame, each lock and amount its body computed. */
  readonly sends?: readonly HopSend[];
}

/** Everything one attempt at a hop reads, and how to rebuild the plan once a record's computed value is learned. */
interface SettleHopOptions {
  readonly vm: Machine;
  readonly proxyArtifact: Artifact;
  readonly implementationArtifact: Artifact;
  readonly root: FrameRequest;
  readonly maximumCommitmentBytes: number;
  readonly recordCommitments: readonly Uint8Array[];
  /** The records the entry's own body writes beyond its data-NFT records, or absent when it writes none. */
  readonly entryWrites?: HopEntryWrites;
  /**
   * The entry's own writes as the record commitments the plan currently states imply them.
   *
   * A record's own declaration can fix the width of a run the entry writes — the record carries a dynamic value's
   * byte length — so the writes are re-planned from the commitments each attempt states: the first attempt lays
   * the run at the live width, the record's own close hands back the length the body wrote, and the next attempt
   * lays the run at the chunks that length names. A chunkable mapping write whose value the artifact does not
   * publish is re-planned the same way from the value the body's own pin close exposed. Absent leaves the writes as
   * the caller stated them.
   */
  readonly entryWritesFor?: (
    writtenCommitments: readonly Uint8Array[], learnedValue?: Uint8Array,
  ) => HopEntryWrites | undefined;
  /** One placeholder per event the entry emits, in emit order, which the derivation replaces as it learns. */
  readonly eventCommitments: readonly Uint8Array[];
  /**
   * The candidate the implementation frame's `retval` starts from, or absent when the entry returns nothing.
   *
   * A returning entry compares the blob its own `return` built against this slot, so the failing close leaves the
   * slot beside that blob and the derivation learns the value the entry computed, exactly as the direct call path
   * does. A void entry requires the slot empty, which is what `absent` leaves it.
   */
  readonly retvalPlaceholder?: Uint8Array;
  /** The callee frames the implementation frame's calls reach, in the order the entry reaches them. */
  readonly callees?: readonly HopCallee[];
  /** What earlier settles of these callee frames learned, keyed by master, which their settle starts from. */
  readonly seed?: CalleeSettlement;
  /** The entry, for the refusal's own words, e.g. `"initialize" entry`. */
  readonly entryLabel: string;
  /** True to plan the genesis shape: the proxy master minted and its records created, with no caller coin. */
  readonly genesis?: boolean;
  /**
   * The satoshi value of the running validator's own pool, for the genesis shape.
   *
   * The genesis mints the proxy's own validator, so the validator that runs is the first callee's; its input is
   * spent and recreated at the pool's actual value, which the caller read from the callee's live deployment.
   */
  readonly genesisValidatorAmount?: bigint;
  /**
   * The lock of the genesis's own funding coin, which the genesis shape's leading input sits at. It differs from the
   * root frame's caller lock because a minted root has no P2PKH caller.
   */
  readonly funderLockingBytecode?: Uint8Array;
  /**
   * The value the hop carries and the sends the implementation's frame pays (`hop-value.ts`), absent for neither:
   * the plan starts each send's lock and amount from a sentinel the body's own pin fails against, and the settle
   * learns what the body computed.
   */
  readonly value?: HopValue;
  /**
   * The plan for a given set of per-record, per-entry-write, per-event and `retval` candidate end values, and the
   * sends the implementation's frame lists (every one the entry can make, none learned, when absent).
   */
  readonly planFor: (
    writtenCommitments: readonly Uint8Array[],
    entryWrites: HopEntryWrites | undefined,
    entryWriteViews: readonly Uint8Array[],
    eventCommitments: readonly Uint8Array[],
    implementationRetval: Uint8Array,
    calleeRetvals: ReadonlyMap<string, Uint8Array>,
    calleeWriteViews: ReadonlyMap<string, readonly (Uint8Array | undefined)[]>,
    calleeWriteValues: ReadonlyMap<string, Uint8Array>,
    calleeEvents: ReadonlyMap<string, readonly Uint8Array[]>,
    sends?: readonly HopSend[],
  ) => CompositionDraftPlan;
  /**
   * Records a callee's refusal instead of throwing it and derives the entry anyway. Set by the fallback for a hop
   * whose plan stopped at a site after a check the entry fails: the entry's own reason is read if it has one, and
   * the recorded verdict stands otherwise. The normal settle leaves it unset, so a callee's verdict is thrown
   * before the entry is derived, exactly as before.
   */
  readonly deferCalleeFailures?: boolean;
  /**
   * The failure met at the site the plan stops before (`HopPlanBlock.refusal`): it stands when the entry reaches that
   * site, whose call the plan states no record for, or settles past it, and the entry's own stop is reported when it
   * stops first (`planning-refusal.ts`).
   */
  readonly refusedSite?: Error;
}

/** What callee frames' own bodies computed, keyed by master: each return, unstated write view and event payload. */
export interface CalleeSettlement {
  readonly retvals: Map<string, Uint8Array>;
  readonly writeViews: Map<string, readonly (Uint8Array | undefined)[]>;
  /**
   * The whole value a callee's own chunkable mapping write computed, keyed by master.
   *
   * A write whose value the artifact does not publish is planned with its run unstated; the frame's own close
   * exposes the bytes the body stored, and the run is planned again from them.
   */
  readonly writeValues: Map<string, Uint8Array>;
  readonly events: Map<string, readonly Uint8Array[]>;
  /**
   * A callee frame whose own settle refused, when the settle was asked to defer the verdict instead of throwing.
   *
   * A call the entry reaches only after a check it fails is never actually entered, so a frame below that check can
   * still refuse (its own inputs are not the execution's). Deferring lets the entry be derived and evaluated once
   * the calls before it are bound, so an entry that refuses on its own source reason is reported rather than a frame
   * the execution never reaches. The deferred verdict is thrown only when the entry does not refuse that way.
   */
  readonly deferred?: Error;
  /** Every deferred refusal, by the index of the callee whose settle refused, so the first one met is reported. */
  readonly deferredFrames?: ReadonlyMap<number, Error>;
  /**
   * The callee frames the machine accepted as the settle left them, by master. A frame that accepts declares every
   * view its body computes, so a view it never handed back is the one the plan states.
   */
  readonly accepted?: ReadonlySet<string>;
}

/**
 * The order the hop settles its callee frames in.
 *
 * Deepest first, so the frames a callee reaches answer before it is derived; and a frame that declares the view an
 * earlier frame's write of a shared node left is settled after that writer, whose view is learned from its own
 * frame. Created nodes have no spent participant, so their declared writes add dependencies as well as shared
 * inputs. A hop with no shared write keeps the deepest-first order unchanged. Only the
 * frames being settled order each other: a frame this settle leaves out keeps the view an earlier settle learned.
 * A frame that starts from a view an earlier frame of its contract left follows the frames that view's learning
 * needs (`reentrySettleBefore`).
 */
export function calleeSettleOrder(callees: readonly HopCallee[], deepestFirst: readonly number[]): readonly number[] {
  const writersBefore = calleeNodeWritersBefore(callees);
  const reentryBefore = reentrySettleBefore(callees);
  const inScope = new Set(deepestFirst);
  const settled = new Set<number>();
  const order: number[] = [];
  const remaining = [...deepestFirst];
  const ready = (index: number): boolean =>
    callees.every((callee, at) => callee.enteredBy !== index || !inScope.has(at) || settled.has(at))
    && (writersBefore.get(index) ?? []).every((writer) => !inScope.has(writer) || settled.has(writer))
    && (reentryBefore.get(index) ?? []).every((frame) => !inScope.has(frame) || settled.has(frame));
  while (remaining.length > 0) {
    const at = remaining.findIndex(ready);
    if (at < 0) {
      throw new FramedProxyDeployError(
        'the hop\'s callee frames have no settle order that answers each frame\'s callees before it and each '
        + 'shared node\'s writes before the frames that declare the views they left',
      );
    }
    const index = remaining.splice(at, 1)[0]!;
    settled.add(index);
    order.push(index);
  }
  return order;
}

/** Earlier writers of spent or newly created nodes that a later frame continues. */
function calleeNodeWritersBefore(callees: readonly HopCallee[]): ReadonlyMap<number, readonly number[]> {
  const before = new Map<number, readonly number[]>();
  for (const dependencies of [sharedNodeWritersBefore(callees), writtenNodeWritersBefore(callees)]) {
    for (const [frame, writers] of dependencies) {
      before.set(frame, [...new Set([...(before.get(frame) ?? []), ...writers])]
        .filter((writer) => writer !== frame));
    }
  }
  return before;
}

/**
 * Learns what each callee frame's entry computed, before the caller that reaches it is settled.
 *
 * A callee's own frame is the authority on its return: the plan states a candidate in its `retval` slot and the
 * close the entry's own `return` comparison leaves behind names the bytes it built. A void callee has nothing to
 * learn, but its frame is still run so a callee that refuses — or one that turns out to rewrite the record the
 * plan declared kept — is named here rather than reported as the caller's failure.
 *
 * A callee whose own entry makes calls reaches a frame below it, so the callees are settled deepest first: the
 * frame a callee reaches is derived (and its own answer learned) before the callee that reaches it, and a callee
 * that makes calls is settled by deriving its subtree rather than by asking its program outright.
 *
 * `seed` states what an earlier settle of the same frames learned, so each starts from it; `only` settles the named
 * callee indices alone, which is how the frames before a stopped plan's site are settled to learn their results.
 *
 * The plain call path settles its callee frames here too (`callInShape`), from a plan of its own composition: it
 * builds each attempt's draft itself (`compose`), names its own root as the frame a re-entered contract's frames run
 * inside (`enclosingRoot`), learns only the judged frame's views before asking about it (`judgeSubtreeViewsOnly`),
 * plans a chunkable write's value only by planning the call again (`returnOnWriteValue`), states its own candidate
 * in a callee's `retval` slot (`retvalPlaceholder`), and judges a frame that makes calls once its subtree derived
 * (`judgeDerivedFrames`), since no entry loop of its own learns what such a frame leaves.
 */
export async function settleCallees(options: {
  readonly vm: Machine;
  readonly artifacts: readonly Artifact[];
  readonly planFor: (
    calleeRetvals: ReadonlyMap<string, Uint8Array>,
    calleeWriteViews: ReadonlyMap<string, readonly (Uint8Array | undefined)[]>,
    calleeWriteValues: ReadonlyMap<string, Uint8Array>,
    calleeEvents: ReadonlyMap<string, readonly Uint8Array[]>,
  ) => CompositionDraftPlan;
  readonly callees: readonly HopCallee[];
  readonly maximumCommitmentBytes: number;
  readonly seed?: CalleeSettlement;
  readonly only?: ReadonlySet<number>;
  /**
   * Records a callee's refusal instead of throwing it, so the caller can evaluate the entry against the calls that
   * did settle and let the entry's own refusal win. Only the full settle defers; a settle of named producer frames
   * needs their verdict outright.
   */
  readonly deferFailures?: boolean;
  /** Builds the draft each attempt derives from its plan; the composer's own host when absent. */
  readonly compose?: (plan: CompositionDraftPlan) => ReturnType<typeof createComposedDerivationHost>;
  /**
   * The root frame the callees run inside, which a frame re-entering the root's contract is derived up to
   * (`deriveReentryWriters`); the hop's implementation frame when absent.
   */
  readonly enclosingRoot?: (plan: CompositionDraftPlan) => EnclosingRoot | undefined;
  /**
   * Learns, before a callee's program is asked about, only the views the frame and the frames it enters left
   * unstated. A plan that leaves its root's own records unstated would otherwise run the root again for every
   * attempt of every callee, though no callee reads what the root writes after it: a callee that re-enters the
   * root's contract is derived up to its entry first (`deriveReentryWriters`), which learns those views.
   */
  readonly judgeSubtreeViewsOnly?: boolean;
  /**
   * Hands the settlement back once a callee's chunkable write exposes its whole value at its pin, for a caller that
   * plans such a write from its value only by planning the call again; a value only a node's inline view shows is
   * not learned for such a caller.
   */
  readonly returnOnWriteValue?: boolean;
  /**
   * The candidate the plan states in a callee's `retval` slot, whose close against the body's own return names the
   * value; the hop's own (`hopRetvalPlaceholder`) when absent.
   */
  readonly retvalPlaceholder?: (callee: HopCallee) => Uint8Array;
  /**
   * Judges a callee that makes calls once its subtree derived, as a callee that makes none is judged: the machine is
   * asked about the frame, and a value its body closes against only after its calls is learned from that close. The
   * hop leaves such a frame settled when its derivation completes, and its own entry's loop learns what is left; a
   * caller without such a loop sets this.
   */
  readonly judgeDerivedFrames?: boolean;
}): Promise<CalleeSettlement> {
  const trace = hopTraceOn();
  const deferFailures = options.deferFailures === true;
  let deferred: Error | undefined;
  const deferredFrames = new Map<number, Error>();
  // The frames the machine accepted as this settle left them, which a caller may read the views they owe from.
  const accepted = new Set<string>();
  const learned = new Map<string, Uint8Array>(options.seed?.retvals ?? []);
  const writeViews = new Map<string, readonly (Uint8Array | undefined)[]>(options.seed?.writeViews ?? []);
  const writeValues = new Map<string, Uint8Array>(options.seed?.writeValues ?? []);
  // Each callee's event payloads start from the sentinel the plan states there; the body's own comparison of the
  // payload it computed against that declaration is what hands the value back. An emit the reach's facts decide the
  // body skips starts from, and keeps, the empty commitment.
  const calleeEvents = new Map<string, readonly Uint8Array[]>(
    options.callees.map((callee): [string, readonly Uint8Array[]] => [
      callee.master,
      options.seed?.events.get(callee.master) ?? hopEventSentinels(
        callee.artifact, callee.entry, calleeEventCategory(options.callees, callee),
        options.maximumCommitmentBytes, undefined, callee.skippedEmits,
      ),
    ]).filter(([, commitments]) => commitments.length > 0),
  );
  const depthOf = (index: number): number => {
    let depth = 1;
    let current = options.callees[index]!.enteredBy;
    while (current !== null) {
      depth += 1;
      current = options.callees[current]!.enteredBy;
    }
    return depth;
  };
  const deepestFirst = options.callees
    .map((_callee, index) => index)
    .filter((index) => options.only === undefined || options.only.has(index))
    .sort((left, right) => depthOf(right) - depthOf(left));
  const nodeWritersBefore = calleeNodeWritersBefore(options.callees);
  // The frames a later reach of one of their nodes continues from, which leave it the value they computed.
  const continuedWriters = new Set([...nodeWritersBefore.values()].flat());
  for (const calleeIndex of calleeSettleOrder(options.callees, deepestFirst)) {
    const callee = options.callees[calleeIndex]!;
    // A frame that reads or rewrites a node an earlier frame's write left at bytes that frame's own close exposed was
    // planned without them, so the hop is planned again from them before the frame is judged (`reached-values.ts`).
    const reachedValue = learnedReachedValue(options.callees, nodeWritersBefore.get(calleeIndex), writeValues);
    if (reachedValue !== undefined) throw new EnclosingValueLearned(reachedValue.master, reachedValue.value);
    const placeholder = options.retvalPlaceholder?.(callee) ?? hopRetvalPlaceholder(callee.contract, callee.entry);
    // One attempt per value the frame computes — its return, each unstated write, each event payload — plus the
    // attempt that is accepted once every one of them is stated, and one per view a writer it runs inside leaves it.
    const attempts = MAXIMUM_HOP_ATTEMPTS
      + (callee.entryWrites?.learningCandidates.length ?? 0)
      + (calleeEvents.get(callee.master)?.length ?? 0)
      + enclosingCandidateCount(options.callees, calleeIndex);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      bumpFramedCounter('hopAttempts');
      const plan = options.planFor(learned, writeViews, writeValues, calleeEvents);
      const candidate = options.compose?.(plan)
        ?? createComposedDerivationHost({ vm: options.vm, artifacts: options.artifacts, plan });
      if (trace) {
        hopTrace(`attempt callee=${callee.master} `
          + `${traceFrameFacts(callee.master, callee.functionName, callee.kind)} n=${attempt} `
          + `refs-before=[${traceCallRefs(candidate.draft, callee.master)}]`);
      }
      // A frame that starts from a view an earlier frame of its contract wrote is judged once the draft learned it,
      // so the writers are derived first, the root's own first when the frame calls back into it (`reentry.ts`).
      deriveReentryWriters(candidate, options.callees, calleeIndex, (options.enclosingRoot ?? enclosingRootOf)(plan));
      // A frame inside a writer whose value only the writer's own run exposes starts from that value, which is read
      // here: a chunking value plans the hop again from it, and the view of any other node is stated for the writer
      // before the frame is judged (`enclosed-values.ts`).
      const enclosing = learnEnclosingValues(candidate, options.callees, calleeIndex, writeValues, writeViews, {
        valueAt: (master) => learnedValueFromClose(options.vm, candidate.draft.programFor(master)),
        readingAt: (master) => readComputedDeclaration({
          vm: options.vm, program: candidate.draft.programFor(master),
          maximumCommitmentBytes: options.maximumCommitmentBytes,
        }),
      });
      if (enclosing !== undefined) {
        if (trace) hopTrace(`stop callee=${callee.master} reason=learned-enclosing-view writer=${enclosing.master}`);
        const views = [...(writeViews.get(enclosing.master) ?? [])];
        while (views.length <= enclosing.at) views.push(undefined);
        views[enclosing.at] = enclosing.view;
        writeViews.set(enclosing.master, views);
        continue;
      }
      // A callee that makes calls cannot accept before its own calls are derived, so its subtree is derived first;
      // a stall there is the callee's own return comparison or one of its own write's declarations, read below.
      if (callee.calls.length > 0) {
        const frame: FrameRequest = {
          contract: callee.contract, functionName: callee.functionName, kind: callee.kind, master: callee.master,
        };
        try {
          bumpFramedCounter('hopDerivations');
          deriveComposition([frame], candidate.host);
          if (trace) {
            hopTrace(`stop callee=${callee.master} reason=derived `
              + `refs-after=[${traceCallRefs(candidate.draft, callee.master)}]`);
            // The derivation bound the frame's own calls, which does not by itself mean the machine accepts the
            // frame: a declaration the frame's body disagrees with still refuses, and the frame's own stop is named
            // here so a frame that derived and refuses anyway is told apart from one that accepted.
            hopTrace('callee-derived-stop '
              + `${traceFrameFacts(callee.master, callee.functionName, callee.kind)} `
              + traceStopInstructions(options.vm, candidate.draft.programFor(callee.master)));
          }
          // A caller that judges each frame here reads the derived frame below, as it reads a frame that makes no
          // call: a declaration its body closes against only after its calls is learned from that close.
          if (options.judgeDerivedFrames !== true) break;
        } catch (error) {
          if (trace) {
            hopTrace(`stop callee=${callee.master} reason=stall:${hopTraceError(error)} `
              + `refs-after=[${traceCallRefs(candidate.draft, callee.master)}]`);
          }
          const learnable = callee.returns
            || (callee.entryWrites?.learningCandidates.length ?? 0) > 0
            || (calleeEvents.get(callee.master)?.length ?? 0) > 0;
          // A void callee with nothing to learn has no return, no unstated write and no event, so a stall is its
          // refusal. The full settle records it and moves on, so a later frame the entry does not reach cannot abort
          // a settle the entry's own check would refuse first. The stall names only where the derivation stopped,
          // so the frame and its own reason are read off the stalled draft once its views are learned.
          if (!learnable) {
            candidate.draft.learnUnstatedViews();
            const named = stalledCalleeRefusal({
              draft: candidate.draft, vm: options.vm, artifacts: options.artifacts, callee,
            });
            const failure = named?.failure ?? (error as Error);
            if (deferFailures) {
              deferred ??= failure;
              deferredFrames.set(calleeIndex, failure);
              // A frame whose own check its report names first never made the calls below it that refused (spec V6).
              if (named?.innermost.master === callee.master) {
                dropDeferredBelow(options.callees, deferredFrames, calleeIndex);
              }
              break;
            }
            throw failure;
          }
        }
      }
      // A frame whose own body computes a value the plan left unstated closes against that placeholder, and a frame
      // this loop never resumes at a site would hand the placeholder to the machine below: the draft learns what its
      // own runs compute first, so a close the loop reads back is about a value and not about the placeholder.
      if (options.judgeSubtreeViewsOnly === true) {
        candidate.draft.learnUnstatedViewsOf(
          subtreeOf(options.callees, calleeIndex).map((at) => options.callees[at]!.master));
      } else {
        candidate.draft.learnUnstatedViews();
      }
      const program = candidate.draft.programFor(callee.master);
      const state = options.vm.evaluate({
        inputIndex: participant(candidate.draft.layout, callee.master).index,
        sourceOutputs: program.sourceOutputs,
        transaction: program.transaction,
      });
      if (options.vm.stateSuccess(state) === true) {
        if (trace) hopTrace(`stop callee=${callee.master} reason=accepted`);
        accepted.add(callee.master);
        break;
      }
      const reading = readComputedDeclaration({
        vm: options.vm, program, maximumCommitmentBytes: options.maximumCommitmentBytes,
      });
      // A returning entry's own `return` compares the blob it built against the frame's `retval` slot; whichever
      // operand the candidate sits on, the other is what the body computed. A callee the plan states no candidate
      // for has nothing to learn, so a close that is not its return is the frame's own refusal.
      if (callee.returns && reading.ok && bytesEqual(reading.computed, placeholder)) {
        if (trace) hopTrace(`stop callee=${callee.master} reason=learned-retval`);
        learned.set(callee.master, Uint8Array.from(reading.declared));
        continue;
      }
      if (callee.returns && reading.ok && bytesEqual(reading.declared, placeholder)) {
        if (trace) hopTrace(`stop callee=${callee.master} reason=learned-retval`);
        learned.set(callee.master, Uint8Array.from(reading.computed));
        continue;
      }
      // A record the frame's own write leaves unstated closes against the candidate the plan stated there, so the
      // value the body computed is read from the same close the return is: whichever operand is the candidate, the
      // other is what the body wrote, at the candidate's own slot.
      const candidates = callee.entryWrites?.learningCandidates ?? [];
      const views: (Uint8Array | undefined)[] = [...(writeViews.get(callee.master) ?? [])];
      if (reading.ok && candidates.length > 0) {
        // Two nodes whose values the artifact leaves unstated start from the same placeholder, so the close's own
        // operand can match several candidates at once. The candidates are in the order the body closes them in, and
        // a candidate whose view is already learned is stated in the plan already: the node this close is about is
        // the first match the plan has not caught up with, so each pass learns the next node in that order rather
        // than restating the first one.
        const learnedAt = (operand: Uint8Array): number => {
          const matches: number[] = [];
          for (const [at, entry] of candidates.entries()) if (bytesEqual(operand, entry)) matches.push(at);
          const fresh = matches.find((at) => views[at] === undefined);
          return fresh ?? (matches[0] ?? -1);
        };
        const declaredAt = learnedAt(reading.declared);
        const computedAt = learnedAt(reading.computed);
        const at = declaredAt >= 0 ? declaredAt : computedAt;
        if (at >= 0) {
          if (trace) hopTrace(`stop callee=${callee.master} reason=learned-write at=${at}`);
          const view = Uint8Array.from(declaredAt >= 0 ? reading.computed : reading.declared);
          while (views.length <= at) views.push(undefined);
          views[at] = view;
          writeViews.set(callee.master, views);
          // A chunking value the node keeps inline passes no pin, so the view this close rebuilt is the only place it
          // shows; a later reach of the node continues from it as from a pin's (`reached-values.ts`).
          const inline = options.returnOnWriteValue !== true && callee.entryWrites?.awaitsValue === true
            && !writeValues.has(callee.master) && continuedWriters.has(calleeIndex)
            ? inlineValueAt(options.callees, calleeIndex, at, view) : undefined;
          if (inline !== undefined) writeValues.set(callee.master, inline);
          continue;
        }
      }
      // A frame that emits compares each payload its own body computed against the commitment the plan states in
      // the event's output, so the same close hands the payload back. The frame's events are read after its writes,
      // which is the order the body compares them in. A skipped emit closes the commitment against its empty payload.
      const events = calleeEvents.get(callee.master) ?? [];
      const event = reading.ok ? eventCloseOf(reading, events) : undefined;
      if (event !== undefined) {
        if (trace) hopTrace(`stop callee=${callee.master} reason=learned-event at=${event.position}`);
        const next = [...events];
        next[event.position] = event.payload;
        calleeEvents.set(callee.master, next);
        continue;
      }
      // A chunkable mapping write whose value the artifact does not publish: the plan states no run, so the frame's
      // own pin stops on the chunk count its body computed, and the value and its digest are operands at that stop.
      // The frame's write is planned again from the value, which sizes the run of chunk records it takes.
      if (reading.ok && callee.entryWrites?.awaitsValue === true && !writeValues.has(callee.master)) {
        const value = learnedValueFromClose(options.vm, program);
        if (value !== undefined) {
          if (trace) hopTrace(`stop callee=${callee.master} reason=learned-chunk-value len=${value.length}`);
          writeValues.set(callee.master, value);
          // The run the write now takes replaces the one the reach was placed with, so the views learned against
          // the unstated run name records the plan no longer declares.
          writeViews.delete(callee.master);
          if (options.returnOnWriteValue === true) {
            return { retvals: learned, writeViews, writeValues, events: calleeEvents, accepted };
          }
          continue;
        }
        // The body computed a chunkable value the close did not expose, so the run's width stays unstated: refuse
        // by name rather than lay a run the body's own pin would not address.
        if (trace) {
          hopTrace(`callee-value-reading ${callee.master} ${traceReading(reading)}`);
          hopTrace(`callee-value-stop ${callee.master} ${traceStopInstructions(options.vm, program)}`);
        }
        throw new FramedProxyDeployError(
          `the call's callee "${callee.functionName}" writes mapping `
          + `"${callee.entryWrites.collection ?? '<unnamed>'}" a value whose source the artifact does not publish, `
          + 'so this hop cannot tell whether the write needs value chunks',
        );
      }
      // The reporter judges each frame by evaluating the program this draft hands it, and a draft whose unstated
      // views were never learned hands it placeholders: the body's close then fails against its own placeholder and
      // a frame that would accept is read as the frame that refused. Learning first is what the evaluation below
      // and the reporter alike are owed, exactly as the accepted path is.
      candidate.draft.learnUnstatedViews();
      const refusal = reportCompositionRefusal({
        draft: candidate.draft, artifacts: options.artifacts, vm: options.vm, reached: [callee.master],
      });
      // A delegate frame reads the records of the proxy frame that entered it, so the reading is described against
      // whichever frame declares the records this one runs on.
      const settledRecords = callee.recordOwner === undefined
        ? callee.records : options.callees[callee.recordOwner]?.records ?? [];
      const attributed = refusal.innermost === undefined
        ? describeReading(reading, settledRecords[0]?.commitment ?? new Uint8Array(0))
        : describeInnermost(refusal.innermost);
      // The reporter names the deepest frame the machine refused, which is not always the frame this settle
      // evaluated: a call the settle never bound leaves its caller reading an unfilled callee reference, and a proxy
      // leg that merely forwards can refuse before the frame it forwards to. The evaluated frame is named beside the
      // reported one, so the failing frame is read off this message rather than inferred from the reporter.
      const failing = trace && refusal.innermost !== undefined && refusal.innermost.master !== callee.master
        ? `frame "${callee.master}" of ${callee.functionName} (${frameKindName(callee.kind)}) did not accept; the `
          + `refusal reporter named ${attributed}`
        : attributed;
      if (trace) {
        hopTrace(`stop callee=${callee.master} reason=refused evaluated=${callee.master} `
          + `reported=${refusal.innermost?.master ?? 'none'} ip=${String(refusal.innermost?.ip ?? 'none')} `
          + `refs=[${traceCallRefs(candidate.draft, callee.master)}]`);
        hopTrace(`close callee=${callee.master} reason=${attributed}`);
        hopTrace(`reading callee=${callee.master} ${traceReading(reading)}`);
        hopTrace(`callee=${callee.master} returns=${callee.returns} records=${callee.records.length} `
          + `retvalCandidate=${binToHex(placeholder).slice(0, 20)}`);
        hopTrace(`callee-decl ${callee.master} records=[${callee.records.map((record) =>
          `${record.id}|${record.commitment.length}:${binToHex(record.commitment.slice(-4))}`).join(' ')}]`);
        hopTrace(`callee-learn ${callee.master} slots=[${(callee.entryWrites?.learningSlotOrder ?? [])
          .map((slot) => binToHex(slot).slice(0, 12)).join(',')}] candidates=[`
          + `${(callee.entryWrites?.learningCandidates ?? [])
            .map((entry) => `${entry.length}:${binToHex(entry.slice(-4))}`).join(',')}]`);
        hopTrace(`callee-stop ${callee.master} ${traceStopInstructions(options.vm, program)}`);
      }
      // The refusal carries the values the reported frame's custom error was raised with, as the entry's own does.
      const failure = new FramedProxyDeployError(
        `the call's callee "${callee.functionName}" did not settle through the proxy: ${failing}`,
        refusal.innermost?.reason.arguments,
      );
      if (deferFailures) {
        deferred ??= failure;
        deferredFrames.set(calleeIndex, failure);
        // A frame whose own stop its report names first never made the calls below it that refused (spec V6).
        if (refusal.innermost?.master === callee.master) dropDeferredBelow(options.callees, deferredFrames, calleeIndex);
        break;
      }
      throw failure;
    }
  }
  return {
    retvals: learned, writeViews, writeValues, events: calleeEvents, accepted,
    ...(deferred === undefined ? {} : { deferred, deferredFrames }),
  };
}

/**
 * The frame facts a refusal message is built from, as the hop trace's own fields.
 *
 * The same master id, entry label and kind a refusal names, so a trace line and a refusal can be matched without
 * inferring one from the other.
 */
function traceFrameFacts(master: string, functionName: string, kind: number): string {
  return `frame=${master} fn=${functionName} kind=${frameKindName(kind)}`;
}

/** The instructions a run stopped on, for the hop trace: the stop index and the dozen before it. */
function traceStopInstructions(vm: Machine, program: ShippedVmProgram): string {
  const machine = vm as unknown as {
    boundedDebug?: (p: ShippedVmProgram) => readonly {
      readonly ip: number; readonly instructions: readonly { readonly opcode: number }[];
      readonly stack: readonly Uint8Array[]; readonly error?: string;
    }[];
  };
  let trace: readonly { readonly ip: number; readonly instructions: readonly { readonly opcode: number }[];
    readonly stack: readonly Uint8Array[]; readonly error?: string }[];
  try {
    trace = machine.boundedDebug?.(program) ?? (vm as unknown as {
      debug: (p: ShippedVmProgram) => typeof trace;
    }).debug(program);
  } catch {
    return 'no-trace';
  }
  const failed = trace.findIndex((state) => state.error !== undefined);
  if (failed <= 0) return 'no-trace';
  const before = trace[failed - 1]!;
  const at = trace[failed]!;
  const label = (state: { readonly ip: number; readonly instructions: readonly { readonly opcode: number }[] }): string =>
    `${state.ip}/${state.instructions.length}:${state.instructions[state.ip]?.opcode ?? -1}`;
  const names: Record<number, string> = {
    0x4c: 'PUSHDATA1', 0x4d: 'PUSHDATA2', 0x4f: 'OP_1NEGATE', 0x51: 'OP_1', 0x52: 'OP_2', 0x53: 'OP_3',
    0x54: 'OP_4', 0x55: 'OP_5', 0x56: 'OP_6', 0x57: 'OP_7', 0x63: 'OP_IF', 0x64: 'OP_NOTIF', 0x67: 'OP_ELSE',
    0x68: 'OP_ENDIF', 0x69: 'OP_VERIFY', 0x6a: 'OP_RETURN', 0x6b: 'TOALT', 0x6c: 'FROMALT', 0x6d: 'OP_2DROP',
    0x6e: 'OP_2DUP', 0x73: 'OP_IFDUP', 0x75: 'OP_DROP', 0x76: 'OP_DUP', 0x77: 'OP_NIP', 0x78: 'OP_OVER',
    0x79: 'OP_PICK', 0x7a: 'OP_ROLL', 0x7b: 'OP_ROT', 0x7c: 'OP_SWAP', 0x7d: 'OP_TUCK', 0x7e: 'OP_CAT',
    0x7f: 'OP_SPLIT', 0x80: 'OP_NUM2BIN', 0x81: 'OP_BIN2NUM', 0x82: 'OP_SIZE', 0x87: 'OP_EQUAL',
    0x88: 'OP_EQUALVERIFY', 0x8a: 'OP_INVOKE', 0x8b: 'OP_1ADD', 0x8c: 'OP_1SUB', 0x91: 'OP_NOT',
    0x92: 'OP_0NOTEQUAL', 0x93: 'OP_ADD', 0x94: 'OP_SUB', 0x9c: 'OP_NUMEQUAL', 0x9d: 'NUMEQVERIFY',
    0x9f: 'OP_LESSTHAN', 0xa0: 'OP_GREATERTHAN', 0xa1: 'LESSTHANOREQ', 0xa2: 'GREATERTHANOREQ',
    0xa5: 'OP_WITHIN', 0xb0: 'CHECKSIG', 0xb1: 'CHECKSIGVERIFY',
    0xc0: 'OP_INPUTINDEX', 0xc1: 'OP_ACTIVEBYTECODE', 0xc4: 'OP_TXOUTPUTCOUNT', 0xc6: 'OP_UTXOVALUE',
    0xc7: 'OP_UTXOBYTECODE', 0xc8: 'OP_OUTPOINTTXHASH', 0xca: 'OP_INPUTBYTECODE', 0xcc: 'OP_OUTPUTVALUE',
    0xcd: 'OP_OUTPUTBYTECODE', 0xce: 'OP_UTXOTOKENCATEGORY', 0xcf: 'OP_UTXOTOKENCOMMITMENT',
    0xd0: 'OP_UTXOTOKENAMOUNT', 0xd1: 'OP_OUTPUTTOKENCATEGORY', 0xd2: 'OP_OUTPUTTOKENCOMMITMENT',
    0xd3: 'OP_OUTPUTTOKENAMOUNT',
  };
  const from = Math.max(0, at.ip - 30);
  const instructions = at.instructions.slice(from, at.ip + 2)
    .map((instruction, offset) => `${from + offset}:${names[instruction.opcode] ?? String(instruction.opcode)}`)
    .join(' ');
  const stack = before.stack.slice(-6)
    .map((item) => `${item.length}:${binToHex(item).slice(-10)}`).join('|');
  return `before=${label(before)} at=${label(at)} err=${at.error} instr=[${instructions}] stack=[${stack}]`;
}

/**
 * The entry identity a frame's run publishes, as the refusal reporter resolves it.
 *
 * `reportCompositionRefusal` names a frame by the functionName of the run keyed to its master, so the trace reads
 * the same fact from the same place; a master the draft holds no run for is named by its own id.
 */
function traceRunFunctionName(draft: CompositionDraft, master: string): string {
  return draft.runs.find((run) => run.master === master)?.functionName ?? master;
}

/**
 * One frame's call records as the draft currently states them, for the hop trace.
 *
 * Each record names the callee its reference points at — the id the plan stated, or `?` for a reference that
 * points at no participant — and the reference itself: the unfilled sentinel (which a frame reads as a negative
 * input index), `none`, or the callee's input index once the derivation filled it.
 */
function traceCallRefs(draft: CompositionDraft, master: string): string {
  const byIndex = new Map(draft.layout.participants.map((placed) => [placed.index, placed.id]));
  return draft.blockOf(master).calls.map((call) => {
    const ref = call.calleeRef === UNFILLED_CALLEE_REF
      ? 'unfilled'
      : call.calleeRef === INDEX_NONE ? 'none' : String(call.calleeRef);
    const callee = byIndex.get(call.calleeRef) ?? '?';
    return `${callee}@${ref}->${binToHex(call.target).slice(0, 8)}`;
  }).join(' ');
}

/**
 * The reading a settle got from the evaluated frame's own program: the close it left, or why its stop is not one.
 *
 * A refusal's attributed reason names the frame the reporter picked, which can be another frame; the reading is the
 * evaluated frame's own result, so it tells a stop at a value the plan should have stated from a stop elsewhere.
 */
function traceReading(reading: DeclarationReading): string {
  return reading.ok
    ? `ok declaredLen=${reading.declared.length} computedLen=${reading.computed.length} `
      + `declared=${binToHex(reading.declared).slice(0, 40)} computed=${binToHex(reading.computed).slice(0, 40)}`
    : `stop reason=${reading.reason} opcode=${reading.opcode ?? 'none'} length=${reading.length ?? 'none'}`;
}

/** The category a frame's own events are emitted under: its own, or its caller's for a delegate frame. */
function calleeEventCategory(callees: readonly HopCallee[], callee: HopCallee): Uint8Array {
  const owner = callee.recordOwner === undefined ? undefined : callees[callee.recordOwner];
  return (owner ?? callee).category;
}

/**
 * Settles a hop's callee frames, every one or only those `only` names, from the plan its first attempt states.
 *
 * The implementation frame's own values are still its candidates here: no callee reads them. A plan stopped before
 * a site is settled this way to learn what the calls before it returned, settling only those calls' frames.
 * `entryWrites` is the entry's own writes as the first attempt states them, when the caller already planned them.
 */
async function settleHopCallees(
  options: SettleHopOptions,
  only?: ReadonlySet<number>,
  entryWrites: HopEntryWrites | undefined = options.entryWritesFor === undefined
    ? options.entryWrites : options.entryWritesFor(options.recordCommitments),
): Promise<CalleeSettlement> {
  const writtenCommitments = [...options.recordCommitments];
  if (options.callees === undefined || options.callees.length === 0) {
    return { retvals: new Map(), writeViews: new Map(), writeValues: new Map(), events: new Map() };
  }
  return settleCallees({
    vm: options.vm,
    artifacts: [
      options.proxyArtifact, options.implementationArtifact, ...options.callees.map((callee) => callee.artifact),
    ],
    callees: options.callees,
    maximumCommitmentBytes: options.maximumCommitmentBytes,
    ...(options.seed === undefined ? {} : { seed: options.seed }),
    ...(only === undefined ? {} : { only }),
    ...(options.deferCalleeFailures === true ? { deferFailures: true } : {}),
    planFor: (learned, calleeWriteViews, calleeWriteValues, calleeEvents) => options.planFor(
      writtenCommitments, entryWrites, entryWrites?.learningCandidates ?? [],
      options.eventCommitments, options.retvalPlaceholder ?? new Uint8Array(0), learned, calleeWriteViews,
      calleeWriteValues, calleeEvents),
  });
}

/**
 * The whole value a chunkable mapping write computed, read from the state its own pin stopped at.
 *
 * A body that writes such a value computes the bytes and their sha256, and its pin verifies that the transaction
 * carries a chunk NFT at the address that digest names. When the plan states no run — the value's width is not
 * known yet — the pin stops on the count it computed, and both the bytes and the digest are still operands on the
 * machine there. So the value is the stack operand whose sha256 is another operand, and the read is fail-closed:
 * an absent or ambiguous pair yields nothing, and the write keeps its unstated run and is refused as before. The plain
 * call path reads its callee frames' so too (`learnCalleeValue`).
 */
export function learnedValueFromClose(vm: Machine, program: ShippedVmProgram): Uint8Array | undefined {
  const machine = vm as unknown as {
    boundedDebug?: (p: ShippedVmProgram) => readonly { error?: string; stack: readonly Uint8Array[] }[];
    debug: (p: ShippedVmProgram) => readonly { error?: string; stack: readonly Uint8Array[] }[];
  };
  let trace: readonly { error?: string; stack: readonly Uint8Array[] }[];
  try {
    trace = machine.boundedDebug?.(program) ?? machine.debug(program);
  } catch {
    return undefined;
  }
  const failed = trace.findIndex((state) => state.error !== undefined);
  if (failed <= 0) return undefined;
  const stack = trace[failed - 1]!.stack;
  const digests = new Set(stack.filter((operand) => operand.length === 32).map((operand) => bytesToHex(operand)));
  const seen = new Set<string>();
  let found: Uint8Array | undefined;
  for (const operand of stack) {
    if (operand.length <= VALUE_INLINE_LIMIT) continue;
    const hex = bytesToHex(operand);
    if (seen.has(hex)) continue;
    seen.add(hex);
    if (!digests.has(bytesToHex(sha256(operand)))) continue;
    if (hopTraceOn()) hopTrace(`value-probe match bytes=${operand.length} digest=${bytesToHex(sha256(operand))}`);
    if (found !== undefined) return undefined;
    found = operand;
  }
  if (found === undefined && hopTraceOn()) {
    hopTrace(`value-probe missing stack=${stack.length} largeValues=${seen.size} digests=${digests.size}`);
  }
  return found === undefined ? undefined : Uint8Array.from(found);
}

/**
 * Derives a delegate hop and learns what its entry computed.
 *
 * The state the entry leaves is not something the caller can state in advance — the entry computes it — so the plan
 * carries a candidate per record, per event and for the implementation frame's `retval`, and the machine is asked
 * whether the entry's own frame accepted it: the entry closes its record against the declaration the plan wrote,
 * compares each event payload against its output's commitment and compares what its own `return` built against the
 * `retval` slot, so a failed comparison leaves both the declaration and the computed value on the stack. Each
 * attempt rebuilds the plan with the value that was read, so a writing, emitting or returning entry converges in one
 * step per value it computes and a read-only entry is accepted on the first attempt. Each send the entry pays is
 * learned the same way, its lock and its amount from the body's own pin.
 */
async function settleHop(options: SettleHopOptions): Promise<SettledHop> {
  const { vm, proxyArtifact, implementationArtifact } = options;
  const trace = hopTraceOn();
  let writtenCommitments = [...options.recordCommitments];
  let writtenEvents = [...options.eventCommitments];
  let learnedRetval = options.retvalPlaceholder;
  let learnedSends = unlearnedHopSends(options.value);
  // The value a chunkable mapping write computed, once the body's own pin close exposed it; absent until learned.
  let learnedValue: Uint8Array | undefined;
  let entryWrites = options.entryWritesFor === undefined
    ? options.entryWrites
    : options.entryWritesFor(writtenCommitments, learnedValue);
  // The declaration a value-dependent write closed against is learned once; the candidate it started from is that
  // declaration's identity, so a re-planned entry — one whose run the record's own length widened — keeps what an
  // earlier attempt learned.
  const learnedExtras = new Map<string, Uint8Array>();
  // A plan stopped before a site that reads a node the entry's own write before it leaves at bytes no fact states
  // (`EntryWriteValueAwaited`) is settled for those bytes alone. They are handed back as soon as the settle has them:
  // the first close of the node is the one in the segment the write lands in, before the site, while the segments
  // the stopped plan declares past it may close the node again. Bytes the entry's write plan states are handed back
  // once the entry meets the stop.
  const awaited = options.refusedSite instanceof EntryWriteValueAwaited ? options.refusedSite : undefined;
  const awaitedLearned = (): EntryWriteValueLearned | undefined => {
    if (awaited === undefined) return undefined;
    const value = settledWriteValue(implementationArtifact, entryWrites,
      (candidate) => learnedExtras.get(bytesToHex(candidate)), awaited.collection, awaited.slot);
    if (value === undefined) return undefined;
    if (trace) hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=learned-entry-write ${awaited.collection}`);
    return new EntryWriteValueLearned(awaited.collection, awaited.slot, value);
  };
  let maximumAttempts = MAXIMUM_HOP_ATTEMPTS;
  // The callees are settled first: the implementation frame's call records carry what each callee's own body
  // computed, so the plan cannot state the caller's records until the callees have answered.
  const artifacts: readonly Artifact[] =
    [proxyArtifact, implementationArtifact, ...(options.callees ?? []).map((callee) => callee.artifact)];
  const calleeSettlement = await settleHopCallees(options, undefined, entryWrites);
  const calleeRetvals = calleeSettlement.retvals;
  const calleeWriteViews = calleeSettlement.writeViews;
  const calleeWriteValues = calleeSettlement.writeValues;
  const calleeEvents = calleeSettlement.events;
  // A callee the full settle deferred: the entry is still derived and evaluated below, so a check the entry fails
  // before reaching that callee names its own reason. The deferred verdict is thrown only when the entry does not
  // refuse, i.e. when the callee that refused is the entry's own failure after all.
  const deferredCalleeFailure = calleeSettlement.deferred;
  let composed: ReturnType<typeof createComposedDerivationHost> | undefined;
  // The derivation an attempt already ran, so a hop that settled inside the loop is not derived a second time:
  // the draft's blocks keep the references the first derivation filled, and a rerun would read them as settled.
  let derivedInLoop: ReturnType<typeof deriveComposition> | undefined;
  for (let attempt = 0; attempt < MAXIMUM_HOP_ATTEMPT_CAP; attempt += 1) {
    const extras = entryWrites?.learningCandidates ?? [];
    const writtenExtras = extras.map((candidate) => learnedExtras.get(bytesToHex(candidate)) ?? candidate);
    // One step per value the entry computes, plus the attempt that is accepted once every value is stated. The
    // plan is re-taken from the commitments in hand, so a run a record's own declaration sizes widens the budget
    // when it is learned; the cap above only bounds a plan that never learns.
    maximumAttempts = Math.max(
      MAXIMUM_HOP_ATTEMPTS,
      writtenCommitments.length + extras.length + writtenEvents.length
        + (options.retvalPlaceholder === undefined ? 0 : 1) + 1
        // A lock and an amount per send, and the attempt that drops the sends a branch skipped.
        + (options.value === undefined ? 0 : 2 * options.value.sendCount + 1),
    );
    if (attempt >= maximumAttempts) break;
    const plan = options.planFor(
      writtenCommitments, entryWrites, writtenExtras, writtenEvents, learnedRetval ?? new Uint8Array(0),
      calleeRetvals, calleeWriteViews, calleeWriteValues, calleeEvents, learnedSends);
    const candidate = createComposedDerivationHost({ vm, artifacts, plan });
    // A plan stopped before the site its failure is met at states only the calls before it, so the entry's calls
    // from that site on are declared unbound: a body that holds its call count runs to its own stop.
    if (options.refusedSite !== undefined) {
      declareUnstatedCalls(candidate.draft, implementationArtifact, IMPLEMENTATION_MASTER_ID);
    }
    if (trace) {
      hopTrace(`attempt entry=${IMPLEMENTATION_MASTER_ID} `
        + `${traceFrameFacts(IMPLEMENTATION_MASTER_ID, traceRunFunctionName(candidate.draft, IMPLEMENTATION_MASTER_ID),
          FrameKind.DELEGATE)} n=${attempt} `
        + `refs-before=[${traceCallRefs(candidate.draft, IMPLEMENTATION_MASTER_ID)}]`);
    }
    // A plan may leave a written view unstated - a value the frame's own body computes - and the composer declares a
    // placeholder for it, which the body's close then fails against. The derivation above resumes a run at a site it
    // reaches and learns there, but a draft it never got that far on hands the machine a placeholder, so a frame
    // that would otherwise accept is read as a frame that refused. Learning here is what leaves the program this
    // attempt is judged on with its declarations stated, exactly as a callee frame is treated before it is evaluated.
    candidate.draft.learnUnstatedViews();
    const implementationProgram = candidate.draft.programFor(IMPLEMENTATION_MASTER_ID);
    const state = vm.evaluate({
      inputIndex: participant(candidate.draft.layout, IMPLEMENTATION_MASTER_ID).index,
      sourceOutputs: implementationProgram.sourceOutputs,
      transaction: implementationProgram.transaction,
    });
    if (vm.stateSuccess(state) === true) {
      if (trace) hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=accepted`);
      composed = candidate;
      break;
    }
    // A frame that makes calls only reaches its own close once the derivation has bound each call to its callee and
    // derived it, so the hop is derived here rather than read from a program that is still missing its callees.
    if (options.callees !== undefined && options.callees.length > 0) {
      try {
        derivedInLoop = deriveComposition([options.root], candidate.host);
        if (trace) {
          hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=derived `
            + `refs-after=[${traceCallRefs(candidate.draft, IMPLEMENTATION_MASTER_ID)}]`);
        }
        composed = candidate;
        break;
      } catch (error) {
        // The frame stopped on a declaration it has to be told; it is read below like any other.
        if (trace) {
          hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=stall:${hopTraceError(error)} `
            + `refs-after=[${traceCallRefs(candidate.draft, IMPLEMENTATION_MASTER_ID)}]`);
        }
      }
    }
    // A call record names its callee's input, and only a derivation fills that reference: a program read before the
    // attempt stops on the unfilled reference rather than on a declaration the body closed against. The draft's own
    // program is therefore read once the attempt has run, so a value the entry computed past a call is still read
    // from the close that compared it.
    const readingProgram = candidate.draft.programFor(IMPLEMENTATION_MASTER_ID);
    const reading = readComputedDeclaration({
      vm, program: readingProgram,
      maximumCommitmentBytes: options.maximumCommitmentBytes,
    });

    // A returning entry compares what its own `return` built against the frame's `retval` slot, which leaves the
    // slot as the operand below that blob: the plan's candidate sits where the close's `computed` operand is, and
    // the blob the body computed is the `declared` one. A record or event close leaves them the other way round, so
    // the `retval` is read here before the candidates below are matched.
    if (reading.ok && options.retvalPlaceholder !== undefined
      && bytesEqual(reading.computed, options.retvalPlaceholder)) {
      if (trace) hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=learned-retval`);
      learnedRetval = Uint8Array.from(reading.declared);
      continue;
    }
    if (reading.ok && options.retvalPlaceholder !== undefined
      && bytesEqual(reading.declared, options.retvalPlaceholder)) {
      if (trace) hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=learned-retval`);
      learnedRetval = Uint8Array.from(reading.computed);
      continue;
    }
    // The declaration the failing comparison closed against is the candidate one of the records, of the entry's
    // own computed writes, or of the events carries, and that is what names the value the entry computed: the plan
    // states a candidate for every one of them and the body compares them in the order the frame declares them, so
    // each attempt learns the first one whose computed value the plan had not stated yet. A body that writes two
    // records and emits one event takes three attempts. A skipped emit closes its output's commitment against the
    // empty payload above it, which no record or write declares, so that close is read first.
    const eventClose = reading.ok ? eventCloseOf(reading, writtenEvents) : undefined;
    const skippedEvent = eventClose !== undefined && reading.ok && reading.declared.length === 0;
    const learned = reading.ok && !skippedEvent
      ? writtenCommitments.findIndex((stated) => bytesEqual(reading.declared, stated))
      : -1;
    const learnedExtra = reading.ok && !skippedEvent && learned < 0
      ? writtenExtras.findIndex((stated) => bytesEqual(reading.declared, stated))
      : -1;
    const learnedEvent = learned < 0 && learnedExtra < 0 ? eventClose?.position ?? -1 : -1;
    // A send's pin compares the lock and the amount the body computed with the output the plan listed for it.
    const sendsLearned = reading.ok && learned < 0 && learnedExtra < 0 && learnedEvent < 0 && options.value !== undefined
      ? learnHopSend(options.value, learnedSends, reading)
      : undefined;
    // A chunkable mapping write whose value the artifact does not publish: the plan states no run, so the body's
    // own pin stops on the chunk count it computed, and the value and its digest are operands at that stop. Learn
    // the value and re-plan the write, which then lays the run of chunk records the value's length names.
    if (reading.ok && learnedValue === undefined && entryWrites?.awaitsValue === true
      && learned < 0 && learnedExtra < 0 && learnedEvent < 0 && sendsLearned === undefined) {
      const value = learnedValueFromClose(vm, readingProgram);
      if (value !== undefined) {
        if (trace) hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=learned-chunk-value len=${value.length}`);
        learnedValue = value;
        entryWrites = options.entryWritesFor?.(writtenCommitments, learnedValue) ?? entryWrites;
        const ready = awaitedLearned();
        if (ready !== undefined) throw ready;
        continue;
      }
      // The body computed a chunkable value the close did not expose, so the run's width stays unstated: refuse by
      // name rather than lay a run the body's own pin would not address.
      throw new FramedProxyDeployError(
        `the implementation's ${options.entryLabel} writes mapping "${entryWrites.collection ?? '<unnamed>'}" a `
        + 'value whose source the artifact does not publish, so this hop cannot tell whether the write needs value '
        + 'chunks',
      );
    }
    // A run that left no close to read and made fewer sends than the plan lists stopped at its count: the sends past
    // the ones it pinned are on branches it did not take, and the plan drops them.
    const madeSends = !reading.ok && options.value !== undefined ? madeHopSends(options.value, learnedSends) : undefined;
    if (madeSends !== undefined) {
      if (trace) hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=made-sends count=${madeSends.length}`);
      learnedSends = madeSends;
      continue;
    }
    if (!reading.ok || (learned < 0 && learnedExtra < 0 && learnedEvent < 0 && sendsLearned === undefined)) {
      // The entry's frame refused before it closed anything, so the reading only says where it stopped. The
      // machine's verdict is paired with the artifacts' own publication to attribute the entry's reason: the
      // refusing frame is named, and for a dispatched body its `debug.functionDebug` requirement is the message.
      const refusal = reportCompositionRefusal({
        draft: candidate.draft, artifacts, vm, reached: [IMPLEMENTATION_MASTER_ID],
      });
      // A callee's deferred refusal is met before the entry's own stop only below a call the entry made (spec V6): a
      // check the entry fails before that call is its own stop, whatever reason it names. A stop on an unfilled
      // reference of the entry's own is where the derivation stopped binding, and the deferred refusal stands.
      if (deferredCalleeFailure !== undefined) {
        const metFirst = deferredRefusalMetFirst({
          draft: candidate.draft, vm, entry: IMPLEMENTATION_MASTER_ID, report: refusal,
          callees: options.callees ?? [], deferred: calleeSettlement.deferredFrames,
        });
        if (metFirst !== undefined) throw metFirst;
      }
      // A plan stopped before the site its failure is met at states no record for that site's call: an entry that
      // reaches it meets the failure there, and one that stops first is reported by its own stop below.
      if (options.refusedSite !== undefined && entryMeetsRefusedSite({
        draft: candidate.draft, vm, entry: IMPLEMENTATION_MASTER_ID, report: refusal,
      })) throw awaitedLearned() ?? options.refusedSite;
      const attributed = refusal.innermost === undefined
        ? describeReading(reading, writtenCommitments[0] ?? new Uint8Array(0))
        : describeInnermost(refusal.innermost);
      // The reporter names the refusal the execution meets first, which a frame below the implementation can be; the
      // frame this settle evaluated is named beside it so the failing frame is not read off the reporter alone.
      const failing = trace && refusal.innermost !== undefined
        && refusal.innermost.master !== IMPLEMENTATION_MASTER_ID
        ? `frame "${IMPLEMENTATION_MASTER_ID}" of `
          + `${traceRunFunctionName(candidate.draft, IMPLEMENTATION_MASTER_ID)} `
          + `(${frameKindName(FrameKind.DELEGATE)}) did not accept; the refusal reporter named ${attributed}`
        : attributed;
      if (trace) {
        hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=refused evaluated=${IMPLEMENTATION_MASTER_ID} `
          + `reported=${refusal.innermost?.master ?? 'none'} ip=${refusal.innermost?.ip ?? 'none'} `
          + `refs=[${traceCallRefs(candidate.draft, IMPLEMENTATION_MASTER_ID)}]`);
        hopTrace(`close entry=${IMPLEMENTATION_MASTER_ID} reason=${attributed}`);
        hopTrace(`reading entry=${IMPLEMENTATION_MASTER_ID} ${traceReading(reading)}`);
        hopTrace(`entry-stop ${IMPLEMENTATION_MASTER_ID} ${traceStopInstructions(vm, readingProgram)}`);
      }
      throw new FramedProxyDeployError(
        `the implementation's ${options.entryLabel} did not settle through the proxy: ${failing}`
        + sizedRunClause(entryWrites),
        refusal.innermost?.reason.arguments,
      );
    }
    if (learned >= 0) {
      if (trace) hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=learned-record nft=${learned}`);
      writtenCommitments = writtenCommitments.map((previous, nftIndex) =>
        (nftIndex === learned ? Uint8Array.from(reading.computed) : previous));
      entryWrites = options.entryWritesFor?.(writtenCommitments, learnedValue) ?? entryWrites;
    } else if (learnedExtra >= 0) {
      if (trace) hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=learned-write at=${learnedExtra}`);
      learnedExtras.set(bytesToHex(extras[learnedExtra]!), Uint8Array.from(reading.computed));
      const ready = awaitedLearned();
      if (ready !== undefined) throw ready;
    } else if (learnedEvent >= 0) {
      if (trace) hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=learned-event at=${learnedEvent}`);
      writtenEvents = writtenEvents.map((previous, emitIndex) =>
        (emitIndex === learnedEvent ? eventClose!.payload : previous));
    } else {
      if (trace) hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=learned-send`);
      learnedSends = sendsLearned!;
    }
  }
  if (composed === undefined) {
    if (trace) hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=exhausted attempts=${maximumAttempts}`);
    if (deferredCalleeFailure !== undefined) {
      throw firstDeferredRefusal(options.callees ?? [], calleeSettlement.deferredFrames) ?? deferredCalleeFailure;
    }
    if (options.refusedSite !== undefined) throw options.refusedSite;
    throw new FramedProxyDeployError(
      `the implementation's ${options.entryLabel} did not settle through the proxy in `
      + `${maximumAttempts} attempts${sizedRunClause(entryWrites)}`,
    );
  }
  // A callee that refused can only be one the entry's own body reaches and fails at, which the loop above reports
  // itself; an entry that accepted with a deferred callee would broadcast a frame that refused, so it is refused.
  if (deferredCalleeFailure !== undefined) {
    throw firstDeferredRefusal(options.callees ?? [], calleeSettlement.deferredFrames) ?? deferredCalleeFailure;
  }
  // A plan stopped before the site its failure is met at is never broadcast: an entry that settled on it did not
  // stop before that site, so the failure stands.
  if (options.refusedSite !== undefined) throw awaitedLearned() ?? options.refusedSite;
  const { host, draft } = composed;
  // The entry's frame accepted against every value the plan learned, so a stall here is the hop's own shape: the
  // proxy's forwarded call records no result of its own, so it binds the call record's result to empty while the
  // implementation frame's `retval` is the value its body computed, and the two cannot both hold. That shape cannot
  // carry a returning entry, and it is named as such rather than reported as an anonymous stalled derivation.
  let derived: ReturnType<typeof deriveComposition>;
  if (derivedInLoop !== undefined) {
    derived = derivedInLoop;
  } else try {
    derived = deriveComposition([options.root], host);
  } catch (error) {
    if (options.retvalPlaceholder !== undefined && error instanceof FramedComposerError
      && error.code === 'FRAMED_DERIVATION_STALLED') {
      throw new FramedProxyDeployError(
        `the implementation's ${options.entryLabel} returns a value, which a call through this proxy hop does not `
        + 'carry: the proxy\'s fallback records the delegated call without a result, so the hop binds that record\'s '
        + 'result to empty while the implementation frame records the value it computed. A proxy whose fallback '
        + `carries the delegated call's result does carry it. (${error.message})`,
      );
    }
    throw error;
  }
  requireLearnedViews(draft);
  if (trace) {
    hopTrace(`stop root=${PROXY_MASTER_ID} reason=derived `
      + `refs-after=[${traceCallRefs(draft, PROXY_MASTER_ID)}]`);
  }

  // The genesis mints the proxy master rather than running it, so its program is read from the implementation
  // master, whose evaluation carries the whole transaction including the minted output.
  const program = draft.programFor(options.genesis === true ? IMPLEMENTATION_MASTER_ID : PROXY_MASTER_ID);
  // The proxy's containers the implementation's sends are paid from follow the caller's coin, and the machine is
  // asked about them too.
  const containerInputs = options.value === undefined ? []
    : hopPaying(options.value, learnedSends, proxyArtifact.contractName).spent.map((_utxo, position) => ({
      id: hopContainerId(position), index: draft.layout.participantCount + 1 + position,
    }));
  // A leading input is the funder's coin, signed over the real transaction at the broadcast, as a caller's coin is.
  const conventionInputs = draft.layout.participants.filter((placed) => placed.kind !== 'leading');
  const verdicts = [...conventionInputs, ...containerInputs].map((placed): InitializeVerdict => {
    const state = vm.evaluate({
      inputIndex: placed.index, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
    });
    return vm.stateSuccess(state) === true
      ? { id: placed.id, index: placed.index, accepted: true }
      : { id: placed.id, index: placed.index, accepted: false, objection: String(state.error) };
  });
  // Every participant is a convention input: the masters, the validator and the proxy's records, each spent under
  // the lock it was minted at.
  if (trace) {
    for (const verdict of verdicts) {
      if (!verdict.accepted) {
        hopTrace(`verdict id=${verdict.id} index=${verdict.index} objection=${verdict.objection ?? ''}`);
        hopTrace(`verdict-stop ${traceStopInstructions(vm, {
          inputIndex: verdict.index, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
        })}`);
      }
    }
  }
  return {
    draft, program, completed: derived.completed,
    verdicts, accepted: verdicts.every((verdict) => verdict.accepted),
    writtenCommitments: recordOutputs(draft, program, writtenCommitments), writtenEventCommitments: writtenEvents,
    retval: learnedRetval ?? new Uint8Array(0),
    calleeRetvals, calleeWriteViews, calleeWriteValues,
    ...(entryWrites === undefined ? {} : { entryWrites }),
    ...(options.value === undefined ? {} : { sends: learnedSends }),
  };
}

/**
 * The result each planned call produced, keyed by the callsite that made it.
 *
 * A caller's condition reads an earlier call's result by its callsite id, and the result is exactly what the
 * callee frame's own `retval` carries once it is settled, decoded the way the callee's entry declares its returns.
 * A producer whose site the plan stated no call for, or whose frame recorded nothing the entry declares, is left
 * out: the hop does not fabricate a result for a call it did not place.
 */
export function producedCallResults(
  externalPlan: Pick<HopExternalPlan, 'conditionalProducers' | 'callsiteIds' | 'callBases' | 'calls' | 'callees'>,
  calleeRetvals: ReadonlyMap<string, Uint8Array>,
): Map<number, FunctionArgument> {
  const results = new Map<number, FunctionArgument>();
  for (const callsiteId of externalPlan.conditionalProducers) {
    const site = externalPlan.callsiteIds.indexOf(callsiteId);
    if (site < 0) continue;
    const base = externalPlan.callBases[site];
    if (base === undefined || base < 0) continue;
    const call = externalPlan.calls[base];
    if (call === undefined) continue;
    const callee = externalPlan.callees.find((candidate) => candidate.master === call.callee);
    if (callee === undefined) continue;
    // A proxied callee's own frame records nothing: it is the implementation frame that computed the value, so
    // the result decodes against that frame's artifact and the entry it ran.
    const producer = callee.retvalFrom === undefined ? callee : externalPlan.callees[callee.retvalFrom];
    if (producer === undefined) continue;
    const retval = calleeRetvals.get(producer.master);
    if (retval === undefined) continue;
    const entry = producer.artifact.abi.find((candidate) => candidate.name === producer.entry);
    const values = decodeReturnValues(
      retval, entry?.outputs ?? [], structDefinitionsOf(producer.artifact),
      entry?.resultEncoding, producer.artifact.enums,
    );
    if (values.length === 0) continue;
    results.set(callsiteId, (values.length === 1 ? values[0] : values) as FunctionArgument);
  }
  return results;
}

/** What names the sites a plan states calls for: its calls, each site's first call and each site's callsite id. */
type PlannedSites = Pick<HopExternalPlan, 'calls' | 'callBases' | 'callsiteIds'>;

/** True when two plans state the same calls for the same sites, so nothing a further pass learns can move them. */
export function samePlannedSites(left: PlannedSites, right: PlannedSites): boolean {
  return left.calls.length === right.calls.length
    && left.callBases.length === right.callBases.length
    && left.callsiteIds.length === right.callsiteIds.length
    && left.callBases.every((base, index) => base === right.callBases[index])
    && left.callsiteIds.every((id, index) => id === right.callsiteIds[index]);
}

/** The most stopped plans one hop settles before the plan states every call, so a plan that never completes ends. */
const MAXIMUM_PLAN_STOPS = 64;

/** A frame's identity across the plans of one hop: its path and the entry it runs, which master ids are not. */
function frameKey(callee: HopCallee): string {
  return `${callee.path}|${callee.functionName}`;
}

/** What settles of stopped plans learned about each frame, keyed by `frameKey`, which later plans start from. */
interface FrameLearning {
  readonly retvals: Map<string, Uint8Array>;
  readonly writeViews: Map<string, readonly (Uint8Array | undefined)[]>;
  readonly writeValues: Map<string, Uint8Array>;
  readonly events: Map<string, readonly Uint8Array[]>;
}

/** Keeps what a settle learned for the frames it settled, under each frame's own key. */
function keepFrameLearning(
  learning: FrameLearning, callees: readonly HopCallee[], settled: ReadonlySet<number>, from: CalleeSettlement,
): void {
  for (const index of settled) {
    const callee = callees[index]!;
    const key = frameKey(callee);
    const retval = from.retvals.get(callee.master);
    if (retval !== undefined) learning.retvals.set(key, retval);
    const views = from.writeViews.get(callee.master);
    if (views !== undefined) learning.writeViews.set(key, views);
    const value = from.writeValues.get(callee.master);
    if (value !== undefined) learning.writeValues.set(key, value);
    const events = from.events.get(callee.master);
    if (events !== undefined) learning.events.set(key, events);
  }
}

/** What a plan's frames start their settle from: the learning kept for each frame the plan places. */
function seedOf(learning: FrameLearning, callees: readonly HopCallee[]): CalleeSettlement {
  const seed: CalleeSettlement = {
    retvals: new Map(), writeViews: new Map(), writeValues: new Map(), events: new Map(),
  };
  for (const callee of callees) {
    const key = frameKey(callee);
    const retval = learning.retvals.get(key);
    if (retval !== undefined) seed.retvals.set(callee.master, retval);
    const views = learning.writeViews.get(key);
    if (views !== undefined) seed.writeViews.set(callee.master, views);
    const value = learning.writeValues.get(key);
    if (value !== undefined) seed.writeValues.set(callee.master, value);
    const events = learning.events.get(key);
    if (events !== undefined) seed.events.set(callee.master, events);
  }
  return seed;
}

/**
 * The callee indices a stopped plan settles to learn the results its waiting site reads: the frame each earlier
 * call names, and every frame below it.
 */
function producerFramesOf(externalPlan: HopExternalPlan, block: HopPlanBlock): Set<number> {
  const { callees } = externalPlan;
  const roots = new Set<number>();
  callees.forEach((callee, index) => {
    if (callee.origin?.callerPath === block.path && callee.origin.occurrence === 0
      && block.producers.includes(callee.origin.callsiteId)) roots.add(index);
  });
  const frames = new Set<number>();
  callees.forEach((_callee, index) => {
    for (let at: number | null = index; at !== null; at = callees[at]!.enteredBy) {
      if (roots.has(at)) {
        frames.add(index);
        break;
      }
    }
  });
  return frames;
}

/**
 * The frames to settle beside `frames`: every frame that writes a node one of them writes or touches, before it,
 * closed over.
 *
 * A frame's own declaration states the view of each node it writes, and a node created in this transaction is held
 * by no deployment the plan could read instead, so the frames whose writes state those views are settled first.
 */
function withNodeWriters(frames: Set<number>, callees: readonly HopCallee[]): Set<number> {
  const writing = calleeNodeWritersBefore(callees);
  for (let changed = true; changed;) {
    changed = false;
    for (const index of [...frames]) {
      for (const writer of writing.get(index) ?? []) {
        if (frames.has(writer)) continue;
        frames.add(writer);
        changed = true;
      }
    }
  }
  if (hopTraceOn()) {
    hopTrace(`frames-extended to=[${[...frames].map((index) => callees[index]?.master ?? '?').join(',')}]`);
  }
  return frames;
}

/**
 * The results the earlier calls a stopped plan's site reads returned, keyed by `reachedResultKey`.
 *
 * Each is what the callee frame the call's record names recorded in its `retval` (a proxy's fallback records its
 * delegate frame's), decoded the way that entry declares its returns.
 */
export function reachedCallResults(
  externalPlan: Pick<HopExternalPlan, 'callees'>, block: HopPlanBlock, calleeRetvals: ReadonlyMap<string, Uint8Array>,
): Map<string, FunctionArgument> {
  const results = new Map<string, FunctionArgument>();
  for (const callee of externalPlan.callees) {
    const origin = callee.origin;
    if (origin === undefined || origin.callerPath !== block.path || origin.occurrence !== 0
      || !block.producers.includes(origin.callsiteId)) continue;
    const producer = callee.retvalFrom === undefined ? callee : externalPlan.callees[callee.retvalFrom];
    const retval = producer === undefined ? undefined : calleeRetvals.get(producer.master);
    if (producer === undefined || retval === undefined) continue;
    const entry = producer.artifact.abi.find((candidate) => candidate.name === producer.entry);
    const values = decodeReturnValues(
      retval, entry?.outputs ?? [], structDefinitionsOf(producer.artifact), entry?.resultEncoding,
      producer.artifact.enums,
    );
    if (values.length === 0) continue;
    results.set(
      reachedResultKey(block.path, origin.callsiteId), (values.length === 1 ? values[0] : values) as FunctionArgument);
  }
  return results;
}

/** A learned result as the hop trace prints it: bytes as hex, every other value as text. */
function traceResultValue(value: unknown): string {
  if (value instanceof Uint8Array) return binToHex(value).slice(0, 40);
  if (Array.isArray(value)) return `[${value.map(traceResultValue).join(',')}]`;
  return String(value);
}

/**
 * Plans a hop's external calls in execution order and settles it, re-planning while an arm's condition waits on an
 * earlier result.
 *
 * A site whose argument or loop bound reads an earlier call's result is planned once that call has settled: the
 * planner stops before the site, the frames of the calls it reads are settled on the plan made so far, their results
 * are decoded, and the hop is planned again from them. Each stop learns at least one result no earlier stop learned,
 * from a frame whose own inputs are the execution's, so a refusal there is that frame's own verdict and is reported
 * as it stands. What a stop's settle learned seeds the same frames' settle in every later plan. A site of the entry
 * that reads a node the entry's own write before it leaves at bytes no published fact states waits the same way: the
 * hop is planned stopped before the site, the entry is settled on that plan up to its close of the node, and the hop
 * is planned again from the bytes that close rebuilt (`written-values.ts`).
 *
 * An arm gated on an earlier call's result is planned as before: the plan states the sites the caller's own facts
 * fix, the settle learns what each callee frame returned, and the next pass decides the gated arms from those
 * results. The loop stops when a pass's results leave the plan's sites unchanged, so the plan that is settled is the
 * one the execution's own arms imply; a plan that never stops changing is refused by name rather than settled. A hop
 * whose conditions, arguments and loop bounds read no earlier result is planned and settled exactly once.
 *
 * A refusal the planner raises or the cross-reach checks raise over its frames, and a failure of the frames a stop
 * settles, are reported as the execution meets them: the entry is settled up to the site the failure is met at, and
 * its own stop is reported when it stops before that site (`planning-refusal.ts`).
 */
async function planAndSettleHop(options: {
  readonly plan: (
    externalReturns: ReadonlyMap<number, FunctionArgument>, reachedResults: ReadonlyMap<string, FunctionArgument>,
    calleeWriteViews: ReadonlyMap<string, readonly (Uint8Array | undefined)[]>,
    calleeWriteValues: ReadonlyMap<string, Uint8Array>,
    heldContinuations?: boolean,
    stopBefore?: number,
  ) => Promise<HopExternalPlan>;
  readonly settle: (
    externalPlan: HopExternalPlan, seed?: CalleeSettlement, deferCalleeFailures?: boolean,
  ) => Promise<SettledHop>;
  /** Settles the named callee frames of a plan alone, from what `seed` states, and hands back what they computed. */
  readonly settleCallees: (
    externalPlan: HopExternalPlan, only: ReadonlySet<number>, seed: CalleeSettlement,
  ) => Promise<CalleeSettlement>;
}): Promise<{ readonly externalPlan: HopExternalPlan; readonly settled: SettledHop }> {
  // A node whose values chunk is not chained across frames, so a hop whose every frame settled beside such a chain
  // is refused by name once settled, before it is broadcast.
  const settledHop = (
    plan: HopExternalPlan, settled: SettledHop,
  ): { readonly externalPlan: HopExternalPlan; readonly settled: SettledHop } => {
    requireSettledNodeChains(plan.callees);
    return { externalPlan: plan, settled };
  };
  const trace = hopTraceOn();
  const reached = new Map<string, FunctionArgument>();
  const learning: FrameLearning = {
    retvals: new Map(), writeViews: new Map(), writeValues: new Map(), events: new Map(),
  };
  let externalReturns: ReadonlyMap<number, FunctionArgument> = new Map();
  /** The hop planned from what the settles so far learned, stopped before the entry's own site `stopBefore`. */
  const planStopped = (heldContinuations: boolean | undefined) => (stopBefore: number): Promise<HopExternalPlan> =>
    options.plan(externalReturns, reached, learning.writeViews, learning.writeValues, heldContinuations, stopBefore);
  /**
   * What a failure of the frames past a plan's stop leaves to report (spec V6): the entry's own stop, or a refusal
   * below a call it made, when it stops before the site that leads to them, and the failure itself otherwise.
   */
  const settledBefore = async (failure: unknown, stopped: HopExternalPlan | undefined): Promise<unknown> => {
    if (stopped === undefined) return failure;
    try {
      await options.settle(stopped, seedOf(learning, stopped.callees), true);
    } catch (error) {
      // Bytes the entry's own write leaves are what the settle learned, not where the entry stops.
      return error instanceof EntryWriteValueLearned ? failure : error;
    }
    return failure;
  };
  /** What a planning refusal leaves to report, settled before the first site whose frames the planner refuses. */
  const refusalMetFirst = async (refusal: unknown, heldContinuations?: boolean): Promise<unknown> => {
    if (!(refusal instanceof FramedProxyDeployError)) return refusal;
    return settledBefore(refusal, await planBeforeRefusedSite(planStopped(heldContinuations), refusal));
  };
  /**
   * What a failure of the frames a stop settles leaves to report, or undefined when the entry cannot be settled
   * before the site the failure is met at: a site of the entry's own meets it there, past the earlier calls it reads,
   * and a site of a frame below meets it inside the entry's site that leads to that frame.
   */
  const stopFailureMetFirst = async (
    failure: unknown, plan: HopExternalPlan, block: HopPlanBlock, frames: ReadonlySet<number>,
  ): Promise<Error | undefined> => {
    // An entry's own stop places every site before the one that waits, which is the next one.
    const site = block.path === '' ? plan.callBases.length : entrySiteOf(plan, frames);
    if (!(failure instanceof Error) || site === undefined) return undefined;
    const stopped = await planBeforeSite(planStopped(plan.heldContinuations), site, failure);
    if (stopped === undefined) return undefined;
    const verdict = await settledBefore(failure, stopped);
    return verdict instanceof Error ? verdict : failure;
  };
  /**
   * Learns the bytes the entry's own write before one of its sites leaves the node the site reads: the hop is planned
   * stopped before the site and the entry is settled on that plan, which closes the node on its way there. A settle
   * that hands no bytes back reports the entry's own stop before the site, or the site's refusal by name.
   */
  const learnEntryWriteValue = async (
    awaited: EntryWriteValueAwaited, heldContinuations: boolean | undefined,
  ): Promise<void> => {
    const key = entryWriteValueKey(awaited.collection, awaited.slot);
    const stopped = learning.writeValues.has(key)
      ? undefined : await planBeforeSite(planStopped(heldContinuations), awaited.site, awaited);
    if (stopped === undefined) throw await refusalMetFirst(awaited, heldContinuations);
    try {
      await options.settle(stopped, seedOf(learning, stopped.callees), true);
    } catch (error) {
      if (!(error instanceof EntryWriteValueLearned)) throw error;
      learning.writeValues.set(key, error.value);
      return;
    }
    // A plan stopped before a site is never settled whole, so a settle that returns learned nothing either.
    throw awaited;
  };
  /**
   * The hop planned from what the settles so far learned, a planning refusal reported as the execution meets it and a
   * site waiting on bytes the entry's own write leaves planned once a settle of the entry learned them.
   */
  const planHop = async (heldContinuations: boolean | undefined): Promise<HopExternalPlan> => {
    for (;;) {
      try {
        return await options.plan(
          externalReturns, reached, learning.writeViews, learning.writeValues, heldContinuations);
      } catch (error) {
        if (!(error instanceof EntryWriteValueAwaited)) throw await refusalMetFirst(error, heldContinuations);
        await learnEntryWriteValue(error, heldContinuations);
      }
    }
  };
  /** The cross-reach checks over a plan's frames, a refusal reported as the execution meets it. */
  const requireReachWrites = async (plan: HopExternalPlan): Promise<void> => {
    try {
      requireSatisfiableReachWrites(plan.callees);
    } catch (error) {
      throw await refusalMetFirst(error, plan.heldContinuations);
    }
  };
  let externalPlan = await planHop(undefined);
  /**
   * The hop planned once more for a frame that held a node an earlier frame created, or nothing when that plan does
   * not settle.
   *
   * The two readings of such a frame are the same declaration until a settle has run: a frame that rewrote the node
   * states an end view and the settle hands it back, while one that only held it states none. So the hop is planned
   * again with the held reading and that plan is the one the transaction is built from when it settles; nothing is
   * returned otherwise, which leaves the hop that was planned before in place.
   *
   * A settle that refused is worth this second plan too: a frame reads a node an earlier frame created against the
   * deployment, which does not hold the value that frame left, so a wrong read is exactly what a refusal of this
   * kind waits on. The held plan replaces a refusal only when it settles where the first did not.
   */
  const heldPlanOf = async (): Promise<
  { readonly externalPlan: HopExternalPlan; readonly settled: SettledHop } | undefined
  > => {
    // The held reading restates a declaration for a node an earlier frame of this hop wrote, whether this frame
    // reads or writes it. A created node is the shape no deployment holds: a hop without one is not planned again.
    if (![...writtenNodeWritersBefore(externalPlan.callees).values()].some((writers) => writers.length > 0)) {
      return undefined;
    }
    try {
      const heldPlan = await options.plan(
        externalReturns, reached, learning.writeViews, learning.writeValues, true);
      const heldSettled = await options.settle(heldPlan, seedOf(learning, heldPlan.callees), true);
      if (!heldSettled.accepted) return undefined;
      for (const [master, views] of heldSettled.calleeWriteViews) learning.writeViews.set(master, views);
      for (const [master, value] of heldSettled.calleeWriteValues) learning.writeValues.set(master, value);
      return { externalPlan: heldPlan, settled: heldSettled };
    } catch (error) {
      if (hopTraceOn()) hopTrace(`held-plan none reason=${hopTraceError(error)}`);
      return undefined;
    }
  };
  /** The hop the transaction is built from once the held reading has had its chance, falling back to `settled`. */
  const settleHeld = async (
    plan: HopExternalPlan, settled: SettledHop,
  ): Promise<{ readonly externalPlan: HopExternalPlan; readonly settled: SettledHop }> =>
    await heldPlanOf() ?? { externalPlan: plan, settled };
  /** The hop planned again from the bytes a settle learned an enclosing writer leaves (`enclosed-values.ts`). */
  const planFromEnclosingValue = async (learned: EnclosingValueLearned): Promise<HopExternalPlan> => {
    if (learning.writeValues.has(learned.master)) {
      throw new FramedProxyDeployError(
        `the frame "${learned.master}" still leaves its write unstated after the hop learned the value its own run `
        + 'exposed, so the frames it encloses cannot start from it',
      );
    }
    learning.writeValues.set(learned.master, learned.value);
    const writer = externalPlan.callees.find((callee) => callee.master === learned.master);
    if (writer !== undefined) learning.writeValues.set(frameKey(writer), learned.value);
    return options.plan(
      externalReturns, reached, learning.writeViews, learning.writeValues, externalPlan.heldContinuations);
  };
  let stops = 0;
  for (let pass = 0; ;) {
    const block = externalPlan.blocked;
    if (block !== undefined) {
      if (stops >= MAXIMUM_PLAN_STOPS) {
        throw new FramedProxyDeployError(
          `the hop stopped its plan ${stops} time(s) to learn earlier calls' results and still waits on `
          + `${block.where}, so the plan does not complete`,
        );
      }
      const { callees } = externalPlan;
      // The calls before the waiting site are planned from values the execution computes, so a pair of reaches the
      // transaction cannot carry is refused here, before anything is settled for it.
      await requireReachWrites(externalPlan);
      // The frames whose views a producer starts from are settled with it (`reentrySettleBefore`).
      const frames = withReentryFrames(producerFramesOf(externalPlan, block), callees);
      const seed = seedOf(learning, callees);
      if (trace) {
        const masters = [...frames].map((index) => callees[index]!.master);
        hopTrace(`stop-plan n=${stops} path=${block.path === '' ? '<entry>' : block.path} reads=${block.reads} `
          + `producers=[${block.producers.join(',')}] settle=[${masters.join(',')}]`);
      }
      let planned = externalPlan;
      let settlement: CalleeSettlement;
      try {
        settlement = await options.settleCallees(planned, frames, seed);
      } catch (error) {
        if (error instanceof EnclosingValueLearned) {
          externalPlan = await planFromEnclosingValue(error);
          continue;
        }
        // A producer frame refused. A frame that reads a node an earlier frame created is planned against the
        // deployment, which does not hold the value that frame left, so the hop is planned once more with the held
        // reading, the frames that wrote those nodes are settled first, and the producers are settled again from
        // what they left: the held plan carries on when it settles where the first did not.
        const held = await options.plan(
          externalReturns, reached, learning.writeViews, learning.writeValues, true);
        const heldFrames = withNodeWriters(new Set(frames), held.callees);
        try {
          const writers = new Set([...heldFrames].filter((index) => !frames.has(index)));
          if (writers.size > 0) {
            keepFrameLearning(learning, held.callees, writers,
              await options.settleCallees(held, writers, seed));
          }
          settlement = await options.settleCallees(held, frames, seedOf(learning, held.callees));
          planned = held;
        } catch (heldError) {
          if (hopTraceOn()) hopTrace(`held-plan none reason=${hopTraceError(heldError)}`);
          // Its verdict is not the execution's on its own: the entry's own frame is derived and evaluated on the
          // same plan, with the callee verdicts deferred, so a check the entry fails before the stopped site names
          // the entry's reason. That evaluation throws the entry's own reason when it has one and the deferred
          // producer refusal otherwise, so the producer's verdict stands when the entry names no source reason of
          // its own. A body that holds its call count stops at that count on a plan stopped short of its calls, so
          // the entry is settled before the site the refusal is met at, with its calls from there declared.
          const metFirst = await stopFailureMetFirst(error, externalPlan, block, frames);
          if (metFirst !== undefined) throw metFirst;
          await options.settle(externalPlan, seed, true);
          throw error;
        }
      }
      keepFrameLearning(learning, planned.callees, frames, settlement);
      let results: Map<string, FunctionArgument>;
      try {
        results = reachedCallResults(planned, block, settlement.retvals);
      } catch (error) {
        // A result the hop cannot decode is met only where the execution reaches the site that reads it.
        throw await stopFailureMetFirst(error, planned, block, frames) ?? error;
      }
      const before = reached.size;
      for (const [key, value] of results) reached.set(key, value);
      if (trace) {
        hopTrace(`stop-plan n=${stops} learned=[${[...results]
          .map(([key, value]) => `${key}:${traceResultValue(value)}`).join(' ')}]`);
      }
      if (reached.size === before) {
        const failure = new FramedProxyDeployError(
          `${block.where} reads the result of the earlier call(s) ${block.producers.join(', ')}, and settling them `
          + 'returned nothing the hop could decode, so the call cannot be planned from it',
        );
        throw await stopFailureMetFirst(failure, planned, block, frames) ?? failure;
      }
      stops += 1;
      externalPlan = await planHop(planned.heldContinuations);
      continue;
    }
    // Every reach's own write was planned on its own; the reaches are checked together here, before any frame of
    // this plan is settled, so a shape whose reaches cannot share one transaction is refused by name rather than
    // derived into a transaction the network rejects.
    await requireReachWrites(externalPlan);
    // The callee verdicts are deferred: the entry's own frame is derived and evaluated even when a callee refused,
    // so a check the entry fails before it reaches that callee names the entry's reason. A settle that finds no
    // such reason throws the deferred callee refusal, which is the execution's verdict then.
    let settled: SettledHop;
    try {
      settled = await options.settle(
        externalPlan, stops === 0 ? undefined : seedOf(learning, externalPlan.callees), true);
    } catch (error) {
      if (error instanceof EnclosingValueLearned) {
        externalPlan = await planFromEnclosingValue(error);
        continue;
      }
      // A frame that reads a node an earlier frame created is planned against the deployment, which does not hold
      // the value that frame left, so the hop is planned once more for the held reading and kept only when it
      // settles: a refusal that is not about such a read is thrown as it was.
      const held = await heldPlanOf();
      if (held !== undefined) return settledHop(held.externalPlan, held.settled);
      throw error;
    }
    // The end views this settle learned tell a later pass what a node a frame created holds: a reach planned after
    // one of them continues from that view rather than from the placeholder the plan started it with.
    for (const [master, views] of settled.calleeWriteViews) learning.writeViews.set(master, views);
    for (const [master, value] of settled.calleeWriteValues) learning.writeValues.set(master, value);
    if (externalPlan.conditionalProducers.length === 0) {
      const final = await settleHeld(externalPlan, settled);
      return settledHop(final.externalPlan, final.settled);
    }
    externalReturns = producedCallResults(externalPlan, settled.calleeRetvals);
    const next = await planHop(false);
    if (next.blocked === undefined && samePlannedSites(next, externalPlan)) {
      const final = await settleHeld(externalPlan, settled);
      return settledHop(final.externalPlan, final.settled);
    }
    if (pass >= externalPlan.conditionalProducers.length) {
      throw new FramedProxyDeployError(
        'the entry\'s arms an earlier call\'s result decides did not settle: the hop re-planned '
        + `${pass + 1} time(s) without its sites stopping`,
      );
    }
    pass += 1;
    externalPlan = next;
  }
}

/**
 * The refusal's own words for a run the entry's record sizes, naming the width it was laid at.
 *
 * A run whose width comes from a stated fact rather than a resolved element is the one shape whose refusal is not
 * about a value: the record asked the body for a length, or the artifact stated the elements the write appends, and
 * the run laid at that width is not the run the body pinned.
 */
function sizedRunClause(entryWrites: HopEntryWrites | undefined): string {
  const sized = entryWrites?.sizedRun;
  if (sized === undefined) return '';
  return `, and the run it declares for dynamic "${sized.variable}" is ${sized.chunks} chunk(s), sized from `
    + (sized.from === 'growth'
      ? 'the elements the entry\'s own write appends'
      : "the length the record's own declaration states");
}

/** Everything the hop's plan is built from, whether the hop is a deployment's first call or a user's later one. */
interface HopPlanOptions {
  /** The chain the hop settles against, which fixes the transaction's locktime. */
  readonly provider: NetworkProvider;
  /** The proxy the call is entered on: the caller's, or the one generated for the implementation. */
  readonly proxyArtifact: Artifact;
  readonly implementationArtifact: Artifact;
  readonly implementationMaster: DeployedMaster;
  readonly proxyMaster: DeployedMaster;
  readonly proxyCategory: Uint8Array;
  readonly implementationCategory: Uint8Array;
  /** The entry the proxy forwards to, and its arguments in parameter order. */
  readonly entry: { readonly functionName: string; readonly args?: readonly FunctionArgument[] };
  /**
   * The external calls the entry's own body makes, in the order it reaches them, and the callee frames they reach.
   *
   * A framed body binds each external call to its own frame's k-th record, so the delegate frame states one
   * record per call and runs each callee as a frame of its own.
   */
  readonly calls?: readonly DraftCall[];
  /** For each published call site of the entry, the position of its first call in `calls`, or `-1` for none. */
  readonly callBases?: readonly number[];
  readonly callees?: readonly HopCallee[];
  /**
   * The end commitment learned for each callee frame's value-dependent write record, keyed by master, in that
   * frame's `learningCandidates` order. Absent leaves every candidate at the placeholder the planner stated.
   */
  readonly calleeWriteViews?: ReadonlyMap<string, readonly (Uint8Array | undefined)[]>;
  /**
   * The whole value a callee frame's own chunkable mapping write computed, keyed by master.
   *
   * Such a write is planned with its run unstated, because the value is the frame's own body's to compute; once a
   * settle has read that value from the frame's close, the write is planned again from it here, so the run of
   * chunk records the frame must declare is the one its body addresses. Absent leaves every run unstated.
   */
  readonly calleeWriteValues?: ReadonlyMap<string, Uint8Array>;
  /**
   * The compute side-cars each frame of this hop co-spends, keyed by the master whose body reads them.
   *
   * A frame that hashes a runtime value or recovers a signer reads one side-car input per call immediately after
   * its own input, and every side-car a master names is placed in the block that owns it, in the order the body
   * reads them. A frame that reads none states none, and its block lays out exactly as before.
   */
  readonly sideCars?: ReadonlyMap<string, RecoverySideCars>;
  /** The bytes each callee frame's `retval` carries: what a returning callee computed, or its candidate. */
  readonly calleeRetvals?: ReadonlyMap<string, Uint8Array>;
  /**
   * The payload each event a callee frame emits carries, keyed by master in emit order.
   *
   * A frame the hop runs is a frame whose own body may emit, and the caller's plan has to state one output per
   * event the frame emits or the frame's own emit-count check fails. The payload is the body's to compute, so the
   * caller states the sentinel and the frame's own comparison hands back what it computed; an absent entry leaves
   * the callee's events at their sentinels.
   */
  readonly calleeEventCommitments?: ReadonlyMap<string, readonly Uint8Array[]>;
  /** The largest value a commitment may carry, which a callee event's sentinel is sized against. */
  readonly maximumCommitmentBytes?: number;
  /** The records the entry's own body writes beyond the data-NFT records, or absent when it writes none. */
  readonly entryWrites?: HopEntryWrites;
  /** The mapping nodes the entry only reads, in the order its code reads them, as a callee frame's are planned. */
  readonly readNodes?: readonly HopCalleeReadNode[];
  readonly recordCommitments: readonly Uint8Array[];
  /** The commitment each record is being asked to end at, which a writing entry's own computation replaces. */
  readonly writtenCommitments: readonly Uint8Array[];
  /** The end commitment learned for each value-dependent mapping node, in the entry's learning order. */
  readonly entryWriteViews: readonly Uint8Array[];
  /** True for the pass that states a held continuation the way the chain ends, once a settle has accepted. */
  readonly heldContinuations?: boolean;
  /** The end commitments learned for a callee frame's own data records, by record index. */
  /** The bytes the implementation frame's `retval` carries: what a returning entry computed, or its placeholder. */
  readonly implementationRetval: Uint8Array;
  /** The lock the records sit at: the data-NFT covenant the proxy's category derives. */
  readonly recordLockingBytecode: Uint8Array;
  /** The proxy's category as hex, which the records' write path names the authorizing master by. */
  readonly recordCategoryHex: string;
  /** The caller's own input value, and the values the masters, the validator and the records carry. */
  readonly callerSatoshis: bigint;
  readonly proxyMasterAmount: bigint;
  readonly implementationMasterAmount: bigint;
  readonly validatorAmount: bigint;
  /**
   * The satoshi value of the running validator's own pool for the genesis shape, where that validator is the first
   * callee's rather than the proxy's.
   */
  readonly genesisValidatorAmount?: bigint;
  /** One value per record, in data-NFT order. */
  readonly recordAmounts: readonly bigint[];
  /** The 25-byte P2PKH lock of the caller whose coin enters the frame. */
  readonly callerLockingBytecode: Uint8Array;
  /**
   * The lock of the genesis's own funding coin, which the genesis shape leads with. It differs from
   * `callerLockingBytecode` (the root frame's caller) because a minted root has no P2PKH caller.
   */
  readonly funderLockingBytecode?: Uint8Array;
  /** The genesis shape's identity: the proxy's authhead, which the funding coin's own index recreates as output 0. */
  readonly identity?: GenesisIdentity;
  /** One output per event the entry emits, in emit order, with the commitment it carries. */
  readonly eventOutputs: readonly HopEventOutput[];
  /**
   * The value the hop carries and the sends the implementation's frame lists, each lock and amount as learned so
   * far (`hop-value.ts`); absent for a hop that carries none and pays nothing.
   */
  readonly value?: { readonly hop: HopValue; readonly sends: readonly HopSend[] };
  /**
   * True for a plan stopped before one of its sites (`HopExternalPlan.blocked`): it states the entry's calls up to
   * that point only, so it settles the callee frames before it and is never derived or broadcast as a whole.
   */
  readonly truncated?: boolean;
  /**
   * True for the genesis-shape plan: the proxy master is minted as an output rather than spent, the proxy's records
   * are created rather than spent, and there is no caller coin: the funding coin leads the transaction and its index
   * recreates as the proxy's authhead (`identity`). The minted proxy root and every frame it enters carry an
   * `INDEX_NONE` origin.
   */
  readonly genesis?: boolean;
}

/** One event output a hop's delegate frame lists: the covenant lock the frame's context contract derives. */
interface HopEventOutput {
  readonly lockingBytecode: Uint8Array;
  /** The payload the entry computed, or the placeholder the derivation learns against. */
  readonly commitment: Uint8Array;
}

/**
 * One output per event an entry emits, in emit order.
 *
 * A delegate frame runs on the proxy's records, so the head's event walk checks each listed output against the
 * proxy's category and the frame's own body compares the payload it computed against the output's commitment.
 * The deployment therefore states the output with a placeholder and learns the payload from the entry's own
 * comparison, the way a genesis learns a constructor's event.
 */
function hopEventOutputs(
  artifact: Artifact,
  functionName: string,
  category: Uint8Array,
  commitments: readonly Uint8Array[],
  emits?: readonly number[],
): readonly HopEventOutput[] {
  const definitions = new Map((artifact.events ?? []).map((definition) => [definition.signature, definition]));
  return hopEmits(artifact, functionName, emits).map((emit, position) => ({
    lockingBytecode: eventLockingBytecode(
      category, emit.eventSignature, definitions.get(emit.eventSignature)?.anonymous === true,
    ),
    commitment: commitments[position] ?? new Uint8Array(0),
  }));
}

/**
 * The placeholder each of an entry's event outputs carries until the hop learns the payload it computed, or the
 * empty commitment of an emit the frame's facts decide its body skips (`skippedEmits`), which is stated outright.
 */
function hopEventSentinels(
  artifact: Artifact,
  functionName: string,
  category: Uint8Array,
  maximumCommitmentBytes: number,
  emits?: readonly number[],
  skipped: readonly number[] = [],
): readonly Uint8Array[] {
  return hopEmits(artifact, functionName, emits).map((emit, position) => (skipped.includes(emit.emitIndex)
    ? new Uint8Array(0) : eventSentinel(category, artifact.contractName, position, maximumCommitmentBytes)));
}

/**
 * The emits an entry's frame lists one output for, in the order its body makes them: each emit once, or, for a body
 * that emits from a loop, the emit indices its turns make (`entryLoopTurns`). A frame laid without those turns is
 * refused by name rather than listing one output for an emit a loop repeats.
 */
function hopEmits(
  artifact: Artifact, functionName: string, emits: readonly number[] | undefined,
): readonly NonNullable<Artifact['abi'][number]['emits']>[number][] {
  const rows = artifact.abi.find((candidate) => candidate.name === functionName)?.emits ?? [];
  if (emits === undefined) {
    if (publishedLoopEffects(artifact, functionName)?.events !== undefined) {
      throw new FramedProxyDeployError(
        `the ${entryLabelFor(functionName)} of "${artifact.contractName}" emits from a loop, whose turns the hop counts `
        + 'for the implementation\'s own entry only',
      );
    }
    return [...rows].sort((left, right) => left.emitIndex - right.emitIndex);
  }
  return emits.map((emitIndex) => {
    const row = rows.find((candidate) => candidate.emitIndex === emitIndex);
    if (row === undefined) {
      throw new FramedProxyDeployError(`the ${entryLabelFor(functionName)} publishes no emit ${emitIndex}`);
    }
    return row;
  });
}

/**
 * The events, sends and hashes the implementation's own entry repeats in a loop, counted against the hop's facts:
 * its arguments, the proxy's records and the frame's addresses.
 */
function implementationLoopTurns(inputs: HopCallInputs): EntryLoopTurns {
  try {
    return entryLoopTurns(inputs);
  } catch (error) {
    if (error instanceof FramedLoopTurnsError) {
      throw new FramedProxyDeployError(`the implementation's ${error.message}`);
    }
    throw error;
  }
}

/**
 * The `msg.sender` a callee frame runs with.
 *
 * A call frame's sender is the address of the frame that entered it — the implementation's own proxy for a
 * first-level callee, a calling callee's own address below that. A delegate frame preserves its caller's sender, so
 * a proxy's delegate runs with the same sender as the fallback that entered it.
 */
function calleeSender(
  callees: readonly HopCallee[],
  rootSelf: Uint8Array,
  rootSender: Uint8Array,
  callee: HopCallee,
): Uint8Array {
  const caller = callee.enteredBy === null ? undefined : callees[callee.enteredBy];
  // A call's sender is the address of the frame that entered it. INTERNAL inherits that sender, the way a
  // delegate does. A root-entered internal frame inherits the root's sender, which is the user lock.
  if (caller === undefined) return callee.kind === FrameKind.INTERNAL ? rootSender : rootSelf;
  if (callee.kind === FrameKind.DELEGATE || callee.kind === FrameKind.INTERNAL) {
    return calleeSender(callees, rootSelf, rootSender, caller);
  }
  return caller.selfAddress;
}

/** The callee indices whose records a delegate frame runs on, each named once and in placement order. */
function delegateOwnerIndices(callees: readonly HopCallee[]): readonly number[] {
  const owners: number[] = [];
  for (const callee of callees) {
    if (callee.recordOwner !== undefined && !owners.includes(callee.recordOwner)) {
      owners.push(callee.recordOwner);
    }
  }
  return owners;
}

/** The records one callee frame's own entry declares, in the order its block layout names them. */
function calleeDeclaredRecords(
  callee: HopCallee, owned: readonly HopCalleeRecord[],
): readonly HopCalleeRecord[] {
  return frameDataRecordIndices(callee.artifact, callee.entry)
    .map((nftIndex) => owned[nftIndex])
    .filter((record): record is HopCalleeRecord => record !== undefined);
}

/**
 * The records a callee frame names in its own block layout, in that layout's order: the ones its body reads at the
 * base its block declares plus each record's layout offset.
 */
function calleeNamedRecordIds(callees: readonly HopCallee[], callee: HopCallee): readonly string[] {
  const owned = callee.recordOwner === undefined ? callee.records : callees[callee.recordOwner]!.records;
  return namedDataRecordIndices(callee.artifact, callee.entry)
    .map((nftIndex) => owned[nftIndex]?.id).filter((id): id is string => id !== undefined);
}

/**
 * Places a block's data records side by side in data-record order, ahead of its nodes, when the order its frames
 * first named them leaves some frame's named records apart: a later frame naming a lower record finds it past the
 * records and nodes an earlier frame placed. A block every frame can address keeps its order, and one no order of
 * its records serves is refused by name (`adjacentRecordOrder`).
 */
function adjacentRecordState(
  callees: readonly HopCallee[], block: string, state: readonly string[], recordIndex: ReadonlyMap<string, number>,
): readonly string[] {
  const frames = callees.filter((callee) =>
    (callee.recordOwner === undefined ? callee : callees[callee.recordOwner]!).block === block);
  return adjacentRecordOrder(state, frames.map((callee) => calleeNamedRecordIds(callees, callee)), recordIndex,
    (split) => {
      throw new FramedProxyDeployError(
        `the callee "${frames[split]!.functionName}" reads its data records of "${block}" side by side, and no `
        + 'order of the records the hop\'s other frames of that contract name keeps them so',
      );
    });
}

/**
 * The long mapping values a callee frame reads from its own block, one per value-witness slot.
 *
 * A body that reads a value its node's tail cannot hold takes the value itself from its frame's block, so the
 * frame's witness block declares the whole value the hop joined from the deployment's chunks. The frame's own
 * writes already state theirs; the nodes the frame only reads add theirs here, and the two lists overlay by slot.
 * The plain call path lists its callee frames' so too.
 */
export function calleeValueWitnesses(
  readNodes: readonly HopCalleeReadNode[], laidWrites: LaidHopEntryWrites | undefined,
): readonly Uint8Array[] | undefined {
  const bySlot = new Map<number, Uint8Array>();
  for (const node of readNodes) {
    if (node.value !== undefined) bySlot.set(node.slotIndex, node.value);
  }
  const written = laidWrites?.values;
  if (bySlot.size === 0) return written;
  const length = Math.max(written?.length ?? 0, Math.max(...bySlot.keys()) + 1);
  return Array.from({ length }, (_unused, slot) => {
    const read = bySlot.get(slot);
    return read !== undefined && read.length > 0 ? read : written?.[slot] ?? new Uint8Array(0);
  });
}

/**
 * The records of one category the hop's callee frames declare, each named once.
 *
 * A delegate frame's records are its owner's, and the two frames may name different subsets, so a category's
 * declared records are the union over every frame that runs on it.
 */
function calleeDeclaredRecordsOfCategory(
  callees: readonly HopCallee[], categoryKey: string,
): readonly string[] {
  const ids: string[] = [];
  for (const callee of callees) {
    const owner = callee.recordOwner === undefined ? undefined : callees[callee.recordOwner];
    if (bytesToHex((owner ?? callee).category) !== categoryKey) continue;
    const owned = owner === undefined ? callee.records : owner.records;
    for (const record of calleeDeclaredRecords(callee, owned)) {
      if (!ids.includes(record.id)) ids.push(record.id);
    }
  }
  return ids;
}

/**
 * Chains the views the frames declare for each node several of them touch, in the order the validator walks them.
 *
 * Every callee frame is planned against the deployment and the links the frames placed before it left, so each
 * declares a node as the plan last saw it, while the transaction spends the node once and the validator reads its
 * declarations as one chain in execution order (V6): each frame's segments, a call's callee between the segment that
 * makes it and the next. The walk restates the declarations in that order: a kept one keeps the view the last write
 * before it left, and a write continues from that view to the one its own frame computed, which the hop learns from
 * that frame. A relink (`relinks`) keeps the slot and the value of the view it continues from and takes the
 * successor its plan states, since a value an earlier frame wrote is that frame's to compute. `ends` is the view
 * each written node's chain ends at, which its output carries.
 */
export function chainSharedNodeViews<T extends DraftMaster | DraftMintedMaster>(
  masters: readonly T[],
  root: string,
  nodes: ReadonlySet<number>,
  writes: ReadonlySet<DraftRecordEntry>,
  learned: ReadonlyMap<string, ReadonlySet<number>> = new Map(),
  held = false,
  relinks: ReadonlySet<DraftRecordEntry> = new Set(),
): {
    readonly masters: readonly T[];
    readonly ends: ReadonlyMap<number, Uint8Array>;
    readonly createdEnds: ReadonlyMap<number, Uint8Array>;
  } {
  const byId = new Map(masters.map((master) => [master.master, master]));
  const chained = new Map<string, DraftRecordEntry[][]>();
  const views = new Map<number, Uint8Array>();
  // A node this transaction spends no input for is named by the output it was created at, and a frame that writes
  // one declares it there: those declarations chain by that output, and the output carries the last of them.
  const createdViews = new Map<number, Uint8Array>();
  /**
   * The view each record's last declaration ended at, for the declaration that follows it.
   *
   * A declaration whose end the body computes states no view, and the composer declares a placeholder in its place
   * and carries the value the body closed with to every declaration that names that placeholder. So a later
   * declaration continues from the placeholder rather than from the view the plan could not know, and the same
   * learning resolves both ends of the chain.
   */
  const continued = new Map<number, Uint8Array>();
  const visit = (id: string): void => {
    const master = byId.get(id);
    if (master === undefined || chained.has(id)) return;
    const segments: DraftRecordEntry[][] = [];
    chained.set(id, segments);
    master.segments.forEach((segment, at) => {
      segments.push(segment.map((entry, entryIndex): DraftRecordEntry => {
        if (entry.viewIn === 'carried') return carriedFromChain(entry, nodes, continued, master.master, at, entryIndex);
        if (entry.viewOut === 'carried') return entry;
        if (entry.in === INDEX_NONE && entry.out !== undefined) {
          // A created record whose end the body computes is left as it is: the output the chain carries it to is
          // the one the frame's own settlement states, not a declaration another frame names.
          if (entry.viewOut === undefined) return entry;
          const view = createdViews.get(entry.out) ?? entry.viewIn;
          // A declaration that states a change is the write it says it is, and a frame the settle stated an end view
          // for is one that rewrote the node: both keep that view and the chain carries it on. A declaration that
          // states none, from a frame that settled none, is a frame that held the node - but only a pass the caller
          // planned for that reading says so, because before a settle the two are the same declaration and the
          // frame's own close is what learns the difference.
          const heldHere = held && bytesEqual(entry.viewIn, entry.viewOut)
            && !(learned.get(id)?.has(entry.out) ?? false);
          if (writes.has(entry) && !heldHere) {
            const written = relinks.has(entry) ? relinkedView(view, entry.viewOut) : entry.viewOut;
            createdViews.set(entry.out, written);
            if (hopTraceOn()) {
              hopTrace(`chain-created ${id} out=${String(entry.out)} write in=${String(entry.viewIn.length)} `
                + `chain=${String(view.length)} learned=${String(learned.get(id)?.has(entry.out) ?? false)} `
                + `relink=${String(relinks.has(entry))}`);
            }
            return { ...entry, viewIn: view, viewOut: written };
          }
          // A frame that only holds a node an earlier frame created reads and leaves the view the chain holds:
          // both sides are that view, so the frame's own kept declaration is what the settlement compares.
          if (hopTraceOn()) {
            hopTrace(`chain-kept ${id} out=${String(entry.out)} write=${String(writes.has(entry))} `
              + `held=${String(heldHere)} chain=${String(view.length)} `
              + `learned=${String(learned.get(id)?.has(entry.out) ?? false)}`);
          }
          return { ...entry, viewIn: view, viewOut: view };
        }
        if (!nodes.has(entry.in)) return entry;
        const end = entry.viewOut ?? unstatedViewPlaceholder(master.master, at, entryIndex);
        const view = continued.get(entry.in) ?? views.get(entry.in) ?? entry.viewIn;
        if (!writes.has(entry) || bytesEqual(entry.viewIn, end)) {
          if (hopTraceOn()) {
            hopTrace(`chain-kept-write ${master.master} in=${String(entry.in)} `
              + `viewIn=${String(entry.viewIn.length)} viewOut=${String(entry.viewOut?.length ?? -1)} `
              + `write=${String(writes.has(entry))} view=${String(view.length)}`);
          }
          return { ...entry, viewIn: view, viewOut: view };
        }
        if (hopTraceOn()) {
          const head = (bytes: Uint8Array): string => `${bytes.length}:${binToHex(bytes.slice(0, 12))}..${binToHex(bytes.slice(-6))}`;
          hopTrace(`chain-write ${master.master} in=${String(entry.in)} out=${String(entry.out)} `
            + `viewIn=${head(entry.viewIn)} viewOut=${head(end)} view=${head(view)} `
            + `learned=${String(learned.get(master.master)?.has(entry.in) ?? false)} relink=${String(relinks.has(entry))}`);
        }
        if (relinks.has(entry) && entry.viewOut !== undefined) {
          const relinked = relinkedView(view, entry.viewOut);
          views.set(entry.in, relinked);
          continued.set(entry.in, relinked);
          return { ...entry, viewIn: view, viewOut: relinked };
        }
        if (entry.viewOut !== undefined) views.set(entry.in, entry.viewOut);
        continued.set(entry.in, end);
        return { ...entry, viewIn: view };
      }));
      const call = master.calls[at];
      if (call !== undefined) visit(call.callee);
    });
  };
  visit(root);
  return {
    masters: masters.map((master) => {
      const segments = chained.get(master.master);
      return segments === undefined ? master : { ...master, segments };
    }),
    ends: views,
    createdEnds: createdViews,
  };
}

/** A relink's end view: the slot and the value of the view it continues from, and the successor its plan states. */
function relinkedView(view: Uint8Array, planned: Uint8Array): Uint8Array {
  const reached = decodeEntryCommitment(view);
  return encodeEntryCommitment(reached.slot, decodeEntryCommitment(planned).nextKey, reached.value);
}

/** The created outputs, each carrying the view the chain of declarations of the node it holds ends at. */
export function withCreatedChainEnds(
  trailings: readonly DraftSourceOutput[],
  base: number,
  createdEnds: ReadonlyMap<number, Uint8Array>,
): DraftSourceOutput[] {
  return trailings.map((output, position) => {
    const end = createdEnds.get(base + position);
    const token = output.token;
    if (end === undefined || token?.nft === undefined) return output;
    return { ...output, token: { ...token, nft: { ...token.nft, commitment: end } } };
  });
}

/** The inputs, each shared node a write touched recreated at the view its chain ends at. */
export function withChainEnds(
  participants: readonly { readonly id: string; readonly index: number }[],
  ends: ReadonlyMap<number, Uint8Array>,
  inputs: Record<string, DraftInput>,
): Record<string, DraftInput> {
  for (const placed of participants) {
    const end = ends.get(placed.index);
    const input = inputs[placed.id];
    const token = input?.output?.token;
    if (end === undefined || input?.output === undefined || token?.nft === undefined) continue;
    inputs[placed.id] = {
      ...input, output: { ...input.output, token: { ...token, nft: { ...token.nft, commitment: end } } },
    };
  }
  if (hopTraceOn()) {
    for (const placed of participants) {
      const input = inputs[placed.id];
      const len = (
        source: { readonly token?: { readonly nft?: { readonly commitment?: Uint8Array } } } | undefined,
      ): number => source?.token?.nft?.commitment?.length ?? -1;
      if (len(input?.source) === len(input?.output) && ends.get(placed.index) === undefined) continue;
      hopTrace(`chain-end ${placed.index} ${placed.id.slice(0, 44)} `
        + `src=${String(len(input?.source))} out=${String(len(input?.output))} `
        + `end=${String(ends.get(placed.index)?.length ?? -1)}`);
    }
  }
  return inputs;
}

/**
 * The last of the root entry's own calls that leads to a frame running on the root's records, a call back into the
 * root, or undefined for a hop no frame of which calls back into its root.
 */
function rootReentryCall(
  callees: readonly HopCallee[], calls: readonly DraftCall[], proxyCategory: Uint8Array,
): number | undefined {
  let last: number | undefined;
  for (const callee of callees) {
    const owner = callee.recordOwner === undefined ? callee : callees[callee.recordOwner]!;
    if (!bytesEqual(owner.category, proxyCategory)) continue;
    let top = callee;
    while (top.enteredBy !== null) top = callees[top.enteredBy]!;
    const at = calls.findIndex((call) => call.callee === top.master);
    if (at >= 0 && (last === undefined || at > last)) last = at;
  }
  return last;
}

/** The mappings and dynamic values one frame reads or writes, each named as a refusal names it. */
function touchedValues(
  artifact: Artifact, functionName: string, readNodes: readonly HopCalleeReadNode[],
  writes: HopEntryWrites | undefined,
): ReadonlySet<string> {
  const row = artifact.abi.find((candidate) => candidate.name === functionName);
  return new Set([
    ...readNodes.map((node) => `mapping "${node.collection}"`),
    ...(writes?.reachWrites ?? []).map((write) => `mapping "${write.collection}"`),
    ...[...row?.dynamicReads ?? [], ...row?.dynamicWrites ?? []].map((variable) => `dynamic value "${variable}"`),
  ]);
}

/**
 * Refuses a frame that calls back into the root and reads or writes a mapping or a dynamic value the root's own
 * frame reads or writes.
 *
 * The root frame's nodes and chunks are planned against the deployment, and so are the re-entered frame's, so
 * neither plan sees what the other spends or leaves: the two would place one node twice, or declare views of it that
 * no chain links. Only the root's data records chain through both.
 */
function requireSeparateRootValues(
  callees: readonly HopCallee[], artifact: Artifact, functionName: string, readNodes: readonly HopCalleeReadNode[],
  entryWrites: HopEntryWrites | undefined, proxyCategory: Uint8Array,
  writesOf: (callee: HopCallee) => HopEntryWrites | undefined,
): void {
  const root = touchedValues(artifact, functionName, readNodes, entryWrites);
  for (const callee of callees) {
    const owner = callee.recordOwner === undefined ? undefined : callees[callee.recordOwner]!;
    if (owner === undefined || !bytesEqual(owner.category, proxyCategory)) continue;
    const shared = [...touchedValues(callee.artifact, callee.entry, callee.readNodes, writesOf(callee))]
      .find((value) => root.has(value));
    if (shared !== undefined) {
      throw new FramedProxyDeployError(
        `the implementation's ${entryLabelFor(functionName)} is called back by "${callee.functionName}", and both `
        + `read or write ${shared}, which the hop plans for each frame against the deployment alone, so neither `
        + 'would see what the other spends or leaves',
      );
    }
  }
}

/** Lays out the delegate hop from the deployed masters and the proxy's records. */
function buildHopPlan(options: HopPlanOptions): CompositionDraftPlan {
  const { proxyArtifact, implementationArtifact, proxyMaster, implementationMaster } = options;
  const calls = options.calls ?? [];
  const callees = options.callees ?? [];
  // The genesis shape mints the proxy master as one trailing output ahead of every event, and creates the proxy's
  // data records rather than spending them.
  const genesis = options.genesis === true;
  const mintedShift = genesis ? 1 : 0;
  // The genesis mints the proxy's own validator, so the validator that runs is the first callee's: its pool already
  // exists on chain. It covers the minted proxy root and every frame below it (V9 relaxes the root category; V1 binds
  // the running validator to its own category's spent master). A calling initializer always has one.
  const validatorCategory = genesis ? callees[0]!.category : options.proxyCategory;
  const validatorLock = genesis ? callees[0]!.deployed.address : proxyMaster.address;
  // The genesis's funding coin is its leading input, at the funder's lock rather than a root caller's, and its index
  // recreates as the proxy's authhead: output 0 of the transaction that creates the category (D47).
  const userInputLock = genesis
    ? (options.funderLockingBytecode ?? options.callerLockingBytecode) : options.callerLockingBytecode;
  const genesisIdentity = genesis ? options.identity : undefined;
  if (genesis && genesisIdentity === undefined) {
    throw new FramedProxyDeployError('the genesis shape leads with the proxy\'s authhead, but the plan names no identity');
  }
  const leading = genesisIdentity === undefined ? [] : [USER_ID];
  // A callee's own write as it is planned for this pass: a write whose value only the frame's own close exposed is
  // planned again from the value a settle read there, so the frame declares the whole run its body addresses.
  const calleeWritesOf = (callee: HopCallee): HopEntryWrites | undefined => {
    const learnedValue = options.calleeWriteValues?.get(callee.master);
    return learnedValue === undefined ? callee.entryWrites : planCalleeWrites(callee, learnedValue);
  };
  // The side-cars each frame co-spends, and their inputs in one record the plan states. A frame that reads none
  // contributes nothing, so a hop with no hashing or recovery lays out exactly as before.
  const sideCars = options.sideCars ?? new Map<string, RecoverySideCars>();
  const sideCarInputs: Record<string, DraftInput> = Object.assign(
    {}, ...[...sideCars.values()].map((frame) => frame.inputs),
  );
  const computedWitnesses = [...sideCars.values()].flatMap((frame) => [...frame.computedWitnesses]);
  /** The recovery list a block states for `masters`, or nothing when none of them co-spends a side-car. */
  const recoveryOf = (masters: readonly string[]): { readonly recovery?: Record<string, readonly string[]> } => {
    const lists: Record<string, readonly string[]> = {};
    for (const master of masters) {
      const ids = sideCars.get(master)?.ids;
      if (ids !== undefined && ids.length > 0) lists[master] = ids;
    }
    return Object.keys(lists).length === 0 ? {} : { recovery: lists };
  };
  // A fallback that publishes a return records the delegate frame's `retval`, so the proxy frame the hop enters on
  // carries the same bytes the implementation frame does; one that publishes none leaves the slot empty.
  const proxyReturnsValue = (proxyArtifact.abi.find((entry) => entry.name === '__fallback')?.outputs ?? []).length > 0;

  // One participant per data NFT of the proxy's layout, in data-NFT order: the record the proxy's genesis minted
  // for it. The proxy's block holds its master, its validator and them; the implementation's master follows, and
  // the deployer's signed input enters the composition. A record the entry's own body writes — a mapping node — is
  // a participant of the same block, after them. A callee the entry calls runs as its own block, its own master and
  // its own records, exactly as a caller the composer builds for itself lays one out.
  const recordIds = options.recordCommitments.map((_commitment, nftIndex) => proxyRecordParticipantId(nftIndex));
  // The nodes the entry only reads sit after the data records, ahead of any write, as a callee frame's do. A node two
  // of its keys share is one input, placed once.
  const readNodes = options.readNodes ?? [];
  // A node the entry's own batch also spends, a predecessor its insert relinks or a target it rewrites, is the
  // batch's input: the read is declared there, ahead of the batch's groups, rather than placed a second time.
  const batchInputs = new Map([...options.entryWrites?.spentUtxos ?? []]
    .map(([id, utxo]) => [`${utxo.txid}:${utxo.vout}`, id] as const));
  const batchInputOf = (node: HopCalleeReadNode): string | undefined =>
    (node.utxo === undefined ? undefined : batchInputs.get(`${node.utxo.txid}:${node.utxo.vout}`));
  // A node an earlier reach created carries no input: the frame that created it places it as an output, so the
  // read that resolves to it declares it there rather than as a state input of its own.
  const readNodeIds = [...new Set(readNodes.filter((node) => node.createdSlot === undefined
    && batchInputOf(node) === undefined).map((node) => node.id))];
  const entryWriteIds = options.entryWrites?.participantIds ?? [];
  // A deployment owns one block, and every master the hop spends of it sits in that block in placement order; a
  // contract reached at several sites therefore contributes several masters to its one block, and its records are
  // placed once however many of its masters read them. Two deployments of one contract are two blocks (`block`).
  const calleeBlocks = new Map<
  string,
  {
    readonly contract: string; masters: string[]; state: string[];
    readonly recovery: Record<string, readonly string[]>;
  }
  >();
  // Each block's data records by participant id, with the data record each one is.
  const calleeRecordIndices = new Map<string, Map<string, number>>();
  for (const callee of callees) {
    let block = calleeBlocks.get(callee.block);
    if (block === undefined) {
      block = { contract: callee.block, masters: [], state: [], recovery: {} };
      calleeBlocks.set(callee.block, block);
    }
    block.masters.push(callee.master);
    const sideCarIds = sideCars.get(callee.master)?.ids;
    if (sideCarIds !== undefined && sideCarIds.length > 0) block.recovery[callee.master] = sideCarIds;
    // A delegate frame's records, the nodes it reads and the nodes its write touches all sit at its owner's
    // category, so they are placed in the owner's block; the owner is placed before the delegate.
    const owner = callee.recordOwner === undefined ? undefined : callees[callee.recordOwner]!;
    const target = owner === undefined ? block : calleeBlocks.get(owner.block);
    if (target === undefined) continue;
    const owned = owner === undefined ? callee.records : owner.records;
    const indices = calleeRecordIndices.get(target.contract) ?? new Map<string, number>();
    calleeRecordIndices.set(target.contract, indices);
    // The records the entry's own block layout names, in that order; a record no body of the frame reads is not
    // spent, so it is placed in no block and declared in no segment.
    for (const record of calleeDeclaredRecords(callee, owned)) {
      indices.set(record.id, owned.indexOf(record));
      if (!target.state.includes(record.id)) target.state.push(record.id);
    }
    // The nodes the frame reads sit after the data records its own block layout names, ahead of any write.
    for (const node of callee.readNodes) {
      if (node.createdSlot !== undefined) continue;
      if (!target.state.includes(node.id)) target.state.push(node.id);
    }
    // The nodes the frame's own write spends sit after the records it declares.
    for (const id of calleeWritesOf(callee)?.participantIds ?? []) {
      if (!target.state.includes(id)) target.state.push(id);
    }
  }
  // A frame that calls back into the root sits in the root's own blocks, after the root's masters, and runs on the
  // root's records, which those blocks place in data-record order as the root's own frames read them; the nodes it
  // touches follow the root's own.
  const rootBlock = (contract: string): boolean =>
    contract === proxyArtifact.contractName || contract === implementationArtifact.contractName;
  const rootProxyMasters = [
    ...(genesis ? [] : [PROXY_MASTER_ID]),
    ...calleeBlocks.get(proxyArtifact.contractName)?.masters ?? [],
  ];
  const rootImplementationMasters =
    [IMPLEMENTATION_MASTER_ID, ...calleeBlocks.get(implementationArtifact.contractName)?.masters ?? []];
  // The proxy's data records are created outputs in the genesis (not spent), so they are not block state there.
  const rootState = [...(genesis ? [] : recordIds), ...readNodeIds, ...entryWriteIds];
  // Each frame reads its named records from one base, so they must sit side by side (`adjacentRecordState`).
  for (const [id, block] of calleeBlocks) {
    if (rootBlock(id)) continue;
    block.state = [...adjacentRecordState(callees, id, block.state, calleeRecordIndices.get(id) ?? new Map())];
  }
  const blocks: ContractBlock[] = [
    {
      contract: proxyArtifact.contractName,
      masters: rootProxyMasters,
      validator: { id: VALIDATOR_ID, settles: [] },
      state: [...rootState, ...(calleeBlocks.get(proxyArtifact.contractName)?.state ?? [])
        .filter((id) => !rootState.includes(id))],
      ...recoveryOf(rootProxyMasters),
    },
    {
      contract: implementationArtifact.contractName,
      masters: rootImplementationMasters,
      state: [],
      ...recoveryOf(rootImplementationMasters),
    },
    ...[...calleeBlocks.values()].filter((block) => !rootBlock(block.contract)).map((block) => ({
      contract: block.contract, masters: block.masters, state: block.state,
      ...(Object.keys(block.recovery).length === 0 ? {} : { recovery: block.recovery }),
    })),
  ];
  // The validator runs as a head plus its facet inputs, so the hop's own layout has to place the same facets the
  // composer places; otherwise the indices the plan states and the ones the assembled transaction uses would differ.
  const validatorRedeem = validatorRedeemScript(validatorCategory, framedValidator.buildValidatorProgram());
  const facets = validatorFacetsOf({ id: VALIDATOR_ID, covers: [], settles: [], redeemScript: validatorRedeem });
  const layout = layoutTransaction(blocks, new Map([[VALIDATOR_ID, facets]]), leading);
  const pushes = callPushes(implementationArtifact, options.entry.functionName, options.entry.args ?? []);
  // The events the delegate frame lists sit in the trailing region, which starts past the participants. The
  // assembly allocates them there and refuses a plan that names any other index.
  const eventIndices = options.eventOutputs.map(
    (_output, position) => layout.participantCount + mintedShift + position,
  );
  const maximumCommitmentBytes = options.maximumCommitmentBytes ?? DEFAULT_MAXIMUM_COMMITMENT_BYTES;
  // The trailing region is allocated in the assembler's own order: a minted master first when the genesis mints the
  // proxy, every frame's events next, the root's before any callee's, then the created records in the order the
  // frames' segments declare them. Each frame that emits lists one output per event whatever else it writes,
  // because the frame's own head walks them. Because every event sits ahead of the created region, the cursor the
  // callee events leave is the base the created records start at.
  let trailingCursor = layout.participantCount + mintedShift + options.eventOutputs.length;
  const calleeEventPlan = callees.map((callee) => {
    const owner = callee.recordOwner === undefined ? undefined : callees[callee.recordOwner];
    const category = (owner ?? callee).category;
    const eventCommitments = options.calleeEventCommitments?.get(callee.master)
      ?? hopEventSentinels(callee.artifact, callee.entry, category, maximumCommitmentBytes, undefined,
        callee.skippedEmits);
    const eventOutputs = hopEventOutputs(callee.artifact, callee.entry, category, eventCommitments);
    const base = trailingCursor;
    trailingCursor += eventOutputs.length;
    return { category, eventOutputs, eventIndices: eventOutputs.map((_output, position) => base + position) };
  });
  // The value the call carries is the proxy's root frame's, and its delegate frame passes it through as its own
  // `msg.value` (V5). The implementation's sends follow every frame's events, a container of the proxy first, and
  // the records the frames create follow them (spec 4b).
  const value = options.value?.hop.value ?? 0n;
  const listedSends = options.value?.sends ?? [];
  const paying = options.value === undefined
    ? undefined : hopPaying(options.value.hop, listedSends, proxyArtifact.contractName);
  const valueOutputs = options.value === undefined || paying === undefined
    ? undefined : hopValueOutputs(options.value.hop, listedSends, paying);
  const sendIndices = listedSends.map((_send, position) => trailingCursor + 1 + position);
  trailingCursor += valueOutputs?.run.length ?? 0;
  // The proxy's data records: spent and recreated at their own index in a hop, created at a trailing output in the
  // genesis, which mints them fresh. In the genesis they lead the created region, so the mapping nodes that follow
  // start after them.
  const recordIndices = genesis
    ? recordIds.map((_id, nftIndex) => trailingCursor + nftIndex)
    : recordIds.map((id) => participant(layout, id).index);
  if (genesis) trailingCursor += recordIds.length;
  // Every record kept where the proxy read it before the call, and left where the entry's write leaves it. The
  // delegate frame's segment chains each record's kept view to its written one, and the proxy's own later segment
  // continues from the written view: a record has no other frame between them.
  const entries = (
    viewIn: (nftIndex: number) => Uint8Array, viewOut: (nftIndex: number) => Uint8Array,
  ): RecordEntry[] => recordIndices.map((index, nftIndex) => ({
    in: genesis ? INDEX_NONE : index, out: index, viewIn: viewIn(nftIndex), viewOut: viewOut(nftIndex),
  }));
  const recordKept = entries(
    (nftIndex) => options.recordCommitments[nftIndex]!, (nftIndex) => options.recordCommitments[nftIndex]!,
  );
  const recordWritten = entries(
    (nftIndex) => options.recordCommitments[nftIndex]!, (nftIndex) => options.writtenCommitments[nftIndex]!,
  );
  // The view a record carries after the entry ran: the written one continues to itself, and a record the entry
  // leaves untouched is the kept one.
  const recordAfter = entries(
    (nftIndex) => options.writtenCommitments[nftIndex]!, (nftIndex) => options.writtenCommitments[nftIndex]!,
  );
  // The segments each record the entry's own body writes lands in, as the artifact publishes them per write.
  const recordLandings = new Map<number, number[]>();
  for (const [nftIndex, published] of publishedRecordWrites(implementationArtifact, options.entry.functionName)) {
    const landings = [...new Set(published.map((segment) => (segment === 'last' ? calls.length : segment)))]
      .filter((segment) => segment >= 0 && segment <= calls.length)
      .sort((left, right) => left - right);
    if (landings.length > 0) recordLandings.set(nftIndex, landings);
  }
  // A record the body writes is one the artifact lands a write of, as a callee frame's is, whatever its end view: a
  // guard set before a call and cleared after it ends where it started and still changes in both segments. An
  // artifact that publishes no landing for a record leaves the end commitment the settle learned to tell.
  const writes = options.recordCommitments.map((commitment, nftIndex) =>
    recordLandings.has(nftIndex) || !bytesEqual(commitment, options.writtenCommitments[nftIndex]!));
  // The proxy master's reference: its input index in a hop, or the flagged reference to its minted output in the
  // genesis, where it is not spent. Only the write path of a spent node reads it, and the genesis spends none.
  const proxyMasterIndex = genesis
    ? mintedRef(layout.participantCount)
    : participant(layout, PROXY_MASTER_ID).index;
  // The proxy's own master declares every record of its layout; the delegate frame declares those of the
  // implementation's records its entry's block layout names, as a callee frame does, because a body addresses each
  // record by its position in that list and reads its chunk run right after them.
  const implementationRecords = implementationArtifact.stateLayout?.dataNftCount ?? recordIds.length;
  const at = (list: readonly RecordEntry[], nftIndex: number): RecordEntry =>
    (writes[nftIndex] ? list[nftIndex]! : recordKept[nftIndex]!);
  // The census admits a mutable NFT of the proxy's category only where a frame on it declares a record, so the minted
  // root declares the authhead at the leading index: created from nothing at the owner's lock, then kept there.
  const authhead = genesisIdentity === undefined ? undefined
    : { out: participant(layout, USER_ID).index, owner: genesisIdentity.owner };
  const authheadCreated: RecordEntry | undefined = authhead === undefined ? undefined
    : { in: INDEX_NONE, out: authhead.out, viewIn: new Uint8Array(0), viewOut: authhead.owner };
  const authheadKept: RecordEntry[] = authhead === undefined ? []
    : [{ in: INDEX_NONE, out: authhead.out, viewIn: authhead.owner, viewOut: authhead.owner }];
  const proxySegments: RecordEntry[][] = [
    [...recordKept, ...(authheadCreated === undefined ? [] : [authheadCreated])],
    [...recordKept.map((_entry, nftIndex) => at(recordAfter, nftIndex)), ...authheadKept],
  ];
  // A call closes the segment the code before it runs in, so a frame that makes `k` calls declares `k + 1`
  // segments. Each write the entry's own source makes lands in one of them — the count of calls before the write,
  // or the run's last segment when the epilogue pins what it wrote — which the artifact publishes per write. The
  // hop declares each write's records in its own segment rather than in the segment the frame begins in, and keeps
  // each record the frame holds in the segments on either side of it.
  const entryWritesLabel = `the implementation's ${entryLabelFor(options.entry.functionName)}`;
  const recordWriteAt = writes.map((written, nftIndex) => (written ? resolvedWriteSegment({
    artifact: implementationArtifact,
    functionName: options.entry.functionName,
    label: entryWritesLabel,
    what: `writes record ${nftIndex}`,
    write: { record: nftIndex },
    calls: calls.length,
    ...(options.callBases === undefined ? {} : { callBases: options.callBases }),
    ...(options.truncated === true ? { truncated: true } : {}),
  }) : undefined));
  // A frame that calls back into the root runs on the root's records between two of the root frame's segments, so
  // the records chain through it (`chainSharedNodeViews`): a write of the root frame at or before the last call that
  // leads to such a frame is left for its own close to state, which the frame then starts from, and a write after it
  // continues from what the frame left. The records' outputs are where their chains end.
  const reentryCall = rootReentryCall(callees, calls, options.proxyCategory);
  if (reentryCall !== undefined) {
    requireSeparateRootValues(callees, implementationArtifact, options.entry.functionName, readNodes,
      options.entryWrites, options.proxyCategory, calleeWritesOf);
  }
  const rootRecordWrites = new Set<DraftRecordEntry>();
  // Each record the entry rewrites is kept at the commitment the proxy spent until the segments its writes open,
  // written in those, and kept at the written commitment afterwards. A frame whose source writes one record in
  // several segments declares it changed in every one of them, each change continuing from the last one's end: the
  // body computes each change's end view, so all but the last are handed back for the derivation to learn and only
  // the last carries the commitment the settle stated.
  const implementationSegments: DraftRecordEntry[][] = Array.from({ length: calls.length + 1 },
    (_unused, segmentIndex) => frameDataRecordIndices(implementationArtifact, options.entry.functionName)
      .filter((nftIndex) => nftIndex < implementationRecords).map((nftIndex): DraftRecordEntry => {
        const writeAt = recordWriteAt[nftIndex];
        if (writeAt === undefined) return recordKept[nftIndex]!;
        // The frame's declarations are read as one chain, so each change continues from what the last one left. A
        // record whose writes all land in one segment states that change and keeps its end view in the rest.
        const landings = recordLandings.get(nftIndex);
        if (reentryCall !== undefined) {
          const landed = landings ?? [writeAt.least];
          const { in: index, out } = recordKept[nftIndex]!;
          if (segmentIndex < landed[0]!) return recordKept[nftIndex]!;
          if (!landed.includes(segmentIndex)) return { in: index, out, viewIn: 'carried', viewOut: 'carried' };
          const written: DraftRecordEntry = {
            in: index,
            out,
            viewIn: segmentIndex === landed[0] && segmentIndex <= reentryCall ? recordKept[nftIndex]!.viewIn : 'carried',
            ...(segmentIndex === landed[landed.length - 1] && segmentIndex > reentryCall
              ? { viewOut: recordWritten[nftIndex]!.viewOut } : {}),
          };
          rootRecordWrites.add(written);
          return written;
        }
        if (landings === undefined || landings.length <= 1) {
          if (segmentIndex < writeAt.least) return recordKept[nftIndex]!;
          return segmentIndex === writeAt.least ? recordWritten[nftIndex]! : recordAfter[nftIndex]!;
        }
        const change = landings.indexOf(segmentIndex);
        if (change < 0) {
          return segmentIndex < landings[0]! ? recordKept[nftIndex]!
            : { in: recordKept[nftIndex]!.in, out: recordKept[nftIndex]!.out, viewIn: 'carried', viewOut: 'carried' };
        }
        return {
          in: recordWritten[nftIndex]!.in,
          out: recordWritten[nftIndex]!.out,
          viewIn: change === 0 ? recordKept[nftIndex]!.viewIn : 'carried',
          ...(change === landings.length - 1 ? { viewOut: recordWritten[nftIndex]!.viewOut } : {}),
        };
      }),
  );
  // The nodes the entry only reads follow its data records in every segment, kept, ahead of any write: one record
  // per key, at the position the frame reads that key from, so a node two keys share is declared at both. A node the
  // batch also spends is declared at the batch's input, and restated once the batch's own records are placed.
  const batchSpentReads: {
    readonly segment: DraftRecordEntry[]; readonly segmentIndex: number; readonly ordinal: number;
  }[] = [];
  implementationSegments.forEach((segment, segmentIndex) => {
    for (const node of readNodes) {
      if (node.createdSlot !== undefined) continue;
      const batchInput = batchInputOf(node);
      const index = participant(layout, batchInput ?? node.id).index;
      if (batchInput !== undefined) batchSpentReads.push({ segment, segmentIndex, ordinal: segment.length });
      segment.push({ in: index, out: index, viewIn: node.commitment, viewOut: node.commitment });
    }
  });
  // Every record a write transitions, laid by its own frame below. The shared-node walk reads it to tell the write
  // that establishes a created node's view from the frames that only hold it, so both the implementation's own
  // writes and the callees' have to be in it before either is chained.
  const writeTransitions = new Set<DraftRecordEntry>();
  for (const entry of rootRecordWrites) writeTransitions.add(entry);
  // The minted root creates the authhead, so the walk keeps the owner's lock it writes there.
  if (authheadCreated !== undefined) writeTransitions.add(authheadCreated);
  // The records the entry's own body writes follow the state records its frame declares, which is the ordinal the
  // body's group walk reads them at. A created node is a trailing output past the events.
  const createdBase = trailingCursor;
  // A chunk a shorter value leaves behind is paid to the caller whose coin enters the frame.
  const laidWrites = options.entryWrites?.lay({
    indexOf: (id) => participant(layout, id).index,
    proxyMasterIndex,
    createdBase,
    recordAmount: options.validatorAmount,
    category: options.proxyCategory,
    learnedViews: options.entryWriteViews,
    releasedLock: userInputLock,
  });
  if (laidWrites !== undefined && options.entryWrites !== undefined) {
    const placedWrites = placeOwnWrites(implementationSegments, {
      artifact: implementationArtifact,
      functionName: options.entry.functionName,
      label: entryWritesLabel,
      laid: laidWrites,
      writes: options.entryWrites,
      indexOf: (id) => participant(layout, id).index,
      category: options.proxyCategory,
      createdBase,
      calls: calls.length,
      ...(options.callBases === undefined ? {} : { callBases: options.callBases }),
      ...(options.truncated === true ? { truncated: true } : {}),
    });
    for (const { entry } of placedWrites) writeTransitions.add(entry);
    // A read of a node the batch spends keeps the view the batch's own declaration of the node starts each segment
    // from: the spent view up to the write's segment, where the read is declared ahead of the transition, and the
    // written view after it. The frame proves the key against the node's first declaration in its segment, and the
    // validator chains the read into the batch's transition, so each proof holds against the node the chain carries.
    for (const { segment, segmentIndex, ordinal } of batchSpentReads) {
      const read = segment[ordinal]!;
      const write = placedWrites.find((placed) => placed.entry.in === read.in);
      if (write === undefined) continue;
      const view = segmentIndex <= write.span.least ? write.entry.viewIn : write.entry.viewOut;
      segment[ordinal] = { ...read, viewIn: view, viewOut: view };
    }
  }
  const implementationValues = calleeValueWitnesses(readNodes, laidWrites);
  // The genesis mints the proxy master rather than spending it: its caller and origin are INDEX_NONE, its sender is
  // empty, and its output is the master token the genesis creates.
  const proxyFrame = { kind: FrameKind.ROOT, sender: new Uint8Array(0), self: proxyMaster.address, value: 0n };
  const proxyMasterDraft: DraftMaster | DraftMintedMaster = genesis
    ? {
      master: PROXY_MASTER_ID,
      contract: proxyArtifact.contractName,
      frame: proxyFrame,
      calls: [{
        kind: FrameKind.DELEGATE,
        callee: IMPLEMENTATION_MASTER_ID,
        target: implementationMaster.address,
        value: 0n,
        argumentPushes: pushes,
      }],
      retval: proxyReturnsValue ? options.implementationRetval : new Uint8Array(0),
      segments: proxySegments,
      events: [],
      sends: [],
      output: masterSource(proxyMaster.lockingBytecode, options.proxyCategory, options.proxyMasterAmount),
    }
    : {
      master: PROXY_MASTER_ID,
      contract: proxyArtifact.contractName,
      functionName: entryName(proxyArtifact, '__fallback'),
      program: proxyMaster.script,
      facts: factsOf(proxyArtifact, '__fallback', FrameKind.ROOT, true),
      frame: { kind: FrameKind.ROOT, sender: options.callerLockingBytecode, self: proxyMaster.address, value },
      enteredBy: USER_ID,
      origin: USER_ID,
      calls: [{
        kind: FrameKind.DELEGATE,
        callee: IMPLEMENTATION_MASTER_ID,
        target: implementationMaster.address,
        // A delegatecall passes no value of its own: its callee carries the caller's.
        value: 0n,
        argumentPushes: pushes,
      }],
      // A proxy whose fallback returns records the delegate frame's own `retval`, so its frame carries the value the
      // implementation entry computed; a fallback that records nothing leaves the slot empty.
      retval: proxyReturnsValue ? options.implementationRetval : new Uint8Array(0),
      segments: proxySegments,
      events: [],
      sends: [],
      // The fallback's one parameter is the frame's own call-data band: the selector push and the argument pushes.
      argumentPushes: pushes,
      redeemScript: proxyMaster.script,
      // A root that carries call data is one a dispatcher selects an entry of; a fallback-only master is the
      // degenerate case, and the flag is what admits its received call data.
      dispatches: true,
    };
  const implementationMasterDraft: DraftMaster = {
    master: IMPLEMENTATION_MASTER_ID,
    contract: implementationArtifact.contractName,
    functionName: entryName(implementationArtifact, options.entry.functionName),
    program: implementationMaster.script,
    facts: factsOf(
      implementationArtifact, options.entry.functionName, FrameKind.DELEGATE, calls.length > 0),
    frame: {
      kind: FrameKind.DELEGATE,
      sender: genesis ? new Uint8Array(0) : options.callerLockingBytecode,
      self: proxyMaster.address,
      value: genesis ? 0n : value,
    },
    enteredBy: PROXY_MASTER_ID,
    origin: genesis ? INDEX_NONE_REFERENCE : USER_ID,
    // The calls the entry's own body makes, in the order it reaches them: the plan states one record per call,
    // whose result is what the callee frame's own body computed.
    calls,
    ...(options.callBases === undefined ? {} : { callBaseBySite: options.callBases }),
    // The value the entry returns, which the plan stated and the derivation learned; empty for a void entry, which
    // the body requires the slot to be.
    retval: options.implementationRetval,
    // A delegate frame runs on the caller's records, so the records it reads and writes are the caller's, which
    // the segment declares: the entry's write is the view the proxy's later segment continues from.
    segments: implementationSegments,
    ...(implementationValues === undefined ? {} : { values: implementationValues }),
    events: eventIndices,
    // Its sends pay from the containers of the proxy whose records it runs on, the first one after a container.
    sends: sendIndices,
    argumentPushes: pushes,
    redeemScript: implementationMaster.script,
  };
  // One frame per callee, entered by the master that calls it: its own master, its own live records declared kept,
  // its own calls and the frames those reach, and the return value the caller's record carries. A callee whose own
  // body rewrites its record is refused by the callee's own frame below rather than declared here.
  const everyCall = [...calls, ...callees.flatMap((callee) => callee.calls)];
  const callTo = new Map<string, DraftCall>();
  for (const call of everyCall) if (!callTo.has(call.callee)) callTo.set(call.callee, call);
  // How many masters of each callee deployment the hop spends: a contract reached at several sites contributes one
  // master per reach to its one block.
  const mastersPerContract = new Map<string, number>();
  for (const callee of callees) {
    mastersPerContract.set(callee.block, (mastersPerContract.get(callee.block) ?? 0) + 1);
  }
  // A category is settled once, however many reaches produced the masters that read it: the hop's own proxy
  // category, each category a delegate frame runs on, each category two or more masters of it are spent under, and
  // each category a frame's own write touches. The parts a settlement needs are merged, so two reaches of one
  // contract make one settlement.
  const settlementOf = new Map<string, { category: Uint8Array; stateInputs: string[]; createdOutputs: number[] }>();
  const settle = (category: Uint8Array, stateInputs: readonly string[], createdOutputs: readonly number[] = []): void => {
    const key = bytesToHex(category);
    const merged = settlementOf.get(key) ?? { category, stateInputs: [], createdOutputs: [] };
    for (const id of stateInputs) if (!merged.stateInputs.includes(id)) merged.stateInputs.push(id);
    for (const out of createdOutputs) if (!merged.createdOutputs.includes(out)) merged.createdOutputs.push(out);
    settlementOf.set(key, merged);
  };
  // The records the transaction spends of a category are the ones its frames declare; a category whose masters all
  // run as delegates on another contract's records spends only what their owners' frames already place.
  const spentRecordsOf = (categoryKey: string): string[] =>
    [...calleeDeclaredRecordsOfCategory(callees, categoryKey)];
  const mastersOfCategory = new Map<string, { category: Uint8Array; count: number }>();
  for (const callee of callees) {
    const key = bytesToHex(callee.category);
    const group = mastersOfCategory.get(key) ?? { category: callee.category, count: 0 };
    group.count += 1;
    mastersOfCategory.set(key, group);
  }
  for (const [key, group] of mastersOfCategory) {
    if (group.count > 1) settle(group.category, spentRecordsOf(key));
  }
  // The root entry's own created records come first in the created region, which the segments declare in master
  // order, so the callees' records follow them.
  trailingCursor += laidWrites?.trailingOutputs.length ?? 0;
  // Each callee frame's own write is laid in the block its records sit in — a call frame's own block, a delegate
  // frame's caller's — and its created records follow the root entry's, so the cursor advances as each is laid.
  // The output each node created earlier in this hop sits at, by the node's own identity (`sharedNodeId`): a later
  // frame names a node it did not spend by that output rather than by an input, so its own declaration chains onto
  // the frame that created it. A slot is the key's alone, so every collection of every contract keys a node by it.
  const createdElsewhere = new Map<string, number>();
  const createdNodeKey = (category: Uint8Array, collection: string, slot: Uint8Array): string =>
    sharedNodeId(bytesToHex(category), collection, slot);
  for (const node of laidWrites?.createdNodes ?? []) {
    createdElsewhere.set(createdNodeKey(options.proxyCategory, node.collection, node.slot), node.out);
  }
  const calleeTrailing = callees.map((callee, position) => {
    const calleeWrites = calleeWritesOf(callee);
    const owner = callee.recordOwner === undefined ? undefined : callees[callee.recordOwner];
    const category = (owner ?? callee).category;
    let laid: LaidHopEntryWrites | undefined;
    let records: ReturnType<typeof laidWriteRecords> | undefined;
    // This frame's own created region starts where the frames laid before it left the cursor.
    const frameCreatedBase = trailingCursor;
    if (calleeWrites !== undefined) {
      laid = calleeWrites.lay({
        indexOf: (id) => participant(layout, id).index,
        proxyMasterIndex: participant(layout, (owner ?? callee).master).index,
        createdBase: frameCreatedBase,
        recordAmount: (owner ?? callee).records[0]?.satoshis ?? options.validatorAmount,
        category,
        learnedViews: options.calleeWriteViews?.get(callee.master) ?? [],
        continuedOutputOf: (collection, slot) => createdElsewhere.get(createdNodeKey(category, collection, slot)),
        releasedLock: userInputLock,
      });
      for (const node of laid.createdNodes) {
        createdElsewhere.set(createdNodeKey(category, node.collection, node.slot), node.out);
      }
      trailingCursor += laid.trailingOutputs.length;
      // Each of the frame's own writes is declared in its own segment, which the artifact publishes per write.
      records = laidWriteRecords({
        laid,
        writes: calleeWrites,
        indexOf: (id) => participant(layout, id).index,
        category,
        createdBase: frameCreatedBase,
        dynamicRuns: dynamicWriteVariables(callee.artifact, callee.entry),
      });
    }
    return { laid, records, createdBase: frameCreatedBase, ...calleeEventPlan[position]! };
  });
  // The proxy's data records are spent state inputs in a hop and created outputs in the genesis.
  settle(
    options.proxyCategory,
    genesis ? [...readNodeIds, ...entryWriteIds] : [...recordIds, ...readNodeIds, ...entryWriteIds],
    [...(genesis ? recordIndices : []), ...(laidWrites?.createdOutputs ?? [])],
  );
  for (const owner of delegateOwnerIndices(callees)) {
    settle(
      callees[owner]!.category,
      calleeDeclaredRecordsOfCategory(callees, bytesToHex(callees[owner]!.category)),
    );
  }
  for (const [key, group] of mastersOfCategory) {
    if (group.count > 1) settle(group.category, spentRecordsOf(key));
  }
  // A frame's own write is settled under the category its records sit at: the frame's own for a call frame, its
  // caller's for the delegate frame a proxied callee reaches. Only a category the hop already settles has one —
  // the settlement rules reach a settled contract, and settling one the validator does not need is itself refused.
  callees.forEach((callee, calleePosition) => {
    const calleeWrites = calleeWritesOf(callee);
    const laid = calleeTrailing[calleePosition]?.laid;
    if (calleeWrites === undefined || laid === undefined) return;
    const owner = callee.recordOwner === undefined ? undefined : callees[callee.recordOwner];
    const category = (owner ?? callee).category;
    if (!settlementOf.has(bytesToHex(category))) return;
    settle(category, calleeWrites.participantIds, laid.createdOutputs);
  });
  // The nodes a frame only reads are state inputs of the category their records sit at, so a settlement that
  // reaches that category accounts for them too, exactly as a frame's own write does.
  for (const callee of callees) {
    if (callee.readNodes.length === 0) continue;
    const owner = callee.recordOwner === undefined ? undefined : callees[callee.recordOwner];
    const category = (owner ?? callee).category;
    if (!settlementOf.has(bytesToHex(category))) continue;
    // A node an earlier reach created is the writer's output, which the writer's own settlement already accounts
    // for: it is spent by no input here, so it is not a state input of this read.
    settle(category, callee.readNodes
      .filter((node) => node.createdSlot === undefined).map((node) => node.id));
  }
  // A frame that calls back into the root runs a further master of the implementation's category, which then has
  // more than one master in the transaction: the validator settles it too, on no record of its own (V8).
  if (callees.some((callee) => bytesEqual(callee.category, options.implementationCategory))) {
    settle(options.implementationCategory, []);
  }
  const settles = [...settlementOf.values()].map((entry) => ({
    category: entry.category,
    stateInputs: entry.stateInputs,
    ...(entry.createdOutputs.length === 0 ? {} : { createdOutputs: entry.createdOutputs }),
  }));
  // The declarations each callee frame's own write transitions a record with, as laid in its write's segment; the
  // copies kept on either side of that segment are not.
  // A data record a callee frame's own body writes. The record is one participant however many frames of that
  // contract declare it, so the frame that writes it is the one whose master authorizes the spend. The value it
  // leaves the record at is the body's own, which the composer reads from the declaration chain rather than the
  // plan, so the writer is named here and no end view is stated.
  const recordWriters = new Map<string, { readonly master: string }>();
  const calleeMasterDrafts: DraftMaster[] = callees.map((callee, calleePosition) => {
    // A frame that owns the records it lists places them; a delegate frame reads the records of the proxy frame
    // that entered it, which are the first ones that frame declares.
    const owned = callee.recordOwner === undefined ? callee.records : callees[callee.recordOwner]!.records;
    // The records the entry's own code reads, in the order its block layout names them: the ones it names first,
    // then, for a batch, the rest a batch's groups follow. The frame's segments declare exactly those, so the read
    // nodes the entry names past them sit where its own group walk reads them.
    const declaredRecords = calleeDeclaredRecords(callee, owned);
    // The nodes the entry only reads sit after the data records, in the order its own code reads them.
    const readEntries: RecordEntry[] = callee.readNodes.map((node): RecordEntry => {
      // A node an earlier reach created carries no input, so this frame names it by that reach's output: the
      // declaration chains onto the created output, exactly as a write over the node does. The node is the one of
      // the category the frame's records sit at.
      if (node.createdSlot !== undefined) {
        const category = (callee.recordOwner === undefined ? callee : callees[callee.recordOwner]!).category;
        const out = createdElsewhere.get(createdNodeKey(category, node.collection, node.createdSlot));
        if (out === undefined) {
          throw new FramedProxyDeployError(
            `the callee's "${callee.functionName}" entry reads a mapping node an earlier reach created, but the `
            + 'hop places no output for it',
          );
        }
        return { in: INDEX_NONE, out, viewIn: node.commitment, viewOut: node.commitment };
      }
      const index = participant(layout, node.id).index;
      return { in: index, out: index, viewIn: node.commitment, viewOut: node.commitment };
    });
    if (hopTraceOn() && callee.readNodes.length > 0) {
      // The nodes the frame reads but does not write: each is declared kept in every segment, so a read the body
      // makes resolves against the view named here. A node an earlier reach created carries no input, so it is
      // named at that reach's output and its view is the one the writer left.
      hopTrace(`callee-reads ${callee.functionName} count=${callee.readNodes.length} `
        + callee.readNodes.slice(0, 4).map((node) => `${node.id}`
          + `:${node.createdSlot === undefined ? 'input' : 'created'}`
          + `@${binToHex(node.commitment).slice(0, 10)}`).join(' '));
    }
    // The frame's own call-data band is the pushes of the call that reaches it; a callee a loop reaches has several
    // records, and the first of them carries the same selector and shape as the rest.
    const argumentPushes = callTo.get(callee.master)?.argumentPushes ?? [];
    // A callee's own sender is the contract that calls it: the caller's own address for a call, and the caller's
    // sender for a delegate frame, which preserves it.
    const sender = calleeSender(
      callees, proxyMaster.address, genesis ? new Uint8Array(0) : options.callerLockingBytecode, callee,
    );
    // A frame that makes k calls closes k + 1 segments, each declaring its own records kept. Each of the frame's
    // own writes lands in the segment its source fixes, which the artifact publishes per write: the records it
    // spends are kept at the commitment they were spent with before that segment and at the written one after it.
    const laidCalleeWrites = calleeTrailing[calleePosition];
    // A data record the frame's own body writes: the artifact publishes every segment a write of it is closed in,
    // so the frame declares the record in each of them — the value it held before the first write, the value the
    // body computes where it wrote, and the value carried on between two writes, which only the body knows.
    const recordWriteSegments = publishedRecordWrites(callee.artifact, callee.entry);
    const positionCount = callee.calls.length + 1;
    const writtenRecords = new Set<number>();
    const recordWriteEntries: DraftRecordEntry[] = [];
    const recordChains = new Map<number, DraftRecordEntry[]>();
    // A published write names its data record by data-record index, which is the frame's position in its own list
    // only when that list starts at record 0 and skips none.
    const declaredRecordAt = (nftIndex: number): HopCalleeRecord | undefined => {
      const record = owned[nftIndex];
      return record !== undefined && declaredRecords.includes(record) ? record : undefined;
    };
    for (const [nftIndex, published] of recordWriteSegments) {
      const record = declaredRecordAt(nftIndex);
      if (record === undefined) continue;
      const index = participant(layout, record.id).index;
      const transitions = new Set(published.map((segment) => (segment === 'last' ? positionCount - 1 : segment)));
      const chain: DraftRecordEntry[] = [];
      let written = false;
      for (let position = 0; position < positionCount; position += 1) {
        if (!transitions.has(position)) {
          // The record is held through this segment, so both views are the one it was entered with: the value the
          // plan knows before the first write, and the value the segment before it ends at afterwards.
          chain.push(written
            ? { in: index, out: index, viewIn: 'carried', viewOut: 'carried' }
            : { in: index, out: index, viewIn: record.commitment, viewOut: record.commitment });
          continue;
        }
        // A write of the record: the body computes the value the segment ends at, so the plan states only where it
        // starts — the commitment the record was spent with for the first write, the carried view for a later one.
        chain.push(written
          ? { in: index, out: index, viewIn: 'carried' }
          : { in: index, out: index, viewIn: record.commitment });
        written = true;
      }
      recordChains.set(nftIndex, chain);
      writtenRecords.add(index);
    }
    const recordsAt = (position: number): DraftRecordEntry[] => declaredRecords.map((record) =>
      recordChains.get(owned.indexOf(record))?.[position]
      ?? { in: participant(layout, record.id).index, out: participant(layout, record.id).index,
        viewIn: record.commitment, viewOut: record.commitment });
    const segments: DraftRecordEntry[][] = Array.from(
      { length: positionCount }, (_unused, position) => [...recordsAt(position), ...readEntries],
    );
    for (const chain of recordChains.values()) for (const entry of chain) if (entry.viewOut === undefined) {
      recordWriteEntries.push(entry);
    }
    for (const entry of recordWriteEntries) writeTransitions.add(entry);
    for (const [nftIndex, published] of recordWriteSegments) {
      const record = declaredRecordAt(nftIndex);
      if (record === undefined) continue;
      // A delegate frame writes its owner's record, which only a master of the owner's category authorizes.
      const authority = callee.recordOwner === undefined ? callee : callees[callee.recordOwner]!;
      recordWriters.set(record.id, { master: authority.master });
      if (hopTraceOn()) {
        const publishedSegments = published.map((segment) => String(segment === 'last' ? positionCount - 1 : segment));
        hopTrace(`callee-record-write ${callee.functionName} record=${String(nftIndex)} `
          + `segments=[${publishedSegments.join(',')}] from=${binToHex(record.commitment)}`);
      }
    }

    if (laidCalleeWrites?.records !== undefined) {
      const laidRecords = laidCalleeWrites.records;
      const placed = resolveLaidWriteSegments(
        laidRecords,
        (write, what) => resolvedWriteSegment({
          artifact: callee.artifact,
          functionName: callee.entry,
          label: `the callee's "${callee.functionName}" entry`,
          what,
          write,
          calls: callee.calls.length,
          ...(callee.truncated === true ? { truncated: true } : {}),
        }),
        `the callee's "${callee.functionName}" entry`,
        readsRunApart(callee.artifact, callee.entry),
      );
      for (const { entry } of placed) writeTransitions.add(entry);
      placeLaidWrites(segments, placed);
      if (hopTraceOn()) {
        // The records this frame declares for its own writes, with the segment span each is placed in and the two
        // views it carries there: a body that reads one of them resolves against the declaration it finds in the
        // segment the read stands in, so the span is what a read that returns the default is compared against.
        const identity = (index: number): string => {
          const write = laidRecords[index]?.write;
          if (write?.collection !== undefined) return `map:${write.collection}`;
          if (write?.variable !== undefined) return `dyn:${write.variable}`;
          if (write?.record !== undefined) return `rec:${write.record}`;
          return write?.read === true ? 'read-run' : '?';
        };
        const short = (bytes: Uint8Array | undefined): string => binToHex(bytes ?? new Uint8Array()).slice(0, 64);
        hopTrace(`callee-placed ${callee.functionName} count=${placed.length} `
          + `segments=${callee.calls.length + 1}`);
        for (const [placedIndex, { span, entry }] of placed.entries()) {
          hopTrace(`callee-record ${callee.functionName} ${identity(placedIndex)} ${String(entry.in)}/${String(entry.out)}`
            + `@${span.least}..${span.most}:${short(entry.viewIn)}>${short(entry.viewOut)}`);
          // A record the plan names at an output alone carries no input, so the body reads its value from the
          // declaration rather than from a spent node: the tail of each view is the value the read resolves to.
          if (entry.in !== INDEX_NONE) continue;
          const tail = (bytes: Uint8Array | undefined): string =>
            binToHex((bytes ?? new Uint8Array()).slice(-8));
          hopTrace(`callee-created ${callee.functionName} out=${String(entry.out)} len`
            + `=${String(entry.viewIn?.length ?? 0)}/${String(entry.viewOut?.length ?? 0)}`
            + ` tail=${tail(entry.viewIn)}>${tail(entry.viewOut)}`);
        }
      }
    }
    const valueWitnesses = calleeValueWitnesses(callee.readNodes, laidCalleeWrites?.laid);
    return {
      master: callee.master,
      contract: callee.block,
      functionName: callee.functionName,
      program: callee.deployed.script,
      facts: {
        contract: callee.block, functionName: callee.functionName, kind: callee.kind,
        callerIsUser: false, originEqualsCaller: false,
        makesExternalCall: callee.calls.length > 0,
        mastersOfContract: mastersPerContract.get(callee.block) ?? 1,
      },
      frame: { kind: callee.kind, sender, self: callee.selfAddress, value: 0n },
      enteredBy: callee.enteredBy === null ? IMPLEMENTATION_MASTER_ID : callees[callee.enteredBy]!.master,
      origin: genesis ? INDEX_NONE_REFERENCE : USER_ID,
      calls: callee.calls,
      ...(callee.callBases.length === 0 ? {} : { callBaseBySite: callee.callBases }),
      // A proxy's fallback records the delegate frame's own `retval`, so the value a caller reads for a call
      // through the proxy is the implementation entry's; every other frame records what its own body computed.
      retval: callee.returns
        ? options.calleeRetvals?.get(
          callee.retvalFrom === undefined ? callee.master : callees[callee.retvalFrom]!.master,
        ) ?? hopRetvalPlaceholder(callee.contract, callee.entry)
        : new Uint8Array(0),
      // A frame that makes k calls closes k + 1 segments, each declaring its own records kept and the one the
      // frame writes in.
      segments,
      ...(valueWitnesses === undefined ? {} : { values: valueWitnesses }),
      // The outputs the frame's own body emits into, in emit order, which its head walks.
      events: calleeTrailing[calleePosition]?.eventIndices ?? [],
      sends: [],
      argumentPushes,
      redeemScript: callee.deployed.script,
    };
  });
  // A node several callee frames touch is one participant: the views they declare of it chain in the order the
  // validator walks the frames, and its output carries the view the last write left. A node an earlier reach
  // created is no participant — the frame that created it names it by an output — so it is chained by that output
  // in the walk below and is left out of the participant set here.
  const sharedNodeIndices = new Set<number>();
  for (const id of chainedNodeIds(callees)) {
    const placed = findParticipant(layout, id);
    if (placed !== undefined) sharedNodeIndices.add(placed.index);
  }
  // A data record a callee frame writes is a participant the frames of that contract share, so its declarations
  // chain in the same walk and the record's output carries the view its last write left.
  for (const id of recordWriters.keys()) {
    const placed = findParticipant(layout, id);
    if (placed !== undefined) sharedNodeIndices.add(placed.index);
  }
  // The root's records chain through every frame that calls back into the root, whichever of them writes.
  if (reentryCall !== undefined) for (const index of recordIndices) sharedNodeIndices.add(index);
  // The created nodes each frame's own settlement stated an end view for: a frame that held a node an earlier frame
  // created never closes it, so it states none, and the walk below can tell the two apart by this alone.
  const learnedOutputs = new Map<string, ReadonlySet<number>>();
  callees.forEach((callee, position) => {
    const laid = calleeTrailing[position]?.laid;
    if (laid === undefined) return;
    learnedOutputs.set(callee.master, new Set(laid.createdNodes
      .filter((node) => laid.learnedSlots.some((learned) => learned.collection === node.collection
        && bytesEqual(learned.slot, node.slot)))
      .map((node) => node.out)));
  });
  // The records that only relink a node: the walk restates each one's end view from the view the chain reaches it at.
  const relinkTransitions = new Set<DraftRecordEntry>([
    ...(laidWrites?.relinked ?? []),
    ...calleeTrailing.flatMap((written) => written.laid?.relinked ?? []),
  ]);
  const chained = chainSharedNodeViews(
    [proxyMasterDraft, implementationMasterDraft, ...calleeMasterDrafts], PROXY_MASTER_ID, sharedNodeIndices,
    writeTransitions, learnedOutputs, options.heldContinuations === true, relinkTransitions,
  );
  const chainedRegular = chained.masters.filter((master) => !('output' in master)) as DraftMaster[];
  const chainedMinted = chained.masters.filter((master) => 'output' in master) as DraftMintedMaster[];
  const proxyMasterAmount = options.proxyMasterAmount;
  const implementationMasterAmount = options.implementationMasterAmount;
  const proxyRecordAmount = genesis ? options.genesisValidatorAmount ?? options.validatorAmount : options.validatorAmount;
  // The proxy's containers the sends are paid from follow the caller's coin, each opened by the proxy's master.
  const containerSpends = paying?.spent ?? [];
  const plan: CompositionDraftPlan = {
    blocks,
    // The genesis's funder is the proxy's own funding coin, which creates the category: it leads the transaction
    // rather than entering it after the participants, and it is not a root caller (the minted master has none).
    ...(leading.length === 0 ? {} : { leading }),
    userInputs: [
      ...(leading.length === 0 ? [{ id: USER_ID, index: layout.participantCount }] : []),
      ...containerSpends.map((_utxo, position) => ({
        id: hopContainerId(position), index: layout.participantCount + 1 + position,
      })),
    ],
    masters: chainedRegular,
    ...(chainedMinted.length === 0 ? {} : { mintedMasters: chainedMinted }),
    // The chain's own time, read from the provider: a body that reads the transaction's locktime sees it.
    locktime: providerUnixLocktime(options.provider as { getBlockTime?: () => number }),
    // A stated locktime means nothing to `OP_CHECKLOCKTIMEVERIFY` on a final input, and the builder's own
    // default is non-final, so the hop states the same rather than leaving the composer's final default.
    sequenceNumber: 0xfffffffe,
    inputs: withChainEnds(layout.participants, chained.ends, {
      // The genesis mints the proxy master rather than spending it, so it has no input of its own.
      ...(genesis ? {} : {
        [PROXY_MASTER_ID]: {
          source: masterSource(proxyMaster.lockingBytecode, options.proxyCategory, proxyMasterAmount),
        },
      }),
      [IMPLEMENTATION_MASTER_ID]: {
        source: masterSource(
          implementationMaster.lockingBytecode, options.implementationCategory, implementationMasterAmount,
        ),
      },
      [VALIDATOR_ID]: {
        source: mutableSource(validatorLock, proxyRecordAmount, validatorCategory, new Uint8Array(0)),
      },
      // The proxy's data records are spent in a hop and created in the genesis, which mints them with the written
      // commitments rather than spending them.
      ...(genesis ? {} : Object.fromEntries(recordIds.map((id, nftIndex) => [id, {
        source: mutableSource(
          options.recordLockingBytecode, options.recordAmounts[nftIndex]!, options.proxyCategory,
          options.recordCommitments[nftIndex]!,
        ),
        // A record a frame that calls back into the root shares ends where its chain of declarations ends, which
        // the composer reads from the views the frames closed with.
        ...(reentryCall !== undefined ? {} : {
          output: mutableSource(
            options.recordLockingBytecode, options.recordAmounts[nftIndex]!, options.proxyCategory,
            options.writtenCommitments[nftIndex]!,
          ),
        }),
        // The covenant's write path names the master of the record's category that authorizes the spend; a record
        // no frame writes is spent on the read-only path, which needs no master.
        unlockingBytecode: stateRecordUnlockingBytecode(
          options.recordCategoryHex, proxyMasterIndex, writes[nftIndex]! || recordWriters.has(id) ? 1 : 0,
        ),
      }]))),
      [USER_ID]: {
        source: { lockingBytecode: userInputLock, valueSatoshis: options.callerSatoshis },
        unlockingBytecode: callerUnlocking(),
        // The genesis's funding coin recreates as the proxy's authhead, the record its minted root declares above.
        ...(genesisIdentity === undefined ? {} : {
          output: mutableSource(
            authheadLockingBytecode(genesisIdentity.category), genesisIdentity.output.amount, options.proxyCategory,
            genesisIdentity.owner,
          ),
        }),
      },
      ...Object.fromEntries(callees.flatMap((callee) => {
        const masterEntry = [callee.master, {
          source: masterSource(callee.deployed.lockingBytecode, callee.category, callee.masterSatoshis),
        }] as const;
        // A delegate frame's records are its owner's, spent at the owner's category; each frame declares the
        // records its own block layout names, and the two frames' declarations union into the same inputs.
        const owner = callee.recordOwner === undefined ? undefined : callees[callee.recordOwner]!;
        const recordCategory = (owner ?? callee).category;
        const recordCategoryId = (owner ?? callee).categoryId;
        const owned = owner === undefined ? callee.records : owner.records;
        // The root's own records, which a frame that calls back into the root declares, are the root's entries.
        const placedRecords = calleeDeclaredRecords(callee, owned).filter((record) => !recordIds.includes(record.id));
        const recordEntries = placedRecords.map((record) => {
          // A record the frame's own body writes is spent on the covenant's write path, authorized by the master
          // that writes it, and recreated at the view that write leaves; every other record is read-only.
          const writer = recordWriters.get(record.id);
          return [record.id, {
            source: mutableSource(record.lockingBytecode, record.satoshis, recordCategory, record.commitment),
            // The record a written body recreates carries the value that body computes, which the composer reads from
            // the declaration chain it learns; a record no frame here writes recreates unchanged.
            ...(writer === undefined ? {
              output: mutableSource(record.lockingBytecode, record.satoshis, recordCategory, record.commitment),
            } : {}),
            unlockingBytecode: stateRecordUnlockingBytecode(
              recordCategoryId, participant(layout, writer?.master ?? callee.master).index, writer === undefined ? 0 : 1,
            ),
          }] as const;
        });
        // The nodes the entry only reads are spent on the entry covenant's read-only path and recreated unchanged,
        // so no output is stated for them. A node an earlier reach created carries no input, so it is skipped here.
        const readNodeEntries = callee.readNodes
          .filter((node) => node.createdSlot === undefined)
          .map((node) => {
            const { lockingBytecode, unlockingBytecode } = entryRecordReadUnlock(recordCategoryId, node.signature);
            return [node.id, {
              source: mutableSource(lockingBytecode, node.utxo!.satoshis, recordCategory, node.commitment),
              unlockingBytecode,
            }] as const;
          });
        return [masterEntry, ...recordEntries, ...readNodeEntries];
      })),
      // The nodes the entry itself only reads, spent the same way at the proxy's category; one its batch also spends
      // is the batch's input.
      ...Object.fromEntries(readNodes.filter((node) => node.createdSlot === undefined
        && batchInputOf(node) === undefined).map((node) => {
        const { lockingBytecode, unlockingBytecode } = entryRecordReadUnlock(options.recordCategoryHex, node.signature);
        return [node.id, {
          source: mutableSource(lockingBytecode, node.utxo!.satoshis, options.proxyCategory, node.commitment),
          unlockingBytecode,
        }] as const;
      })),
      ...(laidWrites?.inputs ?? {}),
      // Each callee frame's own write spends the collection nodes it names, which its own block already placed.
      ...Object.assign({}, ...calleeTrailing.map((written) => written?.laid?.inputs ?? {})),
      // Every side-car the hop's frames co-spend, placed in their own block after the master that reads them.
      ...sideCarInputs,
      // The genesis carries no caller value, so it has no container spends.
      ...(genesis || options.value === undefined
        ? {}
        : hopContainerInputs(options.value.hop, containerSpends, proxyMasterIndex)),
    }),
    validator: {
      id: VALIDATOR_ID,
      // The proxy's own block hosts the validator, a frame that calls back into the root included.
      covers: [...new Set([implementationArtifact.contractName, ...callees.map((callee) => callee.block)])]
        .filter((contract) => contract !== proxyArtifact.contractName),
      settles,
      redeemScript: validatorRedeemScript(validatorCategory, framedValidator.buildValidatorProgram()),
    },
    // The event outputs fill the trailing region in emit order, each an immutable token of the proxy's category at
    // the covenant the body rebuilds, carrying the payload the entry computed. A created mapping node follows them.
    trailingOutputs: [
      ...options.eventOutputs.map((output): DraftSourceOutput => ({
        lockingBytecode: output.lockingBytecode,
        valueSatoshis: EVENT_OUTPUT_SATOSHIS,
        token: {
          category: options.proxyCategory, amount: 0n,
          nft: { capability: 'none', commitment: output.commitment },
        },
      })),
      // Every callee frame's events follow the root entry's, in master order, which is the order the assembler
      // allocates the event region in.
      ...calleeEventPlan.flatMap((planned): DraftSourceOutput[] => planned.eventOutputs.map(
        (output): DraftSourceOutput => ({
          lockingBytecode: output.lockingBytecode,
          valueSatoshis: EVENT_OUTPUT_SATOSHIS,
          token: {
            category: planned.category, amount: 0n,
            nft: { capability: 'none', commitment: output.commitment },
          },
        }),
      )),
      // The implementation's sends follow the events: a container of the proxy, then one output per send.
      ...valueOutputs?.run ?? [],
      // The proxy's data records, created at the trailing indices the settlement names when the genesis mints them.
      ...(genesis
        ? recordIds.map((_id, nftIndex) => mutableSource(
          options.recordLockingBytecode, options.recordAmounts[nftIndex]!, options.proxyCategory,
          options.writtenCommitments[nftIndex]!,
        ))
        : []),
      ...withCreatedChainEnds(laidWrites?.trailingOutputs ?? [], createdBase, chained.createdEnds),
      // Each callee frame's own created records follow the root entry's, in the order the frames are placed.
      ...calleeTrailing.flatMap((written) => withCreatedChainEnds(
        written.laid?.trailingOutputs ?? [], written.createdBase, chained.createdEnds)),
      // The proxy's container, when no send precedes it: the value the call brings, or the change it leaves.
      ...valueOutputs?.kept ?? [],
    ],
    // The witnesses the frames' own bodies compute for their side-cars, each learned from the body's own bind.
    ...(computedWitnesses.length === 0 ? {} : { computedWitnesses }),
  };
  // The frames the plan lays, in order, with the calls it states for each: the plan states a callee identity and the
  // target address, while the assembled draft is what carries the callee reference.
  if (hopTraceOn()) {
    for (const master of plan.masters) {
      const masterCalls = master.calls.map((call) =>
        `${call.callee}:${frameKindName(call.kind)}->${binToHex(call.target).slice(0, 8)}`).join(' ');
      const self = (master.frame as { readonly selfAddress?: Uint8Array }).selfAddress;
      hopTrace(`plan ${traceFrameFacts(master.master, master.functionName, master.frame.kind)} `
        + `contract=${master.contract} self=${self === undefined ? 'none' : binToHex(self).slice(0, 12)} `
        + `calls=[${masterCalls}]`);
    }
  }
  return plan;
}

/** The satoshi value an event output carries, as a genesis's own event outputs do. */
const EVENT_OUTPUT_SATOSHIS = 1_000n;

/** The provider's own BCH-2026 machine, for a caller that does not supply one. */
async function providerMachine(provider: NetworkProvider): Promise<Machine> {
  const { createVirtualMachineBch2026ForProvider } = await import('../../network/createVirtualMachine.js');
  return createVirtualMachineBch2026ForProvider(provider);
}

/** An input the composer already assembled: its lock and unlocking bytecode are the hop's, not re-derived here. */
function rawUnlocker(lockingBytecode: Uint8Array, unlockingBytecode: Uint8Array): Unlocker {
  return {
    generateLockingBytecode: () => lockingBytecode,
    generateUnlockingBytecode: () => unlockingBytecode,
  };
}

/** Everything the hop's rebuild reads: the derived specification, the deployment's pools and the caller's coin. */
interface BroadcastHopOptions {
  readonly provider: NetworkProvider;
  readonly callerFunding: FramedProxyCallerFunding;
  readonly callerLockingBytecode: Uint8Array;
  readonly proxyArtifact: Artifact;
  readonly implementationArtifact: Artifact;
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  /** The derived hop: the specification every input's unlocking bytecode and every output is taken from. */
  readonly program: ShippedVmProgram;
  readonly draft: CompositionDraft;
  /**
   * The UTXO each participant the entry spends sits on, when its id does not name one the pools can be searched for.
   *
   * A dynamic value's chunk id carries neither a slot nor a collection, so the hop hands the live outpoint back
   * rather than have the rebuild search the category for it again.
   */
  readonly spentUtxos?: ReadonlyMap<string, Utxo>;
  /** The proxy's containers the implementation's sends are paid from, at the indices after the caller's coin. */
  readonly containerInputs?: readonly { readonly index: number; readonly utxo: Utxo }[];
  /** A calling genesis's BCMR publication, after every settled output: the validator constrains no token-free one. */
  readonly publication?: Output;
}

/** The live UTXO a participant sits on, read back by category so no genesis output index is assumed. */
function participantUtxo(
  pools: {
    masters: readonly Utxo[]; validators: readonly Utxo[]; records: readonly Utxo[];
    collectionNodes: readonly Utxo[];
  },
  id: string,
  /** The lock the participant's own source carries, which tells two collections' nodes apart. */
  lockingBytecode?: Uint8Array,
): Utxo | undefined {
  const sameLock = (node: Utxo): boolean => lockingBytecode === undefined
    || (node.lockingBytecode !== undefined && bytesToHex(node.lockingBytecode) === bytesToHex(lockingBytecode));
  const nftIndex = recordIndexOfRecord(id);
  if (nftIndex !== undefined) return pools.records[nftIndex];
  const headCollection = mappingHeadCollection(id);
  if (headCollection !== undefined) {
    // The genesis minted the collection's empty head, and no write has moved it yet, so the live node carrying the
    // empty list's own commitment, at that collection's own lock, is the one the hop spends. Every collection's
    // empty head carries the same commitment, so the lock is what tells one collection's head from another's.
    const head = bytesToHexText(headSentinelCommitment());
    return pools.collectionNodes.find((node) => node.token?.nft?.commitment === head && sameLock(node));
  }
  const nodeSlot = mappingNodeSlot(id);
  if (nodeSlot !== undefined) {
    // A node the entry spends that is not the empty head: its id names the slot, which its commitment carries.
    const slot = bytesToHex(nodeSlot);
    return pools.collectionNodes.find((node) => {
      const commitment = node.token?.nft?.commitment;
      return commitment !== undefined && sameLock(node)
        && bytesToHex(decodeEntryCommitment(new Uint8Array(hexToBin(commitment))).slot) === slot;
    });
  }
  const pool = id === PROXY_MASTER_ID || id === IMPLEMENTATION_MASTER_ID ? pools.masters
    : id === VALIDATOR_ID ? pools.validators
      : undefined;
  // A split implementation holds one pool per entry lock, so the master is the one at the lock the plan spends.
  return pool?.find(sameLock) ?? pool?.[0];
}

/**
 * One participant's planned source output beside the live UTXO the hop will actually spend, as one trace line.
 *
 * The settle evaluates each input against the plan's own `sourceOutputs`, while the network resolves an input's
 * source output from the outpoint it spends; a hop that settles and then fails verification differs in exactly this
 * pair, so the line states both. The locks are printed as a length and the first bytes of their hash, which is what
 * tells two lock scripts apart inside the trace's line limit.
 */
function describeSourceOutput(
  planned: { readonly lockingBytecode: Uint8Array; readonly valueSatoshis: bigint;
    readonly token?: { readonly category: Uint8Array; readonly amount: bigint;
      readonly nft?: { readonly capability: unknown; readonly commitment: Uint8Array } } },
  live: { readonly lockingBytecode?: Uint8Array; readonly satoshis: bigint; readonly token?: Utxo['token'] },
): string {
  const hex = (bytes: Uint8Array | string): string => (typeof bytes === 'string' ? bytes : binToHex(bytes));
  const lock = (bytes: Uint8Array | undefined): string => bytes === undefined
    ? 'none'
    : `${bytes.length}@${binToHex(sha256(bytes)).slice(0, 12)}`;
  const tokenOf = (token: typeof planned.token | Utxo['token']): string => token === undefined
    ? 'none'
    : `${hex(token.category).slice(0, 12)}/${token.amount.toString()}/`
      + `${token.nft === undefined ? 'none' : `${String(token.nft.capability)}:${hex(token.nft.commitment).slice(0, 12)}`}`;
  return `${lock(planned.lockingBytecode)} ${planned.valueSatoshis} ${tokenOf(planned.token)}`
    + ` | live ${lock(live.lockingBytecode)} ${live.satoshis} ${tokenOf(live.token)}`;
}

/**
 * One libauth source output as a trace field: its lock's length and hash, its value, its token and its commitment.
 */
function describeLibauthOutput(output: unknown): string {
  const typed = output as {
    readonly lockingBytecode?: Uint8Array;
    readonly valueSatoshis?: bigint;
    readonly token?: { readonly category: Uint8Array; readonly amount: bigint;
      readonly nft?: { readonly capability: unknown; readonly commitment: Uint8Array } };
  };
  if (typed === undefined) return 'none';
  const lock = typed.lockingBytecode === undefined
    ? 'none'
    : `${typed.lockingBytecode.length}@${binToHex(sha256(typed.lockingBytecode)).slice(0, 12)}`;
  const token = typed.token === undefined
    ? 'none'
    : `${binToHex(typed.token.category).slice(0, 12)}/${typed.token.amount.toString()}/`
      + `${typed.token.nft === undefined ? 'none' : String(typed.token.nft.capability)}`;
  return `${lock} ${String(typed.valueSatoshis ?? '')} ${token}`;
}

/**
 * Evaluates the assembled transaction the way the network will and traces every input that refuses.
 *
 * The settle evaluates each input against the plan's own `sourceOutputs`; the network resolves an input's source
 * output from the outpoint the transaction spends, and the two need not agree about everything. This runs the
 * assembled transaction - its real outpoints, the builder's own source outputs and the caller's change - through
 * the same machine, so an input that the settle accepted and the network refuses is named with its instruction.
 */
async function traceAssembledHop(
  builder: { buildLibauthProgram(skipChecks?: boolean): {
    transaction: { readonly inputs: readonly unknown[] };
    sourceOutputs: readonly unknown[];
  } },
  provider: NetworkProvider,
  program: { readonly sourceOutputs: readonly unknown[]; readonly transaction: unknown },
): Promise<void> {
  const { transaction, sourceOutputs } = builder.buildLibauthProgram(true);
  const machine = await providerMachine(provider);
  for (let index = 0; index < transaction.inputs.length; index += 1) {
    const state = machine.evaluate({
      inputIndex: index,
      sourceOutputs: sourceOutputs as never,
      transaction: transaction as never,
    }) as unknown as { readonly error?: string; readonly ip?: number;
      readonly stack?: readonly Uint8Array[]; readonly altStack?: readonly Uint8Array[] };
    if (machine.stateSuccess(state as never) === true) continue;
    hopTrace(`assembled ${index} ${String(state.error ?? '')} ip=${String(state.ip ?? '')}`);
    hopTrace(`assembled-source ${index} `
      + `${describeLibauthOutput(sourceOutputs[index])} | plan ${describeLibauthOutput(program.sourceOutputs[index])}`);
    hopTrace(`stack ${index} ${(state.stack ?? []).slice(-6).map((item) =>
      `${item.length}:${binToHex(item)}`).join(' ')}`);
    const instructions = (state as unknown as { readonly instructions?: readonly { readonly opcode: number }[] })
      .instructions ?? [];
    const at = Number(state.ip ?? 0) - 1;
    const nameOf = (opcode: number): string =>
      Object.entries(OpcodesBch2023).find(([, value]) => value === opcode)?.[0] ?? String(opcode);
    hopTrace(`instr ${index} ${instructions.slice(Math.max(0, at - 12), at + 3)
      .map((instruction, offset) => `${Math.max(0, at - 12) + offset}:${nameOf(instruction.opcode)}`)
      .join(' ')}`);
    const operands = await equalityOperands(provider, index, sourceOutputs, transaction);
    if (operands !== undefined) {
      hopTrace(`operands ${index} ${operands.map((item) => `${item.length}:${binToHex(item)}`).join(' vs ')}`);
    }
    {
      const { decodeAuthenticationInstructions } = await import('@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js');

      const { decideReference } = await import('../validator/reference/index.js');
      type Holder = { readonly token?: { category: Uint8Array; amount: bigint;
        nft?: { capability: string; commitment: Uint8Array } } };
      const shape = (holder: Holder): { category: Uint8Array; capability: number; hasNft: boolean;
        nftCommitment: Uint8Array; amount: bigint } => (holder.token === undefined
        ? { category: new Uint8Array(0), capability: 0, hasNft: false, nftCommitment: new Uint8Array(0), amount: 0n }
        : {
          category: holder.token.category,
          capability: holder.token.nft?.capability === 'minting' ? 2
            : (holder.token.nft?.capability === 'mutable' ? 1 : 0),
          hasNft: holder.token.nft !== undefined,
          nftCommitment: holder.token.nft?.commitment ?? new Uint8Array(0),
          amount: holder.token.amount,
        });
      const built = transaction as {
        readonly inputs: readonly { outpointTransactionHash: Uint8Array; outpointIndex: number;
          unlockingBytecode: Uint8Array }[];
        readonly outputs: readonly { valueSatoshis: bigint; lockingBytecode: Uint8Array }[];
      };
      // The input that carries a transcript and a redeem script is the validator, as the reference model finds it.
      const framesOf = (unlockingBytecode: Uint8Array): readonly Uint8Array[] => {
        try {
          return decodeAuthenticationInstructions(unlockingBytecode)
            .map((instruction) => ('data' in instruction ? instruction.data : new Uint8Array(0)));
        } catch {
          return [];
        }
      };
      let validatorIndex = -1;
      for (const [position, input] of built.inputs.entries()) {
        const frames = framesOf(input.unlockingBytecode);
        if (frames.length !== 2) continue;
        try {
          decodeTranscript(frames[0]!);
          validatorIndex = position;
          break;
        } catch {
          // not the validator's unlocking bytecode
        }
      }
      if (validatorIndex >= 0) {
        const decision = decideReference({
          inputs: built.inputs.map((input, position) => ({
            index: position, value: (sourceOutputs[position] as { valueSatoshis: bigint }).valueSatoshis,
            lockingBytecode: (sourceOutputs[position] as { lockingBytecode: Uint8Array }).lockingBytecode,
            unlockingBytecode: input.unlockingBytecode,
            token: shape(sourceOutputs[position] as Holder),
            outpointTransactionHash: input.outpointTransactionHash, outpointIndex: input.outpointIndex,
          })),
          outputs: built.outputs.map((output, position) => ({
            index: position, value: output.valueSatoshis, lockingBytecode: output.lockingBytecode,
            token: shape(output as Holder),
          })),
        }, { validatorTemplate: framedValidator.buildValidatorProgram(), validatorInputIndex: validatorIndex });
        hopTrace(`reference ${index} accepted=${String(decision.accepted)} check=${String(decision.check)} `
          + `reason=${String(decision.reason)} at=${String(decision.index)}`);
      }
    }
    hopTrace(`altstack ${index} ${(state.altStack ?? []).slice(-4).map((item) => binToHex(item)).join(' ')}`);
    await traceAssembledDiff(transaction, program);
  }
}

/**
 * The two items the failing `OP_EQUALVERIFY` compared, taken by stepping the input in place.
 *
 * A failed comparison has already consumed its operands, so the state the machine returns no longer carries them.
 * The step before the failure is where they still exist: the last `OP_EQUALVERIFY` the input reached had this
 * stack, and those two items are what disagreed.
 */
async function equalityOperands(
  provider: NetworkProvider,
  inputIndex: number,
  sourceOutputs: readonly unknown[],
  transaction: unknown,
): Promise<readonly Uint8Array[] | undefined> {
  const { createFaithfulTraceVmForProvider } = await import('../../network/createVirtualMachine.js');
  const { OpcodesBchSpec: Opcodes } = await import('@bitauth/libauth/build/lib/vm/instruction-sets/bch/spec/bch-spec-opcodes.js');

  let operands: readonly Uint8Array[] | undefined;
  const observing = createFaithfulTraceVmForProvider(provider, (observed) => {
    const state = observed as { readonly ip: number; readonly instructions: readonly { readonly opcode: number }[];
      readonly stack: readonly Uint8Array[] };
    if (state.instructions[state.ip]?.opcode === Opcodes.OP_EQUALVERIFY) operands = state.stack.slice(-2);
  });
  observing.evaluate({ inputIndex, sourceOutputs, transaction } as never);
  return operands;
}

/**
 * Traces how the assembled transaction differs from the one the settle evaluated, input by input and output by
 * output. The two carry the same plans, so only the outpoints, the caller's own coin and its change can differ;
 * a hop that settles and then refuses verification is decided by one of those.
 */
async function traceAssembledDiff(transaction: unknown, program: unknown): Promise<void> {
  interface HopTransaction {
    readonly inputs: readonly { readonly outpointTransactionHash: Uint8Array; readonly outpointIndex: number;
      readonly unlockingBytecode: Uint8Array; readonly sequenceNumber: number }[];
    readonly outputs: readonly unknown[]; readonly locktime: number;
  }
  const built = transaction as HopTransaction;
  const planned = (program as { readonly transaction: HopTransaction }).transaction;
  hopTrace(`diff counts plan ${planned.inputs.length}/${planned.outputs.length}/${planned.locktime} `
    + `assembled ${built.inputs.length}/${built.outputs.length}/${built.locktime}`);
  for (let index = 0; index < built.inputs.length; index += 1) {
    const left = built.inputs[index]!;
    const right = planned.inputs[index];
    const sameUnlock = right !== undefined
      && binToHex(left.unlockingBytecode) === binToHex(right.unlockingBytecode);
    const sameOutpoint = right !== undefined
      && binToHex(left.outpointTransactionHash) === binToHex(right.outpointTransactionHash)
      && left.outpointIndex === right.outpointIndex;
    const sameSequence = right !== undefined && left.sequenceNumber === right.sequenceNumber;
    if (sameUnlock && sameOutpoint && sameSequence) continue;
    hopTrace(`diff input ${index} unlock=${sameUnlock ? 'same' : `${left.unlockingBytecode.length}/`
      + `${binToHex(sha256(left.unlockingBytecode)).slice(0, 8)} vs `
      + `${right === undefined ? 'none' : `${right.unlockingBytecode.length}/`
        + binToHex(sha256(right.unlockingBytecode)).slice(0, 8)}`} `
      + `outpoint=${sameOutpoint ? 'same' : `${binToHex(left.outpointTransactionHash).slice(56)}:${left.outpointIndex}`} `
      + `sequence=${sameSequence ? 'same' : String(left.sequenceNumber)}`);
  }
  for (let index = 0; index < built.outputs.length; index += 1) {
    const left = describeLibauthOutput(built.outputs[index]);
    const right = describeLibauthOutput(planned.outputs[index]);
    if (index < planned.outputs.length && left === right) continue;
    if (index >= planned.outputs.length) hopTrace(`diff output ${index} assembled-only ${left}`);
    else hopTrace(`diff output ${index} ${left} | plan ${right}`);
  }
}

/**
 * Rebuilds the derived hop on the outpoints the two geneses created, signs the caller's input, and broadcasts it.
 *
 * The derived hop is the specification: each participant input keeps the unlocking bytecode the composer
 * assembled, each participant output is recreated as it was, and the record ends at the commitment the entry
 * computed. What changes is where the inputs sit — the implementation's and proxy's masters, the validator pool,
 * the record the proxy's genesis minted, and the caller's own coin, at the outpoints the geneses actually
 * created — and, with them, where the caller's leftover satoshis go: the change is a single output to the caller,
 * leaving room for the relay fee the derived hop did not carry.
 *
 * Supplying the caller's funding is what makes this the real hop; the derived transaction stays the answer when
 * it is absent.
 */
async function broadcastHop(options: BroadcastHopOptions): Promise<TransactionDetails> {
  const { provider, callerFunding, program, draft } = options;
  const callerLock = callerFunding.funder.generateLockingBytecode();
  if (!bytesEqual(callerLock, options.callerLockingBytecode)) throw new FramedProxyDeployError(CALLER_LOCK_REFUSAL);

  // The pools the two geneses published, read back by category and classified the way a framed deployment mints
  // them, so a participant is placed on the outpoint it actually sits on rather than a genesis output index.
  const proxyPools = await readFramedDeployment(
    provider, options.proxyCategoryId, options.proxyArtifact.stateLayout!);
  const implementationPools = await readFramedDeployment(
    provider, options.implementationCategoryId, options.implementationArtifact.stateLayout!);

  const { TransactionBuilder } = await import('../../TransactionBuilder.js');
  // The hop's own shape is fixed - the composer assembled every contract input and there is no oracle or side-car
  // to co-spend - so the builder must not append anything. A record a write consumes with no successor, a chunk a
  // shorter value drops, leaves its index without its token, which the builder would take for an accidental burn;
  // the check stays on for a caller's coin that carries a token, which no record's burn explains.
  const consumesRecord = callerFunding.utxo.token === undefined && draft.layout.participants.some((placed) =>
    program.sourceOutputs[placed.index]?.token?.nft !== undefined
    && program.transaction.outputs[placed.index]?.token === undefined);
  const builder = new TransactionBuilder({
    provider, skipAutomaticCoSpends: true, ...(consumesRecord ? { allowImplicitNftBurn: true } : {}),
  });
  // The builder defaults to locktime 0, which would serialize a different transaction than the one derived: the
  // hop's signature and every frame that reads `block.timestamp` were made over the derived locktime, so the
  // broadcast carries that same one.
  builder.setLocktime(program.transaction.locktime ?? 0);
  // The outpoint every participant resolves to, so a hop that cannot broadcast a duplicated outpoint names the two
  // participants that share it instead of only the transaction's input index.
  const resolved = new Map<string, string>();
  // A genesis's funding coin is the caller's coin and leads the transaction, signed like it over the real one.
  const leads = draft.layout.participants.some((placed) => placed.kind === 'leading');
  for (const placed of draft.layout.participants) {
    if (placed.kind === 'leading') {
      hopTrace(`leading input ${callerFunding.utxo.txid}:${callerFunding.utxo.vout} ${callerFunding.utxo.satoshis}`);
      builder.addInput(callerFunding.utxo, callerFunding.funder);
      continue;
    }
    const source = program.sourceOutputs[placed.index];
    const unlockingBytecode = program.transaction.inputs[placed.index]?.unlockingBytecode;
    if (source === undefined || unlockingBytecode === undefined) {
      throw new FramedProxyDeployError(
        `the derived hop carries no input for participant "${placed.id}"`);
    }
    // A validator's facet holds no token and pins no category, so any live UTXO of its code serves the input; the
    // composer supplies its source, so the lookup is by the lock the plan states.
    const facetUtxos = placed.kind === 'facet'
      ? await provider.getUtxosForLockingBytecode(source.lockingBytecode)
      : [];
    const real = options.spentUtxos?.get(placed.id)
      ?? participantUtxo(placed.id === IMPLEMENTATION_MASTER_ID ? implementationPools : proxyPools, placed.id,
        source.lockingBytecode)
      ?? facetUtxos.find((utxo) => utxo.satoshis === source.valueSatoshis)
      ?? facetUtxos[0];
    if (real === undefined) {
      throw new FramedProxyDeployError(
        `the deployment holds no live UTXO for the hop's "${placed.id}"`);
    }
    if (real.satoshis !== source.valueSatoshis) {
      throw new FramedProxyDeployError(
        `the hop's "${placed.id}" holds ${real.satoshis} satoshis, but the derived hop spends `
        + `${source.valueSatoshis}`,
      );
    }
    const token = source.token === undefined
      ? {}
      : { token: libauthTokenDetailsToSolidCashTokenDetails(source.token) };
    const utxo: Utxo = { txid: real.txid, vout: real.vout, satoshis: source.valueSatoshis, ...token };
    const outpoint = `${utxo.txid}:${utxo.vout}`;
    hopTrace(`participant ${placed.index} ${placed.id} ${placed.kind} ${outpoint}`);
    hopTrace(`source ${placed.index} ${describeSourceOutput(source, real)}`);
    hopTrace(`source-len ${placed.index} plan=${String(source.token?.nft?.commitment?.length ?? -1)} `
      + `live=${String(real.token?.nft?.commitment?.length ?? -1)}`);
    const shared = resolved.get(outpoint);
    // Two participants on one outpoint is what the builder refuses, and both ids are wider than one trace line, so
    // the pair gets a line each.
    if (shared !== undefined) {
      hopTrace(`shared ${outpoint} ${shared}`);
      hopTrace(`shared ${outpoint} ${placed.id}`);
    }
    resolved.set(outpoint, placed.id);
    // The sequence the derived hop carries, so the broadcast is the same transaction the frames were evaluated
    // against rather than one the builder's own default rewrites.
    const sequence = program.transaction.inputs[placed.index]?.sequenceNumber;
    builder.addInput(utxo, rawUnlocker(source.lockingBytecode, unlockingBytecode),
      sequence === undefined ? undefined : { sequence });
  }
  // The deployer's own coin funds the hop and is the frame's root caller; its signature is a real one over the
  // real transaction, which is what the root's `msg.sender` binding and the provider both check. Its sequence is
  // the caller's own choice, not the composer's. A coin that leads the transaction was added above.
  for (const [index, funder] of program.sourceOutputs.entries()) {
    if (index < draft.layout.participantCount) continue;
    hopTrace(`funder ${index} source ${describeSourceOutput(funder, callerFunding.utxo)}`);
  }
  if (!leads) {
    hopTrace(`caller input ${callerFunding.utxo.txid}:${callerFunding.utxo.vout} ${callerFunding.utxo.satoshis}`);
    builder.addInput(callerFunding.utxo, callerFunding.funder);
  }
  // The proxy's containers follow the caller's coin, each with the unlocking the derived hop carries.
  for (const { index, utxo } of options.containerInputs ?? []) {
    const source = program.sourceOutputs[index];
    const unlockingBytecode = program.transaction.inputs[index]?.unlockingBytecode;
    if (source === undefined || unlockingBytecode === undefined) {
      throw new FramedProxyDeployError(`the derived hop carries no container input at ${index}`);
    }
    builder.addInput(utxo, rawUnlocker(source.lockingBytecode, unlockingBytecode));
  }

  // Every participant recreates in place, so its output index is its input index; anything the composer placed
  // after them (events, sends, created records) is trailing. The funders' recreations are replaced by the
  // caller's change below, which is the only non-participant the plan has.
  const settled = draft.layout.participantCount + draft.trailingOutputs.length;
  for (const output of program.transaction.outputs.slice(0, settled)) {
    builder.addOutput(libauthOutputToSolidCashOutput(output));
  }
  if (options.publication !== undefined) builder.addOutput(options.publication);
  builder.addBchChangeOutputIfNeeded({
    to: callerFunding.changeAddress ?? options.callerLockingBytecode, feeRate: 1,
  });

  // A composition's assembled unlocking bytecodes are wider than the production per-input ceiling (the validator's
  // alone is over 10,000 bytes), which the composition profile the hop runs under widens. `TransactionBuilder.send`
  // judges its bytes against the production ceiling and would refuse the hop the provider's own profile accepts, so
  // the hop is materialized by the builder and handed to the provider directly. The provider stays the decider.
  const transaction = builder.buildLibauthTransaction();
  if (hopTraceOn()) await traceAssembledHop(builder, provider, program);
  const { encodeTransaction } = await import('@bitauth/libauth/build/lib/message/transaction-encoding.js');

  const rawBytes = encodeTransaction(transaction);
  const rawHex = binToHex(rawBytes);
  const submitPrepared = provider.sendPreparedTransaction?.bind(provider);
  const txid = submitPrepared !== undefined
    ? await submitPrepared({ rawHex, rawBytes, transaction })
    : await provider.sendRawTransaction(rawHex);
  const expected = binToHex(hash256(rawBytes).reverse());
  if (txid !== expected) {
    throw new FramedProxyDeployError(
      `the provider returned txid ${txid} for the hop, not the ${expected} its bytes hash to`,
    );
  }
  const { attachWait } = await import('../../wait.js');
  return attachWait({ ...transaction, txid, hex: rawHex } as TransactionDetails, provider);
}

/** What a caller asks a proxied framed contract for, and what the call produced. */
export interface FramedProxyCallOptions {
  readonly provider: NetworkProvider;
  /** The implementation behind the proxy: the artifact whose entries the call names. */
  readonly implementationArtifact: Artifact;
  /** The proxy the call is entered on, or absent to generate the one the implementation's shape implies. */
  readonly proxyArtifact?: Artifact;
  /** The proxy's live category: its master pool, validator pool and records are read from it. */
  readonly proxyCategoryId: string;
  /** The implementation's live category: the master its program runs from sits under it. */
  readonly implementationCategoryId: string;
  readonly functionName: string;
  readonly args?: readonly FunctionArgument[];
  /** The caller's own coin: a UTXO at `callerLockingBytecode`, and the unlocker that signs it. */
  readonly callerUtxo: Utxo;
  readonly callerLockingBytecode: Uint8Array;
  readonly funder: Unlocker;
  readonly changeAddress?: string | Uint8Array;
  /** When false, the hop is derived and judged and nothing is broadcast. `compose()` uses that. */
  readonly publish?: boolean;
  /** The contracts the entry's published call sites reach, keyed by the interface the site calls. */
  readonly externals?: Readonly<Record<string, FramedProxyExternal>>;
  readonly vm?: Machine;
  /**
   * The value the call carries, in satoshis: the proxy's root frame's, paid by the caller into a container of the
   * proxy, which the implementation's frame takes as `msg.value`. Only a payable entry takes one.
   */
  readonly value?: bigint;
  /**
   * The implementation's per-entry bundle.
   *
   * The fallback forwards calldata onto the shard whose salt is the selector. An unknown selector fails closed.
   * The proxy's address is unchanged: the delegate frame still runs on the proxy's records.
   */
  readonly split?: FunctionSplitBundle;
  /** Which overload `functionName` is, when the bundle has more than one shard of that name. */
  readonly selector?: string;
}

/** A proxied call's outcome, shaped the way the direct call path's is so a handle can treat them alike. */
export interface FramedProxyCallResult {
  readonly transaction: NonNullable<ShippedVmProgram['transaction']>;
  readonly sourceOutputs: ShippedVmProgram['sourceOutputs'];
  readonly draft: CompositionDraft;
  readonly completed: readonly FrameRequest[];
  readonly verdicts: readonly InitializeVerdict[];
  readonly accepted: boolean;
  readonly writtenCommitments: readonly Uint8Array[];
  /** The payload of each event output the entry listed, in emit order: empty for an emit its body skipped. */
  readonly writtenEventCommitments: readonly Uint8Array[];
  /**
   * The bytes the implementation frame recorded in its `retval`, which a returning entry's own body computed.
   *
   * Empty for an entry that returns nothing: its body requires the frame to have recorded nothing.
   */
  readonly retval: Uint8Array;
  /** The entry's returned values, decoded with the shipped decoder, in declaration order. Empty for a void entry. */
  readonly values: readonly StateValue[];
  /** The first returned value, for the common single-value call; zero when the entry returns nothing. */
  readonly value: StateValue;
  /** The provider's receipt for the hop, present only when every participant was accepted. */
  readonly broadcast?: TransactionDetails;
}

/**
 * Calls an entry of a framed implementation through the proxy in front of it.
 *
 * The caller's coin enters the proxy's fallback frame, which forwards the call data to the address its own record
 * holds; the implementation's entry runs as a delegate frame on the proxy's records. The hop is planned exactly the
 * way a deployment's first call is - the same masters, the same records, the same delegate edge - so nothing here
 * assumes an entry the deployment wrote: the plan leaves every record's end commitment unstated, the derivation
 * learns what the entry's own body computed, and the machine is asked about every participant.
 *
 * An entry that returns a value is carried the way a direct call carries one: the plan starts the implementation
 * frame's `retval` from a placeholder its own `return` comparison fails against, the derivation reads the blob the
 * body computed back out of that close, and the call result reports it decoded through the shipped decoder. The
 * value travels in the caller's call record, so the proxy's fallback has to carry the delegated call's result; a
 * proxy whose fallback drops it (the generated closure shape) is refused by name rather than losing the value.
 *
 * A call may carry value into a payable entry, as an EVM proxy's payable fallback forwards it: the proxy's root
 * frame takes it, paid into a container of the proxy, and the delegate frame sees it as `msg.value`. An entry that
 * sends pays from the proxy's containers, the address that holds the balance (`hop-value.ts`).
 */
export async function callFramedProxyEntry(
  options: FramedProxyCallOptions,
): Promise<FramedProxyCallResult> {
  requireFramedFunderSighash(options.funder);
  const { provider, implementationArtifact } = options;
  let splitShard;
  try {
    splitShard = options.split === undefined
      ? undefined
      : requireFunctionSplitShard(options.split, options.functionName, options.selector);
  } catch (error) {
    throw new FramedProxyDeployError((error as Error).message);
  }
  const implementationProgram = splitShard?.artifact ?? implementationArtifact;
  const proxyArtifact = options.proxyArtifact ?? buildProxyArtifact(implementationArtifact);
  requireProxyShape(proxyArtifact);
  requireSharedLayout(implementationArtifact, proxyArtifact);
  if (!implementationArtifact.abi.some((entry) => entry.name === options.functionName)) {
    throw new FramedProxyDeployError(
      `implementation "${implementationArtifact.contractName}" publishes no entry "${options.functionName}"`,
    );
  }
  // A returning entry's own `return` compares the blob it built against the implementation frame's `retval`, so the
  // plan states a candidate there and the derivation learns the value the entry computed; a void entry requires the
  // slot empty, which the shared hop states by leaving the placeholder out.
  const entryRow = implementationArtifact.abi.find((entry) => entry.name === options.functionName)!;
  const retvalPlaceholder = (entryRow.outputs ?? []).length > 0
    ? hopRetvalPlaceholder(implementationArtifact.contractName, options.functionName)
    : undefined;
  requireServedEntry(implementationArtifact, options.functionName,
    `the implementation's ${entryLabelFor(options.functionName)}`);
  requireServedEntry(proxyArtifact, '__fallback', "the proxy's fallback");
  if (options.callerLockingBytecode.length !== 25) {
    throw new FramedProxyDeployError(
      `a root frame's caller is a 25-byte P2PKH lock; got ${options.callerLockingBytecode.length} bytes`,
    );
  }

  // A generated proxy declares only the implementation's fields, not its mappings, so the classification layout
  // carries the implementation's collections: they name the entry covenants a live mapping node sits at, which is
  // what tells one collection's nodes from another's.
  const proxyLayout = proxyArtifact.stateLayout!;
  const classificationLayout = implementationArtifact.stateLayout?.collections === undefined ? proxyLayout
    : { ...proxyLayout, collections: implementationArtifact.stateLayout.collections };
  const proxyPools = await readFramedDeployment(provider, options.proxyCategoryId, classificationLayout);
  if (proxyPools.records.length !== proxyLayout.dataNftCount) {
    throw new FramedProxyDeployError(
      `category ${options.proxyCategoryId} holds ${proxyPools.records.length} record(s) for a proxy whose layout `
      + `declares ${proxyLayout.dataNftCount} data NFT(s)`,
    );
  }
  const proxyMasterUtxo = proxyPools.masters[0];
  const validatorUtxo = proxyPools.validators[0];
  if (proxyMasterUtxo === undefined || validatorUtxo === undefined) {
    throw new FramedProxyDeployError(
      `category ${options.proxyCategoryId} holds no proxy master or no validator, which a call is admitted by`,
    );
  }
  // A run-time loop's key array is handed to the frame in the order the emitted body walks it, exactly as the
  // direct call path hands it over: the plan declares the loop's nodes in slot order, so an array that descends
  // would otherwise plan per-turn nodes the body cannot reach. A key the artifact publishes as a state read is
  // resolved against the deployment's own records, so the permutation is the one the frame will walk.
  const args = orderLoopKeyArgs({
    artifact: implementationArtifact,
    functionName: options.functionName,
    args: options.args ?? [],
    callerLockingBytecode: options.callerLockingBytecode,
    state: deploymentStateValues(proxyLayout, options.proxyCategoryId, proxyPools) as
      Readonly<Record<string, StateValue>>,
  });
  const implementationPools = await readFramedDeployment(
    provider, options.implementationCategoryId, implementationArtifact.stateLayout!);
  const recordCommitments = proxyPools.records.map((record, nftIndex) => {
    const commitment = record.token?.nft?.commitment;
    if (commitment === undefined) {
      throw new FramedProxyDeployError(
        `the record at data NFT ${nftIndex} of category ${options.proxyCategoryId} carries no commitment`,
      );
    }
    return hexToBin(commitment);
  });

  const validatorProgram = framedValidator.buildValidatorProgram();
  const proxyCategory = hexToBin(options.proxyCategoryId);
  const implementationCategory = hexToBin(options.implementationCategoryId);
  const proxyMaster = deployMaster(proxyArtifact, proxyCategory, validatorProgram);
  // The implementation was deployed pinning the oracle lock, so its master is found under the same lock.
  const oracleLock = bindProviderBlockOracle(provider, implementationProgram);
  const implementationMaster = deployMaster(implementationProgram, implementationCategory, validatorProgram);
  let implementationMasterUtxo = implementationPools.masters[0];
  if (splitShard !== undefined) {
    try {
      implementationMasterUtxo = masterForEntry({
        masters: implementationPools.masters,
        filledLock: implementationMaster.lockingBytecode,
        functionName: options.functionName,
      });
    } catch (error) {
      throw new FramedProxyDeployError((error as Error).message);
    }
  }
  if (implementationMasterUtxo === undefined) {
    throw new FramedProxyDeployError(
      `category ${options.implementationCategoryId} holds no implementation master, which the forwarded frame `
      + 'runs from',
    );
  }
  const vm = options.vm ?? await providerMachine(provider);
  const maximumCommitmentBytes = provider.consensusLimits?.maximumNftCommitmentBytes
    ?? DEFAULT_MAXIMUM_COMMITMENT_BYTES;
  const recordAmounts = proxyPools.records.map((record) => record.satoshis);
  // Read once: the hop co-spends this oracle, and a stored clock value is the time it holds.
  const blockOracle = await hopBlockOracle(provider, oracleLock, implementationArtifact, options.functionName);
  // Call predicates and write recipes read the same clock the body authenticates from this co-spent oracle.
  const executionState = {
    ...deploymentStateValues(proxyLayout, options.proxyCategoryId, proxyPools),
    ...(blockOracle === undefined ? {} : blockOracleClock(blockOracle)),
  };

  // The mapping nodes the entry only reads, planned the way a proxied callee's are: from the proxy's own nodes and
  // records, read with the proxy's layout, and the call data the frame receives. Each is named by its collection and
  // the node's own slot, as a callee's is, so two keys one node proves, such as a held key and an absent key above
  // it, name one input, which the frame declares at each key's position. No callee runs on the root's category, so
  // the id leaves it out.
  const readNodes = calleeReadNodesOrNone({
    artifact: implementationArtifact, functionName: options.functionName, args,
    senderAddress: options.callerLockingBytecode, categoryId: options.proxyCategoryId, deployment: proxyPools,
    recordLayout: classificationLayout,
    nodeIdOf: (collection, slot) => `mapping-read-${collection}-${bytesToHex(slot)}`,
    frameLabel: `the implementation's ${entryLabelFor(options.functionName)}`,
  });
  // The live deployment: the record's commitments give a dynamic value's length, and the category's chunk UTXOs
  // are both a dynamic value's chunks and a mapping value's continuation chunks. `collectionNodes` holds the
  // latter — a mapping node's value chunks sit at their own root-salted covenant, not at the collection's.
  const liveDeployment = {
    category: proxyCategory,
    recordCommitments,
    chunks: [...proxyPools.chunks, ...proxyPools.collectionNodes],
    nodesByCollection: proxyPools.nodesByCollection,
    // A key the entry's write publishes as a state read is the value the delegate frame itself reads on the
    // proxy's own records, so those records are decoded into the same view its data slots carry.
    state: executionState as Readonly<Record<string, StateValue>>,
  };
  // The values the proxy's nodes hold, which the delegate frame reads: the facts a guarded write is decided from, and
  // the key a write reads out of another mapping.
  const readMappingValue = liveMappingValueReader(implementationArtifact, liveDeployment, implementationArtifact.structs);
  const writesRequest = {
    artifact: implementationArtifact,
    functionName: options.functionName,
    ...(args.length === 0 ? {} : { args }),
    callerLockingBytecode: options.callerLockingBytecode,
    liveDeployment,
    // A key the entry only reads beside its batch is one of `readNodes`, which the frame declares kept ahead of the
    // batch's groups, so the batch planner takes a read at its slot as declared rather than refusing it.
    declaredReadSlots: readNodes.map((node) => node.slotIndex),
    // A write a branch guards is decided from the proxy's records and nodes, the delegate frame's own.
    activationFacts: { stateValues: liveDeployment.state, selfAddress: proxyMaster.address, readMappingValue },
    // A key the write reads out of another mapping is the value the proxy's node holds, the node `readNodes` declares.
    readMappingValue,
    ...(blockOracle === undefined ? {} : { blockClock: blockOracleClock(blockOracle) }),
  } as const;
  // An entry whose element the artifact cannot state still writes the value's byte length into the record, so the
  // run it grows is re-planned from the commitment the plan states: the first attempt lays it at the live width,
  // the record's own close hands back the length the body wrote, and the run is laid at that length's chunks. A
  // chunkable mapping write whose value the artifact does not publish is re-planned the same way, from the value
  // the body's own pin close exposed. A read whose node the batch also spends is declared at the batch's own input
  // (`buildHopPlan`). A read under a key the batch writes is refused by name: the frame reads it as its segment
  // began, which is what the source sees only when it reads the key before writing it, and the artifact does not
  // say which it does.
  const entryWritesFor = (
    commitments: readonly Uint8Array[], learnedValue?: Uint8Array,
  ): HopEntryWrites | undefined => {
    const writes = hopEntryWrites({
      ...writesRequest, writtenCommitments: commitments,
      ...(learnedValue === undefined ? {} : { learnedValue }),
    });
    const written = new Set((writes?.reachWrites ?? []).flatMap((write) =>
      write.targets.map((target) => `${write.collection}:${bytesToHex(target.slot)}`)));
    const aliased = readNodes.find((node) => written.has(`${node.collection}:${bytesToHex(node.keySlot)}`));
    if (aliased !== undefined) {
      throw new FramedProxyDeployError(
        `the implementation's ${entryLabelFor(options.functionName)} reads mapping "${aliased.collection}" under a `
        + 'key its batch also writes, which its frame reads as the segment began, before the write, whichever '
        + 'comes first in the source',
      );
    }
    return writes;
  };
  // The events and hashes the entry's loops repeat, counted against the same facts its calls are resolved from.
  const loopTurns = implementationLoopTurns({
    artifact: implementationArtifact, functionName: options.functionName, args,
    stateValues: executionState,
    selfAddress: proxyMaster.address, senderAddress: options.callerLockingBytecode,
  });
  // The emits a branch guards that the delegate frame's facts decide its body skips, decided as its writes are.
  const skippedEntryEmits = skippedEmits({
    artifact: implementationArtifact, functionName: options.functionName, args,
    senderAddress: options.callerLockingBytecode, facts: writesRequest.activationFacts,
  });
  // The value the call carries and the sends the entry pays, from the containers of the proxy, which holds the
  // balance: the delegate frame's `msg.value` is its caller's (V5), and its sends pay from its caller's containers.
  const hopValue = await planHopValue({
    provider, artifact: implementationArtifact, functionName: options.functionName, args,
    value: options.value ?? 0n, loopSends: loopTurns.sends, categoryId: options.proxyCategoryId,
    callerLockingBytecode: options.callerLockingBytecode,
    state: deploymentStateValues(proxyLayout, options.proxyCategoryId, proxyPools) as Readonly<Record<string, StateValue>>,
  });
  if ((hopValue?.value ?? 0n) > 0n
    && !(proxyArtifact.abi.find((entry) => entry.name === '__fallback')?.modifiers ?? []).includes('payable')) {
    throw new FramedProxyDeployError(
      `the fallback of proxy "${proxyArtifact.contractName}" is not payable, so a call through it carries no value`,
    );
  }
  // The calls the entry's own body makes through the proxy hop: the plan states their records, and each callee's
  // frame runs from the live deployment the caller named for it. The entry's own facts are the proxy's record
  // values, the proxy's own address for `address(this)`, and the caller's lock for `msg.sender`.
  const settleOptionsFor = (externalPlan: HopExternalPlan, seed?: CalleeSettlement): SettleHopOptions => ({
    vm,
    proxyArtifact,
    implementationArtifact,
    root: rootOn(proxyArtifact),
    maximumCommitmentBytes,
    recordCommitments,
    entryWritesFor,
    ...(externalPlan.callees.length === 0 ? {} : { callees: externalPlan.callees }),
    ...(seed === undefined ? {} : { seed }),
    eventCommitments: hopEventSentinels(
      implementationArtifact, options.functionName, proxyCategory, maximumCommitmentBytes, loopTurns.emits,
      skippedEntryEmits,
    ),
    ...(retvalPlaceholder === undefined ? {} : { retvalPlaceholder }),
    entryLabel: entryLabelFor(options.functionName),
    ...(externalPlan.blocked?.refusal === undefined ? {} : { refusedSite: externalPlan.blocked.refusal }),
    ...(hopValue === undefined ? {} : { value: hopValue }),
    planFor: (
      writtenCommitments, attemptWrites, entryWriteViews, eventCommitments, implementationRetval, calleeRetvals,
      calleeWriteViews, calleeWriteValues, calleeEventCommitments, sends,
    ) => buildHopPlan({
      provider,
      proxyArtifact, implementationArtifact, implementationMaster, proxyMaster,
      proxyCategory, implementationCategory, recordCommitments, writtenCommitments,
      ...(attemptWrites === undefined ? {} : { entryWrites: attemptWrites }),
      ...(readNodes.length === 0 ? {} : { readNodes }),
      entryWriteViews,
      implementationRetval,
      ...(externalPlan.calls.length === 0 ? {} : { calls: externalPlan.calls }),
      ...(externalPlan.callBases.length === 0 ? {} : { callBases: externalPlan.callBases }),
      ...(externalPlan.callees.length === 0 ? {} : { callees: externalPlan.callees, calleeRetvals }),
      ...(calleeWriteViews.size === 0 ? {} : { calleeWriteViews }),
      ...(calleeWriteValues.size === 0 ? {} : { calleeWriteValues }),
      ...(calleeEventCommitments.size === 0 ? {} : { calleeEventCommitments }),
      ...(externalPlan.sideCars.size === 0 ? {} : { sideCars: externalPlan.sideCars }),
      ...(externalPlan.heldContinuations === true ? { heldContinuations: true } : {}),
      maximumCommitmentBytes,
      eventOutputs: hopEventOutputs(
        implementationArtifact, options.functionName, proxyCategory, eventCommitments, loopTurns.emits,
      ),
      recordLockingBytecode: stateRecordLockingBytecode(options.proxyCategoryId),
      recordCategoryHex: options.proxyCategoryId,
      callerSatoshis: options.callerUtxo.satoshis,
      proxyMasterAmount: proxyMasterUtxo.satoshis,
      implementationMasterAmount: implementationMasterUtxo.satoshis,
      validatorAmount: validatorUtxo.satoshis,
      recordAmounts,
      callerLockingBytecode: options.callerLockingBytecode,
      entry: { functionName: options.functionName, args },
      ...(externalPlan.blocked === undefined ? {} : { truncated: true }),
      ...(hopValue === undefined ? {} : { value: { hop: hopValue, sends: sends ?? unlearnedHopSends(hopValue) } }),
    }),
  });
  // The compute side-cars the implementation's own entry reads, built once over the live pool for the whole hop.
  const implementationSideCars = withBlockOracle(await implementationFrameSideCars(
    provider, implementationArtifact, options.functionName, args, loopTurns.hashes,
  ), blockOracle);
  // A frame below the entry may call back into the root, a receiver's hook or a borrower's repayment: it runs on
  // the root's own records, which the root's frames name as the proxy's record participants.
  const reentrantRoot = {
    proxyArtifact,
    implementationCategoryId: options.implementationCategoryId,
    records: proxyPools.records.map((utxo, nftIndex): HopCalleeRecord => ({
      id: proxyRecordParticipantId(nftIndex), commitment: recordCommitments[nftIndex]!, satoshis: utxo.satoshis,
      lockingBytecode: stateRecordLockingBytecode(options.proxyCategoryId),
    })),
  };
  const { externalPlan, settled } = await planAndSettleHop({
    plan: (externalReturns, reachedResults, calleeWriteViews, calleeWriteValues, heldContinuations, stopBefore) =>
      planHopExternalCalls({
        provider, artifact: implementationArtifact, functionName: options.functionName,
        args, externals: options.externals ?? {}, validatorProgram,
        stateValues: executionState,
        entryDeployment: { categoryId: options.proxyCategoryId, deployment: proxyPools, layout: classificationLayout },
        reentrantRoot,
        selfAddress: proxyMaster.address,
        senderAddress: options.callerLockingBytecode,
        externalReturns,
        reachedResults,
        ...(calleeWriteViews.size === 0 ? {} : { calleeWriteViews }),
        ...(calleeWriteValues.size === 0 ? {} : { calleeWriteValues }),
        ...(implementationSideCars.size === 0 ? {} : { sideCars: implementationSideCars }),
        ...(heldContinuations === true ? { heldContinuations: true } : {}),
        ...(stopBefore === undefined ? {} : { stopBefore }),
      }),
    settle: (stated, seed, defer) => settleHop(defer === true
      ? { ...settleOptionsFor(stated, seed), deferCalleeFailures: true }
      : settleOptionsFor(stated, seed)),
    settleCallees: (stated, only, seed) => settleHopCallees(settleOptionsFor(stated, seed), only),
  });

  // A hop a participant refused has no transaction to broadcast, the validator's refusal as much as a frame's: the
  // verdicts name the refusal, as a direct call's do, and nothing reaches the network.
  const broadcast = !settled.accepted || options.publish === false ? undefined : await broadcastHop({
    provider,
    callerFunding: {
      utxo: options.callerUtxo,
      funder: options.funder,
      ...(options.changeAddress === undefined ? {} : { changeAddress: options.changeAddress }),
    },
    callerLockingBytecode: options.callerLockingBytecode,
    proxyArtifact,
    implementationArtifact,
    proxyCategoryId: options.proxyCategoryId,
    implementationCategoryId: options.implementationCategoryId,
    program: settled.program,
    draft: settled.draft,
    ...(settled.entryWrites === undefined && externalPlan.utxos.size === 0 && readNodes.length === 0
      ? {}
      : {
        spentUtxos: new Map([
          ...(settled.entryWrites?.spentUtxos ?? []),
          ...readNodes.filter((node) => node.createdSlot === undefined)
            .map((node) => [node.id, node.utxo!] as const),
          ...externalPlan.utxos,
        ]),
      }),
    // The proxy's containers the settled sends are paid from, as the settled plan spent them.
    ...(hopValue === undefined ? {} : {
      containerInputs: hopPaying(hopValue, settled.sends ?? [], proxyArtifact.contractName).spent
        .map((utxo, position) => ({ index: settled.draft.layout.participantCount + 1 + position, utxo })),
    }),
  });

  const retval = settled.retval;
  const values = retvalPlaceholder === undefined
    ? []
    : decodeReturnValues(
      retval, entryRow.outputs ?? [], structDefinitionsOf(implementationArtifact),
      entryRow.resultEncoding, implementationArtifact.enums,
    );

  return {
    transaction: settled.program.transaction, sourceOutputs: settled.program.sourceOutputs,
    draft: settled.draft, completed: settled.completed, verdicts: settled.verdicts,
    accepted: settled.accepted, writtenCommitments: settled.writtenCommitments,
    writtenEventCommitments: settled.writtenEventCommitments,
    retval, values, value: values[0] ?? 0n, broadcast,
  };
}
