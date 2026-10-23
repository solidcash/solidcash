/**
 * A call into a deployed framed contract.
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
 * (`sendFramedValue`), or to a payable `fallback()` when the contract has no `receive()`, as the EVM picks the
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
 * it. Its event outputs follow the entry's own, and the nodes it creates follow the entry's. A call whose argument
 * or loop bound reads an earlier call's result, the entry's or a callee frame's, is planned once that call has
 * answered, as the hop plans one: the plan stops before the site, the frames of the earlier calls are settled on it,
 * and the call is planned again from what they returned. A call the entry guards on an earlier result is stated as
 * that result, learned the same way, decides the guard. A typed call into a payable entry carries the value the
 * caller's code computes in its own record (`deposit{value: v}()`): the record starts from none, a site that carries
 * value closes its eight bytes against the amount the code computed, and the amount is learned and planned as the
 * callee frame's `msg.value`, paid from the caller's value and containers into a container of the callee's own. The
 * shapes `callees.ts` does not settle yet are refused by name.
 *
 * What is not covered: a returning entry reached through a proxy hop whose forwarded call records no result. The
 * generated closure shape forwards with a bare `delegatecall(input)` and drops the result, so the hop cannot express
 * the value in that call record (a proxy whose fallback carries the delegated result does carry it; that hop is
 * `callFramedProxyEntry`).
 */

