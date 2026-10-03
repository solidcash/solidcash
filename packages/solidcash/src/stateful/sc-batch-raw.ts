/**
 * phase-boundary extract: SC class-body extract — message-bus `_batchRaw` envelope assembly.
 * Host factories construct StatefulFunctionCall instances to avoid a circular import.
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  decodePushdataValue,
  type AbiFunction,
  type Artifact,
  type EntryAccessAbi,
  type ExternalCallExpression,
  type FixedBchTransferAbi,
  type SortedUpsertLoopAbi,
  type TokenContainerTransferSiteAbi,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { PreparedAtomicMessageBusCall } from '../message-bus/compose-prepared-invocation.js';
import { hasCanonicalBatchBlobLineage } from '../message-bus/internal-batch-authority.js';
import { evaluateFixedEffectPredicate } from '../message-bus/message-bus.js';
import {
  allowsWriteUnderExecutionContext,
  activeOrdinalsUnderContext,
  buildKernelExecutionContext,
  executionContextJournalKey,
  registerExecutionContextOnSettlement,
} from '../message-bus/execution-context.js';
import {
  filterEmitsUnderPathEffectSchedule,
  filterTransfersUnderPathEffectSchedule,
  pathEffectActivationEnvironmentFromArgs,
  type PublishedPathEffectSchedule,
} from '../message-bus/path-effect-schedule.js';
import { settlement } from './value-chunk-persist.js';
import { peekBuildId } from './buildSequence.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  assertKernelReadCarrierAuthenticatedRows,
  KERNEL_JOURNAL_ACCESS_STREAMS,
  KERNEL_JOURNAL_RECORDS,
  kernelJournalAccessStreamPlaceholders,
  shouldDeferKernelJournalBatchMaterialization,
} from './kernel-journal-helpers.js';
import {
  kernelEntryJournalReadCarrierCapabilityFromArtifact,
  kernelEntryJournalRecordSegmentIndex,
} from './KernelEntryJournal.js';
import { authenticateKernelReadCarrierRoute } from './kernel-read-carrier-route.js';
import type { ResolvedLogicalIdentity } from './logical-identity.js';
import {
  entryAccessAt,
  visibleHandlerInputs,
  type RouteExpressionKeyRow,
} from './route-expression-key.js';

/** Apply route-published dynamic metadata to one callable row without aliasing selectorless handlers. */
export function mergePublishedMessageBusHandlerMetadata(
  callable: AbiFunction,
  publishedHandlers: readonly AbiFunction[],
): AbiFunction {
  const published = callable.selector !== undefined
    ? publishedHandlers.find((handler) => handler.selector?.toLowerCase() === callable.selector?.toLowerCase())
    : publishedHandlers.find((handler) => handler.name === callable.name);
  // Keep the artifact ABI object itself when there is no published metadata to add. Carrier-route
  // authentication deliberately checks this identity before trusting runtime row metadata.
  if (published === undefined || (published.dynamicReads === undefined
    && published.dynamicWrites === undefined)) return callable;
  return {
    ...callable,
    ...(published.dynamicReads !== undefined && { dynamicReads: published.dynamicReads }),
    ...(published.dynamicWrites !== undefined && { dynamicWrites: published.dynamicWrites }),
  };
}

export interface VmapCounterPermutationSpec {
  countName: string;
  boundOffset: bigint;
  postTest: boolean;
  start: bigint;
  step: bigint;
  exactBound?: boolean;
}

const VMAP_RUNTIME_INPUT_COUNT_PREFIX = '__internal__vmapRuntimeInputCount_';
const VMAP_RUNTIME_OUTPUT_COUNT_PREFIX = '__internal__vmapRuntimeOutputCount_';

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
  /** Physical route slots whose selected direct handlers use fixed sorted-batch geometry. */
  messageBusActiveSortedBatchSlots?: ReadonlySet<number>;
  /** Collections written by the handlers selected in this concrete envelope. Runtime-only route narrowing. */
  messageBusActiveWriteCollections?: readonly string[];
  /** Typed rows selected in this concrete envelope. Runtime-only; used for exact computed-value planning. */
  messageBusRowArguments?: readonly RouteExpressionKeyRow[];
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

const VMAP_COUNTER_PERM_PREFIX = '__internal__vmapCounterPerm_';
const VMAP_COUNTER_OLD_PREFIX = '__internal__vmapCounterOld_';
const VMAP_COUNTER_VALUE_PREFIX = '__internal__vmapCounterValue_';
const VMAP_COUNTER_PREFIX_COUNT_PREFIX = '__internal__vmapCounterPrefixCount_';
const VMAP_COUNTER_SOURCE_INDEX_PREFIX = '__internal__vmapCounterSourceIndex_';
const VMAP_COUNTER_INPUT_COUNT_PREFIX = '__internal__vmapCounterInputCount_';
const VMAP_COUNTER_OUTPUT_COUNT_PREFIX = '__internal__vmapCounterOutputCount_';

export function vmapCounterPermutationSpec(name: string): VmapCounterPermutationSpec | undefined {
  const decodeSigned = (component: string): bigint => (
    component === 'runtime_p' ? 1n
      : component === 'runtime_n' ? -1n
        : component.startsWith('n') ? -BigInt(component.slice(1)) : BigInt(component.slice(1))
  );
  const range = name.match(
    /^__internal__vmapCounterPerm_(.+)_\d+_from_([pn]\d+)_step_([pn]\d+|runtime_[pn])(_post)?$/,
  );
  const affine = name.match(
    /^__internal__vmapCounterPerm_(.+)_\d+_bound_([pn]\d+)(?:_from_([pn]\d+)_step_([pn]\d+|runtime_[pn]))?(_post)?$/,
  );
  if (affine) {
    return {
      countName: affine[1],
      boundOffset: decodeSigned(affine[2]),
      start: affine[3] === undefined ? 0n : decodeSigned(affine[3]),
      step: affine[4] === undefined ? 1n : decodeSigned(affine[4]),
      postTest: affine[5] !== undefined,
    };
  }
  if (range) {
    return {
      countName: range[1],
      boundOffset: 0n,
      start: decodeSigned(range[2]),
      step: decodeSigned(range[3]),
      postTest: range[4] !== undefined,
    };
  }
  const postTest = name.match(/^__internal__vmapCounterPerm_(.+)_\d+_post$/);
  if (postTest) return {
    countName: postTest[1], boundOffset: 0n, postTest: true, start: 0n, step: 1n,
  };
  const preTest = name.match(/^__internal__vmapCounterPerm_(.+)_\d+$/);
  return preTest ? {
    countName: preTest[1], boundOffset: 0n, postTest: false, start: 0n, step: 1n,
  } : undefined;
}

