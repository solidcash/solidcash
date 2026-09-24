export type MonotoneAttributionRetry<T> =
  | { succeeded: true; value: T }
  | { succeeded: false; error: unknown };

/**
 * KERNEL_* admission catalog: compile-recovery helper — not admission authority.
 *
 * Retry a *compile* candidate after monotonically refusing source identities attributed by its latest
 * failure. Admission decisions still come from span analysis (`attribution-spans`); this only recovers
 * route codegen by quarantining handlers that throw during synthesis.
 *
 * The attribution callback must draw from a finite source set. Termination does not depend on an arbitrary
 * retry ceiling: every attempted retry first adds at least one previously unseen identity to `refused`.
 * An empty or duplicate-only attribution is a fixed point and stops immediately.
 */
export function retryMonotoneAttribution<Key, Value>(
  initialError: unknown,
  refused: Set<Key>,
  attribute: (error: unknown) => readonly Key[],
  attempt: () => Value,
  onAttemptFailure?: (attributed: readonly Key[], error: unknown) => void,
): MonotoneAttributionRetry<Value> {
  let latestError = initialError;
  for (;;) {
    const attributed = attribute(latestError);
    const before = refused.size;
    for (const key of attributed) refused.add(key);
    if (refused.size === before) return { succeeded: false, error: latestError };
    try {
      return { succeeded: true, value: attempt() };
    } catch (error) {
      latestError = error;
      onAttemptFailure?.(attributed, error);
    }
  }
}

/** KERNEL_* admission catalog alias: make the compile-recovery role explicit at call sites. */
export const recoverCompileByMonotoneRefusal = retryMonotoneAttribution;

/** True when admission authority is analyzer/span-based (not published-fallback). */
export function isAnalyzerFirstAdmissionSource(
  source: string | undefined,
): source is 'attribution-spans' {
  return source === 'attribution-spans';
}

/** admissionSource stamp: true when admittedHandlerIds were copied from published eligibility (non-kernel). */
export function isLegacyEligibilityAdmissionSource(
  source: string | undefined,
): source is 'legacy-eligibility' {
  return source === 'legacy-eligibility';
}

export type MessageBusAdmissionSourceAuthority =
  | 'attribution-spans'
  | 'legacy-eligibility'
  | 'unstamped';

/**
 * admissionSource stamp: classify how `admittedHandlerIds` were produced.
 * Fail-closed when ids are present but `admissionSource` is missing (unstamped-admission ambiguity).
 */
export function resolveMessageBusAdmissionSourceAuthority(messageBus: {
  admissionSource?: string;
  admittedHandlerIds?: readonly string[];
} | undefined): MessageBusAdmissionSourceAuthority {
  if (messageBus === undefined) return 'unstamped';
  if (isAnalyzerFirstAdmissionSource(messageBus.admissionSource)) return 'attribution-spans';
  if (isLegacyEligibilityAdmissionSource(messageBus.admissionSource)) return 'legacy-eligibility';
  if ((messageBus.admittedHandlerIds?.length ?? 0) > 0) {
    throw new Error(
      'messageBus: admittedHandlerIds present without admissionSource '
        + '(unstamped admissionSource ambiguity; expected attribution-spans or legacy-eligibility)',
    );
  }
  return 'unstamped';
}
