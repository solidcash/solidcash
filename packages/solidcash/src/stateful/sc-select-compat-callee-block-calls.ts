/**
 * The low-level path co-spends a compat `call`'s stateful callee as its master and data records only. A callee
 * function whose published block holds more (entries, events, oracles, containers) runs as a direct external group
 * instead, so its whole block is co-spent, unlocked and derived as a typed call's is. The caller's compat pin still
 * reads that callee at `__internal__callInputIndex[<i>]` and pins its edge at `__internal__lowLevelCallEdgeOutputIdx<i>`.
 */

import type { AbiFunction, Artifact, ExternalCallAbi } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { resolveStatefulAbiFunction } from './stateful-abi-resolve.js';
import { listedSingleLowLevelCalls } from './low-level-call-turns.js';

/** Block slots the low-level path materializes itself. */
const LOW_LEVEL_BAND_KINDS: ReadonlySet<string> = new Set(['master', 'dataNft', 'returnEvent']);

type StatefulCallInfo = {
  type: 'stateful';
  contract: { inner: { artifact: Artifact } };
  functionName: string;
  args: FunctionArgument[];
  compilerRoute?: unknown;
};

export interface CompatCalleeBlockCall {
  /** The entry's low-level call this group answers. */
  readonly callIndex: number;
  /** The callsite the external-call planner builds the callee's block from. */
  readonly ec: ExternalCallAbi;
  readonly callInfo: { externalContract: any; functionName: string; args: FunctionArgument[] };
}

/** Whether a callee function's published block holds a slot the low-level path does not materialize. */
export function calleeBlockExceedsLowLevelBand(callee: Pick<AbiFunction, 'blockLayout'> | undefined): boolean {
  return callee?.blockLayout?.slots.some((slot) => !LOW_LEVEL_BAND_KINDS.has(slot.kind)) === true;
}

/**
 * The entry's `call` rows whose supplied stateful callee needs its whole block. A function with a delegatecall keeps
 * the low-level path, as does a row whose call-input witness the caller does not publish.
 */
export function selectCompatCalleeBlockCalls(
  abiFunction: AbiFunction | undefined,
  calls: readonly unknown[] | undefined,
): CompatCalleeBlockCall[] {
  const rows = abiFunction?.lowLevelCalls ?? [];
  if (rows.some((row) => row.callMode === 'delegatecall')) return [];
  const selected: CompatCalleeBlockCall[] = [];
  // A per-turn row lays each turn's callee on the low-level path, which its list and records address.
  const byRow = listedSingleLowLevelCalls(rows, calls);
  rows.forEach((row, callIndex) => {
    const call = byRow[callIndex] as StatefulCallInfo | { type: 'raw' } | undefined;
    if (row.callMode !== 'call' || call?.type !== 'stateful' || call.compilerRoute !== undefined) return;
    const witness = rows.length === 1 ? '__internal__callInputIndex' : `__internal__callInputIndex${callIndex}`;
    if (!abiFunction!.inputs.some((input) => input.name === witness)) return;
    let callee: AbiFunction;
    try {
      callee = resolveStatefulAbiFunction(call.contract.inner.artifact, call.functionName, call.args);
    } catch {
      return;
    }
    if (!calleeBlockExceedsLowLevelBand(callee)) return;
    selected.push({
      callIndex,
      ec: {
        interfaceName: '__raw__',
        functionName: callee.name,
        occurrence: 'once',
        maximumOccurrences: 1,
        requiredDataNftIndices: [...(callee.requiredNftIndices ?? [])],
        // A returning callee settles its record in its block; the caller reads none.
        hasReturnValues: (callee.outputs?.length ?? 0) > 0,
        needsSelectorVerification: false,
        callValueEffect: false,
      },
      callInfo: { externalContract: call.contract, functionName: callee.name, args: call.args },
    });
  });
  return selected;
}