export function selectGraphBlockhashReads(
  artifact: Artifact, blob: Uint8Array,
): GraphBlockhashSelection[] {
  const route = artifact.messageBus?.route;
  const plan = route?.graphBlockhashOracle;
  if (!plan) return [];
  if (blob.length < 7 || binToHex(blob.slice(0, 4)) !== '53434231'
    || (blob[4] !== 1 && blob[4] !== 2)) {
    throw new Error('message-bus batch graph blockhash route requires a canonical version-1 or version-2 envelope');
  }
  const rowCount = blob[6];
  if (rowCount > plan.rowCount) throw new Error('message-bus batch graph blockhash row count exceeds the oracle plan');
  const valueMode = blob[5] === 1;
  let cursor = 7;
  const selected: GraphBlockhashSelection[] = [];
  const structs = artifact.structs ?? artifact.stateLayout?.structs;
  for (let row = 0; row < rowCount; row++) {
    const header = 12 + (blob[4] === 2 ? 1 : 0) + (valueMode ? 9 : 0);
    if (cursor + header > blob.length) throw new Error(`message-bus batch row ${row} is truncated`);
    const selector = binToHex(blob.slice(cursor, cursor + 4));
    const logicalRow = blob[cursor + 4] | (blob[cursor + 5] << 8) | (blob[cursor + 6] << 16)
      | (blob[cursor + 7] << 24);
    if (logicalRow !== row) throw new Error('message-bus batch graph rows must use canonical contiguous indices');
    const argsLength = blob[cursor + 10] | (blob[cursor + 11] << 8);
    const argsStart = cursor + header;
    const argsEnd = argsStart + argsLength;
    if (argsEnd > blob.length) throw new Error(`message-bus batch row ${row} arguments are truncated`);
    const handlerInfo = artifact.messageBus!.handlers.find((h) => h.selector === selector && h.eligible);
    const handler = artifact.abi.find((f) => f.name === handlerInfo?.name);
    if (!handlerInfo || !handler) throw new Error(`message-bus batch row ${row} selects an ineligible handler`);
    const rowArgs: FunctionArgument[] = [];
    let argCursor = argsStart;
    for (const input of handlerInfo.inputs) {
      const decoded = decodePushdataValue(blob, argCursor, input.type, structs);
      rowArgs.push(decoded.value as FunctionArgument);
      argCursor += decoded.bytesConsumed;
    }
    if (argCursor !== argsEnd) throw new Error(`message-bus batch row ${row} argument vector is non-canonical`);
    for (const descriptor of plan.reads) {
      if (descriptor.row === row && descriptor.selector === selector) {
        selected.push({ readKey: descriptor.readKey, slotOrdinal: descriptor.slotOffset, rowArgs, handler });
      }
    }
    cursor = argsEnd;
  }
  if (cursor !== blob.length) throw new Error('message-bus batch graph blockhash envelope has trailing bytes');
  return selected.sort((a, b) => a.slotOrdinal - b.slotOrdinal);
}

export function selectGraphEcrecoverCalls(artifact: Artifact, blob: Uint8Array): GraphEcrecoverCall[] {
  const route = artifact.messageBus?.route;
  // A handler whose recovery call lives in an OUTLINED shared body publishes no `ecrecoverArgParams` - the call is
  // generated for that body, whose parameters carry the outlined values, not the handler's own names - but the
  // closure analysis still publishes one `ecrecoverEvmFlags` entry per call in the handler's footprint. The flag
  // VECTOR is therefore the authoritative call count for such a handler, and every one of its arguments is
  // computed from arguments the batch row does not name. Reading it here is what keeps the selected call set equal
  // to the calls this envelope actually makes: the route's block layout reserves the UNION of every eligible
  // handler's recovery slots, and treating that union as the call list invents deferred resources for call sites
  // no selected handler executes - which no probe can ever learn and which then fails the whole graph.
  const handlerCalls = (handler: { ecrecoverArgParams?: readonly (readonly (string | null)[])[] | null;
    ecrecoverEvmFlags?: readonly boolean[] | null }): ReadonlyArray<readonly (string | null)[]> =>
    handler.ecrecoverArgParams?.length
      ? handler.ecrecoverArgParams
      : (handler.ecrecoverEvmFlags ?? []).map(() => [null, null, null, null] as const);
  if (!route?.ecrecoverCompute
    || !artifact.messageBus?.handlers.some((handler) => handlerCalls(handler).length > 0)) return [];
  if (blob.length < 7 || binToHex(blob.slice(0, 4)) !== '53434231'
    || (blob[4] !== 1 && blob[4] !== 2)) {
    throw new Error('message-bus batch graph ecrecover route requires a canonical version-1 or version-2 envelope');
  }
  const rowCount = blob[6];
  if (rowCount > artifact.messageBus!.maximumRows) {
    throw new Error('message-bus batch graph ecrecover row count exceeds the route limit');
  }
  const valueMode = blob[5] === 1;
  const structs = artifact.structs ?? artifact.stateLayout?.structs;
  const selected: GraphEcrecoverCall[] = [];
  let cursor = 7;
  for (let row = 0; row < rowCount; row += 1) {
    const header = 12 + (blob[4] === 2 ? 1 : 0) + (valueMode ? 9 : 0);
    if (cursor + header > blob.length) throw new Error(`message-bus batch row ${row} is truncated`);
    const selector = binToHex(blob.slice(cursor, cursor + 4));
    const logicalRow = blob[cursor + 4] | (blob[cursor + 5] << 8) | (blob[cursor + 6] << 16)
      | (blob[cursor + 7] << 24);
    if (logicalRow !== row) throw new Error('message-bus batch graph rows must use canonical contiguous indices');
    const argsLength = blob[cursor + 10] | (blob[cursor + 11] << 8);
    const argsStart = cursor + header;
    const argsEnd = argsStart + argsLength;
    if (argsEnd > blob.length) throw new Error(`message-bus batch row ${row} arguments are truncated`);
    const handlerInfo = artifact.messageBus!.handlers.find((h) => h.selector === selector && h.eligible);
    if (!handlerInfo) throw new Error(`message-bus batch row ${row} selects an ineligible handler`);
    const decoded = new Map<string, FunctionArgument>();
    let argCursor = argsStart;
    for (const input of handlerInfo.inputs) {
      const value = decodePushdataValue(blob, argCursor, input.type, structs);
      decoded.set(input.name, value.value as FunctionArgument);
      argCursor += value.bytesConsumed;
    }
    if (argCursor !== argsEnd) throw new Error(`message-bus batch row ${row} argument vector is non-canonical`);
    for (const names of handlerCalls(handlerInfo)) {
      const values = names.map((name) => (name === null ? undefined : decoded.get(name)));
      if (names.some((name, index) => name !== null && values[index] === undefined)) {
        throw new Error(`message-bus batch row ${row} cannot resolve its ecrecover argument vector`);
      }
      selected.push([
        values[0]!, values[1]!, values[2]!, values[3]!,
      ]);
    }
    cursor = argsEnd;
  }
  if (cursor !== blob.length) throw new Error('message-bus batch graph ecrecover envelope has trailing bytes');
  return selected;
}

/** Structural call surface used by batchRaw; SC factories return StatefulFunctionCall. */
export type BatchRawCall = {
  _withCompilerTransferRecipe(
    outputSlot: number,
    transfer: FixedBchTransferAbi,
    args: readonly FunctionArgument[],
    handler: AbiFunction,
    executionArtifact: Artifact,
  ): BatchRawCall;
  _withCompilerRouteDelegatecall(executor: unknown, route: unknown): BatchRawCall;
};

