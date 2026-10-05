/**
 * Build-phase finalizer: strip surplus value-chunk locks, materialize the chunk band, reassert views.
 */

import { binToHex } from '@bitauth/libauth';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { reassertNoneCapFunderTwins } from './mutable-output-reassert.js';
import { stripSurplusValueChunkLocks } from './scid-minting-return-layout.js';
import { persistedCompatibilityValueChunkLock } from './value-chunk-persist.js';
import { skipCompilerOwnedInBlockCollectionStrip } from './writer-event-delegate-layout.js';

export interface FinalizeBuildValueChunkBandAndViewsHost {
  readonly allInputs: UnlockableUtxo[];
  readonly valueChunkOutputs: ReadonlyArray<{ to: string | Uint8Array; amount: bigint; token?: unknown }>;
  readonly valueChunkRedeemLock?: Uint8Array;
  readonly preserveBlockLayoutWidth: boolean;
  readonly pinnedEntrySlots: ReadonlySet<unknown>;
  readonly requiredEntryOutputSlots: ReadonlySet<unknown>;
  viewTailRepackAttempted: boolean;
  builtReturnEventOutputIndices: Map<string, number>;
  getChunkableValueWriteBand(): { start: number; end: number; nNew: number } | undefined;
  chunkableValueWriteCategory(): string | undefined;
  hasStagedValueChunkOutputs(): boolean;
  permitsLegacyNamedValueChunkFallback(): boolean;
  stripSurplusDerivedValueChunkLocks(builder: TransactionBuilder): void;
  repackViewTailsAfterMaterialization(builder: TransactionBuilder): boolean;
  refreshInputs(): void;
  reassertStagedValueChunkOutputs(builder: TransactionBuilder): void;
  materializeValueChunkBand(builder: TransactionBuilder): void;
  placeTailReturnAfterSwappedTokenBlock(
    builder: TransactionBuilder,
    returnOutputRefs: Map<string, Output>,
  ): void;
  ensureAuthenticatedViewReturns(builder: TransactionBuilder): void;
  reassertScaledPreserveOneToOnes(builder: TransactionBuilder): void;
  reassertNestedEmitEvents(builder: TransactionBuilder): void;
  reassertDelegateImplEvents(builder: TransactionBuilder): void;
  isPersistedChunkableValueWriteReady(): boolean;
  reassertPersistedValueChunkOneToOnes(builder: TransactionBuilder, emitDest: number): void;
  scaledEmitOutputIndex(outputCount: number): number | undefined;
  reassertMintingOneToOne(builder: TransactionBuilder): void;
  reassertFixedStateOutputs(builder: TransactionBuilder): void;
  relocateCollidingDerivedValueChunkRuns(builder: TransactionBuilder): void;
  reconcileMaterializedInputWitnesses(builder: TransactionBuilder): void;
  reconcileMaterializedPredOutWitnesses(builder: TransactionBuilder): void;
  reconcileMaterializedReturnWitnesses(builder: TransactionBuilder): void;
}

/**
 * After conservation repairs: strip surplus value-chunk locks, optionally request a full rebuild
 * after first view-tail rebind, then materialize the value-chunk band and reassert view/event/state pins.
 * Returns `'rebuild'` when the caller must re-enter `build()`.
 */
