export type MonotoneAttributionRetry<T> =
  | { succeeded: true; value: T }
  | { succeeded: false; error: unknown };

/**
 * Retry a candidate after monotonically refusing the source identities attributed by its latest failure.
 *
 * The attribution callback must draw from a finite source set. Termination does not depend on an arbitrary retry
 * ceiling: every attempted retry first adds at least one previously unseen identity to `refused`. An empty or
 * duplicate-only attribution is a fixed point and stops immediately.
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
