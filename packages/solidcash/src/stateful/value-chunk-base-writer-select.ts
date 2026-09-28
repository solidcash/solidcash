/**
 * phase-boundary extract: Value-chunk output-base refresh/resolve, protected loop entry select,
 * compiler writer-event select, StatefulTransactionOptions, immutable event destinations.
 * (phase-boundary extract from StatefulTransactionBuilder.ts).
 */

import { binToHex } from '@bitauth/libauth';
import type {
  AbiFunction,
  Artifact,
  EntryAccessAbi,
  EventDefinitionAbi,
  FunctionBlockLayout,
  StateLayout,
} from '@solidcash/utils';
import { computeCollectionHash } from '@solidcash/utils';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilderOptions } from '../TransactionBuilder.js';
import { absoluteValueChunkOutputBaseFromResolve } from '../message-bus/layout-resolver.js';
import {
  permitsLegacyNamedValueChunkFallback,
} from './chunkable-value-write-selection.js';
import {
  type EntryNftInfo,
  type ExternalCallUtxoGroup,
  type RuntimeLoopTransferOutput,
  type TokenContainerInfo,
} from './external-call-utxo-group.js';
import {
  type KernelEntryJournalEagerOutputPlanEntry,
  type KernelEntryJournalSettlementOutputPlanEntry,
} from './KernelEntryJournal.js';
import {
  LEGACY_JOB_EVENTS_COLLECTION_ALIASES,
} from './legacy-planning-heuristics.js';
import type { ValueChunkWriteStagingSession } from './value-chunk-persist.js';

/** Rebind a continuation coordinate only on the concrete unlocker ABI which captured that hidden argument. */
export function ownsCapturedValueChunkOutputBase(group: ExternalCallUtxoGroup): boolean {
  const inputNames = group.internalArgNames
    ?? group.compilerRoute?.abiFunction.inputs.map((input) => input.name);
  if (inputNames?.includes('__internal__valueChunkOutputBase') === true) return true;
  const masterUnlocker = (group.masterUtxo as UnlockableUtxo | undefined)?.unlocker as {
    abiFunction?: { inputs?: readonly { name: string }[] };
  } | undefined;
  return masterUnlocker?.abiFunction?.inputs?.some(
    (input) => input.name === '__internal__valueChunkOutputBase',
  ) === true;
}

export function refreshCapturedValueChunkOutputBase(
  group: ExternalCallUtxoGroup,
  outputBase: number,
  options: {
    shiftPredOut?: boolean;
    /** When published trailing geometry is known, outputBase must equal one layout resolve. */
    resolveAuthority?: {
      publishedBase: number;
      blockSize: number;
      trailingBase: number;
      trailingCapacity?: number;
      valueChunkBandOffset?: number;
      valueChunkCollection?: string;
      valueChunkCount?: number;
    };
  } = { shiftPredOut: false },
): boolean {
  if (!ownsCapturedValueChunkOutputBase(group)) return false;
  let absolute = outputBase;
  if (options.resolveAuthority !== undefined) {
    absolute = absoluteValueChunkOutputBaseFromResolve({
      ...options.resolveAuthority,
      valueChunkCollection: options.resolveAuthority.valueChunkCollection
        ?? group.valueChunkWrites?.[0]?.collection,
    });
    if (absolute !== outputBase) {
      throw new Error(
        `layout-authority: valueChunkOutputBase ${outputBase} !== resolve ${absolute}`,
      );
    }
  }
  group.valueChunkOutputBase = absolute;
  group.internalArgs = {
    ...group.internalArgs,
    __internal__valueChunkOutputBase: BigInt(absolute),
  };
  group.refreshInternalArgs?.(
    { __internal__valueChunkOutputBase: BigInt(absolute) }, options,
  );
  return true;
}

/**
 * Assign absolute valueChunkOutputBase from ResolvedLayout only (item 2 sole authority).
 * Prefer this over inventing publishedBase+local outside the resolver.
 */
