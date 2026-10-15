/**
 * phase-boundary extract: STB build-phase extract — value/dynamic chunk ordering, trailing frame, nested-callee repair.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';
import { isContractUnlocker } from '../interfaces.js';
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
  const master = host.valueDynamicHost.masterUnlocker();
  const independentlyWitnessedRoot = !host.trailingFrameHost.composedParticipant
    && !host.trailingFrameHost.compilerRouteDelegateBlock
    && !host.valueDynamicHost.runtimeLoopOrComposed
    && isContractUnlocker(master)
    && !('messageBusConvention' in master.abiFunction)
    && master.abiFunction.inputs.some((input) => input.name === '__internal__dynamicChunkOutputBase');
  // Ordinary witnessed runs may follow every callee and identity recreation. Appending earlier lets a
  // later fixed callee output overwrite a chunk before the root publishes its materialized coordinate.
  const deferDynamicChunks = host.delegateEntriesAfterLowLevel || host.delegateDynamicChunksAtSuffix
    || independentlyWitnessedRoot;
  if (!deferDynamicChunks) appendDynamicChunks();

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

  if (deferDynamicChunks) appendDynamicChunks();
  debugAtomicOutputStage('deferred-dynamic-chunks');
}
