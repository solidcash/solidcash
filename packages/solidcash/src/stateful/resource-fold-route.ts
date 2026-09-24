/**
 * phase-boundary extract: resource-fold route helpers + encoded array channel utilities
 * (phase-boundary extract from StatefulContract.ts).
 */

import { binToHex } from '@bitauth/libauth';
import {
  decodePushdataValue,
  encodePushdataValue,
  parseArrayTypeString,
  type Artifact,
  type EntryAccessAbi,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import {
  executionContextJournalKey,
  type ExecutionContextLifecycle,
  type KernelExecutionContext,
} from '../message-bus/execution-context.js';
import { pathEffectActivationEnvironmentFromArgs } from '../message-bus/path-effect-schedule.js';
import {
  evaluateFoldActivation,
  findPublishedResourceFoldPlan,
  foldActivationFromExternalCallExpression,
  foldChunkableResource,
  instantiateResourceFoldPlan,
  type FoldActivationEnvironment,
  type PublishedResourceFoldPlanSummary,
  type ResourceFoldPlan,
  type ResourceFoldStep,
} from '../message-bus/resource-fold.js';
import {
  visibleHandlerInputs,
  type RouteExpressionKeyRow,
} from './route-expression-key.js';
import { encodeStructArgument } from './legacy-job-event-wire.js';
import { settlement } from './value-chunk-persist.js';

/** Optional settle-time ExecutionContext lookup for fold activation env (settle-time ExecutionContext). */
export type FoldActivationEnvResolveOptions = {
  /** Compose participant / fold-row index for the journal key. */
  participantIndex?: number;
  nestedScopeId?: number;
  /**
   * Prefer `ExecutionContext.activationEnv` when a matching journal-key context is registered.
   * Mirrors batch write/emit/transfer settle-time preference.
   */
  lifecycle?: Pick<ExecutionContextLifecycle, 'getByJournalKey' | 'currentNestedScope' | 'getPhase'>;
};

/**
 * Build a path-effect activation/settle-time ExecutionContext fold activation environment from one route row's visible ABI args.
 * Uses scalar-preserving path-effect env construction (ints/bytes survive for handlerInputEq).
 * When a settle-time ExecutionContext is registered for the row journal key, prefer its
 * activationEnv over freshly derived args (compose-surface parity with batch filters).
 */
export function foldActivationEnvironmentFromRouteRow(
  row: RouteExpressionKeyRow,
  options?: FoldActivationEnvResolveOptions,
): FoldActivationEnvironment {
  const visible = visibleHandlerInputs(row.handler.inputs);
  const fromArgs = pathEffectActivationEnvironmentFromArgs(visible, row.args);
  const lifecycle = options?.lifecycle;
  if (lifecycle === undefined) return fromArgs;

  const handlerId = row.selector
    ?? (row.handler as { selector?: string }).selector
    ?? row.handler.name;
  const nestedScopeId = options?.nestedScopeId !== undefined
    ? options.nestedScopeId
    : (lifecycle.currentNestedScope() !== 0 ? lifecycle.currentNestedScope() : undefined);
  const journalKey = executionContextJournalKey({
    handlerId,
    participantIndex: options?.participantIndex,
    nestedScopeId,
  });
  try {
    const context: KernelExecutionContext | undefined = lifecycle.getByJournalKey(journalKey);
    if (context !== undefined) return context.activationEnv;
  } catch {
    // Session already settled / unavailable — keep args-derived env.
  }
  return fromArgs;
}

/**
 * settle-time ExecutionContext: per-row fold activation resolver that prefers the active settlement ExecutionContext.
 * Pass as `resolveRowActivationEnv` so foldLeading gates under settle-time context like batch.
 */
export function createFoldRowActivationEnvResolver(
  options?: Omit<FoldActivationEnvResolveOptions, 'participantIndex'> & {
    /** When true (default) and lifecycle omitted, use `settlement().executionContexts`. */
    useActiveSettlement?: boolean;
  },
): (row: RouteExpressionKeyRow, rowIndex?: number) => FoldActivationEnvironment {
  return (row, rowIndex) => {
    const lifecycle = options?.lifecycle
      ?? (options?.useActiveSettlement === false
        ? undefined
        : settlement().executionContexts);
    return foldActivationEnvironmentFromRouteRow(row, {
      ...(options?.nestedScopeId !== undefined && { nestedScopeId: options.nestedScopeId }),
      ...(lifecycle !== undefined && { lifecycle }),
      ...(rowIndex !== undefined && { participantIndex: rowIndex }),
    });
  };
}

export function appendEncodedArrayElement(arrayBlob: Uint8Array, element: Uint8Array): Uint8Array {
  const count = decodePushdataValue(arrayBlob, 0, 'bigint');
  const prefix = encodePushdataValue(BigInt(count.value as bigint) + 1n, 'bigint');
  const out = new Uint8Array(prefix.length + (arrayBlob.length - count.bytesConsumed) + element.length);
  out.set(prefix, 0);
  out.set(arrayBlob.subarray(count.bytesConsumed), prefix.length);
  out.set(element, prefix.length + arrayBlob.length - count.bytesConsumed);
  return out;
}


export function concatenateEncodedArrays(left: Uint8Array, right: Uint8Array): Uint8Array {
  const leftCount = decodePushdataValue(left, 0, 'bigint');
  const rightCount = decodePushdataValue(right, 0, 'bigint');
  const prefix = encodePushdataValue(
    BigInt(leftCount.value as bigint) + BigInt(rightCount.value as bigint),
    'bigint',
  );
  const leftElements = left.subarray(leftCount.bytesConsumed);
  const rightElements = right.subarray(rightCount.bytesConsumed);
  const out = new Uint8Array(prefix.length + leftElements.length + rightElements.length);
  out.set(prefix, 0);
  out.set(leftElements, prefix.length);
  out.set(rightElements, prefix.length + leftElements.length);
  return out;
}


/**
 * Keep a chunkable array access's authenticated inputs separate from its derived result.
 *
 * The value witness is the exact proof-entry value before the handler. A leading mutation
 * represents earlier selected rows, while `postValue` is used only for persistence and
 * continuation outputs. In particular, deriving `postValue` must never replace the witness.
 */
export function deriveChunkableArrayValueChannels({
  preValueWitness,
  storedPreValue,
  leadingMutation,
  currentElement,
}: {
  preValueWitness?: Uint8Array;
  storedPreValue: Uint8Array;
  leadingMutation?: Uint8Array;
  currentElement?: Uint8Array;
}): {
  preValueWitness?: Uint8Array;
  leadingMutation?: Uint8Array;
  postValue: Uint8Array;
} {
  let postValue = storedPreValue;
  if (leadingMutation && leadingMutation.length > 0) {
    postValue = concatenateEncodedArrays(postValue, leadingMutation);
  }
  if (currentElement) postValue = appendEncodedArrayElement(postValue, currentElement);
  return { preValueWitness, leadingMutation, postValue };
}

function routeRowCollectionKey(
  row: RouteExpressionKeyRow,
  access: NonNullable<RouteExpressionKeyRow['handler']['entryAccesses']>[number],
  structs: Artifact['structs'],
): string | undefined {
  const inputs = visibleHandlerInputs(row.handler.inputs);
  const keys = access.keyParams ?? [];
  if (keys.length === 0) return undefined;
  const encoded: string[] = [];
  for (let index = 0; index < keys.length; index++) {
    const source = access.keySources?.[index];
    if (source && source.kind !== undefined && source.kind !== 'param') return undefined;
    const name = (source as { paramName?: string } | undefined)?.paramName ?? keys[index];
    const inputIndex = inputs.findIndex((input) => input.name === name);
    if (inputIndex < 0 || row.args[inputIndex] === undefined) return undefined;
    const value = encodeFunctionArgument(row.args[inputIndex], inputs[inputIndex].type, structs);
    if (!(value instanceof Uint8Array)) return undefined;
    encoded.push(binToHex(value));
  }
  return encoded.join(':');
}

/**
 * Encode the earlier same-key array pushes in a repeated message-bus route. The route executes only its final
 * matching handler body; the compiler-provided leading-push argument replays earlier rows against the same
 * authenticated collection entry before that final push.
 */
/**
 * Build a Gate-B / published resource-fold plan `ResourceFoldPlan` for ≥2 selected rows that mutate the same chunkable key.
 * When `publishedFoldPlans` is present, the matching published summary is authority for step kind /
 * initial source / witness names; a missing collection fails closed. When absent, rediscovery is the
 * legacy fallback. Leading/complete witnesses must come from `foldChunkableResource`.
 */
export function buildChunkablePushFoldPlan(params: {
  rowArguments: readonly RouteExpressionKeyRow[];
  collection: string;
  valueType: string;
  structs: Artifact['structs'];
  timestamp?: bigint;
  legacyJobEventCompatibility?: boolean;
  /**
   * Artifact `messageBus.resourceFoldPlans`. Defined (including empty) ⇒ prefer published /
   * fail closed when this collection is absent. Undefined ⇒ legacy rediscovery.
   */
  publishedFoldPlans?: readonly PublishedResourceFoldPlanSummary[];
  resolveElement?: (
    row: RouteExpressionKeyRow, access: EntryAccessAbi, elementType: string,
  ) => Uint8Array | undefined;
}): {
  plan: ResourceFoldPlan;
  elements: Uint8Array[];
  /** Same-key mutating rows in fold step order (for per-step activation env). */
  rows: RouteExpressionKeyRow[];
  valueType: string;
  published?: PublishedResourceFoldPlanSummary;
} | undefined {
  const published = params.publishedFoldPlans !== undefined
    ? findPublishedResourceFoldPlan(params.publishedFoldPlans, params.collection)
    : undefined;
  if (params.publishedFoldPlans !== undefined && published === undefined) {
    throw new Error(
      `resource-fold: artifact published resourceFoldPlans but has no plan for collection `
        + `'${params.collection}' (fail closed; rediscovery disabled)`,
    );
  }
  const array = parseArrayTypeString(params.valueType);
  if (!array || array.bound !== undefined) return undefined;
  const rows: Array<{
    row: RouteExpressionKeyRow; key: string; access: EntryAccessAbi; legacyElementIndex?: number;
  }> = params.rowArguments.flatMap((row) => {
    const accesses = (row.handler.entryAccesses ?? []).filter((access) => (
      access.collection === params.collection && access.operations?.includes('write')
    ));
    if (accesses.length !== 1) return [];
    const key = routeRowCollectionKey(row, accesses[0], params.structs);
    if (key === undefined) return [];
    const recipe = accesses[0].storedElementSource;
    if (accesses[0].arrayMutation === 'push' && recipe?.version === 1) {
      return [{ row, key, access: accesses[0] }];
    }
    if (params.legacyJobEventCompatibility !== true) return [];
    const visible = visibleHandlerInputs(row.handler.inputs);
    const elementInputs = visible.map((input, index) => ({ input, index }))
      .filter(({ input }) => input.type === array.elementType);
    return elementInputs.length === 1
      ? [{ row, key, access: accesses[0], legacyElementIndex: elementInputs[0].index }] : [];
  });
  if (rows.length < 2) return undefined;
  const final = rows[rows.length - 1]!;
  const sameKey = rows.filter((row) => row.key === final.key);
  if (sameKey.length < 2) return undefined;
  const elements: Uint8Array[] = [];
  const stepShells: Omit<ResourceFoldStep, 'kind'>[] = [];
  for (const [index, candidate] of sameKey.entries()) {
    const element = candidate.legacyElementIndex === undefined
      ? params.resolveElement?.(candidate.row, candidate.access, array.elementType)
      : encodeStructArgument(
        candidate.row.args[candidate.legacyElementIndex], array.elementType, params.structs,
        params.timestamp, true,
      );
    if (!element) throw new Error(
      `Cannot evaluate compiler-authenticated stored element for '${params.collection}'.`,
    );
    elements.push(element);
    const activation = foldActivationFromExternalCallExpression(candidate.access.activation);
    stepShells.push({
      rowSelector: candidate.key,
      effectOrdinal: candidate.access.mutationEffectOrdinals?.[0] ?? index,
      elementRecipeId: `row-${index}`,
      ...(activation !== undefined && { activation }),
    });
  }
  const plan = published !== undefined
    ? instantiateResourceFoldPlan(published, stepShells)
    : {
      collection: params.collection,
      initialSource: 'empty' as const,
      steps: stepShells.map((step) => ({ ...step, kind: 'push' as const })),
      leadingWitness: '__internal__leadingPushValue',
      completeWitness: '__internal__completePushValue',
    };
  return {
    plan,
    elements,
    rows: sameKey.map((candidate) => candidate.row),
    valueType: params.valueType,
    ...(published !== undefined && { published }),
  };
}

export function foldLeadingRouteArrayPushes(params: {
  rowArguments: readonly RouteExpressionKeyRow[];
  collection: string;
  valueType: string;
  structs: Artifact['structs'];
  timestamp?: bigint;
  /** Historical legacy-unroll JobEventData adapter; never inferred from arbitrary field names. */
  legacyJobEventCompatibility?: boolean;
  /**
   * Artifact `messageBus.resourceFoldPlans`. Defined ⇒ prefer published / fail closed on miss.
   * Undefined ⇒ legacy rediscovery.
   */
  publishedFoldPlans?: readonly PublishedResourceFoldPlanSummary[];
  /** Evaluate the compiler-authenticated element recipe in this row's exact ABI/state environment. */
  resolveElement?: (
    row: RouteExpressionKeyRow, access: EntryAccessAbi, elementType: string,
  ) => Uint8Array | undefined;
  /**
   * Shared path-effect activation activation environment when every fold step shares one bool-param / handler-input frame.
   * Prefer `resolveRowActivationEnv` for per-row gated multi-row folds.
   */
  activationEnv?: FoldActivationEnvironment;
  /**
   * Per-row activation environment (path-effect↔fold wiring; settle-time ExecutionContext preference).
   * Second arg is the fold-row / participant index for ExecutionContext journal keys.
   */
  resolveRowActivationEnv?: (
    row: RouteExpressionKeyRow,
    rowIndex?: number,
  ) => FoldActivationEnvironment;
  /** Override step activity; when omitted, structured step activations + env decide. */
  isActive?: (step: ResourceFoldStep) => boolean;
}): { leading: Uint8Array; complete: Uint8Array; plan: ResourceFoldPlan } | undefined {
  const built = buildChunkablePushFoldPlan(params);
  if (!built) return undefined;
  // Published resource-fold plans authority: leading/complete are fold outputs from the (published or rediscovered) plan.
  // path-effect activation/settle-time ExecutionContext: step activations from entry-access ECE; env from shared, per-row, or settle-time EC.
  const folded = foldChunkableResource(built.plan, {
    resolveElement: (step) => {
      const index = built.plan.steps.indexOf(step);
      return index >= 0 ? built.elements[index] : undefined;
    },
    appendElement: appendEncodedArrayElement,
    emptyValue: () => encodePushdataValue([], built.valueType, params.structs),
    activationEnv: params.activationEnv,
    isActive: params.isActive ?? ((step) => {
      const index = built.plan.steps.indexOf(step);
      const row = index >= 0 ? built.rows[index] : undefined;
      const env = row !== undefined && params.resolveRowActivationEnv !== undefined
        ? params.resolveRowActivationEnv(row, index)
        : params.activationEnv;
      return evaluateFoldActivation(step.activation, env);
    }),
  });
  if (folded.leading === undefined) return undefined;
  return { leading: folded.leading, complete: folded.complete, plan: built.plan };
}

export function encodeLeadingRouteArrayPushes(params: {
  rowArguments: readonly RouteExpressionKeyRow[];
  collection: string;
  valueType: string;
  structs: Artifact['structs'];
  timestamp?: bigint;
  /** Historical legacy-unroll JobEventData adapter; never inferred from arbitrary field names. */
  legacyJobEventCompatibility?: boolean;
  /** Evaluate the compiler-authenticated element recipe in this row's exact ABI/state environment. */
  resolveElement?: (
    row: RouteExpressionKeyRow, access: EntryAccessAbi, elementType: string,
  ) => Uint8Array | undefined;
}): Uint8Array | undefined {
  return foldLeadingRouteArrayPushes(params)?.leading;
}
