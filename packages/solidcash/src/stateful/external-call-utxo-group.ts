/**
 * phase-boundary extract: ExternalCallUtxoGroup + LLC materialization / EntryNft and transfer info types.
 * (phase-boundary extract from StatefulTransactionBuilder.ts).
 */

import type { AbiFunction, Artifact, FunctionBlockLayout, StateLayout, StateValue } from '@solidcash/utils';
import type { Output, UnlockableUtxo, Utxo } from '../interfaces.js';
import type {
  TransportedContinuationResourceClaim,
  ValueChunkProducerPathDisposition,
  ValueChunkProducerResourceClaim,
} from './ValueChunkProducerIdentity.js';
import type { ValueChunkWriteDescriptor } from './value-chunk-persist.js';

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

export type RuntimeLoopTransferOutput = {
  lockingBytecode: Uint8Array;
  amount: bigint;
  kind?: 'bch' | 'token' | 'nft';
  tokenContainerCategoryId?: string;
  commitment?: Uint8Array;
  capability?: 'none' | 'mutable' | 'minting';
};

/**
 * Contiguous LLC input band for a group. Prefer `blockInputs` (master + data/funders
 * + entry + event) when present so nested publishJobEvent keeps entry locks at
 * INPUTINDEX+offset instead of synthetic OP_TRUE pads.
 */
export function flattenLlcGroupInputs(group: ExternalCallUtxoGroup): UnlockableUtxo[] {
  const master = group.masterUtxo as UnlockableUtxo | undefined;
  const withUnlocker = (input: UnlockableUtxo | Utxo | undefined): UnlockableUtxo[] => (
    input && 'unlocker' in input && input.unlocker ? [input as UnlockableUtxo] : []
  );
  if (group.blockInputs && group.blockInputs.length > 0) {
    return group.blockInputs.flatMap((input) => {
      if (!input) return [];
      if (master
        && input.txid.toLowerCase() === master.txid.toLowerCase()
        && input.vout === master.vout) {
        return withUnlocker(master);
      }
      return withUnlocker(input);
    });
  }
  return [...withUnlocker(master), ...group.dataNftUtxos];
}

export function sameOutpoint(
  left: Pick<Utxo, 'txid' | 'vout'> | undefined,
  right: Pick<Utxo, 'txid' | 'vout'> | undefined,
): boolean {
  return left !== undefined && right !== undefined
    && left.txid.toLowerCase() === right.txid.toLowerCase()
    && left.vout === right.vout;
}

/** Resolve the compiler-owned physical block layout for a low-level call group. */
export function lowLevelCallBlockLayout(group: ExternalCallUtxoGroup): AbiFunction['blockLayout'] {
  return group.blockLayout
    ?? group.compilerRoute?.abiFunction.blockLayout
    ?? (group.externalContract.inner.artifact.abi as readonly AbiFunction[])
      .find((candidate) => candidate.name === group.functionName)?.blockLayout;
}

/**
 * A materialized low-level-call block is identified entirely by physical evidence: its first block input is the
 * group's master outpoint and the compiler published a layout for the companions. Source-level names never grant
 * permission to splice or mirror transaction inputs/outputs.
 */
export function hasMaterializedLowLevelCallBlock(group: ExternalCallUtxoGroup): boolean {
  const layout = lowLevelCallBlockLayout(group);
  if (!group.blockInputs || !layout || layout.blockSize <= 1
    || group.blockInputs.length !== layout.blockSize
    || !sameOutpoint(group.blockInputs[0], group.masterUtxo)) return false;
  // This path knows how to preserve data slots and derive entry/event slots. Every other semantic slot has its
  // own materializer (transfers, token transfers, returns, compute sidecars, deploys, containers, lifecycle and
  // nested calls); admitting one here would silently clone or pad a value that must instead be derived.
  // A block-info oracle is an exact preservation spend: its own covenant validates the pinned
  // authority and unchanged same-index output. It needs no producer or semantic result derivation.
  const supported = new Set(['master', 'dataNft', 'readOnlyDataNft', 'entry', 'event', 'blockInfoOracle']);
  const offsets = new Set<number>();
  for (const slot of layout.slots) {
    if (!supported.has(slot.kind) || !Number.isSafeInteger(slot.offset)
      || slot.offset < 0 || slot.offset >= layout.blockSize || offsets.has(slot.offset)) return false;
    if (slot.kind === 'event' && (!Number.isSafeInteger(slot.slotIndex) || slot.slotIndex! < 0)) return false;
    offsets.add(slot.offset);
  }
  const masters = layout.slots.filter((slot) => slot.kind === 'master');
  return masters.length === 1 && masters[0].offset === 0;
}

