/**
 * phase-boundary extract: graph-planning producer result memoization
 * (phase-boundary extract from StatefulContract.ts).
 */

import { binsAreEqual } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import type { FunctionArgument } from '../Argument.js';

export function functionArgumentValuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if ((typeof left === 'bigint' || typeof left === 'number')
    && (typeof right === 'bigint' || typeof right === 'number')) {
    return BigInt(left) === BigInt(right);
  }
  if (left instanceof Uint8Array && right instanceof Uint8Array) return binsAreEqual(left, right);
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length
      && left.every((value, index) => functionArgumentValuesEqual(value, right[index]));
  }
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const leftEntries = Object.entries(left as Record<string, unknown>);
    const rightRecord = right as Record<string, unknown>;
    return leftEntries.length === Object.keys(rightRecord).length
      && leftEntries.every(([key, value]) => functionArgumentValuesEqual(value, rightRecord[key]));
  }
  return false;
}

export function functionArgumentListsEqual(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length
    && left.every((value, index) => functionArgumentValuesEqual(value, right[index]));
}

type GraphPlanningProducerResultEntry = {
  args: readonly unknown[];
  target: unknown;
  provisional: boolean;
  pending: Promise<FunctionArgument | undefined>;
};

/** One graph-build epoch's speculative producer results, indexed by compiler-stable callsite identity. */
export interface GraphPlanningProducerResultContext {
  readonly entries: Map<number, GraphPlanningProducerResultEntry[]>;
}

export function createGraphPlanningProducerResultContext(): GraphPlanningProducerResultContext {
  return { entries: new Map() };
}

function snapshotFunctionArgument(value: unknown): unknown {
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (Array.isArray(value)) return value.map(snapshotFunctionArgument);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([key, child]) => [key, snapshotFunctionArgument(child)]));
  }
  return value;
}

/**
 * Evaluate one published producer at most once for an unchanged callsite invocation in a planning epoch.
 * Exact results may seed provisional consumers, but provisional fallbacks never satisfy an exact request.
 */
export async function memoizeGraphPlanningProducerResult(
  context: GraphPlanningProducerResultContext,
  callsiteId: number,
  args: readonly FunctionArgument[],
  target: FunctionArgument | undefined,
  provisional: boolean,
  evaluate: () => Promise<FunctionArgument | undefined>,
): Promise<FunctionArgument | undefined> {
  const entries = context.entries.get(callsiteId) ?? [];
  const matching = entries.find((entry) => (
    (entry.provisional === provisional || (provisional && !entry.provisional))
    && functionArgumentListsEqual(entry.args, args)
    && functionArgumentValuesEqual(entry.target, target)
  ));
  if (matching) return matching.pending;
  const pending = evaluate();
  entries.push({
    args: args.map(snapshotFunctionArgument),
    target: snapshotFunctionArgument(target),
    provisional,
    pending,
  });
  context.entries.set(callsiteId, entries);
  return pending;
}
