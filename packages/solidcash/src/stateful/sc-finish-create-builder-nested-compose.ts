/**
 * phase-boundary extract: SC _createBuilder extract — nested-compose post-publish finish
 * (value-chunk producer epoch, prepared atomic nodes, finish log).
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AbiFunction, ExternalCallAbi } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  advanceValueChunkProducerArgumentEpoch,
  createValueChunkProducerArgumentEpoch,
  valueChunkProducerArgumentsInEpoch,
  type ValueChunkProducerPathDisposition,
} from './ValueChunkProducerIdentity.js';

export type FinishCreateBuilderNestedComposeHost = {
  resolveExternalArgs: (...args: any[]) => FunctionArgument[] | undefined;
  describeValueChunkWrites: (group: ExternalCallUtxoGroup) => any;
  preparedChildProducerPath: (depth: number, row: any) => ValueChunkProducerPathDisposition;
};

export type FinishCreateBuilderNestedComposeBags = {
  routeValueChunkProducerAliases: ExternalCallUtxoGroup[];
  routeValueChunkProducerPhysicalGroup: ExternalCallUtxoGroup | undefined;
  routeValueChunkProducerEpoch: number | undefined;
  allGroupEcSlots: Array<ExternalCallAbi | {
    hasReturnValues?: boolean;
    requiredDataNftIndices: number[];
  }>;
  allGroupParentIndices: number[];
};

/**
 * After the nested-compose group is published: stage value-chunk producer
 * bindings, register prepared atomic nodes, and append the nested callsite
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
    nestedSources: readonly any[] | undefined;
    directInvocationRows: readonly any[] | undefined;
    resolveGraphNestedReturns: ((results: ReadonlyMap<number, FunctionArgument>) => {
      externalReturns: Map<string, FunctionArgument>;
      nextArgs: FunctionArgument[];
    } | undefined) | undefined;
    delegateVisibleArgs: readonly FunctionArgument[];
    delegateVisibleInputs: readonly { name: string }[];
    callInfoContract: any;
    onChainState: { state: Record<string, unknown> };
    proxyCallee: any | undefined;
    refreshChunkableRouteWitnesses: ((...args: any[]) => any) | undefined;
    valueChunkProductionsForPath: (path: any) => readonly any[] | any[];
    publishRouteValueChunkProducerBinding: (binding: any) => void;
    latestRouteValueChunkProducerBinding: any;
    routeValueChunkProducerEpochByPhysicalGroup: WeakMap<ExternalCallUtxoGroup, number>;
    preparedAtomicNodes: any[] | undefined;
    preparedAtomicNodeByExternalGroup: Map<number, number>;
    latestPreparedAtomicNodeByPhysicalGroup: Map<number, number>;
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
    childCompilerInternalArgs, nestedSources,
    directInvocationRows, resolveGraphNestedReturns,
    delegateVisibleArgs, delegateVisibleInputs, callInfoContract, onChainState,
    proxyCallee, refreshChunkableRouteWitnesses,
    valueChunkProductionsForPath, publishRouteValueChunkProducerBinding,
    latestRouteValueChunkProducerBinding, routeValueChunkProducerEpochByPhysicalGroup,
    preparedAtomicNodes, preparedAtomicNodeByExternalGroup, latestPreparedAtomicNodeByPhysicalGroup,
    externalCallUtxoGroups, lowLevelCallUtxoGroups, delegateGroupIndex, timingEnabled, bags,
  } = params;
  const delegateSelfAddress = params.delegateSelfAddress as FunctionArgument;
  const callee = params.callee as any;
  const resolvedTargetLockingBytecode = params.resolvedTargetLockingBytecode as
    Uint8Array | undefined;
  const resolvedRawFunctionName = params.resolvedRawFunctionName as string | undefined;
  const producerSelector = params.producerSelector as string | undefined;
  const graphNestedArgs = params.graphNestedArgs as FunctionArgument[] | undefined;
  const resolveGraphNestedArgs = params.resolveGraphNestedArgs as
    ((results: ReadonlyMap<number, FunctionArgument>) => FunctionArgument[] | undefined) | undefined;

  let routeValueChunkProducerAliases = bags.routeValueChunkProducerAliases;
  let routeValueChunkProducerPhysicalGroup = bags.routeValueChunkProducerPhysicalGroup;
  let routeValueChunkProducerEpoch = bags.routeValueChunkProducerEpoch;
  let allGroupEcSlots = bags.allGroupEcSlots;
  let allGroupParentIndices = bags.allGroupParentIndices;

  const describeValueChunkWrites = host.describeValueChunkWrites;
  const preparedChildProducerPath = host.preparedChildProducerPath;
  const callInfo = { contract: callInfoContract };

  const childGroup = externalCallUtxoGroups[childExternalGroupIndex];
  childGroup.valueChunkWrites = describeValueChunkWrites(childGroup);
  const physicalValueChunkGroup = sharedGroupIndex >= 0
    ? externalCallUtxoGroups[sharedGroupIndex] : childGroup;
  const executionValueChunkGroup = delegateCallGroupIndex === undefined
    ? undefined : lowLevelCallUtxoGroups[delegateCallGroupIndex];
  routeValueChunkProducerPhysicalGroup = physicalValueChunkGroup;
  routeValueChunkProducerEpoch = (
    routeValueChunkProducerEpochByPhysicalGroup.get(physicalValueChunkGroup) ?? 0
  ) + 1;
  routeValueChunkProducerEpochByPhysicalGroup.set(
    physicalValueChunkGroup, routeValueChunkProducerEpoch,
  );
  routeValueChunkProducerAliases = [...new Set([
    childGroup, physicalValueChunkGroup, executionValueChunkGroup,
  ].filter((group): group is ExternalCallUtxoGroup => group !== undefined))];
  publishRouteValueChunkProducerBinding(latestRouteValueChunkProducerBinding);
  if (preparedAtomicNodes) {
    const atomicNodeIndex = preparedAtomicNodes.length;
    const runtimeRows = directInvocationRows;
    if (runtimeRows?.length) {
      const runtimeRowsWithProducerPaths = runtimeRows.map((row: any) => ({
        row,
        producerPath: row.producerPath ?? preparedChildProducerPath(0, {
          sourceCallsiteId: row.sourceCallsiteId ?? nested.callsiteId,
          sourceLogicalIndex: row.sourceLogicalIndex,
          occurrenceIndex: row.occurrenceIndex,
          sourceEffectOrdinal: row.sourceEffectOrdinal,
        }),
      }));
      let routeArgumentEpoch = createValueChunkProducerArgumentEpoch(
        runtimeRowsWithProducerPaths.map(({ row, producerPath }: any) => ({
          producerPath, args: row.args,
        })),
      );
      let resolveRowArgsFromResults: ((
        row: (typeof runtimeRowsWithProducerPaths)[number]['row'],
        results: ReadonlyMap<number, FunctionArgument>,
      ) => FunctionArgument[] | undefined) | undefined;
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_SKIP_ROW_RESULT_RESOLVER !== '1') {
        if (resolveGraphNestedReturns && nestedSources) {
        // Without a compiled batch route these rows are the reached occurrences of one callsite, so
        // their arguments are re-resolved from the same authenticated result epoch at that
        // occurrence. Argument recipes only run once their producer result is authenticated, which is
        // why the planning-time vector can still hold the pre-result placeholder.
          const resolveReturns = resolveGraphNestedReturns;
          resolveRowArgsFromResults = (row, results) => {
            const resolved = resolveReturns(results);
            if (!resolved) return undefined;
            const occurrenceIndex = row.occurrenceIndex ?? 0;
            if (occurrenceIndex === 0) return [...resolved.nextArgs];
            const occurrenceArgs = host.resolveExternalArgs(
              nestedSources, delegateVisibleArgs, callInfo.contract.inner.artifact, onChainState.state,
              delegateVisibleInputs, resolved.externalReturns, occurrenceIndex, false,
              delegateSelfAddress,
            );
            return occurrenceArgs ? [...occurrenceArgs] : undefined;
          };
        }
      }
      for (const { row, producerPath } of runtimeRowsWithProducerPaths) {
        const rowValueChunkProductions = valueChunkProductionsForPath(producerPath);
        // Each closure deliberately shares the route's argument epoch, while its path identifies one row.
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        const refreshValueProductions = (
          nextArgs: readonly FunctionArgument[], results?: ReadonlyMap<number, FunctionArgument>,
        ): any => {
          routeArgumentEpoch = advanceValueChunkProducerArgumentEpoch(routeArgumentEpoch, producerPath, nextArgs);
          const refreshedRows = runtimeRowsWithProducerPaths.map((candidate: any) => ({
            ...candidate.row,
            args: valueChunkProducerArgumentsInEpoch(routeArgumentEpoch, candidate.producerPath) ?? candidate.row.args,
          }));
          refreshChunkableRouteWitnesses!(
            refreshedRows, refreshedRows[refreshedRows.length - 1]!.args, undefined,
            results && { producerPath, results },
          );
          return valueChunkProductionsForPath(producerPath);
        };
        preparedAtomicNodes.push({
          contract: callee,
          functionName: row.handler.name,
          selector: row.selector,
          args: [...row.args],
          ...(resolvedTargetLockingBytecode && {
            targetLockingBytecode: binToHex(resolvedTargetLockingBytecode),
          }),
          ...(proxyCallee && {
            executionArtifact: proxyCallee.implementation.inner.artifact,
            executor: proxyCallee.implementation,
          }),
          parent: 0,
          ...(nested.callsiteId !== undefined && { callsiteId: nested.callsiteId }),
          sourceCallsiteId: row.sourceCallsiteId ?? nested.callsiteId,
          sourceLogicalIndex: row.sourceLogicalIndex,
          occurrenceIndex: row.occurrenceIndex,
          sourceEffectOrdinal: row.sourceEffectOrdinal,
          producerPath,
          ...(rowValueChunkProductions?.length && {
            valueChunkProductions: rowValueChunkProductions,
          }),
          ...(refreshChunkableRouteWitnesses && producerPath.status === 'complete' && {
            resolveValueChunkProductionsFromArgs: refreshValueProductions,
            resolveValueChunkProductionsFromResults: refreshValueProductions,
          }),
          ...(refreshChunkableRouteWitnesses && {
            deriveRouteValueChunkProductions: (routeRows: any, resultUpdate?: {
              producerPath: ValueChunkProducerPathDisposition; results: ReadonlyMap<number, FunctionArgument>;
            }) => {
              refreshChunkableRouteWitnesses!(
                routeRows,
                routeRows[routeRows.length - 1]?.args ?? [...row.args],
                undefined, resultUpdate,
              );
              return routeRows.flatMap((routeRow: any) => valueChunkProductionsForPath(routeRow.producerPath));
            },
          }),
          // These rows were planned before any producer result existed. Once an authenticated result
          // for this callsite arrives, re-plan the route with it and adopt the matching row's
          // arguments, so a row argument sourced from another call's return carries the value that
          // call actually produced rather than the pre-result placeholder.
          ...(resolveRowArgsFromResults && {
            resolveArgsFromResults: (results: ReadonlyMap<number, FunctionArgument>) =>
              resolveRowArgsFromResults(row, results),
          }),
          // `nestedExternalCalls` contains only occurrences whose compiler-authored predicate was
          // resolved true above. Physical carrier reuse may select which legacy unlocker seeds graph
          // discovery, but it cannot erase a reached semantic invocation from atomic execution.
          active: true,
        });
      }
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ATOMIC_PUSH === '1') {
        console.error('atomic-node-push', JSON.stringify({
          site: 'SINGLE', nodeIndex: preparedAtomicNodes.length - 1,
          functionName: nested.functionName, callsiteId: nested.callsiteId,
          hasSources: nestedSources !== undefined,
          hasReturns: resolveGraphNestedReturns !== undefined,
          hasResolver: preparedAtomicNodes[preparedAtomicNodes.length - 1]!.resolveArgsFromResults !== undefined,
        }));
      }

    } else {
      const producerPath = preparedChildProducerPath(0, {
        sourceCallsiteId: nested.callsiteId,
        ...((nested.occurrence ?? 'once') !== 'loop' && { occurrenceIndex: 0 }),
        sourceEffectOrdinal: nested.sourceEffectOrdinal,
      });
      const nodeValueChunkProductions = valueChunkProductionsForPath(producerPath);
      preparedAtomicNodes.push({
        contract: callee,
        functionName: resolvedRawFunctionName ?? nested.functionName,
        ...(producerSelector !== undefined && { selector: producerSelector }),
        args: graphNestedArgs,
        ...(resolvedTargetLockingBytecode && {
          targetLockingBytecode: binToHex(resolvedTargetLockingBytecode),
        }),
        ...(proxyCallee && {
          executionArtifact: proxyCallee.implementation.inner.artifact,
          executor: proxyCallee.implementation,
        }),
        parent: 0,
        ...(nested.callsiteId !== undefined && { callsiteId: nested.callsiteId }),
        ...(nested.sourceEffectOrdinal !== undefined && {
          sourceEffectOrdinal: nested.sourceEffectOrdinal,
        }),
        ...(nested.callsiteId !== undefined && {
          sourceCallsiteId: nested.callsiteId,
          ...((nested.occurrence ?? 'once') !== 'loop' && { occurrenceIndex: 0 }),
        }),
        producerPath,
        ...(nodeValueChunkProductions?.length && {
          valueChunkProductions: nodeValueChunkProductions,
        }),
        ...(refreshChunkableRouteWitnesses && {
          resolveValueChunkProductionsFromResults: (nextArgs: any, results: ReadonlyMap<number, FunctionArgument>) => {
            refreshChunkableRouteWitnesses!(undefined, nextArgs, undefined, { producerPath, results });
            return valueChunkProductionsForPath(producerPath);
          },
          resolveValueChunkProductionsFromArgs: (nextArgs: any) => {
            refreshChunkableRouteWitnesses!(undefined, nextArgs);
            return valueChunkProductionsForPath(producerPath);
          },
        }),
        ...(refreshChunkableRouteWitnesses && {
          deriveRouteValueChunkProductions: (routeRows: any, resultUpdate?: {
            producerPath: ValueChunkProducerPathDisposition; results: ReadonlyMap<number, FunctionArgument>;
          }) => {
            refreshChunkableRouteWitnesses!(
              routeRows,
              routeRows[routeRows.length - 1]?.args ?? graphNestedArgs,
              undefined, resultUpdate,
            );
            return routeRows.flatMap((routeRow: any) => valueChunkProductionsForPath(routeRow.producerPath));
          },
        }),
        ...(resolveGraphNestedArgs && { resolveArgsFromResults: resolveGraphNestedArgs }),
        // Reachability was resolved before this node was constructed. Keep semantic activation tied
        // to that stable callsite occurrence, never to reuse of its physical legacy carrier.
        active: true,
      });
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ATOMIC_PUSH === '1') {
      console.error('atomic-node-push', JSON.stringify({
        site: 'SINGLE', nodeIndex: atomicNodeIndex,
        functionName: nested.functionName, callsiteId: nested.callsiteId,
        hasSources: nestedSources !== undefined,
        hasReturns: resolveGraphNestedReturns !== undefined,
        hasResolver: preparedAtomicNodes[atomicNodeIndex]!.resolveArgsFromResults !== undefined,
      }));
    }
    preparedAtomicNodeByExternalGroup.set(childExternalGroupIndex, atomicNodeIndex);
    latestPreparedAtomicNodeByPhysicalGroup.set(
      sharedGroupIndex >= 0 ? sharedGroupIndex : childExternalGroupIndex,
      preparedAtomicNodes.length - 1,
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
    routeValueChunkProducerAliases,
    routeValueChunkProducerPhysicalGroup,
    routeValueChunkProducerEpoch,
    allGroupEcSlots,
    allGroupParentIndices,
  };
}
