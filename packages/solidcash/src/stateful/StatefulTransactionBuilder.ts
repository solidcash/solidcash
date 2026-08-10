/* eslint-disable @typescript-eslint/no-loop-func */
import {
  StateLayout,
  EntryAccessAbi,
  buildPushdataCommitment,
  buildEntryCommitment,
  buildEntryCommitmentMultiKey,
  parsePushdataCommitment,
  getDefaultStateValue,
  encodePushdataValue,
  EventDefinitionAbi,
  StateValue,
  FunctionBlockLayout,
  AbiFunction,
  BlockSlotKind,
  attachDecodedAccessors,
  buildChunkCommitment,
  buildEntryNftCovenantScript,
  computeCollectionHash,
  dynamicChunkSignature,
  splitValueIntoChunks,
} from '@solidcash/utils';
import {
  binToHex, hexToBin, isHex, encodeTransaction, createVirtualMachineBch2026, utf8ToBin,
} from '@bitauth/libauth';
import { getDustThreshold } from '@mem-cash/validation';
import {
  buildEventNftCovenantScript, computeEventNameHash, buildSidecarRedeem,
  sidecarLockingBytecode, scriptToBytecode,
} from '@solidcash/utils';
import { TransactionBuilder, TransactionBuilderOptions } from '../TransactionBuilder.js';
import { CovenantTransactionBuilder } from './CovenantTransactionBuilder.js';
import {
  addressToLockScript, scriptToLockingBytecode, generateLibauthSourceOutputs, calculateDust,
} from '../utils.js';
import type { LibauthOutput, Output, ReceiptEvent } from '../interfaces.js';
import { attachWait } from '../wait.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import {
  assertFinalizedTransactionBytes, assertFinalizedTransactionCovenants, inputSubjectsOfBuilder,
} from '../message-bus/preflight.js';
import { parseEventCommitment } from './StateReader.js';
import {
  Utxo, UnlockableUtxo, TransactionDetails, isP2PKHUnlocker,
} from '../interfaces.js';
import { BALANCED_SLOT_SATOSHIS } from './balancedBlocks.js';
import { createRelocatedDataNftUnlocker } from './covenant-helpers.js';

export interface EntryNftInfo {
  slotIndex: number;
  collection: string;
  keyType: string;
  valueType: string;
  keyValue: bigint | boolean | Uint8Array;
  /** For nested mappings: all key types from outer to inner. */
  keyTypes?: string[];
  /** For nested mappings: all key values from outer to inner. */
  keyValues?: Array<bigint | boolean | Uint8Array>;
  exists: boolean;
  utxo?: UnlockableUtxo;
}

export interface TransferData {
  lockingBytecode: Uint8Array;
  amount: bigint;
}

export interface EventEmitData {
  eventName: string;
  eventSignature: string;
  args: Array<StateValue | string>;
}

export interface TokenContainerInfo {
  keyParam: string;
  tokenContainerSlotIndex: number;
  tokenContainerCategoryId: string;
  exists: boolean;
  utxo?: UnlockableUtxo;
}

export interface TokenContainerTransferData {
  tokenContainerCategoryId: string;
  lockingBytecode: Uint8Array;
  amount: bigint;
  insertionOrder: number;
}

export interface TokenContainerTransferNftData {
  tokenContainerCategoryId: string;
  lockingBytecode: Uint8Array;
  commitment: Uint8Array;
  capability: 'none' | 'mutable' | 'minting';
  insertionOrder: number;
}

export interface ExternalCallUtxoGroup {
  categoryId: string;
  stateLayout: StateLayout;
  masterUtxo: Utxo | UnlockableUtxo;
  dataNftUtxos: UnlockableUtxo[];
  requiredDataNftIndices: number[];
  functionName: string;
  functionArgs: any[];
  externalContract: any; // StatefulContract - kept as any to avoid circular import
  callMode?: 'call' | 'staticcall' | 'delegatecall';
  /** If this external callee is itself a proxy, execute/derive its state transition at this delegate group. */
  delegateCallGroupIndex?: number;
  /** Reuses another group's single master/data input/output block for repeated calls to one UTXO contract. */
  sharedGroupIndex?: number;
  /** Honest SDK probe result for a read fused into another call sharing this master input. */
  precomputedReturnCommitment?: Uint8Array;
  /** Return slot owned by the state-writing call fused into this physical group. */
  fusedReturnGroupIndex?: number;
  /** Absolute output index verified by this physical call's return covenant. */
  returnOutputIndex?: number;
  /** Compiler-owned hidden route used for a grouped logical invocation. */
  compilerRoute?: {
    abiFunction: AbiFunction;
    selector: Uint8Array;
    blob: Uint8Array;
    args: any[];
    /** Logical handler selectors already executed by this physical route owner. */
    logicalSelectors: string[];
    /** Decoded Solidity-visible arguments for each authenticated logical row. */
    rowArguments?: Array<{ selector: string; args: any[]; handler: AbiFunction }>;
    internalArgs?: Record<string, any>;
    eventSignaturesBySlot?: Array<string | undefined>;
  };
  /** Active message-bus batch blockhash reads, retained until the group's absolute input base is known. */
  graphBlockhashSelections?: Array<{
    readKey: string; slotOrdinal: number; rowArgs: any[]; handler: AbiFunction;
  }>;
  /** B's full block: entry NFTs, token containers, satoshi container, funders for output-only slots */
  blockInputs?: UnlockableUtxo[];
  /** B's function block layout (for full block ordering) */
  blockLayout?: FunctionBlockLayout;
  /** X13: B's block carries a funding input at its published returnEvent offset, so B's return-event NFT is
   * emitted at that offset instead of appended after the whole participant region. */
  returnEventInBlock?: boolean;
  /** A route's chunkable C2 WRITE pins its value chunks as outputs in the callee's TRAILING band. The value is
   * computed on-chain (`publishJobEvent` stamps `block.timestamp` before storing), so the SDK cannot build the
   * chunks off-chain the way `valueChunkMints` does for a caller-known value - the commitments are extracted
   * from the callee's derivation probe and placed here, keyed by block slot. */
  derivedTrailingOutputs?: Map<number, { commitment: string; lockingBytecode: Uint8Array }>;
  /** B's event NFT outputs (from auto-derivation of B's VM trace) */
  eventOutputs?: Array<{
    eventSignature: string; commitment: string; lockingBytecode: Uint8Array;
  } | undefined>;
  /** B's keccak256 compute side-car INPUTS (outState path: appended after dataNfts; externalCall path already
   * carries them inside blockInputs). In B's keccak-call order. */
  keccakInputs?: UnlockableUtxo[];
  /** B's keccak256 compute side-car recreation OUTPUTS (both paths), committing each computed R_i. */
  keccakRecreates?: Output[];
  /** Cross-contract callee LOOP write (docs/deferrals.md #1): SDK-computed updated commitments for B's trailing loop
   * entries, in co-spend order. The trailing entries are appended to blockInputs starting at entryLoopStart. */
  entryLoopCommitments?: string[];
  /** blockInputs index where the trailing loop entries begin (== B's blockSize). */
  entryLoopStart?: number;
  /** B's collection signature for the loop entries (for the derive-time master-index unlocker patch). */
  entryLoopCollection?: string;
  /** Sorted entry slots known at planning time to be inserts. Placeholder NEW
   * outputs let the first derivation pass reach and reveal both commitments. */
  plannedEntryInserts?: Array<{ blockSlot: number; outputBlockSlot: number }>;
  /** Internal handles for the placeholders above. */
  plannedEntryInsertHandles?: number[];
  /** Exact C2 predecessor recreations reserved in compiler-route trailing slots. */
  batchPredecessorOutputs?: Array<{
    outputBlockSlot: number; lockingBytecode: Uint8Array; commitment: string;
  }>;
  /** Entry covenant bytecode for fixed sorted-batch target slots. Absent targets use balanced funder inputs,
   * whose locking bytecode must not be mirrored when the active route mints the target node. */
  batchEntryLockingBytecodes?: Map<number, Uint8Array>;
  /** Direct, unambiguous dynamic-write values derived from the callee ABI arguments. */
  dynamicStateValues?: Readonly<Record<string, StateValue>>;
}

export interface StatefulTransactionOptions extends TransactionBuilderOptions {
  masterUtxo: UnlockableUtxo;
  dataNftUtxos: UnlockableUtxo[];
  stateLayout: StateLayout;
  categoryId: string;
  requiredNftIndices?: number[];  // if absent, use all indices
  readOnlyDataNftUtxos?: UnlockableUtxo[];  // read-only data NFTs from other contracts
  blockhashCoSpendUtxos?: UnlockableUtxo[];  // (n->hash) oracle co-spends for blockhash(n) readers
  /** Optional physical ordinal within the function's blockhashOracle slots for each co-spend. Graph message-bus batch
   * routes reserve a fixed row band, so active reads are sparse and the inactive slots must remain funders. */
  blockhashCoSpendSlotOrdinals?: number[];
  keccakComputeCoSpendUtxos?: UnlockableUtxo[]; // keccak256 compute side-cars (one per call) at keccakSideCar slots
  keccakComputeCommitments?: string[];        // parallel: R_i = keccak256(preimage_i) hex, committed to recreation i
  ecrecoverComputeCoSpendUtxos?: UnlockableUtxo[]; // recovery A/B side-cars (2 per call, flat A0,B0,A1,B1..) at slots
  ecrecoverComputeRecreates?: Output[];       // parallel recreation OUTPUTS (A commits H_A, B commits the pubkey Q)
  entryNfts?: EntryNftInfo[];
  entryAccesses?: readonly EntryAccessAbi[];
  entryNftLockingBytecodes?: Map<string, Uint8Array>; // collection name -> locking bytecode
  // Dynamic-storage vars (string / unbounded bytes): chunk NFTs created as trailing outputs.
  dynamicChunkVars?: Array<{ name: string; type: string; lockingBytecode: Uint8Array }>;
  // Old chunk UTXOs co-spent (destroyed) on a dynamic-storage write; not recreated as outputs.
  dynamicChunkInputs?: UnlockableUtxo[];
  // Collections written by a runtime loop (`for(i<n) m[k[i]]=v[i]`): N new entry NFTs created as trailing
  // outputs (a runtime-variable count, like dynamicChunkVars). Commitments come from auto-derivation.
  loopEntryVars?: Array<{ collection: string; lockingBytecode: Uint8Array; categoryId?: string }>;
  eventDefinitions?: readonly EventDefinitionAbi[];
  eventNftLockingBytecodes?: Map<string, Uint8Array>; // eventSignature -> locking bytecode
  tokenContainers?: TokenContainerInfo[];
  tokenContainerLockingBytecodes?: Map<string, Uint8Array>; // tokenContainerCategoryId -> locking bytecode
  satoshiContainerUtxo?: UnlockableUtxo;
  satoshiContainerLockingBytecode?: Uint8Array;
  externalOutStateUtxoGroups?: ExternalCallUtxoGroup[];
  externalCallUtxoGroups?: ExternalCallUtxoGroup[];
  lowLevelCallUtxoGroups?: ExternalCallUtxoGroup[];
  lowLevelCallRawInputs?: UnlockableUtxo[];
  /** Delegate implementation master/data outputs precede grafted proxy-state entry slots. */
  delegateEntriesAfterLowLevel?: boolean;
  /** Keep routed delegate dynamic chunks in the compiler's output-count-relative suffix without reordering inputs. */
  delegateDynamicChunksAtSuffix?: boolean;
  /**
   * X56. The delegate return-event output follows the implementation's own event outputs rather than its
   * master. Set only when the co-spent implementation BOTH emits and returns, which is the only case where the
   * two claim the same index.
   */
  delegateReturnEventAfterEvents?: boolean;
  /** Absolute input offset selected by the caller's encoded low-level-call index. */
  lowLevelCallInputBase?: number;
  /** The first low-level input is a compiler-route delegate implementation placed after the balanced root block. */
  compilerRouteDelegateBlock?: boolean;
  batchEntriesBeforeDynamicChunks?: boolean;
  iterationEntryInputs?: UnlockableUtxo[];
  // C2 diff-key insert loop: the N bracketing predecessors, co-spent at input[blockSize+c] but NOT preserved as
  // outputs (unlike iterationEntryInputs) - they are MODIFIED to P' which is emitted via loopEntryVars. Kept separate
  // so they are not counted in the loop-entry output base.
  insertLoopPredecessorInputs?: UnlockableUtxo[];
  keccakLoopSideCars?: UnlockableUtxo[];   // dynamic keccak loop: N trailing compute side-car INPUTS at [blockSize,..)
  keccakLoopRecreates?: Output[];          // ... and their recreation OUTPUTS (R_i per iteration), parallel
  checkMinRelayFee?: boolean; // enforce fee >= feePerByte * txSize
  minRelayFeePerKb?: bigint;  // satoshis per 1000 bytes; default 1000n (1 sat/byte)
  blockLayout?: FunctionBlockLayout;
  funderUtxos?: UnlockableUtxo[];     // funder UTXOs for output-only slots
  /** Immutable SCID anchor co-spent outside every fixed participant block so callees can authenticate the
   * Solidity-visible logical caller address. */
  logicalIdentityUtxo?: UnlockableUtxo;
  /** Immutable SCID anchors of CALLEES whose Solidity-visible address is logical, co-spent so an external-call
   * identity check can prove the logical-to-physical binding. Appended after `logicalIdentityUtxo`, outside every
   * accounted band, and recreated at the matching output position. */
  externalIdentityAnchorUtxos?: UnlockableUtxo[];
}

/**
 * A transaction builder that wraps TransactionBuilder with the stateful
 * contract input/output convention:
 * - Input 0 (at activeInputIndex): master contract UTXO with minting NFT
 * - Input 1..N: data NFT UTXOs carrying state commitments
 * - Corresponding outputs preserve locking bytecode, token category, and NFT capability
 */
export class StatefulTransactionBuilder {
  private builderOptions: TransactionBuilderOptions;
  private _checkMinRelayFee: boolean;
  private _minRelayFeePerKb: bigint;
  private _maximumFeeSatoshis?: bigint;
  private strictVmPreflight = false;
  private allInputs: UnlockableUtxo[];
  // External-library side-car UTXO, co-spent as the LAST input so the covenant's library loader can read
  // it (via OP_INPUTBYTECODE) during both auto-derivation probes and the final tx. Set by _applyOverrides.
  private sidecarUtxo?: UnlockableUtxo;
  private stateLayout: StateLayout;
  private masterUtxo: UnlockableUtxo;
  private messageBusProbeMasterVout?: number;
  private dataNftUtxos: UnlockableUtxo[];
  private categoryId: string;
  private requiredNftIndices: readonly number[];
  private stateUpdates: Map<
  string, StateValue
  > = new Map();

  // Exact data-NFT commitments learned from covenant traces. Parsing and rebuilding a commitment can lose
  // compiler-only dynamic length registers, so auto-derivation retains the authenticated bytes verbatim.
  private stateRawCommitments: Map<number, string> = new Map();

  private pendingOutputs: Array<{
    to: string | Uint8Array; amount: bigint; token?: Utxo['token'];
  }> = [];

  private entryNfts: EntryNftInfo[];
  private entryUpdates: Map<
  number, StateValue
  > = new Map();

  private entryDeletes: Set<number> = new Set();
  private entryNftLockingBytecodes: Map<string, Uint8Array>;
  private eventDefinitions: readonly EventDefinitionAbi[];
  private eventNftLockingBytecodes: Map<string, Uint8Array>;
  private pendingTransfers: TransferData[] = [];
  private pendingEventEmits: EventEmitData[] = [];
  private detachedEventReceipts: Array<{ eventSignature: string; commitment: string }> = [];
  private tokenContainers: TokenContainerInfo[];
  private tokenContainerLockingBytecodes: Map<string, Uint8Array>;
  private satoshiContainerUtxo?: UnlockableUtxo;
  private satoshiContainerLockingBytecode?: Uint8Array;
  private containerDepositAmount: bigint = 0n;
  private pendingTokenContainerTransfers: TokenContainerTransferData[] = [];
  private pendingTokenContainerTransferNfts: TokenContainerTransferNftData[] = [];
  private tokenContainerTransferInsertionCounter = 0;
  private readOnlyDataNftUtxos: UnlockableUtxo[];
  private blockhashCoSpendUtxos: UnlockableUtxo[];
  private blockhashCoSpendSlotOrdinals?: number[];
  private keccakComputeCoSpendUtxos: UnlockableUtxo[];
  private keccakComputeCommitments: string[];
  private ecrecoverComputeCoSpendUtxos: UnlockableUtxo[];
  private ecrecoverComputeRecreates: Output[];
  private externalOutStateUtxoGroups: ExternalCallUtxoGroup[];
  private externalCallUtxoGroups: ExternalCallUtxoGroup[];
  private lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
  private lowLevelCallRawInputs: UnlockableUtxo[];
  private delegateEntriesAfterLowLevel: boolean;
  private delegateDynamicChunksAtSuffix: boolean;
  private delegateReturnEventAfterEvents: boolean;
  private lowLevelCallInputBase?: number;
  private compilerRouteDelegateBlock: boolean;
  private batchEntriesBeforeDynamicChunks: boolean;
  private iterationEntryInputs: UnlockableUtxo[];
  private insertLoopPredecessorInputs: UnlockableUtxo[];
  private keccakLoopSideCars: UnlockableUtxo[];
  private keccakLoopRecreates: Output[];
  private blockLayout?: FunctionBlockLayout;
  private logicalIdentityUtxo?: UnlockableUtxo;
  private externalIdentityAnchorUtxos: UnlockableUtxo[] = [];
  funderUtxos: UnlockableUtxo[];
  private funderChangeAddress?: Uint8Array;

  private externalCallStateUpdates: Map<
  string, Map<string, StateValue>
  > = new Map(); // categoryId -> (varName -> value)

  // Cross-contract callee (B) C2 sorted-entry outputs, derived from B's VM trace (docs/deferrals.md #1).
  // categoryId -> (B block-slot position si -> commitment hex). The external-call output loop mints B's updated
  // (or predecessor P') entry at that slot; a NEW insert node rides the trailing region below.
  private externalCallEntryOutputs: Map<string, Map<number, string>> = new Map();
  // Trailing NEW entry nodes minted for a cross-contract callee INSERT (per group: address lbc + commitment hex),
  // placed right after the group's block (B's covenant mints the NEW at masterInputIndex + blockSize).
  private externalCallEntryInserts: Array<{ categoryId: string; to: Uint8Array; commitment: string }> = [];

  private pendingReturnEventOutputs: Array<{
    categoryId: string; commitment: Uint8Array; identity: string;
  }> = [];

