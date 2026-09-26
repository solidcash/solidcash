import type { Artifact } from '@solidcash/utils';

/** Narrow a shared route resource only from every selected handler's exact compiler-published layout. */
export function selectedSatoshiContainerRequired(
  artifact: Artifact,
  selectors: readonly (string | undefined)[],
): boolean | undefined {
  const handlers = selectors.map((selector) => {
    const matches = selector === undefined ? [] : artifact.abi.filter((candidate) =>
      candidate.selector?.toLowerCase() === selector.toLowerCase());
    return matches.length === 1 ? matches[0] : undefined;
  });
  if (handlers.some((handler) => handler?.blockLayout === undefined)) return undefined;
  return handlers.some((handler) => (handler!.transferCount ?? 0) > 0
    || handler!.blockLayout!.slots.some((slot) => slot.kind === 'satoshiContainer'));
}
