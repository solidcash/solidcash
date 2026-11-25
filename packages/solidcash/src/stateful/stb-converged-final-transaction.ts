/**
 * phase-boundary extract: STB class-body extract: validate the exact transaction shape submitted to the
 * provider. Finalization only validates: a covenant's rejection reaches the caller as the VM reported it.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { encodeTransaction } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo } from '../interfaces.js';
import {
  computedOutputConvergenceFingerprint,
  computedOutputRepairPassLimit,
  recordComputedOutputConvergenceState,
} from './computed-output-repair.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { assertFinalizedTransactionCovenants } from '../finalization.js';

export interface ConvergedFinalTransactionHost {
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly allInputs: readonly UnlockableUtxo[];
  readonly externalCallEntryInserts?: ReadonlyArray<{ categoryId: string; to: Uint8Array; commitment: string }>;
  findMintingInputIndex(categoryId: string): number;
}

/**
 * Validate the exact transaction submitted to the provider. A fee adjustment before validation may change the
 * output count; input geometry never moves.
 */
export function assertConvergedFinalTransaction(
  host: ConvergedFinalTransactionHost,
  builder: TransactionBuilder,
  beforeValidation?: (
    transaction: ReturnType<TransactionBuilder['buildLibauthTransaction']>,
  ) => boolean,
): ReturnType<TransactionBuilder['buildLibauthTransaction']> {
  const fixedInputCount = builder.inputs.length;
  let fixedOutputCount = builder.outputs.length;
  let passLimit = computedOutputRepairPassLimit(fixedInputCount, fixedOutputCount);
  // A fee adjustment can materialize a new output. Permit that controlled transition, but never permit input
  // geometry to move and bound output-count revisions.
  let geometryChangesRemaining = fixedInputCount + fixedOutputCount + 1;
  const convergenceStates = new Set<string>();
  const acceptControlledOutputGeometry = (): void => {
    if (builder.inputs.length !== fixedInputCount) {
      throw new Error(
        'Computed-output repair changed finalized input geometry '
        + `(${fixedInputCount}->${builder.inputs.length}).`,
      );
    }
    if (builder.outputs.length === fixedOutputCount) return;
    if (geometryChangesRemaining === 0) {
      throw new Error('Computed-output repair output geometry did not converge.');
    }
    geometryChangesRemaining -= 1;
    passLimit = Math.max(passLimit, computedOutputRepairPassLimit(fixedInputCount, builder.outputs.length));
    fixedOutputCount = builder.outputs.length;
  };
  // Retained as a diagnostic, not a lever: it attributes the convergence cost to the rebuild, the fee
  // adjustment and the covenant preflight separately. Silent (and free) unless the variable is set.
  const debugConvergenceRounds = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_CONVERGENCE_ROUNDS === '1';
  const convergenceStartedAt = debugConvergenceRounds ? Date.now() : 0;
  const convergenceRounds = {
    sweeps: 0, builds: 0, validations: 0, feeCalls: 0,
    buildMs: 0, validateMs: 0, feeMs: 0,
  };
  for (let sweep = 0; sweep < passLimit; sweep++) {
    convergenceRounds.sweeps += 1;
    const buildStartedAt = debugConvergenceRounds ? Date.now() : 0;
    const transaction = builder.buildLibauthTransaction(true);
    if (debugConvergenceRounds) {
      convergenceRounds.builds += 1;
      convergenceRounds.buildMs += Date.now() - buildStartedAt;
    }
    if (transaction.inputs.length !== fixedInputCount || transaction.outputs.length !== fixedOutputCount) {
      throw new Error(
        'Computed-output repair changed the finalized transaction geometry '
        + `(inputs ${fixedInputCount}->${transaction.inputs.length}, `
        + `outputs ${fixedOutputCount}->${transaction.outputs.length}).`,
      );
    }
    recordComputedOutputConvergenceState(
      convergenceStates, computedOutputConvergenceFingerprint(encodeTransaction(transaction)),
    );
    if (beforeValidation) {
      const feeStartedAt = debugConvergenceRounds ? Date.now() : 0;
      const adjusted = beforeValidation(transaction);
      if (debugConvergenceRounds) {
        convergenceRounds.feeCalls += 1;
        convergenceRounds.feeMs += Date.now() - feeStartedAt;
      }
      if (adjusted) {
        acceptControlledOutputGeometry();
        continue;
      }
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process
      ?.env?.SOLIDC_DEBUG_ENTRY_COUNTS === '1' && sweep === 0) {
      logEntryCounts(host, builder);
    }
    const validateStartedAt = debugConvergenceRounds ? Date.now() : 0;
    assertFinalizedTransactionCovenants(builder, transaction);
    if (debugConvergenceRounds) {
      convergenceRounds.validations += 1;
      convergenceRounds.validateMs += Date.now() - validateStartedAt;
      console.error('convergence-rounds', {
        outcome: 'converged', ...convergenceRounds, totalMs: Date.now() - convergenceStartedAt,
      });
    }
    return transaction;
  }
  throw new Error(`Computed-output repair convergence exhausted after ${passLimit} passes.`);
}

function logEntryCounts(host: ConvergedFinalTransactionHost, builder: TransactionBuilder): void {
  for (const group of host.externalCallUtxoGroups) {
    if ((group.logicalFunctionName ?? group.functionName) !== 'transferFrom') continue;
    if (!group.categoryId || group.sharedGroupIndex !== undefined) continue;
    const master = host.findMintingInputIndex(group.categoryId);
    if (master < 0) continue;
    const entryLocks = new Map<string, number[]>();
    for (let i = 0; i < builder.outputs.length; i++) {
      const out = builder.outputs[i];
      const lock = out?.to instanceof Uint8Array ? binToHex(out.to) : '';
      const cat = out?.token?.category ?? '';
      if (cat !== group.categoryId || !lock.startsWith('aa20')) continue;
      const list = entryLocks.get(lock) ?? [];
      list.push(i);
      entryLocks.set(lock, list);
    }
    const extras: Array<{ index: number; lock: string; commitment: string; amount: string }> = [];
    for (const [lock, idxs] of entryLocks) {
      if (idxs.length <= 1) continue;
      for (const index of idxs) {
        if (index < master + 8) continue; // in-block
        const out = builder.outputs[index];
        extras.push({
          index,
          lock: lock.slice(0, 20),
          commitment: String(out?.token?.nft?.commitment ?? '').slice(0, 48),
          amount: String(out?.amount ?? ''),
        });
      }
    }
    console.error('transferFrom-entry-counts', JSON.stringify({
      master,
      categoryId: group.categoryId.slice(0, 16),
      blockEnd: master + 8,
      outputs: [...entryLocks.entries()].map(([lock, idxs]) => ({
        lock: lock.slice(0, 20), count: idxs.length, idxs,
      })),
      extras,
      inserts: host.externalCallEntryInserts?.length,
      predOuts: Object.fromEntries(Object.entries(group.internalArgs ?? {})
        .filter(([n]) => /vmapBatchPredOut|TrailingCount/.test(n))
        .map(([n, v]) => [n, String(v)])),
    }));
  }
}
