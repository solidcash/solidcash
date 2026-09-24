/**
 * path-effect activation / settle-time ExecutionContext: typed ExecutionContext binding handler-frame ABI to path-effect schedules.
 *
 * Layout-fold phase 7 (pay-as-you-go): compose selects active path effects under one
 * context that carries frame slots, authenticated args, and the published schedule.
 */

import type { FunctionArgument } from '../Argument.js';
import {
  buildHandlerFrameSchema,
  validateHandlerFrame,
  type HandlerFrameSchema,
  type FrameValidationFailure,
} from './handler-frame-abi.js';
import {
  normalizePathEffectScheduleActivation,
  pathEffectActivationEnvironmentFromArgs,
  selectActivePathEffects,
  type PathEffectActivationEnvironment,
  type PathEffectKind,
  type PublishedPathEffectSchedule,
} from './path-effect-schedule.js';
import { evaluateFoldActivation } from './resource-fold.js';
import {
  buildCompositionPlanFailureReport,
  formatCompositionPlanFailureReport,
  MessageBusDiagnosticError,
  type CompositionPlanFailureReport,
} from './diagnostics.js';

export type ExecutionContextFailure = {
  invariantId: string;
  detail: string;
  slot?: string;
  ordinal?: number;
  /** Multi-participant journal key when failure is attributed under a lifecycle. */
  journalKey?: string;
  handlerId?: string;
  participantIndex?: number;
  nestedScopeId?: number;
};

/** Immutable per-handler execution context for path-effect programs. */
export interface KernelExecutionContext {
  version: 1;
  handlerId: string;
  handlerName?: string;
  /**
   * Compose participant index when this context is bound in a multi-participant composition.
   * Nested scopes keep their own participant namespaces.
   */
  participantIndex?: number;
  /** Nested-compose scope id (parent scope is 0 / absent). */
  nestedScopeId?: number;
  frame: HandlerFrameSchema;
  pathEffectSchedule?: PublishedPathEffectSchedule;
  activationEnv: PathEffectActivationEnvironment;
  /** Authenticated visible handler arguments (same order as frame argument slots). */
  args: readonly FunctionArgument[];
}

export type BuildKernelExecutionContextParams = {
  handlerId: string;
  handlerName?: string;
  participantIndex?: number;
  nestedScopeId?: number;
  /** Visible ABI inputs (internal `__…` names are stripped for the frame). */
  inputs: readonly { name: string; type: string }[];
  args: readonly FunctionArgument[];
  pathEffectSchedule?: PublishedPathEffectSchedule;
  routeContext?: readonly string[];
  journals?: readonly string[];
  cursors?: readonly string[];
  results?: readonly string[];
};

/** Stable journal key for multi-participant / nested-compose contexts. */
export function executionContextJournalKey(context: {
  handlerId: string;
  participantIndex?: number;
  nestedScopeId?: number;
}): string {
  const scope = context.nestedScopeId ?? 0;
  const participant = context.participantIndex ?? -1;
  return `s${scope}:p${participant}:${context.handlerId}`;
}

/** Build a typed ExecutionContext from handler ABI inputs, args, and optional path-effect schedule. */
export function buildKernelExecutionContext(
  params: BuildKernelExecutionContextParams,
): KernelExecutionContext {
  const visible = params.inputs.filter((input) => !input.name.startsWith('__internal__'));
  const frame = buildHandlerFrameSchema({
    handlerId: params.handlerId,
    handlerName: params.handlerName,
    arguments: visible.map((input) => input.name),
    routeContext: params.routeContext,
    journals: params.journals,
    cursors: params.cursors,
    results: params.results,
  });
  const activationEnv = pathEffectActivationEnvironmentFromArgs(visible, params.args);
  return {
    version: 1,
    handlerId: params.handlerId,
    ...(params.handlerName !== undefined && { handlerName: params.handlerName }),
    ...(params.participantIndex !== undefined && { participantIndex: params.participantIndex }),
    ...(params.nestedScopeId !== undefined && { nestedScopeId: params.nestedScopeId }),
    frame,
    ...(params.pathEffectSchedule !== undefined && { pathEffectSchedule: params.pathEffectSchedule }),
    activationEnv,
    args: [...params.args],
  };
}

/**
 * Prove the path-effect program is well-tied to the frame:
 * - handlerInput activations reference in-bound argument indices
 * - boolParam activations name an argument slot when present in the schedule
 * - optional empty stack-effect settlement on the frame schema
 */
