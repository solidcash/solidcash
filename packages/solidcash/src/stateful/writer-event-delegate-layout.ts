/**
 * phase-boundary extract: Chunkable/publish writer-event placement + delegate layout / PredOut helpers.
 * (phase-boundary extract from StatefulTransactionBuilder.ts).
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import type { BlockSlotKind, FunctionBlockLayout } from '@solidcash/utils';
import { isScidIdentityCommitment } from './logical-identity.js';
import {
  commitmentHexOf,
  cloneToken,
  outputMatchesLock,
} from './stb-output-utils.js';
import {
  isDisposableAlignmentPad,
  isViewReturnTailOutput,
} from './value-chunk-band-helpers.js';
import {
  isJobEventEmitCommitment,
  isCreatedJobEventCommitment,
  chunkableWriterEventOutputIndex,
  publishJobEventOutputIndex,
  isOverwritableEmitOccupant,
  emitDestCollidesPreservedInput,
  shouldDisplaceForNestedEvent,
  nextAlignmentPadIndex,
} from './same-index-twin-emit.js';
import {
  isDelegateEventNftOutput,
  isEmptySameCategoryNoneCap,
  isMaterializedImmutableNftOutput,
  isLearnedEventEmitCommitment,
  isAuthenticatedEventRepairCommitment,
  demoteUnclaimedConditionalEventOutput,
} from './delegate-event-jobevent-helpers.js';
import { isOpReturnLockingBytecode } from './mutable-output-reassert.js';
import type { CompilerTokenWriterGroup } from './value-chunk-geometry.js';
import {
  physicalParticipantWidth,
  tokenWriterReturnIndex,
} from './value-chunk-geometry.js';

/** Place the chunkable writer's event at impl+event.offset and drop a cloned stub on dest+1. */
export function placeChunkableWriterEventOutput(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { amount?: bigint; category?: string; nft?: { capability?: string; commitment?: string } };
  }>,
  dest: number,
  placed: {
    to: Uint8Array;
    amount?: bigint;
    token: { amount: bigint; category: string; nft: { capability: 'none'; commitment: string } };
  },
  options?: {
    clearClonedStub?: boolean;
    refuseEmpty?: boolean;
    consumedMutableOk?: boolean;
    destInput?: { token?: { nft?: { capability?: string } } };
    /** Explicit compatibility for the pre-descriptor JobEvent wire format. */
    legacyCompatibility?: 'job-event-v1';
  },
): boolean {
  if (dest < 0) return false;
  const destinationInputCapability = options?.destInput?.token?.nft?.capability;
  const legacyJobEvent = options?.legacyCompatibility === 'job-event-v1';
  if (emitDestCollidesPreservedInput(options?.destInput)
    && !(options?.consumedMutableOk === true && destinationInputCapability === 'mutable')) return false;
  const placedCommit = String(placed.token.nft.commitment ?? '');
  // Persist dest sits inside the MD minting uniqueness window. An empty or
  // short `0057000000` same-category none-cap there is minting-shaped
  // (input 14 / 0 GTE VERIFY). First publish still places an empty event NFT
  // so extract can read Created. Persist waits for a real JobEvent blob.
  if (legacyJobEvent && options?.refuseEmpty === true && !isJobEventEmitCommitment(placedCommit)) {
    if (dest < outputs.length && (
      isEmptySameCategoryNoneCap(outputs[dest], placed.token.category)
      || (outputs[dest]?.token?.category === placed.token.category
        && outputs[dest]?.token?.nft?.capability === 'none'
        && String(outputs[dest]?.token?.nft?.commitment ?? '') === '0057000000')
    )) {
      outputs[dest] = { to: Uint8Array.of(0x51), amount: 1000n };
    }
    return false;
  }
  while (outputs.length <= dest) {
    outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
  }
  const current = outputs[dest];
  const commit = String(current?.token?.nft?.commitment ?? '');
  const alreadyEvent = current?.token?.nft?.capability === 'none'
    && commit.length > 20
    && !commit.startsWith('53434944')
    && (
      current.token.category === placed.token.category
      || (legacyJobEvent && isJobEventEmitCommitment(commit))
    );
  if (alreadyEvent) {
    // A JobEvent token parked on a P2PKH (or other) lock still fails the event-covenant
    // OUTPUTBYTECODE pin. Restore the event locking bytecode. When a later distinct
    // JobEvent (Created vs WhitelistedWorkerAdded) is learned for the same dest, replace
    // the commitment — the caller detaches the previous blob for receipt decoding.
    const replaceDistinctLegacy = legacyJobEvent
      && isJobEventEmitCommitment(placedCommit)
      && placedCommit.toLowerCase() !== commit.toLowerCase();
    outputs[dest] = {
      to: placed.to,
      amount: placed.amount ?? current?.amount ?? 1200n,
      token: replaceDistinctLegacy ? placed.token : current!.token,
    };
  } else {
    if (current && !isOverwritableEmitOccupant(current, {
      consumedMutableOk: options?.consumedMutableOk,
    })) {
      return false;
    }
    outputs[dest] = { to: placed.to, amount: placed.amount ?? 1200n, token: placed.token };
  }
  if (options?.clearClonedStub === true) {
    const next = outputs[dest + 1];
    if (next?.token?.category === placed.token.category
      && next.token.nft?.capability !== 'none'
      && isOverwritableEmitOccupant(next)) {
      outputs[dest + 1] = { to: Uint8Array.of(0x51), amount: 1000n };
    }
  }
  // Collapse exact JobEvent commitment clones only. Distinct emits in one tx
  // (Created + WhitelistedWorkerAdded) must remain visible to receipt/queryFilter.
  if (legacyJobEvent && isJobEventEmitCommitment(placedCommit)) {
    for (let index = 0; index < outputs.length; index++) {
      if (index === dest) continue;
      const other = outputs[index];
      if (other?.token?.category !== placed.token.category) continue;
      if (other.token.nft?.capability !== 'none') continue;
      const otherCommit = String(other.token.nft?.commitment ?? '');
      if (!isJobEventEmitCommitment(otherCommit)) continue;
      if (otherCommit.toLowerCase() !== placedCommit.toLowerCase()) continue;
      outputs[index] = { to: Uint8Array.of(0x51), amount: 1000n };
    }
  }
  return true;
}

