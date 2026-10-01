/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — nested LLC entry-NFT pin
 * remainder after value-chunk staging (NEW-slot seed through INSERT/UPDATE
 * absolute pins). Host keeps commits/event pinning that follows.
 */

import { binToHex, binsAreEqual, bigIntToVmNumber, hexToBin } from '@bitauth/libauth';
import {
  encodeChunkableValueTail,
  type AbiFunction,
} from '@solidcash/utils';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { getEntryNftLockingBytecode } from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { LEGACY_JOB_EVENTS_COLLECTION_ALIASES } from './legacy-planning-heuristics.js';
import {
  resolveChunkableEntryCollection,
  resolvePublishedEntryBlockOffset,
} from './kernel-value-chunk-lanes.js';
import {
  extractFailingP2sh32OutputPin,
  lastExtractedComputedValue,
} from './route-value-chunk-helpers.js';
import type { MessageBusRuntimeAbiFunction } from './sc-batch-raw.js';
import { decodeEntryCommitment, encodeEntryCommitment, keyToSlot } from './SortedList.js';
import {
  sameDerivedChunkOutputObservation,
  type StatefulTransactionBuilder,
} from './StatefulTransactionBuilder.js';
import { ownsCapturedValueChunkOutputBase } from './value-chunk-base-writer-select.js';
import { chunkableValueWriteCollections } from './writer-group-selection.js';

export type ApplyDeriveFullNestedEntryPinsHost = {
  readonly categoryId: string;
  readonly inner: any;
};

export type ApplyDeriveFullNestedEntryPinsResult = {
  commitmentProgressDelta: number;
  nestedPinProgressDelta: number;
};

/**
 * Seed/pin nested delegate entry-NFT outputs (P'/NEW INSERT or in-place UPDATE)
 * after value chunks are staged for one LLC iteration.
 */
