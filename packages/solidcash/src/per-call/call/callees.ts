/**
 * The callee frames a plain call's entry reaches (spec 10 and 18).
 *
 * An entry that calls another contract binds each call to a record of its own frame, and the record names the
 * callee frame the transaction runs on a master of the callee's contract. The calls and the frames they reach are
 * planned as the proxy hop plans its delegate frame's (`planHopExternalCalls`): from the entry's own arguments, state
 * and address, transitively, each reach on a master of its contract's live pool. Each callee is a frame of its
 * contract's own block, entered by the frame that calls it, and what its body returns is learned from its own close,
 * deepest first, before the caller that reads it.
 *
 * A callee may read and rewrite its own data records, emit, read and write its mappings, and call further contracts.
 * Its events and mapping nodes are planned as the hop plans its delegate frame's callees: one output per event it
 * emits, after the root's own, at the covenant its category derives; and the node each key it reads or writes sits at,
 * or the one a new key is spliced beside, declared in the segment its artifact publishes for the write, with the node
 * an insert creates as a trailing output. Each event's payload and each written node's end view are its body's to
 * compute, so they are learned from its own close, as its return is. A contract entered more than once chains its
 * data records and its nodes across its frames in the order the validator walks them: a frame starts from the view
 * the last write before it leaves, which is learned from that frame's own close before the frame is read, and names a
 * node an earlier frame created at that frame's output. The nodes are chained as the hop chains them.
 *
 * A shape this path does not settle yet is refused by name: a callee behind a proxy; one that touches a dynamic
 * value's or a mapping value's chunks, sends value or co-spends a side-car; a frame that only reads a node an
 * earlier frame created; reaches of one collection one transaction cannot carry; and a deployment entered twice whose
 * frames name data records that no order of its block keeps side by side. A site, of the entry or of a callee frame,
 * whose argument reads an earlier call's result stops the plan before it (`blocked`), and a call the entry guards on
 * one is stated from the results the plan was made from (`conditionalProducers`): the call plans again once the
 * frames of the earlier calls answered. Two deployments of one contract are two blocks, each its own category's. A
 * frame the plan runs beside the callees on one of their contracts, a value send's `receive()`, counts among the
 * contract's masters, and a callee that runs after it starts from the views it left.
 */

import { hexToBin } from '@bitauth/libauth';
import {
  bytesEqual, bytesToHex, FrameKind, INDEX_NONE, sha256, type Artifact, type PublishedWriteSegment, type RecordEntry,
} from '@solidcash/utils';
import type { FunctionArgument } from '../../Argument.js';
import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import {
  findParticipant,
  participant,
  readPublishedStopSites,
  unstatedViewPlaceholder,
  type CompositionDraft,
  type ContractBlock,
  type DraftCall,
  type DraftInput,
  type DraftMaster,
  type DraftRecordEntry,
  type DraftSourceOutput,
  type PlannedSettlement,
  type TransactionLayout,
} from '../composer/index.js';
import {
  entryRecordReadUnlock, eventCloseOf, eventLockingBytecode, eventSentinel, readComputedDeclaration,
  stateRecordUnlockingBytecode, type PerCallDeploymentSet,
} from '../deploy/index.js';
import { calleeSettleOrder } from '../proxy/deploy.js';
import { sharedNodeId } from '../proxy/entry-writes.js';
import { PerCallProxyDeployError } from '../proxy/errors.js';
import {
  chainedNodeIds, deploymentStateValues, planHopExternalCalls, requireSatisfiableReachWrites, routingOf,
  sharedNodeWritersBefore,
  type HopCallee, type HopCalleeRecord, type HopExternalPlan, type HopPlanBlock, type PerCallProxyExternal,
} from '../proxy/external-calls.js';
import { adjacentRecordOrder, frameDataRecordIndices, namedDataRecordIndices } from './entry-records.js';
import { publishedLoopEffects } from './loop-turns.js';

/** Raised when an entry's callee frames cannot be planned; `call.ts` rethrows it as the call's own error. */
export class PerCallCalleeError extends Error {
  public readonly name = 'PerCallCalleeError';

  public constructor(message: string) {
    super(message);
  }
}

/** The calls an entry makes and the callee frames they reach, as one plain call states them. */
export interface PlannedCallees {
  /** The calls the entry's own body makes, in execution order. */
  readonly calls: readonly DraftCall[];
  /** For each published call site of the entry, the position of its first call in `calls`, or `-1` for none. */
  readonly callBases: readonly number[];
  /** The callsite id of each published call site, parallel to `callBases`. */
  readonly callsiteIds: readonly number[];
  /**
   * The callsite ids whose results a condition of the entry's own reads. A site such a condition guards is stated
   * from the results the plan was made from (`externalReturns`): with none, the plan states no call for it.
   */
  readonly conditionalProducers: readonly number[];
  /** Every callee frame, in placement order: a frame sits after the frame that calls it. */
  readonly callees: readonly HopCallee[];
  /** The live UTXO of every callee participant, keyed by the id the plan places it under. */
  readonly utxos: ReadonlyMap<string, Utxo>;
  /** One block per callee deployment, in placement order: its masters and the records its frames declare. */
  readonly blocks: readonly ContractBlock[];
  /** The callee blocks, each once, which the root's validator covers. */
  readonly contracts: readonly string[];
  /** The artifacts the callee frames run, each once. */
  readonly artifacts: readonly Artifact[];
  /** How many event outputs the callee frames list, which follow the root's own. */
  readonly eventCount: number;
  /** How many values the callee frames' bodies compute that the plan learns: returns, payloads and node views. */
  readonly learnable: number;
  /**
   * The site the plan stops before, of the entry's own or of a callee frame's, for a site whose argument or loop bound
   * reads earlier calls' results that `reachedResults` does not hold yet. Such a plan states the calls before the site
   * only, and a frame it stops inside is `truncated`: enough to learn those results from the frames of the calls that
   * return them, never enough to broadcast.
   */
  readonly blocked?: HopPlanBlock;
}

