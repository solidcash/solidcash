/**
 * phase-boundary extract: STB public-surface extract — getLoopEntryOutputIndex settlement/trailing resolve.
 */

import type { KernelEntryJournalOutputLayoutPlan } from './KernelEntryJournal.js';

export type LoopEntryVar = {
  collection: string;
};

export type RuntimeLoopTrailingSegment = {
  kind: string;
  collection?: string;
  offset: number;
  count: number;
};

export interface GetLoopEntryOutputIndexHost {
  readonly kernelJournalSettlementOutputPlan: readonly unknown[];
  readonly kernelJournalEagerOutputPlan: readonly unknown[];
  readonly runtimeLoopTrailingSegments: readonly RuntimeLoopTrailingSegment[];
  readonly loopEntryCommitments: ReadonlyMap<string, readonly string[]>;
  validateKernelJournalSettlementOutputPlan(): void;
  kernelJournalOutputLayout(): KernelEntryJournalOutputLayoutPlan;
  getLoopEntryOutputBase(): number;
  trailingLoopEntryVars(): readonly LoopEntryVar[];
}

/**
 * Resolve a collection-local commitment offset through the authenticated trailing segment plan.
 */
export function getLoopEntryOutputIndex(
  host: GetLoopEntryOutputIndexHost,
  collection: string,
  commitmentIndex: number,
): number {
  if (!Number.isSafeInteger(commitmentIndex) || commitmentIndex < 0) {
    throw new Error(`Invalid loop entry commitment index ${commitmentIndex} for '${collection}'`);
  }
  if (host.kernelJournalSettlementOutputPlan.length > 0 || host.kernelJournalEagerOutputPlan.length > 0) {
    host.validateKernelJournalSettlementOutputPlan();
    const entry = host.kernelJournalOutputLayout().outputs.find((candidate) =>
      candidate.collection === collection && candidate.offset === commitmentIndex);
    if (!entry) {
      throw new Error(`Loop entry commitment ${collection}[${commitmentIndex}] is missing from settlement output plan`);
    }
    return host.getLoopEntryOutputBase() + entry.outputOrdinal;
  }
  if (host.runtimeLoopTrailingSegments.length === 0) {
    let physical = host.getLoopEntryOutputBase();
    for (const variable of host.trailingLoopEntryVars()) {
      const count = (host.loopEntryCommitments.get(variable.collection) ?? []).length;
      if (variable.collection === collection) {
        if (commitmentIndex >= count) break;
        return physical + commitmentIndex;
      }
      physical += count;
    }
    throw new Error(`Loop entry commitment ${collection}[${commitmentIndex}] is missing from the output plan`);
  }
  const entrySegments = host.runtimeLoopTrailingSegments.filter((segment) => segment.kind === 'entries');
  const prefixCounts = new Map<string, number>();
  for (const segmentedCollection of new Set(entrySegments.map((segment) => segment.collection!))) {
    const commitments = host.loopEntryCommitments.get(segmentedCollection) ?? [];
    const intervals = entrySegments.filter((segment) => segment.collection === segmentedCollection)
      .sort((left, right) => left.offset - right.offset);
    let expected = intervals[0]!.offset;
    prefixCounts.set(segmentedCollection, expected);
    for (const interval of intervals) {
      if (!Number.isSafeInteger(interval.offset) || !Number.isSafeInteger(interval.count)
        || interval.offset < 0 || interval.count <= 0 || interval.offset !== expected) {
        throw new Error(`Runtime loop entry segments for '${segmentedCollection}' overlap or have a gap`);
      }
      expected += interval.count;
    }
    if (expected !== commitments.length) {
      throw new Error(
        `Runtime loop entry segments for '${segmentedCollection}' cover ${expected} of ${commitments.length} commitments`,
      );
    }
  }
  let physical = host.getLoopEntryOutputBase();
  for (const variable of host.trailingLoopEntryVars()) {
    const commitments = host.loopEntryCommitments.get(variable.collection) ?? [];
    const prefixCount = prefixCounts.get(variable.collection) ?? commitments.length;
    if (variable.collection === collection && commitmentIndex < prefixCount) {
      if (commitmentIndex >= commitments.length) break;
      return physical + commitmentIndex;
    }
    physical += prefixCount;
  }
  let resolved: number | undefined;
  for (const segment of host.runtimeLoopTrailingSegments) {
    if (segment.kind === 'entries' && segment.collection === collection
      && commitmentIndex >= segment.offset && commitmentIndex < segment.offset + segment.count) {
      if (resolved !== undefined) {
        throw new Error(`Loop entry commitment ${collection}[${commitmentIndex}] has multiple output locations`);
      }
      resolved = physical + commitmentIndex - segment.offset;
    }
    physical += segment.count;
  }
  if (resolved === undefined) {
    throw new Error(`Loop entry commitment ${collection}[${commitmentIndex}] is missing from the output plan`);
  }
  return resolved;
}
