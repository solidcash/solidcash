/**
 * phase-boundary extract: STB class-body extract — place tail returns after swapped token block.
 */

import { binToHex, binsAreEqual } from '@bitauth/libauth/build/lib/format/hex.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { Output } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  isOpReturnLockingBytecode,
  isPredOutReusableHole,
  redirectViewTailOffOpReturn,
} from './mutable-output-reassert.js';
import { packTailReturnPlacements, writerReturnSlotReservations } from './physical-return-layout.js';
import { returnEventNftCommitment } from './return-event-nft-commitment.js';
import { isViewReturnTailOutput } from './value-chunk-band-helpers.js';
import {
  groupOwnsInBlockReturnEvent,
  isAllZeroCommitment,
  isCompilerDescribedMintingBandWriter,
  parseExternalCallReturnCoordinate,
  type ViewTailPackOptions,
} from './value-chunk-geometry.js';
import {
  inheritWriterBatchPlan,
  isWriterBatchWitnessName,
  writerBatchPlanMatchesPhysicalCarrier,
} from './writer-event-delegate-layout.js';

export type PlaceTailReturnEvent = {
  categoryId: string;
  commitment: Uint8Array;
  identity: string;
  provisional?: boolean;
};

export interface PlaceTailReturnHost {
  readonly externalCallUtxoGroups: ExternalCallUtxoGroup[];
  readonly mintingOutputSwap?: { from: number; width: number; categoryId: string };
  readonly messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
  readonly delegateDynamicChunksAtSuffix: boolean;
  readonly builtReturnEventOutputIndices: Map<string, number>;
  readonly authenticatedViewReturnByGroup: Map<number, { categoryId: string; commitment: string }>;
  readonly valueChunkOutputs: ReadonlyArray<{
    to: string | Uint8Array;
    amount: bigint;
    token?: Output['token'];
  }>;
  findMintingInputIndex(categoryId: string): number;
  getChunkableValueWriteBand(): { start: number; end: number; nNew: number } | undefined;
  dynamicChunkOutputCount(): number;
  tailReturnEventOutputs(): readonly PlaceTailReturnEvent[];
  viewTailPackOptions(suffixStart?: number): ViewTailPackOptions;
  declaredMutableEntrySlotIndices(): number[];
  writeViewTailsAfterWriterOccupancy(builder: TransactionBuilder, returnOutputRefs?: Map<string, Output>): void;
  restoreDeclaredMutableEntrySlots(builder: TransactionBuilder): void;
  reassertInBlockWriterReturns(builder: TransactionBuilder): void;
  /** The digest of the call a direct return record answers; none for a routed one. */
  callRecordDigest?(identity: string): Uint8Array | undefined;
}