export interface BatchRawHost {
  readonly inner: { artifact: Artifact };
  evaluateExternalExpression(
    expression: ExternalCallExpression,
    functionArgs: FunctionArgument[],
    artifact: Artifact,
    state?: Record<string, unknown>,
    callerInputs?: readonly { type: string }[],
    externalReturns?: ReadonlyMap<string, FunctionArgument>,
    occurrenceIndex?: number,
    stateIncludesPriorWrites?: boolean,
    executionSelfAddress?: FunctionArgument,
    localBindings?: ReadonlyMap<string, FunctionArgument>,
    stateLengthDeltas?: Readonly<Record<string, bigint>>,
    strictFieldAccess?: boolean,
  ): FunctionArgument | undefined;
  vmapCounterDomain(
    info: SortedUpsertLoopAbi | undefined,
    spec: VmapCounterPermutationSpec,
    legacyBound: unknown,
    functionArgs: FunctionArgument[],
    artifact: Artifact,
    callerInputs: readonly { type: string }[],
    state?: Record<string, unknown>,
    executionSelfAddress?: FunctionArgument,
  ): bigint[] | undefined;
  createForwardDelegateCall(input: {
    routeSelector: Uint8Array;
    builderOverrides: Record<string, unknown>;
    callOverrides: Record<string, unknown>;
    executor: unknown;
    route: NonNullable<ExternalCallUtxoGroup['compilerRoute']>;
  }): BatchRawCall;
  createMessageBusCall(input: {
    routeArgs: FunctionArgument[];
    builderOverrides: Record<string, unknown>;
    callOverrides: Record<string, unknown>;
  }): BatchRawCall;
}

