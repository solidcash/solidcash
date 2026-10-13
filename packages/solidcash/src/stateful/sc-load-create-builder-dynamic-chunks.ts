/**
 * phase-boundary extract: SC _createBuilder extract — dynamic-chunk inputs, value-chunk GC,
 * loop-entry vars, and runtime-loop event/transfer trailing segments.
 */

import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  encodeEventCommitment,
  parseChunkCommitment,
  type AbiFunction,
  type Artifact,
  type ExternalCallExpression,
  type StateLayout,
  type StateValue,
} from '@solidcash/utils';
import { vmapCounterPermutationSpec } from './sc-batch-raw.js';
import { visibleHandlerInputs } from './route-expression-key.js';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo } from '../interfaces.js';
import {
  createDynamicChunkUnlocker,
  createValueChunkUnlocker,
  getDynamicChunkAddress,
  getEntryNftLockingBytecode,
  getValueChunkAddress,
  resolveCollectionSignature,
} from './covenant-helpers.js';
import { selectedMessageBusResourceMetadata } from './message-bus-resource-routing.js';
import {
  RUNTIME_LOOP_EVENT_ITERATION_LIMIT,
  runtimeLoopEventIterationValues,
  runtimeLoopEventRepeatSource,
} from './runtime-loop-event-domain.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import type { OnChainState } from './StateReader.js';
import type { MessageBusRuntimeAbiFunction } from './sc-batch-raw.js';
import type { RuntimeLoopTransferOutput } from './StatefulTransactionBuilder.js';

export type LoadCreateBuilderDynamicChunksHost = {
  readonly categoryId: string;
  readonly inner: any;
  evaluateExternalExpression: (...args: any[]) => any;
  hydrateExternalPredicateState: (...args: any[]) => Promise<any>;
  vmapCounterDomain: (...args: any[]) => any;
};

export type LoadCreateBuilderDynamicChunksResult = {
  dynamicChunkInputs: UnlockableUtxo[];
  trailingDisposalInputs: UnlockableUtxo[];
  oldDynamicChunkCounts: Map<string, number>;
  oldDynamicChunkCommitments: Map<string, string[]>;
  loopEntryVars: any[];
  runtimeLoopEventOutputs: any[];
  runtimeLoopTransferOutputs: RuntimeLoopTransferOutput[];
  runtimeLoopTrailingSegments: any[];
  delegateRouteGroup: ExternalCallUtxoGroup | undefined;
};

/** Keep compiler fixed-batch coordinates ahead of runtime-discovered trailing entries. */
export function orderedTrailingEntryCollections(
  sortedBatches: readonly { collection: string }[] | undefined,
  ...runtimeCollections: readonly Iterable<string>[]
): string[] {
  const collections: string[] = [];
  const add = (name: string): void => {
    if (!collections.includes(name)) collections.push(name);
  };
  for (const batch of sortedBatches ?? []) add(batch.collection);
  for (const source of runtimeCollections) for (const name of source) add(name);
  return collections;
}

/** The route ABI is a union; only collections reached by this envelope own physical slots. */
export function orderedActiveTrailingEntryCollections(
  sortedBatches: readonly { collection: string }[] | undefined,
  ...activeCollections: readonly Iterable<string>[]
): string[] {
  const sources = activeCollections.map((source) => [...source]);
  const active = new Set<string>();
  for (const source of sources) for (const collection of source) active.add(collection);
  return orderedTrailingEntryCollections(
    sortedBatches?.filter((batch) => active.has(batch.collection)),
    ...sources,
  );
}

/**
 * After event locks are collected: fetch old dynamic/value chunks to consume,
 * plan loop-entry NFT pads, and materialize runtime-loop event/transfer trailing
 * segment descriptors for the upcoming builder.
 */