/** What the callee frames' own bodies computed, by master, as far as the plan has learned it. */
export interface CalleeValues {
  readonly retvals: ReadonlyMap<string, Uint8Array>;
  /** Each event's payload, in emit order; a position not learned yet carries its sentinel. */
  readonly events: ReadonlyMap<string, readonly (Uint8Array | undefined)[]>;
  /** Each value-dependent node's end view, in its write's learning order; one not learned yet is its candidate. */
  readonly views: ReadonlyMap<string, readonly (Uint8Array | undefined)[]>;
}

/** No callee value learned yet. */
export const NO_CALLEE_VALUES: CalleeValues = { retvals: new Map(), events: new Map(), views: new Map() };

/** What an entry's callee frames are planned from: the root's own facts and the deployments it may reach. */
export interface CalleePlanOptions {
  readonly provider: NetworkProvider;
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly args: readonly FunctionArgument[];
  /** The deployments the entry may reach, each found by the address its category derives. */
  readonly externals: Readonly<Record<string, PerCallProxyExternal>>;
  readonly validatorProgram: Uint8Array;
  readonly categoryId: string;
  readonly deployment: PerCallDeploymentSet;
  /** The root's own address, `address(this)`, and its caller's lock, `msg.sender`. */
  readonly selfAddress: Uint8Array;
  readonly senderAddress: Uint8Array;
  /** The results earlier calls returned, as a stopped plan's frames handed them back (`reachedResultKey`). */
  readonly reachedResults?: ReadonlyMap<string, FunctionArgument>;
  /** The results the entry's own guards read, by callsite id, as the callees of an earlier plan returned them. */
  readonly externalReturns?: ReadonlyMap<number, FunctionArgument>;
}

/** The keys the root and the caller's named deployments are handed to the planner under, which no interface can be. */
const ROOT_EXTERNAL = '\u0000root';
const EXTERNAL_KEY = '\u0000external\u0000';

/** The satoshi value an event output carries, as the root's own event outputs do. */
const EVENT_OUTPUT_SATOSHIS = 1_000n;

/** The writes an entry's artifact publishes, or undefined when it does not fix the segment of every write. */
function publishedWrites(artifact: Artifact, functionName: string): readonly PublishedWriteSegment[] | undefined {
  const identity = `${artifact.contractName}.${functionName}()`;
  return readPublishedStopSites(artifact).entries
    .find((candidate) => candidate.functionName === identity)?.writeSegments;
}

/**
 * The data records an entry's own body writes, by record index, at every segment the artifact publishes for each;
 * the run's last segment is the one after the frame's `calls` calls.
 */
function publishedRecordWrites(
  artifact: Artifact, functionName: string, calls: number,
): ReadonlyMap<number, readonly number[]> {
  const records = new Map<number, number[]>();
  for (const write of publishedWrites(artifact, functionName) ?? []) {
    if (write.record === undefined) continue;
    const segment = write.segment === 'last' ? calls : write.segment;
    const segments = records.get(write.record) ?? [];
    if (!segments.includes(segment)) segments.push(segment);
    records.set(write.record, segments);
  }
  return records;
}

/**
 * The segment a callee frame's mapping write lands in, or undefined when its artifact does not fix one.
 *
 * The artifact publishes the segment of each collection's write; a frame that makes no call has one segment, so its
 * write can only land there. Writes the artifact places in several segments are not one landing, and are refused. A
 * frame a stopped plan states only the first calls of is never settled on that plan, so a write past its last stated
 * call is declared in its last segment, as the hop declares one.
 */
function mappingWriteSegment(callee: HopCallee): number | undefined {
  const segments = new Set((publishedWrites(callee.artifact, callee.entry) ?? [])
    .filter((write) => write.collection !== undefined)
    .map((write) => (write.segment === 'last' ? callee.calls.length : write.segment)));
  if (segments.size === 0) return callee.calls.length === 0 ? 0 : undefined;
  const [segment] = [...segments];
  if (segments.size !== 1) return undefined;
  if (callee.truncated === true) return Math.min(segment!, callee.calls.length);
  return segment! <= callee.calls.length ? segment : undefined;
}

/** The records one callee frame declares, in the order its entry's block layout names them. */
function declaredRecords(callee: HopCallee): readonly HopCalleeRecord[] {
  return frameDataRecordIndices(callee.artifact, callee.entry)
    .map((nftIndex) => callee.records[nftIndex])
    .filter((record): record is HopCalleeRecord => record !== undefined);
}

/** The ids of the records one callee frame's block layout names, which its body reads from one base, in that order. */
function namedRecordIds(callee: HopCallee): readonly string[] {
  return namedDataRecordIndices(callee.artifact, callee.entry)
    .map((nftIndex) => callee.records[nftIndex]?.id)
    .filter((id): id is string => id !== undefined);
}