/** @deprecated Use {@link placeChunkableWriterEventOutput}. */
export function placePublishJobEventOutput(
  ...args: Parameters<typeof placeChunkableWriterEventOutput>
): ReturnType<typeof placeChunkableWriterEventOutput> {
  const [outputs, dest, placed, options] = args;
  return placeChunkableWriterEventOutput(outputs, dest, placed, {
    ...options,
    legacyCompatibility: 'job-event-v1',
  });
}

/**
 * INSERT P' is a trailing output at the participant's runtime-resource base (+ ordinal). Negative
 * values are covenant sentinels (update / alias). A planner that still emits a
 * fixed entry offset below that base for an INSERT must not be rebased onto that
 * 1:1 preserved slot — that is the transferFrom output-30 vs output-34 pin.
 */
export function groupLayoutBlockSize(group: {
  blockLayout?: { blockSize?: number };
  compilerRoute?: { abiFunction?: { blockLayout?: { blockSize?: number } } };
}): number {
  return group.blockLayout?.blockSize
    ?? group.compilerRoute?.abiFunction?.blockLayout?.blockSize
    ?? 8;
}

export type DelegateExecutionLayoutGroup = {
  callMode?: string;
  blockLayout?: FunctionBlockLayout;
  compilerRoute?: { abiFunction?: { blockLayout?: FunctionBlockLayout } };
};

/**
 * Physical block of a proxy-forwarded implementation. Kernel-eligible handlers publish this on
 * `compilerRoute`; ineligible handlers still compile a native body with ABI `blockLayout`, and the
 * proxy must materialize that geometry even without a route descriptor.
 */