export function assignValueChunkOutputBaseFromResolve(
  group: ExternalCallUtxoGroup,
  resolveAuthority: {
    publishedBase: number;
    blockSize: number;
    trailingBase: number;
    trailingCapacity?: number;
    valueChunkBandOffset?: number;
    valueChunkCollection?: string;
    valueChunkCount?: number;
  },
  options: { shiftPredOut?: boolean } = { shiftPredOut: false },
): number {
  const absolute = absoluteValueChunkOutputBaseFromResolve({
    ...resolveAuthority,
    valueChunkCollection: resolveAuthority.valueChunkCollection
      ?? group.valueChunkWrites?.[0]?.collection,
  });
  refreshCapturedValueChunkOutputBase(group, absolute, {
    ...options,
    resolveAuthority: { ...resolveAuthority, valueChunkCollection: resolveAuthority.valueChunkCollection
      ?? group.valueChunkWrites?.[0]?.collection },
  });
  return absolute;
}

export type ProtectedLoopEntryCollectionSelection =
  | { status: 'absent'; collections: readonly string[] }
  | { status: 'exact'; collections: string[] }
  | { status: 'ambiguous'; collections: string[] };

/** Select collection locks which same-index INSERT repair must not use as disposable relocation pads. */
export function selectProtectedLoopEntryCollections(
  groups: ReadonlyArray<Pick<ExternalCallUtxoGroup,
    'functionName' | 'logicalFunctionName' | 'compilerRoute' | 'logicalArtifact' | 'externalContract'
    | 'blockLayout' | 'plannedEntryInserts' | 'valueChunkWrites'>>,
  ownerConvention?: 'legacy-unroll' | 'kernel-row-loop',
): ProtectedLoopEntryCollectionSelection {
  let described = false;
  let ambiguous = false;
  const collections = new Set<string>();
  for (const group of groups) {
    if (group.valueChunkWrites !== undefined) {
      described = true;
      for (const write of group.valueChunkWrites) {
        try {
          if (binToHex(computeCollectionHash(write.collectionSignature))
            !== write.collectionHash.toLowerCase()) {
            ambiguous = true;
            continue;
          }
          collections.add(write.collection);
          collections.add(write.collectionSignature);
        } catch {
          ambiguous = true;
        }
      }
    }
    if (group.plannedEntryInserts === undefined) continue;
    described = true;
    const artifact = group.logicalArtifact ?? group.externalContract?.inner?.artifact;
    const logicalName = group.logicalFunctionName ?? group.functionName;
    const abiFunction = group.compilerRoute?.abiFunction
      ?? artifact?.abi.find((candidate: AbiFunction) => candidate.name === logicalName);
    const layout = abiFunction?.blockLayout ?? group.blockLayout;
    if (!abiFunction?.entryAccesses || !layout) {
      if (group.plannedEntryInserts.length > 0) ambiguous = true;
      continue;
    }
    for (const insert of group.plannedEntryInserts) {
      const slot = layout.slots.find((candidate: FunctionBlockLayout['slots'][number]) => (
        candidate.kind === 'entry' && candidate.offset === insert.blockSlot
      ));
      const access = slot?.slotIndex === undefined ? undefined : abiFunction.entryAccesses[slot.slotIndex];
      if (!access?.operations.includes('write')) {
        ambiguous = true;
        continue;
      }
      collections.add(access.collection);
    }
  }
  if (!described) return {
    status: 'absent',
    collections: permitsLegacyNamedValueChunkFallback(groups, ownerConvention)
      ? [LEGACY_JOB_EVENTS_COLLECTION_ALIASES[0]] : [],
  };
  return {
    status: ambiguous ? 'ambiguous' : 'exact',
    collections: [...collections],
  };
}

