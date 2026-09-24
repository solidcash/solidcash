/**
 * phase-boundary extract: STB send-phase extract — post-final-layout materialization cascade before fee finalization.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';

export interface ReassertSendPostLayoutMaterializationHost {
  placeTailReturnAfterSwappedTokenBlock(builder: TransactionBuilder): void;
  ensureAuthenticatedViewReturns(builder: TransactionBuilder): void;
  reconcileMaterializedReturnWitnesses(builder: TransactionBuilder): void;
  ensureDistinctJobEventNfts(builder: TransactionBuilder): void;
  finalizeReverseSuffixJobsLayout(builder: TransactionBuilder): void;
  enforceDeclaredCollectionOutputCardinality(builder: TransactionBuilder): void;
  syncBuilderUnlockers(builder: TransactionBuilder): void;
}

/**
 * After final-layout reassert, re-place view/return tails, pin jobs as the last layout write,
 * enforce declared collection cardinality, and sync unlockers before covenant preflight.
 */
export function reassertSendPostLayoutMaterialization(
  host: ReassertSendPostLayoutMaterializationHost,
  finalBuilder: TransactionBuilder,
): void {
  host.placeTailReturnAfterSwappedTokenBlock(finalBuilder);
  host.ensureAuthenticatedViewReturns(finalBuilder);
  host.reconcileMaterializedReturnWitnesses(finalBuilder);
  host.ensureAuthenticatedViewReturns(finalBuilder);
  host.ensureDistinctJobEventNfts(finalBuilder);
  // Tail-return / distinct-event materializers may append after the OP_RETURN
  // trailer and shift TXOUTPUTCOUNT-1-nNew. Re-pin jobs as the last layout write
  // before unlocker sync and covenant preflight (post two jobs growth path).
  host.finalizeReverseSuffixJobsLayout(finalBuilder);
  host.enforceDeclaredCollectionOutputCardinality(finalBuilder);
  host.syncBuilderUnlockers(finalBuilder);
}