export function finalizeBuildValueChunkBandAndViews(
  host: FinalizeBuildValueChunkBandAndViewsHost,
  builder: TransactionBuilder,
  returnOutputRefs: Map<string, Output>,
): 'rebuild' | 'continue' {
  const chunkBand = host.getChunkableValueWriteBand();
  const publishCategory = host.chunkableValueWriteCategory();
  const chunkLock = host.valueChunkRedeemLock
    ?? (publishCategory ? persistedCompatibilityValueChunkLock(publishCategory) : undefined);
  // Kernel identity-scan pins count matching locks anywhere. A single persist band
  // must not convert those trailing copies into OP_TRUE.
  const stagedLockHexes = new Set(
    host.valueChunkOutputs.flatMap((output) => {
      const lock = output.to instanceof Uint8Array ? output.to : undefined;
      return lock ? [binToHex(lock)] : [];
    }),
  );
  const countStagedLocks = (): number => builder.outputs.reduce((count, output) => {
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    return count + (lock && stagedLockHexes.has(binToHex(lock)) ? 1 : 0);
  }, 0);
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1' && stagedLockHexes.size > 0) {
    console.error('staged-locks-before-surplus-strip', {
      staged: host.valueChunkOutputs.length, present: countStagedLocks(),
    });
  }
  // Identity-scan INSERT stages exactly nNew redeem locks on the publish band.
  // Extra same-lock copies (append/raw-var duplicates) make matches>nNew and can
  // drive the chunk loop to index 2+ (OP_SPLIT past the value). Strip them.
  const shouldStripStagedSurplus = host.hasStagedValueChunkOutputs()
    && host.valueChunkOutputs.length > 0;
  const shouldStripLegacySurplus = host.permitsLegacyNamedValueChunkFallback()
    && !host.hasStagedValueChunkOutputs()
    && !skipCompilerOwnedInBlockCollectionStrip({
      preserveBlockLayoutWidth: host.preserveBlockLayoutWidth,
      pinnedEntryCount: host.pinnedEntrySlots.size,
      requiredEntryCount: host.requiredEntryOutputSlots.size,
    });
  if (chunkBand && chunkLock && (shouldStripStagedSurplus || shouldStripLegacySurplus)) {
    stripSurplusValueChunkLocks(builder.outputs, chunkBand, chunkLock, host.allInputs);
    host.stripSurplusDerivedValueChunkLocks(builder);
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1' && stagedLockHexes.size > 0) {
    console.error('staged-locks-after-surplus-strip', { present: countStagedLocks() });
  }
  // Rebind before placing tails so planned coordinates still name the value-chunk pins.
  if (!host.viewTailRepackAttempted && host.repackViewTailsAfterMaterialization(builder)) {
    host.viewTailRepackAttempted = true;
    host.refreshInputs();
    return 'rebuild';
  }
  // View-tail packing can still displace staged identity-scan chunks; restore before
  // materialize/preflight so the kernel count pin observes the redeem locks.
  host.reassertStagedValueChunkOutputs(builder);
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1' && stagedLockHexes.size > 0) {
    console.error('staged-locks-before-materialize', { present: countStagedLocks() });
  }
  host.materializeValueChunkBand(builder);
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1' && stagedLockHexes.size > 0) {
    console.error('staged-locks-after-materialize', { present: countStagedLocks() });
  }
  // Re-assert view tails after value-chunk materialization. Placing them earlier lets
  // the chunk band overwrite OP_TRUE none-cap returns, leaving unlock witnesses pointing at
  // zero placeholders while nested view requires observe false.
  host.placeTailReturnAfterSwappedTokenBlock(builder, returnOutputRefs);
  host.ensureAuthenticatedViewReturns(builder);
  reassertNoneCapFunderTwins(builder.outputs, host.allInputs);
  host.reassertScaledPreserveOneToOnes(builder);
  host.reassertNestedEmitEvents(builder);
  host.reassertDelegateImplEvents(builder);
  if (host.isPersistedChunkableValueWriteReady()) {
    host.reassertPersistedValueChunkOneToOnes(
      builder, host.scaledEmitOutputIndex(builder.outputs.length) ?? -1,
    );
  }
  host.reassertMintingOneToOne(builder);
  host.reassertFixedStateOutputs(builder);
  host.relocateCollidingDerivedValueChunkRuns(builder);
  for (const [identity, output] of returnOutputRefs) {
    const index = builder.outputs.indexOf(output);
    if (index >= 0) host.builtReturnEventOutputIndices.set(identity, index);
  }
  // Dynamic bands can relocate participant inputs and return outputs during
  // derivation, before send() reaches its final fixed-point pass. Rebind the
  // materialized coordinates now so the next VM probe never mixes the new
  // layout with witnesses from the preceding build.
  host.reconcileMaterializedInputWitnesses(builder);
  host.reconcileMaterializedPredOutWitnesses(builder);
  host.reconcileMaterializedReturnWitnesses(builder);
  return 'continue';
}
