/**
 * Materialization mode (materialization-mode recipe / VM-validator-only finalization).
 *
 * `recipe` — evaluate compiler-authored transition recipes once; VM validates only.
 * `devOracle` — legacy probe/repair/converge path for development diagnostics (explicit opt-in).
 */

export type MaterializationMode = 'recipe' | 'devOracle';

/**
 * Default materialization mode is `recipe` (VM validates only).
 * Opt into `devOracle` for diagnostic converge/repair paths.
 */
let activeMode: MaterializationMode = 'recipe';

export function getMaterializationMode(): MaterializationMode {
  return activeMode;
}

export function setMaterializationMode(mode: MaterializationMode): void {
  activeMode = mode;
}

/** True when VM may only validate — no failed-trace commitment mining. */
export function isVmValidationOnly(): boolean {
  return activeMode === 'recipe';
}

/**
 * VM-validator-only finalization: whether STB may enter VM-mined
 * computed-output repair after a covenant failure.
 * Recipe → false (validator only). Explicit `devOracle` → true (legacy planner loop).
 */
export function allowsFinalizationVmRepairs(): boolean {
  return !isVmValidationOnly();
}

/**
 * Guard for converge/repair: recipe mode forbids applying commitments mined from failing VM frames.
 * Callers must invoke this before applying any VM-extracted proposal.
 */
export function assertRecipeModeDoesNotProbe(
  action: 'converge' | 'extractFromFailedVm' | 'finalizationRepair',
): void {
  if (activeMode !== 'recipe') return;
  if (action === 'extractFromFailedVm') {
    throw new Error(
      'materialization: recipe mode forbids extracting expected state from failed VM frames',
    );
  }
  if (action === 'finalizationRepair') {
    throw new Error(
      'materialization: recipe mode forbids VM-mined finalization repairs (validator only)',
    );
  }
}

/** Preflight converge calls this before applying any VM-mined commitment proposals. */
export function refuseVmExtractedRepairsIfRecipe(proposalCount: number): void {
  if (proposalCount > 0 && activeMode === 'recipe') {
    assertRecipeModeDoesNotProbe('extractFromFailedVm');
  }
}

/**
 * unified would-apply recipe gate: single family gate for resource / value-chunk / dynamic-chunk would-apply counts.
 * Domain helpers compute `wouldApply` via their own counters, then funnel here so recipe
 * refuse semantics cannot drift across converge surfaces.
 */
export function gateWouldApplyRepairsIfRecipe(wouldApplyCount: number): number {
  refuseVmExtractedRepairsIfRecipe(wouldApplyCount);
  return wouldApplyCount;
}

/**
 * deferred-compute recipe gate: whether compose may use deferred-compute VM discovery / cache as planner authority.
 * Recipe → false (recipe-once; VM validates only). Explicit `devOracle` → true.
 */
export function allowsDeferredComputeVmDiscovery(): boolean {
  return !isVmValidationOnly();
}

/**
 * VM-validator-only finalization: call at the start of finalization's post-failure repair path.
 * Under recipe, throws before any `_repairComputedChunkOutput` mutation.
 */
export function refuseFinalizationVmRepairsIfRecipe(): void {
  assertRecipeModeDoesNotProbe('finalizationRepair');
}