/**
 * Select the input whose covenant emits an external-call event.
 *
 * A proxied call executes at its compiler-planned delegate group, so its event slots are relative to that
 * implementation input. Ordinary calls execute at the callee master. Function names are deliberately absent:
 * alpha-renaming either function cannot alter the transaction geometry published by `delegateCallGroupIndex`.
 */
export function selectExternalEventProbeInput(
  group: Pick<ExternalCallUtxoGroup, 'delegateCallGroupIndex'>,
  delegateInputIndex: number,
  calleeInputIndex: number,
): number {
  if (group.delegateCallGroupIndex !== undefined && delegateInputIndex >= 0) return delegateInputIndex;
  return calleeInputIndex;
}

export type CompilerWriterEventCandidate = Pick<ExternalCallUtxoGroup,
  'categoryId' | 'blockLayout' | 'compilerRoute' | 'eventOutputs'>;

export type CompilerWriterEventSelection =
  | { status: 'absent' }
  | { status: 'ambiguous' }
  | {
    status: 'exact'; categoryId: string; slotOffset: number; eventSignature: string;
    eventOutput?: NonNullable<ExternalCallUtxoGroup['eventOutputs']>[number];
  };

/** Collapse physical/logical views of one compiler-described writer event; conflicting claims fail closed. */
export function selectCompilerWriterEvent(
  candidates: ReadonlyArray<CompilerWriterEventCandidate>,
): CompilerWriterEventSelection {
  const claims = new Map<string, Extract<CompilerWriterEventSelection, { status: 'exact' }>>();
  for (const candidate of candidates) {
    const fn = candidate.compilerRoute?.abiFunction;
    const layout = fn?.blockLayout ?? candidate.blockLayout;
    const slots = layout?.slots.filter((slot) => slot.kind === 'event') ?? [];
    const routedSignatures = candidate.compilerRoute?.eventSignaturesBySlot;
    for (const [ordinal, slot] of slots.entries()) {
      const declared = routedSignatures !== undefined
        ? routedSignatures[ordinal]
        : fn?.emits?.find((emit) => emit.emitIndex === ordinal)?.eventSignature;
      const observed = candidate.eventOutputs?.[ordinal];
      if (declared && observed && declared !== observed.eventSignature) return { status: 'ambiguous' };
      const eventSignature = declared ?? observed?.eventSignature;
      if (!eventSignature) continue;
      const key = `${candidate.categoryId.toLowerCase()}:${slot.offset}:${eventSignature}`;
      const prior = claims.get(key);
      if (prior?.eventOutput && observed && (
        prior.eventOutput.commitment !== observed.commitment
        || binToHex(prior.eventOutput.lockingBytecode) !== binToHex(observed.lockingBytecode)
      )) return { status: 'ambiguous' };
      claims.set(key, {
        status: 'exact', categoryId: candidate.categoryId, slotOffset: slot.offset,
        eventSignature, eventOutput: observed ?? prior?.eventOutput,
      });
    }
  }
  if (claims.size === 0) return { status: 'absent' };
  return claims.size === 1 ? [...claims.values()][0] : { status: 'ambiguous' };
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
  /** Compute resources were declared by the routed delegate ABI, so their 1:1 input/output coordinates are
   * relative to the implementation master rather than the proxy state master. */
  delegateComputeResources?: boolean;
  /** Complex keccak preimages that cannot be evaluated until the complete routed transaction exists. The
   * derivation VM learns these from the implementation trace, then rebuilds the ordinary side-car input/output. */
  deferredKeccakCompute?: {
    salt: Uint8Array;
    legacy: boolean;
    preimages: Array<Uint8Array | null>;
  };
  /** Runtime recovery arguments learned from the complete routed trace before replacing probe placeholders. */
  deferredEcrecoverCompute?: {
    salt: Uint8Array;
    argBlobs: Array<Uint8Array | null>;
    /** Per recovery call, index in deferredKeccakCompute.preimages; -1 for non-EVM projections. */
    evmKeccakPreimageIndices: number[];
  };
  ecrecoverComputeCoSpendUtxos?: UnlockableUtxo[]; // recovery A/B side-cars (2 per call, flat A0,B0,A1,B1..) at slots
  ecrecoverComputeRecreates?: Output[];       // parallel recreation OUTPUTS (A commits H_A, B commits the pubkey Q)
  entryNfts?: EntryNftInfo[];
  entryAccesses?: readonly EntryAccessAbi[];
  entryNftLockingBytecodes?: Map<string, Uint8Array>; // collection name -> locking bytecode
  // Dynamic-storage vars (string / unbounded bytes): chunk NFTs created as trailing outputs.
  dynamicChunkVars?: Array<{
    name: string; type: string; lockingBytecode: Uint8Array; delegate?: boolean; delegateSuffix?: boolean;
  }>;
  // Old chunk UTXOs co-spent (destroyed) on a dynamic-storage write; not recreated as outputs.
  dynamicChunkInputs?: UnlockableUtxo[];
  // Inputs which are only destroyed and are never read by the executing contract. In a balanced layout these
  // occupy the high end of the trailing band, opposite neutral output pads, so they cannot overlap new resources.
  trailingDisposalInputs?: UnlockableUtxo[];
  // Collections written by a runtime loop (`for(i<n) m[k[i]]=v[i]`): N new entry NFTs created as trailing
  // outputs (a runtime-variable count, like dynamicChunkVars). Commitments come from auto-derivation.
  loopEntryVars?: Array<{
    collection: string; lockingBytecode: Uint8Array; categoryId?: string; delegate?: boolean; chunkable?: boolean;
  }>;
  /** Ordered event plan produced by a lowered counter-keyed mapping loop, including exact-count event peers
   * before and after it. These live after runtime mapping entries and before dynamic-storage chunks. */
  runtimeLoopEventOutputs?: Array<{
    eventSignature: string; lockingBytecode: Uint8Array; categoryId?: string; commitment?: string;
    /** Zero-based selected route row which produced this occurrence; -1 for a direct non-route call. */
    rowIndex: number;
  }>;
  /** Plain-BCH outputs produced by lowered runtime counter loops. Recipient and amount begin as probe
   * placeholders and are replaced from the covenant trace before the transaction is returned. */
  runtimeLoopTransferOutputs?: RuntimeLoopTransferOutput[];
  /** Physical row order for runtime mapping-entry, event, and BCH-transfer segments. */
  runtimeLoopTrailingSegments?: Array<
  | { kind: 'entries'; collection: string; offset: number; count: number }
  | { kind: 'events'; offset: number; count: number }
  | { kind: 'transfers'; offset: number; count: number }
  >;
  /** Canonical global-record to physical-entry ordering for a kernel carrier settlement. */
  kernelJournalSettlementOutputPlan?: KernelEntryJournalSettlementOutputPlanEntry[];
  /** Source/materialization-ordered outputs which precede the route-final carrier settlement band. */
  kernelJournalEagerOutputPlan?: KernelEntryJournalEagerOutputPlanEntry[];
  eventDefinitions?: readonly EventDefinitionAbi[];
  eventNftLockingBytecodes?: Map<string, Uint8Array>; // eventSignature -> locking bytecode
  tokenContainers?: TokenContainerInfo[];
  tokenContainerLockingBytecodes?: Map<string, Uint8Array>; // tokenContainerCategoryId -> locking bytecode
  satoshiContainerUtxo?: UnlockableUtxo;
  satoshiContainerLockingBytecode?: Uint8Array;
  externalOutStateUtxoGroups?: ExternalCallUtxoGroup[];
  externalCallUtxoGroups?: ExternalCallUtxoGroup[];
  lowLevelCallUtxoGroups?: ExternalCallUtxoGroup[];
  /** Exact root delegate executor selected from compiler-authored forwarding metadata. */
  activeDelegateGroupIndex?: number;
  lowLevelCallRawInputs?: UnlockableUtxo[];
  /** Delegate implementation master/data outputs precede grafted proxy-state entry slots. */
  delegateEntriesAfterLowLevel?: boolean;
  /** Keep routed delegate dynamic chunks in the compiler's output-count-relative suffix without reordering inputs. */
  delegateDynamicChunksAtSuffix?: boolean;
  /** Extra funder pads so nested callees start after a delegated dynamic-value chunk band. */
  delegatedValueChunkPad?: number;
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
  /** Preserve every compiler-published block coordinate, including inactive union-route resource slots. */
  preserveBlockLayoutWidth?: boolean;
  /** Place runtime mapping-entry outputs before newly written dynamic-storage chunks in the trailing frame. */
  loopEntriesBeforeDynamicChunks?: boolean;
  iterationEntryInputs?: UnlockableUtxo[];
  // vmap diff-key insert loop: the N bracketing predecessors, co-spent at input[blockSize+c] but NOT preserved as
  // outputs (unlike iterationEntryInputs) - they are MODIFIED to P' which is emitted via loopEntryVars. Kept separate
  // so they are not counted in the loop-entry output base.
  insertLoopPredecessorInputs?: UnlockableUtxo[];
  keccakLoopSideCars?: UnlockableUtxo[];   // dynamic keccak loop: N trailing compute side-car INPUTS at [blockSize,..)
  keccakLoopRecreates?: Output[];          // ... and their recreation OUTPUTS (R_i per iteration), parallel
  checkMinRelayFee?: boolean; // enforce fee >= feePerByte * txSize
  minRelayFeePerKb?: bigint;  // satoshis per 1000 bytes; default 1000n (1 sat/byte)
  blockLayout?: FunctionBlockLayout;
  /** Convention of the ABI body currently driving this builder. Historical application-name fallbacks must
   * never run for a kernel-owned route, even if every nested group is legacy or descriptor-free. */
  messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
  /** Building one balanced participant of an atomic composition: its block is concatenated after others, so
   * absolute coordinates in route witnesses are not local output indices. */
  composedParticipant?: boolean;
  /** Absolute output index this composed participant's local block starts at (0 when standalone). */
  composedBlockBase?: number;
  /** Per-build mutable chunk candidates. Omitted by directly constructed legacy builders. */
  valueChunkWriteStagingSession?: ValueChunkWriteStagingSession;
  funderUtxos?: UnlockableUtxo[];     // funder UTXOs for output-only slots
  /** Funding inputs already positioned inside composed participant blocks. These contribute value/change but
   * must never be appended or repositioned by this builder's local block assembly. */
  embeddedFunderUtxos?: UnlockableUtxo[];
  /** Immutable SCID anchor co-spent outside every fixed participant block to authenticate a stable logical
   * call target. Runtime caller identity is always taken from the active covenant input instead. */
  logicalIdentityUtxo?: UnlockableUtxo;
  /** Immutable SCID anchors of CALLEES whose Solidity-visible address is logical, co-spent so an external-call
   * identity check can prove the logical-to-physical binding. Appended after `logicalIdentityUtxo`, outside every
   * accounted band, and recreated at the matching output position. */
  externalIdentityAnchorUtxos?: UnlockableUtxo[];
}