import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { createVirtualMachineBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-vm.js';
import { bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
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
  type FunctionSplitBundle,
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
import { requireFramedFunderSighash } from '../sighash.js';
import { traceBroadcast } from '../../tx-trace.js';
import {
  deployMaster,
  masterForEntry,
  prepareFunctionSplitDeployment,
  requireFunctionSplitShard,
  eventCloseOf,
  eventLockingBytecode,
  eventSentinel,
  readComputedDeclaration,
  readFramedDeployment,
  readSatoshiContainers,
  satoshiContainerLockingBytecode,
  satoshiContainerUnlockingBytecode,
  stateRecordLockingBytecode,
  stateRecordUnlockingBytecode,
  type FramedDeploymentSet,
} from '../deploy/index.js';
import { identityCoinRefusal, withoutIdentityOutputs } from '../deploy/own-coin.js';
import {
  chainSharedNodeViews, placeOwnWrites, producedCallResults, reachedCallResults, samePlannedSites, settleCallees,
  withChainEnds, withCreatedChainEnds, type PlacedLaidWrite,
} from '../proxy/deploy.js';
import { EnclosingValueLearned } from '../proxy/enclosed-values.js';
import {
  declaredRunWidth, hopEntryWrites, type HopEntryWrites, type LaidHopEntryWrites,
} from '../proxy/entry-writes.js';
import { FramedProxyDeployError } from '../proxy/errors.js';
import { declareUnstatedCalls } from '../proxy/planning-refusal.js';
import type { EnclosingRoot } from '../proxy/reentry.js';
import { skippedEmits, type WriteActivationFacts } from '../proxy/write-activation.js';
import { deploymentActivationFacts } from './activation-facts.js';
import {
  FramedCallRecordError, adjacentRecordOrder, callEntryReads, frameDataRecordIndices, loopRecordSpans,
  namedDataRecordIndices, orderLoopKeyArgs, placeRecordsBySpan, requireDistinctNodes, type CallLoopWritePlan,
  type LoopRecordMint, type LoopRecordSpan,
} from './entry-records.js';
import { entrySideCars } from './side-cars.js';
import { bindProviderBlockOracle, blockOracleClock, entryReadsBlockOracle, framedBlockOracle } from './block-oracle.js';
import { sendRecipient, type RecipientContext } from './send-recipient.js';
import {
  framedCalleeTokenAccesses, framedTokenAccesses, framedTokenContainerLockingBytecode,
  framedTokenContainerUnlockingBytecode, framedTokenSendSentinels, learnEmptyNftCommitment, learnTokenSend,
  nftCapabilityName, unlearnedRun, blankNft, visibleNft, type LearnedRun,
} from './token-containers.js';
import {
  FramedLoopTurnsError, entryLoopTurns, publishedLoopEffects, type EntryLoopTurns,
} from './loop-turns.js';
import {
  NO_CALLEE_VALUES, FramedCalleeError, calleeFrames, calleeRetvalPlaceholder, calleeSettlementSeed,
  calleeValuesOfSettlement,
  calleeTokenRunSends, calleeValuesOwed, calleeWrites, deriveThroughFrame, learnCalleeValue, planEntryCallees,
  scopedCalleeFrame, type CalleeValues, type PlannedCallees,
} from './callees.js';
import { bumpFramedCounter } from '../composer/counters.js';
import { FramedReadError, decodeReturnValues } from '../read/index.js';
import {
  FramedComposerError,
  UNFILLED_CALLEE_REF,
  createComposedDerivationHost,
  deploymentBlockId,
  deriveComposition,
  describeRefusedFrame,
  frameEntered,
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
export class FramedCallError extends Error {
  public readonly name = 'FramedCallError';

  public constructor(message: string) {
    super(message);
  }
}

/** What the caller asks a call for. */
export interface FramedCallOptions {
  readonly provider: NetworkProvider;
  /** The deployed contract's framed artifact. */
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
  /** When false, the call is derived and judged and nothing is broadcast. `compose()` uses that. */
  readonly publish?: boolean;
  readonly fee?: bigint;
  readonly vm?: CallMachine;
  readonly validatorProgram?: Uint8Array;
  /** The value the call carries, in satoshis: the frame's `msg.value`. Only a payable entry takes one. */
  readonly value?: bigint;
  /** The contracts the entry's value sends may pay, each found by the address its category derives. */
  readonly externals?: Readonly<Record<string, FramedExternal>>;
  /**
   * The per-entry bundle `artifact` is the logical contract of.
   *
   * The call spends the shard `functionName` names, at that shard's filled lock. A monolithic artifact leaves
   * this unset and spends its single master.
   */
  readonly split?: FunctionSplitBundle;
  /** Which overload `functionName` is, when the bundle has more than one shard of that name. */
  readonly selector?: string;
  /**
   * Fungible tokens the caller pays into the contract's container for their category, each from a coin of its own:
   * what an entry such as BchNative's `wrap` reads as the container's growth. A coin's remainder returns to the caller.
   */
  readonly tokenDeposits?: readonly FramedTokenDeposit[];
}

/** Tokens a call pays into a container: the coin they come from, its unlocker, and the amount the container takes. */
export interface FramedTokenDeposit {
  readonly utxo: Utxo;
  readonly unlocker: Unlocker;
  readonly amount: bigint;
}

/** A deployed contract a call may pay: its framed artifact and its category, as hex. */
export interface FramedExternal {
  readonly artifact: Artifact;
  readonly categoryId: string;
}

/** One participant's verdict, as the machine returned it. */
export interface FramedCallVerdict {
  readonly id: string;
  readonly index: number;
  readonly accepted: boolean;
  readonly objection?: string;
}

/** What a call produced, and whether the machine accepted it. */
export interface FramedCallResult {
  /** The derived transaction the machine was asked about. */
  readonly transaction: NonNullable<ShippedVmProgram['transaction']>;
  /** The output each input spends, in input order. */
  readonly sourceOutputs: ShippedVmProgram['sourceOutputs'];
  readonly draft: CompositionDraft;
  /** The frames the derivation completed, callee before caller. */
  readonly completed: readonly FrameRequest[];
  /** Every participant's verdict, in input order. */
  readonly verdicts: readonly FramedCallVerdict[];
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

/** The satoshis a token output a call creates carries: a send, a deposit's container, a coin's remainder. */
const TOKEN_OUTPUT_SATOSHIS = 1_000n;

/** A token run: the container a frame pays one category from, and the sentinels its sends start from. */
interface TokenRun {
  readonly category: string;
  readonly lockingBytecode: Uint8Array;
  readonly sends: number;
  /** The NFT sends the run makes, before its fungible sends. */
  readonly nftSends: number;
  /** True when the run's frame reads the output side of the amount, crediting what reaches its containers. */
  readonly readsOutput: boolean;
  /** The contract and category the run pays, which the runs of other frames paying them share. */
  readonly group: string;
  /**
   * The containers the run spends, which lead it: its fungible ones, then those holding NFTs, its NFT sends made from
   * the last. A fungible remainder is kept on the first that keeps an NFT the VM still sees beside it, or else on the
   * first fungible one.
   */
  readonly containers: readonly Utxo[];
  /** Every container of the run's contract for the category holding an NFT the VM sees, in outpoint order. */
  readonly nftContainers: readonly Utxo[];
  readonly held: bigint;
  /** How many more containers the run can take from the later runs of its contract's category. */
  readonly spare: number;
  /** The run's key among the call's runs, which a shortfall names. */
  readonly key: string;
  /** The master whose frame pays, which each container's unlocking names as its authority. */
  readonly master: string;
  /** The category of the contract the container belongs to. */
  readonly contractCategoryId: string;
  /** The run's place among its master's runs. */
  readonly run: number;
  readonly sentinels: ReturnType<typeof framedTokenSendSentinels>;
}

/** A coin's token as a draft's source output or output states it. */
function draftToken(token: NonNullable<Utxo['token']>): NonNullable<DraftSourceOutput['token']> {
  return {
    category: hexToBin(token.category), amount: token.amount,
    ...(token.nft === undefined ? {}
      : { nft: { capability: token.nft.capability, commitment: hexToBin(token.nft.commitment) } }),
  };
}

/** The identity of the `position`-th token container the `index`-th token run spends. */
function tokenContainerInputId(index: number, position: number): string {
  return `token-container:${index}:${position}`;
}

/**
 * A token run that should spend another number of containers: more, when its sends outgrow them while its contract
 * holds more, or fewer, once its sends are learned and fewer cover them.
 */
class TokenRunShortfall extends FramedCallError {
  public constructor(public readonly run: string, public readonly containers: number) {
    super(`token run ${run} spends ${containers} containers`);
  }
}

/**
 * Token runs whose NFT sends are made from other containers than they spend: by run key, the containers, by outpoint and
 * in send order, that each should spend last in its run.
 */
class TokenNftAssignment extends FramedCallError {
  public constructor(public readonly assignment: ReadonlyMap<string, readonly string[]>) {
    super(`token runs ${[...assignment.keys()].join(', ')} spend other NFT containers`);
  }
}

/**
 * How many of its contract's smallest containers, besides those that cover its sends, the last run paying a category
 * folds into the container it keeps, so deposits that open containers of their own do not pile up.
 */
const FOLDED_CONTAINERS = 2;

/** A container's outpoint, as an NFT assignment names it. */
function outpointOf(utxo: Utxo): string {
  return `${utxo.txid}:${utxo.vout}`;
}

/** The identity of the `index`-th coin at the caller's lock that fills an index between token runs. */
function fillerCoinInputId(index: number): string {
  return `filler-coin:${index}`;
}

/** The identity of the `index`-th coin a call's token deposits spend. */
function tokenDepositInputId(index: number): string {
  return `token-deposit:${index}`;
}

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
  return sha256(new TextEncoder().encode(`framed call retval\u0000${contract}\u0000${functionName}`));
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
/** A value send's call data: the selector of `receive()` alone, the EVM's empty call data. The selector scheme
 * follows the compile's mode (D27), so it is derived per artifact rather than from a native-only constant. */
const valueSendCallData = (artifact: Artifact): Uint8Array =>
  computeFunctionSelector(
    computeFunctionSignature(RECEIVE_ENTRY, []), artifact.compiler?.options?.evmCompat === true,
  );

/**
 * The body a value send runs, as the EVM picks it: `receive()`, else a payable `fallback()`. `what` names the value
 * in the refusal of a contract with neither.
 */
function valueEntryOf(artifact: Artifact, what: string): Artifact['abi'][number] {
  const receive = artifact.abi.find((candidate) => candidate.name === RECEIVE_ENTRY);
  if (receive !== undefined) return receive;
  const fallback = artifact.abi.find((candidate) => candidate.name === FALLBACK_ENTRY);
  if (fallback === undefined) {
    throw new FramedCallError(`contract "${artifact.contractName}" has no receive(), so ${what} has no body to run`);
  }
  if (!(fallback.modifiers ?? []).includes('payable')) {
    throw new FramedCallError(
      `contract "${artifact.contractName}" has no receive() and its fallback() is not payable, so it refuses ${what}`,
    );
  }
  return fallback;
}

/** The ABI row a call names, refusing an entry the artifact does not publish. */
function requireEntry(artifact: Artifact, functionName: string): CallEntry {
  const entry = artifact.abi.find((candidate) => candidate.name === functionName);
  if (entry === undefined) {
    throw new FramedCallError(`artifact "${artifact.contractName}" publishes no entry "${functionName}"`);
  }
  if (entry.selector === undefined) {
    throw new FramedCallError(
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
      if (input === undefined) throw new FramedCallError(`entry "${functionName}" has no parameter ${index}`);
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
   * for each published call site, the position of its first call in the frame, or -1 for none. A frame a stopped plan
   * states only the first calls of (`truncated`) declares a write past its last stated call in its last segment.
   */
  place(calls: number, callBases: readonly number[], truncated: boolean): DraftRecordEntry[][];
  /**
   * The segments each of `entries` lands in as `place` declares it: a write's records in the segment its artifact
   * publishes for it, or a loop's turns, and undefined for a node the frame only reads apart.
   */
  spans(calls: number, callBases: readonly number[], truncated: boolean): readonly (LoopRecordSpan | undefined)[];
}

/** The mapping records one frame reads and writes, with the ids its plan places. */
interface EntryMapping {
  /**
   * How a refusal names what the frame writes: the first collection it writes, or the first one it reads when it
   * writes none, or the dynamic value it grows when it touches no collection.
   */
  readonly label: string;
  /** The participant ids the frame's block holds for the records it spends, in declaration order. */
  readonly participantIds: readonly string[];
  /** The live UTXO of each spent record, keyed by the participant id the frame places it under. */
  readonly spentUtxos: ReadonlyMap<string, Utxo>;
  /** The run-time loops that write the collection, in the order the body runs them, when loops write it. */
  readonly loopRun?: readonly CallLoopWritePlan[];
  /** The dynamic run whose width a record's length or the entry's growth fixed, and that width (`hopEntryWrites`). */
  readonly sizedRun?: HopEntryWrites['sizedRun'];
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
  readonly deployment: FramedDeploymentSet;
  /** The frame's state, `address(this)` and nodes' values, which its keys and guarded writes are decided from. */
  readonly facts: WriteActivationFacts;
  /** The timestamp from the same authenticated oracle input the frame co-spends. */
  readonly blockClock?: Readonly<Record<string, bigint>>;
  /** The lock the chunks a write leaves past its value's width are paid to: the user's, whose coin enters. */
  readonly releasedLock: Uint8Array;
  /**
   * The commitment each of the frame's records is planned to end at, in data-NFT order: the length one states for a
   * dynamic value sizes the run of a write the artifact states no element for, as the hop sizes it. Absent leaves
   * such a write refused.
   */
  readonly writtenCommitments?: readonly Uint8Array[];
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
  if (!(error instanceof FramedProxyDeployError)) return error;
  return new FramedCallRecordError(error.message
    .replaceAll(`the implementation's "${functionName}" entry`, `entry "${functionName}"`)
    .replaceAll('this hop', 'this call'));
}

/**
 * Plans the mapping records one frame of a call reads and writes, and the run of chunk records a dynamic value it
 * grows or only reads takes, or `undefined` when it touches neither: the node of each key it only reads
 * (`callEntryReads`), then its writes as the hop plans a frame's own (`hopEntryWrites`).
 *
 * The hop's planner takes the frame as it takes a delegate frame, on the frame's own records, nodes, chunks and
 * category rather than a proxy's: one sorted batch per collection, keys from the arguments, the sender, the state and
 * the nodes of other mappings, guarded writes decided from the frame's facts, and a value that chunks laid with its
 * run of chunk records. A value-dependent record starts from a candidate the body's close hands the value back
 * against. The nodes read apart are declared kept ahead of the writes, and the planner takes a read at their slots as
 * declared. A chunkable value the artifact does not state is sized only from the body's own close, which this path
 * does not plan again from, so it is refused by name. A dynamic value's run whose element the artifact does not state
 * is laid at the width the length `writtenCommitments` states for it, as the hop lays a frame's own.
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
  // A dynamic value's run of chunk records is the frame's own write as a batch is, so an entry that grows one is
  // planned whether or not it writes a mapping beside it.
  const grows = fn?.dynamicWrites ?? [];
  // A run the entry only reads is declared as the hop declares its delegate frame's (`planHopReadRuns`): each live
  // chunk kept in place past the frame's records, where the body reads an element of it, before its calls or after.
  // Left out, the body's read of the element finds no run there and fails.
  const readOnly = (fn?.dynamicReads ?? []).filter((variable) => !grows.includes(variable));
  const writesOwn = batches.length > 0 || grows.length > 0 || readOnly.length > 0
    || (fn?.entryAccesses ?? []).some((access) => access.operations.some((operation) => operation !== 'read'));
  const category = new Uint8Array(hexToBin(categoryId));
  const several = new Set(batches.map((batch) => batch.collection)).size > 1;
  let writes: HopEntryWrites | undefined;
  try {
    writes = !writesOwn ? undefined : hopEntryWrites({
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
      ...(request.blockClock === undefined ? {} : { blockClock: request.blockClock }),
      ...valueReader,
      ...(request.writtenCommitments === undefined ? {} : { writtenCommitments: request.writtenCommitments }),
    });
  } catch (error) {
    throw asCallRefusal(error, functionName);
  }
  if (writes?.awaitsValue === true) {
    const chunking = writes.reachWrites.find((write) => write.chunkable)?.collection ?? writes.collection;
    throw new FramedCallRecordError(
      `entry "${functionName}" writes mapping "${chunking ?? ''}", whose values chunk, a value its artifact does not `
      + 'state, so the run of chunk records the write takes cannot be sized from the call alone',
    );
  }
  const collection = writes?.collection ?? reads.nodes[0]?.collection;
  const grown = writes === undefined ? undefined : grows[0];
  const readRun = writes?.readRunIds === undefined ? undefined : readOnly[0];
  if (collection === undefined && grown === undefined && readRun === undefined) return undefined;
  requireDistinctNodes(functionName, [...reads.nodes.map((node) => node.utxo), ...(writes?.spentUtxos.values() ?? [])]);
  return {
    label: collection === undefined ? `dynamic "${grown ?? readRun!}"` : `mapping "${collection}"`,
    // The nodes it only reads come first, so they sit past the frame's data records where its code reads them.
    participantIds: [...reads.nodes.map((node) => node.id), ...(writes?.participantIds ?? [])],
    spentUtxos: new Map([...reads.nodes.map((node) => [node.id, node.utxo] as const), ...(writes?.spentUtxos ?? [])]),
    ...(writes?.loopRun === undefined ? {} : { loopRun: writes.loopRun }),
    ...(writes?.sizedRun === undefined ? {} : { sizedRun: writes.sizedRun }),
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
      // Each write lands in the segment its artifact publishes, as the hop places its delegate frame's own.
      const placeWrites = (
        segments: DraftRecordEntry[][], calls: number, callBases: readonly number[], truncated: boolean,
      ): readonly PlacedLaidWrite[] => {
        if (laid === undefined || writes === undefined) return [];
        try {
          return placeOwnWrites(segments, {
            artifact, functionName, label: `entry "${functionName}"`, laid: { ...laid, entries: written }, writes,
            indexOf: context.indexOf, category, createdBase: context.createdBase, calls, callBases,
            ...(truncated ? { truncated } : {}),
          });
        } catch (error) {
          throw asCallRefusal(error, functionName);
        }
      };
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
        place: (calls, callBases, truncated) => {
          const segments = Array.from({ length: calls + 1 }, (): DraftRecordEntry[] => [...read.entries]);
          placeWrites(segments, calls, callBases, truncated);
          return segments;
        },
        spans: (calls, callBases, truncated) => [
          ...read.entries.map(() => undefined),
          ...placeWrites(Array.from({ length: calls + 1 }, (): DraftRecordEntry[] => []), calls, callBases, truncated)
            .map((placed) => placed.span),
        ],
      };
    },
  };
}

/** Calls an entry on a deployed framed contract, evaluates it, and broadcasts it when every participant agrees. */
export async function callFramedEntry(options: FramedCallOptions): Promise<FramedCallResult> {
  requireFramedFunderSighash(options.funder);
  // The caller's coin pays the fee, so a call that may broadcast refuses an identity output or reserved coin there
  // before it is planned (docs/bcmr/DESIGN.md 4.4). A coin whose transaction is not served, as a simulation's
  // stand-in, is judged by the reservation alone.
  if (options.publish !== false) {
    const refusal = await identityCoinRefusal(options.provider, options.callerUtxo);
    if (refusal !== undefined) throw new FramedCallError(refusal);
  }
  // A token run whose sends outgrow its containers spends one more of its contract's, and one whose NFT sends are made
  // from other containers than it spends spends those, which shifts the run, so the call is planned again from the
  // start.
  let tokenContainerCounts: ReadonlyMap<string, number> = new Map();
  let tokenNftContainers: ReadonlyMap<string, readonly string[]> = new Map();
  let foldContainers = true;
  const assignments = new Set<string>();
  for (;;) {
    try {
      const result = await callInShape(options, {
        listedSends: undefined, skippedPayees: new Set(), payeeListedSends: new Map(), tokenContainerCounts,
        tokenNftContainers, foldContainers,
      });
      // A run that folds containers lengthens every frame's walk over the inputs, so a call that folding pushes past
      // a VM density limit is planned again with each run spending only the containers that cover its sends.
      if (foldContainers && !result.accepted
        && result.verdicts.some((verdict) => verdict.objection?.includes('density limit') === true)) {
        foldContainers = false;
        continue;
      }
      return result;
    } catch (error) {
      if (error instanceof TokenRunShortfall) {
        tokenContainerCounts = new Map([...tokenContainerCounts, [error.run, error.containers]]);
      } else if (error instanceof TokenNftAssignment) {
        tokenNftContainers = new Map([...tokenNftContainers, ...error.assignment]);
        const seen = JSON.stringify([...tokenNftContainers].sort());
        if (assignments.has(seen)) {
          throw new FramedCallError(`entry "${options.functionName}" makes NFT sends whose containers change with the `
            + 'containers it spends');
        }
        assignments.add(seen);
      } else {
        throw error;
      }
    }
  }
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
  /** How many containers each token run spends, by its key, where more than one. */
  readonly tokenContainerCounts?: ReadonlyMap<string, number>;
  /** The NFT containers each token run spends, by its key and in send order, once its NFT sends are learned. */
  readonly tokenNftContainers?: ReadonlyMap<string, readonly string[]>;
  /** False when a run spends only the containers that cover its sends, folding none of the smallest into its own. */
  readonly foldContainers?: boolean;
  /** The sends each token run makes, by its key, where its body made fewer than its entry can. */
  readonly tokenSendCounts?: ReadonlyMap<string, { readonly sends: number; readonly nftSends: number }>;
}

/**
 * What earlier calls returned, as the plans of a call before this one learned it: the results the sites a plan stopped
 * before read (`reached`, keyed by `reachedResultKey`), and the results the entry's own guards read (`returns`, by
 * callsite id), with how many plans the guards were decided on again (`passes`).
 */
interface EarlierResults {
  readonly reached: ReadonlyMap<string, FunctionArgument>;
  readonly returns: ReadonlyMap<number, FunctionArgument>;
  readonly passes: number;
  /** The whole values callee frames' chunkable writes stored, by master, as their closes exposed them. */
  readonly writeValues: ReadonlyMap<string, Uint8Array>;
  /**
   * The commitments the entry's own records end at, in data-NFT order, as the draft learned them from the body's
   * closes: the length each states sizes a run the artifact states no element for. Absent until learned.
   */
  readonly writtenRecords?: readonly Uint8Array[];
}

/** No earlier result learned: a call's first plan. */
const NO_EARLIER_RESULTS: EarlierResults = { reached: new Map(), returns: new Map(), passes: 0, writeValues: new Map() };

/** A call planned with the sends `shape` declares, and from the results `prior` holds. */
async function callInShape(
  options: FramedCallOptions, shape: SendShape, prior: EarlierResults = NO_EARLIER_RESULTS,
): Promise<FramedCallResult> {
  const { provider, categoryId, functionName } = options;
  let splitShard;
  try {
    splitShard = options.split === undefined
      ? undefined
      : requireFunctionSplitShard(options.split, functionName, options.selector);
  } catch (error) {
    throw new FramedCallError((error as Error).message);
  }
  // A v2 call executes the entry's own shard. A monolith keeps the artifact the caller passed.
  // A shard that names a helper lock is replaced, once the validator program is known, by the clone whose
  // sentinel already holds that lock.
  let artifact = splitShard?.artifact ?? options.artifact;
  const providerOracleLock = bindProviderBlockOracle(provider, artifact);
  const stateLayout = artifact.stateLayout;
  if (stateLayout === undefined) {
    throw new FramedCallError(`artifact "${artifact.contractName}" is not a stateful contract`);
  }
  if (options.callerLockingBytecode.length !== 25) {
    throw new FramedCallError(
      `a root frame's caller is a 25-byte P2PKH lock; got ${options.callerLockingBytecode.length} bytes`,
    );
  }
  const entry = requireEntry(artifact, functionName);
  const value = options.value ?? 0n;
  if (value < 0n) throw new FramedCallError(`a call carries no negative value; got ${value}`);
  if (value > 0n && !entry.payable) {
    throw new FramedCallError(`entry "${functionName}" is not payable, so a call to it carries no value`);
  }
  if (entry.name === FALLBACK_ENTRY && (options.args ?? []).length > 0) {
    throw new FramedCallError(
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
  // A function shard is one body. Its root frame carries the arguments and not a selector: the selector salt
  // lives on the callee arms. A monolith with one body still has no path here.
  if (splitShard === undefined && dispatchedBodies <= 1 && !hasFallback) {
    throw new FramedCallError(
      `contract "${artifact.contractName}" has ${dispatchedBodies} dispatched body(ies), so a user's frame to it `
      + 'carries no selector, which this call path does not plan yet',
    );
  }
  const { framedValidator } = await import('@solidcash/solidc/runtime');
  const validatorProgram = options.validatorProgram ?? framedValidator.buildValidatorProgram();
  const machine = options.vm ?? createVirtualMachineBch2026ForProvider(provider);
  const category = new Uint8Array(hexToBin(categoryId));
  if (splitShard !== undefined && options.split !== undefined
    && (artifact.composition?.internalHelperLocks?.length ?? 0) > 0) {
    const prepared = prepareFunctionSplitDeployment(options.split, category, validatorProgram);
    const patched = prepared.shardArtifacts.get(splitShard.selector.toLowerCase());
    if (patched === undefined) {
      throw new FramedCallError(`function "${functionName}" is not in the prepared split`);
    }
    artifact = patched;
    bindProviderBlockOracle(provider, artifact);
  }
  const published = publishedEntryOf(artifact, functionName);
  const deployed = deployMaster(artifact, category, validatorProgram);
  const structs = structDefinitionsOf(artifact);

  // The deployment's live pools and records, classified by category and ordered by data-NFT index.
  const deployment = await readFramedDeployment(provider, categoryId, stateLayout);
  let master = deployment.masters[0];
  if (splitShard !== undefined) {
    try {
      master = masterForEntry({
        masters: deployment.masters,
        filledLock: deployed.lockingBytecode,
        functionName,
      });
    } catch (error) {
      throw new FramedCallError((error as Error).message);
    }
  }
  if (master === undefined) {
    throw new FramedCallError(`category ${categoryId} holds no master, which a root frame runs on`);
  }
  const validator = deployment.validators[0];
  if (validator === undefined) {
    throw new FramedCallError(`category ${categoryId} holds no validator, which a root frame needs to be admitted`);
  }
  if (deployment.records.length < stateLayout.dataNftCount) {
    throw new FramedCallError(
      `category ${categoryId} holds ${deployment.records.length} data-NFT record(s), and the layout names `
      + `${stateLayout.dataNftCount}`,
    );
  }
  const records = Array.from({ length: stateLayout.dataNftCount }, (_unused, nftIndex) => {
    const utxo = deployment.records[nftIndex]!;
    const commitment = utxo.token?.nft?.commitment;
    if (commitment === undefined) {
      throw new FramedCallError(`the record at data-NFT index ${nftIndex} carries no commitment`);
    }
    return { id: recordId(nftIndex), commitment: new Uint8Array(hexToBin(commitment)), utxo };
  });
  // The token containers the entry names. Each it pays tokens from leads the trailing outputs with a run: the one
  // container the frame spends, recreated with what the sends leave, then the sends (spec 4b).
  const tokenAccesses = await framedTokenAccesses({
    provider,
    entry: artifact.abi.find((candidate) => candidate.name === functionName),
    categoryId,
    args,
    stateLayout,
    records: records.map((record) => record.utxo),
  });
  const tokenDeposits = options.tokenDeposits ?? [];
  for (const deposit of tokenDeposits) {
    const held = deposit.utxo.token;
    if (held === undefined || (held.nft === undefined ? deposit.amount <= 0n : !visibleNft(held))
      || (blankNft(held) && deposit.amount > 0n) || deposit.amount < 0n || deposit.amount > held.amount) {
      throw new FramedCallError('a token deposit pays a positive amount of a fungible coin, or an NFT with at most the '
        + 'fungible amount its coin holds; an immutable NFT with an empty commitment goes alone, since beside a fungible '
        + 'amount the VM cannot see it');
    }
  }
  // The records the frame declares, and the transaction spends, in the order the entry's own code reads them.
  const declared = frameDataRecordIndices(artifact, entry.name).map((nftIndex) => records[nftIndex]!);
  const recordIds = declared.map((record) => record.id);
  // A record the artifact publishes as written only after every call is kept in each segment before that last one, as
  // a callee's record is kept before its first write (`calleeFrames`). A read the body makes before its calls, such as
  // the width of a run it grows, read off the record's declared end, then reads the record as that segment holds it,
  // not a placeholder only the segment's later close would replace.
  const keptUntilLast = frameDataRecordIndices(artifact, entry.name).map((nftIndex) => {
    const writes = (published?.writeSegments ?? []).filter((write) => write.record === nftIndex);
    return writes.length > 0 && writes.every((write) => write.segment === 'last' && write.turns === undefined);
  });

  // The mapping records the entry reads and writes, planned against the deployment's own classified inventory as the
  // proxy hop plans its frames' own (`entryMapping`): the frame declares the node a held key sits at, or the node a
  // new key is spliced beside, one sorted batch per collection, with a value's run of chunk records. A key the body
  // reads out of its own records, or out of another mapping, resolves against the records and nodes it spends.
  // A run whose element the artifact does not state, such as one an entry rewrites an element of in place, is sized
  // from the length the records state for its value: the live records until the body's close states the ones it
  // writes, as the hop sizes a frame's own run (`planHopDynamicRun`).
  const BLOCK_ORACLE_INPUT = `${MASTER_ID}:block-oracle`;
  const fetchedBlockOracle = entryReadsBlockOracle(artifact, functionName)
    ? await framedBlockOracle(provider, providerOracleLock, functionName, (reason) => new FramedCallError(reason))
    : undefined;
  const blockClock = fetchedBlockOracle === undefined ? undefined : blockOracleClock(fetchedBlockOracle);
  const deploymentFacts = deploymentActivationFacts(artifact, categoryId, deployment, deployed.address);
  const activationFacts = {
    ...deploymentFacts, stateValues: { ...deploymentFacts.stateValues, ...blockClock },
  };
  const mappingRecords = entryMapping({
    artifact, functionName, args, senderLockingBytecode: options.callerLockingBytecode, categoryId, deployment,
    facts: activationFacts, releasedLock: options.callerLockingBytecode,
    ...(blockClock === undefined ? {} : { blockClock }),
    writtenCommitments: prior.writtenRecords ?? records.map((record) => record.commitment),
  });
  const mappingIds = mappingRecords?.participantIds ?? [];

  // The calls the entry makes and the callee frames they reach, each on a master of its own contract's pool, planned
  // from the results earlier plans learned.
  const planCallees = async (returns: ReadonlyMap<number, FunctionArgument>): Promise<PlannedCallees | undefined> => {
    try {
      return await planEntryCallees({
        provider, artifact, functionName, args, externals: options.externals ?? {}, validatorProgram, categoryId,
        deployment, selfAddress: deployed.address, senderAddress: options.callerLockingBytecode,
        ...(blockClock === undefined ? {} : { blockClock }),
        ...(prior.reached.size === 0 ? {} : { reachedResults: prior.reached }),
        ...(returns.size === 0 ? {} : { externalReturns: returns }),
        ...(prior.writeValues.size === 0 ? {} : { calleeWriteValues: prior.writeValues }),
        ...(options.split === undefined ? {} : { split: options.split }),
        ...(splitShard === undefined ? {} : {
          takenMasters: new Map([[categoryId, new Set([`${master.txid}:${master.vout}`])]]),
        }),
      });
    } catch (error) {
      if (error instanceof FramedCalleeError) throw new FramedCallError(error.message);
      throw error;
    }
  };
  const calleePlan = await planCallees(prior.returns);
  // A callee run the shape cut to the sends its body made learns only those.
  for (const callee of calleePlan?.callees ?? []) {
    const runs = calleeTokenRunSends(callee).map((counts, run) =>
      shape.tokenSendCounts?.get(`${callee.master}\u0000${run}`) ?? counts);
    if (runs.some((counts, run) => shape.tokenSendCounts?.has(`${callee.master}\u0000${run}`))) {
      (callee as { tokenRunSends?: typeof runs }).tokenRunSends = runs;
    }
  }
  // The containers each frame names, the root's first: the frames that pay run one token run per category, after the
  // root's, each spending containers of its own, recreated with what its sends leave, then its sends.
  const named: {
    readonly access: Awaited<ReturnType<typeof framedTokenAccesses>>[number];
    readonly owner: string; readonly payer: string; readonly entryName: string; readonly contractCategoryId: string;
  }[] = tokenAccesses.map((access) => ({
    access, owner: artifact.contractName, payer: MASTER_ID, entryName: entry.name, contractCategoryId: categoryId,
  }));
  for (const callee of calleePlan?.callees ?? []) {
    let accesses: Awaited<ReturnType<typeof framedCalleeTokenAccesses>>;
    try {
      accesses = await framedCalleeTokenAccesses({
        provider, artifact: callee.artifact, entry: callee.entry, categoryId: callee.categoryId,
        args: callee.args ?? [], records: callee.records,
      });
    } catch (error) {
      throw new FramedCallError(`entry "${functionName}": ${(error as Error).message}`);
    }
    named.push(...accesses.map((access) => ({
      access, owner: callee.artifact.contractName, payer: callee.master, entryName: callee.entry,
      contractCategoryId: callee.categoryId,
    })));
  }
  // A master conserves only the containers whose unlocking names it, so two frames of one contract pay one category
  // from containers of their own, largest first: each paying run takes one, or as many as its shortfalls grew it to,
  // and the last takes every one left, then, once its sends are learned, those that cover them and the smallest few
  // besides. Where no frame pays, the first that reads the amount spends them all. A run keeps what it holds on one
  // container and drains the rest into it, so spending containers folds them. A frame's runs are counted among its
  // paying accesses, as the learner counts them (`calleeTokenRunSends`).
  const groupOf = (contractCategoryId: string, tokenCategory: string): string =>
    `${contractCategoryId}\u0000${tokenCategory}`;
  const foldedContainers = shape.foldContainers === false ? 0 : FOLDED_CONTAINERS;
  const runsOf = new Map<string, number>();
  const requests = named.filter(({ access }) => access.sends + access.nftSends > 0 || access.reads).map((request) => {
    const paying = request.access.sends + request.access.nftSends > 0;
    const run = paying ? runsOf.get(request.payer) ?? 0 : -1;
    if (paying) runsOf.set(request.payer, run + 1);
    const key = paying ? `${request.payer}\u0000${run}` : `${request.payer}\u0000read\u0000${request.access.category}`;
    const made = shape.tokenSendCounts?.get(key);
    return {
      ...request, access: made === undefined ? request.access : { ...request.access, ...made }, run, key,
      group: groupOf(request.contractCategoryId, request.access.category),
    };
  });
  const sized = new Map<(typeof requests)[number], { readonly containers: readonly Utxo[]; readonly spare: number }>();
  // A deposit pays into the containers of the contract whose frame names its category, the root's first.
  const depositTargets = tokenDeposits.map((deposit) => named.find(({ access }) =>
    access.category === deposit.utxo.token!.category)?.contractCategoryId ?? categoryId);
  for (const group of new Set(requests.map((request) => request.group))) {
    const members = requests.filter((request) => request.group === group);
    const paying = members.filter((request) => request.access.sends + request.access.nftSends > 0);
    const pool = members[0]!.access.containers;
    // A frame's NFT sends follow a run that ends on the containers they are made from (spec 4b). A contract that holds
    // a minting NFT of the category mints them instead, from a minting container each frame sending them spends last.
    // Otherwise, until its sends are learned, the first frame sending NFTs spends every NFT container of the contract
    // and a later one that would own no container spends one, since its sends follow containers of its own; once they
    // are, each spends the containers its sends are made from, in send order.
    const moving = paying.filter((request) => request.access.nftSends > 0);
    const heldNfts = moving[0]?.access.nftContainers ?? [];
    const mintingPool = heldNfts.filter((utxo) => utxo.token!.nft!.capability === 'minting');
    if (mintingPool.length > 0 && moving.length > mintingPool.length) {
      throw new FramedCallError(`entry "${functionName}" mints NFTs of category ${moving[0]!.access.category} in `
        + `${moving.length} frames of contract "${moving[0]!.owner}", which holds ${mintingPool.length} minting NFT `
        + 'container(s) of it; each frame that mints spends one of its own');
    }
    const nftPool = mintingPool.length > 0 ? [] : [...heldNfts];
    const assigned = moving.some((request) => shape.tokenNftContainers?.has(request.key) === true);
    const byOutpoint = new Map(nftPool.map((utxo) => [outpointOf(utxo), utxo]));
    const anchors = new Map<(typeof requests)[number], Utxo>();
    // The last run takes every container left until its sends are learned, then those that cover them and the smallest
    // few besides, which it folds into the one it keeps.
    const fungibleOf = (request: (typeof requests)[number], at: number, start: number): readonly Utxo[] => {
      const counted = shape.tokenContainerCounts?.get(request.key);
      if (at < paying.length - 1) return pool.slice(start, start + (counted ?? 1));
      if (counted === undefined) return pool.slice(start);
      return [...pool.slice(start, start + counted),
        ...pool.slice(Math.max(start + counted, pool.length - foldedContainers))];
    };
    let from = 0;
    paying.forEach((request, at) => {
      const fungible = fungibleOf(request, at, from);
      if (!assigned && request !== moving[0] && request.access.nftSends > 0 && fungible.length === 0
        && nftPool.length > 1) {
        anchors.set(request, nftPool.pop()!);
      }
      from += fungible.length;
    });
    from = 0;
    paying.forEach((request, at) => {
      const last = at === paying.length - 1;
      const fungible = fungibleOf(request, at, from);
      const nfts = mintingPool.length > 0 ? mintingPool.slice(moving.indexOf(request), moving.indexOf(request) + 1)
        : assigned ? (shape.tokenNftContainers?.get(request.key) ?? []).map((outpoint) => byOutpoint.get(outpoint)!)
          : [...(request === moving[0] ? nftPool : []), ...(anchors.has(request) ? [anchors.get(request)!] : [])];
      const containers = [...fungible, ...nfts];
      if (containers.length === 0) {
        throw new FramedCallError(pool.length === 0
          ? `entry "${request.entryName}" pays tokens of category ${request.access.category}, and contract `
            + `"${request.owner}" holds no container of them`
          : `entry "${functionName}" pays tokens of category ${request.access.category} from contract `
            + `"${request.owner}" in more frames than the ${pool.length} containers it holds of them; each frame pays `
            + 'from containers of its own');
      }
      from += fungible.length;
      sized.set(request, { containers, spare: last ? 0 : pool.length - from - (paying.length - at - 1) });
    });
    if (paying.length === 0 && pool.length > 0) {
      sized.set(members.find((request) => request.access.readsOutput) ?? members[0]!, { containers: pool, spare: 0 });
    }
  }
  const tokenRuns: readonly TokenRun[] = requests.flatMap((request) => {
    const size = sized.get(request);
    if (size === undefined) return [];
    const { access, owner, payer, entryName, contractCategoryId, run, key, group } = request;
    return [{
      ...access, ...size, held: size.containers.reduce((sum, utxo) => sum + utxo.token!.amount, 0n), key, group,
      master: payer, contractCategoryId, run,
      sentinels: framedTokenSendSentinels(owner, entryName, payer, run, access.sends, access.nftSends),
    }];
  });
  const rootTokenRuns = tokenRuns.filter((run) => run.master === MASTER_ID && run.sends + run.nftSends > 0);
  const tokenRunWidth = (run: TokenRun): number => run.containers.length + run.sends + run.nftSends;
  const tokenRunLength = tokenRuns.reduce((sum, run) => sum + tokenRunWidth(run), 0);
  /** The category each paying run of a frame pays, by master, at the run's place among them. */
  const tokenRunCategories = (payer: string): readonly string[] => {
    const categories: string[] = [];
    for (const run of tokenRuns) if (run.master === payer && run.run >= 0) categories[run.run] = run.category;
    return categories;
  };
  // While a transaction can mint a category from a contract's container, a fungible amount of it outside the lock
  // could hide a minted NFT with an empty commitment, which the VM cannot see (spec 4b).
  for (const run of tokenRuns.filter((candidate) => candidate.nftSends > 0
    && candidate.containers.some((container) => container.token!.nft?.capability === 'minting'))) {
    const fungibleOut = tokenRuns.some((other) => other.category === run.category && other.sends > 0)
      || tokenDeposits.some((deposit) => deposit.utxo.token!.category === run.category
        && deposit.utxo.token!.amount > deposit.amount);
    if (fungibleOut) {
      throw new FramedCallError(`entry "${functionName}" mints NFTs of category ${run.category}, and moves a fungible `
        + 'amount of it outside the container lock in the same transaction, where it could hide a minted NFT the VM '
        + 'cannot see');
    }
  }
  // A fungible deposit merges into a run of a frame that reads what reaches its containers; otherwise it is a new
  // container, which the one master of the contract owning none there counts (spec 4b).
  const depositRuns = tokenDeposits.map((deposit, index) => (deposit.utxo.token!.nft !== undefined ? -1
    : tokenRuns.findIndex((run) => run.readsOutput
      && run.contractCategoryId === depositTargets[index] && run.category === deposit.utxo.token!.category)));
  // The sends of every run but the last sit at indices whose inputs are not containers: the caller's coin and its
  // deposits fill them first, then more tokenless coins at the caller's lock.
  const fillersNeeded = tokenRuns.slice(0, -1).reduce((sum, run) => sum + run.sends + run.nftSends, 0)
    - 1 - tokenDeposits.length;
  const fillerCoins = fillersNeeded <= 0 ? [] : (await withoutIdentityOutputs(
    provider, await provider.getUtxosForLockingBytecode(options.callerLockingBytecode),
  ))
    .filter((utxo) => utxo.token === undefined
      && !(utxo.txid === options.callerUtxo.txid && utxo.vout === options.callerUtxo.vout))
    .slice(0, fillersNeeded);
  if (fillerCoins.length < fillersNeeded) {
    throw new FramedCallError(
      `entry "${functionName}" pays from ${tokenRuns.length} token runs, which need ${fillersNeeded} more tokenless `
      + `coins at the caller's lock between them, and it holds ${fillerCoins.length}`,
    );
  }

  // The fallback is reached by the call data of a value send, which no entry's selector names.
  const selectorPushes = entry.name === FALLBACK_ENTRY
    ? [valueSendCallData(artifact)]
    : entryArgumentPushes(entry, args, structs, functionName);
  // A sole-entry root does not push the selector. Callee frames still do: their arms equal-verify the salt.
  const argumentPushes = splitShard !== undefined && entry.name !== FALLBACK_ENTRY
    ? selectorPushes.slice(1)
    : selectorPushes;
  // The events, sends and hashes a loop of the entry repeats, as many as the loop turns over the call's own facts.
  let loopTurns: EntryLoopTurns;
  try {
    loopTurns = entryLoopTurns({
      artifact, functionName, args, stateValues: activationFacts.stateValues,
      selfAddress: deployed.address, senderAddress: options.callerLockingBytecode,
    });
  } catch (error) {
    if (error instanceof FramedLoopTurnsError) throw new FramedCallError(error.message);
    throw error;
  }
  // The compute side-cars the entry's keccak256 and recovery calls read, one per call after the master.
  // Every body finds the oracle by its pinned lock. A callee may already place the same live outpoint.
  const blockOracle = fetchedBlockOracle !== undefined && [...calleePlan?.utxos.values() ?? []].some(
    (utxo) => utxo.txid === fetchedBlockOracle.utxo.txid && utxo.vout === fetchedBlockOracle.utxo.vout,
  ) ? undefined : fetchedBlockOracle;
  const sideCars = await entrySideCars({
    provider,
    master: MASTER_ID,
    abiFunction: artifact.abi.find((candidate) => candidate.name === functionName)!,
    argumentPushes,
    leadingPushes: argumentPushes === selectorPushes ? 1 : 0,
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
        throw new FramedCallError(
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
        throw new FramedCallError(`${bodyLabel} makes a call, which this call path does not plan yet`);
      }
      if (publishedLoopEffects(external.artifact, body.name) !== undefined) {
        throw new FramedCallError(`${bodyLabel} emits, sends or hashes once per turn of a loop, which this call `
          + 'path does not plan for a paid contract yet');
      }
      const recipientCategory = hexToBin(external.categoryId);
      const set = await readFramedDeployment(provider, external.categoryId, layout);
      // The frames the entry's calls run on the same contract: its masters are theirs to run, so the payment takes
      // one they leave, and its records are theirs.
      const shared = calleePlan?.callees.filter((callee) => callee.categoryId === external.categoryId) ?? [];
      const outpoint = (utxo: Utxo): string => `${utxo.txid}:${utxo.vout}`;
      const taken = new Set(shared.flatMap((callee) => [...callee.utxos.values()].map(outpoint)));
      const recipientMaster = set.masters.find((utxo) => !taken.has(outpoint(utxo)));
      if (recipientMaster === undefined || set.records.length < layout.dataNftCount) {
        throw new FramedCallError(
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
        throw new FramedCallError(`${bodyLabel} sends to a contract, which this call path does not plan yet`);
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
        selector: valueSendCallData(external.artifact),
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
    throw new FramedCallError(
      `entry "${functionName}" pays one contract through two calls, which would need two of its masters to take value`,
    );
  }
  // A value call into a contract is a call made where the entry sends, so a mapping write beside it would need its
  // segments placed, as one beside any call does.
  if (payees.length > 0 && mappingRecords !== undefined) {
    throw new FramedCallError(
      `entry "${functionName}" writes ${mappingRecords.label} and makes `
      + `${(calleePlan?.calls.length ?? 0) + payees.length} external call(s), whose segments this call path does not `
      + 'place its writes in yet',
    );
  }
  // Each value call takes its place among the calls the entry makes: after the calls its artifact counts before the
  // send, and after the value calls of the earlier sends to contracts (spec 4b).
  const sendCallsBefore = published?.sendCallsBefore;
  if (calleePlan !== undefined && payees.length > 0 && sendCallsBefore === undefined) {
    throw new FramedCallError(
      `entry "${functionName}" sends value to a contract and makes ${calleePlan.calls.length} external call(s), and `
      + 'its artifact does not place the sends among the calls, so this call path does not plan both in one call yet',
    );
  }
  const typedCalls = calleePlan?.calls ?? [];
  // A typed call into a payable entry may carry value, which its own record holds to the amount the caller's code
  // computes (spec 4b): each such call starts from none, and the amount a site that carries value closes against is
  // learned, by the call's position among the typed calls.
  const payableCalls = typedCalls.flatMap((call, position) => {
    const callee = calleePlan?.callees.find((candidate) => candidate.master === call.callee);
    const abi = callee?.artifact.abi.find((candidate) => candidate.name === callee.entry);
    return (abi?.modifiers ?? []).includes('payable') ? [position] : [];
  });
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
      throw new FramedCallError(`${label} and the paid body writes a mapping, sends or emits, which this call path `
        + 'does not plan beside the callee frames yet');
    }
    if (payee.shared.some(calleeWrites)) {
      throw new FramedCallError(`${label} and a callee frame of it writes its records, whose views beside the paid `
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
        throw new FramedCallError(`entry "${functionName}" pays "${block.contract}", which its calls also reach, and `
          + `the frame "${frames[split]!.functionName}" reads its data records of it side by side, and no order of `
          + 'the records the other frames of that contract name keeps them so');
      },
    );
    return { ...block, masters: [...block.masters, receiveMasterId(index)], state };
  });
  const sharedPlan = calleePlan === undefined ? undefined : { ...calleePlan, blocks: calleeBlocks };
  const besideMasters = new Map<string, number>(payeeBlocks.filter((_block, index) => payees[index]!.shared.length > 0)
    .map((block) => [block, 1]));
  // The root master is another master of a same-category callee's block. The callee's fact counts it.
  const selfBlock = (calleePlan?.callees ?? []).find((callee) => callee.categoryId === categoryId)?.block;
  if (selfBlock !== undefined) besideMasters.set(selfBlock, (besideMasters.get(selfBlock) ?? 0) + 1);
  const besideCallees = { masters: besideMasters, startViews };

  // One block for the contract: its master and its side-cars, its validator, and every record it reads and writes;
  // then one block for each contract it calls, holding the masters its frames run on and the records they read, and
  // one for each other contract it pays, holding the master that runs its `receive()` and its records.
  // A same-category callee is another master of this contract. Its records are the root's, so it joins the
  // root's block. A second block of the same name is the same deployment placed twice.
  const ownCalleeBlocks = calleeBlocks.filter((block) => block.contract === artifact.contractName);
  const otherCalleeBlocks = calleeBlocks.filter((block) => block.contract !== artifact.contractName);
  const blocks: ContractBlock[] = [{
    contract: artifact.contractName,
    masters: [MASTER_ID, ...ownCalleeBlocks.flatMap((block) => block.masters)],
    validator: { id: VALIDATOR_ID, settles: [] },
    state: [...new Set([
      ...recordIds, ...mappingIds, ...ownCalleeBlocks.flatMap((block) => block.state),
    ])],
    recovery: {
      ...Object.assign({}, ...ownCalleeBlocks.map((block) => block.recovery ?? {})),
      ...(sideCars.ids.length === 0 && blockOracle === undefined ? {} : {
        [MASTER_ID]: [...sideCars.ids, ...(blockOracle === undefined ? [] : [BLOCK_ORACLE_INPUT])],
      }),
    },
  }, ...otherCalleeBlocks, ...payees.flatMap((payee, index) => (payee.shared.length > 0 ? [] : [{
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
  // The token runs lead the trailing region, so every other trailing output starts past them.
  const trailingBase = layout.participantCount + tokenRunLength;
  // A run's container is the user input at the index its recreation leads the run with: the other user inputs fill
  // the indices between runs and follow the last container.
  const runStarts = tokenRuns.map((_run, at) => layout.participantCount
    + tokenRuns.slice(0, at).reduce((sum, earlier) => sum + tokenRunWidth(earlier), 0));
  const placeUserInputs = (others: readonly string[]): ReadonlyMap<string, number> => {
    const placed = new Map<string, number>();
    const queue = [...others];
    let at = layout.participantCount;
    runStarts.forEach((start, run) => {
      while (at < start) {
        const filler = queue.shift();
        if (filler === undefined) {
          throw new FramedCallError(
            `entry "${functionName}" pays from ${tokenRuns.length} token runs, and the call has too few other inputs `
            + 'to place their containers',
          );
        }
        placed.set(filler, at++);
      }
      tokenRuns[run]!.containers.forEach((_utxo, position) => placed.set(tokenContainerInputId(run, position), at++));
    });
    for (const id of queue) placed.set(id, at++);
    return placed;
  };
  /** The sends a run has learned: the root's from its own close, a callee's from the callee's. */
  const runSends = (run: TokenRun, rootSends: readonly LearnedRun[], callees: CalleeValues): LearnedRun => (
    run.sends + run.nftSends === 0 ? unlearnedRun(0, 0)
      : run.master === MASTER_ID ? rootSends[run.run]!
        : callees.tokenSends?.get(run.master)?.[run.run] ?? unlearnedRun(run.sends, run.nftSends));
  /**
   * The containers each run's NFT sends are made from, in send order, by run key, chosen over every NFT container of the
   * run's contract for the category, none twice: an immutable NFT of the send's commitment, else a mutable one. A
   * contract that holds a minting NFT of the category mints its sends instead, and a category with a send still
   * unlearned is left out.
   */
  const nftBacking = (rootSends: readonly LearnedRun[], callees: CalleeValues): ReadonlyMap<string, readonly Utxo[]> => {
    const backing = new Map<string, readonly Utxo[]>();
    for (const group of new Set(tokenRuns.map((run) => run.group))) {
      const runs = tokenRuns.filter((run) => run.group === group && run.nftSends > 0);
      const held = runs[0]?.nftContainers ?? [];
      if (held.some((container) => container.token!.nft!.capability === 'minting')) continue;
      const learned = runs.map((run) => runSends(run, rootSends, callees).nfts);
      if (learned.flat().some((nft) => nft.commitment === undefined || nft.capability === undefined)) continue;
      const used = new Set<string>();
      runs.forEach((run, at) => backing.set(run.key, learned[at]!.map((nft) => {
        const free = (container: Utxo): boolean => !used.has(outpointOf(container));
        const source = held.find((container) => free(container) && container.token!.nft!.capability === 'none'
          && nft.capability === 0 && container.token!.nft!.commitment === binToHex(nft.commitment!))
          ?? held.find((container) => free(container) && container.token!.nft!.capability === 'mutable'
            && nft.capability! <= 1);
        if (source === undefined) {
          throw new FramedCallError(`entry "${functionName}" sends an NFT of category ${run.category} that no `
            + 'container of its contract can make');
        }
        used.add(outpointOf(source));
        return source;
      })));
    }
    return backing;
  };
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
      if (emit === undefined) throw new FramedCallError(`entry "${functionName}" publishes no emit ${emitIndex}`);
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
  const eventIndices = emits.map((_emit, position) => trailingBase + position);
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
  const payeeEventBases = payees.map((_payee, index) => trailingBase + emits.length + calleeEvents
    + payees.slice(0, index).reduce((count, earlier) => count + earlier.emits.length, 0));
  const markerIndex = trailingBase + emits.length + calleeEvents
    + payees.reduce((count, payee) => count + payee.emits.length, 0);
  const sendIndices = Array.from({ length: sendCount }, (_unused, position) => markerIndex + 1 + position);
  const sendLockSentinels = sendIndices.map((_index, position) => encodeLockingBytecodeP2pkh(sha256(
    new TextEncoder().encode(`framed send lock\u0000${artifact.contractName}\u0000${entry.name}\u0000${position}`),
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
      `framed send lock\u0000${payee.artifact.contractName}\u0000${payee.entryName}\u0000${position}`,
    )).slice(0, 20))));
  const payeeSendAmountSentinels = payees.map((payee, index) => Array.from({ length: payee.sendCount },
    (_unused, position) => SEND_AMOUNT_SENTINEL + BigInt(1_000 * (index + 1) + position)));
  // An entry that reads its own balance reads the containers its transaction spends, so it spends every one.
  const readsBalance = (
    (artifact.composition as { balanceReaders?: readonly string[] } | undefined)?.balanceReaders ?? []
  ).includes(`${artifact.contractName}.${entry.name}()`);
  const containers = entry.transfers.length > 0 || readsBalance || payableCalls.length > 0
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
        throw new FramedCallError(
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
      throw new FramedCallError(
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
      throw new FramedCallError(
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
    if (typeof spans === 'string') throw new FramedCallError(`entry "${functionName}": ${spans}`);
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
    + payableCalls.length * (1 + (calleePlan?.learnable ?? 0))
    + (returnsValue ? 1 : 0) + rootTokenRuns.reduce((sum, run) => sum + 2 * run.sends + 3 * run.nftSends, 0) + 3;

  const buildPlan = (
    learnedViews: readonly (Uint8Array | undefined)[],
    learnedRetval: Uint8Array | undefined,
    learnedEvents: readonly (Uint8Array | undefined)[],
    learnedSends: readonly { readonly lock?: Uint8Array; readonly amount?: bigint }[],
    learnedCallAmounts: readonly (bigint | undefined)[],
    learnedPayees: readonly PayeeLearned[],
    learnedCallees: CalleeValues,
    typedCallValues: ReadonlyMap<number, bigint>,
    learnedTokenSends: readonly LearnedRun[],
  ): CompositionDraftPlan => {
    const paying = payFromContainers([
      ...learnedSends.map((send) => send.amount), ...learnedCallAmounts, ...typedCallValues.values(),
    ]);
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
    // publishes for it - beside a run of loops too, even one that turns no time: a write declared in every segment
    // would create its record again, or start its spent record over, in each segment after the one it lands in.
    const truncated = calleePlan?.blocked !== undefined;
    const mappingSegments = laid === undefined ? undefined
      : mappingSpans !== undefined
        ? placeRecordsBySpan(laid.entries, ((): readonly (LoopRecordSpan | undefined)[] => {
          const placed = laid.spans(segmentCount - 1, callBases, truncated);
          return mappingSpans.map((span, at) => span ?? placed[at]);
        })(), segmentCount)
        : segmentCount > 1 && mappingRecords?.loopRun === undefined
          ? laid.place(segmentCount - 1, callBases, truncated) : undefined;
    const segment = (_unused: unknown, position: number): DraftRecordEntry[] => [
      ...declared.map((record, at): DraftRecordEntry => {
        const index = recordIndex(record.id);
        const nftIndex = frameDataRecordIndices(artifact, entry.name)[at];
        const writes = (published?.writeSegments ?? [])
          .filter((write) => write.record === nftIndex && write.turns === undefined);
        // A segment after the record's own write only holds it. Both sides carry the view the chain left, the
        // same way a callee's later segment does: leaving the end unstated would ask the body to compute it
        // again from the value it wrote before the call.
        if (writes.length > 0 && (published?.writeSegments ?? [])
          .filter((write) => write.record === nftIndex).every((write) => write.turns === undefined)) {
          const atSegment = (segmentIndex: number | 'last'): number => (
            segmentIndex === 'last' ? segmentCount - 1 : segmentIndex);
          const positions = writes.map((write) => atSegment(write.segment));
          const first = Math.min(...positions);
          if (position < first) {
            return { in: index, out: index, viewIn: record.commitment, viewOut: record.commitment };
          }
          if (positions.includes(position)) {
            return position === first
              ? { in: index, out: index, viewIn: record.commitment }
              : { in: index, out: index, viewIn: 'carried' };
          }
          return { in: index, out: index, viewIn: 'carried', viewOut: 'carried' };
        }
        if (keptUntilLast[at] === true && position < segmentCount - 1) {
          return { in: index, out: index, viewIn: record.commitment, viewOut: record.commitment };
        }
        return { in: index, out: index, viewIn: position === 0 ? record.commitment : 'carried' };
      }),
      ...(mappingSegments?.[position] ?? laid?.entries ?? []),
    ];
    // The callees' events follow the entry's own, and the records their writes create follow the entry's.
    const calleeCreatedBase = createdBase + (laid?.trailingOutputs.length ?? 0);
    const callees = sharedPlan === undefined ? undefined : calleeFrames({
      planned: sharedPlan, layout, rootMaster: MASTER_ID, rootAddress: deployed.address, origin: CALLER_ID,
      values: learnedCallees, eventBase: trailingBase + emits.length,
      createdBase: calleeCreatedBase, recordAmount: validator.satoshis,
      maximumCommitmentBytes, beside: besideCallees,
      callValues: new Map([...typedCallValues].map(([position, amount]) => [typedCalls[position]!.callee, amount])),
      releasedLock: options.callerLockingBytecode,
      // A same-category callee shares this master. Counting the root makes the record it writes chain into the
      // segment after the call.
      ...(selfBlock === undefined ? {} : { rootBlock: selfBlock }),
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
      if (position < typedCalls.length) {
        const carried = typedCallValues.get(position);
        rootCalls.push(carried === undefined ? typedCalls[position]! : { ...typedCalls[position]!, value: carried });
      }
    }
    // Each typed call that carries value pays it into a container of the callee's contract, which the callee's frame
    // takes as `msg.value`.
    const calleeContainers: DraftSourceOutput[] = [...typedCallValues].map(([position, amount]) => ({
      lockingBytecode: satoshiContainerLockingBytecode(
        calleePlan!.callees.find((callee) => callee.master === typedCalls[position]!.callee)!.categoryId,
      ),
      valueSatoshis: amount,
    }));
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
        // A same-category callee is another master of this contract. The fact counts the root plus those.
        mastersOfContract: 1 + (calleePlan?.callees ?? [])
          .filter((callee) => callee.categoryId === categoryId).length,
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
      // A root carries call data when it has a selector to dispatch, or arguments a sole entry still reads.
      // The long mapping values its writes read, which its block lists.
      ...(laid?.values === undefined ? {} : { values: laid.values }),
      // A root that carries call data is one a dispatcher selects an entry of, or a sole entry's arguments.
      dispatches: argumentPushes.length > 0,
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
      ...Object.fromEntries(fillerCoins.map((utxo, index) => [fillerCoinInputId(index), {
        source: { lockingBytecode: options.callerLockingBytecode, valueSatoshis: utxo.satoshis },
        unlockingBytecode: callerUnlocking(),
      }])),
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
    if (blockOracle !== undefined) inputs[BLOCK_ORACLE_INPUT] = blockOracle.input;
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
    // A token run's container is recreated by the run, and a deposit's coin by the deposit's outputs.
    tokenRuns.forEach((run, index) => run.containers.forEach((container, position) => {
      inputs[tokenContainerInputId(index, position)] = {
        source: {
          lockingBytecode: run.lockingBytecode,
          valueSatoshis: container.satoshis,
          token: draftToken(container.token!),
        },
        unlockingBytecode: framedTokenContainerUnlockingBytecode(
          run.contractCategoryId, run.category, indexOfParticipant(run.master),
        ),
        consumed: true,
      };
    }));
    tokenDeposits.forEach((deposit, index) => {
      const held = deposit.utxo.token!;
      inputs[tokenDepositInputId(index)] = {
        source: {
          lockingBytecode: deposit.unlocker.generateLockingBytecode(),
          valueSatoshis: deposit.utxo.satoshis,
          token: draftToken(held),
        },
        unlockingBytecode: callerUnlocking(),
        consumed: true,
      };
    });
    // A run whose NFT sends are made from other containers than the last it spends is planned again with those.
    const backing = nftBacking(learnedTokenSends, learnedCallees);
    const reassigned = new Map([...backing].filter(([key, sources]) => {
      const spent = tokenRuns.find((run) => run.key === key)!.containers
        .filter((container) => container.token!.nft !== undefined).map(outpointOf);
      return spent.join() !== sources.map(outpointOf).join();
    }).map(([key, sources]) => [key, sources.map(outpointOf)] as const));
    if (reassigned.size > 0) throw new TokenNftAssignment(reassigned);
    const released = new Set([...backing.values()].flat().map(outpointOf));
    // The run's first container, recreated with what its sends leave, and the others drained (a tokenless output where
    // nothing is left), then its sends, each from its sentinel until the body's pin hands back what it computed.
    const tokenRunOutputs: DraftSourceOutput[] = tokenRuns.flatMap((run, index) => {
      const { sends, nfts } = runSends(run, learnedTokenSends, learnedCallees);
      const paid = sends.every((send) => send.amount !== undefined)
        ? sends.reduce((sum, send) => sum + send.amount!, 0n) : 0n;
      if (paid > run.held) {
        if (run.spare > 0) throw new TokenRunShortfall(run.key, run.containers.length + 1);
        throw new FramedCallError(
          `entry "${functionName}" sends ${paid} tokens of category ${run.category}, and the containers it spends hold `
          + `${run.held}`,
        );
      }
      // Once its sends are learned, a run spends the containers that cover them, which keeps the transaction's inputs,
      // and every input-walking check's cost, down, and folds the smallest few besides into the one it keeps.
      const fungible = run.containers.filter((container) => container.token!.nft === undefined);
      if (run.sends > 0 && sends.every((send) => send.amount !== undefined)
        && shape.tokenContainerCounts?.has(run.key) !== true && fungible.length > 1) {
        let covering = 0;
        for (let held = 0n; covering < fungible.length && held < paid; covering += 1) {
          held += fungible[covering]!.token!.amount;
        }
        const keep = Math.max(covering, 1);
        if (keep + Math.min(foldedContainers, fungible.length - keep) < fungible.length) {
          throw new TokenRunShortfall(run.key, keep);
        }
      }
      const kept = run.held - paid + tokenDeposits.reduce((sum, deposit, at) =>
        sum + (depositRuns[at] === index ? deposit.amount : 0n), 0n);
      const token = (amount: bigint): DraftSourceOutput['token'] => ({ category: hexToBin(run.category), amount });
      const keepsNft = (container: Utxo): boolean => container.token!.nft !== undefined
        && !released.has(outpointOf(container));
      // The fungible remainder rides on a kept NFT the VM still sees beside it, or else on a fungible container.
      const holding = run.containers.findIndex((container) => keepsNft(container) && !blankNft(container.token));
      const holder = holding >= 0 ? holding
        : kept > 0n ? run.containers.findIndex((container) => container.token!.nft === undefined) : -1;
      if (kept > 0n && holder < 0) {
        throw new FramedCallError(`entry "${functionName}" leaves ${kept} tokens of category ${run.category} with no `
          + 'container it spends to keep them in');
      }
      return [
        ...run.containers.map((container, at): DraftSourceOutput => {
          const nft = container.token!.nft;
          if (!keepsNft(container) && at !== holder) return { lockingBytecode: Uint8Array.of(0x6a), valueSatoshis: 0n };
          return {
            lockingBytecode: run.lockingBytecode,
            valueSatoshis: container.satoshis,
            token: {
              category: hexToBin(run.category), amount: at === holder ? kept : 0n,
              ...(keepsNft(container) ? { nft: { capability: nft!.capability, commitment: hexToBin(nft!.commitment) } }
                : {}),
            },
          };
        }),
        // A run lists its NFT sends first, then its fungible sends (spec 4b).
        ...nfts.map((nft, position) => ({
          lockingBytecode: nft.lock ?? run.sentinels.nftLocks[position]!,
          valueSatoshis: TOKEN_OUTPUT_SATOSHIS,
          token: {
            category: hexToBin(run.category), amount: 0n,
            nft: {
              capability: nftCapabilityName(nft.capability),
              commitment: nft.commitment ?? run.sentinels.nftCommitments[position]!,
            },
          },
        })),
        ...sends.map((send, position) => ({
          lockingBytecode: send.lock ?? run.sentinels.locks[position]!,
          valueSatoshis: TOKEN_OUTPUT_SATOSHIS,
          token: token(send.amount ?? run.sentinels.amounts[position]!),
        })),
      ];
    });
    // A deposit pays its amount into the first container a run spends of its contract's for its coin's category, or
    // else into a new container, and returns the coin's remainder.
    const depositOutputs: DraftSourceOutput[] = tokenDeposits.flatMap((deposit, index) => {
      const held = deposit.utxo.token!;
      const token = (amount: bigint): DraftSourceOutput['token'] => ({ category: hexToBin(held.category), amount });
      return [
        ...(depositRuns[index]! >= 0 ? [] : [{
          lockingBytecode: framedTokenContainerLockingBytecode(depositTargets[index]!, held.category),
          valueSatoshis: TOKEN_OUTPUT_SATOSHIS,
          token: { ...draftToken(held), amount: deposit.amount },
        }]),
        ...(held.amount === deposit.amount ? [] : [{
          lockingBytecode: options.callerLockingBytecode,
          valueSatoshis: TOKEN_OUTPUT_SATOSHIS,
          token: token(held.amount - deposit.amount),
        }]),
      ];
    });
    for (const spent of payeeSpent) {
      const payee = payees[spent.index]!;
      inputs[spent.id] = {
        source: { lockingBytecode: satoshiContainerLockingBytecode(payee.categoryId), valueSatoshis: spent.utxo.satoshis },
        unlockingBytecode: satoshiContainerUnlockingBytecode(payee.categoryId, recordIndex(receiveMasterId(spent.index))),
        consumed: true,
      };
    }
    // A contract the calls enter more than once, a frame of which writes its nodes, spends each node once while each
    // frame declares it as its own plan saw it: the declarations are chained in the order the validator walks the
    // frames, as the hop chains them, and a node's input, or the output an earlier frame created it at, carries the
    // view its chain ends at. A record the entry or a contract it pays creates is that frame's own write, so the walk
    // keeps the view it declares.
    const ownCreated = [masterDraft, ...payeeDrafts].flatMap((frame) => frame.segments.flat())
      .filter((declaration) => declaration.in === INDEX_NONE);
    // A data record the root writes in a segment the artifact names is a chain transition. The walk carries
    // that segment's unstated end into a frame of the same contract below the call.
    const nftIndices = frameDataRecordIndices(artifact, entry.name);
    const rootWriteTransitions = callees?.chain === undefined ? [] : masterDraft.segments.flatMap(
      (declarations, segmentIndex) => declarations.filter((declaration) => {
        if (declaration.viewOut !== undefined || declaration.viewIn === 'carried') return false;
        if (declaration.in === INDEX_NONE || !callees.chain!.nodes.has(declaration.in)) return false;
        const at = declared.findIndex((record) => recordIndex(record.id) === declaration.in);
        if (at < 0) return false;
        const nftIndex = nftIndices[at];
        return (published?.writeSegments ?? []).some((write) => write.turns === undefined
          && write.record === nftIndex
          && (write.segment === segmentIndex
            || (write.segment === 'last' && segmentIndex === masterDraft.segments.length - 1)));
      }),
    );
    const chain = callees?.chain === undefined ? undefined : chainSharedNodeViews(
      [masterDraft, ...callees.masters, ...payeeDrafts], MASTER_ID, callees.chain.nodes,
      new Set([...callees.chain.writes, ...ownCreated, ...rootWriteTransitions]),
      new Map(), false, callees.chain.relinks,
    );
    if (chain !== undefined) withChainEnds(layout.participants, chain.ends, inputs);
    const calleeCreated = chain === undefined
      ? callees?.createdOutputs ?? [] : withCreatedChainEnds(callees!.createdOutputs, calleeCreatedBase, chain.createdEnds);

    return {
      blocks,
      // The chain's own time, read from the provider: a body that reads the transaction's locktime sees it.
      locktime: providerUnixLocktime(options.provider as { getBlockTime?: () => number }),
      // A stated locktime means nothing to `OP_CHECKLOCKTIMEVERIFY` on a final input, and the builder's own
      // default is non-final, so the call states the same rather than leaving the composer's final default.
      sequenceNumber: 0xfffffffe,
      userInputs: [...placeUserInputs([
        CALLER_ID,
        ...fillerCoins.map((_utxo, index) => fillerCoinInputId(index)),
        ...paying.spent.map((_utxo, position) => containerInputId(position)),
        ...payeeSpent.map((spent) => spent.id),
        ...tokenDeposits.map((_deposit, index) => tokenDepositInputId(index)),
      ])].map(([id, index]) => ({ id, index })),
      ...(tokenRuns.length === 0 ? {} : { tokenRuns: tokenRuns.map(tokenRunWidth) }),
      masters: chain?.masters ?? [masterDraft, ...(callees?.masters ?? []), ...payeeDrafts],
      inputs,
      ...(sideCars.computedWitnesses.length === 0 ? {} : { computedWitnesses: sideCars.computedWitnesses }),
      trailingOutputs: [
        ...tokenRunOutputs,
        ...eventOutputs(learnedEvents), ...(callees?.eventOutputs ?? []),
        ...payeeLaid.flatMap((payeeLaidOut) => payeeLaidOut.eventOutputs),
        ...sendOutputs, ...payeeRuns,
        ...(laid?.trailingOutputs ?? []), ...calleeCreated,
        ...payeeLaid.flatMap((payeeLaidOut) => payeeLaidOut.mapping?.trailingOutputs ?? []),
        // The contract's own container, when no send precedes it: the change its calls leave, or the value it takes.
        ...(sendCount === 0 ? ownContainer : []),
        // Each contract it pays takes the value into a container of its own, the one its sends follow if it sends.
        ...payees.flatMap((payee, index) => (payee.sendCount > 0 ? [] : [{
          lockingBytecode: satoshiContainerLockingBytecode(payee.categoryId), valueSatoshis: callValue(index),
        }])),
        ...calleeContainers,
        ...depositOutputs,
      ],
      validator: {
        id: VALIDATOR_ID,
        covers: [...new Set([...(calleePlan?.contracts ?? []), ...payeeBlocks])]
          .filter((name) => name !== artifact.contractName),
        // A same-category callee runs on the root's records, so its contract's settlement lists every state input
        // the root's block spends, the root frame's own records and nodes among them.
        settles: (callees?.settles ?? []).map((settled) => (bytesEqual(settled.category, category)
          ? { ...settled, stateInputs: blocks[0]!.state } : settled)),
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
  let learnedTokenSends: readonly LearnedRun[] = rootTokenRuns.map((run) => unlearnedRun(run.sends, run.nftSends));
  let learnedCallAmounts: readonly (bigint | undefined)[] = payees.map(() => undefined);
  // The value each typed call carries, by its position among the typed calls, once its site's close handed it back.
  let learnedTypedValues: ReadonlyMap<number, bigint> = new Map();
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
  // Whether the guards the entry's own conditions put on its calls are decided from the results this plan learned.
  let armsDecided = false;
  const frameArtifacts = [artifact, ...(calleePlan?.artifacts ?? []), ...payees.map((payee) => payee.artifact)];
  let settled = false;
  // The decoder's refusal of a result only a frame the derivation never entered recorded (`decodedCalleeResults`): the
  // plan is settled as it stands and the refusal stands only when the verdicts name no contract reason.
  let unlearnedResult: FramedReadError | undefined;
  // A record's end view is learned up to the commitment the deployment itself holds: a contract compiled for a wider
  // commitment keeps a record past the composer's default of 128 bytes, and a view the composer would not learn leaves
  // the record's close comparing the body's commitment with a placeholder.
  const composeCandidate = (plan: CompositionDraftPlan): ReturnType<typeof createComposedDerivationHost> => {
    bumpFramedCounter('hosts');
    const composed = createComposedDerivationHost({
      vm: machine, artifacts: frameArtifacts, plan, maximumCommitmentBytes,
    });
    // A plan stopped before a site states the calls before it only, of the entry and of every frame it stops inside,
    // so their calls from there on are declared unbound: a body that holds its call count runs to the site and binds
    // the calls before it, as the execution does, and stops on the first unbound record.
    if (calleePlan?.blocked !== undefined) {
      declareUnstatedCalls(composed.draft, artifact, MASTER_ID);
      for (const callee of calleePlan.callees) {
        if (callee.truncated === true) declareUnstatedCalls(composed.draft, callee.artifact, callee.master);
      }
    }
    return composed;
  };
  // While a callee still owes a value, the frame `learnCalleeValue` judges first is judged from the composition derived
  // through that frame and no further (`scopedCalleeFrame`), as the hop judges each frame from its own derivation
  // rather than the whole composition's (`settleCallees`): nothing that runs after the frame is read by it, so the
  // frames after it are not derived again for each value it hands back. Up to the frame, the derivation is the one
  // continuous depth-first derivation the whole composition makes, so a record a frame before it wrote is learned
  // exactly as before. A frame that hands nothing back this way is judged again from the whole composition, as is
  // every frame on the last attempt, whose draft the verdicts below read; such a frame is not scoped again.
  const unscopedFrames = new Set<string>();
  const scopedCalleeValue = (plan: CompositionDraftPlan): CalleeValues | undefined => {
    if (calleePlan === undefined) return undefined;
    const frameMaster = scopedCalleeFrame(calleePlan, calleeValues);
    if (frameMaster === undefined || unscopedFrames.has(frameMaster)) return undefined;
    let answered: CalleeValues | undefined;
    try {
      const { host, draft: scoped } = composeCandidate(plan);
      bumpFramedCounter('scopedDerivations');
      if (deriveThroughFrame([...payeeRequests, root], host, frameMaster, { onCalleeStall: () => undefined })) {
        answered = learnCalleeValue({
          planned: calleePlan, draft: scoped, host, vm: machine, maximumCommitmentBytes, values: calleeValues,
          firstOnly: true, tokenRunCategories,
        });
      }
    } catch {
      // A refusal on the way is the whole composition's to name: it is derived below and refuses as it always did.
      answered = undefined;
    }
    if (answered === undefined) unscopedFrames.add(frameMaster);
    return answered;
  };
  // The callee frames are settled one frame at a time, as the hop settles its own (`settleCallees`): deepest first,
  // each frame judged from the derivation of its own subtree against what the frames below it handed back, instead of
  // the composition being derived again, from the root, for every value one of them hands back. The settle starts
  // from what the call learned so far, and what it learns is the callee values the rest of this loop reads. A frame
  // it does not settle - one whose refusal it deferred, or whose budget ran out - still owes its values, which are
  // learned from the composition as before (`scopedCalleeValue`, `learnCalleeValue`), as they are when a settle
  // refuses, learns nothing new or leaves a value owed. A value that resets the callee values (a typed call's) is
  // settled again.
  let perFrame: 'ready' | 'stalled' | 'unavailable' = 'ready';
  const learnedCalleeCount = (values: CalleeValues): number => values.retvals.size + (values.writeValues?.size ?? 0)
    + [...values.views.values(), ...values.events.values()]
      .reduce((count, known) => count + known.filter((item) => item !== undefined).length, 0);
  // A callee frame that re-enters the root's own contract starts from what the root wrote before the call that leads
  // to it, so the root is derived up to that call first (`deriveReentryWriters`).
  const enclosingRoot = (plan: CompositionDraftPlan): EnclosingRoot | undefined => {
    const rootMaster = plan.masters.find((candidate) => candidate.master === MASTER_ID);
    return rootMaster === undefined ? undefined
      : { request: root, calls: rootMaster.calls, recordCategory: binToHex(category) };
  };
  const settleCalleeFrames = async (
    planned: PlannedCallees,
  ): Promise<CalleeValues | EnclosingValueLearned | undefined> => {
    try {
      const settlement = await settleCallees({
        vm: machine,
        artifacts: frameArtifacts,
        callees: planned.callees,
        maximumCommitmentBytes,
        seed: calleeSettlementSeed(planned, calleeValues, maximumCommitmentBytes),
        // A frame a stopped plan states only the first calls of is never settled on that plan.
        only: new Set(planned.callees.flatMap((callee, index) => (callee.truncated === true ? [] : [index]))),
        deferFailures: true,
        compose: composeCandidate,
        enclosingRoot,
        judgeSubtreeViewsOnly: true,
        returnOnWriteValue: true,
        retvalPlaceholder: calleeRetvalPlaceholder,
        judgeDerivedFrames: true,
        planFor: (retvals, views, writeValues, events) => buildPlan(
          learnedViews, learnedRetval, learnedEvents, learnedSends, learnedCallAmounts, learnedPayees,
          { retvals, views, events, ...(writeValues.size === 0 ? {} : { writeValues }) }, learnedTypedValues,
          learnedTokenSends,
        ),
      });
      return calleeValuesOfSettlement(planned, settlement, maximumCommitmentBytes);
    } catch (error) {
      if (error instanceof EnclosingValueLearned) return error;
      // A frame the settle cannot judge is the composition's to name: it is derived below as it always was.
      return undefined;
    }
  };
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    bumpFramedCounter('attempts');
    if (perFrame === 'stalled' && calleeValues === NO_CALLEE_VALUES) perFrame = 'ready';
    if (calleePlan !== undefined && perFrame === 'ready' && calleeValuesOwed(calleePlan, calleeValues)) {
      const frames = await settleCalleeFrames(calleePlan);
      if (frames instanceof EnclosingValueLearned) {
        // As below: a chunking value a frame's close exposed plans the call again from it, once.
        if (prior.writeValues.has(frames.master)) {
          perFrame = 'unavailable';
        } else {
          return callInShape(options, shape, {
            ...prior, writeValues: new Map([...prior.writeValues, [frames.master, frames.value]]),
          });
        }
      } else if (frames === undefined) {
        perFrame = 'unavailable';
      } else {
        const exposed = [...frames.writeValues ?? []].filter(([namedMaster]) => !prior.writeValues.has(namedMaster));
        if (exposed.length > 0) {
          return callInShape(options, shape, { ...prior, writeValues: new Map([...prior.writeValues, ...exposed]) });
        }
        // A settle that learns nothing new, or leaves a value owed, is not run again before the values are reset: the
        // frames it could not settle are left to the composition, which a settle seeded the same way would not move.
        if (learnedCalleeCount(frames) <= learnedCalleeCount(calleeValues) || calleeValuesOwed(calleePlan, frames)) {
          perFrame = 'stalled';
        }
        calleeValues = frames;
      }
    }
    const plan = buildPlan(
      learnedViews, learnedRetval, learnedEvents, learnedSends, learnedCallAmounts, learnedPayees, calleeValues,
      learnedTypedValues, learnedTokenSends,
    );
    const scopedAnswer = attempt < maximumAttempts - 1 ? scopedCalleeValue(plan) : undefined;
    if (scopedAnswer !== undefined) {
      // As below: a chunking value a callee's close exposed plans the call again from it.
      const exposed = [...scopedAnswer.writeValues ?? []].filter(([namedMaster]) => !prior.writeValues.has(namedMaster));
      if (exposed.length > 0) {
        return callInShape(options, shape, { ...prior, writeValues: new Map([...prior.writeValues, ...exposed]) });
      }
      calleeValues = scopedAnswer;
      continue;
    }
    const { host, draft: candidate } = composeCandidate(plan);
    draft = candidate;
    try {
      // A callee whose own derivation stalls is left as far as it got and its caller resumes, as the hop settles its
      // callees and keeps going past one that refuses (`settleCallees`): a frame the plan states past the entry's own
      // revert closes nothing, and the entry still runs to that revert, binding the calls it makes before it, so the
      // machine's verdict below names its reason rather than the first record the stall left unbound.
      bumpFramedCounter('derivations');
      completed = deriveComposition([...payeeRequests, root], host, {
        onCalleeStall: () => undefined,
      }).completed;
    } catch (error) {
      // A body that refuses before its segment closes never hands the derivation a record view, so the driver stops.
      // The machine is asked about the draft as it stands below, and the refusing participant's verdict carries the
      // objection.
      if (!(error instanceof FramedComposerError) || error.code !== 'FRAMED_DERIVATION_STALLED') throw error;
    }
    // A callee answers before the frame that reads its result: its own close hands back what it returned, each
    // payload it emitted and each node view it wrote, deepest first. While one cannot, every frame above it computed
    // from a candidate, so nothing is read from them and the machine's verdicts below name the frame that refused.
    if (calleePlan !== undefined) {
      const answered = learnCalleeValue({
        planned: calleePlan, draft: candidate, host, vm: machine, maximumCommitmentBytes, values: calleeValues,
        tokenRunCategories,
      });
      if (answered !== undefined) {
        // A chunking value a callee's close exposed sizes the run of chunk records its write takes, so the call is
        // planned again from it, as the hop plans its callee's write again (`planCalleeWrites`). A value an earlier
        // pass already planned from is not planned from twice: its frame then refuses as it stands.
        const exposed = [...answered.writeValues ?? []].filter(([namedMaster]) => !prior.writeValues.has(namedMaster));
        if (exposed.length > 0) {
          return callInShape(options, shape, { ...prior, writeValues: new Map([...prior.writeValues, ...exposed]) });
        }
        calleeValues = answered;
        continue;
      }
      if (calleeValuesOwed(calleePlan, calleeValues)) {
        settled = true;
        break;
      }
      // A plan stopped before a site is settled up to that site only: the frames of the calls before it have
      // answered, so the site's earlier results are decoded from what they returned and the call is planned again
      // from them. Each stop learns a result no earlier one did, so the stops end.
      const stop = calleePlan.blocked;
      if (stop !== undefined) {
        const reached = decodedCalleeResults(
          candidate, calleeValues.retvals, (retvals) => reachedCallResults(calleePlan, stop, retvals));
        if ('unlearned' in reached) {
          unlearnedResult = reached.unlearned;
          settled = true;
          break;
        }
        const { results } = reached;
        if ([...results.keys()].every((key) => prior.reached.has(key))) {
          throw new FramedCallError(
            `entry "${functionName}": ${stop.where} reads the result of the earlier call(s) `
            + `${stop.producers.join(', ')}, and settling them returned nothing the call could decode, so the call `
            + 'cannot be planned from it',
          );
        }
        return callInShape(options, shape, { ...prior, reached: new Map([...prior.reached, ...results]) });
      }
      // A call the entry guards on an earlier call's result is stated as the results the plan was made from decide
      // it: the first plan holds none and states no such call. Once the callees answered, what they returned decides
      // the guards again, as the hop decides them (`planAndSettleHop`): a plan whose sites those results leave as they
      // are is the execution's, and one they change is planned again from them, at most once per result a guard
      // reads.
      if (calleePlan.conditionalProducers.length > 0 && !armsDecided) {
        const produced = decodedCalleeResults(
          candidate, calleeValues.retvals, (retvals) => producedCallResults(calleePlan, retvals));
        if ('unlearned' in produced) {
          unlearnedResult = produced.unlearned;
          settled = true;
          break;
        }
        const returns = produced.results;
        const decided = await planCallees(returns);
        if (decided !== undefined && decided.blocked === undefined && samePlannedSites(decided, calleePlan)) {
          armsDecided = true;
        } else {
          if (prior.passes >= calleePlan.conditionalProducers.length) {
            throw new FramedCallError(
              `entry "${functionName}": the calls an earlier call's result guards did not settle: the call was planned `
              + `${prior.passes + 1} time(s) without its sites stopping`,
            );
          }
          return callInShape(options, shape, { ...prior, returns, passes: prior.passes + 1 });
        }
      }
    }
    // A void entry that writes no mapping, emits nothing and calls no payable entry leaves nothing to learn: the plan
    // is the one just derived, accepted or refused.
    if (!returnsValue && learningCandidates.length === 0 && emits.length === 0 && sendCount === 0
      && payees.length === 0 && payableCalls.length === 0 && tokenRunLength === 0) {
      settled = true;
      break;
    }
    // A value the body computes reads a declaration and closes against it, and the failing close leaves the
    // declaration on the stack beside the value the body computed. The frame's `retval` is one such declaration —
    // whichever operand carries the candidate this call wrote — and a mapping node's end view is another, named by
    // the candidate the close matched. Learning the value and rebuilding is what states it. The root's program is read
    // here, never resumed at a site, so the draft first learns the views it left unstated, as the hop does before it
    // judges its own frame: otherwise the run stops on an unstated view's placeholder, a close this call cannot name.
    candidate.learnUnstatedViews();
    const rootProgram = candidate.programFor(MASTER_ID);
    // A run the records' lengths size was laid at the width the live records state, and the body's close, which
    // precedes the run's pin, has now stated the length it writes. A length that lays the run at another width plans
    // the call again from the records as written, as the hop plans its entry's writes again from a learned record.
    // The body computes that length from the live run and the call alone, so the plan made from it states it, and the
    // call is planned again at most once.
    const sizedRun = mappingRecords?.sizedRun;
    if (sizedRun !== undefined && prior.writtenRecords === undefined) {
      const ends = rootProgram.transaction?.outputs;
      const writtenRecords = records.map((record) => {
        const end = declared.includes(record) ? ends?.[recordIndex(record.id)]?.token?.nft?.commitment : undefined;
        return end === undefined ? record.commitment : Uint8Array.from(end);
      });
      const width = declaredRunWidth(artifact, sizedRun.variable, writtenRecords);
      if (width !== undefined && width !== sizedRun.chunks) {
        return callInShape(options, shape, { ...prior, writtenRecords });
      }
    }
    const reading = readComputedDeclaration({
      vm: machine,
      program: rootProgram,
      maximumCommitmentBytes,
    });
    // An NFT send whose body computes an empty commitment closes on its sentinel above an empty value.
    if (!reading.ok && reading.close !== undefined) {
      const known = learnedTokenSends;
      const emptied = rootTokenRuns.map((run) => learnEmptyNftCommitment(
        run.sentinels, known[run.run]!, reading.close!.declared,
      ));
      const tokenRun = emptied.findIndex((sends) => sends !== undefined);
      if (tokenRun >= 0) {
        learnedTokenSends = known.map((sends, at) => (at === tokenRun ? emptied[at]! : sends));
        continue;
      }
    }
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
      // A token send's pin compares the listed output's lock, then its fungible amount, with what the body computed.
      const known = learnedTokenSends;
      const tokenLearned = rootTokenRuns.map((run) => learnTokenSend(
        run.sentinels, known[run.run]!, reading.declared, reading.computed,
        Uint8Array.from(hexToBin(run.category)).reverse(),
      ));
      const tokenRun = tokenLearned.findIndex((sends) => sends !== undefined);
      if (tokenRun >= 0) {
        learnedTokenSends = known.map((sends, at) => (at === tokenRun ? tokenLearned[at]! : sends));
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
      // A typed call's value is compared the same way, the record's eight bytes stating none until learned. The site
      // is the last payable typed call the run bound, since a call is bound before its site's check runs, and the
      // callees answer again: a frame computed from the value its call was planned with.
      const typedAmount = vmNumberToBigInt(reading.declared, { requireMinimalEncoding: false });
      if (typeof typedAmount === 'bigint' && typedAmount > 0n && reading.declared.length === 8
        && bytesEqual(reading.computed, recordValueBytes(0n))) {
        const calls = candidate.blockOf(MASTER_ID).calls;
        const valued = learnedTypedValues;
        const bound = payableCalls.filter((at) => !valued.has(at)
          && (calls[typedCallPosition(at)]?.calleeRef ?? UNFILLED_CALLEE_REF) !== UNFILLED_CALLEE_REF);
        const site = bound[bound.length - 1];
        if (site !== undefined) {
          learnedTypedValues = new Map([...learnedTypedValues, [site, typedAmount]]);
          calleeValues = NO_CALLEE_VALUES;
          continue;
        }
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
          ...shape,
          listedSends: sendCount,
          skippedPayees: new Set([...shape.skippedPayees, payable.indexOf(payees[passed]!)]),
          payeeListedSends: shape.payeeListedSends,
        }, prior);
      }
    }
    // A contract it pays hands back what its own body computed from its own program's close.
    const fromPayees = learnFromPayees(candidate);
    if (fromPayees !== undefined) {
      learnedPayees = fromPayees;
      continue;
    }
    // A close on a declaration this call does not state hands nothing back: the plan is as far as it can go. It is the
    // body's own check refusing, as `require(msg.sender == owner)` does for a caller who is not the owner, so the
    // run stopped before the values still owed and none of them is missing: the machine's verdicts name the refusal.
    if (reading.ok) {
      settled = true;
      break;
    }
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
        ...shape,
        listedSends: listedShort ? made : sendCount,
        skippedPayees: new Set([
          ...shape.skippedPayees, ...(payeesShort ? unpaid.map((payee) => payable.indexOf(payee)) : []),
        ]),
        payeeListedSends: new Map([
          ...shape.payeeListedSends,
          ...payees.flatMap((payee, index) => (payeeShort[index] ? [[payee.transferPosition, payeeMade[index]!] as const]
            : [])),
        ]),
      }, prior);
    }
    // A token run whose frame accepts while the sends past the ones it made still carry their sentinels made those on
    // branches it did not take, and the plan drops them, as it drops a value send's.
    const shortRuns = new Map<string, { readonly sends: number; readonly nftSends: number }>();
    for (const run of tokenRuns) {
      if (run.sends + run.nftSends === 0) continue;
      const { sends, nfts } = runSends(run, learnedTokenSends, calleeValues);
      const madeSends = sends.findIndex((send) => send.lock === undefined || send.amount === undefined);
      const madeNfts = nfts.findIndex((nft) => nft.lock === undefined || nft.commitment === undefined);
      if (madeSends < 0 && madeNfts < 0) continue;
      const unmade = (madeSends < 0 || sends.slice(madeSends).every((send) => send.lock === undefined
        && send.amount === undefined))
        && (madeNfts < 0 || nfts.slice(madeNfts).every((nft) => nft.lock === undefined && nft.commitment === undefined));
      if (!unmade || machine.stateSuccess(machine.evaluate(candidate.programFor(run.master))) !== true) continue;
      shortRuns.set(run.key, {
        sends: madeSends < 0 ? run.sends : madeSends, nftSends: madeNfts < 0 ? run.nftSends : madeNfts,
      });
    }
    if (shortRuns.size > 0) {
      return callInShape(options, {
        ...shape, tokenSendCounts: new Map([...shape.tokenSendCounts ?? [], ...shortRuns]),
      }, prior);
    }
    // Otherwise it either converged, or refused before writing anything owed.
    settled = true;
    break;
  }
  if (draft === undefined) {
    throw new FramedCallError('the composer built no draft for the call frame');
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
      throw new FramedCallError(
        `a contract entry "${functionName}" pays did not hand back every event payload and node it writes, so its `
        + 'frame cannot declare them',
      );
    }
    if (mappingRecords !== undefined && learnedViews.some((view) => view === undefined)) {
      throw new FramedCallError(
        `the call's write to ${mappingRecords.label} did not hand back every record it rewrites, so the frame cannot `
        + 'declare their commitments',
      );
    }
    if (learnedEvents.some((view) => view === undefined)) {
      throw new FramedCallError(
        `entry "${functionName}" did not hand back every event payload it emits, so its frame cannot declare its `
        + 'event outputs',
      );
    }
    if (learnedCallAmounts.some((amount) => amount === undefined)) {
      throw new FramedCallError(
        `entry "${functionName}" did not hand back the amount of every value it sends to a contract, so its frame `
        + 'cannot record the calls',
      );
    }
    if (learnedSends.some((send) => send.lock === undefined || send.amount === undefined)) {
      throw new FramedCallError(
        `entry "${functionName}" did not hand back the lock and amount of every send it makes, so its frame `
        + 'cannot list its send outputs',
      );
    }
    throw new FramedCallError(
      `entry "${functionName}" did not hand back the value it returns, so its frame's \`retval\` cannot be stated`,
    );
  }

  const program = draft.programFor(MASTER_ID);
  const transaction = program.transaction;
  if (transaction === undefined) {
    throw new FramedCallError('the composer built no transaction for the call frame');
  }
  // The containers the sends are paid from sit after the caller's coin, and the machine is asked about them too.
  const rootSpent = payFromContainers([
    ...learnedSends.map((send) => send.amount), ...learnedCallAmounts, ...learnedTypedValues.values(),
  ]).spent;
  const payeeSpentFinal = payees.flatMap((payee, index) => (payee.sendCount === 0 ? [] : payeePaying(
    index, learnedCallAmounts[index] ?? CALL_VALUE_SENTINEL + BigInt(index),
    learnedPayees[index]!.sends.map((send) => send.amount),
  ).spent.map((utxo, position) => ({ id: receiveContainerId(index, position), utxo }))));
  const placedInputs = placeUserInputs([
    CALLER_ID,
    ...fillerCoins.map((_utxo, index) => fillerCoinInputId(index)),
    ...rootSpent.map((_utxo, position) => containerInputId(position)),
    ...payeeSpentFinal.map((spent) => spent.id),
    ...tokenDeposits.map((_deposit, index) => tokenDepositInputId(index)),
  ]);
  const containerInputs = [
    ...rootSpent.map((utxo, position) => ({ id: containerInputId(position), utxo })),
    ...payeeSpentFinal,
  ].map((spent) => ({ ...spent, index: placedInputs.get(spent.id)! }));
  const tokenContainerInputs = tokenRuns.flatMap((run, index) => run.containers.map((utxo, position) => ({
    id: tokenContainerInputId(index, position), utxo, index: placedInputs.get(tokenContainerInputId(index, position))!,
  })));
  const rawVerdicts: FramedCallVerdict[] = [
    ...draft.layout.participants, ...tokenContainerInputs, ...containerInputs,
  ].map((placed) => {
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
  const verdicts: FramedCallVerdict[] = rawVerdicts.map((verdict) => {
    const reason = verdict.accepted ? undefined : reasons.get(verdict.id);
    return reason === undefined ? verdict : { ...verdict, objection: reason };
  });
  // A call whose execution stops on a contract's own reason reports it, so a result left unlearned, which only a frame
  // past that stop recorded, does not stand in for it; with no such reason the undecodable bytes are what the call
  // cannot get past.
  const reverted = refusal?.innermost !== undefined && (refusal.innermost.reason.message !== undefined
    || refusal.innermost.reason.error !== undefined);
  if (unlearnedResult !== undefined && !reverted) throw unlearnedResult;

  // The entry's own answer is the bytes the derived call records in the frame's `retval`, decoded through the same
  // shipped decoder the read path uses. A call the entry refused never reached its return, so no value was recorded,
  // and a call that reverted on a contract's reason returns nothing: bytes recorded on the way there are not decoded
  // in place of that reason.
  const retval = learnedRetval ?? new Uint8Array(0);
  let values: readonly StateValue[] = [];
  try {
    if (learnedRetval !== undefined) {
      values = decodeReturnValues(retval, entry.outputs, structs, entry.resultEncoding, artifact.enums);
    }
  } catch (error) {
    if (!(error instanceof FramedReadError) || !reverted) throw error;
  }

  // A record the entry does not declare is not spent, so it holds what it held.
  const writtenCommitments = records.map((record) => {
    if (!declared.includes(record)) return record.commitment;
    const commitment = transaction.outputs[recordIndex(record.id)]?.token?.nft?.commitment;
    if (commitment === undefined) {
      throw new FramedCallError(`the call's output for record "${record.id}" carries no commitment`);
    }
    return Uint8Array.from(commitment);
  });

  const liveUtxos = new Map<string, Utxo>([
    [MASTER_ID, master],
    [VALIDATOR_ID, validator],
    ...declared.map((record) => [record.id, record.utxo] as const),
    ...(mappingRecords?.spentUtxos ?? []),
    ...Object.entries(sideCars.utxos),
    ...(blockOracle === undefined ? [] : [[BLOCK_ORACLE_INPUT, blockOracle.utxo] as const]),
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
  const broadcast = !accepted || options.publish === false ? undefined : await broadcastCall({
    provider,
    callerUtxo: options.callerUtxo,
    callerLockingBytecode: options.callerLockingBytecode,
    funder: options.funder,
    ...(options.changeAddress === undefined ? {} : { changeAddress: options.changeAddress }),
    program,
    draft,
    liveUtxos,
    callerIndex: placedInputs.get(CALLER_ID)!,
    fillerCoins: fillerCoins.map((utxo, index) => ({ utxo, index: placedInputs.get(fillerCoinInputId(index))! })),
    containerInputs,
    tokenContainerInputs,
    tokenDepositInputs: tokenDeposits.map((deposit, index) => ({
      ...deposit, index: placedInputs.get(tokenDepositInputId(index))!,
    })),
  });

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

/**
 * The results the callee frames recorded, as `decode` reads them, or the decoder's refusal when the only frames whose
 * bytes do not decode as their entries' returns are frames the derivation never entered (`frameEntered`).
 *
 * A frame planned past its caller's revert runs on the plan's own inputs, a view an enclosing writer never wrote among
 * them, so what it records is no result of the execution and is left unlearned, as the hop meets an undecodable
 * result only where the execution reaches the site that reads it. A frame the derivation entered recorded the
 * execution's own bytes, so bytes there that do not decode stay an error.
 */
function decodedCalleeResults<T>(
  draft: CompositionDraft,
  retvals: ReadonlyMap<string, Uint8Array>,
  decode: (retvals: ReadonlyMap<string, Uint8Array>) => T,
): { readonly results: T } | { readonly unlearned: FramedReadError } {
  try {
    return { results: decode(retvals) };
  } catch (error) {
    if (!(error instanceof FramedReadError)) throw error;
    const entered = new Map([...retvals].filter(([master]) => frameEntered(draft, master)));
    if (entered.size === retvals.size) throw error;
    decode(entered);
    return { unlearned: error };
  }
}

/** What a value send takes: a call's options without an entry or arguments, and the value it sends. */
export type FramedValueSendOptions = Omit<FramedCallOptions, 'functionName' | 'args' | 'value'> & {
  readonly value: bigint;
};

/**
 * Sends value to a deployed framed contract, as a plain EVM transfer does: the contract's `receive()` runs with
 * the value as `msg.value`, or its payable `fallback()` when it has none. A contract with neither has no body to
 * run, and a fallback that is not payable refuses the value, so both are refused by name.
 */
export async function sendFramedValue(options: FramedValueSendOptions): Promise<FramedCallResult> {
  requireFramedFunderSighash(options.funder);
  const body = valueEntryOf(options.artifact, 'a value sent to it');
  return callFramedEntry({ ...options, functionName: body.name, args: [] });
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
  /** The caller's coin's index among the user inputs. */
  readonly callerIndex: number;
  /** More coins at the caller's lock that fill the indices between token runs, signed as the caller's coin is. */
  readonly fillerCoins: readonly { readonly index: number; readonly utxo: Utxo }[];
  /** The containers the call's sends are paid from. */
  readonly containerInputs: readonly { readonly index: number; readonly utxo: Utxo }[];
  /** The token containers the token runs spend, each at the index its run starts at. */
  readonly tokenContainerInputs: readonly { readonly index: number; readonly utxo: Utxo }[];
  /** The coins the call's token deposits spend, each signed by its own unlocker. */
  readonly tokenDepositInputs: readonly { readonly index: number; readonly utxo: Utxo; readonly unlocker: Unlocker }[];
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
    throw new FramedCallError(
      'the caller funding unlocker signs for a lock that is not the call\'s caller lock, so the root frame\'s '
      + '`msg.sender` binding would not hold',
    );
  }

  const { TransactionBuilder } = await import('../../TransactionBuilder.js');
  // The call's shape is fixed - the composer assembled every contract input, its side-cars included, and there is no
  // oracle to co-spend - so the builder must not append anything. A chunk a shorter value drops is consumed with no
  // successor and leaves its index without its token, which the builder would take for an accidental burn, so it is
  // allowed as the hop's builder allows it; the check stays on for a caller's coin that carries a token, which no
  // chunk's burn explains.
  const consumesRecord = options.callerUtxo.token === undefined && draft.layout.participants.some((placed) =>
    program.sourceOutputs[placed.index]?.token?.nft !== undefined
    && program.transaction?.outputs[placed.index]?.token === undefined);
  const builder = new TransactionBuilder({
    provider, skipAutomaticCoSpends: true, ...(consumesRecord ? { allowImplicitNftBurn: true } : {}),
  });
  // The derived locktime is what every frame that reads `block.timestamp` was evaluated against, so the broadcast
  // carries that same one.
  builder.setLocktime(program.transaction?.locktime ?? 0);
  const derivedInputs = program.transaction?.inputs ?? [];
  for (const placed of draft.layout.participants) {
    const source = program.sourceOutputs[placed.index];
    const unlockingBytecode = derivedInputs[placed.index]?.unlockingBytecode;
    if (source === undefined || unlockingBytecode === undefined) {
      throw new FramedCallError(`the derived call carries no input for participant "${placed.id}"`);
    }
    // A facet holds no token and pins no category, so any live UTXO at its lock serves the input.
    const facetUtxos = placed.kind === 'facet'
      ? await provider.getUtxosForLockingBytecode(source.lockingBytecode)
      : [];
    const real = options.liveUtxos.get(placed.id)
      ?? facetUtxos.find((utxo) => utxo.satoshis === source.valueSatoshis)
      ?? facetUtxos[0];
    if (real === undefined) {
      throw new FramedCallError(`the deployment holds no live UTXO for the call's "${placed.id}"`);
    }
    if (real.satoshis !== source.valueSatoshis) {
      throw new FramedCallError(
        `the call's "${placed.id}" holds ${real.satoshis} satoshis, but the derived call spends `
        + `${source.valueSatoshis}`,
      );
    }
    const derivedToken = source.token === undefined
      ? undefined
      : libauthTokenDetailsToSolidCashTokenDetails(source.token);
    // Fail closed on a live-UTXO token mismatch: the composer derived this token from the covenant input, and a
    // provider that returns a same-satoshis-but-different-token UTXO would otherwise make us sign a transaction
    // whose unlock never matches the UTXO. Surface it as a caller error, not a broadcast failure.
    if (derivedToken !== undefined) {
      const live = real.token;
      if (live === undefined
        || live.category.toLowerCase() !== derivedToken.category.toLowerCase()
        || live.amount !== derivedToken.amount
        || (live.nft === undefined) !== (derivedToken.nft === undefined)) {
        throw new FramedCallError(
          `the call's "${placed.id}" spends a UTXO whose token does not match the derived input`,
        );
      }
      if (live.nft !== undefined && derivedToken.nft !== undefined
        && (live.nft.capability !== derivedToken.nft.capability
          || live.nft.commitment.toLowerCase() !== derivedToken.nft.commitment.toLowerCase())) {
        throw new FramedCallError(
          `the call's "${placed.id}" spends a UTXO whose NFT does not match the derived input`,
        );
      }
    }
    const token = derivedToken === undefined ? {} : { token: derivedToken };
    const utxo: Utxo = { txid: real.txid, vout: real.vout, satoshis: source.valueSatoshis, ...token };
    const sequence = derivedInputs[placed.index]?.sequenceNumber;
    builder.addInput(utxo, rawUnlocker(source.lockingBytecode, unlockingBytecode),
      sequence === undefined ? undefined : { sequence });
  }
  const addContainer = ({ index, utxo }: { readonly index: number; readonly utxo: Utxo }): void => {
    const source = program.sourceOutputs[index];
    const unlockingBytecode = derivedInputs[index]?.unlockingBytecode;
    if (source === undefined || unlockingBytecode === undefined) {
      throw new FramedCallError(`the derived call carries no container input at ${index}`);
    }
    builder.addInput(utxo, rawUnlocker(source.lockingBytecode, unlockingBytecode));
  };
  // The user inputs, in the order the composer placed them. The caller's own coin funds the call and is the frame's
  // root caller; its signature is a real one over the real transaction, which the root's `msg.sender` binding and the
  // provider both check.
  const userInputs: { readonly index: number; readonly add: () => void }[] = [
    { index: options.callerIndex, add: (): void => { builder.addInput(options.callerUtxo, options.funder); } },
    ...options.fillerCoins.map(({ index, utxo }) => ({
      index, add: (): void => { builder.addInput(utxo, options.funder); },
    })),
    ...[...options.tokenContainerInputs, ...options.containerInputs].map((input) => ({
      index: input.index, add: (): void => addContainer(input),
    })),
    ...options.tokenDepositInputs.map(({ index, utxo, unlocker }) => ({
      index, add: (): void => { builder.addInput(utxo, unlocker); },
    })),
  ];
  for (const input of userInputs.sort((left, right) => left.index - right.index)) input.add();

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
  const { hash256 } = await import('@bitauth/libauth/build/lib/crypto/combinations.js');
  const { encodeTransaction } = await import('@bitauth/libauth/build/lib/message/transaction-encoding.js');

  const rawBytes = encodeTransaction(transaction);
  const rawHex = binToHex(rawBytes);
  traceBroadcast(builder.inputs, builder.outputs, transaction.inputs, rawBytes.length);
  const submitPrepared = provider.sendPreparedTransaction?.bind(provider);
  const txid = submitPrepared !== undefined
    ? await submitPrepared({ rawHex, rawBytes, transaction })
    : await provider.sendRawTransaction(rawHex);
  const expected = binToHex(hash256(rawBytes).reverse());
  if (txid !== expected) {
    throw new FramedCallError(
      `the provider returned txid ${txid} for the call, not the ${expected} its bytes hash to`,
    );
  }
  const { attachWait } = await import('../../wait.js');
  return attachWait({ ...transaction, txid, hex: rawHex } as TransactionDetails, provider);
}
