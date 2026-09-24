/**
 * phase-boundary extract: STB build-phase extract — value/dynamic chunk ordering, trailing frame, nested-callee repair.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';
import {
  appendDynamicChunks as appendDynamicChunksImpl,
  appendValueChunks as appendValueChunksImpl,
  type MaterializeValueAndDynamicChunksHost,
} from './stb-materialize-value-and-dynamic-chunks.js';
import {
  materializeTrailingFrameAndPending,
  type MaterializeTrailingFrameAndPendingHost,
} from './stb-materialize-trailing-frame-and-pending.js';
import {
  repairNestedCalleeOutputs,
  type RepairNestedCalleeOutputsHost,
} from './stb-repair-nested-callee-outputs.js';

export interface MaterializeLateBuildChunkFrameHost {
  readonly delegateEntriesAfterLowLevel: boolean;
  readonly delegateDynamicChunksAtSuffix: boolean;
  readonly valueDynamicHost: MaterializeValueAndDynamicChunksHost;
  readonly trailingFrameHost: MaterializeTrailingFrameAndPendingHost;
  readonly nestedCalleeHost: RepairNestedCalleeOutputsHost;
}

/**
 * Ordered late-build chunk frame: early value chunks (when delegate-first), early dynamic chunks
 * (when neither delegate-first nor suffix), trailing frame + nested-callee repair, then deferred
 * dynamic chunks when delegate-first or suffix placement applies.
 */
export function materializeLateBuildChunkFrame(
  host: MaterializeLateBuildChunkFrameHost,
  builder: TransactionBuilder,
  associatedDelegateOutputs: ReadonlySet<number>,
  appendDelegateGroupOutputs: (groupIndex: number) => void,
  debugOwnMutableOutputs: (label: string) => void,
  debugAtomicOutputStage: (label: string) => void,
): void {
  const appendValueChunks = (): void => {
    appendValueChunksImpl(host.valueDynamicHost, builder);
  };
  if (host.delegateEntriesAfterLowLevel) appendValueChunks();
  const appendDynamicChunks = (): void => {
    appendDynamicChunksImpl(host.valueDynamicHost, builder);
  };
  if (!host.delegateEntriesAfterLowLevel && !host.delegateDynamicChunksAtSuffix) appendDynamicChunks();

  materializeTrailingFrameAndPending(
    host.trailingFrameHost,
    builder,
    appendValueChunks,
    associatedDelegateOutputs,
    appendDelegateGroupOutputs,
    debugOwnMutableOutputs,
    debugAtomicOutputStage,
  );

  repairNestedCalleeOutputs(host.nestedCalleeHost, builder, debugAtomicOutputStage);

  if (host.delegateEntriesAfterLowLevel || host.delegateDynamicChunksAtSuffix) appendDynamicChunks();
  debugAtomicOutputStage('deferred-dynamic-chunks');
}