/** The events one callee frame's entry emits, in emit order. */
function emitsOf(callee: HopCallee): readonly { readonly eventSignature: string; readonly emitIndex: number }[] {
  const abi = callee.artifact.abi.find((candidate) => candidate.name === callee.entry);
  return [...(abi?.emits ?? [])].sort((left, right) => left.emitIndex - right.emitIndex);
}

/**
 * The payload each of a callee's event outputs carries until its own close hands back the one it computed, or the
 * empty commitment of an emit the reach's facts decide the body skips, which is stated outright.
 */
function calleeEventSentinels(callee: HopCallee, maximumCommitmentBytes: number): readonly Uint8Array[] {
  return emitsOf(callee).map((emit, position) => (callee.skippedEmits?.includes(emit.emitIndex)
    ? new Uint8Array(0) : eventSentinel(callee.category, callee.artifact.contractName, position, maximumCommitmentBytes)));
}

/**
 * True when a callee frame touches chunk records: a dynamic value's run, on its own or beside a mapping write, or a
 * mapping whose values chunk. Its other mapping nodes are what this path plans.
 */
function touchesChunks(callee: HopCallee): boolean {
  const abi = callee.artifact.abi.find((candidate) => candidate.name === callee.entry);
  const chunking = new Set((callee.artifact.stateLayout?.collections ?? [])
    .filter((collection) => collection.chunkableValue === true).map((collection) => collection.name));
  const dynamic = (abi?.dynamicReads ?? []).length + (abi?.dynamicWrites ?? []).length > 0;
  const writes = callee.entryWrites;
  return (writes !== undefined && (writes.collection === undefined || dynamic
    || writes.reachWrites.some((write) => write.chunkable)))
    || callee.readNodes.some((node) => chunking.has(node.collection));
}

/** The ABI entry a contract's fallback is published under, which a call routed to it names. */
const FALLBACK_ENTRY = '__fallback';

/**
 * One frame's calls as its sites' own code binds them.
 *
 * The hop states a call from the callee entry it reaches: that entry's mutability picks the frame kind, and its own
 * selector leads the call data. A low-level call's spelling chose its frame kind instead, and one routed to its
 * target's fallback carries its payload's selector, which the fallback's own entry does not have; the artifact
 * publishes both for the site, so every call the site makes takes them from there.
 */
function spelledCalls(
  artifact: Artifact, entry: string, calls: readonly DraftCall[], callBases: readonly number[],
): DraftCall[] {
  const identity = `${artifact.contractName}.${entry}()`;
  const sites = readPublishedStopSites(artifact).entries
    .find((candidate) => candidate.functionName === identity)?.calls ?? [];
  const routing = routingOf(artifact, entry);
  const spelled = [...calls];
  callBases.forEach((base, site) => {
    const row = routing[site];
    if (base < 0 || row === undefined) return;
    const end = callBases.slice(site + 1).find((later) => later >= 0) ?? calls.length;
    const selector = row.functionName === FALLBACK_ENTRY ? sites[site]?.selector : undefined;
    const kind = row.callMode === 'staticcall' ? FrameKind.STATIC
      : row.callMode === 'call' ? FrameKind.CALL : undefined;
    for (let at = base; at < end; at += 1) {
      const call = spelled[at]!;
      const argumentPushes = selector === undefined
        ? call.argumentPushes : [hexToBin(selector), ...call.argumentPushes.slice(1)];
      spelled[at] = { ...call, kind: kind ?? call.kind, argumentPushes };
    }
  });
  return spelled;
}

/** A plan whose calls, and the callee frames they enter, carry what each site's own code binds. */
function withSpelledCalls(plan: HopExternalPlan, artifact: Artifact, entry: string): HopExternalPlan {
  const calls = spelledCalls(artifact, entry, plan.calls, plan.callBases);
  const callees = plan.callees.map((callee) => ({
    ...callee, calls: spelledCalls(callee.artifact, callee.entry, callee.calls, callee.callBases),
  }));
  const kindOf = new Map([...calls, ...callees.flatMap((callee) => callee.calls)]
    .map((call) => [call.callee, call.kind]));
  return {
    ...plan, calls, callees: callees.map((callee) => ({ ...callee, kind: kindOf.get(callee.master) ?? callee.kind })),
  };
}

/** The shape one callee frame takes that this path does not settle yet, or undefined for one it does. */
function unservedCallee(callee: HopCallee, sideCars: boolean): string | undefined {
  const label = `the callee "${callee.functionName}"`;
  if (callee.kind !== FrameKind.CALL && callee.kind !== FrameKind.STATIC) {
    return `${label} is entered as a delegate frame, which this call path does not plan yet`;
  }
  if (callee.retvalFrom !== undefined || callee.recordOwner !== undefined) {
    return `${label} sits behind a proxy, whose delegate frame this call path does not plan yet`;
  }
  const abi = callee.artifact.abi.find((candidate) => candidate.name === callee.entry);
  if ((abi?.transferCount ?? 0) > 0) return `${label} sends value, which this call path does not plan yet`;
  if (touchesChunks(callee)) {
    return `${label} touches a dynamic value's or a mapping value's chunks, which this call path does not plan yet`;
  }
  if (sideCars) return `${label} co-spends a side-car, which this call path does not plan yet`;
  if (publishedLoopEffects(callee.artifact, callee.entry) !== undefined) {
    return `${label} emits, sends or hashes once per turn of a loop, which this call path does not plan for a callee `
      + 'yet';
  }
  if (publishedWrites(callee.artifact, callee.entry) === undefined
    || (callee.entryWrites !== undefined && mappingWriteSegment(callee) === undefined)) {
    return `${label} writes in a segment its artifact does not fix, which this call path does not plan yet`;
  }
  return undefined;
}

