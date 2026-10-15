/**
 * phase-boundary extract: STB class-body extract — repack view tails after first materialization when
 * planned witnesses still name mutable collection slots.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  assignPhysicalReturnIndices,
  findViewTailDestinations,
  lastCollidingMutableWriterIndex,
} from './physical-return-layout.js';
import type { DerivedChunkOutputObservation } from './value-chunk-persist.js';
import {
  clampViewTailPlacement,
  groupOwnsInBlockReturnEvent,
  isCompilerDescribedMintingBandWriter,
  viewTailOccupancyCap,
  type ViewTailPackOptions,
} from './value-chunk-geometry.js';

export interface RepackViewTailsHost {
  readonly allInputs: readonly UnlockableUtxo[];
  readonly externalCallUtxoGroups: ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
  readonly delegateDynamicChunksAtSuffix: boolean;
  readonly derivedChunkOutputs: ReadonlyMap<number, DerivedChunkOutputObservation>;
  findMintingInputIndex(categoryId: string): number;
  getChunkableValueWriteBand(): { start: number; end: number; nNew: number } | undefined;
  dynamicChunkOutputCount(): number;
  viewTailPackOptions(suffixStart?: number): ViewTailPackOptions;
  syncBuilderUnlockers(builder: TransactionBuilder): void;
}

/**
 * JobEvents occupancy is only final after the first materialization. If planned
 * view-tail witnesses still name a mutable collection slot, pack them after that
 * band and refresh unlockers for one rematerialize. Does not move the value-chunk suffix.
 */
export function repackViewTailsAfterMaterialization(
  host: RepackViewTailsHost,
  builder: TransactionBuilder,
): boolean {
  const fixedIdentityIndices = host.viewTailPackOptions().reservedIndices ?? new Set<number>();
  const planned = host.externalCallUtxoGroups
    .map((group, index) => (
      group.returnOutputIndex !== undefined
        && !groupOwnsInBlockReturnEvent(host.externalCallUtxoGroups, index)
        ? group.returnOutputIndex : -1
    ))
    .filter((index) => index >= 0);
  const tokenWriterPresent = host.externalCallUtxoGroups.some((group) => {
    if (!isCompilerDescribedMintingBandWriter(group, false, host.messageBusConvention)) return false;
    return host.findMintingInputIndex(group.categoryId) >= 0;
  });
  // FakeToken already parks view tails after its swapped block. Do not steal
  // early pads or rewrite those witnesses.
  if (tokenWriterPresent) return false;
  const derivedHit = planned.some((index) => host.derivedChunkOutputs.has(index));
  const derivedEnd = derivedHit
    ? [...host.derivedChunkOutputs.keys()].reduce((max, index) => Math.max(max, index), -1)
    : -1;
  const writerEnd = Math.max(
    lastCollidingMutableWriterIndex(builder.outputs, planned),
    viewTailOccupancyCap(planned, host.getChunkableValueWriteBand()),
    derivedEnd,
    ...planned.filter((index) => fixedIdentityIndices.has(index)),
  );
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
    console.error('view-tail-repack', {
      planned,
      writerEnd,
      occupants: planned.map((index) => ({
        index,
        lock: builder.outputs[index]?.to instanceof Uint8Array
          ? binToHex(builder.outputs[index].to as Uint8Array).slice(0, 16)
          : String(builder.outputs[index]?.to ?? '').slice(0, 16),
        cap: builder.outputs[index]?.token?.nft?.capability,
        commit: String(builder.outputs[index]?.token?.nft?.commitment ?? '').slice(0, 24),
      })),
    });
  }
  if (writerEnd < 0) return false;
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
  const viewGroups = host.externalCallUtxoGroups
    .map((group, index) => ({ group, index }))
    .filter(({ group, index }) => group.returnOutputIndex !== undefined
      && !groupOwnsInBlockReturnEvent(host.externalCallUtxoGroups, index));
  const padDestinations = findViewTailDestinations(
    builder.outputs, viewGroups.length, { suffixStart, reserved, preferBefore: writerEnd },
  );
  const reassigned = new Map<number, number>();
  if (padDestinations.length === viewGroups.length
    && fixedIdentityIndices.size === 0) {
    const packOptions = host.viewTailPackOptions(suffixStart);
    for (const [offset, { index, group }] of viewGroups.entries()) {
      reassigned.set(index, clampViewTailPlacement({
        planned: group.returnOutputIndex ?? padDestinations[offset],
        packed: padDestinations[offset],
        band: packOptions.band,
        suffixStart: packOptions.suffixStart,
        tokenWriterPresent: packOptions.tokenWriterPresent,
      }));
    }
  } else {
    const packed = assignPhysicalReturnIndices(
      host.externalCallUtxoGroups,
      (categoryId) => host.findMintingInputIndex(categoryId),
      writerEnd,
      host.viewTailPackOptions(suffixStart),
    );
    for (const [groupIdx, returnIndex] of packed) reassigned.set(groupIdx, returnIndex);
  }
  let changed = false;
  for (const [groupIdx, returnIndex] of reassigned) {
    const group = host.externalCallUtxoGroups[groupIdx];
    if (!group || group.returnOutputIndex === returnIndex) continue;
    group.returnOutputIndex = returnIndex;
    changed = true;
  }
  if (!changed) return false;
  for (const carrier of [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]) {
    if (!carrier.returnWitnessGroups || !carrier.refreshInternalArgs) continue;
    const updates: Record<string, bigint> = {};
    for (const [name, groupIdx] of Object.entries(carrier.returnWitnessGroups)) {
      const returnIndex = reassigned.get(groupIdx);
      if (returnIndex === undefined) continue;
      if (carrier.internalArgs?.[name] === BigInt(returnIndex)) continue;
      updates[name] = BigInt(returnIndex);
    }
    if (Object.keys(updates).length === 0) continue;
    carrier.refreshInternalArgs(updates);
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
    console.error('view-tail-repack-applied', {
      assigned: [...reassigned],
      groups: host.externalCallUtxoGroups.map((group, index) => ({
        index,
        fn: group.logicalFunctionName ?? group.functionName,
        returnOutputIndex: group.returnOutputIndex,
      })),
    });
  }
  host.syncBuilderUnlockers(builder);
  return true;
}