/** Absolute event coordinates owned by materialized external-call blocks. */
export function externalCallEventDestinations(
  groups: ReadonlyArray<Pick<ExternalCallUtxoGroup, 'sharedGroupIndex' | 'blockLayout' | 'compilerRoute'>>,
  outputBaseForGroup: (groupIndex: number) => number,
): number[] {
  const destinations: number[] = [];
  for (const [groupIndex, group] of groups.entries()) {
    // A shared logical call reuses the primary participant's physical frame;
    // counting it again can reserve unrelated coordinates from a logical-only layout.
    if (group.sharedGroupIndex !== undefined) continue;
    const base = outputBaseForGroup(groupIndex);
    if (base < 0) continue;
    const layout = group.blockLayout ?? group.compilerRoute?.abiFunction.blockLayout;
    for (const slot of layout?.slots ?? []) {
      if (slot.kind === 'event') destinations.push(base + slot.offset);
    }
  }
  return destinations;
}

export type ParticipantImmutableEventDestination = {
  categoryId: string;
  destination: number;
};

/** Event signatures follow compiler-published physical slot identities when present. */
export function groupEventSignatures(
  group: Pick<ExternalCallUtxoGroup, 'compilerRoute'>,
  abiFunction?: Pick<AbiFunction, 'emits'>,
): Array<string | undefined> {
  const published = group.compilerRoute?.eventSignaturesBySlot ?? [];
  const declared = abiFunction?.emits ?? [];
  return Array.from({ length: Math.max(published.length, declared.length) }, (_, index) => (
    published[index] ?? declared[index]?.eventSignature
  ));
}

