import {
  Artifact,
  ArtifactMap,
  AbiFunction,
  ArgSource,
  ExternalCallAbi,
  buildInitialStateCommitments,
  buildTokenContainerCovenantScript,
  buildSatoshiContainerCovenantScript,
  buildDataNftCovenantScript,
  buildEntryNftCovenantScript,
  buildEventNftCovenantScript,
  buildAnonymousEventNftCovenantScript,
  computeCollectionHash,
  dynamicChunkSignature,
  parseChunkCommitment,
  buildValueChunkCommitment,
  buildChunkCommitment,
  splitValueIntoChunks,
  parseValueChunkCommitment,
  splitValueIntoValueChunks,
  VALUE_HEAD_SIZE,
  joinValueChunks,
  DYNAMIC_CHUNK_SIZE,
  computeEventNameHash,
  parsePushdataCommitment,
  buildPushdataCommitment,
  parseEntryCommitment,
  StateValue,
  attachDecodedAccessors,
  decodePushdataValue,
  parseEntryCommitmentMultiKey,
  Op,
  StateLayout,
  ExternalReadAbi,
  EntryAccessAbi,
  EmitAbi,
  EventDefinitionAbi,
  BlockSlotKind,
  FunctionBlockLayout,
  sidecarLockingBytecode,
  resolveLibraryBlob,
  SHARED_LIBRARY_SALT,
  ExternalLibraryAbi,
  isComputedBlockhashKey,
  encodePushdataValue,
  keccakComputeLockingBytecode,
  ecrecoverComputeLockingBytecode,
  sha256 as sha256Sync,
  ripemd160 as ripemd160Sync,
  hash160 as hash160Sync,
  hash256 as hash256Sync,
  parseArrayTypeString,
  decodePackedEventArray,
  scriptToBytecode,
} from '@solidcash/utils';
import { buildKeccakComputeSidecar, extractKeccakPreimageFromTrace } from '../keccak/keccakComputeSidecar.js';
import { buildEcrecoverComputeSidecars, computeEcrecoverWitness, probeEcrecoverSplit } from '../ecrecover/ecrecoverComputeSidecar.js';
import { encodeHiddenBatch } from '../layer3/hidden-batch.js';
// X186. The covenant-annotating gate moved to `layer3/preflight.ts` when `TransactionBuilder.send` became its
// second caller. The four lifecycle-admin sites below route through it; none calls the bare gate.
import {
  assertFinalizedBytesWithCovenant, inputSubjectsOfBuilder, type FinalizedByteSubject,
} from '../layer3/preflight.js';
import {
  binToHex,
  hexToBin,
  binsAreEqual,
  decodeTransactionUnsafe,
  AuthenticationProgramStateCommon,
  encodeLockingBytecodeP2pkh,
  bigIntToVmNumber,
  vmNumberToBigInt,
  utf8ToBin,
  binToUtf8,
  lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import { Contract } from '../Contract.js';
import {
  SortedList, keyToSlot, keyToSlotMulti, bytesToSlotValue, headSentinelCommitment, encodeEntryCommitment,
  decodeEntryCommitment,
} from './SortedList.js';
import { resolveBlockhashCoSpend } from '../oracle/blockhashCoSpend.js';
import { attachWait } from '../wait.js';
import Signer from '../Signer.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { AddressType, ContractOptions, LibauthOutput, Output, TransactionDetails, UnlockableUtxo, Unlocker, Utxo } from '../interfaces.js';
import {
  StatefulTransactionBuilder, EntryNftInfo, TokenContainerInfo, ExternalCallUtxoGroup,
} from './StatefulTransactionBuilder.js';
import {
  OnChainState, StateReader, type ParsedEvent, type EventFilter,
  readEventsFiltered, readAnonymousEventsFromChain, valuesEqual,
} from './StateReader.js';
import {
  getDataNftAddress, getEntryNftAddress, getEventNftAddress, getAnonymousEventNftAddress,
  getDynamicChunkAddress, getValueChunkAddress,
  getDataNftLockingBytecode, getEntryNftLockingBytecode,
  getTokenContainerAddress, getSatoshiContainerAddress, getContractState,
  createDataNftUnlocker, createDestroyDataNftUnlocker,
  createReadOnlyDataNftUnlocker, createEntryNftUnlocker, createReadOnlyEntryNftUnlocker,
  createDynamicChunkUnlocker, createReadOnlyDynamicChunkUnlocker, createValueChunkUnlocker,
  createEventNftUnlocker, createAnonymousEventNftUnlocker,
  createTokenContainerUnlocker, createSatoshiContainerUnlocker,
  resolveCollectionSignature, resolveCategoryFromLockingBytecode, resolveCategoryFromAddress,
} from './covenant-helpers.js';
import { resolveLogicalIdentity } from './logical-identity.js';
import { ConstructorArgument, FunctionArgument, encodeFunctionArgument } from '../Argument.js';
import { AbiToFunctionMap } from '../types/type-inference.js';
import { StateGetterMap, StateValueType } from '../types/state-inference.js';
import {
  addressToLockScript, findLastIndex, generateLibauthSourceOutputs, getNetworkPrefix, scriptToAddress,
  scriptToLockingBytecode,
} from '../utils.js';
import NetworkProvider from '../network/NetworkProvider.js';

// P2SH32-wrapped OP_TRUE for consensus-valid dummy funders.
// Redeem script: OP_TRUE (0x51). Locking: OP_HASH256 <hash256(0x51)> OP_EQUAL.
// Unlocking: <push 0x51> (the redeem script).
const DUMMY_FUNDER_LOCKING_BYTECODE = new Uint8Array([
  0xaa, // OP_HASH256
  0x20, // push 32 bytes
  0x95, 0x3c, 0xcf, 0xa5, 0x96, 0xa6, 0xc6, 0xd3, 0x9e, 0x59, 0x80, 0x19, 0x45, 0x39, 0x12, 0x4f,
  0xdc, 0xff, 0x11, 0x6a, 0x57, 0x14, 0x55, 0xa2, 0x12, 0xba, 0xed, 0x81, 0x1f, 0x58, 0x5e, 0xe0,
  0x87, // OP_EQUAL
]);
const DUMMY_FUNDER_UNLOCKING_BYTECODE = new Uint8Array([0x01, 0x51]); // push 1-byte redeem script

type GraphBlockhashSelection = {
  readKey: string;
  slotOrdinal: number;
  rowArgs: FunctionArgument[];
  handler: AbiFunction;
};

/** Decode only the rows selected by an SCB1 envelope and project the compiler-published blockhash descriptors.
 * Artifact metadata is not trusted to describe the blob: selector, row and argument bounds are checked here. */
function selectGraphBlockhashReads(
  artifact: Artifact, blob: Uint8Array,
): GraphBlockhashSelection[] {
  const route = artifact.hiddenBatch?.route;
  const plan = route?.graphBlockhashOracle;
  if (!plan) return [];
  if (blob.length < 7 || binToHex(blob.slice(0, 4)) !== '53434231' || blob[4] !== 1) {
    throw new Error('SCB1 graph blockhash route requires a canonical version-1 envelope');
  }
  const rowCount = blob[6];
  if (rowCount > plan.rowCount) throw new Error('SCB1 graph blockhash row count exceeds the oracle plan');
  const valueMode = blob[5] === 1;
  let cursor = 7;
  const selected: GraphBlockhashSelection[] = [];
  const structs = artifact.structs ?? artifact.stateLayout?.structs;
  for (let row = 0; row < rowCount; row++) {
    const header = valueMode ? 21 : 12;
    if (cursor + header > blob.length) throw new Error(`SCB1 row ${row} is truncated`);
    const selector = binToHex(blob.slice(cursor, cursor + 4));
    const logicalRow = blob[cursor + 4] | (blob[cursor + 5] << 8) | (blob[cursor + 6] << 16)
      | (blob[cursor + 7] << 24);
    if (logicalRow !== row) throw new Error('SCB1 graph rows must use canonical contiguous indices');
    const argsLength = blob[cursor + 10] | (blob[cursor + 11] << 8);
    const argsStart = cursor + header;
    const argsEnd = argsStart + argsLength;
    if (argsEnd > blob.length) throw new Error(`SCB1 row ${row} arguments are truncated`);
    const handlerInfo = artifact.hiddenBatch!.handlers.find((h) => h.selector === selector && h.eligible);
    const handler = artifact.abi.find((f) => f.name === handlerInfo?.name);
    if (!handlerInfo || !handler) throw new Error(`SCB1 row ${row} selects an ineligible handler`);
    const rowArgs: FunctionArgument[] = [];
    let argCursor = argsStart;
    for (const input of handlerInfo.inputs) {
      const decoded = decodePushdataValue(blob, argCursor, input.type, structs);
      rowArgs.push(decoded.value as FunctionArgument);
      argCursor += decoded.bytesConsumed;
    }
    if (argCursor !== argsEnd) throw new Error(`SCB1 row ${row} argument vector is non-canonical`);
    for (const descriptor of plan.reads) {
      if (descriptor.row === row && descriptor.selector === selector) {
        selected.push({ readKey: descriptor.readKey, slotOrdinal: descriptor.slotOffset, rowArgs, handler });
      }
    }
    cursor = argsEnd;
  }
  if (cursor !== blob.length) throw new Error('SCB1 graph blockhash envelope has trailing bytes');
  return selected.sort((a, b) => a.slotOrdinal - b.slotOrdinal);
}

/**
 * Compute the minimum relay fee for a built TransactionBuilder at 1 sat/byte.
 * Uses the serialized transaction size as the fee floor.
 */
async function computeFeeFromBuilder(builder: TransactionBuilder): Promise<bigint> {
  const { encodeTransaction } = await import('@bitauth/libauth');
  const tx = builder.buildLibauthTransaction();
  return BigInt(encodeTransaction(tx).byteLength);
}

/**
 * X176. One published reason an ABI entry's `writesState` is not `false`.
 *
 * Named for the EVIDENCE, not for a conclusion: several may hold at once and the ABI does not say which one the
 * compiler stopped at, so every one that is published is reported.
 */
export type StateEffectEvidence =
  /** A collection entry is written, deleted or upserted, straight-line or as a fixed sorted batch. */
  | 'entry-write'
  /** A collection is written by a runtime loop, or by a sorted insert loop. */
  | 'entry-loop-write'
  /** A chunk-backed dynamic-storage variable is rewritten. */
  | 'dynamic-write'
  /** A lifecycle modifier that rewrites or retires the covenant: upgrade, selfdestruct, delegate, unsafe. */
  | 'lifecycle-modifier'
  /** `split(n)` / `merge(n)`: the master set changes, the state variables do not. */
  | 'split-merge'
  /** An event NFT is minted. Output shape, not a state variable. */
  | 'emit'
  /** Native value is moved. Balance, not a state variable. */
  | 'transfer'
  /** A token container is read or written. */
  | 'token-container'
  /** A child contract is deployed. The CHILD gets state; this handler's own variables need not move. */
  | 'deploy'
  /** ANOTHER contract's handler is co-spent. The callee's state may change; this handler's need not. */
  | 'external-call'
  /** A delegate-library call, or a low-level call/staticcall/delegatecall. */
  | 'delegate-or-low-level';

/**
 * X176. What `writesState` actually answers about one ABI entry.
 *
 * `writesState` IS READ BY COMPOSERS AS "THIS HANDLER MUTATES STATE" AND IT DOES NOT MEAN THAT. The compiler
 * computes it conservatively: `false` only when the body has NO stateful statement and the function has no
 * external call, child deploy, library delegate, dynamic write, low-level call, split/merge or covenant-bypass
 * modifier. Anything else is `true`, so `true` means "not provably read-only", which in SDK terms is "needs the
 * state machinery" - and that is a strictly weaker claim than "changes a state variable".
 *
 * MEASURED, not argued. `Foo.callBar` publishes `writesState: true` and its whole body is `bar.log();` - one
 * external call and not one assignment. `Attack.attack` is the same shape. So of the seven handlers the L2-F2
 * partition counts as explicit writers, at least two write nothing at all, and the four that publish the flag
 * ABSENT and are conservatively counted as writers are handlers of contracts with `dataNftCount === 0`, which
 * have no state variable for any handler to change.
 *
 * ONE READING IS SOUND IN ONE DIRECTION ONLY, and this type keeps that visible:
 *   `writesState === false`  the compiler PROVED read-only. Sound to act on - it is what the derivation skip
 *                            in `_prepareCall` acts on, and misclassification there fails closed anyway.
 *   `writesState === true`   NOT a proof of mutation. Read `evidence`.
 *   absent                   unknown or stateless. Never a proof of either.
 */
export interface StateEffectReading {
  /** The field verbatim, including the absent case. */
  published: boolean | undefined;
  /** The only sound reading of the flag: everything but an explicit `false` needs the machinery. */
  needsStateMachinery: boolean;
  /** True only for an explicit `false` - the compiler's own proof that output state == input state. */
  provablyReadOnly: boolean;
  /** Published evidence that this handler changes its OWN persisted state. */
  ownStateEvidence: StateEffectEvidence[];
  /** Published evidence of an effect that is NOT a change to this handler's own state variables. */
  otherEffectEvidence: StateEffectEvidence[];
  /**
   * The flag is set and the ABI itemizes NOTHING. A plain `this.x = y` lands here: the ABI publishes no
   * "assigns a state variable" field, so this is as close as an artifact gets to naming one - and it is
   * indistinguishable from a bus-mode journal reservation, which is why it is reported rather than concluded.
   */
  unattributed: boolean;
  /**
   * The contract has NO data NFT, so it has no persisted state variable and no handler of it can change one.
   * Structural and decisive where it applies; requires the artifact, so it is false when only the ABI entry is
   * supplied. This is what settles the four absent-flag handlers.
   */
  contractHasNoState: boolean;
}

/** Evidence classes that are changes to the handler's OWN persisted state. */
const OWN_STATE_EVIDENCE: readonly StateEffectEvidence[] = [
  'entry-write', 'entry-loop-write', 'dynamic-write', 'lifecycle-modifier',
];

/** Function modifiers the compiler treats as covenant-rewriting. Mirrors `STATE_WRITING_MODIFIERS`. */
const LIFECYCLE_MODIFIERS = ['upgrade', 'selfdestruct', 'delegate', 'unsafe'];

/** One prebuilt `destroy` batch: its finalized bytes, what it reclaims, and the builder that produced them. */
interface DestroyBatch {
  hex: string;
  reclaimed: bigint;
  subjects: (FinalizedByteSubject | undefined)[];
  /** X175: kept so a refused batch can report its covenant objection alongside its byte rule. */
  builder: TransactionBuilder;
}

/** Custom error class for auto-derivation failures (VM execution, trace parsing, etc.) */
export class AutoDerivationError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'AutoDerivationError';
  }
}

export interface DeployOptions {
  provider: NetworkProvider;
  fundingUtxo: Utxo;
  funder: Unlocker;
  initialState?: Record<string, StateValueType>;
  initArgs?: FunctionArgument[];  // arguments for constructor {} block
  changeAddress: string;
  masterAmount?: bigint;   // default 1200n
  dataNftAmount?: bigint;  // default 1200n per data NFT
  fee?: bigint;            // default 1000n
  maxFee?: bigint;         // maximum allowed fee (throws if exceeded)
  addressType?: AddressType;
  threadCount?: number;    // number of master minting NFTs (default: 1)
  initialBalance?: bigint; // initial satoshi container balance (created when > 0)
  /** Internal SDK composition: immutable category-bearing logical identity outputs minted by genesis. */
  identityAnchors?: Array<{ to: string | Uint8Array; commitment: string; amount?: bigint }>;
}

export interface DeployResult<T extends Artifact = Artifact> {
  contract: ConnectedStatefulContract<T>;
  tx: TransactionDetails;
  categoryId: string;
}

export interface UpgradeOptions<T extends Artifact = Artifact> {
  provider: NetworkProvider;
  oldContract: ConnectedStatefulContract;
  upgradeFunctionName: string;        // must have 'upgrade' modifier in ABI
  upgradeFunctionArgs: FunctionArgument[];
  newArtifact: T;
  newConstructorArgs: ConstructorArgument[];
  addressType?: AddressType;          // default: match old contract's addressType
  fee?: bigint;                       // default: 1000n
  maxFee?: bigint;                   // maximum allowed fee (throws if exceeded)
  fundingUtxo?: Utxo;                // required when new layout needs additional data NFTs
  funder?: Unlocker;                  // required when new layout needs additional data NFTs
  changeAddress?: string;             // change address for leftover funding satoshis
}

export interface UpgradeResult<T extends Artifact = Artifact> {
  contract: ConnectedStatefulContract<T>;
  tx: TransactionDetails;
  categoryId: string;
}

export interface DestroyOptions {
  provider: NetworkProvider;
  contract: ConnectedStatefulContract;
  destroyFunctionName: string;        // must have 'selfdestruct' modifier in ABI
  destroyFunctionArgs: FunctionArgument[];
  recipient: string;                  // address to send remaining funds
  fee?: bigint;                       // per-transaction fee, default 1000n
  maxFee?: bigint;                    // maximum allowed fee per tx (throws if exceeded)
  maxInputsPerTx?: number;            // conservative default ~200
  /** Token container category IDs to reclaim (satoshi containers are auto-discovered) */
  tokenContainerCategoryIds?: string[];
}

export interface DestroyResult {
  txs: TransactionDetails[];          // 1 or more transactions
  totalReclaimed: bigint;             // total satoshis sent to recipient
}

export interface DeployFromOptions<T extends Artifact = Artifact> {
  provider: NetworkProvider;
  factory: ConnectedStatefulContract;        // the factory contract
  deployFunctionName: string;                // must have 'deploy' modifier
  deployFunctionArgs: FunctionArgument[];    // user args to the factory's deploy function
  childArtifact?: T;                         // child artifact; else resolved via factory.registerChild()
  childConstructorArgs?: ConstructorArgument[]; // else derived from the deploy args (new C(param) mapping)
  childSalt?: Uint8Array;                    // create2 salt; else derived from the recorded new C{salt}() mapping
  childInitialState?: Record<string, StateValueType>; // optional initial state for child
  // `new Child{value: x}()` transfers x sats from the factory's OWN satoshi container (the value source, like any
  // scash value transfer - EVM-faithful "from the deployer's balance") to the child's address. deployFrom then
  // co-spends the factory container (input) + recreates it (output, minus x) + adds the x-sat transfer output.
  // The factory must have been deployed with an initialBalance >= x. Supply the transferred amount here.
  childValue?: bigint;
  // A deploy function that transfers CashTokens from the factory's token container - e.g. to the freshly-created
  // child (`Child ch = new Child(...); this.tokens[cat].transfer(<addr>, amt)`). Supply each FT transfer the deploy
  // performs; deployFrom co-spends the factory's token container, recreates it (amount minus the transfers), and
  // adds each tcTransfer output. `to` is the recipient locking bytecode/address (pass the child's address to fund
  // the new contract). Multiple categories are co-spent + recreated in one deploy. NFT (transferNft) transfers on
  // deploy are not yet supported. See docs/contract-creation.md.
  childTokenTransfers?: Array<{ categoryId: string; to: string | Uint8Array; amount: bigint }>;
  fundingUtxo: Utxo;                         // must be at vout 0 for token genesis (becomes child category)
  // A LOOP deploy (`for (i<n) new C()`) mints N children - a balanced contract block needs N funding inputs
  // (any value, each vout 0), one per child; child i's category = fundingUtxos[i].txid. When set, this supersedes
  // the single fundingUtxo (which stays fundingUtxos[0] for a 1-child deploy). See docs/contract-creation.md.
  fundingUtxos?: Utxo[];
  funder?: Unlocker;                         // unlocker for funding UTXO(s); else factory.setDeployDefaults()
  addressType?: AddressType;
  fee?: bigint;                              // default: 1000n
  maxFee?: bigint;                           // maximum allowed fee (throws if exceeded)
  changeAddress?: string;
  masterAmount?: bigint;                     // default: 1200n
  dataNftAmount?: bigint;                    // default: 1200n per data NFT
}

// Options for the `factory.deployFn(...args).deploy({...})` sugar: the provider, factory, deploy-function
// name and args are taken from the call itself, leaving only the child + funding details.
export type DeployFromCallOptions<T extends Artifact = Artifact> =
  Omit<DeployFromOptions<T>, 'provider' | 'factory' | 'deployFunctionName' | 'deployFunctionArgs'>;

export interface DeployFromResult<T extends Artifact = Artifact> {
  factory: ConnectedStatefulContract;        // factory with updated state
  child: ConnectedStatefulContract<T>;       // newly deployed child contract
  tx: TransactionDetails;
  childCategoryId: string;
}

export interface SplitOptions {
  provider: NetworkProvider;
  contract: ConnectedStatefulContract;
  splitFunctionName: string;             // must have 'split' modifier in ABI
  splitFunctionArgs: FunctionArgument[]; // includes the count N
  funder: Unlocker;                      // unlocker for funding UTXO(s)
  fundingUtxos: Utxo[];                  // funding UTXOs for fees + new NFT dust
  changeAddress: string;
  fee?: bigint;                          // default: 1000n
  maxFee?: bigint;                       // maximum allowed fee (throws if exceeded)
  newMintingAmount?: bigint;             // satoshis per new minting NFT, default: 1200n
}

export interface SplitResult {
  tx: TransactionDetails;
  categoryId: string;
}

export interface MergeOptions {
  provider: NetworkProvider;
  contract: ConnectedStatefulContract;
  mergeFunctionName: string;             // must have 'merge' modifier in ABI
  mergeFunctionArgs: FunctionArgument[]; // includes the count N
  funder: Unlocker;                      // unlocker for funding UTXO(s)
  consumedMasterUtxos: Utxo[];           // minting NFT UTXOs to consume
  fundingUtxos: Utxo[];                  // funding UTXOs for fees
  changeAddress: string;
  fee?: bigint;                          // default: 1000n
  maxFee?: bigint;                       // maximum allowed fee (throws if exceeded)
}

export interface MergeResult {
  tx: TransactionDetails;
  categoryId: string;
}

export interface ExternalCallInfo {
  externalContract: StatefulContract;
  functionName: string;
  args: FunctionArgument[];
  stateOverrides?: Record<string, StateValueType>;
}

/**
 * Specification for an external contract in a flat map.
 * Used by `externalContracts` option in `connect()` / `from()` to auto-wire the graph.
 */
export interface ExternalContractSpec {
  artifact: Artifact;
  categoryId: string;
  /** Explicit constructor args override. When omitted, inferred from ABI metadata. */
  constructorArgs?: ConstructorArgument[];
}

/** Options for `StatefulContract.withCategory()` and `StatefulContract.from()`. */
export interface StatefulConnectOptions {
  /** Pre-built external contracts, manually wired. */
  externals?: Record<string, ConnectedStatefulContract>;
  /**
   * Flat map of interface name -> external contract spec.
   * SDK auto-creates Contract + StatefulContract objects, infers constructor args
   * from ABI metadata (categoryParam -> category ID), and wires the externals graph.
   *
   * Covers the full chain: if A references IB and B references IC, provide both
   * `{ IB: ..., IC: ... }` and the SDK wires B->IC automatically.
   */
  externalContracts?: Record<string, ExternalContractSpec>;
}

/** Metadata for each group in the external call UTXO list (direct + transitive). */
interface ExternalGroupMeta {
  /** The ABI slot governing this call (from the caller's ABI). */
  ecSlot: ExternalCallAbi;
  /** Category ID of the contract making this call (A's cat for direct, B's cat for B->C). */
  callerCategoryId: string;
  /** Index of the parent group for transitive calls (-1 for direct). */
  parentGroupIndex: number;
}

export type CallInfo = {
  type: 'stateful';
  contract: StatefulContract;
  functionName: string;
  args: FunctionArgument[];
  /** For delegatecall: the proxy's master input index in the transaction. Defaults to 0. */
  proxyMasterIndex?: number;
} | {
  type: 'raw';
  utxo: UnlockableUtxo;
};

/**
 * Find the index in the trace where the redeem (locking/covenant) script evaluation begins.
 *
 * A naive `findLastIndex(ip === 0)` is wrong: `OP_INVOKE` subroutines also reset `ip` to 0, so when a
 * covenant runs subroutines between inline verifications the last `ip === 0` lands inside a subroutine
 * and slicing there drops earlier verifications. Anchor instead on the redeem script's own instruction
 * array, identified as the longest array seen at any `ip === 0` step.
 */
function findRedeemScriptStart(fullTrace: AuthenticationProgramStateCommon[]): number {
  let redeemInstructions: AuthenticationProgramStateCommon['instructions'] | undefined;
  let maxLen = -1;
  for (const state of fullTrace) {
    if (state.ip === 0 && state.instructions.length > maxLen) {
      maxLen = state.instructions.length;
      redeemInstructions = state.instructions;
    }
  }
  if (!redeemInstructions) return findLastIndex(fullTrace, (state) => state.ip === 0);
  return findLastIndex(fullTrace, (state) => state.ip === 0 && state.instructions === redeemInstructions);
}

// Generous upper bound on the output-index span scanned when deriving a loop mapping write's per-iteration entry
// commitments. Only indices the covenant actually verified appear in the map, so this just caps the scan window.
const LOOP_ENTRY_MAX_ITERATIONS = 256;

// X10. Cap on the speculative growth of a dynamic-storage chunk region whose length the probe has not revealed
// yet (a trailing C2 entry mint aborts the probe before the data NFT is verified). One extra probe per output,
// so this must stay well inside the derivation iteration budget. X101: the cap is on the region TOTAL across all
// chunk vars, so a multi-var write costs the same probe budget as a single-var one.
const MAX_SPECULATIVE_CHUNK_OUTPUTS = 32;

/**
 * Extract expected commitment hex strings from a VM debug trace, keyed by the output index each verifies.
 *
 * The contract verifies state via: <expected> OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY
 * This scans the trace for those patterns and records the expected commitment bytes per output index.
 */
function extractCommitmentMapFromTrace(
  fullTrace: AuthenticationProgramStateCommon[],
  outputIndexRange?: { min: number; max: number },
): Map<number, string> {
  // Slice to the redeem (locking) script phase, subroutine-aware (see findRedeemScriptStart).
  const p2shStart = findRedeemScriptStart(fullTrace);
  const lockingScriptTrace = p2shStart >= 0 ? fullTrace.slice(p2shStart) : fullTrace;

  // Use a Map keyed by output index to keep the LAST match for each output.
  // For loops that write the same state variable multiple times, intermediate
  // values appear earlier in the trace; only the final value should be used.
  const commitmentsByOutputIndex = new Map<number, string>();
  let sawOutputTokenCommitment = false;
  let targetOutputIndex = -1;

  for (let i = 0; i < lockingScriptTrace.length; i++) {
    const step = lockingScriptTrace[i];
    const instruction = step.instructions[step.ip];
    if (!instruction) continue;
    // Skip instructions inside a not-taken conditional branch: libauth's trace records skipped
    // instructions too (enclosing OP_IF/OP_NOTIF false => controlStack contains a `false`). A
    // dynamic-write loop's exit iteration skips its inline OP_OUTPUTTOKENCOMMITMENT verify, leaving a
    // phantom step whose frozen stack would otherwise be misread as a commitment.
    if (step.controlStack.some((c) => c === false)) continue;

    if (instruction.opcode === Op.OP_OUTPUTTOKENCOMMITMENT) {
      sawOutputTokenCommitment = true;
      // Capture the output index from the stack top before the opcode executes.
      // OP_OUTPUTTOKENCOMMITMENT pops the output index from the stack.
      if (step.stack.length >= 1) {
        targetOutputIndex = Number(decodeScriptNumber(Uint8Array.from(step.stack[step.stack.length - 1])));
      }
      continue;
    }

    // Reset flag if any non-EQUALVERIFY opcode appears between target and verification.
    // The compiler always generates tightly-coupled <expected> <idx> OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY,
    // so an intervening opcode means this is not a commitment verification pattern.
    if (sawOutputTokenCommitment && instruction.opcode !== Op.OP_EQUALVERIFY) {
      sawOutputTokenCommitment = false;
      continue;
    }

    if (sawOutputTokenCommitment && instruction.opcode === Op.OP_EQUALVERIFY) {
      sawOutputTokenCommitment = false;
      // Filter by output index range if specified
      if (outputIndexRange) {
        if (targetOutputIndex < outputIndexRange.min || targetOutputIndex >= outputIndexRange.max) {
          continue;
        }
      }
      const stack = step.stack;
      if (stack.length >= 2) {
        // stack[-2] is expected commitment, stack[-1] is actual (from OP_OUTPUTTOKENCOMMITMENT)
        const expectedBytes = stack[stack.length - 2];
        const hex = binToHex(expectedBytes);
        // Last write to a given output index wins, so loop iterations
        // correctly overwrite prior values for the same output.
        commitmentsByOutputIndex.set(targetOutputIndex, hex);
      }
    }
  }

  return commitmentsByOutputIndex;
}

/**
 * Positional commitment list (sorted by output index) from a VM debug trace. Used for output groups whose
 * i-th verified output maps to the i-th slot (events, chunks, transfers). For ENTRY commitments prefer
 * extractCommitmentMapFromTrace + a slot mapping: an entry group can skip absent read-only slots (no check),
 * so positional alignment breaks.
 */
function extractCommitmentsFromTrace(
  fullTrace: AuthenticationProgramStateCommon[],
  expectedCount: number,
  outputIndexRange?: { min: number; max: number },
): string[] | undefined {
  const commitmentsByOutputIndex = extractCommitmentMapFromTrace(fullTrace, outputIndexRange);
  const commitments = Array.from(commitmentsByOutputIndex.entries())
    .sort(([a], [b]) => a - b)
    .map(([, hex]) => hex);

  if (expectedCount === 0) {
    return commitments;
  }

  if (commitments.length >= expectedCount) {
    return commitments.slice(0, expectedCount);
  }

  // Return partial results if any were found (useful for iterative derivation)
  if (commitments.length > 0) {
    return commitments;
  }

  return undefined;
}

/**
 * Extract blockhash oracle reads from an auto-derivation probe trace - the SINGLE source of truth for a
 * blockhash(n) reader's n. The covenant, per read, computes n on-stack (from state/args/constants - ANY
 * expression), picks the oracle input index (base + slot ordinal), then does OP_DUP OP_UTXOTOKENCATEGORY.
 * At that OP_UTXOTOKENCATEGORY the stack top is the duplicated index (stack[top] === stack[top-1]) and n sits
 * directly below (stack[top-2]); an index in the reserved blockhash slot range [base, base+slotCount)
 * identifies the read. (A probe without a given oracle co-spent still reaches this step - it aborts only when
 * OP_UTXOTOKENCATEGORY executes on the missing input - so callers extract even from a failing probe.)
 */
function extractBlockhashReadsFromTrace(
  fullTrace: AuthenticationProgramStateCommon[], base: number, slotCount: number,
): Array<{ inputIndex: number; n: bigint }> {
  const p2shStart = findRedeemScriptStart(fullTrace);
  const trace = p2shStart >= 0 ? fullTrace.slice(p2shStart) : fullTrace;
  const reads: Array<{ inputIndex: number; n: bigint }> = [];
  const seen = new Set<number>();
  for (const step of trace) {
    const instruction = step.instructions[step.ip];
    if (!instruction || instruction.opcode !== Op.OP_UTXOTOKENCATEGORY) continue;
    if (step.controlStack.some((c) => c === false)) continue;
    const top = step.stack.length - 1;
    if (top < 2) continue; // need [n, idx, idx]
    // blockhash read signature: OP_DUP duplicated the oracle input index (top === top-1). Excludes the
    // master-category check (OP_INPUTINDEX OP_UTXOTOKENCATEGORY, index not duplicated).
    if (binToHex(Uint8Array.from(step.stack[top])) !== binToHex(Uint8Array.from(step.stack[top - 1]))) continue;
    const idx = Number(decodeScriptNumber(Uint8Array.from(step.stack[top])));
    if (idx < base || idx >= base + slotCount || seen.has(idx)) continue;
    seen.add(idx);
    reads.push({ inputIndex: idx, n: decodeScriptNumber(Uint8Array.from(step.stack[top - 2])) });
  }
  return reads;
}

/**
 * Decode a Script number (little-endian, sign bit in MSB) to bigint.
 */
function decodeScriptNumber(valueBytes: Uint8Array): bigint {
  let value = 0n;
  if (valueBytes.length > 0) {
    const negative = (valueBytes[valueBytes.length - 1] & 0x80) !== 0;
    for (let j = valueBytes.length - 1; j >= 0; j--) {
      const byte = j === valueBytes.length - 1 ? valueBytes[j] & 0x7f : valueBytes[j];
      value = (value << 8n) | BigInt(byte);
    }
    if (negative) value = -value;
  }
  return value;
}

/**
 * Auto-evaluate a sorted mapping's COMPUTED key from the artifact's canonical expression label against the call
 * args, for the common hash-builtin + bytes-cast cases (e.g. balances[hash160(pk)] -> hash160(argPk)). This makes
 * a direct computed key resolve WITHOUT a manual withEntryKey (Solidity auto-resolves such keys). Returns
 * undefined when the label is not evaluable (a bare local `id:pkh` with no inlined definition, or an unsupported
 * op); the caller then falls back to entryKeyOverrides / placeholder.
 */
function evalComputedKey(
  label: string | undefined, args: FunctionArgument[], inputs: readonly { name: string }[],
): Uint8Array | undefined {
  if (!label) return undefined;
  const encode = (value: unknown): Uint8Array | undefined => {
    if (value instanceof Uint8Array) return value;
    if (typeof value === 'bigint') return bigIntToVmNumber(value);
    if (typeof value === 'number') return bigIntToVmNumber(BigInt(value));
    if (typeof value === 'boolean') return bigIntToVmNumber(value ? 1n : 0n);
    if (typeof value === 'string') return value.includes(':') ? addressToLockScript(value) : utf8ToBin(value);
    return undefined;
  };
  const splitTopLevel = (s: string): [string, string] | undefined => {
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(' || s[i] === '[' || s[i] === '{') depth++;
      else if (s[i] === ')' || s[i] === ']' || s[i] === '}') depth--;
      else if (s[i] === ',' && depth === 0) return [s.slice(0, i), s.slice(i + 1)];
    }
    return undefined;
  };
  const evalValue = (s: string): unknown => {
    let m = s.match(/^id:(.+)$/);
    if (m) {
      const idx = inputs.findIndex((i) => i.name === m![1]);
      if (idx < 0) return undefined;
      return args[idx];
    }
    m = s.match(/^lit:(.+)$/);
    if (m) {
      if (m[1] === 'true') return true;
      if (m[1] === 'false') return false;
      if (/^-?[0-9][0-9_]*$/.test(m[1])) return BigInt(m[1].replace(/_/g, ''));
      if (/^0x[0-9a-f]*$/i.test(m[1])) return hexToBin(m[1].slice(2));
      return m[1];
    }
    m = s.match(/^const:(-?[0-9][0-9_]*)$/);
    if (m) return BigInt(m[1].replace(/_/g, ''));
    m = s.match(/^cast:[a-z0-9]+\((.*)\)$/i);
    if (m) return evalValue(m[1]); // a bytes/bytesN cast is identity on the underlying value
    m = s.match(/^arridx\((.*)\)$/);
    if (m) {
      const pair = splitTopLevel(m[1]);
      if (!pair) return undefined;
      const array = evalValue(pair[0]);
      const index = evalValue(pair[1]);
      const n = typeof index === 'bigint' ? Number(index) : typeof index === 'number' ? index : NaN;
      return Array.isArray(array) && Number.isSafeInteger(n) ? array[n] : undefined;
    }
    m = s.match(/^field:([^()]+)\((.*)\)$/);
    if (m) {
      const object = evalValue(m[2]);
      return object && typeof object === 'object' ? (object as Record<string, unknown>)[m[1]] : undefined;
    }
    m = s.match(/^binop:([^()]+)\((.*)\)$/);
    if (m) {
      const pair = splitTopLevel(m[2]);
      if (!pair) return undefined;
      const left = evalValue(pair[0]);
      const right = evalValue(pair[1]);
      if (typeof left !== 'bigint' || typeof right !== 'bigint') return undefined;
      if (m[1] === '+') return left + right;
      if (m[1] === '-') return left - right;
      if (m[1] === '*') return left * right;
      return undefined;
    }
    m = s.match(/^call:(\w+)\((.*)\)$/);
    if (m) {
      const inner = encode(evalValue(m[2]));
      if (!inner) return undefined;
      switch (m[1]) {
        case 'hash160': return hash160Sync(inner);
        case 'ripemd160': return ripemd160Sync(inner);
        case 'sha256': return sha256Sync(inner);
        case 'hash256': return hash256Sync(inner);
        default: return undefined;
      }
    }
    return undefined;
  };
  return encode(evalValue(label));
}

/**
 * Compute a content-based fingerprint of all derived values for convergence detection.
 * Uses content (not just count) so that changed values with the same count are detected.
 */
function computeConvergenceKey(
  commitmentProgress: number,
  derivedTransfers?: { lockingBytecode: Uint8Array; amount: bigint }[],
  derivedFtTransfers?: { categoryId: string; lockingBytecode: Uint8Array; amount: bigint }[],
  derivedNftTransfers?: { categoryId: string; lockingBytecode: Uint8Array; commitment: Uint8Array; capability: string }[],
  stateCommitments?: string[],
  entryCommitments?: string[],
  eventCommitments?: string[],
  entryLoopCommitments?: string[],
): string {
  const parts: string[] = [String(commitmentProgress)];
  // Include actual commitment content (not just count) so that changed values
  // with the same count are detected - prevents premature convergence.
  if (stateCommitments) {
    for (const c of stateCommitments) parts.push(`sc:${c}`);
  }
  if (entryCommitments) {
    for (const c of entryCommitments) parts.push(`ec:${c}`);
  }
  if (eventCommitments) {
    for (const c of eventCommitments) parts.push(`ev:${c}`);
  }
  if (entryLoopCommitments) {
    for (const c of entryLoopCommitments) parts.push(`le:${c}`);
  }
  if (derivedTransfers) {
    for (const t of derivedTransfers) {
      parts.push(`t:${binToHex(t.lockingBytecode)}:${t.amount}`);
    }
  }
  if (derivedFtTransfers) {
    for (const t of derivedFtTransfers) {
      parts.push(`ft:${t.categoryId}:${binToHex(t.lockingBytecode)}:${t.amount}`);
    }
  }
  if (derivedNftTransfers) {
    for (const t of derivedNftTransfers) {
      parts.push(`nft:${t.categoryId}:${binToHex(t.lockingBytecode)}:${binToHex(t.commitment)}:${t.capability}`);
    }
  }
  return parts.join('|');
}

/**
 * Parse NFT capability from a token category byte array (32 bytes = no cap, 33+ bytes = cap byte at [32]).
 */
function parseNftCapability(catBytes: Uint8Array): 'none' | 'mutable' | 'minting' {
  if (catBytes.length <= 32) return 'none';
  if (catBytes[32] === 0x01) return 'mutable';
  if (catBytes[32] === 0x02) return 'minting';
  throw new Error(`Unknown NFT capability byte: 0x${catBytes[32].toString(16).padStart(2, '0')}`);
}

/**
 * Extract all expected values from `<expected> <idx> opcode OP_EQUALVERIFY` patterns.
 * Returns all stack[-2] values found for the given opcode + EQUALVERIFY combo.
 *
 * When `outputIndexRange` is provided, only captures patterns where the output index
 * (stack top at the target opcode step) falls within [min, max). This is critical for
 * OP_OUTPUTBYTECODE extraction where preservation checks (data NFTs, entries, master)
 * use the same opcode pattern as transfer checks but target different output indices.
 */
function extractVerifiedValuesFromTrace(
  fullTrace: AuthenticationProgramStateCommon[],
  targetOpcode: number,
  outputIndexRange?: { min: number; max: number },
): Uint8Array[] {
  const p2shStart = findRedeemScriptStart(fullTrace);
  const lockingScriptTrace = p2shStart >= 0 ? fullTrace.slice(p2shStart) : fullTrace;

  // Use a Map keyed by output index for "last write wins" semantics.
  // If a contract loop overwrites transfer parameters for the same output index,
  // only the final value is kept (matching extractCommitmentsFromTrace behavior).
  const valuesByIndex = new Map<number, Uint8Array>();
  const valuesNoIndex: Uint8Array[] = [];
  let sawTarget = false;
  let targetOutputIndex = -1;

  for (let i = 0; i < lockingScriptTrace.length; i++) {
    const step = lockingScriptTrace[i];
    const instruction = step.instructions[step.ip];
    if (!instruction) continue;
    // Skip instructions inside a not-taken conditional branch (see extractCommitmentsFromTrace).
    if (step.controlStack.some((c) => c === false)) continue;

    if (instruction.opcode === targetOpcode) {
      sawTarget = true;
      // Capture the output index from the stack top before the opcode executes.
      // For OP_OUTPUTBYTECODE/OP_OUTPUTVALUE/OP_OUTPUTTOKENAMOUNT, stack[-1] is the output index.
      if (step.stack.length >= 1) {
        targetOutputIndex = Number(decodeScriptNumber(Uint8Array.from(step.stack[step.stack.length - 1])));
      }
      continue;
    }

    // Reset flag if any non-EQUALVERIFY opcode appears between target and verification.
    if (sawTarget && instruction.opcode !== Op.OP_EQUALVERIFY) {
      sawTarget = false;
      continue;
    }

    if (sawTarget && instruction.opcode === Op.OP_EQUALVERIFY) {
      sawTarget = false;
      // Filter by output index range if specified
      if (outputIndexRange) {
        if (targetOutputIndex < outputIndexRange.min || targetOutputIndex >= outputIndexRange.max) {
          continue;
        }
      }
      const stack = step.stack;
      if (stack.length >= 2) {
        const value = Uint8Array.from(stack[stack.length - 2]);
        if (targetOutputIndex >= 0) {
          // "Last write wins" - overwrite any prior value for this output index
          valuesByIndex.set(targetOutputIndex, value);
        } else {
          valuesNoIndex.push(value);
        }
      }
    }
  }

  // Return values sorted by output index (preserving discovery order for unindexed)
  if (valuesByIndex.size > 0) {
    const sortedEntries = [...valuesByIndex.entries()].sort((a, b) => a[0] - b[0]);
    return sortedEntries.map(([_, v]) => v);
  }
  return valuesNoIndex;
}

/** Evaluate a probe without retaining millions of irrelevant VM states under relaxed private-network limits. */
function evaluateProbeTrace(
  provider: NetworkProvider,
  program: Parameters<ReturnType<typeof createVirtualMachineBch2026ForProvider>['evaluate']>[0],
): AuthenticationProgramStateCommon[] {
  if ((provider.consensusLimits?.maximumInputBytes ?? 10_000) <= 10_000) {
    return createVirtualMachineBch2026ForProvider(provider).debug(program) as AuthenticationProgramStateCommon[];
  }
  const trace: AuthenticationProgramStateCommon[] = [];
  const targets = new Set<number>([
    Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_OUTPUTBYTECODE, Op.OP_OUTPUTVALUE,
    Op.OP_OUTPUTTOKENAMOUNT, Op.OP_OUTPUTTOKENCATEGORY, Op.OP_EQUALVERIFY,
  ]);
  let awaitingVerification = false;
  const vm = createVirtualMachineBch2026ForProvider(provider, {
    opcodes: targets,
    beforeOperation: (unknownState) => {
      const state = unknownState as AuthenticationProgramStateCommon;
      const opcode = state.instructions[state.ip]?.opcode;
      if (opcode === Op.OP_EQUALVERIFY && !awaitingVerification) return;
      trace.push({
        ...state,
        stack: state.stack.slice(),
        alternateStack: state.alternateStack.slice(),
        controlStack: state.controlStack.slice(),
      });
      awaitingVerification = opcode !== Op.OP_EQUALVERIFY;
    },
  });
  trace.push(vm.evaluate(program) as AuthenticationProgramStateCommon);
  return trace;
}

/**
 * Parse derived commitments into a state record using the given layout.
 * @param nftIndices - The NFT indices corresponding to each commitment.
 *   If not provided, commitments[i] corresponds to nftIndex i.
 */
function commitmentsToState(
  commitments: string[],
  stateLayout: StateLayout,
  nftIndices?: number[],
): Record<string, StateValueType> {
  const derivedState: Record<string, StateValueType> = {};
  for (let i = 0; i < commitments.length; i++) {
    const nftIdx = nftIndices ? nftIndices[i] : i;
    const parsed = parsePushdataCommitment(commitments[i], stateLayout, nftIdx);
    for (const [key, value] of Object.entries(parsed)) {
      derivedState[key] = value;
    }
  }
  return derivedState;
}

export type ConnectedStatefulContract<T extends Artifact = Artifact> =
  StatefulContract<T>
  & AbiToFunctionMap<T['abi'], StatefulFunctionCall, DeployFunctionCall>
  & Omit<StateGetterMap<T>, keyof AbiToFunctionMap<T['abi'], StatefulFunctionCall, DeployFunctionCall>>;

// ethers-v6-style runner: a NetworkProvider makes the instance read-only (state / view reads); a Signer makes
// it read-write (it also carries the provider, and funds + signs sends). See the lean StatefulContract
// constructor and StatefulContract.at().
export type ContractRunner = NetworkProvider | Signer;

/** Options for the lean StatefulContract constructor / StatefulContract.at(). */
export interface LeanContractOptions {
  // Constructor args baked into the p2sh redeem script - required to SPEND (a p2sh address hashes the script,
  // so they cannot be recovered from it); omit for a no-arg contract. Reads that only need the category work
  // without them.
  constructorArgs?: ConstructorArgument[];
  addressType?: AddressType;
}

const CATEGORY_HEX = /^[0-9a-fA-F]{64}$/;

// ---- ethers-v6 events facade types ----

/**
 * A decoded contract event, ethers-`EventLog`-flavored. `args` are the decoded parameters. A Bitcoin Cash event
 * lives in an NFT UTXO (txid/vout) rather than a block-indexed log, so those replace blockNumber/logIndex.
 */
export interface EventLog {
  eventName: string;
  eventSignature: string;
  args: Record<string, StateValueType>;
  txid: string;
  vout: number;
}

/** The bound filter produced by `contract.filters.EventName(...indexedArgs)` (ethers `DeferredTopicFilter`). */
export interface DeferredEventFilter {
  eventDef: EventDefinitionAbi;
  filter: EventFilter;
}

/**
 * A callable event handle (ethers `ContractEvent`), from `contract.filters.EventName` / `contract.getEvent(name)`.
 * Call it with indexed argument values (null/undefined = match any) to build a DeferredEventFilter.
 */
export interface StatefulContractEvent {
  (...indexedArgs: Array<StateValueType | null | undefined>): DeferredEventFilter;
  eventName: string;
  signature: string;
  eventDef: EventDefinitionAbi;
}

/** An accepted event argument for queryFilter/on/off (ethers `ContractEventName`). */
export type ContractEventName = string | StatefulContractEvent | DeferredEventFilter;

/** An event listener (ethers `Listener`). */
export type EventListener = (log: EventLog) => void;

export class StatefulContract<TArtifact extends Artifact = Artifact> {
  // Backing for inner / categoryId. When constructed from an ADDRESS the category is unknown until the first
  // async op resolves it from the indexer (ethers-style lazy network use); `_inner` starts as a category-less
  // scaffold (artifact/abi/stateLayout are correct) and is rebuilt with the category on resolution.
  private _inner!: Contract<TArtifact>;
  private _categoryId = '';
  private _pendingAddress?: string;
  /** Solidity-visible CREATE identity; physical covenant addressing remains on `inner`. */
  _logicalAddress?: string;
  private _resolved = false;

  get inner(): Contract<TArtifact> { return this._inner; }

  get categoryId(): string { return this._categoryId; }

  /**
   * X176. Read an ABI entry's `writesState` for what it actually answers.
   *
   * THE FLAG IS MISNAMED FOR THE QUESTION COMPOSERS ASK IT. `writesState: true` means "not provably read-only",
   * which in SDK terms is "needs the state machinery" - it is set by an external call, a child deploy, a
   * library delegate, a low-level call, a split/merge or a covenant-bypass modifier just as readily as by an
   * assignment. `Foo.callBar` publishes `true` with a body of `bar.log();` and not one assignment. Reading the
   * flag as "this handler mutates state" over-counts, and the over-count is not small: of the seven handlers
   * the L2-F2 partition counts as explicit writers, at least two write nothing.
   *
   * ONLY `false` IS A PROOF, AND ONLY IN ONE DIRECTION. That is the reading `_prepareCall`'s derivation skip
   * uses, and the only one this SDK acts on. Everything else is evidence to be read, which is what this
   * returns: each published cause, split by whether it is a change to the handler's OWN persisted state.
   * `unattributed` is the honest residue - the ABI publishes no "assigns a state variable" field at all, so a
   * plain `this.x = y` is indistinguishable from a bus-mode journal reservation from the outside.
   *
   * NOT RENAMED, DELIBERATELY. The flag's conservative direction is correct for its one consumer and the name
   * is published in every artifact on disk; re-deriving it toward "mutates" would make that consumer fail OPEN
   * (a handler whose only cause is an external call would be skipped and its call group never derived). The
   * distinction is published alongside it instead.
   *
   * Pass the artifact when you have it: `stateLayout.dataNftCount === 0` settles the question structurally,
   * because a contract with no data NFT has no state variable for any handler to change.
   */
  static readWritesState(abi: AbiFunction, artifact?: Artifact): StateEffectReading {
    const evidence = new Set<StateEffectEvidence>();
    // `sortedBatchInfo` is a STRAIGHT-LINE C2 write sharing one list transition, not a loop, so it belongs
    // with `entry-write`; classifying it as a loop write reported two causes for one `m[k] = v`.
    if (abi.entryAccesses?.some((ea) => ea.operations.some((op) => op !== 'read'))
      || (abi.sortedBatchInfo?.length ?? 0) > 0) evidence.add('entry-write');
    if ((abi.entryLoopWrites?.length ?? 0) > 0 || (abi.sortedInsertLoops?.length ?? 0) > 0) {
      evidence.add('entry-loop-write');
    }
    if ((abi.dynamicWrites?.length ?? 0) > 0) evidence.add('dynamic-write');
    if (abi.modifiers?.some((m) => LIFECYCLE_MODIFIERS.includes(m))) evidence.add('lifecycle-modifier');
    if (abi.splitCountParam !== undefined || abi.mergeCountParam !== undefined) evidence.add('split-merge');
    if ((abi.emits?.length ?? 0) > 0) evidence.add('emit');
    if ((abi.transferCount ?? 0) > 0 || (abi.transfers?.length ?? 0) > 0) evidence.add('transfer');
    if ((abi.tokenContainerAccesses?.length ?? 0) > 0) evidence.add('token-container');
    if ((abi.deployTargets?.length ?? 0) > 0) evidence.add('deploy');
    if ((abi.externalCalls?.length ?? 0) > 0) evidence.add('external-call');
    if ((abi.libraryDelegateCalls?.length ?? 0) > 0 || (abi.lowLevelCalls?.length ?? 0) > 0) {
      evidence.add('delegate-or-low-level');
    }

    const all = [...evidence];
    const needsStateMachinery = abi.writesState !== false;
    return {
      published: abi.writesState,
      needsStateMachinery,
      provablyReadOnly: abi.writesState === false,
      ownStateEvidence: all.filter((cause) => OWN_STATE_EVIDENCE.includes(cause)),
      otherEffectEvidence: all.filter((cause) => !OWN_STATE_EVIDENCE.includes(cause)),
      unattributed: needsStateMachinery && all.length === 0,
      contractHasNoState: artifact !== undefined && (artifact.stateLayout?.dataNftCount ?? 0) === 0,
    };
  }

  state!: StateGetterMap<TArtifact>;
  call!: AbiToFunctionMap<TArtifact['abi'], StatefulFunctionCall, DeployFunctionCall>;
  // ethers-v5 `contract.callStatic.fn(...)`: read a view function's return value directly (no send). Each entry
  // returns a Promise of the decoded value (single output) or array (tuple), like `sc.fn(...).staticCall()`.
  callStatic!: { [fn: string]: (...args: FunctionArgument[]) => Promise<StateValueType> };
  functions!: AbiToFunctionMap<TArtifact['abi'], Promise<StatefulTransactionBuilder>>;
  tokens!: { [tokenContainerCategoryIdHex: string]: TokenContainerAccessor };

  private _externalRegistry: Map<string, ConnectedStatefulContract> = new Map();

  /**
   * Register the callee instances for an array-element external call `IFoo(arr[i]).m()` (in array order).
   * Stored in the base Contract's unified external-target registry (keyed by each instance's address), shared
   * with opaque loop dispatch (contract.multiCall). The covenant verifies each co-spent callee against arr[i],
   * so the registration order must match the on-chain array.
   */
  // Register the callees for a foreign fn-ptr array `IFoo(fns[i]).m()`, in on-chain array order. For a
  // varying-method dispatch table pass `methods` (one per element) so each callee is co-spent with its own
  // method (the covenant verifies each against the on-chain selector array); omit `methods` for a fixed-method
  // table (it uses the ABI slot's single method).
  registerExternalArray(interfaceName: string, instances: ConnectedStatefulContract[], methods?: string[]): void {
    instances.forEach((inst, i) => {
      this.inner.registerExternalTarget({
        address: inst.inner.lockingBytecode, interfaceName, instance: inst, method: methods?.[i],
      });
    });
  }

  // Deployed delegate-library instances, keyed by library name. A consumer's `L.f()` (artifact
  // libraryDelegateCalls) auto-wires its delegatecall co-spend from here, so the caller need not name the
  // library function again via withDelegatecall. See docs/library-contracts.md (3b auto-wire).
  private _libraryRegistry: Map<string, StatefulContract> = new Map();

  /**
   * Internal-order brand bytes for a branded library's `__brand` constructor argument. The brand-check compares
   * the proxy master's OP_UTXOTOKENCATEGORY (internal byte order) to `__brand`, which is reversed from the
   * display categoryId. Use as: new Contract(brandedLibArt, [StatefulContract.libraryBrand(consumerCategoryId)]).
   */
  static libraryBrand(categoryId: string): Uint8Array {
    return hexToBin(categoryId).reverse();
  }

  /**
   * Construct a delegate library branded to its owning consumer's category - appends the `__brand` constructor
   * argument (StatefulContract.libraryBrand) so the caller need not thread it manually. `otherArgs` are the
   * library's other constructor arguments (usually none), in declared order before `__brand`. Deploy / set up
   * the returned Contract as usual, then registerLibrary it on the consumer.
   */
  static brandedLibrary(
    artifact: Artifact, consumerCategoryId: string, options: ContractOptions,
    otherArgs: ConstructorArgument[] = [],
  ): Contract {
    if (!artifact.brandedLibrary) {
      throw new Error(
        `Artifact '${artifact.contractName}' is not a branded library; compile it with { brandLibrary: true }.`,
      );
    }
    return new Contract(artifact, [...otherArgs, StatefulContract.libraryBrand(consumerCategoryId)], options);
  }

  /** Register a deployed delegate library so `L.f()` calls in this contract auto-wire their delegatecall. */
  registerLibrary(name: string, instance: StatefulContract): this {
    // A branded library must be branded to THIS consumer's category, else its master-gate would reject the
    // co-spend at send time; catch the mis-branding early.
    if (instance.inner.artifact.brandedLibrary && this.categoryId) {
      const idx = instance.inner.artifact.constructorInputs.findIndex((i) => i.name === '__brand');
      const supplied = idx >= 0 ? instance.inner.constructorArgs[idx] : undefined;
      const expected = StatefulContract.libraryBrand(this.categoryId);
      if (!(supplied instanceof Uint8Array) || binToHex(supplied) !== binToHex(expected)) {
        throw new Error(
          `Branded library '${name}' is not branded to this contract's category. Construct it with `
          + `StatefulContract.libraryBrand('${this.categoryId}') as its __brand constructor argument.`,
        );
      }
    }
    this._libraryRegistry.set(name, instance);
    return this;
  }

  /** Look up a registered delegate library by name (used by the call builder's auto-wire). */
  _getLibrary(name: string): StatefulContract | undefined {
    return this._libraryRegistry.get(name);
  }

  // Child artifacts a deploy function may instantiate, keyed by contract name. deployFrom resolves the child
  // (and derives its constructor args) from here via the deploy function's deployTarget, so a call need not
  // repeat childArtifact / childConstructorArgs each time.
  private _childRegistry: Map<string, Artifact> = new Map();

  // Default funder / changeAddress for deployFrom calls on this factory, so they need not be repeated.
  private _deployDefaults: { funder?: Unlocker; changeAddress?: string } = {};

  /** Register a child contract artifact so deployFrom can resolve it by the deploy function's deployTarget. */
  registerChild(artifact: Artifact): this {
    this._childRegistry.set(artifact.contractName, artifact);
    return this;
  }

  /**
   * Register a whole `ArtifactMap` (from `compileStringMulti`/`compileFileMulti`) at once, so deployFrom can
   * resolve any child contract from it by the deploy target's name - one call instead of per-child
   * registerChild. The compiler already knows the dependency graph, so the map is the canonical source; see
   * docs/multi-contract-artifacts.md. Stateless entries (interfaces, libraries) are kept too (harmless lookups).
   */
  registerArtifacts(map: ArtifactMap): this {
    for (const artifact of Object.values(map)) {
      this._childRegistry.set(artifact.contractName, artifact);
    }
    return this;
  }

  /** Look up a registered child artifact by contract name. */
  _getChild(contractName: string): Artifact | undefined {
    return this._childRegistry.get(contractName);
  }

  /** Set default funder / changeAddress for deployFrom calls on this factory (override per call as needed). */
  setDeployDefaults(defaults: { funder?: Unlocker; changeAddress?: string }): this {
    this._deployDefaults = { ...this._deployDefaults, ...defaults };
    return this;
  }

  /** The deploy defaults set via setDeployDefaults (used by deployFrom). */
  get deployDefaults(): { funder?: Unlocker; changeAddress?: string } {
    return this._deployDefaults;
  }

  /**
   * Execute a deploy-modifier function: resolve the child + funding and run deployFrom. Powers the thenable
   * `await factory.deployFn(...args)` (funded by the connected signer) and the explicit
   * `factory.deployFn(...args).deploy({ fundingUtxo, ... })`. With no explicit fundingUtxo it picks a
   * genesis-valid UTXO from the signer and uses the signer's p2pkh unlocker + address for funder + change.
   */
  async _deployFromSigner<T extends Artifact>(
    functionName: string,
    args: FunctionArgument[],
    override: DeployFromCallOptions<T> = {} as DeployFromCallOptions<T>,
  ): Promise<DeployFromResult<T>> {
    const base = {
      provider: this.provider,
      factory: this as unknown as ConnectedStatefulContract,
      deployFunctionName: functionName,
      deployFunctionArgs: args,
    };
    // Explicit funding: a single fundingUtxo, or fundingUtxos: [...] for a loop/multi deploy (N children need N
    // funding inputs - a balanced block). N is runtime-dependent, so the signer can't auto-select it; the caller
    // supplies one input per firing deploy. Either explicit form flows straight through.
    if (override.fundingUtxo || (override.fundingUtxos && override.fundingUtxos.length > 0)) {
      return StatefulContract.deployFrom({ ...base, ...override });
    }
    if (!this._signer) {
      throw new Error(
        `Deploying '${functionName}' needs a funding UTXO or a signer: connect(signer) then `
        + `await factory.${functionName}(...), or pass .deploy({ fundingUtxo, funder, changeAddress }).`,
      );
    }
    const fundingUtxo = await this._selectGenesisFundingUtxo(functionName);
    return StatefulContract.deployFrom({
      ...base,
      ...(override as Omit<DeployFromCallOptions<T>, 'fundingUtxo'>), // fundingUtxo is unset in this branch
      fundingUtxo,
      funder: override.funder ?? this._signer.unlockP2PKH(),
      changeAddress: override.changeAddress ?? this._signer.getAddress(),
    });
  }

  /** Pick a genesis-valid (vout 0, token-free) funding UTXO from the signer with enough satoshis to deploy. */
  private async _selectGenesisFundingUtxo(functionName: string): Promise<Utxo> {
    const signer = this._signer!;
    const utxos = await signer.getUtxos();
    const target = this.inner.artifact.abi.find((f) => f.name === functionName)?.deployTargets?.[0];
    const childArt = target ? this._getChild(target.contractName) : undefined;
    const dataNfts = BigInt(childArt?.stateLayout?.dataNftCount ?? target?.dataNftCount ?? 1);
    const cost = 1200n + 1200n * dataNfts + 5000n + 2400n; // master + data NFTs + fee + entry buffer
    const utxo = utxos.find((u) => u.vout === 0 && !u.token && u.satoshis >= cost);
    if (!utxo) {
      throw new Error(
        `Signer has no genesis-valid funding UTXO (vout 0, token-free, >= ${cost} sats) at `
        + `${signer.getAddress()} to deploy '${functionName}'. A token genesis requires a fresh vout-0 UTXO.`,
      );
    }
    return utxo;
  }

  /** Bound signer for automatic transaction funding. Set via `connect(signer)`. */
  _signer?: Signer;
  /** Signer identity retained for logical nonce parity without changing legacy funding behavior. */
  _logicalNonceSigner?: Signer;

  /**
   * Maximum number of VM probe iterations for auto-derivation.
   * Each iteration captures commitments up to the first mismatch; convergence
   * typically occurs within 3-5 iterations. Default: 20.
   * Increase only if your contract has many interdependent state variables.
   */
  maxDerivationIterations: number = 20;

  // ethers-v6-flavored constructor. Two forms:
  //  - internal `(contract, categoryId)` - used by withCategory / from / deploy.
  //  - lean `(categoryId, artifact, runner, options?)` - build from a category + artifact with a NetworkProvider
  //    (read-only) or Signer (read-write) runner. To attach by ADDRESS use `StatefulContract.at(address, ...)`
  //    (async - the category is read from the indexer).
  // Every instance is returned wrapped in a Proxy so `sc.doStuff(...)` / `sc.myVar()` dispatch to the ABI
  // function / state getter on the bare name (v6 dispatch). A framework member wins a name collision; the
  // shadowed function stays reachable via `sc.getFunction(name)`.
  constructor(contract: Contract<TArtifact>, categoryId: string);
  constructor(
    addressOrCategory: string, artifact: TArtifact, runner: ContractRunner, options?: LeanContractOptions);
  constructor(
    a: Contract<TArtifact> | string,
    b: string | TArtifact,
    runner?: ContractRunner,
    options?: LeanContractOptions,
  ) {
    if (typeof a === 'string') {
      // Lean form: `a` is an ADDRESS (category resolved lazily from the indexer, ethers-style) or a 64-char
      // category id (used directly). A NetworkProvider runner is read-only-first; a Signer adds funding/signing.
      const provider = runner instanceof Signer ? runner.provider : (runner as NetworkProvider);
      if (runner instanceof Signer) this._signer = runner;
      const bare = new Contract(b as TArtifact, (options?.constructorArgs ?? []) as any, {
        provider, addressType: options?.addressType ?? 'p2sh32',
      });
      StatefulContract._assertStateful(bare);
      if (CATEGORY_HEX.test(a)) {
        this._inner = bare.withCategory(hexToBin(a));
        this._categoryId = a;
        this._resolved = true;
      } else {
        this._inner = bare; // scaffold: correct artifact/abi/stateLayout; category resolved on first async use
        this._pendingAddress = a;
      }
    } else {
      StatefulContract._assertStateful(a);
      this._inner = a;
      this._categoryId = b as string;
      this._resolved = true;
    }

    this._buildNamespaces(this._inner);

    // eslint-disable-next-line no-constructor-return
    return this._withDispatchProxy();
  }

  private static _assertStateful<T extends Artifact>(contract: Contract<T>): void {
    if (!contract.isStateful || !contract.stateLayout) {
      throw new Error(`Contract ${contract.name} is not a stateful contract`);
    }
    if (contract.addressType !== 'p2sh32') {
      throw new Error(
        `Stateful contract '${contract.name}' must use p2sh32 address type. Got '${contract.addressType}'.`,
      );
    }
  }

  // Resolve the token category from the indexer (getUtxos) the first time an address-constructed instance needs
  // it, then rebuild `inner` with the category baked in. A no-op once resolved / for category-constructed
  // instances. Called at the top of every async operation that needs the category.
  async _ensureResolved(): Promise<void> {
    if (this._resolved) return;
    const pendingAddress = this._pendingAddress!;
    try {
      const identity = await resolveLogicalIdentity(this._inner.provider, pendingAddress);
      this._categoryId = identity.categoryId;
      const connected = this._inner.withCategory(hexToBin(this._categoryId));
      if (binToHex(addressToLockScript(connected.address)) !== binToHex(identity.rootLockingBytecode)) {
        throw new Error(
          `Logical identity ${pendingAddress} binds category ${this._categoryId} to a different root bytecode.`,
        );
      }
      this._inner = connected;
      this._logicalAddress = pendingAddress;
      this._resolved = true;
      return;
    } catch (error) {
      // A physical contract address has no SCID anchor; retain legacy category discovery. An address containing
      // SCID-looking but invalid/ambiguous records must fail closed rather than silently selecting another token.
      const utxos = await this._inner.provider.getUtxos(pendingAddress);
      const hasIdentityRecord = utxos.some((utxo) => utxo.token?.nft?.commitment?.startsWith('53434944'));
      if (hasIdentityRecord) throw error;
    }
    this._categoryId = await resolveCategoryFromAddress(this._inner.provider, pendingAddress);
    this._inner = this._inner.withCategory(hexToBin(this._categoryId));
    this._resolved = true;
  }

  // Match a getEntries() entry against the key args passed to a mapping getter. Single-key entries expose `key`,
  // nested/composite entries expose `keys`. A string arg is UTF-8 encoded (mirrors setEntry) so `sc.m("foo")`
  // matches a bytesN key stored from the same literal; bigint/boolean compare by value, Uint8Array byte-wise.
  private static _entryMatchesKeys(
    entry: { slot?: Uint8Array; key?: bigint | boolean | Uint8Array; keys?: Array<bigint | boolean | Uint8Array> },
    keys: Array<bigint | boolean | Uint8Array | string>,
    keyTypes?: readonly string[],
  ): boolean {
    if (entry.slot) {
      const encoded = keys.map((arg, i) => {
        if (typeof arg === 'string') {
          return keyTypes?.[i] === 'address' && arg.includes(':') ? addressToLockScript(arg) : utf8ToBin(arg);
        }
        if (arg instanceof Uint8Array) return arg;
        if (typeof arg === 'bigint') return bigIntToVmNumber(arg);
        return bigIntToVmNumber(arg ? 1n : 0n);
      });
      return binsAreEqual(entry.slot, keyToSlotMulti(encoded));
    }
    const entryKeys = entry.keys ?? (entry.key !== undefined ? [entry.key] : []);
    if (entryKeys.length !== keys.length) return false;
    return entryKeys.every((stored, i) => {
      const arg = keys[i];
      const user = typeof arg === 'string' ? new TextEncoder().encode(arg) : arg;
      if (stored instanceof Uint8Array) {
        return user instanceof Uint8Array && stored.length === user.length && stored.every((v, j) => v === user[j]);
      }
      return stored === user;
    });
  }

  // Build the state / call / functions / tokens namespaces from the (resolved) inner contract's artifact.
  // Bare-name dispatch is handled by the Proxy (see _withDispatchProxy), so nothing is mirrored on `this`.
  private _buildNamespaces(contract: Contract<TArtifact>): void {
    this.state = {} as StateGetterMap<TArtifact>;
    for (const variable of contract.stateLayout!.variables) {
      // @ts-ignore - dynamic property assignment for type-safe getters
      // An `address` state value is a full locking bytecode (e.g. a P2PKH `76a914..88ac`), returned VERBATIM -
      // never decoded/wrapped into a CashAddress or pubkey-hash. It equals `signer.getLockingBytecode()` and the
      // msg.sender / addressToLockScript(arg) forms byte-for-byte, so comparisons work on the raw locking bytecode.
      this.state[variable.name] = async (): Promise<any> => (await this.getState())[variable.name];
    }
    // Solidity-getter parity for mappings: `sc.<mapping>(...keys)` reads the entry value at the given key(s)
    // (sugar over getEntries), or undefined when no entry exists. Nested/composite keys pass multiple args.
    // Array collections keep the getEntries form for now (indexed array getters are a separate open item).
    for (const coll of contract.stateLayout!.collections ?? []) {
      if (coll.kind !== 'mapping') continue;
      // @ts-ignore - dynamic property assignment (mapping getter takes key args, unlike the scalar getters)
      this.state[coll.name] = async (...keys: Array<bigint | boolean | Uint8Array | string>): Promise<any> => {
        const entries = await this.getEntries(coll.name);
        const match = entries.find((e) => StatefulContract._entryMatchesKeys(
          e, keys, coll.keyTypes ?? [coll.keyType],
        ));
        return match ? match.value : undefined;
      };
    }

    // A deploy-modifier function returns a thenable DeployFunctionCall (funds + runs via the connected signer);
    // every other function returns a StatefulFunctionCall wrapping a lazily-built transaction builder.
    this.call = {} as AbiToFunctionMap<TArtifact['abi'], StatefulFunctionCall, DeployFunctionCall>;
    this.functions = {} as AbiToFunctionMap<TArtifact['abi'], Promise<StatefulTransactionBuilder>>;
    for (const abiFunction of contract.artifact.abi) {
      const caller = abiFunction.modifiers?.includes('deploy')
        ? (...args: any[]): DeployFunctionCall => new DeployFunctionCall(
          this as StatefulContract, abiFunction.name, args as FunctionArgument[],
        )
        : (...args: any[]): StatefulFunctionCall => new StatefulFunctionCall(
          this._createBuilder(abiFunction.name, args),
          this as StatefulContract, abiFunction.name, args,
        );
      // @ts-ignore - dynamic property assignment
      this.call[abiFunction.name] = caller;
      // @ts-ignore - dynamic property assignment
      this.functions[abiFunction.name] = (...args: any[]) => this._createBuilder(abiFunction.name, args);
    }

    // ethers-v5 `contract.callStatic.fn(...)` read namespace (each fn reads its return value without sending).
    this.callStatic = {};
    for (const abiFunction of contract.artifact.abi) {
      this.callStatic[abiFunction.name] = (...args: FunctionArgument[]): Promise<StateValueType> =>
        this._deriveReturnValue(abiFunction.name, args) as Promise<StateValueType>;
    }

    // Token container sugar (sc.tokens[categoryHex]).
    this.tokens = new Proxy({} as Record<string, TokenContainerAccessor>, {
      get: (_target, prop) => (typeof prop === 'string' ? new TokenContainerAccessor(this, prop) : undefined),
    });
  }

  // Wrap the instance in a Proxy so a bare `sc.name` resolves to the ABI function / state getter when `name` is
  // not a framework member (v6 dispatch: contract routine wins the bare name). Framework members (in the target)
  // win a collision; the shadowed function is reachable via getFunction(). Internal `this.*` access binds to the
  // target, so this never affects the class's own methods.
  private _withDispatchProxy(): this {
    const abiNames = new Set(this.inner.artifact.abi.map((f) => f.name));
    const stateNames = new Set((this.inner.stateLayout?.variables ?? []).map((v) => v.name));
    // Mapping collections also dispatch as bare-name getters (`sc.<mapping>(key)`); both resolve via `this.state`.
    for (const c of this.inner.stateLayout?.collections ?? []) if (c.kind === 'mapping') stateNames.add(c.name);
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && !(prop in target)) {
          if (abiNames.has(prop)) return (target.call as any)[prop];
          if (stateNames.has(prop)) return (target.state as any)[prop];
        }
        return Reflect.get(target, prop, receiver);
      },
      has(target, prop) {
        if (typeof prop === 'string' && (abiNames.has(prop) || stateNames.has(prop))) return true;
        return Reflect.has(target, prop);
      },
    });
  }

  /**
   * Resolve an ABI function by name, bypassing any framework-member collision (ethers-v6 escape hatch). Use this
   * when a contract function shares a name with a StatefulContract member (e.g. `connect`): `sc.connect` is the
   * framework method, `sc.getFunction('connect')(...)` is the contract routine.
   */
  getFunction(name: string): (...args: any[]) => StatefulFunctionCall | DeployFunctionCall {
    const fn = (this.call as Record<string, (...args: any[]) => StatefulFunctionCall | DeployFunctionCall>)[name];
    if (!fn) {
      const available = this.inner.artifact.abi.map((f) => f.name).join(', ');
      throw new Error(`No function '${name}' on ${this.inner.name}. Available: ${available}.`);
    }
    return fn;
  }

  /**
   * Execute several eligible public handlers against one physical owner input.
   * The compiler-owned SCB1 route is selected only when advertised by the
   * artifact; one ordinary invocation should continue to use its direct ABI
   * wrapper.
   */
  batch(
    invocations: readonly { function: string; args?: readonly FunctionArgument[] }[],
  ): StatefulFunctionCall {
    const { blob, routeWitnesses } = encodeHiddenBatch(this.inner.artifact, invocations);
    return this._batchRaw(blob, routeWitnesses);
  }

  /** @internal Adversarial-test hook: execute an exact candidate blob through
   * the positional SCB1 route without canonical SDK construction. */
  _batchRaw(
    blob: Uint8Array,
    routeWitnesses: readonly FunctionArgument[] = [],
    internalRouteWitnesses: Readonly<Record<string, FunctionArgument>> = {},
    blockBase = 0,
    emitReturn = false,
    returnBlob?: Uint8Array,
    omitLocalFeeTail = false,
  ): StatefulFunctionCall {
    const capability = this.inner.artifact.hiddenBatch;
    if (!capability) throw new Error('This artifact does not advertise the compiler-hidden SCB1 batch route');
    const expectedWitnesses = capability.route.inputs
      .filter((input) => input.name !== 'batchBlob' && !input.name.startsWith('__internal__')).length;
    if (routeWitnesses.length !== expectedWitnesses) {
      throw new Error(
        `SCB1 route requires ${expectedWitnesses} collection witnesses, `
        + `got ${routeWitnesses.length}`,
      );
    }
    let routeWitness = 0;
    const routeArgs = Object.keys(internalRouteWitnesses).length === 0
      ? [blob, ...routeWitnesses]
      : capability.route.inputs.map((input): FunctionArgument => {
        if (input.name === 'batchBlob') return blob;
        if (input.name.startsWith('__internal__')) {
          const value = internalRouteWitnesses[input.name];
          if (value === undefined) {
            throw new Error(`SCB1 route requires compiler-owned witness '${input.name}'`);
          }
          return value;
        }
        const value = routeWitnesses[routeWitness];
        routeWitness += 1;
        return value;
      });
    const rowCount = blob.length > 6 ? blob[6] : 0;
    // Recover the reached selectors from the canonical blob so conditional token-transfer slots are derived only
    // for rows that actually execute such a handler. Leaving the inactive suffix as 1-token probe placeholders
    // would silently debit the container even though the covenant correctly skipped those slots.
    const reachedHandlers: typeof capability.handlers = [];
    let cursor = 7;
    // X199. Intersect with eligibility: the compiler's logical value mode is computed over the FINAL
    // survivors, so a published-but-refused payable handler must not size the admitted route's rows.
    const valueMode = capability.handlers.some((handler) => handler.eligible && handler.usesMsgValue);
    for (let row = 0; row < rowCount && cursor + (valueMode ? 21 : 12) <= blob.length; row++) {
      const selector = binToHex(blob.slice(cursor, cursor + 4));
      const handler = capability.handlers.find((candidate) => candidate.selector === selector);
      if (handler) reachedHandlers.push(handler);
      const argsLengthOffset = cursor + 10;
      const argsLength = blob[argsLengthOffset] | (blob[argsLengthOffset + 1] << 8);
      cursor += (valueMode ? 21 : 12) + argsLength;
    }
    const reachedFtTransfers = reachedHandlers.reduce((sum, handler) =>
      sum + (handler.tokenContainerAccesses ?? []).reduce((inner, access) =>
        inner + (access.transferCount ?? (access.operations.includes('transfer') ? 1 : 0)), 0), 0);
    const reachedNftTransfers = reachedHandlers.reduce((sum, handler) =>
      sum + (handler.tokenContainerAccesses ?? []).reduce((inner, access) =>
        inner + (access.transferNftCount ?? (access.operations.includes('transferNft') ? 1 : 0)), 0), 0);
    const reachedEventOutputs = reachedHandlers.reduce(
      (sum, handler) => sum + (handler.emits?.length ?? 0),
      0,
    );
    const effectiveTokenAccesses = capability.route.tokenContainerAccesses?.map((access, index) => ({
      ...access,
      // The current compiler route admits one canonical token-category witness. Preserve that explicit
      // restriction in metadata rather than guessing how to distribute effects across multiple containers.
      transferCount: index === 0 ? reachedFtTransfers : 0,
      transferNftCount: index === 0 ? reachedNftTransfers : 0,
    }));
    // Effect routes reserve eight conditional covenant slots, but the SDK
    // materializes only the prefix reached by this canonical blob. The
    // compiler route bytecode and block offsets remain unchanged; the sliced
    // ABI metadata controls witness construction/derivation only.
    const effectiveRoute: AbiFunction = {
      ...capability.route,
      ...(capability.route.transferCount !== undefined && {
        transferCount: Math.min(capability.route.transferCount, rowCount),
      }),
      ...(capability.route.emits && {
        emits: capability.route.emits.slice(0, reachedEventOutputs),
      }),
      ...(effectiveTokenAccesses && { tokenContainerAccesses: effectiveTokenAccesses }),
    };
    const graphBlockhashSelections = selectGraphBlockhashReads(this.inner.artifact, blob);
    if (graphBlockhashSelections.length > 0) {
      (effectiveRoute as AbiFunction & { graphBlockhashSelections: GraphBlockhashSelection[] })
        .graphBlockhashSelections = graphBlockhashSelections;
    }
    const routeSelector = hexToBin(capability.selector);
    return new StatefulFunctionCall(
      this._createBuilder('__scb1', routeArgs, {
        abiFunction: effectiveRoute,
        compilerRouteSelector: routeSelector,
        blockBase,
        emitReturn,
        returnBlob,
        omitLocalFeeTail,
      }),
      this as unknown as StatefulContract, '__scb1', routeArgs,
      { abiFunction: effectiveRoute, selector: routeSelector, blockBase, emitReturn, returnBlob, omitLocalFeeTail },
    );
  }

  private static _uintLe(value: bigint, width: number): Uint8Array {
    if (value < 0n || value >= (1n << BigInt(width * 8))) throw new Error(`Unsigned ${width}-byte overflow`);
    const result = new Uint8Array(width);
    let rest = value;
    for (let i = 0; i < width; i++) {
      result[i] = Number(rest & 0xffn);
      rest >>= 8n;
    }
    return result;
  }

  private static _concatBytes(...parts: Uint8Array[]): Uint8Array {
    const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }

  private static _signedLogicalValue(value: bigint): Uint8Array {
    const magnitude = value < 0n ? -value : value;
    if (magnitude > 0x7fff_ffff_ffff_ffffn) {
      throw new Error('SCB1 logical msg.value exceeds the signed 64-bit satoshi envelope');
    }
    return StatefulContract._concatBytes(
      Uint8Array.of(value < 0n ? 1 : 0),
      StatefulContract._uintLe(magnitude, 8),
    );
  }

  /**
   * Lean attach (ethers-v6 `new Contract(address, abi, runner)`). Resolve a deployed stateful contract from its
   * ADDRESS or category id + artifact + runner: a NetworkProvider is read-only (state / view reads), a Signer is
   * read-write. Given an address, the token category is read from the indexer (getUtxos); given a 64-char
   * category id it is used directly. `constructorArgs` are required to SPEND (a p2sh address hashes the redeem
   * script) - omit them for a no-arg contract or read-only use.
   */
  static async at<T extends Artifact>(
    addressOrCategory: string, artifact: T, runner: ContractRunner, options?: LeanContractOptions,
  ): Promise<ConnectedStatefulContract<T>> {
    const sc = new StatefulContract(addressOrCategory, artifact, runner, options) as ConnectedStatefulContract<T>;
    await (sc as StatefulContract)._ensureResolved(); // eager: at() returns a fully-resolved instance
    return sc;
  }

  static withCategory<T extends Artifact>(
    contract: Contract<T>, categoryId: string,
    options?: StatefulConnectOptions,
  ): ConnectedStatefulContract<T> {
    // Self-pin: category baked as the verify prologue (address => genuine state); user `salt` (if any)
    // stays a separate CREATE2 segment.
    const finalContract = contract.withCategory(hexToBin(categoryId));
    const sc = new StatefulContract(finalContract, categoryId) as ConnectedStatefulContract<T>;
    if (options?.externals) {
      for (const [name, ext] of Object.entries(options.externals)) {
        if ((sc as StatefulContract)._externalRegistry.has(name)) {
          console.warn(
            `Warning: external contract '${name}' is being overwritten in connect(). `
            + 'Check for duplicate entries in externals/externalContracts.',
          );
        }
        (sc as StatefulContract)._externalRegistry.set(name, ext);
      }
    }
    if (options?.externalContracts) {
      StatefulContract._buildExternalGraph(sc as StatefulContract, options.externalContracts);
    }
    return sc;
  }

  static from<T extends Artifact>(
    artifact: T,
    constructorArgs: ConstructorArgument[],
    options: ContractOptions & StatefulConnectOptions,
    categoryId: string,
  ): ConnectedStatefulContract<T> {
    const { externals, externalContracts, ...contractOptions } = options;
    // Self-pin: category baked as the verify prologue; user `salt` (if any) stays a separate CREATE2 segment.
    const finalOptions = { ...contractOptions, category: hexToBin(categoryId) };
    const contract = new Contract(artifact, constructorArgs as any, finalOptions);
    const sc = new StatefulContract(contract, categoryId) as ConnectedStatefulContract<T>;
    if (externals) {
      for (const [name, ext] of Object.entries(externals)) {
        (sc as StatefulContract)._externalRegistry.set(name, ext);
      }
    }
    if (externalContracts) {
      StatefulContract._buildExternalGraph(sc as StatefulContract, externalContracts);
    }
    return sc;
  }

  /**
   * Return a new instance bound to a different runner (ethers.js `contract.connect(runner)`). A Signer binds
   * automatic funding + signing; a NetworkProvider rebinds read-only (delegates to withProvider).
   *
   * ```typescript
   * await sc.connect(signer).increment().send();
   * ```
   */
  connect(runner: ContractRunner): ConnectedStatefulContract<TArtifact> {
    if (!(runner instanceof Signer)) return this.withProvider(runner);
    const signer = runner;
    const sc = StatefulContract.from(
      this.inner.artifact,
      this.inner.constructorArgs,
      { provider: signer.provider, addressType: this.inner.addressType, salt: this.inner.salt },
      this.categoryId,
    );
    for (const [name, ext] of this._externalRegistry) {
      (sc as StatefulContract)._externalRegistry.set(name, ext);
    }
    for (const [name, lib] of this._libraryRegistry) {
      (sc as StatefulContract)._libraryRegistry.set(name, lib);
    }
    for (const [name, art] of this._childRegistry) {
      (sc as StatefulContract)._childRegistry.set(name, art);
    }
    (sc as StatefulContract)._deployDefaults = { ...this._deployDefaults };
    (sc as StatefulContract)._signer = signer;
    (sc as StatefulContract)._logicalNonceSigner = signer;
    return sc;
  }

  /** Return a new instance with the same target but a different provider. */
  withProvider(runner: NetworkProvider): ConnectedStatefulContract<TArtifact> {
    const sc = StatefulContract.from(
      this.inner.artifact,
      this.inner.constructorArgs,
      { provider: runner, addressType: this.inner.addressType, salt: this.inner.salt },
      this.categoryId,
    );
    for (const [name, ext] of this._externalRegistry) {
      (sc as StatefulContract)._externalRegistry.set(name, ext);
    }
    for (const [name, lib] of this._libraryRegistry) {
      (sc as StatefulContract)._libraryRegistry.set(name, lib);
    }
    if (this._signer) (sc as StatefulContract)._signer = this._signer;
    if (this._logicalNonceSigner) (sc as StatefulContract)._logicalNonceSigner = this._logicalNonceSigner;
    return sc;
  }

  /**
   * Return a new instance with the same ABI and runner but a different target (categoryId).
   * Analogous to ethers.js `contract.attach(target)`.
   */
  attach(target: string): ConnectedStatefulContract<TArtifact> {
    const sc = StatefulContract.from(
      this.inner.artifact,
      this.inner.constructorArgs,
      { provider: this.inner.provider, addressType: this.inner.addressType },
      target,
    );
    // Preserve external registry across re-attachments
    for (const [name, ext] of this._externalRegistry) {
      (sc as StatefulContract)._externalRegistry.set(name, ext);
    }
    for (const [name, lib] of this._libraryRegistry) {
      (sc as StatefulContract)._libraryRegistry.set(name, lib);
    }
    return sc;
  }


  static async deploy<T extends Artifact>(
    artifact: T,
    constructorArgs: ConstructorArgument[],
    options: DeployOptions,
  ): Promise<DeployResult<T>> {
    if (!artifact.stateLayout) {
      throw new Error(`Contract ${artifact.contractName} is not a stateful contract`);
    }

    if (options.fundingUtxo.vout !== 0) {
      throw new Error(
        'Funding UTXO must be at vout 0 to create a valid token category. '
        + `Got vout ${options.fundingUtxo.vout}.`,
      );
    }

    if (!/^[0-9a-f]{64}$/i.test(options.fundingUtxo.txid)) {
      throw new Error(
        'fundingUtxo.txid must be a 64-character hex string (transaction hash). '
        + `Got '${options.fundingUtxo.txid}'.`,
      );
    }

    const categoryId = options.fundingUtxo.txid;
    const contract = new Contract(artifact, constructorArgs as any, {
      provider: options.provider,
      addressType: options.addressType,
      category: hexToBin(categoryId),
    });

    const stateLayout = artifact.stateLayout;
    const delegateOnly = artifact.delegateOnly === true;
    const dataNftAddress = getDataNftAddress(contract, categoryId);

    const masterAmount = options.masterAmount ?? 1200n;
    const dataNftAmount = options.dataNftAmount ?? 1200n;
    // Genesis spends reveal the full redeem script. Near-limit contracts therefore exceed the historical fixed
    // 5,000-sat fee at the default 1 sat/byte relay rate; size the default conservatively from the actual script.
    const estimatedFee = options.fee ?? BigInt(Math.max(5000, Math.ceil(contract.bytesize) + 2000));

    const constructorAbi = artifact.abi.find((f) => f.name === '__construct');

    // Dynamic constructor writes whose values are direct parameters can be materialized exactly. Their chunk NFTs
    // follow the fixed constructor block and are required both by the derivation probe and the real genesis tx.
    const visibleConstructorInputs = constructorAbi?.inputs.filter(
      (input) => !input.name.startsWith('__internal__'),
    ) ?? [];
    const dynamicInitialChunks = (stateLayout.variables ?? []).flatMap((variable) => {
      if (!variable.dynamic || !constructorAbi?.dynamicWrites?.includes(variable.name)) return [];
      const normalized = variable.name.replace(/^_+/, '');
      const inputIndex = visibleConstructorInputs.findIndex(
        (input) => input.name.replace(/^_+/, '').replace(/_+$/, '') === normalized,
      );
      const raw = inputIndex >= 0 ? options.initArgs?.[inputIndex] : undefined;
      const value = typeof raw === 'string' ? utf8ToBin(raw) : raw instanceof Uint8Array ? raw : undefined;
      if (value === undefined) return [];
      return splitValueIntoChunks(value).map((chunkData, chunkIndex) => ({
        name: variable.name, type: variable.type, chunkIndex, chunkData,
        commitment: buildChunkCommitment(
          chunkIndex, chunkData, options.provider.consensusLimits?.maximumNftCommitmentBytes,
        ),
      }));
    });

    // Determine counts for constructor features
    const entryAccesses = delegateOnly ? [] : (constructorAbi?.entryAccesses ?? []);
    const entryCount = entryAccesses.length;
    // A C2 batch has one fixed target output per logical access. Recreated shared predecessors live after the
    // fixed block (one HEAD per initially-empty collection), rather than using the old P'/NEW pair per access.
    const entryOutputCount = entryCount;
    const trailingEntryOutputCount = new Set(entryAccesses.filter((access) => (
      stateLayout.collections?.find((item) => item.name === access.collection)?.sorted
    )).map((access) => access.collection)).size;
    const emitCount = constructorAbi?.emits?.length ?? 0;

    const threadCount = options.threadCount ?? 1;
    if (threadCount < 1 || !Number.isInteger(threadCount)) {
      throw new Error(`threadCount must be a positive integer, got ${threadCount}`);
    }

    const initialBalance = options.initialBalance ?? 0n;
    const totalMaster = masterAmount * BigInt(threadCount);
    const totalDataNft = delegateOnly ? 0n : dataNftAmount * BigInt(stateLayout.dataNftCount);
    const totalEntryNft = dataNftAmount * BigInt(entryOutputCount + trailingEntryOutputCount);
    const totalEventNft = dataNftAmount * BigInt(emitCount);
    const totalDynamicNft = dataNftAmount * BigInt(dynamicInitialChunks.length);
    const identityAnchors = options.identityAnchors ?? [];
    const totalIdentity = identityAnchors.reduce((sum, anchor) => sum + (anchor.amount ?? dataNftAmount), 0n);
    const totalRequired = totalMaster + totalDataNft + totalEntryNft + totalEventNft + totalDynamicNft
      + totalIdentity + initialBalance + estimatedFee;
    const changeAmount = options.fundingUtxo.satoshis - totalRequired;

    if (changeAmount < 0n) {
      throw new Error(
        `Insufficient funding: ${options.fundingUtxo.satoshis} satoshis provided, `
        + `but ${totalRequired} needed `
        + `(master: ${totalMaster} (${threadCount}x${masterAmount}), data NFTs: ${totalDataNft}, `
        + `entry NFTs: ${totalEntryNft}, event NFTs: ${totalEventNft}, fee estimate: ${estimatedFee}).`,
      );
    }

    // Determine initial commitments and additional outputs
    let commitments: string[];
    let entryCommitments: string[] = [];
    let trailingEntryCommitments: string[] = [];
    let eventCommitments: string[] = [];
    let transferOutputs: Array<{ lockingBytecode: Uint8Array; amount: bigint }> = [];

    // Check if constructor has sig params - probe won't work for those
    const hasSigParams = constructorAbi?.inputs.some((inp) => inp.type === 'sig') ?? false;

    if (delegateOnly) {
      if (options.initialState || options.initArgs || initialBalance > 0n) {
        throw new Error(`Delegate-only facet '${artifact.contractName}' cannot deploy application state or balance.`);
      }
      commitments = [];
    } else if (constructorAbi && !hasSigParams) {
      // Use inference: build probe transaction with synthetic UTXOs
      const derived = await StatefulContract._deriveDeployCommitments(
        contract, artifact, stateLayout, categoryId, dataNftAddress,
        masterAmount, dataNftAmount, options,
      );
      commitments = derived.stateCommitments;
      entryCommitments = derived.entryCommitments;
      trailingEntryCommitments = derived.trailingEntryCommitments;
      eventCommitments = derived.eventCommitments;
      transferOutputs = derived.transferOutputs;
    } else if (constructorAbi && hasSigParams) {
      // Sig params: probe can't create valid signatures. Require explicit initialState.
      if (!options.initialState) {
        throw new Error(
          'Constructor has signature parameters - automatic state derivation is not possible. '
          + 'Provide options.initialState with explicit initial values.',
        );
      }
      commitments = buildInitialStateCommitments(
        stateLayout, options.initialState, options.provider.consensusLimits?.maximumNftCommitmentBytes,
      );
    } else {
      // No constructor: use explicit initialState or zero-initialized defaults
      commitments = buildInitialStateCommitments(
        stateLayout, options.initialState ?? {}, options.provider.consensusLimits?.maximumNftCommitmentBytes,
      );
    }

    // Build and send actual genesis transaction
    const { TransactionBuilder } = await import('../TransactionBuilder.js');
    const builder = new TransactionBuilder({
      provider: options.provider,
      ...(options.maxFee !== undefined && { maximumFeeSatoshis: options.maxFee }),
    });
    builder.addInput(options.fundingUtxo, options.funder);

    // Outputs 0..threadCount-1: minting NFT(s)
    for (let t = 0; t < threadCount; t++) {
      builder.addOutput({
        to: contract.tokenAddress,
        amount: masterAmount,
        token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
    }

    // Outputs threadCount..threadCount+dataNftCount-1: data NFTs with initial state
    for (let i = 0; i < (delegateOnly ? 0 : stateLayout.dataNftCount); i++) {
      builder.addOutput({
        to: dataNftAddress,
        amount: dataNftAmount,
        token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: commitments[i] } },
      });
    }

    // Entry NFT outputs (mapping writes in constructor)
    let entryCommitmentIndex = 0;
    for (const access of entryAccesses) {
      const entryNftAddress = getEntryNftAddress(contract, categoryId, access.collection);
      builder.addOutput({
        to: entryNftAddress,
        amount: dataNftAmount,
        token: {
          category: categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: entryCommitments[entryCommitmentIndex++] ?? '' },
        },
      });
    }

    // C2 (sorted) mapping HEAD sentinels: a sorted mapping needs a HEAD[slot 0 | nextKey 0] to anchor the linked
    // list, otherwise its first read/write fails "missing HEAD sentinel". A constructor that writes the mapping
    // already mints entries for it; for the rest, mint the empty-map HEAD at genesis. Sound: the genesis is
    // funder-authorized (no covenant yet) and every later read/write pins the HEAD (slot 0) via the covenant.
    for (const col of (delegateOnly ? [] : (stateLayout.collections ?? []))) {
      if (!col.sorted) continue;
      if (entryAccesses.some((a) => a.collection === col.name)) continue; // constructor already created its entries
      builder.addOutput({
        to: getEntryNftAddress(contract, categoryId, col.name),
        amount: dataNftAmount,
        token: {
          category: categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: binToHex(headSentinelCommitment()) },
        },
      });
    }

    // Transfer outputs (plain BCH transfers in constructor)
    for (const transfer of transferOutputs) {
      builder.addOutput({
        to: transfer.lockingBytecode,
        amount: transfer.amount,
      });
    }

    // Event NFT outputs (emits in constructor)
    if (constructorAbi?.emits) {
      const allEventDefs = artifact.events ?? [];
      for (let i = 0; i < constructorAbi.emits.length; i++) {
        const emitInfo = constructorAbi.emits[i];
        const eventDef = allEventDefs.find((e) => e.signature === emitInfo.eventSignature);
        const isAnonymous = eventDef?.anonymous === true;
        const eventNftAddress = eventDef === undefined
          ? scriptToLockingBytecode(
            buildEventNftCovenantScript(
              hexToBin(categoryId), computeEventNameHash(emitInfo.eventSignature),
            ),
            contract.addressType,
          )
          : isAnonymous
            ? getAnonymousEventNftAddress(contract, categoryId)
            : getEventNftAddress(contract, categoryId, emitInfo.eventSignature);
        builder.addOutput({
          to: eventNftAddress,
          amount: dataNftAmount,
          token: {
            category: categoryId, amount: 0n,
            nft: { capability: 'none', commitment: eventCommitments[i] ?? '' },
          },
        });
      }
    }

    // C2 predecessor recreations trail the complete fixed constructor block (including conditional events).
    // Initially every sorted collection shares its HEAD across all constructor writes, so it is emitted once.
    let trailingEntryIndex = 0;
    for (const collectionName of new Set(entryAccesses.filter((access) => (
      stateLayout.collections?.find((item) => item.name === access.collection)?.sorted
    )).map((access) => access.collection))) {
      builder.addOutput({
        to: getEntryNftAddress(contract, categoryId, collectionName),
        amount: dataNftAmount,
        token: {
          category: categoryId, amount: 0n,
          nft: {
            capability: 'mutable',
            commitment: trailingEntryCommitments[trailingEntryIndex++] ?? '',
          },
        },
      });
    }

    // Dynamic constructor values are stored in per-variable chunk NFTs immediately after the fixed block.
    for (const chunk of dynamicInitialChunks) {
      builder.addOutput({
        to: getDynamicChunkAddress(contract, categoryId, chunk.name, chunk.type),
        amount: dataNftAmount,
        token: {
          category: categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: chunk.commitment },
        },
      });
    }

    // Satoshi container output (if initialBalance > 0)
    if (initialBalance > 0n) {
      const satoshiContainerAddress = getSatoshiContainerAddress(contract, categoryId);
      builder.addOutput({ to: satoshiContainerAddress, amount: initialBalance });
    }

    // Immutable CREATE identity anchors are category-bearing discovery records. They are intentionally appended
    // after constructor-governed outputs so existing ABI output indices remain stable.
    for (const anchor of identityAnchors) {
      builder.addOutput({
        to: anchor.to,
        amount: anchor.amount ?? dataNftAmount,
        token: {
          category: categoryId, amount: 0n,
          nft: { capability: 'none', commitment: anchor.commitment },
        },
      });
    }

    // Add a placeholder change output so fee measurement includes its serialized size, then pay the exact
    // one-satoshi-per-byte relay floor. This matters for near-limit contracts whose redeem script is revealed by
    // the genesis input and whose constructor transaction is consequently larger than the contract itself.
    const totalTransferAmount = transferOutputs.reduce((sum, t) => sum + t.amount, 0n);
    builder.addOutput({ to: options.changeAddress, amount: 1000n });
    // The unsigned template contains a shorter placeholder for the funding signature. Leave enough headroom for
    // the final P2PKH unlocking bytecode (and minor serialization-length changes after the change amount is set).
    const fee = options.fee ?? (await computeFeeFromBuilder(builder)) + 1000n;
    const nonChangeOutputTotal = builder.outputs.slice(0, -1)
      .reduce((sum, output) => sum + output.amount, 0n);
    const finalChange = options.fundingUtxo.satoshis - nonChangeOutputTotal - fee;
    if (finalChange < 0n) {
      throw new Error(
        'Insufficient funding: constructor transfers require '
        + `${totalTransferAmount} satoshis and the transaction requires a ${fee}-satoshi fee. `
        + 'Increase the funding UTXO amount.',
      );
    }
    if (finalChange > 0n) {
      builder.outputs[builder.outputs.length - 1] = {
        ...builder.outputs[builder.outputs.length - 1], amount: finalChange,
      };
    } else {
      builder.outputs.pop();
    }

    const tx = await builder.send();

    const statefulContract = StatefulContract.withCategory(contract, categoryId);

    return { contract: statefulContract, tx, categoryId };
  }

  /**
   * Upgrade a stateful contract by migrating the minting NFT to a new contract.
   *
   * The upgrade transaction moves the minting NFT from the old contract's address to
   * the new contract's address. Data NFTs, entry NFTs, event NFTs, and token containers
   * are NOT touched - they remain at their covenant addresses (keyed by categoryId).
   *
   * Requirements:
   * - The upgrade function must have the 'upgrade' modifier in the old contract's ABI
   * - The new artifact must be a stateful contract
   * - State layout must be append-only: existing variables keep their nftIndex/fieldIndex,
   *   new variables can only be appended at the end
   *
   * @returns The new ConnectedStatefulContract with the same categoryId
   */
  static async upgrade<T extends Artifact>(
    options: UpgradeOptions<T>,
  ): Promise<UpgradeResult<T>> {
    const {
      provider, oldContract, upgradeFunctionName, upgradeFunctionArgs,
      newArtifact, newConstructorArgs,
    } = options;

    // Validate the upgrade function exists and has the 'upgrade' modifier
    const upgradeAbi = oldContract.inner.artifact.abi.find(
      (f) => f.name === upgradeFunctionName,
    );
    if (!upgradeAbi) {
      throw new Error(
        `Function '${upgradeFunctionName}' not found in contract '${oldContract.name}'.`,
      );
    }
    if (!upgradeAbi.modifiers?.includes('upgrade')) {
      throw new Error(
        `Function '${upgradeFunctionName}' does not have the 'upgrade' modifier. `
        + 'Only functions with the upgrade modifier can be used for contract upgrades.',
      );
    }

    // Validate new artifact is stateful
    if (!newArtifact.stateLayout) {
      throw new Error(
        `New contract '${newArtifact.contractName}' is not a stateful contract.`,
      );
    }

    // Validate state layout append-only compatibility: existing variables must keep
    // their nftIndex, fieldIndex, and type. New variables can only be appended.
    {
      const prevLayout = oldContract.inner.artifact.stateLayout;
      const nextLayout = newArtifact.stateLayout;
      if (prevLayout) {
        for (const oldVar of prevLayout.variables) {
          const newVar = nextLayout.variables.find((v) => v.name === oldVar.name);
          if (!newVar) {
            throw new Error(
              `Upgrade layout incompatibility: state variable '${oldVar.name}' exists in the old contract `
              + 'but is missing in the new contract. State layouts must be append-only - '
              + 'existing variables cannot be removed.',
            );
          }
          if (newVar.nftIndex !== oldVar.nftIndex || newVar.fieldIndex !== oldVar.fieldIndex) {
            throw new Error(
              `Upgrade layout incompatibility: state variable '${oldVar.name}' changed position `
              + `(old: nft=${oldVar.nftIndex}/field=${oldVar.fieldIndex}, `
              + `new: nft=${newVar.nftIndex}/field=${newVar.fieldIndex}). `
              + 'State layouts must be append-only - existing variables cannot be reordered.',
            );
          }
          if (newVar.type !== oldVar.type) {
            throw new Error(
              `Upgrade layout incompatibility: state variable '${oldVar.name}' changed type `
              + `(old: ${oldVar.type}, new: ${newVar.type}). `
              + 'State variable types cannot change during upgrade.',
            );
          }
        }
      }
    }

    const categoryId = oldContract.categoryId;
    const addressType = options.addressType ?? oldContract.inner.addressType;

    // Get on-chain state to find the master UTXO
    const onChainState = await oldContract.getFullState();
    if (!onChainState.masterUtxo) {
      throw new Error(
        `Master UTXO not found for contract '${oldContract.name}' `
        + `(category ${categoryId}). Ensure the contract is deployed and the master UTXO exists.`,
      );
    }

    const masterUtxo = onChainState.masterUtxo;

    // Create the new contract instance self-pinned to the same categoryId
    const newContract = new Contract(newArtifact, newConstructorArgs as any, {
      provider,
      addressType,
      category: hexToBin(categoryId),
    });

    // Determine which data NFTs the upgrade function needs
    const requiredNftIndices = upgradeAbi.requiredNftIndices
      ?? Array.from({ length: oldContract.inner.stateLayout!.dataNftCount }, (_, i) => i);

    const filteredDataNftUtxos = requiredNftIndices.map((idx) => onChainState.dataNftUtxos[idx]);
    if (filteredDataNftUtxos.some((u) => u === undefined)) {
      throw new Error(`Missing required data NFTs on-chain. Expected indices: [${requiredNftIndices.join(', ')}], but only ${onChainState.dataNftUtxos.length} data NFTs found.`);
    }

    // Build the upgrade function args (may need synthetic params appended)
    let finalArgs = [...upgradeFunctionArgs];

    // Append _msgSenderCategory if function uses msg.sender
    if (upgradeAbi.usesMsgSender) {
      finalArgs = [...finalArgs, new Uint8Array(32)]; // zero bytes = direct call
    }

    const entryAccesses = upgradeAbi.entryAccesses;
    if (entryAccesses && entryAccesses.length > 0) {
    }


    // Create the unlocker for the old contract's upgrade function
    const masterUnlocker = (oldContract.inner.unlock as any)[upgradeFunctionName](...finalArgs);
    const dataNftUnlockers = filteredDataNftUtxos.map(
      () => createDataNftUnlocker(oldContract.inner, 0, categoryId),
    );

    // Build the upgrade transaction
    const { TransactionBuilder } = await import('../TransactionBuilder.js');
    const builder = new TransactionBuilder({
      provider,
      ...(options.maxFee !== undefined && { maximumFeeSatoshis: options.maxFee }),
    });

    // Input 0: old master UTXO (unlocked via upgrade function)
    builder.addInput(masterUtxo, masterUnlocker);

    // Inputs 1..N: data NFTs (if the upgrade function accesses state)
    for (let i = 0; i < filteredDataNftUtxos.length; i++) {
      builder.addInput(filteredDataNftUtxos[i], dataNftUnlockers[i]);
    }

    // Outputs 1..N: data NFTs with commitments rebuilt for the new state layout.
    // When the new contract extends state (appends new variables), we parse the
    // old commitment using the old layout, then rebuild using the new layout so
    // that new fields are initialised with default values.
    // When state overflows into additional NFTs, new data NFTs are minted
    // using funds from the caller-provided funding UTXO.
    const oldLayout = oldContract.inner.stateLayout!;
    const newLayout = newArtifact.stateLayout!;
    const dataNftAmount = 1200n;

    // Determine how many additional data NFTs need to be minted
    const newNftCount = newLayout.dataNftCount - oldLayout.dataNftCount;

    if (newNftCount > 0) {
      if (!options.fundingUtxo || !options.funder) {
        throw new Error(
          `Upgrade extends state from ${oldLayout.dataNftCount} to ${newLayout.dataNftCount} data NFTs. `
          + 'Provide fundingUtxo and funder to cover the additional data NFT costs.',
        );
      }
    }

    // Add funding input to cover fees (and new NFTs in overflow case).
    // When no explicit funding UTXO is provided, create a dummy OP_TRUE
    // funder on MockNetworkProvider so the fee can be paid.
    if (options.fundingUtxo && options.funder) {
      builder.addInput(options.fundingUtxo, options.funder);
    } else if ((provider as any).addUtxo) {
      // MockNetworkProvider: create a dummy funder for the fee
      const dummy: Utxo = {
        txid: '00'.repeat(31) + 'fe', vout: 0, satoshis: 5000n,
      };
      await (provider as any).addUtxo(binToHex(DUMMY_FUNDER_LOCKING_BYTECODE), dummy);
      builder.addInput(dummy, {
        generateLockingBytecode: () => DUMMY_FUNDER_LOCKING_BYTECODE,
        generateUnlockingBytecode: () => DUMMY_FUNDER_UNLOCKING_BYTECODE,
      });
    }

    // Parse all old state values so they can be carried into the new layout
    const oldState: Record<string, StateValue> = {};
    for (let i = 0; i < filteredDataNftUtxos.length; i++) {
      const nftIdx = requiredNftIndices[i];
      const oldCommitment = filteredDataNftUtxos[i].token?.nft?.commitment ?? '';
      if (oldCommitment) {
        const parsed = parsePushdataCommitment(oldCommitment, oldLayout, nftIdx);
        Object.assign(oldState, parsed);
      }
    }

    // Output 0: minting NFT at NEW contract's tokenAddress (bytecode changes!)
    // Master UTXO satoshis will be reduced by the fee (computed below) when no
    // separate funding UTXO covers it.
    builder.addOutput({
      to: newContract.tokenAddress,
      amount: masterUtxo.satoshis, // placeholder; adjusted after fee computation
      token: {
        category: categoryId,
        amount: masterUtxo.token?.amount ?? 0n,
        nft: { capability: 'minting', commitment: masterUtxo.token?.nft?.commitment ?? '' },
      },
    });

    // Rebuild existing data NFT outputs with new-layout commitments
    for (let i = 0; i < filteredDataNftUtxos.length; i++) {
      const nftUtxo = filteredDataNftUtxos[i];
      const nftIdx = requiredNftIndices[i];

      const newCommitment = buildPushdataCommitment(newLayout, oldState, nftIdx);

      builder.addOutput({
        to: dataNftUnlockers[i].generateLockingBytecode(),
        amount: nftUtxo.satoshis,
        token: {
          category: categoryId,
          amount: nftUtxo.token?.amount ?? 0n,
          nft: {
            capability: nftUtxo.token?.nft?.capability ?? 'mutable',
            commitment: newCommitment,
          },
        },
      });
    }

    // Mint additional data NFTs for new nftIndices that overflow into new UTXOs
    if (newNftCount > 0) {
      const dataNftAddress = getDataNftAddress(newContract, categoryId);
      for (let nftIdx = oldLayout.dataNftCount; nftIdx < newLayout.dataNftCount; nftIdx++) {
        const newCommitment = buildPushdataCommitment(newLayout, oldState, nftIdx);
        builder.addOutput({
          to: dataNftAddress,
          amount: dataNftAmount,
          token: {
            category: categoryId,
            amount: 0n,
            nft: { capability: 'mutable', commitment: newCommitment },
          },
        });
      }
    }

    // Compute fee and change output from the funding input.
    // The funding input covers the fee (and any new NFT costs in overflow case).
    // Add a placeholder change output before fee estimation so the size accounts
    // for the change output that will be included in the final transaction.
    const fundingSatoshis = options.fundingUtxo?.satoshis ?? 5000n; // 5000 for dummy funder
    const totalNewNftCost = dataNftAmount * BigInt(Math.max(newNftCount, 0));
    const changeAddr = options.changeAddress ?? newContract.address;
    builder.addOutput({ to: changeAddr, amount: 1000n }); // placeholder for fee estimation
    const actualUpgradeFee = options.fee ?? await computeFeeFromBuilder(builder);
    const changeAmount = fundingSatoshis - totalNewNftCost - actualUpgradeFee;
    if (changeAmount > 0n) {
      builder.outputs[builder.outputs.length - 1] = {
        ...builder.outputs[builder.outputs.length - 1], amount: changeAmount,
      };
    } else {
      builder.outputs.pop(); // remove placeholder - no change needed
    }

    const tx = await builder.send();

    // Connect the new contract with the same categoryId
    const statefulContract = StatefulContract.withCategory(newContract, categoryId);

    return { contract: statefulContract, tx, categoryId };
  }

  /**
   * Deploy a new stateful contract from a factory contract.
   *
   * The factory contract must have a function with the 'deploy' modifier. This method
   * creates a single transaction that:
   * 1. Calls the factory's deploy function (spending the factory's master UTXO)
   * 2. Includes a funding UTXO for token genesis
   * 3. Creates outputs for both the factory (self-preservation) and the new child contract
   *
   * The child contract's categoryId is derived from the funding UTXO's txid.
   *
   * @returns The factory with updated state and the new child contract
   */
  static async deployFrom<T extends Artifact>(
    options: DeployFromOptions<T>,
  ): Promise<DeployFromResult<T>> {
    const {
      provider, factory, deployFunctionName, deployFunctionArgs,
    } = options;

    // Validate the deploy function exists and has the 'deploy' modifier
    const deployAbi = factory.inner.artifact.abi.find(
      (f) => f.name === deployFunctionName,
    );
    if (!deployAbi) {
      throw new Error(
        `Function '${deployFunctionName}' not found in contract '${factory.name}'.`,
      );
    }
    if (!deployAbi.modifiers?.includes('deploy')) {
      throw new Error(
        `Function '${deployFunctionName}' does not have the 'deploy' modifier. `
        + 'Only functions with the deploy modifier can be used for contract deployment.',
      );
    }

    // Resolve the child + funding from the call, the factory's child registry, the recorded `new C(param)`
    // argument mapping, and the factory's deploy defaults - so a call need only pass what isn't already known.
    // The child's category is the funding UTXO's txid (vout 0), so its address derives forward from
    // (artifact, constructorArgs, category) - no extra input and no trace reverse-derivation needed.
    const deployTarget = deployAbi.deployTargets?.[0];
    const childArtifact = (options.childArtifact
      ?? (deployTarget ? (factory as StatefulContract)._getChild(deployTarget.contractName) : undefined)) as T;
    if (!childArtifact) {
      throw new Error(
        `No child artifact for deploy function '${deployFunctionName}'. Pass childArtifact or register it `
        + 'with factory.registerChild(artifact).',
      );
    }
    let childConstructorArgs = options.childConstructorArgs;
    if (!childConstructorArgs && deployTarget?.constructorArgs?.every((n) => n !== null)) {
      const derived = deployTarget.constructorArgs.map((name) => {
        const idx = deployAbi.inputs.findIndex((inp) => inp.name === name);
        return idx >= 0 ? deployFunctionArgs[idx] : undefined;
      });
      if (derived.every((v) => v !== undefined)) childConstructorArgs = derived as ConstructorArgument[];
    }
    if (!childConstructorArgs) {
      throw new Error(
        `Cannot derive constructor args for 'new ${deployTarget?.contractName ?? '?'}(...)' in `
        + `'${deployFunctionName}'. Pass childConstructorArgs (the new-C(...) args are not all plain parameters).`,
      );
    }
    // create2 salt: build the child with the salt the deploy covenant pins (composed with the self-pin).
    // Resolve from an explicit childSalt, else the recorded `new C{salt}()` mapping (a forwarded deploy param
    // or a hex literal). A computed salt with no explicit childSalt is an error (the address can't be rebuilt).
    let childSalt = options.childSalt;
    if (!childSalt && deployTarget?.salt) {
      const s = deployTarget.salt;
      if ('param' in s) {
        const idx = deployAbi.inputs.findIndex((inp) => inp.name === s.param);
        const arg = idx >= 0 ? deployFunctionArgs[idx] : undefined;
        if (arg instanceof Uint8Array) childSalt = arg;
      } else if ('literal' in s) {
        childSalt = hexToBin(s.literal);
      } else if (s.computed) {
        throw new Error(
          `'new ${deployTarget.contractName}{salt}()' in '${deployFunctionName}' uses a computed salt; pass `
          + 'childSalt explicitly so the SDK can build the child address.',
        );
      }
    }
    const funder = options.funder ?? (factory as StatefulContract).deployDefaults.funder;
    if (!funder) {
      throw new Error('No funder for deployFrom. Pass funder or set factory.setDeployDefaults({ funder }).');
    }
    const changeAddress = options.changeAddress ?? (factory as StatefulContract).deployDefaults.changeAddress;

    // Validate child artifact is stateful
    if (!childArtifact.stateLayout) {
      throw new Error(
        `Child contract '${childArtifact.contractName}' is not a stateful contract.`,
      );
    }

    // Funding UTXOs: one per child (a loop `for (i<n) new C()` mints N children, and a balanced contract block
    // needs N funding inputs). fundingUtxos supersedes the single fundingUtxo; default = [fundingUtxo] (1 child).
    const fundingUtxos = options.fundingUtxos ?? [options.fundingUtxo];
    const childCount = fundingUtxos.length;
    if (childCount === 0) {
      throw new Error('deployFrom needs at least one funding UTXO (fundingUtxo or a non-empty fundingUtxos).');
    }
    for (const fu of fundingUtxos) {
      if (fu.vout !== 0) {
        throw new Error(
          'Each funding UTXO must be at vout 0 to create a valid token category. '
          + `Got vout ${fu.vout}.`,
        );
      }
    }

    // child i's category = fundingUtxos[i].txid. The first child's category doubles as the returned handle's.
    const childCategoryId = fundingUtxos[0].txid;
    const addressType = options.addressType ?? factory.inner.addressType;
    const fee = options.fee ?? 5000n;
    const masterAmount = options.masterAmount ?? 1200n;
    const dataNftAmount = options.dataNftAmount ?? 1200n;

    // Get factory's on-chain state
    const onChainState = await factory.getFullState();
    if (!onChainState.masterUtxo) {
      throw new Error(
        `Master UTXO not found for factory '${factory.name}' `
        + `(category ${factory.categoryId}). Ensure the factory is deployed.`,
      );
    }

    const masterUtxo = onChainState.masterUtxo;

    // Self-pin the child by category, identical to the compiler's `new ContractName(...)` covenant and to an
    // SDK-direct deploy (Contract.ts bakes <cat||0x02> OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_EQUALVERIFY). A
    // create2 salt (if any) composes outside the self-pin (<salt> OP_DROP | <self-pin> | base), matching the
    // compiler. This address is what the deploy covenant verifies in the genesis outputs.
    // One child Contract per funding UTXO - the self-pinned address is category-dependent, so each of the N
    // children (loop deploy) has a distinct address derived from its own category. childContracts[0] is the
    // returned handle. childConstructorArgs are shared (a loop mints the same child type each iteration).
    const childContracts = fundingUtxos.map((fu) => new Contract(childArtifact, childConstructorArgs as any, {
      provider,
      addressType,
      category: hexToBin(fu.txid),
      ...(childSalt && { salt: childSalt }),
    }));
    const childContractUnsalted = childContracts[0];

    // The returned handle uses the same self-pinned address as the first deployed genesis.
    const childContract = childContractUnsalted;

    const childLayout = childArtifact.stateLayout!;

    // Compute child's initial state commitments
    const childCommitments = buildInitialStateCommitments(
      childLayout, options.childInitialState ?? {}, provider.consensusLimits?.maximumNftCommitmentBytes,
    );

    // Determine which data NFTs the factory's deploy function needs
    const requiredNftIndices = deployAbi.requiredNftIndices
      ?? Array.from({ length: factory.inner.stateLayout!.dataNftCount }, (_, i) => i);
    const filteredDataNftUtxos = requiredNftIndices.map((idx) => onChainState.dataNftUtxos[idx]);
    if (filteredDataNftUtxos.some((u) => u === undefined)) {
      throw new Error(`Missing required data NFTs on-chain. Expected indices: [${requiredNftIndices.join(', ')}], but only ${onChainState.dataNftUtxos.length} data NFTs found.`);
    }

    // Build function args with synthetic parameters
    let finalArgs = [...deployFunctionArgs];

    // Append _msgSenderCategory if function uses msg.sender
    if (deployAbi.usesMsgSender) {
      finalArgs = [...finalArgs, new Uint8Array(32)]; // zero bytes = direct call
    }

    // A value-returning deploy function takes a hidden __internal__returnOutputIdx pointing at its return-event
    // (B8) output slot. On a plain send a returning function's return-event is the LAST block slot, so idx=-1
    // (no output) is harmless; but a deploy function's deploy slot sits AFTER the return-event slot, so the
    // return-event output MUST be materialized to keep the deploy genesis at its fixed block-layout offset.
    // Emit it (idx = the slot offset), and reserve the output below (its commitment is derived from the trace).
    const returnEventSlot = deployAbi.blockLayout?.slots.find((s) => s.kind === 'returnEvent');
    const deployReturns = !!returnEventSlot && (deployAbi.outputs?.length ?? 0) > 0;
    if (deployReturns) {
      const retIdxPos = deployAbi.inputs.findIndex((inp) => inp.name === '__internal__returnOutputIdx');
      if (retIdxPos >= 0 && finalArgs.length < deployAbi.inputs.length) {
        finalArgs = [
          ...finalArgs.slice(0, retIdxPos),
          BigInt(returnEventSlot!.offset),
          ...finalArgs.slice(retIdxPos),
        ];
      }
    }

    // Resolve C2 mapping writes against an authenticated target/predecessor proof node.
    const factoryLayout = factory.inner.stateLayout!;
    const entryAccesses = deployAbi.entryAccesses ?? [];
    const entryInfos: Array<{
      collection: string; keyValue: bigint | boolean | Uint8Array; proofUtxo: Utxo;
      present: boolean; fixedCommitment: string; trailingCommitment?: string;
    }> = [];
    // Entries of different collections share the category and are indistinguishable by key; with >1 collection,
    // match within each collection's own entries (fetched by its entry address) rather than the mixed set.
    const deployMultiColl = (factoryLayout.collections?.length ?? 0) > 1;
    const deployCollCache = new Map<string, Utxo[]>();
    const deployCollectionEntries = async (sig: string): Promise<Utxo[]> => {
      if (!deployMultiColl) return onChainState.entryNftUtxos;
      const hit = deployCollCache.get(sig);
      if (hit) return hit;
      const addr = getEntryNftAddress(factory.inner, factory.categoryId, sig);
      const fetched = (await factory.inner.provider.getUtxos(addr)).filter((u) => (
        u.token?.category === factory.categoryId && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0
      ));
      deployCollCache.set(sig, fetched);
      return fetched;
    };
    for (const access of entryAccesses) {
      const collection = factoryLayout.collections?.find((c) => c.name === access.collection);
      if (!collection) {
        throw new Error(`Unknown collection '${access.collection}' in deploy function '${deployFunctionName}'.`);
      }
      if ((collection.keyTypes?.length ?? 1) > 1) {
        throw new Error(
          `deployFrom does not support multi-key mapping writes (collection '${access.collection}').`,
        );
      }
      const keyParam = access.keyParams[0];
      const keyParamIdx = deployAbi.inputs.findIndex((inp) => inp.name === keyParam);
      if (keyParamIdx < 0) {
        throw new Error(`Mapping key parameter '${keyParam}' not found in '${deployFunctionName}' inputs.`);
      }
      // Normalize hex-string bytes keys to Uint8Array (parsed keys are always Uint8Array).
      const rawKey = deployFunctionArgs[keyParamIdx];
      const keyValue: bigint | boolean | Uint8Array = typeof rawKey === 'string'
        ? hexToBin(rawKey.replace(/^0x/i, ''))
        : (rawKey as bigint | boolean | Uint8Array);

      if (!collection.sorted) throw new Error(`Collection '${access.collection}' is not a C2 collection.`);
      const encodedKey = keyValue instanceof Uint8Array ? keyValue
        : typeof keyValue === 'bigint' ? bigIntToVmNumber(keyValue) : bigIntToVmNumber(keyValue ? 1n : 0n);
      const slot = keyToSlotMulti([encodedKey]);
      const list = SortedList.fromUtxos(await deployCollectionEntries(collection.signature));
      if (list.has(slot)) {
        const target = list.find(slot)!;
        entryInfos.push({
          collection: access.collection, keyValue, proofUtxo: target.utxo, present: true,
          fixedCommitment: target.utxo.token!.nft!.commitment,
        });
      } else {
        const plan = list.planInsert(slot);
        entryInfos.push({
          collection: access.collection, keyValue, proofUtxo: plan.predecessor.utxo, present: false,
          fixedCommitment: binToHex(plan.predNewCommitment),
          trailingCommitment: binToHex(plan.newNodeCommitment),
        });
      }
    }

    // Placeholder entry NFT outputs for the VM probe (commitments derived from the trace).
    const entryPlaceholderOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
    for (const info of entryInfos) {
      const entryAddress = getEntryNftAddress(factory.inner, factory.categoryId, info.collection);
      entryPlaceholderOutputs.push({
        to: entryAddress,
        amount: dataNftAmount,
        token: {
          category: factory.categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: info.fixedCommitment },
        },
      });
    }

    // Every access supplies a real C2 proof input; INSERT uses the bracketing predecessor rather than a funder.
    const entryExtraInputs: Array<{ utxo: Utxo; unlocker: Unlocker }> = [];
    for (const info of entryInfos) {
      entryExtraInputs.push({
        utxo: info.proofUtxo,
        unlocker: createEntryNftUnlocker(factory.inner, 0, factory.categoryId, info.collection),
      });
    }

    // Create unlockers for factory's master UTXO and data NFTs
    const masterUnlocker = (factory.inner.unlock as any)[deployFunctionName](...finalArgs);
    const dataNftUnlockers = filteredDataNftUtxos.map(
      () => createDataNftUnlocker(factory.inner, 0, factory.categoryId),
    );

    // A LOOP `new C{value:V}()` has NO standalone transfer block-layout slot (the N value transfers are
    // interleaved as the LAST output of each child's group). A straight-line / conditional {value:} keeps a
    // transfer slot (separate output). Both co-spend the factory's satoshi container as the value source.
    const hasSatoshiContainer = deployAbi.blockLayout?.slots.some((s) => s.kind === 'satoshiContainer') ?? false;
    const hasTransferSlot = deployAbi.blockLayout?.slots.some((s) => s.kind === 'transfer') ?? false;
    const isLoopValueDeploy = hasSatoshiContainer && !hasTransferSlot;

    // Build child outputs for the VM probe (needed by the deploy covenant verification). N child groups, one per
    // funding UTXO, at consecutive stride-sized slots (the runtime deploy counter indexes them). Each child's
    // master + data NFTs carry its own category (fundingUtxos[k].txid) and self-pinned address; a loop {value:}
    // group ends with the interleaved value transfer to that child.
    const childExtraOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
    for (let k = 0; k < childCount; k++) {
      const cc = childContracts[k];
      const cat = fundingUtxos[k].txid;
      const dnAddr = getDataNftAddress(cc, cat);
      childExtraOutputs.push({
        to: cc.tokenAddress,
        amount: masterAmount,
        token: { category: cat, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
      for (let i = 0; i < childLayout!.dataNftCount; i++) {
        childExtraOutputs.push({
          to: dnAddr,
          amount: dataNftAmount,
          token: { category: cat, amount: 0n, nft: { capability: 'mutable', commitment: childCommitments[i] } },
        });
      }
      if (isLoopValueDeploy) {
        childExtraOutputs.push({ to: cc.address, amount: options.childValue ?? 0n });
      }
    }
    const trailingEntryPlaceholderOutputs = entryInfos.filter((info) => info.trailingCommitment !== undefined)
      .map((info) => ({
        to: getEntryNftAddress(factory.inner, factory.categoryId, info.collection),
        amount: dataNftAmount,
        token: {
          category: factory.categoryId, amount: 0n,
          nft: { capability: 'mutable' as const, commitment: info.trailingCommitment! },
        },
      }));
    // A fixed C2 INSERT's NEW node is output[blockSize]. For deployFrom, the deploy slot itself is the child
    // master, while child data NFTs expand beyond the fixed block; interleave NEW immediately after that master.
    const childProbeOutputs = childExtraOutputs.length > 0
      ? [childExtraOutputs[0], ...trailingEntryPlaceholderOutputs, ...childExtraOutputs.slice(1)]
      : [...trailingEntryPlaceholderOutputs];

    // Return-event (B8) placeholder for a returning deploy function, at its block-layout slot (after entries,
    // before the child genesis). The commitment is derived from the probe trace below and set on the real output.
    const returnEventPlaceholders: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = deployReturns
      ? [{
        to: new Uint8Array([0x51]), // OP_TRUE (anyone-can-spend return event)
        amount: 800n,
        token: {
          category: factory.categoryId, amount: 0n,
          nft: { capability: 'none', commitment: '00' },
        },
      }]
      : [];

    // `new Child{value: x}()`: the factory co-spends its OWN satoshi container (the value source, like any scash
    // value transfer) + recreates it (minus x) + adds the x-sat transfer to the child. Detected from the deploy
    // fn's satoshiContainer block-layout slot; the container input sits after entries (before funding), and the
    // container + transfer outputs after entries (before return event / child geneses) - matching the layout.
    // hasSatoshiContainer / isLoopValueDeploy computed above (with the child-output interleave). A loop {value:}
    // deploy's container loses N*childValue (N interleaved transfers); a straight-line / conditional loses V.
    const containerInputs: Array<{ utxo: Utxo; unlocker: Unlocker }> = [];
    const containerOutputs: Array<{ to: string | Uint8Array; amount: bigint }> = [];
    if (hasSatoshiContainer) {
      const childValue = options.childValue;
      if (childValue === undefined || childValue <= 0n) {
        throw new Error(
          `Deploy function '${deployFunctionName}' sends value to the child (new C{value:...}()); pass `
          + 'childValue (the sats transferred from the factory\'s satoshi container to the child).',
        );
      }
      const totalValue = isLoopValueDeploy ? childValue * BigInt(childCount) : childValue;
      const satAddr = getSatoshiContainerAddress(factory.inner, factory.categoryId);
      const satUtxo = (await provider.getUtxos(satAddr)).find((u) => u.satoshis > totalValue);
      if (!satUtxo) {
        throw new Error(
          `Factory '${factory.name}' has no satoshi container with > ${totalValue} sats at ${satAddr}. Deploy `
          + 'the factory with an initialBalance to fund new C{value:}() transfers.',
        );
      }
      containerInputs.push({
        utxo: satUtxo, unlocker: createSatoshiContainerUnlocker(factory.inner, 0, factory.categoryId),
      });
      containerOutputs.push({ to: satAddr, amount: satUtxo.satoshis - totalValue });    // recreate the container
      // Straight-line / conditional: one separate transfer output. Loop: the N transfers are interleaved into
      // the child groups (added in the child-output construction below), so no separate transfer here.
      if (!isLoopValueDeploy) {
        containerOutputs.push({ to: childContractUnsalted.address, amount: childValue });
      }
    }

    // A deploy function that transfers CashTokens - e.g. to the freshly-created child - co-spends the factory's
    // TOKEN container as the source, exactly like any this.tokens[cat].transfer(). Detected from the deploy fn's
    // tokenContainer block-layout slot; the container input sits after entries (before funding), the recreated
    // container output + each tcTransfer output after entries (before the child geneses) - matching the layout
    // [.., tokenContainer, tcTransfer, .., deploy]. The covenant self-preserves the container (LBC + amount) and
    // pins each transfer (LBC + amount + category), so redirecting the remainder is rejected (TokenContainer test).
    const hasTokenContainer = deployAbi.blockLayout?.slots.some((s) => s.kind === 'tokenContainer') ?? false;
    const tokenContainerInputs: Array<{ utxo: Utxo; unlocker: Unlocker }> = [];
    const tokenContainerOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
    let tokenTransferCost = 0n;
    if (hasTokenContainer) {
      if (hasSatoshiContainer) {
        throw new Error(
          `Deploy function '${deployFunctionName}' co-spends BOTH a satoshi and a token container; deployFrom `
          + 'does not yet support that combination in a single deploy.',
        );
      }
      const transfers = options.childTokenTransfers ?? [];
      if (transfers.length === 0) {
        throw new Error(
          `Deploy function '${deployFunctionName}' transfers tokens from the factory's container; pass `
          + 'childTokenTransfers [{ categoryId, to, amount }] (one per FT transfer the deploy performs). NFT '
          + '(transferNft) transfers on deploy are not yet supported.',
        );
      }
      const remainderOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
      const transferOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
      // Group by category - one co-spent container + recreated remainder (amount minus the transfers) per category,
      // then ALL tcTransfer outputs (block layout groups [..all tokenContainer.., ..all tcTransfer.., deploy]).
      const byCategory = new Map<string, Array<{ to: string | Uint8Array; amount: bigint }>>();
      for (const t of transfers) {
        const list = byCategory.get(t.categoryId) ?? [];
        list.push({ to: t.to, amount: t.amount });
        byCategory.set(t.categoryId, list);
      }
      for (const [tcCat, ts] of byCategory) {
        const tcAddr = getTokenContainerAddress(factory.inner, factory.categoryId, tcCat);
        const sumAmount = ts.reduce((s, t) => s + t.amount, 0n);
        const tcUtxo = (await provider.getUtxos(tcAddr)).find(
          (u) => u.token?.category === tcCat && (u.token?.amount ?? 0n) >= sumAmount && !u.token?.nft,
        );
        if (!tcUtxo) {
          throw new Error(
            `Factory '${factory.name}' has no fungible token container for category ${tcCat} with >= ${sumAmount} `
            + `tokens at ${tcAddr}. Fund the container before deploying.`,
          );
        }
        tokenContainerInputs.push({
          utxo: tcUtxo, unlocker: createTokenContainerUnlocker(factory.inner, 0, factory.categoryId, tcCat),
        });
        // Recreated container (self-preserved LBC, amount minus the transfers); satoshis preserved from the input.
        remainderOutputs.push({
          to: tcAddr,
          amount: tcUtxo.satoshis,
          token: { category: tcCat, amount: (tcUtxo.token!.amount ?? 0n) - sumAmount },
        });
      }
      // tcTransfer outputs in the caller's order (must match the deploy fn's transfer-statement order, which the
      // covenant verifies slot-by-slot): `amount` tokens of the category to the recipient, dust sats from funding.
      for (const t of transfers) {
        transferOutputs.push({ to: t.to, amount: dataNftAmount, token: { category: t.categoryId, amount: t.amount } });
        tokenTransferCost += dataNftAmount;
      }
      tokenContainerOutputs.push(...remainderOutputs, ...transferOutputs);
    }

    // Derive factory state + entry commitments via VM probe. Inputs: master, data NFTs,
    // existing entries, [satoshi container], funding. Outputs: master, data NFTs, entries,
    // [container, value transfer], return event, child outputs.
    const {
      state: derivedState, entryCommitments, childCommitments: derivedChildCommitments, returnBlob,
    } = await (factory as StatefulContract)._deriveCommitments(
      deployFunctionName, finalArgs, requiredNftIndices,
      [...entryPlaceholderOutputs, ...containerOutputs, ...tokenContainerOutputs,
        ...returnEventPlaceholders, ...childProbeOutputs],
      [...entryExtraInputs, ...containerInputs, ...tokenContainerInputs,
        ...fundingUtxos.map((fu) => ({ utxo: fu, unlocker: funder }))],
      entryInfos.length,
      childLayout!.dataNftCount,
      returnEventPlaceholders.length,
      containerOutputs.length + tokenContainerOutputs.length,
      trailingEntryPlaceholderOutputs.length,
      entryPlaceholderOutputs.length + containerOutputs.length + tokenContainerOutputs.length
        + returnEventPlaceholders.length + (childExtraOutputs.length > 0 ? 1 : 0),
    );

    // Deploy-then-call fold: the covenant may verify a post-call child genesis (a same-tx
    // `child.foo(args)` folded into the deploy). Prefer the trace-derived commitment; fall back to the
    // static initial state for a plain deploy that lands the child at default. See deploy-then-call-fold.md.
    const effectiveChildCommitments = Array.from(
      { length: childLayout!.dataNftCount },
      (_, i) => derivedChildCommitments[i] ?? childCommitments[i],
    );
    const expectedEntryCommitmentCount = entryInfos.length + trailingEntryPlaceholderOutputs.length;
    if (expectedEntryCommitmentCount > 0 && entryCommitments.length < expectedEntryCommitmentCount) {
      throw new Error(
        `Failed to derive entry NFT commitments for deploy function '${deployFunctionName}'. `
        + 'Ensure the function writes all accessed mapping entries.',
      );
    }

    // Read current factory state and apply derived updates
    const factoryCurrentState: Record<string, StateValue> = {};
    for (let i = 0; i < requiredNftIndices.length; i++) {
      const nftIdx = requiredNftIndices[i];
      const nftUtxo = filteredDataNftUtxos[i];
      if (nftUtxo?.token?.nft?.commitment) {
        const parsed = parsePushdataCommitment(nftUtxo.token.nft.commitment, factoryLayout, nftIdx);
        for (const [key, value] of Object.entries(parsed)) {
          factoryCurrentState[key] = value;
        }
      }
    }

    if (derivedState) {
      for (const [key, value] of Object.entries(derivedState)) {
        factoryCurrentState[key] = value;
      }
    }

    // Build the deployment transaction
    const { TransactionBuilder } = await import('../TransactionBuilder.js');
    const builder = new TransactionBuilder({
      provider,
      ...(options.maxFee !== undefined && { maximumFeeSatoshis: options.maxFee }),
    });

    // Input 0: factory master UTXO
    builder.addInput(masterUtxo, masterUnlocker);

    // Inputs 1..N: factory data NFTs
    for (let i = 0; i < filteredDataNftUtxos.length; i++) {
      builder.addInput(filteredDataNftUtxos[i], dataNftUnlockers[i]);
    }

    // Existing entry NFT inputs (mapping writes to pre-existing keys), at their slot offsets
    for (const { utxo, unlocker } of entryExtraInputs) {
      builder.addInput(utxo, unlocker);
    }

    // Satoshi container input (the value source for a new C{value:}() transfer), after entries + before funding.
    for (const ci of containerInputs) {
      builder.addInput(ci.utxo, ci.unlocker);
    }

    // Token container input(s) (the source for a token transfer during deploy), after entries + before funding.
    for (const ti of tokenContainerInputs) {
      builder.addInput(ti.utxo, ti.unlocker);
    }

    // Funding UTXOs for the children's token genesis - N inputs, one per child (a balanced contract block: N
    // deploy output groups need N balancing inputs). Each is at vout 0 so its txid sources the child's category.
    for (const fu of fundingUtxos) {
      builder.addInput(fu, funder);
    }

    // === Factory outputs (first) ===

    // Output 0: factory master UTXO (preserved)
    builder.addOutput({
      to: factory.inner.tokenAddress,
      amount: masterUtxo.satoshis,
      token: {
        category: factory.categoryId,
        amount: masterUtxo.token?.amount ?? 0n,
        nft: { capability: 'minting', commitment: masterUtxo.token?.nft?.commitment ?? '' },
      },
    });

    // Outputs 1..N: factory data NFTs with updated commitments
    for (let i = 0; i < filteredDataNftUtxos.length; i++) {
      const nftIdx = requiredNftIndices[i];
      const nftUtxo = filteredDataNftUtxos[i];
      const commitment = buildPushdataCommitment(factoryLayout, factoryCurrentState, nftIdx);

      builder.addOutput({
        to: dataNftUnlockers[i].generateLockingBytecode(),
        amount: nftUtxo.satoshis,
        token: {
          category: factory.categoryId,
          amount: nftUtxo.token?.amount ?? 0n,
          nft: {
            capability: nftUtxo.token?.nft?.capability ?? 'mutable',
            commitment,
          },
        },
      });
    }

    // Entry NFT outputs, after the data NFTs; commitments derived from the VM trace above.
    for (let i = 0; i < entryInfos.length; i++) {
      const info = entryInfos[i];
      const entryAddress = getEntryNftAddress(factory.inner, factory.categoryId, info.collection);
      builder.addOutput({
        to: entryAddress,
        amount: info.proofUtxo.satoshis,
        token: {
          category: factory.categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: entryCommitments[i] },
        },
      });
    }

    // Satoshi container output (recreated, minus the transferred value) + the value transfer to the child, at
    // their block-layout slots (after entries, before the return event / child geneses). See the new C{value:}()
    // handling above. Order matches the layout: satoshiContainer, then transfer.
    for (const co of containerOutputs) {
      builder.addOutput({ to: co.to, amount: co.amount });
    }

    // Token container output(s): the recreated container (remainder) then each tcTransfer, at their block-layout
    // slots (after entries / satoshi container, before the return event + child geneses). Matches the layout order
    // [.., tokenContainer, tcTransfer, ..] and the probe extraOutputs above.
    for (const tco of tokenContainerOutputs) {
      builder.addOutput({ to: tco.to, amount: tco.amount, ...(tco.token ? { token: tco.token } : {}) });
    }

    // Return-event (B8) output for a returning deploy function, at its block-layout slot (after entries, before
    // the child genesis). Commitment = the derived return value; anyone-can-spend (OP_TRUE), factory category.
    if (returnEventPlaceholders.length > 0) {
      if (!returnBlob) {
        throw new Error(
          `Could not derive the return value of deploy function '${deployFunctionName}' from the VM trace. `
          + 'The return-event probe did not reach the B8 verify (the covenant may abort earlier).',
        );
      }
      builder.addOutput({
        to: new Uint8Array([0x51]),
        amount: 800n,
        token: {
          category: factory.categoryId, amount: 0n,
          nft: { capability: 'none', commitment: binToHex(returnBlob) },
        },
      });
    }

    // === Child contract outputs (appended after factory outputs) ===
    // N child genesis groups at consecutive stride-sized slots (the covenant's runtime deploy counter indexes
    // output[slotBase + counter*stride]). Group k carries fundingUtxos[k]'s category + that child's self-pinned
    // address; the data NFT commitment is the shared default (a loop mints the same child type each iteration).
    for (let k = 0; k < childCount; k++) {
      const cc = childContracts[k];
      const cat = fundingUtxos[k].txid;
      const dnAddr = getDataNftAddress(cc, cat);
      // Child minting NFT - use unsalted address to match compiler's `new` expression
      builder.addOutput({
        to: cc.tokenAddress,
        amount: masterAmount,
        token: { category: cat, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
      if (k === 0) {
        let trailingCommitmentIndex = entryInfos.length;
        for (const info of entryInfos) {
          if (info.trailingCommitment === undefined) continue;
          builder.addOutput({
            to: getEntryNftAddress(factory.inner, factory.categoryId, info.collection),
            amount: dataNftAmount,
            token: {
              category: factory.categoryId, amount: 0n,
              nft: { capability: 'mutable', commitment: entryCommitments[trailingCommitmentIndex++] },
            },
          });
        }
      }
      // Child data NFTs
      for (let i = 0; i < childLayout!.dataNftCount; i++) {
        builder.addOutput({
          to: dnAddr,
          amount: dataNftAmount,
          token: { category: cat, amount: 0n, nft: { capability: 'mutable', commitment: effectiveChildCommitments[i] } },
        });
      }
      // Loop {value:}: the value transfer to this child, interleaved as the last output of its group.
      if (isLoopValueDeploy) {
        builder.addOutput({ to: cc.address, amount: options.childValue ?? 0n });
      }
    }

    // Change output. New entries cost dust from the funding UTXOs; existing entries are
    // satoshi-neutral (input funds output). N children cost N * (master + data NFTs); the N funding inputs' total
    // satoshis cover them (any value >= that cost).
    const newEntryCount = BigInt(entryInfos.filter((e) => !e.present).length);
    const totalChildCost = BigInt(childCount) * (masterAmount + (dataNftAmount * BigInt(childLayout!.dataNftCount)));
    const totalEntryCost = dataNftAmount * newEntryCount;
    const returnEventCost = returnEventPlaceholders.length > 0 ? 800n : 0n;
    const totalFundingSats = fundingUtxos.reduce((sum, fu) => sum + fu.satoshis, 0n);
    // tokenTransferCost = dust for each tcTransfer output (the token container's own satoshis fund only its
    // recreated remainder; each transfer output's dust comes from the funding inputs).
    const changeAmount = totalFundingSats - totalChildCost - totalEntryCost - returnEventCost
      - tokenTransferCost - fee;
    if (changeAmount > 0n) {
      if (!changeAddress) {
        throw new Error(
          `deployFrom has ${changeAmount} satoshis of excess funding but no changeAddress was provided. `
          + 'Specify changeAddress in options or via factory.setDeployDefaults({ changeAddress }).',
        );
      }
      builder.addOutput({ to: changeAddress, amount: changeAmount });
    }

    const tx = await builder.send();

    // Connect the child with its categoryId. The compiler's `new C(...)` codegen now self-pins the child by
    // category (matching the SDK), so childContract's self-pinned address equals the deployed genesis address.
    // See docs/external-contract-calls.md.
    const childStateful = new StatefulContract(childContract, childCategoryId) as ConnectedStatefulContract<T>;

    return { factory, child: childStateful, tx, childCategoryId };
  }

  /**
   * Destroy a stateful contract by spending all its UTXOs without recreating them.
   *
   * This permanently destroys the contract by:
   * 1. Spending all master minting NFTs (including threaded masters)
   * 2. Spending all data NFTs (using flag=2 destroy path in the covenant)
   * 3. Spending all entry NFTs (using flag=1 write path, which already allows destruction)
   * 4. Spending all expired event NFTs (using CSV timelock - best-effort)
   * 5. Sending all reclaimed satoshis to the recipient address
   *
   * If the total number of inputs exceeds transaction size limits, batching is used:
   * - Intermediate transactions preserve one master UTXO while destroying batches of NFTs
   * - The final transaction destroys all remaining masters and NFTs
   *
   * @returns Array of transaction details and total reclaimed satoshis
   */
  static async destroy(options: DestroyOptions): Promise<DestroyResult> {
    const {
      provider, contract, destroyFunctionName, destroyFunctionArgs,
      recipient,
    } = options;
    const fee = options.fee; // undefined -> auto-computed per-tx from builder size
    const maxInputsPerTx = options.maxInputsPerTx ?? 200;

    // Validate the destroy function exists and has the 'selfdestruct' modifier
    const destroyAbi = contract.inner.artifact.abi.find(
      (f) => f.name === destroyFunctionName,
    );
    if (!destroyAbi) {
      throw new Error(
        `Function '${destroyFunctionName}' not found in contract '${contract.name}'.`,
      );
    }
    if (!destroyAbi.modifiers?.includes('selfdestruct')) {
      throw new Error(
        `Function '${destroyFunctionName}' does not have the 'selfdestruct' modifier. `
        + 'Only functions with the selfdestruct modifier can be used for contract destruction.',
      );
    }

    const categoryId = contract.categoryId;
    const stateLayout = contract.inner.stateLayout;
    if (!stateLayout) {
      throw new Error(`Contract '${contract.name}' is not a stateful contract.`);
    }

    // Discover ALL UTXOs
    // 1. Master UTXOs (may be multiple for threaded contracts)
    const tokenAddressUtxos = await provider.getUtxos(contract.tokenAddress);
    const stateReader = new StateReader(stateLayout);
    const masterUtxos = stateReader.findMasterUtxos(tokenAddressUtxos, categoryId);
    if (masterUtxos.length === 0) {
      throw new Error(
        `No master UTXO found for contract '${contract.name}' (category ${categoryId}).`,
      );
    }

    // 2. Data NFT UTXOs
    const onChainState = await contract.getFullState();
    const dataNftUtxos = onChainState.dataNftUtxos;

    // 3. Entry NFT UTXOs (one address per collection)
    const entryNftInputs: Array<{ utxo: Utxo; collection: string }> = [];
    for (const collection of stateLayout.collections ?? []) {
      const entryAddress = getEntryNftAddress(contract.inner, categoryId, collection.signature);
      try {
        const entryUtxos = await provider.getUtxos(entryAddress);
        const entries = entryUtxos.filter(
          (u) => u.token?.category === categoryId && u.token?.nft,
        );
        for (const utxo of entries) {
          entryNftInputs.push({ utxo, collection: collection.signature });
        }
      } catch (err: any) {
        // Rethrow network/provider errors; only suppress "no UTXOs" scenarios
        const msg = err?.message ?? '';
        if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND')
            || msg.includes('socket') || msg.includes('network') || msg.includes('fetch failed')) {
          throw new Error(
            `Network error while fetching entry NFTs for collection '${collection.signature}': ${msg}`,
          );
        }
        // No UTXOs at this address - expected when collection is empty
      }
    }

    // 4. Event NFT UTXOs (best-effort - CSV timelock may not have elapsed)
    const eventNftInputs: Array<{ utxo: Utxo; eventSignature: string }> = [];
    for (const eventDef of contract.inner.artifact.events ?? []) {
      const isAnonymous = eventDef.anonymous === true;
      const eventAddress = isAnonymous
        ? getAnonymousEventNftAddress(contract.inner, categoryId)
        : getEventNftAddress(contract.inner, categoryId, eventDef.signature);
      try {
        const eventUtxos = await provider.getUtxos(eventAddress);
        const events = eventUtxos.filter(
          (u) => u.token?.category === categoryId && u.token?.nft,
        );
        for (const utxo of events) {
          eventNftInputs.push({ utxo, eventSignature: eventDef.signature });
        }
      } catch {
        // Event address may not have any UTXOs
      }
    }

    // 5. Satoshi container UTXO (deterministic address)
    const satoshiContainerInputs: Array<{ utxo: Utxo }> = [];
    try {
      const satContainerAddr = getSatoshiContainerAddress(
        contract.inner, categoryId,
      );
      const satContainerUtxos = await provider.getUtxos(satContainerAddr);
      for (const utxo of satContainerUtxos) {
        satoshiContainerInputs.push({ utxo });
      }
    } catch {
      // Satoshi container may not exist
    }

    // 6. Token container UTXOs (best-effort from extra category IDs)
    const tokenContainerInputs: Array<{
      utxo: Utxo; tokenContainerCategoryId: string;
    }> = [];
    for (const tcCatId of options.tokenContainerCategoryIds ?? []) {
      try {
        const tcAddr = getTokenContainerAddress(
          contract.inner, categoryId, tcCatId,
        );
        const tcUtxos = await provider.getUtxos(tcAddr);
        for (const utxo of tcUtxos) {
          tokenContainerInputs.push({
            utxo, tokenContainerCategoryId: tcCatId,
          });
        }
      } catch {
        // Token container may not exist
      }
    }

    // Collect all non-master inputs for destruction
    type NftInput = {
      utxo: Utxo;
      kind: 'data' | 'entry' | 'event'
      | 'satoshiContainer' | 'tokenContainer';
      collection?: string;
      eventSignature?: string;
      tokenContainerCategoryId?: string;
    };
    const allNftInputs: NftInput[] = [
      ...dataNftUtxos.map((u) => ({
        utxo: u, kind: 'data' as const,
      })),
      ...entryNftInputs.map((e) => ({
        utxo: e.utxo, kind: 'entry' as const, collection: e.collection,
      })),
      ...eventNftInputs.map((ev) => ({
        utxo: ev.utxo, kind: 'event' as const,
        eventSignature: ev.eventSignature,
      })),
      ...satoshiContainerInputs.map((s) => ({
        utxo: s.utxo, kind: 'satoshiContainer' as const,
      })),
      ...tokenContainerInputs.map((tc) => ({
        utxo: tc.utxo, kind: 'tokenContainer' as const,
        tokenContainerCategoryId: tc.tokenContainerCategoryId,
      })),
    ];

    const totalInputs = masterUtxos.length + allNftInputs.length;
    const builtTxs: DestroyBatch[] = [];

    if (totalInputs <= maxInputsPerTx) {
      // Single transaction: destroy everything at once
      const result = await StatefulContract._buildDestroyTransactionHex(
        contract, categoryId, fee, recipient,
        masterUtxos, allNftInputs,
        destroyFunctionName, destroyFunctionArgs,
        true, options.maxFee,
      );
      builtTxs.push(result);
    } else {
      // Batch mode: prebuild ALL transactions before submitting any
      const primaryMaster = { ...masterUtxos[0] };
      const remainingMasters = masterUtxos.slice(1);
      let remainingNfts = [...allNftInputs];

      while (remainingNfts.length > 0) {
        const batchSize = Math.min(remainingNfts.length, maxInputsPerTx - 1);
        const isFinal = batchSize >= remainingNfts.length
          && remainingMasters.length + 1 + batchSize <= maxInputsPerTx;

        const batch = remainingNfts.splice(0, batchSize);

        if (isFinal) {
          const result = await StatefulContract._buildDestroyTransactionHex(
            contract, categoryId, fee, recipient,
            [primaryMaster, ...remainingMasters], batch,
            destroyFunctionName, destroyFunctionArgs,
            true, options.maxFee,
          );
          builtTxs.push(result);
          remainingMasters.length = 0; // Clear to prevent duplicate post-loop batch
        } else {
          const result = await StatefulContract._buildDestroyTransactionHex(
            contract, categoryId, fee, recipient,
            [primaryMaster], batch,
            destroyFunctionName, destroyFunctionArgs,
            false, options.maxFee,
          );
          builtTxs.push(result);
          // Compute txid locally to track master UTXO across batches without broadcasting
          const { hash256: localHash256, binToHex: localBinToHex } = await import('@bitauth/libauth');
          const localTxid = localBinToHex(localHash256(hexToBin(result.hex)).reverse());
          primaryMaster.txid = localTxid;
          primaryMaster.vout = 0;
        }
      }

      // If there are remaining masters (multi-threaded) that weren't included yet
      if (remainingMasters.length > 0 && remainingNfts.length === 0) {
        const result = await StatefulContract._buildDestroyTransactionHex(
          contract, categoryId, fee, recipient,
          [primaryMaster, ...remainingMasters], [],
          destroyFunctionName, destroyFunctionArgs,
          true, options.maxFee,
        );
        builtTxs.push(result);
      }
    }

    // Submit all prebuilt transactions sequentially
    const txs: TransactionDetails[] = [];
    let totalReclaimed = 0n;
    const { decodeTransaction, hash256 } = await import('@bitauth/libauth');

    // X163, the finalized-bytes gate at the `destroy` sweep. Destroy sweeps EVERY remaining UTXO into one reclaim
    // output whose amount is `totalInputSats - fee` - arithmetic, never checked against a floor - so a contract
    // holding little more than its fee reclaims a below-dust amount and a node refuses the whole sweep
    // `64: dust`. MEASURED: a 2,400-satoshi contract swept at a 2,300-satoshi fee produces a 100-satoshi
    // reclaim against a 576-satoshi threshold, and `MockNetworkProvider` takes those bytes, because its default
    // policy is `enforceDust: false`. The existing `reclaimed <= 0n` throw is one satoshi wide and never
    // reaches this band.
    //
    // BEFORE THE LOOP, NOT INSIDE IT, and that placement is the whole reason batch mode prebuilds every
    // transaction before submitting any. The batches chain - each intermediate's master output is the next
    // one's input, by locally computed txid - so a refusal on batch `i` from inside the loop would leave
    // `0..i-1` already settled and the contract half-swept, with no path that both finishes and reports. Every
    // batch is final and decodable here, so deciding all of them first keeps the refusal atomic.
    //
    // X175. Each batch carries its own builder so a refused batch can report its covenant alongside its byte
    // rule. Only batch 0 spends inputs that exist yet - the rest chain on locally computed txids - but the
    // evaluation reads SOURCE OUTPUTS off the builder rather than the chain, so every batch is evaluable.
    for (const { hex, subjects, builder } of builtTxs) {
      assertFinalizedBytesWithCovenant(builder, decodeTransactionUnsafe(hexToBin(hex)), subjects);
    }

    for (let i = 0; i < builtTxs.length; i++) {
      const { hex, reclaimed } = builtTxs[i];
      const txBin = hexToBin(hex);
      const txid = await provider.sendRawTransaction(hex);

      // Verify txid matches locally computed hash
      const expectedTxid = binToHex(hash256(txBin).reverse());
      if (txid !== expectedTxid) {
        throw new Error(
          `Txid mismatch in batch ${i}: provider returned '${txid}', expected '${expectedTxid}'. `
          + 'The network provider may be compromised.',
        );
      }

      const libauthTx = decodeTransaction(txBin);
      if (typeof libauthTx === 'string') {
        throw new Error(`Failed to decode transaction in batch ${i}: ${libauthTx}`);
      }
      txs.push({ ...libauthTx, txid, hex });
      totalReclaimed += reclaimed;
    }

    return { txs, totalReclaimed };
  }

  /**
   * Trigger a `selfdestruct(addr)` function: collapse all of the contract's state UTXOs (no master
   * recreation - end of life) and free the native balance to `recipient` at output 0.
   *
   * The compiler's selfdestruct covenant pins `tx.outputs[0].lockingBytecode == addr` (the destination
   * the contract author wired into `selfdestruct(addr)`). This routes the freed value there at output 0;
   * `recipient` must resolve to that same address. Tokens are not swept (EVM parity - the program owns
   * them). Mechanically identical to destroy(); this name mirrors the language feature.
   */
  static selfdestructTo(options: DestroyOptions): Promise<DestroyResult> {
    return StatefulContract.destroy(options);
  }

  private static async _buildDestroyTransactionHex(
    contract: ConnectedStatefulContract,
    categoryId: string,
    feeOverride: bigint | undefined,
    recipient: string,
    masterUtxos: Utxo[],
    nftInputs: Array<{
      utxo: Utxo;
      kind: 'data' | 'entry' | 'event'
      | 'satoshiContainer' | 'tokenContainer';
      collection?: string;
      eventSignature?: string;
      tokenContainerCategoryId?: string;
    }>,
    destroyFunctionName: string,
    destroyFunctionArgs: FunctionArgument[],
    isFinal: boolean,
    maxFee?: bigint,
  ): Promise<DestroyBatch> {
    const { TransactionBuilder } = await import('../TransactionBuilder.js');
    const builder = new TransactionBuilder({
      provider: contract.inner.provider,
      allowImplicitNftBurn: true,
      ...(maxFee != null ? { maximumFeeSatoshis: maxFee } : {}),
    });

    // Input 0: primary master UTXO
    const masterUnlocker = (contract.inner.unlock as any)[destroyFunctionName](...destroyFunctionArgs);
    builder.addInput(masterUtxos[0], masterUnlocker);

    // Additional masters (for final multi-threaded destruction)
    for (let i = 1; i < masterUtxos.length; i++) {
      const additionalUnlocker = (contract.inner.unlock as any)[destroyFunctionName](...destroyFunctionArgs);
      builder.addInput(masterUtxos[i], additionalUnlocker);
    }

    // NFT inputs with appropriate unlockers
    const masterInputIndex = 0;
    for (const nftInput of nftInputs) {
      switch (nftInput.kind) {
        case 'data':
          builder.addInput(
            nftInput.utxo,
            createDestroyDataNftUnlocker(contract.inner, masterInputIndex, categoryId),
          );
          break;
        case 'entry':
          builder.addInput(
            nftInput.utxo,
            createEntryNftUnlocker(contract.inner, masterInputIndex, categoryId, nftInput.collection!),
          );
          break;
        case 'event': {
          const evDef = (contract.inner.artifact.events ?? []).find(
            (e) => e.signature === nftInput.eventSignature,
          );
          const unlocker = evDef?.anonymous
            ? createAnonymousEventNftUnlocker(contract.inner, categoryId)
            : createEventNftUnlocker(contract.inner, categoryId, nftInput.eventSignature!);
          builder.addInput(nftInput.utxo, unlocker);
          break;
        }
        case 'satoshiContainer':
          builder.addInput(
            nftInput.utxo,
            createSatoshiContainerUnlocker(
              contract.inner, masterInputIndex, categoryId,
            ),
          );
          break;
        case 'tokenContainer':
          builder.addInput(
            nftInput.utxo,
            createTokenContainerUnlocker(
              contract.inner, masterInputIndex, categoryId,
              nftInput.tokenContainerCategoryId!,
            ),
          );
          break;
      }
    }

    // Calculate total input satoshis
    let totalInputSats = 0n;
    for (const master of masterUtxos) totalInputSats += master.satoshis;
    for (const nft of nftInputs) totalInputSats += nft.utxo.satoshis;

    if (!isFinal) {
      // Intermediate: recreate master UTXO at output 0
      const masterAmount = masterUtxos[0].satoshis;
      builder.addOutput({
        to: contract.tokenAddress,
        amount: masterAmount,
        token: {
          category: categoryId,
          amount: masterUtxos[0].token?.amount ?? 0n,
          nft: {
            capability: 'minting',
            commitment: masterUtxos[0].token?.nft?.commitment ?? '',
          },
        },
      });

      // Add placeholder reclaim output to estimate fee, then adjust
      builder.addOutput({ to: recipient, amount: 1000n }); // placeholder
      const fee = feeOverride ?? await computeFeeFromBuilder(builder);
      const reclaimed = totalInputSats - masterAmount - fee;
      if (reclaimed > 0n) {
        builder.outputs[builder.outputs.length - 1] = {
          ...builder.outputs[builder.outputs.length - 1], amount: reclaimed,
        };
      } else {
        builder.outputs.pop(); // remove placeholder - no reclaim
      }
      const hex = builder.build();
      return {
        hex, reclaimed: reclaimed > 0n ? reclaimed : 0n, subjects: inputSubjectsOfBuilder(builder), builder,
      };
    }

    // Final: send everything to recipient. Add placeholder output for fee estimation.
    builder.addOutput({ to: recipient, amount: 1000n }); // placeholder
    const fee = feeOverride ?? await computeFeeFromBuilder(builder);
    const reclaimed = totalInputSats - fee;
    if (reclaimed <= 0n) {
      throw new Error(
        'Destroy transaction has no funds to reclaim after fees. '
        + `Total inputs: ${totalInputSats}, fee: ${fee}.`,
      );
    }
    builder.outputs[builder.outputs.length - 1] = {
      ...builder.outputs[builder.outputs.length - 1], amount: reclaimed,
    };
    const hex = builder.build();
    return { hex, reclaimed, subjects: inputSubjectsOfBuilder(builder), builder };
  }

  /*
   * `_sendBuilderWithCustomUnlockers` WAS HERE AND IS DELETED. X163.
   *
   * It was the eighth broadcast site in `src/` and the only one with no caller anywhere - not in `src/`, not in
   * `test/`, not in `examples/`, not by string. A guard on it could never fire on its own subject, so gating it
   * was never the question; whether an unreachable `sendRawTransaction` should exist at all was.
   *
   * ITS REASON TO EXIST WAS REMOVED, which is why it went dead. The docstring said `send()` "fails to produce a
   * meaningful error for custom unlockers because getBitauthUri() throws". `TransactionBuilder.send` now wraps
   * that call in `try { ... } catch { bitauthUri = ''; }` on both of its failure paths, so the throw it was
   * routing around cannot happen. Nothing was left for it to do.
   *
   * DELETED RATHER THAN LEFT DORMANT because a broadcast path that reaches the network with no byte gate ahead
   * of it is exactly the shape a later edit picks up without noticing what is missing - the gated sites are
   * gated, and a caller reaching for "the helper that sends a builder directly" would have found the one that
   * is not. `_sendRawBuilder` does the same job with the gate, and is live.
   */

  /**
   * Use VM inference to derive initial commitments from the constructor function.
   * Builds a synthetic probe transaction with zero-initialized state, runs the
   * constructor, and extracts the expected commitments from the VM trace.
   */
  private static async _deriveDeployCommitments<T extends Artifact>(
    contract: Contract<T>,
    artifact: T,
    stateLayout: StateLayout,
    categoryId: string,
    dataNftAddress: string,
    masterAmount: bigint,
    dataNftAmount: bigint,
    options: DeployOptions,
  ): Promise<{
      stateCommitments: string[];
      entryCommitments: string[];
      trailingEntryCommitments: string[];
      eventCommitments: string[];
      transferOutputs: Array<{ lockingBytecode: Uint8Array; amount: bigint }>;
    }> {
    const constructorAbi = artifact.abi.find((f) => f.name === '__construct');
    const entryAccesses = constructorAbi?.entryAccesses ?? [];
    const entryCount = entryAccesses.length;
    const entryOutputCount = entryCount;
    const transferCount = constructorAbi?.transferCount ?? 0;
    const emitInfos = constructorAbi?.emits ?? [];
    const emitCount = emitInfos.length;

    // Explicit initial state seeds fields the constructor does not write (for example compiler-injected immutable
    // block-oracle ownership). Constructor execution still derives and authenticates its writes over this pre-state.
    const zeroCommitments = buildInitialStateCommitments(
      stateLayout, options.initialState ?? {}, options.provider.consensusLimits?.maximumNftCommitmentBytes,
    );

    // Synthetic master UTXO (contract's locking script + minting NFT)
    const syntheticMaster: Utxo = {
      txid: '00'.repeat(32), vout: 0, satoshis: masterAmount,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    // Contract unlockers accept only user-visible arguments and fill compiler-internal witnesses themselves.
    const initArgs = [...(options.initArgs ?? [])];
    const senderLockingBytecode = options.funder.generateLockingBytecode();
    const visibleInputs = constructorAbi?.inputs.filter((input) => !input.name.startsWith('__internal__')) ?? [];
    const resolveConstructorKey = (label: string | undefined): Uint8Array | undefined => {
      if (label === 'nullop:msg.sender') return senderLockingBytecode;
      // A constructor body may reference either an explicit `__construct` argument or a contract parameter.
      // The latter is encoded into the redeem script and therefore is not repeated in the constructor ABI.
      return evalComputedKey(label, initArgs, visibleInputs)
        ?? evalComputedKey(label, contract.constructorArgs, artifact.constructorInputs);
    };
    const sortedPlans = new Map<string, {
      proofOffset: number;
      targetNext: Map<number, Uint8Array>;
      predecessorCommitment: string;
      trailingOutput: number;
    }>();
    const sortedCollections = [...new Set(entryAccesses.filter((access) => (
      stateLayout.collections?.find((item) => item.name === access.collection)?.sorted
    )).map((access) => access.collection))];
    for (const [collectionIndex, collectionName] of sortedCollections.entries()) {
      const accesses = entryAccesses.map((access, index) => ({ access, index })).filter(
        ({ access }) => access.collection === collectionName,
      );
      const headUtxo: Utxo = {
        txid: `${'00'.repeat(31)}ee`, vout: collectionIndex, satoshis: dataNftAmount,
        token: {
          category: categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: binToHex(headSentinelCommitment()) },
        },
      };
      const list = SortedList.fromUtxos([headUtxo]);
      const writes = accesses.map(({ access }) => {
        const label = access.keySources?.[0]?.expressionLabel ?? access.keyParams?.[0];
        const key = resolveConstructorKey(label);
        if (key === undefined) {
          throw new Error(
            `Cannot derive constructor C2 key '${label ?? '<unknown>'}' for ${collectionName}.`,
          );
        }
        return { slot: keyToSlot(key), value: new Uint8Array() };
      });
      const plan = list.planBatchUpsert(writes);
      const targetNext = new Map<number, Uint8Array>();
      for (const [localIndex, { index }] of accesses.entries()) {
        const output = plan.outputs.find((candidate) => binsAreEqual(candidate.slot, writes[localIndex].slot));
        if (output === undefined) throw new Error(`Missing constructor C2 target plan for ${collectionName}.`);
        targetNext.set(index, decodeEntryCommitment(output.commitment).nextKey);
      }
      const predecessor = plan.outputs.find((output) => bytesToSlotValue(output.slot) === 0n);
      if (predecessor === undefined) throw new Error(`Missing constructor C2 HEAD plan for ${collectionName}.`);
      sortedPlans.set(collectionName, {
        proofOffset: 1 + stateLayout.dataNftCount + accesses[0].index,
        targetNext,
        predecessorCommitment: binToHex(predecessor.commitment),
        trailingOutput: (constructorAbi?.blockLayout?.blockSize ?? (
          1 + stateLayout.dataNftCount + entryCount + emitCount + transferCount
        )) + collectionIndex,
      });
    }
    const internalInitArgs: FunctionArgument[] = [];
    for (const input of constructorAbi?.inputs.slice(visibleInputs.length) ?? []) {
      if (input.name === '__internal__msgSenderCategory') internalInitArgs.push(new Uint8Array(32));
      else {
        const match = input.name.match(/^__internal__c2Batch(Slot|Proof|Next|PredOut)_(\d+)$/);
        if (match) {
          const slotIndex = Number(match[2]);
          const access = entryAccesses[slotIndex];
          const plan = sortedPlans.get(access.collection);
          const label = access.keySources?.[0]?.expressionLabel ?? access.keyParams?.[0];
          const key = resolveConstructorKey(label);
          if (plan === undefined || key === undefined) throw new Error(`Missing constructor C2 witness ${input.name}.`);
          if (match[1] === 'Slot') internalInitArgs.push(keyToSlot(key));
          else if (match[1] === 'Proof') internalInitArgs.push(BigInt(plan.proofOffset));
          else if (match[1] === 'Next') internalInitArgs.push(plan.targetNext.get(slotIndex)!);
          else internalInitArgs.push(BigInt(plan.trailingOutput));
        } else if (input.name === '__internal__c2BatchTrailingCount') {
          internalInitArgs.push(BigInt(sortedCollections.length));
        } else {
          throw new Error(`Unsupported constructor internal witness '${input.name}'.`);
        }
      }
    }



    const requiredIndices = constructorAbi?.requiredNftIndices
      ?? Array.from({ length: stateLayout.dataNftCount }, (_, i) => i);
    const { CovenantTransactionBuilder } = await import('./CovenantTransactionBuilder.js');
    const useSparseProbe = (options.provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000;
    const allEventDefs = artifact.events ?? [];
    // A failing commitment equality stops VM execution, so one probe may reveal only the prefix through the
    // first mismatched data NFT. Allow every state NFT to be learned progressively plus a final convergence run.
    const maxDeployIterations = Math.max(5, requiredIndices.length + 2);
    const seenDeployKeys = new Set<string>();

    let deployConverged = false;
    let currentCommitments = [...zeroCommitments];
    let stateCommitments: string[] = [];
    let entryCommits: string[] = Array.from({ length: entryOutputCount }, () => '');
    const usesC2BatchWitnesses = constructorAbi?.inputs.some(
      (input) => input.name.startsWith('__internal__c2Batch'),
    ) ?? false;
    // Scalar C2 insertion recreates P' in the fixed entry slot and places NEW after the block. Batched insertion
    // places its targets in fixed slots and trails the shared predecessor. Only the unknown value-bearing side
    // is left blank for VM inference.
    if (!usesC2BatchWitnesses) {
      for (const [index, access] of entryAccesses.entries()) {
        const plan = sortedPlans.get(access.collection);
        if (plan) entryCommits[index] = plan.predecessorCommitment;
      }
    }
    let trailingEntryCommits = sortedCollections.map(
      (collectionName) => usesC2BatchWitnesses
        ? sortedPlans.get(collectionName)!.predecessorCommitment
        : '',
    );
    const eventCommits: string[] = Array.from({ length: emitCount }, () => '');
    let transferOuts: Array<{
      lockingBytecode: Uint8Array; amount: bigint;
    }> = [];

    for (let iter = 0; iter < maxDeployIterations; iter++) {
      // Rebuild synthetic data NFTs with current commitments
      const iterDataNfts: Utxo[] = Array.from(
        { length: stateLayout.dataNftCount }, (_, i) => ({
          txid: '00'.repeat(32), vout: i + 1, satoshis: dataNftAmount,
          token: {
            category: categoryId, amount: 0n,
            nft: {
              capability: 'mutable' as const,
              // A constructor always executes from its original zero/explicit pre-state. Only the synthetic
              // OUTPUT placeholders converge; feeding a prior result back as input repeats non-idempotent writes.
              commitment: zeroCommitments[i],
            },
          },
        }),
      );

      const constructorUnlocker = (contract.unlock as any).__construct(
        ...initArgs, ...internalInitArgs,
      );
      const dataNftUnlockers = iterDataNfts.map(
        () => createDataNftUnlocker(contract, 0, categoryId),
      );

      // Build probe transaction
      const probeBuilder = new CovenantTransactionBuilder({
        provider: options.provider,
      });
      probeBuilder.addInput(syntheticMaster, constructorUnlocker);
      iterDataNfts.forEach(
        (nft, i) => probeBuilder.addInput(nft, dataNftUnlockers[i]),
      );

      // Constructor C2 writes are probed against a synthetic empty HEAD. The real genesis is funder-authorized,
      // but the probe must present the same authenticated predecessor shape the runtime upsert code consumes.
      const materializedProofs = new Set<number>();
      for (let e = 0; e < entryCount; e++) {
        const access = entryAccesses[e];
        const collection = stateLayout.collections?.find((item) => item.name === access.collection);
        if (collection?.sorted) {
          const plan = sortedPlans.get(access.collection)!;
          if (!materializedProofs.has(plan.proofOffset)) {
            materializedProofs.add(plan.proofOffset);
            probeBuilder.addInput({
              txid: `${'00'.repeat(31)}ee`, vout: sortedCollections.indexOf(access.collection),
              satoshis: dataNftAmount,
              token: {
                category: categoryId, amount: 0n,
                nft: { capability: 'mutable', commitment: binToHex(headSentinelCommitment()) },
              },
            }, createEntryNftUnlocker(contract, 0, categoryId, access.collection));
          } else {
            probeBuilder.addInput(
              { txid: `${'00'.repeat(31)}ec`, vout: e, satoshis: dataNftAmount },
              options.funder,
            );
          }
          continue;
        }
        const collectionSig = stateLayout.collections?.find(
          (candidate) => candidate.name === access.collection,
        )?.signature ?? access.collection;
        const entryLockingBytecode = scriptToLockingBytecode(
          buildEntryNftCovenantScript(hexToBin(categoryId), computeCollectionHash(collectionSig)),
          contract.addressType,
        );
        probeBuilder.addInput(
          { txid: `${'00'.repeat(31)}ee`, vout: e, satoshis: dataNftAmount },
          {
            generateLockingBytecode: (): Uint8Array => entryLockingBytecode,
            generateUnlockingBytecode: (): Uint8Array => DUMMY_FUNDER_UNLOCKING_BYTECODE,
          },
        );
      }

      // Conditional event slots are output-bearing block positions too; materialize matching no-token inputs so
      // input/output positional checks see the exact genesis layout.
      for (const [eventIndex, emitInfo] of emitInfos.entries()) {
        const eventDef = allEventDefs.find((event) => event.signature === emitInfo.eventSignature);
        const eventScript = eventDef?.anonymous === true
          ? buildAnonymousEventNftCovenantScript(hexToBin(categoryId))
          : buildEventNftCovenantScript(hexToBin(categoryId), computeEventNameHash(emitInfo.eventSignature));
        const eventLockingBytecode = scriptToLockingBytecode(eventScript, contract.addressType);
        probeBuilder.addInput(
          { txid: `${'00'.repeat(31)}ed`, vout: eventIndex, satoshis: dataNftAmount },
          {
            generateLockingBytecode: (): Uint8Array => eventLockingBytecode,
            generateUnlockingBytecode: (): Uint8Array => DUMMY_FUNDER_UNLOCKING_BYTECODE,
          },
        );
      }

      // Direct msg.sender resolves to tx.origin, the first native P2PKH source output. Keep the real funder after
      // the fixed constructor block so it supplies identity without shifting any positional covenant slots.
      probeBuilder.addInput(options.fundingUtxo, options.funder);

      // Output 0: master preserved
      probeBuilder.addOutput({
        to: constructorUnlocker.generateLockingBytecode(),
        amount: masterAmount,
        token: syntheticMaster.token,
      });

      // Outputs 1..dataNftCount: data NFTs
      iterDataNfts.forEach((nft, i) => {
        probeBuilder.addOutput({
          to: dataNftUnlockers[i].generateLockingBytecode(),
          amount: dataNftAmount,
          token: {
            category: categoryId,
            amount: 0n,
            nft: {
              capability: 'mutable' as const,
              commitment: currentCommitments[i],
            },
          },
        });
      });

      // Entry NFT outputs. Previously learned commitments are fed into the next probe iteration so a constructor
      // whose mapping write precedes scalar writes can progress past the entry equality checks.
      let probeEntryCommitmentIndex = 0;
      for (const access of entryAccesses) {
        const collectionSig = stateLayout.collections?.find(
          (c) => c.name === access.collection,
        )?.signature ?? access.collection;
        const collectionHash = computeCollectionHash(collectionSig);
        const covenantScript = buildEntryNftCovenantScript(
          hexToBin(categoryId), collectionHash,
        );
        const lockingBytecode = scriptToLockingBytecode(
          covenantScript, contract.addressType,
        );
        probeBuilder.addOutput({
          to: lockingBytecode,
          amount: dataNftAmount,
          token: {
            category: categoryId, amount: 0n,
            nft: {
              capability: 'mutable' as const,
              commitment: entryCommits[probeEntryCommitmentIndex++] ?? '',
            },
          },
        });
      }

      // Transfer placeholder outputs
      for (let i = 0; i < transferCount; i++) {
        probeBuilder.addOutput({
          to: encodeLockingBytecodeP2pkh(new Uint8Array(20)),
          amount: dataNftAmount,
        });
      }

      // Event NFT placeholder outputs
      for (const [eventIndex, emitInfo] of emitInfos.entries()) {
        const eventDef = allEventDefs.find(
          (e) => e.signature === emitInfo.eventSignature,
        );
        const isAnonymous = eventDef?.anonymous === true;
        const covenantScript = isAnonymous
          ? buildAnonymousEventNftCovenantScript(hexToBin(categoryId))
          : buildEventNftCovenantScript(
            hexToBin(categoryId),
            computeEventNameHash(emitInfo.eventSignature),
          );
        const lockingBytecode = scriptToLockingBytecode(
          covenantScript, contract.addressType,
        );
        probeBuilder.addOutput({
          to: lockingBytecode,
          amount: dataNftAmount,
          token: {
            category: categoryId, amount: 0n,
            nft: { capability: 'none' as const, commitment: eventCommits[eventIndex] },
          },
        });
      }

      for (const [index, collectionName] of sortedCollections.entries()) {
        probeBuilder.addOutput({
          to: getEntryNftAddress(contract, categoryId, collectionName),
          amount: dataNftAmount,
          token: {
            category: categoryId, amount: 0n,
            nft: {
              capability: 'mutable',
              commitment: trailingEntryCommits[index],
            },
          },
        });
      }

      // Dynamic constructor writes trail the fixed block. Direct parameter assignments (the Solidity-compatible
      // pattern used by ERC20(name, symbol)) are known exactly, so use their real commitments in every probe.
      for (const variable of stateLayout.variables ?? []) {
        if (!variable.dynamic || !constructorAbi?.dynamicWrites?.includes(variable.name)) continue;
        const normalized = variable.name.replace(/^_+/, '');
        const inputIndex = visibleInputs.findIndex(
          (input) => input.name.replace(/^_+/, '').replace(/_+$/, '') === normalized,
        );
        const raw = inputIndex >= 0 ? options.initArgs?.[inputIndex] : undefined;
        const value = typeof raw === 'string' ? utf8ToBin(raw) : raw instanceof Uint8Array ? raw : undefined;
        if (value === undefined) continue;
        const lockingBytecode = addressToLockScript(getDynamicChunkAddress(
          contract, categoryId, variable.name, variable.type,
        ));
        for (const [chunkIndex, chunkData] of splitValueIntoChunks(value).entries()) {
          probeBuilder.addOutput({
            to: lockingBytecode,
            amount: dataNftAmount,
            token: {
              category: categoryId, amount: 0n,
              nft: {
                capability: 'mutable' as const,
                commitment: buildChunkCommitment(
                  chunkIndex, chunkData, options.provider.consensusLimits?.maximumNftCommitmentBytes,
                ),
              },
            },
          });
        }
      }

      // Run VM debug and extract commitments
      const transaction = probeBuilder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(
        probeBuilder.inputs,
      );
      const program = { inputIndex: 0, sourceOutputs, transaction };
      let fullTrace: AuthenticationProgramStateCommon[];
      if (useSparseProbe) {
        // Large private-network contracts can execute millions of instructions. vm.debug() clones every state,
        // including its stack, so probing a several-hundred-kilobyte initializer can consume many gigabytes.
        // Commitment/transfer extraction only needs the inspected opcode and its adjacent EQUALVERIFY state.
        const sparseTrace: AuthenticationProgramStateCommon[] = [];
        const observedOpcodes = new Set<number>([
          Op.OP_OUTPUTTOKENCOMMITMENT,
          Op.OP_OUTPUTBYTECODE,
          Op.OP_OUTPUTVALUE,
          Op.OP_OUTPUTTOKENAMOUNT,
          Op.OP_OUTPUTTOKENCATEGORY,
          Op.OP_EQUALVERIFY,
        ]);
        let awaitingVerification = false;
        const vm = createVirtualMachineBch2026ForProvider(options.provider, {
          opcodes: observedOpcodes,
          beforeOperation: (unknownState) => {
            const state = unknownState as AuthenticationProgramStateCommon;
            const opcode = state.instructions[state.ip]?.opcode;
            if (opcode === Op.OP_EQUALVERIFY && !awaitingVerification) return;
            sparseTrace.push({
              ...state,
              stack: state.stack.slice(),
              alternateStack: state.alternateStack.slice(),
              controlStack: state.controlStack.slice(),
            });
            awaitingVerification = opcode !== Op.OP_EQUALVERIFY;
          },
        });
        const finalState = vm.evaluate(program) as AuthenticationProgramStateCommon;
        fullTrace = [...sparseTrace, finalState];
      } else {
        fullTrace = createVirtualMachineBch2026ForProvider(options.provider).debug(
          program,
        ) as AuthenticationProgramStateCommon[];
      }

      // Learn entry commitments even from a trace that stops at their placeholder equality check. On the next
      // iteration those commitments are present, allowing execution to reach later state/event derivations.
      const learnedEntryCommits = [...entryCommits];
      let learnedAnyEntry = false;
      if (entryOutputCount > 0) {
        const entryOutputBase = 1 + stateLayout.dataNftCount;
        for (const [outputIndex, commitment] of extractCommitmentMapFromTrace(fullTrace, {
          min: entryOutputBase,
          max: entryOutputBase + entryOutputCount,
        })) {
          learnedEntryCommits[outputIndex - entryOutputBase] = commitment;
          learnedAnyEntry = true;
        }
      }
      let entryLearningChanged = false;
      if (learnedAnyEntry) {
        for (let index = 0; index < learnedEntryCommits.length; index++) {
          if (learnedEntryCommits[index] !== entryCommits[index]) {
            entryLearningChanged = true;
            break;
          }
        }
      }
      if (entryLearningChanged) {
        entryCommits = learnedEntryCommits;
        continue;
      }
      if (!usesC2BatchWitnesses) {
        const learnedTrailing = [...trailingEntryCommits];
        let trailingChanged = false;
        for (const [collectionIndex, collectionName] of sortedCollections.entries()) {
          const outputIndex = sortedPlans.get(collectionName)!.trailingOutput;
          const learned = extractCommitmentMapFromTrace(fullTrace, {
            min: outputIndex, max: outputIndex + 1,
          }).get(outputIndex);
          if (learned !== undefined && learned !== learnedTrailing[collectionIndex]) {
            learnedTrailing[collectionIndex] = learned;
            trailingChanged = true;
          }
        }
        if (trailingChanged) {
          trailingEntryCommits = learnedTrailing;
          continue;
        }
      }

      // Extract state commitments with output-index range filtering
      const stateOutputRange = {
        min: 1, max: 1 + requiredIndices.length,
      };
      const stateCommitmentMap = extractCommitmentMapFromTrace(
        fullTrace, stateOutputRange,
      );
      if (stateCommitmentMap.size === 0) {
        const failedStep = [...fullTrace].reverse().find((step) => step.error);
        const vmError = failedStep?.error;
        const vmLocation = failedStep === undefined
          ? ''
          : ` at instruction ${failedStep.ip}/${failedStep.instructions.length}`;
        const vmStack = failedStep === undefined
          ? ''
          : ` (stack: ${failedStep.stack.slice(-4).map((item) => binToHex(item)).join(', ')})`;
        throw new Error(
          'Failed to derive initial state commitments from '
          + 'constructor. Ensure the constructor writes all '
          + 'state variables.'
          + (vmError === undefined ? '' : ` VM error${vmLocation}: ${vmError}${vmStack}`),
        );
      }

      // A subroutine-aware trace slice may expose only the last failing verification, so a partial positional
      // list cannot be assumed to be a prefix. Map each observed output slot back to its exact required NFT.
      for (const [outputIndex, commitment] of stateCommitmentMap) {
        const compactIndex = outputIndex - stateOutputRange.min;
        const nftIndex = requiredIndices[compactIndex];
        if (nftIndex !== undefined) currentCommitments[nftIndex] = commitment;
      }
      stateCommitments = requiredIndices.map((nftIndex) => currentCommitments[nftIndex]);

      // Extract entry commitments
      if (entryOutputCount > 0) {
        const entryOutputBase = 1 + stateLayout.dataNftCount;
        const entryOutputRange = {
          min: entryOutputBase,
          max: entryOutputBase + entryOutputCount,
        };
        for (const [outputIndex, commitment] of extractCommitmentMapFromTrace(fullTrace, entryOutputRange)) {
          entryCommits[outputIndex - entryOutputBase] = commitment;
        }
      }

      // Extract event commitments
      if (emitCount > 0) {
        const eventBase = 1 + stateLayout.dataNftCount + entryOutputCount
          + transferCount;
        const eventOutputRange = {
          min: eventBase, max: eventBase + emitCount,
        };
        for (const [outputIndex, commitment] of extractCommitmentMapFromTrace(fullTrace, eventOutputRange)) {
          eventCommits[outputIndex - eventBase] = commitment;
        }
      }

      // Extract transfer outputs
      transferOuts = [];
      if (transferCount > 0) {
        const tBase = 1 + stateLayout.dataNftCount + entryOutputCount;
        const bytecodes = extractVerifiedValuesFromTrace(
          fullTrace, Op.OP_OUTPUTBYTECODE,
          { min: tBase, max: tBase + transferCount },
        );
        const amounts = extractVerifiedValuesFromTrace(
          fullTrace, Op.OP_OUTPUTVALUE,
          { min: tBase, max: tBase + transferCount },
        );
        if (
          bytecodes.length >= transferCount
          && amounts.length >= transferCount
        ) {
          transferOuts = Array.from(
            { length: transferCount }, (_, i) => ({
              lockingBytecode: bytecodes[i],
              amount: decodeScriptNumber(amounts[i]),
            }),
          );
        }
      }

      // Once the complete constructor probe validates, every learned output placeholder is a fixed point.
      if (!fullTrace.some((step) => step.error !== undefined)) {
        deployConverged = true;
        break;
      }

      // Oscillation detection: if we've seen this exact commitment set before,
      // the derivation is cycling without converging.
      const deployKey = stateCommitments.join('|') + '||' + entryCommits.join('|')
        + '||' + trailingEntryCommits.join('|') + '||' + eventCommits.join('|');
      if (seenDeployKeys.has(deployKey)) {
        throw new Error(
          'Deploy derivation oscillation detected: commitment state is cycling without converging. '
          + 'This may indicate conflicting covenant constraints in the constructor.',
        );
      }
      seenDeployKeys.add(deployKey);
    }

    if (!deployConverged) {
      throw new Error(
        `Constructor commitment derivation did not converge after ${maxDeployIterations} probes.`,
      );
    }

    // Conditional constructor writes reserve fixed entry outputs even when their branch is not taken. The batch
    // probe plans against every potential target, so a materialized node can initially point through an empty
    // (nonexistent) output. Genesis is funder-authorized rather than covenant-spent: rebuild each C2 collection's
    // links over only the entries the trace actually materialized, preserving their computed values.
    for (const [collectionIndex, collectionName] of usesC2BatchWitnesses ? sortedCollections.entries() : []) {
      const materialized = entryAccesses
        .map((access, index) => ({ access, index, commitment: entryCommits[index] }))
        .filter(({ access, commitment }) => access.collection === collectionName && commitment.length >= 128)
        .map(({ index, commitment }) => ({ index, ...decodeEntryCommitment(hexToBin(commitment)) }))
        .sort((a, b) => {
          const av = bytesToSlotValue(a.slot);
          const bv = bytesToSlotValue(b.slot);
          return av < bv ? -1 : av > bv ? 1 : 0;
        });
      for (let i = 0; i < materialized.length; i++) {
        const entry = materialized[i];
        entryCommits[entry.index] = binToHex(encodeEntryCommitment(
          entry.slot, materialized[i + 1]?.slot ?? new Uint8Array(32), entry.value,
        ));
      }
      trailingEntryCommits[collectionIndex] = binToHex(encodeEntryCommitment(
        new Uint8Array(32), materialized[0]?.slot ?? new Uint8Array(32),
      ));
    }

    return {
      // `stateCommitments` contains only constructor-required indices. Return the complete converged state so
      // untouched, explicitly seeded NFTs are materialized rather than becoming undefined genesis commitments.
      stateCommitments: currentCommitments,
      entryCommitments: entryCommits,
      trailingEntryCommitments: trailingEntryCommits,
      eventCommitments: eventCommits,
      transferOutputs: transferOuts,
    };
  }

  /**
   * Discover a stateful contract by finding a minting NFT at a given address.
   *
   * Fetches UTXOs at the specified address (or the contract's token address by
   * default) and picks the first minting NFT to determine the category ID.
   *
   * @param contract - A Contract instance for the stateful contract.
   * @param masterAddress - Optional address to search. Defaults to `contract.tokenAddress`.
   */
  static async discover<T extends Artifact>(
    contract: Contract<T>,
    masterAddress?: string,
  ): Promise<ConnectedStatefulContract<T>> {
    if (!contract.isStateful) {
      throw new Error(`Contract ${contract.name} is not a stateful contract`);
    }

    const address = masterAddress ?? contract.tokenAddress;
    const utxos = await contract.provider.getUtxos(address);

    const masterUtxo = utxos.find((utxo) => (
      utxo.token?.nft?.capability === 'minting'
    ));

    if (!masterUtxo) {
      throw new Error(
        `No minting NFT found at address ${address}. `
        + 'Ensure the stateful contract has been deployed and the master UTXO is at this address.',
      );
    }

    const connected = StatefulContract.withCategory(contract, masterUtxo.token!.category);

    // Validate that the discovered minting NFT's category produces the expected contract address.
    // This prevents accepting a minting NFT that belongs to a different contract when a custom
    // masterAddress is provided.
    if (connected.tokenAddress !== address) {
      throw new Error(
        `Minting NFT with category ${masterUtxo.token!.category} at address ${address} `
        + `does not belong to this contract (expected token address: ${connected.tokenAddress}). `
        + 'The NFT may belong to a different contract deployed at the same address.',
      );
    }

    return connected;
  }

  get address(): string {
    // For an address-constructed instance the address is known immediately (the category-less scaffold's own
    // address would differ until resolution).
    return this._pendingAddress ?? this.inner.address;
  }

  get tokenAddress(): string {
    return this.inner.tokenAddress;
  }

  get name(): string {
    return this.inner.name;
  }

  get provider(): NetworkProvider {
    return this.inner.provider;
  }

  /** The runner bound to this contract: a Signer when connected read-write, else the read-only NetworkProvider
   * (ethers.js `contract.runner`). */
  get runner(): ContractRunner {
    return this._signer ?? this.provider;
  }

  /** The contract's ABI + layout artifact (ethers.js `contract.interface`). */
  get interface(): TArtifact {
    return this.inner.artifact;
  }

  /** The contract's on-chain identifier - its p2sh address (ethers.js `contract.target`). */
  get target(): string {
    return this._logicalAddress ?? this.address;
  }

  /** The contract's p2sh address (async, ethers.js `contract.getAddress()`). */
  async getAddress(): Promise<string> {
    return this.target;
  }

  async getState(): Promise<Record<string, StateValueType>> {
    await this._ensureResolved();
    const onChainState = await getContractState(this.inner, this.categoryId);
    const state = onChainState.state as Record<string, StateValueType>;
    // User-facing boundary: attach typechain .toObject()/.toArray() to struct/array state values (ethers parity).
    // Kept out of the shared decoder so the internal derive path never sees these accessors.
    for (const k of Object.keys(state)) attachDecodedAccessors(state[k] as unknown as StateValue);
    return state;
  }

  async getFullState(): Promise<OnChainState> {
    await this._ensureResolved();
    return getContractState(this.inner, this.categoryId);
  }

  /**
   * Get the address for a token container holding foreign tokens.
   *
   * @param tokenContainerCategoryIdHex - Hex-encoded 32-byte token container category ID.
   */
  /** Get the data NFT address for this contract's category. */
  getDataNftAddress(): string {
    return getDataNftAddress(this.inner, this.categoryId);
  }

  /** Get the entry NFT address for a given collection. */
  getEntryNftAddress(collectionSignature: string): string {
    return getEntryNftAddress(this.inner, this.categoryId, collectionSignature);
  }

  /** Get the event NFT address for a given event signature. */
  getEventNftAddress(eventSignature: string): string {
    return getEventNftAddress(this.inner, this.categoryId, eventSignature);
  }

  /** Get the satoshi container address. */
  getSatoshiContainerAddress(): string {
    return getSatoshiContainerAddress(this.inner, this.categoryId);
  }

  getTokenContainerAddress(tokenContainerCategoryIdHex: string): string {
    return getTokenContainerAddress(this.inner, this.categoryId, tokenContainerCategoryIdHex);
  }

  /**
   * Get the satoshi container address and a helper to read its balance.
   */
  get satoshiContainer(): { address: string; getBalance: () => Promise<bigint> } {
    const address = getSatoshiContainerAddress(this.inner, this.categoryId);
    return {
      address,
      getBalance: async (): Promise<bigint> => {
        const utxos = await this.inner.provider.getUtxos(address);
        return utxos.reduce((sum, u) => sum + u.satoshis, 0n);
      },
    };
  }

  async getBalance(): Promise<bigint> {
    await this._ensureResolved();
    return this.satoshiContainer.getBalance();
  }

  /**
   * Query events by name or signature, optionally filtering by indexed parameter values.
   *
   * For named events: reads from the event-specific P2SH32 address.
   * For anonymous events: reads from the shared anonymous event address, then
   * disambiguates by trying to decode against all anonymous event definitions.
   *
   * @param eventNameOrSignature - Event name (e.g. "Transfer") or full signature (e.g. "Transfer(pubkey,int)")
   * @param filters - Optional filter on indexed parameter values
   */
  async queryEvents(
    eventNameOrSignature: string,
    filters?: EventFilter,
  ): Promise<ParsedEvent[]> {
    await this._ensureResolved();
    const artifact = this.inner.artifact;
    const eventDefs = artifact.events ?? [];
    const provider = this.inner.provider;
    const structs = artifact.stateLayout?.structs;

    // Resolve the event definition
    const eventDef = eventNameOrSignature.includes('(')
      ? eventDefs.find((e) => e.signature === eventNameOrSignature)
      : eventDefs.find((e) => e.name === eventNameOrSignature);

    if (!eventDef) {
      throw new Error(`Unknown event: ${eventNameOrSignature}`);
    }

    if (eventDef.anonymous) {
      // Anonymous event: read from shared anonymous address
      const anonymousAddress = getAnonymousEventNftAddress(this.inner, this.categoryId);
      const allAnonymousDefs = eventDefs.filter((e) => e.anonymous);
      const allEvents = await readAnonymousEventsFromChain(
        provider, anonymousAddress, this.categoryId, allAnonymousDefs, structs,
      );

      // Filter to the requested event
      let filtered = allEvents.filter((e) => e.eventSignature === eventDef.signature);

      // Apply indexed parameter filters
      if (filters && Object.keys(filters).length > 0) {
        const indexedParams = new Set(
          eventDef.parameters.filter((p) => p.indexed).map((p) => p.name),
        );
        for (const key of Object.keys(filters)) {
          if (!indexedParams.has(key)) {
            throw new Error(
              `Filter key '${key}' is not an indexed parameter of event '${eventDef.name}'`,
            );
          }
        }
        filtered = filtered.filter((event) => Object.entries(filters).every(
          ([key, val]) => valuesEqual(event.values[key], val),
        ));
      }

      return filtered;
    }

    // Named event: read from event-specific address
    const eventAddress = getEventNftAddress(this.inner, this.categoryId, eventDef.signature);
    return readEventsFiltered(
      provider, eventAddress, this.categoryId, eventDef, filters, structs,
    );
  }

  // ---- ethers-v6 events facade (queryFilter / filters / getEvent / on ...), backed by queryEvents ----

  private _resolveEventDef(nameOrSignature: string): EventDefinitionAbi {
    const eventDefs = this.inner.artifact.events ?? [];
    const eventDef = nameOrSignature.includes('(')
      ? eventDefs.find((e) => e.signature === nameOrSignature)
      : eventDefs.find((e) => e.name === nameOrSignature);
    if (!eventDef) throw new Error(`Unknown event: ${nameOrSignature}`);
    return eventDef;
  }

  /**
   * Resolve an event to a callable filter handle (ethers `contract.getEvent(name)`). Call the handle with indexed
   * argument values (null/undefined = wildcard) to build a filter for queryFilter / on: `sc.getEvent('Transfer')(from)`.
   */
  getEvent(nameOrSignature: string): StatefulContractEvent {
    const eventDef = this._resolveEventDef(nameOrSignature);
    const indexed = eventDef.parameters.filter((p) => p.indexed);
    const handle = ((...indexedArgs: Array<StateValueType | null | undefined>): DeferredEventFilter => {
      if (indexedArgs.length > indexed.length) {
        throw new Error(
          `Event '${eventDef.name}' has ${indexed.length} indexed parameter(s), got ${indexedArgs.length}.`,
        );
      }
      const filter: EventFilter = {};
      indexedArgs.forEach((val, i) => {
        if (val !== null && val !== undefined) filter[indexed[i].name] = val;
      });
      return { eventDef, filter };
    }) as StatefulContractEvent;
    handle.eventName = eventDef.name;
    handle.signature = eventDef.signature;
    handle.eventDef = eventDef;
    return handle;
  }

  /**
   * Lazy event-filter builders (ethers `contract.filters`): `sc.filters.Transfer(from)` returns a
   * DeferredEventFilter for queryFilter / on. `sc.filters.Transfer` (uncalled) is the event handle itself.
   */
  get filters(): Record<string, StatefulContractEvent> {
    if (!this._filtersProxy) {
      this._filtersProxy = new Proxy({} as Record<string, StatefulContractEvent>, {
        get: (_t, prop) => {
          if (typeof prop !== 'string') return undefined;
          try { return this.getEvent(prop); } catch { return undefined; }
        },
        has: (_t, prop) => typeof prop === 'string'
          && (this.inner.artifact.events ?? []).some((e) => e.name === prop || e.signature === prop),
      });
    }
    return this._filtersProxy;
  }

  private _filtersProxy?: Record<string, StatefulContractEvent>;

  private _eventLog(p: ParsedEvent, eventDef?: EventDefinitionAbi): EventLog {
    return {
      eventName: p.eventName ?? eventDef?.name ?? '',
      eventSignature: p.eventSignature ?? eventDef?.signature ?? '',
      args: p.values as Record<string, StateValueType>,
      txid: p.txid,
      vout: p.vout,
    };
  }

  /**
   * Read historic events (ethers `contract.queryFilter`). `event` is an event name/signature, a
   * `filters.Name(...)` result, or `'*'` for all events. Returns EventLog[]. The fromBlock/toBlock arguments are
   * accepted for ethers parity but Bitcoin Cash events are a UTXO set, so the current set is always returned.
   */
  async queryFilter(
    event: ContractEventName, _fromBlock?: number | string, _toBlock?: number | string,
  ): Promise<EventLog[]> {
    if (event === '*') {
      const perEvent = await Promise.all(
        (this.inner.artifact.events ?? []).map(async (e) => (await this.queryEvents(e.signature))
          .map((p) => this._eventLog(p, e))),
      );
      return perEvent.flat();
    }
    let eventDef: EventDefinitionAbi;
    let filter: EventFilter | undefined;
    if (typeof event === 'string') {
      eventDef = this._resolveEventDef(event);
    } else if (typeof event === 'function') { // StatefulContractEvent handle (no bound args)
      eventDef = event.eventDef;
    } else { // DeferredEventFilter
      eventDef = event.eventDef;
      filter = event.filter;
    }
    const parsed = await this.queryEvents(eventDef.signature, filter);
    return parsed.map((p) => this._eventLog(p, eventDef));
  }

  // Polling event subscriptions (ethers on/once). BCH has no push events, so listeners poll the indexer at
  // `pollingInterval` ms and fire for events not seen before. Keyed by event signature + indexed filter.
  private _eventSubs = new Map<string, { event: ContractEventName; listeners: Set<EventListener>;
    seen: Set<string>; }>();

  private _eventPoller?: ReturnType<typeof setInterval>;

  /** Poll interval (ms) for on()/once() event listeners. */
  pollingInterval = 4000;

  private static _eventKey(event: ContractEventName): string {
    if (typeof event === 'string') return `name:${event}`;
    const { eventDef, filter } = typeof event === 'function' ? { eventDef: event.eventDef, filter: {} } : event;
    const f = Object.keys(filter).sort()
      .map((k) => `${k}=${filter[k] instanceof Uint8Array ? binToHex(filter[k] as Uint8Array) : String(filter[k])}`)
      .join('&');
    return `sig:${eventDef.signature}|${f}`;
  }

  private static _logKey(log: EventLog): string { return `${log.txid}:${log.vout}`; }

  private async _pollEvents(): Promise<void> {
    for (const sub of this._eventSubs.values()) {
      let logs: EventLog[];
      try { logs = await this.queryFilter(sub.event); } catch { continue; }
      for (const log of logs) {
        const k = StatefulContract._logKey(log);
        if (sub.seen.has(k)) continue;
        sub.seen.add(k);
        for (const listener of [...sub.listeners]) listener(log);
      }
    }
  }

  private _ensurePolling(): void {
    if (this._eventPoller || this._eventSubs.size === 0) return;
    this._eventPoller = setInterval(() => { void this._pollEvents(); }, this.pollingInterval);
    (this._eventPoller as { unref?: () => void }).unref?.(); // do not keep the process alive
  }

  private _maybeStopPolling(): void {
    if (this._eventPoller && this._eventSubs.size === 0) {
      clearInterval(this._eventPoller);
      this._eventPoller = undefined;
    }
  }

  /** Subscribe to new events (ethers `contract.on`). Existing events are seeded as "seen" so only events that
   * appear after subscribing fire the listener. */
  async on(event: ContractEventName, listener: EventListener): Promise<this> {
    const key = StatefulContract._eventKey(event);
    let sub = this._eventSubs.get(key);
    if (!sub) {
      const current = await this.queryFilter(event);
      sub = { event, listeners: new Set(), seen: new Set(current.map(StatefulContract._logKey)) };
      this._eventSubs.set(key, sub);
    }
    sub.listeners.add(listener);
    this._ensurePolling();
    return this;
  }

  /** Subscribe to the next occurrence of an event, then auto-unsubscribe (ethers `contract.once`). */
  async once(event: ContractEventName, listener: EventListener): Promise<this> {
    const wrapper: EventListener = (log) => { void this.off(event, wrapper); listener(log); };
    return this.on(event, wrapper);
  }

  /** Remove a listener (or all listeners for an event) (ethers `contract.off`). */
  async off(event: ContractEventName, listener?: EventListener): Promise<this> {
    const sub = this._eventSubs.get(StatefulContract._eventKey(event));
    if (sub) {
      if (listener) sub.listeners.delete(listener); else sub.listeners.clear();
      if (sub.listeners.size === 0) this._eventSubs.delete(StatefulContract._eventKey(event));
    }
    this._maybeStopPolling();
    return this;
  }

  /** Remove all listeners, optionally for a single event (ethers `contract.removeAllListeners`). */
  async removeAllListeners(event?: ContractEventName): Promise<this> {
    if (event === undefined) this._eventSubs.clear();
    else this._eventSubs.delete(StatefulContract._eventKey(event));
    this._maybeStopPolling();
    return this;
  }

  /** Count listeners, optionally for a single event (ethers `contract.listenerCount`). */
  async listenerCount(event?: ContractEventName): Promise<number> {
    if (event === undefined) {
      return [...this._eventSubs.values()].reduce((n, s) => n + s.listeners.size, 0);
    }
    return this._eventSubs.get(StatefulContract._eventKey(event))?.listeners.size ?? 0;
  }

  /** List listeners, optionally for a single event (ethers `contract.listeners`). */
  async listeners(event?: ContractEventName): Promise<EventListener[]> {
    if (event === undefined) return [...this._eventSubs.values()].flatMap((s) => [...s.listeners]);
    return [...(this._eventSubs.get(StatefulContract._eventKey(event))?.listeners ?? [])];
  }

  /** Alias for on (ethers `contract.addListener`). */
  async addListener(event: ContractEventName, listener: EventListener): Promise<this> {
    return this.on(event, listener);
  }

  /** Alias for off (ethers `contract.removeListener`). */
  async removeListener(event: ContractEventName, listener: EventListener): Promise<this> {
    return this.off(event, listener);
  }

  /**
   * Enumerate all entries in a mapping or array collection.
   *
   * Queries the entry NFT covenant address for this collection, decodes each
   * NFT commitment, and returns all key-value pairs.
   *
   * @param collectionNameOrSignature - Collection name (e.g. "balances") or full signature
   *   (e.g. "balances:mapping(pubkey => int)")
   * @returns Array of decoded entries with key(s) and value
   */
  async getEntries(collectionNameOrSignature: string): Promise<Array<{
    slot?: Uint8Array;
    key?: bigint | boolean | Uint8Array;
    keys?: Array<bigint | boolean | Uint8Array>;
    value: StateValue;
  }>> {
    const artifact = this.inner.artifact;
    const stateLayout = artifact.stateLayout;
    if (!stateLayout) {
      throw new Error(`Contract ${this.inner.name} is not a stateful contract`);
    }

    const collectionSignature = resolveCollectionSignature(artifact, collectionNameOrSignature);
    const collection = stateLayout.collections?.find((c) => c.signature === collectionSignature);
    if (!collection) {
      throw new Error(`Unknown collection: ${collectionNameOrSignature}`);
    }

    const entryAddress = getEntryNftAddress(this.inner, this.categoryId, collectionSignature);
    const utxos = await this.inner.provider.getUtxos(entryAddress);

    const entryUtxos = utxos.filter((utxo) => (
      utxo.token
      && utxo.token.category === this.categoryId
      && utxo.token.nft
      && utxo.token.nft.capability === 'mutable'
      && utxo.token.nft.commitment.length > 0
    ));

    const structs = stateLayout.structs;

    const entries: Array<{
      slot?: Uint8Array;
      key?: bigint | boolean | Uint8Array;
      keys?: Array<bigint | boolean | Uint8Array>;
      value: StateValue;
    }> = [];

    for (const utxo of entryUtxos) {
      try {
        const parsed = decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment));
        if (parsed.slot.every((byte) => byte === 0)) continue; // HEAD is structural, not a logical entry
        const type = collection.valueType;
        let raw = parsed.value;
        if (collection.chunkableValue && raw.length >= 4) {
          const len = raw[0] | (raw[1] << 8) | (raw[2] << 16) | (raw[3] << 24);
          if (len <= 60) {
            if (raw.length !== 4 + len) throw new RangeError('invalid inline C2 value length');
            raw = raw.slice(4);
          } else {
            if (raw.length !== 4 + 32 + VALUE_HEAD_SIZE) throw new RangeError('invalid chunked C2 value head');
            const root = raw.slice(4, 36);
            const headData = raw.slice(36);
            const chunkAddress = getValueChunkAddress(
              this.inner, this.categoryId, collection.name, parsed.slot, root,
            );
            const chunks = (await this.inner.provider.getUtxos(chunkAddress))
              .filter((chunk) => chunk.token?.category === this.categoryId
                && chunk.token?.nft?.capability === 'mutable'
                && !!chunk.token.nft.commitment)
              .map((chunk) => parseValueChunkCommitment(chunk.token!.nft!.commitment))
              .sort((a, b) => a.chunkIndex - b.chunkIndex);
            raw = joinValueChunks(headData, chunks, len);
            if (binToHex(sha256Sync(raw)) !== binToHex(root)) {
              throw new Error('C2 value chunks do not match the authenticated root');
            }
          }
        }
        let value: StateValue;
        if (collection.chunkableValue && type === 'bytes') value = raw;
        else if (collection.chunkableValue && type === 'string') value = binToUtf8(raw);
        else if (collection.chunkableValue) {
          const arrInfo = parseArrayTypeString(type);
          if (arrInfo) {
            value = raw.length === 0 ? []
              : attachDecodedAccessors(decodePackedEventArray(raw, 0, type, structs).value) as StateValue;
          } else {
            value = raw.length === 0 ? []
              : attachDecodedAccessors(decodePushdataValue(raw, 0, type, structs).value) as StateValue;
          }
        } else if (type === 'bool') value = vmNumberToBigInt(raw) !== 0n;
        else if (/^(u?int|bigint|[u]?fixed|enum)/.test(type)) value = vmNumberToBigInt(raw);
        else {
          try {
            value = attachDecodedAccessors(decodePushdataValue(raw, 0, type, structs).value) as StateValue;
          } catch { value = raw; }
        }
        entries.push({ slot: parsed.slot, value });
      } catch (e) {
        // Commitment doesn't parse for this collection - skip, but log for debugging
        console.warn('Warning: failed to parse entry commitment for UTXO', utxo.txid ?? 'unknown', e);
      }
    }

    return entries;
  }

  // n for a PARAM blockhash read = the matching call arg (a direct-identifier n). Computed reads
  // (<computed:i> keys) are NOT resolved here - they come from the probe trace. Returns null on a non-bigint.
  private paramBlockhashN(readKey: string, args: any[], abiFunction: AbiFunction): bigint | null {
    const visible = abiFunction.inputs.filter((i) => !i.name.startsWith('__internal__'));
    const pIdx = visible.findIndex((i) => i.name === readKey);
    if (pIdx < 0) return null;
    const bn = args[pIdx];
    return typeof bn === 'bigint' ? bn : null;
  }

  // Run a minimal covenant probe (master + data NFTs + the already-resolved oracle co-spends, max-height
  // locktime so any tx.time >= n CLTV passes) and read the blockhash reads' (inputIndex, n) off the trace.
  // The covenant computes each n on-stack, so ANY expression resolves without JS re-derivation. A read whose
  // oracle is not yet co-spent aborts the probe at its OP_UTXOTOKENCATEGORY - but the (n, idx) is captured on
  // the pre-abort step - so the caller resolves reads one at a time in slot order (priorCoSpends grows).
  private async _extractBlockhashReads(
    masterUtxo: Utxo, masterUnlocker: Unlocker, dataNftUtxos: Utxo[],
    priorCoSpends: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output }>,
    base: number, slotCount: number,
  ): Promise<Array<{ inputIndex: number; n: bigint }>> {
    const { CovenantTransactionBuilder } = await import('./CovenantTransactionBuilder.js');
    const vm = createVirtualMachineBch2026ForProvider(this.inner.provider);
    const b = new CovenantTransactionBuilder({ provider: this.inner.provider });
    b.locktime = 499999999; // max block-height locktime: satisfies any tx.time >= n (height) CLTV
    const dataUnlockers = dataNftUtxos.map(() => createDataNftUnlocker(this.inner, 0, this.categoryId));
    b.addInput(masterUtxo, masterUnlocker);
    dataNftUtxos.forEach((u, i) => b.addInput(u, dataUnlockers[i]));
    for (const cs of priorCoSpends) b.addInput(cs.utxo, cs.unlocker);
    b.addOutput({ to: masterUnlocker.generateLockingBytecode(), amount: masterUtxo.satoshis, token: masterUtxo.token });
    dataNftUtxos.forEach((u, i) => b.addOutput({
      to: dataUnlockers[i].generateLockingBytecode(), amount: u.satoshis, token: u.token,
    }));
    for (const cs of priorCoSpends) b.addOutput(cs.recreate);
    const transaction = b.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(b.inputs);
    const trace = vm.debug({ inputIndex: 0, sourceOutputs, transaction }) as AuthenticationProgramStateCommon[];
    return extractBlockhashReadsFromTrace(trace, base, slotCount);
  }

  /** SCB1 graph variant of the trace probe. The compiler reserves a sparse fixed row band, so preceding inactive
   * positions are represented by inert inputs and prior active oracle co-spends are placed at their exact slots. */
  private async _extractGraphBlockhashRead(
    masterUtxo: Utxo, masterUnlocker: Unlocker, dataNftUtxos: Utxo[],
    prior: Array<{ slotOrdinal: number; utxo: Utxo; unlocker: Unlocker; recreate: Output }>,
    base: number, targetOrdinal: number, slotCount: number, masterInputIndex = 0,
  ): Promise<bigint | null> {
    const { CovenantTransactionBuilder } = await import('./CovenantTransactionBuilder.js');
    const vm = createVirtualMachineBch2026ForProvider(this.inner.provider);
    const b = new CovenantTransactionBuilder({ provider: this.inner.provider });
    b.locktime = 499999999;
    const dataUnlockers = dataNftUtxos.map(() => createDataNftUnlocker(this.inner, 0, this.categoryId));
    const inertUnlocker: Unlocker = {
      generateLockingBytecode: () => DUMMY_FUNDER_LOCKING_BYTECODE,
      generateUnlockingBytecode: () => DUMMY_FUNDER_UNLOCKING_BYTECODE,
    };
    while (b.inputs.length < masterInputIndex) {
      const i = b.inputs.length;
      b.addInput({ txid: (0x8000 + i).toString(16).padStart(64, '0'), vout: 0, satoshis: 10000n }, inertUnlocker);
    }
    b.addInput(masterUtxo, masterUnlocker);
    dataNftUtxos.forEach((u, i) => b.addInput(u, dataUnlockers[i]));
    const priorByIndex = new Map(prior.map((p) => [base + p.slotOrdinal, p]));
    while (b.inputs.length <= base + targetOrdinal) {
      const inputIndex = b.inputs.length;
      const p = priorByIndex.get(inputIndex);
      if (p) b.addInput(p.utxo, p.unlocker);
      else b.addInput({ txid: inputIndex.toString(16).padStart(64, '0'), vout: 0, satoshis: 10000n }, inertUnlocker);
    }
    while (b.outputs.length < masterInputIndex) {
      b.addOutput({ to: DUMMY_FUNDER_LOCKING_BYTECODE, amount: 10000n });
    }
    b.addOutput({ to: masterUnlocker.generateLockingBytecode(), amount: masterUtxo.satoshis, token: masterUtxo.token });
    dataNftUtxos.forEach((u, i) => b.addOutput({
      to: dataUnlockers[i].generateLockingBytecode(), amount: u.satoshis, token: u.token,
    }));
    while (b.outputs.length < b.inputs.length) {
      const inputIndex = b.outputs.length;
      const p = priorByIndex.get(inputIndex);
      b.addOutput(p?.recreate ?? { to: DUMMY_FUNDER_LOCKING_BYTECODE, amount: 10000n });
    }
    const transaction = b.buildLibauthTransaction();
    const trace = vm.debug({
      inputIndex: masterInputIndex, sourceOutputs: generateLibauthSourceOutputs(b.inputs), transaction,
    }) as AuthenticationProgramStateCommon[];
    return extractBlockhashReadsFromTrace(trace, base, slotCount)
      .find((read) => read.inputIndex === base + targetOrdinal)?.n ?? null;
  }

  // Resolve every blockhash oracle co-spend for a call, ordered by slot (ordinal 0..slotCount-1). Reads are
  // resolved STRICTLY in slot order so the co-spend inputs stay contiguous from the bottom: a param read's n
  // is its call arg; a computed read's n is extracted from a probe that co-spends the already-resolved lower
  // reads (so the covenant reaches this read). Single source of truth: computed n comes from the covenant.
  private async _resolveBlockhashCoSpends(
    abiFunction: AbiFunction, args: any[], base: number, slotCount: number,
    masterUtxo: Utxo, masterUnlocker: Unlocker, dataNftUtxos: Utxo[],
  ): Promise<Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; locktime: number }>> {
    const reads = abiFunction.blockhashReads ?? [];
    const ordered: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; locktime: number }> = [];
    for (let k = 0; k < reads.length; k++) {
      let n: bigint | null;
      if (isComputedBlockhashKey(reads[k])) {
        const extracted = await this._extractBlockhashReads(
          masterUtxo, masterUnlocker, dataNftUtxos, ordered, base, slotCount,
        );
        n = extracted.find((r) => r.inputIndex === base + k)?.n ?? null;
      } else {
        n = this.paramBlockhashN(reads[k], args, abiFunction);
      }
      if (n === null) throw new Error(`blockhash: could not resolve n for read "${reads[k]}" (slot ${k})`);
      const cs = await resolveBlockhashCoSpend(this.inner.provider, this.categoryId, n);
      if (!cs) throw new Error(`blockhash(${n}): no (n->hash) oracle UTXO at addr(${n})`);
      ordered.push({ utxo: cs.utxo, unlocker: cs.unlocker, recreate: cs.recreateOutput, locktime: cs.locktime });
    }
    return ordered;
  }

  // keccak256 compute side-cars for a stateful (branded) function: one per keccak256 call, co-spent at the
  // consecutive keccakSideCar block-layout slots (right after blockhashOracle). Each side-car input feeds
  // <pad><preimage><redeem> and its recreation commits R_i = keccak256(preimage_i); the master covenant binds
  // preimage_i == its call arg and reads R_i from the recreation. Direct-parameter args come from the call
  // args; complex/nested args (keccakPreimageParams[i] === null) are not yet supported for stateful contracts
  // (the stateless VM-probe path does not port to the derivation build) and throw. Ordered by call.
  private async _resolveKeccakComputeCoSpends(
    abiFunction: AbiFunction, args: any[],
    probeCtx?: {
      masterUtxo: Utxo; masterUnlocker: Unlocker; dataNftUtxos: Utxo[]; dataNftUnlockers: Unlocker[];
      frontRegionInputs?: UnlockableUtxo[]; locktime?: number;
    },
  ): Promise<Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; commitment: Uint8Array }>> {
    const params = abiFunction.keccakPreimageParams ?? [];
    if (params.length === 0 || !this.categoryId) return [];
    // A stateful DYNAMIC keccak loop (keccakLoopReads) reads N runtime trailing side-cars - resolved by the
    // separate _resolveStatefulKeccakLoop progressive-probe path, not the fixed-slot path here. Reaching this
    // with keccakLoopReads set is an internal routing bug (the caller should branch on keccakLoopReads first).
    if (abiFunction.keccakLoopReads) {
      throw new Error('internal: stateful dynamic keccak256 loop must resolve via _resolveStatefulKeccakLoop.');
    }
    // Branded to the contract's category. The covenant brand-checks the master's OP_UTXOTOKENCATEGORY, which
    // the VM returns in INTERNAL (reversed) byte order, so the baked salt must be the reversed category.
    const salt = hexToBin(this.categoryId).slice().reverse();
    const lock = keccakComputeLockingBytecode(salt, true); // stateful (OP_INPUTINDEX self-preservation) variant
    const scUtxos = (await this.inner.provider.getUtxosForLockingBytecode(lock))
      .filter((u) => u.token?.nft?.capability === 'mutable');
    if (scUtxos.length < params.length) {
      throw new Error(`keccak256 needs ${params.length} compute side-car UTXO(s) at the branded address; `
        + `found ${scUtxos.length}. Deploy one mutable-NFT side-car per keccak256 call.`);
    }
    const visible = abiFunction.inputs.filter((i) => !i.name.startsWith('__internal__'));
    // Direct-parameter preimages come straight from the args; complex/nested args (recorded null by codegen)
    // are resolved by a VM probe of the master (mirrors the stateless resolveKeccakPreimages, but positioned
    // at the block-layout keccakSideCar slots).
    const preimages: (Uint8Array | null)[] = params.map(
      (p) => (p ? (args[visible.findIndex((x) => x.name === p)] instanceof Uint8Array
        ? args[visible.findIndex((x) => x.name === p)] : null) : null),
    );
    if (preimages.some((p) => p === null)) {
      await this._extractStatefulKeccakPreimages(abiFunction, preimages, salt, scUtxos, probeCtx);
    }
    const resolved: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; commitment: Uint8Array }> = [];
    for (let i = 0; i < params.length; i++) {
      const preimage = preimages[i];
      if (!(preimage instanceof Uint8Array)) throw new Error(`keccak256 preimage ${i} could not be resolved.`);
      const { unlocker, recreate, commitment } = buildKeccakComputeSidecar(preimage, salt, scUtxos[i], true);
      resolved.push({ utxo: scUtxos[i], unlocker, recreate, commitment });
    }
    return resolved;
  }

  /**
   * Resolve the recovery side-car PAIRS for a stateful ecrecoverPubKey function: one A+B pair per call, branded to the
   * contract's category, positioned at the ecrecoverSideCar block-layout slots (A = slot 2i, B = slot 2i+1). Mirrors
   * _resolveKeccakComputeCoSpends but a pair per call (A commits H_A, B commits the recovered pubkey Q). The (h,v,r,s)
   * args come straight from the direct parameters; the split (chunkA) is VM-probed. Returns a flat A0,B0,A1,B1,.. list.
   */
  private async _resolveEcrecoverComputeCoSpends(
    abiFunction: AbiFunction, args: any[],
  ): Promise<Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output }>> {
    const calls = abiFunction.ecrecoverArgParams ?? [];
    if (calls.length === 0 || !this.categoryId) return [];
    const salt = hexToBin(this.categoryId).slice().reverse(); // branded: OP_UTXOTOKENCATEGORY is internal (reversed)
    const [lockA, lockB] = [ecrecoverComputeLockingBytecode(salt, 'A'), ecrecoverComputeLockingBytecode(salt, 'B')];
    const [utxosA, utxosB] = await Promise.all([
      this.inner.provider.getUtxosForLockingBytecode(lockA), this.inner.provider.getUtxosForLockingBytecode(lockB),
    ]);
    const freeA = utxosA.filter((u) => u.token?.nft?.capability === 'mutable');
    const freeB = utxosB.filter((u) => u.token?.nft?.capability === 'mutable');
    if (freeA.length < calls.length || freeB.length < calls.length) {
      throw new Error(`ecrecoverPubKey needs ${calls.length} A + ${calls.length} B recovery side-car UTXO(s) at the `
        + `branded address; found ${freeA.length} A + ${freeB.length} B. Deploy one A+B pair per call.`);
    }
    const visible = abiFunction.inputs.filter((i) => !i.name.startsWith('__internal__'));
    const argOf = (p: string | null): unknown => (p ? args[visible.findIndex((x) => x.name === p)] : undefined);
    const resolved: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output }> = [];
    for (let i = 0; i < calls.length; i++) {
      const [hp, vp, rp, sp] = calls[i];
      const hash = argOf(hp), r = argOf(rp), s = argOf(sp), vRaw = argOf(vp);
      if (!(hash instanceof Uint8Array) || !(r instanceof Uint8Array) || !(s instanceof Uint8Array)) {
        throw new Error('ecrecoverPubKey in a stateful contract requires direct (hash, v, r, s) parameters.');
      }
      const wit = computeEcrecoverWitness(hash, typeof vRaw === 'bigint' ? Number(vRaw) : Number(vRaw), r, s);
      const chunkA = probeEcrecoverSplit(wit, salt, freeA[i], freeB[i]);
      const { unlockerA, recreateA, unlockerB, recreateB } = buildEcrecoverComputeSidecars(
        wit, chunkA, salt, freeA[i], freeB[i],
      );
      resolved.push({ utxo: freeA[i], unlocker: unlockerA, recreate: recreateA });
      resolved.push({ utxo: freeB[i], unlocker: unlockerB, recreate: recreateB });
    }
    return resolved;
  }

  // Resolve complex/nested keccak256 preimages (null params) for a STATEFUL contract via a VM probe: build a
  // minimal tx (master + data NFTs + placeholder keccak side-cars at their block-layout slots), debug the
  // master, and read each unresolved call's argument off the trace at its OP_INPUTBYTECODE step (before the
  // binding OP_EQUALVERIFY aborts). Nested calls resolve one per probe (inner-to-outer), like the stateless
  // path. Requires the probe context; unsupported alongside front-region oracles/reads that shift the keccak
  // slot (throws). Mutates `preimages` in place.
  private async _extractStatefulKeccakPreimages(
    abiFunction: AbiFunction, preimages: (Uint8Array | null)[], salt: Uint8Array, scUtxos: Utxo[],
    probeCtx?: {
      masterUtxo: Utxo; masterUnlocker: Unlocker; dataNftUtxos: Utxo[]; dataNftUnlockers: Unlocker[];
      frontRegionInputs?: UnlockableUtxo[]; locktime?: number;
    },
  ): Promise<void> {
    if (!probeCtx) {
      throw new Error('keccak256 with a complex/nested argument in a stateful contract is resolved during '
        + 'auto-derivation; build the call through StatefulContract (internal probe context missing).');
    }
    const { masterUtxo, masterUnlocker, dataNftUtxos, dataNftUnlockers } = probeCtx;
    // Front-region inputs (read-only data NFTs then blockhash oracles) sit between the data NFTs and the keccak
    // side-cars, shifting the side-car base. Positioning them (and their self-preserving recreations) lets the
    // probe reach the keccak call even when the contract also reads external state / blockhashes.
    const frontRegion = probeCtx.frontRegionInputs ?? [];
    const kSlots = abiFunction.blockLayout?.slots.filter((s) => s.kind === 'keccakSideCar') ?? [];
    const base = kSlots[0]?.offset ?? (1 + dataNftUtxos.length);
    const n = preimages.length;
    if (base !== 1 + dataNftUtxos.length + frontRegion.length) {
      throw new Error('keccak256 complex/nested-argument probe: the front-region inputs (external reads / '
        + 'blockhash oracles) do not fill the slots before the keccak side-car; cannot position the probe.');
    }
    const { CovenantTransactionBuilder } = await import('./CovenantTransactionBuilder.js');
    const vm = createVirtualMachineBch2026ForProvider(this.inner.provider);
    const lock = keccakComputeLockingBytecode(salt, true);
    let guard = 0;
    while (preimages.some((p) => p === null)) {
      if (guard++ > n) throw new Error('keccak256 stateful preimage extraction did not converge.');
      const probe = new CovenantTransactionBuilder({ provider: this.inner.provider });
      if (probeCtx.locktime) probe.setLocktime(probeCtx.locktime);
      probe.addInput(masterUtxo, masterUnlocker);
      dataNftUtxos.forEach((u, i) => probe.addInput(u, dataNftUnlockers[i]));
      frontRegion.forEach((u) => probe.addInputs([u])); // unlockable form: u already carries its unlocker
      const recreates: Output[] = [];
      for (let j = 0; j < n; j++) {
        const { unlocker, recreate } = buildKeccakComputeSidecar(preimages[j] ?? new Uint8Array(0), salt, scUtxos[j], true);
        probe.addInput(scUtxos[j], unlocker);
        recreates.push(recreate);
      }
      probe.addOutput({
        to: masterUnlocker.generateLockingBytecode(), amount: masterUtxo.satoshis, token: masterUtxo.token,
      });
      dataNftUtxos.forEach((u, i) => probe.addOutput({
        to: dataNftUnlockers[i].generateLockingBytecode(), amount: u.satoshis, token: u.token,
      }));
      frontRegion.forEach((u) => probe.addOutput(this._frontRegionRecreate(u))); // self-preserving recreate
      for (const rec of recreates) probe.addOutput({ ...rec, to: lock });
      const transaction = probe.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(probe.inputs);
      const trace = vm.debug({ inputIndex: 0, sourceOutputs, transaction }) as unknown[];
      const { callIndex, preimage } = extractKeccakPreimageFromTrace(trace, base, n);
      preimages[callIndex] = preimage;
    }
  }

  // Self-preserving recreation of a front-region co-spend (read-only data NFT or blockhash oracle): same locking,
  // amount, token - unchanged. Mirrors the StatefulTransactionBuilder's readOnly/blockhash output construction.
  private _frontRegionRecreate(u: UnlockableUtxo): Output {
    return { to: u.unlocker.generateLockingBytecode(), amount: u.satoshis, token: u.token };
  }

  // Stateful DYNAMIC keccak loop: determine the runtime iteration count N and each iteration's preimage by a
  // PROGRESSIVE VM probe, then build N trailing compute side-cars. Each probe co-spends k trailing side-cars
  // (the first k-1 resolved, the k-th a placeholder) at [blockSize, blockSize+k) and reads the master; the loop
  // aborts at the FIRST placeholder bind, whose preimage `extractKeccakPreimageFromTrace(base=blockSize)` yields.
  // Resolve one iteration per probe until the loop exits (the k-th placeholder is never read -> the last in-range
  // read is an already-resolved index) => N reached. MVP: no fixed front-region slots before the trailing region
  // (blockSize == 1 + dataNftCount) and no other trailing users (entries/containers/transfers).
  private async _resolveStatefulKeccakLoop(
    abiFunction: AbiFunction, masterUtxo: Utxo, masterUnlocker: Unlocker,
    dataNftUtxos: Utxo[], dataNftUnlockers: Unlocker[],
    frontRegionInputs: UnlockableUtxo[] = [], locktime = 0,
  ): Promise<{ sideCars: UnlockableUtxo[]; recreates: Output[] }> {
    const blockSize = abiFunction.blockLayout?.blockSize ?? 1;
    // The trailing side-cars start at blockSize = 1 + dataNftCount + front-region slots (read-only NFTs then
    // blockhash oracles). Position the front-region inputs + self-preserving recreations so the trailing region
    // lands at the right base even when the contract also reads external state / blockhashes.
    if (blockSize !== 1 + dataNftUtxos.length + frontRegionInputs.length) {
      throw new Error('stateful dynamic keccak256 loop: the front-region inputs (external reads / blockhash '
        + 'oracles) do not fill the slots before the trailing side-car region; cannot position the loop.');
    }
    const salt = hexToBin(this.categoryId).slice().reverse();
    const lock = keccakComputeLockingBytecode(salt, true);
    const scUtxos = (await this.inner.provider.getUtxosForLockingBytecode(lock))
      .filter((u) => u.token?.nft?.capability === 'mutable');
    const { CovenantTransactionBuilder } = await import('./CovenantTransactionBuilder.js');
    const vm = createVirtualMachineBch2026ForProvider(this.inner.provider);
    const MAX_ITERS = 64; // budget/standardness cap on runtime keccak side-cars per tx
    const preimages: Uint8Array[] = [];
    for (let k = 1; k <= MAX_ITERS + 1; k++) {
      if (scUtxos.length < k) {
        throw new Error(`stateful dynamic keccak256 loop needs >= ${k} compute side-car UTXOs at the branded `
          + `address; found ${scUtxos.length}. Deploy more mutable-NFT side-cars.`);
      }
      const probe = new CovenantTransactionBuilder({ provider: this.inner.provider });
      if (locktime) probe.setLocktime(locktime);
      probe.addInput(masterUtxo, masterUnlocker);
      dataNftUtxos.forEach((u, i) => probe.addInput(u, dataNftUnlockers[i]));
      frontRegionInputs.forEach((u) => probe.addInputs([u])); // unlockable form: u already carries its unlocker
      const recreates: Output[] = [];
      for (let j = 0; j < k; j++) {
        const { unlocker, recreate } = buildKeccakComputeSidecar(
          j < preimages.length ? preimages[j] : new Uint8Array(0), salt, scUtxos[j], true,
        );
        probe.addInput(scUtxos[j], unlocker);
        recreates.push(recreate);
      }
      probe.addOutput({
        to: masterUnlocker.generateLockingBytecode(), amount: masterUtxo.satoshis, token: masterUtxo.token,
      });
      dataNftUtxos.forEach((u, i) => probe.addOutput({
        to: dataNftUnlockers[i].generateLockingBytecode(), amount: u.satoshis, token: u.token,
      }));
      frontRegionInputs.forEach((u) => probe.addOutput(this._frontRegionRecreate(u))); // self-preserving recreate
      for (const rec of recreates) probe.addOutput({ ...rec, to: lock });
      const transaction = probe.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(probe.inputs);
      const trace = vm.debug({ inputIndex: 0, sourceOutputs, transaction }) as unknown[];
      const { callIndex, preimage } = extractKeccakPreimageFromTrace(trace, blockSize, k);
      if (callIndex === preimages.length) {
        preimages.push(preimage); // the k-th placeholder was read+aborted -> a new iteration
      } else {
        break; // the placeholder was never read -> the loop exited -> N = preimages.length
      }
      if (k > MAX_ITERS) throw new Error(`stateful dynamic keccak256 loop exceeds ${MAX_ITERS} iterations.`);
    }
    const sideCars: UnlockableUtxo[] = [];
    const recreates: Output[] = [];
    for (let j = 0; j < preimages.length; j++) {
      const { unlocker, recreate } = buildKeccakComputeSidecar(preimages[j], salt, scUtxos[j], true);
      sideCars.push({ ...scUtxos[j], unlocker });
      recreates.push(recreate);
    }
    return { sideCars, recreates };
  }

  // keccak256 compute side-cars for a CO-SPENT EXTERNAL contract B (transitive): both externalCall and
  // externalOutState run B's function, which reads a keccakSideCar slot in B's OWN block, so B's branded
  // side-car must be co-spent + recreated inside B's block. Mirrors _resolveKeccakComputeCoSpends but for B
  // (shared salt=0; direct-param preimages from the group's args, complex/nested via an isolated probe of B).
  // Returns B's side-car inputs (in keccak call order) + their recreations.
  private async _resolveExternalKeccakSideCars(
    bAbiFunc: AbiFunction | undefined, args: any[], externalCategoryId: string,
    bContract?: StatefulContract | null,
  ): Promise<{ inputs: UnlockableUtxo[]; recreates: Output[] }> {
    const params = bAbiFunc?.keccakPreimageParams ?? [];
    if (params.length === 0 || !bAbiFunc || !externalCategoryId) return { inputs: [], recreates: [] };
    // SHARED (salt=0) stateful side-car: the branded covenant brand-checks INPUT 0, which for a transitive
    // co-spend is the OUTER caller (not B), so branding can't apply. The shared covenant skips the brand check
    // (integrity is still enforced by B's baked covenant-hash check + preimage bind; only isolation is relaxed,
    // the same tradeoff as a shared stateless side-car). INPUTINDEX self-preservation is unaffected.
    const salt = new Uint8Array(32);
    const scUtxos = (await this.inner.provider.getUtxosForLockingBytecode(keccakComputeLockingBytecode(salt, true)))
      .filter((u) => u.token?.nft?.capability === 'mutable');
    const visible = bAbiFunc.inputs.filter((inp) => !inp.name.startsWith('__internal__'));
    // Direct-parameter preimages come straight from B's args; complex/nested args (recorded null by codegen) are
    // resolved by probing B in isolation (B at input 0 + all its data NFTs + placeholder side-cars) and reading
    // each unresolved call's argument off B's trace - the same mechanism as the direct stateful path, but on B.
    const preimages: (Uint8Array | null)[] = params.map(
      (p) => (p ? (args[visible.findIndex((x) => x.name === p)] instanceof Uint8Array
        ? args[visible.findIndex((x) => x.name === p)] : null) : null),
    );
    if (preimages.some((p) => p === null)) {
      if (!bContract) {
        throw new Error('transitive keccak256 with a complex/nested argument needs the external contract '
          + 'instance to probe; call through withExternalCall()/connect-time externals.');
      }
      const bProbeCtx = await this._externalKeccakProbeCtx(bContract, bAbiFunc, args, externalCategoryId);
      await this._extractStatefulKeccakPreimages(bAbiFunc, preimages, salt, scUtxos, bProbeCtx);
    }
    const inputs: UnlockableUtxo[] = [];
    const recreates: Output[] = [];
    for (let i = 0; i < params.length; i++) {
      const preimage = preimages[i];
      if (!(preimage instanceof Uint8Array)) throw new Error(`keccak256 preimage ${i} could not be resolved.`);
      if (!scUtxos[i]) {
        throw new Error(`keccak256 compute side-car UTXO not found for external call (call ${i}); deploy one `
          + "mutable-NFT side-car per keccak256 call at the callee's branded address.");
      }
      const { unlocker, recreate } = buildKeccakComputeSidecar(preimage, salt, scUtxos[i], true);
      inputs.push({ ...scUtxos[i], unlocker });
      recreates.push(recreate);
    }
    return { inputs, recreates };
  }

  // Build a probe context for the callee B: B's master (unlocked with B's function args) + ALL of B's data NFTs
  // (so B's keccakSideCar slot base = 1 + dataNftCount matches its block layout). Used to extract B's complex
  // keccak preimages by evaluating B in an isolated mini-tx (like the direct stateful complex path, but on B).
  private async _externalKeccakProbeCtx(
    bContract: StatefulContract, bAbiFunc: AbiFunction, args: any[], externalCategoryId: string,
  ): Promise<{ masterUtxo: Utxo; masterUnlocker: Unlocker; dataNftUtxos: Utxo[]; dataNftUnlockers: Unlocker[] }> {
    const bState = await bContract.getFullState();
    if (!bState.masterUtxo) throw new Error(`External contract master UTXO not found (category ${externalCategoryId}).`);
    const unlockFns = bContract.inner.unlock as Record<string, (...a: any[]) => Unlocker>;
    const masterUnlocker = unlockFns[bAbiFunc.name]?.(...(args ?? []));
    if (!masterUnlocker) throw new Error(`Cannot build an unlocker for external function ${bAbiFunc.name}.`);
    const dataNftUtxos = bState.dataNftUtxos;
    const dataNftUnlockers = dataNftUtxos.map(() => createDataNftUnlocker(bContract.inner, 0, externalCategoryId));
    return { masterUtxo: bState.masterUtxo, masterUnlocker, dataNftUtxos, dataNftUnlockers };
  }

  // Absolute input index of the first blockhashOracle slot + the slot count (master is input 0, so the slot
  // offset is already absolute). Used to fill __internal__blockhashInputIndex and bound the trace extraction.
  private blockhashSlotBase(abiFunction?: AbiFunction): { base: number; count: number } {
    const slots = abiFunction?.blockLayout?.slots.filter((s) => s.kind === 'blockhashOracle') ?? [];
    return { base: slots.length > 0 ? slots[0].offset : 0, count: slots.length };
  }

  private async _deriveCommitments(
    functionName: string,
    args: any[],
    requiredNftIndices: readonly number[],
    extraOutputs?: Array<{ to: string | Uint8Array; amount: bigint; token?: any }>,
    extraInputs?: Array<{ utxo: Utxo; unlocker: Unlocker }>,
    entryOutputCount: number = 0,
    childDataNftCount: number = 0,
    returnEventOutputCount: number = 0,
    // Count of satoshi/token container outputs that sit between the entries and the return-event/child geneses
    // (block-layout order: entry < satoshiContainer < tokenContainer < tcTransfer < returnEvent < deploy). The
    // child-genesis + return-event trace slots shift by this, else a token-container tcTransfer NFT output is
    // mistaken for the child's data NFT commitment.
    containerOutputCount: number = 0,
    trailingEntryOutputCount: number = 0,
    trailingEntryOutputOffset?: number,
  ): Promise<{
      state: Record<string, StateValueType> | undefined;
      entryCommitments: string[];
      childCommitments: string[];
      returnBlob?: Uint8Array;
    }> {
    const stateLayout = this.inner.stateLayout!;

    const abiFunction = this.inner.artifact.abi.find((f) => f.name === functionName);
    if (!abiFunction) throw new Error(`Unknown function: ${functionName}`);

    try {
      const onChainState = await this.getFullState();
      if (!onChainState.masterUtxo) {
        throw new Error('Master UTXO not found');
      }

      const masterUtxo = onChainState.masterUtxo;
      const allDataNftUtxos = onChainState.dataNftUtxos;

      // Filter data NFT UTXOs to only those required by this function
      const filteredDataNftUtxos = requiredNftIndices.map((idx) => allDataNftUtxos[idx]);
      if (filteredDataNftUtxos.some((u) => u === undefined)) {
        throw new Error(`Missing required data NFTs on-chain. Expected indices: [${requiredNftIndices.join(', ')}], but only ${allDataNftUtxos.length} data NFTs found.`);
      }

      // Build unlock functions for the probe transaction
      const masterUnlocker = (this.inner.unlock as any)[functionName](...args);
      const dataNftUnlockers = filteredDataNftUtxos.map(
        () => createDataNftUnlocker(this.inner, 0, this.categoryId),
      );

      // blockhash(n): resolve each reader's (n->hash) co-spend so the probe's VM run can read input[slot]. Param
      // reads use the call arg; computed reads are extracted from a probe (single source of truth). Placed right
      // after the data NFTs, matching the consecutive blockhashOracle block-layout slots.
      let bhProbeCoSpends: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; locktime: number }> = [];
      if (abiFunction.blockhashReads && abiFunction.blockhashReads.length > 0 && this.categoryId) {
        const { base, count } = this.blockhashSlotBase(abiFunction);
        bhProbeCoSpends = await this._resolveBlockhashCoSpends(
          abiFunction, args, base, count, masterUtxo, masterUnlocker, filteredDataNftUtxos,
        );
      }

      // keccak256 compute side-cars at the keccakSideCar slots (right after blockhash): the probe co-spends
      // them so the master's VM run can bind each preimage and read each result R_i from the recreation.
      let keccakProbeCoSpends: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; commitment: Uint8Array }> = [];
      if (abiFunction.keccakCompute && !abiFunction.keccakLoopReads && this.categoryId) {
        keccakProbeCoSpends = await this._resolveKeccakComputeCoSpends(abiFunction, args, {
          masterUtxo, masterUnlocker, dataNftUtxos: filteredDataNftUtxos, dataNftUnlockers,
        });
      }
      // ecrecover recovery A/B pairs at the ecrecoverSideCar slots (right after keccak): the probe co-spends them so
      // the master's VM run can bind each argBlob and read the recovered pubkey Q from B's recreation.
      let ecrecoverProbeCoSpends: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output }> = [];
      if (abiFunction.ecrecoverCompute && !abiFunction.ecrecoverLoopReads && this.categoryId) {
        ecrecoverProbeCoSpends = await this._resolveEcrecoverComputeCoSpends(abiFunction, args);
      }

      // Wrap the VM probe + extraction in AutoDerivationError so failures are
      // cleanly distinguishable from programming bugs or configuration errors.
      try {
        const { CovenantTransactionBuilder } = await import('./CovenantTransactionBuilder.js');

        // Probe with optional data NFT output commitment overrides (default: current).
        const runProbe = (dataNftOutputCommitments?: string[]): AuthenticationProgramStateCommon[] => {
          const probeBuilder = new CovenantTransactionBuilder({ provider: this.inner.provider });
          if (bhProbeCoSpends.length > 0) {
            probeBuilder.locktime = Math.max(...bhProbeCoSpends.map((c) => c.locktime)); // require(tx.time >= n)
          }

          // Input 0: master UTXO
          probeBuilder.addInput(masterUtxo, masterUnlocker);

          // Inputs 1..N: filtered data NFTs
          filteredDataNftUtxos.forEach((nftUtxo, i) => {
            probeBuilder.addInput(nftUtxo, dataNftUnlockers[i]);
          });

          // blockhash (n->hash) co-spends at the blockhashOracle slot (right after the data NFTs)
          for (const cs of bhProbeCoSpends) probeBuilder.addInput(cs.utxo, cs.unlocker);

          // keccak256 compute side-cars at the keccakSideCar slots (right after blockhash)
          for (const cs of keccakProbeCoSpends) probeBuilder.addInput(cs.utxo, cs.unlocker);

          // ecrecover recovery A/B pairs at the ecrecoverSideCar slots (right after keccak)
          for (const cs of ecrecoverProbeCoSpends) probeBuilder.addInput(cs.utxo, cs.unlocker);

          // Extra inputs (e.g. funding UTXO for deploy genesis)
          if (extraInputs) {
            for (const { utxo, unlocker } of extraInputs) {
              probeBuilder.addInput(utxo, unlocker);
            }
          }

          // Output 0: master UTXO preserved
          probeBuilder.addOutput({
            to: masterUnlocker.generateLockingBytecode(),
            amount: masterUtxo.satoshis,
            token: masterUtxo.token,
          });

          // Outputs 1..N: filtered data NFTs (current commitments, or supplied overrides)
          for (let i = 0; i < filteredDataNftUtxos.length; i++) {
            const nftUtxo = filteredDataNftUtxos[i];
            probeBuilder.addOutput({
              to: dataNftUnlockers[i].generateLockingBytecode(),
              amount: nftUtxo.satoshis,
              token: {
                amount: nftUtxo.token?.amount ?? 0n,
                category: this.categoryId,
                nft: {
                  capability: nftUtxo.token?.nft?.capability ?? 'mutable',
                  commitment: dataNftOutputCommitments?.[i] ?? nftUtxo.token?.nft?.commitment ?? '',
                },
              },
            });
          }

          // blockhash recreate outputs (self-preserving, at the matching slot index)
          for (const cs of bhProbeCoSpends) probeBuilder.addOutput(cs.recreate);

          // keccak256 compute side-car recreate outputs (carry each computed result R_i, matching slot order)
          for (const cs of keccakProbeCoSpends) probeBuilder.addOutput(cs.recreate);

          // ecrecover recovery-pair recreate outputs (A commits H_A, B commits Q; matching slot order)
          for (const cs of ecrecoverProbeCoSpends) probeBuilder.addOutput(cs.recreate);

          // Add extra outputs (entry NFTs and child contract outputs)
          if (extraOutputs) {
            for (const output of extraOutputs) {
              probeBuilder.addOutput(output);
            }
          }

          const transaction = probeBuilder.buildLibauthTransaction();
          const sourceOutputs = generateLibauthSourceOutputs(probeBuilder.inputs);
          return evaluateProbeTrace(this.inner.provider, { inputIndex: 0, sourceOutputs, transaction });
        };

        // Pass 1: derive data NFT state. Placeholder outputs fail the data NFT verify, but
        // the trace captures the expected values before the failing OP_EQUALVERIFY.
        const fullTrace = runProbe();
        const stateOutputRange = { min: 1, max: 1 + requiredNftIndices.length };
        let commitmentHexes = extractCommitmentsFromTrace(fullTrace, requiredNftIndices.length, stateOutputRange);

        // Pass 2: entry verifies run after the data NFT verify, so re-run with derived data
        // NFT commitments to get past it and reach the entry verifies.
        let entryCommitments: string[] = [];
        if (entryOutputCount > 0) {
          const entryBase = 1 + requiredNftIndices.length + bhProbeCoSpends.length
            + keccakProbeCoSpends.length + ecrecoverProbeCoSpends.length;
          const entryTrace = commitmentHexes ? runProbe(commitmentHexes) : fullTrace;
          entryCommitments = extractCommitmentsFromTrace(
            entryTrace, entryOutputCount, { min: entryBase, max: entryBase + entryOutputCount },
          ) ?? [];
          // Feed fixed entry commitments back into the probe so verification can advance to C2 INSERT nodes,
          // which live after the complete function block rather than beside their predecessor slot.
          if (extraOutputs) {
            for (let i = 0; i < entryCommitments.length; i++) {
              const out = extraOutputs[i];
              if (out?.token?.nft) out.token.nft.commitment = entryCommitments[i];
            }
          }
        }
        if (trailingEntryOutputCount > 0 && extraOutputs) {
          const extraBase = 1 + requiredNftIndices.length + bhProbeCoSpends.length
            + keccakProbeCoSpends.length + ecrecoverProbeCoSpends.length;
          const trailingBase = extraBase + (trailingEntryOutputOffset
            ?? (extraOutputs.length - trailingEntryOutputCount));
          const trailingTrace = runProbe(commitmentHexes);
          const trailing = extractCommitmentsFromTrace(
            trailingTrace, trailingEntryOutputCount,
            { min: trailingBase, max: trailingBase + trailingEntryOutputCount },
          ) ?? [];
          entryCommitments.push(...trailing);
          for (let i = 0; i < trailing.length; i++) {
            const out = extraOutputs[(trailingEntryOutputOffset
              ?? (extraOutputs.length - trailingEntryOutputCount)) + i];
            if (out?.token?.nft) out.token.nft.commitment = trailing[i];
          }
        }
        // C2 upserts execute inline before the epilogue's state checks. Once their fixed and trailing outputs are
        // populated, probe again to reach and derive state commitments (the legacy entry model happened to verify
        // entries after state and therefore never needed this convergence pass).
        if (!commitmentHexes && entryOutputCount > 0) {
          commitmentHexes = extractCommitmentsFromTrace(
            runProbe(), requiredNftIndices.length, stateOutputRange,
          );
        }

        // Deploy-fold: the deploy covenant verifies the child's genesis at outputs after the factory state
        // and entries; with a same-tx `child.foo(args)` folded in, that genesis is the child's post-call state.
        // Re-run with the derived factory state so the trace reaches the child genesis verify, then read the
        // expected commitment (captured before the verify) for each child data NFT. Falls back to the static
        // initial state for a plain deploy at default. A deploy that writes mapping entries aborts at the entry
        // verify before the child verify (folded deploy + entries unsupported for now).
        let childCommitments: string[] = [];
        const extraBase = 1 + requiredNftIndices.length + bhProbeCoSpends.length
          + keccakProbeCoSpends.length + ecrecoverProbeCoSpends.length;
        if (childDataNftCount > 0 && commitmentHexes && extraOutputs) {
          // A returning deploy function materializes its return-event output between the entries and the child
          // genesis (block-layout order: entry < returnEvent < deploy), so the child outputs shift by its count.
          const childBase = extraBase + entryOutputCount + containerOutputCount + returnEventOutputCount
            + 1 + trailingEntryOutputCount; // + child master NFT + C2 NEW nodes interleaved after it
          const childOutStart = entryOutputCount + containerOutputCount + returnEventOutputCount
            + 1 + trailingEntryOutputCount; // child data NFT 0 in extraOutputs
          const childRange = { min: childBase, max: childBase + childDataNftCount };
          // The covenant verifies the child data NFTs in order and aborts at the first mismatch. A plain
          // deploy lands at defaults (probe outputs match -> one pass captures all), but a folded multi-NFT
          // child's NFT 0 mismatches -> capture it, feed it back into the probe output, and re-run to reach
          // the next NFT. Mutating extraOutputs is safe: these are probe-only (the final tx uses the result).
          for (let pass = 0; pass < childDataNftCount; pass++) {
            childCommitments = extractCommitmentsFromTrace(runProbe(commitmentHexes), childDataNftCount, childRange)
              ?? [];
            if (childCommitments.length >= childDataNftCount) break;
            for (let i = 0; i < childCommitments.length; i++) {
              const out = extraOutputs[childOutStart + i];
              if (out?.token?.nft) out.token.nft.commitment = childCommitments[i];
            }
          }
        }

        // Returning deploy function: extract the entry function's own return value (the B8 return-event blob),
        // read at the return-event output index in the same trace that now clears the child genesis verify. The
        // covenant compares the placeholder commitment (fails), but the expected __returnBlob is captured first.
        let returnBlob: Uint8Array | undefined;
        if (returnEventOutputCount > 0 && commitmentHexes) {
          // The return-event sits after entries and containers.
          const returnIdx = extraBase + entryOutputCount + containerOutputCount;
          const blobs = extractCommitmentsFromTrace(
            runProbe(commitmentHexes), 1, { min: returnIdx, max: returnIdx + 1 },
          );
          if (blobs && blobs.length > 0) returnBlob = hexToBin(blobs[0]);
        }

        if (!commitmentHexes) {
          // No OP_OUTPUTTOKENCOMMITMENT patterns found - this is a read-only function.
          // Return the current on-chain state (unchanged) so the builder outputs current commitments.
          const currentState: Record<string, StateValueType> = {};
          for (let i = 0; i < requiredNftIndices.length; i++) {
            const nftIdx = requiredNftIndices[i];
            const nftUtxo = filteredDataNftUtxos[i];
            if (nftUtxo?.token?.nft?.commitment) {
              const parsed = parsePushdataCommitment(nftUtxo.token.nft.commitment, stateLayout, nftIdx);
              for (const [key, value] of Object.entries(parsed)) {
                currentState[key] = value as StateValueType;
              }
            }
          }
          return { state: currentState, entryCommitments, childCommitments, returnBlob };
        }

        return {
          state: commitmentsToState(commitmentHexes, stateLayout, [...requiredNftIndices]),
          entryCommitments,
          childCommitments,
          returnBlob,
        };
      } catch (e) {
        if (e instanceof AutoDerivationError) throw e;
        throw new AutoDerivationError(
          `State derivation failed for ${functionName}: ${e instanceof Error ? e.message : String(e)}`,
          e instanceof Error ? e : undefined,
        );
      }
    } catch (e) {
      // Only swallow AutoDerivationError - let all other errors propagate.
      if (e instanceof AutoDerivationError) {
        return { state: undefined, entryCommitments: [], childCommitments: [] };
      }
      throw e;
    }
  }

  /**
   * Derive full cross-contract transaction state via iterative VM evaluation.
   *
   * Phase 1: For each external call group, build a probe transaction and run
   * the VM on B's master input to extract B's expected commitments and return blob.
   *
   * Phase 2: With B's state and return events applied, build a second probe
   * and run the VM on A's master input to extract A's expected commitments.
   */
  private async _deriveFullTransactionState(
    stb: StatefulTransactionBuilder,
    requiredNftIndices: readonly number[],
    externalCallUtxoGroups: ExternalCallUtxoGroup[],
    externalCalls: readonly { hasReturnValues?: boolean; requiredDataNftIndices: number[] }[],
    entryAccesses?: readonly EntryAccessAbi[],
    emitInfos?: readonly EmitAbi[],
    transferCount?: number,
    tokenContainerTransferOps?: Array<{ type: 'transfer' | 'transferNft'; categoryId: string }>,
    delegatecallInputIndex?: number,
    externalOutStateUtxoGroups?: ExternalCallUtxoGroup[],
  ): Promise<{
      state: Record<string, StateValueType> | undefined;
      vmErrored: boolean;
      derivationError?: Error;
      derivedTransfers?: Array<{ lockingBytecode: Uint8Array; amount: bigint }>;
      derivedTokenContainerTransfers?: Array<{
        categoryId: string; lockingBytecode: Uint8Array; amount: bigint;
      }>;
      derivedTokenContainerTransferNfts?: Array<{
        categoryId: string; lockingBytecode: Uint8Array; commitment: Uint8Array; capability: string;
      }>;
    }> {
    const stateLayout = this.inner.stateLayout!;

    try {
      // Wrap the entire derivation body so any error becomes AutoDerivationError.
      // This cleanly separates derivation failures from programming bugs.
      try {

        // Pre-populate placeholder return event outputs so the probe transaction has
        // the correct output count during Phase 1. B's covenant script verifies the
        // return event commitment at a specific output index - without a placeholder,
        // the output doesn't exist and OP_OUTPUTTOKENCOMMITMENT returns empty bytes,
        // causing OP_SPLIT to fail on empty data.
        for (let groupIdx = 0; groupIdx < externalCallUtxoGroups.length; groupIdx++) {
          const ec = externalCalls[groupIdx];
          if (ec.hasReturnValues) {
            const group = externalCallUtxoGroups[groupIdx];
            stb.setReturnEventOutput(group.categoryId, new Uint8Array([0]));
          }
        }

        // Phase 1: Derive each B's state + return blob
        // Process groups in reverse order so that transitive dependencies (e.g., C in
        // A->B->C chains) are resolved before their callers (B). Transitive groups are
        // appended after direct groups, so reverse order naturally resolves leaf
        // dependencies first, making their return event commitments available when
        // their parent groups are processed.
        for (let groupIdx = externalCallUtxoGroups.length - 1; groupIdx >= 0; groupIdx--) {
          const group = externalCallUtxoGroups[groupIdx];
          const ec = externalCalls[groupIdx];

          // Build probe with current (possibly placeholder) state
          const probeBuilder = stb.build();
          const transaction = probeBuilder.buildLibauthTransaction();
          const sourceOutputs = generateLibauthSourceOutputs(probeBuilder.inputs);

          // Get B's master input index
          const bMasterIdx = stb.getExternalCallMasterInputIndex(groupIdx);

          // Patch B's C2 entry co-spend unlockers with B's REAL master input index (docs/deferrals.md #1). The entry
          // covenant's write path (flag=1) verifies a minting NFT at masterInputIndex = B's master, but block-build
          // time used a block-relative placeholder (B's master index isn't known until the tx layout is). A funder
          // placeholder (absent key, no token) has no covenant to fix. The probe above runs B's master covenant only,
          // so the placeholder does not affect the entry-commitment extraction below; the final build uses this patch.
          if (group.blockLayout && group.blockInputs) {
            const bScPatch = group.externalContract as StatefulContract | null;
            const bAbiPatch = group.compilerRoute?.abiFunction
              ?? bScPatch?.inner.artifact.abi?.find(
                (f: { name: string }) => f.name === group.functionName,
              ) as AbiFunction | undefined;
            for (let si = 0; si < group.blockLayout.slots.length; si++) {
              const s = group.blockLayout.slots[si];
              const input = group.blockInputs[si];
              if (s?.kind !== 'entry' || !bScPatch || !input?.token?.nft) continue;
              const acc = bAbiPatch?.entryAccesses?.[s.slotIndex ?? 0];
              if (!acc) continue;
              input.unlocker = createEntryNftUnlocker(bScPatch.inner, bMasterIdx, group.categoryId, acc.collection);
            }
            // Cross-contract callee LOOP entries (trailing, no block slot): patch their write-mode unlockers with B's
            // real master input index too (the entry covenant's flag=1 path verifies the minting master there).
            if (group.entryLoopStart !== undefined && group.entryLoopCollection && bScPatch) {
              for (let j = 0; j < (group.entryLoopCommitments?.length ?? 0); j++) {
                const input = group.blockInputs[group.entryLoopStart + j];
                if (input?.token?.nft) {
                  input.unlocker = createEntryNftUnlocker(
                    bScPatch.inner, bMasterIdx, group.categoryId, group.entryLoopCollection,
                  );
                }
              }
            }
          }

          // Run VM on B's master input
          const vm = createVirtualMachineBch2026ForProvider(this.inner.provider);
          const fullTrace = vm.debug({
            inputIndex: bMasterIdx,
            sourceOutputs,
            transaction,
          }) as AuthenticationProgramStateCommon[];

          // B verifies its data NFT commitments; the return event is extracted separately below.
          const bRequiredNftCount = group.requiredDataNftIndices.length;

          // Filter by output index range: B's data NFTs start after B's master output. Best-effort: the
          // probe trace may abort at the return-event check before B reaches the data NFT preservation, so
          // this can legitimately come back empty - that must NOT skip the return-event extraction below.
          const bOutputBase = stb.getExternalCallOutputBase(groupIdx);
          const bDataOutputRange = { min: bOutputBase + 1, max: bOutputBase + 1 + bRequiredNftCount };
          const commitments = bRequiredNftCount > 0
            ? extractCommitmentsFromTrace(fullTrace, bRequiredNftCount, bDataOutputRange)
            : undefined;
          if (!commitments && bRequiredNftCount > 0 && !ec.hasReturnValues
            && !group.blockLayout?.slots.some((slot) => slot.kind === 'entry')) continue; // nothing to do

          // B's data NFT commitments
          if (commitments && commitments.length > 0) {
            const bCommitments = commitments.slice(0, bRequiredNftCount);
            const bState = commitmentsToState(bCommitments, group.stateLayout, group.requiredDataNftIndices);
            for (const [name, value] of Object.entries(bState)) {
              stb.setExternalCallState(group.categoryId, name, value);
            }
          }

          // B's C2 sorted-entry outputs (docs/deferrals.md #1): a cross-contract callee WRITE to a sorted mapping
          // mints an entry output B's covenant then verifies. Extract each written entry's commitment from B's trace
          // at its block-slot output index (bOutputBase + si) and hand it to the STB, which mints it at that slot.
          if (group.blockLayout && group.blockInputs) {
            const bEntryMap = group.compilerRoute
              ? new Map<number, string>()
              : extractCommitmentMapFromTrace(fullTrace,
                { min: bOutputBase, max: bOutputBase + group.blockInputs.length });
            let entryTrace = fullTrace;
            const entrySlotCount = group.blockLayout.slots.filter((slot) => slot.kind === 'entry').length;
            // A covenant stops at the first mismatching entry output, so one
            // trace can reveal only the first pending commitment. Feed each
            // newly revealed commitment back into the probe and continue
            // until every reachable fixed entry slot has been materialized.
            for (let pass = 0; group.compilerRoute && pass <= entrySlotCount; pass++) {
              const revealed = extractCommitmentMapFromTrace(entryTrace,
                { min: bOutputBase, max: bOutputBase + group.blockInputs.length });
              let progressed = false;
              for (const [outputIndex, commitment] of revealed) {
                if (bEntryMap.has(outputIndex)) continue;
                bEntryMap.set(outputIndex, commitment);
                const blockSlot = outputIndex - bOutputBase;
                if (group.blockLayout.slots[blockSlot]?.kind === 'entry') {
                  stb.setExternalCallEntryOutput(group.categoryId, blockSlot, commitment);
                  progressed = true;
                }
              }
              if (!progressed || pass === entrySlotCount) break;
              const nextProbe = stb.build();
              entryTrace = createVirtualMachineBch2026ForProvider(this.inner.provider).debug({
                inputIndex: bMasterIdx,
                sourceOutputs: generateLibauthSourceOutputs(nextProbe.inputs),
                transaction: nextProbe.buildLibauthTransaction(),
              }) as AuthenticationProgramStateCommon[];
            }
            const bBlockSize = group.blockLayout.blockSize ?? group.blockInputs.length;
            const insertHandles: Array<{ handle: number; newIdx: number }> = [];
            let insertCount = 0;
            for (let si = 0; si < group.blockLayout.slots.length; si++) {
              if (group.blockLayout.slots[si]?.kind !== 'entry') continue;
              const commit = bEntryMap.get(bOutputBase + si);
              if (commit === undefined) continue;
              stb.setExternalCallEntryOutput(group.categoryId, si, commit);
              // INSERT vs UPDATE: an UPDATE output preserves the co-spent entry's nextKey; an INSERT co-spends the
              // PREDECESSOR and its P' output re-points nextKey (bytes 32..64) to H(k), so out.next != in.next. For an
              // INSERT, mint a placeholder NEW at the entry address so output[bMasterIdx+blockSize+j] exists (else B's
              // OP_OUTPUTBYTECODE for the NEW aborts before revealing its commitment); the 2nd pass fills the real one.
              const input = group.blockInputs[si];
              const inCommit = input?.token?.nft?.commitment;
              if (inCommit && inCommit.length >= 128 && commit.length >= 128
                && inCommit.slice(64, 128) !== commit.slice(64, 128)) {
                const handle = stb.addExternalCallEntryInsert(
                  group.categoryId, input.unlocker.generateLockingBytecode(), commit,
                );
                insertHandles.push({ handle, newIdx: bMasterIdx + bBlockSize + insertCount });
                insertCount++;
              }
            }
            // Second pass for INSERTs: with P' + placeholder NEW(s) now present, re-run B's VM so it reaches each NEW's
            // OP_OUTPUTTOKENCOMMITMENT and pushes the real NEW commitment; extract it and replace the placeholder.
            if (insertHandles.length > 0) {
              const pb2 = stb.build();
              const map2 = extractCommitmentMapFromTrace(createVirtualMachineBch2026ForProvider(this.inner.provider).debug({
                inputIndex: bMasterIdx, sourceOutputs: generateLibauthSourceOutputs(pb2.inputs),
                transaction: pb2.buildLibauthTransaction(),
              }) as AuthenticationProgramStateCommon[]);
              for (const { handle, newIdx } of insertHandles) {
                const newCommit = map2.get(newIdx);
                if (newCommit !== undefined) stb.setExternalCallEntryInsertCommitment(handle, newCommit);
                else stb.removeExternalCallEntryInsert(handle);
              }
            }
          }

          // Return event blob: extract from the dedicated return-event section, whose index is fixed at the
          // tx end and therefore order-independent. The inline data-NFT range only coincides with the return
          // event when the returning call is the LAST external call; a call following it shifts the return
          // event out of that range, so the extraction MUST target the return-event section directly. The
          // returning call's covenant pushes the expected return blob before its OP_EQUALVERIFY against the
          // (placeholder) return-event output, so the value is in the trace even when the probe aborts there.
          // Re-run B's VM with any data NFT commitments now set so B's script reliably reaches that point.
          // The range covers all return events (chained A->B->C give each group a distinct index); B's script
          // verifies only its own, so exactly one matches.
          if (ec.hasReturnValues) {
            const probeBuilderRet = stb.build();
            const transactionRet = probeBuilderRet.buildLibauthTransaction();
            const sourceOutputsRet = generateLibauthSourceOutputs(probeBuilderRet.inputs);
            const vmRet = createVirtualMachineBch2026ForProvider(this.inner.provider);
            const fullTraceRet = vmRet.debug({
              inputIndex: bMasterIdx,
              sourceOutputs: sourceOutputsRet,
              transaction: transactionRet,
            }) as AuthenticationProgramStateCommon[];

            // X13: in the in-block regime this group's return event sits at its own block slot, so scan exactly
            // that index; otherwise scan the appended tail band shared by every returning callee.
            const inBlockIdx = stb.getExternalCallReturnEventOutputIndex(groupIdx);
            const returnEventOutputBase = inBlockIdx >= 0 ? inBlockIdx : stb.getReturnEventOutputBase();
            const totalReturnEvents = inBlockIdx >= 0
              ? 1 : externalCalls.filter((e) => e.hasReturnValues).length;
            const returnOutputRange = {
              min: returnEventOutputBase,
              max: returnEventOutputBase + totalReturnEvents,
            };
            const returnCommitments = extractCommitmentsFromTrace(fullTraceRet, 1, returnOutputRange);
            if (returnCommitments && returnCommitments.length > 0) {
              stb.setReturnEventOutput(group.categoryId, hexToBin(returnCommitments[0]));
            }
          }

          // Extract B's event commitments (if B's function emits events).
          // This requires a second VM run after B's data NFT commitments are set,
          // because B's script verifies data NFT commitments before event commitments.
          // The first run extracts data NFT commitments; with those in place, the
          // second run gets further in B's script to extract event commitments.
          if (group.blockLayout && group.externalContract) {
            const bArt = group.externalContract.inner?.artifact ?? group.externalContract.artifact;
            const bAbiFunc = bArt?.abi?.find((f: any) => f.name === group.functionName);
            const bEmits: Array<{ eventSignature: string; emitIndex: number }> = bAbiFunc?.emits ?? [];

            if (bEmits.length > 0 && bArt?.events) {
            // Find the event slot positions in B's block layout
              const eventSlots = group.blockLayout.slots.filter((s) => s.kind === 'event');
              if (eventSlots.length > 0) {
              // Re-run VM on B after data NFT commitments are set, so B's script
              // gets past the data NFT verification and reaches event verification.
                const probeBuilder2 = stb.build();
                const transaction2 = probeBuilder2.buildLibauthTransaction();
                const sourceOutputs2 = generateLibauthSourceOutputs(probeBuilder2.inputs);
                const vm2 = createVirtualMachineBch2026ForProvider(this.inner.provider);
                const fullTrace2 = vm2.debug({
                  inputIndex: bMasterIdx,
                  sourceOutputs: sourceOutputs2,
                  transaction: transaction2,
                }) as AuthenticationProgramStateCommon[];

                const eventOutputStart = bOutputBase + eventSlots[0].offset;
                const eventOutputRange = { min: eventOutputStart, max: eventOutputStart + eventSlots.length };
                const eventCommits = extractCommitmentsFromTrace(fullTrace2, eventSlots.length, eventOutputRange);

                if (eventCommits && eventCommits.length > 0) {
                  const eventOutputs: Array<{
                    eventSignature: string; commitment: string; lockingBytecode: Uint8Array;
                  }> = [];
                  for (let ei = 0; ei < Math.min(eventCommits.length, bEmits.length); ei++) {
                    const emitInfo = bEmits[ei];
                    const eventNameHash = computeEventNameHash(emitInfo.eventSignature);
                    const covenantScript = buildEventNftCovenantScript(
                      hexToBin(group.categoryId), eventNameHash,
                    );
                    const lockingBytecode = scriptToLockingBytecode(
                      covenantScript, group.externalContract.inner?.addressType ?? 'p2sh32',
                    );
                    eventOutputs.push({
                      eventSignature: emitInfo.eventSignature,
                      commitment: eventCommits[ei],
                      lockingBytecode,
                    });
                  }
                  group.eventOutputs = eventOutputs;
                }
              }
            }
          }
        }

        // Phase 1b: Derive each outState group's state (same pattern as external call groups)
        if (externalOutStateUtxoGroups && externalOutStateUtxoGroups.length > 0) {
          for (let groupIdx = 0; groupIdx < externalOutStateUtxoGroups.length; groupIdx++) {
            const group = externalOutStateUtxoGroups[groupIdx];

            const probeBuilder = stb.build();
            const transaction = probeBuilder.buildLibauthTransaction();
            const sourceOutputs = generateLibauthSourceOutputs(probeBuilder.inputs);

            const bMasterIdx = stb.getExternalOutStateMasterInputIndex(groupIdx);
            const vm = createVirtualMachineBch2026ForProvider(this.inner.provider);
            const fullTrace = vm.debug({
              inputIndex: bMasterIdx,
              sourceOutputs,
              transaction,
            }) as AuthenticationProgramStateCommon[];

            const bRequiredNftCount = group.requiredDataNftIndices.length;
            const bOutputBase = stb.getExternalOutStateOutputBase(groupIdx);
            const bDataOutputRange = { min: bOutputBase + 1, max: bOutputBase + 1 + bRequiredNftCount };
            const commitments = extractCommitmentsFromTrace(fullTrace, bRequiredNftCount, bDataOutputRange);
            if (commitments) {
              const bState = commitmentsToState(commitments, group.stateLayout, group.requiredDataNftIndices);
              for (const [name, value] of Object.entries(bState)) {
                stb.setExternalCallState(group.categoryId, name, value);
              }
            }
          }
        }

        // Phase 1c: Derive low-level call target state
        // Same pattern as external call groups: run the VM on the target's master,
        // extract expected commitments from the trace, and apply as state updates.
        const llcGroups = stb.getLowLevelCallUtxoGroups();
        if (llcGroups.length > 0) {
          for (let groupIdx = 0; groupIdx < llcGroups.length; groupIdx++) {
            const group = llcGroups[groupIdx];
            if (group.callMode === 'staticcall' || group.callMode === 'delegatecall') continue;

            const probeBuilder = stb.build();
            const transaction = probeBuilder.buildLibauthTransaction();
            const sourceOutputs = generateLibauthSourceOutputs(probeBuilder.inputs);

            const bMasterIdx = stb.getLowLevelCallMasterInputIndex(groupIdx);
            const vm = createVirtualMachineBch2026ForProvider(this.inner.provider);
            const fullTrace = vm.debug({
              inputIndex: bMasterIdx,
              sourceOutputs,
              transaction,
            }) as AuthenticationProgramStateCommon[];

            const bRequiredNftCount = group.requiredDataNftIndices.length;
            // Compute output base: find the target's master output index by scanning
            // the built outputs for matching category + minting capability
            let bOutputBase = -1;
            for (let oi = 0; oi < probeBuilder.outputs.length; oi++) {
              const out = probeBuilder.outputs[oi];
              if (out.token?.category === group.categoryId
              && out.token?.nft?.capability === 'minting') {
                bOutputBase = oi;
                break;
              }
            }
            if (bOutputBase < 0) continue;

            const bDataOutputRange = { min: bOutputBase + 1, max: bOutputBase + 1 + bRequiredNftCount };
            const commitments = extractCommitmentsFromTrace(fullTrace, bRequiredNftCount, bDataOutputRange);
            if (commitments) {
              const bState = commitmentsToState(commitments, group.stateLayout, group.requiredDataNftIndices);
              for (const [name, value] of Object.entries(bState)) {
                stb.setExternalCallState(group.categoryId, name, value);
              }
            }
          }
        }

        // Pre-populate event placeholders so the probe transaction has event outputs
        if (emitInfos && emitInfos.length > 0) {
          for (const emitInfo of emitInfos) {
            stb.addEventPlaceholder(emitInfo.eventSignature, emitInfo.emitIndex);
          }
        }

        // Pre-populate transfer placeholders so the probe transaction has correct output count.
        const dummyLbc = encodeLockingBytecodeP2pkh(new Uint8Array(20));
        const satoshiTransferCount = transferCount ?? 0;
        if (satoshiTransferCount > 0) {
          for (let i = 0; i < satoshiTransferCount; i++) stb.addTransfer(dummyLbc, 1000n);
        }
        const ftOps = tokenContainerTransferOps?.filter((o) => o.type === 'transfer') ?? [];
        const nftOps = tokenContainerTransferOps?.filter((o) => o.type === 'transferNft') ?? [];
        for (const op of ftOps) stb.addTokenContainerTransfer(op.categoryId, dummyLbc, 1n);
        for (const op of nftOps) stb.addTokenContainerTransferNft(op.categoryId, dummyLbc, new Uint8Array(0), 'none');

        // Track derived transfers for return
        let derivedTransfers: Array<{ lockingBytecode: Uint8Array; amount: bigint }> | undefined;
        let derivedFtTransfers: Array<{
          categoryId: string; lockingBytecode: Uint8Array; amount: bigint;
        }> | undefined;
        let derivedNftTransfers: Array<{
          categoryId: string; lockingBytecode: Uint8Array; commitment: Uint8Array; capability: string;
        }> | undefined;
        // Track whether amounts were successfully extracted from the VM trace
        // (avoids false positives when real transfer amounts happen to match placeholder values)
        let satoshiAmountsFullyDerived = false;
        let ftAmountsFullyDerived = false;

        // Phase 2: Derive A's state + entries + events (iterative)
        // The VM stops at the first OP_EQUALVERIFY failure. Each iteration captures
        // commitments up to the first mismatch. After applying derived values and
        // re-probing, the VM proceeds further. Verification order: state -> entries -> events.
        const entryCount = entryAccesses?.length ?? 0;
        const eventCount = emitInfos?.length ?? 0;
        let derivedAState: Record<string, StateValueType> | undefined;
        // Iteratively probe: each iteration extracts ALL commitment verifications from
        // the trace. The VM stops at the first mismatched EQUALVERIFY, so we may only
        // get partial results. Apply what we find, re-probe, repeat until convergence.
        //
        // For loops: the LAST commitment for a given state slot is the final value
        // (earlier ones are intermediate loop iterations).
        // For chained partial struct writes: multiple commitments per entry slot.
        // The verification order in bytecode is: state -> entries -> events.
        const stateCount = requiredNftIndices.length;
        let prevConvergenceKey = '';
        let derivedStateCount = 0; // how many state commitments have been applied
        // Loop mapping writes derive one entry commitment per probe (the VM halts at the first mismatch), so a
        // loop of N iterations needs ~N+2 probes. Give the convergence loop headroom past the default.
        const maxIterations = stb.getLoopEntryVars().length > 0
          ? Math.max(this.maxDerivationIterations, 64)
          : this.maxDerivationIterations;
        let lastTrace: AuthenticationProgramStateCommon[] | undefined;
        const seenConvergenceKeys = new Set<string>();
        // Sorted value-upsert collections already probed for trailing NEW outputs. Once probed empty (an UPDATE
        // mints no new node), we must not re-seed a '00' placeholder or the loop count oscillates 0<->1 forever.
        const probedSortedLoop = new Set<string>();

        for (let iter = 0; iter < maxIterations; iter++) {
          const probeBuilder2 = stb.build();
          const transaction2 = probeBuilder2.buildLibauthTransaction();
          const sourceOutputs2 = generateLibauthSourceOutputs(probeBuilder2.inputs);

          const fullTrace2 = evaluateProbeTrace(this.inner.provider, {
            inputIndex: delegatecallInputIndex ?? 0,
            sourceOutputs: sourceOutputs2,
            transaction: transaction2,
          });
          lastTrace = fullTrace2;

          // Extract commitments using output-index filtering to avoid capturing
          // container identity checks, minting NFT uniqueness, or other non-commitment patterns.
          let commitmentProgress = 0;

          // State data NFTs: output indices [1, 1 + stateCount)
          const stateOutputRange = { min: 1, max: 1 + stateCount };
          const stateCommits = extractCommitmentsFromTrace(fullTrace2, stateCount, stateOutputRange) ?? [];
          commitmentProgress += stateCommits.length;
          let latestEntryCommits: string[] = [];
          let latestEventCommits: string[] = [];
          let latestLoopEntryCommits: string[] = [];

          // Apply state commitments - always update when commitments are available,
          // even if the count hasn't increased (values may have changed between iterations).
          const newStateCommitCount = Math.min(stateCommits.length, stateCount);
          if (newStateCommitCount > 0) {
            const partialState = commitmentsToState(stateCommits.slice(0, newStateCommitCount), stateLayout,
              requiredNftIndices.slice(0, newStateCommitCount));
            if (!derivedAState) derivedAState = {};
            for (const [name, value] of Object.entries(partialState)) {
              derivedAState[name] = value;
              stb.setState(name, value);
            }
            derivedStateCount = Math.max(derivedStateCount, newStateCommitCount);
          }

          // Entry commitments: output indices [entryBase, entryBase + entryCount). Map each verified
          // commitment to ITS slot by output index (slotOrder[outputIndex - base]) rather than positionally:
          // the covenant checks written entries in write order and skips absent read-only slots, so a
          // positional (i-th commitment -> slot i) assignment misaligns when writes are out of slot order.
          if (entryCount > 0) {
            const entryOutputBase = stb.getEntryOutputBase();
            const entryOutputRange = { min: entryOutputBase, max: entryOutputBase + entryCount };
            const commitMap = extractCommitmentMapFromTrace(fullTrace2, entryOutputRange);
            const slotOrder = stb.getEntryOutputSlotOrder();
            const orderedCommits: string[] = [];
            for (const [outIdx, commit] of commitMap) {
              const slot = slotOrder[outIdx - entryOutputBase];
              // Pinned slots (a sorted-insert P', known exactly) must not be re-derived - the covenant reads the
              // predecessor's input commitment too, which the extraction would otherwise oscillate onto.
              // A native C2 node always contains slot32||next32. Ignore shorter OTC observations: they belong to
              // unrelated empty/default comparisons at the same output index and otherwise oscillate a valid
              // derived target back to the legacy empty commitment.
              const slotCollection = slot === undefined ? undefined
                : stateLayout.collections?.find((c) => c.name === entryAccesses?.[slot]?.collection);
              const structurallyValid = slotCollection?.sorted ? commit.length >= 128 : true;
              if (slot !== undefined && structurallyValid && !stb.isEntrySlotPinned(slot)) {
                stb.setEntryRawCommitment(slot, commit); orderedCommits.push(commit);
              }
            }
            commitmentProgress += orderedCommits.length;
            latestEntryCommits = orderedCommits;
          }

          // Dynamic-storage chunk commitments. The data-NFT field holds uint32 A$len; from it we know
          // nNew = ceil(len/CHUNK). Ensure the builder creates nNew chunk outputs (placeholders until
          // their commitments are extracted), then extract the real commitments the covenant built.
          const chunkVars = stb.getDynamicChunkVars();
          if (chunkVars.length > 0 && derivedAState) {
            let chunkOffset = stb.getChunkOutputBase();
            for (const dv of chunkVars) {
              const len = Number((derivedAState[`${dv.name}$len`] as bigint) ?? 0n);
              const nNew = Math.ceil(len / DYNAMIC_CHUNK_SIZE);
              const existing = stb.getChunkRawCommitments(dv.name);
              if (existing.length !== nNew) {
                stb.setChunkRawCommitments(dv.name, Array.from({ length: nNew }, (_, i) => existing[i] ?? '00'));
              }
              if (nNew > 0) {
                // X10: key each observation by ITS output index (chunk i lives at chunkOffset + i), not
                // positionally. A positional list collapses onto index 0, so when the region's LOW chunks are
                // never verified - the covenant addressed a different output - a commitment observed higher in
                // the window is silently credited to chunk 0 and the true chunk 0 stays a '00' placeholder.
                // Matches the loop-entry and value-chunk derivations, which are already index-keyed.
                const range = { min: chunkOffset, max: chunkOffset + nNew };
                const chunkMap = extractCommitmentMapFromTrace(fullTrace2, range);
                if (chunkMap.size > 0) {
                  const derivedChunks: string[] = [];
                  for (const [outIdx, commit] of chunkMap) derivedChunks[outIdx - chunkOffset] = commit;
                  const cur = stb.getChunkRawCommitments(dv.name);
                  stb.setChunkRawCommitments(dv.name,
                    Array.from({ length: nNew }, (_, i) => derivedChunks[i] ?? cur[i] ?? '00'));
                  commitmentProgress += chunkMap.size;
                }
              }
              chunkOffset += nNew;
            }
          }

          // Loop mapping-write entry commitments (`for(i<n) m[k[i]]=v[i]`): a runtime-variable count N of new
          // entry NFT outputs. The VM halts at the first mismatched OP_EQUALVERIFY, so each probe reveals one more
          // commitment; grow the placeholder set by one until the trace stops revealing new ones (all N known),
          // then drop the trailing probe placeholder so the covenant's output-count pin passes.
          const loopEntryVars = stb.getLoopEntryVars();
          if (loopEntryVars.length > 0) {
            let loopOffset = stb.getLoopEntryOutputBase();
            for (const lv of loopEntryVars) {
              // P5b: a chunkable-value insert injects NEW exactly (pinned) - skip derivation so the value-chunk pin's
              // OP_OUTPUTTOKENCOMMITMENT calls are not misread as NEW. Advance loopOffset by the injected count.
              if (stb.isLoopEntryPinned(lv.collection)) {
                loopOffset += stb.getLoopEntryCommitments(lv.collection).length;
                continue;
              }
              // A C2 sorted upsert (bool/int/bytesN) carries its value in NEW, so NEW is derived from the trace.
              const scoll = stateLayout.collections?.find((c) => c.name === lv.collection);
              const isSortedValueMintColl = !!scoll?.sorted;
              const existing = stb.getLoopEntryCommitments(lv.collection);
              if (existing.length === 0) {
                // An UPDATE (present key) mints no trailing node; once probed empty, keep it empty (no re-seed).
                if (isSortedValueMintColl && probedSortedLoop.has(lv.collection)) continue;
                // Seed one placeholder so the next probe's iteration 0 has an output to verify against.
                stb.setLoopEntryCommitments(lv.collection, ['00']);
                latestLoopEntryCommits = latestLoopEntryCommits.concat('00');
                continue;
              }
              if (isSortedValueMintColl) probedSortedLoop.add(lv.collection);
              // A sorted VALUE upsert mints at most ONE trailing NEW node (insert), so cap its range to a single
              // output - otherwise a chunkable-value insert's value-chunk pin (which emits OP_OUTPUTTOKENCOMMITMENT
              // at loopOffset+1..) would be misread here as extra NEW nodes.
              const loopMax = isSortedValueMintColl ? loopOffset + 1 : loopOffset + LOOP_ENTRY_MAX_ITERATIONS;
              const range = { min: loopOffset, max: loopMax };
              const commitMap = extractCommitmentMapFromTrace(fullTrace2, range);
              const derived: string[] = [];
              for (const [outIdx, commit] of commitMap) derived[outIdx - loopOffset] = commit;
              const derivedCount = derived.filter((c) => c !== undefined).length;
              // A newly-learned last commitment (its placeholder was still '00') means more may follow; keep probing
              // with one extra placeholder. If the last commitment merely re-confirms a known one, the loop ran to
              // completion (all N derived) - drop the extra placeholder so the count pin sees exactly N outputs.
              // A sorted VALUE upsert mints a STATIC number of trailing NEW nodes (1 on insert, 0 on update), not a
              // growing loop, so never add the speculative extra placeholder (it would create a phantom output that
              // shifts the fixed entry-slot P' and oscillates the derivation).
              const isSortedValueMint = !!scoll?.sorted;
              // P5b computed INSERT: the value-chunk pin runs BEFORE the NEW-node check in the covenant, so until the
              // chunks converge the NEW OTC never runs and derivedCount is 0. Do NOT drop the seeded loop entry to 0
              // (that would shift vcBase and misalign the chunk derivation) - keep the count of 1 until NEW derives.
              const hasValueChunks = stb.getValueChunkVars().some((v) => v.collection === lv.collection);
              const requiredCount = stb.getRequiredLoopEntryCount(lv.collection);
              if (isSortedValueMint && derivedCount === 0 && existing.length > 0
                && (hasValueChunks || requiredCount > 0)) {
                loopOffset += existing.length;
                continue;
              }
              const stillLearning = !isSortedValueMint && derivedCount > 0
                && derived[derivedCount - 1] !== (existing[derivedCount - 1] ?? '00');
              const next: string[] = [];
              for (let i = 0; i < derivedCount; i++) next[i] = derived[i] ?? existing[i] ?? '00';
              if (stillLearning) next.push('00');
              while (next.length < requiredCount) next.push(existing[next.length] ?? '00');
              stb.setLoopEntryCommitments(lv.collection, next);
              commitmentProgress += derivedCount;
              latestLoopEntryCommits = latestLoopEntryCommits.concat(next);
              loopOffset += derivedCount;
            }
          }

          // P5b COMPUTED value chunks: the covenant PINS them (emitSortedValueChunkPin) but the SDK has no value
          // param to build them, so derive their commitments from the trace progressively (like loop entries). The
          // VM halts at the first placeholder mismatch, so each probe reveals one more chunk; grow the placeholder
          // set until the trace stops revealing new ones. A short value (<= 60 B) reveals 0 - the placeholder drops.
          const valueChunkVars = stb.getValueChunkVars();
          if (valueChunkVars.length > 0) {
            let vcOffset = stb.getValueChunkOutputBase();
            for (const vcv of valueChunkVars) {
              const existing = stb.getValueChunkRawCommitments(vcv.collection);
              if (existing.length === 0) {
                stb.setValueChunkRawCommitments(vcv.collection, ['00']); // seed so the covenant's chunk 0 has an output
                continue;
              }
              const range = { min: vcOffset, max: vcOffset + LOOP_ENTRY_MAX_ITERATIONS };
              const derivedBytecodes = extractVerifiedValuesFromTrace(fullTrace2, Op.OP_OUTPUTBYTECODE, range);
              if (derivedBytecodes.length > 0) {
                stb.setValueChunkLockingBytecode(vcv.collection, derivedBytecodes[0]);
                commitmentProgress += 1;
              }
              const commitMap = extractCommitmentMapFromTrace(fullTrace2, range);
              const derived: string[] = [];
              for (const [outIdx, commit] of commitMap) derived[outIdx - vcOffset] = commit;
              const derivedCount = derived.filter((c) => c !== undefined).length;
              const stillLearning = derivedCount > 0 && derived[derivedCount - 1] !== (existing[derivedCount - 1] ?? '00');
              const next: string[] = [];
              for (let i = 0; i < derivedCount; i++) next[i] = derived[i] ?? existing[i] ?? '00';
              if (stillLearning) next.push('00');
              stb.setValueChunkRawCommitments(vcv.collection, next);
              commitmentProgress += derivedCount;
              vcOffset += next.length;
            }
          }

          // Event commitments: output indices [eventBase, eventBase + eventCount)
          if (eventCount > 0) {
            const physicalEventIndices = delegatecallInputIndex === undefined ? [] : probeBuilder2.outputs
              .map((output, index) => output.token?.category === this.categoryId
                && output.token.nft?.capability === 'none' ? index : -1)
              .filter((index) => index >= 0);
            const eventOutputBase = physicalEventIndices[0] ?? stb.getEventOutputBase();
            const eventOutputRange = { min: eventOutputBase, max: eventOutputBase + eventCount };
            const eventCommits = extractCommitmentsFromTrace(fullTrace2, eventCount, eventOutputRange) ?? [];
            commitmentProgress += eventCommits.length;
            latestEventCommits = eventCommits;
            for (let ei = 0; ei < eventCount && ei < eventCommits.length; ei++) {
              stb.setEventRawCommitment(emitInfos![ei].emitIndex, eventCommits[ei]);
            }
          }

          // NFT transfer commitments are extracted separately via extractVerifiedValuesFromTrace below

          // Extract transfer outputs progressively from trace.
          // The compiler verifies transfers via:
          //   <expected_lbc> <idx> OP_OUTPUTBYTECODE OP_EQUALVERIFY
          //   <expected_amount> <idx> OP_OUTPUTVALUE OP_EQUALVERIFY
          // The VM fails at the first mismatch, so we may only get bytecodes (not amounts)
          // on the first iteration. Apply what we find (with placeholder amounts), re-probe.
          //
          // IMPORTANT: The compiler also verifies output bytecodes for preservation checks
          // (data NFTs, written entries, read-only entries) via OP_OUTPUTBYTECODE + OP_EQUALVERIFY
          // BEFORE the transfer checks. We filter by output index to only capture transfer
          // bytecodes: the STB's getTransferOutputBase() gives us the first transfer output index.
          const totalBytecodeCount = satoshiTransferCount + ftOps.length + nftOps.length;
          if (totalBytecodeCount > 0) {
            const transferOutputBase = stb.getTransferOutputBase();
            const tcTransferOutputBase = stb.getTokenContainerTransferOutputBase();

            // Satoshi transfer bytecodes: filter by output index range [transferOutputBase, tcTransferOutputBase)
            const satoshiBytecodes = extractVerifiedValuesFromTrace(
              fullTrace2, Op.OP_OUTPUTBYTECODE,
              { min: transferOutputBase, max: transferOutputBase + satoshiTransferCount },
            );
            // Satoshi transfer amounts: same output index range
            const satoshiValues = extractVerifiedValuesFromTrace(
              fullTrace2, Op.OP_OUTPUTVALUE,
              { min: transferOutputBase, max: transferOutputBase + satoshiTransferCount },
            );

            // Satoshi transfers: apply progressively (partial bytecodes + amounts).
            // The VM stops at the first mismatching OP_EQUALVERIFY, so for N transfers
            // we may only extract K<N bytecodes per iteration. Apply what we have and
            // keep placeholders for the rest - re-probing will extract more.
            if (satoshiTransferCount > 0 && satoshiBytecodes.length > 0) {
              stb.clearTransfers();
              derivedTransfers = [];
              if (satoshiValues.length >= satoshiTransferCount) satoshiAmountsFullyDerived = true;
              for (let i = 0; i < satoshiTransferCount; i++) {
                const lbc = i < satoshiBytecodes.length ? satoshiBytecodes[i] : dummyLbc;
                // Use extracted amount if available, otherwise keep placeholder
                const amt = i < satoshiValues.length
                  ? decodeScriptNumber(satoshiValues[i]) : 1200n;
                stb.addTransfer(lbc, amt);
                derivedTransfers.push({ lockingBytecode: lbc, amount: amt });
              }
            }

            // FT token container transfers: bytecodes + token amounts (progressive)
            if (ftOps.length > 0) {
              const ftBytecodes = extractVerifiedValuesFromTrace(
                fullTrace2, Op.OP_OUTPUTBYTECODE,
                { min: tcTransferOutputBase, max: tcTransferOutputBase + ftOps.length },
              );
              if (ftBytecodes.length > 0) {
                const ftAmountValues = extractVerifiedValuesFromTrace(
                  fullTrace2, Op.OP_OUTPUTTOKENAMOUNT,
                  { min: tcTransferOutputBase, max: tcTransferOutputBase + ftOps.length },
                );
                if (ftAmountValues.length >= ftOps.length) ftAmountsFullyDerived = true;
                stb.clearTokenContainerTransfers();
                derivedFtTransfers = [];
                for (let i = 0; i < ftOps.length; i++) {
                  const lbc = i < ftBytecodes.length ? ftBytecodes[i] : dummyLbc;
                  const amt = i < ftAmountValues.length
                    ? decodeScriptNumber(ftAmountValues[i]) : 1n;
                  stb.addTokenContainerTransfer(ftOps[i].categoryId, lbc, amt);
                  derivedFtTransfers.push({
                    categoryId: ftOps[i].categoryId, lockingBytecode: lbc, amount: amt,
                  });
                }
              }
            }

            // NFT token container transfers: bytecodes + commitments from OP_OUTPUTTOKENCOMMITMENT
            const nftTcBase = tcTransferOutputBase + ftOps.length;
            if (nftOps.length > 0) {
              const nftBytecodes = extractVerifiedValuesFromTrace(
                fullTrace2, Op.OP_OUTPUTBYTECODE,
                { min: nftTcBase, max: nftTcBase + nftOps.length },
              );
              if (nftBytecodes.length > 0) {
                derivedNftTransfers = [];
                stb.clearTokenContainerTransferNfts();
                // Extract NFT transfer commitments using output-index filtering
                // instead of fragile positional arithmetic on nonStateCommits
                const nftCommitments = extractVerifiedValuesFromTrace(
                  fullTrace2, Op.OP_OUTPUTTOKENCOMMITMENT,
                  { min: nftTcBase, max: nftTcBase + nftOps.length },
                );
                // Extract capabilities from OP_OUTPUTTOKENCATEGORY (33 bytes = 32 cat + 1 cap)
                const nftCategories = extractVerifiedValuesFromTrace(
                  fullTrace2, Op.OP_OUTPUTTOKENCATEGORY,
                  { min: nftTcBase, max: nftTcBase + nftOps.length },
                );
                for (let i = 0; i < nftOps.length; i++) {
                  const lbc = i < nftBytecodes.length ? nftBytecodes[i] : dummyLbc;
                  const commitment = nftCommitments.length > i
                    ? nftCommitments[i] : new Uint8Array(0);
                  const capability = nftCategories.length > i
                    ? parseNftCapability(nftCategories[i]) : 'none' as const;
                  stb.addTokenContainerTransferNft(nftOps[i].categoryId, lbc, commitment, capability);
                  derivedNftTransfers.push({
                    categoryId: nftOps[i].categoryId, lockingBytecode: lbc,
                    commitment, capability,
                  });
                }
              }
            }
          }

          // X10. A trailing C2 entry mint places its NEW node AFTER the chunk region, and the covenant checks
          // that output's ADDRESS before any commitment - so a region laid out one output short aborts the probe
          // before the data NFT is verified, A$len is never revealed, and the exact count above can never be
          // computed. Break that cycle from the only evidence a zero-progress probe leaves: nothing at all was
          // learned, so the trailing region is the wrong size. Grow it by one output and re-probe. The first
          // probe that reaches ANY commitment stops the growth, and A$len then snaps the count to its exact
          // value.
          // X101. This is a linear grow of the region TOTAL, not a search over per-var splits, and measurement
          // says a search is not needed: the covenant reaches the trailing NEW node's address before it verifies
          // any chunk, so during the speculative phase only the region's total output count is observable - the
          // split is not. Growing the first var and growing the last var were measured to produce the same
          // accepted transaction for (200,60), (60,200) and (200,200), including the two cases whose grown split
          // is WRONG (right total): the very next probe reads every $len off the data NFT and the block above
          // snaps each var to its exact count. Grow the first so the single-var path stays byte-identical. The
          // bound is on the TOTAL region, so several vars cannot multiply it.
          if (commitmentProgress === 0 && !derivedAState && chunkVars.length >= 1
            && stb.getLoopEntryVars().length > 0 && fullTrace2.some((s: any) => s.error)) {
            const regions = chunkVars.map((cv) => stb.getChunkRawCommitments(cv.name));
            const total = regions.reduce((n, r) => n + r.length, 0);
            if (total > 0 && total < MAX_SPECULATIVE_CHUNK_OUTPUTS
              && regions.every((r) => r.every((c) => c === '00'))) {
              stb.setChunkRawCommitments(chunkVars[0].name, [...regions[0], '00']);
            }
          }

          // Check convergence using content fingerprint (not just count)
          // to detect when derived values change without the count increasing.
          const convergenceKey = computeConvergenceKey(
            commitmentProgress, derivedTransfers, derivedFtTransfers, derivedNftTransfers,
            stateCommits, latestEntryCommits, latestEventCommits, latestLoopEntryCommits,
          );
          // P5b: a computed value's ENTRY commitment only derives once the (earlier) value-chunk pin passes, which
          // is one probe AFTER the chunks converge - so with value chunks, do not break on a stable fingerprint
          // while the probe still errors (bounded by maxIterations). Non-value-chunk txs keep the original break so
          // an expected-revert derivation still exits fast.
          const probeHadError = fullTrace2.some((s: any) => s.error);
          const needsPassingProbe = stb.getValueChunkVars().length > 0
            || stb.getDynamicChunkVars().length > 0 || stb.getLoopEntryVars().length > 0;
          if (convergenceKey === prevConvergenceKey && (!needsPassingProbe || !probeHadError)) break;
          if (seenConvergenceKeys.has(convergenceKey) && (!needsPassingProbe || !probeHadError)) {
            throw new AutoDerivationError(
              'Auto-derivation oscillation detected: derivation state is cycling without converging. '
            + 'This may indicate conflicting covenant constraints.',
            );
          }
          seenConvergenceKeys.add(convergenceKey);
          prevConvergenceKey = convergenceKey;
        }

        // P5b: drop any unresolved '00' value-chunk placeholder from the FINAL commitments. The seed at derivation
        // time gives the covenant's chunk 0 an output to verify against (the chunked bootstrap), but a computed value
        // that resolves INLINE (<= 60 B) pins NO chunks (emitSortedValueChunkPin's size>60 guard), so the placeholder
        // is spurious - a real chunk commitment is always long (slot++digest++i++data), never the 1-byte '00'.
        // Minting it would leave a garbage chunk NFT that a later chunked read of the same slot fails to parse.
        for (const vcv of stb.getValueChunkVars()) {
          const commits = stb.getValueChunkRawCommitments(vcv.collection).filter((c) => c !== '00');
          if (commits.length !== stb.getValueChunkRawCommitments(vcv.collection).length) {
            stb.setValueChunkRawCommitments(vcv.collection, commits);
          }
        }

        const lastStep = lastTrace?.[lastTrace.length - 1];
        const vmHadError = !!(lastStep && (lastStep as any).error);

        // When the VM didn't fully converge, derived transfers may still contain
        // placeholder bytecodes or amounts. Check both bytecodes and amounts are fully
        // resolved before accepting the derivation.
        if (vmHadError) {
          const satoshiBytecodesFull = derivedTransfers
            ? derivedTransfers.every((t) => binToHex(t.lockingBytecode) !== binToHex(dummyLbc))
            : false;
          if (derivedTransfers && (!satoshiAmountsFullyDerived || !satoshiBytecodesFull)) {
            stb.clearTransfers();
            // Re-add initial placeholders so output count stays correct for re-derivation
            for (let i = 0; i < satoshiTransferCount; i++) stb.addTransfer(dummyLbc, 1000n);
            derivedTransfers = undefined;
          }
          const ftBytecodesFull = derivedFtTransfers
            ? derivedFtTransfers.every((t) => binToHex(t.lockingBytecode) !== binToHex(dummyLbc))
            : false;
          if (derivedFtTransfers && (!ftAmountsFullyDerived || !ftBytecodesFull)) {
            stb.clearTokenContainerTransfers();
            for (const op of ftOps) stb.addTokenContainerTransfer(op.categoryId, dummyLbc, 1n);
            derivedFtTransfers = undefined;
          }
          // NFT transfers: same placeholder cleanup as satoshi and FT transfers
          const nftBytecodesFull = derivedNftTransfers
            ? derivedNftTransfers.every((t) => binToHex(t.lockingBytecode) !== binToHex(dummyLbc))
            : false;
          if (derivedNftTransfers && !nftBytecodesFull) {
            stb.clearTokenContainerTransferNfts();
            for (const op of nftOps) stb.addTokenContainerTransferNft(op.categoryId, dummyLbc, new Uint8Array(0), 'none');
            derivedNftTransfers = undefined;
          }
        }

        if (!derivedAState) {
        // No state commitments found - the function doesn't write state.
        // Preserve current on-chain state regardless of VM success/failure.
          const currentState: Record<string, StateValueType> = {};
          const onChain = await this.getFullState();
          for (const v of stateLayout.variables) {
            if (onChain.state[v.name] !== undefined) {
              currentState[v.name] = onChain.state[v.name] as StateValueType;
              stb.setState(v.name, onChain.state[v.name] as StateValueType);
            }
          }
          return {
            state: currentState, vmErrored: vmHadError,
            derivedTransfers, derivedTokenContainerTransfers: derivedFtTransfers,
            derivedTokenContainerTransferNfts: derivedNftTransfers,
          };
        }

        // State commitments were found. If the VM errored, they might be
        // false positives from infrastructure code. Mark for re-derivation.
        return {
          state: derivedAState, vmErrored: vmHadError,
          derivedTransfers, derivedTokenContainerTransfers: derivedFtTransfers,
          derivedTokenContainerTransferNfts: derivedNftTransfers,
        };

      } catch (e) {
        if (e instanceof AutoDerivationError) throw e;
        throw new AutoDerivationError(
          `Full state derivation failed: ${e instanceof Error ? e.message : String(e)}`,
          e instanceof Error ? e : undefined,
        );
      }
    } catch (e) {
      // Only swallow AutoDerivationError - let all other errors propagate.
      if (e instanceof AutoDerivationError) {
        return { state: undefined, vmErrored: true, derivationError: e };
      }
      // Wrap unexpected errors from the derivation try-body as AutoDerivationError
      // so that callers get a consistent error type for derivation failures.
      throw e;
    }
  }

  // Caller-supplied keys for sorted (C2) mapping KEYS/ENTRIES iteration. A sorted entry stores slot=H(key), not
  // the raw key, so the caller provides the keys and the covenant verifies keyToSlot(key)==slot per entry. Set
  // before the call; a wrong/incomplete set is rejected by the covenant (wrong key -> hash mismatch; missing
  // entry -> chain break).
  private _iterationKeys?: Map<string, Uint8Array[]>;
  private _rawIterationKeysBlob?: Map<string, Uint8Array>;
  private _rawC2BatchWitness?: Map<number, { slot?: Uint8Array; proof?: bigint; next?: Uint8Array; predOut?: bigint }>;

  /**
   * Supply the keys for a sorted `enumerable mapping` KEYS/ENTRIES iteration. Required for such iterations (the
   * raw key is not on-chain). Order is irrelevant - the SDK orders them to the chain and the covenant verifies
   * keyToSlot(key) == each entry's slot.
   */
  setIterationKeys(collectionName: string, keys: Uint8Array[]): this {
    (this._iterationKeys ??= new Map()).set(collectionName, keys);
    return this;
  }

  /**
   * @internal Test hook: supply the KEYS/ENTRIES keys blob verbatim, bypassing the honest slot-matching, to
   * exercise the covenant's key-verify backstop against a malicious spender (a key that does not hash to its
   * entry's slot must revert).
   */
  _setRawIterationKeysBlob(collectionName: string, blob: Uint8Array): this {
    (this._rawIterationKeysBlob ??= new Map()).set(collectionName, blob);
    return this;
  }

  /** @internal Test hook: override a derived atomic-batch witness to exercise covenant rejection paths. */
  _setRawC2BatchWitness(
    slotIndex: number, witness: { slot?: Uint8Array; proof?: bigint; next?: Uint8Array; predOut?: bigint },
  ): this {
    (this._rawC2BatchWitness ??= new Map()).set(slotIndex, witness);
    return this;
  }

  /** @internal - compute total output count for sentinel index when draining */
  /** @internal */
  async _createBuilder(
    functionName: string,
    args: any[],
    overrides?: {
      masterUtxo?: Utxo; dataNftUtxos?: Utxo[]; externalCalls?: ExternalCallInfo[];
      calls?: CallInfo[];
      entryKeyOverrides?: Map<number, bigint | boolean | Uint8Array>;
      externalEntryKeyOverrides?: Map<number, bigint | boolean | Uint8Array>;
      msgSenderCategory?: Uint8Array;
      drainSatoshiContainer?: boolean;
      drainTokenContainers?: string[];
      emitReturn?: boolean;
      /** Controllerless composition's provisional/final SCB1 return-event commitment. */
      returnBlob?: Uint8Array;
      /** `.staticCall()`: emitReturn is set only to lay out the probe; nothing is ever broadcast. */
      returnProbeOnly?: boolean;
      abiFunction?: AbiFunction;
      compilerRouteSelector?: Uint8Array;
      /** Absolute base when this local balanced block is concatenated after another participant. */
      blockBase?: number;
      /** A controllerless composition supplies one global fee tail after all participant blocks. */
      omitLocalFeeTail?: boolean;
    },
  ): Promise<StatefulTransactionBuilder> {
    await this._ensureResolved(); // address-constructed instances: resolve the category before building the tx
    const stateLayout = this.inner.stateLayout!;

    // Move ABI lookup FIRST so we can determine if full state is needed
    const abiFunction = overrides?.abiFunction
      ?? this.inner.artifact.abi.find((f) => f.name === functionName);
    const requiredNftIndices = abiFunction?.requiredNftIndices
      ?? Array.from({ length: stateLayout.dataNftCount }, (_, i) => i);

    // Check if function needs full state (data NFTs, entries, external reads, etc.)
    const needsFullState = requiredNftIndices.length > 0
      || (abiFunction?.entryAccesses?.length ?? 0) > 0
      || (abiFunction?.externalReads?.length ?? 0) > 0
      || (abiFunction?.externalCalls?.length ?? 0) > 0
      || (abiFunction?.lowLevelCalls?.length ?? 0) > 0
      || (abiFunction?.tokenContainerAccesses?.length ?? 0) > 0
      || (abiFunction?.collectionIterations?.length ?? 0) > 0
      || (abiFunction?.transferCount ?? 0) > 0;

    let onChainState: OnChainState;
    if (needsFullState) {
      onChainState = await this.getFullState();
    } else {
      onChainState = await this._getMasterOnlyState();
    }

    if (!overrides?.masterUtxo && !onChainState.masterUtxo) {
      throw new Error('Master UTXO not found on-chain');
    }

    const masterUtxo = overrides?.masterUtxo ?? onChainState.masterUtxo!;
    const allDataNftUtxos = overrides?.dataNftUtxos ?? onChainState.dataNftUtxos;

    // Filter data NFT UTXOs to only those required by this function
    const filteredDataNftUtxos = requiredNftIndices.map((idx) => allDataNftUtxos[idx]);
    if (filteredDataNftUtxos.some((u) => u === undefined)) {
      throw new Error(`Missing required data NFTs on-chain. Expected indices: [${requiredNftIndices.join(', ')}], but only ${allDataNftUtxos.length} data NFTs found.`);
    }

    // Append _msgSenderCategory if function uses msg.sender
    let finalArgs = [...args];

    // Canonical C2 counter loops are lowered to read their logical key from a hidden permutation array. Build that
    // witness from the public bound: [0..n) sorted by the same full-width slot hash used by the covenant. The lowered
    // body uses perm[physical_i] everywhere the source used logical i, so key and derived value stay paired.
    for (const input of abiFunction?.inputs ?? []) {
      const m = input.name.match(/^__internal__c2CounterPerm_(.+)_(\d+)$/);
      if (!m) continue;
      const countIdx = abiFunction!.inputs.findIndex((p) => p.name === m[1]);
      const count = countIdx >= 0 ? BigInt(args[countIdx]) : -1n;
      if (count < 0n || count > 10000n) {
        throw new Error(`C2 counter loop bound '${m[1]}' must be between 0 and 10000`);
      }
      const perm = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
      perm.sort((a, b) => {
        const av = bytesToSlotValue(keyToSlotMulti([bigIntToVmNumber(a)]));
        const bv = bytesToSlotValue(keyToSlotMulti([bigIntToVmNumber(b)]));
        return av < bv ? -1 : av > bv ? 1 : 0;
      });
      const hiddenIdx = abiFunction!.inputs.findIndex((p) => p.name === input.name);
      args[hiddenIdx] = perm;
      finalArgs = [...finalArgs, perm];
    }

    // Multi-use view+mutate loop (getReserves() + swap() on one pair): auto-fill each `__internal__viewReturn<n>`
    // witness from the co-spent pairs' state. The pairs are the loopTargets slot's registered instances; the SDK
    // reads each pair's n-th state field (convention: the view returns the pair's first-N state fields in order -
    // Router02 getReserves() -> reserve0/reserve1/blockTimestampLast). Caller-permissive: a wrong value feeds wrong
    // args into swap, whose co-spent covenant rejects, so a non-conventional view fails closed (a caller override
    // could refine it, not a soundness gate). Positioned right after the user args (viewReturn precedes the other
    // synthesized params in the ABI).
    const viewReturnParams = (abiFunction?.inputs ?? []).filter((i) => i.name.startsWith('__internal__viewReturn'));
    if (viewReturnParams.length > 0) {
      const loopSlot = abiFunction?.externalCalls?.find((ec) => ec.loopArrayVar?.startsWith('__internal__loopTargets'));
      const insts = (loopSlot ? this.inner.getExternalTargetEntriesByInterface(loopSlot.interfaceName) : [])
        .map((e) => e.instance as { getState(): Promise<Record<string, unknown>>; inner: { artifact: Artifact } });
      const states = await Promise.all(insts.map((inst) => inst.getState()));
      for (let vn = 0; vn < viewReturnParams.length; vn++) {
        const vals = insts.map((inst, k) => {
          const vars = inst.inner.artifact.stateLayout?.variables ?? [];
          const fieldName = vars[vn]?.name;
          return fieldName !== undefined ? states[k][fieldName] : 0n;
        });
        finalArgs = [...finalArgs, encodePushdataValue(vals as never, viewReturnParams[vn].type)];
      }
    }
    // B8 return-value emit: -1 means "do not emit" (default). With .emitReturn(), point the covenant's
    // __internal__returnOutputIdx at the function's returnEvent output slot (a fixed block-layout offset).
    let returnEmitOutputIndex = -1;
    let returnEmitBlockOffset = -1;
    if (overrides?.emitReturn && (abiFunction?.outputs?.length ?? 0) > 0) {
      const slot = abiFunction?.blockLayout?.slots.find((s) => s.kind === 'returnEvent');
      if (!slot) {
        throw new Error(`Function '${functionName}' has no returnEvent output slot; cannot emit its return value.`);
      }
      returnEmitBlockOffset = slot.offset;
      returnEmitOutputIndex = (overrides?.blockBase ?? 0) + returnEmitBlockOffset;
      // X12/X56. A delegated call's return event is verified by the IMPLEMENTATION (emitReturnEventCovenant-
      // Verification is gated `!functionHasDelegatecall`), which resolves EVERY output-only slot
      // implementation-relative - its event and its own returnEvent alike. When the implementation also emits,
      // this forwarder's returnEvent offset is therefore the wrong one: the event sits there. The delegate slot
      // reservation below (`delegateReturnEventOffset`) relocates it, once the co-spent implementation and its
      // block layout are known. Without an `emit` the two offsets coincide, which is why a plain returning
      // delegate settles on this offset alone.
    }
    if (abiFunction?.usesMsgSender) {
      let msgSenderCategory = overrides?.msgSenderCategory;
      if (!msgSenderCategory) {
        // An IFoo(msg.sender).m() call: msg.sender IS the co-spent callee, so derive its 32-byte category
        // (reversed = VM order) for the covenant's emitMsgSender - else it falls back to tx.origin and the
        // callee-identity check fails. The callee comes from withExternalCall()/connect-time externals.
        const msSlot = abiFunction.externalCalls?.find((ec) => ec.addressIsMsgSender);
        const info = msSlot && overrides?.externalCalls?.find((ec) => ec.functionName === msSlot.functionName);
        if (info) msgSenderCategory = hexToBin(info.externalContract.categoryId).reverse();
      }
      finalArgs = [...finalArgs, msgSenderCategory ?? new Uint8Array(32)];
    }
    // __internal__blockhashInputIndex: the (n->hash) co-spend's absolute input index = master(0) + the slot
    // offset (the SymbolTable injects this param right after msgSender, so it is pushed here in order).
    const bhSlot = abiFunction?.blockLayout?.slots.find((s) => s.kind === 'blockhashOracle');
    if (bhSlot) {
      finalArgs = [...finalArgs, BigInt(bhSlot.offset)];
    }

    // Handle entry NFT accesses
    let entryAccesses = abiFunction?.entryAccesses;
    let entryAbiFunction = abiFunction;
    let entryArgs = args;
    // A delegatecall'd impl that writes a mapping does so against the PROXY's grafted collections (this.categoryId).
    // __forward itself has no entryAccesses, so route the impl fn's - the entry machinery below then mints/updates
    // the proxy's entry NFTs at the proxy-block entry slot (reserved via delegateEventSlots).
    if (!entryAccesses?.length && abiFunction?.lowLevelCalls) {
      const resolvedForEntries = overrides?.calls ?? [];
      for (let i = 0; i < abiFunction.lowLevelCalls.length; i++) {
        if (abiFunction.lowLevelCalls[i].callMode !== 'delegatecall') continue;
        const ci = resolvedForEntries[i] as {
          type?: string; contract?: StatefulContract; functionName?: string; args?: FunctionArgument[];
        } | undefined;
        if (ci?.type !== 'stateful' || !ci.contract) continue;
        const implFn = (ci.contract.inner.artifact.abi as readonly AbiFunction[]).find((f) => f.name === ci.functionName);
        if (implFn?.entryAccesses?.length) {
          entryAccesses = implFn.entryAccesses;
          entryAbiFunction = implFn;
          entryArgs = ci.args ?? [];
          break;
        }
      }
    }
    let entryNfts: EntryNftInfo[] = [];
    let entryValueWitnesses: Uint8Array[] = [];
    let entryBatchWitnesses: unknown[] = [];
    // C2 sorted-set inserts to inject after the builder is created: P' (the predecessor's new commitment at its
    // entry slot) and NEW (the new node minted at the trailing loop-entry output).
    const sortedInserts: Array<{ slotIndex: number; collection: string; predNew: Uint8Array; newNode?: Uint8Array }> = [];
    // P5b value-chunk mints (collected in the entry loop, added to the builder after it is created).
    const valueChunkMints: Array<{ collection: string; slot: Uint8Array; digest: Uint8Array; chunks: Uint8Array[] }> = [];
    // P5b COMPUTED chunkable writes (no resolvable value param): the covenant pins the chunks, so the SDK derives
    // their commitments from the trace (registered as valueChunkVars after the builder is created).
    const computedValueChunkCollections = new Set<string>();
    // Computed UPDATES (present key, no NEW node): pin the loop entry empty so it is not phantom-derived.
    const computedValueUpdateCollections = new Set<string>();
    // P5b overwrite GC: on an UPDATE whose OLD value was long, co-spend its old chunks (collection, slot, oldDigest)
    // so they are consumed rather than orphaned as dust. Digest-keyed, so only the exact old version is reclaimed.
    const valueChunkGc: Array<{ collection: string; slotHex: string; oldDigestHex: string }> = [];
    const batchTargetSlots = new Map<number, Uint8Array>();
    const batchTargetPlaceholders = new Map<number, string>();
    const batchPredCommitments = new Map<string, string[]>();

    if (entryAccesses && entryAccesses.length > 0 && stateLayout.collections) {
      // Entries of DIFFERENT collections share the master's category and are indistinguishable by commitment
      // when they carry the same key (a[k] and b[k] both parse under either collection's types). onChainState.
      // entryNftUtxos also mixes in dynamic-storage chunks, so matching within that category-wide list can pick
      // the wrong collection even when the contract declares only one mapping. Always fetch through the exact
      // collection covenant address; the address commits to the collection signature.
      const collEntryCache = new Map<string, Utxo[]>();
      const collectionEntriesFor = async (sig: string): Promise<Utxo[]> => {
        const hit = collEntryCache.get(sig);
        if (hit) return hit;
        const addr = getEntryNftAddress(this.inner, this.categoryId, sig);
        const fetched = (await this.inner.provider.getUtxos(addr)).filter((u) => (
          u.token?.category === this.categoryId
          && u.token?.nft?.capability === 'mutable'
          && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0
        ));
        collEntryCache.set(sig, fetched);
        return fetched;
      };

      // P5b value witnesses (__internal__valueWitness_N), collected in entryAccesses (slotIndex) order to match
      // the SymbolTable param injection; appended to finalArgs after this loop (between blockhash and iteration).
      const chunkableReadWitnesses: Uint8Array[] = [];

      for (let slotIndex = 0; slotIndex < entryAccesses.length; slotIndex++) {
        const access = entryAccesses[slotIndex];
        const collection = stateLayout.collections.find((c) => c.name === access.collection);
        if (!collection) {
          throw new Error(`Unknown collection: ${access.collection}`);
        }
        const collectionEntries = await collectionEntriesFor(collection.signature);

        // C2 sorted-linked-list mapping (mapping(K=>bool) set): co-spend ONE entry read-only - the exact entry if
        // k is present, else the bracketing predecessor - which the emitted read covenant needs to return the real
        // membership bit. slot = keyToSlot(k encoded as its on-stack VM number, matching the covenant's OP_SHA256).
        if (collection.sorted) {
          const list = SortedList.fromUtxos(collectionEntries);
          // Composite slot for a nested mapping m[a][b]...: hash each key independently, then hash the
          // concatenation (keyToSlotMulti), matching the covenant's emitSortedKeyHash. Single key -> keyToSlot.
          const keyNames = access.keyParams.map((name, i) => access.keySources?.[i]?.paramName ?? name);
          const keyTypes = collection.keyTypes ?? [collection.keyType];
          const encodeKey = (paramName: string, keyType: string, ki: number): Uint8Array => {
            const source = access.keySources?.[ki];
            if (source?.kind === 'constant') {
              return bigIntToVmNumber(BigInt(source.constantValue ?? '0'));
            }
            // msg.sender / tx.origin key: slot = keyToSlot(the sender's native P2PKH lockscript = tx.origin). The
            // sender funds via _signer.unlockP2PKH(), so the covenant's on-chain emitTxOrigin resolves to the same
            // lockscript; a wrong address just fails the on-chain slot check (fail-closed).
            if (source?.kind === 'msgSender') {
              if (!this._signer) {
                throw new Error('A msg.sender/tx.origin-keyed sorted mapping requires a Signer (the sender funds via '
                  + 'its native P2PKH input): connect one with StatefulContract.connect(signer).');
              }
              return addressToLockScript(this._signer.getAddress());
            }
            if (source?.kind === 'stateArrayLast') {
              const values = onChainState.state[source.stateArrayName ?? ''];
              if (!Array.isArray(values) || values.length === 0) {
                throw new Error(`C2 key source '${source.stateArrayName}' has no last element`);
              }
              const value = values[values.length - 1];
              if (keyType === 'address' && typeof value === 'string' && value.includes(':')) {
                return addressToLockScript(value);
              }
              if (value instanceof Uint8Array) return value;
              if (typeof value === 'bigint') return bigIntToVmNumber(value);
              if (typeof value === 'boolean') return bigIntToVmNumber(value ? 1n : 0n);
              throw new Error(`Unsupported C2 state-array key value for '${source.stateArrayName}'`);
            }
            // Expression/computed key (e.g. balances[hash160(pk)] with a local var): not a function param, so
            // resolve it from a caller-supplied entryKeyOverrides value (withEntryKey), matching the default entry
            // model. Without one, use a type-width placeholder (a lone entry / VM-trace derivation resolves it).
            if (source?.kind === 'expression') {
              if (/^(?:call:_msgSender\(\)|nullop:msg\.sender)$/.test(source.expressionLabel ?? '')) {
                const senderSigner = this._signer ?? this._logicalNonceSigner;
                if (!senderSigner) {
                  throw new Error('A msg.sender-keyed sorted mapping requires a connected Signer.');
                }
                return addressToLockScript(senderSigner.getAddress());
              }
              // Auto-derive a direct computed key (hash160(pk), sha256(x), ...) from its canonical label.
              const auto = evalComputedKey(source.expressionLabel, entryArgs, entryAbiFunction!.inputs);
              if (auto) return auto;
              const ov = overrides?.entryKeyOverrides?.get(slotIndex);
              if (ov !== undefined) {
                return ov instanceof Uint8Array ? ov
                  : typeof ov === 'bigint' ? bigIntToVmNumber(ov) : bigIntToVmNumber(ov ? 1n : 0n);
              }
              const m = keyType.match(/^bytes(\d+)$/);
              return m ? new Uint8Array(parseInt(m[1], 10)) : new Uint8Array(0);
            }
            const idx = entryAbiFunction!.inputs.findIndex((inp) => inp.name === paramName);
            const v = entryArgs[idx] as bigint | boolean | Uint8Array | string;
            // An address key is hashed as its locking bytecode (matching the covenant's on-stack address and the
            // default entry model). Bytes keys arrive as Uint8Array (raw); ints as their VM number.
            if (keyType === 'address' && typeof v === 'string' && v.includes(':')) return addressToLockScript(v);
            return typeof v === 'bigint' ? bigIntToVmNumber(v)
              : v instanceof Uint8Array ? v
                : typeof v === 'boolean' ? bigIntToVmNumber(v ? 1n : 0n)
                  : bigIntToVmNumber(BigInt(v as unknown as string));
          };
          const slot = keyToSlotMulti(keyNames.map((name, i) => encodeKey(name, keyTypes[i] ?? collection.keyType, i)));
          batchTargetSlots.set(slotIndex, slot);
          const kvIdx = entryAbiFunction!.inputs.findIndex((inp) => inp.name === keyNames[0]);
          const stateArrayKeyValues = access.keySources?.[0]?.kind === 'stateArrayLast'
            ? onChainState.state[access.keySources[0].stateArrayName ?? ''] as unknown[] : undefined;
          const kv = access.keySources?.[0]?.kind === 'constant'
            ? BigInt(access.keySources[0].constantValue ?? '0')
            : access.keySources?.[0]?.kind === 'msgSender'
              ? addressToLockScript(this._signer!.getAddress())
              : access.keySources?.[0]?.kind === 'expression'
                ? (/^(?:call:_msgSender\(\)|nullop:msg\.sender)$/.test(
                  access.keySources[0].expressionLabel ?? '',
                ) && (this._signer ?? this._logicalNonceSigner)
                  ? addressToLockScript((this._signer ?? this._logicalNonceSigner)!.getAddress())
                  : evalComputedKey(access.keySources[0].expressionLabel, entryArgs, entryAbiFunction!.inputs)
                  ?? overrides?.entryKeyOverrides?.get(slotIndex) ?? new Uint8Array(0))
                : access.keySources?.[0]?.kind === 'stateArrayLast'
                  ? stateArrayKeyValues![stateArrayKeyValues!.length - 1] as bigint | boolean | Uint8Array | string
                  : entryArgs[kvIdx] as bigint | boolean | Uint8Array | string;
          // A sorted mapping write OR `delete m[k]` (== assign default, Solidity semantics) both upsert the entry,
          // so the SDK co-spends it the same way. bool sets are value mappings too (true=0x01, false/delete=empty).
          const isWrite = access.operations.includes('write') || access.operations.includes('delete');
          const isSoftDelete = entryAbiFunction?.blockLayout?.slots.some(
            (s) => s.kind === 'entry' && s.slotIndex === slotIndex && s.softDelete,
          ) ?? false;
          const entryBase = {
            slotIndex, collection: access.collection, keyType: collection.keyType, valueType: collection.valueType,
            keyValue: kv as bigint | boolean | Uint8Array, exists: true,
          };
          if (isWrite) {
            // Upsert. Present -> UPDATE: co-spend the exact entry; the covenant pins the entry output k' = link||v,
            // whose value is derived from the VM trace. Absent -> INSERT: co-spend the bracketing predecessor; P'
            // at the entry output is known exactly (inject it), and NEW = k||next||v is minted trailing with its
            // value derived from the trace.
            const present = list.has(slot);
            const wUnlocker = createEntryNftUnlocker(
              this.inner, overrides?.blockBase ?? 0, this.categoryId, access.collection,
            );
            if (present) {
              entryNfts.push({ ...entryBase, utxo: { ...list.find(slot)!.utxo, unlocker: wUnlocker } });
            } else if (isSoftDelete) {
              // The same slot is read by the early-return guard, so absence still needs the authenticated
              // predecessor. The covenant's slot-equality guard prevents any write/output on this no-op path.
              const predecessor = list.predecessorOf(slot);
              entryNfts.push({ ...entryBase, utxo: { ...predecessor.utxo, unlocker: wUnlocker } });
            } else {
              // X11. A delegated sorted INSERT mints one new entry node, so the transaction's own-category
              // mutable (0x01) NFT count rises by one. A proxy that CONSERVES that count
              // (emitOwnCategoryMutableNftConservation, added for C1 full-state authority) therefore rejects it
              // at its own input, while the implementation covenant accepts the same transaction. The checked-in
              // default upgrades proxy predates that conservation and admits it, which is why the delegated
              // insert settles there. Not refused here: whether it settles is a property of the proxy's
              // bytecode, not of this call.
              const plan = list.planInsert(slot);
              entryNfts.push({ ...entryBase, utxo: { ...plan.predecessor.utxo, unlocker: wUnlocker } });
              // P5b: for a chunkable-value INSERT the covenant chunk-pin adds OP_OUTPUTTOKENCOMMITMENT calls in the
              // loop-entry output range, so the trace-derivation of the NEW node reads chunk commitments by mistake.
              // Compute NEW exactly from the direct value param
              // (slot ++ oldNext ++ len4 ++ [v|sha256(v)++head28]) and inject.
              // it PINNED so the derivation skips this collection entirely (see setLoopEntryCommitments + pinning).
              let newNode: Uint8Array | undefined;
              if (collection.chunkableValue && access.valueParam) {
                const vIdx2 = entryAbiFunction!.inputs.findIndex((inp) => inp.name === access.valueParam);
                const raw2 = vIdx2 >= 0 ? entryArgs[vIdx2] : undefined;
                const vB = typeof raw2 === 'string' ? utf8ToBin(raw2) : raw2 instanceof Uint8Array ? raw2 : undefined;
                if (vB) {
                  const len4 = new Uint8Array(4);
                  new DataView(len4.buffer).setUint32(0, vB.length, true);
                  const longBody = new Uint8Array([...sha256Sync(vB), ...vB.slice(0, VALUE_HEAD_SIZE)]);
                  const tail = new Uint8Array([...len4, ...(vB.length > 60 ? longBody : vB)]);
                  newNode = encodeEntryCommitment(slot, plan.predecessor.nextKey, tail);
                }
              }
              if (!entryAbiFunction?.sortedBatchInfo?.some((b) => b.slotIndices.includes(slotIndex))) {
                sortedInserts.push({ slotIndex, collection: access.collection, predNew: plan.predNewCommitment, newNode });
              }
            }
          } else {
            const entry = list.has(slot) ? list.find(slot)! : list.predecessorOf(slot);
            const roUnlocker = createReadOnlyEntryNftUnlocker(this.inner, this.categoryId, access.collection);
            entryNfts.push({ ...entryBase, utxo: { ...entry.utxo, unlocker: roUnlocker } });
          }

          // P5b: a chunkable (unbounded bytes/string) value READ needs the full value as its __internal__
          // valueWitness_N arg. Present + long (>60 B): reassemble from value chunks at getValueChunkAddress
          // (collection, slot, digest); the covenant verifies sha256(witness) == the entry's stored digest.
          // Present + short OR absent: empty (covenant materializes the inline tail / the default).
          if (collection.chunkableValue
            && access.operations.includes('read')) {
            let witness: Uint8Array = new Uint8Array();
            if (list.has(slot)) {
              const tail = list.find(slot)!.value; // len(4 B LE) ++ [ inline value | sha256(value) ]
              if (tail.length >= 4) {
                const len = tail[0] | (tail[1] << 8) | (tail[2] << 16) | (tail[3] << 24);
                if (len > 60) {
                  const root = tail.slice(4, 36);
                  const headData = tail.slice(36, 64);
                  const chunkAddr = getValueChunkAddress(this.inner, this.categoryId, access.collection, slot, root);
                  const chunks = (await this.inner.provider.getUtxos(chunkAddr))
                    .filter((u) => u.token?.category === this.categoryId
                      && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0)
                    .map((u) => parseValueChunkCommitment(u.token!.nft!.commitment))
                    .sort((a, b) => a.chunkIndex - b.chunkIndex);
                  witness = joinValueChunks(headData, chunks, len);
                  if (binToHex(sha256Sync(witness)) !== binToHex(root)) {
                    throw new Error('C2 value chunks do not match the authenticated root');
                  }
                }
              }
            }
            chunkableReadWitnesses.push(witness);
          }

          // P5b: a sorted chunkable-value WRITE persists the full value as chunks; the covenant PINS them to the
          // on-stack value (Design D), so they must match slot ++ digest ++ i ++ data exactly. A DIRECT value param
          // is chunked here; a COMPUTED value (unresolvable param / expression) is registered so the SDK derives the
          // pinned chunk commitments from the VM trace (like dynamicChunkVars).
          if (isWrite && collection.chunkableValue) {
            const vIdx = access.valueParam
              ? entryAbiFunction!.inputs.findIndex((inp) => inp.name === access.valueParam)
              : -1;
            const raw = vIdx >= 0 ? entryArgs[vIdx] : undefined;
            const vBytes = typeof raw === 'string' ? utf8ToBin(raw) : raw instanceof Uint8Array ? raw : undefined;
            if (vBytes) {
              if (vBytes.length > 60) {
                valueChunkMints.push({
                  collection: access.collection, slot, digest: sha256Sync(vBytes),
                  chunks: splitValueIntoValueChunks(vBytes),
                });
              }
            } else {
              computedValueChunkCollections.add(access.collection); // derive chunk commitments from the trace
              // A computed UPDATE (present key) mints no NEW node; pin its loop entry EMPTY so the loop-entry
              // derivation does not misread the value-chunk pin's OP_OUTPUTTOKENCOMMITMENT calls as a phantom NEW.
              if (list.has(slot)) computedValueUpdateCollections.add(access.collection);
            }
            // Overwrite GC: if this UPDATE replaces a LONG old value, reclaim its old chunks (old digest tail).
            if (list.has(slot)) {
              const oldTail = list.find(slot)!.value; // len4 ++ [ old value | old digest ]
              if (oldTail.length >= 36 && (oldTail[0] | (oldTail[1] << 8) | (oldTail[2] << 16) | (oldTail[3] << 24)) > 60) {
                valueChunkGc.push({
                  collection: access.collection, slotHex: binToHex(slot), oldDigestHex: binToHex(oldTail.slice(4, 36)),
                });
              }
            }
          }
          continue;
        }

        // Determine key types and values (supports multi-key nested mappings)
        const effectiveKeyTypes = collection.keyTypes ?? [collection.keyType];
        const keyValues: Array<bigint | boolean | Uint8Array> = [];
        let isExpressionKeyPlaceholder = false;
        const keySources = access.keySources
          ?? access.keyParams.map((name) => ({ kind: 'param' as const, paramName: name, canonical: name }));

        for (let ki = 0; ki < keySources.length; ki++) {
          const keySource = keySources[ki];
          if (keySource.kind === 'param') {
            // Existing: extract from function arguments by parameter name
            const keyParamIndex = entryAbiFunction!.inputs.findIndex((inp) => inp.name === keySource.paramName);
            if (keyParamIndex < 0) {
              throw new Error(`Key parameter '${keySource.paramName}' not found in function inputs`);
            }
            let kv = entryArgs[keyParamIndex] as bigint | boolean | Uint8Array | string;
            // Normalize a CashAddress string for an address key to its locking bytecode, matching how the covenant
            // stores it (Argument encoding does the same) - else the search cannot match the on-chain entry.
            if (effectiveKeyTypes[ki] === 'address' && typeof kv === 'string' && kv.includes(':')) {
              kv = addressToLockScript(kv);
            }
            keyValues.push(kv as bigint | boolean | Uint8Array);
          } else if (keySource.kind === 'state') {
            // Auto-resolve from on-chain state
            const stateValue = onChainState.state[keySource.stateVarName!];
            if (stateValue === undefined) {
              throw new Error(
                `Cannot auto-resolve mapping key from state variable '${keySource.stateVarName}'. `
                + 'State variable not found on-chain.',
              );
            }
            keyValues.push(stateValue as bigint | boolean | Uint8Array);
          } else if (keySource.kind === 'stateArrayLast') {
            // `arr[arr.length-1]`: resolve the state array's last element so we co-spend the EXISTING entry
            // for this computed key (else it is treated as a new entry and the old one is left dangling).
            const arr = onChainState.state[keySource.stateArrayName!] as unknown[] | undefined;
            if (!Array.isArray(arr) || arr.length === 0) {
              throw new Error(
                `Cannot resolve mapping key from '${keySource.stateArrayName}[length-1]': array missing or empty.`,
              );
            }
            keyValues.push(arr[arr.length - 1] as bigint | boolean | Uint8Array);
          } else if (keySource.kind === 'constant') {
            // Compile-time-constant uint key (OZ StorageSlot `uint256(SLOT)`): the compiler resolved the value, so
            // match the on-chain entry directly (the covenant re-derives + OP_EQUALVERIFYs the same key).
            keyValues.push(BigInt(keySource.constantValue!));
          } else if (keySource.kind === 'msgSender') {
            // msg.sender / tx.origin key: for a direct call the covenant computes slot = keyToSlot(tx.origin) where
            // tx.origin = the first native P2PKH input's lockscript (emitTxOrigin). The sender funds via
            // _signer.unlockP2PKH(), so slot = keyToSlot(the signer's P2PKH lockscript). A wrong address just fails
            // the on-chain slot==keyToSlot(msg.sender) check (fail-closed).
            if (!this._signer) {
              throw new Error(
                `A '${keySource.senderOp ?? 'msg.sender'}'-keyed sorted mapping requires a Signer: the sender must `
                + 'fund the call via its native P2PKH input (StatefulContract.withSigner / connect a Signer).',
              );
            }
            keyValues.push(addressToLockScript(this._signer.getAddress()));
          } else {
            // Expression: evaluate the compiler's canonical label first (including fixed-array literal indices),
            // then consult an explicit override, and only then use a probe placeholder.
            const entryKeyOverrides = overrides?.entryKeyOverrides;
            const override = entryKeyOverrides?.get(slotIndex);
            const senderExpression = /^(?:call:_msgSender\(\)|nullop:msg\.sender)$/.test(
              keySource.expressionLabel ?? '',
            );
            const senderSigner = this._signer ?? this._logicalNonceSigner;
            const evaluated = senderExpression && senderSigner
              ? addressToLockScript(senderSigner.getAddress())
              : evalComputedKey(keySource.expressionLabel, entryArgs, entryAbiFunction!.inputs);
            if (evaluated !== undefined) {
              const keyType = effectiveKeyTypes[ki];
              keyValues.push(/^(u?int|bigint|enum)/.test(keyType) ? decodeScriptNumber(evaluated) : evaluated);
            } else if (override !== undefined) {
              keyValues.push(override);
            } else {
              // Fallback: type-appropriate placeholder. Auto-derivation will capture
              // the correct commitment from the VM trace.
              isExpressionKeyPlaceholder = true;
              const keyType = effectiveKeyTypes[ki];
              const bytesMatch = keyType.match(/^bytes(\d+)$/);
              if (bytesMatch) {
                keyValues.push(new Uint8Array(parseInt(bytesMatch[1], 10)));
              } else if (keyType === 'bytes' || keyType === 'address') {
                // address is a variable-length locking bytecode (Uint8Array); the VM probe fills the real key
                keyValues.push(new Uint8Array(0));
              } else if (keyType === 'bool') {
                keyValues.push(false);
              } else {
                keyValues.push(0n);
              }
            }
          }
        }
        const keyValue = keyValues[0]; // backward compat: first key

        // Search entry NFT UTXOs for one whose commitment keys match.
        // For expression key placeholders, collect all parseable entries and pick
        // the right one: if exactly 1, use it; if multiple, treat as not found
        // (auto-derivation will resolve via VM trace with the correct entry).
        let matchingUtxo: typeof collectionEntries[0] | undefined;
        const isMultiKey = effectiveKeyTypes.length > 1;
        if (isExpressionKeyPlaceholder) {
          // Expression key: can't match by placeholder value. Try to derive the key
          // by hashing function arguments (common pattern: hash160(pubkey_param)).
          const { hash160: computeHash160 } = await import('@solidcash/utils');
          const derivedKeys: Uint8Array[] = [];
          for (const arg of args) {
            if (arg instanceof Uint8Array && (arg.length === 33 || arg.length === 65)) {
              // Looks like a pubkey -- try hash160
              derivedKeys.push(computeHash160(arg));
            }
          }

          // Try matching with derived keys first
          for (const utxo of collectionEntries) {
            if (!utxo.token?.nft?.commitment) continue;
            try {
              const parsed = isMultiKey
                ? parseEntryCommitmentMultiKey(
                  utxo.token.nft.commitment, effectiveKeyTypes, collection.valueType,
                  stateLayout.structs,
                )
                : parseEntryCommitment(
                  utxo.token.nft.commitment, collection.keyType, collection.valueType,
                  stateLayout.structs,
                );
              const entryKey = isMultiKey ? (parsed as any).keys[0] : (parsed as any).key;
              for (const dk of derivedKeys) {
                if (this._keysMatch(entryKey, dk, effectiveKeyTypes[0])) {
                  matchingUtxo = utxo;
                  // Update the placeholder key with the actual derived key
                  keyValues[0] = dk;
                  isExpressionKeyPlaceholder = false;
                  break;
                }
              }
              if (matchingUtxo) break;
            } catch {
              // Not a valid entry for this collection
            }
          }
          // If no match found: matchingUtxo stays undefined (new entry path).
        } else {
          for (const utxo of collectionEntries) {
            if (!utxo.token?.nft?.commitment) continue;
            try {
              if (isMultiKey) {
                const parsed = parseEntryCommitmentMultiKey(
                  utxo.token.nft.commitment, effectiveKeyTypes, collection.valueType,
                  stateLayout.structs,
                );
                if (parsed.keys.every((k, i) => this._keysMatch(k, keyValues[i], effectiveKeyTypes[i]))) {
                  matchingUtxo = utxo;
                  break;
                }
              } else {
                const parsed = parseEntryCommitment(
                  utxo.token.nft.commitment, collection.keyType, collection.valueType,
                  stateLayout.structs,
                );
                if (this._keysMatch(parsed.key, keyValue, collection.keyType)) {
                  matchingUtxo = utxo;
                  break;
                }
              }
            } catch {
              // Commitment doesn't parse for this collection -- skip
            }
          }
        }


        const exists = !!matchingUtxo;
        const entryUnlocker = createEntryNftUnlocker(
          this.inner, overrides?.blockBase ?? 0, this.categoryId, access.collection,
        );

        entryNfts.push({
          slotIndex,
          collection: access.collection,
          keyType: collection.keyType,
          valueType: collection.valueType,
          keyValue,
          ...(isMultiKey && { keyTypes: effectiveKeyTypes, keyValues }),
          exists,
          utxo: matchingUtxo ? { ...matchingUtxo, unlocker: entryUnlocker } : undefined,
        });
      }

      const batchAliasSkips = new Set<number>();
      const batchAliasOwners = new Map<number, number>();
      for (const entry of entryNfts) {
        const entrySlot = batchTargetSlots.get(entry.slotIndex);
        const candidates = [
          ...(entryAccesses[entry.slotIndex]?.aliasCondDeleteSlot === undefined
            ? [] : [entryAccesses[entry.slotIndex].aliasCondDeleteSlot!]),
          ...(entryAccesses[entry.slotIndex]?.runtimeAliasPriorSlots ?? []),
        ];
        for (const ownerSlot of candidates) {
          const owner = entryNfts.find((candidate) => candidate.slotIndex === ownerSlot);
          const ownerTarget = batchTargetSlots.get(ownerSlot);
          if (owner && entry.collection === owner.collection && entrySlot && ownerTarget
            && binToHex(entrySlot) === binToHex(ownerTarget)) {
            batchAliasSkips.add(entry.slotIndex);
            batchAliasOwners.set(entry.slotIndex, ownerSlot);
            break;
          }
        }
      }
      const batchGuardSlot = entryAbiFunction?.blockLayout?.slots.find(
        (slot) => slot.kind === 'entry' && slot.softDelete,
      )?.slotIndex;
      const batchGuardEntry = batchGuardSlot === undefined ? undefined
        : entryNfts.find((entry) => entry.slotIndex === batchGuardSlot);
      const batchNoOp = !!(batchGuardEntry?.utxo?.token?.nft?.commitment && batchGuardSlot !== undefined
        && binToHex(decodeEntryCommitment(hexToBin(batchGuardEntry.utxo.token.nft.commitment)).slot)
          !== binToHex(batchTargetSlots.get(batchGuardSlot)!));

      // Atomic fixed-write batches: collapse logical accesses that share an original predecessor onto one physical
      // proof input. The block slot of the first logical owner carries that UTXO; later aliases receive funders and
      // point at the owner's relative block offset through __internal__c2BatchProof_N.
      const batchWitnesses: unknown[] = [];
      let batchTrailingCount = 0;
      // Read-only dynamic chunks are preserved first in the trailing output region. Batch planning happens before
      // those witnesses are materialized below, so count them from the same deterministic addresses here.
      let preservedTrailingCount = 0;
      const dynamicWriteSet = new Set(entryAbiFunction?.dynamicWrites ?? []);
      for (const varName of new Set(entryAbiFunction?.dynamicReads ?? [])) {
        if (dynamicWriteSet.has(varName)) continue;
        const variable = stateLayout.variables.find((v) => v.name === varName && v.dynamic);
        if (!variable) continue;
        const address = getDynamicChunkAddress(this.inner, this.categoryId, variable.name, variable.type);
        preservedTrailingCount += (await this.inner.provider.getUtxos(address)).filter((u) =>
          u.token?.category === this.categoryId && u.token?.nft?.capability === 'mutable'
          && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0).length;
      }
      let batchPredOutputBase = (entryAbiFunction?.blockLayout?.blockSize ?? 1) + preservedTrailingCount;
      if (returnEmitOutputIndex < 0
        && entryAbiFunction?.blockLayout?.slots.some((slot) => slot.kind === 'returnEvent')) {
        batchPredOutputBase -= 1;
      }
      for (const batch of entryAbiFunction?.sortedBatchInfo ?? []) {
        const collection = stateLayout.collections.find((c) => c.name === batch.collection);
        if (!collection) throw new Error(`Unknown C2 batch collection: ${batch.collection}`);
        if (batchNoOp) {
          for (const slotIndex of batch.slotIndices) {
            const offset = entryAbiFunction!.blockLayout?.slots.find(
              (slot) => slot.kind === 'entry' && slot.slotIndex === slotIndex,
            )?.offset;
            if (offset === undefined) throw new Error(`C2 no-op slot has no block offset ${slotIndex}`);
            batchWitnesses.push(batchTargetSlots.get(slotIndex)!, BigInt(offset), new Uint8Array(32), -3n);
          }
          continue;
        }
        const collectionEntries = await collectionEntriesFor(collection.signature);
        const list = SortedList.fromUtxos(collectionEntries);
        const writes = batch.slotIndices.filter((slotIndex) => !batchAliasSkips.has(slotIndex)).map((slotIndex) => ({
          slot: batchTargetSlots.get(slotIndex)!, value: new Uint8Array(),
        }));
        if (writes.some((w) => !w.slot)) throw new Error(`C2 batch '${batch.collection}' is missing a target slot`);
        const plan = list.planBatchUpsert(writes);
        const targetValues = new Set(writes.map((w) => bytesToSlotValue(w.slot).toString()));
        const predOutputs = plan.outputs.filter((o) => !targetValues.has(bytesToSlotValue(o.slot).toString()));
        batchPredCommitments.set(batch.collection, predOutputs.map((o) => binToHex(o.commitment)));
        const ownerByUtxo = new Map<string, number>();
        for (const slotIndex of batch.slotIndices) {
          if (batchAliasSkips.has(slotIndex)) {
            const ownerSlot = batchAliasOwners.get(slotIndex);
            if (ownerSlot === undefined) throw new Error(`C2 alias slot has no canonical owner ${slotIndex}`);
            const ownerOffset = entryAbiFunction!.blockLayout?.slots.find(
              (slot) => slot.kind === 'entry' && slot.slotIndex === ownerSlot,
            )?.offset;
            if (ownerOffset === undefined) throw new Error(`C2 alias owner has no block slot ${ownerSlot}`);
            const raw = this._rawC2BatchWitness?.get(slotIndex);
            batchWitnesses.push(raw?.slot ?? batchTargetSlots.get(ownerSlot)!, raw?.proof ?? BigInt(ownerOffset),
              raw?.next ?? new Uint8Array(32), raw?.predOut ?? -2n);
            continue;
          }
          const slot = batchTargetSlots.get(slotIndex)!;
          const proof = list.find(slot) ?? list.predecessorOf(slot);
          const uid = `${proof.utxo.txid}:${proof.utxo.vout}`;
          let owner = ownerByUtxo.get(uid);
          if (owner === undefined) { owner = slotIndex; ownerByUtxo.set(uid, owner); }
          if (owner !== slotIndex) {
            const duplicate = entryNfts.find((e) => e.slotIndex === slotIndex)!;
            duplicate.exists = false;
            duplicate.utxo = undefined;
          }
          const offset = entryAbiFunction!.blockLayout?.slots.find(
            (s) => s.kind === 'entry' && s.slotIndex === owner,
          )?.offset;
          if (offset === undefined) throw new Error(`C2 batch '${batch.collection}' has no block slot ${owner}`);
          const out = plan.outputs.find((o) => bytesToSlotValue(o.slot) === bytesToSlotValue(slot));
          if (!out) throw new Error(`C2 batch '${batch.collection}' has no planned output for slot ${slotIndex}`);
          // Seed the fixed target output in native C2 form (slot || next || empty value). Do not pin it: the
          // derivation probe replaces the empty value with the covenant-computed value. Without this seed, a fresh
          // target falls through StatefulTransactionBuilder's generic default encoder, which is intentionally the
          // old key/value commitment format and cannot encode a 32-byte hashed slot as an int/address key.
          batchTargetPlaceholders.set(slotIndex, binToHex(out.commitment));
          const proofSlot = bytesToSlotValue(proof.slot).toString();
          const predOrdinal = predOutputs.findIndex((o) => bytesToSlotValue(o.slot).toString() === proofSlot);
          const predOut = predOrdinal < 0 ? -1n : BigInt(batchPredOutputBase + predOrdinal);
          const raw = this._rawC2BatchWitness?.get(slotIndex);
          batchWitnesses.push(raw?.slot ?? slot, raw?.proof ?? BigInt(offset),
            raw?.next ?? decodeEntryCommitment(out.commitment).nextKey, raw?.predOut ?? predOut);
        }
        batchPredOutputBase += predOutputs.length;
        batchTrailingCount += predOutputs.length;
      }
      if ((entryAbiFunction?.sortedBatchInfo?.length ?? 0) > 0) batchWitnesses.push(BigInt(batchTrailingCount));
      entryBatchWitnesses = batchWitnesses;
      if (entryAbiFunction === abiFunction) {
        for (const witness of batchWitnesses) finalArgs = [...finalArgs, witness];
      }

      // Append the P5b value witnesses in slotIndex order (SymbolTable injects them right after blockhash, before
      // the iteration params - matching this position in finalArgs). Empty for short/absent, the full value for long.
      // When entry accesses come from a delegated facet, the witnesses belong to the facet ABI and are injected
      // while constructing its unlocker below; the split root ABI intentionally has no such hidden parameters.
      if (abiFunction?.inputs.some((input) => input.name.startsWith('__internal__valueWitness_'))) {
        for (const witness of chunkableReadWitnesses) finalArgs = [...finalArgs, witness];
      }
      entryValueWitnesses = chunkableReadWitnesses;

    }

    // Alias-conditional writes (swap-remove of the LAST key): a write slot whose runtime key equals the aliasing
    // delete slot's key backs the SAME entry NFT. Co-spending it at two input offsets is invalid; the covenant
    // gates the write off, so fund this slot (no co-spend, no output) - the delete slot owns the entry.
    const aliasSkipSlots = new Set<number>();
    if (entryAccesses) {
      for (const e of entryNfts) {
        const aliasSlot = entryAccesses[e.slotIndex]?.aliasCondDeleteSlot;
        if (aliasSlot === undefined) continue;
        const other = entryNfts.find((o) => o.slotIndex === aliasSlot);
        if (other && e.collection === other.collection
          && this._keysMatch(e.keyValue, other.keyValue, e.keyType)) {
          aliasSkipSlots.add(e.slotIndex);
          e.exists = false;
          e.utxo = undefined;
        }
      }
    }

    // Determine which entry slots the compiler expects to be deleted (no output)
    // A delete inside a branch (`if(guard) return; delete m[k];`) is lowered to an existence-gated SOFT-DELETE
    // WRITE by the compiler: the entry keeps an output (the type default when the delete ran, the preserved input
    // otherwise) iff it exists. So a conditional delete slot is a WRITE here, not a hard delete - it is co-spent
    // and recreated with the derived commitment, never dropped. Only an UNCONDITIONAL delete drops the entry.
    const entryDeleteSlots = new Set<number>(aliasSkipSlots);
    const condSoftDeleteSlots = new Set<number>();
    if (entryAccesses) {
      for (let i = 0; i < entryAccesses.length; i++) {
        const softDelete = abiFunction?.blockLayout?.slots.some(
          (s) => s.kind === 'entry' && s.slotIndex === i && s.softDelete,
        );
        if (softDelete) {
          condSoftDeleteSlots.add(i);
        } else if (entryAccesses[i].operations.includes('delete')) {
          entryDeleteSlots.add(i);
        }
      }
    }

    // Compute per-collection entry NFT locking bytecodes for new entries
    const entryNftLockingBytecodes = new Map<string, Uint8Array>();
    if (entryNfts.length > 0 && stateLayout.collections) {
      for (const coll of stateLayout.collections) {
        const collectionHash = computeCollectionHash(coll.signature);
        const covenantScript = buildEntryNftCovenantScript(hexToBin(this.categoryId), collectionHash);
        entryNftLockingBytecodes.set(coll.name, scriptToLockingBytecode(
          covenantScript, this.inner.addressType,
        ));
      }
    }

    // Handle collection iteration: fetch all entry NFTs for iterated collections
    const collectionIterations = abiFunction?.collectionIterations;
    let iterationEntryInputs: UnlockableUtxo[] = [];
    if (collectionIterations && collectionIterations.length > 0 && stateLayout.collections) {
      for (const iter of collectionIterations) {
        const coll = stateLayout.collections.find((c) => c.name === iter.collection);
        if (!coll) throw new Error(`Unknown collection: ${iter.collection}`);

        // Get all entry NFTs for this collection from on-chain state
        const collectionHash = computeCollectionHash(coll.signature);
        const entryCovenantScript = buildEntryNftCovenantScript(hexToBin(this.categoryId), collectionHash);
        const entryAddress = scriptToAddress(entryCovenantScript, this.inner.provider.network, this.inner.addressType, true);
        const utxos = await this.inner.provider.getUtxos(entryAddress);
        const entryUtxos = utxos.filter((u) =>
          u.token?.category === this.categoryId
          && u.token?.nft?.capability === 'mutable'
          && u.token?.nft?.commitment
          && u.token.nft.commitment.length > 0,
        );

        // For a SORTED (enumerable) collection, iteration is a trustless LINKAGE walk: the covenant co-spends
        // the HEAD sentinel (slot 0) and follows nextKey to the tail, proving completeness by the chain. So
        // co-spend the HEAD FIRST, then the entries in ASCENDING slot order (the chain order). A plain
        // (non-sorted) collection keeps the caller-window order.
        let orderedUtxos = entryUtxos;
        let sortedRest: { slot: Uint8Array }[] = [];
        if (coll.sorted) {
          const list = SortedList.fromUtxos(entryUtxos);
          const head = list.all.find((e) => bytesToSlotValue(e.slot) === 0n);
          if (!head) throw new Error(`Enumerable mapping '${coll.name}' is missing its HEAD sentinel (slot 0)`);
          const rest = list.all.filter((e) => bytesToSlotValue(e.slot) !== 0n); // list.all is already ascending
          orderedUtxos = [head.utxo, ...rest.map((e) => e.utxo)];
          sortedRest = rest;
        }

        // Add as read-only inputs
        for (const utxo of orderedUtxos) {
          const unlocker = createReadOnlyEntryNftUnlocker(this.inner, this.categoryId, coll.name);
          iterationEntryInputs.push({ ...utxo, unlocker });
        }

        // Append _collectionIterCount_<N> argument (the iteration run size = HEAD + entries when sorted; used for
        // block-layout offset accounting, not as the linkage loop bound - the chain self-terminates at the tail).
        finalArgs = [...finalArgs, BigInt(orderedUtxos.length)];

        // KEYS/ENTRIES over a sorted mapping: append the keys blob (caller-supplied via setIterationKeys, ordered
        // to the ascending chain so blob[i*W:] is the key for entry base+1+i). The covenant splits keyWidth bytes
        // per entry and verifies keyToSlot(key)==slot; a wrong key hashes elsewhere and a missing entry breaks the
        // chain, so both revert.
        if (coll.sorted && iter.mode !== 'values') {
          const rawOverride = this._rawIterationKeysBlob?.get(coll.name);
          if (rawOverride) {
            finalArgs = [...finalArgs, rawOverride]; // test hook: verbatim blob (malicious-spender simulation)
          } else {
            const callerKeys = this._iterationKeys?.get(coll.name);
            if (!callerKeys) {
              throw new Error(`Iterating keys/entries of sorted enumerable mapping '${coll.name}' requires the keys: `
                + `call setIterationKeys('${coll.name}', [...]) before the iteration (the raw key is not on-chain).`);
            }
            const keyBySlot = new Map<string, Uint8Array>();
            for (const k of callerKeys) keyBySlot.set(binToHex(keyToSlot(k)), k);
            // Length-prefixed blob: each entry's key as (1-byte length ++ key bytes), in ascending-chain order.
            // Supports variable-width keys (int, address) as well as bytesN; the covenant reads the prefix.
            const parts: Uint8Array[] = [];
            for (const e of sortedRest) {
              const k = keyBySlot.get(binToHex(e.slot));
              if (!k) throw new Error(`No supplied key hashes to entry slot ${binToHex(e.slot)} in '${coll.name}'`);
              if (k.length > 255) throw new Error(`Key too long to length-prefix (${k.length} B) in '${coll.name}'`);
              parts.push(Uint8Array.from([k.length]), k);
            }
            const total = parts.reduce((n, p) => n + p.length, 0);
            const blob = new Uint8Array(total);
            let off = 0;
            for (const p of parts) { blob.set(p, off); off += p.length; }
            finalArgs = [...finalArgs, blob];
          }
        }
      }
    }

    // Persisted dynamic-storage reads: co-spend the var's chunks as read-only trailing inputs (ordered by
    // chunkIndex so input blockSize+i is chunk i), preserved as outputs. Reuses iterationEntryInputs.
    const dynamicReads = abiFunction?.dynamicReads;
    const dynamicWriteNames = abiFunction?.dynamicWrites ?? [];
    if (dynamicReads && dynamicReads.length > 0) {
      for (const varName of dynamicReads) {
        // Read-modify-write var: its chunks are co-spent below by the write path (in chunkIndex order, so
        // the read loop still reads chunk i at blockSize+i). Skip here to avoid co-spending the same UTXO twice.
        if (dynamicWriteNames.includes(varName)) continue;
        const dynVar = (stateLayout.variables ?? []).find((v) => v.name === varName && v.dynamic);
        if (!dynVar) continue;
        const chunkAddr = getDynamicChunkAddress(this.inner, this.categoryId, dynVar.name, dynVar.type);
        const utxos = await this.inner.provider.getUtxos(chunkAddr);
        const chunks = utxos
          .filter((u) => u.token?.category === this.categoryId
            && u.token?.nft?.capability === 'mutable'
            && u.token?.nft?.commitment && u.token.nft.commitment.length > 0)
          .map((u) => ({ utxo: u, chunkIndex: parseChunkCommitment(u.token!.nft!.commitment).chunkIndex }))
          .sort((a, b) => a.chunkIndex - b.chunkIndex);
        for (const { utxo } of chunks) {
          const unlocker = createReadOnlyDynamicChunkUnlocker(
            this.inner, overrides?.blockBase ?? 0, this.categoryId, dynVar.name, dynVar.type,
          );
          iterationEntryInputs.push({ ...utxo, unlocker });
        }
      }
    }

    // C2 diff-key INSERT loop derivation: `for(i<arr.length) m[...fixed][arr[i]] = v`. Co-spend the N bracketing
    // predecessors (iterationEntryInputs, in loop order -> input[master+blockSize+i]) and emit N interleaved (P', NEW)
    // commitment pairs at the trailing loop-entry outputs (output[master+blockSize+2i / +2i+1]). Both are known
    // EXACTLY from the off-chain sorted list (SortedList.planInsert); the covenant pins them, so no trace derivation.
    // Fail closed (throw) when a key is already present (update-in-loop) or two keys share a predecessor (same-gap).
    const sortedLoopCommitments = new Map<string, string[]>();
    const insertLoopPredecessors: UnlockableUtxo[] = [];
    for (const info of abiFunction?.sortedInsertLoopInfo ?? []) {
      const collection = (stateLayout.collections ?? []).find((c) => c.name === info.collection);
      if (!collection) continue;
      const entryAddr = getEntryNftAddress(this.inner, this.categoryId, collection.signature);
      const entries = (await this.inner.provider.getUtxos(entryAddr)).filter((u) => (
        u.token?.category === this.categoryId && u.token?.nft?.capability === 'mutable'
        && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0
      ));
      const list = SortedList.fromUtxos(entries);
      const argOf = (name: string | undefined): unknown => {
        if (!name) return undefined;
        const i = abiFunction!.inputs.findIndex((p) => p.name === name);
        return i >= 0 ? args[i] : undefined;
      };
      const keyTypes = collection.keyTypes ?? [collection.keyType];
      const encKey = (v: unknown, keyType: string): Uint8Array => (
        keyType === 'address' && typeof v === 'string' && v.includes(':') ? addressToLockScript(v)
          : typeof v === 'bigint' ? bigIntToVmNumber(v)
            : v instanceof Uint8Array ? v
              : typeof v === 'boolean' ? bigIntToVmNumber(v ? 1n : 0n)
                : bigIntToVmNumber(BigInt(v as string)));
      const fixedBins = info.fixedKeyParams.map((p, i) => encKey(argOf(p), keyTypes[i] ?? collection.keyType));
      const varyType = keyTypes[info.fixedKeyParams.length] ?? collection.keyType;
      let arr = argOf(info.varyingArrayParam);
      if (!Array.isArray(arr)) continue;
      let valueTail: Uint8Array;
      if (info.valueBool !== undefined) valueTail = info.valueBool ? new Uint8Array([1]) : new Uint8Array(0);
      else {
        const vv = argOf(info.valueParam);
        valueTail = typeof vv === 'boolean' ? (vv ? new Uint8Array([1]) : new Uint8Array(0))
          : typeof vv === 'bigint' ? bigIntToVmNumber(vv) : vv instanceof Uint8Array ? vv : new Uint8Array(0);
      }
      // RANGE-SPLICE: all N keys must fall in ONE gap (share the bracketing predecessor P). Co-spend P once and mint
      // the sorted chain P' -> k1 -> k2 -> .. -> kN -> P.oldNext (P' = P re-pointed to the smallest new key). N+1
      // trailing entry outputs, ONE predecessor input. The covenant verifies the chain is sorted + bracketed by P.
      let slots = (arr as unknown[]).map((elem) => keyToSlotMulti([...fixedBins, encKey(elem, varyType)]));
      if (slots.length === 0) continue;
      // The covenant walks the linked outputs in ascending slot order and now also proves each node's slot equals
      // H(the runtime key). Reorder the invariant-value key array itself so source-loop evaluation follows that same
      // order. This is semantics-preserving because every iteration assigns the same value and keys are rejected when
      // duplicated or already present. Write through to finalArgs so the unlocking bytecode carries this exact order.
      const order = slots.map((_, i) => i).sort((a, b) => (
        bytesToSlotValue(slots[a]) < bytesToSlotValue(slots[b]) ? -1 : 1
      ));
      arr = order.map((i) => (arr as unknown[])[i]);
      slots = order.map((i) => slots[i]);
      const arrIdx = abiFunction!.inputs.findIndex((p) => p.name === info.varyingArrayParam);
      if (arrIdx >= 0) { args[arrIdx] = arr; finalArgs[arrIdx] = arr; }
      const sorted = slots;
      for (let i = 1; i < sorted.length; i++) {
        if (bytesToSlotValue(sorted[i]) === bytesToSlotValue(sorted[i - 1])) throw new Error(`C2 insert loop ${info.collection}: duplicate key`);
      }
      for (const s of sorted) if (list.has(s)) throw new Error(`C2 insert loop ${info.collection}: key already present (update-in-loop unsupported)`);
      const P = list.predecessorOf(sorted[0]);
      const pNextV = bytesToSlotValue(P.nextKey);
      const pSlotV = bytesToSlotValue(P.slot);
      for (const s of sorted) {
        const sv = bytesToSlotValue(s);
        if (!(pSlotV < sv && (pNextV === 0n || sv < pNextV))) {
          throw new Error(`C2 insert loop ${info.collection}: keys span multiple gaps (range-splice needs one gap)`);
        }
      }
      const wUnlocker = createEntryNftUnlocker(
        this.inner, overrides?.blockBase ?? 0, this.categoryId, info.collection,
      );
      const commitments: string[] = [binToHex(encodeEntryCommitment(P.slot, sorted[0], P.value))]; // P'
      for (let j = 0; j < sorted.length; j++) {
        const next = j < sorted.length - 1 ? sorted[j + 1] : P.nextKey;
        commitments.push(binToHex(encodeEntryCommitment(sorted[j], next, valueTail)));
      }
      insertLoopPredecessors.push({ ...P.utxo, unlocker: wUnlocker }); // ONE bracketing predecessor
      sortedLoopCommitments.set(info.collection, commitments);
    }

    // C2 per-iteration UPDATE loop `for(i) m[k[i]] += v[i]` (multitransfer credit to EXISTING recipients): co-spend
    // each k[i]'s existing entry at input[master+blockSize+i] and mint its updated commitment slot|next|(old op v[i])
    // at output[master+blockSize+i]. Both known EXACTLY off-chain (SortedList.find + arithmetic) - the covenant pins
    // them. A recipient with NO existing entry throws (insert-in-loop is a separate covenant); the shared v[] param
    // ties the credit total to the debit so supply is conserved.
    for (const info of abiFunction?.sortedUpsertLoopInfo ?? []) {
      const collection = (stateLayout.collections ?? []).find((c) => c.name === info.collection);
      if (!collection) continue;
      const entryAddr = getEntryNftAddress(this.inner, this.categoryId, collection.signature);
      const entries = (await this.inner.provider.getUtxos(entryAddr)).filter((u) => (
        u.token?.category === this.categoryId && u.token?.nft?.capability === 'mutable'
        && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0
      ));
      const list = SortedList.fromUtxos(entries);
      const argOf = (name: string | undefined): unknown => {
        if (!name) return undefined;
        const i = abiFunction!.inputs.findIndex((p) => p.name === name);
        return i >= 0 ? args[i] : undefined;
      };
      const keyTypes = collection.keyTypes ?? [collection.keyType];
      const encKey = (v: unknown, keyType: string): Uint8Array => (
        keyType === 'address' && typeof v === 'string' && v.includes(':') ? addressToLockScript(v)
          : typeof v === 'bigint' ? bigIntToVmNumber(v)
            : v instanceof Uint8Array ? v
              : typeof v === 'boolean' ? bigIntToVmNumber(v ? 1n : 0n)
                : bigIntToVmNumber(BigInt(v as string)));
      const fixedBins = info.fixedKeyParams.map((p, i) => encKey(argOf(p), keyTypes[i] ?? collection.keyType));
      const varyType = keyTypes[info.fixedKeyParams.length] ?? collection.keyType;
      let keysArr = argOf(info.varyingArrayParam) as unknown[];
      const isDelete = info.op === 'delete';
      // A loop-INVARIANT value (fixed-amount airdrop `+= amount` / batch-set-const `= 100`): the same amount for every
      // key, from a scalar param arg or an int literal. Otherwise the value is the per-key array valsArr[i].
      const toBig = (v: unknown): bigint => (typeof v === 'bigint' ? v : BigInt(v as number | string));
      // A rawbytes VALUE (whole bytes/string/array/bytesN param `m[k[i]] = a`): the covenant stores the value tail
      // (len4 ++ value inline for a chunkable type, verbatim for bytesN); the SDK mirrors it. Only op==='set' reaches
      // here for rawbytes (the guard gates RMW/const to int). scalarTail is the invariant value's on-chain bytes.
      // On-chain value bytes for a rawbytes value: the inline tail len4 ++ value (chunkable type) or verbatim (bytesN/
      // address). Shared by the invariant `= a` and the per-key `= vs[i]` forms; >60 B fails closed (chunked-in-loop is
      // unsupported - the covenant reverts too).
      const encodeValueTail = (v: unknown): Uint8Array => {
        const vB = v instanceof Uint8Array ? v
          : typeof v === 'string' ? utf8ToBin(v)
            : encodePushdataValue(v as StateValue, collection.valueType, stateLayout.structs);
        if (!collection.chunkableValue) return vB; // fixed rawbytes (bytesN/address): stored verbatim, no tail
        if (vB.length > 60) {
          throw new Error(`C2 array-value loop '${info.collection}': value is ${vB.length} B > 60 (a chunked value in`
            + ' a loop is unsupported - the covenant fails closed at runtime).');
        }
        const len4 = new Uint8Array(4); new DataView(len4.buffer).setUint32(0, vB.length, true);
        return new Uint8Array([...len4, ...vB]);
      };
      const rawScalar = !isDelete && info.valueScalarParam !== undefined ? argOf(info.valueScalarParam) : undefined;
      const isRawbytesVal = rawScalar !== undefined
        && typeof rawScalar !== 'bigint' && typeof rawScalar !== 'boolean' && typeof rawScalar !== 'number';
      const scalarTail: Uint8Array | undefined = isRawbytesVal ? encodeValueTail(rawScalar) : undefined;
      let scalarAmt: bigint | undefined;
      if (!isRawbytesVal && !isDelete && info.valueScalarParam !== undefined) {
        scalarAmt = toBig(argOf(info.valueScalarParam));
      } else if (!isRawbytesVal && !isDelete && info.valueConst !== undefined) scalarAmt = BigInt(info.valueConst);
      const perKey = !isRawbytesVal && !isDelete && scalarAmt === undefined;
      let valsArr = perKey ? argOf(info.valueArrayParam) : undefined;
      if (Array.isArray(valsArr) && info.valueArrayOffset !== undefined) {
        valsArr = (valsArr as unknown[]).map((v) => toBig(v) + BigInt(info.valueArrayOffset!));
      }
      // Per-key RAWBYTES value `m[k[i]] = vs[i]` (vs a bytes[]/array-of-array param): each vs[i] is committed as its own
      // inline tail. Detected from the arg (an empty array does no work). op is always 'set' here (the guard gates it).
      const perKeyRawbytes = perKey && Array.isArray(valsArr) && (valsArr as unknown[]).length > 0
        && ((): boolean => {
          const v0 = (valsArr as unknown[])[0];
          return !(typeof v0 === 'bigint' || typeof v0 === 'number' || typeof v0 === 'boolean');
        })();
      // Value bytes for a commitment: the per-key/invariant rawbytes tail (already a Uint8Array), else the int as a
      // minimal VM number.
      const commitValue = (nv: bigint | Uint8Array): Uint8Array =>
        nv instanceof Uint8Array ? nv : (scalarTail ?? bigIntToVmNumber(nv));
      if (!Array.isArray(keysArr) || (perKey && !Array.isArray(valsArr))) continue;
      if (perKey && (valsArr as unknown[]).length !== keysArr.length) {
        throw new Error(`C2 upsert loop ${info.collection}: recipients/amounts length mismatch`);
      }
      const foldActive = info.op === '+' || info.op === 'set'; // crediting loops defer + fold (covenant pendActive)
      // DUPLICATE RECIPIENT: the same key listed 2+ times. Solidity ACCUMULATES for += / -= ([a,a],[10,20] -> a += 30),
      // takes the LAST for = ([a,a],[10,20] -> a = 20), and delete is idempotent. Since the covenant co-spends one
      // entry per recipient, combine duplicates into ONE entry (co-spent once) with the merged amount, BEFORE the
      // self-transfer filter / reorder. For += the merged sum equals the original sum, so a coexisting `bal[msg.sender]
      // -= amounts[i]` debit is unchanged. Scalar/const-value: a `set` (= amount / = 100) duplicate is idempotent, so
      // dedupe (keep one); a scalar `+=` duplicate is handled by the covenant's isDup accumulate (below - the entry is
      // co-spent once and the scalar applied per occurrence), so it is NOT pre-merged here; a scalar `-=` duplicate
      // stays fail-closed (`-=` has no pending-defer).
      if (Array.isArray(keysArr) && keysArr.length > 1 && (isDelete || perKey || info.op === 'set')) {
        const kArr = keysArr as unknown[];
        const slotHexes = kArr.map((k) => binToHex(keyToSlotMulti([...fixedBins, encKey(k, varyType)])));
        if (slotHexes.some((h, i) => slotHexes.indexOf(h) !== i)) {
          const seen = new Set<string>();
          const order: number[] = [];
          const merged = new Map<string, unknown>();
          const vArr = perKey ? (valsArr as unknown[]) : undefined;
          slotHexes.forEach((h, i) => {
            if (!seen.has(h)) { seen.add(h); order.push(i); }
            // 'set' is last-wins (store the value VERBATIM - a rawbytes value has no toBig); '+'/'-' accumulate (int).
            if (vArr) merged.set(h, info.op === 'set' ? vArr[i] : toBig(merged.get(h) ?? 0n) + toBig(vArr[i]));
          });
          keysArr = order.map((i) => kArr[i]);
          const recipIdx = abiFunction!.inputs.findIndex((p) => p.name === info.varyingArrayParam);
          if (recipIdx >= 0) { args[recipIdx] = keysArr; finalArgs[recipIdx] = keysArr; }
          if (vArr) {
            valsArr = order.map((i) => merged.get(slotHexes[i])!);
            const amtIdx = abiFunction!.inputs.findIndex((p) => p.name === info.valueArrayParam);
            if (amtIdx >= 0 && info.valueArrayParam !== info.varyingArrayParam) {
              args[amtIdx] = valsArr; finalArgs[amtIdx] = valsArr;
            }
          }
        }
      }
      // SCALAR `+=` / `-=` DUPLICATE: a fixed-amount airdrop/debit (`+= amount` / `-= amount`) has no per-key array to
      // merge, so GROUP a duplicated key's occurrences adjacent (stable, by first occurrence). The covenant's isDup
      // accumulate then applies the scalar once per occurrence to the single co-spent entry (the SDK accumulates it into
      // the pending commitment in the loop below). Order-independent (accumulates); scalar `set` is deduped above.
      if ((info.op === '+' || info.op === '-') && !perKey && !isDelete && Array.isArray(keysArr) && keysArr.length > 1) {
        const kArr = keysArr as unknown[];
        const slotHexes = kArr.map((k) => binToHex(keyToSlotMulti([...fixedBins, encKey(k, varyType)])));
        if (slotHexes.some((h, i) => slotHexes.indexOf(h) !== i)) {
          const groups = new Map<string, number[]>();
          const firstOrder: string[] = [];
          slotHexes.forEach((h, i) => {
            if (!groups.has(h)) { groups.set(h, []); firstOrder.push(h); }
            groups.get(h)!.push(i);
          });
          keysArr = firstOrder.flatMap((h) => groups.get(h)!).map((i) => kArr[i]);
          const recipIdx = abiFunction!.inputs.findIndex((p) => p.name === info.varyingArrayParam);
          if (recipIdx >= 0) { args[recipIdx] = keysArr; finalArgs[recipIdx] = keysArr; }
        }
      }
      // SELF-TRANSFER: a recipient == the debited msg.sender nets out (`bal[msg.sender] -= a; bal[msg.sender] += a`).
      // Since the debit and the credit share amounts[i], dropping that entry from recipients+amounts leaves the debit
      // summing (total - own) and never credits msg.sender separately - the identical net, with msg.sender co-spent
      // ONCE (the debit) instead of twice. Solidity allows a self-transfer in a batch; this matches it.
      if (foldActive && this._signer && Array.isArray(keysArr) && keysArr.length > 0) {
        const debitE = entryNfts.find((e) => e.collection === info.collection && e.exists && e.utxo);
        let senderKey: Uint8Array | null = null;
        try { senderKey = addressToLockScript(this._signer.getAddress()); } catch { senderKey = null; }
        if (debitE && senderKey) {
          const senderSlotHex = binToHex(keyToSlotMulti([...fixedBins, senderKey]));
          const kArr = keysArr as unknown[];
          const keepIdx: number[] = [];
          kArr.forEach((k, i) => {
            if (binToHex(keyToSlotMulti([...fixedBins, encKey(k, varyType)])) !== senderSlotHex) keepIdx.push(i);
          });
          if (keepIdx.length < kArr.length) {
            keysArr = keepIdx.map((i) => kArr[i]);
            const recipIdx = abiFunction!.inputs.findIndex((p) => p.name === info.varyingArrayParam);
            if (recipIdx >= 0) { args[recipIdx] = keysArr; finalArgs[recipIdx] = keysArr; }
            if (perKey && Array.isArray(valsArr)) {
              const vArr = valsArr as unknown[];
              valsArr = keepIdx.map((i) => vArr[i]);
              const amtIdx = abiFunction!.inputs.findIndex((p) => p.name === info.valueArrayParam);
              if (amtIdx >= 0 && info.valueArrayParam !== info.varyingArrayParam) {
                args[amtIdx] = valsArr; finalArgs[amtIdx] = valsArr;
              }
            }
          }
        }
      }
      // CASE (b) ADJACENCY REORDER: the covenant folds a new recipient into a credited predecessor P only when P is
      // processed IMMEDIATELY before it. The multiTransfer result is order-independent, so reorder recipients+amounts
      // (as a PAIR, preserving each recipient's amount) to place each such new recipient right after P. Chains /
      // two-in-gap can't be made adjacent and stay fail-closed. Crediting loops only (foldActive); write back to args
      // so the encoded tx argument matches the commitment order the covenant verifies.
      if (foldActive && Array.isArray(keysArr) && keysArr.length > 1) {
        const kArr = keysArr as unknown[];
        const slotsB = kArr.map((k) => keyToSlotMulti([...fixedBins, encKey(k, varyType)]));
        const isUpd = slotsB.map((s) => !!list.find(s));
        const updBySlot = new Map<string, number>();
        slotsB.forEach((s, i) => { if (isUpd[i]) updBySlot.set(binToHex(s), i); });
        // Group inserts by their predecessor slot (a recipient-update, an untouched entry, or the HEAD sentinel). Each
        // such gap forms a chain that the covenant walks in ASCENDING order, so its inserts must be consecutive +
        // ascending in the tx. A case-b gap (predecessor is a credited update) additionally sits right after that update.
        const insertsByPred = new Map<string, number[]>();
        slotsB.forEach((s, i) => {
          if (isUpd[i]) return;
          const ph = binToHex(list.predecessorOf(s).slot);
          if (!insertsByPred.has(ph)) insertsByPred.set(ph, []);
          insertsByPred.get(ph)!.push(i);
        });
        // Reorder only when it changes something: a gap with >1 insert (chain) or an insert bracketed by a credited
        // update (case-b adjacency). Result is order-independent, so this is transparent.
        let needsReorder = false;
        for (const [ph, arr] of insertsByPred) if (arr.length > 1 || updBySlot.has(ph)) needsReorder = true;
        if (needsReorder) {
          for (const [, arr] of insertsByPred) {
            arr.sort((a, b) => (bytesToSlotValue(slotsB[a]) < bytesToSlotValue(slotsB[b]) ? -1 : 1));
          }
          const order: number[] = [];
          const placed = new Set<number>();
          const emitGap = (ph: string): void => {
            for (const r of insertsByPred.get(ph) ?? []) if (!placed.has(r)) { order.push(r); placed.add(r); }
          };
          for (let i = 0; i < kArr.length; i++) {
            if (placed.has(i)) continue;
            if (isUpd[i]) {
              order.push(i); placed.add(i); emitGap(binToHex(slotsB[i])); continue;
            } // its gap's inserts follow
            const ph = binToHex(list.predecessorOf(slotsB[i]).slot);
            if (updBySlot.has(ph)) continue; // an insert placed via its credited-update predecessor
            emitGap(ph); // untouched / HEAD gap: place the whole ascending group here
          }
          for (let i = 0; i < kArr.length; i++) if (!placed.has(i)) { order.push(i); placed.add(i); } // safety net
          keysArr = order.map((i) => kArr[i]);
          // Write the reordered arrays to BOTH args (read by other derivations) AND finalArgs (already copied from
          // args by the msg.sender/synthetic injection above - it builds the master unlocker, so the ENCODED tx
          // argument must carry the same order the commitments were built in, else the covenant OP_VERIFY fails).
          const recipIdx = abiFunction!.inputs.findIndex((p) => p.name === info.varyingArrayParam);
          if (recipIdx >= 0) { args[recipIdx] = keysArr; finalArgs[recipIdx] = keysArr; }
          if (perKey && Array.isArray(valsArr)) {
            const vArr = valsArr as unknown[];
            valsArr = order.map((i) => vArr[i]);
            const amtIdx = abiFunction!.inputs.findIndex((p) => p.name === info.valueArrayParam);
            if (amtIdx >= 0 && info.valueArrayParam !== info.varyingArrayParam) {
              args[amtIdx] = valsArr; finalArgs[amtIdx] = valsArr;
            }
          }
        }
      }
      const wUnlocker = createEntryNftUnlocker(
        this.inner, overrides?.blockBase ?? 0, this.categoryId, info.collection,
      );
      // Commitments in CUMULATIVE OUTPUT order (matching the covenant's outCounter): an UPDATE contributes 1 (the
      // updated node), an INSERT contributes 2 (P' = the re-pointed predecessor, then NEW). One co-spent input per
      // recipient. cospent = co-spent UTXO ids for conflict detection (an entry / predecessor can be co-spent once).
      const commitments: string[] = [];
      const seenSlots = new Set<string>();
      const cospent = new Set<string>();
      const uidOf = (u: { txid: string; vout: number }): string => `${u.txid}:${u.vout}`;
      // Pre-seed with this collection's FIXED (non-loop) entry co-spends - notably the cached `bal[msg.sender] -=`
      // DEBIT write. If a NEW recipient's bracketing predecessor is one of those already-co-spent entries, co-spending
      // it again would make an invalid duplicate input; detect it here and fail closed with a clear message (else the
      // tx builder throws an opaque "Duplicate input detected").
      for (const e of entryNfts) {
        if (e.collection === info.collection && e.exists && e.utxo) cospent.add(uidOf(e.utxo));
      }
      // MSG.SENDER MERGE: the single fixed (non-loop) co-spent entry of this collection is the cached msg.sender DEBIT.
      // A new recipient whose bracketing predecessor IS that entry re-points the debit's single co-spend (the covenant
      // does it via the loop's re-point register) instead of co-spending it again - so we mint only the NEW node.
      const debitEntry = entryNfts.find((e) => e.collection === info.collection && e.exists && e.utxo);
      let mergedNewCount = 0;
      // CASE (b) FOLD: mirror the covenant's pending-defer register. On a crediting loop (+/set) each UPDATE defers its
      // mint; the NEXT recipient, if it is a NEW node bracketed by that update, re-points the update's commitment in
      // place + appends its own NEW node (the predecessor is co-spent ONCE). lastDeferred = the immediately-prior
      // update, or null. Requires adjacency (predecessor processed right before the new key) - the reorder above makes
      // that hold for the common case; anything it can't (chains / two-in-gap) fails closed.
      // newVal carries a rawbytes value's tail (Uint8Array) or an int (bigint); arithmetic paths below are int-only (the
      // guard gates rawbytes to op==='set', which never adds/subtracts).
      type DeferredEntry = {
        uid: string; commitIndex: number; slot: Uint8Array;
        newVal: bigint | Uint8Array; oldNext: Uint8Array;
      };
      let lastDeferred: DeferredEntry | null = null;
      for (let i = 0; i < keysArr.length; i++) {
        const slot = keyToSlotMulti([...fixedBins, encKey(keysArr[i], varyType)]);
        const slotHex = binToHex(slot);
        const amt: bigint | Uint8Array = perKeyRawbytes ? encodeValueTail((valsArr as unknown[])[i])
          : isRawbytesVal ? 0n : isDelete ? 0n : scalarAmt !== undefined ? scalarAmt : toBig((valsArr as unknown[])[i]);
        if (seenSlots.has(slotHex)) {
          // SCALAR `+=` / `-=` DUPLICATE: the grouping above made this adjacent to its first occurrence, which is the
          // pending (lastDeferred). Accumulate the scalar into that entry's commitment - the covenant's isDup does the
          // same, co-spending the entry only once. (per-key / scalar-set / delete duplicates were already merged/deduped.)
          if ((info.op === '+' || info.op === '-') && !perKey && !isDelete && lastDeferred && binToHex(lastDeferred.slot) === slotHex) {
            lastDeferred.newVal = (lastDeferred.newVal as bigint) + (info.op === '-' ? -(amt as bigint) : (amt as bigint));
            commitments[lastDeferred.commitIndex] =
              binToHex(encodeEntryCommitment(lastDeferred.slot, lastDeferred.oldNext, commitValue(lastDeferred.newVal)));
            continue;
          }
          throw new Error(`C2 upsert loop ${info.collection}: duplicate recipient (each entry can be co-spent once)`);
        }
        seenSlots.add(slotHex);
        const entry = list.find(slot);
        if (entry) {
          // UPDATE (existing recipient): co-spend the entry, mint the updated value ('delete' -> the type default 0).
          if (cospent.has(uidOf(entry.utxo))) {
            throw new Error(`C2 upsert loop ${info.collection}: recipient ${i}'s entry is already co-spent this tx`);
          }
          cospent.add(uidOf(entry.utxo));
          const oldVal = vmNumberToBigInt(entry.value, { requireMinimalEncoding: false }) as bigint;
          const newVal: bigint | Uint8Array = isDelete ? 0n : info.op === 'set' ? amt
            : info.op === '-' ? oldVal - (amt as bigint) : oldVal + (amt as bigint);
          insertLoopPredecessors.push({ ...entry.utxo, unlocker: wUnlocker });
          // Record this update as the pending-defer target BEFORE pushing its (initially normal) commitment, so a
          // following bracketed new key can re-point it (foldActive) OR a duplicate can accumulate into it (also `-`,
          // whose covenant pending-defer is active for duplicates even though it never inserts/folds).
          if (foldActive || info.op === '-') {
            lastDeferred = {
              uid: uidOf(entry.utxo), commitIndex: commitments.length,
              slot: entry.slot, newVal, oldNext: entry.nextKey,
            };
          }
          commitments.push(binToHex(encodeEntryCommitment(entry.slot, entry.nextKey, commitValue(newVal))));
        } else {
          // INSERT (a NEW recipient): co-spend the bracketing predecessor (from the ORIGINAL list) + mint P' then NEW.
          // 'delete'/'-' on an absent key fail closed (nothing to nullify/debit).
          if (info.op === '-' || isDelete) {
            throw new Error(`C2 upsert loop ${info.collection}: cannot ${isDelete ? 'delete' : 'debit'} key ${i} - `
              + 'it has no entry');
          }
          const pred = list.predecessorOf(slot);
          const deferred: DeferredEntry | null = lastDeferred; // the covenant's pending; an insert never defers
          lastDeferred = null;
          // FOLD + CHAIN (checked BEFORE the debit-merge): is this new key in the DEFERRED entry's gap? Geometric check
          // (d.slot < slot < d.oldNext, 0 = +inf) - mirrors the covenant's pending in-gap flush. deferred is an UPDATE
          // predecessor (case b), a chained NEW node, OR a debit-merged R1 (2+ new in the debit's own gap). Re-point the
          // deferred entry's commitment in place, append this new node, and DEFER IT so a further key can chain. (The
          // explicit `d` / `chained` types break the self-referential inference the lastDeferred re-assignment trips.)
          if (foldActive && deferred) {
            const d: DeferredEntry = deferred;
            const sV = bytesToSlotValue(slot);
            const pV = bytesToSlotValue(d.slot);
            const nV = bytesToSlotValue(d.oldNext); // 0 = +inf
            if (pV < sV && (nV === 0n || sV < nV)) {
              commitments[d.commitIndex] = binToHex(encodeEntryCommitment(d.slot, slot, commitValue(d.newVal)));
              const newCommitIndex = commitments.length;
              commitments.push(binToHex(encodeEntryCommitment(slot, d.oldNext, commitValue(amt)))); // NEW
              const chained: DeferredEntry = { uid: '', commitIndex: newCommitIndex, slot, newVal: amt, oldNext: d.oldNext };
              lastDeferred = chained;
              continue;
            }
          }
          if (debitEntry && uidOf(debitEntry.utxo as { txid: string; vout: number }) === uidOf(pred.utxo)) {
            // MERGE with the debit (R1): the covenant re-points the debit's output to R1 (via the register) and DEFERS
            // R1, so a further new key in the debit's gap chains off it (handled by the fold check above). Record R1 as
            // the pending. The mergedNewCount guard fails closed on a SECOND, non-chainable debit-merge (unreachable
            // after the gap-based reorder places the debit gap's inserts consecutively + ascending).
            if (mergedNewCount >= 1) {
              throw new Error(`C2 upsert loop ${info.collection}: two non-adjacent new recipients in the debited sender's `
                + 'gap - split into separate transactions.');
            }
            mergedNewCount += 1;
            const mCommitIndex = commitments.length;
            commitments.push(binToHex(encodeEntryCommitment(slot, pred.nextKey, commitValue(amt)))); // NEW = 0 + amt (R1)
            lastDeferred = { uid: '', commitIndex: mCommitIndex, slot, newVal: amt, oldNext: pred.nextKey };
            continue;
          }
          if (cospent.has(uidOf(pred.utxo))) {
            throw new Error(`C2 upsert loop ${info.collection}: new recipient ${i}'s bracketing predecessor is already `
              + 'co-spent in this tx (a non-adjacent credited recipient, or another new recipient in the '
              + 'same gap). Reorder so the predecessor is credited immediately before, or split into separate transactions.');
          }
          cospent.add(uidOf(pred.utxo));
          insertLoopPredecessors.push({ ...pred.utxo, unlocker: wUnlocker });
          commitments.push(binToHex(encodeEntryCommitment(pred.slot, slot, pred.value)));           // P' (re-pointed)
          const uCommitIndex = commitments.length;
          commitments.push(binToHex(encodeEntryCommitment(slot, pred.nextKey, commitValue(amt)))); // NEW = 0 + amt
          // DEFER this new node (mirrors the covenant's chain-defer) so a further new key in this same UNTOUCHED / HEAD
          // gap chains off it - a fresh-map airdrop cluster. The reorder groups + ascending-sorts same-gap inserts.
          if (foldActive) lastDeferred = { uid: '', commitIndex: uCommitIndex, slot, newVal: amt, oldNext: pred.nextKey };
        }
      }
      if (commitments.length > 0) sortedLoopCommitments.set(info.collection, commitments);
    }

    // Handle external state reads (cross-contract reads via interfaces)
    const externalReads = abiFunction?.externalReads;
    let externalReadUtxos: UnlockableUtxo[] = [];

    if (externalReads && externalReads.length > 0) {
      const artifact = this.inner.artifact;

      for (let slotIndex = 0; slotIndex < externalReads.length; slotIndex++) {
        const er = externalReads[slotIndex];

        // Resolve external category ID from constructor args using categoryParam
        const externalCategoryId = this._resolveExternalCategoryId(er, artifact);

        if (er.kind === 'data') {
          // Data NFT read: discover the data NFT at the target nftIndex
          const dataNftAddress = this._getExternalDataNftAddress(externalCategoryId);
          const utxo = await this._findExternalDataNft(dataNftAddress, externalCategoryId, er.nftIndex ?? 0);

          if (utxo) {
            const unlocker = createReadOnlyDataNftUnlocker(this.inner, externalCategoryId);
            externalReadUtxos.push({ ...utxo, unlocker });
          } else {
            throw new Error(
              `External data NFT not found for interface '${er.interfaceName}' `
              + `at nftIndex ${er.nftIndex ?? 0} (category ${externalCategoryId})`,
            );
          }
        } else {
          // Entry NFT read: discover the entry NFT matching the collection
          const externalIface = artifact.externalInterfaces?.find((ei) => ei.name === er.interfaceName);
          const collectionSignature = er.collectionSignature
            ?? externalIface?.stateLayout.collections?.find((c) => c.name === er.collectionName)?.signature;

          if (!collectionSignature) {
            throw new Error(
              `Collection signature not found for external read: ${er.interfaceName}.${er.collectionName}`,
            );
          }

          const collectionHash = computeCollectionHash(collectionSignature);
          const entryCovenantScript = buildEntryNftCovenantScript(hexToBin(externalCategoryId), collectionHash);
          const entryAddress = scriptToAddress(
            entryCovenantScript, this.inner.provider.network, this.inner.addressType, true,
          );

          let entryUtxo: Utxo | undefined;
          try {
            const entryUtxos = await this.inner.provider.getUtxos(entryAddress);
            const externalKeyOverride = overrides?.externalEntryKeyOverrides?.get(slotIndex);
            if (externalKeyOverride !== undefined) {
              // Match entry by key in commitment
              const collection = externalIface?.stateLayout.collections?.find(
                (c) => c.name === er.collectionName,
              );
              for (const u of entryUtxos) {
                if (!u.token?.category || u.token.category !== externalCategoryId) continue;
                if (!u.token?.nft?.commitment || u.token.nft.commitment.length === 0) continue;
                try {
                  if (collection) {
                    const parsed = parseEntryCommitment(
                      u.token.nft.commitment, collection.keyType, collection.valueType,
                      externalIface?.stateLayout.structs,
                    );
                    if (this._keysMatch(parsed.key, externalKeyOverride, collection.keyType)) {
                      entryUtxo = u;
                      break;
                    }
                  }
                } catch {
                  // Commitment doesn't parse - skip
                }
              }
            } else {
              // No key override: find matching UTXOs and error if ambiguous
              const matchingEntries = entryUtxos.filter(
                (u) => u.token?.category === externalCategoryId
                  && u.token?.nft?.commitment
                  && u.token.nft.commitment.length > 0,
              );
              if (matchingEntries.length > 1) {
                throw new Error(
                  'Multiple entry NFTs found for collection '
                  + `'${er.collectionName}' of interface `
                  + `'${er.interfaceName}'. Use `
                  + '.withExternalEntryKey() to specify '
                  + 'which entry to read.',
                );
              }
              entryUtxo = matchingEntries[0];
            }
          } catch {
            // Entry doesn't exist
          }

          if (entryUtxo) {
            const unlocker = createReadOnlyEntryNftUnlocker(
              this.inner, externalCategoryId, collectionSignature,
            );
            externalReadUtxos.push({ ...entryUtxo, unlocker });
          }
          // Entry may not exist - _externalReadFlags will indicate absence
        }
      }


    }

    // blockhash(n) oracle co-spends: resolved AFTER the master unlocker is built (below), since the computed-n
    // extraction probe needs the complete unlocker (it carries the blockhash slot base index). Placed 1:1 at
    // the consecutive blockhashOracle slots. Only consumed at builder construction, so resolving them late is
    // safe.
    let blockhashCoSpendUtxos: UnlockableUtxo[] = [];
    let blockhashCoSpendSlotOrdinals: number[] | undefined;
    let maxBhLocktime = 0; // require(tx.time >= n) - the SDK sets the locktime so the derivation probe passes
    // keccak256 compute side-cars co-spent at the keccakSideCar slots; parallel commitments (R_i) drive the
    // recreation. Resolved late (needs the master unlocker's args) alongside blockhash.
    let keccakComputeCoSpendUtxos: UnlockableUtxo[] = [];
    let keccakComputeCommitments: string[] = [];
    let ecrecoverComputeCoSpendUtxos: UnlockableUtxo[] = [];
    let ecrecoverComputeRecreates: Output[] = [];

    // Pre-declare outState variables (populated later, but needed for base computations in external calls)
    let externalOutStateUtxoGroups: ExternalCallUtxoGroup[] = [];
    let outStateInputCount = 0;

    // Handle external function calls (cross-contract calls via interfaces)
    let externalCalls = abiFunction?.externalCalls;
    // Expand an array-element external call `IFoo(arr[i]).m()` into one concrete call per registered callee
    // instance (co-spent in array order; the covenant verifies each against the on-chain arr[i]).
    let presetResolved: (ExternalCallInfo | undefined)[] | undefined;
    // Loop-expanded group ranges: for a received-value pointer array (fnPtrCall loop slot), the covenant reads
    // each callee's master input index from ONE witness list, so the fill below appends that list (at the
    // range's position) instead of per-group indices.
    const loopIdxRanges: { start: number; count: number; fnPtrCall: boolean }[] = [];
    if (externalCalls?.some((ec) => ec.loopArrayVar)) {
      const expanded: ExternalCallAbi[] = [];
      presetResolved = [];
      for (const ec of externalCalls) {
        if (ec.loopArrayVar) {
          // A varying-method dispatch table co-spends each callee with its OWN registered method (the covenant
          // verifies it against the on-chain selector array); a fixed-method array uses the ABI functionName.
          const entries = this.inner.getExternalTargetEntriesByInterface(ec.interfaceName);
          const resolvedArgs = this._resolveExternalArgs(ec.argSources, args, this.inner.artifact) ?? [];
          const start = expanded.length;
          for (const entry of entries) {
            const inst = entry.instance as ConnectedStatefulContract;
            const fnName = (ec.selectorArrayVar && entry.method) ? entry.method : ec.functionName;
            expanded.push({ ...ec, loopArrayVar: undefined });
            presetResolved.push({
              externalContract: inst as unknown as StatefulContract, functionName: fnName, args: resolvedArgs,
            });
          }
          loopIdxRanges.push({ start, count: entries.length, fnPtrCall: !!ec.fnPtrCall });
        } else {
          expanded.push(ec);
          presetResolved.push(undefined);
        }
      }
      externalCalls = expanded;
    }
    let externalCallUtxoGroups: ExternalCallUtxoGroup[] = [];
    // Total return event count including transitive chains (updated in external call block)
    // Combined metadata for all groups (direct + transitive); used by _deriveFullTransactionState
    let allGroupEcSlots: readonly { hasReturnValues?: boolean; requiredDataNftIndices: number[] }[] = externalCalls ?? [];

    // Auto-resolve external calls from the registry when not explicitly provided.
    // The registry provides the contract object for UTXO/state lookup.
    // Function args are resolved from argSources metadata when available,
    // falling back to [] for no-arg functions.
    let resolvedExternalCalls = overrides?.externalCalls;
    if (externalCalls && externalCalls.length > 0 && !resolvedExternalCalls) {
      const autoResolved: ExternalCallInfo[] = [];
      let canAutoResolve = true;
      for (let eci = 0; eci < externalCalls.length; eci++) {
        const ec = externalCalls[eci];
        // Array-element call: the callee instance was already resolved during expansion.
        if (presetResolved?.[eci]) { autoResolved.push(presetResolved[eci]!); continue; }
        const registered = this._externalRegistry.get(ec.interfaceName);
        if (!registered) {
          canAutoResolve = false;
          break;
        }
        const resolvedArgs = this._resolveExternalArgs(ec.argSources, args, this.inner.artifact);
        if (resolvedArgs === undefined && ec.argSources?.some((s) => s.kind === 'expression')) {
          throw new Error(
            `External call to ${ec.interfaceName}.${ec.functionName} has expression-based argSources `
            + 'that cannot be auto-resolved. Use withExternalCall() to provide args explicitly.',
          );
        }
        autoResolved.push({
          externalContract: registered as StatefulContract,
          functionName: ec.functionName,
          args: resolvedArgs ?? [],
        });
      }
      if (canAutoResolve && autoResolved.length === externalCalls.length) {
        resolvedExternalCalls = autoResolved;
      }
    }

    // Pre-allocate signer UTXOs for B's block funders (shared pool across all external calls)
    let sharedFunderPool: UnlockableUtxo[] | undefined;

    if (externalCalls && externalCalls.length > 0 && resolvedExternalCalls) {

      // Count total funders needed across all B blocks
      if (this._signer) {
        let totalBFunders = 0;
        for (let si = 0; si < externalCalls.length; si++) {
          const ecSlot = externalCalls[si];
          const ci = resolvedExternalCalls[si];
          if (!ci?.externalContract) continue;
          const bSc = ci.externalContract as StatefulContract;
          const bArt = bSc.inner.artifact;
          const bAbiFunc = bArt.abi.find((f) => f.name === ecSlot.functionName);
          const bLayout = bAbiFunc?.blockLayout;
          if (!bLayout) continue;
          const fullBlockKinds = new Set(
            ['entry', 'satoshiContainer', 'tokenContainer', 'transfer', 'tcTransfer', 'event', 'returnEvent',
              'blockhashOracle'],
          );
          if (!bLayout.slots.some((s) => fullBlockKinds.has(s.kind))) continue;
          for (const s of bLayout.slots) {
            if (['transfer', 'tcTransfer', 'event', 'returnEvent'].includes(s.kind)) totalBFunders++;
            if (s.kind === 'blockhashOracle') totalBFunders++;
            // entry/TC/SC funders also needed when UTXO doesn't exist, but we can't
            // cheaply check on-chain state here. Conservatively over-allocate:
            if (['entry', 'tokenContainer', 'satoshiContainer'].includes(s.kind)) totalBFunders++;
          }
        }
        if (totalBFunders > 0) {
          const signerUtxos = await this._signer.getUtxos();
          const plainUtxos = signerUtxos.filter((u) => !u.token);
          // Allocate up to what's available; exact needs determined during block construction
          const toAllocate = Math.min(totalBFunders, plainUtxos.length);
          sharedFunderPool = plainUtxos.slice(0, toAllocate).map((u) => ({
            ...u, unlocker: this._signer!.unlockP2PKH(),
          }));
        }
      }

      for (let slotIndex = 0; slotIndex < externalCalls.length; slotIndex++) {
        const ec = externalCalls[slotIndex];
        const callInfo = resolvedExternalCalls[slotIndex];

        if (!callInfo) {
          throw new Error(
            `External call at slot ${slotIndex} (${ec.interfaceName}.${ec.functionName}) `
            + 'not provided via withExternalCall() or connect-time externals.',
          );
        }

        // Resolve external category ID from the resolved external contract (address model: A's args
        // bake the callee address, so its category comes from the registered external instance).
        const externalCategoryId = callInfo.externalContract.categoryId;
        const compilerRoute = this._buildRepeatedExternalBatch(
          ec, args, callInfo.externalContract as StatefulContract,
        );
        const bGraphBlockhashSelections = compilerRoute
          ? selectGraphBlockhashReads(callInfo.externalContract.inner.artifact, compilerRoute.blob)
          : [];

        // Get B's on-chain state
        const bState = await callInfo.externalContract.getFullState();
        if (!bState.masterUtxo) {
          throw new Error(
            `External contract master UTXO not found for ${ec.interfaceName} (category ${externalCategoryId})`,
          );
        }

        const bStatelayout = callInfo.externalContract.inner.stateLayout!;

        // Get B's required data NFT UTXOs (default to all when ABI doesn't specify)
        const bRequiredNftIndices = ec.requiredDataNftIndices.length > 0
          ? ec.requiredDataNftIndices
          : Array.from({ length: bStatelayout.dataNftCount }, (_, i) => i);
        const bDataNfts: UnlockableUtxo[] = [];
        for (const nftIndex of bRequiredNftIndices) {
          const dataNftUtxo = bState.dataNftUtxos[nftIndex];
          if (!dataNftUtxo) {
            throw new Error(
              `External data NFT at index ${nftIndex} not found for ${ec.interfaceName}`,
            );
          }
          bDataNfts.push({
            ...dataNftUtxo,
            // Placeholder unlocker - will be replaced after we know the master input index
            unlocker: createDataNftUnlocker(callInfo.externalContract.inner, 0, externalCategoryId),
          });
        }

        // Build B's full block inputs when B's function has entries/events/transfers
        const bSc = callInfo.externalContract as StatefulContract | null;
        const bAbiFunc = compilerRoute?.abiFunction ?? (bSc
          ? (bSc.inner.artifact.abi as readonly AbiFunction[])
            .find((f) => f.name === callInfo.functionName)
          : undefined);
        const bBlockLayout = bAbiFunc?.blockLayout;
        let bBlockInputs: UnlockableUtxo[] | undefined;
        // X13: set once B's block is confirmed to carry a funding input at its published returnEvent offset.
        let bReturnEventInBlock = false;
        const bCompilerInternalArgs: Record<string, FunctionArgument> = {};
        // Cross-contract callee LOOP write metadata (docs/deferrals.md #1): populated after the block build below.
        let bEntryLoopCommitments: string[] | undefined;
        let bEntryLoopStart: number | undefined;
        let bEntryLoopCollection: string | undefined;
        const bHasLoop = (bAbiFunc?.sortedUpsertLoopInfo?.length ?? 0) > 0;
        // B's keccak256 side-cars (transitive): co-spent inside B's block so B's covenant reads them.
        const bKeccak = await this._resolveExternalKeccakSideCars(
          bAbiFunc, callInfo.args, externalCategoryId, callInfo.externalContract as StatefulContract | null,
        );

        if (bBlockLayout) {
          // Check for slots that need full block treatment (entries, TC, SC, events, transfers, keccak side-cars).
          // returnEvent is included: its OUTPUT lives at B's own block offset, so B's block must carry a paired
          // funding INPUT there or B's input extent is shorter than its output extent (X13).
          const fullBlockKinds = new Set(
            ['entry', 'satoshiContainer', 'tokenContainer', 'transfer', 'tcTransfer', 'event', 'keccakSideCar',
              'blockhashOracle'],
          );
          const hadFullBlockKinds = bBlockLayout.slots.some((s) => fullBlockKinds.has(s.kind));
          // A loop-expanded slot shares ONE contiguous return-event band across its iterations, so its callees
          // keep the appended-tail shape and take no returnEvent funder.
          const bLoopExpanded = loopIdxRanges.some((r) => slotIndex >= r.start && slotIndex < r.start + r.count);
          const hasExtraSlots = hadFullBlockKinds
            || (!bLoopExpanded && bBlockLayout.slots.some((s) => s.kind === 'returnEvent'));
          if ((hasExtraSlots || bHasLoop) && bSc) {
            // Build B's full block following blockLayout slot order.
            // Fetch B's real UTXOs for entries/TC/SC where they exist on-chain;
            // use funder inputs for output-only slots and non-existing entries/TCs.
            bBlockInputs = [];
            let bDataIdx = 0;
            // Create proper unlocker for B's master (not just a type cast). If B's function reads msg.sender, append
            // OUR category (docs/deferrals.md #1): B is called BY us, so B's msg.sender = this contract - B's covenant
            // resolves it (emitMsgSenderMintingVerification) from OUR co-spent minting master at that category.
            const bBlockAbiFn = compilerRoute?.abiFunction
              ?? (callInfo.externalContract.inner.artifact.abi as readonly
              { name: string; usesMsgSender?: boolean }[]).find((f) => f.name === callInfo.functionName);
            const bRouteArgs = compilerRoute?.args ?? (callInfo.args ?? []);
            const bBlockArgs = bBlockAbiFn?.usesMsgSender
              ? [...bRouteArgs, hexToBin(this.categoryId).reverse()] : bRouteArgs;
            const bMasterUnlocker = compilerRoute
              ? callInfo.externalContract.inner.createCompilerRouteUnlocker(
                compilerRoute.abiFunction, compilerRoute.selector,
              )(...bBlockArgs)
              : ((callInfo.externalContract.inner.unlock as any)[callInfo.functionName]
                ? (callInfo.externalContract.inner.unlock as any)[callInfo.functionName](...bBlockArgs)
                : undefined);
            const bMasterUnlockable: UnlockableUtxo = {
              ...bState.masterUtxo!,
              ...(bMasterUnlocker && { unlocker: bMasterUnlocker }),
            };

            // Helper: create a funder input. Uses signer UTXOs when available, OP_TRUE dummies otherwise.
            let bFunderIdx = 0;
            // Block position of the returnEvent slot's funder, or -1 when the layout declares no such slot.
            let bReturnFunderOffset = -1;
            const makeFunder = async (): Promise<UnlockableUtxo> => {
              // Real signer: draw from the shared funder pool allocated before the external call loop
              if (sharedFunderPool && sharedFunderPool.length > 0) {
                const f = sharedFunderPool.shift()!;
                return f;
              }
              // If a signer was provided but the pool is exhausted, the signer needs more UTXOs
              if (this._signer) {
                throw new Error(
                  'Insufficient funding UTXOs for external calls. '
                  + 'The signer needs more UTXOs - split existing UTXOs or fund the signer address with additional inputs.',
                );
              }
              // Mocknet fallback: P2SH32-wrapped OP_TRUE dummy registered with provider. The outpoint is seeded
              // with this callee's group position so two callees' block funders are distinct UTXOs.
              const dummyTxid = '00'.repeat(30)
                + (externalCallUtxoGroups.length & 0xff).toString(16).padStart(2, '0')
                + ((0xb0 + (bFunderIdx++)) & 0xff).toString(16).padStart(2, '0');
              const dummy: Utxo = { txid: dummyTxid, vout: 0, satoshis: 10000n };
              if ((this.inner.provider as any).addUtxo) {
                await (this.inner.provider as any).addUtxo(binToHex(DUMMY_FUNDER_LOCKING_BYTECODE), dummy);
              }
              return {
                ...dummy,
                unlocker: {
                  generateLockingBytecode: () => DUMMY_FUNDER_LOCKING_BYTECODE,
                  generateUnlockingBytecode: () => DUMMY_FUNDER_UNLOCKING_BYTECODE,
                },
              };
            };

            for (const slot of bBlockLayout.slots) {
              switch (slot.kind) {
                case 'master':
                  bBlockInputs.push(bMasterUnlockable);
                  break;
                case 'dataNft':
                  if (bDataIdx < bDataNfts.length) bBlockInputs.push(bDataNfts[bDataIdx++]);
                  break;
                case 'event':
                  // Event NFT output slots need a funder input
                  bBlockInputs.push(await makeFunder());
                  break;
                case 'keccakSideCar': {
                  // B's keccak side-car at this slot (already resolved). Fall back to a funder if missing so B's
                  // covenant fails loudly rather than mispositioning the block.
                  const kInput = bKeccak.inputs[slot.slotIndex ?? 0];
                  bBlockInputs.push(kInput ?? await makeFunder());
                  break;
                }
                case 'returnEvent':
                  // Output-only slot: its return-event NFT output sits at B's block offset, so pair it with a
                  // funding input to keep B's input extent equal to its output extent (X13). Rolled back below
                  // when the assembled block does not come out exactly blockSize wide at the published offsets.
                  if (bLoopExpanded) break;
                  bReturnFunderOffset = bBlockInputs.length;
                  bBlockInputs.push(await makeFunder());
                  break;
                case 'lowLevelCall':
                case 'deploy':
                  // Handled by separate infrastructure - skip
                  break;
                case 'entry': {
                  // Fetch B's entry UTXO with key matching
                  const bEntryAccesses = bAbiFunc?.entryAccesses;
                  const bEntryAccess = bEntryAccesses?.[slot.slotIndex ?? 0];
                  let entryFound = false;
                  if (bEntryAccess && bSc) {
                    const bCollection = bSc.inner.stateLayout?.collections?.find(
                      (c) => c.name === bEntryAccess.collection
                        || c.signature === bEntryAccess.collection,
                    );
                    const bEntryAddr = getEntryNftAddress(bSc.inner, externalCategoryId, bEntryAccess.collection);
                    const bEntryUtxos = await this.inner.provider.getUtxos(bEntryAddr);
                    // Find entry matching the key from B's function args
                    const keyParam = bEntryAccess.keyParams[0];
                    const keyParamIdx = bAbiFunc!.inputs.findIndex((inp) => inp.name === keyParam);
                    const rawKeyValue = keyParamIdx >= 0 ? bRouteArgs[keyParamIdx] : undefined;
                    // Convert FunctionArgument to primitive for key matching
                    const keyValue = rawKeyValue instanceof Uint8Array || typeof rawKeyValue === 'bigint'
                      || typeof rawKeyValue === 'boolean' ? rawKeyValue : undefined;
                    // msg.sender key (cross-contract): B's `bal[msg.sender]` where msg.sender = US (the caller). Resolve
                    // the key to OUR category-pinned locking bytecode - the covenant keys the entry by keyToSlot(caller
                    // LBC) too (emitSortedKeyHash visits msg.sender -> emitMsgSenderMintingVerification -> caller LBC).
                    const effKeyValue = bEntryAccess.keySources?.[0]?.kind === 'msgSender'
                      ? hexToBin(this.inner.withCategory(hexToBin(this.categoryId)).lockingBytecode)
                      : keyValue;
                    let matchUtxo: Utxo | undefined;
                    if (bCollection?.sorted && effKeyValue !== undefined) {
                      // C2 (sorted) collection (docs/deferrals.md #1): the commitment is slot||nextKey||value, so
                      // co-spend by slot - the EXACT entry if present (a cross-contract UPDATE), else the bracketing
                      // predecessor (an INSERT, whose P'/NEW outputs are derived from B's trace). predecessorOf throws
                      // if B has no HEAD sentinel; fall back to a funder so B's covenant fails closed rather than crash.
                      const bList = SortedList.fromUtxos(
                        bEntryUtxos.filter((u) => u.token?.category === externalCategoryId),
                      );
                      const encodedKeys = bEntryAccess.keyParams.map((name, keyIndex) => {
                        if (bEntryAccess.keySources?.[keyIndex]?.kind === 'msgSender') {
                          return hexToBin(
                            this.inner.withCategory(hexToBin(this.categoryId)).lockingBytecode,
                          );
                        }
                        const index = bAbiFunc!.inputs.findIndex((input) => input.name === name);
                        const value = index >= 0 ? bRouteArgs[index] : undefined;
                        if (value instanceof Uint8Array) return value;
                        if (typeof value === 'bigint') return bigIntToVmNumber(value);
                        if (typeof value === 'boolean') return bigIntToVmNumber(value ? 1n : 0n);
                        throw new Error(`External SCB1 cannot resolve entry key '${name}'`);
                      });
                      const directKeyBin = effKeyValue instanceof Uint8Array ? effKeyValue
                        : typeof effKeyValue === 'bigint' ? bigIntToVmNumber(effKeyValue)
                          : bigIntToVmNumber(effKeyValue ? 1n : 0n);
                      const bSlot = compilerRoute ? keyToSlotMulti(encodedKeys) : keyToSlot(directKeyBin);
                      let unsupportedColdEntry = false;
                      try {
                        const exact = compilerRoute ? bList.find(bSlot) : undefined;
                        if (compilerRoute && !exact) unsupportedColdEntry = true;
                        matchUtxo = compilerRoute
                          ? (exact ?? bList.predecessorOf(bSlot))?.utxo
                          : (bList.has(bSlot) ? bList.find(bSlot) : bList.predecessorOf(bSlot))?.utxo;
                        if (compilerRoute && bAbiFunc?.sortedBatchInfo?.some((batch) =>
                          batch.slotIndices.includes(slot.slotIndex ?? 0))) {
                          if (exact) {
                            const routeSlot = slot.slotIndex ?? 0;
                            const blockOffset = bBlockLayout.slots.find((candidate) =>
                              candidate.kind === 'entry' && candidate.slotIndex === routeSlot)?.offset;
                            if (blockOffset === undefined) {
                              throw new Error(`External SCB1 entry slot ${routeSlot} has no block offset`);
                            }
                            const commitment = exact.utxo.token?.nft?.commitment;
                            if (!commitment) throw new Error(`External SCB1 entry slot ${routeSlot} has no commitment`);
                            bCompilerInternalArgs[`__internal__c2BatchSlot_${routeSlot}`] = bSlot;
                            bCompilerInternalArgs[`__internal__c2BatchProof_${routeSlot}`] = BigInt(blockOffset);
                            bCompilerInternalArgs[`__internal__c2BatchNext_${routeSlot}`] =
                              decodeEntryCommitment(hexToBin(commitment)).nextKey;
                            bCompilerInternalArgs[`__internal__c2BatchPredOut_${routeSlot}`] = -1n;
                          }
                        }
                      } catch { matchUtxo = undefined; }
                      if (unsupportedColdEntry) {
                        throw new Error(
                          'External SCB1 resource-shaped route requires an existing '
                          + `${bEntryAccess.collection} entry for slot ${slot.slotIndex}; `
                          + 'cold-entry predecessor planning is not yet supported',
                        );
                      }
                    } else if (keyValue !== undefined && bCollection) {
                      for (const u of bEntryUtxos) {
                        if (u.token?.category !== externalCategoryId) continue;
                        if (!u.token?.nft?.commitment) continue;
                        try {
                          const parsed = parseEntryCommitment(
                            u.token.nft.commitment, bCollection.keyType, bCollection.valueType,
                            bStatelayout.structs,
                          );
                          if (this._keysMatch(parsed.key, keyValue, bCollection.keyType)) {
                            matchUtxo = u;
                            break;
                          }
                        } catch { /* skip unparseable */ }
                      }
                    } else {
                      // No key matching - pick first matching UTXO
                      matchUtxo = bEntryUtxos.find((u) => u.token?.category === externalCategoryId);
                    }
                    if (matchUtxo) {
                      const unlocker = createEntryNftUnlocker(
                        bSc.inner, bBlockInputs.length, externalCategoryId, bEntryAccess.collection,
                      );
                      bBlockInputs.push({ ...matchUtxo, unlocker });
                      entryFound = true;
                    }
                  }
                  if (!entryFound) bBlockInputs.push(await makeFunder());
                  break;
                }
                case 'satoshiContainer': {
                  // Fetch B's satoshi container UTXO
                  if (bSc) {
                    const bScAddr = getSatoshiContainerAddress(bSc.inner, externalCategoryId);
                    const bScUtxos = await this.inner.provider.getUtxos(bScAddr);
                    const bScUtxo = bScUtxos.find((u) => !u.token);
                    if (bScUtxo) {
                      const unlocker = createSatoshiContainerUnlocker(bSc.inner, bBlockInputs.length, externalCategoryId);
                      bBlockInputs.push({ ...bScUtxo, unlocker });
                    } else {
                      bBlockInputs.push(await makeFunder());
                    }
                  } else {
                    bBlockInputs.push(await makeFunder());
                  }
                  break;
                }
                case 'tokenContainer': {
                  // Fetch B's token container UTXO
                  const bTcAccesses = bAbiFunc?.tokenContainerAccesses;
                  const bTcAccess = bTcAccesses?.[slot.slotIndex ?? 0];
                  if (bTcAccess && bSc) {
                    // The TC categoryId comes from B's function args
                    const bTcKeyIdx = bRouteArgs.findIndex(
                      (_: unknown, i: number) => bAbiFunc?.inputs[i]?.name === bTcAccess.keyParam,
                    );
                    const bTcCatValue = bTcKeyIdx >= 0 ? bRouteArgs[bTcKeyIdx] : undefined;
                    const bTcCatId = bTcCatValue instanceof Uint8Array
                      ? binToHex(bTcCatValue) : (bTcCatValue ? String(bTcCatValue) : '');
                    if (bTcCatId) {
                      const bTcAddr = getTokenContainerAddress(bSc.inner, externalCategoryId, bTcCatId);
                      const bTcUtxos = await this.inner.provider.getUtxos(bTcAddr);
                      const bTcUtxo = bTcUtxos.find((u) => u.token?.category === bTcCatId);
                      if (bTcUtxo) {
                        const unlocker = createTokenContainerUnlocker(
                          bSc.inner, bBlockInputs.length, externalCategoryId, bTcCatId,
                        );
                        bBlockInputs.push({ ...bTcUtxo, unlocker });
                      } else {
                        bBlockInputs.push(await makeFunder());
                      }
                    } else {
                      bBlockInputs.push(await makeFunder());
                    }
                  } else {
                    bBlockInputs.push(await makeFunder());
                  }
                  break;
                }
                default:
                  // Output-only slots (transfer, tcTransfer, event) - funder
                  bBlockInputs.push(await makeFunder());
                  break;
              }
            }
            // X13: the return event may only move into B's block when the block came out EXACTLY blockSize wide
            // with the funder at the published returnEvent offset. A callee whose published layout disagrees with
            // what the SDK actually co-spends (for example a pure function with no dataNft slot whose data NFT is
            // still co-spent for an outState read) would otherwise land the return event on another slot's output.
            // Fall back to the pre-X13 shape for that callee: drop the funder, and drop the block entirely when
            // nothing but the returnEvent slot asked for one.
            if (bReturnFunderOffset >= 0) {
              const reOffset = bBlockLayout.slots.find((s) => s.kind === 'returnEvent')!.offset;
              // The builder emits B's outputs as master + one per requiredDataNftIndices + one per remaining
              // block input, so the two extents only line up when the layout declares exactly those data slots.
              const layoutDataSlots = bBlockLayout.slots.filter((s) => s.kind === 'dataNft').length;
              if (bBlockInputs.length === bBlockLayout.blockSize && bReturnFunderOffset === reOffset
                && layoutDataSlots === bRequiredNftIndices.length) {
                bReturnEventInBlock = true;
              } else {
                bBlockInputs.splice(bReturnFunderOffset, 1);
                if (!hadFullBlockKinds && !bHasLoop) bBlockInputs = undefined;
              }
            }
          }
        }

        // Cross-contract callee LOOP write (docs/deferrals.md #1): B's function loops `for(i) this.m[ks[i]] (+)= vs[i]`
        // (sortedUpsertLoopInfo). B's block has NO fixed entry slot for these - the entries are trailing (read by B's
        // covenant at master+blockSize+counter). Co-spend each EXISTING entry (UPDATE-only; an absent key = insert =
        // fail-closed) and SDK-compute its updated commitment; the STB mints B's trailing outputs and B's covenant
        // verifies. Sound by fail-closed: a wrong commitment reverts (B pins output==coSlot|coNext|newValue), a
        // misplaced input trips B's per-iteration coSlot==Hk check. INT values, one collection, no dup keys.
        if (bBlockInputs && bHasLoop && bSc) {
          const bLoopInfos = bAbiFunc!.sortedUpsertLoopInfo!;
          if (bLoopInfos.length > 1) {
            throw new Error('cross-contract callee loop over multiple collections is not supported (fails closed).');
          }
          const bCore = bBlockInputs.length; // loop entries begin here (== B's blockSize for a dense block)
          if (bCore !== (bBlockLayout?.blockSize ?? bCore) || bCore > 1) {
            // The callee loop function must touch ONLY the looped mapping (block = master alone). A callee that also
            // reads/writes OTHER state (a data NFT slot) needs its data-NFT derivation interleaved with the loop
            // co-spend; not yet wired, so fail closed cleanly rather than emitting a mispositioned block.
            throw new Error('cross-contract callee loop: the callee loop function must access only the looped mapping '
              + '(a callee that also reads/writes other state is not yet supported cross-contract; fails closed).');
          }
          const bLoopCommitments: string[] = [];
          const bArgOf = (name: string | undefined): unknown => {
            if (!name) return undefined;
            const i = bAbiFunc!.inputs.findIndex((p) => p.name === name);
            return i >= 0 ? callInfo.args[i] : undefined;
          };
          const encK = (v: unknown, keyType: string): Uint8Array => (
            keyType === 'address' && typeof v === 'string' && v.includes(':') ? addressToLockScript(v)
              : typeof v === 'bigint' ? bigIntToVmNumber(v)
                : v instanceof Uint8Array ? v
                  : typeof v === 'boolean' ? bigIntToVmNumber(v ? 1n : 0n)
                    : bigIntToVmNumber(BigInt(v as string)));
          const toB = (v: unknown): bigint => {
            if (typeof v === 'bigint') return v;
            if (typeof v === 'number' || typeof v === 'string') return BigInt(v);
            throw new Error('cross-contract callee loop: non-int value is not supported cross-contract (fails closed).');
          };
          for (const li of bLoopInfos) {
            if (li.op !== '+' && li.op !== 'set') {
              throw new Error(`cross-contract callee loop op '${li.op}' on '${li.collection}' is not supported `
                + '(fails closed).');
            }
            const bColl = (bStatelayout.collections ?? []).find((c) => c.name === li.collection);
            if (!bColl) {
              throw new Error(`cross-contract callee loop: collection '${li.collection}' not in callee layout.`);
            }
            const keyTypes = bColl.keyTypes ?? [bColl.keyType];
            const varyType = keyTypes[li.fixedKeyParams.length] ?? bColl.keyType;
            const fixedBins = li.fixedKeyParams.map((p, i) => encK(bArgOf(p), keyTypes[i] ?? bColl.keyType));
            const ks = bArgOf(li.varyingArrayParam);
            if (!Array.isArray(ks)) {
              throw new Error(`cross-contract callee loop: key array '${li.varyingArrayParam}' missing.`);
            }
            const vs = li.valueArrayParam ? bArgOf(li.valueArrayParam) : undefined;
            const scalarV = li.valueScalarParam !== undefined ? toB(bArgOf(li.valueScalarParam))
              : li.valueConst !== undefined ? BigInt(li.valueConst) : undefined;
            const bEntryAddr = getEntryNftAddress(bSc.inner, externalCategoryId, bColl.signature);
            const bList = SortedList.fromUtxos((await this.inner.provider.getUtxos(bEntryAddr)).filter((u) => (
              u.token?.category === externalCategoryId && u.token?.nft?.capability === 'mutable'
              && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0)));
            const seen = new Set<string>();
            for (let i = 0; i < ks.length; i++) {
              const slot = keyToSlotMulti([...fixedBins, encK(ks[i], varyType)]);
              const slotHex = binToHex(slot);
              if (seen.has(slotHex)) {
                throw new Error(`cross-contract callee loop on '${li.collection}': duplicate key (fails closed).`);
              }
              seen.add(slotHex);
              const entry = bList.find(slot);
              if (!entry) {
                throw new Error(`cross-contract callee loop on '${li.collection}': key ${i} has no entry - a `
                  + 'cross-contract insert is not supported (fails closed).');
              }
              const oldVal = vmNumberToBigInt(entry.value, { requireMinimalEncoding: false }) as bigint;
              const add = vs ? toB((vs as unknown[])[i]) : scalarV!;
              const newVal = li.op === 'set' ? add : oldVal + add;
              bLoopCommitments.push(
                binToHex(encodeEntryCommitment(entry.slot, entry.nextKey, bigIntToVmNumber(newVal))),
              );
              // Co-spend the entry (write mode). masterInputIndex is patched to B's real master at derive time.
              bBlockInputs.push({
                ...entry.utxo,
                unlocker: createEntryNftUnlocker(bSc.inner, 0, externalCategoryId, bColl.signature),
              });
            }
            bEntryLoopCollection = bColl.signature;
          }
          if (bLoopCommitments.length > 0) { bEntryLoopCommitments = bLoopCommitments; bEntryLoopStart = bCore; }
        }

        if (compilerRoute && bBlockInputs && bBlockLayout) {
          const seenEntries = new Map<string, number>();
          for (const slot of bBlockLayout.slots) {
            if (slot.kind !== 'entry') continue;
            const input = bBlockInputs[slot.offset];
            if (!input?.token?.nft) continue;
            const outpoint = `${input.txid}:${input.vout}`;
            const owner = seenEntries.get(outpoint);
            if (owner !== undefined) {
              throw new Error(
                `External SCB1 resource shape aliases entry slots ${owner} and ${slot.slotIndex}; `
                + 'this physical alias is not supported by the advertised route',
              );
            }
            seenEntries.set(outpoint, slot.slotIndex ?? 0);
          }
        }

        externalCallUtxoGroups.push({
          categoryId: externalCategoryId,
          stateLayout: bStatelayout,
          masterUtxo: bState.masterUtxo,
          dataNftUtxos: bDataNfts,
          requiredDataNftIndices: bRequiredNftIndices,
          functionName: callInfo.functionName,
          functionArgs: callInfo.args,
          externalContract: callInfo.externalContract,
          ...(compilerRoute && {
            compilerRoute: {
              ...compilerRoute,
              ...((bAbiFunc?.sortedBatchInfo?.length ?? 0) > 0 && {
                internalArgs: {
                  ...bCompilerInternalArgs,
                  __internal__c2BatchTrailingCount: 0n,
                },
              }),
            },
          }),
          ...(bGraphBlockhashSelections.length > 0 && {
            graphBlockhashSelections: bGraphBlockhashSelections,
          }),
          ...(ec.callMode && { callMode: ec.callMode }),
          ...(bBlockInputs && { blockInputs: bBlockInputs, blockLayout: bBlockLayout }),
          ...(bReturnEventInBlock && { returnEventInBlock: true }),
          ...(bKeccak.recreates.length > 0 && { keccakRecreates: bKeccak.recreates }),
          ...(bEntryLoopCommitments && {
            entryLoopCommitments: bEntryLoopCommitments,
            entryLoopStart: bEntryLoopStart,
            entryLoopCollection: bEntryLoopCollection,
          }),
          ...(() => {
            const values: Record<string, StateValue> = {};
            for (const name of bAbiFunc?.dynamicWrites ?? []) {
              const variable = bStatelayout.variables.find((candidate) => candidate.name === name);
              if (!variable) continue;
              const candidates = bAbiFunc!.inputs
                .map((input, index) => ({ input, index }))
                .filter(({ input }) => !input.name.startsWith('__internal__')
                  && input.type === variable.type);
              if (candidates.length !== 1) continue;
              const value = callInfo.args[candidates[0].index];
              if (typeof value === 'string' || value instanceof Uint8Array) values[name] = value;
            }
            return Object.keys(values).length > 0 ? { dynamicStateValues: values } : {};
          })(),
        });
      }

      // Track per-group metadata (direct + transitive)
      const groupMetas: ExternalGroupMeta[] = [];
      const directGroupCount = externalCallUtxoGroups.length;

      // Build metadata for direct groups
      for (let i = 0; i < directGroupCount; i++) {
        groupMetas.push({
          ecSlot: externalCalls[i],
          callerCategoryId: this.categoryId,
          parentGroupIndex: -1,
        });
      }

      // Discover and build transitive external call groups (B->C chains).
      // For each direct group, check if B's called function also has external calls.
      // If so, resolve B's external calls from B's connect-time registry and add them.
      for (let directIdx = 0; directIdx < directGroupCount; directIdx++) {
        const directGroup = externalCallUtxoGroups[directIdx];
        const bContract = directGroup.externalContract as StatefulContract;
        const bAbi = bContract.inner.artifact.abi as readonly { externalCalls?: readonly ExternalCallAbi[]; name: string }[];
        const bAbiFunc = bAbi.find((f) => f.name === directGroup.functionName);

        if (!bAbiFunc?.externalCalls?.length) continue;

        for (const bEc of bAbiFunc.externalCalls) {
          // Resolve C from B's external registry
          const cRegistered = (bContract as StatefulContract)._externalRegistry.get(bEc.interfaceName);
          if (!cRegistered) {
            throw new Error(
              `Transitive external call: ${bEc.interfaceName}.${bEc.functionName} not found `
              + `in ${directGroup.functionName}'s connect-time externals. `
              + 'Register it via StatefulContract.withCategory(bContract, bCategoryId, '
              + `{ externals: { ${bEc.interfaceName}: scC } }).`,
            );
          }

          const cContract = cRegistered as StatefulContract;

          // Detect circular calls (B->A): the transitive target is the primary contract
          if (cContract.categoryId === this.categoryId) {
            throw new Error(
              `Circular external call detected: ${directGroup.functionName} calls `
              + `${bEc.interfaceName}.${bEc.functionName} which targets the primary contract. `
              + 'Circular A->B->A calls are not supported in auto-resolution.',
            );
          }

          // Resolve C's args from B's argSources
          const cArgs = (bContract as StatefulContract)._resolveExternalArgs(
            bEc.argSources, directGroup.functionArgs, bContract.inner.artifact,
          );
          if (cArgs === undefined && bEc.argSources?.some((s: any) => s.kind === 'expression')) {
            throw new Error(
              `Transitive external call to ${bEc.interfaceName}.${bEc.functionName} has expression-based `
              + 'argSources that cannot be auto-resolved. Use withExternalCall() to provide args explicitly.',
            );
          }

          // Resolve C's category ID from the resolved transitive external contract (address model)
          const cCategoryId = cContract.categoryId;

          // Get C's on-chain state
          const cState = await cContract.getFullState();
          if (!cState.masterUtxo) {
            throw new Error(
              'Transitive external contract master UTXO not found for '
              + `${bEc.interfaceName} (category ${cCategoryId})`,
            );
          }

          const cStateLayout = cContract.inner.stateLayout!;
          const cRequiredNftIndices = bEc.requiredDataNftIndices.length > 0
            ? bEc.requiredDataNftIndices
            : Array.from({ length: cStateLayout.dataNftCount }, (_, i) => i);

          const cDataNfts: UnlockableUtxo[] = [];
          for (const nftIndex of cRequiredNftIndices) {
            const dataNftUtxo = cState.dataNftUtxos[nftIndex];
            if (!dataNftUtxo) {
              throw new Error(
                `Transitive external data NFT at index ${nftIndex} not found `
                + `for ${bEc.interfaceName}`,
              );
            }
            cDataNfts.push({
              ...dataNftUtxo,
              unlocker: createDataNftUnlocker(cContract.inner, 0, cCategoryId),
            });
          }

          externalCallUtxoGroups.push({
            categoryId: cCategoryId,
            stateLayout: cStateLayout,
            masterUtxo: cState.masterUtxo,
            dataNftUtxos: cDataNfts,
            requiredDataNftIndices: cRequiredNftIndices,
            functionName: bEc.functionName,
            functionArgs: cArgs ?? [],
            externalContract: cContract,
            ...(bEc.callMode && { callMode: bEc.callMode }),
          });

          groupMetas.push({
            ecSlot: bEc,
            callerCategoryId: directGroup.categoryId,
            parentGroupIndex: directIdx,
          });
        }
      }

      // _externalCallInputBase: runtime param (needed for mutual A<->B calls)
      // When the function reads a dynamic-storage array (loop external calls over arr[i]), the
      // chunk run sits right after the block (read at blockSize+i); the callees are appended
      // AFTER that chunk run, so the base advances by the chunk count.
      let externalCallInputBase = 1 + requiredNftIndices.length + externalReadUtxos.length + outStateInputCount;
      // SCB1 reserves the complete oracle row band before its callees. Active reads are sparse; count the
      // physical width, not the number of resolved oracle UTXOs, when assigning the first participant base.
      externalCallInputBase += abiFunction?.graphBlockhashOracle?.slotCount ?? 0;
      if (iterationEntryInputs.length > 0) externalCallInputBase += iterationEntryInputs.length;
      finalArgs = [...finalArgs, BigInt(externalCallInputBase)];

      // Fill each synthesized `__internal__loopTargets<n>` witness (a per-iteration COMPUTED target
      // `IFoo(pairFor(.., path[i], ..)).m()` the compiler rewrote to read a witness address[] param) with the
      // co-spent target addresses: the registered instances for that slot's interface, in co-spend order. The
      // co-spend itself is the array-slot expansion above (registered via registerExternalArray); a state/param
      // target array is read on-chain, but this synthesized witness is a param the SDK derives and fills here.
      // Ordered by the ABI (externalCallInputBase then loopTargets<n> then selectors), matching the covenant.
      for (const inp of abiFunction?.inputs ?? []) {
        if (!inp.name.startsWith('__internal__loopTargets')) continue;
        const wSlot = abiFunction?.externalCalls?.find((ec) => ec.loopArrayVar === inp.name);
        const wEntries = wSlot ? this.inner.getExternalTargetEntriesByInterface(wSlot.interfaceName) : [];
        // entry.address is the callee's locking bytecode hex (inst.inner.lockingBytecode) - the same value the
        // covenant compares each co-spent input against, so the witness fill matches the co-spend order exactly.
        const wAddrs = wEntries.map((e) => hexToBin(e.address));
        finalArgs = [...finalArgs, encodePushdataValue(wAddrs, 'address[]')];
      }

      // Count all returning call groups (direct + transitive) for return event output computation
      const allReturningGroupIndices: number[] = [];
      for (let i = 0; i < externalCallUtxoGroups.length; i++) {
        if (groupMetas[i].ecSlot.hasReturnValues) {
          allReturningGroupIndices.push(i);
        }
      }
      // Update wider-scoped variables for use outside this block
      allGroupEcSlots = groupMetas.map((m) => m.ecSlot);

      // Pre-compute return event output base - needed for return output index assignment
      let returnEventOutputBase = -1;
      // Where the co-spent callees' own output blocks begin (X13: a callee's return event lives inside its block).
      let externalCallOutputStart = -1;
      if (allReturningGroupIndices.length > 0) {
        const externalCallOutputCount = externalCallUtxoGroups.reduce(
          (sum, g) => sum + (g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length), 0,
        );

        // Pre-compute low-level call output count (LLC outputs sit between external calls and entries)
        const llcCalls = abiFunction?.lowLevelCalls;
        let lowLevelCallOutputCount = 0;
        if (llcCalls && llcCalls.length > 0) {
          const resolvedLlcCalls = overrides?.calls ?? [];
          for (let i = 0; i < llcCalls.length; i++) {
            const callInfo = resolvedLlcCalls[i];
            if (!callInfo) continue;
            if (callInfo.type === 'stateful') {
              lowLevelCallOutputCount += 1 + callInfo.contract.inner.stateLayout!.dataNftCount;
            } else {
              lowLevelCallOutputCount += 1;
            }
          }
        }

        const entryOutputCount = entryNfts.filter((e) => {
          // A conditional soft-delete slot produces an output only when the entry exists (existence-gated); an
          // absent key is a no-op with no output.
          if (condSoftDeleteSlots.has(e.slotIndex)) return !!e.exists;
          return (!e.exists || e.utxo) && !entryDeleteSlots.has(e.slotIndex);
        }).length;
        const transferCount = abiFunction?.transferCount ?? 0;
        const satoshiContainerOutputCount = transferCount > 0 ? 1 : 0;
        const tokenContainerTransferCount = abiFunction?.tokenContainerAccesses
          ? abiFunction.tokenContainerAccesses.reduce((count, a) => {
            const ftCount = a.transferCount ?? (a.operations.includes('transfer') ? 1 : 0);
            const nftCount = a.transferNftCount ?? (a.operations.includes('transferNft') ? 1 : 0);
            return count + ftCount + nftCount;
          }, 0)
          : 0;
        const emitCount = abiFunction?.emits?.length ?? 0;

        const outStateOutputCount = externalOutStateUtxoGroups.reduce(
          (sum, g) => sum + 1 + g.dataNftUtxos.length, 0,
        );
        const baseOutputOffset = 1 + requiredNftIndices.length
          + externalReadUtxos.length + outStateOutputCount + externalCallOutputCount + lowLevelCallOutputCount;
        returnEventOutputBase = baseOutputOffset + entryOutputCount + iterationEntryInputs.length
          + satoshiContainerOutputCount + transferCount + tokenContainerTransferCount + emitCount;
        externalCallOutputStart = 1 + requiredNftIndices.length + externalReadUtxos.length
          + outStateOutputCount + iterationEntryInputs.length;
      }

      // Build return-event-index map: groupIndex -> return event output index.
      // X13: the compiler publishes each callee's return event as a slot INSIDE that callee's own block. A callee
      // whose FULL block was assembled carries a paired funding input at that slot, so its return event belongs at
      // (that callee's output base + slot offset). A callee without a full block (a transitive A->B->C leaf) has no
      // such input, so it keeps the legacy tail position appended after the participant region.
      const returnEventIndexMap = new Map<number, number>();
      const isInBlockGroup = (i: number): boolean => externalCallUtxoGroups[i]?.returnEventInBlock === true;
      if (allReturningGroupIndices.length > 0) {
        let cursor = externalCallOutputStart;
        let tailRank = 0;
        for (let i = 0; i < externalCallUtxoGroups.length; i++) {
          const g = externalCallUtxoGroups[i];
          const offset = g.blockLayout?.slots.find((s) => s.kind === 'returnEvent')?.offset;
          if (groupMetas[i].ecSlot.hasReturnValues) {
            returnEventIndexMap.set(i, isInBlockGroup(i) && offset !== undefined
              ? cursor + offset
              : returnEventOutputBase + tailRank++);
          }
          cursor += g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length;
        }
      }

      // Fix data NFT unlockers and create master unlockers with correct hidden params.
      // Uses ABI-driven param resolution: scans each group's ABI inputs for hidden param names
      // and computes values based on the param name and transaction layout.
      let currentInputBase = externalCallInputBase;
      const groupMasterIndices: number[] = []; // per co-spend group: its master's absolute input index
      for (let groupIdx = 0; groupIdx < externalCallUtxoGroups.length; groupIdx++) {
        const group = externalCallUtxoGroups[groupIdx];
        const meta = groupMetas[groupIdx];
        const masterInputIndex = currentInputBase;
        groupMasterIndices[groupIdx] = masterInputIndex;

        // Re-create data NFT unlockers with correct master input index
        group.dataNftUtxos = group.dataNftUtxos.map((nftUtxo) => ({
          ...nftUtxo,
          unlocker: createDataNftUnlocker(
            group.externalContract.inner, masterInputIndex, group.categoryId,
          ),
        }));
        // A full block is what gets serialized, so its dataNft slots must carry the re-created unlockers too.
        if (group.blockInputs && group.blockLayout && group.returnEventInBlock === true) {
          let dataIdx = 0;
          for (const slot of group.blockLayout.slots) {
            if (slot.kind !== 'dataNft') continue;
            const recreated = group.dataNftUtxos[dataIdx++];
            if (recreated && group.blockInputs[slot.offset]) group.blockInputs[slot.offset] = recreated;
          }
        }

        // Build hidden args by scanning the function's ABI inputs for hidden param names
        type AbiEntry = { name: string; inputs: readonly { name: string }[]; externalCalls?: readonly ExternalCallAbi[] };
        const bAbiAll = group.externalContract.inner.artifact.abi as readonly AbiEntry[];
        const bAbiFunc = group.compilerRoute?.abiFunction
          ?? bAbiAll.find((f) => f.name === group.functionName);
        const bAbiInputs = bAbiFunc?.inputs ?? [];
        const routeArgs = group.compilerRoute ? group.compilerRoute.args : group.functionArgs;
        const userArgCount = routeArgs.length;

        let bFinalArgs = [...routeArgs];
        let bReturningSlotIdx = 0;

        // Pre-compute child group indices for transitive param resolution
        let childGroupIndices: number[] | undefined;
        const getChildGroupIndices = (): number[] => {
          if (!childGroupIndices) {
            childGroupIndices = [];
            for (let tIdx = groupIdx + 1; tIdx < externalCallUtxoGroups.length; tIdx++) {
              if (groupMetas[tIdx].parentGroupIndex === groupIdx) {
                childGroupIndices.push(tIdx);
              }
            }
          }
          return childGroupIndices;
        };

        for (let i = userArgCount; i < bAbiInputs.length; i++) {
          const paramName = bAbiInputs[i].name;

          if (group.compilerRoute?.internalArgs
            && Object.prototype.hasOwnProperty.call(group.compilerRoute.internalArgs, paramName)) {
            bFinalArgs.push(group.compilerRoute.internalArgs[paramName]);
          } else if (paramName === '__internal__externalCallInputBase') {
            // Where this function's external call groups start in the input sequence: immediately after B's own
            // co-spent block, which is blockInputs wide when a full block was assembled (X13).
            const thisGroupEnd = currentInputBase
              + (group.blockInputs ? group.blockInputs.length : 1 + group.dataNftUtxos.length);
            bFinalArgs.push(BigInt(thisGroupEnd));
          } else if (paramName === '__internal__msgSenderCategory') {
            bFinalArgs.push(hexToBin(meta.callerCategoryId));
          } else if (paramName === '__internal__blockhashInputIndex') {
            const firstOracleOffset = group.blockLayout?.slots.find(
              (slot) => slot.kind === 'blockhashOracle',
            )?.offset;
            if (firstOracleOffset === undefined) {
              throw new Error('External SCB1 graph blockhash plan has no physical oracle band');
            }
            bFinalArgs.push(BigInt(masterInputIndex + firstOracleOffset));
          } else if (paramName === '__internal__returnOutputIdx') {
            const retIdx = returnEventIndexMap.get(groupIdx);
            if (retIdx !== undefined) {
              bFinalArgs.push(BigInt(retIdx));
            }
          } else if (paramName.startsWith('__internal__externalReturnOutputIdx')) {
            // Find child groups with return values, in order
            const children = getChildGroupIndices();
            const childReturning: number[] = [];
            for (const cIdx of children) {
              if (groupMetas[cIdx].ecSlot.hasReturnValues) {
                childReturning.push(cIdx);
              }
            }
            if (bReturningSlotIdx < childReturning.length) {
              const childRetIdx = returnEventIndexMap.get(childReturning[bReturningSlotIdx]);
              if (childRetIdx !== undefined) {
                bFinalArgs.push(BigInt(childRetIdx));
              }
              bReturningSlotIdx++;
            }
          } else if (paramName.startsWith('__internal__externalCallSelector')) {
            // Resolve selector for child group's target function
            const children = getChildGroupIndices();
            // Parse slot index from suffix: '__internal__externalCallSelector' -> 0, '_externalCallSelectorN' -> N
            const suffix = paramName.slice('__internal__externalCallSelector'.length);
            const slotIdx = suffix === '' ? 0 : parseInt(suffix, 10);
            if (slotIdx < children.length) {
              const childGroup = externalCallUtxoGroups[children[slotIdx]];
              const cAbi = childGroup.externalContract.inner.artifact.abi as readonly { name: string; selector?: string }[];
              const cFunc = cAbi.find((f) => f.name === childGroup.functionName);
              if (cFunc?.selector) {
                bFinalArgs.push(hexToBin(cFunc.selector));
              }
            }
          }
          // Other hidden params (entry flags, collection iters, etc.) will cause
          // an arg count mismatch if present, producing a clear error.
        }

        // Create master unlocker
        let bMasterUnlocker = group.compilerRoute
          ? group.externalContract.inner.createCompilerRouteUnlocker(
            group.compilerRoute.abiFunction, group.compilerRoute.selector,
          )(...bFinalArgs)
          : (group.externalContract.inner.unlock as any)[group.functionName](...bFinalArgs);

        // The external participant's absolute group base is known only here. Resolve its selected SCB1 rows now,
        // place active oracle co-spends at their exact row-band offsets, and leave every inactive slot as the
        // already-created funder. Computed n values are recovered from B's own covenant trace at B's real index.
        if (group.graphBlockhashSelections?.length) {
          if (!group.blockInputs || !group.blockLayout) {
            throw new Error('External SCB1 graph blockhash route has no balanced participant block');
          }
          const firstOracleOffset = group.blockLayout.slots.find(
            (slot) => slot.kind === 'blockhashOracle',
          )?.offset;
          const plan = group.compilerRoute?.abiFunction.graphBlockhashOracle;
          if (firstOracleOffset === undefined || !plan) {
            throw new Error('External SCB1 graph blockhash metadata/layout mismatch');
          }
          const absoluteBase = masterInputIndex + firstOracleOffset;
          const bSc = group.externalContract as StatefulContract;
          const prior: Array<{
            slotOrdinal: number; utxo: Utxo; unlocker: Unlocker; recreate: Output;
          }> = [];
          for (const selection of group.graphBlockhashSelections) {
            const n = isComputedBlockhashKey(selection.readKey)
              ? await bSc._extractGraphBlockhashRead(
                group.masterUtxo as Utxo, bMasterUnlocker, group.dataNftUtxos,
                prior, absoluteBase, selection.slotOrdinal, plan.slotCount, masterInputIndex,
              )
              : bSc.paramBlockhashN(selection.readKey, selection.rowArgs, selection.handler);
            if (n === null) throw new Error(`blockhash: could not resolve external SCB1 read "${selection.readKey}"`);
            const coSpend = await resolveBlockhashCoSpend(this.inner.provider, group.categoryId, n);
            if (!coSpend) throw new Error(`blockhash(${n}): no (n->hash) oracle UTXO at addr(${n})`);
            const physicalOffset = firstOracleOffset + selection.slotOrdinal;
            group.blockInputs[physicalOffset] = { ...coSpend.utxo, unlocker: coSpend.unlocker };
            prior.push({
              slotOrdinal: selection.slotOrdinal, utxo: coSpend.utxo, unlocker: coSpend.unlocker,
              recreate: coSpend.recreateOutput,
            });
            maxBhLocktime = Math.max(maxBhLocktime, coSpend.locktime);
          }
        }
        group.masterUtxo = { ...group.masterUtxo, unlocker: bMasterUnlocker } as UnlockableUtxo;
        // The block's master slot carries the SAME unlocker as group.masterUtxo: the input flattening serializes
        // blockInputs, so a stale block-build-time unlocker there would drop the hidden params resolved here.
        // Extended to in-block returning callees: their __internal__returnOutputIdx is unknown at block-build time.
        if (group.blockInputs && group.blockLayout
          && (group.compilerRoute || group.returnEventInBlock === true)) {
          const masterOffset = group.blockLayout.slots.find((slot) => slot.kind === 'master')?.offset;
          if (masterOffset !== undefined && group.blockInputs[masterOffset]) {
            group.blockInputs[masterOffset] = {
              ...group.blockInputs[masterOffset],
              unlocker: bMasterUnlocker,
            };
          }
        }

        // Advance to next group. A full block occupies blockInputs.length slots (its output-only slots each
        // carry a paired funder), which is what the builder's input flattening emits.
        currentInputBase += group.blockInputs ? group.blockInputs.length : 1 + group.dataNftUtxos.length;
      }

      // Resolve 4-byte hash selector from B's ABI - only for A's DIRECT external calls.
      // Transitive call selectors are handled above as part of B's hidden params.
      const selectorParamCount = abiFunction!.inputs.filter(
        (inp: { name: string }) => inp.name.startsWith('__internal__externalCallSelector'),
      ).length;
      if (selectorParamCount > 0) {
        for (let i = 0; i < directGroupCount; i++) {
          const group = externalCallUtxoGroups[i];
          // A loop-expanded slot (computed-target / array-element loop) owns ONE shared selector param (the covenant
          // checks each co-spent element against it), not one per element - fill it once at the range start, skip
          // the rest, mirroring the per-group master-index fill above.
          const selRange = loopIdxRanges.find((r) => i >= r.start && i < r.start + r.count);
          if (selRange && i !== selRange.start) continue;
          // call/staticcall/delegatecall modes don't inject selector params - skip them
          if (group.callMode === 'call' || group.callMode === 'staticcall' || group.callMode === 'delegatecall') continue;
          // A single-method callee has no witness selector param (its unlocking carries no selector); only groups
          // the compiler marked needsSelectorVerification get a filled selector. Absent (older artifacts) = fill.
          if ((groupMetas[i].ecSlot as { needsSelectorVerification?: boolean })
            .needsSelectorVerification === false) continue;
          const targetSelector = group.compilerRoute
            ? binToHex(group.compilerRoute.selector)
            : (group.externalContract.inner.artifact.abi as readonly { name: string; selector?: string }[])
              .find((f) => f.name === group.functionName)?.selector;
          if (!targetSelector) {
            throw new Error(
              `Function '${group.functionName}' not found in external contract ABI`,
            );
          }
          finalArgs = [...finalArgs, hexToBin(targetSelector)];
        }
      }

      // Per-slot callee master input index (so the covenant reads the RIGHT co-spent callee without a fixed
      // block offset). Matches the compiler: fn-ptr calls always get one; a loop-free MULTI-call function fills
      // every slot's index too (robust when a prior callee's data-NFT count - from an under-declared interface -
      // shifts the fixed offset). A function with any array-element (loop) call keeps the fixed offset (the loop
      // expands into N groups, so a 1:1 runtime fill cannot be aligned).
      const hasLoopSlotAbi = (abiFunction?.externalCalls ?? []).some((ec) => ec.loopArrayVar);
      // A received-value pointer array (fnPtrCall loop slot) gets ONE witness arg: the framed list of its
      // expanded groups' master input indices (`__internal__extcallIdxList<slot>`), in group order - the
      // covenant decodes one per iteration and identity-binds it to arr[i].
      const appendIdxList = (r: { start: number; count: number }): void => {
        const parts: Uint8Array[] = [];
        for (let j = r.start; j < r.start + r.count; j++) {
          parts.push(encodePushdataValue(BigInt(groupMasterIndices[j]), 'bigint'));
        }
        const total = parts.reduce((s, p) => s + p.length, 0);
        const list = new Uint8Array(total);
        let off = 0;
        for (const p of parts) { list.set(p, off); off += p.length; }
        finalArgs = [...finalArgs, list];
      };
      for (let i = 0; i <= directGroupCount; i++) {
        // A zero-instance fnPtrCall loop slot still owns its (empty) witness list arg at its slot position.
        for (const r of loopIdxRanges) {
          if (r.start === i && r.count === 0 && r.fnPtrCall) appendIdxList(r);
        }
        if (i === directGroupCount) break;
        const range = loopIdxRanges.find((r) => i >= r.start && i < r.start + r.count);
        if (range) {
          if (range.fnPtrCall && i === range.start) appendIdxList(range);
          continue; // loop-expanded groups never get per-group index args
        }
        const ecSlot = groupMetas[i].ecSlot as { fnPtrCall?: boolean };
        if (ecSlot.fnPtrCall || (!hasLoopSlotAbi && directGroupCount > 1)) {
          finalArgs = [...finalArgs, BigInt(groupMasterIndices[i])];
        }
      }

      // Append per-slot _externalReturnOutputIdx params for A's args (direct returning calls only)
      const directReturningSlots = externalCalls.filter((ec) => ec.hasReturnValues);
      if (directReturningSlots.length > 0 && returnEventOutputBase >= 0) {
        for (let i = 0; i < directGroupCount; i++) {
          // A loop-expanded returning slot owns ONE shared externalReturnOutputIdx param (the covenant reads the
          // per-iteration event at base + i); fill it once at the range start, skip the rest - same as the selector
          // and master-index fills above (else N return-idx args vs 1 param -> arg-count mismatch).
          const retRange = loopIdxRanges.find((r) => i >= r.start && i < r.start + r.count);
          if (retRange && i !== retRange.start) continue;
          if (groupMetas[i].ecSlot.hasReturnValues) {
            const retOutputIdx = returnEventIndexMap.get(i);
            if (retOutputIdx !== undefined) {
              finalArgs = [...finalArgs, BigInt(retOutputIdx)];
            }
          }
        }
      }
    }

    // Handle external outState reads (reading output state from another contract)
    const externalOutStateReads = abiFunction?.externalOutStateReads;

    if (externalOutStateReads && externalOutStateReads.length > 0) {

      // Determine which outState reads are shared with existing external calls
      const nonSharedReads: { read: typeof externalOutStateReads[0]; overrideIdx: number }[] = [];
      let overrideIdx = externalCalls?.length ?? 0; // outState overrides start after externalCalls

      for (const osRead of externalOutStateReads) {
        const isShared = externalCalls?.some(
          (ec) => ec.interfaceName === osRead.interfaceName && ec.addressParam === osRead.addressParam,
        ) ?? false;

        if (!isShared) {
          nonSharedReads.push({ read: osRead, overrideIdx });
          overrideIdx++;
        }
      }

      // Build UTXOs for non-shared outState reads from .withExternalCall() overrides
      const outStateOverrideCalls = overrides?.externalCalls;
      for (const { read: osRead, overrideIdx: oidx } of nonSharedReads) {
        const callInfo = outStateOverrideCalls?.[oidx];
        if (!callInfo) {
          // Not yet resolved - will be rebuilt when .withExternalCall() is used
          continue;
        }

        // Resolve external category ID from the resolved external contract (address model)
        const externalCategoryId = callInfo.externalContract.categoryId;

        // Get B's on-chain state
        const bState = await callInfo.externalContract.getFullState();
        if (!bState.masterUtxo) {
          throw new Error(
            `External contract master UTXO not found for ${osRead.interfaceName} (category ${externalCategoryId})`,
          );
        }

        const bStateLayout = callInfo.externalContract.inner.stateLayout!;
        const bRequiredNftIndices = osRead.requiredDataNftIndices.length > 0
          ? osRead.requiredDataNftIndices
          : Array.from({ length: bStateLayout.dataNftCount }, (_, i) => i);
        const bDataNfts: UnlockableUtxo[] = [];
        for (const nftIndex of bRequiredNftIndices) {
          const dataNftUtxo = bState.dataNftUtxos[nftIndex];
          if (!dataNftUtxo) {
            throw new Error(
              `External data NFT at index ${nftIndex} not found for ${osRead.interfaceName}`,
            );
          }
          bDataNfts.push({
            ...dataNftUtxo,
            unlocker: createDataNftUnlocker(callInfo.externalContract.inner, 0, externalCategoryId),
          });
        }

        // B's keccak256 side-cars (transitive): the outState read runs B's function, which reads a keccakSideCar
        // slot in B's block, so co-spend + recreate B's branded side-cars (appended after B's data NFTs).
        const bOsAbiFunc = (callInfo.externalContract.inner.artifact.abi as readonly AbiFunction[])
          .find((f) => f.name === callInfo.functionName);
        const bOsKeccak = await this._resolveExternalKeccakSideCars(
          bOsAbiFunc, callInfo.args, externalCategoryId, callInfo.externalContract as StatefulContract | null,
        );

        externalOutStateUtxoGroups.push({
          categoryId: externalCategoryId,
          stateLayout: bStateLayout,
          masterUtxo: bState.masterUtxo,
          dataNftUtxos: bDataNfts,
          requiredDataNftIndices: bRequiredNftIndices,
          functionName: callInfo.functionName,
          functionArgs: callInfo.args,
          externalContract: callInfo.externalContract,
          ...(bOsKeccak.inputs.length > 0 && { keccakInputs: bOsKeccak.inputs, keccakRecreates: bOsKeccak.recreates }),
        });
      }

      // Compute outState input count for base offset adjustments
      outStateInputCount = externalOutStateUtxoGroups.reduce(
        (sum, g) => sum + 1 + g.dataNftUtxos.length, 0,
      );

      // Inject _externalOutStateInputBase if ABI expects it (i.e. not all shared)
      const hasOutStateBaseParam = abiFunction!.inputs.some(
        (inp: { name: string }) => inp.name === '__internal__externalOutStateInputBase',
      );
      if (hasOutStateBaseParam) {
        const outStateInputBase = 1 + requiredNftIndices.length + externalReadUtxos.length;
        finalArgs = [...finalArgs, BigInt(outStateInputBase)];
      }

      // Fix data NFT unlockers with correct master input index and create B's master unlockers
      const outStateBase = 1 + requiredNftIndices.length + externalReadUtxos.length;
      let currentOutStateBase = outStateBase;
      for (let groupIdx = 0; groupIdx < externalOutStateUtxoGroups.length; groupIdx++) {
        const group = externalOutStateUtxoGroups[groupIdx];
        const masterInputIndex = currentOutStateBase;

        group.dataNftUtxos = group.dataNftUtxos.map((nftUtxo) => ({
          ...nftUtxo,
          unlocker: createDataNftUnlocker(
            group.externalContract.inner, masterInputIndex, group.categoryId,
          ),
        }));

        // If callee uses msg.sender, append our category
        const bAbiFuncs = group.externalContract.inner.artifact.abi as readonly { name: string; usesMsgSender?: boolean }[];
        const bAbiFunc = bAbiFuncs.find((f) => f.name === group.functionName);
        let bFinalArgs = [...group.functionArgs];
        if (bAbiFunc?.usesMsgSender) {
          // EVM delegatecall preserves the original caller. A zero category selects tx.origin in emitMsgSender;
          // passing the proxy category would incorrectly make onlyOwner compare against the proxy itself.
          bFinalArgs = [...bFinalArgs, group.callMode === 'delegatecall'
            ? new Uint8Array(32) : hexToBin(this.categoryId).reverse()];
        }

        // Create B's master unlocker
        const bMasterUnlocker = (group.externalContract.inner.unlock as any)[group.functionName](
          ...bFinalArgs,
        );
        group.masterUtxo = { ...group.masterUtxo, unlocker: bMasterUnlocker } as UnlockableUtxo;

        currentOutStateBase += 1 + group.dataNftUtxos.length;
      }
    }

    // Handle low-level calls (address.call / address.staticcall)
    const lowLevelCalls = abiFunction?.lowLevelCalls;
    let lowLevelCallUtxoGroups: ExternalCallUtxoGroup[] = [];
    let lowLevelCallRawInputs: UnlockableUtxo[] = [];
    let lowLevelCallInputBase = 0; // hoisted: the delegatecall-index auto-fill (below) needs it in this scope
    // Output-only (event/transfer) slots contributed by delegatecall'd impls: they are verified at
    // proxyMaster+offset, so they reserve funder inputs + outputs in the PROXY block, shifting the co-spent
    // impl UTXOs after them. Populated once below; drives lowLevelCallInputBase, block layout, and funders.
    let delegateEventSlots: { kind: BlockSlotKind; offset: number; slotIndex?: number }[] = [];
    // X56. Where a delegatecall'd impl that ALSO returns resolves its own return event, once the co-spent
    // implementation is known. The forwarder's reserved returnEvent slot moves here; the impl's event keeps the
    // position the forwarder had reserved for the return.
    let delegateReturnEventOffset: number | undefined;

    // Track per-group proxy master index for delegatecall composability
    const groupProxyMasterIndices: number[] = [];

    if (lowLevelCalls && lowLevelCalls.length > 0) {
      const resolvedCalls = overrides?.calls ?? [];

      for (let i = 0; i < lowLevelCalls.length; i++) {
        const callInfo = resolvedCalls[i];
        if (!callInfo) {
          // Low-level calls require explicit .withCall() - skip if not provided
          // (the builder will be rebuilt when .withCall() is used)
          continue;
        }

        if (callInfo.type === 'stateful') {
          if (lowLevelCalls[i].callMode === 'delegatecall' && (callInfo.proxyMasterIndex ?? 0) !== 0) {
            throw new Error('Delegatecall proxyMasterIndex must be 0; the proxy state block is placed first.');
          }
          const bState = callInfo.contract.inner.artifact.delegateOnly
            ? await (callInfo.contract as StatefulContract)._getMasterOnlyState()
            : await callInfo.contract.getFullState();
          const bStateLayout = callInfo.contract.inner.stateLayout!;
          const bCategoryId = callInfo.contract.categoryId;

          if (!bState.masterUtxo) {
            throw new Error(
              `Low-level call target master UTXO not found (category ${bCategoryId})`,
            );
          }

          // Include all data NFTs
          const bRequiredNftIndices = callInfo.contract.inner.artifact.delegateOnly
            ? []
            : Array.from({ length: bStateLayout.dataNftCount }, (_, idx) => idx);
          const bDataNfts: UnlockableUtxo[] = [];
          for (const nftIndex of bRequiredNftIndices) {
            const dataNftUtxo = bState.dataNftUtxos[nftIndex];
            if (!dataNftUtxo) {
              throw new Error(
                `Low-level call target data NFT at index ${nftIndex} not found (category ${bCategoryId})`,
              );
            }
            bDataNfts.push({
              ...dataNftUtxo,
              unlocker: createDataNftUnlocker(callInfo.contract.inner, 0, bCategoryId),
            });
          }

          lowLevelCallUtxoGroups.push({
            categoryId: bCategoryId,
            stateLayout: bStateLayout,
            masterUtxo: bState.masterUtxo,
            dataNftUtxos: bDataNfts,
            requiredDataNftIndices: bRequiredNftIndices,
            functionName: callInfo.functionName,
            functionArgs: callInfo.args,
            externalContract: callInfo.contract,
            callMode: lowLevelCalls[i].callMode,
          });
          groupProxyMasterIndices.push(callInfo.proxyMasterIndex ?? 0);
        } else {
          lowLevelCallRawInputs.push(callInfo.utxo);
        }
      }

      // Compute _callInputIndex values
      const externalCallInputCount = externalCallUtxoGroups.reduce(
        (sum, g) => sum + 1 + g.dataNftUtxos.length, 0,
      );
      // Reserve the delegatecall'd impl's EVENT slots in the proxy block (its covenant verifies them at
      // proxyMaster+offset). Only handled when the impl fn's block is master + dataNfts + events, so the slot
      // offsets align 1:1 with the proxy block. A delegate that also transfers, reads a mapping/keccak/blockhash,
      // etc. has other slots interleaved that we cannot reserve in the proxy block - unsupported here (fail closed).
      for (const g of lowLevelCallUtxoGroups) {
        if (g.callMode !== 'delegatecall') continue;
        const gFn = (g.externalContract.inner.artifact.abi as readonly { name: string; blockLayout?: FunctionBlockLayout }[])
          .find((f) => f.name === g.functionName);
        const extra = (gFn?.blockLayout?.slots ?? []).filter((s) => s.kind !== 'master' && s.kind !== 'dataNft');
        if (extra.length === 0
          || !extra.every((s) => s.kind === 'event' || s.kind === 'entry' || s.kind === 'returnEvent')) continue;
        const existingCallSlot = abiFunction?.blockLayout?.slots.find((s) => s.kind === 'lowLevelCall');
        const callOffset = existingCallSlot?.offset ?? (abiFunction?.blockLayout?.blockSize ?? 1);
        if (!existingCallSlot && !delegateEventSlots.some((s) => s.kind === 'lowLevelCall')) {
          delegateEventSlots.push({ kind: 'lowLevelCall', offset: callOffset });
        }
        // X12. A `delegateOnly` implementation never co-spends or materializes its OWN data NFTs (see
        // bRequiredNftIndices above), so nothing occupies those positions and its covenant resolves an
        // output-only slot as `OP_INPUTINDEX + (layoutOffset - dataNftSlotsBelow)`. Drop the same slots here or
        // the reservation and the check land one index apart per data NFT. A non-delegateOnly implementation
        // keeps its data-NFT positions, so its offsets are used verbatim.
        const implIsDelegateOnly = g.externalContract.inner.artifact.delegateOnly === true;
        const implDataNftSlots = (gFn?.blockLayout?.slots ?? []).filter((s) => s.kind === 'dataNft');
        for (const s of extra) {
          const below = implIsDelegateOnly
            ? implDataNftSlots.filter((d) => d.offset < s.offset).length : 0;
          const offset = callOffset + s.offset - below;
          // X56. The implementation's own returnEvent is implementation-relative like every other output-only
          // slot, so the proxy's reserved returnEvent has to MOVE to that position rather than have a second
          // one appended beside it: `getBlockSlotOffset` returns the first slot of a kind, and the forwarder's
          // would win. Recorded here and applied to the effective layout and to __internal__returnOutputIdx,
          // which is what emitReturnEventCovenantVerification actually reads.
          if (s.kind === 'returnEvent') { delegateReturnEventOffset = offset; continue; }
          delegateEventSlots.push({
            kind: s.kind,
            offset,
            ...(s.slotIndex !== undefined && { slotIndex: s.slotIndex }),
          });
        }
      }
      // The forwarder's own offset was computed before the co-spent implementation was known; only now is the
      // implementation-relative position available. A plain send materializes no return event, so only the
      // layout slot moves there - the witness stays -1 and the covenant skips the check entirely.
      if (delegateReturnEventOffset !== undefined && returnEmitOutputIndex >= 0) {
        returnEmitBlockOffset = delegateReturnEventOffset;
        returnEmitOutputIndex = (overrides?.blockBase ?? 0) + returnEmitBlockOffset;
      }
      const denseCallInputBase = 1 + requiredNftIndices.length
        + externalReadUtxos.length + outStateInputCount + externalCallInputCount;
      // A plain send intentionally materializes no returnEvent input/output; .emitReturn() materializes both.
      // Keep the facet master aligned at the same input/output index in either mode. All other fixed block slots
      // are materialized, so blockSize minus an inactive return slot remains authoritative for positional gaps.
      const inactiveReturnSlots = returnEmitOutputIndex < 0
        ? (abiFunction?.blockLayout?.slots.filter((s) => s.kind === 'returnEvent').length ?? 0) : 0;
      const materializedBlockSize = (abiFunction?.blockLayout?.blockSize ?? 0) - inactiveReturnSlots;
      const hasDelegatecallGroup = lowLevelCallUtxoGroups.some((g) => g.callMode === 'delegatecall');
      const explicitLowLevelCallOffset = abiFunction?.blockLayout?.slots
        .find((slot) => slot.kind === 'lowLevelCall')?.offset
        ?? delegateEventSlots.find((slot) => slot.kind === 'lowLevelCall')?.offset;
      lowLevelCallInputBase = hasDelegatecallGroup
        ? explicitLowLevelCallOffset ?? Math.max(materializedBlockSize, denseCallInputBase)
        : denseCallInputBase;

      // Fix data NFT unlockers with correct master input index
      let currentBase = lowLevelCallInputBase;
      for (let groupLocalIdx = 0; groupLocalIdx < lowLevelCallUtxoGroups.length; groupLocalIdx++) {
        const group = lowLevelCallUtxoGroups[groupLocalIdx];
        const masterInputIndex = currentBase;
        group.dataNftUtxos = group.dataNftUtxos.map((nftUtxo) => ({
          ...nftUtxo,
          unlocker: createDataNftUnlocker(
            group.externalContract.inner, masterInputIndex, group.categoryId,
          ),
        }));

        // Create master UTXO unlocker with function args
        const bArt = group.externalContract.inner.artifact;
        type BAbiEntry = { name: string; selector?: string; inputs: readonly { name: string; type: string }[] };
        const bAbi = bArt.abi as readonly BAbiEntry[];
        const bFunc = bAbi.find((f) => f.name === group.functionName);
        if (bFunc) {
          let visibleIndex = 0;
          let batchWitnessIndex = 0;
          const encodedArgs: any[] = bFunc.inputs.map((inp) => {
            if (!inp.name.startsWith('__internal__')) return group.functionArgs[visibleIndex++];
            if (inp.name === '__internal__returnOutputIdx') return BigInt(returnEmitOutputIndex);
            if (inp.name === '__internal__msgSenderCategory') return new Uint8Array(32);
            if (inp.name === '__internal__proxyMasterIndex') {
              return BigInt(groupProxyMasterIndices[groupLocalIdx] ?? 0);
            }
            if (inp.name === '__internal__externalCallInputBase') {
              return BigInt(masterInputIndex + 1 + group.dataNftUtxos.length);
            }
            if (/^__internal__extcallMasterIdx\d+$/.test(inp.name)) {
              return BigInt(masterInputIndex + 1 + group.dataNftUtxos.length);
            }
            const selectorWitness = inp.name.match(/^__internal__externalCallSelector(\d+)$/);
            if (selectorWitness) {
              const slot = Number(selectorWitness[1]);
              const call = (bFunc as AbiFunction).externalCalls?.[slot];
              const interfaces = (bArt.externalInterfaces ?? []) as readonly {
                name: string;
                abi: readonly { name: string; selector?: string }[];
              }[];
              const iface = interfaces.find((candidate) => candidate.name === call?.interfaceName);
              const target = iface?.abi.find((candidate) => candidate.name === call?.functionName);
              return target?.selector ? hexToBin(target.selector) : new Uint8Array(4);
            }
            if (/^__internal__externalReturnOutputIdx\d+$/.test(inp.name)) return -1n;
            if (inp.name.startsWith('__internal__c2Batch')) {
              const value = entryBatchWitnesses[batchWitnessIndex++];
              if (value !== undefined) {
                // C2 batch proofs are offsets from the active contract's master input. A delegated
                // implementation executes with the proxy master as its active/master input, while its
                // block-layout offsets are relative to the implementation master. Rebase only physical
                // proof inputs; negative values are covenant sentinels and remain unchanged.
                if (/^__internal__c2BatchProof_\d+$/.test(inp.name)
                  && typeof value === 'bigint' && value >= 0n) {
                  return value + BigInt(masterInputIndex);
                }
                if (/^__internal__c2BatchPredOut_\d+$/.test(inp.name)
                  && typeof value === 'bigint' && value >= 0n) {
                  return value + BigInt(masterInputIndex);
                }
                return value;
              }
            }
            const witness = inp.name.match(/^__internal__valueWitness_(\d+)$/);
            if (witness) return entryValueWitnesses[Number(witness[1])] ?? new Uint8Array();
            throw new Error(`Unsupported SDK-filled delegate parameter '${inp.name}' on ${group.functionName}.`);
          });

          group.masterUtxo = {
            ...(group.masterUtxo as UnlockableUtxo),
            unlocker: group.externalContract.inner.unlock[group.functionName]!(...encodedArgs),
          };
        }

        currentBase += 1 + group.dataNftUtxos.length;
      }


    }

    // Handle token container accesses
    const tokenContainerAccesses = abiFunction?.tokenContainerAccesses;
    let tokenContainers: TokenContainerInfo[] = [];
    const tokenContainerLockingBytecodes = new Map<string, Uint8Array>();

    if (tokenContainerAccesses && tokenContainerAccesses.length > 0) {
      for (let slotIndex = 0; slotIndex < tokenContainerAccesses.length; slotIndex++) {
        const access = tokenContainerAccesses[slotIndex];

        // Resolve the token container category from the function argument by keyParam name
        const keyParamIndex = abiFunction!.inputs.findIndex((inp) => inp.name === access.keyParam);
        if (keyParamIndex < 0) {
          throw new Error(`Token container key parameter '${access.keyParam}' not found in function inputs`);
        }
        const tokenContainerCategoryValue = args[keyParamIndex];
        const tokenContainerCategoryId = tokenContainerCategoryValue instanceof Uint8Array
          ? binToHex(tokenContainerCategoryValue) : String(tokenContainerCategoryValue);

        // Build the container covenant locking bytecode
        const covenantScript = buildTokenContainerCovenantScript(
          hexToBin(this.categoryId), hexToBin(tokenContainerCategoryId),
        );
        const lockingBytecode = scriptToLockingBytecode(covenantScript, this.inner.addressType);
        tokenContainerLockingBytecodes.set(tokenContainerCategoryId, lockingBytecode);

        // Discover container UTXO on-chain
        const containerAddress = getTokenContainerAddress(this.inner, this.categoryId, tokenContainerCategoryId);
        let containerUtxo: Utxo | undefined;
        try {
          const containerUtxos = await this.inner.provider.getUtxos(containerAddress);
          containerUtxo = containerUtxos.find(
            (u) => u.token?.category === tokenContainerCategoryId,
          );
        } catch {
          // Container doesn't exist yet
        }


        const exists = !!containerUtxo;
        const tokenContainerUnlocker = createTokenContainerUnlocker(
          this.inner, 0, this.categoryId, tokenContainerCategoryId,
        );

        tokenContainers.push({
          keyParam: access.keyParam,
          tokenContainerSlotIndex: slotIndex,
          tokenContainerCategoryId,
          exists,
          utxo: containerUtxo ? { ...containerUtxo, unlocker: tokenContainerUnlocker } : undefined,
        });
      }

    }


    // Satoshi container: included when function has transfers.
    // Note: payable functions use msg.value which scans outputs via balance loops
    // and does NOT require a satoshi container block slot - the compiler only
    // generates a satoshi container block slot for this.transfer() functions.
    const transferCount = abiFunction?.transferCount ?? 0;
    const needsSatoshiContainer = transferCount > 0;
    let satoshiContainerUtxo: UnlockableUtxo | undefined;
    let satoshiContainerLockingBytecode: Uint8Array | undefined;

    if (needsSatoshiContainer) {
      // Discover satoshi container UTXO
      const satoshiContainerAddress = getSatoshiContainerAddress(this.inner, this.categoryId);
      const containerUtxos = await this.inner.provider.getUtxos(satoshiContainerAddress);
      const containerUtxo = containerUtxos.find((u) => !u.token);
      if (!containerUtxo) {
        throw new Error(
          'Satoshi container UTXO not found. Deploy the contract with initialBalance or '
          + `fund the satoshi container at ${satoshiContainerAddress}`,
        );
      }

      const satoshiContainerUnlocker = createSatoshiContainerUnlocker(this.inner, 0, this.categoryId);
      satoshiContainerUtxo = { ...containerUtxo, unlocker: satoshiContainerUnlocker };

      // Build locking bytecode for preservation output
      const covenantScript = buildSatoshiContainerCovenantScript(hexToBin(this.categoryId));
      satoshiContainerLockingBytecode = scriptToLockingBytecode(covenantScript, this.inner.addressType);
    }





    // B8: a returning entry function takes a hidden __internal__returnOutputIdx. Default it to -1 (the
    // covenant computes the return value but does not emit it on-chain); opt-in emit sets a real index.
    if (abiFunction) {
      const returnIdxPos = abiFunction.inputs.findIndex((inp) => inp.name === '__internal__returnOutputIdx');
      if (returnIdxPos >= 0 && finalArgs.length < abiFunction.inputs.length) {
        finalArgs = [
          ...finalArgs.slice(0, returnIdxPos),
          BigInt(returnEmitOutputIndex),
          ...finalArgs.slice(returnIdxPos),
        ];
      }
    }

    // C1/piece-3: a pinned delegatecall proxy takes a hidden __internal__delegateInputIndex - the input index of
    // the co-spent delegate master, which the proxy pins (OP_UTXOBYTECODE[idx] == impl). Auto-fill it with the
    // delegatecall group's master position so a covenant-impl proxy needs no manual witness.
    if (abiFunction) {
      const dIdxPos = abiFunction.inputs.findIndex((inp) => inp.name === '__internal__delegateInputIndex');
      if (dIdxPos >= 0 && finalArgs.length < abiFunction.inputs.length) {
        const delegateGroupIdx = lowLevelCallUtxoGroups.findIndex((g) => g.callMode === 'delegatecall');
        const delegatePos = delegateGroupIdx < 0 ? lowLevelCallInputBase
          : lowLevelCallInputBase + lowLevelCallUtxoGroups
            .slice(0, delegateGroupIdx).reduce((s, g) => s + 1 + g.dataNftUtxos.length, 0);
        finalArgs = [
          ...finalArgs.slice(0, dIdxPos),
          BigInt(delegatePos),
          ...finalArgs.slice(dIdxPos),
        ];
      }
    }

    // Validate that the total argument count (user + synthetic) matches the ABI.
    // A mismatch here indicates the SDK's synthetic parameter injection is out of sync
    // with the compiler's parameter injection in SymbolTableTraversal.
    if (abiFunction && finalArgs.length !== abiFunction.inputs.length) {
      throw new Error(
        `Internal error: argument count mismatch for function '${functionName}'. `
        + `SDK produced ${finalArgs.length} args but ABI expects ${abiFunction.inputs.length}. `
        + 'This likely indicates a compiler/SDK version mismatch.',
      );
    }

    // Create unlockable UTXOs (after all synthetic params are appended to finalArgs)
    // Contract.ts registers fallback/receive unlockers as 'fallback'/'receive' on the multi-function path,
    // but a single-function contract registers under the plain ABI name ('__fallback'/'__receive'). Prefer
    // the mapped name, fall back to the ABI name so receive/fallback-only contracts still dispatch.
    const unlockName = functionName === '__fallback' ? 'fallback'
      : functionName === '__receive' ? 'receive' : functionName;
    const unlockFn = overrides?.compilerRouteSelector && abiFunction
      ? this.inner.createCompilerRouteUnlocker(abiFunction, overrides.compilerRouteSelector)
      : ((this.inner.unlock as any)[unlockName] ?? (this.inner.unlock as any)[functionName]);
    const masterUnlocker = unlockFn(...finalArgs);
    const blockBase = overrides?.blockBase ?? 0;
    const dataNftUnlockers = filteredDataNftUtxos.map(
      () => createDataNftUnlocker(this.inner, blockBase, this.categoryId),
    );

    // blockhash(n): resolve the oracle co-spends now that the complete master unlocker exists (the computed-n
    // extraction probe needs it - it carries the blockhash slot base index). Ordered by slot; the builder
    // places them at the consecutive blockhashOracle slots and setLocktime(maxBhLocktime) below.
    const graphSelections = (abiFunction as (AbiFunction & {
      graphBlockhashSelections?: GraphBlockhashSelection[];
    }) | undefined)?.graphBlockhashSelections;
    if (graphSelections?.length && this.categoryId) {
      const resolved: Array<NonNullable<Awaited<ReturnType<typeof resolveBlockhashCoSpend>>>> = [];
      const graphPrior: Array<{
        slotOrdinal: number; utxo: Utxo; unlocker: Unlocker; recreate: Output;
      }> = [];
      const graphBase = this.blockhashSlotBase(abiFunction).base;
      const graphSlotCount = abiFunction!.graphBlockhashOracle!.slotCount;
      for (const selection of graphSelections) {
        const n = isComputedBlockhashKey(selection.readKey)
          ? await this._extractGraphBlockhashRead(
            masterUtxo, masterUnlocker, filteredDataNftUtxos, graphPrior,
            graphBase, selection.slotOrdinal, graphSlotCount,
          )
          : this.paramBlockhashN(selection.readKey, selection.rowArgs, selection.handler);
        if (n === null) throw new Error(`blockhash: could not resolve SCB1 row read "${selection.readKey}"`);
        const coSpend = await resolveBlockhashCoSpend(this.inner.provider, this.categoryId, n);
        if (!coSpend) throw new Error(`blockhash(${n}): no (n->hash) oracle UTXO at addr(${n})`);
        resolved.push(coSpend);
        graphPrior.push({
          slotOrdinal: selection.slotOrdinal, utxo: coSpend.utxo, unlocker: coSpend.unlocker,
          recreate: coSpend.recreateOutput,
        });
      }
      blockhashCoSpendUtxos = resolved.map((cs) => ({ ...cs.utxo, unlocker: cs.unlocker }));
      blockhashCoSpendSlotOrdinals = graphSelections.map((selection) => selection.slotOrdinal);
      maxBhLocktime = resolved.reduce((m, cs) => Math.max(m, cs.locktime), 0);
    } else if (abiFunction?.blockhashReads && abiFunction.blockhashReads.length > 0 && this.categoryId) {
      const { base, count } = this.blockhashSlotBase(abiFunction);
      const resolved = await this._resolveBlockhashCoSpends(
        abiFunction, args, base, count, masterUtxo, masterUnlocker, filteredDataNftUtxos,
      );
      blockhashCoSpendUtxos = resolved.map((cs) => ({ ...cs.utxo, unlocker: cs.unlocker }));
      maxBhLocktime = resolved.reduce((m, cs) => Math.max(m, cs.locktime), 0);
    }

    // keccak256: resolve the compute side-cars now that the master unlocker (and its args) exists. The builder
    // positions them at the keccakSideCar slots and recreates each with its committed result R_i.
    let keccakLoopSideCars: UnlockableUtxo[] = [];
    let keccakLoopRecreates: Output[] = [];
    // Front-region co-spends (read-only data NFTs then blockhash oracles, in block-layout slot order) sit before
    // the keccak side-cars; thread them into the probes so keccak works alongside external reads / blockhash.
    const keccakFrontRegion = [...externalReadUtxos, ...blockhashCoSpendUtxos];
    if (abiFunction?.keccakLoopReads && this.categoryId) {
      // Dynamic loop: N (runtime) trailing side-cars, N + preimages found by a progressive VM probe.
      const loop = await this._resolveStatefulKeccakLoop(
        abiFunction, masterUtxo, masterUnlocker, filteredDataNftUtxos, dataNftUnlockers,
        keccakFrontRegion, maxBhLocktime,
      );
      keccakLoopSideCars = loop.sideCars;
      keccakLoopRecreates = loop.recreates;
    } else if (abiFunction?.keccakCompute && this.categoryId) {
      const resolved = await this._resolveKeccakComputeCoSpends(abiFunction, args, {
        masterUtxo, masterUnlocker, dataNftUtxos: filteredDataNftUtxos, dataNftUnlockers,
        frontRegionInputs: keccakFrontRegion, locktime: maxBhLocktime,
      });
      keccakComputeCoSpendUtxos = resolved.map((cs) => ({ ...cs.utxo, unlocker: cs.unlocker }));
      keccakComputeCommitments = resolved.map((cs) => binToHex(cs.commitment));
    }
    if (abiFunction?.ecrecoverCompute && this.categoryId) {
      const resolved = await this._resolveEcrecoverComputeCoSpends(abiFunction, args);
      ecrecoverComputeCoSpendUtxos = resolved.map((cs) => ({ ...cs.utxo, unlocker: cs.unlocker }));
      ecrecoverComputeRecreates = resolved.map((cs) => cs.recreate);
    }

    const unlockableMaster = {
      ...masterUtxo,
      unlocker: masterUnlocker,
    };

    const unlockableDataNfts = filteredDataNftUtxos.map((nftUtxo, i) => ({
      ...nftUtxo,
      unlocker: dataNftUnlockers[i],
    }));

    // Compute event definitions and locking bytecodes for functions that emit events. A delegatecall'd (proxy)
    // impl emits against the PROXY's runtime master (this.categoryId) via emitMasterInputIndex=proxyMasterIndex, so
    // its event NFT lands in the PROXY's block (proxyMaster+offset). __forward itself has no emits, so also collect
    // the delegate impl's emits + event definitions here - the block layout is extended below to reserve the slot.
    const emitInfos = [...(abiFunction?.emits ?? [])];
    const eventDefs = [...(this.inner.artifact.events ?? [])];
    for (const g of lowLevelCallUtxoGroups) {
      if (g.callMode !== 'delegatecall') continue;
      const gArt = g.externalContract.inner.artifact;
      const gFn = (gArt.abi as readonly { name: string; emits?: readonly EmitAbi[] }[])
        .find((f) => f.name === g.functionName);
      if (gFn?.emits) emitInfos.push(...gFn.emits);
      for (const ev of gArt.events ?? []) {
        if (!eventDefs.some((e) => e.signature === ev.signature)) eventDefs.push(ev);
      }
    }
    const eventNftLockingBytecodes = new Map<string, Uint8Array>();
    if (emitInfos.length > 0) {
      for (const emitInfo of emitInfos) {
        const eventDef = eventDefs.find((e) => e.signature === emitInfo.eventSignature);
        const isAnonymous = eventDef?.anonymous === true;
        const covenantScript = isAnonymous
          ? buildAnonymousEventNftCovenantScript(hexToBin(this.categoryId))
          : buildEventNftCovenantScript(
            hexToBin(this.categoryId), computeEventNameHash(emitInfo.eventSignature),
          );
        eventNftLockingBytecodes.set(
          emitInfo.eventSignature,
          scriptToLockingBytecode(covenantScript, this.inner.addressType),
        );
      }
    }

    // Dynamic-storage vars (string / unbounded bytes) WRITTEN by this function: chunk NFTs at a per-var
    // entry covenant address. Only written vars (dynamicWrites) get old chunks consumed + new ones created;
    // read-only or untouched vars must be left alone, else their chunks would be wrongly destroyed.
    const dynamicWrites = [...(abiFunction?.dynamicWrites ?? [])];
    for (const g of lowLevelCallUtxoGroups) {
      if (g.callMode !== 'delegatecall') continue;
      const gFn = (g.externalContract.inner.artifact.abi as readonly {
        name: string;
        dynamicWrites?: readonly string[];
      }[]).find((f) => f.name === g.functionName);
      for (const name of gFn?.dynamicWrites ?? []) {
        if (!dynamicWrites.includes(name)) dynamicWrites.push(name);
      }
    }
    const dynamicVarInfos = (stateLayout.variables ?? [])
      .filter((v) => v.dynamic && dynamicWrites.includes(v.name));
    const dynamicChunkVars = dynamicVarInfos.map((v) => ({
      name: v.name,
      type: v.type,
      lockingBytecode: scriptToLockingBytecode(
        buildEntryNftCovenantScript(hexToBin(this.categoryId), computeCollectionHash(dynamicChunkSignature(v.name, v.type))),
        this.inner.addressType,
      ),
    }));
    // Old chunk UTXOs to consume (destroy) on this write - fetched from each dynamic var's chunk address,
    // ordered by chunkIndex. The order matters for element ops (read-modify-write): the on-chain read loop
    // reassembles from these same inputs and requires input blockSize+i to be chunk i.
    const dynamicChunkInputs: UnlockableUtxo[] = [];
    for (const v of dynamicVarInfos) {
      const chunkAddr = getDynamicChunkAddress(this.inner, this.categoryId, v.name, v.type);
      const utxos = await this.inner.provider.getUtxos(chunkAddr);
      const chunks = utxos
        .filter((utxo) => utxo.token?.category === this.categoryId
          && utxo.token?.nft?.capability === 'mutable'
          && utxo.token?.nft?.commitment && utxo.token.nft.commitment.length > 0)
        .map((utxo) => ({ utxo, chunkIndex: parseChunkCommitment(utxo.token!.nft!.commitment).chunkIndex }))
        .sort((a, b) => a.chunkIndex - b.chunkIndex);
      for (const { utxo } of chunks) {
        const unlocker = createDynamicChunkUnlocker(
          this.inner, overrides?.blockBase ?? 0, this.categoryId, v.name, v.type,
        );
        dynamicChunkInputs.push({ ...utxo, unlocker });
      }
    }

    // P5b overwrite GC: consume the OLD value chunks (same slot, old digest) of an overwritten long value so they
    // do not orphan as dust. Co-spent (destroyed) with flag=1; the covenant does not verify them (the new chunks
    // are pinned), so this is a pure reclaim. Digest-keyed filter reclaims only the exact old version.
    for (const gc of valueChunkGc) {
      const gcSlot = hexToBin(gc.slotHex);
      const gcRoot = hexToBin(gc.oldDigestHex);
      const chunkAddr = getValueChunkAddress(this.inner, this.categoryId, gc.collection, gcSlot, gcRoot);
      const oldChunks = (await this.inner.provider.getUtxos(chunkAddr)).filter((u) =>
        u.token?.category === this.categoryId && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0);
      for (const utxo of oldChunks) {
        dynamicChunkInputs.push({ ...utxo, unlocker:
          createValueChunkUnlocker(
            this.inner, overrides?.blockBase ?? 0, this.categoryId, gc.collection, gcSlot, gcRoot,
          ) });
      }
    }

    // Collections written by a runtime loop (`for(i<n) m[k[i]]=v[i]`): N new entry NFTs at the collection's
    // entry covenant address (N derived from the VM trace). Mirrors dynamicChunkVars (variable trailing outputs).
    const entryLoopWrites = abiFunction?.entryLoopWrites ?? [];
    // Trailing C2 output indices are part of the covenant ABI. Fixed batches are assigned bases in
    // sortedBatchInfo order (first-access order), which can differ from state-layout declaration order. Preserve
    // that order here or two collections written out of declaration order receive each other's locking bytecode.
    const orderedLoopCollections: string[] = [];
    const addLoopCollection = (name: string): void => {
      if (!orderedLoopCollections.includes(name)) orderedLoopCollections.push(name);
    };
    for (const batch of abiFunction?.sortedBatchInfo ?? []) addLoopCollection(batch.collection);
    for (const name of entryLoopWrites) addLoopCollection(name);
    for (const name of sortedLoopCommitments.keys()) addLoopCollection(name);
    for (const name of batchPredCommitments.keys()) addLoopCollection(name);
    // Delegate entry metadata is grafted from the implementation after the proxy ABI has been selected, so the
    // proxy's entryLoopWrites cannot advertise a scalar C2 INSERT. The insertion plan itself is authoritative.
    for (const ins of sortedInserts) addLoopCollection(ins.collection);
    const loopEntryVars = orderedLoopCollections.map((name) => ({
      collection: name,
      lockingBytecode: getEntryNftLockingBytecode(this.inner, this.categoryId, name),
    }));

    // Extend the block layout with the event/transfer slots of any delegatecall'd impl. A delegate fn's event is
    // verified at proxyMaster+offset (emitMasterInputIndex=proxyMasterIndex), which is INSIDE the proxy's block -
    // so the proxy must reserve those output-only slots (funder input + event output), shifting the co-spent impl
    // UTXOs after them. __forward's own layout has none. Offsets align: proxy blockSize == impl master+dataNfts.
    let effectiveBlockLayout = abiFunction?.blockLayout;
    // X56. Relocate - never duplicate - the forwarder's returnEvent slot when the impl resolves its own return
    // event at a DIFFERENT index in this block. Unconditional on the send mode: two slots at one offset would
    // have the funder loop position the same index twice, and a plain send has to keep the event where it is.
    // A returning implementation with no event resolves to the offset the forwarder already published, so this
    // is a no-op there and the layout object is left exactly as it was.
    const returnSlotMoved = delegateReturnEventOffset !== undefined
      && effectiveBlockLayout?.slots.some((s) => s.kind === 'returnEvent' && s.offset !== delegateReturnEventOffset);
    if (effectiveBlockLayout && returnSlotMoved) {
      effectiveBlockLayout = {
        ...effectiveBlockLayout,
        slots: effectiveBlockLayout.slots.map((s) => (s.kind === 'returnEvent'
          ? { ...s, offset: delegateReturnEventOffset! } : s)),
      };
    }
    if (effectiveBlockLayout && (delegateEventSlots.length > 0 || returnSlotMoved)) {
      const maxOff = Math.max(
        effectiveBlockLayout.blockSize - 1,
        ...delegateEventSlots.map((s) => s.offset),
        ...(returnSlotMoved ? [delegateReturnEventOffset!] : []),
      );
      effectiveBlockLayout = { blockSize: maxOff + 1, slots: [...effectiveBlockLayout.slots, ...delegateEventSlots] };
    }

    const builder = new StatefulTransactionBuilder({
      provider: this.inner.provider,
      // A relaxed mock may intentionally execute very large scripts/transactions. At the normal 1 sat/byte
      // relay floor, a valid call can therefore exceed the production-oriented 50k absolute cap. Bound the mock
      // default by its configured maximum transaction size; the per-byte safety cap remains enforced below.
      maximumFeeSatoshis: this.inner.provider.policy?.enforceDust === false
        ? BigInt(this.inner.provider.consensusLimits?.maximumTransactionBytes ?? 10_000_000)
        : 50000n,
      checkMinRelayFee: true,
      masterUtxo: unlockableMaster,
      dataNftUtxos: unlockableDataNfts,
      stateLayout,
      categoryId: this.categoryId,
      requiredNftIndices: [...requiredNftIndices],
      entryNfts,
      entryAccesses,
      entryNftLockingBytecodes,
      ...(dynamicChunkVars.length > 0 && { dynamicChunkVars }),
      ...(dynamicChunkInputs.length > 0 && { dynamicChunkInputs }),
      ...(loopEntryVars.length > 0 && { loopEntryVars }),
      tokenContainers,
      tokenContainerLockingBytecodes,
      ...(satoshiContainerUtxo && { satoshiContainerUtxo, satoshiContainerLockingBytecode }),
      ...(externalReadUtxos.length > 0 && { readOnlyDataNftUtxos: externalReadUtxos }),
      ...(blockhashCoSpendUtxos.length > 0 && { blockhashCoSpendUtxos }),
      ...(blockhashCoSpendSlotOrdinals && { blockhashCoSpendSlotOrdinals }),
      ...(keccakComputeCoSpendUtxos.length > 0 && { keccakComputeCoSpendUtxos, keccakComputeCommitments }),
      ...(ecrecoverComputeCoSpendUtxos.length > 0 && { ecrecoverComputeCoSpendUtxos, ecrecoverComputeRecreates }),
      ...(keccakLoopSideCars.length > 0 && { keccakLoopSideCars, keccakLoopRecreates }),
      ...(externalOutStateUtxoGroups.length > 0 && { externalOutStateUtxoGroups }),
      ...(externalCallUtxoGroups.length > 0 && { externalCallUtxoGroups }),
      ...(lowLevelCallUtxoGroups.length > 0 && { lowLevelCallUtxoGroups }),
      ...(lowLevelCallRawInputs.length > 0 && { lowLevelCallRawInputs }),
      ...(lowLevelCallUtxoGroups.some((group) => group.callMode === 'delegatecall')
        && { delegateEntriesAfterLowLevel: true }),
      // X56. Only when the co-spent implementation BOTH emits and returns: its event resolves to the index the
      // forwarder had reserved for the return channel, so the return channel has to follow the events.
      ...(delegateReturnEventOffset !== undefined && delegateEventSlots.some((s) => s.kind === 'event')
        && { delegateReturnEventAfterEvents: true }),
      ...(lowLevelCallUtxoGroups.some((group) => group.callMode === 'delegatecall')
        && { lowLevelCallInputBase }),
      ...(batchPredCommitments.size > 0 && { batchEntriesBeforeDynamicChunks: true }),
      ...(eventDefs.length > 0 && { eventDefinitions: eventDefs }),
      ...(eventNftLockingBytecodes.size > 0 && { eventNftLockingBytecodes }),
      ...(iterationEntryInputs.length > 0 && { iterationEntryInputs }),
      ...(insertLoopPredecessors.length > 0 && { insertLoopPredecessorInputs: insertLoopPredecessors }),
      ...(effectiveBlockLayout && { blockLayout: effectiveBlockLayout }),
    });

    for (const [slotIndex, commitment] of batchTargetPlaceholders) {
      builder.setEntryRawCommitment(slotIndex, commitment);
    }

    // C2 sorted-set insert: place P' (the predecessor's rewritten commitment at its entry slot) and NEW (the new
    // node minted at the trailing loop-entry output). Both are known exactly from the off-chain list - no VM-trace
    // derivation needed - so set them directly; the covenant pins them, so the probe/send converge.
    for (const ins of sortedInserts) {
      builder.setEntryRawCommitment(ins.slotIndex, binToHex(ins.predNew));
      builder.pinEntrySlot(ins.slotIndex); // P' is known exactly - do not let auto-derivation re-derive it
      // Set insert (bool) OR chunkable-value insert: NEW is known exactly (inject) and PINNED so the auto-derivation
      // skips this collection - vital for chunkable values, whose covenant chunk-pin OTC calls would otherwise be
      // read as NEW by the loop-entry extractor. An int/bytesN value insert leaves NEW to trace-derivation.
      if (ins.newNode !== undefined) {
        builder.setLoopEntryCommitments(ins.collection, [binToHex(ins.newNode)]);
        builder.pinLoopEntry(ins.collection);
      } else {
        // The off-chain list already proves this is an INSERT, so reserve its trailing NEW output before the first
        // VM probe. Without the placeholder, an earlier dynamic-storage output can occupy the computed NEW index;
        // the VM then aborts before exposing the commitment and derivation incorrectly converges to an UPDATE.
        builder.setLoopEntryCommitments(ins.collection, ['00']);
        builder.requireLoopEntryCount(ins.collection, 1);
      }
    }
    // Break the first-probe ordering cycle when a scalar C2 INSERT follows newly-written dynamic state chunks:
    // reserve one chunk candidate so NEW is placed after the dynamic region and the VM can reach both commitment
    // checks. Derivation replaces it with the exact count/commitments (or removes it for an empty final value).
    if (sortedInserts.length > 0) {
      for (const dv of builder.getDynamicChunkVars()) {
        if (builder.getChunkRawCommitments(dv.name).length === 0) builder.setChunkRawCommitments(dv.name, ['00']);
      }
    }

    // C2 diff-key INSERT loop: the 2N interleaved [P'_0, NEW_0, P'_1, NEW_1, ...] trailing outputs are known exactly
    // from the off-chain list; inject + pin them so the auto-derivation skips this collection (nothing to trace).
    for (const [collectionName, commitments] of sortedLoopCommitments) {
      builder.setLoopEntryCommitments(collectionName, commitments);
      builder.pinLoopEntry(collectionName);
    }
    for (const [collectionName, commitments] of batchPredCommitments) {
      builder.setLoopEntryCommitments(collectionName, commitments);
      builder.pinLoopEntry(collectionName);
    }

    // P5b COMPUTED values: register the collections whose value chunks must be DERIVED from the trace (the covenant
    // pins them but the SDK has no value param to build them). The auto-derivation reads nNew from the entry's len4
    // and progressively extracts the pinned chunk commitments (like dynamicChunkVars).
    for (const collectionName of computedValueChunkCollections) {
      builder.registerValueChunkVar(collectionName, DUMMY_FUNDER_LOCKING_BYTECODE);
    }
    for (const collectionName of computedValueUpdateCollections) {
      builder.setLoopEntryCommitments(collectionName, []);
      builder.pinLoopEntry(collectionName); // no NEW node on an update - skip loop-entry derivation
    }

    // P5b (Design D): persist LONG (>60 B) sorted-mapping values as chunk NFT outputs at the compile-time per-
    // collection value-chunk address, commitment slot ++ digest ++ i ++ data. The write covenant PINS these to the
    // on-stack value (emitSortedValueChunkPin), so a forged/absent chunk is rejected at write time. Placed as the
    // LAST covenant-managed outputs (after the entries + NEW node), matching the covenant's base masterInput+
    // blockSize+isInsert.
    for (const mint of valueChunkMints) {
      const chunkAddr = getValueChunkAddress(this.inner, this.categoryId, mint.collection, mint.slot, mint.digest);
      mint.chunks.forEach((data, i) => builder.addValueChunkOutput({
        to: chunkAddr,
        amount: 1000n,
        token: {
          category: this.categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: buildValueChunkCommitment(i, data) },
        },
      }));
    }

    // blockhash(n) requires tx.time >= n; set it so the derivation probe (and the final tx) satisfy the CLTV.
    if (maxBhLocktime > 0) builder.setLocktime(maxBhLocktime);

    // Auto-fund block-layout slots that need funder inputs (output-only slots
    // like transfers/events, non-existing entries/TCs). These are WITHIN the
    // block range - the covenant requires them at specific positions.
    // The fee funder is NOT created here; STB.send() handles it via the
    // "build then fund" approach (measure covenant tx size -> create fee input).
    if (effectiveBlockLayout && builder.funderUtxos.length === 0) {
      const outputOnlyKinds = new Set(['transfer', 'tcTransfer', 'event', 'returnEvent', 'lowLevelCall', 'deploy']);
      const entryInfos = builder.getEntryNftInfos();
      const tcInfos = builder.getTokenContainerInfos();
      let neededFunders = effectiveBlockLayout.slots.filter(
        (s) => outputOnlyKinds.has(s.kind) && (s.kind !== 'returnEvent' || returnEmitOutputIndex >= 0),
      ).length;
      neededFunders += effectiveBlockLayout.slots.filter(
        (s) => s.kind === 'entry' && !entryInfos.some((e) => e.slotIndex === s.slotIndex && e.exists),
      ).length;
      neededFunders += effectiveBlockLayout.slots.filter(
        (s) => s.kind === 'tokenContainer' && !tcInfos.some((c) => c.tokenContainerSlotIndex === s.slotIndex && c.exists),
      ).length;
      if (blockhashCoSpendSlotOrdinals) {
        const active = new Set(blockhashCoSpendSlotOrdinals);
        let ordinal = 0;
        for (const slot of effectiveBlockLayout.slots) {
          if (slot.kind !== 'blockhashOracle') continue;
          if (!active.has(ordinal)) neededFunders++;
          ordinal++;
        }
      }
      const trailingCapacity = effectiveBlockLayout.trailingCapacity ?? 0;
      if (trailingCapacity > 0) {
        const existingTrailingInputs = iterationEntryInputs.length
          + insertLoopPredecessors.length + dynamicChunkInputs.length;
        if (existingTrailingInputs > trailingCapacity) {
          throw new Error(
            'Runtime resource inputs exceed balanced trailing capacity '
            + `(${existingTrailingInputs} > ${trailingCapacity})`,
          );
        }
        // One additional input sits after the balanced owner block and funds
        // the fee; the transaction builder pairs it with the final change output.
        neededFunders += trailingCapacity - existingTrailingInputs + (overrides?.omitLocalFeeTail ? 0 : 1);
      }
      // ANY msg.sender / tx.origin use needs the sender's NATIVE P2PKH input present so the covenant's emitTxOrigin
      // resolves to it (the sender IS tx.origin), even when the write's fees would otherwise come from the contract.
      // This covers a stored/compared value (`this.owner = msg.sender`, `require(msg.sender == x)`) as well as a
      // mapping key - but NOT an `IFoo(msg.sender).m()` call, where msg.sender resolves via the co-spent callee's
      // category (a minting input), not tx.origin. Force one funder from the signer; leftover satoshis go to change.
      const usesMsgSenderKey = (abiFunction?.entryAccesses ?? []).some(
        (ea) => (ea.keySources ?? []).some((ks) => ks.kind === 'msgSender'),
      );
      const usesTxOriginSender = !!abiFunction?.usesMsgSender
        && !(abiFunction?.externalCalls ?? []).some((ec) => ec.addressIsMsgSender);
      // A delegatecall'd (proxy) impl that uses msg.sender needs it too: msg.sender in the delegate impl resolves
      // to tx.origin (the caller/deployer signer), same as a direct call - so `upgrades.deployProxy` of an
      // `initialize` that sets `this.owner = msg.sender` needs the signer's native P2PKH input in the tx. (The
      // proxy forward connects the runner, so `this._signer` is set and the funder below is a real P2PKH input.)
      type DelegAbiFn = {
        name: string; usesMsgSender?: boolean; externalCalls?: readonly { addressIsMsgSender?: boolean }[];
        entryAccesses?: readonly { keySources?: readonly { kind?: string }[] }[];
      };
      const delegateUsesMsgSender = lowLevelCallUtxoGroups.some((g) => {
        if (g.callMode !== 'delegatecall') return false;
        const gFn = (g.externalContract.inner.artifact.abi as readonly DelegAbiFn[]).find((f) => f.name === g.functionName);
        if (!gFn) return false;
        const directUse = !!gFn.usesMsgSender && !(gFn.externalCalls ?? []).some((ec) => ec.addressIsMsgSender);
        // A msg.sender-KEYED mapping write in the delegate (users[msg.sender]=v) also needs the sender's native
        // P2PKH input so the covenant's emitTxOrigin resolves the on-chain key to the same address the SDK used.
        const keyUse = (gFn.entryAccesses ?? []).some((ea) => (ea.keySources ?? []).some((ks) => ks.kind === 'msgSender'));
        return directUse || keyUse;
      });
      if (usesMsgSenderKey || usesTxOriginSender || delegateUsesMsgSender) neededFunders = Math.max(neededFunders, 1);

      if (neededFunders > 0) {
        if (this._signer) {
          const signerUtxos = await this._signer.getUtxos();
          const consumedTxids = new Set(
            (sharedFunderPool ?? []).map((f) => `${f.txid}:${f.vout}`),
          );
          const plainUtxos = signerUtxos
            .filter((u) => !u.token && !consumedTxids.has(`${u.txid}:${u.vout}`))
            // A token-free vout 0 is still a potential CashTokens genesis input, so introspection exposes its
            // outpoint hash as a category. Prefer category-neutral sibling outputs for C2 absence witnesses.
            .sort((a, b) => Number(a.vout === 0) - Number(b.vout === 0));
          if (plainUtxos.length < neededFunders) {
            throw new Error(
              `Signer has ${plainUtxos.length} available plain UTXO(s) but ${neededFunders} funder(s) needed. `
              + `Fund the signer address: ${this._signer.getAddress()}`,
            );
          }
          builder.setFunderUtxos(plainUtxos.slice(0, neededFunders).map((u) => ({
            ...u, unlocker: this._signer!.unlockP2PKH(),
          })));
        } else if ((this.inner.provider as any).addUtxo) {
          const dummyFunders: UnlockableUtxo[] = [];
          for (let i = 0; i < neededFunders; i++) {
            // Controllerless participants are assembled independently before their balanced blocks are joined.
            // Namespace synthetic funders by the compiler-derived absolute block base so two output-only slots
            // can never reuse one outpoint in the aggregate transaction.
            const syntheticOutpoint = 0xf0 + (overrides?.blockBase ?? 0) * 0x100 + i;
            const dummy: Utxo = {
              txid: '00'.repeat(28) + syntheticOutpoint.toString(16).padStart(8, '0'),
              vout: 0,
              satoshis: 3000n,
            };
            await (this.inner.provider as any).addUtxo(binToHex(DUMMY_FUNDER_LOCKING_BYTECODE), dummy);
            dummyFunders.push({
              ...dummy,
              unlocker: {
                generateLockingBytecode: () => DUMMY_FUNDER_LOCKING_BYTECODE,
                generateUnlockingBytecode: () => DUMMY_FUNDER_UNLOCKING_BYTECODE,
              },
            });
          }
          builder.setFunderUtxos(dummyFunders);
        }
      }
    }

    // Build token container transfer ops from ABI for auto-derivation.
    // Uses transferCount/transferNftCount when available (fan-out support),
    // falling back to the operations array for backward compatibility.
    const tokenContainerTransferOps: Array<{ type: 'transfer' | 'transferNft'; categoryId: string }> = [];
    if (tokenContainerAccesses) {
      for (const access of tokenContainerAccesses) {
        const catParamIdx = abiFunction!.inputs.findIndex((inp) => inp.name === access.keyParam);
        const catValue = catParamIdx >= 0 ? args[catParamIdx] : undefined;
        const catId = catValue instanceof Uint8Array
          ? binToHex(catValue) : (catValue !== undefined ? String(catValue) : '');
        const ftCount = access.transferCount ?? (access.operations.includes('transfer') ? 1 : 0);
        const nftCount = access.transferNftCount ?? (access.operations.includes('transferNft') ? 1 : 0);
        for (let i = 0; i < ftCount; i++) {
          tokenContainerTransferOps.push({ type: 'transfer', categoryId: catId });
        }
        for (let i = 0; i < nftCount; i++) {
          tokenContainerTransferOps.push({ type: 'transferNft', categoryId: catId });
        }
      }
    }
    const derivTransferCount = abiFunction?.transferCount ?? 0;
    const derivTokenOps = tokenContainerTransferOps.length > 0 ? tokenContainerTransferOps : undefined;

    // Reserve the return placeholder before computing any input indices: an active returnEvent contributes a
    // funder inside the root block and therefore shifts the delegated facet by one input.
    if (returnEmitOutputIndex >= 0) {
      builder.setReturnEventOutput(this.categoryId, new Uint8Array([0]));
    }

    // Detect delegatecall group for auto-derivation: Phase 2 runs on the delegate's input
    // instead of input 0 (proxy's master), because the delegate function is what verifies
    // the proxy's state commitments.
    let delegatecallInputIndex: number | undefined;
    if (lowLevelCallUtxoGroups.length > 0) {
      for (let i = 0; i < lowLevelCallUtxoGroups.length; i++) {
        if (lowLevelCallUtxoGroups[i].callMode === 'delegatecall') {
          // lowLevelCallInputBase is computed from the materialized block size, which already includes an
          // active return-event slot. Adding it again probes one input past the delegated facet.
          delegatecallInputIndex = builder.getLowLevelCallMasterInputIndex(i);
          break;
        }
      }
    }

    // Co-spend the external-library side-car if this function uses a library, or calls an external
    // contract whose function does. One side-car serves every loader in the tx (the loader reads the last
    // input and verifies the blob by hash). Set before derivation so the probes include it.
    // First non-inline library used (inline libraries are baked into the contract; no side-car).
    // resultNft libraries (keccak256 compute) are co-spent as block-layout keccakSideCar slots, NOT via the
    // inline side-car loader, so they must not be treated as a sidecar-library dependency here.
    const firstSidecarLib = (art: any, names: readonly string[]): ExternalLibraryAbi | undefined => {
      for (const name of names) {
        const d: ExternalLibraryAbi | undefined = art?.externalLibraries?.find((l: any) => l.name === name);
        if (d && !d.inline && !d.resultNft) return d;
      }
      return undefined;
    };
    let sidecarLib: ExternalLibraryAbi | undefined;
    let sidecarSalt: Uint8Array | undefined;
    sidecarLib = firstSidecarLib(this.inner.artifact, abiFunction?.externalLibraries ?? []);
    if (sidecarLib) {
      sidecarSalt = sidecarLib.branded ? hexToBin(this.categoryId) : SHARED_LIBRARY_SALT;
    } else {
      // External calls and external out-state reads both run the callee's function (co-spent), so a
      // library-using callee needs the side-car too. Check both group lists.
      for (const group of [...externalCallUtxoGroups, ...externalOutStateUtxoGroups]) {
        const bArt = group.externalContract?.inner?.artifact ?? group.externalContract?.artifact;
        const bFn = bArt?.abi?.find((f: any) => f.name === group.functionName);
        sidecarLib = firstSidecarLib(bArt, bFn?.externalLibraries ?? []);
        if (sidecarLib) {
          sidecarSalt = sidecarLib.branded ? hexToBin(group.categoryId) : SHARED_LIBRARY_SALT;
          break; // one side-car suffices for all loaders in the tx
        }
      }
    }
    if (sidecarLib && sidecarSalt) {
      const blob = resolveLibraryBlob(sidecarLib);
      const lock = sidecarLockingBytecode(blob, sidecarSalt);
      const sidecarUtxos = await this.inner.provider.getUtxosForLockingBytecode(lock);
      if (sidecarUtxos.length === 0) {
        throw new Error(
          `${sidecarLib.name} side-car library UTXO not found; deploy it before spending `
          + '(TransactionBuilder.addSidecarDeployIfNeeded with the contract category salt).',
        );
      }
      builder.setSidecar(sidecarUtxos[0], blob, sidecarSalt);
    }

    // Check if there is nothing to derive for this function (e.g., split/merge/unsafe tiers)
    // X11. Read the ROUTED accesses, not the forwarder's. A delegatecall'd impl's mapping write is verified by
    // the IMPLEMENTATION covenant, so the proxy entry point (`__fallback`) publishes no entryAccesses of its own;
    // keyed on `abiFunction` a proxy with no data NFTs, no emits and no transfers looked like it had nothing to
    // derive, derivation was skipped outright, and the entry output kept its INPUT commitment - the delegated
    // write silently did nothing and the impl covenant rejected it at its own input.
    const hasNothingToDerive = requiredNftIndices.length === 0
      && (entryAccesses?.length ?? 0) === 0
      && (entryAbiFunction?.entryLoopWrites?.length ?? 0) === 0
      && emitInfos.length === 0
      && derivTransferCount === 0
      && (derivTokenOps?.length ?? 0) === 0
      && externalCallUtxoGroups.length === 0
      && externalOutStateUtxoGroups.length === 0
      && returnEmitOutputIndex < 0;

    // A provably read-only getter (compiler writesState=false) produces output state == input state, so the
    // builder reproduces the input commitments (empty stateUpdates) and the multi-pass derivation probe is pure
    // overhead. X176: `=== false` is the ONLY sound reading of this flag - `true` means "not provably
    // read-only", never "mutates a state variable". `StatefulContract.readWritesState` publishes the
    // distinction; nothing here may be rewritten to act on `true`, which would make this skip fail OPEN.
    // Skipping it makes getter calls cheap on-chain here AND in production. Guards: value-returning
    // views (returnEmitOutputIndex>=0) still need the return blob derived, and external call/read groups still
    // need Phase-1 derivation. Misclassification fails closed - the covenant rejects a mismatched output.
    // Kill-switch: SC_DISABLE_GETTER_SKIP=1 forces the full probe (escape hatch for the covenant-path change).
    // Read via globalThis - this is a browser+node library, so `process` is not typed/present in the prod build.
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    // A sorted (C2) mapping read REQUIRES co-spending the bracketing entry (no skippable default-on-absent), so
    // it must not be getter-skipped even though the function writes nothing.
    const readsSortedMapping = (abiFunction?.entryAccesses ?? [])
      .some((ea) => stateLayout.collections?.find((c) => c.name === ea.collection)?.sorted);
    const isReadOnlyGetter = env?.SC_DISABLE_GETTER_SKIP !== '1'
      && abiFunction?.writesState === false
      && !readsSortedMapping
      && returnEmitOutputIndex < 0
      && externalCallUtxoGroups.length === 0
      && externalOutStateUtxoGroups.length === 0;

    if (hasNothingToDerive || isReadOnlyGetter) {
      // Nothing to derive - set empty state so _applyOverrides doesn't throw
      (builder as any).__derivedState = {};
      (builder as any).__vmErrored = false;
    } else {
      // Try to auto-derive commitments via STB-based probe.
      // Uses _deriveFullTransactionState for all paths - the STB probe includes external read
      // inputs, generates valid signatures (enabling sig-arg auto-derivation), and handles
      // cross-contract calls. Phase 1 derives B's state for each external call group;
      // Phase 2 derives A's state + entries + events + transfers.
      const entryAccessesForDerive = entryAccesses; // routed: a delegatecall'd impl's entries, else abiFunction's
      let deriveResult: Awaited<ReturnType<StatefulContract['_deriveFullTransactionState']>>;
      const ecGroupsForDerive = externalCallUtxoGroups.length > 0 ? externalCallUtxoGroups : [];
      const ecCallsForDerive = externalCallUtxoGroups.length > 0 ? allGroupEcSlots : [];
      const osGroupsForDerive = externalOutStateUtxoGroups.length > 0 ? externalOutStateUtxoGroups : undefined;
      deriveResult = await this._deriveFullTransactionState(
        builder, requiredNftIndices, ecGroupsForDerive, ecCallsForDerive,
        entryAccessesForDerive, emitInfos.length > 0 ? emitInfos : undefined,
        derivTransferCount, derivTokenOps, delegatecallInputIndex, osGroupsForDerive,
      );

      // Tag the builder with derivation result and a re-derive callback.
      // The callback enables re-derivation after transfers/overrides are applied.
      (builder as any).__derivedState = deriveResult.state;
      (builder as any).__vmErrored = deriveResult.vmErrored;
      (builder as any).__derivationError = deriveResult.derivationError;
      (builder as any).__derivedTransfers = deriveResult.derivedTransfers;
      (builder as any).__derivedTokenContainerTransfers = deriveResult.derivedTokenContainerTransfers;
      (builder as any).__derivedTokenContainerTransferNfts = deriveResult.derivedTokenContainerTransferNfts;
      (builder as any).__expectedTransferCount = derivTransferCount;
      (builder as any).__expectedFtTransferCount = derivTokenOps?.filter((o) => o.type === 'transfer').length ?? 0;
      (builder as any).__expectedNftTransferCount = derivTokenOps?.filter((o) => o.type === 'transferNft').length ?? 0;
      const ecGroups = externalCallUtxoGroups;
      const ecCalls = allGroupEcSlots;
      const osGroups = osGroupsForDerive;
      const ea = entryAccessesForDerive;
      const ei = emitInfos.length > 0 ? emitInfos : undefined;
      const rni = requiredNftIndices;
      const dci = delegatecallInputIndex;
      // Re-derive callback: does NOT pass transfer params - when re-deriving after user
      // provides manual transfers, we work with whatever transfers are already in the builder.
      (builder as any).__reDerive = async (stb: StatefulTransactionBuilder) => (
        this._deriveFullTransactionState(stb, rni, ecGroups, ecCalls, ea, ei,
          undefined, undefined, dci, osGroups)
      );
    }

    // B8 emit: derive the encoded return value (the covenant compares it to the return-event output
    // commitment) and set it, replacing the placeholder.
    if (returnEmitOutputIndex >= 0) {
      const blob = overrides?.returnBlob
        ?? this._deriveReturnBlob(builder, returnEmitBlockOffset, delegatecallInputIndex ?? 0);
      if (!blob) {
        throw new Error(
          `Could not derive the return value of '${functionName}' for .emitReturn(). `
          + 'The covenant trace did not expose an authenticated return commitment.',
        );
      }
      builder.setReturnEventOutput(this.categoryId, blob);
      (builder as any).__derivedReturnBlob = blob;
    }

    // Auto-derived entry deletions: an UNCONDITIONAL `delete m[k]` produces no output for that entry, so the
    // builder must not recreate it (else it is co-spent AND re-emitted identically = a no-op, old value stays
    // readable). entryDeleteSlots already excludes conditional (soft-delete) slots.
    for (const slotIndex of entryDeleteSlots) builder.deleteEntry(slotIndex);

    // Conditional soft-delete slots are WRITES when the entry exists (output = derived commitment), but on an
    // absent key the covenant existence-gate emits no output; drop those on the builder so it makes none.
    for (const slotIndex of condSoftDeleteSlots) {
      const entry = entryNfts.find((e) => e.slotIndex === slotIndex);
      if (!entry?.exists) builder.deleteEntry(slotIndex);
    }

    return builder;
  }

  // B8 emit: run one VM probe and extract the encoded return blob from the return-event verification
  // (OP_OUTPUTTOKENCOMMITMENT == __returnBlob), the same trace-extraction used for external-call returns.
  private _deriveReturnBlob(
    builder: StatefulTransactionBuilder, returnOutputIndex: number, inputIndex = 0,
  ): Uint8Array | undefined {
    const probe = builder.build();
    const transaction = probe.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(probe.inputs);
    const vm = createVirtualMachineBch2026ForProvider(this.inner.provider);
    const trace = vm.debug({ inputIndex, sourceOutputs, transaction }) as AuthenticationProgramStateCommon[];
    const commitments = extractCommitmentsFromTrace(trace, 1, {
      min: returnOutputIndex, max: returnOutputIndex + 1,
    });
    return commitments && commitments.length > 0 ? hexToBin(commitments[0]) : undefined;
  }

  /** @internal Extract a participant's covenant-authored SCB1 return-event commitment from a complete bus tx. */
  _layer3ReturnBlobFromTransaction(
    builder: TransactionBuilder, returnOutputIndex: number, inputIndex: number,
  ): Uint8Array | undefined {
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const trace = createVirtualMachineBch2026ForProvider(this.inner.provider).debug({
      inputIndex, sourceOutputs, transaction,
    }) as AuthenticationProgramStateCommon[];
    const commitments = extractCommitmentsFromTrace(trace, 1, {
      min: returnOutputIndex, max: returnOutputIndex + 1,
    });
    return commitments?.[0] === undefined ? undefined : hexToBin(commitments[0]);
  }

  /**
   * ethers-style `fn.staticCall(...)` read: run the function's covenant in a read-only VM probe against the
   * current on-chain state + args, extract the encoded return value, and decode it against the ABI output type(s)
   * WITHOUT sending a transaction. A single output returns the decoded value; multiple outputs return an
   * ethers-style array (tuple). Typechain `.toObject()`/`.toArray()` accessors are attached at this boundary.
   */
  async _deriveReturnValue(
    functionName: string, args: FunctionArgument[], calls?: CallInfo[],
  ): Promise<StateValue> {
    const abiFunction = this.inner.artifact.abi.find((f) => f.name === functionName);
    const outputs = abiFunction?.outputs ?? [];
    if (outputs.length === 0) {
      throw new Error(`staticCall: '${functionName}' has no return value to read.`);
    }
    const slot = abiFunction?.blockLayout?.slots.find((s) => s.kind === 'returnEvent');
    if (!slot) {
      throw new Error(`staticCall: '${functionName}' has no returnEvent output slot; its value cannot be derived.`);
    }
    // emitReturn makes _createBuilder lay out the return-event output; the probe then extracts its commitment.
    const builder = await this._createBuilder(
      functionName, args, { emitReturn: true, returnProbeOnly: true, calls },
    );
    const blob = (builder as any).__derivedReturnBlob as Uint8Array | undefined
      ?? this._deriveReturnBlob(builder, slot.offset);
    if (!blob) {
      throw new Error(
        `staticCall: could not derive the return value of '${functionName}'. `
        + 'Functions that write state and return a value are not yet supported as reads.',
      );
    }
    const structs = this.inner.artifact.stateLayout?.structs;
    if (outputs.length === 1) {
      const decoded = decodePushdataValue(blob, 0, outputs[0].type, structs).value;
      const addressBytecode = decoded instanceof Uint8Array
        ? decoded
        : typeof decoded === 'string' && decoded.startsWith('0x') ? hexToBin(decoded.slice(2)) : undefined;
      if (outputs[0].type === 'address' && addressBytecode) {
        const cashaddr = lockingBytecodeToCashAddress({
          bytecode: addressBytecode,
          prefix: getNetworkPrefix(this.inner.provider.network),
          tokenSupport: false,
        });
        if (typeof cashaddr !== 'string') return cashaddr.address;
      }
      return attachDecodedAccessors(decoded);
    }
    // Multi-value (tuple) returns use a packed return-event encoding that is not a plain concatenation of each
    // value's pushdata; decoding it needs the tuple-return convention (viewReturn machinery). Fail closed rather
    // than mis-decode - single-value reads (the common getter shape) are fully supported.
    throw new Error(
      `staticCall: '${functionName}' returns ${outputs.length} values; multi-value (tuple) reads are not yet `
      + 'supported. Read the underlying state via getState(), or split into single-value view functions.',
    );
  }

  /**
   * Lightweight state retrieval that only fetches the master UTXO (no data NFTs/entries).
   * Used for functions that don't access on-chain state (e.g., split/merge/unsafe tiers).
   */
  private async _getMasterOnlyState(): Promise<OnChainState> {
    const tokenUtxos = await this.inner.provider.getUtxos(this.inner.tokenAddress);
    const masterUtxo = tokenUtxos.find(
      (u) => u.token?.category === this.categoryId && u.token?.nft?.capability === 'minting',
    );
    return {
      masterUtxo: masterUtxo ?? undefined,
      dataNftUtxos: [],
      entryNftUtxos: [],
      state: {},
    };
  }

  private _keysMatch(
    a: bigint | boolean | Uint8Array,
    b: bigint | boolean | Uint8Array,
    _keyType: string,
  ): boolean {
    if (a instanceof Uint8Array && b instanceof Uint8Array) {
      return binsAreEqual(a, b);
    }
    return a === b;
  }

  /**
   * Resolve the external category ID for an external read (address model).
   * A's constructor args bake the callee *address*, not its category, so the category is
   * recovered from the registered external contract (keyed by interface name).
   */
  private _resolveExternalCategoryId(er: ExternalReadAbi, _artifact: Artifact): string {
    return this._resolveRegisteredExternalCategoryId(er.interfaceName);
  }

  /** Look up a registered external contract's category ID by interface name. */
  private _resolveRegisteredExternalCategoryId(interfaceName: string): string {
    const ext = this._externalRegistry.get(interfaceName);
    if (!ext) {
      throw new Error(
        `External contract for interface '${interfaceName}' is not registered. `
        + 'Provide it via connect-time externals (connect/from { externals }) or withExternalCall().',
      );
    }
    return ext.categoryId;
  }

  /**
   * Get the token-aware address for external data NFTs.
   */
  private _getExternalDataNftAddress(externalCategoryId: string): string {
    const covenantScript = buildDataNftCovenantScript(hexToBin(externalCategoryId));
    return scriptToAddress(covenantScript, this.inner.provider.network, this.inner.addressType, true);
  }

  /**
   * Resolve B's function args from A's args using argSources metadata.
   * Returns the resolved args, or undefined if any arg source is unresolvable.
   * @internal
   */
  _resolveExternalArgs(
    argSources: readonly ArgSource[] | undefined,
    functionArgs: FunctionArgument[],
    artifact: Artifact,
  ): FunctionArgument[] | undefined {
    if (!argSources) return undefined;
    if (argSources.length === 0) return [];

    const resolved: FunctionArgument[] = [];
    for (const source of argSources) {
      switch (source.kind) {
        case 'forward': {
          if (source.paramIndex === undefined) return undefined;
          if (source.paramIndex >= functionArgs.length) {
            throw new Error(
              'External call argument forward references parameter '
              + `index ${source.paramIndex}, but the function was `
              + `called with only ${functionArgs.length} arguments.`,
            );
          }
          resolved.push(functionArgs[source.paramIndex]);
          break;
        }
        case 'constructorArg': {
          if (!source.paramName) return undefined;
          const paramIndex = artifact.constructorInputs.findIndex((inp) => inp.name === source.paramName);
          if (paramIndex < 0 || paramIndex >= this.inner.encodedConstructorArgs.length) {
            return undefined;
          }
          resolved.push(this.inner.encodedConstructorArgs[paramIndex]);
          break;
        }
        case 'literal': {
          if (source.value === undefined || !source.type) return undefined;
          if (source.type === 'bigint') {
            resolved.push(BigInt(source.value));
          } else if (source.type === 'bool') {
            resolved.push(source.value === 'true');
          } else if (source.type === 'string') {
            resolved.push(source.value);
          } else {
            // bytes types - hex string to Uint8Array
            resolved.push(hexToBin(source.value));
          }
          break;
        }
        case 'expression':
        default:
          // Can't resolve complex expressions - user must provide via withExternalCall
          return undefined;
      }
    }
    return resolved;
  }

  /**
   * Construct the exact positional SCB1 blob expected by a grouped external
   * call. The callee capability is treated as untrusted artifact data: every
   * logical selector must resolve to an advertised eligible handler with the
   * same input types before any transaction is built.
   */
  private _buildRepeatedExternalBatch(
    externalCall: ExternalCallAbi,
    functionArgs: FunctionArgument[],
    externalContract: StatefulContract,
  ): {
      abiFunction: AbiFunction;
      selector: Uint8Array;
      blob: Uint8Array;
      args: FunctionArgument[];
    } | undefined {
    const rows = externalCall.batchInvocations;
    if (!rows) return undefined;
    if (rows.length < 2) throw new Error('Repeated external SCB1 batch must contain at least two rows');

    const capability = externalContract.inner.artifact.hiddenBatch;
    if (!capability || capability.version !== 1 || capability.selector !== '53434231') {
      throw new Error(
        `${externalCall.interfaceName} does not advertise the compatible compiler-hidden SCB1 route`,
      );
    }
    const minimumRows = capability.minimumRows ?? 1;
    if (rows.length < minimumRows || rows.length > capability.maximumRows) {
      throw new Error(
        `Repeated external SCB1 batch has ${rows.length} rows; callee requires `
        + `${minimumRows}..${capability.maximumRows}`,
      );
    }

    const structs = externalContract.inner.artifact.structs
      ?? externalContract.inner.stateLayout?.structs;
    const keyWitnessValues = new Map<string, {
      value: FunctionArgument;
      encoded: Uint8Array;
    }>();
    // X199. Intersect with eligibility: the compiler's logical value mode is computed over the FINAL
    // survivors, so a published-but-refused payable handler must not size the admitted route's rows.
    const valueMode = capability.handlers.some((handler) => handler.eligible && handler.usesMsgValue);
    const encodedRows = rows.map((row, rowIndex) => {
      if (row.logicalIndex !== rowIndex) {
        throw new Error('Repeated external SCB1 rows must use canonical contiguous callsite indices');
      }
      const handler = capability.handlers.find((candidate) => candidate.selector === row.selector);
      if (!handler?.eligible) {
        throw new Error(
          `External SCB1 selector ${row.selector} is not advertised as an eligible callee handler`,
        );
      }
      if (handler.inputs.length !== row.inputs.length
        || handler.inputs.some((input, index) => input.type !== row.inputs[index].type)) {
        throw new Error(`External SCB1 selector ${row.selector} has incompatible caller/callee input types`);
      }
      const args = row.inputs.length === 0
        ? []
        : this._resolveExternalArgs(row.argSources, functionArgs, this.inner.artifact);
      if (!args || args.length !== row.inputs.length) {
        throw new Error(`Could not resolve every argument for external SCB1 row ${rowIndex}`);
      }
      const encoded = args.map((arg, index) =>
        encodeFunctionArgument(arg, row.inputs[index].type, structs));
      if (encoded.some((arg) => !(arg instanceof Uint8Array))) {
        throw new Error('Signature-like arguments are not eligible for external SCB1 batching');
      }
      for (const binding of handler.batchKeyWitnesses ?? []) {
        const routeInput = binding.perRow
          ? `${binding.routeInput}_r${rowIndex}` : binding.routeInput;
        const value = args[binding.inputIndex];
        const encodedValue = encoded[binding.inputIndex] as Uint8Array;
        const prior = keyWitnessValues.get(routeInput);
        if (prior && binToHex(prior.encoded) !== binToHex(encodedValue)) {
          throw new Error(`External SCB1 collection witness '${routeInput}' is ambiguous`);
        }
        if (!prior) keyWitnessValues.set(routeInput, { value, encoded: encodedValue });
      }
      const argsBlob = scriptToBytecode(encoded as Uint8Array[]);
      if (argsBlob.length > 0xffff) throw new Error(`External SCB1 row ${rowIndex} exceeds 65535 bytes`);
      let logicalValue = 0n;
      if (handler.usesMsgValue) {
        if ((handler.transfers?.length ?? 0) === 0) {
          throw new Error(
            `External SCB1 msg.value for '${handler.name}' has no compiler-authored transfer`,
          );
        }
        for (const transfer of handler.transfers!) {
          const source = transfer.amount;
          let amount: bigint;
          if (source.kind === 'forward' && source.paramIndex !== undefined
            && typeof args[source.paramIndex] === 'bigint') {
            amount = args[source.paramIndex] as bigint;
          } else if (source.kind === 'literal' && source.value !== undefined) {
            amount = BigInt(source.value);
          } else {
            throw new Error(
              `External SCB1 msg.value for '${handler.name}' has a non-derivable transfer amount`,
            );
          }
          logicalValue -= amount;
        }
      }
      return StatefulContract._concatBytes(
        hexToBin(row.selector),
        StatefulContract._uintLe(BigInt(row.logicalIndex), 4),
        StatefulContract._uintLe(0n, 2),
        StatefulContract._uintLe(BigInt(argsBlob.length), 2),
        ...(valueMode ? [StatefulContract._signedLogicalValue(logicalValue)] : []),
        argsBlob,
      );
    });
    const blob = StatefulContract._concatBytes(
      hexToBin('53434231'), Uint8Array.from([1, valueMode ? 1 : 0, rows.length]), ...encodedRows,
    );
    if (blob.length > capability.maximumBlobBytes) {
      throw new Error(
        `External SCB1 blob is ${blob.length} bytes; maximum is ${capability.maximumBlobBytes}`,
      );
    }
    const routeWitnessInputs = capability.route.inputs
      .filter((input) => input.name !== 'batchBlob' && !input.name.startsWith('__internal__'));
    const routeWitnesses = routeWitnessInputs.map((input) => {
      const witness = keyWitnessValues.get(input.name);
      if (!witness) throw new Error(`Missing external SCB1 route witness '${input.name}'`);
      return witness.value;
    });
    return {
      abiFunction: capability.route,
      selector: hexToBin(capability.selector),
      blob,
      args: [blob, ...routeWitnesses],
    };
  }

  /**
   * Find an external data NFT UTXO at a specific nftIndex.
   * Data NFTs are sorted by vout; the nftIndex corresponds to their position.
   */
  private async _findExternalDataNft(
    dataNftAddress: string, externalCategoryId: string, nftIndex: number,
  ): Promise<Utxo | undefined> {
    try {
      const utxos = await this.inner.provider.getUtxos(dataNftAddress);
      const dataNfts = utxos
        .filter((u) => (
          u.token
          && u.token.category === externalCategoryId
          && u.token.nft
          && u.token.nft.capability === 'mutable'
          && u.token.nft.commitment.length > 0
        ))
        .sort((a, b) => a.vout - b.vout);
      return dataNfts[nftIndex];
    } catch {
      return undefined;
    }
  }

  /**
   * Split a minting NFT into N new minting NFTs.
   * Transaction: [master, funding...] -> [master_preserved, new_minting_1..N, change]
   */
  static async split(options: SplitOptions): Promise<SplitResult> {
    const {
      provider, contract, splitFunctionName, splitFunctionArgs,
      funder, fundingUtxos, changeAddress,
    } = options;

    // Validate the split function exists and has the 'split' modifier
    const splitAbi = contract.inner.artifact.abi.find(
      (f) => f.name === splitFunctionName,
    );
    if (!splitAbi) {
      throw new Error(`Function '${splitFunctionName}' not found in contract '${contract.name}'.`);
    }
    if (!splitAbi.modifiers?.includes('split')) {
      throw new Error(
        `Function '${splitFunctionName}' does not have the 'split' modifier.`,
      );
    }

    // Find the count parameter
    const splitCountParam = splitAbi.splitCountParam;
    if (!splitCountParam) {
      throw new Error(`Split function '${splitFunctionName}' missing splitCountParam in ABI.`);
    }
    const countParamIndex = splitAbi.inputs.findIndex((p) => p.name === splitCountParam);
    if (countParamIndex === -1) {
      throw new Error(`Split count parameter '${splitCountParam}' not found in function inputs.`);
    }
    const splitCount = Number(splitFunctionArgs[countParamIndex]);
    if (splitCount < 1 || !Number.isInteger(splitCount)) {
      throw new Error(`Split count must be a positive integer, got ${splitCount}.`);
    }

    const newMintingAmount = options.newMintingAmount ?? 1200n;
    const categoryId = contract.categoryId;

    // Get master UTXO directly (split/merge don't need full state with data NFTs)
    const tokenUtxos = await provider.getUtxos(contract.inner.tokenAddress);
    const masterUtxo = tokenUtxos.find(
      (u) => u.token?.category === categoryId && u.token?.nft?.capability === 'minting',
    );
    if (!masterUtxo) {
      throw new Error(`Master UTXO not found for contract '${contract.name}' (category ${categoryId}).`);
    }

    // Build transaction
    const { TransactionBuilder } = await import('../TransactionBuilder.js');
    const builder = new TransactionBuilder({
      provider,
      ...(options.maxFee != null ? { maximumFeeSatoshis: options.maxFee } : {}),
    });

    // Input 0: master UTXO (unlocked with split function)
    const unlockingArgs = [...splitFunctionArgs];
    builder.addInput(masterUtxo, contract.inner.unlock[splitFunctionName]!(...unlockingArgs));

    // Input 1+: funding UTXOs
    for (const fundingUtxo of fundingUtxos) {
      builder.addInput(fundingUtxo, funder);
    }

    // Output 0: master preserved (same LBC, same token, same commitment)
    builder.addOutput({
      to: contract.inner.tokenAddress,
      amount: masterUtxo.satoshis,
      token: {
        category: categoryId,
        amount: 0n,
        nft: { capability: 'minting', commitment: masterUtxo.token?.nft?.commitment ?? '' },
      },
    });

    // Outputs 1..N: new minting NFTs
    for (let i = 0; i < splitCount; i++) {
      builder.addOutput({
        to: contract.inner.tokenAddress,
        amount: newMintingAmount,
        token: {
          category: categoryId,
          amount: 0n,
          nft: { capability: 'minting', commitment: '' },
        },
      });
    }

    // Compute fee from actual transaction size (1 sat/byte minimum relay fee).
    // Add a placeholder change output before estimating so the fee accounts for it.
    builder.addOutput({ to: changeAddress, amount: 1000n }); // placeholder
    const actualFee = options.fee ?? await computeFeeFromBuilder(builder);
    const totalFunding = fundingUtxos.reduce((sum, u) => sum + u.satoshis, 0n);
    const changeAmount = totalFunding - (newMintingAmount * BigInt(splitCount)) - actualFee;
    if (changeAmount < 0n) {
      builder.outputs.pop(); // remove placeholder
      throw new Error(
        `Insufficient funding for split: need ${newMintingAmount * BigInt(splitCount) + actualFee} sats `
        + `(${splitCount} x ${newMintingAmount} + ${actualFee} fee), but only ${totalFunding} sats available.`,
      );
    }
    if (changeAmount > 0n) {
      builder.outputs[builder.outputs.length - 1] = {
        ...builder.outputs[builder.outputs.length - 1], amount: changeAmount,
      };
    } else {
      builder.outputs.pop(); // remove placeholder - no change needed
    }

    // Build and send directly (bypass debug step which doesn't handle covenant unlockers)
    const { hash256, hexToBin: localHexToBin } = await import('@bitauth/libauth');
    const rawTx = builder.build();
    const rawTxBin = localHexToBin(rawTx);
    const decoded = decodeTransactionUnsafe(rawTxBin);

    // X163, the finalized-bytes gate at the static `split` site. `changeAmount` above is pure arithmetic -
    // `totalFunding - newMintingAmount * splitCount - fee` - and the only floor on it is zero, so any funding
    // that leaves a small positive remainder produces a below-dust change output. MEASURED: funding of exactly
    // `2 * 1200 + 2000 + 100` leaves 100 satoshis against a 576-satoshi threshold for a 44-byte output, and the
    // mock provider accepts it (`enforceDust: false` by default), so nothing in the repo objected.
    //
    // The dust output ALSO evades `addOutput`'s own policy check, and not by accident: the placeholder is added
    // at 1000 satoshis and then overwritten by index on `builder.outputs`, which is the one path into an output
    // that no validator sees. That is the same construction X131 row 2b uses deliberately to reach the gate.
    //
    // X175. THIS SITE HAS NO `debug()` AHEAD OF IT, by design, so the byte gate used to be the FIRST decider and
    // a split that broke its covenant AND paid dust reported only the dust. The ordering no longer decides
    // anything: `assertFinalizedBytesWithCovenant` asks the covenant whenever the bytes are refused and reports
    // BOTH, so neither objection can absorb a test written against the other.
    assertFinalizedBytesWithCovenant(builder, decoded, inputSubjectsOfBuilder(builder));

    const txid = await provider.sendRawTransaction(rawTx);

    // Verify txid matches locally computed hash to detect compromised providers
    const expectedTxid = binToHex(hash256(rawTxBin).reverse());
    if (txid !== expectedTxid) {
      throw new Error(
        `Txid mismatch: provider returned '${txid}', expected '${expectedTxid}'. `
        + 'The network provider may be compromised.',
      );
    }

    return { tx: { ...decoded, txid, hex: rawTx } as any, categoryId };
  }

  /**
   * Merge N consumed minting NFTs into the surviving master.
   * Transaction: [master_surviving, consumed_1..N, funding...] -> [master_preserved, change]
   */
  static async merge(options: MergeOptions): Promise<MergeResult> {
    const {
      provider, contract, mergeFunctionName, mergeFunctionArgs,
      funder, consumedMasterUtxos, fundingUtxos, changeAddress,
    } = options;

    // Validate the merge function exists and has the 'merge' modifier
    const mergeAbi = contract.inner.artifact.abi.find(
      (f) => f.name === mergeFunctionName,
    );
    if (!mergeAbi) {
      throw new Error(`Function '${mergeFunctionName}' not found in contract '${contract.name}'.`);
    }
    if (!mergeAbi.modifiers?.includes('merge')) {
      throw new Error(
        `Function '${mergeFunctionName}' does not have the 'merge' modifier.`,
      );
    }

    // Validate count
    const mergeCountParam = mergeAbi.mergeCountParam;
    if (!mergeCountParam) {
      throw new Error(`Merge function '${mergeFunctionName}' missing mergeCountParam in ABI.`);
    }
    const countParamIndex = mergeAbi.inputs.findIndex((p) => p.name === mergeCountParam);
    if (countParamIndex === -1) {
      throw new Error(`Merge count parameter '${mergeCountParam}' not found in function inputs.`);
    }
    const mergeCount = Number(mergeFunctionArgs[countParamIndex]);
    if (mergeCount < 1 || !Number.isInteger(mergeCount)) {
      throw new Error(`Merge count must be a positive integer, got ${mergeCount}.`);
    }
    if (consumedMasterUtxos.length !== mergeCount) {
      throw new Error(
        `Merge count is ${mergeCount} but ${consumedMasterUtxos.length} consumed UTXOs provided.`,
      );
    }

    const categoryId = contract.categoryId;

    // Validate consumed master UTXOs have correct category and minting capability
    for (const consumed of consumedMasterUtxos) {
      if (!consumed.token || consumed.token.category !== categoryId) {
        throw new Error(
          `Consumed master UTXO (${consumed.txid}:${consumed.vout}) has wrong category: `
          + `expected '${categoryId}', got '${consumed.token?.category ?? 'none'}'.`,
        );
      }
      if (consumed.token.nft?.capability !== 'minting') {
        throw new Error(
          `Consumed master UTXO (${consumed.txid}:${consumed.vout}) must have 'minting' capability, `
          + `got '${consumed.token.nft?.capability ?? 'none'}'.`,
        );
      }
    }

    // Get surviving master UTXO directly (merge doesn't need full state with data NFTs)
    // Exclude consumed UTXOs so the surviving master is never one being consumed
    const consumedOutpoints = new Set(consumedMasterUtxos.map((u) => `${u.txid}:${u.vout}`));
    const tokenUtxos = await provider.getUtxos(contract.inner.tokenAddress);
    const masterUtxo = tokenUtxos.find(
      (u) => u.token?.category === categoryId
        && u.token?.nft?.capability === 'minting'
        && !consumedOutpoints.has(`${u.txid}:${u.vout}`),
    );
    if (!masterUtxo) {
      throw new Error(`Master UTXO not found for contract '${contract.name}' (category ${categoryId}). All minting UTXOs may be in the consumed set.`);
    }

    // Build transaction (merge intentionally burns consumed minting NFTs)
    const { TransactionBuilder } = await import('../TransactionBuilder.js');
    const builder = new TransactionBuilder({
      provider,
      allowImplicitNftBurn: true,
      ...(options.maxFee != null ? { maximumFeeSatoshis: options.maxFee } : {}),
    });

    // Input 0: surviving master UTXO
    const unlockingArgs = [...mergeFunctionArgs];
    builder.addInput(masterUtxo, contract.inner.unlock[mergeFunctionName]!(...unlockingArgs));

    // Inputs 1..N: consumed master UTXOs (same function + args)
    for (const consumed of consumedMasterUtxos) {
      builder.addInput(consumed, contract.inner.unlock[mergeFunctionName]!(...unlockingArgs));
    }

    // Input N+1+: funding UTXOs
    for (const fundingUtxo of fundingUtxos) {
      builder.addInput(fundingUtxo, funder);
    }

    // Output 0: surviving master preserved
    builder.addOutput({
      to: contract.inner.tokenAddress,
      amount: masterUtxo.satoshis,
      token: {
        category: categoryId,
        amount: 0n,
        nft: { capability: 'minting', commitment: masterUtxo.token?.nft?.commitment ?? '' },
      },
    });

    // Compute fee from actual transaction size (1 sat/byte minimum relay fee).
    // Add a placeholder change output before estimating so the fee accounts for it.
    builder.addOutput({ to: changeAddress, amount: 1000n }); // placeholder
    const actualMergeFee = options.fee ?? await computeFeeFromBuilder(builder);
    const consumedSatoshis = consumedMasterUtxos.reduce((sum, u) => sum + u.satoshis, 0n);
    const totalFunding = fundingUtxos.reduce((sum, u) => sum + u.satoshis, 0n);
    const changeAmount = consumedSatoshis + totalFunding - actualMergeFee;
    if (changeAmount > 0n) {
      builder.outputs[builder.outputs.length - 1] = {
        ...builder.outputs[builder.outputs.length - 1], amount: changeAmount,
      };
    } else {
      builder.outputs.pop(); // remove placeholder - no change needed
    }

    // Build and send directly (bypass debug step which doesn't handle covenant unlockers)
    const { hash256, hexToBin: localHexToBin } = await import('@bitauth/libauth');
    const rawTx = builder.build();
    const rawTxBin = localHexToBin(rawTx);
    const decoded = decodeTransactionUnsafe(rawTxBin);

    // X163, the finalized-bytes gate at the static `merge` site. Same arithmetic hazard as split, from the other
    // direction: `changeAmount` is `consumedSatoshis + totalFunding - fee`, and merge's whole purpose is to
    // reclaim the satoshis the consumed masters were holding. Those are typically 1,200 each - a few hundred
    // above the dust floor - so a fee that eats most of the reclaim leaves a change output under it. MEASURED
    // at 100 satoshis against 576, accepted by the mock and refused `64: dust` by a node.
    //
    // Merge also runs with `allowImplicitNftBurn: true`, so the builder's own burn check is off and the
    // consumed masters vanish into that change output. Refusing here is refusing before an intentional burn
    // whose proceeds the network would not have relayed.
    //
    // X175. Nothing debugs ahead of this site either, so the gate reports the covenant alongside the byte rule
    // rather than in place of it.
    assertFinalizedBytesWithCovenant(builder, decoded, inputSubjectsOfBuilder(builder));

    const txid = await provider.sendRawTransaction(rawTx);

    // Verify txid matches locally computed hash to detect compromised providers
    const expectedTxid = binToHex(hash256(rawTxBin).reverse());
    if (txid !== expectedTxid) {
      throw new Error(
        `Txid mismatch: provider returned '${txid}', expected '${expectedTxid}'. `
        + 'The network provider may be compromised.',
      );
    }

    return { tx: { ...decoded, txid, hex: rawTx } as any, categoryId };
  }

  /**
   * Build and register external contracts from a flat `externalContracts` map.
   *
   * For each entry the SDK:
   * 1. Infers constructor args from ABI metadata (categoryParam -> category ID from the map)
   * 2. Creates a Contract + StatefulContract
   * 3. Wires up the externals graph (if B references IC and IC is in the map, it's auto-registered on B)
   * 4. Registers direct externals on the primary contract
   */
  private static _buildExternalGraph(
    primary: StatefulContract,
    specs: Record<string, ExternalContractSpec>,
  ): void {
    const provider = primary.inner.provider;
    const builtContracts = new Map<string, ConnectedStatefulContract>();

    // Build all external contracts from the specs
    for (const [interfaceName, spec] of Object.entries(specs)) {
      let constructorArgs: ConstructorArgument[];
      if (spec.constructorArgs) {
        constructorArgs = spec.constructorArgs;
      } else {
        constructorArgs = StatefulContract._inferConstructorArgs(spec.artifact, specs, provider);
      }

      const contract = new Contract(spec.artifact, constructorArgs as any, {
        provider,
        category: hexToBin(spec.categoryId),
      });
      const sc = StatefulContract.withCategory(contract, spec.categoryId);
      builtContracts.set(interfaceName, sc);
    }

    // Wire up externals graph: for each built contract, find its external refs
    // and register matching contracts from the map
    for (const [, sc] of builtContracts) {
      const scInternal = sc as unknown as StatefulContract;
      const refNames = StatefulContract._collectExternalInterfaceNames(scInternal.inner.artifact);
      for (const refName of refNames) {
        const target = builtContracts.get(refName);
        if (target) {
          scInternal._externalRegistry.set(refName, target);
        }
      }
    }

    // Register all built contracts on the primary (both direct and transitive).
    // The _createBuilder will select only the ones relevant to each function call.
    for (const [name, sc] of builtContracts) {
      primary._externalRegistry.set(name, sc);
    }
  }

  /**
   * Infer constructor args for an artifact by matching ABI's categoryParam/lbcParam
   * references to entries in the externalContracts map.
   */
  private static _inferConstructorArgs(
    artifact: Artifact,
    allSpecs: Record<string, ExternalContractSpec>,
    provider: any,
    visited?: Set<string>,
  ): ConstructorArgument[] {
    visited = visited ?? new Set();
    if (visited.has(artifact.contractName)) {
      throw new Error(`Circular constructor dependency detected: ${artifact.contractName}`);
    }
    visited.add(artifact.contractName);

    if (artifact.constructorInputs.length === 0) return [];

    // Collect constructor param name -> { interfaceName, kind } from all ABI functions.
    // In the address model each external param carries a locking bytecode: the callee's master
    // address for calls/outState, or the data/entry sub-NFT address for reads.
    const paramRefs = new Map<string, {
      interfaceName: string; kind: 'master' | 'dataNft' | 'entryNft'; collection?: string;
    }>();
    for (const func of artifact.abi) {
      for (const ec of func.externalCalls ?? []) {
        if (ec.addressParam) paramRefs.set(ec.addressParam, { interfaceName: ec.interfaceName, kind: 'master' });
      }
      for (const er of func.externalReads ?? []) {
        if (er.addressParam) {
          paramRefs.set(er.addressParam, {
            interfaceName: er.interfaceName,
            kind: er.kind === 'entry' ? 'entryNft' : 'dataNft',
            collection: er.collectionName ?? er.collectionSignature,
          });
        }
      }
      for (const os of func.externalOutStateReads ?? []) {
        if (os.addressParam) paramRefs.set(os.addressParam, { interfaceName: os.interfaceName, kind: 'master' });
      }
    }

    return artifact.constructorInputs.map((input) => {
      const ref = paramRefs.get(input.name);
      if (!ref) {
        throw new Error(
          `Cannot auto-infer constructor arg '${input.name}' for contract '${artifact.contractName}'. `
          + 'Provide explicit constructorArgs in the ExternalContractSpec.',
        );
      }
      const spec = allSpecs[ref.interfaceName];
      if (!spec) {
        throw new Error(
          `External contract for interface '${ref.interfaceName}' not found in externalContracts map. `
          + `Required by '${artifact.contractName}' constructor param '${input.name}'.`,
        );
      }
      // Build the external contract (self-pinned: category baked) to derive its addresses.
      const extArgs = spec.constructorArgs
        ?? StatefulContract._inferConstructorArgs(spec.artifact, allSpecs, provider, new Set(visited));
      const extContract = new Contract(spec.artifact, extArgs as any, {
        provider,
        category: hexToBin(spec.categoryId),
      });
      if (ref.kind === 'master') {
        return extContract.lockingBytecode;
      }
      if (ref.kind === 'entryNft') {
        return getEntryNftLockingBytecode(extContract, spec.categoryId, ref.collection!);
      }
      return getDataNftLockingBytecode(spec.categoryId);
    });
  }

  /**
   * Collect all external interface names referenced by an artifact's ABI.
   */
  private static _collectExternalInterfaceNames(artifact: Artifact): Set<string> {
    const names = new Set<string>();
    for (const func of artifact.abi) {
      for (const ec of func.externalCalls ?? []) names.add(ec.interfaceName);
      for (const er of func.externalReads ?? []) names.add(er.interfaceName);
      for (const os of func.externalOutStateReads ?? []) names.add(os.interfaceName);
    }
    return names;
  }
}

export class TokenContainerAccessor {
  constructor(
    private sc: StatefulContract<any>,
    private tokenContainerCategoryIdHex: string,
  ) {}

  /** Container covenant address - where to send tokens to the token container. */
  get address(): string {
    return this.sc.getTokenContainerAddress(this.tokenContainerCategoryIdHex);
  }

  /** All UTXOs in the container matching this token container category. */
  get utxos(): Promise<Utxo[]> {
    return this._getUtxos();
  }

  /** Sum of fungible token amounts across all container UTXOs. */
  get amount(): Promise<bigint> {
    return this._getUtxos().then(
      (utxos) => utxos.reduce((sum, u) => sum + (u.token?.amount ?? 0n), 0n),
    );
  }

  /** Token category from the first container UTXO, or '' if none. */
  get category(): Promise<string> {
    return this._getUtxos().then((utxos) => utxos[0]?.token?.category ?? '');
  }

  /** NFT commitment hex strings from all NFT-bearing container UTXOs. */
  get commitments(): Promise<string[]> {
    return this._getUtxos().then(
      (utxos) => utxos
        .filter((u) => u.token?.nft)
        .map((u) => u.token!.nft!.commitment),
    );
  }

  async getAmount(): Promise<bigint> {
    const utxos = await this._getUtxos();
    return utxos.reduce((sum, u) => sum + (u.token?.amount ?? 0n), 0n);
  }

  async getNftCount(): Promise<number> {
    const utxos = await this._getUtxos();
    return utxos.filter((u) => u.token?.nft).length;
  }

  private async _getUtxos(): Promise<Utxo[]> {
    try {
      const containerAddress = this.address;
      const allUtxos = await this.sc.provider.getUtxos(containerAddress);
      return allUtxos.filter((u) => u.token?.category === this.tokenContainerCategoryIdHex);
    } catch {
      return [];
    }
  }
}

// A delegate implementation/library operates on the CALLER's state at the impl's own compile-time field
// offsets, so each impl state variable must sit at the same slot (nftIndex:fieldIndex), name and type in the
// caller's layout - otherwise the delegate writes the wrong field and silently corrupts the caller's state.
// This is the proxy/impl storage-layout-compatibility rule (as in EVM), checked across the delegatecall.
// See docs/library-contracts.md ("3b design").
function assertDelegateLayoutCompatible(
  callerLayout: StateLayout | undefined, implLayout: StateLayout | undefined, implName: string,
): void {
  if (!callerLayout || !implLayout) return;
  for (const iv of implLayout.variables) {
    const cv = callerLayout.variables.find((v) => v.nftIndex === iv.nftIndex && v.fieldIndex === iv.fieldIndex);
    if (!cv || cv.name !== iv.name || cv.type !== iv.type) {
      throw new Error(
        `Delegate layout mismatch: '${implName}' state field '${iv.name}' (${iv.type}) is not at the same `
        + "slot in the caller's state. A delegate library/implementation and its caller must declare a "
        + 'compatible state layout (the same field at the same slot). See docs/library-contracts.md.',
      );
    }
  }
}

/**
 * A pending deploy-modifier function call, returned by `factory.deployFn(...args)`. Thenable, so
 * `await factory.deployFn(...args)` funds the deploy via the factory's connected signer and runs it
 * (ethers-style). For explicit control (no signer, or a specific funding UTXO) use
 * `.deploy({ fundingUtxo, funder, changeAddress, ... })`. childArtifact / childConstructorArgs are resolved
 * from the factory's child registry + the recorded new-C(...) mapping; see deployFrom.
 */
export class DeployFunctionCall {
  constructor(
    private factory: StatefulContract,
    private functionName: string,
    private args: FunctionArgument[],
  ) {}

  /** Explicit deploy with child/funding overrides (e.g. an explicit fundingUtxo when there is no signer). */
  deploy<T extends Artifact>(
    options: DeployFromCallOptions<T> = {} as DeployFromCallOptions<T>,
  ): Promise<DeployFromResult<T>> {
    return this.factory._deployFromSigner(this.functionName, this.args, options);
  }

  // Thenable: awaiting the call funds + runs the deploy via the signer.
  then<R1 = DeployFromResult, R2 = never>(
    onFulfilled?: ((value: DeployFromResult) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.factory._deployFromSigner(this.functionName, this.args).then(onFulfilled, onRejected);
  }

  // A CONDITIONAL deploy (`if (cond) new C()`) invoked with a non-firing argument does not mint a child - it is
  // just a plain state-write call, and the covenant verifies no child genesis (the inline checks live inside the
  // untaken branch). `.send()` / `.build()` route to that plain call; `.deploy()` / awaiting still run the
  // genesis co-spend for the firing case. Building the plain tx when the branch WOULD fire produces a tx the
  // covenant rejects (the taken branch verifies the missing child), so this stays sound.
  private _plainCall(): StatefulFunctionCall {
    return new StatefulFunctionCall(
      this.factory._createBuilder(this.functionName, this.args),
      this.factory, this.functionName, this.args,
    );
  }

  /** Send WITHOUT deploying: the conditional deploy branch is not taken for these args (plain state call). */
  send(): Promise<TransactionDetails> {
    return this._plainCall().send();
  }

  /** Build the plain (non-deploying) transaction for a non-firing conditional deploy call. */
  build(): Promise<TransactionBuilder> {
    return this._plainCall().build();
  }
}

export class StatefulFunctionCall {
  private builderPromise: Promise<StatefulTransactionBuilder>;
  private parentContract?: StatefulContract;
  private functionName?: string;
  private functionArgs?: any[];
  private stateOverrides: Array<{ name: string; value: StateValueType }> = [];
  private entryOverrides: Array<{ slotIndex: number; value: StateValueType }> = [];
  private entryKeyOverrides: Map<number, bigint | boolean | Uint8Array> = new Map();
  private externalEntryKeyOverrides: Map<number, bigint | boolean | Uint8Array> = new Map();
  private entryDeleteSlots: number[] = [];
  private transfers: Array<{ lockingBytecode: Uint8Array; amount: bigint }> = [];
  private tokenContainerTransfers: Array<{
    tokenContainerCategoryId: string; lockingBytecode: Uint8Array; amount: bigint;
  }> = [];

  private tokenContainerTransferNfts: Array<{
    tokenContainerCategoryId: string; lockingBytecode: Uint8Array;
    commitment: Uint8Array; capability: 'none' | 'mutable' | 'minting';
  }> = [];

  private extraOutputs: Output[] = [];
  private manualEvents: Array<{ name: string; args: StateValueType[] }> = [];
  private detachedEvents: Array<{
    name: string; args: StateValueType[]; definition?: EventDefinitionAbi; lockingBytecode?: Uint8Array;
  }> = [];

  private declaredRevertReasons: string[] = [];

  private maxFeeOverride?: bigint;
  private containerDepositAmount: bigint = 0n;

  private externalCallInfos: ExternalCallInfo[] = [];
  private callInfos: CallInfo[] = [];
  private registryExternalStateOverrides: Map<string, Record<string, StateValueType>> = new Map();
  private emitReturnFlag = false;
  private consumesLogicalNonce = true;
  private compilerRoute?: {
    abiFunction: AbiFunction; selector: Uint8Array; blockBase?: number;
    emitReturn?: boolean; returnBlob?: Uint8Array; omitLocalFeeTail?: boolean;
  };

  private splitFundingConfig?: {
    utxos: Utxo[];
    unlocker: Unlocker;
    changeAddress: string;
    newMintingAmount?: bigint;
    fee?: bigint;
  };

  private mergeConfig?: {
    consumedMasters: Utxo[];
    fundingUtxos?: Utxo[];
    fundingUnlocker?: Unlocker;
    changeAddress: string;
    fee?: bigint;
  };

  constructor(
    builderPromise: Promise<StatefulTransactionBuilder>,
    parentContract?: StatefulContract,
    functionName?: string,
    functionArgs?: any[],
    compilerRoute?: {
      abiFunction: AbiFunction; selector: Uint8Array; blockBase?: number;
      emitReturn?: boolean; returnBlob?: Uint8Array; omitLocalFeeTail?: boolean;
    },
  ) {
    // Prevent unhandled rejection if the builder fails before send() is called
    // (e.g. when withExternalCall() causes send() to rebuild from scratch)
    this.builderPromise = builderPromise;
    this.builderPromise.catch(() => {});
    this.parentContract = parentContract;
    this.functionName = functionName;
    this.functionArgs = functionArgs;
    this.compilerRoute = compilerRoute;
  }

  /**
   * Compiler-owned description consumed by the controllerless Layer-3 composer.
   *
   * This deliberately exposes no builder or physical indices: composition derives one SCB1 route per
   * participant only after the complete logical call graph is known. Calls carrying imperative SDK overrides
   * are refused because replaying only part of that mutable configuration would silently change semantics.
   */
  _layer3CompositionDescriptor(): {
    contract: StatefulContract;
    functionName: string;
    args: readonly FunctionArgument[];
  } {
    if (!this.parentContract || this.functionName === undefined || !this.functionArgs) {
      throw new Error('layer3: composition requires a prepared stateful contract call');
    }
    const hasOverrides = this.stateOverrides.length > 0 || this.entryOverrides.length > 0
      || this.entryKeyOverrides.size > 0 || this.externalEntryKeyOverrides.size > 0
      || this.entryDeleteSlots.length > 0 || this.transfers.length > 0
      || this.tokenContainerTransfers.length > 0 || this.tokenContainerTransferNfts.length > 0
      || this.extraOutputs.length > 0 || this.manualEvents.length > 0 || this.detachedEvents.length > 0
      || this.externalCallInfos.length > 0 || this.callInfos.length > 0
      || this.registryExternalStateOverrides.size > 0 || this.emitReturnFlag
      || this.containerDepositAmount !== 0n || this.locktimeOverride !== undefined
      || this.splitFundingConfig !== undefined || this.mergeConfig !== undefined;
    if (hasOverrides) {
      throw new Error('layer3: prepared calls with imperative SDK overrides are not composable');
    }
    return Object.freeze({
      contract: this.parentContract,
      functionName: this.functionName,
      args: Object.freeze([...(this.functionArgs as FunctionArgument[])]),
    });
  }

  setState(name: string, value: StateValueType): this;
  setState(values: Record<string, StateValueType>): this;
  setState(
    nameOrValues: string | Record<string, StateValueType>,
    value?: StateValueType,
  ): this {
    if (typeof nameOrValues === 'string') {
      this.stateOverrides.push({ name: nameOrValues, value: value! });
    } else {
      for (const [n, v] of Object.entries(nameOrValues)) {
        this.stateOverrides.push({ name: n, value: v });
      }
    }
    return this;
  }

  setEntry(slotIndex: number, value: StateValueType): this {
    this.entryOverrides.push({ slotIndex, value });
    return this;
  }

  // nLocktime for the final tx (e.g. block.* oracle freshness `require(tx.time >= number)`); inputs are
  // non-final by default so the bound is enforced.
  private locktimeOverride?: number;

  setLocktime(locktime: number): this {
    this.locktimeOverride = locktime;
    return this;
  }

  deleteEntry(slotIndex: number): this {
    this.entryDeleteSlots.push(slotIndex);
    return this;
  }

  withEntryKey(slotIndex: number, keyValue: bigint | boolean | Uint8Array): this {
    this.entryKeyOverrides.set(slotIndex, keyValue);
    return this;
  }

  /**
   * Provide a key value for an external entry read at the given slot index.
   * This enables the SDK to find the correct entry UTXO by matching its
   * commitment key against the provided value, rather than selecting the
   * first matching entry.
   */
  withExternalEntryKey(slotIndex: number, keyValue: bigint | boolean | Uint8Array): this {
    this.externalEntryKeyOverrides.set(slotIndex, keyValue);
    return this;
  }

  withMaxFee(maximumFeeSatoshis: bigint): this {
    this.maxFeeOverride = maximumFeeSatoshis;
    return this;
  }

  /**
   * Emit this function's return value(s) in a return-event output (B8), so an off-chain reader can
   * decode them. Without this, a returning function is spendable but its return value is not emitted.
   */
  emitReturn(): this {
    this.emitReturnFlag = true;
    return this;
  }

  /** Supply an event commitment explicitly when a composed delegate trace cannot be auto-derived. */
  emitEvent(name: string, ...args: StateValueType[]): this {
    this.manualEvents.push({ name, args });
    return this;
  }

  /** Compatibility event placed after composed delegate blocks, so it cannot shift positional covenant slots. */
  emitDetachedEvent(name: string, ...args: StateValueType[]): this {
    this.detachedEvents.push({ name, args });
    return this;
  }

  emitDetachedEventWithDefinition(
    definition: EventDefinitionAbi, lockingBytecode: Uint8Array, ...args: StateValueType[]
  ): this {
    this.detachedEvents.push({ name: definition.signature, args, definition, lockingBytecode });
    return this;
  }

  getDetachedEvents(): readonly {
    name: string; args: readonly StateValueType[]; definition?: EventDefinitionAbi;
  }[] {
    return this.detachedEvents;
  }

  withDeclaredRevertReasons(reasons: readonly string[]): this {
    this.declaredRevertReasons = [...reasons];
    return this;
  }

  declaresRevertReason(reason: string | RegExp): boolean {
    return this.declaredRevertReasons.some((message) => typeof reason === 'string'
      ? message === reason : reason.test(message));
  }

  /** Internal composition escape: the enclosing top-level SDK operation owns the nonce. */
  withoutLogicalNonce(): this {
    this.consumesLogicalNonce = false;
    return this;
  }

  /**
   * ethers `contract.fn.staticCall(...)`: read the function's return value(s) without sending a transaction. Runs
   * the covenant in a read-only VM probe against current state, decodes the return blob against the ABI output
   * type(s), and returns the value (single output) or an array (tuple). Struct/array values carry `.toObject()` /
   * `.toArray()`. Note: a plain `await sc.fn(...)` still SENDS (StatefulFunctionCall is a thenable) - use
   * staticCall() for a value-returning read, mirroring ethers where reads and sends are distinct.
   */
  async staticCall(): Promise<StateValueType> {
    if (!this.parentContract || this.functionName === undefined) {
      throw new Error('staticCall is only available on a contract function call.');
    }
    return this.parentContract._deriveReturnValue(
      this.functionName, (this.functionArgs ?? []) as FunctionArgument[],
      this.callInfos.length > 0 ? this.callInfos : undefined,
    ) as Promise<StateValueType>;
  }

  /**
   * Deposit satoshis into the satoshi container (positive msg.value).
   * Used with payable functions to increase the container balance.
   * The extra sats are sourced from the fee funder.
   */
  withValue(amount: bigint): this {
    if (amount < 0n) throw new Error('Call value cannot be negative.');
    if (amount > 0n) {
      if (!this.parentContract || this.functionName === undefined) {
        throw new Error('withValue is only available on a contract function call.');
      }
      const abiFunction = this.parentContract.inner.artifact.abi.find((f) => f.name === this.functionName);
      if (!abiFunction?.modifiers?.includes('payable')) {
        throw new Error(`Cannot attach value to non-payable function '${this.functionName}'.`);
      }
    }
    this.containerDepositAmount = amount;
    return this;
  }

  transfer(lockingBytecode: Uint8Array, amount: bigint): this {
    this.transfers.push({ lockingBytecode, amount });
    return this;
  }

  tokenContainerTransfer(tokenContainerCategoryId: string, lockingBytecode: Uint8Array, amount: bigint): this {
    this.tokenContainerTransfers.push({ tokenContainerCategoryId, lockingBytecode, amount });
    return this;
  }

  tokenContainerTransferNft(
    tokenContainerCategoryId: string,
    lockingBytecode: Uint8Array,
    commitment: Uint8Array,
    capability: 'none' | 'mutable' | 'minting',
  ): this {
    this.tokenContainerTransferNfts.push({ tokenContainerCategoryId, lockingBytecode, commitment, capability });
    return this;
  }

  withExternalCall(externalContract: StatefulContract): this;
  withExternalCall(externalContract: StatefulContract, functionName: string, args: FunctionArgument[]): this;
  withExternalCall(
    externalContract: StatefulContract,
    functionName?: string,
    args?: FunctionArgument[],
  ): this {
    if (functionName !== undefined && args !== undefined) {
      this.externalCallInfos.push({ externalContract, functionName, args });
    } else {
      // Simplified form: resolve function name + args from ABI metadata
      const slotIndex = this.externalCallInfos.length;
      const abiFunction = this.parentContract?.inner.artifact.abi.find(
        (f: { name: string }) => f.name === this.functionName,
      ) as any;
      const ec = abiFunction?.externalCalls?.[slotIndex];
      if (!ec) {
        throw new Error(
          `Cannot auto-resolve external call at slot ${slotIndex}. `
          + 'Provide functionName and args explicitly.',
        );
      }
      const resolvedArgs = this.parentContract!._resolveExternalArgs(
        ec.argSources, this.functionArgs!, this.parentContract!.inner.artifact,
      );
      if (!resolvedArgs) {
        throw new Error(
          `Cannot auto-resolve args for ${ec.interfaceName}.${ec.functionName}. `
          + 'Provide args explicitly via withExternalCall(contract, functionName, args).',
        );
      }
      this.externalCallInfos.push({
        externalContract,
        functionName: ec.functionName,
        args: resolvedArgs,
      });
    }
    return this;
  }

  withCall(contract: StatefulContract, functionName: string, args: FunctionArgument[]): this;
  withCall(utxo: UnlockableUtxo): this;
  withCall(
    contractOrUtxo: StatefulContract | UnlockableUtxo,
    functionName?: string,
    args?: FunctionArgument[],
  ): this {
    if (functionName !== undefined && args !== undefined) {
      this.callInfos.push({
        type: 'stateful',
        contract: contractOrUtxo as StatefulContract,
        functionName,
        args,
      });
    } else {
      this.callInfos.push({
        type: 'raw',
        utxo: contractOrUtxo as UnlockableUtxo,
      });
    }
    return this;
  }

  /**
   * Convenience method for delegatecall: stores the implementation contract, function name,
   * and args as a low-level call. The proxy's fallback will receive the calldata automatically.
   *
   * @param proxyMasterIndex - The proxy's master input index in the transaction.
   *   Defaults to 0 (proxy master is the first input). Override when the proxy's
   *   master NFT is not at input 0 (e.g., nested call compositions).
   *
   * Usage: proxy.call['__fallback']().withDelegatecall(impl, 'increment', [pk, sig])
   */
  withDelegatecall(
    impl: StatefulContract,
    functionName: string,
    args: FunctionArgument[],
    proxyMasterIndex?: number,
  ): this {
    assertDelegateLayoutCompatible(
      this.parentContract?.inner.artifact.stateLayout,
      impl.inner.artifact.stateLayout,
      impl.inner.artifact.contractName,
    );
    this.callInfos.push({
      type: 'stateful',
      contract: impl,
      functionName,
      args,
      proxyMasterIndex,
    });
    return this;
  }

  setExternalState(name: string, value: StateValueType): this;
  setExternalState(categoryId: string, name: string, value: StateValueType): this;
  setExternalState(
    nameOrCategoryId: string, valueOrName: StateValueType | string, maybeValue?: StateValueType,
  ): this {
    if (maybeValue !== undefined) {
      // 3-arg form: setExternalState(categoryId, name, value)
      // Works with both withExternalCall() and connect-time externals paths.
      const categoryId = nameOrCategoryId;
      const name = valueOrName as string;
      const value = maybeValue;
      let overrides = this.registryExternalStateOverrides.get(categoryId);
      if (!overrides) {
        overrides = {};
        this.registryExternalStateOverrides.set(categoryId, overrides);
      }
      overrides[name] = value;
    } else {
      // 2-arg form: setExternalState(name, value) - requires withExternalCall()
      const lastCall = this.externalCallInfos[this.externalCallInfos.length - 1];
      if (!lastCall) {
        throw new Error('No external call to set state on. Call withExternalCall() or use the 3-arg form setExternalState(categoryId, name, value).');
      }
      if (!lastCall.stateOverrides) lastCall.stateOverrides = {};
      lastCall.stateOverrides[nameOrCategoryId] = valueOrName;
    }
    return this;
  }

  addOutput(output: Output): this {
    this.extraOutputs.push(output);
    return this;
  }

  /**
   * Provide funding UTXOs for a split function.
   * Required when calling a function with the `split` modifier via `sc.call`.
   */
  withSplitFunding(utxos: Utxo[], unlocker: Unlocker, changeAddress: string): this {
    this.splitFundingConfig = { utxos, unlocker, changeAddress };
    return this;
  }

  /**
   * Set the satoshi amount for each new minting NFT created by a split function.
   * Defaults to 1200n if not called.
   */
  withNewMintingAmount(amount: bigint): this {
    if (this.splitFundingConfig) this.splitFundingConfig.newMintingAmount = amount;
    return this;
  }

  /**
   * Set a custom fee for a split transaction.
   */
  withSplitFee(fee: bigint): this {
    if (this.splitFundingConfig) this.splitFundingConfig.fee = fee;
    return this;
  }

  /**
   * Provide consumed master UTXOs for a merge function.
   * Required when calling a function with the `merge` modifier via `sc.call`.
   */
  withConsumedMasters(utxos: Utxo[], changeAddress: string): this {
    this.mergeConfig = { consumedMasters: utxos, changeAddress };
    return this;
  }

  /**
   * Provide additional funding UTXOs for a merge function (for fees).
   */
  withMergeFunding(utxos: Utxo[], unlocker: Unlocker): this {
    if (this.mergeConfig) {
      this.mergeConfig.fundingUtxos = utxos;
      this.mergeConfig.fundingUnlocker = unlocker;
    }
    return this;
  }

  /**
   * Set a custom fee for a merge transaction.
   */
  withMergeFee(fee: bigint): this {
    if (this.mergeConfig) this.mergeConfig.fee = fee;
    return this;
  }

  /**
   * True when awaiting this call should READ the return value (ethers `view`/`pure` semantics) instead of SENDing
   * a transaction: a single-output function that provably writes no state (`writesState === false`, which fails
   * closed to `true`), is not a deploy/external-call view, and has no send-intent config attached (transfers,
   * emitReturn, state/entry overrides, split/merge, container ops). Multi-value returns still SEND (their packed
   * encoding is not decodable yet). `.staticCall()` / `.send()` remain the explicit, typed escapes.
   */
  private _isPureRead(): boolean {
    if (!this.parentContract || this.functionName === undefined) return false;
    const abiFn = this.parentContract.inner.artifact.abi.find((f) => f.name === this.functionName);
    if (!abiFn || abiFn.writesState !== false) return false;
    if ((abiFn.outputs?.length ?? 0) !== 1) return false;
    if (abiFn.modifiers?.includes('deploy')) return false;
    if ((abiFn.externalCalls?.length ?? 0) > 0) return false;
    return this.transfers.length === 0 && !this.emitReturnFlag
      && this.stateOverrides.length === 0 && this.entryOverrides.length === 0
      && this.entryKeyOverrides.size === 0 && this.externalEntryKeyOverrides.size === 0
      && this.entryDeleteSlots.length === 0 && this.extraOutputs.length === 0
      && this.tokenContainerTransfers.length === 0 && this.tokenContainerTransferNfts.length === 0
      && this.externalCallInfos.length === 0 && this.callInfos.length === 0
      && this.registryExternalStateOverrides.size === 0
      && this.containerDepositAmount === 0n && !this.splitFundingConfig && !this.mergeConfig;
  }

  private _requiresRecursivePreflight(): boolean {
    if (!this.parentContract || this.functionName === undefined) return false;
    return this.parentContract.inner.artifact.abi
      .find((fn) => fn.name === this.functionName)?.recursiveStateHandler === true;
  }

  private _recursivePreflightHasSignatures(): boolean {
    if (!this.parentContract || this.functionName === undefined) return false;
    const abi = this.parentContract.inner.artifact.abi.find((fn) => fn.name === this.functionName);
    return abi?.recursiveStateHandler === true
      && abi.inputs.some((input) => input.type === 'sig' || input.type === 'datasig');
  }

  private _preflightRecursiveBuilder(builder: TransactionBuilder): void {
    if (!this._requiresRecursivePreflight()) return;
    try {
      // debug() evaluates with the artifact's BCH VM target and consensus
      // resource limits. Unlike send()'s best-effort diagnostic probe, this is
      // an authorization gate for a concrete recursive invocation.
      builder.debug();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Recursive state invocation '${this.functionName}' does not fit or fails its concrete BCH VM preflight: `
        + reason,
      );
    }
  }

  then<TResult1 = TransactionDetails, TResult2 = never>(
    onfulfilled?: ((value: TransactionDetails) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    // ethers view semantics: awaiting a pure read resolves to the decoded return value, not a transaction. TS
    // still types the result as TransactionDetails (the thenable is not per-function-typed) - use .staticCall()
    // for a typed read, or .send() to force a send.
    if (this._isPureRead()) {
      return this.parentContract!._deriveReturnValue(
        this.functionName!, (this.functionArgs ?? []) as FunctionArgument[],
      ).then(onfulfilled as (value: unknown) => TResult1 | PromiseLike<TResult1>, onrejected);
    }
    return this.send().then(onfulfilled, onrejected);
  }

  async build(): Promise<TransactionBuilder> {
    const splitMergeBuilder = await this._trySplitMergeBuild();
    if (splitMergeBuilder) return splitMergeBuilder;
    const stb = await this._applyOverrides();
    const builder = stb.build();
    if (this._recursivePreflightHasSignatures()) {
      throw new Error(
        `Recursive state invocation '${this.functionName}' contains transaction signatures and cannot expose `
        + 'an unsigned intermediate builder; call .send() so the SDK can preflight the fully funded transaction.',
      );
    }
    this._preflightRecursiveBuilder(builder);
    return builder;
  }

  async send(): Promise<TransactionDetails> {
    const reservation = this.consumesLogicalNonce
      ? this.parentContract?._logicalNonceSigner?.reserveTransactionNonce() : undefined;
    try {
      const result = await this._sendWithoutLogicalNonce();
      reservation?.commit();
      return result;
    } catch (error) {
      reservation?.release();
      throw error;
    }
  }

  private async _sendWithoutLogicalNonce(): Promise<TransactionDetails> {
    const splitMergeBuilder = await this._trySplitMergeBuild();
    if (splitMergeBuilder) {
      // Split/merge bypass the debug step (covenant scripts don't fully validate
      // in the debug VM due to mock source output limitations).
      return this._sendRawBuilder(splitMergeBuilder);
    }

    // Retry loop for UTXO staleness: if a concurrent transaction spends our UTXOs
    // between the time we fetch them and the time we broadcast, re-derive with fresh UTXOs.
    // Note: this does not fully solve concurrent access - callers needing strong consistency
    // should implement their own locking or sequencing.
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const stb = await this._applyOverrides();
      if (this.locktimeOverride !== undefined) stb.setLocktime(this.locktimeOverride);
      try {
        if (this._requiresRecursivePreflight()) stb.enableStrictVmPreflight();
        return await stb.send();
      } catch (err: any) {
        // Only retry on BCH node UTXO-staleness rejection codes, not arbitrary substring matches.
        // These are the exact error strings returned by BCHN/BCHD when inputs reference
        // already-spent or mempool-conflicting UTXOs.
        const msg = err?.message ?? '';
        const reason = err?.reason ?? '';
        const isUtxoStale = /\bmissing inputs\b/i.test(msg)
          || /\btxn-mempool-conflict\b/.test(msg)
          || /\bmissing inputs\b/i.test(reason)
          || /\btxn-mempool-conflict\b/.test(reason);
        if (isUtxoStale && attempt < maxRetries - 1) {
          continue; // Retry with fresh UTXOs
        }
        throw err;
      }
    }

    // Unreachable, but satisfies TypeScript
    throw new Error('Unexpected: retry loop exited without returning or throwing');
  }

  /**
   * Build the covenant transaction without funding or broadcasting.
   * Returns the logically balanced transaction with all covenant inputs/outputs.
   * The transaction is NOT funded -- the caller must add fee inputs, change outputs,
   * and sign before broadcasting.
   *
   * Usage:
   * ```typescript
   * const { transaction, sourceOutputs } = await sc.call.deposit(...).buildUnsigned();
   * // Add funding inputs, change outputs, sign, broadcast externally
   * ```
   */
  async buildUnsigned(): Promise<{
    transaction: Uint8Array;
    sourceOutputs: LibauthOutput[];
    inputCount: number;
    covenantSize: number;
  }> {
    const stb = await this._applyOverrides();
    return stb.buildUnsigned();
  }

  /**
   * Send a TransactionBuilder directly, bypassing the debug step.
   * Used for split/merge/unsafe-tier transactions where the debug VM
   * cannot validate covenant scripts due to mock provider limitations.
   */
  private async _sendRawBuilder(builder: TransactionBuilder): Promise<TransactionDetails> {
    const { encodeTransaction, hash256 } = await import('@bitauth/libauth');
    const rawTx = builder.build();
    const rawTxBin = hexToBin(rawTx);

    // Fee sanity check: per-byte cap prevents accidentally sending excessive fees
    const decoded = decodeTransactionUnsafe(rawTxBin);
    const totalInputSats = builder.inputs.reduce((sum, inp) => sum + inp.satoshis, 0n);
    const totalOutputSats = (decoded as { outputs: Array<{ valueSatoshis: bigint }> }).outputs
      .reduce((sum, out) => sum + out.valueSatoshis, 0n);
    const fee = totalInputSats - totalOutputSats;
    const txSize = BigInt(encodeTransaction(decoded).byteLength);
    const MAX_FEE_SATS_PER_BYTE = 1000;
    const feePerByte = Number(fee) / Number(txSize);
    if (feePerByte > MAX_FEE_SATS_PER_BYTE) {
      throw new Error(
        `Transaction fee of ${fee} satoshis (${feePerByte.toFixed(1)} sat/byte) exceeds the `
        + `safety cap of ${MAX_FEE_SATS_PER_BYTE} sat/byte for a ${txSize}-byte transaction.`,
      );
    }

    // X163, the finalized-bytes gate at `_sendRawBuilder`. This is the `sc.call.fork(...)` /
    // `sc.call.consolidate(...)`
    // route into the SAME two builders the static `split`/`merge` use, so it inherits their change arithmetic
    // exactly: measured at 100 satoshis of change against a 576-satoshi threshold through
    // `withSplitFunding(...).withSplitFee(...)`, accepted by the mock.
    //
    // Ordered after the fee-per-byte cap above so a missing change output still reports as a fee problem
    // rather than as whichever relay observation happens to be true of the same bytes - the same ordering the
    // stateful submit path uses.
    //
    // X175. Like split and merge, nothing debugs ahead of this, so the gate carries the covenant's objection
    // with it instead of arriving before it.
    assertFinalizedBytesWithCovenant(builder, decoded, inputSubjectsOfBuilder(builder));

    const provider = this.parentContract!.inner.provider;
    const txid = await provider.sendRawTransaction(rawTx);

    // Verify txid matches locally computed hash to detect compromised providers
    const expectedTxid = binToHex(hash256(rawTxBin).reverse());
    if (txid !== expectedTxid) {
      throw new Error(
        `Txid mismatch: provider returned '${txid}', expected '${expectedTxid}'. `
        + 'The network provider may be compromised.',
      );
    }

    return attachWait({ ...decoded, txid, hex: rawTx } as TransactionDetails, builder.provider);
  }

  /**
   * If this is a split/merge function, build a raw TransactionBuilder directly.
   * Returns undefined if this is a normal function call.
   */
  private async _trySplitMergeBuild(): Promise<TransactionBuilder | undefined> {
    if (!this.parentContract || !this.functionName) return undefined;

    const abiFunc = this.parentContract.inner.artifact.abi.find(
      (f) => f.name === this.functionName,
    );
    if (!abiFunc) return undefined;

    const isSplit = abiFunc.modifiers?.includes('split');
    const isMerge = abiFunc.modifiers?.includes('merge');

    if (isSplit) {
      if (!this.splitFundingConfig) {
        throw new Error(
          'Split functions require funding. Call .withSplitFunding(utxos, unlocker, changeAddress) before .send().',
        );
      }
      return this._buildSplitTransactionBuilder(abiFunc, this.maxFeeOverride);
    }
    if (isMerge) {
      if (!this.mergeConfig) {
        throw new Error(
          'Merge functions require consumed masters. Call .withConsumedMasters(utxos, changeAddress) before .send().',
        );
      }
      return this._buildMergeTransactionBuilder(abiFunc, this.maxFeeOverride);
    }

    return undefined;
  }

  // When `L.f()` is auto-wired but no library INSTANCE was registered, resolve it from the bundle: the artifact
  // comes from the registered ArtifactMap (registerArtifacts / ContractBundle) and the live category from the
  // indexer (the consumer baked the library address as its __libAddr_<name> ctor arg). Retires registerLibrary
  // for any bundle-deployed library. See docs/multi-contract-artifacts.md (Phase 3).
  private async _resolveLibrariesFromRegistry(): Promise<void> {
    if (!this.parentContract || !this.functionName) return;
    const consumer = this.parentContract;
    const abiFunc = consumer.inner.artifact.abi.find((f) => f.name === this.functionName);
    const libCalls = abiFunc?.libraryDelegateCalls;
    if (!libCalls?.length) return;
    for (const lc of libCalls) {
      if (consumer._getLibrary(lc.library)) continue; // an explicit registerLibrary wins
      const libArtifact = consumer._getChild(lc.library);
      if (!libArtifact?.stateLayout) continue; // not in a registered bundle -> let auto-wire raise its error
      // The synthesized __libAddr_<name> ctor arg holds the deployed library's locking bytecode.
      const addrName = `__libAddr_${lc.library}`;
      const addrIdx = consumer.inner.artifact.constructorInputs.findIndex((i) => i.name === addrName);
      if (addrIdx < 0) continue;
      const baked = consumer.inner.constructorArgs[addrIdx];
      if (!(baked instanceof Uint8Array)) continue;
      // Reconstruct the library's constructor args (branded -> __brand = consumer category; else none) so the
      // rebuilt instance hashes to the same address; bail to the manual path on any other constructor shape.
      let libArgs: ConstructorArgument[];
      if (libArtifact.brandedLibrary) {
        if (!consumer.categoryId || libArtifact.constructorInputs.length !== 1) continue;
        libArgs = [StatefulContract.libraryBrand(consumer.categoryId)];
      } else if (libArtifact.constructorInputs.length === 0) {
        libArgs = [];
      } else {
        continue;
      }
      const libCat = await resolveCategoryFromLockingBytecode(consumer.inner.provider, baked);
      const libContract = new Contract(libArtifact, libArgs as never[], { provider: consumer.inner.provider });
      if (libContract.withCategory(hexToBin(libCat)).lockingBytecode !== binToHex(baked)) continue;
      consumer.registerLibrary(lc.library, StatefulContract.withCategory(libContract, libCat));
    }
  }

  // Auto-wire the delegatecall co-spend for each `L.f()` the called function performs (artifact
  // libraryDelegateCalls), from the consumer's registered library instances - so the caller need not repeat the
  // library function via withDelegatecall. A manual withDelegatecall for the same function takes precedence.
  private _autoWireLibraryDelegatecalls(): void {
    if (!this.parentContract || !this.functionName) return;
    const abiFunc = this.parentContract.inner.artifact.abi.find((f) => f.name === this.functionName);
    const libCalls = abiFunc?.libraryDelegateCalls;
    if (!libCalls || libCalls.length === 0) return;
    for (const lc of libCalls) {
      if (this.callInfos.some((ci) => ci.type === 'stateful' && ci.functionName === lc.functionName)) continue;
      const lib = this.parentContract._getLibrary(lc.library);
      if (!lib) {
        throw new Error(
          `Library '${lc.library}' is delegate-called by '${this.functionName}' but no instance was registered. `
          + `Call registerLibrary('${lc.library}', <deployed library>) before .send().`,
        );
      }
      assertDelegateLayoutCompatible(
        this.parentContract.inner.artifact.stateLayout,
        lib.inner.artifact.stateLayout,
        lib.inner.artifact.contractName,
      );
      // Resolve each positional arg for the library unlocker: a forwarded consumer parameter (by name, from the
      // consumer call) or a compile-time literal (reconstructed by kind).
      const args = (lc.args ?? []).map((a) => {
        if ('param' in a) {
          const idx = abiFunc!.inputs.findIndex((inp) => inp.name === a.param);
          if (idx < 0 || !this.functionArgs || idx >= this.functionArgs.length) {
            throw new Error(
              `Cannot resolve argument '${a.param}' forwarded to library '${lc.library}.${lc.functionName}' `
              + `from the call to '${this.functionName}'.`,
            );
          }
          return this.functionArgs[idx];
        }
        if (a.kind === 'int') return BigInt(a.literal);
        if (a.kind === 'bool') return a.literal === 'true';
        if (a.kind === 'bytes') return hexToBin(a.literal);
        return a.literal; // string
      });
      this.callInfos.push({ type: 'stateful', contract: lib, functionName: lc.functionName, args });
    }
  }

  private async _applyOverrides(): Promise<StatefulTransactionBuilder> {
    // If external calls were added, rebuild the builder with external call context
    let builder: StatefulTransactionBuilder;
    let derived: Record<string, any> | undefined;

    await this._resolveLibrariesFromRegistry();
    this._autoWireLibraryDelegatecalls();
    const needsRebuild = (this.externalCallInfos.length > 0 || this.callInfos.length > 0
      || this.entryKeyOverrides.size > 0 || this.externalEntryKeyOverrides.size > 0 || this.emitReturnFlag)
      && this.parentContract && this.functionName && this.functionArgs;

    if (needsRebuild) {
      builder = await this.parentContract!._createBuilder(
        this.functionName!, this.functionArgs!, {
          externalCalls: this.externalCallInfos.length > 0 ? this.externalCallInfos : undefined,
          calls: this.callInfos.length > 0 ? this.callInfos : undefined,
          entryKeyOverrides: this.entryKeyOverrides.size > 0 ? this.entryKeyOverrides : undefined,
          externalEntryKeyOverrides: this.externalEntryKeyOverrides.size > 0 ? this.externalEntryKeyOverrides : undefined,
          emitReturn: this.emitReturnFlag || undefined,
          ...(this.compilerRoute && {
            abiFunction: this.compilerRoute.abiFunction,
            compilerRouteSelector: this.compilerRoute.selector,
            blockBase: this.compilerRoute.blockBase,
            emitReturn: this.compilerRoute.emitReturn,
            returnBlob: this.compilerRoute.returnBlob,
            omitLocalFeeTail: this.compilerRoute.omitLocalFeeTail,
          }),
        },
      );
      derived = (builder as any).__derivedState;

      // Apply external call state overrides to the builder
      for (const callInfo of this.externalCallInfos) {
        if (callInfo.stateOverrides) {
          for (const [name, value] of Object.entries(callInfo.stateOverrides)) {
            builder.setExternalCallState(callInfo.externalContract.categoryId, name, value);
          }
        }
      }
    } else {
      builder = await this.builderPromise;
      derived = (builder as any).__derivedState;
    }

    // Apply manual overrides (these take precedence over auto-derived values)
    for (const { name, value } of this.stateOverrides) {
      builder.setState(name, value);
    }

    // Apply entry overrides
    for (const { slotIndex, value } of this.entryOverrides) {
      builder.setEntry(slotIndex, value);
    }

    // Apply entry deletions
    for (const slotIndex of this.entryDeleteSlots) {
      builder.deleteEntry(slotIndex);
    }

    // Apply container deposit amount (payable functions)
    if (this.containerDepositAmount > 0n) {
      builder.setContainerDepositAmount(this.containerDepositAmount);
    }

    // Apply transfers: user overrides replace auto-derived transfers
    if (this.transfers.length > 0) {
      builder.clearTransfers();
      for (const { lockingBytecode, amount } of this.transfers) {
        builder.addTransfer(lockingBytecode, amount);
      }
    }

    // Apply token container transfers: user overrides replace auto-derived
    if (this.tokenContainerTransfers.length > 0) {
      builder.clearTokenContainerTransfers();
      for (const { tokenContainerCategoryId, lockingBytecode, amount } of this.tokenContainerTransfers) {
        builder.addTokenContainerTransfer(tokenContainerCategoryId, lockingBytecode, amount);
      }
    }

    // Apply token container transferNfts: user overrides replace auto-derived
    if (this.tokenContainerTransferNfts.length > 0) {
      builder.clearTokenContainerTransferNfts();
      for (const { tokenContainerCategoryId, lockingBytecode, commitment, capability } of this.tokenContainerTransferNfts) {
        builder.addTokenContainerTransferNft(tokenContainerCategoryId, lockingBytecode, commitment, capability);
      }
    }

    // Apply registry-based external state overrides (from 3-arg setExternalState(categoryId, name, value))
    for (const [categoryId, overrides] of this.registryExternalStateOverrides) {
      for (const [name, value] of Object.entries(overrides)) {
        builder.setExternalCallState(categoryId, name, value);
      }
    }

    // Detect satoshi container drain: if all satoshis are being transferred out,
    // rebuild the builder with drain knowledge so synthetic params use sentinel indices
    if (builder.isSatoshiContainerDrained() && this.parentContract && this.functionName && this.functionArgs) {
      builder = await this.parentContract._createBuilder(
        this.functionName, this.functionArgs, {
          externalCalls: this.externalCallInfos.length > 0 ? this.externalCallInfos : undefined,
          calls: this.callInfos.length > 0 ? this.callInfos : undefined,
          entryKeyOverrides: this.entryKeyOverrides.size > 0 ? this.entryKeyOverrides : undefined,
          externalEntryKeyOverrides: this.externalEntryKeyOverrides.size > 0 ? this.externalEntryKeyOverrides : undefined,
          drainSatoshiContainer: true,
          ...(this.compilerRoute && {
            abiFunction: this.compilerRoute.abiFunction,
            compilerRouteSelector: this.compilerRoute.selector,
            blockBase: this.compilerRoute.blockBase,
            emitReturn: this.compilerRoute.emitReturn,
            returnBlob: this.compilerRoute.returnBlob,
            omitLocalFeeTail: this.compilerRoute.omitLocalFeeTail,
          }),
        },
      );
      derived = (builder as any).__derivedState;

      // Re-apply all overrides to the new builder (user overrides replace auto-derived)
      this._reApplyOverrides(builder);
    }

    // Detect token container drain: if all FTs (and NFTs) are being transferred out,
    // rebuild the builder with drain knowledge so output flags exclude drained containers
    if (this.parentContract && this.functionName && this.functionArgs) {
      const drainedTokenContainers: string[] = [];
      for (const container of builder.getTokenContainerInfos()) {
        if (container.exists && container.utxo
          && builder.isTokenContainerDrained(container.tokenContainerCategoryId)) {
          drainedTokenContainers.push(container.tokenContainerCategoryId);
        }
      }
      if (drainedTokenContainers.length > 0) {
        const wasSatoshiDrained = builder.isSatoshiContainerDrained();
        builder = await this.parentContract._createBuilder(
          this.functionName, this.functionArgs, {
            externalCalls: this.externalCallInfos.length > 0 ? this.externalCallInfos : undefined,
            calls: this.callInfos.length > 0 ? this.callInfos : undefined,
            entryKeyOverrides: this.entryKeyOverrides.size > 0 ? this.entryKeyOverrides : undefined,
            externalEntryKeyOverrides: this.externalEntryKeyOverrides.size > 0 ? this.externalEntryKeyOverrides : undefined,
            drainSatoshiContainer: wasSatoshiDrained || undefined,
            drainTokenContainers: drainedTokenContainers,
            ...(this.compilerRoute && {
              abiFunction: this.compilerRoute.abiFunction,
              compilerRouteSelector: this.compilerRoute.selector,
              blockBase: this.compilerRoute.blockBase,
              emitReturn: this.compilerRoute.emitReturn,
              returnBlob: this.compilerRoute.returnBlob,
              omitLocalFeeTail: this.compilerRoute.omitLocalFeeTail,
            }),
          },
        );
        derived = (builder as any).__derivedState;

        // Re-apply all overrides to the new builder (user overrides replace auto-derived)
        this._reApplyOverrides(builder);
      }
    }

    // Re-derive if: (a) initial derivation returned no state, OR (b) the VM errored
    // during initial derivation (state may be incorrect/partial). In both cases,
    // re-derive only when new context (transfers) has been added and no manual
    // .setState() was called.
    const vmErrored = !!(builder as any).__vmErrored;
    const shouldReDerive = (!derived || vmErrored) && this.stateOverrides.length === 0;
    if (shouldReDerive) {
      const reDerive = (builder as any).__reDerive;
      const hasNewContext = this.transfers.length > 0
        || this.tokenContainerTransfers.length > 0
        || this.tokenContainerTransferNfts.length > 0
        || this.containerDepositAmount > 0n;
      if (reDerive && hasNewContext) {
        const reResult = await reDerive(builder);
        derived = reResult.state;
        (builder as any).__vmErrored = reResult.vmErrored;
        (builder as any).__derivationError = reResult.derivationError;
        (builder as any).__derivedTransfers = reResult.derivedTransfers;
        (builder as any).__derivedTokenContainerTransfers = reResult.derivedTokenContainerTransfers;
        (builder as any).__derivedTokenContainerTransferNfts = reResult.derivedTokenContainerTransferNfts;
      }

      if (!derived && this.stateOverrides.length === 0) {
        const derivationError = (builder as any).__derivationError;
        const detail = derivationError ? ` Reason: ${derivationError.message}` : '';
        throw new Error(
          'Cannot send stateful transaction: state commitments could not be auto-derived.'
          + detail + ' Use .setState() to provide state values manually.',
        );
      }

      // If VM errored after re-derivation, validate completeness: ensure the derived
      // state covers all expected variables. VM errors are normal for external calls and
      // drain scenarios (the on-chain VM is the final arbiter), but if the derived state
      // is missing variables, it's likely partial/incorrect and should not be used.
      if (derived && (builder as any).__vmErrored && this.parentContract) {
        const expectedVars = this.parentContract.inner.artifact.stateLayout?.variables ?? [];
        const derivedKeys = Object.keys(derived);
        if (expectedVars.length > 0 && derivedKeys.length < expectedVars.length) {
          const missing = expectedVars
            .filter((v: { name: string }) => !(v.name in derived!))
            .map((v: { name: string }) => v.name);
          const derivationError = (builder as any).__derivationError;
          const detail = derivationError ? ` Reason: ${derivationError.message}` : '';
          throw new Error(
            `Auto-derivation produced incomplete state (missing: ${missing.join(', ')}). `
            + 'The VM errored before all commitments could be extracted.'
            + detail + ' Use .setState() to provide state values manually.',
          );
        }
      }
    }

    // X10. A dynamic-storage chunk region that is not FULLY derived must never be broadcast. '00' is the seed
    // placeholder, never a real chunk commitment (a chunk carries an index opcode, a push opcode and >= 1 data
    // byte), so a '00' left in the region means the covenant never verified that output. Building it anyway
    // mints a garbage chunk NFT no later chunked read can parse, and - when a C2 entry mint shares the trailing
    // region - the covenant's NEW-node check lands inside the chunk window, so the mint's commitment is written
    // at a chunk index as well and the region carries it twice. Refuse by name instead of assembling it.
    for (const dv of builder.getDynamicChunkVars()) {
      const chunkCommitments = builder.getChunkRawCommitments(dv.name);
      const unresolvedChunks = chunkCommitments.filter((c) => c === '00').length;
      if (unresolvedChunks > 0) {
        const derivationError = (builder as any).__derivationError;
        const detail = derivationError ? ` Reason: ${derivationError.message}` : '';
        throw new Error(
          `Cannot send stateful transaction: the dynamic storage chunk region for '${dv.name}' is not fully `
          + `derived (${chunkCommitments.length - unresolvedChunks} of ${chunkCommitments.length} chunks `
          + 'resolved). The covenant did not verify every chunk output the SDK laid out, so the remaining '
          + 'chunks cannot be funded correctly.' + detail,
        );
      }
    }

    // Check for unresolved placeholder transfers: if the function expects transfers
    // but auto-derivation failed (vmErrored, placeholders not resolved) and the user
    // didn't provide manual .transfer() overrides, throw an explicit error rather than
    // silently building a transaction with dummy amounts the covenant would reject.
    const expectedSatoshiTransfers = (builder as any).__expectedTransferCount ?? 0;
    const expectedFtTransfers = (builder as any).__expectedFtTransferCount ?? 0;
    if (expectedSatoshiTransfers > 0 && this.transfers.length === 0
        && !(builder as any).__derivedTransfers) {
      const derivationError = (builder as any).__derivationError;
      const detail = derivationError ? ` Reason: ${derivationError.message}` : '';
      throw new Error(
        'Cannot send stateful transaction: transfer amounts could not be auto-derived '
        + `(${expectedSatoshiTransfers} satoshi transfer(s) expected).`
        + detail + ' Use .transfer() to provide transfer outputs manually.',
      );
    }
    if (expectedFtTransfers > 0 && this.tokenContainerTransfers.length === 0
        && !(builder as any).__derivedTokenContainerTransfers) {
      const derivationError = (builder as any).__derivationError;
      const detail = derivationError ? ` Reason: ${derivationError.message}` : '';
      throw new Error(
        'Cannot send stateful transaction: token container transfer amounts could not be auto-derived '
        + `(${expectedFtTransfers} FT transfer(s) expected).`
        + detail + ' Use .tokenContainerTransfer() to provide transfer outputs manually.',
      );
    }
    const expectedNftTransfers = (builder as any).__expectedNftTransferCount ?? 0;
    if (expectedNftTransfers > 0 && this.tokenContainerTransferNfts.length === 0
        && !(builder as any).__derivedTokenContainerTransferNfts) {
      const derivationError = (builder as any).__derivationError;
      const detail = derivationError ? ` Reason: ${derivationError.message}` : '';
      throw new Error(
        'Cannot send stateful transaction: NFT container transfers could not be auto-derived '
        + `(${expectedNftTransfers} NFT transfer(s) expected).`
        + detail + ' Use .tokenContainerTransferNft() to provide transfer outputs manually.',
      );
    }

    // Apply max fee override if user specified one
    if (this.maxFeeOverride !== undefined) {
      builder.setMaximumFeeSatoshis(this.maxFeeOverride);
    }

    // Add extra outputs
    for (const output of this.extraOutputs) {
      builder.addOutput(output);
    }
    for (const event of this.manualEvents) builder.emitEvent(event.name, ...event.args);
    for (const event of this.detachedEvents) {
      if (event.definition && event.lockingBytecode) {
        builder.registerDetachedEvent(event.definition, event.lockingBytecode);
      }
      builder.emitDetachedEvent(event.name, ...event.args);
    }

    return builder;
  }

  /**
   * Build a raw TransactionBuilder for a split function.
   * Transaction: [master, funding...] -> [master_preserved, new_minting_1..N, change]
   */
  private async _buildSplitTransactionBuilder(
    abiFunction: { inputs: readonly { name: string }[]; splitCountParam?: string },
    maxFeeOverride?: bigint,
  ): Promise<TransactionBuilder> {
    const sc = this.parentContract!;
    const contract = sc.inner;
    const categoryId = sc.categoryId;
    const config = this.splitFundingConfig!;

    // Extract split count from args
    const countParamIndex = abiFunction.inputs.findIndex(
      (p) => p.name === abiFunction.splitCountParam,
    );
    const splitCount = Number(this.functionArgs![countParamIndex]);
    const newMintingAmount = config.newMintingAmount ?? 1200n;

    // Get master UTXO
    const tokenUtxos = await contract.provider.getUtxos(contract.tokenAddress);
    const masterUtxo = tokenUtxos.find(
      (u) => u.token?.category === categoryId && u.token?.nft?.capability === 'minting',
    );
    if (!masterUtxo) {
      throw new Error(`Master UTXO not found for contract '${contract.name}' (category ${categoryId}).`);
    }

    const { TransactionBuilder: TxBuilder } = await import('../TransactionBuilder.js');
    const builder = new TxBuilder({
      provider: contract.provider,
      ...(maxFeeOverride != null ? { maximumFeeSatoshis: maxFeeOverride } : {}),
    });

    // Input 0: master UTXO (unlocked with split function)
    builder.addInput(masterUtxo, contract.unlock[this.functionName!]!(...this.functionArgs!));

    // Inputs 1+: funding UTXOs
    for (const fundingUtxo of config.utxos) {
      builder.addInput(fundingUtxo, config.unlocker);
    }

    // Output 0: master preserved
    builder.addOutput({
      to: contract.tokenAddress,
      amount: masterUtxo.satoshis,
      token: {
        category: categoryId,
        amount: 0n,
        nft: { capability: 'minting', commitment: masterUtxo.token?.nft?.commitment ?? '' },
      },
    });

    // Outputs 1..N: new minting NFTs
    for (let i = 0; i < splitCount; i++) {
      builder.addOutput({
        to: contract.tokenAddress,
        amount: newMintingAmount,
        token: {
          category: categoryId,
          amount: 0n,
          nft: { capability: 'minting', commitment: '' },
        },
      });
    }

    // Compute fee from actual transaction size (1 sat/byte minimum relay fee).
    // Add a placeholder change output before estimating so the fee accounts for it.
    builder.addOutput({ to: config.changeAddress, amount: 1000n }); // placeholder
    const fee = config.fee ?? await computeFeeFromBuilder(builder);

    // Change output
    const totalFunding = config.utxos.reduce((sum, u) => sum + u.satoshis, 0n);
    const changeAmount = totalFunding - (newMintingAmount * BigInt(splitCount)) - fee;
    if (changeAmount < 0n) {
      builder.outputs.pop(); // remove placeholder
      throw new Error(
        `Insufficient funding for split: need ${newMintingAmount * BigInt(splitCount) + fee} sats `
        + `but only have ${totalFunding} sats from funding UTXOs.`,
      );
    }
    if (changeAmount > 0n) {
      builder.outputs[builder.outputs.length - 1] = {
        ...builder.outputs[builder.outputs.length - 1], amount: changeAmount,
      };
    } else {
      builder.outputs.pop(); // remove placeholder - no change needed
    }

    return builder;
  }

  /**
   * Build a raw TransactionBuilder for a merge function.
   * Transaction: [master_surviving, consumed_1..N, funding...] -> [master_preserved, change]
   */
  private async _buildMergeTransactionBuilder(
    abiFunction: { inputs: readonly { name: string }[]; mergeCountParam?: string },
    maxFeeOverride?: bigint,
  ): Promise<TransactionBuilder> {
    const sc = this.parentContract!;
    const contract = sc.inner;
    const categoryId = sc.categoryId;
    const config = this.mergeConfig!;

    // Validate count
    const countParamIndex = abiFunction.inputs.findIndex(
      (p) => p.name === abiFunction.mergeCountParam,
    );
    const mergeCount = Number(this.functionArgs![countParamIndex]);
    if (config.consumedMasters.length !== mergeCount) {
      throw new Error(
        `Merge count is ${mergeCount} but ${config.consumedMasters.length} consumed UTXOs provided.`,
      );
    }

    // Get surviving master UTXO (exclude consumed UTXOs to prevent self-consuming merge)
    const consumedOutpoints = new Set(config.consumedMasters.map((u) => `${u.txid}:${u.vout}`));
    const tokenUtxos = await contract.provider.getUtxos(contract.tokenAddress);
    const masterUtxo = tokenUtxos.find(
      (u) => u.token?.category === categoryId
        && u.token?.nft?.capability === 'minting'
        && !consumedOutpoints.has(`${u.txid}:${u.vout}`),
    );
    if (!masterUtxo) {
      throw new Error(`Master UTXO not found for contract '${contract.name}' (category ${categoryId}). All minting UTXOs may be in the consumed set.`);
    }

    const { TransactionBuilder: TxBuilder } = await import('../TransactionBuilder.js');
    const builder = new TxBuilder({
      provider: contract.provider,
      allowImplicitNftBurn: true,
      ...(maxFeeOverride != null ? { maximumFeeSatoshis: maxFeeOverride } : {}),
    });

    // Input 0: surviving master UTXO
    builder.addInput(masterUtxo, contract.unlock[this.functionName!]!(...this.functionArgs!));

    // Inputs 1..N: consumed master UTXOs (same function + args)
    for (const consumed of config.consumedMasters) {
      builder.addInput(consumed, contract.unlock[this.functionName!]!(...this.functionArgs!));
    }

    // Inputs N+1+: funding UTXOs
    const fundingUtxos = config.fundingUtxos ?? [];
    for (const fundingUtxo of fundingUtxos) {
      builder.addInput(fundingUtxo, config.fundingUnlocker!);
    }

    // Output 0: surviving master preserved
    builder.addOutput({
      to: contract.tokenAddress,
      amount: masterUtxo.satoshis,
      token: {
        category: categoryId,
        amount: 0n,
        nft: { capability: 'minting', commitment: masterUtxo.token?.nft?.commitment ?? '' },
      },
    });

    // Compute fee from actual transaction size (1 sat/byte minimum relay fee).
    // Add a placeholder change output before estimating so the fee accounts for it.
    builder.addOutput({ to: config.changeAddress, amount: 1000n }); // placeholder
    const fee = config.fee ?? await computeFeeFromBuilder(builder);

    // Change output (reclaim consumed masters' satoshis minus fee)
    const consumedSatoshis = config.consumedMasters.reduce((sum, u) => sum + u.satoshis, 0n);
    const fundingSatoshis = fundingUtxos.reduce((sum, u) => sum + u.satoshis, 0n);
    const changeAmount = consumedSatoshis + fundingSatoshis - fee;
    if (changeAmount < 0n) {
      builder.outputs.pop(); // remove placeholder
      throw new Error(
        `Insufficient funding for merge: need ${fee} sats for fee `
        + `but only have ${consumedSatoshis + fundingSatoshis} sats from consumed + funding UTXOs.`,
      );
    }
    if (changeAmount > 0n) {
      builder.outputs[builder.outputs.length - 1] = {
        ...builder.outputs[builder.outputs.length - 1], amount: changeAmount,
      };
    } else {
      builder.outputs.pop(); // remove placeholder - no change needed
    }

    return builder;
  }

  /**
   * Re-apply user overrides to a rebuilt builder.
   * New builder already has auto-derived values; user overrides replace them.
   */
  private _reApplyOverrides(builder: StatefulTransactionBuilder): void {
    for (const { name, value } of this.stateOverrides) builder.setState(name, value);
    for (const { slotIndex, value } of this.entryOverrides) builder.setEntry(slotIndex, value);
    for (const slotIndex of this.entryDeleteSlots) builder.deleteEntry(slotIndex);
    if (this.containerDepositAmount > 0n) builder.setContainerDepositAmount(this.containerDepositAmount);
    if (this.transfers.length > 0) {
      builder.clearTransfers();
      for (const { lockingBytecode, amount } of this.transfers) builder.addTransfer(lockingBytecode, amount);
    }
    if (this.tokenContainerTransfers.length > 0) {
      builder.clearTokenContainerTransfers();
      for (const t of this.tokenContainerTransfers) {
        builder.addTokenContainerTransfer(t.tokenContainerCategoryId, t.lockingBytecode, t.amount);
      }
    }
    if (this.tokenContainerTransferNfts.length > 0) {
      builder.clearTokenContainerTransferNfts();
      for (const t of this.tokenContainerTransferNfts) {
        builder.addTokenContainerTransferNft(t.tokenContainerCategoryId, t.lockingBytecode, t.commitment, t.capability);
      }
    }
    for (const [catId, ov] of this.registryExternalStateOverrides) {
      for (const [name, value] of Object.entries(ov)) builder.setExternalCallState(catId, name, value);
    }
    for (const callInfo of this.externalCallInfos) {
      if (callInfo.stateOverrides) {
        for (const [name, value] of Object.entries(callInfo.stateOverrides)) {
          builder.setExternalCallState(callInfo.externalContract.categoryId, name, value);
        }
      }
    }
  }
}
