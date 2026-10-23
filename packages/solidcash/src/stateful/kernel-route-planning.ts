/**
 * Kernel delegate, kernel entry-journal and message-bus route planning helpers.
 *
 * Extracted from `StatefulContract.ts`: these are pure, artifact-driven planners for the kernel and message-bus
 * calling conventions, kept here so the core stateful class no longer carries the whole plugin surface. The class
 * re-exports them for the public `@solidcash/solidcash/stateful` barrel.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  type AbiFunction, type AbiInput, type Artifact, type EntryAccessAbi, type KernelJournalDispositionsAbi,
  type TokenContainerTransferSiteAbi,
} from '@solidcash/utils';
import { type FunctionArgument } from '../Argument.js';
import type { RouteExpressionKeyRow } from './StatefulContract.js';
import {
  KERNEL_ENTRY_JOURNAL_MAX_RECORDS,
  KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS,
  kernelEntryJournalRecordSegmentIndex,
  kernelEntryJournalRecordSegmentName,
  encodeKernelEntryJournalRecordSegment,
  encodeKernelEntryJournalAccesses,
  segmentKernelEntryJournalRecords,
  validateKernelEntryJournalRecordSegmentSlots,
  kernelEntryJournalReadCarrierCapabilityCovers,
  type KernelEntryJournalReadCarrierCapability,
} from './KernelEntryJournal.js';
import { resolveKernelDelegateForwardingTarget, resolveKernelDelegatePromotion } from './KernelDelegateForwarding.js';

export const KERNEL_JOURNAL_ACCESS_STREAMS = '__internal__kernelJournalAccessStreams';
export const KERNEL_JOURNAL_RECORDS = '__internal__kernelJournalRecords';

export function resolvePreparedKernelDelegateExecution(input: {
  proxyFunction: Pick<AbiFunction, 'name' | 'delegateForwarding'>;
  callIndex: number;
  proxyParameters: readonly FunctionArgument[];
  proxyConstructorArgs: readonly FunctionArgument[];
  proxyLockingBytecode: string;
  stateCategory: string;
  implementationArtifact: Artifact;
  implementationLockingBytecode: string;
  requestedFunctionName: string;
  requestedArgs: readonly FunctionArgument[];
}): ReturnType<typeof resolveKernelDelegatePromotion> | undefined {
  if (input.proxyFunction.delegateForwarding?.callIndex !== input.callIndex) return undefined;
  return resolveKernelDelegatePromotion({
    forwarding: input.proxyFunction.delegateForwarding,
    proxyParameters: input.proxyParameters,
    proxyConstructorArgs: input.proxyConstructorArgs,
    proxyLockingBytecode: input.proxyLockingBytecode,
    stateCategory: input.stateCategory,
    implementation: {
      artifact: input.implementationArtifact,
      lockingBytecode: input.implementationLockingBytecode,
    },
    requestedFunctionName: input.requestedFunctionName,
    requestedArgs: input.requestedArgs,
  });
}

/**
 * Bind a promoted delegate execution to its exact logical ABI owner.
 *
 * A compiler route and its logical handler can have equally plausible argument counts. Once forwarding promotion
 * has authenticated the implementation selector, nested calls must resolve against that handler and its decoded
 * arguments rather than rediscovering a frame by function name or arity.
 */
export function resolvePreparedKernelDelegateOwnerFrame(input: {
  execution: NonNullable<ReturnType<typeof resolveKernelDelegatePromotion>>;
  implementationAbi: readonly AbiFunction[];
}): { abiFunction: AbiFunction; args: FunctionArgument[] } {
  const selector = input.execution.selector.toLowerCase();
  const matches = input.implementationAbi.filter((candidate) => (
    candidate.selector?.toLowerCase() === selector
    && candidate.name === input.execution.functionName
  ));
  if (matches.length !== 1) {
    throw new Error(
      `Promoted delegate selector ${selector} does not identify exactly one logical implementation handler.`,
    );
  }
  const abiFunction = matches[0]!;
  const visibleInputs = abiFunction.inputs.filter((candidate) => !candidate.name.startsWith('__internal__'));
  if (visibleInputs.length !== input.execution.args.length) {
    throw new Error(
      `Promoted delegate selector ${selector} decoded ${input.execution.args.length} arguments, `
      + `but its logical implementation handler declares ${visibleInputs.length}.`,
    );
  }
  return { abiFunction, args: [...input.execution.args] };
}

