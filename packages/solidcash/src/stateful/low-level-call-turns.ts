/**
 * A low-level call a loop may make more than once (`perTurn` on its ABI row) binds each turn to a callee run of its
 * own: the caller reads the turn's callee input from its list witness and, when it keeps state, the record that run
 * settles at the record base plus the turn. `.withCall()` lists the callees in row order, one per turn for such a row.
 */

import {
  lowLevelCallTurnInputsInput, lowLevelCallTurnRecordBaseInput, encodePushdataValue, type AbiFunction,
} from '@solidcash/utils';
import { LowLevelCallTurnsError } from '../Errors.js';

type LowLevelCallRow = NonNullable<AbiFunction['lowLevelCalls']>[number];

/**
 * The listed calls each low-level call row answers: one for an ordinary row, the run between the rows before and after
 * it for the one per-turn row. Two per-turn rows cannot be told apart in one flat list, so their listing is refused.
 */
export function listedLowLevelCallsByRow<T>(
  rows: readonly LowLevelCallRow[], calls: readonly T[] | undefined, caller = 'the function',
): T[][] {
  const listed = calls ?? [];
  const turned = rows.flatMap((row, index) => (row.perTurn === true ? [index] : []));
  if (turned.length === 0) return rows.map((_, index) => (index < listed.length ? [listed[index]!] : []));
  if (turned.length > 1 && listed.length > 0) {
    throw new LowLevelCallTurnsError(caller, `its low-level calls ${turned.join(' and ')} each make several turns, `
      + 'so one withCall() list cannot say which turn each callee answers');
  }
  const at = turned[0]!;
  const after = rows.length - at - 1;
  const turns = Math.max(0, listed.length - at - after);
  return rows.map((_, index) => {
    if (index < at) return index < listed.length ? [listed[index]!] : [];
    if (index === at) return listed.slice(at, at + turns);
    const position = at + turns + (index - at - 1);
    return position < listed.length ? [listed[position]!] : [];
  });
}

/** A listed call and the row it answers; `turn` for a per-turn row's. */
export interface LowLevelCallTurn<T> {
  readonly row: number;
  readonly turn?: number;
  readonly callInfo: T;
}

type ListedCall = {
  readonly type: string;
  readonly functionName?: string;
  readonly contract?: {
    readonly categoryId?: string;
    readonly inner?: { readonly artifact?: { readonly contractName?: string; readonly abi?: readonly AbiFunction[] } };
  };
};

/**
 * The listed calls in row order, each a co-spend of its own. A per-turn row's turns must be distinct runs: two turns
 * listing one contract would spend its one master twice. Where the caller reads each turn's record, a turn's callee
 * settles one the SDK lays out: a void entry's `digest || 01`. A raw coin settles none, and a returning entry's
 * result is not derived for a turn yet, so both are refused there by name.
 */
export function planLowLevelCallTurns<T extends ListedCall>(
  rows: readonly LowLevelCallRow[], calls: readonly T[] | undefined, abiFunction: Pick<AbiFunction, 'inputs'> | undefined,
  caller = 'the function',
): LowLevelCallTurn<T>[] {
  const plan: LowLevelCallTurn<T>[] = [];
  listedLowLevelCallsByRow(rows, calls, caller).forEach((listed, row) => {
    if (rows[row]?.perTurn !== true) {
      if (listed[0] !== undefined) plan.push({ row, callInfo: listed[0] });
      return;
    }
    const readsRecords = abiFunction !== undefined && lowLevelCallTurnReadsRecords(abiFunction, row);
    const runs = new Map<string, number>();
    listed.forEach((callInfo, turn) => {
      const name = callInfo.contract?.inner?.artifact?.contractName ?? 'its callee';
      if (callInfo.type === 'stateful') {
        const run = callInfo.contract?.categoryId;
        if (run !== undefined && runs.has(run)) {
          throw new LowLevelCallTurnsError(caller, `turns ${runs.get(run)} and ${turn} list ${name}, whose one master `
            + 'runs once in a transaction');
        }
        if (run !== undefined) runs.set(run, turn);
        const entry = callInfo.contract?.inner?.artifact?.abi?.find((fn) => fn.name === callInfo.functionName);
        if (readsRecords && (entry?.outputs?.length ?? 0) > 0) {
          throw new LowLevelCallTurnsError(caller, `turn ${turn} runs ${name}.${callInfo.functionName}, which returns `
            + 'a value, and the SDK does not yet derive the result its record carries');
        }
      } else if (readsRecords) {
        throw new LowLevelCallTurnsError(caller, `turn ${turn} lists a raw coin, which settles no record for the caller `
          + 'to read');
      }
      plan.push({ row, turn, callInfo });
    });
  });
  return plan;
}

/** The first listed call of each row, as the single-call paths read them; none for a per-turn row. */
export function listedSingleLowLevelCalls<T>(
  rows: readonly LowLevelCallRow[], calls: readonly T[] | undefined, caller?: string,
): (T | undefined)[] {
  return listedLowLevelCallsByRow(rows, calls, caller)
    .map((row, index) => (rows[index]?.perTurn === true ? undefined : row[0]));
}

/** Whether the function reads each turn's callee record of its per-turn row `callIndex`: it keeps state. */
export function lowLevelCallTurnReadsRecords(abiFunction: Pick<AbiFunction, 'inputs'>, callIndex: number): boolean {
  const name = lowLevelCallTurnRecordBaseInput(callIndex);
  return abiFunction.inputs.some((input) => input.name === name);
}

/** The list witness of a per-turn row: each turn's callee master input, in turn order. */
export function lowLevelCallTurnInputsWitness(indices: readonly number[]): Uint8Array {
  const parts = indices.map((index) => encodePushdataValue(BigInt(index), 'bigint'));
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** The ABI positions of a per-turn row's witnesses, -1 for one the function does not take. */
export function lowLevelCallTurnWitnessPositions(
  abiFunction: Pick<AbiFunction, 'inputs'>, callIndex: number,
): { inputs: number; recordBase: number } {
  const inputs = lowLevelCallTurnInputsInput(callIndex);
  const recordBase = lowLevelCallTurnRecordBaseInput(callIndex);
  return {
    inputs: abiFunction.inputs.findIndex((input) => input.name === inputs),
    recordBase: abiFunction.inputs.findIndex((input) => input.name === recordBase),
  };
}