/**
 * Plans the calls one entry makes and the callee frames they reach, or answers undefined for an entry that makes
 * none. A shape this path does not settle is refused by name, before any frame is built.
 */
export async function planEntryCallees(options: CalleePlanOptions): Promise<PlannedCallees | undefined> {
  const identity = `${options.artifact.contractName}.${options.functionName}()`;
  const published = readPublishedStopSites(options.artifact).entries
    .find((candidate) => candidate.functionName === identity);
  const count = published?.calls.length ?? 0;
  if (count === 0) return undefined;
  const refuse = (why: string): never => {
    throw new PerCallCalleeError(`entry "${options.functionName}" makes ${count} external call(s): ${why}`);
  };
  const layout = options.artifact.stateLayout!;
  // Every deployment the caller names, and the root itself, is found by the address its category derives: the
  // planner reads a key that is no interface name only by address. A call to the root's own address then meets the
  // planner's refusal of a contract below itself rather than an unknown target.
  const externals = Object.fromEntries([
    ...Object.entries(options.externals).map(([name, external]) => [`${EXTERNAL_KEY}${name}`, external] as const),
    [ROOT_EXTERNAL, { artifact: options.artifact, categoryId: options.categoryId }] as const,
  ]);
  let plan: Awaited<ReturnType<typeof planHopExternalCalls>>;
  try {
    plan = await planHopExternalCalls({
      provider: options.provider,
      artifact: options.artifact,
      functionName: options.functionName,
      args: options.args,
      externals,
      validatorProgram: options.validatorProgram,
      stateValues: deploymentStateValues(layout, options.categoryId, options.deployment),
      entryDeployment: { categoryId: options.categoryId, deployment: options.deployment, layout },
      selfAddress: options.selfAddress,
      senderAddress: options.senderAddress,
      ...(options.reachedResults === undefined ? {} : { reachedResults: options.reachedResults }),
      ...(options.externalReturns === undefined ? {} : { externalReturns: options.externalReturns }),
    });
  } catch (error) {
    if (!(error instanceof PerCallProxyDeployError)) throw error;
    return refuse(error.message);
  }
  plan = withSpelledCalls(plan, options.artifact, options.functionName);
  // A site that reads earlier calls' results stops the plan before it, and a guard of the entry's own over one states
  // the site from the results the plan was made from: the call learns those results from the calls' own frames and
  // plans again (`call.ts`).
  for (const callee of plan.callees) {
    const why = unservedCallee(callee, plan.sideCars.has(callee.master));
    if (why !== undefined) refuse(why);
  }
  // A frame that only reads a node an earlier frame of its contract created names it at that frame's output.
  const createdRead = plan.callees.find((callee) => callee.readNodes.some((node) => node.createdSlot !== undefined));
  if (createdRead !== undefined) {
    refuse(`the callee "${createdRead.functionName}" reads a mapping node an earlier frame of its contract created, `
      + 'which this call path does not declare yet');
  }
  // A deployment entered more than once is settled by the validator, which chains its records' views across its
  // frames: its data records here (`calleeFrames`), and the nodes its frames write over every frame of the call, as
  // the hop chains them (`call.ts`). Reaches of one collection one transaction cannot carry are refused by name, as
  // the hop refuses them. A block is a deployment's, so two deployments of one contract are two blocks, each with its
  // own masters and records (`HopCallee.block`).
  try {
    requireSatisfiableReachWrites(plan.callees);
  } catch (error) {
    if (!(error instanceof PerCallProxyDeployError)) throw error;
    refuse(error.message);
  }
  const byBlock = new Map<string, HopCallee[]>();
  for (const callee of plan.callees) byBlock.set(callee.block, [...(byBlock.get(callee.block) ?? []), callee]);
  // A contract's block holds the records its frames declare, then the nodes they only read, then the nodes their
  // writes spend, each once: the order each frame's own body reads them in. A frame reads the records its layout
  // names from one base, so they are placed side by side for every frame, or the call is refused by name.
  const blocks = [...byBlock].map(([block, frames]): ContractBlock => {
    const state: string[] = [];
    const place = (id: string): void => {
      if (!state.includes(id)) state.push(id);
    };
    for (const frame of frames) {
      for (const record of declaredRecords(frame)) place(record.id);
      for (const node of frame.readNodes) if (node.utxo !== undefined) place(node.id);
      for (const id of frame.entryWrites?.participantIds ?? []) place(id);
    }
    const recordIndex = new Map(frames[0]!.records.map((record, nftIndex) => [record.id, nftIndex]));
    const ordered = adjacentRecordOrder(state, frames.map(namedRecordIds), recordIndex, (split) => refuse(
      `the callee "${frames[split]!.functionName}" reads its data records of "${block}" side by side, and no `
      + 'order of the records the call\'s other frames of that contract name keeps them so',
    ));
    return { contract: block, masters: frames.map((frame) => frame.master), state: ordered };
  });
  const artifacts = [...new Set(plan.callees.map((callee) => callee.artifact))];
  const eventCount = plan.callees.reduce((total, callee) => total + emitsOf(callee).length, 0);
  const learnable = eventCount + plan.callees.reduce((total, callee) => total + (callee.returns ? 1 : 0)
    + (callee.entryWrites?.learningCandidates.length ?? 0), 0);
  return {
    calls: plan.calls, callBases: plan.callBases, callsiteIds: plan.callsiteIds,
    conditionalProducers: plan.conditionalProducers, callees: plan.callees, utxos: plan.utxos, blocks,
    contracts: [...byBlock.keys()], artifacts, eventCount, learnable,
    ...(plan.blocked === undefined ? {} : { blocked: plan.blocked }),
  };
}