export function selectDelegateExecutionLayout(
  groups: ReadonlyArray<DelegateExecutionLayoutGroup>,
  nestedDelegateProxyGroupIndexes?: { has(index: number): boolean },
): FunctionBlockLayout | undefined {
  const group = groups.find((candidate, index) => candidate.callMode === 'delegatecall'
    && !nestedDelegateProxyGroupIndexes?.has(index)
    && (candidate.compilerRoute?.abiFunction?.blockLayout ?? candidate.blockLayout));
  return group?.compilerRoute?.abiFunction?.blockLayout ?? group?.blockLayout;
}

/**
 * Translate an implementation-authored slot offset into the physical delegate frame. Delegate-only artifacts
 * execute against proxy storage, so their declared data-NFT slots below the target are not co-spent beside the
 * implementation and must not contribute to the physical offset.
 */
export function physicalDelegateSlotOffset(
  layout: FunctionBlockLayout | undefined,
  offset: number,
  delegateOnly: boolean,
): number {
  if (!delegateOnly) return offset;
  const proxyResidentDataSlots = (layout?.slots ?? [])
    .filter((slot) => slot.kind === 'dataNft' && slot.offset < offset).length;
  return offset - proxyResidentDataSlots;
}

/**
 * Exact in-block vmap nodes are known before the first probe. Layout-conditional slots stay unpinned only when
 * they are not part of a linear sorted batch, so a no-op cache-flush arm can still omit its pin.
 */
export function pinExactSortedBatchEntry(parts: {
  exact: boolean;
  conditionalLayoutSlot: boolean;
  linearSortedBatch: boolean;
}): boolean {
  // A linear sorted batch publishes every reached key as an in-block node, so its exact placeholders are pinned
  // even when the layout slot is conditional. A node whose value the body computes stays derivable: pinned, its
  // key-and-link seed would never take the value, and the slot's required output already keeps an unobserved
  // insert from reading as a no-op delete.
  return parts.exact && (parts.linearSortedBatch || !parts.conditionalLayoutSlot);
}

/** Compiler-owned in-block vmap nodes are not leftover P'+NEW clones. */
export function skipCompilerOwnedInBlockCollectionStrip(parts: {
  preserveBlockLayoutWidth: boolean;
  pinnedEntryCount: number;
}): boolean {
  return parts.preserveBlockLayoutWidth && parts.pinnedEntryCount > 0;
}

/** Place a balanced-block output at a fixed offset, overwriting a prior pad rather than appending past it. */
export function assignBalancedOutputAtOffset<T>(outputs: T[], offset: number, output: T): void {
  if (offset < 0) throw new Error('Balanced output offset must be non-negative');
  if (offset < outputs.length) {
    outputs[offset] = output;
    return;
  }
  if (offset !== outputs.length) {
    throw new Error(`Balanced output offset ${offset} is past the current length ${outputs.length}`);
  }
  outputs.push(output);
}

/** First physical slot available to bounded runtime resources in a participant block. */
export function groupLayoutTrailingBase(group: {
  blockLayout?: { blockSize?: number; trailingBase?: number };
  compilerRoute?: { abiFunction?: { blockLayout?: { blockSize?: number; trailingBase?: number } } };
}): number {
  const layout = group.blockLayout ?? group.compilerRoute?.abiFunction?.blockLayout;
  return layout?.trailingBase ?? layout?.blockSize ?? 8;
}

/** True when an absolute output is owned by a slot of `kind` in a participant's fixed block. */
export function blockOutputOwnsSlotKind(
  outputIndex: number,
  blockBase: number,
  layout: FunctionBlockLayout | undefined,
  kind: BlockSlotKind,
): boolean {
  if (!layout || blockBase < 0 || outputIndex < blockBase) return false;
  const relative = outputIndex - blockBase;
  return layout.slots[relative]?.kind === kind
    || layout.slots.some((slot) => slot.kind === kind && slot.offset === relative);
}

