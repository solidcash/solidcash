/**
 * Materialization mode (backlog item 9 / F9′).
 *
 * `recipe` — evaluate compiler-authored transition recipes once; VM validates only.
 * `devOracle` — legacy probe/repair/converge path for development diagnostics (explicit opt-in).
 */

export type MaterializationMode = 'recipe' | 'devOracle';

/**
 * F9′: default is `recipe` (VM validates only).
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
 * Guard for converge/repair: recipe mode forbids applying commitments mined from failing VM frames.
 * Callers must invoke this before applying any VM-extracted proposal.
 */
export function assertRecipeModeDoesNotProbe(action: 'converge' | 'extractFromFailedVm'): void {
  if (activeMode === 'recipe' && action === 'extractFromFailedVm') {
    throw new Error(
      'materialization: recipe mode forbids extracting expected state from failed VM frames',
    );
  }
}

/** Preflight converge calls this before applying any VM-mined commitment proposals. */
export function refuseVmExtractedRepairsIfRecipe(proposalCount: number): void {
  if (proposalCount > 0 && activeMode === 'recipe') {
    assertRecipeModeDoesNotProbe('extractFromFailedVm');
  }
}