type KernelDelegateForwardingGroupIdentity = {
  callMode?: string;
  externalContract: { inner: { lockingBytecode: string } };
  masterUtxo?: unknown;
};

/**
 * Select the one physical executor committed by a compiler-authored forwarding edge.
 *
 * Candidate order and application names are deliberately irrelevant. The caller scopes candidates to the
 * forwarding function's physical owner; duplicate bytecode within that scope remains ambiguous until the graph
 * carries an owner-scoped callsite identity and must fail closed.
 */
export function selectKernelDelegateForwardingGroupIndex(input: {
  forwarding: unknown;
  encodedProxyConstructorArgs: readonly FunctionArgument[];
  groups: readonly KernelDelegateForwardingGroupIdentity[];
  candidateIndexes?: readonly number[];
}): number {
  const target = resolveKernelDelegateForwardingTarget(
    input.forwarding, input.encodedProxyConstructorArgs,
  );
  const candidateIndexes = input.candidateIndexes
    ?? input.groups.map((_, index) => index);
  const matching = candidateIndexes.filter((index) => {
    const group = input.groups[index];
    if (!group || group.callMode !== 'delegatecall') return false;
    const contractLock = group.externalContract.inner.lockingBytecode.toLowerCase();
    const generatedLock = (group.masterUtxo as {
      unlocker?: { generateLockingBytecode(): Uint8Array };
    } | undefined)?.unlocker?.generateLockingBytecode();
    if (generatedLock && binToHex(generatedLock) !== contractLock) {
      throw new Error(`Delegate executor group ${index} has inconsistent physical locking bytecode`);
    }
    return contractLock === target.lockingBytecode;
  });
  if (matching.length === 0) {
    throw new Error('Compiler-authenticated delegate forwarding target is not materialized');
  }
  if (matching.length !== 1) {
    throw new Error('Compiler-authenticated delegate forwarding target is ambiguous');
  }
  return matching[0]!;
}

export function defaultInternalFunctionArg(input: { name: string; type?: string }): FunctionArgument {
  const { name, type = '' } = input;
  if (kernelEntryJournalRecordSegmentIndex(name) !== undefined) {
    return encodeKernelEntryJournalRecordSegment([]);
  }
  if (name === KERNEL_JOURNAL_ACCESS_STREAMS || name === KERNEL_JOURNAL_RECORDS) return [];
  if (name.includes('Selector') || type === 'bytes4') return new Uint8Array(4);
  if (name.includes('Category') || name.includes('BatchSlot')
    || name.includes('BatchNext') || type === 'bytes32') return new Uint8Array(32);
  if (name.includes('valueWitness') || type === 'bytes'
    || (type.startsWith('bytes') && type !== 'bytes4' && type !== 'bytes32')) return new Uint8Array();
  if (name.includes('PredOut')) return -2n;
  if (name.includes('Return') || name.includes('Proof')
    || name.includes('AnchorIdx')
    || name.includes('OutputIdx')) return -1n;
  if (type === 'bool') return false;
  return 0n;
}

/** Materialize one compiler-owned ABI argument without shifting already-populated trailing witnesses. */
export function materializeInternalFunctionArgument(
  args: readonly FunctionArgument[],
  inputs: readonly { name: string; type?: string }[],
  name: string,
  value: FunctionArgument,
): FunctionArgument[] {
  const position = inputs.findIndex((input) => input.name === name);
  if (position < 0) return [...args];
  if (!inputs[position].name.startsWith('__internal__')) {
    throw new Error(`Cannot materialize non-internal ABI argument '${name}'.`);
  }
  const materialized = [...args];
  while (materialized.length <= position) {
    const pending = inputs[materialized.length];
    if (!pending?.name.startsWith('__internal__')) {
      throw new Error(
        `Cannot materialize '${name}' before missing visible ABI argument '${pending?.name ?? materialized.length}'.`,
      );
    }
    materialized.push(defaultInternalFunctionArg(pending));
  }
  materialized[position] = value;
  return materialized;
}

export interface KernelJournalRecordSegmentWitnesses {
  /** Stable compiler-owned slot names in global segment-index order, including trailing empty capacity. */
  slots: ReadonlyArray<{ name: string; inputIndex: number; carrier: Uint8Array }>;
}

