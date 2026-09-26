/**
 * What the transaction's values have to say.
 *
 * Two rules, both from the settlement section of the spec:
 *
 *   - a record keeps at least the value it had, unless a listed send pays from it;
 *   - a listed send is paid exactly, meaning the output it names holds exactly what it claims to pay.
 *
 * The first is what stops a plan from quietly draining a record while claiming to have preserved it. The second is
 * what stops a plan from listing a send that does not match the transaction it builds — a mismatch there is the
 * difference between paying an agreed amount and paying something else.
 *
 * This is the builder's view. The chain enforces the same rules on the transaction itself, and value conservation
 * beyond them is an open question in the spec rather than something either side settles.
 */

/** What the transaction says about the values a plan moves. */
export interface ValueFacts {
  /** The value each spent input holds, by input index. */
  readonly inputValues: ReadonlyMap<number, bigint>;
  /** The value the transaction writes at each output, by output index. */
  readonly outputValues: ReadonlyMap<number, bigint>;
}

/** One send a plan lists: an output it pays, and the record it pays from when a record pays it. */
export interface PlannedSend {
  /** The output index the send pays. */
  readonly out: number;
  /** The value it pays. */
  readonly value: bigint;
  /** The record whose value pays it, by the index that record lives at. Absent when the funder pays. */
  readonly from?: number;
}

/** One way the values fail. */
export interface ValueIssue {
  /** The record at fault, when a record is. */
  readonly record?: number;
  /** The send at fault, by the output it names, when a send is. */
  readonly send?: number;
  readonly reason: string;
}

/**
 * Every way the values fail, records first and then sends.
 *
 * A record's value is read from the input it is spent at when it is carried, and from nothing when the execution
 * creates it: a created record starts at zero, so a floor of zero is what preservation asks of it.
 */
export function valueIssues(
  records: readonly { readonly out: number; readonly in?: number }[],
  facts: ValueFacts,
  sends: readonly PlannedSend[],
): readonly ValueIssue[] {
  const issues: ValueIssue[] = [];
  const paidFrom = new Map<number, bigint>();
  for (const send of sends) {
    if (send.from === undefined) continue;
    paidFrom.set(send.from, (paidFrom.get(send.from) ?? 0n) + send.value);
  }

  for (const record of records) {
    const before = record.in === undefined ? 0n : facts.inputValues.get(record.in) ?? 0n;
    const after = facts.outputValues.get(record.out);
    if (after === undefined) {
      issues.push({ record: record.out, reason: `the transaction writes no value at output ${record.out}` });
      continue;
    }
    const paid = paidFrom.get(record.out) ?? 0n;
    if (paid > before) {
      issues.push({
        record: record.out,
        reason: `sends take ${paid} from a record that holds ${before}`,
      });
      continue;
    }
    if (after < before - paid) {
      issues.push({
        record: record.out,
        reason: `the record keeps ${after} of ${before - paid} it should keep`,
      });
    }
  }

  for (const send of sends) {
    const paid = facts.outputValues.get(send.out);
    if (paid === undefined) {
      issues.push({ send: send.out, reason: `the transaction writes no value at output ${send.out}` });
      continue;
    }
    if (paid !== send.value) {
      issues.push({
        send: send.out,
        reason: `the send pays ${send.value} but output ${send.out} holds ${paid}`,
      });
    }
  }

  return issues;
}

/** Raised when a plan's values do not hold. */
export class ValueRuleError extends Error {
  constructor(readonly issue: ValueIssue) {
    super([
      issue.record === undefined ? undefined : `record ${issue.record}`,
      issue.send === undefined ? undefined : `send to output ${issue.send}`,
    ].filter((part) => part !== undefined).join(' ') + `: ${issue.reason}`);
    this.name = 'ValueRuleError';
  }
}

/** Refuses a plan whose values do not hold, naming the first record or send at fault. */
export function assertValueRules(
  records: readonly { readonly out: number; readonly in?: number }[],
  facts: ValueFacts,
  sends: readonly PlannedSend[],
): void {
  const [first] = valueIssues(records, facts, sends);
  if (first !== undefined) throw new ValueRuleError(first);
}
