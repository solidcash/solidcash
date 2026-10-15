/**
 * phase-boundary extract: STB class-body extract — view-tail write after writer occupancy + vacate
 * chunkable-value-band view tails.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { isScidIdentityCommitment } from './logical-identity.js';
import { sameIndexScidIdentityInputIndices } from './same-index-scid.js';
import {
  isOpReturnLockingBytecode,
  redirectViewTailOffOpReturn,
} from './mutable-output-reassert.js';
import {
  findViewTailDestinations,
  lastCollidingMutableWriterIndex,
  packTailReturnPlacements,
} from './physical-return-layout.js';
import { cloneToken } from './stb-output-utils.js';
import { isViewReturnTailOutput } from './value-chunk-band-helpers.js';
import {
  clampViewTailPlacement,
  groupOwnsInBlockReturnEvent,
  isCompilerDescribedMintingBandWriter,
  parseExternalCallReturnCoordinate,
  type ViewTailPackOptions,
} from './value-chunk-geometry.js';

export type ViewTailReturnEvent = {
  categoryId: string;
  commitment: Uint8Array;
  identity: string;
  provisional?: boolean;
};

export interface ViewTailOccupancyHost {
  readonly allInputs: readonly UnlockableUtxo[];
  readonly externalCallUtxoGroups: ExternalCallUtxoGroup[];
  readonly messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
  readonly delegateDynamicChunksAtSuffix: boolean;
  readonly derivedChunkOutputs: ReadonlyMap<number, unknown>;
  readonly builtReturnEventOutputIndices: Map<string, number>;
  getChunkableValueWriteBand(): { start: number; end: number; nNew: number } | undefined;
  findMintingInputIndex(categoryId: string): number;
  dynamicChunkOutputCount(): number;
  tailReturnEventOutputs(): readonly ViewTailReturnEvent[];
  declaredMutableEntrySlotIndices(): number[];
  restoreDeclaredMutableEntrySlots(builder: TransactionBuilder): void;
  reassertInBlockWriterReturns(builder: TransactionBuilder): void;
  applyDerivedValueChunks(builder: TransactionBuilder): void;
}

/**
 * View tails are OP_TRUE + none-cap return NFTs. Token-swap placement already
 * parks them after a token writer; without a swap, mutable value chunks can still occupy
 * the first planned tail slots. Write the pending views after that writer band
 * and leave collection/value-chunk coordinates unmoved.
 */
