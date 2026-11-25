/**
 * phase-boundary extract: SC _createBuilder extract — refuse a called contract's low-level call, whose callee an
 * ordinary call never discovers.
 */

import type { AbiFunction, ArgSource, Artifact } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { resolveStatefulAbiFunction } from './stateful-abi-resolve.js';

type LowLevelCallRow = NonNullable<AbiFunction['lowLevelCalls']>[number];

/** The called contract as this check reads it: its state, and its reading of a call's branch condition. */
interface LowLevelCaller {
  getState(): Promise<Record<string, unknown>>;
  _evaluateExternalExpression(...args: unknown[]): FunctionArgument | undefined;
}

/**
 * Whether a call's payload is published as an empty literal (`call{value: v}("")`): the one payload for which the
 * caller's covenant pins no callee. Any other payload, a parameter's or one the compile does not publish, makes it
 * read the callee at the input `__internal__callInputIndex<n>` names.
 */
function emptyLiteralPayload(source: ArgSource | undefined): boolean {
  const literal = source?.kind === 'literal' ? source.value
    : source?.kind === 'expression' && source.expression?.kind === 'literal' ? source.expression.value : undefined;
  return literal === '' || literal === '0x';
}

/**
 * Refuse, before anything is built, the call of a contract reached through another contract's call whose function
 * makes a low-level call with a payload (`IFoo(x).call(data)`, `call{value:}` or `{gas:}` outside the route, a
 * call on a value that is not an address, an inline-assembly call, a statement `addr.call(data);`). Transitive
 * discovery follows a function's typed and `__raw__` calls only, so that callee is never co-spent, and the caller's
 * covenant finds no callee at the input its witness names. A call this run provably does not make (a branch whose
 * condition reads false) is not refused, nor is a loop's or an older artifact's, whose reach is not published; a
 * delegatecall is a proxy's and a route route places its own callees.
 */
export async function refuseCreateBuilderNestedLowLevelCalls(groups: readonly ExternalCallUtxoGroup[]): Promise<void> {
  for (const group of groups) {
    const artifact = group.externalContract?.inner?.artifact as Artifact | undefined;
    if (group.compilerRoute !== undefined || artifact === undefined) continue;
    let fn: AbiFunction | undefined;
    try {
      fn = resolveStatefulAbiFunction(artifact, group.functionName, group.functionArgs);
    } catch {
      continue;
    }
    const rows = (fn?.lowLevelCalls ?? []).flatMap((row, index) => (
      row.callMode === 'delegatecall' || emptyLiteralPayload(row.dataSource) ? [] : [{ row, index }]));
    if (fn === undefined || rows.length === 0) continue;
    const caller = group.externalContract as unknown as LowLevelCaller;
    const reached = async (row: LowLevelCallRow): Promise<boolean> => {
      if (row.occurrence === 'once') return true;
      if (row.occurrence !== 'conditional' || row.condition === undefined) return false;
      try {
        return caller._evaluateExternalExpression(
          row.condition, group.functionArgs, artifact, await caller.getState(), fn!.inputs,
        ) === true;
      } catch {
        return false;
      }
    };
    for (const { row, index } of rows) {
      if (!(await reached(row))) continue;
      const label = `${artifact.contractName}.${fn.name}`;
      throw new Error(`The call of ${label} cannot be laid out: its low-level call ${index} (a ${row.callMode} with a `
        + 'payload) reaches a callee the SDK does not discover for a contract another contract\'s call reaches, so '
        + `none is co-spent and ${label} would find no callee at the input it names. Make the low-level call from the `
        + 'contract the transaction runs, which co-spends its callee, or call the callee through its interface, as a '
        + 'typed call.');
    }
  }
}
