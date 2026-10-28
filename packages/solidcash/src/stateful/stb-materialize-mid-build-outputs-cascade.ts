/**
 * phase-boundary extract: STB build-phase extract — mid-build cascade from owner entries through runtime-loop trailing.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { Output } from '../interfaces.js';
import {
  materializeOwnerEntriesContainersTransfers,
  type MaterializeOwnerEntriesContainersTransfersHost,
} from './stb-materialize-owner-entries-containers-transfers.js';
import {
  materializeOwnerEventNftOutputs,
  type MaterializeOwnerEventNftOutputsHost,
} from './stb-materialize-owner-event-nft-outputs.js';
import {
  materializeReturnEventOutputs,
  type MaterializeReturnEventOutputsHost,
} from './stb-materialize-return-event-outputs.js';
import {
  materializeLowLevelCallOutputs,
  type MaterializeLowLevelCallOutputsHost,
} from './stb-materialize-low-level-call-outputs.js';
import {
  materializeTrailingIterationEntries,
  type MaterializeTrailingIterationEntriesHost,
} from './stb-materialize-trailing-iteration-entries.js';
import {
  materializeRuntimeLoopTrailing,
  type MaterializeRuntimeLoopTrailingHost,
} from './stb-materialize-runtime-loop-trailing.js';
import type { ReturnEventRecord } from './stb-materialize-return-event-outputs.js';

export interface MaterializeMidBuildOutputsCascadeHost {
  readonly ownerEntriesHost: MaterializeOwnerEntriesContainersTransfersHost;
  readonly ownerEventHost: MaterializeOwnerEventNftOutputsHost;
  readonly returnEventHost: MaterializeReturnEventOutputsHost;
  readonly llcOutputsHost: MaterializeLowLevelCallOutputsHost;
  readonly trailingIterationHost: MaterializeTrailingIterationEntriesHost;
  readonly runtimeLoopHost: MaterializeRuntimeLoopTrailingHost;
  /** Keccak-loop side-car recreations emitted at the start of the trailing band (unless a mapping loop leads). */
  readonly keccakLoopRecreates: readonly Output[];
  readonly keccakLoopFollowsTrailingUser: boolean;
}

/**
 * After external-call outputs: owner entries/containers/transfers, owner events, return events,
 * LLC outputs, trailing iteration entries, and runtime-loop trailing segments.
 */
export function materializeMidBuildOutputsCascade(
  host: MaterializeMidBuildOutputsCascadeHost,
  builder: TransactionBuilder,
  embeddedEntrySlots: ReadonlySet<number>,
  delegateTransferSlotsConsumed: number,
  associatedDelegateOutputs: ReadonlySet<number>,
  deferredDelegateReturnEvents: ReturnEventRecord[],
  loopChunkBeforeCallees: boolean,
  debugAtomicOutputStage: (stage: string) => void,
): void {
  materializeOwnerEntriesContainersTransfers(
    host.ownerEntriesHost,
    builder,
    embeddedEntrySlots,
    delegateTransferSlotsConsumed,
    debugAtomicOutputStage,
  );

  materializeOwnerEventNftOutputs(host.ownerEventHost, builder);

  materializeReturnEventOutputs(
    host.returnEventHost, builder, deferredDelegateReturnEvents,
  );

  materializeLowLevelCallOutputs(
    host.llcOutputsHost, builder, associatedDelegateOutputs,
  );

  // Dynamic keccak loop side-cars open the trailing band. When the loop is not preceded by a mapping loop they
  // sit at blockSize, right after every fixed block slot (entries/containers/transfers/events/returnEvent/LLC).
  if (!host.keccakLoopFollowsTrailingUser) {
    for (const rec of host.keccakLoopRecreates) builder.addOutput(rec);
  }

  materializeTrailingIterationEntries(
    host.trailingIterationHost, builder, loopChunkBeforeCallees,
  );

  materializeRuntimeLoopTrailing(host.runtimeLoopHost, builder);
}
