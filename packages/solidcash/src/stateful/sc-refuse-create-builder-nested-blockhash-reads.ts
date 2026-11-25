/**
 * phase-boundary extract: SC _createBuilder extract — refuse a called contract's own blockhash(n) read, which an
 * ordinary call co-spends no oracle pool slot for.
 */

import type { AbiFunction, Artifact } from '@solidcash/utils';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { resolveStatefulAbiFunction } from './stateful-abi-resolve.js';

/**
 * Refuse, before anything is built, the call of a contract reached through another contract's call whose function
 * reads blockhash(n) itself. An ordinary call co-spends a ring slot of an oracle pool for the contract the transaction
 * runs (and for a contract it reads, and for a function-pointer target's walk), never at the block-hash slot of a
 * called contract's block: that slot holds a plain coin, and the called contract's read would refuse it. A route
 * route places its own slots and is not refused.
 */
export function refuseCreateBuilderNestedBlockhashReads(groups: readonly ExternalCallUtxoGroup[]): void {
  for (const group of groups) {
    const artifact = group.externalContract?.inner?.artifact as Artifact | undefined;
    if (group.compilerRoute !== undefined || artifact === undefined) continue;
    let fn: AbiFunction | undefined;
    try {
      fn = resolveStatefulAbiFunction(artifact, group.functionName, group.functionArgs);
    } catch {
      continue;
    }
    if (fn === undefined || (fn.blockhashReads?.length ?? 0) === 0) continue;
    const label = `${artifact.contractName}.${fn.name}`;
    throw new Error(`The call of ${label} cannot be laid out: it reads blockhash(n), and an ordinary call co-spends `
      + 'a slot of an oracle pool only for the contract the transaction runs, not for a contract another contract\'s '
      + `call reaches, so ${label} would read a plain coin at its block-hash slot. Read the block hash in the `
      + `contract the transaction runs and pass it to ${label} as an argument, or call ${label} directly.`);
  }
}