export function assertExecutionContextPathProgram(
  context: KernelExecutionContext,
): {
  ok: boolean;
  failures: readonly ExecutionContextFailure[];
  activeEffects: PublishedPathEffectSchedule['effects'];
  frame: ReturnType<typeof validateHandlerFrame>;
} {
  const failures: ExecutionContextFailure[] = [];
  const argumentSlots = context.frame.slots.filter((slot) => slot.kind === 'argument');
  const argumentNames = new Set(argumentSlots.map((slot) => slot.name));
  const schedule = context.pathEffectSchedule;
  const activeEffects = schedule === undefined
    ? []
    : selectActivePathEffects(schedule, context.activationEnv);

  if (schedule !== undefined && schedule.version === 1) {
    for (const effect of schedule.effects) {
      const recipe = normalizePathEffectScheduleActivation(effect.activation);
      const visit = (node: typeof recipe): void => {
        if (node === undefined) return;
        if (node.kind === 'handlerInput' || node.kind === 'handlerInputEq'
          || node.kind === 'handlerInputCmp') {
          if (!Number.isInteger(node.inputIndex) || node.inputIndex < 0
            || node.inputIndex >= argumentSlots.length) {
            failures.push({
              invariantId: 'path-effect-oob-handler-input',
              detail: `effect ${effect.ordinal} ${node.kind} ${node.inputIndex} outside frame arity ${argumentSlots.length}`,
              ordinal: effect.ordinal,
            });
          }
        } else if (node.kind === 'handlerInputPairCmp') {
          for (const index of [node.leftIndex, node.rightIndex]) {
            if (!Number.isInteger(index) || index < 0 || index >= argumentSlots.length) {
              failures.push({
                invariantId: 'path-effect-oob-handler-input',
                detail: `effect ${effect.ordinal} handlerInputPairCmp ${index} outside frame arity ${argumentSlots.length}`,
                ordinal: effect.ordinal,
              });
            }
          }
        } else if (node.kind === 'boolParam' || node.kind === 'boolParamEq'
          || node.kind === 'namedInputEq' || node.kind === 'namedInputCmp') {
          if (!argumentNames.has(node.name)) {
            failures.push({
              invariantId: 'path-effect-unknown-bool-param',
              detail: `effect ${effect.ordinal} ${node.kind} '${node.name}' is not a frame argument slot`,
              ordinal: effect.ordinal,
              slot: node.name,
            });
          }
        } else if (node.kind === 'not') {
          visit(node.of);
        } else if (node.kind === 'and' || node.kind === 'or') {
          visit(node.left);
          visit(node.right);
        }
      };
      visit(recipe);
    }
  }

  // Empty effect list settles the frame (no anonymous drift) — proves frame ABI is usable under context.
  const frame = validateHandlerFrame(context.frame, []);
  for (const failure of frame.failures) {
    failures.push({
      invariantId: `frame-${failure.invariantId}`,
      detail: failure.detail,
      ...(failure.slot !== undefined && { slot: failure.slot }),
    });
  }

  return {
    ok: failures.length === 0 && frame.ok,
    failures,
    activeEffects,
    frame,
  };
}

/** Active ordinals under this ExecutionContext, optionally restricted by effect kind. */
export function activeOrdinalsUnderContext(
  context: KernelExecutionContext,
  kind?: PathEffectKind | string,
): readonly number[] {
  if (context.pathEffectSchedule === undefined) return [];
  return selectActivePathEffects(context.pathEffectSchedule, context.activationEnv)
    .filter((effect) => kind === undefined || effect.kind === kind)
    .map((effect) => effect.ordinal);
}

/** Active stateWrite ordinals under this ExecutionContext. */
export function activeStateWriteOrdinalsUnderContext(
  context: KernelExecutionContext,
): readonly number[] {
  return activeOrdinalsUnderContext(context, 'stateWrite');
}

/**
 * Whether effects of `kind` with the given ordinals are active under this context.
 * Absent schedule ⇒ always active (legacy). Scheduled ordinals require activation truth.
 */
export function allowsEffectUnderExecutionContext(
  context: KernelExecutionContext,
  kind: PathEffectKind | string,
  effectOrdinals: readonly number[] | undefined,
): boolean {
  if (context.pathEffectSchedule === undefined || effectOrdinals === undefined
    || effectOrdinals.length === 0) {
    return true;
  }
  const scheduled = effectOrdinals.filter((ordinal) => (
    context.pathEffectSchedule!.effects.some((effect) => (
      effect.kind === kind && effect.ordinal === ordinal
    ))
  ));
  if (scheduled.length === 0) return true;
  return scheduled.every((ordinal) => {
    const effect = context.pathEffectSchedule!.effects.find((candidate) => candidate.ordinal === ordinal);
    if (effect === undefined) return false;
    return evaluateFoldActivation(
      normalizePathEffectScheduleActivation(effect.activation),
      context.activationEnv,
    );
  });
}

