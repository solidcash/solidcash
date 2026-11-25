/** Finalization repairs are only needed by an authenticated route; a direct send never applies one. */
export function allowsFinalizationVmRepairs(_recipe?: unknown): boolean {
  return true;
}

export function refuseFinalizationVmRepairsIfRecipe(_recipe?: unknown): void {
  // No route recipe selects a repair on the direct path.
}
