/**
 * Authenticated per-invocation results of a completed atomic composition, keyed by its admitted builder.
 *
 * The composer derives every returning invocation's result from that participant's own covenant while it
 * converges (the root's too, when the root's route returns), but `build()` hands back only the transaction. A
 * non-broadcasting read takes the root invocation's value here instead of re-deriving it.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';

const resultsByBuilder = new WeakMap<TransactionBuilder, Readonly<Record<number, string>>>();

export function recordComposedInvocationResults(
  builder: TransactionBuilder, results: Readonly<Record<number, string>>,
): void {
  resultsByBuilder.set(builder, Object.freeze({ ...results }));
}

/** Result hex of each returning invocation, by plan invocation index (the root call is 0). */
export function composedInvocationResults(
  builder: TransactionBuilder,
): Readonly<Record<number, string>> | undefined {
  return resultsByBuilder.get(builder);
}