export function batchRaw(
host: BatchRawHost,
blob: Uint8Array,
routeWitnesses: readonly FunctionArgument[] = [],
internalRouteWitnesses: Readonly<Record<string, FunctionArgument>> = {},
blockBase = 0,
emitReturn = false,
returnBlob?: Uint8Array,
omitLocalFeeTail = false,
delegateExecution?: { artifact: Artifact; executor: unknown },
rowArguments?: readonly RouteExpressionKeyRow[],
logicalIdentity?: ResolvedLogicalIdentity,
valueChunkProductions?: NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']>,
callerLockingBytecode?: Uint8Array,
): BatchRawCall {
  const executionArtifact = delegateExecution?.artifact ?? host.inner.artifact;
  const capability = executionArtifact.messageBus;
  if (!capability) throw new Error('This artifact does not advertise a message-bus route');
  const canonicalBlobLineage = hasCanonicalBatchBlobLineage(blob);
  const effectiveRowArguments = rowArguments?.map((row) => ({
    ...row,
    args: [...row.args],
    internalArgs: { ...(row.internalArgs ?? {}) },
  }));
  const runtimeEventMutationRows = (effectiveRowArguments ?? []).filter((row) =>
    (row.handler.runtimeLoopEvents?.length ?? 0) > 0
    && (row.handler.sortedUpsertLoopInfo ?? []).some((stream) => stream.op !== 'read'));
  if (runtimeEventMutationRows.length > 1) {
    throw new Error(
      'Multiple message-bus runtime event rows with journal mutations cannot share one batch; '
      + 'split the calls into separate transactions.',
    );
  }
  const resolvedCallerInternalWitnesses: Record<string, FunctionArgument> = { ...internalRouteWitnesses };
  for (const input of capability.route.inputs) {
    if (input.name !== KERNEL_JOURNAL_ACCESS_STREAMS
      || resolvedCallerInternalWitnesses[input.name] !== undefined) continue;
    const rowStreams: Uint8Array[][] = Array.from(
      { length: effectiveRowArguments?.length ?? 0 }, () => [],
    );
    for (const [rowIndex, row] of (effectiveRowArguments ?? []).entries()) {
      if (!row.handler.inputs.some((candidate) => candidate.name === input.name)) continue;
      const streams = kernelJournalAccessStreamPlaceholders(row.handler);
      (row.internalArgs as Record<string, FunctionArgument>)[input.name] = streams;
      rowStreams[rowIndex] = streams;
    }
    resolvedCallerInternalWitnesses[input.name] = rowStreams;
  }
  if (capability.route.inputs.some((input) => input.name === KERNEL_JOURNAL_RECORDS)
    && resolvedCallerInternalWitnesses[KERNEL_JOURNAL_RECORDS] === undefined) {
    resolvedCallerInternalWitnesses[KERNEL_JOURNAL_RECORDS] = [];
  }
  for (const input of capability.route.inputs) {
    if (kernelEntryJournalRecordSegmentIndex(input.name) !== undefined
      && resolvedCallerInternalWitnesses[input.name] === undefined) {
      resolvedCallerInternalWitnesses[input.name] = [];
    }
  }
  for (const input of capability.route.inputs) {
    const permutationSpec = vmapCounterPermutationSpec(input.name);
    if (!permutationSpec || resolvedCallerInternalWitnesses[input.name] !== undefined) continue;
    const rows = effectiveRowArguments?.map((row, rowIndex) => ({ row, rowIndex })).filter(({ row }) =>
      row.handler.inputs.some((candidate) => candidate.name === input.name)) ?? [];
    // The published route owns the union of every admitted handler's hidden loop witnesses. A witness with no
    // selected source row belongs only to an inactive dispatch arm, so its canonical empty value is sufficient.
    if (rows.length === 0) {
      resolvedCallerInternalWitnesses[input.name] = [];
      continue;
    }
    // Route witnesses add one outer dimension so each physical row owns its permutation.
    const rowPermutations: bigint[][] = Array.from(
      { length: effectiveRowArguments?.length ?? 0 }, () => [],
    );
    for (const { row, rowIndex } of rows) {
      const visible = visibleHandlerInputs(row.handler.inputs);
      const loopInfo = row.handler.sortedUpsertLoopInfo
        ?.find((info) => info.varyingArrayParam === input.name);
      const eventLoop = row.handler.runtimeLoopEvents
        ?.find((loop) => loop.permutationParam === input.name);
      const domainInfo = loopInfo ?? (eventLoop?.iterationBound
        ? { iterationBound: eventLoop.iterationBound } as SortedUpsertLoopAbi : undefined);
      const countIndex = visible.findIndex((candidate) => candidate.name === permutationSpec.countName);
      const countValue = countIndex < 0 ? undefined : row.args[countIndex];
      if (countValue === undefined && !domainInfo?.iterationBound) {
        throw new Error(`vmap counter loop bound '${permutationSpec.countName}' must be a public argument`);
      }
      const active = loopInfo?.condition ? host.evaluateExternalExpression(
        loopInfo.condition,
        [...row.args],
        executionArtifact,
        undefined,
        visible,
      ) : true;
      // State-derived predicates are intentionally unresolved here: _batchRaw is synchronous and performs no
      // chain reads. Publish an empty placeholder; _createBuilder recomputes the exact permutation after loading
      // authenticated state. Parameter-only false paths can avoid even validating an unreachable large bound.
      const resolvedDomain = active === true ? host.vmapCounterDomain(
        domainInfo, permutationSpec, countValue, [...row.args], executionArtifact, visible,
      ) : [];
      const domain = resolvedDomain ?? [];
      const selectedDomain: bigint[] = [];
      let selectedDomainResolved = active === true;
      if (loopInfo?.iterationCondition && active === true) {
        for (let occurrenceIndex = 0; occurrenceIndex < domain.length; occurrenceIndex += 1) {
          const selected = host.evaluateExternalExpression(
            loopInfo.iterationCondition!,
            [...row.args],
            executionArtifact,
            undefined,
            visible,
            undefined,
            occurrenceIndex,
          );
          const breaking = loopInfo.iterationBreakCondition ? host.evaluateExternalExpression(
            loopInfo.iterationBreakCondition,
            [...row.args],
            executionArtifact,
            undefined,
            visible,
            undefined,
            occurrenceIndex,
          ) : false;
          if (typeof selected !== 'boolean' || typeof breaking !== 'boolean') {
            selectedDomainResolved = false;
            break;
          }
          if (selected) selectedDomain.push(domain[occurrenceIndex]);
          if (breaking) break;
        }
      }
      // Authenticated state is loaded only by the asynchronous builder. If any per-iteration result is not yet
      // resolvable, retain an empty placeholder and replace it after hydration below.
      const permutation = loopInfo?.iterationCondition && selectedDomainResolved
        ? selectedDomain
        : loopInfo?.iterationCondition ? [] : domain;
      (row.internalArgs as Record<string, FunctionArgument>)[input.name] = permutation;
      rowPermutations[rowIndex] = permutation;
    }
    resolvedCallerInternalWitnesses[input.name] = rowPermutations;
  }
  for (const input of capability.route.inputs) {
    if ((!input.name.startsWith(VMAP_RUNTIME_INPUT_COUNT_PREFIX)
      && !input.name.startsWith(VMAP_RUNTIME_OUTPUT_COUNT_PREFIX))
      || resolvedCallerInternalWitnesses[input.name] !== undefined) continue;
    resolvedCallerInternalWitnesses[input.name] = 0n;
  }
  for (const input of capability.route.inputs) {
    if ((!input.name.startsWith(VMAP_COUNTER_INPUT_COUNT_PREFIX)
      && !input.name.startsWith(VMAP_COUNTER_OUTPUT_COUNT_PREFIX))
      || resolvedCallerInternalWitnesses[input.name] !== undefined) continue;
    const rowValues = Array.from({ length: effectiveRowArguments?.length ?? 0 }, () => 0n);
    for (const row of effectiveRowArguments ?? []) {
      if (row.handler.inputs.some((candidate) => candidate.name === input.name)) {
        (row.internalArgs as Record<string, FunctionArgument>)[input.name] = 0n;
      }
    }
    resolvedCallerInternalWitnesses[input.name] = rowValues;
  }
  for (const input of capability.route.inputs) {
    if (!input.name.startsWith(VMAP_COUNTER_OLD_PREFIX)
      || resolvedCallerInternalWitnesses[input.name] !== undefined) continue;
    const rowValues = Array.from({ length: effectiveRowArguments?.length ?? 0 }, () => []);
    for (const row of effectiveRowArguments ?? []) {
      if (row.handler.inputs.some((candidate) => candidate.name === input.name)) {
        (row.internalArgs as Record<string, FunctionArgument>)[input.name] = [];
      }
    }
    resolvedCallerInternalWitnesses[input.name] = rowValues as FunctionArgument;
  }
  for (const input of capability.route.inputs) {
    if ((!input.name.startsWith(VMAP_COUNTER_VALUE_PREFIX)
      && !input.name.startsWith(VMAP_COUNTER_PREFIX_COUNT_PREFIX)
      && !input.name.startsWith(VMAP_COUNTER_SOURCE_INDEX_PREFIX))
      || resolvedCallerInternalWitnesses[input.name] !== undefined) continue;
    const rowValues = Array.from({ length: effectiveRowArguments?.length ?? 0 }, () => []);
    for (const row of effectiveRowArguments ?? []) {
      if (row.handler.inputs.some((candidate) => candidate.name === input.name)) {
        (row.internalArgs as Record<string, FunctionArgument>)[input.name] = [];
      }
    }
    resolvedCallerInternalWitnesses[input.name] = rowValues as FunctionArgument;
  }
  const expectedWitnesses = capability.route.inputs
    .filter((input) => input.name !== 'batchBlob' && !input.name.startsWith('__internal__')).length;
  if (routeWitnesses.length !== expectedWitnesses) {
    throw new Error(
      `message-bus batch route requires ${expectedWitnesses} collection witnesses, `
      + `got ${routeWitnesses.length}`,
    );
  }
  let routeWitness = 0;
  // The ordinary builder injects its local msg.sender category after the visible ABI arguments. A finalized
  // graph supplies that field explicitly, so retain it only when graph context already resolved the witness.
  const materializedRouteInputs = capability.route.inputs.filter((input) =>
    input.name !== '__internal__msgSenderCategory'
    || resolvedCallerInternalWitnesses[input.name] !== undefined);
  const routeArgs = materializedRouteInputs.map((input): FunctionArgument => {
    if (input.name === 'batchBlob') return blob;
    if (input.name.startsWith('__internal__')) {
      const value = resolvedCallerInternalWitnesses[input.name];
      if (value !== undefined) return value;
      if (input.name === '__internal__activeVerifierIndex') return -1n;
      if (input.name === '__internal__messageBusOwnerBandInput') return BigInt(blockBase);
      // The aggregate route returns its concatenated result blob to graph consumers, but an ordinary local
      // `.batch()` does not materialize that route-level value as a return-event NFT. Semantic injection still
      // gives every returning entry point this compiler-owned coordinate, so use the same negative sentinel as
      // standalone returning calls until an outer composer explicitly binds a concrete return output.
      if (input.name === '__internal__returnOutputIdx') return -1n;
      // A negative value preserves the compiler's layout-relative continuation band. Builders that relocate
      // dynamic value chunks later replace this sentinel with the final absolute output coordinate.
      if (input.name === '__internal__valueChunkOutputBase') return -1n;
      // Dynamic-storage inputs are likewise positioned only after the participant's complete physical block
      // is assembled. Nested and root builders replace this provisional sentinel by exact outpoint identity.
      if (input.name === '__internal__dynamicChunkInputBase') return -1n;
      if (input.name.startsWith('__internal__valueWitness_')
        || input.name.startsWith('__internal__leadingPushValue_')
        || input.name.startsWith('__internal__completePushValue_')
        || input.name.startsWith('__internal__vmapBatchRows_')) return new Uint8Array();
      if (/^__internal__vmapBatch(?:Slot|Next)_\d+$/.test(input.name)) return new Uint8Array(32);
      if (/^__internal__vmapBatch(?:Proof|PredOut)_\d+$/.test(input.name)) return -1n;
      if (/^__internal__vmapBatchRank_\d+$/.test(input.name)
        || input.name === '__internal__vmapBatchTrailingCount') return 0n;
      throw new Error(
        `message-bus batch route for '${executionArtifact.contractName}' requires compiler-owned witness `
        + `'${input.name}'`,
      );
    }
    const value = routeWitnesses[routeWitness];
    routeWitness += 1;
    return value;
  });
  const resolvedInternalRouteWitnesses = Object.fromEntries(
    capability.route.inputs.flatMap((input, index) => input.name.startsWith('__internal__')
      ? [[input.name, routeArgs[index]]] : []),
  ) as Record<string, FunctionArgument>;
  const rowCount = blob.length > 6 ? blob[6] : 0;
  // Recover the reached selectors from the canonical blob so conditional token-transfer slots are derived only
  // for rows that actually execute such a handler. Leaving the inactive suffix as 1-token probe placeholders
  // would silently debit the container even though the covenant correctly skipped those slots.
  const reachedHandlers: typeof capability.handlers = [];
  let cursor = 7;
  // X199. Intersect with eligibility: the compiler's logical value mode is computed over the FINAL
  // survivors, so a published-but-refused payable handler must not size the admitted route's rows.
  const valueMode = capability.handlers.some((handler) => handler.eligible && handler.usesMsgValue);
  for (let row = 0; row < rowCount; row++) {
    const header = 12 + (blob[4] === 2 ? 1 : 0) + (valueMode ? 9 : 0);
    if (cursor + header > blob.length) break;
    const selector = binToHex(blob.slice(cursor, cursor + 4));
    const handler = capability.handlers.find((candidate) => candidate.selector === selector);
    if (handler) reachedHandlers.push(handler);
    const argsLengthOffset = cursor + 10;
    const argsLength = blob[argsLengthOffset] | (blob[argsLengthOffset + 1] << 8);
    cursor += header + argsLength;
  }
  // Choose carrier ownership from the selectors authenticated by the canonical batch blob, not from mutable
  // SDK row metadata. This is intentionally before builder creation and provider discovery: a hostile caller
  // cannot make a covered row look unrelated (or hide an eager collision) by substituting `rowArguments`.
  const readCarrierCapability = kernelEntryJournalReadCarrierCapabilityFromArtifact(executionArtifact);
  if (readCarrierCapability && reachedHandlers.length !== rowCount) {
    throw new Error(
      'Compiler internal-read-carrier batch requires exact handler metadata for every authenticated row.',
    );
  }
  const selectedHandlerAbis = reachedHandlers.map((handler) => executionArtifact.abi.find((candidate) =>
    candidate.selector === handler.selector));
  if (readCarrierCapability && selectedHandlerAbis.some((handler) => handler === undefined)) {
    throw new Error('Compiler internal-read-carrier capability selected a handler without exact ABI metadata.');
  }
  const authenticatedCarrierMode = shouldDeferKernelJournalBatchMaterialization(
    readCarrierCapability,
    selectedHandlerAbis.filter((handler): handler is AbiFunction => handler !== undefined),
  );
  assertKernelReadCarrierAuthenticatedRows(
    authenticatedCarrierMode,
    reachedHandlers.map((handler) => handler.selector),
    effectiveRowArguments,
  );
  const activeRouteEntryKeys = new Set<string>();
  reachedHandlers.forEach((handler, rowIndex) => {
    for (const binding of handler.batchKeyWitnesses ?? []) {
      activeRouteEntryKeys.add(binding.perRow ? `${binding.routeInput}_r${rowIndex}` : binding.routeInput);
      if (binding.alternateRouteInput) activeRouteEntryKeys.add(binding.alternateRouteInput);
    }
  });
  const routeKeyName = (name: string): string => {
    const bare = name.startsWith('id:') ? name.slice(3) : name;
    return bare.startsWith('__message_bus_ek_') ? bare.slice('__message_bus_ek_'.length) : bare;
  };
  const inactiveRouteEntrySlots = (capability.route.entryAccesses ?? []).flatMap((access, denseIndex) => {
    const keys = access.keyParams.map(routeKeyName);
    return keys.length > 0 && keys.every((key) => key.startsWith('__message_bus_key_'))
      && !keys.every((key) => activeRouteEntryKeys.has(key)) ? [access.slotIndex ?? denseIndex] : [];
  });
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_COLLECTION_FETCH === '1' && (capability.route.entryAccesses ?? []).length > 0) {
    console.error('route-entry-keys', JSON.stringify({
      buildId: peekBuildId(),
      contract: host.inner.artifact.contractName,
      route: capability.route.name,
      reached: reachedHandlers.map((handler) => handler.name),
      activeKeys: [...activeRouteEntryKeys],
      bindings: reachedHandlers.map((handler) => [handler.name,
        (handler.batchKeyWitnesses ?? []).map((binding) => [binding.routeInput, binding.perRow === true,
          binding.alternateRouteInput])]),
      inactive: inactiveRouteEntrySlots,
    }));
  }
  // `route.entryAccesses` is the union of every admitted handler. Narrow each selected row back to the
  // operations of its direct handler using the compiler-published physical-slot correspondence. Per-row route
  // slots are copies of that canonical physical slot, so replace only the `_rN` coordinate and find the exact
  // copy rather than depending on route ordering or collection-specific conventions.
  const fixedChunkableAccessActive = (
    access: {
      activation?: ExternalCallExpression;
      mutationEffectOrdinals?: readonly number[];
    },
    rowArgs: readonly FunctionArgument[] | undefined,
    pathEffectSchedule: PublishedPathEffectSchedule | undefined,
    handlerInputs: readonly { name: string; type: string }[],
    handlerId: string,
    handlerName: string | undefined,
    participantIndex: number,
  ): boolean => {
    const fallbackActive = (): boolean => {
      if (access.activation === undefined) return true;
      if (rowArgs === undefined) {
        throw new Error('messageBus: fixed-chunkable activation requires authenticated row arguments');
      }
      const active = evaluateFixedEffectPredicate(access.activation, rowArgs);
      if (typeof active !== 'boolean') {
        throw new Error('messageBus: fixed-chunkable activation could not be evaluated');
      }
      return active;
    };
    // path-effect activation/settle-time ExecutionContext: typed ExecutionContext binds frame ABI + pathEffectSchedule for write selection.
    // Multi-participant journals key by participantIndex (+ nested scope from the lifecycle).
    if (pathEffectSchedule !== undefined && rowArgs !== undefined) {
      const lifecycle = settlement().executionContexts;
      const nestedScopeId = lifecycle.currentNestedScope() !== 0
        ? lifecycle.currentNestedScope()
        : undefined;
      const params = {
        handlerId,
        handlerName,
        participantIndex,
        ...(nestedScopeId !== undefined && { nestedScopeId }),
        inputs: handlerInputs,
        args: rowArgs,
        pathEffectSchedule,
      };
      const journalKey = executionContextJournalKey({
        handlerId,
        participantIndex,
        nestedScopeId,
      });
      let context = buildKernelExecutionContext(params);
      // Settle-time lifecycle: register once per journal key while the session is open/bound.
      try {
        if (lifecycle.getByJournalKey(journalKey) === undefined
          && lifecycle.getPhase() !== 'settled') {
          context = registerExecutionContextOnSettlement(lifecycle, params);
        } else {
          context = lifecycle.getByJournalKey(journalKey) ?? context;
        }
      } catch {
        // Session already settled — keep ephemeral context for this check.
      }
      const scheduled = (access.mutationEffectOrdinals ?? []).some((ordinal) => (
        pathEffectSchedule.effects.some((effect) => (
          effect.kind === 'stateWrite' && effect.ordinal === ordinal
        ))
      ));
      if (scheduled) return allowsWriteUnderExecutionContext(context, access.mutationEffectOrdinals);
    }
    return fallbackActive();
  };
  const activeRouteEntryOperations = new Map<number, readonly string[]>();
  const activeRouteSortedBatchSlots = new Set<number>();
  const activeRouteSortedBatches = new Map<string, { slots: Set<number>; linear: boolean }>();
  const activeRouteEntryRecipes = new Map<number, Array<{
    rowIndex: number;
    access: EntryAccessAbi;
    args: FunctionArgument[];
    inputs: AbiFunction['inputs'];
  }>>();
  reachedHandlers.forEach((handler, rowIndex) => {
    const selected = executionArtifact.abi.find((candidate) =>
      candidate.selector === handler.selector || candidate.name === handler.name);
    const rowArgs = effectiveRowArguments?.[rowIndex]?.args;
    const pathEffectSchedule = (handler as { pathEffectSchedule?: PublishedPathEffectSchedule })
      .pathEffectSchedule
      ?? (executionArtifact.messageBus?.handlers?.find((candidate) =>
        candidate.selector === handler.selector || candidate.name === handler.name)
        ?.pathEffectSchedule as PublishedPathEffectSchedule | undefined);
    const handlerInputs = selected?.inputs
      ?? (handler as { inputs?: readonly { name: string; type: string }[] }).inputs
      ?? [];
    handler.physicalEntrySlots?.forEach((physicalSlot, directIndex) => {
      const directAccess = selected?.entryAccesses?.[directIndex];
      if (!directAccess) return;
      const physicalAlternatives = handler.physicalEntrySlotAlternatives?.[directIndex]
        ?? [physicalSlot];
      for (const alternativeSlot of physicalAlternatives) {
        const canonicalAccess = entryAccessAt(capability.route, alternativeSlot);
        if (!canonicalAccess) continue;
        const selectedKeys = canonicalAccess.keyParams.map((key) =>
          routeKeyName(key).replace(/_r\d+$/, `_r${rowIndex}`));
        const selectedAccess = capability.route.entryAccesses?.find((candidate) =>
          candidate.collection === directAccess.collection
          && candidate.keyParams.length === selectedKeys.length
          && candidate.keyParams.every((key, keyIndex) => routeKeyName(key) === selectedKeys[keyIndex]));
        if (!selectedAccess) continue;
        const selectedSlot = selectedAccess.slotIndex
          ?? capability.route.entryAccesses!.indexOf(selectedAccess);
        const directSlot = directAccess.slotIndex ?? directIndex;
        const selectedBatch = selected?.sortedBatchInfo?.find((batch) => batch.slotIndices.includes(directSlot));
        if (directAccess.operations.includes('write') && selectedBatch !== undefined) {
          activeRouteSortedBatchSlots.add(selectedSlot);
          const activeBatch = activeRouteSortedBatches.get(selectedBatch.collection)
            ?? { slots: new Set<number>(), linear: selectedBatch.linear === true };
          activeBatch.slots.add(selectedSlot);
          activeBatch.linear ||= selectedBatch.linear === true;
          activeRouteSortedBatches.set(selectedBatch.collection, activeBatch);
        }
        const prior = activeRouteEntryOperations.get(selectedSlot) ?? [];
        const operations = fixedChunkableAccessActive(
          directAccess,
          rowArgs,
          pathEffectSchedule,
          handlerInputs,
          handler.selector ?? handler.name,
          handler.name,
          rowIndex,
        )
          ? directAccess.operations
          : directAccess.operations.filter((operation) => operation !== 'write');
        activeRouteEntryOperations.set(
          selectedSlot,
          [...new Set([...prior, ...operations])],
        );
        if (!activeRouteEntryRecipes.get(selectedSlot)?.some((recipe) => (
          recipe.rowIndex === rowIndex && recipe.access === directAccess
        ))) {
          const recipes = activeRouteEntryRecipes.get(selectedSlot) ?? [];
          recipes.push({
            rowIndex,
            access: { ...directAccess, operations },
            args: rowArgs ? [...rowArgs] : [],
            inputs: selected?.inputs ?? [],
          });
          activeRouteEntryRecipes.set(selectedSlot, recipes);
        }
      }
    });
  });
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ROUTE_ENTRY_PLAN === '1') {
    console.error('message-bus-active-entry-operations', JSON.stringify({
      handlers: reachedHandlers.map((handler) => handler.name),
      entries: [...activeRouteEntryOperations.entries()].map(([slotIndex, operations]) => ({
        slotIndex,
        collection: entryAccessAt(capability.route, slotIndex)?.collection,
        keys: entryAccessAt(capability.route, slotIndex)?.keyParams.map(routeKeyName),
        operations,
      })),
      inactiveRouteEntrySlots,
    }));
  }
  // Route entry metadata is the union of every admitted handler. In particular, a collection read in the
  // selected envelope can still advertise `write` because a sibling handler writes the same physical journal.
  // Preserve the concrete envelope's write set separately so output-only resources (such as long-value
  // continuations) are not provisioned for selected read calls.
  const activeRouteWriteCollections = [...new Set(reachedHandlers.flatMap((handler, rowIndex) => {
    const selected = executionArtifact.abi.find((candidate) =>
      candidate.selector === handler.selector || candidate.name === handler.name);
    const rowArgs = effectiveRowArguments?.[rowIndex]?.args;
    const pathEffectSchedule = (handler as { pathEffectSchedule?: PublishedPathEffectSchedule })
      .pathEffectSchedule
      ?? (executionArtifact.messageBus?.handlers?.find((candidate) =>
        candidate.selector === handler.selector || candidate.name === handler.name)
        ?.pathEffectSchedule as PublishedPathEffectSchedule | undefined);
    const handlerInputs = selected?.inputs
      ?? (handler as { inputs?: readonly { name: string; type: string }[] }).inputs
      ?? [];
    return (selected?.entryAccesses ?? [])
      .filter((access) => access.operations.includes('write')
        && fixedChunkableAccessActive(
          access,
          rowArgs,
          pathEffectSchedule,
          handlerInputs,
          handler.selector ?? handler.name,
          handler.name,
          rowIndex,
        ))
      .map((access) => access.collection);
  }))];
  const reachedFtTransfers = reachedHandlers.reduce((sum, handler) =>
    sum + (handler.tokenContainerAccesses ?? []).reduce((inner, access) =>
      inner + (access.transferCount ?? (access.operations.includes('transfer') ? 1 : 0)), 0), 0);
  const reachedNftTransfers = reachedHandlers.reduce((sum, handler) =>
    sum + (handler.tokenContainerAccesses ?? []).reduce((inner, access) =>
      inner + (access.transferNftCount ?? (access.operations.includes('transferNft') ? 1 : 0)), 0), 0);
  const routeEventSlots = capability.route.blockLayout?.slots.filter((slot) => slot.kind === 'event') ?? [];
  const routeEventWidth = routeEventSlots.length === 0 ? 0
    : Math.floor(routeEventSlots.length / capability.maximumRows);
  // path-effect activation/settle-time ExecutionContext: filter emits by published schedule activations, preferring a settle-time
  // ExecutionContext when one is registered for this participant journal key.
  // Compiler event ordinals are PATH_EFFECT_EVENT_ORDINAL_BASE + local emitIndex (pre-row remap).
  const reachedEmits = reachedHandlers.flatMap((handler, rowIndex) => {
    const rowArgs = effectiveRowArguments?.[rowIndex]?.args;
    const pathEffectSchedule = (handler as { pathEffectSchedule?: PublishedPathEffectSchedule })
      .pathEffectSchedule
      ?? (executionArtifact.messageBus?.handlers?.find((candidate) =>
        candidate.selector === handler.selector || candidate.name === handler.name)
        ?.pathEffectSchedule as PublishedPathEffectSchedule | undefined);
    const selected = executionArtifact.abi.find((candidate) =>
      candidate.selector === handler.selector || candidate.name === handler.name);
    const handlerInputs = selected?.inputs
      ?? (handler as { inputs?: readonly { name: string; type: string }[] }).inputs
      ?? [];
    const handlerId = handler.selector ?? handler.name;
    let env = rowArgs === undefined
      ? {}
      : pathEffectActivationEnvironmentFromArgs(handlerInputs, rowArgs);
    let activeEventOrdinals: readonly number[] | undefined;
    if (pathEffectSchedule !== undefined && rowArgs !== undefined) {
      const lifecycle = settlement().executionContexts;
      const nestedScopeId = lifecycle.currentNestedScope() !== 0
        ? lifecycle.currentNestedScope()
        : undefined;
      const journalKey = executionContextJournalKey({
        handlerId,
        participantIndex: rowIndex,
        nestedScopeId,
      });
      try {
        let context = lifecycle.getByJournalKey(journalKey);
        if (context === undefined && lifecycle.getPhase() !== 'settled') {
          context = registerExecutionContextOnSettlement(lifecycle, {
            handlerId,
            handlerName: handler.name,
            participantIndex: rowIndex,
            ...(nestedScopeId !== undefined && { nestedScopeId }),
            inputs: handlerInputs,
            args: rowArgs,
            pathEffectSchedule,
          });
        }
        if (context !== undefined) {
          // settle-time ExecutionContext: prefer settle-time ExecutionContext activationEnv for emit gating.
          env = context.activationEnv;
          activeEventOrdinals = activeOrdinalsUnderContext(context, 'event');
        }
      } catch {
        activeEventOrdinals = undefined;
      }
    }
    const activeEmits = filterEmitsUnderPathEffectSchedule(
      handler.emits ?? [],
      pathEffectSchedule,
      env,
      activeEventOrdinals,
    );
    return activeEmits.map((emitted) => ({
      ...emitted,
      emitIndex: rowIndex * routeEventWidth + emitted.emitIndex,
    }));
  });
  const effectiveTokenAccesses = capability.route.tokenContainerAccesses?.map((access, index) => ({
    ...access,
    // The current compiler route admits one canonical token-category witness. Preserve that explicit
    // restriction in metadata rather than guessing how to distribute effects across multiple containers.
    transferCount: index === 0 ? reachedFtTransfers : 0,
    transferNftCount: index === 0 ? reachedNftTransfers : 0,
  }));
  const tokenFrame = capability.route.graphEffectFrame;
  const selectedFixedTokenTransfers = reachedHandlers.flatMap((handler, rowIndex) => {
    const row = effectiveRowArguments?.[rowIndex];
    if (!row) return [];
    // Token-container transfer sites use a distinct index space from FixedBchTransfer
    // path-effect ordinals (2_000_000+index); do not filter them through transfer schedules.
    return (handler.tokenContainerTransferSites ?? []).map((site) => ({
      args: row.args,
      handler: row.handler,
      site,
      outputSlot: (tokenFrame?.tokenTransferBase ?? 0)
        + rowIndex * (tokenFrame?.tokenTransferWidth ?? 0) + site.transferIndex,
    }));
  });
  // The published route carries the union of handler compute slots, while its ABI arguments describe the
  // envelope rather than any selected row. Preserve the selected handlers' logical keccak call count and
  // defer every preimage to the complete authenticated graph trace: even a syntactically simple expression
  // can depend on a nested return which the isolated participant probe only represents with a placeholder.
  const selectedKeccakCalls = reachedHandlers.flatMap((handler) => handler.keccakPreimageParams ?? []);
  const publishedKeccakSlots = capability.route.blockLayout?.slots
    .filter((slot) => slot.kind === 'keccakSideCar').length ?? 0;
  if (Math.ceil(selectedKeccakCalls.length / 3) > publishedKeccakSlots) {
    throw new Error(
      'message-bus batch selects more keccak256 calls than its published compute-slot capacity',
    );
  }
  // New artifacts explicitly publish recovery presence for every handler and the full projection vector for
  // recovery handlers. Select that plan by reached row: inheriting the route-wide union made a non-recovery
  // sibling provision recovery resources, while dropping the EVM flags omitted the verified-pubkey keccak
  // member and deterministically projected the wrong address. Older artifacts retain their conservative
  // route-wide behavior until recompiled.
  const hasHandlerRecoveryMetadata = reachedHandlers.every((handler) =>
    handler.ecrecoverCompute !== undefined);
  const selectedRecoveryHandlers = reachedHandlers.filter((handler) => handler.ecrecoverCompute === true);
  const selectedEcrecoverEvmFlags = selectedRecoveryHandlers.flatMap((handler) =>
    handler.ecrecoverEvmFlags ?? []);
  if (hasHandlerRecoveryMetadata && selectedRecoveryHandlers.some((handler) =>
    (handler.ecrecoverEvmFlags?.length ?? 0) === 0)) {
    throw new Error('message-bus recovery handler is missing its compiler-published projection vector');
  }
  // Effect routes reserve eight conditional covenant slots, but the SDK
  // materializes only the prefix reached by this canonical blob. The
  // compiler route bytecode and block offsets remain unchanged; the sliced
  // ABI metadata controls witness construction/derivation only.
  const graphOwnedRoute = Object.keys(internalRouteWitnesses).length > 0;
  const effectiveRoute: AbiFunction = {
    ...capability.route,
    ...({ messageBusConvention: capability.convention } as Partial<MessageBusRuntimeAbiFunction>),
    // Runtime-only metadata: unreachable bounded rows keep their physical entry positions, but consume a
    // balanced funder placeholder rather than resolving an arbitrary absent key to the same collection proof.
    // The bytecode already gates these slots by row/selector; this only tells the SDK which fixed slots are
    // inactive for this canonical blob.
    ...({ messageBusInactiveEntrySlots: inactiveRouteEntrySlots } as Partial<AbiFunction>),
    // The atomic composer has already expanded every logical edge into the authenticated
    // messageEnvelope and laid out every participant block. Keeping the source handler's legacy external-call
    // metadata here would make _createBuilder independently plan the same edge and append synthetic
    // arguments which do not exist in the graph route ABI.
    ...(graphOwnedRoute && {
      externalCalls: undefined,
      // msg.sender is reconstructed from __internal__graphCallers for each logical row. The legacy
      // direct-call builder otherwise appends __internal__msgSenderCategory, which this route neither
      // declares nor trusts.
      usesMsgSender: false,
    }),
    ...(capability.route.transferCount !== undefined && {
      transferCount: Math.min(capability.route.transferCount, rowCount),
    }),
    // The published route carries the union of every handler's effects. Runtime metadata must carry the
    // selected rows only; retaining the union when no selected row emits makes the builder materialize every
    // inactive event after the balanced block.
    emits: reachedEmits,
    ...(effectiveTokenAccesses && { tokenContainerAccesses: effectiveTokenAccesses }),
    ...(selectedKeccakCalls.length > 0 && {
      keccakPreimageParams: selectedKeccakCalls.map(() => null),
    }),
    ...(hasHandlerRecoveryMetadata && {
      ecrecoverCompute: selectedRecoveryHandlers.length > 0,
      ecrecoverEvmFlags: selectedEcrecoverEvmFlags,
    }),
    ...([...activeRouteSortedBatches].some(([collection]) => (
      executionArtifact.stateLayout?.collections?.find((candidate) => candidate.name === collection)
        ?.chunkableValue !== true
    )) && {
      sortedBatchInfo: [...activeRouteSortedBatches].filter(([collection]) => (
        executionArtifact.stateLayout?.collections?.find((candidate) => candidate.name === collection)
          ?.chunkableValue !== true
      )).map(([collection, batch]) => ({
        collection,
        slotIndices: [...batch.slots].sort((left, right) => left - right),
        ...(batch.linear && { linear: true }),
      })),
    }),
  };
  if (graphOwnedRoute) {
    (effectiveRoute as MessageBusRuntimeAbiFunction).messageBusGraphExecution = true;
  }
  if (selectedFixedTokenTransfers.length > 0) {
    (effectiveRoute as MessageBusRuntimeAbiFunction).messageBusTokenContainerTransferPlan
      = selectedFixedTokenTransfers;
  }
  (effectiveRoute as MessageBusRuntimeAbiFunction)
    .messageBusActiveEntryOperations = activeRouteEntryOperations;
  (effectiveRoute as MessageBusRuntimeAbiFunction)
    .messageBusActiveEntryRecipes = activeRouteEntryRecipes;
  (effectiveRoute as MessageBusRuntimeAbiFunction)
    .messageBusActiveSortedBatchSlots = activeRouteSortedBatchSlots;
  (effectiveRoute as MessageBusRuntimeAbiFunction)
    .messageBusActiveWriteCollections = activeRouteWriteCollections;
  if (effectiveRowArguments !== undefined) {
    (effectiveRoute as MessageBusRuntimeAbiFunction).messageBusRowArguments = effectiveRowArguments;
  }
  if (authenticatedCarrierMode && canonicalBlobLineage && effectiveRowArguments) {
    authenticateKernelReadCarrierRoute(effectiveRoute, executionArtifact, blob, effectiveRowArguments);
  }
  const graphBlockhashSelections = selectGraphBlockhashReads(executionArtifact, blob);
  if (graphBlockhashSelections.length > 0) {
    (effectiveRoute as MessageBusRuntimeAbiFunction)
      .graphBlockhashSelections = graphBlockhashSelections;
  }
  const graphEcrecoverCalls = selectGraphEcrecoverCalls(executionArtifact, blob);
  if (graphEcrecoverCalls.length > 0) {
    (effectiveRoute as MessageBusRuntimeAbiFunction)
      .graphEcrecoverCalls = graphEcrecoverCalls;
  }
  const routeSelector = hexToBin(capability.selector);
  const attachCompilerTransfers = (call: BatchRawCall): BatchRawCall => {
    const transferSlots = capability.route.blockLayout?.slots
      .filter((slot) => slot.kind === 'transfer' && slot.slotIndex !== undefined) ?? [];
    const frameWidth = capability.route.graphEffectFrame?.transferWidth
      ?? (capability.maximumRows > 0 && transferSlots.length % capability.maximumRows === 0
        ? transferSlots.length / capability.maximumRows : 0);
    reachedHandlers.forEach((handler, rowIndex) => {
      const row = effectiveRowArguments?.[rowIndex];
      if (!row) return;
      // path-effect activation: FixedBchTransfer sites share path-effect ordinal space 2_000_000+transferIndex.
      const pathEffectSchedule = (handler as { pathEffectSchedule?: PublishedPathEffectSchedule })
        .pathEffectSchedule
        ?? (executionArtifact.messageBus?.handlers?.find((candidate) =>
          candidate.selector === handler.selector || candidate.name === handler.name)
          ?.pathEffectSchedule as PublishedPathEffectSchedule | undefined);
      const selected = executionArtifact.abi.find((candidate) =>
        candidate.selector === handler.selector || candidate.name === handler.name);
      const handlerInputs = selected?.inputs
        ?? (handler as { inputs?: readonly { name: string; type: string }[] }).inputs
        ?? [];
      let env = pathEffectActivationEnvironmentFromArgs(handlerInputs, row.args);
      let activeTransferOrdinals: readonly number[] | undefined;
      if (pathEffectSchedule !== undefined) {
        const lifecycle = settlement().executionContexts;
        const nestedScopeId = lifecycle.currentNestedScope() !== 0
          ? lifecycle.currentNestedScope()
          : undefined;
        const handlerId = handler.selector ?? handler.name;
        const journalKey = executionContextJournalKey({
          handlerId,
          participantIndex: rowIndex,
          nestedScopeId,
        });
        try {
          const context = lifecycle.getByJournalKey(journalKey);
          if (context !== undefined) {
            // settle-time ExecutionContext: prefer settle-time ExecutionContext activationEnv for transfer gating.
            env = context.activationEnv;
            activeTransferOrdinals = activeOrdinalsUnderContext(context, 'transfer');
          }
        } catch {
          activeTransferOrdinals = undefined;
        }
      }
      const activeTransfers = filterTransfersUnderPathEffectSchedule(
        handler.transfers ?? [],
        pathEffectSchedule,
        env,
        activeTransferOrdinals,
      );
      for (const transfer of activeTransfers) {
        const outputSlot = rowIndex * frameWidth + transfer.transferIndex;
        if (frameWidth < 1 || transfer.transferIndex < 0 || transfer.transferIndex >= frameWidth
          || !transferSlots.some((slot) => slot.slotIndex === outputSlot)) {
          throw new Error(`messageBus: BCH transfer in '${handler.name}' has no canonical slot`);
        }
        call._withCompilerTransferRecipe(
          outputSlot, transfer, row.args, handler, executionArtifact,
        );
      }
    });
    return call;
  };
  if (delegateExecution) {
    const proxyForward = host.inner.artifact.abi.find((fn) => fn.name === '__forward');
    if (!proxyForward || proxyForward.inputs[0]?.type !== 'bytes') {
      throw new Error('messageBus: automatic delegate composition currently requires a baked __forward(bytes) proxy');
    }
    const route: NonNullable<ExternalCallUtxoGroup['compilerRoute']> = {
      abiFunction: effectiveRoute,
      selector: routeSelector,
      blob,
      // Compiler-route rebuilding walks the ABI and inserts `internalArgs` in-place. Retain only the visible
      // positional frame here; storing the already-interleaved full route shifted every witness following the
      // first hidden graph input into the wrong ABI slot.
      args: [blob, ...routeWitnesses],
      logicalSelectors: reachedHandlers.map((handler) => handler.selector),
      ...(effectiveRowArguments !== undefined && {
        rowArguments: effectiveRowArguments.map((row, index) => ({
          ...row,
          selector: row.handler.selector ?? reachedHandlers[index]?.selector ?? '',
          args: [...row.args],
          internalArgs: { ...(row.internalArgs ?? {}) },
        })),
      }),
      // Keep the compiler route's positional frame visible-only and carry every hidden ABI value by name.
      // Resource witnesses that are inactive in this envelope still need their typed empty/default value;
      // omitting them makes the final ABI encoder receive `undefined`.
      internalArgs: resolvedInternalRouteWitnesses,
    };
    if (authenticatedCarrierMode && canonicalBlobLineage && effectiveRowArguments) {
      authenticateKernelReadCarrierRoute(route, executionArtifact, blob, effectiveRowArguments);
    }
    return attachCompilerTransfers(host.createForwardDelegateCall({
      routeSelector,
      builderOverrides: {
        blockBase, emitReturn, returnBlob, omitLocalFeeTail, logicalIdentity, valueChunkProductions,
        ...(callerLockingBytecode !== undefined && { callerLockingBytecode }),
      },
      callOverrides: {
        abiFunction: proxyForward, blockBase, emitReturn, returnBlob, omitLocalFeeTail, logicalIdentity,
        valueChunkProductions,
      },
      executor: delegateExecution.executor,
      route,
    }));
  }
  return attachCompilerTransfers(host.createMessageBusCall({
    routeArgs,
    builderOverrides: {
      abiFunction: effectiveRoute,
      compilerRouteSelector: routeSelector,
      blockBase,
      emitReturn,
      returnBlob,
      omitLocalFeeTail,
      logicalIdentity,
      valueChunkProductions,
      ...(callerLockingBytecode !== undefined && { callerLockingBytecode }),
    },
    callOverrides: {
      abiFunction: effectiveRoute, selector: routeSelector, blockBase, emitReturn, returnBlob,
      omitLocalFeeTail, logicalIdentity, valueChunkProductions,
    },
  }));
}
