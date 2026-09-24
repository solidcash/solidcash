/**
 * phase-boundary extract: STB build-phase extract — post-materialization conservation/event reasserts.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo } from '../interfaces.js';
import { reassertNoneCapFunderTwins } from './mutable-output-reassert.js';
import { reassertScidIdentityOutputs } from './scid-minting-return-layout.js';

export interface ReassertBuildConservationRepairsHost {
  readonly allInputs: UnlockableUtxo[];
  tagEmptyP2sh32ImmutablesAsScid(builder: TransactionBuilder): void;
  ensureOpTrueReturnWitnessesAreImmutable(builder: TransactionBuilder): void;
  reassertDelegateLoopEntries(builder: TransactionBuilder): void;
  reassertNestedMintingMasters(builder: TransactionBuilder): void;
  stripSurplusEmptyCollectionEntries(builder: TransactionBuilder): void;
  reassertNestedSameIndexMutables(builder: TransactionBuilder): void;
  applyDerivedEntryOutputs(builder: TransactionBuilder): void;
  reassertFixedStateOutputs(builder: TransactionBuilder): void;
  reassertNestedEmitEvents(builder: TransactionBuilder): void;
  reassertDelegateImplEvents(builder: TransactionBuilder): void;
  reassertMintingOneToOne(builder: TransactionBuilder): void;
  reassertTokenInsertNewLocks(builder: TransactionBuilder): void;
  scidReservedIndices(outputCount: number): Set<number>;
  isPersistedChunkableValueWriteReady(): boolean;
  packJobsSuffix(builder: TransactionBuilder): void;
}

/**
 * After primary output materialization, reassert SCID/none-cap/minting/events/fixed-state and
 * optionally pack the persisted jobs suffix.
 */
export function reassertBuildConservationRepairs(
  host: ReassertBuildConservationRepairsHost,
  builder: TransactionBuilder,
): void {
  host.tagEmptyP2sh32ImmutablesAsScid(builder);
  host.ensureOpTrueReturnWitnessesAreImmutable(builder);
  host.reassertDelegateLoopEntries(builder);
  reassertNoneCapFunderTwins(builder.outputs, host.allInputs);
  host.reassertNestedMintingMasters(builder);
  host.stripSurplusEmptyCollectionEntries(builder);
  host.reassertNestedSameIndexMutables(builder);
  // Reassert may place NEW onto the predecessor index when outputBlockSlot collapsed.
  // Absolute entry pins (P' at co-spend, NEW at trailing) must win after that pass.
  host.applyDerivedEntryOutputs(builder);
  host.reassertFixedStateOutputs(builder);
  host.reassertNestedEmitEvents(builder);
  host.reassertDelegateImplEvents(builder);
  host.reassertMintingOneToOne(builder);
  host.reassertTokenInsertNewLocks(builder);
  reassertScidIdentityOutputs(
    builder.outputs, host.allInputs, host.scidReservedIndices(builder.outputs.length),
  );
  host.reassertNestedEmitEvents(builder);
  host.reassertDelegateImplEvents(builder);
  if (host.isPersistedChunkableValueWriteReady()) host.packJobsSuffix(builder);
}