  private entryRawCommitments: Map<number, string> = new Map(); // slotIndex -> hex commitment (from auto-derivation)
  private pinnedEntrySlots: Set<number> = new Set(); // slots whose commitment is known exactly (never re-derive)
  private dynamicChunkVars: Array<{ name: string; type: string; lockingBytecode: Uint8Array }> = [];
  private dynamicChunkInputs: UnlockableUtxo[] = [];
  // varName -> ordered chunk commitments (hex) from auto-derivation; length determines chunk output count.
  private chunkRawCommitments: Map<string, string[]> = new Map();
  private loopEntryVars: Array<{ collection: string; lockingBytecode: Uint8Array; categoryId?: string }> = [];
  // collection -> ordered loop entry commitments (hex) from auto-derivation; length = entry output count.
  private loopEntryCommitments: Map<string, string[]> = new Map();
  private requiredLoopEntryCounts: Map<string, number> = new Map();
  // P5b: collections whose loop-entry (NEW) commitment is known EXACTLY (a chunkable-value insert) and must NOT be
  // re-derived from the trace - the value-chunk pin adds OP_OUTPUTTOKENCOMMITMENT calls that the loop-entry
  // extractor would otherwise read as NEW nodes. Pinned like pinEntrySlot pins a fixed entry slot.
  private pinnedLoopEntries: Set<string> = new Set();
  // P5b: unpinned same-category 0x01 value-chunk outputs (LONG sorted-mapping values). Trailing, not covenant-
  // managed - the entry stores sha256(value) and the read verifies the reassembled witness, so these need no
  // on-chain pinning. Commitments are known exactly (buildChunkCommitment) so they never enter auto-derivation.
  private valueChunkOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: Utxo['token'] }> = [];

  /** Route value chunks the derivation recovered, keyed by ABSOLUTE output index. Builder-level, not per-group:
   * the covenant that pins them is probed as one group but addresses an output in ANOTHER group's block (its
   * base is the proxy master), so the placing group and the owning group are different. */
  private derivedChunkOutputs = new Map<number, {
    commitment: string; lockingBytecode: Uint8Array; categoryId?: string;
  }>();

  private lateValueChunkOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: Utxo['token'] }> = [];
  // P5b (computed values): collections whose value chunks are DERIVED from the trace (the SDK has no value param to
  // build them). The covenant pins them, so their commitments come from auto-derivation like dynamicChunkVars.
  private valueChunkVars: Map<string, Uint8Array> = new Map(); // collection -> chunk-address locking bytecode
  private valueChunkRawCommitments: Map<string, string[]> = new Map(); // collection -> ordered chunk commitments (hex)
  private eventRawCommitments: Map<number, string> = new Map(); // emitIndex -> hex commitment (from auto-derivation)
  private pendingEventPlaceholders: Array<{ eventSignature: string; emitIndex: number }> = [];

  constructor(options: StatefulTransactionOptions) {
    this.builderOptions = options;
    this._checkMinRelayFee = options.checkMinRelayFee ?? true;
    this._minRelayFeePerKb = options.minRelayFeePerKb ?? 1000n;
    this.stateLayout = options.stateLayout;
    this.masterUtxo = options.masterUtxo;
    this.dataNftUtxos = options.dataNftUtxos;
    this.categoryId = options.categoryId;
    this.readOnlyDataNftUtxos = options.readOnlyDataNftUtxos ?? [];
    this.blockhashCoSpendUtxos = options.blockhashCoSpendUtxos ?? [];
    this.blockhashCoSpendSlotOrdinals = options.blockhashCoSpendSlotOrdinals;
    this.keccakComputeCoSpendUtxos = options.keccakComputeCoSpendUtxos ?? [];
    this.keccakComputeCommitments = options.keccakComputeCommitments ?? [];
    this.ecrecoverComputeCoSpendUtxos = options.ecrecoverComputeCoSpendUtxos ?? [];
    this.ecrecoverComputeRecreates = options.ecrecoverComputeRecreates ?? [];
    this.externalOutStateUtxoGroups = options.externalOutStateUtxoGroups ?? [];
    this.externalCallUtxoGroups = options.externalCallUtxoGroups ?? [];
    this.lowLevelCallUtxoGroups = options.lowLevelCallUtxoGroups ?? [];
    this.lowLevelCallRawInputs = options.lowLevelCallRawInputs ?? [];
    this.delegateEntriesAfterLowLevel = options.delegateEntriesAfterLowLevel ?? false;
    this.delegateDynamicChunksAtSuffix = options.delegateDynamicChunksAtSuffix ?? false;
    this.delegateReturnEventAfterEvents = options.delegateReturnEventAfterEvents ?? false;
    this.lowLevelCallInputBase = options.lowLevelCallInputBase;
    this.compilerRouteDelegateBlock = options.compilerRouteDelegateBlock ?? false;
    this.batchEntriesBeforeDynamicChunks = options.batchEntriesBeforeDynamicChunks ?? false;
    this.entryNfts = options.entryNfts ?? [];
    this.entryNftLockingBytecodes = options.entryNftLockingBytecodes ?? new Map();
    this.dynamicChunkVars = options.dynamicChunkVars ?? [];
    this.dynamicChunkInputs = options.dynamicChunkInputs ?? [];
    this.loopEntryVars = options.loopEntryVars ?? [];
    this.eventDefinitions = options.eventDefinitions ?? [];
    this.eventNftLockingBytecodes = options.eventNftLockingBytecodes ?? new Map();
    this.tokenContainers = options.tokenContainers ?? [];
    this.tokenContainerLockingBytecodes = options.tokenContainerLockingBytecodes ?? new Map();
    this.satoshiContainerUtxo = options.satoshiContainerUtxo;
    this.satoshiContainerLockingBytecode = options.satoshiContainerLockingBytecode;
    this.iterationEntryInputs = options.iterationEntryInputs ?? [];
    this.insertLoopPredecessorInputs = options.insertLoopPredecessorInputs ?? [];
    this.keccakLoopSideCars = options.keccakLoopSideCars ?? [];
    this.keccakLoopRecreates = options.keccakLoopRecreates ?? [];
    this._maximumFeeSatoshis = options.maximumFeeSatoshis;
    this.blockLayout = options.blockLayout;
    this.funderUtxos = options.funderUtxos ?? [];
    this.logicalIdentityUtxo = options.logicalIdentityUtxo;
    this.externalIdentityAnchorUtxos = options.externalIdentityAnchorUtxos ?? [];

    // Default to all NFT indices if not specified
    this.requiredNftIndices = options.requiredNftIndices
      ?? Array.from({ length: options.stateLayout.dataNftCount }, (_, i) => i);

    // Flatten external outState inputs: [B1's master, B1's data NFTs, B1's keccak side-cars, ...] - the keccak
    // side-cars follow B's data NFTs (B's block-layout order: master < dataNft < keccakSideCar) so B's covenant
    // reads them at their slot.
    const externalOutStateInputs: UnlockableUtxo[] = [];
    for (const group of this.externalOutStateUtxoGroups) {
      externalOutStateInputs.push(group.masterUtxo as UnlockableUtxo);
      externalOutStateInputs.push(...group.dataNftUtxos);
      if (group.keccakInputs) externalOutStateInputs.push(...group.keccakInputs);
    }

    // Flatten external call inputs - use full block when available
    const externalCallInputs: UnlockableUtxo[] = [];
    for (const group of this.externalCallUtxoGroups) {
      if (group.sharedGroupIndex !== undefined) continue;
      if (group.blockInputs) {
        // Full block: master + dataNfts + entries + SC + TCs + funders (all ordered by blockLayout)
        externalCallInputs.push(...group.blockInputs);
      } else {
        // Legacy: just master + dataNfts
        externalCallInputs.push(group.masterUtxo as UnlockableUtxo);
        externalCallInputs.push(...group.dataNftUtxos);
      }
    }

    // Flatten low-level call inputs (stateful groups + raw UTXOs)
    const lowLevelCallInputs: UnlockableUtxo[] = [];
    for (const group of this.lowLevelCallUtxoGroups) {
      lowLevelCallInputs.push(group.masterUtxo as UnlockableUtxo);
      lowLevelCallInputs.push(...group.dataNftUtxos);
    }

    // Add master UTXO as first input, then data NFT UTXOs, then read-only NFTs,
    // then outState NFTs, then external call NFTs, then low-level call NFTs,
    // then entry NFTs, then token container UTXOs, then satoshi container UTXO
    const entryInputs = this.entryNfts
      .filter((e) => e.exists && e.utxo)
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((e) => e.utxo!);

    const tokenContainerInputs = this.tokenContainers
      .filter((d) => d.exists && d.utxo)
      .sort((a, b) => a.tokenContainerSlotIndex - b.tokenContainerSlotIndex)
      .map((d) => d.utxo!);

    const satoshiContainerInputs = this.satoshiContainerUtxo ? [this.satoshiContainerUtxo] : [];

    this.allInputs = this._buildInputs(
      entryInputs, tokenContainerInputs, satoshiContainerInputs,
      externalOutStateInputs, externalCallInputs,
      lowLevelCallInputs,
    );
    // Callee anchors precede the caller's own: emitLogicalMsgSenderAnchorResolution resolves the caller's
    // identity from the LAST input, so that tail position must stay the caller's.
    this.allInputs.push(...this.externalIdentityAnchorUtxos);
    if (this.logicalIdentityUtxo) this.allInputs.push(this.logicalIdentityUtxo);
  }

  /** @internal Mark an impossible-output-index master used only by atomic VM derivation probes. */
  _setMessageBusProbeMasterVout(realVout: number): void {
    this.messageBusProbeMasterVout = realVout;
  }

  /** @internal Restore the real spend before a atomic participant block leaves SDK construction. */
  _restoreMessageBusProbeMasterOutpoint(): void {
    if (this.messageBusProbeMasterVout === undefined) return;
    this.masterUtxo.vout = this.messageBusProbeMasterVout;
    this.messageBusProbeMasterVout = undefined;
  }

  /** Require the fully funded and signed transaction to pass the artifact's
   * BCH VM before any network submission. Used for concrete recursive calls,
   * whose resource usage depends on runtime arguments. */
  enableStrictVmPreflight(): this {
    this.strictVmPreflight = true;
    return this;
  }

  /** Build allInputs following block layout when funders are available. */
  private _buildInputs(
    entryInputs: UnlockableUtxo[],
    tokenContainerInputs: UnlockableUtxo[],
    satoshiContainerInputs: UnlockableUtxo[],
    externalOutStateInputs: UnlockableUtxo[],
    externalCallInputs: UnlockableUtxo[],
    lowLevelCallInputs: UnlockableUtxo[],
  ): UnlockableUtxo[] {
    // When funders are provided and no external calls (which add gap outputs),
    // use offset-indexed ordering so input[offset] matches OP_INPUTINDEX + offset.
    // With external calls, the gap between readOnly and entries breaks 1:1 correspondence,
    // so we fall through to the legacy path which both inputs and outputs follow.
    const hasExternalGroups = externalOutStateInputs.length > 0 || externalCallInputs.length > 0;
    if (this.blockLayout && this.funderUtxos.length > 0
      && !this.delegateEntriesAfterLowLevel
      && (!hasExternalGroups || this.blockhashCoSpendSlotOrdinals !== undefined
        || this.compilerRouteDelegateBlock)) {
      const funderPool = [...this.funderUtxos];
      // Position-indexed array: each element goes at its slot.offset
      const positioned: (UnlockableUtxo | undefined)[] = new Array(this.blockLayout.blockSize);
      let dataNftIdx = 0, readOnlyIdx = 0, tcIdx = 0;
      let llcIdx = 0; // low-level call input index
      let bhIdx = 0; // blockhash co-spend index
      let bhOrdinal = 0;
      let kIdx = 0; // keccak256 compute side-car index
      let erIdx = 0; // ecrecover recovery-pair side-car index (flat A0,B0,A1,B1..)
      const trailingInputs = [
        ...this.iterationEntryInputs,
        ...this.insertLoopPredecessorInputs,
        ...this.dynamicChunkInputs,
      ];
      let trailingIdx = 0;
      // Each entry slot gets ITS OWN existing entry input (by slotIndex), or a funder if absent. Not a dense
      // pull from entryInputs: an absent lower slot must not shift a higher slot's entry into the gap (the
      // covenant reads each slot at its fixed offset).
      const entryInputBySlot = new Map<number, UnlockableUtxo>(
        this.entryNfts.filter((e) => e.exists && e.utxo).map((e) => [e.slotIndex, e.utxo!]),
      );

      for (const slot of this.blockLayout.slots) {
        switch (slot.kind) {
          case 'master': positioned[slot.offset] = this.masterUtxo; break;
          case 'dataNft':
            if (dataNftIdx < this.dataNftUtxos.length) positioned[slot.offset] = this.dataNftUtxos[dataNftIdx++];
            break;
          case 'readOnlyDataNft':
            if (readOnlyIdx < this.readOnlyDataNftUtxos.length) {
              positioned[slot.offset] = this.readOnlyDataNftUtxos[readOnlyIdx++];
            }
            break;
          case 'blockhashOracle':
            if ((this.blockhashCoSpendSlotOrdinals?.[bhIdx] ?? bhIdx) === bhOrdinal
              && bhIdx < this.blockhashCoSpendUtxos.length) {
              positioned[slot.offset] = this.blockhashCoSpendUtxos[bhIdx++];
            } else if (this.blockhashCoSpendSlotOrdinals) {
              const f = funderPool.shift();
              if (f) positioned[slot.offset] = f;
            }
            bhOrdinal++;
            break;
          case 'keccakSideCar':
            if (kIdx < this.keccakComputeCoSpendUtxos.length) {
              positioned[slot.offset] = this.keccakComputeCoSpendUtxos[kIdx++];
            }
            break;
          case 'ecrecoverSideCar':
            if (erIdx < this.ecrecoverComputeCoSpendUtxos.length) {
              positioned[slot.offset] = this.ecrecoverComputeCoSpendUtxos[erIdx++];
            }
            break;
          case 'entry': {
            // Delegate implementation inputs may intentionally occupy the same physical input offsets as grafted
            // proxy-state output slots. The implementation is the input; the entry NFT is produced only on output.
            if (positioned[slot.offset]) break;
            const entryInput = slot.slotIndex !== undefined ? entryInputBySlot.get(slot.slotIndex) : undefined;
            if (entryInput) positioned[slot.offset] = entryInput;
            else { const f = funderPool.shift(); if (f) positioned[slot.offset] = f; }
            break;
          }
          case 'satoshiContainer':
            if (satoshiContainerInputs.length > 0) positioned[slot.offset] = satoshiContainerInputs[0];
            break;
          case 'tokenContainer':
            if (tcIdx < tokenContainerInputs.length) positioned[slot.offset] = tokenContainerInputs[tcIdx++];
            else { const f = funderPool.shift(); if (f) positioned[slot.offset] = f; }
            break;
          case 'lowLevelCall':
            if (this.compilerRouteDelegateBlock) {
              // These are logical handler call slots inside the route block. The physical delegate implementation
              // is the route owner and lives after the complete block; nested participant groups are appended next.
              const f = funderPool.shift();
              if (f) positioned[slot.offset] = f;
              break;
            }
            // Place the actual low-level call input (target master) at its block layout
            // position so the compiler's emitBlockSlotIndex reads the correct INPUTBYTECODE.
            if (llcIdx < lowLevelCallInputs.length) {
              const callOffset = this.lowLevelCallInputBase ?? slot.offset;
              if (callOffset !== slot.offset) {
                for (let offset = slot.offset; offset < callOffset; offset++) {
                  if (positioned[offset]) continue;
                  const placeholder = funderPool.shift();
                  if (placeholder) positioned[offset] = placeholder;
                }
              }
              positioned[callOffset] = lowLevelCallInputs[llcIdx++];
              if (this.delegateEntriesAfterLowLevel) {
                // A delegate's own data NFTs immediately follow its master; grafted entry slots begin after this
                // implementation block, so keep their absolute offsets instead of compacting the gap away.
                let off = callOffset + 1;
                while (llcIdx < lowLevelCallInputs.length && positioned[off] === undefined) {
                  positioned[off++] = lowLevelCallInputs[llcIdx++];
                }
              }
            } else { const f = funderPool.shift(); if (f) positioned[slot.offset] = f; }
            break;
          case 'transfer': case 'tcTransfer': case 'event': case 'returnEvent':
          case 'deploy': {
            const f = funderPool.shift();
            if (f) positioned[slot.offset] = f;
            break;
          }
          case 'trailing': {
            if (trailingIdx < trailingInputs.length) {
              positioned[slot.offset] = trailingInputs[trailingIdx++];
            } else {
              const f = funderPool.shift();
              if (f) positioned[slot.offset] = f;
            }
            break;
          }
          default: break;
        }
      }
      if (this.blockLayout.trailingCapacity !== undefined
        && trailingIdx !== trailingInputs.length) {
        throw new Error(
          'Runtime resource inputs exceed balanced trailing capacity '
          + `(${trailingInputs.length} > ${this.blockLayout.trailingCapacity ?? 0})`,
        );
      }

      // Fill the reserved gap (offsets between last readOnly and first entry/SC/TC)
      // with external outState and external call inputs
      const gapInputs = [...externalOutStateInputs, ...externalCallInputs];
      let gapIdx = 0;
      for (let i = 0; i < positioned.length; i++) {
        if (positioned[i] === undefined && gapIdx < gapInputs.length) {
          positioned[i] = gapInputs[gapIdx++];
        }
      }

      // Compact: filter out any remaining undefined slots
      const result = positioned.filter((x): x is UnlockableUtxo => x !== undefined);

      return [
        ...result,
        // A compiler-route delegate owns the balanced block and must be the first participant after it.
        ...(this.compilerRouteDelegateBlock ? lowLevelCallInputs : []),
        // Any overflow gap inputs that didn't fit
        ...gapInputs.slice(gapIdx),
        // Remaining low-level call inputs not already positioned in block layout slots
        ...(this.compilerRouteDelegateBlock ? [] : lowLevelCallInputs.slice(llcIdx)), ...this.lowLevelCallRawInputs,
        // Legacy balanced layouts predate reserved trailing regions. Preserve their established dynamic
        // resource run immediately after the fixed block; only a layout declaring trailingCapacity consumes
        // these inputs positionally above.
        ...trailingInputs.slice(trailingIdx),
        // Leftover funders not consumed by block layout slots (fee-only inputs)
        ...funderPool,
      ];
    }

    // Legacy ordering - funders go at the end (past all covenant inputs).
    // Delegate bytecode requires the implementation master to immediately follow the proxy master/data region.
    // Its nested external callees are ordinary co-spends, but must be ordered after that implementation band.
    if (this.delegateEntriesAfterLowLevel) {
      const associatedDelegates = new Set(this.externalCallUtxoGroups
        .map((group) => group.delegateCallGroupIndex)
        .filter((index): index is number => index !== undefined));
      const groupInputs = (group: ExternalCallUtxoGroup): UnlockableUtxo[] => group.blockInputs
        ? group.blockInputs : [group.masterUtxo as UnlockableUtxo, ...group.dataNftUtxos];
      const delegateInputs = (index: number): UnlockableUtxo[] => {
        const group = this.lowLevelCallUtxoGroups[index];
        return group ? [group.masterUtxo as UnlockableUtxo, ...group.dataNftUtxos] : [];
      };
      const nestedInputs: UnlockableUtxo[] = [];
      for (const group of this.externalCallUtxoGroups) {
        if (group.sharedGroupIndex !== undefined) continue;
        nestedInputs.push(...groupInputs(group));
        if (group.delegateCallGroupIndex !== undefined) {
          nestedInputs.push(...delegateInputs(group.delegateCallGroupIndex));
        }
      }
      return [
        this.masterUtxo, ...this.dataNftUtxos,
        ...this.lowLevelCallUtxoGroups.flatMap((group, index) => associatedDelegates.has(index)
          ? [] : [group.masterUtxo as UnlockableUtxo, ...group.dataNftUtxos]),
        ...this.lowLevelCallRawInputs,
        ...this.readOnlyDataNftUtxos, ...this.blockhashCoSpendUtxos,
        ...this.keccakComputeCoSpendUtxos, ...this.keccakLoopSideCars, ...this.ecrecoverComputeCoSpendUtxos,
        ...externalOutStateInputs, ...entryInputs, ...this.iterationEntryInputs,
        ...this.insertLoopPredecessorInputs, ...nestedInputs,
        ...this.dynamicChunkInputs, ...tokenContainerInputs, ...satoshiContainerInputs,
        ...this.funderUtxos,
      ];
    }
    // When the function also reads a dynamic-storage array (iterationEntryInputs = chunk run),
    // the covenant reads those chunks at blockSize+i, so they must sit immediately after the
    // block with nothing between. Loop external-call callees therefore go AFTER the chunk run
    // (their base is computed as blockSize+chunkCount), not in the pre-entry external-call slot.
    if (this.iterationEntryInputs.length > 0 && externalCallInputs.length > 0) {
      return [
        this.masterUtxo, ...this.dataNftUtxos, ...this.readOnlyDataNftUtxos, ...this.blockhashCoSpendUtxos,
        ...this.keccakComputeCoSpendUtxos, ...this.keccakLoopSideCars, ...this.ecrecoverComputeCoSpendUtxos,
        ...externalOutStateInputs,
        ...lowLevelCallInputs, ...this.lowLevelCallRawInputs,
        ...entryInputs, ...this.iterationEntryInputs, ...this.insertLoopPredecessorInputs,
        ...externalCallInputs,
        ...this.dynamicChunkInputs,
        ...tokenContainerInputs, ...satoshiContainerInputs,
        ...this.funderUtxos,
      ];
    }
    return [
      this.masterUtxo, ...this.dataNftUtxos, ...this.readOnlyDataNftUtxos, ...this.blockhashCoSpendUtxos,
      ...this.keccakComputeCoSpendUtxos, ...this.keccakLoopSideCars, ...this.ecrecoverComputeCoSpendUtxos,
      ...externalOutStateInputs, ...externalCallInputs,
      ...lowLevelCallInputs, ...this.lowLevelCallRawInputs,
      ...entryInputs, ...this.iterationEntryInputs, ...this.insertLoopPredecessorInputs,
      ...this.dynamicChunkInputs,
      ...tokenContainerInputs, ...satoshiContainerInputs,
      ...this.funderUtxos,
    ];
  }

  /**
   * Compute the minimum fee in satoshis for a transaction of the given byte size.
   * Converts minRelayFeePerKb to a per-byte rate with a floor of 1 sat/byte,
   * matching the ceiling-division formula used by BCHN / mem-cash.
   */
  private computeMinFee(txSizeBytes: bigint): bigint {
    // Ceiling division: ceil(feePerKb * size / 1000)
    // When feePerKb / 1000 rounds to 0 (e.g. feePerKb < 1000), enforce at least 1 sat/byte.
    const feePerByte = this._minRelayFeePerKb >= 1000n
      ? (this._minRelayFeePerKb + 999n) / 1000n   // ceiling division
      : 1n;                                        // floor: at least 1 sat/byte
    return feePerByte * txSizeBytes;
  }

  /** Set the change address for funder excess (returned after fee deduction). */
  setFunderChangeAddress(address: Uint8Array): void {
    this.funderChangeAddress = address;
  }

  /**
   * @internal Re-run input assembly after a co-spent group's unlocker was replaced post-construction. The
   * identity-anchor witness can only be filled once the built input positions exist, so the delegate master that
   * carries it is re-created after this builder assembled its inputs.
   */
  _refreshInputs(): void {
    this.setFunderUtxos(this.funderUtxos);
  }

  setFunderUtxos(funders: UnlockableUtxo[]): void {
    this.funderUtxos = funders;
    // Rebuild allInputs with new funders
    const entryInputs = this.entryNfts
      .filter((e) => e.exists && e.utxo)
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((e) => e.utxo!);
    const tokenContainerInputs = this.tokenContainers
      .filter((d) => d.exists && d.utxo)
      .sort((a, b) => a.tokenContainerSlotIndex - b.tokenContainerSlotIndex)
      .map((d) => d.utxo!);
    const satoshiContainerInputs = this.satoshiContainerUtxo ? [this.satoshiContainerUtxo] : [];
    const externalOutStateInputs: UnlockableUtxo[] = [];
    for (const g of this.externalOutStateUtxoGroups) {
      externalOutStateInputs.push(g.masterUtxo as UnlockableUtxo, ...g.dataNftUtxos);
    }
    const externalCallInputs: UnlockableUtxo[] = [];
    for (const g of this.externalCallUtxoGroups) {
      if (g.sharedGroupIndex !== undefined) continue;
      if (g.blockInputs) {
        externalCallInputs.push(...g.blockInputs);
      } else {
        externalCallInputs.push(g.masterUtxo as UnlockableUtxo, ...g.dataNftUtxos);
      }
    }
    const lowLevelCallInputs: UnlockableUtxo[] = [];
    for (const g of this.lowLevelCallUtxoGroups) {
      lowLevelCallInputs.push(g.masterUtxo as UnlockableUtxo, ...g.dataNftUtxos);
    }
    this.allInputs = this._buildInputs(
      entryInputs, tokenContainerInputs, satoshiContainerInputs,
      externalOutStateInputs, externalCallInputs, lowLevelCallInputs,
    );
    // Callee anchors precede the caller's own: emitLogicalMsgSenderAnchorResolution resolves the caller's
    // identity from the LAST input, so that tail position must stay the caller's.
    this.allInputs.push(...this.externalIdentityAnchorUtxos);
    if (this.logicalIdentityUtxo) this.allInputs.push(this.logicalIdentityUtxo);
  }

  /**
   * Set a state variable to a new value.
   */
  setState(
    name: string,
    value: StateValue,
  ): this {
    const variable = this.stateLayout.variables.find((v) => v.name === name);
    if (!variable) {
      // Allow a dynamic var's hidden length key "<name>$len" (the data-NFT register field).
      if (name.endsWith('$len')) {
        const base = name.slice(0, -4);
        const dynamicVariable = this.stateLayout.variables.find((v) => v.name === base && v.dynamic);
        if (dynamicVariable) {
          this.stateRawCommitments.delete(dynamicVariable.nftIndex);
          this.stateUpdates.set(name, value);
          return this;
        }
      }
      throw new Error(`Unknown state variable: ${name}`);
    }
    this.stateRawCommitments.delete(variable.nftIndex);
    this.stateUpdates.set(name, value);
    return this;
  }

  setStateRawCommitment(nftIndex: number, commitment: string): this {
    this.stateRawCommitments.set(nftIndex, commitment);
    return this;
  }

  /**
   * Set a state variable on an external call's output.
   */
  setExternalCallState(
    categoryId: string,
    name: string,
    value: StateValue,
  ): this {
    let updates = this.externalCallStateUpdates.get(categoryId);
    if (!updates) {
      updates = new Map();
      this.externalCallStateUpdates.set(categoryId, updates);
    }
    updates.set(name, value);
    return this;
  }

  /** B's C2 sorted-entry output at its block-slot position (commitment from B's VM trace). docs/deferrals.md #1. */
  setExternalCallEntryOutput(categoryId: string, blockSlot: number, commitmentHex: string): this {
    let m = this.externalCallEntryOutputs.get(categoryId);
    if (!m) { m = new Map(); this.externalCallEntryOutputs.set(categoryId, m); }
    m.set(blockSlot, commitmentHex);
    return this;
  }

  /** A trailing NEW entry node for a cross-contract callee INSERT (minted after B's block). Returns its handle. */
  addExternalCallEntryInsert(categoryId: string, to: Uint8Array, commitmentHex: string): number {
    return this.externalCallEntryInserts.push({ categoryId, to, commitment: commitmentHex }) - 1;
  }

  /** Replace a trailing NEW node's commitment (the placeholder set for the 2nd-pass probe). */
  setExternalCallEntryInsertCommitment(handle: number, commitmentHex: string): this {
    if (this.externalCallEntryInserts[handle]) this.externalCallEntryInserts[handle].commitment = commitmentHex;
    return this;
  }

  /** Drop a trailing NEW node placeholder (the write turned out to be an UPDATE, not an INSERT). */
  removeExternalCallEntryInsert(handle: number): this {
    if (this.externalCallEntryInserts[handle]) this.externalCallEntryInserts[handle] = { categoryId: '', to: new Uint8Array(), commitment: '' };
    return this;
  }

  /**
   * Set an entry NFT value by slot index.
   */
  setEntry(
    slotIndex: number,
    value: StateValue,
  ): this {
    this.entryUpdates.set(slotIndex, value);
    return this;
  }

  /**
   * Mark an entry NFT for deletion by slot index.
   */
  deleteEntry(slotIndex: number): this {
    this.entryDeletes.add(slotIndex);
    return this;
  }

  // Whether this entry slot is only conditionally active (a delete/write inside an if/else branch). Such a slot's
  // presence in the output depends on the taken branch, so it must not be unconditionally deleted from the layout.
  isEntrySlotConditional(slotIndex: number): boolean {
    return this.blockLayout?.slots.some(
      (s) => s.kind === 'entry' && s.slotIndex === slotIndex && s.conditional,
    ) ?? false;
  }

  /**
   * Add a transfer output (plain BCH, no tokens).
   */
  addTransfer(lockingBytecode: Uint8Array, amount: bigint): this {
    if (amount <= 0n) {
      throw new Error('Transfer amount must be positive');
    }
    this.pendingTransfers.push({ lockingBytecode, amount });
    return this;
  }

  /**
   * Add a token container transfer output (fungible tokens from a token container).
   */
  addTokenContainerTransfer(tokenContainerCategoryId: string, lockingBytecode: Uint8Array, amount: bigint): this {
    if (amount <= 0n) {
      throw new Error('Token container transfer amount must be positive');
    }
    this.pendingTokenContainerTransfers.push({
      tokenContainerCategoryId, lockingBytecode, amount,
      insertionOrder: this.tokenContainerTransferInsertionCounter++,
    });
    return this;
  }

  /**
   * Add a token container transferNft output (NFT with explicit commitment and capability).
   */
  addTokenContainerTransferNft(
    tokenContainerCategoryId: string,
    lockingBytecode: Uint8Array,
    commitment: Uint8Array,
    capability: 'none' | 'mutable' | 'minting',
  ): this {
    this.pendingTokenContainerTransferNfts.push({
      tokenContainerCategoryId, lockingBytecode, commitment, capability,
      insertionOrder: this.tokenContainerTransferInsertionCounter++,
    });
    return this;
  }

  /**
   * Set the deposit amount to add to the satoshi container balance.
   * Used by payable functions that receive sats into the container (positive msg.value).
   */
  setContainerDepositAmount(amount: bigint): this {
    this.containerDepositAmount = amount;
    return this;
  }

  /**
   * Get the current deposit amount.
   */
  getContainerDepositAmount(): bigint {
    return this.containerDepositAmount;
  }

  /**
   * Clear all pending satoshi transfers (used when replacing auto-derived with user overrides).
   */
  clearTransfers(): this {
    this.pendingTransfers = [];
    return this;
  }

  /**
   * Clear all pending token container FT transfers.
   */
  clearTokenContainerTransfers(): this {
    this.pendingTokenContainerTransfers = [];
    this.tokenContainerTransferInsertionCounter = this.pendingTokenContainerTransferNfts.length;
    return this;
  }

  /**
   * Clear all pending token container NFT transfers.
   */
  clearTokenContainerTransferNfts(): this {
    this.pendingTokenContainerTransferNfts = [];
    this.tokenContainerTransferInsertionCounter = this.pendingTokenContainerTransfers.length;
    return this;
  }

  /**
   * Emit an event with the given arguments.
   * Event NFT outputs are added in build() after entry NFT outputs.
   *
   * @param eventNameOrSignature - Event name (if unambiguous) or full signature e.g. "Transfer(pubkey,int)".
   */
  emitEvent(eventNameOrSignature: string, ...args: EventEmitData['args']): this {
    const eventSignature = this.resolveEventSignature(eventNameOrSignature);
    const eventDef = this.eventDefinitions.find((e) => e.signature === eventSignature);
    this.pendingEventEmits.push({ eventName: eventDef!.name, eventSignature, args });
    return this;
  }

  /** Append a compatibility event after every covenant-positioned output (e.g. an inherited internal emit). */
  emitDetachedEvent(eventNameOrSignature: string, ...args: EventEmitData['args']): this {
    const eventSignature = this.resolveEventSignature(eventNameOrSignature);
    const eventDef = this.eventDefinitions.find((e) => e.signature === eventSignature)!;
    const encodedParts = eventDef.parameters.map((parameter, i) => {
      let value = args[i];
      if (typeof value === 'string') {
        if (parameter.type === 'string') value = new TextEncoder().encode(value);
        else if (parameter.type === 'address' && value.includes(':')) value = addressToLockScript(value);
        else if (parameter.type === 'address' && /^0x[0-9a-fA-F]*$/.test(value)) value = hexToBin(value.slice(2));
        else if (isHex(value)) value = hexToBin(value);
        else throw new Error(`Invalid event argument at index ${i}: expected a hex string, got '${value}'`);
      }
      return encodePushdataValue(value, parameter.type, this.stateLayout.structs);
    });
    const commitment = new Uint8Array(encodedParts.reduce((sum, part) => sum + part.length, 0));
    let cursor = 0;
    for (const part of encodedParts) { commitment.set(part, cursor); cursor += part.length; }
    this.detachedEventReceipts.push({ eventSignature, commitment: binToHex(commitment) });
    return this;
  }

  registerDetachedEvent(definition: EventDefinitionAbi, lockingBytecode: Uint8Array): this {
    if (!this.eventDefinitions.some((event) => event.signature === definition.signature)) {
      this.eventDefinitions = [...this.eventDefinitions, definition];
    }
    this.eventNftLockingBytecodes.set(definition.signature, lockingBytecode);
    return this;
  }

  private resolveEventSignature(eventNameOrSignature: string): string {
    if (eventNameOrSignature.includes('(')) {
      const match = this.eventDefinitions.find((e) => e.signature === eventNameOrSignature);
      if (!match) throw new Error(`Unknown event signature: ${eventNameOrSignature}`);
      return match.signature;
    }
    const matches = this.eventDefinitions.filter((e) => e.name === eventNameOrSignature);
    if (matches.length === 0) throw new Error(`Unknown event: ${eventNameOrSignature}`);
    if (matches.length > 1) {
      throw new Error(
        `Ambiguous event name '${eventNameOrSignature}', use full signature: ${matches.map((m) => m.signature).join(', ')}`,
      );
    }
    return matches[0].signature;
  }

  /**
   * Add an additional output to the transaction.
   * These outputs are buffered and appended after master + data NFT + entry NFT outputs in build().
   *
   * @throws Error if attempting to create a minting NFT of this contract's category,
   * which would violate the on-chain minting NFT uniqueness check.
   */
  addOutput(output: { to: string | Uint8Array; amount: bigint; token?: Utxo['token'] }): this {
    if (output.token?.category === this.categoryId) {
      throw new Error(
        'Cannot create additional token outputs of this category in a stateful transaction. '
        + 'Token outputs for this category are managed by the covenant system.',
      );
    }
    this.pendingOutputs.push(output);
    return this;
  }

  /**
   * P5b: buffer an unpinned same-category value-chunk output (a LONG sorted-mapping value's persisted chunk).
   * Unlike addOutput, this permits the contract's own category: value chunks are 0x01 mutable NFTs the C2 write
   * covenant tolerates (no total-output bound; minting uniqueness counts only 0x02; C3 skipped for entry access).
   * They are materialized trailing (after dynamic chunks / loop entries) with their commitment fixed, so the
   * auto-derivation never sees them. Soundness is by the entry's stored sha256(value), verified on read.
   */
  setDerivedChunkOutput(
    outputIndex: number, chunk: { commitment: string; lockingBytecode: Uint8Array; categoryId?: string },
  ): boolean {
    const existing = this.derivedChunkOutputs.get(outputIndex);
    if (existing?.commitment === chunk.commitment
      && binToHex(existing.lockingBytecode) === binToHex(chunk.lockingBytecode)
      && existing.categoryId === chunk.categoryId) return false;
    this.derivedChunkOutputs.set(outputIndex, chunk);
    return true;
  }

  addValueChunkOutput(output: { to: string | Uint8Array; amount: bigint; token?: Utxo['token'] }): this {
    this.valueChunkOutputs.push(output);
    return this;
  }

  /**
   * Runtime-loop value chunks occupy the region immediately before one terminal suffix output. The builder
   * guarantees that suffix is either the required external-library sidecar recreation or a zero-value OP_RETURN
   * anchor, and inserts fee change before this region.
   */
  addLateValueChunkOutput(output: { to: string | Uint8Array; amount: bigint; token?: Utxo['token'] }): this {
    this.lateValueChunkOutputs.push(output);
    return this;
  }

  /** Insert a non-covenant output before the authenticated [late chunks][terminal suffix] region. */
  private insertBeforeLateValueSuffix(builder: TransactionBuilder, output: Output): void {
    if (this.lateValueChunkOutputs.length === 0) {
      builder.addOutput(output);
      return;
    }
    const suffixLength = this.lateValueChunkOutputs.length + 1;
    builder.outputs.splice(builder.outputs.length - suffixLength, 0, output);
  }

  /** Pin a collection's loop-entry (NEW) commitment as known-exactly, so auto-derivation skips re-deriving it. */
  pinLoopEntry(collection: string): this {
    this.pinnedLoopEntries.add(collection);
    return this;
  }

  /** Whether a collection's loop-entry (NEW) commitment is pinned (injected exactly, not trace-derived). */
  isLoopEntryPinned(collection: string): boolean {
    return this.pinnedLoopEntries.has(collection);
  }

  /** Register a collection whose value chunks are DERIVED from the trace (computed value, no direct param). */
  registerValueChunkVar(collection: string, lockingBytecode: Uint8Array): this {
    this.valueChunkVars.set(collection, lockingBytecode);
    return this;
  }

  setValueChunkLockingBytecode(collection: string, lockingBytecode: Uint8Array): this {
    if (!this.valueChunkVars.has(collection)) throw new Error(`value chunk collection not registered: ${collection}`);
    this.valueChunkVars.set(collection, lockingBytecode);
    return this;
  }

  getValueChunkVars(): Array<{ collection: string; lockingBytecode: Uint8Array }> {
    return [...this.valueChunkVars.entries()].map(([collection, lockingBytecode]) => ({ collection, lockingBytecode }));
  }

  setValueChunkRawCommitments(collection: string, commitments: string[]): this {
    this.valueChunkRawCommitments.set(collection, commitments);
    return this;
  }

  getValueChunkRawCommitments(collection: string): string[] {
    return this.valueChunkRawCommitments.get(collection) ?? [];
  }

  /** Output index where value chunks begin: after the block, dynamic chunks, and loop-entry (NEW) outputs. */
  getValueChunkOutputBase(): number {
    if (this.delegateEntriesAfterLowLevel) {
      return this.getLoopEntryOutputBase() + this._loopEntryOutputCount();
    }
    let base = this.getChunkOutputBase();
    for (const dv of this.dynamicChunkVars) base += (this.chunkRawCommitments.get(dv.name) ?? []).length;
    if (!this.batchEntriesBeforeDynamicChunks) {
      for (const lv of this.loopEntryVars) base += (this.loopEntryCommitments.get(lv.collection) ?? []).length;
    }
    return base;
  }

  /**
   * Build and finalize the transaction, creating data NFT outputs with updated commitments.
   */
  /**
   * Set a return event output for a cross-contract call.
   */
  setReturnEventOutput(categoryId: string, commitment: Uint8Array, identity = categoryId): this {
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_FAILURE_RING === '1') {
      console.error('set-return-event-output', {
        identity, categoryId, commitment: binToHex(commitment),
      });
    }
    // A contract may be called more than once in one composed transaction.
    // Category identifies the token; identity identifies the call/return slot.
    const existing = this.pendingReturnEventOutputs.findIndex((r) => r.identity === identity);
    if (existing >= 0) {
      this.pendingReturnEventOutputs[existing] = { categoryId, commitment, identity };
    } else {
      this.pendingReturnEventOutputs.push({ categoryId, commitment, identity });
    }
    return this;
  }

  /**
   * Remove all pending return event outputs (used before re-populating with derived values).
   */
  clearReturnEventOutputs(): this {
    this.pendingReturnEventOutputs = [];
    return this;
  }

  /**
   * Set a raw entry NFT commitment by slot index (from auto-derivation).
   */
  setEntryRawCommitment(slotIndex: number, commitment: string): this {
    if (!Number.isInteger(slotIndex) || slotIndex < 0) {
      throw new Error(`Invalid slot index ${slotIndex}: must be a non-negative integer`);
    }
    if (!/^([0-9a-f]{2})*$/i.test(commitment)) {
      throw new Error(`Invalid hex string for entry raw commitment at slot ${slotIndex}`);
    }
    this.entryRawCommitments.set(slotIndex, commitment);
    return this;
  }

  /** Mark an entry slot's commitment as known exactly (injected), so auto-derivation must not re-derive it. */
  pinEntrySlot(slotIndex: number): this { this.pinnedEntrySlots.add(slotIndex); return this; }

  /** Whether slot's commitment was pinned via pinEntrySlot (auto-derivation should skip it). */
  isEntrySlotPinned(slotIndex: number): boolean { return this.pinnedEntrySlots.has(slotIndex); }

  /**
   * Set the ordered chunk commitments for a dynamic-storage var (from auto-derivation). The number of
   * commitments determines how many trailing chunk NFT outputs are created.
   */
  setChunkRawCommitments(varName: string, commitments: string[]): this {
    this.chunkRawCommitments.set(varName, commitments);
    return this;
  }

  getDynamicChunkVars(): Array<{ name: string; type: string; lockingBytecode: Uint8Array }> {
    return this.dynamicChunkVars;
  }

  getChunkRawCommitments(varName: string): string[] {
    return this.chunkRawCommitments.get(varName) ?? [];
  }

  /**
   * Output index where chunk NFTs begin: the block-layout blockSize (chunks are trailing outputs at
   * OP_INPUTINDEX + blockSize + i, matching the dynamic-write covenant). Falls back to the computed
   * trailing position when no block layout is present.
   */
  getChunkOutputBase(): number {
    // New write chunks come AFTER the preserved iteration-entry outputs (read-only co-spent chunks /
    // collection-iter entries), which occupy [blockSize, blockSize+count) to match their input indices.
    let base = this.blockLayout?.trailingBase
      ?? this.blockLayout?.blockSize
      ?? this.getEventOutputBase() + this.getEventOutputCount();
    // blockSize reserves the returnEvent slot, but a plain send does NOT materialize it (only .emitReturn(), which
    // populates pendingReturnEventOutputs), so the trailing chunks sit one output lower. Match the covenant's
    // runtime returnOutputIdx<0 adjustment in emitDynamicWriteVerification.
    const hasReturnEventSlot = this.blockLayout?.slots.some((s) => s.kind === 'returnEvent') ?? false;
    if (this.blockLayout?.trailingBase === undefined
      && hasReturnEventSlot && this.pendingReturnEventOutputs.length === 0) base -= 1;
    // build() preserves low-level-call UTXOs before the trailing dynamic region.
    // Delegate bytecode likewise anchors trailing storage after its own co-spent
    // implementation block rather than overlapping that block's outputs.
    const lowLevelCallOutputCount = this.blockLayout?.slots.some((slot) => slot.kind === 'lowLevelCall')
      ? 0
      : this.lowLevelCallUtxoGroups.reduce(
        (sum, g) => sum + 1 + g.dataNftUtxos.length, 0,
      ) + this.lowLevelCallRawInputs.length;
    // External call blocks and their tail return events are emitted before local dynamic chunks, but they are
    // outside this function's blockLayout. Include their physical span so trace extraction observes the same
    // output indices that the compiler's dynamic-write covenant verifies.
    const externalCallOutputCount = this.externalCallUtxoGroups.reduce((sum, group) => {
      if (group.sharedGroupIndex !== undefined) return sum;
      return sum + (group.blockInputs?.length ?? 1 + group.dataNftUtxos.length);
    }, 0);
    const externalReturnOutputCount = this.tailReturnEventOutputs()
      .filter((returnEvent) => returnEvent.categoryId !== this.categoryId).length;
    const trailingBase = base + externalCallOutputCount + externalReturnOutputCount
      + lowLevelCallOutputCount + this.iterationEntryInputs.length;
    if (this.delegateEntriesAfterLowLevel) {
      return trailingBase + this._loopEntryOutputCount() + this._valueChunkOutputCount()
        + this.pendingOutputs.length;
    }
    return trailingBase + (this.batchEntriesBeforeDynamicChunks ? this._loopEntryOutputCount() : 0);
  }

  private _dynamicChunkOutputCount(): number {
    let n = 0;
    for (const dv of this.dynamicChunkVars) n += (this.chunkRawCommitments.get(dv.name) ?? []).length;
    return n;
  }

  private _valueChunkOutputCount(): number {
    return this.valueChunkOutputs.length
      + [...this.valueChunkRawCommitments.values()].reduce((sum, commitments) => sum + commitments.length, 0);
  }

  getLoopEntryVars(): Array<{ collection: string; lockingBytecode: Uint8Array; categoryId?: string }> {
    return this.loopEntryVars;
  }

  getLoopEntryCommitments(collection: string): string[] {
    return this.loopEntryCommitments.get(collection) ?? [];
  }

  setLoopEntryLockingBytecode(collection: string, lockingBytecode: Uint8Array): this {
    const variable = this.loopEntryVars.find((candidate) => candidate.collection === collection);
    if (!variable) throw new Error(`loop entry collection not registered: ${collection}`);
    variable.lockingBytecode = lockingBytecode;
    return this;
  }

  /**
   * Set the ordered entry commitments for a loop mapping write (from auto-derivation). The number of commitments
   * determines how many trailing entry NFT outputs are created (the runtime iteration count N).
   */
  setLoopEntryCommitments(collection: string, commitments: string[]): this {
    const required = this.requiredLoopEntryCounts.get(collection);
    this.loopEntryCommitments.set(collection, required === undefined ? commitments : commitments.slice(0, required));
    return this;
  }

  requireLoopEntryCount(collection: string, count: number): this {
    this.requiredLoopEntryCounts.set(collection, count);
    const existing = this.loopEntryCommitments.get(collection);
    if (existing && existing.length > count) this.loopEntryCommitments.set(collection, existing.slice(0, count));
    return this;
  }

  getRequiredLoopEntryCount(collection: string): number {
    return this.requiredLoopEntryCounts.get(collection) ?? 0;
  }

  private _loopEntryOutputCount(): number {
    let n = 0;
    for (const lv of this.loopEntryVars) n += (this.loopEntryCommitments.get(lv.collection) ?? []).length;
    return n;
  }

  /**
   * Output index where loop entry NFTs begin. They share the trailing region with dynamic chunks (mutually
   * exclusive in a given function by construction), placed after any chunk outputs.
   */
  getLoopEntryOutputBase(): number {
    if (this.batchEntriesBeforeDynamicChunks) return this.getChunkOutputBase() - this._loopEntryOutputCount();
    if (this.delegateEntriesAfterLowLevel) {
      return this.getChunkOutputBase() - this.pendingOutputs.length
        - this._valueChunkOutputCount() - this._loopEntryOutputCount();
    }
    return this.getChunkOutputBase() + this._dynamicChunkOutputCount();
  }

  /**
   * Set a raw event NFT commitment by emit index (from auto-derivation).
   */
  setEventRawCommitment(emitIndex: number, commitment: string): this {
    if (!Number.isInteger(emitIndex) || emitIndex < 0) {
      throw new Error(`Invalid emit index ${emitIndex}: must be a non-negative integer`);
    }
    if (!/^([0-9a-f]{2})*$/i.test(commitment)) {
      throw new Error(`Invalid hex string for event raw commitment at emit index ${emitIndex}`);
    }
    this.eventRawCommitments.set(emitIndex, commitment);
    return this;
  }

  /**
   * Add an event placeholder for probe transactions (empty commitment).
   */
  addEventPlaceholder(eventSignature: string, emitIndex: number): this {
    this.pendingEventPlaceholders.push({ eventSignature, emitIndex });
    return this;
  }

  /**
   * Set the maximum fee in satoshis for the transaction.
   */
  setMaximumFeeSatoshis(maxFee: bigint): void {
    this._maximumFeeSatoshis = maxFee;
  }

  /**
   * Get the master input index for an external outState group.
   */
  getExternalOutStateMasterInputIndex(groupIdx: number): number {
    let base = 1 + this.dataNftUtxos.length + this.readOnlyDataNftUtxos.length + this.blockhashCoSpendUtxos.length
      + this.keccakComputeCoSpendUtxos.length + this.ecrecoverComputeCoSpendUtxos.length;
    for (let i = 0; i < groupIdx; i++) {
      base += 1 + this.externalOutStateUtxoGroups[i].dataNftUtxos.length
        + (this.externalOutStateUtxoGroups[i].keccakInputs?.length ?? 0);
    }
    return base;
  }

  /**
   * Get the output index where outState group's master NFT output starts.
   */
  getExternalOutStateOutputBase(groupIdx: number): number {
    let base = 1 + this.requiredNftIndices.length + this.readOnlyDataNftUtxos.length + this.blockhashCoSpendUtxos.length
      + this.keccakComputeCoSpendUtxos.length + this.ecrecoverComputeCoSpendUtxos.length;
    for (let i = 0; i < groupIdx; i++) {
      base += 1 + this.externalOutStateUtxoGroups[i].dataNftUtxos.length
        + (this.externalOutStateUtxoGroups[i].keccakInputs?.length ?? 0);
    }
    return base;
  }

  /**
   * Get the master input index for an external call group.
   */
  /**
   * Absolute input index of a co-spent callee identity anchor, by its position in the anchor band. Resolved from
   * the materialized input list rather than reconstructed from band widths: the anchors are appended last, after
   * every layout-driven band, so only the built ordering is authoritative.
   */
  getIdentityAnchorInputIndex(anchorIdx: number): number {
    const anchor = this.externalIdentityAnchorUtxos[anchorIdx];
    if (!anchor) return -1;
    return this.allInputs.findIndex((input) => input.txid === anchor.txid && input.vout === anchor.vout);
  }

  getExternalCallMasterInputIndex(groupIdx: number): number {
    // Resolve an already-positioned master directly. This is authoritative for
    // delegate graphs, where implementation bands are interleaved with nested
    // callees and cannot be reconstructed from dense resource counts.
    const master = this.externalCallUtxoGroups[groupIdx]?.masterUtxo;
    const found = master && this.allInputs.findIndex((input) => input.txid === master.txid
      && input.vout === master.vout);
    if (found !== undefined && found >= 0) return found;
    let base = 1 + this.dataNftUtxos.length + this.readOnlyDataNftUtxos.length + this.blockhashCoSpendUtxos.length
      + this.keccakComputeCoSpendUtxos.length + this.ecrecoverComputeCoSpendUtxos.length;
    // Skip outState inputs
    for (const g of this.externalOutStateUtxoGroups) {
      base += 1 + g.dataNftUtxos.length + (g.keccakInputs?.length ?? 0);
    }
    // Loop external-call case: the read array's chunk run is co-spent BEFORE the callees (see _buildInputs),
    // so callee inputs are shifted by the chunk count. Zero when no dynamic-array read is co-spent.
    base += this.iterationEntryInputs.length;
    for (let i = 0; i < groupIdx; i++) {
      const g = this.externalCallUtxoGroups[i];
      base += g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length;
    }
    return base;
  }

  /**
   * Get the output index where external call group's master NFT output starts.
   * Output layout: master(1) + A's dataNfts + A's readOnlyNfts + preceding groups' (1+dataNfts).
   */
  getExternalCallOutputBase(groupIdx: number): number {
    const requested = this.externalCallUtxoGroups[groupIdx];
    if (requested?.sharedGroupIndex !== undefined) groupIdx = requested.sharedGroupIndex;
    let base = 1 + this.requiredNftIndices.length + this.readOnlyDataNftUtxos.length + this.blockhashCoSpendUtxos.length
      + this.keccakComputeCoSpendUtxos.length + this.ecrecoverComputeCoSpendUtxos.length;
    // Skip outState outputs
    for (const g of this.externalOutStateUtxoGroups) {
      base += 1 + g.dataNftUtxos.length + (g.keccakInputs?.length ?? 0);
    }
    // Loop external-call case: the read array's chunk preservation outputs precede the callee outputs
    // (see build()), shifting them by the chunk count. Zero when no dynamic-array read is co-spent.
    base += this.iterationEntryInputs.length;
    const associatedDelegates = new Set(this.externalCallUtxoGroups
      .map((group) => group.delegateCallGroupIndex)
      .filter((index): index is number => index !== undefined));
    if (this.delegateEntriesAfterLowLevel) {
      base += this.pendingReturnEventOutputs.filter((r) => r.categoryId === this.categoryId).length;
      this.lowLevelCallUtxoGroups.forEach((group, index) => {
        if (group.callMode === 'delegatecall' && !associatedDelegates.has(index)) {
          base += 1 + group.dataNftUtxos.length;
        }
      });
    }
    for (let i = 0; i < groupIdx; i++) {
      const g = this.externalCallUtxoGroups[i];
      if (g.sharedGroupIndex !== undefined) continue;
      // Use full block size when available
      base += g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length;
      // A proxied participant's implementation output follows that participant block in both the legacy and
      // compiler-route layouts. Compiler routes move the implementation INPUT into a leading band, but their
      // outputs remain interleaved; omitting it makes every later participant output base one slot too low.
      if (g.delegateCallGroupIndex !== undefined) {
        const delegate = this.lowLevelCallUtxoGroups[g.delegateCallGroupIndex];
        if (delegate?.callMode === 'delegatecall') base += 1 + delegate.dataNftUtxos.length;
      }
    }
    return base;
  }

  /**
   * Get the master input index for a low-level call group.
   */
  getLowLevelCallUtxoGroups(): readonly ExternalCallUtxoGroup[] {
    return this.lowLevelCallUtxoGroups;
  }

  getLowLevelCallMasterInputIndex(groupIdx: number): number {
    const target = this.lowLevelCallUtxoGroups[groupIdx]?.masterUtxo;
    if (target) {
      const exact = this.allInputs.findIndex((input) => input?.txid.toLowerCase() === target.txid.toLowerCase()
        && input.vout === target.vout);
      if (exact >= 0) return exact;
    }
    if (this.lowLevelCallInputBase !== undefined) {
      let positionedBase = this.lowLevelCallInputBase;
      for (let i = 0; i < groupIdx; i++) {
        positionedBase += 1 + this.lowLevelCallUtxoGroups[i].dataNftUtxos.length;
      }
      return positionedBase;
    }
    let base = 1 + this.dataNftUtxos.length + this.readOnlyDataNftUtxos.length + this.blockhashCoSpendUtxos.length
      + this.keccakComputeCoSpendUtxos.length + this.ecrecoverComputeCoSpendUtxos.length;
    // Skip outState inputs
    for (const g of this.externalOutStateUtxoGroups) {
      base += 1 + g.dataNftUtxos.length + (g.keccakInputs?.length ?? 0);
    }
    // Skip external call inputs (use full block size when available)
    for (const g of this.externalCallUtxoGroups) {
      base += g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length;
    }
    // Skip the main block's output-only funder inputs (event/transfer): they sit inside the proxy block,
    // before the low-level call inputs. A delegatecall'd impl that emits events reserves such slots here.
    for (const s of this.blockLayout?.slots ?? []) {
      if (s.kind === 'event' || s.kind === 'transfer' || s.kind === 'tcTransfer'
        || (s.kind === 'entry' && !this.delegateEntriesAfterLowLevel)) base += 1;
    }
    // Skip preceding low-level call groups
    for (let i = 0; i < groupIdx; i++) {
      base += 1 + this.lowLevelCallUtxoGroups[i].dataNftUtxos.length;
    }
    return base;
  }

  /**
   * Build and finalize the transaction, creating data NFT outputs with updated commitments.
   * This method is idempotent - each call creates a fresh TransactionBuilder.
   */
  /**
   * Configure the external-library side-car UTXO to co-spend (appended as the last input by build()).
   * blob = the library script; salt = the contract's token category (branded) or zero (shared). Must be
   * called before auto-derivation so the derivation probes include the side-car.
   */
  setSidecar(utxo: Utxo, blob: Uint8Array, salt: Uint8Array): void {
    const redeem = buildSidecarRedeem(blob, salt);
    const lock = sidecarLockingBytecode(blob, salt);
    this.sidecarUtxo = {
      ...utxo,
      unlocker: {
        generateUnlockingBytecode: () => scriptToBytecode([redeem]),
        generateLockingBytecode: () => lock,
      },
    };
  }

  /** Optional nLocktime for the final tx, e.g. the block.* freshness `require(tx.time >= number)`. */
  locktimeOverride?: number;

  setLocktime(locktime: number): this {
    this.locktimeOverride = locktime;
    return this;
  }

  build(): TransactionBuilder {
    // Allow implicit NFT burn when entries are being deleted
    // Apply max fee override if set (user-specified via withMaxFee takes precedence)
    // CovenantTransactionBuilder skips the inner fee check - it can't understand
    // covenant-managed outputs. The STB performs its own fee check in send().
    const baseOpts = this._maximumFeeSatoshis !== undefined
      ? { ...this.builderOptions, maximumFeeSatoshis: this._maximumFeeSatoshis }
      : { ...this.builderOptions };
    // Dynamic-storage writes consume old chunk NFTs (mint/burn to match the new value), entry deletes burn
    // entries, and loop mapping writes mint new entry NFTs from the master - all intended implicit mint/burns.
    const opts = (this.entryDeletes.size > 0 || this.dynamicChunkInputs.length > 0
      || this.dynamicChunkVars.length > 0 || this.loopEntryVars.length > 0
      // transferNft may change an NFT's capability/commitment, which the generic transaction builder models as
      // a burn plus mint. The token-container covenant (and, in graph mode, the callManifest settlement row)
      // authenticates the exact transition, so the generic identity-preservation heuristic must not pre-empt
      // the derivation probe before those checks execute.
      || this.pendingTokenContainerTransferNfts.length > 0)
      ? { ...baseOpts, allowImplicitNftBurn: true }
      : baseOpts;
    // Compiler-route delegate inputs can live in a leading implementation band while their recreations follow
    // all external participant blocks and derived INSERT outputs. Patch the shared unlockers before inputs are
    // registered, using the exact output ordering this build method emits.
    const relocatedDelegateOutputBases = new Map<number, { value: number }>();
    if (this.delegateEntriesAfterLowLevel || this.compilerRouteDelegateBlock) {
      const associated = new Set(this.externalCallUtxoGroups
        .map((group) => group.delegateCallGroupIndex)
        .filter((index): index is number => index !== undefined));
      let outputCursor = this.compilerRouteDelegateBlock && this.blockLayout
        ? this.blockLayout.blockSize
        : 1 + this.requiredNftIndices.length + this.readOnlyDataNftUtxos.length
          + this.blockhashCoSpendUtxos.length + this.keccakComputeCoSpendUtxos.length
          + this.ecrecoverComputeCoSpendUtxos.length + this.iterationEntryInputs.length
          + this.externalOutStateUtxoGroups.reduce(
            (sum, group) => sum + 1 + group.dataNftUtxos.length + (group.keccakInputs?.length ?? 0), 0,
          );
      const patchDelegate = (groupIndex: number, outputBase: number): number => {
        const group = this.lowLevelCallUtxoGroups[groupIndex];
        if (!group || group.callMode !== 'delegatecall') return outputBase;
        const masterInputIndex = this.getLowLevelCallMasterInputIndex(groupIndex);
        const outputBaseRef = relocatedDelegateOutputBases.get(groupIndex) ?? { value: outputBase };
        relocatedDelegateOutputBases.set(groupIndex, outputBaseRef);
        group.dataNftUtxos.forEach((nftUtxo, nftIndex) => {
          const relocated = createRelocatedDataNftUnlocker(
            group.externalContract.inner,
            masterInputIndex,
            outputBase + 1 + nftIndex,
            group.categoryId,
          );
          nftUtxo.unlocker = {
            ...relocated,
            generateUnlockingBytecode: (options) => createRelocatedDataNftUnlocker(
              group.externalContract.inner,
              masterInputIndex,
              outputBaseRef.value + 1 + nftIndex,
              group.categoryId,
            ).generateUnlockingBytecode(options),
          };
        });
        return outputBase + 1 + group.dataNftUtxos.length;
      };
      this.lowLevelCallUtxoGroups.forEach((group, groupIndex) => {
        if (group.callMode === 'delegatecall' && !associated.has(groupIndex)) {
          outputCursor = patchDelegate(groupIndex, outputCursor);
        }
      });
      this.externalCallUtxoGroups.forEach((group) => {
        if (group.sharedGroupIndex !== undefined) return;
        outputCursor += group.blockInputs?.length ?? 1 + group.dataNftUtxos.length;
        outputCursor += this.externalCallEntryInserts.filter((insert, handle) => (
          insert.categoryId === group.categoryId && insert.commitment !== ''
          && !group.plannedEntryInsertHandles?.includes(handle)
        )).length;
        if (group.delegateCallGroupIndex !== undefined) {
          outputCursor = patchDelegate(group.delegateCallGroupIndex, outputCursor);
        }
        this.externalCallUtxoGroups.forEach((shared) => {
          if (shared.sharedGroupIndex === this.externalCallUtxoGroups.indexOf(group)
            && shared.delegateCallGroupIndex !== undefined) {
            outputCursor = patchDelegate(shared.delegateCallGroupIndex, outputCursor);
          }
        });
      });
    }
    const builder = new CovenantTransactionBuilder(opts);
    // X56. Delegate return events held back until after the implementation's own event outputs. Empty unless
    // `delegateReturnEventAfterEvents` is set, i.e. unless the co-spent implementation emits AND returns.
    let deferredDelegateReturnEvents: Array<{ categoryId: string; commitment: Uint8Array }> = [];
    if (this.locktimeOverride !== undefined) builder.locktime = this.locktimeOverride;
    const seenInputs = new Map<string, number>();
    for (let index = 0; index < this.allInputs.length; index++) {
      const input = this.allInputs[index];
      const id = `${input.txid.toLowerCase()}:${input.vout}`;
      const first = seenInputs.get(id);
      if (first !== undefined) {
        const roles = (candidate: UnlockableUtxo): string[] => {
          const out: string[] = [];
          const matches = (utxo: Utxo | undefined): boolean => !!utxo
            && utxo.txid.toLowerCase() === candidate.txid.toLowerCase() && utxo.vout === candidate.vout;
          if (matches(this.masterUtxo)) out.push('master');
          this.dataNftUtxos.forEach((utxo, i) => { if (matches(utxo)) out.push(`dataNft:${i}`); });
          this.iterationEntryInputs.forEach((utxo, i) => {
            if (matches(utxo)) out.push(`iterationEntry:${i}`);
          });
          this.externalCallUtxoGroups.forEach((group, groupIndex) => {
            if (matches(group.masterUtxo)) out.push(`external:${groupIndex}:master`);
            group.dataNftUtxos.forEach((utxo, nftIndex) => {
              if (matches(utxo)) out.push(`external:${groupIndex}:dataNft:${nftIndex}`);
            });
          });
          this.lowLevelCallUtxoGroups.forEach((group, groupIndex) => {
            if (matches(group.masterUtxo)) out.push(`lowLevel:${groupIndex}:master`);
            group.dataNftUtxos.forEach((utxo, nftIndex) => {
              if (matches(utxo)) out.push(`lowLevel:${groupIndex}:dataNft:${nftIndex}`);
            });
          });
          this.funderUtxos.forEach((utxo, i) => { if (matches(utxo)) out.push(`funder:${i}`); });
          this.entryNfts.forEach((entry, i) => { if (matches(entry.utxo)) out.push(`entry:${i}`); });
          return out;
        };
        throw new Error(
          `Duplicate stateful input ${id} at ${first}/${index}; roles `
          + `${roles(this.allInputs[first]).join(',') || 'other'} / ${roles(input).join(',') || 'other'}`,
        );
      }
      seenInputs.set(id, index);
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
      const missingUnlockers = this.allInputs.map((input, index) => ({ input, index }))
        .filter(({ input }) => !('unlocker' in input) || input.unlocker === undefined);
      if (missingUnlockers.length > 0) {
        console.error('stateful-inputs-missing-unlockers', missingUnlockers.map(({ input, index }) => {
          const same = (candidate: Utxo | undefined): boolean => candidate?.txid === input.txid
            && candidate.vout === input.vout;
          const roles: string[] = [];
          this.externalCallUtxoGroups.forEach((group, groupIndex) => {
            if (same(group.masterUtxo)) roles.push(`external:${groupIndex}:master`);
            group.blockInputs?.forEach((candidate, slot) => {
              if (same(candidate)) roles.push(`external:${groupIndex}:block:${slot}`);
            });
          });
          this.lowLevelCallUtxoGroups.forEach((group, groupIndex) => {
            if (same(group.masterUtxo)) roles.push(`lowLevel:${groupIndex}:master`);
          });
          return {
            index, outpoint: `${input.txid}:${input.vout}`, category: input.token?.category, roles,
          };
        }));
      }
    }
    builder.addInputs(this.allInputs);
    // Co-spend the external-library side-car as the LAST input (the covenant's library loader reads it via
    // OP_INPUTBYTECODE of the last input). Present in derivation probes and the final tx alike.
    if (this.sidecarUtxo) builder.addInputs([this.sidecarUtxo]);

    // Read current state from the provided data NFT commitments
    const currentState: Record<
    string, StateValue
    > = {};
    for (let i = 0; i < this.requiredNftIndices.length; i++) {
      const nftIdx = this.requiredNftIndices[i];
      const nftUtxo = this.dataNftUtxos[i];
      if (nftUtxo?.token?.nft?.commitment) {
        const parsed = parsePushdataCommitment(nftUtxo.token.nft.commitment, this.stateLayout, nftIdx);
        for (const [key, value] of Object.entries(parsed)) {
          currentState[key] = value;
        }
      }
    }

    // Apply state updates
    for (const [name, value] of this.stateUpdates) {
      currentState[name] = value;
    }

    // Create master UTXO output (preserving locking bytecode and token)
    builder.addOutput({
      to: this.masterUtxo.unlocker.generateLockingBytecode(),
      amount: this.masterUtxo.satoshis,
      token: this.masterUtxo.token,
    });

    // Create data NFT outputs with updated commitments (only for required NFTs)
    for (let i = 0; i < this.requiredNftIndices.length; i++) {
      const nftIdx = this.requiredNftIndices[i];
      const nftUtxo = this.dataNftUtxos[i];

      const commitment = this.stateRawCommitments.get(nftIdx) ?? buildPushdataCommitment(
        this.stateLayout, currentState, nftIdx, this.builderOptions.provider.consensusLimits?.maximumNftCommitmentBytes,
      );

      builder.addOutput({
        to: nftUtxo.unlocker.generateLockingBytecode(),
        amount: nftUtxo.satoshis,
        token: {
          amount: nftUtxo.token?.amount ?? 0n,
          category: this.categoryId,
          nft: {
            capability: nftUtxo.token?.nft?.capability ?? 'mutable',
            commitment,
          },
        },
      });
    }

    // Create read-only data NFT outputs (commitment preserved unchanged)
    for (const roUtxo of this.readOnlyDataNftUtxos) {
      builder.addOutput({
        to: roUtxo.unlocker.generateLockingBytecode(),
        amount: roUtxo.satoshis,
        token: roUtxo.token,
      });
    }

    // Create blockhash (n->hash) oracle outputs (self-preserving recreate; mirrors the readOnlyDataNft slot).
    for (const bhUtxo of this.blockhashCoSpendUtxos) {
      builder.addOutput({
        to: bhUtxo.unlocker.generateLockingBytecode(),
        amount: bhUtxo.satoshis,
        token: bhUtxo.token,
      });
    }

    // Create keccak256 compute side-car outputs (right after blockhash, matching the keccakSideCar slots): each
    // recreation carries this call's computed result R_i = keccak256(preimage_i) in a mutable NFT commitment.
    this.keccakComputeCoSpendUtxos.forEach((kUtxo, i) => {
      builder.addOutput({
        to: kUtxo.unlocker.generateLockingBytecode(),
        amount: kUtxo.satoshis,
        token: {
          category: kUtxo.token?.category ?? this.categoryId,
          amount: kUtxo.token?.amount ?? 0n,
          nft: { capability: 'mutable', commitment: this.keccakComputeCommitments[i] ?? '' },
        },
      });
    });

    // Dynamic keccak loop: recreate the N trailing side-cars, each with its iteration result R_i. In the MVP
    // layout (no other front-region slots) these sit at [blockSize, blockSize+N) - right after the data NFTs.
    for (const rec of this.keccakLoopRecreates) builder.addOutput(rec);

    // ecrecover recovery-pair recreations (right after the keccak side-cars, matching the ecrecoverSideCar slots):
    // A commits H_A (the A->B binding hash), B commits the recovered pubkey Q. Built by buildEcrecoverComputeSidecars.
    for (const rec of this.ecrecoverComputeRecreates) builder.addOutput(rec);

    // Create external outState outputs (same pattern as external call preservation)
    for (const group of this.externalOutStateUtxoGroups) {
      // B's master output: preserved unchanged
      const bMaster = group.masterUtxo as UnlockableUtxo;
      builder.addOutput({
        to: bMaster.unlocker.generateLockingBytecode(),
        amount: bMaster.satoshis,
        token: bMaster.token,
      });

      // B's data NFT outputs with state updates
      const bStateUpdates = this.externalCallStateUpdates.get(group.categoryId);
      const bCurrentState: Record<
      string, StateValue
      > = {};

      for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
        const nftIdx = group.requiredDataNftIndices[i];
        const nftUtxo = group.dataNftUtxos[i];
        if (nftUtxo?.token?.nft?.commitment) {
          const parsed = parsePushdataCommitment(nftUtxo.token.nft.commitment, group.stateLayout, nftIdx);
          for (const [key, value] of Object.entries(parsed)) {
            bCurrentState[key] = value;
          }
        }
      }

      if (bStateUpdates) {
        for (const [name, value] of bStateUpdates) {
          bCurrentState[name] = value;
        }
      }

      for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
        const nftIdx = group.requiredDataNftIndices[i];
        const nftUtxo = group.dataNftUtxos[i];
        const commitment = buildPushdataCommitment(
          group.stateLayout, bCurrentState, nftIdx,
          this.builderOptions.provider.consensusLimits?.maximumNftCommitmentBytes,
        );

        builder.addOutput({
          to: nftUtxo.unlocker.generateLockingBytecode(),
          amount: nftUtxo.satoshis,
          token: {
            amount: nftUtxo.token?.amount ?? 0n,
            category: group.categoryId,
            nft: {
              capability: nftUtxo.token?.nft?.capability ?? 'mutable',
              commitment,
            },
          },
        });
      }

      // B's keccak256 side-car recreations (after B's data NFT outputs, matching the input order).
      for (const rec of group.keccakRecreates ?? []) builder.addOutput(rec);
    }

    // Loop external-call case: the read array's chunk run is co-spent BEFORE the callees (input order
    // master..chunk..callees), and the covenant verifies callee output==input by index, so the chunk
    // preservation outputs must precede the callee outputs here too. Emit them now; the trailing
    // iteration-entry block below skips itself when this fired.
    const loopChunkBeforeCallees = this.iterationEntryInputs.length > 0 && this.externalCallUtxoGroups.length > 0;
    if (loopChunkBeforeCallees) {
      for (const iterUtxo of this.iterationEntryInputs) {
        builder.addOutput({
          to: iterUtxo.unlocker.generateLockingBytecode(),
          amount: iterUtxo.satoshis,
          token: {
            amount: iterUtxo.token?.amount ?? 0n,
            category: this.categoryId,
            nft: { capability: 'mutable', commitment: iterUtxo.token?.nft?.commitment ?? '' },
          },
        });
      }
    }

    // A delegate implementation must occupy the same absolute output index as its input: its covenant binds
    // that input directly after the proxy master/data region and self-preserves at OP_INPUTINDEX. Nested callees
    // invoked by the implementation follow this preservation band.
    const associatedDelegateOutputs = new Set(this.externalCallUtxoGroups
      .map((group) => group.delegateCallGroupIndex)
      .filter((index): index is number => index !== undefined));
    const appendDelegateGroupOutputs = (groupIndex: number): void => {
      const group = this.lowLevelCallUtxoGroups[groupIndex];
      if (!group || group.callMode !== 'delegatecall') return;
      const bMaster = group.masterUtxo as UnlockableUtxo;
      builder.addOutput({
        to: bMaster.unlocker.generateLockingBytecode(), amount: bMaster.satoshis, token: bMaster.token,
      });
      for (const nftUtxo of group.dataNftUtxos) {
        builder.addOutput({
          to: nftUtxo.unlocker.generateLockingBytecode(), amount: nftUtxo.satoshis, token: nftUtxo.token,
        });
      }
    };
    if (this.delegateEntriesAfterLowLevel) {
      this.lowLevelCallUtxoGroups.forEach((_group, groupIndex) => {
        if (!associatedDelegateOutputs.has(groupIndex)) appendDelegateGroupOutputs(groupIndex);
      });
      const proxyReturnEvents = this.pendingReturnEventOutputs
        .filter((returnEvent) => returnEvent.categoryId === this.categoryId);
      if (this.delegateReturnEventAfterEvents) {
        deferredDelegateReturnEvents.push(...proxyReturnEvents);
      } else {
        for (const returnEvent of proxyReturnEvents) {
          builder.addOutput({
            to: new Uint8Array([0x51]), amount: 800n,
            token: {
              amount: 0n, category: returnEvent.categoryId,
              nft: { capability: 'none', commitment: binToHex(returnEvent.commitment) },
            },
          });
        }
      }
    }

    // Create external call outputs (B's master preserved + B's data NFTs with updated state)
    for (let groupIndex = 0; groupIndex < this.externalCallUtxoGroups.length; groupIndex++) {
      const group = this.externalCallUtxoGroups[groupIndex];
      if (group.sharedGroupIndex !== undefined) continue;
      // B's master output: preserved unchanged
      const bMaster = group.masterUtxo as UnlockableUtxo;
      if (group.compilerRoute && group.delegateCallGroupIndex !== undefined) {
        // A routed delegate's proxy master is displaced from its packed physical block. Slot zero is only a
        // balanced spacer; the master covenant requires the real minting NFT to be recreated at INPUTINDEX.
        builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
      } else {
        builder.addOutput({
          to: bMaster.unlocker.generateLockingBytecode(),
          amount: bMaster.satoshis,
          token: bMaster.token,
        });
      }

      // Plain .staticcall / .delegatecall groups preserve exact input commitments. A compiler-routed
      // proxy group still owns a balanced output block (entries, events, and its return slot), even
      // when its implementation is invoked with delegatecall, so it must continue through the full
      // block materialization below.
      if (!group.compilerRoute
        && (group.callMode === 'staticcall' || group.callMode === 'delegatecall')) {
        for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
          const nftUtxo = group.dataNftUtxos[i];
          builder.addOutput({
            to: nftUtxo.unlocker.generateLockingBytecode(),
            amount: nftUtxo.satoshis,
            token: nftUtxo.token,
          });
        }
        continue;
      }

      // B's data NFT outputs with state updates (regular and .call modes)
      const bStateUpdates = this.externalCallStateUpdates.get(group.categoryId);
      const bCurrentState: Record<
      string, StateValue
      > = {};

      // Read current state from B's data NFTs
      for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
        const nftIdx = group.requiredDataNftIndices[i];
        const nftUtxo = group.dataNftUtxos[i];
        if (nftUtxo?.token?.nft?.commitment) {
          const parsed = parsePushdataCommitment(nftUtxo.token.nft.commitment, group.stateLayout, nftIdx);
          for (const [key, value] of Object.entries(parsed)) {
            bCurrentState[key] = value;
          }
        }
      }

      // Apply B's state overrides
      if (bStateUpdates) {
        for (const [name, value] of bStateUpdates) {
          bCurrentState[name] = value;
        }
      }

      const externalDynamicChunks: Output[] = [];
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
        console.error('external-dynamic-plan', {
          categoryId: group.categoryId,
          functionName: group.functionName,
          compilerRoute: group.compilerRoute?.abiFunction.name,
          logicalSelectors: group.compilerRoute?.logicalSelectors,
          blockInputs: group.blockInputs?.length,
          blockSize: group.blockLayout?.blockSize,
          trailingBase: group.blockLayout?.trailingBase,
          sharedGroupIndex: group.sharedGroupIndex,
          dynamicStateValues: Object.keys(group.dynamicStateValues ?? {}),
          stateUpdates: [...(bStateUpdates?.keys() ?? [])],
        });
      }
      for (const variable of group.stateLayout.variables) {
        if (!variable.dynamic) continue;
        const value = group.dynamicStateValues?.[variable.name]
          ?? bStateUpdates?.get(variable.name);
        if (value === undefined) continue;
        const raw = typeof value === 'string' ? utf8ToBin(value)
          : value instanceof Uint8Array ? value : undefined;
        if (!raw) {
          throw new Error(
            `External dynamic state '${variable.name}' requires a canonical bytes/string value`,
          );
        }
        const collectionHash = computeCollectionHash(
          dynamicChunkSignature(variable.name, variable.type),
        );
        const lockingBytecode = scriptToLockingBytecode(
          buildEntryNftCovenantScript(hexToBin(group.categoryId), collectionHash),
          group.externalContract?.inner?.addressType ?? 'p2sh32',
        );
        for (const [index, chunk] of splitValueIntoChunks(raw).entries()) {
          const output: Output = {
            to: lockingBytecode,
            amount: 1200n,
            token: {
              amount: 0n,
              category: group.categoryId,
              nft: {
                capability: 'mutable',
                commitment: buildChunkCommitment(index, chunk),
              },
            },
          };
          output.amount = BigInt(Math.max(1200, calculateDust(output)));
          externalDynamicChunks.push(output);
        }
      }

      const displacedRouteStateOutputs: Output[] = [];
      // Create B's data NFT outputs with updated commitments
      for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
        const nftIdx = group.requiredDataNftIndices[i];
        const nftUtxo = group.dataNftUtxos[i];
        const commitment = buildPushdataCommitment(
          group.stateLayout, bCurrentState, nftIdx,
          this.builderOptions.provider.consensusLimits?.maximumNftCommitmentBytes,
        );

        const stateOutput: Output = {
          to: nftUtxo.unlocker.generateLockingBytecode(),
          amount: nftUtxo.satoshis,
          token: {
            amount: nftUtxo.token?.amount ?? 0n,
            category: group.categoryId,
            nft: {
              capability: nftUtxo.token?.nft?.capability ?? 'mutable',
              commitment,
            },
          },
        };
        if (group.compilerRoute && group.delegateCallGroupIndex !== undefined) {
          displacedRouteStateOutputs.push(stateOutput);
          builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
        } else {
          builder.addOutput(stateOutput);
        }
      }

      // Full block: output B's remaining slots (entries, SC, TCs, transfers, events, etc.)
      if (group.blockInputs && group.blockLayout) {
        if (externalDynamicChunks.length > (group.blockLayout.trailingCapacity ?? 0)) {
          throw new Error(
            'External dynamic state exceeds balanced trailing capacity '
            + `(${externalDynamicChunks.length} > ${group.blockLayout.trailingCapacity ?? 0})`,
          );
        }
        // The blockInputs already include master + dataNfts at positions 0..D.
        // The remaining positions (D+1..) need corresponding outputs.
        const dataNftEnd = 1 + group.requiredDataNftIndices.length;
        let eventIdx = 0;
        let keccakIdx = 0;
        let externalDynamicChunkIdx = 0;
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_INPUTS === '1') {
          // eslint-disable-next-line no-console
          console.error(`[blockInputs g${groupIndex}] n=${group.blockInputs.length} `
            + `slots=${group.blockLayout.slots.length} :: ${group.blockInputs.slice(0, 24)
              .map((bi, k) => `${k}:${group.blockLayout!.slots[k]?.kind ?? '-'}`
                + `/${bi.token?.nft?.commitment ? 'NFT' : 'plain'}`).join(' ')}`);
          console.error('[block-output-metadata]', {
            groupIndex,
            categoryId: group.categoryId,
            blockSize: group.blockLayout.blockSize,
            trailingBase: group.blockLayout.trailingBase,
            plannedEntryInserts: group.plannedEntryInserts,
            batchPredecessorOutputs: group.batchPredecessorOutputs?.map((output) => ({
              outputBlockSlot: output.outputBlockSlot,
              lockingBytecode: binToHex(output.lockingBytecode),
              commitment: output.commitment.slice(0, 32),
            })),
          });
        }
        for (let si = dataNftEnd; si < group.blockInputs.length; si++) {
          const input = group.blockInputs[si];
          const slot = group.blockLayout.slots[si];
          if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
            ?.SOLIDC_DEBUG_CHUNK_GEOM === '1') {
            console.error('block-loop-pos', { groupIndex, si, absOut: builder.outputs.length, kind: slot?.kind });
          }

          // Matched on the absolute index this iteration is about to fill, across every group: the pin's owning
          // group is not the group it was probed from. See deriveRouteValueChunks.
          const derivedChunk = this.derivedChunkOutputs.get(builder.outputs.length);
          if (derivedChunk) {
            if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
              ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
              console.error('chunk-placed', { groupIndex, si, absOut: builder.outputs.length });
            }
            builder.addOutput({
              to: derivedChunk.lockingBytecode,
              amount: 1000n,
              token: {
                amount: 0n,
                category: derivedChunk.categoryId ?? group.categoryId,
                nft: { capability: 'mutable', commitment: derivedChunk.commitment },
              },
            });
            continue;
          }
          const plannedInsertIndex = group.plannedEntryInserts
            ?.findIndex((planned) => planned.outputBlockSlot === si) ?? -1;
          const batchPredecessor = group.batchPredecessorOutputs
            ?.find((planned) => planned.outputBlockSlot === si);

          if (batchPredecessor) {
            builder.addOutput({
              to: batchPredecessor.lockingBytecode,
              amount: 1000n,
              token: {
                amount: 0n,
                category: group.categoryId,
                nft: { capability: 'mutable', commitment: batchPredecessor.commitment },
              },
            });
            continue;
          }

          if (plannedInsertIndex >= 0) {
            const handle = group.plannedEntryInsertHandles?.[plannedInsertIndex];
            const insert = handle === undefined ? undefined : this.externalCallEntryInserts[handle];
            builder.addOutput(insert && insert.commitment !== ''
              ? {
                to: insert.to,
                amount: 1000n,
                token: {
                  amount: 0n,
                  category: group.categoryId,
                  nft: { capability: 'mutable', commitment: insert.commitment },
                },
              }
              : {
                to: input.unlocker.generateLockingBytecode(),
                amount: input.satoshis,
                token: input.token,
              });
            continue;
          }

          // Trailing cross-contract callee LOOP entry (no block-layout slot, si >= entryLoopStart): mint B's
          // SDK-computed updated commitment. B's covenant pins output[master+blockSize+counter] == coSlot|coNext|newVal,
          // so a wrong commitment reverts (never silent-wrong).
          if (group.entryLoopStart !== undefined && si >= group.entryLoopStart) {
            const commit = group.entryLoopCommitments?.[si - group.entryLoopStart];
            builder.addOutput(commit !== undefined
              ? {
                to: input.unlocker.generateLockingBytecode(),
                amount: input.satoshis,
                token: {
                  amount: input.token?.amount ?? 0n,
                  category: group.categoryId,
                  nft: { capability: input.token?.nft?.capability ?? 'mutable', commitment: commit },
                },
              }
              : { to: input.unlocker.generateLockingBytecode(), amount: input.satoshis, token: input.token });
            continue;
          }

          // keccak256 side-car slots: recreate with the computed result R_i (from the group's keccakRecreates).
          if (slot?.kind === 'keccakSideCar') {
            const rec = group.keccakRecreates?.[keccakIdx++];
            builder.addOutput(rec ?? {
              to: input.unlocker.generateLockingBytecode(), amount: input.satoshis, token: input.token,
            });
            continue;
          }

          // C2 sorted-entry slot for a cross-contract callee WRITE (docs/deferrals.md #1): mint B's updated entry
          // (UPDATE) or its re-pointed predecessor P' (INSERT) with the commitment derived from B's VM trace. A
          // read-only entry (or an absent-key funder placeholder) has no stored commitment -> mirror the input.
          if (slot?.kind === 'entry') {
            const bEntryOut = this.externalCallEntryOutputs.get(group.categoryId)?.get(si);
            const entryLockingBytecode = group.batchEntryLockingBytecodes?.get(si)
              ?? input.unlocker.generateLockingBytecode();
            if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
              ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1' && group.compilerRoute && si < 12) {
              console.error('builder-route-entry-output', {
                groupIndex, si, callMode: group.callMode, hasCommitment: bEntryOut !== undefined,
                hasLockingBytecode: group.batchEntryLockingBytecodes?.has(si) ?? false,
              });
            }
            builder.addOutput(bEntryOut !== undefined
              ? {
                to: entryLockingBytecode,
                amount: input.satoshis,
                token: {
                  amount: input.token?.amount ?? 0n,
                  category: group.categoryId,
                  nft: { capability: input.token?.nft?.capability ?? 'mutable', commitment: bEntryOut },
                },
              }
              : { to: input.unlocker.generateLockingBytecode(), amount: input.satoshis, token: input.token });
            continue;
          }

          if (slot?.kind === 'trailing' && externalDynamicChunkIdx < externalDynamicChunks.length) {
            const output = externalDynamicChunks[externalDynamicChunkIdx++];
            builder.addOutput(output);
            continue;
          }

          // X13: B's return event belongs to B's OWN block slot, paired with the funding input the block now
          // carries at the same offset. The commitment comes from B's VM trace (setReturnEventOutput).
          if (slot?.kind === 'returnEvent'
            && ['SOLIDC_DEBUG_ROUTE_CONCISE', 'SOLIDC_DEBUG_FAILURE_RING'].some((name) =>
              (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.[name] === '1')) {
            console.error('builder-route-return-output', {
              groupIndex, si, absoluteOutput: builder.outputs.length,
              returnEventInBlock: group.returnEventInBlock,
              fusedReturnGroupIndex: group.fusedReturnGroupIndex,
              pendingIdentities: this.pendingReturnEventOutputs.map((event) => ({
                identity: event.identity,
                categoryId: event.categoryId,
                commitmentLength: event.commitment.length,
                commitment: binToHex(event.commitment.slice(0, 24)),
              })),
            });
          }
          if (slot?.kind === 'returnEvent' && group.returnEventInBlock) {
            const returnIdentity = `external-call:${group.fusedReturnGroupIndex ?? groupIndex}`;
            const re = this.pendingReturnEventOutputs.find((r) => r.identity === returnIdentity);
            builder.addOutput({
              to: new Uint8Array([0x51]),
              amount: BALANCED_SLOT_SATOSHIS,
              token: {
                amount: 0n,
                category: group.categoryId,
                nft: { capability: 'none', commitment: re ? binToHex(re.commitment) : '' },
              },
            });
            continue;
          }

          // Event slots: use auto-derived event NFT output or placeholder
          if (slot?.kind === 'event') {
            const eo = group.eventOutputs?.[eventIdx];
            if (eo) {
              // Use auto-derived commitment
              builder.addOutput({
                to: eo.lockingBytecode,
                amount: 1200n,
                token: {
                  amount: 0n,
                  category: group.categoryId,
                  nft: { capability: 'none', commitment: eo.commitment },
                },
              });
            } else if (group.compilerRoute) {
              // A message-bus route reserves the union of every handler's event slots. Slots not reached by
              // this dispatch are ordinary balanced funding slots and the route covenant binds them by
              // preservation. Mirroring the input also works as the active-slot probe: its empty commitment
              // lets the trace expose the expected event blob, after which `eventOutputs` replaces this slot.
              builder.addOutput({
                to: input.unlocker.generateLockingBytecode(),
                amount: input.satoshis,
                token: input.token,
              });
            } else {
              // Placeholder: create event NFT with empty commitment so B's VM can
              // find the output structure. The iterative derivation will fill it in.
              const bArt = group.externalContract?.inner?.artifact ?? group.externalContract?.artifact;
              const bAbiFunc = bArt?.abi?.find((f: any) => f.name === group.functionName);
              const bEmits: Array<{ eventSignature: string }> = bAbiFunc?.emits ?? [];
              if (eventIdx < bEmits.length) {
                const emitInfo = bEmits[eventIdx];
                const eventNameHash = computeEventNameHash(emitInfo.eventSignature);
                const covenantScript = buildEventNftCovenantScript(
                  hexToBin(group.categoryId), eventNameHash,
                );
                const lockingBytecode = scriptToLockingBytecode(
                  covenantScript, group.externalContract?.inner?.addressType ?? 'p2sh32',
                );
                builder.addOutput({
                  to: lockingBytecode,
                  amount: 1200n,
                  token: {
                    amount: 0n,
                    category: group.categoryId,
                    nft: { capability: 'none', commitment: '' },
                  },
                });
              } else {
                // Fallback pass-through
                builder.addOutput({
                  to: input.unlocker.generateLockingBytecode(),
                  amount: input.satoshis,
                  token: input.token,
                });
              }
            }
            eventIdx++;
          } else {
            // Pass-through: output mirrors input (preserve locking bytecode, value, token)
            builder.addOutput({
              to: input.unlocker.generateLockingBytecode(),
              amount: input.satoshis,
              token: input.token,
            });
          }
        }
      } else {
        // Legacy/unbalanced external calls place their runtime chunk run immediately after the fixed
        // master+data group. The callee covenant derives the same master-relative base.
        for (const output of externalDynamicChunks) builder.addOutput(output);
      }
      // Trailing NEW entry nodes for a cross-contract callee INSERT (docs/deferrals.md #1): B's covenant mints the
      // NEW at masterInputIndex + blockSize, right after B's block. Placed here in group order (skip cleared handles).
      for (const ins of this.externalCallEntryInserts) {
        if (ins.categoryId !== group.categoryId || ins.commitment === '') continue;
        const handle = this.externalCallEntryInserts.indexOf(ins);
        if (group.plannedEntryInsertHandles?.includes(handle)) continue;
        builder.addOutput({
          to: ins.to,
          amount: 1000n,
          token: { amount: 0n, category: group.categoryId, nft: { capability: 'mutable', commitment: ins.commitment } },
        });
      }
      if (group.delegateCallGroupIndex !== undefined) {
        appendDelegateGroupOutputs(group.delegateCallGroupIndex);
        if (group.compilerRoute) {
          // Preserve the displaced proxy master immediately after its associated implementation band, which
          // is the same absolute coordinate as the proxy-master input in the routed input layout.
          builder.addOutput({
            to: bMaster.unlocker.generateLockingBytecode(), amount: bMaster.satoshis, token: bMaster.token,
          });
          for (const stateOutput of displacedRouteStateOutputs) builder.addOutput(stateOutput);
        }
      }
    }

    // A delegate facet is preserved at its absolute input index, and the block layout now reserves that index
    // immediately after the proxy's master/data-NFT region - the position the delegate covenant derives with
    // `OP_INPUTINDEX - (1 + dataNftCount)`. Emit the facet preservation output there FIRST, then the proxy's
    // return channel, so the output side matches the reserved input side instead of claiming its slot.
    if (this.delegateEntriesAfterLowLevel) {
      // X56. The return channel follows the implementation's OWN output-only slots, not the facet master
      // directly. An implementation that also emits resolves its event at `implInput + 1` - the position this
      // used to hand the return event - and computeBlockLayout always orders events before the returnEvent, so
      // deferring the return channel past the event outputs is what makes the two agree. `deferred` is empty
      // for every implementation without an event slot, so a plain returning delegate keeps this exact index.
      const externalReturnEvents = this.pendingReturnEventOutputs.filter((r) => r.categoryId !== this.categoryId);
      if (this.delegateReturnEventAfterEvents) deferredDelegateReturnEvents.push(...externalReturnEvents);
      for (const re of (this.delegateReturnEventAfterEvents ? [] : externalReturnEvents)) {
        builder.addOutput({
          to: new Uint8Array([0x51]),
          amount: 800n,
          token: {
            amount: 0n,
            category: re.categoryId,
            nft: { capability: 'none', commitment: binToHex(re.commitment) },
          },
        });
      }
    }

    // Create entry NFT outputs (written/preserved entries, excluding deleted ones). Entry outputs occupy
    // consecutive block-layout offsets; the covenant reads each existing/written slot's output at its FIXED
    // offset. A slot that produces no output (soft-delete of an ABSENT key, or an alias-skipped write) would
    // shift a later real output down and desync that fixed read, so emit a plain placeholder output for any
    // skipped slot below the fill threshold (see entryPlaceholderFillThreshold).
    const sortedEntries = [...this.entryNfts].sort((a, b) => a.slotIndex - b.slotIndex);
    const fillThreshold = this.entryPlaceholderFillThreshold();
    for (const entry of sortedEntries) {
      if (this.entryDeletes.has(entry.slotIndex)) {
        if (entry.slotIndex < fillThreshold) {
          // Position-holding placeholder: neutral OP_TRUE, outside the collection address namespace. The covenant
          // existence-gates this absent slot away, so it is never verified; using the entry address here would
          // incorrectly increase C2's exact collection-output cardinality.
          builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
        }
        continue;
      }

      const value = this.entryUpdates.get(entry.slotIndex);
      const rawCommitment = this.entryRawCommitments.get(entry.slotIndex);

      // Priority: manual setEntry() > auto-derived raw commitment > UTXO preservation > default
      let commitment: string;
      const isMultiKey = entry.keyTypes && entry.keyValues && entry.keyTypes.length > 1;
      const structs = this.stateLayout.structs;
      if (value !== undefined) {
        if (isMultiKey) {
          commitment = buildEntryCommitmentMultiKey(
            entry.keyValues!, entry.keyTypes!, value, entry.valueType, structs,
          );
        } else {
          commitment = buildEntryCommitment(entry.keyValue, entry.keyType, value, entry.valueType, structs);
        }
      } else if (rawCommitment !== undefined) {
        commitment = rawCommitment;
      } else if (entry.exists && entry.utxo?.token?.nft?.commitment) {
        // Preserve current commitment unchanged
        commitment = entry.utxo.token.nft.commitment;
      } else {
        // New entry without explicit value - use type default
        const defaultValue = getDefaultStateValue(entry.valueType, structs);
        if (isMultiKey) {
          commitment = buildEntryCommitmentMultiKey(
            entry.keyValues!, entry.keyTypes!, defaultValue, entry.valueType, structs,
          );
        } else {
          commitment = buildEntryCommitment(entry.keyValue, entry.keyType, defaultValue, entry.valueType, structs);
        }
      }

      // Entry NFT output uses the per-collection entry covenant's locking bytecode
      const lockingBytecode = entry.exists && entry.utxo
        ? entry.utxo.unlocker.generateLockingBytecode()
        : this.entryNftLockingBytecodes.get(entry.collection);

      if (!lockingBytecode) {
        throw new Error('Cannot determine locking bytecode for entry NFT output');
      }

      builder.addOutput({
        to: lockingBytecode,
        amount: entry.utxo?.satoshis ?? 1200n,
        token: {
          amount: 0n,
          category: this.categoryId,
          nft: {
            capability: 'mutable',
            commitment,
          },
        },
      });
    }

    // Create satoshi container preservation output (after entries, before transfers)
    // Skip when fully drained (all satoshis transferred out)
    if (this.satoshiContainerUtxo) {
      const totalTransferAmount = this.pendingTransfers
        .filter((t) => t.lockingBytecode.length > 0)
        .reduce((sum, t) => sum + t.amount, 0n);
      if (totalTransferAmount > this.satoshiContainerUtxo.satoshis + this.containerDepositAmount) {
        throw new Error(
          `Total transfer amount (${totalTransferAmount}) exceeds satoshi container balance `
          + `(${this.satoshiContainerUtxo.satoshis}${this.containerDepositAmount > 0n ? ` + ${this.containerDepositAmount} deposit` : ''})`,
        );
      }

      const remainingAmount = this.satoshiContainerUtxo.satoshis - totalTransferAmount + this.containerDepositAmount;
      const satoshiContainerLockingBytecode = this.satoshiContainerLockingBytecode
        ?? this.satoshiContainerUtxo.unlocker.generateLockingBytecode();
      // Exact dust threshold for the satoshi-container output (token-aware; plain P2SH32 => 576).
      const DUST_MINIMUM = getDustThreshold({ lockingBytecode: satoshiContainerLockingBytecode });
      if (remainingAmount > 0n && remainingAmount < DUST_MINIMUM) {
        throw new Error(
          `Satoshi container remaining balance (${remainingAmount}) is below dust threshold (${DUST_MINIMUM}). `
          + 'Either transfer all satoshis (fully drain) or leave at least the dust minimum.',
        );
      }
      if (remainingAmount >= DUST_MINIMUM) {
        builder.addOutput({
          to: satoshiContainerLockingBytecode,
          amount: remainingAmount,
        });
      } else {
        // Drained: insert a 0-satoshi OP_RETURN placeholder to maintain block layout
        // output positions. The compiler's covenant verification detects the mismatched
        // locking bytecode and treats this slot as drained.
        builder.addOutput({ to: Uint8Array.from([0x6a]), amount: 0n });
      }
    }

    // Create token container preservation outputs (before transfers/tcTransfers/events
    // so that input-bearing tokenContainer slots are contiguous and match blockLayout offsets).
    // Skip drained containers (all FTs transferred + NFT transferred if present)
    for (const container of this.tokenContainers.sort((a, b) => a.tokenContainerSlotIndex - b.tokenContainerSlotIndex)) {
      if (!container.exists || !container.utxo) continue;
      if (this.isTokenContainerDrained(container.tokenContainerCategoryId)) {
        // Drained: insert a 0-satoshi OP_RETURN placeholder to maintain block layout
        // output positions. The compiler's covenant verification detects the absence of
        // tokens at this output and skips preservation checks.
        builder.addOutput({ to: Uint8Array.from([0x6a]), amount: 0n });
        continue;
      }

      const lockingBytecode = this.tokenContainerLockingBytecodes.get(container.tokenContainerCategoryId)
        ?? container.utxo.unlocker.generateLockingBytecode();

      // Compute remaining FT amount after transfers
      const transferredFtAmount = this.pendingTokenContainerTransfers
        .filter((s) => s.tokenContainerCategoryId === container.tokenContainerCategoryId)
        .reduce((sum, s) => sum + s.amount, 0n);

      const inputFtAmount = container.utxo.token?.amount ?? 0n;
      if (transferredFtAmount > inputFtAmount) {
        throw new Error(
          `Total fungible token transfer amount (${transferredFtAmount}) exceeds token container balance (${inputFtAmount}) for category ${container.tokenContainerCategoryId}`,
        );
      }

      const remainingFtAmount = inputFtAmount - transferredFtAmount;

      // Check if NFT was transferred out
      const nftWasTransferred = this.pendingTokenContainerTransferNfts.some(
        (s) => s.tokenContainerCategoryId === container.tokenContainerCategoryId,
      );

      builder.addOutput({
        to: lockingBytecode,
        amount: container.utxo.satoshis,
        token: {
          amount: remainingFtAmount,
          category: container.tokenContainerCategoryId,
          // Preserve NFT if it wasn't transferred, strip it if it was
          ...(!nftWasTransferred && container.utxo.token?.nft && {
            nft: container.utxo.token.nft,
          }),
        },
      });
    }

    // Create transfer outputs (plain BCH, no tokens). A graph route reserves a fixed per-row transfer frame;
    // inactive sites remain OP_TRUE outputs so later participant blocks cannot slide into the gaps.
    const reservedTransferSlots = this.blockLayout?.slots.filter((slot) => slot.kind === 'transfer').length
      ?? this.pendingTransfers.length;
    for (let transferSlot = 0; transferSlot < reservedTransferSlots; transferSlot += 1) {
      const transfer = this.pendingTransfers[transferSlot];
      if (!transfer || transfer.lockingBytecode.length === 0) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
      } else {
        builder.addOutput({
          to: transfer.lockingBytecode,
          amount: transfer.amount,
        });
      }
    }

    // Create token container transfer outputs (FT and NFT interleaved in source-code order)
    // The compiler assigns sequential transfer indices in source order, so the SDK must
    // produce outputs in the same order to match covenant verification expectations.
    const allTcTransfers: Array<{ type: 'ft'; data: TokenContainerTransferData } | { type: 'nft'; data: TokenContainerTransferNftData }> = [
      ...this.pendingTokenContainerTransfers.map((d) => ({ type: 'ft' as const, data: d })),
      ...this.pendingTokenContainerTransferNfts.map((d) => ({ type: 'nft' as const, data: d })),
    ];
    allTcTransfers.sort((a, b) => a.data.insertionOrder - b.data.insertionOrder);

    const reservedTokenTransferSlots = this.blockLayout?.slots.filter((slot) => slot.kind === 'tcTransfer').length
      ?? allTcTransfers.length;
    for (let transferSlot = 0; transferSlot < reservedTokenTransferSlots; transferSlot += 1) {
      const entry = allTcTransfers[transferSlot];
      if (!entry) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
        continue;
      }
      if (entry.type === 'ft') {
        builder.addOutput({
          to: entry.data.lockingBytecode,
          amount: 1200n,
          token: {
            amount: entry.data.amount,
            category: entry.data.tokenContainerCategoryId,
          },
        });
      } else {
        builder.addOutput({
          to: entry.data.lockingBytecode,
          amount: 1200n,
          token: {
            amount: 0n,
            category: entry.data.tokenContainerCategoryId,
            nft: {
              capability: entry.data.capability,
              commitment: binToHex(entry.data.commitment),
            },
          },
        });
      }
    }

    // Create event NFT outputs - merge raw commitments, manual emits, and placeholders
    const eventOutputEntries: Array<{ eventSignature: string; commitment: string }> = [];

    // Manual emitEvent() calls (existing encoding logic)
    for (let ei = 0; ei < this.pendingEventEmits.length; ei++) {
      const eventEmit = this.pendingEventEmits[ei];
      const eventDef = this.eventDefinitions.find((e) => e.signature === eventEmit.eventSignature);
      if (!eventDef) {
        throw new Error(`Unknown event: ${eventEmit.eventSignature}`);
      }

      const encodedParts: Uint8Array[] = [];
      for (let i = 0; i < eventDef.parameters.length; i++) {
        let value = eventEmit.args[i];
        const type = eventDef.parameters[i].type;
        if (typeof value === 'string') {
          if (type === 'string') {
            value = new TextEncoder().encode(value);
          } else if (type === 'address' && value.includes(':')) {
            value = addressToLockScript(value);
          } else if (type === 'address' && /^0x[0-9a-fA-F]*$/.test(value)) {
            value = hexToBin(value.slice(2));
          } else if (!isHex(value)) {
            throw new Error(`Invalid event argument at index ${i}: expected a hex string, got '${value}'`);
          } else {
            value = hexToBin(value);
          }
        }
        encodedParts.push(encodePushdataValue(value, type, this.stateLayout.structs));
      }

      const totalLength = encodedParts.reduce((sum, p) => sum + p.length, 0);
      const commitmentBytes = new Uint8Array(totalLength);
      let offset = 0;
      for (const part of encodedParts) {
        commitmentBytes.set(part, offset);
        offset += part.length;
      }

      eventOutputEntries[ei] = { eventSignature: eventEmit.eventSignature, commitment: binToHex(commitmentBytes) };
    }

    // Placeholders and raw commitments (from auto-derivation)
    for (const placeholder of this.pendingEventPlaceholders) {
      const idx = placeholder.emitIndex;
      if (eventOutputEntries[idx]) continue; // manual emitEvent() takes precedence
      const rawCommitment = this.eventRawCommitments.get(idx);
      eventOutputEntries[idx] = {
        eventSignature: placeholder.eventSignature,
        commitment: rawCommitment ?? '',
      };
    }

    const reservedEventSlots = this.blockLayout?.slots.filter((slot) => slot.kind === 'event').length
      ?? eventOutputEntries.length;
    for (let eventSlot = 0; eventSlot < reservedEventSlots; eventSlot += 1) {
      const eo = eventOutputEntries[eventSlot];
      if (!eo) {
        // A graph route reserves a fixed event frame. Keep every inactive site as a balanced plain output so a
        // later participant cannot slide into the gap; the route covenant separately excludes an own-category
        // NFT here, and the atomic callManifest lists only active immutable event outputs.
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
        continue;
      }
      const lockingBytecode = this.eventNftLockingBytecodes.get(eo.eventSignature);
      if (!lockingBytecode) {
        throw new Error(`No locking bytecode provided for event: ${eo.eventSignature}`);
      }

      builder.addOutput({
        to: lockingBytecode,
        amount: 1200n,
        token: {
          amount: 0n,
          category: this.categoryId,
          nft: {
            capability: 'none',
            commitment: eo.commitment,
          },
        },
      });
    }

    // X56. The delegate return channel, deferred from the facet-preservation block above so the co-spent
    // implementation's own event outputs keep the position its covenant resolves for them.
    for (const re of deferredDelegateReturnEvents) {
      builder.addOutput({
        to: new Uint8Array([0x51]),
        amount: 800n,
        token: {
          amount: 0n,
          category: re.categoryId,
          nft: { capability: 'none', commitment: binToHex(re.commitment) },
        },
      });
    }

    // Create return event outputs (from cross-contract calls with return values). X13: a callee whose full block
    // carries a returnEvent slot already emitted its own return event inside that block above.
    for (const re of (this.delegateEntriesAfterLowLevel ? [] : this.tailReturnEventOutputs())) {
      builder.addOutput({
        to: new Uint8Array([0x51]), // OP_TRUE
        amount: 800n,
        token: {
          amount: 0n,
          category: re.categoryId,
          nft: { capability: 'none', commitment: binToHex(re.commitment) },
        },
      });
    }
    if (!this.delegateEntriesAfterLowLevel
      && (this.blockLayout?.trailingCapacity ?? 0) > 0
      && this.blockLayout?.slots.some((slot) => slot.kind === 'returnEvent')
      && this.pendingReturnEventOutputs.length === 0) {
      // A balanced block cannot collapse an inactive return slot: doing so
      // shifts the bounded trailing region one position left.
      builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
    }

    // Create low-level call outputs (after A's block slots, matching block layout ordering)
    for (const [groupIndex, group] of this.lowLevelCallUtxoGroups.entries()) {
      // A delegate associated with an external proxy group was already emitted immediately after that proxy's
      // fixed block by appendDelegateGroupOutputs. Emitting it again here mints a second implementation master
      // output from one input and is rejected by the implementation's minting-NFT conservation covenant.
      if (associatedDelegateOutputs.has(groupIndex)) continue;
      if (this.delegateEntriesAfterLowLevel && group.callMode === 'delegatecall') continue;
      const bMaster = group.masterUtxo as UnlockableUtxo;
      builder.addOutput({
        to: bMaster.unlocker.generateLockingBytecode(),
        amount: bMaster.satoshis,
        token: bMaster.token,
      });

      if (group.callMode === 'staticcall' || group.callMode === 'delegatecall') {
        for (const nftUtxo of group.dataNftUtxos) {
          builder.addOutput({
            to: nftUtxo.unlocker.generateLockingBytecode(),
            amount: nftUtxo.satoshis,
            token: nftUtxo.token,
          });
        }
        continue;
      }

      const bStateUpdates = this.externalCallStateUpdates.get(group.categoryId);
      const bCurrentState: Record<string, StateValue> = {};
      for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
        const nftIdx = group.requiredDataNftIndices[i];
        const nftUtxo = group.dataNftUtxos[i];
        if (nftUtxo?.token?.nft?.commitment) {
          const parsed = parsePushdataCommitment(nftUtxo.token.nft.commitment, group.stateLayout, nftIdx);
          for (const [key, value] of Object.entries(parsed)) {
            bCurrentState[key] = value;
          }
        }
      }
      if (bStateUpdates) {
        for (const [name, value] of bStateUpdates) {
          bCurrentState[name] = value;
        }
      }
      for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
        const nftIdx = group.requiredDataNftIndices[i];
        const nftUtxo = group.dataNftUtxos[i];
        const commitment = buildPushdataCommitment(
          group.stateLayout, bCurrentState, nftIdx,
          this.builderOptions.provider.consensusLimits?.maximumNftCommitmentBytes,
        );
        builder.addOutput({
          to: nftUtxo.unlocker.generateLockingBytecode(),
          amount: nftUtxo.satoshis,
          token: {
            amount: nftUtxo.token?.amount ?? 0n,
            category: group.categoryId,
            nft: {
              capability: nftUtxo.token?.nft?.capability ?? 'mutable',
              commitment,
            },
          },
        });
      }
    }

    // Low-level call raw UTXO outputs (preserved unchanged)
    for (const rawUtxo of this.lowLevelCallRawInputs) {
      builder.addOutput({
        to: rawUtxo.unlocker.generateLockingBytecode(),
        amount: rawUtxo.satoshis,
        token: rawUtxo.token,
      });
    }

    // Iteration entry outputs (read-only co-spent chunks / collection-iter entries) come FIRST in the trailing
    // region, preserved at their input index [blockSize, blockSize+count) (the chunk covenant pins
    // output==input). New chunk outputs follow, after getChunkOutputBase() (which includes this count).
    // Skipped when already emitted before the callee outputs (loop external-call case).
    for (const iterUtxo of (loopChunkBeforeCallees ? [] : this.iterationEntryInputs)) {
      builder.addOutput({
        to: iterUtxo.unlocker.generateLockingBytecode(),
        amount: iterUtxo.satoshis,
        token: {
          amount: iterUtxo.token?.amount ?? 0n,
          category: this.categoryId,
          nft: {
            capability: 'mutable',
            commitment: iterUtxo.token?.nft?.commitment ?? '',
          },
        },
      });
    }

    if (this.batchEntriesBeforeDynamicChunks || this.delegateEntriesAfterLowLevel) {
      for (const lv of this.loopEntryVars) {
        for (const commitment of this.loopEntryCommitments.get(lv.collection) ?? []) {
          const entryOutput = {
            to: lv.lockingBytecode, amount: 1200n,
            token: { amount: 0n, category: lv.categoryId ?? this.categoryId,
              nft: { capability: 'mutable' as const, commitment } },
          };
          entryOutput.amount = BigInt(Math.max(1200, calculateDust(entryOutput)));
          builder.addOutput(entryOutput);
        }
      }
    }

    const appendValueChunks = (): void => {
      for (const vco of this.valueChunkOutputs) {
        const chunkOutput = { ...vco };
        chunkOutput.amount = BigInt(Math.max(1200, calculateDust(chunkOutput)));
        builder.addOutput(chunkOutput);
      }
      for (const { collection, lockingBytecode } of this.getValueChunkVars()) {
        for (const commitment of this.valueChunkRawCommitments.get(collection) ?? []) {
          const chunkOutput = {
            to: lockingBytecode, amount: 1200n,
            token: { amount: 0n, category: this.categoryId,
              nft: { capability: 'mutable' as const, commitment } },
          };
          chunkOutput.amount = BigInt(Math.max(1200, calculateDust(chunkOutput)));
          builder.addOutput(chunkOutput);
        }
      }
    };
    if (this.delegateEntriesAfterLowLevel) appendValueChunks();

    const appendDynamicChunks = (): void => {
      for (const dv of this.dynamicChunkVars) {
        const commitments = this.chunkRawCommitments.get(dv.name) ?? [];
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1' && commitments.length > 0) {
          console.error('append-dynamic-chunks', {
            name: dv.name,
            lockingBytecode: binToHex(dv.lockingBytecode),
            outputBase: builder.outputs.length,
            computedBase: this.getChunkOutputBase(),
            baseParts: {
              layoutTrailingBase: this.blockLayout?.trailingBase,
              layoutBlockSize: this.blockLayout?.blockSize,
              externalCallOutputs: this.externalCallUtxoGroups.map((group) => ({
                shared: group.sharedGroupIndex,
                blockInputs: group.blockInputs?.length,
                fallback: 1 + group.dataNftUtxos.length,
              })),
              externalReturns: this.tailReturnEventOutputs()
                .filter((returnEvent) => returnEvent.categoryId !== this.categoryId).length,
              lowLevelGroups: this.lowLevelCallUtxoGroups.map((group) => 1 + group.dataNftUtxos.length),
              lowLevelRaw: this.lowLevelCallRawInputs.length,
              iterationEntries: this.iterationEntryInputs.length,
              loopEntries: this._loopEntryOutputCount(),
              valueChunks: this._valueChunkOutputCount(),
              pendingOutputs: this.pendingOutputs.length,
              identityAnchors: this.externalIdentityAnchorUtxos.length + (this.logicalIdentityUtxo ? 1 : 0),
            },
            count: commitments.length,
          });
        }
        for (const commitment of commitments) {
          const chunkOutput = {
            to: dv.lockingBytecode,
            amount: 1200n,
            token: {
              amount: 0n,
              category: this.categoryId,
              nft: { capability: 'mutable' as const, commitment },
            },
          };
          chunkOutput.amount = BigInt(Math.max(1200, calculateDust(chunkOutput)));
          builder.addOutput(chunkOutput);
        }
      }
    };
    if (!this.delegateEntriesAfterLowLevel && !this.delegateDynamicChunksAtSuffix) appendDynamicChunks();

    // Loop mapping-write entry outputs (trailing, after any chunks). One new mutable entry NFT per loop iteration;
    // commitments (key_enc||value_enc) come from auto-derivation (the covenant builds them on-chain per iteration).
    for (const lv of (this.batchEntriesBeforeDynamicChunks || this.delegateEntriesAfterLowLevel
      ? [] : this.loopEntryVars)) {
      const commitments = this.loopEntryCommitments.get(lv.collection) ?? [];
      for (const commitment of commitments) {
        const entryOutput = {
          to: lv.lockingBytecode,
          amount: 1200n,
          token: {
            amount: 0n,
            category: lv.categoryId ?? this.categoryId,
            nft: { capability: 'mutable' as const, commitment },
          },
        };
        entryOutput.amount = BigInt(Math.max(1200, calculateDust(entryOutput)));
        builder.addOutput(entryOutput);
      }
    }

    // P5b value chunks (Design D), placed AFTER every covenant-managed output (entries, dynamic chunks, loop-entry
    // NEW nodes). DIRECT values are injected exactly
    // (valueChunkOutputs); COMPUTED values are trace-derived (valueChunkVars, commitments filled by auto-derivation).
    if (!this.delegateEntriesAfterLowLevel) appendValueChunks();

    const trailingCapacity = this.blockLayout?.trailingCapacity ?? 0;
    if (trailingCapacity > 0) {
      const trailingOutputCount = this.iterationEntryInputs.length
        + this._dynamicChunkOutputCount()
        + this._loopEntryOutputCount()
        + this.valueChunkOutputs.length
        + [...this.getValueChunkVars()].reduce(
          (sum, value) => sum + (this.valueChunkRawCommitments.get(value.collection) ?? []).length,
          0,
        );
      if (trailingOutputCount > trailingCapacity) {
        throw new Error(
          'Runtime resource outputs exceed balanced trailing capacity '
          + `(${trailingOutputCount} > ${trailingCapacity})`,
        );
      }
      for (let i = trailingOutputCount; i < trailingCapacity; i++) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
      }
    }

    // Append any extra outputs buffered via addOutput()
    for (const output of this.pendingOutputs) {
      builder.addOutput(output);
    }
    // A callee's identity anchor is permissionless to spend, so consuming it without recreating it would destroy
    // that contract's logical identity. Recreate each one verbatim, mirroring the input ordering.
    for (const anchor of this.externalIdentityAnchorUtxos) {
      builder.addOutput({
        to: anchor.unlocker.generateLockingBytecode(),
        amount: anchor.satoshis,
        token: anchor.token,
      });
    }
    if (this.logicalIdentityUtxo) {
      builder.addOutput({
        to: this.logicalIdentityUtxo.unlocker.generateLockingBytecode(),
        amount: this.logicalIdentityUtxo.satoshis,
        token: this.logicalIdentityUtxo.token,
      });
    }
    if (this.delegateEntriesAfterLowLevel || this.delegateDynamicChunksAtSuffix) appendDynamicChunks();

    for (const vco of this.lateValueChunkOutputs) {
      const chunkOutput = { ...vco };
      chunkOutput.amount = BigInt(Math.max(1200, calculateDust(chunkOutput)));
      builder.addOutput(chunkOutput);
    }

    // Reverse-suffix chunk indexing requires exactly ONE output after the late chunk region in every build,
    // including covenant-only probes and direct build() calls. A sidecar must be last for its self-preservation
    // covenant; otherwise use a zero-value OP_RETURN anchor. send() inserts any fee change BEFORE this suffix.
    if (this.lateValueChunkOutputs.length > 0) {
      if (this.sidecarUtxo) {
        builder.addOutput({
          to: this.sidecarUtxo.unlocker.generateLockingBytecode(),
          amount: this.sidecarUtxo.satoshis,
        });
      } else {
        builder.addOutput({ to: new Uint8Array([0x6a]), amount: 0n }); // OP_RETURN suffix anchor
      }
    }
    // The final unused funder input of a bounded balanced layout remains after
    // the owner block; the outer transaction builder pairs it with change.

    // Output materialization is authoritative: shared/compiler-routed groups can expand into balanced blocks
    // whose physical width is not known from their logical call record. Resolve each delegate's preservation
    // coordinate now; the input unlocker closures above read these references when the final transaction encodes.
    for (const [groupIndex, outputBaseRef] of relocatedDelegateOutputBases) {
      const group = this.lowLevelCallUtxoGroups[groupIndex];
      const master = group?.masterUtxo as UnlockableUtxo | undefined;
      if (!group || !master) continue;
      const masterLock = binToHex(master.unlocker.generateLockingBytecode());
      const masterCommitment = master.token?.nft?.commitment ?? '';
      const resolved = builder.outputs.findIndex((output) => (
        output.to instanceof Uint8Array && binToHex(output.to) === masterLock
        && output.amount === master.satoshis
        && output.token?.category === master.token?.category
        && (output.token?.nft?.commitment ?? '') === masterCommitment
      ));
      if (resolved >= 0) outputBaseRef.value = resolved;
    }

    return builder;
  }

  /**
   * Check if the satoshi container is fully drained (all satoshis transferred out).
   */
  isSatoshiContainerDrained(): boolean {
    if (!this.satoshiContainerUtxo) return false;
    const total = this.pendingTransfers
      .filter((t) => t.lockingBytecode.length > 0)
      .reduce((sum, t) => sum + t.amount, 0n);
    return total >= this.satoshiContainerUtxo.satoshis + this.containerDepositAmount;
  }

  /**
   * Check if a token container is fully drained (all FTs transferred + NFT transferred if present).
   */
  isTokenContainerDrained(categoryId: string): boolean {
    const container = this.tokenContainers.find((c) => c.tokenContainerCategoryId === categoryId);
    if (!container?.exists || !container?.utxo) return false;
    const ftTransferred = this.pendingTokenContainerTransfers
      .filter((t) => t.tokenContainerCategoryId === categoryId)
      .reduce((sum, t) => sum + t.amount, 0n);
    const nftTransferred = this.pendingTokenContainerTransferNfts
      .some((t) => t.tokenContainerCategoryId === categoryId);
    const inputFt = container.utxo.token?.amount ?? 0n;
    if (ftTransferred > inputFt) {
      throw new Error(
        `Total fungible token transfer amount (${ftTransferred}) `
        + `exceeds token container balance (${inputFt}) `
        + `for category ${categoryId}`,
      );
    }
    const hasNft = !!container.utxo.token?.nft;
    return (inputFt - ftTransferred === 0n) && (!hasNft || nftTransferred);
  }

  /**
   * Get the bitmask of token container output flags (which slots have outputs).
   * Slots with drained containers have bit = 0.
   */
  getTokenContainerOutputFlags(): bigint {
    let flags = 0n;
    for (const container of this.tokenContainers) {
      if (container.exists && container.utxo
        && !this.isTokenContainerDrained(container.tokenContainerCategoryId)) {
        flags |= 1n << BigInt(container.tokenContainerSlotIndex);
      }
    }
    return flags;
  }

  /** Get the list of token container infos (for drain detection). */
  getEntryNftInfos(): readonly EntryNftInfo[] {
    return this.entryNfts;
  }

  getTokenContainerInfos(): readonly TokenContainerInfo[] {
    return this.tokenContainers;
  }

  /**
   * Compute the output index where entry NFT outputs start.
   */
  getEntryOutputBase(): number {
    const layoutOffset = this.getBlockSlotOffset('entry', 0);
    if (layoutOffset !== undefined) return layoutOffset;

    const masterOutputCount = 1;
    const dataNftOutputCount = this.requiredNftIndices.length;
    const readOnlyOutputCount = this.readOnlyDataNftUtxos.length;
    const blockhashOutputCount = this.blockhashCoSpendUtxos.length;
    const keccakOutputCount = this.keccakComputeCoSpendUtxos.length;
    const ecrecoverOutputCount = this.ecrecoverComputeCoSpendUtxos.length;
    const outStateOutputCount = this.externalOutStateUtxoGroups.reduce(
      (sum, g) => sum + 1 + g.dataNftUtxos.length + (g.keccakInputs?.length ?? 0), 0,
    );
    const externalCallOutputCount = this.externalCallUtxoGroups.reduce(
      (sum, g) => (g.blockInputs ? sum + g.blockInputs.length : sum + 1 + g.dataNftUtxos.length), 0,
    );
    // A direct delegate is preserved before the proxy-owned entry band (see build()). Its implementation
    // master/data outputs therefore shift the physical entry indices even though they are not part of the
    // proxy forwarder's block layout. Delegates associated with an external group are emitted with that group
    // later and have already been counted above.
    const associatedDelegates = new Set(this.externalCallUtxoGroups
      .map((group) => group.delegateCallGroupIndex)
      .filter((index): index is number => index !== undefined));
    const leadingDelegateOutputCount = this.delegateEntriesAfterLowLevel
      ? this.lowLevelCallUtxoGroups.reduce((sum, group, index) => (
        group.callMode === 'delegatecall' && !associatedDelegates.has(index)
          ? sum + 1 + group.dataNftUtxos.length : sum
      ), 0) + (this.delegateReturnEventAfterEvents ? 0 : this.pendingReturnEventOutputs
        .filter((returnEvent) => returnEvent.categoryId === this.categoryId).length)
      : 0;
    // When a dynamic-array read coexists with external calls, build() emits the read chunks' preservation
    // outputs BEFORE the callee outputs (loopChunkBeforeCallees), so everything downstream of the entries
    // (transfers, events, RETURN events - this is the chain root they all build on) shifts by the chunk
    // count. Without external calls the iteration entries trail the block instead (no shift). Must match
    // the witness-side formula in StatefulContract (returnEventOutputBase counts iterationEntryInputs).
    const chunkBeforeCalleeCount = this.externalCallUtxoGroups.length > 0 ? this.iterationEntryInputs.length : 0;
    // Low-level call outputs are now AFTER entries/SC/TCs/transfers/events (matching block layout)
    return masterOutputCount + dataNftOutputCount + readOnlyOutputCount + blockhashOutputCount + keccakOutputCount
      + ecrecoverOutputCount + outStateOutputCount + externalCallOutputCount + chunkBeforeCalleeCount
      + leadingDelegateOutputCount;
  }

  /**
   * The entry-slot index of each entry NFT output, in output order (matches the build() output loop:
   * non-deleted entries sorted by slotIndex). Output at getEntryOutputBase()+k belongs to slot [k].
   * Lets the derivation map an extracted commitment back to its slot by output index (robust to write
   * order and to read-only slots that emit no commitment check).
   */
  getEntryOutputSlotOrder(): number[] {
    // Must mirror build()'s entry-output emission exactly: a real output per non-deleted slot, plus a
    // position-holding placeholder for each deleted slot below the fill threshold. The derivation maps a
    // commitment at output offset O to slotOrder[O - entryOutputBase]; placeholders carry no commitment, so
    // they just occupy a position and are never looked up.
    const sorted = [...this.entryNfts].sort((a, b) => a.slotIndex - b.slotIndex);
    const fillThreshold = this.entryPlaceholderFillThreshold();
    const order: number[] = [];
    for (const e of sorted) {
      if (!this.entryDeletes.has(e.slotIndex) || e.slotIndex < fillThreshold) order.push(e.slotIndex);
    }
    return order;
  }

  // The slotIndex below which a skipped (deleted/funded) entry slot needs a placeholder output. Normally the
  // last real entry output; but when a trailing output (a dynamic chunk write, or a post-entry block-layout
  // slot) sits past the entry region, the whole region must be occupied so that trailing output lands at its
  // fixed offset - so fill through the last entry slot.
  private entryPlaceholderFillThreshold(): number {
    const sorted = [...this.entryNfts].sort((a, b) => a.slotIndex - b.slotIndex);
    if (sorted.length === 0) return -1;
    if (this.hasPostEntryOutput()) return sorted[sorted.length - 1].slotIndex + 1;
    let lastRealSlotIndex = -1;
    for (const e of sorted) if (!this.entryDeletes.has(e.slotIndex)) lastRealSlotIndex = e.slotIndex;
    return lastRealSlotIndex;
  }

  private hasPostEntryOutput(): boolean {
    if (this.dynamicChunkVars.length > 0) return true;
    if (this.loopEntryVars.length > 0) return true;
    if (!this.blockLayout) return false;
    const entryOffsets = this.blockLayout.slots.filter((s) => s.kind === 'entry').map((s) => s.offset);
    if (entryOffsets.length === 0) return false;
    const maxEntry = Math.max(...entryOffsets);
    return this.blockLayout.slots.some((s) => s.offset > maxEntry);
  }

  /**
   * Look up a block-layout offset for a given slot kind and optional slotIndex.
   * Returns `undefined` when no block layout is available or the slot is not found.
   */
  private getBlockSlotOffset(kind: BlockSlotKind, slotIndex?: number): number | undefined {
    if (!this.blockLayout) return undefined;
    const slot = this.blockLayout.slots.find(
      (s) => s.kind === kind && (slotIndex === undefined || s.slotIndex === slotIndex),
    );
    return slot?.offset;
  }

  /**
   * Compute the output index where token container preservation outputs start.
   * Token containers now come before output-only slots (transfers, tcTransfers, events)
   * so that input-bearing slots are contiguous and match blockLayout offsets.
   */
  getTokenContainerOutputBase(): number {
    const layoutOffset = this.getBlockSlotOffset('tokenContainer', 0);
    if (layoutOffset !== undefined) return layoutOffset;

    const entryNftOutputCount = this.entryNfts
      .filter((e) => !this.entryDeletes.has(e.slotIndex))
      .length;
    const satoshiContainerOutputCount = this.satoshiContainerUtxo ? 1 : 0;
    return this.getEntryOutputBase()
      + entryNftOutputCount + satoshiContainerOutputCount;
  }

  getTransferOutputBase(): number {
    const layoutOffset = this.getBlockSlotOffset('transfer', 0);
    if (layoutOffset !== undefined) return layoutOffset;

    const containerSlots = this.tokenContainers.filter(
      (d) => d.exists && d.utxo,
    ).length;
    return this.getTokenContainerOutputBase() + containerSlots;
  }

  /**
   * Compute the output index where token container transfer outputs start.
   */
  getTokenContainerTransferOutputBase(): number {
    const layoutOffset = this.getBlockSlotOffset('tcTransfer', 0);
    if (layoutOffset !== undefined) return layoutOffset;

    const activeTransfers = this.pendingTransfers.filter((t) => t.lockingBytecode.length > 0).length;
    return this.getTransferOutputBase() + activeTransfers;
  }

  /**
   * Compute the output index where event NFT outputs start.
   */
  getEventOutputBase(): number {
    const layoutOffset = this.getBlockSlotOffset('event', 0);
    if (layoutOffset !== undefined) return layoutOffset;

    return this.getTokenContainerTransferOutputBase()
      + this.pendingTokenContainerTransfers.length
      + this.pendingTokenContainerTransferNfts.length;
  }

  /**
   * Compute the output index where return event outputs start.
   */
  getReturnEventOutputBase(): number {
    if (this.delegateEntriesAfterLowLevel) {
      let base = 1 + this.requiredNftIndices.length + this.readOnlyDataNftUtxos.length
        + this.blockhashCoSpendUtxos.length + this.keccakComputeCoSpendUtxos.length
        + this.ecrecoverComputeCoSpendUtxos.length;
      for (const g of this.externalOutStateUtxoGroups) {
        base += 1 + g.dataNftUtxos.length + (g.keccakInputs?.length ?? 0);
      }
      base += this.iterationEntryInputs.length;
      for (const g of this.externalCallUtxoGroups) {
        base += g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length;
      }
      base += this.pendingReturnEventOutputs.filter((r) => r.categoryId === this.categoryId).length;
      for (const g of this.lowLevelCallUtxoGroups.filter((candidate) => candidate.callMode === 'delegatecall')) {
        base += 1 + g.dataNftUtxos.length;
      }
      return base;
    }
    const layoutOffset = this.getBlockSlotOffset('returnEvent');
    if (layoutOffset !== undefined) return layoutOffset;
    return this.getEventOutputBase() + this.getEventOutputCount();
  }

  /**
   * X13: a callee whose FULL block was assembled publishes a returnEvent slot inside that block, and the block
   * carries a paired funding input there, so its return-event NFT belongs at that slot - not appended after the
   * whole participant region. A callee without a full block (a transitive A->B->C leaf) keeps the appended tail.
   */
  private isInBlockReturnEventGroup(groupIdx: number): boolean {
    return this.externalCallUtxoGroups[groupIdx]?.returnEventInBlock === true;
  }

  /** Return events that are NOT emitted inside a callee block, in emission order. */
  private tailReturnEventOutputs(): Array<{ categoryId: string; commitment: Uint8Array; identity: string }> {
    const inBlock = new Set<string>();
    for (let i = 0; i < this.externalCallUtxoGroups.length; i += 1) {
      if (this.isInBlockReturnEventGroup(i)) {
        const group = this.externalCallUtxoGroups[i];
        inBlock.add(`external-call:${group.fusedReturnGroupIndex ?? i}`);
      }
    }
    return this.pendingReturnEventOutputs.filter((re) => !inBlock.has(re.identity));
  }

  /**
   * X13: the output index carrying external-call group `groupIdx`'s return-event NFT - its own block slot when the
   * callee carries a full block, otherwise its rank in the appended tail band.
   */
  getExternalCallReturnEventOutputIndex(groupIdx: number): number {
    const group = this.externalCallUtxoGroups[groupIdx];
    if (!group) return -1;
    const offset = group.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent')?.offset;
    if (this.isInBlockReturnEventGroup(groupIdx) && offset !== undefined) {
      return this.getExternalCallOutputBase(groupIdx) + offset;
    }
    const returnIdentity = `external-call:${group.fusedReturnGroupIndex ?? groupIdx}`;
    const tailOrder = this.tailReturnEventOutputs().findIndex((re) => re.identity === returnIdentity);
    return tailOrder < 0 ? -1 : this.getReturnEventOutputBase() + tailOrder;
  }

  /**
   * Count the actual number of event NFT outputs that build() will create.
   * This mirrors the merge logic in build(): manual emits fill dense indices,
   * placeholders (with optional raw commitments) fill by emitIndex, and
   * only non-null entries produce actual outputs.
   */
  private getEventOutputCount(): number {
    // Replicate the sparse array merge from build()
    const occupied = new Set<number>();

    // Manual emitEvent() calls occupy indices 0..n-1
    for (let i = 0; i < this.pendingEventEmits.length; i++) {
      occupied.add(i);
    }

    // Placeholders occupy their emitIndex (if not already taken by manual emits)
    for (const placeholder of this.pendingEventPlaceholders) {
      occupied.add(placeholder.emitIndex);
    }

    return occupied.size;
  }

  /**
   * Compute the input index of the satoshi container.
   * The satoshi container is placed after token containers in the input ordering.
   */
  getSatoshiContainerInputIndex(): number {
    const layoutOffset = this.getBlockSlotOffset('satoshiContainer');
    if (layoutOffset !== undefined) return layoutOffset;

    const masterInputCount = 1;
    const dataNftInputCount = this.dataNftUtxos.length;
    const readOnlyInputCount = this.readOnlyDataNftUtxos.length;
    const blockhashInputCount = this.blockhashCoSpendUtxos.length;
    const keccakInputCount = this.keccakComputeCoSpendUtxos.length;
    const ecrecoverInputCount = this.ecrecoverComputeCoSpendUtxos.length;
    const outStateInputCount = this.externalOutStateUtxoGroups.reduce(
      (sum, g) => sum + 1 + g.dataNftUtxos.length + (g.keccakInputs?.length ?? 0), 0,
    );
    const externalCallInputCount = this.externalCallUtxoGroups.reduce(
      (sum, g) => (g.blockInputs ? sum + g.blockInputs.length : sum + 1 + g.dataNftUtxos.length), 0,
    );
    const lowLevelCallInputCount = this.lowLevelCallUtxoGroups.reduce(
      (sum, g) => sum + 1 + g.dataNftUtxos.length, 0,
    ) + this.lowLevelCallRawInputs.length;
    const entryInputCount = this.entryNfts.filter((e) => e.exists && e.utxo).length;
    const iterationEntryInputCount = this.iterationEntryInputs.length;
    const tokenContainerInputCount = this.tokenContainers.filter((d) => d.exists && d.utxo).length;
    return masterInputCount + dataNftInputCount + readOnlyInputCount + blockhashInputCount + keccakInputCount
      + ecrecoverInputCount + outStateInputCount + externalCallInputCount + lowLevelCallInputCount
      + entryInputCount + iterationEntryInputCount + tokenContainerInputCount;
  }

  /**
   * Compute the output index of the satoshi container preservation output.
   * The satoshi container output is placed after entries, before transfers.
   */
  getSatoshiContainerOutputIndex(): number {
    // With OP_RETURN placeholders for drained containers, the output always
    // exists at the block layout position (even when drained).
    const layoutOffset = this.getBlockSlotOffset('satoshiContainer');
    if (layoutOffset !== undefined) return layoutOffset;
    // The satoshi container output is at getTokenContainerOutputBase() - 1
    return this.getTokenContainerOutputBase() - 1;
  }

  /**
   * Compute the total number of outputs in the transaction.
   */
  private getTotalOutputCount(): number {
    const eventOutputCount = this.getEventOutputCount();
    const lowLevelCallOutputCount = this.lowLevelCallUtxoGroups.reduce(
      (sum, g) => sum + 1 + g.dataNftUtxos.length, 0,
    ) + this.lowLevelCallRawInputs.length;
    const iterationEntryOutputCount = this.iterationEntryInputs.length;
    // Include potential funder change output (added last in build())
    const changeOutputCount = (this.funderChangeAddress && this.funderUtxos.length > 0) ? 1 : 0;
    // X13: in-block return events are already counted inside each callee's block output span.
    return this.getEventOutputBase() + eventOutputCount
      + this.tailReturnEventOutputs().length
      + lowLevelCallOutputCount
      + this._dynamicChunkOutputCount()
      + iterationEntryOutputCount
      + this.pendingOutputs.length
      + this.lateValueChunkOutputs.length
      + (this.lateValueChunkOutputs.length > 0 ? 1 : 0)
      + changeOutputCount;
  }

  /**
   * Build the covenant transaction without funding or broadcasting.
   * Returns the logically balanced transaction with all covenant inputs/outputs
   * and empty unlocking bytecodes on any unsigned inputs.
   *
   * The caller is responsible for:
   * 1. Adding fee funding input(s) to cover the transaction fee
   * 2. Adding a change output for excess funding
   * 3. Signing all inputs (covenant inputs already have unlocking bytecodes)
   * 4. Broadcasting the final transaction
   */
  async buildUnsigned(): Promise<{
    transaction: Uint8Array;
    sourceOutputs: LibauthOutput[];
    inputCount: number;
    covenantSize: number;
  }> {
    const covenantBuilder = this.build();
    const covenantTx = covenantBuilder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(covenantBuilder.inputs);
    const encoded = encodeTransaction(covenantTx);

    return {
      transaction: encoded,
      sourceOutputs,
      inputCount: covenantTx.inputs.length,
      covenantSize: encoded.byteLength,
    };
  }

  /**
   * On a covenant script failure, log an accurate op-level VM trace of the submitted tx. Runs the 2026 VM
   * (the one mocknet uses) so it executes the optimised subroutine bytecode the source-map debug can't track,
   * pinpointing the exact failing opcode + stack. Finds the failing input (named in the error, else scanned)
   * and prints a window of ops ending at the failure. Best-effort: the caller swallows any error here.
   */
  private _logCovenantFailureTrace(builder: TransactionBuilder, reason: string): void {
    const transaction = builder.buildLibauthTransaction(true);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const named = reason.match(/input(?: index)? (\d+)/);
    const candidates = named ? [Number(named[1])] : transaction.inputs.map((_u, i) => i);
    const relaxedConsensus = (this.builderOptions.provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000;
    if (relaxedConsensus) {
      const traceWidth = Number(
        (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_TRACE_ITEMS ?? '4',
      );
      const traceDepth = Number(
        (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_TRACE_RING ?? '520',
      );
      const commitmentWidth = Number(
        (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_TRACE_COMMITMENT ?? '24',
      );
      for (const idx of candidates) {
        let helper54: Array<{ opcode: number; data?: Uint8Array }> | undefined;
        let pendingInvokeId: string | undefined;
        const invokedBodies = new Map<number, Set<string>>();
        const ring: Array<{
          ip: number; opcode: number; depth: number; top: string[]; data?: string; bodyLen: number;
        }> = [];
        const vm = createVirtualMachineBch2026ForProvider(this.builderOptions.provider, {
          opcodes: new Set(Array.from({ length: 256 }, (_unused, opcode) => opcode)),
          beforeOperation: (unknownState) => {
            const state = unknownState as {
              ip: number; instructions: Array<{ opcode: number; data?: Uint8Array }>; stack: Uint8Array[];
            };
            const instruction = state.instructions[state.ip];
            if (state.ip === 0 && pendingInvokeId !== undefined) {
              const ids = invokedBodies.get(state.instructions.length) ?? new Set<string>();
              ids.add(pendingInvokeId);
              invokedBodies.set(state.instructions.length, ids);
              pendingInvokeId = undefined;
            }
            if (instruction?.opcode === 0x8a) {
              pendingInvokeId = binToHex(state.stack[state.stack.length - 1] ?? new Uint8Array());
            }
            if (!helper54 && state.instructions.length === 54) helper54 = state.instructions;
            ring.push({
              ip: state.ip,
              opcode: instruction?.opcode ?? 0,
              // Body length identifies the frame: a failure inside a small outlined helper is usually a defect
              // at its CALL SITE, and the frame change is what points there.
              bodyLen: state.instructions.length,
              depth: state.stack.length,
              data: instruction?.data === undefined ? undefined : binToHex(instruction.data).slice(0, 64),
              top: state.stack.slice(-traceWidth).map((item) => {
                const hex = binToHex(item);
                return hex.length > 40 ? `${hex.slice(0, 40)}..` : hex;
              }),
            });
            if (ring.length > traceDepth) ring.shift();
          },
        });
        const finalState = vm.evaluate({ inputIndex: idx, sourceOutputs, transaction }) as {
          error?: string; stack?: Uint8Array[];
        };
        if (!finalState.error) continue;
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_INPUTS === '1') {
          // eslint-disable-next-line no-console
          console.error(`[srcOutputs 100-126] ${sourceOutputs.slice(100, 127)
            .map((so, k) => `${100 + k}:`
              + `${so.token
                ? `nft=${so.token.nft?.commitment ? binToHex(so.token.nft.commitment) : '(none)'}`
                : 'PLAIN'}`).join('  ')}`);
        }
        const finalStack = (finalState.stack ?? []).map((item, itemIndex) => {
          const hex = binToHex(item);
          return `    [${itemIndex}] ${hex.length > 80 ? `${hex.slice(0, 80)}..(${item.length}B)` : hex}`;
        }).join('\n');
        // eslint-disable-next-line no-console
        console.error(`[covenant VM trace] input ${idx}: ${finalState.error}\nunlocking=${binToHex(transaction.inputs[idx].unlockingBytecode)}\nprobeUnlocking105=${binToHex(transaction.inputs[105]?.unlockingBytecode ?? new Uint8Array())}\nprobeUnlocking106=${binToHex(transaction.inputs[106]?.unlockingBytecode ?? new Uint8Array())}\ninvokedBodies=${JSON.stringify([...invokedBodies].map(([length, ids]) => [length, [...ids]]))}\nhelper54=${helper54?.map((instruction) => instruction.data === undefined ? instruction.opcode.toString(16).padStart(2, '0') : `${instruction.opcode.toString(16).padStart(2, '0')}(${binToHex(instruction.data)})`).join(' ')}\n${ring.map((step, stepIndex) => (
          `  ip=${step.ip} op=0x${step.opcode.toString(16).padStart(2, '0')}`
          + `${step.data === undefined ? '' : `(${step.data})`} body=${step.bodyLen} depth=${step.depth} top=[${step.top.join(' ')}]`
          + (stepIndex === ring.length - 1 ? '  <-- FAILS HERE' : '')
        )).join('\n')}\nfinal stack:\n${finalStack}\ninputs=\n${sourceOutputs.map((input, inputIndex) => (
          `  ${inputIndex}:${binToHex(input.lockingBytecode).slice(0, 80)}:${input.token?.nft?.capability ?? '-'}:`
          + `${binToHex(input.token?.category ?? new Uint8Array()).slice(0, 16)}:`
          + `${binToHex(input.token?.nft?.commitment ?? new Uint8Array()).slice(0, commitmentWidth)}`
        )).join('\n')}\noutputs=\n${transaction.outputs.map((output, outputIndex) => (
          `  ${outputIndex}:${binToHex(output.lockingBytecode).slice(0, 80)}:${output.token?.nft?.capability ?? '-'}:`
          + `${binToHex(output.token?.category ?? new Uint8Array()).slice(0, 16)}:`
          + `${binToHex(output.token?.nft?.commitment ?? new Uint8Array()).slice(0, commitmentWidth)}`
        )).join('\n')}`);
        return;
      }
      return;
    }
    // X109 / X121: this path only PRINTS, so it decides nothing and is left bare deliberately. The gate above
    // is `> 10_000`, so a provider publishing limits AT 10,000 reaches this branch.
    //
    // At `@mem-cash/validation` 0.0.8 - the version this package declares - the published limits DO reach the
    // decider, so a bare VM here can trace a shape the decider judged differently. Being bare makes this
    // tracer stricter than a strict profile and looser than a relaxed one; for a diagnostic that only widens
    // or narrows what gets printed, which is why it is not worth the extra coupling. The deciding twin below
    // reads the provider. See `X109ProviderFaithfulVm.test.ts` and `X121StrictPreflightDecision.test.ts`.
    const vm = createVirtualMachineBch2026();
    for (const idx of candidates) {
      if (idx < 0 || idx >= transaction.inputs.length) continue;
      const states = vm.debug({ inputIndex: idx, sourceOutputs, transaction }) as unknown as Array<{
        ip: number; instructions?: Array<{ opcode: number }>; stack?: Uint8Array[]; error?: string;
      }>;
      const errAt = states.findIndex((s) => s.error);
      if (errAt < 0) continue;
      const lines = [`[covenant VM trace] input ${idx}: ${states[errAt].error}`];
      for (let i = Math.max(0, errAt - 12); i <= errAt; i += 1) {
        const s = states[i];
        const opcode = s.instructions?.[s.ip]?.opcode ?? 0;
        const top = (s.stack ?? []).slice(-2).map((b) => {
          const h = binToHex(b);
          return h.length > 20 ? `${h.slice(0, 20)}..` : (h || '(empty)');
        }).join(' ');
        const marker = i === errAt ? '  <-- FAILS HERE' : '';
        lines.push(`  ip=${s.ip} op=0x${opcode.toString(16).padStart(2, '0')} `
          + `depth=${(s.stack ?? []).length} top=[${top}]${marker}`);
      }
      // The failing body is often a tiny outlined helper, so the defect is at its CALL SITE, not in it. Walk
      // back to the enclosing frames (distinct instruction arrays) and show where each was executing.
      const seen: Array<{ ip: number; count: number }> = [];
      let prev = states[errAt].instructions;
      for (let i = errAt; i >= 0 && seen.length < 4; i -= 1) {
        if (states[i].instructions === prev) continue;
        prev = states[i].instructions;
        seen.push({ ip: states[i].ip, count: states[i].instructions?.length ?? 0 });
      }
      if (seen.length > 0) {
        lines.push(`  callers: ${seen.map((f) => `[count=${f.count} ip=${f.ip}]`).join(' <- ')}`);
        const caller = states.slice(0, errAt + 1).reverse()
          .find((st) => st.instructions !== states[errAt].instructions);
        if (caller) {
          const from = Math.max(0, caller.ip - 10);
          lines.push(`  callerOps: ${(caller.instructions ?? []).slice(from, caller.ip + 2)
            .map((instruction, offset) => `${from + offset}:`
              + `${(instruction as { opcode: number }).opcode.toString(16).padStart(2, '0')}`
              + `${'data' in instruction && instruction.data
                ? `<${binToHex(instruction.data as Uint8Array)}>` : ''}`).join(' ')}`);
        }
      }
      // eslint-disable-next-line no-console
      console.error(lines.join('\n'));
      return;
    }
  }

  private _strictRecursiveVmPreflight(builder: TransactionBuilder): void {
    const transaction = builder.buildLibauthTransaction(true);
    // X121: read the provider's limits. Unlike the tracer above this THROWS, so it decides ACCEPT/REJECT, and
    // a bare VM here decides against a configuration the provider may not be running.
    //
    // VERSION-DEPENDENT, and the pin is `@mem-cash/validation` 0.0.8 - the version
    // `packages/solidcash/package.json` declares (`^0.0.8`, which for a 0.0.x range means exactly 0.0.8) and
    // `yarn.lock` resolves. At 0.0.8 `TxVerifierConfig.consensus` exists and MockNetworkProvider's overrides
    // reach the decider, so this factory AGREES with it on every shape measured, while a bare VM diverges in
    // BOTH directions: it accepts what the provider refuses under a strict profile (P2PKH and recursion at
    // `operationCostBudgetPerByte: 150`) and refuses what the provider accepts under the relaxed default
    // (`decrement(24)`). The first of those is the fail-open direction, which is why this is not left bare.
    //
    // At 0.0.7 the field does not exist and the overrides are silently dropped, which inverts every one of those
    // verdicts. `X121StrictPreflightDecision` asserts the installed version first so a stale tree fails with
    // that as the reason instead of six opaque assertion failures.
    //
    // `standard` is deliberately left at the factory default of `true` rather than tracked to the provider's
    // `policy.enforceDust`. Standard is the stricter regime, so this keeps the residual error fail-closed. No
    // shape was found where the two regimes give different VERDICTS, so tracking it is not known to be needed.
    // X198. ASK `stateSuccess`, NOT `state.error`. libauth defines `success(state)` as "return `state.error` if
    // there is one, otherwise refuse an empty stack or a non-truthy top item", and `createVirtualMachine` hands
    // that same function to `vm.verify` - so `stateSuccess` IS the VM's verification predicate and `state.error`
    // is only its first branch. The gap matters here because the compiler DELETES the final `require`'s
    // OP_VERIFY when the stack is shallow, so a failing final require leaves a falsy top and raises nothing.
    // The old `if (state.error)` was also a truthiness test where `!== undefined` is meant.
    //
    // Scope: this path is opt-in and default-off, and no hostile was constructed against it. The repair is
    // inferred from field semantics that WERE measured, on the sibling decider in `message-bus/preflight.ts`.
    try {
      assertFinalizedTransactionCovenants(builder, transaction);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(reason.replace(/^messageBus: BCH-2026 preflight failed at /, ''));
    }
  }

  async send(): Promise<TransactionDetails> {
    const provider = this.builderOptions.provider;
    if (!provider) {
      throw new Error('No network provider available');
    }


    // -- Phase 1: build the covenant transaction (logic only, no fee) --
    let covenantBuilder = this.build();
    // Production-sized covenants are cheap enough to debug eagerly, which provides useful source-mapped
    // diagnostics before submission. A relaxed mock provider may intentionally admit scripts hundreds of
    // kilobytes long; retaining every VM step for those scripts can take minutes and gigabytes of memory.
    const relaxedConsensus = (provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000;
    // Retained so a later covenant refusal can say WHY. This probe is best-effort, but the rebuild below depends
    // on what it discovers, so when it fails the transaction can be assembled from an unresolved shape and the
    // preflight then refuses it with a bare OP_VERIFY that names no cause.
    let discoveryProbeFailure: string | undefined;
    if (!relaxedConsensus) {
      try { covenantBuilder.debug(); } catch (_e) {
        if (typeof _e === 'object' && _e) {
          discoveryProbeFailure = (_e as Error).message;
          // Consensus-limit refusals cannot be repaired by the final signature and must not be swallowed as a
          // best-effort discovery failure. Fail immediately with the actionable density-reserve guidance.
          if (/exceed the operation cost density limit/.test(discoveryProbeFailure)) {
            throw new Error(
              'BCH-2026 operation-cost budget exceeded while probing the covenant, so the transaction cannot '
              + 'be built. The budget is operationCostBudgetPerByte x unlockingBytecodeLength, and for p2sh32 '
              + 'the redeem script counts toward that length, so reserving script bytes (Contract `salt`) '
              + `raises it. Probe reported: ${discoveryProbeFailure}`,
              { cause: _e },
            );
          }
          console.debug('STB debug() best-effort error:', discoveryProbeFailure);
        }
      }
    }

    // The debug probe can discover commitments and output counts for dynamic C2 inserts/chunks. Rebuild before
    // measuring and funding so the fee calculation sees the converged covenant shape rather than the smaller
    // pre-probe transaction. Otherwise a newly learned entry output is added only by the final build, leaving its
    // dust value unfunded (for example: 2400 sats in, 3600 sats out for the first mapping insertion).
    covenantBuilder = this.build();

    // -- Phase 2: measure shape -> compute fee -> fund --
    // Build the covenant-only tx to measure its byte size.
    const covenantTx = covenantBuilder.buildLibauthTransaction();
    const covenantSize = BigInt(encodeTransaction(covenantTx).byteLength);

    // Estimate the overhead of adding 1 fee input + 1 change output.
    // Fee input: 32 (txid) + 4 (vout) + 1 (scriptLen varint) + unlockingScript + 4 (sequence)
    // For P2SH32 OP_TRUE: unlocking = 2 bytes -> input overhead = 32+4+1+2+4 = 43
    // For P2PKH sig: unlocking ~ 107 bytes -> input overhead = 32+4+1+107+4 = 148
    // Change output: 8 (value) + 1 (scriptLen varint) + scriptLen
    const funderUnlockSize = this.funderUtxos.length > 0
      // A native P2PKH funder (msg.sender / tx.origin sender input) signs over the source outputs, which are not
      // assembled yet at this fee-estimation point, so use the fixed sig+pubkey size (~107 B) instead of signing.
      ? (isP2PKHUnlocker(this.funderUtxos[0].unlocker)
        ? 107
        : this.funderUtxos[0].unlocker.generateUnlockingBytecode(
          { transaction: covenantTx, sourceOutputs: [], inputIndex: 0 },
        ).length)
      : 2; // P2SH32 OP_TRUE default for mocknet
    const feeInputOverhead = 32 + 4 + 1 + funderUnlockSize + 4;
    const changeLockingSize = this.funderChangeAddress?.length ?? 35; // P2SH32 default
    const changeOutputOverhead = 8 + (changeLockingSize < 253 ? 1 : 3) + changeLockingSize;

    // With late chunks, build() already includes the terminal sidecar recreation (or OP_RETURN anchor). Without
    // late chunks, the sidecar recreation is still appended below and must be included in the estimate.
    const sidecarOutputOverhead = this.sidecarUtxo && this.lateValueChunkOutputs.length === 0 ? 50n : 0n;
    const totalEstimatedSize = covenantSize + BigInt(feeInputOverhead) + BigInt(changeOutputOverhead)
      + sidecarOutputOverhead;
    const neededFee = this.computeMinFee(totalEstimatedSize);

    // Create a fee funder if the covenant transaction doesn't already cover
    // the minimum relay fee. Block-layout funders pass through to outputs
    // (input.satoshis -> output.amount), so any surplus they contribute is
    // incidental. A dedicated fee funder ensures the fee is always covered.
    // P2SH32 OP_TRUE funder; its change output uses the same script, so the dust threshold is exact.
    const DUMMY_LBC = new Uint8Array([
      0xaa, 0x20,
      0x95, 0x3c, 0xcf, 0xa5, 0x96, 0xa6, 0xc6, 0xd3, 0x9e, 0x59, 0x80, 0x19, 0x45, 0x39, 0x12, 0x4f,
      0xdc, 0xff, 0x11, 0x6a, 0x57, 0x14, 0x55, 0xa2, 0x12, 0xba, 0xed, 0x81, 0x1f, 0x58, 0x5e, 0xe0,
      0x87,
    ]);
    const DUMMY_UNLOCK = new Uint8Array([0x01, 0x51]);
    const DUST_MINIMUM = getDustThreshold({ lockingBytecode: DUMMY_LBC });

    // Check whether existing inputs already cover the fee
    const existingInputSats = this.allInputs.reduce((sum, inp) => sum + inp.satoshis, 0n);
    const existingOutputSats = covenantBuilder.outputs.reduce((sum, o) => sum + o.amount, 0n);
    const existingFee = existingInputSats - existingOutputSats;
    const alreadyFunded = existingFee >= neededFee;

    if (!alreadyFunded && this._checkMinRelayFee) {
      // When covenant outputs exceed covenant inputs (e.g. return event outputs
      // adding 800 sats each without corresponding inputs), the funder must cover
      // the deficit in addition to the fee and change dust.
      const outputDeficit = existingFee < 0n ? -existingFee : 0n;
      const funderSats = neededFee + DUST_MINIMUM + outputDeficit; // fee + change + deficit
      const dummyTxid = '00'.repeat(31) + 'fe';
      const dummyUtxo = { txid: dummyTxid, vout: 0, satoshis: funderSats };

      // Register with mocknet provider
      if ((provider as any).addUtxo) {
        await (provider as any).addUtxo(binToHex(DUMMY_LBC), dummyUtxo);
        const funder: UnlockableUtxo = {
          ...dummyUtxo,
          unlocker: {
            generateLockingBytecode: () => DUMMY_LBC,
            generateUnlockingBytecode: () => DUMMY_UNLOCK,
          },
        };
        this.funderUtxos.push(funder);
        this.allInputs.push(funder);
        this.funderChangeAddress = DUMMY_LBC;
      }
    }

    // -- Phase 3: rebuild with fee funder + change output, then send --
    // The funder input and change output go past the covenant's block range.
    // The compiler uses blockSize (not OP_TXOUTPUTCOUNT) for bounds checks,
    // so extra outputs don't affect covenant introspection.
    const finalBuilder = this.build();

    if (this.funderUtxos.length > 0) {
      // Funders supplied at construction (auto-derivation) may lack an explicit change address;
      // default change to the funder's own script so over-sized funders don't bloat the fee.
      const changeTo = this.funderChangeAddress
        ?? this.funderUtxos[0].unlocker.generateLockingBytecode();
      const funderOutpoints = new Set(this.funderUtxos.map((f) => `${f.txid}:${f.vout}`));
      const actualFunderInputs = this.allInputs.filter((input) => (
        funderOutpoints.has(`${input.txid}:${input.vout}`)
      ));
      // A configured block-layout funder can be displaced by a covenant input at the same physical offset.
      // Only inputs that are actually serialized may contribute to change; counting the configured pool would
      // create value whenever a slot is occupied by a delegate/data input.
      const funderTotal = actualFunderInputs.reduce((sum, input) => sum + input.satoshis, 0n);
      const covenantInputTotal = this.allInputs
        .filter((input) => !funderOutpoints.has(`${input.txid}:${input.vout}`))
        .reduce((sum, input) => sum + input.satoshis, 0n);
      const covenantOutputTotal = finalBuilder.outputs.reduce((sum, o) => sum + o.amount, 0n);
      const available = funderTotal - (covenantOutputTotal - covenantInputTotal);
      const changeAmount = available - neededFee;

      if (changeAmount >= DUST_MINIMUM) {
        const changeOutput = { to: changeTo, amount: changeAmount };
        // Keep [late chunks][one terminal suffix] contiguous at the end. The compiler authenticates chunk i by
        // counting backward from OP_TXOUTPUTCOUNT, so fee change must precede the entire suffix region.
        this.insertBeforeLateValueSuffix(finalBuilder, changeOutput);
      }
    }

    // Recreate the side-car as the LAST output (its self-preservation verifies the last output).
    // With late chunks it was already emitted by build() as their single terminal suffix.
    if (this.sidecarUtxo && this.lateValueChunkOutputs.length === 0) {
      finalBuilder.addOutput({
        to: this.sidecarUtxo.unlocker.generateLockingBytecode(),
        amount: this.sidecarUtxo.satoshis,
      });
    }

    if (this.strictVmPreflight) {
      try {
        this._strictRecursiveVmPreflight(finalBuilder);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Recursive state invocation failed concrete BCH VM preflight: ${reason}`);
      }
    }

    // X210. The ordinary stateful submit path must verify the exact fully funded transaction too. The
    // recursive flag controls only the earlier, specialized diagnostic; it is not permission to skip covenant
    // evaluation. This gate is deliberately non-absorbing: unlike debug(), it never catches an objection, and
    // `stateSuccess` includes completed scripts with a falsy top item as well as raised VM errors.
    if (!this.strictVmPreflight) {
      try {
        assertFinalizedTransactionCovenants(finalBuilder, finalBuilder.buildLibauthTransaction(true));
      } catch (error) {
        this._logCovenantFailureTrace(finalBuilder, error instanceof Error ? error.message : String(error));
        // Attribution only. The refusal stands and is re-raised UNCHANGED: callers match this message exactly,
        // including anchored patterns, so the explanation rides on `cause` rather than being appended to it.
        if (discoveryProbeFailure !== undefined && error instanceof Error && error.cause === undefined) {
          error.cause = new Error(
            'A covenant discovery probe failed earlier in this send, so any commitments or output counts it '
            + 'would have discovered were unavailable when the transaction was assembled. That is a known cause '
            + 'of this refusal for shapes needing dynamic chunk or entry discovery. The probe reported: '
            + discoveryProbeFailure,
          );
        }
        throw error;
      }
    }

    const rawTx = finalBuilder.build();

    // -- Phase 4: fee sanity checks --
    const { decodeTransactionUnsafe, hash256 } = await import('@bitauth/libauth');
    const rawTxBin = hexToBin(rawTx);
    const totalInputSats = this.allInputs.reduce((sum, inp) => sum + inp.satoshis, 0n)
      + (this.sidecarUtxo?.satoshis ?? 0n); // side-car input is added by build(), not in allInputs
    const decodedTx = decodeTransactionUnsafe(rawTxBin);
    const totalOutputSats = (decodedTx as { outputs: Array<{ valueSatoshis: bigint }> }).outputs
      .reduce((sum, out) => sum + out.valueSatoshis, 0n);
    const fee = totalInputSats - totalOutputSats;

    if (fee < 0n) {
      throw new Error(
        `Transaction outputs (${totalOutputSats} sats) exceed inputs (${totalInputSats} sats). `
        + 'This transaction is invalid. Add more funding inputs or reduce outputs.',
      );
    }

    const txSize = BigInt(encodeTransaction(decodedTx).byteLength);
    const minFee = this.computeMinFee(txSize);
    if (this._checkMinRelayFee && fee < minFee) {
      const fpb = Number(minFee) / Number(txSize);
      throw new Error(
        `Transaction fee of ${fee} satoshis is below the minimum relay fee `
        + `(${minFee} satoshis for a ${txSize}-byte transaction at ${fpb.toFixed(1)} sat/byte). `
        + 'Add more funding inputs or reduce outputs.',
      );
    }

    if (this._maximumFeeSatoshis !== undefined && fee > this._maximumFeeSatoshis) {
      throw new Error(
        `Transaction fee of ${fee} satoshis exceeds the maximum fee cap of ${this._maximumFeeSatoshis} satoshis. `
        + 'Use .withMaxFee() to increase the cap, or reduce the fee.',
      );
    }

    const MAX_FEE_SATS_PER_BYTE = 1000;
    const feePerByte = Number(fee) / Number(txSize);
    if (feePerByte > MAX_FEE_SATS_PER_BYTE) {
      throw new Error(
        `Transaction fee of ${fee} satoshis is ${feePerByte.toFixed(1)} sat/byte, `
        + `exceeding the safety cap of ${MAX_FEE_SATS_PER_BYTE} sat/byte. `
        + 'This may indicate a missing change output. Use .withMaxFee() to override.',
      );
    }

    // Byte rules LAST, immediately before the network sees the bytes, and reading the DECODED broadcast bytes
    // rather than a re-derived shape. A correctness aid, not a security boundary: it refuses at
    // witness-construction time a transaction whose bytes a node would refuse anyway, so the composer learns
    // the arithmetic here instead of reading `64: dust` off a peer. Ordered after the fee checks so a missing
    // change output still reports as a fee problem rather than as whichever relay observation is also true.
    // X158: the same input subjects as site 2, read off the builder that produced these exact bytes, so an
    // over-limit refusal names the contract rather than only an index.
    assertFinalizedTransactionBytes(decodedTx, {
      inputSubjects: inputSubjectsOfBuilder(finalBuilder),
      consensusLimits: provider.consensusLimits,
      // A provider that explicitly widens the transaction-size consensus profile is also the authority that
      // will receive these bytes. This is the mock/miner-direct profile: do not apply the production peer-relay
      // ceiling on top of its advertised limit. Live providers publish no override and remain policy-gated.
      allowNonRelayable: (provider.consensusLimits?.maximumTransactionBytes ?? 100_000) > 100_000,
    });

    // -- Phase 5: submit --
    let txid: string;
    try {
      txid = await provider.sendRawTransaction(rawTx);
    } catch (submitErr) {
      // On a covenant script failure, emit an accurate op-level trace of the actual submitted tx using the
      // 2026 VM (the one mocknet uses). The source-map best-effort above mis-attributes on optimised
      // subroutine bytecode; this points at the exact failing opcode + stack. Diagnostic only - rethrow as-is.
      const reason = (submitErr as Error)?.message ?? '';
      if (/script-verify|OP_[A-Z]|evaluating input/.test(reason)) {
        try { this._logCovenantFailureTrace(finalBuilder, reason); } catch { /* trace is best-effort */ }
      }
      throw submitErr;
    }

    const expectedTxid = binToHex(hash256(rawTxBin).reverse());
    if (txid !== expectedTxid) {
      throw new Error(
        `Txid mismatch: provider returned '${txid}', expected '${expectedTxid}'. `
        + 'The network provider may be compromised.',
      );
    }

    const decoded = decodeTransactionUnsafe(rawTxBin);
    const details = attachWait({ ...decoded, txid, hex: rawTx } as TransactionDetails, this.builderOptions.provider);
    // ethers-v5 receipt.events: decode this tx's own event NFT outputs against the artifact event ABI so a ported
    // suite can do `(await tx.wait()).events[0].args.pair`. Runtime-computed fields (a factory's deployed-child
    // address) come from the real on-chain commitment, not the emit-time placeholder args.
    const emitted = this.decodeEmittedEvents(decoded.outputs as readonly LibauthOutput[]);
    details.events = emitted;
    details.logs = emitted;
    return details;
  }

  /**
   * Decode the event NFT outputs this transaction created into ethers-v5-style receipt events. An output is an
   * event log iff its locking bytecode matches one of the event NFT addresses; its commitment is decoded against
   * that event's ABI. Outputs are scanned in vout order, so `events[0]` is the first-emitted event.
   */
  private decodeEmittedEvents(outputs: readonly LibauthOutput[]): ReceiptEvent[] {
    if (this.eventDefinitions.length === 0 || this.eventNftLockingBytecodes.size === 0) return [];
    const sigByLbc = new Map<string, string>();
    for (const [sig, lbc] of this.eventNftLockingBytecodes) sigByLbc.set(binToHex(lbc), sig);
    const structs = this.stateLayout.structs;
    const events: ReceiptEvent[] = [];
    for (const out of outputs) {
      const commitment = out.token?.nft?.commitment;
      if (commitment === undefined) continue;
      const sig = sigByLbc.get(binToHex(out.lockingBytecode));
      if (sig === undefined) continue;
      const eventDef = this.eventDefinitions.find((e) => e.signature === sig);
      if (!eventDef) continue;
      const commitmentHex = typeof commitment === 'string' ? commitment : binToHex(commitment);
      let named: Record<string, StateValue>;
      try {
        named = parseEventCommitment(commitmentHex, eventDef, structs);
      } catch {
        continue; // commitment did not match this event's ABI - skip (should not happen for a real event NFT)
      }
      events.push({
        event: eventDef.name, eventSignature: eventDef.signature,
        args: buildReceiptEventArgs(eventDef, named),
      });
    }
    for (const detached of this.detachedEventReceipts) {
      const eventDef = this.eventDefinitions.find((event) => event.signature === detached.eventSignature);
      if (!eventDef) continue;
      try {
        const named = parseEventCommitment(detached.commitment, eventDef, structs);
        events.push({
          event: eventDef.name,
          eventSignature: eventDef.signature,
          args: buildReceiptEventArgs(eventDef, named),
        });
      } catch { /* malformed compatibility event - omit from receipt */ }
    }
    return events;
  }
}

/**
 * Build an ethers-v5 `event.args`: decoded params by name (`.args.pair`), plus non-enumerable numeric indices
 * (`.args[0]`, array-like Result parity) and a `toObject()` returning a plain named copy. Non-enumerable extras
 * keep Object.keys / spread / chai deep-equal to just the named fields.
 */
function buildReceiptEventArgs(
  eventDef: EventDefinitionAbi,
  named: Record<string, StateValue>,
): Record<string, unknown> {
  // Attach .toObject()/.toArray() to any struct/array param value so `event.args.someStruct.toObject()` works,
  // matching the getState()/queryFilter boundaries.
  for (const p of eventDef.parameters) attachDecodedAccessors(named[p.name]);
  const args: Record<string, unknown> = { ...named };
  eventDef.parameters.forEach((p, i) => {
    Object.defineProperty(args, String(i), { value: named[p.name], enumerable: false, writable: true, configurable: true });
  });
  Object.defineProperty(args, 'toObject', {
    value: (): Record<string, StateValue> => ({ ...named }), enumerable: false, writable: true, configurable: true,
  });
  return args;
}
