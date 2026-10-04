/**
 * A call into a deployed per-call contract.
 *
 * A call is a composition whose root frame is `ROOT`: a user's own signed coin enters the contract's entry, the
 * entry runs over the contract's live records, and the whole thing is broadcast. It is the read path's machinery
 * with a real caller — the same deployment classification, the same `deployMaster`, the same composer and
 * derivation — plus signing and broadcast.
 *
 * The entry's own computation is what the write carries: the plan leaves every record's end commitment unstated, so
 * the composer declares a placeholder and the derivation learns the commitment the body's own close hands back.
 * The record's output follows that learned value, and the machine is asked about every participant.
 *
 * A contract that keeps a mapping is carried the same way. Its state is a chain of entry NFTs rather than a data
 * NFT, so the frame declares the node a held key sits at, or the head a new key is spliced beside, and the node the
 * write creates as a trailing output. The created node's commitment carries the value the body computed, which no
 * caller can state, so the plan starts it from a structural candidate and the derivation's close hands the value
 * back.
 *
 * An entry that returns a value is carried the same way: the frame's `retval` starts from a candidate the body's
 * own return comparison fails against, the derivation reads the blob the body computed back out of that close, and
 * the plan is rebuilt with it. The bytes are the entry's own answer, decoded with the shipped decoder into the call
 * result.
 *
 * A call to a payable entry may carry value: the frame's `msg.value`, paid by the caller into a satoshi container
 * of the contract, whose growth the master requires to cover it (spec 4b). A value send is a call to `receive()`
 * (`sendPerCallValue`), or to a payable `fallback()` when the contract has no `receive()`, as the EVM picks the
 * body; a contract with neither is refused by name. An entry that sends pays from the contract's
 * containers: each send's lock and amount are learned from the body's own pin, the containers cover what the call
 * does not bring, and one of them, keeping the change, precedes the sends, which binds them to the frame. A send
 * the containers cannot cover is refused by name, as the EVM reverts it. A send on a branch is planned as made,
 * and dropped when the body shows it was not: a listed send it never pinned, or a value call it never made. A
 * send to a contract is a call into its `receive()` (or its payable `fallback()`), made where the entry sends, so it
 * takes its place among the entry's calls by the count its artifact publishes: the call resolves the recipient from
 * the send's published recipe, finds it among `externals`, and plans the frame of that body, whose containers take
 * the value; a recipient with neither is refused by name. A contract the entry both pays and calls is one block: a
 * callee frame that runs after the payment starts from the records the paid body left. The paid body may emit,
 * write its mapping and send to users' locks, paying from what it receives and then from its own containers, all
 * learned from its own program as the entry's are; one that calls, or sends to a contract or on a branch, is
 * refused by name.
 *
 * An entry that hashes through keccak256 or recovers a signer co-spends a side-car per call right after its master.
 * The call spends live side-car UTXOs (`entrySideCars`), and a preimage or a digest the body computes is learned
 * from the body's own bind.
 *
 * An entry that calls another contract runs each callee as a frame of the callee contract's own block, planned as
 * the proxy hop plans its delegate frame's calls (`callees.ts`): the callee's return, its events' payloads and the
 * views of the mapping nodes it writes are learned from its own close, deepest first, before the entry that reads
 * it. Its event outputs follow the entry's own, and the nodes it creates follow the entry's. The shapes `callees.ts`
 * does not settle yet are refused by name.
 *
 * What is not covered: a returning entry reached through a proxy hop whose forwarded call records no result. The
 * generated closure shape forwards with a bare `delegatecall(input)` and drops the result, so the hop cannot express
 * the value in that call record (a proxy whose fallback carries the delegated result does carry it; that hop is
 * `callPerCallProxyEntry`).
 */

import {
  bigIntToVmNumber, binToHex, createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, hexToBin,
  vmNumberToBigInt,
} from '@bitauth/libauth';
import {
  FrameKind,
  INDEX_NONE,
  bytesEqual,
  computeFunctionSelector,
  computeFunctionSignature,
  parsePushdataCommitment,
  sha256,
  validatorAddress,
  validatorRedeemScript,
  type Artifact,
  type ExternalResultEncoding,
  type FixedBchTransferAbi,
  type RecordEntry,
  type StateValue,
  type StructDefinitionInfo,
} from '@solidcash/utils';
import {
  encodeFunctionArgument, type FunctionArgument,
} from '../../Argument.js';
import type { TransactionDetails, Unlocker, Utxo } from '../../interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../../network/createVirtualMachine.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { providerUnixLocktime } from '../../stateful/soft-state-overlays.js';
import { libauthOutputToSolidCashOutput, libauthTokenDetailsToSolidCashTokenDetails } from '../../utils.js';
import {
  deployMaster,
  eventCloseOf,
  eventLockingBytecode,
  eventSentinel,
  readComputedDeclaration,
  readPerCallDeployment,
  readSatoshiContainers,
  satoshiContainerLockingBytecode,
  satoshiContainerUnlockingBytecode,
  stateRecordLockingBytecode,
  stateRecordUnlockingBytecode,
  type PerCallDeploymentSet,
} from '../deploy/index.js';
import { placeOwnWrites } from '../proxy/deploy.js';
import { hopEntryWrites, type HopEntryWrites, type LaidHopEntryWrites } from '../proxy/entry-writes.js';
import { PerCallProxyDeployError } from '../proxy/errors.js';
import { skippedEmits, type WriteActivationFacts } from '../proxy/write-activation.js';
import { deploymentActivationFacts } from './activation-facts.js';
import {
  PerCallCallRecordError, adjacentRecordOrder, callEntryReads, frameDataRecordIndices, loopRecordSpans,
  namedDataRecordIndices, orderLoopKeyArgs, placeRecordsBySpan, requireDistinctNodes, type CallLoopWritePlan,
  type LoopRecordMint, type LoopRecordSpan,
} from './entry-records.js';
import { entrySideCars } from './side-cars.js';
import { sendRecipient, type RecipientContext } from './send-recipient.js';
import {
  PerCallLoopTurnsError, entryLoopTurns, publishedLoopEffects, type EntryLoopTurns,
} from './loop-turns.js';
import {
  NO_CALLEE_VALUES, PerCallCalleeError, calleeFrames, calleeValuesOwed, calleeWrites, learnCalleeValue,
  planEntryCallees, type CalleeValues, type PlannedCallees,
} from './callees.js';
import { deploymentStateValues } from '../proxy/external-calls.js';
import { decodeReturnValues } from '../read/index.js';
import {
  PerCallComposerError,
  createComposedDerivationHost,
  deploymentBlockId,
  deriveComposition,
  describeRefusedFrame,
  layoutTransaction,
  participant,
  readPublishedStopSites,
  reportCompositionRefusal,
  unstatedViewPlaceholder,
  validatorFacetsOf,
  type CompositionDraft,
  type CompositionDraftPlan,
  type CompositionRefusal,
  type ContractBlock,
  type DraftCall,
  type DraftInput,
  type DraftMaster,
  type DraftRecordEntry,
  type DraftSourceOutput,
  type FrameRequest,
  type PublishedEntryStopSites,
  type ShippedVmProgram,
} from '../composer/index.js';

/** The BCH-2026 machine a call is derived and evaluated on. */
type CallMachine = ReturnType<typeof createVirtualMachineBch2026>;

/** Raised when a call cannot be planned or driven from what the caller supplied. */
export class PerCallCallError extends Error {
  public readonly name = 'PerCallCallError';

  public constructor(message: string) {
    super(message);
  }
}

/** What the caller asks a call for. */
export interface PerCallCallOptions {
  readonly provider: NetworkProvider;
  /** The deployed contract's per-call artifact. */
  readonly artifact: Artifact;
  /** The deployed contract's token category, as hex. */
  readonly categoryId: string;
  /** The entry's ABI name. */
  readonly functionName: string;
  /** The entry's arguments, in parameter order. */
  readonly args?: readonly FunctionArgument[];
  /** The caller's own coin: a UTXO at `callerLockingBytecode`, and the unlocker that signs it. */
  readonly callerUtxo: Utxo;
  readonly callerLockingBytecode: Uint8Array;
  readonly funder: Unlocker;
  readonly changeAddress?: string | Uint8Array;
  readonly fee?: bigint;
  readonly vm?: CallMachine;
  readonly validatorProgram?: Uint8Array;
  /** The value the call carries, in satoshis: the frame's `msg.value`. Only a payable entry takes one. */
  readonly value?: bigint;
  /** The contracts the entry's value sends may pay, each found by the address its category derives. */
  readonly externals?: Readonly<Record<string, PerCallExternal>>;
}

/** A deployed contract a call may pay: its per-call artifact and its category, as hex. */
export interface PerCallExternal {
  readonly artifact: Artifact;
  readonly categoryId: string;
}

/** One participant's verdict, as the machine returned it. */
export interface PerCallCallVerdict {
  readonly id: string;
  readonly index: number;
  readonly accepted: boolean;
  readonly objection?: string;
}

/** What a call produced, and whether the machine accepted it. */
export interface PerCallCallResult {
  /** The derived transaction the machine was asked about. */
  readonly transaction: NonNullable<ShippedVmProgram['transaction']>;
  /** The output each input spends, in input order. */
  readonly sourceOutputs: ShippedVmProgram['sourceOutputs'];
  readonly draft: CompositionDraft;
  /** The frames the derivation completed, callee before caller. */
  readonly completed: readonly FrameRequest[];
  /** Every participant's verdict, in input order. */
  readonly verdicts: readonly PerCallCallVerdict[];
  /** True only when every participant was accepted. */
  readonly accepted: boolean;
  /**
   * The refusing frames' own reasons, present only when a frame was refused. The per-verdict objection of a
   * refused master carries the same attribution; this is what a caller that wants the structured report reads.
   */
  readonly refusal?: CompositionRefusal;
  /** The commitment of every record after the entry ran, in data-NFT order. */
  readonly writtenCommitments: readonly Uint8Array[];
  /** The bytes the derived call records in the root frame's `retval` slot. Empty when the entry returns nothing. */
  readonly retval: Uint8Array;
  /** The entry's returned values, decoded with the shipped decoder, in declaration order. */
  readonly values: readonly StateValue[];
  /** The first returned value, for the common single-value call. */
  readonly value: StateValue;
  /** The provider's receipt for the call, present only when every participant was accepted. */
  readonly broadcast?: TransactionDetails;
}

/** The identities the plan names; the layout is the only source of their coordinates. */
const MASTER_ID = 'master';
const VALIDATOR_ID = 'validator';
const CALLER_ID = 'caller';

/** The satoshi value an event output carries, matching the genesis's own event outputs. */
const EVENT_OUTPUT_SATOSHIS = 1_000n;

/** The least a container before a frame's sends keeps; the caller tops it up past the change. */
const CONTAINER_MINIMUM_SATOSHIS = 1_000n;

/** The amount a send output carries until the body's own pin hands back the one it computed. */
const SEND_AMOUNT_SENTINEL = 1_234_567_891n;

/** The identity of the `index`-th container a call spends. */
function containerInputId(index: number): string {
  return `container-${index}`;
}

/** The value a call into `receive()` records until the body's own site hands back the amount it computed. */
const CALL_VALUE_SENTINEL = 1_234_567_901n;

/** The master and the records of the `index`-th contract a call pays through its `receive()`. */
function receiveMasterId(index: number): string {
  return `receive-${index}`;
}
function receiveRecordId(index: number, nftIndex: number): string {
  return `receive-${index}-record-${nftIndex}`;
}
/** A mapping node a paid contract's body writes, placed under its own id so two contracts' nodes never share one. */
function receiveNodeId(index: number, id: string): string {
  return `receive-${index}-${id}`;
}
/** The `position`-th container a paid contract spends to cover its sends. */
function receiveContainerId(index: number, position: number): string {
  return `receive-${index}-container-${position}`;
}

/** What a paid contract's body computes that the plan learns: its events, its nodes' end views and its sends. */
interface PayeeLearned {
  readonly events: readonly (Uint8Array | undefined)[];
  readonly views: readonly (Uint8Array | undefined)[];
  readonly sends: readonly { readonly lock?: Uint8Array; readonly amount?: bigint }[];
}

