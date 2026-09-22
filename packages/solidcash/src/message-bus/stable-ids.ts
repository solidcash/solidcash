/**
 * Stable compiler IDs for kernel joins (backlog item 7).
 * Names remain diagnostics only — joins must use these IDs.
 */

export type StableIdKind =
  | 'function'
  | 'handler'
  | 'resourceStream'
  | 'effectSite'
  | 'callsite';

export type StableId = {
  kind: StableIdKind;
  id: string;
  /** Diagnostic only — never used for equality of planning joins. */
  diagnosticName?: string;
};

export function stableIdsEqual(a: StableId, b: StableId): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/** Prefer published ID; fail closed if missing on a kernel artifact path. */
export function requireStableId(
  kind: StableIdKind,
  id: string | undefined,
  diagnosticName?: string,
): StableId {
  if (!id) {
    throw new Error(`stable-id: missing ${kind} id${diagnosticName ? ` (${diagnosticName})` : ''}`);
  }
  return { kind, id, diagnosticName };
}

/**
 * Join key that ignores diagnostic names — alpha-renaming safe.
 */
export function stableJoinKey(id: StableId): string {
  return `${id.kind}:${id.id}`;
}