/** Delegate execution mutates the physical proxy's state, not the implementation's. */
export function lowLevelCallStateOwnerCategory(
  groupIndex: number,
  group: Pick<ExternalCallUtxoGroup, 'categoryId' | 'callMode'>,
  proxyGroups: ReadonlyArray<Pick<ExternalCallUtxoGroup,
  'categoryId' | 'delegateCallGroupIndex' | 'sharedGroupIndex'>>,
  rootStateOwnerCategory = group.categoryId,
  rootDelegateGroupIndex?: number,
): string {
  if (group.callMode !== 'delegatecall') return group.categoryId;
  if (groupIndex === rootDelegateGroupIndex) return rootStateOwnerCategory;
  const ownerCategories = new Set<string>();
  for (const [candidateIndex, candidate] of proxyGroups.entries()) {
    const ownerIndex = candidate.sharedGroupIndex ?? candidateIndex;
    const owner = proxyGroups[ownerIndex] ?? candidate;
    const delegateIndex = candidate.delegateCallGroupIndex ?? owner.delegateCallGroupIndex;
    if (delegateIndex === groupIndex) ownerCategories.add(owner.categoryId);
  }
  if (ownerCategories.size === 0) return rootStateOwnerCategory;
  if (ownerCategories.size === 1) return [...ownerCategories][0];
  throw new Error(`Delegate execution group ${groupIndex} has multiple physical state owners`);
}

