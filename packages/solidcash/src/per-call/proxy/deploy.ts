/**
 * Deploying a per-call contract behind a proxy, in three transactions, none of which calls another contract.
 *
 *   1. the implementation's genesis: its category, master pool and validator pool (and the records its own
 *      constructor frame computed);
 *   2. the proxy's genesis: the same pools, with the proxy's one record carrying the implementation's address;
 *   3. `initialize` through the proxy: a root frame on the proxy's master whose body delegatecalls the
 *      implementation, which runs as a `DELEGATE` frame on the proxy's own records, so its `msg.sender` and
 *      `address(this)` are the deployer's and the proxy's.
 *
 * The proxy shape is the one the convention compiles: a contract whose only body is a `fallback` that forwards
 * the call data it received to an address it holds in state. Its master reads that address from its record and
 * records a `DELEGATE` call to it; the implementation's master runs the forwarded entry as a delegate frame. Any
 * other shape is refused by name rather than guessing where the implementation's address lives or what a body
 * forwards.
 *
 * The first two transactions are broadcast through the shipped deployment entry point, which selects the per-call
 * genesis from the artifact. The third is built by the shipped composer: the plan names the deployed masters, the
 * proxy's record and validator, and the delegate edge, and the shipped derivation resolves the callee reference
 * and fills the witnesses. That derived transaction is the specification of the hop. When the caller supplies its
 * own funding (`callerFunding`), the hop is rebuilt on the outpoints the two geneses actually created — the two
 * masters, the validator, the proxy's record and the caller's own coin — signed by the caller, and broadcast, so
 * the deployment comes out as three broadcast transactions. When it does not, the hop is only derived, which is
 * what a caller that wants the shape without broadcasting it takes.
 *
 * A later call by anyone is the same hop on the same live pools: `callPerCallProxyEntry` names the entry and the
 * caller's coin and runs the identical plan, derivation, evaluation and broadcast. The delegation is one
 * participant graph with two kinds of caller, so an entry a deployment ran and an entry a user calls settle the
 * same way.
 */