/**
 * Whether a write with the given mutation ordinals is active under this context.
 * Absent schedule ⇒ always active (legacy). Scheduled ordinals require activation truth.
 */
export function allowsWriteUnderExecutionContext(
  context: KernelExecutionContext,
  mutationEffectOrdinals: readonly number[] | undefined,
): boolean {
  return allowsEffectUnderExecutionContext(context, 'stateWrite', mutationEffectOrdinals);
}

/**
 * settle-time ExecutionContext: deeper EC-driven planning — structured active-effect plan for one ExecutionContext.
 * Compose/admit can consume this beyond per-kind selection gates.
 */
export type ExecutionContextEffectPlan = {
  handlerId: string;
  handlerName?: string;
  participantIndex?: number;
  nestedScopeId?: number;
  journalKey: string;
  activeWrites: readonly number[];
  activeEvents: readonly number[];
  activeTransfers: readonly number[];
  activeEffects: PublishedPathEffectSchedule['effects'];
};

/** Build a planning view of active path effects under one ExecutionContext. */
export function planEffectsUnderExecutionContext(
  context: KernelExecutionContext,
): ExecutionContextEffectPlan {
  const activeEffects = context.pathEffectSchedule === undefined
    ? []
    : selectActivePathEffects(context.pathEffectSchedule, context.activationEnv);
  return {
    handlerId: context.handlerId,
    ...(context.handlerName !== undefined && { handlerName: context.handlerName }),
    ...(context.participantIndex !== undefined && { participantIndex: context.participantIndex }),
    ...(context.nestedScopeId !== undefined && { nestedScopeId: context.nestedScopeId }),
    journalKey: executionContextJournalKey(context),
    activeWrites: activeEffects.filter((effect) => effect.kind === 'stateWrite').map((e) => e.ordinal),
    activeEvents: activeEffects.filter((effect) => effect.kind === 'event').map((e) => e.ordinal),
    activeTransfers: activeEffects.filter((effect) => effect.kind === 'transfer').map((e) => e.ordinal),
    activeEffects,
  };
}

/** Aggregate effect plans for every registered context on a settle-time lifecycle. */
export function planEffectsUnderLifecycle(
  lifecycle: ExecutionContextLifecycle,
): readonly ExecutionContextEffectPlan[] {
  return lifecycle.list().map(planEffectsUnderExecutionContext);
}

export type { FrameValidationFailure };

/** Settle-time lifecycle phases for ExecutionContext across compose. */
export type ExecutionContextLifecyclePhase = 'open' | 'bound' | 'asserted' | 'settled';

/** Journal event kinds for multi-participant / nested-compose ExecutionContext lifecycles. */
export type ExecutionContextJournalEventKind =
  | 'register'
  | 'assert'
  | 'assert-fail'
  | 'settle'
  | 'push-scope'
  | 'pop-scope'
  | 'clear';

export type ExecutionContextJournalEvent = {
  kind: ExecutionContextJournalEventKind;
  seq: number;
  journalKey?: string;
  handlerId?: string;
  participantIndex?: number;
  nestedScopeId?: number;
  detail?: string;
};

function freezeExecutionContext(context: KernelExecutionContext): KernelExecutionContext {
  return Object.freeze({
    ...context,
    frame: Object.freeze({
      ...context.frame,
      slots: Object.freeze([...context.frame.slots]),
    }),
    activationEnv: Object.freeze({
      ...(context.activationEnv.boolParams !== undefined
        && { boolParams: Object.freeze({ ...context.activationEnv.boolParams }) }),
      ...(context.activationEnv.handlerInputs !== undefined
        && { handlerInputs: Object.freeze([...context.activationEnv.handlerInputs]) }),
    }),
    args: Object.freeze([...context.args]),
    ...(context.pathEffectSchedule !== undefined && {
      pathEffectSchedule: Object.freeze({
        version: 1 as const,
        effects: Object.freeze([...context.pathEffectSchedule.effects]),
      }),
    }),
  });
}

