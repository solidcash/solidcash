/**
 * Guards for the direct SDK's rewrites of a sorted-mapping loop's own arrays (`_createBuilder`'s upsert-loop planning).
 *
 * The covenant folds a loop's turns in one order only: a gap's new keys one after another in ascending slot order,
 * each right after the credited entry it follows; a repeated key merged into one turn, or its scalar turns adjacent;
 * msg.sender's own credit left out when the sender's entry is co-spent once for the debit. The SDK rewrites the call's
 * arrays to reach that order. The rewritten call means what the caller's call means only when the compiler proved each
 * turn fixed by its own pair (`pairwise`, and `senderDebit` for a net-out); without that the SDK builds the call as
 * given, or refuses it with the reasons below.
 */
import type { SortedUpsertLoopAbi } from '@solidcash/utils';

/** Why a rewritten call need not mean what the caller's call means, from the loop's published facts. */
export function upsertLoopRewriteReason(info: SortedUpsertLoopAbi): string {
  if (info.siblingEffect) return 'each turn has an effect besides this write';
  if (info.readsWrittenEntry) return 'a turn reads the entry it writes';
  if (info.valueRuntimeExpression) return 'each turn computes its value on chain, which may read its position';
  if (info.mutation) return 'each turn changes an array value in place';
  return 'the compiler did not prove that each turn is fixed by its own key and value';
}

/** The range of a bounded integer value type (`int256`, `uint64`, ...), or undefined for any other type. */
export function boundedIntegerRange(valueType: string): { min: bigint; max: bigint } | undefined {
  const match = /^(u?)int(\d*)$/.exec(valueType);
  if (match === null) return undefined;
  const bits = BigInt(match[2] === '' ? 256 : Number(match[2]));
  return match[1] === 'u'
    ? { min: 0n, max: (1n << bits) - 1n }
    : { min: -(1n << (bits - 1n)), max: (1n << (bits - 1n)) - 1n };
}

/**
 * The first turn at which a `+` or `-` loop, run in the order given as the EVM runs it, takes a bounded value past its
 * type's range, or undefined. That call reverts, while a merged, reordered or shortened call adds the same values in
 * other partial sums, and need not. `senderSlotHex` names msg.sender's entry when each turn first debits it by the
 * turn's amount (`senderDebit`); a turn whose key is that entry credits it back.
 */
export function givenOrderRangeBreak(params: {
  op: '+' | '-';
  range: { min: bigint; max: bigint };
  turns: readonly { slotHex: string; amount: bigint }[];
  current: (slotHex: string) => bigint;
  senderSlotHex?: string;
}): string | undefined {
  const { op, range, turns, current, senderSlotHex } = params;
  const running = new Map<string, bigint>();
  const valueOf = (slotHex: string): bigint => running.get(slotHex) ?? current(slotHex);
  const outside = (value: bigint): boolean => value < range.min || value > range.max;
  for (const [turn, { slotHex, amount }] of turns.entries()) {
    if (senderSlotHex !== undefined) {
      const debited = valueOf(senderSlotHex) - amount;
      if (outside(debited)) return `turn ${turn} debits the sender to ${debited}`;
      running.set(senderSlotHex, debited);
    }
    const next = valueOf(slotHex) + (op === '+' ? amount : -amount);
    if (outside(next)) return `turn ${turn} takes its entry to ${next}`;
    running.set(slotHex, next);
  }
  return undefined;
}