/**
 * True when an absolute output is one of a participant's fixed data-NFT outputs.
 * Modern artifacts declare the exact (possibly sparse) slots. Older artifacts
 * use the original dense master+1..N convention, so only those need the count
 * fallback.
 */
export function blockOutputOwnsFixedDataNft(
  outputIndex: number,
  blockBase: number,
  layout: FunctionBlockLayout | undefined,
  dataNftCount: number,
): boolean {
  if (blockBase < 0 || outputIndex < blockBase) return false;
  const declared = layout?.slots.filter((slot) => slot.kind === 'dataNft') ?? [];
  const relative = outputIndex - blockBase;
  if (declared.length > 0) return declared.some((slot) => slot.offset === relative);
  return relative >= 1 && relative <= dataNftCount;
}

/** Resolve fixed data-NFT ownership across any structurally described participant blocks. */
export function fixedDataNftOwnerInParticipantBlocks(
  outputIndex: number,
  categoryId: string,
  participants: readonly {
    categoryId: string;
    blockBase: number;
    blockLayout?: FunctionBlockLayout;
    dataNftCount: number;
    requiredDataNftIndices: readonly number[];
  }[],
): { participantIndex: number; nftIndex: number } | undefined {
  const normalizedCategoryId = categoryId.toLowerCase();
  for (const [participantIndex, participant] of participants.entries()) {
    if (participant.categoryId.toLowerCase() !== normalizedCategoryId
      || !blockOutputOwnsFixedDataNft(
        outputIndex, participant.blockBase, participant.blockLayout, participant.dataNftCount,
      )) continue;
    const relative = outputIndex - participant.blockBase;
    const declared = participant.blockLayout?.slots.filter((slot) => slot.kind === 'dataNft') ?? [];
    const declaredSlot = declared.find((slot) => slot.offset === relative);
    const ordinal = declared.length > 0 ? declared.indexOf(declaredSlot!) : relative - 1;
    const nftIndex = declaredSlot?.nftIndex ?? participant.requiredDataNftIndices[ordinal];
    if (nftIndex !== undefined) return { participantIndex, nftIndex };
  }
  return undefined;
}

/** Resolve the first trailing predecessor from the output slot the batch planner actually materializes. */
export function materializedPredOutBase(group: {
  batchPredecessorOutputs?: Array<{ outputBlockSlot: number }>;
  blockLayout?: { blockSize?: number; trailingBase?: number };
  compilerRoute?: { abiFunction?: { blockLayout?: { blockSize?: number; trailingBase?: number } } };
}, masterIndex: number): number {
  const trailingBase = groupLayoutTrailingBase(group);
  const firstTrailingSlot = Math.min(
    ...((group.batchPredecessorOutputs ?? [])
      .map((output) => output.outputBlockSlot)
      .filter((slot) => Number.isInteger(slot) && slot >= trailingBase)),
  );
  return masterIndex + (Number.isFinite(firstTrailingSlot) ? firstTrailingSlot : trailingBase);
}

/**
 * Force INSERT PredOut witnesses onto `master + declared outputBlockSlot`.
 * Occupancy slides (`relocatedPredOutBase`) can leave the unlocker pointing one past the physical P'
 * (post job 1 FakeToken: PredOut=28 while P' sits at master+8=27).
 */
