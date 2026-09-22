/**
 * Multi-row state fold planner (Gate B).
 *
 * `leadingValue` / complete folded values must be outputs of this fold, not separately
 * reconstructed SDK conventions (`encodeLeadingRouteArrayPushes`).
 *
 * Fold: initial → row1 → row2 → … → final
 */

export type ResourceFoldStepKind = 'push' | 'assign' | 'update';

/** One ordered mutating row against a shared chunkable resource. */
export interface ResourceFoldStep {
  /** Logical row / selector identity. */
  rowSelector?: string;
  /** Effect ordinal within the handler source-effect schedule. */
  effectOrdinal?: number;
  kind: ResourceFoldStepKind;
  /** Optional activation recipe id / bool-param name; absent ⇒ always active. */
  activation?: string;
  /** Opaque element / value recipe evaluated in the row's ABI environment. */
  elementRecipeId?: string;
}

/** Compiler-published fold plan for one chunkable collection+key domain. */
export interface ResourceFoldPlan {
  collection: string;
  collectionHash?: string;
  keyDomainId?: string;
  /** Prior commitment / empty initial source. */
  initialSource: 'empty' | 'prior-commitment' | 'leading-witness';
  steps: readonly ResourceFoldStep[];
  /** Witness name for the mid-fold leading value (earlier rows only). */
  leadingWitness?: string;
  /** Witness name for the complete folded value after all active steps. */
  completeWitness?: string;
}

export interface ResourceFoldEnvironment {
  /** Evaluate whether a step's activation is true for this compose. */
  isActive?: (step: ResourceFoldStep) => boolean;
  /** Evaluate one step's element bytes in the row environment. */
  resolveElement: (step: ResourceFoldStep) => Uint8Array | undefined;
  /** Append element onto an encoded array value (same wire rule as SDK array push). */
  appendElement: (encoded: Uint8Array, element: Uint8Array) => Uint8Array;
  /** Empty encoded value for the collection's value type. */
  emptyValue: () => Uint8Array;
  /** Optional prior commitment decoded to the starting encoded value. */
  priorValue?: () => Uint8Array | undefined;
}

export interface ResourceFoldResult {
  /** Encoded value after all but the last active step (undefined if fewer than 2 active steps). */
  leading?: Uint8Array;
  /** Encoded value after every active step. */
  complete: Uint8Array;
  activeSteps: readonly ResourceFoldStep[];
}

/**
 * Fold active steps into leading + complete values.
 * Fail-closed when any active step cannot resolve its element.
 */
export function foldChunkableResource(
  plan: ResourceFoldPlan,
  env: ResourceFoldEnvironment,
): ResourceFoldResult {
  const activeSteps = plan.steps.filter((step) => env.isActive?.(step) !== false);
  if (activeSteps.length === 0) {
    const prior = plan.initialSource === 'prior-commitment' ? env.priorValue?.() : undefined;
    return { complete: prior ?? env.emptyValue(), activeSteps };
  }

  let encoded = plan.initialSource === 'prior-commitment'
    ? (env.priorValue?.() ?? env.emptyValue())
    : env.emptyValue();

  let leading: Uint8Array | undefined;
  for (let index = 0; index < activeSteps.length; index += 1) {
    const step = activeSteps[index]!;
    // Leading is the value before the final active step (earlier rows only).
    if (index === activeSteps.length - 1 && activeSteps.length >= 2) {
      leading = encoded;
    }
    const element = env.resolveElement(step);
    if (element === undefined) {
      throw new Error(
        `resource-fold: cannot evaluate element for collection '${plan.collection}' `
          + `step ${index} (selector=${step.rowSelector ?? '?'}, kind=${step.kind})`,
      );
    }
    if (step.kind === 'assign' && index === 0 && plan.initialSource === 'empty') {
      encoded = element;
    } else {
      encoded = env.appendElement(encoded, element);
    }
  }
  return { leading, complete: encoded, activeSteps };
}