export async function loadCreateBuilderDynamicChunks(
  host: LoadCreateBuilderDynamicChunksHost,
  params: {
    dynamicVarInfos: Array<{ name: string; type: string }>;
    dynamicChunkVars: any[];
    valueChunkGc: readonly any[];
    onChainState: OnChainState;
    stateLayout: StateLayout;
    overrides: { blockBase?: number } | undefined;
    abiFunction: AbiFunction | undefined;
    entryAbiFunction: AbiFunction | undefined;
    lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
    nestedDelegateProxyGroupByLowLevel: ReadonlyMap<number, number>;
    batchPredCommitments: Map<string, any>;
    sortedLoopCommitments: Map<string, any>;
    runtimeLoopDerivedCounts: Map<string, number>;
    sortedInserts: readonly { collection: string }[];
    args: readonly FunctionArgument[];
    entryArgs: readonly FunctionArgument[];
    finalArgs: readonly FunctionArgument[];
    eventDefs: readonly any[];
    runtimeEventNftLockingBytecodes: Map<string, Uint8Array>;
    timing?: (label: string) => void;
    [key: string]: any;
  },
): Promise<LoadCreateBuilderDynamicChunksResult> {
  const {
    dynamicVarInfos, valueChunkGc, onChainState, stateLayout, overrides,
    abiFunction, entryAbiFunction, lowLevelCallUtxoGroups, nestedDelegateProxyGroupByLowLevel,
    batchPredCommitments, sortedLoopCommitments, runtimeLoopDerivedCounts, sortedInserts,
    args, entryArgs, eventDefs, runtimeEventNftLockingBytecodes, timing,
  } = params;
  const executionSelfAddress = params.executionSelfAddress as Uint8Array;
  const functionName = params.functionName as string;
  const tokenContainers = params.tokenContainers as any[];
  const routeRowIndex = params.routeRowIndex as (row: any) => number;
  const selectedRowArgument = params.selectedRowArgument as (row: any, name: string) => unknown;
  const kernelJournalSettlementEntrySegments = params.kernelJournalSettlementEntrySegments as any[];
  const runtimeLoopEntrySegments = params.runtimeLoopEntrySegments as any[];
  const entryAccesses = params.entryAccesses as any;
  const dynamicWrites = params.dynamicWrites as string[];
  const activeDynamicWrites = params.activeDynamicWrites as Set<string>;
  const activeDelegateGroupIndex = params.activeDelegateGroupIndex as number | undefined;
  const externalCallUtxoGroups = params.externalCallUtxoGroups as any[];
  const entryNftLockingBytecodes = params.entryNftLockingBytecodes as Map<string, Uint8Array>;

  timing?.('dynamic-chunks-start');
  // ordered by chunkIndex. The order matters for element ops (read-modify-write): the on-chain read loop
  // reassembles from these same inputs and requires input blockSize+i to be chunk i.
  const dynamicChunkInputs: UnlockableUtxo[] = [];
  const trailingDisposalInputs: UnlockableUtxo[] = [];
  const oldDynamicChunkCounts = new Map<string, number>();
  const oldDynamicChunkCommitments = new Map<string, string[]>();
  for (const v of dynamicVarInfos) {
    const chunkAddr = getDynamicChunkAddress(host.inner, host.categoryId, v.name, v.type);
    const utxos = onChainState.dynamicChunkUtxos?.[v.name]
      ?? await host.inner.provider.getUtxos(chunkAddr);
    const chunks = utxos
      .filter((utxo: any) => utxo.token?.category === host.categoryId
        && utxo.token?.nft?.capability === 'mutable'
        && utxo.token?.nft?.commitment && utxo.token.nft.commitment.length > 0)
      .map((utxo: any) => ({ utxo, chunkIndex: parseChunkCommitment(utxo.token!.nft!.commitment).chunkIndex }))
      .sort((a: any, b: any) => a.chunkIndex - b.chunkIndex);
    oldDynamicChunkCounts.set(v.name, chunks.length);
    oldDynamicChunkCommitments.set(
      v.name, chunks.map((chunk: any) => chunk.utxo.token!.nft!.commitment),
    );
    for (const chunk of chunks) {
      const utxo = chunk.utxo as any;
      const unlocker = createDynamicChunkUnlocker(
        host.inner, overrides?.blockBase ?? 0, host.categoryId, v.name, v.type,
      );
      dynamicChunkInputs.push({ ...utxo, unlocker });
    }
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_DYNAMIC_CHUNK_ORDER === '1') {
    console.error('dynamic-chunk-input-order', JSON.stringify({
      functionName,
      dynamicWrites,
      activeDynamicWrites: [...activeDynamicWrites],
      vars: dynamicVarInfos.map((v) => ({ name: v.name, type: v.type })),
      inputs: dynamicChunkInputs.map((utxo: any) => ({
        txid: utxo.txid.slice(0, 12),
        vout: utxo.vout,
        commitment: utxo.token?.nft?.commitment,
      })),
    }));
  }

  // P5b overwrite GC: consume the OLD value chunks (same slot, old digest) of an overwritten long value so they
  // do not orphan as dust. Co-spent (destroyed) with flag=1; the covenant does not verify them (the new chunks
  // are pinned), so this is a pure reclaim. Digest-keyed filter reclaims only the exact old version.
  const consumedValueChunkGc = new Set<string>();
  for (const gc of valueChunkGc) {
    // Several journaled accesses can describe the same logical overwrite (for example, aliased message-route
    // rows). The old continuation run is disposal-only and can be consumed exactly once, so intern it by its
    // authenticated storage identity before resolving physical UTXOs.
    const gcIdentity = `${gc.collection}:${gc.slotHex.toLowerCase()}:${gc.oldDigestHex.toLowerCase()}`;
    if (consumedValueChunkGc.has(gcIdentity)) continue;
    consumedValueChunkGc.add(gcIdentity);
    const gcSlot = hexToBin(gc.slotHex);
    const gcRoot = hexToBin(gc.oldDigestHex);
    const chunkAddr = getValueChunkAddress(host.inner, host.categoryId, gc.collection, gcSlot, gcRoot);
    const oldChunks = (await host.inner.provider.getUtxos(chunkAddr)).filter((u: any) =>
      u.token?.category === host.categoryId && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0);
    for (const utxo of oldChunks) {
      trailingDisposalInputs.push({ ...utxo, unlocker:
        createValueChunkUnlocker(
          host.inner, overrides?.blockBase ?? 0, host.categoryId, gc.collection, gcSlot, gcRoot,
        ) });
    }
  }

  // Collections written by a runtime loop (`for(i<n) m[k[i]]=v[i]`): N new entry NFTs at the collection's
  // entry covenant address (N derived from the VM trace). Mirrors dynamicChunkVars (variable trailing outputs).
  // A proxy forwarder owns the physical block but the delegated implementation route owns the collection
  // semantics. `entryAbiFunction` is already the effective metadata source for fixed entry accesses above;
  // include its loop writes too or a graph-handler `mapping(K => V[]).push(...)` is funded as a generic
  // trailing placeholder rather than an entry-covenant NFT.
  const delegateRouteGroupIndex = activeDelegateGroupIndex !== undefined
    && lowLevelCallUtxoGroups[activeDelegateGroupIndex]?.compilerRoute?.abiFunction
    ? activeDelegateGroupIndex
    : lowLevelCallUtxoGroups.findIndex(
      (group, groupIndex) => group.callMode === 'delegatecall'
        && !nestedDelegateProxyGroupByLowLevel.has(groupIndex)
        && group.compilerRoute?.abiFunction,
    );
  const delegateRouteGroup = delegateRouteGroupIndex >= 0
    ? lowLevelCallUtxoGroups[delegateRouteGroupIndex] : undefined;
  const delegateProxyGroupIndex = delegateRouteGroupIndex >= 0
    ? nestedDelegateProxyGroupByLowLevel.get(delegateRouteGroupIndex) : undefined;
  const delegateStateCategoryId = delegateProxyGroupIndex === undefined
    ? host.categoryId : externalCallUtxoGroups[delegateProxyGroupIndex].categoryId;
  // A delegate route writes its proxy's entries, which bind the proxy master's lock, not the implementation's.
  const delegateStateContract = delegateProxyGroupIndex === undefined
    ? host.inner : externalCallUtxoGroups[delegateProxyGroupIndex].externalContract.inner;
  const delegateRouteAbi = delegateRouteGroup?.compilerRoute?.abiFunction;
  const delegateRouteRows = delegateRouteGroup?.compilerRoute?.rowArguments;
  const selectedRowsFor = (
    source: AbiFunction | undefined,
  ): MessageBusRuntimeAbiFunction['messageBusRowArguments'] => (
    source !== undefined && source === delegateRouteAbi && delegateRouteRows !== undefined
      ? delegateRouteRows
      : (source as MessageBusRuntimeAbiFunction | undefined)?.messageBusRowArguments
  );
  const entryRouteRows = selectedRowsFor(entryAbiFunction);
  const selectedRouteLoopMetadata = selectedMessageBusResourceMetadata([
    ...(entryRouteRows ?? []),
    ...(delegateRouteRows ?? []),
  ]);
  const selectedDelegateLoopMetadata = selectedMessageBusResourceMetadata(delegateRouteRows);
  // The route ABI publishes the union of all dispatchable handlers, not the writes of this envelope.
  // Registering an inactive collection here lets derivation seed a phantom NEW output, shifting every
  // subsequent dynamic chunk. Select each source independently so a direct caller's own loops survive
  // alongside selected delegate rows; absent row metadata retains the direct/legacy ABI behavior.
  const entryLoopWrites = [...new Set([abiFunction, entryAbiFunction, delegateRouteAbi].flatMap((source) => {
    const rows = selectedRowsFor(source);
    return rows === undefined ? source?.entryLoopWrites ?? []
      : selectedMessageBusResourceMetadata(rows).entryLoopWrites;
  }))];
  // Trailing vmap output indices are part of the covenant ABI. Fixed batches are assigned bases in
  // sortedBatchInfo order (first-access order), which can differ from state-layout declaration order. Preserve
  // that order here or two collections written out of declaration order receive each other's locking bytecode.
  const trailingCollectionSources = [
    batchPredCommitments.keys(),
    entryLoopWrites,
    sortedLoopCommitments.keys(),
    runtimeLoopDerivedCounts.keys(),
    sortedInserts.map((insert) => insert.collection),
  ] as const;
  const orderedLoopCollections = entryRouteRows !== undefined || delegateRouteRows !== undefined
    ? orderedActiveTrailingEntryCollections(entryAbiFunction?.sortedBatchInfo, ...trailingCollectionSources)
    : orderedTrailingEntryCollections(entryAbiFunction?.sortedBatchInfo, ...trailingCollectionSources);
  const localStateCollections = new Set(host.inner.stateLayout?.collections?.map((collection: any) => collection.name));
  const loopEntryVars = orderedLoopCollections.map((name) => {
    const collection = stateLayout.collections?.find((candidate) => candidate.name === name);
    const signature = selectedRouteLoopMetadata.entryLoopWriteSignatures[name]
      ?? delegateRouteAbi?.entryLoopWriteSignatures?.[name]
      ?? entryAbiFunction?.entryLoopWriteSignatures?.[name]
      ?? collection?.signature;
    const delegatedLoop = lowLevelCallUtxoGroups.some((group) => group.callMode === 'delegatecall')
      && (selectedDelegateLoopMetadata.loopCollections.includes(name)
        || delegateRouteAbi?.sortedUpsertLoopInfo?.some((info) => info.collection === name)
        || delegateRouteAbi?.sortedInsertLoopInfo?.some((info) => info.collection === name)
        || (entryAbiFunction !== abiFunction
          && (entryAbiFunction?.sortedUpsertLoopInfo?.some((info) => info.collection === name)
            || entryAbiFunction?.sortedInsertLoopInfo?.some((info) => info.collection === name))));
    return {
      collection: name,
      chunkable: signature?.includes('[])') === true,
      ...(delegatedLoop && {
        categoryId: localStateCollections.has(name) ? host.categoryId : delegateStateCategoryId,
        delegate: true,
      }),
      // Prefer the locking bytecode resolved from the effective (possibly delegate-grafted) state layout above.
      // `host.inner.artifact` is the proxy artifact and does not necessarily declare implementation collections;
      // resolving only by name against it hashes the bare name and mints NEW at a different covenant address.
      lockingBytecode: entryNftLockingBytecodes.get(name)
      ?? (delegatedLoop && delegateRouteGroup
        ? getEntryNftLockingBytecode(
          delegateStateContract,
          delegateStateCategoryId,
          signature ?? resolveCollectionSignature(delegateRouteGroup.externalContract.inner.artifact, name),
        )
        : undefined)
      ?? getEntryNftLockingBytecode(host.inner, host.categoryId, signature ?? name),
    };
  });
  // Runtime loop events and their fixed peers are planned from compiler metadata, never from a contract name
  // or storage schema. A hidden permutation carries a loop segment's exact cardinality; exact-count segments
  // preserve events around it. Repeat each resolved site list without inspecting mapping keys.
  const selectedRuntimeEventRows = (entryRouteRows?.some((row) =>
    (row.handler.runtimeLoopEvents?.length ?? 0) > 0) ? entryRouteRows : delegateRouteRows) ?? [];
  const runtimeLoopEventOutputs: Array<{
    eventSignature: string; lockingBytecode: Uint8Array; categoryId?: string; commitment?: string;
    /** Zero-based selected route row which produced this occurrence; -1 for a direct non-route call. */
    rowIndex: number;
    /** A chunked site's head; its continuation records are learned from the trace. */
    chunked?: true;
  }> = [];
  const runtimeLoopEventSegments: Array<{ rowIndex: number; offset: number; count: number }> = [];
  const runtimeLoopEffectOccurrences: Array<{
    rowIndex: number; kind: 'events' | 'transfers'; outputIndex: number;
    sequence: number; iteration: number; order: number;
  }> = [];
  const appendRuntimeEvents = async (
    source: AbiFunction,
    functionArgs: FunctionArgument[],
    sourceArtifact: Artifact,
    argumentFor: (name: string) => FunctionArgument | undefined,
    rowIndex: number,
  ): Promise<void> => {
    const runtimePredicateState = await host.hydrateExternalPredicateState(
      [
        ...(source.runtimeLoopEvents ?? []).flatMap((loop) => loop.conditions ?? [])
          .filter((condition): condition is ExternalCallExpression => condition !== null),
        ...(source.runtimeLoopEvents ?? []).flatMap((loop) => loop.arguments ?? []).flat(),
        ...(source.runtimeLoopEvents ?? []).flatMap((loop) => loop.iterationBreakCondition ?? []),
        ...(source.runtimeLoopEvents ?? []).flatMap((loop) => loop.iterationBound ?? []),
        ...(source.runtimeLoopEvents ?? []).flatMap((loop) => loop.iterationDomain
          ? [
            loop.iterationDomain.initialValue,
            loop.iterationDomain.stepValue,
            loop.iterationDomain.continueCondition,
          ] : []),
        ...(source.sortedUpsertLoopInfo ?? []).flatMap((info) => [
          info.condition, info.iterationBreakCondition,
        ]).filter((condition): condition is ExternalCallExpression => condition !== undefined),
      ],
      functionArgs,
      sourceArtifact,
      onChainState.state,
      visibleHandlerInputs(source.inputs),
      executionSelfAddress,
    );
    for (const loop of source.runtimeLoopEvents ?? []) {
      if (((loop.arguments !== undefined || loop.iterationDomain !== undefined)
        && loop.arguments?.length !== loop.eventSignatures.length)
        || (loop.conditions !== undefined && loop.conditions.length !== loop.eventSignatures.length)
        || (loop.effectOrder !== undefined && loop.effectOrder.length !== loop.eventSignatures.length)) {
        throw new Error(`Runtime event metadata for '${source.name}' does not match its event sites.`);
      }
      const repeatSource = runtimeLoopEventRepeatSource(loop);
      let iterationValues: bigint[] | undefined;
      let repeatCount = repeatSource.kind === 'fixed' ? repeatSource.count
        : repeatSource.kind === 'permutation' ? (() => {
          const permutation = argumentFor(repeatSource.parameter);
          if (!Array.isArray(permutation)) return undefined;
          if (permutation.length > RUNTIME_LOOP_EVENT_ITERATION_LIMIT) throw new Error(
            `Runtime-loop event permutation for '${source.name}' exceeds ${RUNTIME_LOOP_EVENT_ITERATION_LIMIT} iterations`,
          );
          return permutation.length;
        })()
          : (() => {
            iterationValues = runtimeLoopEventIterationValues(repeatSource.domain, (expression, bindings) => (
              host.evaluateExternalExpression(
                expression,
                functionArgs,
                sourceArtifact,
                runtimePredicateState,
                visibleHandlerInputs(source.inputs),
                undefined,
                0,
                false,
                executionSelfAddress,
                bindings,
              )
            ));
            return iterationValues.length;
          })();
      const loopInfo = loop.permutationParam === undefined ? undefined
        : source.sortedUpsertLoopInfo?.find((info) => info.varyingArrayParam === loop.permutationParam);
      if (loopInfo && (loopInfo.iterationCondition || loopInfo.iterationBreakCondition)) {
        const spec = vmapCounterPermutationSpec(loopInfo.varyingArrayParam);
        const bound = spec && argumentFor(spec.countName);
        if (!spec || (bound === undefined && !loopInfo.iterationBound)) throw new Error(
          `Runtime-loop event metadata for '${source.name}' has no source-domain bound`,
        );
        const active = loopInfo.condition ? host.evaluateExternalExpression(
          loopInfo.condition,
          functionArgs,
          sourceArtifact,
          runtimePredicateState,
          visibleHandlerInputs(source.inputs),
          undefined,
          0,
          false,
          executionSelfAddress,
        ) : true;
        if (typeof active !== 'boolean') throw new Error(
          `Could not resolve runtime loop predicate while planning events for '${source.name}'.`,
        );
        const resolvedSourceDomain = active ? host.vmapCounterDomain(
          loopInfo,
          spec,
          bound,
          functionArgs,
          sourceArtifact,
          visibleHandlerInputs(source.inputs),
          runtimePredicateState,
          executionSelfAddress,
        ) : [];
        if (!resolvedSourceDomain) throw new Error(
          `Could not resolve runtime loop bound while planning events for '${source.name}'.`,
        );
        const sourceDomain = resolvedSourceDomain;
        repeatCount = sourceDomain.length;
        if (loopInfo.iterationBreakCondition) {
          for (let iteration = 0; iteration < sourceDomain.length; iteration += 1) {
            const breaking = host.evaluateExternalExpression(
              loopInfo.iterationBreakCondition,
              functionArgs,
              sourceArtifact,
              runtimePredicateState,
              visibleHandlerInputs(source.inputs),
              undefined,
              iteration,
              false,
              executionSelfAddress,
            );
            if (typeof breaking !== 'boolean') throw new Error(
              `Could not resolve runtime loop break predicate while planning events for '${source.name}'.`,
            );
            if (breaking) { repeatCount = iteration + 1; break; }
          }
        }
      }
      if (!Number.isInteger(repeatCount) || repeatCount === undefined || repeatCount < 0) {
        throw new Error(
          `Runtime-loop event metadata for '${source.name}' has no valid repeat source`,
        );
      }
      if (loop.iterationBreakCondition) {
        for (let iteration = 0; iteration < repeatCount; iteration += 1) {
          const breaking = host.evaluateExternalExpression(
            loop.iterationBreakCondition,
            functionArgs,
            sourceArtifact,
            runtimePredicateState,
            visibleHandlerInputs(source.inputs),
            undefined,
            iteration,
            false,
            executionSelfAddress,
          );
          if (typeof breaking !== 'boolean') throw new Error(
            `Could not resolve runtime loop break predicate while planning events for '${source.name}'.`,
          );
          if (breaking) { repeatCount = iteration + 1; break; }
        }
      }
      for (let iteration = 0; iteration < repeatCount; iteration += 1) {
        for (let siteIndex = 0; siteIndex < loop.eventSignatures.length; siteIndex += 1) {
          const eventSignature = loop.eventSignatures[siteIndex];
          const iterationBindings = loop.iterationDomain && iterationValues
            ? new Map([[loop.iterationDomain.counterName, iterationValues[iteration]]])
            : undefined;
          const condition = loop.conditions?.[siteIndex];
          if (condition) {
            const active = host.evaluateExternalExpression(
              condition,
              functionArgs,
              sourceArtifact,
              runtimePredicateState,
              visibleHandlerInputs(source.inputs),
              undefined,
              iteration,
              false,
              executionSelfAddress,
              iterationBindings,
            );
            if (typeof active !== 'boolean') {
              throw new Error(
                `Could not resolve runtime event predicate for '${eventSignature}' in '${source.name}'.`,
              );
            }
            if (!active) continue;
          }
          const lockingBytecode = runtimeEventNftLockingBytecodes.get(eventSignature);
          if (!lockingBytecode) {
            throw new Error(`No locking bytecode provided for runtime-loop event: ${eventSignature}`);
          }
          let commitment: string | undefined;
          if (loop.arguments !== undefined) {
            const argumentExpressions = loop.arguments?.[siteIndex];
            const eventDefinition = eventDefs.find((candidate) => candidate.signature === eventSignature);
            if (!argumentExpressions || !eventDefinition
              || argumentExpressions.length !== eventDefinition.parameters.length) {
              throw new Error(
                `Runtime event arguments for '${eventSignature}' in '${source.name}' are unresolved or have invalid arity.`,
              );
            }
            const values = argumentExpressions.map((expression, argumentIndex) => {
              const value = host.evaluateExternalExpression(
                expression,
                functionArgs,
                sourceArtifact,
                runtimePredicateState,
                visibleHandlerInputs(source.inputs),
                undefined,
                iteration,
                false,
                executionSelfAddress,
                iterationBindings,
              );
              if (value === undefined) throw new Error(
                `Could not resolve runtime event argument ${argumentIndex} for '${eventSignature}' in '${source.name}'.`,
              );
              return value as StateValue;
            });
            const encoded = eventDefinition.parameters.length === 0
              ? Uint8Array.of(1)
              : encodeEventCommitment(
                eventDefinition.parameters,
                values,
                sourceArtifact.structs ?? sourceArtifact.stateLayout?.structs ?? stateLayout.structs,
              );
            commitment = binToHex(encoded);
          }
          const outputIndex = runtimeLoopEventOutputs.length;
          runtimeLoopEventOutputs.push({
            eventSignature, lockingBytecode, rowIndex, ...(commitment !== undefined && { commitment }),
            ...(loop.chunked && { chunked: true as const }),
          });
          if (loop.effectSequence !== undefined && loop.effectOrder?.[siteIndex] !== undefined) {
            runtimeLoopEffectOccurrences.push({
              rowIndex, kind: 'events', outputIndex,
              sequence: loop.effectSequence, iteration, order: loop.effectOrder[siteIndex],
            });
          }
        }
      }
    }
  };
  if (selectedRuntimeEventRows.length > 0) {
    for (const row of selectedRuntimeEventRows) {
      const offset = runtimeLoopEventOutputs.length;
      const rowIndex = routeRowIndex(row);
      if (rowIndex < 0) throw new Error('Message-bus runtime event row is missing from its route frame');
      const rowArtifact = delegateRouteRows?.some((candidate) => candidate === row) && delegateRouteGroup
        ? delegateRouteGroup.externalContract.inner.artifact : host.inner.artifact;
      await appendRuntimeEvents(row.handler, [...row.args], rowArtifact, (name) =>
        row.internalArgs?.[name] ?? selectedRowArgument(row, name), rowIndex);
      const count = runtimeLoopEventOutputs.length - offset;
      if (count > 0) {
        runtimeLoopEventSegments.push({ rowIndex, offset, count });
      }
    }
  } else {
    const directRuntimeEventFunction = entryAbiFunction?.runtimeLoopEvents?.length
      ? entryAbiFunction : abiFunction;
    if (directRuntimeEventFunction?.runtimeLoopEvents?.length) {
      const directRuntimeArgs = visibleHandlerInputs(directRuntimeEventFunction.inputs).map((input) => {
        const index = directRuntimeEventFunction.inputs.findIndex((candidate) => candidate.name === input.name);
        return (directRuntimeEventFunction === entryAbiFunction ? entryArgs : args)[index];
      }) as FunctionArgument[];
      const directRuntimeArtifact = directRuntimeEventFunction === delegateRouteAbi && delegateRouteGroup
        ? delegateRouteGroup.externalContract.inner.artifact : host.inner.artifact;
      await appendRuntimeEvents(directRuntimeEventFunction, directRuntimeArgs, directRuntimeArtifact, (name) => {
        const index = directRuntimeEventFunction.inputs.findIndex((input) => input.name === name);
        return index < 0 ? undefined : (directRuntimeEventFunction === entryAbiFunction ? entryArgs : args)[index];
      }, -1);
    }
  }
  // Runtime BCH transfers use the same logical counter domain as runtime events, but their recipient and
  // amount are covenant-derived later. Plan only the exact number and source-row ordering here; every output
  // starts as a harmless probe placeholder which the faithful VM trace replaces before handoff.
  const selectedRuntimeTransferRows = (entryRouteRows?.some((row) =>
    (row.handler.runtimeLoopTransfers?.length ?? 0) > 0) ? entryRouteRows : delegateRouteRows) ?? [];
  const runtimeTransferPlaceholder = encodeLockingBytecodeP2pkh(new Uint8Array(20));
  const runtimeLoopTransferOutputs: RuntimeLoopTransferOutput[] = [];
  const runtimeLoopTransferSegments: Array<{ rowIndex: number; offset: number; count: number }> = [];
  const appendRuntimeTransfers = async (
    source: AbiFunction,
    functionArgs: FunctionArgument[],
    sourceArtifact: Artifact,
    argumentFor: (name: string) => FunctionArgument | undefined,
    rowIndex: number,
  ): Promise<void> => {
    const runtimePredicateState = await host.hydrateExternalPredicateState(
      [
        ...(source.runtimeLoopTransfers ?? []).flatMap((loop) => loop.conditions ?? [])
          .filter((condition): condition is ExternalCallExpression => condition !== null),
        ...(source.sortedUpsertLoopInfo ?? []).flatMap((info) => [
          info.condition, info.iterationBreakCondition,
        ]).filter((condition): condition is ExternalCallExpression => condition !== undefined),
      ],
      functionArgs,
      sourceArtifact,
      onChainState.state,
      visibleHandlerInputs(source.inputs),
      executionSelfAddress,
    );
    for (const loop of source.runtimeLoopTransfers ?? []) {
      const permutation = argumentFor(loop.permutationParam);
      let repeatCount = Array.isArray(permutation) ? permutation.length : undefined;
      const loopInfo = source.sortedUpsertLoopInfo?.find(
        (info) => info.varyingArrayParam === loop.permutationParam,
      );
      if (loopInfo && (loopInfo.iterationCondition || loopInfo.iterationBreakCondition)) {
        const spec = vmapCounterPermutationSpec(loopInfo.varyingArrayParam);
        const bound = spec && argumentFor(spec.countName);
        if (!spec || (bound === undefined && !loopInfo.iterationBound)) throw new Error(
          `Runtime-loop transfer metadata for '${source.name}' has no source-domain bound`,
        );
        const active = loopInfo.condition ? host.evaluateExternalExpression(
          loopInfo.condition,
          functionArgs,
          sourceArtifact,
          runtimePredicateState,
          visibleHandlerInputs(source.inputs),
          undefined,
          0,
          false,
          executionSelfAddress,
        ) : true;
        if (typeof active !== 'boolean') throw new Error(
          `Could not resolve runtime loop predicate while planning transfers for '${source.name}'.`,
        );
        const sourceDomain = active ? host.vmapCounterDomain(
          loopInfo,
          spec,
          bound,
          functionArgs,
          sourceArtifact,
          visibleHandlerInputs(source.inputs),
          runtimePredicateState,
          executionSelfAddress,
        ) : [];
        if (!sourceDomain) throw new Error(
          `Could not resolve runtime loop bound while planning transfers for '${source.name}'.`,
        );
        repeatCount = sourceDomain.length;
        if (loopInfo.iterationBreakCondition) {
          for (let iteration = 0; iteration < sourceDomain.length; iteration += 1) {
            const breaking = host.evaluateExternalExpression(
              loopInfo.iterationBreakCondition,
              functionArgs,
              sourceArtifact,
              runtimePredicateState,
              visibleHandlerInputs(source.inputs),
              undefined,
              iteration,
              false,
              executionSelfAddress,
            );
            if (typeof breaking !== 'boolean') throw new Error(
              `Could not resolve runtime loop break predicate while planning transfers for '${source.name}'.`,
            );
            if (breaking) { repeatCount = iteration + 1; break; }
          }
        }
      }
      if (!Number.isInteger(repeatCount) || repeatCount === undefined || repeatCount < 0) throw new Error(
        `Runtime-loop transfer metadata for '${source.name}' has no valid repeat source`,
      );
      for (let iteration = 0; iteration < repeatCount; iteration += 1) {
        for (let siteIndex = 0; siteIndex < loop.siteCount; siteIndex += 1) {
          const condition = loop.conditions?.[siteIndex];
          if (condition) {
            const active = host.evaluateExternalExpression(
              condition,
              functionArgs,
              sourceArtifact,
              runtimePredicateState,
              visibleHandlerInputs(source.inputs),
              undefined,
              iteration,
              false,
              executionSelfAddress,
            );
            if (typeof active !== 'boolean') throw new Error(
              `Could not resolve runtime transfer predicate in '${source.name}'.`,
            );
            if (!active) continue;
          }
          const outputIndex = runtimeLoopTransferOutputs.length;
          const kind = loop.siteKinds?.[siteIndex] ?? 'bch';
          if (kind === 'token' || kind === 'nft') {
            const slot = loop.tokenContainerSlots?.[siteIndex];
            const container = slot === null || slot === undefined ? undefined
              : tokenContainers.find((candidate: any) => candidate.tokenContainerSlotIndex === slot);
            const category = container?.tokenContainerCategoryId;
            if (!category) throw new Error(
              `Runtime-loop token transfer metadata for '${source.name}' has no resolved container`,
            );
            if (kind === 'nft') {
              const nft = container?.utxo?.token?.nft;
              if (!nft) throw new Error(
                `Runtime-loop NFT transfer in '${source.name}' requires an NFT-bearing token container`,
              );
              if (nft.capability !== 'minting' && runtimeLoopTransferOutputs.some((output) =>
                output.kind === 'nft' && output.tokenContainerCategoryId === category)) {
                throw new Error(
                  `Runtime-loop NFT transfer in '${source.name}' reaches the non-minting container `
                  + `${category} more than once`,
                );
              }
              runtimeLoopTransferOutputs.push({
                kind, tokenContainerCategoryId: category,
                lockingBytecode: Uint8Array.from(runtimeTransferPlaceholder), amount: 0n,
                commitment: hexToBin(nft.commitment),
                // A minting-capability placeholder would be removed by the builder's 1:1 minting guard before
                // the trace can derive this runtime output. An immutable placeholder is valid under the same
                // minting input and remains materialized until the source-selected capability replaces it.
                capability: nft.capability === 'minting' ? 'none' : nft.capability,
              });
            } else {
              runtimeLoopTransferOutputs.push({
                kind, tokenContainerCategoryId: category,
                lockingBytecode: Uint8Array.from(runtimeTransferPlaceholder), amount: 1n,
              });
            }
          } else {
            runtimeLoopTransferOutputs.push({
              kind, lockingBytecode: Uint8Array.from(runtimeTransferPlaceholder), amount: 1000n,
            });
          }
          if (loop.effectSequence !== undefined && loop.effectOrder?.[siteIndex] !== undefined) {
            runtimeLoopEffectOccurrences.push({
              rowIndex, kind: 'transfers', outputIndex,
              sequence: loop.effectSequence, iteration, order: loop.effectOrder[siteIndex],
            });
          }
        }
      }
    }
  };
  if (selectedRuntimeTransferRows.length > 0) {
    for (const row of selectedRuntimeTransferRows) {
      const offset = runtimeLoopTransferOutputs.length;
      const rowIndex = routeRowIndex(row);
      if (rowIndex < 0) throw new Error('Message-bus runtime transfer row is missing from its route frame');
      const rowArtifact = delegateRouteRows?.some((candidate) => candidate === row) && delegateRouteGroup
        ? delegateRouteGroup.externalContract.inner.artifact : host.inner.artifact;
      await appendRuntimeTransfers(row.handler, [...row.args], rowArtifact, (name) =>
        row.internalArgs?.[name] ?? selectedRowArgument(row, name), rowIndex);
      const count = runtimeLoopTransferOutputs.length - offset;
      if (count > 0) {
        runtimeLoopTransferSegments.push({ rowIndex, offset, count });
      }
    }
  } else {
    const directRuntimeTransferFunction = entryAbiFunction?.runtimeLoopTransfers?.length
      ? entryAbiFunction : abiFunction;
    if (directRuntimeTransferFunction?.runtimeLoopTransfers?.length) {
      const directRuntimeArgs = visibleHandlerInputs(directRuntimeTransferFunction.inputs).map((input) => {
        const index = directRuntimeTransferFunction.inputs.findIndex((candidate) => candidate.name === input.name);
        return (directRuntimeTransferFunction === entryAbiFunction ? entryArgs : args)[index];
      }) as FunctionArgument[];
      const directRuntimeArtifact = directRuntimeTransferFunction === delegateRouteAbi && delegateRouteGroup
        ? delegateRouteGroup.externalContract.inner.artifact : host.inner.artifact;
      await appendRuntimeTransfers(
        directRuntimeTransferFunction,
        directRuntimeArgs,
        directRuntimeArtifact,
        (name) => {
          const index = directRuntimeTransferFunction.inputs.findIndex((input) => input.name === name);
          return index < 0
            ? undefined : (directRuntimeTransferFunction === entryAbiFunction ? entryArgs : args)[index];
        },
        -1,
      );
    }
  }
  const runtimeLoopTrailingSegments: Array<
  | { kind: 'entries'; collection: string; offset: number; count: number }
  | { kind: 'events'; offset: number; count: number }
  | { kind: 'transfers'; offset: number; count: number }
  > = [];
  if (kernelJournalSettlementEntrySegments) {
    // The compiler's final flush walks the present-record subsequence in global record-ordinal order. Settlement
    // authority may move between access streams, but it never changes that order. Keep the complete live journal
    // band contiguous before source-ordered effects; a tombstone/absence disposition contributes no output.
    runtimeLoopTrailingSegments.push(...kernelJournalSettlementEntrySegments.map((segment) => ({
      kind: 'entries' as const,
      ...segment,
    })));
  }
  const sourceOrderedRuntimeEntrySegments = kernelJournalSettlementEntrySegments
    ? [] : runtimeLoopEntrySegments;
  if (sourceOrderedRuntimeEntrySegments.length > 0 || runtimeLoopEventSegments.length > 0
    || runtimeLoopTransferSegments.length > 0) {
    const rowIndices = new Set([
      ...sourceOrderedRuntimeEntrySegments.map((segment) => segment.rowIndex),
      ...runtimeLoopEventSegments.map((segment) => segment.rowIndex),
      ...runtimeLoopTransferSegments.map((segment) => segment.rowIndex),
      ...runtimeLoopEffectOccurrences.map((occurrence) => occurrence.rowIndex),
    ]);
    for (const rowIndex of [...rowIndices].sort((left, right) => left - right)) {
      for (const segment of sourceOrderedRuntimeEntrySegments
        .filter((candidate: any) => candidate.rowIndex === rowIndex)) {
        runtimeLoopTrailingSegments.push({
          kind: 'entries', collection: segment.collection,
          offset: segment.offset, count: segment.count,
        });
      }
      const orderedEffects = runtimeLoopEffectOccurrences
        .filter((occurrence) => occurrence.rowIndex === rowIndex)
        .sort((left, right) => left.sequence - right.sequence
          || left.iteration - right.iteration || left.order - right.order);
      if (orderedEffects.length > 0) {
        for (const effect of orderedEffects) {
          const previous = runtimeLoopTrailingSegments[runtimeLoopTrailingSegments.length - 1];
          if (previous?.kind === effect.kind
            && previous.offset + previous.count === effect.outputIndex) previous.count += 1;
          else runtimeLoopTrailingSegments.push({
            kind: effect.kind, offset: effect.outputIndex, count: 1,
          });
        }
      } else {
        for (const segment of runtimeLoopEventSegments.filter((candidate: any) => candidate.rowIndex === rowIndex)) {
          runtimeLoopTrailingSegments.push({ kind: 'events', offset: segment.offset, count: segment.count });
        }
        for (const segment of runtimeLoopTransferSegments.filter((candidate: any) => candidate.rowIndex === rowIndex)) {
          runtimeLoopTrailingSegments.push({ kind: 'transfers', offset: segment.offset, count: segment.count });
        }
      }
    }
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_LOOP_ENTRIES === '1') {
    console.error('loop-entry-plan', {
      functionName,
      categoryId: host.categoryId,
      abiFunction: abiFunction?.name,
      abiEntryLoopWrites: abiFunction?.entryLoopWrites,
      entryAbiFunction: entryAbiFunction?.name,
      effectiveEntryLoopWrites: entryAbiFunction?.entryLoopWrites,
      delegateRouteAbi: delegateRouteAbi?.name,
      delegateRouteEntryLoopWrites: delegateRouteAbi?.entryLoopWrites,
      selectedRouteHandlers: [...(entryRouteRows ?? []), ...(delegateRouteRows ?? [])]
        .map((row) => row.handler.name),
      selectedRouteEntryLoopWrites: selectedRouteLoopMetadata.entryLoopWrites,
      delegateStateCategoryId,
      entryAccesses: entryAccesses?.length ?? 0,
      orderedLoopCollections,
      runtimeLoopEntrySegments,
      sortedLoopCommitmentCounts: [...sortedLoopCommitments].map(([collection, commitments]) => ({
        collection, count: commitments.length,
      })),
      loopEntryVars: loopEntryVars.map((v) => ({
        collection: v.collection,
        chunkable: v.chunkable,
        lockingBytecode: binToHex(v.lockingBytecode),
      })),
    });
  }

  // Extend the block layout with the event/transfer slots of any delegatecall'd impl. A delegate fn's event is
  timing?.('dynamic-chunks-complete');

  return {
    dynamicChunkInputs,
    trailingDisposalInputs,
    oldDynamicChunkCounts,
    oldDynamicChunkCommitments,
    loopEntryVars,
    runtimeLoopEventOutputs,
    runtimeLoopTransferOutputs,
    runtimeLoopTrailingSegments,
    delegateRouteGroup,
  };
}
