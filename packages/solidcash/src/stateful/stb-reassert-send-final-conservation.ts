/**
 * phase-boundary extract: STB send-phase extract — final conservation reassert before layout finalize.
 */

import type { UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { reassertReadOnlyMutableOneToOnes } from './mutable-output-reassert.js';
import { reassertScidIdentityOutputs } from './scid-minting-return-layout.js';

export interface ReassertSendFinalConservationHost {
  readonly iterationEntryInputs: readonly UnlockableUtxo[];
  applyLearnedWriterEvents(builder: TransactionBuilder): void;
  reassertAuthenticatedEventOutputs(builder: TransactionBuilder): void;
  clearUnclaimedConditionalEventSlots(builder: TransactionBuilder): void;
  stripSurplusDerivedValueChunkLocks(builder: TransactionBuilder): void;
  reassertMintingOneToOne(builder: TransactionBuilder): void;
  scidReservedIndices(outputCount: number): ReadonlySet<number>;
  reassertInBlockWriterReturns(builder: TransactionBuilder): void;
  rebalanceFunderSurplus(): void;
}

/**
 * Re-materialize learned events, restore input-bearing owners, then rebalance funder surplus.
 */
export function reassertSendFinalConservation(
  host: ReassertSendFinalConservationHost,
  finalBuilder: TransactionBuilder,
): void {
  // A trace-learned event replaces an output-only funding cell and owns
  // both its token shape and its bounded satoshi value. Re-materialize the
  // complete event output here so it cannot inherit the displaced funder's
  // value. Input-bearing owners at overlapping coordinates are restored by
  // the conservation passes below.
  host.applyLearnedWriterEvents(finalBuilder);
  host.reassertAuthenticatedEventOutputs(finalBuilder);
  host.clearUnclaimedConditionalEventSlots(finalBuilder);
  host.stripSurplusDerivedValueChunkLocks(finalBuilder);
  // Read-only iteration chunks authenticate output[INPUTINDEX] exactly. Output-only event/dynamic-band
  // materializers may relocate those twins, but they cannot consume or rewrite them.
  reassertReadOnlyMutableOneToOnes(
    finalBuilder.outputs, finalBuilder.inputs, host.iterationEntryInputs,
  );
  // Delegate-event deduplication can demote a provisional clone at the
  // same physical coordinate as a later participant's master. A consumed
  // minting NFT is an input-bearing owner of that coordinate, so it wins
  // over any output-only placeholder regardless of call topology.
  host.reassertMintingOneToOne(finalBuilder);
  reassertScidIdentityOutputs(
    finalBuilder.outputs,
    finalBuilder.inputs,
    host.scidReservedIndices(finalBuilder.outputs.length),
  );
  // In-block return slots are output-only covenant resources, so they must
  // be restored after every input-bearing owner has claimed its coordinate.
  // Doing this before balancing also lets any displaced output participate
  // in the final satoshi-conservation pass.
  host.reassertInBlockWriterReturns(finalBuilder);
  host.rebalanceFunderSurplus();
}