/**
 * path-effect activation/settle-time ExecutionContext settle-time lifecycle: register contexts → assert path programs → settle (freeze).
 * Owned by CompositionSettlementSession so two compositions never share mutable contexts.
 *
 * Multi-participant / nested-compose: contexts are keyed by
 * {@link executionContextJournalKey} (`s{scope}:p{participant}:{handlerId}`) so the same
 * handler may bind under distinct participants or nested scopes. Nested compose pushes a
 * scope; registrations without an explicit `nestedScopeId` inherit the current scope.
 */
export class ExecutionContextLifecycle {
  private phase: ExecutionContextLifecyclePhase = 'open';
  /** Journal-key → frozen context. */
  private readonly contexts = new Map<string, KernelExecutionContext>();
  /** Asserted journal keys. */
  private readonly asserted = new Set<string>();
  private readonly journalLog: ExecutionContextJournalEvent[] = [];
  private seq = 0;
  /** Current nested-compose scope (0 = root). */
  private nestedScopeId = 0;
  private readonly scopeStack: number[] = [];
  private nextScopeId = 1;

  getPhase(): ExecutionContextLifecyclePhase {
    return this.phase;
  }

  currentNestedScope(): number {
    return this.nestedScopeId;
  }

  journal(): readonly ExecutionContextJournalEvent[] {
    return [...this.journalLog];
  }

  private record(
    kind: ExecutionContextJournalEventKind,
    fields: Omit<ExecutionContextJournalEvent, 'kind' | 'seq'> = {},
  ): void {
    this.journalLog.push({ kind, seq: this.seq, ...fields });
    this.seq += 1;
  }

  /**
   * Enter a nested-compose scope. Subsequent registrations without an explicit
   * `nestedScopeId` inherit the new scope id. Fail-closed after settle.
   */
  pushNestedScope(): number {
    if (this.phase === 'settled') {
      throw new Error('execution-context: cannot pushNestedScope after settle');
    }
    this.scopeStack.push(this.nestedScopeId);
    const scopeId = this.nextScopeId;
    this.nextScopeId += 1;
    this.nestedScopeId = scopeId;
    // Scope push alone does not demote asserted → bound; a later register does.
    if (this.phase === 'open') this.phase = 'bound';
    this.record('push-scope', { nestedScopeId: scopeId });
    return scopeId;
  }

  /** Leave the current nested-compose scope. Root scope (0) cannot be popped. */
  popNestedScope(): number {
    if (this.phase === 'settled') {
      throw new Error('execution-context: cannot popNestedScope after settle');
    }
    if (this.scopeStack.length === 0) {
      throw new Error('execution-context: cannot popNestedScope at root scope');
    }
    const leaving = this.nestedScopeId;
    this.nestedScopeId = this.scopeStack.pop()!;
    this.record('pop-scope', { nestedScopeId: leaving, detail: `return-to=${this.nestedScopeId}` });
    return leaving;
  }

  /** Register (or replace while open/bound) a handler ExecutionContext before settle. */
  register(context: KernelExecutionContext): void {
    if (this.phase === 'settled') {
      throw new Error(
        'execution-context: cannot register after settle '
          + `(handler=${context.handlerId})`,
      );
    }
    const stamped: KernelExecutionContext = context.nestedScopeId === undefined
      && this.nestedScopeId !== 0
      ? { ...context, nestedScopeId: this.nestedScopeId }
      : context;
    const key = executionContextJournalKey(stamped);
    if (this.phase === 'asserted') {
      this.asserted.delete(key);
      this.phase = 'bound';
    } else if (this.phase === 'open') {
      this.phase = 'bound';
    }
    const frozen = freezeExecutionContext(stamped);
    this.contexts.set(key, frozen);
    this.record('register', {
      journalKey: key,
      handlerId: stamped.handlerId,
      participantIndex: stamped.participantIndex,
      nestedScopeId: stamped.nestedScopeId ?? 0,
    });
  }

  /**
   * Lookup by handler id under the current scope with no participant (legacy single-binding).
   * When multiple participants share a handler id, use {@link getByJournalKey} or
   * {@link listForHandler}.
   */
  get(handlerId: string): KernelExecutionContext | undefined {
    const legacyKey = executionContextJournalKey({
      handlerId,
      nestedScopeId: this.nestedScopeId,
    });
    const direct = this.contexts.get(legacyKey);
    if (direct !== undefined) return direct;
    // Fallback: unique handler binding anywhere in the registry.
    const matches = this.listForHandler(handlerId);
    return matches.length === 1 ? matches[0] : undefined;
  }

