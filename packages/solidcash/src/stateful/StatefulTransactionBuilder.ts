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
  BlockSlotKind,
} from '@solidcash/utils';
import { binToHex, hexToBin, isHex, encodeTransaction } from '@bitauth/libauth';
import { buildEventNftCovenantScript, computeEventNameHash } from '@solidcash/utils';
import { TransactionBuilder, TransactionBuilderOptions } from '../TransactionBuilder.js';
import { scriptToLockingBytecode, generateLibauthSourceOutputs } from '../utils.js';
import type { LibauthOutput } from '../interfaces.js';
import { Utxo, UnlockableUtxo, TransactionDetails } from '../interfaces.js';

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
  /** B's full block: entry NFTs, token containers, satoshi container, funders for output-only slots */
  blockInputs?: UnlockableUtxo[];
  /** B's function block layout (for full block ordering) */
  blockLayout?: FunctionBlockLayout;
  /** B's event NFT outputs (from auto-derivation of B's VM trace) */
  eventOutputs?: Array<{ eventSignature: string; commitment: string; lockingBytecode: Uint8Array }>;
}

export interface StatefulTransactionOptions extends TransactionBuilderOptions {
  masterUtxo: UnlockableUtxo;
  dataNftUtxos: UnlockableUtxo[];
  stateLayout: StateLayout;
  categoryId: string;
  requiredNftIndices?: number[];  // if absent, use all indices
  readOnlyDataNftUtxos?: UnlockableUtxo[];  // read-only data NFTs from other contracts
  entryNfts?: EntryNftInfo[];
  entryAccesses?: readonly EntryAccessAbi[];
  entryNftLockingBytecodes?: Map<string, Uint8Array>; // collection name -> locking bytecode
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
  iterationEntryInputs?: UnlockableUtxo[];
  checkMinRelayFee?: boolean; // enforce fee >= feePerByte * txSize
  minRelayFeePerKb?: bigint;  // satoshis per 1000 bytes; default 1000n (1 sat/byte)
  blockLayout?: FunctionBlockLayout;
  funderUtxos?: UnlockableUtxo[];     // funder UTXOs for output-only slots
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
  private allInputs: UnlockableUtxo[];
  private stateLayout: StateLayout;
  private masterUtxo: UnlockableUtxo;
  private dataNftUtxos: UnlockableUtxo[];
  private categoryId: string;
  private requiredNftIndices: number[];
  private stateUpdates: Map<
  string, StateValue
  > = new Map();

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
  private tokenContainers: TokenContainerInfo[];
  private tokenContainerLockingBytecodes: Map<string, Uint8Array>;
  private satoshiContainerUtxo?: UnlockableUtxo;
  private satoshiContainerLockingBytecode?: Uint8Array;
  private containerDepositAmount: bigint = 0n;
  private pendingTokenContainerTransfers: TokenContainerTransferData[] = [];
  private pendingTokenContainerTransferNfts: TokenContainerTransferNftData[] = [];
  private tokenContainerTransferInsertionCounter = 0;
  private readOnlyDataNftUtxos: UnlockableUtxo[];
  private externalOutStateUtxoGroups: ExternalCallUtxoGroup[];
  private externalCallUtxoGroups: ExternalCallUtxoGroup[];
  private lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
  private lowLevelCallRawInputs: UnlockableUtxo[];
  private iterationEntryInputs: UnlockableUtxo[];
  private blockLayout?: FunctionBlockLayout;
  funderUtxos: UnlockableUtxo[];
  private funderChangeAddress?: Uint8Array;

  private externalCallStateUpdates: Map<
  string, Map<string, StateValue>
  > = new Map(); // categoryId -> (varName -> value)

  private pendingReturnEventOutputs: Array<{ categoryId: string; commitment: Uint8Array }> = [];
  private entryRawCommitments: Map<number, string> = new Map(); // slotIndex -> hex commitment (from auto-derivation)
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
    this.externalOutStateUtxoGroups = options.externalOutStateUtxoGroups ?? [];
    this.externalCallUtxoGroups = options.externalCallUtxoGroups ?? [];
    this.lowLevelCallUtxoGroups = options.lowLevelCallUtxoGroups ?? [];
    this.lowLevelCallRawInputs = options.lowLevelCallRawInputs ?? [];
    this.entryNfts = options.entryNfts ?? [];
    this.entryNftLockingBytecodes = options.entryNftLockingBytecodes ?? new Map();
    this.eventDefinitions = options.eventDefinitions ?? [];
    this.eventNftLockingBytecodes = options.eventNftLockingBytecodes ?? new Map();
    this.tokenContainers = options.tokenContainers ?? [];
    this.tokenContainerLockingBytecodes = options.tokenContainerLockingBytecodes ?? new Map();
    this.satoshiContainerUtxo = options.satoshiContainerUtxo;
    this.satoshiContainerLockingBytecode = options.satoshiContainerLockingBytecode;
    this.iterationEntryInputs = options.iterationEntryInputs ?? [];
    this._maximumFeeSatoshis = options.maximumFeeSatoshis;
    this.blockLayout = options.blockLayout;
    this.funderUtxos = options.funderUtxos ?? [];

