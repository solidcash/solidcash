/**
 * The record chain a settlement has to satisfy.
 *
 * A frame's execution is split into segments, and every segment declares, for each record it touches, the record's
 * whole commitment at the segment's start and at its end. Chaining those declarations is what turns a list of
 * segments into one transition: the first declaration has to agree with what the transaction actually spends, each
 * later one has to agree with the declaration before it, and the last has to agree with what the transaction actually
 * writes.
 *
 * Checking it here rather than only in the script is deliberate. The chain is a property of the plan, so a builder
 * that got it wrong finds out before anything is signed, and with a message that names the record and the segment
 * rather than an operation that failed.
 */

import { INDEX_NONE, bytesEqual, type RecordEntry } from '@solidcash/utils';

/** What the transaction itself says about the records a plan touches. */
export interface SettlementFacts {
  /** The commitment the transaction spends at an input index. */
  readonly inputCommitments: ReadonlyMap<number, Uint8Array>;
  /** The commitment the transaction writes at an output index. */
  readonly outputCommitments: ReadonlyMap<number, Uint8Array>;
}

/** One way a chain can fail. */
export interface RecordChainIssue {
  /** The record's identity: the index it lives at, whichever side names it. */
  readonly record: number;
  /** The segment whose declaration is at fault, when the fault is inside the chain. */
  readonly segment?: number;
  readonly reason: string;
}

/** The identity a record is known by: the index it lives at, named by whichever side declares it. */
function identityOf(entry: RecordEntry): number {
  return entry.in === INDEX_NONE ? entry.out : entry.in;
}

/**
 * Every way the declared chains fail, in segment order.
 *
 * A record's entries are read in the order the segments declare them, which is the execution's order.
 */
export function recordChainIssues(
  segments: readonly (readonly RecordEntry[])[],
  facts: SettlementFacts,
): readonly RecordChainIssue[] {
  const issues: RecordChainIssue[] = [];
  const seen = new Map<number, { viewOut: Uint8Array; segment: number; deleted: boolean }>();

  segments.forEach((segment, segmentIndex) => {
    for (const entry of segment) {
      const record = identityOf(entry);
      const previous = seen.get(record);

      if (previous?.deleted) {
        issues.push({ record, segment: segmentIndex, reason: 'the record was already deleted' });
      } else if (entry.in === INDEX_NONE) {
        // A created record may only be created once.
        if (previous !== undefined) {
          issues.push({ record, segment: segmentIndex, reason: 'the record is created after it already existed' });
        }
      } else if (previous === undefined) {
        // The first entry for a record that already exists must agree with what the transaction spends.
        const spent = facts.inputCommitments.get(entry.in);
        if (spent === undefined) {
          issues.push({ record, segment: segmentIndex, reason: `input ${entry.in} is not one the transaction spends` });
        } else if (!bytesEqual(spent, entry.viewIn)) {
          issues.push({
            record,
            segment: segmentIndex,
            reason: `the first declaration does not match the commitment spent at input ${entry.in}`,
          });
        }
      }

      if (previous !== undefined && !previous.deleted && !bytesEqual(previous.viewOut, entry.viewIn)) {
        issues.push({
          record,
          segment: segmentIndex,
          reason: `the declaration does not carry on from segment ${previous.segment}`,
        });
      }

      if (entry.in !== INDEX_NONE && entry.out !== INDEX_NONE && entry.out !== entry.in) {
        issues.push({ record, segment: segmentIndex, reason: `the record moves from ${entry.in} to ${entry.out}` });
      }

      // The baseline advances past a fault as well: one fault is one issue, and the closing comparison is against the
      // latest declaration rather than a stale one that would report the same fault twice.
      seen.set(record, { viewOut: entry.viewOut, segment: segmentIndex, deleted: entry.out === INDEX_NONE });
    }
  });

  // The last declaration of a record the transaction recreates has to be what it actually writes.
  for (const [record, last] of seen) {
    if (last.deleted) continue;
    const written = facts.outputCommitments.get(record);
    if (written === undefined) {
      issues.push({
        record,
        segment: last.segment,
        reason: `the record is declared but the transaction writes nothing at output ${record}`,
      });
      continue;
    }
    if (!bytesEqual(written, last.viewOut)) {
      issues.push({
        record,
        segment: last.segment,
        reason: `the last declaration does not match the commitment written at output ${record}`,
      });
    }
  }

  return issues;
}

/** Raised when a plan's segments do not chain into one transition. */
export class RecordChainError extends Error {
  constructor(readonly issue: RecordChainIssue) {
    super(`record ${issue.record}${issue.segment === undefined ? '' : ` in segment ${issue.segment}`}: ${issue.reason}`);
    this.name = 'RecordChainError';
  }
}

/** Refuses a plan whose segments do not chain, naming the first declaration that does not hold. */
export function assertRecordChains(
  segments: readonly (readonly RecordEntry[])[],
  facts: SettlementFacts,
): void {
  const [first] = recordChainIssues(segments, facts);
  if (first !== undefined) throw new RecordChainError(first);
}

/** The commitment a record holds, for a caller assembling the facts a settlement is checked against. */
export function emptyCommitment(): Uint8Array {
  return new Uint8Array(0);
}

/** True when a record's declared end state is its deletion. */
export function endsDeleted(entry: RecordEntry): boolean {
  return entry.out === INDEX_NONE;
}