/** Enforce the protocol-wide record budget across every independently planned collection/stream group. */
export function assertKernelJournalRecordBudget(recordCounts: readonly number[]): number {
  if (recordCounts.some((count) => !Number.isSafeInteger(count) || count < 0)) {
    throw new Error('Kernel entry journal record counts must be non-negative safe integers.');
  }
  const total = recordCounts.reduce((sum, count) => sum + count, 0);
  if (!Number.isSafeInteger(total) || total > KERNEL_ENTRY_JOURNAL_MAX_RECORDS) {
    throw new Error(
      `Kernel entry journal has ${total} records across all streams, exceeding the protocol cap of `
      + `${KERNEL_ENTRY_JOURNAL_MAX_RECORDS}.`,
    );
  }
  return total;
}

/**
 * Bind a global journal record vector to the finite, compiler-published segment slots of one ABI function.
 * Slot capacity comes exclusively from the ABI. Every unused trailing slot receives the canonical empty array.
 */
export function kernelJournalRecordSegmentWitnesses(
  inputs: readonly Pick<AbiInput, 'name' | 'type'>[],
  encodedRecords: readonly Uint8Array[],
): KernelJournalRecordSegmentWitnesses {
  const discovered = inputs.flatMap((input, inputIndex) => {
    const segmentIndex = kernelEntryJournalRecordSegmentIndex(input.name);
    if (segmentIndex === undefined) return [];
    if (segmentIndex >= KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS) {
      throw new Error(
        `Kernel journal segment input '${input.name}' exceeds the protocol cap of `
        + `${KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS} slots.`,
      );
    }
    if (input.type !== 'bytes') {
      throw new Error(`Kernel journal segment input '${input.name}' must have type bytes.`);
    }
    return [{ name: input.name, inputIndex, segmentIndex }];
  });
  const byIndex = new Map<number, (typeof discovered)[number]>();
  for (const slot of discovered) {
    if (byIndex.has(slot.segmentIndex)) {
      throw new Error(`Kernel journal segment slot ${slot.segmentIndex} is published more than once.`);
    }
    byIndex.set(slot.segmentIndex, slot);
  }
  for (let segmentIndex = 0; segmentIndex < discovered.length; segmentIndex += 1) {
    if (!byIndex.has(segmentIndex)) {
      throw new Error(`Kernel journal segment slots must be contiguous from 0; missing slot ${segmentIndex}.`);
    }
  }
  // No published slots means the caller may still use the bounded monolithic compatibility input.
  if (discovered.length === 0) return { slots: [] };
  const segments = segmentKernelEntryJournalRecords(encodedRecords);
  if (segments.length > discovered.length) {
    throw new Error(
      `Kernel entry journal requires ${segments.length} carrier segments, but the compiler published `
      + `${discovered.length} segment slots.`,
    );
  }
  const rawSlots = Array.from({ length: discovered.length }, (_unused, segmentIndex) =>
    segments[segmentIndex] ?? []);
  validateKernelEntryJournalRecordSegmentSlots(
    rawSlots, segments.length,
    { expectedRecordCount: encodedRecords.length, transportOnly: true },
  );
  const slots = Array.from({ length: discovered.length }, (_unused, segmentIndex) => {
    const slot = byIndex.get(segmentIndex)!;
    return {
      name: kernelEntryJournalRecordSegmentName(segmentIndex),
      inputIndex: slot.inputIndex,
      carrier: encodeKernelEntryJournalRecordSegment(rawSlots[segmentIndex]),
    };
  });
  return { slots };
}

/** Build the canonical empty access vector for one handler's compiler-published stream ordinal space. */
export function kernelJournalAccessStreamPlaceholders(handler: Pick<AbiFunction, 'name' | 'inputs'
| 'sortedUpsertLoopInfo'>): Uint8Array[] {
  if (!handler.inputs.some((input) => input.name === KERNEL_JOURNAL_ACCESS_STREAMS)) return [];
  const infos = handler.sortedUpsertLoopInfo ?? [];
  const ordinals = infos.map((info) => info.journalAccessStreamIndex);
  const expected = new Set(Array.from({ length: infos.length }, (_unused, index) => index));
  if (ordinals.length !== expected.size
    || ordinals.some((ordinal) => !Number.isSafeInteger(ordinal) || !expected.delete(ordinal))) {
    throw new Error(`Kernel handler '${handler.name}' has a non-canonical journal access stream ordinal space`);
  }
  return [...infos]
    .sort((left, right) => left.journalAccessStreamIndex - right.journalAccessStreamIndex)
    .map((info) => {
      if (!/^[0-9a-f]{40}$/i.test(info.collectionHash)) {
        throw new Error(
          `Kernel handler '${handler.name}' has no canonical collection hash for journal stream `
          + `${info.journalAccessStreamIndex}`,
        );
      }
      return encodeKernelEntryJournalAccesses(hexToBin(info.collectionHash), []);
    });
}

