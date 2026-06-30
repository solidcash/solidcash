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
  DYNAMIC_CHUNK_SIZE,
  computeEventNameHash,
  parsePushdataCommitment,
  buildPushdataCommitment,
  parseEntryCommitment,
  StateValue,
  parseEntryCommitmentMultiKey,
  Op,
  StateLayout,
  ExternalReadAbi,
  EntryAccessAbi,
  EmitAbi,
  sidecarLockingBytecode,
  resolveLibraryBlob,
  SHARED_LIBRARY_SALT,
  ExternalLibraryAbi,
} from '@solidcash/utils';
import {
  createVirtualMachineBch2026,
  binToHex,
  hexToBin,
  binsAreEqual,
  AuthenticationProgramStateCommon,
  encodeLockingBytecodeP2pkh,
} from '@bitauth/libauth';
import { Contract } from '../Contract.js';
import { resolveBlockhashCoSpend } from '../oracle/blockhashCoSpend.js';
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
  getDynamicChunkAddress,
  getDataNftLockingBytecode, getEntryNftLockingBytecode,
  getTokenContainerAddress, getSatoshiContainerAddress, getContractState,
  createDataNftUnlocker, createDestroyDataNftUnlocker,
  createReadOnlyDataNftUnlocker, createEntryNftUnlocker, createReadOnlyEntryNftUnlocker,
  createDynamicChunkUnlocker, createReadOnlyDynamicChunkUnlocker,
  createEventNftUnlocker, createAnonymousEventNftUnlocker,
  createTokenContainerUnlocker, createSatoshiContainerUnlocker,
  resolveCollectionSignature, resolveCategoryFromLockingBytecode,
} from './covenant-helpers.js';
import { ConstructorArgument, FunctionArgument } from '../Argument.js';
import { AbiToFunctionMap } from '../types/type-inference.js';
import { StateGetterMap, StateValueType } from '../types/state-inference.js';
import { findLastIndex, generateLibauthSourceOutputs, scriptToAddress, scriptToLockingBytecode } from '../utils.js';
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

/**
 * Compute the minimum relay fee for a built TransactionBuilder at 1 sat/byte.
 * Uses the serialized transaction size as the fee floor.
 */