    // Default to all NFT indices if not specified
    this.requiredNftIndices = options.requiredNftIndices
      ?? Array.from({ length: options.stateLayout.dataNftCount }, (_, i) => i);

    // Flatten external outState inputs: [B1's master, B1's data NFTs, ...]
    const externalOutStateInputs: UnlockableUtxo[] = [];
    for (const group of this.externalOutStateUtxoGroups) {
      externalOutStateInputs.push(group.masterUtxo as UnlockableUtxo);
      externalOutStateInputs.push(...group.dataNftUtxos);
    }

    // Flatten external call inputs - use full block when available
    const externalCallInputs: UnlockableUtxo[] = [];
    for (const group of this.externalCallUtxoGroups) {
      if (group.blockInputs && group.blockInputs.length > 0) {
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
    if (this.blockLayout && this.funderUtxos.length > 0 && !hasExternalGroups) {
      const funderPool = [...this.funderUtxos];
      // Position-indexed array: each element goes at its slot.offset
      const positioned: (UnlockableUtxo | undefined)[] = new Array(this.blockLayout.blockSize);
      let dataNftIdx = 0, readOnlyIdx = 0, entryIdx = 0, tcIdx = 0;
      let llcIdx = 0; // low-level call input index

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
          case 'entry':
            if (entryIdx < entryInputs.length) positioned[slot.offset] = entryInputs[entryIdx++];
            else { const f = funderPool.shift(); if (f) positioned[slot.offset] = f; }
            break;
          case 'satoshiContainer':
            if (satoshiContainerInputs.length > 0) positioned[slot.offset] = satoshiContainerInputs[0];
            break;
          case 'tokenContainer':
            if (tcIdx < tokenContainerInputs.length) positioned[slot.offset] = tokenContainerInputs[tcIdx++];
            else { const f = funderPool.shift(); if (f) positioned[slot.offset] = f; }
            break;
          case 'lowLevelCall':
            // Place the actual low-level call input (target master) at its block layout
            // position so the compiler's emitBlockSlotIndex reads the correct INPUTBYTECODE.
            if (llcIdx < lowLevelCallInputs.length) positioned[slot.offset] = lowLevelCallInputs[llcIdx++];
            else { const f = funderPool.shift(); if (f) positioned[slot.offset] = f; }
            break;
          case 'transfer': case 'tcTransfer': case 'event': case 'returnEvent':
          case 'deploy': {
            const f = funderPool.shift();
            if (f) positioned[slot.offset] = f;
            break;
          }
          default: break;
        }
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
        // Any overflow gap inputs that didn't fit
        ...gapInputs.slice(gapIdx),
        // Remaining low-level call inputs not already positioned in block layout slots
        ...lowLevelCallInputs.slice(llcIdx), ...this.lowLevelCallRawInputs,
        ...this.iterationEntryInputs,
        // Leftover funders not consumed by block layout slots (fee-only inputs)
        ...funderPool,
      ];
    }