export interface SelectedKernelJournalStream {
  /** Stable ABI identity of the selected handler which owns this stream. */
  handler: Pick<AbiFunction, 'selector' | 'inputs'>;
  /** Compiler-owned ordinal within that handler's compact journal stream vector. */
  journalAccessStreamIndex: number;
}

/**
 * Whether duplicate physical proof discovery belongs to the authenticated carrier planner.
 *
 * Read occurrences may intentionally authenticate the same present entry or absence predecessor. Once the
 * compiler route has transferred the complete journal batch to deferred materialization, the global physical
 * planner owns that deduplication. Mutations and every legacy/direct path retain the established fail-closed
 * duplicate-input checks.
 */
export function kernelReadCarrierOwnsDuplicateProof(
  deferRuntimeJournalMaterialization: boolean,
  operation: string,
): boolean {
  return deferRuntimeJournalMaterialization && operation === 'read';
}

export type SelectedKernelJournalHandler = Pick<AbiFunction,
'selector' | 'inputs' | 'sortedUpsertLoopInfo' | 'entryAccesses' | 'entryLoopWrites'
| 'sortedInsertLoops' | 'sortedInsertLoopInfo' | 'sortedBatchInfo' | 'collectionIterations'>;

/**
 * Decide physical read-carrier ownership once for a complete selected batch.
 *
 * A route-scoped capability may be present while the concrete envelope selects unrelated handlers. In that case
 * the established legacy materializer remains authoritative. If the capability covers any selected stream, it
 * must cover every selected stream and every covered handler must expose the compact stream carrier consumed by
 * the route. This prevents a transaction from mixing legacy and dense physical ownership within one batch.
 *
 * Callers must run this preflight before discovering UTXOs or retaining materialization intents.
 */
export function shouldDeferKernelJournalMaterialization(
  capability: KernelEntryJournalReadCarrierCapability | undefined,
  selectedStreams: readonly SelectedKernelJournalStream[],
): boolean {
  if (!capability || selectedStreams.length === 0) return false;
  const covered = selectedStreams.map(({ handler, journalAccessStreamIndex }) => (
    kernelEntryJournalReadCarrierCapabilityCovers(
      capability, handler.selector, journalAccessStreamIndex,
    )
  ));
  const coveredCount = covered.filter(Boolean).length;
  if (coveredCount === 0) return false;
  if (coveredCount !== selectedStreams.length) {
    throw new Error(
      'Compiler internal-read-carrier capability covers only part of the selected runtime journal batch; '
      + 'refusing mixed legacy and carrier materialization.',
    );
  }
  for (const { handler } of selectedStreams) {
    if (!handler.inputs.some((input) => input.name === KERNEL_JOURNAL_ACCESS_STREAMS)) {
      throw new Error(
        'Compiler internal-read-carrier capability selected a runtime loop without a compact journal access stream; '
        + 'refusing mixed legacy and carrier materialization.',
      );
    }
  }
  return true;
}

/**
 * Select one physical runtime-journal mode for a complete authenticated batch and refuse collection aliases
 * which the current carrier protocol cannot isolate.
 *
 * Compact journal streams are transaction-wide: once any selected stream uses the route-owned carrier, every
 * selected compact stream must use it. A handler without a compact journal is otherwise free to coexist, but its
 * eager/fixed/classic collection effects must not touch a collection whose physical inputs and outputs have been
 * transferred to the deferred final flush. There is no published eager/carrier isolation proof in protocol v1,
 * so an exact collection-name collision fails closed.
 */
