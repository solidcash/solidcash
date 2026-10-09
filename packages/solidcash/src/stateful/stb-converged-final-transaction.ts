/**
 * phase-boundary extract: STB class-body extract — converge authenticated computed outputs against
 * the exact transaction shape submitted to the provider.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { encodeTransaction } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
;
;
;
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import {
  computedOutputConvergenceFingerprint,
  computedOutputRepairPassLimit,
  recordComputedOutputConvergenceState,
  recordComputedOutputRepairTransition,
} from './computed-output-repair.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  allowsFinalizationVmRepairs,
  refuseFinalizationVmRepairsIfRecipe,
} from '../message-bus/materialization-mode.js';
import { getMessageBusPreflightModule } from './stb-plugin-loaders.js';
import { stripRelocatedMutableDuplicates } from './mutable-output-reassert.js';

export type ComputedChunkRepairResult = {
  changed: boolean;
  passed: boolean;
  repairedOutputs: number[];
  repairDetails: Array<{
    outputIndex: number;
    field: 'commitment' | 'lockingBytecode' | 'token';
    previous: string;
    proposed: string;
  }>;
};

function logRepairConvergenceTiming(
  sweep: number,
  inputIndex: number,
  stage: string,
  startedAt: number,
  result: ComputedChunkRepairResult,
): void {
  console.error('repair-convergence-timing', {
    sweep, inputIndex, stage, ms: Date.now() - startedAt,
    changed: result.changed, passed: result.passed,
    repairedOutputs: result.repairedOutputs.length,
  });
}

export interface ConvergedFinalTransactionHost {
  readonly masterUtxo: UnlockableUtxo;
  readonly categoryId: string;
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly allInputs: readonly UnlockableUtxo[];
  readonly externalCallEntryInserts?: ReadonlyArray<{ categoryId: string; to: Uint8Array; commitment: string }>;
  readonly resultDependentArgumentRefresher?: (builder: TransactionBuilder) => boolean;
  findMintingInputIndex(categoryId: string): number;
  repairComputedChunkOutput(
    builder: TransactionBuilder,
    inputIndex: number,
  ): ComputedChunkRepairResult;
  compilerOwnedTrailingEntryOutputIndices(): Set<number>;
  restoreDeclaredMutableEntrySlots(builder: TransactionBuilder): void;
  clearSupersededDelegateDynamicCollectionOutputs(builder: TransactionBuilder): void;
  clearUnclaimedConditionalEventSlots(builder: TransactionBuilder): void;
  syncRefreshedCarrierMasters(
    builder: TransactionBuilder,
    carriers: Iterable<ExternalCallUtxoGroup>,
  ): void;
  logCovenantFailureTrace(builder: TransactionBuilder, message: string): void;
}

/** Converge authenticated computed outputs against the exact transaction shape submitted to the provider. */
export function assertConvergedFinalTransaction(
  host: ConvergedFinalTransactionHost,
  builder: TransactionBuilder,
  afterRepairs?: () => void,
  beforeValidation?: (
    transaction: ReturnType<TransactionBuilder['buildLibauthTransaction']>,
  ) => boolean,
): ReturnType<TransactionBuilder['buildLibauthTransaction']> {
  let lastError: unknown;
  const fixedInputCount = builder.inputs.length;
  let fixedOutputCount = builder.outputs.length;
  let repairPassLimit = computedOutputRepairPassLimit(fixedInputCount, fixedOutputCount);
  let repairsRemaining = repairPassLimit;
  // Authenticated repairs can reveal an output-only resource whose compiler-owned final-layout callback then
  // materializes a new slot. Permit that controlled fixed-point transition, but never permit input geometry to
  // move and bound output-count revisions independently of field-repair passes.
  let geometryChangesRemaining = fixedInputCount + fixedOutputCount + 1;
  const debugRepairs = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_REPAIR_CONVERGENCE === '1';
  const debugPreflightTiming = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_PREFLIGHT_TIMING === '1';
  const repairHistory = new Map<string, string>();
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
    const nextPassLimit = computedOutputRepairPassLimit(fixedInputCount, builder.outputs.length);
    if (nextPassLimit > repairPassLimit) {
      repairsRemaining += nextPassLimit - repairPassLimit;
      repairPassLimit = nextPassLimit;
    }
    fixedOutputCount = builder.outputs.length;
    // An output insertion can move a prior numeric coordinate to a different semantic owner. Transaction-state
    // fingerprints still detect whole-state cycles; reset only coordinate-local claims for the new geometry.
    repairHistory.clear();
  };
  // Retained as a diagnostic, not a lever: it attributes the convergence cost to the rebuild, the covenant
  // preflight and the computed-output repairs separately, so a slow call site can be told apart from a
  // redundant sweep. Silent (and free) unless the variable is set.
  const debugConvergenceRounds = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_CONVERGENCE_ROUNDS === '1';
  const convergenceStartedAt = debugConvergenceRounds ? Date.now() : 0;
  const convergenceRounds = {
    sweeps: 0, builds: 0, validations: 0, rejected: 0, repairs: 0, feeCalls: 0,
    buildMs: 0, validateMs: 0, repairMs: 0, feeMs: 0,
  };
  const reportConvergenceRounds = (outcome: 'converged' | 'failed'): void => {
    if (!debugConvergenceRounds) return;
    console.error('convergence-rounds', {
      outcome, ...convergenceRounds, totalMs: Date.now() - convergenceStartedAt,
    });
  };
  const sameOutpoint = (left: Utxo | undefined, right: Utxo | undefined): boolean => (
    left !== undefined && right !== undefined
    && left.vout === right.vout && left.txid.toLowerCase() === right.txid.toLowerCase()
  );
  const describeInput = (inputIndex: number): unknown => {
    const input = builder.inputs[inputIndex];
    const owners: unknown[] = [];
    if (sameOutpoint(input, host.masterUtxo)) {
      owners.push({ kind: 'root', categoryId: host.categoryId });
    }
    for (const [groupIndex, group] of host.externalCallUtxoGroups.entries()) {
      if (!sameOutpoint(input, group.masterUtxo)) continue;
      owners.push({
        kind: 'externalCall',
        groupIndex,
        contract: group.externalContract?.inner?.artifact?.contractName,
        function: group.functionName,
        logicalFunction: group.logicalFunctionName,
        callMode: group.callMode,
        delegateCallGroupIndex: group.delegateCallGroupIndex,
        sharedGroupIndex: group.sharedGroupIndex,
      });
    }
    for (const [groupIndex, group] of host.lowLevelCallUtxoGroups.entries()) {
      if (!sameOutpoint(input, group.masterUtxo)) continue;
      owners.push({
        kind: 'lowLevelCall',
        groupIndex,
        contract: group.externalContract?.inner?.artifact?.contractName,
        function: group.functionName,
        logicalFunction: group.logicalFunctionName,
        routeFunction: group.compilerRoute?.abiFunction.name,
        callMode: group.callMode,
      });
    }
    return {
      categoryId: input?.token?.category,
      owners,
    };
  };
  let exhausted = true;
  for (let sweep = 0; sweep < repairPassLimit; sweep++) {
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
    try {
      if ((globalThis as { process?: { env?: Record<string, string> } }).process
        ?.env?.SOLIDC_DEBUG_ENTRY_COUNTS === '1' && sweep === 0) {
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
          const inLocks = new Map<string, number[]>();
          for (let i = 0; i < host.allInputs.length; i++) {
            const input = host.allInputs[i];
            if ((input?.token?.category ?? '') !== group.categoryId) continue;
            const lock = 'unlocker' in input && input.unlocker
              ? binToHex(input.unlocker.generateLockingBytecode()) : '';
            if (!lock.startsWith('aa20')) continue;
            const list = inLocks.get(lock) ?? [];
            list.push(i);
            inLocks.set(lock, list);
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
            predOuts: Object.fromEntries(Object.entries({
              ...group.compilerRoute?.internalArgs,
              ...group.internalArgs,
            }).filter(([n]) => /vmapBatchPredOut|TrailingCount/.test(n))
              .map(([n, v]) => [n, String(v)])),
          }));
        }
      }
      const validateStartedAt = debugConvergenceRounds ? Date.now() : 0;
      // Time every preflight attempt, not only the one which passes: a repair round is entered because an
      // attempt refused, and leaving those out of the accounting attributes their cost to nothing at all.
      let validationFailure: { error: unknown } | undefined;
      try {
        const preflight = getMessageBusPreflightModule();
        if (preflight === undefined) {
          throw new Error('Covenant convergence preflight is unavailable: the message-bus engine is still loading.');
        }
        preflight.assertFinalizedTransactionCovenants(builder, transaction);
      } catch (error) {
        validationFailure = { error };
      }
      if (debugConvergenceRounds) {
        convergenceRounds.validations += 1;
        convergenceRounds.validateMs += Date.now() - validateStartedAt;
        if (validationFailure !== undefined) convergenceRounds.rejected += 1;
      }
      if (validationFailure !== undefined) throw validationFailure.error;
      reportConvergenceRounds('converged');
      return transaction;
    } catch (error) {
      lastError = error;
      // VM-validator-only finalization: recipe mode — VM validates only. Do not mine commitments from the failing frame
      // or mutate planned outputs via `_repairComputedChunkOutput`. Explicit `devOracle` retains
      // the legacy repair-as-planner loop.
      if (!allowsFinalizationVmRepairs()) {
        // Validator-only mode must surface the covenant's actual rejection. The repair gate is an internal
        // planning constraint, not a replacement for the program error observed by callers.
        try { refuseFinalizationVmRepairsIfRecipe(); } catch { /* preserve the covenant error below */ }
        throw error;
      }
      const reason = error instanceof Error ? error.message : String(error);
      const failedInput = reason.match(/input(?: index)? (\d+)/)?.[1];
      if (failedInput === undefined) {
        exhausted = false;
        break;
      }
      const inputIndex = Number(failedInput);
      if (repairsRemaining === 0) {
        throw new Error(
          `Computed-output repair convergence exhausted after ${repairPassLimit} passes.`,
        );
      }
      let changed = false;
      while (repairsRemaining > 0) {
        const repairStartedAt = debugPreflightTiming || debugConvergenceRounds ? Date.now() : 0;
        const result = host.repairComputedChunkOutput(builder, inputIndex);
        if (debugConvergenceRounds) {
          convergenceRounds.repairs += 1;
          convergenceRounds.repairMs += Date.now() - repairStartedAt;
        }
        const reportConvergenceTiming = (stage: string): void => {
          if (debugPreflightTiming) {
            logRepairConvergenceTiming(sweep, inputIndex, stage, repairStartedAt, result);
          }
        };
        reportConvergenceTiming('repair-complete');
        if (debugRepairs) console.error('repair-convergence', JSON.stringify({
          sweep,
          inputIndex,
          repairsRemaining,
          changed: result.changed,
          passed: result.passed,
          outputs: result.repairedOutputs,
          repairs: result.repairDetails.map((repair) => ({
            ...repair,
            previous: repair.previous.slice(0, 48),
            proposed: repair.proposed.slice(0, 48),
            previousLength: repair.previous.length / 2,
            proposedLength: repair.proposed.length / 2,
            firstDifference: Array.from({ length: Math.max(repair.previous.length, repair.proposed.length) })
              .findIndex((_unused, index) => repair.previous[index] !== repair.proposed[index]),
            previousFull: repair.previous,
            proposedFull: repair.proposed,
            previousTail: repair.previous.slice(-48),
            proposedTail: repair.proposed.slice(-48),
          })),
          input: describeInput(inputIndex),
        }));
        for (const repair of result.repairDetails) {
          const coordinate = `${repair.outputIndex}:${repair.field}`;
          recordComputedOutputRepairTransition(
            repairHistory, inputIndex, coordinate, repair.proposed,
          );
        }
        if (!result.changed) break;
        changed = true;
        repairsRemaining -= 1;
        stripRelocatedMutableDuplicates(
          builder.outputs,
          host.allInputs,
          0,
          host.compilerOwnedTrailingEntryOutputIndices(),
        );
        reportConvergenceTiming('duplicates-stripped');
        // Computed-output recovery observes one failing participant at a time.
        // A repair for an earlier participant may therefore write through a
        // coordinate owned by a later participant's compiler-declared entry
        // slot. Reassert the complete transaction layout before evaluating the
        // next input, while retaining any newly computed commitment bytes.
        host.restoreDeclaredMutableEntrySlots(builder);
        reportConvergenceTiming('entry-slots-restored');
        // A computed-output repair may rediscover a pre-write dynamic chunk at
        // its old coordinate. The compiler-owned suffix is the complete new
        // collection, so reapply that ownership invariant after every repair.
        host.clearSupersededDelegateDynamicCollectionOutputs(builder);
        reportConvergenceTiming('delegate-collections-cleared');
        host.clearUnclaimedConditionalEventSlots(builder);
        reportConvergenceTiming('conditional-events-cleared');
        if (builder.inputs.length !== fixedInputCount || builder.outputs.length !== fixedOutputCount) {
          throw new Error(
            'Computed-output repair changed the finalized transaction geometry '
            + `(inputs ${fixedInputCount}->${builder.inputs.length}, `
            + `outputs ${fixedOutputCount}->${builder.outputs.length}).`,
          );
        }
        if (result.passed) break;
      }
      if (changed) {
        afterRepairs?.();
        if (host.resultDependentArgumentRefresher?.(builder)) {
          const refreshedCarriers = [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]
            .filter((carrier) => carrier.argumentsRefreshedDuringConvergence === true);
          host.syncRefreshedCarrierMasters(
            builder,
            refreshedCarriers,
          );
          for (const carrier of refreshedCarriers) {
            carrier.argumentsRefreshedDuringConvergence = false;
          }
        }
        acceptControlledOutputGeometry();
      }
      if (!changed) {
        exhausted = false;
        break;
      }
    }
  }
  if (exhausted) {
    throw new Error(`Computed-output repair convergence exhausted after ${repairPassLimit} passes.`);
  }
  if (lastError !== undefined) {
    host.logCovenantFailureTrace(
      builder, lastError instanceof Error ? lastError.message : String(lastError),
    );
  }
  reportConvergenceRounds('failed');
  throw lastError;
}