/** True when a callee frame writes its contract's records: a data record or a mapping node. */
export function calleeWrites(callee: HopCallee): boolean {
  return publishedRecordWrites(callee.artifact, callee.entry, 0).size > 0 || callee.entryWrites !== undefined;
}

/** The candidate a callee's `retval` starts from: a value its own return comparison fails against. */
export function calleeRetvalPlaceholder(callee: HopCallee): Uint8Array {
  return sha256(new TextEncoder().encode(`per-call callee retval\u0000${callee.master}\u0000${callee.functionName}`));
}

/** What the callee frames add to a plan once every coordinate is laid out. */
export interface CalleeFrames {
  readonly masters: readonly DraftMaster[];
  readonly inputs: Readonly<Record<string, DraftInput>>;
  /** The callee categories the validator settles: each one spent under two or more masters. */
  readonly settles: readonly PlannedSettlement[];
  /** The frames' event outputs, in master order, from `eventBase` on. */
  readonly eventOutputs: readonly DraftSourceOutput[];
  /** The records the frames' writes create, in master order, from `createdBase` on. */
  readonly createdOutputs: readonly DraftSourceOutput[];
  /**
   * For a contract the calls enter more than once whose frames write its nodes, what the views of those nodes are
   * chained from in the order the validator walks every frame of the call (`chainSharedNodeViews`): the input index
   * of each node the frames touch, the declarations their writes transition a node with, and those that only relink
   * one.
   */
  readonly chain?: {
    readonly nodes: ReadonlySet<number>;
    readonly writes: ReadonlySet<DraftRecordEntry>;
    readonly relinks: ReadonlySet<DraftRecordEntry>;
  };
}

/**
 * The callee frames as masters of a plan, with their inputs, outputs and the settlements they need.
 *
 * Each frame is entered by the frame that calls it, with that frame's address as its `msg.sender`, and runs on its
 * own contract's records: a record it keeps is declared at the commitment it was spent with, and a record its body
 * writes is declared kept up to the segment the artifact publishes for the write, unstated there for the derivation
 * to learn, and carried on after it. A frame that makes `k` calls closes `k + 1` segments. The mapping nodes it only
 * reads follow its records, kept, and the nodes its write touches follow them, declared where the write lands and
 * kept on either side of it. Its event outputs and created nodes take the trailing indices the caller hands it.
 */