export function shouldDeferKernelJournalBatchMaterialization(
  capability: KernelEntryJournalReadCarrierCapability | undefined,
  selectedHandlers: readonly SelectedKernelJournalHandler[],
): boolean {
  const selectedStreams = selectedHandlers.flatMap((handler) => (
    (handler.sortedUpsertLoopInfo ?? []).map((info) => ({
      handler,
      journalAccessStreamIndex: info.journalAccessStreamIndex,
    }))
  ));
  const selectedSelectors = new Set(selectedHandlers.map((handler) => handler.selector));
  const selectedCapabilityScopes = capability?.scopes?.filter((scope) => (
    selectedSelectors.has(scope.handlerSelector)
  )) ?? [];
  if (selectedCapabilityScopes.length > 0) {
    const selectedStreamKeys = new Set(selectedStreams.map(({ handler, journalAccessStreamIndex }) => (
      `${handler.selector}:${journalAccessStreamIndex}`
    )));
    if (selectedCapabilityScopes.some((scope) => !selectedStreamKeys.has(
      `${scope.handlerSelector}:${scope.journalAccessStreamIndex}`,
    ))) {
      throw new Error(
        'Compiler internal-read-carrier capability selects a runtime journal stream absent from handler metadata.',
      );
    }
  }
  const deferred = shouldDeferKernelJournalMaterialization(capability, selectedStreams);
  if (!deferred) return false;

  const protectedCollections = new Set(selectedHandlers.flatMap((handler) => (
    (handler.sortedUpsertLoopInfo ?? []).map((info) => info.collection)
  )));
  const eagerCollections = new Set(selectedHandlers.flatMap((handler) => [
    ...(handler.entryAccesses ?? []).map((access) => access.collection),
    ...(handler.entryLoopWrites ?? []),
    ...(handler.sortedInsertLoops ?? []),
    ...(handler.sortedInsertLoopInfo ?? []).map((info) => info.collection),
    ...(handler.sortedBatchInfo ?? []).map((info) => info.collection),
    ...(handler.collectionIterations ?? []).map((info) => info.collection),
  ]));
  const collisions = [...protectedCollections].filter((collection) => eagerCollections.has(collection));
  if (collisions.length > 0) {
    throw new Error(
      'Compiler internal-read-carrier capability cannot share deferred collection(s) '
      + `${collisions.sort().map((collection) => `'${collection}'`).join(', ')} with eager batch accesses; `
      + 'protocol v1 publishes no exact physical-isolation proof.',
    );
  }
  return true;
}

export interface KernelJournalEagerOutputOccurrence {
  handlerSelector: string;
  journalAccessStreamIndex: number;
  collection: string;
  offset: number;
}

export interface AuthenticatedKernelJournalDispositionPlan {
  deferRuntimeJournalMaterialization: boolean;
  eagerOutputPlan: Array<{ eagerOutputOrdinal: number; collection: string; offset: number }>;
}

/**
 * Consume only explicit compiler dispositions for one selected handler chain.
 *
 * Collection metadata and runtime intent shape never select ownership here. They provide physical locations only
 * after an authenticated `eager-journal` stream has selected them. Carrier and eager streams cannot coexist in
 * one chain until the route publishes and verifies a cross-mode cursor/isolation protocol.
 */
export function planAuthenticatedKernelJournalDispositionChain(
  manifest: KernelJournalDispositionsAbi,
  selectedHandlers: readonly SelectedKernelJournalHandler[],
  eagerOutputs: readonly KernelJournalEagerOutputOccurrence[],
): AuthenticatedKernelJournalDispositionPlan {
  const selectedScopes = selectedHandlers.map((handler, handlerIndex) => {
    const selector = handler.selector;
    if (!selector || !/^[0-9a-f]{8}$/.test(selector)) {
      throw new Error(`kernel journal selected handler ${handlerIndex} has no canonical selector`);
    }
    const scope = manifest.handlers.find((candidate) => candidate.selectorHex === selector);
    if (!scope) throw new Error(`kernel journal disposition manifest has no selected handler ${selector}`);
    const ordinals = (handler.sortedUpsertLoopInfo ?? []).map((info) => info.journalAccessStreamIndex);
    if (ordinals.length !== scope.streams.length
      || ordinals.some((ordinal, index) => ordinal !== scope.streams[index]?.journalAccessStreamIndex)) {
      throw new Error(`kernel journal disposition handler ${selector} disagrees with selected stream metadata`);
    }
    return scope;
  });
  const modes = new Set(selectedScopes.map((scope) => scope.mode));
  if (modes.has('carrier') && modes.has('eager-journal')) {
    throw new Error('kernel journal selected handler chain mixes carrier and eager-journal dispositions');
  }
  const selectedEagerStreams = new Set(selectedScopes.flatMap((scope) => scope.streams
    .filter((stream) => stream.disposition === 'eager-journal')
    .map((stream) => `${scope.selectorHex}:${stream.journalAccessStreamIndex}`)));
  const locations = new Set<string>();
  const eagerOutputPlan = eagerOutputs.map((output, eagerOutputOrdinal) => {
    const stream = `${output.handlerSelector}:${output.journalAccessStreamIndex}`;
    if (!selectedEagerStreams.has(stream)) {
      throw new Error(`kernel journal eager output ${eagerOutputOrdinal} has no selected eager-journal stream`);
    }
    if (!output.collection || !Number.isSafeInteger(output.offset) || output.offset < 0) {
      throw new Error(`kernel journal eager output ${eagerOutputOrdinal} has an invalid physical location`);
    }
    const location = `${output.collection}\0${output.offset}`;
    if (locations.has(location)) {
      throw new Error(`kernel journal eager output plan repeats physical location ${output.collection}[${output.offset}]`);
    }
    locations.add(location);
    return { eagerOutputOrdinal, collection: output.collection, offset: output.offset };
  });
  if (!modes.has('eager-journal') && eagerOutputPlan.length > 0) {
    throw new Error('kernel journal non-eager handler chain cannot publish eager outputs');
  }
  return { deferRuntimeJournalMaterialization: modes.has('carrier'), eagerOutputPlan };
}

