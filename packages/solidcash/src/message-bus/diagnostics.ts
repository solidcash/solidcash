import type { PlanningPhase } from './planning-phases.js';

/** Stable diagnostic identifiers for invocation-callManifest construction failures. */
export type MessageBusDiagnosticCode =
  | 'L3_ALIAS_UNRESOLVED'
  | 'L3_ARTIFACT_FINGERPRINT_CONFLICT'
  | 'L3_DUPLICATE_OUTPOINT'
  | 'L3_INPUT_AUTHORITY_CONFLICT'
  | 'L3_INVOCATION_LIMIT'
  | 'L3_LAYOUT_INVARIANT'
  | 'L3_MUTABLE_ARTIFACT_UNSUPPORTED'
  | 'L3_PARTICIPANT_LIMIT'
  | 'L3_OWNER_ARTIFACT_CONFLICT'
  | 'L3_PROTOCOL_METADATA_MALFORMED'
  | 'L3_PROTOCOL_VERSION_UNSUPPORTED'
  | 'L3_RECURSIVE_CLOSURE'
  | 'L3_RESOURCE_CAPACITY'
  | 'L3_RESOURCE_UNRESOLVED'
  | 'L3_RESULT_DEPENDENCY_INVALID'
  | 'L3_FUTURE_RESULT_DEPENDENCY'
  | 'L3_TRANSCRIPT_ROW_INCONSISTENT'
  | 'L3_TRANSCRIPT_EFFECT_UNIMPLEMENTED'
  | 'L3_UNBOUNDED_EXTERNAL_CALL_LOOP'
  | 'MESSAGE_BUS_FINALIZED_BYTE_LIMIT'
  | 'L3_VM_RESOURCE_LIMIT'
  | 'L3_GRAPH_DEPTH_LIMIT'
  | 'L3_MESSAGE_BUS_ENVELOPE_MALFORMED'
  | 'L3_MESSAGE_BUS_VERSION_UNSUPPORTED'
  | 'L3_SETTLEMENT_AUTHORITY_CONFLICT'
  | 'L3_EXECUTION_CONTEXT'
  | 'L3_TARGET_UNRESOLVED'
  | 'L3_TARGET_EXHAUSTED';

export interface MessageBusDiagnosticContext {
  invocationIds?: readonly number[];
  callChain?: readonly string[];
  callsiteId?: number;
  callsiteLocation?: { line: number; column: number };
  ownerIdentity?: string;
  interfaceName?: string;
  measured?: number;
  limit?: number;
  metadataField?: string;
  actual?: unknown;
  expected?: unknown;
  participant?: number;
  inputIdentity?: string;
  resourceIdentity?: string;
  artifactFingerprint?: string;
  stateLayoutFingerprint?: string;
  settlementPaths?: readonly string[];
  handler?: string;
  inputIndex?: number;
  rawVmReason?: string;
  consumerInvocation?: number;
  producerInvocation?: number;
  cyclicEdge?: readonly [number, number];
  keyIdentity?: string;
  rule?: string;
  /** Layout-invariant id (e.g. final-chunk-locking-bytecode, pred-out-physical-offset). */
  invariantId?: string;
  expectedOutput?: number;
  actualOutput?: number;
  resource?: string;
  /** structured plan-failure: structured composition plan failure report (when built). */
  planFailure?: CompositionPlanFailureReport;
}

/**
 * structured plan-failure: structured composition plan failure report.
 * Plan-level failures carry phase / invariant / participant / expected-actual fields
 * above raw opcode/IP + env dumps.
 */
export type CompositionPlanFailureKind =
  | 'layout-invariant'
  | 'compose-authority'
  | 'kernel-plan'
  | 'execution-context'
  | 'other';

export interface CompositionPlanFailureReport {
  version: 1;
  kind: CompositionPlanFailureKind;
  code: MessageBusDiagnosticCode | string;
  /** Planning phase when known (absoluteLayout, witnessMaterialization, …). */
  phase?: PlanningPhase;
  invariantId?: string;
  participant?: number;
  resource?: string;
  handler?: string;
  expected?: unknown;
  actual?: unknown;
  detail?: string;
  /** Human-readable summary (same text as the thrown Error message body where applicable). */
  message: string;
}

/** Build a versioned structured plan failure report from plan-level attribution fields. */
export function buildCompositionPlanFailureReport(params: {
  kind?: CompositionPlanFailureKind;
  code?: MessageBusDiagnosticCode | string;
  phase?: PlanningPhase;
  invariantId?: string;
  participant?: number;
  resource?: string;
  handler?: string;
  expected?: unknown;
  actual?: unknown;
  detail?: string;
  message: string;
}): CompositionPlanFailureReport {
  if (params.message.trim().length === 0) {
    throw new Error('composition-plan-failure: message must be non-empty');
  }
  return {
    version: 1,
    kind: params.kind ?? (params.invariantId !== undefined ? 'layout-invariant' : 'other'),
    code: params.code ?? (params.invariantId !== undefined ? 'L3_LAYOUT_INVARIANT' : 'L3_LAYOUT_INVARIANT'),
    ...(params.phase !== undefined && { phase: params.phase }),
    ...(params.invariantId !== undefined && { invariantId: params.invariantId }),
    ...(params.participant !== undefined && { participant: params.participant }),
    ...(params.resource !== undefined && { resource: params.resource }),
    ...(params.handler !== undefined && { handler: params.handler }),
    ...(params.expected !== undefined && { expected: params.expected }),
    ...(params.actual !== undefined && { actual: params.actual }),
    ...(params.detail !== undefined && { detail: params.detail }),
    message: params.message,
  };
}

