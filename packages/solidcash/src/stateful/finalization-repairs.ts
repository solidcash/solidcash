/**
 * Finalization only validates: it never mines commitments from a failing VM frame or rewrites planned outputs, so a
 * covenant's rejection reaches the caller as the VM reported it.
 */
export function allowsFinalizationVmRepairs(_recipe?: unknown): boolean {
  return false;
}

export function refuseFinalizationVmRepairsIfRecipe(_recipe?: unknown): void {
  // Nothing to refuse: no finalization repair runs.
}