/** Bind SDK-only row arguments to the selector sequence already authenticated by the batch envelope. */
export function assertKernelReadCarrierAuthenticatedRows(
  carrierMode: boolean,
  authenticatedSelectors: readonly string[],
  rows: readonly { handler: Pick<AbiFunction, 'selector'> }[] | undefined,
): void {
  if (!carrierMode) return;
  if (!rows || rows.length !== authenticatedSelectors.length
    || rows.some((row, index) => row.handler.selector !== authenticatedSelectors[index])) {
    throw new Error(
      'Compiler internal-read-carrier batch requires exact row metadata for every authenticated selector.',
    );
  }
}

export type GraphBlockhashSelection = {
  readKey: string;
  slotOrdinal: number;
  rowArgs: FunctionArgument[];
  handler: AbiFunction;
};

export type GraphEcrecoverCall = readonly [
  FunctionArgument | undefined, FunctionArgument | undefined,
  FunctionArgument | undefined, FunctionArgument | undefined,
];

export type MessageBusRuntimeAbiFunction = AbiFunction & {
  /** Published convention of the route from which this runtime ABI was narrowed. */
  messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
  graphBlockhashSelections?: GraphBlockhashSelection[];
  graphEcrecoverCalls?: GraphEcrecoverCall[];
  /** Operations selected for each fixed route entry slot in this concrete envelope. Runtime-only route narrowing. */
  messageBusActiveEntryOperations?: ReadonlyMap<number, readonly string[]>;
  /** Direct handler recipes selected for each route entry lane. */
  messageBusActiveEntryRecipes?: ReadonlyMap<number, readonly {
    rowIndex: number;
    access: EntryAccessAbi;
    args: FunctionArgument[];
    inputs: AbiFunction['inputs'];
  }[]>;
  /** Collections written by the handlers selected in this concrete envelope. Runtime-only route narrowing. */
  messageBusActiveWriteCollections?: readonly string[];
  /** Typed rows selected in this concrete envelope. Runtime-only; used for exact computed-value planning. */
  messageBusRowArguments?: readonly RouteExpressionKeyRow[];
  /** Direct preimages selected from authenticated message-bus rows. */
  messageBusKeccakPreimages?: readonly (Uint8Array | null)[];
  /** Fixed token effects selected by a concrete envelope, retaining sparse graph-frame coordinates. */
  messageBusTokenContainerTransferPlan?: readonly {
    args: readonly FunctionArgument[];
    handler: AbiFunction;
    site: TokenContainerTransferSiteAbi;
    outputSlot: number;
  }[];
  /** The atomic composer owns this route's absolute input layout. Runtime-only; never serialized in artifacts. */
  messageBusGraphExecution?: true;
};

/** Runtime resources selected by a concrete message-bus envelope. The published route ABI describes the
 * bounded union of every eligible handler, while mutating transaction resources follow only authenticated rows. */