  getByJournalKey(journalKey: string): KernelExecutionContext | undefined {
    return this.contexts.get(journalKey);
  }

  listForHandler(handlerId: string): readonly KernelExecutionContext[] {
    return [...this.contexts.values()].filter((context) => context.handlerId === handlerId);
  }

  listForParticipant(participantIndex: number): readonly KernelExecutionContext[] {
    return [...this.contexts.values()].filter(
      (context) => context.participantIndex === participantIndex,
    );
  }

  listForScope(nestedScopeId: number): readonly KernelExecutionContext[] {
    return [...this.contexts.values()].filter(
      (context) => (context.nestedScopeId ?? 0) === nestedScopeId,
    );
  }

  list(): readonly KernelExecutionContext[] {
    return [...this.contexts.values()];
  }

  /**
   * Assert every registered context's path program (frame ↔ schedule).
   * Empty registry is a no-op success (legacy compositions without schedules).
   */
  assertAll(): {
    ok: boolean;
    failures: readonly ExecutionContextFailure[];
    activeByHandler: ReadonlyMap<string, PublishedPathEffectSchedule['effects']>;
    activeByJournalKey: ReadonlyMap<string, PublishedPathEffectSchedule['effects']>;
  } {
    if (this.phase === 'settled') {
      throw new Error('execution-context: cannot assert after settle');
    }
    const failures: ExecutionContextFailure[] = [];
    const activeByHandler = new Map<string, PublishedPathEffectSchedule['effects']>();
    const activeByJournalKey = new Map<string, PublishedPathEffectSchedule['effects']>();
    for (const [journalKey, context] of this.contexts) {
      const proof = assertExecutionContextPathProgram(context);
      if (!proof.ok) {
        for (const failure of proof.failures) {
          failures.push({
            ...failure,
            detail: `${journalKey}: ${failure.detail}`,
            journalKey,
            handlerId: context.handlerId,
            participantIndex: context.participantIndex,
            nestedScopeId: context.nestedScopeId ?? 0,
          });
        }
        this.record('assert-fail', {
          journalKey,
          handlerId: context.handlerId,
          participantIndex: context.participantIndex,
          nestedScopeId: context.nestedScopeId ?? 0,
          detail: proof.failures.map((failure) => failure.detail).join('; '),
        });
      } else {
        this.asserted.add(journalKey);
        activeByJournalKey.set(journalKey, proof.activeEffects);
        activeByHandler.set(context.handlerId, proof.activeEffects);
        this.record('assert', {
          journalKey,
          handlerId: context.handlerId,
          participantIndex: context.participantIndex,
          nestedScopeId: context.nestedScopeId ?? 0,
        });
      }
    }
    if (failures.length === 0) {
      this.phase = this.contexts.size === 0 ? this.phase : 'asserted';
    }
    return { ok: failures.length === 0, failures, activeByHandler, activeByJournalKey };
  }

  /**
   * Freeze the lifecycle for settlement. Requires every registered context to have been asserted.
   */
  settle(): void {
    if (this.phase === 'settled') return;
    if (this.contexts.size > 0 && this.phase !== 'asserted') {
      throw new Error(
        'execution-context: settle requires assertAll after register '
          + `(phase=${this.phase}, registered=${this.contexts.size}, asserted=${this.asserted.size})`,
      );
    }
    for (const journalKey of this.contexts.keys()) {
      if (!this.asserted.has(journalKey)) {
        throw new Error(
          `execution-context: settle missing assert for ${journalKey}`,
        );
      }
    }
    this.phase = 'settled';
    this.record('settle', {
      detail: `contexts=${this.contexts.size}`,
      nestedScopeId: this.nestedScopeId,
    });
  }

  /** Active state-write ordinals for a settled (or asserted) handler (legacy unique lookup). */
  activeStateWrites(handlerId: string): readonly number[] {
    return this.activeOrdinals(handlerId, 'stateWrite');
  }

  /** Active ordinals for a handler, optionally restricted by effect kind. */
  activeOrdinals(handlerId: string, kind?: PathEffectKind | string): readonly number[] {
    const context = this.get(handlerId);
    if (context === undefined) return [];
    return activeOrdinalsUnderContext(context, kind);
  }

  /** Active state-write ordinals for an exact journal key. */
  activeStateWritesByJournalKey(journalKey: string): readonly number[] {
    return this.activeOrdinalsByJournalKey(journalKey, 'stateWrite');
  }

