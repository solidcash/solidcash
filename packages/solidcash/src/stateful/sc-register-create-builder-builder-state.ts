/**
 * phase-boundary extract: SC _createBuilder extract — seed builder registrations after construction
 * (dynamic chunks, entries, loops, value-chunk mints) through registrations-complete.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX,
  buildChunkCommitment,
  buildValueChunkCommitment,
  computeCollectionHash,
  isFixedWidthType,
  packFixedWidthArray,
  parseArrayTypeString,
  sha256 as sha256Sync,
  splitValueIntoChunks,
  splitValueIntoValueChunks,
  type AbiFunction,
} from '@solidcash/utils';
import { addressToLockScript } from '../utils.js';
import { getValueChunkAddress, getValueChunkLockingBytecode } from './covenant-helpers.js';
import type { OnChainState } from './StateReader.js';
import { providerUnixLocktime } from './soft-state-overlays.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { pinExactSortedBatchEntry } from './writer-event-delegate-layout.js';
import { activityBatchWriteSlots, guardedBatchWriteSlots } from './conditional-sorted-activity.js';
import { chunksFromValue } from './early-value-chunk-helpers.js';
import {
  sameDerivedChunkOutputObservation,
  valueChunkWriteResourceIdentity,
  type ValueChunkWriteDescriptor,
} from './value-chunk-persist.js';

const DUMMY_FUNDER_LOCKING_BYTECODE = hexToBin(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX);

export type RegisterCreateBuilderBuilderStateHost = {
  readonly categoryId: string;
  readonly inner: any;
};

/**
 * Apply compiler-derived entry/loop/dynamic/value-chunk registrations onto the
 * freshly constructed STB before funder accounting begins.
 */