/** Select one unambiguous materialized LLC block whose master occupies this physical input. */
export function materializedLowLevelCallBlockAtMaster(
  groups: readonly ExternalCallUtxoGroup[],
  master: Pick<Utxo, 'txid' | 'vout'> | undefined,
): ExternalCallUtxoGroup | undefined {
  const matches = groups.filter((group) => (
    hasMaterializedLowLevelCallBlock(group) && sameOutpoint(group.masterUtxo, master)
  ));
  return matches.length === 1 ? matches[0] : undefined;
}

const outpointIdentity = (utxo: Pick<Utxo, 'txid' | 'vout'>): string =>
  `${utxo.txid.toLowerCase()}:${utxo.vout}`;

/**
 * Restore compiler-described LLC companion adjacency using swaps only. The input multiset and length are
 * invariant: missing, duplicate, shared, or overlapping physical claims fail closed for that block.
 */
export function repairMaterializedLowLevelCallBlocks(
  inputs: UnlockableUtxo[], groups: readonly ExternalCallUtxoGroup[],
): number {
  let repaired = 0;
  const eligible = groups.filter(hasMaterializedLowLevelCallBlock);
  const originalInputs = [...inputs];
  const claimed = new Map<string, number>();
  for (const group of eligible) {
    for (const input of group.blockInputs!) {
      const identity = outpointIdentity(input);
      claimed.set(identity, (claimed.get(identity) ?? 0) + 1);
    }
  }
  // Freeze every admissible ownership range before swapping. Inspecting the live array after an earlier repair
  // could hide that a later destination originally held the earlier group's companion, allowing the later swap
  // to break an already-repaired block.
  const plans = eligible.flatMap((group) => {
    const blockInputs = group.blockInputs!;
    if (blockInputs.some((input) => claimed.get(outpointIdentity(input)) !== 1)) return [];
    const positions = blockInputs.map((wanted) => originalInputs.flatMap((input, index) => (
      sameOutpoint(input, wanted) ? [index] : []
    )));
    if (positions.some((matches) => matches.length !== 1)) return [];
    const masterIndex = positions[0][0];
    if (masterIndex + blockInputs.length > originalInputs.length) return [];
    const ownClaims = new Set(blockInputs.map(outpointIdentity));
    const foreignClaimDestination = originalInputs
      .slice(masterIndex + 1, masterIndex + blockInputs.length)
      .some((occupant) => {
        const identity = outpointIdentity(occupant);
        return claimed.has(identity) && !ownClaims.has(identity);
      });
    if (foreignClaimDestination) return [];
    return [{ blockInputs, masterIndex }];
  });
  for (const { blockInputs, masterIndex } of plans) {
    const intersectsAnotherPlan = plans.some((candidate) => {
      if (candidate.blockInputs === blockInputs) return false;
      const leftEnd = masterIndex + blockInputs.length;
      const rightEnd = candidate.masterIndex + candidate.blockInputs.length;
      return masterIndex < rightEnd && candidate.masterIndex < leftEnd;
    });
    if (intersectsAnotherPlan) continue;
    let changed = false;
    for (let offset = 1; offset < blockInputs.length; offset += 1) {
      const destination = masterIndex + offset;
      const source = inputs.findIndex((input) => sameOutpoint(input, blockInputs[offset]));
      if (source < 0) { changed = false; break; }
      if (source === destination) continue;
      [inputs[destination], inputs[source]] = [inputs[source], inputs[destination]];
      changed = true;
    }
    if (blockInputs.every((wanted, offset) => sameOutpoint(inputs[masterIndex + offset], wanted))) {
      if (changed) repaired += 1;
    }
  }
  return repaired;
}