/** A call record's eight-byte value, as the site compares the amount the body computed against it. */
function recordValueBytes(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  let rest = value;
  for (let index = 0; index < 8; index += 1) {
    bytes[index] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return bytes;
}

/** The record identity for data-NFT index `nftIndex`. */
function recordId(nftIndex: number): string {
  return `record-${nftIndex}`;
}

/**
 * The frame's `retval` candidate before the entry's own computation is known.
 *
 * The entry's body compares the blob its own `return` built against the frame's `retval`, so the slot has to hold a
 * value for the run to reach that comparison. Domain-separating it by the contract and the entry keeps it a value
 * the body never produces, and distinct from every segment view placeholder the composer writes, which is what
 * lets the failing close name the operand that is the answer.
 */
function retvalPlaceholder(contract: string, functionName: string): Uint8Array {
  return sha256(new TextEncoder().encode(`per-call call retval\u0000${contract}\u0000${functionName}`));
}

/** The ABI row a call names, with the fields a frame is built from. */
interface CallEntry {
  readonly name: string;
  readonly selector: string;
  readonly inputs: readonly { readonly name: string; readonly type: string }[];
  readonly outputs: readonly { readonly type: string }[];
  /** How the entry encodes its returns: Solidity ABI words for a Solidity-compatible entry. */
  readonly resultEncoding?: ExternalResultEncoding;
  /** The events the entry emits, which its frame declares one output per, in emit order. */
  readonly emits: readonly { readonly eventSignature: string; readonly emitIndex: number }[];
  /** True when the entry is payable, so a call to it may carry value. */
  readonly payable: boolean;
  /** How many sends the entry makes. */
  readonly sends: number;
  /** The entry's sends, in the order its code makes them. */
  readonly transfers: readonly FixedBchTransferAbi[];
}

/** The ABI name of `receive()`, the entry a value send runs. */
export const RECEIVE_ENTRY = '__receive';
/** The ABI name of `fallback()`, which a value send runs when the contract has no `receive()`. */
export const FALLBACK_ENTRY = '__fallback';
/** A value send's call data: the selector of `receive()` alone, the EVM's empty call data. */
const VALUE_SEND_CALL_DATA = computeFunctionSelector(computeFunctionSignature(RECEIVE_ENTRY, []));

/**
 * The body a value send runs, as the EVM picks it: `receive()`, else a payable `fallback()`. `what` names the value
 * in the refusal of a contract with neither.
 */
function valueEntryOf(artifact: Artifact, what: string): Artifact['abi'][number] {
  const receive = artifact.abi.find((candidate) => candidate.name === RECEIVE_ENTRY);
  if (receive !== undefined) return receive;
  const fallback = artifact.abi.find((candidate) => candidate.name === FALLBACK_ENTRY);
  if (fallback === undefined) {
    throw new PerCallCallError(`contract "${artifact.contractName}" has no receive(), so ${what} has no body to run`);
  }
  if (!(fallback.modifiers ?? []).includes('payable')) {
    throw new PerCallCallError(
      `contract "${artifact.contractName}" has no receive() and its fallback() is not payable, so it refuses ${what}`,
    );
  }
  return fallback;
}

/** The ABI row a call names, refusing an entry the artifact does not publish. */
function requireEntry(artifact: Artifact, functionName: string): CallEntry {
  const entry = artifact.abi.find((candidate) => candidate.name === functionName);
  if (entry === undefined) {
    throw new PerCallCallError(`artifact "${artifact.contractName}" publishes no entry "${functionName}"`);
  }
  if (entry.selector === undefined) {
    throw new PerCallCallError(
      `entry "${functionName}" publishes no selector, so its frame cannot be dispatched to`,
    );
  }
  return {
    name: entry.name, selector: entry.selector, inputs: entry.inputs, outputs: entry.outputs ?? [],
    ...(entry.resultEncoding === undefined ? {} : { resultEncoding: entry.resultEncoding }),
    emits: entry.emits ?? [], payable: (entry.modifiers ?? []).includes('payable'),
    sends: entry.transferCount ?? 0,
    transfers: [...(entry.transfers ?? [])].sort((left, right) => left.transferIndex - right.transferIndex),
  };
}

/** The stop-site entry one identity publishes, or `undefined` when the artifact publishes none for it. */
function publishedEntryOf(artifact: Artifact, functionName: string): PublishedEntryStopSites | undefined {
  return readPublishedStopSites(artifact).entries
    .find((candidate) => candidate.functionName === `${artifact.contractName}.${functionName}()`);
}

/** The struct definitions an artifact publishes. */
function structDefinitionsOf(artifact: Artifact): readonly StructDefinitionInfo[] | undefined {
  return artifact.stateLayout?.structs ?? artifact.structs;
}

/** The argument pushes a frame's unlocking bytecode carries, in the order the entry's body reads them. */
function entryArgumentPushes(
  entry: CallEntry,
  args: readonly FunctionArgument[],
  structs: readonly StructDefinitionInfo[] | undefined,
  functionName: string,
): Uint8Array[] {
  return [
    new Uint8Array(hexToBin(entry.selector)),
    ...args.map((value, index) => {
      const input = entry.inputs[index];
      if (input === undefined) throw new PerCallCallError(`entry "${functionName}" has no parameter ${index}`);
      return encodeFunctionArgument(value, input.type, structs) as Uint8Array;
    }).reverse(),
  ];
}

/** A root caller's unlocking: a filler signature ending in `SIGHASH_ALL`, then a filler pubkey. */
function callerUnlocking(): Uint8Array {
  const signature = new Uint8Array(65).fill(0x30);
  signature[64] = 0x41;
  return new Uint8Array([
    ...encodeDataPush(signature), ...encodeDataPush(new Uint8Array(33).fill(0x02)),
  ]);
}

/** A minting NFT of a category, as the composer models a master source. */
function masterSource(lockingBytecode: Uint8Array, category: Uint8Array, amount: bigint): DraftSourceOutput {
  return {
    lockingBytecode,
    valueSatoshis: amount,
    token: { category, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
  };
}

/** A mutable NFT of a category, as the composer models a record or validator source. */
function mutableSource(
  lockingBytecode: Uint8Array, amount: bigint, category: Uint8Array, commitment: Uint8Array,
): DraftSourceOutput {
  return {
    lockingBytecode,
    valueSatoshis: amount,
    token: { category, amount: 0n, nft: { capability: 'mutable', commitment } },
  };
}

/** An input the composer already assembled: its lock and unlocking bytecode are the call's, not re-derived. */
function rawUnlocker(lockingBytecode: Uint8Array, unlockingBytecode: Uint8Array): Unlocker {
  return {
    generateLockingBytecode: () => lockingBytecode,
    generateUnlockingBytecode: () => unlockingBytecode,
  };
}

/** The coordinates and values one frame's mapping records are laid at. */
interface EntryMappingContext {
  /** The first trailing output index of the frame's created records. */
  readonly createdBase: number;
  /** The frame's own input index, which a spent record's unlock names as its writer. */
  readonly masterIndex: number;
  /** The satoshi value a created record carries. */
  readonly recordAmount: bigint;
  /**
   * The end commitment learned for each value-dependent record, in `learningCandidates` order.
   *
   * A record whose end commitment carries a value the body computes cannot be stated in advance, so the plan starts
   * from a structural candidate and the derivation replaces it with the value the body's close hands back. An entry
   * that is still a candidate is the plan's.
   */
  readonly learnedViews: readonly (Uint8Array | undefined)[];
  /** The input index of a participant id the layout placed. */
  indexOf(id: string): number;
}

/** The records one frame's mapping reads and writes contribute to a call. */
interface LaidEntryMapping {
  /** The records to declare after the frame's own state records, in the order the body's group walk reads them. */
  readonly entries: readonly DraftRecordEntry[];
  readonly inputs: Readonly<Record<string, DraftInput>>;
  /** One output per created record, at the index its declaration names. */
  readonly trailingOutputs: readonly DraftSourceOutput[];
  /** The structural candidate each value-dependent record's declaration starts from, in learning order. */
  readonly learningCandidates: readonly Uint8Array[];
  /** For a run of loops, the turn that mints each of `entries`, or undefined for a record no turn mints. */
  readonly entryMints?: readonly (LoopRecordMint | undefined)[];
  /** The long mapping values the body reads, by value-witness slot, which the frame's block lists. */
  readonly values?: readonly Uint8Array[];
  /**
   * The records each segment of a frame that makes `calls` calls declares: the nodes read apart, kept, in every one,
   * then each write's records in the segment its artifact publishes for it, kept on either side. `callBases` holds,
   * for each published call site, the position of its first call in the frame, or -1 for none.
   */
  place(calls: number, callBases: readonly number[]): DraftRecordEntry[][];
}

/** The mapping records one frame reads and writes, with the ids its plan places. */
interface EntryMapping {
  /** The first collection the frame writes, or the first one it reads when it writes none. */
  readonly collection: string;
  /** The participant ids the frame's block holds for the records it spends, in declaration order. */
  readonly participantIds: readonly string[];
  /** The live UTXO of each spent record, keyed by the participant id the frame places it under. */
  readonly spentUtxos: ReadonlyMap<string, Utxo>;
  /** The run-time loops that write the collection, in the order the body runs them, when loops write it. */
  readonly loopRun?: readonly CallLoopWritePlan[];
  lay(context: EntryMappingContext): LaidEntryMapping;
}

/** The deployment and the facts one frame's mapping records are planned from. */
interface EntryMappingRequest {
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly args: readonly FunctionArgument[];
  /** The frame's `msg.sender`, as the lock it is. */
  readonly senderLockingBytecode: Uint8Array;
  readonly categoryId: string;
  readonly deployment: PerCallDeploymentSet;
  /** The frame's state, `address(this)` and nodes' values, which its keys and guarded writes are decided from. */
  readonly facts: WriteActivationFacts;
  /** The lock the chunks a write leaves past its value's width are paid to: the user's, whose coin enters. */
  readonly releasedLock: Uint8Array;
}

/**
 * The participant id a node a frame's write spends is placed under: its slot, and its collection too for an entry
 * that writes several, since a slot is its key's alone and two collections can hold one.
 */
function writtenNodeId(slot: Uint8Array, collection?: string): string {
  return `mapping-node-${collection === undefined ? '' : `${collection}-`}${binToHex(slot)}`;
}

/**
 * A refusal of the hop's write planner, named as this path names the frame: the planner names a delegate frame's
 * entry as the implementation's, and a frame here runs its own contract's entry.
 */
function asCallRefusal(error: unknown, functionName: string): unknown {
  if (!(error instanceof PerCallProxyDeployError)) return error;
  return new PerCallCallRecordError(error.message
    .replaceAll(`the implementation's "${functionName}" entry`, `entry "${functionName}"`)
    .replaceAll('this hop', 'this call'));
}

/**
 * Plans the mapping records one frame of a call reads and writes, or `undefined` when it touches no sorted
 * collection: the node of each key it only reads (`callEntryReads`), then its writes as the hop plans a frame's own
 * (`hopEntryWrites`).
 *
 * The hop's planner takes the frame as it takes a delegate frame, on the frame's own records, nodes, chunks and
 * category rather than a proxy's: one sorted batch per collection, keys from the arguments, the sender, the state and
 * the nodes of other mappings, guarded writes decided from the frame's facts, and a value that chunks laid with its
 * run of chunk records. A value-dependent record starts from a candidate the body's close hands the value back
 * against. The nodes read apart are declared kept ahead of the writes, and the planner takes a read at their slots as
 * declared. A chunkable value the artifact does not state is sized only from the body's own close, which this path
 * does not plan again from, so it is refused by name.
 */
function entryMapping(request: EntryMappingRequest): EntryMapping | undefined {
  const { artifact, functionName, args, categoryId, deployment, facts } = request;
  const state = facts.stateValues as Readonly<Record<string, StateValue>>;
  const valueReader = facts.readMappingValue === undefined ? {} : { readMappingValue: facts.readMappingValue };
  const reads = callEntryReads({
    artifact, functionName, args, state, callerLockingBytecode: request.senderLockingBytecode, categoryId,
    nodesByCollection: deployment.nodesByCollection, ...valueReader,
  });
  const fn = artifact.abi.find((candidate) => candidate.name === functionName);
  const batches = fn?.sortedBatchInfo ?? [];
  const writesMapping = batches.length > 0
    || (fn?.entryAccesses ?? []).some((access) => access.operations.some((operation) => operation !== 'read'));
  const category = new Uint8Array(hexToBin(categoryId));
  const several = new Set(batches.map((batch) => batch.collection)).size > 1;
  let writes: HopEntryWrites | undefined;
  try {
    writes = !writesMapping ? undefined : hopEntryWrites({
      artifact, functionName, args, callerLockingBytecode: request.senderLockingBytecode,
      liveDeployment: {
        category,
        recordCommitments: deployment.records.map((record) => hexToBin(record.token?.nft?.commitment ?? '')),
        chunks: [...deployment.chunks, ...deployment.collectionNodes],
        nodesByCollection: deployment.nodesByCollection,
        state,
      },
      declaredReadSlots: reads.nodes.map((node) => node.slotIndex),
      nodeIdOf: (collection, slot) => writtenNodeId(slot, several ? collection : undefined),
      activationFacts: facts,
      ...valueReader,
    });
  } catch (error) {
    throw asCallRefusal(error, functionName);
  }
  if (writes?.awaitsValue === true) {
    const chunking = writes.reachWrites.find((write) => write.chunkable)?.collection ?? writes.collection;
    throw new PerCallCallRecordError(
      `entry "${functionName}" writes mapping "${chunking ?? ''}", whose values chunk, a value its artifact does not `
      + 'state, so the run of chunk records the write takes cannot be sized from the call alone',
    );
  }
  const collection = writes?.collection ?? reads.nodes[0]?.collection;
  if (collection === undefined) return undefined;
  requireDistinctNodes(functionName, [...reads.nodes.map((node) => node.utxo), ...(writes?.spentUtxos.values() ?? [])]);
  return {
    collection,
    // The nodes it only reads come first, so they sit past the frame's data records where its code reads them.
    participantIds: [...reads.nodes.map((node) => node.id), ...(writes?.participantIds ?? [])],
    spentUtxos: new Map([...reads.nodes.map((node) => [node.id, node.utxo] as const), ...(writes?.spentUtxos ?? [])]),
    ...(writes?.loopRun === undefined ? {} : { loopRun: writes.loopRun }),
    lay: (context: EntryMappingContext): LaidEntryMapping => {
      const read = reads.lay(context.indexOf);
      let laid: LaidHopEntryWrites | undefined;
      try {
        laid = writes?.lay({
          indexOf: context.indexOf, proxyMasterIndex: context.masterIndex, createdBase: context.createdBase,
          recordAmount: context.recordAmount, category, learnedViews: context.learnedViews,
          releasedLock: request.releasedLock,
        });
      } catch (error) {
        throw asCallRefusal(error, functionName);
      }
      // A batch declares a node once per group that names it, and the body writes it once, in its final form: a later
      // declaration continues from the view the one before it ends at, the value the body computed once it is learned.
      const ends = new Map<number, Uint8Array>();
      const written = (laid?.entries ?? []).map((entry): RecordEntry => {
        const record = entry.in === INDEX_NONE ? entry.out : entry.in;
        const before = ends.get(record);
        ends.set(record, entry.viewOut);
        return before === undefined ? entry : { ...entry, viewIn: before };
      });
      const mints = writes?.loopMints;
      return {
        entries: [...read.entries, ...written],
        inputs: { ...read.inputs, ...laid?.inputs },
        trailingOutputs: laid?.trailingOutputs ?? [],
        learningCandidates: writes?.learningCandidates ?? [],
        // A loop's records lead its writes' declarations; a node read apart, and any record past them, no turn mints.
        ...(mints === undefined ? {} : {
          entryMints: [
            ...read.entries.map(() => undefined), ...mints, ...written.slice(mints.length).map(() => undefined),
          ],
        }),
        ...(laid?.values === undefined ? {} : { values: laid.values }),
        // Each write lands in the segment its artifact publishes, as the hop places its delegate frame's own.
        place: (calls, callBases) => {
          const segments = Array.from({ length: calls + 1 }, (): DraftRecordEntry[] => [...read.entries]);
          if (laid === undefined || writes === undefined) return segments;
          try {
            placeOwnWrites(segments, {
              artifact, functionName, label: `entry "${functionName}"`, laid: { ...laid, entries: written }, writes,
              indexOf: context.indexOf, category, createdBase: context.createdBase, calls, callBases,
            });
          } catch (error) {
            throw asCallRefusal(error, functionName);
          }
          return segments;
        },
      };
    },
  };
}

/** Calls an entry on a deployed per-call contract, evaluates it, and broadcasts it when every participant agrees. */
export async function callPerCallEntry(options: PerCallCallOptions): Promise<PerCallCallResult> {
  return callInShape(options, { listedSends: undefined, skippedPayees: new Set(), payeeListedSends: new Map() });
}

/**
 * The sends one plan of a call declares: how many listed sends, or every one the entry can make when undefined, the
 * contracts it pays whose value calls it leaves out, by their position among them, and how many sends each paid
 * contract's body lists, by the position of the entry's send that pays it, where fewer than it can make.
 *
 * A send on a branch is made or not as the body decides, so the first plan declares every send and each later one
 * drops what the body showed it did not make. Each drop shrinks the plan, so the replanning ends.
 */
interface SendShape {
  readonly listedSends: number | undefined;
  readonly skippedPayees: ReadonlySet<number>;
  readonly payeeListedSends: ReadonlyMap<number, number>;
}

/** A call planned with the sends `shape` declares. */
async function callInShape(options: PerCallCallOptions, shape: SendShape): Promise<PerCallCallResult> {
  const { provider, artifact, categoryId, functionName } = options;
  const stateLayout = artifact.stateLayout;
  if (stateLayout === undefined) {
    throw new PerCallCallError(`artifact "${artifact.contractName}" is not a stateful contract`);
  }
  if (options.callerLockingBytecode.length !== 25) {
    throw new PerCallCallError(
      `a root frame's caller is a 25-byte P2PKH lock; got ${options.callerLockingBytecode.length} bytes`,
    );
  }
  const entry = requireEntry(artifact, functionName);
  const value = options.value ?? 0n;
  if (value < 0n) throw new PerCallCallError(`a call carries no negative value; got ${value}`);
  if (value > 0n && !entry.payable) {
    throw new PerCallCallError(`entry "${functionName}" is not payable, so a call to it carries no value`);
  }
  if (entry.name === FALLBACK_ENTRY && (options.args ?? []).length > 0) {
    throw new PerCallCallError(
      `a call to the fallback() of "${artifact.contractName}" carries a value send's empty call data, so it takes no `
      + 'argument',
    );
  }
  // A run-time loop's key array is handed to the frame in the order the emitted body walks it, so a chain the plan
  // declares in slot order is the chain the body builds: an array that descends would otherwise plan per-turn nodes
  // the body cannot reach. The array is only reordered for a loop that stores one invariant value under every key.
  const args = orderLoopKeyArgs({
    artifact, functionName, args: options.args ?? [], callerLockingBytecode: options.callerLockingBytecode,
  });
  // An entry that returns a value settles it against the frame's `retval`, exactly as a read does: the plan starts
  // the slot from a candidate the body's own return comparison fails against, and the derivation reads back the
  // blob the body computed. A void entry requires the slot empty, so nothing is learned for it.
  const returnsValue = entry.outputs.length > 0;
  const retvalPlaceholderBytes = returnsValue ? retvalPlaceholder(artifact.contractName, entry.name) : undefined;
  // A master dispatches over its bodies; a user's frame leads its call data with the selector only when there is
  // more than one body to choose between (a single body plus, when the contract has one, its constructor), or when
  // the contract has a fallback: a forwarding fallback's parameter is the band itself, and any other is reached
  // through the dispatcher. A master with one body is entered without a selector, which a user's frame cannot carry
  // here yet: the composer refuses a user-entered frame that carries call data unless the program dispatches.
  const dispatchedBodies = artifact.abi
    .filter((candidate) => !candidate.name.startsWith('__') || candidate.name === RECEIVE_ENTRY).length
    + (artifact.abi.some((candidate) => candidate.name === '__construct') ? 1 : 0);
  const hasFallback = artifact.abi.some((candidate) => candidate.name === FALLBACK_ENTRY);
  if (dispatchedBodies <= 1 && !hasFallback) {
    throw new PerCallCallError(
      `contract "${artifact.contractName}" has ${dispatchedBodies} dispatched body(ies), so a user's frame to it `
      + 'carries no selector, which this call path does not plan yet',
    );
  }
  const published = publishedEntryOf(artifact, functionName);

  const { perCallValidator } = await import('solidc');
  const validatorProgram = options.validatorProgram ?? perCallValidator.buildValidatorProgram();
  const machine = options.vm ?? createVirtualMachineBch2026ForProvider(provider);
  const category = new Uint8Array(hexToBin(categoryId));
  const deployed = deployMaster(artifact, category, validatorProgram);
  const structs = structDefinitionsOf(artifact);

  // The deployment's live pools and records, classified by category and ordered by data-NFT index.
  const deployment = await readPerCallDeployment(provider, categoryId, stateLayout);
  const master = deployment.masters[0];
  if (master === undefined) {
    throw new PerCallCallError(`category ${categoryId} holds no master, which a root frame runs on`);
  }
  const validator = deployment.validators[0];
  if (validator === undefined) {
    throw new PerCallCallError(`category ${categoryId} holds no validator, which a root frame needs to be admitted`);
  }
  if (deployment.records.length < stateLayout.dataNftCount) {
    throw new PerCallCallError(
      `category ${categoryId} holds ${deployment.records.length} data-NFT record(s), and the layout names `
      + `${stateLayout.dataNftCount}`,
    );
  }
  const records = Array.from({ length: stateLayout.dataNftCount }, (_unused, nftIndex) => {
    const utxo = deployment.records[nftIndex]!;
    const commitment = utxo.token?.nft?.commitment;
    if (commitment === undefined) {
      throw new PerCallCallError(`the record at data-NFT index ${nftIndex} carries no commitment`);
    }
    return { id: recordId(nftIndex), commitment: new Uint8Array(hexToBin(commitment)), utxo };
  });
  // The records the frame declares, and the transaction spends, in the order the entry's own code reads them.
  const declared = frameDataRecordIndices(artifact, entry.name).map((nftIndex) => records[nftIndex]!);
  const recordIds = declared.map((record) => record.id);

  // The mapping records the entry reads and writes, planned against the deployment's own classified inventory as the
  // proxy hop plans its frames' own (`entryMapping`): the frame declares the node a held key sits at, or the node a
  // new key is spliced beside, one sorted batch per collection, with a value's run of chunk records. A key the body
  // reads out of its own records, or out of another mapping, resolves against the records and nodes it spends.
  const activationFacts = deploymentActivationFacts(artifact, categoryId, deployment, deployed.address);
  const mappingRecords = entryMapping({
    artifact, functionName, args, senderLockingBytecode: options.callerLockingBytecode, categoryId, deployment,
    facts: activationFacts, releasedLock: options.callerLockingBytecode,
  });
  const mappingIds = mappingRecords?.participantIds ?? [];

  // The calls the entry makes and the callee frames they reach, each on a master of its own contract's pool.
  let calleePlan: PlannedCallees | undefined;
  try {
    calleePlan = await planEntryCallees({
      provider, artifact, functionName, args, externals: options.externals ?? {}, validatorProgram, categoryId,
      deployment, selfAddress: deployed.address, senderAddress: options.callerLockingBytecode,
    });
  } catch (error) {
    if (error instanceof PerCallCalleeError) throw new PerCallCallError(error.message);
    throw error;
  }

  // The fallback is reached by the call data of a value send, which no entry's selector names.
  const argumentPushes = entry.name === FALLBACK_ENTRY
    ? [VALUE_SEND_CALL_DATA]
    : entryArgumentPushes(entry, args, structs, functionName);
  // The events, sends and hashes a loop of the entry repeats, as many as the loop turns over the call's own facts.
  let loopTurns: EntryLoopTurns;
  try {
    loopTurns = entryLoopTurns({
      artifact, functionName, args, stateValues: deploymentStateValues(stateLayout, categoryId, deployment),
      selfAddress: deployed.address, senderAddress: options.callerLockingBytecode,
    });
  } catch (error) {
    if (error instanceof PerCallLoopTurnsError) throw new PerCallCallError(error.message);
    throw error;
  }
  // The compute side-cars the entry's keccak256 and recovery calls read, one per call after the master.
  const sideCars = await entrySideCars({
    provider,
    master: MASTER_ID,
    abiFunction: artifact.abi.find((candidate) => candidate.name === functionName)!,
    argumentPushes,
    leadingPushes: 1,
    ...(loopTurns.hashes === undefined ? {} : { hashes: loopTurns.hashes }),
  });

  // Each send pays a user's lock as a listed send, or a contract through a call into its `receive()`: the body
  // chooses by the lock, so each recipient is resolved from its recipe before the frame runs.
  const recipientContext: RecipientContext = {
    args,
    inputs: entry.inputs,
    structs,
    callerLock: options.callerLockingBytecode,
    state: records.map((record, nftIndex) => parsePushdataCommitment(binToHex(record.commitment), stateLayout, nftIndex)),
  };
  // A body that sends from a loop lists one send per send its turns make, each recipient a lock its own turn
  // computes: the frame learns them as it learns any lock it does not state, and none of them is on a branch.
  const recipients = loopTurns.sends === undefined
    ? entry.transfers.map((transfer) => sendRecipient(transfer.recipientRecipe, recipientContext))
    : Array.from({ length: loopTurns.sends }, (): Uint8Array | undefined => undefined);
  const listed = (lock: Uint8Array | undefined): boolean => lock === undefined || lock.length === 25;
  const onBranch = loopTurns.sends === undefined
    ? entry.transfers.map((transfer) => transfer.condition !== undefined)
    : recipients.map(() => false);
  const payable = await Promise.all(recipients.flatMap((lock, transferPosition) => {
    if (lock === undefined || lock.length === 25) return [];
    return [(async () => {
      const found = Object.entries(options.externals ?? {}).find(([, external]) => bytesEqual(
        validatorAddress(hexToBin(external.categoryId), validatorProgram), lock,
      ));
      if (found === undefined) {
        throw new PerCallCallError(
          `entry "${functionName}" sends to the contract at ${binToHex(lock)}, which the call's externals do not name`,
        );
      }
      const [, external] = found;
      const body = valueEntryOf(external.artifact, `the value entry "${functionName}" sends it`);
      const layout = external.artifact.stateLayout;
      const bodySites = publishedEntryOf(external.artifact, body.name);
      const bodyLabel = `contract "${external.artifact.contractName}"'s `
        + `${body.name === RECEIVE_ENTRY ? 'receive' : 'fallback'}()`;
      if (layout === undefined || (bodySites?.calls.length ?? 0) > 0) {
        throw new PerCallCallError(`${bodyLabel} makes a call, which this call path does not plan yet`);
      }
      if (publishedLoopEffects(external.artifact, body.name) !== undefined) {
        throw new PerCallCallError(`${bodyLabel} emits, sends or hashes once per turn of a loop, which this call `
          + 'path does not plan for a paid contract yet');
      }
      const recipientCategory = hexToBin(external.categoryId);
      const set = await readPerCallDeployment(provider, external.categoryId, layout);
      // The frames the entry's calls run on the same contract: its masters are theirs to run, so the payment takes
      // one they leave, and its records are theirs.
      const shared = calleePlan?.callees.filter((callee) => callee.categoryId === external.categoryId) ?? [];
      const outpoint = (utxo: Utxo): string => `${utxo.txid}:${utxo.vout}`;
      const taken = new Set(shared.flatMap((callee) => [...callee.utxos.values()].map(outpoint)));
      const recipientMaster = set.masters.find((utxo) => !taken.has(outpoint(utxo)));
      if (recipientMaster === undefined || set.records.length < layout.dataNftCount) {
        throw new PerCallCallError(
          `contract "${external.artifact.contractName}" at category ${external.categoryId} holds no master or not every `
          + 'record its layout names',
        );
      }
      // Its sends, each to the user's lock its recipe names, read against its own records with the paying contract as
      // its `msg.sender`.
      const bodyTransfers = [...(body.transfers ?? [])].sort((left, right) => left.transferIndex - right.transferIndex);
      const bodyRecipients = bodyTransfers.map((transfer) => sendRecipient(transfer.recipientRecipe, {
        args: [],
        inputs: body.inputs,
        structs: structDefinitionsOf(external.artifact),
        callerLock: deployed.address,
        state: set.records.slice(0, layout.dataNftCount).map((utxo, nftIndex) =>
          parsePushdataCommitment(utxo.token?.nft?.commitment ?? '', layout, nftIndex)),
      }));
      if (bodyRecipients.some((recipient) => recipient !== undefined && recipient.length !== 25)) {
        throw new PerCallCallError(`${bodyLabel} sends to a contract, which this call path does not plan yet`);
      }
      return {
        lock,
        artifact: external.artifact,
        categoryId: external.categoryId,
        category: recipientCategory,
        deployed: deployMaster(external.artifact, recipientCategory, validatorProgram),
        master: recipientMaster,
        // The records its body's frame declares, in the order its code reads them.
        records: frameDataRecordIndices(external.artifact, body.name).map((nftIndex) => {
          const utxo = set.records[nftIndex]!;
          return { nftIndex, utxo, commitment: new Uint8Array(hexToBin(utxo.token?.nft?.commitment ?? '')) };
        }),
        shared,
        entryName: body.name,
        onBranch: onBranch[transferPosition]!,
        selector: VALUE_SEND_CALL_DATA,
        emits: [...(body.emits ?? [])].sort((left, right) => left.emitIndex - right.emitIndex),
        // Its mapping writes, keyed by the paying contract, which is its `msg.sender`.
        mapping: entryMapping({
          artifact: external.artifact, functionName: body.name, args: [], senderLockingBytecode: deployed.address,
          categoryId: external.categoryId, deployment: set,
          facts: deploymentActivationFacts(external.artifact, external.categoryId, set, lock),
          releasedLock: options.callerLockingBytecode,
        }),
        segmentCount: bodySites?.sites.sites.filter((site) => site.kind === 'segmentClose').length ?? 1,
        transferPosition,
        // Every send its body can make, until a run shows one on a branch it did not take.
        sendCount: shape.payeeListedSends.get(transferPosition) ?? bodyRecipients.length,
        unconditionalSends: bodyTransfers.filter((transfer) => transfer.condition === undefined).length,
        containers: bodyRecipients.length > 0 ? await readSatoshiContainers(provider, external.categoryId) : [],
      };
    })()];
  }));
  const payees = payable.filter((_payee, position) => !shape.skippedPayees.has(position));
  if (new Set(payees.map((payee) => payee.categoryId)).size !== payees.length) {
    throw new PerCallCallError(
      `entry "${functionName}" pays one contract through two calls, which would need two of its masters to take value`,
    );
  }
  // A value call into a contract is a call made where the entry sends, so a mapping write beside it would need its
  // segments placed, as one beside any call does.
  if (payees.length > 0 && mappingRecords !== undefined) {
    throw new PerCallCallError(
      `entry "${functionName}" writes mapping "${mappingRecords.collection}" and makes `
      + `${(calleePlan?.calls.length ?? 0) + payees.length} external call(s), whose segments this call path does not `
      + 'place its writes in yet',
    );
  }
  // Each value call takes its place among the calls the entry makes: after the calls its artifact counts before the
  // send, and after the value calls of the earlier sends to contracts (spec 4b).
  const sendCallsBefore = published?.sendCallsBefore;
  if (calleePlan !== undefined && payees.length > 0 && sendCallsBefore === undefined) {
    throw new PerCallCallError(
      `entry "${functionName}" sends value to a contract and makes ${calleePlan.calls.length} external call(s), and `
      + 'its artifact does not place the sends among the calls, so this call path does not plan both in one call yet',
    );
  }
  const typedCalls = calleePlan?.calls ?? [];
  const payeeCallsBefore = payees.map((payee) => sendCallsBefore?.[payee.transferPosition] ?? typedCalls.length);
  /** The position in the entry's calls of the call at `position` among the calls its body makes to typed entries. */
  const typedCallPosition = (position: number): number =>
    position + payeeCallsBefore.filter((before) => before <= position).length;
  /** The position in the entry's calls of the value call paying the `index`-th contract. */
  const valueCallPosition = (index: number): number => payeeCallsBefore[index]!
    + payeeCallsBefore.filter((before, other) => before < payeeCallsBefore[index]! || (before === payeeCallsBefore[index]
      && other < index)).length;
  // A contract the entry both pays and calls is one block: the frame its `receive()` runs takes one of the contract's
  // masters beside the callees', on the same records, and a callee that runs after the payment starts from the views
  // the paid body left.
  for (const payee of payees) {
    if (payee.shared.length === 0) continue;
    const label = `entry "${functionName}" pays "${payee.artifact.contractName}", which its calls also reach,`;
    if (payee.mapping !== undefined || payee.sendCount > 0 || payee.emits.length > 0) {
      throw new PerCallCallError(`${label} and the paid body writes a mapping, sends or emits, which this call path `
        + 'does not plan beside the callee frames yet');
    }
    if (payee.shared.some(calleeWrites)) {
      throw new PerCallCallError(`${label} and a callee frame of it writes its records, whose views beside the paid `
        + 'body this call path does not chain yet');
    }
  }
  const payeeRecordIds = payees.map((payee, index) => payee.records.map((record, position) =>
    (payee.shared.length > 0 ? payee.shared[0]!.records[record.nftIndex]!.id : receiveRecordId(index, position))));
  /** Each callee frame's position in the entry's calls: the position of the call its root-level caller answers. */
  const rootCallOf = (calleeMaster: string): number => {
    const callees = calleePlan?.callees ?? [];
    let frame = callees.find((callee) => callee.master === calleeMaster);
    while (frame !== undefined && frame.enteredBy !== null) frame = callees[frame.enteredBy];
    const position = typedCalls.findIndex((call) => call.callee === frame?.master);
    return position < 0 ? -1 : typedCallPosition(position);
  };
  // The views a callee frame starts from when a paid body on its contract ran before it: the ends of that body's
  // declarations, which the derivation learns from the paid body's own close.
  const startViews = new Map<string, Map<string, Uint8Array>>();
  payees.forEach((payee, index) => {
    const last = payee.segmentCount - 1;
    for (const frame of payee.shared) {
      if (rootCallOf(frame.master) <= valueCallPosition(index)) continue;
      const views = startViews.get(frame.master) ?? new Map<string, Uint8Array>();
      payeeRecordIds[index]!.forEach((id, position) => {
        views.set(id, unstatedViewPlaceholder(receiveMasterId(index), last, position));
      });
      startViews.set(frame.master, views);
    }
  });
  // The block each paid body runs in, which is its deployment's: the callees' own block when they run on it too, and
  // otherwise a block of its own, named apart from every other deployment of its contract (`deploymentBlockId`).
  const blockNames = new Map((calleePlan?.callees ?? []).map((callee) => [callee.categoryId, callee.block] as const));
  const payeeBlocks = payees.map((payee) => deploymentBlockId(blockNames, payee.artifact.contractName, payee.categoryId));
  // The callee blocks with each paid body that shares one: its master beside the callees', its records once. The
  // paid body reads the records its layout names from one base, as each callee does, so they are placed side by side
  // for every frame on the block (`adjacentRecordOrder`), or the call is refused by name.
  const calleeBlocks = (calleePlan?.blocks ?? []).map((block): ContractBlock => {
    const index = payees.findIndex((payee, at) => payee.shared.length > 0 && payeeBlocks[at] === block.contract);
    if (index < 0) return block;
    const payee = payees[index]!;
    // The contract's records by data-record index, which the callees and the paid body share.
    const contractRecords = payee.shared[0]!.records;
    const frames = [...payee.shared, {
      artifact: payee.artifact, entry: payee.entryName,
      functionName: `${payee.artifact.contractName}.${payee.entryName}()`,
    }];
    const state = adjacentRecordOrder(
      [...block.state, ...payeeRecordIds[index]!.filter((id) => !block.state.includes(id))],
      frames.map((frame) => namedDataRecordIndices(frame.artifact, frame.entry)
        .map((nftIndex) => contractRecords[nftIndex]?.id).filter((id): id is string => id !== undefined)),
      new Map(contractRecords.map((record, nftIndex) => [record.id, nftIndex])),
      (split) => {
        throw new PerCallCallError(`entry "${functionName}" pays "${block.contract}", which its calls also reach, and `
          + `the frame "${frames[split]!.functionName}" reads its data records of it side by side, and no order of `
          + 'the records the other frames of that contract name keeps them so');
      },
    );
    return { ...block, masters: [...block.masters, receiveMasterId(index)], state };
  });
  const sharedPlan = calleePlan === undefined ? undefined : { ...calleePlan, blocks: calleeBlocks };
  const besideCallees = {
    masters: new Map(payeeBlocks.filter((_block, index) => payees[index]!.shared.length > 0)
      .map((block) => [block, 1] as const)),
    startViews,
  };

  // One block for the contract: its master and its side-cars, its validator, and every record it reads and writes;
  // then one block for each contract it calls, holding the masters its frames run on and the records they read, and
  // one for each other contract it pays, holding the master that runs its `receive()` and its records.
  const blocks: ContractBlock[] = [{
    contract: artifact.contractName,
    masters: [MASTER_ID],
    validator: { id: VALIDATOR_ID, settles: [] },
    state: [...recordIds, ...mappingIds],
    ...(sideCars.ids.length === 0 ? {} : { recovery: { [MASTER_ID]: sideCars.ids } }),
  }, ...calleeBlocks, ...payees.flatMap((payee, index) => (payee.shared.length > 0 ? [] : [{
    contract: payeeBlocks[index]!,
    masters: [receiveMasterId(index)],
    state: [
      ...payeeRecordIds[index]!,
      ...(payee.mapping?.participantIds ?? []).map((id) => receiveNodeId(index, id)),
    ],
  }]))];
  // The validator runs as a head plus the facet inputs its program binds, so the call's own layout has to place
  // the same facets the composer places; otherwise the indices the plan states and the assembled ones differ.
  const validatorRedeem = validatorRedeemScript(category, validatorProgram);
  const facets = validatorFacetsOf({ id: VALIDATOR_ID, covers: [], settles: [], redeemScript: validatorRedeem });
  const layout = layoutTransaction(blocks, new Map([[VALIDATOR_ID, facets]]));
  const masterIndex = participant(layout, MASTER_ID).index;
  // The trailing region is events first, then the created mapping nodes. An entry that emits declares one output
  // per emit, in emit order, at the covenant the body rebuilds; each output's commitment is the payload the body
  // computes, so the frame starts it from a sentinel the body's own comparison fails against and the derivation
  // learns what the body computed. An entry that emits nothing leaves the region to the created nodes, as before.
  // An emit the frame's facts decide its body skips lists its output with the empty commitment its not-taken arm
  // closes against, and a skip those facts do not decide is learned from that close.
  const eventDefinitions = new Map((artifact.events ?? []).map((definition) => [definition.signature, definition]));
  // A body that emits from a loop lists one output per event it emits, in the order it emits them.
  const emits = loopTurns.emits === undefined
    ? [...entry.emits].sort((left, right) => left.emitIndex - right.emitIndex)
    : loopTurns.emits.map((emitIndex) => {
      const emit = entry.emits.find((candidate) => candidate.emitIndex === emitIndex);
      if (emit === undefined) throw new PerCallCallError(`entry "${functionName}" publishes no emit ${emitIndex}`);
      return emit;
    });
  const maximumCommitmentBytes = Math.max(
    stateLayout.commitmentLimit ?? 0, provider.consensusLimits?.maximumNftCommitmentBytes ?? 0, 32,
  );
  const skippedEmitIndices = skippedEmits({
    artifact, functionName, args, senderAddress: options.callerLockingBytecode, facts: activationFacts,
  });
  const eventSentinels = emits.map((emit, position) => (skippedEmitIndices.includes(emit.emitIndex)
    ? new Uint8Array(0) : eventSentinel(category, artifact.contractName, position, maximumCommitmentBytes)));
  const eventIndices = emits.map((_emit, position) => layout.participantCount + position);
  const eventOutputs = (commitments: readonly (Uint8Array | undefined)[]): DraftSourceOutput[] =>
    emits.map((emit, position) => ({
      lockingBytecode: eventLockingBytecode(
        category, emit.eventSignature, eventDefinitions.get(emit.eventSignature)?.anonymous === true,
      ),
      valueSatoshis: EVENT_OUTPUT_SATOSHIS,
      token: {
        category, amount: 0n,
        nft: { capability: 'none', commitment: commitments[position] ?? eventSentinels[position]! },
      },
    }));
  // The sends follow the events: one of the contract's containers, then one output per send, in a run. Each send
  // starts from a sentinel lock and amount the body's own pin fails against, and the derivation learns what it
  // computed.
  const containerLock = satoshiContainerLockingBytecode(categoryId);
  const sendCount = shape.listedSends ?? recipients.filter(listed).length;
  // The listed sends no branch decides, which every run makes.
  const unconditionalSends = recipients.filter((lock, position) => listed(lock) && !onBranch[position]).length;
  // Every frame's events lead the trailing region, in master order: the entry's first, then each callee's and each
  // paid contract's, so the send run follows all of them.
  const calleeEvents = calleePlan?.eventCount ?? 0;
  const payeeEventBases = payees.map((_payee, index) => layout.participantCount + emits.length + calleeEvents
    + payees.slice(0, index).reduce((count, earlier) => count + earlier.emits.length, 0));
  const markerIndex = layout.participantCount + emits.length + calleeEvents
    + payees.reduce((count, payee) => count + payee.emits.length, 0);
  const sendIndices = Array.from({ length: sendCount }, (_unused, position) => markerIndex + 1 + position);
  const sendLockSentinels = sendIndices.map((_index, position) => encodeLockingBytecodeP2pkh(sha256(
    new TextEncoder().encode(`per-call send lock\u0000${artifact.contractName}\u0000${entry.name}\u0000${position}`),
  ).slice(0, 20)));
  const sendAmountSentinels = sendIndices.map((_index, position) => bigIntToVmNumber(SEND_AMOUNT_SENTINEL
    + BigInt(position)));
  // Each paid contract that sends lists a run of its own after the entry's: one of its containers, then its sends.
  const runLength = (sends: number): number => (sends > 0 ? 1 + sends : 0);
  const payeeMarkers = payees.map((_payee, index) => markerIndex + runLength(sendCount)
    + payees.slice(0, index).reduce((count, earlier) => count + runLength(earlier.sendCount), 0));
  const payeeSendIndices = payees.map((payee, index) =>
    Array.from({ length: payee.sendCount }, (_unused, position) => payeeMarkers[index]! + 1 + position));
  const payeeSendLockSentinels = payees.map((payee) => Array.from({ length: payee.sendCount }, (_unused, position) =>
    encodeLockingBytecodeP2pkh(sha256(new TextEncoder().encode(
      `per-call send lock\u0000${payee.artifact.contractName}\u0000${payee.entryName}\u0000${position}`,
    )).slice(0, 20))));
  const payeeSendAmountSentinels = payees.map((payee, index) => Array.from({ length: payee.sendCount },
    (_unused, position) => SEND_AMOUNT_SENTINEL + BigInt(1_000 * (index + 1) + position)));
  // An entry that reads its own balance reads the containers its transaction spends, so it spends every one.
  const readsBalance = (
    (artifact.composition as { balanceReaders?: readonly string[] } | undefined)?.balanceReaders ?? []
  ).includes(`${artifact.contractName}.${entry.name}()`);
  const containers = entry.transfers.length > 0 || readsBalance
    ? await readSatoshiContainers(provider, categoryId)
    : [];
  /**
   * The containers the sends and the value calls are paid from once every amount is known, and what the contract's
   * own container keeps: the one before the sends, or the change or the deposit on its own.
   */
  const payFromContainers = (amounts: readonly (bigint | undefined)[]): { spent: readonly Utxo[]; kept: bigint } => {
    const atLeastMinimum = (kept: bigint): bigint => (kept > CONTAINER_MINIMUM_SATOSHIS ? kept : CONTAINER_MINIMUM_SATOSHIS);
    const settle = (kept: bigint): bigint => (sendCount > 0 || kept > 0n ? atLeastMinimum(kept) : 0n);
    const every = readsBalance ? containers : [];
    const everyTotal = every.reduce<bigint>((sum, utxo) => sum + utxo.satoshis, 0n);
    if (amounts.some((amount) => amount === undefined)) return { spent: every, kept: settle(everyTotal + value) };
    const need = amounts.reduce<bigint>((sum, amount) => sum + amount!, 0n) - value;
    if (readsBalance) {
      if (everyTotal < need) {
        throw new PerCallCallError(
          `contract "${artifact.contractName}" holds ${everyTotal} satoshis in its containers, and entry `
          + `"${functionName}" sends ${need} more than the call brings`,
        );
      }
      return { spent: every, kept: settle(everyTotal - need) };
    }
    if (need <= 0n) return { spent: [], kept: settle(-need) };
    const spent: Utxo[] = [];
    let total = 0n;
    for (const utxo of [...containers].sort((left, right) => (left.satoshis > right.satoshis ? -1 : 1))) {
      if (total >= need) break;
      spent.push(utxo);
      total += utxo.satoshis;
    }
    if (total < need) {
      throw new PerCallCallError(
        `contract "${artifact.contractName}" holds ${total} satoshis in its containers, and entry "${functionName}" `
        + `sends ${need} more than the call brings`,
      );
    }
    return { spent, kept: settle(total - need) };
  };
  // Created mapping nodes are the trailing outputs past every run of sends.
  const createdBase = markerIndex + runLength(sendCount)
    + payees.reduce((count, payee) => count + runLength(payee.sendCount), 0);
  /**
   * What a paid contract that sends keeps, and the containers it spends: its sends are paid from what it receives,
   * then from its own containers, as the EVM's are from its balance.
   */
  const payeePaying = (
    index: number, received: bigint, amounts: readonly (bigint | undefined)[],
  ): { spent: readonly Utxo[]; kept: bigint } => {
    const payee = payees[index]!;
    const atLeastMinimum = (kept: bigint): bigint => (kept > CONTAINER_MINIMUM_SATOSHIS ? kept : CONTAINER_MINIMUM_SATOSHIS);
    if (amounts.some((amount) => amount === undefined)) return { spent: [], kept: CONTAINER_MINIMUM_SATOSHIS };
    const need = amounts.reduce<bigint>((sum, amount) => sum + amount!, 0n) - received;
    if (need <= 0n) return { spent: [], kept: atLeastMinimum(-need) };
    const spent: Utxo[] = [];
    let total = 0n;
    for (const utxo of [...payee.containers].sort((left, right) => (left.satoshis > right.satoshis ? -1 : 1))) {
      if (total >= need) break;
      spent.push(utxo);
      total += utxo.satoshis;
    }
    if (total < need) {
      throw new PerCallCallError(
        `contract "${payee.artifact.contractName}" holds ${total} satoshis in its containers, and the body entry `
        + `"${functionName}" pays sends ${need} more than it receives`,
      );
    }
    return { spent, kept: atLeastMinimum(total - need) };
  };
  // The value a call into a contract's `receive()` carries starts from a sentinel the body's own site fails
  // against, until the derivation learns the amount the body computed.
  const callValueSentinels = payees.map((_payee, index) => recordValueBytes(CALL_VALUE_SENTINEL + BigInt(index)));

  // A call-free entry runs in exactly one segment, and one that calls closes one more per call it makes, which a
  // loop's site makes once per turn, a value call into a contract among them. Every segment declares the frame's
  // state records and the mapping records the entry writes, with each end commitment the body computes left
  // unstated so the derivation learns it.
  const segmentCount = calleePlan !== undefined || payees.length > 0
    ? typedCalls.length + payees.length + 1
    : published?.sites.sites.filter((site) => site.kind === 'segmentClose').length ?? 1;
  // Each published site's first call, past the value calls made before it.
  const callBases = (calleePlan?.callBases ?? []).map((base) => (base < 0 ? base : typedCallPosition(base)));
  const recordIndex = (id: string): number => participant(layout, id).index;
  // Where each value-dependent node's declaration sits in the frame's segments, and the structural candidate it
  // starts from, so the value the body's close hands back can be read and written into the next attempt.
  const indexOfParticipant = (id: string): number => participant(layout, id).index;
  const probe = mappingRecords?.lay({
    createdBase,
    masterIndex,
    recordAmount: validator.satoshis,
    learnedViews: [],
    indexOf: indexOfParticipant,
  });
  const learningCandidates = probe?.learningCandidates ?? [];
  // A run of loops whose own turns make the frame's calls declares each record from the segment that mints it on,
  // as the artifact publishes the turns' segments; the records the entry only reads are declared in every segment.
  const mappingSpans = ((): readonly (LoopRecordSpan | undefined)[] | undefined => {
    const mints = probe?.entryMints;
    if (mints === undefined || mappingRecords?.loopRun === undefined || segmentCount === 1) return undefined;
    const spans = loopRecordSpans({
      artifact,
      functionName,
      run: mappingRecords.loopRun,
      mints: mints.filter((mint) => mint !== undefined),
      callBases,
      calls: segmentCount - 1,
    });
    if (typeof spans === 'string') throw new PerCallCallError(`entry "${functionName}": ${spans}`);
    let next = 0;
    return mints.map((mint) => (mint === undefined ? undefined : spans[next++]));
  })();
  // What each contract it pays computes, learned as the entry's own values are, from its own program's close.
  const payeeEventSentinels = payees.map((payee) => payee.emits.map((_emit, position) => eventSentinel(
    payee.category, payee.artifact.contractName, position, maximumCommitmentBytes,
  )));
  const payeeIndexOf = (index: number): ((id: string) => number) =>
    (id: string): number => participant(layout, receiveNodeId(index, id)).index;
  const layPayee = (
    index: number, base: number, learnedViews: readonly (Uint8Array | undefined)[],
  ): LaidEntryMapping | undefined =>
    payees[index]!.mapping?.lay({
      createdBase: base,
      masterIndex: participant(layout, receiveMasterId(index)).index,
      recordAmount: validator.satoshis,
      learnedViews,
      indexOf: payeeIndexOf(index),
    });
  const payeeProbes = payees.map((_payee, index) => layPayee(index, 0, []));
  const payeeCandidates = payeeProbes.map((payeeProbe) => payeeProbe?.learningCandidates ?? []);
  // Created records follow the sends, the entry's first and then each paid contract's.
  const payeeCreatedBases = payees.map((_payee, index) => createdBase + (probe?.trailingOutputs.length ?? 0)
    + payeeProbes.slice(0, index).reduce((count, earlier) => count + (earlier?.trailingOutputs.length ?? 0), 0));
  // One attempt per value the body computes (each mapping node, each event, each send's lock and amount and the
  // frame's `retval`, each one a paid contract computes and each callee's return, event and written node), plus the
  // attempt that derives against every value. A paid contract's value learned before the amount it was paid is
  // learned again once the amount is known, and so is a callee's when a paid contract shares its records.
  const sharesPayee = payees.some((payee) => payee.shared.length > 0);
  const maximumAttempts = learningCandidates.length + emits.length + 2 * sendCount + payees.length
    + 2 * (payeeEventSentinels.flat().length + payeeCandidates.flat().length + 2 * payeeSendIndices.flat().length)
    + (calleePlan?.learnable ?? 0) * (sharesPayee ? 1 + payees.length : 1)
    + (returnsValue ? 1 : 0) + 3;

  const buildPlan = (
    learnedViews: readonly (Uint8Array | undefined)[],
    learnedRetval: Uint8Array | undefined,
    learnedEvents: readonly (Uint8Array | undefined)[],
    learnedSends: readonly { readonly lock?: Uint8Array; readonly amount?: bigint }[],
    learnedCallAmounts: readonly (bigint | undefined)[],
    learnedPayees: readonly PayeeLearned[],
    learnedCallees: CalleeValues,
  ): CompositionDraftPlan => {
    const paying = payFromContainers([...learnedSends.map((send) => send.amount), ...learnedCallAmounts]);
    const callValue = (index: number): bigint => learnedCallAmounts[index] ?? CALL_VALUE_SENTINEL + BigInt(index);
    // Each paid contract that sends keeps what it does not send in the container its run starts with.
    const payeePayings = payees.map((payee, index) => (payee.sendCount === 0
      ? undefined
      : payeePaying(index, callValue(index), learnedPayees[index]!.sends.map((send) => send.amount))));
    const payeeRuns: DraftSourceOutput[] = payees.flatMap((payee, index) => {
      const payeePay = payeePayings[index];
      if (payeePay === undefined) return [];
      return [
        { lockingBytecode: satoshiContainerLockingBytecode(payee.categoryId), valueSatoshis: payeePay.kept },
        ...learnedPayees[index]!.sends.map((send, position) => ({
          lockingBytecode: send.lock ?? payeeSendLockSentinels[index]![position]!,
          valueSatoshis: send.amount ?? payeeSendAmountSentinels[index]![position]!,
        })),
      ];
    });
    const payeeSpent = payees.flatMap((_payee, index) => (payeePayings[index]?.spent ?? [])
      .map((utxo, position) => ({ id: receiveContainerId(index, position), index, utxo })));
    const ownContainer: DraftSourceOutput[] = paying.kept > 0n
      ? [{ lockingBytecode: containerLock, valueSatoshis: paying.kept }]
      : [];
    const sendOutputs: DraftSourceOutput[] = sendCount === 0 ? [] : [
      ...ownContainer,
      ...learnedSends.map((send, position) => ({
        lockingBytecode: send.lock ?? sendLockSentinels[position]!,
        valueSatoshis: send.amount ?? SEND_AMOUNT_SENTINEL + BigInt(position),
      })),
    ];
    const laid = mappingRecords?.lay({
      createdBase,
      masterIndex,
      recordAmount: validator.satoshis,
      learnedViews,
      indexOf: indexOfParticipant,
    });
    // A record's first segment starts from the commitment it was spent with, and each later one from the view the
    // segment before it ended at: a body that calls closes one segment per call, and the views chain across them. A
    // run of loops places its records by its turns, and a write beside the calls lands in the segment its artifact
    // publishes for it.
    const mappingSegments = laid === undefined ? undefined
      : mappingSpans !== undefined ? placeRecordsBySpan(laid.entries, mappingSpans, segmentCount)
        : segmentCount > 1 && mappingRecords?.loopRun === undefined ? laid.place(segmentCount - 1, callBases)
          : undefined;
    const segment = (_unused: unknown, position: number): DraftRecordEntry[] => [
      ...declared.map((record): DraftRecordEntry => {
        const index = recordIndex(record.id);
        return { in: index, out: index, viewIn: position === 0 ? record.commitment : 'carried' };
      }),
      ...(mappingSegments?.[position] ?? laid?.entries ?? []),
    ];
    // The callees' events follow the entry's own, and the records their writes create follow the entry's.
    const callees = sharedPlan === undefined ? undefined : calleeFrames({
      planned: sharedPlan, layout, rootMaster: MASTER_ID, rootAddress: deployed.address, origin: CALLER_ID,
      values: learnedCallees, eventBase: layout.participantCount + emits.length,
      createdBase: createdBase + (laid?.trailingOutputs.length ?? 0), recordAmount: validator.satoshis,
      maximumCommitmentBytes, beside: besideCallees,
    });
    // The calls its body makes, each value call into a contract where the body sends.
    const valueCalls = payees.map((payee, index): DraftCall => ({
      kind: FrameKind.CALL,
      callee: receiveMasterId(index),
      target: payee.lock,
      value: callValue(index),
      argumentPushes: [payee.selector],
      deferred: true,
    }));
    const rootCalls: DraftCall[] = [];
    for (let position = 0; position <= typedCalls.length; position += 1) {
      payees.forEach((_payee, index) => {
        if (payeeCallsBefore[index] === position
          || (position === typedCalls.length && payeeCallsBefore[index]! > position)) rootCalls.push(valueCalls[index]!);
      });
      if (position < typedCalls.length) rootCalls.push(typedCalls[position]!);
    }
    // Each contract it pays: its events, listed right after the entry's, and the mapping nodes it creates.
    const payeeLaid = payees.map((payee, index) => ({
      events: payee.emits.map((_emit, position) => payeeEventBases[index]! + position),
      eventOutputs: payee.emits.map((emit, position): DraftSourceOutput => ({
        lockingBytecode: eventLockingBytecode(
          payee.category, emit.eventSignature,
          (payee.artifact.events ?? []).find((event) => event.signature === emit.eventSignature)?.anonymous === true,
        ),
        valueSatoshis: EVENT_OUTPUT_SATOSHIS,
        token: {
          category: payee.category, amount: 0n,
          nft: {
            capability: 'none',
            commitment: learnedPayees[index]!.events[position] ?? payeeEventSentinels[index]![position]!,
          },
        },
      })),
      mapping: layPayee(index, payeeCreatedBases[index]!, learnedPayees[index]!.views),
    }));
    const masterDraft: DraftMaster = {
      master: MASTER_ID,
      contract: artifact.contractName,
      functionName: `${artifact.contractName}.${entry.name}()`,
      program: deployed.script,
      facts: {
        contract: artifact.contractName,
        functionName: entry.name,
        kind: FrameKind.ROOT,
        callerIsUser: true,
        originEqualsCaller: true,
        makesExternalCall: payees.length > 0 || calleePlan !== undefined,
        mastersOfContract: 1,
      },
      frame: { kind: FrameKind.ROOT, sender: options.callerLockingBytecode, self: deployed.address, value },
      enteredBy: CALLER_ID,
      origin: CALLER_ID,
      calls: rootCalls,
      // Each published site's first call, past the value calls made before it.
      ...(calleePlan === undefined ? {} : { callBaseBySite: callBases }),
      // A returning entry's slot starts from the candidate its own comparison fails against; a void entry's is empty.
      retval: learnedRetval ?? retvalPlaceholderBytes ?? new Uint8Array(0),
      segments: Array.from({ length: segmentCount }, segment),
      events: eventIndices,
      sends: sendIndices,
      argumentPushes,
      redeemScript: deployed.script,
      // The long mapping values its writes read, which its block lists.
      ...(laid?.values === undefined ? {} : { values: laid.values }),
      // A root that carries call data is one a dispatcher selects an entry of.
      dispatches: true,
    };
    // Each contract it pays runs its `receive()` or its fallback in a message-call frame carrying the value, on its
    // own records.
    const payeeDrafts: DraftMaster[] = payees.map((payee, index) => ({
      master: receiveMasterId(index),
      contract: payeeBlocks[index]!,
      functionName: `${payee.artifact.contractName}.${payee.entryName}()`,
      program: payee.deployed.script,
      facts: {
        contract: payeeBlocks[index]!,
        functionName: payee.entryName,
        kind: FrameKind.CALL,
        callerIsUser: false,
        originEqualsCaller: false,
        makesExternalCall: false,
        mastersOfContract: 1 + payee.shared.length,
      },
      frame: { kind: FrameKind.CALL, sender: deployed.address, self: payee.deployed.address, value: callValue(index) },
      enteredBy: MASTER_ID,
      origin: CALLER_ID,
      calls: [],
      retval: new Uint8Array(0),
      segments: Array.from({ length: payee.segmentCount }, (): DraftRecordEntry[] => [
        ...payee.records.map((record, position) => {
          const at = recordIndex(payeeRecordIds[index]![position]!);
          return { in: at, out: at, viewIn: record.commitment };
        }),
        ...(payeeLaid[index]!.mapping?.entries ?? []),
      ]),
      events: payeeLaid[index]!.events,
      sends: payeeSendIndices[index]!,
      argumentPushes: [payee.selector],
      redeemScript: payee.deployed.script,
      ...(payeeLaid[index]!.mapping?.values === undefined ? {} : { values: payeeLaid[index]!.mapping!.values }),
    }));

    const inputs: Record<string, DraftInput> = {
      [MASTER_ID]: { source: masterSource(deployed.lockingBytecode, category, master.satoshis) },
      [VALIDATOR_ID]: {
        source: mutableSource(deployed.address, validator.satoshis, category, new Uint8Array(0)),
      },
      [CALLER_ID]: {
        source: { lockingBytecode: options.callerLockingBytecode, valueSatoshis: options.callerUtxo.satoshis },
        unlockingBytecode: callerUnlocking(),
      },
    };
    for (const record of declared) {
      // The record's output is not stated: it carries the end of the declaration chain the derivation learns.
      inputs[record.id] = {
        source: {
          lockingBytecode: stateRecordLockingBytecode(categoryId),
          valueSatoshis: record.utxo.satoshis,
          token: { category, amount: 0n, nft: { capability: 'mutable', commitment: record.commitment } },
        },
        // A master of the record's own category rewrites it, so the covenant's write path authorizes the spend.
        unlockingBytecode: stateRecordUnlockingBytecode(categoryId, masterIndex, 1),
      };
    }
    if (laid !== undefined) Object.assign(inputs, laid.inputs);
    Object.assign(inputs, sideCars.inputs);
    Object.assign(inputs, callees?.inputs ?? {});
    payees.forEach((payee, index) => {
      inputs[receiveMasterId(index)] = {
        source: masterSource(payee.deployed.lockingBytecode, payee.category, payee.master.satoshis),
      };
      const payeeMasterIndex = recordIndex(receiveMasterId(index));
      // Its body writes the records it declares, so its master authorizes their spend, a callee's kept input aside.
      payee.records.forEach((record, position) => {
        inputs[payeeRecordIds[index]![position]!] = {
          source: {
            lockingBytecode: stateRecordLockingBytecode(payee.categoryId),
            valueSatoshis: record.utxo.satoshis,
            token: { category: payee.category, amount: 0n, nft: { capability: 'mutable', commitment: record.commitment } },
          },
          unlockingBytecode: stateRecordUnlockingBytecode(payee.categoryId, payeeMasterIndex, 1),
        };
      });
      for (const [id, input] of Object.entries(payeeLaid[index]!.mapping?.inputs ?? {})) {
        inputs[receiveNodeId(index, id)] = input;
      }
    });
    paying.spent.forEach((utxo, position) => {
      inputs[containerInputId(position)] = {
        source: { lockingBytecode: containerLock, valueSatoshis: utxo.satoshis },
        unlockingBytecode: satoshiContainerUnlockingBytecode(categoryId, masterIndex),
        consumed: true,
      };
    });
    for (const spent of payeeSpent) {
      const payee = payees[spent.index]!;
      inputs[spent.id] = {
        source: { lockingBytecode: satoshiContainerLockingBytecode(payee.categoryId), valueSatoshis: spent.utxo.satoshis },
        unlockingBytecode: satoshiContainerUnlockingBytecode(payee.categoryId, recordIndex(receiveMasterId(spent.index))),
        consumed: true,
      };
    }

    return {
      blocks,
      // The chain's own time, read from the provider: a body that reads the transaction's locktime sees it.
      locktime: providerUnixLocktime(options.provider as { getBlockTime?: () => number }),
      // A stated locktime means nothing to `OP_CHECKLOCKTIMEVERIFY` on a final input, and the builder's own
      // default is non-final, so the call states the same rather than leaving the composer's final default.
      sequenceNumber: 0xfffffffe,
      userInputs: [
        { id: CALLER_ID, index: layout.participantCount },
        ...paying.spent.map((_utxo, position) => ({
          id: containerInputId(position), index: layout.participantCount + 1 + position,
        })),
        ...payeeSpent.map((spent, position) => ({
          id: spent.id, index: layout.participantCount + 1 + paying.spent.length + position,
        })),
      ],
      masters: [masterDraft, ...(callees?.masters ?? []), ...payeeDrafts],
      inputs,
      ...(sideCars.computedWitnesses.length === 0 ? {} : { computedWitnesses: sideCars.computedWitnesses }),
      trailingOutputs: [
        ...eventOutputs(learnedEvents), ...(callees?.eventOutputs ?? []),
        ...payeeLaid.flatMap((payeeLaidOut) => payeeLaidOut.eventOutputs),
        ...sendOutputs, ...payeeRuns,
        ...(laid?.trailingOutputs ?? []), ...(callees?.createdOutputs ?? []),
        ...payeeLaid.flatMap((payeeLaidOut) => payeeLaidOut.mapping?.trailingOutputs ?? []),
        // The contract's own container, when no send precedes it: the change its calls leave, or the value it takes.
        ...(sendCount === 0 ? ownContainer : []),
        // Each contract it pays takes the value into a container of its own, the one its sends follow if it sends.
        ...payees.flatMap((payee, index) => (payee.sendCount > 0 ? [] : [{
          lockingBytecode: satoshiContainerLockingBytecode(payee.categoryId), valueSatoshis: callValue(index),
        }])),
      ],
      validator: {
        id: VALIDATOR_ID,
        covers: [...new Set([...(calleePlan?.contracts ?? []), ...payeeBlocks])],
        settles: callees?.settles ?? [],
        redeemScript: validatorRedeem,
      },
    };
  };

  // The end commitment of a created mapping node is the value its own body computes, so no plan can state it: the
  // derivation learns it from the body's close and the plan is rebuilt with it. A node commitment is slot, successor
  // and value, so it is wider than the derivation's placeholder, which is a single hash; an attempt that never
  // widens one is a write this call cannot settle.
  const root: FrameRequest = {
    contract: artifact.contractName,
    functionName: `${artifact.contractName}.${entry.name}()`,
    kind: FrameKind.ROOT,
    master: MASTER_ID,
  };
  let draft: CompositionDraft | undefined;
  let completed: readonly FrameRequest[] = [];
  let learnedViews: readonly (Uint8Array | undefined)[] = learningCandidates.map(() => undefined);
  let learnedRetval: Uint8Array | undefined;
  // A skipped emit's empty commitment is stated already; every other payload is the body's to hand back.
  let learnedEvents: readonly (Uint8Array | undefined)[] = eventSentinels.map((stated) =>
    (stated.length === 0 ? stated : undefined));
  let learnedSends: readonly { readonly lock?: Uint8Array; readonly amount?: bigint }[] = sendIndices.map(() => ({}));
  let learnedCallAmounts: readonly (bigint | undefined)[] = payees.map(() => undefined);
  let learnedPayees: readonly PayeeLearned[] = payees.map((_payee, index) => ({
    events: payeeEventSentinels[index]!.map(() => undefined),
    views: payeeCandidates[index]!.map(() => undefined),
    sends: payeeSendIndices[index]!.map(() => ({})),
  }));
  /**
   * The first value a paid contract's own failing close hands back, learned into the payees' values, if any.
   *
   * A value learned before the amount it was paid is stale once the amount is learned, so a close against a learned
   * value is learned again, as one against the plan's own candidate is.
   */
  const learnFromPayees = (candidate: CompositionDraft): readonly PayeeLearned[] | undefined => {
    for (let index = 0; index < payees.length; index += 1) {
      const reading = readComputedDeclaration({
        vm: machine, program: candidate.programFor(receiveMasterId(index)), maximumCommitmentBytes,
      });
      if (!reading.ok) continue;
      const learnedBefore = learnedPayees[index]!;
      const declares = (planned: Uint8Array, learned: Uint8Array | undefined): boolean =>
        bytesEqual(learned ?? planned, reading.declared);
      // An event's close names it by the commitment its output carries, a skipped emit's below its empty payload.
      const eventClose = eventCloseOf(reading, payeeEventSentinels[index]!.map((sentinel, position) =>
        learnedBefore.events[position] ?? sentinel));
      const event = eventClose?.position ?? -1;
      if (eventClose !== undefined && reading.declared.length === 0) {
        return learnedPayees.map((learned, at) => (at !== index ? learned : {
          ...learned, events: learned.events.map((known, position) => (position === event ? eventClose.payload : known)),
        }));
      }
      const view = payeeCandidates[index]!.findIndex((candidateView, position) =>
        declares(candidateView, learnedBefore.views[position]));
      // A send's lock is compared with the output's on top, and its amount with the output's value on top.
      const lock = payeeSendLockSentinels[index]!.findIndex((sentinel, position) =>
        declares(sentinel, learnedBefore.sends[position]?.lock));
      const amount = payeeSendAmountSentinels[index]!.findIndex((sentinel, position) => declares(
        bigIntToVmNumber(sentinel),
        learnedBefore.sends[position]?.amount === undefined ? undefined
          : bigIntToVmNumber(learnedBefore.sends[position]!.amount!),
      ));
      const computedAmount = vmNumberToBigInt(reading.computed);
      if (event < 0 && view < 0 && lock < 0 && (amount < 0 || typeof computedAmount !== 'bigint')) continue;
      return learnedPayees.map((learned, at) => (at !== index ? learned : {
        events: learned.events.map((known, position) => (position === event ? Uint8Array.from(reading.computed) : known)),
        views: learned.views.map((known, position) => (position === view ? Uint8Array.from(reading.computed) : known)),
        sends: learned.sends.map((known, position) => ({
          ...known,
          ...(position === lock ? { lock: Uint8Array.from(reading.computed) } : {}),
          ...(position === amount && typeof computedAmount === 'bigint' ? { amount: computedAmount } : {}),
        })),
      }));
    }
    return undefined;
  };
  // The frames of the contracts it pays return nothing to it, so each is derived on its own before the root.
  const payeeRequests: FrameRequest[] = payees.map((payee, index) => ({
    contract: payee.artifact.contractName,
    functionName: `${payee.artifact.contractName}.${payee.entryName}()`,
    kind: FrameKind.CALL,
    master: receiveMasterId(index),
  }));
  // What each callee's body computed, by master: the return the frames that call it read as the call's result, and
  // the payloads and node views its own frame declares.
  let calleeValues: CalleeValues = NO_CALLEE_VALUES;
  const frameArtifacts = [artifact, ...(calleePlan?.artifacts ?? []), ...payees.map((payee) => payee.artifact)];
  let settled = false;
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const plan = buildPlan(
      learnedViews, learnedRetval, learnedEvents, learnedSends, learnedCallAmounts, learnedPayees, calleeValues,
    );
    const { host, draft: candidate } = createComposedDerivationHost({ vm: machine, artifacts: frameArtifacts, plan });
    draft = candidate;
    let stalled = false;
    try {
      completed = deriveComposition([...payeeRequests, root], host).completed;
    } catch (error) {
      // A body that refuses before its segment closes never hands the derivation a record view, so the driver stops.
      // The machine is asked about the draft as it stands below, and the refusing participant's verdict carries the
      // objection.
      if (!(error instanceof PerCallComposerError) || error.code !== 'PER_CALL_DERIVATION_STALLED') throw error;
      stalled = true;
    }
    // A callee answers before the frame that reads its result: its own close hands back what it returned, each
    // payload it emitted and each node view it wrote, deepest first. While one cannot, every frame above it computed
    // from a candidate, so nothing is read from them and the machine's verdicts below name the frame that refused.
    if (calleePlan !== undefined) {
      const answered = learnCalleeValue({
        planned: calleePlan, draft: candidate, vm: machine, maximumCommitmentBytes, values: calleeValues,
      });
      if (answered !== undefined) {
        calleeValues = answered;
        continue;
      }
      if (calleeValuesOwed(calleePlan, calleeValues)) {
        settled = true;
        break;
      }
    }
    // A void entry that writes no mapping and emits nothing leaves nothing to learn: the plan is the one just
    // derived, accepted or refused.
    if (!returnsValue && learningCandidates.length === 0 && emits.length === 0 && sendCount === 0
      && payees.length === 0) {
      settled = true;
      break;
    }
    // A value the body computes reads a declaration and closes against it, and the failing close leaves the
    // declaration on the stack beside the value the body computed. The frame's `retval` is one such declaration —
    // whichever operand carries the candidate this call wrote — and a mapping node's end view is another, named by
    // the candidate the close matched. Learning the value and rebuilding is what states it.
    const reading = readComputedDeclaration({
      vm: machine,
      program: candidate.programFor(MASTER_ID),
      maximumCommitmentBytes,
    });
    if (reading.ok) {
      if (retvalPlaceholderBytes !== undefined && bytesEqual(reading.computed, retvalPlaceholderBytes)) {
        learnedRetval = Uint8Array.from(reading.declared);
        continue;
      }
      if (retvalPlaceholderBytes !== undefined && bytesEqual(reading.declared, retvalPlaceholderBytes)) {
        learnedRetval = Uint8Array.from(reading.computed);
        continue;
      }
      // A view is matched as the plan now declares it, learned or still a candidate: two collections keyed alike can
      // start two nodes from one candidate, and a close names the first one still declared at it.
      const declaredViews = learnedViews;
      const position = learningCandidates.findIndex((candidateView, index) =>
        bytesEqual(declaredViews[index] ?? candidateView, reading.declared));
      if (position >= 0) {
        learnedViews = learnedViews.map((view, index) =>
          (index === position ? Uint8Array.from(reading.computed) : view));
        continue;
      }
      // A reached emit closes its payload against the sentinel, and a skipped one the sentinel against the empty
      // payload it computes.
      const event = eventCloseOf(reading, eventSentinels);
      if (event !== undefined) {
        learnedEvents = learnedEvents.map((view, index) => (index === event.position ? event.payload : view));
        continue;
      }
      const lockPosition = sendLockSentinels.findIndex((sentinel) => bytesEqual(sentinel, reading.declared));
      if (lockPosition >= 0) {
        learnedSends = learnedSends.map((send, index) =>
          (index === lockPosition ? { ...send, lock: Uint8Array.from(reading.computed) } : send));
        continue;
      }
      // A call's value is compared with the record's eight bytes below the amount the body computed on top.
      const callPosition = callValueSentinels.findIndex((sentinel) => bytesEqual(sentinel, reading.computed));
      const callAmount = vmNumberToBigInt(reading.declared, { requireMinimalEncoding: false });
      if (callPosition >= 0 && typeof callAmount === 'bigint') {
        learnedCallAmounts = learnedCallAmounts.map((amount, index) => (index === callPosition ? callAmount : amount));
        // A callee on a paid contract's records computed from the paid body's candidate amount, so what it answered
        // is learned again once the amount is known.
        if (sharesPayee) calleeValues = NO_CALLEE_VALUES;
        continue;
      }
      const amountPosition = sendAmountSentinels.findIndex((sentinel) => bytesEqual(sentinel, reading.declared));
      const amount = vmNumberToBigInt(reading.computed);
      if (amountPosition >= 0 && typeof amount === 'bigint') {
        learnedSends = learnedSends.map((send, index) => (index === amountPosition ? { ...send, amount } : send));
        continue;
      }
      // The call to one contract bound where the plan put another's: the other's send is on a branch not taken.
      // The record's target is below the address the body computed on top.
      const passed = payees.findIndex((payee) => bytesEqual(payee.lock, reading.computed));
      if (passed >= 0 && payees[passed]!.onBranch && payees.some((payee) => bytesEqual(payee.lock, reading.declared))) {
        return callInShape(options, {
          listedSends: sendCount,
          skippedPayees: new Set([...shape.skippedPayees, payable.indexOf(payees[passed]!)]),
          payeeListedSends: shape.payeeListedSends,
        });
      }
    }
    // A contract it pays hands back what its own body computed from its own program's close.
    const fromPayees = learnFromPayees(candidate);
    if (fromPayees !== undefined) {
      learnedPayees = fromPayees;
      continue;
    }
    // A close on a declaration this call does not state hands nothing back: the plan is as far as it can go.
    if (reading.ok) break;
    // The run left no declaration close to read. A run that made fewer sends than the plan declares stops at its
    // count, having pinned the sends it made in order: the listed sends past them, and the contracts it paid nothing,
    // are on branches it did not take, and the plan drops them.
    const made = learnedSends.findIndex((send) => send.lock === undefined || send.amount === undefined);
    const callAmounts = learnedCallAmounts;
    const unpaid = payees.filter((_payee, index) => callAmounts[index] === undefined);
    const listedShort = made >= unconditionalSends
      && learnedSends.slice(made).every((send) => send.lock === undefined && send.amount === undefined);
    const payeesShort = unpaid.length > 0 && unpaid.every((payee) => payee.onBranch)
      && payees.slice(payees.length - unpaid.length).every((payee) => unpaid.includes(payee));
    // A paid contract's own run stops at its count the same way, its sends past the ones it made on branches it did
    // not take.
    const payeeLearned = learnedPayees;
    const payeeMade = payeeLearned.map((learned) =>
      learned.sends.findIndex((send) => send.lock === undefined || send.amount === undefined));
    const payeeShort = payees.map((payee, index) => payeeMade[index]! >= payee.unconditionalSends
      && payeeLearned[index]!.sends.slice(payeeMade[index]!)
        .every((send) => send.lock === undefined && send.amount === undefined));
    if (listedShort || payeesShort || payeeShort.some(Boolean)) {
      return callInShape(options, {
        listedSends: listedShort ? made : sendCount,
        skippedPayees: new Set([
          ...shape.skippedPayees, ...(payeesShort ? unpaid.map((payee) => payable.indexOf(payee)) : []),
        ]),
        payeeListedSends: new Map([
          ...shape.payeeListedSends,
          ...payees.flatMap((payee, index) => (payeeShort[index] ? [[payee.transferPosition, payeeMade[index]!] as const]
            : [])),
        ]),
      });
    }
    // Otherwise it either converged, or refused before writing anything owed.
    settled = true;
    break;
  }
  if (draft === undefined) {
    throw new PerCallCallError('the composer built no draft for the call frame');
  }
  const owed = learnedViews.some((view) => view === undefined)
    || (returnsValue && learnedRetval === undefined)
    || learnedEvents.some((view) => view === undefined)
    || learnedSends.some((send) => send.lock === undefined || send.amount === undefined)
    || learnedCallAmounts.some((amount) => amount === undefined)
    || learnedPayees.some((learned) => [...learned.events, ...learned.views].some((known) => known === undefined)
      || learned.sends.some((send) => send.lock === undefined || send.amount === undefined));
  if (!settled && owed) {
    if (learnedPayees.some((learned) => [...learned.events, ...learned.views].some((known) => known === undefined)
      || learned.sends.some((send) => send.lock === undefined || send.amount === undefined))) {
      throw new PerCallCallError(
        `a contract entry "${functionName}" pays did not hand back every event payload and node it writes, so its `
        + 'frame cannot declare them',
      );
    }
    if (mappingRecords !== undefined && learnedViews.some((view) => view === undefined)) {
      throw new PerCallCallError(
        `the call's write to mapping "${mappingRecords.collection}" did not hand back every node it rewrites, so the `
        + 'frame cannot declare their commitments',
      );
    }
    if (learnedEvents.some((view) => view === undefined)) {
      throw new PerCallCallError(
        `entry "${functionName}" did not hand back every event payload it emits, so its frame cannot declare its `
        + 'event outputs',
      );
    }
    if (learnedCallAmounts.some((amount) => amount === undefined)) {
      throw new PerCallCallError(
        `entry "${functionName}" did not hand back the amount of every value it sends to a contract, so its frame `
        + 'cannot record the calls',
      );
    }
    if (learnedSends.some((send) => send.lock === undefined || send.amount === undefined)) {
      throw new PerCallCallError(
        `entry "${functionName}" did not hand back the lock and amount of every send it makes, so its frame `
        + 'cannot list its send outputs',
      );
    }
    throw new PerCallCallError(
      `entry "${functionName}" did not hand back the value it returns, so its frame's \`retval\` cannot be stated`,
    );
  }

  const program = draft.programFor(MASTER_ID);
  const transaction = program.transaction;
  if (transaction === undefined) {
    throw new PerCallCallError('the composer built no transaction for the call frame');
  }
  // The containers the sends are paid from sit after the caller's coin, and the machine is asked about them too.
  const rootSpent = payFromContainers([...learnedSends.map((send) => send.amount), ...learnedCallAmounts]).spent;
  const payeeSpentFinal = payees.flatMap((payee, index) => (payee.sendCount === 0 ? [] : payeePaying(
    index, learnedCallAmounts[index] ?? CALL_VALUE_SENTINEL + BigInt(index),
    learnedPayees[index]!.sends.map((send) => send.amount),
  ).spent.map((utxo, position) => ({ id: receiveContainerId(index, position), utxo }))));
  const containerInputs = [
    ...rootSpent.map((utxo, position) => ({ id: containerInputId(position), utxo })),
    ...payeeSpentFinal,
  ].map((spent, position) => ({ ...spent, index: draft!.layout.participantCount + 1 + position }));
  const rawVerdicts: PerCallCallVerdict[] = [...draft.layout.participants, ...containerInputs].map((placed) => {
    const state = machine.evaluate({
      inputIndex: placed.index, sourceOutputs: program.sourceOutputs, transaction,
    });
    return machine.stateSuccess(state) === true
      ? { id: placed.id, index: placed.index, accepted: true }
      : {
        id: placed.id, index: placed.index, accepted: false,
        // The objection names the instruction the machine stopped at, so a refused body can be located in the
        // program's own debug rather than read as an unattributed opcode failure.
        objection: `${String((state as { readonly error?: unknown }).error)}`
          + ` (instruction ${(state as { readonly ip?: number }).ip ?? 0})`,
      };
  });
  const accepted = rawVerdicts.every((verdict) => verdict.accepted);

  // A refused frame is attributed to the reason its own artifact publishes for the entry it ran, so the objection
  // names the entry's own message rather than the opcode the machine stopped on. A frame with nothing published
  // falls back to its bare objection, which still names where it stopped. A refusal on a participant that is not a
  // frame (the validator, a record) carries no source reason and is left to the bare verdict.
  const report = accepted ? undefined : reportCompositionRefusal({ draft, artifacts: frameArtifacts, vm: machine });
  const refusal = report !== undefined && report.refusals.length > 0 ? report : undefined;
  const reasons = new Map(
    (refusal?.refusals ?? []).map((frame) => [frame.master, describeRefusedFrame(frame)]),
  );
  const verdicts: PerCallCallVerdict[] = rawVerdicts.map((verdict) => {
    const reason = verdict.accepted ? undefined : reasons.get(verdict.id);
    return reason === undefined ? verdict : { ...verdict, objection: reason };
  });

  // The entry's own answer is the bytes the derived call records in the frame's `retval`, decoded through the same
  // shipped decoder the read path uses. A call the entry refused never reached its return, so no value was recorded.
  const retval = learnedRetval ?? new Uint8Array(0);
  const values = learnedRetval === undefined
    ? [] : decodeReturnValues(retval, entry.outputs, structs, entry.resultEncoding, artifact.enums);

  // A record the entry does not declare is not spent, so it holds what it held.
  const writtenCommitments = records.map((record) => {
    if (!declared.includes(record)) return record.commitment;
    const commitment = transaction.outputs[recordIndex(record.id)]?.token?.nft?.commitment;
    if (commitment === undefined) {
      throw new PerCallCallError(`the call's output for record "${record.id}" carries no commitment`);
    }
    return Uint8Array.from(commitment);
  });

  const liveUtxos = new Map<string, Utxo>([
    [MASTER_ID, master],
    [VALIDATOR_ID, validator],
    ...declared.map((record) => [record.id, record.utxo] as const),
    ...(mappingRecords?.spentUtxos ?? []),
    ...Object.entries(sideCars.utxos),
    ...(calleePlan?.utxos ?? []),
    ...payees.flatMap((payee, index) => [
      [receiveMasterId(index), payee.master] as const,
      ...payee.records.map((record, position) => [payeeRecordIds[index]![position]!, record.utxo] as const),
      ...[...(payee.mapping?.spentUtxos ?? new Map<string, Utxo>())]
        .map(([id, utxo]) => [receiveNodeId(index, id), utxo] as const),
    ]),
  ]);
  // A refused call has no transaction to broadcast: every output and signature would describe a state the entry
  // never computed.
  const broadcast = accepted ? await broadcastCall({
    provider,
    callerUtxo: options.callerUtxo,
    callerLockingBytecode: options.callerLockingBytecode,
    funder: options.funder,
    ...(options.changeAddress === undefined ? {} : { changeAddress: options.changeAddress }),
    program,
    draft,
    liveUtxos,
    containerInputs,
  }) : undefined;

  return {
    transaction,
    sourceOutputs: program.sourceOutputs,
    draft,
    completed,
    verdicts,
    accepted,
    writtenCommitments,
    retval,
    values,
    value: values[0] ?? 0n,
    ...(refusal === undefined ? {} : { refusal }),
    ...(broadcast === undefined ? {} : { broadcast }),
  };
}

/** What a value send takes: a call's options without an entry or arguments, and the value it sends. */
export type PerCallValueSendOptions = Omit<PerCallCallOptions, 'functionName' | 'args' | 'value'> & {
  readonly value: bigint;
};

/**
 * Sends value to a deployed per-call contract, as a plain EVM transfer does: the contract's `receive()` runs with
 * the value as `msg.value`, or its payable `fallback()` when it has none. A contract with neither has no body to
 * run, and a fallback that is not payable refuses the value, so both are refused by name.
 */
export async function sendPerCallValue(options: PerCallValueSendOptions): Promise<PerCallCallResult> {
  const body = valueEntryOf(options.artifact, 'a value sent to it');
  return callPerCallEntry({ ...options, functionName: body.name, args: [] });
}

/** Everything the call's rebuild reads: the derived specification, the deployment's pools and the caller's coin. */
interface BroadcastCallOptions {
  readonly provider: NetworkProvider;
  readonly callerUtxo: Utxo;
  readonly callerLockingBytecode: Uint8Array;
  readonly funder: Unlocker;
  readonly changeAddress?: string | Uint8Array;
  /** The derived call: the specification every input's unlocking bytecode and every output is taken from. */
  readonly program: ShippedVmProgram;
  readonly draft: CompositionDraft;
  /** The live UTXO each participant sits on, read back by category. */
  readonly liveUtxos: ReadonlyMap<string, Utxo>;
  /** The containers the call's sends are paid from, at the indices after the caller's coin. */
  readonly containerInputs: readonly { readonly index: number; readonly utxo: Utxo }[];
}

/**
 * Rebuilds the derived call on the deployment's real outpoints, signs the caller's input, and broadcasts it.
 *
 * The derived call is the specification: each participant input keeps the unlocking bytecode the composer
 * assembled, each participant output is recreated as it was, and the record ends at the commitment the entry
 * computed. What changes is where the inputs sit — the real masters, validator and records — and the caller's own
 * input, signed over this transaction rather than the filler the draft carried. The caller's recreated output is
 * replaced by its change.
 *
 * The assembled unlocking bytecodes are wider than the production per-input ceiling (the validator's alone is over
 * 10,000 bytes), so the transaction is materialized by the builder and handed to the provider directly rather than
 * through `send`, whose byte gate would refuse the shape the provider's own profile accepts.
 */
async function broadcastCall(options: BroadcastCallOptions): Promise<TransactionDetails> {
  const { provider, program, draft } = options;
  const callerLock = options.funder.generateLockingBytecode();
  if (!bytesEqual(callerLock, options.callerLockingBytecode)) {
    throw new PerCallCallError(
      'the caller funding unlocker signs for a lock that is not the call\'s caller lock, so the root frame\'s '
      + '`msg.sender` binding would not hold',
    );
  }

  const { TransactionBuilder } = await import('../../TransactionBuilder.js');
  // The call's shape is fixed - the composer assembled every contract input, its side-cars included, and there is no
  // oracle to co-spend - so the builder must not append anything.
  const builder = new TransactionBuilder({ provider, skipAutomaticCoSpends: true });
  // The derived locktime is what every frame that reads `block.timestamp` was evaluated against, so the broadcast
  // carries that same one.
  builder.setLocktime(program.transaction?.locktime ?? 0);
  const derivedInputs = program.transaction?.inputs ?? [];
  for (const placed of draft.layout.participants) {
    const source = program.sourceOutputs[placed.index];
    const unlockingBytecode = derivedInputs[placed.index]?.unlockingBytecode;
    if (source === undefined || unlockingBytecode === undefined) {
      throw new PerCallCallError(`the derived call carries no input for participant "${placed.id}"`);
    }
    // A facet holds no token and pins no category, so any live UTXO at its lock serves the input.
    const facetUtxos = placed.kind === 'facet'
      ? await provider.getUtxosForLockingBytecode(source.lockingBytecode)
      : [];
    const real = options.liveUtxos.get(placed.id)
      ?? facetUtxos.find((utxo) => utxo.satoshis === source.valueSatoshis)
      ?? facetUtxos[0];
    if (real === undefined) {
      throw new PerCallCallError(`the deployment holds no live UTXO for the call's "${placed.id}"`);
    }
    if (real.satoshis !== source.valueSatoshis) {
      throw new PerCallCallError(
        `the call's "${placed.id}" holds ${real.satoshis} satoshis, but the derived call spends `
        + `${source.valueSatoshis}`,
      );
    }
    const token = source.token === undefined
      ? {}
      : { token: libauthTokenDetailsToSolidCashTokenDetails(source.token) };
    const utxo: Utxo = { txid: real.txid, vout: real.vout, satoshis: source.valueSatoshis, ...token };
    const sequence = derivedInputs[placed.index]?.sequenceNumber;
    builder.addInput(utxo, rawUnlocker(source.lockingBytecode, unlockingBytecode),
      sequence === undefined ? undefined : { sequence });
  }
  // The caller's own coin funds the call and is the frame's root caller; its signature is a real one over the real
  // transaction, which the root's `msg.sender` binding and the provider both check.
  builder.addInput(options.callerUtxo, options.funder);
  for (const { index, utxo } of options.containerInputs) {
    const source = program.sourceOutputs[index];
    const unlockingBytecode = derivedInputs[index]?.unlockingBytecode;
    if (source === undefined || unlockingBytecode === undefined) {
      throw new PerCallCallError(`the derived call carries no container input at ${index}`);
    }
    builder.addInput(utxo, rawUnlocker(source.lockingBytecode, unlockingBytecode));
  }

  // Every participant recreates in place, so anything the composer placed after them is trailing. The caller's
  // recreated output is replaced by its change below, which is the only non-participant the plan has.
  const settled = draft.layout.participantCount + draft.trailingOutputs.length;
  for (const output of (program.transaction?.outputs ?? []).slice(0, settled)) {
    builder.addOutput(libauthOutputToSolidCashOutput(output));
  }
  builder.addBchChangeOutputIfNeeded({
    to: options.changeAddress ?? options.callerLockingBytecode, feeRate: 1,
  });

  const transaction = builder.buildLibauthTransaction();
  const { encodeTransaction, hash256 } = await import('@bitauth/libauth');
  const rawBytes = encodeTransaction(transaction);
  const rawHex = binToHex(rawBytes);
  const submitPrepared = provider.sendPreparedTransaction?.bind(provider);
  const txid = submitPrepared !== undefined
    ? await submitPrepared({ rawHex, rawBytes, transaction })
    : await provider.sendRawTransaction(rawHex);
  const expected = binToHex(hash256(rawBytes).reverse());
  if (txid !== expected) {
    throw new PerCallCallError(
      `the provider returned txid ${txid} for the call, not the ${expected} its bytes hash to`,
    );
  }
  const { attachWait } = await import('../../wait.js');
  return attachWait({ ...transaction, txid, hex: rawHex } as TransactionDetails, provider);
}