/**
 * Format a structured report as a stable human line plus a machine-readable JSON trailer.
 * Callers that only need the human line can split on ` | plan-failure=`.
 */
export function formatCompositionPlanFailureReport(report: CompositionPlanFailureReport): string {
  if (report.version !== 1) {
    throw new Error(`composition-plan-failure: unsupported version ${String(report.version)}`);
  }
  const layoutOutputs = report.kind === 'layout-invariant';
  const expectedLabel = layoutOutputs ? 'expected output' : 'expected';
  const actualLabel = layoutOutputs ? 'actual output' : 'actual';
  // Prefer structured fields; omit `message` when it duplicates the invariant/detail line.
  const messagePart = (() => {
    if (report.message.trim().length === 0) return undefined;
    if (report.invariantId !== undefined) {
      const compact = [
        `layout-invariant ${report.invariantId}`,
        report.participant === undefined ? undefined : `participant ${report.participant}`,
        report.resource === undefined ? undefined : `resource ${report.resource}`,
        report.expected === undefined ? undefined : `${expectedLabel} ${String(report.expected)}`,
        report.actual === undefined ? undefined : `${actualLabel} ${String(report.actual)}`,
        report.detail,
      ].filter((part): part is string => part !== undefined && part.length > 0).join('; ');
      if (report.message === compact || report.message === report.detail) return undefined;
    }
    return report.message;
  })();
  const parts = [
    report.invariantId !== undefined ? `layout-invariant ${report.invariantId}` : report.code,
    report.phase !== undefined ? `phase ${report.phase}` : undefined,
    report.participant === undefined ? undefined : `participant ${report.participant}`,
    report.resource === undefined ? undefined : `resource ${report.resource}`,
    report.handler === undefined ? undefined : `handler ${report.handler}`,
    report.expected === undefined ? undefined : `${expectedLabel} ${String(report.expected)}`,
    report.actual === undefined ? undefined : `${actualLabel} ${String(report.actual)}`,
    report.detail,
    messagePart,
  ].filter((part): part is string => part !== undefined && part.length > 0);
  const human = parts.join('; ');
  const machine = JSON.stringify({
    version: report.version,
    kind: report.kind,
    code: report.code,
    ...(report.phase !== undefined && { phase: report.phase }),
    ...(report.invariantId !== undefined && { invariantId: report.invariantId }),
    ...(report.participant !== undefined && { participant: report.participant }),
    ...(report.resource !== undefined && { resource: report.resource }),
    ...(report.handler !== undefined && { handler: report.handler }),
    ...(report.expected !== undefined && { expected: report.expected }),
    ...(report.actual !== undefined && { actual: report.actual }),
    ...(report.detail !== undefined && { detail: report.detail }),
  });
  return `${human} | plan-failure=${machine}`;
}

/** Parse the JSON trailer from a formatted report line, if present. */
export function parseCompositionPlanFailureTrailer(
  formatted: string,
): CompositionPlanFailureReport | undefined {
  const marker = ' | plan-failure=';
  const at = formatted.lastIndexOf(marker);
  if (at < 0) return undefined;
  try {
    const parsed = JSON.parse(formatted.slice(at + marker.length)) as CompositionPlanFailureReport;
    if (parsed?.version !== 1 || typeof parsed.code !== 'string') return undefined;
    return {
      ...parsed,
      message: formatted.slice(0, at),
    };
  } catch {
    return undefined;
  }
}

/** Machine-stable code plus the human context required by callManifest-v1 section 12. */
export class MessageBusDiagnosticError extends Error {
  readonly name = 'MessageBusDiagnosticError';
  /** structured plan-failure: structured plan failure when this error was built from plan-level attribution. */
  readonly planFailure?: CompositionPlanFailureReport;

  constructor(
    public readonly code: MessageBusDiagnosticCode,
    message: string,
    public readonly context: MessageBusDiagnosticContext,
    preserveMessage = false,
    planFailure?: CompositionPlanFailureReport,
  ) {
    super(preserveMessage ? message : `messageBus [${code}]: ${message}`);
    this.planFailure = planFailure ?? context.planFailure;
  }
}

/** Layout-drift / ownership fail-closed path with invariant attribution and a structured plan-failure report. */
export function layoutInvariantError(params: {
  invariantId: string;
  message: string;
  participant?: number;
  resource?: string;
  expectedOutput?: number;
  actualOutput?: number;
  handler?: string;
  phase?: PlanningPhase;
  detail?: string;
}): MessageBusDiagnosticError {
  const report = buildCompositionPlanFailureReport({
    kind: 'layout-invariant',
    code: 'L3_LAYOUT_INVARIANT',
    phase: params.phase ?? 'absoluteLayout',
    invariantId: params.invariantId,
    participant: params.participant,
    resource: params.resource,
    handler: params.handler,
    expected: params.expectedOutput,
    actual: params.actualOutput,
    detail: params.detail,
    message: params.message,
  });
  const formatted = formatCompositionPlanFailureReport(report);
  return new MessageBusDiagnosticError(
    'L3_LAYOUT_INVARIANT',
    formatted,
    {
      invariantId: params.invariantId,
      participant: params.participant,
      resource: params.resource,
      resourceIdentity: params.resource,
      expectedOutput: params.expectedOutput,
      actualOutput: params.actualOutput,
      expected: params.expectedOutput,
      actual: params.actualOutput,
      handler: params.handler,
      rule: params.invariantId,
      planFailure: report,
    },
    false,
    report,
  );
}
