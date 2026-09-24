/**
 * phase-boundary extract: STB send-phase extract — post-view-repack materialize/reassert before surplus rebalance.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo } from '../interfaces.js';
import { stripRelocatedMutableDuplicates } from './mutable-output-reassert.js';

export interface ReassertSendAfterViewRepackHost {
  readonly allInputs: UnlockableUtxo[];
  refreshInputs(): void;
  syncBuilderUnlockers(builder: TransactionBuilder): void;
  applyDerivedValueChunks(builder: TransactionBuilder): void;
  materializeJobEventsBand(builder: TransactionBuilder): void;
  ensureLiveJobEventsBand(builder: TransactionBuilder): void;
  placeTailReturnAfterSwappedTokenBlock(builder: TransactionBuilder): void;
  ensureAuthenticatedViewReturns(builder: TransactionBuilder): void;
  isPersistedChunkableValueWriteReady(): boolean;
  reassertPersistedJobEventsOneToOnes(builder: TransactionBuilder, emitDest: number): void;
  scaledEmitOutputIndex(outputCount: number): number | undefined;
  reassertDelegateImplEvents(builder: TransactionBuilder): void;
  reassertNestedEmitEvents(builder: TransactionBuilder): void;
  reassertScaledPreserveOneToOnes(builder: TransactionBuilder): void;
  reassertFixedStateOutputs(builder: TransactionBuilder): void;
  restoreDeclaredMutableEntrySlots(builder: TransactionBuilder): void;
  clearSupersededDelegateDynamicCollectionOutputs(builder: TransactionBuilder): void;
  compilerOwnedTrailingEntryOutputIndices(): Set<number>;
  ensureDistinctJobEventNfts(builder: TransactionBuilder): void;
}

/**
 * After optional view-tail rebind, rematerialize jobEvents/view tails, reassert events/state,
 * strip relocated mutable duplicates, and ensure distinct JobEvent NFTs.
 */
export function reassertSendAfterViewRepack(
  host: ReassertSendAfterViewRepackHost,
  finalBuilder: TransactionBuilder,
  reboundViews: boolean,
): void {
  if (reboundViews) {
    host.refreshInputs();
    host.syncBuilderUnlockers(finalBuilder);
  }
  if (reboundViews) host.applyDerivedValueChunks(finalBuilder);
  host.materializeJobEventsBand(finalBuilder);
  host.ensureLiveJobEventsBand(finalBuilder);
  // Re-assert view tails after materialize so jobs/chunk bands cannot clobber
  // authenticated none-cap returns (same ordering as build()).
  host.placeTailReturnAfterSwappedTokenBlock(finalBuilder);
  host.ensureAuthenticatedViewReturns(finalBuilder);
  if (host.isPersistedChunkableValueWriteReady()) {
    host.reassertPersistedJobEventsOneToOnes(
      finalBuilder, host.scaledEmitOutputIndex(finalBuilder.outputs.length) ?? -1,
    );
  }
  host.reassertDelegateImplEvents(finalBuilder);
  host.reassertNestedEmitEvents(finalBuilder);
  host.reassertDelegateImplEvents(finalBuilder);
  host.reassertScaledPreserveOneToOnes(finalBuilder);
  host.reassertNestedEmitEvents(finalBuilder);
  host.reassertDelegateImplEvents(finalBuilder);
  host.reassertFixedStateOutputs(finalBuilder);
  if (host.isPersistedChunkableValueWriteReady()) {
    host.reassertPersistedJobEventsOneToOnes(
      finalBuilder, host.scaledEmitOutputIndex(finalBuilder.outputs.length) ?? -1,
    );
  }
  host.reassertDelegateImplEvents(finalBuilder);
  host.restoreDeclaredMutableEntrySlots(finalBuilder);
  // A complete dynamic write supersedes any old collection chunk that also
  // occupied a declared entry coordinate. Apply this after entry restoration.
  host.clearSupersededDelegateDynamicCollectionOutputs(finalBuilder);

  // Nested event/data repair can replay a mutable that was displaced while a
  // writer's return slot was still unresolved. Normalize once after every
  // authoritative materializer, immediately before covenant convergence.
  stripRelocatedMutableDuplicates(
    finalBuilder.outputs,
    host.allInputs,
    0,
    host.compilerOwnedTrailingEntryOutputIndices(),
  );
  // Multi-emit JobEvents (Created + WhitelistedWorkerAdded) share one physical
  // MD event slot; append the missing distinct NFTs for queryFilter/receipts.
  host.ensureDistinctJobEventNfts(finalBuilder);
}
