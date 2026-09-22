/**
 * Immutable planning phase boundaries (backlog item 11).
 * Each phase consumes and returns frozen structures; no post-resolution output mutation.
 */

export type PlanningPhase =
  | 'sourceAnalysis'
  | 'admittedHandlerIr'
  | 'symbolicResourcePlan'
  | 'absoluteLayout'
  | 'witnessMaterialization'
  | 'immutableTransaction'
  | 'covenantValidation';

const PHASE_ORDER: readonly PlanningPhase[] = [
  'sourceAnalysis',
  'admittedHandlerIr',
  'symbolicResourcePlan',
  'absoluteLayout',
  'witnessMaterialization',
  'immutableTransaction',
  'covenantValidation',
];

export type PhaseArtifact<T> = {
  phase: PlanningPhase;
  payload: Readonly<T>;
};

export function advancePhase<T, U>(
  current: PhaseArtifact<T>,
  nextPhase: PlanningPhase,
  map: (payload: Readonly<T>) => U,
): PhaseArtifact<U> {
  const curIdx = PHASE_ORDER.indexOf(current.phase);
  const nextIdx = PHASE_ORDER.indexOf(nextPhase);
  if (nextIdx !== curIdx + 1) {
    throw new Error(
      `planning-phases: cannot advance ${current.phase} → ${nextPhase} (must be sequential)`,
    );
  }
  return {
    phase: nextPhase,
    payload: Object.freeze(map(current.payload)) as Readonly<U>,
  };
}

export function startPhase<T>(payload: T): PhaseArtifact<T> {
  return { phase: 'sourceAnalysis', payload: Object.freeze(payload) as Readonly<T> };
}

export function assertGeometryFrozen(phase: PlanningPhase): void {
  if (PHASE_ORDER.indexOf(phase) < PHASE_ORDER.indexOf('absoluteLayout')) {
    throw new Error('planning-phases: geometry not yet frozen');
  }
}
