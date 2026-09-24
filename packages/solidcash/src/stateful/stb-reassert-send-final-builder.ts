/**
 * phase-boundary extract: STB send-phase extract — post-final-build reassert cascade before fee change.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo } from '../interfaces.js';
import { reassertScidIdentityOutputs } from './scid-minting-return-layout.js';

export interface ReassertSendFinalBuilderHost {
  readonly allInputs: UnlockableUtxo[];
  syncBuilderUnlockers(builder: TransactionBuilder): void;
  clearUnclaimedConditionalEventSlots(builder: TransactionBuilder): void;
  scidReservedIndices(outputCount: number): Set<number>;
  reassertNestedEmitEvents(builder: TransactionBuilder): void;
  reassertDelegateImplEvents(builder: TransactionBuilder): void;
  materializeJobEventsBand(builder: TransactionBuilder): void;
  placeTailReturnAfterSwappedTokenBlock(builder: TransactionBuilder): void;
  ensureAuthenticatedViewReturns(builder: TransactionBuilder): void;
  reassertScaledPreserveOneToOnes(builder: TransactionBuilder): void;
  isPersistedChunkableValueWriteReady(): boolean;
  reassertPersistedJobEventsOneToOnes(builder: TransactionBuilder, emitDest: number): void;
  scaledEmitOutputIndex(outputCount: number): number | undefined;
  reassertMintingOneToOne(builder: TransactionBuilder): void;
  reassertFixedStateOutputs(builder: TransactionBuilder): void;
  restoreSwappedTokenFunderSlots(builder: TransactionBuilder): void;
}

/**
 * After the fee-funder rebuild, reassert identity/events/jobEvents/minting/fixed-state
 * and restore swapped token funder slots before change placement.
 */
export function reassertSendFinalBuilder(
  host: ReassertSendFinalBuilderHost,
  finalBuilder: TransactionBuilder,
): void {
  host.syncBuilderUnlockers(finalBuilder);
  host.clearUnclaimedConditionalEventSlots(finalBuilder);
  reassertScidIdentityOutputs(
    finalBuilder.outputs, host.allInputs, host.scidReservedIndices(finalBuilder.outputs.length),
  );
  host.reassertNestedEmitEvents(finalBuilder);
  host.reassertDelegateImplEvents(finalBuilder);
  // Materialize first; view tails must win over jobs/chunk band writes.
  host.materializeJobEventsBand(finalBuilder);
  host.placeTailReturnAfterSwappedTokenBlock(finalBuilder);
  host.ensureAuthenticatedViewReturns(finalBuilder);
  host.reassertScaledPreserveOneToOnes(finalBuilder);
  host.reassertNestedEmitEvents(finalBuilder);
  host.reassertDelegateImplEvents(finalBuilder);
  if (host.isPersistedChunkableValueWriteReady()) {
    host.reassertPersistedJobEventsOneToOnes(
      finalBuilder, host.scaledEmitOutputIndex(finalBuilder.outputs.length) ?? -1,
    );
  }
  host.reassertDelegateImplEvents(finalBuilder);
  host.reassertMintingOneToOne(finalBuilder);
  host.reassertFixedStateOutputs(finalBuilder);
  if (host.isPersistedChunkableValueWriteReady()) {
    host.reassertPersistedJobEventsOneToOnes(
      finalBuilder, host.scaledEmitOutputIndex(finalBuilder.outputs.length) ?? -1,
    );
  }
  host.reassertDelegateImplEvents(finalBuilder);
  host.restoreSwappedTokenFunderSlots(finalBuilder);
}
