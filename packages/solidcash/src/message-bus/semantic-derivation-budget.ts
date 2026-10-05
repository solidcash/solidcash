import type { Artifact } from '@solidcash/utils';

/** Combine per-owner mutable-claim ceilings, sharing the graph's assembly and confirmation passes. */
export function graphSemanticDerivationCeiling(
  artifacts: readonly Pick<Artifact, 'messageBus'>[],
): number | undefined {
  let ceiling = 2;
  let hasUnpublishedLegacy = false;
  for (const artifact of artifacts) {
    const published = artifact.messageBus?.resourceBudgets?.maximumSemanticDerivationPasses;
    if (published === undefined && artifact.messageBus?.convention !== 'kernel-row-loop') {
      hasUnpublishedLegacy = true;
      continue;
    }
    if (published === undefined || !Number.isSafeInteger(published) || published < 2) {
      throw new Error('messageBus: participant requires a valid resourceBudgets.maximumSemanticDerivationPasses');
    }
    ceiling += published - 2;
    if (!Number.isSafeInteger(ceiling)) throw new Error('messageBus: graph semantic derivation budget overflow');
  }
  // Older artifacts provide no aggregate ceiling. Kernel participants must always publish theirs.
  return hasUnpublishedLegacy ? undefined : ceiling;
}