export function placeTailReturnAfterSwappedTokenBlock(
  host: PlaceTailReturnHost,
  builder: TransactionBuilder,
  returnOutputRefs?: Map<string, Output>,
): void {
  const swapCategoryId = host.mintingOutputSwap?.categoryId
    ?? host.externalCallUtxoGroups.find((group) =>
      group.sharedGroupIndex === undefined
      && isCompilerDescribedMintingBandWriter(group, true, host.messageBusConvention))?.categoryId;
  if (!swapCategoryId) {
    host.writeViewTailsAfterWriterOccupancy(builder, returnOutputRefs);
    host.reassertInBlockWriterReturns(builder);
    return;
  }
  const master = host.findMintingInputIndex(swapCategoryId);
  if (master < 0) {
    host.writeViewTailsAfterWriterOccupancy(builder, returnOutputRefs);
    host.reassertInBlockWriterReturns(builder);
    return;
  }
  const tokenGroupIndex = host.externalCallUtxoGroups.findIndex((group) =>
    group.categoryId === swapCategoryId && group.sharedGroupIndex === undefined);
  const tokenGroup = tokenGroupIndex >= 0 ? host.externalCallUtxoGroups[tokenGroupIndex] : undefined;
  if (tokenGroup) {
    for (const [index, sibling] of host.externalCallUtxoGroups.entries()) {
      if ((sibling.sharedGroupIndex ?? index) !== tokenGroupIndex) continue;
      if ((sibling.batchPredecessorOutputs?.length ?? 0) === 0
        && (sibling.plannedEntryInserts?.length ?? 0) === 0
        && !Object.entries({ ...sibling.compilerRoute?.internalArgs, ...sibling.internalArgs })
          .some(([name]) => isWriterBatchWitnessName(name))) continue;
      if (!writerBatchPlanMatchesPhysicalCarrier(tokenGroup, sibling)) continue;
      inheritWriterBatchPlan(tokenGroup, sibling);
    }
  }
  const after = master + (tokenGroup?.blockLayout?.blockSize ?? 8);
  const suffixChunkCount = host.delegateDynamicChunksAtSuffix ? host.dynamicChunkOutputCount() : 0;
  const tailReturns = host.tailReturnEventOutputs();
  const placements = packTailReturnPlacements(
    host.externalCallUtxoGroups,
    (categoryId) => host.findMintingInputIndex(categoryId),
    tailReturns,
    swapCategoryId,
    host.getChunkableValueWriteBand()?.end ?? -1,
    host.viewTailPackOptions(suffixChunkCount > 0
      ? builder.outputs.length - suffixChunkCount - 1
      : builder.outputs.length),
  );
  const fixedIdentityIndices = host.viewTailPackOptions().reservedIndices ?? new Set<number>();
  const writerSlots = new Set<number>(fixedIdentityIndices);
  const returnSlot = tokenGroup?.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent');
  if (returnSlot) writerSlots.add(master + returnSlot.offset);
  for (const index of host.declaredMutableEntrySlotIndices()) writerSlots.add(index);
  for (const slot of writerReturnSlotReservations(host.externalCallUtxoGroups)) writerSlots.add(slot);
  const writerEnd = writerSlots.size > 0 ? Math.max(...writerSlots) : after - 1;
  const assignedTailStart = [...placements.values()].reduce(
    (min, index) => Math.min(min, index),
    Number.POSITIVE_INFINITY,
  );
  const trailingPredCount = (tokenGroup?.batchPredecessorOutputs ?? [])
    .filter((pred) => pred.outputBlockSlot >= (tokenGroup?.blockLayout?.blockSize ?? 8)).length;
  // Keep INSERT P' on master+blockSize. Packing view tails onto that slot overwrites the
  // collection lockscript and transferFrom then EQUALVERIFYs OP_TRUE against the entry P2SH32.
  const predBandEnd = after + trailingPredCount;
  const tailStart = Number.isFinite(assignedTailStart)
    ? Math.max(predBandEnd, writerEnd + 1, assignedTailStart)
    : Math.max(predBandEnd, writerEnd + 1);
  if (tailReturns.length > 0) {
    let lastTail = tailStart - 1;
    // Compact from tailStart (after the swapped token block) but visit pending
    // identities in assigned-placement order so a loop's i=1 slot is not the
    // next logical callsite. Raw assigned ranks can still be the pre-swap
    // 30/31 band; writing there lands inside FakeToken.
    const placementRank = (event: (typeof tailReturns)[number]): number => (
      placements.get(event.identity)
        ?? placements.get(`${event.identity}:0`)
        ?? Number.MAX_SAFE_INTEGER
    );
    const orderedTails = tailReturns
      .map((event, index) => ({ event, index }))
      .sort((left, right) => placementRank(left.event) - placementRank(right.event) || left.index - right.index);
    for (const [offset, { event }] of orderedTails.entries()) {
      let placedIndex = placementRank(event) !== Number.MAX_SAFE_INTEGER
        ? placementRank(event)
        : tailStart + offset;
      if (placedIndex < 0 || writerSlots.has(placedIndex) || placedIndex < tailStart) {
        placedIndex = tailStart + offset;
        while (writerSlots.has(placedIndex)) placedIndex += 1;
      }
      if (placedIndex < 0) continue;
      while (placedIndex >= builder.outputs.length) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 800n });
      }
      // Identity-scan value chunks may already occupy trailing indices. Skip those
      // locks so view-tail packing cannot convert them into OP_TRUE none-cap tails.
      const occupantLock = builder.outputs[placedIndex]?.to instanceof Uint8Array
        ? builder.outputs[placedIndex]!.to as Uint8Array
        : undefined;
      const occupantIsStagedChunk = !!occupantLock
        && host.valueChunkOutputs.some((staged) => (
          staged.to instanceof Uint8Array && binsAreEqual(staged.to, occupantLock)
        ));
      if (occupantIsStagedChunk) {
        placedIndex = builder.outputs.length;
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 800n });
      }
      const coordinate = parseExternalCallReturnCoordinate(event.identity);
      const groupIdx = coordinate?.groupIndex ?? -1;
      const group = groupIdx >= 0 ? host.externalCallUtxoGroups[groupIdx] : undefined;
      // OP_RETURN is never a data carrier. Prefer the live separator index;
      // fall back to the reserved value-chunk suffix slot when it is not materialized yet.
      const liveOpReturn = builder.outputs.findIndex((out) => (
        isOpReturnLockingBytecode(
          out?.to instanceof Uint8Array ? out.to
            : typeof out?.to === 'string' ? out.to : undefined,
        )
      ));
      const fallbackSuffixChunkCount = host.delegateDynamicChunksAtSuffix
        ? host.dynamicChunkOutputCount() : 0;
      const suffixStart = liveOpReturn >= 0
        ? liveOpReturn
        : (fallbackSuffixChunkCount > 0
          ? builder.outputs.length - fallbackSuffixChunkCount - 1
          : undefined);
      let redirected = redirectViewTailOffOpReturn({
        placedIndex,
        plannedIndex: group?.plannedReturnOutputIndex,
        returnIndex: group?.returnOutputIndex,
        suffixStart,
        reservedIndices: fixedIdentityIndices,
        outputs: builder.outputs,
      });
      if (redirected === undefined) {
        const nextIndex = (suffixStart ?? placedIndex) + 1;
        while (nextIndex >= builder.outputs.length) {
          builder.addOutput({ to: Uint8Array.of(0x51), amount: 800n });
        }
        redirected = nextIndex;
      }
      placedIndex = redirected;
      // Hard refuse: never write authenticated view data onto OP_RETURN.
      if (isOpReturnLockingBytecode(
        builder.outputs[placedIndex]?.to instanceof Uint8Array
          ? builder.outputs[placedIndex]!.to as Uint8Array
          : typeof builder.outputs[placedIndex]?.to === 'string'
            ? builder.outputs[placedIndex]!.to as string
            : undefined,
      )) {
        const nextIndex = placedIndex + 1;
        while (nextIndex >= builder.outputs.length) {
          builder.addOutput({ to: Uint8Array.of(0x51), amount: 800n });
        }
        placedIndex = nextIndex;
      }
      const rawCommitment = binToHex(event.commitment);
      const commitment = rawCommitment === '' ? '0101'
        : returnEventNftCommitment(event.commitment, host.callRecordDigest?.(event.identity));
      const output: Output = {
        to: Uint8Array.of(0x51),
        amount: 800n,
        token: {
          amount: 0n,
          category: event.categoryId,
          nft: { capability: 'none', commitment },
        },
      };
      if (fixedIdentityIndices.has(placedIndex)) {
        throw new Error('View return redirection collides with an input-bearing identity output.');
      }
      builder.outputs[placedIndex] = output;
      returnOutputRefs?.set(event.identity, output);
      host.builtReturnEventOutputIndices.set(event.identity, placedIndex);
      if (groupIdx >= 0 && coordinate?.part === 0
        && rawCommitment !== '' && rawCommitment !== '0101'
        && !isAllZeroCommitment(rawCommitment)) {
        host.authenticatedViewReturnByGroup.set(groupIdx, {
          categoryId: event.categoryId,
          commitment,
        });
      }
      if (group && groupIdx >= 0 && coordinate?.part === 0
        && !groupOwnsInBlockReturnEvent(host.externalCallUtxoGroups, groupIdx)) {
        group.returnOutputIndex = placedIndex;
      }
      lastTail = placedIndex;
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
      console.error('tail-place-band', {
        master, after, writerEnd, tailStart, lastTail,
        predDest: Math.max(tokenGroup?.relocatedPredOutBase ?? 0, lastTail + 1),
        relocatedPredOutBase: tokenGroup?.relocatedPredOutBase,
        written: orderedTails.map(({ event }) => ({
          identity: event.identity,
          index: host.builtReturnEventOutputIndices.get(event.identity)
            ?? host.builtReturnEventOutputIndices.get(`${event.identity}:0`),
          commitment: binToHex(event.commitment),
        })),
      });
    }
    // INSERT P' occupies master+blockSize. View tails start after that band, so
    // do not replay predecessors past lastTail — that cloned P' at 38 and made
    // transferFrom's collection count expect 4 while the scan saw 3.
    const blockSize = tokenGroup?.blockLayout?.blockSize ?? 8;
    const predDestBase = Math.max(
      tokenGroup?.relocatedPredOutBase ?? after,
      lastTail + 1,
    );
    let predOrdinal = 0;
    for (const pred of tokenGroup?.batchPredecessorOutputs ?? []) {
      if (pred.outputBlockSlot < blockSize) continue;
      const predDest = predDestBase + predOrdinal;
      predOrdinal += 1;
      while (predDest >= builder.outputs.length) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 800n });
      }
      const occupant = builder.outputs[predDest];
      if (isViewReturnTailOutput({
        to: occupant?.to instanceof Uint8Array ? occupant.to : undefined,
        token: occupant?.token,
      })) continue;
      const isHole = !occupant || !occupant.token || isPredOutReusableHole({
        to: occupant.to instanceof Uint8Array ? occupant.to : undefined,
        token: occupant.token,
      });
      if (!isHole) continue;
      builder.outputs[predDest] = {
        to: pred.lockingBytecode,
        amount: 1000n,
        token: {
          amount: 0n,
          category: tokenGroup!.categoryId,
          nft: { capability: 'mutable', commitment: pred.commitment },
        },
      };
    }
    host.restoreDeclaredMutableEntrySlots(builder);
    host.reassertInBlockWriterReturns(builder);
    return;
  }
  // A physical return is materialized only for a selected producer-result identity. In particular, do not
  // manufacture an anonymous placeholder at master+blockSize: that coordinate may be the one-to-one output of
  // the next authenticated participant, and no consumer can soundly refer to an identity-free result anyway.
  host.restoreDeclaredMutableEntrySlots(builder);
  host.reassertInBlockWriterReturns(builder);
}

/**
 * OP_RETURN is never a data carrier. Ensure each authenticated pending view
 * return sits on a non-OP_RETURN unlock pad (stamp zero pads; evacuate if the
 * bound index was turned into the separator).
 */
