/**
 * Coordinate helpers for an implementation block embedded after a proxy's state prefix.
 */

import type { FunctionArgument } from '../Argument.js';

/** Move route-owned dynamic inputs from executor-relative provisional slots to the owner's trailing band. */
export function anchorRoutedDynamicResourcesAtOwner<T extends { token?: unknown }>(
  blockInputs: readonly T[],
  resources: readonly { blockSlot: number; name: string }[],
  executorOffset: number,
): T[] {
  const anchored = [...blockInputs];
  for (const resource of resources) {
    const shiftedSlot = resource.blockSlot + executorOffset;
    const destination = anchored[resource.blockSlot];
    const source = anchored[shiftedSlot];
    if (!source) {
      throw new Error(
        `Nested dynamic state '${resource.name}' has no provisional routed slot ${shiftedSlot}`,
      );
    }
    if (destination?.token) {
      throw new Error(
        `Nested dynamic state '${resource.name}' overlaps a fixed routed resource at `
        + `block slot ${resource.blockSlot}`,
      );
    }
    anchored[resource.blockSlot] = source;
    anchored[shiftedSlot] = destination;
  }
  return anchored;
}

/** Rebase route proof offsets when an implementation block is embedded after a proxy's state prefix. */
export function rebaseRoutedBatchProofOffsets(
  internalArgs: Readonly<Record<string, FunctionArgument>>,
  executorOffset: number,
): Record<string, FunctionArgument> {
  if (executorOffset === 0) return { ...internalArgs };
  const delta = BigInt(executorOffset);
  return Object.fromEntries(Object.entries(internalArgs).map(([name, value]) => [
    name,
    /^__internal__vmapBatchProof_\d+$/.test(name) && typeof value === 'bigint' && value >= 0n
      ? value + delta : value,
  ]));
}