export function applyDeriveFullNestedEntryPins(
  host: ApplyDeriveFullNestedEntryPinsHost,
  params: {
    stb: StatefulTransactionBuilder;
    probeBuilder2: TransactionBuilder;
    llc: any;
    nestedTrace: any[];
    implInputIndex: number;
    proxyGroup: ExternalCallUtxoGroup | undefined;
    chunkCategory: string | undefined;
    valueChunkWrites: any[];
    band: any;
    allChunks: any[];
    fallbackBase: number;
    pin: any;
    [key: string]: any;
  },
): ApplyDeriveFullNestedEntryPinsResult {
  let commitmentProgressDelta = 0;
  let nestedPinProgressDelta = 0;
  const {
    stb, probeBuilder2, llc, nestedTrace, implInputIndex, proxyGroup,
    chunkCategory, valueChunkWrites, band, fallbackBase,
  } = params;

  // After value chunks are staged, derivation probes often die before the entry-NFT
  // OUTPUTBYTECODE pin. Seed the implementation-relative NEW slot (INPUTINDEX+blockSize)
  // with the EntryNft lock so the next probe can reveal the real commitment.
  if ((stb.hasStagedValueChunkOutputs() || stb.getJobEventsRedeemLock()) && chunkCategory) {
    const entryPin = extractFailingP2sh32OutputPin(nestedTrace);
    const stagedValueLock = stb.getJobEventsRedeemLock();
    const nestedEntryAbi = llc.compilerRoute?.abiFunction
    ?? llc.externalContract?.inner.artifact.abi.find(
      (candidate: AbiFunction) => candidate.name === llc.functionName,
    );
    const entryContract = llc.externalContract?.inner
    ?? proxyGroup?.externalContract?.inner;
    const entryCollections = nestedEntryAbi
      ? chunkableValueWriteCollections(llc, nestedEntryAbi)
      : [];
    const entryCollection = resolveChunkableEntryCollection({
      writes: valueChunkWrites,
      categoryId: chunkCategory,
      publishedCollections: entryCollections,
      // The enclosing dispatcher owns the convention. A legacy or descriptor-free child nested below
      // a kernel route must not re-enable the compatibility fallback.
      convention: host.inner.artifact.messageBus?.convention
      ?? (nestedEntryAbi as MessageBusRuntimeAbiFunction | undefined)
        ?.messageBusConvention
      ?? llc.logicalArtifact?.messageBus?.convention
      ?? llc.externalContract?.inner.artifact.messageBus?.convention,
      // Compatibility for descriptor-free legacy artifacts only.
      legacyFallback: LEGACY_JOB_EVENTS_COLLECTION_ALIASES[0],
    });
    const blockSize = nestedEntryAbi?.blockLayout?.blockSize
    ?? llc.blockLayout?.blockSize
    ?? 5;
    const physicalEntrySlot = (
      nestedEntryAbi as { physicalEntrySlots?: number[] } | undefined
    )?.physicalEntrySlots?.[0]
    ?? (llc.compilerRoute as { physicalEntrySlots?: number[] } | undefined)
      ?.physicalEntrySlots?.[0]
    ?? (llc.externalContract?.inner.artifact.messageBus?.handlers?.find(
      (handler: { name?: string }) => handler.name === llc.functionName,
    ) as { physicalEntrySlots?: number[] } | undefined)?.physicalEntrySlots?.[0];
    // The covenant addresses its entry output as INPUTINDEX + the published block-slot offset of that
    // entry (see emitEntryOutputIndex). `blockSize` is the coordinate just PAST the block, so using it
    // as an offset names a trailing slice instead of the entry slot whenever the block carries any slot
    // after the entry (for example an event). Prefer the layout's own entry offset.
    const publishedBlockLayout = nestedEntryAbi?.blockLayout ?? llc.blockLayout;
    const publishedEntrySlotOffset = resolvePublishedEntryBlockOffset(
      publishedBlockLayout, physicalEntrySlot,
    );
    // `physicalEntrySlots` identifies an entry-access lane; it is not necessarily the lane's
    // transaction-block offset. Resolve it through the published block layout before converting the
    // participant-relative coordinate to an absolute output index.
    const layoutEntryIndex = implInputIndex + (publishedEntrySlotOffset ?? blockSize);
    let entryLock = entryPin
    && !(stagedValueLock && binsAreEqual(entryPin.lockingBytecode, stagedValueLock))
      ? entryPin.lockingBytecode
      : undefined;
    if (!entryLock && entryContract && entryCollection) {
      try {
        entryLock = getEntryNftLockingBytecode(entryContract, chunkCategory, entryCollection);
      } catch {
        entryLock = undefined;
      }
    }
    // Prefer an introspected output index only when that slot already holds the
    // EntryNft lock. Never treat value-chunk band OP_TRUE pads as entry slots.
    const failStackForIndex = (
      nestedTrace.find((state: any) => state.error) ?? nestedTrace.at(-1)
    )?.stack ?? [];
    let entryIndexFromTrace: number | undefined;
    if (entryLock) {
      for (const item of [...failStackForIndex].reverse()) {
        if (!(item.length === 1 && item[0] > 0 && item[0] < 64)) continue;
        const candidate = item[0];
        const output = probeBuilder2.outputs[candidate];
        const lock = output?.to instanceof Uint8Array ? output.to : undefined;
        if (lock && binsAreEqual(lock, entryLock)) {
          entryIndexFromTrace = candidate;
          break;
        }
      }
    }
    const entryIndex = entryPin
    && !(stagedValueLock && binsAreEqual(entryPin.lockingBytecode, stagedValueLock))
      ? entryPin.outputIndex
      : (entryIndexFromTrace ?? layoutEntryIndex);
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1') {
      console.error('nested-entry-pin', JSON.stringify({
        found: !!entryPin,
        outputIndex: entryIndex,
        layoutEntryIndex,
        lock: entryLock ? binToHex(entryLock).slice(0, 20) : undefined,
        collection: entryCollection,
      }));
    }
    if (entryLock) {
    // Sorted INSERT pins two outputs:
    //   P' at the co-spent entry slot (physicalEntrySlots) = pred.slot||Hk||pred.value
    //   NEW at trailing (impl+blockSize) = Hk||pred.next||valueTail
    // keyToSlot(vm(0)) === sha256("") (emptyRoot). That is a valid jobId=0 slot — do not
    // treat an emptyRoot *prefix* as a value-digest false positive. The false positive is
    // digest||emptyRoot (nextKey lane holds emptyRoot while slot is neither HEAD nor emptyRoot).
      const emptyRoot = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const looksLikeValueDigestFalsePositive = (commitmentHex: string): boolean => {
        const c = commitmentHex.toLowerCase();
        if (c.length < 128) return false;
        const slotHex = c.slice(0, 64);
        const nextHex = c.slice(64, 128);
        return nextHex === emptyRoot
        && slotHex !== emptyRoot
        && slotHex !== '0'.repeat(64);
      };
      const plannedInsert = [
        ...(llc.plannedEntryInserts ?? []),
        ...(proxyGroup?.plannedEntryInserts ?? []),
      ].find((insert) => (
        insert.newCommitment
      && insert.newCommitment.length >= 128
      && !looksLikeValueDigestFalsePositive(insert.newCommitment)
      && insert.newCommitment.toLowerCase() !== `${'00'.repeat(64)}`
      ));
      const failStack = (nestedTrace.find((state: any) => state.error) ?? nestedTrace.at(-1))
        ?.stack ?? [];
      // Value tails: long form is len4||digest32||head28 (64 bytes, storedLen>60);
      // short inline is len4||data with length === 4+storedLen.
      const storedLenOf = (item: Uint8Array): number => (
        item[0]! | (item[1]! << 8) | (item[2]! << 16) | (item[3]! << 24)
      );
      const valueTailFromTrace = failStack.find((item: any) => {
        if (item.length < 4) return false;
        const storedLen = storedLenOf(item);
        if (storedLen > 60) return item.length === 64;
        return storedLen >= 0 && item.length === 4 + storedLen;
      });
      // First probes often expose sha256(value) without a 64-byte valueTail yet.
      // Once chunks selected the authenticated blob, synthesize the tail from it.
      const valueTailFromSelected = lastExtractedComputedValue
      && lastExtractedComputedValue.length > 60
        ? encodeChunkableValueTail(lastExtractedComputedValue)
        : undefined;
      const valueTailForEntry = valueTailFromTrace ?? valueTailFromSelected;
      let predCommitment = plannedInsert?.commitment;
      let newCommitment = plannedInsert?.newCommitment;
      if (newCommitment && valueTailForEntry) {
      // Keep planned Slot/Next; refresh an empty/short value tail from the failing frame.
        const parsed = decodeEntryCommitment(hexToBin(newCommitment));
        if (parsed.value.length === 0
        || parsed.value.length < valueTailForEntry.length) {
          newCommitment = binToHex(encodeEntryCommitment(
            parsed.slot, parsed.nextKey, valueTailForEntry,
          ));
        }
      }
      const jobIdArg = (llc.logicalFunctionArgs ?? llc.functionArgs)?.[0];
      const jobId = typeof jobIdArg === 'bigint' ? jobIdArg
        : typeof jobIdArg === 'number' ? BigInt(jobIdArg)
          : undefined;
      const entryOffset = publishedEntrySlotOffset ?? 3;
      const coSpentCommitment = llc.blockInputs?.[entryOffset]?.token?.nft?.commitment;
      const coSpent = typeof coSpentCommitment === 'string'
      && coSpentCommitment.length >= 128
        ? decodeEntryCommitment(hexToBin(coSpentCommitment))
        : undefined;
      // plannedInsert may still carry a HEAD pred from an earlier empty-map plan.
      // When the co-spent entry already holds this jobId slot, force in-place UPDATE.
      if (jobId !== undefined && coSpent !== undefined) {
        const slot = keyToSlot(bigIntToVmNumber(jobId));
        if (binsAreEqual(coSpent.slot, slot)) {
          if (valueTailForEntry) {
            newCommitment = binToHex(encodeEntryCommitment(
              coSpent.slot, coSpent.nextKey, valueTailForEntry,
            ));
          } else if (newCommitment) {
            const parsed = decodeEntryCommitment(hexToBin(newCommitment));
            newCommitment = binToHex(encodeEntryCommitment(
              coSpent.slot, coSpent.nextKey,
              parsed.value.length > 0 ? parsed.value : coSpent.value,
            ));
          }
          predCommitment = undefined;
        }
      }
      if (!newCommitment) {
      // Build from the callee's jobId_ argument (uint256 → VM number → keyToSlot).
      // When the co-spent entry already holds that slot, rewrite in place (UPDATE);
      // only synthesize a HEAD predecessor for a true first INSERT.
        if (jobId !== undefined && valueTailForEntry) {
          const slot = keyToSlot(bigIntToVmNumber(jobId));
          const updatingExisting = coSpent !== undefined
          && binsAreEqual(coSpent.slot, slot);
          if (updatingExisting) {
            newCommitment = binToHex(encodeEntryCommitment(
              coSpent.slot, coSpent.nextKey, valueTailForEntry,
            ));
            predCommitment = undefined;
          } else {
            newCommitment = binToHex(encodeEntryCommitment(
              slot, new Uint8Array(32), valueTailForEntry,
            ));
            predCommitment = binToHex(encodeEntryCommitment(
              new Uint8Array(32), slot, new Uint8Array(),
            ));
          }
        }
      }
      // Co-spent entry index (P') vs trailing NEW index.
      const predIndices = new Set<number>([entryIndex]);
      for (const item of failStackForIndex) {
        if (!(item.length === 1 && item[0] > 0 && item[0] < 64)) continue;
        const candidate = item[0];
        const output = probeBuilder2.outputs[candidate];
        const lock = output?.to instanceof Uint8Array ? output.to : undefined;
        if (lock && binsAreEqual(lock, entryLock)) predIndices.add(candidate);
      }
      const newIndex = implInputIndex + blockSize;
      let placedEntry = false;
      if (predCommitment && predCommitment.length >= 128) {
      // Reject a raw HEAD sentinel (next=0) — INSERT P' must repoint next to Hk.
        const predParsed = decodeEntryCommitment(hexToBin(predCommitment));
        if (predParsed.nextKey.every((byte) => byte === 0) && newCommitment) {
          const inserted = decodeEntryCommitment(hexToBin(newCommitment));
          predCommitment = binToHex(encodeEntryCommitment(
            predParsed.slot, inserted.slot, predParsed.value,
          ));
        }
        for (const index of predIndices) {
          if (index === newIndex) continue;
          const nextObservation = {
            commitment: predCommitment,
            lockingBytecode: entryLock,
            categoryId: chunkCategory,
            fixedIndex: true,
            semanticKind: 'entryPin' as const,
          };
          const existingObservation = stb.getDerivedChunkOutputs().get(index);
          // A trace can mention a continuation coordinate while searching for the entry predecessor.
          // Exact resource ownership wins; entry repair must wait for its own stable coordinate rather
          // than clearing an authenticated value part which happens to share the same P2SH32 shape.
          if (existingObservation?.semanticKind === 'valueChunk'
          || existingObservation?.resourceIdentity !== undefined) continue;
          if (sameDerivedChunkOutputObservation(
            existingObservation, nextObservation,
          )) continue;
          stb.clearDerivedChunkOutput(index);
          if (stb.setDerivedChunkOutput(index, nextObservation)) placedEntry = true;
        }
      }
      if (newCommitment && newCommitment.length >= 128) {
      // UPDATE rewrites the co-spent entry slot; INSERT places NEW at impl+blockSize.
        const targetIndex = predCommitment ? newIndex : entryIndex;
        if (!predCommitment) {
        // Drop stale fixed entry pins from earlier probes (e.g. entryIndex 15
        // while the settled layout uses INPUTINDEX+3 = 16). Snapshot keys
        // first — deleting while iterating a Map can skip entries.
          const staleEntryPins = [...stb.getDerivedChunkOutputs().entries()]
            .filter(([index, chunk]) => (
              index !== targetIndex
            && chunk.fixedIndex === true
            && chunk.semanticKind !== 'valueChunk'
            && chunk.resourceIdentity === undefined
            && binsAreEqual(chunk.lockingBytecode, entryLock)
            ))
            .map(([index]) => index);
          for (const index of staleEntryPins) stb.clearDerivedChunkOutput(index);
          // Demote only dataNft slots (+1/+2) that already materialised stale entry pins.
          for (const index of [implInputIndex + 1, implInputIndex + 2]) {
            if (index === targetIndex) continue;
            const output = probeBuilder2.outputs[index];
            const lock = output?.to instanceof Uint8Array ? output.to : undefined;
            if (!lock || !binsAreEqual(lock, entryLock)) continue;
            if (output?.token?.nft?.capability !== 'mutable') continue;
            probeBuilder2.outputs[index] = {
              to: Uint8Array.of(0x51),
              amount: 1000n,
            };
          }
        }
        if (stb.setDerivedChunkOutput(targetIndex, {
          commitment: newCommitment,
          lockingBytecode: entryLock,
          categoryId: chunkCategory,
          fixedIndex: true,
          semanticKind: 'entryPin',
        })) placedEntry = true;
        // Authoritative absolute + relative entry pins for appendDelegate materialization.
        // INSERT: entry slot keeps P' (predCommitment); NEW is only at targetIndex.
        // UPDATE: both relative and absolute pins carry newCommitment at the co-spent slot.
        const entryCategory = proxyGroup?.categoryId ?? chunkCategory;
        const entryLayout = nestedEntryAbi?.blockLayout ?? llc.blockLayout;
        const layoutEntryOffset = entryLayout?.slots.find((slot: { kind: string; offset: number; slotIndex?: number }) => (
          slot.kind === 'entry' && (physicalEntrySlot === undefined
          || slot.slotIndex === physicalEntrySlot || slot.offset === physicalEntrySlot)
        ))?.offset ?? 3;
        if (predCommitment) {
        // Drop a stale NEW absolute pin so P' can win at the co-spent entry slot.
          stb.clearExternalCallEntryOutputAt(entryIndex);
          // Pin P' at both the callee layout entry offset and any planned INSERT
          // blockSlot (proxy embedding shifts entry from +3 to e.g. +6).
          stb.setExternalCallEntryOutput(entryCategory, layoutEntryOffset, predCommitment);
          if (plannedInsert && plannedInsert.blockSlot !== layoutEntryOffset) {
            stb.setExternalCallEntryOutput(
              entryCategory, plannedInsert.blockSlot, predCommitment,
            );
          }
          stb.setExternalCallEntryOutputAt(entryIndex, entryCategory, predCommitment);
          stb.setExternalCallEntryOutputAt(targetIndex, entryCategory, newCommitment);
        } else {
          stb.setExternalCallEntryOutput(entryCategory, layoutEntryOffset, newCommitment);
          stb.setExternalCallEntryOutputAt(targetIndex, entryCategory, newCommitment);
        }
      }
      // Keep planned inserts aligned with the learned P'/NEW (or in-place UPDATE) pair.
      // On UPDATE, clear insert.commitment so _reassertNestedSameIndexMutables cannot
      // re-seed the old co-spent entry onto a dataNft cursor.
      if (newCommitment && !looksLikeValueDigestFalsePositive(newCommitment)) {
        for (const insert of [
          ...(llc.plannedEntryInserts ?? []),
          ...(proxyGroup?.plannedEntryInserts ?? []),
        ]) {
          if (predCommitment) insert.commitment = predCommitment;
          else delete (insert as { commitment?: string }).commitment;
          insert.newCommitment = newCommitment;
          if (!predCommitment) {
          // In-place UPDATE: NEW coordinate collapses onto the co-spent entry slot.
            insert.outputBlockSlot = publishedEntrySlotOffset ?? 3;
          } else if (insert.outputBlockSlot < 0) {
            insert.outputBlockSlot = blockSize;
          }
        }
        const chunkBase = band?.start ?? fallbackBase;
        if (chunkBase >= 0) {
          const baseUpdate = {
            __internal__valueChunkOutputBase: BigInt(chunkBase),
          };
          if (ownsCapturedValueChunkOutputBase(llc)) {
            llc.refreshInternalArgs?.(baseUpdate, { shiftPredOut: false });
          }
          if (proxyGroup && ownsCapturedValueChunkOutputBase(proxyGroup)) {
            proxyGroup.refreshInternalArgs?.(baseUpdate, { shiftPredOut: false });
          }
        }
      }
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1') {
        console.error('nested-entry-placed', JSON.stringify({
          placedEntry,
          entryIndex,
          newIndex,
          pred: predCommitment?.slice(0, 16),
          neu: newCommitment?.slice(0, 16),
          plannedInsert: !!plannedInsert?.newCommitment,
          derivedHas: stb.getDerivedChunkOutputs().has(entryIndex),
        }));
      }
      if (placedEntry) {
        commitmentProgressDelta += 1;
        nestedPinProgressDelta += 1;
      }
    }
  }
  return { commitmentProgressDelta, nestedPinProgressDelta };
}