export interface ExternalCallUtxoGroup {
  categoryId: string;
  stateLayout: StateLayout;
  masterUtxo: Utxo | UnlockableUtxo;
  dataNftUtxos: UnlockableUtxo[];
  requiredDataNftIndices: number[];
  functionName: string;
  functionArgs: any[];
  /** Stable compiler callsite ID; physical group indices may compact past inactive conditional slots. */
  sourceCallsiteId?: number;
  /** Selected ordinary readonly zero-argument frame; aliases may reuse its VM-authenticated result. */
  readonlyReturnSelector?: string;
  externalContract: any; // StatefulContract - kept as any to avoid circular import
  /** Exact authenticated identity of the input which made this CALL/staticcall. Both fields are one authority:
   * entry-key planning uses the bytecode and runtime msg.sender reconstruction uses the category. */
  callerIdentity?: { categoryId: string; lockingBytecode: string };
  /** Source-level invocation represented by this physical group. Proxy/delegate groups execute a different
   * function and argument frame, but transitive graph expansion must resolve compiler argSources against the
   * logical invocation. Its effective `address(this)` is supplied by the authenticated expression context:
   * the physical executor for local delegate execution, or the state owner for an outgoing CALL. */
  logicalFunctionName?: string;
  logicalFunctionArgs?: any[];
  logicalContract?: any; // StatefulContract - kept as any to avoid circular import
  logicalArtifact?: Artifact;
  /** Compiler-authenticated producer/resource occurrences represented by this physical or logical alias. */
  valueChunkProducerClaims?: readonly ValueChunkProducerResourceClaim[];
  /**
   * Ordered per-resource continuation bands under this carrier. Band[0] absolute base is also published as
   * `valueChunkOutputBase` / `__internal__valueChunkOutputBase`; later bands are authenticated here.
   */
  continuationResourceClaims?: readonly TransportedContinuationResourceClaim[];
  /** Claims and exact post-values were transported from a prepared atomic invocation into this final carrier. */
  transportedValueChunkProductions?: boolean;
  /** Exact physical state owner against which producer claims are authenticated. */
  valueChunkStateOwner?: { categoryId: string; lockingBytecode: string };
  callMode?: 'call' | 'staticcall' | 'delegatecall';
  /** If this external callee is itself a proxy, execute/derive its state transition at this delegate group. */
  delegateCallGroupIndex?: number;
  /** The delegate implementation and its function resources are already carried in this physical proxy block. */
  delegateEmbeddedInBlock?: boolean;
  /** Reuses another group's single master/data input/output block for repeated calls to one UTXO contract. */
  sharedGroupIndex?: number;
  /** Honest SDK probe result for a read fused into another call sharing this master input. */
  precomputedReturnCommitment?: Uint8Array;
  /** Consecutive return-event commitments for a rolled loop (meceTags(tags_[i])). */
  loopReturnCommitments?: Uint8Array[];
  /** ABI output array directly populated by this loop call, as proven by compiler metadata. */
  loopResultArrayOutput?: number;
  /** Compiler-proven ceiling for this loop call, when available. */
  loopMaximumOccurrences?: number;
  /** Resolve one reached loop occurrence after the parent return proves its runtime array width. */
  resolveLoopReturnCommitment?: (occurrenceIndex: number) => Promise<Uint8Array>;
  /** Resolve the typed value for direct composition of a compiler-proven returned-array loop. */
  resolveLoopReturnValue?: (occurrenceIndex: number) => Promise<StateValue>;
  /** The arguments of one loop occurrence's call, which that occurrence's call record digests. */
  resolveLoopFunctionArgs?: (occurrenceIndex: number) => any[] | undefined;
  /** Return slot owned by the state-writing call fused into this physical group. */
  fusedReturnGroupIndex?: number;
  /** Absolute output index verified by this physical call's return covenant. */
  returnOutputIndex?: number;
  /** First assignPhysicalReturnIndices result; later reconcile must not move tail placement. */
  plannedReturnOutputIndex?: number;
  /**
   * The received-value pointer-array broadcast list (`__internal__extcallIdxList<slot>`) that names this group's
   * master input, and this group's element in it. Planned from band widths; rebound from the assembled frame.
   */
  broadcastIdxList?: { witness: string; element: number };
  /** Compiler-owned hidden route used for a grouped logical invocation. */
  compilerRoute?: {
    abiFunction: AbiFunction;
    selector: Uint8Array;
    blob: Uint8Array;
    args: any[];
    /** Logical handler selectors already executed by this physical route owner. */
    logicalSelectors: string[];
    /** Decoded Solidity-visible arguments for each authenticated logical row. */
    rowArguments?: Array<{
      selector: string;
      args: any[];
      handler: AbiFunction;
      internalArgs?: Readonly<Record<string, any>>;
      sourceLogicalIndex?: number;
      sourceCallsiteId?: number;
      occurrenceIndex?: number;
      sourceEffectOrdinal?: number;
      producerPath?: ValueChunkProducerPathDisposition;
    }>;
    internalArgs?: Record<string, any>;
    eventSignaturesBySlot?: Array<string | undefined>;
  };
  /** ABI-named hidden witnesses resolved while assembling this callee's physical block. */
  internalArgs?: Record<string, any>;
  /** Immutable ABI names captured by the concrete physical unlocker owned by this group. */
  internalArgNames?: readonly string[];
  /** Hidden return-output ABI witness -> logical external-call group supplying that return. */
  returnWitnessGroups?: Record<string, number>;
  /** Hidden raw return-preimage ABI witness -> logical external-call group supplying that return. */
  returnPreimageWitnessGroups?: Record<string, number>;
  /** Hidden minting-input ABI witness -> category whose final master coordinate it names. */
  mintingInputWitnessCategories?: Record<string, string>;
  /** Rebuild this group's master unlocker after probe-derived hidden witnesses become available. */
  refreshInternalArgs?: (
    updates: Record<string, any>,
    options?: { shiftPredOut?: boolean },
  ) => void;
  /** Rebuild the physical unlocker after compiler-derived visible arguments change during dependency convergence. */
  refreshFunctionArgs?: (args: any[]) => void;
  /** Recompute hidden witnesses derived from a route's visible row arguments (for example, replayed array pushes). */
  refreshRouteDerivedArguments?: (
    rowArguments: readonly {
      selector: string;
      args: any[];
      handler: AbiFunction;
      internalArgs?: Readonly<Record<string, any>>;
      sourceLogicalIndex?: number;
      sourceCallsiteId?: number;
      occurrenceIndex?: number;
      sourceEffectOrdinal?: number;
      producerPath?: ValueChunkProducerPathDisposition;
    }[] | undefined,
    finalVisibleArgs: readonly any[],
  ) => { internalArgs: Record<string, any>; payloadBytes: number };
  /** The carrier master unlocker changed during the current dependency-convergence pass. */
  argumentsRefreshedDuringConvergence?: boolean;
  /** Active message-bus batch blockhash reads, retained until the group's absolute input base is known. */
  graphBlockhashSelections?: Array<{
    readKey: string; slotOrdinal: number; rowArgs: any[]; handler: AbiFunction;
  }>;
  /** B's full block: entry NFTs, token containers, satoshi container, funders for output-only slots */
  blockInputs?: UnlockableUtxo[];
  /** Old dynamic-state chunks consumed by an ordinary direct callee after its master/data block. */
  ordinaryDynamicChunkInputs?: Array<{ name: string; type: string; utxo: UnlockableUtxo }>;
  /** B's function block layout (for full block ordering) */
  blockLayout?: FunctionBlockLayout;
  /** X13: B's block carries a funding input at its published returnEvent offset, so B's return-event NFT is
   * emitted at that offset instead of appended after the whole participant region. */
  returnEventInBlock?: boolean;
  /** A route's chunkable vmap WRITE pins its value chunks as outputs in the callee's TRAILING band. The value is
   * computed on-chain (`publishJobEvent` stamps `block.timestamp` before storing), so the SDK cannot build the
   * chunks off-chain the way `valueChunkMints` does for a caller-known value - the commitments are extracted
   * from the callee's derivation probe and placed here, keyed by block slot. */
  derivedTrailingOutputs?: Map<number, { commitment: string; lockingBytecode: Uint8Array }>;
  /** Lifted runtime event records in this physical callee's trailing band. */
  streamedEventPlan?: import('./nested-streamed-events.js').NestedStreamedEventPlan;
  /** B's event NFT outputs (from auto-derivation of B's VM trace) */
  eventOutputs?: Array<{
    eventSignature: string; commitment: string; lockingBytecode: Uint8Array;
  } | undefined>;
  /** B's keccak256 compute side-car INPUTS (outState path: appended after dataNfts; externalCall path already
   * carries them inside blockInputs). In B's keccak-call order. */
  keccakInputs?: UnlockableUtxo[];
  /** B's keccak256 compute side-car recreation OUTPUTS (both paths), committing each computed R_i. */
  keccakRecreates?: Output[];
  /** B's blockhash(n) oracle co-spend INPUTS (outState path: appended after dataNfts, before keccak side-cars,
   * matching B's block-layout order master < dataNft < blockhashOracle < keccakSideCar). In slot order. */
  blockhashCoSpendUtxos?: UnlockableUtxo[];
  /** B's blockhash(n) oracle recreation OUTPUTS (outState path), self-preserving each (n->hash) oracle. */
  blockhashCoSpendRecreates?: Output[];
  /** Cross-contract callee LOOP write (docs/deferrals.md #1): SDK-computed updated commitments for B's trailing loop
   * entries, in co-spend order. The trailing entries are appended to blockInputs starting at entryLoopStart. */
  entryLoopCommitments?: string[];
  /** blockInputs index where the trailing loop entries begin (== B's blockSize). */
  entryLoopStart?: number;
  /** B's collection signature for the loop entries (for the derive-time master-index unlocker patch). */
  entryLoopCollection?: string;
  /** Sorted entry slots known at planning time to be inserts. Compiler-owned sorted batches
   * place NEW at the fixed entry slot and reserve outputBlockSlot for trailing P'; legacy
   * 1:1 inserts may instead use outputBlockSlot for NEW. */
  plannedEntryInserts?: Array<{
    /** Collection slot this insert targets, when the planner recorded one. */
    slotIndex?: number;
    blockSlot: number;
    outputBlockSlot: number;
    /** Recreated predecessor commitment (P'). */
    commitment?: string;
    /** Initial NEW-node commitment; derivation may replace its value payload. */
    newCommitment?: string;
  }>;
  /** Internal handles for the placeholders above. */
  plannedEntryInsertHandles?: number[];
  /** Hidden output-index arguments stored block-relative until this group's absolute output base is known. */
  relativeOutputInternalArgs?: string[];
  /** Exact vmap predecessor recreations reserved in compiler-route trailing slots. */
  batchPredecessorOutputs?: Array<{
    outputBlockSlot: number; lockingBytecode: Uint8Array; commitment: string;
  }>;
  /** Absolute output index of the first trailing INSERT predecessor after MD tails. */
  relocatedPredOutBase?: number;
  /** Planned continuation-NFT count for a chunkable vmap write (publishJobEvent). */
  valueChunkOutputCount?: number;
  /** Absolute first continuation output selected for this composed write. */
  valueChunkOutputBase?: number;
  /** Exact computed value-chunk writes owned by this physical call. */
  valueChunkWrites?: ValueChunkWriteDescriptor[];
  /** Entry covenant bytecode for fixed sorted-batch target slots. Absent targets use balanced funder inputs,
   * whose locking bytecode must not be mirrored when the active route mints the target node. */
  batchEntryLockingBytecodes?: Map<number, Uint8Array>;
  /** Post-state entry commitments for fixed sorted-batch target slots (keyed by block offset). */
  batchEntryCommitments?: Map<number, string>;
  /** Direct, unambiguous dynamic-write values derived from the callee ABI arguments. */
  dynamicStateValues?: Readonly<Record<string, StateValue>>;
  /** Dynamic chunk inputs occupying a compiler route's balanced trailing band. Write spends are rebound once the
   * physical state-owner master coordinate is known; inactive union resources remain preservation spends. */
  dynamicChunkResources?: Array<{
    blockSlot: number; name: string; type: string; write: boolean;
  }>;
}
