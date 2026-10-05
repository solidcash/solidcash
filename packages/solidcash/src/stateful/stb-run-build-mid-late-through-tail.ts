/**
 * phase-boundary extract: STB build-phase extract — mid/late cascades through finalizeBuildTail.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  materializeMidBuildOutputsCascade,
  type MaterializeMidBuildOutputsCascadeHost,
} from './stb-materialize-mid-build-outputs-cascade.js';
import {
  materializeLateBuildChunkFrame,
  type MaterializeLateBuildChunkFrameHost,
} from './stb-materialize-late-build-chunk-frame.js';
import {
  finalizeBuildDerivedSuffix,
  type FinalizeBuildDerivedSuffixHost,
} from './stb-finalize-build-derived-suffix.js';
import { finalizeBuildTail } from './stb-finalize-build-tail.js';
import type { FinalizeBuildValueChunkBandAndViewsHost } from './stb-finalize-build-value-chunk-band-and-views.js';
import type { FinalizeBuildStampHost } from './stb-finalize-build-stamp.js';
import type { ReassertBuildConservationRepairsHost } from './stb-reassert-build-conservation-repairs.js';
import type { BuildEarlyFrontContext } from './stb-run-build-early-front.js';

export interface RunBuildMidLateThroughTailHost {
  midCascadeHost(
    addReturnOutput: BuildEarlyFrontContext['addReturnOutput'],
  ): MaterializeMidBuildOutputsCascadeHost;
  lateChunkFrameHost(): MaterializeLateBuildChunkFrameHost;
  finalizeBuildDerivedSuffixHost(): FinalizeBuildDerivedSuffixHost;
  reassertBuildConservationRepairsHost(): ReassertBuildConservationRepairsHost;
  finalizeBuildValueChunkBandAndViewsHost(): FinalizeBuildValueChunkBandAndViewsHost;
  finalizeBuildStampHost(): FinalizeBuildStampHost;
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
}

/**
 * After early-front context: mid outputs, late chunk frame, derived suffix, then finalizeBuildTail.
 * Returns 'rebuild' when the tail requests a recursive build, else the finished builder.
 */
export function runBuildMidLateThroughTail(
  host: RunBuildMidLateThroughTailHost,
  early: BuildEarlyFrontContext,
): TransactionBuilder | 'rebuild' {
  const {
    builder,
    returnOutputRefs,
    addReturnOutput,
    debugAtomicOutputStage,
    debugOwnMutableOutputs,
    deferredDelegateReturnEvents,
    relocatedDelegateOutputBases,
    associatedDelegateOutputs,
    appendDelegateGroupOutputs,
    getDelegateTransferSlotsConsumed,
    loopChunkBeforeCallees,
    embeddedEntrySlots,
  } = early;

  materializeMidBuildOutputsCascade(
    host.midCascadeHost(addReturnOutput),
    builder,
    embeddedEntrySlots,
    getDelegateTransferSlotsConsumed(),
    associatedDelegateOutputs,
    deferredDelegateReturnEvents,
    loopChunkBeforeCallees,
    debugAtomicOutputStage,
  );

  materializeLateBuildChunkFrame(
    host.lateChunkFrameHost(),
    builder,
    associatedDelegateOutputs,
    appendDelegateGroupOutputs,
    debugOwnMutableOutputs,
    debugAtomicOutputStage,
  );

  finalizeBuildDerivedSuffix(
    host.finalizeBuildDerivedSuffixHost(), builder, debugAtomicOutputStage,
  );

  // Output materialization is authoritative: shared/compiler-routed groups can expand into balanced blocks
  // whose physical width is not known from their logical call record. Resolve each delegate's preservation
  // coordinate now; the input unlocker closures above read these references when the final transaction encodes.
  if (finalizeBuildTail(
    builder,
    relocatedDelegateOutputBases,
    host.lowLevelCallUtxoGroups,
    host.reassertBuildConservationRepairsHost(),
    host.finalizeBuildValueChunkBandAndViewsHost(),
    host.finalizeBuildStampHost(),
    returnOutputRefs,
    debugAtomicOutputStage,
  ) === 'rebuild') {
    return 'rebuild';
  }
  return builder;
}