export function selectedMessageBusResourceMetadata(
  rows: readonly { handler: AbiFunction }[] | undefined,
): {
    entryLoopWrites: readonly string[];
    entryLoopWriteSignatures: Readonly<Record<string, string>>;
    loopCollections: readonly string[];
    dynamicReads: readonly string[];
    dynamicWrites: readonly string[];
  } {
  const entryLoopWrites = new Set<string>();
  const entryLoopWriteSignatures: Record<string, string> = {};
  const loopCollections = new Set<string>();
  const dynamicReads = new Set<string>();
  const dynamicWrites = new Set<string>();
  for (const { handler } of rows ?? []) {
    for (const collection of handler.entryLoopWrites ?? []) {
      entryLoopWrites.add(collection);
      loopCollections.add(collection);
    }
    for (const collection of handler.sortedInsertLoops ?? []) loopCollections.add(collection);
    for (const info of handler.sortedInsertLoopInfo ?? []) loopCollections.add(info.collection);
    for (const info of handler.sortedUpsertLoopInfo ?? []) loopCollections.add(info.collection);
    for (const variable of handler.dynamicReads ?? []) dynamicReads.add(variable);
    for (const variable of handler.dynamicWrites ?? []) dynamicWrites.add(variable);
    for (const [collection, signature] of Object.entries(handler.entryLoopWriteSignatures ?? {})) {
      const previous = entryLoopWriteSignatures[collection];
      if (previous !== undefined && previous !== signature) {
        throw new Error(`Selected message-bus handlers disagree on collection signature for '${collection}'`);
      }
      entryLoopWriteSignatures[collection] = signature;
    }
  }
  return {
    entryLoopWrites: [...entryLoopWrites],
    entryLoopWriteSignatures,
    loopCollections: [...loopCollections],
    dynamicReads: [...dynamicReads],
    dynamicWrites: [...dynamicWrites],
  };
}

/** Move route-owned dynamic inputs from executor-relative provisional slots to the state owner's published
 * trailing band. The displaced balanced funders retain the provisional positions, preserving total block width. */
export function anchorRoutedDynamicResourcesAtOwner<T extends { token?: unknown }>(
  blockInputs: readonly T[],
  resources: readonly { blockSlot: number; name: string }[],
  executorOffset: number,
): T[] {
  const anchored = [...blockInputs];
  for (const resource of resources) {
    const shiftedSlot = resource.blockSlot + executorOffset;
    const destination = anchored[resource.blockSlot];
    const source = anchored[shiftedSlot];
    if (!source) {
      throw new Error(
        `Nested dynamic state '${resource.name}' has no provisional routed slot ${shiftedSlot}`,
      );
    }
    if (destination?.token) {
      throw new Error(
        `Nested dynamic state '${resource.name}' overlaps a fixed routed resource at `
        + `block slot ${resource.blockSlot}`,
      );
    }
    anchored[resource.blockSlot] = source;
    anchored[shiftedSlot] = destination;
  }
  return anchored;
}

/** A compiler route needs the physical entry ABI only when an actual wrapper entry point carries it. Synthetic
 * routes live exclusively in message-bus metadata, so the absence of a same-named physical ABI is not a wrapper. */
export function compilerRouteUsesPhysicalWrapper(
  compilerRouteSelector: Uint8Array | undefined,
  physicalAbiFunction: AbiFunction | undefined,
  effectiveAbiFunction: AbiFunction | undefined,
): boolean {
  return compilerRouteSelector !== undefined
    && physicalAbiFunction !== undefined
    && effectiveAbiFunction !== undefined
    && physicalAbiFunction !== effectiveAbiFunction;
}

/** Rebase compiler-route proof offsets when an implementation block is embedded after a proxy's state prefix.
 * Batch proof witnesses are relative to the authenticated state owner, unlike ordinary implementation block slots
 * which are relative to the executor. Negative sentinels and output-relative witnesses are intentionally unchanged. */
export function rebaseRoutedBatchProofOffsets(
  internalArgs: Readonly<Record<string, FunctionArgument>>,
  executorOffset: number,
): Record<string, FunctionArgument> {
  if (executorOffset === 0) return { ...internalArgs };
  const delta = BigInt(executorOffset);
  return Object.fromEntries(Object.entries(internalArgs).map(([name, value]) => [
    name,
    /^__internal__vmapBatchProof_\d+$/.test(name) && typeof value === 'bigint' && value >= 0n
      ? value + delta : value,
  ]));
}