export function registerCreateBuilderBuilderState(
  host: RegisterCreateBuilderBuilderStateHost,
  params: {
    builder: StatefulTransactionBuilder;
    oldDynamicChunkCommitments: Map<string, string[]>;
    oldDynamicChunkCounts: Map<string, number>;
    overrides: any;
    masterUtxo: { vout: number };
    inactiveMessageBusEntrySlots: ReadonlySet<number> | readonly number[];
    entryDeleteSlots: ReadonlySet<number> | readonly number[];
    condSoftDeleteSlots: ReadonlySet<number> | readonly number[];
    entryNfts: readonly any[];
    entryAbiFunction: AbiFunction | undefined;
    batchTargetPlaceholders: Map<number, string>;
    exactBatchTargetSlots: Set<number>;
    sortedInserts: readonly any[];
    compilerRouteDelegateLayout: any;
    activeDynamicWrites: Set<string>;
    usesComposedDelegateDynamicTail: boolean;
    computedValueChunkRuns: readonly any[];
    onChainState: OnChainState;
    entryArgs: readonly any[];
    pendingEntryValueTails: readonly any[];
    transportedProductions: readonly any[];
    ordinaryTransportedRoute?: boolean;
    valueChunkMints: readonly {
      collection: string; slotIndex: number; slot: Uint8Array; value: Uint8Array;
      digest: Uint8Array; chunks: readonly Uint8Array[];
    }[];
    maxBhLocktime: number;
    functionName: string;
    timing?: (label: string) => void;
    [key: string]: any;
  },
): void {
  const {
    builder, oldDynamicChunkCommitments, oldDynamicChunkCounts, overrides, masterUtxo,
    inactiveMessageBusEntrySlots, entryDeleteSlots, condSoftDeleteSlots, entryNfts,
    entryAbiFunction, batchTargetPlaceholders, exactBatchTargetSlots, sortedInserts,
    compilerRouteDelegateLayout, activeDynamicWrites, usesComposedDelegateDynamicTail,
    computedValueChunkRuns, onChainState, pendingEntryValueTails,
    transportedProductions, valueChunkMints, maxBhLocktime, functionName, timing,
  } = params;
  const activeMessageBusEntryOperations = (params.activeMessageBusEntryOperations as Map<number, any> | undefined)
    ?? new Map<number, any>();
  const dynamicChunkVars = (params.dynamicChunkVars as any[]) ?? [];
  const selectedDynamicRows = (params.selectedDynamicRows as any[] | undefined) ?? [];
  const sortedLoopCommitments = (params.sortedLoopCommitments as Map<string, any> | undefined)
    ?? new Map<string, any>();
  const runtimeExpressionLoopCollections = (params.runtimeExpressionLoopCollections as Set<string> | undefined)
    ?? new Set<string>();
  const batchPredCommitments = (params.batchPredCommitments as Map<string, any> | undefined)
    ?? new Map<string, any>();
  const batchTargetSlots = (params.batchTargetSlots as Map<number, Uint8Array> | undefined)
    ?? new Map<number, Uint8Array>();
  const runtimeLoopDerivedCounts = (params.runtimeLoopDerivedCounts as Map<string, number> | undefined)
    ?? new Map<string, number>();
  const computedValueUpdateCollections = (params.computedValueUpdateCollections as Set<string> | undefined)
    ?? new Set<string>();
  const effectiveBlockLayout = params.effectiveBlockLayout as any;
  const loopValueChunkMints = (params.loopValueChunkMints as any[] | undefined) ?? [];

  // Begin dynamic-write fixed points from the authenticated pre-state. This is exact for compiler-journal
  // write-backs and gives real mutations the longest already-valid prefix, so their first probe reaches the
  // changed chunk instead of colliding a later trailing resource with an unmaterialized dynamic region.
  for (const [name, commitments] of oldDynamicChunkCommitments) {
    if (commitments.length > 0) builder.setChunkRawCommitments(name, commitments);
  }
  if (overrides?.omitLocalFeeTail) builder._setMessageBusProbeMasterVout(masterUtxo.vout);
  // Apply every compiler-derived non-output entry before any probe materializes the builder. Delegate input
  // discovery below may call build() early; leaving alias/hard-delete slots until the end makes that probe encode
  // their placeholder keys as new entries even though the finalized transaction correctly omits them.
  for (const slotIndex of new Set([...inactiveMessageBusEntrySlots, ...entryDeleteSlots])) {
    builder.deleteEntry(slotIndex);
  }
  for (const slotIndex of condSoftDeleteSlots) {
    const entry = entryNfts.find((candidate: any) => candidate.slotIndex === slotIndex);
    if (!entry?.exists) builder.deleteEntry(slotIndex);
  }

  const conditionalEntrySlots = new Set((entryAbiFunction?.blockLayout?.slots ?? [])
    .filter((slot: any) => slot.kind === 'entry' && slot.conditional === true)
    .map((slot: any) => slot.slotIndex)
    .filter((slotIndex: any): slotIndex is number => slotIndex !== undefined));
  // A write sharing a batch with a delete keeps its node where it did not run, which the covenant pins: its output
  // stays derivable.
  const guardedWrites = new Set([
    ...guardedBatchWriteSlots(entryAbiFunction), ...activityBatchWriteSlots(entryAbiFunction),
  ]);
  for (const [slotIndex, commitment] of batchTargetPlaceholders) {
    builder.setEntryRawCommitment(slotIndex, commitment);
    // A placeholder only exists for a lane the batch publishes as active (inactive and alias-skipped lanes
    // never reach it), so the route reads this slot's output at its fixed block coordinate.
    builder.requireEntryOutputSlot(slotIndex);
    // A cache flush's target is exact only on its dirty arm. Leave a conditional target probe-derivable so
    // the no-op arm can be recognized by the absence of its covenant output pin. Linear sorted batches seed
    // every reached key unconditionally; pin those known nodes even when the layout slot is conditional.
    if (!guardedWrites.has(slotIndex) && pinExactSortedBatchEntry({
      exact: exactBatchTargetSlots.has(slotIndex),
      conditionalLayoutSlot: conditionalEntrySlots.has(slotIndex),
      linearSortedBatch: entryAbiFunction?.sortedBatchInfo?.some((batch: any) => (
        batch.linear === true && batch.slotIndices.includes(slotIndex)
      )) === true,
    })) {
      builder.pinEntrySlot(slotIndex);
    }
  }

  // A kernel route publishes the union of every handler's entry effects, while this concrete envelope has a
  // narrower per-slot operation set. A route-wide fixed-write placeholder can otherwise replace a selected
  // read-only entry's exact input commitment during probe setup. Preserve the input commitment explicitly,
  // after those placeholders have been installed, and keep it out of later trace derivation. The entry
  // covenant verifies this equality directly. Selected writes/deletes remain unpinned for derivation.
  for (const [slotIndex, operations] of activeMessageBusEntryOperations ?? []) {
    if (!operations.includes('read') || operations.includes('write') || operations.includes('delete')) continue;
    const entry = entryNfts.find((candidate: any) => candidate.slotIndex === slotIndex);
    const commitment = entry?.exists ? entry.utxo?.token?.nft?.commitment : undefined;
    if (!commitment) continue;
    builder.setEntryRawCommitment(slotIndex, commitment);
    builder.pinEntrySlot(slotIndex);
  }

  // vmap sorted-set insert: place P' (the predecessor's rewritten commitment at its entry slot) and NEW (the new
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
  // Break the first-probe ordering cycle when a scalar vmap INSERT follows newly-written dynamic state chunks:
  // reserve one chunk candidate so NEW is placed after the dynamic region and the VM can reach both commitment
  // checks. Derivation replaces it with the exact count/commitments (or removes it for an empty final value).
  // Compiler-route proxy callees (compose executionArtifact/executor) publish trailingCapacity for ChunkNft
  // co-spends, but empty first-writes have no pre-state chunks. Without a speculative placeholder the trailing
  // band stays OP_TRUE density pads and the executor EQUALVERIFYs ChunkNft P2SH32 against 0x51.
  const compilerRouteEmptyDynamicMint = compilerRouteDelegateLayout !== undefined
    && dynamicChunkVars.some((variable: any) => variable.delegate === true
      && activeDynamicWrites.has(variable.name)
      && (oldDynamicChunkCounts.get(variable.name) ?? 0) === 0);
  const selectedBatchEmptyDynamicMint = selectedDynamicRows.length > 0
    && dynamicChunkVars.some((variable: any) => activeDynamicWrites.has(variable.name)
      && (oldDynamicChunkCounts.get(variable.name) ?? 0) === 0);
  if (sortedInserts.length > 0 || usesComposedDelegateDynamicTail || computedValueChunkRuns.length > 0
    || compilerRouteEmptyDynamicMint || selectedBatchEmptyDynamicMint) {
    for (const dv of builder.getDynamicChunkVars()) {
      // The route-wide layout can contain an inactive sibling's dynamic write. Its empty pre-state is already
      // the exact zero-width run; a speculative chunk could never be pinned because no authenticated row
      // executes that write, and would leave semantic convergence stuck at an unresolved `00` commitment.
      if (!activeDynamicWrites.has(dv.name)) continue;
      if (builder.getChunkRawCommitments(dv.name).length === 0) {
        // In-place dynamic-collection writes keep the on-chain chunk count. A single
        // '00' placeholder makes TXOUTPUTCOUNT-1-nNew miss the covenant's nNew=2 pin
        // (fat JobPost push is ~200 bytes → 2 chunks). Reverse-suffix delegates must
        // seed that floor up front — speculative growth cannot fix it.
        const seedFloor = dv.delegateSuffix === true || usesComposedDelegateDynamicTail
          || selectedBatchEmptyDynamicMint ? 2 : 1;
        const seedCount = Math.max(oldDynamicChunkCounts.get(dv.name) ?? 0, seedFloor);
        // Empty first-writes of fixed-width T[] under a compiler-route proxy callee often never expose an
        // OTC pin for graph convergence (unlike bytes/string). When the pre-state is empty and the selected
        // row's visible args are exactly one element, seed the packed one-element array commitment directly.
        const currentValue = (onChainState as unknown as Record<string, unknown>)[dv.name];
        const emptyPrestate = currentValue === undefined || currentValue === ''
          || (currentValue instanceof Uint8Array && currentValue.length === 0)
          || (Array.isArray(currentValue) && currentValue.length === 0);
        const array = emptyPrestate ? parseArrayTypeString(dv.type) : undefined;
        const exactFromPush = emptyPrestate && array && isFixedWidthType(array.elementType)
          ? selectedDynamicRows.flatMap((row: any) => {
            const visible = row.handler.inputs.filter((input: any) => !input.name.startsWith('__internal__'));
            if (visible.length < 1 || row.args.length < 1) return [];
            // Prefer the last visible arg whose type matches the element (push(amount)).
            const elementIndex = [...visible.entries()].reverse()
              .find(([, input]) => input.type === array.elementType
                || ((input.type === 'int' || input.type === 'uint' || input.type === 'bigint')
                  && (array.elementType.startsWith('int') || array.elementType.startsWith('uint')
                    || array.elementType === 'bigint')))?.[0];
            if (elementIndex === undefined) return [];
            try {
              const element = row.args[elementIndex];
              if (typeof element !== 'bigint' && typeof element !== 'boolean'
                && !(element instanceof Uint8Array)) return [];
              const blob = packFixedWidthArray([element], array.elementType);
              if (blob.length === 0) return [];
              return [{
                element,
                commitments: splitValueIntoChunks(blob).map((chunk, index) => buildChunkCommitment(
                  index, chunk, host.inner.provider.consensusLimits?.maximumNftCommitmentBytes,
                )),
              }];
            } catch {
              return [];
            }
          })[0]
          : undefined;
        if (exactFromPush && exactFromPush.commitments.length > 0) {
          builder.setChunkRawCommitments(dv.name, exactFromPush.commitments);
          // Keep the data-NFT A$len header aligned with the packed blob the chunks commit to.
          builder.setState(dv.name, [exactFromPush.element]);
        } else {
          builder.setChunkRawCommitments(
            dv.name,
            Array.from({ length: seedCount }, () => '00'),
          );
        }
      }
    }
  }

  // vmap diff-key INSERT loop: the 2N interleaved [P'_0, NEW_0, P'_1, NEW_1, ...] trailing outputs are known exactly
  // from the off-chain list; inject + pin them so the auto-derivation skips this collection (nothing to trace).
  for (const [collectionName, commitments] of sortedLoopCommitments) {
    builder.setLoopEntryCommitments(collectionName, commitments);
    if (runtimeExpressionLoopCollections.has(collectionName)) {
      builder.requireLoopEntryCount(collectionName, commitments.length);
    } else {
      builder.pinLoopEntry(collectionName);
    }
  }
  for (const [collectionName, commitments] of batchPredCommitments) {
    builder.setLoopEntryCommitments(collectionName, commitments);
    // A one-target sorted batch publishes its target in this trailing lane. Its slot/next seed is
    // not a complete commitment when the handler computes the value (e.g. from newly written state).
    // Keep the lane count fixed, but let the VM's own output-commitment check fill that value tail.
    if (pendingEntryValueTails.some((pending: any) => pending.collection === collectionName
      && commitments.includes(pending.seed))) {
      builder.requireLoopEntryCount(collectionName, commitments.length);
    } else {
      builder.pinLoopEntry(collectionName);
    }
  }
  // The sorted-batch planner has already examined the authenticated list. When it found no predecessor
  // rewrite, and no other path produces a node in this collection, the trailing family is exactly empty.
  // Letting generic loop derivation seed a speculative NEW node turns an existing-key update into an
  // extra mutable NFT output, which the master covenant correctly rejects.
  for (const collectionName of new Set(entryAbiFunction?.sortedBatchInfo?.map((batch) => batch.collection) ?? [])) {
    if (batchPredCommitments.has(collectionName)
      || sortedLoopCommitments.has(collectionName)
      || (runtimeLoopDerivedCounts.get(collectionName) ?? 0) > 0
      || sortedInserts.some((insert) => insert.collection === collectionName)) continue;
    builder.setLoopEntryCommitments(collectionName, []);
    builder.pinLoopEntry(collectionName);
  }
  // A batch TARGET node whose row builds its value has only its key and successor link so far. The compiler-
  // authenticated production transported for that exact entry carries the bytes the covenant chunks, so finish
  // the node here; entries with no transported production stay registered for trace completion.
  for (const pending of pendingEntryValueTails) builder.registerPendingEntryValueTail(pending);
  for (const pending of pendingEntryValueTails) {
    const slotHex = binToHex(pending.slot);
    const production = transportedProductions.find((candidate: any) =>
      candidate.write.collection === pending.collection
      && candidate.write.keySlot.toLowerCase() === slotHex);
    if (production) {
      builder.completePendingEntryValueTail(pending.collection, pending.slot, production.value);
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_PENDING_VALUE_TAIL === '1') {
      console.error('pending-value-tail-builder', JSON.stringify({
        functionName, collection: pending.collection, slot: binToHex(pending.slot).slice(0, 16),
        slotIndex: pending.slotIndex, chunkable: pending.chunkable, seedBytes: pending.seed.length / 2,
        produced: transportedProductions.length,
        matched: production !== undefined, valueBytes: production?.value.length,
      }));
    }
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_DYNAMIC_CHUNK_ORDER === '1') {
    console.error('entry-placement-plan', JSON.stringify({
      functionName,
      batchPred: [...batchPredCommitments].map(([collection, commitments]) => ({
        collection, commitments: commitments.map((c: any) => c.slice(0, 40)),
      })),
      sortedLoop: [...sortedLoopCommitments].map(([collection, commitments]) => ({
        collection, count: commitments.length,
      })),
      targetPlaceholders: [...batchTargetPlaceholders].map(([slotIndex, commitment]: [number, string]) => ({
        slotIndex, commitment: commitment.slice(0, 40),
      })),
      targetSlots: [...batchTargetSlots].map(([slotIndex, slot]) => ({
        slotIndex, slot: binToHex(slot).slice(0, 16),
      })),
    }));
  }
  for (const [collectionName, count] of runtimeLoopDerivedCounts) {
    builder.setLoopEntryCommitments(collectionName, Array.from({ length: count }, () => '00'));
    builder.requireLoopEntryCount(collectionName, count);
  }

  // P5b COMPUTED values: register the collections whose value chunks must be DERIVED from the trace (the covenant
  // pins them but the SDK has no value param to build them). The auto-derivation reads nNew from the entry's len4
  // and progressively extracts the pinned chunk commitments (like dynamicChunkVars).
  const ownerMasterLock = ((): Uint8Array | undefined => {
    const hex = host.inner?.lockingBytecode;
    if (typeof hex !== 'string') return undefined;
    const lock = hexToBin(hex);
    return lock.length === 35 ? lock : undefined;
  })();
  const ordinaryProductions = params.ordinaryTransportedRoute ? transportedProductions : [];
  for (const production of ordinaryProductions) {
    const chunks = ownerMasterLock
      ? chunksFromValue(production.value, { write: production.write, masterLock: ownerMasterLock })
      : [];
    const localBase = production.write.outputBase - (overrides?.blockBase ?? 0);
    if (chunks.length !== production.write.outputCount || chunks.length === 0 || localBase < 0) {
      throw new Error('Ordinary routed value production has no exact continuation band.');
    }
    for (const [index, chunk] of chunks.entries()) {
      if (!builder.setDerivedChunkOutput(localBase + index, {
        ...chunk, fixedIndex: true, semanticKind: 'valueChunk',
        resourceIdentity: valueChunkWriteResourceIdentity(production.write), resourcePart: `chunk:${index}`,
      })) throw new Error('Ordinary routed value production could not bind its continuation slot.');
    }
  }
  for (const run of computedValueChunkRuns) {
    if (run.slot && ordinaryProductions.some((production: any) => (
      production.write.collection === run.collection && production.write.keySlot === binToHex(run.slot)
    ))) continue;
    builder.registerValueChunkVar(run.collection, DUMMY_FUNDER_LOCKING_BYTECODE, run.id, run.slot);
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
  const trailing = (effectiveBlockLayout?.slots ?? [])
    .filter((slot: any) => slot.kind === 'trailing')
    .map((slot: any) => slot.offset as number)
    .sort((left: number, right: number) => left - right);
  const composed = trailing.length > 0
    && (overrides?.omitLocalFeeTail === true || builder.getComposedBlockBase() !== 0);
  const trailingSet = new Set<number>(trailing);
  const totalMintChunks = valueChunkMints.reduce((sum, mint) => sum + mint.chunks.length, 0);
  const composedChunkBase = composed && totalMintChunks > 0 && trailing.length >= totalMintChunks
    ? trailing[trailing.length - totalMintChunks] : undefined;
  const blockBase = overrides?.blockBase ?? 0;
  const transportedByResource = new Map<string, {
    write: ValueChunkWriteDescriptor; value: Uint8Array; chunks: ReturnType<typeof chunksFromValue>;
  }>();
  const occupiedTransportedSlots = new Set<number>();
  if (composed) for (const production of transportedProductions) {
    const write = production.write as ValueChunkWriteDescriptor;
    const value = production.value as Uint8Array;
    const resource = valueChunkWriteResourceIdentity(write);
    const localBase = write.outputBase - blockBase;
    const chunks = value instanceof Uint8Array && ownerMasterLock
      ? chunksFromValue(value, { write, masterLock: ownerMasterLock }) : [];
    if (transportedByResource.has(resource) || write.categoryId.toLowerCase() !== host.categoryId.toLowerCase()
      || !Number.isSafeInteger(localBase) || localBase < 0 || chunks.length !== write.outputCount
      || chunks.length === 0) {
      throw new Error('Transported mint has no unique authenticated continuation geometry.');
    }
    for (let index = 0; index < chunks.length; index += 1) {
      const offset = localBase + index;
      if (!trailingSet.has(offset) || occupiedTransportedSlots.has(offset)) {
        throw new Error('Transported mint continuation overlaps or leaves its published trailing slots.');
      }
      occupiedTransportedSlots.add(offset);
    }
    transportedByResource.set(resource, { write, value, chunks });
  }
  const occupiedMintSlots = new Set<number>(occupiedTransportedSlots);
  const allocateUntransportedMint = (width: number): number => {
    // The loop-entry planner owns NEW and rewritten-predecessor outputs in this same trailing frame.
    // They are not derived value-chunk pins, so excluding only derivedChunkOutputs can place an
    // unrelated mint over a predecessor. Resolve each current-builder lane through the planner;
    // nested groups' outputBlockSlot coordinates belong to their own blocks, not this one.
    for (const variable of builder.getLoopEntryVars()) {
      if ((variable.categoryId !== undefined && variable.categoryId !== host.categoryId)
        || (variable.delegate === true && compilerRouteDelegateLayout === undefined)) continue;
      const count = builder.getLoopEntryCommitments(variable.collection).length;
      for (let ordinal = 0; ordinal < count; ordinal += 1) {
        const offset = builder.getLoopEntryOutputIndex(variable.collection, ordinal);
        if (trailingSet.has(offset)) occupiedMintSlots.add(offset);
      }
    }
    const first = trailing[0]!;
    const last = trailing[trailing.length - 1]!;
    const preferred = composedChunkBase ?? first;
    const available = (start: number): boolean => Array.from({ length: width }, (_, index) => start + index)
      .every((offset) => trailingSet.has(offset) && !occupiedMintSlots.has(offset)
        && !builder.getDerivedChunkOutputs().has(offset));
    for (let start = preferred; start + width - 1 <= last; start += 1) {
      if (available(start)) return start;
    }
    for (let start = first; start < preferred; start += 1) {
      if (available(start)) return start;
    }
    throw new Error('Untransported mint has no unowned published continuation band.');
  };
  // The routed production owns each transported resource's exact sparse band. Source-order packing is only a
  // provisional fallback for unrelated mints and must never consume a transported resource's claimed slots.
  let composedMintCursor = 0;
  // A direct delegatecall writes the top-level contract's records, so an untransported value-chunk mint lives
  // under that root category and master lock, not the implementation's own deployment.
  const directStateOwnerCategoryId = builder.rootCategoryId;
  const directStateOwnerLock = directStateOwnerCategoryId.toLowerCase() !== host.categoryId.toLowerCase()
    ? builder.ownerMasterLock() : undefined;
  for (const mint of valueChunkMints) {
    // Precomputed values bypass trace-based value-chunk derivation, which normally completes this
    // header too. Publish the entry and its continuations from the same value, preserving its successor
    // and exact write lane: another lane can read the same collection/key without owning this update.
    const collection = host.inner.artifact.stateLayout?.collections?.find((candidate: any) => (
      candidate.name === mint.collection
    ));
    const stateOwnerCategoryId = directStateOwnerCategoryId.toLowerCase();
    const resourceIdentity = collection === undefined ? undefined : [
      stateOwnerCategoryId,
      binToHex(computeCollectionHash(collection.signature)),
      binToHex(mint.slot),
    ].join(':');
    const transported = resourceIdentity === undefined ? undefined : transportedByResource.get(resourceIdentity);
    const value = transported?.value ?? mint.value;
    const digest = transported ? sha256Sync(value) : mint.digest;
    const chunkData = transported ? splitValueIntoValueChunks(value) : mint.chunks;
    builder.completeExistingEntryValueTail(mint.collection, mint.slot, value, mint.slotIndex);
    const chunkLock = transported?.chunks[0]?.lockingBytecode
      ?? (directStateOwnerLock !== undefined
        ? getValueChunkLockingBytecode(
          stateOwnerCategoryId, mint.collection, mint.slot, digest, directStateOwnerLock,
        )
        : addressToLockScript(getValueChunkAddress(
          host.inner, host.categoryId, mint.collection, mint.slot, digest,
        )));
    if (!chunkLock) throw new Error('Mint has no authenticated continuation locking bytecode.');
    const mintBandBase = transported ? transported.write.outputBase - blockBase
      : !composed ? undefined : transportedByResource.size === 0
        ? composedChunkBase === undefined ? undefined : composedChunkBase + composedMintCursor
        : allocateUntransportedMint(chunkData.length);
    if (transported && chunkData.length !== transported.write.outputCount) {
      throw new Error('Transported mint value disagrees with its authenticated continuation width.');
    }
    if (mintBandBase !== undefined && !transported) {
      for (let index = 0; index < chunkData.length; index += 1) {
        occupiedMintSlots.add(mintBandBase + index);
      }
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_CHUNK_MINT === '1') {
      console.error('chunk-mint-place', JSON.stringify({
        collection: mint.collection, chunks: chunkData.length,
        slot: binToHex(mint.slot), digest: binToHex(digest),
        lock: binToHex(chunkLock), composedChunkBase: mintBandBase ?? null,
        bandOffset: mintBandBase, transported: transported !== undefined,
        probeOnly: overrides?.returnProbeOnly === true,
      }));
    }
    chunkData.forEach((data: Uint8Array, i: number) => {
      const commitment = transported?.chunks[i]?.commitment ?? buildValueChunkCommitment(i, data);
      const lockingBytecode = transported?.chunks[i]?.lockingBytecode ?? chunkLock;
      // A composed participant's continuation band lives INSIDE its balanced block: appending would grow the
      // block past the layout the covenant walks (`participant N built X/Y slots`), so pin the chunks at the
      // participant's own trailing coordinates instead.
      if (mintBandBase !== undefined) {
        const expected = {
          commitment,
          lockingBytecode,
          categoryId: stateOwnerCategoryId,
          fixedIndex: true,
          semanticKind: 'valueChunk' as const,
          ...(resourceIdentity !== undefined && {
            resourceIdentity,
            resourcePart: `chunk:${i}`,
          }),
        };
        const existing = builder.getDerivedChunkOutputs().get(mintBandBase + i);
        if (existing && sameDerivedChunkOutputObservation(existing, expected)) return;
        if (transported && existing?.fixedIndex === true) {
          throw new Error('Transported mint cannot replace a conflicting fixed continuation pin.');
        }
        if (builder.setDerivedChunkOutput(mintBandBase + i, expected)) return;
        if (transported) {
          throw new Error('Transported mint could not bind its authenticated continuation slot.');
        }
      }
      if (chunkLock === undefined) throw new Error('Transported mint cannot append outside its claimed band.');
      builder.addValueChunkOutput({
        to: chunkLock,
        amount: 1000n,
        token: {
          category: stateOwnerCategoryId, amount: 0n,
          nft: { capability: 'mutable', commitment },
        },
      });
    });
    composedMintCursor += chunkData.length;
  }
  // Runtime-loop groups normally land as reverse-suffix late outputs (covenant addresses group i as
  // outputCount - chunksAlreadyVerified - groupSize). Under a composed balanced trailing band the same
  // chunks must occupy in-band trailing slots like fixed-key valueChunkMints: appending past blockSize
  // overflows the layout (`participant N built X/Y slots`) and the OP_RETURN late-suffix anchor adds another.
  const composedTrailingLoopChunks = (effectiveBlockLayout?.slots ?? [])
    .some((slot: any) => slot.kind === 'trailing')
    && builder.getComposedBlockBase() !== 0;
  const loopMintsForPlacement = composedTrailingLoopChunks
    ? loopValueChunkMints
    : [...loopValueChunkMints].reverse();
  for (const mint of loopMintsForPlacement) {
    const chunkAddr = getValueChunkAddress(host.inner, host.categoryId, mint.collection, mint.slot, mint.digest);
    mint.chunks.forEach((data: any, i: number) => {
      const output = {
        to: chunkAddr,
        amount: 1000n,
        token: {
          category: host.categoryId, amount: 0n,
          nft: { capability: 'mutable' as const, commitment: buildValueChunkCommitment(i, data) },
        },
      };
      if (composedTrailingLoopChunks) builder.addValueChunkOutput(output);
      else builder.addLateValueChunkOutput(output);
    });
  }

  // blockhash(n) requires tx.time >= n; set it so the derivation probe (and the final tx) satisfy the CLTV.
  // Otherwise ported `block.timestamp` is nLocktime: stamp the provider tip so publish writes a real
  // job.timestamp and later require(tx.time >= posted + 24h) can pass after evm_increaseTime.
  if (maxBhLocktime > 0) builder.setLocktime(maxBhLocktime);
  else {
    const unixLocktime = providerUnixLocktime(host.inner.provider as { getBlockTime?: () => number });
    if (unixLocktime !== undefined) builder.setLocktime(unixLocktime);
  }
  timing?.('registrations-complete');

}