export function calleeFrames(options: {
  readonly planned: PlannedCallees;
  readonly layout: TransactionLayout;
  /** The root's master, address and origin, which a first-level callee is entered by. */
  readonly rootMaster: string;
  readonly rootAddress: Uint8Array;
  readonly origin: string;
  /** What each callee's own body computed, once learned. */
  readonly values: CalleeValues;
  /** The output the first callee event sits at, past the root's own, and the first a callee's write creates. */
  readonly eventBase: number;
  readonly createdBase: number;
  /** The satoshis a created node carries when its contract holds no record to take them from. */
  readonly recordAmount: bigint;
  /** The bound an event's sentinel payload is sized to. */
  readonly maximumCommitmentBytes: number;
  /** The value each callee frame takes as `msg.value`, by master: what the call that enters it carries. */
  readonly callValues?: ReadonlyMap<string, bigint>;
  /**
   * The frames the plan runs beside the callees on a callee's deployment: how many masters each block adds, and,
   * by callee master and record id, the view a record starts from in a frame that runs after one of them wrote it.
   */
  readonly beside?: {
    readonly masters: ReadonlyMap<string, number>;
    readonly startViews: ReadonlyMap<string, ReadonlyMap<string, Uint8Array>>;
  };
}): CalleeFrames {
  const { planned, layout, values } = options;
  const { callees } = planned;
  const callTo = new Map<string, DraftCall>();
  for (const call of [...planned.calls, ...callees.flatMap((callee) => callee.calls)]) {
    if (!callTo.has(call.callee)) callTo.set(call.callee, call);
  }
  const mastersOf = new Map<string, number>(options.beside?.masters ?? []);
  for (const callee of callees) mastersOf.set(callee.block, (mastersOf.get(callee.block) ?? 0) + 1);
  const indexOf = (id: string): number => participant(layout, id).index;
  // The master that writes each record, which the record's covenant names as the spend's authority.
  const writerOf = new Map<string, string>();
  // Each data record's view where the frames placed so far leave it. A contract's frames are placed in the order the
  // validator walks them (V6), and none runs inside another of its own contract, so a frame starts from the view the
  // last write before it leaves: that frame's unstated end, which the derivation learns from its own close.
  const chainEnds = new Map<string, Uint8Array>();
  const inputs: Record<string, DraftInput> = {};
  const eventOutputs: DraftSourceOutput[] = [];
  const createdOutputs: DraftSourceOutput[] = [];
  // The output each node an earlier frame created sits at, by the node's own identity: a later frame of its contract
  // names a node it does not spend by that output, as the hop names it, so its declaration chains onto the creator's.
  const createdElsewhere = new Map<string, number>();
  const createdNodeKey = (category: Uint8Array, collection: string, slot: Uint8Array): string =>
    sharedNodeId(bytesToHex(category), collection, slot);
  // The declarations each frame's own write transitions a node with, and those that only relink one; the copies kept
  // on either side of a write's segment are not. And the outputs each contract's writes create, which its
  // settlement lists.
  const writeTransitions = new Set<DraftRecordEntry>();
  const relinkTransitions = new Set<DraftRecordEntry>();
  const createdOf = new Map<string, number[]>();
  const masters = callees.map((callee): DraftMaster => {
    const caller = callee.enteredBy === null ? undefined : callees[callee.enteredBy];
    const positions = callee.calls.length + 1;
    const writes = publishedRecordWrites(callee.artifact, callee.entry, callee.calls.length);
    const declared = declaredRecords(callee);
    // One output per event the frame emits, each carrying the payload its body computed or, until that is learned,
    // a sentinel its own comparison fails against.
    const sentinels = calleeEventSentinels(callee, options.maximumCommitmentBytes);
    const payloads = values.events.get(callee.master) ?? [];
    const definitions = new Map((callee.artifact.events ?? []).map((definition) => [definition.signature, definition]));
    const events = emitsOf(callee).map((emit, position): number => {
      eventOutputs.push({
        lockingBytecode: eventLockingBytecode(
          callee.category, emit.eventSignature, definitions.get(emit.eventSignature)?.anonymous === true,
        ),
        valueSatoshis: EVENT_OUTPUT_SATOSHIS,
        token: {
          category: callee.category, amount: 0n,
          nft: { capability: 'none', commitment: payloads[position] ?? sentinels[position]! },
        },
      });
      return options.eventBase + eventOutputs.length - 1;
    });
    // The frame's mapping write, authorized by its own master, its created nodes past the frames laid before it.
    const laid = callee.entryWrites?.lay({
      indexOf,
      proxyMasterIndex: indexOf(callee.master),
      createdBase: options.createdBase + createdOutputs.length,
      recordAmount: callee.records[0]?.satoshis ?? options.recordAmount,
      category: callee.category,
      learnedViews: values.views.get(callee.master) ?? [],
      continuedOutputOf: (collection, slot) => createdElsewhere.get(createdNodeKey(callee.category, collection, slot)),
    });
    for (const node of laid?.createdNodes ?? []) {
      createdElsewhere.set(createdNodeKey(callee.category, node.collection, node.slot), node.out);
    }
    createdOf.set(callee.block, [...(createdOf.get(callee.block) ?? []), ...(laid?.createdOutputs ?? [])]);
    createdOutputs.push(...(laid?.trailingOutputs ?? []));
    Object.assign(inputs, laid?.inputs ?? {});
    const landing = mappingWriteSegment(callee) ?? 0;
    // A node two groups declare, a target that is also another target's relinked predecessor, is written once in its
    // final form: the later declaration continues from the view the first one leaves, which is learned with it.
    const candidates = callee.entryWrites?.learningCandidates ?? [];
    const learnedViews = values.views.get(callee.master) ?? [];
    const writeEntries = (laid?.entries ?? []).map((entry): RecordEntry => {
      const learned = learnedViews[candidates.findIndex((candidate) => bytesEqual(candidate, entry.viewIn))];
      return learned === undefined ? entry : { ...entry, viewIn: learned };
    });
    const relinked = new Set(laid?.relinked ?? []);
    (laid?.entries ?? []).forEach((entry, at) => {
      writeTransitions.add(writeEntries[at]!);
      if (relinked.has(entry)) relinkTransitions.add(writeEntries[at]!);
    });
    // Each node the write spends is kept on either side of the segment it lands in: at the view it was spent with
    // before, and at the view the write left after.
    const writesAt = (position: number): DraftRecordEntry[] => {
      if (position === landing) return [...writeEntries];
      const kept = new Map<number, Uint8Array>();
      for (const entry of writeEntries) {
        if (entry.in === INDEX_NONE || (position < landing && kept.has(entry.in))) continue;
        kept.set(entry.in, position < landing ? entry.viewIn : entry.viewOut);
      }
      return [...kept].map(([index, view]) => ({ in: index, out: index, viewIn: view, viewOut: view }));
    };
    const readEntries = callee.readNodes.map((node): DraftRecordEntry => {
      const index = indexOf(node.id);
      return { in: index, out: index, viewIn: node.commitment, viewOut: node.commitment };
    });
    const segments = Array.from({ length: positions }, (_unused, position) => [
      ...declared.map((record): DraftRecordEntry => {
        const index = indexOf(record.id);
        const nftIndex = callee.records.indexOf(record);
        const written = writes.get(nftIndex) ?? [];
        const first = Math.min(...written);
        // A record an earlier frame of this contract wrote starts from that frame's end; one a frame beside the
        // callees wrote before this one runs starts from the view that frame left.
        const start = chainEnds.get(record.id)
          ?? options.beside?.startViews.get(callee.master)?.get(record.id) ?? record.commitment;
        if (written.length === 0 || position < first) {
          return { in: index, out: index, viewIn: start, viewOut: start };
        }
        if (written.includes(position)) {
          writerOf.set(record.id, callee.master);
          return position === first
            ? { in: index, out: index, viewIn: start }
            : { in: index, out: index, viewIn: 'carried' };
        }
        return { in: index, out: index, viewIn: 'carried', viewOut: 'carried' };
      }),
      ...readEntries,
      ...writesAt(position),
    ]);
    // A record this frame writes ends where its last write leaves it: the placeholder the composer declares for that
    // segment's unstated end, at the record's own place among the segment's entries.
    declared.forEach((record, entryIndex) => {
      const written = writes.get(callee.records.indexOf(record)) ?? [];
      if (written.length === 0) return;
      chainEnds.set(record.id, unstatedViewPlaceholder(callee.master, Math.max(...written), entryIndex));
    });
    return {
      master: callee.master,
      contract: callee.block,
      functionName: callee.functionName,
      program: callee.deployed.script,
      facts: {
        contract: callee.block, functionName: callee.functionName, kind: callee.kind,
        callerIsUser: false, originEqualsCaller: false, makesExternalCall: callee.calls.length > 0,
        mastersOfContract: mastersOf.get(callee.block) ?? 1,
      },
      frame: {
        kind: callee.kind, sender: caller?.selfAddress ?? options.rootAddress, self: callee.selfAddress,
        value: options.callValues?.get(callee.master) ?? 0n,
      },
      enteredBy: caller?.master ?? options.rootMaster,
      origin: options.origin,
      calls: callee.calls,
      ...(callee.callBases.length === 0 ? {} : { callBaseBySite: callee.callBases }),
      retval: callee.returns
        ? values.retvals.get(callee.master) ?? calleeRetvalPlaceholder(callee)
        : new Uint8Array(0),
      segments,
      events,
      sends: [],
      // The frame's call data is the pushes of the call that reaches it.
      argumentPushes: callTo.get(callee.master)?.argumentPushes ?? [],
      redeemScript: callee.deployed.script,
    };
  });
  for (const callee of callees) {
    inputs[callee.master] = {
      source: {
        lockingBytecode: callee.deployed.lockingBytecode,
        valueSatoshis: callee.masterSatoshis,
        token: { category: callee.category, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
      },
    };
    for (const record of declaredRecords(callee)) {
      if (inputs[record.id] !== undefined) continue;
      const source = {
        lockingBytecode: record.lockingBytecode,
        valueSatoshis: record.satoshis,
        token: {
          category: callee.category, amount: 0n, nft: { capability: 'mutable' as const, commitment: record.commitment },
        },
      };
      const writer = writerOf.get(record.id);
      // A written record is spent on the covenant's write path, authorized by the master that writes it, and carries
      // the end of its declaration chain; a kept one is read-only and recreated as it was.
      inputs[record.id] = {
        source,
        ...(writer === undefined ? { output: source } : {}),
        unlockingBytecode: stateRecordUnlockingBytecode(
          callee.categoryId, indexOf(writer ?? callee.master), writer === undefined ? 0 : 1,
        ),
      };
    }
    // A node the frame only reads is spent on its entry covenant's read-only path and recreated as it was.
    for (const node of callee.readNodes) {
      if (inputs[node.id] !== undefined || node.utxo === undefined) continue;
      const { lockingBytecode, unlockingBytecode } = entryRecordReadUnlock(callee.categoryId, node.signature);
      inputs[node.id] = {
        source: {
          lockingBytecode,
          valueSatoshis: node.utxo.satoshis,
          token: { category: callee.category, amount: 0n, nft: { capability: 'mutable', commitment: node.commitment } },
        },
        unlockingBytecode,
      };
    }
  }
  const settles = planned.blocks
    .filter((block) => (mastersOf.get(block.contract) ?? 0) > 1)
    .map((block): PlannedSettlement => {
      const created = [...new Set(createdOf.get(block.contract) ?? [])];
      return {
        category: callees.find((callee) => callee.block === block.contract)!.category,
        stateInputs: block.state,
        ...(created.length === 0 ? {} : { createdOutputs: created }),
      };
    });
  // A contract several frames enter, one of which writes its nodes, declares each node's views as one chain in the
  // order the validator walks the frames, which its caller states over every frame of the call.
  const chained = planned.blocks.some((block) => {
    const frames = callees.filter((callee) => callee.block === block.contract);
    return frames.length > 1 && frames.some((frame) => frame.entryWrites !== undefined);
  });
  const nodes = new Set<number>();
  if (chained) {
    for (const id of chainedNodeIds(callees)) {
      const placed = findParticipant(layout, id);
      if (placed !== undefined) nodes.add(placed.index);
    }
  }
  return {
    masters, inputs, settles, eventOutputs, createdOutputs,
    ...(chained ? { chain: { nodes, writes: writeTransitions, relinks: relinkTransitions } } : {}),
  };
}

/** How deep a callee sits below the root: `1` for a frame the root calls. */
function depthOf(callees: readonly HopCallee[], index: number): number {
  let depth = 1;
  for (let at = callees[index]!.enteredBy; at !== null; at = callees[at]!.enteredBy) depth += 1;
  return depth;
}

/** True while a callee's body still owes the plan its return, an event's payload or a written node's view. */
function owesValue(callee: HopCallee, values: CalleeValues): boolean {
  const payloads = values.events.get(callee.master) ?? [];
  const views = values.views.get(callee.master) ?? [];
  return (callee.returns && !values.retvals.has(callee.master))
    || emitsOf(callee).some((emit, position) => payloads[position] === undefined
      && !(callee.skippedEmits?.includes(emit.emitIndex) ?? false))
    || (callee.entryWrites?.learningCandidates ?? []).some((_candidate, position) => views[position] === undefined);
}

/**
 * The callee values a draft's own closes hand back with the first one learned, deepest first, or undefined when no
 * close does.
 *
 * A callee compares what its body computed against what its frame declares: the blob its `return` built against its
 * `retval`, a written node's end view against the view its segment declares, an event's payload against its output's
 * commitment. Each starts from a candidate until learned, so the failing close leaves the candidate beside the value
 * the body computed. A frame is read once every frame below it has answered its return, so what it computes is
 * computed from its callees' real results, and after every earlier frame that writes a node or a record it starts
 * from, in the order the hop settles its frames (`calleeSettleOrder`), so the view it starts from is the one the
 * writer's own close handed back.
 */
export function learnCalleeValue(options: {
  readonly planned: PlannedCallees;
  readonly draft: CompositionDraft;
  readonly vm: Parameters<typeof readComputedDeclaration>[0]['vm'];
  readonly maximumCommitmentBytes: number;
  readonly values: CalleeValues;
}): CalleeValues | undefined {
  const { callees } = options.planned;
  const { values } = options;
  const owesReturn = (index: number): boolean =>
    callees[index]!.returns && !values.retvals.has(callees[index]!.master);
  /** True when frame `inner` is entered, directly or not, by frame `outer`. */
  const below = (inner: number, outer: number): boolean => {
    for (let at = callees[inner]!.enteredBy; at !== null; at = callees[at]!.enteredBy) if (at === outer) return true;
    return false;
  };
  // A frame whose callee still owes its return computed from a candidate, so it is not read yet; nor is one that
  // starts from the view an earlier frame's write of a node leaves while that frame still owes it. The rest are read
  // in the order the hop settles its frames.
  const writersBefore = sharedNodeWritersBefore(callees);
  const ready = calleeSettleOrder(callees, callees.map((_callee, index) => index)
    .filter((index) => owesValue(callees[index]!, values)
      && !callees.some((_other, other) => owesReturn(other) && below(other, index)))
    .sort((left, right) => depthOf(callees, right) - depthOf(callees, left)))
    .filter((index) => !(writersBefore.get(index) ?? []).some((writer) => owesValue(callees[writer]!, values)));
  if (ready.length === 0) return undefined;
  options.draft.learnUnstatedViews();
  for (const index of ready) {
    const callee = callees[index]!;
    const { master } = callee;
    const reading = readComputedDeclaration({
      vm: options.vm, program: options.draft.programFor(master),
      maximumCommitmentBytes: options.maximumCommitmentBytes,
    });
    if (!reading.ok) continue;
    // Whichever operand holds the candidate, the other is what the body built.
    const placeholder = calleeRetvalPlaceholder(callee);
    if (owesReturn(index) && bytesEqual(reading.computed, placeholder)) {
      return { ...values, retvals: new Map([...values.retvals, [master, Uint8Array.from(reading.declared)]]) };
    }
    if (owesReturn(index) && bytesEqual(reading.declared, placeholder)) {
      return { ...values, retvals: new Map([...values.retvals, [master, Uint8Array.from(reading.computed)]]) };
    }
    // Two nodes whose values the body computes can start from one candidate, so the close is about the first match
    // whose view is not learned yet, as the hop reads its callees' writes.
    const candidates = callee.entryWrites?.learningCandidates ?? [];
    const views = [...(values.views.get(master) ?? [])];
    const viewAt = (operand: Uint8Array): number => {
      const matches = candidates.flatMap((candidate, at) => (bytesEqual(operand, candidate) ? [at] : []));
      return matches.find((at) => views[at] === undefined) ?? matches[0] ?? -1;
    };
    const declaredView = viewAt(reading.declared);
    const view = declaredView >= 0 ? declaredView : viewAt(reading.computed);
    if (view >= 0) {
      while (views.length <= view) views.push(undefined);
      views[view] = Uint8Array.from(declaredView >= 0 ? reading.computed : reading.declared);
      return { ...values, views: new Map([...values.views, [master, views]]) };
    }
    // An event's payload is compared against the commitment its output carries: the sentinel, or a payload learned.
    // A skipped emit closes that commitment against the empty payload above it.
    const known = values.events.get(master) ?? [];
    const payloads = calleeEventSentinels(callee, options.maximumCommitmentBytes)
      .map((sentinel, at) => known[at] ?? sentinel);
    const event = eventCloseOf(reading, payloads);
    if (event !== undefined) {
      const events = payloads.map((_payload, at) => known[at]);
      events[event.position] = event.payload;
      return { ...values, events: new Map([...values.events, [master, events]]) };
    }
  }
  return undefined;
}

/**
 * True while a callee's body still owes a value, so a frame that reads its result or its writes cannot be trusted. A
 * frame a stopped plan states only the first calls of stops at the site the plan stops before, so it owes nothing.
 */
export function calleeValuesOwed(planned: PlannedCallees, values: CalleeValues): boolean {
  return planned.callees.some((callee) => callee.truncated !== true && owesValue(callee, values));
}