export function syncDeclaredBatchPredOutWitnesses(parts: {
  masterIndex: number;
  batchPredecessorOutputs?: Array<{ outputBlockSlot: number }>;
  internalArgs?: Record<string, unknown>;
  compilerInternalArgs?: Record<string, unknown>;
  refreshInternalArgs?: (
    updates: Record<string, unknown>,
    options?: { shiftPredOut?: boolean },
  ) => void;
  setRelocatedPredOutBase?: (absolute: number) => void;
}): Record<string, bigint> {
  const preds = (parts.batchPredecessorOutputs ?? [])
    .filter((pred) => Number.isInteger(pred.outputBlockSlot) && pred.outputBlockSlot >= 0)
    .sort((left, right) => left.outputBlockSlot - right.outputBlockSlot);
  if (preds.length === 0) return {};
  const merged = {
    ...(parts.compilerInternalArgs ?? {}),
    ...(parts.internalArgs ?? {}),
  };
  const insertNames = Object.keys(merged)
    .filter((name) => /^__internal__vmapBatchPredOut_\d+$/.test(name)
      && typeof merged[name] === 'bigint'
      && (merged[name] as bigint) >= 0n)
    .sort((left, right) => Number(left.split('_').pop()) - Number(right.split('_').pop()));
  if (insertNames.length === 0) return {};
  const updates: Record<string, bigint> = {};
  for (let index = 0; index < Math.min(insertNames.length, preds.length); index += 1) {
    updates[insertNames[index]!] = BigInt(parts.masterIndex + preds[index]!.outputBlockSlot);
  }
  const firstAbsolute = parts.masterIndex + preds[0]!.outputBlockSlot;
  parts.setRelocatedPredOutBase?.(firstAbsolute);
  parts.refreshInternalArgs?.(updates, { shiftPredOut: false });
  return updates;
}

/**
 * INSERT/UPDATE P' follows the token block and the live jobEvents band.
 * If assigned view tails already occupy that slot, slide P' to after the last
 * view rather than overwriting an OP_TRUE none-cap return (input-5 leftover 01).
 */
export function predOutBaseAfterOccupancy(parts: {
  master: number;
  blockSize: number;
  jobEventsEnd?: number;
  viewTailStart?: number;
  viewTailEnd?: number;
}): number {
  const natural = parts.master + parts.blockSize;
  const afterJobEvents = (parts.jobEventsEnd ?? -1) + 1;
  let base = Math.max(natural, afterJobEvents);
  if (
    parts.viewTailStart !== undefined
    && parts.viewTailEnd !== undefined
    && parts.viewTailStart <= base
    && parts.viewTailEnd >= base
  ) {
    base = parts.viewTailEnd + 1;
  }
  return base;
}

export function resolveAbsolutePredOut(
  relative: bigint,
  masterIndex: number,
  trailingBase: number,
  relocatedBase?: number,
): bigint {
  if (relative < 0n) return relative;
  const natural = masterIndex + trailingBase;
  // A relocated base smaller than the executing master's trailing slot is the
  // proxy-minting + implementation-only base mistake (initialize PredOut 14 vs 17).
  const base = relocatedBase !== undefined && relocatedBase >= natural
    ? relocatedBase
    : natural;
  if (relative >= BigInt(base)) return relative;
  const ordinal = Number(relative) >= trailingBase ? Number(relative) - trailingBase : 0;
  return BigInt(base + ordinal);
}

const WRITER_BATCH_WITNESS = /^(?:__internal__vmapBatch(?:PredOut|Proof|Slot|Next|Rank)_\d+|__internal__vmapBatchRows_.+|__internal__vmapBatchTrailingCount)$/;

export function isWriterBatchWitnessName(name: string): boolean {
  return WRITER_BATCH_WITNESS.test(name);
}

/**
 * A view fused onto the same physical token group keeps its compilerRoute. The
 * later writer owns the INSERT/UPDATE batch plan; copy those witnesses over the
 * view's leftovers so PredOut remapping does not mint a second P'.
 */
export function inheritWriterBatchWitnesses<T>(
  target: Record<string, T> | undefined,
  writer: Record<string, T> | undefined,
): Record<string, T> {
  const next = { ...(target ?? {}) };
  for (const [name, value] of Object.entries(writer ?? {})) {
    if (isWriterBatchWitnessName(name)) next[name] = value;
  }
  return next;
}

/**
 * Promote a logical writer's complete sorted-batch plan onto the carrier that owns the physical unlocker.
 * A fused read may be the first logical callsite and therefore retain the carrier identity, but it must not
 * retain stale read-only topology witnesses after a sibling call writes the same participant.
 */