export function writeViewTailsAfterWriterOccupancy(
  host: ViewTailOccupancyHost,
  builder: TransactionBuilder,
  returnOutputRefs?: Map<string, Output>,
): void {
  const tailReturns = host.tailReturnEventOutputs();
  if (tailReturns.length === 0) return;
  const fixedIdentityIndices = sameIndexScidIdentityInputIndices(host.allInputs);
  const suffixChunkCountForPack = host.delegateDynamicChunksAtSuffix ? host.dynamicChunkOutputCount() : 0;
  const packOptions: ViewTailPackOptions = {
    reservedIndices: fixedIdentityIndices,
    band: host.getChunkableValueWriteBand(),
    suffixStart: suffixChunkCountForPack > 0
      ? builder.outputs.length - suffixChunkCountForPack - 1
      : Math.max(0, host.allInputs.length - 1),
    tokenWriterPresent: host.externalCallUtxoGroups.some((group) =>
      isCompilerDescribedMintingBandWriter(group, true, host.messageBusConvention)),
  };
  const planned = packTailReturnPlacements(
    host.externalCallUtxoGroups,
    (categoryId) => host.findMintingInputIndex(categoryId),
    tailReturns,
    '',
    -1,
    packOptions,
  );
  const plannedIndices = [...planned.values()];
  const derivedHit = plannedIndices.some((index) => host.derivedChunkOutputs.has(index));
  const derivedEnd = derivedHit
    ? [...host.derivedChunkOutputs.keys()].reduce((max, index) => Math.max(max, index), -1)
    : -1;
  const writerEnd = Math.max(
    lastCollidingMutableWriterIndex(builder.outputs, plannedIndices),
    derivedEnd,
  );
  const suffixChunkCount = host.delegateDynamicChunksAtSuffix ? host.dynamicChunkOutputCount() : 0;
  const suffixStart = suffixChunkCount > 0
    ? builder.outputs.length - suffixChunkCount - 1
    : builder.outputs.length;
  const reserved = new Set<number>(fixedIdentityIndices);
  for (const [index, input] of host.allInputs.entries()) {
    const cap = input.token?.nft?.capability;
    if (cap === 'minting' || cap === 'mutable') reserved.add(index);
  }
  for (const index of host.derivedChunkOutputs.keys()) reserved.add(index);
  const padDestinations = writerEnd >= 0
    ? findViewTailDestinations(builder.outputs, tailReturns.length, {
      suffixStart, reserved, preferBefore: writerEnd,
    })
    : [];
  const placements = new Map(planned);
  if (padDestinations.length === tailReturns.length && fixedIdentityIndices.size === 0) {
    const orderedIdentities = tailReturns.map((event) => event.identity);
    for (const [offset, identity] of orderedIdentities.entries()) {
      const plannedIndex = planned.get(identity) ?? padDestinations[offset];
      placements.set(identity, clampViewTailPlacement({
        planned: plannedIndex,
        packed: padDestinations[offset],
        band: packOptions.band,
        suffixStart: packOptions.suffixStart,
        tokenWriterPresent: packOptions.tokenWriterPresent,
      }));
    }
  } else if (writerEnd >= 0) {
    const packed = packTailReturnPlacements(
      host.externalCallUtxoGroups,
      (categoryId) => host.findMintingInputIndex(categoryId),
      tailReturns,
      '',
      writerEnd,
      packOptions,
    );
    for (const [identity, index] of packed) placements.set(identity, index);
  }
  const placementRank = (event: (typeof tailReturns)[number]): number => (
    placements.get(event.identity)
      ?? placements.get(`${event.identity}:0`)
      ?? Number.MAX_SAFE_INTEGER
  );
  const orderedTails = tailReturns
    .map((event, index) => ({ event, index }))
    .sort((left, right) => placementRank(left.event) - placementRank(right.event) || left.index - right.index);
  const writerReturnSlots = new Set<number>();
  for (const [groupIdx, group] of host.externalCallUtxoGroups.entries()) {
    if (!groupOwnsInBlockReturnEvent(host.externalCallUtxoGroups, groupIdx)) continue;
    const physical = host.externalCallUtxoGroups[group.sharedGroupIndex ?? groupIdx];
    const master = host.findMintingInputIndex(physical.categoryId);
    const returnSlot = physical.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent');
    if (master >= 0 && returnSlot) writerReturnSlots.add(master + returnSlot.offset);
    const placed = group.plannedReturnOutputIndex ?? group.returnOutputIndex;
    if (placed !== undefined) writerReturnSlots.add(placed);
  }
  for (const index of host.declaredMutableEntrySlotIndices()) writerReturnSlots.add(index);
  for (const { event } of orderedTails) {
    let outputIndex = placementRank(event);
    if (outputIndex === Number.MAX_SAFE_INTEGER) continue;
    // Dynamic-storage chunks own the output suffix. A planned tail that lands in that
    // band must move before it — skipping leaves a zero placeholder while unlock
    // witnesses still name the planned index, so nested view returns decode as false.
    if (outputIndex >= suffixStart) {
      const relocated = findViewTailDestinations(builder.outputs, 1, {
        suffixStart,
        reserved: new Set([...reserved, ...writerReturnSlots]),
        preferBefore: suffixStart,
      });
      outputIndex = relocated[0] ?? Math.max(0, suffixStart - 1);
    }
    if (writerReturnSlots.has(outputIndex)) continue;
    const occupant = builder.outputs[outputIndex];
    if (occupant?.token?.nft?.capability === 'mutable') continue;
    if (isScidIdentityCommitment(occupant?.token?.nft?.commitment)) continue;
    while (outputIndex >= builder.outputs.length) {
      builder.addOutput({ to: Uint8Array.of(0x51), amount: 800n });
    }
    const coordinate = parseExternalCallReturnCoordinate(event.identity);
    const groupIdx = coordinate?.groupIndex ?? -1;
    const group = groupIdx >= 0 ? host.externalCallUtxoGroups[groupIdx] : undefined;
    const liveOpReturn = builder.outputs.findIndex((out) => (
      isOpReturnLockingBytecode(
        out?.to instanceof Uint8Array ? out.to
          : typeof out?.to === 'string' ? out.to : undefined,
      )
    ));
    const separator = liveOpReturn >= 0 ? liveOpReturn : suffixStart;
    let redirected = redirectViewTailOffOpReturn({
      placedIndex: outputIndex,
      plannedIndex: group?.plannedReturnOutputIndex,
      returnIndex: group?.returnOutputIndex,
      suffixStart: separator,
      reservedIndices: fixedIdentityIndices,
      outputs: builder.outputs,
    });
    if (redirected === undefined) {
      const nextIndex = (typeof separator === 'number' ? separator : outputIndex) + 1;
      while (nextIndex >= builder.outputs.length) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 800n });
      }
      redirected = nextIndex;
    }
    outputIndex = redirected;
    const rawCommitment = binToHex(event.commitment);
    const commitment = rawCommitment === '' ? '0101' : rawCommitment;
    const output: Output = {
      to: Uint8Array.of(0x51),
      amount: 800n,
      token: {
        amount: 0n,
        category: event.categoryId,
        nft: { capability: 'none', commitment },
      },
    };
    if (isOpReturnLockingBytecode(
      builder.outputs[outputIndex]?.to instanceof Uint8Array
        ? builder.outputs[outputIndex]!.to as Uint8Array
        : typeof builder.outputs[outputIndex]?.to === 'string'
          ? builder.outputs[outputIndex]!.to as string
          : undefined,
    )) {
      const nextIndex = outputIndex + 1;
      while (nextIndex >= builder.outputs.length) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 800n });
      }
      outputIndex = nextIndex;
    }
    // A late separator redirect must retain the input-bearing identity reservations too.
    if (fixedIdentityIndices.has(outputIndex)) {
      throw new Error('View return redirection collides with an input-bearing identity output.');
    }
    builder.outputs[outputIndex] = output;
    returnOutputRefs?.set(event.identity, output);
    host.builtReturnEventOutputIndices.set(event.identity, outputIndex);
    if (group && groupIdx >= 0 && coordinate?.part === 0
      && !groupOwnsInBlockReturnEvent(host.externalCallUtxoGroups, groupIdx)) {
      group.returnOutputIndex = outputIndex;
    }
  }
  vacateViewTailsFromValueChunkBand(host, builder);
  host.restoreDeclaredMutableEntrySlots(builder);
  host.reassertInBlockWriterReturns(builder);
}

/** Restore predecessor/padding outputs before derived value chunks reoccupy the selected band. */
export function vacateViewTailsFromValueChunkBand(
  host: ViewTailOccupancyHost,
  builder: TransactionBuilder,
): void {
  const band = host.getChunkableValueWriteBand();
  if (!band) return;
  let vacated = false;
  for (let index = band.start; index <= band.end; index++) {
    const output = builder.outputs[index];
    if (!isViewReturnTailOutput(output)) continue;
    const input = host.allInputs[index];
    if (input && 'unlocker' in input && input.unlocker && input.token) {
      builder.outputs[index] = {
        to: input.unlocker.generateLockingBytecode(),
        amount: input.satoshis,
        token: cloneToken(input.token),
      };
    } else {
      const lock = input && 'unlocker' in input && input.unlocker
        ? input.unlocker.generateLockingBytecode()
        : Uint8Array.of(0x51);
      builder.outputs[index] = { to: lock, amount: input?.satoshis ?? 1000n };
    }
    vacated = true;
  }
  if (vacated) host.applyDerivedValueChunks(builder);
}

/** Pre-generic SDK call sites retain this name until their host surface can be migrated together. */
export const vacateViewTailsFromJobEventsBand = vacateViewTailsFromValueChunkBand;
