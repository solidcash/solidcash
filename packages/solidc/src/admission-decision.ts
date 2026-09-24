/**
 * Pure speculative-admission decision record (backlog item 13).
 *
 * Analyzer produces an immutable per-handler admit/refuse with a closed KERNEL_* reason
 * before route codegen. Codegen must succeed for that exact set or report an internal defect —
 * never silently narrow based on exception order.
 */

export type KernelAdmissionReason =
  | 'ADMITTED'
  | 'KERNEL_LAYOUT'
  | 'KERNEL_UNBOUNDED_KEY'
  | 'KERNEL_TX_SIGNATURE'
  | 'KERNEL_OPAQUE_EFFECT'
  | 'KERNEL_FOREIGN_DELEGATE'
  | 'KERNEL_LIFECYCLE'
  | 'KERNEL_INTERNAL_DEFECT';

export type HandlerAdmissionDecision = {
  handlerId: string;
  handlerName?: string;
  admitted: boolean;
  reason: KernelAdmissionReason;
  detail?: string;
};

export type AdmissionDecisionSet = {
  /** Frozen after analysis; codegen must not mutate. */
  readonly decisions: readonly HandlerAdmissionDecision[];
  readonly admittedHandlerIds: readonly string[];
};

export function buildAdmissionDecisionSet(
  decisions: readonly HandlerAdmissionDecision[],
): AdmissionDecisionSet {
  const frozen = Object.freeze(decisions.map((d) => Object.freeze({ ...d })));
  const admittedHandlerIds = Object.freeze(
    frozen.filter((d) => d.admitted).map((d) => d.handlerId),
  );
  return Object.freeze({ decisions: frozen, admittedHandlerIds });
}

/**
 * Codegen guard: the admitted set presented to route emission must equal the analysis decision.
 * A mismatch is an internal compiler defect (not a silent retry narrowing).
 */
export function assertAdmissionSetUnchanged(
  analysis: AdmissionDecisionSet,
  codegenHandlerIds: readonly string[],
): void {
  const expected = [...analysis.admittedHandlerIds].sort();
  const actual = [...codegenHandlerIds].sort();
  if (expected.length !== actual.length || expected.some((id, i) => id !== actual[i])) {
    throw new Error(
      `KERNEL_INTERNAL_DEFECT: codegen admitted set [${actual.join(',')}] `
        + `!== analysis set [${expected.join(',')}]`,
    );
  }
}

/** Minimal codegen-published handler shape (never attribution span keys). */
export type PublishedMessageBusHandler = {
  name: string;
  eligible?: boolean;
  selector?: string;
};

/**
 * Admission stamp sole gate: every codegen-published eligible handler must appear as admitted in analysis
 * (matched by handlerName). Second argument is only `artifact.messageBus.handlers` — never span keys.
 */
/** Test/observability: increments only when the shipped gate runs. */
let publishedHandlerAdmissionGateInvocations = 0;

export function clearPublishedHandlerAdmissionGateInvocations(): void {
  publishedHandlerAdmissionGateInvocations = 0;
}

export function getPublishedHandlerAdmissionGateInvocations(): number {
  return publishedHandlerAdmissionGateInvocations;
}

export function assertPublishedHandlersMatchAdmission(
  analysis: AdmissionDecisionSet,
  publishedHandlers: readonly PublishedMessageBusHandler[],
): void {
  publishedHandlerAdmissionGateInvocations += 1;
  const admittedNames = new Set(
    analysis.decisions
      .filter((decision) => decision.admitted)
      .map((decision) => decision.handlerName)
      .filter((name): name is string => typeof name === 'string' && name.length > 0),
  );
  for (const handler of publishedHandlers) {
    if (handler.eligible === true && !admittedNames.has(handler.name)) {
      throw new Error(
        `KERNEL_INTERNAL_DEFECT: eligible handler '${handler.name}' not in analysis admitted set `
        + `[${[...admittedNames].sort().join(',')}]`,
      );
    }
  }
}

/** Refused handler names from analysis (for artifact stamp / non-tautology proof). */
export function refusedHandlerNamesFromAnalysis(
  analysis: AdmissionDecisionSet,
): readonly string[] {
  return Object.freeze(
    [...new Set(
      analysis.decisions
        .filter((decision) => !decision.admitted)
        .map((decision) => decision.handlerName)
        .filter((name): name is string => typeof name === 'string' && name.length > 0),
    )].sort(),
  );
}

/** Stable published list of admitted handler names for artifact.messageBus.admittedHandlerIds. */
export function admittedHandlerNamesFromAnalysis(
  analysis: AdmissionDecisionSet,
): readonly string[] {
  return Object.freeze(
    [...new Set(
      analysis.decisions
        .filter((decision) => decision.admitted)
        .map((decision) => decision.handlerName)
        .filter((name): name is string => typeof name === 'string' && name.length > 0),
    )].sort(),
  );
}