export type PromotableWriterBatchPlan<T, P, I> = {
  internalArgs?: Record<string, T>;
  compilerRoute?: { internalArgs?: Record<string, T> };
  plannedEntryInserts?: I[];
  plannedEntryInsertHandles?: number[];
  relativeOutputInternalArgs?: string[];
  batchPredecessorOutputs?: P[];
  batchEntryLockingBytecodes?: Map<number, Uint8Array>;
  batchEntryCommitments?: Map<number, string>;
};

const writerBatchPlanPartPresent = (value: unknown): boolean => (
  value instanceof Map ? value.size > 0 : Array.isArray(value) ? value.length > 0 : value !== undefined
);

const writerBatchBytesEqual = (left: Uint8Array, right: Uint8Array): boolean => (
  left.length === right.length && left.every((byte, index) => byte === right[index])
);

const writerBatchPlanPartEqual = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (left instanceof Map && right instanceof Map) {
    if (left.size !== right.size) return false;
    return [...left].every(([key, value]) => {
      const candidate = right.get(key);
      return value instanceof Uint8Array && candidate instanceof Uint8Array
        ? writerBatchBytesEqual(value, candidate) : value === candidate;
    });
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    return left.every((value, index) => {
      const candidate = right[index];
      if (value instanceof Uint8Array && candidate instanceof Uint8Array) {
        return writerBatchBytesEqual(value, candidate);
      }
      if (typeof value === 'object' && value !== null && typeof candidate === 'object' && candidate !== null) {
        const leftEntries = Object.entries(value);
        const rightRecord = candidate as Record<string, unknown>;
        return leftEntries.length === Object.keys(rightRecord).length
          && leftEntries.every(([key, entry]) => {
            const rightEntry = rightRecord[key];
            return entry instanceof Uint8Array && rightEntry instanceof Uint8Array
              ? writerBatchBytesEqual(entry, rightEntry) : entry === rightEntry;
          });
      }
      return value === candidate;
    });
  }
  return !writerBatchPlanPartPresent(left) && !writerBatchPlanPartPresent(right);
};