async function computeFeeFromBuilder(builder: TransactionBuilder): Promise<bigint> {
  const { encodeTransaction } = await import('@bitauth/libauth');
  const tx = builder.buildLibauthTransaction();
  return BigInt(encodeTransaction(tx).byteLength);
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
  fundingUtxo: Utxo;                         // must be at vout 0 for token genesis (becomes child category)
  funder?: Unlocker;                         // unlocker for funding UTXO; else factory.setDeployDefaults()
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

/**
 * Extract expected commitment hex strings from a VM debug trace.
 *
 * The contract verifies state via: <expected> OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY
 * This scans the trace for those patterns and extracts the expected commitment bytes.
 */
function extractCommitmentsFromTrace(
  fullTrace: AuthenticationProgramStateCommon[],
  expectedCount: number,
  outputIndexRange?: { min: number; max: number },
): string[] | undefined {
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

  // Build final commitment list (both paths now use commitmentsByOutputIndex for correct
  // "last write wins" semantics when loops overwrite the same output index)
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

// Property names reserved by StatefulContract - state variables with these names
// are only accessible via the `state` namespace to avoid shadowing class members.
const RESERVED_NAMES = new Set([
  'inner', 'categoryId', 'state', 'call', 'functions',
  'address', 'tokenAddress', 'name', 'provider', 'getState',
  'tokens', 'connect', 'attach', 'getFullState',
  'getBalance',
]);

export type ConnectedStatefulContract<T extends Artifact = Artifact> =
  StatefulContract<T>
  & AbiToFunctionMap<T['abi'], StatefulFunctionCall, DeployFunctionCall>
  & Omit<StateGetterMap<T>, keyof AbiToFunctionMap<T['abi'], StatefulFunctionCall, DeployFunctionCall>>;

export class StatefulContract<TArtifact extends Artifact = Artifact> {
  readonly inner: Contract<TArtifact>;
  readonly categoryId: string;

  readonly state: StateGetterMap<TArtifact>;
  readonly call: AbiToFunctionMap<TArtifact['abi'], StatefulFunctionCall, DeployFunctionCall>;
  readonly functions: AbiToFunctionMap<TArtifact['abi'], Promise<StatefulTransactionBuilder>>;
  readonly tokens: { [tokenContainerCategoryIdHex: string]: TokenContainerAccessor };

  private _externalRegistry: Map<string, ConnectedStatefulContract> = new Map();

  /**
   * Register the callee instances for an array-element external call `IFoo(arr[i]).m()` (in array order).
   * Stored in the base Contract's unified external-target registry (keyed by each instance's address), shared
   * with opaque loop dispatch (contract.multiCall). The covenant verifies each co-spent callee against arr[i],
   * so the registration order must match the on-chain array.
   */
  registerExternalArray(interfaceName: string, instances: ConnectedStatefulContract[]): void {
    for (const inst of instances) {
      this.inner.registerExternalTarget({ address: inst.inner.lockingBytecode, interfaceName, instance: inst });
    }
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
    if (override.fundingUtxo) {
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

  /**
   * Maximum number of VM probe iterations for auto-derivation.
   * Each iteration captures commitments up to the first mismatch; convergence
   * typically occurs within 3-5 iterations. Default: 20.
   * Increase only if your contract has many interdependent state variables.
   */
  maxDerivationIterations: number = 20;

  private constructor(contract: Contract<TArtifact>, categoryId: string) {
    if (!contract.isStateful || !contract.stateLayout) {
      throw new Error(`Contract ${contract.name} is not a stateful contract`);
    }

    if (contract.addressType !== 'p2sh32') {
      throw new Error(
        `Stateful contract '${contract.name}' must use p2sh32 address type. `
        + `Got '${contract.addressType}'.`,
      );
    }

    this.inner = contract;
    this.categoryId = categoryId;

    // Build state getters on the `state` namespace
    this.state = {} as StateGetterMap<TArtifact>;
    for (const variable of contract.stateLayout.variables) {
      const getter = async (): Promise<any> => {
        const state = await this.getState();
        return state[variable.name];
      };

      // @ts-ignore - dynamic property assignment for type-safe getters
      this.state[variable.name] = getter;

      // Also expose directly on the instance (e.g. sc.counter()) unless it
      // would shadow a built-in property.
      if (!RESERVED_NAMES.has(variable.name)) {
        (this as any)[variable.name] = getter;
      }
    }

    // Collect state variable names so we can detect collisions with ABI functions
    const stateVarNames = new Set(contract.stateLayout.variables.map((v) => v.name));

    // Build call namespace (returns StatefulFunctionCall)
    this.call = {} as AbiToFunctionMap<TArtifact['abi'], StatefulFunctionCall, DeployFunctionCall>;
    for (const abiFunction of contract.artifact.abi) {
      // A deploy-modifier function returns a thenable DeployFunctionCall: `await factory.deployFn(...args)`
      // funds + runs the deploy via the connected signer (no normal builder is eagerly created for it).
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

      // Also expose directly on the instance (e.g. sc.update(...)) unless it
      // would shadow a built-in property or a state getter.
      if (!RESERVED_NAMES.has(abiFunction.name) && !stateVarNames.has(abiFunction.name)) {
        (this as any)[abiFunction.name] = caller;
      }
    }

    // Build functions namespace (returns Promise<StatefulTransactionBuilder>)
    this.functions = {} as AbiToFunctionMap<TArtifact['abi'], Promise<StatefulTransactionBuilder>>;
    for (const abiFunction of contract.artifact.abi) {
      // @ts-ignore - dynamic property assignment
      this.functions[abiFunction.name] = (...args: any[]) => this._createBuilder(abiFunction.name, args);
    }

    // Build tokens Proxy for token container sugar (sc.tokens[categoryHex])
    this.tokens = new Proxy({} as Record<string, TokenContainerAccessor>, {
      get: (_target, prop) => {
        if (typeof prop !== 'string') return undefined;
        return new TokenContainerAccessor(this, prop);
      },
    });
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
   * Return a new instance with the same target (categoryId + artifact) but a different runner (provider).
   * Analogous to ethers.js `contract.connect(runner)`.
   */
  /**
   * Bind a signer to this contract for automatic transaction funding.
   * The signer provides UTXOs, signing, and change address.
   *
   * Analogous to ethers.js `contract.connect(signer)`.
   *
   * ```typescript
   * const signer = new Signer(privateKey, provider);
   * await sc.connect(signer).call.increment().send();
   * ```
   */
  connect(signer: Signer): ConnectedStatefulContract<TArtifact> {
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
    const dataNftAddress = getDataNftAddress(contract, categoryId);

    const masterAmount = options.masterAmount ?? 1200n;
    const dataNftAmount = options.dataNftAmount ?? 1200n;
    const fee = options.fee ?? 5000n;

    const constructorAbi = artifact.abi.find((f) => f.name === '__construct');

    // Determine counts for constructor features
    const entryAccesses = constructorAbi?.entryAccesses ?? [];
    const entryCount = entryAccesses.length;
    const emitCount = constructorAbi?.emits?.length ?? 0;

    const threadCount = options.threadCount ?? 1;
    if (threadCount < 1 || !Number.isInteger(threadCount)) {
      throw new Error(`threadCount must be a positive integer, got ${threadCount}`);
    }

    const initialBalance = options.initialBalance ?? 0n;
    const totalMaster = masterAmount * BigInt(threadCount);
    const totalDataNft = dataNftAmount * BigInt(stateLayout.dataNftCount);
    const totalEntryNft = dataNftAmount * BigInt(entryCount);
    const totalEventNft = dataNftAmount * BigInt(emitCount);
    const totalRequired = totalMaster + totalDataNft + totalEntryNft + totalEventNft + initialBalance + fee;
    const changeAmount = options.fundingUtxo.satoshis - totalRequired;

    if (changeAmount < 0n) {
      throw new Error(
        `Insufficient funding: ${options.fundingUtxo.satoshis} satoshis provided, `
        + `but ${totalRequired} needed `
        + `(master: ${totalMaster} (${threadCount}x${masterAmount}), data NFTs: ${totalDataNft}, `
        + `entry NFTs: ${totalEntryNft}, event NFTs: ${totalEventNft}, fee: ${fee}).`,
      );
    }

    // Determine initial commitments and additional outputs
    let commitments: string[];
    let entryCommitments: string[] = [];
    let eventCommitments: string[] = [];
    let transferOutputs: Array<{ lockingBytecode: Uint8Array; amount: bigint }> = [];

    // Check if constructor has sig params - probe won't work for those
    const hasSigParams = constructorAbi?.inputs.some((inp) => inp.type === 'sig') ?? false;

    if (constructorAbi && !hasSigParams) {
      // Use inference: build probe transaction with synthetic UTXOs
      const derived = await StatefulContract._deriveDeployCommitments(
        contract, artifact, stateLayout, categoryId, dataNftAddress,
        masterAmount, dataNftAmount, options,
      );
      commitments = derived.stateCommitments;
      entryCommitments = derived.entryCommitments;
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
      commitments = buildInitialStateCommitments(stateLayout, options.initialState);
    } else {
      // No constructor: use explicit initialState or zero-initialized defaults
      commitments = buildInitialStateCommitments(stateLayout, options.initialState ?? {});
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
    for (let i = 0; i < stateLayout.dataNftCount; i++) {
      builder.addOutput({
        to: dataNftAddress,
        amount: dataNftAmount,
        token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: commitments[i] } },
      });
    }

    // Entry NFT outputs (mapping writes in constructor)
    for (let i = 0; i < entryCount; i++) {
      const access = entryAccesses[i];
      const entryNftAddress = getEntryNftAddress(contract, categoryId, access.collection);
      builder.addOutput({
        to: entryNftAddress,
        amount: dataNftAmount,
        token: {
          category: categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: entryCommitments[i] ?? '' },
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
        const eventNftAddress = isAnonymous
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

    // Satoshi container output (if initialBalance > 0)
    if (initialBalance > 0n) {
      const satoshiContainerAddress = getSatoshiContainerAddress(contract, categoryId);
      builder.addOutput({ to: satoshiContainerAddress, amount: initialBalance });
    }

    // Change output (account for transfer amounts)
    const totalTransferAmount = transferOutputs.reduce((sum, t) => sum + t.amount, 0n);
    const finalChange = changeAmount - totalTransferAmount;
    if (finalChange < 0n) {
      throw new Error(
        'Insufficient funding: constructor transfers require '
        + `${totalTransferAmount} satoshis but only `
        + `${changeAmount} satoshis are available for change. `
        + 'Increase the funding UTXO amount.',
      );
    }
    if (finalChange > 0n) {
      builder.addOutput({ to: options.changeAddress, amount: finalChange });
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

    // Validate funding UTXO
    if (options.fundingUtxo.vout !== 0) {
      throw new Error(
        'Funding UTXO must be at vout 0 to create a valid token category. '
        + `Got vout ${options.fundingUtxo.vout}.`,
      );
    }

    const childCategoryId = options.fundingUtxo.txid;
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
    const childContractUnsalted = new Contract(childArtifact, childConstructorArgs as any, {
      provider,
      addressType,
      category: hexToBin(childCategoryId),
      ...(childSalt && { salt: childSalt }),
    });

    // The returned handle uses the same self-pinned address as the deployed genesis.
    const childContract = childContractUnsalted;

    const childLayout = childArtifact.stateLayout!;

    // Compute child's initial state commitments
    const childCommitments = buildInitialStateCommitments(
      childLayout, options.childInitialState ?? {},
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

    // Resolve entry NFT accesses (mapping writes): each becomes an entry NFT output keyed
    // by the factory category. Existing entries are also added as inputs; new entries need
    // none (the funding UTXO at the entry slot has no token, so the covenant reads default).
    const factoryLayout = factory.inner.stateLayout!;
    const entryAccesses = deployAbi.entryAccesses ?? [];
    const entryInfos: Array<{
      collection: string; keyValue: bigint | boolean | Uint8Array; existingUtxo?: Utxo;
    }> = [];
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

      // Find an existing entry NFT whose key matches (write-to-existing path).
      let existingUtxo: Utxo | undefined;
      for (const utxo of onChainState.entryNftUtxos) {
        if (utxo.token?.category !== factory.categoryId || !utxo.token?.nft?.commitment) continue;
        try {
          const parsed = parseEntryCommitment(
            utxo.token.nft.commitment, collection.keyType, collection.valueType, factoryLayout.structs,
          );
          if ((factory as StatefulContract)._keysMatch(parsed.key, keyValue, collection.keyType)) {
            existingUtxo = utxo;
            break;
          }
        } catch {
          // Not an entry of this collection - skip
        }
      }
      entryInfos.push({ collection: access.collection, keyValue, existingUtxo });
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
          nft: { capability: 'mutable', commitment: '' },
        },
      });
    }

    // Existing entry NFTs become inputs at their block-layout slots (before the funding UTXO).
    const entryExtraInputs: Array<{ utxo: Utxo; unlocker: Unlocker }> = [];
    for (const info of entryInfos) {
      if (!info.existingUtxo) continue;
      entryExtraInputs.push({
        utxo: info.existingUtxo,
        unlocker: createEntryNftUnlocker(factory.inner, 0, factory.categoryId, info.collection),
      });
    }

    // Create unlockers for factory's master UTXO and data NFTs
    const masterUnlocker = (factory.inner.unlock as any)[deployFunctionName](...finalArgs);
    const dataNftUnlockers = filteredDataNftUtxos.map(
      () => createDataNftUnlocker(factory.inner, 0, factory.categoryId),
    );

    // Build child outputs for VM probe (needed by deploy covenant verification)
    const childDataNftAddress = getDataNftAddress(childContractUnsalted, childCategoryId);
    const childExtraOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];

    // Child master NFT output
    childExtraOutputs.push({
      to: childContractUnsalted.tokenAddress,
      amount: masterAmount,
      token: {
        category: childCategoryId,
        amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    });

    // Child data NFT outputs
    for (let i = 0; i < childLayout!.dataNftCount; i++) {
      childExtraOutputs.push({
        to: childDataNftAddress,
        amount: dataNftAmount,
        token: {
          category: childCategoryId,
          amount: 0n,
          nft: { capability: 'mutable', commitment: childCommitments[i] },
        },
      });
    }

    // Derive factory state + entry commitments via VM probe. Inputs: master, data NFTs,
    // existing entries, funding. Outputs: master, data NFTs, entries, child outputs.
    const {
      state: derivedState, entryCommitments, childCommitments: derivedChildCommitments,
    } = await (factory as StatefulContract)._deriveCommitments(
      deployFunctionName, finalArgs, requiredNftIndices,
      [...entryPlaceholderOutputs, ...childExtraOutputs],
      [...entryExtraInputs, { utxo: options.fundingUtxo, unlocker: funder }],
      entryInfos.length,
      childLayout!.dataNftCount,
    );

    // Deploy-then-call fold: the covenant may verify a post-call child genesis (a same-tx
    // `child.foo(args)` folded into the deploy). Prefer the trace-derived commitment; fall back to the
    // static initial state for a plain deploy that lands the child at default. See deploy-then-call-fold.md.
    const effectiveChildCommitments = Array.from(
      { length: childLayout!.dataNftCount },
      (_, i) => derivedChildCommitments[i] ?? childCommitments[i],
    );
    if (entryInfos.length > 0 && entryCommitments.length < entryInfos.length) {
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

    // Funding UTXO for child's token genesis
    builder.addInput(options.fundingUtxo, funder);

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
        amount: info.existingUtxo?.satoshis ?? dataNftAmount,
        token: {
          category: factory.categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: entryCommitments[i] },
        },
      });
    }

    // === Child contract outputs (appended after factory outputs) ===

    // Child minting NFT - use unsalted address to match compiler's `new` expression
    builder.addOutput({
      to: childContractUnsalted.tokenAddress,
      amount: masterAmount,
      token: {
        category: childCategoryId,
        amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    });

    // Child data NFTs - use unsalted data NFT address
    for (let i = 0; i < childLayout!.dataNftCount; i++) {
      builder.addOutput({
        to: childDataNftAddress,
        amount: dataNftAmount,
        token: {
          category: childCategoryId,
          amount: 0n,
          nft: { capability: 'mutable', commitment: effectiveChildCommitments[i] },
        },
      });
    }

    // Change output. New entries cost dust from the funding UTXO; existing entries are
    // satoshi-neutral (input funds output).
    const newEntryCount = BigInt(entryInfos.filter((e) => !e.existingUtxo).length);
    const totalChildCost = masterAmount + (dataNftAmount * BigInt(childLayout!.dataNftCount));
    const totalEntryCost = dataNftAmount * newEntryCount;
    const changeAmount = options.fundingUtxo.satoshis - totalChildCost - totalEntryCost - fee;
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
    const builtTxs: Array<{ hex: string; reclaimed: bigint }> = [];

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
  ): Promise<{ hex: string; reclaimed: bigint }> {
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
      return { hex, reclaimed: reclaimed > 0n ? reclaimed : 0n };
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
    return { hex, reclaimed };
  }

  /**
   * Send a TransactionBuilder that contains custom unlockers.
   * The standard send() method fails to produce a meaningful error for custom
   * unlockers because getBitauthUri() throws. This helper builds, sends raw,
   * and constructs TransactionDetails directly.
   */
  private static async _sendBuilderWithCustomUnlockers(
    builder: import('../TransactionBuilder.js').TransactionBuilder,
  ): Promise<TransactionDetails> {
    const { decodeTransaction, hash256 } = await import('@bitauth/libauth');

    const hex = builder.build();
    const txBin = hexToBin(hex);
    const txid = await builder.provider.sendRawTransaction(hex);

    // Verify txid matches locally computed hash to detect compromised providers
    const expectedTxid = binToHex(hash256(txBin).reverse());
    if (txid !== expectedTxid) {
      throw new Error(
        `Txid mismatch: provider returned '${txid}', expected '${expectedTxid}'. `
        + 'The network provider may be compromised.',
      );
    }

    const libauthTransaction = decodeTransaction(txBin);
    if (typeof libauthTransaction === 'string') {
      throw new Error(`Failed to decode transaction: ${libauthTransaction}`);
    }
    return { ...libauthTransaction, txid, hex };
  }

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
      eventCommitments: string[];
      transferOutputs: Array<{ lockingBytecode: Uint8Array; amount: bigint }>;
    }> {
    const constructorAbi = artifact.abi.find((f) => f.name === '__construct');
    const entryAccesses = constructorAbi?.entryAccesses ?? [];
    const entryCount = entryAccesses.length;
    const transferCount = constructorAbi?.transferCount ?? 0;
    const emitInfos = constructorAbi?.emits ?? [];
    const emitCount = emitInfos.length;

    const zeroCommitments = buildInitialStateCommitments(stateLayout, {});

    // Synthetic master UTXO (contract's locking script + minting NFT)
    const syntheticMaster: Utxo = {
      txid: '00'.repeat(32), vout: 0, satoshis: masterAmount,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    // Build synthetic initArgs with synthetic parameters appended
    const initArgs = [...(options.initArgs ?? [])];



    const requiredIndices = constructorAbi?.requiredNftIndices
      ?? Array.from({ length: stateLayout.dataNftCount }, (_, i) => i);
    const { CovenantTransactionBuilder } = await import('./CovenantTransactionBuilder.js');
    const vm = createVirtualMachineBch2026();
    const allEventDefs = artifact.events ?? [];
    const maxDeployIterations = 5;
    const seenDeployKeys = new Set<string>();

    let currentCommitments = [...zeroCommitments];
    let stateCommitments: string[] = [];
    let entryCommits: string[] = [];
    let eventCommits: string[] = [];
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
              commitment: currentCommitments[i],
            },
          },
        }),
      );

      const constructorUnlocker = (contract.unlock as any).__construct(
        ...initArgs,
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

      // Plain (no-token) inputs at the constructor's entry-write slots, so the write covenant's slot-exists
      // check reads "empty" -> new entry (genesis has no pre-existing entries). Placed right after the data
      // NFTs to match the block layout (master, data NFTs, entries) for a constructor without external reads.
      for (let e = 0; e < entryCount; e++) {
        probeBuilder.addInput(
          { txid: `${'00'.repeat(31)}ee`, vout: e, satoshis: dataNftAmount },
          {
            generateLockingBytecode: (): Uint8Array => DUMMY_FUNDER_LOCKING_BYTECODE,
            generateUnlockingBytecode: (): Uint8Array => DUMMY_FUNDER_UNLOCKING_BYTECODE,
          },
        );
      }

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
          token: nft.token,
        });
      });

      // Entry NFT placeholder outputs
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
            nft: { capability: 'mutable' as const, commitment: '' },
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
      for (const emitInfo of emitInfos) {
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
            nft: { capability: 'mutable' as const, commitment: '' },
          },
        });
      }

      // Run VM debug and extract commitments
      const transaction = probeBuilder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(
        probeBuilder.inputs,
      );
      const fullTrace = vm.debug({
        inputIndex: 0,
        sourceOutputs,
        transaction,
      }) as AuthenticationProgramStateCommon[];

      // Extract state commitments with output-index range filtering
      const stateOutputRange = {
        min: 1, max: 1 + requiredIndices.length,
      };
      const newStateCommitments = extractCommitmentsFromTrace(
        fullTrace, requiredIndices.length, stateOutputRange,
      );
      if (
        !newStateCommitments
        || newStateCommitments.length < requiredIndices.length
      ) {
        throw new Error(
          'Failed to derive initial state commitments from '
          + 'constructor. Ensure the constructor writes all '
          + 'state variables.',
        );
      }

      // Extract entry commitments
      entryCommits = [];
      if (entryCount > 0) {
        const entryOutputBase = 1 + stateLayout.dataNftCount;
        const entryOutputRange = {
          min: entryOutputBase,
          max: entryOutputBase + entryCount,
        };
        entryCommits = extractCommitmentsFromTrace(
          fullTrace, entryCount, entryOutputRange,
        ) ?? [];
      }

      // Extract event commitments
      eventCommits = [];
      if (emitCount > 0) {
        const eventBase = 1 + stateLayout.dataNftCount + entryCount
          + transferCount;
        const eventOutputRange = {
          min: eventBase, max: eventBase + emitCount,
        };
        eventCommits = extractCommitmentsFromTrace(
          fullTrace, emitCount, eventOutputRange,
        ) ?? [];
      }

      // Extract transfer outputs
      transferOuts = [];
      if (transferCount > 0) {
        const tBase = 1 + stateLayout.dataNftCount + entryCount;
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

      stateCommitments = newStateCommitments;

      // Check convergence: did commitments change from previous iter?
      const currentStateCommitments = stateCommitments;
      const converged = requiredIndices.every(
        (idx) => currentCommitments[idx] === currentStateCommitments[
          requiredIndices.indexOf(idx)
        ],
      );
      if (converged) break;

      // Oscillation detection: if we've seen this exact commitment set before,
      // the derivation is cycling without converging.
      const deployKey = stateCommitments.join('|') + '||' + entryCommits.join('|')
        + '||' + eventCommits.join('|');
      if (seenDeployKeys.has(deployKey)) {
        throw new Error(
          'Deploy derivation oscillation detected: commitment state is cycling without converging. '
          + 'This may indicate conflicting covenant constraints in the constructor.',
        );
      }
      seenDeployKeys.add(deployKey);

      // Update current commitments for next iteration
      for (let j = 0; j < requiredIndices.length; j++) {
        currentCommitments[requiredIndices[j]] = stateCommitments[j];
      }
    }

    return {
      stateCommitments,
      entryCommitments: entryCommits,
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
    return this.inner.address;
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

  async getState(): Promise<Record<string, StateValueType>> {
    const onChainState = await getContractState(this.inner, this.categoryId);
    return onChainState.state as Record<string, StateValueType>;
  }

  async getFullState(): Promise<OnChainState> {
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

    const effectiveKeyTypes = collection.keyTypes ?? [collection.keyType];
    const isMultiKey = effectiveKeyTypes.length > 1;
    const structs = stateLayout.structs;

    const entries: Array<{
      key?: bigint | boolean | Uint8Array;
      keys?: Array<bigint | boolean | Uint8Array>;
      value: StateValue;
    }> = [];

    for (const utxo of entryUtxos) {
      try {
        if (isMultiKey) {
          const parsed = parseEntryCommitmentMultiKey(
            utxo.token!.nft!.commitment, effectiveKeyTypes, collection.valueType, structs,
          );
          entries.push({ keys: parsed.keys, value: parsed.value });
        } else {
          const parsed = parseEntryCommitment(
            utxo.token!.nft!.commitment, collection.keyType, collection.valueType, structs,
          );
          entries.push({ key: parsed.key, value: parsed.value });
        }
      } catch (e) {
        // Commitment doesn't parse for this collection - skip, but log for debugging
        console.warn('Warning: failed to parse entry commitment for UTXO', utxo.txid ?? 'unknown', e);
      }
    }

    return entries;
  }

  private async _deriveCommitments(
    functionName: string,
    args: any[],
    requiredNftIndices: readonly number[],
    extraOutputs?: Array<{ to: string | Uint8Array; amount: bigint; token?: any }>,
    extraInputs?: Array<{ utxo: Utxo; unlocker: Unlocker }>,
    entryOutputCount: number = 0,
    childDataNftCount: number = 0,
  ): Promise<{
      state: Record<string, StateValueType> | undefined;
      entryCommitments: string[];
      childCommitments: string[];
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

      // blockhash(n): resolve each reader's (n->hash) co-spend so the probe's VM run can read input[param]
      // (the masterUnlocker late-resolves the index from the probe's own sourceOutputs). Placed right after
      // the data NFTs, matching the blockhashOracle block-layout slot.
      const bhProbeCoSpends: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; locktime: number }> = [];
      if (abiFunction.blockhashReads && abiFunction.blockhashReads.length > 0) {
        const bhCategory = this.inner.artifact.compiler.options?.blockhashOracleCategory;
        if (bhCategory) {
          const bhVisible = abiFunction.inputs.filter((i) => !i.name.startsWith('__internal__'));
          const bhSeen = new Set<string>();
          for (const paramName of abiFunction.blockhashReads) {
            const pIdx = bhVisible.findIndex((i) => i.name === paramName);
            if (pIdx < 0) continue;
            const bn = args[pIdx];
            if (typeof bn !== 'bigint' || bhSeen.has(String(bn))) continue;
            bhSeen.add(String(bn));
            const cs = await resolveBlockhashCoSpend(this.inner.provider, bhCategory, bn);
            if (cs) {
              bhProbeCoSpends.push({
                utxo: cs.utxo, unlocker: cs.unlocker, recreate: cs.recreateOutput, locktime: cs.locktime,
              });
            }
          }
        }
      }

      // Wrap the VM probe + extraction in AutoDerivationError so failures are
      // cleanly distinguishable from programming bugs or configuration errors.
      try {
        const { CovenantTransactionBuilder } = await import('./CovenantTransactionBuilder.js');
        const vm = createVirtualMachineBch2026();

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

          // Add extra outputs (entry NFTs and child contract outputs)
          if (extraOutputs) {
            for (const output of extraOutputs) {
              probeBuilder.addOutput(output);
            }
          }

          const transaction = probeBuilder.buildLibauthTransaction();
          const sourceOutputs = generateLibauthSourceOutputs(probeBuilder.inputs);
          return vm.debug({ inputIndex: 0, sourceOutputs, transaction }) as AuthenticationProgramStateCommon[];
        };

        // Pass 1: derive data NFT state. Placeholder outputs fail the data NFT verify, but
        // the trace captures the expected values before the failing OP_EQUALVERIFY.
        const fullTrace = runProbe();
        const stateOutputRange = { min: 1, max: 1 + requiredNftIndices.length };
        const commitmentHexes = extractCommitmentsFromTrace(fullTrace, requiredNftIndices.length, stateOutputRange);

        // Pass 2: entry verifies run after the data NFT verify, so re-run with derived data
        // NFT commitments to get past it and reach the entry verifies.
        let entryCommitments: string[] = [];
        if (entryOutputCount > 0) {
          const entryBase = 1 + requiredNftIndices.length;
          const entryTrace = commitmentHexes ? runProbe(commitmentHexes) : fullTrace;
          entryCommitments = extractCommitmentsFromTrace(
            entryTrace, entryOutputCount, { min: entryBase, max: entryBase + entryOutputCount },
          ) ?? [];
        }

        // Deploy-fold: the deploy covenant verifies the child's genesis at outputs after the factory
        // state and entries. When a freshly-deployed local was configured in the same tx, that genesis
        // is the child's post-call state, computed on-chain by the covenant. Re-run with the derived
        // factory state so the trace reaches the child genesis verify, then read the expected commitment
        // (captured before the verify) for each child data NFT. Falls back to the static initial state
        // for a plain deploy that lands at default. Note: a deploy function that writes mapping entries
        // would abort at the entry verify before reaching the child verify (folded deploy + entries
        // unsupported for now).
        let childCommitments: string[] = [];
        if (childDataNftCount > 0 && commitmentHexes && extraOutputs) {
          const extraBase = 1 + requiredNftIndices.length + bhProbeCoSpends.length;
          const childBase = extraBase + entryOutputCount + 1; // skip entry outputs + the child master NFT
          const childOutStart = entryOutputCount + 1; // child data NFT 0's index within extraOutputs
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
          return { state: currentState, entryCommitments, childCommitments };
        }

        return {
          state: commitmentsToState(commitmentHexes, stateLayout, [...requiredNftIndices]),
          entryCommitments,
          childCommitments,
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

          // Run VM on B's master input
          const vm = createVirtualMachineBch2026();
          const fullTrace = vm.debug({
            inputIndex: bMasterIdx,
            sourceOutputs,
            transaction,
          }) as AuthenticationProgramStateCommon[];

          // B verifies its data NFT commitments, then (if return values) the return event commitment
          const bRequiredNftCount = group.requiredDataNftIndices.length;
          const totalExpected = bRequiredNftCount + (ec.hasReturnValues ? 1 : 0);

          // Filter by output index range: B's data NFTs start after B's master output
          const bOutputBase = stb.getExternalCallOutputBase(groupIdx);
          const bDataOutputRange = { min: bOutputBase + 1, max: bOutputBase + 1 + totalExpected };
          const commitments = extractCommitmentsFromTrace(fullTrace, totalExpected, bDataOutputRange);
          if (!commitments) continue; // No commitment patterns found - skip

          // B's data NFT commitments
          const bCommitments = commitments.slice(0, bRequiredNftCount);
          const bState = commitmentsToState(bCommitments, group.stateLayout, group.requiredDataNftIndices);
          for (const [name, value] of Object.entries(bState)) {
            stb.setExternalCallState(group.categoryId, name, value);
          }

          // Return event blob (if B has return values)
          if (ec.hasReturnValues && commitments.length > bRequiredNftCount) {
            const returnBlob = commitments[bRequiredNftCount];
            stb.setReturnEventOutput(group.categoryId, hexToBin(returnBlob));
          }

          // If the return event commitment was not extracted in the first probe,
          // re-run B's VM now that data NFT commitments are set. The first probe's
          // VM stopped at the first mismatching OP_EQUALVERIFY (data NFT), so the
          // return event verification was never reached. With correct data NFT outputs,
          // the VM proceeds past those checks and reaches the return event verification.
          if (ec.hasReturnValues && commitments.length <= bRequiredNftCount) {
            const probeBuilderRet = stb.build();
            const transactionRet = probeBuilderRet.buildLibauthTransaction();
            const sourceOutputsRet = generateLibauthSourceOutputs(probeBuilderRet.inputs);
            const vmRet = createVirtualMachineBch2026();
            const fullTraceRet = vmRet.debug({
              inputIndex: bMasterIdx,
              sourceOutputs: sourceOutputsRet,
              transaction: transactionRet,
            }) as AuthenticationProgramStateCommon[];

            // Use a range covering all return event outputs. Each group's script only
            // verifies its own return event, so the trace will only contain one match
            // within this range. The range must cover all return events because in
            // chained calls (A->B->C), different groups' return events have different
            // output indices within the return event section.
            const returnEventOutputBase = stb.getReturnEventOutputBase();
            const totalReturnEvents = externalCalls.filter((e) => e.hasReturnValues).length;
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
                const vm2 = createVirtualMachineBch2026();
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
            const vm = createVirtualMachineBch2026();
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
            const vm = createVirtualMachineBch2026();
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
        const maxIterations = this.maxDerivationIterations;
        let lastTrace: AuthenticationProgramStateCommon[] | undefined;
        const seenConvergenceKeys = new Set<string>();

        for (let iter = 0; iter < maxIterations; iter++) {
          const probeBuilder2 = stb.build();
          const transaction2 = probeBuilder2.buildLibauthTransaction();
          const sourceOutputs2 = generateLibauthSourceOutputs(probeBuilder2.inputs);

          const vm2 = createVirtualMachineBch2026();
          const fullTrace2 = vm2.debug({
            inputIndex: delegatecallInputIndex ?? 0,
            sourceOutputs: sourceOutputs2,
            transaction: transaction2,
          }) as AuthenticationProgramStateCommon[];
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

          // Entry commitments: output indices [entryBase, entryBase + entryCount)
          if (entryCount > 0) {
            const entryOutputBase = stb.getEntryOutputBase();
            const entryOutputRange = { min: entryOutputBase, max: entryOutputBase + entryCount };
            const entryCommits = extractCommitmentsFromTrace(fullTrace2, entryCount, entryOutputRange) ?? [];
            commitmentProgress += entryCommits.length;
            latestEntryCommits = entryCommits;
            for (let si = 0; si < Math.min(entryCount, entryCommits.length); si++) {
              stb.setEntryRawCommitment(si, entryCommits[si]);
            }
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
                const range = { min: chunkOffset, max: chunkOffset + nNew };
                const chunkCommits = extractCommitmentsFromTrace(fullTrace2, nNew, range) ?? [];
                if (chunkCommits.length > 0) {
                  const cur = stb.getChunkRawCommitments(dv.name);
                  stb.setChunkRawCommitments(dv.name,
                    Array.from({ length: nNew }, (_, i) => chunkCommits[i] ?? cur[i] ?? '00'));
                  commitmentProgress += chunkCommits.length;
                }
              }
              chunkOffset += nNew;
            }
          }

          // Event commitments: output indices [eventBase, eventBase + eventCount)
          if (eventCount > 0) {
            const eventOutputBase = stb.getEventOutputBase();
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

          // Check convergence using content fingerprint (not just count)
          // to detect when derived values change without the count increasing.
          const convergenceKey = computeConvergenceKey(
            commitmentProgress, derivedTransfers, derivedFtTransfers, derivedNftTransfers,
            stateCommits, latestEntryCommits, latestEventCommits,
          );
          if (convergenceKey === prevConvergenceKey) break;
          if (seenConvergenceKeys.has(convergenceKey)) {
            throw new AutoDerivationError(
              'Auto-derivation oscillation detected: derivation state is cycling without converging. '
            + 'This may indicate conflicting covenant constraints.',
            );
          }
          seenConvergenceKeys.add(convergenceKey);
          prevConvergenceKey = convergenceKey;
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
    },
  ): Promise<StatefulTransactionBuilder> {
    const stateLayout = this.inner.stateLayout!;

    // Move ABI lookup FIRST so we can determine if full state is needed
    const abiFunction = this.inner.artifact.abi.find((f) => f.name === functionName);
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
    let finalArgs = args;
    // B8 return-value emit: -1 means "do not emit" (default). With .emitReturn(), point the covenant's
    // __internal__returnOutputIdx at the function's returnEvent output slot (a fixed block-layout offset).
    let returnEmitOutputIndex = -1;
    if (overrides?.emitReturn && (abiFunction?.outputs?.length ?? 0) > 0) {
      const slot = abiFunction?.blockLayout?.slots.find((s) => s.kind === 'returnEvent');
      if (!slot) {
        throw new Error(`Function '${functionName}' has no returnEvent output slot; cannot emit its return value.`);
      }
      returnEmitOutputIndex = slot.offset;
    }
    if (abiFunction?.usesMsgSender) {
      const msgSenderCategory = overrides?.msgSenderCategory ?? new Uint8Array(32);
      finalArgs = [...finalArgs, msgSenderCategory];
    }
    // __internal__blockhashInputIndex: the (n->hash) co-spend's absolute input index = master(0) + the slot
    // offset (the SymbolTable injects this param right after msgSender, so it is pushed here in order).
    const bhSlot = abiFunction?.blockLayout?.slots.find((s) => s.kind === 'blockhashOracle');
    if (bhSlot) {
      finalArgs = [...finalArgs, BigInt(bhSlot.offset)];
    }

    // Handle entry NFT accesses
    const entryAccesses = abiFunction?.entryAccesses;
    let entryNfts: EntryNftInfo[] = [];

    if (entryAccesses && entryAccesses.length > 0 && stateLayout.collections) {
      const entryNftUtxos = onChainState.entryNftUtxos;

      for (let slotIndex = 0; slotIndex < entryAccesses.length; slotIndex++) {
        const access = entryAccesses[slotIndex];
        const collection = stateLayout.collections.find((c) => c.name === access.collection);
        if (!collection) {
          throw new Error(`Unknown collection: ${access.collection}`);
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
            const keyParamIndex = abiFunction!.inputs.findIndex((inp) => inp.name === keySource.paramName);
            if (keyParamIndex < 0) {
              throw new Error(`Key parameter '${keySource.paramName}' not found in function inputs`);
            }
            keyValues.push(args[keyParamIndex] as bigint | boolean | Uint8Array);
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
          } else {
            // Expression: look in user-provided entryKeyOverrides, or compute from
            // paramDerivation metadata, or fall back to placeholder.
            const entryKeyOverrides = overrides?.entryKeyOverrides;
            const override = entryKeyOverrides?.get(slotIndex);
            if (override !== undefined) {
              keyValues.push(override);
            } else {
              // Fallback: type-appropriate placeholder. Auto-derivation will capture
              // the correct commitment from the VM trace.
              isExpressionKeyPlaceholder = true;
              const keyType = effectiveKeyTypes[ki];
              const bytesMatch = keyType.match(/^bytes(\d+)$/);
              if (bytesMatch) {
                keyValues.push(new Uint8Array(parseInt(bytesMatch[1], 10)));
              } else if (keyType === 'bytes') {
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
        let matchingUtxo: typeof entryNftUtxos[0] | undefined;
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
          for (const utxo of entryNftUtxos) {
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
          for (const utxo of entryNftUtxos) {
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
        const entryUnlocker = createEntryNftUnlocker(this.inner, 0, this.categoryId, access.collection);

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

    }

    // Determine which entry slots the compiler expects to be deleted (no output)
    const entryDeleteSlots = new Set<number>();
    if (entryAccesses) {
      for (let i = 0; i < entryAccesses.length; i++) {
        if (entryAccesses[i].operations.includes('delete')) {
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

        // Add as read-only inputs
        for (const utxo of entryUtxos) {
          const unlocker = createReadOnlyEntryNftUnlocker(this.inner, this.categoryId, coll.name);
          iterationEntryInputs.push({ ...utxo, unlocker });
        }

        // Append _collectionIterCount_<N> argument
        finalArgs = [...finalArgs, BigInt(entryUtxos.length)];
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
          const unlocker = createReadOnlyDynamicChunkUnlocker(this.inner, 0, this.categoryId, dynVar.name, dynVar.type);
          iterationEntryInputs.push({ ...utxo, unlocker });
        }
      }
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

    // blockhash(n): resolve each reader's (n->hash) oracle co-spend (matched by n from the call args). The
    // builder places it at the blockhashOracle block-layout slot; the index param is filled below.
    const blockhashCoSpendUtxos: UnlockableUtxo[] = [];
    let maxBhLocktime = 0; // require(tx.time >= n) - the SDK sets the locktime so the derivation probe passes
    if (abiFunction?.blockhashReads && abiFunction.blockhashReads.length > 0) {
      const bhCategory = this.inner.artifact.compiler.options?.blockhashOracleCategory;
      if (!bhCategory) throw new Error('blockhash(n): contract compiled without blockhashOracleCategory');
      const bhVisible = abiFunction.inputs.filter((i) => !i.name.startsWith('__internal__'));
      const bhSeen = new Set<string>();
      for (const paramName of abiFunction.blockhashReads) {
        const pIdx = bhVisible.findIndex((i) => i.name === paramName);
        if (pIdx < 0) continue;
        const bn = args[pIdx];
        if (typeof bn !== 'bigint' || bhSeen.has(String(bn))) continue;
        bhSeen.add(String(bn));
        const cospend = await resolveBlockhashCoSpend(this.inner.provider, bhCategory, bn);
        if (!cospend) throw new Error(`blockhash(${bn}): no (n->hash) oracle UTXO at addr(${bn})`);
        blockhashCoSpendUtxos.push({ ...cospend.utxo, unlocker: cospend.unlocker });
        if (cospend.locktime > maxBhLocktime) maxBhLocktime = cospend.locktime;
      }
    }

    // Pre-declare outState variables (populated later, but needed for base computations in external calls)
    let externalOutStateUtxoGroups: ExternalCallUtxoGroup[] = [];
    let outStateInputCount = 0;

    // Handle external function calls (cross-contract calls via interfaces)
    let externalCalls = abiFunction?.externalCalls;
    // Expand an array-element external call `IFoo(arr[i]).m()` into one concrete call per registered callee
    // instance (co-spent in array order; the covenant verifies each against the on-chain arr[i]).
    let presetResolved: (ExternalCallInfo | undefined)[] | undefined;
    if (externalCalls?.some((ec) => ec.loopArrayVar)) {
      const expanded: ExternalCallAbi[] = [];
      presetResolved = [];
      for (const ec of externalCalls) {
        if (ec.loopArrayVar) {
          const list = this.inner.getExternalTargetInstancesByInterface(ec.interfaceName) as ConnectedStatefulContract[];
          const resolvedArgs = this._resolveExternalArgs(ec.argSources, args, this.inner.artifact) ?? [];
          for (const inst of list) {
            expanded.push({ ...ec, loopArrayVar: undefined });
            presetResolved.push({
              externalContract: inst as unknown as StatefulContract, functionName: ec.functionName, args: resolvedArgs,
            });
          }
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
          const fullBlockKinds = new Set(['entry', 'satoshiContainer', 'tokenContainer', 'transfer', 'tcTransfer', 'event']);
          if (!bLayout.slots.some((s) => fullBlockKinds.has(s.kind))) continue;
          for (const s of bLayout.slots) {
            if (['transfer', 'tcTransfer', 'event'].includes(s.kind)) totalBFunders++;
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
        const bAbiFunc = bSc
          ? (bSc.inner.artifact.abi as readonly AbiFunction[])
            .find((f) => f.name === callInfo.functionName)
          : undefined;
        const bBlockLayout = bAbiFunc?.blockLayout;
        let bBlockInputs: UnlockableUtxo[] | undefined;

        if (bBlockLayout) {
          // Check for slots that need full block treatment (entries, TC, SC, events, transfers)
          // Exclude returnEvent - it's already handled by the return event infrastructure
          const fullBlockKinds = new Set(['entry', 'satoshiContainer', 'tokenContainer', 'transfer', 'tcTransfer', 'event']);
          const hasExtraSlots = bBlockLayout.slots.some(
            (s) => fullBlockKinds.has(s.kind),
          );
          if (hasExtraSlots && bSc) {
            // Build B's full block following blockLayout slot order.
            // Fetch B's real UTXOs for entries/TC/SC where they exist on-chain;
            // use funder inputs for output-only slots and non-existing entries/TCs.
            bBlockInputs = [];
            let bDataIdx = 0;
            // Create proper unlocker for B's master (not just a type cast)
            const bMasterUnlocker = (callInfo.externalContract.inner.unlock as any)[callInfo.functionName]
              ? (callInfo.externalContract.inner.unlock as any)[callInfo.functionName](...(callInfo.args ?? []))
              : undefined;
            const bMasterUnlockable: UnlockableUtxo = {
              ...bState.masterUtxo!,
              ...(bMasterUnlocker && { unlocker: bMasterUnlocker }),
            };

            // Helper: create a funder input. Uses signer UTXOs when available, OP_TRUE dummies otherwise.
            let bFunderIdx = 0;
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
              // Mocknet fallback: P2SH32-wrapped OP_TRUE dummy registered with provider
              const dummyTxid = '00'.repeat(30) + (0xb0 + (bFunderIdx++)).toString(16).padStart(4, '0');
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
                case 'returnEvent':
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
                    const rawKeyValue = keyParamIdx >= 0 ? callInfo.args[keyParamIdx] : undefined;
                    // Convert FunctionArgument to primitive for key matching
                    const keyValue = rawKeyValue instanceof Uint8Array || typeof rawKeyValue === 'bigint'
                      || typeof rawKeyValue === 'boolean' ? rawKeyValue : undefined;
                    let matchUtxo: Utxo | undefined;
                    if (keyValue !== undefined && bCollection) {
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
                    const bTcKeyIdx = callInfo.args.findIndex(
                      (_: unknown, i: number) => bAbiFunc?.inputs[i]?.name === bTcAccess.keyParam,
                    );
                    const bTcCatValue = bTcKeyIdx >= 0 ? callInfo.args[bTcKeyIdx] : undefined;
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
          ...(ec.callMode && { callMode: ec.callMode }),
          ...(bBlockInputs && { blockInputs: bBlockInputs, blockLayout: bBlockLayout }),
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
      if (iterationEntryInputs.length > 0) externalCallInputBase += iterationEntryInputs.length;
      finalArgs = [...finalArgs, BigInt(externalCallInputBase)];

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

        const entryOutputCount = entryNfts.filter(
          (e) => (!e.exists || e.utxo) && !entryDeleteSlots.has(e.slotIndex),
        ).length;
        const transferCount = abiFunction?.transferCount ?? 0;
        const satoshiContainerOutputCount = transferCount > 0 ? 1 : 0;
        const tokenContainerTransferCount = abiFunction?.tokenContainerAccesses
          ? abiFunction.tokenContainerAccesses.reduce((count, a) => {
            const transferOps = a.operations.filter((op) => op === 'transfer' || op === 'transferNft');
            return count + transferOps.length;
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
      }

      // Build return-event-index map: groupIndex -> return event output index
      const returnEventIndexMap = new Map<number, number>();
      for (let i = 0; i < allReturningGroupIndices.length; i++) {
        returnEventIndexMap.set(allReturningGroupIndices[i], returnEventOutputBase + i);
      }

      // Fix data NFT unlockers and create master unlockers with correct hidden params.
      // Uses ABI-driven param resolution: scans each group's ABI inputs for hidden param names
      // and computes values based on the param name and transaction layout.
      let currentInputBase = externalCallInputBase;
      for (let groupIdx = 0; groupIdx < externalCallUtxoGroups.length; groupIdx++) {
        const group = externalCallUtxoGroups[groupIdx];
        const meta = groupMetas[groupIdx];
        const masterInputIndex = currentInputBase;

        // Re-create data NFT unlockers with correct master input index
        group.dataNftUtxos = group.dataNftUtxos.map((nftUtxo) => ({
          ...nftUtxo,
          unlocker: createDataNftUnlocker(
            group.externalContract.inner, masterInputIndex, group.categoryId,
          ),
        }));

        // Build hidden args by scanning the function's ABI inputs for hidden param names
        type AbiEntry = { name: string; inputs: readonly { name: string }[]; externalCalls?: readonly ExternalCallAbi[] };
        const bAbiAll = group.externalContract.inner.artifact.abi as readonly AbiEntry[];
        const bAbiFunc = bAbiAll.find((f) => f.name === group.functionName);
        const bAbiInputs = bAbiFunc?.inputs ?? [];
        const userArgCount = group.functionArgs.length;

        let bFinalArgs = [...group.functionArgs];
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

          if (paramName === '__internal__externalCallInputBase') {
            // Where this function's external call groups start in the input sequence
            const thisGroupEnd = currentInputBase + 1 + group.dataNftUtxos.length;
            bFinalArgs.push(BigInt(thisGroupEnd));
          } else if (paramName === '__internal__msgSenderCategory') {
            bFinalArgs.push(hexToBin(meta.callerCategoryId));
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
        const bMasterUnlocker = (group.externalContract.inner.unlock as any)[group.functionName](
          ...bFinalArgs,
        );
        group.masterUtxo = { ...group.masterUtxo, unlocker: bMasterUnlocker } as UnlockableUtxo;

        // Advance to next group
        currentInputBase += 1 + group.dataNftUtxos.length;
      }

      // Resolve 4-byte hash selector from B's ABI - only for A's DIRECT external calls.
      // Transitive call selectors are handled above as part of B's hidden params.
      const selectorParamCount = abiFunction!.inputs.filter(
        (inp: { name: string }) => inp.name.startsWith('__internal__externalCallSelector'),
      ).length;
      if (selectorParamCount > 0) {
        for (let i = 0; i < directGroupCount; i++) {
          const group = externalCallUtxoGroups[i];
          // call/staticcall/delegatecall modes don't inject selector params - skip them
          if (group.callMode === 'call' || group.callMode === 'staticcall' || group.callMode === 'delegatecall') continue;
          const bAbi = group.externalContract.inner.artifact.abi as readonly { name: string; selector?: string }[];
          const targetFunc = bAbi.find((f) => f.name === group.functionName);
          if (!targetFunc) {
            throw new Error(
              `Function '${group.functionName}' not found in external contract ABI`,
            );
          }
          if (!targetFunc.selector) {
            throw new Error(
              `Function '${group.functionName}' has no selector in external contract ABI`,
            );
          }
          finalArgs = [...finalArgs, hexToBin(targetFunc.selector)];
        }
      }

      // Append per-slot _externalReturnOutputIdx params for A's args (direct returning calls only)
      const directReturningSlots = externalCalls.filter((ec) => ec.hasReturnValues);
      if (directReturningSlots.length > 0 && returnEventOutputBase >= 0) {
        for (let i = 0; i < directGroupCount; i++) {
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

        externalOutStateUtxoGroups.push({
          categoryId: externalCategoryId,
          stateLayout: bStateLayout,
          masterUtxo: bState.masterUtxo,
          dataNftUtxos: bDataNfts,
          requiredDataNftIndices: bRequiredNftIndices,
          functionName: callInfo.functionName,
          functionArgs: callInfo.args,
          externalContract: callInfo.externalContract,
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
          bFinalArgs = [...bFinalArgs, hexToBin(this.categoryId)];
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
          const bState = await callInfo.contract.getFullState();
          const bStateLayout = callInfo.contract.inner.stateLayout!;
          const bCategoryId = callInfo.contract.categoryId;

          if (!bState.masterUtxo) {
            throw new Error(
              `Low-level call target master UTXO not found (category ${bCategoryId})`,
            );
          }

          // Include all data NFTs
          const bRequiredNftIndices = Array.from(
            { length: bStateLayout.dataNftCount }, (_, idx) => idx,
          );
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
      let lowLevelCallInputBase = 1 + requiredNftIndices.length
        + externalReadUtxos.length + outStateInputCount + externalCallInputCount;

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
          const bVisibleInputs = bFunc.inputs.filter((inp) => !inp.name.startsWith('__internal__'));
          const encodedArgs: any[] = bVisibleInputs.map((inp, idx) => {
            const arg = group.functionArgs[idx];
            return arg;
          });

          // Inject _proxyMasterIndex for delegate functions.
          // Defaults to 0 (proxy master is the first input in the STB), but can be
          // overridden via withDelegatecall(..., proxyMasterIndex) for composability.
          if (bFunc.inputs.some((inp) => inp.name === '__internal__proxyMasterIndex')) {
            encodedArgs.push(BigInt(groupProxyMasterIndices[groupLocalIdx] ?? 0));
          }

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
    // Contract.ts registers fallback/receive unlockers as 'fallback'/'receive',
    // but ABI names are '__fallback'/'__receive'.
    const unlockName = functionName === '__fallback' ? 'fallback'
      : functionName === '__receive' ? 'receive' : functionName;
    const masterUnlocker = (this.inner.unlock as any)[unlockName](...finalArgs);
    const dataNftUnlockers = filteredDataNftUtxos.map(
      () => createDataNftUnlocker(this.inner, 0, this.categoryId),
    );

    const unlockableMaster = {
      ...masterUtxo,
      unlocker: masterUnlocker,
    };

    const unlockableDataNfts = filteredDataNftUtxos.map((nftUtxo, i) => ({
      ...nftUtxo,
      unlocker: dataNftUnlockers[i],
    }));

    // Compute event definitions and locking bytecodes for functions that emit events
    const emitInfos = abiFunction?.emits ?? [];
    const eventDefs = this.inner.artifact.events ?? [];
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
    const dynamicWrites = abiFunction?.dynamicWrites ?? [];
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
        const unlocker = createDynamicChunkUnlocker(this.inner, 0, this.categoryId, v.name, v.type);
        dynamicChunkInputs.push({ ...utxo, unlocker });
      }
    }

    const builder = new StatefulTransactionBuilder({
      provider: this.inner.provider,
      maximumFeeSatoshis: 50000n,
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
      tokenContainers,
      tokenContainerLockingBytecodes,
      ...(satoshiContainerUtxo && { satoshiContainerUtxo, satoshiContainerLockingBytecode }),
      ...(externalReadUtxos.length > 0 && { readOnlyDataNftUtxos: externalReadUtxos }),
      ...(blockhashCoSpendUtxos.length > 0 && { blockhashCoSpendUtxos }),
      ...(externalOutStateUtxoGroups.length > 0 && { externalOutStateUtxoGroups }),
      ...(externalCallUtxoGroups.length > 0 && { externalCallUtxoGroups }),
      ...(lowLevelCallUtxoGroups.length > 0 && { lowLevelCallUtxoGroups }),
      ...(lowLevelCallRawInputs.length > 0 && { lowLevelCallRawInputs }),
      ...(eventDefs.length > 0 && { eventDefinitions: eventDefs }),
      ...(eventNftLockingBytecodes.size > 0 && { eventNftLockingBytecodes }),
      ...(iterationEntryInputs.length > 0 && { iterationEntryInputs }),
      ...(abiFunction?.blockLayout && { blockLayout: abiFunction.blockLayout }),
    });

    // blockhash(n) requires tx.time >= n; set it so the derivation probe (and the final tx) satisfy the CLTV.
    if (maxBhLocktime > 0) builder.setLocktime(maxBhLocktime);

    // Auto-fund block-layout slots that need funder inputs (output-only slots
    // like transfers/events, non-existing entries/TCs). These are WITHIN the
    // block range - the covenant requires them at specific positions.
    // The fee funder is NOT created here; STB.send() handles it via the
    // "build then fund" approach (measure covenant tx size -> create fee input).
    if (abiFunction?.blockLayout && builder.funderUtxos.length === 0) {
      const outputOnlyKinds = new Set(['transfer', 'tcTransfer', 'event', 'returnEvent', 'lowLevelCall', 'deploy']);
      const entryInfos = builder.getEntryNftInfos();
      const tcInfos = builder.getTokenContainerInfos();
      let neededFunders = abiFunction.blockLayout.slots.filter(
        (s) => outputOnlyKinds.has(s.kind),
      ).length;
      neededFunders += abiFunction.blockLayout.slots.filter(
        (s) => s.kind === 'entry' && !entryInfos.some((e) => e.slotIndex === s.slotIndex && e.exists),
      ).length;
      neededFunders += abiFunction.blockLayout.slots.filter(
        (s) => s.kind === 'tokenContainer' && !tcInfos.some((c) => c.tokenContainerSlotIndex === s.slotIndex && c.exists),
      ).length;

      if (neededFunders > 0) {
        if (this._signer) {
          const signerUtxos = await this._signer.getUtxos();
          const consumedTxids = new Set(
            (sharedFunderPool ?? []).map((f) => `${f.txid}:${f.vout}`),
          );
          const plainUtxos = signerUtxos.filter(
            (u) => !u.token && !consumedTxids.has(`${u.txid}:${u.vout}`),
          );
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
            const dummy: Utxo = {
              txid: '00'.repeat(31) + (0xf0 + i).toString(16), vout: 0, satoshis: 3000n,
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

    // Detect delegatecall group for auto-derivation: Phase 2 runs on the delegate's input
    // instead of input 0 (proxy's master), because the delegate function is what verifies
    // the proxy's state commitments.
    let delegatecallInputIndex: number | undefined;
    if (lowLevelCallUtxoGroups.length > 0) {
      for (let i = 0; i < lowLevelCallUtxoGroups.length; i++) {
        if (lowLevelCallUtxoGroups[i].callMode === 'delegatecall') {
          delegatecallInputIndex = builder.getLowLevelCallMasterInputIndex(i);
          break;
        }
      }
    }

    // Co-spend the external-library side-car if this function uses a library, or calls an external
    // contract whose function does. One side-car serves every loader in the tx (the loader reads the last
    // input and verifies the blob by hash). Set before derivation so the probes include it.
    // First non-inline library used (inline libraries are baked into the contract; no side-car).
    const firstSidecarLib = (art: any, names: readonly string[]): ExternalLibraryAbi | undefined => {
      for (const name of names) {
        const d: ExternalLibraryAbi | undefined = art?.externalLibraries?.find((l: any) => l.name === name);
        if (d && !d.inline) return d;
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

    // B8 emit: reserve a placeholder return-event output so the covenant's OP_OUTPUTTOKENCOMMITMENT at
    // the return slot has an output to read during derivation; the real commitment is derived below.
    if (returnEmitOutputIndex >= 0) {
      builder.setReturnEventOutput(this.categoryId, new Uint8Array([0]));
    }

    // Check if there is nothing to derive for this function (e.g., split/merge/unsafe tiers)
    const hasNothingToDerive = requiredNftIndices.length === 0
      && (abiFunction?.entryAccesses?.length ?? 0) === 0
      && emitInfos.length === 0
      && derivTransferCount === 0;

    if (hasNothingToDerive) {
      // Nothing to derive - set empty state so _applyOverrides doesn't throw
      (builder as any).__derivedState = {};
      (builder as any).__vmErrored = false;
    } else {
      // Try to auto-derive commitments via STB-based probe.
      // Uses _deriveFullTransactionState for all paths - the STB probe includes external read
      // inputs, generates valid signatures (enabling sig-arg auto-derivation), and handles
      // cross-contract calls. Phase 1 derives B's state for each external call group;
      // Phase 2 derives A's state + entries + events + transfers.
      const entryAccessesForDerive = abiFunction?.entryAccesses;
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
      const blob = this._deriveReturnBlob(builder, returnEmitOutputIndex);
      if (!blob) {
        throw new Error(
          `Could not derive the return value of '${functionName}' for .emitReturn(). `
          + 'Functions that write state and return a value are not yet supported with emit.',
        );
      }
      builder.setReturnEventOutput(this.categoryId, blob);
    }

    return builder;
  }

  // B8 emit: run one VM probe and extract the encoded return blob from the return-event verification
  // (OP_OUTPUTTOKENCOMMITMENT == __returnBlob), the same trace-extraction used for external-call returns.
  private _deriveReturnBlob(
    builder: StatefulTransactionBuilder, returnOutputIndex: number,
  ): Uint8Array | undefined {
    const probe = builder.build();
    const transaction = probe.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(probe.inputs);
    const vm = createVirtualMachineBch2026();
    const trace = vm.debug({ inputIndex: 0, sourceOutputs, transaction }) as AuthenticationProgramStateCommon[];
    const commitments = extractCommitmentsFromTrace(trace, 1, {
      min: returnOutputIndex, max: returnOutputIndex + 1,
    });
    return commitments && commitments.length > 0 ? hexToBin(commitments[0]) : undefined;
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
    if (!argSources || argSources.length === 0) return undefined;

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
    const { decodeTransactionUnsafe, hash256, hexToBin: localHexToBin } = await import('@bitauth/libauth');
    const rawTx = builder.build();
    const txid = await provider.sendRawTransaction(rawTx);

    // Verify txid matches locally computed hash to detect compromised providers
    const rawTxBin = localHexToBin(rawTx);
    const expectedTxid = binToHex(hash256(rawTxBin).reverse());
    if (txid !== expectedTxid) {
      throw new Error(
        `Txid mismatch: provider returned '${txid}', expected '${expectedTxid}'. `
        + 'The network provider may be compromised.',
      );
    }

    const decoded = decodeTransactionUnsafe(rawTxBin);
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
    const { decodeTransactionUnsafe, hash256, hexToBin: localHexToBin } = await import('@bitauth/libauth');
    const rawTx = builder.build();
    const txid = await provider.sendRawTransaction(rawTx);

    // Verify txid matches locally computed hash to detect compromised providers
    const rawTxBin = localHexToBin(rawTx);
    const expectedTxid = binToHex(hash256(rawTxBin).reverse());
    if (txid !== expectedTxid) {
      throw new Error(
        `Txid mismatch: provider returned '${txid}', expected '${expectedTxid}'. `
        + 'The network provider may be compromised.',
      );
    }

    const decoded = decodeTransactionUnsafe(rawTxBin);
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

  private maxFeeOverride?: bigint;
  private containerDepositAmount: bigint = 0n;

  private externalCallInfos: ExternalCallInfo[] = [];
  private callInfos: CallInfo[] = [];
  private registryExternalStateOverrides: Map<string, Record<string, StateValueType>> = new Map();
  private emitReturnFlag = false;

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
  ) {
    // Prevent unhandled rejection if the builder fails before send() is called
    // (e.g. when withExternalCall() causes send() to rebuild from scratch)
    this.builderPromise = builderPromise;
    this.builderPromise.catch(() => {});
    this.parentContract = parentContract;
    this.functionName = functionName;
    this.functionArgs = functionArgs;
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

  /**
   * Deposit satoshis into the satoshi container (positive msg.value).
   * Used with payable functions to increase the container balance.
   * The extra sats are sourced from the fee funder.
   */
  withValue(amount: bigint): this {
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

  then<TResult1 = TransactionDetails, TResult2 = never>(
    onfulfilled?: ((value: TransactionDetails) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.send().then(onfulfilled, onrejected);
  }

  async build(): Promise<TransactionBuilder> {
    const splitMergeBuilder = await this._trySplitMergeBuild();
    if (splitMergeBuilder) return splitMergeBuilder;
    const stb = await this._applyOverrides();
    return stb.build();
  }

  async send(): Promise<TransactionDetails> {
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
    const { decodeTransactionUnsafe, encodeTransaction, hash256 } = await import('@bitauth/libauth');
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

    return { ...decoded, txid, hex: rawTx } as TransactionDetails;
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
