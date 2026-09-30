/**
 * phase-boundary extract: SC _createBuilder extract — atomic-graph promotion finish: order
 * prepared nodes, re-derive multi-row value-chunk lanes, stamp
 * __preparedAtomicCalls onto the builder before complete.
 */

import { binToHex } from '@bitauth/libauth';
import type { AbiFunction } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import {
  canonicalValueChunkProducerPathContext,
  type ValueChunkProducerPathDisposition,
} from './ValueChunkProducerIdentity.js';
import { valueChunkWriteResourceIdentity } from './value-chunk-persist.js';

/**
 * When a manually-expanded delegate graph needs atomic promotion, collapse
 * multi-row value-chunk lanes onto the terminal producer and freeze the
 * prepared call tree onto the builder.
 */
export function finishCreateBuilderAtomicPromotion(params: {
  builder: StatefulTransactionBuilder;
  preparedAtomicNodes: any[] | undefined;
  functionName: string;
  [key: string]: any;
}): void {
  const { builder, preparedAtomicNodes, functionName } = params;

// A manually-expanded delegate graph normally materializes one physical state block per reached call. Two
// writes to the same owner cannot both consume its one master UTXO, regardless of whether the logical callers
// are equal. Collapsing them into the legacy first-call block can also discard the later call's entry layout.
// Preserve the compiler-authored call tree on the finished builder so send() can promote this one operation
// to the atomic message-bus composer, which journals all calls through the owner's canonical route.
if (preparedAtomicNodes?.length) {
  const children = new Map<number, number[]>();
  preparedAtomicNodes.forEach((node, index) => {
    if (!node.active || node.parent === null) return;
    const siblings = children.get(node.parent) ?? [];
    siblings.push(index);
    children.set(node.parent, siblings);
  });
  for (const siblings of children.values()) {
    siblings.sort((left, right) => {
      const a = preparedAtomicNodes![left].callsiteId ?? Number.MAX_SAFE_INTEGER;
      const b = preparedAtomicNodes![right].callsiteId ?? Number.MAX_SAFE_INTEGER;
      return a - b || left - right;
    });
  }
  const orderedNodes: any[] = [];
  const visit = (index: number): void => {
    const node = preparedAtomicNodes![index];
    if (!node?.active) return;
    orderedNodes.push(node);
    for (const child of children.get(index) ?? []) visit(child);
  };
  visit(0);

  const callerSets = new Map<string, Set<string>>();
  const ownerInvocationCounts = new Map<string, number>();
  for (const node of orderedNodes) {
    const artifact = node.executionArtifact ?? node.contract.inner.artifact;
    const abiFunction = (artifact.abi as readonly AbiFunction[])
      .find((candidate) => node.selector !== undefined
        && candidate.selector?.toLowerCase() === node.selector.toLowerCase());
    const owner = `${node.contract.categoryId.toLowerCase()}:${node.contract.inner.lockingBytecode.toLowerCase()}`;
    ownerInvocationCounts.set(owner, (ownerInvocationCounts.get(owner) ?? 0) + 1);
    if (abiFunction?.writesState !== true) continue;
    const caller = node.parent === null
      ? '__tx_origin__'
      : `${preparedAtomicNodes[node.parent].contract.categoryId.toLowerCase()}:`
        + preparedAtomicNodes[node.parent].contract.inner.lockingBytecode.toLowerCase();
    const callers = callerSets.get(owner) ?? new Set<string>();
    callers.add(caller);
    callerSets.set(owner, callers);
  }
  const requiresAtomicPromotion = [...ownerInvocationCounts.values()].some((count) => count > 1);
  const unrouteableNodes = orderedNodes.flatMap((node) => {
    const artifact = node.executionArtifact ?? node.contract.inner.artifact;
    if (node.selector === undefined) return [node];
    const selector = node.selector.toLowerCase();
    return artifact.messageBus?.handlers.some((handler: any) =>
      handler.selector.toLowerCase() === selector && handler.eligible) === true ? [] : [node];
  });
  const completeGraph = orderedNodes.length === preparedAtomicNodes.filter((node) => node.active).length;
  const allRoutesEligible = completeGraph && unrouteableNodes.length === 0;
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ATOMIC_PROMOTION === '1') {
    console.error('atomic-promotion', JSON.stringify({
      root: functionName,
      requiresAtomicPromotion,
      allRoutesEligible,
      nodes: orderedNodes.map((node) => ({
        functionName: node.functionName,
        callsiteId: node.callsiteId,
        batchLogicalIndex: node.batchLogicalIndex,
        batchOccurrenceIndex: node.batchOccurrenceIndex,
        contract: (node.executionArtifact ?? node.contract.inner.artifact).contractName,
        owner: node.contract.inner.lockingBytecode,
        parent: node.parent,
        args: node.args.map((value: any) => value instanceof Uint8Array
          ? `${value.length}:${binToHex(value).slice(0, 96)}`
          : Array.isArray(value) ? `array:${value.length}` : String(value)),
        provisionalResult: node.provisionalResultCommitment
          ? binToHex(node.provisionalResultCommitment) : undefined,
        valueChunkProductionCount: node.valueChunkProductions?.length ?? 0,
        route: (node.executionArtifact ?? node.contract.inner.artifact).messageBus?.handlers.find(
          (handler: any) => handler.name === node.functionName,
        )?.eligible,
      })),
      callerSets: [...callerSets].map(([owner, callers]) => [owner, [...callers]]),
      ownerInvocationCounts: [...ownerInvocationCounts],
    }));
  }
  if (requiresAtomicPromotion && !allRoutesEligible) {
    if (!completeGraph) {
      throw new Error('messageBus: repeated-owner calls require an acyclic, complete prepared graph');
    }
    const directOnly = unrouteableNodes.map((node) => {
      const artifact = node.executionArtifact ?? node.contract.inner.artifact;
      return `${artifact.contractName}.${node.functionName}`;
    });
    throw new Error(
      'messageBus: repeated-owner calls require atomic composition, but the prepared graph contains '
      + `direct-only participant${directOnly.length === 1 ? '' : 's'}: ${directOnly.join(', ')}. `
      + 'Mixed direct/kernel participant composition is not yet supported.',
    );
  }
  if (requiresAtomicPromotion && allRoutesEligible) {
    // A participant's route materializes one continuation lane per storage resource, and the compiled program
    // chunks that resource's post-state after every row the composed route executes. Row discovery is
    // per-callsite, so when several reached rows of one owner write the same resource each derivation sees
    // only its own element (plus at most one predecessor) and the row planned last would publish a value that
    // stops there - binding too narrow a band and digesting a state the route covenant never produces.
    //
    // Re-derive that value once per (owner, resource) over every reached writer row of the owner in graph
    // order, and let only the node owning the derivation's terminal row publish the lane.
    const productionResourceIdentity = (
      production: NonNullable<any['valueChunkProductions']>[number],
    ): string => valueChunkWriteResourceIdentity(production.write);
    const nodeOwnerIdentity = (node: any): string =>
      `${node.contract.categoryId.toLowerCase()}:${node.contract.inner.lockingBytecode.toLowerCase()}`;
    const nodePathKey = (path: any | undefined): string | undefined =>
      path?.status === 'complete'
        ? canonicalValueChunkProducerPathContext(path.context) : undefined;
    const claimPathKey = (
      production: NonNullable<any['valueChunkProductions']>[number],
    ): string | undefined => canonicalValueChunkProducerPathContext({
      version: 1, sourcePath: production.claim.producer.sourcePath,
    });
    const nodeHandler = (node: any): AbiFunction | undefined => {
      const abi = (node.executionArtifact ?? node.contract.inner.artifact).abi as readonly AbiFunction[];
      return node.selector === undefined
        ? abi.find((candidate) => candidate.name === node.functionName)
        : (abi.find((candidate) => candidate.selector?.toLowerCase() === node.selector!.toLowerCase())
          ?? abi.find((candidate) => candidate.name === node.functionName));
    };
    const nodeRouteRow = (node: any): any | undefined => {
      const handler = nodeHandler(node);
      if (!handler) return undefined;
      return {
        args: [...node.args],
        handler,
        ...(node.selector !== undefined && { selector: node.selector }),
        ...(node.sourceCallsiteId !== undefined && { sourceCallsiteId: node.sourceCallsiteId }),
        ...(node.sourceLogicalIndex !== undefined && { sourceLogicalIndex: node.sourceLogicalIndex }),
        ...(node.occurrenceIndex !== undefined && { occurrenceIndex: node.occurrenceIndex }),
        ...(node.sourceEffectOrdinal !== undefined && { sourceEffectOrdinal: node.sourceEffectOrdinal }),
        producerPath: node.producerPath,
      };
    };
    const resourceGroups = new Map<string, {
      owner: string;
      resource: string;
      collection: string;
      collectionSignature: string;
    }>();
    for (const node of orderedNodes) {
      const owner = nodeOwnerIdentity(node);
      for (const production of node.valueChunkProductions ?? []) {
        resourceGroups.set(`${owner}|${productionResourceIdentity(production)}`, {
          owner,
          resource: productionResourceIdentity(production),
          collection: production.write.collection,
          collectionSignature: production.write.collectionSignature,
        });
      }
    }
    for (const group of resourceGroups.values()) {
      // Every reached row of this owner which writes the same collection appends one element to the
      // post-state, whether or not that row published a production of its own.
      const writers = orderedNodes.filter((node) => nodeOwnerIdentity(node) === group.owner
        && (nodeHandler(node)?.entryAccesses ?? []).some((access) => (
          (access.collection === group.collection
            || access.collection === group.collectionSignature)
          && access.operations.includes('write')
        )));
      if (writers.length < 2) continue;
      const rowSources = writers
        .map((node) => ({ node, row: nodeRouteRow(node) }))
        .filter((entry): entry is { node: any; row: any } =>
          entry.row !== undefined);
      if (rowSources.length < 2) continue;
      // Late-discovered descendants may not allocate their own physical derivation context. Any
      // writer of this owner can supply the authenticated pre-state; the full row list determines
      // the terminal producer, independently of which row supplied that context.
      const derive = [...rowSources].reverse()
        .find((entry) => entry.node.deriveRouteValueChunkProductions)?.node.deriveRouteValueChunkProductions;
      if (!derive) continue;
      const derived = derive(rowSources.map((entry) => entry.row))
        .filter((production: any) => productionResourceIdentity(production) === group.resource);
      if (derived.length === 0) continue;
      // The derivation itself selects the terminal producer from the supplied row order; publish its lane
      // only on the node which owns that exact producer path.
      const lanePathKeys = new Set(derived.map(claimPathKey)
        .filter((key: any): key is string => key !== undefined));
      const laneNode = [...rowSources].reverse()
        .find((entry) => lanePathKeys.has(nodePathKey(entry.node.producerPath) ?? ''))?.node;
      if (!laneNode) continue;
      // One terminal claim per resource: a superseded row must not transport its partial value.
      for (const { node } of rowSources) {
        if (node === laneNode) continue;
        const remaining = (node.valueChunkProductions ?? []).filter((production: any) => (
          productionResourceIdentity(production) !== group.resource
        ));
        if (remaining.length !== (node.valueChunkProductions?.length ?? 0)) {
          node.valueChunkProductions = remaining;
        }
      }
      laneNode.valueChunkProductions = [
        ...(laneNode.valueChunkProductions ?? []).filter((production: any) => (
          productionResourceIdentity(production) !== group.resource
        )),
        ...derived,
      ];
      // A per-callsite refresh would republish the partial lane as soon as one row's arguments change, so
      // keep every writer row of this resource refreshing the same complete row list.
      const rowArgumentsByPath = new Map<string, readonly FunctionArgument[]>(
        rowSources.flatMap((entry) => {
          const key = nodePathKey(entry.node.producerPath);
          return key === undefined ? [] : [[key, entry.row.args] as [string, readonly FunctionArgument[]]];
        }),
      );
      const rederive = (resultUpdate?: {
        producerPath: ValueChunkProducerPathDisposition; results: ReadonlyMap<number, FunctionArgument>;
      }): typeof derived => {
        const refreshed = rowSources.map((entry) => {
          const key = nodePathKey(entry.node.producerPath);
          const args = key === undefined ? undefined : rowArgumentsByPath.get(key);
          return args === undefined ? entry.row : { ...entry.row, args };
        });
        return derive(refreshed, resultUpdate)
          .filter((production: any) => productionResourceIdentity(production) === group.resource);
      };
      const laneKey = nodePathKey(laneNode.producerPath);
      for (const entry of rowSources) {
        const key = nodePathKey(entry.node.producerPath);
        if (key === undefined) continue;
        const refresh = (nextArgs: readonly FunctionArgument[], results?: ReadonlyMap<number, FunctionArgument>): any => {
          rowArgumentsByPath.set(key, nextArgs);
          const lane = laneKey === undefined ? [] : rederive(results && {
            producerPath: entry.node.producerPath, results,
          })
            .filter((production: any) => claimPathKey(production) === laneKey);
          return [
            ...(entry.node.valueChunkProductions ?? []).filter((production: any) => (
              productionResourceIdentity(production) !== group.resource
            )),
            ...(entry.node === laneNode ? lane : []),
          ];
        };
        entry.node.resolveValueChunkProductionsFromArgs = refresh;
        entry.node.resolveValueChunkProductionsFromResults = refresh;
      }
    }
    (builder as StatefulTransactionBuilder & {
      __preparedAtomicCalls?: readonly any[];
    }).__preparedAtomicCalls = Object.freeze(orderedNodes.map((node) => Object.freeze({
      contract: node.contract,
      functionName: node.functionName,
      ...(node.selector !== undefined && { selector: node.selector }),
      args: Object.freeze([...node.args]),
      ...(node.callsiteId !== undefined && { callsiteId: node.callsiteId }),
      ...(node.sourceCallsiteId !== undefined && { sourceCallsiteId: node.sourceCallsiteId }),
      ...(node.sourceLogicalIndex !== undefined && { sourceLogicalIndex: node.sourceLogicalIndex }),
      ...(node.occurrenceIndex !== undefined && { occurrenceIndex: node.occurrenceIndex }),
      ...(node.sourceEffectOrdinal !== undefined && {
        sourceEffectOrdinal: node.sourceEffectOrdinal,
      }),
      producerPath: node.producerPath,
      ...(node.valueChunkProductions?.length && {
        valueChunkProductions: Object.freeze(node.valueChunkProductions.map((production: any) => Object.freeze({
          write: Object.freeze({ ...production.write }),
          claim: production.claim,
          stateOwner: Object.freeze({ ...production.stateOwner }),
          value: production.value.slice(),
        }))),
      }),
      ...(node.resolveValueChunkProductionsFromArgs && {
        resolveValueChunkProductionsFromArgs: node.resolveValueChunkProductionsFromArgs,
      }),
      ...(node.resolveValueChunkProductionsFromResults && {
        resolveValueChunkProductionsFromResults: node.resolveValueChunkProductionsFromResults,
      }),
      ...(node.batchLogicalIndex !== undefined && { batchLogicalIndex: node.batchLogicalIndex }),
      ...(node.batchOccurrenceIndex !== undefined && {
        batchOccurrenceIndex: node.batchOccurrenceIndex,
      }),
      ...(node.targetLockingBytecode !== undefined && {
        targetLockingBytecode: node.targetLockingBytecode,
      }),
      ...(node.executionArtifact && { executionArtifact: node.executionArtifact }),
      ...(node.executor && { executor: node.executor }),
      ...(node.provisionalResultCommitment && {
        provisionalResultCommitment: node.provisionalResultCommitment.slice(),
      }),
      ...(node.resolveArgsFromResults && {
        resolveArgsFromResults: node.resolveArgsFromResults,
      }),
    })));
  }
}
}