export function inheritWriterBatchPlan<T, P, I = never>(
  target: PromotableWriterBatchPlan<T, P, I>,
  writer: PromotableWriterBatchPlan<T, P, I> | undefined,
): boolean {
  if (!writer) return false;
  let changed = false;
  const copyExactPart = <K extends keyof PromotableWriterBatchPlan<T, P, I>>(field: K): void => {
    const incoming = writer[field];
    if (!writerBatchPlanPartPresent(incoming)) return;
    const current = target[field];
    if (!writerBatchPlanPartPresent(current)) {
      target[field] = incoming;
      changed = true;
    } else if (!writerBatchPlanPartEqual(current, incoming)) {
      throw new Error(`Cannot promote conflicting sorted-batch '${String(field)}' plans onto one physical carrier.`);
    }
  };
  // INSERT locations and their builder handles are one positional vector. Never concatenate independently.
  copyExactPart('plannedEntryInserts');
  copyExactPart('plannedEntryInsertHandles');

  const relativeNames = new Set(target.relativeOutputInternalArgs ?? []);
  for (const name of writer.relativeOutputInternalArgs ?? []) {
    if (!relativeNames.has(name)) {
      relativeNames.add(name);
      changed = true;
    }
  }
  if (relativeNames.size > 0) target.relativeOutputInternalArgs = [...relativeNames];

  const mergeKeyedArray = <V>(
    current: V[] | undefined,
    incoming: V[] | undefined,
    keyOf: (value: V) => number,
    field: 'batchPredecessorOutputs',
  ): V[] | undefined => {
    if (!incoming?.length) return current;
    const merged = [...(current ?? [])];
    const byKey = new Map(merged.map((value) => [keyOf(value), value]));
    for (const value of incoming) {
      const key = keyOf(value);
      const prior = byKey.get(key);
      if (prior !== undefined && !writerBatchPlanPartEqual([prior], [value])) {
        throw new Error(`Cannot promote conflicting sorted-batch '${field}' plans onto one physical carrier.`);
      }
      if (prior === undefined) {
        merged.push(value);
        byKey.set(key, value);
        changed = true;
      }
    }
    return merged;
  };
  target.batchPredecessorOutputs = mergeKeyedArray(
    target.batchPredecessorOutputs,
    writer.batchPredecessorOutputs,
    (value) => (value as { outputBlockSlot: number }).outputBlockSlot,
    'batchPredecessorOutputs',
  );

  const mergeMap = <V>(
    current: Map<number, V> | undefined,
    incoming: Map<number, V> | undefined,
    field: 'batchEntryLockingBytecodes' | 'batchEntryCommitments',
  ): Map<number, V> | undefined => {
    if (!incoming?.size) return current;
    const merged = new Map(current);
    for (const [key, value] of incoming) {
      const prior = merged.get(key);
      const equal = prior instanceof Uint8Array && value instanceof Uint8Array
        ? writerBatchBytesEqual(prior, value) : prior === value;
      if (prior !== undefined && !equal) {
        throw new Error(`Cannot promote conflicting sorted-batch '${field}' plans onto one physical carrier.`);
      }
      if (prior === undefined) {
        merged.set(key, value);
        changed = true;
      }
    }
    return merged;
  };
  target.batchEntryLockingBytecodes = mergeMap(
    target.batchEntryLockingBytecodes, writer.batchEntryLockingBytecodes, 'batchEntryLockingBytecodes',
  );
  target.batchEntryCommitments = mergeMap(
    target.batchEntryCommitments, writer.batchEntryCommitments, 'batchEntryCommitments',
  );
  const writerArgs = { ...writer.compilerRoute?.internalArgs, ...writer.internalArgs };
  if (!Object.keys(writerArgs).some(isWriterBatchWitnessName)) return changed;
  target.internalArgs = inheritWriterBatchWitnesses(target.internalArgs, writerArgs);
  if (target.compilerRoute) {
    target.compilerRoute.internalArgs = inheritWriterBatchWitnesses(
      target.compilerRoute.internalArgs,
      writerArgs,
    );
  }
  return true;
}

/**
 * Own-category none-cap NFTs are event-pin candidates. Only the layout event
 * slots and the witnessed in-block return may carry that shape. Logical
 * identity carriers use the disjoint SCID envelope and are ignored here.
 */
export function constrainOwnCategoryImmutableOutputs(
  outputs: Array<{
    to?: Uint8Array | string;
    token?: {
      category?: string;
      nft?: { capability?: string; commitment?: Uint8Array | string };
    };
  }>,
  categoryId: string,
  allowedIndices: ReadonlySet<number>,
): number {
  let stripped = 0;
  for (const [index, output] of outputs.entries()) {
    if (allowedIndices.has(index)) continue;
    if (output.token?.category !== categoryId) continue;
    if (output.token.nft?.capability !== 'none') continue;
    if (isScidIdentityCommitment(output.token.nft.commitment)) continue;
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    // OP_TRUE view tails are not event records once the pin uses OVER. Keep them.
    if (lock && lock.length === 1 && lock[0] === 0x51) continue;
    delete output.token;
    stripped += 1;
  }
  return stripped;
}

/**
 * Only planned INSERT PredOuts (`>= blockSize`, or the first leftover inside the
 * insert budget) relocate to P'. Extra nonnegative in-block slots stay UPDATE.
 */
export function remapInsertPredOuts(
  predOuts: ReadonlyArray<{ name: string; value: bigint }>,
  predBase: bigint,
  insertBudget: number,
  trailingBase: bigint,
): Record<string, bigint> {
  const updates: Record<string, bigint> = {};
  let trailing = 0;
  for (const { name, value } of predOuts) {
    if (value < 0n) continue;
    const plannedInsert = value >= trailingBase;
    if (plannedInsert || trailing < insertBudget) {
      updates[name] = predBase + BigInt(trailing);
      trailing += 1;
    } else {
      updates[name] = -1n;
    }
  }
  return updates;
}
