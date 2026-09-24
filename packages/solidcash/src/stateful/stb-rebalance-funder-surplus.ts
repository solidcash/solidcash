/**
 * phase-boundary extract: STB send-phase extract — fold funder surplus into change after materialization repairs.
 */

import { binToHex } from '@bitauth/libauth';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';

export interface RebalanceFunderSurplusHost {
  readonly funderChangeAddress?: Uint8Array;
  insertBeforeLateValueSuffix(
    builder: TransactionBuilder,
    output: Output,
    options: { rebindAbsoluteWitnesses?: boolean },
  ): unknown;
}

/**
 * After materialization/repair replaces provisional funder pass-throughs, fold exposed surplus into
 * an existing funder-owned change output, or insert suffix-safe change when none survives.
 */
export function rebalanceFunderSurplus(
  host: RebalanceFunderSurplusHost,
  finalBuilder: TransactionBuilder,
  serializedAccountingFunders: readonly UnlockableUtxo[],
  neededFee: bigint,
  dustMinimum: bigint,
): void {
  if (serializedAccountingFunders.length === 0) return;
  const inputSats = finalBuilder.inputs.reduce((sum, input) => sum + input.satoshis, 0n);
  const outputSats = finalBuilder.outputs.reduce((sum, output) => sum + output.amount, 0n);
  const surplus = inputSats - outputSats - neededFee;
  if (surplus < dustMinimum) return;
  const changeTo = host.funderChangeAddress
    ?? serializedAccountingFunders[0].unlocker.generateLockingBytecode();
  const changeLock = binToHex(changeTo);
  const changeIndex = finalBuilder.outputs.findLastIndex((output) => (
    !output.token
    && output.to instanceof Uint8Array
    && binToHex(output.to) === changeLock
  ));
  if (changeIndex >= 0) {
    const current = finalBuilder.outputs[changeIndex];
    finalBuilder.outputs[changeIndex] = {
      ...current,
      amount: (current.amount ?? 0n) + surplus,
    };
  } else {
    host.insertBeforeLateValueSuffix(
      finalBuilder,
      { to: changeTo, amount: surplus },
      { rebindAbsoluteWitnesses: true },
    );
  }
}
