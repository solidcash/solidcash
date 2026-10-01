/**
 * phase-boundary extract: STB send-phase extract — fixed-point final layout reassert before fee validation.
 */

import { binToHex } from '@bitauth/libauth';
import type { TransactionBuilder } from '../TransactionBuilder.js';

export interface ReassertSendFinalLayoutHost {
  reconcileMaterializedValueChunkWitnesses(builder: TransactionBuilder): void;
  reconcileMaterializedInputWitnesses(builder: TransactionBuilder): void;
  reconcileMaterializedPredOutWitnesses(builder: TransactionBuilder): void;
  reassertMaterializedBatchPredecessorOutputs(builder: TransactionBuilder): void;
  reassertFinalConservation(): void;
  reconcileMaterializedReturnWitnesses(builder: TransactionBuilder): void;
  constrainParticipantImmutableOutputs(builder: TransactionBuilder): void;
  applyDerivedValueChunks(builder: TransactionBuilder): void;
  reassertStagedValueChunkOutputs(builder: TransactionBuilder): void;
  stripEmptyDuplicateEntryLocks(builder: TransactionBuilder): void;
  reassertTokenInsertNewLocks(builder: TransactionBuilder): void;
  stripSurplusLinearBatchEntryClones(builder: TransactionBuilder): void;
  ensureDistinctJobEventNfts(builder: TransactionBuilder): void;
  applyDerivedEntryOutputs(builder: TransactionBuilder): void;
  finalizeReverseSuffixValueChunkLayout(builder: TransactionBuilder): void;
  enforceDeclaredCollectionOutputCardinality(builder: TransactionBuilder): void;
  learnFinalizedDelegateEvents(builder: TransactionBuilder): boolean;
  relocateCollidingDerivedValueChunkRuns(builder: TransactionBuilder): void;
  bindMaterializedValueChunkWitnesses(builder: TransactionBuilder): void;
  rebalanceFunderSurplus(): void;
  syncBuilderUnlockers(builder: TransactionBuilder): void;
}

/**
 * Run the send() fixed-point layout reassert cascade used by `_assertConvergedFinalTransaction`.
 */
export function reassertSendFinalLayout(
  host: ReassertSendFinalLayoutHost,
  finalBuilder: TransactionBuilder,
): void {
  const debugBal12 = (stage: string): void => {
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_TOKEN_INSERT !== '1') return;
    const out = finalBuilder.outputs[12];
    const lock = out?.to instanceof Uint8Array ? binToHex(out.to).slice(0, 28) : '';
    if (!lock.startsWith('aa20998e')) return;
    console.error('bal12-stage', {
      stage,
      lock,
      cat: String(out?.token?.category ?? '').slice(0, 16),
      commit: String(out?.token?.nft?.commitment ?? '').slice(0, 24),
    });
  };
  debugBal12('layout-start');
  host.reconcileMaterializedValueChunkWitnesses(finalBuilder);
  host.reconcileMaterializedInputWitnesses(finalBuilder);
  host.reassertMaterializedBatchPredecessorOutputs(finalBuilder);
  debugBal12('after-materialized-pred');
  // Materialize the declared P' before content-rebinding PredOut. A provisional P' can still sit at the
  // fixed NEW slot; binding first would preserve that stale coordinate and the subsequent move would invalidate it.
  host.reconcileMaterializedPredOutWitnesses(finalBuilder);
  debugBal12('after-predOut-witnesses');
  host.reassertFinalConservation();
  debugBal12('after-conservation');
  host.reconcileMaterializedReturnWitnesses(finalBuilder);
  host.constrainParticipantImmutableOutputs(finalBuilder);
  // Planned-insert reasserts can re-seed empty-root NEW placeholders over learned
  // EntryNft commitments. Fixed-index derived pins and staged identity-scan chunks
  // must win the last write before covenant preflight.
  host.applyDerivedValueChunks(finalBuilder);
  host.reassertStagedValueChunkOutputs(finalBuilder);
  host.stripEmptyDuplicateEntryLocks(finalBuilder);
  debugBal12('before-token-insert');
  // transferFrom INSERT can lose TrailingCount after the minting-band swap; restore
  // P' at master+2 and NEW at master+4 after every other same-index rewrite.
  host.reassertTokenInsertNewLocks(finalBuilder);
  debugBal12('after-token-insert');
  host.stripSurplusLinearBatchEntryClones(finalBuilder);
  host.ensureDistinctJobEventNfts(finalBuilder);
  // Last write: byIndex absolute pins (P' at co-spend, NEW at trailing) win.
  host.applyDerivedEntryOutputs(finalBuilder);
  debugBal12('after-applyDerived');
  // After entry/event materializers: late chunks or distinct NFTs can follow the suffix or
  // grow TXOUTPUTCOUNT. Pin reverse-indexed chunks as the last layout write in this pass.
  host.finalizeReverseSuffixValueChunkLayout(finalBuilder);
  host.enforceDeclaredCollectionOutputCardinality(finalBuilder);
  // Delegate event values can only be observed after collection cardinality and all absolute coordinates have
  // settled. Discovery is compiler-metadata-gated and replaces the existing fixed-value event placeholder in
  // place, so it must not replay earlier broad ownership passes over these now-authenticated coordinates.
  host.learnFinalizedDelegateEvents(finalBuilder);
  host.relocateCollidingDerivedValueChunkRuns(finalBuilder);
  // Bind only after every final materializer has settled physical coordinates. Kernel ownership is selected
  // by compiler resource identity; the provisional base is not allowed to override an authenticated run.
  host.bindMaterializedValueChunkWitnesses(finalBuilder);
  // Derived chunks and learned delegate events can replace funder pass-through or change cells
  // after the earlier conservation pass. Return that newly exposed value to a funder before
  // serializing, rather than accepting it as an accidental transaction fee.
  host.rebalanceFunderSurplus();
  debugBal12('after-reverseSuffix');
  host.syncBuilderUnlockers(finalBuilder);
}
