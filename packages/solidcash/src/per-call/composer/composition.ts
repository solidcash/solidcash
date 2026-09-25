/**
 * Deriving a whole composition.
 *
 * A transaction has one or more roots: the entries a user made. Each is derived depth-first, in the order the
 * transaction lists them. The roots share one host and one set of pools, so a master a later root needs is
 * reserved once and a callee reached from two roots is derived on the master its first entry reserved.
 */

import {
  type DerivationHost,
  type DerivationResult,
  type DerivationRun,
  type FrameRequest,
  deriveDepthFirst,
} from './derivation.js';

/** Derives every root in order, each depth-first, and returns the runs and completions of all of them. */
export function deriveComposition(roots: readonly FrameRequest[], host: DerivationHost): DerivationResult {
  const runs: DerivationRun[] = [];
  const completed: FrameRequest[] = [];
  for (const root of roots) {
    const derived = deriveDepthFirst(root, host);
    runs.push(...derived.runs);
    completed.push(...derived.completed);
  }
  return { runs, completed };
}