    // Legacy ordering - funders go at the end (past all covenant inputs).
    return [
      this.masterUtxo, ...this.dataNftUtxos, ...this.readOnlyDataNftUtxos,
      ...externalOutStateInputs, ...externalCallInputs,
      ...lowLevelCallInputs, ...this.lowLevelCallRawInputs,
      ...entryInputs, ...this.iterationEntryInputs,
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
      if (g.blockInputs && g.blockInputs.length > 0) {
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
      throw new Error(`Unknown state variable: ${name}`);
    }
    this.stateUpdates.set(name, value);
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
   * Build and finalize the transaction, creating data NFT outputs with updated commitments.
   */
  /**
   * Set a return event output for a cross-contract call.
   */
  setReturnEventOutput(categoryId: string, commitment: Uint8Array): this {
    // Upsert: replace existing entry for this categoryId, or append.
    // For multiple return events with the same categoryId (rare), this replaces the first match.
    const existing = this.pendingReturnEventOutputs.findIndex((r) => r.categoryId === categoryId);
    if (existing >= 0) {
      this.pendingReturnEventOutputs[existing] = { categoryId, commitment };
    } else {
      this.pendingReturnEventOutputs.push({ categoryId, commitment });
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
    let base = 1 + this.dataNftUtxos.length + this.readOnlyDataNftUtxos.length;
    for (let i = 0; i < groupIdx; i++) {
      base += 1 + this.externalOutStateUtxoGroups[i].dataNftUtxos.length;
    }
    return base;
  }

  /**
   * Get the output index where outState group's master NFT output starts.
   */
  getExternalOutStateOutputBase(groupIdx: number): number {
    let base = 1 + this.requiredNftIndices.length + this.readOnlyDataNftUtxos.length;
    for (let i = 0; i < groupIdx; i++) {
      base += 1 + this.externalOutStateUtxoGroups[i].dataNftUtxos.length;
    }
    return base;
  }

  /**
   * Get the master input index for an external call group.
   */
  getExternalCallMasterInputIndex(groupIdx: number): number {
    let base = 1 + this.dataNftUtxos.length + this.readOnlyDataNftUtxos.length;
    // Skip outState inputs
    for (const g of this.externalOutStateUtxoGroups) {
      base += 1 + g.dataNftUtxos.length;
    }
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
    let base = 1 + this.requiredNftIndices.length + this.readOnlyDataNftUtxos.length;
    // Skip outState outputs
    for (const g of this.externalOutStateUtxoGroups) {
      base += 1 + g.dataNftUtxos.length;
    }
    for (let i = 0; i < groupIdx; i++) {
      const g = this.externalCallUtxoGroups[i];
      // Use full block size when available
      base += g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length;
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
    let base = 1 + this.dataNftUtxos.length + this.readOnlyDataNftUtxos.length;
    // Skip outState inputs
    for (const g of this.externalOutStateUtxoGroups) {
      base += 1 + g.dataNftUtxos.length;
    }
    // Skip external call inputs (use full block size when available)
    for (const g of this.externalCallUtxoGroups) {
      base += g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length;
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
  build(): TransactionBuilder {
    // Allow implicit NFT burn when entries are being deleted
    // Apply max fee override if set (user-specified via withMaxFee takes precedence)
    // Always skip the inner TransactionBuilder's fee check - it can't understand
    // covenant-managed outputs. The STB performs its own fee check in send().
    const baseOpts = this._maximumFeeSatoshis !== undefined
      ? { ...this.builderOptions, skipFeeCheck: true, maximumFeeSatoshis: this._maximumFeeSatoshis }
      : { ...this.builderOptions, skipFeeCheck: true };
    const opts = this.entryDeletes.size > 0
      ? { ...baseOpts, allowImplicitNftBurn: true }
      : baseOpts;
    const builder = new TransactionBuilder(opts);
    builder.addInputs(this.allInputs);

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

      const commitment = buildPushdataCommitment(this.stateLayout, currentState, nftIdx);

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
        const commitment = buildPushdataCommitment(group.stateLayout, bCurrentState, nftIdx);

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

    // Create external call outputs (B's master preserved + B's data NFTs with updated state)
    for (const group of this.externalCallUtxoGroups) {
      // B's master output: preserved unchanged
      const bMaster = group.masterUtxo as UnlockableUtxo;
      builder.addOutput({
        to: bMaster.unlocker.generateLockingBytecode(),
        amount: bMaster.satoshis,
        token: bMaster.token,
      });

      // .staticcall / .delegatecall: preserve exact input commitments (no state changes allowed on target)
      if (group.callMode === 'staticcall' || group.callMode === 'delegatecall') {
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

      // Create B's data NFT outputs with updated commitments
      for (let i = 0; i < group.requiredDataNftIndices.length; i++) {
        const nftIdx = group.requiredDataNftIndices[i];
        const nftUtxo = group.dataNftUtxos[i];
        const commitment = buildPushdataCommitment(group.stateLayout, bCurrentState, nftIdx);

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

      // Full block: output B's remaining slots (entries, SC, TCs, transfers, events, etc.)
      if (group.blockInputs && group.blockLayout) {
        // The blockInputs already include master + dataNfts at positions 0..D.
        // The remaining positions (D+1..) need corresponding outputs.
        const dataNftEnd = 1 + group.requiredDataNftIndices.length;
        let eventIdx = 0;
        for (let si = dataNftEnd; si < group.blockInputs.length; si++) {
          const input = group.blockInputs[si];
          const slot = group.blockLayout.slots[si];

          // Event slots: use auto-derived event NFT output or placeholder
          if (slot?.kind === 'event') {
            if (group.eventOutputs && eventIdx < group.eventOutputs.length) {
              // Use auto-derived commitment
              const eo = group.eventOutputs[eventIdx];
              builder.addOutput({
                to: eo.lockingBytecode,
                amount: 1200n,
                token: {
                  amount: 0n,
                  category: group.categoryId,
                  nft: { capability: 'none', commitment: eo.commitment },
                },
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
      }
    }

    // Create entry NFT outputs (written/preserved entries, excluding deleted ones)
    for (const entry of this.entryNfts.sort((a, b) => a.slotIndex - b.slotIndex)) {
      if (this.entryDeletes.has(entry.slotIndex)) continue;

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
      // Minimum dust amount for a P2SH32 output: 444 + 32 (script) * 3 = 540 sats
      const DUST_MINIMUM = 540n;
      if (remainingAmount > 0n && remainingAmount < DUST_MINIMUM) {
        throw new Error(
          `Satoshi container remaining balance (${remainingAmount}) is below dust threshold (${DUST_MINIMUM}). `
          + 'Either transfer all satoshis (fully drain) or leave at least the dust minimum.',
        );
      }
      if (remainingAmount >= DUST_MINIMUM) {
        const lockingBytecode = this.satoshiContainerLockingBytecode
          ?? this.satoshiContainerUtxo.unlocker.generateLockingBytecode();

        builder.addOutput({
          to: lockingBytecode,
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

    // Create transfer outputs (plain BCH, no tokens)
    // Skip inactive conditional transfers (empty locking bytecode from unbalanced branches)
    for (const transfer of this.pendingTransfers) {
      if (transfer.lockingBytecode.length === 0) continue;
      builder.addOutput({
        to: transfer.lockingBytecode,
        amount: transfer.amount,
      });
    }

    // Create token container transfer outputs (FT and NFT interleaved in source-code order)
    // The compiler assigns sequential transfer indices in source order, so the SDK must
    // produce outputs in the same order to match covenant verification expectations.
    const allTcTransfers: Array<{ type: 'ft'; data: TokenContainerTransferData } | { type: 'nft'; data: TokenContainerTransferNftData }> = [
      ...this.pendingTokenContainerTransfers.map((d) => ({ type: 'ft' as const, data: d })),
      ...this.pendingTokenContainerTransferNfts.map((d) => ({ type: 'nft' as const, data: d })),
    ];
    allTcTransfers.sort((a, b) => a.data.insertionOrder - b.data.insertionOrder);

    for (const entry of allTcTransfers) {
      if (entry.type === 'ft') {
        builder.addOutput({
          to: entry.data.lockingBytecode,
          amount: 1000n,
          token: {
            amount: entry.data.amount,
            category: entry.data.tokenContainerCategoryId,
          },
        });
      } else {
        builder.addOutput({
          to: entry.data.lockingBytecode,
          amount: 1000n,
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
          if (!isHex(value)) {
            throw new Error(`Invalid event argument at index ${i}: expected a hex string, got '${value}'`);
          }
          value = hexToBin(value);
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

    for (const eo of eventOutputEntries) {
      if (!eo) continue;
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

    // Create return event outputs (from cross-contract calls with return values)
    for (const re of this.pendingReturnEventOutputs) {
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

    // Create low-level call outputs (after A's block slots, matching block layout ordering)
    for (const group of this.lowLevelCallUtxoGroups) {
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
        const commitment = buildPushdataCommitment(group.stateLayout, bCurrentState, nftIdx);
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

    // Iteration entry outputs (after fixed block, matching input ordering)
    for (const iterUtxo of this.iterationEntryInputs) {
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

    // Append any extra outputs buffered via addOutput()
    for (const output of this.pendingOutputs) {
      builder.addOutput(output);
    }

    // No change output - adding outputs past the block range changes
    // OP_TXOUTPUTCOUNT, which the covenant's bounds checks rely on.
    // Instead, funder UTXOs are sized to exactly cover the fee (see
    // sizeFunderForFee()) so no change is needed.

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
    const outStateOutputCount = this.externalOutStateUtxoGroups.reduce(
      (sum, g) => sum + 1 + g.dataNftUtxos.length, 0,
    );
    const externalCallOutputCount = this.externalCallUtxoGroups.reduce(
      (sum, g) => (g.blockInputs ? sum + g.blockInputs.length : sum + 1 + g.dataNftUtxos.length), 0,
    );
    // Low-level call outputs are now AFTER entries/SC/TCs/transfers/events (matching block layout)
    return masterOutputCount + dataNftOutputCount + readOnlyOutputCount
      + outStateOutputCount + externalCallOutputCount;
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
    const layoutOffset = this.getBlockSlotOffset('returnEvent');
    if (layoutOffset !== undefined) return layoutOffset;
    return this.getEventOutputBase() + this.getEventOutputCount();
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
    const outStateInputCount = this.externalOutStateUtxoGroups.reduce(
      (sum, g) => sum + 1 + g.dataNftUtxos.length, 0,
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
    return masterInputCount + dataNftInputCount + readOnlyInputCount
      + outStateInputCount + externalCallInputCount + lowLevelCallInputCount
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
    return this.getEventOutputBase() + eventOutputCount
      + this.pendingReturnEventOutputs.length
      + lowLevelCallOutputCount
      + iterationEntryOutputCount
      + this.pendingOutputs.length
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

  async send(): Promise<TransactionDetails> {
    const provider = this.builderOptions.provider;
    if (!provider) {
      throw new Error('No network provider available');
    }

    // -- Phase 1: build the covenant transaction (logic only, no fee) --
    const covenantBuilder = this.build();
    try { covenantBuilder.debug(); } catch (_e) {
      if (typeof _e === 'object' && _e) console.debug('STB debug() best-effort error:', (_e as Error).message);
    }

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
      ? this.funderUtxos[0].unlocker.generateUnlockingBytecode(
        { transaction: covenantTx, sourceOutputs: [], inputIndex: 0 },
      ).length
      : 2; // P2SH32 OP_TRUE default for mocknet
    const feeInputOverhead = 32 + 4 + 1 + funderUnlockSize + 4;
    const changeLockingSize = this.funderChangeAddress?.length ?? 35; // P2SH32 default
    const changeOutputOverhead = 8 + (changeLockingSize < 253 ? 1 : 3) + changeLockingSize;

    const totalEstimatedSize = covenantSize + BigInt(feeInputOverhead) + BigInt(changeOutputOverhead);
    const neededFee = this.computeMinFee(totalEstimatedSize);

    // Create a fee funder if the covenant transaction doesn't already cover
    // the minimum relay fee. Block-layout funders pass through to outputs
    // (input.satoshis -> output.amount), so any surplus they contribute is
    // incidental. A dedicated fee funder ensures the fee is always covered.
    const DUST_MINIMUM = 600n; // P2SH32 dust threshold is 576; use 600 for margin

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
        const DUMMY_LBC = new Uint8Array([
          0xaa, 0x20,
          0x95, 0x3c, 0xcf, 0xa5, 0x96, 0xa6, 0xc6, 0xd3, 0x9e, 0x59, 0x80, 0x19, 0x45, 0x39, 0x12, 0x4f,
          0xdc, 0xff, 0x11, 0x6a, 0x57, 0x14, 0x55, 0xa2, 0x12, 0xba, 0xed, 0x81, 0x1f, 0x58, 0x5e, 0xe0,
          0x87,
        ]);
        const DUMMY_UNLOCK = new Uint8Array([0x01, 0x51]);
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

    if (this.funderChangeAddress && this.funderUtxos.length > 0) {
      const funderTotal = this.funderUtxos.reduce((sum, f) => sum + f.satoshis, 0n);
      const covenantInputTotal = this.allInputs
        .filter((inp) => !this.funderUtxos.some((f) => f.txid === inp.txid && f.vout === inp.vout))
        .reduce((sum, inp) => sum + inp.satoshis, 0n);
      const covenantOutputTotal = finalBuilder.outputs.reduce((sum, o) => sum + o.amount, 0n);
      const available = funderTotal - (covenantOutputTotal - covenantInputTotal);
      const changeAmount = available - neededFee;

      if (changeAmount >= DUST_MINIMUM) {
        finalBuilder.addOutput({ to: this.funderChangeAddress, amount: changeAmount });
      }
    }

    const rawTx = finalBuilder.build();

    // -- Phase 4: fee sanity checks --
    const { decodeTransactionUnsafe, hash256 } = await import('@bitauth/libauth');
    const rawTxBin = hexToBin(rawTx);
    const totalInputSats = this.allInputs.reduce((sum, inp) => sum + inp.satoshis, 0n);
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

    // -- Phase 5: submit --
    const txid = await provider.sendRawTransaction(rawTx);

    const expectedTxid = binToHex(hash256(rawTxBin).reverse());
    if (txid !== expectedTxid) {
      throw new Error(
        `Txid mismatch: provider returned '${txid}', expected '${expectedTxid}'. `
        + 'The network provider may be compromised.',
      );
    }

    const decoded = decodeTransactionUnsafe(rawTxBin);
    return { ...decoded, txid, hex: rawTx } as TransactionDetails;
  }
}
