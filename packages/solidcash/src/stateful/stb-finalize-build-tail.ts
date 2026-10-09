/**
 * phase-boundary extract: STB build-phase extract — late tail after derived-suffix materialization.
 *
 * Resolves relocated-delegate output bases, runs conservation repairs, value-chunk band/views,
 * and the final stamp/ensure pass.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  finalizeBuildValueChunkBandAndViews,
  type FinalizeBuildValueChunkBandAndViewsHost,
} from './stb-finalize-build-value-chunk-band-and-views.js';
import {
  finalizeBuildStamp,
  type FinalizeBuildStampHost,
} from './stb-finalize-build-stamp.js';
import {
  reassertBuildConservationRepairs,
  type ReassertBuildConservationRepairsHost,
} from './stb-reassert-build-conservation-repairs.js';

export type RelocatedDelegateOutputBaseRef = { value: number };

/**
 * Resolve relocated-delegate preservation coordinates against the materialized output list.
 */
export function resolveRelocatedDelegateOutputBases(
  relocatedDelegateOutputBases: ReadonlyMap<number, RelocatedDelegateOutputBaseRef>,
  lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[],
  builder: TransactionBuilder,
): void {
  for (const [groupIndex, outputBaseRef] of relocatedDelegateOutputBases) {
    const group = lowLevelCallUtxoGroups[groupIndex];
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
}

/**
 * Run conservation → value-chunk band/views → stamp. Returns `'rebuild'` when materialization requests it.
 */
export function finalizeBuildTail(
  builder: TransactionBuilder,
  relocatedDelegateOutputBases: ReadonlyMap<number, RelocatedDelegateOutputBaseRef>,
  lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[],
  conservationHost: ReassertBuildConservationRepairsHost,
  valueChunkBandHost: FinalizeBuildValueChunkBandAndViewsHost,
  stampHost: FinalizeBuildStampHost,
  returnOutputRefs: Map<string, Output>,
  debugAtomicOutputStage: (stage: string) => void,
): 'rebuild' | 'done' {
  resolveRelocatedDelegateOutputBases(
    relocatedDelegateOutputBases, lowLevelCallUtxoGroups, builder,
  );
  reassertBuildConservationRepairs(conservationHost, builder);
  debugAtomicOutputStage('conservation-repairs');
  if (finalizeBuildValueChunkBandAndViews(valueChunkBandHost, builder, returnOutputRefs) === 'rebuild') {
    return 'rebuild';
  }
  finalizeBuildStamp(stampHost, builder, debugAtomicOutputStage);
  return 'done';
}
