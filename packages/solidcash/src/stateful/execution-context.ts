/**
 * Settlement-time execution-context registry.
 *
 * A direct call registers no route execution contexts; the lifecycle is kept so settlement code can ask for
 * one without a special case.
 */

export interface ExecutionContextEffectPlan {
  [key: string]: unknown;
}

export interface KernelExecutionContext {
  activationEnv: Readonly<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface ExecutionContextLifecycle {
  getByJournalKey(key: string): KernelExecutionContext | undefined;
  currentNestedScope(): number;
  getPhase(): string;
  pushNestedScope(): number;
  popNestedScope(): void;
  clear(): void;
}

/** One isolated no-op lifecycle per settlement session. */
export function createExecutionContextLifecycle(): ExecutionContextLifecycle {
  return {
    getByJournalKey: () => undefined,
    currentNestedScope: () => 0,
    getPhase: () => 'idle',
    pushNestedScope: () => 0,
    popNestedScope: () => undefined,
    clear: () => undefined,
  };
}

export function executionContextJournalKey(_input: {
  handlerId: string; participantIndex?: number; nestedScopeId?: number;
}): string {
  return '';
}