/**
 * Absolute immutable-event coordinates owned by low-level execution frames.
 *
 * A delegate implementation authenticates the physical coordinate relative to its own input, while the NFT is
 * branded with the proxy's state category. Ordinary calls use the callee's category for both roles.
 */
export function lowLevelCallImmutableEventDestinations(
  groups: ReadonlyArray<Pick<ExternalCallUtxoGroup,
  'categoryId' | 'callMode' | 'blockLayout' | 'compilerRoute'>>,
  proxyGroups: ReadonlyArray<Pick<ExternalCallUtxoGroup,
  'categoryId' | 'delegateCallGroupIndex' | 'sharedGroupIndex'>>,
  inputBaseForGroup: (groupIndex: number) => number,
): ParticipantImmutableEventDestination[] {
  const destinations: ParticipantImmutableEventDestination[] = [];
  for (const [groupIndex, group] of groups.entries()) {
    const base = inputBaseForGroup(groupIndex);
    if (base < 0) continue;
    const categoryId = lowLevelCallStateOwnerCategory(groupIndex, group, proxyGroups);
    const layout = group.blockLayout ?? group.compilerRoute?.abiFunction.blockLayout;
    for (const slot of layout?.slots ?? []) {
      if (slot.kind === 'event' || slot.kind === 'returnEvent') {
        destinations.push({ categoryId, destination: base + slot.offset });
      }
    }
  }
  return destinations;
}