  /** Active ordinals for an exact journal key, optionally restricted by effect kind. */
  activeOrdinalsByJournalKey(
    journalKey: string,
    kind?: PathEffectKind | string,
  ): readonly number[] {
    const context = this.contexts.get(journalKey);
    if (context === undefined) return [];
    return activeOrdinalsUnderContext(context, kind);
  }

  clear(): void {
    this.contexts.clear();
    this.asserted.clear();
    this.scopeStack.length = 0;
    this.nestedScopeId = 0;
    this.nextScopeId = 1;
    this.phase = 'open';
    this.record('clear');
    // Drop prior journal history after recording the clear marker for this reset.
    this.journalLog.splice(0, this.journalLog.length - 1);
  }
}

export function createExecutionContextLifecycle(): ExecutionContextLifecycle {
  return new ExecutionContextLifecycle();
}

/** Register a freshly built context on a settle-time lifecycle. */
export function registerExecutionContextOnSettlement(
  lifecycle: ExecutionContextLifecycle,
  params: BuildKernelExecutionContextParams,
): KernelExecutionContext {
  const withScope: BuildKernelExecutionContextParams = {
    ...params,
    ...(params.nestedScopeId === undefined && lifecycle.currentNestedScope() !== 0
      && { nestedScopeId: lifecycle.currentNestedScope() }),
  };
  const context = buildKernelExecutionContext(withScope);
  lifecycle.register(context);
  return context;
}

/**
 * Build an structured plan-failure-shaped plan-failure report for ExecutionContext settle failures.
 * Carries journal key, participant, nested scope, and invariant attribution.
 */
export function buildExecutionContextSettleFailureReport(
  failures: readonly ExecutionContextFailure[],
  extras?: {
    phase?: CompositionPlanFailureReport['phase'];
    journalSummary?: readonly ExecutionContextJournalEvent[];
  },
): CompositionPlanFailureReport {
  if (failures.length === 0) {
    throw new Error('execution-context: settle failure report requires at least one failure');
  }
  const primary = failures[0]!;
  const detail = failures.map((failure) => failure.detail).join('; ');
  const journalTail = extras?.journalSummary === undefined
    ? undefined
    : extras.journalSummary
      .filter((event) => event.kind === 'assert-fail' || event.kind === 'register')
      .slice(-8)
      .map((event) => `${event.kind}:${event.journalKey ?? event.nestedScopeId ?? ''}`)
      .join(',');
  return buildCompositionPlanFailureReport({
    kind: 'execution-context',
    code: 'L3_EXECUTION_CONTEXT',
    phase: extras?.phase ?? 'covenantValidation',
    invariantId: primary.invariantId,
    participant: primary.participantIndex,
    handler: primary.handlerId ?? primary.journalKey,
    detail: journalTail === undefined ? detail : `${detail}; journal=[${journalTail}]`,
    expected: primary.journalKey,
    actual: primary.ordinal,
    message: `execution-context settle failed: ${detail}`,
  });
}

/** Throw a structured MessageBusDiagnosticError for settle-time ExecutionContext failures. */
export function throwExecutionContextSettleFailure(
  failures: readonly ExecutionContextFailure[],
  lifecycle?: ExecutionContextLifecycle,
): never {
  const report = buildExecutionContextSettleFailureReport(failures, {
    journalSummary: lifecycle?.journal(),
  });
  const formatted = formatCompositionPlanFailureReport(report);
  throw new MessageBusDiagnosticError(
    'L3_EXECUTION_CONTEXT',
    formatted,
    {
      invariantId: report.invariantId,
      participant: report.participant,
      handler: report.handler,
      planFailure: report,
      settlementPaths: failures
        .map((failure) => failure.journalKey)
        .filter((key): key is string => key !== undefined),
    },
    false,
    report,
  );
}

/**
 * Assert every registered path program then freeze for settlement.
 * Empty registry is allowed (legacy compositions without ExecutionContext binding).
 * Failures throw {@link MessageBusDiagnosticError} with an structured plan-failure `planFailure` trailer.
 */
export function assertAndSettleExecutionContexts(
  lifecycle: ExecutionContextLifecycle,
): void {
  if (lifecycle.getPhase() === 'settled') return;
  if (lifecycle.getPhase() === 'open' && lifecycle.list().length === 0) {
    lifecycle.settle();
    return;
  }
  const result = lifecycle.assertAll();
  if (!result.ok) {
    throwExecutionContextSettleFailure(result.failures, lifecycle);
  }
  lifecycle.settle();
}
