/**
 * phase-boundary extract: SC _createBuilder extract — nested-compose post-publish finish
 * (value-chunk producer epoch, prepared call nodes, finish log).
 */

import type { AbiFunction, ExternalCallAbi } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import type { ValueChunkProducerPathDisposition } from './ValueChunkProducerIdentity.js';

export type FinishCreateBuilderNestedComposeHost = {
  describeValueChunkWrites: (group: ExternalCallUtxoGroup) => any;
  preparedChildProducerPath: (depth: number, row: any) => ValueChunkProducerPathDisposition;
};

export type FinishCreateBuilderNestedComposeBags = {
  childValueChunkProducerAliases: ExternalCallUtxoGroup[];
  childValueChunkProducerPhysicalGroup: ExternalCallUtxoGroup | undefined;
  childValueChunkProducerEpoch: number | undefined;
  allGroupEcSlots: Array<ExternalCallAbi | {
    hasReturnValues?: boolean;
    requiredDataNftIndices: number[];
  }>;
  allGroupParentIndices: number[];
};

/**
 * After the nested-compose group is published: stage value-chunk producer
 * bindings, register prepared call nodes, and append the nested callsite
 * onto the group metadata arrays.
 */
export function finishCreateBuilderNestedCompose(
  host: FinishCreateBuilderNestedComposeHost,
  params: {
    nested: ExternalCallAbi;
    selectedFn: AbiFunction | undefined;
    sharedGroupIndex: number;
    delegateCallGroupIndex: number | undefined;
    childExternalGroupIndex: number;
    childCompilerInternalArgs: Record<string, FunctionArgument>;
    childFunctionName: string;
    directInvocationRows: readonly any[] | undefined;
    proxyCallee: any | undefined;
    publishChildValueChunkProducerBinding: (binding: any) => void;
    latestChildValueChunkProducerBinding: any;
    valueChunkProducerEpochByPhysicalGroup: WeakMap<ExternalCallUtxoGroup, number>;
    preparedCallNodes: any[] | undefined;
    preparedCallNodeByExternalGroup: Map<number, number>;
    latestPreparedCallNodeByPhysicalGroup: Map<number, number>;
    externalCallUtxoGroups: ExternalCallUtxoGroup[];
    lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
    delegateGroupIndex: number;
    timingEnabled: boolean;
    bags: FinishCreateBuilderNestedComposeBags;
    [key: string]: any;
  },
): FinishCreateBuilderNestedComposeBags {
  const {
    nested, selectedFn, sharedGroupIndex, delegateCallGroupIndex, childExternalGroupIndex,
    childCompilerInternalArgs, directInvocationRows, proxyCallee,
    publishChildValueChunkProducerBinding,
    latestChildValueChunkProducerBinding, valueChunkProducerEpochByPhysicalGroup,
    preparedCallNodes, preparedCallNodeByExternalGroup, latestPreparedCallNodeByPhysicalGroup,
    externalCallUtxoGroups, lowLevelCallUtxoGroups, delegateGroupIndex, timingEnabled, bags,
  } = params;
  const callee = params.callee as any;
  const resolvedRawFunctionName = params.resolvedRawFunctionName as string | undefined;
  const producerSelector = params.producerSelector as string | undefined;
  const callTreeNestedArgs = params.callTreeNestedArgs as FunctionArgument[] | undefined;

  let childValueChunkProducerAliases = bags.childValueChunkProducerAliases;
  let childValueChunkProducerPhysicalGroup = bags.childValueChunkProducerPhysicalGroup;
  let childValueChunkProducerEpoch = bags.childValueChunkProducerEpoch;
  let allGroupEcSlots = bags.allGroupEcSlots;
  let allGroupParentIndices = bags.allGroupParentIndices;

  const describeValueChunkWrites = host.describeValueChunkWrites;
  const preparedChildProducerPath = host.preparedChildProducerPath;

  const childGroup = externalCallUtxoGroups[childExternalGroupIndex];
  childGroup.valueChunkWrites = describeValueChunkWrites(childGroup);
  const physicalValueChunkGroup = sharedGroupIndex >= 0
    ? externalCallUtxoGroups[sharedGroupIndex] : childGroup;
  const executionValueChunkGroup = delegateCallGroupIndex === undefined
    ? undefined : lowLevelCallUtxoGroups[delegateCallGroupIndex];
  childValueChunkProducerPhysicalGroup = physicalValueChunkGroup;
  childValueChunkProducerEpoch = (
    valueChunkProducerEpochByPhysicalGroup.get(physicalValueChunkGroup) ?? 0
  ) + 1;
  valueChunkProducerEpochByPhysicalGroup.set(
    physicalValueChunkGroup, childValueChunkProducerEpoch,
  );
  childValueChunkProducerAliases = [...new Set([
    childGroup, physicalValueChunkGroup, executionValueChunkGroup,
  ].filter((group): group is ExternalCallUtxoGroup => group !== undefined))];
  publishChildValueChunkProducerBinding(latestChildValueChunkProducerBinding);
  if (preparedCallNodes) {
    preparedCallNodeByExternalGroup.set(childExternalGroupIndex, preparedCallNodes.length);
    if (directInvocationRows?.length) {
      const rowsWithProducerPaths = directInvocationRows.map((row: any) => ({
        row,
        producerPath: row.producerPath ?? preparedChildProducerPath(0, {
          sourceCallsiteId: row.sourceCallsiteId ?? nested.callsiteId,
          sourceLogicalIndex: row.sourceLogicalIndex,
          occurrenceIndex: row.occurrenceIndex,
          sourceEffectOrdinal: row.sourceEffectOrdinal,
        }),
      }));
      for (const { row, producerPath } of rowsWithProducerPaths) {
        preparedCallNodes.push({
          contract: callee,
          functionName: row.handler.name,
          selector: row.selector,
          args: [...row.args],
          ...(proxyCallee && { executionArtifact: proxyCallee.implementation.inner.artifact }),
          parent: 0,
          ...(nested.callsiteId !== undefined && { callsiteId: nested.callsiteId }),
          sourceCallsiteId: row.sourceCallsiteId ?? nested.callsiteId,
          sourceLogicalIndex: row.sourceLogicalIndex,
          occurrenceIndex: row.occurrenceIndex,
          sourceEffectOrdinal: row.sourceEffectOrdinal,
          producerPath,
        });
      }
    } else {
      preparedCallNodes.push({
        contract: callee,
        functionName: resolvedRawFunctionName ?? nested.functionName,
        ...(producerSelector !== undefined && { selector: producerSelector }),
        args: callTreeNestedArgs,
        ...(proxyCallee && { executionArtifact: proxyCallee.implementation.inner.artifact }),
        parent: 0,
        ...(nested.callsiteId !== undefined && { callsiteId: nested.callsiteId }),
        ...(nested.sourceEffectOrdinal !== undefined && {
          sourceEffectOrdinal: nested.sourceEffectOrdinal,
        }),
        ...(nested.callsiteId !== undefined && {
          sourceCallsiteId: nested.callsiteId,
          ...((nested.occurrence ?? 'once') !== 'loop' && { occurrenceIndex: 0 }),
        }),
        producerPath: preparedChildProducerPath(0, {
          sourceCallsiteId: nested.callsiteId,
          ...((nested.occurrence ?? 'once') !== 'loop' && { occurrenceIndex: 0 }),
          sourceEffectOrdinal: nested.sourceEffectOrdinal,
        }),
      });
    }
    latestPreparedCallNodeByPhysicalGroup.set(
      sharedGroupIndex >= 0 ? sharedGroupIndex : childExternalGroupIndex,
      preparedCallNodes.length - 1,
    );
  }
  allGroupEcSlots = [...allGroupEcSlots, nested];
  // Delegate-composed children use the callsite map below rather than the direct/transitive parent
  // table. Retain an explicit sentinel so the two metadata arrays stay index-aligned.
  allGroupParentIndices = [...allGroupParentIndices, -1];
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_TRACE_CONCISE === '1') {
    console.error('nested-compose-finish', {
      delegateGroupIndex, interfaceName: nested.interfaceName,
      functionName: nested.functionName, childExternalGroupIndex,
      selectedFunction: selectedFn?.name,
      sortedBatchInfo: selectedFn?.sortedBatchInfo,
      childCompilerInternalArgs,
    });
  }
  if (timingEnabled) console.error('nested-callsite-complete', {
    callsiteId: nested.callsiteId,
    interfaceName: nested.interfaceName,
    functionName: nested.functionName,
  });

  return {
    childValueChunkProducerAliases,
    childValueChunkProducerPhysicalGroup,
    childValueChunkProducerEpoch,
    allGroupEcSlots,
    allGroupParentIndices,
  };
}