import {
  binToHex, createVirtualMachineBch2026, encodeDataPush,
  encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import {
  FrameKind, INDEX_NONE, buildEntryNftCovenantScript, bytesEqual, bytesToHex, computeCollectionHash,
  dynamicChunkSignature, frameKindName, sha256, validatorRedeemScript,
  type Artifact, type RecordEntry, type StateValue, type StructDefinitionInfo,
} from '@solidcash/utils';
import { perCallValidator } from 'solidc';
import {
  encodeFunctionArgument, encodeFunctionArguments, type ConstructorArgument, type FunctionArgument,
} from '../../Argument.js';
import type { TransactionDetails, Unlocker, Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { deployStatefulContract } from '../../stateful/sc-deploy.js';
import { registerDeployment } from '../../stateful/deployment-registry.js';
import { decodeEntryCommitment, headSentinelCommitment } from '../../stateful/SortedList.js';
import type { DeployOptions, DeployResult } from '../../stateful/stateful-lifecycle-types.js';
import { libauthOutputToSolidCashOutput, libauthTokenDetailsToSolidCashTokenDetails, scriptToLockingBytecode } from '../../utils.js';
import {
  PerCallComposerError, UNFILLED_CALLEE_REF, createComposedDerivationHost, deriveComposition, describeInnermost,
  facetId, layoutTransaction, participant, reportCompositionRefusal, requireLearnedViews, validatorFacetsOf,
  type CompositionDraft, type CompositionDraftPlan, type ContractBlock, type DraftCall, type DraftInput,
  type DraftMaster, type DraftSourceOutput, type FrameRequest, type ShippedVmProgram,
} from '../composer/index.js';
import { readComputedDeclaration, type DeclarationReading } from '../deploy/declaration.js';
import { frameDataRecordIndices } from '../call/entry-records.js';
import { eventLockingBytecode, eventSentinel } from '../deploy/genesis.js';
import { deployMaster, type DeployedMaster } from '../deploy/material.js';
import {
  readPerCallDeployment, entryRecordReadUnlock, stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../deploy/records.js';
import { decodeReturnValues } from '../read/index.js';
import { PerCallProxyDeployError } from './errors.js';
import { hopTrace, hopTraceError, hopTraceOn } from './hop-trace.js';
import {
  hopEntryWrites, mappingHeadCollection, mappingNodeSlot,
  type HopEntryWrites, type LaidHopEntryWrites,
} from './entry-writes.js';
import {
  deploymentStateValues,
  planHopExternalCalls,
  type HopCallee,
  type HopCalleeRecord,
  type PerCallProxyExternal,
} from './external-calls.js';
import { buildProxyArtifact, readLayoutAgreement, type LayoutAgreement } from './generate.js';

/** One contract's deploy inputs, minus what this module derives: the provider and the proxy's record seed. */
export type PerCallProxyDeployHalf = Omit<DeployOptions, 'provider' | 'initialState'>;

/** The caller's own funding for a hop: the coin the root frame's caller input spends. */
export interface PerCallProxyCallerFunding {
  /** A UTXO at `callerLockingBytecode`; a root frame binds `msg.sender` to the lock of the input it names. */
  readonly utxo: Utxo;
  /** The caller's own unlocker over `callerLockingBytecode`, which signs the hop over the real transaction. */
  readonly funder: Unlocker;
  /** Where the caller's leftover satoshis go. Defaults to `callerLockingBytecode`. */
  readonly changeAddress?: string | Uint8Array;
}

type Machine = ReturnType<typeof createVirtualMachineBch2026>;

export interface PerCallProxyDeployOptions {
  readonly provider: NetworkProvider;
  readonly implementationArtifact: Artifact;
  /** The implementation's constructor arguments, in parameter order. */
  readonly implementationArgs?: readonly ConstructorArgument[];
  readonly implementationDeploy: PerCallProxyDeployHalf;
  /**
   * The proxy to run behind, or absent to generate one from the implementation's own declaration.
   *
   * A generated proxy declares exactly the implementation's record fields plus the fallback that forwards to the
   * `implementation` field, so it agrees with the implementation by construction. A caller that supplies one keeps
   * the same requirement: the two must declare the same records, which is why every supplied proxy's layout is
   * checked against the implementation's.
   */
  readonly proxyArtifact?: Artifact;
  readonly proxyDeploy: PerCallProxyDeployHalf;
  /** The entry to call through the proxy, and its arguments in parameter order. */
  readonly initialize: { readonly functionName: string; readonly args?: readonly FunctionArgument[] };
  /** The deployer's own 25-byte P2PKH lock: the root frame's caller, and the `initialize` frame's `msg.sender`. */
  readonly callerLockingBytecode: Uint8Array;
  /**
   * The caller's own funding for the initialize hop, or absent to leave the hop derived.
   *
   * Supplying it is what makes the hop real: the derived hop is rebuilt on the outpoints the two geneses actually
   * created, the caller input is signed by `funder` over that transaction, and the result is broadcast, so the
   * deployment comes out as three broadcast transactions. The caller's input is the deployer's own — the frame's
   * root caller — so the UTXO must sit at `callerLockingBytecode`, the same lock the witness sender is bound to.
   */
  readonly callerFunding?: PerCallProxyCallerFunding;
  /**
   * The contracts the entry's published call sites reach, keyed by the interface the site calls.
   *
   * An entry that makes an external call has that call bound by its own frame, so the hop states the call's record
   * and runs its callee as a frame of its own. A call whose callee is not named here has nowhere to run and is
   * refused by name.
   */
  readonly externals?: Readonly<Record<string, PerCallProxyExternal>>;
  /** The machine the initialize transaction is evaluated on. Defaults to the provider's BCH-2026 machine. */
  readonly vm?: Machine;
}

/** One deployed contract, with the address its masters and validators sit under. */
export interface PerCallProxyHalf {
  readonly contract: DeployResult['contract'];
  readonly categoryId: string;
  /** `addrV(category)`, the address the contract presents, which `Contract.address` does not report per-call. */
  readonly address: Uint8Array;
  readonly tx: DeployResult['tx'];
}

/** The machine's verdict on one participant of the initialize transaction. */
export interface InitializeVerdict {
  readonly id: string;
  readonly index: number;
  readonly accepted: boolean;
  readonly objection?: string;
}

export interface PerCallProxyDeployment {
  readonly implementation: PerCallProxyHalf;
  readonly proxy: PerCallProxyHalf;
  readonly initialize: {
    /** The derived transaction the machine was asked about. */
    readonly transaction: NonNullable<ShippedVmProgram['transaction']>;
    /** The output each input spends, in input order. */
    readonly sourceOutputs: ShippedVmProgram['sourceOutputs'];
    readonly draft: CompositionDraft;
    /** The frames the derivation completed, callee before caller. */
    readonly completed: readonly FrameRequest[];
    /** Every participant's verdict, in input order. */
    readonly verdicts: readonly InitializeVerdict[];
    /** True when every convention input — the masters, the validator and the record — was accepted. */
    readonly accepted: boolean;
    /** The commitment of each record after the entry ran, in data-NFT order: what the entry itself computed. */
    readonly writtenRecordCommitments: readonly Uint8Array[];
    /** The commitment of the record at data NFT 0 after the entry ran, which a one-record proxy has. */
    readonly writtenRecordCommitment: Uint8Array;
    /** The payload of each event the entry emitted, in emit order: what the entry's own body computed. */
    readonly writtenEventCommitments: readonly Uint8Array[];
    /** The bytes the implementation frame recorded in its `retval`: what a returning entry's own body computed. */
    readonly retval: Uint8Array;
    /** The entry's returned values, decoded with the shipped decoder, in declaration order. */
    readonly values: readonly StateValue[];
    /** The first returned value, for the common single-value `initialize`. */
    readonly value: StateValue;
    /**
     * The provider's receipt for the hop, present only when the caller supplied `callerFunding`.
     *
     * The hop's outputs carry what `transaction` describes — the same participants recreated, the record at the
     * commitment the entry computed — placed on the outpoints the geneses created. `transaction` remains the
     * derived specification either way.
     */
    readonly broadcast?: TransactionDetails;
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
    throw new PerCallProxyDeployError(
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

/** The write one of the hop's laid records belongs to, as the artifact publishes its segment. */
interface LaidWriteIdentity {
  readonly record?: number;
  readonly collection?: string;
  readonly variable?: string;
}

/** The segment one of the entry's writes declares its records in, or undefined when the artifact states none. */
function publishedSegmentOfWrite(
  artifact: Artifact,
  functionName: string,
  write: LaidWriteIdentity,
): number | 'last' | undefined {
  const fact = publishedWriteFacts(artifact, functionName).find((candidate) =>
    candidate.record === write.record && candidate.collection === write.collection
    && candidate.variable === write.variable);
  // An artifact that publishes one fact for the whole entry states that segment for every write it makes.
  return fact?.segment ?? publishedWriteSegment(artifact, functionName);
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
}): number {
  const published = publishedSegmentOfWrite(options.artifact, options.functionName, options.write);
  if (published === undefined) {
    // An entry that makes no call has one segment, so a write inside it can only land there.
    if (options.calls === 0) return 0;
    throw new PerCallProxyDeployError(
      `${options.label} ${options.what} beside an external call, and the segment that write lands in is not fixed `
      + 'by the entry\'s own source, so the hop cannot declare it',
    );
  }
  const at = published === 'last' ? options.calls : published;
  if (at < 0 || at > options.calls) {
    throw new PerCallProxyDeployError(
      `${options.label} publishes segment ${String(at)} for ${options.what}, which the hop's `
      + `${options.calls + 1} segment(s) do not hold`,
    );
  }
  return at;
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

/** The dynamic value an entry's own write grows, with its declared type, or undefined for an entry that writes none. */
function dynamicWriteVariable(
  artifact: Artifact, functionName: string,
): { readonly variable: string; readonly type: string } | undefined {
  const variable = artifact.abi.find((candidate) => candidate.name === functionName)?.dynamicWrites?.[0];
  const declared = variable === undefined
    ? undefined : artifact.stateLayout?.variables.find((candidate) => candidate.name === variable);
  return variable === undefined || declared === undefined ? undefined : { variable, type: declared.type };
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
 * The plan lays the sorted batch's nodes, then the run of chunk records a dynamic value's write occupies, then the
 * value chunks a long mapping value takes, and each write is declared in its own segment. A record names its write
 * by the coordinate it sits at: a batch record is a participant the plan lists under a mapping id, or an output the
 * write places at the collection's own covenant, while a run's chunk is any other participant, or an output the
 * value's own collection covenant locks.
 */
function laidWriteRecords(options: {
  readonly laid: LaidHopEntryWrites;
  readonly writes: HopEntryWrites;
  readonly indexOf: (id: string) => number;
  readonly category: Uint8Array;
  readonly createdBase: number;
  /** The dynamic value the write grows, when the entry writes one. */
  readonly dynamicVariable?: string;
  readonly dynamicType?: string;
}): readonly LaidWriteRecord[] {
  const { laid, writes } = options;
  const runIndices = new Set<number>();
  for (const id of writes.participantIds) {
    // The plan lists a sorted batch's nodes under a mapping id; every other participant belongs to the run.
    if (mappingHeadCollection(id) === undefined && mappingNodeSlot(id) === undefined) {
      runIndices.add(options.indexOf(id));
    }
  }
  const runLock = options.dynamicVariable === undefined || options.dynamicType === undefined
    ? undefined : dynamicRunLock(options.category, options.dynamicVariable, options.dynamicType);
  const isRun = (entry: RecordEntry): boolean => {
    if (entry.in !== INDEX_NONE) return runIndices.has(entry.in);
    const output = laid.trailingOutputs[entry.out - options.createdBase];
    return runLock !== undefined && output !== undefined && bytesEqual(output.lockingBytecode, runLock);
  };
  const batch = { write: { collection: writes.collection } as LaidWriteIdentity, what: 'writes a mapping record' };
  const run = options.dynamicVariable === undefined
    ? undefined : { write: { variable: options.dynamicVariable }, what: 'writes a run of chunk records' };
  return laid.entries.map((entry): LaidWriteRecord => {
    const belongsToRun = isRun(entry);
    if (belongsToRun && run === undefined) {
      throw new PerCallProxyDeployError(
        'the entry lays a run of chunk records and the artifact publishes no dynamic value for it',
      );
    }
    return { ...(belongsToRun ? run! : batch), entry };
  });
}

/**
 * Places the records an entry's own writes contribute in the segments their writes are declared in.
 *
 * Each record is declared in its own write's segment, in the order the plan lays the plan's records; every record a
 * write spends is kept in the segments on either side of it, at the commitment it was spent with before and at the
 * written one after, so the segments chain into the one transition each write performs.
 */
function placeLaidWrites(
  segments: RecordEntry[][],
  placed: readonly { readonly at: number; readonly entry: RecordEntry }[],
): void {
  segments.forEach((segment, segmentIndex) => {
    const declared = new Set<number>();
    for (const { at, entry } of placed) {
      if (segmentIndex === at) continue;
      if (entry.in === INDEX_NONE || declared.has(entry.in)) continue;
      declared.add(entry.in);
      segment.push(segmentIndex < at
        ? { in: entry.in, out: entry.in, viewIn: entry.viewIn, viewOut: entry.viewIn }
        : { in: entry.in, out: entry.in, viewIn: entry.viewOut, viewOut: entry.viewOut });
    }
  });
  for (const { at, entry } of placed) segments[at]!.push(entry);
}

/**
 * The segment each of an entry's laid records is declared in, in the order the plan lays them.
 *
 * A write's segment is resolved once and its records all take it, so the records reach the segments in the order
 * the plan declares them and a write the artifact places nowhere is refused once rather than per record. A batch
 * and the run of chunk records a dynamic write grows have to share one segment: a frame reads the run past the
 * records its own block declares, and the records a segment declares in front of the run are the position that
 * read resolves against, so a batch whose records land in another segment leaves the run where the frame's own
 * close refuses it.
 */
function resolveLaidWriteSegments(
  records: readonly LaidWriteRecord[],
  segmentOfWrite: (write: LaidWriteIdentity, what: string) => number,
  label: string,
): readonly { readonly at: number; readonly entry: RecordEntry }[] {
  const segments = new Map<string, number>();
  const placed = records.map(({ write, what, entry }) => {
    const key = `${String(write.record)}|${String(write.collection)}|${String(write.variable)}`;
    let at = segments.get(key);
    if (at === undefined) {
      at = segmentOfWrite(write, what);
      segments.set(key, at);
    }
    return { at, entry };
  });
  const batchAt = records.findIndex(({ write }) => write.collection !== undefined);
  const runAt = records.findIndex(({ write }) => write.variable !== undefined);
  if (batchAt >= 0 && runAt >= 0 && placed[batchAt]!.at !== placed[runAt]!.at) {
    throw new PerCallProxyDeployError(
      `${label} declares its mapping's records in segment ${placed[batchAt]!.at} and the run of chunk records its `
      + `dynamic write grows in segment ${placed[runAt]!.at}, and a frame reads the run past the records its own `
      + 'block declares, so a batch whose records another segment holds leaves the run unreadable',
    );
  }
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
  return sha256(new TextEncoder().encode(`per-call hop retval\u0000${contract}\u0000${functionName}`));
}

/** The struct definitions a hop decodes an implementation entry's returned values against. */
function structDefinitionsOf(artifact: Artifact): readonly StructDefinitionInfo[] | undefined {
  return artifact.stateLayout?.structs ?? artifact.structs;
}

/**
 * Refuses a hop whose entry the compiler did not emit, naming the entry and the shape that refused it.
 *
 * A body a per-call master cannot serve is emitted as a body that fails whenever the dispatcher reaches it, so a
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
    throw new PerCallProxyDeployError(`${role} is refused by the compiler (${identity}): ${reason}`);
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
    throw new PerCallProxyDeployError(`proxy "${proxyArtifact.contractName}" is not a stateful contract`);
  }
  const layout = proxyArtifact.stateLayout;
  const field = (layout.variables ?? []).find((candidate) => candidate.name === 'implementation');
  if (field === undefined || field.type !== 'address') {
    throw new PerCallProxyDeployError(
      `proxy "${proxyArtifact.contractName}" declares no address field named "implementation", so there is `
      + 'nothing for its fallback to forward the call data it received to',
    );
  }
  if (!proxyArtifact.abi.some((entry) => entry.name === '__fallback')) {
    throw new PerCallProxyDeployError(
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
  if (!agreement.ok) throw new PerCallProxyDeployError(agreement.reason);
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
    throw new PerCallProxyDeployError(
      `implementation "${artifact.contractName}" publishes no entry "${functionName}"`,
    );
  }
  const visible = abi.inputs.filter((input) => !input.name.startsWith('__internal__'));
  const encoded = encodeFunctionArguments(
    abi, [...args], encodeFunctionArgument, artifact.structs,
  ) as Uint8Array[];
  if (encoded.length !== visible.length) {
    throw new PerCallProxyDeployError(
      `"${functionName}" takes ${visible.length} argument(s), but ${encoded.length} were supplied`,
    );
  }
  return [selectorOf(artifact, functionName), ...[...encoded].reverse()];
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
 */
export async function deployPerCallProxy(
  options: PerCallProxyDeployOptions,
): Promise<PerCallProxyDeployment> {
  const { provider, implementationArtifact } = options;
  const proxyArtifact = options.proxyArtifact ?? buildProxyArtifact(implementationArtifact);
  requireProxyShape(proxyArtifact);
  requireSharedLayout(implementationArtifact, proxyArtifact);
  requireServedEntry(implementationArtifact, options.initialize.functionName,
    `the implementation's ${entryLabelFor(options.initialize.functionName)}`);
  requireServedEntry(proxyArtifact, '__fallback', "the proxy's fallback");
  if (options.callerLockingBytecode.length !== 25) {
    throw new PerCallProxyDeployError(
      `a root frame's caller is a 25-byte P2PKH lock; got ${options.callerLockingBytecode.length} bytes`,
    );
  }
  for (const half of [options.implementationDeploy, options.proxyDeploy]) {
    if (half.fundingUtxo.vout !== 0) {
      throw new PerCallProxyDeployError('each genesis funding UTXO must be at vout 0 to create a token category');
    }
  }

  const validatorProgram = perCallValidator.buildValidatorProgram();
  const implementationCategory = hexToBin(options.implementationDeploy.fundingUtxo.txid);
  const proxyCategory = hexToBin(options.proxyDeploy.fundingUtxo.txid);
  const implementationMaster = deployMaster(implementationArtifact, implementationCategory, validatorProgram);
  const proxyMaster = deployMaster(proxyArtifact, proxyCategory, validatorProgram);

  // The records the entry's own body writes — mapping nodes today — are planned against the entry's published
  // accesses and their stated values, so their commitments are declared outright rather than learned. A collection
  // the entry writes has no record until then, so the proxy's genesis seeds its empty head; the implementation
  // artifact is where that collection is published.
  const entryWrites = hopEntryWrites({
    artifact: implementationArtifact,
    functionName: options.initialize.functionName,
    ...(options.initialize.args === undefined ? {} : { args: options.initialize.args }),
    callerLockingBytecode: options.callerLockingBytecode,
  });
  // A sorted collection the entry writes has no node until it does, so the proxy's genesis seeds its empty head;
  // a dynamic value's run has no head, so a write that only appends to one seeds nothing.
  const headCollections = [...(entryWrites?.collections ?? [])];

  // 1. The implementation's genesis and pools.
  const implementation = await deployStatefulContract(
    implementationArtifact, [...(options.implementationArgs ?? [])],
    { ...options.implementationDeploy, provider },
  );

  // 2. The proxy's genesis, its one record carrying the implementation's address, and the empty head of any
  // collection the entry writes.
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
  const facetLocks = perCallValidator.buildValidatorFacets()
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

  // The proxy's records are read back by enumerating the proxy's category and decoding each commitment through the
  // shipped pushdata decoder: one record per data NFT of the proxy's layout, in data-NFT order.
  const layout = proxyArtifact.stateLayout!;
  const deployment = await readPerCallDeployment(provider, proxy.categoryId, layout);
  if (deployment.records.length !== layout.dataNftCount) {
    throw new PerCallProxyDeployError(
      `the proxy's genesis published ${deployment.records.length} record(s) for category ${proxy.categoryId}, but `
      + `its layout declares ${layout.dataNftCount} data NFT(s)`,
    );
  }
  const recordCommitments = deployment.records.map((record, nftIndex) => {
    const commitment = record.token?.nft?.commitment;
    if (commitment === undefined) {
      throw new PerCallProxyDeployError(
        `the proxy's genesis published no commitment for the record at data NFT ${nftIndex} of category `
        + proxy.categoryId,
      );
    }
    return hexToBin(commitment);
  });

  const vm = options.vm ?? await providerMachine(provider);
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
  // The calls the entry's own body makes through the proxy hop: the plan states their records, and each callee's
  // frame runs from the live deployment the caller named for it. The entry's own facts are the proxy's record
  // values, the proxy's own address for `address(this)`, and the deployer's lock for `msg.sender`.
  const externalPlan = await planHopExternalCalls({
    provider, artifact: implementationArtifact, functionName: options.initialize.functionName,
    args: options.initialize.args ?? [], externals: options.externals ?? {}, validatorProgram,
    stateValues: deploymentStateValues(proxyArtifact.stateLayout!, proxy.categoryId, deployment),
    selfAddress: proxyMaster.address,
    senderAddress: options.callerLockingBytecode,
  });
  const settled = await settleHop({
    vm,
    proxyArtifact,
    implementationArtifact,
    root: rootOn(proxyArtifact),
    maximumCommitmentBytes,
    recordCommitments,
    ...(entryWrites === undefined ? {} : { entryWrites }),
    ...(externalPlan.callees.length === 0 ? {} : { callees: externalPlan.callees }),
    eventCommitments: hopEventSentinels(
      implementationArtifact, options.initialize.functionName, proxyCategory, maximumCommitmentBytes,
    ),
    ...(retvalPlaceholder === undefined ? {} : { retvalPlaceholder }),
    entryLabel: entryLabelFor(options.initialize.functionName),
    planFor: (
      writtenCommitments, attemptWrites, entryWriteViews, eventCommitments, implementationRetval, calleeRetvals,
      calleeWriteViews, calleeEventCommitments,
    ) => buildHopPlan({
      proxyArtifact, implementationArtifact, implementationMaster, proxyMaster,
      proxyCategory, implementationCategory, recordCommitments, writtenCommitments, recordLockingBytecode,
      ...(attemptWrites === undefined ? {} : { entryWrites: attemptWrites }),
      entryWriteViews,
      implementationRetval,
      ...(externalPlan.calls.length === 0 ? {} : { calls: externalPlan.calls }),
      ...(externalPlan.callBases.length === 0 ? {} : { callBases: externalPlan.callBases }),
      ...(externalPlan.callees.length === 0 ? {} : { callees: externalPlan.callees, calleeRetvals }),
      ...(calleeWriteViews.size === 0 ? {} : { calleeWriteViews }),
      ...(calleeEventCommitments.size === 0 ? {} : { calleeEventCommitments }),
      maximumCommitmentBytes,
      eventOutputs: hopEventOutputs(
        implementationArtifact, options.initialize.functionName, proxyCategory, eventCommitments,
      ),
      recordCategoryHex: options.proxyDeploy.fundingUtxo.txid,
      callerSatoshis: options.proxyDeploy.fundingUtxo.satoshis,
      proxyMasterAmount: options.proxyDeploy.masterAmount ?? 1200n,
      implementationMasterAmount: options.implementationDeploy.masterAmount ?? 1200n,
      validatorAmount: recordAmount,
      recordAmounts: recordCommitments.map(() => recordAmount),
      callerLockingBytecode: options.callerLockingBytecode,
      entry: options.initialize,
    }),
  });
  const {
    draft, program, verdicts, accepted, writtenCommitments, writtenEventCommitments, retval,
    completed: completedFrames,
  } = settled;
  const values = retvalPlaceholder === undefined
    ? []
    : decodeReturnValues(
      retval, initializeEntry!.outputs ?? [], structDefinitionsOf(implementationArtifact),
      initializeEntry!.resultEncoding, implementationArtifact.enums,
    );

  // The hop is the derived transaction until the caller offers its own coin; then it is rebuilt on the geneses'
  // outpoints, signed and broadcast.
  const broadcast = options.callerFunding === undefined ? undefined : await broadcastHop({
    provider,
    callerFunding: options.callerFunding,
    callerLockingBytecode: options.callerLockingBytecode,
    proxyArtifact,
    implementationArtifact,
    proxyCategoryId: proxy.categoryId,
    implementationCategoryId: implementation.categoryId,
    program,
    draft,
    ...(entryWrites === undefined && externalPlan.utxos.size === 0 && facetSpends.size === 0
      ? {}
      : { spentUtxos: new Map([...(entryWrites?.spentUtxos ?? []), ...externalPlan.utxos, ...facetSpends]) }),
  });

  // The deployment is recorded under the address the proxy presents, so a caller whose own state holds that
  // address — another contract's entry calling into this one — resolves the live deployment from it. The record
  // carries the implementation's artifact beside the proxy's category and the implementation's own, so the caller
  // can place the same fallback-plus-delegate chain this deployment runs.
  registerDeployment(provider, {
    contractName: implementationArtifact.contractName,
    address: binToHex(proxyMaster.address),
    lockingBytecode: binToHex(proxyMaster.address),
    contract: {
      inner: { artifact: implementationArtifact },
      proxy: { categoryId: proxy.categoryId },
      perCallProxy: { artifact: proxyArtifact, implementationCategoryId: implementation.categoryId },
    },
  });

  return {
    implementation: {
      contract: implementation.contract, categoryId: implementation.categoryId,
      address: implementationMaster.address, tx: implementation.tx,
    },
    proxy: {
      contract: proxy.contract, categoryId: proxy.categoryId,
      address: proxyMaster.address, tx: proxy.tx,
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
      ...(broadcast === undefined ? {} : { broadcast }),
    },
  };
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
  /** The payload of every event the entry emits, in emit order, which the entry's own body computed. */
  readonly writtenEventCommitments: readonly Uint8Array[];
  /** The bytes the implementation frame recorded in its `retval`, which a returning entry's own body computed. */
  readonly retval: Uint8Array;
  /** The entry's own writes as the settled plan states them, whose participant ids the broadcast reads back. */
  readonly entryWrites?: HopEntryWrites;
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
   * lays the run at the chunks that length names. Absent leaves the writes as the caller stated them.
   */
  readonly entryWritesFor?: (writtenCommitments: readonly Uint8Array[]) => HopEntryWrites | undefined;
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
  /** The entry, for the refusal's own words, e.g. `"initialize" entry`. */
  readonly entryLabel: string;
  /** The plan for a given set of per-record, per-entry-write, per-event and `retval` candidate end values. */
  readonly planFor: (
    writtenCommitments: readonly Uint8Array[],
    entryWrites: HopEntryWrites | undefined,
    entryWriteViews: readonly Uint8Array[],
    eventCommitments: readonly Uint8Array[],
    implementationRetval: Uint8Array,
    calleeRetvals: ReadonlyMap<string, Uint8Array>,
    calleeWriteViews: ReadonlyMap<string, readonly (Uint8Array | undefined)[]>,
    calleeEvents: ReadonlyMap<string, readonly Uint8Array[]>,
  ) => CompositionDraftPlan;
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
 */
async function settleCallees(options: {
  readonly vm: Machine;
  readonly artifacts: readonly Artifact[];
  readonly planFor: (
    calleeRetvals: ReadonlyMap<string, Uint8Array>,
    calleeWriteViews: ReadonlyMap<string, readonly (Uint8Array | undefined)[]>,
    calleeEvents: ReadonlyMap<string, readonly Uint8Array[]>,
  ) => CompositionDraftPlan;
  readonly callees: readonly HopCallee[];
  readonly maximumCommitmentBytes: number;
}): Promise<{
  readonly retvals: Map<string, Uint8Array>;
  readonly writeViews: Map<string, readonly (Uint8Array | undefined)[]>;
  readonly events: Map<string, readonly Uint8Array[]>;
}> {
  const trace = hopTraceOn();
  const learned = new Map<string, Uint8Array>();
  const writeViews = new Map<string, readonly (Uint8Array | undefined)[]>();
  // Each callee's event payloads start from the sentinel the plan states there; the body's own comparison of the
  // payload it computed against that declaration is what hands the value back.
  const calleeEvents = new Map<string, readonly Uint8Array[]>(
    options.callees.map((callee): [string, readonly Uint8Array[]] => [
      callee.master,
      hopEventSentinels(
        callee.artifact, callee.entry, calleeEventCategory(options.callees, callee),
        options.maximumCommitmentBytes,
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
    .sort((left, right) => depthOf(right) - depthOf(left));
  for (const calleeIndex of deepestFirst) {
    const callee = options.callees[calleeIndex]!;
    const placeholder = hopRetvalPlaceholder(callee.contract, callee.entry);
    // One attempt per value the frame computes — its return, each unstated write, each event payload — plus the
    // attempt that is accepted once every one of them is stated.
    const attempts = MAXIMUM_HOP_ATTEMPTS
      + (callee.entryWrites?.learningCandidates.length ?? 0)
      + (calleeEvents.get(callee.master)?.length ?? 0);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const candidate = createComposedDerivationHost({
        vm: options.vm, artifacts: options.artifacts,
        plan: options.planFor(learned, writeViews, calleeEvents),
      });
      if (trace) {
        hopTrace(`attempt callee=${callee.master} `
          + `${traceFrameFacts(callee.master, callee.functionName, callee.kind)} n=${attempt} `
          + `refs-before=[${traceCallRefs(candidate.draft, callee.master)}]`);
      }
      // A callee that makes calls cannot accept before its own calls are derived, so its subtree is derived first;
      // a stall there is the callee's own return comparison or one of its own write's declarations, read below.
      if (callee.calls.length > 0) {
        const frame: FrameRequest = {
          contract: callee.contract, functionName: callee.functionName, kind: callee.kind, master: callee.master,
        };
        try {
          deriveComposition([frame], candidate.host);
          if (trace) {
            hopTrace(`stop callee=${callee.master} reason=derived `
              + `refs-after=[${traceCallRefs(candidate.draft, callee.master)}]`);
          }
          break;
        } catch (error) {
          if (trace) {
            hopTrace(`stop callee=${callee.master} reason=stall:${hopTraceError(error)} `
              + `refs-after=[${traceCallRefs(candidate.draft, callee.master)}]`);
          }
          const learnable = callee.returns
            || (callee.entryWrites?.learningCandidates.length ?? 0) > 0
            || (calleeEvents.get(callee.master)?.length ?? 0) > 0;
          // A void callee with nothing to learn has no return, no unstated write and no event, so a stall is its
          // refusal.
          if (!learnable) throw error;
        }
      }
      const program = candidate.draft.programFor(callee.master);
      const state = options.vm.evaluate({
        inputIndex: participant(candidate.draft.layout, callee.master).index,
        sourceOutputs: program.sourceOutputs,
        transaction: program.transaction,
      });
      if (options.vm.stateSuccess(state) === true) {
        if (trace) hopTrace(`stop callee=${callee.master} reason=accepted`);
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
      if (reading.ok && candidates.length > 0) {
        const declaredAt = candidates.findIndex((entry) => bytesEqual(reading.declared, entry));
        const computedAt = candidates.findIndex((entry) => bytesEqual(reading.computed, entry));
        const at = declaredAt >= 0 ? declaredAt : computedAt;
        if (at >= 0) {
          if (trace) hopTrace(`stop callee=${callee.master} reason=learned-write at=${at}`);
          const views: (Uint8Array | undefined)[] = [...(writeViews.get(callee.master) ?? [])];
          while (views.length <= at) views.push(undefined);
          views[at] = Uint8Array.from(declaredAt >= 0 ? reading.computed : reading.declared);
          writeViews.set(callee.master, views);
          continue;
        }
      }
      // A frame that emits compares each payload its own body computed against the commitment the plan states in
      // the event's output, so the same close hands the payload back. The frame's events are read after its writes,
      // which is the order the body compares them in.
      const events = calleeEvents.get(callee.master) ?? [];
      if (reading.ok && events.length > 0) {
        const declaredAt = events.findIndex((entry) => bytesEqual(reading.declared, entry));
        const computedAt = events.findIndex((entry) => bytesEqual(reading.computed, entry));
        const at = declaredAt >= 0 ? declaredAt : computedAt;
        if (at >= 0) {
          if (trace) hopTrace(`stop callee=${callee.master} reason=learned-event at=${at}`);
          const next = [...events];
          next[at] = Uint8Array.from(declaredAt >= 0 ? reading.computed : reading.declared);
          calleeEvents.set(callee.master, next);
          continue;
        }
      }
      const refusal = reportCompositionRefusal({ draft: candidate.draft, artifacts: options.artifacts, vm: options.vm });
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
          + `reported=${refusal.innermost?.master ?? 'none'} `
          + `refs=[${traceCallRefs(candidate.draft, callee.master)}]`);
        hopTrace(`close callee=${callee.master} reason=${attributed}`);
        hopTrace(`reading callee=${callee.master} ${traceReading(reading)}`);
        hopTrace(`callee=${callee.master} returns=${callee.returns} records=[`
          + `${callee.records.map((record) => binToHex(record.commitment).slice(0, 20)).join(',')}] retvalCandidate=`
          + `${binToHex(placeholder).slice(0, 20)}`);
      }
      throw new PerCallProxyDeployError(
        `the call's callee "${callee.functionName}" did not settle through the proxy: ${failing}`,
      );
    }
  }
  return { retvals: learned, writeViews, events: calleeEvents };
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
 * Derives a delegate hop and learns what its entry computed.
 *
 * The state the entry leaves is not something the caller can state in advance — the entry computes it — so the plan
 * carries a candidate per record, per event and for the implementation frame's `retval`, and the machine is asked
 * whether the entry's own frame accepted it: the entry closes its record against the declaration the plan wrote,
 * compares each event payload against its output's commitment and compares what its own `return` built against the
 * `retval` slot, so a failed comparison leaves both the declaration and the computed value on the stack. Each
 * attempt rebuilds the plan with the value that was read, so a writing, emitting or returning entry converges in one
 * step per value it computes and a read-only entry is accepted on the first attempt.
 */
async function settleHop(options: SettleHopOptions): Promise<SettledHop> {
  const { vm, proxyArtifact, implementationArtifact } = options;
  const trace = hopTraceOn();
  let writtenCommitments = [...options.recordCommitments];
  let writtenEvents = [...options.eventCommitments];
  let learnedRetval = options.retvalPlaceholder;
  let entryWrites = options.entryWritesFor === undefined
    ? options.entryWrites
    : options.entryWritesFor(writtenCommitments);
  // The declaration a value-dependent write closed against is learned once; the candidate it started from is that
  // declaration's identity, so a re-planned entry — one whose run the record's own length widened — keeps what an
  // earlier attempt learned.
  const learnedExtras = new Map<string, Uint8Array>();
  let maximumAttempts = MAXIMUM_HOP_ATTEMPTS;
  // The callees are settled first: the implementation frame's call records carry what each callee's own body
  // computed, so the plan cannot state the caller's records until the callees have answered.
  const artifacts: readonly Artifact[] =
    [proxyArtifact, implementationArtifact, ...(options.callees ?? []).map((callee) => callee.artifact)];
  const calleeSettlement = options.callees === undefined || options.callees.length === 0
    ? {
      retvals: new Map<string, Uint8Array>(),
      writeViews: new Map<string, readonly (Uint8Array | undefined)[]>(),
      events: new Map<string, readonly Uint8Array[]>(),
    }
    : await settleCallees({
      vm,
      artifacts,
      callees: options.callees,
      maximumCommitmentBytes: options.maximumCommitmentBytes,
      planFor: (learned, calleeWriteViews, calleeEvents) => options.planFor(
        writtenCommitments, entryWrites, entryWrites?.learningCandidates ?? [],
        writtenEvents, learnedRetval ?? new Uint8Array(0), learned, calleeWriteViews, calleeEvents),
    });
  const calleeRetvals = calleeSettlement.retvals;
  const calleeWriteViews = calleeSettlement.writeViews;
  const calleeEvents = calleeSettlement.events;
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
        + (options.retvalPlaceholder === undefined ? 0 : 1) + 1,
    );
    if (attempt >= maximumAttempts) break;
    const plan = options.planFor(
      writtenCommitments, entryWrites, writtenExtras, writtenEvents, learnedRetval ?? new Uint8Array(0),
      calleeRetvals, calleeWriteViews, calleeEvents);
    const candidate = createComposedDerivationHost({ vm, artifacts, plan });
    if (trace) {
      hopTrace(`attempt entry=${IMPLEMENTATION_MASTER_ID} `
        + `${traceFrameFacts(IMPLEMENTATION_MASTER_ID, traceRunFunctionName(candidate.draft, IMPLEMENTATION_MASTER_ID),
          FrameKind.DELEGATE)} n=${attempt} `
        + `refs-before=[${traceCallRefs(candidate.draft, IMPLEMENTATION_MASTER_ID)}]`);
    }
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
    // records and emits one event takes three attempts.
    const learned = reading.ok
      ? writtenCommitments.findIndex((candidate) => bytesEqual(reading.declared, candidate))
      : -1;
    const learnedExtra = reading.ok && learned < 0
      ? writtenExtras.findIndex((candidate) => bytesEqual(reading.declared, candidate))
      : -1;
    const learnedEvent = reading.ok && learned < 0 && learnedExtra < 0
      ? writtenEvents.findIndex((candidate) => bytesEqual(reading.declared, candidate))
      : -1;
    if (!reading.ok || (learned < 0 && learnedExtra < 0 && learnedEvent < 0)) {
      // The entry's frame refused before it closed anything, so the reading only says where it stopped. The
      // machine's verdict is paired with the artifacts' own publication to attribute the entry's reason: the
      // refusing frame is named, and for a dispatched body its `debug.functionDebug` requirement is the message.
      const refusal = reportCompositionRefusal({
        draft: candidate.draft, artifacts, vm,
      });
      const attributed = refusal.innermost === undefined
        ? describeReading(reading, writtenCommitments[0] ?? new Uint8Array(0))
        : describeInnermost(refusal.innermost);
      // The reporter names the deepest refused frame, which a frame below the implementation can be; the frame this
      // settle evaluated is named beside it so the failing frame is not read off the reporter alone.
      const failing = trace && refusal.innermost !== undefined
        && refusal.innermost.master !== IMPLEMENTATION_MASTER_ID
        ? `frame "${IMPLEMENTATION_MASTER_ID}" of `
          + `${traceRunFunctionName(candidate.draft, IMPLEMENTATION_MASTER_ID)} `
          + `(${frameKindName(FrameKind.DELEGATE)}) did not accept; the refusal reporter named ${attributed}`
        : attributed;
      if (trace) {
        hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=refused evaluated=${IMPLEMENTATION_MASTER_ID} `
          + `reported=${refusal.innermost?.master ?? 'none'} `
          + `refs=[${traceCallRefs(candidate.draft, IMPLEMENTATION_MASTER_ID)}]`);
        hopTrace(`close entry=${IMPLEMENTATION_MASTER_ID} reason=${attributed}`);
        hopTrace(`reading entry=${IMPLEMENTATION_MASTER_ID} ${traceReading(reading)}`);
      }
      throw new PerCallProxyDeployError(
        `the implementation's ${options.entryLabel} did not settle through the proxy: ${failing}`
        + sizedRunClause(entryWrites),
        refusal.innermost?.reason.arguments,
      );
    }
    if (learned >= 0) {
      if (trace) hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=learned-record nft=${learned}`);
      writtenCommitments = writtenCommitments.map((candidate, nftIndex) =>
        (nftIndex === learned ? Uint8Array.from(reading.computed) : candidate));
      entryWrites = options.entryWritesFor?.(writtenCommitments) ?? entryWrites;
    } else if (learnedExtra >= 0) {
      if (trace) hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=learned-write at=${learnedExtra}`);
      learnedExtras.set(bytesToHex(extras[learnedExtra]!), Uint8Array.from(reading.computed));
    } else {
      if (trace) hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=learned-event at=${learnedEvent}`);
      writtenEvents = writtenEvents.map((candidate, emitIndex) =>
        (emitIndex === learnedEvent ? Uint8Array.from(reading.computed) : candidate));
    }
  }
  if (composed === undefined) {
    if (trace) hopTrace(`stop entry=${IMPLEMENTATION_MASTER_ID} reason=exhausted attempts=${maximumAttempts}`);
    throw new PerCallProxyDeployError(
      `the implementation's ${options.entryLabel} did not settle through the proxy in `
      + `${maximumAttempts} attempts${sizedRunClause(entryWrites)}`,
    );
  }
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
    if (options.retvalPlaceholder !== undefined && error instanceof PerCallComposerError
      && error.code === 'PER_CALL_DERIVATION_STALLED') {
      throw new PerCallProxyDeployError(
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

  const program = draft.programFor(PROXY_MASTER_ID);
  const verdicts = draft.layout.participants.map((placed): InitializeVerdict => {
    const state = vm.evaluate({
      inputIndex: placed.index, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
    });
    return vm.stateSuccess(state) === true
      ? { id: placed.id, index: placed.index, accepted: true }
      : { id: placed.id, index: placed.index, accepted: false, objection: String(state.error) };
  });
  // Every participant is a convention input: the masters, the validator and the proxy's records, each spent under
  // the lock it was minted at.
  return {
    draft, program, completed: derived.completed,
    verdicts, accepted: verdicts.every((verdict) => verdict.accepted),
    writtenCommitments, writtenEventCommitments: writtenEvents,
    retval: learnedRetval ?? new Uint8Array(0),
    ...(entryWrites === undefined ? {} : { entryWrites }),
  };
}

/**
 * The refusal's own words for a run the entry's record sizes, naming the width it was laid at.
 *
 * A run whose width comes from a declared length is the one shape whose refusal is not about a value: the record
 * asked the body for a length, and the run laid at that length's chunks is not the run the body pinned.
 */
function sizedRunClause(entryWrites: HopEntryWrites | undefined): string {
  const sized = entryWrites?.sizedRun;
  return sized === undefined ? ''
    : `, and the run it declares for dynamic "${sized.variable}" is ${sized.chunks} chunk(s), sized from the `
      + "length the record's own declaration states";
}

/** Everything the hop's plan is built from, whether the hop is a deployment's first call or a user's later one. */
interface HopPlanOptions {
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
   * A per-call body binds each external call to its own frame's k-th record, so the delegate frame states one
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
  readonly recordCommitments: readonly Uint8Array[];
  /** The commitment each record is being asked to end at, which a writing entry's own computation replaces. */
  readonly writtenCommitments: readonly Uint8Array[];
  /** The end commitment learned for each value-dependent mapping node, in the entry's learning order. */
  readonly entryWriteViews: readonly Uint8Array[];
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
  /** One value per record, in data-NFT order. */
  readonly recordAmounts: readonly bigint[];
  /** The 25-byte P2PKH lock of the caller whose coin enters the frame. */
  readonly callerLockingBytecode: Uint8Array;
  /** One output per event the entry emits, in emit order, with the commitment it carries. */
  readonly eventOutputs: readonly HopEventOutput[];
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
): readonly HopEventOutput[] {
  const entry = artifact.abi.find((candidate) => candidate.name === functionName);
  const definitions = new Map((artifact.events ?? []).map((definition) => [definition.signature, definition]));
  return [...(entry?.emits ?? [])]
    .sort((left, right) => left.emitIndex - right.emitIndex)
    .map((emit, position) => ({
      lockingBytecode: eventLockingBytecode(
        category, emit.eventSignature, definitions.get(emit.eventSignature)?.anonymous === true,
      ),
      commitment: commitments[position] ?? new Uint8Array(0),
    }));
}

/** The placeholder each of an entry's event outputs carries until the hop learns the payload it computed. */
function hopEventSentinels(
  artifact: Artifact,
  functionName: string,
  category: Uint8Array,
  maximumCommitmentBytes: number,
): readonly Uint8Array[] {
  const entry = artifact.abi.find((candidate) => candidate.name === functionName);
  return [...(entry?.emits ?? [])]
    .sort((left, right) => left.emitIndex - right.emitIndex)
    .map((_emit, position) =>
      eventSentinel(category, artifact.contractName, position, maximumCommitmentBytes));
}

/**
 * The `msg.sender` a callee frame runs with.
 *
 * A call frame's sender is the address of the frame that entered it — the implementation's own proxy for a
 * first-level callee, a calling callee's own address below that. A delegate frame preserves its caller's sender, so
 * a proxy's delegate runs with the same sender as the fallback that entered it.
 */
function calleeSender(
  callees: readonly HopCallee[], rootAddress: Uint8Array, callee: HopCallee,
): Uint8Array {
  const caller = callee.enteredBy === null ? undefined : callees[callee.enteredBy];
  if (caller === undefined) return rootAddress;
  if (callee.kind === FrameKind.DELEGATE) return calleeSender(callees, rootAddress, caller);
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
 * The long mapping values a callee frame reads from its own block, one per value-witness slot.
 *
 * A body that reads a value its node's tail cannot hold takes the value itself from its frame's block, so the
 * frame's witness block declares the whole value the hop joined from the deployment's chunks. The frame's own
 * writes already state theirs; the nodes the frame only reads add theirs here, and the two lists overlay by slot.
 */
function calleeValueWitnesses(
  callee: HopCallee, laidWrites: LaidHopEntryWrites | undefined,
): readonly Uint8Array[] | undefined {
  const bySlot = new Map<number, Uint8Array>();
  for (const node of callee.readNodes) {
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

/** Lays out the delegate hop from the deployed masters and the proxy's records. */
function buildHopPlan(options: HopPlanOptions): CompositionDraftPlan {
  const { proxyArtifact, implementationArtifact, proxyMaster, implementationMaster } = options;
  const pushes = callPushes(implementationArtifact, options.entry.functionName, options.entry.args ?? []);
  const calls = options.calls ?? [];
  const callees = options.callees ?? [];

  // One participant per data NFT of the proxy's layout, in data-NFT order: the record the proxy's genesis minted
  // for it. The proxy's block holds its master, its validator and them; the implementation's master follows, and
  // the deployer's signed input enters the composition. A record the entry's own body writes — a mapping node — is
  // a participant of the same block, after them. A callee the entry calls runs as its own block, its own master and
  // its own records, exactly as a caller the composer builds for itself lays one out.
  const recordIds = options.recordCommitments.map((_commitment, nftIndex) => proxyRecordParticipantId(nftIndex));
  const entryWriteIds = options.entryWrites?.participantIds ?? [];
  // A contract owns one block, and every master the hop spends of it sits in that block in placement order; a
  // contract reached at several sites therefore contributes several masters to its one block, and its records are
  // placed once however many of its masters read them.
  const calleeBlocks = new Map<string, { readonly contract: string; masters: string[]; state: string[] }>();
  for (const callee of callees) {
    let block = calleeBlocks.get(callee.contract);
    if (block === undefined) {
      block = { contract: callee.contract, masters: [], state: [] };
      calleeBlocks.set(callee.contract, block);
    }
    block.masters.push(callee.master);
    // A delegate frame's records, the nodes it reads and the nodes its write touches all sit at its owner's
    // category, so they are placed in the owner's block; the owner is placed before the delegate.
    const owner = callee.recordOwner === undefined ? undefined : callees[callee.recordOwner]!;
    const target = owner === undefined ? block : calleeBlocks.get(owner.contract);
    if (target === undefined) continue;
    const owned = owner === undefined ? callee.records : owner.records;
    // The records the entry's own block layout names, in that order; a record no body of the frame reads is not
    // spent, so it is placed in no block and declared in no segment.
    for (const record of calleeDeclaredRecords(callee, owned)) {
      if (!target.state.includes(record.id)) target.state.push(record.id);
    }
    // The nodes the frame reads sit after the data records its own block layout names, ahead of any write.
    for (const node of callee.readNodes) {
      if (!target.state.includes(node.id)) target.state.push(node.id);
    }
    // The nodes the frame's own write spends sit after the records it declares.
    for (const id of callee.entryWrites?.participantIds ?? []) {
      if (!target.state.includes(id)) target.state.push(id);
    }
  }
  const blocks: ContractBlock[] = [
    {
      contract: proxyArtifact.contractName,
      masters: [PROXY_MASTER_ID],
      validator: { id: VALIDATOR_ID, settles: [] },
      state: [...recordIds, ...entryWriteIds],
    },
    { contract: implementationArtifact.contractName, masters: [IMPLEMENTATION_MASTER_ID], state: [] },
    ...[...calleeBlocks.values()].map((block) => ({
      contract: block.contract, masters: block.masters, state: block.state,
    })),
  ];
  // The validator runs as a head plus its facet inputs, so the hop's own layout has to place the same facets the
  // composer places; otherwise the indices the plan states and the ones the assembled transaction uses would differ.
  const validatorRedeem = validatorRedeemScript(options.proxyCategory, perCallValidator.buildValidatorProgram());
  const facets = validatorFacetsOf({ id: VALIDATOR_ID, covers: [], settles: [], redeemScript: validatorRedeem });
  const layout = layoutTransaction(blocks, new Map([[VALIDATOR_ID, facets]]));
  // The events the delegate frame lists sit in the trailing region, which starts past the participants. The
  // assembly allocates them there and refuses a plan that names any other index.
  const eventIndices = options.eventOutputs.map((_output, position) => layout.participantCount + position);
  const recordIndices = recordIds.map((id) => participant(layout, id).index);
  // Every record kept where the proxy read it before the call, and left where the entry's write leaves it. The
  // delegate frame's segment chains each record's kept view to its written one, and the proxy's own later segment
  // continues from the written view: a record has no other frame between them.
  const entries = (
    viewIn: (nftIndex: number) => Uint8Array, viewOut: (nftIndex: number) => Uint8Array,
  ): RecordEntry[] => recordIndices.map((index, nftIndex) => ({
    in: index, out: index, viewIn: viewIn(nftIndex), viewOut: viewOut(nftIndex),
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
  const writes = options.recordCommitments.map((commitment, nftIndex) =>
    !bytesEqual(commitment, options.writtenCommitments[nftIndex]!));
  const proxyMasterIndex = participant(layout, PROXY_MASTER_ID).index;
  // The proxy's own master declares every record of its layout; the delegate frame declares the implementation's,
  // which are the proxy's first ones, because a body addresses the records its own declaration names.
  const implementationRecords = implementationArtifact.stateLayout?.dataNftCount ?? recordIds.length;
  const at = (entries: readonly RecordEntry[], nftIndex: number): RecordEntry =>
    (writes[nftIndex] ? entries[nftIndex]! : recordKept[nftIndex]!);
  const proxySegments: RecordEntry[][] = [
    [...recordKept],
    recordKept.map((_entry, nftIndex) => at(recordAfter, nftIndex)),
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
  }) : undefined));
  // Each record the entry rewrites is kept at the commitment the proxy spent until the segment its write opens,
  // written in that segment, and kept at the written commitment afterwards: its own code writes it exactly once,
  // in that segment, so any other segment declares it unchanged.
  const implementationSegments: RecordEntry[][] = Array.from(
    { length: calls.length + 1 },
    (_unused, segmentIndex) => recordKept.slice(0, implementationRecords).map((_entry, nftIndex): RecordEntry => {
      const writeAt = recordWriteAt[nftIndex];
      if (writeAt === undefined) return recordKept[nftIndex]!;
      if (segmentIndex < writeAt) return recordKept[nftIndex]!;
      return segmentIndex === writeAt ? recordWritten[nftIndex]! : recordAfter[nftIndex]!;
    }),
  );
  // The records the entry's own body writes follow the state records its frame declares, which is the ordinal the
  // body's group walk reads them at. A created node is a trailing output past the events.
  const createdBase = layout.participantCount + options.eventOutputs.length;
  const laidWrites = options.entryWrites?.lay({
    indexOf: (id) => participant(layout, id).index,
    proxyMasterIndex,
    createdBase,
    recordAmount: options.validatorAmount,
    category: options.proxyCategory,
    learnedViews: options.entryWriteViews,
  });
  if (laidWrites !== undefined && options.entryWrites !== undefined) {
    const dynamicVariable = dynamicWriteVariable(implementationArtifact, options.entry.functionName);
    placeLaidWrites(implementationSegments, resolveLaidWriteSegments(
      laidWriteRecords({
        laid: laidWrites,
        writes: options.entryWrites,
        indexOf: (id) => participant(layout, id).index,
        category: options.proxyCategory,
        createdBase,
        ...(dynamicVariable === undefined ? {} : { dynamicVariable: dynamicVariable.variable }),
        ...(dynamicVariable === undefined ? {} : { dynamicType: dynamicVariable.type }),
      }),
      (write, what) => resolvedWriteSegment({
        artifact: implementationArtifact,
        functionName: options.entry.functionName,
        label: entryWritesLabel,
        what,
        write,
        calls: calls.length,
      }),
      entryWritesLabel,
    ));
  }
  const proxyMasterDraft: DraftMaster = {
    master: PROXY_MASTER_ID,
    contract: proxyArtifact.contractName,
    functionName: entryName(proxyArtifact, '__fallback'),
    program: proxyMaster.script,
    facts: factsOf(proxyArtifact, '__fallback', FrameKind.ROOT, true),
    frame: { kind: FrameKind.ROOT, sender: options.callerLockingBytecode, self: proxyMaster.address, value: 0n },
    enteredBy: USER_ID,
    origin: USER_ID,
    calls: [{
      kind: FrameKind.DELEGATE,
      callee: IMPLEMENTATION_MASTER_ID,
      target: implementationMaster.address,
      value: 0n,
      argumentPushes: pushes,
    }],
    retval: new Uint8Array(0),
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
    frame: { kind: FrameKind.DELEGATE, sender: options.callerLockingBytecode, self: proxyMaster.address, value: 0n },
    enteredBy: PROXY_MASTER_ID,
    origin: USER_ID,
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
    ...(laidWrites?.values === undefined ? {} : { values: laidWrites.values }),
    events: eventIndices,
    sends: [],
    argumentPushes: pushes,
    redeemScript: implementationMaster.script,
  };
  // One frame per callee, entered by the master that calls it: its own master, its own live records declared kept,
  // its own calls and the frames those reach, and the return value the caller's record carries. A callee whose own
  // body rewrites its record is refused by the callee's own frame below rather than declared here.
  const everyCall = [...calls, ...callees.flatMap((callee) => callee.calls)];
  const callTo = new Map<string, DraftCall>();
  for (const call of everyCall) if (!callTo.has(call.callee)) callTo.set(call.callee, call);
  // How many masters of each callee contract the hop spends: a contract reached at several sites contributes one
  // master per reach to its one block.
  const mastersPerContract = new Map<string, number>();
  for (const callee of callees) {
    mastersPerContract.set(callee.contract, (mastersPerContract.get(callee.contract) ?? 0) + 1);
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
  // The trailing region is allocated in the assembler's own order: every frame's events first, the root's before
  // any callee's, then the created records in the order the frames' segments declare them. Each frame that emits
  // lists one output per event whatever else it writes, because the frame's own head walks them.
  let trailingCursor = layout.participantCount + options.eventOutputs.length;
  const maximumCommitmentBytes = options.maximumCommitmentBytes ?? DEFAULT_MAXIMUM_COMMITMENT_BYTES;
  const calleeEventPlan = callees.map((callee) => {
    const owner = callee.recordOwner === undefined ? undefined : callees[callee.recordOwner];
    const category = (owner ?? callee).category;
    const eventCommitments = options.calleeEventCommitments?.get(callee.master)
      ?? hopEventSentinels(callee.artifact, callee.entry, category, maximumCommitmentBytes);
    const eventOutputs = hopEventOutputs(callee.artifact, callee.entry, category, eventCommitments);
    const base = trailingCursor;
    trailingCursor += eventOutputs.length;
    return { category, eventOutputs, eventIndices: eventOutputs.map((_output, position) => base + position) };
  });
  // The root entry's own created records come first in the created region, which the segments declare in master
  // order, so the callees' records follow them.
  trailingCursor += laidWrites?.trailingOutputs.length ?? 0;
  // Each callee frame's own write is laid in the block its records sit in — a call frame's own block, a delegate
  // frame's caller's — and its created records follow the root entry's, so the cursor advances as each is laid.
  const calleeTrailing = callees.map((callee, position) => {
    const writes = callee.entryWrites;
    const owner = callee.recordOwner === undefined ? undefined : callees[callee.recordOwner];
    const category = (owner ?? callee).category;
    let laid: LaidHopEntryWrites | undefined;
    let records: ReturnType<typeof laidWriteRecords> | undefined;
    if (writes !== undefined) {
      const createdBase = trailingCursor;
      laid = writes.lay({
        indexOf: (id) => participant(layout, id).index,
        proxyMasterIndex: participant(layout, (owner ?? callee).master).index,
        createdBase,
        recordAmount: (owner ?? callee).records[0]?.satoshis ?? options.validatorAmount,
        category,
        learnedViews: options.calleeWriteViews?.get(callee.master) ?? [],
      });
      trailingCursor += laid.trailingOutputs.length;
      // Each of the frame's own writes is declared in its own segment, which the artifact publishes per write.
      const dynamicVariable = dynamicWriteVariable(callee.artifact, callee.entry);
      records = laidWriteRecords({
        laid,
        writes,
        indexOf: (id) => participant(layout, id).index,
        category,
        createdBase,
        ...(dynamicVariable === undefined ? {} : { dynamicVariable: dynamicVariable.variable }),
        ...(dynamicVariable === undefined ? {} : { dynamicType: dynamicVariable.type }),
      });
    }
    return { laid, records, ...calleeEventPlan[position]! };
  });
  settle(options.proxyCategory, [...recordIds, ...entryWriteIds], laidWrites?.createdOutputs ?? []);
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
    const writes = callee.entryWrites;
    const laid = calleeTrailing[calleePosition]?.laid;
    if (writes === undefined || laid === undefined) return;
    const owner = callee.recordOwner === undefined ? undefined : callees[callee.recordOwner];
    const category = (owner ?? callee).category;
    if (!settlementOf.has(bytesToHex(category))) return;
    settle(category, writes.participantIds, laid.createdOutputs);
  });
  // The nodes a frame only reads are state inputs of the category their records sit at, so a settlement that
  // reaches that category accounts for them too, exactly as a frame's own write does.
  for (const callee of callees) {
    if (callee.readNodes.length === 0) continue;
    const owner = callee.recordOwner === undefined ? undefined : callees[callee.recordOwner];
    const category = (owner ?? callee).category;
    if (!settlementOf.has(bytesToHex(category))) continue;
    settle(category, callee.readNodes.map((node) => node.id));
  }
  const settles = [...settlementOf.values()].map((entry) => ({
    category: entry.category,
    stateInputs: entry.stateInputs,
    ...(entry.createdOutputs.length === 0 ? {} : { createdOutputs: entry.createdOutputs }),
  }));
  const calleeMasterDrafts: DraftMaster[] = callees.map((callee, calleePosition) => {
    // A frame that owns the records it lists places them; a delegate frame reads the records of the proxy frame
    // that entered it, which are the first ones that frame declares.
    const owned = callee.recordOwner === undefined ? callee.records : callees[callee.recordOwner]!.records;
    // The records the entry's own code reads, in the order its block layout names them: the ones it names first,
    // then, for a batch, the rest a batch's groups follow. The frame's segments declare exactly those, so the read
    // nodes the entry names past them sit where its own group walk reads them.
    const declaredRecords = calleeDeclaredRecords(callee, owned);
    // The nodes the entry only reads sit after the data records, in the order its own code reads them.
    const readEntries: RecordEntry[] = callee.readNodes.map((node) => {
      const index = participant(layout, node.id).index;
      return { in: index, out: index, viewIn: node.commitment, viewOut: node.commitment };
    });
    // The frame's own call-data band is the pushes of the call that reaches it; a callee a loop reaches has several
    // records, and the first of them carries the same selector and shape as the rest.
    const argumentPushes = callTo.get(callee.master)?.argumentPushes ?? [];
    // A callee's own sender is the contract that calls it: the caller's own address for a call, and the caller's
    // sender for a delegate frame, which preserves it.
    const sender = calleeSender(callees, proxyMaster.address, callee);
    // A frame that makes k calls closes k + 1 segments, each declaring its own records kept. Each of the frame's
    // own writes lands in the segment its source fixes, which the artifact publishes per write: the records it
    // spends are kept at the commitment they were spent with before that segment and at the written one after it.
    const laidCalleeWrites = calleeTrailing[calleePosition];
    const segments: RecordEntry[][] = Array.from({ length: callee.calls.length + 1 }, () => [
      ...declaredRecords.map((record): RecordEntry => {
        const index = participant(layout, record.id).index;
        return { in: index, out: index, viewIn: record.commitment, viewOut: record.commitment };
      }),
      ...readEntries,
    ]);

    if (laidCalleeWrites?.records !== undefined) {
      placeLaidWrites(segments, resolveLaidWriteSegments(
        laidCalleeWrites.records,
        (write, what) => resolvedWriteSegment({
          artifact: callee.artifact,
          functionName: callee.entry,
          label: `the callee's "${callee.functionName}" entry`,
          what,
          write,
          calls: callee.calls.length,
        }),
        `the callee's "${callee.functionName}" entry`,
      ));
    }
    const valueWitnesses = calleeValueWitnesses(callee, laidCalleeWrites?.laid);
    return {
      master: callee.master,
      contract: callee.contract,
      functionName: callee.functionName,
      program: callee.deployed.script,
      facts: {
        contract: callee.contract, functionName: callee.functionName, kind: callee.kind,
        callerIsUser: false, originEqualsCaller: false,
        makesExternalCall: callee.calls.length > 0,
        mastersOfContract: mastersPerContract.get(callee.contract) ?? 1,
      },
      frame: { kind: callee.kind, sender, self: callee.selfAddress, value: 0n },
      enteredBy: callee.enteredBy === null ? IMPLEMENTATION_MASTER_ID : callees[callee.enteredBy]!.master,
      origin: USER_ID,
      calls: callee.calls,
      ...(callee.callBases.length === 0 ? {} : { callBaseBySite: callee.callBases }),
      retval: callee.returns
        ? options.calleeRetvals?.get(callee.master)
          ?? hopRetvalPlaceholder(callee.contract, callee.entry)
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

  const proxyMasterAmount = options.proxyMasterAmount;
  const implementationMasterAmount = options.implementationMasterAmount;
  const proxyRecordAmount = options.validatorAmount;
  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: [{ id: USER_ID, index: layout.participantCount }],
    masters: [proxyMasterDraft, implementationMasterDraft, ...calleeMasterDrafts],
    inputs: {
      [PROXY_MASTER_ID]: {
        source: masterSource(proxyMaster.lockingBytecode, options.proxyCategory, proxyMasterAmount),
      },
      [IMPLEMENTATION_MASTER_ID]: {
        source: masterSource(
          implementationMaster.lockingBytecode, options.implementationCategory, implementationMasterAmount,
        ),
      },
      [VALIDATOR_ID]: {
        source: mutableSource(proxyMaster.address, proxyRecordAmount, options.proxyCategory, new Uint8Array(0)),
      },
      ...Object.fromEntries(recordIds.map((id, nftIndex) => [id, {
        source: mutableSource(
          options.recordLockingBytecode, options.recordAmounts[nftIndex]!, options.proxyCategory,
          options.recordCommitments[nftIndex]!,
        ),
        output: mutableSource(
          options.recordLockingBytecode, options.recordAmounts[nftIndex]!, options.proxyCategory,
          options.writtenCommitments[nftIndex]!,
        ),
        // The covenant's write path names the master of the record's category that authorizes the spend; a record
        // the entry leaves unchanged is spent on the read-only path, which needs no master.
        unlockingBytecode: stateRecordUnlockingBytecode(
          options.recordCategoryHex, proxyMasterIndex, writes[nftIndex]! ? 1 : 0,
        ),
      }])),
      [USER_ID]: {
        source: { lockingBytecode: options.callerLockingBytecode, valueSatoshis: options.callerSatoshis },
        unlockingBytecode: callerUnlocking(),
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
        const recordEntries = calleeDeclaredRecords(callee, owned).map((record) => [record.id, {
          source: mutableSource(record.lockingBytecode, record.satoshis, recordCategory, record.commitment),
          output: mutableSource(record.lockingBytecode, record.satoshis, recordCategory, record.commitment),
          // A callee frame is planned as a read of its records, so each is spent on the covenant's read-only path.
          unlockingBytecode: stateRecordUnlockingBytecode(
            recordCategoryId, participant(layout, callee.master).index, 0,
          ),
        }] as const);
        // The nodes the entry only reads are spent on the entry covenant's read-only path and recreated unchanged,
        // so no output is stated for them.
        const readNodeEntries = callee.readNodes.map((node) => {
          const { lockingBytecode, unlockingBytecode } = entryRecordReadUnlock(recordCategoryId, node.signature);
          return [node.id, {
            source: mutableSource(lockingBytecode, node.utxo.satoshis, recordCategory, node.commitment),
            unlockingBytecode,
          }] as const;
        });
        return [masterEntry, ...recordEntries, ...readNodeEntries];
      })),
      ...(laidWrites?.inputs ?? {}),
      // Each callee frame's own write spends the collection nodes it names, which its own block already placed.
      ...Object.assign({}, ...calleeTrailing.map((written) => written?.laid?.inputs ?? {})),
    },
    validator: {
      id: VALIDATOR_ID,
      covers: [...new Set([implementationArtifact.contractName, ...callees.map((callee) => callee.contract)])],
      settles,
      redeemScript: validatorRedeemScript(options.proxyCategory, perCallValidator.buildValidatorProgram()),
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
      ...(laidWrites?.trailingOutputs ?? []),
      // Each callee frame's own created records follow the root entry's, in the order the frames are placed.
      ...calleeTrailing.flatMap((written) => written.laid?.trailingOutputs ?? []),
    ],
  };
  // The frames the plan lays, in order, with the calls it states for each: the plan states a callee identity and the
  // target address, while the assembled draft is what carries the callee reference.
  if (hopTraceOn()) {
    for (const master of plan.masters) {
      const calls = master.calls.map((call) =>
        `${call.callee}:${frameKindName(call.kind)}->${binToHex(call.target).slice(0, 8)}`).join(' ');
      hopTrace(`plan ${traceFrameFacts(master.master, master.functionName, master.frame.kind)} `
        + `contract=${master.contract} calls=[${calls}]`);
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
  readonly callerFunding: PerCallProxyCallerFunding;
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
}

/** The live UTXO a participant sits on, read back by category so no genesis output index is assumed. */
function participantUtxo(
  pools: {
    masters: readonly Utxo[]; validators: readonly Utxo[]; records: readonly Utxo[];
    collectionNodes: readonly Utxo[];
  },
  id: string,
): Utxo | undefined {
  const nftIndex = recordIndexOfRecord(id);
  if (nftIndex !== undefined) return pools.records[nftIndex];
  const headCollection = mappingHeadCollection(id);
  if (headCollection !== undefined) {
    // The genesis minted the collection's empty head, and no write has moved it yet, so the live node carrying the
    // empty list's own commitment is the one the hop spends.
    const head = bytesToHexText(headSentinelCommitment());
    return pools.collectionNodes.find((node) => node.token?.nft?.commitment === head);
  }
  const nodeSlot = mappingNodeSlot(id);
  if (nodeSlot !== undefined) {
    // A node the entry spends that is not the empty head: its id names the slot, which its commitment carries.
    const slot = bytesToHex(nodeSlot);
    return pools.collectionNodes.find((node) => {
      const commitment = node.token?.nft?.commitment;
      return commitment !== undefined
        && bytesToHex(decodeEntryCommitment(new Uint8Array(hexToBin(commitment))).slot) === slot;
    });
  }
  const pool = id === PROXY_MASTER_ID || id === IMPLEMENTATION_MASTER_ID ? pools.masters
    : id === VALIDATOR_ID ? pools.validators
      : undefined;
  return pool?.[0];
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
  if (!bytesEqual(callerLock, options.callerLockingBytecode)) {
    throw new PerCallProxyDeployError(
      'the caller funding unlocker signs for a lock that is not the hop\'s caller lock, so the root frame\'s '
      + '`msg.sender` binding would not hold',
    );
  }

  // The pools the two geneses published, read back by category and classified the way a per-call deployment mints
  // them, so a participant is placed on the outpoint it actually sits on rather than a genesis output index.
  const proxyPools = await readPerCallDeployment(
    provider, options.proxyCategoryId, options.proxyArtifact.stateLayout!);
  const implementationPools = await readPerCallDeployment(
    provider, options.implementationCategoryId, options.implementationArtifact.stateLayout!);

  const { TransactionBuilder } = await import('../../TransactionBuilder.js');
  // The hop's own shape is fixed - the composer assembled every contract input and there is no oracle or side-car
  // to co-spend - so the builder must not append anything.
  const builder = new TransactionBuilder({ provider, skipAutomaticCoSpends: true });
  // The builder defaults to locktime 0, which would serialize a different transaction than the one derived: the
  // hop's signature and every frame that reads `block.timestamp` were made over the derived locktime, so the
  // broadcast carries that same one.
  builder.setLocktime(program.transaction.locktime ?? 0);
  for (const placed of draft.layout.participants) {
    const source = program.sourceOutputs[placed.index];
    const unlockingBytecode = program.transaction.inputs[placed.index]?.unlockingBytecode;
    if (source === undefined || unlockingBytecode === undefined) {
      throw new PerCallProxyDeployError(
        `the derived hop carries no input for participant "${placed.id}"`);
    }
    // A validator's facet holds no token and pins no category, so any live UTXO of its code serves the input; the
    // composer supplies its source, so the lookup is by the lock the plan states.
    const facetUtxos = placed.kind === 'facet'
      ? await provider.getUtxosForLockingBytecode(source.lockingBytecode)
      : [];
    const real = options.spentUtxos?.get(placed.id)
      ?? participantUtxo(placed.id === IMPLEMENTATION_MASTER_ID ? implementationPools : proxyPools, placed.id)
      ?? facetUtxos.find((utxo) => utxo.satoshis === source.valueSatoshis)
      ?? facetUtxos[0];
    if (real === undefined) {
      throw new PerCallProxyDeployError(
        `the deployment holds no live UTXO for the hop's "${placed.id}"`);
    }
    if (real.satoshis !== source.valueSatoshis) {
      throw new PerCallProxyDeployError(
        `the hop's "${placed.id}" holds ${real.satoshis} satoshis, but the derived hop spends `
        + `${source.valueSatoshis}`,
      );
    }
    const token = source.token === undefined
      ? {}
      : { token: libauthTokenDetailsToSolidCashTokenDetails(source.token) };
    const utxo: Utxo = { txid: real.txid, vout: real.vout, satoshis: source.valueSatoshis, ...token };
    // The sequence the derived hop carries, so the broadcast is the same transaction the frames were evaluated
    // against rather than one the builder's own default rewrites.
    const sequence = program.transaction.inputs[placed.index]?.sequenceNumber;
    builder.addInput(utxo, rawUnlocker(source.lockingBytecode, unlockingBytecode),
      sequence === undefined ? undefined : { sequence });
  }
  // The deployer's own coin funds the hop and is the frame's root caller; its signature is a real one over the
  // real transaction, which is what the root's `msg.sender` binding and the provider both check. Its sequence is
  // the caller's own choice, not the composer's.
  builder.addInput(callerFunding.utxo, callerFunding.funder);

  // Every participant recreates in place, so its output index is its input index; anything the composer placed
  // after them (events, sends, created records) is trailing. The funders' recreations are replaced by the
  // caller's change below, which is the only non-participant the plan has.
  const settled = draft.layout.participantCount + draft.trailingOutputs.length;
  for (const output of program.transaction.outputs.slice(0, settled)) {
    builder.addOutput(libauthOutputToSolidCashOutput(output));
  }
  builder.addBchChangeOutputIfNeeded({
    to: callerFunding.changeAddress ?? options.callerLockingBytecode, feeRate: 1,
  });

  // A composition's assembled unlocking bytecodes are wider than the production per-input ceiling (the validator's
  // alone is over 10,000 bytes), which the composition profile the hop runs under widens. `TransactionBuilder.send`
  // judges its bytes against the production ceiling and would refuse the hop the provider's own profile accepts, so
  // the hop is materialized by the builder and handed to the provider directly. The provider stays the decider.
  const transaction = builder.buildLibauthTransaction();
  const { binToHex, encodeTransaction, hash256 } = await import('@bitauth/libauth');
  const rawBytes = encodeTransaction(transaction);
  const rawHex = binToHex(rawBytes);
  const submitPrepared = provider.sendPreparedTransaction?.bind(provider);
  const txid = submitPrepared !== undefined
    ? await submitPrepared({ rawHex, rawBytes, transaction })
    : await provider.sendRawTransaction(rawHex);
  const expected = binToHex(hash256(rawBytes).reverse());
  if (txid !== expected) {
    throw new PerCallProxyDeployError(
      `the provider returned txid ${txid} for the hop, not the ${expected} its bytes hash to`,
    );
  }
  const { attachWait } = await import('../../wait.js');
  return attachWait({ ...transaction, txid, hex: rawHex } as TransactionDetails, provider);
}

/** What a caller asks a proxied per-call contract for, and what the call produced. */
export interface PerCallProxyCallOptions {
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
  /** The contracts the entry's published call sites reach, keyed by the interface the site calls. */
  readonly externals?: Readonly<Record<string, PerCallProxyExternal>>;
  readonly vm?: Machine;
}

/** A proxied call's outcome, shaped the way the direct call path's is so a handle can treat them alike. */
export interface PerCallProxyCallResult {
  readonly transaction: NonNullable<ShippedVmProgram['transaction']>;
  readonly sourceOutputs: ShippedVmProgram['sourceOutputs'];
  readonly draft: CompositionDraft;
  readonly completed: readonly FrameRequest[];
  readonly verdicts: readonly InitializeVerdict[];
  readonly accepted: boolean;
  readonly writtenCommitments: readonly Uint8Array[];
  /** The payload of each event the entry emitted, in emit order. */
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
  readonly broadcast?: TransactionDetails;
}

/**
 * Calls an entry of a per-call implementation through the proxy in front of it.
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
 */
export async function callPerCallProxyEntry(
  options: PerCallProxyCallOptions,
): Promise<PerCallProxyCallResult> {
  const { provider, implementationArtifact } = options;
  const proxyArtifact = options.proxyArtifact ?? buildProxyArtifact(implementationArtifact);
  requireProxyShape(proxyArtifact);
  requireSharedLayout(implementationArtifact, proxyArtifact);
  if (!implementationArtifact.abi.some((entry) => entry.name === options.functionName)) {
    throw new PerCallProxyDeployError(
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
    throw new PerCallProxyDeployError(
      `a root frame's caller is a 25-byte P2PKH lock; got ${options.callerLockingBytecode.length} bytes`,
    );
  }

  // A generated proxy declares only the implementation's fields, not its mappings, so the classification layout
  // carries the implementation's collections: they name the entry covenants a live mapping node sits at, which is
  // what tells one collection's nodes from another's.
  const proxyLayout = proxyArtifact.stateLayout!;
  const classificationLayout = implementationArtifact.stateLayout?.collections === undefined ? proxyLayout
    : { ...proxyLayout, collections: implementationArtifact.stateLayout.collections };
  const proxyPools = await readPerCallDeployment(provider, options.proxyCategoryId, classificationLayout);
  if (proxyPools.records.length !== proxyLayout.dataNftCount) {
    throw new PerCallProxyDeployError(
      `category ${options.proxyCategoryId} holds ${proxyPools.records.length} record(s) for a proxy whose layout `
      + `declares ${proxyLayout.dataNftCount} data NFT(s)`,
    );
  }
  const proxyMasterUtxo = proxyPools.masters[0];
  const validatorUtxo = proxyPools.validators[0];
  if (proxyMasterUtxo === undefined || validatorUtxo === undefined) {
    throw new PerCallProxyDeployError(
      `category ${options.proxyCategoryId} holds no proxy master or no validator, which a call is admitted by`,
    );
  }
  const implementationPools = await readPerCallDeployment(
    provider, options.implementationCategoryId, implementationArtifact.stateLayout!);
  const implementationMasterUtxo = implementationPools.masters[0];
  if (implementationMasterUtxo === undefined) {
    throw new PerCallProxyDeployError(
      `category ${options.implementationCategoryId} holds no implementation master, which the forwarded frame `
      + 'runs from',
    );
  }
  const recordCommitments = proxyPools.records.map((record, nftIndex) => {
    const commitment = record.token?.nft?.commitment;
    if (commitment === undefined) {
      throw new PerCallProxyDeployError(
        `the record at data NFT ${nftIndex} of category ${options.proxyCategoryId} carries no commitment`,
      );
    }
    return hexToBin(commitment);
  });

  const validatorProgram = perCallValidator.buildValidatorProgram();
  const proxyCategory = hexToBin(options.proxyCategoryId);
  const implementationCategory = hexToBin(options.implementationCategoryId);
  const proxyMaster = deployMaster(proxyArtifact, proxyCategory, validatorProgram);
  const implementationMaster = deployMaster(implementationArtifact, implementationCategory, validatorProgram);
  const vm = options.vm ?? await providerMachine(provider);
  const maximumCommitmentBytes = provider.consensusLimits?.maximumNftCommitmentBytes
    ?? DEFAULT_MAXIMUM_COMMITMENT_BYTES;
  const recordAmounts = proxyPools.records.map((record) => record.satoshis);

  // The live deployment: the record's commitments give a dynamic value's length, and the category's chunk UTXOs
  // are both a dynamic value's chunks and a mapping value's continuation chunks. `collectionNodes` holds the
  // latter — a mapping node's value chunks sit at their own root-salted covenant, not at the collection's.
  const writesRequest = {
    artifact: implementationArtifact,
    functionName: options.functionName,
    ...(options.args === undefined ? {} : { args: options.args }),
    callerLockingBytecode: options.callerLockingBytecode,
    liveDeployment: {
      category: proxyCategory,
      recordCommitments,
      chunks: [...proxyPools.chunks, ...proxyPools.collectionNodes],
      nodesByCollection: proxyPools.nodesByCollection,
    },
  } as const;
  // An entry whose element the artifact cannot state still writes the value's byte length into the record, so the
  // run it grows is re-planned from the commitment the plan states: the first attempt lays it at the live width,
  // the record's own close hands back the length the body wrote, and the run is laid at that length's chunks.
  const entryWritesFor = (commitments: readonly Uint8Array[]): HopEntryWrites | undefined =>
    hopEntryWrites({ ...writesRequest, writtenCommitments: commitments });
  // The calls the entry's own body makes through the proxy hop: the plan states their records, and each callee's
  // frame runs from the live deployment the caller named for it. The entry's own facts are the proxy's record
  // values, the proxy's own address for `address(this)`, and the caller's lock for `msg.sender`.
  const externalPlan = await planHopExternalCalls({
    provider, artifact: implementationArtifact, functionName: options.functionName,
    args: options.args ?? [], externals: options.externals ?? {}, validatorProgram,
    stateValues: deploymentStateValues(proxyLayout, options.proxyCategoryId, proxyPools),
    selfAddress: proxyMaster.address,
    senderAddress: options.callerLockingBytecode,
  });
  const settled = await settleHop({
    vm,
    proxyArtifact,
    implementationArtifact,
    root: rootOn(proxyArtifact),
    maximumCommitmentBytes,
    recordCommitments,
    entryWritesFor,
    ...(externalPlan.callees.length === 0 ? {} : { callees: externalPlan.callees }),
    eventCommitments: hopEventSentinels(
      implementationArtifact, options.functionName, proxyCategory, maximumCommitmentBytes,
    ),
    ...(retvalPlaceholder === undefined ? {} : { retvalPlaceholder }),
    entryLabel: entryLabelFor(options.functionName),
    planFor: (
      writtenCommitments, attemptWrites, entryWriteViews, eventCommitments, implementationRetval, calleeRetvals,
      calleeWriteViews, calleeEventCommitments,
    ) => buildHopPlan({
      proxyArtifact, implementationArtifact, implementationMaster, proxyMaster,
      proxyCategory, implementationCategory, recordCommitments, writtenCommitments,
      ...(attemptWrites === undefined ? {} : { entryWrites: attemptWrites }),
      entryWriteViews,
      implementationRetval,
      ...(externalPlan.calls.length === 0 ? {} : { calls: externalPlan.calls }),
      ...(externalPlan.callBases.length === 0 ? {} : { callBases: externalPlan.callBases }),
      ...(externalPlan.callees.length === 0 ? {} : { callees: externalPlan.callees, calleeRetvals }),
      ...(calleeWriteViews.size === 0 ? {} : { calleeWriteViews }),
      ...(calleeEventCommitments.size === 0 ? {} : { calleeEventCommitments }),
      maximumCommitmentBytes,
      eventOutputs: hopEventOutputs(implementationArtifact, options.functionName, proxyCategory, eventCommitments),
      recordLockingBytecode: stateRecordLockingBytecode(options.proxyCategoryId),
      recordCategoryHex: options.proxyCategoryId,
      callerSatoshis: options.callerUtxo.satoshis,
      proxyMasterAmount: proxyMasterUtxo.satoshis,
      implementationMasterAmount: implementationMasterUtxo.satoshis,
      validatorAmount: validatorUtxo.satoshis,
      recordAmounts,
      callerLockingBytecode: options.callerLockingBytecode,
      entry: { functionName: options.functionName, args: options.args ?? [] },
    }),
  });

  const broadcast = await broadcastHop({
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
    ...(settled.entryWrites === undefined && externalPlan.utxos.size === 0
      ? {}
      : { spentUtxos: new Map([...(settled.entryWrites?.spentUtxos ?? []), ...externalPlan.utxos]) }),
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
